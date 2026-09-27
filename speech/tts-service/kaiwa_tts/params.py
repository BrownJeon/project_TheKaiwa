"""엔진 중립 요청 → Style-Bert-VITS2 `TTSModel.infer` 인자. 이 변환은 이 파일에서만 한다.

SBV2 2.5.0 `TTSModel.infer` 시그니처(2026-09-27 M4 실측): text, language, speaker_id, reference_audio_path,
sdp_ratio, noise, noise_w, length, line_split, split_interval, assist_text, assist_text_weight, use_assist_text,
style, style_weight, given_phone, given_tone, pitch_scale, intonation_scale.
pitch_scale·intonation_scale 는 1.0 이 아니면 pyworld(harvest) 후처리가 돈다(+≈0.25s/2.8s 음성, 음질 약간 저하).
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Any

from .config import MAX_TEXT_CHARS
from .schemas import EngineIn, SynthesizeIn, has_control_chars

# 1.0 과 거의 같은 값은 1.0 으로 스냅한다 — SBV2 는 정확히 1.0 일 때만 pyworld 후처리를 건너뛴다.
_UNITY_EPS = 0.005


class TextError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def clean_text(raw: str, max_chars: int = MAX_TEXT_CHARS) -> str:
    text = unicodedata.normalize("NFC", raw).strip()
    if not text:
        raise TextError("TEXT_EMPTY", "text is empty")
    if has_control_chars(text):
        raise TextError("TEXT_INVALID", "text must be a single line without control characters")
    if len(text) > max_chars:
        raise TextError("TEXT_TOO_LONG", f"text exceeds {max_chars} characters; split sentences before calling")
    return text


def snap_unity(value: float) -> float:
    return 1.0 if abs(value - 1.0) < _UNITY_EPS else round(value, 3)


def resolve_style(requested: str, available: list[str]) -> tuple[str, bool]:
    """요청 스타일이 모델에 없으면 Neutral(없으면 첫 스타일)로 대체한다. (적용 스타일, 대체 여부)."""
    if requested in available:
        return requested, False
    if "Neutral" in available:
        return "Neutral", True
    return (available[0] if available else requested), True


@dataclass(frozen=True)
class SynthPlan:
    text: str
    style: str
    style_fallback: bool
    adjusts_pitch: bool
    kwargs: dict[str, Any]


def build_plan(req: SynthesizeIn, text: str, available_styles: list[str]) -> SynthPlan:
    engine = req.engine or EngineIn()
    style, fallback = resolve_style(req.voice.style, available_styles)
    pitch = snap_unity(req.controls.pitch)
    intonation = snap_unity(req.controls.intonation)
    kwargs: dict[str, Any] = {
        "text": text,
        "speaker_id": req.voice.speaker,
        "style": style,
        "style_weight": round(req.voice.styleWeight, 3),
        "length": round(1.0 / req.controls.speed, 4),
        "pitch_scale": pitch,
        "intonation_scale": intonation,
        "sdp_ratio": engine.sdpRatio,
        "noise": engine.noise,
        "noise_w": engine.noiseW,
        # 호출자가 문장 단위로 나눠 보낸다. 줄 분할을 끄면 given_phone 경로·분할 무음 삽입이 생기지 않는다.
        "line_split": False,
    }
    return SynthPlan(
        text=text,
        style=style,
        style_fallback=fallback,
        adjusts_pitch=not (pitch == 1.0 and intonation == 1.0),
        kwargs=kwargs,
    )


def without_pitch_adjust(kwargs: dict[str, Any]) -> dict[str, Any]:
    return {**kwargs, "pitch_scale": 1.0, "intonation_scale": 1.0}
