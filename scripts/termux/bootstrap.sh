#!/usr/bin/env bash
# ============================================================================
#  Creator Zone — Termux bootstrap
#
#  Turns an Android tablet into a coding workstation:
#    - dev toolchain (git, ssh, node, python, ripgrep)
#    - Crush agent (official Android/arm64 build, checksum-verified)
#    - Crush wired to a remote llama-server over ZeroTier
#    - wake-lock helpers so Android does not kill the session
#
#  Usage:
#    bash bootstrap.sh --host 10.147.20.5            # ZeroTier IP of the PC
#    bash bootstrap.sh --host 10.147.20.5 --port 8080
#    bash bootstrap.sh --host 10.147.20.5 --skip-pkg --crush-version v0.89.0
# ============================================================================
set -euo pipefail

LLAMA_HOST="${LLAMA_HOST:-}"
LLAMA_PORT="${LLAMA_PORT:-8080}"
CRUSH_VERSION="${CRUSH_VERSION:-}"
CRUSH_VERSION_FALLBACK="v0.89.0"
REPO_DIR="${REPO_DIR:-$HOME/Creator-Suite-Public}"
SKIP_PKG=0

PKGS=(git openssh nodejs python ripgrep fd curl jq tar which termux-api)

log()  { printf '\n\033[36m🚀 %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✅ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m⚠️  %s\033[0m\n' "$*"; }
die()  { printf '\033[31m❌ %s\033[0m\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)           LLAMA_HOST="${2:-}"; shift 2 ;;
        --port)           LLAMA_PORT="${2:-}"; shift 2 ;;
        --crush-version)  CRUSH_VERSION="${2:-}"; shift 2 ;;
        --repo-dir)       REPO_DIR="${2:-}"; shift 2 ;;
        --skip-pkg)       SKIP_PKG=1; shift ;;
        -h|--help)        sed -n '2,18p' "$0"; exit 0 ;;
        *)                die "Unknown flag: $1 (try --help)" ;;
    esac
done

# ---------------------------------------------------------------------------
# 0. Sanity: this only makes sense inside Termux
# ---------------------------------------------------------------------------
[[ -n "${PREFIX:-}" && -d "$PREFIX/bin" ]] \
    || die "PREFIX not set — run this inside Termux, not in a proot/chroot distro."
[[ "$PREFIX" == *com.termux* ]] \
    || warn "PREFIX=$PREFIX does not look like Termux. Continuing anyway."

case "$(uname -m)" in
    aarch64|arm64) ARCH_ASSET="Android_arm64" ;;
    *) die "Unsupported CPU: $(uname -m). Charm publishes Android builds for arm64 only." ;;
esac

if [[ -z "$LLAMA_HOST" ]]; then
    if [[ -t 0 ]]; then
        printf '\n🔗 ZeroTier IP of the machine running llama-server (e.g. 10.147.20.5): '
        read -r LLAMA_HOST
    fi
    [[ -n "$LLAMA_HOST" ]] || die "Missing --host <zerotier-ip>."
fi

LLAMA_BASE="http://${LLAMA_HOST}:${LLAMA_PORT}"

# ---------------------------------------------------------------------------
# 1. Packages
# ---------------------------------------------------------------------------
if [[ "$SKIP_PKG" -eq 1 ]]; then
    log "Skipping package installation (--skip-pkg)"
