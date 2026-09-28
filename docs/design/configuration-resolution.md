# TheKaiwa Configuration Resolution Rule (정본)

> 작성일 2026-09-26 · 상태: 설계 확정(구현 전) · 소유: leader(규칙) / developer(`src/modules/engine/configuration/resolver` 구현) / reviewer(감사)
>
> 이 문서는 관리자 콘솔 기획안 §82~§107·§126(`docs/관리자콘솔-기획안-원본.md`)과 설계안 §9-C 를 **설정 해석 규칙의 단일 출처**로 확정한 것이다. 엔티티는 `docs/design/domain-model.md`, API 는 `docs/design/api-contract.md`(§2-23 `config/*`), capability 는 `docs/design/role-permission.md` 를 인용한다. `docs/design/admin-console/04-effective-configuration-resolver.md`·`05-configuration-source-priority.md`·`16-environment-configuration-policy.md` 와 `speech-platform/07-engine-configuration-schemas.md`·`08-credential-secret-management.md` 는 이 문서의 규칙을 세부 전개하며, 충돌 시 이 문서가 우선한다.

---

## 0. 목적

- 개발자가 콘솔에서 "지금 런타임이 실제로 쓰는 값이 무엇이고, 어디서 왔는가"(§82·§83)를 키 단위로 확인할 수 있게 한다 — `application.yml 에는 threads=8 인데 런타임은 4` 같은 상황을 `source=ENVIRONMENT, sourceRef=env:…` 로 즉시 설명.
- 설정 변경의 **유일한 경로**를 Edit → Validate → Test → Diff → Apply 로 고정하고, 모든 변경을 `ConfigurationVersion` + `AuditLog` 로 남기며 Rollback 을 새 버전으로 처리한다(§88·§93·§94).
- 환경(LOCAL/PRODUCTION) 분리와 Production 보호(§95·§96), 임시·세션 Override(§106·§107), Secret 비저장(§103·§113)을 하나의 Resolver 규칙으로 통합한다.
- Python 서비스(gateway·worker·tts-service)가 같은 규칙으로 부팅·반영하게 해 앱과 서비스의 Effective 값이 어긋나지 않게 한다.

적용 범위: `ConfigScope{ENGINE_CONNECTION, FALLBACK_POLICY, PROMPT, APP_SETTING, VOICE_PROFILE, PRESET}` 의 모든 키. 학습자 개인 설정(`Profile`·`UserVoiceSetting`·`UserSpeechSetting`)은 설정 엔티티가 아니라 **요청 시점 입력**(`USER_SETTING` 층)으로만 참여한다.

---

## 1. 용어

