"""환경 변수 → Settings. dotenv 는 읽지 않는다 — restart.sh 가 `.env` 의 KAIWA_TTS_* 만 export 한다."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_WARMUP_TEXT = "こんにちは。今日はいい天気ですね。"
DEFAULT_BERT = "ku-nlp/deberta-v2-large-japanese-char-wwm"
DEVICES = ("mps", "cpu")
LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")

MAX_BODY_BYTES = 8 * 1024
MAX_TEXT_CHARS = 100
MAX_G2P_CHARS = 200
MIN_SECRET_LEN = 16


def _int(env: Mapping[str, str], key: str, default: int, lo: int, hi: int) -> int:
    raw = env.get(key, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as e:
        raise ValueError(f"{key} must be an integer") from e
    return max(lo, min(hi, value))


@dataclass(frozen=True)
class Settings:
    model_assets: Path
    log_dir: Path
    default_model: str = "jvnv-F1-jp"
    device: str = "mps"
    # repr=False: Settings 가 로그·예외 메시지에 찍혀도 값이 새지 않게 한다.
    internal_secret: str = field(default="", repr=False)
    queue_timeout_ms: int = 8000
    warmup_text: str = DEFAULT_WARMUP_TEXT
    bert_model: str = DEFAULT_BERT
    log_level: str = "INFO"
    stuck_sec: int = 90

    @property
    def auth_configured(self) -> bool:
        return len(self.internal_secret) >= MIN_SECRET_LEN

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        home = Path.home()
        device = env.get("KAIWA_TTS_DEVICE", "mps").strip().lower() or "mps"
        if device not in DEVICES:
            raise ValueError(f"KAIWA_TTS_DEVICE must be one of {DEVICES}")
        log_level = env.get("KAIWA_TTS_LOG_LEVEL", "INFO").strip().upper() or "INFO"
        if log_level not in LOG_LEVELS:
            raise ValueError(f"KAIWA_TTS_LOG_LEVEL must be one of {LOG_LEVELS}")
        return cls(
            model_assets=Path(os.path.expanduser(env.get("KAIWA_TTS_MODEL_ASSETS", "") or str(home / "kaiwa-tts-run" / "model_assets"))),
            log_dir=Path(os.path.expanduser(env.get("KAIWA_TTS_LOG_DIR", "") or str(home / "kaiwa-tts-local-logs"))),
            default_model=env.get("KAIWA_TTS_DEFAULT_MODEL", "").strip() or "jvnv-F1-jp",
            device=device,
            internal_secret=env.get("KAIWA_TTS_INTERNAL_SECRET", "").strip(),
            queue_timeout_ms=_int(env, "KAIWA_TTS_QUEUE_TIMEOUT_MS", 8000, 500, 60000),
            warmup_text=(env.get("KAIWA_TTS_WARMUP_TEXT", "").strip() or DEFAULT_WARMUP_TEXT)[:MAX_TEXT_CHARS],
            bert_model=env.get("KAIWA_TTS_BERT_MODEL", "").strip() or DEFAULT_BERT,
            log_level=log_level,
            stuck_sec=_int(env, "KAIWA_TTS_STUCK_SEC", 90, 15, 600),
        )
