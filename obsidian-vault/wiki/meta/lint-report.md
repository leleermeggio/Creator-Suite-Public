---
type: meta
title: "Wiki Lint Report"
status: active
created: 2026-04-19
updated: 2026-04-19
tags: [lint, meta, health]
---

# Wiki Lint Report — 2026-04-19

## Summary

| Metric | Count |
|--------|-------|
| Total wiki pages | 32 |
| Unique wikilink targets | 48 |
| Broken links (target missing) | 16 |
| Orphan pages (not linked) | 0 |
| Ingested sources | 21 (20 → wiki pages; 1 intentional skip: OBSIDIAN_GUIDE) |

## Broken wikilinks — fix by creating stubs

These pages are referenced but do not yet exist. Create minimal stubs on demand during ingest or next maintenance pass.

### Entities (11)
- [[entities/Caddy]] — referenced by plan-security-hardening
- [[entities/DuckDNS]] — referenced by plan-security-hardening
- [[entities/PostgreSQL]] — referenced by plan-security-hardening
- [[entities/SQLAlchemy]] — referenced by modules/backend
- [[entities/ReactNative]] — referenced by modules/frontend, entities/Expo
- [[entities/Whisper]] — referenced by modules/bot
- [[entities/ffmpeg]] — referenced by modules/bot
- [[entities/python-telegram-bot]] — referenced by modules/bot
- [[entities/Qwen35-35B]] — referenced by plan-local-llm
- [[entities/OpenClaw]] — referenced by plan-local-llm
- [[entities/llama-cpp]] — referenced by plan-local-llm

### Concepts (1)
- [[concepts/hybrid-storage]] — referenced by modules/frontend (BE id + local phases pattern)

### Flows (1)
- [[flows/projects-sync]] — referenced by modules/frontend

### Decisions (1)
- [[decisions/home-server-deployment]] — referenced by plan-security-hardening (use [[sources/home-server-deployment]] for now or create an ADR)

### Meta (2)
- [[meta/conventions]] — placeholder, needs schema + format documentation
- [[CLAUDE]] — vault root (Obsidian resolves via filename; file exists at `obsidian-vault/CLAUDE.md`). No fix needed.

## Orphan pages
None. All 32 pages are reachable from [[index]] or reciprocal links.

## Recommendations

1. **High priority**: create stubs for the 11 entity pages — each just needs name + role + 1-3 wikilinks back. Lowers perceived gap count.
2. **Medium**: write [[concepts/hybrid-storage]] explicitly — it is a meaningful Creator Zone architecture pattern (BE holds IDs, AsyncStorage holds phases).
3. **Low**: split `home-server-deployment` into an ADR if/when the deployment evolves.
4. **Skip**: `[[CLAUDE]]` resolves correctly in Obsidian — no false positive fix needed.
