"""로깅 — 모든 줄이 `MaskFilter` 를 지난다(README §5).

남기는 것: traceId·userId·sessionId·단계별 ms·오디오 길이·텍스트 **길이와 sha1 앞 8자**(`text_fingerprint`).
남기지 않는 것: 발화·전사 전문, 오디오 바이트, 티켓 JWT, 내부 시크릿, DATABASE_URL.
필터는 마지막 방어선이다 — 호출부가 애초에 전문을 넘기지 않는 것이 원칙이고, 필터는 JWT 모양·등록된 시크릿 값을 지운다.
"""

from __future__ import annotations

import hashlib
import logging
import re
import sys
from collections.abc import Iterable

_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}")
_HEADER = re.compile(r"(?i)(x-internal-secret['\"]?\s*[:=]\s*['\"]?)[^\s'\",}]+")
_DB_URL = re.compile(r"(?i)\b(mysql|mariadb|postgres(?:ql)?)://[^\s'\"]+")
LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")


def text_fingerprint(text: str) -> str:
    """로그용 텍스트 지문 — `chars=N sha1=xxxxxxxx`."""
    digest = hashlib.sha1(text.encode("utf-8"), usedforsecurity=False).hexdigest()[:8]
    return f"chars={len(text)} sha1={digest}"


class MaskFilter(logging.Filter):
    def __init__(self, secrets: Iterable[str] = ()) -> None:
        super().__init__()
        self._secrets = tuple(s for s in secrets if s and len(s) >= 8)

    def add_secret(self, value: str) -> None:
        if value and len(value) >= 8 and value not in self._secrets:
            self._secrets = (*self._secrets, value)

    def mask(self, text: str) -> str:
        for s in self._secrets:
            if s in text:
                text = text.replace(s, "[secret]")
        text = _JWT.sub("[jwt]", text)
        text = _HEADER.sub(r"\1[secret]", text)
        return _DB_URL.sub(r"\1://[masked]", text)

    def _mask_arg(self, value: object) -> object:
        return self.mask(value) if isinstance(value, str) else value

    def filter(self, record: logging.LogRecord) -> bool:
        # msg·args 를 각각 마스킹하고 구조는 그대로 둔다 — uvicorn AccessFormatter 는 args 튜플을 풀어 쓴다.
        try:
            if isinstance(record.msg, str):
                record.msg = self.mask(record.msg)
            if isinstance(record.args, tuple):
                record.args = tuple(self._mask_arg(a) for a in record.args)
            elif isinstance(record.args, dict):
                record.args = {k: self._mask_arg(v) for k, v in record.args.items()}
            if record.exc_info and record.exc_info[1] is not None:
                # 스택 트레이스는 로컬 변수·인자 문자열(전사문 등)을 담을 수 있어 예외 타입만 남긴다.
                record.msg = f"{record.msg} | exc={type(record.exc_info[1]).__name__}"
                record.exc_info = None
                record.exc_text = None
            record.stack_info = None
        except Exception:  # noqa: BLE001 — 마스킹 실패는 줄을 버린다(누락이 유출보다 낫다)
            return False
        return True


_FILTER = MaskFilter()


def mask_filter() -> MaskFilter:
    return _FILTER


def setup_logging(level: str = "INFO", secrets: Iterable[str] = ()) -> MaskFilter:
    """루트·uvicorn 로거의 모든 핸들러에 같은 MaskFilter 를 건다."""
    for s in secrets:
        _FILTER.add_secret(s)
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(handler)
    root.setLevel(level if level in LEVELS else "INFO")
    for name in ("", "uvicorn", "uvicorn.error", "uvicorn.access"):
        for h in logging.getLogger(name).handlers:
            if _FILTER not in h.filters:
                h.addFilter(_FILTER)
    return _FILTER


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
