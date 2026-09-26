# 05. Configuration Source Priority — 8층 우선순위와 예시

> 원문 §83·§84·§85·§62. 정본: `../configuration-resolution.md`(순서·규칙의 정본). 이 문서는 순서를 **인용**하고 층마다 실제 키 예시와 사용자 설정 병합 시점을 보인다. 산출 알고리즘·출력 형태는 `04`.

## 1. 목적

"이 값은 어디서 왔는가"를 개발자·관리자가 즉시 답할 수 있게 8층의 의미·대표 키·편집 경로를 한 표로 두고, §84 의 "Engine Configuration + User Preference → Runtime Request" 병합이 어느 시점에 어떻게 일어나는지 못 박는다.

## 2. 범위

- 포함: 8층 정의·예시, 층별 편집 경로와 반영 시점, 사용자 설정 병합(§85 TTS speed), 충돌 규칙.
- 제외: 캐시·API(`04`), Override 정책 상세(`16` §8).

## 3. 8층 (낮음 → 높음, 정본 §9-C 확정)

| # | Source | 정의 | 대표 키 예 | 편집 경로 | 반영 시점 |
|---|---|---|---|---|---|
| 1 | `DEFAULT` | 스키마 `default` | `runtime.cpuThreads=4`, `connection.timeoutMs=10000`, `tts.speed=1.0` | 코드(스키마) 수정 → 배포 | 재배포 |
| 2 | `SOURCE_CODE` | 어댑터 상수·프롬프트 파일 v0 | `claude-cli` 의 `tier→model` 표, `prompts/talk.ts`, `tutor.md` | 코드 수정 → 배포(프롬프트는 `prompts:sync`) | 재배포 |
| 3 | `APPLICATION_CONFIG` | `speech.config.yml`·`app.config.yml` | 연결 identity(`connections[].engineId/role/connectionType`)와 기본 `runtime`·`connection` 값, `fallback.<role>` 초기값 | 파일 수정 → 재기동 | 재기동 |
| 4 | `ENVIRONMENT` | env 변수 | `SPEECH_THREADS`, `TTS_BASE_URL`, `LLM_TIMEOUT_MS`, `APP_ENV`(층이 아니라 선택자) | `.env`/pm2 ecosystem → 재기동 | 재기동 |
| 5 | `DATABASE` | Console 이 Apply 한 비-연결 설정 | `EngineFallbackPolicy.REALTIME_STT`, `AppSetting voice.preview.defaultText`, `VoiceProfile.defaults.speed=0.9`, `PromptVersion ACTIVE` | Console(Form/JSON/Import/Rollback) | 즉시(RUNTIME_EDITABLE) |
| 6 | `CONNECTION_PROFILE` | `EngineConnection.connection/runtime/logLevel` | `runtime.model=large-v3`, `connection.baseUrl`, `credentialRef`, `logging.level` | Console → `ConfigurationVersion` → 물화 → Python push | 즉시 또는 재기동(키의 editability) |
| 7 | `USER_SETTING` | 사용자 설정(요청 컨텍스트에 userId 가 있을 때만) | `UserVoiceSetting.speed=0.8`, `voiceProfileId`, `UserSpeechSetting.recognitionMode` | 사용자 `/settings` | 즉시(요청마다) |
| 8 | `RUNTIME_OVERRIDE` | TEMPORARY(전역·TTL)/SESSION(세션 한정) | `runtime.model=large-v3 (30분)`, 세션 `tts.voiceProfileId=haruka` | Console › Overrides | 즉시, 만료 시 자동 해제 |

규칙: 상위 층이 하위 층을 **키 단위**로 덮는다(객체 병합이 아니라 leaf 키). 배열 값은 통째로 교체한다. `null` 은 "이 층에서 값 없음"이 아니라 "명시적 null" 이므로 스키마가 nullable 일 때만 허용한다.

## 4. 층별 예시 — 같은 키가 여러 층에 있을 때

| 키 | DEFAULT | APPLICATION_CONFIG | ENVIRONMENT | CONNECTION_PROFILE | RUNTIME_OVERRIDE | Effective · Source |
|---|---|---|---|---|---|---|
| `runtime.cpuThreads` | 4 | 8 | `SPEECH_THREADS=4` | — | — | **4 · ENVIRONMENT** (§83 사례, yaml 8 가려짐) |
| `runtime.model` | medium | medium | — | large-v3 | — | **large-v3 · CONNECTION_PROFILE** |
| `runtime.model` (개발자 30분 실험) | medium | medium | — | medium | large-v3 | **large-v3 · RUNTIME_OVERRIDE**(만료 후 medium) |
| `connection.timeoutMs` | 10000 | — | — | — | — | **10000 · DEFAULT** |
| `fallback.REALTIME_STT.primary` | — | reazon-ondevice | — | — | — | **reazon-ondevice · APPLICATION_CONFIG**(Console 에서 바꾸면 DATABASE) |
| `logging.level` | INFO | — | — | DEBUG | — | **DEBUG · CONNECTION_PROFILE**(PRODUCTION 은 `AppSetting log.production.maxLevel` 이 상한, `15` §5) |

