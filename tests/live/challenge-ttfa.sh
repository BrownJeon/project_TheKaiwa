#!/usr/bin/env bash
# task-041 5초 지표 참고치 — 챌린지 없음 → 진행 중, (가) 오늘 탭 진입 직후 · (나) 주제 세트 끝낸 직후 회화 첫 턴 TTFA·턴 p50/p90.
# 사용: bash tests/live/challenge-ttfa.sh [포트=3021] [반복=30] [시나리오=both|ga|na] [미러=~/.node-local/thekaiwa-041]
#   서버는 그 미러에서 `next dev -H 127.0.0.1 -p <포트>` 로 따로. Claude CLI(턴·A11)·M4 TTS 를 쓴다 — **LLM 직렬 슬롯**(계획서 §6)에서만, 혼자 돌린다.
#   QA 계정 3(챌린지 레인) — 042·043·044 QA 와 시간을 나눈다. 00:10~21:30 KST 에 시작한다(실행 중 자정 넘김 방지).
#   (가) 반복은 그날 REVIEW_DECISION AiJob 행을 지우며 돈다 — 이 실행이 만든 것만이 아니라 **QA 계정 3 의 오늘 끝난 REVIEW_DECISION 잡 전부**다.
#   다른 레인(042·043·044 QA·challenge-smoke)과 동시에 돌리지 않는다. 이 실행이 만든 그 밖의 행은 끝에 지운다.
#   운영 포트(3010)는 거부하고 앞 단계(동기화·QA 세션)가 실패하면 멈춘다(set -e).
set -eu
PORT="${1:-3021}"
REPS="${2:-30}"
SCENARIO="${3:-both}"
MIRROR="${4:-$HOME/.node-local/thekaiwa-041}"
if [ "$PORT" = "3010" ]; then echo "운영 포트(3010)에는 붙지 않는다"; exit 2; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KAIWA_LOCAL_ROOT="$MIRROR" bash "$ROOT/scripts/sync-local.sh"
cd "$MIRROR"
C3="$(mktemp)"
trap 'rm -f "$C3"; echo "(QA 쿠키 삭제)"' EXIT
QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts "$C3" >/dev/null
if [ ! -s "$C3" ]; then echo "QA 세션 쿠키를 만들지 못했다 — 중단"; exit 2; fi
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/challenge-ttfa.ts "$C3" "$REPS" "$SCENARIO"
