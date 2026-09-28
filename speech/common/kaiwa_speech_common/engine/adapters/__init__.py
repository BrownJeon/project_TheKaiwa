"""어댑터 레지스트리 — engineId → provider 팩토리. 엔진명 문자열은 여기와 각 어댑터 파일에만 둔다."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from ...config import AnalysisSttRuntime, SttRuntime


def _reazon_sherpa(stt: SttRuntime, models_dir: Path, decode_workers: int) -> Any:
    from .stt.reazon_sherpa import ReazonSherpaProvider  # noqa: PLC0415 — sherpa-onnx 는 쓸 때만 import

    return ReazonSherpaProvider(stt, models_dir, decode_workers)


REALTIME_STT_FACTORIES: dict[str, Callable[[SttRuntime, Path, int], Any]] = {
    "reazon-sherpa": _reazon_sherpa,
}


def _whisper(runtime: AnalysisSttRuntime) -> Any:
    if runtime.mode != "http":
        # mode=local(faster-whisper 직접 로드)은 정확도 부족이 실측될 때만 붙인다(speech/worker/README §3).
        raise ValueError("unsupported analysis mode")
    from .stt.whisper_http import WhisperHttpEngine  # noqa: PLC0415 — 쓸 때만 import

    return WhisperHttpEngine(runtime)


# task-012b: 분석(검증) STT — `speech.stt.validation.engine` → 엔진 팩토리. worker 는 이 표로만 엔진을 받는다(엔진명 분기 없음).
ANALYSIS_STT_FACTORIES: dict[str, Callable[[AnalysisSttRuntime], Any]] = {
    "whisper": _whisper,
}

# 엔진별 서비스 주소 환경 변수(설정 4층 ENVIRONMENT — `speech.stt.validation.endpoint` 를 덮는다). 변수 이름에 엔진명이 들어가 여기 둔다.
ANALYSIS_STT_ENDPOINT_ENV: dict[str, str] = {
    "whisper": "WHISPER_SERVICE_URL",
}
