#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 path/to/Tayari-Desktop-artifact.{dmg,zip,app}" >&2
  exit 2
fi

ARTIFACT="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -e "$ARTIFACT" ]]; then
  echo "artifact does not exist: $ARTIFACT" >&2
  exit 2
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS artifact verification requires a macOS runner" >&2
  exit 2
fi

WORK_DIR="$(mktemp -d -t tayari-mac-artifact.XXXXXX)"
MOUNT_POINT="$WORK_DIR/mount"
cleanup() {
  set +e
  if mount | grep -q "on $MOUNT_POINT "; then
    hdiutil detach "$MOUNT_POINT" -force >/dev/null 2>&1
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
mkdir -p "$MOUNT_POINT"

APP_PATH=""
case "$ARTIFACT" in
  *.dmg)
    hdiutil verify "$ARTIFACT" >/dev/null
    hdiutil attach "$ARTIFACT" -readonly -nobrowse -mountpoint "$MOUNT_POINT" >/dev/null
    APP_PATH="$(find "$MOUNT_POINT" -maxdepth 2 -type d -name '*.app' -print -quit)"
    ;;
  *.zip)
    unzip -q "$ARTIFACT" -d "$WORK_DIR/unzip"
    APP_PATH="$(find "$WORK_DIR/unzip" -maxdepth 3 -type d -name '*.app' -print -quit)"
    ;;
  *.app)
    APP_PATH="$ARTIFACT"
    ;;
  *)
    echo "unsupported artifact type: $ARTIFACT" >&2
    exit 2
    ;;
esac

if [[ -z "$APP_PATH" || ! -d "$APP_PATH/Contents" ]]; then
  echo "no macOS application bundle found" >&2
  exit 1
fi

INFO_PLIST="$APP_PATH/Contents/Info.plist"
[[ -f "$INFO_PLIST" ]] || { echo "Info.plist missing" >&2; exit 1; }
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
[[ "$BUNDLE_ID" == "app.tayari.desktop" ]] || { echo "unexpected bundle id: $BUNDLE_ID" >&2; exit 1; }
[[ "$VERSION" == "0.1.0" ]] || { echo "unexpected app version: $VERSION" >&2; exit 1; }

for forbidden in ".map" "backend" "supabase-local" "docker-compose" ".env" "node_modules" "electron/**/*.test.cjs"; do
  if find "$APP_PATH" -path "*$forbidden*" -print -quit | grep -q .; then
    echo "forbidden release payload matched: $forbidden" >&2
    exit 1
  fi
done

EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$INFO_PLIST")"
MAIN_BINARY="$APP_PATH/Contents/MacOS/$EXECUTABLE"
[[ -x "$MAIN_BINARY" ]] || { echo "main executable missing or not executable" >&2; exit 1; }
ARCHES="$(lipo -archs "$MAIN_BINARY")"
[[ "$ARCHES" == *"arm64"* ]] || { echo "arm64 executable missing: $ARCHES" >&2; exit 1; }
[[ "$ARCHES" != *"x86_64"* ]] || { echo "x86_64 payload is not allowed by the arm64-only policy: $ARCHES" >&2; exit 1; }

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"
xcrun stapler validate "$APP_PATH"

echo "macOS artifact contract: PASS ($ARTIFACT; $BUNDLE_ID $VERSION; $ARCHES)"
