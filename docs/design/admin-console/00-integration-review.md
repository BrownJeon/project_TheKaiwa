# 00. 통합 검토 — Admin/Developer AI Engine Console 과 기존 도메인의 정합

> 원문: `../../관리자콘솔-기획안-원본.md` §78~§128 · 계획 §9-C. 정본: `../domain-model.md`(엔티티·Prisma) · `../api-contract.md`(API) · `../configuration-resolution.md`(설정 해석) · `../role-permission.md`(권한) · `../module-dependency.md`(모듈). 이 문서는 정본을 인용만 하고 재정의하지 않는다.

## 1. 목적

세 번째 기획안(§78~§128)이 요구하는 Console·Configuration·Trace·Prompt Registry 를 **기존 설계(§8 AI 연동·§9 음성 스택·§9-B Voice/Engine 관리·§4 6층 구조)** 에 병합할 때 생기는 충돌 7건을 확정 해소하고, §122 권장 모듈을 6층 구조에 대응시키며, 기존 엔티티에 가해진 변경을 한 곳에 적는다. `01~16` 문서는 이 해소 결과를 전제로 쓴다.

## 2. 범위

- 포함: 충돌 표(7행)·해소, §122 → 6층 매핑, `Role`·`ChatMessage.toolLog`·`speech.config.yml` 취급 변경, Console→Admin API→Engine 경로(§121·§127).
- 제외: 각 엔티티 필드 정의(`../domain-model.md`), 엔드포인트 계약(`../api-contract.md`), 8층 해석 알고리즘(`../configuration-resolution.md` §3, 요약은 `04`·`05`).

## 3. 충돌 검토표 (계획 §9-C 확정)

| # | 기존 설계 | 추가 기획안 | 해소 |
|---|---|---|---|
| 1 | `Role {OWNER, MEMBER}`, Advanced·Voice 관리 = OWNER 전용 | `USER / ADMIN / DEVELOPER / SUPER_ADMIN`(§79) | `Role` enum 을 4단계로 교체, `OWNER_EMAIL` 시드 계정 = `SUPER_ADMIN`, 신규 가입 기본 `USER`. **검사는 role 이 아니라 capability**(`can(user,'config.edit')`, 정본 `../role-permission.md`, Console 관점 요약 `02`) |
| 2 | Descriptor(코드)+Connection(DB), `speech.config.yml` 은 seed 전용 | Configuration Registry·Resolver·다층 Source·Effective Configuration(§82~§85·§126) | yaml 을 seed 가 아니라 Resolver 의 **`APPLICATION_CONFIG` 층**으로 승격. 우선순위 8층 `DEFAULT → SOURCE_CODE → APPLICATION_CONFIG → ENVIRONMENT → DATABASE → CONNECTION_PROFILE → USER_SETTING → RUNTIME_OVERRIDE`. Resolver 는 키마다 `{value, source, sourceRef, editability}` 를 반환하고 Console 이 그대로 표시(`04`·`05`) |
| 3 | 프롬프트 = `src/modules/conversation/prompts/**` 코드 + `.claude/agents/tutor.md`(prompt-engineer 소유) | Prompt Registry·Versioning·Test(§118~§120) | 파일은 `SOURCE_CODE` 층의 **v0**, DB `PromptVersion` 이 ACTIVE 이면 런타임 우선. `npm run prompts:sync` 가 파일→DB 새 버전(`source=SOURCE_CODE`), Console 편집은 `source=CONSOLE` 버전만 생성. `tutor.md` 는 key `teacher-persona`(`14`) |
| 4 | 개발·운영이 같은 NAS MariaDB | Environment 분리·Production 보호(§95·§96) | 설정 엔티티 전부 `environment` 컬럼, 프로세스는 `APP_ENV` 행만 읽음. 현재는 `LOCAL`·`PRODUCTION` 두 값만 사용(`DEVELOPMENT`·`STAGING` 은 슬롯). Production 변경 = Validate→Test→Diff(Change Summary)→**SUPER_ADMIN 확인**→Apply, 임시 Override 는 Production 기본 비활성(`16`) |
| 5 | `ChatMessage.toolLog{sttMs,llmMs,ttsMs…}` | Request Trace(§110)·Diagnostics(§111) | `RequestTrace` 테이블 신설, `toolLog` 는 `{traceId, …요약}` 으로 축소. 원음·전체 대화 텍스트는 Trace 에 저장하지 않고 명시적 `DebugSession` 에서만(`13`·`15`) |
| 6 | Health = `EngineHealth` 최근 N건 | 평균 지연·요청 수·오류 수·메모리·Log level(§111·§112) | 지연·건수·오류는 `RequestTrace` 집계(`EngineMetricsDaily` 물화), 메모리·모델 로드 여부는 각 Python 서비스 `GET /health` 응답. `logLevel` 은 Connection 의 `RUNTIME_EDITABLE` 키, Python 은 `POST /admin/log-level` 로 반영(`15`) |
| 7 | §4 6층 구조 | §122 backend 모듈(speech/voice/llm/admin/common) | 6층 유지 + **`src/modules/admin/`**(app 층 조합 모듈) 신설. 나머지는 아래 §4 표대로 기존 층에 흡수 |

