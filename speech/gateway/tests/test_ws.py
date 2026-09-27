from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import (
    INTERNAL_SECRET,
    JWT_SECRET,
    SILENCE_FRAME,
    SPEECH_FRAME,
    CallbackRecorder,
    build_client,
    make_settings,
    make_ticket,
    start_msg,
)

ENGINE_WORDS = ("engine", "model", "connectionkey", "reazon", "sherpa", "zipformer", "silero")


def expect_close(ws: Any) -> tuple[list[dict[str, Any]], int]:
    """close 까지 받은 메시지와 close 코드."""
    got: list[dict[str, Any]] = []
    with pytest.raises(WebSocketDisconnect) as e:
        while True:
            got.append(ws.receive_json())
    return got, e.value.code


def speak(ws: Any, speech_frames: int = 20, silence_frames: int = 3) -> None:
    for _ in range(speech_frames):
        ws.send_bytes(SPEECH_FRAME)
    for _ in range(silence_frames):
        ws.send_bytes(SILENCE_FRAME)


def receive_until(ws: Any, kind: str) -> list[dict[str, Any]]:
    got = []
    while True:
        msg = ws.receive_json()
        got.append(msg)
        if msg["type"] == kind:
            return got


def assert_no_engine_ids(messages: list[dict[str, Any]]) -> None:
    raw = json.dumps(messages, ensure_ascii=False).lower()
    for word in ENGINE_WORDS:
        assert word not in raw, word


# ── /health ────────────────────────────────────────────────────────────────


def test_health_public_is_minimal(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client:
        body = client.get("/health").json()
    assert body == {"ok": True, "status": "OK"}


def test_health_detail_with_secret_has_no_secrets_or_paths(tmp_path: Path, provider: Any) -> None:
    settings = make_settings(tmp_path)
    with build_client(settings, provider) as client:
        wrong = client.get("/health", headers={"X-Internal-Secret": "nope"}).json()
        body = client.get("/health", headers={"X-Internal-Secret": INTERNAL_SECRET}).json()
    assert set(wrong) == {"ok", "status"}
    assert body["service"] == "gateway" and body["ok"] is True and body["sessions"] == 0
    assert body["models"][0]["loaded"] is True and body["models"][0]["key"] == "reazon-gateway"
    raw = json.dumps(body)
    assert JWT_SECRET not in raw and INTERNAL_SECRET not in raw and str(tmp_path) not in raw


def test_health_loading_and_misconfigured(tmp_path: Path) -> None:
    with build_client(make_settings(tmp_path), None) as client:
        assert client.get("/health").json() == {"ok": False, "status": "LOADING"}
    from dataclasses import replace

    settings = make_settings(tmp_path)
    settings = replace(settings, issues=("JWT_SECRET:missing",))
    with build_client(settings, None) as client:
        assert client.get("/health").json()["status"] == "MISCONFIGURED"


def test_docs_disabled(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404


# ── 시작·인증 ──────────────────────────────────────────────────────────────


def test_audio_before_start_closes_4401(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_bytes(SPEECH_FRAME)
        got, code = expect_close(ws)
    assert code == 4401 and got[0]["code"] == "UNAUTHENTICATED" and got[0]["fatal"] is True


def test_start_timeout_closes_4401(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path, start_timeout_sec=0.2), provider) as client, client.websocket_connect("/ws/speech") as ws:
        got, code = expect_close(ws)
    assert code == 4401 and "start" in got[0]["message"]


@pytest.mark.parametrize(
    ("claims", "code"),
    [
        ({"aud": "speech-ws"}, 4401),
        ({"exp": 1}, 4401),
        ({"purpose": "OTHER"}, 4401),
    ],
)
def test_bad_ticket_closes(tmp_path: Path, provider: Any, claims: dict, code: int) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(**claims)))
        got, close = expect_close(ws)
    assert close == code and got[0]["code"] == "UNAUTHENTICATED"


