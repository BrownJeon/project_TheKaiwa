#!/usr/bin/env bash
# kaiwa-tts 워치독(맥 M4 crontab 매분) — /health 가 응답하지 않거나 503(STUCK)이면 restart.sh.
#   * * * * * ~/kaiwa-tts-run/speech/tts-service/scripts/kaiwa-tts-watchdog.sh >> ~/kaiwa-tts-local-logs/watchdog.log 2>&1
# 배포(deploy-from-ubuntu.sh)와는 $RUN_DIR/.deploy.lock(mkdir 락)으로 조율한다 — 락이 있으면 건너뛰고,
# 재기동하는 동안은 워치독이 락을 잡는다. 15분 넘은 락은 죽은 배포의 잔재로 보고 치운다.
# 일부러 멈춰 둘 때는 `touch ~/kaiwa-tts-run/.watchdog-off`(지우면 다시 감시).
# 200 이면 status 가 LOADING·DEGRADED·FAILED 여도 재기동하지 않는다(기동 중·모델 문제는 재기동으로 안 풀림 → 재기동 루프 방지).
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${KAIWA_TTS_RUN_DIR:-$(cd "$SERVICE_DIR/../.." && pwd)}"
ENV_FILE="${KAIWA_TTS_ENV_FILE:-$RUN_DIR/.env}"
LOCK_DIR="$RUN_DIR/.deploy.lock"
STALE_SEC=900

ts() { date '+%Y-%m-%dT%H:%M:%S'; }

[ -e "$RUN_DIR/.watchdog-off" ] && exit 0

PORT="$(grep -E '^KAIWA_TTS_PORT=[0-9]+$' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2)"
PORT="${PORT:-8200}"

if [ -d "$LOCK_DIR" ]; then
  mtime="$(stat -f %m "$LOCK_DIR" 2>/dev/null || stat -c %Y "$LOCK_DIR")"
  age=$(( $(date +%s) - mtime ))
  if [ "$age" -lt "$STALE_SEC" ]; then
    exit 0
  fi
  echo "$(ts) [watchdog] stale lock (${age}s) — removing"
  rmdir "$LOCK_DIR" 2>/dev/null || rm -rf "$LOCK_DIR"
fi

probe() { curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:$PORT/health" 2>/dev/null || true; }

code="$(probe)"
[ "$code" = "200" ] && exit 0
sleep 5
code2="$(probe)"
[ "$code2" = "200" ] && exit 0

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "$(ts) [watchdog] health=$code/$code2 but lock busy — skip"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

echo "$(ts) [watchdog] health=$code/$code2 → restart"
if "$SERVICE_DIR/scripts/restart.sh"; then
  echo "$(ts) [watchdog] restart ok"
else
  echo "$(ts) [watchdog] restart FAILED (rc=$?)"
fi
