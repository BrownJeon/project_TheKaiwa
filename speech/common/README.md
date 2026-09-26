# speech/common — gateway·worker 공용 패키지 `kaiwa_speech_common` (골격)

> 상태: 설계 골격. TS `src/modules/engine` 층의 개념을 Python 으로 미러링한다(대응표: [`docs/design/module-dependency.md`](../../docs/design/module-dependency.md) §5-1). tts-service 는 **이 패키지를 import 하지 않는다**(AGPL 경계).

## 1. 역할

| 서브모듈 | 책임 | TS 대응 |
|---|---|---|
| `engine/descriptor.py` | `EngineDescriptor`(engineId·displayName·type·connectionTypes·capabilities·schemaVersion) + 등록된 provider 목록 `list_providers()` | `engine/registry/descriptors` |
| `engine/schema.py` | `ConfigurationSchema`(키별 type·default·min·max·enum·description·impact·editability·restartRequired) + `validate(schema, values) -> list[ValidationIssue]` | `engine/registry/schemas` |
| `engine/interfaces.py` | Protocol 정의(`SpeechToTextEngine`·`RealtimeSttSession`·`TextToSpeechEngine`·`EngineProvider`)와 dataclass(`AudioData`·`TranscriptionResult`·`SpeechRequest`·`EngineContext`·`HealthCheckResult`) — 골격은 [`../gateway/interfaces.py`](../gateway/interfaces.py), 구현 시 여기로 이동 | `EngineProvider` 타입 |
| `engine/adapters/stt/reazon_sherpa.py` | `ReazonSherpaEngine` — sherpa-onnx `OfflineRecognizer`(zipformer transducer int8) + silero `Vad`, 세그먼트 단위 디코드, `RealtimeSttSession` 구현 | (엔진 자체; TS 는 `reazonGateway` 클라) |
| `engine/adapters/stt/whisper.py` | `WhisperEngine` — `mode=http`(VoiceVault `POST /transcribe-chunk`) / `mode=local`(faster-whisper 직접) | `whisperHttp` |
| `engine/adapters/tts/style_bert_vits.py` | `StyleBertVitsEngine` — tts-service HTTP(`/synthesize`·`/voices`·`/admin/*`) | `styleBertHttp` |
| `router.py` | `SpeechEngineRouter.resolve(role, ctx) -> EngineContext`, `with_fallback(role, fn)` — `EngineFallbackPolicy` 순회·상태 제외·1회 재시도·실제 사용 connectionId 기록 | `engine/router` |
| `config.py` | `resolve_effective(scope, target_id) -> dict[key, {value, source, sourceRef}]` — 8층 중 서비스가 읽는 1~6·8층(USER_SETTING 은 요청 payload) | `engine/configuration/resolver` |
| `secrets.py` | `resolve_secret(ref)`: `env:NAME` / `file:<name>` → `/home/brownjeon/apps/thekaiwa/shared/secrets/<name>`(0600 검사) | `infra/secrets` |
| `health.py` | `run_health(provider, ctx) -> HealthCheckResult`, `run_functional_test(provider, ctx, asset_path)` | `engine/health`, `engine/functionalTest` |
| `db.py` | SQLAlchemy 엔진(`DATABASE_URL`), `claim_next_speech_job()`(`FOR UPDATE SKIP LOCKED`), `complete_job`, `fail_job`, `read_connections(environment)`, `read_fallback_policies`, `read_active_versions`, `read_live_overrides` | `infra/db`, `infra/jobs` |
| `audio.py` | 16kHz mono PCM16 wav 읽기/쓰기, 프레임 → numpy float32 변환, 길이 계산 | — |
| `logging.py` | `get_logger(name)`, `mask(record)` — 티켓·시크릿·전사 전문 마스킹, `set_level(level)` | `infra/logging` |
| `internal_client.py` | `post_utterance(payload)`, `post_analysis(payload)` — `APP_INTERNAL_URL` + `X-Internal-Secret` | (앱 `/api/internal/*` 라우트) |
| `trace.py` | `TraceStep` dataclass, `Tracer` — 단계 기록을 콜백 payload 에 동봉(`RequestTrace` 테이블은 앱이 쓴다) | `engine/trace` |

## 2. 패키지 형태·설치

