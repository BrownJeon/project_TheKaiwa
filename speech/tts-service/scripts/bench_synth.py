"""P0 실측 — 20자 안팎 문장 N 개 합성 지연(p50/p95)·서버 헤더 분해. 문장 원문은 출력하지 않는다.

실행: .venv/bin/python speech/tts-service/scripts/bench_synth.py --url http://127.0.0.1:8200 --env-file ~/kaiwa-tts-run/.env --n 20
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys

from _client import load_secret, post_json

SENTENCES = [
    "今日は駅前の喫茶店で友達に会います。",
    "明日の朝は早く起きて散歩をしましょう。",
    "この本はとても面白くて一晩で読みました。",
    "週末に家族と一緒に京都へ行く予定です。",
    "すみません、駅までの道を教えてください。",
    "昨日の夜は雨がたくさん降っていましたね。",
    "日本語の勉強を毎日少しずつ続けています。",
    "新しいレストランのランチはおいしかった。",
    "来月から新しい仕事を始めることになった。",
    "電車が遅れたので会議に少し遅刻しました。",
    "このケーキは母が作ってくれたものです。",
    "冬になると温かいお茶が飲みたくなります。",
    "図書館で静かに宿題をするのが好きです。",
    "今度の休みに海へ泳ぎに行きませんか。",
    "駅の近くに大きな本屋さんができました。",
    "先生の説明はいつも分かりやすいですね。",
    "毎朝コーヒーを飲みながらニュースを見る。",
    "友達の誕生日に花を買って持っていった。",
    "この道をまっすぐ行くと公園があります。",
    "もう一度ゆっくり言ってもらえますか。",
]


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[idx]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8200")
    ap.add_argument("--env-file", default=None)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--model", default=None)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--pitch", type=float, default=1.0)
    ap.add_argument("--intonation", type=float, default=1.0)
    ap.add_argument("--label", default="run")
    args = ap.parse_args()
    secret = load_secret(args.env_file)
    base = args.url.rstrip("/")

    client_ms: list[float] = []
    server_ms: list[float] = []
    synth_ms: list[float] = []
    audio_ms: list[float] = []
    chars: list[int] = []
    errors = 0
    for i in range(args.n):
        text = SENTENCES[i % len(SENTENCES)]
        body = {
            "text": text,
            "voice": {"model": args.model} if args.model else {},
            "controls": {"speed": args.speed, "pitch": args.pitch, "intonation": args.intonation},
            "traceId": f"bench{i}",
        }
        status, headers, payload, secs = post_json(f"{base}/synthesize", body, secret)
        if status != 200 or payload[:4] != b"RIFF":
            errors += 1
            continue
        h = {k.lower(): v for k, v in headers.items()}
        client_ms.append(secs * 1000)
        server_ms.append(float(h.get("x-kaiwa-latency-ms", 0)))
        synth_ms.append(float(h.get("x-kaiwa-synth-ms", 0)))
        audio_ms.append(float(h.get("x-kaiwa-audio-ms", 0)))
        chars.append(len(text))
    if not client_ms:
        print(json.dumps({"label": args.label, "errors": errors}))
        return 1
    result = {
        "label": args.label,
        "n": len(client_ms),
        "errors": errors,
        "avgChars": round(statistics.mean(chars), 1),
        "clientP50Ms": round(pct(client_ms, 0.5)),
        "clientP95Ms": round(pct(client_ms, 0.95)),
        "serverP50Ms": round(pct(server_ms, 0.5)),
        "serverP95Ms": round(pct(server_ms, 0.95)),
        "synthP50Ms": round(pct(synth_ms, 0.5)),
        "audioAvgMs": round(statistics.mean(audio_ms)),
        "rtfP50": round(pct([s / a for s, a in zip(synth_ms, audio_ms, strict=True) if a], 0.5), 3),
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
