# speech/tts-service — Style-Bert-VITS2 래퍼 (맥 M4, 골격)

> 상태: 설계 골격. 구현 task-003(d). **이 디렉토리는 AGPL-3.0 경계 안**이다 — [`LICENSE-NOTICE.md`](LICENSE-NOTICE.md) 필독. 앱·gateway·worker 는 HTTP 로만 부르고, 이 서비스는 `speech/common` 을 import 하지 않는다. 계약 정본: [`docs/design/api-contract.md`](../../docs/design/api-contract.md) "M4 tts-service 내부 API", Voice 상세: [`docs/design/speech-platform/01~04`](../../docs/design/speech-platform/).

## 1. 배치·실행 (home-m4-api 와 같은 운영 방식)

> **설치 준비(사용자 실행용)**: [`SETUP-M4.md`](SETUP-M4.md) — 로컬 clone·Python 3.11 venv·SBV2·기본 모델·1문장 합성 측정·`.env`(2026-09-27).

| 항목 | 값 |
|---|---|
| 호스트 | 맥 M4(24GB, MPS). 우분투 → M4 LAN 호출만 가능(역방향 불가) |
| 실행 디렉토리 | `~/kaiwa-tts-run` — **NFS 밖 로컬 디스크의 독립 git clone**(macOS 백그라운드 프로세스는 NFS 에 EPERM, home-m4-api README §6) |
| venv | `~/kaiwa-tts-run/.venv` — `pip install style-bert-vits2 fastapi uvicorn[standard] pydantic` (+ 모델별 요구) |
| 프로세스 | `.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8200`, cwd `~/kaiwa-tts-run/speech/tts-service`. launchd·pm2 아님 |
| 워치독 | crontab `* * * * * ~/kaiwa-tts-run/speech/tts-service/scripts/kaiwa-tts-watchdog.sh >> ~/kaiwa-tts-local-logs/watchdog.log 2>&1` — 매분 `GET /health` 실패 시 재기동, 배포 스크립트와 `.deploy.lock`(mkdir 락) 으로 조율 |
| 배포 | `git push` → webhook-deploy(사용자 승인 게이트, 실패 시 롤백) — deployer 의 음성 서비스 표. 배포 뒤 `POST /admin/models/refresh` + Functional Test 1회 |
| 로그 | `~/kaiwa-tts-local-logs/`(리포 밖). 전사·합성 문장 전문은 DEBUG(DebugSession) 에서만 |
| 바인드 | `0.0.0.0:8200` 이지만 방화벽으로 우분투 IP 만 허용. 외부 노출 없음. 인증은 `X-Internal-Secret` 헤더(우분투 앱과 공유, SecretResolver) |
| 메모리 | JP-Extra 모델 1개 상주 ≈1~2GB(실측 필요). Ollama 콜드로드와 겹칠 수 있어 기동 시 워밍업 합성 1회 + 프로세스 우선순위(nice) 검토 |

## 2. 래퍼 엔드포인트 (SBV2 `server_fastapi.py` 원 API 를 감싼다 — 앱·모바일은 원 API 를 직접 호출하지 않음, 추가 기획안 §35)

| 메서드·경로 | 요청 | 응답 | 비고 |
|---|---|---|---|
| `POST /synthesize` | `{text(≤100자), voice:{voiceModelRef, speaker, style, styleWeight, speed, pitch, intonation, language:'JP'}, traceId}` | `audio/wav`(44.1kHz mono) + 헤더 `X-Kaiwa-Latency-Ms`, `X-Kaiwa-Model` | 엔진 중립 파라미터 → SBV2(`model_id`·`speaker_id`·`style`·`style_weight`·`length=1/speed`·`pitch_scale`·`intonation_scale`·`sdp_ratio`·`noise` 기본) 변환은 **여기서만**. 100자 초과는 400(분할은 호출자 책임) |
| `GET /voices` | — | `[{modelName, version, speakers:[{id,name}], styles:[…], status, sha256}]` | SBV2 `/models/info` 정규화. `VoiceModel` 동기화 입력 |
| `POST /admin/voices/import` | multipart `package.zip` | `202 {importId}` → `GET /admin/voices/import/{importId}` 로 `{stage, ok, log[]}` | 검증 단계는 §4 |
| `POST /admin/voices/{model}/disable` | — | `{modelName, status:'DISABLED'}` | 목록에서 숨김, 파일 유지 |
| `POST /admin/voices/{model}/delete` | `{confirm: modelName}` | `{modelName, status:'DELETED'}` | DISABLED 상태에서만. 파일은 `model_assets/_trash/<model>-<ts>/` 로 이동(물리 삭제는 수동) |
| `POST /admin/models/refresh` | — | `{loaded:[…], errors:[…]}` | `model_assets` 재스캔 → SBV2 모델 홀더 리로드 |
| `GET /health` | — | `{ok, version, modelsLoaded:n, defaultModel, memoryMb, device:'mps'|'cpu', uptimeSec, warmedUp}` | 워치독·앱 Health 가 본다. 값에 시크릿·경로 없음 |
| `POST /admin/log-level` | `{level}` | `{level}` | RUNTIME_EDITABLE |
| `POST /admin/config/apply` | `{patch}` | `{applied:[…], rejected:[{key, reason}]}` | RUNTIME_EDITABLE 키만(예: `sdp_ratio` 기본·`warmup_text`). 나머지 422 |
| `GET /admin/config/effective` | — | 키별 `{value, source}` | 이 서비스는 yaml·DB 를 읽지 않으므로 소스는 DEFAULT/ENVIRONMENT/RUNTIME_OVERRIDE 만 |

