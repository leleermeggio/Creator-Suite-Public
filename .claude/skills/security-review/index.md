# Security Review Workflow

Deep security audit for CazZone Creator Suite. Run this before any release or after touching auth/payment/storage code.

## Step 1 — Auth & Authorization

- [ ] All routes (except `/auth/*` and `/health`) use `get_current_user` dependency
- [ ] All DB queries are scoped to `user.id` — no cross-user data leakage
- [ ] JWT tokens: access token expires in ≤60 min, refresh in ≤30 days
- [ ] Passwords are hashed with bcrypt (never stored plain)
- [ ] No secrets in code: grep for hardcoded API keys, passwords, tokens
  ```bash
  grep -r "sk-\|AIza\|Bearer \|password\s*=\s*['\"]" backend/ --include="*.py" | grep -v test | grep -v ".env"
  ```

## Step 2 — Input Validation

- [ ] All route inputs validated by Pydantic schemas with `min_length`/`max_length` on strings
- [ ] File upload endpoints: check `content_type` and `size_bytes` limits (max 2GB per `media.py`)
- [ ] No SQL injection: all queries via SQLAlchemy ORM (no raw `text()` with user input)
- [ ] Image/base64 inputs in `/tools/ocr`: validate it's a real base64 string before sending to Gemini

## Step 3 — CORS & Headers

- [ ] `ALLOWED_ORIGINS` does NOT contain `*` in production
- [ ] `SecurityHeadersMiddleware` is active (check `middleware/security.py`)
- [ ] No sensitive data in response headers

## Step 4 — Frontend API Key Exposure

- [ ] No API keys in frontend source code or `constants/`
- [ ] All tool calls go through BE (`/tools/*`) not direct to Gemini/external APIs
  ```bash
  grep -r "AIza\|api_key\|apiKey" frontend/services/ frontend/constants/ --include="*.ts"
  ```
- [ ] AsyncStorage only stores JWT tokens, no sensitive user data

## Step 5 — Rate Limiting

- [ ] `/auth/login`, `/auth/register`, `/auth/refresh` all have rate limits (5/min)
- [ ] `/tools/*` endpoints have rate limits to prevent AI API abuse

## Step 6 — Dependency Audit

```bash
# Python
pip audit
# Node
cd frontend && npm audit --audit-level=high
```

## Report Format

For each finding: **Severity** (Critical/High/Medium/Low) | **Location** | **Description** | **Fix**
