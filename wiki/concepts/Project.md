---
title: Project
updated: 2026-04-19
tags: [concept, backend, model]
---

# Project

User-facing workspace that owns [[Mission]]s, media assets and phase progress.

## Model

`backend/models/project.py` → `projects` table. Hybrid storage:
- BE owns `id`, `title`, `status` (`active`/`completed`/`archived`).
- FE AsyncStorage owns the `phases[]` array, keyed by BE project id.

## Frontend

Workspace UI: `frontend/app/project/[id].tsx`. Hooks: `useProjects`, `useProject`. After Spec 3 S13 → kanban-ish phase board.

## Related

- [[Mission]]
- [[Agent]]
