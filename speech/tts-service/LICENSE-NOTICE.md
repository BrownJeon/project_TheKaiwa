# LICENSE-NOTICE — speech/tts-service 의 라이선스 경계

## 1. 이 디렉토리가 특별한 이유

`speech/tts-service/` 는 **Style-Bert-VITS2**(AGPL-3.0; `text/user_dict` 부분은 LGPL-3.0)를 프로세스 안에 링크(import)하는 **유일한** 코드다. 그래서 이 디렉토리 전체를 AGPL-3.0 경계 안에 두고, 그 밖의 코드(Next.js 앱, `speech/common`, `speech/gateway`, `speech/worker`, `plugins/sherpa-stt`)는 이 서비스를 **네트워크(HTTP) 로만** 호출한다.

```
┌───────────────── TheKaiwa 저장소 ─────────────────┐
│  src/**  speech/common  speech/gateway  speech/worker  plugins/**   ← 우리 라이선스(비공개 개인 프로젝트)
│        │ HTTP :8200 (엔진 중립 요청/응답)                              │
│        ▼                                                           │
│  speech/tts-service/  ← AGPL-3.0 경계. Style-Bert-VITS2 를 import   │
└────────────────────────────────────────────────────────────────────┘
```

## 2. 경계 유지 규칙 (reviewer 체크리스트 항목)

1. `speech/tts-service/**` 밖의 어떤 파일도 `style_bert_vits2` 패키지를 import 하지 않는다.
2. `speech/tts-service/**` 는 `speech/common`(`kaiwa_speech_common`) 을 **import 하지 않는다**. 필요한 공통 로직(마스킹·설정 읽기)은 이 디렉토리 안에 별도로 둔다. 이렇게 해야 AGPL 의 "결합 저작물" 범위가 이 디렉토리를 넘지 않는다.
3. 앱·모바일은 SBV2 원 API(`/voice`, `/models/info`, `/g2p` 등)를 직접 호출하지 않고 이 래퍼의 `/synthesize`·`/voices`·`/admin/*` 만 부른다(추가 기획안 §35). 요청/응답은 엔진 중립 형태이며 SBV2 파라미터 변환은 래퍼 안에서만 일어난다.
4. 이 디렉토리의 소스는 **언제든 공개 가능한 상태**로 유지한다: 시크릿·내부 호스트명·사용자 데이터를 코드에 넣지 않는다(`.env`·`model_assets` 는 git 미추적).
5. 모델 파일(`model_assets/`)은 저장소에 커밋하지 않는다. 각 모델의 약관은 `manifest.json.license` 에 기록한다.

## 3. 현재 의무 판단

- 이 프로젝트는 **개인용·비공개 운영**(사용자 1인, 외부 서비스 제공 없음)이다. AGPL-3.0 §13(네트워크 상호작용 시 소스 제공)은 "수정한 프로그램을 네트워크로 사용자에게 제공"할 때 발동하며, 자기 자신만 쓰는 현 상태에서는 소스 제공 의무가 실제로 발생하지 않는다.
- 그럼에도 경계를 지키는 이유: 나중에 타인에게 서비스를 열거나 코드를 배포할 때 **이 디렉토리만 AGPL 로 공개**하면 되게 하기 위함이다. 앱 쪽 코드가 AGPL 에 끌려 들어가지 않는다.
- 이 디렉토리 안에 Style-Bert-VITS2 를 수정한 코드가 생기면(예: 서버 패치) 그 변경분도 AGPL-3.0 이며 공개 대상이다. 가능한 한 **수정 없이 래핑**한다.

## 4. 라이선스 표

| 구성요소 | 라이선스 | 위치 | 취급 |
|---|---|---|---|
| Style-Bert-VITS2 | AGPL-3.0 (`text/user_dict` LGPL-3.0) | `speech/tts-service`(pip 의존) | 격리 서비스, HTTP 호출만 |
| SBV2 배포 모델(jvnv 등) | 모델별 약관 | `model_assets/` | 약관 확인 후 개인 이용, `manifest.json.license` 기록 |
| sherpa-onnx | Apache-2.0 | gateway venv·플러그인 AAR | 제한 없음 |
| ReazonSpeech k2 v2 모델 | Apache-2.0 | `/models/reazonspeech-int8/` | 제한 없음 |
| silero VAD | MIT | sherpa-onnx 내장 | 제한 없음 |
| faster-whisper | MIT | VoiceVault whisper-service / worker local 모드 | 제한 없음 |
| narabas | MIT | worker(Phase 3) | 제한 없음 |
| pyopenjtalk / OpenJTalk 사전 | BSD 계열 / 사전별 | worker(Phase 3) | 사전 약관 확인 |
| pyworld | MIT | worker(Phase 3) | 제한 없음 |

## 5. 문서·표시

- 이 파일은 `speech/tts-service/` 루트에 유지하고, 서비스 `GET /health` 응답에 `license: "AGPL-3.0 (see LICENSE-NOTICE.md)"` 필드를 둔다(`kaiwa_tts/__init__.py` `LICENSE`, task-003d 구현).
- Style-Bert-VITS2 원 저작권·라이선스 전문은 pip 패키지에 포함된 것을 따르며, 이 디렉토리에 `THIRD_PARTY_LICENSES/` 로 사본을 두는 것은 task-003 에서 결정한다.