## 3. 문장 분할·합성 규칙

- **입력 문장 ≤100자**(SBV2 기본 제한). 분할은 호출자(앱 `speech.tts.splitSentences`)가 `。！？!?` 와 읽기 쉬운 절 경계(、) 기준으로 하고, 이 서비스는 초과를 400 으로 거부한다.
- 합성은 `asyncio.Lock` 으로 직렬화(CPU/MPS 한 워커). 큐 대기 상한 `queue_timeout_ms`(기본 8000) 초과 시 503 + `Retry-After`.
- 캐시는 **이 서비스에 없다**(캐시는 우분투 앱 `DATA_ROOT/tts-cache/`). 같은 문장 재요청도 합성한다 — 앱 캐시가 막는다.
- 워밍업: 기동 후 기본 모델로 고정 문장 1회 합성(`warmup_text`) → `/health.warmedUp=true` 가 되기 전엔 Health 를 DEGRADED 로 보고.

## 4. `model_assets` 레이아웃과 Voice Package

```
~/kaiwa-tts-run/model_assets/               # git 미추적(.gitignore), 백업은 사용자 수동
├── jvnv-F1-jp/                             # 기본 모델(SBV2 배포 모델, 약관 확인 후 사용)
│   ├── config.json
│   ├── jvnv-F1-jp_e160_s14000.safetensors
│   └── style_vectors.npy
├── teacher_mio/                            # Voice Package 로 들어온 모델(예)
│   ├── config.json · model.safetensors · style_vectors.npy
│   ├── manifest.json                       # 패키지의 manifest 사본
│   └── preview/preview.wav
└── _trash/                                 # delete 시 이동
```

Voice Package zip 규격(추가 기획안 §33):

```
teacher_mio.zip
├── manifest.json
├── model/
│   ├── config.json
│   ├── model.safetensors
│   └── style_vectors.npy
└── preview/
    └── preview.wav            # 선택. 없으면 import 시 고정 문장으로 생성
```
`manifest.json`: `{ "voiceId": "teacher_mio", "name": "Mio", "description": "…", "engine": "STYLE_BERT", "modelName": "teacher_mio", "speaker": "Mio", "defaultStyle": "Neutral", "version": "1.0.0", "license": "…", "sha256": { "model/model.safetensors": "…" } }`.

Import 단계(§34, `GET /admin/voices/import/{id}.stage`): `UPLOADED → PACKAGE_VALID(zip 구조·크기 ≤2GB·경로 탈출 검사) → MANIFEST_VALID(필수 키·engine=STYLE_BERT·modelName 규칙 `^[a-z0-9_-]{2,40}$`·중복) → MODEL_VALID(config.json 파싱·safetensors 헤더·sha256 대조) → PLACED(model_assets/<modelName>/ 원자적 이동) → REFRESHED(/admin/models/refresh) → TTS_TESTED(고정 문장 합성 성공·길이 >0) → REGISTERED`. 어느 단계든 실패 시 파일을 `_trash/` 로 옮기고 `ok=false, log[]` 에 단계·원인. 앱 쪽 `VoiceImportJob`·`VoiceProfile` 은 `REGISTERED` 뒤에만 만들어진다.

## 5. 환경 변수

`KAIWA_TTS_PORT=8200` · `KAIWA_TTS_MODEL_ASSETS=~/kaiwa-tts-run/model_assets` · `KAIWA_TTS_DEFAULT_MODEL=jvnv-F1-jp` · `KAIWA_TTS_DEVICE=mps|cpu` · `KAIWA_TTS_INTERNAL_SECRET`(우분투 `SPEECH_INTERNAL_SECRET` 과 같은 값, 파일 `~/kaiwa-tts-run/.env` 0600) · `KAIWA_TTS_LOG_DIR=~/kaiwa-tts-local-logs` · `KAIWA_TTS_QUEUE_TIMEOUT_MS=8000` · `KAIWA_TTS_WARMUP_TEXT`. dotenv 미사용 — 워치독·배포 스크립트가 `.env` 를 `export` 한다.

## 6. P0 실측 (task-003 ③)

- 기본 모델 1문장(20자) 합성 시간 — cpu/mps 각각, 워밍업 전/후. 목표 ≤1.0s. 초과 시 ① 워밍업 고정 ② ONNX 변형(kuchipaku 계열, AGPL 동일) ③ 앱 캐시 적중률로 흡수 ④ 문장 파이프라인(1문장 재생 중 2문장 합성).
- 콜드 스타트(프로세스 기동 → warmedUp) 시간 — 워치독 재기동 후 첫 요청 지연의 근거.
- Ollama(qwen2.5:14b) 추론과 동시 실행 시 합성 시간 변화.
- 메모리 RSS(모델 1개/2개).

## 7. 모델 약관

기본 모델(`jvnv-F1-jp` 등 SBV2 배포 모델)과 외부 학습 보이스는 각각 이용약관을 확인하고 `manifest.json.license` 에 기록한다. 개인 이용 범위를 넘는 배포·상업 이용은 이 프로젝트 범위 밖이며, `VoiceProfile.description` 에 약관 요지를 적어 관리자 화면에서 보이게 한다. 운영 데이터(사용자 발화)는 모델 학습에 쓰지 않는다(§71, `Utterance.trainingOptIn` 기본 false).
