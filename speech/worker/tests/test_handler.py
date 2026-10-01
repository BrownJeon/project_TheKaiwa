"""ANALYSIS_STT 핸들러 — 오디오 경로 검증·엔진 오류 분류·#138 응답별 처리·로그 원문 0."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest

from kaiwa_speech_common.engine.errors import SttRequestError
from kaiwa_worker.handlers.analysis_stt import HandlerDeps, handle_analysis_stt
from kaiwa_worker.jobs import ClaimedJob, parse_job
from tests.conftest import JOB, REL, UTT, FakeEngine, Recorder, ok, write_wav


def job(audio_path: str | None = REL, text: str = "こんにちは") -> ClaimedJob:
    j = parse_job(
        {"id": JOB, "kind": "ANALYSIS_STT", "utteranceId": UTT, "audioPath": audio_path, "realtimeText": text, "recognitionMode": "AUTO", "attempts": 1}
    )
    assert j is not None
    return j


def run(coro: Any) -> Any:
    return asyncio.run(coro)


def failure_body(rec: Recorder) -> dict[str, Any]:
    bodies = [b for p, _, b in rec.requests if p.endswith("/result")]
    assert len(bodies) == 1
    return bodies[0]


def test_success_posts_similarity_and_flags_only(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/analysis"] = lambda b: ok(
        {"stored": True, "utteranceStatus": "ANALYZED", "transcriptConfidence": 1, "requiresReview": False, "finalSource": "REALTIME"}
    )
    out = run(handle_analysis_stt(job(), make_deps(FakeEngine("こんにちは"))))
    assert out.status == "STORED"
    path, headers, body = recorder.requests[0]
    assert path == f"/api/internal/speech/utterances/{UTT}/analysis"
    assert headers["x-service"] == "worker" and headers["x-service-env"] == "LOCAL" and headers["x-trace-id"].startswith("t_")
    assert body["jobId"] == JOB and body["workerId"] == "worker-test" and body["analysisEngine"] == "analysis-conn"
    assert body["analysisText"] == "こんにちは" and body["pronunciation"] is None
    assert body["comparator"] == {"similarity": 1.0, "flags": [], "realtimeLen": 5, "analysisLen": 5, "version": "1.0"}
    assert set(body["engineVersions"]) == {"analysisStt", "reading"}
    assert "requiresReview" not in body, "판정은 앱"
    assert all(k not in body for k in ("normalized", "realtimeNormalized", "analysisNormalized"))


@pytest.mark.parametrize(
    "rel",
    [None, "", "/etc/passwd", "users/../../x.wav", "users/u/utterances/2026-09/../x.wav", "users/u/other/2026-09/x.wav", REL],
)
def test_bad_or_missing_audio_is_audio_missing_not_retryable(
    tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps], rel: str | None
) -> None:
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    engine = FakeEngine("x")
    out = run(handle_analysis_stt(job(rel), make_deps(engine)))
    assert out.status == "FAILED" and out.error == "AUDIO_MISSING" and engine.calls == 0
    body = failure_body(recorder)
    assert body == {"workerId": "worker-test", "status": "FAILED", "error": "AUDIO_MISSING", "retryable": False, "attempt": 1}


@pytest.mark.parametrize("attempts,expected", [(1, 1), (3, 3), (0, None)])
def test_failure_report_carries_claim_generation(recorder: Recorder, make_deps: Callable[..., HandlerDeps], attempts: int, expected: int | None) -> None:
    """#140 에 그 잡을 받은 claim 의 attempts(claim 세대)를 싣는다 — 앱이 앞 세대의 늦은 보고를 409 로 거른다(REV-033 권고 a). 모르면(0) 싣지 않는다."""
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    j = parse_job({"id": JOB, "kind": "ANALYSIS_STT", "utteranceId": UTT, "audioPath": None, "realtimeText": "x", "attempts": attempts})
    assert j is not None
    run(handle_analysis_stt(j, make_deps()))
    body = failure_body(recorder)
    assert body.get("attempt") == expected and (expected is not None or "attempt" not in body)


