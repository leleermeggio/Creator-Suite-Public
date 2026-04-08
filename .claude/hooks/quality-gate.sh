#!/bin/bash
# Stop hook — lightweight quality gate at end of each turn

ISSUES=()

# Check for Python syntax errors in recently touched .py files (fast, no test run)
if command -v python3 &>/dev/null; then
  while IFS= read -r -d '' pyfile; do
    python3 -m py_compile "$pyfile" 2>/dev/null || ISSUES+=("Syntax error: $pyfile")
  done < <(git diff --name-only --diff-filter=M 2>/dev/null | grep '\.py$' | tr '\n' '\0')
fi

# Check for TypeScript errors if tsc available and tsconfig present
if [ -f "frontend/tsconfig.json" ] && command -v npx &>/dev/null; then
  cd frontend && npx tsc --noEmit --skipLibCheck 2>/dev/null | head -5 | while read -r line; do
    ISSUES+=("TS: $line")
  done
  cd ..
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
  echo "Quality gate warnings:" >&2
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue" >&2
  done
fi

exit 0
