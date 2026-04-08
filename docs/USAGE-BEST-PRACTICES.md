# Claude Code Usage Best Practices

How to minimize token/session consumption while maintaining quality.

## Before Starting

- **Have a clear task** — vague requests cause back-and-forth that burns tokens
- **Reference existing docs** — point Claude to specs/plans instead of re-explaining
- **Use `/compact`** — compresses conversation history, frees context space

## During Work

- **One task per session** — don't mix unrelated tasks (e.g., brainstorming + debugging)
- **Say "go ahead"** — skips Claude asking for confirmation, saves a round-trip
- **Batch requests** — "do X, Y, and Z" instead of three separate messages
- **Avoid re-reads** — if Claude just read a file, don't ask it to read it again
- **Short answers work** — "yes", "A", "go ahead" are perfectly fine responses
- **Skip subagents when possible** — subagents consume tokens independently; use them only for truly parallel/independent work

## Architecture Decisions That Save Tokens Long-Term

- **Keep a spec file updated** — Claude reads the spec instead of you re-explaining the project
- **CLAUDE.md is key** — a good CLAUDE.md means Claude doesn't need to explore the codebase every session
- **Small, focused files** — Claude reads entire files; 200-line files cost less than 1500-line files
- **Use memory** — saves context across sessions so you don't repeat yourself

## What Costs the Most

| Action | Token cost | Alternative |
|--------|-----------|-------------|
| Reading large files (1000+ lines) | High | Read specific line ranges |
| Subagent spawning | High | Do it inline if simple |
| Re-reading files already in context | Wasted | Reference previous read |
| Long explanations when user already understands | Wasted | Be concise |
| Multiple exploration rounds | High | Use Glob/Grep directly |
| Brainstorming + implementation in one session | Very high | Split across sessions |

## Session Planning

For this project (Creator Suite App), recommended session breakdown:
1. **Session: Brainstorm + Spec** (done)
2. **Session: Phase 0 implementation plan**
3. **Session: Phase 0 build — auth + API skeleton**
4. **Session: Phase 0 build — DB + job queue + storage**
5. **Session: Phase 1 plan**
6. **Session: Phase 1 build** (multiple sessions per feature)

Each session starts with: "Read the spec at `docs/superpowers/specs/2026-03-25-creator-suite-app-design.md` and continue from Phase X."
