"""어댑터 레지스트리 — engineId → provider 팩토리. 엔진명 문자열은 여기와 각 어댑터 파일에만 둔다."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from ...config import SttRuntime


def _reazon_sherpa(stt: SttRuntime, models_dir: Path, decode_workers: int) -> Any:
    from .stt.reazon_sherpa import ReazonSherpaProvider  # noqa: PLC0415 — sherpa-onnx 는 쓸 때만 import

    return ReazonSherpaProvider(stt, models_dir, decode_workers)


REALTIME_STT_FACTORIES: dict[str, Callable[[SttRuntime, Path, int], Any]] = {
    "reazon-sherpa": _reazon_sherpa,
}
