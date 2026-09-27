# speech/tts-service — Style-Bert-VITS2 래퍼 (맥 M4)

> 상태: **P0 구현(task-003d, 2026-09-27)** — `/synthesize`·`/voices`·`/health`·`/health/detail`·`/g2p`·`/admin/models/refresh`. **이 디렉토리는 AGPL-3.0 경계 안**이다 — [`LICENSE-NOTICE.md`](LICENSE-NOTICE.md) 필독. 앱은 HTTP 로만 부르고(`engine/adapters/tts` 만), 이 서비스는 `speech/common` 을 import 하지 않는다. SBV2 `server_fastapi.py` 프록시가 아니라 **`style_bert_vits2` 라이브러리 위의 자체 FastAPI** 다(speech-platform/16 §1.2). 이 문서 §2 가 앱 어댑터가 따르는 계약이다 — `docs/design/api-contract.md` #147~#152·§7-3 의 옛 필드명(`modelName/speakerId/length…`, 세그먼트 배열)은 이 표로 대체된다.

## 1. 배치·실행

> **설치 준비**: [`SETUP-M4.md`](SETUP-M4.md) — 로컬 clone·Python 3.11 venv·SBV2·모델 3종·`.env`·방화벽(pf).

| 항목 | 값 |
|---|---|
| 호스트 | 맥 M4(24GB, MPS). 우분투 → M4 LAN 호출만 가능(역방향 불가) |
| 실행 디렉토리 | `~/kaiwa-tts-run` — **NFS 밖 로컬 디스크의 독립 git clone**(macOS 백그라운드 프로세스는 NFS 에 EPERM) |
| venv | `~/kaiwa-tts-run/.venv` — Python 3.11.16, 버전은 [`requirements.txt`](requirements.txt) 핀 그대로(`scripts/check_pins.py` 로 대조) |
| 프로세스 | [`scripts/restart.sh`](scripts/restart.sh) 가 `python -m uvicorn app:app --app-dir ~/kaiwa-tts-run/speech/tts-service --host 0.0.0.0 --port 8200 --no-access-log --no-proxy-headers` 를 nohup 으로 띄운다. launchd·pm2 아님 |
| 워치독 | crontab 매분 [`scripts/kaiwa-tts-watchdog.sh`](scripts/kaiwa-tts-watchdog.sh) — `/health` 무응답 또는 503(STUCK) 이 5초 간격 2회면 `restart.sh`. 배포와 `~/kaiwa-tts-run/.deploy.lock`(mkdir 락) 으로 조율, 15분 넘은 락은 치움. `touch ~/kaiwa-tts-run/.watchdog-off` 로 일시 중지 |
| 배포 | 우분투에서 [`scripts/deploy-from-ubuntu.sh [ref]`](scripts/deploy-from-ubuntu.sh)(**사용자 승인 게이트**) — M4 는 Gitea 에서 pull 못 함(키체인). SSH push → M4 `git merge --ff-only` → 핀 대조 → restart → smoke, 실패 시 직전 SHA 로 롤백. 모델은 기동 때 전부 올라가므로 배포 뒤 refresh 불필요 |
| 로그 | `~/kaiwa-tts-local-logs/tts-service-<port>.log`(20MB 넘으면 `.1` 로 한 벌 보존) · `watchdog.log`. 요청 로그는 trace·모델·글자 수·`text_sha`(sha256 앞 12자)·지연만 — **합성 문장 원문은 어떤 로그 레벨에서도 남기지 않는다**(Codex C2, 발음 확인은 `/g2p`). SBV2 라이브러리 자체 로그(문장 전문·음소열을 INFO/DEBUG 로 찍음)는 항상 ERROR 로 낮춘다 |
| 바인드·노출 | `0.0.0.0:8200` + **macOS pf 로 8200 을 우분투 접속 IP 와 localhost 에만 허용(상시 기동 전 필수, SETUP-M4 §6-2)**. 인증은 `X-Internal-Secret`(TTS 전용 값 — 우분투 `TTS_SERVICE_SECRET` = M4 `KAIWA_TTS_INTERNAL_SECRET`, `SPEECH_INTERNAL_SECRET` 과 다름). `/admin/*` 는 loopback 만 |
| 메모리 | 모델 3종(F1·F2·M1) MPS 상주 footprint ≈3.3GB(RSS ≈1.2GB, 나머지 GPU). CPU 모드 ≈2.0~2.4GB. §6 |

