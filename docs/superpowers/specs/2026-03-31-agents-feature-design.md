# CazZone Agents — Feature Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Full-stack feature — backend + frontend + AI integration

---

## 1. Core Concept

CazZone Agents are reusable, intelligent content workflows that combine existing tools into automated pipelines with AI-powered suggestions.

### Differentiation from ViewCreator.ai
- ViewCreator agents are dumb presets — "route content to platform." They don't transform anything.
- CazZone agents **process and improve** content — transcribe, cut silence, clean audio, generate thumbnails, translate.
- **Control slider** (Regista/Copilota/Autopilota) lets creators choose involvement per-mission and per-step.
- **Insight Cards** — proactive AI suggestions based on actual content analysis.

### Key Entities

| Entity | Description |
|--------|-------------|
| **Agent** | Saved, reusable pipeline definition. Has name, icon, steps, default control mode, target platforms. |
| **Mission** | Running instance of an agent, attached to a project. Has status, current step, results, insight cards. Agent = recipe, Mission = cooking dinner. |
| **Step** | Single tool execution within a mission (e.g., Transcribe, Jumpcut). Has input/output, parameters, status. |
| **Insight Card** | Proactive AI suggestion surfaced during a mission. Can be accepted, dismissed, or saved for later. |

---

## 2. Control Modes

Three modes, switchable anytime via a **fluid slider** during any mission:

### Regista (Director)
- Full control, step-by-step approval
- Reviews each tool result before moving on
- Can tweak parameters at every step
- AI suggests but never acts alone

### Copilota (Copilot) — **DEFAULT**
- Auto-runs safe/non-destructive steps (transcribe, audio cleanup)
- Pauses for creative decisions (thumbnail style, caption tone)
- Shows smart recommendations with reasoning

### Autopilota (Autopilot)
- Runs full pipeline automatically with best-guess defaults + saved preferences
- Final review before publish
- Built for volume creators

---

## 3. AI Analysis (v1 = Option B: Transcript + Audio Metadata)

### v1 — Transcript + Audio
- Gemini reads transcription text → suggests clips, titles, summaries (free tier)
- FFmpeg probe: duration, silence %, bitrate, loudness (free, local)
- One new endpoint: `POST /tools/analyze-media`
- Cost: **$0 for dev and early users** (Gemini free tier: 1500 req/day)

### v2 Roadmap — Full Media Analysis (Option C)
- Audio quality scoring via FFmpeg + librosa (free, local)
- Key frame extraction via FFmpeg scene filter (free, local)
- Scene detection via PySceneDetect (free, open source)
- Frame analysis via Gemini Vision on extracted key frames (free tier)
- Smart thumbnail picking: extract 5-10 key frames → Gemini ranks (free tier)
- Face/emotion detection via MediaPipe (free, local, on-device)
- **Estimated cost per video at scale: ~$0.000375** (Gemini Flash)
- **~2,600 videos/day before hitting free tier limits**

---

## 4. Preset Missions

| Mission | Steps | Target |
|---------|-------|--------|
| **Short Video** | Download/Import → Jumpcut → Captions → Thumbnail → Export | TikTok, Reels, Shorts |
| **Podcast Clip** | Transcribe → AI find highlights → Cut segments → Captions → Export | YouTube, Spotify |
| **Blog da Video** | Transcribe → Summarize → Translate (optional) → Export text | Blog, LinkedIn |
| **Thumbnail Pack** | Analyze content → Generate 3-4 AI thumbnails with different styles | All platforms |
| **Multi-Platform** | 1 video → Export all formats (YouTube + TikTok + IG) + auto-adapt captions | All platforms |
| **Audio Cleanup** | Extract audio → Normalize → Remove noise → Re-attach to video | All platforms |
| **Repurpose** | Long video → AI analyze transcript → suggest 3-5 clips → generate shorts with captions + thumbnails | TikTok, Reels, Shorts |
| **Traduci & Localizza** | Transcribe → Translate captions to N languages → TTS voiceover → Export localized | Multi-lang |
| **Content Refresh** | Import old video URL → re-thumbnail → fresh captions → new AI summary for description | All platforms |

---

## 5. Custom Mission Builder

Two creation paths — creator picks their comfort level:

### AI-Assisted (Option B)
- "Describe what you want" → AI generates the pipeline
- Uses existing Gemini `generateProjectFromDescription()` pattern
- Creator can edit the generated steps

