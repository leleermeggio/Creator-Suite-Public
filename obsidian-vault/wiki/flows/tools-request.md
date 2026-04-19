---
type: flow
status: active
tags: [flow, tools, sync]
created: 2026-04-18
updated: 2026-04-18
---

# Tools Request Flow

Synchronous BE tools for fast ops (translate, summarize, OCR). Frontend never holds external API keys — requests route through backend.

## Entry points

| Route | Purpose | Dependency |
|-------|---------|-----------|
| POST `/tools/translate` | text + target_language → translated text | Gemini → MyMemory fallback |
| POST `/tools/summarize` | text → bullet summary | Gemini (GOOGLE_API_KEY required) |
| POST `/tools/ocr` | image_base64 → extracted text | Gemini Vision |

## Steps

1. FE screen `app/tool/[id].tsx` gathers input
2. POST via `apiClient.ts` with JWT header
3. BE route validates, calls service (Gemini SDK or fallback)
4. Response shape: `{ "result": "<string>" }`
5. FE displays result in output panel

## Error paths

- 401 → refresh flow ([[flows/auth-flow]])
- 422 missing text/language → FE form validation
- 500 provider down → FE shows Italian error banner, tries fallback if configured

## Related
- [[modules/backend]] (`routes/tools.py`, `services/`)
- [[modules/frontend]] (`app/tool/[id].tsx`)
- [[entities/Gemini]]
- [[decisions/api-conventions]]
