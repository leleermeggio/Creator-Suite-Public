#!/usr/bin/env bash
# ============================================================================
#  Creator Zone — Termux ↔ llama-server doctor
#
#  Walks the chain that actually breaks, in order:
#    1. is the ZeroTier route up
#    2. is llama-server listening and healthy
#    3. which model is loaded
#    4. does the model actually emit tool_calls   ← the real bottleneck
#
#  Usage:
#    bash doctor.sh                       # reads the host from ~/.config/crush/crushrc
#    bash doctor.sh --host 10.147.20.5 --port 8080
# ============================================================================
set -uo pipefail

LLAMA_HOST="${LLAMA_HOST:-}"
LLAMA_PORT="${LLAMA_PORT:-}"
FAILED=0

ok()   { printf '\033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
bad()  { printf '\033[31m❌ %s\033[0m\n' "$*"; FAILED=1; }
hdr()  { printf '\n\033[36m── %s ─────────────────────────────────\033[0m\n' "$*"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host) LLAMA_HOST="${2:-}"; shift 2 ;;
        --port) LLAMA_PORT="${2:-}"; shift 2 ;;
        -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
        *) echo "Unknown flag: $1"; exit 2 ;;
    esac
done

# ---------------------------------------------------------------------------
# Resolve the endpoint from crushrc when not passed explicitly
# ---------------------------------------------------------------------------
CRUSHRC="${XDG_CONFIG_HOME:-$HOME/.config}/crush/crushrc"
if [[ -z "$LLAMA_HOST" && -f "$CRUSHRC" ]]; then
    URL="$(sed -n 's|.*--base-url[= ]*"\(http[^"]*\)".*|\1|p' "$CRUSHRC" | head -1)"
    if [[ -n "$URL" ]]; then
        HOSTPORT="${URL#http://}"; HOSTPORT="${HOSTPORT%%/*}"
        LLAMA_HOST="${HOSTPORT%%:*}"
        [[ -z "$LLAMA_PORT" ]] && LLAMA_PORT="${HOSTPORT##*:}"
    fi
fi
LLAMA_PORT="${LLAMA_PORT:-8080}"
[[ -n "$LLAMA_HOST" ]] || { echo "❌ No host. Pass --host <zerotier-ip> or run bootstrap.sh first."; exit 2; }

BASE="http://${LLAMA_HOST}:${LLAMA_PORT}"
echo "🔎 Target: $BASE"

# ---------------------------------------------------------------------------
# 1. Local tooling
# ---------------------------------------------------------------------------
hdr "Tablet"
if command -v crush >/dev/null 2>&1; then
    ok "crush → $(crush --version 2>/dev/null | head -1)"
else
    bad "crush not on PATH — run scripts/termux/bootstrap.sh"
fi
[[ -f "$CRUSHRC" ]] && ok "crushrc → $CRUSHRC" || warn "No crushrc at $CRUSHRC"

if command -v termux-wake-lock >/dev/null 2>&1; then
    ok "termux-wake-lock available (the 'cz' launcher holds it for you)"
else
    warn "termux-wake-lock missing — Android may kill long agent turns with the screen off"
fi

# ---------------------------------------------------------------------------
# 2. Network + server health
# ---------------------------------------------------------------------------
hdr "Network"
if curl -fsS --max-time 5 "$BASE/health" >/dev/null 2>&1; then
    ok "llama-server healthy at $BASE"
else
    bad "No answer from $BASE/health"
    echo "     • is ZeroTier connected on BOTH devices (same network ID)?"
    echo "     • did you start llama-server with --host 0.0.0.0 (not 127.0.0.1)?"
    echo "     • is the Windows firewall allowing inbound TCP $LLAMA_PORT on the ZeroTier adapter?"
    echo
    echo "  Cannot test the model without a reachable server — stopping here."
    exit 1
fi

# ---------------------------------------------------------------------------
# 3. Which model is loaded
# ---------------------------------------------------------------------------
hdr "Model"
PROPS="$(curl -fsS --max-time 10 "$BASE/props" 2>/dev/null || true)"
MODEL_ID="$(printf '%s' "$PROPS" | sed -n 's/.*"model_path": *"\([^"]*\)".*/\1/p' | head -1)"
[[ -z "$MODEL_ID" ]] && MODEL_ID="$(curl -fsS --max-time 10 "$BASE/v1/models" 2>/dev/null \
    | sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' | head -1)"
if [[ -n "$MODEL_ID" ]]; then
    ok "Loaded: $(basename "$MODEL_ID")"
else
    warn "Could not read the model name from /props or /v1/models"
fi

# ---------------------------------------------------------------------------
# 4. The one that matters: does the model emit tool_calls
# ---------------------------------------------------------------------------
hdr "Tool calling"
PROBE="$(curl -fsS --max-time 60 "$BASE/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{
      "messages": [
        {"role":"user","content":"Read the file README.md. Call the tool, do not answer in prose."}
      ],
      "tools": [{
        "type":"function",
        "function":{
          "name":"read_file",
          "description":"Read a file from disk",
          "parameters":{
            "type":"object",
            "properties":{"path":{"type":"string","description":"Path to the file"}},
            "required":["path"]
          }
        }
      }],
      "temperature": 0,
      "max_tokens": 256
    }' 2>/dev/null || true)"

if [[ -z "$PROBE" ]]; then
    bad "The /v1/chat/completions probe returned nothing (timeout, or the server rejected the tools payload)"
elif printf '%s' "$PROBE" | grep -q '"tool_calls"'; then
    CALLED="$(printf '%s' "$PROBE" | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)"
    ok "Model emitted a tool call (${CALLED:-read_file}) — the agent loop will hold"
elif printf '%s' "$PROBE" | grep -qi 'jinja\|template'; then
    bad "The server complained about the chat template"
    printf '     %s\n' "$(printf '%s' "$PROBE" | head -c 300)"
    echo "     → restart llama-server with --jinja"
else
    bad "The model answered in prose instead of calling the tool"
    printf '     %s\n' "$(printf '%s' "$PROBE" | sed -n 's/.*"content": *"\([^"]*\)".*/\1/p' | head -1 | head -c 200)"
    echo "     → most common cause: llama-server started WITHOUT --jinja, so the"
    echo "       model's tool template is never applied. Restart with --jinja."
    echo "     → if --jinja is already on, the model is too small/weak for the"
    echo "       agent loop. Qwen3-Coder-class models are the realistic floor."
fi

# ---------------------------------------------------------------------------
hdr "Verdict"
if [[ "$FAILED" -eq 0 ]]; then
    echo "🎉 All green. Run 'cz' to start coding."
else
    echo "🔧 Fix the ❌ above, then rerun: bash scripts/termux/doctor.sh"
fi
exit "$FAILED"
