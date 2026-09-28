"""worker 설정 — 8층 중 DEFAULT(코드) → APPLICATION_CONFIG(`speech.config.yml`) → ENVIRONMENT(env) 만 읽는다(gateway 와 같은 범위).

- yml: `speech.stt.validation.*`(분석 STT 엔진·주소·타임아웃) · `speech.fallback.ANALYSIS_STT.primary`(connection key — `Utterance.analysisEngine`
  스냅샷) · `speech.worker.{poll_interval_ms, batch_size, kinds}`.
- env: `APP_ENV` · `DATA_ROOT` · `SPEECH_INTERNAL_SECRET` · `APP_INTERNAL_URL` · `SPEECH_CONFIG_PATH` · 분석 서비스 주소(엔진별 변수 이름 —
  `engine/adapters.ANALYSIS_STT_ENDPOINT_ENV`, 4층) · `SPEECH_WORKER_ID` · `SPEECH_LOG_LEVEL`.
  **DATABASE_URL 은 읽지 않는다**(task-012b D-B1 — 워커는 DB 에 접속하지 않는다).
- 엔진명은 yml 값으로만 들어온다(이 파일에 문자열로 두지 않는다). 설정이 틀리면 `issues` 에 키 이름만 남기고 워커는 claim 하지 않는다.
"""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import socket
from collections.abc import Mapping
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

import yaml

from kaiwa_speech_common.config import APP_ENVS, DEFAULT_CONFIG_PATH, MIN_SECRET_LEN, REPO_ROOT, SUPPORTED_CONFIG_VERSION, AnalysisSttRuntime, ConfigError
from kaiwa_speech_common.engine.adapters import ANALYSIS_STT_ENDPOINT_ENV
from kaiwa_speech_common.secrets import SecretError, resolve_secret

SUPPORTED_KINDS = ("ANALYSIS_STT",)
_WORKER_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_KEY = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_URL = re.compile(r"^https?://[A-Za-z0-9.\-]+(:\d{1,5})?(/[A-Za-z0-9._~/-]*)?$")


@dataclass(frozen=True)
class LoopConfig:
    poll_interval_ms: int = 2000
    idle_backoff_max_ms: int = 10_000  # 앱 적재 게이트(120s) 안에 반드시 한 번 claim 하도록 — 코드 상수
    batch_size: int = 1
    kinds: tuple[str, ...] = SUPPORTED_KINDS
    callback_timeout_ms: int = 5000
    # claim 은 앱이 잡을 RUNNING 으로 커밋한 뒤 응답한다 — 응답을 기다리다 먼저 끊으면 잡이 고아가 된다
    # (2026-09-29 실측: 공유 NAS DB 커밋 지연으로 claim 5초 초과 1회). 앱 트랜잭션 상한(15초)+연결 대기(5초)보다 길게.
    claim_timeout_ms: int = 30_000
    reading_recheck_sec: int = 60


@dataclass(frozen=True, repr=False)
class WorkerSettings:
    app_env: str
    data_root: Path | None
    internal_secret: str
    app_internal_url: str
    worker_id: str  # 설정값(SPEECH_WORKER_ID 또는 기본값) — 사람이 읽는 이름
    log_level: str
    analysis: AnalysisSttRuntime
    connection_key: str
    loop: LoopConfig
    config_version: str
    issues: tuple[str, ...] = ()

    instance_nonce: str = ""

    @property
    def misconfigured(self) -> bool:
        return bool(self.issues)

    @property
    def instance_id(self) -> str:
        """claim·#140·#138 에 싣는 워커 **인스턴스** id = `<worker_id>-<부트 nonce>`(REV-033 M1).

        앱의 펜싱·응답 유실 복구(self-reclaim)는 이 값이 정확히 같을 때만 같은 워커로 본다 — 같은 SPEECH_WORKER_ID 로 두 프로세스가 떠도,
        재기동해도 서로의 잡을 되돌리지 않는다(재기동 전 잡은 앱의 15분 고아 회수가 처리). `SpeechJob.lockedBy` VARCHAR(80) 안(≤73자).
        """
        return f"{self.worker_id}-{self.instance_nonce}" if self.instance_nonce else self.worker_id

    def __repr__(self) -> str:
        return (
            f"WorkerSettings(app_env={self.app_env!r}, data_root_set={self.data_root is not None}, internal_secret_set={bool(self.internal_secret)}, "
            f"instance_id={self.instance_id!r}, connection_key={self.connection_key!r}, issues={self.issues!r})"
        )


def _int_in(v: Any, lo: int, hi: int) -> int:
    if isinstance(v, bool):
        raise ValueError("bool")
    n = int(v)
    if not lo <= n <= hi:
        raise ValueError("range")
    return n


