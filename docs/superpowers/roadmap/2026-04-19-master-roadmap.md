# Master Roadmap — Creator Zone Evolution 2026 Q2

**Date:** 2026-04-19
**Owner:** leleermeggio@gmail.com
**Status:** Active — replaces ad-hoc planning
**Companion docs:** [`SESSION_GUIDE.md`](../../SESSION_GUIDE.md) (which session to run next + which model to use)

---

## Goal

Evolve Creator Zone from a tool-collection app into a true AI co-pilot for content creators. Three parallel programs:

1. **Spec 1 — Smart Agents** — make the agent engine actually intelligent (branching, retry, approval gates, memory).
2. **Spec 2 — Creator Capabilities** — close the end-to-end loop: brand kit, publishing, scheduling, batch, A/B, voice clone.
3. **Spec 3 — UX & Flow** — fix friction (onboarding, next-action, project workspace, search, push, mobile).

Filoni execute **one at a time** to keep cognitive load low. Spec 1 first because every other improvement compounds on a working agent engine.

---

## Sub-projects (one design spec each)

| # | Spec | File | Status |
|---|------|------|--------|
| 1 | Smart Agents | `specs/2026-04-19-agenti-smart-design.md` | Drafted at S0 |
| 2 | Creator Capabilities | `specs/<date>-creator-capabilities-design.md` | Written at S5 |
| 3 | UX & Flow | `specs/<date>-ux-flow-design.md` | Written at S11 |

Each spec produces its own implementation plan in `plans/`. Each plan splits into sessions S1..Sn (see SESSION_GUIDE).

---

## Session map (16 sessions)

| Session | Filone | Output | Model |
|---------|--------|--------|-------|
| **S0** Bootstrap | Meta | Vault Obsidian + roadmap + SESSION_GUIDE + Spec 1 design + Spec 1 plan | Opus 4.7 |
| **S1** Agent engine | 1 | Branching/retry/resume in `step_executor` + tests | Opus 4.7 |
| **S2** Approval gates | 1 | COPILOTA pause-on-step UI + preview output FE/BE | Sonnet 4.6 |
| **S3** AI generator v2 | 1 | Preview pre-save, smart defaults, "agent suggest" from media | Sonnet 4.6 |
| **S4** Agent memory | 1 | Per-user prefs (caption style, thumb style) | Sonnet 4.6 |
| **S5** Spec 2 kickoff | Meta | Spec 2 design + plan | Opus 4.7 |
| **S6** Brand kit + assets | 2 | Brand kit model/routes/FE picker + asset library | Sonnet 4.6 |
| **S7** Publish | 2 | Direct post to TT/YT/IG via connected APIs | Sonnet 4.6 |
| **S8** Calendar + scheduling | 2 | Mission scheduled at date X, worker cron | Sonnet 4.6 |
| **S9** Batch | 2 | Multi-URL → same pipeline | Sonnet 4.6 |
| **S10** A/B + voice clone | 2 | A/B thumbnail w/ CTR tracking, voice profile TTS | Sonnet 4.6 |
| **S11** Spec 3 kickoff | Meta | Spec 3 design + plan | Opus 4.7 |
| **S12** Onboarding | 3 | First-run wizard + home next-action card | Sonnet 4.6 |
| **S13** Project workspace | 3 | Phase board redesign (visual, kanban-ish) | Sonnet 4.6 |
| **S14** Quick capture + search | 3 | Drop URL flow + global search index | Sonnet 4.6 |
| **S15** Push + mobile polish | 3 | Push notifications on job-done + mobile QA | Sonnet 4.6 |
| **S16** Wrap | Meta | Lint Obsidian, update CLAUDE.md, CHANGELOG, sweep | Haiku 4.5 |

**Estimated effort:** 3-6h per session, 60-90h total.

---

## Dependencies

```
S0 ──► S1 ──► S2 ──► S3 ──► S4 ──► S5 ──► S6 ─┐
                                              ├─► S7 ──► S8 ──► S9 ──► S10 ──► S11 ──► S12 ─┐
                                              │                                              ├─► S13 ──► S14 ──► S15 ──► S16
                                              │                                              │
                                          (S6 unlocks S7: publish needs brand kit)
```

Strictly sequential. No parallel sessions on same area to avoid merge hell.

---

## Cross-cutting principles

- **Test-first** for engine work (S1, S6, S8). TDD per `superpowers:test-driven-development`.
- **Schema migrations** added in same session as model changes. Never split.
- **Italian UI strings**, English logs/API errors (per `.claude/rules/code-style.md`).
- **Obsidian sync** at start of every session: `wiki query "<topic>"` to load hot cache.
- **Commit per logical change** with `type(scope): description` (per `code-style.md`).
- **Self-review** before claiming done (per `superpowers:verification-before-completion`).

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Spec 2 publish requires API keys per platform | Document keys in `.env.example` at S6, defer paid ones to user |
| Branching engine breaks existing missions | Migration path + fallback to linear mode (S1 acceptance criteria) |
| Mobile QA slow without device | Use Expo Go on physical device for S15 only, web for S12-S14 |
| Token cost explodes on Opus sessions | SESSION_GUIDE locks model per session; deviate only on explicit user request |
| Obsidian wiki rots during long programme | S16 includes `wiki-lint` mandatory pass |

---

## Definition of Done (whole programme)

- All 16 sessions executed and committed.
- All 3 specs marked `Status: Implemented` in their frontmatter.
- CLAUDE.md updated with new patterns discovered.
- CHANGELOG.md has entries grouped by spec.
- Obsidian wiki contains pages for: each spec, each new feature, each new model.
- No TODO comments left in code (open GitHub issues instead, per project rule).
- Test suite green: `pytest backend/tests/ -x -q` and `cd frontend && npx tsc --noEmit`.

---

## How to use this roadmap

1. Open [`SESSION_GUIDE.md`](../../SESSION_GUIDE.md) to pick the next session.
2. Switch model via `/model <name>` per the guide.
3. Tell Claude: "Run session SX from the master roadmap."
4. Claude reads the relevant spec + plan section, executes, commits.
5. After session, update this roadmap's status column (mark session ✓).

Never skip S0. Never run two filoni in parallel.
