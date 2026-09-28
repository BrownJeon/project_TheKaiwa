#!/usr/bin/env bash
# task-010 라이브 스모크 — QA 계정 두 개(IDOR 검증용)로 127.0.0.1 서버를 친다. 서버는 따로 띄워 둔다(예: 미러에서 next dev -p 3011).
# 사용: bash tests/live/task010-smoke.sh [포트=3011] [경합용 두 번째 포트(선택 — 하드링크 복제본에서 띄운 별도 프로세스)]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec) — sync-local 후 거기서 돈다. 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# 실제 A4 2회·A10 1~2회·TTS 합성을 부른다(Claude 구독·M4). QA 두 계정의 레슨 관련 행만 지우고 DAILY 는 시작 전 값으로 되돌린다.
set -u
PORT="${1:-3011}"
PORT2="${2:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" BASE2="${PORT2:+http://127.0.0.1:$PORT2}" node --env-file=.env --import tsx tests/live/task010-smoke.ts "$C1" "$C2"