def test_forged_ticket_closes_4401(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(secret="forged-secret-0123456789abcdef0123456789")))
        _, close = expect_close(ws)
    assert close == 4401


def test_ticket_issued_before_boot_closes_4401(tmp_path: Path, provider: Any) -> None:
    import time as _time

    old = make_ticket(purpose="MIC_TEST", iat=int(_time.time()) - 30)
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(old))
        got, close = expect_close(ws)
    assert close == 4401 and got[0]["code"] == "UNAUTHENTICATED" and "before gateway start" in got[0]["message"]


def test_ticket_reuse_closes_4403(tmp_path: Path, provider: Any) -> None:
    ticket = make_ticket(purpose="MIC_TEST")
    with build_client(make_settings(tmp_path), provider) as client:
        with client.websocket_connect("/ws/speech") as ws:
            ws.send_json(start_msg(ticket))
            assert ws.receive_json()["type"] == "ready"
        with client.websocket_connect("/ws/speech") as ws:
            ws.send_json(start_msg(ticket))
            got, close = expect_close(ws)
    assert close == 4403 and got[0]["code"] == "UNAUTHENTICATED"


@pytest.mark.parametrize("bad", [{"v": 2}, {"sampleRate": 48000}, {"endpoint": "never"}, {"partial": "yes"}])
def test_invalid_start_closes_4400(tmp_path: Path, provider: Any, bad: dict) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(), **bad))
        got, close = expect_close(ws)
    assert close == 4400 and got[0]["code"] == "VALIDATION"


def test_chat_id_must_match_ticket(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(chatId="cchatA"), chatId="cchatB"))
        _, close = expect_close(ws)
    assert close == 4401


def test_engine_not_ready_closes_4422(tmp_path: Path) -> None:
    with build_client(make_settings(tmp_path), None) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        got, close = expect_close(ws)
    assert close == 4422 and got[0]["code"] == "ENGINE_UNAVAILABLE"


def test_allowed_origins(tmp_path: Path, provider: Any) -> None:
    from dataclasses import replace

    settings = make_settings(tmp_path)
    settings = replace(settings, env=replace(settings.env, allowed_origins=("https://kaiwa.example",)))
    with build_client(settings, provider) as client:
        with client.websocket_connect("/ws/speech", headers={"origin": "https://evil.example"}) as ws:
            _, close = expect_close(ws)
        assert close == 4401
        with client.websocket_connect("/ws/speech", headers={"origin": "https://kaiwa.example"}) as ws:
            ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
            assert ws.receive_json()["type"] == "ready"


# ── 발화 흐름 ──────────────────────────────────────────────────────────────


def test_mic_test_flow_no_storage_no_engine_ids(tmp_path: Path, provider: Any) -> None:
    recorder = CallbackRecorder()
    with build_client(make_settings(tmp_path), provider, recorder) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ready = ws.receive_json()
        assert ready["type"] == "ready" and ready["v"] == 1 and ready["frameBytes"] == 1280
        speak(ws, speech_frames=20, silence_frames=15)  # 무음 600ms → 세그먼트 → partial
        got = receive_until(ws, "partial")
        ws.send_json({"type": "stop"})
        got += receive_until(ws, "final")
    final = got[-1]
    assert final["utteranceId"] is None and final["text"] and final["reason"] == "stop"
    assert final["segments"][0]["segIdx"] == 0 and final["timings"]["storeMs"] >= 0
    assert recorder.calls == []
    assert not (tmp_path / "data").exists()
    assert_no_engine_ids([ready, *got])


