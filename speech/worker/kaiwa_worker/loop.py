"""잡 루프(api-contract §2-30, speech/worker/README §2).

기동 점검: 설정 오류·읽기 변환기(pyopenjtalk) 불가면 claim 하지 않고 오류 로그만 남기며 기다린다(앱은 하트비트가 없으니 적재를 멈추고 health degraded).
loop: #139 claim(max=batch_size) → 잡마다 핸들러(직렬 — 분석 서비스가 전역 잠금으로 직렬이고 다른 프로젝트와 공용) → 처리했으면 바로 다음 claim.
      빈 응답·claim 실패면 간격부터 두 배씩 늘려 최대 10초(앱 적재 게이트 120초 안에 반드시 다시 claim).
SIGTERM/SIGINT: 지금 잡을 끝내고 멈춘다(pm2 kill_timeout 안) — 끝내지 못한 잡은 15분 뒤 앱의 고아 회수가 되돌린다.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from kaiwa_speech_common.ids import trace_id as new_trace_id
from kaiwa_speech_common.internal_client import CallbackError, InternalClient
from kaiwa_speech_common.logging import get_logger

from .comparator import ReadingUnavailableError, TranscriptComparator
from .config import LoopConfig
from .handlers.analysis_stt import HandlerDeps, Outcome, handle_analysis_stt
from .jobs import ClaimedJob, parse_job

log = get_logger("kaiwa_worker.loop")

Handler = Callable[[ClaimedJob, HandlerDeps], Awaitable[Outcome]]
HANDLERS: dict[str, Handler] = {"ANALYSIS_STT": handle_analysis_stt}


class WorkerLoop:
    def __init__(self, cfg: LoopConfig, client: InternalClient, deps: HandlerDeps, comparator: TranscriptComparator, worker_id: str) -> None:
        self.cfg = cfg
        self.client = client
        self.deps = deps
        self.comparator = comparator
        self.worker_id = worker_id
        self.stop = asyncio.Event()
        self._idle_ms = cfg.poll_interval_ms
        self.processed = 0

    async def _sleep(self, seconds: float) -> None:
        try:
            await asyncio.wait_for(self.stop.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass

    async def wait_until_ready(self) -> bool:
        """읽기 변환기가 될 때까지 기다린다. 멈추라는 신호를 받으면 False."""
        while not self.stop.is_set():
            try:
                await asyncio.to_thread(self.comparator.reading.check)
                return True
            except ReadingUnavailableError as e:
                log.error("reading provider unavailable (%s) — not claiming, retry in %ds", e, self.cfg.reading_recheck_sec)
                await self._sleep(self.cfg.reading_recheck_sec)
        return False

    async def run_once(self) -> int:
        """claim 1회 + 받은 잡 처리. 처리한 잡 수. claim 실패는 0(다음 호출이 백오프)."""
        try:
            raw = await self.client.claim_jobs(self.worker_id, self.cfg.kinds, self.cfg.batch_size, new_trace_id(), self.cfg.claim_timeout_ms)
        except CallbackError as e:
            log.warning("claim failed status=%d reason=%s", e.status, e)
            return 0
        n = 0
        for item in raw:
            job = parse_job(item)
            if job is None:
                log.error("claim returned malformed job — skipped")
                continue
            handler = HANDLERS.get(job.kind)
            if handler is None:
                log.error("no handler for kind=%s job=%s", job.kind, job.id)
                continue
            try:
                await handler(job, self.deps)
            except Exception as e:  # noqa: BLE001 — 핸들러 밖으로 샌 오류가 루프(프로세스)를 죽이지 않게. 잡은 15분 뒤 앱의 고아 회수가 되돌린다
                log.error("handler crashed job=%s exc=%s", job.id, type(e).__name__)
            n += 1
            self.processed += 1
        return n

    def next_delay_ms(self, processed: int) -> int:
        # 잡을 처리했으면 쉬지 않고 바로 다음 claim — 디바운스로 대화가 멈춘 뒤 한꺼번에 풀리는 잡을 빨리 비운다(대화 중에는 잡이 집히지 않는다).
        if processed:
            self._idle_ms = self.cfg.poll_interval_ms
            return 0
        delay = self._idle_ms
        self._idle_ms = min(self._idle_ms * 2, self.cfg.idle_backoff_max_ms)
        return delay

    async def run(self) -> None:
        if not await self.wait_until_ready():
            return
        log.info(
            "worker started id=%s kinds=%s batch=%d interval=%dms", self.worker_id, ",".join(self.cfg.kinds), self.cfg.batch_size, self.cfg.poll_interval_ms
        )
        while not self.stop.is_set():
            processed = await self.run_once()
            await self._sleep(self.next_delay_ms(processed) / 1000)
        log.info("worker stopped id=%s processed=%d", self.worker_id, self.processed)