def _read_doc(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    doc = yaml.safe_load(raw) or {}
    if not isinstance(doc, dict):
        raise ConfigError("speech config root must be a mapping")
    if doc.get("version") != SUPPORTED_CONFIG_VERSION:
        raise ConfigError(f"unsupported speech config version {doc.get('version')!r}")
    return doc, "file:" + hashlib.sha1(raw, usedforsecurity=False).hexdigest()[:8]


def _default_worker_id() -> str:
    host = re.sub(r"[^A-Za-z0-9._-]", "", socket.gethostname())[:24] or "host"
    return f"worker-{host}-{os.getpid()}"


def load_worker_settings(environ: Mapping[str, str] | None = None, config_path: Path | None = None) -> WorkerSettings:
    env = dict(os.environ if environ is None else environ)
    issues: list[str] = []
    analysis = AnalysisSttRuntime()
    connection_key = ""
    loop = LoopConfig()

    path = config_path or Path(env.get("SPEECH_CONFIG_PATH") or DEFAULT_CONFIG_PATH)
    if not path.is_absolute():
        path = (REPO_ROOT / path).resolve()
    config_version = "default"
    if path.is_file():
        doc, config_version = _read_doc(path)
        speech = doc.get("speech") or {}
        v = ((speech.get("stt") or {}).get("validation")) or {}
        changes: dict[str, Any] = {}
        for key in ("engine", "mode", "model", "language"):
            if isinstance(v.get(key), str) and _KEY.match(v[key]):
                changes[key] = v[key]
        if isinstance(v.get("endpoint"), str):
            changes["endpoint"] = v["endpoint"]
        try:
            if "timeout_ms" in v:
                changes["timeout_ms"] = _int_in(v["timeout_ms"], 5000, 180_000)
        except (TypeError, ValueError):
            issues.append("stt.validation.timeout_ms:invalid")
        analysis = replace(analysis, **changes)
        primary = (((speech.get("fallback") or {}).get("ANALYSIS_STT")) or {}).get("primary")
        connection_key = primary if isinstance(primary, str) and _KEY.match(primary) else ""
        w = speech.get("worker") or {}
        loop_changes: dict[str, Any] = {}
        try:
            if "poll_interval_ms" in w:
                loop_changes["poll_interval_ms"] = _int_in(w["poll_interval_ms"], 500, 10_000)
            if "batch_size" in w:
                loop_changes["batch_size"] = _int_in(w["batch_size"], 1, 2)
        except (TypeError, ValueError):
            issues.append("worker:invalid")
        kinds = w.get("kinds")
        if isinstance(kinds, list):
            picked = tuple(k for k in kinds if k in SUPPORTED_KINDS)
            if picked:
                loop_changes["kinds"] = picked
            else:
                issues.append("worker.kinds:unsupported")
        loop = replace(loop, **loop_changes)
    else:
        issues.append("SPEECH_CONFIG_PATH:not_found")

    endpoint_env = ANALYSIS_STT_ENDPOINT_ENV.get(analysis.engine)
    if endpoint_env and (env.get(endpoint_env) or "").strip():
        analysis = replace(analysis, endpoint=env[endpoint_env].strip())
    if not analysis.engine:
        issues.append("stt.validation.engine:missing")
    if not _URL.match(analysis.endpoint or ""):
        issues.append("stt.validation.endpoint:invalid")
    if not connection_key:
        issues.append("fallback.ANALYSIS_STT.primary:missing")

    app_env = (env.get("APP_ENV") or "LOCAL").strip().upper()
    if app_env not in APP_ENVS:
        issues.append("APP_ENV:invalid")
        app_env = "LOCAL"
    data_root_raw = (env.get("DATA_ROOT") or "").strip()
    data_root = Path(data_root_raw).resolve() if data_root_raw and Path(data_root_raw).is_absolute() else None
    if data_root is None:
        issues.append("DATA_ROOT:missing")
    try:
        secret = resolve_secret("env:SPEECH_INTERNAL_SECRET", env)
        if len(secret) < MIN_SECRET_LEN:
            issues.append("SPEECH_INTERNAL_SECRET:too_short")
            secret = ""
    except SecretError:
        issues.append("SPEECH_INTERNAL_SECRET:missing")
        secret = ""
    app_url = (env.get("APP_INTERNAL_URL") or "http://127.0.0.1:3010").strip().rstrip("/")
    if not _URL.match(app_url):
        issues.append("APP_INTERNAL_URL:invalid")
    worker_id = (env.get("SPEECH_WORKER_ID") or "").strip()
    if worker_id and not _WORKER_ID.match(worker_id):
        issues.append("SPEECH_WORKER_ID:invalid")
    log_level = (env.get("SPEECH_LOG_LEVEL") or "INFO").strip().upper()

    return WorkerSettings(
        app_env=app_env,
        data_root=data_root,
        internal_secret=secret,
        app_internal_url=app_url,
        worker_id=worker_id if worker_id and _WORKER_ID.match(worker_id) else _default_worker_id(),
        log_level=log_level if log_level in ("DEBUG", "INFO", "WARNING", "ERROR") else "INFO",
        analysis=analysis,
        connection_key=connection_key,
        loop=loop,
        config_version=config_version,
        issues=tuple(issues),
        instance_nonce=secrets.token_hex(4),
    )