## 2. 엔드포인트 (앱 어댑터 `engine/adapters/tts` 가 따르는 계약)

공통: 오류 본문은 `{"error": {"code", "message"}}`. `GET /health`(정확히 이 경로) 외 전부 `X-Internal-Secret` 필수(없음·불일치·서버 미설정 모두 **401**, 상수시간 비교). `/admin/*` 는 요청 원격 주소가 loopback(127.0.0.1/::1)이 아니면 시크릿과 무관하게 **404**. 요청 본문 ≤8KB(초과 **413**). 알 수 없는 필드·범위 밖 값·NaN 은 **400 `INVALID_REQUEST`**(입력값은 되돌려 주지 않음). `/docs`·`/openapi.json` 없음.

| 메서드·경로 | 요청 | 응답 | 비고 |
|---|---|---|---|
| `POST /synthesize` | 아래 표 | `200 audio/wav`(PCM16 mono, 모델 샘플레이트 44.1kHz) + 헤더 | 문장 1개 = 요청 1개. 캐시 없음(앱 `DATA_ROOT/tts-cache`) |
| `GET /voices` | — | `{defaultModel, models:[{modelName, version, checkpoint, status:'LOADED'\|'DISABLED'\|'ERROR', loaded, sampleRate, speakers:[{id,name}], styles:[…], defaultStyle, sha256, error}]}` | `model_assets` 스캔 정규화. 경로 없음. `VoiceModel` 동기화 입력 |
| `POST /g2p` | `{text(1~200자)}` | `{normalizedText, reading, accent, moras:[{mora, tone:0\|1}]}` | 엔진이 실제로 읽을 읽기·악센트(SBV2 `normalize_text` + `g2kata_tone`, pyopenjtalk). `accent` 는 상승 `↑`·하강 `↓` 표기(예 雨 `ア↓メ` / 飴 `ア↑メ`), 구두점에서 끊김. 앱 정규화·발음 사전 검증용 |
| `GET /health` | — | `{status, warmedUp}` **만** | **인증 없음** — 워치독·`restart.sh`·앱 liveness 용. 모델·장치·메모리·버전·인증 설정 여부는 싣지 않는다(fingerprinting 최소화, 2026-09-27 Codex C2). `status`: `LOADING`(기동 중) · `OK` · `DEGRADED`(워밍업 전·MPS→CPU 폴백·기본 모델 없음) · `FAILED`(모델 0) · `MISCONFIGURED`(시크릿 미설정) · `STUCK`(합성·refresh 가 90초, 기동이 360초 넘게 안 끝남 → **HTTP 503**, 워치독 재기동 신호). 나머지는 HTTP 200 |
| `GET /health/detail` | — | `{ok, status, service, version, license, modelsLoaded, models:[id], defaultModel, device, requestedDevice, deviceFallback, warmedUp, coldStartMs, uptimeSec, memoryMb, gpuMb, queue, authConfigured}` | **`X-Internal-Secret` 필수**(없음·불일치 401). 앱 Health·상태 표시등·관리자 콘솔이 부른다. 시크릿·경로 없음. `ok` = `status ∈ {OK, DEGRADED}`, 앱 ONLINE 판정은 `ok && warmedUp`. HTTP 코드는 `/health` 와 같다(STUCK 만 503). M4 로컬 스크립트는 `.env` 의 시크릿을 환경 변수로만 넘겨 부른다 |
| `POST /admin/models/refresh` | — | `{models, added, reloaded, removed, errors:[{modelName, code}]}` | **loopback 전용**. `model_assets` 재스캔 → 새/변경(파일 크기·mtime) 모델만 로드·워밍업, 사라진 모델 언로드. 변경 모델 로드 실패 시 기존 것을 유지 |

**`POST /synthesize` 요청**(모든 키는 이 이름 그대로, 알 수 없는 키는 400):

