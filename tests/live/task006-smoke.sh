#!/usr/bin/env bash
# task-006 라이브 스모크 — QA 계정 두 개(IDOR 검증용)로 127.0.0.1 서버를 친다. 서버는 따로 띄워 둔다(예: 미러에서 next dev -p 3011).
# 사용: bash tests/live/task006-smoke.sh [포트=3011]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec) — sync-local 후 거기서 돈다. 쿠키는 권한 600 임시 파일, 끝나면 지운다.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task006-smoke.ts "$C1" "$C2"
