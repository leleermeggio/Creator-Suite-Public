---
title: Smart Agents — Design Spec
date: 2026-04-19
status: Draft
owner: leleermeggio@gmail.com
sessions: [S1, S2, S3, S4]
parent_roadmap: ../roadmap/2026-04-19-master-roadmap.md
---

# Spec 1 — Smart Agents

## Problem

The current agent engine works but is dumb. Concretely, the gaps in `backend/services/step_executor.py` and `mission_service.py`:

1. **Branching is too weak.** Conditions only support `<var> <op> <number>` (regex `^\w+\s*(>|<|>=|<=|==|!=)\s*\d+(?:\.\d+)?$`). No if/else, no per-clip iteration, no fallback step.
2. **No retry.** A failing tool call (e.g. transient Gemini quota) kills the whole mission. User has to restart from step 0.
3. **No resume.** A mission that errored cannot be resumed — the executor doesn't reconstruct context from `step_results`.
4. **COPILOTA approval is implicit.** The `auto_run` flag decides if a step runs automatically, but there's no UI gate where the user reviews the *output* of step N before step N+1 starts. Today the UI only gates the *start* of the next step, not its inputs.
5. **AI-generated agents are blind.** `generate_agent_from_description` returns a complete agent with no preview UI; the user can't tweak parameters before saving. Smart defaults are absent — every step gets `parameters: {}`.
6. **No "agent suggest".** Given a media file the app cannot recommend the best preset agent. User must browse the 9 presets.
7. **No memory.** If the user always sets caption style to "shorts" and thumbnail style to "cinematic", they retype it every time. No `user_preferences` table exists.

## Goals

- Mission engine survives transient failures (retry) and explicit pauses (resume).
- Branching expressive enough for the realistic creator workflow: "if duration > 60 split into 3 clips; else keep as one; if any clip fails, skip but continue".
- COPILOTA mode shows a preview of step output and waits for explicit user approval before continuing.
- AI agent generation is interactive: preview → tweak → save.
- App proactively suggests an agent when the user uploads media.
- Per-user preferences persist and pre-fill agent step parameters.

## Non-goals

- Real-time multi-user collaboration on a mission. (Single user per mission for now.)
- Cost-based step optimization (e.g. "use cheaper Whisper for short clips"). Future.
- Visual node-graph editor for agents. Linear list with conditions stays.

## Success criteria

- A mission with a step that fails twice transiently completes after auto-retry.
- A mission paused mid-execution can be resumed via `POST /missions/{id}/resume` and produces identical final output to one not paused.
- A user reviewing 5 caption variants in COPILOTA mode picks one and the export step receives that exact variant — confirmed by integration test.
- AI-generated agents include non-empty `parameters` for at least 80% of steps based on the description (eyeballed on 10 sample descriptions).
- Suggesting an agent for a 10-min podcast .mp3 returns `podcast_clip` preset in the top-3 results — integration test.
- Setting caption style to "shorts" twice in a row causes the third agent run to default to "shorts" — integration test.

---

## Architecture

Four sub-systems, in dependency order. One session each.

### S1 — Engine: branching, retry, resume

**Where:** `backend/services/step_executor.py`, `backend/services/mission_service.py`, `backend/models/mission.py` (new fields), Alembic migration.

**Branching DSL upgrade.** Replace the single-line condition string with a structured `condition` object on each step:

```json
{
  "tool_id": "jumpcut",
  "label": "Trim long video",
  "parameters": {},
  "auto_run": true,
  "required": true,
  "condition": {
    "kind": "expr",
    "expr": "duration > 60"
  },
  "on_fail": "skip",
  "retry": { "max_attempts": 3, "backoff_seconds": [1, 4, 16] }
}
```

`condition.kind` ∈ `{"expr", "always", "never", "if_previous_failed", "for_each"}`.

- `expr` — same comparison as today (kept for back-compat).
- `always` / `never` — explicit.
- `if_previous_failed` — runs only if the immediately previous step had `status: failed`. Enables fallback steps.
- `for_each: {source: "clips"}` — repeats this step once per item in `previous_outputs[*].clips`. Enables N-clip processing in `repurpose` preset.

Old string-form conditions are normalised at **read time** by `step_executor` into `{kind: "expr", expr: "<old>"}`. The Alembic migration adds new mission columns only; it does NOT rewrite existing `agents.steps` JSON, so old presets keep working without DB churn.

**Retry policy.** Per-step `retry` object. Defaults: `{max_attempts: 1}` (no retry) for back-compat. The executor catches exceptions, increments an attempt counter on the step result, and reschedules with `await asyncio.sleep(backoff_seconds[attempt-1])`. Max attempts hit → step `status: failed`, then `on_fail` decides: `"abort"` (default), `"skip"`, `"continue"`.

**Resume.** Add `MissionStatus.PAUSED` already exists; we add `MissionStatus.SUSPENDED` for "paused due to failure, awaiting user action". New endpoints:

- `POST /missions/{id}/pause` — set status PAUSED at next step boundary.
- `POST /missions/{id}/resume` — re-enter executor at `current_step_index`, rebuilding context from `step_results`.
- `POST /missions/{id}/retry-step/{idx}` — clear that step's result and re-execute, leaving downstream untouched.