## 5. 사용자 설정 병합 시점 (§84·§85·§62)

관리 설정(1~6층, 8층)은 **연결·역할 단위**로 해석되어 캐시되고, 사용자 설정(7층)은 **요청 시점**에 그 결과 위에 얹힌다. Override(8층)가 사용자 설정보다 높은 이유는 개발자가 "이 세션에서는 무엇을 설정했든 large-v3" 를 강제하기 위해서다.

```mermaid
flowchart LR
  A[1~6층 Effective (연결·역할 단위, 캐시)] --> M[요청 병합]
  U[7 USER_SETTING: UserVoiceSetting/UserSpeechSetting] --> M
  O[8 RUNTIME_OVERRIDE: TEMPORARY/SESSION] --> M
  M --> P[TTS Parameter Resolver / Speech Mode Resolver / Engine Router]
  P --> R[Runtime Request: SBV2 파라미터·STT 엔진 선택·LLM tier]
```

§85 `tts.speed` 예:

| 층 | 값 | sourceRef |
|---|---|---|
| DEFAULT | 1.0 | `schema:style-bert@2#tts.speed` |
| DATABASE (VoiceProfile.defaults) | 0.9 | `db:VoiceProfile/haruka#defaults.speed` |
| USER_SETTING | 0.8 | `db:UserVoiceSetting/<userId>#speed` |
| **Effective** | **0.8 · USER_SETTING** | |

Console 의 Effective 화면은 기본적으로 7층 없이(관리 설정만) 보여주고, 개발자가 `userId` 를 지정하면(`GET config/effective?userId=`, `trace.read` 필요) 7층까지 포함해 "Default 1.0 / Voice Profile 0.9 / User Override 0.8" 로 펼친다. 사용자 값이 `AUTO`(예: style) 면 그 층은 "값 없음"으로 취급해 아래 층이 이긴다.

TTS Parameter Resolver(§69: User Setting > VoiceProfile.defaults > Persona 힌트 > Conversation Context > LLM `speech.style`)에서 **Persona·Context·LLM style 은 설정 층이 아니라 요청 입력**이다. 따라서 Effective Configuration 에는 나타나지 않고 Trace 의 step 입력(`13`)에만 기록된다.

## 6. 충돌·특수 규칙

- `ENVIRONMENT` 가 이긴 키는 Console 편집이 무효하므로 편집 폼에서 잠그고 사유를 표시한다(`04` §7). Apply 는 저장은 하되 `warnings[]` 로 "현재 효력 없음"을 돌려준다.
- `SECRET` 키는 층에 상관없이 값이 아니라 `credentialRef` 만 흐른다. env 에 평문 API 키가 있어도 resolver 는 `env:<NAME>` ref 로만 다룬다(speech-platform `08`).
- `READ_ONLY` 키는 1~4층에서만 올 수 있다. 5~8층에 있으면 검증 실패(`10` §5).
- `APP_ENV` 는 층이 아니라 **어느 환경의 DB 행을 읽을지 고르는 선택자**다. env 에 `APP_ENV` 가 없으면 기동 실패.
- Override 는 `RUNTIME_EDITABLE` 키에만 허용된다. `RESTART_REQUIRED` 키를 Override 하려면 400.

## 7. 검증/오류

- 정본 `../configuration-resolution.md` 의 순서와 이 표의 1~8 이 같은지 문서 검증 시 대조.
- 단위 테스트: §4 표의 각 행을 픽스처로 고정, 기대 `source` 검증.
- QA: env 로 `SPEECH_THREADS` 를 주고 yaml 과 다른 값을 넣은 뒤 Console 에 ⚠ shadowed 표시와 편집 잠금이 나오는지 확인.

## 8. Phase

1: 1~6층 해석·표시 · 2: DATABASE/CONNECTION_PROFILE 편집 경로 · 3: — · 4: 8층 Override 활성.

## 9. 미결

- `VoiceProfile.defaults` 를 `DATABASE` 로 볼지 별도 `VOICE_PROFILE` 소스로 표기할지(§85 화면 표기는 "Voice Profile"). 현재는 `DATABASE` + `sourceRef` 로 구분한다.
- yaml 을 재기동 없이 재로드하는 `POST config/reload` 는 두지 않는다(운영 안전). 필요 시 Phase 4 재검토.
