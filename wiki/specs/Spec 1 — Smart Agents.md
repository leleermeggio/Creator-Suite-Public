---
title: Spec 1 — Smart Agents
status: Draft
date: 2026-04-19
sessions: [S1, S2, S3, S4]
source: ../../docs/superpowers/specs/2026-04-19-agenti-smart-design.md
tags: [spec, agents]
---

# Spec 1 — Smart Agents

> Full design lives at `docs/superpowers/specs/2026-04-19-agenti-smart-design.md`. This page indexes it for the wiki graph.

## Sessions

- **S1** — engine: branching, retry, resume → modifies [[Step Executor]], [[Mission]]
- **S2** — approval gates COPILOTA → modifies [[Mission]], `frontend/app/mission/[id].tsx`
- **S3** — AI generator v2 + agent suggest → modifies [[Agent]], `agent_service`
- **S4** — agent memory → adds `UserPreferences` model

## Key concepts touched

- [[Agent]]
- [[Mission]]
- [[Control Mode]] (REGISTA / COPILOTA / AUTOPILOTA)
- [[Step Executor]]
- [[Tool]]

## API surface added

```
POST /missions/{id}/pause
POST /missions/{id}/resume
POST /missions/{id}/retry-step/{idx}
POST /missions/{id}/steps/{idx}/approve
POST /agents/preview
POST /agents/from-preview
POST /agents/suggest
GET  /preferences
PATCH /preferences
DELETE /preferences/{tool_id}
```

## Open questions

(None right now — all clarified in spec self-review pass.)

## Linked plans

- `docs/superpowers/plans/2026-04-19-agenti-smart.md` (to be written at S0 wrap or S1 kickoff via `superpowers:writing-plans`)
