"""분석(검증) STT 어댑터 — VoiceVault whisper-service `POST /transcribe-chunk` 를 HTTP 로 부른다(task-012b, mode=http).

VoiceVault `src/lib/whisper/client.ts transcribeChunk` 와 같은 호출: multipart `file=chunk.wav`(audio/wav) + `language=ja`.
응답 `{language, languageProbability, durationSec, segments:[{startSec, endSec, text}]}` → `TranscriptionResult`.
서비스는 전역 잠금으로 직렬이고 VoiceVault 와 공용이다 — 코드·프로세스는 건드리지 않고 호출만 한다.
세그먼트 confidence 는 서비스가 주지 않는다.

오류 → `SttRequestError(code, retryable)`: 연결 실패·503(모델 미로드) = ANALYSIS_UNAVAILABLE · 타임아웃 = ANALYSIS_TIMEOUT
· 그 밖 5xx = ANALYSIS_SERVER_ERROR · 응답 형식 오류 = ANALYSIS_BAD_RESPONSE (모두 재시도) / 4xx = ANALYSIS_REJECTED(즉시 실패).
응답 본문·전사는 예외·로그에 싣지 않는다.
"""

from __future__ import annotations

import io
import time
import wave
from typing import Any

import httpx

from ....config import AnalysisSttRuntime
from ....logging import get_logger
from ...errors import SttRequestError
from ...interfaces import AudioData, EngineContext, HealthCheckResult, SpeechRequest, TranscriptionResult, TranscriptionSegment

log = get_logger("kaiwa_speech_common.adapters.whisper_http")

ENGINE_ID = "whisper"
MAX_SEGMENTS = 200


def _wav_bytes(audio: AudioData) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(audio.sample_rate)
        w.writeframes(audio.pcm)
    return buf.getvalue()


def _segments(body: Any) -> list[TranscriptionSegment]:
    if not isinstance(body, dict) or not isinstance(body.get("segments"), list):
        raise SttRequestError("ANALYSIS_BAD_RESPONSE", True)
    out: list[TranscriptionSegment] = []
    for i, s in enumerate(body["segments"][:MAX_SEGMENTS]):
        if not isinstance(s, dict) or not isinstance(s.get("text"), str):
            raise SttRequestError("ANALYSIS_BAD_RESPONSE", True)
        start, end = s.get("startSec"), s.get("endSec")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or start < 0 or end < start:
            raise SttRequestError("ANALYSIS_BAD_RESPONSE", True)
        text = s["text"].strip()
        if text:
            out.append(TranscriptionSegment(seg_idx=i, text=text, start_ms=int(start * 1000), end_ms=int(end * 1000)))
    return out


class WhisperHttpEngine:
    """`SpeechToTextEngine`(transcribe) + 가벼운 health. 한 워커 프로세스에 하나(연결 재사용)."""

    def __init__(self, runtime: AnalysisSttRuntime, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._base = runtime.endpoint.rstrip("/")
        self._language = runtime.language
        self.model_label = runtime.model or "unknown"
        self._client = httpx.AsyncClient(timeout=runtime.timeout_ms / 1000, transport=transport, follow_redirects=False)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def transcribe(self, audio: AudioData, request: SpeechRequest, ctx: EngineContext) -> TranscriptionResult:
        files = {"file": ("chunk.wav", _wav_bytes(audio), "audio/wav")}
        t0 = time.monotonic()
        try:
            resp = await self._client.post(f"{self._base}/transcribe-chunk", files=files, data={"language": self._language})
        except httpx.TimeoutException:
            raise SttRequestError("ANALYSIS_TIMEOUT", True) from None
        except httpx.TransportError:
            raise SttRequestError("ANALYSIS_UNAVAILABLE", True) from None
        if resp.status_code == 503:
            raise SttRequestError("ANALYSIS_UNAVAILABLE", True, 503)
        if resp.status_code >= 500:
            raise SttRequestError("ANALYSIS_SERVER_ERROR", True, resp.status_code)
        if resp.status_code != 200:
            raise SttRequestError("ANALYSIS_REJECTED", False, resp.status_code)
        try:
            body = resp.json()
        except ValueError:
            raise SttRequestError("ANALYSIS_BAD_RESPONSE", True, resp.status_code) from None
        segments = _segments(body)
        language = body.get("language") if isinstance(body.get("language"), str) else self._language
        return TranscriptionResult(
            text="".join(s.text for s in segments),
            segments=segments,
            engine_id=ENGINE_ID,
            connection_id=ctx.connection.id,
            language=str(language)[:8],
            timings_ms={"decode": int((time.monotonic() - t0) * 1000)},
        )

    async def health_check(self, ctx: EngineContext | None = None) -> HealthCheckResult:
        t0 = time.monotonic()
        try:
            resp = await self._client.get(f"{self._base}/health", timeout=3.0)
            body = resp.json() if resp.status_code == 200 else {}
        except (httpx.HTTPError, ValueError):
            return HealthCheckResult(ok=False, latency_ms=int((time.monotonic() - t0) * 1000), status="UNAVAILABLE")
        loaded = isinstance(body, dict) and body.get("whisperLoaded") is True
        return HealthCheckResult(ok=loaded, latency_ms=int((time.monotonic() - t0) * 1000), status="HEALTHY" if loaded else "DEGRADED")
