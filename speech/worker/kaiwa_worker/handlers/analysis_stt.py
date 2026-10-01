"""ANALYSIS_STT 잡 1건(task-012b, api-contract §2-30 worker 루프).

  오디오(DATA_ROOT/audioPath, 규약 밖·없음 → AUDIO_MISSING, 형식 오류 → AUDIO_INVALID)
  → 분석 STT(엔진은 레지스트리가 준 것 — 이 파일은 엔진명을 모른다, 실패 → SttRequestError 코드·retryable)
  → 비교기(both_empty → EMPTY_TRANSCRIPTS) → #138(앱이 requiresReview 판정·한 트랜잭션 저장)
  #138 응답: 200 끝 · 404/409(잡이 이 발화 것이 아님·이미 끝남) 무시 · 그 밖 4xx → CALLBACK_REJECTED(재시도 없음) · 5xx·연결·타임아웃 → CALLBACK_FAILED(재시도).
  실패는 #140 으로 보고(claim 세대 `attempt` 포함 — 409 STALE_CLAIM 은 무시). 보고마저 실패하면 잡은 RUNNING 으로 남고 다음 claim 의 self-reclaim
  (또는 15분 고아 회수)이 되돌린다.
로그: 잡 id·시도·길이·지문·similarity·flags·코드값만 — 전사 원문·경로 없음.
"""

from __future__ import annotations

import asyncio
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from kaiwa_speech_common.audio import read_wav_pcm16
from kaiwa_speech_common.engine.errors import SttRequestError
from kaiwa_speech_common.engine.interfaces import (
    AudioData,
    ConnectionProfile,
    ConnectionType,
    EngineContext,
    EngineRole,
    SpeechRequest,
)
from kaiwa_speech_common.ids import trace_id as new_trace_id
from kaiwa_speech_common.internal_client import CallbackError, InternalClient
from kaiwa_speech_common.logging import get_logger, text_fingerprint

from ..comparator import TranscriptComparator
from ..jobs import ClaimedJob
from ..paths import MAX_AUDIO_BYTES, resolve_audio

log = get_logger("kaiwa_worker.analysis_stt")
ANALYSIS_TEXT_MAX = 2000
SEGMENTS_MAX = 200


@dataclass(frozen=True)
class HandlerDeps:
    client: InternalClient
    engine: Any  # SpeechToTextEngine(transcribe) — 레지스트리가 만든 것
    comparator: TranscriptComparator
    data_root: Path
    worker_id: str
    connection_key: str
    model_label: str
    app_env: str


@dataclass(frozen=True)
class Outcome:
    status: str  # STORED | ALREADY | IGNORED | FAILED
    error: str | None = None
    retryable: bool = False
    report_status: str | None = None  # #140 응답 jobStatus(QUEUED|FAILED) 또는 STALE|ERROR


class JobFailure(Exception):
    def __init__(self, code: str, retryable: bool) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable


