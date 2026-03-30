#!/bin/bash
# PreCompact hook — save a lightweight snapshot before context compaction

SNAPSHOT_DIR=".claude/shared/snapshots"
mkdir -p "$SNAPSHOT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S 2>/dev/null || echo "unknown")
SNAPSHOT_FILE="$SNAPSHOT_DIR/precompact-$TIMESTAMP.md"

{
  echo "# Compaction Snapshot — $TIMESTAMP"
  echo ""
  echo "## Git Status"
  git status --short 2>/dev/null || echo "(not a git repo)"
  echo ""
  echo "## Recent Commits"
  git log --oneline -5 2>/dev/null || echo "(none)"
  echo ""
  echo "## Modified Files"
  git diff --name-only 2>/dev/null || echo "(none)"
} > "$SNAPSHOT_FILE"

echo "Snapshot saved: $SNAPSHOT_FILE"
exit 0
