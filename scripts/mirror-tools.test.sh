#!/usr/bin/env bash
# 미러 도구 회귀 시험 — ISS-0009. 실제 ~/.node-local 은 건드리지 않고 임시 폴더의 가짜 프로젝트·가짜 기준 미러로 돈다.
#
# 사용법:  bash scripts/mirror-tools.test.sh [--scripts <scripts 폴더>]
#   --scripts  시험할 scripts 폴더(기본: 이 파일이 있는 폴더). 일부러 고장 낸 사본을 넣어 시험이 실패하는지 볼 때 쓴다(변이 시험).
#
# 검증하는 것:
#   · safe_put 이 하드링크를 끊고(형제 inode 불변) 임시 파일 잔재를 남기지 않는다
#   · make-mirror 가 .prisma 를 실제 복사본으로 만들어 generate 의 제자리 쓰기가 기준 미러로 번지지 않게 한다
#   · sync-local 이 `cp -al` 로 복제된 미러에서 실행돼도 같은 inode 를 가진 형제 미러(설정 파일·.env·tutor.md)를 바꾸지 않는다
#   · mirror-audit 가 노출(링크 수 > 1)을 잡는다
# 종료 코드: 0 = 전부 통과, 1 = 실패 있음.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_SCRIPTS="$HERE"
if [ "${1:-}" = "--scripts" ]; then
  [ -d "${2:-}" ] || { echo "scripts 폴더가 없다: ${2:-}" >&2; exit 2; }
  SRC_SCRIPTS="$(cd "$2" && pwd)"
fi

T="$(mktemp -d "${TMPDIR:-/tmp}/mirror-tools-test.XXXXXX")"
trap 'case "$T" in */mirror-tools-test.*) rm -rf "$T" ;; esac' EXIT
P="$T/proj"; NL="$T/node-local"; BASE="$NL/thekaiwa"

PASS=0; FAIL=0
ok()  { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL $1"; }
assert() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }
nlink() { stat -c %h "$1"; }

# ── 가짜 프로젝트 + 가짜 기준 미러 ───────────────────────────────────────────────
mkdir -p "$P/scripts" "$P/src" "$P/tests" "$P/prisma" "$P/.claude/agents"
cp -r "$SRC_SCRIPTS"/. "$P/scripts/"
echo 'export const a = 1' > "$P/src/a.ts"
echo 'export const t = 1' > "$P/tests/t.ts"
echo 'model X {}' > "$P/prisma/schema.prisma"
echo '{"name":"fx"}' > "$P/package.json"
echo '{}' > "$P/tsconfig.json"
echo 'tutor' > "$P/.claude/agents/tutor.md"
echo 'DATABASE_URL=x' > "$P/.env"
mkdir -p "$BASE/node_modules/pkg" "$BASE/node_modules/.prisma/client" "$BASE/node_modules/.cache" "$BASE/node_modules/.bin"
echo '{}' > "$BASE/package.json"
echo 'module.exports=1' > "$BASE/node_modules/pkg/index.js"
echo 'old' > "$BASE/node_modules/.prisma/client/schema.prisma"
echo 'cache' > "$BASE/node_modules/.cache/x"
# 가짜 prisma — 진짜처럼 제자리에서 쓴다(writeFileSync 는 같은 inode 를 잘라 쓴다)
echo "require('fs').writeFileSync('node_modules/.prisma/client/schema.prisma','regenerated')" > "$BASE/node_modules/.bin/prisma"

export KAIWA_NODE_LOCAL="$NL"

echo "== safe_put"
# shellcheck source=lib/safe-put.sh
. "$P/scripts/lib/safe-put.sh"
echo A > "$T/a"; ln "$T/a" "$T/b"; echo NEW > "$T/new"
safe_put "$T/new" "$T/a"
assert "대상은 새 내용이 된다" '[ "$(cat "$T/a")" = NEW ]'
assert "같은 inode 를 공유하던 다른 파일은 그대로다" '[ "$(cat "$T/b")" = A ]'
assert "링크가 끊긴다(링크 수 1)" '[ "$(nlink "$T/a")" = 1 ]'
assert "임시 파일 잔재가 없다" '! ls -A "$T" | grep -q safe-put'
safe_put "$T/missing" "$T/a" 2>/dev/null; RC=$?
assert "원본이 없으면 실패하고 대상은 그대로다" '[ "$RC" -ne 0 ] && [ "$(cat "$T/a")" = NEW ]'

