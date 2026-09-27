"""순수 함수·스캔·직렬화 단위 테스트."""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import pytest
from conftest import make_model

from kaiwa_tts.config import Settings
from kaiwa_tts.models import scan_model_assets
from kaiwa_tts.params import TextError, build_plan, clean_text, resolve_style, snap_unity
from kaiwa_tts.runtime import QueueTimeout, SerialRunner
from kaiwa_tts.schemas import SynthesizeIn
from kaiwa_tts.security import is_admin_path, is_loopback
from kaiwa_tts.server import accent_string

# ---- params ----


@pytest.mark.parametrize("speed,length", [(1.0, 1.0), (0.8, 1.25), (0.6, 1.6667), (1.2, 0.8333), (2.0, 0.5)])
def test_speed_to_length(speed: float, length: float) -> None:
    req = SynthesizeIn.model_validate({"text": "テスト", "controls": {"speed": speed}})
    assert build_plan(req, "テスト", ["Neutral"]).kwargs["length"] == length


def test_plan_maps_every_engine_neutral_field() -> None:
    req = SynthesizeIn.model_validate(
        {
            "text": "テスト",
            "voice": {"speaker": 0, "style": "Happy", "styleWeight": 1.2},
            "controls": {"speed": 1.0, "pitch": 1.05, "intonation": 0.9},
            "engine": {"sdpRatio": 0.4, "noise": 0.5, "noiseW": 0.7},
        }
    )
    plan = build_plan(req, "テスト", ["Neutral", "Happy"])
    assert plan.kwargs == {
        "text": "テスト",
        "speaker_id": 0,
        "style": "Happy",
        "style_weight": 1.2,
        "length": 1.0,
        "pitch_scale": 1.05,
        "intonation_scale": 0.9,
        "sdp_ratio": 0.4,
        "noise": 0.5,
        "noise_w": 0.7,
        "line_split": False,
    }
    assert plan.adjusts_pitch is True


def test_unity_snap_avoids_pyworld_path() -> None:
    assert snap_unity(1.0004) == 1.0 and snap_unity(0.9999) == 1.0 and snap_unity(1.01) == 1.01
    req = SynthesizeIn.model_validate({"text": "テ", "controls": {"pitch": 1.001, "intonation": 0.998}})
    assert build_plan(req, "テ", ["Neutral"]).adjusts_pitch is False


def test_resolve_style() -> None:
    assert resolve_style("Happy", ["Neutral", "Happy"]) == ("Happy", False)
    assert resolve_style("Friendly", ["Neutral", "Happy"]) == ("Neutral", True)
    assert resolve_style("Friendly", ["Calm"]) == ("Calm", True)


def test_clean_text_nfc_and_limits() -> None:
    assert clean_text("  が  ") == "が"
    with pytest.raises(TextError) as e:
        clean_text("a" * 101)
    assert e.value.code == "TEXT_TOO_LONG"
    assert clean_text("a" * 150, max_chars=200) == "a" * 150


def test_accent_string() -> None:
    assert accent_string([("ア", 1), ("メ", 0), ("ガ", 0)]) == "ア↓メガ"
    assert accent_string([("ハ", 0), ("シ", 1), (",", 0), ("ハ", 1), ("シ", 0)]) == "ハ↑シ,ハ↓シ"
    assert accent_string([]) == ""


# ---- security helpers ----


@pytest.mark.parametrize(
    "host,ok",
    [
        ("127.0.0.1", True),
        ("127.8.8.8", True),
        ("::1", True),
        ("::ffff:127.0.0.1", True),
        ("192.168.219.154", False),
        ("125.177.194.26", False),
        ("testclient", False),
        (None, False),
        ("", False),
    ],
)
def test_is_loopback(host: str | None, ok: bool) -> None:
    assert is_loopback(host) is ok


@pytest.mark.parametrize(
    "path,admin",
    [
        ("/admin/models/refresh", True),
        ("//admin/x", True),
        ("/Admin", True),
        ("/administrator", False),
        ("/synthesize", False),
        ("/", False),
    ],
)
def test_is_admin_path(path: str, admin: bool) -> None:
    assert is_admin_path(path) is admin


# ---- model scan ----


def test_scan_rules(tmp_path: Path) -> None:
    root = tmp_path / "model_assets"
    make_model(root, "good", "good_e1_s50.safetensors")
    (root / "good" / "good_e2_s900.safetensors").write_bytes(b"newer")
    (root / "good" / "manifest.json").write_text('{"version": "1.2.0"}')
    make_model(root, "_trash")
    make_model(root, ".cache")
    make_model(root, "off")
    (root / "off" / ".disabled").write_text("")
    pickle_only = root / "pickle"
    pickle_only.mkdir()
    (pickle_only / "config.json").write_text("{}")
    (pickle_only / "style_vectors.npy").write_bytes(b"\x00")
    (pickle_only / "model.pth").write_bytes(b"x")
    outside = make_model(tmp_path / "elsewhere", "escape")
    os.symlink(outside, root / "escape")

    specs, issues = scan_model_assets(root)
    assert [s.model_id for s in specs] == ["good"]
    good = specs[0]
    assert good.weights.name == "good_e2_s900.safetensors" and good.checkpoint == "e2_s900" and good.version == "1.2.0"
    assert {(i.model_id, i.status, i.code) for i in issues} == {
        ("off", "DISABLED", "DISABLED"),
        ("pickle", "ERROR", "INCOMPLETE"),
        ("escape", "ERROR", "OUTSIDE_ROOT"),
    }


def test_scan_missing_root(tmp_path: Path) -> None:
    assert scan_model_assets(tmp_path / "nope") == ([], [])


# ---- settings ----


def test_settings_from_env_hides_secret_in_repr() -> None:
    s = Settings.from_env({"KAIWA_TTS_INTERNAL_SECRET": "s" * 32, "KAIWA_TTS_DEVICE": "CPU", "KAIWA_TTS_QUEUE_TIMEOUT_MS": "999999"})
    assert s.device == "cpu" and s.queue_timeout_ms == 60000 and s.auth_configured
    assert "s" * 32 not in repr(s)
    assert not Settings.from_env({"KAIWA_TTS_INTERNAL_SECRET": "short"}).auth_configured
    with pytest.raises(ValueError):
        Settings.from_env({"KAIWA_TTS_DEVICE": "cuda"})


# ---- runner ----


def test_runner_serializes_and_times_out() -> None:
    async def scenario() -> tuple[list[str], bool, int]:
        runner = SerialRunner(queue_timeout_s=0.2)
        order: list[str] = []

        def job(name: str, secs: float):  # type: ignore[no-untyped-def]
            def run() -> str:
                order.append(f"start-{name}")
                time.sleep(secs)
                order.append(f"end-{name}")
                return name

            return run

        first = asyncio.create_task(runner.run("synth", job("a", 0.5)))
        await asyncio.sleep(0.05)
        timed_out = False
        try:
            await runner.run("synth", job("b", 0.0))
        except QueueTimeout:
            timed_out = True
        await first
        _, queue_ms = await runner.run("synth", job("c", 0.0))
        runner.shutdown()
        return order, timed_out, queue_ms

    order, timed_out, queue_ms = asyncio.run(scenario())
    assert timed_out
    assert order == ["start-a", "end-a", "start-c", "end-c"]
    assert queue_ms < 100
