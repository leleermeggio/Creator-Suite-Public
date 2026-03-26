# Project Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CazZone from a tool launcher into a project-based creator workspace with guided phases, AI project setup, and AI image generation.

**Architecture:** Expo Router tab-based navigation with 4 tabs. Local-first storage via AsyncStorage (per-project keys) and Expo FileSystem. Tools run client-side: 4 working in v1 (translate, summarize, ocr, ai-image), 5 deferred with "coming soon" state. Pollinations.ai for free AI image generation, Gemini for AI features.

**Tech Stack:** Expo SDK 55, expo-router, React Native, TypeScript, AsyncStorage, expo-file-system, expo-document-picker, expo-image-picker, Pollinations.ai, Gemini 2.0 Flash REST API

**Spec:** `docs/superpowers/specs/2026-03-26-project-workflow-design.md`

---

## File Structure

### New Files to Create

```
constants/
  templates.ts                    # Built-in project templates (YouTuber, Podcaster, etc.)
  phases.ts                       # Phase color palette, helper to assign colors

types/
  index.ts                        # All TypeScript interfaces (Project, Phase, ProjectFile, Job, etc.)

services/
  storage.ts                      # AsyncStorage CRUD for projects, jobs, settings
  file-system.ts                  # Expo FileSystem helpers (save, delete, get project dir)
  gemini.ts                       # Gemini API client (summarize, ocr, translate, AI setup)
  pollinations.ts                 # Pollinations.ai image generation client
  translate.ts                    # Translation service (Gemini + MyMemory fallback)
  tools.ts                        # Tool execution orchestrator (dispatch to correct service)
  jobs.ts                         # Job queue management (create, update, prune)

hooks/
  useProjects.ts                  # React hook for project CRUD operations
  useProject.ts                   # React hook for single project state + phase management
  useJobs.ts                      # React hook for job queue
  useSettings.ts                  # React hook for app settings (API keys, preferences)

app/
  _layout.tsx                     # UPDATE: wrap with providers, keep font loading
  (tabs)/
    _layout.tsx                   # NEW: Tab navigator layout
    index.tsx                     # NEW: Projects list (home)
    quick-tools.tsx               # NEW: 9-tool grid (moved from old index.tsx)
    activity.tsx                  # NEW: Job queue
    settings.tsx                  # NEW: Settings (adapted from old settings.tsx)
  project/
    [id].tsx                      # NEW: Project workspace with tab phases
  new-project/
    index.tsx                     # NEW: Template picker
    ai-setup.tsx                  # NEW: AI chat setup
    customize.tsx                 # NEW: Phase editor
  tool/
    [id].tsx                      # UPDATE: Add project context, tool execution, save results

components/
  ProjectCard.tsx                 # Project card for list view
  PhaseTabBar.tsx                 # Horizontal swipeable phase tabs
  PhaseContent.tsx                # Phase content: files, suggested tool, all tools
  FileRow.tsx                     # Single file row in phase
  ToolPill.tsx                    # Small tool button pill
  SuggestedToolCTA.tsx            # Prominent "next step" card
  EmptyState.tsx                  # Reusable empty state component
  ComingSoonTool.tsx              # "Coming soon" overlay for deferred tools
  ImageGeneratorUI.tsx            # AI image generation modes, preview, batch
```

### Files to Delete
```
app/index.tsx                     # Replaced by (tabs)/index.tsx
app/settings.tsx                  # Replaced by (tabs)/settings.tsx
App.tsx                           # Legacy, already unused
```

---

## Task 1: Types & Constants Foundation

**Files:**
- Create: `types/index.ts`
- Create: `constants/templates.ts`
- Create: `constants/phases.ts`
- Modify: `constants/tools.ts` — add `ai-image` tool entry

- [x] **Step 1: Create types file**

Create `types/index.ts` with all interfaces from the spec: `Project`, `Phase`, `ProjectFile`, `PhaseTemplate`, `Template`, `Job`, `ProjectIndexEntry`, `AppSettings`.

