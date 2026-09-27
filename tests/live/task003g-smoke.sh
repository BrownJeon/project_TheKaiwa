#!/usr/bin/env bash
# task-003g 라이브 스모크 — 발음 사전 관리 API(/api/admin/v1/lexicon*)를 127.0.0.1 서버·실제 DB·M4 TTS 로 친다.
# 서버는 따로 띄워 둔다(미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` — 0.0.0.0 바인딩 금지: QA 토큰은 localhost 전제).
# 사용: bash tests/live/task003g-smoke.sh [포트=3011]   (M4: #23 합성 3회·미리듣기 소리 2회·읽기 확인 약 12회, 1분 안팎)
# 운영 pm2 가 APP_ENV=LOCAL 이라 LOCAL 사전 = 실사용자 발음이다 — 스모크는 QA 계정 USER 범위·가짜 표기만 쓰고, 끝에 사전 항목·버전을
# 시작 전 상태로 되돌린다(AuditLog 는 불변이라 QA 계정 행으로 남는다). 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# 다시 돌릴 때는 30초 이상 기다린다 — 서버 프로세스의 ACTIVE 사전 메모리 캐시(30초)가 원복 전 버전 번호를 들고 있으면 4a 가 어긋난다.
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
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task003g-smoke.ts "$CU" "$CA" "$CD" "$CS"