def test_turn_flow_stores_wav_and_calls_back(tmp_path: Path, provider: Any) -> None:
    recorder = CallbackRecorder()
    with build_client(make_settings(tmp_path), provider, recorder) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(chatId="cchat01")))
        assert ws.receive_json()["type"] == "ready"
        speak(ws, speech_frames=25, silence_frames=2)
        ws.send_json({"type": "stop"})
        final = receive_until(ws, "final")[-1]
    assert final["utteranceId"] == "cutt0001"
    wav = tmp_path / "data/users/cuser0001/utterances/2026-09/cutt0001.wav"
    assert wav.is_file() and wav.stat().st_size > 44
    assert list((tmp_path / "data/users/cuser0001/utterances/incoming").iterdir()) == []
    [payload] = recorder.calls
    assert payload["userId"] == "cuser0001" and payload["chatId"] == "cchat01"
    assert payload["realtimeEngine"] == "reazon-gateway" and payload["sampleRate"] == 16000
    assert payload["realtimeText"] == final["text"] and payload["tmpPath"].startswith("users/cuser0001/utterances/incoming/")
    assert set(payload["timings"]) == {"vadMs", "sttMs", "decodeMs"}
    assert "audio" not in payload and payload["audioBytes"] == wav.stat().st_size
    headers = recorder.headers[0]
    assert headers["x-internal-secret"] == INTERNAL_SECRET and headers["x-service"] == "gateway" and headers["x-service-env"] == "LOCAL"


def test_turn_callback_failure_orphans_wav(tmp_path: Path, provider: Any) -> None:
    recorder = CallbackRecorder(status=500)
    with build_client(make_settings(tmp_path), provider, recorder) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket()))
        ws.receive_json()
        speak(ws)
        ws.send_json({"type": "stop"})
        final = receive_until(ws, "final")[-1]
    assert final["utteranceId"] is None and final["text"]
    assert len(recorder.calls) == 2  # 5xx 1회 재시도
    orphans = list((tmp_path / "data/users/cuser0001/utterances/_orphan").iterdir())
    assert len(orphans) == 1 and orphans[0].suffix == ".wav"


@pytest.mark.parametrize(
    "audio_path",
    [
        "users/cother/utterances/2026-09/x.wav",
        "users/cuser0001/utterances/../../x.wav",
        "/etc/passwd",
        "users/cuser0001/utterances/incoming/x.wav",
    ],
)
def test_turn_rejects_bad_audio_path(tmp_path: Path, provider: Any, audio_path: str) -> None:
    recorder = CallbackRecorder(body={"success": True, "data": {"utteranceId": "cutt0002", "audioPath": audio_path}})
    with build_client(make_settings(tmp_path), provider, recorder) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket()))
        ws.receive_json()
        speak(ws)
        ws.send_json({"type": "stop"})
        final = receive_until(ws, "final")[-1]
    assert final["utteranceId"] == "cutt0002"  # 행은 생겼다 — 파일만 _orphan
    assert len(list((tmp_path / "data/users/cuser0001/utterances/_orphan").iterdir())) == 1
    assert not (tmp_path / "data/users/cother").exists()


def test_stop_without_speech_gives_empty_final(tmp_path: Path, provider: Any) -> None:
    recorder = CallbackRecorder()
    with build_client(make_settings(tmp_path), provider, recorder) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket()))
        ws.receive_json()
        for _ in range(5):
            ws.send_bytes(SILENCE_FRAME)
        ws.send_json({"type": "stop"})
        final = receive_until(ws, "final")[-1]
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}
    assert final["text"] == "" and final["utteranceId"] is None and recorder.calls == []


