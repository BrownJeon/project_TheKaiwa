#!/usr/bin/env bash
# task-011 라이브 스모크 — QA 계정 두 개(IDOR·단어 부족 검증용)로 127.0.0.1 서버를 친다. 서버는 따로 띄워 둔다(예: 미러에서 next dev -H 127.0.0.1 -p 3015).
# 사용: bash tests/live/task011-smoke.sh [포트=3015]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec) — sync-local 후 거기서 돈다. 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# 실제 A6 2회(WORDS·TALK)·A7 3회(WORDS·TALK 롤백 1·TALK 다시 채점 1)·TTS(M4) 합성. 약 2~4분.
# QA 두 계정의 평가·평가 잡·EVALUATION 기록·스냅샷·SET_LEVEL 제안·평가 발화·이 실행이 만든 단어를 시작과 끝에 비우고, 레벨·오늘 DAILY 는 시작 전 값으로 되돌린다.
set -u
PORT="${1:-3015}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task011-smoke.ts "$C1" "$C2"
