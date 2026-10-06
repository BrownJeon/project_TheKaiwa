"""FastAPI 앱 조립 — 라우트는 얇게, 판단은 holder·params·security 에."""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import resource
import sys
import time
import wave
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from urllib.parse import quote

import numpy as np
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from numpy.typing import NDArray
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import LICENSE, SERVICE_NAME, VERSION
from .backend import Backend, Sbv2Backend
from .config import MAX_BODY_BYTES, MAX_G2P_CHARS, MAX_TEXT_CHARS, Settings
from .holder import ModelHolder, SynthFailed, UnknownModel
from .params import TextError, build_plan, clean_text
from .runtime import QueueTimeout, SerialRunner
from .schemas import G2pIn, SynthesizeIn
from .security import InternalGate
from .timing import STATUS_OK, TIMING_HEADER, encode_header

log = logging.getLogger("kaiwa_tts.server")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after


def _error(status: int, code: str, message: str, retry_after: int | None = None, extra: dict[str, Any] | None = None) -> JSONResponse:
    headers = {"Retry-After": str(retry_after)} if retry_after is not None else None
    body: dict[str, Any] = {"code": code, "message": message}
    if extra:
        body.update(extra)
    return JSONResponse({"error": body}, status_code=status, headers=headers)


def encode_wav(sample_rate: int, audio: NDArray[Any]) -> bytes:
    pcm = np.asarray(audio)
    if pcm.dtype != np.int16:
        pcm = np.clip(pcm, -32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def peak_rss_mb() -> int:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS 는 바이트, Linux 는 KB.
    return int(rss / (1024 * 1024) if sys.platform == "darwin" else rss / 1024)


def accent_string(moras: list[tuple[str, int]]) -> str:
    """モーラ+高低(0/1) → 上がり目 ↑ · 下がり目 ↓ 표기. 구두점에서 악센트 구가 끊긴다."""
    out: list[str] = []
    prev: int | None = None
    for mora, tone in moras:
        if not any(ch.isalpha() for ch in mora):
            out.append(mora)
            prev = None
            continue
        if prev is not None and tone != prev:
            out.append("↑" if tone > prev else "↓")
        out.append(mora)
        prev = tone
    return "".join(out)


def configure_logging(settings: Settings) -> None:
    root = logging.getLogger("kaiwa_tts")
    root.setLevel(settings.log_level)
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(handler)
        root.propagate = False


def create_app(settings: Settings | None = None, backend: Backend | None = None, *, autoload: bool = True) -> FastAPI:
    settings = settings or Settings.from_env()
    configure_logging(settings)
    holder = ModelHolder(settings, backend or Sbv2Backend(settings.bert_model))
    runner = SerialRunner(queue_timeout_s=settings.queue_timeout_ms / 1000)
    started = time.monotonic()
    if not settings.auth_configured:
        log.error("KAIWA_TTS_INTERNAL_SECRET missing or shorter than 16 chars — all protected routes return 401")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task[Any] | None = None
        if autoload:
            # 포트를 먼저 열고 모델은 뒤에서 올린다 — 워치독이 기동 중을 "죽음"으로 오판해 재기동 루프에 빠지지 않게.
            task = asyncio.create_task(runner.run("startup", holder.startup, bounded=False))
        app.state.startup_task = task
        try:
            yield
        finally:
            if task is not None and not task.done():
                task.cancel()
            runner.shutdown()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.holder = holder
    app.state.runner = runner
    app.state.settings = settings
    app.add_middleware(
        InternalGate,
        secret=settings.internal_secret,
        secret_ok=settings.auth_configured,
        max_body_bytes=MAX_BODY_BYTES,
    )

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _error(exc.status, exc.code, exc.message, exc.retry_after)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # 입력값(문장)은 되돌려 주지 않는다 — 위치·종류만.
        fields = [{"loc": ".".join(str(p) for p in e.get("loc", ())), "type": e.get("type", "")} for e in exc.errors()]
        return _error(400, "INVALID_REQUEST", "request body failed validation", extra={"fields": fields[:10]})

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return _error(exc.status_code, code, code.lower().replace("_", " "))

    def health_body() -> tuple[int, dict[str, Any]]:
        models = holder.model_ids
        kind = runner.busy_kind
        # 기동(BERT·모델 3종 로드+워밍업)은 평소 5~7s 지만 첫 MPS 셰이더 컴파일·콜드 디스크를 감안해 4배 여유.
        limit = settings.stuck_sec * (4 if kind == "startup" else 1)
        if kind is not None and runner.busy_for() > limit:
            status = "STUCK"
        elif not settings.auth_configured:
            status = "MISCONFIGURED"
        elif holder.phase == "LOADING":
            status = "LOADING"
        elif not models:
            status = "FAILED"
        elif not holder.warmed_up or holder.device_fallback or settings.default_model not in models:
            status = "DEGRADED"
        else:
            status = "OK"
        body = {
            "ok": status in ("OK", "DEGRADED"),
            "status": status,
            "service": SERVICE_NAME,
            "version": VERSION,
            "license": LICENSE,
            "modelsLoaded": len(models),
            "models": models,
            "defaultModel": settings.default_model,
            "device": holder.device,
            "requestedDevice": holder.requested_device,
            "deviceFallback": holder.device_fallback,
            "warmedUp": holder.warmed_up,
            "coldStartMs": holder.cold_start_ms,
            "uptimeSec": int(time.monotonic() - started),
            "memoryMb": peak_rss_mb(),
            "gpuMb": holder.gpu_mb,
            "queue": runner.depth,
            "authConfigured": settings.auth_configured,
        }
        return (503 if status == "STUCK" else 200), body

    @app.get("/health")
    async def health() -> JSONResponse:
        # 무인증 liveness(워치독·restart.sh·앱 표시등) — 모델·장치·메모리·버전은 싣지 않는다(fingerprinting 최소화, Codex C2).
        status_code, body = health_body()
        return JSONResponse({"status": body["status"], "warmedUp": body["warmedUp"]}, status_code=status_code)

    @app.get("/health/detail")
    async def health_detail() -> JSONResponse:
        # InternalGate 가 X-Internal-Secret 을 요구한다(PUBLIC_PATHS 는 /health 정확 일치만).
        status_code, body = health_body()
        return JSONResponse(body, status_code=status_code)

    @app.get("/voices")
    async def voices() -> dict[str, Any]:
        return {"defaultModel": settings.default_model, "models": holder.catalog()}

    @app.post("/synthesize")
    async def synthesize(req: SynthesizeIn) -> Response:
        t0 = time.perf_counter()
        try:
            text = clean_text(req.text, MAX_TEXT_CHARS)
        except TextError as e:
            raise ApiError(400, e.code, str(e)) from None
        if holder.phase == "LOADING":
            raise ApiError(503, "NOT_READY", "models are loading", retry_after=5)
        if not holder.model_ids:
            raise ApiError(503, "NOT_READY", "no model is loaded", retry_after=30)
        model_id = req.voice.model or settings.default_model
        lm = holder.get(model_id)
        if lm is None:
            raise ApiError(400, "UNKNOWN_MODEL", "model is not loaded")
        if req.voice.speaker not in {i for i, _ in lm.info.speakers}:
            raise ApiError(400, "UNKNOWN_SPEAKER", "speaker is not defined for this model")
        plan = build_plan(req, text, lm.info.styles)
        try:
            result, queue_ms = await runner.run("synth", lambda: holder.synthesize(model_id, plan))
        except QueueTimeout:
            log.warning("synth busy trace=%s model=%s queue_timeout_ms=%d", req.traceId or "-", model_id, settings.queue_timeout_ms)
            raise ApiError(503, "BUSY", "synthesis queue is full", retry_after=2) from None
        except UnknownModel:
            raise ApiError(400, "UNKNOWN_MODEL", "model is not loaded") from None
        except SynthFailed as e:
            log.error("synth failed trace=%s model=%s err=%s", req.traceId or "-", model_id, e)
            raise ApiError(500, "SYNTH_FAILED", "synthesis failed") from None
        t_enc = time.perf_counter()
        wav = encode_wav(result.sample_rate, result.audio)
        encode_ms = int((time.perf_counter() - t_enc) * 1000)
        audio_ms = int(result.audio.size * 1000 / result.sample_rate)
        timing_status = result.timing_status
        timing_value: str | None = None
        if result.timing is not None:
            timing_value = encode_header(result.timing)
            if timing_value is None:
                timing_status = "too_large"
        total_ms = int((time.perf_counter() - t0) * 1000)
        headers = {
            "X-Kaiwa-Latency-Ms": str(total_ms),
            "X-Kaiwa-Queue-Ms": str(queue_ms),
            "X-Kaiwa-Synth-Ms": str(result.synth_ms),
            "X-Kaiwa-Encode-Ms": str(encode_ms),
            "X-Kaiwa-Audio-Ms": str(audio_ms),
            "X-Kaiwa-Sample-Rate": str(result.sample_rate),
            "X-Kaiwa-Model": model_id,
            "X-Kaiwa-Style": quote(plan.style, safe=""),
            "X-Kaiwa-Style-Fallback": "1" if plan.style_fallback else "0",
            "X-Kaiwa-Adjust": result.adjust,
            "X-Kaiwa-Timing": timing_status,
            "X-Kaiwa-Timing-Ms": f"{result.timing_ms:.2f}",
            "X-Service-Version": VERSION,
            "Cache-Control": "no-store",
        }
        # 요청 스키마는 그대로 두고 응답 헤더로만 싣는다 — 구 앱은 모르는 헤더를 무시하고, 새 앱은 구 서비스에서 헤더가
        # 없으면 timing=null 로 동작한다(배포 순서 무관, task-012b-4 Leader 결정).
        if timing_value is not None and timing_status == STATUS_OK:
            headers[TIMING_HEADER] = timing_value
        if req.traceId:
            headers["X-Trace-Id"] = req.traceId
        # 문장 원문은 어떤 로그 레벨에서도 남기지 않는다 — 글자 수·해시 앞 12자·traceId 로만 대조한다(Codex C2).
        log.info(
            "synth ok trace=%s model=%s profile=%s chars=%d text_sha=%s audio_ms=%d queue_ms=%d synth_ms=%d total_ms=%d adjust=%s"
            " timing=%s timing_words=%d timing_ms=%.2f",
            req.traceId or "-",
            model_id,
            req.profile or "-",
            len(text),
            text_digest(text),
            audio_ms,
            queue_ms,
            result.synth_ms,
            total_ms,
            result.adjust,
            timing_status,
            len(result.timing.words) if result.timing is not None else 0,
            result.timing_ms,
        )
        return Response(content=wav, media_type="audio/wav", headers=headers)

    @app.post("/g2p")
    async def g2p(req: G2pIn) -> dict[str, Any]:
        try:
            text = clean_text(req.text, MAX_G2P_CHARS)
        except TextError as e:
            raise ApiError(400, e.code, str(e)) from None
        try:
            (normalized, moras), _ = await runner.run("g2p", lambda: holder.g2p(text))
        except QueueTimeout:
            raise ApiError(503, "BUSY", "queue is full", retry_after=2) from None
        except Exception as e:  # noqa: BLE001
            log.error("g2p failed err=%s", type(e).__name__)
            raise ApiError(500, "G2P_FAILED", "g2p failed") from None
        return {
            "normalizedText": normalized,
            "reading": "".join(m for m, _ in moras),
            "accent": accent_string(moras),
            "moras": [{"mora": m, "tone": t} for m, t in moras],
        }

    @app.post("/admin/models/refresh")
    async def refresh() -> dict[str, Any]:
        try:
            summary, _ = await runner.run("refresh", holder.refresh)
        except QueueTimeout:
            raise ApiError(503, "BUSY", "queue is full", retry_after=2) from None
        return summary

    return app
