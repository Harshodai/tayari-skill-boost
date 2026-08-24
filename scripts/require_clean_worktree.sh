#!/usr/bin/env bash
# Refuse release packaging from a checkout containing unreviewed changes.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
  echo "ERROR: release packaging requires a clean git worktree." >&2
  git status --short >&2
  exit 78
fi

if [[ "${CI:-false}" == "true" && -n "${GITHUB_SHA:-}" ]]; then
  head_sha="$(git rev-parse HEAD)"
  if [[ "$head_sha" != "$GITHUB_SHA" ]]; then
    echo "ERROR: checkout HEAD ($head_sha) does not match GITHUB_SHA ($GITHUB_SHA)." >&2
    exit 78
  fi
fi

echo "PASS: clean worktree and release identity verified"
