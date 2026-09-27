"""kaiwa-tts — Style-Bert-VITS2 라이브러리 위의 자체 FastAPI 래퍼(맥 M4, AGPL-3.0 경계, LICENSE-NOTICE.md).

이 패키지는 `speech/common` 을 import 하지 않는다. 엔진 중립 요청 → SBV2 파라미터 변환은 `params` 에서만 한다.
"""

SERVICE_NAME = "tts-service"
VERSION = "0.3.0"
LICENSE = "AGPL-3.0 (see LICENSE-NOTICE.md)"
