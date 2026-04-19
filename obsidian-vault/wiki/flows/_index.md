---
type: meta
title: "Flows Index"
tags: [index, flows]
---

# Flows

End-to-end sequences across modules.

- [[auth-flow]] — JWT RS256 register/login/refresh, auto-retry on 401.
- [[async-job-flow]] — 202 + Celery worker + job polling. Used by transcribe, jumpcut, TTS, convert.
- [[tools-request]] — synchronous `/tools/*` pipeline. Translate, summarize, OCR.
