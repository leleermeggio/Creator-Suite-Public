# Creator Zone Wiki: LLM Wiki

Mode: B (GitHub / Repository) + C (Business / Project) + E (Research)
Purpose: Persistent knowledge base for Creator Zone monorepo — modules, flows, decisions, plans, specs, feature research.
Owner: Emanuele
Created: 2026-04-18

## Structure

```
vault/
├── .raw/               # immutable source documents (ingested docs, dumps)
├── wiki/
│   ├── index.md        # master catalog
│   ├── log.md          # chronological operation history
│   ├── hot.md          # hot cache (~500 words recent context)
│   ├── overview.md     # executive summary
│   ├── modules/        # backend, frontend, bot, router modules
│   ├── components/     # reusable components (FE + BE services)
│   ├── flows/          # auth, projects, jobs, tools, tts pipelines
│   ├── decisions/      # ADRs, superpowers plans, specs, rule docs
│   ├── dependencies/   # external deps + version risk
│   ├── entities/       # tech stack members (FastAPI, Expo, Gemini, etc.)
│   ├── concepts/       # patterns (JWT, async job, rate-limit, hybrid storage)
│   ├── sources/        # one page per ingested .raw source
│   ├── comparisons/    # side-by-side (backend Docker vs bare, SQLite vs Postgres)
│   ├── questions/      # filed answers to user queries
│   └── meta/           # dashboards, lint reports, conventions
├── _templates/         # note templates per type
└── CLAUDE.md           # this file
```

## Conventions

- All notes use YAML frontmatter: `type`, `status`, `created`, `updated`, `tags` (minimum)
- Wikilinks use `[[Note Name]]` format: filenames are unique, no paths needed
- `.raw/` contains source documents: never modify them
- `wiki/index.md` is the master catalog: update on every ingest
- `wiki/log.md` is append-only: never edit past entries. New entries at the TOP.
- User-facing language in Creator Zone is Italian — wiki content stays English (technical source of truth)

## Operations

- **Ingest**: drop source in `.raw/`, say `ingest [filename]`
- **Query**: ask any question — Claude reads hot → index → drill down
- **Lint**: say `lint the wiki` for health check
- **Archive**: move cold sources to `.archive/` to keep `.raw/` clean

## Cross-project reference

Project `CLAUDE.md` at repo root should include:

```markdown
## Wiki Knowledge Base
Path: obsidian-vault/
Read wiki/hot.md first, then wiki/index.md if needed.
```