def test_symlink_outside_data_root_is_refused(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    outside = tmp_path.parent / f"{tmp_path.name}-outside.wav"
    write_wav(outside)
    link = tmp_path / REL
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(outside)
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    out = run(handle_analysis_stt(job(), make_deps()))
    assert out.error == "AUDIO_MISSING"


def test_invalid_wav_is_audio_invalid(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    p = tmp_path / REL
    p.parent.mkdir(parents=True)
    p.write_bytes(b"not a wav")
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    out = run(handle_analysis_stt(job(), make_deps()))
    assert out.error == "AUDIO_INVALID" and failure_body(recorder)["retryable"] is False


@pytest.mark.parametrize(
    "err,retryable",
    [
        (SttRequestError("ANALYSIS_UNAVAILABLE", True, 503), True),
        (SttRequestError("ANALYSIS_TIMEOUT", True), True),
        (SttRequestError("ANALYSIS_REJECTED", False, 422), False),
    ],
)
def test_engine_errors_are_reported_with_retryable(
    tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps], err: SttRequestError, retryable: bool
) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "QUEUED" if b["retryable"] else "FAILED"})
    out = run(handle_analysis_stt(job(), make_deps(FakeEngine(error=err))))
    body = failure_body(recorder)
    assert body["error"] == err.code and body["retryable"] is retryable
    assert out.report_status == ("QUEUED" if retryable else "FAILED")
    assert "WHISPER" not in body["error"], "코드값에 엔진명 없음"


def test_both_empty_is_empty_transcripts(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    out = run(handle_analysis_stt(job(text="。"), make_deps(FakeEngine(""))))
    assert out.error == "EMPTY_TRANSCRIPTS" and failure_body(recorder)["retryable"] is False
    assert not any(p.endswith("/analysis") for p in recorder.paths()), "#138 을 부르지 않는다"


def test_analysis_empty_still_posts_with_flag(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/analysis"] = lambda b: ok({"stored": True, "requiresReview": True})
    run(handle_analysis_stt(job(text="はい"), make_deps(FakeEngine(""))))
    body = recorder.requests[0][2]
    assert body["comparator"]["flags"] == ["ANALYSIS_EMPTY"] and body["comparator"]["similarity"] == 0.0


@pytest.mark.parametrize("status,expect", [(404, "IGNORED"), (409, "IGNORED")])
def test_analysis_404_409_are_ignored(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps], status: int, expect: str) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/analysis"] = lambda b: httpx.Response(status, json={"success": False})
    out = run(handle_analysis_stt(job(), make_deps()))
    assert out.status == expect and not any(p.endswith("/result") for p in recorder.paths())


def test_analysis_400_is_callback_rejected_and_5xx_retryable(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/analysis"] = lambda b: httpx.Response(400, json={"success": False})
    recorder.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "FAILED"})
    run(handle_analysis_stt(job(), make_deps()))
    assert failure_body(recorder)["error"] == "CALLBACK_REJECTED" and failure_body(recorder)["retryable"] is False
    rec2 = Recorder()
    rec2.routes["/analysis"] = lambda b: httpx.Response(500, json={"success": False})
    rec2.routes["/result"] = lambda b: ok({"ok": True, "jobStatus": "QUEUED"})
    deps = make_deps()
    from kaiwa_speech_common.internal_client import InternalClient

    deps2 = HandlerDeps(
        **{**deps.__dict__, "client": InternalClient("http://app.test", "s" * 32, "LOCAL", 2000, transport=httpx.MockTransport(rec2.handler), service="worker")}
    )
    run(handle_analysis_stt(job(), deps2))
    assert rec2.paths().count(f"/api/internal/speech/utterances/{UTT}/analysis") == 2, "5xx 는 클라이언트가 1회 재시도"
    assert failure_body(rec2) == {"workerId": "worker-test", "status": "FAILED", "error": "CALLBACK_FAILED", "retryable": True, "attempt": 1}


def test_stale_failure_report_is_ignored(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps]) -> None:
    recorder.routes["/result"] = lambda b: httpx.Response(409, json={"success": False, "data": {"code": "CONFLICT", "details": {"reason": "STALE_CLAIM"}}})
    out = run(handle_analysis_stt(job(None), make_deps()))
    assert out.report_status == "STALE"


def test_logs_have_no_transcript(tmp_path: Path, recorder: Recorder, make_deps: Callable[..., HandlerDeps], caplog: pytest.LogCaptureFixture) -> None:
    write_wav(tmp_path / REL)
    recorder.routes["/analysis"] = lambda b: ok({"stored": True, "requiresReview": False})
    with caplog.at_level(logging.DEBUG):
        run(handle_analysis_stt(job(text="ひみつのはなしです"), make_deps(FakeEngine("ひみつのはなしでした"))))
    assert "ひみつ" not in caplog.text and REL not in caplog.text
    assert "chars=9 sha1=" in caplog.text


def test_parse_job_rejects_bad_ids() -> None:
    assert parse_job({"id": "../x", "kind": "ANALYSIS_STT", "utteranceId": UTT}) is None
    assert parse_job({"id": JOB, "kind": "OTHER", "utteranceId": UTT}) is None
    j = parse_job({"id": JOB, "kind": "ANALYSIS_STT", "utteranceId": UTT, "attempts": True, "realtimeText": None})
    assert j is not None and j.attempts == 0 and j.realtime_text == "" and "こん" not in repr(j)
