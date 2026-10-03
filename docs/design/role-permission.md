# TheKaiwa — 역할·권한 정본 (role-permission.md)

> 작성일 2026-09-26 · 상태: **설계 확정 대기** · 원문 근거: `docs/관리자콘솔-기획안-원본.md` §79·§96·§103·§104·§106·§112·§113·§124·§125, 추가 기획안 §51·§62 · 엔티티 정본: `docs/design/domain-model.md`(`Role`, `Environment`, `AuditLog`, `AppSetting`, `RuntimeOverride`, `DebugSession`)

## 0. 목적

- 일반 사용자 설정과 관리자/개발자 Console 을 분리하고(§78·§124), **권한 검사를 `role` 비교가 아니라 capability 매트릭스**로 고정한다. 라우트·화면·API 는 "이 역할이면"이 아니라 "이 capability 가 있으면"으로만 판단한다.
- 1인 앱이지만 매트릭스를 데이터(코드 상수 + 이 문서)로 두어, 나중에 Admin Web 을 분리하거나 계정을 늘려도 규칙이 바뀌지 않게 한다.
- `api-contract.md` 의 각 `/api/admin/v1/*` 엔드포인트는 이 문서의 capability 이름을 그대로 표기한다. `module-dependency.md` 의 `src/modules/admin/permissions` 가 구현 위치다.

## 1. Role 4단계

`Role { USER ADMIN DEVELOPER SUPER_ADMIN }` (domain-model.md §3). **누적 구조**: 상위 역할은 하위 역할의 capability 를 모두 포함한다.

| Role | 대상 | 권한 요약(§79) | 부여 방법 |
|---|---|---|---|
| `USER` | 일반 학습자 | 자기 설정(학습·AI 선생님·음성 인식)·미리듣기·학습 기능. Console 없음(`/admin/**` 404) | 초대코드 가입 기본값 |
| `ADMIN` | 운영자 | + Voice 관리, Engine/Connection 조회·생성·편집(Form), Health·Functional Test, Fallback 편집, 감사 로그 조회 | SUPER_ADMIN 이 `PATCH /api/admin/v1/users/{id}/role` (AuditLog) |
| `DEVELOPER` | 개발자 | + Effective Configuration·Source·Raw JSON·Schema·Plugin 상세·Trace·Playground·E2E·Override·Preset·Export/Import(비Production)·Prompt Registry·Log level·Debug session | 동일 |
| `SUPER_ADMIN` | 소유자 | + Credential ref 연결, Environment 정책, **PRODUCTION 변경 승인·적용**, Production Import, Production Override 게이트, Production Debug session, 역할 부여 | **`OWNER_EMAIL` 시드 계정 = SUPER_ADMIN**(`prisma/seed.ts`). 1인 앱에서는 소유자 = SUPER_ADMIN 1명 |

- 역할 변경은 SUPER_ADMIN 만, 자기 자신의 역할 강등은 거부(마지막 SUPER_ADMIN 보호).
- `role` 은 세션 JWT 에 넣지 않고 요청마다 DB 에서 읽는다(역할 변경 즉시 반영, 토큰 위조 무의미).

## 2. Capability 목록

이름 규약 `<자원>.<동작>`. `AuditLog.action` 도 같은 문자열을 쓴다.

