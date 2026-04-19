# SESSION_GUIDE — Creator Zone Programme 2026 Q2

**Use this every time you start Claude Code.** Pick the next session, set the model, paste the kickoff prompt.

Source of truth for plan: [`docs/superpowers/roadmap/2026-04-19-master-roadmap.md`](superpowers/roadmap/2026-04-19-master-roadmap.md)

---

## How to read this guide

1. Find first row with status ⏳ (pending). That is your next session.
2. Run `/model <name>` from the **Model command** column to switch.
3. Copy the **Kickoff prompt** column verbatim into Claude Code.
4. When session done: edit this file, change status to ✅.

---

## Model rules of thumb

| Model | Use for | Cost factor |
|-------|---------|-------------|
| **Opus 4.7** | Design, architecture, hard reasoning, code review | 1× (baseline expensive) |
| **Sonnet 4.6** | Implementation following a written plan, scaffolding, refactor | ~0.2× |
| **Haiku 4.5** | Mechanical edits, lint fixes, doc updates, commits, wrap | ~0.04× |

**Switch command (paste at session start):**
```
/model claude-opus-4-7-20260101
/model claude-sonnet-4-6-20260101
/model claude-haiku-4-5-20251001
```
> If model IDs have changed, run `/model` with no arg to see available IDs.

---

## Session table

Legend: ⏳ pending · 🔄 in progress · ✅ done · ⏸ blocked

| # | Status | Title | Filone | Model | Model command | Kickoff prompt |
|---|--------|-------|--------|-------|---------------|----------------|
| **S0** | 🔄 | Bootstrap | Meta | Opus 4.7 | `/model claude-opus-4-7-20260101` | "Run S0 bootstrap. Create Obsidian vault, ingest CLAUDE.md + .claude/rules/* + docs/superpowers/**, write Spec 1 design + plan, commit." |
| **S1** | ⏳ | Agent engine: branching/retry/resume | 1 | Opus 4.7 | `/model claude-opus-4-7-20260101` | "Run S1 from Spec 1 plan. Implement branching/retry/resume in `backend/services/step_executor.py` and `mission_service.py`. TDD. Tests green before commit." |
| **S2** | ⏳ | Approval gates COPILOTA | 1 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S2 from Spec 1 plan. Implement pause-on-step + preview output in mission UI (`frontend/app/mission/[id].tsx`) and BE pause endpoints." |
| **S3** | ⏳ | AI generator v2 + agent suggest | 1 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S3 from Spec 1 plan. Add preview-before-save to `agent_service.generate_agent_from_description`. Add `POST /agents/suggest` that recommends an agent from media metadata." |
| **S4** | ⏳ | Agent memory per-user | 1 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S4 from Spec 1 plan. Add `user_preferences` model + persist last-used caption/thumb style. Wire into agent step defaults." |
| **S5** | ⏳ | Spec 2 kickoff (design + plan) | Meta | Opus 4.7 | `/model claude-opus-4-7-20260101` | "Run S5: brainstorm Spec 2 (Creator Capabilities), write design doc and plan. Cover brand kit, publish, calendar, batch, A/B, voice clone." |
| **S6** | ⏳ | Brand kit + asset library | 2 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S6 from Spec 2 plan. Add `BrandKit` and `Asset` models, CRUD routes, FE picker components, integration with thumbnail/caption/export." |
| **S7** | ⏳ | Publish to platforms | 2 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S7 from Spec 2 plan. Implement direct publish endpoints for connected TikTok/YouTube/Instagram via existing connectors." |
| **S8** | ⏳ | Content calendar + scheduling | 2 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S8 from Spec 2 plan. Add scheduled missions, Celery beat worker, calendar UI." |
| **S9** | ⏳ | Batch processing | 2 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S9 from Spec 2 plan. Allow N URLs → 1 agent → N missions, parallel where safe, batch progress UI." |
| **S10** | ⏳ | A/B thumb + voice clone | 2 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S10 from Spec 2 plan. A/B thumbnail variants with CTR tracking; voice profile capture and TTS clone." |
| **S11** | ⏳ | Spec 3 kickoff (design + plan) | Meta | Opus 4.7 | `/model claude-opus-4-7-20260101` | "Run S11: brainstorm Spec 3 (UX & Flow), write design doc and plan. Cover onboarding, next-action, workspace, search, push, mobile." |
| **S12** | ⏳ | Onboarding + home next-action | 3 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S12 from Spec 3 plan. First-run wizard + 'what should I do now?' card on home." |
| **S13** | ⏳ | Project workspace visual | 3 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S13 from Spec 3 plan. Redesign phase board: visual, kanban-ish, drag&drop." |
| **S14** | ⏳ | Quick capture + global search | 3 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S14 from Spec 3 plan. Drop-URL flow with intent menu + global search across projects/assets/missions." |
| **S15** | ⏳ | Push notifications + mobile polish | 3 | Sonnet 4.6 | `/model claude-sonnet-4-6-20260101` | "Run S15 from Spec 3 plan. Push notify on job completion + mobile polish pass." |
| **S16** | ⏳ | Wrap (lint Obsidian, CLAUDE.md, CHANGELOG) | Meta | Haiku 4.5 | `/model claude-haiku-4-5-20251001` | "Run S16 wrap. Run wiki-lint, update CLAUDE.md with new patterns, write CHANGELOG entries grouped by spec." |

---

## Standard pre-flight (every session)

Before pasting kickoff prompt:
1. `git status` — clean tree (no untracked junk).
2. `git pull` on `dev`.
3. `git checkout -b feature/sX-<short-name>` (one branch per session).
4. `/clear` to drop prior context.
5. Switch model via the row's `/model` command.
6. Paste kickoff prompt.

## Standard post-flight

1. Commit (type-scoped, single logical change).
2. Open PR (`gh pr create`).
3. Mark this session ✅ in the table above.
4. Update `docs/superpowers/roadmap/2026-04-19-master-roadmap.md` if dependencies shifted.
5. Optional: `/cost` to log token spend.

---

## When to deviate from the model recommendation

Bump **up** to Opus when:
- Mid-session you hit unexpected architectural ambiguity.
- Bugs trace to subtle async/concurrency issues.
- You need a senior code-review pass.

Bump **down** to Haiku when:
- Remaining work is purely string updates / formatting / file moves.
- Repetitive scaffolding from a known template.

Switch via `/model` mid-session — Claude continues with new model, keeps context.

---

## Failure recovery

If a session fails halfway:
- Don't merge. Branch stays open.
- Edit the row's status to ⏸ blocked + add a note column at the bottom of this file describing what blocked.
- Resume next time after fixing the blocker. Do not skip ahead.
