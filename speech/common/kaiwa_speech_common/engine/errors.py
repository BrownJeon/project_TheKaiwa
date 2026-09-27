"""엔진 계층 예외 — 상위(gateway)는 이 타입으로만 분기하고 엔진명을 모른다."""

from __future__ import annotations


class EngineUnavailableError(Exception):
    """선택 가능한 엔진이 없거나 모델이 로드되지 않았다(→ ENGINE_UNAVAILABLE, WS 4422)."""


class EngineOverloadedError(Exception):
    """세션 작업 큐가 넘쳤다(입력이 처리 속도를 크게 앞섬 → RATE_LIMITED)."""
