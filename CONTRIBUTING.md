# Contributing to Creator Suite

## Branching Strategy — GitHub Flow

We use a simplified **GitHub Flow**:

| Branch | Purpose |
|--------|---------|
| `main` | Always production-ready. Direct pushes are **forbidden**. |
| `feature/<short-name>` | New features (e.g. `feature/thumbnail-editor`) |
| `fix/<short-name>` | Bug fixes (e.g. `fix/login-crash`) |
| `hotfix/<short-name>` | Urgent production fixes (e.g. `hotfix/auth-token-expiry`) |
| `chore/<short-name>` | Maintenance, deps, tooling (e.g. `chore/update-deps`) |
| `docs/<short-name>` | Documentation only (e.g. `docs/api-reference`) |

### Rules

1. **Never commit directly to `main`.**
2. Always branch off the latest `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/your-feature-name
   ```
3. Keep branches **short-lived** — merge within a few days max.
4. Delete branches after merging.
5. Open a Pull Request to merge into `main`. At least one review is recommended.

---

## Commit Message Convention — Simple Prefix

Format:
```
[TYPE] Short description (max 72 chars)

Optional longer body explaining WHY, not what.
```

### Allowed types

| Prefix | When to use |
|--------|------------|
| `[FEAT]` | New feature or capability |
| `[FIX]` | Bug fix |
| `[HOTFIX]` | Urgent production fix |
| `[REFACTOR]` | Code restructure, no behaviour change |
| `[STYLE]` | Formatting, whitespace, naming |
| `[TEST]` | Adding or updating tests |
| `[DOCS]` | Documentation only |
| `[CHORE]` | Build, deps, tooling, CI |
| `[REVERT]` | Reverts a previous commit |

### Examples

```
[FEAT] Add thumbnail generation via Pollinations backend

[FIX] Resolve CORS error on LAN access from remote clients

[CHORE] Update Python dependencies to latest compatible versions

[DOCS] Add quickstart section to README
```

### Rules

- Use **imperative mood**: "Add", "Fix", "Remove" — not "Added", "Fixed", "Removed".
- Keep the subject line under **72 characters**.
- Reference issue numbers when applicable: `[FIX] Resolve login crash (#42)`
- Do **not** commit secrets, `.env` files, or generated build artifacts.

---

## Pull Request Checklist

Before opening a PR:

- [ ] Branch is up to date with `main`
- [ ] Code runs locally without errors
- [ ] No secrets or `.env` files included
- [ ] Commit messages follow the convention above
- [ ] PR title follows the same prefix format (e.g. `[FEAT] Add export presets`)

---

## Local Setup

See [README.md](README.md) for full setup instructions.

Quick start on Windows (host machine):
```powershell
.\start.ps1
```
