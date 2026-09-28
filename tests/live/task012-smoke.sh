#!/usr/bin/env bash
# task-012 라이브 스모크 — QA 계정 두 개(IDOR 검증용)로 127.0.0.1 서버를 친다. 서버는 따로 띄워 둔다(예: 미러 또는 하드링크 복제본에서 next dev -p 3013).
# 사용: bash tests/live/task012-smoke.sh [포트=3013]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec) — sync-local 후 거기서 돈다. 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# LLM·TTS 호출 없음. 이 실행이 만든 QA 행(2024-01~03 격리 달·표식 행·오늘 세트)만 지우고 오늘 DAILY 는 시작 전 값으로 되돌린다.
set -u
PORT="${1:-3013}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task012-smoke.ts "$C1" "$C2"
