#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required=(open-core/README.md open-core/allowlist.txt open-core/exclude-patterns.txt LICENSE)
for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "Missing community boundary file: $path" >&2; exit 1; }
done

tracked_forbidden="$({
  git ls-files -- '.env' '.env.*' '*.pem' '*.key' '*.p12' '*.pfx' 'backups/**' 'logs/**' '.release-evidence/**' 'research/**' 'hyperresearch_vault/**'
} | grep -vE '(^|/)\.env\.example$' || true)"
if [[ -n "$tracked_forbidden" ]]; then
  echo "Refusing community release: forbidden tracked files detected:" >&2
  printf '%s\n' "$tracked_forbidden" >&2
  exit 1
fi

if rg -l --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' \
  --glob '!*.example' \
  '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk_live_[A-Za-z0-9]+|rk_live_[A-Za-z0-9]+)' . >/tmp/tayari-open-core-sensitive-files.txt; then
  echo "Refusing community release: credential-shaped content detected:" >&2
  cat /tmp/tayari-open-core-sensitive-files.txt >&2
  exit 1
fi

echo "Community release boundary check passed. Build artifacts must still use the allowlist and exclusions."