**Context rebuild on resume.** `build_step_context` already accepts `previous_outputs`. The resume endpoint loads `mission.step_results[:current_step_index]`, normalizes to the format expected, and calls the executor. No changes to existing per-tool handlers.

**Tests.** `backend/tests/services/test_step_executor.py` covers: retry succeeds on flake, retry exhausts to abort, on_fail=skip continues, for_each iterates over clips, if_previous_failed runs fallback, resume recovers state.

### S2 — Approval gates in COPILOTA

**Where:** `backend/routes/missions.py`, `frontend/app/mission/[id].tsx`, new schema for "step preview".

**Backend.** When a step completes in COPILOTA mode and the *next* step has `auto_run: false`, the mission transitions to `MissionStatus.PAUSED` automatically. The previous step's output is exposed via `GET /missions/{id}` in `step_results[idx].preview`.

A step result schema gains:
```python
{
  "tool_id": "caption",
  "status": "completed",
  "output": {...},                 # raw tool output
  "preview": {                     # human-friendly summary for UI
    "kind": "caption_variants",
    "items": [
      {"id": "v1", "text": "...", "selected": false},
      {"id": "v2", "text": "...", "selected": false}
    ]
  },
  "user_choice": null              # filled when user picks
}
```

The frontend POSTs `POST /missions/{id}/steps/{idx}/approve` with `{user_choice: {...}}`. The chosen value is merged into `previous_outputs` for downstream steps.

**Frontend.** `mission/[id].tsx` gains a `ReviewPanel` component. When `status === PAUSED` and the latest step has a `preview`, render the appropriate review widget:

- `caption_variants` → cards with text + "Use this" button.
- `thumbnail_pack` → image grid with select.
- `clip_suggestions` → timeline with checkboxes per clip.
- generic `text` → markdown view + Approve/Reject.

Tap "Use this" → `approve` → mission auto-resumes.

**Tests.** Backend integration test: full mission goes RUNNING → PAUSED on caption step → POST approve → RUNNING → COMPLETED. Frontend: `tsc --noEmit` only (no test framework yet).

### S3 — AI generator v2 + agent suggest

**Where:** `backend/services/agent_service.py`, `backend/routes/agents.py`, new endpoint, `frontend/app/agent/new.tsx`.

**Preview before save.** Split `generate_agent_from_description` into two endpoints:

- `POST /agents/preview` — takes description, returns the *unsaved* agent JSON. No DB write.
- `POST /agents/from-preview` — takes the (possibly user-edited) preview JSON, validates, persists.

Frontend: after typing a description, the user lands on an editable preview screen. Each step row is editable (label, parameters, auto_run). Save commits.

**Smart defaults.** When Gemini returns `parameters: {}`, the service fills in sensible defaults per `tool_id` from a static table:

```python
SMART_DEFAULTS = {
    "jumpcut":     {"silence_threshold": -35.0, "min_silence": 0.4, "padding": 0.12},
    "transcribe":  {"model": "small"},
    "caption":     {"style": "shorts"},
    "thumbnail":   {"style": "viral", "count": 1},
    "audio_cleanup": {"denoise": True, "normalize": True, "target_loudness": -14},
    "tts":         {"voice": "default"},
    "translate":   {"target_language": "en"},
    "export":      {"format": "mp4", "resolution": "1080x1920"},
}
```

If `user_preferences` exists (from S4), prefer those values over the static table.

**Agent suggest.** New `POST /agents/suggest` endpoint:

- Input: exactly one of `{media_id: str}` (BE looks up metadata) or `{media_metadata: {duration: float, has_audio: bool, has_video: bool, source: str}}` (caller supplies). 422 if both or neither.
- Logic: heuristic scorer over the 9 preset agents, returning top-3 with scores + reasoning. Heuristics live in `agent_service.py`:
  - duration > 600s + audio-only → `podcast_clip` boost.
  - duration < 60s + video → `short_video` boost.
  - source includes "youtube.com" → `repurpose` boost.
- Output: `[{agent_id, score, reason}, ...]`.

This is intentionally rule-based, not LLM-based, to keep latency low and avoid token cost on every upload. A future iteration can layer Gemini on top.

**Tests.** Backend: preview endpoint returns valid JSON without DB write; suggest returns expected preset for canonical inputs.

### S4 — Agent memory (per-user prefs)

**Where:** new model `backend/models/user_preferences.py`, new routes `backend/routes/preferences.py`, integration in `agent_service.SMART_DEFAULTS` lookup.

**Model.**
```python
class UserPreferences(Base):
    __tablename__ = "user_preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    tool_defaults: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # tool_defaults shape: {"caption": {"style": "shorts"}, "thumbnail": {"style": "viral"}}
    updated_at: Mapped[datetime] = ...
```

**Auto-learn.** When a mission completes successfully, a post-completion hook in `mission_service` walks `step_results`, and for each step compares the actually-used parameters against `SMART_DEFAULTS[tool_id]`. Any value that differs is written to `user_preferences.tool_defaults[tool_id]` — but only after the **same** divergent value appears in 2+ consecutive completed missions for that user (debounce: avoids one-off experiments locking in as preferences).

