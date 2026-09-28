#!/usr/bin/env bash
# task-012b 라이브 스모크 — 분석 STT 파이프라인(적재 게이트·claim·실패 백오프·#138·#22·#21a·health·D-B7)과 실제 워커 E2E.
#
# 사용: bash tests/live/task012b-smoke.sh [포트=3017] [단계=ABC]
#   서버는 따로 띄워 둔다 — 미러 하드링크 복제본에서 `APP_ENV=LOCAL node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3017`
#   (0.0.0.0 금지: QA 토큰은 localhost 전제 · 운영 3010 금지). A 단계의 "하트비트 없음" 검사는 새로 띄운 서버에서만 의미가 있다(EXPECT_NO_WORKER=1).
#   워커는 pm2 가 아니라 dev venv(~/.node-local/thekaiwa-speech-dev, WORKER_PY 로 바꿀 수 있음)에서 이 스크립트가 직접 띄우고 끝에 끈다.
#   분석 서비스(127.0.0.1:8090)는 다른 프로젝트와 공용·직렬 — B 단계(20건 + 30초 5건)는 짧게 끝난다.
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec). 쿠키·시크릿은 출력하지 않는다(권한 600 임시 파일, 끝나면 삭제).
set -u
PORT="${1:-3017}"
PHASES="${2:-ABC}"
[ "$PORT" = "3010" ] && { echo "운영 포트(3010)에는 붙지 않는다"; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKER_PY="${WORKER_PY:-$HOME/.node-local/thekaiwa-speech-dev/bin/python}"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"; LOGDIR="$(mktemp -d)"
PIDS=()
stop_workers() { for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill -TERM "$p" 2>/dev/null; done; for p in "${PIDS[@]:-}"; do [ -n "$p" ] && wait "$p" 2>/dev/null; done; PIDS=(); }
trap 'stop_workers; rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제 · 워커 로그 $LOGDIR)"' EXIT
# 주 계정 qa-bot2(쓰기 전부) · 다른 계정 qa-developer(남의 발화 404·다른 사용자 디바운스) — 병렬 QA 라이브의 qa-bot 과 겹치지 않게(Leader 2026-09-29).
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=developer node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null

# 워커 환경 — .env 의 값을 출력 없이 옮긴다(DATABASE_URL 은 넘기지 않는다, D-B1).
eval "$(node --env-file=.env -e 'for (const k of ["SPEECH_INTERNAL_SECRET","DATA_ROOT"]) console.log(`export ${k}=${JSON.stringify(process.env[k] ?? "")}`)')"
start_worker() { # $1 = id, $2 = 분석 서비스 주소(비우면 설정값)
  # exec — 서브셸 PID 가 곧 워커 PID 가 되게(아니면 kill 이 서브셸만 죽이고 워커가 고아로 남는다).
  ( cd "$ROOT/speech/worker" && exec env -i HOME="$HOME" PATH="/usr/bin:/bin" PYTHONPATH=".:../common" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
      APP_ENV=LOCAL APP_INTERNAL_URL="http://127.0.0.1:$PORT" DATA_ROOT="$DATA_ROOT" SPEECH_INTERNAL_SECRET="$SPEECH_INTERNAL_SECRET" \
      SPEECH_CONFIG_PATH="$ROOT/speech/speech.config.yml" SPEECH_WORKER_ID="$1" ${2:+WHISPER_SERVICE_URL="$2"} \
      "$WORKER_PY" main.py > "$LOGDIR/$1.log" 2>&1 ) &
  PIDS+=("$!")
}
run() { BASE="http://127.0.0.1:$PORT" STT_ASSETS="$ROOT/speech/test-assets/stt20" node --env-file=.env --import tsx tests/live/task012b-smoke.ts "$@"; }
RC=0
case "$PHASES" in *A*) EXPECT_NO_WORKER="${EXPECT_NO_WORKER:-0}" run A "$C1" "$C2" || RC=1 ;; esac
case "$PHASES" in *B*)
  start_worker smoke-worker-1; start_worker smoke-worker-2; sleep 6
  run B "$C1" "$C2" || RC=1
  stop_workers ;; esac
case "$PHASES" in *C*)
  start_worker smoke-worker-dead "http://127.0.0.1:9"; sleep 6
  run C "$C1" "$C2" || RC=1
  stop_workers ;; esac
# 로그에 전사 원문이 없어야 한다(길이·지문만) — stt20 문장이 워커 로그에 나오면 실패.
if ls "$LOGDIR"/*.log >/dev/null 2>&1; then
  LEAKS=$(node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).sentences.map(x=>x.text.replace(/[、。？！]/g,""));let n=0;for(const f of fs.readdirSync(process.argv[2])){const t=fs.readFileSync(process.argv[2]+"/"+f,"utf8");for(const x of s)if(x.length>=4&&t.includes(x))n++}console.log(n)' "$ROOT/speech/test-assets/stt20/sentences.json" "$LOGDIR")
  if [ "$LEAKS" = "0" ]; then echo "PASS L1 워커 로그 전사 원문 0"; else echo "FAIL L1 워커 로그 전사 원문 $LEAKS"; RC=1; fi
  grep -hE "job (done|failed)|worker (started|stopped)" "$LOGDIR"/*.log | tail -6
fi
exit $RC
