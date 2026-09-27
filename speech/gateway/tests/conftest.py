"""모델 없이 도는 gateway 테스트 공용 — 가짜 VAD·디코더를 실제 세션 로직(SherpaRealtimeSession)에 끼운다."""

from __future__ import annotations

import time
import uuid
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import jwt
import numpy as np
import pytest
from fastapi.testclient import TestClient

from kaiwa_speech_common.config import REPO_ROOT, Settings, load_settings
from kaiwa_speech_common.engine.adapters.stt.reazon_sherpa import SherpaRealtimeSession
from kaiwa_speech_common.internal_client import InternalClient
from kaiwa_speech_common.router import SpeechEngineRouter

JWT_SECRET = "test-jwt-secret-0123456789abcdef0123456789"
INTERNAL_SECRET = "test-internal-secret-0123456789abcd"
FRAME = 1280
SPEECH_FRAME = (np.full(640, 8000, dtype="<i2")).tobytes()
SILENCE_FRAME = bytes(FRAME)


class FakeSegment:
    def __init__(self, start: int, n: int) -> None:
        self.start = start
        self.samples = [0.0] * n


class FakeVad:
    """진폭 > 0.1 이면 음성. 음성 뒤 무음이 `min_silence` 샘플 이어지면 세그먼트 1개를 낸다(sherpa VAD 흉내)."""

    def __init__(self, min_silence: int = 8000) -> None:
        self.min_silence = min_silence
        self.reset()

    def reset(self) -> None:
        self.pos = 0
        self.speech_start: int | None = None
        self.last_speech = 0
        self.segments: list[FakeSegment] = []

    def accept_waveform(self, samples: Any) -> None:
        loud = float(np.max(np.abs(samples))) > 0.1 if len(samples) else False
        if loud:
            if self.speech_start is None:
                self.speech_start = self.pos
            self.last_speech = self.pos + len(samples)
        self.pos += len(samples)
        if self.speech_start is not None and not loud and self.pos - self.last_speech >= self.min_silence:
            self._emit()

    def _emit(self) -> None:
        assert self.speech_start is not None
        self.segments.append(FakeSegment(self.speech_start, self.last_speech - self.speech_start))
        self.speech_start = None

    def is_speech_detected(self) -> bool:
        return self.speech_start is not None

    def empty(self) -> bool:
        return not self.segments

    @property
    def front(self) -> FakeSegment:
        return self.segments[0]

    def pop(self) -> None:
        self.segments.pop(0)

    def flush(self) -> None:
        if self.speech_start is not None:
            self._emit()


