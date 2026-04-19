---
description: Install and bootstrap claude-obsidian integration in Creator Zone. Creates vault, ingests existing docs, enables knowledge graph queries.
---

# /setup-obsidian

Automated setup of [claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) for this project.

## Goal

Install plugin, create vault inside worktree, bootstrap wiki structure, ingest existing project docs so `what do you know about X?` queries return synthesized answers with citations.

## Context

Creator Zone is a monorepo (FastAPI backend + Expo frontend + Telegram bot). It already has extensive docs in `docs/`, `.claude/rules/`, `CLAUDE.md`, and superpowers plans/specs that should become the initial knowledge base.

Reference: `docs/OBSIDIAN_GUIDE.md` (human-readable guide with rationale and options).

## Steps

Execute sequentially. Stop and report if any step fails — do not continue past a broken step.

### Step 1 — Verify prerequisites

Run in parallel:

```bash
claude --version
git --version
where obsidian || echo "Obsidian not found"
```

Report each result. If Obsidian missing on Windows, instruct user to run:
```powershell
winget install Obsidian.Obsidian
```
Wait for confirmation before continuing.

### Step 2 — Install claude-obsidian plugin

```bash
claude plugin marketplace add AgriciDaniel/claude-obsidian
claude plugin install claude-obsidian@claude-obsidian-marketplace
```

Verify with:
```bash
claude plugin list | grep claude-obsidian
```

### Step 3 — Create vault folder

```bash
mkdir -p obsidian-vault
```

Directory is at repo root. Do not nest under `docs/` — Obsidian vault is self-contained.

### Step 4 — Update .gitignore

Append (only if not already present):
```
# Obsidian vault — ignore session state, keep wiki pages
obsidian-vault/.obsidian/workspace*
obsidian-vault/wiki/hot.md
obsidian-vault/wiki/log.md
obsidian-vault/.trash/
```

Read current `.gitignore` first, check for duplicates, append only missing lines.

### Step 5 — Bootstrap vault via /wiki command

Instruct user: open Obsidian, *Manage Vaults → Open folder as vault*, select the newly created `obsidian-vault/` folder. Return when done.

Then in the Claude Code session, invoke:
```
/wiki
```

This scaffolds `wiki/index.md`, `wiki/hot.md`, `wiki/log.md`, `.obsidian/snippets/vault-colors.css`, and updates `CLAUDE.md` with wiki references.

### Step 6 — Offer Local REST API setup

Ask user: do you want Local REST API plugin for direct MCP access? (Recommended for Windows.)

If yes, instruct:
1. Obsidian → *Settings → Community plugins → Turn on community plugins*
2. *Browse → search "Local REST API" → Install → Enable*
3. Copy API key from *Settings → Local REST API*
4. Report key location so we can wire MCP config

If no, continue with filesystem-based mode.

### Step 7 — Batch ingest existing docs

Ingest project docs in order (most foundational first):

```
ingest CLAUDE.md
ingest .claude/rules/api-conventions.md
ingest .claude/rules/code-style.md
ingest .claude/rules/testing.md
ingest docs/PHASE_PLAN.md
ingest docs/TOOLS_UPDATE.md
ingest docs/USAGE-BEST-PRACTICES.md
ingest docs/GIT-WORKFLOW.md
ingest docs/BUILD-APK-LOCALE.md
ingest docs/telegram-backend-integration.md
ingest docs/deployment/home-server.md
ingest docs/superpowers/plans/2026-04-04-security-production-hardening.md
ingest docs/superpowers/plans/2026-04-07-local-llm-fresh-setup.md
ingest docs/superpowers/plans/2026-04-08-avatar-profile.md
ingest docs/superpowers/specs/2026-04-04-security-production-hardening-design.md
ingest docs/superpowers/specs/2026-04-07-local-llm-setup-design.md
ingest docs/superpowers/specs/2026-04-08-avatar-profile-design.md
ingest README.md
ingest CONTRIBUTING.md
ingest CHANGELOG.md
```

Each `ingest` generates 8-15 wiki pages. Expect ~150-300 pages total after batch. Run sequentially, not parallel, to avoid index collision.

Report progress after every 5 ingests. If an ingest fails (too large, parse error), skip and continue, log to user.

### Step 8 — Verify wiki health

```
lint the wiki
```

Expected output: list of orphans, dead links, missing connections. Report summary to user.

### Step 9 — Test queries

Run 3 test queries to validate knowledge extraction:

```
what do you know about auth flow?
what do you know about Quick Tools?
what's the status of the security hardening plan?
```

Report which queries return cited answers vs empty. Empty result = ingest gap → flag for user.

### Step 10 — Persist hot cache

```
update hot cache
```

Writes session context to `wiki/hot.md` so next Claude Code session starts warm.

### Step 11 — Final report

Output markdown summary:

```markdown
## Setup complete

- Plugin: installed (version X)
- Vault: obsidian-vault/
- Pages ingested: N
- Orphans found: N
- Dead links: N
- Test queries passed: N/3

## Next actions for user

1. Open Obsidian, explore Graph view for visual overview
2. Run `/autoresearch [topic]` for autonomous research
3. Weekly: `lint the wiki` + `update hot cache`
4. See docs/OBSIDIAN_GUIDE.md for full command reference

## Known gaps

[List any docs that failed ingestion or queries that returned empty]
```

## Rules

- Do not modify any file outside `obsidian-vault/`, `.gitignore`, and `CLAUDE.md`
- Do not commit anything. User reviews and commits manually.
- If plugin install fails, report exact error and stop — do not fall back to manual clone
- Italian user: status messages OK in English (tech), but final report summary in Italian if user preference unclear
- Ingest is synchronous — never parallelize to avoid index race

## Troubleshooting escalation

| Symptom | Action |
|---------|--------|
| `claude plugin marketplace add` fails | Check `claude --version`, need recent CLI |
| `/wiki` unknown | Plugin not installed, re-run Step 2 |
| Ingest timeout | Split target file, retry per chunk |
| Graph empty in Obsidian | No pages, verify Step 7 completed |
| MCP "Local REST API" connection refused | Port 27124 blocked or plugin disabled |

Report all escalations to user with exact error strings.
