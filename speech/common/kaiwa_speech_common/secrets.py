"""credentialRef 해석 — `env:NAME` / `file:<name>`(SECRETS_DIR 아래, 0600). 값은 로그·응답에 싣지 않는다."""

from __future__ import annotations

import os
import re
import stat
from collections.abc import Mapping
from pathlib import Path

DEFAULT_SECRETS_DIR = "/home/brownjeon/apps/thekaiwa/shared/secrets"
_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class SecretError(Exception):
    """해석 실패. 메시지에는 ref 이름만 담는다(값 금지)."""


def resolve_secret(ref: str, environ: Mapping[str, str] | None = None) -> str:
    env = os.environ if environ is None else environ
    kind, _, name = ref.partition(":")
    if not name or not _NAME.match(name):
        raise SecretError(f"invalid credential ref {kind}:…")
    if kind == "env":
        value = env.get(name, "").strip()
        if not value:
            raise SecretError(f"env:{name} is not set")
        return value
    if kind == "file":
        base = Path(env.get("SECRETS_DIR") or DEFAULT_SECRETS_DIR).resolve()
        path = (base / name).resolve()
        if path.parent != base:
            raise SecretError(f"file:{name} escapes SECRETS_DIR")
        try:
            st = path.stat()
        except FileNotFoundError:
            raise SecretError(f"file:{name} not found") from None
        if st.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
            raise SecretError(f"file:{name} must be 0600")
        value = path.read_text(encoding="utf-8").strip()
        if not value:
            raise SecretError(f"file:{name} is empty")
        return value
    raise SecretError(f"unsupported credential ref kind {kind!r}")
