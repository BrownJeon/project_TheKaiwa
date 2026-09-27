"""서비스 설정 — 8층 해석 중 서비스가 지금 읽는 1·3·4층(DEFAULT → APPLICATION_CONFIG → ENVIRONMENT).

- 3층 = `SPEECH_CONFIG_PATH`(기본 저장소 `speech/speech.config.yml`). `version` 이 1 이 아니면 부팅 거부.
- 4층 = 아래 `ENV_OVERRIDES` 의 환경 변수만(값 검증 후).
- 5·6·8층(ConfigurationVersion·EngineConnection·RuntimeOverride)은 앱 #141a 가 생기는 Phase 2 에 붙인다 —
  그때까지 `/health` 의 `configVersion` 은 `file:<sha1 8자>`(yml 내용 지문)다.
- 시크릿은 `secrets.resolve_secret("env:…")` 로만 읽고, 값은 `ServiceEnv` 밖으로(로그·응답) 나가지 않는다.
dotenv 는 읽지 않는다 — pm2(ecosystem.config.js)가 `.env` 에서 필요한 키만 주입한다.
"""

from __future__ import annotations

import hashlib
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field, fields, replace
from pathlib import Path
from typing import Any

import yaml

from .secrets import SecretError, resolve_secret

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG_PATH = REPO_ROOT / "speech" / "speech.config.yml"
DEFAULT_MODELS_DIR = REPO_ROOT / "speech" / "models"
SUPPORTED_CONFIG_VERSION = 1
MIN_SECRET_LEN = 16
APP_ENVS = ("LOCAL", "PRODUCTION", "STAGING", "DEVELOPMENT")


@dataclass(frozen=True)
class SttRuntime:
    """`speech.stt.realtime.*` — 실시간 STT 엔진 런타임."""

    engine: str = "reazon-sherpa"
    model: str = "zipformer-ja-reazonspeech-2024-08-01-int8"
    endpoint_silence_ms: int = 500
    vad_threshold: float = 0.5
    min_speech_ms: int = 250
    max_segment_sec: int = 30
    sample_rate: int = 16000
    num_threads: int = 2
    decoding_method: str = "greedy_search"
    partial: bool = True


@dataclass(frozen=True)
class GatewayConfig:
    """`speech.gateway.*` + 코드 상수(yml 에 없는 DoS 상한)."""

    ticket_ttl_sec: int = 60
    max_sessions: int = 8
    frame_ms: int = 40
    max_utterance_sec: int = 60
    session_idle_timeout_sec: int = 120
    internal_callback_timeout_ms: int = 5000
    # 아래는 yml 키가 없는 코드 상수(SOURCE_CODE 층) — api-contract §2-29 규칙을 옮긴 값.
    connection_key: str = "reazon-gateway"
    session_max_sec: int = 600
    start_timeout_sec: float = 3.0
    max_pending_connections: int = 32
    frames_per_sec: float = 50.0
    frame_burst: int = 150
    text_per_sec: float = 20.0
    text_burst: int = 40
    max_text_bytes: int = 4096
    max_bad_frames: int = 50
    max_forced_finals: int = 3
    decode_workers: int = 2
    max_realtime_text_chars: int = 1000
    max_callback_segments: int = 50

    @property
    def frame_bytes(self) -> int:
        return 16000 * self.frame_ms // 1000 * 2


@dataclass(frozen=True, repr=False)
class ServiceEnv:
    """프로세스 환경(4층의 인프라 키). 시크릿 필드는 repr 에 나오지 않는다."""

    app_env: str
    data_root: Path | None
    jwt_secret: str
    internal_secret: str
    app_internal_url: str
    models_dir: Path
    allowed_origins: tuple[str, ...]
    log_level: str

    def __repr__(self) -> str:
        return (
            f"ServiceEnv(app_env={self.app_env!r}, data_root_set={self.data_root is not None}, "
            f"jwt_secret_set={bool(self.jwt_secret)}, internal_secret_set={bool(self.internal_secret)}, "
            f"models_dir={self.models_dir.name!r}, allowed_origins={len(self.allowed_origins)}, log_level={self.log_level!r})"
        )


