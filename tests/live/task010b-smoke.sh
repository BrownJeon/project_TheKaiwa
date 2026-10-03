#!/usr/bin/env bash
# task-010b 라이브 스모크 — QA 계정 두 개(IDOR·가드·건너뛰기 검증용)로 127.0.0.1 서버를 친다. 서버는 따로 띄워 둔다(예: 미러에서 next dev -H 127.0.0.1 -p 3011).
# 사용: bash tests/live/task010b-smoke.sh [포트=3011]   ·   운영: SMOKE_ENV=PRODUCTION bash tests/live/task010b-smoke.sh 3010
# 실행 위치는 우분투 미러(기본 ~/.node-local/thekaiwa, NFS noexec — sync-local 후 거기서 돈다). KAIWA_MIRROR 를 주면 그 미러에서 sync 없이 돈다.
# 쿠키는 권한 600 임시 파일, 끝나면 지운다. 실제 A11 3회·A5 1회·A3 1회(Claude 구독), 약 3~5분.
# 이 실행이 만든 QA 행만 지우고(시작 때 찍은 id 집합과의 차이) 손댄 기존 반복 항목·오류 통계·DAILY 는 시작 전 값으로 되돌린다.
# 오늘 이미 QA1 복습 일정·판단 잡이 있으면(다른 실행과 겹침) 아무것도 쓰지 않고 2 로 끝난다.
set -u
PORT="${1:-}"
if [ -z "$PORT" ]; then if [ "${SMOKE_ENV:-}" = "PRODUCTION" ]; then PORT=3010; else PORT=3011; fi; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -n "${KAIWA_MIRROR:-}" ]; then
  cd "$KAIWA_MIRROR"
else
  bash "$ROOT/scripts/sync-local.sh"
  cd "$HOME/.node-local/thekaiwa"
fi
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task010b-smoke.ts "$C1" "$C2"
