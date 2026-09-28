"""worker 테스트 공용 — 앱 콜백은 httpx.MockTransport, 분석 엔진은 가짜, 읽기 변환기는 표 기반 가짜(pyopenjtalk 없이도 돈다)."""

from __future__ import annotations

import json
import wave
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest

from kaiwa_speech_common.engine.errors import SttRequestError
from kaiwa_speech_common.engine.interfaces import AudioData, EngineContext, SpeechRequest, TranscriptionResult, TranscriptionSegment
from kaiwa_speech_common.internal_client import InternalClient
from kaiwa_worker.comparator import TranscriptComparator
from kaiwa_worker.handlers.analysis_stt import HandlerDeps

SECRET = "test-internal-secret-0123456789abcd"
USER = "cuserqa000000000000000001"
UTT = "cutt00000000000000000000001"
JOB = "cjob00000000000000000000001"
REL = f"users/{USER}/utterances/2026-09/{UTT}.wav"


class TableReading:
    """읽기 변환 가짜 — 표에 있으면 그 읽기, 없으면 입력 그대로(가나는 그대로 두는 g2p 흉내)."""

    version = "table-1"

    def __init__(self, table: dict[str, str] | None = None) -> None:
        self.table = table or {}
        self.ok = True

    def check(self) -> None:
        from kaiwa_worker.comparator import ReadingUnavailableError

        if not self.ok:
            raise ReadingUnavailableError("fake")

    def read(self, text: str) -> str:
        out = text
        for k, v in self.table.items():
            out = out.replace(k, v)
        return out


class FakeEngine:
    def __init__(self, text: str = "", error: SttRequestError | None = None) -> None:
        self.text = text
        self.error = error
        self.calls = 0
        self.model_label = "fake-model"

    async def transcribe(self, audio: AudioData, request: SpeechRequest, ctx: EngineContext) -> TranscriptionResult:
        self.calls += 1
        if self.error:
            raise self.error
        segs = [TranscriptionSegment(seg_idx=0, text=self.text, start_ms=0, end_ms=audio.duration_ms)] if self.text else []
        return TranscriptionResult(text=self.text, segments=segs, connection_id=ctx.connection.id)

    async def aclose(self) -> None:
        return None


class Recorder:
    """앱 흉내 — 경로별 응답을 정하고 요청(헤더·본문)을 모은다."""

    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str], dict[str, Any]]] = []
        self.routes: dict[str, Callable[[dict[str, Any]], httpx.Response]] = {}

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content or b"{}")
        self.requests.append((request.url.path, dict(request.headers), body))
        for suffix, fn in self.routes.items():
            if request.url.path.endswith(suffix):
                return fn(body)
        return httpx.Response(404, json={"success": False})

    def paths(self) -> list[str]:
        return [p for p, _, _ in self.requests]


def ok(data: dict[str, Any]) -> httpx.Response:
    return httpx.Response(200, json={"success": True, "data": data, "message": None})


def write_wav(path: Path, ms: int = 500, rate: int = 16000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x01\x00" * (rate * ms // 1000))


@pytest.fixture
def recorder() -> Recorder:
    return Recorder()


@pytest.fixture
def make_deps(tmp_path: Path, recorder: Recorder) -> Callable[..., HandlerDeps]:
    def make(engine: FakeEngine | None = None, reading: TableReading | None = None) -> HandlerDeps:
        client = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=httpx.MockTransport(recorder.handler), service="worker")
        return HandlerDeps(
            client=client,
            engine=engine or FakeEngine("こんにちは"),
            comparator=TranscriptComparator(reading or TableReading()),
            data_root=tmp_path,
            worker_id="worker-test",
            connection_key="analysis-conn",
            model_label="fake-model",
            app_env="LOCAL",
        )

    return make