## 4. §122 권장 모듈 → 6층 구조 매핑

| §122 모듈 | 대응 위치 | 층 | 비고 |
|---|---|---|---|
| `speech.engine` · `speech.registry` | `src/modules/engine/registry/{descriptors,schemas,plugins}` | L5 engine | Descriptor·Schema 는 코드, `Engine` 테이블은 기동 시 스냅샷 |
| `speech.router` | `src/modules/engine/router`, `fallbackPolicy` | L5 engine | 역할별 `EngineFallbackPolicy` 순회 |
| `speech.connection` | `src/modules/engine/connections`, `credentials`, `health`, `functionalTest` | L5 engine | `credentialRef` 만 저장 |
| `speech.configuration` | `src/modules/engine/configuration/{resolver,versions,overrides,validate,diff}` | L5 engine | Console 이 아니라 engine 층이 소유 — 런타임도 같은 resolver 사용 |
| `voice.{registry,profile,preview,import}` | `src/modules/speech/voices/{registry,profiles,preview,importJobs}` | L4 speech | M4 `tts-service/admin/*` 와 짝 |
| `llm.engine` · `llm.configuration` | `src/modules/engine/adapters/llm/{claudeCli,homeM4}` + `engine/configuration` | L5 engine | LLM 도 `Engine.type=LLM` 으로 편입 |
| `llm.prompt` · `llm.registry` | `src/modules/conversation/{prompts,promptRegistry}` | L2 conversation | 파일 v0 + DB `PromptVersion` ACTIVE 해석 |
| `admin.configuration` | `src/modules/admin/configuration`(editor·diff·versions·rollback·presets·export/import·overrides 조합) | L0 admin | engine 층 API 를 조합만, 자체 해석 로직 없음 |
| `admin.diagnostics` | `src/modules/admin/diagnostics` | L0 admin | health + metrics + service `/health` 합성 |
| `admin.playground` | `src/modules/admin/playground`(stt·tts·llm·e2e) | L0 admin | L2 conversation 과 L4 speech 를 **admin 이 조합**(라우트 조합 원칙 §4) |
| `admin.audit` | `src/modules/admin/audit`(조회) + `src/modules/infra/audit`(기록) | L0 / L6 | 기록은 infra, 조회·필터는 admin |
| (신설) | `src/modules/admin/{console, permissions}` | L0 admin | overview 집계, `can()` capability 검사 |
| `common.secret` | `src/modules/infra/secrets`(SecretResolver `env:`/`file:`) | L6 infra | |
| `common.validation` | `src/modules/infra/validation` + `engine/configuration/validate` | L6 / L5 | JSON 문법·공통 규칙은 infra, 스키마·의존성 검증은 engine |
| `common.audit` | `src/modules/infra/audit` | L6 infra | `AuditLog` 기록 유일 진입점 |

의존 방향은 `../module-dependency.md` 의 `app(+admin) → {preferences, conversation, learning, speech} → engine → infra` 를 그대로 따른다. `admin` 은 모든 층을 import 할 수 있는 유일한 모듈이고, 어떤 하위 층도 `admin` 을 알지 못한다.

## 5. 기존 엔티티에 가해진 변경 (정본 `../domain-model.md` 기준 요약)