| capability | 의미 | 대상 자원(domain-model) |
|---|---|---|
| `settings.read` | 자기 학습·음성 설정 조회 | `Profile`, `UserVoiceSetting`, `UserSpeechSetting` |
| `settings.write` | 자기 설정 변경 | 동일 |
| `voices.read` | 선택 가능한 Voice 목록·통합 미리듣기(draft, LLM 없음) | `VoiceProfile(AVAILABLE&&enabled)`, `VoiceStyle`, `TtsCache` |
| `voices.manage` | Voice 등록·편집·activate/disable/delete·sync·Import·Admin Preview Playground | `VoiceProfile`, `VoiceModel`, `VoiceStyle`, `VoiceImportJob` |
| `engine.read` | Engine 목록·Connection 목록·상태·최근 Health·Dashboard | `Engine`, `EngineConnection`(credentialRef 는 이름만), `EngineHealth` |
| `engine.connections.manage` | Connection 생성·편집(Form)·enable/disable·삭제, Fallback 편집 | `EngineConnection`, `EngineFallbackPolicy` (→ `ConfigurationVersion`) |
| `config.effective.read` | Effective Configuration + 키별 Source 표시(§82·§83) | Resolver 응답, `ConfigurationVersion` 목록 |
| `config.raw.read` | Raw JSON 조회·Configuration Schema·Plugin 기본값(§89·§86) | 동일 |
| `config.edit` | Validate→Test→Diff→Apply(Form/JSON), `AppSetting` 편집, Log level | `ConfigurationVersion`, `AppSetting`, `EngineConnection.logLevel` |
| `config.apply.production` | `environment=PRODUCTION` 대상의 Apply·Rollback·Prompt activate·Voice disable/delete 최종 확인(§96) | `ConfigurationVersion(PRODUCTION)` |
| `config.rollback` | 이전 버전으로 Rollback(새 버전 생성, §94) | `ConfigurationVersion` |
| `credentials.manage` | `credentialRef` 연결·교체·해제(값은 서버 파일/env, 화면에 값 입력 없음, §51) | `EngineConnection.credentialRef` |
| `secrets.read_ref` | ref 이름·존재 여부·마지막 사용 시각 조회(값 없음) | `GET /api/admin/v1/secrets` |
| `plugins.read` | Plugin 상세(descriptor·schema·capabilities·loaded·initError, §97~§99) | `Engine` + 코드 디스크립터 |
| `health.run` | Health Check 수동 실행 | `EngineHealth(HEALTH)` |
| `functional_test.run` | Functional Test 실행(TTS 고정 문장·STT 샘플 wav·LLM 스키마 1회) | `EngineHealth(FUNCTIONAL)`, `RequestTrace(FUNCTIONAL_TEST)` |
| `playground.use` | STT/TTS/LLM Playground(§108) | `RequestTrace(PLAYGROUND)` |
| `e2e.run` | End-to-End 테스트(§109) | `RequestTrace(E2E)` |
| `trace.read` | Request Trace 조회·검색·Diagnostics 지표(§110·§111) | `RequestTrace`, `EngineMetricsDaily` |
| `debug_session.create` | 명시적 Debug session 생성·revoke(§113) | `DebugSession` |
| `override.create` | TEMPORARY/SESSION Override 생성·revoke(비Production) | `RuntimeOverride` |
| `override.production` | PRODUCTION Override(§106, `AppSetting override.production.enabled=true` 일 때만) | `RuntimeOverride(PRODUCTION)` |
| `prompts.read` | Prompt Registry·버전·본문 조회 | `PromptTemplate`, `PromptVersion` |
| `prompts.edit` | DRAFT 버전 생성·Prompt Test(§120) | `PromptVersion(CONSOLE)` |
| `prompts.activate` | 버전 ACTIVE 전환(§119) | `PromptVersion`, `ConfigurationVersion(PROMPT)` |
| `presets.manage` | Preset 생성·삭제·적용(§105) | `ConfigurationPreset` |
| `config.export` | 스냅샷 Export(SECRET → credentialRef, §102·§103) | 읽기지만 **감사 기록** |
| `config.import` | Import Validation→Diff→Apply(비Production, §104) | `ConfigurationVersion` |
| `config.import.production` | PRODUCTION Import | 동일 |
| `audit.read` | 감사 로그·Configuration History 조회 | `AuditLog`, `ConfigurationVersion` |
| `environment.policy` | Environment 보호 정책·`override.production.enabled`·보존 기간 등 정책 키 편집(§95·§96) | `AppSetting(정책 키)` |
| `users.role.manage` | 역할 부여·회수 | `User.role` |
| `console.access` | **파생** capability — 위 목록 중 `settings.*`·`voices.read` 를 제외한 것이 하나라도 있으면 true. `(admin)` 라우트 그룹 진입 조건 | — |

## 3. Role × Capability 매트릭스

O = 허용, P = PRODUCTION 대상일 때 SUPER_ADMIN 확인 필요(§6), - = 없음.

