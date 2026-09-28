#!/usr/bin/env bash
# 온디바이스 모델 배포본 점검 — 모델 버전을 올리기 전 게이트(speech/models/README §5). 서버 #9·플러그인과 같은 규칙 + 파일 크기·sha256.
# 사용: bash scripts/models-verify.sh [모델 루트=SPEECH_MODELS_DIR|DATA_ROOT/models] [--package reazonspeech-int8] [--manifest <새 manifest>] [--quick]
# NFS 는 noexec — 미러(~/.node-local/thekaiwa)의 node·tsx 로 NFS 의 스크립트를 읽어 실행한다(소스는 읽기만).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$HOME/.node-local/thekaiwa"
cd "$LOCAL"
exec node --env-file=.env --import tsx "$ROOT/scripts/models-verify.ts" "$@"
