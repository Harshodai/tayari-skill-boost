#!/usr/bin/env bash
# CI gate: if optimizer prompts changed, run the ATS eval subset and fail on regression.
set -euo pipefail

WATCHED=(
  "backend/python/app/services/optimizer.py"
  "backend/python/app/services/prompt_registry.py"
)

BASE_REF="origin/main"
if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  if git rev-parse --verify "HEAD~1" >/dev/null 2>&1; then
    BASE_REF="HEAD~1"
  else
    echo "prompt_eval_gate: no base ref available; running ATS eval subset unconditionally."
    BASE_REF=""
  fi
fi

CHANGED=""
if [ -n "$BASE_REF" ]; then
  CHANGED="$(git diff --name-only "$BASE_REF"...HEAD -- "${WATCHED[@]}" 2>/dev/null || true)"
  # Unstaged/uncommitted changes also count (local runs), including untracked files.
  LOCAL="$(git diff --name-only -- "${WATCHED[@]}" 2>/dev/null || true)"
  UNTRACKED="$(git ls-files --others --exclude-standard -- "${WATCHED[@]}" 2>/dev/null || true)"
  CHANGED="$(printf '%s\n%s\n%s' "$CHANGED" "$LOCAL" "$UNTRACKED" | sort -u | grep -v '^$' || true)"
else
  CHANGED="no-base-ref"
fi

if [ -z "$CHANGED" ]; then
  echo "prompt_eval_gate: no optimizer prompt changes; skipping ATS eval."
  exit 0
fi

echo "prompt_eval_gate: prompt files changed:"
echo "$CHANGED"
echo "prompt_eval_gate: running ATS eval subset..."
cd backend/python
python -m pytest eval/runner.py -k ats_ -q
