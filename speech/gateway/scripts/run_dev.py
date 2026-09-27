#!/usr/bin/env python3
"""gateway 를 pm2 없이 직접 띄운다(개발·QA·실측용). 운영 기동은 pm2 `thekaiwa-speech-gateway`(ecosystem.config.js).

- 저장소 `.env` 에서 gateway 가 쓰는 키만 골라 환경으로 넘긴다(값은 출력하지 않는다). 현재 셸 환경 값이 있으면 그것이 이긴다
  — 예: `DATA_ROOT=/tmp/x APP_INTERNAL_URL=http://127.0.0.1:3011 … run_dev.py --port 8199`.
- 코드는 NFS 에서 읽고(파이썬 소스 읽기는 noexec 와 무관) 인터프리터·네이티브 라이브러리는 로컬 venv 의 것을 쓴다.
- uvicorn 옵션은 ecosystem.config.js 와 같다(`--ws-max-size 65536` 등 — 한 프레임 1,280바이트, 텍스트 ≤4KB).

  ~/.node-local/thekaiwa-speech/venv/bin/python speech/gateway/scripts/run_dev.py --port 8199
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

GATEWAY = Path(__file__).resolve().parents[1]
REPO = GATEWAY.parents[1]
VENV = Path.home() / ".node-local" / "thekaiwa-speech" / "venv"
KEYS = (
    "APP_ENV",
    "DATA_ROOT",
    "JWT_SECRET",
    "SPEECH_INTERNAL_SECRET",
    "SPEECH_CONFIG_PATH",
    "APP_INTERNAL_URL",
    "SPEECH_MODELS_DIR",
    "SPEECH_LOG_LEVEL",
    "SPEECH_GATEWAY_ALLOWED_ORIGINS",
    "SPEECH_STT_NUM_THREADS",
    "SECRETS_DIR",
)
UVICORN_ARGS = ["--ws-max-size", "65536", "--ws-ping-interval", "15", "--ws-ping-timeout", "30", "--ws-per-message-deflate", "false",
                "--no-server-header", "--timeout-graceful-shutdown", "5"]


def read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$", line)
        if not m:
            continue
        raw = m.group(2).strip()
        if raw[:1] in ("'", '"'):
            end = raw.find(raw[0], 1)
            value = raw[1:end] if end > 0 else raw[1:]
        else:
            value = re.split(r"\s+#", raw, maxsplit=1)[0].strip()
        out[m.group(1)] = value
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8199)
    ap.add_argument("--env-file", default=str(REPO / ".env"))
    args = ap.parse_args()
    if not 1024 < args.port < 65536:
        raise SystemExit("port out of range")

    dotenv = read_env_file(Path(args.env_file))
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "LANG", "LC_ALL", "TZ")}
    for key in KEYS:
        value = os.environ.get(key) or dotenv.get(key)
        if value:
            env[key] = value
    env["PYTHONPATH"] = f"{GATEWAY}:{REPO / 'speech' / 'common'}"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONUNBUFFERED"] = "1"
    print(f"gateway dev: 127.0.0.1:{args.port} keys={','.join(k for k in KEYS if k in env)}", flush=True)
    os.chdir(GATEWAY)
    uvicorn = str(VENV / "bin" / "uvicorn")
    os.execve(uvicorn, [uvicorn, "app:app", "--host", "127.0.0.1", "--port", str(args.port), *UVICORN_ARGS], env)  # noqa: S606


if __name__ == "__main__":
    sys.exit(main())
