#!/usr/bin/env bash
# task-012c 1단계 게이트 라이브 스모크(D-C3·CX-1·CX-3·D-C9) — 격리 복제본의 dev 서버(127.0.0.1)에 친다. LLM 호출 0.
# 사용: bash tests/live/task012c-gate-smoke.sh <포트> [두 번째 포트(같은 코드의 다른 프로세스 — 슬롯 경합)] [dev 서버 로그 파일…]
# 실행 위치: 스크립트가 있는 복제본/미러 루트(NFS noexec 라 NFS 에서는 돌지 않는다). 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# DB: LOCAL connection 3행(whisper·home-m4·gateway)을 잠시 바꾸고 끝에 바이트 원복·대조한다. AuditLog 는 남는다(QA 계정 행).
set -u
PORT="${1:?포트}"
PORT2="${2:-}"
shift; [ $# -gt 0 ] && shift
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CA="$(mktemp)"; CS="$(mktemp)"
trap 'rm -f "$CA" "$CS"; echo "(QA 쿠키 삭제)"' EXIT
QA_ACCOUNT=admin node --env-file=.env --import tsx tests/live/qa-session.ts "$CA" >/dev/null
QA_ACCOUNT=super node --env-file=.env --import tsx tests/live/qa-session.ts "$CS" >/dev/null
BASE="http://127.0.0.1:$PORT" BASE2="${PORT2:+http://127.0.0.1:$PORT2}" node --env-file=.env --import tsx tests/live/task012c-gate-smoke.ts "$CA" "$CS" "$@"
