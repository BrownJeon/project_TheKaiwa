"""모델·torch 없이 도는 계약 테스트 공용 픽스처 — Backend Protocol 의 가짜를 넣는다."""

from __future__ import annotations

import re
import sys
import threading
import time
import unicodedata
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
from kaiwa_tts.timing import AlignmentCapture  # noqa: E402

SECRET = "test-secret-0123456789abcdef"
SR = 44100
HOP = 512

_PUNCT_MAP = {"。": ".", "、": ",", "？": "?", "！": "!", "…": "...", "「": "'", "」": "'", "〜": "ー", "~": "ー"}
_KEEP = re.compile(r"[^぀-ゟ゠-ヿ一-鿿A-Za-z!?,.'\-]")
_DIGITS = "〇一二三四五六七八九"
PUNCT = set("!?,.'-")


def _num_ja(m: re.Match[str]) -> str:
    n = int(m.group(0))
    if n < 10:
        return _DIGITS[n]
    tens, ones = divmod(n % 100, 10)
    return ("" if tens == 1 else _DIGITS[tens]) + "十" + ("" if ones == 0 else _DIGITS[ones])


def fake_normalize(text: str) -> str:
    """SBV2 normalize_text 의 모양만 흉내 낸 결정적 정규화(NFKC · 숫자→한자 · 구두점 치환 · 그 밖 삭제 · 결합 탁점 삭제)."""
    s = unicodedata.normalize("NFKC", text)
    s = re.sub(r"[0-9]{1,2}", _num_ja, s)
    s = "".join(_PUNCT_MAP.get(ch, ch) for ch in s)
    s = _KEEP.sub("", s)
    return s.replace("゙", "").replace("゚", "")


def _script(ch: str) -> str:
    if ch in PUNCT:
        return f"p{ch}"
    if "぀" <= ch <= "ゟ":
        return "hira"
    if "゠" <= ch <= "ヿ":
        return "kata"
    return "kanji"


def fake_alignment(text: str, length: float = 1.0) -> tuple[AlignmentCapture, int]:
    """가짜 엔진 정렬 — 문자당 음소 2개(구두점 1개), 같은 문자 종류가 이어지면 한 단어, 토큰 사이 blank.
    (capture, 오디오 샘플 수 = Σ프레임 × HOP) 를 돌려준다."""
    norm = fake_normalize(text.strip())
    counts = [1] + [1 if ch in PUNCT else 2 for ch in norm] + [1]
    speech = [False] + [ch not in PUNCT for ch in norm for _ in range(1 if ch in PUNCT else 2)] + [False]
    words: list[int] = []
    prev = ""
    for ch in norm:
        kind = _script(ch)
        if words and kind == prev and not kind.startswith("p"):
            words[-1] += 1
        else:
            words.append(1)
        prev = kind
    n_tokens = 2 * sum(counts) + 1
    base = max(1, round(3 * length))
    frames = tuple(base + (i % 3) if i % 2 else 1 for i in range(n_tokens))
    cap = AlignmentCapture(
        normalized_text=norm,
        phone_counts=tuple(counts),
        phone_is_speech=tuple(speech),
        word_lengths=tuple(words),
        token_frames=frames,
        blank_interleaved=True,
        samples_per_frame=HOP,
        normalize=fake_normalize,
    )
    return cap, sum(frames) * HOP


class FakeBackend:
    def __init__(
        self,
        *,
        mps_ok: bool = True,
        fail_warmup_on: str | None = None,
        delay_s: float = 0.0,
        alignment: str = "ok",  # ok | none | extra_samples:<n> | raise:<status>
    ) -> None:
        self.mps_ok = mps_ok
        self.fail_warmup_on = fail_warmup_on
        self.delay_s = delay_s
        self.alignment = alignment
        self.calls: list[dict[str, Any]] = []
        self.inits: list[str] = []
        self.gate = threading.Event()
        self.gate.set()
        self._last: AlignmentCapture | None = None

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
        cap, samples = fake_alignment(kwargs["text"], kwargs["length"])
        if self.alignment.startswith("extra_samples:"):
            # pyworld 후처리처럼 오디오 길이가 프레임 합과 조금 달라지는 경우.
            samples += int(self.alignment.split(":", 1)[1])
        self._last = cap
        return SR, (np.sin(np.arange(samples) / 20) * 20000).astype(np.int16)

    def take_alignment(self, handle: Any) -> AlignmentCapture | None:
        from kaiwa_tts.timing import TimingError

        cap, self._last = self._last, None
        if self.alignment == "none":
            return None
        if self.alignment.startswith("raise:"):
            raise TimingError(self.alignment.split(":", 1)[1])
        if self.alignment == "boom":
            raise RuntimeError("internal")
        return cap

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
