#!/usr/bin/env bash
# qa-p2a — NFS 의 tests/live/p2a-qa/ 를 스냅샷 사본으로 복사한 뒤 미러에 동기화한다(sync-local.sh 의 rsync --delete 가 미러 쪽 새 폴더를 지우므로 스냅샷에 먼저 둔다).
set -eu
SRC="$HOME/.node-local/thekaiwa-qa-p2a-src2"; M="$HOME/.node-local/thekaiwa-qa-p2a"
NFS="/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa"
mkdir -p "$SRC/tests/live/p2a-qa"
cp "$NFS"/tests/live/p2a-qa/* "$SRC/tests/live/p2a-qa/"
cd "$SRC" && KAIWA_LOCAL_ROOT="$M" bash scripts/sync-local.sh