else
    log "Installing the dev toolchain"
    yes | pkg upgrade -y >/dev/null 2>&1 || warn "pkg upgrade reported problems — continuing."

    # One package at a time: a single renamed/missing package in the Termux
    # repo must not abort the whole setup.
    MISSING=()
    for p in "${PKGS[@]}"; do
        if pkg install -y "$p" >/dev/null 2>&1; then
            printf '   • %s\n' "$p"
        else
            MISSING+=("$p")
        fi
    done
    [[ ${#MISSING[@]} -gt 0 ]] && warn "Could not install: ${MISSING[*]} (install manually if you need them)"
    ok "Toolchain ready"
fi

# ---------------------------------------------------------------------------
# 2. Shared storage (Android permission dialog — needs a tap)
# ---------------------------------------------------------------------------
if [[ -d "$HOME/storage" ]]; then
    ok "Shared storage already linked (~/storage)"
else
    log "Requesting shared-storage access — approve the Android dialog"
    termux-setup-storage || warn "termux-setup-storage failed; rerun it manually if you need ~/storage."
fi

# ---------------------------------------------------------------------------
# 3. Crush — official Android/arm64 release, verified against checksums.txt
# ---------------------------------------------------------------------------
log "Installing Crush"

if [[ -z "$CRUSH_VERSION" ]]; then
    CRUSH_VERSION="$(curl -fsSL --max-time 15 \
        https://api.github.com/repos/charmbracelet/crush/releases/latest 2>/dev/null \
        | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1 || true)"
fi
if [[ -z "$CRUSH_VERSION" ]]; then
    CRUSH_VERSION="$CRUSH_VERSION_FALLBACK"
    warn "GitHub API unreachable or rate-limited — pinning $CRUSH_VERSION"
fi

CRUSH_NUM="${CRUSH_VERSION#v}"
INSTALLED=""
command -v crush >/dev/null 2>&1 && INSTALLED="$(crush --version 2>/dev/null | head -1 || true)"

if [[ -n "$INSTALLED" && "$INSTALLED" == *"$CRUSH_NUM"* ]]; then
    ok "Crush $CRUSH_NUM already installed"
else
    ASSET="crush_${CRUSH_NUM}_${ARCH_ASSET}.tar.gz"
    BASE_URL="https://github.com/charmbracelet/crush/releases/download/${CRUSH_VERSION}"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT

    printf '   ↓ %s\n' "$ASSET"
    curl -fSL --retry 3 --retry-delay 2 -o "$TMP/$ASSET"          "$BASE_URL/$ASSET" \
        || die "Download failed. Check that $ASSET exists for $CRUSH_VERSION."
    curl -fsSL --retry 3 --retry-delay 2 -o "$TMP/checksums.txt"  "$BASE_URL/checksums.txt" \
        || die "Could not fetch checksums.txt — refusing to install an unverified binary."

    ( cd "$TMP" && grep " \+${ASSET}\$" checksums.txt | sha256sum -c - ) \
        || die "Checksum mismatch for $ASSET — aborting."
    ok "Checksum verified"

    tar -xzf "$TMP/$ASSET" -C "$TMP"
    CRUSH_BIN="$(find "$TMP" -type f -name crush | head -1)"
    [[ -n "$CRUSH_BIN" ]] || die "No 'crush' binary inside $ASSET."

    install -m 0755 "$CRUSH_BIN" "$PREFIX/bin/crush"
    ok "Crush installed → $PREFIX/bin/crush ($(crush --version 2>/dev/null | head -1))"
    rm -rf "$TMP"; trap - EXIT
fi

# ---------------------------------------------------------------------------
# 4. crushrc — point Crush at llama-server over ZeroTier
# ---------------------------------------------------------------------------
log "Writing Crush config"

CRUSH_CFG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/crush"
mkdir -p "$CRUSH_CFG_DIR"
CRUSHRC="$CRUSH_CFG_DIR/crushrc"

if [[ -f "$CRUSHRC" ]]; then
    cp "$CRUSHRC" "$CRUSHRC.bak.$(date +%Y%m%d%H%M%S)"
    warn "Existing crushrc backed up next to it"
fi

cat > "$CRUSHRC" <<EOF
# Creator Zone — generated by scripts/termux/bootstrap.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
#
# crushrc is Bash with Crush builtins. It is trusted code: read before running.
# Docs: https://github.com/charmbracelet/crush#configuration

# --- llama-server on the workstation GPU, reached over ZeroTier --------------
# type=llamacpp gives auto-discovery: Crush asks the server which model is
# loaded, so there is no model list to keep in sync and no fake API key.
# The base URL is the server root — llamacpp providers append /v1 themselves.
provider add local \\
  --name "llama.cpp (workstation GPU)" \\
  --type llamacpp \\
  --base-url "$LLAMA_BASE"

# --- Permissions ------------------------------------------------------------
# Read-only tools run unattended; anything that writes still asks first.
# Uncomment the second line once you trust the loop — it stops the prompts
# on file edits, which is what makes the agent usable one-handed on a tablet.
permissions allow view ls grep
# permissions allow edit write bash

# --- Quality of life on a small screen --------------------------------------
option notifications disabled
EOF

ok "Config written → $CRUSHRC"

# ---------------------------------------------------------------------------
# 5. Wake-lock launcher + home-screen shortcut (Termux:Widget)
# ---------------------------------------------------------------------------
log "Installing the 'cz' launcher"

cat > "$PREFIX/bin/cz" <<EOF
#!/usr/bin/env bash
# Creator Zone dev session: hold a wake-lock so Android keeps the agent alive
# with the screen off, then drop into Crush inside the repo.
set -euo pipefail
termux-wake-lock 2>/dev/null || true
trap 'termux-wake-unlock 2>/dev/null || true' EXIT
cd "\${1:-$REPO_DIR}" 2>/dev/null || { echo "❌ Repo not found: \${1:-$REPO_DIR}"; exit 1; }
exec crush
EOF
chmod 0755 "$PREFIX/bin/cz"

mkdir -p "$HOME/.shortcuts"
cat > "$HOME/.shortcuts/Creator Zone (Crush).sh" <<EOF
#!/usr/bin/env bash
exec "$PREFIX/bin/cz"
EOF
chmod 0700 "$HOME/.shortcuts/Creator Zone (Crush).sh"

ok "Run 'cz' to start — or add the Termux:Widget shortcut to the home screen"

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------
cat <<EOF

────────────────────────────────────────────────────────────────────────────
 Setup complete
────────────────────────────────────────────────────────────────────────────
  llama-server   $LLAMA_BASE
  Crush config   $CRUSHRC
  Launcher       cz   (wake-lock + crush in $REPO_DIR)

  Next:
    1. On the PC:   llama-server --host 0.0.0.0 --port $LLAMA_PORT --jinja ...
    2. On here:     bash scripts/termux/doctor.sh
    3. Then:        cz
────────────────────────────────────────────────────────────────────────────
EOF
