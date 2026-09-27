"""합성 직렬화 — 단일 워커 스레드 + asyncio.Lock(대기 상한).

모델·pyopenjtalk 는 스레드 안전하지 않으므로 모든 모델 작업(로드·워밍업·합성·g2p·refresh)은 같은 1-스레드
executor 에서 돈다. Lock 은 대기 시간 상한(queue_timeout)을 재기 위한 관문이다 — 요청이 취소돼 Lock 이 먼저
풀려도 executor 가 1개라 추론이 겹치지 않는다.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import TypeVar

T = TypeVar("T")


class QueueTimeout(Exception):
    pass


class SerialRunner:
    def __init__(self, queue_timeout_s: float) -> None:
        self.queue_timeout_s = queue_timeout_s
        self._lock = asyncio.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="kaiwa-tts")
        self.waiting = 0
        self._busy_since: float | None = None
        self._busy_kind: str | None = None

    @property
    def busy_kind(self) -> str | None:
        return self._busy_kind

    def busy_for(self) -> float:
        since = self._busy_since
        return 0.0 if since is None else time.monotonic() - since

    @property
    def depth(self) -> int:
        return self.waiting + (1 if self._busy_since is not None else 0)

    async def run(self, kind: str, fn: Callable[[], T], *, bounded: bool = True) -> tuple[T, int]:
        """(결과, 대기 ms). bounded 이면 queue_timeout_s 안에 차례가 안 오면 QueueTimeout."""
        start = time.perf_counter()
        self.waiting += 1
        try:
            if bounded:
                async with asyncio.timeout(self.queue_timeout_s):
                    await self._lock.acquire()
            else:
                await self._lock.acquire()
        except TimeoutError:
            raise QueueTimeout() from None
        finally:
            self.waiting -= 1
        queue_ms = int((time.perf_counter() - start) * 1000)
        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(self._executor, self._call, kind, fn)
        finally:
            self._lock.release()
        return result, queue_ms

    def _call(self, kind: str, fn: Callable[[], T]) -> T:
        self._busy_kind = kind
        self._busy_since = time.monotonic()
        try:
            return fn()
        finally:
            self._busy_since = None
            self._busy_kind = None

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
