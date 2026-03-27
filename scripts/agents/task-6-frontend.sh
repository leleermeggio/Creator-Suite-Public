#!/usr/bin/env bash
# ============================================================
# AGENT: Task 6 — Frontend
# Implements: thumbnailApi.ts, ThumbnailGeneratorUI.tsx,
#             tool/[id].tsx update
# Type: Frontend TypeScript/React Native agent
# Requires: Task 4 complete (API contract defined)
# Run: bash scripts/agents/task-6-frontend.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 6"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior React Native / TypeScript developer (Expo Router, expo-image-picker).
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Frontend) from the plan.
Steps to complete:
  6.1 Create frontend/services/thumbnailApi.ts (full code in plan)
  6.2 Run: cd frontend && npx tsc --noEmit 2>&1 | grep thumbnailApi
      Fix any type errors before continuing.
  6.3 Create frontend/components/ThumbnailGeneratorUI.tsx (full code in plan)
  6.4 Update frontend/app/tool/[id].tsx:
      - Add import for ThumbnailGeneratorUI
      - Replace <ImageGeneratorUI onSave={handleSaveImage} /> with
        <ThumbnailGeneratorUI projectId={projectId} onSave={handleSaveImage} />
        inside the ai-image branch only
  6.5 Run TypeScript check: cd frontend && npx tsc --noEmit
      Fix any errors in the thumbnail files before continuing.
  6.6 Commit

Rules:
- Use named exports only (no default exports for services/components)
- All user-facing strings must be in Italian
- Do NOT add outlineStyle to TextInput if Platform.OS !== 'web' (it causes native issues)
- Use superpowers:executing-plans to track progress
"
