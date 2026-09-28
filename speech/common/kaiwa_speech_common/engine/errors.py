"""엔진 계층 예외 — 상위(gateway)는 이 타입으로만 분기하고 엔진명을 모른다."""

from __future__ import annotations


class EngineUnavailableError(Exception):
    """선택 가능한 엔진이 없거나 모델이 로드되지 않았다(→ ENGINE_UNAVAILABLE, WS 4422)."""


class EngineOverloadedError(Exception):
    """세션 작업 큐가 넘쳤다(입력이 처리 속도를 크게 앞섬 → RATE_LIMITED)."""


class SttRequestError(Exception):
    """분석 STT 요청 실패(task-012b).

    `code` 는 엔진명 없는 코드값(워커가 #140 `error` 로 그대로 보낸다), `retryable` 은 백오프 재시도 대상 여부.

    코드: ANALYSIS_UNAVAILABLE(연결 실패·503) · ANALYSIS_TIMEOUT · ANALYSIS_SERVER_ERROR(그 밖 5xx) · ANALYSIS_BAD_RESPONSE(형식 오류)
    → 재시도 / ANALYSIS_REJECTED(4xx) → 즉시 실패. 메시지에 전사·경로·응답 본문을 싣지 않는다.
    """

    def __init__(self, code: str, retryable: bool, status: int = 0) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable
        self.status = status
