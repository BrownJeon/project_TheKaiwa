"""잡 루프(백오프·잘못된 잡 건너뛰기·기동 점검·멈춤)와 설정 로더(DB 없음·엔진명은 yml 값)."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx

from kaiwa_speech_common.config import REPO_ROOT
from kaiwa_worker.comparator import TranscriptComparator
from kaiwa_worker.config import LoopConfig, load_worker_settings
from kaiwa_worker.handlers.analysis_stt import HandlerDeps
from kaiwa_worker.loop import WorkerLoop
from tests.conftest import JOB, REL, SECRET, UTT, Recorder, TableReading, ok, write_wav

YML = REPO_ROOT / "speech" / "speech.config.yml"


def base_env(tmp_path: Path) -> dict[str, str]:
    return {"SPEECH_INTERNAL_SECRET": SECRET, "DATA_ROOT": str(tmp_path), "APP_ENV": "LOCAL", "APP_INTERNAL_URL": "http://127.0.0.1:3017"}


def test_settings_from_repo_yaml_need_no_database(tmp_path: Path) -> None:
    s = load_worker_settings(base_env(tmp_path), YML)
    assert s.issues == (), s.issues
    assert s.analysis.engine and s.analysis.mode == "http" and s.analysis.timeout_ms == 60000 and s.analysis.language == "ja"
    assert s.connection_key and s.loop.batch_size == 1 and s.loop.kinds == ("ANALYSIS_STT",)
    assert s.loop.idle_backoff_max_ms == 10_000 and 500 <= s.loop.poll_interval_ms <= 10_000
    assert s.app_internal_url == "http://127.0.0.1:3017" and s.worker_id.startswith("worker-")
    assert SECRET not in repr(s)


def test_instance_id_has_boot_nonce_and_fits_locked_by(tmp_path: Path) -> None:
    env = {**base_env(tmp_path), "SPEECH_WORKER_ID": "w" * 64}
    a = load_worker_settings(env, YML)
    b = load_worker_settings(env, YML)
    assert a.worker_id == b.worker_id == "w" * 64, "설정 이름은 같다"
    assert a.instance_id != b.instance_id, "같은 SPEECH_WORKER_ID 두 프로세스 = 다른 인스턴스 id(서로의 잡을 되돌리지 않음)"
    assert a.instance_id.startswith("w" * 64 + "-") and len(a.instance_id) <= 80 and len(a.instance_nonce) == 8
    assert a.instance_id in repr(a)


def test_env_overrides_and_issues(tmp_path: Path) -> None:
    s = load_worker_settings({**base_env(tmp_path), "WHISPER_SERVICE_URL": "http://127.0.0.1:9999", "SPEECH_WORKER_ID": "worker-1"}, YML)
    assert s.analysis.endpoint == "http://127.0.0.1:9999" and s.worker_id == "worker-1"
    bad = load_worker_settings({"APP_ENV": "nope", "SPEECH_INTERNAL_SECRET": "short", "WHISPER_SERVICE_URL": "ftp://x"}, YML)
    assert {"APP_ENV:invalid", "SPEECH_INTERNAL_SECRET:too_short", "DATA_ROOT:missing", "stt.validation.endpoint:invalid"} <= set(bad.issues)
    missing = load_worker_settings(base_env(tmp_path), tmp_path / "none.yml")
    assert "SPEECH_CONFIG_PATH:not_found" in missing.issues and "stt.validation.engine:missing" in missing.issues


class _Engine:
    model_label = "m"

    def __init__(self) -> None:
        self.calls = 0

    async def transcribe(self, audio: Any, request: Any, ctx: Any) -> Any:
        from kaiwa_speech_common.engine.interfaces import TranscriptionResult

        self.calls += 1
        return TranscriptionResult(text="こんにちは")

    async def aclose(self) -> None:
        return None


def make_loop(tmp_path: Path, rec: Recorder, cfg: LoopConfig | None = None, reading: TableReading | None = None) -> WorkerLoop:
    from kaiwa_speech_common.internal_client import InternalClient

    client = InternalClient("http://app.test", SECRET, "LOCAL", 2000, transport=httpx.MockTransport(rec.handler), service="worker")
    comparator = TranscriptComparator(reading or TableReading())
    deps = HandlerDeps(
        client=client, engine=_Engine(), comparator=comparator, data_root=tmp_path, worker_id="w1", connection_key="c", model_label="m", app_env="LOCAL"
    )
    return WorkerLoop(cfg or LoopConfig(poll_interval_ms=1000), client, deps, comparator, "w1")


def test_idle_backoff_doubles_to_10s_and_resets_after_work(tmp_path: Path) -> None:
    loop = make_loop(tmp_path, Recorder())
    assert [loop.next_delay_ms(0) for _ in range(6)] == [1000, 2000, 4000, 8000, 10000, 10000]
    assert loop.next_delay_ms(1) == 0, "처리했으면 쉬지 않고 다음 claim(디바운스로 풀린 잡을 빨리 비운다)"
    assert loop.next_delay_ms(0) == 1000, "빈 응답이면 간격부터 다시"


def test_run_once_claims_with_worker_headers_and_skips_malformed(tmp_path: Path) -> None:
    rec = Recorder()
    write_wav(tmp_path / REL)
    jobs = [
        {"id": "../bad", "kind": "ANALYSIS_STT", "utteranceId": UTT},
        {"id": JOB, "kind": "ANALYSIS_STT", "utteranceId": UTT, "audioPath": REL, "realtimeText": "こんにちは", "attempts": 1},
    ]
    rec.routes["/jobs/claim"] = lambda b: ok({"jobs": jobs})
    rec.routes["/analysis"] = lambda b: ok({"stored": True})
    loop = make_loop(tmp_path, rec)
    assert asyncio.run(loop.run_once()) == 1
    path, headers, body = rec.requests[0]
    assert path == "/api/internal/speech/jobs/claim" and body == {"workerId": "w1", "kinds": ["ANALYSIS_STT"], "max": 1}
    assert headers["x-service"] == "worker" and headers["x-internal-secret"] == SECRET


def test_claim_failure_returns_zero(tmp_path: Path) -> None:
    rec = Recorder()
    rec.routes["/jobs/claim"] = lambda b: httpx.Response(401, json={"success": False})
    assert asyncio.run(make_loop(tmp_path, rec).run_once()) == 0


def test_not_ready_reading_never_claims_and_stops(tmp_path: Path) -> None:
    rec = Recorder()
    reading = TableReading()
    reading.ok = False
    loop = make_loop(tmp_path, rec, LoopConfig(reading_recheck_sec=1), reading)

    async def go() -> None:
        task = asyncio.create_task(loop.run())
        await asyncio.sleep(0.2)
        loop.stop.set()
        await asyncio.wait_for(task, 3)

    asyncio.run(go())
    assert rec.requests == [], "읽기 변환기가 없으면 claim 하지 않는다"


def test_stop_finishes_current_loop(tmp_path: Path) -> None:
    rec = Recorder()
    calls: list[int] = []

    def claim(b: dict[str, Any]) -> httpx.Response:
        calls.append(1)
        return ok({"jobs": []})

    rec.routes["/jobs/claim"] = claim
    loop = make_loop(tmp_path, rec, LoopConfig(poll_interval_ms=500))

    async def go() -> None:
        task = asyncio.create_task(loop.run())
        await asyncio.sleep(0.3)
        loop.stop.set()
        await asyncio.wait_for(task, 3)

    asyncio.run(go())
    assert len(calls) == 1
