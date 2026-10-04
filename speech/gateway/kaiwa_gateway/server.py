"""gateway FastAPI 앱 — `GET /health` · `WS /ws/speech` · `POST /text/annotate`(내부 전용).
127.0.0.1 전용 바인드(nginx 가 /ws/speech 만 프록시).

- 모델은 기동 직후 백그라운드 스레드에서 1회 로드한다. 로드 중·실패여도 `/health` 는 응답하고 WS start 는 4422.
- `/health` 는 시크릿 없이 `{ok, status}` 만, 올바른 `X-Internal-Secret` 이 붙으면 #143 상세(시크릿·경로 없음).
- `/text/annotate`(task-026 S1): 앱 서버만 부른다(`X-Internal-Secret` 필수 — 없거나 틀리면 401). 형태소별 표기·읽기(`text.py`).
  분석기는 전용 1-스레드 executor 에서 기동 때 1회 로드한다(실시간 인식 WS 와 executor 를 같이 쓰지 않는다).
  대기+실행 작업이 `MAX_PENDING` 이면 503 BUSY(입력 없음 — 분석기 불가 503 NOT_READY 와 구분).
  원문은 로그에 남기지 않는다(건수·길이·ms 만).
- `/docs`·`/openapi.json` 은 끈다. `/admin/*`(#144~#146)은 Phase 2.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse

from kaiwa_speech_common import __version__ as common_version
from kaiwa_speech_common.config import Settings, load_settings
from kaiwa_speech_common.engine.errors import EngineUnavailableError
from kaiwa_speech_common.internal_client import InternalClient
from kaiwa_speech_common.logging import get_logger, setup_logging
from kaiwa_speech_common.router import SpeechEngineRouter

from . import __version__
from .connection import GatewayConnection, GatewayDeps
from .limits import SessionRegistry
from .store import UtteranceStore
from .text import MAX_BODY_BYTES, VERSION, TextAnnotator, TextBusyError, TextRequestError, parse_request
from .ticket import TicketVerifier

log = get_logger("kaiwa_gateway")

# 이 사유가 있으면 서비스가 제 역할을 못 한다(MISCONFIGURED). 나머지(yml 키 오류 등)는 경고 — 기본값으로 돈다.
_FATAL_ISSUES = ("JWT_SECRET:", "SPEECH_INTERNAL_SECRET:", "DATA_ROOT:", "APP_ENV:")


def _rss_mb() -> int | None:
    try:
        with open("/proc/self/status", encoding="ascii") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        return None
    return None


def _fatal_issues(settings: Settings) -> list[str]:
    return [i for i in settings.issues if i.startswith(_FATAL_ISSUES)]


def create_app(
    settings: Settings | None = None,
    *,
    router: SpeechEngineRouter | None = None,
    client: InternalClient | None = None,
    load_engine: bool = True,
    annotator: TextAnnotator | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    setup_logging(settings.env.log_level, secrets=(settings.env.jwt_secret, settings.env.internal_secret))
    router = router or SpeechEngineRouter(settings)
    env = settings.env
    deps = GatewayDeps(
        settings=settings,
        router=router,
        registry=SessionRegistry(settings.gateway.max_sessions),
        verifier=TicketVerifier(env.jwt_secret) if env.jwt_secret else None,
        store=UtteranceStore(env.data_root) if env.data_root is not None else None,
        client=client,
    )
    started = time.monotonic()
    secret_digest = hashlib.sha256(env.internal_secret.encode()).digest() if env.internal_secret else None
    background: set[asyncio.Future[Any]] = set()
    text_annotator = annotator or TextAnnotator()

    def _load() -> None:
        try:
            router.load_realtime()
        except EngineUnavailableError:
            pass  # router.state=FAILED, 사유는 router.error — /health 로 보인다

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        own_client = False
        if deps.client is None and env.internal_secret:
            timeout_ms = settings.gateway.internal_callback_timeout_ms
            deps.client = InternalClient(env.app_internal_url, env.internal_secret, env.app_env, timeout_ms)
            own_client = True
        if load_engine and router.state == "IDLE":
            fut = asyncio.get_running_loop().run_in_executor(None, _load)
            background.add(fut)
            fut.add_done_callback(background.discard)
        if load_engine:
            warm = asyncio.ensure_future(text_annotator.warm())
            background.add(warm)
            warm.add_done_callback(background.discard)
        issues = settings.issues
        log.info(
            "gateway %s starting env=%s config=%s issues=%s", __version__, env.app_env, settings.config_version, ",".join(issues) or "-"
        )
        try:
            yield
        finally:
            if own_client and deps.client is not None:
                await deps.client.aclose()
            router.shutdown()
            text_annotator.shutdown()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.deps = deps

    def _status() -> str:
        if _fatal_issues(settings):
            return "MISCONFIGURED"
        return {"OK": "OK", "FAILED": "FAILED"}.get(router.state, "LOADING")

    def _authorized(request: Request) -> bool:
        provided = request.headers.get("x-internal-secret")
        if secret_digest is None or not provided:
            return False
        return hmac.compare_digest(hashlib.sha256(provided.encode()).digest(), secret_digest)

    @app.get("/health")
    async def health(request: Request) -> dict[str, Any]:
        status = _status()
        body: dict[str, Any] = {"ok": status == "OK", "status": status}
        if not _authorized(request):
            return body
        body.update(
            {
                "service": "gateway",
                "version": __version__,
                "commonVersion": common_version,
                "env": env.app_env,
                "models": [
                    {
                        "key": settings.gateway.connection_key,
                        "loaded": router.state == "OK",
                        "model": router.model_label or None,
                        "loadMs": router.load_ms,
                        "error": router.error,
                    }
                ],
                "sessions": len(deps.registry),
                "rssMb": _rss_mb(),
                "configVersion": settings.config_version,
                "logLevel": env.log_level,
                "uptimeSec": int(time.monotonic() - started),
                "issues": list(settings.issues),
                "textAnalyzer": {"state": text_annotator.state, "error": text_annotator.error},
            }
        )
        return body

    def _text_error(status: int, code: str) -> JSONResponse:
        return JSONResponse({"error": {"code": code}}, status_code=status)

    @app.post("/text/annotate")
    async def text_annotate(request: Request) -> JSONResponse:
        if not _authorized(request):
            return _text_error(401, "UNAUTHORIZED")
        declared = request.headers.get("content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > MAX_BODY_BYTES):
            return _text_error(413, "BODY_TOO_LARGE")
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > MAX_BODY_BYTES:
                return _text_error(413, "BODY_TOO_LARGE")
        try:
            texts = parse_request(json.loads(raw))
        except TextRequestError as e:
            return _text_error(413 if e.code in ("TOO_MANY_TEXTS", "TEXT_TOO_LONG") else 400, e.code)
        except (ValueError, RecursionError):
            # RecursionError: 깊게 중첩된 배열·객체(json 은 C 재귀) — 입력이 잘못된 것이지 서버 오류가 아니다.
            return _text_error(400, "BAD_JSON")
        if text_annotator.state == "FAILED":
            return _text_error(503, "NOT_READY")
        t0 = time.perf_counter()
        try:
            items = await text_annotator.annotate(texts)
        except TextBusyError:
            log.info("text annotate busy pending=%d", text_annotator.pending)
            return _text_error(503, "BUSY")
        except RuntimeError:
            return _text_error(503, "NOT_READY")
        ms = int((time.perf_counter() - t0) * 1000)
        log.info(
            "text annotate n=%d chars=%d failed=%d ms=%d", len(texts), sum(len(t) for t in texts), sum(1 for i in items if i is None), ms
        )
        return JSONResponse({"version": VERSION, "items": [None if i is None else {"segments": i} for i in items]})

    @app.websocket("/ws/speech")
    async def ws_speech(websocket: WebSocket) -> None:
        await GatewayConnection(websocket, deps).run()

    return app