| capability | USER | ADMIN | DEVELOPER | SUPER_ADMIN |
|---|---|---|---|---|
| `settings.read` | O | O | O | O |
| `settings.write` | O | O | O | O |
| `voices.read` | O | O | O | O |
| `voices.manage` | - | O (disable/delete P) | O (P) | O |
| `engine.read` | - | O | O | O |
| `engine.connections.manage` | - | O (P) | O (P) | O |
| `config.effective.read` | - | O (요약: 값+Source 이름) | O (전체: sourceRef·env 이름) | O |
| `config.raw.read` | - | - | O | O |
| `config.edit` | - | O (Form, P) | O (Form+JSON, P) | O |
| `config.apply.production` | - | - | - | O |
| `config.rollback` | - | O (P) | O (P) | O |
| `credentials.manage` | - | - | - | O |
| `secrets.read_ref` | - | O | O | O |
| `plugins.read` | - | - | O | O |
| `health.run` | - | O | O | O |
| `functional_test.run` | - | O | O | O |
| `playground.use` | - | - | O | O |
| `e2e.run` | - | - | O | O |
| `trace.read` | - | - | O | O |
| `debug_session.create` | - | - | O (PRODUCTION 은 - ) | O |
| `override.create` | - | - | O (PRODUCTION 은 - ) | O |
| `override.production` | - | - | - | O (게이트 켜진 때만) |
| `prompts.read` | - | - | O | O |
| `prompts.edit` | - | - | O | O |
| `prompts.activate` | - | - | O (P) | O |
| `presets.manage` | - | - | O | O |
| `config.export` | - | - | O | O |
| `config.import` | - | - | O (비Production) | O |
| `config.import.production` | - | - | - | O |
| `audit.read` | - | O | O | O |
| `environment.policy` | - | - | - | O |
| `users.role.manage` | - | - | - | O |
| `console.access` (파생) | - | O | O | O |

코드 상수(`src/modules/admin/permissions/matrix.ts`)는 이 표를 그대로 옮기고, 단위 테스트가 표의 행 수·값과 일치하는지 검사한다(문서가 정본).

## 4. 라우트·화면 매핑

### 4-1. 화면 `(admin)/admin/*` (별도 레이아웃, 상단 Environment 배지 — PRODUCTION 은 경고색)

`console.access` 가 없으면 **모든 `/admin/**` 는 404**(존재를 노출하지 않음, §79). 화면 안의 버튼은 아래 capability 로 숨기되 서버가 다시 검사한다(§5).

| 화면 | 경로 | 진입 capability | 화면 내 동작 → capability |
|---|---|---|---|
| Dashboard(Overview) | `/admin/dashboard` | `engine.read` | 역할별 활성 connection·모델·상태·voice 수·config version 표시. Health 재실행 → `health.run` |
| Speech · Realtime STT / Analysis STT / TTS | `/admin/speech/{realtime,analysis,tts}` | `engine.read` | Engine·Connection 선택·Fallback 편집 → `engine.connections.manage` · 연결 설정 Form → `config.edit` · 테스트 → `health.run`/`functional_test.run` · Effective 값 보기 → `config.effective.read` |
| LLM | `/admin/llm` | `engine.read` | 동일 + Prompt 링크 → `prompts.read` |
| Voices | `/admin/voices` (+`/[id]`, Preview Playground) | `voices.manage` | 목록·상세·Preview Playground(§116)·Edit·activate/disable/delete·sync·Import 업로드 → `voices.manage`(PRODUCTION disable/delete 는 P) |
| Plugins | `/admin/plugins` (+`/[id]`) | `plugins.read` | Descriptor·Schema·capabilities·loaded·initError |
| Connections | `/admin/connections` (+`/[id]`) | `engine.read` | 생성·편집·enable/disable·삭제 → `engine.connections.manage` · credentialRef 연결 → `credentials.manage` · ref 목록 → `secrets.read_ref` · Log level → `config.edit`(DEVELOPER 이상) |
| Configuration · Form / Raw JSON / Diff / Presets / Export·Import / Overrides | `/admin/configuration` | `config.effective.read` | Form 편집 → `config.edit` · JSON 보기 → `config.raw.read` · JSON 편집 → `config.raw.read`+`config.edit` · Diff/Validate/Test → `config.edit` · Apply(PRODUCTION) → `config.apply.production` · Presets → `presets.manage` · Export → `config.export` · Import → `config.import`(PRODUCTION `config.import.production`) · Overrides → `override.create`(PRODUCTION `override.production`) |
| Prompts | `/admin/prompts` (+`/[key]`) | `prompts.read` | DRAFT 생성·Test → `prompts.edit` · activate → `prompts.activate`(PRODUCTION P) · 버전 이력 → `audit.read` |
| Diagnostics · Health / Metrics / Log level / Debug session | `/admin/diagnostics` | `engine.read` | Metrics·Trace 검색 → `trace.read` · Log level → `config.edit` · Debug session → `debug_session.create` |
| Playground · STT / TTS / LLM / E2E | `/admin/playground` | `playground.use` | E2E → `e2e.run` · 결과 Trace 열기 → `trace.read` |
| History · Config versions / Audit / Rollback | `/admin/history` | `audit.read` | Rollback → `config.rollback`(PRODUCTION P) |