### Manual Editor (Option C)
- Start from preset or blank
- Add/remove/reorder steps from available tools list
- Set parameters per step
- Set conditions (e.g., "only if duration > 60s")

---

## 6. Navigation & Layout

### Desktop/Web — Left Sidebar
- **Platform section:** Dashboard, Agenti (with live badge), Progetti, Strumenti Rapidi, Attività
- **Quick Actions grid:** 4 shortcut buttons to launch common agents
- **Account section:** Profilo, Abbonamento (billing), Impostazioni
- **Theme toggle:** Dark/Light mode at bottom with keyboard shortcut (Ctrl+D)
- **Profile card:** Avatar, name, plan badge
- Sidebar is collapsible via hamburger button

### Mobile — Bottom Tab Bar (4 tabs)
- Progetti · Agenti · Strumenti · Attività
- Settings accessible via header gear icon
- Sidebar available as slide-out drawer

### Theme Support
- **Dark mode** (default): Cosmic neon — #04040A bg, neon cyan/violet/magenta accents, grain overlay, ambient mesh gradients
- **Light mode:** #F4F4F8 bg, muted but recognizable brand colors (cyan → #00B896, violet → #7722DD), no grain, clean shadows

---

## 7. Agents Tab — Main Screen

Sections (top to bottom):

1. **Header:** "Automation Workspace / I tuoi Agenti" + Cronologia + Nuovo Agente buttons
2. **Stats bar:** Totale | Attivi | Completate | Questa Settimana
3. **Missioni in corso:** Active mission cards with progress bar, step dots, live insight card preview
4. **I tuoi agenti:** Grid of saved agents (3 cols desktop, 2 cols mobile) with platform tags + usage count + create card
5. **Inizia subito:** Horizontal scroll of preset agents

---

## 8. Insight Cards System

Insight cards are surfaced during mission execution based on content analysis:

### Types
- **Quality suggestion:** "38% silenzio rilevato — Jumpcut consigliato"
- **Content opportunity:** "La trascrizione menziona 3 argomenti chiave — generare 3 clip?"
- **Visual suggestion:** "Frame ad alto impatto al minuto 2:34 — usarlo come thumbnail?"
- **Cross-platform:** "Questo contenuto funzionerebbe bene come post LinkedIn — riassumere?"

### Behavior
- Appear as inline cards within the active mission view
- Actions: Applica (accept) | Ignora (dismiss) | Dopo (save for later)
- In Copilota mode: shown and waited on for creative decisions
- In Autopilota mode: auto-applied if confidence > threshold, shown in final review
- In Regista mode: shown as suggestions, never auto-applied

---

## 9. Data Models (New)

### Agent
```
id: UUID
user_id: UUID (FK → users)
name: str
icon: str (emoji)
description: str | None
steps: JSON (array of StepDefinition)
default_mode: enum (REGISTA, COPILOTA, AUTOPILOTA)
target_platforms: JSON (array of str)
is_preset: bool
preset_id: str | None
created_at: datetime
updated_at: datetime
```

### Mission
```
id: UUID
agent_id: UUID (FK → agents)
project_id: UUID (FK → projects)
user_id: UUID (FK → users)
status: enum (PENDING, RUNNING, PAUSED, COMPLETED, FAILED)
current_step_index: int
mode: enum (REGISTA, COPILOTA, AUTOPILOTA)
step_results: JSON (array of StepResult)
insights: JSON (array of InsightCard)
started_at: datetime
completed_at: datetime | None
```

### StepDefinition (JSON inside Agent.steps)
```
tool_id: str (matches existing tool IDs)
label: str
parameters: dict (tool-specific defaults)
auto_run: bool (can Copilota auto-execute this?)
required: bool
condition: str | None (e.g., "duration > 60")
```

### StepResult (JSON inside Mission.step_results)
```
step_index: int
status: enum (PENDING, RUNNING, COMPLETED, SKIPPED, FAILED)
job_id: UUID | None (links to existing Job model)
output: dict | None
started_at: datetime | None
completed_at: datetime | None
```

### InsightCard (JSON inside Mission.insights)
```
id: str
type: str (quality, opportunity, visual, cross_platform)
message: str
action_tool: str | None
action_params: dict | None
status: enum (PENDING, ACCEPTED, DISMISSED, SAVED)
confidence: float (0-1)
```

---

## 10. API Endpoints (New)

