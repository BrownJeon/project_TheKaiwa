#!/usr/bin/env bash
# task-007 지연 실측 — gateway WS(운영 127.0.0.1:8100) + dev 서버 턴 SSE + M4 TTS, stt20 테스트 음성 N턴(기본 30).
# 사용: bash tests/live/task007-latency.sh [포트=3011] [턴 수=30]  (서버는 미러에서 next dev -H 127.0.0.1 -p 3011 로 따로)
# Node 20 은 WebSocket 에 플래그가 필요하다. speech/test-assets 는 NFS 에만 있다 — 절대 경로로 넘긴다.
set -u
PORT="${1:-3011}"
TURNS="${2:-30}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"
trap 'rm -f "$C1"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
STT_ASSETS="$ROOT/speech/test-assets/stt20" BASE="http://127.0.0.1:$PORT" node --experimental-websocket --no-warnings --env-file=.env --import tsx tests/live/task007-latency.ts "$C1" "$TURNS"
