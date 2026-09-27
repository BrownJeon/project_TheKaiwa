#!/usr/bin/env bash
# task-007 라이브 스모크(서버) — QA 계정 두 개로 127.0.0.1 dev 서버의 음성 회화 턴(SSE audio)·#24 서명 URL·utteranceId·#21b·#29·계측을 친다.
# 서버는 따로 띄워 둔다(미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` — 0.0.0.0 금지: QA 토큰은 localhost 전제).
# 사용: DEV_PID=<dev 서버 pid(선택, 예열 프로세스 수 검사)> bash tests/live/task007-smoke.sh [포트=3011]
# 실행 위치는 우분투 미러(~/.node-local/thekaiwa, NFS noexec). 쿠키는 권한 600 임시 파일, 끝나면 지운다. Claude CLI 약 8회·M4 TTS 사용.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
C1="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C1" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$C1" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task007-smoke.ts "$C1" "$C2"
