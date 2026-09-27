#!/usr/bin/env python3
"""STT 실측용 테스트 음성(stt20) 생성 — M4 tts-service `/synthesize` 를 직접 불러 16kHz mono PCM16 wav 로 만든다.

- 계약: `speech/tts-service/README.md` §2 (`X-Internal-Secret: $TTS_SERVICE_SECRET`, 44.1kHz wav 반환).
- 시크릿은 환경 변수 `TTS_SERVICE_SECRET` 또는 `--env-file`(기본 저장소 루트 `.env`)에서 읽고 **출력하지 않는다**.
- 리샘플은 ffmpeg(argv 배열, 셸 없음). 앞뒤 무음 0.3s(test-assets/README §2 규격).
- 이미 있는 wav 는 건너뛴다(`--force` 로 재생성) — M4 호출 수를 아끼기 위해.
- 합성음은 인식률을 과대평가한다(README §2). 사람 목소리 실측은 task-003f 실기기에서.

  ~/.node-local/thekaiwa-speech/venv/bin/python speech/test-assets/make_test_audio.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SAMPLE_RATE = 16000
PAD_SEC = 0.3
MAX_CALLS = 50


def read_env_file(path: Path) -> dict[str, str]:
    """`.env` 파서 — 따옴표 없는 값의 ` # 주석` 을 잘라낸다(이 저장소 .env 는 인라인 주석을 쓴다)."""
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


def synth(url: str, secret: str, text: str, model: str, trace_id: str) -> bytes:
    body = json.dumps({"text": text, "voice": {"model": model, "speaker": 0, "style": "Neutral"}, "traceId": trace_id}).encode()
    req = urllib.request.Request(  # noqa: S310 — 운영자가 준 LAN URL
        f"{url.rstrip('/')}/synthesize",
        data=body,
        method="POST",
        headers={"content-type": "application/json", "X-Internal-Secret": secret},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read()[:200].decode("utf-8", "replace")
        raise SystemExit(f"synthesize failed: HTTP {e.code} {detail}") from None


def to_16k_mono(wav_bytes: bytes, pad_sec: float) -> bytes:
    """ffmpeg 로 16kHz mono s16 raw PCM 으로 바꾸고 앞뒤 무음을 붙인다."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg not found")
    proc = subprocess.run(  # noqa: S603 — 고정 argv
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"],
        input=wav_bytes,
        capture_output=True,
        check=True,
    )
    pad = b"\x00\x00" * int(SAMPLE_RATE * pad_sec)
    return pad + proc.stdout + pad


def write_wav(path: Path, pcm: bytes, rate: int = SAMPLE_RATE) -> None:
    tmp = path.with_suffix(".wav.tmp")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    os.replace(tmp, path)


def read_pcm(path: Path) -> bytes:
    with wave.open(str(path), "rb") as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != SAMPLE_RATE:
            raise SystemExit(f"{path.name}: not 16kHz mono PCM16")
        return w.readframes(w.getnframes())


def resample_raw(pcm: bytes, rate: int) -> bytes:
    ffmpeg = shutil.which("ffmpeg")
    assert ffmpeg
    proc = subprocess.run(  # noqa: S603
        [ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0", "-ar", str(rate), "-f", "s16le", "pipe:1"],
        input=pcm,
        capture_output=True,
        check=True,
    )
    return proc.stdout


def build_fake_mic(out_dir: Path, ids: list[str]) -> None:
    """Playwright `--use-file-for-fake-audio-capture` 용 — 문장 3개를 2초 간격으로 이은 파일(16k·48k)."""
    silence = b"\x00\x00" * SAMPLE_RATE
    parts = [silence]
    for sid in ids:
        parts.append(read_pcm(out_dir / f"{sid}.wav"))
        parts.append(silence * 2)
    pcm = b"".join(parts)
    write_wav(out_dir / "fake-mic-16k.wav", pcm)
    write_wav(out_dir / "fake-mic-48k.wav", resample_raw(pcm, 48000), rate=48000)
    print(f"fake mic → {out_dir / 'fake-mic-16k.wav'} · fake-mic-48k.wav ({len(pcm) / 2 / SAMPLE_RATE:.1f}s, 문장 {', '.join(ids)})")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--set", default=str(HERE / "stt20" / "sentences.json"))
    ap.add_argument("--env-file", default=str(REPO / ".env"))
    ap.add_argument("--url", default=None, help="tts-service base URL(기본 env TTS_SERVICE_URL)")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    spec = json.loads(Path(args.set).read_text(encoding="utf-8"))
    out_dir = Path(args.set).resolve().parent
    env = read_env_file(Path(args.env_file))
    secret = (os.environ.get("TTS_SERVICE_SECRET") or env.get("TTS_SERVICE_SECRET") or "").strip()
    url = args.url or os.environ.get("TTS_SERVICE_URL") or env.get("TTS_SERVICE_URL") or ""
    if not secret or not url:
        raise SystemExit("TTS_SERVICE_SECRET / TTS_SERVICE_URL not configured")

    voices: list[str] = spec["voices"]
    calls = 0
    for i, item in enumerate(spec["sentences"]):
        target = out_dir / f"{item['id']}.wav"
        if target.exists() and not args.force:
            print(f"  skip {target.name}")
            continue
        if calls >= MAX_CALLS:
            raise SystemExit(f"call budget {MAX_CALLS} reached")
        model = voices[i % len(voices)]
        t0 = time.monotonic()
        wav_bytes = synth(url, secret, item["text"], model, f"t_stt20_{item['id']}")
        calls += 1
        pcm = to_16k_mono(wav_bytes, PAD_SEC)
        write_wav(target, pcm)
        print(f"  {target.name} {model} {len(pcm) / 2 / SAMPLE_RATE:.2f}s ({time.monotonic() - t0:.2f}s)")
    build_fake_mic(out_dir, ["01", "09", "13"])
    print(f"M4 calls this run: {calls}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
