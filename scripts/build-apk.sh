#!/usr/bin/env bash
# TheKaiwa APK 빌드 — task-003f F5 (설계안 §12 · plugins/sherpa-stt/README §8).
#
#   bash scripts/build-apk.sh              # release APK(디버그 키 서명·debuggable=false) → 검사 → 경로·sha256 출력
#   bash scripts/build-apk.sh --test       # + 플러그인 JVM 단위 테스트(:thekaiwa-sherpa-stt:testDebugUnitTest)
#   bash scripts/build-apk.sh --publish    # + DATA_ROOT/releases/thekaiwa-<versionName>.apk 로 복사(deployer 전용)
#
# ── 어디서 도는가 ────────────────────────────────────────────────────────────
# NFS 는 noexec 라 npm·Capacitor CLI·gradle 은 로컬 디스크에서만 돈다. 운영 앱이 실행 중인 미러(~/.node-local/thekaiwa,
# pm2 `thekaiwa` 의 cwd)의 node_modules 를 건드리지 않도록 **APK 전용 작업 디렉터리**(기본 ~/.node-local/thekaiwa-apk)를
# 따로 쓴다 — 여기에는 Capacitor 패키지와 플러그인만 설치한다. 편집 대상은 언제나 NFS 쪽(android/·plugins/·capacitor.config.ts·
# public/app-shell)이고 이 스크립트가 매번 작업 디렉터리로 동기화한다.
#
# ── 지키는 것 ────────────────────────────────────────────────────────────────
# - gradle·cap 출력은 **로그 파일로만**(파이프로 자르면 SIGPIPE 로 빌드가 죽는다 — TheMeal 실측). 판정은 종료 코드.
# - JDK 21(@capacitor/android 7 요구) · ANDROID_HOME=~/.node-local/android-sdk.
# - sherpa-onnx AAR 은 GitHub 릴리스 공식 파일을 **버전·sha256 고정**으로 받는다(저장소 커밋 금지, 50MB).
# - 배포본은 release 만: `aapt2` 로 debuggable 이 없음을, `apksigner` 로 서명을 확인하고 어긋나면 실패(task-003f C1-2).
# - APK·키스토어는 저장소 밖(작업 디렉터리/DATA_ROOT)에만 둔다.
# - AppRelease 행(versionCode·sha256·minSupported)은 이 스크립트가 넣지 않는다 — deployer 가 --publish 출력값으로 넣는다.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${THEKAIWA_APK_WORK:-$HOME/.node-local/thekaiwa-apk}"
export JAVA_HOME="${JAVA_HOME_21:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.node-local/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.0"

SHERPA_VERSION="1.13.8"
SHERPA_SHA256="633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96"
SHERPA_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_VERSION}/sherpa-onnx-${SHERPA_VERSION}.aar"

RUN_TESTS=0
PUBLISH=0
for arg in "$@"; do
  case "$arg" in
    --test) RUN_TESTS=1 ;;
    --publish) PUBLISH=1 ;;
    *) echo "[build-apk] 알 수 없는 인자: $arg" >&2; exit 2 ;;
  esac
done

LOG_DIR="$WORK/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WORK/.cache" "$LOG_DIR" "$WORK/out"
log() { echo "[build-apk] $*"; }

# ── 1. NFS → 작업 디렉터리 동기화 ─────────────────────────────────────────────
# android/: 산출물(build·.gradle)·기계별 값(local.properties)·cap sync 생성물은 지우지도 덮지도 않는다(--exclude 는 보호도 겸한다).
rsync -a --delete \
  --exclude 'build/' --exclude '.gradle/' --exclude 'local.properties' --exclude '.idea/' \
  --exclude 'capacitor-cordova-android-plugins/' \
  --exclude 'app/src/main/assets/' \
  --exclude 'app/src/main/res/xml/config.xml' \
  --exclude '*.keystore' --exclude '*.jks' \
  "$PROJECT_ROOT/android/" "$WORK/android/"
rsync -a --delete --exclude 'build/' --exclude 'node_modules/' --exclude 'libs/' \
  "$PROJECT_ROOT/plugins/" "$WORK/plugins/"
mkdir -p "$WORK/public"
rsync -a --delete "$PROJECT_ROOT/public/app-shell/" "$WORK/public/app-shell/"
cp "$PROJECT_ROOT/capacitor.config.ts" "$WORK/capacitor.config.ts"