| 키 | 타입·범위 | 기본 | SBV2 변환(이 서비스 `kaiwa_tts/params.py` 에서만) |
|---|---|---|---|
| `text` | 1~100자(NFC·앞뒤 공백 제거 후), 줄바꿈·제어문자 금지 | 필수 | `text`. 100자 초과 `400 TEXT_TOO_LONG`, 빈 값 `TEXT_EMPTY`, 제어문자 `TEXT_INVALID`. 문장 분할은 호출자 책임 |
| `voice.model` | 모델 id(`/voices.modelName`) | `KAIWA_TTS_DEFAULT_MODEL` | 로드된 모델 선택. 없으면 `400 UNKNOWN_MODEL` |
| `voice.speaker` | 정수 0~1000 | 0 | `speaker_id`. 모델에 없으면 `400 UNKNOWN_SPEAKER` |
| `voice.style` | 문자열 ≤40 | `Neutral` | `style`. 모델에 없으면 `Neutral`(없으면 첫 스타일)로 대체하고 헤더로 알림 |
| `voice.styleWeight` | 0~5 | 1.0 | `style_weight` |
| `controls.speed` | 0.5~2.0 | 1.0 | `length = 1/speed`(소수 4자리) |
| `controls.pitch` | 0.5~1.5 | 1.0 | `pitch_scale`. \|x−1\|<0.005 는 1.0 으로 스냅 |
| `controls.intonation` | 0~2 | 1.0 | `intonation_scale`. 스냅 동일 |
| `controls.pauseBeforeMs` | 0~2000 | — | **받기만 하고 무시** — 간격은 클라 재생 큐가 넣는다(16 §4.1) |
| `engine.sdpRatio`·`noise`·`noiseW` | 0~1 · 0~2 · 0~2 | 0.2·0.6·0.8 | `sdp_ratio`·`noise`·`noise_w` |
| `profile` | `NATIVE\|LEARNING_NORMAL\|LEARNING_SLOW\|PRONUNCIATION\|SHADOWING` | — | 로그에만. 속도·스타일 정책은 앱이 이미 `controls`·`voice` 에 반영해 보낸다 |
| `traceId` | `[A-Za-z0-9_.:-]{1,64}` | — | 로그·`X-Trace-Id` 로 되돌림 |
| (고정) | — | — | `language=JP`, `line_split=False` |

**응답 헤더**: `X-Kaiwa-Latency-Ms`(서버 총) · `X-Kaiwa-Queue-Ms` · `X-Kaiwa-Synth-Ms` · `X-Kaiwa-Encode-Ms` · `X-Kaiwa-Audio-Ms`(음성 길이) · `X-Kaiwa-Sample-Rate` · `X-Kaiwa-Model`(모델 **id** 만) · `X-Kaiwa-Style`(실제 적용, URL 인코딩) · `X-Kaiwa-Style-Fallback: 0|1` · `X-Kaiwa-Adjust: none|applied|skipped`(pitch/intonation 후처리 적용 여부 — `skipped` 는 후처리 실패로 조절 없이 재합성) · `X-Service-Version` · `X-Trace-Id`(요청에 있을 때) · `Cache-Control: no-store`.

**그 밖의 상태 코드**: `503 NOT_READY`(기동 중 `Retry-After: 5`, 모델 0 `Retry-After: 30`) · `503 BUSY`(대기가 `KAIWA_TTS_QUEUE_TIMEOUT_MS` 초과, `Retry-After: 2`) · `500 SYNTH_FAILED`(원인은 로그에 예외 타입만).

**SBV2 2.5.0 `TTSModel.infer` 확인(2026-09-27 M4)**: `pitch_scale`·`intonation_scale` 인자가 **있다**(1.0 이 아니면 pyworld harvest 로 F0 를 고쳐 재합성 — 음질이 약간 떨어지고 문장당 +0.4s, §6). `given_phone`/`given_tone`(읽기·악센트 직접 지정)도 있어 사전 방식 B 후보. 미구현(후속): `/admin/voices/import`·`disable`·`delete`(Phase 4) · `/admin/log-level`·`/admin/config/*`(Phase 2) · `timing`·`lexiconHints`(P1~P2).

## 3. 합성 규칙

