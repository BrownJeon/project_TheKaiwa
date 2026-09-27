#!/usr/bin/env python3
"""STT 실측(task-003e 완료 기준 3) — stt20 테스트 음성으로 CER·지연·RTF·메모리를 잰다.

두 가지를 잰다.
  offline : 엔진을 직접 로드해 파일 전체를 한 번에 디코드(VAD 없음) → 순수 디코드 지연·RTF·CER.
  ws      : 떠 있는 gateway 에 WS 로 붙어 실시간 속도(40ms 프레임)로 보낸다.
            manual(푸시투토크: 다 보내고 stop) → stop→final 지연
            auto(끝점) → 발화 끝(파일 에너지로 계산)→final 지연(끝점 무음 대기 포함)
            --concurrency N 이면 사용자 N명이 동시에 manual 을 돌린다(세션 3개 동시 피크 메모리).
티켓은 JWT_SECRET 으로 이 스크립트가 직접 서명한다(purpose=MIC_TEST — 저장·콜백 없음). 시크릿은 환경 변수 또는
--env-file(.env)에서 읽고 출력하지 않는다. 메모리는 gateway `/health`(X-Internal-Secret) 의 rssMb 를 0.5초마다 표본.

  PYTHONPATH=speech/common:speech/gateway ~/.node-local/thekaiwa-speech/venv/bin/python speech/gateway/scripts/measure_stt.py offline
  ... measure_stt.py ws --url ws://127.0.0.1:8199/ws/speech --health http://127.0.0.1:8199/health --concurrency 3
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import uuid
import wave
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SET = REPO / "speech" / "test-assets" / "stt20" / "sentences.json"
FRAME_SAMPLES = 640
_PUNCT = re.compile(r"[\s、。，．,.!?！？「」『』（）()・…〜~\"'‐\-]")


# ── 공용 ────────────────────────────────────────────────────────────────────


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


def secret(name: str, env_file: Path) -> str:
    value = os.environ.get(name) or read_env_file(env_file).get(name, "")
    if not value:
        raise SystemExit(f"{name} not configured")
    return value


def normalize(text: str) -> str:
    return _PUNCT.sub("", unicodedata.normalize("NFKC", text))


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def score(hyp: str, refs: list[str]) -> tuple[float, int, int]:
    """(CER, 편집거리, 정답 길이) — 표기 후보 중 최소."""
    best: tuple[float, int, int] | None = None
    h = normalize(hyp)
    for ref in refs:
        r = normalize(ref)
        d = edit_distance(r, h)
        cand = (d / max(1, len(r)), d, len(r))
        if best is None or cand[0] < best[0]:
            best = cand
    assert best is not None
    return best


def load_set() -> list[dict[str, Any]]:
    spec = json.loads(SET.read_text(encoding="utf-8"))
    items = []
    for s in spec["sentences"]:
        path = SET.parent / f"{s['id']}.wav"
        with wave.open(str(path), "rb") as w:
            assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2
            pcm = w.readframes(w.getnframes())
        items.append({"id": s["id"], "refs": [s["text"], *s.get("alternatives", [])], "pcm": pcm})
    return items


def speech_end_sec(pcm: bytes) -> float:
    import numpy as np

    x = np.abs(np.frombuffer(pcm, dtype="<i2").astype(np.int32))
    idx = np.nonzero(x > 500)[0]
    return float(idx[-1] + 1) / 16000 if len(idx) else 0.0


def p(values: list[float], q: float) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    k = min(len(s) - 1, max(0, round(q * (len(s) - 1))))
    return s[k]


def summarize(label: str, rows: list[dict[str, Any]], latency_key: str) -> dict[str, Any]:
    total_d = sum(r["dist"] for r in rows)
    total_n = sum(r["refLen"] for r in rows)
    lat = [r[latency_key] for r in rows if r.get(latency_key) is not None]
    dec = [r["decodeMs"] for r in rows if r.get("decodeMs") is not None]
    rtf = [r["decodeMs"] / r["audioMs"] for r in rows if r.get("audioMs")]
    out = {
        "label": label,
        "n": len(rows),
        "CER": round(total_d / max(1, total_n), 4),
        "correct(sim>=0.9)": sum(1 for r in rows if r["cer"] <= 0.1),
        f"{latency_key}_p50": round(p(lat, 0.5)),
        f"{latency_key}_p95": round(p(lat, 0.95)),
        "decodeMs_p50": round(p(dec, 0.5)),
        "RTF_p50": round(p(rtf, 0.5), 4),
    }
    print(json.dumps(out, ensure_ascii=False))
    return out


# ── offline ────────────────────────────────────────────────────────────────


async def run_offline(args: argparse.Namespace) -> list[dict[str, Any]]:
    from kaiwa_speech_common.config import load_settings
    from kaiwa_speech_common.engine.adapters.stt.reazon_sherpa import ReazonSherpaProvider
    from kaiwa_speech_common.engine.interfaces import AudioData

    settings = load_settings({**os.environ, "JWT_SECRET": "x" * 32, "SPEECH_INTERNAL_SECRET": "x" * 32, "DATA_ROOT": "/nonexistent"})
    rss0 = rss_self()
    provider = ReazonSherpaProvider(settings.stt, settings.env.models_dir, decode_workers=1)
    t0 = time.monotonic()
    provider.load()
    load_s = time.monotonic() - t0
    rows = []
    for item in load_set():
        audio_ms = len(item["pcm"]) // 32
        res = await provider.transcribe(AudioData(pcm=item["pcm"]))
        cer, dist, n = score(res.text, item["refs"])
        rows.append(
            {
                "id": item["id"],
                "text": res.text,
                "cer": cer,
                "dist": dist,
                "refLen": n,
                "decodeMs": res.timings_ms["decode"],
                "audioMs": audio_ms,
            }
        )
        if args.verbose:
            print(f"  {item['id']} cer={cer:.3f} decode={res.timings_ms['decode']}ms {res.text}")
    provider.shutdown()
    print(
        json.dumps(
            {"offline_load_s": round(load_s, 2), "rss_before_mb": rss0, "rss_after_mb": rss_self(), "threads": settings.stt.num_threads},
            ensure_ascii=False,
        )
    )
    summarize(f"offline threads={settings.stt.num_threads}", rows, "decodeMs")
    return rows


def rss_self() -> int:
    with open("/proc/self/status", encoding="ascii") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) // 1024
    return -1


# ── ws ─────────────────────────────────────────────────────────────────────


def make_ticket(jwt_secret: str, sub: str) -> str:
    import jwt

    now = int(time.time())
    return jwt.encode(
        {"sub": sub, "aud": "ws-speech", "jti": uuid.uuid4().hex, "iat": now, "exp": now + 60, "purpose": "MIC_TEST"},
        jwt_secret,
        algorithm="HS256",
    )


async def sample_rss(health_url: str, internal_secret: str, stop: asyncio.Event, peaks: list[int]) -> None:
    def fetch() -> int | None:
        req = urllib.request.Request(health_url, headers={"X-Internal-Secret": internal_secret})
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                return json.loads(resp.read()).get("rssMb")
        except OSError:
            return None

    while not stop.is_set():
        v = await asyncio.to_thread(fetch)
        if v is not None:
            peaks.append(int(v))
        try:
            await asyncio.wait_for(stop.wait(), 0.5)
        except asyncio.TimeoutError:
            pass


async def send_paced(ws: Any, pcm: bytes, t_origin: float) -> None:
    step = FRAME_SAMPLES * 2
    for k, off in enumerate(range(0, len(pcm) - step + 1, step)):
        due = t_origin + k * 0.04
        delay = due - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)
        await ws.send(pcm[off : off + step])


async def recv_until_final(ws: Any, timeout: float = 15.0) -> tuple[dict[str, Any], float | None, float]:
    first_partial: float | None = None
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout)
        msg = json.loads(raw)
        if msg["type"] == "partial" and first_partial is None:
            first_partial = time.monotonic()
        if msg["type"] == "error":
            raise RuntimeError(f"gateway error {msg}")
        if msg["type"] == "final":
            return msg, first_partial, time.monotonic()


async def collect_until_stop(ws: Any, finals: list[tuple[dict[str, Any], float]]) -> None:
    while True:
        msg, _fp, t = await recv_until_final(ws)
        finals.append((msg, t))
        if msg["reason"] == "stop":
            return


async def ws_session(url: str, jwt_secret: str, sub: str, mode: str, items: list[dict[str, Any]], verbose: bool) -> list[dict[str, Any]]:
    from websockets.asyncio.client import connect

    rows = []
    async with connect(url, max_size=2**20) as ws:
        await ws.send(
            json.dumps(
                {
                    "type": "start",
                    "v": 1,
                    "ticket": make_ticket(jwt_secret, sub),
                    "sampleRate": 16000,
                    "partial": True,
                    "clientPlatform": "measure",
                    "endpoint": mode,
                }
            )
        )
        ready = json.loads(await ws.recv())
        assert ready["type"] == "ready", ready
        for item in items:
            pcm = item["pcm"]
            audio_ms = len(pcm) // 32
            t_origin = time.monotonic() + 0.05
            if mode == "manual":
                await send_paced(ws, pcm, t_origin)
                t_stop = time.monotonic()
                await ws.send(json.dumps({"type": "stop"}))
                final, _fp, t_final = await recv_until_final(ws)
                latency = (t_final - t_stop) * 1000
                key = "stopToFinalMs"
            else:
                speech_end = t_origin + speech_end_sec(pcm)
                silence = bytes(FRAME_SAMPLES * 2 * 50)  # 끝점 대기 동안 무음을 2초 더 흘린 뒤 stop
                finals: list[tuple[dict[str, Any], float]] = []

                receiver = asyncio.create_task(collect_until_stop(ws, finals))
                await send_paced(ws, pcm + silence, t_origin)
                await ws.send(json.dumps({"type": "stop"}))
                await receiver
                spoken = [(m, t) for m, t in finals if m["text"]]
                final = {
                    "text": "".join(m["text"] for m, _t in spoken),
                    "timings": {
                        "decodeMs": sum(m["timings"]["decodeMs"] for m, _t in spoken),
                        "sttMs": max((m["timings"]["sttMs"] for m, _t in spoken), default=0),
                    },
                    "segments": [sg for m, _t in spoken for sg in m["segments"]],
                }
                latency = (spoken[-1][1] - speech_end) * 1000 if spoken else None
                key = "speechEndToFinalMs"
            cer, dist, n = score(final["text"], item["refs"])
            rows.append(
                {
                    "id": item["id"],
                    "text": final["text"],
                    "cer": cer,
                    "dist": dist,
                    "refLen": n,
                    key: latency,
                    "decodeMs": final["timings"]["decodeMs"],
                    "sttMs": final["timings"]["sttMs"],
                    "audioMs": audio_ms,
                    "segments": len(final["segments"]),
                }
            )
            if verbose:
                print(
                    f"  [{sub}/{mode}] {item['id']} cer={cer:.3f} {key}={latency or 0:.0f} decode={final['timings']['decodeMs']} "
                    f"segs={len(final['segments'])} {final['text']}"
                )
            await asyncio.sleep(0.3)
    return rows


async def run_ws(args: argparse.Namespace) -> None:
    env_file = Path(args.env_file)
    jwt_secret = secret("JWT_SECRET", env_file)
    internal = secret("SPEECH_INTERNAL_SECRET", env_file)
    items = load_set()
    peaks: list[int] = []
    stop = asyncio.Event()
    sampler = asyncio.create_task(sample_rss(args.health, internal, stop, peaks))
    try:
        if "manual" in args.modes:
            rows = await ws_session(args.url, jwt_secret, "measure-stt-1", "manual", items, args.verbose)
            summarize("ws manual (stop→final)", rows, "stopToFinalMs")
        if "auto" in args.modes:
            rows = await ws_session(args.url, jwt_secret, "measure-stt-1", "auto", items, args.verbose)
            summarize("ws auto (speech end→final, 끝점 대기 포함)", rows, "speechEndToFinalMs")
        idle_peak = max(peaks) if peaks else None
        if args.concurrency > 1:
            peaks.clear()
            results = await asyncio.gather(
                *[ws_session(args.url, jwt_secret, f"measure-stt-{i + 1}", "manual", items, False) for i in range(args.concurrency)]
            )
            summarize(f"ws manual x{args.concurrency} 동시", [r for rows in results for r in rows], "stopToFinalMs")
            print(json.dumps({"rss_peak_mb_concurrent": max(peaks) if peaks else None}))
        print(json.dumps({"rss_peak_mb_single": idle_peak}))
    finally:
        stop.set()
        await sampler


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    off = sub.add_parser("offline")
    off.add_argument("-v", "--verbose", action="store_true")
    ws = sub.add_parser("ws")
    ws.add_argument("--url", default="ws://127.0.0.1:8199/ws/speech")
    ws.add_argument("--health", default="http://127.0.0.1:8199/health")
    ws.add_argument("--env-file", default=str(REPO / ".env"))
    ws.add_argument("--modes", default="manual,auto")
    ws.add_argument("--concurrency", type=int, default=1)
    ws.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    if args.cmd == "offline":
        asyncio.run(run_offline(args))
    else:
        asyncio.run(run_ws(args))
    return 0


if __name__ == "__main__":
    sys.exit(main())
