"""앱 내부 콜백 클라이언트 — `POST /api/internal/speech/*`(헤더 `X-Internal-Secret`·`X-Service`·`X-Service-Env`·`X-Trace-Id`).

재시도: 연결 오류·5xx 만 1회(타임아웃은 재시도하지 않는다 — 실시간 경로가 두 배로 늘어난다).
응답은 앱 봉투 `{success, data}` 또는 data 자체 둘 다 받는다. 오류 메시지에 본문·시크릿을 싣지 않는다.
`service` = 호출 서비스 이름(`X-Service`) — gateway 는 기본값 그대로,
worker 는 `"worker"`(task-012b: claim #139 · 실패 보고 #140 · 결과 #138).
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from .logging import get_logger

log = get_logger("kaiwa_speech_common.internal_client")
_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


class CallbackError(Exception):
    """콜백 실패. `status` 는 HTTP 코드(연결 실패·타임아웃은 0)."""

    def __init__(self, message: str, status: int = 0) -> None:
        super().__init__(message)
        self.status = status


class InternalClient:
    def __init__(
        self,
        base_url: str,
        secret: str,
        service_env: str,
        timeout_ms: int,
        transport: httpx.AsyncBaseTransport | None = None,
        service: str = "gateway",
    ) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {
            "X-Internal-Secret": secret,
            "X-Service": service,
            "X-Service-Env": service_env,
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=timeout_ms / 1000, transport=transport, follow_redirects=False)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def post_utterance(self, payload: Mapping[str, Any], trace_id: str) -> Mapping[str, Any]:
        return await self._post("/api/internal/speech/utterances", payload, trace_id)

    async def claim_jobs(
        self, worker_id: str, kinds: Sequence[str], max_jobs: int, trace_id: str, timeout_ms: int | None = None
    ) -> list[Mapping[str, Any]]:
        """#139 — 잡 목록(없으면 빈 목록). 항목 검증은 호출자(worker)가 한다. `timeout_ms` 는 이 호출만의 상한(앱 커밋 뒤 응답이라 길게)."""
        body = {"workerId": worker_id, "kinds": list(kinds), "max": max_jobs}
        data = await self._post("/api/internal/speech/jobs/claim", body, trace_id, timeout_ms)
        jobs = data.get("jobs")
        if not isinstance(jobs, list):
            raise CallbackError("invalid body", 200)
        return [j for j in jobs if isinstance(j, dict)]

    async def report_failure(self, job_id: str, worker_id: str, error: str, retryable: bool, trace_id: str) -> Mapping[str, Any]:
        """#140 — `409`(회수된 잡 STALE_CLAIM)는 CallbackError(status=409) 로 올라간다(호출자가 무시)."""
        body = {"workerId": worker_id, "status": "FAILED", "error": error, "retryable": retryable}
        return await self._post(f"/api/internal/speech/jobs/{self._id(job_id)}/result", body, trace_id)

    async def post_analysis(self, utterance_id: str, payload: Mapping[str, Any], trace_id: str) -> Mapping[str, Any]:
        """#138 — 앱이 requiresReview 를 판정해 `{stored, utteranceStatus, transcriptConfidence, requiresReview, finalSource}` 를 준다."""
        return await self._post(f"/api/internal/speech/utterances/{self._id(utterance_id)}/analysis", payload, trace_id)

    @staticmethod
    def _id(value: str) -> str:
        # 경로 조각 — 앱이 준 id 라도 형식을 확인하고 넣는다(`/`·`..` 로 다른 경로를 부르지 않게).
        if not isinstance(value, str) or not _ID.match(value):
            raise CallbackError("invalid id")
        return value

    async def _post(self, path: str, payload: Mapping[str, Any], trace_id: str, timeout_ms: int | None = None) -> Mapping[str, Any]:
        url = self._base + path
        last: CallbackError | None = None
        extra: dict[str, Any] = {"timeout": timeout_ms / 1000} if timeout_ms else {}
        for attempt in (1, 2):
            try:
                resp = await self._client.post(url, json=dict(payload), headers={**self._headers, "X-Trace-Id": trace_id}, **extra)
            except httpx.TimeoutException:
                raise CallbackError("timeout") from None
            except httpx.TransportError as e:
                last = CallbackError(f"transport {type(e).__name__}")
                log.warning("callback %s transport error attempt=%d trace=%s", path, attempt, trace_id)
                continue
            if resp.status_code >= 500:
                last = CallbackError("server error", resp.status_code)
                log.warning("callback %s status=%d attempt=%d trace=%s", path, resp.status_code, attempt, trace_id)
                continue
            if resp.status_code >= 300:
                raise CallbackError("rejected", resp.status_code)
            try:
                body = resp.json()
            except ValueError:
                raise CallbackError("invalid json", resp.status_code) from None
            if not isinstance(body, dict):
                raise CallbackError("invalid body", resp.status_code)
            if body.get("success") is False:
                raise CallbackError("unsuccessful", resp.status_code)
            inner = body.get("data")
            data: dict[str, Any] = inner if isinstance(inner, dict) else body
            return data
        assert last is not None
        raise last