@dataclass(frozen=True)
class Settings:
    env: ServiceEnv
    stt: SttRuntime
    gateway: GatewayConfig
    sources: Mapping[str, str] = field(default_factory=dict)  # "stt.num_threads" → DEFAULT|APPLICATION_CONFIG|ENVIRONMENT
    config_version: str = "default"
    issues: tuple[str, ...] = ()  # MISCONFIGURED 사유(키 이름만)

    @property
    def misconfigured(self) -> bool:
        return bool(self.issues)


class ConfigError(Exception):
    """부팅 거부 수준의 설정 오류(알 수 없는 yml version 등)."""


def _int_in(lo: int, hi: int) -> Callable[[Any], int]:
    def conv(v: Any) -> int:
        if isinstance(v, bool):
            raise ValueError("bool")
        n = int(v)
        if not lo <= n <= hi:
            raise ValueError("range")
        return n

    return conv


def _float_in(lo: float, hi: float) -> Callable[[Any], float]:
    def conv(v: Any) -> float:
        if isinstance(v, bool):
            raise ValueError("bool")
        x = float(v)
        if not lo <= x <= hi:
            raise ValueError("range")
        return x

    return conv


def _bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off"):
        return False
    raise ValueError("bool")


def _choice(*allowed: str) -> Callable[[Any], str]:
    def conv(v: Any) -> str:
        s = str(v)
        if s not in allowed:
            raise ValueError("choice")
        return s

    return conv


def _ident(v: Any) -> str:
    s = str(v)
    if not s or len(s) > 80 or not all(c.isalnum() or c in "-_." for c in s):
        raise ValueError("ident")
    return s


# yml 키 → (dataclass 필드, 변환기). sample_rate 는 모델 고정값이라 16000 외 거부.
_STT_KEYS: dict[str, Callable[[Any], Any]] = {
    "engine": _ident,
    "model": _ident,
    "endpoint_silence_ms": _int_in(100, 3000),
    "vad_threshold": _float_in(0.05, 0.95),
    "min_speech_ms": _int_in(50, 2000),
    "max_segment_sec": _int_in(5, 30),
    "sample_rate": _int_in(16000, 16000),
    "num_threads": _int_in(1, 8),
    "decoding_method": _choice("greedy_search", "modified_beam_search"),
    "partial": _bool,
}
_GATEWAY_KEYS: dict[str, Callable[[Any], Any]] = {
    "ticket_ttl_sec": _int_in(10, 120),
    "max_sessions": _int_in(1, 64),
    "frame_ms": _int_in(40, 40),
    "max_utterance_sec": _int_in(5, 60),
    "session_idle_timeout_sec": _int_in(10, 600),
    "internal_callback_timeout_ms": _int_in(500, 15000),
}
# 4층: 환경 변수 → (섹션, 키)
ENV_OVERRIDES: dict[str, tuple[str, str]] = {
    "SPEECH_STT_NUM_THREADS": ("stt", "num_threads"),
    "SPEECH_STT_ENDPOINT_SILENCE_MS": ("stt", "endpoint_silence_ms"),
    "SPEECH_STT_DECODING_METHOD": ("stt", "decoding_method"),
    "SPEECH_GATEWAY_MAX_SESSIONS": ("gateway", "max_sessions"),
}


def _apply(
    section: str,
    obj: Any,
    values: Mapping[str, Any],
    convs: Mapping[str, Callable[[Any], Any]],
    source: str,
    sources: dict[str, str],
    issues: list[str],
) -> Any:
    known = {f.name for f in fields(obj)}
    changes: dict[str, Any] = {}
    for key, raw in values.items():
        conv = convs.get(key)
        if conv is None or key not in known:
            continue  # yml 의 다른 키(host·port·ticket_audience 등)는 이 서비스가 쓰지 않거나 코드 상수다
        try:
            changes[key] = conv(raw)
            sources[f"{section}.{key}"] = source
        except (TypeError, ValueError):
            issues.append(f"{section}.{key}:invalid({source})")
    return replace(obj, **changes) if changes else obj


