---
title: Mission
updated: 2026-04-19
tags: [concept, backend, model]
---

# Mission

An **instance** of an [[Agent]] running on a [[Project]] for a user. Holds execution state.

## Model

`backend/models/mission.py` → `missions` table.

```python
id: UUID
agent_id: UUID
project_id: UUID
user_id: UUID
status: MissionStatus     # PENDING | RUNNING | PAUSED | COMPLETED | FAILED
current_step_index: int
mode: ControlMode
step_results: JSON | None   # list[{tool_id, status, output, ...}]
insights: JSON | None
started_at, completed_at
```

## Lifecycle

```
PENDING ──start──► RUNNING ──complete──► COMPLETED
                      │
                      ├─pause/copilota─► PAUSED ──resume──► RUNNING
                      │
                      └─error──────────► FAILED
```

After Spec 1 (S1-S2):
- New status **SUSPENDED** (auto-paused on retry exhaustion).
- New endpoints `POST /missions/{id}/pause`, `/resume`, `/retry-step/{idx}`, `/steps/{idx}/approve`.
- `step_results[idx].preview` carries human-friendly summaries for the UI.

## Related

- [[Agent]]
- [[Project]]
- [[Step Executor]]
- [[Control Mode]]
- [[Spec 1 — Smart Agents]]