**Lookup priority** in `agent_service`:
1. User-provided parameters in the agent step.
2. `user_preferences.tool_defaults[tool_id]`.
3. `SMART_DEFAULTS[tool_id]`.
4. Empty dict.

**Routes.** Standard CRUD: `GET /preferences`, `PATCH /preferences`, `DELETE /preferences/{tool_id}`. All scoped to `user.id`. Frontend exposes a "Reset to defaults" button on the Settings tab.

**Tests.** Backend: completing a mission with `caption.style = "shorts"` twice causes the third agent generation to default to "shorts".

---

## Data flow (end-to-end after all 4 sessions)

```
User uploads media
   │
   ▼
POST /agents/suggest         (S3)
   │
   ▼
User picks an agent → POST /missions (existing)
   │
   ▼
Engine runs steps           (S1: branching/retry)
   │
   ├─ Step output kind = "preview" + auto_run=false → PAUSE   (S2)
   │     │
   │     ▼
   │   User sees ReviewPanel → POST /approve
   │     │
   │     ▼
   │   Engine resumes
   │
   ├─ Step fails
   │     │
   │     ▼
   │   Retry per policy → still fails → on_fail decision
   │
   ▼
Mission COMPLETED → write user_preferences updates   (S4)
```

---

## Database changes summary

| Session | Table | Change |
|---------|-------|--------|
| S1 | `missions` | Add column `paused_reason: str|null`, `attempt_counters: JSON|null`. Migration auto-converts existing string conditions in `agents.steps` JSON. |
| S2 | `missions.step_results` (JSON) | New optional `preview` and `user_choice` keys. No schema change. |
| S2 | `missions.status` enum | Add value `SUSPENDED`. |
| S3 | none | New endpoints only. |
| S4 | new `user_preferences` table | Created. |

All migrations: `alembic revision --autogenerate -m "..."` then hand-edit to ensure data is preserved.

---

## API surface added

```
POST /missions/{id}/pause
POST /missions/{id}/resume
POST /missions/{id}/retry-step/{idx}
POST /missions/{id}/steps/{idx}/approve   { user_choice: any }
POST /agents/preview                      { description: str }
POST /agents/from-preview                 { agent: AgentCreate }
POST /agents/suggest                      { media_id?, media_metadata? }
GET  /preferences
PATCH /preferences                        { tool_defaults: {...} }
DELETE /preferences/{tool_id}
```

All require auth. Rate limits: `5/minute` on `/agents/preview` (LLM cost), default elsewhere.

---

## Frontend changes summary

| Session | Files | Change |
|---------|-------|--------|
| S1 | none | Engine work is BE-only. |
| S2 | `app/mission/[id].tsx`, new `components/ReviewPanel.tsx`, `services/missionsApi.ts` | Pause-aware UI, review widgets per preview kind. |
| S3 | `app/agent/new.tsx`, new `components/AgentPreview.tsx`, new home-screen `components/SuggestedAgentBanner.tsx` | Preview-edit flow + suggest banner on media upload. |
| S4 | `app/(tabs)/settings.tsx`, `services/preferencesApi.ts` | Settings section "Default ricreati per ogni tool" with reset. |

All user-visible strings in Italian per project rule.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `for_each` introduces accidental quadratic blow-up (N clips × M steps) | Cap `for_each` iterations at 20, log warning above 10. |
| Retry on a non-idempotent step (e.g. publish) corrupts state | `retry` defaults to `{max_attempts: 1}`. Each tool handler declares idempotency in a static table; engine refuses to retry non-idempotent steps unless explicitly opted in. |
| Auto-learning prefs locks user into a bad default | "Reset to defaults" button in Settings; only auto-learn after 2+ confirmations of the same value. |
| Suggest heuristic feels arbitrary | Show the `reason` field in the UI banner so the user understands why the agent is suggested. |
| Migration breaks existing missions in flight | Run migration only when no mission is RUNNING; reject startup if any RUNNING mission predates the migration. |

---

## Out of scope (explicit)

- Visual graph editor for agents.
- Cost-aware tool selection (e.g. small Whisper for short clips).
- Multi-user collaboration on one mission.
- Step parallelism inside a single mission. (Sequential only — `for_each` runs serially.)
- LLM-based agent suggester. Heuristic only this round.

---

## Definition of Done (Spec 1 fully)

- All 4 sessions S1-S4 merged.
- Migrations applied cleanly on the dev DB and on a fresh DB.
- Test suite green: `pytest backend/tests/services/test_step_executor.py backend/tests/routes/test_missions.py backend/tests/routes/test_agents.py backend/tests/routes/test_preferences.py -x -q`.
- Manual QA: run `repurpose` preset on a 10-min video end-to-end. Pause/resume works. AI-suggested agent banner appears on next upload.
- This spec's `status:` frontmatter changed to `Implemented`.
- Wiki page `Spec 1 — Smart Agents` synced in Obsidian (S0 ingested it; S16 lints it).
