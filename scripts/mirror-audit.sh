#!/usr/bin/env bash
# 미러 점검 — ISS-0009. 읽기 전용(--snapshot 을 줄 때만 지정한 폴더에 JSON 한 개를 쓴다).
#
# 사용법:
#   bash scripts/mirror-audit.sh [--since YYYY-MM-DD] [--all] [--snapshot <폴더>]   전체 미러 점검
#   bash scripts/mirror-audit.sh --check <미러 경로>                              한 미러 점검(노출이 있으면 종료 1)
#   bash scripts/mirror-audit.sh --hash <프로젝트 기준 상대경로>                    모든 미러에서 그 파일을 NFS 와 비교
#
# 「노출」= 제자리에서 쓰이기 쉬운 곳의 일반 파일 중 링크 수(nlink)가 2 이상인 것 — 다른 미러와 같은 inode 라는 뜻이다.
# 제자리 쓰기(cp 덮어쓰기·셸 리다이렉트·일부 도구)가 일어나면 그 inode 를 가진 모든 미러가 함께 바뀐다.
#   · 점검 범위: src tests prisma public scripts plugins .claude android(build·.gradle 제외) · 루트 설정 파일 ·
#     .next · node_modules/.prisma · node_modules/.cache
#   · node_modules 의 나머지는 의도적으로 하드링크하는 읽기 전용 영역이라 세지 않는다.
#   · 전체 점검은 --since(기본 2026-10-19, ISS-0009 조치일) 이후에 만든 미러를 「조치 후 미러」로 따로 센다.
#   · --hash 는 내용이 NFS 와 다른 미러를 보여 준다 — 작업 중인 미러는 정상적으로 다를 수 있으니 사고 의심 때 쓴다.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_LOCAL="${KAIWA_NODE_LOCAL:-$HOME/.node-local}"   # 시험에서만 바꾼다
SRC_DIRS=(src tests prisma public scripts plugins .claude)
ROOT_FILES=(package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs next-env.d.ts .npmrc capacitor.config.ts .env)

usage() { sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

# 점검 대상 미러(node_modules 와 package.json 이 있는 thekaiwa·thekaiwa-* 만 — 음성 venv 등은 제외).
list_mirrors() {
  local d
  for d in "$NODE_LOCAL"/thekaiwa "$NODE_LOCAL"/thekaiwa-*; do
    if [ -d "$d/node_modules" ] && [ -f "$d/package.json" ]; then echo "$d"; fi
  done
}

# 노출 파일 수 — "소스 .next 생성물" 순서로 출력.
count_exposed() {
  local m="$1" s=0 n=0 p=0 d f c
  for d in "${SRC_DIRS[@]}"; do
    if [ -d "$m/$d" ]; then c=$(find "$m/$d" -type f -links +1 -printf . 2>/dev/null | wc -c); s=$((s + c)); fi
  done
  if [ -d "$m/android" ]; then
    c=$(find "$m/android" \( -name build -o -name .gradle \) -prune -o -type f -links +1 -printf . 2>/dev/null | wc -c); s=$((s + c))
  fi
  for f in "${ROOT_FILES[@]}"; do
    if [ -f "$m/$f" ] && [ "$(stat -c %h "$m/$f")" -gt 1 ]; then s=$((s + 1)); fi
  done
  if [ -d "$m/.next" ]; then n=$(find "$m/.next" -type f -links +1 -printf . 2>/dev/null | wc -c); fi
  for d in .prisma .cache; do
    if [ -d "$m/node_modules/$d" ]; then c=$(find "$m/node_modules/$d" -type f -links +1 -printf . 2>/dev/null | wc -c); p=$((p + c)); fi
  done
  echo "$s $n $p"
}

# 노출 파일 예시(진단용, 최대 8개).
sample_exposed() {
  local m="$1" d f
  {
    for d in "${SRC_DIRS[@]}" .next node_modules/.prisma node_modules/.cache; do
      [ -d "$m/$d" ] && find "$m/$d" -type f -links +1 2>/dev/null
    done
    for f in "${ROOT_FILES[@]}"; do
      [ -f "$m/$f" ] && [ "$(stat -c %h "$m/$f")" -gt 1 ] && echo "$m/$f"
    done
  } | head -8
}

born_epoch() { local b; b=$(stat -c %W "$1" 2>/dev/null || echo 0); if [ "${b:-0}" = 0 ]; then b=$(stat -c %Y "$1"); fi; echo "$b"; }

MODE="all"; SINCE="2026-10-19"; SNAP_DIR=""; SHOW_ALL=0; TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE="check"; TARGET="${2:-}"; [ -n "$TARGET" ] || { usage >&2; exit 2; }; shift 2 ;;
    --hash) MODE="hash"; TARGET="${2:-}"; [ -n "$TARGET" ] || { usage >&2; exit 2; }; shift 2 ;;
    --since) SINCE="${2:-}"; [ -n "$SINCE" ] || { usage >&2; exit 2; }; shift 2 ;;
    --snapshot) SNAP_DIR="${2:-}"; [ -n "$SNAP_DIR" ] || { usage >&2; exit 2; }; shift 2 ;;
    --all) SHOW_ALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "알 수 없는 인자: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ── --check <미러> ────────────────────────────────────────────────────────────
