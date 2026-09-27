"""앱 내부 콜백 클라이언트 — `POST /api/internal/speech/*`(헤더 `X-Internal-Secret`).

재시도: 연결 오류·5xx 만 1회(타임아웃은 재시도하지 않는다 — 실시간 경로가 두 배로 늘어난다).
응답은 앱 봉투 `{success, data}` 또는 data 자체 둘 다 받는다. 오류 메시지에 본문·시크릿을 싣지 않는다.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import httpx

from .logging import get_logger

log = get_logger("kaiwa_speech_common.internal_client")


class CallbackError(Exception):
    """콜백 실패. `status` 는 HTTP 코드(연결 실패·타임아웃은 0)."""

    def __init__(self, message: str, status: int = 0) -> None:
        super().__init__(message)
        self.status = status


class InternalClient:
    def __init__(
        self, base_url: str, secret: str, service_env: str, timeout_ms: int, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {
            "X-Internal-Secret": secret,
            "X-Service": "gateway",
            "X-Service-Env": service_env,
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=timeout_ms / 1000, transport=transport, follow_redirects=False)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def post_utterance(self, payload: Mapping[str, Any], trace_id: str) -> Mapping[str, Any]:
        return await self._post("/api/internal/speech/utterances", payload, trace_id)

    async def _post(self, path: str, payload: Mapping[str, Any], trace_id: str) -> Mapping[str, Any]:
        url = self._base + path
        last: CallbackError | None = None
        for attempt in (1, 2):
            try:
                resp = await self._client.post(url, json=dict(payload), headers={**self._headers, "X-Trace-Id": trace_id})
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