def _read_yaml(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    doc = yaml.safe_load(raw) or {}
    if not isinstance(doc, dict):
        raise ConfigError("speech config root must be a mapping")
    if doc.get("version") != SUPPORTED_CONFIG_VERSION:
        raise ConfigError(f"unsupported speech config version {doc.get('version')!r}")
    return doc, "file:" + hashlib.sha1(raw, usedforsecurity=False).hexdigest()[:8]


def _secret(name: str, environ: Mapping[str, str], issues: list[str]) -> str:
    try:
        value = resolve_secret(f"env:{name}", environ)
    except SecretError:
        issues.append(f"{name}:missing")
        return ""
    if len(value) < MIN_SECRET_LEN:
        issues.append(f"{name}:too_short")
        return ""
    return value


def load_settings(environ: Mapping[str, str] | None = None, config_path: Path | None = None) -> Settings:
    env = dict(os.environ if environ is None else environ)
    sources: dict[str, str] = {}
    issues: list[str] = []
    stt = SttRuntime()
    gateway = GatewayConfig()
    for f in fields(stt):
        sources[f"stt.{f.name}"] = "DEFAULT"
    for f in fields(gateway):
        sources[f"gateway.{f.name}"] = "DEFAULT" if f.name in _GATEWAY_KEYS else "SOURCE_CODE"

    path = config_path or Path(env.get("SPEECH_CONFIG_PATH") or DEFAULT_CONFIG_PATH)
    if not path.is_absolute():
        path = (REPO_ROOT / path).resolve()
    config_version = "default"
    if path.is_file():
        doc, config_version = _read_yaml(path)
        speech = doc.get("speech") or {}
        realtime = ((speech.get("stt") or {}).get("realtime")) or {}
        stt = _apply("stt", stt, realtime, _STT_KEYS, "APPLICATION_CONFIG", sources, issues)
        gateway = _apply("gateway", gateway, speech.get("gateway") or {}, _GATEWAY_KEYS, "APPLICATION_CONFIG", sources, issues)
    else:
        issues.append("SPEECH_CONFIG_PATH:not_found")

    for var, (section, key) in ENV_OVERRIDES.items():
        if env.get(var, "").strip():
            if section == "stt":
                stt = _apply("stt", stt, {key: env[var].strip()}, _STT_KEYS, "ENVIRONMENT", sources, issues)
            else:
                gateway = _apply("gateway", gateway, {key: env[var].strip()}, _GATEWAY_KEYS, "ENVIRONMENT", sources, issues)

    app_env = (env.get("APP_ENV") or "LOCAL").strip().upper()
    if app_env not in APP_ENVS:
        issues.append("APP_ENV:invalid")
        app_env = "LOCAL"
    data_root_raw = (env.get("DATA_ROOT") or "").strip()
    data_root = Path(data_root_raw).resolve() if data_root_raw and Path(data_root_raw).is_absolute() else None
    if data_root is None:
        issues.append("DATA_ROOT:missing")
    models_dir = Path(env.get("SPEECH_MODELS_DIR") or DEFAULT_MODELS_DIR).resolve()
    origins = tuple(o.strip().rstrip("/") for o in (env.get("SPEECH_GATEWAY_ALLOWED_ORIGINS") or "").split(",") if o.strip())
    log_level = (env.get("SPEECH_LOG_LEVEL") or "INFO").strip().upper()

    service_env = ServiceEnv(
        app_env=app_env,
        data_root=data_root,
        jwt_secret=_secret("JWT_SECRET", env, issues),
        internal_secret=_secret("SPEECH_INTERNAL_SECRET", env, issues),
        app_internal_url=(env.get("APP_INTERNAL_URL") or "http://127.0.0.1:3010").strip().rstrip("/"),
        models_dir=models_dir,
        allowed_origins=origins,
        log_level=log_level if log_level in ("DEBUG", "INFO", "WARNING", "ERROR") else "INFO",
    )
    return Settings(env=service_env, stt=stt, gateway=gateway, sources=sources, config_version=config_version, issues=tuple(issues))