### 4-2. API `/api/admin/v1/*` (전부 인증 + capability, 실패 시 `403 FORBIDDEN`; `console.access` 없는 사용자는 `404 NOT_FOUND`)

| 엔드포인트 그룹 | capability | 비고 |
|---|---|---|
| `GET me/capabilities` | (인증만) | 화면이 버튼을 숨기기 위한 목록. 진실은 서버 |
| `GET overview` | `engine.read` | |
| `GET engines`, `GET engine-connections`, `GET engine-connections/{id}` | `engine.read` | 응답의 `credentialRef` 는 이름만, `connection` 의 SECRET 키는 `"***"` |
| `POST/PUT/DELETE engine-connections`, `PUT engine-connections/{id}/enabled`, `GET/PUT fallback-policies/{role}` | `engine.connections.manage` | PRODUCTION 은 §6 흐름. `POST`(생성)·`DELETE`(삭제)는 Phase 4(task-012c D-C10), 012c 는 `PUT`·`enabled`·Fallback 만 |
| `PUT engine-connections/{id}/credential` | `credentials.manage` | body 는 `{credentialRef}` 만. 값 필드가 있으면 400 |
| `GET secrets` | `secrets.read_ref` | ref 이름·존재 여부·lastUsedAt |
| `POST engine-connections/{id}/health` | `health.run` | |
| `POST engine-connections/{id}/test` | `functional_test.run` | |
| `GET/PUT engine-connections/{id}/log-level` | `config.edit` + DEVELOPER 이상 | PRODUCTION DEBUG/TRACE 는 §6 |
| `GET plugins`, `GET plugins/{id}` | `plugins.read` | |
| `GET config/effective`, `GET config/versions`, `GET config/versions/{id}` | `config.effective.read` | ADMIN 은 `sourceRef` 생략 |
| `GET config/schema/{engineId}`, `GET config/raw/{scope}/{targetId}` | `config.raw.read` | |
| `POST config/validate`, `POST config/test`, `POST config/diff`, `POST config/apply`, `PUT config/raw/{scope}/{targetId}`, `GET/PUT app-settings/{key}` | `config.edit` | apply 대상이 PRODUCTION 이면 추가로 `config.apply.production` |
| `POST config/versions/{id}/rollback` | `config.rollback` (+ PRODUCTION `config.apply.production`) | |
| `GET config/export` | `config.export` | AuditLog 기록(민감 읽기) |
| `POST config/import` | `config.import` / PRODUCTION `config.import.production` | |
| `GET/POST/DELETE presets`, `POST presets/{id}/apply` | `presets.manage` | apply 는 `config.edit` 흐름 재사용 |
| `POST/DELETE overrides` | `override.create` / PRODUCTION `override.production` | |
| `GET/POST voices`, `PUT voices/{id}`, `POST voices/{id}/{activate,disable}`, `DELETE voices/{id}`, `POST voices/sync`, `GET voices/import-jobs/{id}`, `POST voices/{id}/preview` | `voices.manage` | PRODUCTION disable/delete 는 `config.apply.production` |
| `GET diagnostics/{connectionId}`, `GET traces`, `GET traces/{traceId}`, `GET metrics` | `trace.read` | Trace 본문에 원음·전체 텍스트 없음(규칙 7) |
| `POST debug-sessions`, `DELETE debug-sessions/{id}` | `debug_session.create` | PRODUCTION 은 SUPER_ADMIN 만(§6) |
| `POST playground/{stt,tts,llm}` | `playground.use` | |
| `POST playground/e2e` | `e2e.run` | |
| `GET prompts`, `GET prompts/{key}/versions`, `GET prompts/{key}/versions/{v}` | `prompts.read` | |
| `POST prompts/{key}/versions`, `POST prompts/{key}/test` | `prompts.edit` | |
| `POST prompts/{key}/versions/{v}/activate` | `prompts.activate` (+ PRODUCTION `config.apply.production`) | |
| `GET audit` | `audit.read` | |
| `GET environment`, `PUT environment/policy` | `GET`: `console.access` / `PUT`: `environment.policy` | |
| `PATCH users/{id}/role` | `users.role.manage` | |

