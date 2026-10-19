#!/usr/bin/env bash
# 에이전트 전용 미러 생성 — ISS-0009. `cp -al <메인 미러> <새 미러>` 통째 복제 대신 쓴다.
#
# 사용법:
#   bash scripts/make-mirror.sh <이름> [--base <기준 미러>] [--copy-node-modules]
#     → ~/.node-local/thekaiwa-<이름> 을 만든다. 이름은 소문자·숫자·하이픈(41자 이하).
#     --base               node_modules 를 가져올 미러(기본 ~/.node-local/thekaiwa)
#     --copy-node-modules  node_modules 를 하드링크하지 않고 통째로 복사한다(2GB 이상, 느림) —
#                          그 미러에서 `npm install` 처럼 node_modules 를 바꿔야 할 때만.
#   만든 뒤 쓰는 법:  KAIWA_LOCAL_ROOT=~/.node-local/thekaiwa-<이름> bash scripts/sync-local.sh
#                     cd ~/.node-local/thekaiwa-<이름> && node node_modules/typescript/bin/tsc --noEmit  등
#
# 왜 이렇게 만드나(ISS-0009 — task-072 .next 오염, task-074 시험 파일 오염):
#   · `cp -al` 은 모든 파일이 원본 미러와 같은 inode 를 공유한다. 거기에 `cp`·`>`·`prisma generate` 로 제자리에
#     쓰면 같은 inode 를 가진 다른 미러(다른 작업의 미러·메인 미러)가 함께 바뀐다.
#   · 그래서 node_modules 만 하드링크한다(2GB 가 넘고 읽기 전용으로만 쓰인다). 단 도구가 제자리에서 쓰는 두 곳 —
#     node_modules/.prisma(스키마가 바뀌면 `prisma generate` 가 client/schema.prisma 를 제자리에서 쓴다)와
#     node_modules/.cache — 은 실제 복사본으로 만든다(2026-10-19 실험).
#   · 소스·시험·설정·.claude·android·plugins 는 sync-local.sh 가 rsync/safe_put 으로 새 inode 로 채운다.
#     `.next` 는 만들지 않는다(next build 가 새로 만든다 — 하드링크 .next 를 쓰면 CSS 바이트가 오염돼 빌드가 깨졌다).
#
# 주의: 하드링크 node_modules 가 있는 미러에서 `npm install`·`npm ci` 를 돌리지 마라(.package-lock.json 등을 제자리에서 쓴다).
#       의존성을 바꿔야 하면 --copy-node-modules 로 만든 미러에서 한다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_LOCAL="${KAIWA_NODE_LOCAL:-$HOME/.node-local}"   # 시험에서만 바꾼다
BASE="$NODE_LOCAL/thekaiwa"
COPY_MODULES=0
NAME=""

usage() { sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --base) [ $# -ge 2 ] || { usage >&2; exit 2; }; BASE="$2"; shift 2 ;;
    --copy-node-modules) COPY_MODULES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "알 수 없는 옵션: $1" >&2; usage >&2; exit 2 ;;
    *) [ -z "$NAME" ] || { echo "이름은 하나만 준다" >&2; exit 2; }; NAME="$1"; shift ;;
  esac
done

[ -n "$NAME" ] || { usage >&2; exit 2; }
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]]; then
  echo "이름은 소문자·숫자·하이픈만, 41자 이하: $NAME" >&2
  exit 2
fi

DEST="$NODE_LOCAL/thekaiwa-$NAME"
[ -d "$BASE/node_modules" ] || { echo "기준 미러에 node_modules 가 없다: $BASE" >&2; exit 2; }
[ ! -e "$DEST" ] || { echo "이미 있다(덮어쓰지 않는다): $DEST" >&2; exit 1; }
case "$DEST" in "$NODE_LOCAL"/thekaiwa-?*) ;; *) echo "대상 경로가 이상하다: $DEST" >&2; exit 1 ;; esac

# shellcheck source=lib/safe-put.sh
. "$ROOT/scripts/lib/safe-put.sh"

trap 'rc=$?; if [ "$rc" -ne 0 ]; then echo "실패(종료 $rc) — 부분 생성된 $DEST 는 확인 후 지우고 다시 만드세요" >&2; fi' EXIT

mkdir "$DEST"

# 1) node_modules — 하드링크(기본) 또는 통째 복사. 하드링크일 때 제자리 쓰기가 일어나는 두 곳은 실제 복사본으로 바꾼다.
if [ "$COPY_MODULES" = 1 ]; then
  cp -a "$BASE/node_modules" "$DEST/node_modules"
  MODULES_MODE="copy"
else
  cp -al "$BASE/node_modules" "$DEST/node_modules"
  for d in .prisma .cache; do
    if [ -e "$BASE/node_modules/$d" ]; then
      # DEST 안의 링크만 지운다 — 기준 미러의 파일은 링크 수만 줄 뿐 그대로다.
      rm -rf "${DEST:?}/node_modules/$d"
      cp -a "$BASE/node_modules/$d" "$DEST/node_modules/$d"
    fi
  done
  MODULES_MODE="hardlink(.prisma·.cache 는 복사)"
fi

# 2) 소스·시험·설정·.claude·android·plugins·.env — sync-local.sh 가 새 inode 로 채운다(rsync·safe_put).
KAIWA_LOCAL_ROOT="$DEST" bash "$ROOT/scripts/sync-local.sh"

# 3) package-lock.json 은 sync-local.sh 가 복사하지 않는다(미러가 앞서 나갈 수 있어서) — 새 미러는 NFS(git) 것으로 시작한다.
if [ -f "$ROOT/package-lock.json" ]; then
  safe_put "$ROOT/package-lock.json" "$DEST/package-lock.json"
fi

# 3b) Prisma 클라이언트를 NFS 스키마로 다시 만든다 — 기준 미러의 .prisma 는 오래됐을 수 있다(2026-10-19 실측: 메인 미러 client 가
#     10-06 것이라 새 미러의 tsc 가 Chat.endedAt 에서 실패했다). 이 미러의 .prisma 는 위에서 실제 복사본으로 바꿨으므로
#     generate 의 제자리 쓰기(client/schema.prisma)가 다른 미러로 번지지 않는다. DB 연결은 하지 않는다.
if ! ( cd "$DEST" && node node_modules/.bin/prisma generate --schema prisma/schema.prisma > "$DEST/.prisma-generate.log" 2>&1 ); then
  echo "prisma generate 실패 — 로그 끝부분:" >&2
  tail -8 "$DEST/.prisma-generate.log" >&2 || true
  exit 1
fi
rm -f "$DEST/.prisma-generate.log"

# 4) 점검 — 제자리 쓰기에 노출된 파일(링크 수 > 1)이 하나라도 있으면 실패로 끝낸다.
bash "$ROOT/scripts/mirror-audit.sh" --check "$DEST"

echo "MIRROR_OK path=$DEST node_modules=$MODULES_MODE"
echo "  쓰기: KAIWA_LOCAL_ROOT=$DEST bash scripts/sync-local.sh  (이 미러의 파일은 NFS 에서 고치고 sync 로 채운다)"
echo "  금지: 이 미러에서 npm install·npm ci(--copy-node-modules 로 만든 미러만 가능)"