```typescript
// types/index.ts
export interface ProjectFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  phaseId: string;
  source: 'uploaded' | 'tool-output';
  sourceToolId?: string;
  localUri: string;
  createdAt: string;
}

export interface Phase {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  suggestedToolIds: string[];
  files: ProjectFile[];
  status: 'pending' | 'active' | 'completed';
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  phases: Phase[];
  currentPhaseIndex: number;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  updatedAt: string;
  templateIcon?: string;
  phaseCount: number;
  currentPhaseIndex: number;
}

export interface PhaseTemplate {
  name: string;
  icon: string;
  color: string;
  order: number;
  suggestedToolIds: string[];
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  creatorType: string;
  defaultPhases: PhaseTemplate[];
  builtIn: boolean;
}

export interface Job {
  id: string;
  toolId: string;
  projectId?: string;
  phaseId?: string;
  status: 'running' | 'completed' | 'failed';
  inputSummary: string;
  outputFileId?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AppSettings {
  googleApiKey?: string;
  geminiModel: string;
  notifications: boolean;
  autoProcess: boolean;
  highQuality: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiModel: 'gemini-2.0-flash',
  notifications: true,
  autoProcess: false,
  highQuality: true,
};
```

- [x] **Step 2: Create phase color palette**

Create `constants/phases.ts`:

```typescript
export const PHASE_COLORS = [
  '#FF6B35', // Orange
  '#FF2D78', // Pink
  '#8B5CF6', // Violet
  '#ADFF2F', // Lime
  '#00F5FF', // Cyan
  '#FFE633', // Yellow
] as const;

export function getPhaseColor(index: number): string {
  return PHASE_COLORS[index % PHASE_COLORS.length];
}
```

- [x] **Step 3: Create templates**

Create `constants/templates.ts` with the 3 built-in templates (YouTuber, Podcaster, Content Creator) using exact phase definitions from the spec.

- [x] **Step 4: Add ai-image tool to tools.ts**

Add to the `TOOLS` array in `constants/tools.ts`:

```typescript
{
  id: 'ai-image',
  name: 'Genera Immagini AI',
  description: 'Thumbnail, loghi e copertine con AI',
  icon: '🎨',
  gradient: ['#FF00E5', '#FFE633'],
  accentColor: '#FF00E5',
}
```

Also add an `available` boolean field to the `Tool` interface and mark each tool: `translate`, `summarize`, `ocr`, `ai-image` as `available: true`, rest as `available: false`.

- [x] **Step 5: Verify build**

Run: `cd /c/Users/parti/caz-zone-app && npx tsc --noEmit`

---

## Task 2: Storage & Service Layer

**Files:**
- Create: `services/storage.ts`
- Create: `services/file-system.ts`
- Create: `services/jobs.ts`

- [x] **Step 1: Install packages first**

Run: `cd /c/Users/parti/caz-zone-app && npx expo install @react-native-async-storage/async-storage expo-file-system expo-document-picker expo-image-picker`

- [x] **Step 2: Verify tsconfig path aliases**

Check that `tsconfig.json` has `baseUrl: "."` and `paths: { "@/*": ["./*"] }` configured. These are needed for `@/types`, `@/services`, `@/hooks` imports.

- [x] **Step 3: Create storage service**

`services/storage.ts` — AsyncStorage CRUD for projects with per-project keys and project index:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Project, ProjectIndexEntry, AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

const KEYS = {
  projectIndex: 'project_index',
  project: (id: string) => `project:${id}`,
  settings: 'settings',
  jobs: 'jobs',
};

// Project CRUD
export async function getProjectIndex(): Promise<ProjectIndexEntry[]> { ... }
export async function getProject(id: string): Promise<Project | null> { ... }
export async function saveProject(project: Project): Promise<void> { ... }
export async function deleteProject(id: string): Promise<void> { ... }

// updateProjectIndex derives templateIcon, phaseCount, currentPhaseIndex from full Project
export async function updateProjectIndex(project: Project): Promise<void> {
  const index = await getProjectIndex();
  const entry: ProjectIndexEntry = {
    id: project.id,
    name: project.name,
    status: project.status,
    updatedAt: project.updatedAt,
    templateIcon: project.phases[0]?.icon,
    phaseCount: project.phases.length,
    currentPhaseIndex: project.currentPhaseIndex,
  };
  // upsert into index...
}

// Settings
export async function getSettings(): Promise<AppSettings> { ... }
export async function saveSettings(settings: AppSettings): Promise<void> { ... }
```

- [x] **Step 4: Install async-storage** (already done in Step 1, skip)

- [x] **Step 5: Create file-system service**

`services/file-system.ts` — helpers for project file directories:

```typescript
import * as FileSystem from 'expo-file-system';