사용자 API(`/api/v1/*`)는 인증 + 소유자 검사(타인 리소스 404)만이고 capability 는 `settings.*`·`voices.read` 두 계열만 관여한다: `GET/PUT /api/v1/settings/{profile,voice,speech}` → `settings.read`/`settings.write`, `GET /api/v1/voices`·`POST /api/v1/voices/preview` → `voices.read`. `/api/internal/*` 은 사용자 권한이 아니라 공유 시크릿 헤더(`SPEECH_INTERNAL_SECRET`)로 보호한다.

## 5. 검사 방식

- **구현 위치**: `src/modules/admin/permissions/{matrix.ts, can.ts, guard.ts}`.
  - `matrix.ts` — `ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>>`(§3 표 그대로, 누적 전개), `Capability` 문자열 리터럴 유니온.
  - `can(user, capability, ctx?)` — 순수 함수. `ctx = {environment?, targetEnvironment?}`. PRODUCTION 대상이면 §6 규칙을 적용해 `config.apply.production` 등 추가 capability 를 요구한다. 결과는 `{allowed, missing: Capability[]}`.
  - `requireCapability(req, capability, ctx?)` — 라우트 핸들러 첫 줄에서 호출. 세션 JWT → `User` 를 DB 에서 읽어 `role` 확정 → `can` → 실패 시 `403 FORBIDDEN {code:'FORBIDDEN', missing:[…]}`. `console.access` 조차 없으면 `404 NOT_FOUND`(관리자 API 존재 비노출).
- **`src/middleware.ts`**: `/admin/**` 와 `/api/admin/**` 에 대해 세션 존재만 확인하고 `role=USER` 면 404 로 재작성(rewrite). 세밀한 capability 검사는 라우트/서버 컴포넌트에서 한다(미들웨어는 DB 를 읽지 않으므로 JWT 의 `role` 힌트만 쓰고, 최종 판단은 항상 라우트).
- **클라이언트를 믿지 않는다**: `GET /api/admin/v1/me/capabilities` 는 UI 버튼 숨김 용도일 뿐. 모든 변경 API 는 서버에서 `requireCapability` 를 다시 통과해야 한다. 서버 컴포넌트도 렌더 전에 `can` 을 호출한다.
- **Production 컨텍스트 결정**: 요청 body 의 `environment` 가 아니라 **대상 행의 `environment` 컬럼**(또는 새로 만들 때 body 의 값)을 `targetEnvironment` 로 삼는다. 프로세스 `APP_ENV` 와 다른 환경의 행을 편집하는 것은 SUPER_ADMIN 만(§6-6).
- **부정 캐시 금지**: capability 결과를 세션에 캐시하지 않는다(역할 변경 즉시 반영).
- **감사 연결**: `requireCapability` 통과 후 변경 API 는 `infra/audit.record(...)` 를 같은 트랜잭션 안에서 호출한다(§7).

## 6. PRODUCTION 보호 규칙 (§96·§106·§112·§113)

대상: `targetEnvironment = PRODUCTION` 인 모든 설정 변경. 현 워크스페이스에서 PRODUCTION 은 우분투 pm2 blue/green 프로세스가 읽는 행이다.

