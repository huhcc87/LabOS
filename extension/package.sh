#!/usr/bin/env bash
# Package the LabOS Reagent Capture extension for distribution.
#
# Usage:
#   ./package.sh           — builds chrome zip
#   ./package.sh firefox   — builds firefox zip
#   ./package.sh both      — builds both
#
# Output: labos-extension-<version>-{chrome,firefox}.zip in the parent dir.

set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
TARGET="${1:-chrome}"
OUT_DIR="../dist-extension"
mkdir -p "$OUT_DIR"

build_chrome() {
  local zip_name="$OUT_DIR/labos-extension-${VERSION}-chrome.zip"
  rm -f "$zip_name"
  echo "→ Packaging Chrome / Edge / Brave bundle…"
  zip -r "$zip_name" . \
    -x "manifest.firefox.json" \
    -x "*.sh" \
    -x ".DS_Store" \
    -x "INSTALL.md" \
    -x "README.md" \
    -x "../dist-extension/*" \
    > /dev/null
  echo "  ✓ $zip_name ($(du -h "$zip_name" | cut -f1))"
}

build_firefox() {
  local zip_name="$OUT_DIR/labos-extension-${VERSION}-firefox.zip"
  rm -f "$zip_name"
  echo "→ Packaging Firefox bundle…"
  # Temporarily swap manifests so Firefox sees the right file
  cp manifest.json /tmp/labos-chrome-manifest.bak
  cp manifest.firefox.json manifest.json
  zip -r "$zip_name" . \
    -x "manifest.firefox.json" \
    -x "*.sh" \
    -x ".DS_Store" \
    -x "INSTALL.md" \
    -x "README.md" \
    -x "../dist-extension/*" \
    > /dev/null
  cp /tmp/labos-chrome-manifest.bak manifest.json
  rm /tmp/labos-chrome-manifest.bak
  echo "  ✓ $zip_name ($(du -h "$zip_name" | cut -f1))"
}

case "$TARGET" in
  chrome) build_chrome ;;
  firefox) build_firefox ;;
  both) build_chrome; build_firefox ;;
  *) echo "Usage: $0 [chrome|firefox|both]"; exit 1 ;;
esac

echo ""
echo "📦 Done. Upload to:"
echo "   Chrome Web Store: https://chrome.google.com/webstore/devconsole"
echo "   Firefox AMO:      https://addons.mozilla.org/developers/"
echo ""
echo "For unsigned local install, follow extension/INSTALL.md"
