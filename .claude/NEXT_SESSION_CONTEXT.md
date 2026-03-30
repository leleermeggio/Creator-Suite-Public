# Next Session — Agents Feature Implementation

**Resume from:** Design spec approved, mockups validated, no code written yet.
**Spec:** `docs/superpowers/specs/2026-03-31-agents-feature-design.md`
**Mockups:** `.superpowers/brainstorm/2464-1774906700/content/agents-sidebar-layout.html` (final polished version with sidebar + dark/light theme)

---

## PROMPT TO PASTE AT SESSION START

```
Resume the Agents feature implementation for CazZone Creator Suite.

Read the approved design spec at `docs/superpowers/specs/2026-03-31-agents-feature-design.md` — it has everything: data models, API endpoints, frontend screens, components, and theme tokens.

The mockup at `.superpowers/brainstorm/2464-1774906700/content/agents-sidebar-layout.html` is the approved UI reference (open it in browser for visual reference).

Execute the implementation plan below using parallel agents to maximize efficiency. Start with Phase 1.
```

---

## IMPLEMENTATION PLAN — 6 Phases

### Phase 1: Backend Foundation (Models + Migration + CRUD)
**Parallel agents:**

| Agent | Task | Files |
|-------|------|-------|
| **Backend Agent 1** | Create Agent + Mission SQLAlchemy models with enums | `backend/models/agent.py`, `backend/models/mission.py`, update `backend/models/__init__.py` |
| **Backend Agent 2** | Create Agents CRUD routes + schemas | `backend/routes/agents.py`, `backend/schemas/agent.py` |
| **Backend Agent 3** | Create Missions routes + schemas | `backend/routes/missions.py`, `backend/schemas/mission.py` |

**After agents complete:** Run Alembic migration, register routers in `main.py`, test endpoints.

**Estimated:** 1 session, ~15 min

---

### Phase 2: Backend Intelligence (Services + Analysis)
**Parallel agents:**

| Agent | Task | Files |
|-------|------|-------|
| **Backend Agent 4** | Agent service (CRUD logic, preset loading, AI generation via Gemini) | `backend/services/agent_service.py` |
| **Backend Agent 5** | Mission orchestrator (step execution, mode logic, job chaining) | `backend/services/mission_service.py` |
| **Backend Agent 6** | Media analysis service (FFmpeg probe + Gemini transcript → insights) | `backend/services/media_analysis_service.py`, `backend/routes/tools.py` (add analyze-media endpoint) |

**After agents complete:** Integration test the full flow: create agent → start mission → execute steps → get insights.

**Estimated:** 1 session, ~20 min

---

### Phase 3: Frontend Foundation (Theme + Navigation + Layout)
**Parallel agents:**

| Agent | Task | Files |
|-------|------|-------|
| **Frontend Agent 1** | Theme system: add light mode palette, ThemeContext, useTheme hook, update all color references | `constants/theme.ts`, `context/ThemeContext.tsx`, `hooks/useTheme.ts` |
| **Frontend Agent 2** | Sidebar component + responsive layout (desktop sidebar / mobile drawer) | `components/Sidebar.tsx`, update `app/(tabs)/_layout.tsx` |
| **Frontend Agent 3** | Tab bar restructure: Progetti · Agenti · Strumenti · Attività. Move Settings to sidebar. | `app/(tabs)/_layout.tsx`, create `app/(tabs)/agents.tsx` stub |

**After agents complete:** Verify navigation works, theme toggle works, sidebar collapses.

**Estimated:** 1 session, ~20 min

---

### Phase 4: Frontend — Agents Tab + Components
**Parallel agents:**

| Agent | Task | Files |
|-------|------|-------|
| **Frontend Agent 4** | Agents tab main screen (stats bar, agent grid, presets scroll, active missions) | `app/(tabs)/agents.tsx` |
| **Frontend Agent 5** | Reusable components: AgentCard, MissionCard, InsightCard, StepTimeline, ControlSlider | `components/Agent*.tsx`, `components/Mission*.tsx`, `components/InsightCard.tsx`, `components/StepTimeline.tsx`, `components/ControlSlider.tsx` |
| **Frontend Agent 6** | API services + hooks: agentsApi, missionsApi, useAgents, useAgent, useMission | `services/agentsApi.ts`, `services/missionsApi.ts`, `hooks/useAgent*.ts`, `hooks/useMission.ts` |

**After agents complete:** Wire up agents tab with real API calls, verify data flows.

**Estimated:** 1 session, ~25 min

---

### Phase 5: Frontend — Mission Execution Screen
**Sequential (complex, interconnected):**

