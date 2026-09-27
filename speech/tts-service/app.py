"""uvicorn 진입점 — `uvicorn app:app --app-dir <speech/tts-service> --host 0.0.0.0 --port 8200` (scripts/restart.sh)."""

import os

# 모델·BERT 는 미리 받아 둔다(SETUP-M4 4단계). 기동 때 허브에 묻지 않게 해 네트워크 장애가 기동 실패로 번지지 않게 한다.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from kaiwa_tts.server import create_app  # noqa: E402

app = create_app()
