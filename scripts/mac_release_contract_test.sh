#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node --check electron/main.cjs
node --check electron/preload.cjs

grep -q 'contextIsolation: true' electron/main.cjs
grep -q 'nodeIntegration: false' electron/main.cjs
grep -q 'sandbox: true' electron/main.cjs
grep -q 'setWindowOpenHandler' electron/main.cjs
grep -q 'will-navigate' electron/main.cjs
grep -q 'assertTrustedSender' electron/main.cjs
grep -q 'SAFE_EXTERNAL_HOSTS' electron/security.cjs
grep -q 'Only files selected in this session may be revealed' electron/main.cjs
grep -q 'Local service orchestration is disabled in packaged builds' electron/main.cjs
grep -q 'Content-Security-Policy' electron/main.cjs

grep -q '^appId: app.tayari.desktop$' electron-builder.yml
grep -q '"version": "0.1.0"' package.json
grep -q 'hardenedRuntime: true' electron-builder.yml
grep -q 'entitlements: electron/entitlements.plist' electron-builder.yml
grep -q 'notarize:' electron-builder.yml
grep -q 'APPLE_TEAM_ID' electron-builder.yml
grep -Fq "!electron/**/*.test.cjs" electron-builder.yml
grep -Fq "!electron/*.plist" electron-builder.yml
! grep -q 'to: tayari-runtime/backend' electron-builder.yml
! grep -q 'supabase-local' electron-builder.yml
! grep -q 'docker-compose.yml' electron-builder.yml

if command -v plutil >/dev/null 2>&1; then
  plutil -lint electron/entitlements.plist electron/entitlements.mac.plist
fi

echo "macOS release contract: PASS"
