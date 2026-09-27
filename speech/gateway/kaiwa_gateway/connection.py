"""WS `/ws/speech` 연결 1개 — api-contract §2-29(`v:1`) 프로토콜 상태기계.

AWAIT_START(3초) → 티켓 검증 → READY(발화 여러 번: 오디오 … stop → final … 오디오 …) → CLOSED.
클라이언트로 가는 메시지에는 엔진 식별자(engine·model·connectionKey)를 싣지 않는다(task-003e M2) —
엔진 스냅샷은 앱 internal 콜백 본문에만 들어간다. 로그에는 텍스트 길이·지문만 남긴다.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

from kaiwa_speech_common.config import Settings
from kaiwa_speech_common.engine.errors import EngineOverloadedError, EngineUnavailableError
from kaiwa_speech_common.engine.interfaces import EngineRole, SpeechRequest, TranscriptionSegment, UtteranceResult
from kaiwa_speech_common.ids import session_id, trace_id
from kaiwa_speech_common.internal_client import CallbackError, InternalClient
from kaiwa_speech_common.logging import get_logger, text_fingerprint
from kaiwa_speech_common.router import SpeechEngineRouter

from .limits import SessionLimitError, SessionRegistry, TokenBucket
from .store import StoreError, UtteranceStore
from .ticket import TicketClaims, TicketError, TicketVerifier

log = get_logger("kaiwa_gateway.ws")

PROTOCOL_VERSION = 1
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_PLATFORM = re.compile(r"^[a-z-]{1,16}$")


class _Fatal(Exception):
    def __init__(self, close_code: int, error_code: str, message: str) -> None:
        super().__init__(message)
        self.close_code = close_code
        self.error_code = error_code
        self.message = message


@dataclass
class GatewayDeps:
    settings: Settings
    router: SpeechEngineRouter
    registry: SessionRegistry
    verifier: TicketVerifier | None
    store: UtteranceStore | None
    client: InternalClient | None


@dataclass(frozen=True)
class StartOptions:
    partial: bool
    endpoint: str
    chat_id: str | None
    platform: str


class GatewayConnection:
    def __init__(self, ws: WebSocket, deps: GatewayDeps) -> None:
        self.ws = ws
        self.deps = deps
        self.cfg = deps.settings.gateway
        self.sid = session_id()
        self.claims: TicketClaims | None = None
        self.opts: StartOptions | None = None
        self.session: Any = None
        self.trace = trace_id()
        self._send_lock = asyncio.Lock()
        self._closed = False
        self._registered = False
        self._bad_frames = 0
        self._forced = 0
        self._frames = TokenBucket(self.cfg.frames_per_sec, self.cfg.frame_burst)
        self._texts = TokenBucket(self.cfg.text_per_sec, self.cfg.text_burst)

    # ── 수명 ────────────────────────────────────────────────────────────────
    async def run(self) -> None:
        await self.ws.accept()
        try:
            await self._handshake()
            await self._loop()
        except _Fatal as f:
            await self.close_with(f.close_code, f.error_code, f.message)
        except WebSocketDisconnect:
            pass
        except Exception as e:  # noqa: BLE001 — 계약 밖 예외는 1011 로 닫고 타입만 남긴다
            log.warning("ws session=%s unexpected %s", self.sid, type(e).__name__)
            await self.close_with(1011, "ENGINE_ERROR", "internal error")
        finally:
            await self._cleanup()

    async def _cleanup(self) -> None:
        self._closed = True
        if self.session is not None:
            await self.session.close()
        if self._registered and self.claims is not None:
            self.deps.registry.release(self.claims.user_id, self)

    async def send(self, message: dict[str, Any]) -> None:
        if self._closed:
            return
        async with self._send_lock:
            if self._closed or self.ws.application_state != WebSocketState.CONNECTED:
                return
            try:
                await self.ws.send_text(json.dumps(message, ensure_ascii=False, separators=(",", ":")))
            except (RuntimeError, WebSocketDisconnect, OSError):
                self._closed = True

    async def close_with(self, close_code: int, error_code: str, message: str) -> None:
        """error{fatal:true} 를 보내고 close. 여러 번 불려도 한 번만 동작한다."""
        if self._closed:
            return
        await self.send({"type": "error", "code": error_code, "message": message, "fatal": True})
        self._closed = True
        if close_code not in (1000,):
            log.info("ws session=%s close=%d code=%s reason=%s", self.sid, close_code, error_code, message)
        try:
            if self.ws.application_state == WebSocketState.CONNECTED:
                await self.ws.close(code=close_code)
        except (RuntimeError, OSError):
            pass

    async def kick(self) -> None:
        """같은 사용자의 새 세션이 열려 이 세션을 닫는다(4409)."""
        await self.close_with(4409, "RATE_LIMITED", "replaced by a newer session")

    # ── 시작 ────────────────────────────────────────────────────────────────
    def _origin_allowed(self) -> bool:
        allowed = self.deps.settings.env.allowed_origins
        if not allowed:
            return True
        origin = (self.ws.headers.get("origin") or "").rstrip("/")
        return origin in allowed

    async def _handshake(self) -> None:
        registry = self.deps.registry
        if not self._origin_allowed():
            raise _Fatal(4401, "UNAUTHENTICATED", "origin not allowed")
        if registry.pending >= self.cfg.max_pending_connections:
            raise _Fatal(4429, "RATE_LIMITED", "too many pending connections")
        registry.pending += 1
        try:
            message = await asyncio.wait_for(self.ws.receive(), timeout=self.cfg.start_timeout_sec)
        except asyncio.TimeoutError:
            raise _Fatal(4401, "UNAUTHENTICATED", "start message required within 3s") from None
        finally:
            registry.pending -= 1
        if message.get("type") == "websocket.disconnect":
            raise WebSocketDisconnect(int(message.get("code") or 1000))
        if message.get("bytes") is not None:
            raise _Fatal(4401, "UNAUTHENTICATED", "start message required before audio")
        start = self._parse_json(message.get("text"))
        if start is None or start.get("type") != "start":
            raise _Fatal(4401, "UNAUTHENTICATED", "start message required")
        self.opts = self._validate_start(start)

        verifier = self.deps.verifier
        if verifier is None:
            raise _Fatal(4422, "ENGINE_UNAVAILABLE", "gateway not configured")
        try:
            claims = verifier.verify(start.get("ticket"))
        except TicketError as e:
            if e.kind == "REUSED":
                raise _Fatal(4403, "UNAUTHENTICATED", str(e)) from None
            if e.kind == "BUSY":
                raise _Fatal(4429, "RATE_LIMITED", "busy") from None
            raise _Fatal(4401, "UNAUTHENTICATED", str(e)) from None
        if self.opts.chat_id is not None and self.opts.chat_id != claims.chat_id:
            raise _Fatal(4401, "UNAUTHENTICATED", "chatId does not match ticket")
        self.claims = claims

        try:
            provider, ctx = self.deps.router.resolve(EngineRole.REALTIME_STT)
        except EngineUnavailableError:
            raise _Fatal(4422, "ENGINE_UNAVAILABLE", "recognizer not ready") from None
        if claims.purpose == "TURN" and (self.deps.store is None or self.deps.client is None):
            raise _Fatal(4422, "ENGINE_UNAVAILABLE", "utterance storage not configured")

        try:
            previous = registry.acquire(claims.user_id, self)
        except SessionLimitError:
            raise _Fatal(4429, "RATE_LIMITED", "too many sessions") from None
        self._registered = True
        if previous is not None:
            await previous.kick()

        max_utterance_ms = self.cfg.max_utterance_sec * 1000
        request = SpeechRequest(
            trace_id=self.trace,
            role=EngineRole.REALTIME_STT,
            user_id=claims.user_id,
            chat_id=claims.chat_id,
            options={"endpoint": self.opts.endpoint, "partial": self.opts.partial, "max_utterance_ms": max_utterance_ms},
        )
        self.session = await provider.open_session(request, ctx, self._on_vad, self._on_partial, self._on_final, self._on_error)
        self._deadline = time.monotonic() + self.cfg.session_max_sec
        stt = self.deps.settings.stt
        await self.send(
            {
                "type": "ready",
                "v": PROTOCOL_VERSION,
                "sessionId": self.sid,
                "sampleRate": stt.sample_rate,
                "frameBytes": self.cfg.frame_bytes,
                "maxUtteranceMs": max_utterance_ms,
                "vad": {"silenceMs": stt.endpoint_silence_ms},
            }
        )
        log.info(
            "ws session=%s ready user=%s purpose=%s endpoint=%s platform=%s",
            self.sid,
            claims.user_id,
            claims.purpose,
            self.opts.endpoint,
            self.opts.platform,
        )

    def _parse_json(self, text: object) -> dict[str, Any] | None:
        if not isinstance(text, str) or len(text.encode("utf-8")) > self.cfg.max_text_bytes:
            return None
        try:
            value = json.loads(text)
        except ValueError:
            return None
        return value if isinstance(value, dict) else None

    def _validate_start(self, start: dict[str, Any]) -> StartOptions:
        if start.get("v") != PROTOCOL_VERSION:
            raise _Fatal(4400, "VALIDATION", "unsupported protocol version (v must be 1)")
        if start.get("sampleRate") != self.deps.settings.stt.sample_rate:
            raise _Fatal(4400, "VALIDATION", "sampleRate must be 16000")
        partial = start.get("partial", True)
        endpoint = start.get("endpoint", "manual")
        chat_id = start.get("chatId")
        platform = start.get("clientPlatform", "web")
        if not isinstance(partial, bool) or endpoint not in ("manual", "auto"):
            raise _Fatal(4400, "VALIDATION", "invalid start options")
        if chat_id is not None and (not isinstance(chat_id, str) or not _ID.match(chat_id)):
            raise _Fatal(4400, "VALIDATION", "invalid chatId")
        if not isinstance(platform, str) or not _PLATFORM.match(platform):
            platform = "unknown"
        return StartOptions(partial=partial, endpoint=endpoint, chat_id=chat_id, platform=platform)

    # ── 수신 루프 ───────────────────────────────────────────────────────────
    async def _loop(self) -> None:
        idle = float(self.cfg.session_idle_timeout_sec)
        while not self._closed:
            remaining = self._deadline - time.monotonic()
            if remaining <= 0:
                raise _Fatal(4408, "SESSION_EXPIRED", "session exceeded 10 minutes")
            try:
                message = await asyncio.wait_for(self.ws.receive(), timeout=min(idle, remaining))
            except asyncio.TimeoutError:
                if time.monotonic() >= self._deadline:
                    raise _Fatal(4408, "SESSION_EXPIRED", "session exceeded 10 minutes") from None
                raise _Fatal(4408, "SESSION_EXPIRED", "idle timeout") from None
            if message.get("type") == "websocket.disconnect":
                return
            data = message.get("bytes")
            if data is not None:
                await self._on_audio(data)
                continue
            text = message.get("text")
            if text is not None:
                await self._on_text(text)

    async def _on_audio(self, data: bytes) -> None:
        if len(data) != self.cfg.frame_bytes:
            self._bad_frames += 1
            if self._bad_frames == 1:
                message = f"audio frame must be {self.cfg.frame_bytes} bytes PCM16"
                await self.send({"type": "error", "code": "VALIDATION", "message": message, "fatal": False})
            if self._bad_frames > self.cfg.max_bad_frames:
                raise _Fatal(4400, "VALIDATION", "too many invalid audio frames")
            return
        if not self._frames.take():
            raise _Fatal(4413, "RATE_LIMITED", "audio arriving faster than realtime")
        try:
            await self.session.push_frame(data)
        except EngineOverloadedError:
            raise _Fatal(4413, "RATE_LIMITED", "audio backlog") from None

    async def _on_text(self, text: str) -> None:
        if not self._texts.take():
            raise _Fatal(4413, "RATE_LIMITED", "too many messages")
        message = self._parse_json(text)
        kind = message.get("type") if message else None
        try:
            if kind == "stop":
                await self.session.stop()
            elif kind == "cancel":
                await self.session.cancel()
            elif kind == "ping":
                await self.send({"type": "pong"})
            elif kind == "start":
                await self.send({"type": "error", "code": "VALIDATION", "message": "session already started", "fatal": False})
            else:
                await self.send({"type": "error", "code": "VALIDATION", "message": "unknown message", "fatal": False})
        except EngineOverloadedError:
            raise _Fatal(4413, "RATE_LIMITED", "audio backlog") from None

    # ── 엔진 콜백(세션 작업자에서 순서대로) ─────────────────────────────────
    async def _on_vad(self, state: str, at_ms: int) -> None:
        await self.send({"type": "vad", "state": state, "atMs": at_ms})

    async def _on_partial(self, seg: TranscriptionSegment) -> None:
        await self.send({"type": "partial", "segIdx": seg.seg_idx, "text": seg.text, "atMs": seg.end_ms})

    async def _on_error(self, exc: BaseException) -> None:
        await self.close_with(1011, "ENGINE_ERROR", "recognition failed")

    async def _on_final(self, utt: UtteranceResult) -> None:
        assert self.claims is not None
        t0 = time.monotonic()
        text = utt.result.text
        utterance_id: str | None = None
        if self.claims.purpose == "TURN" and text:
            utterance_id = await self._persist(utt)
        store_ms = int((time.monotonic() - t0) * 1000)
        segments = [{"segIdx": s.seg_idx, "start": s.start_ms, "end": s.end_ms, "text": s.text} for s in utt.result.segments]
        timings = {**self._engine_timings(utt), "storeMs": store_ms}
        await self.send(
            {
                "type": "final",
                "utteranceId": utterance_id,
                "text": text,
                "durationMs": utt.audio.duration_ms,
                "segments": segments,
                "timings": timings,
                "reason": utt.reason,
                "traceId": self.trace,
            }
        )
        log.info(
            "final session=%s user=%s trace=%s reason=%s %s segs=%d audioMs=%d decodeMs=%d sttMs=%d storeMs=%d stored=%s",
            self.sid,
            self.claims.user_id,
            self.trace,
            utt.reason,
            text_fingerprint(text),
            len(segments),
            utt.audio.duration_ms,
            timings["decodeMs"],
            timings["sttMs"],
            store_ms,
            utterance_id is not None,
        )
        self.trace = trace_id()
        if utt.reason == "max_length":
            self._forced += 1
            if self._forced >= self.cfg.max_forced_finals:
                await self.close_with(4413, "RATE_LIMITED", "utterance length limit reached repeatedly")

    @staticmethod
    def _engine_timings(utt: UtteranceResult) -> dict[str, int]:
        t = utt.timings_ms
        return {"vadMs": int(t.get("vad", 0)), "sttMs": int(t.get("stt", 0)), "decodeMs": int(t.get("decode", 0))}

    def _callback_payload(self, utt: UtteranceResult, tmp_rel: str, audio_bytes: int) -> dict[str, Any]:
        assert self.claims is not None
        segs = list(utt.result.segments)
        limit = self.cfg.max_callback_segments
        if len(segs) > limit:
            head, tail = segs[: limit - 1], segs[limit - 1 :]
            merged = TranscriptionSegment(
                seg_idx=limit - 1, text="".join(s.text for s in tail), start_ms=tail[0].start_ms, end_ms=tail[-1].end_ms
            )
            segs = [*head, merged]
        return {
            "userId": self.claims.user_id,
            "chatId": self.claims.chat_id,
            "durationMs": utt.audio.duration_ms,
            "sampleRate": utt.audio.sample_rate,
            "audioBytes": audio_bytes,
            "realtimeEngine": self.deps.settings.gateway.connection_key,
            "realtimeText": utt.result.text[: self.cfg.max_realtime_text_chars],
            "segments": [{"segIdx": s.seg_idx, "start": s.start_ms, "end": s.end_ms, "text": s.text} for s in segs],
            "timings": self._engine_timings(utt),
            "traceId": self.trace,
            "tmpPath": tmp_rel,
        }

    async def _persist(self, utt: UtteranceResult) -> str | None:
        """wav(.part) 쓰기 → 앱 콜백 → 앱이 정한 경로로 rename. 실패하면 _orphan 으로 옮기고 None."""
        store, client, claims = self.deps.store, self.deps.client, self.claims
        assert store is not None and client is not None and claims is not None
        try:
            incoming = await asyncio.to_thread(store.write_incoming, claims.user_id, utt.audio.pcm, utt.audio.sample_rate)
        except (OSError, StoreError) as e:
            log.warning("store failed session=%s trace=%s %s", self.sid, self.trace, type(e).__name__)
            return None
        try:
            data = await client.post_utterance(self._callback_payload(utt, incoming.rel, incoming.size), self.trace)
        except asyncio.CancelledError:
            # 연결이 끊겨 세션 작업자가 취소됐다 — 콜백 결과를 모르므로 파일을 _orphan 에 남긴다(incoming 에 .part 방치 금지).
            store.orphan(claims.user_id, incoming)
            raise
        except CallbackError as e:
            log.warning("callback failed session=%s trace=%s status=%d reason=%s", self.sid, self.trace, e.status, e)
            await asyncio.to_thread(store.orphan, claims.user_id, incoming)
            return None
        utterance_id = data.get("utteranceId")
        if not isinstance(utterance_id, str) or not _ID.match(utterance_id):
            log.warning("callback response invalid session=%s trace=%s", self.sid, self.trace)
            await asyncio.to_thread(store.orphan, claims.user_id, incoming)
            return None
        try:
            target = store.resolve_audio_path(claims.user_id, data.get("audioPath"), data.get("finalPath"))
            await asyncio.to_thread(store.promote, incoming, target)
        except (StoreError, OSError) as e:
            # 행은 이미 생겼다 — 대화는 이어가되 파일은 _orphan 에 남겨 원인을 찾게 한다.
            log.error("promote failed session=%s trace=%s utterance=%s %s", self.sid, self.trace, utterance_id, type(e).__name__)
            await asyncio.to_thread(store.orphan, claims.user_id, incoming)
        return utterance_id
