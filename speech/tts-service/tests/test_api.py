"""HTTP 계약 — 인증·loopback admin·상한·검증·응답 모양. 모델 없이(FakeBackend)."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import time
import wave
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from conftest import SECRET, FakeBackend, make_settings
from fastapi.testclient import TestClient

from kaiwa_tts.runtime import QueueTimeout
from kaiwa_tts.server import create_app
from kaiwa_tts.timing import TIMING_MAX_TEXT_CHARS, decode_header

AUTH = {"X-Internal-Secret": SECRET}
LOOPBACK = ("127.0.0.1", 50000)
REMOTE = ("192.168.219.154", 50000)


def _wait_ready(client: TestClient) -> dict[str, Any]:
    """공개 /health 로 기동 완료를 기다린 뒤 상세(/health/detail, 시크릿)를 돌려준다. 시크릿 미설정이면 공개 본문."""
    body: dict[str, Any] = {}
    for _ in range(200):
        body = client.get("/health").json()
        if body["status"] not in ("LOADING",):
            detail = client.get("/health/detail", headers=AUTH)
            return detail.json() if detail.status_code in (200, 503) else body
        time.sleep(0.01)
    raise AssertionError(f"not ready: {body}")


@pytest.fixture()
def backend() -> FakeBackend:
    return FakeBackend()


def _client(assets: Path, backend: FakeBackend, client_addr: tuple[str, int] = REMOTE, **overrides: Any) -> TestClient:
    app = create_app(make_settings(assets, **overrides), backend)
    return TestClient(app, client=client_addr, raise_server_exceptions=False)


@pytest.fixture()
def client(assets: Path, backend: FakeBackend) -> Iterator[TestClient]:
    with _client(assets, backend) as c:
        _wait_ready(c)
        yield c


def _synth(client: TestClient, body: dict[str, Any], headers: dict[str, str] | None = None):  # type: ignore[no-untyped-def]
    return client.post("/synthesize", json=body, headers=AUTH if headers is None else headers)


# ---- health ----


def test_public_health_is_minimal(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    # 무인증 응답에는 liveness 두 필드뿐 — 모델·장치·메모리·버전·인증 설정 여부 없음(Codex C2).
    assert r.json() == {"status": "OK", "warmedUp": True}


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Secret": "wrong"}])
def test_health_detail_requires_secret(client: TestClient, headers: dict[str, str]) -> None:
    r = client.get("/health/detail", headers=headers)
    assert r.status_code == 401
    assert "modelsLoaded" not in r.text


def test_health_detail_has_no_secret_or_path(client: TestClient, assets: Path) -> None:
    r = client.get("/health/detail", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    for key in ("ok", "version", "modelsLoaded", "defaultModel", "device", "uptimeSec", "warmedUp", "memoryMb"):
        assert key in body
    assert body["ok"] is True and body["status"] == "OK"
    assert body["modelsLoaded"] == 3 and body["warmedUp"] is True and body["device"] == "mps"
    assert body["gpuMb"] == 512
    raw = r.text
    assert SECRET not in raw
    assert str(assets) not in raw and "safetensors" not in raw and "/Users/" not in raw


def test_health_reports_loading_then_degraded_on_cpu_fallback(assets: Path) -> None:
    fb = FakeBackend(fail_warmup_on="mps")
    with _client(assets, fb) as c:
        body = _wait_ready(c)
    assert body["device"] == "cpu" and body["deviceFallback"] is True
    assert body["status"] == "DEGRADED" and body["ok"] is True and body["modelsLoaded"] == 3
    assert fb.calls and all(call["device"] == "cpu" for call in fb.calls)


def test_health_misconfigured_when_secret_missing(assets: Path, backend: FakeBackend) -> None:
    with _client(assets, backend, internal_secret="") as c:
        body = _wait_ready(c)
        assert set(body) == {"status", "warmedUp"} and body["status"] == "MISCONFIGURED"
        assert c.get("/health/detail", headers={"X-Internal-Secret": ""}).status_code == 401
        # 서버 시크릿이 비어 있으면 빈 헤더로도 통과하지 못한다(fail-closed).
        assert c.post("/synthesize", json={"text": "テスト"}, headers={"X-Internal-Secret": ""}).status_code == 401


def test_startup_crash_reports_failed(assets: Path) -> None:
    fb = FakeBackend()

    def boom(_: str) -> str:
        raise OSError("disk")

    fb.init = boom  # type: ignore[method-assign]
    with _client(assets, fb) as c:
        body = _wait_ready(c)
    assert body["status"] == "FAILED" and body["ok"] is False and body["modelsLoaded"] == 0


def test_startup_hang_is_stuck(assets: Path) -> None:
    fb = FakeBackend()
    fb.gate.clear()
    with _client(assets, fb, stuck_sec=15) as c:
        runner = c.app.state.runner  # type: ignore[attr-defined]
        for _ in range(100):
            if runner.busy_kind == "startup":
                break
            time.sleep(0.01)
        runner._busy_since = time.monotonic() - 61  # 15s × 4 초과
        r = c.get("/health")
        detail = c.get("/health/detail", headers=AUTH)
        fb.gate.set()
    assert r.status_code == 503 and r.json() == {"status": "STUCK", "warmedUp": False}
    assert detail.status_code == 503 and detail.json()["status"] == "STUCK"


def test_health_stuck_returns_503(assets: Path, backend: FakeBackend) -> None:
    with _client(assets, backend) as c:
        _wait_ready(c)
        runner = c.app.state.runner  # type: ignore[attr-defined]
        runner._busy_kind = "synth"
        runner._busy_since = time.monotonic() - 1000
        r = c.get("/health")
        runner._busy_kind = None
        runner._busy_since = None
    assert r.status_code == 503 and r.json()["status"] == "STUCK"


# ---- auth ----


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Secret": "wrong"}, {"X-Internal-Secret": SECRET + "x"}])
def test_synthesize_requires_secret(client: TestClient, headers: dict[str, str]) -> None:
    r = _synth(client, {"text": "テスト"}, headers)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"
    assert SECRET not in r.text


@pytest.mark.parametrize("method,path", [("get", "/voices"), ("post", "/g2p"), ("post", "/synthesize")])
def test_protected_routes_need_secret(client: TestClient, method: str, path: str) -> None:
    assert getattr(client, method)(path).status_code == 401


def test_unauthenticated_invalid_body_gets_401_not_schema_error(client: TestClient) -> None:
    r = client.post("/synthesize", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 401


def test_docs_are_disabled(client: TestClient) -> None:
    for path in ("/docs", "/openapi.json", "/redoc"):
        assert client.get(path, headers=AUTH).status_code == 404


# ---- admin: loopback only ----


@pytest.mark.parametrize("path", ["/admin/models/refresh", "/admin/whatever", "/ADMIN/models/refresh"])
def test_admin_from_remote_is_404_even_with_secret(client: TestClient, path: str) -> None:
    r = client.post(path, headers=AUTH)
    assert r.status_code == 404
    assert "admin" not in r.text.lower()


def test_admin_refresh_from_loopback(assets: Path, backend: FakeBackend) -> None:
    with _client(assets, backend, client_addr=LOOPBACK) as c:
        _wait_ready(c)
        assert c.post("/admin/models/refresh").status_code == 401
        r = c.post("/admin/models/refresh", headers=AUTH)
        assert r.status_code == 200
        assert r.json() == {"models": ["jvnv-F1-jp", "jvnv-F2-jp", "jvnv-M1-jp"], "added": [], "reloaded": [], "removed": [], "errors": []}


def test_admin_from_ipv6_loopback(assets: Path, backend: FakeBackend) -> None:
    with _client(assets, backend, client_addr=("::1", 1)) as c:
        _wait_ready(c)
        assert c.post("/admin/models/refresh", headers=AUTH).status_code == 200


# ---- synthesize ----


def test_synthesize_returns_wav_and_headers(client: TestClient, backend: FakeBackend) -> None:
    r = _synth(
        client,
        {
            "text": "こんにちは。",
            "voice": {"model": "jvnv-F2-jp", "speaker": 0, "style": "Happy", "styleWeight": 0.8},
            "controls": {"speed": 1.25, "pitch": 1.0, "intonation": 1.1, "pauseBeforeMs": 300},
            "profile": "NATIVE",
            "traceId": "t_abc123",
        },
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "audio/wav"
    with wave.open(io.BytesIO(r.content)) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == 44100 and w.getnframes() > 0
    assert r.headers["X-Kaiwa-Model"] == "jvnv-F2-jp"
    assert int(r.headers["X-Kaiwa-Latency-Ms"]) >= 0
    assert r.headers["X-Trace-Id"] == "t_abc123"
    assert r.headers["X-Kaiwa-Style"] == "Happy" and r.headers["X-Kaiwa-Style-Fallback"] == "0"
    assert r.headers["X-Kaiwa-Adjust"] == "applied"
    call = backend.calls[-1]
    assert call["model"] == "jvnv-F2-jp"
    assert call["length"] == 0.8 and call["intonation_scale"] == 1.1 and call["pitch_scale"] == 1.0
    assert call["style"] == "Happy" and call["style_weight"] == 0.8 and call["line_split"] is False
    assert "pauseBeforeMs" not in call and "profile" not in call


def test_synthesize_defaults_to_default_model_and_neutral(client: TestClient, backend: FakeBackend) -> None:
    r = _synth(client, {"text": "テスト"})
    assert r.status_code == 200
    assert r.headers["X-Kaiwa-Model"] == "jvnv-F1-jp"
    assert r.headers["X-Kaiwa-Adjust"] == "none"
    call = backend.calls[-1]
    assert (call["length"], call["pitch_scale"], call["intonation_scale"], call["sdp_ratio"], call["noise"], call["noise_w"]) == (
        1.0,
        1.0,
        1.0,
        0.2,
        0.6,
        0.8,
    )


def test_unknown_style_falls_back_to_neutral(client: TestClient) -> None:
    r = _synth(client, {"text": "テスト", "voice": {"style": "Friendly"}})
    assert r.status_code == 200
    assert r.headers["X-Kaiwa-Style"] == "Neutral" and r.headers["X-Kaiwa-Style-Fallback"] == "1"


def test_pitch_adjust_failure_retries_without_adjust(client: TestClient, backend: FakeBackend) -> None:
    r = _synth(client, {"text": "テスト", "controls": {"pitch": 0.77}})
    assert r.status_code == 200
    assert r.headers["X-Kaiwa-Adjust"] == "skipped"
    assert backend.calls[-1]["pitch_scale"] == 1.0


def test_logs_never_contain_text_even_at_debug(assets: Path, backend: FakeBackend) -> None:
    records: list[logging.LogRecord] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = Capture(level=logging.DEBUG)
    logger = logging.getLogger("kaiwa_tts")
    logger.addHandler(handler)
    text = "秘密の文章です。"
    try:
        with _client(assets, backend, log_level="DEBUG") as c:
            _wait_ready(c)
            assert _synth(c, {"text": text, "traceId": "t_log"}).status_code == 200
            assert _synth(c, {"text": text + "\n続き"}).status_code == 400
            assert c.post("/g2p", json={"text": text}, headers=AUTH).status_code == 200
    finally:
        logger.removeHandler(handler)
    lines = [r.getMessage() for r in records]
    assert not any(text in line or "秘密" in line for line in lines)
    digest = hashlib.sha256(text.encode()).hexdigest()[:12]
    assert any("trace=t_log" in line and f"text_sha={digest}" in line and "chars=8" in line for line in lines)


def test_x_kaiwa_model_is_id_not_path(client: TestClient, assets: Path) -> None:
    r = _synth(client, {"text": "テスト"})
    for name, value in r.headers.items():
        assert str(assets) not in value and "safetensors" not in value, name


@pytest.mark.parametrize(
    "text,code",
    [
        ("あ" * 101, "TEXT_TOO_LONG"),
        ("   ", "TEXT_EMPTY"),
        ("一行目\n二行目", "TEXT_INVALID"),
        ("タブ\tあり", "TEXT_INVALID"),
    ],
)
def test_text_rules(client: TestClient, text: str, code: str) -> None:
    r = _synth(client, {"text": text})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == code


def test_text_exactly_100_chars_ok(client: TestClient) -> None:
    assert _synth(client, {"text": "あ" * 100}).status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {"text": "テスト", "speaker_id": 1},
        {"text": "テスト", "voice": {"model": "../etc"}},
        {"text": "テスト", "voice": {"model": "jvnv-F1-jp", "pitch_scale": 1.2}},
        {"text": "テスト", "controls": {"speed": 3}},
        {"text": "テスト", "controls": {"speed": 0}},
        {"text": "テスト", "controls": {"pitch": 2.0}},
        {"text": "テスト", "controls": {"intonation": -1}},
        {"text": "テスト", "controls": {"pauseBeforeMs": 5000}},
        {"text": "テスト", "voice": {"styleWeight": 9}},
        {"text": "テスト", "profile": "FAST"},
        {"text": "テスト", "traceId": "bad id with space"},
        {"voice": {}},
    ],
)
def test_validation_errors_are_400(client: TestClient, body: dict[str, Any]) -> None:
    r = _synth(client, body)
    assert r.status_code == 400, r.text
    err = r.json()["error"]
    assert err["code"] == "INVALID_REQUEST"
    assert "テスト" not in r.text  # 입력값을 되돌려 주지 않는다


def test_nan_rejected(client: TestClient) -> None:
    raw = b'{"text":"\\u30c6","controls":{"speed":NaN}}'
    r = client.post("/synthesize", content=raw, headers={**AUTH, "content-type": "application/json"})
    assert r.status_code == 400


def test_unknown_model_and_speaker(client: TestClient) -> None:
    r = _synth(client, {"text": "テスト", "voice": {"model": "teacher_mio"}})
    assert r.status_code == 400 and r.json()["error"]["code"] == "UNKNOWN_MODEL"
    r = _synth(client, {"text": "テスト", "voice": {"speaker": 3}})
    assert r.status_code == 400 and r.json()["error"]["code"] == "UNKNOWN_SPEAKER"


def test_body_over_8kb_is_413(client: TestClient) -> None:
    body = json.dumps({"text": "テスト", "traceId": "t", "pad": "x" * 9000}).encode()
    r = client.post("/synthesize", content=body, headers={**AUTH, "content-type": "application/json"})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "BODY_TOO_LARGE"


def test_chunked_body_over_limit_is_413(client: TestClient) -> None:
    def chunks() -> Iterator[bytes]:
        yield b'{"text":"'
        for _ in range(20):
            yield b"a" * 1000
        yield b'"}'

    r = client.post("/synthesize", content=chunks(), headers={**AUTH, "content-type": "application/json"})
    assert r.status_code == 413


def test_queue_timeout_is_503_with_retry_after(client: TestClient) -> None:
    async def busy(*_: Any, **__: Any) -> Any:
        raise QueueTimeout()

    client.app.state.runner.run = busy  # type: ignore[attr-defined]
    r = _synth(client, {"text": "テスト"})
    assert r.status_code == 503
    assert r.headers["Retry-After"] == "2"
    assert r.json()["error"]["code"] == "BUSY"


def test_not_ready_while_loading(assets: Path) -> None:
    fb = FakeBackend()
    fb.gate.clear()  # 워밍업에서 멈춰 LOADING 유지
    with _client(assets, fb) as c:
        r = _synth(c, {"text": "テスト"})
        assert r.status_code == 503 and r.headers["Retry-After"] == "5"
        assert r.json()["error"]["code"] == "NOT_READY"
        assert c.get("/health").json()["status"] == "LOADING"
        fb.gate.set()


# ---- voices / g2p ----


def test_voices_shape(client: TestClient, assets: Path) -> None:
    (assets / "_trash").mkdir()
    r = client.get("/voices", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["defaultModel"] == "jvnv-F1-jp"
    names = [m["modelName"] for m in body["models"]]
    assert names == ["jvnv-F1-jp", "jvnv-F2-jp", "jvnv-M1-jp"]
    first = body["models"][0]
    assert first["status"] == "LOADED" and first["loaded"] is True
    assert first["speakers"] == [{"id": 0, "name": "jvnv-F1-jp"}]
    assert first["styles"] == ["Neutral", "Happy", "Sad"] and first["defaultStyle"] == "Neutral"
    assert first["checkpoint"] == "e10_s100" and len(first["sha256"]) == 64
    assert str(assets) not in r.text and "safetensors" not in r.text


def test_g2p(client: TestClient) -> None:
    r = client.post("/g2p", json={"text": "こんにちは。雨"}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["reading"] == "コンニチワ.アメ"
    assert body["accent"] == "コ↑ンニチワ.ア↓メ"
    assert body["moras"][1] == {"mora": "ン", "tone": 1}
    assert client.post("/g2p", json={"text": "あ" * 201}, headers=AUTH).json()["error"]["code"] == "TEXT_TOO_LONG"


# ---- timing (task-012b-4: 응답 헤더 X-Tts-Timing, 요청 스키마 무변경) ----

TIMING_TEXT = "今日は駅前で、友達に会います。"


def test_synthesize_attaches_timing_header(client: TestClient) -> None:
    r = _synth(client, {"text": TIMING_TEXT, "traceId": "t_timing"})
    assert r.status_code == 200
    assert r.headers["X-Kaiwa-Timing"] == "ok"
    assert float(r.headers["X-Kaiwa-Timing-Ms"]) >= 0
    value = r.headers["X-Tts-Timing"]
    assert value.isascii() and "=" not in value
    data = decode_header(value)
    assert data["method"] == "ENGINE_DURATION" and data["coord"] == "codepoint"
    assert abs(data["durationMs"] - int(r.headers["X-Kaiwa-Audio-Ms"])) <= 1
    pieces = [TIMING_TEXT[cs:ce] for _, _, cs, ce in data["words"]]
    assert pieces == ["今日", "は", "駅前", "で", "友達", "に", "会", "います"]
    starts = [s for s, _, _, _ in data["words"]]
    assert starts == sorted(starts) and all(s < e <= data["durationMs"] for s, e, _, _ in data["words"])
    # 헤더에 문장·단어 글이 없다(숫자뿐).
    assert "今日" not in json.dumps(data, ensure_ascii=False)


def test_request_schema_is_unchanged_for_timing(client: TestClient) -> None:
    # 요청에 timing 키를 새로 받지 않는다 — 구 서비스가 400 을 내는 키를 앱이 보내지 않게(배포 순서 무관).
    r = _synth(client, {"text": "テスト", "timing": True})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_REQUEST"


def test_timing_coordinates_are_raw_request_codepoints(client: TestClient) -> None:
    text = "  こんにちは\U0001f600、元気？"
    r = _synth(client, {"text": text})
    words = decode_header(r.headers["X-Tts-Timing"])["words"]
    assert [text[cs:ce] for _, _, cs, ce in words] == ["こんにちは", "元気"]
    assert words[0][2] == 2 and words[1][2] == 9


@pytest.mark.parametrize(
    "alignment, status",
    [
        ("none", "unavailable"),
        ("raise:token_mismatch", "token_mismatch"),
        ("extra_samples:1", "frame_mismatch"),
        ("boom", "error"),
    ],
)
def test_timing_failure_keeps_audio(assets: Path, alignment: str, status: str) -> None:
    with _client(assets, FakeBackend()) as ok_client:
        _wait_ready(ok_client)
        good = _synth(ok_client, {"text": TIMING_TEXT})
    with _client(assets, FakeBackend(alignment=alignment)) as c:
        _wait_ready(c)
        r = _synth(c, {"text": TIMING_TEXT})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav"
    assert r.headers["X-Kaiwa-Timing"] == status
    assert "X-Tts-Timing" not in r.headers
    if not alignment.startswith("extra_samples"):
        # timing 유무와 무관하게 오디오 바이트가 같다.
        assert r.content == good.content


def test_pitch_adjust_allows_small_length_difference(assets: Path) -> None:
    body = {"text": TIMING_TEXT, "controls": {"pitch": 1.1}}
    with _client(assets, FakeBackend(alignment="extra_samples:200")) as c:
        _wait_ready(c)
        r = _synth(c, body)
        assert r.headers["X-Kaiwa-Adjust"] == "applied" and r.headers["X-Kaiwa-Timing"] == "ok"
        # 후처리가 없으면 1샘플도 허용하지 않는다.
        r2 = _synth(c, {"text": TIMING_TEXT})
        assert r2.headers["X-Kaiwa-Timing"] == "frame_mismatch"
    with _client(assets, FakeBackend(alignment="extra_samples:300")) as c:
        _wait_ready(c)
        assert _synth(c, body).headers["X-Kaiwa-Timing"] == "frame_mismatch"


def test_timing_header_over_cap_is_omitted(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import kaiwa_tts.server as server_mod

    monkeypatch.setattr(server_mod, "encode_header", lambda _t: None)
    r = _synth(client, {"text": TIMING_TEXT})
    assert r.status_code == 200 and r.headers["X-Kaiwa-Timing"] == "too_large"
    assert "X-Tts-Timing" not in r.headers


def test_overlong_request_text_skips_timing_but_keeps_audio(client: TestClient) -> None:
    # 앞뒤 공백은 합성 100자 검사 전에 지워지지만 timing 좌표는 원문 기준이라 원문 길이로 막는다.
    good = _synth(client, {"text": TIMING_TEXT})
    at_cap = " " * (TIMING_MAX_TEXT_CHARS - len(TIMING_TEXT)) + TIMING_TEXT
    r_cap = _synth(client, {"text": at_cap})
    assert r_cap.status_code == 200 and r_cap.headers["X-Kaiwa-Timing"] == "ok"
    words = decode_header(r_cap.headers["X-Tts-Timing"])["words"]
    assert at_cap[words[0][2] : words[0][3]] == "今日"
    r = _synth(client, {"text": " " + at_cap})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav"
    assert r.headers["X-Kaiwa-Timing"] == "too_long" and "X-Tts-Timing" not in r.headers
    assert r.content == good.content == r_cap.content


def test_timing_failure_logs_have_no_text(assets: Path) -> None:
    records: list[logging.LogRecord] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = Capture(level=logging.DEBUG)
    logger = logging.getLogger("kaiwa_tts")
    logger.addHandler(handler)
    try:
        with _client(assets, FakeBackend(alignment="boom"), log_level="DEBUG") as c:
            _wait_ready(c)
            assert _synth(c, {"text": "秘密の文章です。"}).status_code == 200
    finally:
        logger.removeHandler(handler)
    lines = [r.getMessage() for r in records]
    assert any("timing failed" in line and "RuntimeError" in line for line in lines)
    assert any("timing=error" in line for line in lines)
    assert not any("秘密" in line for line in lines)
