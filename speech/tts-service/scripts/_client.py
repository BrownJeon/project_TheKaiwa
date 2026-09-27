"""smoke·bench 공용 — 시크릿은 환경 변수 또는 .env 에서 읽고 절대 출력하지 않는다. 표준 라이브러리만 쓴다."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

SECRET_KEYS = ("KAIWA_TTS_INTERNAL_SECRET", "TTS_SERVICE_SECRET")


def load_secret(env_file: str | None) -> str:
    for key in SECRET_KEYS:
        if os.environ.get(key):
            return os.environ[key].strip()
    if env_file and Path(env_file).is_file():
        for line in Path(env_file).read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() in SECRET_KEYS and value.strip():
                return value.strip().strip("'\"")
    raise SystemExit(f"secret not found (env {' / '.join(SECRET_KEYS)} or --env-file)")


def post_json(url: str, body: dict[str, Any], secret: str, timeout: float = 30.0) -> tuple[int, dict[str, str], bytes, float]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(  # noqa: S310 — 운영자가 넘긴 내부 URL
        url, data=data, method="POST", headers={"content-type": "application/json", "X-Internal-Secret": secret}
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            payload = resp.read()
            return resp.status, dict(resp.headers.items()), payload, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers.items()), e.read(), time.perf_counter() - t0


def get_json(url: str, timeout: float = 5.0, secret: str | None = None) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(url, headers={"X-Internal-Secret": secret} if secret else {})  # noqa: S310
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
