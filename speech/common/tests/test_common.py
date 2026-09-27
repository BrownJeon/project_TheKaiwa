from __future__ import annotations

import hashlib
import json
import logging
import os
from pathlib import Path

import pytest

from kaiwa_speech_common.config import REPO_ROOT, ConfigError, load_settings
from kaiwa_speech_common.engine.adapters.stt.reazon_sherpa import load_manifest
from kaiwa_speech_common.engine.errors import EngineUnavailableError
from kaiwa_speech_common.engine.interfaces import AudioData, TranscriptionResult
from kaiwa_speech_common.logging import MaskFilter, text_fingerprint
from kaiwa_speech_common.secrets import SecretError, resolve_secret

YML = REPO_ROOT / "speech" / "speech.config.yml"
SECRET = "s" * 40


def base_env(tmp_path: Path) -> dict[str, str]:
    return {"JWT_SECRET": SECRET, "SPEECH_INTERNAL_SECRET": "i" * 40, "DATA_ROOT": str(tmp_path), "APP_ENV": "LOCAL"}


def test_settings_from_repo_yaml(tmp_path: Path) -> None:
    s = load_settings(base_env(tmp_path), YML)
    assert s.stt.endpoint_silence_ms == 500 and s.stt.num_threads == 2 and s.gateway.max_sessions == 8
    assert s.sources["stt.num_threads"] == "APPLICATION_CONFIG"
    assert s.sources["gateway.frames_per_sec"] == "SOURCE_CODE"
    assert s.config_version.startswith("file:") and s.issues == ()
    assert s.gateway.frame_bytes == 1280


def test_env_overrides_and_invalid_values(tmp_path: Path) -> None:
    env = {**base_env(tmp_path), "SPEECH_STT_NUM_THREADS": "4", "SPEECH_GATEWAY_MAX_SESSIONS": "999"}
    s = load_settings(env, YML)
    assert s.stt.num_threads == 4 and s.sources["stt.num_threads"] == "ENVIRONMENT"
    assert s.gateway.max_sessions == 8 and "gateway.max_sessions:invalid(ENVIRONMENT)" in s.issues


def test_missing_secrets_and_data_root_are_issues(tmp_path: Path) -> None:
    s = load_settings({"APP_ENV": "nope", "JWT_SECRET": "short"}, YML)
    assert {"JWT_SECRET:too_short", "SPEECH_INTERNAL_SECRET:missing", "DATA_ROOT:missing", "APP_ENV:invalid"} <= set(s.issues)
    assert s.env.jwt_secret == "" and "short" not in repr(s.env)


def test_unknown_yaml_version_refuses_boot(tmp_path: Path) -> None:
    bad = tmp_path / "c.yml"
    bad.write_text("version: 2\nspeech: {}\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_settings(base_env(tmp_path), bad)


def test_resolve_secret_env_and_file(tmp_path: Path) -> None:
    assert resolve_secret("env:X", {"X": " v "}) == "v"
    with pytest.raises(SecretError):
        resolve_secret("env:X", {})
    f = tmp_path / "tok"
    f.write_text("filevalue\n", encoding="utf-8")
    os.chmod(f, 0o644)
    with pytest.raises(SecretError):
        resolve_secret("file:tok", {"SECRETS_DIR": str(tmp_path)})
    os.chmod(f, 0o600)
    assert resolve_secret("file:tok", {"SECRETS_DIR": str(tmp_path)}) == "filevalue"
    with pytest.raises(SecretError):
        resolve_secret("file:../tok", {"SECRETS_DIR": str(tmp_path)})


def test_mask_filter_removes_jwt_secrets_and_stack(caplog: pytest.LogCaptureFixture) -> None:
    f = MaskFilter(secrets=[SECRET])
    logger = logging.getLogger("t.mask")
    logger.addFilter(f)
    token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcdefghijk"
    with caplog.at_level(logging.INFO, logger="t.mask"):
        logger.info("ticket=%s secret=%s X-Internal-Secret: abc db=mysql://u:p@h/db", token, SECRET)
        try:
            raise ValueError("昨日新宿で友達と")
        except ValueError:
            logger.exception("boom")
    text = caplog.text
    assert token not in text and SECRET not in text and "u:p@h" not in text and "abc" not in text.split("X-Internal-Secret")[1][:8]
    assert "昨日新宿" not in text and "exc=ValueError" in text


def test_reprs_hide_text_and_audio() -> None:
    assert "ab" not in repr(TranscriptionResult(text="秘密の文ab"))
    assert "bytes=4" in repr(AudioData(pcm=b"\x00\x01\x02\x03"))
    assert text_fingerprint("こんにちは").startswith("chars=5 sha1=")


def _manifest(tmp_path: Path, **override: object) -> Path:
    root = tmp_path / "reazonspeech-int8"
    vdir = root / "v1-test"
    vdir.mkdir(parents=True)
    files = []
    for role, name in [("encoder", "e.onnx"), ("decoder", "d.onnx"), ("joiner", "j.onnx"), ("tokens", "tokens.txt"), ("vad", "vad.onnx")]:
        data = role.encode()
        (vdir / name).write_bytes(data)
        files.append({"path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "role": role})
    manifest = {"name": "reazonspeech-int8", "version": "v1-test", "files": files, "totalBytes": sum(f["bytes"] for f in files)}
    manifest.update(override)
    (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return vdir


def test_manifest_ok(tmp_path: Path) -> None:
    _manifest(tmp_path)
    files = load_manifest(tmp_path)
    assert files.label == "reazonspeech-int8@v1-test" and set(files.paths) == {"encoder", "decoder", "joiner", "tokens", "vad"}


def test_manifest_sha_mismatch_and_traversal(tmp_path: Path) -> None:
    vdir = _manifest(tmp_path)
    (vdir / "e.onnx").write_bytes(b"ENCODER"[:7])
    with pytest.raises(EngineUnavailableError):
        load_manifest(tmp_path)
    other = tmp_path / "o"
    other.mkdir()
    _manifest(other, files=[{"path": "../x", "sha256": "0", "bytes": 1, "role": "encoder"}])
    with pytest.raises(EngineUnavailableError):
        load_manifest(other)
    with pytest.raises(EngineUnavailableError):
        load_manifest(tmp_path / "missing")


def test_mask_filter_keeps_access_log_args_structure() -> None:
    f = MaskFilter(secrets=[SECRET])
    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:1", "GET", f"/x?t={SECRET}", "1.1", 200), None
    )
    assert f.filter(record)
    client, method, path, version, status = record.args  # type: ignore[misc]
    assert SECRET not in path and status == 200
    assert SECRET not in record.getMessage()
