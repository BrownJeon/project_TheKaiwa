"""SpeechEngineRouter(Phase 1 최소형) — 역할 → 로드된 provider + 실행 문맥.

Phase 1 은 서비스가 맡는 connection 이 역할당 하나(gateway = REALTIME_STT 1개)라 Fallback 순회가 없다.
DB `EngineFallbackPolicy`·`EngineConnection` 을 읽는 순회는 앱 #141a 와 함께 Phase 2 에 붙인다(common/README §4).
"""

from __future__ import annotations

import time
from typing import Any

from .config import Settings
from .engine.adapters import REALTIME_STT_FACTORIES
from .engine.errors import EngineUnavailableError
from .engine.interfaces import ConnectionProfile, ConnectionType, EngineContext, EngineRole
from .logging import get_logger

log = get_logger("kaiwa_speech_common.router")


class SpeechEngineRouter:
    def __init__(self, settings: Settings, provider: Any | None = None) -> None:
        self._settings = settings
        self._provider: Any | None = provider
        self.state = "OK" if provider is not None else "IDLE"  # IDLE → LOADING → OK | FAILED
        self.error: str | None = None
        self.load_ms: int | None = getattr(provider, "load_ms", None)

    @property
    def connection(self) -> ConnectionProfile:
        stt = self._settings.stt
        return ConnectionProfile(
            id=self._settings.gateway.connection_key,
            engine_id=stt.engine,
            role=EngineRole.REALTIME_STT,
            connection_type=ConnectionType.LOCAL,
            enabled=True,
            runtime={"numThreads": stt.num_threads, "decodingMethod": stt.decoding_method, "vad": {"silenceMs": stt.endpoint_silence_ms}},
            status="HEALTHY" if self.state == "OK" else "UNAVAILABLE",
        )

    def load_realtime(self) -> None:
        """블로킹 — 기동 스레드에서 부른다."""
        factory = REALTIME_STT_FACTORIES.get(self._settings.stt.engine)
        if factory is None:
            self.state, self.error = "FAILED", "unknown engine"
            raise EngineUnavailableError(self.error)
        self.state = "LOADING"
        t0 = time.monotonic()
        provider = factory(self._settings.stt, self._settings.env.models_dir, self._settings.gateway.decode_workers)
        try:
            provider.load()
        except EngineUnavailableError as e:
            provider.shutdown()
            self.state, self.error = "FAILED", str(e)
            log.error("realtime engine unavailable: %s", self.error)
            raise
        self._provider = provider
        self.load_ms = int((time.monotonic() - t0) * 1000)
        self.state = "OK"

    def resolve(self, role: EngineRole) -> tuple[Any, EngineContext]:
        if role is not EngineRole.REALTIME_STT or self._provider is None or self.state != "OK":
            raise EngineUnavailableError(f"no {role.value} connection available")
        return self._provider, EngineContext(connection=self.connection, environment=self._settings.env.app_env)

    @property
    def model_label(self) -> str:
        return str(getattr(self._provider, "model_label", "")) if self._provider is not None else ""

    def shutdown(self) -> None:
        if self._provider is not None and hasattr(self._provider, "shutdown"):
            self._provider.shutdown()