1. **적용 흐름 고정**: `Validate → Functional Test → Change Summary(Diff) → SUPER_ADMIN 확인 → Apply`. `POST config/apply` 는 PRODUCTION 대상이면 `{confirm:"PRODUCTION", summaryHash, testResultId, reason}` 을 요구하고, `confirm` 이 문자열 `"PRODUCTION"` 이 아니면 `403 {reason:PRODUCTION_CONFIRMATION_REQUIRED}`, `summaryHash` 가 서버가 **같은 후보로 다시 계산한** Diff 해시와 다르면 `409 CONFLICT {reason:SUMMARY_MISMATCH}`(다른 변경이 끼어듦), `testResultId`(= `EngineHealth(FUNCTIONAL).id`, 30분·같은 후보·**변경 키 전부를 실제로 실행해 검증한 결과만** — 검증 못 한 키가 있으면 `partial` 이라 id 자체가 없다, Codex C1 CX-2) 가 없거나 실패면 `403 {reason:PRODUCTION_TEST_REQUIRED}`. 결과 `ConfigurationVersion.testResult` 에 테스트 요약 저장. **확인 문자열 통일(task-012c D-C1, 2026-09-29)**: 설정·Rollback·credentialRef·Fallback·(012c-2) 페르소나 활성화·발음 사전 모두 `confirm:"PRODUCTION"` 한 값을 쓴다(옛 표기 `confirm:true`, 서명 확인 토큰 방식은 폐기 — 정본 `configuration-resolution.md` §8-1).
2. **엄격 대상**(§96): `Engine`·`Model`(runtime.model 등 RESTART_REQUIRED 키)·`Connection`(baseUrl·connectionType·enabled)·`Credential`(credentialRef)·`Fallback`(EngineFallbackPolicy) 변경은 위 흐름 + **SUPER_ADMIN 이 직접 actor** 여야 한다(ADMIN/DEVELOPER 는 PRODUCTION 에서 DRAFT/Diff 까지만 만들고 "승인 요청" 상태로 남긴다 — 1인 앱에서는 같은 사람이 SUPER_ADMIN 으로 확인 단계를 한 번 더 밟는 셈). `reason` 은 필수(10자 이상, 상한·정리·비밀 유사 거부는 §7 `reason` 규칙).
3. **임시 Override 기본 비활성**: PRODUCTION 의 `RuntimeOverride` 는 `AppSetting override.production.enabled=false` 인 동안 `403`. 켜는 것은 `environment.policy`(SUPER_ADMIN) 이며, 켜진 상태에서도 `override.production` capability + TTL ≤ 30분 + AuditLog. SESSION 오버라이드도 동일.
4. **Debug session**: PRODUCTION 에서 `captureAudio`/`captureText` 가 true 인 `DebugSession` 은 SUPER_ADMIN 만, TTL ≤ 60분, `targetUserId` 명시 필수. 수집물은 `expiresAt+7일` 에 삭제(domain-model §6).
5. **Log level**: PRODUCTION 에서 `DEBUG`/`TRACE` 는 SUPER_ADMIN 만, 30분 TTL 의 `RuntimeOverride(TEMPORARY)` 로만 적용(영구 변경 불가). Python 서비스에는 `POST /admin/log-level` 로 전달하되 TTL 만료 시 `INFO` 로 되돌린다.
6. **환경 교차 편집**: `APP_ENV=LOCAL` 프로세스(맥 미러)에서 PRODUCTION 행을 편집하는 것은 SUPER_ADMIN 만 허용하고 AuditLog 에 `crossEnvironment:true` 를 남긴다. 반대로 PRODUCTION 프로세스에서 LOCAL 행 편집은 자유(하위 환경).
7. **Import/Export**: PRODUCTION Import 는 `config.import.production`(SUPER_ADMIN) + 1번 흐름. Export 스냅샷은 SECRET 키를 `credentialRef` 로 치환하고 값이 섞이면 서버가 거부(§103).
8. **Rollback**: PRODUCTION Rollback 도 1번 흐름(Functional Test 포함) — "이전 버전"이 지금 환경에서 여전히 동작하는지 확인 없이 되돌리지 않는다.
9. **Voice**: PRODUCTION 에서 Voice `disable`/`delete` 는 사용 중인 사용자 수(`UserVoiceSetting` 집계)를 Change Summary 에 표시하고 SUPER_ADMIN 확인. `activate` 는 Functional TTS 성공이 조건.
10. **Prompt activate**: PRODUCTION 에서 `prompts.activate` 는 회귀 픽스처 테스트(`POST prompts/{key}/test` 의 픽스처 모드) 통과 결과를 `testResultId` 로 첨부해야 한다. (task-012c D-C12: 런타임 ACTIVE 전환 대상은 `teacher-persona` 하나 — 나머지 키는 코드 빌더라 파일 수정·배포로 바꾼다, 012c-2.)
11. **UI**: PRODUCTION 배지(경고색) + 적용 버튼 라벨에 환경명 명시("PRODUCTION 에 적용"). 확인 다이얼로그는 Diff 요약·테스트 결과·`reason` 입력과 **확인 문자열 `PRODUCTION` 직접 입력** 칸을 포함한다. 권한이 없는 버튼은 비활성이 아니라 렌더링하지 않는다(ADMIN·DEVELOPER 는 PRODUCTION 에서 초안·Diff 까지, "최고관리자 확인 필요" 상태 표시).

