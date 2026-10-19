#!/usr/bin/env bash
# 미러 안전 쓰기 — ISS-0009. 직접 실행하지 않고 `source` 해서 쓴다.
#
# 왜: 에이전트별 전용 미러를 `cp -al` 로 통째 복제하면 모든 파일이 원본 미러와 같은 inode 를 공유한다.
# 그 파일을 `cp` 덮어쓰기·셸 리다이렉트(`>`)·`prisma generate` 의 제자리 쓰기로 바꾸면 같은 inode 를 가진
# 다른 미러(다른 작업의 미러·메인 미러)가 함께 바뀐다 (task-072 .next 오염 · task-074 시험 파일 오염 사고).
#
# 임시 파일에 쓰고 같은 디렉터리에서 `mv -f` 로 교체하면 새 inode 가 되어 다른 미러와 링크가 끊기고,
# 교체는 원자적이라 읽는 쪽(떠 있는 next dev 등)이 반쯤 쓴 파일을 보지 않는다.
#
# 실험 근거(2026-10-19, ISS-0009): sync-local.sh 의 `cp` 와 prisma generate 의 `.prisma/client/schema.prisma`
# 는 제자리 쓰기였고, `rsync -a`(--inplace 없음)와 prisma generate 의 나머지 15개 파일은 교체였다.

# usage: safe_put <원본> <대상> [chmod 모드]
#   대상의 기존 inode 는 건드리지 않고 새 파일로 교체한다. 실패하면 임시 파일을 지우고 1 을 돌려준다.
safe_put() {
  local src="$1" dst="$2" mode="${3:-}" tmp
  tmp="${dst}.safe-put.$$"
  rm -f "$tmp"
  if ! cp "$src" "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [ -n "$mode" ] && ! chmod "$mode" "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  mv -f "$tmp" "$dst"
}
