"""배포 직후 스모크 — 공개 /health 가 warmedUp, /health/detail(시크릿) 200, /synthesize 1문장이 WAV 인지. 실패면 exit 1.

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

    secret = load_secret(args.env_file)
    code, health = get_json(f"{base}/health")
    print("HEALTH", code, json.dumps(health, ensure_ascii=False))
    if code != 200 or not health.get("warmedUp"):
        return 1
    dcode, detail = get_json(f"{base}/health/detail", secret=secret)
    summary = {k: detail.get(k) for k in ("device", "deviceFallback", "modelsLoaded", "coldStartMs", "memoryMb", "gpuMb", "version")}
    print("DETAIL", dcode, json.dumps(summary, ensure_ascii=False))
    if dcode != 200:
        return 1
    body = {"text": "こんにちは。今日はいい天気ですね。", "traceId": "smoke"}
    if args.model:
        body["voice"] = {"model": args.model}
    status, headers, payload, secs = post_json(f"{base}/synthesize", body, secret)
    lower = {k.lower(): v for k, v in headers.items()}
    ok = status == 200 and payload[:4] == b"RIFF" and len(payload) > 1000
    print(
        "SYNTH",
        status,
        f"bytes={len(payload)} client_ms={int(secs * 1000)} server_ms={lower.get('x-kaiwa-latency-ms')} model={lower.get('x-kaiwa-model')}"
        # timing 은 부가 정보라 성공 판정에 넣지 않는다(헤더가 없는 구 버전도 통과). 배포 확인용 표시만.
        f" timing={lower.get('x-kaiwa-timing', '-')} timing_bytes={len(lower.get('x-tts-timing', ''))}",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