# package.json: 루트의 @capacitor/*·@thekaiwa/* 와 TypeScript(capacitor.config.ts 로드용)만 같은 버전 범위로 옮긴다.
node - "$PROJECT_ROOT/package.json" "$WORK/package.json" <<'NODE'
const fs = require('fs')
const [src, dst] = process.argv.slice(2)
const root = JSON.parse(fs.readFileSync(src, 'utf8'))
const pick = (deps = {}, keep) => Object.fromEntries(Object.entries(deps).filter(([k]) => keep(k)))
const cap = (k) => k.startsWith('@capacitor/') || k.startsWith('@thekaiwa/')
const pkg = {
  name: 'thekaiwa-apk-workspace',
  private: true,
  description: 'scripts/build-apk.sh 가 만든다 — 직접 고치지 않는다',
  dependencies: pick(root.dependencies, cap),
  devDependencies: { ...pick(root.devDependencies, cap), typescript: (root.devDependencies || {}).typescript || '^5' },
}
const next = JSON.stringify(pkg, null, 2) + '\n'
if (!fs.existsSync(dst) || fs.readFileSync(dst, 'utf8') !== next) fs.writeFileSync(dst, next)
NODE
if ! grep -q '"@thekaiwa/sherpa-stt"' "$WORK/package.json"; then
  log "루트 package.json 에 @thekaiwa/sherpa-stt 의존이 없다 — 플러그인이 APK 에 빠진다"
  exit 1
fi
# 작업 디렉터리에서는 로컬 플러그인을 심볼릭 링크로 둔다(수정이 바로 반영) — 로컬 디스크라 noexec 문제가 없다.
echo "install-links=false" > "$WORK/.npmrc"

cd "$WORK"
PKG_HASH="$(sha256sum package.json | cut -d' ' -f1)"
if [ ! -d node_modules/@capacitor/cli ] || [ ! -e node_modules/@thekaiwa/sherpa-stt ] || [ "$(cat .pkg-hash 2>/dev/null || true)" != "$PKG_HASH" ]; then
  log "npm install → $LOG_DIR/npm-$STAMP.log"
  npm install --no-audit --no-fund > "$LOG_DIR/npm-$STAMP.log" 2>&1
  echo "$PKG_HASH" > .pkg-hash
fi

# ── 2. sherpa-onnx AAR (버전·sha256 고정) ──────────────────────────────────────
AAR="$WORK/.cache/sherpa-onnx-${SHERPA_VERSION}.aar"
if [ ! -f "$AAR" ] || [ "$(sha256sum "$AAR" | cut -d' ' -f1)" != "$SHERPA_SHA256" ]; then
  log "sherpa-onnx ${SHERPA_VERSION} AAR 받기(≈50MB)"
  curl -fsSL --retry 3 -o "$AAR.part" "$SHERPA_URL"
  mv "$AAR.part" "$AAR"
fi
GOT="$(sha256sum "$AAR" | cut -d' ' -f1)"
if [ "$GOT" != "$SHERPA_SHA256" ]; then
  rm -f "$AAR"
  log "AAR sha256 불일치: $GOT (기대 $SHERPA_SHA256) — 폐기"
  exit 1
fi

# ── 3. cap sync ─────────────────────────────────────────────────────────────
if [ ! -f android/local.properties ]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi
log "npx cap sync android → $LOG_DIR/cap-sync-$STAMP.log"
set +e
npx cap sync android > "$LOG_DIR/cap-sync-$STAMP.log" 2>&1
RC=$?
set -e
if [ "$RC" -ne 0 ]; then
  log "cap sync 실패 rc=$RC — 로그: $LOG_DIR/cap-sync-$STAMP.log"
  exit "$RC"
fi
if ! grep -q 'SherpaSttPlugin' android/app/src/main/assets/capacitor.plugins.json; then
  log "capacitor.plugins.json 에 SherpaSttPlugin 이 없다 — 로그: $LOG_DIR/cap-sync-$STAMP.log"
  exit 1
fi

