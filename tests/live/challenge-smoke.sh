#!/usr/bin/env bash
# task-041 챌린지 서버 코어 라이브 스모크 — QA 계정 3(챌린지 레인) + 계정 2(IDOR). LLM·TTS 호출 없음.
# 사용: bash tests/live/challenge-smoke.sh [포트=3021] [미러=~/.node-local/thekaiwa-041]   (서버는 그 미러에서 next dev -H 127.0.0.1 -p <포트> 로 따로)
# 계정 3 은 042·043·044 QA 와 같은 계정이다 — 동시에 돌리지 않는다(진행 중 챌린지 1개·풀던 세트 409). 00:05~23:50 KST 에 실행.
# 이 실행이 만든 행만 지운다. 중단으로 남은 행은 `node --env-file=.env --import tsx tests/live/challenge-cleanup.ts`.
# 공유 DB 에 직접 쓰는 도구라 운영 포트(3010)는 거부하고, 앞 단계(동기화·QA 세션)가 실패하면 멈춘다(set -e). PRODUCTION·QA 계정 규칙은 .ts 가 확인.
set -eu
PORT="${1:-3021}"
MIRROR="${2:-$HOME/.node-local/thekaiwa-041}"
if [ "$PORT" = "3010" ]; then echo "운영 포트(3010)에는 붙지 않는다"; exit 2; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KAIWA_LOCAL_ROOT="$MIRROR" bash "$ROOT/scripts/sync-local.sh"
cd "$MIRROR"
C3="$(mktemp)"; C2="$(mktemp)"
trap 'rm -f "$C3" "$C2"; echo "(QA 쿠키 삭제)"' EXIT
QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts "$C3" >/dev/null
QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts "$C2" >/dev/null
if [ ! -s "$C3" ] || [ ! -s "$C2" ]; then echo "QA 세션 쿠키를 만들지 못했다 — 중단"; exit 2; fi
BASE="http://127.0.0.1:$PORT" node --env-file=.env --import tsx tests/live/challenge-smoke.ts "$C3" "$C2"