| 엔티티 | 변경 | 이유 |
|---|---|---|
| `User.role` | `Role {USER, ADMIN, DEVELOPER, SUPER_ADMIN}` (`@default(USER)`), 시드 `OWNER_EMAIL` → `SUPER_ADMIN` | 충돌 1 |
| `ChatMessage.toolLog` | `{traceId, vadMs, sttMs, llmMs, ttsMs, ttsStartMs, connectionIds{stt,llm,tts}}` 요약만. 단계 상세는 `RequestTrace.steps` | 충돌 5 |
| `Utterance.realtimeEngine` | 유지, 추가로 `traceId` 참조(선택) | Trace 와 발화 연결 |
| `EngineConnection` | `connection`/`runtime` Json 은 **CONNECTION_PROFILE 층의 저장소**로 유지, 변경은 반드시 `ConfigurationVersion` 을 거쳐 물화 | 충돌 2 |
| `AppSetting` | `environment` 컬럼 추가, `override.production.enabled`·`log.production.maxLevel` 등 정책 키 수용 | 충돌 4·6 |
| `speech.config.yml` | seed 전용 → **APPLICATION_CONFIG 층**(런타임에 읽음). 첫 기동 시 Connection 행이 없으면 identity(id·engineId·role·connectionType) 만 생성, 값은 층으로 해석 | 충돌 2 |
| 신설 | `ConfigurationVersion`, `RuntimeOverride`, `RequestTrace`, `EngineMetricsDaily`, `ConfigurationPreset`, `DebugSession`, `AuditLog`, `PromptTemplate`, `PromptVersion` | 계획 §9-C |

## 6. 호출 경로 (§121·§127)

```mermaid
flowchart LR
  C[Console (admin) 라우트] --> A[/api/admin/v1/* 라우트: 인증·capability·검증만/]
  A --> M[modules/admin: configuration·diagnostics·playground·audit]
  M --> E[modules/engine: registry·connections·configuration·router·health]
  E --> AD[engine/adapters: stt·tts·llm]
  AD --> S[Python gateway :8100 / worker / M4 tts-service :8200 / Claude CLI]
  M -.집계.-> T[(RequestTrace · EngineMetricsDaily)]
  M -.기록.-> L[(ConfigurationVersion · AuditLog)]
```

Console 은 엔진을 직접 호출하지 않는다. 사용자 API(`/api/v1`)와 Admin API(`/api/admin/v1`)는 라우트 파일·capability·응답 형식(`{success,data,message}`)까지 분리하되 같은 `modules/engine` 을 공유한다.

## 7. Phase 배치 (계획 §9-C)

| Phase | 이 절에서 확정된 것 중 구현 대상 |
|---|---|
| 1 | Role 4단계·capability·`(admin)` 골격·Effective Config 읽기·Source 표시·Plugins·Health·Functional Test·Trace 저장 |
| 2 | Form/JSON 편집·Validate/Test/Diff/Apply·ConfigurationVersion·History·Rollback·Prompt Registry·Playground(STT/TTS/LLM) |
| 3 | E2E·Diagnostics 메트릭·Debug session·Log level |
| 4 | Presets·Export/Import·Temporary/Session Override·Admin Web 분리 검토 |

> **2026-09-29 task-012c(C1 확정)** — Phase 2 를 세 task 로 나눴다: **012c** = Form/JSON 편집·Validate/Test/Diff/Apply·ConfigurationVersion·History(버전·감사)·Rollback·credentialRef 연결·Fallback·AppSetting·VoiceProfile 기본값 · **012c-2** = Prompt Registry(A안 — `14` 머리 참고)·Playground · **012c-3** = TTS Quality·TTS 대시보드. 정본 Phase 2 표에서 빠진 것: 연결 생성·삭제 → 4, Python 서비스 설정 push·Log level·Health 스케줄 → 3(015c), SESSION override 슬롯 → 4(016). Voice Versions·Canary 는 사용자 결정 대기(U-C1). 근거·결정 D-C1~D-C13 은 `agent-vault/10-Flow/tasks/task-012c-console-p2.md`.

## 8. 검증 규칙

- `01~16` 이 §128 항목 1~16 과 번호 1:1 로 대응하고, 각 문서가 이 표의 해소 결과와 모순되지 않는다.
- 이 문서와 `../configuration-resolution.md` 의 8층 순서가 동일하다. 다르면 정본이 이긴다.
- `../role-permission.md` 의 capability 이름과 `02`·`../api-contract.md` 의 admin 엔드포인트 표기가 grep 으로 일치한다.

## 9. 미결

- `DEVELOPMENT`·`STAGING` 슬롯을 실제 사용할 시점(별도 dev DB 도입 여부)은 운영 후 결정.
- `CONNECTION_PROFILE` 층(EngineConnection Json)과 `DATABASE` 층(그 외 DB 설정)의 경계는 `04` §3 정의를 따르되, `../configuration-resolution.md` 와 상충하면 정본으로 통일.
- Admin Web 독립 분리 시 인증 쿠키 도메인·CORS 는 Phase 4 검토(`01` §7).
