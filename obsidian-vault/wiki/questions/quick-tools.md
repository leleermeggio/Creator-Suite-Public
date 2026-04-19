---
type: question
status: answered
asked: 2026-04-19
tags: [question, tools]
created: 2026-04-19
updated: 2026-04-19
---

# Q: What do you know about Quick Tools?

## Answer

Quick Tools is a tab in the Expo frontend (`app/(tabs)/`) that exposes 9 tools via `app/tool/[id].tsx`. All synchronous and fast — they route through backend `/tools/*` endpoints (no API keys in the frontend).

Three backend tool endpoints confirmed in `routes/tools.py`:
- `POST /tools/translate` — text + target_language → translated text. Gemini primary, MyMemory fallback.
- `POST /tools/summarize` — text → bullet-point summary. Gemini-only (requires `GOOGLE_API_KEY`).
- `POST /tools/ocr` — image_base64 → extracted text. Gemini Vision.

Other 6 Quick Tools (thumbnail, TTS, transcribe, jumpcut, convert, watermark) are async — they create a Job record and return 202 `{job_id, status: queued}`, then the client polls `GET /jobs/{job_id}`.

Response shape for sync tools: `{ "result": "<string>" }`. Errors in Italian on the frontend, English in backend logs/JSON `detail`.

Recent fix: commit `bcc4765 fix(frontend): render Quick Tools cards on web` — cards now display correctly on Expo web build.

## Sources
- [[flows/tools-request]]
- [[flows/async-job-flow]]
- [[modules/backend]]
- [[modules/frontend]]
- [[entities/Gemini]]
- [[sources/tools-update]]
