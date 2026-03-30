#!/bin/bash
# PostToolUse(Edit|Write|MultiEdit) — auto-format saved files

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null || echo "")

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md)
    # Try project-local prettier first, then global
    if [ -f "node_modules/.bin/prettier" ]; then
      node_modules/.bin/prettier --write "$FILE_PATH" 2>/dev/null
    else
      npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.py)
    # Try ruff first (this project likely has it via pyproject.toml), then black
    ruff format "$FILE_PATH" 2>/dev/null || python3 -m black "$FILE_PATH" 2>/dev/null || true
    ;;
  *.go)
    gofmt -w "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
