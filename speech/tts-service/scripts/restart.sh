#!/usr/bin/env bash
# kaiwa-tts 재기동(맥 M4) — .env 의 KAIWA_TTS_* 만 export → 기존 프로세스 종료 폴링 → nohup uvicorn → /health warmedUp 대기.
# macOS 기본 bash 3.2 호환(연관 배열·mapfile 금지). 시크릿 값은 출력하지 않는다.
#
#   scripts/restart.sh                 # .env 의 포트(기본 8200)로 재기동
#   scripts/restart.sh --port 8299     # 임시 포트(스모크·실측용) — .env 포트를 덮어씀
#   scripts/restart.sh --stop          # 종료만
#   scripts/restart.sh --host 127.0.0.1 --wait 300
#   scripts/restart.sh --port 8299 --device cpu   # 장치 덮어쓰기(실측용)
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${KAIWA_TTS_RUN_DIR:-$(cd "$SERVICE_DIR/../.." && pwd)}"
ENV_FILE="${KAIWA_TTS_ENV_FILE:-$RUN_DIR/.env}"
VENV="${KAIWA_TTS_VENV:-$RUN_DIR/.venv}"
PORT_OVERRIDE=""
HOST_OVERRIDE=""
DEVICE_OVERRIDE=""
WAIT_SEC=240
STOP_ONLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT_OVERRIDE="$2"; shift 2 ;;
    --host) HOST_OVERRIDE="$2"; shift 2 ;;
    --device) DEVICE_OVERRIDE="$2"; shift 2 ;;
    --wait) WAIT_SEC="$2"; shift 2 ;;
    --stop) STOP_ONLY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

ts() { date '+%Y-%m-%dT%H:%M:%S'; }
say() { echo "$(ts) [restart] $*"; }

[ -f "$ENV_FILE" ] || { say "env file not found: $ENV_FILE"; exit 2; }
perm="$(stat -f %Lp "$ENV_FILE" 2>/dev/null || stat -c %a "$ENV_FILE")"
[ "$perm" = "600" ] || say "WARN $ENV_FILE permission is $perm (expected 600)"

# 값은 그대로 문자열로 받는다(source 금지 — .env 내용이 셸 코드로 실행되지 않게).
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in
    KAIWA_TTS_*=*)
      key="${line%%=*}"
      val="${line#*=}"
      if [[ "$key" =~ ^KAIWA_TTS_[A-Z0-9_]+$ ]]; then export "$key=$val"; fi
      ;;
  esac
done < "$ENV_FILE"

PORT="${PORT_OVERRIDE:-${KAIWA_TTS_PORT:-8200}}"
HOST="${HOST_OVERRIDE:-${KAIWA_TTS_HOST:-0.0.0.0}}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { say "invalid port"; exit 64; }
export KAIWA_TTS_PORT="$PORT"
if [ -n "$DEVICE_OVERRIDE" ]; then export KAIWA_TTS_DEVICE="$DEVICE_OVERRIDE"; fi
LOG_DIR="${KAIWA_TTS_LOG_DIR:-$HOME/kaiwa-tts-local-logs}"
mkdir -p "$LOG_DIR" && chmod 700 "$LOG_DIR"
PID_FILE="$LOG_DIR/kaiwa-tts-$PORT.pid"
LOG_FILE="$LOG_DIR/tts-service-$PORT.log"
MARK="uvicorn app:app --app-dir $SERVICE_DIR "

our_pids() {
  ps -axo pid=,command= | awk -v mark="$MARK" -v port="$PORT" \
    'index($0, mark) && ($0 ~ ("--port " port "( |$)")) { print $1 }'
}

stop_ours() {
  local pids
  pids="$(our_pids)"
  [ -z "$pids" ] && return 0
  say "stopping pid(s): $(echo $pids | tr '\n' ' ')"
  kill -TERM $pids 2>/dev/null || true
  local i=0
  while [ $i -lt 40 ]; do
    [ -z "$(our_pids)" ] && return 0
    sleep 0.5
    i=$((i + 1))
  done
  pids="$(our_pids)"
  [ -n "$pids" ] && { say "force kill: $pids"; kill -KILL $pids 2>/dev/null || true; sleep 1; }
  return 0
}

stop_ours
rm -f "$PID_FILE"
if [ "$STOP_ONLY" = "1" ]; then say "stopped (port $PORT)"; exit 0; fi

# 우리 프로세스가 아닌 것이 포트를 잡고 있으면 건드리지 않고 중단한다(home-m4-api·Ollama 보호).
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  say "port $PORT is held by another process — abort"
  exit 3
fi

# 20MB 넘은 로그는 한 벌만 보존.
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 20971520 ]; then mv -f "$LOG_FILE" "$LOG_FILE.1"; fi

cd "$SERVICE_DIR"
nohup "$VENV/bin/python" -m uvicorn app:app --app-dir "$SERVICE_DIR" --host "$HOST" --port "$PORT" \
  --no-access-log --no-proxy-headers --timeout-graceful-shutdown 10 >> "$LOG_FILE" 2>&1 < /dev/null &
PID=$!
echo "$PID" > "$PID_FILE"
say "started pid=$PID host=$HOST port=$PORT log=$LOG_FILE"

START=$(date +%s)
while :; do
  if ! kill -0 "$PID" 2>/dev/null; then
    say "process exited during startup — last log lines:"
    tail -n 20 "$LOG_FILE" | sed 's/^/    /'
    exit 1
  fi
  # 공개 /health 는 {status, warmedUp} 만 준다. 장치·모델 수는 로컬에서 시크릿으로 /health/detail 을 부른다
  # (시크릿은 환경 변수로만 넘겨 argv·출력에 싣지 않는다).
  body="$(curl -s -m 3 "http://127.0.0.1:$PORT/health" || true)"
  if [ -n "$body" ]; then
    state="$(printf '%s' "$body" | "$VENV/bin/python" -c 'import json,sys
d=json.load(sys.stdin)
print(d.get("status"), "warm" if d.get("warmedUp") else "cold")' 2>/dev/null || echo "parse-error")"
    case "$state" in
      *" warm")
        detail="$("$VENV/bin/python" -c 'import json,os,urllib.request
req=urllib.request.Request("http://127.0.0.1:%s/health/detail" % os.environ["KAIWA_TTS_PORT"], headers={"X-Internal-Secret": os.environ.get("KAIWA_TTS_INTERNAL_SECRET", "")})
d=json.load(urllib.request.urlopen(req, timeout=3))
print("device=%s fallback=%s models=%s coldStartMs=%s" % (d.get("device"), d.get("deviceFallback"), d.get("modelsLoaded"), d.get("coldStartMs")))' 2>/dev/null || echo "detail-unavailable")"
        say "ready: $state $detail ($(( $(date +%s) - START ))s)"
        exit 0 ;;
      FAILED*|MISCONFIGURED*) say "not healthy: $state"; exit 1 ;;
    esac
  fi
  if [ $(( $(date +%s) - START )) -ge "$WAIT_SEC" ]; then
    say "timeout after ${WAIT_SEC}s waiting for warmedUp (last: ${state:-no response})"
    exit 1
  fi
  sleep 2
done