### Agents CRUD
- `POST /agents/` → 201 (create agent)
- `GET /agents/` → list user's agents + presets
- `GET /agents/{id}` → agent detail
- `PUT /agents/{id}` → update agent
- `DELETE /agents/{id}` → 204

### Agent Creation
- `POST /agents/generate` → AI-generate agent from description (Gemini)
- `GET /agents/presets` → list available preset templates

### Missions
- `POST /missions/` → 201 (start mission from agent, creates/attaches project)
- `GET /missions/{id}` → mission status + steps + insights
- `PUT /missions/{id}/mode` → change control mode mid-mission
- `POST /missions/{id}/steps/{index}/execute` → manually trigger a step (Regista mode)
- `POST /missions/{id}/steps/{index}/skip` → skip a step
- `PUT /missions/{id}/steps/{index}/params` → update step parameters before execution
- `POST /missions/{id}/insights/{insight_id}/accept` → apply an insight
- `POST /missions/{id}/insights/{insight_id}/dismiss` → dismiss
- `POST /missions/{id}/pause` → pause mission
- `POST /missions/{id}/resume` → resume mission
- `GET /missions/` → list user's missions (active + recent)

### Media Analysis
- `POST /tools/analyze-media` → returns transcript summary + audio metadata + insight suggestions

---

## 11. Frontend New Files

### Screens
- `app/(tabs)/agents.tsx` — Agents tab main screen
- `app/agent/[id].tsx` — Agent detail/edit screen
- `app/agent/new.tsx` — Create agent (AI-assisted or manual)
- `app/mission/[id].tsx` — Mission execution screen (the main workspace)

### Components
- `components/AgentCard.tsx` — Agent grid card
- `components/MissionCard.tsx` — Active mission card with progress
- `components/InsightCard.tsx` — Insight suggestion card
- `components/StepTimeline.tsx` — Step dots/progress visualization
- `components/ControlSlider.tsx` — Regista/Copilota/Autopilota slider
- `components/Sidebar.tsx` — Desktop sidebar navigation
- `components/ThemeToggle.tsx` — Dark/light mode switch

### Services
- `services/agentsApi.ts` — Agents CRUD + presets
- `services/missionsApi.ts` — Mission lifecycle + steps + insights

### Hooks
- `hooks/useAgent.ts` — Single agent state
- `hooks/useAgents.ts` — Agent list
- `hooks/useMission.ts` — Mission execution state + polling
- `hooks/useTheme.ts` — Dark/light mode state

### Constants
- Update `constants/theme.ts` — Add light mode palette + theme context
- `constants/agents.ts` — Preset agent definitions
- `constants/platforms.ts` — Platform definitions (TikTok, YouTube, etc.)

---

## 12. Backend New Files

### Models
- `backend/models/agent.py` — Agent + enums
- `backend/models/mission.py` — Mission + enums

### Routes
- `backend/routes/agents.py` — Agents CRUD + presets + AI generation
- `backend/routes/missions.py` — Mission lifecycle

### Services
- `backend/services/agent_service.py` — Agent CRUD logic + preset loading
- `backend/services/mission_service.py` — Mission orchestrator (step execution, mode logic, insight generation)
- `backend/services/media_analysis_service.py` — FFmpeg probe + Gemini transcript analysis → insights

### Migrations
- New Alembic migration for `agents` and `missions` tables

---

## 13. Design Tokens — Theme

### Dark Mode (existing, refined)
```
bg: #04040A
bg-sidebar: #080812
card: #0A0A16
elevated: #10102A
text: #EEEEFF
text-secondary: #7777AA
text-muted: #444466
cyan: #00FFD0
magenta: #FF00AA
violet: #9944FF
```

### Light Mode (new)
```
bg: #F4F4F8
bg-sidebar: #FFFFFF
card: #FFFFFF
elevated: #F0F0F6
text: #111122
text-secondary: #555577
text-muted: #9999AA
cyan: #00B896
magenta: #CC0088
violet: #7722DD
```

### Animations
- Staggered card entrance (fadeSlideUp, 0.1s delay between cards)
- Ambient mesh gradient (slow floating radial gradients)
- Film grain overlay (dark mode only)
- Neon glow on active elements (box-shadow with color)
- Step pulse animation on active step
- Shimmer effect on primary buttons
- Hover lift + border brighten on cards
- Live pulse dot for active missions
- Theme transition: 0.5s ease on all color properties