- **입력 문장 ≤100자**. 분할은 호출자(앱 sentence detector)가 한다.
- 모든 모델 작업(로드·워밍업·합성·g2p·refresh)은 **단일 워커 스레드**에서 직렬 실행하고, 대기 상한 `KAIWA_TTS_QUEUE_TIMEOUT_MS`(기본 8000) 를 넘으면 503. 이벤트 루프는 막히지 않아 합성 중에도 `/health`·`/health/detail` 이 응답한다.
- BERT·모델은 **float32 로 고정**(transformers 버전과 무관 — 5.x 의 fp16 로드 충돌 방지). MPS 는 매 합성 뒤 `torch.mps.empty_cache()` — 안 하면 문장 길이마다 캐시가 쌓여 footprint 가 요청당 ≈45MB 씩 늘어난다(§6).
- 기동: 포트를 먼저 열고(`status: LOADING`) 뒤에서 BERT → 모델 전부 로드 → 모델마다 워밍업 합성 1회 → `warmedUp: true`. MPS 사용 불가거나 워밍업이 MPS 에서 실패하면 **CPU 로 전부 다시 올리고** `deviceFallback: true`(DEGRADED).
- 가중치는 `*.safetensors` 만 로드한다(.pth/.pt 는 pickle — 임의 코드 실행 위험). `model_assets` 밖을 가리키는 심볼릭 링크, `.`·`_` 로 시작하는 디렉토리, `.disabled` 마커 모델은 로드하지 않는다.
- 캐시는 **이 서비스에 없다** — 같은 문장도 다시 합성한다(앱 캐시가 막는다).
- 기동 시 `HF_HUB_OFFLINE=1`·`TRANSFORMERS_OFFLINE=1` 을 기본으로 둔다(BERT 는 SETUP-M4 4단계에서 미리 받음) — 허브 장애가 기동 실패로 번지지 않게.

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

`~/kaiwa-tts-run/.env`(0600, **`KAIWA_TTS_*` 만** — 앱 `.env` 를 복사하지 않는다). dotenv 미사용: `restart.sh` 가 `KAIWA_TTS_[A-Z0-9_]+=값` 줄만 문자열로 export 한다(`source` 하지 않음).

| 키 | 기본 | 비고 |
|---|---|---|
| `KAIWA_TTS_INTERNAL_SECRET` | (필수) | 16자 미만·미설정이면 보호 라우트 전부 401, health `MISCONFIGURED`. 우분투 `TTS_SERVICE_SECRET` 과 같은 값 |
| `KAIWA_TTS_PORT` | 8200 | |
| `KAIWA_TTS_MODEL_ASSETS` | `~/kaiwa-tts-run/model_assets` | |
| `KAIWA_TTS_DEFAULT_MODEL` | `jvnv-F1-jp` | 요청에 `voice.model` 이 없을 때 |
| `KAIWA_TTS_DEVICE` | `mps` | `mps`\|`cpu` |
| `KAIWA_TTS_LOG_DIR` | `~/kaiwa-tts-local-logs` | |
| `KAIWA_TTS_QUEUE_TIMEOUT_MS` | 8000 | 500~60000 |
| `KAIWA_TTS_WARMUP_TEXT` | `こんにちは。今日はいい天気ですね。` | 선택 |
| `KAIWA_TTS_HOST` | `0.0.0.0` | 선택(로컬 실측 때 `127.0.0.1`) |
| `KAIWA_TTS_LOG_LEVEL` | `INFO` | 선택. `DEBUG` 여도 문장 원문은 기록하지 않는다 |
| `KAIWA_TTS_STUCK_SEC` | 90 | 선택. 합성·refresh 1건이 이보다 오래 걸리면 health `STUCK`(503) |
| `KAIWA_TTS_BERT_MODEL` | `ku-nlp/deberta-v2-large-japanese-char-wwm` | 선택 |

## 6. P0 실측 (2026-09-27, M4, 모델 3종 상주) — 상세 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md`