```
speech/common/
├── pyproject.toml                # name = "kaiwa-speech-common", 패키지 kaiwa_speech_common
├── kaiwa_speech_common/
│   ├── engine/{descriptor.py, schema.py, interfaces.py, adapters/{stt/{reazon_sherpa.py, whisper.py}, tts/{style_bert_vits.py}}}
│   ├── router.py · config.py · secrets.py · health.py · db.py · audio.py · logging.py · internal_client.py · trace.py
│   └── schemas/                  # ConfigurationSchema JSON (docs/design/speech-platform/07 에서 옮겨 적음)
└── tests/
```

- 설치: `~/.node-local/thekaiwa-speech/venv/bin/pip install -e speech/common` (editable — 릴리스 디렉토리가 바뀌어도 `-e` 링크는 릴리스 경로를 가리키므로 **배포마다 재실행**한다; deploy.yml 의 post-step).
- gateway·worker 는 `from kaiwa_speech_common.router import SpeechEngineRouter` 처럼 패키지로 import 한다. 상대 경로 `sys.path` 조작 금지.
- 의존성: `sherpa-onnx`, `numpy`, `sqlalchemy`, `pymysql`, `pyyaml`, `httpx`, `pydantic`. `faster-whisper` 는 `whisper.mode=local` 일 때만 extras(`pip install -e 'speech/common[local-whisper]'`).

## 3. Provider 계약 (TS 와 동일 4메서드)

```
EngineProvider
  descriptor()            -> EngineDescriptor
  configuration_schema()  -> ConfigurationSchema
  health_check(ctx)       -> HealthCheckResult      # 가볍게: 프로세스·모델 로드·엔드포인트 응답
  functional_test(ctx)    -> FunctionalTestResult   # 실제 추론 1회: STT=test-assets/ja-sample.wav, TTS=고정 문장
```
- Health 와 Functional Test 는 분리한다(추가 기획안 §59). Health 는 5분 주기(`router.health_interval_sec`), 기능 테스트는 콘솔 수동·배포 후.
- 어댑터 파일 밖에서는 엔진명을 문자열로 쓰지 않는다. `router.resolve('REALTIME_STT')` 가 돌려주는 `EngineContext.provider` 를 통해서만 호출한다.

## 4. 설정 해석 (config.py)

`resolve_effective('ENGINE_CONNECTION', connection_id)` 의 합성 순서와 소스 라벨은 앱과 같다:

| 순위 | 소스 | Python 에서 읽는 곳 |
|---|---|---|
| 1 | DEFAULT | `schemas/*.json` 의 `default` |
| 2 | SOURCE_CODE | 어댑터 상수 |
| 3 | APPLICATION_CONFIG | `SPEECH_CONFIG_PATH`(`speech/speech.config.yml`) |
| 4 | ENVIRONMENT | `os.environ`(`SPEECH_*`, `TTS_SERVICE_URL`, `WHISPER_SERVICE_URL` …) |
| 5 | DATABASE | `ConfigurationVersion` `status=ACTIVE AND environment=APP_ENV` |
| 6 | CONNECTION_PROFILE | `EngineConnection.connection`·`runtime` JSON |
| 7 | USER_SETTING | **읽지 않음** — 앱이 요청 payload(`SpeechRequest.options`)에 실어 보낸다 |
| 8 | RUNTIME_OVERRIDE | `RuntimeOverride` 미만료·미회수 행 |

- 결과는 키마다 `{value, source, sourceRef}`. `GET /admin/config/effective` 가 그대로 반환하고 콘솔이 앱 쪽 결과와 나란히 보여 준다(불일치 = 버그).
- `POST /admin/config/apply` 는 `editability=RUNTIME_EDITABLE` 키만 프로세스 내 값으로 바꾼다. `RESTART_REQUIRED`·`REDEPLOY_REQUIRED` 는 422 로 거부하고 필요한 조치를 응답에 적는다.
- DB 를 못 읽으면 1~4층만으로 부팅하고 `/health` 에 `configDegraded=true` 를 표시한다.

## 5. 금기

- 시크릿 값 로그·응답 금지(`secrets.resolve_secret` 결과는 어댑터 내부에서만 소비).
- `SpeechJob` 외 앱 테이블 쓰기 금지(읽기는 설정 행만).
- 실시간 세션 안에서 whisper·발음 분석 호출 금지(worker 전용).
- 엔진명 분기는 `engine/adapters/**` 안에서만.
