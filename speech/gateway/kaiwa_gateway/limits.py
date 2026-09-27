"""DoS 상한 도구 — 토큰 버킷(프레임·텍스트 메시지 속도)과 세션 레지스트리(전체 상한·사용자당 1)."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any


class TokenBucket:
    def __init__(self, rate_per_sec: float, burst: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._rate = rate_per_sec
        self._burst = float(burst)
        self._tokens = float(burst)
        self._clock = clock
        self._last = clock()

    def take(self, n: float = 1.0) -> bool:
        now = self._clock()
        self._tokens = min(self._burst, self._tokens + (now - self._last) * self._rate)
        self._last = now
        if self._tokens >= n:
            self._tokens -= n
            return True
        return False


class SessionLimitError(Exception):
    pass


class SessionRegistry:
    """인증을 통과한 세션만 센다. 같은 사용자의 새 세션은 이전 세션을 밀어낸다(api-contract §2-29, close 4409)."""

    def __init__(self, max_sessions: int) -> None:
        self._max = max_sessions
        self._by_user: dict[str, Any] = {}
        self.pending = 0  # start 를 기다리는(미인증) 연결 수

    def __len__(self) -> int:
        return len(self._by_user)

    def acquire(self, user_id: str, conn: Any) -> Any | None:
        """등록하고 밀려난 이전 연결(있으면)을 돌려준다. 상한이면 SessionLimitError."""
        previous = self._by_user.get(user_id)
        if previous is None and len(self._by_user) >= self._max:
            raise SessionLimitError("too many sessions")
        self._by_user[user_id] = conn
        return previous

    def release(self, user_id: str, conn: Any) -> None:
        if self._by_user.get(user_id) is conn:
            del self._by_user[user_id]