export function getProjectDir(projectId: string): string { ... }
export function getPhaseDir(projectId: string, phaseId: string): string { ... }
export async function ensureProjectDirs(projectId: string, phaseIds: string[]): Promise<void> { ... }
export async function saveFileToPhase(projectId: string, phaseId: string, sourceUri: string, filename: string): Promise<string> { ... }
export async function deleteProjectFiles(projectId: string): Promise<void> { ... }
export async function deletePhaseFile(localUri: string): Promise<void> { ... }
```

- [x] **Step 6: Create jobs service**

`services/jobs.ts` — job queue with 100-entry cap:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Job } from '@/types';

const MAX_JOBS = 100;

export async function getJobs(): Promise<Job[]> { ... }
export async function addJob(job: Omit<Job, 'id' | 'startedAt'>): Promise<Job> { ... }
export async function updateJob(id: string, updates: Partial<Job>): Promise<void> { ... }
export async function pruneJobs(): Promise<void> { ... }
```

- [x] **Step 7: Verify build**

Run: `cd /c/Users/parti/caz-zone-app && npx tsc --noEmit`

---

## Task 3: React Hooks

**Files:**
- Create: `hooks/useProjects.ts`
- Create: `hooks/useProject.ts`
- Create: `hooks/useJobs.ts`
- Create: `hooks/useSettings.ts`

- [x] **Step 1: Create useSettings hook**

```typescript
// hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '@/services/storage';
import type { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() { ... }
  async function update(partial: Partial<AppSettings>) { ... }

  return { settings, loading, update };
}
```

- [x] **Step 2: Create useProjects hook**

Provides project list, create, delete, archive operations. Loads from `project_index` for the list.

- [x] **Step 3: Create useProject hook**

Takes project `id`, loads full project. Provides: `advancePhase()`, `completePhase()`, `addFileToPhase()`, `linkFileToNextPhase()`, `deleteFile()`, `updateProject()`.

- [x] **Step 4: Create useJobs hook**

Loads job list, provides `createJob()`, `completeJob()`, `failJob()`.

- [x] **Step 5: Verify build**

Run: `cd /c/Users/parti/caz-zone-app && npx tsc --noEmit`

---

## Task 4: API Services (Gemini, Pollinations, Translate)

**Files:**
- Create: `services/gemini.ts`
- Create: `services/pollinations.ts`
- Create: `services/translate.ts`
- Create: `services/tools.ts`

- [x] **Step 1: Create Gemini service**

`services/gemini.ts` — handles summarize, OCR, AI project setup:

```typescript
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function geminiGenerateContent(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  imageBase64?: string
): Promise<string> { ... }

export async function summarizeText(apiKey: string, model: string, text: string): Promise<string> { ... }
export async function ocrImage(apiKey: string, model: string, imageBase64: string): Promise<string> { ... }
export async function generateProjectFromDescription(apiKey: string, model: string, description: string): Promise<{
  projectName: string;
  description: string;
  phases: Array<{ name: string; icon: string; suggestedToolIds: string[] }>;
}> { ... }
```

- [x] **Step 2: Create Pollinations service**

`services/pollinations.ts`:

```typescript
const STYLE_PREFIXES = {
  thumbnail: 'YouTube thumbnail style, bold text, expressive, high contrast, ',
  logo: 'minimalist logo design, clean vector style, centered, ',
  'social-cover': 'social media cover image, vibrant, eye-catching, ',
};

const SOCIAL_FORMATS = {
  youtube: { width: 1280, height: 720, label: 'YouTube' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok' },
  instagram_post: { width: 1080, height: 1080, label: 'Instagram Post' },
  instagram_story: { width: 1080, height: 1920, label: 'Instagram Story' },
};

export function buildImageUrl(prompt: string, mode: string, width: number, height: number): string { ... }
export async function generateImage(prompt: string, mode: string, width: number, height: number): Promise<string> { ... }
export async function generateAllSocialFormats(prompt: string, onProgress: (current: number, total: number, label: string) => void): Promise<Map<string, string | null>> { ... }
```

- [x] **Step 3: Create translate service**

`services/translate.ts` with Gemini-first, MyMemory fallback:

```typescript
export async function translateText(text: string, targetLang: string, apiKey?: string, model?: string): Promise<string> { ... }
```

- [x] **Step 4: Create tool orchestrator**

`services/tools.ts` — dispatches to correct service based on tool ID, creates Job entries:

```typescript
export async function executeTool(toolId: string, input: any, settings: AppSettings): Promise<{ result: string; outputUri?: string }> { ... }
export function isToolAvailable(toolId: string): boolean { ... }
```

