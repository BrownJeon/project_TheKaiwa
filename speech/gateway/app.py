"""uvicorn 진입점 — `uvicorn app:app --host 127.0.0.1 --port 8100 --ws-max-size 65536` (cwd = speech/gateway).

설정은 환경 변수만 읽는다(dotenv 없음). pm2 는 ecosystem.config.js 가 `.env` 에서 필요한 키만 주입한다.
"""

from kaiwa_gateway.server import create_app

app = create_app()