# ── 4. gradle ────────────────────────────────────────────────────────────────
cd "$WORK/android"
TASKS=(":app:assembleRelease")
if [ "$RUN_TESTS" -eq 1 ]; then
  TASKS=(":thekaiwa-sherpa-stt:testDebugUnitTest" "${TASKS[@]}")
fi
log "gradlew ${TASKS[*]} → $LOG_DIR/gradle-$STAMP.log (JAVA_HOME=$JAVA_HOME)"
set +e
./gradlew "${TASKS[@]}" --no-daemon -PsherpaOnnxAar="$AAR" > "$LOG_DIR/gradle-$STAMP.log" 2>&1
RC=$?
set -e
if [ "$RC" -ne 0 ]; then
  log "gradle 실패 rc=$RC — 로그: $LOG_DIR/gradle-$STAMP.log"
  exit "$RC"
fi
if [ "$RUN_TESTS" -eq 1 ]; then
  RESULTS="$WORK/plugins/sherpa-stt/android/build/test-results/testDebugUnitTest"
  log "플러그인 단위 테스트: $(grep -ho 'tests="[0-9]*"' "$RESULTS"/*.xml | tr -dc '0-9\n' | paste -sd+ | bc)개 통과 ($RESULTS)"
fi

# ── 5. 검사 ──────────────────────────────────────────────────────────────────
APK="$WORK/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || { log "빌드는 성공했는데 APK 가 없다: $APK"; exit 1; }
BADGING="$("$BUILD_TOOLS/aapt2" dump badging "$APK")"
if grep -q 'application-debuggable' <<<"$BADGING"; then
  log "debuggable APK — 배포 금지(task-003f C1-2)"
  exit 1
fi
if "$BUILD_TOOLS/aapt2" dump xmltree --file AndroidManifest.xml "$APK" | grep -q 'android:debuggable.*=(type 0x12)0xffffffff'; then
  log "manifest 에 android:debuggable=true — 배포 금지"
  exit 1
fi
VERSION_CODE="$(sed -n "s/^package: .*versionCode='\([0-9]*\)'.*/\1/p" <<<"$BADGING")"
VERSION_NAME="$(sed -n "s/^package: .*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING")"
NATIVE="$(sed -n "s/^native-code: //p" <<<"$BADGING")"
CERTS="$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK")"
CERT_SHA="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<<"$CERTS")"
[ -n "$CERT_SHA" ] || { log "서명 확인 실패"; exit 1; }
APK_SHA="$(sha256sum "$APK" | cut -d' ' -f1)"
APK_BYTES="$(stat -c %s "$APK")"
OUT="$WORK/out/thekaiwa-${VERSION_NAME}-${VERSION_CODE}.apk"
cp "$APK" "$OUT"

log "APK        : $OUT"
log "versionCode: $VERSION_CODE  versionName: $VERSION_NAME  abi: $NATIVE"
log "size       : $APK_BYTES bytes"
log "sha256     : $APK_SHA"
log "signer     : SHA-256 $CERT_SHA"
log "debuggable : no"

# ── 6. 배포본(선택, deployer) ────────────────────────────────────────────────
if [ "$PUBLISH" -eq 1 ]; then
  DATA_ROOT="$(sed -n 's/^DATA_ROOT=//p' "$PROJECT_ROOT/.env" | tr -d '"' | tail -1)"
  [ -n "$DATA_ROOT" ] || { log ".env 에 DATA_ROOT 가 없다"; exit 1; }
  REL_DIR="$DATA_ROOT/releases"
  DEST="$REL_DIR/thekaiwa-${VERSION_NAME}.apk"
  mkdir -p "$REL_DIR"
  if [ -f "$DEST" ] && [ "$(sha256sum "$DEST" | cut -d' ' -f1)" != "$APK_SHA" ]; then
    log "이미 다른 내용의 $DEST 가 있다 — 같은 versionName 을 덮어쓰지 않는다(versionCode·versionName 을 올릴 것)"
    exit 1
  fi
  cp "$APK" "$DEST.tmp" && mv "$DEST.tmp" "$DEST"
  log "publish    : $DEST"
  log "AppRelease : versionCode=$VERSION_CODE versionName=$VERSION_NAME apkPath=thekaiwa-${VERSION_NAME}.apk(파일 이름만 — infra/appRelease releaseFilePath) sha256=$APK_SHA (행은 deployer 가 넣는다)"
fi
