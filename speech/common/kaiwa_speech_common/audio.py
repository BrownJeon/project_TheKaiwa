"""16kHz mono PCM16 유틸 — 프레임 → float32, wav 쓰기/읽기, 길이 계산."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
import numpy.typing as npt

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2


def pcm16_to_float32(pcm: bytes) -> npt.NDArray[np.float32]:
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0


def duration_ms(nbytes: int, sample_rate: int = SAMPLE_RATE) -> int:
    return int(nbytes // BYTES_PER_SAMPLE * 1000 // sample_rate)


def write_wav(path: Path, pcm: bytes, sample_rate: int = SAMPLE_RATE) -> int:
    """`path` 에 PCM16 mono wav 를 쓴다(호출자가 원자성·경로 검증을 책임). 반환 = 파일 바이트 수."""
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(BYTES_PER_SAMPLE)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return path.stat().st_size


def read_wav_pcm16(path: Path) -> tuple[bytes, int]:
    """mono PCM16 wav 의 (pcm, sample_rate). 다른 포맷은 ValueError."""
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != BYTES_PER_SAMPLE:
            raise ValueError("wav must be mono PCM16")
        return w.readframes(w.getnframes()), w.getframerate()
