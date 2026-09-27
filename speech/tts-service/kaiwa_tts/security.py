"""순수 ASGI 게이트 — 라우팅·본문 파싱 전에 판정한다(미인증 호출자에게 스키마 오류조차 보이지 않게).

순서: ① `/admin/*` 는 loopback 원격 주소만(아니면 404, 존재 비노출) ② `/health` 외 전부 `X-Internal-Secret`
상수시간 비교(없음·불일치·서버 미설정 모두 401) ③ 본문 상한(초과 413). 시크릿 값은 어디에도 기록하지 않는다.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

log = logging.getLogger("kaiwa_tts.security")

PUBLIC_PATHS = frozenset({"/health"})
_SECRET_HEADER = b"x-internal-secret"


def is_loopback(host: str | None) -> bool:
    if not host:
        return False
    try:
        addr = ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped.is_loopback
    return addr.is_loopback


def is_admin_path(path: str) -> bool:
    first = next((seg for seg in path.split("/") if seg), "")
    return first.lower() == "admin"


def _digest(value: bytes) -> bytes:
    return hashlib.sha256(value).digest()


async def send_json(send: Send, status: int, code: str, message: str, headers: list[tuple[bytes, bytes]] | None = None) -> None:
    body = json.dumps({"error": {"code": code, "message": message}}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *(headers or [])],
        }
    )
    await send({"type": "http.response.body", "body": body})


class InternalGate:
    def __init__(self, app: ASGIApp, *, secret: str, secret_ok: bool, max_body_bytes: int) -> None:
        self.app = app
        # 비교는 고정 길이 해시끼리 — 길이 차이로도 새지 않게.
        self._secret_digest = _digest(secret.encode()) if secret_ok else None
        self.max_body_bytes = max_body_bytes

    def _authorized(self, scope: Scope) -> bool:
        if self._secret_digest is None:
            return False
        provided = b""
        for name, value in scope.get("headers") or []:
            if name.lower() == _SECRET_HEADER:
                provided = value
                break
        if not provided:
            return False
        return hmac.compare_digest(_digest(provided), self._secret_digest)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        client = scope.get("client")
        if is_admin_path(path) and not is_loopback(client[0] if client else None):
            await send_json(send, 404, "NOT_FOUND", "not found")
            return
        if path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return
        if not self._authorized(scope):
            log.warning("unauthorized path=%s client=%s", path[:80], client[0] if client else "-")
            await send_json(send, 401, "UNAUTHORIZED", "missing or invalid internal secret")
            return
        await self._with_body_limit(scope, receive, send)

    async def _with_body_limit(self, scope: Scope, receive: Receive, send: Send) -> None:
        for name, value in scope.get("headers") or []:
            if name.lower() == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = self.max_body_bytes + 1
                if declared > self.max_body_bytes:
                    await send_json(send, 413, "BODY_TOO_LARGE", f"request body exceeds {self.max_body_bytes} bytes")
                    return
        body = b""
        more = True
        while more:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body += message.get("body", b"")
            if len(body) > self.max_body_bytes:
                await send_json(send, 413, "BODY_TOO_LARGE", f"request body exceeds {self.max_body_bytes} bytes")
                return
            more = bool(message.get("more_body", False))

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
