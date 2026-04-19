---
type: entity
entity_kind: ai-provider
status: active
tags: [entity, ai, vendor]
created: 2026-04-18
updated: 2026-04-18
---

# Gemini (Google)

Primary AI provider for Creator Zone tools. Requires `GOOGLE_API_KEY` env var.

## Uses
- `/tools/translate` — primary (MyMemory fallback)
- `/tools/summarize` — bullet summaries
- `/tools/ocr` — Gemini Vision for image text extraction
- Other services under `backend/services/` (caption generation, etc.)

## Related
- [[modules/backend]]
- [[flows/tools-request]]
