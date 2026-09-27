"""모델·torch 없이 도는 계약 테스트 공용 픽스처 — Backend Protocol 의 가짜를 넣는다."""

from __future__ import annotations

import sys
import threading
import time
from pathlib import Path
from typing import Any

import numpy as np
import pytest

SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from kaiwa_tts.backend import ModelInfo  # noqa: E402
from kaiwa_tts.config import Settings  # noqa: E402
from kaiwa_tts.models import ModelSpec  # noqa: E402

SECRET = "test-secret-0123456789abcdef"
SR = 44100


class FakeBackend:
    def __init__(self, *, mps_ok: bool = True, fail_warmup_on: str | None = None, delay_s: float = 0.0) -> None:
        self.mps_ok = mps_ok
        self.fail_warmup_on = fail_warmup_on
        self.delay_s = delay_s
        self.calls: list[dict[str, Any]] = []
        self.inits: list[str] = []
        self.gate = threading.Event()
        self.gate.set()

    def init(self, requested_device: str) -> str:
        self.inits.append(requested_device)
        return requested_device if (requested_device != "mps" or self.mps_ok) else "cpu"

    def load_model(self, spec: ModelSpec, device: str) -> tuple[Any, ModelInfo]:
        info = ModelInfo(sample_rate=SR, speakers=[(0, spec.model_id)], styles=["Neutral", "Happy", "Sad"])
        return {"id": spec.model_id, "device": device}, info

    def infer(self, handle: Any, kwargs: dict[str, Any]) -> tuple[int, np.ndarray]:
        self.gate.wait(5)
        if self.delay_s:
            time.sleep(self.delay_s)
        if self.fail_warmup_on and handle["device"] == self.fail_warmup_on:
            raise RuntimeError("device failure")
        if kwargs.get("pitch_scale") == 0.77:
            raise ZeroDivisionError("pyworld")
        self.calls.append({"model": handle["id"], "device": handle["device"], **kwargs})
        seconds = min(3.0, 0.1 * len(kwargs["text"])) * kwargs["length"]
        return SR, (np.sin(np.arange(int(SR * seconds)) / 20) * 20000).astype(np.int16)

    def g2p(self, text: str) -> tuple[str, list[tuple[str, int]]]:
        return text, [("コ", 0), ("ン", 1), ("ニ", 1), ("チ", 1), ("ワ", 1), (".", 0), ("ア", 1), ("メ", 0)]

    def release(self, handle: Any) -> None:
        pass

    def gpu_memory_mb(self) -> int | None:
        return 512


def make_model(root: Path, name: str, weights: str = "m_e10_s100.safetensors") -> Path:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "config.json").write_text("{}")
    (d / "style_vectors.npy").write_bytes(b"\x00")
    (d / weights).write_bytes(b"weights-" + name.encode())
    return d


@pytest.fixture()
def assets(tmp_path: Path) -> Path:
    root = tmp_path / "model_assets"
    for name in ("jvnv-F1-jp", "jvnv-F2-jp", "jvnv-M1-jp"):
        make_model(root, name)
    (root / ".cache").mkdir()
    return root


def make_settings(assets: Path, **overrides: Any) -> Settings:
    base: dict[str, Any] = {
        "model_assets": assets,
        "log_dir": assets.parent / "logs",
        "default_model": "jvnv-F1-jp",
        "device": "mps",
        "internal_secret": SECRET,
        "queue_timeout_ms": 8000,
    }
    base.update(overrides)
    return Settings(**base)