정책 키(`environment.policy` 로만 편집): `override.production.enabled`, `debug.production.maxTtlMinutes`, `loglevel.production.maxLevel`, `speech.audio.retentionDays`, `trace.retentionDays`.

## 7. 감사 (`AuditLog`, domain-model §3 L6)

- **모든 관리자 쓰기**는 같은 트랜잭션에서 `AuditLog` 1행을 남긴다: `environment`(대상 환경), `actorUserId`+`actorEmailSnap`+`actorRoleSnap`, `action`(= capability 이름 또는 `<자원>.<동작>`: `config.apply`, `config.raw_apply`(Raw JSON 적용), `config.baseline`(첫 적용 기준선 v1, actor 없음 — task-012c D-C5), `config.rollback`, `engine.connections.create|update|delete|enable|disable`, `credentials.set|clear`, `voices.create|update|activate|disable|delete|sync|import`, `override.create|revoke`, `prompts.create_version|activate`, `presets.create|delete|apply`, `config.import`, `debug_session.create|revoke`, `users.role.set`, `environment.policy.set`, `loglevel.set`), `scope`(`ConfigScope`, 해당 시), `targetId`, `before`/`after`(SECRET 키는 `credentialRef` 로 치환, 값 마스킹), `reason`, `ip`, `traceId`(테스트·E2E·Functional Test 와 연결).
- **`reason` 규칙(모든 관리자 쓰기 — Codex C1 CX-3, task-012c 2026-09-29 채택)**: `reason` 은 감사에 영구 보존되므로 시크릿이 들어오는 통로가 되면 안 된다. ① 줄바꿈·탭·제어문자는 공백 하나로 바꾸고 앞뒤 공백 제거 ② 길이 1~200자(PRODUCTION 은 10~200자) — 위반 `400 VALIDATION` ③ **비밀 유사 문자열 거부** — 접두 패턴(`sk-`·`ghp_`·`gho_`·`github_pat_`·`AKIA`·`xox`·`Bearer `·`Basic `·JWT 모양 `eyJ…​.…​.…`), 키=값 패턴(`password=`·`passwd=`·`secret=`·`token=`·`api_key=`·`apikey=`·`credential=`, 대소문자 무시, `:` 도 포함), 공백 없는 고엔트로피 토큰(영숫자·`-_+/=` 로만 된 24자 이상 연속 문자열 중 문자 종류가 3가지 이상) 중 하나라도 있으면 `422 UNPROCESSABLE {reason:E_REASON_SECRET_LIKE}` — 응답·로그에 원문을 되돌려주지 않는다 ④ 통과한 값은 `AuditLog.reason`(와 `ConfigurationVersion.reason`)에만 저장하고 **pm2·console 등 프로세스 로그에는 싣지 않는다**(로그에는 길이만) ⑤ 기록 직전 마스킹 필터(`infra/logging`)는 그대로 한 번 더 건다. 검사 함수는 공용 하나(`infra`)로 두고 설정 편집·Rollback·credentialRef·발음 사전 쓰기가 같이 쓴다(발음 사전 경로 적용은 012c 구현 때 함께 — Leader 확인). ⑥ **설정 값에도 같은 판정 규칙을 적용한다(task-012c REV-056 수정, 2026-10-01)** — `STRING`·`PATH`·`URL`·`JSON` 타입 값(JSON 은 문자열 말단·객체 키·`키: 값` 쌍까지 재귀 검사)에서 비밀 유사 문자열이 나오면 `400 VALIDATION {rule:'secretValue'}` 로 거부하고 입력 원문을 응답·로그에 되돌려주지 않는다. 자유 문장 키(`EditKeyDef.freeText` — 예: 미리듣기 문장)는 위 접두·키=값·고엔트로피 규칙을 전부 적용하고, 그 외 키는 "공백 없는 24자 이상 고엔트로피 토큰" 규칙을 제외한다(URL·경로·식별자가 이 규칙에 오탐되므로 — 접두·키=값 패턴만 적용하고, 구분 기호 없는 긴 혼합 런 보강 규칙은 아래 ⑦). 재귀 한도는 깊이 8·배열 200개(초과는 `type` 거부). 비자유 키의 검사 창(23자)은 `reason.ts` 접두 규칙의 최장 일치 길이(현재 20자)에 기대므로, **접두 규칙은 20자 이내로 유지**하고 늘릴 때는 창도 함께 키운다(REV-059 L4).
  - ⑦ **비자유 키는 긴 토큰 규칙 대신 '구분 기호 없는 긴 혼합 런(≥32자·3종 이상)' 보강 규칙을 적용한다**(task-012c Codex C2 재검토, 2026-10-02) — 판정용 형태(NFKC·폭 0 삭제)에서 구분 기호(`-` `.` `:` `/` 공백) 없이 이어진 `[A-Za-z0-9_+=]` 런이 32자 이상이고 문자 종류(소문자·대문자·숫자·`_+=`)가 3가지 이상이면 `secretValue`. 목록 값(ENUM)·JSON 잎·객체 키도 같은 함수(`validate.ts` `secretLikeNonFreeText`)로 본다. 하이픈·점·콜론·슬래시로 끊기는 모델 id·경로·URL·uuid 와 소문자+숫자뿐인 cuid·16진수(2종)는 통과한다. 반대로 구분 기호 없이 32자 이상이면서 3종 이상인 정상 식별자(예: 소문자+숫자+`_` 로만 된 긴 snake_case)는 거부되므로(REV-062 L1, 의도한 좁은 규칙의 대가) 모델 버전·경로 조각 등을 쓸 때는 `-`·`.` 로 끊어 쓴다. 31자 이하로 쪼갠 조각·16진수·base32 같은 2종 키·글자 사이 공백 삽입은 통과하는 정책 틈이 있으며 회귀가 아니다(REV-062 L2) — 방어선은 `credentialRef`·`maskSensitive` 가 맡는다.
