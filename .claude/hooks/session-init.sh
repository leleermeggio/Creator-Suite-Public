#!/bin/bash
# Session initialization hook — runs on every new Claude Code session

# Detect project type(s)
TYPES=()
[ -f "requirements.txt" ] || [ -f "pyproject.toml" ] && TYPES+=("python")
[ -f "package.json" ] && TYPES+=("node")
[ -f "docker-compose.yml" ] || [ -f "Dockerfile" ] && TYPES+=("docker")
[ -f "go.mod" ] && TYPES+=("go")

TYPE_STR=$(IFS=+; echo "${TYPES[*]}")

# Check backend health if running
BACKEND_STATUS="offline"
curl -s http://localhost:8000/health > /dev/null 2>&1 && BACKEND_STATUS="online"

echo "Session started | Stack: ${TYPE_STR:-unknown} | Backend: $BACKEND_STATUS"
