#!/usr/bin/env bash
# task-003f 라이브 스모크(서버) — /models/*(#9·#10)·#19 앱/웹·/api/app/version(#8)·/app/download·PKCE 교환(#2·#5).
# 서버는 따로 띄워 둔다(미러에서, 0.0.0.0 금지 — QA 토큰은 localhost 전제):
#   cd ~/.node-local/thekaiwa && SPEECH_MODELS_DIR=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa/speech/models \
#     node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011
# (배포 위치 DATA_ROOT/models 가 아직 없어 저장소 사본을 가리킨다 — 공유 DATA_ROOT 에 쓰지 않는다.)
# 사용: bash tests/live/task003f-smoke.sh [포트=3011]. 쿠키는 권한 600 임시 파일, 끝나면 지운다. 모델 파일 ≈170MB 를 localhost 로 받는다.
set -u
PORT="${1:-3011}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
bash "$ROOT/scripts/sync-local.sh"
cd "$HOME/.node-local/thekaiwa"
CU="$(mktemp)"
trap 'rm -f "$CU"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$CU" >/dev/null
BASE="http://127.0.0.1:$PORT" node --no-warnings --env-file=.env --import tsx tests/live/task003f-smoke.ts "$CU"