def test_multiple_utterances_and_cancel(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        speak(ws, 10, 0)
        ws.send_json({"type": "cancel"})
        speak(ws, 30, 2)
        ws.send_json({"type": "stop"})
        first = receive_until(ws, "final")[-1]
        speak(ws, 10, 2)
        ws.send_json({"type": "stop"})
        second = receive_until(ws, "final")[-1]
    # 취소된 발화는 final 이 없고, 다음 발화는 새 start·티켓 없이 이어진다.
    assert len(first["text"]) > len(second["text"]) > 0


def test_auto_endpoint_final_without_stop(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST"), endpoint="auto"))
        ws.receive_json()
        speak(ws, 20, 15)
        got = receive_until(ws, "final")
        ws.send_json({"type": "stop"})
        tail = receive_until(ws, "final")
    assert got[-1]["reason"] == "endpoint" and got[-1]["text"]
    assert not [m for m in got if m["type"] == "partial"]
    assert tail[-1]["reason"] == "stop" and tail[-1]["text"] == ""


def test_max_length_forces_final_and_repeated_closes_4413(tmp_path: Path, provider: Any) -> None:
    settings = make_settings(tmp_path, max_utterance_sec=5, frames_per_sec=1000.0, frame_burst=10000)
    with build_client(settings, provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        finals = []
        for _ in range(3):
            speak(ws, 125, 0)  # 5초
            finals.append(receive_until(ws, "final")[-1])
        got, close = expect_close(ws)
    assert [f["reason"] for f in finals] == ["max_length"] * 3
    assert close == 4413 and got[-1]["code"] == "RATE_LIMITED"


# ── 상한·형식 ──────────────────────────────────────────────────────────────


def test_bad_frame_size_is_dropped_then_fatal(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path, max_bad_frames=3), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        ws.send_bytes(b"\x00" * 1281)
        warn = ws.receive_json()
        assert warn["code"] == "VALIDATION" and warn["fatal"] is False
        for _ in range(3):
            ws.send_bytes(b"\x00" * 100)
        got, close = expect_close(ws)
    assert close == 4400 and got[-1]["code"] == "VALIDATION"


def test_frame_flood_closes_4413(tmp_path: Path, provider: Any) -> None:
    with (
        build_client(make_settings(tmp_path, frames_per_sec=1.0, frame_burst=5), provider) as client,
        client.websocket_connect("/ws/speech") as ws,
    ):
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        for _ in range(10):
            ws.send_bytes(SILENCE_FRAME)
        got, close = expect_close(ws)
    assert close == 4413 and got[-1]["code"] == "RATE_LIMITED"


def test_unknown_and_oversized_text_are_non_fatal(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client, client.websocket_connect("/ws/speech") as ws:
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        ws.send_text("x" * 5000)
        assert ws.receive_json()["fatal"] is False
        ws.send_json({"type": "start"})
        assert ws.receive_json()["message"] == "session already started"
        ws.send_json({"type": "ping"})
        assert ws.receive_json() == {"type": "pong"}


def test_idle_timeout_closes_4408(tmp_path: Path, provider: Any) -> None:
    with (
        build_client(make_settings(tmp_path, session_idle_timeout_sec=1), provider) as client,
        client.websocket_connect("/ws/speech") as ws,
    ):
        ws.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
        ws.receive_json()
        got, close = expect_close(ws)
    assert close == 4408 and got[-1]["code"] == "SESSION_EXPIRED"


def test_same_user_new_session_replaces_old_4409(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path), provider) as client:
        with client.websocket_connect("/ws/speech") as old:
            old.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
            old.receive_json()
            with client.websocket_connect("/ws/speech") as new:
                new.send_json(start_msg(make_ticket(purpose="MIC_TEST")))
                assert new.receive_json()["type"] == "ready"
                got, close = expect_close(old)
                assert close == 4409 and got[-1]["message"].startswith("replaced")
                new.send_json({"type": "ping"})
                assert new.receive_json() == {"type": "pong"}


def test_global_session_cap_closes_4429(tmp_path: Path, provider: Any) -> None:
    with build_client(make_settings(tmp_path, max_sessions=1), provider) as client:
        with client.websocket_connect("/ws/speech") as a:
            a.send_json(start_msg(make_ticket(purpose="MIC_TEST", sub="cuserA")))
            a.receive_json()
            with client.websocket_connect("/ws/speech") as b:
                b.send_json(start_msg(make_ticket(purpose="MIC_TEST", sub="cuserB")))
                got, close = expect_close(b)
    assert close == 4429 and got[-1]["code"] == "RATE_LIMITED"
