#!/usr/bin/env bash
# node-local 실행 디렉토리 동기화 — package.json 의 dev/build 가 매번 먼저 호출한다.
#
# 왜 필요한가: NFS(project/)는 noexec 이라 node_modules 를 그대로 둘 수 없다. 그래서
# node_modules 를 ~/.node-local/thekaiwa/ 에 두는데, Next.js 16 의 Turbopack 은
# `turbopack.root` 경계 밖으로 나가는 심볼릭 링크의 resolve 를 거부한다 — 프로젝트
# 루트(NFS)에 node_modules 심볼릭 링크만 두면 `next build` 가 "Symlink [project]/
# node_modules is invalid, it points out of the filesystem root" 로 즉시 실패한다
# (VoiceVault task-001·TheThinker task-014 실측). 해법도 동일하다: **next 프로세스
# 자체를 node_modules 가 진짜로 존재하는 node-local 디렉토리에서 실행한다.**
#
# 따라서 이 스크립트가 소스(src/, public/, prisma/, 설정 파일)를 node-local 로 동기화한
# 뒤, package.json 스크립트가 `cd` 로 그리로 이동해 next 를 실행한다. NFS 쪽 소스가
# **유일한 편집 대상(source of truth)** 이고 node-local 은 실행 전용 미러다.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ROOT="$HOME/.node-local/thekaiwa"

mkdir -p "$LOCAL_ROOT"
# src/ 는 Phase 0 스캐폴딩 전(DB 준비 단계)에는 없을 수 있다.
if [ -d "$PROJECT_ROOT/src" ]; then
  rsync -a --delete "$PROJECT_ROOT/src/" "$LOCAL_ROOT/src/"
fi
if [ -d "$PROJECT_ROOT/public" ]; then
  rsync -a --delete "$PROJECT_ROOT/public/" "$LOCAL_ROOT/public/"
fi
# prisma 스키마도 미러한다 — node-local 에서 `prisma generate` 를 돌릴 때 필요하다.
if [ -d "$PROJECT_ROOT/prisma" ]; then
  rsync -a --delete "$PROJECT_ROOT/prisma/" "$LOCAL_ROOT/prisma/"
fi

# 강사 페르소나(런타임이 `<cwd>/.claude/agents/tutor.md` 를 읽는다)와 테스트 픽스처·실측 스크립트.
mkdir -p "$LOCAL_ROOT/.claude/agents"
cp "$PROJECT_ROOT/.claude/agents/tutor.md" "$LOCAL_ROOT/.claude/agents/tutor.md"
if [ -d "$PROJECT_ROOT/tests" ]; then
  rsync -a --delete "$PROJECT_ROOT/tests/" "$LOCAL_ROOT/tests/"
fi

# 안드로이드 프로젝트(Phase 7). NFS 가 소스이고 **빌드는 미러에서만** 돈다(noexec).
#   · `build/`·`.gradle/` 은 산출물이라 보내지 않는다 — 보내면 매 동기화마다 수백 MB 가 오간다.
#   · `local.properties` 는 **기계마다 다른 값**(`sdk.dir`)이라 덮어쓰면 안 된다.
#   · `--delete` 를 쓰되 위 셋은 지켜야 하므로 `--filter` 로 보호한다(`P` = protect).
if [ -d "$PROJECT_ROOT/android" ]; then
  rsync -a --delete \
    --exclude 'build/' --exclude '.gradle/' --exclude 'local.properties' \
    --filter 'P build/' --filter 'P .gradle/' --filter 'P local.properties' \
    "$PROJECT_ROOT/android/" "$LOCAL_ROOT/android/"
fi

# `set -e` 아래에서 `[ -f x ] && cp` 는 bash 의 && 예외 규칙에 기대는 형태라, 의도가
# 드러나게 명시적 if 로 쓴다.
for f in tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs next-env.d.ts package.json .npmrc capacitor.config.ts; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    cp "$PROJECT_ROOT/$f" "$LOCAL_ROOT/$f"
  fi
done

# .env 는 next 가 cwd 기준으로 로드하므로 반드시 미러에도 있어야 한다.
# (권한 600 유지 — cp -p 로 모드까지 복사)
if [ -f "$PROJECT_ROOT/.env" ]; then
  cp -p "$PROJECT_ROOT/.env" "$LOCAL_ROOT/.env"
fi

exit 0