async def fake_decode(samples: Any) -> str:
    # 오디오 길이에 비례한 가짜 전사(0.2s 당 「あ」 1자). 본문 대신 길이로 결정적 테스트.
    return "あ" * max(1, len(samples) // 3200)


class FakeProvider:
    loaded = True
    load_ms = 1
    model_label = "fake-model@1"

    def __init__(self) -> None:
        self.sessions: list[SherpaRealtimeSession] = []

    async def open_session(
        self, request: Any, ctx: Any, on_vad: Any, on_partial: Any, on_final: Any, on_error: Any
    ) -> SherpaRealtimeSession:
        opts = request.options
        session = SherpaRealtimeSession(
            decode=fake_decode,
            vad=FakeVad(),
            endpoint_auto=opts.get("endpoint") == "auto",
            partial=bool(opts.get("partial", True)),
            max_utterance_ms=int(opts.get("max_utterance_ms", 60000)),
            on_vad=on_vad,
            on_partial=on_partial,
            on_final=on_final,
            on_error=on_error,
        )
        self.sessions.append(session)
        return session

    def shutdown(self) -> None:
        pass


def make_settings(tmp_path: Path, **gateway_overrides: Any) -> Settings:
    env = {
        "APP_ENV": "LOCAL",
        "DATA_ROOT": str(tmp_path / "data"),
        "JWT_SECRET": JWT_SECRET,
        "SPEECH_INTERNAL_SECRET": INTERNAL_SECRET,
        "APP_INTERNAL_URL": "http://app.test",
        "SPEECH_MODELS_DIR": str(tmp_path / "models"),
    }
    settings = load_settings(env, config_path=REPO_ROOT / "speech" / "speech.config.yml")
    return replace(settings, gateway=replace(settings.gateway, **gateway_overrides)) if gateway_overrides else settings


def make_ticket(secret: str = JWT_SECRET, **claims: Any) -> str:
    now = int(time.time())
    body: dict[str, Any] = {"sub": "cuser0001", "aud": "ws-speech", "jti": uuid.uuid4().hex, "iat": now, "exp": now + 60}
    body.update(claims)
    for k in [k for k, v in body.items() if v is None]:
        del body[k]
    return jwt.encode(body, secret, algorithm="HS256")


def start_msg(ticket: str, **extra: Any) -> dict[str, Any]:
    msg: dict[str, Any] = {"type": "start", "v": 1, "ticket": ticket, "sampleRate": 16000, "partial": True, "clientPlatform": "web"}
    msg.update(extra)
    return msg


class CallbackRecorder:
    """httpx MockTransport 로 앱 internal 콜백을 흉내 낸다."""

    def __init__(self, status: int = 200, body: dict[str, Any] | None = None, move: bool = False) -> None:
        self.status = status
        self.body = body
        self.calls: list[dict[str, Any]] = []
        self.headers: list[dict[str, str]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        import json

        payload = json.loads(request.content)
        self.calls.append(payload)
        self.headers.append(dict(request.headers))
        if self.status != 200:
            return httpx.Response(self.status, json={"success": False, "data": {"code": "INTERNAL"}})
        uid = payload["userId"]
        body = self.body or {
            "success": True,
            "data": {
                "utteranceId": "cutt0001",
                "audioPath": f"users/{uid}/utterances/2026-09/cutt0001.wav",
                "expiresAt": "2026-10-28T00:00:00Z",
            },
        }
        return httpx.Response(200, json=body)


@pytest.fixture
def provider() -> FakeProvider:
    return FakeProvider()


class _GracefulSession:
    """Starlette TestClient 의 WS 종료 경합(Python 3.10) 회피.

    TestClient 는 with 를 빠져나갈 때 close(1000) 직후 곧바로 서버 태스크의 CancelScope 를 cancel 한다. 서버 핸들러가
    그 사이에 막 끝나면 3.10 asyncio 에는 `uncancel()` 이 없어 걸려 있던 취소가 스코프 밖으로 새고, `fut.result()` 가
    CancelledError 를 낸다(테스트 하네스 문제 — uvicorn 운영 경로와 무관). 여기서 먼저 닫고 서버 세션이 풀릴 때까지 기다린다.
    """

    def __init__(self, inner: Any, client: TestClient) -> None:
        self._inner = inner
        self._client = client
        self._ws: Any = None

    def __enter__(self) -> Any:
        self._ws = self._inner.__enter__()
        return self._ws

    def __exit__(self, *exc: Any) -> Any:
        registry = self._client.app.state.deps.registry  # type: ignore[attr-defined]
        try:
            self._ws.close(1000)
        except Exception:  # noqa: BLE001 — 이미 서버가 닫았으면 그대로 진행
            pass
        deadline = time.monotonic() + 2.0
        while (len(registry) or registry.pending) and time.monotonic() < deadline:
            time.sleep(0.005)
        time.sleep(0.02)
        return self._inner.__exit__(*exc)


class GatewayTestClient(TestClient):
    def websocket_connect(self, *args: Any, **kwargs: Any) -> Any:  # type: ignore[override]
        return _GracefulSession(super().websocket_connect(*args, **kwargs), self)


def build_client(settings: Settings, provider: Any | None, recorder: CallbackRecorder | None = None) -> TestClient:
    from kaiwa_gateway.server import create_app

    router = SpeechEngineRouter(settings, provider=provider) if provider is not None else SpeechEngineRouter(settings)
    client = None
    if recorder is not None:
        client = InternalClient("http://app.test", INTERNAL_SECRET, "LOCAL", 2000, transport=httpx.MockTransport(recorder.handler))
    app = create_app(settings, router=router, client=client, load_engine=False)
    return GatewayTestClient(app)