- **민감 읽기도 기록**: `config.export`, `secrets.read_ref`(목록 조회), `debug_session` 수집물 열람, `config.raw.read`(PRODUCTION 대상만). 일반 조회(대시보드·목록)는 기록하지 않는다.
- **시스템 전이는 기록하지 않는다**: Health 결과에 따른 `EngineStatus` 변화, Override TTL 만료, Job 재시도는 `EngineHealth`/`RuntimeOverride.expiresAt`/`SpeechJob` 자체가 이력이다.
- **불변**: `AuditLog` 는 UPDATE/DELETE 경로가 없다. 계정 삭제 시 `actorUserId` 만 SetNull, 스냅샷 컬럼으로 읽힌다. 보존 무기한.
- **조회**: `GET /api/admin/v1/audit?from=&to=&scope=&targetId=&actor=&action=` (`audit.read`). History 화면은 `ConfigurationVersion` 과 `AuditLog` 를 `traceId`/`targetId` 로 묶어 보여준다.
- **QA 대조 항목**: 콘솔에서 실행한 모든 변경 API 호출 수 == 해당 구간 `AuditLog` 행 수; `AuditLog.after` 와 `ConfigurationVersion.snapshot` 어디에도 `credentialRef` 이외의 시크릿 형태 문자열(`sk-`, `Bearer `, 32자 이상 hex/base64 값)이 없어야 한다.