def _read_audio(deps: HandlerDeps, job: ClaimedJob) -> AudioData:
    path = resolve_audio(deps.data_root, job.audio_path)
    if path is None:
        raise JobFailure("AUDIO_MISSING", False)
    try:
        if path.stat().st_size > MAX_AUDIO_BYTES:
            raise JobFailure("AUDIO_INVALID", False)
        pcm, rate = read_wav_pcm16(path)
    except JobFailure:
        raise
    except FileNotFoundError:
        raise JobFailure("AUDIO_MISSING", False) from None
    except (ValueError, EOFError, OSError, wave.Error):
        raise JobFailure("AUDIO_INVALID", False) from None
    if not pcm:
        raise JobFailure("AUDIO_INVALID", False)
    return AudioData(pcm=pcm, sample_rate=rate, duration_ms=len(pcm) // 2 * 1000 // max(rate, 1))


def _ctx(deps: HandlerDeps) -> EngineContext:
    conn = ConnectionProfile(id=deps.connection_key, engine_id="", role=EngineRole.ANALYSIS_STT, connection_type=ConnectionType.HTTP, enabled=True)
    return EngineContext(connection=conn, environment=deps.app_env)


async def _report(deps: HandlerDeps, job: ClaimedJob, code: str, retryable: bool, trace: str) -> Outcome:
    try:
        data = await deps.client.report_failure(job.id, deps.worker_id, code, retryable, trace, attempt=job.attempts)
        status = data.get("jobStatus") if isinstance(data.get("jobStatus"), str) else "?"
        log.warning("job failed job=%s attempts=%d error=%s retryable=%s jobStatus=%s trace=%s", job.id, job.attempts, code, retryable, status, trace)
        return Outcome("FAILED", code, retryable, str(status))
    except CallbackError as e:
        if e.status == 409:
            log.info("failure report stale job=%s error=%s trace=%s", job.id, code, trace)
            return Outcome("FAILED", code, retryable, "STALE")
        log.error("failure report failed job=%s error=%s status=%d trace=%s", job.id, code, e.status, trace)
        return Outcome("FAILED", code, retryable, "ERROR")


async def handle_analysis_stt(job: ClaimedJob, deps: HandlerDeps) -> Outcome:
    trace = new_trace_id()
    t0 = time.monotonic()
    try:
        audio = await asyncio.to_thread(_read_audio, deps, job)
        request = SpeechRequest(trace_id=trace, role=EngineRole.ANALYSIS_STT, utterance_id=job.utterance_id)
        try:
            result = await deps.engine.transcribe(audio, request, _ctx(deps))
        except SttRequestError as e:
            raise JobFailure(e.code, e.retryable) from None
        stt_ms = int((time.monotonic() - t0) * 1000)
        analysis_text = result.text.strip()[:ANALYSIS_TEXT_MAX]
        cmp = await asyncio.to_thread(deps.comparator.compare, job.realtime_text, analysis_text)
        if cmp.both_empty:
            raise JobFailure("EMPTY_TRANSCRIPTS", False)
        payload = {
            "jobId": job.id,
            "workerId": deps.worker_id,
            "analysisEngine": deps.connection_key,
            "analysisText": analysis_text,
            "segments": [{"start": s.start_ms, "end": s.end_ms, "text": s.text[:ANALYSIS_TEXT_MAX]} for s in list(result.segments)[:SEGMENTS_MAX]],
            "language": result.language if result.language.isalpha() and 2 <= len(result.language) <= 3 else "ja",
            "latencyMs": int((time.monotonic() - t0) * 1000),
            "comparator": {
                "similarity": cmp.similarity,
                "flags": list(cmp.flags),
                "realtimeLen": cmp.realtime_len,
                "analysisLen": cmp.analysis_len,
                "version": deps.comparator.version,
            },
            "pronunciation": None,
            "engineVersions": {"analysisStt": deps.model_label, "reading": deps.comparator.reading.version},
            "traceId": trace,
        }
    except JobFailure as f:
        return await _report(deps, job, f.code, f.retryable, trace)
    except Exception as e:  # noqa: BLE001 — 알 수 없는 오류도 잡을 RUNNING 에 방치하지 않고 재시도 대상으로 보고한다
        log.error("job crashed job=%s exc=%s trace=%s", job.id, type(e).__name__, trace)
        return await _report(deps, job, "WORKER_ERROR", True, trace)

    try:
        data = await deps.client.post_analysis(job.utterance_id, payload, trace)
    except CallbackError as e:
        if e.status in (404, 409):
            log.info("analysis result ignored job=%s status=%d trace=%s", job.id, e.status, trace)
            return Outcome("IGNORED")
        if 400 <= e.status < 500:
            return await _report(deps, job, "CALLBACK_REJECTED", False, trace)
        return await _report(deps, job, "CALLBACK_FAILED", True, trace)
    stored = data.get("stored") is True
    log.info(
        "job done job=%s attempts=%d stored=%s sttMs=%d totalMs=%d realtime[%s] analysis[%s] similarity=%.3f flags=%s review=%s trace=%s",
        job.id,
        job.attempts,
        stored,
        stt_ms,
        int((time.monotonic() - t0) * 1000),
        text_fingerprint(job.realtime_text),
        text_fingerprint(analysis_text),
        cmp.similarity,
        ",".join(cmp.flags) or "-",
        data.get("requiresReview"),
        trace,
    )
    return Outcome("STORED" if stored else "ALREADY")