echo "== make-mirror"
D="$NL/thekaiwa-t1"
OUT=$(bash "$P/scripts/make-mirror.sh" t1 2>&1); RC=$?
assert "성공하고 MIRROR_OK 를 낸다" '[ "$RC" = 0 ] && echo "$OUT" | grep -q MIRROR_OK'
assert ".prisma 는 실제 복사본이다(링크 수 1)" '[ "$(nlink "$D/node_modules/.prisma/client/schema.prisma")" = 1 ]'
assert ".cache 도 실제 복사본이다" '[ "$(nlink "$D/node_modules/.cache/x")" = 1 ]'
assert "generate 의 제자리 쓰기는 새 미러에만 닿는다" '[ "$(cat "$D/node_modules/.prisma/client/schema.prisma")" = regenerated ] && [ "$(cat "$BASE/node_modules/.prisma/client/schema.prisma")" = old ]'
assert "node_modules 나머지는 하드링크 공유다(의도)" '[ "$(nlink "$D/node_modules/pkg/index.js")" -gt 1 ]'
assert "소스·설정 파일은 새 inode 다" '[ "$(nlink "$D/src/a.ts")" = 1 ] && [ "$(nlink "$D/tsconfig.json")" = 1 ]'
assert ".next 를 만들지 않는다" '[ ! -e "$D/.next" ]'
assert ".env 권한은 600 이다" '[ "$(stat -c %a "$D/.env")" = 600 ]'
bash "$P/scripts/make-mirror.sh" t1 >/dev/null 2>&1; RC=$?
assert "이미 있는 이름은 덮어쓰지 않고 종료 1" '[ "$RC" = 1 ]'
bash "$P/scripts/make-mirror.sh" Bad_Name >/dev/null 2>&1; RC=$?
assert "잘못된 이름은 종료 2" '[ "$RC" = 2 ]'

echo "== mirror-audit (정상 미러)"
bash "$P/scripts/mirror-audit.sh" --check "$D" >/dev/null 2>&1; RC=$?
assert "새로 만든 미러는 노출 0 이라 종료 0" '[ "$RC" = 0 ]'

echo "== sync-local — cp -al 로 복제된 미러에서 실행"
LEG="$NL/thekaiwa-legacy"
cp -al "$D" "$LEG"                                   # 예전 방식: 전부 같은 inode
printf '\n// SIBLING\n' >> "$D/tsconfig.json"        # 공유 inode 라 legacy 에도 보인다
KAIWA_LOCAL_ROOT="$LEG" bash "$P/scripts/sync-local.sh" >/dev/null 2>&1
assert "실행한 미러는 NFS 내용으로 맞춰진다" 'cmp -s "$LEG/tsconfig.json" "$P/tsconfig.json"'
assert "같은 inode 를 공유하던 형제 미러 설정 파일은 안 바뀐다" 'grep -q SIBLING "$D/tsconfig.json"'
assert "형제 미러의 .env 는 제자리 덮어쓰기를 안 당했다(링크가 끊김)" '[ "$(nlink "$D/.env")" = 1 ]'
assert "형제 미러의 tutor.md 도 마찬가지다" '[ "$(nlink "$D/.claude/agents/tutor.md")" = 1 ]'

echo "== mirror-audit (예전 방식 미러)"
bash "$P/scripts/mirror-audit.sh" --check "$LEG" >/dev/null 2>&1; RC=$?
assert "cp -al 로 복제한 미러는 노출로 잡혀 종료 1" '[ "$RC" = 1 ]'
HOUT=$(bash "$P/scripts/mirror-audit.sh" --hash package.json 2>&1)
assert "--hash 가 요약을 낸다" 'echo "$HOUT" | grep -q "hash_summary same="'
SOUT=$(bash "$P/scripts/mirror-audit.sh" --since 2000-01-01 2>&1)
assert "전체 점검이 요약을 낸다" 'echo "$SOUT" | grep -q "^summary post_fix_mirrors="'

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
