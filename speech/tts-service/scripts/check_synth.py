"""M4 kaiwa-tts 설치 확인 — 기본 모델로 1문장을 CPU·MPS 각각 두 번 합성해 시간을 잰다(SETUP-M4.md 5단계).

실행: cd ~/kaiwa-tts-run && .venv/bin/python speech/tts-service/scripts/check_synth.py
출력: `RESULT <device>: …` 줄, BERT dtype, 라이브러리 버전, /tmp/kaiwa-tts-check.wav(첫 성공 장치의 음성).
이 파일은 AGPL 경계(speech/tts-service) 안에 있고 style_bert_vits2 를 import 하는 확인 도구일 뿐이다.
"""
import glob
import os
import sys
import time
import wave
from importlib.metadata import version

import numpy as np
from style_bert_vits2.constants import Languages
from style_bert_vits2.nlp import bert_models
from style_bert_vits2.tts_model import TTSModel

ROOT = os.path.expanduser("~/kaiwa-tts-run")
MODEL_DIR = os.path.join(ROOT, "model_assets", os.environ.get("KAIWA_TTS_DEFAULT_MODEL", "jvnv-F1-jp"))
BERT = "ku-nlp/deberta-v2-large-japanese-char-wwm"
TEXT = "こんにちは。今日はいい天気ですね。"
OUT = "/tmp/kaiwa-tts-check.wav"

for pkg in ("style-bert-vits2", "torch", "transformers", "numpy"):
    print(f"VERSION {pkg} {version(pkg)}")

bert = bert_models.load_model(Languages.JP, BERT)
bert_models.load_tokenizer(Languages.JP, BERT)
print(f"BERT_DTYPE {next(bert.parameters()).dtype}")

weights = sorted(glob.glob(os.path.join(MODEL_DIR, "*.safetensors")))
if not weights:
    sys.exit(f"모델 파일이 없습니다: {MODEL_DIR}")

saved = None
for device in ("cpu", "mps"):
    try:
        m = TTSModel(model_path=weights[-1], config_path=os.path.join(MODEL_DIR, "config.json"),
                     style_vec_path=os.path.join(MODEL_DIR, "style_vectors.npy"), device=device)
        t = time.time(); m.infer(text=TEXT); first = time.time() - t
        t = time.time(); sr, audio = m.infer(text=TEXT); second = time.time() - t
        print(f"RESULT {device}: first {first:.2f}s, second {second:.2f}s, sr={sr}, samples={len(audio)}")
        if saved is None:
            saved = (sr, audio)
    except Exception as e:  # MPS 가 실패해도 CPU 결과는 남긴다
        print(f"RESULT {device}: FAILED {type(e).__name__}: {str(e)[:200]}")

if saved:
    sr, audio = saved
    with wave.open(OUT, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.asarray(audio, dtype=np.int16).tobytes())
    print(f"SAVED {OUT}")