if [ "$MODE" = "check" ]; then
  [ -d "$TARGET" ] || { echo "미러가 없다: $TARGET" >&2; exit 2; }
  read -r s n p <<<"$(count_exposed "$TARGET")"
  echo "mirror_check path=$TARGET exposed_source=$s exposed_next=$n exposed_prisma=$p"
  if [ $((s + n + p)) -gt 0 ]; then
    echo "노출됨 — 다른 미러와 같은 inode 인 파일(제자리 쓰기 시 함께 바뀐다). 예시:" >&2
    sample_exposed "$TARGET" >&2
    exit 1
  fi
  exit 0
fi

# ── --hash <상대경로> ─────────────────────────────────────────────────────────
if [ "$MODE" = "hash" ]; then
  case "$TARGET" in /*|*..*) echo "프로젝트 기준 상대경로만 받는다: $TARGET" >&2; exit 2 ;; esac
  [ -f "$ROOT/$TARGET" ] || { echo "NFS 에 파일이 없다: $TARGET" >&2; exit 2; }
  nfs=$(sha256sum "$ROOT/$TARGET" | cut -c1-12)
  same=0; differ=0; missing=0
  echo "nfs $nfs $TARGET"
  while IFS= read -r m; do
    f="$m/$TARGET"
    if [ ! -f "$f" ]; then missing=$((missing + 1)); continue; fi
    h=$(sha256sum "$f" | cut -c1-12)
    if [ "$h" = "$nfs" ]; then same=$((same + 1)); else
      differ=$((differ + 1)); echo "DIFF $(basename "$m") hash=$h links=$(stat -c %h "$f")"
    fi
  done < <(list_mirrors)
  echo "hash_summary same=$same differ=$differ missing=$missing"
  exit 0
fi

# ── 전체 점검 ─────────────────────────────────────────────────────────────────
SINCE_EPOCH=$(date -d "$SINCE" +%s 2>/dev/null) || { echo "날짜 형식 오류: $SINCE" >&2; exit 2; }
total=0; post=0; post_exposed=0; post_files=0; legacy=0; legacy_exposed=0; legacy_files=0
LINES=""
while IFS= read -r m; do
  read -r s n p <<<"$(count_exposed "$m")"
  e=$((s + n + p)); total=$((total + 1))
  born=$(born_epoch "$m")
  if [ "$born" -ge "$SINCE_EPOCH" ]; then kind="post"; post=$((post + 1)); if [ "$e" -gt 0 ]; then post_exposed=$((post_exposed + 1)); post_files=$((post_files + e)); fi
  else kind="legacy"; legacy=$((legacy + 1)); if [ "$e" -gt 0 ]; then legacy_exposed=$((legacy_exposed + 1)); legacy_files=$((legacy_files + e)); fi
  fi
  if [ "$SHOW_ALL" = 1 ] || [ "$kind" = "post" ]; then
    LINES+="$(printf '%-7s %-34s source=%-6s next=%-6s prisma=%-4s created=%s' "$kind" "$(basename "$m")" "$s" "$n" "$p" "$(date -d "@$born" +%F)")"$'\n'
  fi
done < <(list_mirrors)

echo "mirror_audit since=$SINCE total=$total"
printf '%s' "$LINES"
echo "summary post_fix_mirrors=$post post_fix_exposed_mirrors=$post_exposed post_fix_exposed_files=$post_files legacy_mirrors=$legacy legacy_exposed_mirrors=$legacy_exposed legacy_exposed_files=$legacy_files"
[ "$SHOW_ALL" = 1 ] || echo "(옛 미러 목록은 --all)"

if [ -n "$SNAP_DIR" ]; then
  mkdir -p "$SNAP_DIR"
  OUT="$SNAP_DIR/$(date +%F).json"
  SNAP_OUT="$OUT" SNAP_SINCE="$SINCE" SNAP_CMD="bash scripts/mirror-audit.sh --since $SINCE --snapshot $SNAP_DIR" SNAP_SRC="$NODE_LOCAL" \
  SNAP_VALUES="$total $post $post_exposed $post_files $legacy $legacy_exposed $legacy_files" python3 - <<'PY'
import json, os, datetime
t, post, pe, pf, lg, le, lf = (int(x) for x in os.environ["SNAP_VALUES"].split())
now = datetime.datetime.now().astimezone()
doc = {
    "schema_version": "issue@1",
    "kind": "metric_snapshot",
    "project": "TheKaiwa",
    "window": {"since": os.environ["SNAP_SINCE"], "until": None},
    "aggregates": {
        "mirrors_total": t, "post_fix_mirrors": post, "post_fix_exposed_mirrors": pe, "post_fix_exposed_files": pf,
        "legacy_mirrors": lg, "legacy_exposed_mirrors": le, "legacy_exposed_files": lf,
    },
    "provenance": {
        "command": os.environ["SNAP_CMD"], "collector_version": "mirror-audit@1", "source_dir": os.environ["SNAP_SRC"],
        "generated_at": now.isoformat(timespec="seconds"), "failures": [],
    },
    "sensitivity": "internal",
    "retention_until": (now.date() + datetime.timedelta(days=365)).isoformat(),
}
with open(os.environ["SNAP_OUT"], "w", encoding="utf-8") as fh:
    json.dump(doc, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
PY
  echo "snapshot=$OUT"
fi
exit 0
