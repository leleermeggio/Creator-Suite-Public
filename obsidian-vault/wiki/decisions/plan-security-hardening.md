---
type: decision
status: active
priority: 1
date: 2026-04-04
owner: "Leo Partis"
context: "Home-server beta deployment $0 cost + fix 3 confirmed exploits"
source: ".raw/superpowers-plans/2026-04-04-security-production-hardening.md"
spec: ".raw/superpowers-specs/2026-04-04-security-production-hardening-design.md"
tags: [decision, plan, security, deployment]
created: 2026-04-18
updated: 2026-04-18
---

# Plan — Security Hardening & Production Deployment

## Goal
Fix 3 confirmed exploits, plug all bug gaps, deploy to home server at $0 cost with automatic HTTPS.

## Architecture
FastAPI backend + Expo web frontend behind Caddy reverse proxy. Docker Compose orchestrates services. DuckDNS = free stable subdomain. Caddy auto-fetches/renews Let's Encrypt TLS certs via DNS-01 challenge. Target audience: 10–20 creator beta users.

## Tech stack
Python 3.11 / FastAPI / SQLAlchemy / Alembic / Celery / Redis / PostgreSQL / Docker Compose / Caddy 2 / DuckDNS / TypeScript / Expo

## Scope changes touched
- `backend/migrations/versions/1cd136f2d91c_add_agents_and_missions.py` — add CREATE TABLE agents + missions
- `backend/routes/captions.py` — wire translate endpoint to real service
- `backend/models/enums.py` — add WATERMARK job type
- `backend/routes/watermark.py` — use WATERMARK job type

## Related
- [[decisions/home-server-deployment]]
- [[modules/backend]]
- [[entities/Caddy]]
- [[entities/DuckDNS]]
- [[entities/PostgreSQL]]

## Status
Approved. Implementation phase (branch fix/security-hardening cherry-picks visible in recent git log).
