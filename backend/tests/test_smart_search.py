from __future__ import annotations

from backend.services.smart_search_service import search_transcriptions


def test_search_transcriptions_finds_matching_segments():
    transcriptions = [
        {
            "asset_id": "asset-1",
            "segments": [
                {"start": 0.0, "end": 5.0, "text": "Welcome to the cooking show"},
                {"start": 5.0, "end": 10.0, "text": "Today we make pasta with tomato sauce"},
                {"start": 10.0, "end": 15.0, "text": "First step is to boil the water"},
            ],
        },
        {
            "asset_id": "asset-2",
            "segments": [
                {"start": 0.0, "end": 5.0, "text": "This is a gaming video"},
                {"start": 5.0, "end": 10.0, "text": "Let me show you the best strategy"},
            ],
        },
    ]

    results = search_transcriptions("pasta tomato", transcriptions)
    assert len(results) >= 1
    assert results[0]["asset_id"] == "asset-1"
    assert results[0]["start"] == 5.0
    assert results[0]["relevance_score"] > 0


def test_search_transcriptions_no_match():
    transcriptions = [
        {
            "asset_id": "asset-1",
            "segments": [
                {"start": 0.0, "end": 5.0, "text": "Hello world"},
            ],
        },
    ]

    results = search_transcriptions("quantum physics", transcriptions)
    assert len(results) == 0


def test_search_transcriptions_empty_input():
    results = search_transcriptions("test", [])
    assert results == []
