#!/bin/sh
set -eu
ID=${TAYARI_EXTENSION_ID:-}
[ -n "$ID" ] || { echo "Set TAYARI_EXTENSION_ID" >&2; exit 2; }
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEST="$HOME/.local/share/job-tayari/native-host"
mkdir -p "$DEST"
if [ "$(uname -s)" = "Darwin" ]; then BIN="$ROOT/bin/mac-arm64/com.jobtayari.browser"; else BIN="$ROOT/bin/linux-x64/com.jobtayari.browser"; fi
install -m 755 "$BIN" "$DEST/com.jobtayari.browser"
for DIR in "$HOME/.config/google-chrome/NativeMessagingHosts" "$HOME/.config/chromium/NativeMessagingHosts" "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"; do
  mkdir -p "$DIR"
  sed "s|__HOST_PATH__|$DEST/com.jobtayari.browser|;s|__EXTENSION_ID__|$ID|" "$ROOT/installers/com.jobtayari.browser.json" > "$DIR/com.jobtayari.browser.json"
done