| 용어 | 정의 | 위치 |
|---|---|---|
| **Engine Descriptor** | 어댑터 코드가 선언하는 엔진 정체성: `id`(`faster-whisper`·`sherpa-onnx-reazon`·`style-bert-vits2`·`claude-cli`·`home-m4-api` — domain-model §7 시드와 동일, 정합성 #10), `displayName`, `type(EngineType)`, `roles(EngineRole[])`, `connectionTypes`, `capabilities`, `pluginVersion`, `schemaVersion`. 기동 시 `Engine` 테이블에 스냅샷 upsert | 코드 `src/modules/engine/adapters/*/descriptor()` → DB `Engine` |
| **Configuration Schema** | 엔진별 설정 키 목록과 메타데이터(§5 규격). `DEFAULT` 층의 값 원천이자 Validate·Form/JSON UI·Editability 판정의 기준 | 코드 `configurationSchema()` |
| **Connection Profile** | "그 엔진을 어디에서 어떤 설정으로 쓰는가"(§47). `EngineConnection{environment, key, engineId, role, connectionType, connection Json, runtime Json, credentialRef, logLevel, status}` | DB `EngineConnection` |
| **Effective Configuration** | 환경·대상(scope+targetId)·요청 컨텍스트에 대해 8층을 병합한 최종 키-값 집합. 키마다 `{value, source, sourceRef, editability}` 를 갖는다 | Resolver 출력(캐시), `GET /api/admin/v1/config/effective` |
| **Source** | 값이 온 층. `ConfigSource{DEFAULT, SOURCE_CODE, APPLICATION_CONFIG, ENVIRONMENT, DATABASE, CONNECTION_PROFILE, USER_SETTING, RUNTIME_OVERRIDE}` — 낮은 번호가 낮은 우선순위 | enum(`domain-model.md`) |
| **sourceRef** | Source 안에서 값의 정확한 위치를 가리키는 문자열(§83 "ENV: SPEECH_THREADS=4"): `schema:<engineId>@<schemaVersion>#<key>` · `code:<path>#<symbol>` · `file:<yml>#<jsonpath>` · `env:<NAME>` · `db:ConfigurationVersion[<id>]` · `db:EngineConnection[<id>].<field>` · `user:<userId>.<setting>.<field>` · `db:RuntimeOverride[<id>]` | Resolver |
| **Editability** | 키의 변경 가능성 `Editability{READ_ONLY, RUNTIME_EDITABLE, RESTART_REQUIRED, REDEPLOY_REQUIRED, SECRET}`(§87). 스키마가 정하며 `connectionType` 별로 달라질 수 있다(`editabilityBy`) | 스키마 |
| **ConfigurationVersion** | `DATABASE` 층의 단위. `(environment, scope, targetId, version)` 유일, `status ConfigVersionStatus{ACTIVE, SUPERSEDED, ROLLED_BACK}`, `snapshot`(적용 후 전체 저장값)·`diff`·`testResult`·`restoredFromVersion` | DB |
| **RuntimeOverride** | 최상위 임시 층. `kind OverrideKind{TEMPORARY, SESSION}`, `patch`, `expiresAt`, `sessionId?`, `revokedAt?` | DB |
| **Environment** | `Environment{LOCAL, DEVELOPMENT, STAGING, PRODUCTION}`. 층이 아니라 **어느 DB 행을 읽을지 고르는 선택자**(`APP_ENV`) | env |
| **Resolver** | 위를 합쳐 Effective 를 만드는 순수 함수 + 캐시. `src/modules/engine/configuration/resolver.ts`(TS), `speech/common/config/resolver.py`(Python, 동일 규칙) | 코드 |

---

## 2. 8층 Source 우선순위

낮은 층부터 쌓고 **높은 층이 같은 키를 덮는다**(§84 순서를 8층으로 세분). 각 층은 "무엇을 설정할 수 있는가"와 "누가 어떻게 바꾸는가"가 다르다.

| 순위 | Source | 원천 | 설정할 수 있는 것 | 편집 주체·방법 | 반영 시점 | `sourceRef` 예 |
|---|---|---|---|---|---|---|
| 1 (최하) | `DEFAULT` | Configuration Schema 의 `default` | 스키마에 정의된 모든 키의 기본값. **모든 키는 반드시 여기서 값을 가진다**(없으면 스키마 오류) | developer — 어댑터 코드 수정·재배포 | 재배포 | `schema:faster-whisper@3#runtime.cpuThreads` |
| 2 | `SOURCE_CODE` | 코드 상수·파일 v0: 프롬프트 파일(`src/modules/conversation/prompts/**`, `.claude/agents/tutor.md`), `engine/registry/seed.ts` 의 연결 identity 기본, task→tier 표 | 프롬프트 본문 v0, seed 연결의 `engineId/role/connectionType`, 코드가 고정하는 정책 상수(`maxConcurrentTurnsPerUser=1`) | prompt-engineer/developer — 파일 수정 + `npm run prompts:sync` | 재배포(프롬프트는 sync 로 DB 버전 생성) | `code:src/modules/conversation/prompts/talk.ts#TALK_V0` |
| 3 | `APPLICATION_CONFIG` | `speech/speech.config.yml`(음성 엔진·연결·fallback 초기값), `app.config.yml`(앱 운영 기본: rate limit·보존 기간·preview 문장) | 연결의 `connection.*`·`runtime.*` 초기값, `fallback.<role>` 초기 순서, AppSetting 초기값. **런타임 진실이 아니라 초기값·부팅 폴백** | developer — 파일 수정(저장소 커밋) | 재기동(앱·Python 모두) | `file:speech.config.yml#connections[whisper-voicevault].runtime.cpuThreads` |
| 4 | `ENVIRONMENT` | 프로세스 env(`.env`, pm2 `ecosystem.config.js`, M4 launchd/uvicorn env) | 호스트별로 달라야 하는 값: baseUrl·포트·스레드·타임아웃·`credentialRef` 기본·`DATA_ROOT`. **Secret 값 자체가 env 에 있어도 Resolver 는 `env:<NAME>` ref 로만 다룬다** | 운영자(사용자) — 서버 파일 편집 | 재기동(`pm2 restart --update-env`) | `env:KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS` |
| 5 | `DATABASE` | `ConfigurationVersion(status=ACTIVE)` 의 `snapshot` — scope 별 관리자 변경의 누적 결과. `PROMPT` 는 `PromptVersion(ACTIVE)`, `APP_SETTING` 은 `AppSetting.value`, `FALLBACK_POLICY` 는 `EngineFallbackPolicy` 행 | 관리자가 콘솔에서 Apply 한 모든 키(READ_ONLY·SECRET 제외). 프롬프트 ACTIVE 본문, AppSetting, fallback 순서 | ADMIN/DEVELOPER/SUPER_ADMIN — Validate→Test→Diff→Apply | 즉시(RUNTIME_EDITABLE) / 재기동·재배포(그 외, 값은 저장되고 `pending` 표시) | `db:ConfigurationVersion[cfgv_…]` |
| 6 | `CONNECTION_PROFILE` | 선택된 `EngineConnection` 행의 `connection`·`runtime`·`credentialRef`·`logLevel` — **"어느 connection 을 쓰는가"의 결과** | 역할별로 Router 가 고른 connection 의 저장값. `DATABASE` 와의 차이: 5 는 "대상 하나의 버전 이력", 6 은 "역할 → 활성 connection 선택"이 개입한 뒤의 값. 같은 대상이면 5 와 6 의 값은 같고 `sourceRef` 만 다르다(`db:EngineConnection[id].runtime.cpuThreads`) | `engine.connections.manage` — Connection 편집(내부적으로 5 를 거친다) | 5 와 동일 | `db:EngineConnection[ec_…].connection.timeoutMs` |
| 7 | `USER_SETTING` | 요청 사용자의 `UserVoiceSetting`·`UserSpeechSetting`·`Profile` | **요청 시점 파라미터만**: TTS `speed/style/styleWeight/pitch/intonation/speechProfile/voiceProfileId`, STT `recognitionMode`, 프롬프트 헤더용 `level/strictness/explainLang/explainDepth`. 엔진·connection·model·credential 은 **절대 설정할 수 없다** | 학습자 — `PUT /api/v1/settings/*` | 다음 요청 | `user:u_….voice.speed` |
| 8 (최상) | `RUNTIME_OVERRIDE` | `RuntimeOverride(kind=TEMPORARY \| SESSION)` 중 만료·revoke 되지 않은 것 | RUNTIME_EDITABLE 키만(§9). TEMPORARY 는 환경 전체, SESSION 은 `sessionId` 가 일치하는 요청에만 | DEVELOPER/SUPER_ADMIN — `POST /api/admin/v1/overrides` | 즉시, TTL 만료 시 자동 소멸 | `db:RuntimeOverride[ro_…] expires 2026-09-26T03:00Z` |

층별 제약:

- **1·2·3·4 는 프로세스 기동 시 읽어 메모리에 고정**한다(변경 = 재기동/재배포). 5·6·8 은 DB 를 읽으며 캐시·무효화 대상(§3-5). 7 은 캐시하지 않고 요청마다 붙인다.
- `SECRET` 키는 층에 상관없이 **값이 아니라 `credentialRef` 문자열**만 흐른다. Resolver 결과의 `value` 는 항상 ref 이며 값 해석은 어댑터 호출 직전 `infra/secrets.SecretResolver` 가 한다(§10).
- `READ_ONLY` 키는 1~4 층만 허용한다. 5·8 층에 READ_ONLY 키가 들어 있으면 Validate 가 `E_READ_ONLY` 로 거부하고, 이미 저장된 값(스키마 변경으로 생긴 잔재)은 무시 + `W_IGNORED_READ_ONLY` 경고.
- `USER_SETTING` 층은 스키마의 `userSettable: true` 키에만 적용된다(§5). 그 외 키에 대한 사용자 값은 존재하지 않는다.
- `RUNTIME_OVERRIDE` 는 `RUNTIME_EDITABLE` 키만. RESTART_REQUIRED 키의 Override 는 Validate 가 `E_NOT_RUNTIME_EDITABLE` 로 거부(재기동 없이 반영할 수 없으므로 "임시"가 성립하지 않는다).
- **`APP_ENV` 는 층이 아니다.** 5·6·8 층의 DB 조회에 `where environment = APP_ENV` 를 붙이는 선택자이며, 미설정이면 기동 실패. 1~4 층은 환경별 파일/env 자체가 다르다.
- 관리자 콘솔 기획 §84 의 6단계(Default → Source → Environment → Database → Connection Profile → Runtime Override)는 이 표의 1·2·3+4·5·6·8 이고, §84 "일반 사용자 설정은 별도 User Preference Layer" 가 7 이다. §85 의 예(`speed`: Default 1.0 → Voice Profile 0.9 → User 0.8 = 0.8)는 §4 TTS 우선순위로 처리한다(`VoiceProfile.defaults` 는 `DATABASE` 층의 `VOICE_PROFILE` scope 로 표기하고 `sourceRef=db:VoiceProfile[id].defaults.speed`).

### 2-1. ENVIRONMENT 층 env 변수 명명 규칙

```
KAIWA_<ROLE>_<KEY_PATH>            # ROLE ∈ REALTIME_STT | ANALYSIS_STT | TTS | LLM  (역할의 "활성 connection" 에 적용)
KAIWA_CONN_<CONNECTION_KEY>_<KEY_PATH>   # 특정 connection key 에만 적용 (우선)
KAIWA_APP_<KEY_PATH>               # APP_SETTING scope
```

- `<KEY_PATH>` = 스키마 키의 점(`.`)을 `_` 로, 대문자. 예: `runtime.cpuThreads` → `RUNTIME_CPUTHREADS`, `runtime.vad.minSilenceMs` → `RUNTIME_VAD_MINSILENCEMS`, `connection.baseUrl` → `CONNECTION_BASEURL`. `<CONNECTION_KEY>` 의 `-` 는 `_` 로(`whisper-voicevault` → `WHISPER_VOICEVAULT`).
- 예: `KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS=4`, `KAIWA_CONN_STYLE_BERT_M4_CONNECTION_BASEURL=http://192.168.219.100:8200`, `KAIWA_LLM_CONNECTION_TIMEOUTMS=60000`, `KAIWA_APP_VOICE_PREVIEW_DEFAULTTEXT=…`.
- 타입은 스키마로 파싱(`INTEGER/NUMBER/BOOLEAN/ENUM/STRING/URL/PATH/SECRET_REF`); 파싱 실패는 기동 시 `MISCONFIGURED` + 콘솔 배너(값은 무시하고 아래 층으로).
- **별칭(호환)**: 기존 문서·`.env.example` 의 짧은 이름 `SPEECH_GATEWAY_URL`, `TTS_SERVICE_URL`, `WHISPER_SERVICE_URL`, `CLAUDE_CLI_PATH`, `CLAUDE_CLI_CONCURRENCY`, `AI_API_BASE`, `AI_API_KEY`, `AI_API_MODEL`, `AI_TIER_<TASK>`, `SPEECH_THREADS`, `TTS_BASE_URL`, `LLM_TIMEOUT_MS` 는 `infra/config/envAliases.ts` 의 고정 표로 `KAIWA_*` 키에 매핑한다(둘 다 있으면 `KAIWA_*` 우선, `sourceRef` 는 실제 읽은 이름). `AI_API_KEY` 처럼 **값이 시크릿인 별칭은 `credentialRef=env:AI_API_KEY` 로만 변환**하고 값을 Resolver 에 싣지 않는다.
- Python 서비스도 같은 규칙(`speech/common/config/env.py`)으로 자기 역할의 키만 읽는다.

---

## 3. Effective Configuration 산출 알고리즘

### 3-1. 입력·출력

```
resolve(env: Environment, scope: ConfigScope, targetId: string, ctx?: { userId?, sessionId?, role? })
  → EffectiveConfiguration {
      environment, scope, targetId, targetKey?, engineId?, schemaVersion, resolvedAt, cacheHit,
      keys: Array<{ key, value, source: ConfigSource, sourceRef, editability, restartRequired, secret,
                    layers: Array<{ source, value, sourceRef }>,   // 낮은 층 → 높은 층, 가려진 값 포함(DEVELOPER 이상만 노출)
                    warnings?: string[] }>
    }
```

### 3-2. 의사코드

```pseudo
function resolve(env, scope, targetId, ctx):
  target  = loadTarget(env, scope, targetId)              # EngineConnection | EngineFallbackPolicy | PromptTemplate | AppSetting | VoiceProfile | ConfigurationPreset
  schema  = schemaFor(scope, target)                      # ENGINE_CONNECTION → adapters[target.engineId].configurationSchema()
                                                          # FALLBACK_POLICY/APP_SETTING/VOICE_PROFILE/PROMPT → 코드 내 고정 스키마
  cacheKey = (env, scope, target.id, ctx.sessionId ?? '-')  # USER_SETTING 은 캐시 밖
  if cache.has(cacheKey) and not ctx.userId: return cache.get(cacheKey) with cacheHit=true

  layers = ordered list of 8 maps (key → {value, sourceRef})
  layers[DEFAULT]            = { k.key: k.default for k in schema.keys }                      # 모든 키 포함
  layers[SOURCE_CODE]        = codeConstants(scope, target)                                    # 프롬프트 v0·seed identity·정책 상수
  layers[APPLICATION_CONFIG] = yaml(scope, target.key)                                         # speech.config.yml / app.config.yml (기동 시 로드본)
  layers[ENVIRONMENT]        = envVars(target.role, target.key, scope)                        # §2-1 규칙, KAIWA_CONN_* > KAIWA_<ROLE>_* > 별칭
  layers[DATABASE]           = activeVersionSnapshot(env, scope, target.id)                    # ConfigurationVersion ACTIVE.snapshot / PromptVersion ACTIVE / AppSetting.value
  layers[CONNECTION_PROFILE] = scope == ENGINE_CONNECTION ? flatten(target.connection, target.runtime, target.credentialRef, target.logLevel) : {}
  layers[USER_SETTING]       = ctx.userId ? userSettable(schema, loadUserSettings(ctx.userId)) : {}   # userSettable 키만, 'AUTO' 는 "미지정" 으로 제거
  layers[RUNTIME_OVERRIDE]   = activeOverrides(env, scope, target.id, now, ctx.sessionId)      # TEMPORARY(전역) ∪ SESSION(sessionId 일치), expiresAt>now, revokedAt null; 최신 createdAt 우선

  result = {}
  for key in schema.keys:                                 # 스키마 밖의 키는 어느 층에 있어도 무시 + W_UNKNOWN_KEY
    stack = []
    for src in [DEFAULT..RUNTIME_OVERRIDE]:
      if key in layers[src]:
        v = layers[src][key]
        if not allowedInLayer(key.editability, src):      # READ_ONLY → 1~4 만 · RUNTIME_OVERRIDE → RUNTIME_EDITABLE 만 · SECRET → ref 형식만
          warn(key, 'W_IGNORED_' + src); continue
        stack.push({source: src, value: v.value, sourceRef: v.sourceRef})
    top = stack.last()
    result[key] = { value: top.value, source: top.source, sourceRef: top.sourceRef,
                    editability: effectiveEditability(key, target.connectionType),   # editabilityBy[connectionType] ?? editability
                    restartRequired: key.restartRequired, secret: key.type == 'SECRET_REF', layers: stack }

  validate(result, schema)                                # 타입·범위·enum·의존성. 위반 키는 value 를 유지하되 warnings 에 E_* 기록,
                                                          # EngineConnection 이면 status=MISCONFIGURED(statusReason) 로 표시 — Resolver 는 값을 "고치지" 않는다
  eff = { environment: env, scope, targetId: target.id, targetKey: target.key, engineId, schemaVersion, resolvedAt: now, keys: result }
  if not ctx.userId: cache.set(cacheKey, eff, ttl = nearestOverrideExpiry ?? 5min)
  return eff
```

### 3-3. 병합 규칙 세부

- **키 단위 덮어쓰기**만 한다. 객체 병합(deep merge)은 없다 — `runtime.vad.minSilenceMs` 같은 중첩 키도 점 표기의 **평면 키**로 다룬다. 배열 값(`fallbackConnectionIds`)은 통째로 교체.
- 같은 층 안의 충돌: `ENVIRONMENT` 는 `KAIWA_CONN_*` > `KAIWA_<ROLE>_*` > 별칭; `RUNTIME_OVERRIDE` 는 SESSION > TEMPORARY, 같은 kind 면 `createdAt` 최신.
- `USER_SETTING` 의 `'AUTO'`/`null` 은 "값 없음"으로 취급해 층에서 제거한다(§4).
- `DATABASE` 층의 `snapshot` 은 "적용 후 전체 저장값"이므로 그 자체로 완전하다. `ENGINE_CONNECTION` 은 `DATABASE`(버전 스냅샷)와 `CONNECTION_PROFILE`(행 값)이 항상 같아야 하며, 다르면 `W_DRIFT`(누군가 행을 직접 UPDATE 한 것 — reviewer 금기) 경고 + 행 값 우선.
- 값의 **가려짐(shadowing)** 은 오류가 아니다. `layers` 배열로 그대로 보여준다(§83 threads 사례). Diff API 는 apply 해도 Effective 가 안 바뀌는 키를 `shadowedBy` 로 미리 알린다(`api-contract.md` #106).

### 3-4. 대상별 스키마와 타깃

| scope | targetId | 스키마 | DATABASE 층 원천 | 비고 |
|---|---|---|---|---|
| `ENGINE_CONNECTION` | `EngineConnection.id`(API 는 `key` 도 허용) | 어댑터 `configurationSchema()` | `ConfigurationVersion` ACTIVE | 6 층 참여 |
| `FALLBACK_POLICY` | `EngineFallbackPolicy.id` | 고정: `primaryConnectionId, fallbackConnectionIds[], retryOnce, enabled` | `EngineFallbackPolicy` 행(버전은 `ConfigurationVersion`) | 값 검증에 connection 상태 필요 |
| `PROMPT` | `PromptTemplate.key` | 고정: `body, modelHints.tier, modelHints.maxChars, modelHints.jsonSchemaRef` | `PromptVersion(ACTIVE)`; 없으면 `SOURCE_CODE` v0 | `body` 는 SECRET 아님, Export 포함 |
| `APP_SETTING` | `AppSetting.key` | `infra/config/appSettingSchema.ts` (키별 type·default·editability) | `AppSetting.value` | 정책 키는 `environment.policy` |
| `VOICE_PROFILE` | `VoiceProfile.id` | 고정: `defaults.style/styleWeight/speed/pitch/intonation, sortOrder, enabled, displayName, description` | `VoiceProfile` 행 | §4 의 2순위 원천 |
| `PRESET` | `ConfigurationPreset.id` | 없음(스냅샷 컨테이너) | — | 적용은 항목별 scope 로 분해 |

### 3-5. 캐시와 무효화

- 캐시 키 `(environment, scope, targetId, sessionId|'-')`, 값은 §3-1 출력. TTL = `min(5분, 가장 이른 Override expiresAt − now)`. `USER_SETTING` 이 섞인 결과는 캐시하지 않는다(요청마다 7 층만 다시 붙임 — 1~6·8 층 결과는 캐시에서 가져와 병합).
- 무효화 이벤트(같은 트랜잭션 커밋 후 발행, 프로세스 내 EventEmitter + pm2 blue/green 두 슬롯을 위해 `AppSetting config.cacheEpoch` 증가로 교차 무효화):
  1. `ConfigurationVersion` 생성(Apply·Rollback·Import·Preset apply) → 해당 `(scope, targetId)` + 그 connection 을 primary/fallback 으로 갖는 `FALLBACK_POLICY` + Router 캐시.
  2. `RuntimeOverride` 생성·revoke·만료 → 해당 대상. 만료는 TTL 로 자연 소멸하되 `expiresAt` 이 지난 행을 읽으면 즉시 제외.
  3. `PromptVersion` activate → `PROMPT:<key>` + 프롬프트 빌더 캐시.
  4. `EngineConnection.status` 변화(Health) → Resolver 캐시가 아니라 **Router 선택 캐시**만 무효화(값은 그대로).
  5. 프로세스 기동 → 전체 캐시 비움, 1~4 층 재로드.
- Python 서비스는 자체 캐시를 갖고 `POST /admin/config/apply` 로 push 받을 때만 갱신한다(polling 없음). 앱이 push 에 실패하면 `EngineHealth(DEGRADED, "config push failed")` 를 남기고 다음 Health(5분) 시 `GET /admin/config/effective` 와 비교해 `effectiveDiffers` 를 콘솔에 표시한다.

### 3-6. Router 와의 관계

Engine Router(`engine/router`)는 역할 → connection 선택만 한다: `EngineFallbackPolicy(env, role)` 의 `primary → fallbacks` 순으로 `status ∉ {UNAVAILABLE, DISABLED, MISCONFIGURED}` 이고 `enabled` 인 첫 connection. 선택된 connection 에 대해 `resolve(env, ENGINE_CONNECTION, id, ctx)` 를 호출한 결과가 어댑터에 전달되는 **런타임 설정**이다. 실패 시 `retryOnce` 면 다음 connection 으로 1회. Router 는 값을 해석하지 않고, Resolver 는 connection 을 고르지 않는다.

---

## 4. TTS 파라미터 우선순위 (TTS Parameter Resolver, §69)

`speech/tts/parameterResolver.ts` 는 Effective Configuration 의 **요청 시점 특수 사례**다. 입력 5개를 아래 순서로 겹쳐 SBV2 파라미터를 만든다. 위가 아래를 덮는다.

| 순위 | 원천 | 제공 키 | 조건 |
|---|---|---|---|
| 1 (최상) | **User Setting** (`UserVoiceSetting`, `USER_SETTING` 층) | `voiceProfileId, style, styleWeight, speed, pitch, intonation, speechProfile` | `'AUTO'`/`null` 이 아닌 값만. `voiceProfileId` 가 `AVAILABLE && enabled` 가 아니면 `AppSetting voice.default` 로 대체하고 `W_VOICE_FALLBACK` |
| 2 | **VoiceProfile.defaults** (`VOICE_PROFILE` scope, `DATABASE` 층) | `style, styleWeight, speed, pitch, intonation` | 선택된 voice 의 기본값 |
| 3 | **Persona hint** (`tutor.md` §2 말투 → `promptRegistry` 메타 `speech.defaults`) | `style`(예: `Friendly`), `speed` 상한 | 페르소나가 정한 "선생님다운" 기본. 학습자 설정·voice 기본이 없을 때만 |
| 4 | **Conversation context** (라우트가 넘기는 `ctx`) | `speed`(복습 모드·Learning 비교 듣기 0.6/0.8/1.0), `style`(레슨 대화문 낭독 = `Neutral`) | `ctx.mode ∈ {TALK, LESSON_READ, REVIEW, PREVIEW, EVAL}` |
| 5 (최하) | **LLM `speech.style`** (§67 `{NEUTRAL, ENCOURAGING, CALM, CHEERFUL}`) | `style` 로 매핑(`ENCOURAGING→Friendly`, `CHEERFUL→Cheerful`, `CALM→Neutral`, `NEUTRAL→Neutral` — voice 가 그 스타일을 갖지 않으면 `defaults.style`) | 1~4 가 모두 `style` 을 정하지 않았을 때만 |

- **LLM 은 `speaker/model(speakerId·modelName)·pitch·styleWeight` 를 절대 정할 수 없다**(§68). 위 표에서 5 순위가 제공하는 키는 `style` 하나뿐이며, 그것도 의미적 스타일 → voice 의 실제 스타일명으로 **매핑만** 된다. 사용자가 Haruka 를 골랐으면 LLM 이 Takumi 로 바꿀 수 없다(§69).
- 최종 변환: `modelName = VoiceProfile.voiceModelId`, `speakerId = VoiceProfile.speakerId`, `style`, `styleWeight`, `length = 1 / speed`, `pitchScale = pitch`, `intonationScale = intonation`, `sdpRatio/noise/noiseW/language` 는 TTS connection 의 Effective `runtime.*`. `speechProfile`(5차 §138) 은 세그먼트 기본 `speed`/pause 를 정하되 사용자가 고른 `speed` 를 덮어쓰지 않는다(`speech-platform/13` §3.4). **주의(2026-09-26 갱신)**: Resolver 의 직접 출력은 엔진 독립 `RenderingPlan`(`speech-platform/16` §5) 이고, 위 SBV2 변환은 `engine/adapters/tts/styleBertHttp` 가 수행한다. `pitch_scale/intonation_scale` 은 SBV2 `server_fastapi.py` 라우트에 없으므로 M4 자체 래퍼의 `infer()` 인자로 넘긴다.
- 범위 검증(`speed 0.6~1.2, pitch 0.8~1.2, intonation 0.8~1.2, styleWeight 0~2`)은 1·2 순위 입력 시점에 하고, Resolver 는 범위 밖 값을 만들지 않는다.
- 결과에도 `sourceByKey` 를 남긴다: `{ style: "VOICE_PROFILE", speed: "USER_SETTING", pitch: "VOICE_PROFILE", … }` — 관리자 `config/effective?context=user:<id>` 와 Trace `TTS[i].resolved`(관리자 Playground 헤더 `X-Tts-Resolved`) 에 표시. 사용자 화면에는 노출하지 않는다.
- 캐시 키(`TtsCache.key`)는 **해석 결과**로 만든다: `sha1(text|voiceProfileId|style|styleWeight|speed|pitch|intonation|engineConnectionKey|textVersion)` — 같은 결과면 원천이 달라도 캐시 히트.

관련: Speech Mode Resolver(`speech/stt/modeResolver.ts`)는 `UserSpeechSetting.recognitionMode` 를 엔진 역할 조합으로 바꾸는 같은 성격의 요청 시점 해석이다 — `AUTO`=Router 판단(온디바이스 우선) · `FAST`=온디바이스 고정 · `ACCURATE`=gateway + 분석 STT, `requiresReview` 임계 0.9 · `OFFLINE`=온디바이스만. 결과는 `resolved{realtime, analysis, reviewThreshold}` 로 `PUT /api/v1/settings/speech` 응답에 붙는다(`api-contract.md` #16).

---

## 5. Configuration Schema 규격

### 5-1. 문서 형식

각 어댑터의 `configurationSchema()` 가 반환하는 JSON. 콘솔은 이것만으로 Form/JSON 편집기·문서(§100)·Validate 를 생성한다(엔진별 UI 하드코딩 금지, §56·§125-6).

```json
{
  "engineId": "faster-whisper",
  "schemaVersion": 3,
  "groups": [ { "id": "connection", "label": "연결" }, { "id": "runtime", "label": "런타임" } ],
  "keys": [
    {
      "key": "runtime.cpuThreads",             // 점 표기 평면 키 (필수, 스키마 내 유일)
      "group": "runtime",
      "type": "INTEGER",                        // STRING | INTEGER | NUMBER | BOOLEAN | ENUM | URL | PATH | SECRET_REF | JSON
      "default": 4,                             // 필수 (SECRET_REF 는 null 허용)
      "min": 1, "max": 16,                      // INTEGER/NUMBER
      "enum": null,                             // ENUM 일 때 허용값 배열
      "pattern": null,                          // STRING/PATH 정규식
      "required": false,
      "description": "faster-whisper 추론 CPU 스레드 수",
      "impact": "높을수록 CPU 사용량 증가, 우분투 gateway·whisper 경합",
      "editability": "RESTART_REQUIRED",        // Editability enum
      "restartRequired": true,                  // editability 가 RESTART_REQUIRED 면 true (중복이지만 UI·Python 이 독립적으로 읽음)
      "restartTarget": "thekaiwa-speech-worker",// 재시작 대상 pm2 이름 / "tts-service"(M4) / "app"
      "secret": false,                          // type == SECRET_REF 와 동치
      "appliesTo": ["LOCAL"],                   // connectionType 제한(없으면 전부)
      "editabilityBy": { "HTTP": "READ_ONLY" }, // connectionType 별 editability 덮어쓰기
      "userSettable": false,                    // true 면 USER_SETTING 층 참여(예: TTS speed)
      "strict": false,                          // true 면 Production 엄격 키(§8) — Engine/Model/Connection/Credential/Fallback 계열
      "deprecatedSince": null,                  // schemaVersion; 1 Phase 뒤 제거
      "envAlias": ["SPEECH_THREADS"]            // §2-1 별칭(선택)
    }
  ],
  "dependencies": [ { "if": { "runtime.decodingMethod": "modified_beam_search" }, "require": ["runtime.maxActivePaths"] } ]
}
```

규칙: 모든 키에 `default`·`editability` 필수(검증 스크립트 `npm run schema:check` 가 CI 에서 확인). `SECRET_REF` 는 `editability=SECRET` 고정이며 값 형식은 `^(env:[A-Z0-9_]+|file:[a-z0-9][a-z0-9.-]{2,63})$`. `schemaVersion` 은 키 추가·삭제·타입 변경 시 증가. 스키마는 `Engine.schemaVersion` 에 스냅샷되고 `ConfigurationVersion.snapshot` 에는 적용 당시 `schemaVersion` 을 함께 저장한다(오래된 버전 Rollback 시 마이그레이션 경고).

### 5-2. 엔진별 예시 (핵심 키만 — 전체는 `speech-platform/07-engine-configuration-schemas.md`)

#### faster-whisper (`engineId: faster-whisper`, type STT, roles [ANALYSIS_STT], connectionTypes [HTTP, LOCAL])

```json
{ "key": "connection.baseUrl",   "type": "URL",     "default": "http://127.0.0.1:8090", "editability": "RUNTIME_EDITABLE", "appliesTo": ["HTTP"], "strict": true, "description": "whisper-service 주소(VoiceVault 재사용)" }
{ "key": "connection.timeoutMs", "type": "INTEGER", "default": 60000, "min": 5000, "max": 180000, "editability": "RUNTIME_EDITABLE" }
{ "key": "connection.retry",     "type": "INTEGER", "default": 1, "min": 0, "max": 3, "editability": "RUNTIME_EDITABLE" }
{ "key": "connection.credentialRef", "type": "SECRET_REF", "default": null, "editability": "SECRET", "secret": true, "strict": true, "appliesTo": ["HTTP"] }
{ "key": "runtime.model",        "type": "ENUM", "enum": ["tiny","base","small","medium","large-v3","large-v3-turbo"], "default": "medium", "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "thekaiwa-speech-worker", "editabilityBy": { "HTTP": "READ_ONLY" }, "strict": true, "impact": "메모리 1.7GB(medium)~6GB(large-v3), CPU 지연" }
{ "key": "runtime.device",       "type": "ENUM", "enum": ["cpu","cuda","auto"], "default": "cpu", "editability": "RESTART_REQUIRED", "restartRequired": true, "editabilityBy": { "HTTP": "READ_ONLY" } }
{ "key": "runtime.computeType",  "type": "ENUM", "enum": ["int8","int8_float16","float16","float32","default"], "default": "int8", "editability": "RESTART_REQUIRED", "restartRequired": true, "editabilityBy": { "HTTP": "READ_ONLY" } }
{ "key": "runtime.cpuThreads",   "type": "INTEGER", "default": 4, "min": 1, "max": 16, "editability": "RESTART_REQUIRED", "restartRequired": true, "editabilityBy": { "HTTP": "READ_ONLY" }, "envAlias": ["SPEECH_THREADS"] }
{ "key": "runtime.workers",      "type": "INTEGER", "default": 1, "min": 1, "max": 4, "editability": "RESTART_REQUIRED", "restartRequired": true }
{ "key": "runtime.language",     "type": "STRING",  "default": "ja", "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.beamSize",     "type": "INTEGER", "default": 5, "min": 1, "max": 10, "editability": "RUNTIME_EDITABLE", "impact": "지연 ∝ beamSize" }
{ "key": "runtime.vadFilter",    "type": "BOOLEAN", "default": true, "editability": "RUNTIME_EDITABLE" }
```

#### sherpa-onnx-reazon (`engineId: sherpa-onnx-reazon`, type STT, roles [REALTIME_STT], connectionTypes [ONDEVICE, HTTP]) — ReazonSpeech zipformer int8 + silero VAD

```json
{ "key": "connection.baseUrl",         "type": "URL", "default": "http://127.0.0.1:8100", "editability": "RUNTIME_EDITABLE", "appliesTo": ["HTTP"], "strict": true }
{ "key": "connection.wsPath",          "type": "STRING", "default": "/ws/speech", "editability": "RUNTIME_EDITABLE", "appliesTo": ["HTTP"] }
{ "key": "connection.modelManifestUrl","type": "URL", "default": "https://kaiwa.xn--lh0b87pnudm10a4vd.com/models/reazonspeech-int8/manifest.json", "editability": "REDEPLOY_REQUIRED", "appliesTo": ["ONDEVICE"], "strict": true, "description": "앱이 모델을 받는 manifest — 배포 경로와 묶임" }
{ "key": "connection.modelVersion",    "type": "STRING", "default": "2024-08-01.1", "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "thekaiwa-speech-gateway", "strict": true, "description": "ONDEVICE 는 다음 앱 기동 시 재다운로드, HTTP 는 gateway 재시작" }
{ "key": "runtime.provider",           "type": "ENUM", "enum": ["cpu"], "default": "cpu", "editability": "READ_ONLY", "description": "GPU 없음·모바일 CPU 고정" }
{ "key": "runtime.numThreads",         "type": "INTEGER", "default": 2, "min": 1, "max": 8, "editability": "RESTART_REQUIRED", "restartRequired": true, "impact": "ONDEVICE 는 발열·배터리, HTTP 는 gateway CPU 경합" }
{ "key": "runtime.decodingMethod",     "type": "ENUM", "enum": ["greedy_search","modified_beam_search"], "default": "greedy_search", "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.maxActivePaths",     "type": "INTEGER", "default": 4, "min": 1, "max": 8, "editability": "RUNTIME_EDITABLE", "description": "modified_beam_search 전용" }
{ "key": "runtime.model.encoder",      "type": "PATH", "default": "encoder-epoch-99-avg-1.int8.onnx", "editability": "READ_ONLY", "description": "modelVersion 에서 파생" }
{ "key": "runtime.model.decoder",      "type": "PATH", "default": "decoder-epoch-99-avg-1.onnx", "editability": "READ_ONLY" }
{ "key": "runtime.model.joiner",       "type": "PATH", "default": "joiner-epoch-99-avg-1.int8.onnx", "editability": "READ_ONLY" }
{ "key": "runtime.model.tokens",       "type": "PATH", "default": "tokens.txt", "editability": "READ_ONLY" }
{ "key": "runtime.vad.model",          "type": "ENUM", "enum": ["silero"], "default": "silero", "editability": "READ_ONLY" }
{ "key": "runtime.vad.threshold",      "type": "NUMBER", "default": 0.5, "min": 0.1, "max": 0.9, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.vad.minSilenceMs",   "type": "INTEGER", "default": 500, "min": 200, "max": 2000, "editability": "RUNTIME_EDITABLE", "impact": "endpoint 체감 지연(5초 예산의 첫 구간)" }
{ "key": "runtime.vad.minSpeechMs",    "type": "INTEGER", "default": 250, "min": 100, "max": 1000, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.vad.maxSpeechSec",   "type": "INTEGER", "default": 20, "min": 5, "max": 30, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.partialEmit",        "type": "BOOLEAN", "default": true, "editability": "RUNTIME_EDITABLE" }
```

`vad.silenceMs`(기획 표기)는 `runtime.vad.minSilenceMs` 로 통일한다. ONDEVICE connection 의 RUNTIME_EDITABLE 키는 `GET /api/v1/speech/config` 로 다음 앱 기동(또는 `configVersion` ETag 변경 감지) 시 반영된다 — 서버 프로세스 재시작은 없다.

#### style-bert-vits2 (`engineId: style-bert-vits2`, type TTS, roles [TTS], connectionTypes [HTTP]) — Style-Bert-VITS2 on M4 tts-service

```json
{ "key": "connection.baseUrl",        "type": "URL", "default": "http://192.168.219.100:8200", "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["TTS_SERVICE_URL","TTS_BASE_URL"] }
{ "key": "connection.timeoutMs",      "type": "INTEGER", "default": 20000, "min": 5000, "max": 60000, "editability": "RUNTIME_EDITABLE" }
{ "key": "connection.retry",          "type": "INTEGER", "default": 1, "min": 0, "max": 3, "editability": "RUNTIME_EDITABLE" }
{ "key": "connection.credentialRef",  "type": "SECRET_REF", "default": "file:tts-service-token", "editability": "SECRET", "secret": true, "strict": true }
{ "key": "runtime.defaultVoiceModel", "type": "STRING", "default": "teacher_haruka", "editability": "RUNTIME_EDITABLE", "strict": true, "description": "AppSetting voice.default 의 VoiceProfile 이 가리키는 모델과 일치해야 함(Validate 의존성)" }
{ "key": "runtime.language",          "type": "ENUM", "enum": ["JP"], "default": "JP", "editability": "READ_ONLY" }
{ "key": "runtime.maxChars",          "type": "INTEGER", "default": 100, "min": 50, "max": 200, "editability": "RUNTIME_EDITABLE", "description": "문장 분할 상한(SBV2 기본 100자 제한)" }
{ "key": "runtime.styleWeightRange",  "type": "JSON", "default": { "min": 0, "max": 2 }, "editability": "RUNTIME_EDITABLE", "description": "사용자·Playground 입력 검증 범위" }
{ "key": "runtime.pitchRange",        "type": "JSON", "default": { "min": 0.8, "max": 1.2 }, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.intonationRange",   "type": "JSON", "default": { "min": 0.8, "max": 1.2 }, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.speedRange",        "type": "JSON", "default": { "min": 0.6, "max": 1.2 }, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.sdpRatio",          "type": "NUMBER", "default": 0.2, "min": 0, "max": 1, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.noise",             "type": "NUMBER", "default": 0.6, "min": 0, "max": 2, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.noiseW",            "type": "NUMBER", "default": 0.8, "min": 0, "max": 2, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.device",            "type": "ENUM", "enum": ["cpu","mps"], "default": "mps", "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "tts-service", "impact": "M4 MPS vs CPU 합성 시간(실측 게이트 ③)" }
{ "key": "runtime.concurrency",       "type": "INTEGER", "default": 1, "min": 1, "max": 4, "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "tts-service" }
{ "key": "runtime.warmup",            "type": "BOOLEAN", "default": true, "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "tts-service" }
```

사용자 설정 키(`speed/style/styleWeight/pitch/intonation`)는 이 스키마의 키가 아니라 `VOICE_PROFILE` scope + `USER_SETTING` 층에서 오고(§4), 위 `*Range` 가 그 검증 범위를 정한다.

#### claude-cli (`engineId: claude-cli`, type LLM, roles [LLM], connectionTypes [CLI])

```json
{ "key": "connection.bin",             "type": "PATH", "default": "claude", "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "app", "strict": true, "envAlias": ["CLAUDE_CLI_PATH"], "description": "cliPath — argv[0]" }
{ "key": "connection.cwd",             "type": "PATH", "default": "<release root>", "editability": "READ_ONLY", "description": "tutor.md 를 찾는 기준 경로" }
{ "key": "connection.timeoutMs",       "type": "INTEGER", "default": 60000, "min": 10000, "max": 180000, "editability": "RUNTIME_EDITABLE", "envAlias": ["LLM_TIMEOUT_MS"], "description": "기본 상한. task 별 상한(A1 12s 등)은 코드 상수(SOURCE_CODE)이며 이 값을 넘지 못함" }
{ "key": "connection.lanes",           "type": "INTEGER", "default": 2, "min": 1, "max": 4, "editability": "RESTART_REQUIRED", "restartRequired": true, "restartTarget": "app", "envAlias": ["CLAUDE_CLI_CONCURRENCY"], "description": "concurrency — interactive/batch 레인 수(구독 rate limit 6개 프로젝트 공유)" }
{ "key": "connection.permissionMode",  "type": "ENUM", "enum": ["dontAsk"], "default": "dontAsk", "editability": "READ_ONLY" }
{ "key": "connection.authMode",        "type": "ENUM", "enum": ["SUBSCRIPTION"], "default": "SUBSCRIPTION", "editability": "REDEPLOY_REQUIRED", "description": "서버 구독 로그인. API 키 없음(credentialRef 없음)" }
{ "key": "runtime.tiers.talk",         "type": "ENUM", "enum": ["haiku","sonnet","opus"], "default": "haiku",  "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["AI_TIER_TALK"], "impact": "회화 턴 지연·구독 사용량 — model tier map" }
{ "key": "runtime.tiers.review",       "type": "ENUM", "enum": ["haiku","sonnet","opus"], "default": "sonnet", "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["AI_TIER_REVIEW"] }
{ "key": "runtime.tiers.analysis",     "type": "ENUM", "enum": ["haiku","sonnet","opus"], "default": "opus",   "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["AI_TIER_ANALYSIS"] }
{ "key": "runtime.modelIds",           "type": "JSON", "default": { "haiku": "claude-haiku-4-5", "sonnet": "claude-sonnet-4-5", "opus": "claude-opus-4-1" }, "editability": "RUNTIME_EDITABLE", "strict": true, "description": "tier → --model 값. --agents JSON 에는 model 을 싣지 않는다" }
{ "key": "runtime.streamJson",         "type": "BOOLEAN", "default": true, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.agentsFile",         "type": "PATH", "default": ".claude/agents/tutor.md", "editability": "READ_ONLY", "description": "페르소나 파일. 내용 버전은 Prompt Registry(teacher-persona)" }
{ "key": "runtime.maxConcurrentTurnsPerUser", "type": "INTEGER", "default": 1, "editability": "READ_ONLY" }
```

#### home-m4-api (`engineId: home-m4-api`, type LLM, roles [LLM], connectionTypes [HTTP]) — home-m4-api `/v1/chat`(qwen), 어댑터 전용(회화 턴 금지)

```json
{ "key": "connection.baseUrl",        "type": "URL", "default": "http://192.168.219.100:8000/v1", "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["AI_API_BASE"] }
{ "key": "connection.credentialRef",  "type": "SECRET_REF", "default": "file:home-m4-api-key", "editability": "SECRET", "secret": true, "strict": true, "description": "apiKeyRef — 값은 SecretResolver. 별칭 AI_API_KEY 는 env:AI_API_KEY ref 로만 변환" }
{ "key": "connection.timeoutMs",      "type": "INTEGER", "default": 20000, "min": 5000, "max": 120000, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.model",             "type": "STRING", "default": "qwen2.5:14b", "editability": "RUNTIME_EDITABLE", "strict": true, "envAlias": ["AI_API_MODEL"] }
{ "key": "runtime.temperature",       "type": "NUMBER", "default": 0.3, "min": 0, "max": 1.5, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.maxOutputTokens",   "type": "INTEGER", "default": 1024, "min": 128, "max": 4096, "editability": "RUNTIME_EDITABLE" }
{ "key": "runtime.systemFirst",       "type": "BOOLEAN", "default": true, "editability": "READ_ONLY", "description": "첫 메시지 system 강제(주식분석가 프롬프트 주입 방지)" }
{ "key": "runtime.allowedTasks",      "type": "JSON", "default": ["wordEnrich","distractorGen","chatReviewFallback"], "editability": "RUNTIME_EDITABLE", "description": "회화·채팅 턴(talk/chat/ask)은 어떤 설정으로도 허용되지 않는다(Validate 의존성)" }
```

---

## 6. 편집 흐름과 ConfigurationVersion 수명주기

### 6-1. Edit → Validate → Test → Diff → Apply (§88·§90·§92)

```
[Form / Raw JSON 편집]  (콘솔, 로컬 상태만)
        │ patch {key: value}
        ▼
POST config/validate ── 문법 → 스키마(타입·범위·enum·appliesTo·editabilityBy) → 의존성(호스트 능력·역할 조합·SECRET_REF 형식·allowedTasks) → 편집성(READ_ONLY 거부)
        │ valid + impact{restartRequired[], redeployRequired[], strict[]}
        ▼
POST config/test ────── 후보 설정을 메모리 합성 → Functional Test(STT 샘플 wav / TTS 고정 문장 / LLM 스키마 1회) → testResultId(30분)
        │ (RESTART_REQUIRED 키는 untested 로 표시)
        ▼
POST config/diff ────── 저장값 vs 후보: changes[{key, before, after, beforeSource, editability, strict, shadowedBy}] + summaryHash(30분)
        │
        ▼
POST config/apply ───── baseVersion 확인 → 트랜잭션(§6-2) → 캐시 무효화 → RUNTIME_EDITABLE 키 서비스 push → 응답 applied{…, restartRequired, restartTarget}
```

> **task-012c 확정(2026-09-29 C1, D-C1·D-C4·D-C10)** — 위 그림 중 바뀐 것: ① `summaryHash` 는 **무상태**다 — 서버는 Diff 를 저장하지 않고, apply·rollback 이 받은 후보로 Diff 를 다시 계산해 해시를 대조한다(유효 기간 없음, `baseVersion` 이 바뀌면 자연 불일치). ② `testResultId` = `EngineHealth(FUNCTIONAL).id`(`detail.candidateHash`·`checkedAt` 으로 30분·같은 후보 확인 — DB 라 blue/green·재기동에도 유효). ③ **편집 가능 키는 앱(Node)이 실제로 읽는 키 중 "런타임 실사용값 == Effective" 테스트가 있는 키뿐**이다 — 런타임은 이 Resolver 를 거치지 않고 `EngineConnection` 행 JSON·일부 env 를 직접 읽기 때문(2026-09-29 확인). Python 서비스가 읽는 키는 콘솔 편집 거부(`serviceManaged`). ④ 커밋 후 서비스 push 는 **015c** 로 이관(Python 쪽 수신 경로가 아직 없다) — 012c 의 apply 는 앱 소비 키만 다루므로 push 가 필요 없다. ⑤ **Codex C1 CX-2(2026-09-29 채택)**: 위 그림의 "RESTART_REQUIRED 키는 untested 로 표시하고 나머지 키로 testResultId 발급"은 **폐기**한다. `config/test` 는 **변경된 키 전부를 실제로 실행해 검증했을 때만** `testResultId` 를 발급하고(`status:"ok"`), 검증하지 못한 키가 하나라도 있으면 `status:"partial"` + `untestedKeys[]` 이고 **id 가 없다** → 그 후보는 PRODUCTION 에 적용할 수 없다. 또 **012c 의 편집 가능 키에서 RESTART_REQUIRED(·REDEPLOY_REQUIRED) 키를 뺀다**(재기동 전에는 실행 검증이 불가능하므로) — Validate 가 `rule:"restartRequired"` 로 거부. 필요해지면 배포 검증과 묶는 별도 설계(§12-3 은 그 미래 흐름의 예시로만 남긴다).

- Form 편집(`PUT engine-connections/:id`)은 위 4단계를 서버가 한 번에 수행하는 편의 경로이며 결과·기록은 동일하다. Raw JSON `PUT config/raw/:scope/:targetId` 는 `dryRun:true` 로 validate+diff 만, `false` 로 apply 까지.
- Validate 는 절대 저장하지 않는다. Test 는 사용자 데이터·`TtsCache`·`EngineConnection` 을 바꾸지 않고 `RequestTrace(FUNCTIONAL_TEST)`·`EngineHealth(FUNCTIONAL)` 만 남긴다.
- 실패한 Validate/Test/Diff 는 `AuditLog` 를 남기지 않는다(Apply 만 기록). 단 PRODUCTION 대상의 Test 는 `testResultId` 를 `EngineHealth.detail` 로 보존해 Apply 가 참조한다.

### 6-2. Apply 트랜잭션

```pseudo
tx:
  target = SELECT … FOR UPDATE (scope, targetId, environment)
  current = ConfigurationVersion WHERE status=ACTIVE                    # 없으면 version 0 (seed 상태)
  assert current.version == req.baseVersion            → 409 CONFLICT { currentVersion }
  candidate = merge(current.snapshot ?? storedValues(target), req.patch)
  validate(candidate, schema)                           → 400 (재검증; 그 사이 스키마·호스트가 바뀌었을 수 있음)
  if env == PRODUCTION: assertProductionGate(req)        → 403 / 409 (§8)
  UPDATE current SET status=SUPERSEDED, supersededAt=now
  INSERT ConfigurationVersion { environment, scope, targetId, version: current.version+1, snapshot: candidate(SECRET→ref), diff: computeDiff(current.snapshot, candidate), status: ACTIVE, actorUserId, reason, testResult: summary(req.testResultId), restoredFromVersion: null }
  applyToTarget(scope, target, candidate)               # EngineConnection.connection/runtime/credentialRef/logLevel · EngineFallbackPolicy · AppSetting.value · VoiceProfile.defaults · PromptVersion.status
  INSERT AuditLog { action: 'config.apply', scope, targetId, before: current.snapshot, after: candidate, reason, ip, traceId: req.testResult?.traceId }
commit
post-commit:
  cache.invalidate(scope, targetId) ; AppSetting config.cacheEpoch += 1
  runtimeKeys = diff.keys.filter(editability == RUNTIME_EDITABLE)
  if runtimeKeys and target is Python-backed: POST <service>/admin/config/apply {configVersion, connectionKey, patch: runtimeKeys}  # 실패 → EngineHealth(DEGRADED)
  pending = diff.keys.filter(editability in {RESTART_REQUIRED, REDEPLOY_REQUIRED})  # 저장은 됐고 반영은 재시작/재배포 후 — 콘솔 배지 "pending restart"
```

**task-012c 확정(2026-09-29, D-C2·D-C5·D-C7) — 위 의사코드의 구현 규칙**
- **쓰기 조합**: 트랜잭션을 여는 것은 `admin/configuration`(L0)이다. `applyToTarget` 는 대상 **소유 층의 tx 쓰기 함수**(engine = `EngineConnection`·`EngineFallbackPolicy` / preferences = `AppSetting` / speech = `VoiceProfile`)이고, 버전 기록은 `engine.configuration`, 감사는 `infra.audit` — 모두 `infra.withTransaction` 하나(engine 은 speech·preferences 를 import 하지 않는다, module-dependency 규칙 6). `target = SELECT … FOR UPDATE` 는 대상 현재 행, 마지막 방어는 `@@unique(environment, scope, targetId, version)`.
- **첫 적용 기준선**: `current` 가 없으면(`version 0`) 같은 트랜잭션에서 **v1 = `storedValues(target)`(기준선, `_meta.origin=BASELINE`, actor 없음, 감사 `config.baseline`)** 을 먼저 쓰고 적용은 v2 — seed 상태로 Rollback 가능. 기동 시 SYSTEM 버전 일괄 생성(admin-console/06 §11)은 하지 않는다.
- **기록 모양(스키마 0)**: `snapshot` 에 예약 키 `_meta{schemaVersion, origin: BASELINE|APPLY|RAW_JSON|ROLLBACK}`(물화·Diff 제외) · `diff` = 봉투 `{entries[], summary, candidateHash}` · 되돌림 원본 = `restoredFromVersion` · 행위 구분 = `AuditLog.action`(`config.baseline|config.apply|config.raw_apply|config.rollback|credentials.set|credentials.clear`) + `after.versionId`. admin-console/06 의 보조 컬럼(origin·rollbackOfId·importId·effectiveHash·schemaVersion)은 두지 않는다.
- **변경 0**: 후보 == 저장값이면 버전·감사 없음(`changed:false`), rollback 만 `409 NO_CHANGE`.
- **캐시(D-C7)**: 커밋 직후 **적용한 프로세스**의 라우터·Resolver·관련 캐시를 비운다. `config.cacheEpoch` 는 두지 않는다 — pm2 인스턴스 1개라 다른 프로세스는 blue/green 전환 순간뿐이고 기존 30초 TTL 로 따라온다(§13 #9 결정). AppSetting `voice.preview.defaultText` 변경은 같은 트랜잭션에서 `voice.preview.textVersion` +1.
- **서비스 push**: 012c 에서는 하지 않는다(015c, §11).

### 6-3. ConfigurationVersion 상태 전이

```
(seed/없음) ──apply──▶ v1 ACTIVE
v(n) ACTIVE ──apply(v n+1)──▶ v(n) SUPERSEDED, v(n+1) ACTIVE
v(n+1) ACTIVE ──rollback to v(k)──▶ v(n+1) ROLLED_BACK, v(n+2) ACTIVE(restoredFromVersion=k, snapshot=v(k).snapshot)
```

- `ACTIVE` 는 `(environment, scope, targetId)` 당 정확히 1개(앱 트랜잭션으로 보장). 삭제 경로 없음. `SUPERSEDED` 와 `ROLLED_BACK` 의 차이는 "다음 버전이 일반 apply 였는가, rollback 이었는가" 뿐이며 둘 다 다시 Rollback 대상이 될 수 있다.
- **Rollback = 새 버전**(§94): 대상 버전 `snapshot` 을 후보로 §6-1 의 Validate → (PRODUCTION 은 Test) → Diff → Apply 를 그대로 탄다. 스키마가 그 사이 바뀌었으면(`snapshot.schemaVersion < 현재`) 사라진 키는 버리고 새 키는 DEFAULT 로 채우며 `W_SCHEMA_MIGRATED` 경고를 diff 에 남긴다.
- **Rollback 재검증(task-012c D-C6, 2026-09-29 — 발음 사전 Codex C2 교훈)**: 버리는 것은 "지금 스키마에 없는 키"(`droppedKeys` 경고)뿐이다. 남은 키는 **지금의 쓰기 규칙으로 엄격히 재검증**하고(타입·범위·enum·편집성·SECRET 평문·credentialRef 허용 목록·주소 허용 목록), 하나라도 어기거나 스냅샷 모양이 깨졌으면 조용히 버리지 않고 `422 UNPROCESSABLE {reason:E_SNAPSHOT_INTEGRITY, version, integrity: MALFORMED|INVALID_ENTRIES, issues}` 로 거절한다(버전·감사 쓰기 0). 버전 목록은 같은 검사 결과를 `integrity` 로 보여 주고, OK 가 아니면 화면이 되돌리기를 숨긴다. `ROLLED_BACK` = 밀려난 직전 ACTIVE(복원 대상 상태 불변).
- Preset apply·Import 는 항목별로 같은 apply 를 반복한다(항목마다 버전 1개). 하나라도 실패하면 전체 롤백(단일 트랜잭션).
- `PROMPT` scope: `PromptVersion` 자체가 본문 버전이고 `ConfigurationVersion(PROMPT)` 는 "어느 PromptVersion 이 ACTIVE 인가"의 이력이다(`snapshot = {version, checksum}`). Rollback 은 이전 PromptVersion 을 다시 ACTIVE 로.
- `EngineConnection.status`(Health 결과)·`RuntimeOverride`·`logLevel` 의 TTL 복귀는 버전을 만들지 않는다(시스템 전이). `logLevel` 의 영구 변경만 버전을 만든다.

---

## 7. Environment 정책

| 값 | 현재 사용 | 프로세스 | DB 행 |
|---|---|---|---|
| `LOCAL` | **사용** — 맥 미러 개발 서버(`~/.node-local/thekaiwa`, `npm run dev`) | `APP_ENV=LOCAL` | 같은 NAS MariaDB, `environment=LOCAL` |
| `DEVELOPMENT` | 슬롯(미사용) — 우분투 개발 pm2 를 두게 되면 | `APP_ENV=DEVELOPMENT` | `environment=DEVELOPMENT` |
| `STAGING` | 슬롯(미사용) — blue/green 의 대기 슬롯을 스테이징으로 분리하게 되면 | `APP_ENV=STAGING` | `environment=STAGING` |
| `PRODUCTION` | **사용** — 우분투 pm2 blue/green `thekaiwa`(:3010), `thekaiwa-speech-gateway/worker`, M4 tts-service | `APP_ENV=PRODUCTION` | `environment=PRODUCTION` |

- **같은 DB, `environment` 컬럼으로 분리.** 설정 계열 엔티티(`EngineConnection·EngineFallbackPolicy·ConfigurationVersion·RuntimeOverride·AppSetting·PromptVersion·ConfigurationPreset·RequestTrace·AuditLog·DebugSession`) 는 전부 `environment` 를 갖고, 프로세스는 `infra/db` 의 `scoped(env)` 헬퍼로 `where environment = APP_ENV` 를 자동으로 붙인다. 학습 데이터(`User·Chat·WordEntry…`)는 환경 컬럼이 없다(개발·운영 공유는 TheMeal 관례).
- `APP_ENV` 미설정 → 기동 실패(`infra/config` 가 throw). `APP_ENV=PRODUCTION` 인데 `NODE_ENV≠production` 이면 경고. Python 서비스는 같은 값을 env 로 받아 `/health.env` 로 보고하고, 앱은 connection 의 서비스 env 가 앱과 다르면 `MISCONFIGURED(statusReason="service env mismatch")` — 단 **LOCAL 앱 → PRODUCTION M4 tts-service** 는 실제 운영 관행이라 허용하되 콘솔 배지 경고(`admin-console/16` §3).
- seed(`prisma/seed.ts`) 는 `EngineConnection` 6종(key `claude-cli-local·home-m4-lan·reazon-ondevice·reazon-gateway·whisper-voicevault·style-bert-m4`)·`EngineFallbackPolicy` 4역할·`VoiceProfile` 2~3·`AppSetting` 기본을 **LOCAL 과 PRODUCTION 두 환경에 각각** 넣는다(`speech.config.yml` 의 `environments.<env>` 블록으로 baseUrl 만 다름).
- **배지**: 콘솔 상단 Environment 배지(`GET /api/admin/v1/environment`). PRODUCTION 은 경고색 + 적용 버튼 라벨 "PRODUCTION 에 적용". 다른 환경의 행을 보는 중이면 배지에 "viewing: LOCAL" 을 덧붙인다.
- **환경 교차 편집**: 조회는 `?environment=` 로 다른 환경을 볼 수 있으나(SUPER_ADMIN), 변경의 `targetEnvironment` 는 **대상 행의 `environment`** 다. `APP_ENV=LOCAL` 프로세스에서 PRODUCTION 행 편집은 SUPER_ADMIN 만 + `AuditLog.after.crossEnvironment=true`. PRODUCTION 프로세스에서 LOCAL 행 편집은 자유.
- **승격 경로**: LOCAL 에서 검증한 설정을 PRODUCTION 으로 옮기는 정식 경로는 `config/export`(LOCAL) → `config/import`(PRODUCTION, `config.import.production`, §8 흐름). connection 참조는 `key` 로 직렬화되어 환경 간 id 차이를 흡수한다.
- 환경별로 다른 것은 **행의 값**이지 코드·스키마가 아니다. 스키마 `default` 는 환경 무관.

---

## 8. Production 보호 (§96 · `role-permission.md` §6)

`targetEnvironment = PRODUCTION` 인 모든 변경(Apply·Rollback·Import·Preset apply·Prompt activate·Voice disable/delete·Fallback 편집·Credential 연결)에 적용한다.

### 8-1. 고정 흐름

```
Validate ──▶ Functional Test(필수) ──▶ Change Summary(Diff + 영향: restart/redeploy/strict/사용 중 사용자 수) ──▶ SUPER_ADMIN 확인 ──▶ Apply
```

`POST config/apply`(및 rollback/import/activate) 는 PRODUCTION 대상이면 다음을 **모두** 요구한다:

| 필드 | 검증 | 실패 |
|---|---|---|
| `confirm: "PRODUCTION"` | 확인 다이얼로그를 거쳤다는 명시 — **문자열 `"PRODUCTION"`**(task-012c D-C1, 발음 사전과 같은 값. 옛 표기 `confirm:true`) | `403 FORBIDDEN {reason:"PRODUCTION_CONFIRMATION_REQUIRED"}` |
| `summaryHash` | 서버가 **같은 후보로 Diff 를 다시 계산한** 해시와 일치 — 서버는 Diff 를 저장하지 않는다(무상태, 유효 기간 없음). 그 사이 다른 변경이 끼어들거나 후보가 다르면 불일치 | `409 CONFLICT {reason:"SUMMARY_MISMATCH"}` |
| `testResultId` | `config/test` 결과 = `EngineHealth(FUNCTIONAL).id` — `ok:true`·30분 이내·같은 대상·`detail.candidateHash` 일치·**`detail.testedKeys ⊇ 이번 변경 키 전부`**(DB 로 확인). **변경 키 전부를 실제로 실행해 검증한 테스트만 id 를 받는다**(Codex C1 CX-2 — 하나라도 검증 못 하면 `partial`+`untestedKeys`, id 없음 → PRODUCTION 적용 불가). 012c 에서는 RESTART_REQUIRED 키가 애초에 편집 대상이 아니다 | `403 FORBIDDEN {reason:"PRODUCTION_TEST_REQUIRED"}` |
| `reason` | 10~200자(PRODUCTION; 그 외 환경 1~200자), 줄바꿈·제어문자는 공백으로 바꾸고 앞뒤 공백 제거, **비밀 유사 문자열 거부**(Codex C1 CX-3 — 규칙은 `role-permission.md` §7) · 저장은 `AuditLog.reason`·`ConfigurationVersion.reason` 에만, 프로세스 로그에는 싣지 않는다 | 길이 `400` · 비밀 유사 `422 UNPROCESSABLE {reason:"E_REASON_SECRET_LIKE"}` |
| actor | `config.apply.production` 보유 = SUPER_ADMIN. **엄격 키**가 포함되면 요청자 본인이 SUPER_ADMIN 이어야 하며 위임 불가 | `403 FORBIDDEN { missing: ["config.apply.production"] }` |

> **확인 방식 통일(task-012c D-C1, 2026-09-29)**: 이 표가 정본이다. admin-console/16 §6 의 서명 확인 토큰(HMAC, `candidateHash`+actor+10분)은 **폐기**했다 — 같은 보증(확인한 변경 = 적용되는 변경)을 무상태 `summaryHash` 재계산과 DB 의 `testResultId` 로 얻고, blue/green 두 프로세스에서도 그대로 동작한다. 발음 사전(api-contract §7-2a)은 기능 테스트 개념이 없어 `confirm:"PRODUCTION"` + SUPER_ADMIN 만 쓴다.

ADMIN/DEVELOPER 는 PRODUCTION 에서 Validate·Test·Diff 까지 만들고 결과(`summaryHash`·`testResultId`)를 "승인 요청" 으로 남긴다(콘솔 History 의 `pendingProductionApprovals`). 1인 앱에서는 같은 사람이 SUPER_ADMIN 계정으로 확인 단계를 한 번 더 밟는 셈이다.

### 8-2. 엄격 키(strict)

스키마 `strict: true` 또는 아래 분류에 해당하는 키. 변경 시 8-1 흐름 + SUPER_ADMIN 직접 actor + Change Summary 에 빨간 표시.

| 분류 | 키 |
|---|---|
| **Engine** | `EngineConnection.engineId`(변경 불가 — 새 connection 생성으로만), `EngineFallbackPolicy.primaryConnectionId` 의 엔진이 바뀌는 경우 |
| **Model** | `runtime.model`, `runtime.modelIds`, `runtime.tiers.*`, `runtime.defaultVoiceModel`, `connection.modelVersion`, `connection.modelManifestUrl` |
| **Connection** | `connection.baseUrl`, `connection.wsPath`, `connectionType`, `enabled`, `connection.bin` |
| **Credential** | `connection.credentialRef`(`credentials.manage` + SUPER_ADMIN) |
| **Fallback** | `EngineFallbackPolicy.*` 전체 |

비엄격 키(`timeoutMs·retry·beamSize·vad.*·maxChars·sdpRatio·logLevel·AppSetting 일반 키`)도 8-1 흐름은 동일하되 actor 가 SUPER_ADMIN 이면 충분하다(위임 없음).

### 8-3. Override · Debug · Log level

- PRODUCTION `RuntimeOverride` 는 `AppSetting override.production.enabled=false`(기본) 인 동안 `403`. 켜는 것은 `environment.policy`(SUPER_ADMIN) 이며, 켜진 상태에서도 `override.production` + TTL ≤ 30분 + `AuditLog`. SESSION 도 동일.
- PRODUCTION `DebugSession(captureAudio|captureText)` 는 SUPER_ADMIN 만, TTL ≤ `debug.production.maxTtlMinutes`(60), `targetUserId` 필수.
- PRODUCTION 의 `logLevel ∈ {DEBUG, TRACE}` 는 영구 변경 불가 — SUPER_ADMIN 이 30분 TTL `RuntimeOverride(TEMPORARY)` 로만, 만료 시 `INFO`(`loglevel.production.maxLevel`).

### 8-4. Import/Export · Rollback · Voice · Prompt

- PRODUCTION Import 는 `config.import.production` + 항목별 8-1 흐름(`testResultIds` 맵). Export 는 SECRET 을 `credentialRef` 로만 담고 시크릿 패턴 스캔을 통과해야 응답.
- PRODUCTION Rollback 도 Functional Test 필수 — "이전 버전"이 지금 호스트에서 여전히 동작하는지 확인 없이 되돌리지 않는다.
- Voice `disable/delete` 는 사용 중 사용자 수를 Change Summary 에 표시 + SUPER_ADMIN 확인. `activate` 는 Functional TTS 성공이 조건.
- Prompt `activate` 는 회귀 픽스처 테스트(`POST prompts/:key/test {fixture:true}`) 통과 `testResultId` 첨부.

### 8-5. UI·감사

- 배지 경고색, 적용 버튼에 환경명, 확인 다이얼로그에 Diff 요약 + `reason` 입력. 모든 PRODUCTION 변경은 `AuditLog` 에 `environment=PRODUCTION` + `traceId`(테스트) 로 남는다.
- QA 대조: PRODUCTION `ConfigurationVersion` 행마다 `testResult.ok=true` 와 `actorRoleSnap=SUPER_ADMIN` 이 있어야 한다.

---

## 9. Override 규칙 (§106 · §107)

| 항목 | TEMPORARY | SESSION |
|---|---|---|
| 적용 범위 | 환경 전체(모든 요청) — `(environment, scope, targetId)` | `sessionId` 가 일치하는 요청만(헤더 `X-Playground-Session` 또는 `X-Debug-Session`, E2E 실행 컨텍스트) |
| TTL | `ttlMinutes` 1~1,440(24h). PRODUCTION ≤ 30 | 세션(`DebugSession.expiresAt` 또는 Playground 세션 2h) 만료와 동일. 명시 `ttlMinutes` 도 허용(세션보다 짧게만) |
| 허용 키 | `RUNTIME_EDITABLE` 만. RESTART/REDEPLOY/READ_ONLY/SECRET 키는 `400 E_NOT_RUNTIME_EDITABLE` | 동일 |
| 검증 | 스키마 검증(§3-2 validate) + 의존성. 엄격 키(§8-2)라도 RUNTIME_EDITABLE 이면 허용(예: `runtime.tiers.talk`) — 단 PRODUCTION 은 §8-3 게이트 | 동일 |
| Python 서비스 반영 | 생성 즉시 `POST /admin/config/apply` push, 만료·revoke 시 원복 push(앱 스케줄러가 `expiresAt` 1분 전후로 실행) | push 하지 않음 — 세션 요청을 처리하는 앱 프로세스가 요청 컨텍스트에서만 해석(Python 어댑터 호출 시 요청별 파라미터로 전달) |
| 겹침 | 같은 대상에 여러 TEMPORARY: `createdAt` 최신 우선. SESSION > TEMPORARY | — |
| 만료 | `expiresAt` 경과 즉시 무효(Resolver 가 읽을 때 제외) + 캐시 TTL 이 `expiresAt` 에 맞춰 짧아짐. 행은 남는다(이력) | 동일 |
| 해제 | `DELETE /api/admin/v1/overrides/:id` → `revokedAt`. 삭제 없음 | 동일 · 세션 종료(`DELETE debug-sessions/:id`)가 소속 SESSION override 를 일괄 revoke |
| 감사 | 생성·revoke 각각 `AuditLog(override.create|revoke)`; 만료는 기록하지 않음(`expiresAt` 이 이력) | 동일 |
| 버전 | `ConfigurationVersion` 을 만들지 않는다(임시 층). Override 상태에서 Apply 하면 저장값만 바뀌고 Override 는 계속 위에 남는다 — Diff 는 `shadowedBy: RUNTIME_OVERRIDE` 로 경고 | 동일 |
| 콘솔 표시 | Effective 화면에서 `source=RUNTIME_OVERRIDE` 키는 남은 시간과 함께 강조. Overview `activeOverrides` 카운트 | 세션 화면에서만 |

- Override 는 "실험" 이지 "설정" 이 아니다: 24시간을 넘겨야 하는 값은 Apply 로 버전을 만든다. 자동 연장 없음.
- 프로세스 재기동 시 만료 전 TEMPORARY 는 DB 에서 다시 읽혀 유지된다(Python 서비스는 기동 시 `GET /api/internal/speech/config` 로 Override 포함 Effective 를 받는다).
- Playground 요청은 SESSION override 를 쓰지 않고도 요청 본문 `overrideRuntime` 으로 1회성 값을 줄 수 있다(저장·기록 없음, Trace 에만 `overrideKeys` 남김).

---

## 10. Secret 처리 (§51 · §103 · §113, `speech-platform/08-credential-secret-management.md`)

- **저장 형식은 `credentialRef` 문자열 하나뿐**: `env:<NAME>`(`^env:[A-Z0-9_]+$`) 또는 `file:<name>`(`^file:[a-z0-9][a-z0-9.-]{2,63}$`). `file:` 이 기본 권장(회전 시 재기동 불필요), `env:` 는 부팅 전용 값(`SPEECH_INTERNAL_SECRET`, `JWT_SECRET`)에만.
- **해석 위치**: `infra/secrets.SecretResolver.resolve(ref)` — 어댑터가 실제 호출을 만드는 순간에만 호출하고 결과를 요청 객체 밖으로 내보내지 않는다. `file:<name>` → `<SECRETS_DIR>/<name>`(우분투 `/home/brownjeon/apps/thekaiwa/shared/secrets/`, M4 `~/kaiwa-tts-run/secrets/`, LOCAL 은 `KAIWA_SECRETS_DIR`), 디렉토리 `0700`·파일 `0600`·소유자 `brownjeon`. 권한이 넓거나 파일이 없으면 `E_SECRET_PERMISSION/E_SECRET_MISSING` → connection `MISCONFIGURED(statusReason)`; 값은 절대 로그에 남기지 않는다. 메모리 캐시 60초.
- **어디에도 값이 없다**: DB(`EngineConnection.credentialRef` 만, `ConfigurationVersion.snapshot`·`AuditLog.before/after` 는 ref 로 치환), 앱·모바일(`connectionProfileId` 조차 노출하지 않음 — 사용자 API 는 엔진을 모른다), Export(ref 만 + 시크릿 패턴 스캔), Trace/Log(`infra/logging` 마스킹: `sk-`, `Bearer `, 32자 이상 hex/base64 를 `***`), 콘솔 응답(`"***"` 또는 ref 이름).
- Resolver 의 `SECRET` 키 규칙: 어느 층에서 오든 값이 ref 형식이 아니면 그 층 값을 **버리고** `E_CONN_SECRET_VALUE` 경고(평문 의심). env 별칭(`AI_API_KEY`)은 `env:AI_API_KEY` ref 로만 변환.
- 관리자 UI: `GET /api/admin/v1/secrets` 로 ref 이름·존재 여부·`usedBy`·`lastUsedAt` 만. 값을 만들거나 바꾸는 API 는 없다 — 운영자가 서버 파일로 넣고 `PUT engine-connections/:id/credential {credentialRef}` 로 연결(`credentials.manage`, SUPER_ADMIN).
- 회전: 파일 교체 → 캐시 60초 자연 만료(또는 Health 실행으로 즉시 재읽기) → `AuditLog(secret.rotated, targetId=ref)`(값 없음). Python 서비스도 자체 `SecretResolver`(`speech/common/secrets.py`)가 같은 규칙으로 파일을 읽는다 — 앱은 서비스에 ref 만 전달하고 값을 보내지 않는다.
- Claude CLI 는 서버 구독 로그인이라 credentialRef 가 없다(`connection.authMode=SUBSCRIPTION`). 내부 시크릿(`SPEECH_INTERNAL_SECRET`)은 설정 키가 아니라 부팅 env 이며 Resolver 대상이 아니다.
- **편집 선결 게이트(task-012c D-C3, 2026-09-29) — 콘솔에서 주소·자격 키를 바꿀 수 있게 되기 전에 반드시 갖출 것**:
  - (a) **시크릿 전송 대상 고정**: 시크릿(API 키·서비스 시크릿)을 헤더로 보내는 모든 어댑터는 **서버 env 에 적힌 그 서비스의 origin** 과 대상 `connection.baseUrl` 의 origin 이 같을 때만 시크릿을 싣는다. 다르면 호출 자체를 하지 않고 `MISCONFIGURED(TARGET_NOT_ALLOWED)`. TTS 는 task-003d 에서 적용(`infra.readServiceSecretFor`), **home-m4 API 키는 2026-09-29 기준 DB 주소로 그대로 전송 중** — 012c 서버 첫 커밋에서 같은 방식으로 고친다.
  - (b) **credentialRef — 어댑터별 정확한 허용 목록 + 전역 거부 분류**(Codex C1 CX-1, 2026-09-29 채택 — 처음 안 "env 이름 허용 목록"을 대체): ① 각 어댑터 **descriptor 가 자기 연결이 쓸 수 있는 ref 를 정확히 선언**한다(`env:`·`file:` 둘 다, 정확 일치 — 예: home-m4 LLM 어댑터 = 자기 API 키 ref 뿐, TTS 어댑터 = TTS 토큰 파일 ref 뿐). 선언 밖 ref 는 `env:`/`file:` 어느 쪽이든 거부 — 그래서 한 서비스의 시크릿을 다른 연결에 끼워 다른 주소로 보내는 교차 사용이 막힌다(origin 고정 (a) 만으로는 같은 LAN 서비스끼리의 교차를 못 막는다). ② **전역 거부 분류**는 descriptor 보다 먼저 검사하는 이중 방어다 — 부팅·내부 시크릿(세션 서명 키·내부 서비스 시크릿·TTS 서비스 시크릿·DB 접속 문자열·OAuth 클라이언트 시크릿·초대코드·그 밖의 서버 전용 env 와 같은 이름의 `file:`)을 가리키는 ref 는 descriptor 가 실수로 허용해도 거부. ③ 위반은 `422 UNPROCESSABLE {reason:"E_REF_NOT_ALLOWED"}`(Validate 응답에서는 `rule:"refNotAllowed"`), 응답·감사·로그에 ref 외 값 없음. 형식(`env:`/`file:` 정규식)·존재 확인은 그 뒤. ④ 스키마 메타는 SECRET_REF 키에 `allowedRefs[]`(admin-console/03 §3), 화면의 ref 선택지는 `allowedRefs ∩ 존재하는 ref`.
  - (c) **연결 주소 호스트 허용 목록**: loopback·LAN(`192.168.219.0/24`)·서버 env 에 적힌 서비스 origin 만. userinfo·비 http(s)·리다이렉트 추종 금지. Validate(편집)·Health·Functional Test·실호출 공통(`hostNotAllowed`).
  - 세 가지가 구현·테스트되기 전에는 `connection.baseUrl`·`wsPath`·`credentialRef` 편집 API 를 열지 않는다. Codex C1 채택분(CX-1 위 (b) · CX-2 실행 검증 전 키에만 `testResultId` · CX-3 `reason` 검사)도 함께 들어가야 게이트를 연다. `connection.binPath` 는 spawn 에 쓰지 않는다(READ_ONLY, 실행 파일은 서버 env 만).

---

## 11. Python 서비스 반영 (gateway · worker · tts-service)

| Editability | 앱 동작(Apply 후) | 서비스 동작 | 운영자·deployer 동작 |
|---|---|---|---|
| `RUNTIME_EDITABLE` | 커밋 후 `POST <service>/admin/config/apply { configVersion, connectionKey, patch }`(RUNTIME_EDITABLE 키만). 실패 → `EngineHealth(DEGRADED, "config push failed")` + 재시도 3회(10s·30s·2m) | 검증 후 즉시 반영, `applied[]/rejected[]` 응답. `GET /admin/config/effective` 로 실제 값 노출 | 없음. 콘솔 `applied.pushedToService` 확인 |
| `RESTART_REQUIRED` | 값 저장 + 응답 `restartRequired[]`·`restartTarget`(`thekaiwa-speech-gateway` / `thekaiwa-speech-worker` / `tts-service` / `app`). 콘솔 배지 "pending restart", Overview 경고 | 재기동 시 `GET /api/internal/speech/config?role=&connectionKey=` 로 Effective 를 받아 부팅(모델 로드 등). 재기동 전까지 이전 값 유지 → `effectiveDiffers` 표시 | deployer: 우분투 `pm2 restart <target>` (배포 절차서 `docs/deploy-order.md`), M4 tts-service 는 사용자 승인 후 재기동. 재기동 후 Health 가 `configVersion` 일치를 확인하면 배지 해제 |
| `REDEPLOY_REQUIRED` | 값 저장 + `redeployRequired[]`. 콘솔 배지 "pending deploy" | 배포된 코드/파일이 바뀌어야 의미 있음(`connection.modelManifestUrl`, `connection.authMode`) | deployer: `scripts/deploy.sh TheKaiwa`(+ 모델 파일 배치·nginx). 배포 후 Health 확인 |
| `READ_ONLY` | 변경 불가(Validate 거부) | — | developer: 코드 수정·재배포 |
| `SECRET` | `credentialRef` 만 저장, push 는 ref 문자열 | 자체 SecretResolver 로 파일 읽기 | 운영자: 서버 파일 교체(§10) |

- 부팅 순서(서비스): `speech.config.yml` 로드 → `APP_ENV` 확인 → `GET /api/internal/speech/config` 시도(3회) → 성공 시 Effective 로 덮어쓰기, 실패 시 yml+env 로 **degraded 부팅**(`/health.configSource="APPLICATION_CONFIG"`) → 모델 로드 → `/health.ok=true`. 앱은 Health 응답의 `configVersion` 이 자기 것과 다르면 `effectiveDiffers` 를 계산해 콘솔에 표시.
- 서비스는 DB 를 직접 읽지 않는다(worker 의 `SpeechJob` 큐 폴링은 예외 — 설정이 아니라 잡). 설정의 진실은 앱 Resolver 하나다.
- **구현 현황·이관(task-012c D-C10, 2026-09-29)**: 이 절의 서비스 반영(`POST /admin/config/apply` push·부팅 시 `GET /api/internal/speech/config`·`/admin/log-level`)은 gateway·worker·tts-service 어디에도 아직 없다 — 지금 Python 서비스는 자기 `speech.config.yml`+env 로만 기동한다. **015c(Console P3)** 에서 Log level 과 함께 배선한다. 그 전까지(012c) Python 이 읽는 키는 콘솔 편집 대상이 아니다(`serviceManaged` 거부) — 저장해도 서비스가 읽지 않아 "콘솔 값 ≠ 실제 값" 이 되기 때문.
- ONDEVICE connection(`reazon-ondevice`)은 Python 서비스가 아니라 **앱 클라이언트**가 대상이다: RUNTIME_EDITABLE 키는 `GET /api/v1/speech/config`(ETag `configVersion`) 로 다음 앱 기동·포그라운드 복귀 시 플러그인 `start` 옵션에 반영, `connection.modelVersion`(RESTART_REQUIRED) 은 manifest 재다운로드로 "재시작" 이 대체된다.
- 로그 레벨: `PUT engine-connections/:id/log-level` → `POST <service>/admin/log-level {level, expiresAt?}`. TTL 은 서비스 자체 타이머로 복귀하고 앱도 만료 시 한 번 더 `INFO` 를 push(이중 안전).

---

## 12. 예시 3개

### 12-1. `runtime.cpuThreads` — env 가 yml 을 덮는 경우 (§83 threads 사례)

| 층 | 값 | sourceRef |
|---|---|---|
| DEFAULT | 4 | `schema:faster-whisper@3#runtime.cpuThreads` |
| APPLICATION_CONFIG | 8 | `file:speech.config.yml#connections[whisper-voicevault].runtime.cpuThreads` |
| ENVIRONMENT | **4** | `env:KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS` (pm2 ecosystem 에 남아 있던 값) |
| DATABASE | — | (관리자가 아직 편집한 적 없음) |

Effective = **4, source=ENVIRONMENT**. 콘솔 Effective 화면: `runtime.cpuThreads 4 · ENVIRONMENT · env:KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS` + 접힌 `layers` 에 `APPLICATION_CONFIG=8 (가려짐)`. 관리자가 콘솔에서 8 로 Apply 하려 하면 Diff 가 `shadowedBy: ENVIRONMENT` 를 경고한다 — DATABASE(5)는 ENVIRONMENT(4)보다 높으므로 실제로는 Apply 후 Effective 가 8 이 된다(**DATABASE 가 env 를 덮는다**; env 는 "호스트 기본", DB 는 "관리자 결정"). 반대로 env 로 강제하고 싶은 값은 ENVIRONMENT 가 아니라 `READ_ONLY` 스키마나 코드 상수로 고정해야 한다. 이 키는 RESTART_REQUIRED 이므로 Apply 응답에 `restartTarget: thekaiwa-speech-worker` 가 오고 deployer 재기동 전까지 worker `/admin/config/effective` 는 4 를 보고한다(`effectiveDiffers`).

### 12-2. TTS `speed` — 사용자 설정 vs Voice Profile 기본 (§85)

| 순위 | 원천 | speed | style |
|---|---|---|---|
| 5 | LLM `speech.style=ENCOURAGING` | — | `Friendly`(매핑) |
| 4 | Conversation context(TALK) | — | — |
| 3 | Persona hint | ≤1.0 | `Friendly` |
| 2 | VoiceProfile `teacher_haruka.defaults` | 0.9 | `Friendly` |
| 1 | UserVoiceSetting | **0.8** | `AUTO`(미지정) |

결과: `speed=0.8 (USER_SETTING)`, `style=Friendly (VOICE_PROFILE)`, `speaker/model=teacher_haruka (VOICE_PROFILE)`, `pitch=1.0 (VOICE_PROFILE)`. 콘솔 `config/effective?scope=VOICE_PROFILE&targetId=teacher_haruka&context=user:u_…` 는 `speed: { value: 0.8, source: USER_SETTING, layers: [DEFAULT 1.0, VOICE_PROFILE 0.9, USER_SETTING 0.8] }` 로 표시한다. 사용자가 설정에서 speed 를 `AUTO` 로 되돌리면 0.9(VOICE_PROFILE), voice 기본도 없으면 1.0(DEFAULT). LLM 이 `speech.style=CHEERFUL` 을 내도 사용자가 `style=Calm` 을 골랐으면 `Calm` 이다. 캐시 키는 해석 결과(0.8·Friendly…)로 만들어지므로 같은 결과를 내는 다른 사용자와 캐시를 공유한다.

### 12-3. `runtime.model` — whisper 모델 변경(RESTART_REQUIRED) in PRODUCTION

> **2026-09-29 task-012c(Codex C1 CX-2)**: 아래는 **미래 흐름의 예시**다. 012c 에서는 RESTART_REQUIRED 키가 콘솔 편집 대상이 아니고(Validate `rule:restartRequired`), 3번처럼 `untested` 가 있는 테스트는 `testResultId` 를 받지 못한다(`partial`). 이 흐름을 열려면 "재기동 후 실행 검증"을 묶는 별도 설계가 필요하다(015c 이후).

1. DEVELOPER 가 콘솔 Configuration › `whisper-voicevault` Form 에서 `runtime.model: medium → large-v3-turbo` 입력.
2. `POST config/validate` → `valid:true`, `impact.restartRequired=["runtime.model"]`, `impact.strict=["Model"]`, 경고 `W_RESTART_REQUIRED(thekaiwa-speech-worker)`; `connectionType=HTTP` 인 `whisper-voicevault` 는 `editabilityBy.HTTP=READ_ONLY` 라 실제로는 **`E_READ_ONLY`** 로 거부된다 — 모델은 whisper-service(VoiceVault) 쪽 설정이기 때문. 관리자는 대신 LOCAL connection `whisper-local`(connectionType LOCAL, worker 내장 faster-whisper) 을 대상으로 다시 시도한다.
3. `whisper-local` 대상 `validate` 통과 → `POST config/test` → 모델 교체는 재기동 전 반영 불가라 `untested=["runtime.model"]`, 나머지 키로 STT 샘플 전사 성공 `testResultId=eh_…`.
4. `POST config/diff` → `changes=[{runtime.model: medium→large-v3-turbo, editability: RESTART_REQUIRED, strict:true}]`, `summaryHash`, `productionProtected:true, requiredConfirm: SUPER_ADMIN`.
5. DEVELOPER 는 여기서 멈추고 "승인 요청"(pending). SUPER_ADMIN 이 History 에서 열어 Change Summary 확인 → `POST config/apply { patch, baseVersion:7, reason:"정확도 부족 — 실측 게이트 ④", confirm:true, summaryHash, testResultId }`.
6. 트랜잭션: v7 `SUPERSEDED` → v8 `ACTIVE(snapshot, diff, testResult, actor=SUPER_ADMIN)` → `EngineConnection.runtime.model` 갱신 → `AuditLog(config.apply)`. 응답 `applied.restartRequired=["runtime.model"], restartTarget="thekaiwa-speech-worker", pushedToService:false`.
7. 콘솔 배지 "pending restart(worker)". deployer 가 `pm2 restart thekaiwa-speech-worker` → worker 기동 시 `GET /api/internal/speech/config?role=ANALYSIS_STT&connectionKey=whisper-local` 로 v8 Effective 수신 → large-v3-turbo 로드(메모리 ↑) → `/health.configVersion=cfgv_v8`. 앱 Health(5분) 가 일치를 확인하면 배지 해제.
8. 메모리 초과로 되돌려야 하면 `POST config/versions/<v7>/rollback { reason, confirm:true, testResultId }` → v8 `ROLLED_BACK`, v9 `ACTIVE(restoredFromVersion=7)` → 다시 재기동.

---

## 13. 미결 (Open Questions)

| # | 항목 | 현재 가정 | 결정 시점 |
|---|---|---|---|
| 1 | `VoiceProfile.defaults` 를 Effective 화면에서 `DATABASE` 로 표기할지 별도 `VOICE_PROFILE` 표시명을 쓸지(§85 는 "Voice Profile") | enum 은 8개 그대로, `scope=VOICE_PROFILE` + `sourceRef=db:VoiceProfile[…]` 로 구분 표시 | task-005b UI |
| 2 | `DATABASE`(5) 와 `CONNECTION_PROFILE`(6) 을 합칠지 — 같은 대상이면 값이 같고 `sourceRef` 만 다름 | 기획 §83 의 8개 Source 를 유지, 6 은 "역할→connection 선택 결과" 의미로 남김 | 구현 후 콘솔 가독성 검토 |
| 3 | ENVIRONMENT 가 DATABASE 보다 **낮은** 순서(관리자 결정이 env 를 덮음)가 운영 관행과 맞는지 — 호스트 고정값을 env 로 강제하고 싶은 경우 | 강제값은 READ_ONLY 스키마/코드 상수로. 필요 시 `KAIWA_LOCK_<KEY>=1` 잠금 플래그 검토 | Phase 2 |
| 4 | env 명명 `KAIWA_<ROLE>_<KEY_PATH>` 와 기존 짧은 별칭(`SPEECH_THREADS` 등) 공존 기간 | 별칭 표 유지, `.env.example` 은 `KAIWA_*` 로 기재, 1 Phase 뒤 별칭 제거 | task-002 `.env.example` |
| 5 | ONDEVICE connection 의 "재시작" 정의(앱 재기동 vs 포그라운드 복귀 vs 즉시 push) | 포그라운드 복귀 시 `configVersion` ETag 비교 → 변경 시 플러그인 `release()`→`start()` 재적용 | task-003 실측 |
| 6 | Python 서비스 push 실패 시 버전을 유지할지(현 설계) vs 자동 롤백 | 유지 + `DEGRADED` + `effectiveDiffers`, 자동 롤백 없음(운영자 판단) | **015c**(push 자체가 015c 로 이관 — task-012c D-C10) |
| 7 | SESSION override 를 Python 어댑터 호출에 요청별 파라미터로 전달하는 범위(모든 RUNTIME_EDITABLE 키를 요청마다 실을 수 없음) | 어댑터 요청 스키마에 `runtimeOverride` 슬롯을 두고 서비스가 지원하는 키만(`beamSize·vad.*·sdpRatio·noise*`) 허용 | **task-016**(Override 와 함께 — task-012c D-C10 로 012c 에서 이관) |
| 8 | 스키마 `schemaVersion` 상향 시 기존 `ConfigurationVersion.snapshot` 마이그레이션(키 rename) 규칙 | rename 은 `deprecatedSince` + `renamedTo` 로 1 Phase 자동 매핑 | 첫 스키마 변경 시 |
| 9 | `config.cacheEpoch` 기반 blue/green 두 슬롯 교차 무효화의 지연(최대 5분 TTL) 허용 여부 | **결정(task-012c D-C7, 2026-09-29)**: `cacheEpoch` 를 두지 않는다. 적용한 프로세스는 즉시 무효화, 다른 프로세스(blue/green 전환 순간)는 기존 캐시 TTL 30초로 따라온다. 즉시성이 필요해지면 Redis pub/sub(사용자 sudo) | ✅ 012c |
| 10 | `runtime.modelIds` 의 실제 Claude 모델 id 문자열(예시는 자리표시) | prompt-engineer 가 task-004 실측 시 확정, seed 에 반영 | task-004 |
| 11 | `APP_SETTING` 정책 키의 스키마를 코드 상수로 둘지 DB 로 둘지 | 코드 `appSettingSchema.ts`(DEFAULT 층), 값만 DB — task-012c 가 일반 키(타입·범위·editability·소비자)로 만든다, 정책 키 편집은 Phase 4 | 012c |