1. Create agent detail/edit screen (`app/agent/[id].tsx`)
2. Create agent builder screen — AI-assisted + manual editor (`app/agent/new.tsx`)
3. Create mission execution screen — the main workspace (`app/mission/[id].tsx`)
   - Step timeline with progress
   - Control slider (Regista/Copilota/Autopilota)
   - Insight cards with accept/dismiss
   - Tool output previews
   - Mode switching mid-mission

**Estimated:** 1-2 sessions, ~30 min

---

### Phase 6: Integration + Polish
**Parallel agents:**

| Agent | Task |
|-------|------|
| **Code Reviewer** | Review all new code against spec + conventions |
| **Security Auditor** | Audit new endpoints (auth, input validation, injection) |
| **Polish Agent** | Animations, transitions, responsive edge cases, loading states |

**After agents complete:** Manual E2E test, fix issues, commit.

**Estimated:** 1 session, ~15 min

---

## CREDIT OPTIMIZATION STRATEGY

### Rules for Maximum Efficiency

1. **Always dispatch 3 parallel agents per phase** — each agent works on independent files, no conflicts
2. **Use `isolation: "worktree"`** for agents that edit overlapping directories — prevents merge conflicts
3. **Use Haiku model for simple CRUD agents** (model, routes, schemas) — saves credits, fast enough
4. **Use Sonnet for complex logic** (mission orchestrator, mission execution screen)
5. **Use Opus only for code review + final integration** — where judgment matters most
6. **Run `/clear` between phases** — reset context, load only what's needed
7. **Never read the full spec into context** — agents should read only the section they need
8. **Commit after each phase** — checkpoint progress, easy to rollback

### Agent Model Assignments

| Agent Task | Model | Why |
|------------|-------|-----|
| SQLAlchemy models | Haiku | Boilerplate, fast |
| Pydantic schemas | Haiku | Boilerplate, fast |
| CRUD routes | Haiku | Standard patterns |
| Agent service | Sonnet | Business logic |
| Mission orchestrator | Sonnet | Complex state machine |
| Media analysis | Sonnet | AI integration logic |
| Theme system | Sonnet | Cross-cutting changes |
| Sidebar component | Sonnet | Complex responsive UI |
| Tab restructure | Haiku | Config change |
| Agents tab screen | Sonnet | Complex UI with animations |
| Components | Sonnet | Design-heavy |
| API services + hooks | Haiku | Standard fetch patterns |
| Mission execution screen | Opus | Most complex screen |
| Code review | Opus | Needs judgment |
| Security audit | Opus | Needs judgment |

### Estimated Total Credits

- **Haiku calls:** ~6 agents × ~5K tokens = 30K tokens (~$0.03)
- **Sonnet calls:** ~7 agents × ~20K tokens = 140K tokens (~$0.60)
- **Opus calls:** ~3 agents × ~30K tokens = 90K tokens (~$1.80)
- **Total estimate: ~$2.50** for the entire feature

---

## PER-SESSION COMMANDS

### Session 1 — Phase 1
```
Read docs/superpowers/specs/2026-03-31-agents-feature-design.md sections 9 and 10 only.
Execute Phase 1: Create backend models (Agent, Mission), schemas, CRUD routes.
Dispatch 3 parallel agents. Use haiku model for all 3.
After completion: run alembic migration, register routers in main.py, test with curl.
```

### Session 2 — Phase 2
```
Read docs/superpowers/specs/2026-03-31-agents-feature-design.md sections 8 and 10 only.
Execute Phase 2: Create agent_service, mission_service, media_analysis_service.
Dispatch 3 parallel agents. Use sonnet model.
After completion: integration test create agent → start mission → execute step.
```

### Session 3 — Phase 3
```
Read docs/superpowers/specs/2026-03-31-agents-feature-design.md sections 6 and 13 only.
Open .superpowers/brainstorm/2464-1774906700/content/agents-sidebar-layout.html as UI reference.
Execute Phase 3: Theme system, sidebar, tab restructure.
Dispatch 3 parallel agents. Use sonnet for theme+sidebar, haiku for tabs.
```

### Session 4 — Phase 4
```
Read docs/superpowers/specs/2026-03-31-agents-feature-design.md sections 7 and 11 only.
Execute Phase 4: Agents tab, components, API services.
Dispatch 3 parallel agents. Use sonnet for screen+components, haiku for services.
```

### Session 5 — Phase 5
```
Read docs/superpowers/specs/2026-03-31-agents-feature-design.md sections 5, 7, 8, 11.
Execute Phase 5: Agent detail, agent builder, mission execution screen.
This is sequential work — use sonnet, opus for mission screen.
```

### Session 6 — Phase 6
```
Run code review, security audit, and polish in parallel.
Use opus for review + security, sonnet for polish.
Then commit everything with: feat(agents): add intelligent agent automation system
```
