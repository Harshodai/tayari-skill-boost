#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Job Tayari Chrome Extension Packager for Chrome Web Store Distribution
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="${ROOT_DIR}/extension"
DIST_DIR="${ROOT_DIR}/dist"

echo "📦 Packaging Job Tayari Chrome Extension..."

if [ ! -d "${EXT_DIR}" ]; then
  echo "❌ Error: Extension directory ${EXT_DIR} not found!"
  exit 1
fi

if [ ! -f "${EXT_DIR}/manifest.json" ]; then
  echo "❌ Error: manifest.json not found in ${EXT_DIR}!"
  exit 1
fi

# Extract version from manifest.json
VERSION=$(node -e "console.log(require('${EXT_DIR}/manifest.json').version || '3.2.0')")
ZIP_NAME="job-tayari-extension-v${VERSION}.zip"
ZIP_PATH="${DIST_DIR}/${ZIP_NAME}"

mkdir -p "${DIST_DIR}"
rm -f "${ZIP_PATH}"

echo "ℹ️ Target version: ${VERSION}"
echo "ℹ️ Output destination: ${ZIP_PATH}"

# Create zip file excluding development files, tests, and OS artifacts
cd "${EXT_DIR}"
zip -r "${ZIP_PATH}" . \
  -x "*.DS_Store" \
  -x "tests/*" \
  -x "*.test.js" \
  -x "*.spec.js" \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "*.md"

echo "✅ Successfully created: ${ZIP_PATH}"
echo "📊 Archive size: $(du -h "${ZIP_PATH}" | cut -f1)"
echo "🚀 Ready for upload to Chrome Web Store Developer Dashboard!"
