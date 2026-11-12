#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Client
sdkmanager="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"
tools_sha=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
gradle_sha=ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c

versions() {
  test "$(node --version)" = v26.13.0
  test "$(npm --version)" = 11.13.0
  java -XshowSettings:properties -version 2>&1 | grep 'java.version = 21'
  printf '%s\n' "Node $(node --version); npm $(npm --version)"
  test ! -e /var/run/docker.sock
  for file in .env .env.local .env.production .env.production.local; do
    test ! -e "$file"
  done
}

download_tools() {
  if [[ -x "$sdkmanager" ]]; then
    test "$(cat "$ANDROID_SDK_ROOT/.betik-command-tools-sha256")" = "$tools_sha"
    return
  fi
  # This function is reached only after explicit local or manual-CI consent.
  local temporary
  temporary=$(mktemp -d /tmp/betik-android-tools.XXXXXX)
  curl --fail --location --retry 3 \
    https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip \
    --output "$temporary/tools.zip"
  printf '%s  %s\n' "$tools_sha" "$temporary/tools.zip" | sha256sum --check
  unzip -q "$temporary/tools.zip" -d "$temporary/unpacked"
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  test ! -e "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  mv "$temporary/unpacked/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  printf '%s\n' "$tools_sha" > "$ANDROID_SDK_ROOT/.betik-command-tools-sha256"
  # The directory is created above with a fixed /tmp prefix in this container.
  rm -rf -- "$temporary"
}

sdk_ready() {
  if [[ ! -r "$ANDROID_SDK_ROOT/platforms/android-36/android.jar" \
    || ! -x "$ANDROID_SDK_ROOT/build-tools/35.0.0/apksigner" ]]; then
    echo 'Android SDK is not ready. Run ./dev android setup in your own terminal.' >&2
    exit 2
  fi
  test "$(cat "$ANDROID_SDK_ROOT/.betik-command-tools-sha256")" = "$tools_sha"
}

versions
exec 9>"$ANDROID_SDK_ROOT/.betik.lock"
flock 9
case "${1:-doctor}" in
  versions) ;;
  setup)
    printf '%s\n' 'Review the Android SDK license: https://developer.android.com/studio#terms-and-conditions'
    read -r -p 'Do you accept the Android SDK license and want to download its tools? Type yes: ' consent
    [[ "$consent" == yes ]] || exit 2
    download_tools
    # Required package licenses are displayed interactively; no automatic yes.
    "$sdkmanager" --sdk_root="$ANDROID_SDK_ROOT" "platforms;android-36" "build-tools;35.0.0"
    sdk_ready
    ;;
  setup-ci)
    [[ "${CI:-}" == true && "${ANDROID_SDK_LICENSE_ACCEPTED:-}" == true ]] || {
      echo 'Manual workflow license confirmation is required.' >&2; exit 2;
    }
    download_tools
    "$sdkmanager" --sdk_root="$ANDROID_SDK_ROOT" "platforms;android-36" "build-tools;35.0.0" \
      < <(printf 'y\n%.0s' {1..20})
    sdk_ready
    ;;
  doctor) sdk_ready; echo 'Android toolchain ready: SDK 36, Build Tools 35.0.0, JDK 21.' ;;
  import-debug-key)
    destination=/home/node/.android/debug.keystore
    test ! -e "$destination" || { echo 'A debug key already exists; it will not be overwritten.' >&2; exit 2; }
    temporary=$(mktemp /home/node/.android/import.XXXXXX)
    trap 'rm -f -- "$temporary"' EXIT
    cat > "$temporary"
    keytool -list -keystore "$temporary" -storepass android -alias androiddebugkey >/dev/null 2>&1 \
      || { echo 'Expected the existing Android default debug keystore.' >&2; exit 2; }
    install -m 600 "$temporary" "$destination"
    echo 'Existing debug signing identity preserved in the private Android volume.'
    ;;
  build)
    sdk_ready
    target="${2:-emulator}"
    case "$target" in
      emulator) api=http://10.0.2.2:5000; websocket=ws://10.0.2.2:5000/graphql ;;
      usb) api=http://localhost:5000; websocket=ws://localhost:5000/graphql ;;
      *) echo 'Choose emulator or usb.' >&2; exit 2 ;;
    esac
    export REACT_APP_API_URL="$api" REACT_APP_WS_URL="$websocket"
    export REACT_APP_GOOGLE_LOGIN_URI="$api/auth/google/callback"
    export REACT_APP_DOCKER_DEV=true REACT_APP_DEV_INTEGRATIONS=false
    CI=false npm run build
    npx --no-install cap sync android
    printf '%s\n' 'sdk.dir=/opt/android-sdk' > android/local.properties
    # Only this disposable container copy changes; the Git source stays intact.
    node - "$gradle_sha" <<'JS'
const fs = require('node:fs');
const path = 'android/gradle/wrapper/gradle-wrapper.properties';
let text = fs.readFileSync(path, 'utf8');
if (!text.includes('gradle-8.14.3-all.zip')) throw new Error('Unexpected Gradle version');
text = text.replace(/^distributionSha256Sum=.*\r?\n?/gm, '');
fs.writeFileSync(path, text.trimEnd() + '\ndistributionSha256Sum=' + process.argv[2] + '\n');
// Keep the developer's installed application and data separate from this APK.
fs.appendFileSync('android/app/build.gradle', '\nandroid { buildTypes { debug { applicationIdSuffix ".dockerdev" } } }\n');
fs.mkdirSync('android/app/src/debug/res/values', { recursive: true });
fs.writeFileSync('android/app/src/debug/res/values/betik-development.xml',
  '<resources><string name="app_name">Betik Dev</string><string name="title_activity_main">Betik Dev</string></resources>\n');
JS
    (cd android && bash ./gradlew --no-daemon --max-workers=2 \
      -Dorg.gradle.jvmargs=-Xmx2048m assembleDebug bundleRelease)
    mkdir -p "/artifacts/$target"
    apk="/artifacts/$target/betik-debug.apk"
    aab="/artifacts/$target/betik-unsigned.aab"
    cp android/app/build/outputs/apk/debug/app-debug.apk "$apk"
    cp android/app/build/outputs/bundle/release/app-release.aab "$aab"
    "$ANDROID_SDK_ROOT/build-tools/35.0.0/apksigner" verify "$apk"
    if unzip -Z1 "$aab" | grep -Ei '^META-INF/[^/]+\.(RSA|DSA|EC|SF)$' >/dev/null; then
      echo 'Release bundle unexpectedly signed.' >&2; exit 1
    fi
    sha256sum "$apk" "$aab"
    ;;
  *) echo 'Use versions, doctor, setup, import-debug-key, or build emulator|usb.' >&2; exit 2 ;;
esac
