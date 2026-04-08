#!/bin/bash
# PreToolUse(Bash) — block dangerous commands before execution

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "$CLAUDE_TOOL_INPUT")

BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf /*"
  "rm -rf ~"
  "chmod 777"
  "chmod -R 777"
  "dd if="
  "> /dev/sda"
  "mkfs."
  ":(){:|:&};:"
  "format c:"
  "del /f /s /q C:\\"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern" 2>/dev/null; then
    echo "{\"decision\": \"block\", \"reason\": \"Destructive command blocked: $pattern\"}" >&2
    exit 2
  fi
done

exit 0
