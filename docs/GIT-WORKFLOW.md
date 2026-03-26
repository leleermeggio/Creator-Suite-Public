# Git Workflow — Creator Suite

This document explains how every team member should work with Git on this project
to avoid CI failures and keep the codebase clean.

---

## 1. First-Time Setup (do this once)

```bash
# Clone the repo
git clone <repo-url>
cd Creator-Suite-Public

# Install pre-commit (auto-checks formatting before every commit)
pip install pre-commit      # or: pipx install pre-commit
pre-commit install
```

> After this, every `git commit` will automatically run **ruff** lint + format checks.
> If your code isn't formatted, the commit will be **blocked** until you fix it.

### Optional: VS Code / Windsurf setup

Install the [Ruff extension](https://marketplace.visualstudio.com/items?itemName=charliermarsh.ruff)
and add this to your workspace settings (`.vscode/settings.json`):

```json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit"
    }
  }
}
```

This formats your code every time you save — you'll never have a CI failure again.

---

## 2. Daily Workflow

### Start a new task

```bash
# Always start from an up-to-date main
git checkout main
git pull origin main

# Create a branch (see naming conventions below)
git checkout -b feature/my-new-feature
```

### Work on your code

Edit files as normal. When you're ready to commit:

```bash
git add -A
git commit -m "[FEAT] Add thumbnail generation endpoint"
```

If pre-commit blocks you with formatting errors:

```bash
# Auto-fix everything
ruff check --fix backend/
ruff format backend/

# Then commit again
git add -A
git commit -m "[FEAT] Add thumbnail generation endpoint"
```

### Push and open a PR

```bash
git push origin feature/my-new-feature
```

Then open a **Pull Request** on GitHub targeting `main`.

---

## 3. Branch Naming

| Prefix | Use case | Example |
|--------|----------|---------|
| `feature/` | New functionality | `feature/thumbnail-editor` |
| `fix/` | Bug fix | `fix/login-crash` |
| `hotfix/` | Urgent production fix | `hotfix/auth-token-expiry` |
| `chore/` | Dependencies, tooling, CI | `chore/update-deps` |
| `docs/` | Documentation only | `docs/api-reference` |

---

## 4. Commit Message Format

```
[TYPE] Short description (max 72 chars)

Optional body explaining WHY, not what.
```

**Allowed types:** `[FEAT]`, `[FIX]`, `[HOTFIX]`, `[REFACTOR]`, `[STYLE]`, `[TEST]`, `[DOCS]`, `[CHORE]`, `[REVERT]`

**Rules:**
- Imperative mood: "Add", "Fix", "Remove" — not "Added", "Fixed"
- Subject line ≤ 72 characters
- Reference issues: `[FIX] Resolve login crash (#42)`

---

## 5. What CI Checks

Every push/PR that touches `backend/` triggers the **Backend CI** pipeline:

| Step | Command | What it does |
|------|---------|-------------|
| **Lint** | `ruff check backend/` | Catches bugs, bad imports, code smells |
| **Format** | `ruff format --check backend/` | Ensures consistent code style |
| **Test** | `pytest backend/tests/` | Runs the test suite |

**If CI fails**, check the Actions tab on GitHub to see which step failed.

### Quick fix for formatting failures

```bash
ruff check --fix backend/
ruff format backend/
git add -A
git commit -m "[STYLE] Run ruff format"
git push
```

---

## 6. Rules

1. **Never push directly to `main`** — always use a branch + PR.
2. **Never commit `.env` files, secrets, or API keys.**
3. **Keep branches short-lived** — merge within a few days.
4. **Delete branches after merging.**
5. **Run `ruff format backend/` before pushing** (or use pre-commit).
6. **Pull before branching** — always branch off the latest `main`.

---

## 7. PR Checklist

Before opening a Pull Request:

- [ ] Branch is up to date with `main` (`git pull origin main`)
- [ ] Code runs locally without errors
- [ ] `ruff check backend/` passes
- [ ] `ruff format --check backend/` passes
- [ ] No secrets or `.env` files included
- [ ] Commit messages follow the convention
- [ ] PR title uses the same prefix format (e.g. `[FEAT] Add export presets`)

---

## 8. Troubleshooting

### "Would reformat: ..." error in CI

Your code isn't formatted. Run locally:
```bash
ruff format backend/
```

### "Import block is un-sorted" error

Your imports need reordering. Run:
```bash
ruff check --fix backend/
```

### pre-commit not running

Make sure you installed it:
```bash
pre-commit install
```

### I want to skip pre-commit for one commit (not recommended)

```bash
git commit --no-verify -m "[WIP] Temporary commit"
```

> ⚠️ CI will still check your code — this only skips the local hook.
