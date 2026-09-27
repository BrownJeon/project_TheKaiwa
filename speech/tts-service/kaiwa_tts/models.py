"""`model_assets/<modelId>/{config.json, *.safetensors, style_vectors.npy}` 스캔. SBV2 를 import 하지 않는다.

- 가중치는 safetensors 만 받는다(.pth/.pt 는 pickle 로드라 임의 코드 실행 위험).
- 디렉토리·파일의 실경로가 model_assets 밖이면(심볼릭 링크 탈출) 건너뛴다.
- `.` · `_` 로 시작하는 디렉토리(.cache, _trash)는 모델이 아니다. `.disabled` 마커가 있으면 DISABLED.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$")
_CKPT_RE = re.compile(r"_(e\d+_s\d+)\.safetensors$")
_STEP_RE = re.compile(r"_s(\d+)\.safetensors$")
_MANIFEST_MAX_BYTES = 64 * 1024


@dataclass(frozen=True)
class ModelSpec:
    model_id: str
    weights: Path
    config: Path
    style_vectors: Path
    version: str | None
    checkpoint: str | None
    fingerprint: tuple[object, ...]


@dataclass(frozen=True)
class ScanIssue:
    model_id: str
    status: str  # DISABLED | ERROR
    code: str


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=True).relative_to(root)
        return True
    except (OSError, ValueError):
        return False


def _step(p: Path) -> int:
    m = _STEP_RE.search(p.name)
    return int(m.group(1)) if m else -1


def _manifest_version(model_dir: Path) -> str | None:
    manifest = model_dir / "manifest.json"
    try:
        if not manifest.is_file() or manifest.stat().st_size > _MANIFEST_MAX_BYTES:
            return None
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    version = data.get("version") if isinstance(data, dict) else None
    if isinstance(version, str) and 0 < len(version) <= 32:
        return version
    return None


def _stat_key(p: Path) -> tuple[object, ...]:
    st = p.stat()
    return (p.name, st.st_size, st.st_mtime_ns)


def scan_model_assets(root: Path) -> tuple[list[ModelSpec], list[ScanIssue]]:
    specs: list[ModelSpec] = []
    issues: list[ScanIssue] = []
    try:
        real_root = root.resolve(strict=True)
        entries = sorted(real_root.iterdir(), key=lambda p: p.name)
    except OSError:
        return specs, issues
    for model_dir in entries:
        name = model_dir.name
        if name.startswith((".", "_")) or not model_dir.is_dir():
            continue
        if not MODEL_ID_RE.match(name):
            continue
        if not _inside(model_dir, real_root):
            issues.append(ScanIssue(name, "ERROR", "OUTSIDE_ROOT"))
            continue
        if (model_dir / ".disabled").exists():
            issues.append(ScanIssue(name, "DISABLED", "DISABLED"))
            continue
        config = model_dir / "config.json"
        style_vectors = model_dir / "style_vectors.npy"
        weights = sorted(
            (p for p in model_dir.glob("*.safetensors") if p.is_file()),
            key=lambda p: (_step(p), p.name),
        )
        if not config.is_file() or not style_vectors.is_file() or not weights:
            issues.append(ScanIssue(name, "ERROR", "INCOMPLETE"))
            continue
        chosen = weights[-1]
        if not all(_inside(p, real_root) for p in (config, style_vectors, chosen)):
            issues.append(ScanIssue(name, "ERROR", "OUTSIDE_ROOT"))
            continue
        ckpt = _CKPT_RE.search(chosen.name)
        specs.append(
            ModelSpec(
                model_id=name,
                weights=chosen,
                config=config,
                style_vectors=style_vectors,
                version=_manifest_version(model_dir),
                checkpoint=ckpt.group(1) if ckpt else None,
                fingerprint=(_stat_key(chosen), _stat_key(config), _stat_key(style_vectors)),
            )
        )
    return specs, issues
