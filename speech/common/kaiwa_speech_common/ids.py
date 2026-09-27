"""식별자 생성 — traceId 는 api-contract §0-5 규약(`t_` + base62 20자 = 22자, 사용자 정보 없음)."""

from __future__ import annotations

import secrets
import string

_BASE62 = string.digits + string.ascii_letters


def trace_id() -> str:
    return "t_" + "".join(secrets.choice(_BASE62) for _ in range(20))


def session_id() -> str:
    return "ws_" + secrets.token_hex(8)
