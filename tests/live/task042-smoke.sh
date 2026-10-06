#!/usr/bin/env bash
# task-042 주제 단어 세트(B2) 라이브 스모크 — QA 계정 3(챌린지 레인) + 계정 2(IDOR). B~D 구간은 A12(LLM) 실호출 2~3회(직렬 슬롯).
# 사용: bash tests/live/task042-smoke.sh [포트=3022] [미러=~/.node-local/thekaiwa-042]   (서버는 그 미러에서 next dev -H 127.0.0.1 -p <포트> 로 따로)
#   ONLY=A           LLM 없는 구간만(다른 LLM 레인과 병렬 가능)
#   OVERLAP=1        B 직전에 오늘 탭(#58)을 불러 A11 DAILY 잡과 겹친 대기를 잰다(그날 첫 진입일 때만 의미)
#   TRACE_DAYS=7     최근 7일 topicWords Trace 의 p50/p95·사유별 건수(참고치)
# 계정 3 은 041·043·044 QA 와 같은 계정 — 동시에 돌리지 않는다(진행 중 세트·챌린지 1개). 하루 시도 상한(3)·생성 중 표시는 서버 메모리라
# 같은 날 다시 돌리려면 dev 서버를 다시 띄운다. 이 실행이 만든 행만 지우고 기존 DAILY·반복 항목은 시작 값으로 되돌린다(topicWords Trace 는 남김).
set -u
PORT="${1:-3022}"
MIRROR="${2:-$HOME/.node-local/thekaiwa-042}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KAIWA_LOCAL_ROOT="$MIRROR" bash "$ROOT/scripts/sync-local.sh"
cd "$MIRROR"
C3="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C3" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts "$C3" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/task042-smoke.ts "$C3" "$C2"
