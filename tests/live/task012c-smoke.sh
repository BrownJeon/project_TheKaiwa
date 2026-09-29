#!/usr/bin/env bash
# task-012c 서버 2단계 라이브 스모크 — 설정 편집(Validate·Diff·Test·Apply·버전·Rollback·Raw·#93·#93a·#93b·#100·#123b·#137)을
# 격리 복제본의 dev 서버 두 프로세스(127.0.0.1)·실제 DB(LOCAL 행만)·M4 TTS·Claude CLI 에 친다.
# 사용: bash tests/live/task012c-smoke.sh <포트> <두 번째 포트(같은 코드의 다른 프로세스 — 경합·전파)> [dev 서버 로그 파일…]
# 실행 위치: 스크립트가 있는 복제본/미러 루트(NFS noexec 라 NFS 에서는 돌지 않는다). 쿠키는 권한 600 임시 파일, 끝나면 지운다.
# 외부 호출: Claude 1회(LLM 후보 기능 테스트 — 두 프로세스 동시 요청 중 1건만) · M4 합성 2회(TTS 연결 후보·미리듣기 문장 후보).
# DB: 시작 전 LOCAL 대상 행(연결 4·Fallback 1·AppSetting 3)을 기록 → 끝에 바이트 원복·대조, 이 실행이 만든 ConfigurationVersion·EngineHealth·
# FUNCTIONAL_TEST Trace 는 id 로 지운다. AuditLog 는 불변이라 남는다(QA 역할 계정 행). PRODUCTION 행은 읽지도 쓰지도 않는다.
set -u
PORT="${1:?포트}"
PORT2="${2:?두 번째 포트}"
shift 2
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CU="$(mktemp)"; CA="$(mktemp)"; CD="$(mktemp)"; CS="$(mktemp)"
trap 'rm -f "$CU" "$CA" "$CD" "$CS"; echo "(QA 쿠키 삭제)"' EXIT
node --env-file=.env --import tsx tests/live/qa-session.ts "$CU" >/dev/null
QA_ACCOUNT=admin node --env-file=.env --import tsx tests/live/qa-session.ts "$CA" >/dev/null
QA_ACCOUNT=developer node --env-file=.env --import tsx tests/live/qa-session.ts "$CD" >/dev/null
QA_ACCOUNT=super node --env-file=.env --import tsx tests/live/qa-session.ts "$CS" >/dev/null
BASE="http://127.0.0.1:$PORT" BASE2="http://127.0.0.1:$PORT2" node --env-file=.env --import tsx tests/live/task012c-smoke.ts "$CU" "$CA" "$CD" "$CS" "$@"
