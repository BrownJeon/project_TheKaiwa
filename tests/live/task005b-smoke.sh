#!/usr/bin/env bash
# task-005b 라이브 스모크 — QA 계정 4종(USER·ADMIN·DEVELOPER·SUPER_ADMIN)으로 127.0.0.1 서버의 Admin Console API 를 친다.
# 서버는 따로 띄워 둔다(미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` — 0.0.0.0 바인딩 금지: QA 토큰은 localhost 전제).
# 사용: bash tests/live/task005b-smoke.sh [포트=3011]   (Claude CLI 1회, 약 30초)
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec). 쿠키는 권한 600 임시 파일, 끝나면 지운다.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
CU="$(mktemp)"; CA="$(mktemp)"; CD="$(mktemp)"; CS="$(mktemp)"
trap 'rm -f "$CU" "$CA" "$CD" "$CS"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$CU" >/dev/null
QA_ACCOUNT=admin node --env-file=.env --import tsx tests/live/qa-session.ts "$CA" >/dev/null
QA_ACCOUNT=developer node --env-file=.env --import tsx tests/live/qa-session.ts "$CD" >/dev/null
QA_ACCOUNT=super node --env-file=.env --import tsx tests/live/qa-session.ts "$CS" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task005b-smoke.ts "$CU" "$CA" "$CD" "$CS"
