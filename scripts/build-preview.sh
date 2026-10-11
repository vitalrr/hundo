#!/usr/bin/env bash
set -euo pipefail

# Local preview APK for Seeker / ARM64. The generated Expo debug signing key is
# suitable for testing only; use a private release key for store publication.
hundo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$hundo_root"
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17}"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
node node_modules/expo/bin/cli prebuild --platform android --no-install
# Expo keeps the existing native directory during incremental builds, so
# explicitly sync the package version before Gradle assembles the APK.
node - "$hundo_root/app.json" "$hundo_root/android/app/build.gradle" <<'NODE'
const fs = require('node:fs');
const [configPath, gradlePath] = process.argv.slice(2);
const app = JSON.parse(fs.readFileSync(configPath, 'utf8')).expo;
const current = fs.readFileSync(gradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(current) || !/versionName\s+"[^"]+"/.test(current)) {
  throw new Error('Could not find Android version fields');
}
const updated = current
  .replace(/versionCode\s+\d+/, `versionCode ${app.android.versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${app.version}"`);
fs.writeFileSync(gradlePath, updated);
NODE
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=4 --console=plain -Dorg.gradle.vfs.watch=false
cd "$hundo_root"
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/hundo-preview.apk
printf '%s\n' "Preview APK: $hundo_root/dist/hundo-preview.apk"
