#!/usr/bin/env bash
# task-003d 라이브 스모크 — QA 계정(USER·ADMIN)으로 127.0.0.1 서버의 TTS API(#23·#18·tts/status)와 관리자 TTS Health/Functional Test 를 친다.
# 서버는 따로 띄워 둔다(미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` — 0.0.0.0 금지: QA 토큰은 localhost 전제).
# 사용: bash tests/live/task003d-smoke.sh [포트=3011]
#   M4 tts-service 가 떠 있을 때: TTS_SMOKE_EXPECT_M4=1 (+ /g2p 골든 대조는 TTS_SMOKE_G2P_URL=http://<M4>:8200)
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec). 쿠키는 권한 600 임시 파일, 끝나면 지운다.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
CU="$(mktemp)"; CA="$(mktemp)"
trap 'rm -f "$CU" "$CA"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$CU" >/dev/null
QA_ACCOUNT=admin node --env-file=.env --import tsx tests/live/qa-session.ts "$CA" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task003d-smoke.ts "$CU" "$CA"