| 항목 | MPS | CPU |
|---|---|---|
| 콜드 스타트(프로세스 기동 → `warmedUp`) | 6~7s(holder 4.7s: BERT·모델 3종 로드 2.3s + 워밍업 1.1s) | 6s(holder 4.0s) |
| 20자 문장(평균 19.3자·음성 2.9s) 서버 p50 / p95 | **0.24s / 0.31s** | 0.41s / 0.47s |
| `intonation`·`pitch` ≠ 1.0(pyworld 후처리) p50 / p95 | 0.66s / 0.71~0.80s | 0.81s / 0.93s |
| `speed` 0.8 · 0.6 (음성 3.7s · 4.7s) p50 | 0.30s · 0.32s | 0.47s · — |
| 우분투 → M4 LAN 왕복 추가분 | ≈7ms | — |
| 동시 5건 | 직렬 처리, 대기 0.32→1.03s 선형(합성 각 0.23s) | — |
| 메모리(footprint) | ≈3.3GB 고정(`empty_cache` 적용 후. 미적용 시 요청당 ≈45MB 증가) | 1.9→2.4GB |

- MPS 는 **처음 보는 문장 길이(음소 수)** 에서 셰이더 컴파일로 1회 +0.5~1.1s 가 든다. 컴파일 결과는 디스크 캐시라 **프로세스 재기동 뒤에도 유지**된다(재기동 직후 같은 길이 0.25s) — 쓰일수록 줄어드는 일회성 비용.
- Ollama(qwen2.5:14b) 동시 부하 실측은 이번에 **하지 않았다**: 앱에 home-m4-api 자격 증명이 없고(`AI_API_KEY_REF` 비어 있음) Ollama 직접 호출은 이 task 권한 밖. 사용자 승인 후 명령은 measurements 문서.

## 7. 모델 약관

기본 모델(`jvnv-F1-jp` 등 SBV2 배포 모델)과 외부 학습 보이스는 각각 이용약관을 확인하고 `manifest.json.license` 에 기록한다. 개인 이용 범위를 넘는 배포·상업 이용은 이 프로젝트 범위 밖이며, `VoiceProfile.description` 에 약관 요지를 적어 관리자 화면에서 보이게 한다. 운영 데이터(사용자 발화)는 모델 학습에 쓰지 않는다(§71, `Utterance.trainingOptIn` 기본 false).

## 8. 운영 스크립트 (`scripts/`)

| 파일 | 실행 위치 | 역할 |
|---|---|---|
| `restart.sh [--port N] [--host H] [--device cpu\|mps] [--wait S] [--stop]` | M4 | `.env` 의 `KAIWA_TTS_*` export → 이 디렉토리에서 띄운 uvicorn 만 골라 TERM(20초 폴링 후 KILL) → 포트를 다른 프로세스가 잡고 있으면 중단(home-m4-api·Ollama 보호) → nohup 기동 → 공개 `/health` 가 `warmedUp` 이 될 때까지 대기(기본 240s) → 로컬 시크릿(환경 변수)으로 `/health/detail` 요약(장치·모델 수·콜드 스타트) 출력. macOS bash 3.2 호환 |
| `kaiwa-tts-watchdog.sh` | M4 crontab 매분 | §1 워치독 |
| `deploy-from-ubuntu.sh [ref]` | 우분투 | §1 배포(롤백 포함). `KAIWA_TTS_M4`·`KAIWA_TTS_REMOTE_DIR` 로 대상 변경 |
| `check_pins.py [requirements.txt]` | M4 | 설치본 = 핀 대조, 불일치 exit 1 |
| `smoke.py --url --env-file` | M4/우분투 | 공개 `/health` warmedUp + `/health/detail`(시크릿) 200 + 1문장 WAV 확인 |
| `bench_synth.py --url --env-file --n [--model --speed --pitch --intonation]` | M4/우분투 | p50/p95·RTF(문장 원문은 출력 안 함) |
| `check_synth.py` | M4 | SETUP-M4 5단계 설치 확인(라이브러리 직접) |

시크릿은 `--env-file` 이나 환경 변수(`KAIWA_TTS_INTERNAL_SECRET`/`TTS_SERVICE_SECRET`)로만 받고 출력하지 않는다.

**테스트**: `cd speech/tts-service && <venv>/bin/python -m pytest` — 모델·torch 없이 도는 계약 테스트(가짜 백엔드, `requirements-dev.txt`). lint `ruff check . && ruff format --check .`, 타입 `mypy app.py kaiwa_tts`(설정은 `pyproject.toml`).
