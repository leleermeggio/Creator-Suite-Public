---
title: Control Mode
updated: 2026-04-19
tags: [concept, backend, enum]
---

# Control Mode

How autonomous the [[Agent]] is when running a [[Mission]].

`backend/models/enums.py::ControlMode`:

| Mode | Behaviour |
|------|-----------|
| **REGISTA** | Manual. Every step waits for user trigger. |
| **COPILOTA** | Mixed. Each step's `auto_run` flag decides. After Spec 1 S2: also pauses to show preview when `auto_run=false`. |
| **AUTOPILOTA** | Full auto. Every step runs unattended. |

Decision lives in `backend/services/step_executor.py::_should_auto_run`.

## Related

- [[Agent]]
- [[Mission]]
- [[Step Executor]]
