#!/usr/bin/env bash
# task-012b 완료 기준 8 — 워커 없음 vs 워커 2개 + 분석 부하(30초 발화 연속) 에서 대화 경로 지연 비교(차이 ≤10%).
# 사용: [WORKER_LOAD=1] [WORKERS=1] bash tests/live/task012b-latency.sh [포트=3017] [모드=stt|turn|analysis] [회수=30]
#   stt  = gateway WS MIC_TEST(저장·콜백 없음) 손 뗌 → final — LLM 불필요.  turn = #21 업로드 → #32 턴 SSE(Claude CLI·M4 TTS 사용).
#   turn 모드 워커 단계는 끝에 대화 중 시작된 분석 잡 수(디바운스 — 목표 0)와 마지막 발화 → 분석 완료 p50/max 도 낸다.
#   "워커 없음" 단계는 서버가 최근 120초 안에 claim 을 받지 않았을 때 의미가 있다(turn 모드는 출력의 queued=0 으로 확인).
#   워커는 dev venv 에서 직접 띄우고 끝에 끈다(task012b-smoke.sh 와 같은 방식). 운영 3010 금지.
set -u
PORT="${1:-3017}"; MODE="${2:-stt}"; N="${3:-30}"
[ "$PORT" = "3010" ] && { echo "운영 포트(3010)에는 붙지 않는다"; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER_PY="${WORKER_PY:-$HOME/.node-local/thekaiwa-speech-dev/bin/python}"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; LOGDIR="$(mktemp -d)"; PIDS=()
stop_workers() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill -TERM "$p" 2>/dev/null; done; for p in "${PIDS[@]:-}"; do [ -n "$p" ] && wait "$p" 2>/dev/null; done; PIDS=(); }
trap 'stop_workers; rm -f "$C1"; echo "(QA 쿠키 삭제 · 워커 로그 $LOGDIR)"' EXIT
# 병렬 라이브와 나눠 쓰기(Leader 2026-09-29): 기본 qa-bot2. QA_ACCOUNT 로 바꿀 수 있다.
QA_ACCOUNT="${QA_ACCOUNT:-2}" node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
eval "$(node --env-file=.env -e 'for (const k of ["SPEECH_INTERNAL_SECRET","DATA_ROOT"]) console.log(`export ${k}=${JSON.stringify(process.env[k] ?? "")}`)')"
start_worker() {
  ( cd "$ROOT/speech/worker" && exec env -i HOME="$HOME" PATH="/usr/bin:/bin" PYTHONPATH=".:../common" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
      APP_ENV=LOCAL APP_INTERNAL_URL="http://127.0.0.1:$PORT" DATA_ROOT="$DATA_ROOT" SPEECH_INTERNAL_SECRET="$SPEECH_INTERNAL_SECRET" \
      SPEECH_CONFIG_PATH="$ROOT/speech/speech.config.yml" SPEECH_WORKER_ID="$1" "$WORKER_PY" main.py > "$LOGDIR/$1.log" 2>&1 ) &
  PIDS+=("$!")
}
run() { BASE="http://127.0.0.1:$PORT" STT_ASSETS="$ROOT/speech/test-assets/stt20" node --experimental-websocket --no-warnings --env-file=.env --import tsx tests/live/task012b-latency.ts "$MODE" "$C1" "$N" "$@"; }
[ "$MODE" = "analysis" ] || run "no-worker"   # analysis 모드는 워커 단계만
# 운영 권장값 = 워커 1개(전사가 CPU 코어를 다 쓴다 — Leader 2026-09-29). WORKERS 로 바꿀 수 있다.
for i in $(seq 1 "${WORKERS:-1}"); do start_worker "lat-worker-$i"; done; sleep 6
# WORKER_LOAD=1 이면 워커 단계에서 30초 발화를 계속 올려 분석 큐를 비우지 않는다(업로드 자체의 DB·NFS 쓰기도 더해지므로 "워커 영향"과 섞인다).
if [ "${WORKER_LOAD:-0}" = "1" ]; then LOAD=1 run "worker+load"; else run "worker"; fi
stop_workers
echo "분석 처리 건수: $(cat "$LOGDIR"/*.log 2>/dev/null | grep -c "job done")"
