"""task-012b — InternalClient 의 `X-Service` 파라미터화(gateway 기본값 유지)·worker 호출 3종, 분석 STT HTTP 어댑터의 응답·오류 분류."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest

from kaiwa_speech_common.config import AnalysisSttRuntime
from kaiwa_speech_common.engine.adapters import ANALYSIS_STT_FACTORIES
from kaiwa_speech_common.engine.adapters.stt.whisper_http import WhisperHttpEngine
from kaiwa_speech_common.engine.errors import SttRequestError
from kaiwa_speech_common.engine.interfaces import AudioData, ConnectionProfile, ConnectionType, EngineContext, EngineRole, SpeechRequest
from kaiwa_speech_common.internal_client import CallbackError, InternalClient

SECRET = "i" * 40


def capture(status: int = 200, body: Any = None) -> tuple[list[httpx.Request], httpx.MockTransport]:
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(status, json=body if body is not None else {"success": True, "data": {"jobs": []}})

    return seen, httpx.MockTransport(handler)


def test_gateway_default_service_header_unchanged() -> None:
    seen, t = capture(body={"success": True, "data": {"utteranceId": "u1"}})
    c = InternalClient("http://app.test/", SECRET, "PRODUCTION", 2000, transport=t)
    asyncio.run(c.post_utterance({"x": 1}, "t_1"))
    h = seen[0].headers
    assert (
        h["x-service"] == "gateway" and h["x-service-env"] == "PRODUCTION" and h["x-internal-secret"] == SECRET and h["x-trace-id"] == "t_1"
    )


def test_worker_calls_paths_and_bodies() -> None:
    seen, t = capture(body={"success": True, "data": {"jobs": [{"id": "j1"}, "junk"], "ok": True, "jobStatus": "QUEUED"}})
    c = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=t, service="worker")
    jobs = asyncio.run(c.claim_jobs("worker-1", ["ANALYSIS_STT"], 1, "t_a"))
    assert jobs == [{"id": "j1"}], "dict 가 아닌 항목은 버린다"
    asyncio.run(c.report_failure("j1", "worker-1", "AUDIO_MISSING", False, "t_b"))
    asyncio.run(c.post_analysis("u1", {"jobId": "j1"}, "t_c"))
    assert [r.url.path for r in seen] == [
        "/api/internal/speech/jobs/claim",
        "/api/internal/speech/jobs/j1/result",
        "/api/internal/speech/utterances/u1/analysis",
    ]
    assert all(r.headers["x-service"] == "worker" for r in seen)
    assert json.loads(seen[0].content) == {"workerId": "worker-1", "kinds": ["ANALYSIS_STT"], "max": 1}
    assert json.loads(seen[1].content) == {"workerId": "worker-1", "status": "FAILED", "error": "AUDIO_MISSING", "retryable": False}


def test_report_failure_attempt_is_additive() -> None:
    """claim 세대(`attempt`)는 1 이상일 때만 싣는다 — 없으면 종전 본문 그대로(구버전 앱·호출자 호환)."""
    seen, t = capture(body={"success": True, "data": {"ok": True, "jobStatus": "QUEUED"}})
    c = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=t, service="worker")
    asyncio.run(c.report_failure("j1", "w", "X", True, "t", attempt=2))
    asyncio.run(c.report_failure("j1", "w", "X", True, "t", attempt=0))
    asyncio.run(c.report_failure("j1", "w", "X", True, "t"))
    bodies = [json.loads(r.content) for r in seen]
    assert bodies[0]["attempt"] == 2
    assert "attempt" not in bodies[1] and "attempt" not in bodies[2]


def test_claim_uses_its_own_longer_timeout() -> None:
    seen, t = capture(body={"success": True, "data": {"jobs": []}})
    c = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=t, service="worker")
    asyncio.run(c.claim_jobs("w", ["ANALYSIS_STT"], 1, "t", timeout_ms=30_000))
    asyncio.run(c.post_analysis("u1", {}, "t"))
    assert seen[0].extensions["timeout"]["read"] == 30.0, "claim 은 앱 커밋 뒤 응답 — 길게"
    assert seen[1].extensions["timeout"]["read"] == 2.0, "나머지는 클라이언트 기본값"


def test_worker_calls_refuse_bad_path_ids_and_surface_409() -> None:
    seen, t = capture(409, {"success": False})
    c = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=t, service="worker")
    with pytest.raises(CallbackError):
        asyncio.run(c.post_analysis("../admin", {}, "t"))
    assert seen == []
    with pytest.raises(CallbackError) as e:
        asyncio.run(c.report_failure("j1", "w", "X", True, "t"))
    assert e.value.status == 409


def _ctx() -> EngineContext:
    return EngineContext(
        connection=ConnectionProfile(
            id="conn-1", engine_id="", role=EngineRole.ANALYSIS_STT, connection_type=ConnectionType.HTTP, enabled=True
        )
    )


def _engine(handler: Any) -> WhisperHttpEngine:
    rt = AnalysisSttRuntime(engine="whisper", endpoint="http://stt.test", model="medium", timeout_ms=5000)
    return WhisperHttpEngine(rt, transport=httpx.MockTransport(handler))


AUDIO = AudioData(pcm=b"\x00\x00" * 1600, sample_rate=16000, duration_ms=100)
REQ = SpeechRequest(trace_id="t_x", role=EngineRole.ANALYSIS_STT)


def test_transcribe_sends_multipart_and_joins_segments() -> None:
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(
            200,
            json={
                "language": "ja",
                "languageProbability": 0.99,
                "durationSec": 1.2,
                "segments": [{"startSec": 0.0, "endSec": 0.6, "text": " 昨日は"}, {"startSec": 0.6, "endSec": 1.2, "text": "晴れでした。"}],
            },
        )

    r = asyncio.run(_engine(handler).transcribe(AUDIO, REQ, _ctx()))
    assert r.text == "昨日は晴れでした。" and [s.start_ms for s in r.segments] == [0, 600] and r.connection_id == "conn-1"
    req = seen[0]
    assert req.url.path == "/transcribe-chunk" and b'name="language"' in req.content and b"ja" in req.content
    assert b'filename="chunk.wav"' in req.content and b"RIFF" in req.content


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (503, "ANALYSIS_UNAVAILABLE", True),
        (500, "ANALYSIS_SERVER_ERROR", True),
        (422, "ANALYSIS_REJECTED", False),
        (400, "ANALYSIS_REJECTED", False),
    ],
)
def test_http_errors_are_classified(status: int, code: str, retryable: bool) -> None:
    with pytest.raises(SttRequestError) as e:
        asyncio.run(_engine(lambda req: httpx.Response(status, json={"detail": "秘密"})).transcribe(AUDIO, REQ, _ctx()))
    assert (e.value.code, e.value.retryable) == (code, retryable) and "秘密" not in str(e.value)


def test_timeout_transport_and_bad_body() -> None:
    def timeout(req: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=req)

    def refused(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=req)

    for handler, code in (
        (timeout, "ANALYSIS_TIMEOUT"),
        (refused, "ANALYSIS_UNAVAILABLE"),
        (lambda req: httpx.Response(200, json={"segments": "x"}), "ANALYSIS_BAD_RESPONSE"),
    ):
        with pytest.raises(SttRequestError) as e:
            asyncio.run(_engine(handler).transcribe(AUDIO, REQ, _ctx()))
        assert e.value.code == code and e.value.retryable


def test_registry_and_health() -> None:
    assert set(ANALYSIS_STT_FACTORIES) == {"whisper"}
    with pytest.raises(ValueError):
        ANALYSIS_STT_FACTORIES["whisper"](AnalysisSttRuntime(engine="whisper", mode="local", endpoint="http://x"))
    ok = asyncio.run(_engine(lambda req: httpx.Response(200, json={"status": "ok", "whisperLoaded": True})).health_check())
    down = asyncio.run(_engine(lambda req: httpx.Response(200, json={"status": "ok", "whisperLoaded": False})).health_check())
    assert ok.ok and ok.status == "HEALTHY" and not down.ok and down.status == "DEGRADED"
