"""배포 직후 스모크 — /health 가 warmedUp 이고 /synthesize 1문장이 WAV 를 돌려주는지. 실패면 exit 1.

실행(M4): .venv/bin/python speech/tts-service/scripts/smoke.py --url http://127.0.0.1:8200 --env-file ~/kaiwa-tts-run/.env
"""

from __future__ import annotations

import argparse
import json
import sys

from _client import get_json, load_secret, post_json


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8200")
    ap.add_argument("--env-file", default=None)
    ap.add_argument("--model", default=None)
    args = ap.parse_args()
    base = args.url.rstrip("/")

    code, health = get_json(f"{base}/health")
    summary = {k: health.get(k) for k in ("status", "device", "modelsLoaded", "warmedUp", "coldStartMs", "memoryMb", "version")}
    print("HEALTH", code, json.dumps(summary, ensure_ascii=False))
    if code != 200 or not health.get("warmedUp"):
        return 1
    body = {"text": "こんにちは。今日はいい天気ですね。", "traceId": "smoke"}
    if args.model:
        body["voice"] = {"model": args.model}
    status, headers, payload, secs = post_json(f"{base}/synthesize", body, load_secret(args.env_file))
    lower = {k.lower(): v for k, v in headers.items()}
    ok = status == 200 and payload[:4] == b"RIFF" and len(payload) > 1000
    print(
        "SYNTH",
        status,
        f"bytes={len(payload)} client_ms={int(secs * 1000)} server_ms={lower.get('x-kaiwa-latency-ms')} model={lower.get('x-kaiwa-model')}",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