- [x] **Step 5: Verify build**

Run: `cd /c/Users/parti/caz-zone-app && npx tsc --noEmit`

---

## Task 5: Tab Navigation Restructure

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx` (projects list)
- Create: `app/(tabs)/quick-tools.tsx`
- Create: `app/(tabs)/activity.tsx`
- Create: `app/(tabs)/settings.tsx`
- Modify: `app/_layout.tsx`
- Delete: old `app/index.tsx`, `app/settings.tsx`

- [x] **Step 1: Create tab layout**

`app/(tabs)/_layout.tsx` — bottom tab bar with 4 tabs, cosmic neon styling:

```typescript
import { Tabs } from 'expo-router';
// Tab bar with: Progetti, Quick Tools, Attività, Settings
// Custom tab bar styling matching cosmic neon theme
// Each tab: icon + label, active state with neon accent
```

- [x] **Step 2: Move settings to tabs**

Copy and adapt existing `app/settings.tsx` to `app/(tabs)/settings.tsx`. Add API key input field for `GOOGLE_API_KEY`, Gemini model selector.

- [x] **Step 3: Create Quick Tools tab**

`app/(tabs)/quick-tools.tsx` — move the existing tool grid from old `app/index.tsx`. This is the 9-tool grid for standalone use. Uses the existing `ToolCard` component.

- [x] **Step 4: Create Activity tab**

`app/(tabs)/activity.tsx` — job queue list with empty state. Uses `useJobs` hook. Groups: "In corso" (running) at top and "Recenti" (completed/failed) below. Each job card shows: tool icon, input summary, project name (if any), status, timestamp. Tapping a completed job navigates to `/project/[projectId]` with the relevant phase (if `projectId` and `phaseId` exist on the job).

- [x] **Step 5: Create Projects tab (home)**

`app/(tabs)/index.tsx` — project list with FAB "+ Nuovo Progetto" button. Empty state when no projects. Uses `useProjects` hook. Each project shows as a `ProjectCard`.

- [x] **Step 6: Update root layout**

Modify `app/_layout.tsx`: keep font loading, add Stack wrapping the tabs + project/tool screens.

- [x] **Step 7: Delete old files**

Remove `app/index.tsx` (replaced by `app/(tabs)/index.tsx`), `app/settings.tsx` (replaced by `app/(tabs)/settings.tsx`), and `App.tsx` (legacy, unused).

- [x] **Step 8: Verify web build**

Run: `cd /c/Users/parti/caz-zone-app && npx expo export --platform web`

---

## Task 6: Reusable Components

**Files:**
- Create: `components/ProjectCard.tsx`
- Create: `components/PhaseTabBar.tsx`
- Create: `components/PhaseContent.tsx`
- Create: `components/FileRow.tsx`
- Create: `components/ToolPill.tsx`
- Create: `components/SuggestedToolCTA.tsx`
- Create: `components/EmptyState.tsx`
- Create: `components/ComingSoonTool.tsx`

- [x] **Step 1: Create EmptyState component**

Reusable: takes `icon`, `title`, `subtitle`, optional `ctaLabel` + `onCta`. Matches cosmic neon theme.

- [x] **Step 2: Create ProjectCard component**

Shows project name, template icon, phase progress bar (colored segments), status badge, updated time. `onPress` and `onLongPress` (for delete/archive menu).

- [x] **Step 3: Create PhaseTabBar component**

Horizontal scrollable tabs. Each tab: icon + name. Active tab has colored background matching phase color. Completed tabs show small ✅. Pending tabs dimmed.

- [x] **Step 4: Create FileRow component**

File entry: icon based on mimeType, filename, size, source badge ("Caricato" / tool name). Swipe-left for delete on native, three-dot menu on web.

- [x] **Step 5: Create ToolPill and SuggestedToolCTA**

`ToolPill`: small gradient pill with tool icon + name. `onPress`.
`SuggestedToolCTA`: large gradient card with tool icon, "Prossimo passo: {tool name}", description. `onPress`.

- [x] **Step 6: Create ComingSoonTool component**

Overlay for deferred tools: tool icon (large, dimmed), "Disponibile prossimamente", "Usa il bot Telegram @CazZoneBot".

- [x] **Step 7: Create PhaseContent component**

`components/PhaseContent.tsx`: The main content area of a phase tab. Takes `phase`, `project`, `onToolPress`, `onUpload`, `onCompletePhase`. Renders:
- File list using `FileRow` (with long-press "Sposta a..." for moving files between phases)
- `SuggestedToolCTA` for the first suggested tool
- Grid of `ToolPill`s (suggested first, then expandable "+ Tutti")
- "+ Aggiungi file" upload button
- "Completa fase" / "Fase successiva" button at bottom
- Empty state when no files

- [x] **Step 8: Verify build**

Run: `cd /c/Users/parti/caz-zone-app && npx expo export --platform web`

---

## Task 7: Project Creation Flow

**Files:**
- Create: `app/new-project/index.tsx` (template picker)
- Create: `app/new-project/ai-setup.tsx` (AI chat setup)
- Create: `app/new-project/customize.tsx` (phase editor)

- [x] **Step 1: Create template picker screen**

`app/new-project/index.tsx`: Shows 4 template cards (YouTuber, Podcaster, Content Creator, Personalizzato) + "Descrivi con AI" button at top. Tapping a template → navigates to customize screen with pre-filled phases. Tapping AI → navigates to ai-setup screen.

- [x] **Step 2: Create AI setup screen**

`app/new-project/ai-setup.tsx`: Text input for natural language description, "Genera" button. Calls `generateProjectFromDescription()`. Shows loading state. On success, shows generated phases with edit option. "Crea progetto" or "Modifica fasi" buttons. Fallback if no API key: toast + redirect to customize.

- [x] **Step 3: Create phase editor (customize) screen**

`app/new-project/customize.tsx`: Receives pre-filled phases (from template or AI) OR starts with one empty phase slot (if "Personalizzato" selected).

Project name input at top. Phase list with:
- Name input, emoji picker (grid of 20-30 common emojis), color picker (6 neon colors)
- "+ Strumenti" button per phase → opens bottom sheet with checkbox list of all 9 tools to pick suggested tools
- "+ Aggiungi fase" button
- Up/down arrows to reorder phases (simpler than drag in v1)
- X button to delete phase (confirmation if phase was pre-filled: "Questa fase contiene strumenti suggeriti. Eliminare?")

"Personalizzato" path: arrives with 1 empty phase slot, no pre-filled tools.
Template path: arrives with pre-filled phases, user can edit/add/remove.
AI path: arrives with AI-generated phases, user can edit/add/remove.

Review section at bottom: shows the full pipeline visually (phase icons + arrows, like the brainstorm mockup).
"Crea progetto" button. On create: calls `useProjects().createProject()`, navigates to `project/[id]`.

- [x] **Step 4: Verify flow end-to-end**

Run web build, navigate: Projects tab → + Nuovo → pick template → customize → create → lands in project workspace.

---

## Task 8: Project Workspace Screen

**Files:**
- Create: `app/project/[id].tsx`

- [x] **Step 1: Build project workspace**

`app/project/[id].tsx`: Loads project via `useProject(id)`. Shows:
1. Header: back button, project name, progress "Fase 2 di 4"
2. `PhaseTabBar` with project phases
3. `PhaseContent` for selected phase:
   - File list (using `FileRow`)
   - `SuggestedToolCTA` (first suggested tool for this phase)
   - Tool pills grid (suggested first, then "+ Tutti" expandable)
   - "+ Aggiungi file" upload button
   - "Completa fase" / "Avanza" button

- [x] **Step 2: Implement file upload**

In phase content, "+ Aggiungi file" triggers:
- Native: `expo-document-picker` for documents/video/audio. `expo-image-picker` for camera roll photos (show action sheet: "Documento" or "Foto").
- Web: hidden `<input type="file">` click. Also add drag-and-drop support on the upload zone (`onDragOver`/`onDrop` handlers, web only).
- Validate file size: if > 500 MB, show warning alert "File molto grande. L'app potrebbe rallentare. Continuare?"
File copied to project directory via `file-system.ts`, `ProjectFile` added to phase.

- [x] **Step 3: Implement phase navigation**

Tapping a phase tab switches view. "Completa fase" marks current phase done, activates next, advances `currentPhaseIndex`. Back navigation to completed phases works.

- [x] **Step 4: Implement tool launch from workspace**

Tapping a tool pill or `SuggestedToolCTA` navigates to `/tool/[id]?projectId=X&phaseId=Y`. Tool screen receives project context.

- [x] **Step 5: Implement "link file to next phase"**

After tool output saved, show toast/bottom sheet: "Inviare a {next phase name}?" → creates linked `ProjectFile` in next phase with same `localUri`.

- [x] **Step 6: Implement "move file between phases"**

Long-press on `FileRow` → show action sheet with all phase names. Selecting a phase creates a new `ProjectFile` in the target phase with same `localUri` and removes it from the current phase. Uses `useProject().moveFile(fileId, targetPhaseId)`.

- [x] **Step 7: Verify workspace flow**

Run web build, create project, navigate phases, upload a file, see it in phase.

---

## Task 9: Tool Execution Screen Update

**Files:**
- Modify: `app/tool/[id].tsx`
- Create: `components/ImageGeneratorUI.tsx`

- [x] **Step 1: Refactor tool screen for project context**

Update `app/tool/[id].tsx` to:
- Read `projectId` and `phaseId` from query params
- Show "coming soon" overlay for unavailable tools (`ComingSoonTool`)
- For available tools: keep existing input UI, add real API execution
- Add "Salva" button that writes result to project phase (if project context exists)
- Create a `Job` entry on execution start, update on completion/failure

- [x] **Step 2: Build ImageGeneratorUI component**

`components/ImageGeneratorUI.tsx`: Mode selector (Thumbnail/Logo/Cover), prompt input, generate button, image preview with Salva/Rigenera/Modifica actions. For Cover mode: "Genera tutti i formati" button with sequential generation (one at a time), progress indicator "Generando 1 di 4... YouTube", 2x2 grid preview of results. Each result has individual retry button if failed. "Salva tutti" button saves all successful images to current phase.

- [x] **Step 3: Wire up translate tool**

Call `translateText()` from `services/translate.ts`. Language picker (reuse LANGUAGES from spec). Show result with copy + save buttons.

- [x] **Step 4: Wire up summarize tool**

Call `summarizeText()` from `services/gemini.ts`. Text input. Show result with copy + save.

- [x] **Step 5: Wire up OCR tool**

Image picker → convert to base64 → call `ocrImage()` from `services/gemini.ts`. Show extracted text with copy + save.

- [x] **Step 6: Wire up AI image tool**

Use `ImageGeneratorUI` component. On save: download image to project phase directory.

- [x] **Step 7: Verify all 4 tools work end-to-end**

Test each: translate text, summarize text, OCR an image, generate an AI image.

---

## Task 10: Polish, Empty States & Destructive Actions

**Files:**
- Modify: `app/(tabs)/index.tsx` — empty state, delete/archive
- Modify: `app/project/[id].tsx` — empty phase state
- Modify: `app/(tabs)/activity.tsx` — empty state
- Modify: various — animations

- [x] **Step 1: Add empty states to all screens**

- Projects list: illustration + "Crea il tuo primo progetto"
- Phase with no files: dashed border + "Aggiungi un file"
- Activity: "Nessuna attività recente"

- [x] **Step 2: Implement delete project**

Long-press on `ProjectCard` → confirmation alert → delete project files + metadata via `useProjects().deleteProject()`.

- [x] **Step 3: Implement archive/unarchive**

Three-dot menu → "Archivia". Archived section at bottom of project list (collapsible). "Ripristina" to unarchive.

- [x] **Step 4: Add entrance animations**

Staggered card entrance on project list, phase content, tool grid. Reuse existing `cardAppear` keyframes for web.

- [x] **Step 5: Verify complete app flow**

Full walkthrough: create project → work through phases → use tools → save results → complete project. Test empty states. Test delete.

---

## Task 11: Web Deploy & APK Build

**Files:**
- Modify: `app.json` — ensure web and android config
- Create: `vercel.json` or `netlify.toml` (if needed)

- [x] **Step 1: Export production web build**

Run: `cd /c/Users/parti/caz-zone-app && npx expo export --platform web`
Verify `dist/` contains working build.

- [x] **Step 2: Deploy to Netlify (free)**

Option A — Netlify Drop: drag `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop)
Option B — CLI: `npm install -g netlify-cli && netlify deploy --dir=dist --prod`

- [x] **Step 3: Build Android APK**

Login to EAS: `eas login`
Build: `eas build --platform android --profile preview`
This builds a free APK in the cloud. Download link provided when done.

- [x] **Step 4: Update showcase.html**

Update the standalone HTML showcase to reflect the new project-based UI.

- [x] **Step 5: Final smoke test**

Open web URL on phone browser — verify responsive. Install APK on Android device — verify navigation, project creation, tool usage.
