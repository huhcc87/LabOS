#!/usr/bin/env bash
# LabOS mobile build helper
# Usage: bash build-mobile.sh [ios|android|all]
set -e

TARGET="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$SCRIPT_DIR/frontend"

echo "🔨  Building web bundle..."
cd "$FRONTEND"
npm run build

echo "🔄  Syncing Capacitor..."
npx cap sync

case "$TARGET" in
  ios)
    echo "📱  Opening iOS project in Xcode..."
    npx cap open ios
    ;;
  android)
    echo "🤖  Opening Android project in Android Studio..."
    npx cap open android
    ;;
  all)
    echo "📱  Opening iOS..."
    npx cap open ios
    echo "🤖  Opening Android..."
    npx cap open android
    ;;
  release-android)
    echo "🏗️   Building Android release AAB..."
    cd "$FRONTEND/android"
    ./gradlew bundleRelease
    echo "✅  Output: android/app/build/outputs/bundle/release/app-release.aab"
    ;;
  *)
    echo "Usage: $0 [ios|android|all|release-android]"
    exit 1
    ;;
esac

echo "✅  Done."
