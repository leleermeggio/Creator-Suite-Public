from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)


def search_transcriptions(
    query: str,
    transcriptions: list[dict],
) -> list[dict]:
    """Search through transcription segments for matching content.

    Simple keyword-based search. For production, use Gemini multimodal.

    Args:
        query: Search query text.
        transcriptions: List of {asset_id, segments: [{start, end, text, words}]}

    Returns:
        Ranked list of {asset_id, start, end, text, relevance_score}
    """
    query_lower = query.lower()
    query_words = set(query_lower.split())
    results = []

    for t in transcriptions:
        asset_id = t.get("asset_id", "")
        for seg in t.get("segments", []):
            text = seg.get("text", "")
            text_lower = text.lower()

            # Simple word overlap scoring
            seg_words = set(text_lower.split())
            overlap = query_words & seg_words
            if not overlap:
                continue

            score = len(overlap) / max(len(query_words), 1)
            results.append({
                "asset_id": asset_id,
                "start": seg.get("start", 0),
                "end": seg.get("end", 0),
                "text": text,
                "relevance_score": round(score, 3),
            })

    results.sort(key=lambda r: r["relevance_score"], reverse=True)
    return results[:50]


async def search_with_gemini(
    query: str,
    transcriptions: list[dict],
    api_key: str | None = None,
) -> list[dict]:
    """Search using Gemini multimodal API for semantic understanding.

    Falls back to keyword search if Gemini is unavailable.

    Args:
        query: Natural language search query.
        transcriptions: List of {asset_id, segments}.
        api_key: Google API key. Reads from env if None.

    Returns:
        Ranked list of matches.
    """
    if api_key is None:
        api_key = os.getenv("GOOGLE_API_KEY", "")

    if not api_key:
        logger.warning("No GOOGLE_API_KEY set, falling back to keyword search")
        return search_transcriptions(query, transcriptions)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Build context from transcriptions
        context_parts = []
        for t in transcriptions:
            asset_id = t.get("asset_id", "")
            for seg in t.get("segments", []):
                context_parts.append(
                    f"[{asset_id}|{seg['start']:.1f}-{seg['end']:.1f}] {seg['text']}"
                )

        context = "\n".join(context_parts[:200])  # Limit context size

        prompt = (
            f"Given the following timestamped transcription segments from video assets, "
            f"find the segments most relevant to this query: \"{query}\"\n\n"
            f"Transcription segments:\n{context}\n\n"
            f"Return a JSON array of the top 10 most relevant results with format: "
            f'[{{"asset_id": "...", "start": 0.0, "end": 0.0, "text": "...", "relevance_score": 0.0-1.0}}]'
            f"\nOnly return the JSON array, nothing else."
        )

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Parse JSON from response
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        results = json.loads(text)
        return results[:50]

    except Exception as e:
        logger.warning("Gemini search failed (%s), falling back to keyword search", e)
        return search_transcriptions(query, transcriptions)
