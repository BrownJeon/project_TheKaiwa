#!/usr/bin/env bash
# 데스크톱 점검: 플러그인 SttSession + silero VAD + zipformer int8 로 stt20 20문장(task-003f 완료 기준 6 보조 증거).
#   bash plugins/sherpa-stt/tools/desktop-check/run.sh [numThreads]
# 필요: scripts/build-apk.sh 를 한 번 돌린 APK 작업 디렉터리(gradle wrapper·플러그인 동기화), speech/models 의 모델(fetch_models.py),
#       speech/test-assets/stt20/*.wav(make_test_audio.py). sherpa-onnx JVM jar 는 GitHub 릴리스에서 sha256 고정으로 받는다.
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
WORK="${THEKAIWA_APK_WORK:-$HOME/.node-local/thekaiwa-apk}"
export JAVA_HOME="${JAVA_HOME_21:-/usr/lib/jvm/java-21-openjdk-amd64}"
V=1.13.8
declare -A SHA=(
  [sherpa-onnx-jvm-$V.jar]=77b7b047fade4eadada96b568eb92615049aaf1dc317c7244e46c1ea38b9a63b
  [sherpa-onnx-native-lib-linux-x64-$V.jar]=30c93b59381113f9c20aedbbf9fc1ad399158f6bc03dddc0f8934a6e28e069ba
)
JARS=()
for f in "${!SHA[@]}"; do
  p="$WORK/.cache/$f"
  [ -f "$p" ] || curl -fsSL --retry 3 -o "$p" "https://github.com/k2-fsa/sherpa-onnx/releases/download/v$V/$f"
  [ "$(sha256sum "$p" | cut -d' ' -f1)" = "${SHA[$f]}" ] || { echo "sha256 불일치: $f" >&2; rm -f "$p"; exit 1; }
  JARS+=("$p")
done
rsync -a --delete --exclude 'build/' --exclude 'node_modules/' --exclude 'libs/' "$PROJECT_ROOT/plugins/" "$WORK/plugins/"
DIR="$WORK/plugins/sherpa-stt/tools/desktop-check"
LOG="$WORK/logs/desktop-check-$(date +%Y%m%d-%H%M%S).log"
"$WORK/android/gradlew" -p "$DIR" --no-daemon -q installDist -PsherpaJvmJars="$(IFS=,; echo "${JARS[*]}")" > "$LOG" 2>&1 || { echo "빌드 실패 — $LOG" >&2; exit 1; }
LC_ALL=C.UTF-8 "$DIR/build/install/sherpa-stt-desktop-check/bin/sherpa-stt-desktop-check" \
  "$PROJECT_ROOT/speech/models/reazonspeech-int8/2024-08-01-int8-v1" "$PROJECT_ROOT/speech/test-assets/stt20" "${1:-2}" 2>&1 \
  | grep -v 'voice-activity-detector.cc\|^VadModelConfig'
