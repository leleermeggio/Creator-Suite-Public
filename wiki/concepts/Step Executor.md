---
title: Step Executor
updated: 2026-04-19
tags: [concept, backend, service]
---

# Step Executor

Dispatches a single agent step (`tool_id` + parameters) to the actual service call. Lives at `backend/services/step_executor.py`.

## Tool → JobType map

```
transcribe → JobType.TRANSCRIBE
jumpcut    → JobType.JUMPCUT
caption    → JobType.CAPTION
export     → JobType.EXPORT
audio_cleanup → JobType.AUDIO_CLEANUP
thumbnail  → JobType.THUMBNAIL
translate  → JobType.TRANSLATE
tts        → JobType.TTS
download   → JobType.DOWNLOAD
convert    → JobType.CONVERT
```

## Context shape

```python
{
  "project_id": str,
  "user_id": str,
  "media_path": str | None,
  "previous_outputs": [
     {"tool_id": str, "output": dict},
     ...
  ]
}
```

## Conditions (today)

Single regex `^\w+\s*(>|<|>=|<=|==|!=)\s*\d+(?:\.\d+)?$`. After Spec 1 S1 → structured DSL with `kind` ∈ {expr, always, never, if_previous_failed, for_each}.

## Retry & resume (after S1)

Per-step `retry: {max_attempts, backoff_seconds}` and `on_fail: "abort"|"skip"|"continue"`. Resume rebuilds context from `Mission.step_results` slice up to `current_step_index`.

## Related

- [[Mission]]
- [[Agent]]
- [[Tool]]
- [[Spec 1 — Smart Agents]]
