---
title: Agent
updated: 2026-04-19
tags: [concept, backend, model]
---

# Agent

A pipeline definition: ordered list of steps with a default [[Control Mode]] and target platforms.

## Model

`backend/models/agent.py` → `agents` table.

```python
id: UUID
user_id: UUID | None    # NULL = preset agent (system)
name: str
icon: str               # single emoji
description: str | None
steps: JSON             # list[StepDefinition]
default_mode: ControlMode
target_platforms: JSON  # list[str]
is_preset: bool
preset_id: str | None
```

## Step shape (today)

```json
{
  "tool_id": "transcribe",
  "label": "Trascrivi",
  "parameters": { "model": "small" },
  "auto_run": true,
  "required": true,
  "condition": "duration > 60"   // string today; structured object after S1
}
```

## After Spec 1 (post S1-S4)

- `condition` becomes structured: `{kind: "expr"|"always"|"never"|"if_previous_failed"|"for_each", ...}`
- Each step gains `retry: {max_attempts, backoff_seconds}` and `on_fail: "abort"|"skip"|"continue"`.
- Agents can be **previewed** via `POST /agents/preview` before save.
- App can **suggest** an agent for an uploaded media via `POST /agents/suggest`.

## Presets (9)

short_video · podcast_clip · blog_da_video · thumbnail_pack · audio_cleanup · repurpose · traduci_localizza · multi_platform · content_refresh

Source: `backend/services/agent_service.py::PRESET_AGENTS`.

## Related

- [[Mission]] — instance of an agent execution
- [[Step Executor]] — runs the steps
- [[Control Mode]] — REGISTA/COPILOTA/AUTOPILOTA
- [[Spec 1 — Smart Agents]]
