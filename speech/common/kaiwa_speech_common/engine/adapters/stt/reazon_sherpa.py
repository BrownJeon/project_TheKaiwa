"""ReazonSpeech zipformer int8 + silero VAD (sherpa-onnx) — 실시간 STT 엔진 어댑터.

엔진명(reazon·sherpa)은 이 파일(과 adapters 레지스트리) 안에서만 쓴다. 상위(gateway)는 `EngineRole` 과
`RealtimeSttSession` 계약만 안다.

실시간 세션 동작
- 프레임마다 VAD(silero, 무음 `endpoint_silence_ms` 로 세그먼트 종료)에 넣는다. VAD 는 가볍고 동기다.
- 끝난 세그먼트는 세션 버퍼에서 ±여유를 붙여 잘라 **세션별 순차 작업 큐**에 넣고, 디코드는 공용 스레드 풀에서 한다.
  VAD 전이·partial·final 도 같은 큐를 지나므로 클라이언트가 받는 순서가 발화 순서와 같다.
- `endpoint=manual`(푸시투토크): 세그먼트 → partial, `stop`/발화 상한 → final(세그먼트 텍스트를 이음).
  `endpoint=auto`: 세그먼트 1개 = 발화 1개(끝점 final). `stop` 은 진행 중 음성을 강제로 끊어 final.
- 오디오·텍스트 본문은 로그에 남기지 않는다.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

from ....audio import SAMPLE_RATE, duration_ms, pcm16_to_float32
from ....config import SttRuntime
from ....logging import get_logger
from ...errors import EngineOverloadedError, EngineUnavailableError
from ...interfaces import (
    AudioData,
    ConfigurationKey,
    ConfigurationSchema,
    ConnectionType,
    EngineContext,
    EngineDescriptor,
    EngineType,
    ErrorCallback,
    FinalCallback,
    FunctionalTestResult,
    HealthCheckResult,
    PartialCallback,
    SpeechRequest,
    TranscriptionResult,
    TranscriptionSegment,
    UtteranceResult,
    VadCallback,
)

log = get_logger("kaiwa_speech_common.adapters.stt.reazon_sherpa")

ENGINE_ID = "reazon-sherpa"
MODEL_NAME = "reazonspeech-int8"
_VERSION_RE = re.compile(r"^[A-Za-z0-9._-]{3,64}$")
_FILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_ROLES = ("encoder", "decoder", "joiner", "tokens", "vad")

PAD_BEFORE_MS = 200
PAD_AFTER_MS = 300
# 디코드 입력 앞뒤에 덧대는 무음. 앞 무음이 ~0.3s 이하면 발화 첫 단어가 통째로 빠진다
# (stt20 01 「こんにちは、今日は…」 → 「今日は…」, 2026-09-28 실측: +0.2s 부터 회복) — 여유를 두어 0.4s.
LEAD_ZERO_MS = 400
TAIL_ZERO_MS = 200  # stop 직후처럼 세그먼트가 버퍼 끝에서 잘리면 마지막 토큰이 안 나오는 것을 막는다
AUTO_TRIM_OVER_MS = 5000
AUTO_KEEP_TAIL_MS = 3000
MAX_QUEUE = 512
VAD_BUFFER_EXTRA_SEC = 10


def _ms_to_samples(ms: int) -> int:
    return SAMPLE_RATE * ms // 1000


def _samples_to_ms(n: int) -> int:
    return n * 1000 // SAMPLE_RATE


_LEAD_ZEROS = np.zeros(_ms_to_samples(LEAD_ZERO_MS), dtype=np.float32)
_TAIL_ZEROS = np.zeros(_ms_to_samples(TAIL_ZERO_MS), dtype=np.float32)


@dataclass(frozen=True)
class ModelFiles:
    name: str
    version: str
    directory: Path
    paths: dict[str, Path]

    @property
    def label(self) -> str:
        return f"{self.name}@{self.version}"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load_manifest(models_dir: Path, verify_sha256: bool = True) -> ModelFiles:
    """`<models_dir>/reazonspeech-int8/manifest.json` 을 읽어 버전 디렉터리의 파일을 검증한다(speech/models/README §3)."""
    root = models_dir / MODEL_NAME
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise EngineUnavailableError("model manifest not found") from None
    except ValueError:
        raise EngineUnavailableError("model manifest is not valid json") from None
    version = str(manifest.get("version", ""))
    if manifest.get("name") != MODEL_NAME or not _VERSION_RE.match(version):
        raise EngineUnavailableError("model manifest name/version invalid")
    directory = root / version
    paths: dict[str, Path] = {}
    total = 0
    for entry in manifest.get("files") or []:
        rel = str(entry.get("path", ""))
        role = str(entry.get("role", ""))
        if not _FILE_RE.match(rel) or ".." in rel or role not in _ROLES:
            raise EngineUnavailableError("model manifest file entry invalid")
        path = directory / rel
        if not path.is_file() or path.stat().st_size != int(entry.get("bytes", -1)):
            raise EngineUnavailableError(f"model file missing or size mismatch: {rel}")
        if verify_sha256 and _sha256(path) != str(entry.get("sha256", "")).lower():
            raise EngineUnavailableError(f"model file sha256 mismatch: {rel}")
        paths[role] = path
        total += path.stat().st_size
    if set(paths) != set(_ROLES):
        raise EngineUnavailableError("model manifest missing roles")
    if manifest.get("totalBytes") is not None and int(manifest["totalBytes"]) != total:
        raise EngineUnavailableError("model manifest totalBytes mismatch")
    return ModelFiles(name=MODEL_NAME, version=version, directory=directory, paths=paths)


class ReazonSherpaProvider:
    """EngineProvider + RealtimeSttEngine. 모델은 프로세스당 1회 로드(싱글턴), 디코드는 공용 스레드 풀."""

    def __init__(self, stt: SttRuntime, models_dir: Path, decode_workers: int = 2, verify_sha256: bool = True) -> None:
        self._stt = stt
        self._models_dir = models_dir
        self._verify = verify_sha256
        self._executor = ThreadPoolExecutor(max_workers=max(1, decode_workers), thread_name_prefix="stt-decode")
        self._recognizer: Any = None
        self._files: ModelFiles | None = None
        self.load_ms: int | None = None
        self.error: str | None = None

    # ── 수명 ────────────────────────────────────────────────────────────────
    def load(self) -> None:
        """블로킹 로드(기동 스레드에서 부른다). 실패는 `error` 에 짧은 사유만 남기고 예외를 다시 던진다."""
        t0 = time.monotonic()
        try:
            import sherpa_onnx  # noqa: PLC0415 — 테스트는 모델·네이티브 라이브러리 없이 돈다

            files = load_manifest(self._models_dir, self._verify)
            recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=str(files.paths["encoder"]),
                decoder=str(files.paths["decoder"]),
                joiner=str(files.paths["joiner"]),
                tokens=str(files.paths["tokens"]),
                num_threads=self._stt.num_threads,
                sample_rate=SAMPLE_RATE,
                feature_dim=80,
                decoding_method=self._stt.decoding_method,
            )
            self._recognizer = recognizer
            self._files = files
            self._decode_blocking(np.zeros(SAMPLE_RATE // 2, dtype=np.float32))  # 첫 디코드 지연(그래프 초기화)을 기동에 흡수
        except EngineUnavailableError as e:
            self.error = str(e)
            raise
        except Exception as e:
            self.error = f"load failed: {type(e).__name__}"
            raise EngineUnavailableError(self.error) from e
        self.load_ms = int((time.monotonic() - t0) * 1000)
        self.error = None
        log.info("model loaded %s in %dms threads=%d", files.label, self.load_ms, self._stt.num_threads)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    @property
    def loaded(self) -> bool:
        return self._recognizer is not None

    @property
    def model_label(self) -> str:
        return self._files.label if self._files else f"{MODEL_NAME}@?"

    # ── EngineProvider ─────────────────────────────────────────────────────
    def descriptor(self) -> EngineDescriptor:
        return EngineDescriptor(
            engine_id=ENGINE_ID,
            display_name="ReazonSpeech (sherpa-onnx)",
            type=EngineType.STT,
            connection_types=(ConnectionType.LOCAL, ConnectionType.ONDEVICE),
            capabilities={"realtime": True, "languages": ["ja"], "sampleRate": SAMPLE_RATE},
            license="Apache-2.0",
        )

    def configuration_schema(self) -> ConfigurationSchema:
        s = SttRuntime()
        return ConfigurationSchema(
            engine_id=ENGINE_ID,
            version=1,
            keys=(
                ConfigurationKey("runtime.vad.silenceMs", "integer", s.endpoint_silence_ms, min=100, max=3000),
                ConfigurationKey("runtime.vad.threshold", "number", s.vad_threshold, min=0.05, max=0.95),
                ConfigurationKey("runtime.numThreads", "integer", s.num_threads, min=1, max=8, restart_required=True),
                ConfigurationKey(
                    "runtime.decodingMethod",
                    "enum",
                    s.decoding_method,
                    enum=("greedy_search", "modified_beam_search"),
                    restart_required=True,
                ),
            ),
        )

    async def health_check(self, ctx: EngineContext | None = None) -> HealthCheckResult:
        return HealthCheckResult(
            ok=self.loaded,
            latency_ms=0,
            status="HEALTHY" if self.loaded else "UNAVAILABLE",
            detail={"loaded": self.loaded, "model": self.model_label, "loadMs": self.load_ms, "error": self.error},
        )

    async def functional_test(self, ctx: EngineContext | None = None, asset_path: str | None = None) -> FunctionalTestResult:
        from ....audio import read_wav_pcm16  # noqa: PLC0415

        if not asset_path:
            return FunctionalTestResult(ok=False, latency_ms=0, summary="no asset")
        pcm, rate = read_wav_pcm16(Path(asset_path))
        if rate != SAMPLE_RATE:
            return FunctionalTestResult(ok=False, latency_ms=0, summary="asset must be 16kHz")
        t0 = time.monotonic()
        text = await self.decode(pcm16_to_float32(pcm))
        ms = int((time.monotonic() - t0) * 1000)
        return FunctionalTestResult(ok=bool(text), latency_ms=ms, summary=f"{len(text)} chars in {ms}ms")

    def engine(self) -> ReazonSherpaProvider:
        return self

    # ── 디코드 ─────────────────────────────────────────────────────────────
    def _decode_blocking(self, samples: npt.NDArray[np.float32]) -> str:
        stream = self._recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples)
        self._recognizer.decode_stream(stream)
        return str(stream.result.text).strip()

    async def decode(self, samples: npt.NDArray[np.float32]) -> str:
        if not self.loaded:
            raise EngineUnavailableError("model not loaded")
        padded = np.concatenate([_LEAD_ZEROS, samples, _TAIL_ZEROS])
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self._decode_blocking, padded)

    async def transcribe(
        self, audio: AudioData, request: SpeechRequest | None = None, ctx: EngineContext | None = None
    ) -> TranscriptionResult:
        """오디오 한 덩어리(≤30s 권장)를 그대로 디코드한다 — 측정·기능 테스트용."""
        t0 = time.monotonic()
        text = await self.decode(pcm16_to_float32(audio.pcm))
        ms = int((time.monotonic() - t0) * 1000)
        seg = TranscriptionSegment(seg_idx=0, text=text, start_ms=0, end_ms=duration_ms(len(audio.pcm)))
        return TranscriptionResult(text=text, segments=(seg,), engine_id=ENGINE_ID, timings_ms={"decode": ms})

    def new_vad(self, buffer_sec: float) -> Any:
        import sherpa_onnx  # noqa: PLC0415

        cfg = sherpa_onnx.VadModelConfig()
        assert self._files is not None
        cfg.silero_vad.model = str(self._files.paths["vad"])
        cfg.silero_vad.threshold = self._stt.vad_threshold
        cfg.silero_vad.min_silence_duration = self._stt.endpoint_silence_ms / 1000
        cfg.silero_vad.min_speech_duration = self._stt.min_speech_ms / 1000
        cfg.silero_vad.max_speech_duration = float(self._stt.max_segment_sec)
        cfg.sample_rate = SAMPLE_RATE
        cfg.num_threads = 1
        return sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=buffer_sec)

    async def open_session(
        self,
        request: SpeechRequest,
        ctx: EngineContext | None,
        on_vad: VadCallback,
        on_partial: PartialCallback,
        on_final: FinalCallback,
        on_error: ErrorCallback,
    ) -> SherpaRealtimeSession:
        if not self.loaded:
            raise EngineUnavailableError("model not loaded")
        opts = request.options
        max_utterance_ms = int(opts.get("max_utterance_ms", 60000))
        return SherpaRealtimeSession(
            decode=self.decode,
            vad=self.new_vad(max_utterance_ms / 1000 + VAD_BUFFER_EXTRA_SEC),
            endpoint_auto=opts.get("endpoint") == "auto",
            partial=bool(opts.get("partial", self._stt.partial)),
            max_utterance_ms=max_utterance_ms,
            on_vad=on_vad,
            on_partial=on_partial,
            on_final=on_final,
            on_error=on_error,
        )


# ── 세션 ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _VadJob:
    gen: int
    state: str
    at_ms: int


@dataclass(frozen=True)
class _SegJob:
    gen: int
    samples: npt.NDArray[np.float32]
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class _FinalJob:
    gen: int
    reason: str
    pcm: bytes
    vad_ms: int
    trigger: float


@dataclass(frozen=True)
class _DropJob:
    gen: int


_Job = _VadJob | _SegJob | _FinalJob | _DropJob


class SherpaRealtimeSession:
    """`RealtimeSttSession` 구현. VAD 객체는 세션 전용, 디코더는 provider 공용."""

    def __init__(
        self,
        *,
        decode: Callable[[npt.NDArray[np.float32]], Awaitable[str]],
        vad: Any,
        endpoint_auto: bool,
        partial: bool,
        max_utterance_ms: int,
        on_vad: VadCallback,
        on_partial: PartialCallback,
        on_final: FinalCallback,
        on_error: ErrorCallback,
    ) -> None:
        self._decode = decode
        self._vad = vad
        self._auto = endpoint_auto
        self._partial = partial and not endpoint_auto
        self._max_bytes = _ms_to_samples(max_utterance_ms) * 2
        self._on_vad = on_vad
        self._on_partial = on_partial
        self._on_final = on_final
        self._on_error = on_error
        self._buf = bytearray()
        self._origin = 0  # VAD 샘플 인덱스 ↔ _buf[0]
        self._fed = 0  # VAD 에 넣은 누적 샘플(VAD 인덱스 기준)
        self._speech = False
        self._gen = 0
        self._dropped: set[int] = set()
        self._segs: dict[int, list[TranscriptionSegment]] = {}
        self._decode_ms: dict[int, int] = {}
        self._queue: asyncio.Queue[_Job | None] = asyncio.Queue(maxsize=MAX_QUEUE)
        self._closed = False
        self._worker = asyncio.get_running_loop().create_task(self._run())

    @property
    def elapsed_ms(self) -> int:
        return duration_ms(len(self._buf))

    # ── 입력 ───────────────────────────────────────────────────────────────
    async def push_frame(self, pcm16_frame: bytes) -> None:
        if self._closed:
            return
        self._buf += pcm16_frame
        samples = pcm16_to_float32(pcm16_frame)
        self._vad.accept_waveform(samples)
        self._fed += len(samples)
        self._check_vad_state()
        self._drain(final_reason="endpoint")
        if not self._auto and len(self._buf) >= self._max_bytes:
            self._finish("max_length")
        elif self._auto and not self._speech:
            self._trim_idle()

    async def stop(self) -> None:
        if not self._closed:
            self._finish("stop")

    async def cancel(self) -> None:
        if self._closed:
            return
        self._dropped.add(self._gen)
        self._put(_DropJob(self._gen))
        self._reset_utterance()
        if self._speech:
            self._speech = False
            self._put(_VadJob(self._gen, "SILENCE", 0))

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._worker.cancel()
        await asyncio.gather(self._worker, return_exceptions=True)

    # ── 내부: VAD·세그먼트 ─────────────────────────────────────────────────
    def _put(self, job: _Job) -> None:
        try:
            self._queue.put_nowait(job)
        except asyncio.QueueFull:
            raise EngineOverloadedError("session work queue full") from None

    def _at_ms(self) -> int:
        return _samples_to_ms(self._fed - self._origin)

    def _check_vad_state(self) -> None:
        detected = bool(self._vad.is_speech_detected())
        if detected != self._speech:
            self._speech = detected
            self._put(_VadJob(self._gen, "SPEECH" if detected else "SILENCE", self._at_ms()))

    def _slice(self, a: int, b: int) -> bytes:
        lo = max(a, self._origin) - self._origin
        hi = max(min(b, self._fed), self._origin) - self._origin
        return bytes(self._buf[lo * 2 : hi * 2])

    def _samples_for_decode(self, a: int, b: int) -> npt.NDArray[np.float32]:
        return pcm16_to_float32(self._slice(a, b))

    def _drain(self, final_reason: str) -> None:
        while not self._vad.empty():
            seg = self._vad.front
            start = int(seg.start)
            end = start + len(seg.samples)
            self._vad.pop()
            self._enqueue_segment(start, end, final_reason)

    def _enqueue_segment(self, start: int, end: int, final_reason: str) -> None:
        a = max(start - _ms_to_samples(PAD_BEFORE_MS), self._origin)
        b = min(end + _ms_to_samples(PAD_AFTER_MS), self._fed)
        if self._auto:
            # 끝점 모드: 세그먼트 1개 = 발화 1개. 버퍼는 세그먼트 끝까지 잘라 다음 발화의 시작으로 남긴다.
            origin = a
            self._put(_SegJob(self._gen, self._samples_for_decode(a, b), _samples_to_ms(start - origin), _samples_to_ms(end - origin)))
            self._put(_FinalJob(self._gen, final_reason, self._slice(a, b), _samples_to_ms(max(0, self._fed - end)), time.monotonic()))
            cut = max(0, min(end, self._fed) - self._origin)
            del self._buf[: cut * 2]
            self._origin += cut
            self._gen += 1
        else:
            samples = self._samples_for_decode(a, b)
            self._put(_SegJob(self._gen, samples, _samples_to_ms(start - self._origin), _samples_to_ms(end - self._origin)))

    def _trim_idle(self) -> None:
        held = self._fed - self._origin
        if held > _ms_to_samples(AUTO_TRIM_OVER_MS):
            cut = held - _ms_to_samples(AUTO_KEEP_TAIL_MS)
            del self._buf[: cut * 2]
            self._origin += cut

    def _finish(self, reason: str) -> None:
        """현재 발화를 닫는다 — 이 호출 1회당 on_final 이 정확히 1회 나간다."""
        trigger = time.monotonic()
        if self._auto:
            self._drain(final_reason="endpoint")  # flush 전에 이미 끝난 세그먼트는 각자 끝점 final
            gen_before = self._gen
            self._vad.flush()
            self._drain(final_reason=reason)  # 진행 중이던 음성 = 이번 stop 의 final
            if self._gen == gen_before:
                self._put(_FinalJob(self._gen, reason, b"", 0, trigger))
                self._gen += 1
            self._vad.reset()
            self._buf = bytearray()
            self._origin = 0
            self._fed = 0
            if self._speech:
                self._speech = False
                self._put(_VadJob(self._gen, "SILENCE", 0))
            return
        self._vad.flush()
        self._drain(final_reason=reason)
        if self._speech:
            self._speech = False
            self._put(_VadJob(self._gen, "SILENCE", self._at_ms()))
        self._put(_FinalJob(self._gen, reason, bytes(self._buf), 0, trigger))
        self._reset_utterance()

    def _reset_utterance(self) -> None:
        self._vad.reset()
        self._buf = bytearray()
        self._origin = 0
        self._fed = 0
        self._gen += 1

    # ── 작업자: 순서 보장 ───────────────────────────────────────────────────
    async def _run(self) -> None:
        try:
            while True:
                job = await self._queue.get()
                if job is None:
                    return
                if isinstance(job, _DropJob):
                    self._segs.pop(job.gen, None)
                    self._decode_ms.pop(job.gen, None)
                    self._dropped.discard(job.gen)
                    continue
                if job.gen in self._dropped:
                    continue
                if isinstance(job, _VadJob):
                    await self._on_vad(job.state, job.at_ms)
                elif isinstance(job, _SegJob):
                    await self._run_segment(job)
                else:
                    await self._run_final(job)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001 — 세션 치명 오류는 상위(on_error)로 넘긴다
            self._closed = True
            log.warning("realtime session failed: %s", type(e).__name__)
            await self._on_error(e)

    async def _run_segment(self, job: _SegJob) -> None:
        t0 = time.monotonic()
        text = await self._decode(job.samples)
        self._decode_ms[job.gen] = self._decode_ms.get(job.gen, 0) + int((time.monotonic() - t0) * 1000)
        if not text:
            return
        segs = self._segs.setdefault(job.gen, [])
        seg = TranscriptionSegment(seg_idx=len(segs), text=text, start_ms=job.start_ms, end_ms=job.end_ms)
        segs.append(seg)
        if self._partial:
            await self._on_partial(seg)

    async def _run_final(self, job: _FinalJob) -> None:
        segs = tuple(self._segs.pop(job.gen, []))
        decode_ms = self._decode_ms.pop(job.gen, 0)
        text = "".join(s.text for s in segs)
        audio = AudioData(pcm=job.pcm, sample_rate=SAMPLE_RATE, duration_ms=duration_ms(len(job.pcm)))
        result = TranscriptionResult(text=text, segments=segs, engine_id=ENGINE_ID, timings_ms={"decode": decode_ms})
        stt_ms = int((time.monotonic() - job.trigger) * 1000)
        await self._on_final(
            UtteranceResult(
                result=result, audio=audio, reason=job.reason, timings_ms={"vad": job.vad_ms, "stt": stt_ms, "decode": decode_ms}
            )
        )
