"""thekaiwa-speech-worker 진입점 — `python main.py` (cwd = speech/worker, PYTHONPATH = speech/worker:speech/common).

포트를 열지 않는다(생존은 앱이 claim 하트비트로 판단, task-012b D-B4). DB 에 접속하지 않는다(D-B1). 설정은 env + speech.config.yml.
설정이 틀리면 claim 하지 않고 오류 로그만 남기며 기다린다(pm2 가 재시작 루프를 돌지 않게 — 고치고 재기동).
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys
from dataclasses import replace

from kaiwa_speech_common.engine.adapters import ANALYSIS_STT_FACTORIES
from kaiwa_speech_common.internal_client import InternalClient
from kaiwa_speech_common.logging import get_logger, setup_logging
from kaiwa_worker.comparator import OpenJTalkReading, TranscriptComparator
from kaiwa_worker.config import WorkerSettings, load_worker_settings
from kaiwa_worker.handlers.analysis_stt import HandlerDeps
from kaiwa_worker.loop import WorkerLoop

log = get_logger("kaiwa_worker.main")
MISCONFIG_RELOG_SEC = 300


async def _idle_until_stopped(stop: asyncio.Event, settings: WorkerSettings) -> None:
    while not stop.is_set():
        log.error("worker misconfigured — not claiming: %s", ",".join(settings.issues))
        try:
            await asyncio.wait_for(stop.wait(), timeout=MISCONFIG_RELOG_SEC)
        except asyncio.TimeoutError:
            pass


async def amain() -> int:
    settings = load_worker_settings()
    setup_logging(settings.log_level, secrets=[settings.internal_secret])
    # httpx 는 요청마다 INFO 로 URL 을 찍는다(발화 id 포함) — 잡 로그만 남기게 WARNING 이상만.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    factory = ANALYSIS_STT_FACTORIES.get(settings.analysis.engine)
    if settings.misconfigured or factory is None or settings.data_root is None:
        if factory is None and "stt.validation.engine:missing" not in settings.issues:
            settings = replace(settings, issues=(*settings.issues, "stt.validation.engine:unknown"))
        await _idle_until_stopped(stop, settings)
        return 0
    try:
        engine = factory(settings.analysis)
    except ValueError:
        await _idle_until_stopped(stop, replace(settings, issues=(*settings.issues, "stt.validation.mode:unsupported")))
        return 0

    client = InternalClient(settings.app_internal_url, settings.internal_secret, settings.app_env, settings.loop.callback_timeout_ms, service="worker")
    comparator = TranscriptComparator(OpenJTalkReading())
    deps = HandlerDeps(
        client=client,
        engine=engine,
        comparator=comparator,
        data_root=settings.data_root,
        worker_id=settings.instance_id,
        connection_key=settings.connection_key,
        model_label=getattr(engine, "model_label", "unknown"),
        app_env=settings.app_env,
    )
    worker = WorkerLoop(settings.loop, client, deps, comparator, settings.instance_id)
    worker.stop = stop
    log.info("worker boot %r config=%s", settings, settings.config_version)
    try:
        await worker.run()
    finally:
        await client.aclose()
        await engine.aclose()
    return 0


def main() -> int:
    return asyncio.run(amain())


if __name__ == "__main__":
    sys.exit(main())
