"""요청 스키마 — 엔진 중립 이름만 쓴다(SBV2 인자명은 params.py 에서만)."""

from __future__ import annotations

import unicodedata
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MODEL_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$"
TRACE_ID_PATTERN = r"^[A-Za-z0-9_.:\-]{1,64}$"

SpeechProfileName = Literal["NATIVE", "LEARNING_NORMAL", "LEARNING_SLOW", "PRONUNCIATION", "SHADOWING"]


def has_control_chars(value: str) -> bool:
    return any(unicodedata.category(ch).startswith("C") for ch in value)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class VoiceIn(_Strict):
    model: str | None = Field(default=None, pattern=MODEL_ID_PATTERN)
    speaker: int = Field(default=0, ge=0, le=1000)
    style: str = Field(default="Neutral", min_length=1, max_length=40)
    styleWeight: float = Field(default=1.0, ge=0.0, le=5.0, allow_inf_nan=False)

    @field_validator("style")
    @classmethod
    def _style_printable(cls, v: str) -> str:
        if has_control_chars(v):
            raise ValueError("style must not contain control characters")
        return v


class ControlsIn(_Strict):
    speed: float = Field(default=1.0, ge=0.5, le=2.0, allow_inf_nan=False)
    pitch: float = Field(default=1.0, ge=0.5, le=1.5, allow_inf_nan=False)
    intonation: float = Field(default=1.0, ge=0.0, le=2.0, allow_inf_nan=False)
    # 오디오에 넣지 않는다 — 클라 재생 큐의 간격(speech-platform/16 §4.1). 계약 호환을 위해 받기만 한다.
    pauseBeforeMs: int | None = Field(default=None, ge=0, le=2000)


class EngineIn(_Strict):
    sdpRatio: float = Field(default=0.2, ge=0.0, le=1.0, allow_inf_nan=False)
    noise: float = Field(default=0.6, ge=0.0, le=2.0, allow_inf_nan=False)
    noiseW: float = Field(default=0.8, ge=0.0, le=2.0, allow_inf_nan=False)


class SynthesizeIn(_Strict):
    text: str = Field(max_length=4096)
    voice: VoiceIn = Field(default_factory=VoiceIn)
    controls: ControlsIn = Field(default_factory=ControlsIn)
    engine: EngineIn | None = None
    profile: SpeechProfileName | None = None
    traceId: str | None = Field(default=None, pattern=TRACE_ID_PATTERN)


class G2pIn(_Strict):
    text: str = Field(max_length=4096)
