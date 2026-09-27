#!/usr/bin/env python3
"""ReazonSpeech zipformer int8 + silero VAD 를 공식 배포처에서 받아 sha256 을 검증하고 manifest.json 을 만든다.

출처(고정 리비전 — 바뀌면 이 파일의 핀을 새로 적는다):
  - reazon-research/reazonspeech-k2-v2 (HuggingFace, Apache-2.0) @ 291488c8…  = sherpa-onnx
    `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` 릴리스의 원본(같은 epoch-99-avg-1 파일).
    k2-fsa 릴리스 tar.bz2 는 fp32 까지 713MB 라 int8 파일만 개별로 받는다.
  - k2-fsa/sherpa-onnx GitHub release `asr-models/silero_vad.onnx`
표준 라이브러리만 쓴다(venv 없이도 돈다). 모델 파일은 git 미추적(.gitignore `speech/models/**`).

  python3 speech/models/fetch_models.py                       # → speech/models/reazonspeech-int8/<version>/
  python3 speech/models/fetch_models.py --dest "$DATA_ROOT/models"   # 서빙 위치(/models/*)에 바로 배치
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

NAME = "reazonspeech-int8"
VERSION = "2024-08-01-int8-v1"
HF_REV = "291488c8151be24d7da4bf7af26e533fad96e407"
HF_BASE = f"https://huggingface.co/reazon-research/reazonspeech-k2-v2/resolve/{HF_REV}"
VAD_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"

# (파일명, URL, sha256, bytes, role). sha256 은 HF LFS oid(= 파일 sha256) 또는 2026-09-28 실측.
FILES: tuple[tuple[str, str, str, int, str], ...] = (
    (
        "encoder-epoch-99-avg-1.int8.onnx",
        f"{HF_BASE}/encoder-epoch-99-avg-1.int8.onnx",
        "2c7bd08a8a99f9ddd0d9e458456577b1f6279214e51426f114f9eced44c54e1d",
        154670139,
        "encoder",
    ),
    (
        "decoder-epoch-99-avg-1.onnx",
        f"{HF_BASE}/decoder-epoch-99-avg-1.onnx",
        "58b18211ae06265466bfa17172dab574df94f76c8bcb61a3640c28ba860e4124",
        11767836,
        "decoder",
    ),
    (
        "joiner-epoch-99-avg-1.int8.onnx",
        f"{HF_BASE}/joiner-epoch-99-avg-1.int8.onnx",
        "49cc7ea1d3d35a40a27442db5e89996da64bf0e683a903dce76e99e57a12e4de",
        2696970,
        "joiner",
    ),
    (
        "tokens.txt",
        f"{HF_BASE}/tokens.txt",
        "2c3ac659818a48a0c04010e0593bbc4d7c8a24a054340b01131499c05fd52def",
        45754,
        "tokens",
    ),
    (
        "silero_vad.onnx",
        VAD_URL,
        "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6",
        643854,
        "vad",
    ),
)

CHUNK = 1024 * 1024
MAX_ATTEMPTS = 3


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


def download(url: str, target: Path, expected_bytes: int) -> None:
    """`.part` 에 이어받기(Range) 후 크기가 맞으면 끝. sha256 판정은 호출자."""
    part = target.with_name(target.name + ".part")
    have = part.stat().st_size if part.exists() else 0
    if have > expected_bytes:
        part.unlink()
        have = 0
    headers = {"User-Agent": "thekaiwa-fetch-models/1"}
    if have:
        headers["Range"] = f"bytes={have}-"
    req = urllib.request.Request(url, headers=headers)  # noqa: S310 — 고정 https URL
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
        mode = "ab" if have and resp.status == 206 else "wb"
        if mode == "wb":
            have = 0
        t0 = time.monotonic()
        with part.open(mode) as out:
            while True:
                block = resp.read(CHUNK)
                if not block:
                    break
                out.write(block)
                have += len(block)
        dt = time.monotonic() - t0
    if have != expected_bytes:
        raise OSError(f"{target.name}: size {have} != {expected_bytes}")
    os.replace(part, target)
    print(f"  downloaded {target.name} {have / 1e6:.1f}MB in {dt:.1f}s")


def fetch_one(version_dir: Path, name: str, url: str, sha: str, size: int) -> None:
    target = version_dir / name
    if target.exists() and target.stat().st_size == size and sha256_of(target) == sha:
        print(f"  ok (cached) {name}")
        return
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            download(url, target, size)
            got = sha256_of(target)
            if got == sha:
                return
            print(f"  sha256 mismatch {name} (attempt {attempt}) — discard", file=sys.stderr)
        except OSError as e:
            print(f"  download failed {name} (attempt {attempt}): {type(e).__name__}: {e}", file=sys.stderr)
        for leftover in (target, target.with_name(target.name + ".part")):
            leftover.unlink(missing_ok=True)
    raise SystemExit(f"giving up on {name} after {MAX_ATTEMPTS} attempts — version directory is incomplete")


def write_manifest(model_root: Path) -> Path:
    manifest = {
        "name": NAME,
        "version": VERSION,
        "engine": "sherpa-onnx",
        "model": "zipformer-ja-reazonspeech-2024-08-01-int8",
        "modelType": "transducer",
        "sampleRate": 16000,
        "language": "ja",
        "license": "Apache-2.0",
        "source": f"https://huggingface.co/reazon-research/reazonspeech-k2-v2@{HF_REV} + {VAD_URL}",
        "minPluginVersion": "0.1.0",
        "files": [{"path": n, "sha256": s, "bytes": b, "role": r} for n, _u, s, b, r in FILES],
        "totalBytes": sum(b for _n, _u, _s, b, _r in FILES),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    tmp = model_root / "manifest.json.tmp"
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    final = model_root / "manifest.json"
    os.replace(tmp, final)
    return final


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dest", default=str(Path(__file__).resolve().parent), help="모델 루트(그 아래 reazonspeech-int8/<version>/)")
    ap.add_argument("--verify-only", action="store_true", help="내려받지 않고 기존 파일 sha256 만 검사")
    args = ap.parse_args()

    model_root = Path(args.dest).resolve() / NAME
    version_dir = model_root / VERSION
    version_dir.mkdir(parents=True, exist_ok=True)
    print(f"{NAME} {VERSION} → {version_dir}")

    if args.verify_only:
        bad = [n for n, _u, s, b, _r in FILES if not (version_dir / n).exists() or (version_dir / n).stat().st_size != b or sha256_of(version_dir / n) != s]
        for n in bad:
            print(f"  MISMATCH {n}", file=sys.stderr)
        print("verify:", "FAIL" if bad else "OK")
        return 1 if bad else 0

    for name, url, sha, size, _role in FILES:
        fetch_one(version_dir, name, url, sha, size)
    path = write_manifest(model_root)
    print(f"manifest → {path} (total {sum(b for *_x, b, _r in FILES) / 1e6:.1f}MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
