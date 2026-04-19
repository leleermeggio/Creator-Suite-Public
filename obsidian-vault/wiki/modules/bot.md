---
type: module
path: "bot.py"
status: legacy
language: python
purpose: "Single-process async Telegram bot, ConversationHandler with 14 states, all Italian UI"
maintainer: "Emanuele"
depends_on: ["[[entities/python-telegram-bot]]", "[[entities/Whisper]]", "[[entities/ffmpeg]]"]
used_by: []
tags: [module, bot, legacy]
created: 2026-04-18
updated: 2026-04-18
---

# Telegram Bot (`bot.py`)

Single-process async bot using `python-telegram-bot` ≥22. Legacy surface preserved alongside backend REST API.

## Key facts

- 14-state `ConversationHandler`
- All user-facing strings in Italian
- Auth via `ALLOWED_USERS` env var (comma-separated Telegram IDs, empty = allow all)
- Audio processing via Whisper (configurable model tiny/base/small/medium)
- Video processing via ffmpeg (subtitles, jumpcut, compress, convert)

## Status

Active but legacy — new feature work prioritizes backend/frontend stack. Integration plan: `[[sources/telegram-backend-integration]]`.

## Related

- [[sources/telegram-backend-integration]]
- [[entities/Whisper]]
- [[entities/ffmpeg]]
