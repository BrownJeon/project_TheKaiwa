#!/usr/bin/env bash
# kaiwa-tts 배포(우분투에서 실행, 사용자 승인 후) — M4 는 Gitea 에서 pull 할 수 없으므로(키체인 인증) 우분투가 밀어 넣는다.
#   1) 우분투: git push <M4>:kaiwa-tts-run <sha>:refs/remotes/origin/main   (체크아웃 브랜치는 건드리지 않음)
#   2) M4: .deploy.lock 획득 → 추적 파일 변경 없음 확인 → git merge --ff-only <sha>
#   3) M4: scripts/check_pins.py(설치본 = requirements.txt 핀) → scripts/restart.sh(warmedUp 대기) → scripts/smoke.py
#   4) 2~3 중 하나라도 실패하면 직전 SHA 로 git reset --hard + restart.sh 로 롤백, exit 1
#
#   speech/tts-service/scripts/deploy-from-ubuntu.sh            # 현재 HEAD
#   speech/tts-service/scripts/deploy-from-ubuntu.sh origin/main
# env: KAIWA_TTS_M4(기본 brownjeon@192.168.219.100) · KAIWA_TTS_REMOTE_DIR(기본 kaiwa-tts-run, M4 홈 기준)
set -euo pipefail

M4="${KAIWA_TTS_M4:-brownjeon@192.168.219.100}"
REMOTE_DIR="${KAIWA_TTS_REMOTE_DIR:-kaiwa-tts-run}"
REF="${1:-HEAD}"
[[ "$REMOTE_DIR" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo "invalid KAIWA_TTS_REMOTE_DIR" >&2; exit 64; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
git_() { git -c safe.directory="$REPO_ROOT" -C "$REPO_ROOT" "$@"; }
SHA="$(git_ rev-parse --verify "$REF^{commit}")"
echo "[deploy] $SHA ($(git_ log -1 --format=%s "$SHA" | cut -c1-80)) → $M4:~/$REMOTE_DIR"

git_ push "$M4:$REMOTE_DIR" "+$SHA:refs/remotes/origin/main"

ssh -o BatchMode=yes "$M4" /bin/bash -s -- "$REMOTE_DIR" "$SHA" <<'REMOTE'
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
RUN_DIR="$HOME/$1"
SHA="$2"
SERVICE_DIR="$RUN_DIR/speech/tts-service"
PY="$RUN_DIR/.venv/bin/python"
LOCK_DIR="$RUN_DIR/.deploy.lock"
cd "$RUN_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then echo "[m4] deploy lock busy ($LOCK_DIR) — abort"; exit 2; fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "[m4] tracked files modified on M4 — abort (inspect with: git -C $RUN_DIR status)"; exit 3
fi
PREV="$(git rev-parse HEAD)"
echo "[m4] prev=$PREV"

RESTART="$SERVICE_DIR/scripts/restart.sh"
rollback() {
  echo "[m4] ROLLBACK → $PREV"
  # 새 버전 프로세스가 떠 있을 수 있다 — 코드를 되돌리기 전에 새 스크립트로 먼저 내린다.
  if [ -f "$RESTART" ]; then /bin/bash "$RESTART" --stop || true; fi
  git reset --hard "$PREV" >/dev/null
  if [ -f "$RESTART" ]; then
    /bin/bash "$RESTART" || echo "[m4] restart after rollback FAILED — manual check needed"
  else
    echo "[m4] previous revision has no tts-service — left stopped"
  fi
  exit 1
}

git merge --ff-only "$SHA" || { echo "[m4] not a fast-forward from $PREV — abort (no change)"; exit 4; }
"$PY" "$SERVICE_DIR/scripts/check_pins.py" "$SERVICE_DIR/requirements.txt" || rollback
/bin/bash "$RESTART" || rollback
"$PY" "$SERVICE_DIR/scripts/smoke.py" --url "http://127.0.0.1:$(grep -E '^KAIWA_TTS_PORT=' "$RUN_DIR/.env" | tail -n 1 | cut -d= -f2 || echo 8200)" --env-file "$RUN_DIR/.env" || rollback
echo "[m4] deployed $(git rev-parse --short HEAD)"
REMOTE
