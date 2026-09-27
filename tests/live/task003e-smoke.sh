#!/usr/bin/env bash
# task-003e 라이브 스모크 — QA 계정(USER 2개·ADMIN)으로 127.0.0.1 서버의 STT API(#19·#20·#21·internal 콜백·30일 정리)와,
# gateway 가 떠 있으면 WS /ws/speech E2E·관리자 gateway Health 까지 친다.
# 서버는 따로 띄워 둔다(미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` — 0.0.0.0 금지: QA 토큰은 localhost 전제).
# 사용: bash tests/live/task003e-smoke.sh [포트=3011]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec). 쿠키는 권한 600 임시 파일, 끝나면 지운다. Node 20 은 WebSocket 에 플래그가 필요하다.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
CU="$(mktemp)"; CU2="$(mktemp)"; CA="$(mktemp)"
trap 'rm -f "$CU" "$CU2" "$CA"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$CU" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$CU2" >/dev/null
QA_ACCOUNT=admin node --env-file=.env --import tsx tests/live/qa-session.ts "$CA" >/dev/null
# speech/test-assets 는 NFS 에만 있다(미러 동기화 대상이 아님) — 절대 경로로 넘긴다.
STT_ASSETS="$ROOT/speech/test-assets/stt20" BASE="http://127.0.0.1:$PORT" node --experimental-websocket --no-warnings --env-file=.env --import tsx tests/live/task003e-smoke.ts "$CU" "$CU2" "$CA"
