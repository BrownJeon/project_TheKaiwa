---
task_id: task-012c
title: "Console P2 — 설정 편집(Form/Raw JSON)·Validate/Test/Diff/Apply·ConfigurationVersion·History·Rollback·credentialRef 연결 + 후속 분할(012c-2 Prompt Registry·Playground · 012c-3 TTS Quality·대시보드)"
status: doing
base_ref: f4a3f32
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, codex, qa, deployer]
related_tasks: [task-005b-admin-console-skeleton, task-003g-lexicon-admin, task-003d-tts-p0, task-003c-tts-productization-design, task-012b-speech-p2, task-018-db-structure-hardening, task-009-release-cutover, task-004-ai-client-persona]
tags:
  - type/task
  - domain/admin
  - domain/engine
  - domain/ui
aliases:
  - Console P2
  - 관리자 콘솔 P2
  - 설정 편집·버전·Rollback
  - task-012c
created: 2026-09-29
updated: 2026-10-01
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 2
  repo_path: "docs/demo/task-012c-console-p2-v2.html"
  artifact_url: "https://claude.ai/artifact/6xHJK9pXzMpWxCfSZaT65o"
  content_sha256: "39b19fc822fdf8993110aac66a1ad652ae37bf757a176e4a3301508b5067583e"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-01T08:17:28+09:00"
  approval_quote: "대기 중인 데모 전부 권고안대로 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
관리자(개발자)가 콘솔에서 **엔진 연결·Fallback·운영 설정(AppSetting)·목소리 기본값**을 Form 또는 Raw JSON 으로 고치고, `검증 → 기능 테스트 → Diff(변경 요약) → 적용` 을 거쳐 **적용할 때마다 새 설정 버전(`ConfigurationVersion`)과 감사 기록(`AuditLog`)을 한 트랜잭션으로 남긴다.** 잘못 고쳤으면 이력 화면에서 이전 버전을 골라 **Rollback(= 새 버전)** 한다. 운영(PRODUCTION) 설정 변경은 최고관리자(SUPER_ADMIN) 확인과 기능 테스트가 필수다.

**이 이력서의 구현 범위 = 012c(1단계): 설정 편집·버전·이력·Rollback·credentialRef 연결(서버 + 화면) — 스키마 변경 0 · M4 변경 0 · Python 서비스 변경 0.** Prompt Registry·Playground, TTS Quality·대시보드는 아래 "범위 분할"대로 후속 task 로 나눈다.

## 사용자 지시
- 2026-09-28: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘". 순서상 012b 음성 P2 다음 = 012c Console P2(design-spec §15 383행).

## 관련 과거 이력 요약

### 012c 로 넘어온 항목 (과거 이력 grep 수집, 2026-09-29)
| 출처 | 항목 | 012c 처리 |
|---|---|---|
| [[task-005b-admin-console-skeleton]] G2 | **#93b credentialRef 연결/해제** — "ConfigurationVersion·Apply 흐름과 함께 Phase 2(012c)로 이월" | 012c(1단계) — D-C3(b) 허용 목록 선행 |
| 005b REV-009 Low 1 | **Functional Test 30초 슬롯 원자성** — `functionalTest/index.ts` `claimSlot` 이 프로세스 메모리 Map + DB 조회라 blue/green 두 프로세스 동시 요청이 30초 1회를 넘길 수 있음(Claude 구독 호출 보호 약화). "Phase 2 에서 DB 유니크/원자적 upsert/분산 락" | 012c(1단계) — D-C9 |
| 005b 한계 ② | 헬스 SSRF: 주소가 서버 설정뿐이라 Phase 1 안전, **baseUrl 편집이 생기면 호스트 허용 목록(LAN·loopback) 필요** | 012c 선결 — D-C3(c) |
| 005b 한계 ⑤ | `GET secrets` 의 `lastUsedAt` null(SecretResolver 사용 추적 Phase 2) | 012c 선택(Low) |
| 005b 한계 ④ · design-spec §9-B Phase 2 | Health 5분 스케줄(수동 Health 가 연결 상태를 바꾼 채 남음) | **012c 범위 밖 → 015c Diagnostics 권고**(D-C10) |
| 005b B 참고 | `getEnvironmentInfo` 6쿼리가 셸 렌더마다 — 가벼운 `appVersion` 함수 | 012c 선택(Low, 화면 작업 때) |
| design-spec §15 005b 행 · admin-console/06 §11 | "History 읽기"·`GET config/versions`(#108)·기동 시 SYSTEM 버전 1 — **005b 에서 구현 안 됨**(라우트·화면 없음, `ConfigurationVersion` 0행) · #137 `GET audit` 도 Phase 1 계약인데 미구현 | 012c(1단계) — D-C5·D-C8 |
| [[task-003d-tts-p0]] Codex C2 F1 | baseUrl 편집이 열리면 시크릿 헤더 유출 — **TTS 는 origin 고정 완료**(REV-011 `readServiceSecretFor`). **home-m4 `x-api-key` 는 DB `connection.baseUrl` 로 그대로 전송(2026-09-29 Leader 확인, `engine/llm/index.ts` 209~212행)** | 012c 선결 — D-C3(a) |
| 003d 한계 ① | M4 `/admin/config/*`·`/admin/log-level` 미구현. gateway·worker 에도 없음, `GET /api/internal/speech/config` 없음(2026-09-29 확인) | Python 서비스 반영 = **015c 권고**(D-C4·D-C10) |
| [[task-003g-lexicon-admin]]·[[task-018-db-structure-hardening]] | 발음 사전 감사 "관리자 변경 이력에서 골라 보기 — 이력 화면은 Phase 2". `ConfigScope.LEXICON` 추가 완료(018) — #137 LEXICON 필터는 옛 `scope=null` `lexicon.*` 행도 함께 잡을 것 · 018 L2: #137 구현 시 `scope` 를 폭넓게 select 하기 전 옛 릴리스 롤백 시나리오 고려 | 012c History(D-C8) |
| 003g 전체 | **버전·감사·환경 잠금 선례**(아래 "003g 패턴 재사용") — 층 배치·`baseVersion` 409·변경 0 무버전·ROLLED_BACK 의미·스냅샷 무결성 422·PRODUCTION `confirm`·스모크 원복 | 012c 설계의 기준 |
| [[task-012b-speech-p2]] 범위 분할 | **Golden·Regression·A/B Blind·Model Versioning·Canary·Voice Versions 페이지·TTS 대시보드** → 012c · U6(TTS P1 Phase 2 편입 확인·Canary 실효성·합격 수치) | 012c-3 / Voice Versions·Canary 는 Phase 4 권고(D-C13, U-C1) |
| configuration-resolution §13 #7 | SESSION override 를 Python 어댑터 요청별 파라미터로 전달(`runtimeOverride` 슬롯) — 결정 시점 "task-012c" | Override 자체가 Phase 4(016) → **016 으로 정정 권고**(D-C10) |
| admin-console/06 §12 · 07 §11 · 14 §13 | `ConfigurationVersion` 보조 필드(origin·rollbackOfId·importId·effectiveHash·schemaVersion)·AuditLog 추가 필드·PromptVersion 추가 필드의 정본 반영 여부 | D-C2(스키마 0 매핑) · 012c-2 |

### 관련 task 요약
- [[task-005b-admin-console-skeleton]]: 권한 매트릭스(`admin/permissions/{matrix,can,guard}` — role-permission §3 33행 전수 테스트)·`requireCapability`(DB 역할, 세션 없음 401·console.access 없음 404·부족 403 `details.missing`)·8층 resolver(**읽기 전용·캐시 없음**, APPLICATION_CONFIG·USER_SETTING 층은 빈 층)·Effective 요약(ADMIN)/전체(DEVELOPER+)·PRODUCTION FULL 조회 감사·Secret 값 미노출(`maskSensitive`·경로 scrub)·Health/Functional Test·Trace·콘솔 화면 14(`components/admin/{console,configEditor,trace}`). 쓰기는 Health/Test 결과와 민감 읽기 감사뿐. 메뉴 `menu.ts` 에 `configuration` 탭 raw·diff(phase 2)·`prompts`·`playground`·`history`(phase 2) 가 이미 자리만 있음.
- [[task-003g-lexicon-admin]]: 관리 API 9라우트 + 화면. 라우트(얇음) → L0 `admin/speech/lexicon.ts`(권한·PRODUCTION·입력·트랜잭션+감사·DTO) → L4 `speech/tts/lexiconStore`. 쓰기 직렬화 = 환경의 가장 오래된 버전 행 `SELECT … FOR UPDATE`, `baseVersion` 불일치 409 `VERSION_CONFLICT`, 변경 0 이면 버전·감사 없음, Rollback = 새 ACTIVE·밀려난 직전 = ROLLED_BACK, Codex C2 로 **스냅샷 무결성 엄격 검사 → 422 `E_SNAPSHOT_INTEGRITY`**, PRODUCTION = SUPER_ADMIN + 본문 `confirm:"PRODUCTION"`, 스모크는 자기가 만든 행만 삭제하고 기준선 대조(AuditLog 는 불변이라 남김). 화면 쓰기 4갈래(`useLexiconAccess`).
- [[task-009-release-cutover]]: 운영 = `APP_ENV=PRODUCTION`(blue/green `/home/brownjeon/apps/thekaiwa`). **운영 콘솔에서 PRODUCTION 보호 규칙이 실제로 발동한다.** QA 역할 토큰은 PRODUCTION 서버에서 인정되지 않는다(005b `infra/auth`) → PRODUCTION 쓰기 경로는 단위 테스트 + 사용자 본인 리허설.
- [[task-004-ai-client-persona]]·[[task-007-talk-voice-web]]: 엔진 호출은 라우터가 `EngineConnection` 행 JSON 을 그대로 쓴다(30초 캐시, `clearRouterCache`). 회화 턴은 예열 CLI(persona 바이트 키) — 012c-2 에서 페르소나 활성화 시 풀 무효화 필요.

## Leader's Plan (2026-09-29)

### 요구사항 해석 (정본 인용)
- design-spec §15 012c 행: "Form/JSON 편집·Validate/Test/Diff/Apply·Version·History·Rollback·Prompt Registry sync/activate/test·Playground · TTS Quality(Golden·회귀·A/B Blind)·Voice Versions(TRAINED→…→PRODUCTION·Canary %)·TTS 대시보드(사용자 결정 ③)". §9-C Phase 2 = "Form·JSON 편집·Validate/Test/Diff/Apply·Version·Rollback·Prompt Registry·Playground". §9-B Phase 2 = "Advanced 편집·Health 스케줄·Fallback 편집".
- configuration-resolution §6(Edit→Validate→Test→Diff→Apply, Apply 트랜잭션 §6-2, 상태 전이 §6-3) · §7(환경 분리·교차 편집 SUPER_ADMIN) · **§8 Production 보호**(8-1 고정 흐름: `confirm`·`summaryHash`·`testResultId`·`reason≥10`·SUPER_ADMIN, 8-2 엄격 키) · §10 Secret(`credentialRef` 만) · §11 Python 반영 · §13 미결.
- admin-console 01(IA: Configuration 탭·History·Connections 편집) · 03(스키마 메타·Form 자동 생성) · 06(버전 엔티티·생성 규칙) · 07(감사 카탈로그·마스킹·8KB) · 08(Diff 응답·blocked·Form↔JSON 단일 draft) · 09(Rollback 전제 7조건·상태·재검증) · 10(Raw JSON 5단계·오류 rule 12종) · 16(환경·민감 변경·확인 흐름).
- role-permission §3 매트릭스(ADMIN `config.edit` Form·`config.rollback`·`engine.connections.manage` / DEVELOPER + Raw JSON / SUPER_ADMIN + `config.apply.production`·`credentials.manage`) · §4-2 API capability · §6 PRODUCTION 규칙 1~11 · §7 감사(모든 관리자 쓰기 = 같은 트랜잭션 AuditLog 1행).
- api-contract #93·#93a·#93b·#100·#104~#111·#123b·#137 (Phase 2, #93b·#137 은 Phase 1 표기 — 미구현).
- module-dependency 100행 규칙 "각 모듈은 자기 소유 테이블만, 두 층에 걸친 원자적 쓰기는 `infra.withTransaction`" · 소유 테이블: engine = `EngineConnection·EngineFallbackPolicy·ConfigurationVersion`, preferences = `AppSetting`, speech = `VoiceProfile`, infra = `AuditLog` · 539행 "ConfigurationVersion 없는 설정 변경 금지".

### 현황 대조 (코드·스키마, 2026-09-29 Leader 확인)
| 항목 | 있음 | 없음 |
|---|---|---|
| 스키마 | `ConfigurationVersion`(snapshot·diff·status·testResult·`restoredFromVersion`·supersededAt, `@@unique(env,scope,targetId,version)`) · `AuditLog`(actor 스냅샷·scope·before/after·traceId) · `RuntimeOverride` · `ConfigurationPreset` · `PromptTemplate`/`PromptVersion`(checksum·note) · `EngineMetricsDaily`(기본 컬럼) · `ConfigScope`(ENGINE_CONNECTION·FALLBACK_POLICY·PROMPT·APP_SETTING·VOICE_PROFILE·PRESET·LEXICON) · `Editability`·`ConfigSource` enum | `ConfigurationVersion.origin/rollbackOfId/importId/effectiveHash/schemaVersion`(정본 06 보조 필드) · `VoiceModelVersion`·`TtsGoldenSentence`·`TtsQualityRun/Result`·`TtsAbCompare`·`EngineMetricsDaily` TTS 컬럼 · `JobKind.TTS_QUALITY_RUN` · `ConfigScope.VOICE_MODEL_VERSION` |
| DB 행 | `ConfigurationVersion` 0행(005b 기록) · AppSetting seed 6키(두 환경) · EngineConnection 6·Fallback 4(두 환경) | SYSTEM 기준선 버전 |
| 서버 | 관리자 라우트 27개(005b 19 + 003g 8) — 설정은 `config/effective`·`config/schema` 읽기뿐 | #93·#93a·#93b·#100(PUT)·#104~#111·#123b·#137 전부 |
| 런타임 | 라우터가 `EngineConnection` 행을 그대로 사용(30초 캐시) · **resolver 는 화면 전용**(런타임은 resolver 를 거치지 않음) · 어댑터 일부가 env 직접 읽음(home-m4 `AI_API_BASE`·`AI_API_MODEL`, claude `CLAUDE_CLI_PATH`·`CLAUDE_TIMEOUT_MS`) | 런타임 실사용값 = Effective 동등성 보장 |
| Python | gateway·worker·tts-service 모두 자기 yml+env 로 기동 | `/admin/config/apply`·`/admin/log-level`·`GET /api/internal/speech/config` |
| 화면 | 설정 페이지 Effective 탭·연결 상세(읽기·테스트)·역할 페이지 | Form·Raw JSON·Diff 탭, 이력 화면, 연결·Fallback 편집 |

### 범위 분할 (Leader 권고)

| 단위 | 내용 | 승인 필요 | 데모 |
|---|---|---|---|
| **012c (이 이력서)** | **설정 편집 코어**: 편집 가능 키 표(D-C4)·Validate(5단계)·Test(후보로 Functional Test)·Diff(#106, blocked·summaryHash)·Apply(#107, 버전+감사+물화 한 트랜잭션)·Raw JSON(#110·#111 dryRun)·버전 목록/상세(#108·#108a)·Rollback(#109)·연결 수정(#93)·enable/disable(#93a)·**credentialRef 연결(#93b)**·Fallback 편집(#100)·AppSetting(#123b, 정책 키 제외)·~~VoiceProfile 기본값(VOICE_PROFILE scope)~~(→ D-C14 로 012c-2)·**감사 조회(#137)**·PRODUCTION 보호(§8-1)·**선결 보안 3종(D-C3)**·FT 슬롯 원자성(D-C9) + 화면(설정 Form/Raw/Diff 탭·연결 상세 편집·역할 페이지 Fallback 편집·이력 화면·PRODUCTION 확인 다이얼로그) | 서버: 없음(스키마 0). 화면: **데모 승인(U-C4)**. 운영 반영 뒤 PRODUCTION 리허설(U-C7) | **full**(judge) |
| 012c-2 | **Prompt Registry + Playground**: 코드 키 카탈로그·`prompts:sync`·버전 목록/상세/조립 미리보기·draft 테스트(#132~#136)·**강사 페르소나만 런타임 ACTIVE 전환**(D-C12) · Playground LLM·TTS(#125·#126·#127a)·STT(ANALYSIS_STT 우선) · Voice 관리 #85 activate·#86 disable·#88 sync·#89a Voice Preview | 데모(delta~full) · PRODUCTION 페르소나 활성화 픽스처 테스트 | 012c-2 intake 때 |
| 012c-3 | **TTS Quality + 대시보드**: Golden(저장소 JSON 우선)·Regression Run(합성 조건 묶음 단위)·A/B Blind·`diagnostics/tts` 대시보드(012b-3 지표 위) | **DB 추가(U-C3)** + 012b-3 선행(U4) + U-C1·U-C2 | 012c-3 intake 때 |
| Phase 4 이관 권고 | **Voice Versions(`VoiceModelVersion`·deployStatus)·Canary** — Voice Package Import(016)와 함께 | U-C1 | — |
| 015c 이관 권고 | Python 서비스 설정 반영(`/admin/config/apply` push·부팅 시 `GET /api/internal/speech/config`)·Log level·Health 5분 스케줄 | — | — |

**분할 근거**
1. **승인 경계.** 012c 설정 편집 코어는 스키마·M4·Python 변경 없이 서버를 끝낼 수 있고(사용자 지시 "승인 필요 전까지 진행"의 최대 범위), 화면만 데모 게이트에 걸린다. 012c-3 은 스키마 push + 012b-3(스키마) 선행 + U-C1 이 막는다. 한 task 로 묶으면 가장 늦은 승인에 전체가 묶인다.
2. **위험 집중.** 012c = R2 보안 축(capability·`ConfigurationVersion`·Secret·PRODUCTION 보호) — reviewer·Codex 초점이 한 곳. 012c-2 = 회화 턴 런타임(프롬프트·페르소나·예열 CLI 풀, 5초 예산)과 Claude 구독 사용량 축 — 초점이 다르다.
3. **설계 공백의 크기.** Prompt Registry 는 정본(admin-console/14 "DB 본문 ACTIVE 가 런타임 우선")과 실제 코드(TS 빌더 + `*_PROMPT_VERSION` 상수)가 맞지 않아 별도 C1 이 필요하다(D-C12). 설정 편집 코어를 그 결정에 묶지 않는다.
4. **공유 기반은 012c 가 먼저 만든다.** `ConfigurationVersion` 기록·감사·PRODUCTION 게이트·이력 화면은 012c-2 의 프롬프트 활성화(`scope=PROMPT`)와 012c-3 이 그대로 쓴다.
5. 사용자 예시(012c 에 Prompt Registry 포함)와의 차이: Prompt Registry 를 012c-2 로 옮겼다 — 위 2·3 때문. 반대로 가려면(대안 B) 012c 에 #132~#136 을 넣고 D-C12 를 C1 에서 함께 확정하면 된다(리뷰 범위·기간 증가).

### 003g 패턴 재사용 (설정 편집에 그대로 옮길 것)
| 003g 선례 | 012c 적용 |
|---|---|
| 라우트(얇음) → L0 admin(권한·PRODUCTION·입력·대상 확인·트랜잭션+감사·DTO) → 소유 층 store | 라우트 → `admin/configuration/editor`(L0 조합) → **대상 소유 층의 tx 쓰기 함수**(engine: EngineConnection·Fallback / preferences: AppSetting / speech: VoiceProfile) + `engine.configuration` 버전 기록 + `infra.audit` 를 **`infra.withTransaction` 하나**에서 (engine 은 speech·preferences 를 import 할 수 없다 — 물화는 소유 층, 조합은 admin) |
| 쓰기 직렬화: 환경의 가장 오래된 버전 행 `FOR UPDATE` | 대상 현재 행(`EngineConnection`/`EngineFallbackPolicy`/`AppSetting`/`VoiceProfile`) `SELECT … FOR UPDATE` + `@@unique(env,scope,targetId,version)` P2002 → 409 |
| `baseVersion` 불일치 409 `CONFLICT{reason:VERSION_CONFLICT}` | 동일(`baseVersion` = 대상의 현재 ACTIVE 번호, 없으면 0) |
| 변경 0 이면 버전·감사 없음(`changed:false`), Rollback 만 409 `NO_CHANGE` | 동일 |
| ROLLED_BACK = 밀려난 직전 ACTIVE, 복원 대상 상태 불변, 되돌림 표시 "vN 로 되돌림: {이유}" | 동일(admin-console/09 §5, `restoredFromVersion` 컬럼 사용) |
| Codex C2: 스냅샷 엄격 파서 → 손상·지금 규칙 위반이면 422 `E_SNAPSHOT_INTEGRITY`(쓰기 0) | Rollback 전 현재 스키마로 엄격 재검증 — 사라진 키만 `droppedKeys` 경고, 타입·범위·SECRET 평문 위반은 422 |
| PRODUCTION = SUPER_ADMIN + `confirm:"PRODUCTION"` | 상위 집합: + `summaryHash` + `testResultId` + `reason≥10`(D-C1) |
| 오류 봉투 `UNPROCESSABLE`(422)·`details.reason` | 동일 코드 체계에 설정 전용 reason 추가 |
| 스모크: 자기가 만든 행만 id 삭제 + 기준선 대조, AuditLog 남김 | 동일(D-C11) |
| 화면 쓰기 4갈래(`useLexiconAccess`) | `useConfigAccess`: 읽기 전용 / Form 쓰기(ADMIN) / Form+JSON(DEVELOPER) / PRODUCTION 비 SUPER_ADMIN = 초안·Diff 까지 / SUPER_ADMIN PRODUCTION = 확인 다이얼로그 |
| 버전 diff API `?compare=previous\|active` 서버 비교 | #108a 상세에 같은 `compare` 파라미터 |

### 012c 설계 결정 후보 (C1 에서 확정 → 정본 갱신 후 developer 착수)

| # | 쟁점 | 정본 현황 | Leader 권고 |
|---|---|---|---|
| D-C1 | **PRODUCTION 확인 방식 불일치** | ① configuration-resolution §8-1(정본): `confirm:true`+`summaryHash`(30분)+`testResultId`(30분)+`reason≥10`+SUPER_ADMIN ② admin-console/16 §6: HMAC 확인 토큰(`candidateHash`+actor+10분) ③ 003g 구현: `confirm:"PRODUCTION"` 문자열 | **① 채택 + `confirm` 값은 003g 와 같은 리터럴 `"PRODUCTION"`**(화면 일관). `summaryHash` 는 **무상태** — Apply 시 서버가 같은 후보로 Diff 를 다시 계산해 해시 대조(blue/green 두 프로세스·재기동에도 동작, 저장 0). `testResultId` = `EngineHealth(FUNCTIONAL).id`, `detail.candidateHash`·30분 확인(DB, 프로세스 무관). HMAC 토큰(②)은 폐기 → admin-console/16 §6 정본 갱신. 엄격 키(§8-2)는 요청자 본인이 SUPER_ADMIN. 발음 사전(003g)은 기능 테스트 개념이 없어 `confirm` 만 유지(차이 명시) |
| D-C2 | `ConfigurationVersion` 보조 필드 | 06 §3 `origin·rollbackOfId·importId·effectiveHash·schemaVersion` 제안(스키마에 없음) | **스키마 0 매핑**: origin = `AuditLog.action`(`config.apply`·`config.raw_apply`·`config.rollback`·`config.baseline`) + `after.versionId` · rollbackOf = 기존 `restoredFromVersion`(번호) · schemaVersion·origin 요약 = `snapshot._meta{schemaVersion, origin}`(물화·Diff 에서 제외하는 예약 키) · `diff` 는 배열 대신 봉투 `{entries[], summary, candidateHash}`(Json 컬럼, 주석만 갱신 — db push 불필요) · effectiveHash 불필요(`baseVersion` 잠금으로 충분) · importId 는 Phase 4. 대안: additive 컬럼(origin enum·schemaVersion) — 권고 안 함(010b~011 DB 묶음에 끼울 수는 있음) |
| D-C3 | **편집 전 선결 보안 3종(R2)** — (b) 는 Codex C1 CX-1 로 대체(2026-09-29 03:05 메인 판정), CX-2·CX-3 도 게이트 조건 | 003d C2 F1·005b 한계 ② | (a) **시크릿을 보내는 모든 어댑터 origin 고정** — home-m4 `x-api-key` 는 지금 DB `connection.baseUrl` 로 그대로 나감 → 서버 env(`AI_API_BASE`) origin 과 같을 때만 전송, 아니면 호출 0·MISCONFIGURED(TTS `readServiceSecretFor` 패턴 재사용). (b) **credentialRef 허용 목록** — `env:` 이름은 엔진 스키마가 허용한 이름만(home-m4 = API 키 변수 2개), 부팅 시크릿 계열(JWT·내부 시크릿·TTS 시크릿·DB URL·OAuth 시크릿·초대코드 등) 거부. 안 그러면 SUPER_ADMIN 이라도 ref 를 부팅 시크릿으로 바꿔 그 값을 연결 주소로 보낼 수 있다. `file:` 은 기존 이름 규칙(SECRETS_DIR 안). (c) **baseUrl 호스트 허용 목록** — loopback·LAN(192.168.219.0/24)·서버 env 에 적힌 서비스 origin 만, Validate(편집)·Health·Test·실호출 공통, userinfo·비 http(s) 거부. `connection.binPath` 는 계속 spawn 에 쓰지 않음(READ_ONLY) |
| D-C4 | **편집 가능 키 = 앱이 실제로 읽는 키만** | 03·resolver 는 스키마 키 전부를 편집 대상으로 가정 | 조사: 런타임은 resolver 가 아니라 행 JSON·env 를 직접 읽는다. → developer 가 C1 전에 **"편집 키 표"**(키·소비자 APP/PYTHON/CLIENT·editability·strict·현재 런타임 읽는 곳)를 만든다. 편집 허용 조건 = 소비자가 APP(Node) + **"런타임 실사용값 == Effective" 단위 테스트**. PYTHON 소비 키(gateway VAD·worker 모델 등)는 Python 이 DB 를 읽지 않으므로 콘솔 편집 거부(`SERVICE_MANAGED` — "서비스 설정 파일에서 관리"), 배선은 015c. CLIENT(ONDEVICE) 키는 `/api/v1/speech/config` 가 행 값을 싣는 경우만 허용. env 가 이기는 키는 Diff `blocked: SHADOWED_BY_ENVIRONMENT`(저장은 되나 효력 없음 — 편집 폼 잠금, admin-console/04 §7) |
| D-C5 | 첫 Apply 기준선·쓰기 조합 | 06 §11 "기동 시 SYSTEM v1" 미구현, §6-2 "없으면 version 0" | **첫 적용 때 같은 트랜잭션에서 v1 = 현재 행 스냅샷(`_meta.origin=BASELINE`, actor 시스템, 감사 `config.baseline`) → v2 = 적용** — seed 상태로 Rollback 가능, 기동 훅 불필요. 쓰기 조합은 admin(L0)이 `infra.withTransaction` 을 열고 소유 층 tx 함수 + `engine.configuration.recordVersion(tx)` + `infra.audit.record(tx)`(003g 패턴) |
| D-C6 | Rollback 의미·무결성 | 09 §4 전제 7조건 | 003g 와 동일 의미(ROLLED_BACK = 밀려난 직전 ACTIVE). 전제 3(대상 삭제됨)은 012c 에서 삭제 경로가 없어 불발생. 전제 4 = 엄격 재검증(422), 전제 5 = credentialRef 허용 목록·존재 확인, 6 = D-C1 흐름(Rollback 도 Functional Test 필수 — §8-4) |
| D-C7 | 캐시 무효화·파생 규칙 | §6-2 `config.cacheEpoch` 폴링 | 적용한 프로세스는 커밋 직후 `clearRouterCache` 등 즉시, 다른 프로세스(blue/green 전환 순간)는 기존 30초 TTL 수용 — epoch 폴링은 도입하지 않음(pm2 인스턴스 1). AppSetting `voice.preview.defaultText` 변경 시 `voice.preview.textVersion` 자동 +1(같은 트랜잭션 — 미리듣기 캐시 키 무효화, §44) |
| D-C8 | History·감사 조회 | #137 Phase 1 계약·미구현, 018 L2 | `/admin/history` 탭 3개: 설정 버전(#108·#108a·Rollback #109) · 감사(#137 — 필터 환경·scope·actor·action·기간, LEXICON 은 옛 `scope=null` `lexicon.*` 포함) · (사전 버전은 기존 사전 화면으로 링크). 감사 `before/after` 는 8KB 요약·마스킹 그대로, 값 없음 |
| D-C9 | Functional Test 30초 슬롯 원자성 | 005b Low 1 | **기존 컬럼 조건부 UPDATE**: `UPDATE EngineConnection SET lastFunctionalAt=now WHERE id=? AND (lastFunctionalAt IS NULL OR lastFunctionalAt < now−30s)` 영향 1행일 때만 실행(프로세스 간 원자, 스키마 0), 메모리 Map 제거. #105 config/test 도 같은 슬롯. `lastFunctionalAt` 의미가 "마지막 시작 시각"으로 바뀜 — 화면 표기 확인 |
| D-C10 | 정본 Phase 2 대비 범위 축소 | api-contract #92·#94 = Phase 2 · §11 Python push · §13 #7 = 012c | #92 연결 생성·#94 삭제 = **Phase 4**(Import·Preset 과 함께 — 새 어댑터 없이 만들 연결이 없고, 삭제는 Fallback 파손 위험) · Python 서비스 반영·Log level·Health 스케줄 = **015c** · SESSION override 슬롯 = **016**(Override 와 함께). 전부 정본 갱신 |
| D-C11 | 테스트 데이터·운영 보호 | 공유 DB, 운영 `APP_ENV=PRODUCTION` | 개발 검증은 격리 dev 서버(`APP_ENV=LOCAL`, 포트 3017 계열)·**LOCAL 행만**. 스모크는 시작 전 대상 행·버전 수 기록 → 끝에 **자기가 만든 버전 행만 id 삭제 + 대상 행 바이트 원복 대조**(003g 선례), AuditLog 는 남김. PRODUCTION 행은 라이브로 절대 건드리지 않는다(교차 환경 편집 포함) — PRODUCTION 경로는 단위 테스트 + 운영 반영 뒤 사용자 리허설(U-C7) |
| D-C12 | (012c-2 로 넘김, 기록만) Prompt Registry 성격 | admin-console/14: "DB `PromptVersion` ACTIVE body 가 런타임 우선, placeholder 템플릿" | 실제 프롬프트는 TS 빌더(예산·창·altText 로직, `*_PROMPT_VERSION` 9종 — `reviewDecision`(A11) 은 정본 키 표에 없고 `ask`·`planAnalysis` 는 미구현). **권고 A**: 코드 키 카탈로그·코드 버전 동기(sync 가 버전 상수·조립 예시·체크섬 기록)·조립 미리보기·draft 테스트, **런타임 ACTIVE 전환은 `teacher-persona`(tutor.md 마크다운)만**(예열 CLI 풀·persona 키 무효화 포함). B(빌더→템플릿 리팩터)는 10개 프롬프트 회귀·5초 예산 위험으로 비권고 |
| D-C13 | (012c-3·U-C1) TTS P1 재배치 | design-spec §15 012c 행·16 §15 | **Voice Versions·Canary → Phase 4(016)**: 새 모델 버전을 들여올 경로(Voice Package Import)가 Phase 4 라 Phase 2 에는 seed 1.0.0 한 행뿐 — 페이지가 비고 Canary 대상이 없다(1인 앱 실효성 §16 #5 도 낮음). **Golden·Regression·A/B 는 Phase 2 유지하되 "합성 조건 묶음"(voiceProfile·모델 버전 문자열·dictionaryVersion·정규화기 버전·speechProfile) 단위 회귀로 재정의** — 사전·정규화·M4 래퍼 변경의 회귀 검출은 지금 가치 있다. 회귀 잡은 `TtsQualityRun.status` 자체 클레임(JobKind 추가 없음), Golden 은 저장소 JSON 읽기 전용 우선(`TtsGoldenSentence` CRUD 는 선택). 대시보드는 012b-3(U4) 뒤 |

> 정본 갱신(D-C1·C2·C4·C5·C9·C10·C12·C13)은 C1 확정 뒤 Leader 가 한다 — 지금은 012b 가 정본 일부(api-contract·domain-model·module-dependency)를 막 갱신한 상태라 이 턴에서는 손대지 않았다.

### 역할 분담·파일 경계 (012c 1단계)
| 역할 | 담당 파일/기능 | 순서 |
|---|---|---|
| leader | C1 확정 · 정본 갱신(`docs/design/{configuration-resolution,api-contract,domain-model,role-permission}.md` 관련 절·`docs/design/admin-console/{06,08,09,10,16}`·`docs/design-spec.md` §15 012c 행 분할 + Versions/Canary 016 이관(U-C1 뒤)) · 데모 게시·승인 기록 · 최종 보고 | 1 · 6 |
| designer | `docs/screens.md` §13(신규) 관리자 콘솔 P2 — 설정 Form·Raw JSON·Diff 탭, 연결 상세 편집(엄격 키·credentialRef 연결 SUPER_ADMIN), 역할 페이지 Fallback 편집, 이력 화면(버전·감사·Rollback), PRODUCTION 확인 다이얼로그, 권한별 버튼 렌더링 규칙 · 데모 `docs/demo/task-012c-console-p2-v1.html` | 1(서버와 병렬) |
| developer A (서버, **opus**) | 신규 `src/modules/engine/configuration/{editable,validate,diff,versions,rollback}.ts`(+`appSettingSchema`) · 수정 `engine/configuration/resolver.ts`(편집 키 메타)·`engine/functionalTest/index.ts`(D-C9)·`engine/llm/index.ts`+`engine/adapters/llm/homeM4.ts`(D-C3a)·`engine/adapters/common/httpHealth.ts`(D-C3c)·`engine/{connections,fallbackPolicy}/index.ts`(tx 물화)·`engine/index.ts` · `src/modules/infra/{secrets,audit}.ts`(D-C3b·action 상수) · `src/modules/preferences`(AppSetting tx 쓰기 공개 함수) · `src/modules/speech/voices`(VoiceProfile defaults tx 쓰기 공개 함수) · 신규 `src/modules/admin/configuration/{editor,history}.ts` · 라우트 `src/app/api/admin/v1/{config/{validate,test,diff,apply,versions,versions/[id],versions/[id]/rollback,raw/[scope]/[targetId]},engine-connections/[id](PUT),engine-connections/[id]/{enabled,credential},fallback-policies/[role](PUT),app-settings/[key],audit}/route.ts` · `src/types/admin.ts` 설정 절(DTO 단일 출처) · 테스트 `src/modules/{engine,admin}/__tests__/task012c*.test.ts` · 라이브 `tests/live/task012c-smoke.{sh,ts}` | 2(C1 후) |
| developer B (화면, opus) | **데모 승인·activate 후에만**: `src/app/(admin)/admin/{configuration,connections/[id],speech/{realtime,analysis,tts},llm,history}/page.tsx` · `src/components/admin/{configEditor,history}/**` · `src/modules/admin/console/menu.ts`(raw·diff 탭·history phase 열기 — 소유 A 와 조율) · 화면 E2E `tests/live/task012c-ui-e2e.mjs` | 3 |
| reviewer | 6층(engine 이 speech·preferences 를 import 하지 않음·admin 조합)·capability 매트릭스·PRODUCTION 게이트(§8-1 전 항목)·Secret(값 0·ref 허용 목록·origin 고정)·SSRF·버전+감사 1:1·동시성·엔진명 하드코딩 0 | 4 |
| judge·codex | C1(설계 확정 직후)·C2(reviewer PASS 직후) — 초점 security | 1.5 · 4.5 |
| qa | 완료 기준 전부 · 2프로세스 경합(3017·3018) · 3폭+데스크톱 | 5 |
| deployer | QA PASS 뒤 webhook 배포(스키마 0 — `--with-migrate` 없음) | 6 |
| prompt-engineer | 012c 1단계 없음(012c-2 에서) | — |

- **다른 task 와의 경계**: 012b 가 **미커밋 상태**로 `src/modules/{infra/index.ts,infra/internalAuth.ts,infra/users.ts,admin/health.ts,engine/stt/index.ts,preferences/index.ts,speech/index.ts}` 를 고치고 있다 → developer A 는 **012b 커밋(QA PASS) 뒤 착수**하거나, 그 전이면 이 파일들을 건드리지 않는다(`infra/index.ts` export 추가는 012b 커밋 뒤). 010b·010c·010d·011·012 화면·서버는 `components/**`·`(app)/**`·`learning`·`conversation` — 012c 와 겹치지 않는다. `conversation/**`·`.claude/agents/tutor.md` 는 012c 에서 건드리지 않는다(012c-2).
- **push 금지**(push = 운영 배포 webhook). 커밋은 QA PASS 뒤. 화면 코드는 데모 `activate` 뒤.

### 완료 기준 (qa 가 실행으로 확인)
1. tsc·eslint·단위 전부 PASS, 격리 build exit 0, **`git diff prisma/schema.prisma` 빈 diff**.
2. 권한: 무세션 401 · USER 는 화면·API 전부 404 · ADMIN = Form 편집·Rollback(LOCAL) 가능, Raw JSON PUT·credential 403 · DEVELOPER = + Raw JSON, credential 403 · SUPER_ADMIN 전부. PRODUCTION 대상(단위): ADMIN·DEVELOPER 403 `missing:[config.apply.production]`, SUPER_ADMIN 은 `confirm` 없음 403 · `summaryHash` 불일치 409 · `testResultId` 없음/만료/실패 403 · `reason<10` 400, 엄격 키 위임 불가.
3. Validate: 오류 `stage`(JSON_SYNTAX·SCHEMA·DEPENDENCY)·`rule` 12종 형식, READ_ONLY·`SERVICE_MANAGED` 키 400, SECRET 평문 400(감사에도 값 0), 미지 키 `suggestion`, `x-` 키 보존.
4. Apply: 버전 +1·대상당 ACTIVE 1·직전 SUPERSEDED·대상 행 물화·AuditLog 1:1(행 수 대조) · **첫 적용 = 기준선 v1 + v2** · `baseVersion` 불일치 409 · **동시 2요청 한쪽만 200** · 변경 0 = 버전·감사 0(`changed:false`).
5. Diff: before/after `source`, env 가 이기는 키 `blocked:SHADOWED_BY_ENVIRONMENT`·편집 잠금, `restartRequired` 표시, 같은 후보의 `summaryHash` 재현.
6. Rollback: 새 ACTIVE(`restoredFromVersion`)·직전 ROLLED_BACK·복원 대상 상태 불변 · `ALREADY_ACTIVE`·`NO_CHANGE` 409 · 손상/규칙 위반 스냅샷 422(쓰기 0) · 스키마에서 사라진 키 `droppedKeys` 경고.
7. 효과: 편집 허용 키(D-C4 표)는 적용 프로세스에서 즉시·다른 프로세스 ≤30초 실제 호출에 반영(Trace·호출 인자로 확인), Rollback 뒤 원복. **"런타임 실사용값 == Effective" 단위 테스트가 편집 허용 키 전부**에 있음.
8. 보안: 허용 밖 baseUrl → Validate 400 + (DB 를 직접 바꿔도) 어댑터 호출 0·시크릿 전송 0 · credentialRef 가 어댑터 descriptor 허용 목록 밖이거나 전역 거부 분류 → **422 `E_REF_NOT_ALLOWED`**(CX-1, `env:`·`file:` 둘 다) · Health SSRF 허용 목록 · 응답·감사·스냅샷·서버 로그에 시크릿 형태 문자열 0(grep, 005b 방식).
9. #93b: SUPER_ADMIN 만, 값 필드 400, ref 형식·허용 목록·존재 확인, 버전+감사(`credentials.set`/`credentials.clear`).
10. FT 슬롯: 두 프로세스(3017·3018) 동시 요청 → 실행 1건(Claude 호출 1)·나머지 429.
11. #137: 필터·페이지, LEXICON 필터에 옛 `scope=null` `lexicon.*` 포함, `before/after` 에 값 0.
12. 화면(데모 승인 뒤): Form↔Raw JSON 단일 draft 동기화·Diff·적용·Rollback·PRODUCTION 확인 다이얼로그·권한별 버튼 **렌더링 0**(비활성 아님), 360/390/412 + 데스크톱 넘침 0, 엔진명 하드코딩 0(DTO 표시명만).
13. 회귀: 005b·003g 스모크 PASS, 회화 턴 p50 무영향(007 latency), 스모크 뒤 LOCAL 대상 행·버전 수 기준선 동일.
14. (Codex C1) CX-2: RESTART_REQUIRED·REDEPLOY_REQUIRED 키 편집 400 · 변경 키 일부만 실행 검증된 `config/test` = `partial`+`untestedKeys`·`testResultId` 없음 → 그 후보의 PRODUCTION 적용 403 · CX-3: `reason` 201자 400 · 줄바꿈이 공백으로 저장 · 비밀 유사 문자열 422 `E_REASON_SECRET_LIKE`(저장 0) · 서버 로그에 reason 원문 0.

### 네이티브 변경 / APK
없음. 플러그인·android·Manifest·Capacitor 설정 무변경. APK 재설치 불필요.

### 위험·주의
- **R2**: capability 매트릭스·`ConfigurationVersion`·Secret(`credentialRef`)·PRODUCTION 보호를 한꺼번에 여는 첫 쓰기 경로. judge 결과와 무관하게 R2(leader.md R2 보강).
- **운영이 PRODUCTION 이다**: 운영 반영 뒤 콘솔 적용은 **배포 없이 즉시 운영 행을 바꾼다**. 012c 의 PRODUCTION 게이트가 곧 운영 안전장치 — Codex C2 는 security 초점 권고.
- 공유 DB: 개발 LOCAL 행 편집은 개발 서버에만 영향. 교차 환경 편집(LOCAL 프로세스 → PRODUCTION 행)은 SUPER_ADMIN 만 + `crossEnvironment` 감사 — QA 는 라이브로 쓰지 않는다.
- 편집 허용 키를 넓게 잡으면 "콘솔 값 ≠ 실제 값"(D-C4) — 허용은 동등성 테스트가 있는 키만.
- Claude 구독: config/test 가 LLM 연결이면 1회 호출 — D-C9 슬롯으로 30초 1회, 스모크는 LLM 호출 수를 기록.

## DB 추가 목록 (단위별)
| 단위 | 추가 | 필수 여부 |
|---|---|---|
| **012c** | **없음**(D-C2 스키마 0 매핑). `ConfigurationVersion.diff`·`snapshot` 주석만 갱신(db push 불필요) | — |
| 012c (선택 대안) | `ConfigurationVersion.origin`(enum `ConfigVersionOrigin`)·`schemaVersion Int?` | 권고 안 함 |
| 012c-2 | 스키마 없음(D-C12 A). **데이터**: `PromptTemplate` 카탈로그 행·`PromptVersion(SOURCE_CODE)` — sync 가 씀(운영은 배포 단계에서 DRAFT 만) · 선택 `PromptVersion.syncedFromSha` | 데이터만 |
| 012c-3 | **`TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare`**(+ 선택 `TtsGoldenSentence`) · 대시보드는 012b-3 의 `EngineMetricsDaily` TTS 컬럼(U4) 선행 | 필수(U-C3) |
| Phase 4(016, 권고 이관) | `VoiceModelVersion`·enum `VoiceDeployStatus`·`VoiceModel.currentVersionId`·`ConfigScope.VOICE_MODEL_VERSION` — 정본 불일치 주의: 16 §10.1 은 `@@unique([voiceModelId, environment, version])`(environment 포함), domain-model §10 은 environment 없음 | 016 |

## 사용자 결정·승인 필요 목록
| # | 항목 | 필요 시점 | 막는 범위 | 기본안 |
|---|---|---|---|---|
| U-C1 | **TTS P1 재배치**(012b U6 ①·⑤ 후속): Golden·회귀·A/B·TTS 대시보드 = Phase 2(012c-3) 유지, **Voice Versions·Canary = Phase 4(016, Voice Package Import 와 함께)** — design-spec 결정 ③의 부분 변경 | 012c-3 착수 전 | 012c-3 범위·정본 표 | 권고안(이관) |
| U-C2 | 합격 기준 수치(speech-platform/16 §9.4) — Versions 가 Phase 4 로 가면 012c-3 에선 **회귀 경보 기준**으로만: 실패 0%·지연 p95 ≤ 기준×1.2·읽기 일치 ≥98%·길이 Δ ±15%(95%)·청취 점수 | 012c-3 착수 전 | 012c-3 판정 | 초안 값 |
| U-C3 | 012c-3 **DB 추가**(`TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare` [+`TtsGoldenSentence`]) — 백업 후 db push | 012c-3 착수 | 012c-3 | 추가 |
| U-C4 | **012c 화면 데모 승인**(설정 Form·Raw JSON·Diff·적용·이력·Rollback·비밀 참조 연결·Fallback 편집·PRODUCTION 확인) | 화면 구현 전 | 012c 화면(서버는 진행) | 데모 후 |
| U-C5 | (확인, 기본안으로 진행) Prompt Registry 범위 — **콘솔에서 운영 프롬프트를 바꾸는 기능은 강사 페르소나만**, 나머지 프롬프트는 보기·비교·테스트(D-C12 A) | 012c-2 C1 | 012c-2 설계 | A |
| U-C6 | (정보) 범위 축소: 연결 생성·삭제·Override·Preset·Import = Phase 4, Python 서비스 설정 반영·Log level·Health 스케줄 = 015c(D-C10) | — | 없음 | 권고안 |
| U-C7 | 운영 반영 뒤 **PRODUCTION 적용 리허설** — 사용자 본인(SUPER_ADMIN) 계정으로 비엄격 키 1건 적용 → Rollback(QA 계정은 운영에서 역할이 인정되지 않음) | 012c 운영 반영 직후 | PRODUCTION 경로 라이브 확인 | 리허설 1회 |
| (참고) | Codex 한도 값이 `null`(stale 2026-09-27) — C1·C2 는 R2 라 `CX-limit-unknown-r2` 규칙. 원하면 Codex `/status` 값을 `codex-review.sh set-limit` 으로 기록 | 선택 | 없음 | — |

## 데모 검토 (demo gate)
| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 09-29 02:34 |
| v1 | 검토요청 | docs/demo/task-012c-console-p2-v1.html | - | 사용자 검토 요청 | 09-29 03:13 |
| v2 | 작성중 | docs/demo/task-012c-console-p2-v1.html | - | designer: v1 은 게시 전 — Codex C1(CX-1~3, 03:05 채택) 반영해 v2 로 교체 | 09-29 03:18 |
| v2 | 검토요청 | docs/demo/task-012c-console-p2-v2.html | - | 사용자 검토 요청 | 09-29 03:18 |
| v2 | 승인 | docs/demo/task-012c-console-p2-v2.html | https://claude.ai/artifact/6xHJK9pXzMpWxCfSZaT65o | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |

**designer 데모 범위(v1, full)** — 콘솔 셸(기존 §6 규칙)·데스크톱 우선 + 390px:
1. 설정(`/admin/configuration`) 탭: Effective(기존) · **Form**(스키마 자동 생성 필드·editability/source 배지·env 가 이긴 키 잠금 안내·`SERVICE_MANAGED` 키 안내) · **Raw JSON**(읽기 기본, DEVELOPER 에게만 편집 토글·라인 오류 마커·suggestion) · **Diff**(변경 행 색·blocked·재기동 필요 배너·변경 요약) — Form·JSON 은 하나의 초안.
2. 적용 흐름: [검증] → [테스트](결과 카드) → [변경 요약] → [적용](이유 입력) · **PRODUCTION**: SUPER_ADMIN 확인 다이얼로그(Diff 요약·테스트 결과·이유 ≥10자·`PRODUCTION` 입력·"PRODUCTION 에 적용") / 비 SUPER_ADMIN 은 "초안·변경 요약까지 — 최고관리자 확인 필요" 상태.
3. 연결 상세(`/admin/connections/[id]`) 편집: 엄격 키(주소·모델·사용 여부) 빨간 표시, **비밀 참조 연결 시트**(SUPER_ADMIN 만 — ref 목록에서 선택, 값 입력 칸 없음), enable/disable(이유).
4. 역할 페이지(음성 인식·음성 합성·LLM) **Fallback 편집**(주 연결·예비 순서 — 드래그 대신 위/아래 버튼, 마지막 연결 비활성 방지 안내).
5. **이력**(`/admin/history`): 설정 버전 목록(ACTIVE·SUPERSEDED·ROLLED_BACK·기준선 배지·되돌림 표시)·버전 상세(Diff·`compare=previous|active`)·**Rollback 확인**(지금과 비교·이유·PRODUCTION 확인) · 감사 탭(필터·행 펼침 before/after 요약·발음 사전 분류).
6. 상태: 409 충돌(다른 변경이 먼저 — 입력 유지 + 새로 불러오기), 422 손상 버전(되돌리기 버튼 숨김), 재기동 필요 배지, 권한 없는 버튼은 **렌더링하지 않음**.
7. "결정 필요" 표(designer → Leader): Form 필드 그룹핑, 모바일에서 Raw JSON 편집 경고 수준, 감사 before/after 표시 방식.

## 판단 기록 (judge)
- [2026-09-29 02:33] intake engine=jev → task_type=feature · complexity=2.83 · risk=R2 · developer_model=opus · roles=designer,prompt-engineer?,developer,reviewer,qa · next=demo_first · actions=prepare_demo,request_demo_approval,assign_developer · blocking_gate=demo | overrides=- | fallback=- | tokens=1968 | demo=full/designer (ui_change new_screen 0.66 · rule JV-ui_change+DM-new-route)
- [2026-09-29 02:35] codex_gate/C1 engine=jev → **codex_required=true** / wanted_before_budget=true / mode=adversarial-review / focus=security(0.80) / budget_rule=CX-limit-unknown-r2 / codex_switch=on / calls_used=0 (design_uncertainty 1.81) | overrides=- | fallback=- | tokens=1237
  - Codex 호출은 Leader(메인)가 한다(이 에이전트는 판정·기록만). 초점 제안: D-C1 무상태 summaryHash·testResultId 재사용/교차 대상, D-C3 origin 고정·credentialRef 허용 목록·호스트 허용 목록 우회(리다이렉트·IPv6·DNS 재바인딩·userinfo), D-C5 기준선+적용 한 트랜잭션의 동시성, D-C6 Rollback 재검증 우회, 교차 환경 편집.
- [2026-10-01 13:44] codex_gate/C2 engine=jev → codex_required=true / wanted_before_budget=true / mode=adversarial-review / focus=security(0.86) / budget_rule=CX-limit-unknown-r2 / codex_switch=on / calls_used=2/4 | overrides=CX-r2-post-review | fallback=- | tokens=1290

## 작업 기록

### 2026-09-29 02:30 Leader — 접수·범위 분할
- 과거 이력(005b·003g·003d·018·009·012b·004·007)과 정본(design-spec §9-B·§9-C·§15·§16, admin-console 00·01·03·04·06~11·14·16, configuration-resolution §6~§13, role-permission, api-contract #80~#137, domain-model §10, speech-platform/16 §7·§9·§10·§15·§16)에서 012c 로 넘어온 항목을 수집(위 표).
- 코드·스키마 대조(위 "현황 대조"): 설정 쓰기 경로 0 · `ConfigurationVersion` 0행 · #108·#137 미구현 · 런타임은 행 JSON·env 직접(resolver 는 화면 전용) · **home-m4 API 키가 DB baseUrl 로 origin 확인 없이 전송**(편집을 열면 유출 경로 — D-C3a) · Python 서비스에 설정 push 수신 경로 없음 · TTS P1 엔티티 전부 스키마에 없음 · 프롬프트는 TS 빌더(정본의 템플릿 본문 모델과 불일치 — D-C12).
- 범위 = **012c(1단계): 설정 편집 코어 + 이력·Rollback·credentialRef(서버+화면, 스키마 0)**. 012c-2(Prompt Registry+Playground), 012c-3(TTS Quality+대시보드, DB 추가) 분할, Voice Versions·Canary 는 Phase 4 이관 권고(U-C1). 설계 결정 후보 D-C1~C13 → C1 에서 확정.

### 2026-09-29 02:34 Leader — judge intake·demo gate
- `judge-result@2`(engine jev, needs_info=false): feature · complexity 2.83 · **R2** · developer **opus** · demo **full**(ui_change new_screen 0.66 + DM-new-route — 새 이력 화면) · `next=demo_first` · blocking_gate demo.
- `check.mjs init` → demo_gate `drafting`(아래 frontmatter). 승인·activate·waive 는 하지 않음(사용자만).
- 다음: (1) Leader(메인) C1 설계 확정(D-C1~C11, 특히 D-C1 확인 방식·D-C3 선결 보안·D-C4 편집 키 표·D-C5 기준선) → judge `codex_gate` C1 → 정본 갱신 (2) **designer 데모 v1**(위 범위, 서버와 병렬) → Artifact 게시·`status review_requested` → 사용자 승인 대기 (3) developer A(opus) 서버 — **012b 커밋 뒤** 착수(파일 경계), C1 전에는 "편집 키 표"(D-C4) 조사만 선행 가능.

### 2026-09-29 03:20 Leader(메인) — 설계 결정 D-C1~D-C12 확정
- **채택(권고대로)**: D-C1(PRODUCTION 확인 = configuration-resolution §8-1 Diff 해시+테스트 결과 id+이유, 확인 문자열 "PRODUCTION"(003g 와 통일), 해시는 적용 시 재계산 대조, HMAC 토큰 폐기) · D-C2(스키마 0 — source=AuditLog.action, rollback=restoredFromVersion, schemaVersion=스냅샷 `_meta`) · D-C4(편집 가능 키 = 앱(Node)이 실제로 읽는 키만, "런타임 실제 값 == 화면 값" 단위 테스트, Python 읽는 키는 편집 거부 — developer 가 "편집 키 표" 선행) · D-C5(첫 적용 시 같은 트랜잭션에 v1 기준선+v2) · D-C6(003g 의미의 Rollback + 스냅샷 엄격 재검증, 손상 422) · D-C7(타 프로세스 30초 지연 수용, 미리듣기 문장 변경 시 버전 자동 증가) · D-C8(설정 버전·감사·Rollback 한 화면, 발음 사전 옛 감사 포함) · D-C9(`lastFunctionalAt` 조건부 갱신으로 30초 슬롯 원자화) · D-C10(연결 생성·삭제 → Phase 4, Python 반영 → 015c, SESSION 오버라이드 → 016 — 정본 갱신, 사용자에게는 정보로 알림 U-C6) · D-C11(LOCAL 행만, 운영 행 라이브 금지) · D-C12(Prompt Registry A안 — 카탈로그·버전·조립 미리보기·테스트, 런타임 전환은 강사 페르소나만; 012c-2 기록용, U-C5 는 기본안으로 진행).
- **D-C3 은 편집 기능의 선결 게이트(차단 조건)**: (a) 비밀을 보내는 모든 어댑터의 전송 대상을 서버 env 주소로 고정 — **현재 home-m4 API 키가 DB 의 연결 주소로 전송됨**(`engine/llm/index.ts` 209~212) → 012c 서버 첫 커밋에 포함, 주소 편집 API 는 (a)(b)(c) 통과 전 열지 않는다 (b) 부팅 비밀을 가리키는 credentialRef 거부 목록 (c) 연결 주소 호스트 허용 목록.
- **D-C13 보류 — 사용자 결정 U-C1**(Voice Versions·Canary Phase 4 이관). 012c-3(TTS 품질)은 U-C1·U-C3(DB) 뒤.
- 다음: judge C1 codex_gate → 정본 갱신(Leader 에이전트) ∥ designer 데모 v1(full) → **사용자 승인 대기**. developer A 는 012b 커밋 뒤 착수(겹치는 파일), 그 전엔 "편집 키 표" 조사(읽기 전용)만.


### 2026-09-29 02:35 Leader — judge C1 codex_gate
- 입력: 설계 확정 요약(D-C1~D-C12, 코드·비밀 없음) + 예상 변경 경로 20, risk R2, 한도 `null`(stale 2026-09-27), user_requested false.
- 결과: **`codex_required=true`** · mode `adversarial-review` · focus `security` · budget_rule `CX-limit-unknown-r2` · 호출 0/4 · 스위치 on. → **Codex C1 호출은 Leader(메인) 몫**(이 에이전트는 호출하지 않음). 결과가 오면 채택분을 정본·아래 인계에 반영하고, 실패(⚠)면 진행하되 실패 내역을 최종 요약에 남긴다.

### 2026-09-29 02:45 Leader — 정본 갱신(C1 확정 반영, 012b 절 무수정)
- `docs/design/configuration-resolution.md`: §6-1 머리 단락(무상태 summaryHash·testResultId = EngineHealth id·편집 키 = 앱 소비 키·push 015c) · §6-2 "task-012c 확정" 단락(admin 조합·첫 적용 기준선 v1·`_meta`·diff 봉투·변경 0·캐시 30초·push 없음) · §6-3 Rollback 재검증(422 `E_SNAPSHOT_INTEGRITY`, ROLLED_BACK 의미) · §8-1 표(`confirm:"PRODUCTION"`·`SUMMARY_MISMATCH`·`PRODUCTION_TEST_REQUIRED`) + 토큰 폐기 주석 · §10 편집 선결 게이트 D-C3(a)(b)(c) · §11 Python 반영 015c 이관 · §13 #6→015c·#7→016·#9 결정(cacheEpoch 없음)·#11 012c.
- `docs/design/role-permission.md`: §4-2 connection 생성·삭제 Phase 4 · §6 규칙 1(확인 문자열 `"PRODUCTION"`·오류 reason 3종)·10(페르소나만 activate)·11(확인 다이얼로그 `PRODUCTION` 입력, 버튼 미렌더링) · §7 action 에 `config.raw_apply`·`config.baseline`.
- `docs/design/api-contract.md`(012c 절만 — #21·#21a·#22·#138~#140·§2-28·§2-30 무수정): §1-3 표 Phase 칸(012c·012c-2·#92/#94 Phase 4·#93b/#137 = 012c) · §2-19 확인 방식 통일 + 편집 선결 게이트 · §2-21 #92/#94 이관·#93(편집 키·serviceManaged·push 015c)·#93a·#93b(허용 목록·버전·감사 `credentials.set|clear`)·#96 30초 슬롯 원자화 · §2-23 머리 규칙(쓰기 조합·잠금·기준선·변경 0·`_meta`·diff 봉투·캐시·rule 15종) + #105 testResultId + #106 무상태 summaryHash·blocked + #107 PRODUCTION 오류·AppSetting 파생 + #108/#108a origin·integrity·compare + #109 재검증 + #111 봉투 · #123b 일반 키만·`voice.default.profileId` · §2-26 A안 · §2-27 #137 구현 규칙 · §7-2 Voice Versions 행 "사용자 결정 대기".
- `docs/design/admin-console/`: 00 §7(분할 요약) · 01 §3 표(Connections·Prompts·Playground·History·Voices›Versions·TTS Quality·TTS 대시보드)·§10 · 06(보조 필드 결정·기준선·Phase 실제) · 08(토큰 폐기·`SERVICE_MANAGED`) · 09(§3 머리 — 토큰·재검증·TARGET_DELETED·push 015c) · 10(§4 머리) · 14(A안 머리) · 16(§6 토큰 폐기·§9 Override 016·§11).
- `docs/design-spec.md`: §9-C Phase 괄호 · §9-D P1 매핑(버전·Canary 사용자 결정 대기) · §15 012c → 012c / 012c-2 / 012c-3 세 행, 015c(+Python 반영·Health 스케줄), 016(+Override 요청별·연결 생성/삭제·(U-C1 시) Versions·Canary) · §16 TTS 결정 ③ 주석.
- `docs/design/speech-platform/16-tts-productization-layer.md`: §15 표(대시보드·Golden → 012c-3, Versioning·Canary → **사용자 결정 대기**) · §16 #4(U-C2)·#5(U-C1 대기).
- `docs/design/domain-model.md`: 모델 표 `ConfigurationVersion` 행만(기준선·`_meta`·diff 봉투·ROLLED_BACK) — Prisma 블록·§5-8·§5-9 무수정. `docs/design/module-dependency.md`: 규칙 6 에 admin 조합(D-C5) 괄호만.
- 이름 정합: credentialRef 감사 action 은 role-permission §7 의 `credentials.set|credentials.clear` 로 통일(admin-console/07 의 `credential.link|unlink` 는 옛 표기 — 07 은 이번에 고치지 않았다, 구현은 role-permission 이 정본).

### 2026-09-29 03:05 Leader(메인) — Codex C1 지적 3건 판정(설계 단계, Leader 판정)
- **CX-1 [high] 채택** — credentialRef `file:`/`env:` 에 **어댑터별 정확한 허용 목록**(descriptor 가 선언: 예 home-m4 LLM 어댑터 = 자기 키 참조만) + 전역 거부 분류(부팅·내부 시크릿: JWT·SPEECH_INTERNAL_SECRET·TTS_SERVICE_SECRET·DB·OAuth 등). 목록 밖 참조는 422. D-C3(b) 를 이것으로 대체.
- **CX-2 [high] 채택** — `testResultId` 는 **변경된 모든 키를 실제로 실행해 검증했을 때만** 발급(검증 못 한 키가 하나라도 있으면 결과는 `partial` + untestedKeys, id 없음 → PRODUCTION Apply 불가). **012c 편집 가능 키에서 RESTART_REQUIRED 키 제외**(D-C4 편집 키 표에 열 추가) — 필요해지면 배포 검증과 묶는 별도 설계.
- **CX-3 [medium] 채택** — 확인 이유(reason): 길이 상한(200자)·줄바꿈 제거·비밀 유사 문자열 거부(긴 고엔트로피 토큰, `sk-`·`ghp_`·`AKIA`·`Bearer `·`password=`/`secret=`/`token=` 류) → 422, 로그에는 reason 을 싣지 않음(AuditLog 에만).
- 다음: 정본 반영(Leader 에이전트) → C1 종결. D-C3 게이트는 CX-1~3 반영 후에만 개방.

### 2026-09-29 02:54 Leader — Codex C1 반영·C1 종결
- 정본 반영(012b 절 무수정):
  - **CX-1**(credentialRef 어댑터별 정확 허용 목록 + 전역 거부 분류, 위반 `422 E_REF_NOT_ALLOWED` — D-C3(b) 대체): `docs/design/configuration-resolution.md` §10 (b)·게이트 문장 · `docs/design/api-contract.md` §0-5 422 행·§2-19 (b)·#93b 검사 순서·#101 `allowedFor` · `docs/design/admin-console/03`(스키마 메타 `allowedRefs`·SECRET_REF 선택지) · `docs/design/admin-console/07`(옛 감사 표기 `credential.link|unlink` → `credentials.set|clear` 정리 + action 이름 주석) · `docs/design/admin-console/10`(머리 rule) · `docs/design/speech-platform/08` §3.1 주석.
  - **CX-2**(`testResultId` 는 변경 키 전부 실행 검증 시에만, 아니면 `partial`+`untestedKeys`·id 없음 → PRODUCTION 적용 불가 · 012c 편집 키에서 RESTART_REQUIRED·REDEPLOY_REQUIRED 제외 `rule:restartRequired`): configuration-resolution §6-1 머리 ⑤·§8-1 `testResultId` 행·§12-3 "미래 흐름" 주석 · api-contract §2-23 rule 목록·#93 ①·#96(PRODUCTION 용 아님)·#105(`status ok|partial|failed`·`testedKeys`·`untestedKeys`)·#106 blocked·#107 · role-permission §6 규칙 1 · admin-console/08 blocked·10·16 머리.
  - **CX-3**(`reason` 1~200자(PRODUCTION 10~200)·줄바꿈 제거·비밀 유사 `422 E_REASON_SECRET_LIKE`·프로세스 로그 미기록): role-permission §6 규칙 2·**§7 `reason` 규칙(판정 패턴 정본)** · api-contract §2-19·#107 · configuration-resolution §8-1 `reason` 행 · admin-console/07 §5.
- 아래 "developer 인계" 를 CX-1~3 에 맞춰 고쳤다(편집 키 표 열 추가·첫 커밋 (b) 교체·testedKeys·reason 검사).
- **C1 종결**(2026-09-29 02:54, 시스템 시각): judge C1 `codex_required` → Codex 1/4 → 지적 3건 전부 채택 → 정본 반영 완료. D-C3 게이트는 CX-1~3 구현·reviewer 통과 뒤에만 연다.

### 2026-09-29 10:14(시스템 시각) Leader — 정본 정리(서버 2단계 결과, 코드 무수정)
- **D-C14**(VoiceProfile 편집 → 012c-2, `scope=VOICE_PROFILE` → `400 SCOPE_DEFERRED`): `docs/design/api-contract.md` §1-3 #84 Phase·§2-20 #84·§2-23 머리(scope·쓰기 조합) · `docs/design/configuration-resolution.md` §6-2 · `docs/design/admin-console/{00 §7, 01 Voices 행, 06 §7 기준선 행, 16 §3 머리}` · `docs/design-spec.md` §15 012c·012c-2 행.
- **교차 환경 쓰기**(PRODUCTION 대상 + 프로세스 환경 다름 → 바뀐 키 전부 NOT_NEEDED 일 때만, 아니면 `403 CROSS_ENVIRONMENT_TEST_UNAVAILABLE`, #105 교차 호출은 항상 403): configuration-resolution §7 교차 편집·§8-1 표(교차 환경 행) · admin-console/16 §3 머리 · api-contract §2-23 머리·#105·#107.
- **"정본과 다르게 한 점" 반영**: #102 `edit{version, keys[ConfigKeyPolicyDto]}` · #105·#106 `versionId` 입력 · #105 `400 NO_CHANGE`·결과 `detail.config`·Fallback `related` · #106 `summary.notNeeded/unverifiable`·행 `verifiable` · Validate rule **16종** · 잠금 이유 9종(`CREDENTIAL_ONLY`·`DEFERRED`·`NOT_CONSUMED`·`ENV_PINNED`·`AUTO`·`POLICY` 등) · #107 `PRODUCTION_TEST_REQUIRED` detail 8종 · #109 스냅샷에 없던 키 = 기본값(같은 스키마 버전)·credentialRef 바뀌는 되돌리기 `credentials.manage`·AppSetting `exists:false` 기준선 · #111 키 삭제 400 · #123b 정책 키 읽기만(`POLICY`)·textVersion `AUTO`·편집 가능 키 3종(`speech.review.threshold` PRODUCTION 잠금) · admin-console/08 머리(#106 기준으로 정합).
- **편집 정책 = 어댑터 스키마 메타**(`consumer`·`consumerBy`·`verify`·`envPinned`·`runtimeMax`·`runtimeEnvWins`·`consoleEdit`): admin-console/03 §3 표 + §5 머리 · api-contract §2-23 머리.
- **TTS `runtime.maxChars` 편집 닫음**(재개 조건 = 문장 분할기가 연결 값을 쓰게 될 때): api-contract #93 ① · admin-console/03 §5 머리 · design-spec §15 012c 행.
- **STT 한계**(기능 테스트 없음 → STT 연결 켜기·STT Fallback 변경·클라이언트 소비 STT 키·`speech.review.threshold` 는 PRODUCTION 불가, LOCAL 가능): configuration-resolution §8-1 머리 주석 · api-contract §2-23 머리 · design-spec §15 012c 행.
- 012b 절 무수정(api-contract 변경은 §1-3 표·§2-20·§2-23 뿐). REV-036 감사 중인 코드 파일은 읽기만 했다(`registry/types.ts`·`types/admin.ts` — 메타·DTO 이름 확인).

### developer 인계 (2026-09-29, Leader → developer A(opus) — 서버)
**착수 시점**: **task-012b 커밋(QA PASS) 뒤**. 012b 가 미커밋으로 `src/modules/{infra/index.ts,infra/internalAuth.ts,infra/users.ts,admin/health.ts,engine/stt/index.ts,preferences/index.ts,speech/index.ts,speech/utterances/**}` 를 고치고 있다 — 그 전에는 아래 0단계(읽기 전용 조사)만. Codex C1 결과가 오면 채택분을 먼저 반영한다(Leader 가 이 절에 덧붙임).

**읽을 것(이 순서)**: 이 이력서 "003g 패턴 재사용"·"설계 결정 후보 D-C1~D-C13" 표 + "03:20 Leader(메인) 확정" + "02:45 정본 갱신" → `docs/design/configuration-resolution.md` §6-1~§6-3(012c 단락)·§8-1·§8-2·§10(편집 선결 게이트)·§11 · `docs/design/api-contract.md` §2-19·§2-21(#93·#93a·#93b·#96)·§2-23(머리 규칙~#111)·§2-24 #123b·§2-27 #137 · `docs/design/role-permission.md` §3·§4-2·§6·§7 · `docs/design/admin-console/{03,04,06,08,09,10}`(머리 주석 우선) · `docs/design/module-dependency.md` 규칙 6·8 · 선례 코드 `src/modules/admin/speech/lexicon.ts`(L0 조합·PRODUCTION·감사) · `src/modules/speech/tts/lexiconStore.ts`(잠금·버전 전이) · `lexiconRules.readSnapshotStrict`(엄격 재검증) · `src/modules/admin/permissions/*` · `src/modules/engine/configuration/resolver.ts` · `src/modules/engine/router/index.ts`(행 JSON·30초 캐시·`clearRouterCache`).

**범위 = 012c 1단계 서버. 스키마 0 · 화면 0(데모 게이트) · M4·Python 0.**
0. **"편집 키 표" 선행(012b 커밋 전에도 가능, 읽기 전용)** — 각 어댑터 스키마 키(`src/modules/engine/adapters/**/*.provider.ts`) × 열 {**소비자** APP/PYTHON/CLIENT · **런타임이 실제로 읽는 곳**(파일:행 — 행 JSON 인지 env 인지) · **editability**(RESTART_REQUIRED·REDEPLOY_REQUIRED 면 012c 편집 불가 — Codex C1 CX-2) · strict · env 가 이기는지 · **실행 검증 방법**(`config/test` 가 후보 값으로 실제로 무엇을 실행해 이 키를 검증하는가 — 없으면 "검증 불가 → PRODUCTION 편집 불가" 로 표시, CX-2) · SECRET_REF 면 **`allowedRefs`**(정확한 ref 목록, CX-1) · 012c 편집 허용 여부와 이유}. `FALLBACK_POLICY` 칸, `AppSetting` 일반 키(`appSettingSchema` 초안), `VoiceProfile.defaults` 칸 포함. 결과를 이 이력서 "Developer 기록" 에 표로 → **Leader 확인 뒤 확정**(허용 = APP 소비 + RUNTIME_EDITABLE + 동등성 테스트 가능한 키만, D-C4·CX-2).
1. **첫 커밋 = D-C3 선결 게이트 + Codex C1 CX-1·CX-3 공용 검사 + D-C9** (주소·자격 키 편집 API 는 이 커밋이 reviewer 를 통과하기 전 열지 않는다):
   - (a) home-m4 API 키 전송 대상 고정 — `src/modules/engine/llm/index.ts` 209~212(DB `connection.baseUrl` 로 키 전송)를 TTS 의 `infra.readServiceSecretFor` 방식으로: 허용 origin = 서버 env(`AI_API_BASE`) origin, 다르면 호출 0·`MISCONFIGURED(TARGET_NOT_ALLOWED)`. 시크릿을 보내는 다른 어댑터가 더 있는지 전수 확인해 기록.
   - (b) **credentialRef — 어댑터별 정확한 허용 목록 + 전역 거부 분류(Codex C1 CX-1, 처음 안 대체)**: 각 어댑터 descriptor 가 SECRET_REF 키에 `allowedRefs`(정확한 `env:`·`file:` 목록 — 예: home-m4 = 자기 API 키 ref 뿐, TTS = 토큰 파일 ref 뿐)를 선언. 검사 순서 = 전역 거부 분류(부팅·내부 시크릿: 세션 서명 키·내부 서비스 시크릿·TTS 서비스 시크릿·DB URL·OAuth 시크릿·초대코드 등 — 실제 이름 목록은 코드 상수, 같은 이름의 `file:` 포함) → descriptor 목록 → 형식 → 존재. 위반 `422 UNPROCESSABLE {reason:"E_REF_NOT_ALLOWED"}`(Validate 는 `rule:"refNotAllowed"`). `GET secrets`(#101) 에 `allowedFor[]` 추가.
   - (CX-3) **`reason` 공용 검사 함수**(`infra`): 줄바꿈·제어문자 → 공백·trim, 1~200자(PRODUCTION 10~200, `400`), 비밀 유사(role-permission §7 패턴 — 접두 `sk-`·`ghp_`·`AKIA`·`Bearer `·JWT 모양, 키=값 `password=`·`secret=`·`token=`·`api_key=` 류, 24자↑ 고엔트로피 토큰) → `422 {reason:"E_REASON_SECRET_LIKE"}`(원문 되돌려주지 않음), 통과 값은 AuditLog·ConfigurationVersion 에만 — **console/pm2 로그에 reason 출력 금지**(길이만). 발음 사전 쓰기 경로에 같은 함수를 붙일지는 Leader 확인 후.
   - (c) 연결 주소 호스트 허용 목록 — loopback·`192.168.219.0/24`·서버 env 서비스 origin, userinfo·비 http(s)·리다이렉트 추종 거부. Health(`engine/adapters/common/httpHealth.ts`)·Functional Test·실호출·Validate 공통 헬퍼. `rule:"hostNotAllowed"`.
   - D-C9: `src/modules/engine/functionalTest/index.ts` `claimSlot` → `EngineConnection.lastFunctionalAt` 조건부 UPDATE(영향 1행일 때만), 메모리 Map 제거.
   - 단위 테스트(반례: 다른 origin·같은 host 다른 port·IPv6·기본 포트 표기·userinfo·리다이렉트·부팅 시크릿 ref·없는 ref) → reviewer 먼저 한 번(Leader 가 REV 요청).
2. `src/modules/engine/configuration/{editable,validate,diff,versions,rollback}.ts`(+ `appSettingSchema`) — Validate 5단계·rule 15종, Diff(blocked·무상태 summaryHash), 버전 기록(기준선 v1·`_meta`·diff 봉투·`restoredFromVersion`), 목록/상세/compare/integrity, Rollback 엄격 재검증. engine 은 버전·검증·Diff 만 — 대상 물화는 소유 층. **CX-2**: Validate 가 RESTART_REQUIRED·REDEPLOY_REQUIRED 키 변경을 `rule:"restartRequired"` 로 거부, Diff `blocked:RESTART_REQUIRED`. `config/test`(#105) 는 키별 "실행 검증 방법"으로 실제 실행한 키만 `testedKeys` 에 넣고 **변경 키 전부 검증됐을 때만 `status:"ok"` + `testResultId`**(= `EngineHealth(FUNCTIONAL).id`, `detail{candidateHash, testedKeys}`), 아니면 `partial`(+`untestedKeys`)·`failed` — id 없음. #96 결과는 PRODUCTION 용이 아니다.
3. 소유 층 tx 쓰기 공개 함수: engine(`EngineConnection` 칸·enabled·credentialRef, `EngineFallbackPolicy`) · preferences(`AppSetting` — `voice.preview.defaultText` 변경 시 `textVersion` +1) · speech(`VoiceProfile.defaults`·표시명·정렬). 전부 `(tx, …)` 인자.
4. `src/modules/admin/configuration/{editor,history}.ts` — `infra.withTransaction` 하나(대상 행 `FOR UPDATE` → `baseVersion` → 기준선 → 물화 → 버전 → 감사), PRODUCTION 게이트 전 항목(`confirm:"PRODUCTION"`·summaryHash 재계산·testResultId(`EngineHealth` 행: ok·30분·대상·`detail.candidateHash`)·reason≥10·SUPER_ADMIN·엄격 키 본인·교차 환경 `crossEnvironment`), 감사 action(`config.baseline|apply|raw_apply|rollback`·`credentials.set|clear`·`engine.connections.enable|disable`), 커밋 뒤 캐시 무효화. #137 감사 조회(LEXICON = 옛 `scope=null` `lexicon.*` 포함). PRODUCTION `testResultId` 확인에 **`testedKeys ⊇ 이번 변경 키`**(CX-2)를, 모든 쓰기에 CX-3 `reason` 검사를 넣는다.
5. 라우트: `src/app/api/admin/v1/{config/{validate,test,diff,apply,versions,versions/[id],versions/[id]/rollback,raw/[scope]/[targetId]},engine-connections/[id](PUT 추가),engine-connections/[id]/{enabled,credential},fallback-policies/[role](PUT 추가),app-settings/[key],audit}/route.ts` — 첫 줄 `requireCapability`, 얇게. DTO 는 `src/types/admin.ts` 설정 절(단일 출처).
6. 테스트: `src/modules/{engine,admin}/__tests__/task012c*.test.ts` — 매트릭스(ADMIN Form·DEVELOPER Raw·SUPER_ADMIN credential), PRODUCTION 게이트 전 분기(가짜 env), 기준선·동시 2요청·변경 0·NO_CHANGE·ALREADY_ACTIVE·422 재검증·droppedKeys, **편집 허용 키 전부 "런타임 실사용값 == Effective" 테스트**, 감사 1:1, 시크릿 grep 0. 라이브 `tests/live/task012c-smoke.{sh,ts}`. **Codex C1 반례 추가**: 다른 연결의 ref(허용 목록 밖)·전역 거부 ref(`env:`/`file:` 둘 다)·descriptor 가 실수로 허용한 부팅 시크릿 ref → 422 · RESTART_REQUIRED 키 편집 400 · 일부 키만 검증된 테스트 → `partial`·id 없음 → PRODUCTION 403 · 다른 후보/다른 대상의 testResultId 재사용 403 · reason 201자 400·줄바꿈 정리·비밀 유사 7종 422·로그에 reason 0(grep).

**하지 말 것**: `prisma/schema.prisma` 변경·`db push`(완료 조건 = 빈 diff) · 화면(`src/components/**`·`src/app/(admin)/**`·`menu.ts` 의 phase 열기 — 데모 승인·activate 뒤 developer B) · `src/modules/conversation/**`·`.claude/agents/tutor.md`(012c-2) · Python(`speech/**`) · `ecosystem.config.js`·`deploy.yml`·`.env*` · **PRODUCTION 행 라이브 쓰기(교차 환경 포함) 금지** — PRODUCTION 경로는 단위 테스트로만 · 운영 3010·운영 pm2 금지 · 커밋·push 금지(완료 후 변경 파일 목록을 기록, Leader 가 QA PASS 뒤 커밋).

**개발 환경**
- 격리 복제본 `~/.node-local/thekaiwa-012c-<시각>`(미러에서 `node_modules` 는 `cp -al`, `.next`·`logs` 제외 — ACTIVE "운영과 분리한 빌드 검증" 패턴), **dev 포트 3019**(2프로세스 경합 시험은 같은 복제본 하드링크로 3020 추가), `-H 127.0.0.1`, `APP_ENV=LOCAL`. **기동은 `env -i HOME="$HOME" USER="$USER" LANG="$LANG" PATH="$PATH" APP_ENV=LOCAL node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3019`**(에이전트 세션 env 가 Claude CLI 자식에 넘어가면 `ClaudeCliExecError` — 012b 트러블슈팅). 브라우저 확인은 `localhost:3019`. 작업 뒤 `ss -ltn` 으로 3019·3020 정리, 복제본 삭제.
- **QA 계정: 사용자(USER)는 `qa-bot`(QA_ACCOUNT=1)만** — `qa-bot2` 는 012b 라이브가 쓴다. 역할 계정 `qa-admin`·`qa-developer`·`qa-super`(tests/live/qa-session.ts)는 사용 가능.
- DB 는 운영과 공유 — **LOCAL 행만**. 스모크는 시작 전 LOCAL 대상 행(연결·Fallback·AppSetting·VoiceProfile)과 버전 수를 기록 → 끝에 **자기가 만든 `ConfigurationVersion` 행만 id 로 삭제 + 대상 행 바이트 원복 대조**(003g 선례). AuditLog 는 불변이라 남는다(QA 계정 행). 개발 dev 서버의 연결 행이 바뀌므로 다른 에이전트의 LOCAL dev 서버(3011·3017 등)가 떠 있으면 시험 시간을 기록.
- Claude 구독: LLM 연결 config/test 는 30초 1회 슬롯, 스모크의 LLM 호출 수를 기록.

**완료 보고("Developer 기록")**: 편집 키 표(0단계) · 변경 파일 목록 · tsc·eslint·단위 결과 · 라이브 완료 기준 1~11(화면 12 제외) 중 확인한 것 · D-C3 반례 결과 · 정본과 다르게 한 점 · 남은 위험. 다음은 reviewer → judge C2.

## Codex 검토
- [2026-09-29 03:52] C1 adversarial-review focus=security(0.80) — done
  - judge 판정: [2026-09-29 02:35] codex_required=true(adversarial-review · security) / 호출 차수: 1/4
  - 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=f4a3f32(task_file) · snapshot=cdcbb97
  - 지적 3건:
    - [high] docs/design/configuration-resolution.md:515 — credentialRef `file:` 허용 목록이 없어 다른 서비스 시크릿을 같은 연결에 교차 사용 가능(origin 고정만으로 방어 불완전) → 어댑터별 정확한 허용 목록 + 전역 deny 분류 필요
    - [high] docs/design/api-contract.md:1392 — Functional Test 가 RESTART_REQUIRED 키를 실제 검증하지 않으면서도 success testResultId 발급 → untested 에 strict 변경 시 testResultId 미발급 또는 별도 배포 검증 결과 요구
    - [medium] docs/design/role-permission.md:195 — reason 필드가 시크릿 유입 경로(감사 로그에 영구 보존) → reason 검증·구조적 시크릿 금지·DLP 검사 또는 마스킹 기록만 저장
  - 검토하지 못한 범위: 구현 코드(아직 없음) · task-012b worker 음성 부분 · DNS 재바인딩 방어(설계 미정, 구현 검증 단계)
  - 원본: /home/brownjeon/.claude/state/codex-review/runs/20260928T174829Z-task-012c-C1/
  - **요약**: D-C3 credentialRef(file:) 와 Functional Test 검증의 의미를 재정의하기 전에는 D-C3 주소·자격 편집 게이트를 열지 말 것 권장
- **판정**: Leader(메인) 03:05 — CX-1·CX-2·CX-3 전부 채택(아래 작업 기록). 정본 반영 완료 → **C1 종결**(작업 기록 "Codex C1 반영·C1 종결").

- [2026-10-01 04:47] C2 adversarial-review focus=security(0.86) — done
  - judge 판정: [2026-10-01 13:44] codex_required=true(adversarial-review · security) / 호출 차수: 2/4
  - 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=f4a3f32(task_file) · snapshot=09883f4
  - 지적 1건:
    - [high] src/modules/engine/configuration/validate.ts:105 — 일반 STRING/JSON 설정값에 평문 비밀(`password=`, `token=` 등) 탐지 없음 → ConfigurationVersion·AuditLog·기능 테스트(TTS 합성)로 평문 비밀 유출 → 모든 쓰기 진입점에서 isSecretLikeText 재귀 검사·저장 직전 강한 마스킹·중첩 JSON·NFKC 우회·제로폭 테스트·SECRET_REF 원칙 보강 (권고: 설정값 검증 강화·로그 필터링·credentialRef 외 비밀 거부)
  - 검토하지 못한 범위: 실제 DB·운영 서비스 호출 및 동적 침투 테스트는 READ-ONLY 제약에 따라 수행하지 않음
  - 원본: /home/brownjeon/.claude/state/codex-review/runs/20261001T044706Z-task-012c-C2/

## Designer 기록
- [03:13] 데모 v1(full) `docs/demo/task-012c-console-p2-v1.html` 작성·lint PASS·`status review_requested v1` 기록. 게시 전 이력서 재확인에서 Codex C1(CX-1~3, 03:05 채택) 미반영을 발견 → **v1 파일은 그대로 두고(sha 45761f…) v2 로 교체**.
- [03:19] **데모 v2(full)** `docs/demo/task-012c-console-p2-v2.html` — lint `DEMO_LINT_PASSED`, `status drafting v2 → review_requested v2`(sha 39b19f…), `artifact_url` 빈 값(Leader 게시). v1 대비 반영: 재시작 필요 키 = "재시작 필요" 잠금(편집 불가, Raw JSON 은 rule `restartRequired`) · 기능 테스트 `ok|partial|failed`(일부만 확인 = 운영 적용 불가, 운영 Form 은 실행 검증 방법 없는 키 "운영 잠금") · 비밀 참조 선택지 = 허용 목록(allowedFor) ∩ 서버에 있음(없는 허용 참조는 이름만 한 줄) · 감사 action `credentials.set|clear`·`engine.connections.enable|disable` · 이유 1~200자(운영 10~200)·줄바꿈 공백·비밀 유사 422.
  - **화면·상태 70개**(왼쪽 목록, 주소 `#id` 로 바로 열림): 설정 `/admin/configuration`(현재 vs 제안 · Effective 그대로 · Form 5종(연결·서비스 관리 많은 연결·읽기 전용/env/재시작 잠금·운영 설정·목소리 기본값) · Raw JSON 3종(보기·편집+검증 오류·문법 오류) · Diff 2종 · 흐름 11종(테스트 중·실패·일부만 확인·429·적용 시트·첫 적용 기준선·적용 완료·409 충돌·409 뒤 재비교·대상 바꾸기·초안 버리기) · 운영 10종(비 SUPER_ADMIN·운영 잠금·일부만 확인 적용 불가·테스트 필수·확인 창·입력 오류·요약 불일치 409·테스트 만료 403·이유 비밀 유사 422·권한 바뀜 403) · 공통 3종(로딩·실패·403)) · 연결 상세(현재 vs 제안·보기·편집 모드·주소 허용 목록 오류·비밀 참조 연결 개발/운영·있는지 확인·끄기·409 기본 연결) · 역할 페이지 LLM 예비 순서(현재 vs 제안·순서 편집·마지막/꺼진 연결·변경 요약·운영 적용) · **이력 `/admin/history` 신규**(설정 버전 목록·휴대폰 메뉴·상세 직전/지금 비교·되돌리기 개발/운영·운영 비 SUPER_ADMIN·사라진 키 경고·되돌릴 것 없음·기록 손상 422·되돌리는 중 409·빈 이력·감사·행 펼침·발음 사전 옛 기록·결과 없음·로딩·실패).
  - 틀: 1280·1024(사이드바 ≥1024)·412·390·360·세 폭, 역할(ADMIN·DEVELOPER·SUPER_ADMIN)·환경(LOCAL·PRODUCTION) 토글로 권한별 버튼 렌더링 0 확인, 라이트·다크. 헤드리스 검사 70상태 × 4폭 콘솔 오류 0·가로 넘침 0. 엔진명·실제 주소 문자열 0(가명 엔진 A~E·model-s 등, 주소 10.0.0.x·203.0.113.x, 비밀 이름·사람 전부 가짜). 토큰 `src/app/globals.css@sha256:22f382529f92` 값 고정, 새 색 0.
  - designer 결정: 보기 탭 4개(Effective·Form·Raw JSON·Diff — 기존 ConsoleSegmented, ADMIN 은 Raw JSON 탭 없음) → 대상 종류(연결·운영 설정·목소리 기본값)+대상 칩 → 요약 카드, 탭끼리 초안 하나 · **적용 막대** = 바뀐 값이 있을 때만 본문 아래 고정(검증·테스트·요약·적용 + 초안 버리기), 운영 비 SUPER_ADMIN 은 마지막 단계 🔒 + "초안·요약까지" 안내, LOCAL 은 테스트 건너뛰기 가능 · 잠금 이유 8종(서비스 관리·읽기 전용·서버 경로·env 가 덮음·환경 정책·자동·재시작 필요·운영 잠금) · 운영 확인 창 = 공용 Sheet(요약·해시·테스트·이유·PRODUCTION 입력, 003g WriteConfirmFields 모양) · 이력 = 설정 버전/감사 2탭 + 발음 사전 버전 링크(003g VersionRow·VersionDetailSheet 모양) · 예비 순서 = ↑↓빼기 44px + 넣을 수 있는 연결(꺼진 연결은 "연결 상세에서 켜기").
  - **사용자 결정 필요(데모 "결정 필요" A/B, designer 권고)**: (1) Form 칸 묶기 → B 바꿀 수 있는 것 먼저 (2) 휴대폰 Raw JSON 편집 경고 → A 띠만 (3) 감사 전·후 표시 → A 키마다 한 줄(+원문 JSON 펼침) (4) 연결 상세 편집 → A 같은 화면 편집 모드 (5) 목소리 기본값 편집 위치 → A 설정 화면 대상 종류 (6) 운영 설정 편집 단위 → A 키 하나 = 대상 하나.
  - **Leader 확인 요청(계약·정본)**: ① 허용됐지만 서버에 없는 참조를 이름만 한 줄로 알려도 되는지 ② 운영에서 연결 끄기(#93a)에도 기능 테스트 요구 여부(데모: 끄기 = 이유+PRODUCTION, 켜기 = 테스트 필수) ③ `menu.ts` configuration.tabs 에 `form` 탭 추가·history phase 열기·설정 메뉴 설명 문구 ④ #108 목록 DTO 에 출처(기준선·Form·Raw JSON·되돌리기)·대상 이름·기록 손상 여부 ⑤ Diff DTO 정본 불일치(api-contract #106 `changes[].shadowedBy` vs admin-console/08 `entries[].blocked`) — `types/admin.ts` 단일 출처로 ⑥ 운영 되돌리기용 기능 테스트를 부를 #105 `versionId` 입력 ⑦ LOCAL 테스트 건너뛰기 해석 확인 ⑧ 편집 키 표(D-C4) → 칸 잠금 이유 매핑(데모 키 배정은 가정) ⑨ 키별 `verifiable`(실행 검증 방법 유무)을 DTO 에 실어 운영 잠금·일부만 확인 표시 ⑩ 재시작 필요 잠금 문구.
  - 구현 가이드(`docs/screens.md` §13)는 **승인 뒤** 작성(승인 버전 명시). src/** 수정·commit 없음.

## Developer 기록
- [07:41] **developer A(opus) — 0단계 편집 키 표 + 1단계 첫 커밋 범위(D-C3(a)(b)(c)·CX-1·CX-3·D-C9) 구현 완료, reviewer 인계 대기.** 편집·버전·라우트(2~6단계)·스키마·화면·Python·conversation 은 손대지 않음. commit·push 없음.

### 0단계 — 편집 키 표(D-C4 · Codex C1 CX-2) — Leader 확인 뒤 확정
판정 규칙: **012c 편집 허용 = 소비자 APP(Node, 클라이언트 전달 포함) + RUNTIME_EDITABLE + "런타임 실사용값 == Effective" 테스트 가능**. RESTART·REDEPLOY = `restartRequired`(CX-2), Python 소비 = `serviceManaged`, 런타임이 읽지 않는 키 = 편집 거부(콘솔 값 ≠ 실제 값). **verifiable** = `config/test` 가 후보 값으로 실제 실행해 검증할 방법이 있는가(없으면 PRODUCTION 편집 불가 — `partial`). 런타임 읽는 곳의 "행" = `EngineConnection` 행 JSON(router 30초 캐시·Effective 의 CONNECTION_PROFILE 층과 같은 값).

| 대상 · 키 | 소비자 · 런타임 읽는 곳 | editability · strict | env 가 이기나 | 실행 검증(verifiable) | allowedRefs | 012c 편집 · 잠금 이유 |
|---|---|---|---|---|---|---|
| **claude-cli** `connection.binPath` | APP — spawn 은 env `CLAUDE_CLI_PATH`(행 값 = `$CLAUDE_CLI_PATH` 자리표시자) | RESTART · strict | 예(자리표시자) | — | — | ✗ 재시작 필요·서버 경로 |
| claude-cli `connection.timeoutMs` | 미사용(작업별 상한 `LLM_TASKS`, CLI 는 env `CLAUDE_TIMEOUT_MS`) | RUNTIME | 표시만 | — | — | ✗ 런타임 미사용 |
| claude-cli `connection.authMode` | — | REDEPLOY | — | — | — | ✗ 재배포 |
| claude-cli `runtime.modelByTier.fast·balanced·deep` | APP `engine/llm` `modelFor`(행) | RUNTIME · **strict** | 아니오 | ✅ 바뀐 tier 마다 후보 모델로 고정 스키마 프로브 1회(Claude) | — | ✓(PRODUCTION = 엄격 키 SUPER_ADMIN) |
| claude-cli `runtime.concurrency`·`interactiveLane` | APP 코드·env `CLAUDE_CLI_CONCURRENCY` | RESTART | — | — | — | ✗ 재시작 필요 |
| claude-cli `runtime.permissionMode`·`tools`·`agentsFile` | 코드 고정 | READ_ONLY | — | — | — | ✗ 읽기 전용 |
| claude-cli `runtime.jsonSchemaFlag` | APP `claudeShape` — env `KAIWA_LLM_JSON_SCHEMA_FLAG` 가 있으면 **env 가 이김** | RUNTIME | 예(설정 시) | ✅ 후보 플래그로 JSON 프로브 1회 | — | ✓ env 미설정일 때만(설정 시 `SHADOWED_BY_ENVIRONMENT` 잠금 — 현재 미설정) |
| claude-cli `runtime.thinkingForDeep` | APP `claudeShape` | RUNTIME | 아니오 | ✅ deep tier 프로브 1회(opus 호출) | — | ✓ |
| claude-cli `runtime.earlySentenceTts` | APP `callOnce`(스트리밍 조각) | RUNTIME | 아니오 | ✅ 스트리밍 프로브(첫 조각 수신 확인) | — | ✓ |
| claude-cli `runtime.prewarm`·`prewarmMaxIdle`·`prewarmIdleTtlSec` | APP `llm.prewarm` | RUNTIME | 아니오 | ❌ 예열 풀이 프로세스 전역이라 후보 값 시험 = 실운영 풀 변경 | — | LOCAL ✓ / PRODUCTION ✗(운영 잠금) |
| (모든 엔진) `logging.level` | 앱 미사용(`EngineConnection.logLevel` 을 읽는 코드 없음 — 015c) | RUNTIME | — | — | — | ✗ 런타임 미사용 |
| **home-m4-api** `connection.baseUrl` | APP `prepareHomeM4Call`·Health | RUNTIME · strict | **사실상 env 고정**(`AI_API_BASE` origin 밖이면 호출 0 — 이번 커밋) | — | — | ✗ 서버 env 주소 고정 |
| home-m4 `connection.timeoutMs`·`retry` | 미사용(작업 예산·429 재시도 1 코드 고정) | RUNTIME | — | — | — | ✗ 런타임 미사용 |
| home-m4 `connection.credentialRef` | APP `prepareHomeM4Call`(행) | SECRET · strict | env 별칭 `AI_API_KEY`(표시) | ✅ 후보 ref 로 home-m4 프로브 1회(M4, Claude 아님) | `env:HOME_M4_API_KEY`·`env:AI_API_KEY`·`file:home-m4-api-key` | #93b 만(SUPER_ADMIN) ✓ |
| home-m4 `runtime.model` | APP `modelFor`(행) | RUNTIME · strict | 아니오(env `AI_API_MODEL` 은 아래 층) | ✅ 후보 모델 프로브 1회 | — | ✓ |
| home-m4 `runtime.temperature`·`maxOutputTokens` | 미사용(env `AI_API_TEMPERATURE` 기본) | RUNTIME | — | — | — | ✗ 런타임 미사용 |
| home-m4 `runtime.systemFirst` | 코드 고정 | READ_ONLY | — | — | — | ✗ |
| home-m4 `runtime.allowedTasks` | APP router `allowsTask`(행) | RUNTIME · JSON | 아니오 | ❌ 라우팅 정책(실행 대상 없음) | — | **보류 권고** — 회화·채팅·ASK 금지 task 를 막는 Validate 규칙부터 필요 |
| **faster-whisper** 전 키(`baseUrl`·`timeoutMs`·`retry`·`language`·`beamSize`·`vadFilter`) | **PYTHON**(worker 가 자기 yml/env) — 앱은 Health 만 | RUNTIME/READ_ONLY(HTTP) | — | — | `credentialRef` = `[]`(인증 없음) | ✗ `serviceManaged`(015c) |
| faster-whisper `runtime.model`·`computeType`·`device`·`cpuThreads` | PYTHON | READ_ONLY(HTTP)·RESTART | — | — | — | ✗ |
| **reazon-gateway(HTTP)** `connection.baseUrl` | APP Health·`devWsUrl`(개발만), 운영 클라이언트는 nginx 경로 | RUNTIME · strict | — | — | — | ✗ `serviceManaged`(nginx·pm2) |
| reazon-gateway `connection.wsPath` | CLIENT(#19 `gateway.wsPath`) — nginx 경로와 묶임 | RUNTIME · strict | — | — | — | ✗ 주소 키(D-C3)·배포 의존 |
| reazon-gateway `connection.timeoutMs` | 미사용 | RUNTIME | — | — | — | ✗ |
| reazon-gateway `runtime.decodingMethod`·`vad.endpointSilenceMs`·`vad.threshold` | PYTHON(gateway 자기 설정) | RUNTIME | — | — | — | ✗ `serviceManaged` |
| reazon-gateway `runtime.partial` | CLIENT(#19 `gateway.partial` → WS start → gateway 가 따름) | RUNTIME | 아니오 | ❌ 서버에서 실행할 대상 없음(#19 응답 재계산만) | — | LOCAL ✓ / PRODUCTION ✗ |
| reazon `runtime.numThreads`·`modelVersion` | CLIENT·PYTHON | RESTART | — | — | — | ✗ 재시작 필요 |
| **reazon-ondevice(ONDEVICE)** `manifestUrl`·`modelBytes` | CLIENT | REDEPLOY | — | — | — | ✗ 재배포 |
| reazon-ondevice `runtime.decodingMethod`·`vad.endpointSilenceMs`·`vad.threshold`·`partial` | CLIENT(#19 `onDevice.runtime` → `OnDeviceSttClient.startOptions`) | RUNTIME | 아니오 | ❌ 기기에서만 실행 | — | LOCAL ✓ / PRODUCTION ✗ |
| reazon `runtime.provider`·`vad.model` | 고정 | READ_ONLY | — | — | — | ✗ |
| **style-bert-vits2** `connection.baseUrl` | APP 합성·g2p·Health | RUNTIME · strict | **env 고정**(`TTS_SERVICE_URL` origin, 003d) | — | — | ✗ 서버 env 주소 고정 |
| TTS `connection.timeoutMs` | APP `synthesizeHttp` = min(요청 상한, 이 값) | RUNTIME | 아니오 | ✅ 후보 값으로 고정 문장 합성 1회(M4) | — | ✓ |
| TTS `connection.retry` | 미사용 | RUNTIME | — | — | — | ✗ |
| TTS `connection.credentialRef` | **미사용**(Phase 1 은 env `TTS_SERVICE_SECRET`) | SECRET · strict | — | — | `file:tts-service-token` | ✗(#93b 도 보류 — 런타임이 ref 를 읽지 않음) |
| TTS `runtime.defaultModel` | Functional Test·요약만(실제 합성은 `VoiceProfile.voiceModelId`) | RUNTIME · strict | — | — | — | ✗ 실사용 아님 |
| TTS `runtime.maxChars` | APP `maxCharsOf`(코드 상한 100 으로 절삭) | RUNTIME | 아니오 | ✅ 후보 길이 문장 합성 1회 | — | 조건부 ✓ — Validate 상한을 100 으로(스키마 max 200 → 101~200 은 저장돼도 효력 없음) |
| TTS `runtime.sdpRatio`·`noise`·`noiseW` | APP `synthesizeHttp` 엔진 파라미터 | RUNTIME | 아니오 | ✅ 후보 값 고정 문장 합성 | — | **조건부 ✗** — TTS 캐시 키 12요소에 없어 캐시된 문장은 옛 값(콘솔 값 ≠ 실제). 캐시 키 세분(`engineConnectionKey` 요소에 파라미터 요약) 뒤에만 ✓ — speech 층 변경, Leader 확인 |
| TTS `runtime.language` · `runtime.device` | 고정 · PYTHON(tts-service) | READ_ONLY · RESTART | — | — | — | ✗ |
| **FALLBACK_POLICY** `primaryConnectionId`·`fallbackConnectionIds` | APP router `loadChain`(30초)·stt `realtimeTargets`·`analysisTarget`(5초) | strict(productionSensitive) | 아니오 | ✅ 새 primary(와 새로 들어온 fallback) 기능 테스트 1회씩 | — | ✓ |
| FALLBACK_POLICY `enabled` | APP(정책 꺼짐 = 역할 없음) | strict | 아니오 | 켜기 ✅ primary 기능 테스트 / 끄기 = 검증 대상 없음 | — | ✓ — 끄기의 PRODUCTION 은 #93a 와 같게(이유+확인, 테스트 면제) 제안 → Leader 확인 |
| FALLBACK_POLICY `retryOnce` | 미사용(router 는 항상 앞 2후보) | — | — | — | — | ✗ 런타임 미사용 |
| **AppSetting** `voice.preview.defaultText` | APP `previewSettings`(30초 캐시) | RUNTIME | 아니오 | ✅ 후보 문장 합성 1회(M4) | — | ✓ + `voice.preview.textVersion` 같은 트랜잭션 +1(D-C7) |
| AppSetting `voice.preview.textVersion` | APP(캐시 키) | 자동 | — | — | — | ✗ 자동 |
| AppSetting `voice.default.profileId` | APP `synthesize` 대체 프로필(30초 캐시) | RUNTIME | 아니오 | ✅ 그 프로필로 합성 1회 · Validate = 같은 환경 VoiceProfile 존재·활성 | — | ✓ |
| AppSetting `speech.review.threshold` | APP `speech/analysis/apply` → `reviewThreshold` | (행 없음 — 012b 읽기만) | 아니오 | ❌ 계산 키(실행 대상 없음) | — | LOCAL ✓ / PRODUCTION = **Leader 판단**(순수 계산 키의 "검증" 정의). **⑤ 규칙 적용**: 편집 시 ACCURATE = max(설정값, 0.90), 그 밖 모드 = 설정값(0~1) — 지금 `reviewThreshold` 는 설정값이 모든 모드를 덮으므로 012c 편집 구현 때 함께 고친다 |
| AppSetting `tts.styleMap` | APP(행 있으면) | (행 없음) | — | ❌ | — | 보류(012c 제외 권고) |
| AppSetting `override.production.enabled`·`debug.production.maxTtlMinutes`·`loglevel.production.maxLevel`·`speech.audio.retentionDays`·`trace.retentionDays` | 정책 키(environment.policy) · 보존일은 코드 상수(`UTTERANCE_RETENTION_DAYS`)라 미사용 | RUNTIME/RESTART | — | — | — | ✗ 정책 키(#123b 일반 키 아님) |
| **VoiceProfile** `defaults.style·styleWeight·speed·pitch·intonation` | APP `parameterResolver` 2순위 — TTS 캐시 키에 유효값이 들어가 즉시 반영 | RUNTIME | 아니오 | ✅ 그 프로필로 고정 문장 합성 1회 | — | ✓(범위는 parameterResolver 와 동일하게) |
| VoiceProfile 표시명·정렬 | CLIENT 표시 | — | — | 표시 전용(실행 개념 밖) | — | ✓ LOCAL / PRODUCTION 테스트 면제 여부 **Leader 확인** |
| VoiceProfile `voiceModelId`·`speakerId`·`enabled` | APP | — | — | — | — | ✗ 012c-2(Voice 관리 #85·#86) |

- 요약: 편집 후보 ✓ = claude tier 모델 3·jsonSchemaFlag·thinkingForDeep·earlySentenceTts · home-m4 model(+credentialRef #93b) · TTS timeoutMs·maxChars(상한 100) · Fallback primary/fallbacks/enabled · AppSetting 미리듣기 문장·기본 프로필 · VoiceProfile defaults 5 — 전부 verifiable ✅. LOCAL 한정(verifiable ❌) = 예열 3키·STT 클라이언트 전달 키·review.threshold. 2단계에서 ✓ 키 전부에 "런타임 실사용값 == Effective" 단위 테스트를 붙인다.

### 1단계 — 첫 커밋 범위 구현
**(a) 시크릿 전송 대상 고정 — 전수 확인 결과**
| 시크릿을 싣는 경로 | 전송 대상 | 조치 |
|---|---|---|
| home-m4 `x-api-key`(`engine/llm` → `HomeM4ApiCaller`) | 이전: DB `connection.baseUrl` 그대로 | **고침** — `prepareHomeM4Call`: 주소 origin ≠ env `AI_API_BASE` origin 이면 키를 해석조차 하지 않고 `LlmMisconfiguredError(TARGET_NOT_ALLOWED\|TARGET_UNSET\|BAD_BASE_URL)`, ref 가 허용 목록 밖·전역 거부면 `REF_NOT_ALLOWED`. Router 는 다음 후보로, 기능 테스트는 `MISCONFIGURED(errorCode)` |
| home-m4 Health | 키 없음(공개 `/health`) | 대상 origin 선검사 추가(TTS 와 같게) — 밖이면 요청 0 |
| TTS `x-internal-secret`(합성·g2p·`/health/detail`) | env `TTS_SERVICE_URL` origin 고정(003d `readServiceSecretFor`) | 변경 없음(이미 고정) |
| Claude CLI 자식 프로세스 env | (네트워크 아님) | **보강** — 자식 env 삭제 목록에 `TTS_SERVICE_SECRET` 추가(기존 목록에 빠져 있었음) |
| Google OAuth `client_secret` | 코드 상수 토큰 엔드포인트(설정 편집 대상 아님) | 해당 없음 |
| `/api/internal/*`·WS 티켓 | 들어오는 쪽 검증(내보내지 않음) | 해당 없음 |
| admin `/api/health` 프로브 | env 주소, 시크릿 없음 | 해당 없음 |

**(b) credentialRef — 어댑터별 정확한 허용 목록 + 전역 거부(CX-1)**: `SchemaKey.allowedRefs`(SECRET_REF 필수 — 스키마 자체 검증이 없음·형식 오류·거부 분류를 로드 실패로 막음), home-m4 = `env:HOME_M4_API_KEY`·`env:AI_API_KEY`·`file:home-m4-api-key`, TTS = `file:tts-service-token`, whisper = `[]`. 판정 `engine/credentials`(순서 ⓪ 평문 → ① 전역 거부 → ② descriptor 목록 → ③ 형식 → ④ 존재), 전역 거부 분류 `infra.isDeniedCredentialRef`(부팅·내부 시크릿 이름표 + 패턴, `file:` 은 이름을 env 모양으로 바꿔 같은 규칙). 값 해석 `infra.readCredentialFor(ref, target, originEnv)` — 대상 origin → 거부 분류 → `env:`/`file:`(SECRETS_DIR 바로 아래·lstat 일반 파일·0600·소유자·4KB). #101 에 `allowedFor[]`(connection key) — 허용됐지만 아무도 안 쓰는 ref 도 이름만 싣고, 거부 분류 ref 는 빼고 감사 `after.deniedRefs` 로 셈.
**(c) 연결 주소 호스트 허용 목록**: `infra/netPolicy`(순수 판정 + DNS) + `engine/adapters/common/targetPolicy`(서버 env 서비스 origin = 어댑터 URL 키 envAlias 5개 + `KAIWA_*_CONNECTION_BASEURL`, 상수 = 스키마 합집합을 단위 테스트가 대조). 허용 = env origin 정확 일치 · IP 리터럴 loopback(127/8·::1)·LAN(192.168.219.0/24, IPv4-mapped 포함) · http 이름은 **해석 주소 전부**가 그 대역일 때만이고 실제 연결은 검사한 IP 로 고정(`connectUrl` — DNS 재바인딩). 거부 = 비 http(s)·userinfo·그 밖 주소(0.0.0.0·::·compat·NAT64·링크 로컬·다른 사설망)·env origin 이 아닌 https 이름. 10진·8진·16진 IPv4 는 URL 파서 정규화 뒤 판정. Health(`probeHttpHealth`)가 요청 전에 적용(밖이면 요청 0·`MISCONFIGURED(HOST_NOT_ALLOWED)`), 리다이렉트는 기존대로 미추종. Validate 는 2단계에서 `engine.vetConnectionUrl` 를 부른다(`rule:hostNotAllowed`).
**(CX-3) reason 공용 검사**: `infra/reason` — `checkReason`/`requireReason`(줄바꿈·제어문자 구간 → 공백 하나·trim · 1~200자(PRODUCTION 10~200) · 비밀 유사(접두 `sk-`·`gh[po]_`·`github_pat_`·`AKIA`·`xox?-`·`Bearer`/`Basic` 토큰·JWT · 키=값/키:값 `password|passwd|secret|token|api_key|apikey|credential` · 24자↑ `[A-Za-z0-9-_+/=]` 연속 중 문자 종류 3↑) → `422 {field:'reason', reason:'E_REASON_SECRET_LIKE'}`, 길이 → `400 VALIDATION {reason:'REASON_*', length, min, max}`, 오류 어디에도 원문 없음·로그 출력 없음). **발음 사전 쓰기 5경로(추가·수정·비활성·Import·Rollback)에 적용**(Leader 03:15).
**D-C9**: `claimFunctionalSlot` — `updateMany(where id AND (lastFunctionalAt IS NULL OR < now−30s))` 1행일 때만 실행, 아니면 429(`retryAfterSec` 1~30, 미래 시각이어도 ≤30). 메모리 Map·EngineHealth 조회 제거, `recordHealth(FUNCTIONAL)` 은 `lastFunctionalAt` 을 더 쓰지 않음("마지막 시작 시각").

**변경 파일(내 것만)** — 수정: `src/modules/infra/{secrets.ts,index.ts}` · `src/modules/engine/{index.ts,llm/index.ts,functionalTest/index.ts,health/index.ts,registry/index.ts,registry/types.ts}` · `src/modules/engine/adapters/{common/httpHealth.ts,llm/homeM4.ts,llm/homeM4.provider.ts,llm/claudeCli.ts,stt/fasterWhisper.provider.ts,tts/styleBertVits2.provider.ts}` · `src/modules/admin/{engines/index.ts,speech/lexicon.ts}` · `src/types/{admin.ts,lexicon.ts}` · `tests/live/task005b-smoke.ts`(6a 키 집합에 `allowedFor`). 신규: `src/modules/infra/{netPolicy.ts,reason.ts}` · `src/modules/engine/credentials/{index.ts,policy.ts}` · `src/modules/engine/adapters/common/targetPolicy.ts` · 테스트 `src/modules/{infra,engine,admin}/__tests__/task012c.test.ts` · 라이브 `tests/live/task012c-gate-smoke.{sh,ts}`. `prisma/schema.prisma`·화면·conversation·Python·env 파일 무변경.
- ⚠ **작업 트리에 다른 작업의 미커밋 변경이 섞여 있다**(07:26~07:30, 내 것 아님): `src/modules/engine/json/schemaValidate.ts`·`src/modules/engine/__tests__/additionalPropertiesStrip.test.ts`·`src/modules/conversation/{__tests__/lesson.test.ts,prompts/lesson.ts,structuredResponse/schemas.ts}`·vault task-010·llm-japanese-quality — 커밋 때 분리할 것.

**검증**(격리 복제본 `~/.node-local/thekaiwa-012c-gate`·`-gate2`, `env -i … APP_ENV=LOCAL next dev -H 127.0.0.1`, 끝나고 3019·3020·3021 종료·복제본 삭제, 운영 3010·pm2·미러 무접촉)
- tsc 0 · eslint 오류 0(경고 5 = 기존 components) · 단위 전체 785: 781 pass·3 skip·**1 fail = REV-032 M1 픽스처(아래 차단)** · 신규 012c 단위 24/24.
- 라이브 게이트 `task012c-gate-smoke` **25/25**(두 프로세스 3019·3020, LLM 호출 0): A #101 allowedFor 4 · B Health SSRF 9(10.255.255.1·`[::ffff:10.0.0.1]`·169.254.169.254·10진 `134744072` = 요청 0·HOST_NOT_ALLOWED·<2s / loopback·localhost(해석→고정 IP) 통과 / 302 미추종 / userinfo / 응답에 주소 0) · C home-m4 5(127.0.0.1 다른 port → Health·기능 테스트 모두 TARGET_NOT_ALLOWED·`/v1/chat`·키 요청 0 / 같은 host 다른 port(M4 8200) / `env:JWT_SECRET` → REF_NOT_ALLOWED / 원래 설정은 게이트 통과) · **D 동시 4요청(2프로세스) → 200 1·429 3·FUNCTIONAL 행 1, lastFunctionalAt = 시작 시각** · E 사전 reason 비밀 유사 422·행 0·원문 미반환·dev 로그 grep 0 / 201자 422 E_REASON · Z LOCAL 3행 바이트 원복·Health 행 정리.
- 회귀(3019): **003g 54/54 · 006 42/42(턴 p50 4921ms) · 007 44/44 · 008 74/74**(home-m4 → `LlmMisconfiguredError(SECRET_MISSING)` 로 claude 폴백 3회 — 개발 .env `HOME_M4_API_KEY` 가 빈 값이라 기존과 같은 동작) · **005b 44/47 — 실패 3건(5c·5j·7c)은 기준선 HEAD `37e2ad7` 서버(3021)에서도 똑같이 실패**(스모크가 "gateway 가 떠 있지 않음" 을 전제 — 지금 운영 gateway 8100 가동, 환경 드리프트). dev 로그에 003g 스모크 reason 원문 0.
- Claude 호출 ≈ 30회(005b 1 + 기준선 005b 1 + 006 ≈16 + 007 ≈9 + 008 3), 게이트 스모크 0.

**정본과 다르게 한 점(reviewer 확인 요청)**
1. 발음 사전 reason: 길이 오류는 003g 계약대로 **422 칸 오류 `E_REASON`**(CX-3 정본은 400 VALIDATION), 비밀 유사만 `details.reason`·`fields.reason` = `E_REASON_SECRET_LIKE`. **PRODUCTION 사전 쓰기 reason 이 10자 이상으로 강화**(role-permission §7 ② 적용 — 003g 계약 1~200 과 다름). 줄바꿈은 지우던 것 → 공백으로.
2. credentialRef 검사 순서 앞에 ⓪ "ref 모양 아님(평문 의심)" 을 두었다 → 호출자는 `400 E_CONN_SECRET_VALUE`(§2-19) 로(원문 미반환). 정본 #93b 순서는 ①부터.
3. 호스트 허용 목록: env origin 은 DNS 검사 없이 신뢰(운영자 설정), **env origin 이 아닌 https 이름은 거부**(fetch 로는 SNI 때문에 IP 고정 불가), `KAIWA_*_CONNECTION_BASEURL` env 도 신뢰 origin 에 포함. 시크릿을 싣는 실호출(home-m4·TTS)은 호스트 목록이 아니라 더 좁은 env origin 고정으로 막는다.
4. home-m4 `allowedRefs` 에 §2-1 시크릿 별칭 ref `env:AI_API_KEY` 포함. `file:` 값 해석을 이번에 추가(§10 의 60초 캐시는 두지 않음 — 매 호출 읽기).
5. #101 이 허용됐지만 쓰지 않는 ref 도 싣는다 → 기존 시트(`SecretsSheet`)에 "없음" 배지 행이 늘고 안내 문구("연결에 걸린…")와 어긋남(화면은 developer B 몫).
6. `selfCheckSchema` 가 SECRET_REF 키의 `allowedRefs` 누락·거부 분류를 **플러그인 로드 실패**로 처리(fail-closed).

**차단·요청(Leader)**
- **B1 [커밋 차단] `src/modules/conversation/__tests__/lesson.test.ts` REV-032 M1 픽스처**(012c 금지 경로 — prompt-engineer/소유자 수정 필요): 가짜 home-m4 연결이 `env:KAIWA_TEST_FAKE_LLM_KEY` + 임의 127.0.0.1 포트를 써서 이제 의도대로 `TARGET_NOT_ALLOWED` 로 막힌다. 수정안(복제본에서만 적용해 47/47 확인): `keyEnv = 'HOME_M4_API_KEY'`, `process.env.AI_API_BASE = \`http://127.0.0.1:${port}\``, `t.after` 에서 두 값을 원래대로 복원(6줄). 같은 파일을 다른 작업이 지금 고치는 중이라 그쪽과 합칠 것.
- R1 발음 사전 화면 문구: `E_REASON_SECRET_LIKE`·PRODUCTION 10자 미만이 화면에서 "변경 이유를 입력해 주세요"(lexiconCopy 기본 문구)로 보인다 → developer B(화면) 후속.
- R2 005b 스모크 5c·5j·7c 기대값을 "gateway 가동" 환경에 맞게 갱신 필요(QA·Leader 판단 — 내 변경과 무관).
- R3 판단 요청: `speech.review.threshold`·VoiceProfile 표시명처럼 **실행 대상이 없는 키의 PRODUCTION 편집**(CX-2 로는 영구 불가), TTS `sdpRatio·noise·noiseW` 캐시 키 세분, home-m4 `allowedTasks` 보류, Fallback 끄기의 테스트 면제.

**남은 위험**: ① 고엔트로피 규칙 오탐 — 모델 id(`zipformer-ja-…-int8` 같은 24자↑ 소문자·숫자·`-`)를 이유에 쓰면 422(정본 규칙 그대로) ② `lastFunctionalAt` 의미가 "시작 시각"으로 바뀜 — 화면 표기 확인 ③ env 에 적힌 이름 주소는 해석 주소를 검사하지 않음(운영자 신뢰) ④ 개발·운영 `.env` 의 `HOME_M4_API_KEY` 가 비어 있으면 home-m4 는 계속 MISCONFIGURED(기존과 동일, 이번 변경과 무관) ⑤ 라이브에서 QA 계정 감사 행(`secrets.read_ref` 등, LOCAL)이 남음(불변).

### Codex C2 지적 3건 수정(reviewer 10:15 채택분 — Leader 지시)
- [08:27] **developer A — ①②③ 수정 + REV-035 Low 1·2 완료, reviewer 재순환 대기.** 스키마 0·같은 파일 경계·commit/push 없음.
  - **① Claude CLI 자식 env 허용 목록**(`engine/adapters/llm/claudeCli.ts`): `{...process.env}` 뒤 delete 하던 블랙리스트를 `buildChildEnv`(순수 함수)로 교체 — **허용 목록 밖 키 전부 제외**(fail-closed). 허용 = `PATH·HOME·USER·LOGNAME·SHELL·LANG·LANGUAGE·LC_*·TZ·TMPDIR·TMP·TEMP·TERM·NODE_ENV·XDG_*(5)·NODE_EXTRA_CA_CERTS·SSL_CERT_FILE/DIR·HTTP(S)_PROXY·NO_PROXY(대소문자)` + CLI 비시크릿 설정 `CLAUDE_CONFIG_DIR·DISABLE_AUTOUPDATER·DISABLE_TELEMETRY·DISABLE_ERROR_REPORTING·CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, 이어서 `MAX_THINKING_TOKENS=0`(thinking 아닐 때)·`~/.npm-global/bin` PATH 보정(기존 그대로). `NODE_OPTIONS` 제외, 세션 주입 변수(`CLAUDECODE`·`CLAUDE_CODE_*`·`VSCODE_*`)는 목록에 없어 자동 제외. `NODE_ENV` 는 옛 방식에서도 넘어가던 비시크릿 실행 모드라 유지(Next 타입이 ProcessEnv 에 요구하기도 함). 라이브: 007 뒤 떠 있던 예열 CLI 자식의 `/proc/<pid>/environ` 키 = **`HOME LANG MAX_THINKING_TOKENS NODE_ENV PATH USER` 6개뿐**(값은 보지 않음).
  - **② `file:` 시크릿 TOCTOU**(`infra/secrets.ts` `readSecretFile`): `realpath(SECRETS_DIR)/<name>` 을 `openSync(O_RDONLY|O_NOFOLLOW|O_NONBLOCK)` 로 한 번 열고 **그 fd 로** `fstatSync`(일반 파일·0600 류·소유자·≤4KB) → fd 의 실제 경로(`/proc/self/fd/N` readlink)가 `realpath(SECRETS_DIR)/<name>` 인지(디렉터리 성분 바꿔치기·연 뒤 rename 거부) → 같은 fd 로 최대 4KB+1 바이트 `readSync` → `closeSync`. 경로 재오픈 없음. 마지막 성분 링크 = ELOOP → `SECRET_PERMISSION`, FIFO 는 O_NONBLOCK 이라 막히지 않고 fstat 에서 거부. 테스트용 경계 `secretFileDeps{open, fdPath}`(mock.method).
  - **③ reason 서식 문자 우회**(`infra/reason.ts`): 판정용 형태 `reasonCheckForm` = 저장 규칙(제어문자 → 공백) 뒤 `normalize('NFKC')` → `\p{Cf}`·`\p{Default_Ignorable_Code_Point}` **삭제**(공백 치환 아님 — CGJ·변이 선택자·한글 채움 문자 등 Cf 밖의 폭 0 문자까지) → 공백 정리. `isSecretLikeText` 가 이 형태로 판정. **최소 길이(REQUIRED·TOO_SHORT)도 이 형태의 보이는 글자 수**(폭 0 문자로 10자를 채운 PRODUCTION 이유 거부), 최대 길이는 저장값 기준, **저장값은 기존 그대로**(NFKC 로 바꾸지 않음 — 반각 가나 등 원문 유지). 발음 사전 5경로는 `readWriteMeta → checkReason` 공용이라 자동 적용(호출 5곳 grep 확인 + 단위).
  - **REV-035 Low 1**: `readCredentialFor(ref, target, originEnv, allowedRefs)` — 호출자 어댑터 허용 목록을 **필수 인자**로 받아 자체 재검사(목록 밖 = `REF_NOT_ALLOWED`). 호출자 `prepareHomeM4Call` 이 `HOME_M4_ALLOWED_REFS` 전달. **Low 2**: `homeM4.ts`·`homeM4.provider.ts` 에 `credentials/policy` 직접 import 이유(순환 회피) 한 줄 주석.
- 변경 파일(이번 라운드): `src/modules/engine/adapters/llm/claudeCli.ts` · `src/modules/infra/{secrets.ts,reason.ts,index.ts}` · `src/modules/engine/adapters/llm/{homeM4.ts,homeM4.provider.ts}` · 테스트 `src/modules/{infra,engine,admin}/__tests__/task012c.test.ts` · 라이브 `tests/live/task012c-gate-smoke.ts`(E1b 추가).
- 회귀 테스트(요청분): ① 자식 env — 시크릿·세션 변수·`NODE_OPTIONS`·임의 새 이름 200개(`*_SECRET`·`*_TOKEN`·`*_API_KEY`·`GOOGLE_*`·`*_DATABASE_URL`) 전부 부재, 허용 목록 자체에 시크릿형 이름 0 · ② 0644·심볼릭 링크·디렉터리·FIFO(2초 안)·4KB 초과·없는 파일, **열기 직전 링크로 바꿔치기 → 거부**, **연 뒤 링크로 바꿔치기 → 링크 대상 내용 0·거부**, fd 실제 경로가 밖 → 거부, SECRETS_DIR 자체가 링크면 realpath 로 정상 · ③ soft hyphen·ZWSP·ZWNJ·ZWJ·BOM·word joiner·CGJ·전각(NFKC) 으로 `sk-`·`Bearer `·JWT·`password=`·`token:`·`ghp_`·`AKIA`·고엔트로피 토큰을 끊은 **12 케이스 전부 422**, 한국어·일본어·반각 가나·이모지 이유 5건 통과·저장값 불변, 폭 0 문자만 = REQUIRED, 폭 0 로 채운 PRODUCTION 이유 = TOO_SHORT, 발음 사전 `readWriteMeta` 3 케이스 `E_REASON_SECRET_LIKE`.
- **검증**(격리 복제본 — 공유 미러와 같은 방식: `node_modules` 하드링크·NFS src 동기화, 3019·3020 `env -i … APP_ENV=LOCAL next dev -H 127.0.0.1`, 끝나고 종료·복제본 삭제, 운영 3010·pm2 무접촉): tsc 0 · eslint 오류 0(경고 5 = 기존 components) · **단위 전체 791: 788 pass·0 fail·3 skip**(PE 픽스처 반영 뒤) · 신규 012c 단위 30/30 · 게이트 스모크 **26/26**(E1b ZWSP·soft hyphen 이유 422·행 0 추가, 2프로세스 슬롯 200·429×3) · **006 42/42(p50 4255ms)·007 44/44·008 74/74**(Claude CLI 실경로 — 허용 목록 env 로 정상) · 003g 1회차 53/54(4b: #23 뒤 RequestTrace 를 2초 안에 못 찾아 `matches:null` — 스모크의 Trace 대기 타이밍, 이번 변경 경로 밖) → 30초 뒤 재실행 **54/54** · dev 로그에 reason 원문(비밀 유사·003g 이유) 0.
- 남은 점: ① 허용 목록에 없는 CLI 설정 env 가 앞으로 필요해지면 목록에 추가해야 동작(fail-closed 의 대가 — 지금 운영 env 에는 해당 키 없음 확인: `.env`·`.env.example` 에 CLAUDE_CONFIG_DIR·프록시 없음) ② fd 경로 확인은 `/proc` 가 있는 Linux 에서만(없으면 O_NOFOLLOW·fstat 만) ③ 판정용 형태가 CGJ·변이 선택자까지 지우므로 이모지·결합 문자가 많은 이유는 판정에서만 붙어 보인다(저장값 무변경).

### 서버 2단계 — 인계 2~6단계(설정 편집·버전·Rollback·감사) 구현
- [10:10] **developer A — 2~6단계 구현 완료, reviewer 재순환 대기.** 스키마 0(`git diff prisma/schema.prisma` 빈 diff)·화면/menu.ts/conversation/Python/ecosystem/.env 0·PRODUCTION 행 라이브 쓰기 0·운영 3010/pm2 무접촉·commit/push 없음.
- **D-C14: VoiceProfile 은 environment 칸 없는 전역 행 → 편집은 012c-2**(Leader 12:10 결정 C). 2단계 scope 는 ENGINE_CONNECTION·FALLBACK_POLICY·APP_SETTING 만 — `VOICE_PROFILE` 요청은 `400 {reason:"SCOPE_DEFERRED"}`.
- **적용 코어 순서**(`admin/configuration/editor.ts` `commitEdit`, 모든 쓰기 경로 공용): capability(대상 행 환경 기준 — PRODUCTION 이면 `config.apply.production` 추가) → (#93b) `credentials.manage` → 교차 환경이면 `environment.policy` → baseVersion 형식 → reason(CX-3 공용) → Validate → 변경 0 이면 `200 {changed:false}`(버전·감사 0) → baseVersion 대조(409 VERSION_CONFLICT) → Diff(적용 차단 blocked 400) → **교차 환경 PRODUCTION 은 바뀐 키 전부 NOT_NEEDED 일 때만**(아니면 `403 CROSS_ENVIRONMENT_TEST_UNAVAILABLE`, Leader 12:10 규칙 — `gate.ts assertCrossEnvironment`) → PRODUCTION 게이트(`gate.ts productionGate`: confirm "PRODUCTION" 403 → summaryHash 재계산 대조 409 → testResultId 403, `detail` = MISSING·NOT_FOUND·NOT_OK·EXPIRED·OTHER_TARGET·OTHER_CANDIDATE·KEYS_NOT_TESTED·RELATED_NOT_OK) → `infra.withTransaction` 하나(대상 행 `FOR UPDATE` → 저장값·버전 재확인 → 주 연결 끄기 409 PRIMARY_IN_USE → 첫 적용이면 기준선 v1(`_meta.origin=BASELINE`·작업자 없음) + 감사 `config.baseline` → 소유 층 물화 → 새 버전(직전 ACTIVE → SUPERSEDED, 되돌림이면 ROLLED_BACK) → 감사 1행 → 미리듣기 문장이면 textVersion +1 파생 버전·감사) → P2002(같은 번호 동시 생성) → 409 → 커밋 뒤 이 프로세스 캐시 무효화(Router·TTS·STT 대상 + TTS 설정).
- **구현 파일**
  - engine(L5): `configuration/{keys,appSettingSchema,validate,diff,shapes,versions,rollback,index}.ts`(신규) · `resolver.ts`(`_meta` 제외·후보 Effective) · `registry/types.ts`(스키마 편집 메타 `consumer·consumerBy·verify·envPinned·runtimeMax·runtimeEnvWins·consoleEdit`, `ConfigTestMark`) · 어댑터 5개 `*.provider.ts`(키별 편집 메타 — 엔진명은 어댑터에만) · `connections`(행 잠금·물화 — 켜기/끄기 시 status UNKNOWN/DISABLED, 주 연결 사용 정책 조회) · `fallbackPolicy`(잠금·물화·같은 환경 연결 조회) · `functionalTest`(`runConfigConnectionTest`·`recordConfigTestResult`·`findConfigTestResult` — 결과는 `EngineHealth(FUNCTIONAL).detail.config`, 30초 슬롯 공용) · `llm`(`runtimeReaders` — 호출·예열이 이 함수만 쓰게 단일화, 동작 동일) · `stt`(`publicRuntimeFromValues` 순수 함수) · `adapters/tts/styleBertHttp.ts`(`requestTimeoutMs` 추출) · `index.ts`(`clearConfigCaches`).
  - 소유 층 tx 쓰기: preferences `lockAppSettingForUpdate·readAppSettingRow·writeAppSetting`(exists:false = 행 삭제) · speech `tts/configProbe.ts`(후보 문장·목소리 실제 합성 — 캐시·Trace·상태등 무기록) · `clearTtsSettingCache` · `loadTtsVoice` 공개 · `analysis/policy.ts`(R3 ⑤ ACCURATE = max(설정, 0.90)) · infra `audit.ts`(작업자 없는 기준선 감사·`listAuditRows`).
  - admin(L0): `configuration/{targets,editor,gate,history}.ts`(신규) · `effective.ts`(#102 `edit{version, keys[]}`) · `index.ts`.
  - 라우트(첫 줄 `requireCapability`): `config/{validate,diff,apply}`(config.edit) · `config/test`(functional_test.run) · `config/versions`·`versions/[id]`(config.effective.read) · `versions/[id]/rollback`(config.rollback) · `config/raw/[scope]/[targetId]` GET(config.raw.read)·PUT(config.edit + 안에서 config.raw.read) · `engine-connections/[id]` PUT·`[id]/enabled`(engine.connections.manage) · `[id]/credential`(credentials.manage) · `fallback-policies/[role]` PUT(engine.connections.manage) · `app-settings/[key]` GET·PUT(config.edit) · `audit`(audit.read). DTO 는 `src/types/admin.ts` 012c 블록 단일 출처.
  - 테스트: `src/modules/engine/__tests__/task012c-edit.test.ts`(20) · `src/modules/admin/__tests__/task012c-edit.test.ts`(9) · `src/modules/speech/__tests__/task012b.test.ts`(⑤ 기대값) · 라이브 `tests/live/task012c-smoke.{sh,ts}`(신규) · `tests/live/task005b-smoke.ts`(R2).
- **최종 편집 가능 키**(그 밖은 잠금 — 사유 READ_ONLY·RESTART_REQUIRED·CREDENTIAL_ONLY·DEFERRED·SERVICE_MANAGED·NOT_CONSUMED·ENV_PINNED·AUTO·POLICY)

  | 대상 | 편집 가능 키 | 실행 검증(#105) |
  |---|---|---|
  | LLM(CLI) | modelByTier.fast/balanced/deep · jsonSchemaFlag · thinkingForDeep · earlySentenceTts · prewarm · prewarmMaxIdle · prewarmIdleTtlSec · enabled | tier 별 고정 스키마 프로브(STREAM = 조각 스트리밍 유무 대조) / prewarm 3종 = 검증 불가(PRODUCTION 불가) |
  | LLM(HTTP 보조) | model · enabled | fast 프로브 |
  | 실시간 STT(ONDEVICE) | decodingMethod · vad.endpointSilenceMs · vad.threshold · partial · enabled | 검증 불가(클라이언트 소비) |
  | 실시간 STT(HTTP) | partial · enabled | 검증 불가 |
  | 분석 STT | enabled | 켜기 = 기능 테스트(현재 NOT_IMPLEMENTED → partial) |
  | TTS | connection.timeoutMs · enabled | 후보 프로필로 고정 문장 합성 |
  | Fallback | primaryConnectionId · fallbackConnectionIds · enabled | 새 주/예비 연결마다 기능 테스트(빼기·순서·끄기 = 불요) |
  | AppSetting | voice.preview.defaultText(→ textVersion 자동 +1) · voice.default.profileId · speech.review.threshold | 후보 문장 합성 · 후보 목소리 합성 · 검증 불가(R3 운영 잠금) |

- **2단계 중 발견·조치**(모두 잠그는·좁히는 쪽 — Leader 확인 요청은 ①)
  1. **TTS `runtime.maxChars` → 편집 보류(DEFERRED)**: 문장 분할은 speech 상수(100자)로 하고 이 값은 서비스 호출 거부 상한으로만 쓰인다 — 100 미만으로 바꾸면 51~100자 문장이 `TEXT_TOO_LONG` 으로 실패하는데 상한 길이 합성 테스트는 통과해 막지 못한다("콘솔 값 ≠ 실제 동작", D-C4). 0단계 표에서 허용이던 키를 좁혔고 그 검증 방법(`TTS_SYNTH_MAXLEN`·후보 문장 길이 전달)도 제거. 다시 열려면 분할 상한을 연결 값으로 바꾸는 speech 변경이 먼저.
  2. **되돌리기 — 스냅샷에 없던 키 = 그때 기본값**: 연결 행 JSON 은 기본값 키를 생략하므로, 기준선으로 되돌려도 그 뒤 추가된 키(예: prewarmIdleTtlSec)가 남던 문제를 라이브에서 발견 → 스냅샷이 지금과 **같은 스키마 버전**이면 "지금 행에는 있고 스냅샷에는 없는 키"를 스키마 기본값으로 되돌린다(`absentAsDefault`, 잠긴 키면 엄격 재검증 422). 스키마 버전이 다르면 지금 값 유지. #108a `compare=active` 도 같은 규칙으로 보여 준다.
  3. **빈 문자열 기본값 오탐**: `runtime.tools`(기본 '') 가 값 검사에서 `required` 로 걸려 **모든 LLM 기준선이 INVALID_ENTRIES** 가 되던 버그 → 기본값이 '' 인 키는 빈 값 허용. 모든 환경(PRODUCTION 포함, 읽기 전용 스크립트)의 연결·정책·AppSetting 현재 값 무결성 OK 확인 + 단위(모든 어댑터 기본값 행 OK).
  4. 비밀 참조가 달라지는 되돌리기는 `credentials.manage` 없으면 **403**(전에는 기록 손상 422 로 보였다).
  5. #108a 상세에 작업자 누락 → 버전 조회에 actor 포함.
- **정본과 다르게 한 점**: ① #102 에 `edit{version, keys[]}`(Form 칸 잠금·실행 검증 표시용) ② #105·#106 은 `patch` 대신 `versionId`(되돌릴 스냅샷)도 받는다(03:50 ⑥ — 운영 Rollback 사전 테스트·Diff) ③ #105 저장값과 같은 후보 → `400 NO_CHANGE` ④ credentialRef 잠금은 Validate·Diff·Test 에서도 `credentials.manage` 보유자만 해제(#93b 의 사전 단계) ⑤ 행 없는 AppSetting 키의 기준선 = `{value, exists:false}` → 그 버전으로 되돌리면 행 삭제 ⑥ Raw JSON 에서 저장 키를 지우면 `400 required`(행 저장소라 삭제 적용 없음) ⑦ Validate rule 은 16종(정본 문구 15종 + CX-2 `restartRequired`) ⑧ #123b 정책 키는 012c 에서 읽기만(`POLICY` 잠금 400)·textVersion 은 `AUTO` 잠금 ⑨ #105 교차 환경은 항상 `403 CROSS_ENVIRONMENT_TEST_UNAVAILABLE` ⑩ Fallback 후보 테스트는 새 예비·주 연결을 차례로 실행하고 마지막 결과 행이 앞 실행을 `related` 로 묶는다(모두 ok 여야 PRODUCTION 통과).
- **검증**(격리 복제본 `~/.node-local/thekaiwa-012c-gate`·`-gate2`(하드링크), 3019·3020 `env -i … APP_ENV=LOCAL next dev -H 127.0.0.1`): tsc 0 · eslint 오류 0(경고 5 = 기존 components) · 단위 전체 **820: 817 pass·0 fail·3 skip**(skip 3 = 복제본에 android/·speech/models 없음 — 기존과 같음) · 신규 012c-edit 29/29(편집 키 표 고정·잠금 순서·rule 16종 도달·Diff 해시·testRequired·blocked·Rollback 재검증·스냅샷 모양·**런타임 실사용값 == Effective(편집 가능 키 전부, 표본 값 ≥30개 + 행에 값 없을 때 기본값)**·PRODUCTION 게이트 전 분기·교차 환경 규칙·역할 × capability·라우트 첫 줄 capability 16핸들러·입력 파서).
  - 라이브 `task012c-smoke.sh 3019 3020` **51/51**: 권한(무세션 401·USER 404·ADMIN Form·DEVELOPER Raw·SUPER #93b·교차 환경 403·VOICE_PROFILE 400) · Validate(잠금 4종·비밀 평문 미반환·제안·x- 키·JSON_SYNTAX 줄/칸·DEPENDENCY) · Apply(기준선 v1+v2·auditIds 1:1·변경 0·409·**두 프로세스 동시 2요청 201/409**·reason 201자 400·비밀 유사 422·줄바꿈 공백) · #93 Form · Diff(summaryHash 두 프로세스 동일) · #105(검증 불가 partial·NO_CHANGE·**LLM 두 프로세스 동시 → 실행 1·429 1**·TTS 후보 합성 ok) · Raw(dryRun·RAW_JSON·키 지우기 400) · **효과: 적용 프로세스 즉시, 다른 프로세스 4.7초 뒤 #19 설정에 반영** · Rollback(ROLLBACK·ROLLED_BACK·기본값 복원·NO_CHANGE·ALREADY_ACTIVE·손상 422 MALFORMED/INVALID_ENTRIES·droppedKeys) · #93a(PRIMARY_IN_USE 409·끄기/켜기 감사) · #93b(평문 400·허용 밖/전역 거부 422·해제 201) · #100 · #123b(textVersion 파생·행 없는 키 되돌리기 = 행 삭제) · #137(필터 = DB 행 수·접두·LEXICON 옛 행·커서) · **감사 1:1(버전 27 = 감사 27)** · 원복 바이트 대조·설정 버전 0 · 응답·감사에 비밀값 0·서버 경로 0·dev 로그에 reason 원문 0. 외부 호출 Claude 1회·M4 합성 2회.
  - 회귀(같은 복제본): 게이트(1단계) **26/26** · 005b **47/47**(R2 반영 — 5c·5j·7c 가 gateway 실제 상태 기준: 이번엔 떠 있음 → HEALTHY·NOT_IMPLEMENTED·순서 포함) · 003g **54/54** · 006 **42/42**(턴 p50 5.1s) · 007 **45/45** · 008 **74/74** · 003d: M4 가 떠 있어 `TTS_SMOKE_EXPECT_M4=1` 로 **16/19** — 실패 3건은 스모크 구조상 기존과 같은 사유(9·9b = 직전 7번이 같은 계정 분당 60회 한도를 소진한 직후라 429, 003d QA 17/20 때와 동일 · 5d = 같은 세션의 첫 실행(M4 없음 가정)이 MISS 합성으로 캐시를 채워 둔 잔여 HIT — 두 실행이 남긴 TtsCache 10행·파일은 삭제). 합성·HIT·미리듣기·Health/FT(HEALTHY·audioBytes)·Trace·누출 검사는 PASS. 끝나고 3019·3020 종료·복제본 2개 삭제(`ss -ltn` 확인).
- **남은 위험·확인 요청**: ① **TTS maxChars 보류 확인**(위 1) ② STT 연결 기능 테스트가 NOT_IMPLEMENTED 라 분석/실시간 STT 연결 켜기·STT Fallback 주/예비 변경은 항상 partial → PRODUCTION 적용 불가(운영 잠금과 같은 효과 — 012b-3 STT 기능 테스트가 생기면 풀림) ③ `credentials.set` 성공 경로는 dev 서버에 값 있는 허용 ref 가 없어(`HOME_M4_API_KEY` 빈 값) 라이브 미확인 — 해제 성공·존재 확인 400·되돌리기 422 는 확인(같은 commitEdit 경로), 비밀 파일은 만들지 않았다 ④ 스냅샷의 잠긴 키 값이 seed·배포로 바뀐 뒤 그 이전 버전으로 되돌리기는 422(엄격 재검증 — 의도), 되돌릴 ref 가 서버에 없어도 SUPER 422 ⑤ 행 없는 AppSetting 키 첫 생성 경합은 잠글 행이 없어 `@@unique(version)` P2002 → 409 로 직렬화(라이브 경합은 연결 행으로만 확인) ⑥ PRODUCTION 경로는 단위로만 확인(라이브 쓰기 금지) — 운영 반영 뒤 운영에서 PRODUCTION 편집 스모크를 할지 Leader 판단 ⑦ `engine/llm/index.ts` 의 엔진 id 분기(claudeShape·engineId 비교)는 기존 부채(이번에 새로 넣지 않음) ⑧ 화면(developer B): Form 은 #102 `edit.keys` 로 칸 잠금·실행 검증 표시, 되돌리기 버튼은 #108 `integrity !== OK` 면 숨김.

### 서버 2단계 수정 라운드 — Codex C2 ①② · REV-036 L1·L2 (Leader 지시)
- [10:50] **developer A — 4건 수정 완료, reviewer 좁은 재검 대기.** 스키마·화면·DTO 계약 변경 0 · PRODUCTION 행 라이브 쓰기 0 · 운영 3010·pm2 무접촉 · commit/push 없음. `runtime.maxChars` 편집 닫음은 Leader 확정(13:30) 그대로.
- **① reason 저장 전 마스킹**: `maskString` 은 문자열 **전체**가 비밀 모양일 때만 가려(앵커 정규식) 문장 속 조각을 못 잡는다 → `infra/mask.ts` 에 `maskText` 추가(같은 판정 `looksSecret`·`maskUrl` 을 공백·한글·일본어로 끊긴 ASCII 조각마다 적용, 앞뒤 괄호·문장부호는 떼고 판정, `Bearer <토큰>` 은 한 번에). 적용: `infra/audit.ts recordAudit` reason(모든 호출자 자동 — 설정 편집·발음 사전·credentialRef) · `engine/configuration/versions.ts writeVersion` reason · 응답(옛 행 대비) `admin/configuration/history.ts` 버전 목록·상세·#137 감사 DTO, 발음 사전 버전 DTO(`reason`·`changeSummary`) · 발음 사전 되돌리기 요약 저장(`lexiconStore` → `rollbackSummary(…, maskText(reason))` — 요약 문장에 이유가 들어가는 저장 경로라 같이 막음, Leader 지시 범위를 약간 넓힘). CX-3 쓰기 거부는 그대로(먼저 돈다).
- **② 연결↔Fallback 교차 행 경합(= REV-036 L2)**: 전역 잠금 순서 **연결(id 오름차순) → Fallback 정책(id 오름차순)**. 정책 편집(#100·config apply·Rollback)은 트랜잭션 첫머리에 후보가 참조하는 연결(주+예비)을 `lockConnectionsForUpdate`(한 행씩 id 순) → 정책 행 잠금 → **커밋 직전 같은 tx 로 참조 재검증**(`fallbackDependencyIssues` — Validate 와 같은 함수: 같은 환경·같은 역할·켜짐·중복·≤4, 위반 400 DEPENDENCY). 연결 끄기는 자기 연결 행 잠금 → `lockFallbackPoliciesForUpdate`(그 환경 정책 전부, id 순) → PRIMARY_IN_USE 재확인(409). 켜기·다른 칸 편집은 정책을 잠그지 않는다(불변식을 깨지 않음).
  - **실측에서 드러난 점**: `EngineFallbackPolicy.primary` 외래 키 때문에 정책의 `primaryConnectionId` 를 바꾸는 UPDATE 는 그 연결 행 공유 잠금을 요구한다 — 정책을 먼저 잠그고 연결은 FK 로 나중에 잡는 쓰기(= 옛 순서)와 연결 끄기가 만나면 **실제로 교착**(첫 실행 D2, `Innodb_deadlocks` +1). 새 순서에서는 정책 tx 가 연결을 먼저 X 잠금하므로 FK 확인이 기다리지 않는다. 또 Prisma 는 `$queryRaw` 안의 교착을 P2034 가 아니라 **P2010(meta.code 1213)** 으로 올려 `withTransaction` 재시도가 걸리지 않았다 → `infra/tx.ts isRetryableTxError` 가 P2010·1213 도 재시도(1205 잠금 대기 초과는 제외, 방어선).
- **③ REV-036 L1**: `getConfigVersion` 이 PRODUCTION 버전 스냅샷 원문(`config.raw.read`)을 돌려줄 때 응답 전에 `AuditLog(config.raw.read)` 1행(`after{detail:'VERSION', versionId, version, crossEnvironment?}` — 값 없음, `getRawConfig` 와 같은 규칙). 요약만 받는 ADMIN·비 PRODUCTION 은 기록 없음(`versionRawReadAuditEntry` 순수 함수).
- **변경 파일**: `src/modules/infra/{mask.ts,audit.ts,tx.ts,index.ts}` · `src/modules/engine/{configuration/versions.ts,connections/index.ts,fallbackPolicy/index.ts,index.ts}` · `src/modules/admin/configuration/{editor.ts,targets.ts,history.ts}` · `src/modules/admin/speech/lexicon.ts` · `src/modules/speech/tts/lexiconStore.ts` · 테스트 `src/modules/infra/__tests__/task012c-reason-mask.test.ts`(신규 4) · `src/modules/engine/__tests__/task012c-edit.test.ts`(+1) · `src/modules/admin/__tests__/task012c-edit.test.ts`(+2) · 라이브 `tests/live/task012c-race.ts`(신규) · `tests/live/task012c-smoke.ts`(N1·N2 추가).
- **검증**(격리 복제본 2개·3019·3020 `env -i … APP_ENV=LOCAL next dev -H 127.0.0.1`, 끝나고 종료·복제본 삭제): tsc 0 · eslint 오류 0(경고 5 = 기존 components) · **단위 전체 827: 824 pass·0 fail·3 skip**(skip = 복제본에 android/·speech/models 없음) · 신규 테스트: `maskText` — CX-3 는 통과하는 `pk-` 접두·32자 hex·URL 자격증명·`sig=` 쿼리·일본어에 붙은 조각·괄호 안 조각 6건 가림 + Bearer, 평범한 한국어·일본어·모델 id·cuid·credentialRef 이름 5건 바이트 그대로 · `recordAudit`·`writeVersion` 저장값 마스킹 · 옛 행 DTO(버전·감사) 마스킹 · L1 감사 항목 4갈래 · 재시도 판정.
  - **경합 실측 `tests/live/task012c-race.ts 20`(실제 MariaDB, LOCAL REALTIME_STT) 6/6**: D1 연결 B 를 잠근 채 끄는 중 → 정책 편집(primary=B)이 B 잠금을 기다림(1.5초 뒤에도 미완료) → 끄기 커밋 뒤 **tx 안 재검증 400 DEPENDENCY**·정책 불변 · D2 정책 편집이 전역 순서대로 잠근 채 primary=B 로 바꾸는 중 → B 끄기가 기다림 → 커밋 뒤 **409 PRIMARY_IN_USE**·B 켜진 그대로 · R1 B 끄기 ∥ 정책(primary=B) 20회 매번 성공 1·거절 1, 불변식(켜진 정책의 주 연결은 켜져 있다) 유지 · R2 A 끄기 ∥ B 끄기 ∥ 정책(primary=B, fallback=[A] — 후보 id 순서가 잠금 순서와 반대) 20회 500·타임아웃 0·최장 1.6초 · **R3 `Innodb_deadlocks` 증가 0**(13 → 13) · 원복 바이트 대조·설정 버전 0.
  - 라이브 `task012c-smoke.sh 3019 3020` **53/53**(N1 CX-3 통과 이유의 비밀 모양 조각이 버전·감사 저장값과 #108·#137 응답에서 `***`, URL 은 자격증명만 지움 · N2 일본어 이유 바이트 그대로 · 마스킹 없이 저장된 옛 행도 #108 목록·#108a 상세에서 가림) · 게이트 스모크 **26/26** · 003g(reason 경로) **54/54**. 외부 호출 Claude 1회·M4 합성 2회.
- **남은 점**: ① `maskText` 는 표시·저장 마스킹이라 오탐 가능(32자 이상 대소문자+숫자 식별자 등은 `***`) — 거부가 아니라 가림이고 원문은 남지 않는다 ② 이미 저장된 옛 AuditLog·버전 행의 reason 은 바꾸지 않는다(append-only) — 응답에서만 가림 ③ 연결 끄기가 이제 그 환경 정책 4행을 잠그므로 끄기 요청끼리는 직렬화된다(관리자 쓰기라 빈도 낮음) ④ `isRetryableTxError` 확대는 infra 전체 `withTransaction` 에 적용 — 콜백은 원래 재실행 안전(P2034 재시도 전제) ⑤ PRODUCTION 원문 조회 감사(L1)는 단위로만 확인(PRODUCTION 버전 행 없음·라이브 금지).

## Reviewer 기록

### 2026-09-29 09:20 reviewer — REV-035

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 2) — 7영역 전부 Read 로 감사 + 격리 미러(`~/.node-local/thekaiwa-rev035`, 공유 미러 `~/.node-local/thekaiwa` 와 분리해 동시 작업 중인 dev-012c 등을 건드리지 않음)에서 tsc·eslint·단위 테스트를 독립 재실행해 Developer 주장을 대조 확인. 이번 라운드는 **012c 1단계(편집 선결 보안 게이트 D-C3(a)(b)(c)·Codex C1 CX-1·CX-2 관련 편집키표·CX-3·D-C9)만** — 편집·버전·Diff·Apply·라우트(2~6단계)·화면·스키마·Python 은 코드에 없다(범위 확인 결과 아래 "⑦ 범위 준수").

**검증 방법(재현)**: `rsync` 로 NFS 현재 `src/`·`prisma/` 를 격리 미러에 동기화 → `./node_modules/.bin/tsc --noEmit`(0 에러) · `./node_modules/.bin/eslint <012c 변경 파일 24개>`(0 에러) · `node --import tsx --test` 로 `src/modules/{infra,engine,admin}/__tests__/task012c.test.ts` **24/24 PASS**(Developer 주장과 일치) · 같은 방식으로 engine/admin/infra 의 기존(무관) 단위 17개 파일 **116/116 PASS**(회귀 없음 — `additionalPropertiesStrip.test.ts`·`lesson.test.ts` 는 task-010 A4 범위라 제외) · `netPolicy.ts` 를 별도 스크립트로 직접 호출해 `classifyAddress`·`checkOutboundUrl`·`vetOutboundUrl` 의 DNS 재바인딩·IPv4-mapped·10진/8진/16진 표기·`0.0.0.0`·`[::]`·169.254·userinfo 케이스를 재현(테스트 코드와 별개로 독립 검증) · `git diff --stat prisma/schema.prisma`·`src/app`·`src/modules/conversation`(012c 몫만) 빈 diff 확인.

**① D-C3(a) 시크릿 전송 대상 고정** — `src/modules/engine/adapters/llm/homeM4.ts:201-210` `prepareHomeM4Call` 이 옛 `resolveCredential`(제거 확인, `grep resolveCredential` 0건)을 대체: `homeM4TargetProblem`(`homeM4.provider.ts:23-29`)으로 주소 origin ≠ 서버 env `AI_API_BASE` origin 이면 `LlmMisconfiguredError(TARGET_NOT_ALLOWED)` 를 던져 **키를 해석조차 하지 않는다** — 단위(`engine/__tests__/task012c.test.ts:169-204`, 반례 7종: 다른 origin·같은 host 다른 port·스킴 다름·IPv6 표기·userinfo·부팅 시크릿 ref·null)와 127.0.0.1 임시 서버로 "실제 요청이 0건" 을 세는 테스트(`:206-229`)로 확인 — 내가 직접 재실행해도 통과. Health 경로도 같은 검사(`homeM4.provider.ts:73-86`)를 먼저 거친 뒤에만 `probeHttpHealth`(호스트 허용 목록, ③)로 넘어간다(이중 게이트). Claude CLI 자식 프로세스 env 삭제 목록에 `TTS_SERVICE_SECRET` 추가(`claudeCli.ts:339`, 기존 누락 보강) — 확인.

**② D-C3(b)·Codex C1 CX-1 credentialRef 허용 목록** — 검사 순서(`engine/credentials/policy.ts:14-22`) ⓪ ref 모양 아님(평문 의심, 400) → ① 전역 거부 분류(`infra/secrets.ts:57-98` `isDeniedCredentialRef` — 이름·패턴 목록에 `JWT_SECRET`·`DATABASE_URL`·`SPEECH_INTERNAL_SECRET`·`TTS_SERVICE_SECRET`·`ANTHROPIC_API_KEY`·`OAUTH*`·`file:` 동일 이름 변환 포함) → ② 어댑터 descriptor `allowedRefs`(home-m4=`env:HOME_M4_API_KEY`·`env:AI_API_KEY`·`file:home-m4-api-key`, TTS=`file:tts-service-token`, whisper=`[]`) → ③ 형식 → ④ 존재. 스키마 자체 검증(`registry/index.ts:60-63` `selfCheckSchema`)이 SECRET_REF 키의 `allowedRefs` 누락·거부분류ref·형식오류를 **로드 실패로 fail-closed**(`getProvider`/`getConfigurationSchema` 가 null 반환 → Router·Health 제외, `pluginStates()` 확인) — 단위(`task012c.test.ts:98-108`) 3가지 위반 케이스 모두 로드 실패 문자열 포함 확인. 순서 ⓪이 정본 #93b(①부터)와 다른 점은 Leader 08:10 "정본 차이 채택"에 이미 기록·승인됨(응답은 여전히 `E_CONN_SECRET_VALUE` 400 — 의미상 거부이지 완화가 아니므로 보안적으로 문제 없음).

**③ D-C3(c) 연결 주소 호스트 허용 목록(중점 재현 완료)** — `infra/netPolicy.ts`(엔진 비의존 순수 판정)+`engine/adapters/common/targetPolicy.ts`(env 이름 수집). 직접 재현한 결과: 10진(`3232291684`)·8진(`0300.0250.0333.0144`)·16진(`0xc0a8db64`)·축약(`127.1`) IPv4 표기는 Node `URL` 파서가 정규화한 뒤 판정(우회 불가) · `::ffff:10.0.0.1`(IPv4-mapped, LAN 밖)은 거부·`::ffff:192.168.219.100`(LAN 안)은 허용 · `0.0.0.0`·`[::]`·`169.254.169.254`(메타데이터)·`fe80::1`(zone id 포함)·다른 사설망(10/8·172.16/12)·NAT64(`64:ff9b::`)·IPv4-compatible(`::a.b.c.d`) 전부 거부 · userinfo(`user:pass@`) 거부 · 비 http(s) 거부 · **DNS 재바인딩**: `vetOutboundUrl` 이 이름 호스트를 해석한 **주소 전부**가 허용 대역일 때만 통과시키고, 실제 연결은 검사한 IP 로 고정한 `connectUrl` 을 쓴다(`httpHealth.ts:93,100` 이 `vet.connectUrl` 로 `fetch` — url 이 아님, 직접 확인) — 해석 주소 중 하나라도 밖이면(mixed) 전체 거부. **https 이름은 신뢰 origin 이 아니면 거부**(SNI 로 IP 고정 불가 — 설계·Leader 08:10 승인과 일치). 신뢰 origin(서버 env `AI_API_BASE`·`SPEECH_GATEWAY_URL`·`WHISPER_SERVICE_URL`·`TTS_SERVICE_URL`·`TTS_BASE_URL`·`KAIWA_*_CONNECTION_BASEURL`)은 이름이어도 DNS 검사 없이 신뢰(운영자 설정 — 설계 의도, connectUrl 도 미고정이지만 이는 시크릿 전송 경로가 아니라 Health 전용이라 ①의 origin 고정이 실제 방어선). `SERVICE_URL_ENV_NAMES` 상수가 Provider 스키마 URL 키 envAlias 합집합과 일치하는지 단위(`task012c.test.ts:112-115`)로 자기 검증. 리다이렉트 미추종은 `httpHealth.ts` `redirect:'manual'`(기존 유지) + 라이브 스모크(302 대상에 요청 0)로 재확인.

**④ Codex C1 CX-3 reason 공용 검사** — `infra/reason.ts`: 제어문자→공백·trim, 1~200자(PRODUCTION 10~200), 비밀 유사(접두·Bearer/Basic·JWT 모양·키=값·24자↑ 고엔트로피 3종 이상) 거부, 오류·로그 어디에도 원문 없음(단위 `requireReason` 테스트가 `JSON.stringify` 로 직접 확인). **발음 사전(003g) 쓰기 5경로(추가·수정·비활성·Import·Rollback) 전부 적용**(`admin/speech/lexicon.ts:372,388,409,472,654` grep 확인) — 003g 기존 계약(칸 오류 `E_REASON`)은 유지하고 비밀 유사만 `E_REASON_SECRET_LIKE` 로 갈래를 올리는 방식(Leader 03:15 결정과 일치), 기존 `lexicon.test.ts`(옵션 없이 호출하는 하위호환 케이스 포함)·`effective-audit.test.ts` 등 무관 스위트 재실행에서 회귀 없음 확인.

**⑤ D-C9 Functional Test 30초 슬롯 원자화** — `functionalTest/index.ts` `claimFunctionalSlot` 이 프로세스 메모리 Map(제거 확인)을 DB 조건부 `updateMany(WHERE id AND (lastFunctionalAt IS NULL OR < now−30s))` 로 대체 — MariaDB InnoDB 단일 UPDATE 문은 행 잠금으로 원자적이라 blue/green 두 프로세스·동시 요청에서도 1건만 갱신됨(단위 `task012c.test.ts:279-292` 가짜 원자 DB로 "동시 5요청 중 1건만" 재현, Developer 라이브 스모크도 두 실제 프로세스·동시 4요청 → 200 1·429 3·FUNCTIONAL 행 1 로 확인). **실패 시 슬롯 반납 여부(감사 지시 사항 ⑤)**: 슬롯은 시작 시점에 선점되고 테스트 결과(성공/실패)와 무관하게 30초간 유지된다 — `health/index.ts` 에서 `recordHealth` 가 더 이상 `lastFunctionalAt` 을 갱신하지 않도록 제거해 "결과 시각으로 밀림" 문제도 없앴다(설계 문서·이력서 모두 "마지막 시작 시각"으로 명시, Claude 구독 보호가 성공 여부와 무관하게 걸려야 한다는 의도된 설계 — 결함 아님). 429 응답의 `retryAfterSec` 은 1~30 범위로 클램프 확인.

**⑥ 6층 경계·엔진명 누출** — `grep -rniE "reazon|whisper|style-bert|claude"` 를 012c 변경 파일 전체(admin·infra·types·engine 비-adapter 파일)에 돌려 0건, 유일한 매치는 `engine/adapters/common/targetPolicy.ts:11` 의 `WHISPER_SERVICE_URL`(체크리스트가 명시적으로 허용하는 `engine/adapters` 영역). `engine/index.ts` 는 012c 몫만(신규 export 4줄) 추가됐고 `admin`·`preferences`·`speech`·`conversation` import 없음(engine 이 상위 층을 참조하지 않음 확인). `infra/netPolicy.ts`·`infra/reason.ts` 는 node 내장 + `infra` 내부(`./http`·`./text`)만 import.

**⑦ 범위 준수** — `prisma/schema.prisma` diff 없음(완료 기준 1) · `src/app/**` diff 없음(라우트 미추가, #93·#93a·#93b·#96(슬롯만)·#105~#111 미구현 확인) · `src/modules/conversation/**`·`.claude/agents/tutor.md` 무변경(012c 몫 diff 0) · Python(`speech/**`)·`.env*`·`ecosystem.config.js`·`deploy.yml` 무변경 · 화면(`src/components/**`·`src/app/(admin)/**`) 무변경 — **데모 게이트 재실행 대상 아님**(화면을 바꾼 task 가 아님, `demo_gate.status` 는 designer 몫 그대로 둠). PRODUCTION 행 라이브 접촉 없음(스모크는 LOCAL 3행만, 원복 대조 통과가 Developer 기록에 있고 라이브 실행 자체는 QA 재현 몫).

**⑧ Codex C1 CX-1~3 구현 대조** — Leader 03:05 채택분이 실제 코드에 반영됐는지 확인(재판정이 아니라 구현 검증): CX-1(허용목록+전역거부, ②) 구현 일치 · CX-2(`testResultId` 는 변경 키 전부 검증 시에만)는 **#105 라우트 자체가 아직 없어 코드 대조 대상 없음**(편집 키 표에 RESTART_REQUIRED·REDEPLOY_REQUIRED 키를 편집 후보에서 뺀 것만 이번 범위 — 표는 마크다운 문서라 이번 REV 의 코드 감사 대상이 아니고, 실제 Validate/Test 구현 때(2단계) 재검증 필요) · CX-3(reason 검사, ④) 구현 일치.

**⑨ Leader R3 판단(08:10)과 편집 키 표** — R3 의 4가지 판단(표시 전용 키 `verifiable:NOT_NEEDED`·`speech.review.threshold` PRODUCTION 잠금·TTS `sdpRatio` 류 편집 불가·`allowedTasks` 보류)은 **편집 로직(2단계) 이 아직 구현되지 않아 코드로 검증할 대상이 없다** — 편집 키 표는 이력서 문서일 뿐이고 실제 Validate·Diff·Apply 코드가 붙는 시점(다음 라운드)에 이 REV 의 후속으로 재확인이 필요하다는 점만 QA/다음 Reviewer 라운드에 인계.

**Low 1** — `src/modules/infra/secrets.ts:149` `readCredentialFor` 는 어댑터 descriptor 의 `allowedRefs`(허용 목록, ②)를 **스스로 검사하지 않고** 호출자가 먼저 `checkCredentialRef`/`checkConnectionCredentialRef` 를 통과시켰다고 가정한다(주석에 명시된 계약). 현재 유일한 호출자 `prepareHomeM4Call`(`homeM4.ts:206-207`)은 순서를 정확히 지키고(먼저 `checkCredentialRef`, 그다음 `readCredentialFor`) 단위로 확인됐지만, 이 계약은 "호출자가 항상 순서를 지킨다"는 신뢰에 의존한다 — write 라우트(#93b, 2단계)나 다른 어댑터가 이 함수를 추가로 부를 때 순서를 빠뜨리면 전역 거부 밖의 ref(=descriptor 허용 목록엔 없지만 전역 거부에도 안 걸리는 ref, 예: 다른 엔진의 파일 시크릿)가 origin 고정만 통과하면 새어나갈 수 있다. 차단 사유는 아님(현재 유일 호출자가 정확·글로벌 거부가 부팅 시크릿은 이중 방어) — 권고: `readCredentialFor` 에 선택 `allowedRefs` 파라미터를 추가해 자체적으로도 재검증하거나, 2단계에서 새 호출자를 추가할 때 이 조합을 리뷰 체크리스트에 명시.
**Low 2** — `homeM4.ts:35`·`homeM4.provider.ts:8` 가 `engine/credentials/index.ts` 대신 `engine/credentials/policy.ts` 를 직접 import 한다(공개 진입점 우회). 순환 참조 회피가 이유로 보인다(`credentials/index.ts` → `registry` → `adapters/providers` → `homeM4.provider.ts` 순환) — 같은 이유로 `targetPolicy.ts` 는 주석 3줄로 명시적으로 설명하는데 이 두 파일에는 그 설명이 없다. 동작에는 문제 없음(기능 확인됨), 유지보수성 권고로만 남김 — 다음에 이 파일을 만지는 사람이 "왜 index 를 안 쓰지" 라고 되묻지 않도록 한 줄 주석 권고.

**요약**: Critical 0 · High 0 · Medium 0 · Low 2(둘 다 차단 아님, 유지보수성 권고). 구현이 D-C3(a)(b)(c)·CX-1·CX-3·D-C9 를 설계·Codex C1 채택분·Leader 확정 사항과 정확히 일치시켰고, 독립 재실행(tsc·eslint·단위 24+116·수동 netPolicy 재현)이 Developer 주장을 전부 뒷받침한다.

**QA 인계 — high_risk_areas**: ["home-m4 API 키 전송 대상 고정(origin 다른 포트·스킴·IPv6 표기 반례)", "연결 주소 호스트 허용 목록의 DNS 재바인딩 방어(이름→IP 해석 뒤 connectUrl 고정)", "credentialRef 전역 거부 분류 vs 어댑터 허용 목록 경계(다른 연결 ref 교차 사용 차단)", "Functional Test 30초 슬롯의 2프로세스 동시성", "발음 사전(003g) reason 검사 회귀(기존 003g 스모크·문구)"] · **native_change: false** · **화면 변경 없음 — 데모 게이트 재검토 불필요**.

### 2026-09-29 10:15 reviewer — Codex C2 판정(012c)

대상: 코디네이터(Leader)가 직접 전달한 Codex C2(adversarial·security) 지적 3건 — 이 시점에 이력서 "## Codex 검토"에는 아직 C2 원본 블록이 기록돼 있지 않아, 전달받은 지적을 코드 인용(파일:줄)으로 먼저 대조한 뒤 판정했다. 셋 다 REV-035 가 PASS 로 넘긴 012c 1단계 diff 안의 코드다 — REV-035 를 다시 열어 대조.

#### 지적 ①(`claudeCli.ts:312` 자식 env 블랙리스트) — **채택(Medium)**

**실제로 자식에 전달되는 env 키 집합을 코드로 확인**: `cleanEnv`(`claudeCli.ts:312-350`)는 `{ ...process.env }` 로 **부모 프로세스 env 전체를 복사한 뒤** `drop` 목록(19개 키)만 `delete` 한다 — 목록에 없는 키는 전부 그대로 남아 자식(`spawn`, `:552`·`:805` 두 호출 지점 모두 이 함수를 거침)에 전달된다. `.env.example`(53줄) 전체와 대조한 결과 **현재 정의된 시크릿 형태 값(`JWT_SECRET`·`DATABASE_URL`·`GOOGLE_CLIENT_SECRET`·`SIGNUP_INVITE_CODE`·`HOME_M4_API_KEY`·`SPEECH_INTERNAL_SECRET`·`TTS_SERVICE_SECRET`·`ANTHROPIC_API_KEY`)는 전부 목록에 있어 지금 이 순간 활성 유출은 없다** — 하지만 이건 목록을 일일이 손으로 맞춰 놓은 결과일 뿐, 구조 자체가 "새 시크릿 env 를 추가하면서 이 배열에 추가하는 걸 잊으면 조용히 새어나간다"는 fail-open 이다. Codex 의 "DB·OAuth·내부 서비스" 예시는 이미 목록에 있지만(`DATABASE_URL`·`GOOGLE_CLIENT_SECRET`·`SPEECH_INTERNAL_SECRET`), **지적의 핵심은 개별 누락이 아니라 방식(블랙리스트) 자체의 구조적 위험**이라 채택.

**허용 목록 전환 시 위험도 판단(지시 사항)**: Claude CLI 는 TheKaiwa 에서 **구독 인증**(`connection.authMode=SUBSCRIPTION`)을 쓴다 — `cleanEnv` 가 굳이 `ANTHROPIC_API_KEY` 를 지우는 이유도 "서버 env 에 키가 있어도 과금 경로가 갈리지 않도록"(코드 주석)이라, CLI 의 인증 자체는 **`HOME` 아래 CLI 자체 설정/세션 파일**을 읽지 env 값의 API 키에 의존하지 않는다(=허용 목록에 인증용 시크릿을 하나도 넣지 않아도 구독 인증은 그대로 동작한다는 뜻 — 오히려 지금 이 함수가 `ANTHROPIC_API_KEY` 를 애써 지우는 행위 자체가 "이 프로세스는 시크릿 env 가 필요 없다"는 설계 의도를 방증한다). 허용 목록으로 옮길 때 실제 위험은 보안이 아니라 **가용성**(CLI 실행에 필요한 것을 빠뜨려 동작이 깨짐) 쪽이다 — `PATH`(`:349-351` 이 이미 `~/.npm-global/bin` 을 앞에 붙이는 로직과 얽혀 있음)·`HOME`(설정·세션 디렉터리)·`LANG`/`LC_*`(문자 인코딩)·`TMPDIR`·`TERM`·`USER`/`LOGNAME`·(npm/node 가 내부적으로 참조할 수 있는 `NODE_OPTIONS`·`NPM_CONFIG_*`·프록시가 있다면 `HTTPS_PROXY`/`NO_PROXY`) 정도가 후보다. Codex 도 이 위험을 알고 "회귀 테스트" 를 권고했는데 타당하다 — 허용 목록으로 바꾸는 커밋은 실LLM 호출 스모크(006·007·008 최소 1회씩)로 CLI 가 여전히 뜨는지 확인하는 회귀가 반드시 같이 들어가야 한다.

**최소 수정 방향**: `drop` 배열을 뒤집어 `ALLOW = ['PATH','HOME','LANG','LC_ALL','LC_CTYPE','TMPDIR','TERM','USER','LOGNAME','SHELL']`(+필요시 `NODE_OPTIONS` 없음 확인 후 제외 유지) 화이트리스트로 바꾸고, `MAX_THINKING_TOKENS` 처럼 이 함수가 직접 설정하는 키는 화이트리스트 이후에 얹는다. `~/.npm-global/bin` PATH 보정 로직(`:349`)은 그대로 유지(허용된 `PATH` 위에 얹는 것뿐이라 영향 없음). 전환은 이번 REV-035 판정을 뒤집는 차단 사유는 아니다(오늘 활성 유출 0) — 다음 Developer 라운드에서 처리하고 회귀 스모크로 재확인 권고.

#### 지적 ②(`secrets.ts:124` `file:` 시크릿 TOCTOU) — **채택(Medium, 근거 있는 상향 고려 사항 포함)**

**코드로 재확인**: `readSecretFile`(`secrets.ts:119-139`, 012c 신규 함수)은 `lstatSync(full)`(`:126`, 심볼릭 링크를 따라가지 않음 → 지금 심볼릭 링크면 `isFile()===false` 로 정상 거부)으로 검사한 **뒤**, `readFileSync(full, 'utf8')`(`:134`)로 **같은 경로 문자열을 다시 열어** 읽는다 — `readFileSync` 는 기본적으로 심볼릭 링크를 따라간다. `lstatSync` 호출과 `readFileSync` 호출 사이(마이크로초~밀리초 창)에 공격자가 `full` 위치의 파일을 심볼릭 링크로 바꿔치기하면, 검사는 "일반 파일·0600·본인 소유"를 통과했지만 실제로 읽히는 것은 **링크가 가리키는 임의의 파일**이다 — 전형적인 TOCTOU(CWE-367) 경합이며 오탐이 아니다. 직접 재현 PoC 는 실행하지 않았다(파일시스템 경합 조작은 이 REV 의 Read-전용·라이브 금지 범위 밖) — 코드 추적만으로 경로가 존재함을 확인.

**현재 도달 가능성(완화 요인, 채택 등급 조정 근거)**: `prisma/seed-data/engines.json` 을 grep 한 결과 이번 시드에서 `file:` 형식 `credentialRef` 를 쓰는 connection 이 **0개**다(home-m4 는 `env:HOME_M4_API_KEY`, TTS 는 `credentialRef:null`—Phase 1 은 `readServiceSecretFor` 고정 시크릿 경로를 씀). 즉 **오늘 운영·개발 어디에서도 이 코드 경로가 실제로 실행되지 않는다**(단위 테스트가 직접 호출할 때만 실행됨, `task012c.test.ts:183-202`). 그래서 지금 당장의 활성 위험은 0 이지만, (a) home-m4 스키마의 `connection.credentialRef` 기본값 자체가 `'file:home-m4-api-key'`(`homeM4.provider.ts:58`)라 새 배포·시드 갱신 시 언제든 `file:` 경로가 살아날 수 있고 (b) #93b(credentialRef 연결 API, 2단계)가 열리면 운영자가 직접 `file:` ref 를 연결하는 정상 플로우 자체가 이 함수를 타게 된다 — **"아직 안 쓰인다"는 이유로 미룰 수 있는 문제가 아니라 2단계 착수 전에 반드시 닫아야 하는 선결 사항**이라고 본다. 이 TheKaiwa 워크스페이스는 한 Linux 사용자(`brownjeon`) 아래 여러 프로젝트가 함께 돈다는 CLAUDE.md 의 서술을 감안하면, `SECRETS_DIR`(0700 소유) 에 쓰기 권한이 생기는 경로(다른 프로젝트의 파일 업로드 취약점 등)가 있다면 이 TOCTOU 로 `brownjeon` 이 읽을 수 있는 **임의 파일**(다른 프로젝트 `.env`, SSH 키 등)을 credentialRef 값으로 흘려받을 수 있어 파급 범위가 TheKaiwa 밖으로 번질 수 있다 — Medium 태그를 그대로 받아들이되, 이 파급 범위를 근거로 다음 라운드 우선순위를 높게 권고한다.

**최소 수정 방향**: `lstatSync`+경로 재오픈 대신 **fd 하나로 열기·검사·읽기를 묶는다** — `fs.openSync(full, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)`(리눅스에서 마지막 경로 성분이 심볼릭 링크면 `ELOOP` 로 즉시 실패 — swap 을 원천 차단) → 그 fd 로 `fs.fstatSync(fd)`(경로가 아니라 **이미 연 파일 자체**를 검사하므로 이후 경로 조작이 무의미) → 같은 fd 로 `fs.readFileSync(fd)`(Node `readFileSync` 는 숫자 fd 를 그대로 받는다) → `fs.closeSync(fd)`. 세 동작이 전부 같은 open file description 을 대상으로 해 검사와 읽기 사이에 끼어들 틈이 없다. `describeCredentialRef`(같은 파일, 값을 읽지 않고 `statSync` 로 존재만 보는 함수)는 내용을 반환하지 않으므로 이번 위험도에서 제외 — 다만 일관성을 위해 같이 정리해도 좋다는 참고만 남긴다.

#### 지적 ③(`reason.ts:25` 유니코드 서식 문자 우회) — **채택(Medium, 직접 재현으로 실증)**

**직접 재현(코드 수정·라이브 없이, 로직만 별도 스크립트에 복제해 순수 함수로 검증)**: `normalizeReason`(`reason.ts:25-27`)의 `CONTROL_RUN`(C0·C1·U+2028/2029)은 유니코드 **서식 문자**(Cf 카테고리 — soft hyphen U+00AD·zero-width space U+200B·ZWNJ U+200C·ZWJ U+200D 등)를 다루지 않는다. `isSecretLikeText`(`:40-44`)의 정규식(`SECRET_PREFIX`·`AUTH_SCHEME`·`JWT_LIKE`·`KEY_VALUE`·`TOKEN_RUN`)은 모두 문자 연속을 전제하므로, 서식 문자를 시크릿 패턴 중간에 끼워 넣으면 연속이 끊겨 탐지를 피한다. 정본 로직(정규식 5개)을 그대로 복제한 독립 스크립트로 6가지 케이스를 시험한 결과:

| 케이스 | 삽입 문자 | `isSecretLikeText` |
|---|---|---|
| 기준(평문 `sk-proj-AbCdEf1234567890`) | 없음 | **true(탐지)** |
| `s` `k-proj-...` 사이 | soft hyphen U+00AD | false(우회) |
| `password` `=hunter2...` 사이 | ZWSP U+200B | false(우회) |
| 25자 고엔트로피 토큰 글자마다 | ZWNJ U+200C | false(우회) |
| `AKIAIOSFODNN7EXAMPLE` 글자마다 | soft hyphen U+00AD | false(우회) |
| `token` `:qwerty...` 사이 | ZWSP U+200B | false(우회) |
| `gh` `p_ABCDEF...` 사이 | ZWJ U+200D | false(우회) |

기준 케이스만 탐지되고 나머지 6건 전부 우회됨을 실측 확인 — Codex 지적이 이론이 아니라 100% 재현되는 실제 우회다. 오탐 아님. 서식 문자는 **너비 0** 이라 사람이 감사 화면에서 읽을 때도 거의 보이지 않으면서 원래 문자는 순서대로 다 남아 있어(`s`+`k`+`-`+`p`+`r`+...) 복사·재구성이 쉽다는 점에서 탐지 우회가 곧 "감사 로그에 사실상 읽을 수 있는 비밀이 영구 저장된다"로 직결된다 — CX-3 의 존재 목적(§7 "reason 이 시크릿 유입 경로가 되면 안 된다")을 정확히 무력화한다.

**최소 수정 방향**: `normalizeReason` 에 두 단계를 추가한다 — ① `raw.normalize('NFKC')`(전각/호환 문자 통합 — 별도 우회 클래스 방어, Codex 제안대로) ② **Cf(서식) 카테고리 제거**(공백 치환이 아니라 **삭제**여야 한다 — `\p{Cf}` 를 스페이스로 바꾸면 `s­k` → `s k` 가 되어 여전히 `sk-` 매칭이 깨진다. 원 문자가 폭 0 이라는 성질을 살려 그냥 제거해 `s­k`→`sk` 로 **인접을 복원**해야 탐지 정규식이 다시 걸린다): `raw.normalize('NFKC').replace(/\p{Cf}/gu, '')` 를 `CONTROL_RUN` 치환보다 먼저 적용. 정규식에 `u` 플래그가 필요(현재 파일의 다른 정규식엔 없음 — 신규 정규식에만 추가). 회귀 사례로 위 6건을 `infra/__tests__/task012c.test.ts` 의 `isSecretLikeText`/`checkReason` 테스트에 추가하고, 정상적인 한국어·일본어 문장(예사 사전 사유 문구)이 NFKC 이후에도 그대로 유지되는지 회귀 케이스를 최소 1건 더 권고(한글 음절·일본어 가나/한자는 NFKC 가 실질적으로 형태를 바꾸지 않지만 확인은 저비용).

#### 판정 요약

세 건 **전부 채택**(오탐 0·범위 밖 0), 셋 다 Medium — ①·②는 오늘 시점 활성 유출은 없음(①은 현재 목록이 실제 시크릿을 다 덮고 있고, ②는 `file:` credentialRef 가 아직 아무 데도 쓰이지 않음)이 확인됐지만 구조적 결함이라 다음 라운드 전에 닫는 편이 안전하고, ③은 활성 우회를 직접 재현했다(100% 우회 성공). 세 건 모두 Critical/High 는 아니라 REV-035 의 PASS 판정 자체를 뒤집지는 않으나(1단계 완료 기준·범위 준수는 그대로 유효), **프로토콜대로 채택 지적이 있으므로 developer 수정 → reviewer 재순환 대상**이다 — 특히 ②(TOCTOU)는 #93b(credentialRef 편집, 2단계) 착수 전 선결로, ③(reason 우회)은 CX-3 가 이미 운영(003g 발음사전) 경로에 반영돼 있어 우선순위를 높게 권고한다. 코드 수정은 하지 않았다(Read 전용·라이브 금지 준수, ③의 재현은 원본 로직을 그대로 복제한 별도 스크립트에서만 수행했고 저장소 파일은 건드리지 않았다).

### 2026-09-29 11:05 reviewer — Codex C2 수정 재검(012c)

대상: Developer 기록 "Codex C2 지적 3건 수정"(08:27) — ①②③ + REV-035 Low 1·2. 지시받은 3가지 재검 항목을 코드 추적 + 독립 재실행 + 별도 스크립트 재현으로 확인. 코드 수정·라이브 호출 없음(격리 미러 `~/.node-local/thekaiwa-rev035b` 는 재현·빌드용 스크래치 — 검증 뒤 삭제).

**공통 검증**: 격리 미러(공유 미러와 분리) `tsc --noEmit` 0 에러 · `eslint`(변경 파일 7개 + 신규 테스트 3개) 0 에러 · `task012c.test.ts`(infra/engine/admin) **48/48 PASS**(REV-035 때 24개였던 것이 Codex C2 대응 테스트로 늘어남, Developer "신규 012c 단위 30/30" 과 세 파일 합산 기준 다름 — 직접 센 개별 테스트 수는 48개, 모두 통과) + `claudeArgs.test.ts`·`claudeWarm.test.ts`(buildChildEnv 와 무관 영역 회귀 확인) · 무관 기존 스위트(admin 5·engine 5·infra 5, 총 98건) 전부 회귀 없음.

#### ① 자식 env 허용 목록(`claudeCli.ts` `buildChildEnv`) — 지시 사항 확인 결과

**허용 목록에 프록시 env·인증서 경로·`CLAUDE_CONFIG_DIR` 가 시크릿 유출이나 동작 변경 여지가 있는지**: 코드(`claudeCli.ts:311-352`)로 목록 전체를 확인했다.
- **인증서 경로**(`NODE_EXTRA_CA_CERTS`·`SSL_CERT_FILE`·`SSL_CERT_DIR`)는 **파일 경로 문자열**이지 시크릿 값 자체가 아니다 — TLS 신뢰 앵커를 어디서 읽을지 알려줄 뿐이라 유출 리스크는 없고, `ALLOWED_TOOLS=[]`(코드 확인, 도구 0개 허용)인 이 CLI 는 애초에 임의 코드 실행·MITM 삽입 경로가 없어 동작 변경 여지도 실질적으로 없다.
- **`CLAUDE_CONFIG_DIR`**: `.env`·`.env.example`·`ecosystem.config.js` 어디에도 이 이름이 없고(`grep` 0건), `docs/deploy-order.md:258` 가 "인증은 `~/.claude`"(기본 위치)라고 명시한다 — 운영은 이 값을 쓰지 않으므로 현재는 무해한 no-op. Developer 도 "남은 점 ①"에 같은 확인을 남겼다(중복 확인, 일치).
- **프록시 env(`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` 대소문자 6개)** — 여기가 **지시 사항의 핵심 우려대로 실제 여지가 있다**: 값이 `http://user:pass@proxy.internal:3128` 형태면 URL 안에 자격 증명이 그대로 들어간다. `.env.example`·`docs/`·`ecosystem.config.js` 어디에도 프록시 설정이 없어(`grep` 0건) **오늘은 이 값 자체가 비어 있어 활성 유출은 없다**(구 블랙리스트 코드에서도 이 6개는 애초에 `drop` 목록에 없어 항상 넘어갔으므로 이번이 새로 연 문은 아니다 — 회귀 아님). 다만 Codex C2 finding ① 의 취지(허용 목록은 "정말 필요한 것만"이어야 fail-closed 가 의미 있다)를 살리면, **지금 아무도 안 쓰는 프록시 값을 미리 허용해 둘 이유가 약하다** — 실제로 회사/집 LAN 프록시가 생기는 시점에 그때 (a) 필요하면 추가하거나 (b) userinfo 를 제거한 origin 만 넘기는 정제 단계를 끼워 넣는 편이 지금 여섯 키를 미리 열어 두는 것보다 안전하다. **차단 사유는 아니다**(활성 유출 0·회귀 아님·CLI 자체가 도구 0개라 탈취 경로가 좁음) — 다음 라운드 권고로 남긴다: 프록시가 실제로 필요해지기 전까지 6개 키를 목록에서 빼거나, 남겨 두려면 `buildChildEnv` 에서 프록시 값에 대해서만 `new URL(v)` 파싱 뒤 `username`/`password` 가 있으면 빼는(origin+path 만 전달) 방어 한 줄을 추가.
- **운영(pm2 env)에서 CLI 가 필요한 키가 빠지지 않는지**: Developer 가 격리 미러에서 실제 007 스모크 뒤 예열 CLI 자식의 `/proc/<pid>/environ` 을 직접 읽어 `HOME LANG MAX_THINKING_TOKENS NODE_ENV PATH USER` 6개만 남았고, 이 조건에서 **006 42/42·007 44/44·008 74/74 전부 통과**(실 LLM 호출 성공)했다는 라이브 근거를 남겼다 — 코드(`buildChildEnv` 단위 테스트 `task012c.test.ts:298-342`)와 이 라이브 결과가 서로 대조돼 "CLI 가 필요로 하는 키가 목록에서 빠지지 않았다"는 주장을 뒷받침한다. 다만 이 확인은 **격리 미러(개발 환경)의 프로세스 env** 기준이라, pm2 로 기동되는 운영 프로세스(systemd/pm2 daemon 이 물려주는 env 가 로그인 셸과 다를 수 있음 — 예: `LANG`·`TERM` 미설정)에서 동일 결과가 보장된다는 증거는 아니다. **권고**: 운영 반영 뒤 회화·채팅 스모크(006/007) 1회를 deployer/QA 표준 절차에 포함(이미 배포 체크리스트에 있는 항목과 같은 것이라 추가 비용은 낮음).

**판정: 채택분 정상 반영 확인, 잔여 권고 1건(Low) 신규 기록** — 구조(블랙리스트→허용목록 fail-closed) 전환은 정확하고 Codex ①의 핵심 취지를 충족한다. 프록시 env 는 활성 위험이 아니라 차단하지 않되, 다음 라운드에 정리 권고.

#### ② `file:` 시크릿 TOCTOU(`secrets.ts` `readSecretFile`) — 지시 사항 확인 결과

코드(`secrets.ts:140-180`)로 fd 기반 열기·검사·읽기 결합을 확인했다 — `openSync(full, O_RDONLY|O_NOFOLLOW|O_NONBLOCK)`(`:153`) → 그 fd 로 `fstatSync`(`:159-162`, 파일종류·권한·소유자·크기) → 그 fd 의 실제 경로(`/proc/self/fd/N`)가 기대 경로와 일치하는지(`:163-164`) → 같은 fd 로 4KB+1 상한 읽기(`:165-172`) → `finally` 블록에서 `closeSync`(`:178`). 경로 재오픈이 코드 어디에도 없다(`readFileSync(full, …)` 같은 두 번째 open 호출이 사라졌음을 `grep 'readFileSync\|openSync'` 로 확인) — Codex C2 지적이 요구한 최소 수정 방향과 정확히 일치.

**`/proc` 미존재 시 폴백이 fail-open 인지 fail-closed 인지**: `secretFileDeps.fdPath`(`:119-129`)가 `/proc/self/fd/<fd>` `readlinkSync` 실패 시 `null` 을 돌려주고, 호출부(`:163-164`)는 `where !== null && where !== full` 일 때만 거부한다 — 즉 **`/proc` 이 없으면(non-Linux) ③ 단계(경로 재확인) 만 조용히 생략된다(그 항목만 fail-open)**. 다만 이게 전체 TOCTOU 방어를 무력화하는 건 아니라고 판단한다: ①(`O_NOFOLLOW`, 마지막 경로 성분이 심볼릭 링크면 열기 자체가 `ELOOP` 로 실패)과 ②(fstat 이 이미 열린 fd 를 대상으로 하므로 open 이후 어떤 경로 조작도 결과에 영향 없음)는 `/proc` 과 무관하게 **항상** 걸린다 — Codex 가 지적한 원래 취약점("검사 통과 뒤 다른 경로를 다시 열어 읽는다")의 근본 원인(같은 fd 로 안 쓴 것)은 `/proc` 유무와 무관하게 닫혔다. `/proc` 이 없을 때 남는 것은 **더 좁은 잔여 창**(`SECRETS_DIR` 자체를 이루는 **중간 디렉터리 성분**을 `realpathSync(dir)` 호출과 `open()` 호출 사이에 바꿔치기해 `SECRETS_DIR` 밖의 동명 파일을 열게 만드는 경우)뿐이고, 이건 (a) `SECRETS_DIR`(0700, brownjeon 소유) 자체나 그 상위 디렉터리에 쓰기 권한이 있어야 하는 더 강한 전제가 필요하고 (b) 실제 배포 대상(우분투 pm2)에는 `/proc` 이 항상 있어 이 폴백 경로 자체가 도달하지 않는다(Node·Linux 표준 환경). **정리**: 주 위험(최종 파일 심볼릭 링크 스왑)은 fail-closed, 부차 위험(중간 디렉터리 스왑)만 `/proc` 없는 환경에서 조용히 fail-open — 실배포 환경에서는 해당 없음. **권고(비차단)**: `/proc` 부재로 ③이 생략된 경우 경고 로그 한 줄(`console.warn`, 값 없이)을 남기면 향후 배포 환경이 바뀌어도(예: 특정 컨테이너 런타임) 조용히 약화된 방어를 운영이 알아챌 수 있다.

**`O_NONBLOCK` 이 FIFO 외에 부작용 없는지**: POSIX/Linux 의미상 `O_NONBLOCK` 은 **일반 파일 읽기에는 영향이 없다**(항상 즉시 "준비됨"으로 취급돼 `open`·`read` 동작이 달라지지 않는다) — 실제로 영향을 받는 대상은 FIFO(열기가 상대편이 열 때까지 블록되는 것을 막음, Developer 의도한 목적 그대로)와 일부 캐릭터 디바이스뿐이다. 유닉스 도메인 소켓은애초에 `open()` 으로 열 수 없다(`ENXIO`). 디렉터리를 실수로 가리키는 경우는 `O_NONBLOCK` 과 무관하게 `fstatSync` 의 `!st.isFile()` 에서 이미 거부된다(`:160`, 직접 확인). 결론: `O_NONBLOCK` 은 지적된 FIFO-블록 DoS 방지 목적 외에 정상 경로(일반 파일)에 부작용이 없다.

**판정: 채택분 정상 반영 확인** — 주 취약점(최종 파일 TOCTOU)은 fd 결합으로 완전히 닫혔고, `/proc` 부재 시의 잔여 갭은 실배포 환경(Linux)에서 도달 불가능한 경로라 차단 사유가 아니다. 경고 로그 권고 1건(Low, 비차단)만 남긴다.

#### ③ reason 유니코드 서식 문자 판정(`reason.ts` `reasonCheckForm`) — 지시 사항 확인 결과

**직접 재현**(REV-035 때 우회를 실증한 것과 같은 방식 — 원본 정규식·로직을 별도 스크립트에 그대로 복제해 코드 수정 없이 순수 함수로 검증):
1. **이전에 우회됐던 6가지 케이스를 현재 로직(`normalize('NFKC')` → `\p{Cf}`·`\p{Default_Ignorable_Code_Point}` 삭제)으로 재시험 → 6건 전부 `SECRET_LIKE` 로 다시 탐지됨**(soft hyphen·ZWSP·ZWNJ·ZWJ 삽입 케이스 전부 차단 확인) — Codex C2 ③이 요구한 수정이 실제로 우회를 닫았다.
2. **일본어 이체자 선택자(IVS, 예: 辻+VS17 U+E0100)·이모지 변이 선택자(하트+VS16)·한글 초성 필러(U+115F)·한글 호환 필러(U+3164)·반각 가나를 섞은 정상적인 사유 문구 7종을 시험 → 전부 정상 통과(`checkReason.ok===true`)하고, 저장되는 값(`r.reason`)이 원문과 정확히 같음**(제어문자 정리 규칙만 적용된 `normalizeReason(raw)` 그대로, `Cf`/`Default_Ignorable` 제거·NFKC 는 판정용 형태에서만 쓰이고 저장값에는 전혀 영향을 주지 않음을 직접 대조). **지시 사항의 우려("이체자 선택자·한글 채움 문자를 잘못 합치거나 저장값을 바꾸지 않는지")는 근거가 없었다** — 잘못 합쳐지지도, 저장값이 바뀌지도 않는다.
3. **왜 안전한지(구조적 근거)**: 비밀 탐지 정규식(`SECRET_PREFIX`·`AUTH_SCHEME`·`JWT_LIKE`·`KEY_VALUE`·`TOKEN_RUN`)은 전부 **ASCII 영숫자·기호 문자 클래스**(`[A-Za-z0-9\-_+/=]` 등)만 대상으로 한다 — 한글 음절(U+AC00~D7A3)·가나·한자·이체자 선택자(U+E0100 대)·한글 자모/필러(U+1100 대·U+3164)는 애초에 이 문자 클래스 밖이라, 그 사이에 있던 서식·기본 무시 문자를 지워 두 CJK/한글 글자가 "붙어도" ASCII 패턴이 새로 만들어지지 않는다(두 비-ASCII 문자가 인접해 봤자 여전히 비-ASCII). 이 구조적 이유 때문에 "정상적인 한국어·일본어 문장에서 의미 있는 폭-0 문자를 지워도 오탐이 생기지 않는다"는 게 우연이 아니라 설계상 자연스러운 결과다.
4. **최소 길이(REQUIRED·TOO_SHORT) 검증**: 폭-0 문자만으로 채운 이유는 `REQUIRED`(visible=0), "수정"+ZWSP 12개(PRODUCTION)는 `TOO_SHORT`(visible=2) — 둘 다 프로젝트 자체 테스트(`infra/__tests__/task012c.test.ts:347-359`)에서도 확인되고 내 재현에서도 같은 결과.
5. 프로젝트 자체 단위(`infra/__tests__/task012c.test.ts:307-336`)의 12개 케이스(soft hyphen·ZWSP·ZWNJ·ZWJ·BOM·word joiner·CGJ·전각 NFKC 조합)를 격리 미러에서 독립 재실행 — 전부 PASS.

**판정: 채택분 정상 반영 확인, 지시 사항의 우려는 근거 없음(오탐·저장값 훼손 모두 미발생)**.

#### REV-035 Low 1·2 확인

- **Low 1**: `readCredentialFor(ref, target, originEnv, allowedRefs)` 로 시그니처가 바뀌어 `allowedRefs` 가 **필수 인자**가 됐다(`secrets.ts:190`, `!allowedRefs.includes(ref)` 를 REF_NOT_ALLOWED 조건에 추가 — `:195`) — 유일한 호출자 `prepareHomeM4Call` 이 `HOME_M4_ALLOWED_REFS` 를 넘긴다(`homeM4.ts:207`). 이제 이 함수 자체가 descriptor 허용 목록을 강제해, 호출자가 사전 검사를 빠뜨려도 새지 않는다 — 해결 확인.
- **Low 2**: `homeM4.ts:35`·`homeM4.provider.ts:8` 양쪽에 `credentials/policy` 직접 import 이유(순환 회피) 주석 추가 확인 — 해결 확인.

#### 종합 판정

**세 건 모두 채택분이 정확히 반영됐다.** 새로 발견한 잔여 사항은 둘 다 **Low(비차단)**: (a) 자식 env 허용 목록의 프록시 6개 키가 오늘은 무해하지만 미사용 상태로 미리 열려 있음(다음 라운드 정리 또는 userinfo 제거 방어 권고) (b) `/proc` 부재 환경에서 TOCTOU 방어 ③단계가 조용히 생략됨(실배포는 Linux 라 해당 없음, 경고 로그 권고). Critical·High·Medium 신규 0건. **이 재검으로 Codex C2 3건에 대한 재순환은 종결 — REV-035 PASS 판정 유지**, 남은 Low 2건은 QA 진행을 막지 않는 참고 사항으로 인계한다.

**QA 인계 추가(이번 재검)**: ["006/007/008 회화·채팅 실LLM 스모크가 pm2 운영 프로세스에서도 성공하는지(격리 미러 결과와 대조)", "발음 사전·설정 편집 reason 필드에 실제 일본어·한국어 텍스트(변이 선택자·필러 포함) 입력 시 정상 저장·조회되는지 화면/실사용 관점"] · **native_change: false** · **화면 변경 없음**.

### 2026-09-29 13:05 reviewer — REV-036

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 2) — 대상은 "서버 2단계"(설정 편집·버전·Rollback·감사 조회, 2026-09-29 10:10 Developer 기록) 전체: 신규 `src/modules/engine/configuration/{keys,appSettingSchema,validate,diff,shapes,versions,rollback,index}.ts`·`src/modules/admin/configuration/{editor,gate,history,targets}.ts`·`src/modules/speech/tts/configProbe.ts`·`src/app/api/admin/v1/**` 새 라우트 14개(#104~#111·#93·#93a·#93b·#100·#123b·#137)·신규 테스트 2파일, 수정 `engine/{index.ts,connections,fallbackPolicy,functionalTest,registry/types}`·`preferences/index.ts`·`speech/{index.ts,tts/index.ts,tts/synthesize.ts,analysis/policy.ts}`·`infra/{audit.ts,index.ts}`·어댑터 6개(`registry/types.ts` 메타 필드 사용)·`admin/{configuration/effective.ts,index.ts}`·`types/admin.ts`. 1단계(D-C3(a)(b)(c)·CX-1~3·D-C9)는 REV-035·REV-035 Codex C2 재검(11:05)에서 이미 PASS 확정 — 이번 라운드는 재감사하지 않고 2단계 신규·변경분만 본다.

**검증 방법**: 이력서 전체(1~650행) + 코드 전량 Read(위 파일 전부, git diff 포함) + 격리 스크래치 미러(`~/.node-local/thekaiwa-rev036` — 공유 미러 `~/.node-local/thekaiwa` 의 `node_modules` 를 하드링크, NFS `src/`·`prisma/`·`tests/` 를 rsync, Developer·QA 진행 중인 다른 작업과 완전 분리)에서 독립 재실행: `tsc --noEmit` **0 에러**(9초) · `eslint`(변경된 src 파일 52개 전부) **exit 0**(에러·경고 0건) · `node --import tsx --test`(신규 012c 단위 5파일 합산) **59/59 PASS** · 전체 스위트(`find src -name '*.test.ts'`) **820/820 PASS·0 fail**(Developer 주장 "817 pass·3 skip" 과 살짝 다름 — 내 미러가 `android/`·`speech/models` 까지 rsync 해 그 3건도 skip 없이 실행됨, 회귀 아님) · `git diff --stat prisma/schema.prisma` 빈 diff 확인 · `git status`(화면·`menu.ts`·`conversation/`·Python·`ecosystem.config.js`·`.env*`) 전부 무변경 확인 — 네이티브·화면 변경 없음(데모 게이트 재실행 대상 아님).

**① 권한** — `src/app/api/admin/v1/{config/{validate,diff,apply,test,raw/[scope]/[targetId],versions,versions/[id],versions/[id]/rollback},engine-connections/[id](GET·PUT)·[id]/{enabled,credential},fallback-policies/[role](GET·PUT),app-settings/[key](GET·PUT),audit}/route.ts` 14개 전부 `export const <METHOD> = withApi(...)` 의 **첫 문장**이 `const actor = await requireCapability('<정본 capability>')`(직접 Read 로 확인) — 매핑이 정본과 정확히 일치: `config.edit`(validate·diff·apply·raw PUT·app-settings PUT·#93 PUT)·`functional_test.run`(test)·`config.raw.read`(raw GET)·`config.effective.read`(versions GET·versions/[id] GET·engine-connections/[id] GET·fallback-policies/[role] GET·app-settings/[key] GET)·`config.rollback`(rollback)·`engine.connections.manage`(#93a·#100)·`credentials.manage`(#93b)·`audit.read`(#137). **이 매핑이 이력서 문서의 주장으로 끝나지 않고 코드로 강제된다** — `src/modules/admin/__tests__/task012c-edit.test.ts:165` `'012c 라우트 — 처리 함수의 첫 문장이 정본 capability 의 requireCapability'` 가 라우트 소스 파일을 정규식으로 직접 읽어 대조하는 테스트라 향후 라우트 하나라도 첫 줄 가드를 빼먹거나 capability 이름이 바뀌면 빌드가 아니라 이 테스트가 즉시 실패한다(재실행 확인). `requireCapability`(`admin/permissions/guard.ts:70-78`)는 무세션 401 · `console.access` 없음(USER) **404**(`hiddenNotFound`, 존재 비노출) · capability 부족 403 `details.missing` — 그대로. `can()`(`permissions/can.ts`)의 `PRODUCTION_EXTRA` 매핑에 `config.edit`·`engine.connections.manage`·`config.rollback` → `config.apply.production` 이 정확히 걸려 있어 대상 행(`targetEnvironment`)이 PRODUCTION 이면 ADMIN·DEVELOPER 는 자동으로 403(`missing:['config.apply.production']`) — `commitEdit`(`editor.ts:476`)가 `assertCapability(actor, o.capability, { targetEnvironment: t.environment })` 로 **대상 행의 environment**(요청 body 가 아니라)를 넘기는 것도 직접 확인. `credentials.manage`(#93b)는 PRODUCTION_EXTRA 맵에 없지만 role-permission 매트릭스 자체가 SUPER_ADMIN 전용이라 이중 방어가 불필요(과잉 설계 아님).

**② PRODUCTION 게이트(§8-1 전 항목)** — `gate.ts` `productionGate`(대상이 PRODUCTION 일 때만 전체 흐름) 순서를 코드로 추적: `confirm !== "PRODUCTION"` → 403 `PRODUCTION_CONFIRMATION_REQUIRED` → `summaryHash !== d.summaryHash` → 409 `SUMMARY_MISMATCH`(무상태 — `diff.ts:134-143` 가 `scope·targetId·environment·baseVersion·candidateHash·changes[key,storedBefore,storedAfter,blocked]` 를 sha256 해 apply 시점에 **같은 후보로 재계산**해 대조하므로 blue/green 두 프로세스·재기동에도 저장 없이 동작 — 설계 의도대로) → (`d.testRequired`, 즉 바뀐 키 중 `verifiable !== 'NOT_NEEDED'` 가 하나라도 있을 때만) `verifyTestResult` 8갈래(MISSING·NOT_FOUND·NOT_OK·EXPIRED(30분, `TEST_RESULT_TTL_MS`)·OTHER_TARGET(scope·targetId·environment 불일치)·OTHER_CANDIDATE(`candidateHash` 불일치)·KEYS_NOT_TESTED(`needed.every(testedKeys.includes)` — CX-2 그대로: 검증 필요 키 중 하나라도 `testedKeys` 밖이면 거부)·RELATED_NOT_OK(Fallback 새 연결들의 `related` 결과 전부 ok 여야)) 전부 코드에 있고 단위(`task012c-edit.test.ts:72` "testResultId 검증 8갈래")·전체 재실행 PASS 로 확인. `assertCrossEnvironment`(`gate.ts:75-80`)가 "교차 환경 PRODUCTION 쓰기는 바뀐 키 전부 NOT_NEEDED 일 때만" 을 정확히 구현(`d.changes.some(c => c.verifiable !== 'NOT_NEEDED')` → 403 `CROSS_ENVIRONMENT_TEST_UNAVAILABLE`) — 이력서 12:10 D-C14 절 "교차 환경 쓰기 규칙" 과 코드가 일치. `reason` 10~200·비밀 유사 거부는 CX-3 공용 함수(`requireReason`, 1단계에서 이미 감사) 그대로 재사용 — `commitEdit` 이 Validate **이전에** reason 을 검사해(요청 우선순위) 실패를 빨리 돌려주는 순서도 확인.

**③ 트랜잭션(`commitEdit`, `editor.ts:475-616`)** — 순서를 코드로 추적: capability(대상 환경) → `credentials.manage`(#93b) → 교차환경 `environment.policy` → `baseVersion` 파싱 → `reason` 검사 → `validatePatch` → **변경 0 이면 즉시 `{changed:false}` 반환(버전·감사 0, `baseVersion` 대조 이전에 빠져나간다 — 이력서가 명시한 의도된 순서)** → `baseVersion` 재확인(바깥, 커밋 전) → `diffFor`(적용 차단 키 400) → `assertCrossEnvironment` → `productionGate` → `withTransaction` 하나: `lockEditTarget`(raw SQL `SELECT … FOR UPDATE`, Prisma 태그드 템플릿이라 파라미터 바인딩 — SQL 인젝션 경로 없음, `id` 는 사전에 `^[\w.-]{1,120}$` 로도 걸러짐) → **트랜잭션 안에서 `baseVersion`·저장 바이트(`stableStringify`) 를 다시 대조**(바깥 검사와 트랜잭션 커밋 사이의 경합을 이중으로 방어) → 주 연결 끄기 409 `PRIMARY_IN_USE`(트랜잭션 안에서 `enabledPoliciesUsingAsPrimary(tx)` 재확인) → `ensureBaseline`(행이 하나도 없을 때만 v1, `findFirst` 로 존재 여부 판정 — 기준선 중복 불가) → `materialize`(소유 층: `writeConnectionConfig`/`writeFallbackPolicy`/`writeAppSetting`) → `writeVersion`(직전 ACTIVE → `SUPERSEDED`|`ROLLED_BACK`, 새 버전 `ACTIVE`) → `recordAudit`(actor 스냅샷·before/after `values` 는 바뀐 키만 pick) → (미리듣기 문장이면) `textVersion` 파생 버전·감사 한 벌 더 → `P2002` → 409 폴백 → 커밋 뒤 `clearConfigCaches()`. **두 동시 요청 경합**: 같은 대상은 `SELECT … FOR UPDATE` 가 InnoDB 행 잠금으로 직렬화(먼저 들어온 트랜잭션이 커밋할 때까지 두 번째는 대기), `nextNumber()`(`versions.ts:29-32`)의 `aggregate max` 는 그 직렬화 안에서만 호출돼 경합이 없고, `@@unique(environment,scope,targetId,version)` 는 마지막 방어(라이브 스모크 "두 프로세스 동시 2요청 201/409" 로 실측 재확인됨, Developer 기록). `ensureBaseline`+`materialize`+`writeVersion`+`recordAudit`(+파생)이 **한 `withTransaction` 콜백 안**이라 원자성 확인. 감사 1:1은 라이브 스모크("감사 1:1(버전 27 = 감사 27)")로 실측 확인됐고, 코드상으로도 `auditIds` 배열에 baseline·apply·derived 각각 정확히 1개씩 push 되는 경로만 있다.

**④ Rollback 엄격 재검증** — `rollback.ts` `planRestore`: 스냅샷 모양 파싱 실패(`flatFromSnapshot`) → `MALFORMED` · 파싱은 됐지만 지금 스키마 값 규칙(타입·범위·enum·SECRET 평문·ref 허용 목록·URL 호스트 허용 목록) 위반 → `INVALID_ENTRIES` → 호출부(`editor.ts:274-277` `restorePlan`)에서 **쓰기 전에** `422 E_SNAPSHOT_INTEGRITY`(issues 포함) — 코드 경로상 이 검사를 우회하고 물화로 가는 분기가 없다(`restorePlan` → `commitEdit` 한 경로뿐). 스키마에 없는 키는 `droppedKeys`(경고, 손상 아님)로만 분리 — `defKeys` 밖이면서 값이 실제로 다른 키만 추림(`!sameValue`). `absentAsDefault`(같은 스키마 버전 스냅샷에서 빠진 키만 기본값으로 채움, 다른 버전이면 지금 값 유지)도 코드·단위(`task012c-edit.test.ts:329`) 일치. Rollback 은 `history.ts` `rollbackConfigVersion` → `commitEdit(..., {capability:'config.rollback', origin:'ROLLBACK', restore:{version:v, droppedKeys}})` 이라 **PRODUCTION 이면 §8-1 흐름을 그대로 다시 탄다**(Rollback 도 기능 테스트 필요 — 이력서 D-C6 6번 항목과 일치). `v.status === 'ACTIVE'` → 409 `ALREADY_ACTIVE`, `patch` 가 비고 `existsChange` 도 아니면 409 `NO_CHANGE` — commitEdit 진입 전에 걸러짐. 되돌린 뒤 밀려나는 직전 ACTIVE 는 `writeVersion` 의 `replacedStatus`(`origin === 'ROLLBACK' ? 'ROLLED_BACK' : 'SUPERSEDED'`)로 정확히 `ROLLED_BACK`, 복원 대상(v) 자체의 상태는 코드 어디에서도 갱신하지 않아 **불변** 확인.

**⑤ 편집 키 정책 vs Leader 결정 일치** — 어댑터 6개(`claudeCli.provider.ts`·`homeM4.provider.ts`·`fasterWhisper.provider.ts`·`sherpaReazon.provider.ts`·`styleBertVits2.provider.ts`·`styleBertHttp.ts`) diff 전량 + `appSettingSchema.ts`+`keys.ts`(`FALLBACK_KEY_DEFS`)를 Developer 기록 "최종 편집 가능 키" 표와 한 줄씩 대조 — 전부 일치: `runtime.maxChars`(`consoleEdit:false`, DEFERRED, 이유 "100자 미만이면 긴 문장 실패를 못 잡음" 그대로 주석에 있음)·`sdpRatio`/`noise`/`noiseW`(DEFERRED, "TTS 캐시 키에 없음")·home-m4 `allowedTasks`(DEFERRED)·`connection.baseUrl`(home-m4·TTS 둘 다 `envPinned:true` → `ENV_PINNED` 잠금)·Fallback `retryOnce`(consumer `NONE` → `NOT_CONSUMED`)·`speech.review.threshold`(lock 은 `null` 이지만 `verify:'NONE'` → `verifiabilityOf` 가 `'NO'` 반환 → `diff.ts:165` `testRequired = production && changes.some(verifiable !== 'NOT_NEEDED')` 에 걸려 PRODUCTION 적용 시 `testResultId` 를 **영구히 발급받을 수 없다**(`testConfig` 가 이 키 하나만 바뀌면 `yes` 배열이 비어 조기 반환 `testResultId:null`) — R3 ①의 "운영 잠금" 을 명시적 lock 없이 **검증 불가 메커니즘으로 달성**한 설계이고, 직접 추적해 의도대로 작동함을 확인(문서상 주장과 코드가 정확히 부합, 우회 경로 없음). `VOICE_PROFILE` → `parseScope` 가 `400 SCOPE_DEFERRED` 로 즉시 거부(D-C14). `keys.ts` 의 잠금 우선순위(READ_ONLY→RESTART_REQUIRED→CREDENTIAL_ONLY→DEFERRED→SERVICE_MANAGED→NOT_CONSUMED→ENV_PINNED→편집가능)도 주석·코드 일치, 엔진명은 `engine/adapters/**` 안에만(`grep -rniE "reazon|whisper|style-bert|claude" src/modules/engine/configuration src/modules/admin/configuration` 0건, `targetPolicy.ts` 의 `WHISPER_SERVICE_URL` 상수만 예외 — 체크리스트가 명시적으로 허용). **"런타임 실사용값 == Effective" 테스트**(`task012c-edit.test.ts:463`)는 `assert.deepEqual(editable.map(key).sort(), Object.keys(readers).sort())` 로 **편집 가능 키 하나라도 대조표가 빠지면 테스트 자체가 실패**하게 짜여 있어(구조적 강제, 문서 주장이 아님) 완료 기준 7이 실제로 지켜짐을 확인 — 직접 재실행 PASS.

**⑥ 비밀·reason 노출** — `connectionSnapshot`/스냅샷 저장 값의 `credentialRef` 는 **참조 이름 문자열**(`env:NAME`|`file:name`)만 들어간다 — 평문은 쓰기 시점에 `checkSecretRefValue`/`checkCredentialRef` 가 막아(1단계 REV-035 확인 경로 재사용) 애초에 DB·스냅샷·감사에 도달할 수 없다(코드 경로상 우회 없음, credentialRef 값 검증을 생략하고 물화로 가는 분기 없음). `registry/types.ts` 의 `HealthDetail.config`(`ConfigTestMark` — `testedKeys` 등 키 이름만, 비밀 아님)도 `admin/present.ts` `healthDetail()` 화이트리스트(`DETAIL_STR`/`DETAIL_NUM`/`DETAIL_BOOL`)에 없어 화면 DTO 에 안 실림(직접 대조 확인 — 주석의 주장과 일치). `reason` 검사는 1단계 CX-3 함수 재사용이라 이번 라운드 신규 코드는 아니지만 `commitEdit`·`rollbackConfigVersion`·`setConnectionCredential`·`updateFallbackPolicy`·`putAppSetting` 전 경로가 같은 `requireReason` 을 거치는지 grep 으로 재확인(전부 `commitEdit` 한 곳을 거치므로 자동 적용) — 우회 경로 없음.

**⑦ 6층 경계** — `engine/configuration/index.ts`·`engine/index.ts` 공개면에 `preferences`·`speech`·`conversation` import 0(직접 확인). `admin/configuration/targets.ts` 가 `preferences`(AppSetting)·`speech`(`loadTtsVoice`)를 import 하는 것은 **admin(L0, 조합 층)의 정상 권한**이고, `engine` 은 `preferences`·`speech` 를 모른다는 주석·실제 import 문 둘 다 확인 — module-dependency 규칙 6(두 층에 걸친 원자적 쓰기는 admin 이 `infra.withTransaction` 으로 연다) 그대로.

**⑧ 캐시 무효화** — `clearConfigCaches()`(`engine/index.ts` 신규)가 `clearRouterCache`+`clearTtsTargets`(`speech/tts`)+`clearSttTargetCache`(`engine/stt`) 3개를 부르고 `commitEdit` 커밋 직후 1회 호출(코드 위치 확인) — 다른 프로세스는 기존 TTL(Router 30초·TTS/STT 자체 주기)로 수렴, 라이브 스모크에서 "적용 프로세스 즉시, 다른 프로세스 4.7초 뒤 #19 설정에 반영" 으로 실측(Developer 기록, 이번 REV 에서 재실행하지 않았으나 회귀 코드 경로 없음).

**⑨ 정본과 다른 점** — Developer 기록의 10개 항목(#102 edit.keys 추가·#105/#106 versionId 입력·NO_CHANGE 400·credentialRef 잠금 해제 조건·행 없는 AppSetting 기준선·Raw JSON 키 삭제 400·rule 16종·정책 키 읽기전용·교차환경 test 항상 403·Fallback 후보 순차 테스트)를 각각 코드로 대조 — 전부 03:50·12:10 Leader 결정과 일치하거나(①②③⑥⑦⑧⑨⑩) 보안·정합성을 강화하는 쪽(④ NO_CHANGE·⑤ credentialRef 잠금 강화)이라 채택. 기존 발견 항목(맥스chars 보류·되돌리기 결측키 기본값·빈문자열 오탐 수정·credentialRef 되돌리기 403)도 코드에 반영 확인.

**Low 1(신규)** — `history.ts` `getConfigVersion`(`config.effective.read`, ADMIN 이상 접근 가능)이 `config.raw.read`(DEVELOPER 이상) 보유자에게 버전 **스냅샷 원문**(`full ? displayAny(v.snapshot) : {}`)을 보여주는데, 같은 파일의 `getRawConfig`(현재 저장값 원문)는 PRODUCTION 대상일 때 `recordAudit({action:'config.raw.read', ...})` 를 남기는 반면(`editor.ts:715-717`) `getConfigVersion` 은 PRODUCTION 버전 이력의 원문을 보여줘도 감사를 남기지 않는다 — 두 "민감 원문 조회" 경로의 감사 커버리지가 비대칭이다. 스냅샷에는 평문 비밀이 없어(credentialRef 는 참조 이름뿐, ⑥에서 확인) 유출 위험은 낮지만, PRODUCTION 이력 전체를 원문으로 열람하는 새 경로이니 일관성 차원에서 다음 라운드에 `getRawConfig` 와 같은 감사를 붙이는 것을 권고(차단 아님).

**Low 2(신규)** — 연결 끄기의 409 `PRIMARY_IN_USE` 판정이 두 번(Validate `dependencyHook`, 트랜잭션 밖·`prisma` 직접 조회 / `commitEdit` 트랜잭션 안, `tx` 로 재확인)인데, 트랜잭션 안 재확인(`enabledPoliciesUsingAsPrimary(locked.environment, locked.targetId, tx)`)이 `EngineFallbackPolicy` 행을 잠그지 않고 읽는다 — 연결 A 를 끄는 트랜잭션이 이 조회를 마친 직후, 별도 트랜잭션이 "정책 P 의 `primaryConnectionId` 를 A 로, `enabled:true` 로" 커밋하면(둘 다 정상적인 개별 편집) 두 커밋이 모두 성공해 "켜진 정책의 주 연결이 꺼져 있다"는 상태가 짧게 생길 수 있다(Router 는 꺼진 연결을 후보에서 빼므로 기능 장애는 아니고, 다음 관리자 조회 때 드러나는 데이터 정합성 엣지 케이스). 발생 조건이 좁고(두 서로 다른 대상에 대한 동시 편집) 보안 문제가 아니므로 차단 아님 — 다음 설계에서 `EngineFallbackPolicy` 조회도 같은 트랜잭션에서 `FOR UPDATE` 하거나 애플리케이션 수준 정합성 검사(주기적 진단)로 보완 권고.

**요약**: Critical 0 · High 0 · Medium 0 · Low 2(둘 다 차단 아님, 다음 라운드 권고). 서버 2단계 구현이 §8-1 PRODUCTION 게이트 전 항목·트랜잭션 원자성·Rollback 엄격 재검증·편집 키 정책(D-C4·R3·D-C14)·6층 경계·캐시 무효화를 설계·Leader 결정과 정확히 일치시켰고, 독립 재실행(tsc 0·eslint 0·단위 820/820)이 Developer 주장을 뒷받침한다. "런타임 실사용값 == Effective" 테스트와 "라우트 capability 문자열 대조" 테스트가 둘 다 **코드 구조로 회귀를 강제**하는 설계라 향후 변경에도 이 라운드의 보장이 쉽게 깨지지 않는다.

**QA 인계 — high_risk_areas**: ["PRODUCTION 게이트 8갈래(testResultId 재사용·만료·다른 대상/후보·부분검증) 실사용 시나리오", "동시 2요청 baseVersion 충돌·두 프로세스 슬롯 경합(라이브 실측)", "Rollback 스냅샷 손상·스키마 버전 다른 되돌리기(422 vs droppedKeys 구분)", "credentialRef 연결(#93b) 실제 값 있는 ref 로 성공 경로(1단계 이후 라이브 미확인, Developer 남은 위험 ③)", "Fallback 편집 시 주 연결 끄기 순서·PRIMARY_IN_USE 화면 안내", "AppSetting speech.review.threshold PRODUCTION 편집이 항상 막히는지(운영 잠금 실사용 확인)"] · **native_change: false** · **화면 변경 없음 — 데모 게이트 재검토 불필요**.

### 2026-09-29 13:50 reviewer — Codex C2 판정(012c 서버 2단계)

대상: 코디네이터가 직접 전달한 서버 2단계 Codex C2(2026-09-29 13:30, adversarial·security) 지적 2건(이력서 "최종 요약" 절 701~708행에 이미 원본 기록됨) — REV-036 이 PASS 로 넘긴 서버 2단계 diff 안의 코드다. 코드 재추적 + 관련 함수(라우터·마스킹) 직접 확인으로 판정했다. 코드 수정·라이브 없음.

#### 지적 ①(`history.ts:71`·`audit.ts:43` reason 마스킹 회피) — **채택(Medium 유지)**

**코드로 재확인**: `infra/audit.ts:26-27` `json(v)` 는 `before`/`after` 를 저장 전 `maskSensitive(v)` 로 반드시 거치지만(`json` 함수 자체가 그렇게 구현돼 있어 호출자가 빠뜨릴 수 없다), 바로 다음 줄 `reason: entry.reason ? entry.reason.slice(0, 500) : null`(`:43`, Codex 지적 그대로)은 길이만 자르고 **마스킹을 전혀 거치지 않는다** — `recordAudit` 이 이 파일 docblock 이 스스로 밝히는 "AuditLog 기록의 유일한 진입점" 인데도 그렇다. `engine/configuration/versions.ts` `writeVersion`(`:67` 부근, `ConfigurationVersion.reason: input.reason.slice(0, 500)`) 도 동일하게 마스킹 없이 저장한다. 조회 쪽(`history.ts` `itemDto:72` `reason: v.reason`·`auditDto:215` `reason: a.reason`)도 `displayAny`(마스킹 없는 표시 변환)만 거치고 `maskString` 을 타지 않는다 — Codex 지적이 코드와 정확히 일치.

**CX-3 재검토로 위험 범위 재확인**: `recordAudit` 를 실제로 호출하는 곳은 코드 전체에서 3곳뿐(`grep`으로 확인) — `admin/engines/index.ts:142`(`secrets.read_ref`, `reason` 필드 자체가 없음·숫자 요약만) · `admin/configuration/editor.ts`(전부 `commitEdit` → `requireReason` 을 미리 거침) · `admin/speech/lexicon.ts:260`(`readWriteMeta` → `checkReason` 을 미리 거침, 003g 5경로 전부 확인). 즉 **현재·향후 코드에서 `reason` 에 사용자 텍스트가 실제로 실리는 경로는 CX-3(비밀 유사 거부, "쓰기 시점 차단")가 이미 앞단에서 막는다** — 오늘 시점에 저장돼 있는 `reason` 값 중 CX-3 가 정의한 패턴(접두사·Bearer·JWT·key=value·고엔트로피)에 해당하는 것은 이론상 없어야 한다.

**그럼에도 채택하는 이유(Codex 의견에 동의, 다운그레이드하지 않음)**: (a) `maskSensitive`/`maskString`(`infra/mask.ts`)은 CX-3 의 `isSecretLikeText` 와 **완전히 별개로 구현된 탐지기**다(정규식 목록이 다르다 — `maskString` 은 `sk-`/`pk-`/`ghp_`/`xox?-`/Bearer/JWT/32자+ hex/32자+ base64(대소문자+숫자 혼합)/URL 안 자격증명·토큰 쿼리를 잡고, `isSecretLikeText`(`infra/reason.ts`)는 다른 접두 집합·키=값 패턴·24자+ 고엔트로피를 잡는다 — 겹치지만 동일하지 않다). 이 저장소의 기존 관례는 "관리자가 입력한 자유 텍스트가 응답·AuditLog 에 나갈 수 있는 모든 자리에 `maskSensitive` 를 건다"(before/after·Trace·console 응답 전부)인데, `reason` 만 이 관례 밖에 있다 — CX-3 는 "쓰기 거부"이지 "표시 마스킹"이 아니라서 **두 방어가 서로 대체재가 아니라 상호 보완**이며, before/after 가 이미 그 이중 방어를 받는 것과 형평이 맞지 않는다. (b) 두 탐지기가 분리돼 있으면 한쪽만 개정되고 다른 쪽이 뒤처지는 드리프트 위험이 상존한다(예: 앞으로 `maskString` 에 새 시크릿 패턴이 추가돼도 `reason` 경로는 여전히 구멍). (c) 수정 비용이 매우 낮다 — 스키마 변경 없이 `recordAudit`(`audit.ts:43`)·`writeVersion`(`versions.ts`, `ConfigurationVersion.reason` 저장 지점) **두 곳에서 저장 직전 `maskString(reason)`** 을 적용하면(`audit.ts` 는 이미 `maskSensitive` 를 import 하고 있어 `maskString` 추가 import 만 필요) **현재·향후 모든 호출자에 자동 적용**되고, 조회부(`itemDto`/`auditDto`)를 개별로 고칠 필요도 없어진다(쓰기 시점에 이미 안전한 값만 저장). 정상적인 사유 문구(짧은 한국어/일본어 문장)는 `looksSecret()` 패턴(접두사·JWT·32자+ hex/base64 등)에 해당하지 않아 그대로 통과한다 — 통상 사용에 영향 없음.

**최소 수정 방향**: `infra/audit.ts` `import { maskSensitive } from './mask'` → `import { maskSensitive, maskString } from './mask'`, `recordAudit` 의 `reason: entry.reason ? entry.reason.slice(0, 500) : null` 을 `reason: entry.reason ? maskString(entry.reason.slice(0, 500)) : null` 로. `engine/configuration/versions.ts` `writeVersion` 의 `reason: input.reason.slice(0, 500)` 도 동일하게 `maskString` 적용(같은 `infra` re-export 경로로 import). 회귀 테스트: 정상 사유 원문 불변(한국어·일본어·짧은 문장) + `sk-`/JWT/32자 hex 류를 reason 에 넣었을 때(만약 CX-3 를 어떻게든 통과했다면의 방어선 시나리오로) 저장·조회 값이 `***` 인지 단위로 확인.

#### 지적 ②(`editor.ts:512`(현재 파일 `:517`)·`targets.ts:233`(현재 `:246`) 연결↔Fallback 교차 행 경합) — **채택(근거는 동의, 심각도는 Low 로 판단 — REV-036 L2 와 동일 지점)**

**Codex 지적과 내 REV-036 L2 는 같은 코드 지점을 가리킨다** — 연결 끄기(`editor.ts` `commitEdit`)가 `EngineConnection` 행만 `FOR UPDATE` 하고 `EngineFallbackPolicy` 조회(`enabledPoliciesUsingAsPrimary(tx)`)는 잠그지 않으며, 반대로 Fallback 정책 편집(`targets.ts` `lockFallbackPolicyForUpdate`)은 `EngineFallbackPolicy` 행만 잠그고 참조하는 `EngineConnection` 의 `enabled` 상태는 Validate 시점(`dependencyHook`, 트랜잭션 밖 `prisma` 직접 읽기)에만 확인하고 커밋 시점엔 재검증하지 않는다 — 두 트랜잭션이 서로 다른 행을 잠가 상대의 최신 상태를 못 보는 전형적 교차 잠금 경합, 오탐 아님.

**"라우팅 중단"(Codex 표현) 주장은 코드로 반증된다 — 심각도를 Low 로 유지하는 근거**: 실제 요청 라우팅을 담당하는 `engine/router/index.ts` `loadChain`(`:41-70`)은 `EngineFallbackPolicy.primaryConnectionId` 를 무조건 신뢰하지 않는다 — `rows = prisma.engineConnection.findMany({ where: { environment, role, **enabled: true** } })` 로 **켜진 연결만** 먼저 걷어낸 뒤(`:54`), `policy` 의 id 목록을 이 `byId` 맵에서 찾아(`:57-58`) 없으면(즉 꺼져 있으면) 그냥 빠진다(`.filter(Boolean)`). `status` 도 `SKIP_STATUS`(UNAVAILABLE·DISABLED·MISCONFIGURED)로 이중 제외(`:61`). 즉 **경합으로 "켜진 정책이 꺼진 연결을 가리키는" 저장 상태가 잠깐 생기더라도, 실제 호출은 그 연결을 후보에서 자동으로 제외하고 다음 예비로 넘어간다** — 이건 새 방어가 아니라 이미 존재하는, 경합과 무관한 정상 동작(관리자가 정책을 안 고치고 연결만 끄는 흔한 케이스도 똑같이 이 필터로 처리된다). 따라서 실제 결과는 "라우팅 중단(장애)"이 아니라 최악의 경우 그 역할의 예비 후보가 의도보다 하나 적은 상태로 남는 것뿐이고, 이는 정책을 고치기 전까지의 **기존에도 있던 정상 열화 경로**(`NoEngineAvailableError` 로 귀결되는 기존 처리)와 같다. 경합이 발생하려면 서로 다른 두 대상(연결 A 끄기, 정책 P 에 A 를 새 primary 로 지정)에 대한 두 관리자 편집이 짧은 창 안에 동시에 커밋돼야 해 발생 조건도 좁다.

**그래도 채택하는 이유**: 저장된 설정 상태 자체의 논리적 불변식("켜진 정책의 primary 는 켜진 연결")이 깨질 수 있다는 지적 자체는 정확하고, 화면(이력·연결 상세)에 일시적으로 모순된 정보가 노출될 수 있으며, Router 의 방어가 "우연히 안전망 역할을 하는 별개 로직"이지 이 트랜잭션 쌍이 설계상 의도한 방어는 아니라 향후 Router 로직이 바뀌면(예: 캐시 정책 변경, `allowedTasks` 로직 확장) 이 안전망도 같이 바뀔 수 있다 — 지금 안전하다고 앞으로도 안전하다고 보장할 수는 없다. Codex 의 "같은 순서로 두 행을 `FOR UPDATE`" 권고는 합리적인 최소 수정이다.

**최소 수정 방향**: 전역 잠금 순서 고정(예: `id` 문자열 오름차순으로 `EngineConnection`→`EngineFallbackPolicy` 또는 그 반대 — 항상 같은 순서, 교착 방지) + 커밋 직전 재검증 두 방향 모두: (a) 연결 끄기 트랜잭션이 지금처럼 정책을 조회할 때 **관련 `EngineFallbackPolicy` 행도 함께 `FOR UPDATE`**(다중 행이면 정렬된 순서로) (b) Fallback 정책 물화 트랜잭션도 `lockFallbackPolicyForUpdate` 뒤에 **`primaryConnectionId`·`fallbackConnectionIds` 가 가리키는 `EngineConnection` 행들을 잠금 순서에 맞춰 재조회해 `enabled` 를 다시 확인**(Validate 시점 결과를 트랜잭션 안에서 재신뢰하지 않음). 두 트랜잭션이 항상 "연결 id 오름차순 먼저, 그다음 정책 행" 같은 고정 순서를 지키면 교착 없이 직렬화된다.

#### 판정 요약

두 건 **모두 채택**(오탐 0·범위 밖 0). ①(reason 마스킹)은 Codex 의 Medium 평가에 동의 — 이 저장소 자체의 기존 방어 관례(`maskSensitive`)에서 `reason` 만 빠져 있는 일관성 결함이라 근거가 분명하고 수정 비용이 매우 낮다. ②(교차 행 경합)는 지적 자체(불변식이 깨질 수 있음)는 동의하지만, 실제 요청 라우팅은 Router 가 독립적으로 `enabled:true`+상태를 매 호출 재조회해 걸러내는 것을 코드로 확인했으므로 "라우팅 중단" 은 과장이고 **심각도는 Low** 로 판단한다(REV-036 L2 와 동일 결론 유지, Codex 의 Medium 은 채택하지 않는다 — 지적의 존재는 채택하되 등급은 독립 판단).

**REV-036 L1·L2 를 이번 수정 라운드에 포함할지 권고**: **포함 권고**. L1(`getConfigVersion` PRODUCTION 원문 조회 감사 누락)은 Codex ①과 같은 `history.ts` 파일·같은 "민감 조회 경로" 성격이라 한 커밋에 자연스럽게 묶인다(`getRawConfig` 패턴 그대로 `recordAudit` 한 줄 추가, 스키마·계약 변경 없음). L2 는 Codex ②와 **동일 코드 지점을 가리키는 같은 이슈**이므로 별도 항목이 아니라 하나의 수정으로 합쳐진다. 셋 다 스키마 변경·화면 변경·계약(DTO) 변경이 없어 위험이 낮고, `editor.ts`·`history.ts`·`versions.ts`·`audit.ts` 라는 겹치는 파일을 다음 Developer 라운드에서 한 번에 고치는 편이 별도 라운드로 미루는 것보다 총비용이 낮다 — QA 전에 한 번 더(가벼운) reviewer 재순환을 거치는 것을 권장한다.

**다음**: Developer 가 4건(Codex ①·②, REV-036 L1·L2)을 한 라운드로 수정 → reviewer 재검(코드 대조 + 격리 미러 재실행, 범위가 좁아 전체 재감사 불필요) → QA. 기존 서버 2단계 PASS 판정(REV-036)은 이 4건 모두 비차단(Low/Medium, Critical·High 아님)이었으므로 유지되며, 이번 수정은 QA 이전 개선으로 처리한다.

### 2026-09-29 14:30 reviewer — 서버 2단계 수정 재검

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 0 신규) — Developer "서버 2단계 수정 라운드"(10:50) 4건(Codex C2 ①·②, REV-036 L1·L2)이 지시대로 정확히 반영됐음을 코드 추적 + 격리 미러 독립 재실행으로 확인. 코드 수정·라이브 없음(`tests/live/task012c-race.ts` 는 Read 로 설계만 확인, 실행하지 않음).

**검증 방법**: 이전 라운드에 쓴 격리 스크래치 미러(`~/.node-local/thekaiwa-rev036`, Developer·QA 작업과 분리)를 현재 코드로 재동기화(rsync)해 재사용 — `tsc --noEmit` **0 에러**(9초) · `eslint`(변경 src 파일 57개) **exit 0** · 전체 단위 스위트(`find src -name '*.test.ts'`) **827/827 PASS·0 fail**(Developer 주장 "824 pass·3 skip" 과 동일하게 android/speech-models 포함 차이만, 회귀 아님) · 신규 `infra/__tests__/task012c-reason-mask.test.ts` + 관련 파일 단독 재실행 **36/36 PASS**.

#### ① `infra/mask.ts` `maskText`(문장 조각 마스킹) — 지시 사항 확인 결과

**CX-3(`isSecretLikeText`, 쓰기 거부)와의 실제 관계를 코드로 재확인**: `infra/reason.ts` 의 탐지 정규식(`SECRET_PREFIX`·`AUTH_SCHEME`·`JWT_LIKE`·`KEY_VALUE`)은 전부 `(?:^|[^A-Za-z0-9])` 류로 문자열 **어디서든** 스캔하고(앵커 없음), `TOKEN_RUN` 은 `matchAll` 로 전체를 훑어 **문자 종류 3가지 이상**인 24자+ 런만 잡는다 — 즉 CX-3 는 이미 "문장 속 조각"을 상당 부분 잡는 설계라 `maskText` 가 이를 대체하는 게 아니다. 실제 잔여 공백은 **문자 종류가 2가지뿐인 32자+ 순수 hex/영숫자 런**(예: 소문자 hex 32자 — 소문자+숫자 2종류라 CX-3 의 "3종류 이상" 기준 미달) 과 `maskString` 에는 있지만 CX-3 목록엔 없는 접두(`pk-`)·URL 자격증명/토큰 쿼리다 — 신규 테스트(`task012c-reason-mask.test.ts:14-21` `MASKED` 6건)가 정확히 이 조합만 골라 **각 건마다 먼저 `checkReason(...).ok===true`(CX-3 통과 확인) 를 전제로 검증**하고 있어, "CX-3 가 이미 막는데 중복 방어를 만든 게 아니라 CX-3 의 char-kind 기준을 피해 가는 실제 잔여 구멍을 닫는다"는 Developer 주장이 테스트로도 실증됨을 확인했다(직접 재실행 PASS).

**복원 가능성(원문이 남는지)**: `maskText` → `looksSecret(core)` 참일 때 고정 상수 `MASK`(`'***'`, `core.length` 와 무관)로 치환 — 길이 기반 부분 복원조차 안 된다(`mask.ts` 기존 `maskString` 과 동일 원칙 재사용, 새 취약점 아님). URL 은 `maskUrl` 로 **자격증명·토큰 쿼리만** 지우고 host·path 는 남긴다 — 이는 `before`/`after` 마스킹에 이미 있던 기존 정책 그대로(운영 추적을 위해 의도적으로 남기는 비민감 정보), 새 노출이 아니다. 이미 가려진 `***` 마커를 재처리할 때 `core === MASK` 로 조기 반환해(`mask.ts:56`) 이중 가림이 마커를 훼손하거나 원본 정보를 더 흘리지 않는 것도 코드로 확인.

**오탐이 감사 추적성을 해치는지**: `HEX_LONG`(순수 hex 32자+)·`B64_LONG`(대소문자+숫자 혼합) 은 `maskString`/`looksSecret` 에 원래 있던 기존 패턴을 `maskText` 가 문장 단위로 재사용한 것뿐이라(새 정규식 추가 아님) 오탐 범위 자체는 커지지 않았다 — 다만 **자유 텍스트인 `reason`은 구조화 필드(before/after)보다 hex 값(커밋 SHA·해시 등)을 실수로 언급할 확률이 높아 실제 오탐 빈도는 증가할 수 있다.** 그러나 (a) Developer 가 "남은 점 ①"에 이 트레이드오프를 이미 명시적으로 인지·기록했고 (b) 마스킹이 영향을 주는 것은 **설명 문장**뿐이고 버전·감사의 구조화 데이터(`before`/`after`·`traceId`·`versionId`·변경 키 목록)는 전혀 손대지 않아 실제 조사에 필요한 "무엇이 언제 어떻게 바뀌었는가"는 그대로 보존된다 — reason 안의 hex 언급이 가려져도 `traceId` 로 로그를 따라가는 경로는 막히지 않는다. 차단 사유 아님(Low 로도 신규 기록하지 않음 — 기존 `looksSecret` 설계의 알려진 트레이드오프 재사용일 뿐 이번 라운드가 새로 만든 리스크가 아니다).

**적용 범위**: `recordAudit`(`audit.ts:43`, 저장 직전, 모든 현재·향후 호출자 자동 적용 확인) · `writeVersion`(`versions.ts:68`, `ConfigurationVersion.reason`) · `history.ts` `itemDto`/`auditDto`(`shownReason`, 옛 행을 위한 2차 방어) · `lexicon.ts`(`versionDtos`, `reason`·`changeSummary` 둘 다) · `lexiconStore.ts`(`writeLexicon` 의 ROLLBACK `changeSummary` — Leader 지시 범위 밖이었지만 같은 위험이라 넓힌 것, 타당한 판단) 전부 실제로 `maskText`/`shownReason` 을 거치는지 import·호출 지점을 grep 으로 대조 확인. CX-3(`requireReason`/`checkReason`) 호출 순서는 무변경(먼저 돈다) — `commitEdit`(`editor.ts:486`)·`lexicon.ts` `readWriteMeta` 모두 `maskText` 호출부보다 앞선 줄에 위치.

**판정: 채택분 정상 반영, 신규 Low 없음.**

#### ② 잠금 순서 통일(연결→정책) + 커밋 직전 재검증 — 지시 사항 확인 결과

**전역 순서가 실제로 통일돼 있는지(코드 추적)**: `commitEdit`(`editor.ts:515-532`) 트랜잭션 콜백 하나만 확인하면 된다 — 이 함수가 `applyConfig`(#107)·`updateConnectionForm`(#93)·`setConnectionEnabled`(#93a)·`setConnectionCredential`(#93b)·`updateFallbackPolicy`(#100)·`putAppSetting`(#123b)·`rollbackConfigVersion`(#109) **전부의 유일한 물화 지점**이라는 것을 `grep -n "commitEdit(" src/modules/admin/configuration/{editor,history}.ts` 로 재확인했다(7개 호출부 전부 이 한 함수를 거침, 개별 라우트가 잠금 로직을 따로 구현하지 않음). 따라서 순서 로직은 **한 곳에서만 맞으면 전부에 적용된다**(경로별 중복 구현이 아니라 구조적으로 보장) — Codex 가 실측한 "정책 먼저 → 연결" 교착은 옛 코드(REV-036 검토 시점, 정책 편집이 참조 연결을 나중에 FK 로만 확인)에서 난 것이고, 새 코드는 FALLBACK_POLICY 스코프면 트랜잭션 진입 즉시(`:518`) `lockConnectionsForUpdate(tx, fallbackReferencedIds(candidate))`(id 오름차순) 로 참조 연결부터 잠근 **뒤에** 자기 정책 행을 잠근다(`:519` `lockEditTarget`) — Rollback 도 `candidateOf(t, patch)` 로 만든 같은 `candidate` 를 쓰므로 **되돌리기 후보의 참조 연결**을 잠그며 동일 경로를 탄다(별도 분기 없음, `rollbackConfigVersion` → `commitEdit` 한 곳). 반대 방향(연결 끄기)은 `:519` 에서 자기 연결을 먼저 잠근 뒤, `enabled→false` 로 바뀔 때만(`:523`) `lockFallbackPoliciesForUpdate`(id 오름차순, `:524`) 로 정책을 나중에 잠근다. 두 경로 모두 "연결(들) 먼저, 정책 나중"을 어기는 코드 경로가 없음을 전수 확인(다른 스코프 — APP_SETTING·credential-only 변경은 애초에 정책을 잠그지 않아 순서 문제 자체가 없음).

**커밋 직전 재검증**: 연결 끄기는 `:525` `enabledPoliciesUsingAsPrimary(locked.environment, locked.targetId, **tx**)` — 정책을 이미 잠근 **뒤** 같은 tx 로 다시 읽어 409 `PRIMARY_IN_USE` 판정(Validate 시점의 트랜잭션 밖 읽기를 신뢰하지 않음). 정책 편집은 `:530` `fallbackDependencyIssues(locked, candidate, tx)` — 연결을 이미 잠근 **뒤** 같은 tx 로 다시 읽어(`targets.ts:244` `connectionsByIds(..., tx)`, 새 잠금 요청이 아니라 이미 보유한 잠금의 평범한 읽기) 환경·역할·`enabled` 를 재확인, 위반은 400 DEPENDENCY(쓰기 0) — Validate 뒤 끼어든 연결 끄기를 여기서 잡는다는 주석·동작이 코드와 일치.

**Developer 실측 결과(라이브, Read 로만 확인 — 재실행하지 않음)**: `tests/live/task012c-race.ts`(202줄) 를 읽어 D1·D2·R1·R2·R3 시나리오 설계가 위 코드 경로와 정확히 대응함을 확인 — 특히 R2 는 "후보 id 순서가 잠금 순서와 반대"(A·B 후보 순서 vs id 오름차순)인 케이스까지 커버해 정렬 로직이 후보 나열 순서에 의존하지 않는지도 검증한다. 코드 경로가 설계와 일치하므로 Developer 의 보고 수치(6/6·`Innodb_deadlocks` 13→13·타임아웃 0)를 신뢰할 근거가 있다고 판단(라이브 재실행은 지시 범위 밖이라 하지 않음).

**판정: 채택분 정상 반영, 신규 Low 없음.**

#### ③ `infra/tx.ts` 재시도 조건 확장(P2010/1213 추가, 1205 제외) — 앱 전체 영향 확인 결과

**코드로 확인**: `isRetryableTxError`(`tx.ts:23-26`) 가 `err.code === 'P2034'` 이거나 `err.code === 'P2010' && String(err.meta?.code ?? '') === '1213'` 일 때만 true — `String(...)` 변환이라 `meta.code` 가 문자열이든 숫자든 잡고, `'1205'`(잠금 대기 초과)·`P2002`(유니크 위반)·그 밖 raw 오류는 명시적으로 false(신규 단위 `task012c-reason-mask.test.ts:58-65` 6가지 케이스로 직접 확인, 재실행 PASS).

**`withTransaction` 콜백의 비멱등 부수효과 전수 조사(지시받은 grep)**: `grep -rn "withTransaction(" src/modules src/app`(테스트 제외) 로 나온 **30여 개 호출부 전부**를 확인 — 위험 키워드(`fetch(`·`spawn(`·`exec(`·`axios`·`http.request`·`sendMail`)는 **어디에도 없다**(0건). `jobs.*` 호출은 있지만, `tx` 를 받는 함수(`createJob`·`findActiveJob`·`isCurrentJob`·`markJobStage`·`completeJob`·`failJob(...,tx)`)는 `infra/jobs.ts` 코드를 직접 읽어 **전부 `tx.aiJob.*` Prisma 호출뿐**(외부 호출·잡 디스패치 없음)임을 확인. 실제 비동기 실행을 시작하는 `jobs.runJobInBackground(id, fn)`(잡을 실제로 돌리는 함수)는 **`withTransaction` 콜백 밖**에서만 호출된다 — 대표 사례로 `conversation/review/index.ts` 를 줄 단위로 추적: `claimReview()`(`:70-105`, 잡 생성만 하는 트랜잭션) 가 **반환된 뒤** `reviewChat()`(`:181-199`) 이 `jobs.runJobInBackground(claim.jobId, ...)` 를 부르고(`:196`), LLM 호출(`llm.completeJson`, `:122`)은 그 사이 트랜잭션 밖에서 실행되며, 결과 저장은 **별도의 두 번째** `withTransaction`(`:129-167`, 순수 Prisma 쓰기만)이 담당한다 — "claim tx(순수 DB) → 트랜잭션 밖 외부 호출 → save tx(순수 DB) → 트랜잭션 밖 백그라운드 디스패치" 패턴. `learning/lessons/generate.ts`·`learning/evaluation/{grade,generate}.ts` 의 `jobs.runJobInBackground` 호출 줄(231·345·215)도 grep 결과상 해당 파일의 **모든** `withTransaction` 호출보다 뒤에 있어 같은 패턴으로 판단된다(각 파일을 열어 boundary 를 재확인하지는 않았으나, review/index.ts 로 확인한 동일 아키텍처 관례와 `jobs.ts` 함수 자체가 순수 DB 인 것으로 볼 때 위험 없음). `admin/configuration/editor.ts`(이번 라운드의 진원지 자체) 의 트랜잭션도 `materialize`·`writeVersion`·`recordAudit` 전부 Prisma 쓰기뿐 — 새 `lockConnectionsForUpdate`/`lockFallbackPoliciesForUpdate` 도 `tx.$queryRaw` 뿐이라 같은 성질.

**결론**: 재시도 시 다시 실행되는 것은 **DB 쓰기만**이고(트랜잭션 전체가 롤백된 뒤 콜백이 처음부터 다시 돈다는 전제와 일치), 외부 호출·메모리 상태·잡 enqueue 는 애초에 트랜잭션 콜백 밖에 있어 두 번 실행될 위험이 있는 호출자를 찾지 못했다 — 이번 변경(에러 분류 확대)이 **재시도 시 무엇이 다시 실행되는지 자체는 바꾸지 않고**, 이전엔 하드 실패였던 P2010/1213 을 P2034 와 같은(이미 안전하다고 검증된) 재시도 경로로 편입시킬 뿐이라는 Developer 주장과 일치. 재시도 횟수(기본 2)·백오프(없음, 즉시 재시도) 도 무변경(기존 P2034 재시도와 동일 정책 재사용) — 신규 위험 도입 없음.

**판정: 채택, 앱 전체 영향 없음(신규 Low 없음).**

#### ④ REV-036 L1(`getConfigVersion` PRODUCTION 원문 감사) 반영 확인

`history.ts:128-139` `versionRawReadAuditEntry` — `full`(= `config.raw.read` 보유) **그리고** `v.environment === 'PRODUCTION'` 일 때만 감사 1행(`action:'config.raw.read'`, `after:{detail:'VERSION', versionId, version, crossEnvironment?}` — 값 없음, `getRawConfig` 와 동일 규칙) 생성. `getConfigVersion`(`:141-179`) 에서 `recordAudit(audit)` 이 **응답 조립(스냅샷 원문 포함) 이전**에 호출되고 `await` 로 실패 시 그대로 던져지는 위치에 있어(`:171`) "감사가 실패하면 원문도 안 나간다"는 주석과 동작이 일치 — `getRawConfig` 의 기존 순서(먼저 감사, 그다음 응답)와 동일한 fail-closed 패턴. `full=false`(ADMIN, 요약만) 나 비 PRODUCTION 대상은 `versionRawReadAuditEntry` 가 `null` 을 반환해 불필요한 감사 행을 만들지 않는 것도 확인 — REV-036 L1 이 정확히 지시한 그대로 반영됐다.

**판정: 채택, 정상 반영 확인.**

#### 종합 판정

**4건 모두 지시받은 대로 정확히 반영됐다.** Critical·High·Medium·Low 신규 0건 — Codex C2 ①·②(둘 다 이전 라운드에서 채택 확정)와 REV-036 L1·L2(이전 라운드 Low 로 기록)는 이번 수정으로 전부 해소됐고, 새로 발견한 잔여 위험은 없다. 독립 재실행(tsc 0·eslint 0·단위 827/827, 신규 36/36 포함)이 Developer 주장을 뒷받침한다. `maskText` 의 오탐 가능성(hex 식별자 등)은 기존 `looksSecret` 설계의 알려진·수용된 트레이드오프이고 구조화 감사 데이터에는 영향이 없어 별도 이슈로 기록하지 않는다. **QA 진행 가능.**

**QA 인계(추가)**: ["연결↔Fallback 교차 편집 실사용(두 관리자 탭에서 동시에) — 409/400 안내 문구가 이해 가능한지", "reason 에 hex 식별자(커밋 SHA 등)를 넣었을 때 가려지는 것이 기대와 다르지 않은지(화면 안내 문구 확인)", "maskText 가 적용된 감사·버전 응답이 화면에서 자연스럽게 보이는지(`***` 표시)"] · 기존 인계 목록 유지 · **native_change: false** · **화면 변경 없음**.

### 2026-10-01 09:38 reviewer — REV-047 (012c 화면 · developer B 09:20 산출)

> 번호 안내: Leader 지시는 REV-046 이었으나 09:40 에 task-011 감사가 REV-046 을 먼저 사용해 **REV-047** 로 기록한다(vault 최대 REV = 046 확인).

**판정: CONDITIONAL_PASS**(Critical 0 · High 0 · Medium 1 · Low 6). Read 전용 감사 — 코드·문서·테스트·DB·운영(3010·pm2·PRODUCTION 행) 무접촉, commit·push 없음. 서버 1·2단계(REV-035/036·재검, 8c22f01 운영 반영)는 재감사하지 않고 화면↔서버 계약 정합만 대조했다.

#### 발견 사항

**M-1 (Medium) — Raw JSON 편집을 켠 뒤 Form 에서 값을 바꾸면 "확인한 변경 요약"과 다른 문서가 적용된다 (오래된 `rawText` 전송)**
- 위치: `src/components/admin/configEditor/useConfigEditor.ts:164-176`(`setField`·`resetField` 는 `setRawDraft`+`touched()` 만 — `rawText` 갱신 없음) · `:232-244`(`toggleRaw(true)` 가 `rawView` 를 `rawText` 로 **한 번만** 복사) · `:399`(`writer({ patch: draft.patch, meta, rawText: rawEditing ? rawText : null })`) · `ConfigScreen.tsx:120`(`rawText !== null ? api.applyRaw(...) : api.apply(...)`) · `:140-147`(`onTab` 은 문법 오류일 때만 Form 탭 차단) · `:251`(`FieldList frozen={syntaxLocked}` — Raw 편집 중이어도 문법 오류가 없으면 Form 칸 편집 가능) · `:470`(Raw 탭은 `rawEditing ? rawText : rawView` 를 보여 줌).
- 재현 경로(코드 추적): Raw JSON 편집 켬 → Form 탭으로 이동 → 값 1칸 변경/되돌림 → [검증]·[테스트]·[변경 요약] 은 `draft.patch`(Form 변경 포함)로 계산 → [적용] 이 **옛 `rawText`**(Form 변경 없음)를 PUT #111 로 보냄. 서버는 `patchFromRaw` 로 그 텍스트에서 patch 를 다시 만든다.
- 위험: LOCAL 에서는 `productionGate` 가 `summaryHash` 를 보지 않아(비 PRODUCTION 은 `confirm`·`summaryHash` 무시) 사용자가 본 diff 와 **다른 문서가 오류 없이 적용**된다(Form 변경 조용히 누락, ConfigurationVersion·감사 `config.raw_apply` 도 그 문서 기준으로 남음). PRODUCTION 에서는 `SUMMARY_MISMATCH` 409 로 막혀 안전하지만 사용자가 이유를 알기 어렵다. Raw 탭 본문도 초안과 어긋난다. 대상은 DEVELOPER 이상(Raw 편집 가능자)뿐이라 Critical·High 는 아니다.
- 근거: 단위(`configEditor.test.ts`·`flow.test.ts`)에 `rawText`/`applyRaw` 경로 0건, 화면 E2E(`tests/live/task012c-ui-e2e.mjs`)에 Raw 적용 경로 0건 — Developer 의 "E2E 78/78"이 이 경로를 덮지 못한다.
- 권고: ① `setField`/`resetField` 에서 `rawEditing` 이면 `rawText` 를 새 `rawView` 로 갱신하거나 Form 편집 시 Raw 편집 모드를 끈다(또는 Raw 편집 중 FieldList 를 잠근다) ② `submitApply` 는 `rawText` 가 현재 `rawView` 와 일치할 때만 `applyRaw` 로, 아니면 `apply(patch)` 로 보낸다(단일 초안 원칙) ③ 단위 1건(Raw 편집 → Form 편집 → 적용 페이로드 = 현재 초안) + E2E 1건(Raw 편집 후 Form 변경 → 적용 → DB 대조) 추가.

**L-1 (Low) — `__proto__` 키로 클라이언트 프로토타입 오염 (재현 확인, 자기 브라우저 한정)**
- 위치: `draft.ts:274-275`(`docWithDraft`) · `draft.ts:370-371`(`connectionFormBody`) — `if (!isObj(cur[seg])) cur[seg] = {}; cur = cur[seg]` 에 소유 속성·`__proto__` 가드 없음.
- 재현: 격리 미러에서 tsx 스크래치 스크립트로 Raw 텍스트 `{"runtime":{"__proto__":{"polluted":1}}}` 를 `parseRawText` → `docWithDraft` 에 통과시키면 `({}).polluted === 1`(출력 `polluted? 1`). 알 수 없는 키가 `draft.unknown` 에 `runtime.__proto__.polluted` 로 보존돼 doc 재구성 때 `Object.prototype` 에 기록된다.
- 영향: 입력자 본인의 DEVELOPER 브라우저 탭만(자기 유발). 서버는 Raw 문서를 평면 키(`patchFromRaw`·`flattenForm`)로 다루고 정의된 키만 받아 서버 오염 경로는 확인되지 않음.
- 권고: 세그먼트가 `__proto__`·`constructor`·`prototype` 이면 `parseRawText` 에서 `unknownKey` 로 거절하거나 `Object.hasOwn` 가드/`Object.create(null)` 사용 + 단위 1건.

**L-2 (Low) — 진행 중 요청 응답이 초안 변경 뒤 흐름 상태를 덮을 수 있음**: 검증·테스트·요약 응답이 초안이 바뀐 뒤 도착하면 `flow` 상태가 갱신될 여지(요청 세대 번호 가드 확인 못 함). 서버가 적용 시 재검증(`stableStringify(locked.stored)`·PRODUCTION `summaryHash`)하므로 데이터 손상은 없고 화면 표시만 어긋난다. 권고: 요청 시점 후보 해시와 현재 후보를 비교해 불일치 응답은 버린다.

**L-3 (Low) — `rawLineOf`·`renameRawKey` 가 첫 일치 줄만 사용** (`draft.ts`): 같은 말단 키(`"model":` 등)가 `connection`·`runtime` 양쪽에 있으면 "제안 바꾸기"가 엉뚱한 줄을 바꿀 수 있다(바뀐 텍스트는 다시 파싱·서버 검증을 거치므로 데이터 위험은 낮음). 권고: 경로 문맥(부모 키)을 포함해 일치시키거나 AST 위치 사용.

**L-4 (Low) — 화면 상수 결합**: `FlowBar` 가 콘솔 사이드바 폭을 `lg:left-[232px]`·높이를 `h-[150px] lg:h-[84px]` 로 하드코딩(Developer 남은 위험 ②와 동일). 셸 폭·safe-area(task-021 `--safe-bottom`·`data-kb`) 변경 시 겹침 위험. 권고: 셸 폭을 CSS 변수로 공유.

**L-5 (Low) — `APP_SETTING_KEYS` 클라이언트↔서버 드리프트 가드 없음**: `configCopy.ts` 9키는 서버 `engine/configuration/appSettingSchema.ts` 와 **현재 정확히 일치**(직접 대조)하나 목록 API 가 없어 상수 복제다. 권고: 두 목록을 비교하는 단위 1건(테스트는 양쪽 import 가능).

**L-6 (Low) — 화면 E2E 정리 범위**: `tests/live/task012c-ui-e2e.mjs:424-425` 는 `environment: ENV(LOCAL)` · `createdAt >= startedAt` 인 `ConfigurationVersion` 에서 baseline id 를 뺀 행을 삭제한다. PRODUCTION 은 건드리지 않으나 같은 NAS DB 를 공유하므로 실행 시간 창 안에 다른 task 의 LOCAL 버전이 생기면 함께 지워질 수 있다(AuditLog 는 불변이라 남음). 권고: 응답에서 받은 버전 id 만 추적해 삭제. (참고) `lexicon/kana.ts` 에 고아 JSDoc 중복 1건 — 정리 권고.

**범위 밖 관찰**: 격리 tsc 의 2건(`vocab/WordRow.tsx(7,10)`·`vocab/__tests__/labels.test.ts(13,3)` — `SOURCE_BADGE` 미내보내기)은 task-023 WIP 이고 `brand.test.ts` 1 fail 은 task-021 WIP — 012c 무관(근거: 두 파일 모두 012c 산출 목록 밖).

#### 7영역 검토 결과
1. **아키텍처**: 6층 방향·`index.ts` 우회 없음. 화면은 `configApi.ts`(`apiGet/apiPut`) 경유 — 직접 fetch·spawn·Capacitor 0. `/api/admin/v1` 경로·`{success,data,message}` 사용 정합. 발견 없음.
2. **유지보수성**: L-4·L-5·고아 JSDoc. 순수 로직 분리(`configAccess`·`flow`·`draft`·`flowView`·`writeErrorView`)는 양호.
3. **안정성**: **M-1**·L-2·L-3. 409 `VERSION_CONFLICT` → 초안 유지 + [최신 값 기준으로 다시 비교], `SUMMARY_MISMATCH`·기본 연결 `PRIMARY_IN_USE` 처리 확인.
4. **운영성**: 이력(버전·감사) 화면이 ConfigurationVersion·AuditLog 를 읽기 전용으로만 표시, 되돌리기 = 새 버전(서버). 화면은 서버 적용 결과(AppliedNote)만 보여 주고 런타임 적용을 시도하지 않음. 발견 없음.
5. **성능**: 이력·감사는 `usePaged`(limit·cursor), 컴포넌트 N+1 없음. 5초 예산 해당 없음. 발견 없음.
6. **보안**: 권한 갈래 `configAccess`(canApply = canEdit && (!production || superApply), needsConfirm, canRawEdit, canRollback)가 role-permission 표(`config.raw.read`·`config.edit`·`config.apply.production`·`credentials.manage`·`environment.policy`·`config.rollback`·`audit.read`)와 일치, 권한 없는 조작은 DOM 에서 제거(서버가 최종 강제). 비밀 참조 연결은 값 입력 칸 0·참조 이름만(서버 `VALUE_FIELDS` 400·`allowedRefs` 422 와 대응), 이유·confirm·hash 는 본문 전송(URL·storage 사용 0 — localStorage/sessionStorage/password 입력 grep 0). L-1 외 발견 없음.
7. **학습 원칙·엔진명**: 엔진명·model_id·speaker_id 하드코딩 grep 0(DTO 표시명만). 관리자 화면이라 사용자 학습 데이터 경로 무관. 발견 없음.

#### 데모와 다르게 한 점 판정 (승인 v2 `docs/demo/task-012c-console-p2-v2.html`, d1=B·d2~d6=A·d5 목소리 기본값 = 012c-2)
| # | 내용 | 분류 | 근거 |
|---|---|---|---|
| ① | 감사 분류 칩 축소(목소리·조회·권한 거부 제외), 분류별 개수·결과 뱃지 생략 | **implementation** | 목소리는 012c-2(D-C14, 사용자 승인 범위), 권한 거부는 서버가 감사로 남기지 않아 칩을 두면 거짓 안내, "조회"는 [필터 더 보기 › 작업](`secrets.read_ref`·`config.raw.read`)으로 도달 가능, 개수·뱃지는 서버 DTO 에 없음 — 정보 구조·내비 의미 유지 |
| ② | 예비 순서의 "실패하면 다음 연결로 재시도" 스위치 없음 | **implementation** | 서버가 NOT_CONSUMED 로 잠근 값 — 켜 둘 수 있는 스위치는 동작 없는 거짓 컨트롤. 글자 안내로 의미 유지 |
| ③ | Form 에서 `enabled` 칸 숨김(연결 상세 스위치 #93a) | **implementation** | 켜기/끄기 단일 경로·기본 연결 409 보호 때문. 기능 삭제 아님(상세 화면에 존재) |
| ④ | 운영 설정 키 화면 상수 9키·범위(min/max/maxLength) 미표시 | **implementation** | 목록 API·DTO 한계. 9키는 서버와 일치(확인). 드리프트 가드 부재는 L-5 |
| ⑤ | "마지막 적용 n시간 전" 생략 | **implementation** | 편집 정책 DTO 에 시각 없음 — 부가 정보, CTA·흐름 영향 없음 |
| ⑥ | 기본 탭 Form · "설정값 전체 보기" → `&tab=effective` | **implementation**(데모와 동일 의미) | 승인 데모의 기본 탭과 일치, 기존 Effective 보기 유지 |
| ⑦ | 발음 사전 R1(운영 이유 ≥10자 사전 검사·문구) | **implementation**(허용 범위 추가) | Leader 08:10 후속 지시. `kana.test.ts` 기대값 갱신 포함, 서버 `E_REASON*` 과 문구 정합 |
- **material 0 · defect 0** — 데모 재승인 요청 불필요. 단 M-1 은 데모 차이가 아니라 구현 결함(Raw/Form 단일 초안 — 데모·가이드의 "Form↔Raw JSON 같은 초안" 의도 위반)이므로 Developer 수정 대상이다.
- 프로세스 메모: `docs/screens.md` §13 구현 가이드(designer)는 아직 없어 developer B 가 데모를 직접 따랐다(Leader 확인 요청 (b) — 가이드 작성 시 이 구현에 맞출 것).

#### 데모 게이트 확인
- `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-012c-console-p2.md` → **`DEMO_GATE_PASSED`**(task-012c · approved v2 · hash verified).
- `.claude/state/demo-gate/evidence.jsonl:7` 승인 줄(2026-10-01T08:17:28, kind=approve, version 2, `quote_sha256 89d464af…8ec9`, `content_sha256 39b19fc8…508b5067583e`, session `f3fdf531-9497-4e2f-9c67-7ae00f90c639`)이 `prompts.jsonl:43`(08:17:13, 같은 session, 사용자 원문 "대기 중인 데모 전부 권고안대로 승인")과 시각·세션·인용 해시(재계산 일치)가 맞는다. 승인 직전 사용자 프롬프트가 실제로 존재하고 승인은 그 15초 뒤로, 에이전트가 사용자 몫의 approve/waive 를 대신 실행했거나 state 디렉터리를 직접 쓴 흔적은 **발견 없음**(해당 이력 형식은 `check.mjs approve` 가 사용자 프롬프트 인용에 묶는 출력이며, 이 감사에서는 `.claude/state/demo-gate/` 를 읽기만 했다).

#### 실행한 명령과 결과 (격리 미러 `~/.node-local/thekaiwa-rev-012c` — rsync 복제 + node_modules 심볼릭 링크)
- `tsc --noEmit`: exit 2 · 오류 2건(모두 task-023 `SOURCE_BADGE`, 012c 무관) — 012c 파일 오류 0.
- 단위 `node --import tsx --test`(configEditor·flow·history·lexicon kana/reasonCopy/access/integrity/lexiconCopy): **60 pass / 0 fail**.
- 서버 회귀(`src/modules/{admin,engine}` 012c 관련): **97 pass / 0 fail**.
- eslint(012c 산출 파일): exit 0.
- 스크래치 재현 스크립트(L-1): 프로토타입 오염 재현(`polluted? 1`) — 스크래치 디렉터리 안에서만 실행, 저장소 파일 무수정.
- 빌드·서버 기동·E2E 재실행: 하지 않음(Developer 보고 build exit 0·E2E 78/78 은 신뢰 근거로만 인용, 운영·공유 DB 무접촉).

#### 출력 JSON
```json
{
  "reviewId": "REV-047",
  "status": "CONDITIONAL_PASS",
  "issues": [
    { "issue": "Raw 편집을 켠 뒤 Form 변경 시 오래된 rawText 가 PUT #111 로 전송 — 확인한 diff 와 적용 문서 불일치(LOCAL 은 무오류 적용)", "severity": "MEDIUM", "component": "src/components/admin/configEditor/useConfigEditor.ts:164-176,232-244,399 · ConfigScreen.tsx:120,140-147,251,470", "risk": "사용자가 승인한 변경 요약과 다른 설정이 적용·버전·감사에 기록됨", "evidence": "setField/resetField 가 rawText 미갱신, submitApply 가 rawEditing 이면 rawText 전송, 단위·E2E 에 Raw 적용 경로 0건", "recommendation": "Form 편집 시 rawText 재동기화 또는 Raw 편집 종료/잠금, rawText≠rawView 면 apply(patch) 사용, 단위·E2E 추가" },
    { "issue": "Raw JSON __proto__ 키로 클라이언트 Object.prototype 오염", "severity": "LOW", "component": "src/components/admin/configEditor/draft.ts:274-275,370-371", "risk": "자기 브라우저 탭 한정 오동작(서버 오염 경로 미확인)", "evidence": "미러 tsx 재현 polluted? 1", "recommendation": "세그먼트 __proto__/constructor/prototype 거절 또는 hasOwn 가드" },
    { "issue": "진행 중 검증·테스트·요약 응답이 초안 변경 뒤 흐름 상태 덮어쓰기 가능", "severity": "LOW", "component": "src/components/admin/configEditor/useConfigEditor.ts", "risk": "표시 어긋남(서버 재검증으로 데이터 손상 없음)", "evidence": "요청 세대·후보 해시 가드 확인 못 함", "recommendation": "요청 시점 후보와 현재 후보 비교 후 불일치 응답 폐기" },
    { "issue": "rawLineOf/renameRawKey 첫 일치 줄 사용", "severity": "LOW", "component": "src/components/admin/configEditor/draft.ts", "risk": "같은 말단 키가 여러 곳이면 제안 바꾸기가 엉뚱한 줄 수정", "evidence": "말단 키 첫 부분 문자열 매칭", "recommendation": "부모 경로 문맥 포함 매칭" },
    { "issue": "FlowBar 가 사이드바 폭·막대 높이 하드코딩", "severity": "LOW", "component": "src/components/admin/configEditor/FlowBar.tsx", "risk": "셸 폭·safe-area 변경 시 겹침", "evidence": "lg:left-[232px], h-[150px] lg:h-[84px]", "recommendation": "CSS 변수로 셸 폭 공유" },
    { "issue": "APP_SETTING_KEYS 클라이언트↔서버 드리프트 가드 없음", "severity": "LOW", "component": "src/components/admin/configEditor/configCopy.ts ↔ src/modules/engine/configuration/appSettingSchema.ts", "risk": "서버 키 추가 시 화면 누락(현재 9키 일치)", "evidence": "직접 대조 일치, 비교 테스트 부재", "recommendation": "두 목록 비교 단위 1건" },
    { "issue": "E2E 정리가 createdAt 시간 창으로 LOCAL ConfigurationVersion 삭제", "severity": "LOW", "component": "tests/live/task012c-ui-e2e.mjs:424-425", "risk": "공유 DB 에서 같은 시간대 타 task LOCAL 버전 동반 삭제 가능", "evidence": "environment=LOCAL, createdAt>=startedAt, baseline id 제외", "recommendation": "응답으로 받은 버전 id 만 추적·삭제" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 6 },
  "high_risk_areas": [
    "Raw JSON 편집 ON → Form 탭 값 변경/되돌림 → 적용(M-1 재현·수정 후 Raw 탭 텍스트=Diff=적용 문서 일치, LOCAL·PRODUCTION 양쪽 메시지)",
    "PRODUCTION 경로 전부(SUPER 확인 창 PRODUCTION 입력·요약 불일치 409·비 SUPER 적용 단계 잠금과 버튼 DOM 0·테스트 필수/partial 적용 불가·운영 되돌리기·켜기/끄기·비밀 참조) — QA 토큰이 운영에서 인정되지 않아 단위 + U-C7 사용자 리허설",
    "409 VERSION_CONFLICT [최신 값 기준으로 다시 비교](초안 유지)·두 탭 동시 편집·기본 연결 끄기 PRIMARY_IN_USE",
    "Raw JSON 문법 오류 잠금·unknownKey 제안 바꾸기(같은 말단 키 2곳)·가림 값(***) 문서 편집 불가·__proto__ 입력",
    "비밀 참조 연결 SUPER 만·값 입력 칸 DOM 0·allowedRefs 밖 ref 이름만 표시",
    "이력/감사 — audit.read·환경 필터(SUPER)·되돌리기 = 새 버전·기록 손상 표시·옛 발음 사전 감사 행·원문 JSON DEVELOPER+",
    "예비 순서 편집(FallbackEditor) — 요약 후 버림 시 쓰기 0·주 연결 불변식",
    "360/390/412/1280 적용 막대 fixed(사이드바 232px 가정)·키보드·safe-area 겹침(task-021 data-kb)",
    "발음 사전 R1 운영 이유 ≥10자·E_REASON_SECRET_LIKE 문구",
    "E2E 재실행 시 공유 DB LOCAL ConfigurationVersion 삭제 범위(다른 task QA 동시 실행 금지)"
  ],
  "native_change": false
}
```

**다음**: Developer 가 M-1 을 수정(Low 는 같은 라운드 권고) → Reviewer 재검(범위 좁음) → QA. Medium 1건·High 0이므로 Leader 에스컬레이션 조건(Critical·High 3건↑) 미해당.

## Developer 기록 (REV-047 수정)

- [13:26] **REV-047 M-1·L-1 수정 완료** — 데모 게이트 `check.mjs check --task task-012c` → `DEMO_GATE_PASSED` · `task: task-012c`(approved v2 · hash verified). commit·push·배포·스키마·운영(3010·PRODUCTION 행) 무접촉, 다른 사람 변경 무접촉.
- **M-1 방침(Raw 글 = 초안의 원본 + 적용 가드)**: ① Raw JSON 편집 중 Form 칸을 바꾸거나 [원래대로] 하면 그 값을 **Raw 글에 넣고 다시 읽어** 초안으로 삼는다(`draft.ts` `rawTextWithField` — Form 초안 규칙 그대로: 기준값과 같아지면 저장값이 있는 키는 저장값, 없는 키는 문서에서 지움·그 때문에 빈 부모 객체도 지움). Raw 에서 따로 고친 내용(x- 메모·다른 값)은 남고 들여쓰기만 2칸으로 다시 쓴다 — Form 변경으로 조용히 사라지는 경로 없음. 글에 문법 오류가 있으면 Form 변경을 받지 않고 오류 위치를 세워 기존 "Form 잠금" 안내가 뜬다. ② 적용 본문은 `applyPayload` 가 고른다 — Raw 글을 읽은 변경이 `requestPatch(draft)`(= 변경 요약 후보)와 같고 지운 저장 키·막힌 키가 없을 때만 그 글 그대로 #111, 아니면 초안 patch 를 #107 로 보내고 적용 뒤 "Raw JSON 글은 적용하지 않았어요 — 변경 요약(초안) 기준으로 적용했어요" 안내(`ConfigScreen` 경고 Note, 다음 편집 때 사라짐). ③ 적용 직전 300ms 읽기 예약이 남아 있으면(요약 뒤 Raw 를 고침) 지금 읽어 초안에 넣고 요약을 지운 뒤 "변경 요약을 다시 만든 뒤 적용해 주세요"(remakeDiff)로 멈춘다 · 변경 요약 없음 검사를 운영 전용에서 **모든 환경**으로(정상 흐름은 [적용…]이 요약 뒤에만 보여 영향 없음, 예약 읽기가 시트 열린 사이 요약을 지운 경우만 막힘) · 예약 타이머는 실행·취소 때 null 로 비우고 적용 성공·초안 버리기·제안 바꾸기·Raw 켜기/끄기에서 취소(성공 뒤 옛 글이 초안을 되살리는 경로 차단).
- **L-1**: `draft.ts` 경로 쓰기를 `setPath`(소유 속성만 따라감, `__proto__`·`constructor`·`prototype` 마디면 쓰지 않음)로 통일(`docWithDraft`·`connectionFormBody`·새 `rawTextWithField`) · `flatFromDoc`/`walk` 가 막힌 마디를 건너뜀 · `parseRawText` 가 문서 어디든 막힌 이름의 키 경로를 `blocked` 로 돌려주고 훅이 로컬 오류(`unknownKey`, "쓸 수 없는 키 이름이에요") → 검증 실패 상태·Raw 오류 목록에 줄 표시 · 막힌 키가 든 글은 #111 로 보내지 않음.
- **변경 파일**: `src/components/admin/configEditor/{draft.ts, useConfigEditor.ts, ConfigScreen.tsx}` · 신규 단위 `src/components/admin/configEditor/__tests__/rawSync.test.ts`(4건: M-1 ① Raw 뒤 Form 변경 → 적용 글 = 요약 후보·옛 글이면 patch+안내 / ① 되돌리기·기준값 복귀·빈 부모 정리·문법 오류 거부 / M-1 ② Raw 만 편집 → 사용자 글 글자 그대로 #111 / L-1 오염 0·blocked 경로·APP_SETTING 맨 위 `__proto__`).
- **검증**(공유 미러 `~/.node-local/thekaiwa` — sync-local 후): 신규 4/4 · `src/components/admin/**` 단위 **89/89** · 서버 회귀 `src/modules/{admin,engine}` **143/143** · `tsc --noEmit` **0** · eslint(configEditor·history·lexicon) **0** · `next build` exit 0(격리 미러, `flock thekaiwa-build.lock`, 경고 = 기존 claudeCli 추적).
- **라이브 확인**(격리 미러 `~/.node-local/thekaiwa-dev-012cfix` dev **3024** `env -i APP_ENV=LOCAL`, QA developer 쿠키, 스크래치 스크립트 — `tests/**` 에 추가하지 않음): **11/11 PASS** — M1a Raw 편집 중 Form 변경이 Raw 글에 들어감(Raw 값·x- 메모 유지) · M1b 서버 변경 요약 = threshold 0.55·endpointSilenceMs 650 · M1c DB 행 = 요약 · M1d 감사 `config.raw_apply` · M1e 어긋남 안내 없음 · M2 Raw 만 편집 → 요약 0.65 = DB · 감사 raw_apply · L1a `({}).polluted` undefined · L1b 오류 목록 표시 · L1c 검증 실패(적용 단계 못 감) · 콘솔 오류 0 · Z 원복. 1차 실행은 M2 1건 FAIL — **스크립트 타이밍**(앞 적용의 토스트가 남아 DB 를 두 번째 적용 전에 읽음, 정리 때 버전 3개 확인) → 새 감사 행 폴링으로 고쳐 재실행 PASS. **정리 범위**: LOCAL `reazon-ondevice` 한 행만 쓰고, 끝에 그 대상의 새 ConfigurationVersion 중 **QA developer(또는 actor 없음)가 만든 것만 id 로** 삭제(시간 창 삭제 안 함 — 두 실행 모두 지운 3 · 남은 0/0), 행 관리 칸 바이트 원복 대조 일치. AuditLog(QA developer, LOCAL `config.raw_apply` 등)는 불변이라 남음. 서버 종료·격리 미러·쿠키 삭제 완료.
- **미처리 Low(지시대로 손대지 않음)**: L-2 진행 중 응답 덮어쓰기 · L-3 `rawLineOf`/`renameRawKey` 첫 일치 줄 · L-4 적용 막대 사이드바 폭 하드코딩 · L-5 `APP_SETTING_KEYS` 일치 테스트 · L-6 E2E 정리 시간창(`tests/live/task012c-ui-e2e.mjs` — QA 소관) · 고아 JSDoc(`lexicon/kana.ts`).
- **남은 위험**: ① 409 [최신 값 기준으로 다시 비교] 뒤 Raw 편집이 켜져 있으면 Raw 글은 옛 저장값 기준이라 적용 때 `applyPayload` 가 어긋남으로 보고 초안 patch(#107)로 보낸다(요약과는 일치, 안내 표시 — Raw 글 재동기화는 하지 않음) ② 중첩 `x-` 키(예: `runtime.x-memo`)는 클라이언트가 건너뛰고 서버 #111 은 평면 키로 읽어 unknownKey — 이번 변경 전부터 있던 차이(범위 밖, Reviewer 판단 요청) ③ Raw 편집 중 Form 입력은 글자마다 Raw 글을 다시 써 사용자 들여쓰기가 2칸으로 정리된다(내용 손실 없음) ④ 운영(PRODUCTION) 경로 라이브는 여전히 U-C7.
- **Reviewer 인계**: `{"taskId":"task-012c","status":"DONE","deliverables":["src/components/admin/configEditor/draft.ts","src/components/admin/configEditor/useConfigEditor.ts","src/components/admin/configEditor/ConfigScreen.tsx","src/components/admin/configEditor/__tests__/rawSync.test.ts"],"blockers":[],"risk_level":"LOW","self_check":{"unit_test":true,"lint":true,"type_check":true,"engine_name_leak":false,"native_change":false}}` — 재검 초점: `rawTextWithField`↔`setDraftValue` 규칙 일치, `applyPayload` 비교 기준(요약 후보 = `requestPatch(draft)`), 적용 직전 예약 읽기 처리, 막힌 키 오류 표시.

## Reviewer 기록 (REV-047 수정 재감사)

### 2026-10-01 13:41 reviewer — REV-054 (REV-047 M-1·L-1 수정 재감사 · 범위 좁음)

> 번호 안내: Leader 부여 번호 REV-054 그대로 사용(vault 직전 REV-053 = task-023 재감사).

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 4). Read 전용 감사 — 저장소 코드·문서·테스트·DB·운영(3010·pm2·PRODUCTION 행) 무접촉, commit·push·`git checkout/restore/reset/stash/clean` 없음. 단위 실행·변이 시험은 **본인 전용 미러 `~/.node-local/thekaiwa-rev-012c2` 에서만**(src 복사본, `node_modules` 는 공유 미러를 읽기 링크만) 했고 공유 미러(`~/.node-local/thekaiwa`)·다른 에이전트 미러는 쓰지 않았다. 빌드·서버 기동 없음, `tsc`·eslint 는 돌리지 않았다(Developer 기록의 0건을 신뢰하지 않고 재현도 하지 않음 — 이번 범위는 로직 추적).

**데모 게이트**: `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-012c-console-p2.md` → `DEMO_GATE_PASSED`(approved v2 · hash verified). `evidence.jsonl` 7번째 줄(`kind:approve`, version 2, ts 08:17:28, session `f3fdf531…`) 이 `prompts.jsonl` 의 사용자 발화 08:17:13 "대기 중인 데모 전부 권고안대로 승인" 과 같은 세션·직전 15초로 대응(같은 초에 task-012·010d·021·022·023·025·026 도 일괄 승인 줄 — 사용자 발화 "전부"와 일치). `waived_by` 빈 값, `events.jsonl` 에 `.claude/state/demo-gate/` 직접 쓰기 0건·block 0건 — 에이전트가 `approve`·`waive` 를 대신 실행했거나 상태 파일을 직접 쓴 흔적 **발견 없음**. 승인 데모(v2) 대비 차이 분류: 신규 문구 2개("Raw JSON 글은 적용하지 않았어요" 경고 Note · "Raw JSON 이 변경 요약 뒤에 바뀌었어요…" 차단 안내)는 승인본에 이미 있는 "변경 요약을 만든 뒤 설정이 바뀌었어요 → [변경 요약 다시 만들기]"(데모 1740행) 흐름과 같은 종류의 오류·안내 상태이고 정보구조·CTA·단계 변화가 없어 **implementation**(material·defect 없음).

#### 1. M-1 — 닫힘 (구조적으로, 순서별 추적)

공통 불변식: **적용 본문 = 확인한 변경 요약의 후보(`requestPatch(draft)`)**. 요약(#106)·적용(#107)은 같은 `draft` 를 쓰고, #111 글은 `applyPayload`(`draft.ts:424-436`)가 `parseRawText(text)` 의 요청 patch 와 `sameValue` 로 같을 때만 보낸다. 같지 않으면 글을 버리고 초안 patch 를 #107 로 보내 `rawIgnored` 안내.

| 순서 | 결과 |
|---|---|
| 요약 → Raw 편집 | `setRawText` 300ms 뒤 `applyParse` → 성공 시 `touched()` 가 `diff` 지움 → 요약 다시 만들기 요구. 읽기 전(300ms 안) 적용 시도 → `submitApply` 의 `rawEditing && cancelParse()` 가 지금 읽고 `block` 안내로 멈춤(`useConfigEditor.ts:424-428`). 읽기 실패(문법 오류)면 `touched()` 없이 `syntax` 만 서고 `flowView` 가 적용 버튼을 숨김(Form 잠금·[검증] 비활성). 시트가 이미 열린 채 타이머가 문법 오류로 끝난 경우에도 `applyPayload` 가 patch 로 떨어져 **적용 = 요약**(`rawIgnored` 안내) |
| 요약 → Form 편집(Raw 켠 채) | `editViaRaw` 가 값을 Raw 글에 쓰고(`rawTextWithField`) 다시 읽어(`applyParse` → `touched()`) 요약을 지움. 글과 초안이 같은 변경이 되어 이후 요약·적용이 같은 후보 |
| 409 [최신 값 기준] | `noticeAction` 이 flow·test·diff 만 지우고 `rawText`·`draft` 는 유지. 요약을 다시 만들어야 적용 가능. 새 저장값과 안 맞는 옛 Raw 글은 `applyPayload` 의 `parseRawText(…, 새 storedFlat)` 에서 달라져 patch 로 떨어짐 → **다른 관리자가 막 바꾼 키를 옛 글이 조용히 되돌리는 경로 없음**(Developer 위험 ① 확인) |
| 탭 전환 | Workspace `key={scope:target}`·`syntaxLocked` 로 Form 탭 잠금. 훅 상태는 탭과 무관하게 한 초안 |
| Raw 만 편집 | 사용자 글 글자 그대로 #111(`rawText` 그대로 + `meta`) — 읽은 변경 = 요약 후보일 때만 |

**비교 기준 안전성** — `sameValue` = 키 정렬 `JSON.stringify`(`draft.ts` `stable()`), 서버 `validate.ts:60-75` `sameValue`/`stableStringify`(`sortDeep`)와 **같은 의미**(키 순서 무시). 공백·키 순서·숫자 표기(`1.0`/`1`/`1e3`/`-0`)는 양쪽 모두 `JSON.parse` 뒤 비교라 오탐·미탐 없음. 최상위 `x-` 는 초안에 안 들어가므로 "같은 변경"으로 취급(서버 `patchFromRaw` 도 `RAW_TOP_KEYS` 밖 키를 patch 에 안 넣어 같은 결과). 지운 저장 키(`missing`)·막힌 키(`blocked`)·문법 오류는 글을 보내지 않는 쪽으로(안전한 방향의 미탐만 있음, 오탐 없음). 서버 뒷받침: PRODUCTION 은 `productionGate` 의 `summaryHash` 재계산(409 `SUMMARY_MISMATCH`)이 남은 어긋남을 막는다 — 비 PRODUCTION 은 클라이언트 가드만(수용, 아래 L-1).

#### 2. 유지된 안전장치 — 변경 없음 확인

PRODUCTION 확인창(`checkConfirmInput`+서버 403)·"변경 요약 없이 적용 불가"(이번에 **모든 환경**으로 확대 — 완화 아님)·ConfigurationVersion+AuditLog(서버 `commitEdit` 단일 `withTransaction`, 서버 파일 diff 0 — `src/modules/{admin,engine}/configuration` 무변경 확인)·Secret 은 `credentialRef` 만(`connection.credentialRef` 중첩분은 클라이언트·서버 모두 제거, #111 에 `allowCredential` 없음)·#111 감사 `config.raw_apply`.

#### 3. L-1(프로토타입 오염) — 닫힘, 진입점 전부 덮임

클라이언트: Raw 읽기(`parseRawText` → `blockedPaths` → `blocked`, 초안 미포함, 로컬 `unknownKey` 오류) · Form 경로 쓰기(`rawTextWithField` null) · 초안 병합(`docWithDraft`·`setPath`/`deletePath`/`ownChild` 가 소유 속성만 따라가고 막힌 마디면 쓰지 않음) · `connectionFormBody` null · `flatFromDoc`/`walk` 가 막힌 마디를 건너뜀 · 막힌 키가 든 글은 #111 금지. 서버: 명시 차단은 없지만 **구조적으로 안전**(평면 문자열 키 + `RAW_TOP_KEYS` 허용목록 + `defs` 외 키는 `unknownKey`/`materialize` 전에 400) — 클라이언트 차단과 충돌·중복 없음(서버는 허용목록, 클라이언트는 차단목록, 목적이 다름). **변이 시험**: 미러에서 `BLOCKED_SEGMENTS` 를 비우면 L-1 테스트 FAIL(1건).

#### 4. Developer 남은 위험 3건 판정

- ① 409 뒤 옛 Raw 글: **Low**(수용). 적용 = 요약이 유지되고 안내가 뜸. 화면에 옛 저장값 글이 남아 Form 과 다르게 보이는 불편만(아래 L-4).
- ② 중첩 `x-`(예 `runtime.x-memo`): **Low**(수용, 이번 변경 이전부터). 클라이언트는 건너뛰어 "같은 변경"으로 보고 #111 로 보내 서버가 400 `unknownKey` — 안전한 실패. 최상위 `x-` 는 서버가 오류 없이 **버리므로 저장되지 않는다**(아래 L-2 — Developer 가 말한 것보다 한 가지 더).
- ③ 들여쓰기 2칸 정리: 발견 없음(외관). `JSON.parse`→`stringify` 라 키 순서·값 보존, JSON 이라 주석 손실 없음, 중복 키는 서버도 마지막 값 우선이라 동일.

#### 5. 회귀·경계 — 발견 없음

`grep -rniE "reazon|whisper|style-bert|claude" src/components/admin/configEditor` 0건 · `from '@/modules` import 0건(타입은 `@/types/admin` 만 — `preferences` 등 어느 층 직접 import 도 없음) · `spawn`/`child_process`/`window.Capacitor`/`fetch(`/`localStorage` 0건(요청은 `configApi` 경유). 6층·엔진명 비노출·Secret·학습 원칙 영역은 이번 수정이 건드리지 않음. **단위 25/25 통과**(미러 `configEditor.test.ts`·`flow.test.ts`·`rawSync.test.ts`). **변이 시험(결함이 실제로 잡히는가)**: ① `applyPayload` 의 `sameValue` 비교 제거(= 글이 읽히기만 하면 그대로 #111, REV-047 M-1 의 형태) → `rawSync` M-1 ① **FAIL** ② `BLOCKED_SEGMENTS` 비움 → L-1 **FAIL**. 복원 후 4/4·미러 `draft.ts` = 저장소와 `diff -q` 일치. (③ `rawTextWithField` 가 글을 그대로 돌려주는 변이는 돌리지 않았다 — 테스트가 `s1.draft` 를 `setDraftValue` 결과와 `deepEqual` 하고 `parsed(p.text)` 를 요약과 비교하므로 같은 단언에서 잡힐 것으로 판단하나 실측은 아님.)

#### 발견 사항 (모두 Low — 차단 없음)

**L-1 (Low) — 진행 중 검증·테스트·요약 응답이 초안 변경 뒤 도착하면 낡은 요약이 서는 경로가 남음 (REV-047 L-2 이월)**
- 위치: `useConfigEditor.ts:312-388`(`runValidate`·`runTest`·`runDiff` — 요청 시점 후보와 현재 후보를 비교하지 않음 · `busy` 중에도 Form·Raw 입력은 막히지 않음 `EditorChrome.tsx:59-60` 은 버튼만 막음)
- 위험: 요약 요청 도중 초안을 바꾸면 `touched()` 가 `diff` 를 지운 **뒤에** 옛 응답이 `setDiff` 해 옛 후보의 요약으로 [적용]이 열린다. PRODUCTION 은 서버 `SUMMARY_MISMATCH` 409 가 막지만 **비 PRODUCTION 은 해시를 보지 않아 적용 본문 ≠ 화면 요약**이 될 수 있다 — 이번 M-1 과 같은 종류의 마지막 남은 경로(좁은 시간창·LOCAL/개발 환경 한정).
- 권고: 요청 때 `JSON.stringify(candidate.patch)` 를 잡아 두고 응답 때 현재 후보와 다르면 응답을 버린다(AbortController 도 가능). 다음 라운드에 묶어 수정.

**L-2 (Low) — `x-` 키: 화면 안내와 서버 동작이 다름**
- 위치: `RawTab.tsx:137`("x- 로 시작하는 키(예: x-note)는 스키마 밖이어도 그대로 보존돼요") ↔ `src/modules/admin/configuration/editor.ts:688-724`(`patchFromRaw` 는 최상위 `x-` 를 오류 없이 받되 `flat` 에 넣지 않아 **저장되지 않음**) · 중첩 `x-` 는 서버 400
- 위험: 사용자가 Raw 에 `x-note` 를 적고 적용하면 성공으로 보이지만 저장 문서에는 없다(데이터 손상 아님 — 요약·적용 일치, 서버 문서 무변화). 문구가 거짓이라 신뢰를 해침. `rawSync.test.ts:78` 도 "x-note 유지"를 **글**에서만 확인.
- 권고: 문구를 "x- 키는 편집 글에만 남고 저장·적용되지 않아요"로 바꾸거나, 서버 `patchFromRaw` 가 `x-` 를 오류로 돌려 클라이언트와 맞춘다(Leader 결정 — 정본 `api-contract` #111 문구 확인).

**L-3 (Low) — 새 가드의 훅 수준 회귀 테스트 없음**
- 위치: `__tests__/rawSync.test.ts` 는 순수 함수(`rawTextWithField`·`applyPayload`·`parseRawText`)만 덮는다. `submitApply` 의 ① 예약 읽기 중 적용(`cancelParse()` 분기) ② 모든 환경 `!diff` 차단 ③ 409 reload 뒤 옛 Raw 글 ④ Raw 끄기 시 문법 오류 글 폐기는 단위 0건(라이브 11/11 은 Developer 기록, 이번에 재현하지 않음).
- 권고: 적용 전 판정(`rawEditing`·`rawText`·`pendingParse`·`diff`)을 순수 함수로 빼 단위로 고정하거나 QA 라이브 시나리오에 ①·②를 넣는다.

**L-4 (Low) — 409 [최신 값 기준] 뒤 Raw 글이 옛 저장값 그대로 남아 Form 과 어긋나 보임 (Developer 위험 ①)**
- 위치: `useConfigEditor.ts` `noticeAction`(rebase/reload 가 `rawText` 를 갱신하지 않음)
- 위험: 적용은 `applyPayload` 가 patch 로 보내 요약과 일치하고 안내도 뜨므로 데이터 위험은 없으나, 사용자가 옛 값 글을 보고 헷갈릴 수 있음.
- 권고: reload 때 Raw 편집이 켜져 있으면 글을 새 `rawView` 로 다시 만들거나 편집을 꺼 준다.

```json
{
  "reviewId": "REV-054",
  "status": "PASS",
  "issues": [
    { "issue": "진행 중 응답이 초안 변경 뒤 낡은 요약을 세움(REV-047 L-2 이월) — 비 PRODUCTION 은 해시 미검증", "severity": "LOW", "component": "src/components/admin/configEditor/useConfigEditor.ts:312-388", "risk": "적용 본문 ≠ 화면 요약(LOCAL·좁은 시간창, PRODUCTION 은 SUMMARY_MISMATCH 로 차단)", "evidence": "runValidate/runTest/runDiff 가 요청 후보 대비 현재 후보 비교 없이 setDiff·setFlow, EditorChrome 은 버튼만 busy 로 막음", "recommendation": "요청 시점 candidate.patch 캡처 후 응답 때 불일치면 버림" },
    { "issue": "x- 키 안내 문구와 서버 동작 불일치(최상위 x- 는 저장 안 됨, 중첩 x- 는 400)", "severity": "LOW", "component": "src/components/admin/configEditor/RawTab.tsx:137 · src/modules/admin/configuration/editor.ts:688-724", "risk": "성공처럼 보이나 저장 문서에 없음(데이터 손상 아님)", "evidence": "patchFromRaw 는 RAW_TOP_KEYS 만 flat 에 담음; 문구는 '그대로 보존돼요'", "recommendation": "문구 정정 또는 서버가 x- 를 오류로 처리해 클라이언트와 일치" },
    { "issue": "submitApply 가드(예약 읽기·모든 환경 !diff·409 뒤 옛 글) 훅 수준 테스트 없음", "severity": "LOW", "component": "src/components/admin/configEditor/__tests__/rawSync.test.ts", "risk": "후속 수정에서 가드가 조용히 빠져도 단위가 못 잡음(순수 함수 변이 2건은 잡힘)", "evidence": "rawSync 4건은 rawTextWithField·applyPayload·parseRawText 만 호출", "recommendation": "적용 전 판정을 순수 함수로 분리해 단위 고정 또는 QA 라이브에 포함" },
    { "issue": "409 reload 뒤 Raw 글이 옛 저장값으로 남아 Form 과 어긋나 보임", "severity": "LOW", "component": "src/components/admin/configEditor/useConfigEditor.ts noticeAction", "risk": "사용자 혼동(적용은 요약 일치·안내 표시)", "evidence": "rebase/reload 가 flow·test·diff 만 초기화하고 rawText 유지", "recommendation": "reload 때 Raw 편집 중이면 글 재생성 또는 편집 끄기" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 4 },
  "high_risk_areas": [
    "Raw 편집 후 Form 변경 → 적용 본문 = 변경 요약(M-1 회귀 — LOCAL 에서 요약 값과 DB 행·감사 raw_apply 대조)",
    "변경 요약 뒤 Raw 를 고친 직후(300ms 이내) [적용] — 차단 안내와 요약 재생성",
    "Raw 에 __proto__·constructor·prototype 키 → 오류 표시·적용 불가·({}).polluted undefined(L-1 회귀)",
    "409 [최신 값 기준] 뒤 Raw 켠 채 적용 — 요약 일치·'Raw JSON 글은 적용하지 않았어요' 안내",
    "요약 요청 진행 중 초안 변경(L-1 이월 — 비 PRODUCTION 에서 낡은 요약으로 적용 가능)",
    "Raw 의 x- 키(최상위·중첩) 적용 결과와 안내 문구",
    "PRODUCTION 확인창·SUMMARY_MISMATCH·ConfigurationVersion+AuditLog(운영 경로 라이브는 여전히 U-C7)"
  ],
  "native_change": false
}
```

**다음**: Critical 0 · High 0 · Medium 0 → QA 진행 가능. Low 4건은 QA 와 병행 또는 다음 라운드 권고(Leader 에스컬레이션 조건 미해당). 수정이 생기면 Reviewer 부터 재순환.

## QA 기록

## 배포 기록

## 최종 요약

### 2026-09-29 03:15 Leader(메인) — reason 검사 적용 범위
- 발음 사전(003g) 쓰기 경로(추가·수정·비활성·Import·Rollback 의 reason)에도 **CX-3 공용 reason 검사 함수를 적용한다** — 같은 AuditLog 영구 보존 경로라 같은 유출 위험. developer 첫 커밋(D-C3 + CX-3 공용 함수)에 포함, 003g 스모크(`task003g-smoke.sh`) 회귀 필수.

### 2026-09-29 03:50 Leader(메인) — 데모 v2 게시·designer 확인 요청 10건 답
- 게시: https://claude.ai/artifact/6xHJK9pXzMpWxCfSZaT65o (v2, 전체 열람 후 게시 — 합성 데이터·외부 리소스 0·실주소/비밀 0 확인). 사용자 승인 대기(U-C4) + 데모 안 결정 6건(권고 d1 B·d2 A·d3 A·d4 A·d5 A·d6 A).
- 답: ① 허용됐지만 서버에 없는 참조 **이름 표시 허용**(값 아님, 운영자가 무엇을 넣어야 할지 알아야 함) ② 운영 **끄기에는 기능 테스트 요구 안 함**(이유+PRODUCTION 입력, 기본 연결은 409) — 데모대로 ③ menu.ts `form` 탭·history 메뉴 phase 개방·설정 메뉴 설명 문구 — developer 반영 ④ #108 목록 DTO 에 출처(감사 action)·대상 이름·손상 여부 추가, 손상 판정 규칙은 003g 와 동일 ⑤ Diff DTO 단일 출처 = `types/admin.ts`, 정본은 api-contract #106 을 기준으로 admin-console/08 을 맞춘다(before/after·양쪽 출처·저장값·editability·strict·restartTarget·blocked) ⑥ #105 에 `versionId`(되돌릴 스냅샷) 입력 추가 — 운영 Rollback 사전 테스트용 ⑦ **LOCAL 은 기능 테스트 생략 가능**(운영만 필수 — §8-1 해석과 일치) ⑧ 잠금 배정은 D-C4 편집 키 표가 정본, 데모는 가정 ⑨ DTO 에 키별 `verifiable` 추가 ⑩ "재시작 필요" 문구 그대로.
- 구현 가이드 주의: 데모의 `speech.review.threshold` 기본 0.72 는 합성값 — 실제 기본은 0.85(ACCURATE 0.90), 012c 에서 ⑤ 규칙(ACCURATE = max(설정, 0.90)) 적용(task-012b 03:30 판단).

### 2026-09-29 08:10 Leader(메인) — 서버 1단계 결과 판단(R3·정본 차이)
- **B1**: `conversation/__tests__/lesson.test.ts` REV-032 M1 폴백 테스트 픽스처(가짜 home-m4 연결이 허용 밖 ref·임의 포트)를 게이트에 맞게 수정 — 소관 PE(같은 파일을 A4 v7 로 수정 중)에 배정, developer 수정안(keyEnv `HOME_M4_API_KEY`·`AI_API_BASE` = 가짜 서버 origin·t.after 복원) 그대로.
- **R3 판단**: ① 실행 검증 대상이 없는 키 — **표시 전용 키(VoiceProfile 표시명·정렬)** 는 `verifiable: NOT_NEEDED`(런타임 효과 없음)로 분류해 PRODUCTION 적용 허용, **`speech.review.threshold` 는 PRODUCTION 잠금 유지**(LOCAL 만 편집 — 데모 "운영 잠금"과 일치) ② TTS `sdpRatio·noise·noiseW` 는 캐시 키에 없어 **편집 불가 유지**(캐시 키 확장은 별도) ③ home-m4 `allowedTasks` **보류(편집 불가)** ④ 연결/Fallback **끄기는 기능 테스트 면제**(designer 확인 ② 답과 동일, 기본 연결 끄기는 409).
- **정본 차이 채택**: 발음 사전 reason 길이 오류는 003g 계약대로 422 `E_REASON`(하위 호환, CX-3 의 400 은 설정 편집 경로) · PRODUCTION 사전 reason ≥10 · credentialRef 검사 맨 앞 "평문 의심" · env origin 아닌 https 이름 주소 거부(SNI 로 IP 고정 불가) · home-m4 `allowedRefs` 에 `env:AI_API_KEY` 별칭 · `file:` 시크릿 매 호출 읽기(캐시 없음 — 성능 문제 시 후속) · #101 미사용 허용 ref 노출(designer 확인 ① 답과 동일) → 정본 반영은 REV 뒤 Leader 에이전트.
- R1(발음 사전 화면 오류 문구)·R2(005b 스모크 5c·5j·7c 기대값 — 운영 gateway 기동 환경)는 후속: R2 는 이번 라운드에서 스모크 기대값 갱신, R1 은 화면 작업(developer B) 때.
- [2026-09-29 09:25] codex_gate/C2 engine=jev → **codex_required=true** / wanted_before_budget=true / mode=adversarial-review / focus=security(0.97) / budget_rule=CX-limit-unknown-r2 / codex_switch=on / calls_used=1/4 | overrides=CX-r2-post-review | fallback=- | tokens=1180


### [2026-09-29 10:35] C2 adversarial-review focus=security(0.97) — done
- judge 판정: [2026-09-29 09:25] codex_required=true(adversarial-review · security) / 호출 차수: 2/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=f4a3f32(task_file) · snapshot=c16fd35
- 지적 3건:
  - [medium] src/modules/engine/adapters/llm/claudeCli.ts:312 — 자식 환경변수가 블랙리스트 방식(TTS_SERVICE_SECRET 한 항목만 추가)이라 다른 배포 시크릿이 상속될 수 있음 → 허용 목록 방식으로 전환, fail-closed 검사 추가, 미등록 변수 회귀 테스트 권고
  - [medium] src/modules/infra/secrets.ts:124 — lstatSync와 readFileSync 사이의 TOCTOU 레이스로 검증된 파일을 심볼릭 링크나 다른 파일로 교체 가능 → O_NOFOLLOW로 fd 열고 fstat 후 같은 fd에서 제한된 바이트만 읽기, 읽은 뒤 inode 변경 검증
  - [medium] src/modules/infra/reason.ts:25 — Unicode format 문자(soft hyphen U+00AD, zero-width space U+200B 등)로 Bearer 토큰·JWT·24자 토큰을 분할하면 정규식 패턴 매치 우회 가능 → 검사 전 Unicode 정규화와 Cf 문자 제거 후 secret-like 판정, soft hyphen·zero-width 분할 회귀 사례 추가
- 검토하지 못한 범위: MariaDB 다중 프로세스 동시성·격리 수준(읽기 전용) · 아직 구현되지 않은 #101 라우트의 HTTP 응답 봉투 · Export·백업 파이프라인의 reason 원문 추가 복제 여부(범위 밖)
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260928T225948Z-task-012c-C2/raw.txt


### 2026-09-29 11:40 Leader(메인) — 통합 QA(012c 서버 1단계 + task-010 A4 v7) PASS
- 격리 복제본 운영 모드(`next build` → `env -i … next start` 3011·3012 두 프로세스). tsc 0 · eslint 0 · build ok · 단위 **790/791(1 skip, 0 fail)**.
- 게이트 스모크 `task012c-gate-smoke.sh 3011 3012 <로그 2>` **26/26**(두 프로세스 30초 슬롯 1건만·SSRF 반례·home-m4 대상 고정·ref 거부·reason 비밀 유사 422·서식 문자 분할 422·LOCAL 행 원복), 서버 로그에 reason 원문 0.
- 회귀: **003g 54/54 · 006 42/42(p50 4.6s) · 007 44/44 · 008 74/74 · 010 65/65(A4 v7 실생성) · 011 60/60** · 005b 44/47(5c·5j·7c = 운영 gateway 기동 환경 차이, 기준 HEAD 에서도 동일 — R2 후속).
- **판정: QA PASS** → 012c 서버 1단계 + A4 v7 한 커밋으로 운영 반영. 운영 반영 뒤 006·007·008 운영 스모크로 Claude CLI 자식 env 허용 목록 가용성 재확인(REV-035 재검 권고).

### 2026-09-29 11:55 Leader(메인) — 서버 1단계 운영 반영
- `6abe464`(012c 서버 1단계 + task-010 A4 v7) push → webhook `RELEASE_RESULT ok`(릴리스 `20260929-084835-6abe464d`, migrated:false). health = degraded[`stt_analysis_worker`] 만(012b 워커 미등록 — 정상).
- 운영 스모크 `SMOKE_ENV=PRODUCTION`: **006 42/42(p50 4.4s) · 007 44/44 · 008 74/74 · 010 65/65** — Claude CLI 자식 env 허용 목록 운영 가용성 확인(REV-035 재검 권고 이행).
- D-C3 편집 선결 게이트 통과 → **서버 2단계(인계 절 2~6단계: configuration editable/validate/diff/versions/rollback·소유 층 tx 쓰기·admin editor/history·라우트·테스트) 착수**. 화면은 데모 승인 뒤(developer B).

### 2026-09-29 12:10 Leader(메인) — 서버 2단계 질문 판단
- **D-C14(Q-VP)**: `VoiceProfile` 은 environment 칸이 없는 전역 행(LOCAL 에서 고쳐도 운영 즉시 적용) → **목소리 기본값·표시명 편집은 012c-2 로 이관**(Voice 관리 #85·#86 과 함께 설계). 데모 결정 (5) 의 화면도 012c-2. 정본의 VOICE_PROFILE 편집 범위 표기는 Leader 가 정리.
- developer 진행 결정 채택: 편집 정책 = 어댑터 스키마 메타(consumer·verify·envPinned 등, 엔진명 누출 0) · connection `name` 편집 제외 · `credentialRef` 는 #93b 전용(config patch → 400 CREDENTIAL_ONLY) · #105 검증 매핑(LLM tier 프로브·TTS 합성·Fallback 새 primary/fallback 각각·AppSetting 미리듣기 = TTS 합성·검증 불가 = partial·표시 전용/끄기 = NOT_NEEDED).
- **교차 환경 쓰기 규칙(명시)**: 대상 environment ≠ 프로세스 환경이고 PRODUCTION 이면 바뀐 키가 **전부 NOT_NEEDED 일 때만** 허용, 아니면 403 — 코드로 강제·테스트. SUPER_ADMIN·confirm "PRODUCTION"·reason ≥10·감사 crossEnvironment.

### 2026-09-29 13:30 Leader(메인) — 서버 2단계 결과 판단
- **TTS `runtime.maxChars` 편집 닫음 확정**(developer 판단 채택) — 런타임 문장 분할이 100자 고정이라 값을 낮추면 51~100자 문장이 `TEXT_TOO_LONG` 으로 실패하고 기능 테스트가 못 잡는다. 재개 조건 = 분할기가 연결 값을 쓰도록 바뀔 때.
- PRODUCTION 경로는 단위 테스트로만 검증(운영 행 라이브 쓰기 금지) — 운영 반영 뒤 **U-C7(사용자 본인 SUPER_ADMIN 계정으로 운영 적용 리허설 1회)** 을 사용자 대기 목록에 유지(QA 계정은 운영에서 관리자 역할이 인정되지 않음). 화면이 없으니 실제 리허설은 화면 단계 뒤.
- 다음: REV-036 ∥ 정본 정리(Leader 에이전트) → judge C2 → (Codex) → QA → 운영 반영.
- [2026-09-29 12:00] codex_gate/C2 engine=jev → **codex_required=true** / wanted_before_budget=true / mode=adversarial-review / focus=security(0.95) / budget_rule=CX-limit-unknown-r2 / codex_switch=on / calls_used=2 | overrides=CX-r2-post-review | fallback=- | tokens=1365
  - Codex 호출 2/4. C1·C2 R2 R2 후기간(CX-limit-unknown-r2 — 한도 stale). 초점: security(confidence 0.95, high_risk_change noul 0.45, reviewer_doubt noul 0.28). 
  - 호출은 Leader(메인)가 한다. C2 감사 대상: 트랜잭션·동시성·TOCTOU 재검증, PRODUCTION 게이트 전 항목(testedKeys ⊇ 변경 키, reason 검증), reason 서식 문자(Cf·DIACRITIC), credentialRef 어댑터별 재검사, 발음 사전 reason 5경로 공용 적용.


- [2026-09-29 13:30] C2 adversarial-review focus=security(0.95) — done
  - judge 판정: [2026-09-29 10:15 Leader 지시] codex_required=true(adversarial-review · security) / 호출 차수: 3/4
  - 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=f4a3f32(task_file) · snapshot=f945bd7
  - 지적 2건:
    - [medium] src/modules/admin/configuration/history.ts:71 — **reason 필드가 공통 마스킹 경로를 우회해 영구 저장·재노출**. 관리자가 변경 사유에 토큰·암호·내부 경로를 입력할 때 ConfigurationVersion(`:67`)과 AuditLog(audit.ts:43) 양쪽에 평문 저장되고, 조회 응답(displayAny/maskString 처리 없이)에서 그대로 반환된다. before/after는 maskSensitive 로 마스킹되지만 reason 에는 미적용 → 저장 전 maskString 또는 비밀 유사 검사, 응답에서 공통 변환기 사용 필요
    - [medium] src/modules/admin/configuration/editor.ts:512 — **연결·fallback 정책 교차 행 경합**. 연결 비활성화는 EngineConnection 행만 FOR UPDATE 잠그고(`:516`), fallback 변경은 EngineFallbackPolicy 행만 잠근다(targets.ts:233). 두 트랜잭션이 상대 행의 이전 상태를 바탕으로 각각 커밋되면 활성 정책이 비활성 연결을 primary 로 가리키는 금지 상태가 만들어져 라우팅 중단 → 같은 트랜잭션에서 두 행을 같은 순서로 FOR UPDATE 잠그고 materialize 직전 재검증 필요
  - 검토하지 못한 범위: 실제 MariaDB 격리 수준에서의 동시성 재현 · 운영 nginx·쿠키 CSRF · 실제 외부 서비스 종단 검증 · STT·TTS 엔진 자체·네이티브 플러그인
  - 원본: /home/brownjeon/.claude/state/codex-review/runs/20260929T012531Z-task-012c-console-p2-C2/
  - **요약**: PRODUCTION 게이트(confirm·summaryHash·testResultId)·capability 검사(환경 기준)·baseVersion 재검사·credentialRef 허용 목록·스냅샷 대상 일치 등 주요 보안 게이트는 구현돼 있으나, reason 필드가 공통 마스킹을 회피해 민감정보 영구 노출 경로가 있고, 연결 상태 변경과 fallback 정책 변경 사이의 교차 행 불변식이 동시성으로 깨질 수 있음. 둘 다 실운영에서 재현 가능(reason = developer/admin 실수로 민감정보 입력 시 발동·경합 = 동시 2요청 정상 흐름).

**C1·C2 판정 종합**: Reviewer(REV-035) PASS(Low 2 = 유지보수성) + Codex C1(High 2) 3건 채택 후 코드 개선 + Codex C2(Medium 2) → **최종 판정 대기**(Reviewer 지적 채택·구현 여부 · Codex C2 지적 채택·미룰지 선결로 할지 · QA 재현 가능성 · 운영 배포 가능 여부 — Leader 메인 지시 필요)

### 2026-09-29 15:40 Leader(메인) — 서버 2단계 통합 QA PASS
- 격리 복제본 운영 모드(3011·3012 두 프로세스, `env -i`). tsc 0 · eslint 0 · build ok · 단위 **826/827(1 skip, 0 fail)**.
- 012c: 설정 편집 스모크 **53/53** · 경합 실측 `task012c-race.ts 10` **6/6**(교착 0) · 게이트 **26/26**.
- 트랜잭션 재시도 확장(P2010 안 1213) 영향 회귀: **012b 62/62(ABC) · 005b 47/47(R2 반영) · 003g 54/54 · 006 42/42 · 007 44/44 · 008 74/74 · 010 65/65 · 011 60/60 · 012 32/32**.
- **판정: QA PASS** → 커밋·운영 반영. PRODUCTION 적용 경로 실사용 리허설은 화면 단계 뒤 사용자 본인 계정(U-C7).

### 2026-09-29 16:00 Leader(메인) — 서버 2단계 운영 반영
- `8c22f01` push → webhook `RELEASE_RESULT ok`(릴리스 `20260929-112409-8c22f017`, migrated:false). health = degraded[`stt_analysis_worker`] 만(012b 워커 미등록).
- 운영 스모크 `SMOKE_ENV=PRODUCTION`: **006 42/42 · 007 44/44 · 010 65/65 · 011 60/60 · 012 32/32**(트랜잭션 재시도 확장 영향 없음).
- **012c 서버(1·2단계) 완료.** 남은 012c: 화면(데모 v2 사용자 승인 대기 → designer 가이드 → developer B) · 012c-2(Prompt Registry·Playground·Voice 관리+VoiceProfile 편집 D-C14 — 데모 필요) · 012c-3(TTS 품질 — DB 추가·U-C1) · U-C7(화면 뒤 사용자 본인 계정 운영 적용 리허설).

### 2026-10-01 09:20 developer B — 화면 구현
- **데모 게이트**: `check.mjs check --task task-012c` → `DEMO_GATE_PASSED` · approved v2 · hash verified. 기준 = 승인 데모 `docs/demo/task-012c-console-p2-v2.html`(결정 d1 B · d2~d6 A, d5 목소리 기본값은 D-C14 로 012c-2). `docs/screens.md` §13 구현 가이드는 아직 없어 데모를 직접 따랐다. commit·push·스키마·운영(3010·pm2·PRODUCTION 행) 무접촉.
- **산출(신규)**: `src/components/admin/configEditor/{ConfigScreen,FieldList,FlowBar,ApplySheet,EditorChrome,RawTab,DiffView,ConfigTestCard,ReasonFields,ConnectionEditPanel,ConnectionSheets,FallbackEditor,AppliedNote,ui}.tsx` · `{configAccess,configApi,configCopy,draft,flow,useConfigEditor,useWritePrep}.ts` · `src/components/admin/history/{HistoryScreen,ConfigVersionRow,ConfigVersionSheet,AuditTab}.tsx` · `{historyQuery,usePaged}.ts` · `src/app/(admin)/admin/history/page.tsx` · 단위 `src/components/admin/{configEditor/__tests__/{configEditor,flow},history/__tests__/history,lexicon/__tests__/reasonCopy}.test.ts` · 화면 E2E `tests/live/task012c-ui-e2e.mjs`.
- **산출(수정)**: `src/app/(admin)/admin/configuration/page.tsx`(ConfigScreen · `?scope=&target=&tab=`, 옛 `?target=` 링크 그대로) · `components/admin/console/{ConnectionDetailScreen(사용 여부 스위치·[설정 편집]·[비밀 참조 연결]·끄기/켜기·비밀 참조 시트),RoleScreen([순서 편집] → FallbackEditor),EffectiveSummaryCard(&tab=effective),SecretsSheet(사용 중 참조만 — A 1단계 5번),labels(메뉴 설명 2)}` · `configEditor/EffectiveScreen.tsx`(`EffectivePanel` 추출 — 동작 동일) · `src/modules/admin/console/menu.ts`(configuration 탭 form·raw·diff + history phase 1 — 내 hunk 만, A 변경 없음 확인) · 발음 사전 R1(`lexicon/{kana,lexiconCopy}.ts` — 운영 이유 10자 요청 전 검사·`E_REASON_SECRET_LIKE`/`E_REASON` 문구, 옛 기대값 2줄 `kana.test.ts`).
- **구현 요점**: 권한 갈래는 순수 `configAccess`(읽기 전용 / ADMIN Form / DEVELOPER +Raw JSON / 운영 비 SUPER = 초안·요약까지(적용 단계 🔒, 버튼 DOM 없음) / SUPER 운영 = 확인 창 PRODUCTION 입력) · 비밀 참조 연결은 SUPER 만, 값 입력 칸 0(#101 allowedFor ∩ 있음, 없는 허용 ref 는 이름만) · Form↔Raw JSON 단일 초안(`useConfigEditor` — Raw 기준 = 저장값, 저장 문서에 늘 있는 칸은 그대로면 변경 아님, 지운 저장 키 = 화면 required, 가림 값 `***` 문서는 JSON 편집 안 엶) · 적용 막대 = 순수 `flowView`(개발 테스트 건너뛰기·일부만 확인 이어가기, 운영 테스트 필수·partial 적용 불가) · 쓰기 실패 = 순수 `writeErrorView`(409 충돌 → [최신 값 기준으로 다시 비교](초안 유지)·요약 불일치·기본 연결 / 403 확인 문구·테스트(detail 8종)·권한 / 422 이유 비밀 유사·손상) · 운영 한 번 쓰기(켜기/끄기·비밀 참조·되돌리기)는 `useWritePrep` 가 같은 후보로 #106 요약 해시 + (필요 시) #105 테스트 결과 id 를 붙인다 · 이력 = 버전(대상 칩·기준선·기록 손상·되돌림 표시·상세 직전/지금 비교·되돌리기 = 새 버전) + 감사(분류·기간·작업·사람·SUPER 환경, 행 펼침 키마다 전 → 후, DEVELOPER+ 원문 JSON, 옛 발음 사전 기록) · 적용 막대는 `fixed`(본문 폭, ≥1024 사이드바 오른쪽) + 본문 끝 빈 자리. 엔진명 하드코딩 grep 0(DTO 표시명만).
- **검증**(공유 미러 tsc·단위, 하드링크 복제본 `~/.node-local/thekaiwa-012c` dev 3023 `env -i … APP_ENV=LOCAL`, 끝나고 종료·복제본·QA 쿠키 삭제): tsc 0 · eslint 오류 0(경고 1 = 기존 DiagnosticsScreen) · 신규 단위 26/26(+ 발음 사전 기존 기대값 갱신 1) · 미러 전체 1018: 1016 pass·1 skip·**1 fail = `brand.test.ts`(task-021 WIP android versionCode 3 — 내 변경 밖)** · `flock … npm run build` exit 0(경고 = 기존 claudeCli 추적) · **화면 E2E 78/78**(USER 404·무세션 307 · ADMIN 탭 3개/Raw JSON·비밀 참조 연결 DOM 0 · DEVELOPER Form↔Raw 양방향·문법 오류 잠금·unknownKey 줄 표시·제안 바꾸기 · 적용 v1 기준선+v2 DB 대조·이유 필수 · 409 다시 비교 초안 유지 · 이력 기준선 상세·되돌리기 v4(v1)·v3 되돌려짐 · 감사 펼침 · 예비 순서 요약(버림, 쓰기 0) · 연결 편집 모드 · 기본 연결 끄기 409 · SUPER 비밀 참조 시트 입력 0 · 360/390/412/1280 × 6화면 넘침 0·누를 것 ≥44px·콘솔 오류 0 · Z 원복: LOCAL 대상 행 바이트 대조·설정 버전 0/0). 외부 호출 0(실행 검증 방법 없는 키만 바꿈). AuditLog(QA 역할 계정, LOCAL)는 불변이라 남음.
- **판단(데모와 다르게 한 점 — 의미 유지, Leader 확인 요청)**: ① 감사 분류 칩 = 전체·연결·예비 순서·운영 설정·발음 사전(데모의 목소리·조회·권한 거부 제외 — 목소리는 012c-2, "조회"는 서버 필터 한 번으로 못 묶어 [필터 더 보기 › 작업]에 `secrets.read_ref`·`config.raw.read` 로, 권한 거부는 서버가 감사로 남기지 않음) · 분류별 개수·결과 뱃지 생략(서버가 주지 않음/모두 성공 행) ② 예비 순서 편집에 "실패하면 다음 연결로 한 번 다시 시도" 스위치 없음(서버 NOT_CONSUMED 잠금 — 글자로만) ③ Form 에서 `enabled` 칸은 숨김(연결 상세 스위치 #93a 로) ④ 운영 설정 키 목록은 화면 상수(`APP_SETTING_KEYS` = api-contract #123b 9키) — 목록 API 가 없다. #123b DTO 에 min·max·maxLength 가 없어 운영 설정 칸은 범위 표시 없이 서버 검증으로만 ⑤ 대상 요약의 "마지막 적용 n시간 전"은 생략(편집 정책 DTO 에 시각 없음) ⑥ 기본 탭 = Form(데모), 설정값 요약 카드의 "설정값 전체 보기"는 `&tab=effective` 로 기존 Effective 보기 유지 ⑦ 발음 사전 R1 은 developer B 후속(08:10 Leader)이라 같이 처리.
- **Leader 확인 요청**: (a) 위 ①~⑥ 수용 여부 (b) `docs/screens.md` §13 가이드(designer) 작성 시 이 구현과 맞출 것 (c) #123b DTO 에 `min/max/maxLength/nullable` 추가 또는 운영 설정 목록 API(선택, developer A) (d) PRODUCTION 확인 창·운영 잠금·되돌리기 운영 흐름은 QA 역할 토큰이 운영에서 인정되지 않아 **단위(flowView·configAccess·writeErrorView·ReasonFields 렌더)로만** 확인 — U-C7 사용자 리허설에서 실화면 확인 필요.
- **남은 위험**: ① 화면 E2E 의 PRODUCTION 경로 라이브 미확인(위 d) ② 적용 막대 `fixed` 는 콘솔 셸 사이드바 폭(232px)을 상수로 가정 — 셸 폭이 바뀌면 같이 바꿔야 함 ③ Raw JSON 편집은 가림 값 문서에서 열지 않음(현재 LOCAL 연결 6개 중 해당 0) ④ 감사 기간 기준 시각은 화면을 연 시각(하루에 한 번 갱신) ⑤ 다른 task 의 빌드가 한때 내 `flow.ts` 초기 상태(정규식 이스케이프)로 막혔음(task-012 09:08 기록) — 09:0x 에 고쳤고 지금 build exit 0.

## Reviewer 기록 (Codex C2 판정, REV-056)

대상: `## Codex 검토` `[2026-10-01 04:47] C2`(adversarial-review · security) 지적 1건. 코드 무수정(Read 전용) · 근거는 파일:라인.

### 판정: 부분 채택 — Medium (Codex 의 High 는 과대)

**지적 요지**: `validate.ts:105` 의 일반 STRING/JSON 값에 평문 비밀(`password=…`·`token=…`) 검출이 없고, `commitEdit` 가 그 값을 설정·ConfigurationVersion snapshot/diff·AuditLog before/after 에 평문으로 넘긴다. `voice.preview.defaultText` 는 TTS 합성 입력이기도 하다.

**사실 확인 (사실 맞음 / 일부 틀림)**
- 맞음 — `checkEditValue`(`validate.ts:105`)는 STRING/PATH/URL/ENUM 에 타입·길이·URL 프로토콜·`def.pattern` 만, JSON 은 `JSON.stringify(v).length > 8_000`(`:145`)만 본다. `isSecretLikeText` 호출은 `infra/reason.ts:65`(`checkReason`) 한 곳뿐이고 그 소비자는 `editor.ts:486`(`requireReason`)·`admin/speech/lexicon.ts:114` 두 곳 — **값 검증 경로 0건**. 비밀 평문 거부(`secretValue`)는 SECRET_REF 키(`validate.ts:152-160`)에만 있다.
- 맞음 — 저장 경로: `commitEdit`(`editor.ts:479`) → `writeVersion`(`versions.ts:63-64`) 은 `snapshot: json(input.snapshot)`·`diff: jsonOrNull(input.diff)` 를 **마스킹 없이** 저장(롤백 원본이라 의도된 정확 보존). `recordAudit`(`audit.ts:28,44`)는 before/after 를 `maskSensitive`, reason 을 `maskText` 로 가리지만 `mask.ts:21-26` `looksSecret` 는 **문자열 전체**가 `sk-`·`ghp_`·JWT·hex/base64 32자↑ 모양일 때만 잡는다 → `password=hunter2`·`token: abc` 같은 키=값 문장은 AuditLog 에도 남는다.
- 틀림(과장) — "AuditLog 에 평문 그대로"는 아님(위 부분 마스킹 존재). `x-` 키는 `validatePatch`(`validate.ts:196-199`)가 경고만 내고 `candidateOf`(`editor.ts:156`)가 `defs` 에 있는 키만 후보에 넣어 **snapshot·audit 에 도달하지 않는다** — 저장 경로 아님(문구 "보존만 합니다"가 틀린 것은 별건 Low, REV-054 L-2).
- 도달면 좁음 — 어댑터 스키마 전수: 편집 가능한 자유 문자열은 **`voice.preview.defaultText`(≤100자, pattern 없음, `appSettingSchema.ts:12,34`)** 하나. 모델명 키(`claudeCli` `runtime.modelByTier.*`·`homeM4` `runtime.model`)는 `^[A-Za-z0-9._:-]{1,60}$` 류 pattern 이라 공백·`=` 불가하나 **`ghp_…`·`sk-…`(≤60자)는 pattern 을 통과**한다. SBV2 `runtime.defaultModel` 은 pattern 없지만 consumer 미지정 → `NOT_CONSUMED` 잠금(편집 불가). JSON 키는 `fallbackConnectionIds`(연결 id 의존 검사)뿐.

**심각도 근거 (High 아님 · Low 아님)**
- 낮추는 요인: 입력자가 이미 `config.edit` 보유(ADMIN+)이고 본인이 비밀을 직접 쳐야 함 · 대상이 일본어 안내 문장 칸 1개 · 정본에 일반 값 DLP 요구 없음(`configuration-resolution.md` 는 SECRET 키 = ref 만, reason 검사만 규정).
- 올리는 요인: CLAUDE.md 금기 "ConfigurationVersion·AuditLog 에 Secret 싣기" · snapshot 은 영구 보존·롤백 가능이라 한 번 들어가면 못 지움 · 같은 비밀을 reason 에 쓰면 이미 422 로 막으므로 **같은 사람이 같은 값을 value 에 쓰면 통과하는 비대칭** · 미리듣기 문장은 TTS 서버로도 나간다.
- 결론: Critical·High 요건(비권한자 악용·실제 유출 경로) 미충족 → **Medium**. 단 채택 전 방치하지 않는다.

### 최소 수정 (Developer 범위)
1. **`src/modules/engine/configuration/validate.ts` `checkEditValue`** 한 곳에 비밀 유사 검사 추가(`isSecretLikeText` 는 `@/modules/infra` index 에서 import — 6층 위반 아님). 모든 쓰기 진입점(Form #93/#107 · Raw #110/#111 dryRun 포함 · AppSetting PUT #123b · Test/Validate #105/#109 · Rollback 재검증)이 `validatePatch` 를 지나므로 한 곳이면 전부 덮인다.
   - STRING/PATH(+ pattern 있는 모델명 키): 값에 검사. JSON: 모든 문자열 잎 + **객체 키**를 재귀(깊이 ≤8, 배열 ≤200).
   - `TOKEN_RUN`(24자↑ 혼합 문자열) 규칙은 **id·모델명 키에는 적용 금지**(`zipformer-ja-reazonspeech-2024-08-01-int8` 류 오탐). pattern 키는 접두(`sk-`·`ghp_` 등)·JWT·KEY_VALUE 부분만, 자유 문장 키(`voice.preview.defaultText`)는 전체 규칙. → `isSecretLikeText` 를 쪼개 쓰려면 `infra/reason.ts` 에 변형을 export 하지 말고 `validate.ts` 쪽에서 감싸되, 불가하면 Leader 판단(범위 확장).
   - 응답: 기존 `secretValue` 규칙 재사용, `400 VALIDATION {stage:'SCHEMA', errors:[{key, rule:'secretValue', message:'비밀처럼 보이는 글자가 있어 저장하지 않았어요.'}]}`. **값·`actual` 에코 금지**, 로그에도 값 0.
2. **회귀 테스트(신규, `engine/__tests__`)**: 미리듣기 문장 `password=hunter2`·`token: abc` 거부 · JSON 중첩 잎·객체 키 · 전각(`ｐａｓｓｗｏｒｄ＝x`) · 제로폭 분할(`pass​word=x`) · `sk-`·`ghp_` 접두(모델명 키 포함) · 정상 일본어 문장·기본 문장·정상 모델 id 는 통과 · Raw dryRun·AppSetting PUT 도 거부 · 거부 시 version·audit 행 0 · 응답에 입력 값 0 · `x-` 키가 snapshot/audit 에 안 들어감 단언.
3. **범위 밖(과잉 수정 금지)**: snapshot/diff 마스킹(롤백 원본 손상) · `recordAudit`·`maskSensitive` 규칙 변경 · `infra/reason.ts` 규칙 수정 · 신규 DLP 라이브러리 · UI 문구 외 화면 변경. 이미 저장된 과거 값이 있는지는 코드로 알 수 없으니 Leader 가 LOCAL 행을 읽기 전용 조회로 1회 확인(운영 DB 접근 금지 준수).
4. 부수(Low, 같은 수정에 묶어도 됨): `validate.ts:197` 경고 문구 "저장 문서에 보존만 합니다" → 실제 동작(저장 안 됨)에 맞게 정정(REV-054 L-2 와 동일).

### 리뷰 JSON
```json
{
  "reviewId": "REV-056",
  "status": "CONDITIONAL_PASS",
  "issues": [
    { "issue": "일반 STRING/JSON 설정 값에 비밀 평문 검출 없음 — ConfigurationVersion snapshot/diff 영구 저장, AuditLog 는 전체 문자열 모양만 마스킹", "severity": "MEDIUM", "component": "src/modules/engine/configuration/validate.ts:105,145 · src/modules/admin/configuration/editor.ts:479-549 · src/modules/engine/configuration/versions.ts:63-64", "risk": "관리자가 voice.preview.defaultText 등에 password=…/token: … 를 넣으면 롤백 가능한 영구 snapshot 과 AuditLog 에 남고 TTS 로도 전송(reason 은 같은 값 422 라 비대칭)", "evidence": "isSecretLikeText 호출은 infra/reason.ts:65 한 곳뿐(소비자 editor.ts:486, lexicon.ts:114 — 값 검증 0건); checkEditValue 는 길이·pattern 만; mask.ts looksSecret 는 문자열 전체 기준; 자유 문자열 편집 키는 voice.preview.defaultText 1개(모델명 키는 pattern 통과 ghp_/sk- 가능)", "recommendation": "checkEditValue 에 재귀 비밀 유사 검사(자유 문장 키 전체 규칙·pattern 키는 접두/JWT/KEY_VALUE 만), 400 secretValue·값 비에코, 회귀 테스트(NFKC·제로폭·중첩 JSON·Raw dryRun·PUT #123b). snapshot 마스킹·audit 규칙 변경은 하지 않음" },
    { "issue": "Codex 'x- 키 경로' 부분은 오탐 — x- 키는 candidateOf 에서 탈락해 snapshot/audit 미도달 (문구만 부정확)", "severity": "LOW", "component": "src/modules/engine/configuration/validate.ts:196-199 · src/modules/admin/configuration/editor.ts:156", "risk": "경고 문구 '보존만 합니다'가 실제(저장 안 됨)와 다름", "evidence": "candidateOf 가 defs 키만 후보에 포함", "recommendation": "문구 정정(REV-054 L-2 와 같은 건)" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 1 },
  "high_risk_areas": [
    "(신규) 미리듣기 문장·모델명·JSON 값에 password=/token:/sk-/ghp_ 입력 → 400 secretValue·version/audit 행 0·응답/로그 값 에코 0, 정상 일본어 문장·모델 id 오탐 0",
    "(신규) 같은 거부가 Form·Raw(dryRun 포함)·PUT #123b·Test 모두에서 동일 동작, 전각/제로폭 변형 우회 불가",
    "(신규) 이미 저장된 snapshot 에 해당 값이 있을 때 Rollback 응답(E_SNAPSHOT_INTEGRITY) 과 화면 안내",
    "Raw 편집 후 Form 변경 → 적용 본문 = 변경 요약(M-1 회귀)",
    "변경 요약 뒤 Raw 를 고친 직후(300ms 이내) [적용] — 차단 안내와 요약 재생성",
    "Raw 에 __proto__·constructor·prototype 키 → 오류·적용 불가(L-1 회귀)",
    "409 [최신 값 기준] 뒤 Raw 켠 채 적용 — 요약 일치·안내",
    "요약 요청 진행 중 초안 변경(비 PRODUCTION 에서 낡은 요약 적용 가능, REV-054 L-1)",
    "Raw 의 x- 키(최상위·중첩) 적용 결과와 안내 문구",
    "PRODUCTION 확인창·SUMMARY_MISMATCH·ConfigurationVersion+AuditLog(운영 경로 라이브는 U-C7)"
  ],
  "native_change": false
}
```

**다음**: Codex 지적 **채택(부분)** → Developer 수정(위 1~2, 파일 `validate.ts` + 신규 단위 테스트) → **Reviewer 부터 재순환**. QA 는 수정 재감사 PASS 뒤 진행(이번 REV-056 자체는 Critical 0 · High 0 — Leader 에스컬레이션 조건 미해당). 화면 변경 없음 — 데모 게이트 재검토 불필요.

## Leader 기록 (REV-056 후속, 2026-10-01 15:40)

- REV-056 이 요청한 "이미 저장된 비밀 의심 값" 확인: 읽기 전용으로 `ConfigurationVersion` 전체를 훑었다(값은 출력하지 않고 개수만) — **전체 0행**(편집 경로로 저장된 버전이 아직 한 건도 없음) → 기존 snapshot·diff 에 평문이 남은 사례 없음. AuditLog 설정 대상 행 조회는 열거값이 달라 실패했으나, 설정 편집 커밋이 0건이라 이 경로로 쌓인 감사 행도 없는 것이 맞다(필요하면 QA 가 감사 행 0 을 다시 확인).
- 조치: Developer 에게 REV-056 최소 수정(`validate.ts` 재귀 비밀 유사 검사 + 회귀 테스트 + RawTab 의 `x-` 안내 문구 한 줄) 배정 → 완료 후 **Reviewer 부터 재순환**. 나머지 REV-054 Low(응답 세대 가드·409 뒤 Raw 글 잔존·사이드바 폭 등)는 이번 수정 범위 밖.

## Developer 기록 (REV-056 수정)
- [14:11] REV-056 최소 수정 완료(판정 그대로, 근거 재논의 없음). 데모 게이트 `check` = `DEMO_GATE_PASSED` / `task: task-012c`(approved v2) — 화면 파일은 RawTab 문구 한 줄만.
  - **바뀐 파일**: `src/modules/engine/configuration/validate.ts`(`checkEditValue` 에 비밀 유사 검사 · `x-` 경고 문구 "저장하지 않고 적용하지도 않습니다"(REV-056 ④) · 머리 주석) · `keys.ts`(`EditKeyDef.freeText?` 선택 칸) · `appSettingSchema.ts`(미리듣기 문장만 `freeText: true`) · `src/components/admin/configEditor/RawTab.tsx:138` 문구 "맨 바깥의 x- 로 시작하는 키(예: x-note)는 메모로 둘 수 있지만 저장되지 않아요."(레이아웃 무변경) · 신규 `src/modules/engine/__tests__/task012c-secret-value.test.ts`. `infra/reason.ts`·`mask.ts`·`audit.ts`·`recordAudit`·snapshot 저장은 무변경.
  - **규칙**: 판정 함수는 `@/modules/infra` index 의 `isSecretLikeText`·`reasonCheckForm` 재사용(engine→infra 허용 방향, 새 규칙 0). `freeText` 키 = 전체 규칙. 그 밖(pattern 모델명·id, pattern 없는 모델 버전·경로·주소, JSON 잎) = **긴 토큰 규칙만 제외** — reason.ts 를 쪼개지 않고 판정용 형태(NFKC·폭 0 삭제·공백 접기)를 23자 창으로 잘라 넘긴다(긴 토큰은 24자↑에서만 걸리고, 나머지 규칙의 최소 일치는 경계 포함 ≤20자). 창 앞에 숫자 `0` 을 붙여 창 시작을 문자열 시작(`^` 경계)으로 오인하지 않게 함(`mytask-abcdefgh…` 오탐 방지 테스트). JSON = 문자열 잎·객체 키·`키: 문자열 값` 짝(`{"password":"hunter2"}` 대응), 깊이 >8·배열 >200 은 `type` 거부(다 못 본 값 통과 금지). 거부 = `{key, rule:'secretValue', message:'비밀처럼 보이는 글자가 있어 저장하지 않았어요.'}` — expected/actual·JSON 경로 없음.
  - **호출 경로 확인**: 쓰기 진입점 전부 `validatePatch`→`checkEditValue` — #104 validateConfig·#106 diffConfig·#105 testConfig(합성 전)·#107 applyConfig·#111 putRawConfig(dryRun 은 직접 validatePatch, 적용은 commitEdit)·#93 updateConnectionForm·#93a setConnectionEnabled·#93b(SECRET_REF 경로, 별도)·#100 updateFallbackPolicy·#123b putAppSetting·#108 Rollback(restorePlan→planRestore 의 `snapshotValueIssues` 가 스냅샷 전체 값에 checkEditValue + validatePatch, 이어 commitEdit 재검증). 설정 값을 쓰는 다른 경로는 `materialize`(commitEdit 안)뿐 — 추가로 막을 진입점 없음.
  - **단위**: 신규 10/10 · engine+admin+configEditor+infra 묶음 224/224 · 전체 1105 중 1102 pass·1 fail = `speech/modelPackage.test.ts` ENOENT(개인 미러에 `plugins/` 픽스처 미동기화) → 동기화 후 그 파일 6 pass/0 fail. tsc 0 · eslint(변경 파일) 0. 변이 검사 3종(검사 끔 → 5 fail, 창 `0` 제거 → 1 fail, 전 키 전체 규칙 → 6 fail)으로 테스트가 실제로 잡는 것 확인.
  - **오탐 전수**: 어댑터 스키마 기본값 전부(5 엔진 × 연결 종류) · `prisma/seed-data/engines.json` 6 연결의 평면 값 · Fallback·AppSetting 기본값 → secretValue 0, 시드 스냅샷 `snapshotIntegrity` OK. 모델 id(`claude-3-5-sonnet-20241022`·`claude-sonnet-4-5-20250929`·`qwen2.5:14b-instruct-q4_K_M` 등)·`zipformer-ja-reazonspeech-2024-08-01-int8`·긴 경로 통과.
  - **라이브**(개인 미러 `~/.node-local/thekaiwa-dev-012csec`, `cp -al` node_modules, dev **3045** `-H 127.0.0.1` `APP_ENV=LOCAL`, QA developer 쿠키, 스크래치 스크립트 — tests/** 미추가): **13/13 PASS** — R1 Raw dryRun·R2 Raw 적용·R3 #123b PUT(전각)·R4 #104(폭 0 → valid:false)·R5 #106·R6 #105(TTS 합성 전)·R7 #107·R8 Raw dryRun 모델명 ghp_·R9 #93 Form sk-·R11 #100 JSON 잎 → 전부 400 `secretValue`·응답 에코 0, R10 긴 모델 id dryRun 200 + 최상위 `x-note` 변경 목록·응답에 없음, R12 ConfigurationVersion 0→0 · R13 AuditLog 0→0(추가로 최근 15분 LOCAL 버전(QA dev·actor 없음) 0·감사(QA dev) 0) · dev 로그 입력 값 0건. **DB 쓰기 0** — 삭제할 행 없음. 쿠키 삭제·서버 종료·미러 삭제 완료.
  - **트러블슈팅**: ① 개인 미러 node_modules 를 심볼릭 링크로 두면 `next dev` 가 Turbopack panic("Symlink [project]/node_modules is invalid, it points out of the filesystem root") → `cp -al ~/.node-local/thekaiwa/node_modules` 로 해결(테스트·tsc 는 링크로도 됨). ② `pkill -f "next dev -p 3045"` 가 자기 셸 명령줄까지 맞아 셸이 죽음(exit 144) — 포트로 PID 를 찾아 끌 것.
  - **남은 위험·Leader 확인**: (a) 이미 저장된 스냅샷에 비밀 유사 값이 있으면 그 버전 되돌리기는 이제 422 `E_SNAPSHOT_INTEGRITY`(목록 INVALID_ENTRIES) — REV-056 ③ LOCAL 읽기 조회 대기. (b) 비자유 문장 키는 접두 없는 고엔트로피 토큰(40자 난수 등)을 통과시킴 — 판정 지시대로의 의도된 경계. (c) JSON `키: 값` 짝 검사는 잎·키 훑기보다 한 걸음 넓음 — 지금 JSON 키(예비 연결 id 목록·allowedTasks)엔 오탐 0, 나중에 `token`·`secret` 이름 키에 문자열 값을 갖는 JSON 설정이 생기면 거부됨(숫자 값은 제외). (d) 창 크기 23 은 reason.ts 규칙의 최소 일치 ≤20자에 기댄다 — reason.ts 에 더 긴 접두 규칙이 생기면 `NO_LONG_TOKEN_WINDOW` 재검토. (e) 기존 동작(범위 밖): 형식이 틀린 키는 `unknownKey` 오류에 키 이름 앞 40자를, `x-` 경고는 키 이름을 요청자에게 되돌려줌(저장 0). Raw 의 중첩 `x-`(예: `runtime.x-note`)는 서버가 unknownKey 로 거부하는데 클라이언트 초안은 무시 — REV-054 쪽.
  - **정본 반영 요청(Leader)**: api-contract §2-23 `secretValue` 의미를 "SECRET_REF 평문 + 일반 STRING/PATH/URL/JSON 값의 비밀 유사 문자열"로 · role-permission §7 ③ 판정 규칙의 적용 대상에 설정 값 추가(자유 문장 키 전체 규칙, 그 밖은 긴 토큰 제외) · `EditKeyDef.freeText`. native_change 없음.

## Reviewer 기록 (REV-056 수정 재감사, REV-059)

- [14:25] **REV-059 = PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 6). 범위: REV-056(Codex High → Medium 부분 채택) 수정의 좁은 재감사. 코드 수정 0 · DB 쓰기 0 · 커밋 0(Read 전용 + 개인 미러 `~/.node-local/thekaiwa-rev-059` 실행). Developer 주장(단위 10/10·라이브 13/13·DB 쓰기 0·변이 3종·오탐 0)은 근거로 쓰지 않고 아래 **내가 실행한 것**만 판정 근거로 삼았다.

### 내가 실행한 증거 (개인 미러, 작업 트리 복사본)
| 항목 | 결과 |
|---|---|
| 신규 `engine/__tests__/task012c-secret-value.test.ts` | **10/10 pass** (cwd = 미러 루트 — 시드 훑기 테스트가 `process.cwd()/prisma/seed-data/engines.json` 을 읽음) |
| engine+admin+infra+components/admin 묶음 | **288/288 pass** |
| 전체 스위트 | **1111 중 1108 pass · 0 fail · 3 skipped** (1차 93 fail 은 미러에 `.claude/agents/tutor.md` 누락 — 환경 문제, 동기화 후 재실행) |
| `tsc --noEmit` | **exit 0** · eslint(변경 7파일) **exit 0** |
| `infra/reason.ts`·`mask.ts`·`audit.ts` | `git diff` 0줄(재사용만, 무수정 확인) |
| 독립 오탐 전수(내 스크래치 테스트) | 어댑터 기본값·enum·Fallback·AppSetting **176개 값 → `secretValue` 0건** |
| 라이브 읽기 전용 DB 조회 | 연결 12개·값 122개·AppSetting 12행 → 비밀 유사 0건 · `ConfigurationVersion` 0행 · 쓰기 0 |
| **변이 검사 8종**(Developer 3종의 상위) | M1 검사 호출 삭제 → 5 fail · M2 창 24(긴 토큰 규칙 재활성) → 6 fail · M3 창 앞 `'0'` 삭제 → 1 fail · M5 `키: 값` 짝 검사 삭제 → 1 fail · M6 객체 키 검사 삭제 → 1 fail · M7 깊이 초과 LIMIT→통과 → 1 fail · M8 `freeText` 무시 → 1 fail · **M4 판정용 형태(NFKC·폭 0 삭제) 생략 → 0 fail(생존)** → 아래 L6. 복원 후 `cmp` 일치·10/10 재확인 |
| 폭 0 삽입 우회(실제 코드) | `github_pat_…`·`sk-…`·`ghp_…`·`xoxb-…`·`AKIA…`(대문자)·`bearer …`·`password: …` 에 글자마다 U+200B 삽입 → STRING·JSON 모두 `secretValue`. (`AKIA`+소문자는 평문이어도 규칙 밖 — reason.ts 규칙 그대로) |
| 데모 게이트 `check` | `DEMO_GATE_PASSED`(task-012c, approved v2, hash verified). `evidence.jsonl` 승인 줄 = 08:17:28(사용자 프롬프트 08:17:13 와 대응, 이후 파일 갱신 없음) · 에이전트가 승인·waive 를 대신 실행한 흔적 없음. 이번 수정의 화면 변경 = `RawTab.tsx:137-139` 문구 한 줄(레이아웃·구조 불변) → 분류 **implementation**(material 아님) |

### 6개 항목 판정
1. **쓰기 진입점 전수 — 우회 없음.** #104·#105·#106·#107·#111(dryRun 은 `validatePatch` 직접, 적용은 `commitEdit`)·#93·#93a·#100·#123b 모두 `commitEdit`(`admin/configuration/editor.ts:487` `validatePatch`) 또는 `validatePatch` 직접 경유. `configurationVersion` 쓰기는 `engine/configuration/versions.ts:41·58-59` 뿐이고 호출자가 `commitEdit` 하나. Rollback 은 `restorePlan`(`editor.ts:269-285`)→`planRestore`(`rollback.ts:70-92`)→`snapshotValueIssues`(`rollback.ts:26-44`)로 한 번, 이어 `commitEdit` 재검증으로 한 번 — 이중. 잠긴 키도 `continue` 하지 않아 값 검사가 돈다(`validate.ts:256·261` 의 `sameValue` 건너뜀은 바뀌지 않은 키만). URL 키는 `vetConnectionUrl`(userinfo·사설망 밖 거부) 추가 경유. `x-` 키는 경고 후 `candidateOf` 가 버려 저장 0(`validate.ts:252-254`).
2. **우회 시도 — 결함급 없음.** 규칙 경계(자유 문장 = 전체 규칙 `validate.ts:129`·그 밖 = 긴 토큰만 제외)가 의도대로 작동한다. 폭 0·NFKC(전각 `ｓｋ－…`)·대소문자·공백 접기·JSON 키 위치·깊이 9·배열 201·8KB 초과가 모두 거부 또는 `type` 거부(fail-closed)다. `키: 값` 짝 검사 오탐은 시드·어댑터 기본값·AppSetting 에서 0(위 176+122). 남는 틈은 L1(정책상 수용).
3. **정보 누출 — 없음.** 거부 응답은 `{key, rule:'secretValue', message(고정문)}` 뿐이며 `expected`/`actual`·JSON 경로·입력 조각 없음. `infra/http.ts:83-100` 은 `ApiError.details` 를 로그에 쓰지 않고 INTERNAL 만 `name: message`. 설정 경로에 `console.*` 없음. `parseRawJson`(`editor.ts:672-686`)은 줄·열만. 감사는 `recordAudit` 가 `maskSensitive`/`maskText` 로 before/after/reason 을 한 번 더 가린다(2차 방어 — `mask.ts` 는 `authorization|cookie` 키 이름도 가림).
4. **Rollback 부작용 — fail-closed 로 안전, 영구 정체는 아님.** 저장된 스냅샷에 비밀 유사 값이 있으면 그 버전 되돌리기는 422 `E_SNAPSHOT_INTEGRITY`(`editor.ts:280`)·쓰기 0. 운영자에게는 보인다: `ConfigVersionSheet.tsx` `DamagedNote`(L69)·`isIntegrityErr`(L33)가 시트에서 "되돌릴 수 없음" 배지·안내를 띄우고, 흐름 알림은 `flow.ts:218`. 새 값을 직접 편집해 저장하는 **앞으로 가는(roll-forward) 편집은 막히지 않는다**(`validatePatch` 는 바뀐 키만 본다). 라이브 조회상 현재 `ConfigurationVersion` 0행이라 **실제 발생 0건(가정 사례)**. 권고는 아래 Leader 절.
5. **회귀 — 없음.** 위 표(1111/1108/0/3, tsc 0, eslint 0, 오탐 0). Developer 의 "1105 중 1 fail"(`modelPackage` ENOENT)은 개인 미러 픽스처 문제로 같은 환경 아티팩트다 — 코드 결함 아님.
6. **QA `high_risk_areas`** — 아래 JSON.

### 발견
| ID | 심각도 | 위치 | 내용 · 근거 | 권고 |
|---|---|---|---|---|
| L1 | Low | `validate.ts:129·183`, `scanJsonSecret` L132-150 | 정책상 수용된 틈(reason.ts 규칙과 동일 경계). URL 인코딩(`%73k-…`)·유사 문자(키릴 `ѕ` 등)·분할(두 필드에 나눠 담기)·한국어 "비밀번호:"·`{Authorization:"짧은값"}`(KEY_VALUE 에 `authorization` 없음 — 다만 `mask.ts` 가 감사 쪽에서는 가림)·비밀 이름 JSON 키 아래 **숫자** 잎·16진수/2종 문자 24자↑ 토큰·비자유 키의 접두 없는 고엔트로피 토큰. 사실상 편집 가능한 자유 값 표면이 `voice.preview.defaultText`(maxLength 100)와 `fallbackConnectionIds` JSON 뿐이고 나머지 STRING 은 잠겨 있거나 pattern 으로 묶여 있다 | 조치 불요. 새 자유 STRING/JSON 키를 추가할 때 `freeText` 지정 여부를 리뷰 체크 항목으로 |
| L2 | Low | `validate.ts:256·261`, `versions.ts` baseline | 바뀌지 않은 키는 `validatePatch` 가 재검증하지 않아, 기준선(v1) 스냅샷이 **이미 저장돼 있던 값**을 그대로 복사한다. 새 쓰기 경로는 아니고 라이브 전수 조회에서 0건 | 조치 불요. 첫 편집 직전 기준선 값 검사(`snapshotValueIssues`)를 한 번 더 두면 방어 심도가 올라가나 필수 아님 |
| L3 | Low | `flow.ts:218` | "기록이 손상돼 이 버전으로는…" — 비밀 유사 값 때문에 막힌 경우는 손상이 아니라 "지금 규칙에 맞지 않는 값"이다. 시트의 `DamagedNote`(L69)는 "깨졌거나 지금 규칙에 맞지 않는 값이 있어요"로 정확 | `flow.ts:218` 을 시트와 같은 문구로 맞춤(문구 한 줄, 레이아웃 무변경) |
| L4 | Low | `validate.ts:111`(`NO_LONG_TOKEN_WINDOW = 23`), `reason.ts:39-43` | 창 23자는 "reason.ts 규칙 최소 일치 ≤20자(경계 포함)"에 기댄다. 규칙 길이를 지키는 **가드 테스트가 없어** `reason.ts` 에 더 긴 접두 규칙이 생기면 비자유 키에서 조용히 우회된다. 현재 최장 = `github_pat_`+8 = 19자+경계 1 = 20 | 가드 테스트(알려진 최장 접두 규칙 입력이 창 안에서 잡히는지) 추가 또는 `role-permission §7 ③` 에 "접두 규칙 ≤20자 유지" 한 줄 — Developer 기록 (d) 와 같은 취지 |
| L5 | Low | `history.ts:147` | 손상된 버전의 상세(비교)가 422 라 운영자가 **무엇이 문제인지 diff 로 못 본다**(`issues` 는 응답 details 에 있으나 시트에서 키 목록으로 보여 주지 않음). fail-safe 이므로 결함은 아님 | 선택: `DamagedNote` 에 `issues[].key` 표시. 값은 절대 표시 금지 |
| L6 | Low | `task012c-secret-value.test.ts` | **변이 M4 생존** — `secretLikeExceptLongToken` 에서 판정용 형태(NFKC·폭 0 삭제) 생략해도 10/10 통과. 실제 코드는 글자마다 폭 0 를 끼운 `github_pat_…`·`bearer …` 를 거부하지만(내 스크래치 확인), 생략하면 통과로 새는데(`github_pat_`·`bearer` → PASS-THROUGH) 그걸 잡는 테스트가 없다 | 비자유 STRING·JSON 에 "폭 0 삽입 `github_pat_`·`bearer`" 케이스 1~2개 추가(코드 수정 불요) |

### Leader 에게 — Rollback 정책 권고 (항목 4)
- **fail-closed 유지.** 비밀 유사 값이 든 스냅샷을 자동 복원하면 비밀이 새 버전·감사 행으로 다시 쓰이므로 막는 편이 맞다. 퍼지(삭제) 경로는 **추가하지 않는다**(`ConfigurationVersion` 은 UPDATE/DELETE 금지가 설계 원칙).
- 막힌 버전은 "기록 열람 전용"으로 두고, 필요하면 **새 편집(roll-forward)** 으로 원하는 값을 직접 입력해 새 버전을 만든다. 라이브 조회상 현재 해당 사례 0건이라 지금 조치가 필요 없다.
- 선택 개선 2건(필수 아님): L3 문구 정렬, L5 `issues` 키 표시.

### 정본 반영 요청 확인 (Leader 몫)
Developer 기록 마지막 줄(L1110)에 두 건이 **존재함을 확인**했다 — `api-contract §2-23` `secretValue` 의미 확장, `role-permission §7 ③` 적용 대상에 설정 값 추가(+`EditKeyDef.freeText`). 아직 정본에 반영되지 않았으면 Leader 가 반영한다(내가 정본을 고치지 않았다). L4 의 "접두 규칙 ≤20자" 한 줄도 같은 위치에 넣을 것을 권고.

### QA 인계 `high_risk_areas`
```json
{ "reviewId": "REV-059", "status": "PASS_WITH_NOTES", "native_change": false,
  "high_risk_areas": [
    "PRODUCTION 경로는 QA 라이브 불가 — 단위 task012c-secret-value 10/10 + 사용자 리허설 U-C7(PRODUCTION 적용·되돌리기)로만 확인",
    "쓰기 진입점 9종(#104·#105·#106·#107·#111 dryRun/적용·#93·#93a·#100·#123b)에 비밀 유사 값 → 400 secretValue, 응답에 입력 조각 0, ConfigurationVersion·AuditLog 증가 0",
    "voice.preview.defaultText(자유 문장, 전체 규칙)와 fallbackConnectionIds JSON(키·잎·`키: 값` 짝) 두 경로 — 전각·폭 0 삽입·대소문자·깊이 9·배열 201·8KB 초과",
    "Rollback 422 E_SNAPSHOT_INTEGRITY 표시 — 시트 DamagedNote·배지·flow.ts:218 문구, 쓰기 0, 다시 눌러도 불변",
    "기준선 v1 스냅샷이 기존 저장값을 재검증 없이 복사(L2) — 첫 편집 직후 스냅샷에 비밀 유사 값 0 확인",
    "창 23자가 reason.ts 규칙 길이(최장 20)에 의존(L4) — reason.ts 규칙 변경 시 재검토",
    "정책 틈(L1): URL 인코딩·유사 문자·`Authorization` 키·비밀 이름 키 아래 숫자 잎은 통과 가능(수용) — 회귀로 오인하지 말 것",
    "오탐 회귀: 긴 모델 id(claude-sonnet-4-5-20250929·qwen2.5:14b-instruct-q4_K_M·zipformer-ja-reazonspeech-2024-08-01-int8)와 긴 경로가 저장되는지",
    "x- 최상위 키 경고 문구('저장하지 않고 적용하지도 않습니다')·RawTab.tsx:137-139 안내가 360/390/412px 에서 가로 스크롤 0"
  ] }
```

## Judge 기록 (C2 — REV-059 이후, 2026-10-01)

**Codex 개입 판정**: checkpoint C2(Reviewer PASS 직후) — 변경 성격 보안(비밀 유사 검사), Reviewer 재감사 Low 6개 비차단, 라이브 영향 0

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-012c",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": true,
    "wanted_before_budget": true,
    "mode": "adversarial-review",
    "focus": "security",
    "budget_rule": "CX-limit-unknown-r2",
    "codex_calls_used": 3,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 3,
    "focus": {
      "choice": "security",
      "confidence": 1
    },
    "high_risk_change": {
      "noul": 0.7
    },
    "reviewer_doubt": {
      "noul": 0.68
    }
  },
  "rule_overrides": [],
  "fallback": null,
  "input_tokens": 999,
  "cost_usd": 0.000042,
  "latency_ms": 283
}
```

**요약**:
- engine: jev
- 결정: codex_required=true · mode=adversarial-review · focus=security · budget_rule=CX-limit-unknown-r2 · codex_calls_used=3
- 규칙 덮어쓰기: 없음

**판정 사유**: 
R2 risk + 보안 경계 변경(비밀 유출 방지) + Reviewer Low 항목(정책 틈, 규칙 길이 의존성 등)으로 Codex 대항적 재검토 권고. 이미 3회 사용 중(초기 C1/C2 1회 + 재검토 2회). 예산 규칙 `CX-limit-unknown-r2` 적용. QA 단계로 진행 가능하나 Codex 외부 검토 강력 권고.

### [2026-10-01 17:15] C2 재검토 adversarial-review focus=security — done
- judge 판정: 2026-10-01 17:09, C2 checkpoint (adversarial-review · security), budget_rule=CX-limit-unknown-r2, codex_calls_used=3 (C1·C2 2회 사용, 이번 3회) / 호출 차수: 3/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa, base=f4a3f32(task_file), snapshot=b8c9711
- **지적 1건**: [medium] `src/modules/engine/configuration/validate.ts:116` — 비자유 STRING 키(`runtime.modelByTier.fast` 등)에서 긴 API 키(24자↑ 대소문자·숫자·기호 섞인 접두 없는 토큰) 우회 → `secretLikeExceptLongToken()` 이 비자유 키에서 긴 토큰 규칙을 제거해 23자 창 검사만 됨 (권고: 비자유 키는 whitelist 또는 알려진 모델 ID 검증으로 예외 처리, validatePatch·commit 테스트 추가)
- 검토하지 못한 범위: 라이브 DB·네트워크 기능 테스트·실제 쓰기 경로 (READ-ONLY 제약) · 비보안 기능·Android·음성 서비스 변경
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261001T053357Z-task-012c-C2

---

## 최종 요약

Codex C2 재검토에서 **새로운 보안 우회 1건 적발**: 비자유 STRING 설정값(모델명 키)에서 접두 없는 긴 API 키가 `secretLikeExceptLongToken()`의 정책 예외로 통과하는 경로. 다음: Reviewer가 지적 채택·수정 판단.

## Leader 기록 (Codex C2 재검토 판단, 2026-10-01 17:30)

Codex 재검토(호출 3/4) 지적 1건(Medium, `validate.ts:116`) — **채택(좁은 범위)**.
- 사실 확인: 비자유 키 `primaryConnectionId` 의 패턴이 `^[A-Za-z0-9_-]{1,80}$` 라 접두 없는 40자 난수 키(`Abcdefghijklmnopqrstuvwxyz0123456789_X`)가 23자 창 검사만 받고 통과한다. 이는 REV-059 L1 이 "정책상 수용된 틈"으로 분류했고 Developer 기록 (b) 가 "판정 지시대로의 의도된 경계"로 남긴 바로 그 자리다. 코드에서 재현 가능한 실제 공백이므로 오탐이 아니다.
- 채택 이유: 프로젝트 원칙("Secret 은 `credentialRef` 만 저장, ConfigurationVersion·AuditLog 평문 금지")이 우선이고, 수정 비용이 낮다. 다만 Codex 권고(키별 허용 형식·모델 ID 화이트리스트)는 범위가 넓고 오탐 위험이 커서 **채택하지 않는다**.
- 범위: 비자유 STRING/PATH/URL·JSON 잎에 한해 "접두 없는 긴 토큰" 좁은 보강 규칙 1개(`validate.ts` 안, `reason.ts` 규칙 불변). 구분 기호(`-`·`.`·`:`·`/`·공백) 없이 이어진 영숫자·`_`·`+`·`=` 런이 길고 문자 종류가 많을 때만 거부 — 모델 id(`zipformer-ja-…`)·cuid·uuid·경로·URL 은 통과해야 한다. 같은 파일의 REV-059 L4(창 크기 가드 테스트)·L6(NFKC·폭 0 경로 테스트)도 함께 처리.
- 재순환: Developer 수정 → **Reviewer(REV-062)** → [Judge] → QA. Codex 잔여 1회(4/4) 는 Judge 판정에 따른다.
- 참고: 위 `## 최종 요약` 절은 codex 역할이 쓴 임시 문구이며 Leader 최종 요약이 아니다. 012c 완료 시 Leader 가 다시 쓴다(codex 는 기록만 하고 채택·수정 판단은 하지 않는다).

## Developer 기록 (Codex C2 재검토 수정, REV-062 대상)
- [23:51] Codex C2 재검토 지적(`validate.ts:116`, Medium) 좁은 보강 완료 — Leader 결정대로 화이트리스트 전환은 하지 않음. 화면·DB 스키마·api-contract·`infra/reason.ts` 무변경, DB 접촉 0·LLM 0·운영 0·커밋 0.
  - **바뀐 파일**: `src/modules/engine/configuration/validate.ts` · `src/modules/engine/__tests__/task012c-secret-value.test.ts`(10 → 21 테스트) · `docs/design/role-permission.md` §7 `reason` 규칙 아래 ⑦ 한 줄(Edit, 해당 줄만).
  - **함수**: 새 `checkForm`(NFKC·폭 0 삭제 = `reasonCheckForm` + 공백 접기) · `hasLongMixedRun(form)` · `secretLikeNonFreeText(s)` = `hasLongMixedRun(form) || secretLikeExceptLongToken(form)` — **비자유 판정의 단일 입구**. `checkEditValue` STRING/PATH/URL(`secretLikeValue`)·ENUM(목록 검사 통과 뒤)·`scanJsonSecret`(문자열 잎·객체 키·`키: 값` 짝 세 자리) 모두 이 함수만 부른다. `secretLikeExceptLongToken` 은 판정용 형태를 받도록만 바꿈(창 로직 불변). 자유 문장 키는 `isSecretLikeText` 그대로 — 원래 긴 토큰 규칙(`[A-Za-z0-9\-_+/=]{24,}`·3종)이 새 규칙을 포함하므로(새 런 ⊂ 긴 토큰 런, 길이 32 ≥ 24·종류 동일 이상) 따로 걸 필요 없음(경계표에서 자유 문장 = 3종↑ 거부로 확인). `NO_LONG_TOKEN_WINDOW`·`MIXED_RUN_MIN`·`MIXED_RUN_KINDS` 는 가드 테스트용으로 `validate.ts` 에서 export(엔진 `index.ts` 공개 API 는 무변경).
  - **규칙**: 판정용 형태에서 `/[A-Za-z0-9_+=]+/g` 최대 런 중 길이 ≥ **32** 이고 문자 종류(소문자·대문자·숫자·`_+=`) ≥ **3** 이면 `secretValue`. 구분 기호(`-` `.` `:` `/` 공백)·비ASCII(일본어·한글)는 런을 끊는다. 거부 = 기존과 같은 `{key, rule:'secretValue', message(고정문)}` → API `400 VALIDATION`, 입력 값 비에코(테스트로 단언).
  - **임계값 근거 — 지시값 32·3종 유지(조정 없음)**: 전수 확인에서 오탐 0. 실제 비밀(무작위 base62 32~40자, `hf_…` 37자, Codex 재현 38자)은 32자↑·3종↑, 정상 값은 구분 기호로 끊기거나(모델 id·경로·URL·uuid) 2종(cuid·16진수 해시·대문자 상수·camelCase 문자열)이다. 24로 낮추면 reason 긴 토큰 규칙과 같아져 REV-056 이 피하려던 오탐 범주(긴 식별자)가 돌아오고, 4종으로 올리면 `_+=` 없는 base62 키(가장 흔한 형태)를 놓친다.
  - **기존 허용 값 전수(오탐 0)**: 스크래치 집계(테스트 밖, 미러) — 시드 엔진 5종 × 연결 종류 전부의 STRING/PATH/URL/ENUM/JSON 기본값 + **ENUM 목록 값 전부** + 시드 연결 6개 평면 값 + Fallback·AppSetting 기본값 + 목소리 id 6개 = **243개 값(문자열·JSON 163) → secretValue 0**. 단위로도 고정: 기존 "오탐 전수"·"기본값 스냅샷 무결성" 테스트(새 규칙 포함 상태로 통과) + 신규 "오탐 전수(보강 규칙)"(ENUM 목록 값 포함) + "문장·식별자" 표(일본어·한글·영어 문장, URL·manifest·긴 모델 경로·`$CLAUDE_CLI_PATH`·ENUM 값·camelCase 41자·대문자 상수 51자·cuid·uuid·sha1·sha256·HF/ollama 모델 id·claude 모델 id). 시드 Fallback 의 `primaryConnectionId`/`fallbackConnectionIds` 는 런타임 cuid(`@default(cuid())`, 소문자+숫자 2종) → 통과. **DB 저장 행은 조회하지 않았다**(지시: DB·운영 접촉 금지) — REV-059 가 본 라이브 값 122개를 새 규칙으로 다시 볼지는 Reviewer 판단(읽기 전용).
  - **L4 판단**: 새 규칙은 창과 무관하게 판정용 형태 전체에 한 번 적용되고 창 계산(`NO_LONG_TOKEN_WINDOW = 23`, 창 = `'0'` + 22자)은 그대로 — 의존 관계 불변. 가드 테스트 3개: ① reason.ts 의 최상위 정규식 상수 목록·`SECRET_PREFIX`/`AUTH_SCHEME`/`JWT_LIKE`/`KEY_VALUE`/`TOKEN_RUN` 원문·`isSecretLikeText` 본문을 고정(바뀌면 실패 → 창·표 재검토 뒤 갱신) ② 규칙별 "가장 긴 최소 일치"(경계 포함) 표 10행 — 각각 걸리고 한 글자 빼면 안 걸림(정확히 최소), 최장 = **20**(`␣github_pat_`+8 · JWT 20), `최장 ≤ 창-1(22)`·`창 < 24` 단언 ③ 표의 모든 일치를 앞쪽 0~40자 위치에 두어도(첫 창 밖 포함) STRING·JSON 거부 + 폭 0 삽입도 거부. 실증: 미러 reason.ts 에 `|glpat-[A-Za-z0-9_-]{20,}` 를 넣으면 ① 이 실패(20/21) → 원복 `cmp` 일치.
  - **L6**: REV-059 L6 그대로 — 글자마다 U+200B 를 끼운 `github_pat_ABCdef12345678`·`bearer abcdefgh12345` 를 비자유 STRING(모델 버전)·PATH·JSON 잎·JSON 키·JSON `키: 값` 에서 거부. 변이 M4(창을 원문으로 자름) 재현 시 이 테스트와 ③ 이 실패 → 생존 변이 해소.
  - **경계표 결과**(`경계표` 테스트, 66행 × 변형 — 행마다 원형·전각·폭 0·전각+폭 0·구분 기호 5종×3·자유 문장): 길이 31/32/33 × 종류 2(5조합)/3(4조합)/4 × 기타 문자 `_`·`+`·`=` — **거부 ⇔ 길이 ≥32 ∧ 종류 ≥3**, 네 자리(STRING·PATH·JSON 잎·JSON 키) 판정 일치 · 전각·폭 0(U+200B·U+00AD·U+2060·U+FEFF·U+200D 순환)·전각+폭 0 = 원형과 같은 결과 · 가운데에 `-` `.` `:` `/` 공백(전각 포함) → 전부 통과 · `model␣<런>␣v2` 처럼 한쪽 런이 32자↑로 남으면 구분 기호가 있어도 거부 · 자유 문장 키는 3종↑ 전부 거부(31자 포함). 문장 속: 일본어 사이 31자 런 통과·33자 런 거부, 한글 사이 33자(전각 포함) 거부. JSON: 깊이 8 잎·키 거부 / 깊이 9 `type` · 배열 200 거부 / 201 `type` · 8KB 초과는 런 유무와 무관하게 `type`, 8KB 미만이면 거부. Codex 재현값 `Abcdefghijklmnopqrstuvwxyz0123456789_X` → `runtime.modelByTier.fast`·`.deep`·`runtime.model`·`primaryConnectionId`·`voice.default.profileId`·`runtime.modelVersion`·`connection.binPath`·JSON(잎·키·짝) 모두 `secretValue`, `validatePatch` SCHEMA 1건·결과 JSON 에 값 0, 그 값이 든 스냅샷 `INVALID_ENTRIES`.
  - **실행 명령·결과**(미러 `~/.node-local/thekaiwa-rev-059`, `rsync -a src/ tests/ prisma/` 후):
    - `node --import tsx --test src/modules/engine/__tests__/task012c-secret-value.test.ts` → `# tests 21 # pass 21 # fail 0`
    - engine+admin+infra+components/admin+app/api/admin 의 `*.test.ts` 37파일 `--test-concurrency=1` → `# tests 299 # pass 299 # fail 0`(REV-059 의 288 + 신규 11)
    - `./node_modules/.bin/tsc --noEmit` → exit 0 · `./node_modules/.bin/eslint validate.ts task012c-secret-value.test.ts` → exit 0
    - 변이 14종(미러 사본에만 적용·원복 `cmp` 일치): 새 규칙 제거 6 fail · 길이 33 → 3 · 종류 4 → 2 · 하이픈을 런에 포함 → 1 · 판정용 형태 생략 → 5 · 창만 원문(M4) → 2 · JSON 잎 보강 빠짐 → 5 · JSON 키 보강 빠짐 → 4 · 창 24 → 11 · 창 20 → 2 · ENUM 판정 빠짐 → 1 · STRING 판정 빠짐 → 11 · 종류에서 `_+=` 제외 → 1 · 창 앞 `0` 제거(M3) → 1 — **생존 0**.
    - 전체 스위트(`npm test`)는 돌리지 않음(DB 접촉 가능 테스트 배제 — 지시 범위는 관련 모듈 회귀).
  - **남은 위험**: (a) 정책상 수용 틈(REV-059 L1 계열 유지) — `/`·`-`·`.` 가 섞여 런이 32자 미만으로 쪼개지는 base64·base64url 키(예: 40자 AWS 비밀 키 모양), 16진수·소문자+숫자뿐인 토큰(2종), 31자 이하 무작위 키, URL 인코딩·유사 문자. (b) 이론상 오탐 — 구분 기호 없이 32자↑이고 3종↑인 정상 식별자(예: `zipformer_ja_reazonspeech_2024_08_01_int8` 같은 snake_case+숫자, 숫자 섞인 긴 camelCase). 지금 키·시드·기본값에는 0건, 새 키 추가 때 리뷰 항목. 오탐이면 그 값은 저장 불가·그 값이 든 옛 스냅샷은 되돌리기 422 이므로 Rollback 쪽 영향도 같이 본다. (c) 가드 ① 은 reason.ts 서식 변경(포매터)에도 실패한다 — 의도된 트립와이어. (d) `x-` 확장 키 값은 여전히 검사하지 않는다(저장·스냅샷 미도달, REV-056 판정 그대로).
  - **Reviewer(REV-062) 인계 포인트**: ① 단일 입구 — `secretLikeNonFreeText` 외 비자유 판정 경로가 없는지(`validate.ts:153-171·190·207`) ② ENUM 분기에 판정을 넣은 것(목록 검사 통과 뒤만, 실제 목록 값 오탐 0)이 과한지 ③ 자유 문장 키에 새 규칙을 따로 걸지 않은 근거(포함 관계) ④ 경계표·L4 가드·L6 가 지시 항목을 다 덮는지 ⑤ 라이브 DB 저장 값 재확인 필요 여부(읽기 전용, 내가 하지 않음) ⑥ role-permission §7 ⑦ 문구. native_change 없음 · 화면 변경 없음(데모 게이트 대상 아님).

## Designer 기록 (§13 구현 가이드, 2026-10-02)
- [23:57] **`docs/screens.md` §13 "관리자 콘솔 P2 — 설정 편집·이력·되돌리기 (task-012c)" 삽입**(§12 와 §14 사이, 약 627행) + §2 화면 표에 task-012c 한 줄. 첫 줄 `승인 데모: docs/demo/task-012c-console-p2-v2.html (v2)`, 적용 토큰 이름 나열(새 색 0, 데모 토큰 값 15개와 지금 `globals.css` 대조 동일 — 파일 해시는 task-021 키보드 규칙 때문에 다름). 데모 HTML·코드·frontmatter·`## 데모 검토` 절은 손대지 않았고 commit·push 없음. **사후 가이드** — developer B 구현(09:20)·REV-047 수정(13:26)·REV-056 문구(14:11)에 맞췄다(Leader 확인 요청 (b) 이행).
- 구성: 13-0 결정 10 · 13-1 개요·메뉴(`menu.ts` 바뀐 hunk)·`configAccess` 필드 표·역할×환경 렌더 매트릭스 · 13-2 A~O(설정 화면·Form `FieldList`·Raw `RawTab`·Diff·적용 막대 `flowView` 12갈래 표·확인 창 `ApplySheet`/`ReasonFields`·요청 전 검사·`writeErrorView` 갈래 표·`ConfigTestCard`·연결 상세 `ConnectionEditPanel`·`EnabledSheet`/`CredentialSheet`/`PrepTestSection`·`FallbackEditor`·이력 `HistoryScreen`·`ConfigVersionSheet`·`AuditTab`·공통 상태·발음 사전 R1) · 13-3 상태(`useConfigEditor`·`useWritePrep`·`usePaged`) · 13-4 API 표(#91~#137) · 13-5 컴포넌트 · 13-6 파일 · 13-7 후속 수정 순서 · 13-8 문구 단일 출처 · 13-9 체크리스트(폭·키보드·터치·권한·동작·접근성) · 13-10 주의 · 13-11 데모와 다른 점 · 13-12 Leader 확인.
- 검증(읽기 전용): §13 백틱 식별자 270개를 `src`·`tests/live`·`docs/design` 에 grep — 없는 이름 0(해시 1·테스트 파일명 1 제외) · 따옴표 한국어 문구 144개 grep — 코드에 그대로 없는 것은 JSX 조각 합성(`<b>`·`<br>` 사이)·데모/사용자 인용·제안 문구뿐 · §13 엔진·모델 이름 grep 0. 헤드리스 캡처는 하지 않음(운영 권한 토큰 제약 — 지시대로).

### 데모 v2 와 달라진 점(구현이 사실 — 모두 정보 구조·단계·CTA 동일, 데모 재승인 불필요)
| # | 데모 v2 | 구현 | 권고 |
|---|---|---|---|
| 1 | 대상 종류 3(목소리 기본값 포함) | 연결·운영 설정 2 | 구현 정본(D-C14 → 012c-2) |
| 2 | 감사 분류 칩 7·결과 필터·뱃지·개수 | 칩 5, 결과 필터·뱃지·개수 없음 | 구현 정본(REV-047 ①) |
| 3 | 예비 순서 "다시 시도" 스위치 | 글자 한 줄 | 구현 정본(서버 NOT_CONSUMED, ②) |
| 4 | Form 사용 여부 칸 | 숨김 — 연결 상세 스위치 | 구현 정본(③) |
| 5 | 운영 설정 범위 표시 | 없음, 키 목록 화면 상수 9개 | 유지 + DTO 확장 시 `fieldFromAppSetting` 만 고침(④) |
| 6 | "마지막 적용 n시간 전" | 없음 | 구현 정본(⑤) |
| 7 | Raw 꼬리 "x- … 그대로 보존돼요" | "맨 바깥의 x- … 메모로 둘 수 있지만 저장되지 않아요." | **구현 정본**(서버 사실, REV-054 L-2·REV-056 ④) |
| 8 | 적용 막대 sticky(본문 안) | fixed + 빈 자리 + 사이드바 232px 상수 | 동작 같음, 셸 폭 CSS 변수 권고(REV-047 L-4) |
| 9 | — | Raw/Form 동기화 안내 2개·막힌 키 이름 오류 | 구현 정본(REV-054 implementation) |
| 10 | 요약 없이 적용 막기 = 운영만 | 모든 환경 | 구현 정본 |
| 11 | 비밀 값 거절 = 비밀 참조 칸만 | 일반 값도 400 `secretValue`(서버 문구 그대로) | 화면 변경 없음(REV-056/059) |
| 12 | 시크릿 참조 시트 = 전체 | 사용 중 참조만 | 구현 정본 |
| 13 | "버전 v6 보기 ›" | "버전 보기 ›" | 구현 정본 |
| 14 | 기본 탭 Form | 같음 + 요약 카드 링크 `&tab=effective` | 구현 정본(⑥) |

### Leader 확인 요청 (§13-12 와 같은 번호)
- ① **키보드 열림 때 적용 막대**(코드 추적, 실기기 미확인): `FlowBar` 가 `fixed`(모바일 ≈150px)라 `resizes-content` 에서 키보드와 함께 올라오고, `KeyboardInset` 입력 칸 드러내기가 막대 높이를 빼지 않아 Form 아래쪽 칸·Raw 편집기 줄이 가릴 수 있다. 권고: 하단 탭과 같은 규칙으로 키보드가 열린 동안 막대 숨김(`data-flowbar` + `:root[data-kb] [data-flowbar]{display:none}`) — implementation 수정, 데모 변경 아님. QA 360·390 실측 항목에 추가.
- ② developer B (a) — 위 표 2~6·14 **수용 권고**. ③ (c) #123b 범위 필드는 developer A 가 더하면 화면은 `fieldFromAppSetting` 한 곳. ④ (d) U-C7 리허설 순서 제안은 §13-12 ④.
- ⑤ 정본 문구: `configuration-resolution.md` §8-1 끝 "ADMIN/DEVELOPER … 승인 요청(`pendingProductionApprovals`)" 은 데모·구현 모두 없음 → "초안·변경 요약까지(최고관리자 계정으로 다시 적용)"로 정리 권고.
- ⑥ §2 표: 한 줄만 더했고 기존 `/admin/configuration`(Effective 탭만)·`/admin/{prompts,playground,history}`(Phase 2+) 행은 지침대로 그대로 — Leader 정리 필요. screens.md 머리 변경 이력 줄도 건드리지 않음.
- ⑦ `EffectiveScreen` 기본 내보내기·`ConfigAccess.note` 는 이제 화면에서 안 쓰임 — 다음 정리 때 삭제(동작 영향 0).
- ⑧ REV-054 Low 중 화면에 보이는 것(진행 중 응답 덮어쓰기·409 뒤 Raw 글 잔존·제안 바꾸기 첫 줄 일치) — 다음 라운드 묶음. ⑨ 손상 문구 `flow.ts` ↔ `DamagedNote` 맞춤 + `issues[].key` 표시(REV-059 L3·L5).
- **사용자 승인이 필요해 보이는 실질적 차이: 없음**(위 14건 모두 implementation·범위 이동·문구 정정). 20-Log 줄은 지시 범위(screens.md·task 파일) 밖이라 쓰지 않았다 — Leader 가 기록.
- 출력: `{"taskId":"task-012c","status":"DONE","deliverables":["docs/screens.md#13-관리자-콘솔-p2--설정-편집이력되돌리기-task-012c","docs/screens.md#2-화면-목록--네비게이션--역할별-가시성"],"blockers":[],"risk_level":"LOW"}`

## Leader 기록 (Designer §13 수용·확인 요청 처리, 2026-10-02 23:58)
- **§13 가이드 수용**: `docs/screens.md` §13(§12·§14 사이 단일 삽입 — `grep -c '^## 13\.'` = 1)과 §2 표 한 줄. 데모 게이트 `check.mjs check` = DEMO_GATE_PASSED(v2·해시 검증)로 데모·frontmatter·검토 절 무변경 확인. 데모와 달라진 14건은 모두 구현이 정본·정보 구조/단계/CTA 동일 — **사용자 재승인 불필요**(REV-047/055/057 선례, 구현 수준 차이).
- **확인 요청 처리**: ②(표 2~6·14 수용) 수용. ⑤ `configuration-resolution.md` §8-1 끝 문단을 "초안·변경 요약까지, 적용은 SUPER_ADMIN 으로 다시"로 **정정 완료**(`pendingProductionApprovals` 서술 삭제). ⑥ `docs/screens.md` §2 표 정리 **완료**(`/admin/configuration` 행에 현행 안내·`/admin/history` 를 Phase 2+ 행에서 제외하고 prompts·playground 만 012c-2 이후로). ⑦ `EffectiveScreen` 기본 내보내기·`ConfigAccess.note` 미사용 코드 삭제는 다음 정리 묶음.
- **① 키보드 열림 때 적용 막대(FlowBar)**: 실기기 미확인·코드 추적 결과라 **보류 판단** — implementation 수준 수정(데모 변경 아님)이지만 `globals.css`·키보드 훅이 021(미커밋·APK 대기)과 같은 파일이라 지금 만지면 task 간 충돌한다. **후속 묶음 `task-012c-ui-fix`(가칭)** 로 등록: ①(FlowBar 키보드 중 숨김 `data-flowbar`) + ⑧(REV-054 Low: 진행 중 응답 덮어쓰기·409 뒤 Raw 글 잔존·제안 바꾸기 첫 줄) + ⑨(손상 문구 `flow.ts`↔`DamagedNote` 맞춤·`issues[].key` 표시, REV-059 L3·L5) + ⑦. 021 처리 후 Developer → Reviewer → QA 로 순환. 이번 012c QA 에서는 360·390 폭에서 FlowBar 가 마지막 입력칸을 가리는지 **측정만** 하고(키보드 에뮬레이션 불가 시 "실기기 필요"로 표기), 가림이 확인되면 Medium 으로 격상해 배포 전에 처리한다.
- **다음**: REV-062(진행 중) → Judge C2 재판정(Codex 12c 한도 3/4 사용, 1회 남음) → QA(REV-059 high_risk_areas + 위 FlowBar 측정) → Deployer. `## 최종 요약`은 완료 시 Leader 가 다시 쓴다(codex 가 쓴 임시 요약 교체).


## Reviewer 기록 (Codex C2 재검토 수정 감사, REV-062)

- [00:10] **REV-062 = PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 4). 범위: Codex C2 재검토 Medium(`validate.ts:116` — 비자유 키에서 구분 기호 없는 긴 혼합 무작위 토큰이 통과)의 좁은 보강 수정. Leader 결정(화이트리스트 전환 거부, `[A-Za-z0-9_+=]` 연속·구분 기호 없음·길이 ≥32·문자 종류 ≥3 → `secretValue`) 대로 구현됐는지, 새 틈·오탐·회귀가 없는지 감사. **코드 수정 0 · DB 쓰기 0 · LLM 0 · 운영 접촉 0 · 커밋 0**(NFS 원본 무수정, Read 전용 + 개인 미러 `~/.node-local/thekaiwa-rev-062` 실행. 공유 059 미러는 Developer 변이용이라 건드리지 않음). 값 자체는 어디에도 적지 않았다(키 이름·규칙·길이만). Developer 주장(21/21·299/299·변이 14종 생존 0·오탐 0)은 근거로 쓰지 않고 아래를 **내가 다시 실행**했다.
- **Codex 지적 판정: 채택 → 수정 확인(해소).** 재현값(접두 없는 38자 혼합 키)이 모델명·연결 id 키에서 `secretValue` 로 거부된다(STRING·PATH·JSON 잎·JSON 키 네 자리, `validatePatch` Form/Raw 공통 관문 모두).

### 내가 실행한 증거 (개인 미러 = 작업 트리 복사본, `cmp` 로 NFS 원본과 `validate.ts`·테스트·`reason.ts` 바이트 일치 확인)
| 항목 | 결과 |
|---|---|
| `node --import tsx --test src/modules/engine/__tests__/task012c-secret-value.test.ts` (cwd = 미러 루트) | **21/21 pass** |
| engine+admin+infra+components/admin+app/api/admin 묶음 | **299/299 pass** (REV-059 의 288 + 신규 11, 0 fail) |
| `tsc --noEmit` / `eslint validate.ts 테스트` | **exit 0 / exit 0** |
| `infra/reason.ts` | `git diff` 0줄(무수정, 공용 규칙 재사용만) · 엔진명 grep(`reazon\|whisper\|style-bert\|claude`) `validate.ts` 0건 |
| **독립 변이 12종**(미러 사본에만 적용·원복) | M1 최소 길이 32→33: 3 fail · M2 종류 3→2: 2 fail · M3 `hasLongMixedRun` 제거: 6 fail · M4 창 23→24(긴 토큰 재활성): 11 fail · M5 L4 `github_pat_` 8→12: 3 fail · M6 reason.ts 에 더 긴 접두 추가: 1 fail · M7 판정용 형태 생략(원문): 5 fail · M8 JSON 객체 키 검사 제거: 6 fail · M9 최소 길이 32→31: 3 fail · M10 종류 3→4: 2 fail · M11 런에서 `_` 제외: 3 fail · M12 창 계산 생략(전체에 긴 토큰 규칙): 7 fail — **12/12 검출, 생존 0** (Developer 14종과 겹치는 것 외에 M5·M6·M11 은 내가 추가) |
| 라이브 읽기 전용 DB 조회(select 만) | `EngineConnection` 12행·`FallbackPolicy` 8행·`AppSetting` 12행·`VoiceProfile` 3행·문자열 82개 → 새 규칙 걸림 **0건**(3종 이상 런 최장 0, 모든 문자열 통틀어 최장 런 25). `ConfigurationVersion`·Preset·Override **0행**(Rollback 라이브 재현 대상 없음 — 단위로 대체). 값 출력 0 |
| 스키마·시드 오탐 전수(내 스크래치) | 키 정의 583개의 기본값 문자열 700개 + 시드 5파일(engines·lexicon·topics·voices·words-n5) 1,666개 → **0건**, 최장 런 20자 |
| 성능(선형성) | 1MB 토큰성 입력 41ms · 64KB `-` 24자마다 분할 59ms · JSON 8KB 잎 7ms — 폭주 없음 |
| 데모 게이트 `check` | `DEMO_GATE_PASSED`(task-012c approved v2, hash verified). 이번 수정은 `validate.ts`·테스트·정본 한 줄 — **화면 변경 0**(분류 implementation 아님, 해당 없음). `.claude/state/demo-gate/` 직접 쓰기·대리 승인 흔적 없음 |

### 8개 관점 판정
1. **우회 시도 — 의도한 한계 외 실제 구멍 없음.** 내가 쓴 52개 탐침 + 합성 키 모양 9종(스크래치, 값 비출력) 분류:
   - **걸려야 할 것 전부 걸림(9/9)**: Codex 재현형·32/64/200자 3종·`_`/`=` 포함 32자·base64(`+`·`=`) 44자·공백으로 둘러싼 접두 토큰·`32-32` 쌍.
   - **정규화 우회 전부 걸림(9/9)**: 전각, 글자마다 ZWSP·ZWJ·WJ·BOM·소프트 하이픈·VS16·태그 문자·bidi LRM/RLM, 수학 볼드·원문자 NFKC. 판정용 형태(`reasonCheckForm` + 공백 접기)가 모든 호출 앞에 있다(M7 로 고정).
   - **통과(= Leader 가 정한 좁은 범위의 한계, 결함 아님)**: 31자 이하 · `31+구분+31`(구분 = `-` `.` `/` `:` 공백 다섯 종 전부) · 구분 기호가 20자마다 낀 base64/base64url · 16진수·base32 대문자+숫자·소문자+숫자(2종) · 40자 런 한가운데 일본어·한글·키릴 호모글리프·결합 문자 1개 · 글자마다 탭/NBSP/제어문자(→ 공백이 되어 런이 끊김). 모두 "구분 기호 없는 3종↑ 32자" 라는 규칙 정의에서 나오는 것이며, 정상 값(모델 id·경로·URL·uuid·cuid·해시)을 오탐하지 않으려는 의도적 한계다. 합성 키 모양 9종으로 정량화: 구분 기호 없는 Google API 키형(39자)·AWS 비밀키형(40자, `/` 없음)은 **걸림**, `AIza…-` 가 7번째에 낀 모양(7+31)·`/` 가 20번째에 낀 AWS 키형은 **통과**, 16진수 32/64자는 **통과**.
2. **오탐·회귀.** 라이브 DB·스키마·시드 전수 0건(위 표). 정상 후보 탐침(uuid·cuid·sha256 hex·긴 모델 id·긴 경로·긴 URL·일본어/한국어 문장·CSV·점 경로·하이픈 식별자·소문자만 snake_case 40자) 전부 통과. **실제 오탐 계열 1건 확인(L1)**: 구분 기호 없이 32자↑이면서 3종↑인 식별자(소문자+숫자+`_` snake_case 39자, 대문자+숫자+`_` 35자, 소문자+대문자+숫자 camelCase 37자)는 거부된다. 현재 저장·시드 값에는 해당 0건. 회귀 없음(299/299).
3. **REV-059 L4 — 창 23 이 reason.ts 접두 규칙(≤20)에 기대는 의존의 가드.** 가드 3종이 있고 변이로 검증됐다: ① reason.ts 정규식 상수 목록·원문 고정(M5 에서 3 fail, M6 에서 1 fail) ② 규칙별 최소 일치 길이 표(경계 포함 ≤20) ③ 모든 최소 일치를 앞쪽 0~40자 어느 위치에 놓아도 창이 잡는지(M4·M7·M12 에서 fail). **기대한 대로 접두 규칙을 늘리면(M5) 테스트가 먼저 깨진다.** 단 ①은 reason.ts 원문을 고정하므로 무해한 수정(공백·주석)에도 깨지는 "경보기" 성격이다(L4 노트).
4. **REV-059 L6 — 폭 0 삽입 `github_pat_`·`bearer`.** 글자마다 U+200B 를 낀 두 형태가 STRING(모델 버전)·PATH·JSON 잎·JSON 키·JSON `키: 값` 에서 모두 거부. M7(판정용 형태 생략)에서 이 테스트가 fail → **생존 변이 해소 확인**.
5. **두 경로 동일 함수·진입점 전수.** 비자유 판정은 `secretLikeNonFreeText`(`validate.ts` 148) 하나뿐이고 `secretLikeValue`(STRING/PATH/URL)·ENUM(목록 검사 통과 뒤)·`scanJsonSecret`(문자열 잎·객체 키·`키: 값` 짝)이 모두 이것만 부른다. 자유 문장 키는 전체 규칙(`isSecretLikeText`)이라 새 규칙을 따로 걸 필요가 없다(긴 토큰 규칙이 더 넓음 — 포함 관계 확인). 쓰기 진입점은 REV-059 의 9종(#104·#105·#106·#107·#111 dryRun/적용·#93·#93a·#100·#123b) 그대로 `commitEdit`/`validatePatch` 단일 관문이고 새 경로 없음. Rollback 은 `snapshotValueIssues`/`planRestore` 가 같은 함수로 재검증(422 `E_SNAPSHOT_INTEGRITY`, 쓰기 0).
6. **비반영.** 거부 응답 = `{key, rule:'secretValue', message(고정문)}`(400 VALIDATION), `expected`/`actual`·JSON 경로·입력 조각 없음(테스트가 단언). `infra/http.ts` 는 `ApiError.details` 를 로그에 쓰지 않음. 거부는 쓰기 앞에서 일어나 `ConfigurationVersion`·`AuditLog` 행이 생기지 않는다. 설정 경로에 `console.*` 없음.
7. **6층 경계·엔진명·정본.** `validate.ts` import 는 `@/modules/infra`·`../adapters/common/targetPolicy`·`../credentials/policy`·`./keys` 뿐(상위 층 import 0, `index.ts` 우회 0). 엔진명 grep 0건. `docs/design/role-permission.md` §7 ⑦ 의 임계값(≥32·3종·`[A-Za-z0-9_+=]`·구분 기호 5종·ENUM·JSON 잎·객체 키)이 코드(`MIXED_RUN_MIN=32`·`MIXED_RUN_KINDS=3`·`MIXED_RUN`·`secretLikeNonFreeText`)와 일치한다. ⑥ 은 구문이 낡았다(L3).
8. **독립 변이 재현.** Developer 주장 중 창 24(11 fail)·창 원문(M4, 판정용 형태 생략 5 fail)·최소 길이 33(3 fail)·종류 4(2 fail)·`hasLongMixedRun` 제거(6 fail)를 내 미러에서 같은 방향으로 재현했고, 추가 3종(M5·M6·M11)도 모두 검출됐다. **생존 변이 0**.

### 발견 사항 (전부 Low — 필수 수정 없음)
| # | 심각도 | 위치 | 내용·재현 | 권고 |
|---|---|---|---|---|
| L1 | Low | `validate.ts` 118~127 `hasLongMixedRun` | **구분 기호 없는 정상 식별자 오탐 계열.** 소문자+숫자+`_` snake_case 39자, 대문자+숫자+`_` 35자, camelCase+숫자 37자가 `secretValue` 로 거부된다(탐침 3건, 값 비출력). 현재 DB·스키마·시드에는 0건이라 지금 영향 없음. 운영자가 그런 긴 식별자를 모델 버전·경로 조각에 넣으면 저장 불가이고, 고정 안내문("비밀처럼 보이는 글자가 있어…")만 나와 원인을 짐작하기 어렵다. 이미 저장된 값이 걸리면 그 버전 Rollback 도 422. Developer 가 "이론상 오탐"으로 이미 인지(기록 (b)). | 수용(Leader 의 "좁은 규칙" 결정의 대가). 정본 ⑦ 에 "구분 기호 없는 긴 식별자는 `-`·`.` 로 끊어 쓴다"는 회피 안내 한 줄 추가를 권고. 임계값 변경은 불필요(전수 0건). |
| L2 | Low | 규칙 정의 | **의도한 한계(정책 틈).** 구분 기호로 31자 이하로 쪼개진 키, 16진수·base32·소문자+숫자 2종 키, 글자 사이 공백·탭·NBSP 삽입, 비ASCII 한 글자 삽입은 통과한다. 사고(복붙 실수) 방어 목적이면 충분하고 악의적 관리자 방어는 목표 밖이다(관리자 capability 보유자는 신뢰 대상, 쓰기는 감사 기록). REV-059 L1 의 연장. | 수용. QA 가 회귀로 오인하지 않게 `high_risk_areas` 에 명시. |
| L3 | Low | `docs/design/role-permission.md` §7 ⑥ | ⑥ 은 비자유 키에 대해 "긴 토큰 규칙을 제외 — 접두·키=값 패턴만 적용" 이라고만 쓰여 있어, ⑦ 이 더한 혼합 런 규칙이 ⑥ 단독으로 읽으면 빠져 보인다(⑦ 이 바로 아래에 있어 모순은 아님). | ⑥ 끝에 "(보강 규칙은 ⑦)" 교차 참조 한 줄. 문서만 수정, 코드 무관. |
| L4 | Low | `task012c-secret-value.test.ts` L4 가드 | reason.ts 정규식 **원문**을 고정하므로 의미 없는 수정(공백·주석)에도 실패한다. 의도된 경보기이나 실패 메시지가 "창 23 과 최소 일치 표를 재검토하라"고 안내하는지 Developer 가 확인하면 좋다. M5·M6 에서 1~3 fail 로 동작은 확인. | 선택 개선. |

### 잔여 위험
- 위 L2 정책 틈(구분 기호로 쪼개진 짧은 조각·2종 키)과 L1 오탐 계열은 의도적으로 남은 위험이다. 비밀 탐지는 "사고 방어선 하나"이고 진짜 방어는 `credentialRef`(Secret 은 DB 에 안 둠)·`maskSensitive`(감사)다.
- 라이브 DB 에 `ConfigurationVersion` 이 0행이라 "저장된 스냅샷이 새 규칙에 걸려 Rollback 이 막히는" 경로는 라이브로 못 봤다 — 단위(`snapshotValueIssues`·기본값 스냅샷 무결성)로만 확인. 실제 편집이 쌓인 뒤 한 번 더 조회하면 좋다.
- PRODUCTION 경로는 QA 라이브 불가(REV-059 와 동일) — 단위 + 사용자 리허설 U-C7 로 확인.

### QA 인계 `high_risk_areas`
```json
{ "reviewId": "REV-062", "status": "PASS_WITH_NOTES", "native_change": false,
  "high_risk_areas": [
    "PRODUCTION 경로는 QA 라이브 불가 — 단위 task012c-secret-value 21/21 + 사용자 리허설 U-C7(PRODUCTION 적용·되돌리기)로만 확인",
    "쓰기 진입점 9종(#104·#105·#106·#107·#111 dryRun/적용·#93·#93a·#100·#123b)에 접두 없는 32자↑ 혼합 무작위 키(모델명·연결 id·모델 버전·경로·JSON 잎) → 400 secretValue, 응답에 입력 조각 0, ConfigurationVersion·AuditLog 증가 0",
    "오탐 회귀: 긴 모델 id(claude-sonnet-4-5-20250929·qwen2.5:14b-instruct-q4_K_M·zipformer-ja-reazonspeech-2024-08-01-int8)·긴 경로·긴 URL·uuid·cuid·sha256 hex 가 계속 저장되는지(구분 기호로 끊기거나 2종이라 통과해야 함)",
    "정책 틈(L2)은 회귀 아님 — 31자 이하 조각·`31-31` 쪼개기·16진수·base32·글자 사이 공백 삽입은 통과가 정상이다. 반대로 구분 기호 없는 snake_case/camelCase 32자↑+숫자는 거부(L1, 오탐 계열)가 현재 동작이다",
    "voice.preview.defaultText(자유 문장, 전체 규칙)와 fallbackConnectionIds JSON(키·잎·`키: 값` 짝) 경로 — 전각·폭 0 삽입·깊이 9·배열 201·8KB 초과는 계속 거부",
    "Rollback 422 E_SNAPSHOT_INTEGRITY 표시 — 시트 DamagedNote·배지, 쓰기 0, 다시 눌러도 불변. 라이브 ConfigurationVersion 0행이라 편집이 쌓인 뒤 새 규칙에 걸리는 스냅샷이 없는지 재확인",
    "창 23자가 reason.ts 규칙 길이(최장 20)에 의존(L4) — reason.ts 규칙 변경 시 task012c-secret-value L4 가드 3종이 먼저 깨져야 하며, 깨지면 창·표를 재검토",
    "x- 최상위 키 경고 문구·RawTab.tsx 안내가 360/390/412px 에서 가로 스크롤 0(이번 수정은 화면 무변경 — 회귀 확인만)"
  ] }
```

### Judge C2 재판정 의견
- **불필요(Reviewer 의견).** 이번 수정은 Codex C2 재검토의 Medium 1건을 Leader 가 정한 범위 안에서 좁게 해소했고, 새 Critical·High·Medium 이 없다(Low 4, 전부 수용 가능한 정책 한계·문서 교차 참조·경보기 문구). 코드가 건드린 층은 `engine/configuration` 한 파일이며 정본 5종·api-contract·스키마·`infra/reason.ts` 는 불변이라 C2 트리거(경계·보안 계약 변경)를 새로 만들지 않는다. 같은 결함의 재발(C3)도 아니다 — 지적 위치는 같지만 원인은 "규칙을 일부러 뺀 자리"였고 그 자리를 메웠다.
- **12c 의 Codex 사용은 3/4(C1·C2·C2 재검토), 1회 남음.** 이 수정에 마지막 호출을 쓰지 않고, 12c 마감 직전(Designer §13 구현 포함 최종 묶음)이나 사용자 요청 시를 위해 남기길 권고한다. L1 의 정책 판단(오탐 vs 미탐 균형)은 Codex 가 아니라 사용자·Leader 결정 사항이다.
- 채택 조건: Developer 는 L3(문서 교차 참조 1줄)를 Leader 의 정본 갱신 때 함께 처리하면 충분하다. 재순환은 필요 없고 QA 로 진행해도 된다.

## Leader 기록 (REV-062 수용, 2026-10-03 00:05)
- **REV-062 PASS_WITH_NOTES 수용** — Critical·High·Medium 0, Low 4. 감사 근거: Reviewer 가 개인 미러에서 직접 실행(21/21 · 묶음 299/299 · tsc/eslint 0 · 독립 변이 12종 생존 0 · 라이브 DB·스키마·시드 전수 오탐 0 · 성능 선형). Developer 주장은 근거로 쓰지 않았다고 기록돼 있음.
- **Low 처리**: L1(구분 기호 없는 긴 정상 식별자 오탐 계열)·L2(의도한 정책 틈)는 **수용** — `docs/design/role-permission.md` §7 ⑦ 끝에 회피 안내(`-`·`.` 로 끊어 쓰기)와 "통과는 회귀가 아님" 문구 추가. L3(⑥ 교차 참조) **정본 반영 완료**(⑥ 에 "보강 규칙은 아래 ⑦"). L4(경보기 문구)는 선택 개선 — 다음 정리 묶음(`task-012c-ui-fix` 가칭)에 포함.
- **Judge C2 재판정**: Reviewer 는 불필요 의견이나 구속력 없음 → Judge 판정 요청함(결과는 별도 `## Judge 기록` 절). Codex 는 12c 3/4 사용(1회 남음) — Judge 가 요구하지 않으면 호출하지 않음.
- **QA 인계 high_risk_areas**: REV-062 의 8개 항목(PRODUCTION 경로 QA 불가·사용자 U-C7, 쓰기 진입점 9종 거부·비반영, 오탐 회귀 샘플, L1/L2 는 회귀 아님, 자유 문장·JSON 변형, Rollback 422, 창 23 의존, x- 안내 3폭 가로 스크롤 0) + FlowBar 가림 측정(Leader 17 기록).
- **다음**: Judge → QA. QA 는 025 QA 와 같은 QA 계정을 쓰지 않으므로 병행 가능하나, 동일 DB 공유·LLM 동시 호출 상한(≤2)과 직렬화 원칙에 따라 010c QA 종료 후 순서대로 돌린다.

## Judge 기록 (C2 재판정 — REV-062 이후)

**Codex 개입 판정 재검토**: checkpoint C2(REV-062 Reviewer PASS_WITH_NOTES 직후) — 예산 소진(4/4), Codex 개입 불필요

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-012c",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": false,
    "wanted_before_budget": true,
    "mode": null,
    "focus": null,
    "budget_rule": "CX-budget-exhausted",
    "codex_calls_used": 4,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 4,
    "focus": {
      "choice": "security",
      "confidence": 0.97
    },
    "high_risk_change": {
      "noul": 0.37
    },
    "reviewer_doubt": {
      "noul": 0.61
    }
  },
  "rule_overrides": [
    {
      "field": "codex_required",
      "value": false,
      "rule_id": "CX-budget-exhausted"
    }
  ],
  "fallback": null,
  "input_tokens": 957,
  "cost_usd": 0.00004,
  "latency_ms": 263
}
```

**요약**:
- engine: jev
- 결정: codex_required=false · budget_rule=CX-budget-exhausted · codex_calls_used=4/4 · mode=null · focus=null
- 규칙 덮어쓰기: CX-budget-exhausted (Codex 예산 소진)

**판정 사유**:
C2 재판정에서 Codex 개입 불필요 판정. 이유: (1) Codex 호출 상한 4회 도달(C1·C2 초기 판정 1회 → C2 재검토 2회 → C2 재판정 포함 4회 소진). (2) Reviewer PASS_WITH_NOTES(Low 4, 필수 수정 없음) — 새로운 R2 경계·보안 계약 변경 없고, 같은 결함 재발(C3)도 아님. (3) 정본 5종·api-contract·스키마·infra/reason.ts 불변, 화면 변경 0, 네이티브 변경 0. Leader/Reviewer 판단으로 변경 범위가 narrowly scoped 보안 조치이며 추가 외부 검토 불필요. → QA 단계 진행.

## Leader 기록 (Judge C2 재판정 수용·QA 착수, 2026-10-03 00:07)
- **Judge 재판정(Jev)**: `codex_required=false` · `wanted_before_budget=true` · `budget_rule=CX-budget-exhausted` · `codex_calls_used=4`. **Leader 정정**: 위 Leader 기록(REV-062 수용)에 쓴 "Codex 3/4 사용·1회 남음"은 틀렸다 — 앞선 REV-059 시점 Judge 가 이미 3회로 집계하고 그 판정으로 재검토가 돌았으니 실제 사용은 4회(C1·초기 C2·추가 검토·재검토)이며 **예산 소진**이 맞다.
- **판단**: Jev 신호상 보안 초점(0.97)에서 Codex 가 "원했으나" 예산 때문에 막힌 상태. 완화 근거 = ① Reviewer REV-062 가 직접 실행한 독립 변이 12종 생존 0·라이브 DB/스키마/시드 오탐 0 ② 이번 수정은 단일 함수 보강이며 정본·계약·`infra/reason.ts` 불변 ③ 방어선은 `credentialRef`·`maskSensitive` 이고 이 규칙은 복붙 사고 방어용 보조선. 예산을 더 늘리지 않고 **QA 진행**(예산 규칙은 이 task 에서 Leader 가 정한 운영 규칙이며 임의 상향하지 않는다). 사용자가 추가 Codex 검토를 원하면 그때 상향한다.
- **QA 착수**: Sonnet QA 에이전트(미러 `~/.node-local/thekaiwa-qa-021` 재동기·LOCAL 행만·포트 3041/3042·LLM 호출 0 — 010c QA 와 동시 구독 한도 보호·USER 쿠키는 qa-bot2 로 010c 기준선 보호). 점검: REV-062 high_risk_areas 8항목 + 화면 E2E + FlowBar 가림 측정 + x- 안내 3폭 + 로그 비반영.

## QA 기록 (012c 콘솔 P2 — REV-062 이후, 2026-10-03)

> 실행 주체 QA. 수정 0 — `src/**`·`prisma/**`·정본·데모 무수정, 커밋·푸시·배포 없음. Claude CLI·LLM 호출 0회, M4 합성 0회, PRODUCTION 행 읽기·쓰기 0건, 운영 서버(3010)·pm2 무접촉. 쿠키·토큰 값은 어디에도 출력·기록하지 않음. 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …` → `DEMO_GATE_PASSED`(approved v2, hash verified, `docs/demo/task-012c-console-p2-v2.html`).

### 총평

- **판정: CONDITIONAL — 결함 1건(Medium, 화면: 모바일 키보드 포커스 입력칸이 FlowBar 에 완전히 가려짐), Critical·High 0건.** 서버·보안 축은 전부 통과. Medium 은 화면 축이라 규칙상 "Critical/High 0건에서 Pass" 는 충족하나, 아래 [결함 #1] 처리는 Leader 판단(수정 후 Reviewer 재순환 vs 알려진 제약으로 수용).
- 환경: 미러 `~/.node-local/thekaiwa-qa-021` dev 3041(주) + 하드링크 복제본 `~/.node-local/thekaiwa-qa-012c-b` dev 3042(두 번째 프로세스 — Next 16 dev 는 디렉터리당 1개라 복제본 필요), `APP_ENV=LOCAL`, 같은 NAS MariaDB 의 LOCAL 행만.

### 항목별 판정

| # | 항목 | 판정 | 근거(관찰값) |
|---|---|---|---|
| 1 | 기본 게이트 | **PASS** | `node --import tsx --test`(task012c-secret-value 포함 engine·infra·admin·configEditor 37개 파일 묶음) **299/299 pass · fail 0 · skipped 0**. `tsc --noEmit` exit 0(출력 0). eslint(`src/` 광역) **0 error · 1 warning** — `src/components/admin/trace/DiagnosticsScreen.tsx:137` react-hooks/set-state-in-effect(012c 변경 파일 아님, 기존 경고) |
| 2 | REV-062 high_risk 8종 | **PASS**(아래 세부) | 쓰기 진입점 9곳 라이브 거부·무증가 확인 |
| 3 | `tests/live/task012c-ui-e2e.mjs` | **PASS** | **78/78 PASS**, exit 0. 그룹 0 USER 404 · 1 ADMIN 탭 · 2 DEVELOPER Raw · 3 검증→기능 테스트→Diff→적용 창→409 충돌 · 4 이력·되돌리기(새 v4)·감사 · 5 예비 순서 편집·기본 연결 거절 · 6 SUPER 비밀 참조 시트(값 입력 칸 0) · 7 폭 4종 + 폭 360/390/412/1280 × 6화면 가로 넘침 0·누를 것 ≥44px·콘솔 오류 0, Z 원복(대상 행 바이트 대조, LOCAL 설정 버전 수 = 시작 전, 지운 버전 4·남은 0). 스크립트 기대값 불일치 0건 |
| 4 | FlowBar 가림(360·390) | **PASS(정적) / FAIL(키보드 동반)** | 정적: 막대 높이 119px·viewport 780 에서 막대 윗선 661, 끝 스크롤 시 마지막 내용과 막대 사이 여유 ≥71px, 막대 안 버튼 44px, 가로 넘침 0. **키보드 동반: [결함 #1]** |
| 5 | RawTab `x-` 안내 | **PASS** | 360/390/412 모두 편집 중(`x-` 키 2개·긴 값 240자) 가로 넘침 `{doc:0, main:0}`, viewport 밖 요소 0, 누를 것 ≥44px 위반 0건, `x-` 안내 아랫선 대비 막대 윗선 여유 71px(412 기준 guideBottom 590·barTop 661). 측정 스크립트 54/54 PASS |
| 6 | Secret 비반사 | **PASS** | 거부 입력 조각 145종(전각·ZW·깊이 9·배열 201·>8KB 변형 포함)을 needle 로 dev 서버 stdout 두 개(3041 636줄·3042 222줄) grep → **적중 0**, `secretValue`·credential 문자열 0, 요청 외 줄은 기동 배너뿐 |
| 7 | 비LLM 라이브 스모크 회귀 | **PASS(부분)** | 아래 세부 |

### 항목 2 세부 — 쓰기 진입점 9곳

- 대상: #104(검증 전용) · #105 · #106 · #107 · #111 dryRun/apply · #93 · #93a · #100 · #123b.
- 거부: prefix 없는 ≥32자 혼합 키 + 전각·ZW 변형 → **400 `secretValue`**(패턴 키는 `pattern`, JSON 은 `type`), 응답에 입력 조각 반사 없음(echo=false), **ConfigurationVersion Δ0·AuditLog Δ0**. 변형: JSON 배열 201개·>8KB → `type`, JSON 키 길이·잎 길이 → `secretValue`(#104 200 `valid:false` 는 설계 — 검증 전용 API). `#123b voice.preview.defaultText` 자유 텍스트 경로 → 400 `secretValue` 4변형 전부.
- #111 `x-` 키는 Raw 에서 받되 저장 안 함 → 200 `changed:false`(설계, 스크립트 기대를 `x-`=거부로 잘못 잡았던 probe 1차의 FAIL 은 **스크립트 기대 오류**였고 정정 후 재측정).
- #93a: `secretValue` 도달 경로 없음(문서화된 대체 — 입력 칸이 다른 규칙에서 먼저 닫힘). #105 는 claude 연결만 실행.
- 오탐 표본 저장 성공(201): 모델명 `claude-sonnet-4-5-20250929`·`qwen2.5:14b-instruct-q4_K_M`·`zipformer-ja-reazonspeech-2024-08-01-int8`·uuid·cuid·sha256 hex64·긴 경로 120자+ — 저장 시 ΔCV·ΔAudit 정상(저장 1건당 감사 1).
- 관찰(결함 아님, REV-062 (d) 와 일치): **L1/L2 정책 간극** — 31자 단일·구분자 `-`/`.`/공백 분할·2종 40자(hex/base32 류)는 통과(정규식 설계상 ≥32자·≥3종·`[A-Za-z0-9_+=]` 연속). 오탐 참고: 내가 만든 `…&sha=<hex32>&…` 긴 URL 은 `=` 가 세 번째 종류로 세어져 #104 가 `secretValue` — 실제 매니페스트 URL(하이픈 구분·짧은 쿼리)은 통과(probe3). Info.
- **라이브 미재현·단위 근거 인용**: (a) PRODUCTION confirm 흐름, (f) Rollback `422 E_SNAPSHOT_INTEGRITY`(단위 테스트 근거 — "라이브 미재현"), (g) 23자 창. 

### 항목 7 세부

| 스크립트 | 실행 | 결과 |
|---|---|---|
| `task012c-gate-smoke.ts`(A #101 allowedFor · B Health 호스트 허용목록 · C home-m4 대상 고정 · D 기능 시험 30초 슬롯(두 프로세스) · E lexicon reason secret-like 422 · Z 원복) | 3041+3042 두 프로세스 | 1차 24/26 — B2 2532ms·B3 2014ms 가 "<2s" 시간 기준만 초과(상태·코드 정확, dev 서버+NAS 지연, 베이스라인 GET 0.65~2.3s) → **환경 지연 flake 로 분류**. 2차 **26/26 PASS**, Z1(대상 connection 3행 바이트 원복)·Z2(EngineHealth 정리 0) PASS |
| `task005b-smoke.ts` 사본(LLM·PRODUCTION 무접촉 편집본) | 3042 | **39/39 PASS**. 1차 37/39 의 2f·2g FAIL 은 5g 스텁 때문에 `traces/undefined` 가 404 였던 **스텁 의존 아티팩트** — LOCAL 최신 Trace id(읽기)로 대체 후 재실행 39/39. 4h(응답 148건 .env 비밀값 7종 grep 0)·H1(서버 절대경로 0) PASS |
| `task003g-smoke.ts` | **미실행(사유: M4 합성 상한 ≤2회 초과 — 스크립트가 합성 약 17회(#23 3 + 미리듣기 2 + 읽기 확인 ~12) 요구)** | validate.ts 영향 지점인 lexicon reason secret-like 422 는 gate-smoke E 단계가 대신 커버 |
| `task012c-smoke.sh` | **미실행(사유: 계정 1(qa-bot) 쿠키 필요 — 010c QA 기준선 계정 + Claude/M4 호출 동반)** | — |

- 005b 에서 건너뛴 단계(표기): **5g·5h·5i**(LLM 기능 시험·Trace·30초 슬롯 429 — 동시 LLM 상한), **7e·7f**(5g 의존), **2i·2j·4f 부분·10**(PRODUCTION 행·운영 도메인 접촉 — 금지). 4f 는 "다른 환경 id 404" 요청만 제외한 부분 판정. 이 8단계는 PASS 로 세지 않았다(미실행).

### 결함

**[결함 #1] [Medium] `src/components/shell/KeyboardInset.tsx` `reveal()` / `src/components/admin/configEditor/FlowBar.tsx` — 모바일 키보드가 열린 상태에서 포커스된 입력칸이 하단 고정 FlowBar 뒤에 완전히 가려짐**
- 실행: `/tmp/…/.qa-012c/kbfaithful.mjs`(playwright-core·google-chrome 147, isMobile·hasTouch, DSF 2.625) — 실제 탭 + 키보드 모사(viewport 780→450, `interactiveWidget:'resizes-content'` 과 같은 효과), `KeyboardInset` 작동(`data-kb="open"`) 확인.
- 재현: DEVELOPER/ADMIN 으로 설정 편집 화면 → `claude-cli-local` 연결(입력칸 5개) 또는 `reazon-ondevice`(2개) 열기 → 값 하나를 바꿔 FlowBar 표시 → 아래쪽 입력칸 탭.
- 실제: 360·390 모두 포커스 입력칸 top 390·bottom 434 인데 FlowBar 윗선 331(막대 높이 119) → **44px 전부 가려짐**, 그 지점의 `elementFromPoint` = 막대. 눈으로도 입력칸이 막대 뒤에 있음. (단일 `focus()` 호출 모사 A3 는 입력칸 top 245 라 PASS 였음 — 아래쪽 칸에서만 드러남.)
- 기대: 포커스 칸이 막대 윗선 위에 보여야 함.
- 원인 추정: `KeyboardInset.reveal()` 이 `visibleBottom`(키보드 위) 만 보고 fixed 막대 높이를 빼지 않음. FlowBar 는 `fixed inset-x-0 bottom-0 z-[8]`·스페이서 150px.
- 완화: 사용자가 수동 스크롤하면 150px 스페이서로 도달 가능. 앱 WebView(Capacitor)는 키보드로 viewport 가 줄지 않아 `KeyboardInset` 경로 밖 — **실기기 확인 필요**. 모바일 Chrome(`resizes-content`) 에서만 재현 확정.
- 제안 방향(구현은 Developer): reveal 시 `visibleBottom` 에서 FlowBar 높이를 빼거나 `scroll-padding-bottom` 활용.

### NOT_VERIFIED · 사용자 육안 확인 필요

1. S25+ 실기기 Chrome·APK WebView 소프트 키보드에서 [결함 #1] 재현 여부 및 FlowBar 가림.
2. APK 설치본 화면(WebView ≈390px)·딥링크·마이크 권한 등 app-conversion-guide §4 실기기 5항목(이번 012c 는 웹 콘솔이라 범위 밖).
3. Rollback `E_SNAPSHOT_INTEGRITY` 라이브 재현(단위 근거만).
4. PRODUCTION confirm 라이브(금지 범위), LLM 기능 시험 경로(5g 등, 동시 LLM 상한).
5. 다크 모드: 390 에서 토큰 반전만 계산값으로 확인(PASS) — 전 화면 다크 시각 대조는 미수행.

### 복원·정리 확인

- LOCAL 설정 행 복원: `restore.mjs`(기준선 `baseline-before.json` 대조) 최종 plan **총 차이 0** — EngineConnection·EngineFallbackPolicy·AppSetting 바이트 일치(`lastHealth*` 는 다른 세션이 갱신하는 필드라 비교 제외), **ConfigurationVersion LOCAL 0건**(기준선 0 · 이 실행이 만든 0). AuditLog 는 불변이라 QA 계정 행 422건이 남음(정상, 지우지 않음). PRODUCTION 행 조회 0.
- 임시 쿠키 4개(`ck-*`, 600)·needle 파일·로그·E2E 화면 8장·스크린샷 5장·`.qa-012c` 스크립트·복제본 `thekaiwa-qa-012c-b` 삭제 — **산출물 정리: 파일 46개(스크래치패드 23·E2E 화면 8·스크린샷 5·측정 스크립트 10) + 복제본 디렉터리 1개 + 빈 폴더 2개 삭제**.
- 프로세스: dev 3041(PID 661094/661106)·3042(PID 739895/739909) PID 로만 종료, `ss -ltn` 3041·3042 비움. `ls -d ~/.node-local/thekaiwa*` — 내가 만든 복제본 없음(`thekaiwa-qa-021` 은 사전 존재, 내 `.qa-012c` 만 제거).

### QA 시각 검증 (데모 게이트 재현 조건)

- 기준: 승인 데모 v2 = `docs/demo/task-012c-console-p2-v2.html`(check.mjs `DEMO_GATE_PASSED`, hash verified) / 구현 가이드 = Designer §13(2026-10-02).
- viewport: **360×780 · 390×780 · 412×780**(모바일 측정·키보드 모사는 780→450), 데스크톱 E2E **1280×900**. DSF: 측정·키보드 스크립트 **2.625**(isMobile·hasTouch), E2E 스크립트 자체는 DSF 1.
- 브라우저: google-chrome **147.0.7727.101**(playwright-core, `NODE_PATH=/home/brownjeon/node_modules`). 테마: **light 기본**, dark 는 390 에서 토큰 반전 계산값만. locale **ko-KR**, timezone **Asia/Seoul**.
- 글꼴 로딩: `document.fonts.ready` 대기 후 측정. 애니메이션: 주입 CSS + `reducedMotion` 으로 비활성.
- 네트워크 fixture: **없음** — 라이브 dev 서버(3041)·LOCAL DB 직접(외부 호출 0).
- 캡처 범위: 측정값 중심 + 360 상태별 화면(정적 막대·키보드 포커스) 3~5장 — 판정은 px 로 글에 기록.
- 허용 범위(Reviewer 차이 분류 기준): 기하(px) 판정 — 가로 넘침 0(`right > clientWidth` 요소 0), 누를 것 ≥43.5px, 막대-내용 여유 ≥0, 키보드 모사 시 포커스 칸 가림 0. 픽셀 diff 는 하지 않음(데모 v2 와의 정렬은 구조·치수 기준).

## Developer 기록 (QA 결함 #1 FlowBar 키보드 가림 수정, 2026-10-03 06:57)
- [06:57] **QA [결함 #1] Medium 수정 완료 — Leader 확정 사양 그대로**(키보드 열림 동안 FlowBar fixed 영역만 숨김, 하단 탭과 같은 규칙). 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-012c-console-p2.md` → `DEMO_GATE_PASSED` / `task: task-012c`(approved v2). 데모 v2 변경 아님(implementation), 커밋·push·git checkout/restore/stash 없음, LLM 0회·M4 합성 0회, PRODUCTION(3010·pm2·운영 DB 행) 무접촉.

### 변경 파일 · hunk
| 파일 | hunk |
|---|---|
| `src/components/admin/configEditor/FlowBar.tsx` | ① 머리 주석 +2줄(WHY: 줄어든 화면에서 막대가 키보드 위로 따라 올라와 아래 칸을 덮는데 `KeyboardInset` 드러내기는 막대 높이를 모름 → 키보드 열림 동안 막대만 숨기고 빈 자리는 남김). ② `role="region" aria-label="적용 단계"` div className 끝에 `[:root[data-kb]_&]:hidden` **한 토큰 추가**. 빈 자리 `h-[150px] lg:h-[84px]`·나머지 마크업 무변경 |
| `src/components/admin/configEditor/__tests__/flow.test.ts` | 테스트 1개 추가 "막대 렌더: 키보드가 열린 동안(html[data-kb]) fixed 막대만 숨고 빈 자리는 남는다" — `renderToStaticMarkup` 결과의 `<div>` 들을 파싱해 (a) region div 가 `fixed` + `[:root[data-kb]_&]:hidden` 보유 (b) `h-[150px]` 빈 자리는 `aria-hidden="true"`·변형 없음 (c) 변형 보유 div 는 전체 1개 |
| `docs/screens.md` §13-2 E "자리:" 줄 끝 | 한 문장 추가: 키보드 열린 동안 막대만 숨김·빈 자리 유지(하단 탭과 같은 규칙 — `html[data-kb]`, 클래스명, 결함 #1) — **지금 앱(1.0.1) WebView 는 키보드가 창을 줄이지 않아 대상 밖(task-021 네이티브 보정 APK 가 들어오면 같은 규칙으로 숨는다)**. 괄호 꼬리는 사양 문구에 더한 것: task-021 미커밋 `MainActivity.java` 가 IME margin 으로 WebView 를 줄이게 바꿔(APK 대기) 그 뒤엔 앱에서도 `data-kb` 가 켜지므로 "대상 밖"이 영구 사실이 아니다 |
- **무변경 확인**: `src/app/globals.css`(mtime 2026-10-01 08:29) · `src/components/shell/KeyboardInset.tsx`(10-01 09:34) · `src/components/shell/keyboard.ts`(10-01 09:34) — 이번 작업에서 열람만, 편집 0. 규칙은 FlowBar 의 Tailwind 임의 변형만으로 생성된다.

### 검증 (미러 `~/.node-local/thekaiwa-dev-010c` — `rsync -a --delete` 로 src/·tests/·prisma/·public/ 동기화, `npm install`·`prisma generate` 미실행)
| 명령 | exit | 요약 줄(원 출력) |
|---|---|---|
| `node --import tsx --test --test-concurrency=1 src/components/admin/configEditor/__tests__/{flow,configEditor,rawSync}.test.ts` | **0** | `# tests 26` `# pass 26` `# fail 0` `# skipped 0` — 신규 `ok 18 - 막대 렌더: 키보드가 열린 동안(html[data-kb]) fixed 막대만 숨고 빈 자리는 남는다(012c QA 결함 \#1)` |
| 변이: 미러 사본 FlowBar 에서 ` [:root[data-kb]_&]:hidden` 제거 후 `flow.test.ts` | **1**(사망) | `not ok 5 - 막대 렌더: 키보드가 열린 동안 …` `error: '막대에 키보드 열림 숨김 변형이 있어야 한다'` `# pass 8` `# fail 1` → NFS 원본으로 rsync 복원(`cmp` 일치) 후 재실행 exit **0**, `# pass 9` `# fail 0` |
| `node node_modules/typescript/bin/tsc --noEmit` | **0** | 출력 0줄 |
| `node node_modules/eslint/bin/eslint.js …/FlowBar.tsx …/__tests__/flow.test.ts` | **0** | 출력 0줄(0 error·0 warning) |
| `timeout 900 flock ~/.node-local/thekaiwa-build.lock node node_modules/next/dist/bin/next build` | **1** | `Error [TurbopackInternalError]: Symlink [project]/node_modules is invalid, it points out of the filesystem root` — **이 미러는 `node_modules` 가 `~/.node-local/thekaiwa/node_modules` 심볼릭 링크라 Turbopack 이 거부**(코드 무관, `scripts/sync-local.sh` 머리 주석의 알려진 제약 — 재발 가능: 심볼릭 미러에서는 build·dev 불가, tsc·eslint·node:test 만 가능). Next 가 `/tmp/next-panic-2eb4a05edb93ee247e91e8c1b99488fe.log` 를 남김 |
| **CSS 컴파일 대체**: Next 와 같은 `postcss.config.mjs`(`@tailwindcss/postcss` 4.3.3, tailwindcss 4.3.3) 로 미러 cwd 에서 `src/app/globals.css` 를 postcss 직접 컴파일(스크래치 `twcompile.mjs`) | **0** | `bytes 68936 tailwind 4.3.3` |
- **컴파일된 CSS 에 선택자 있음** — `@layer utilities` 블록 끝, 1건:
  ```
  :root[data-kb] .\[\:root\[data-kb\]_\&\]\:hidden {
    display: none;
  }
  ```
  (같은 출력에 021 의 `:root[data-kb] [data-tabbar] { display: none; }` 도 그대로 있음 — 같은 규칙 계열.)
- **헤드리스 확인(실행 — 정적 페이지 방식)**: 위 컴파일 CSS + `renderToStaticMarkup(FlowBar)`(검증 전 상태) + 입력칸 8개로 만든 HTML 을 google-chrome 147.0.7727.101(playwright-core, `isMobile`·`hasTouch`·DSF 2.625, reducedMotion)로 열고 `document.documentElement.dataset.kb='open'` 주입 → 제거 순으로 `getComputedStyle`. 결과 **4/4 PASS**, exit 0:
  - 360×780 · 390×780 · 412×892: 전 `display:block`·`position:fixed`·막대 119px / data-kb 주입 `display:none`(높이 0)·빈 자리 `block` 150px 유지 / 제거 후 `block`·`fixed`·119px 복귀.
  - 1280×900(비모바일): 전 `block`·`fixed`·63px, 빈 자리 84px / 주입 `none` / 제거 `block`·`fixed` 복귀. (실사용에선 `KeyboardInset` 이 coarse pointer·텍스트 포커스 조건이라 데스크톱에서 `data-kb` 가 켜지지 않는다 — 규칙 동작만 확인.)
  - **미실행**: 실제 관리자 화면 + `KeyboardInset` 키보드 모사(QA kbfaithful 재현) — 사유: 이 미러는 위 Turbopack 제약으로 dev 서버 불가, 관리자 세션 필요. → QA 재측정 항목.

### 남은 위험
1. **실기기 미확인**: S25+ 모바일 Chrome 에서 키보드 열림 → 막대 사라짐 → 닫힘 → 복귀를 사람 눈으로 본 적 없음(헤드리스 정적 페이지까지만).
2. **앱 WebView**: 지금 1.0.1 은 `data-kb` 가 안 켜져 동작 변화 없음(가림도 없음 — 창이 안 줄어 막대가 키보드 뒤에 있음). task-021 APK(IME margin 으로 창 축소) 이후엔 앱에서도 숨김이 동작해야 함 → 021 APK 실기기 때 함께 확인.
3. **021 의존**: `data-kb` 는 task-021(미커밋) `KeyboardInset` 이 단다. 012c 가 021 보다 먼저 배포되면 이 클래스는 효과 0(무해) — 그 경우 결함 #1 의 원인(`KeyboardInset.reveal`)도 함께 없는 상태라 같은 가림은 생기지 않지만, 배포 순서는 Leader 판단.
4. 접근성(관찰): 키보드 열림 동안 막대의 `aria-live="polite"` 안내도 `display:none` 이라 그 사이 상태 변화(예: 테스트 초 카운트)는 읽히지 않음. 입력 중에는 막대 버튼을 누를 수 없고(텍스트 칸이 아님 → 누르면 키보드가 닫혀 막대 복귀) 하단 탭과 같은 수용 범위로 판단.
5. 문서 잔여: `docs/screens.md` §13-7 1번(약 7193행)·§13-9 체크리스트(약 7227행)·§13-12 ①(약 7297행)은 "가릴 수 있다/후속" 서술이 그대로다 — 지시 범위(한 문장) 밖이라 손대지 않음, Leader/Designer 정리 대상.

### Reviewer 인계 포인트
- 코드 수정은 **`FlowBar.tsx` 한 곳**(className 토큰 1개 + 주석 2줄). `globals.css`·`KeyboardInset.tsx`·`keyboard.ts` **무변경**(mtime 10-01).
- 빈 자리(`aria-hidden` `h-[150px] lg:h-[84px]`) **유지** — 단위 테스트 (b)·헤드리스 `spacerH` 150/84 불변으로 확인.
- 다른 fixed 하단 요소 영향 없음: `src/components/admin` 에서 `fixed`+`bottom-0` 은 FlowBar 하나뿐(grep). 생성 CSS 규칙은 해당 변형 클래스에만 걸리고(`:root[data-kb] .\[…\]\:hidden`), `[data-tabbar]`·`[data-kb-docked]`·`--safe-bottom` 규칙은 그대로.
- 숨김 기준이 하단 탭과 같은 `:root[data-kb]` — `KeyboardInset` 이 키보드 닫힘 시 `delete root.dataset.kb` 하므로 막대 복귀 경로도 같다.
- QA 재측정 제안: QA kbfaithful(360·390, 실제 탭 + viewport 780→450)에서 포커스 칸 `elementFromPoint` ≠ 막대, 키보드 닫힘 후 막대 `display:block` 복귀.

- 산출물: 스크래치패드(`twcompile.mjs`·`render.tsx`·`headless.cjs`·`compiled.css`·`flowbar.html`·로그) — 프로젝트 밖. 미러에 만든 임시 파일 `.flowbar-render.tmp.tsx` 는 삭제. 미러 `.next` 는 실패한 build 시도로 손댔을 수 있음(개발 전용 미러).
- 출력: `{"taskId":"task-012c","status":"DONE","deliverables":["src/components/admin/configEditor/FlowBar.tsx","src/components/admin/configEditor/__tests__/flow.test.ts","docs/screens.md#e-적용-막대--flowbar--flowview"],"blockers":[],"risk_level":"LOW"}` — 결함 수정이므로 **Reviewer 부터 재순환**.

## Reviewer 기록 (REV-065 FlowBar 키보드 숨김 수정, 2026-10-03 07:05)

- [07:05] **REV-065 = PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 5). 범위: QA 결함 #1(모바일 키보드가 열리면 하단 `FlowBar`(fixed ≈119~150px)가 포커스된 입력칸을 가림)에 대한 Developer 수정 — `FlowBar.tsx` 막대 `div` 에 className 토큰 `[:root[data-kb]_&]:hidden` 1개 + 주석 2줄, `flow.test.ts` 테스트 1개, `docs/screens.md` §13-2 E "자리" 한 문장. **의도를 충족한다**(키보드가 열린 동안 fixed 막대만 숨고 빈 자리는 남으며, 닫히면 돌아온다). native_change = false.
- **실기기 키보드 재현은 이번 감사의 범위 밖이고 Developer 도 하지 않았다 — QA 의 몫**(아래 QA 인계). 내 증거는 컴파일된 CSS 와 헤드리스 Chrome 의 `data-kb` 토글(진짜 키보드·`visualViewport` 가 아님)이다.

### 내가 실행한 증거 (개인 미러 `~/.node-local/thekaiwa-rev-065` = rev-062 사본 + 변경 2파일, `cmp` 로 NFS 원본 일치 확인 · NFS 작업 트리 무수정 · LLM 호출 0)
| 항목 | 결과 |
|---|---|
| `flow.test.ts`+`configEditor.test.ts`+`rawSync.test.ts` (미러 루트, `node --import tsx --test`) | **26/26 pass**, 신규 "막대 렌더: 키보드가 열린 동안…" ok |
| `tsc --noEmit` (미러) | **exit 0**, 출력 0줄 |
| **독립 변이 4종**(미러 `FlowBar.tsx` 에만 적용·원복, 원복 후 NFS 와 `cmp` 동일·9/9) | M1 막대에서 변형 토큰 제거 → **fail 1** · M2 빈 자리에도 변형 추가 → **fail 1** · M3 `data-kb`→`data-keyboard` 오타 → **fail 1** · M4 `:hidden`→`:invisible` → **fail 1**. 4/4 사망 |
| 컴파일된 CSS(스크래치 postcss + `@tailwindcss/postcss` v4.3.3, 미러 `globals.css`=NFS 동일) | `:root[data-kb] .\[\:root\[data-kb\]_\&\]\:hidden { display: none; }` 가 **`@layer utilities` 안에 방출**. 선택자 `&` 치환이 의도대로 `:root[data-kb] <요소>` 후손 결합자(특이도 (0,3,0)). 하단 탭 규칙 `:root[data-kb] [data-tabbar]{display:none}` 은 그대로 |
| **독립 헤드리스 Chrome**(`renderToStaticMarkup`(FlowBar)+컴파일 CSS 한 페이지, `html.dataset.kb` 설정→삭제, 360·390·412·1280px) | 설정 전 막대 `block`(h 119 · ≥1024 63) → **설정 후 `display:none`·`getClientRects()` 0**, 빈 자리 `block` **150px(≥1024 84px) 불변**, 대조군 `[data-tabbar]` 도 `none` → **삭제 후 막대 `block` 복귀**. 4개 폭 모두 같은 결과. 막대 높이 119 는 QA 측정값과 일치 |
| 다른 fixed 하단 요소 | `src/app/(admin)`·`src/components/admin`·`src/components/shell` 에서 `bottom-0`/`fixed inset-x` 는 `FlowBar` 하나뿐(grep) |
| 무변경 확인 | `globals.css`(10-01 08:29)·`KeyboardInset.tsx`·`keyboard.ts`(10-01 09:34) mtime 불변, 이번 수정이 건드린 파일 = `FlowBar.tsx`(10-03 06:53)·`flow.test.ts`(06:53)·`screens.md`(06:56) |
| 데모 게이트 `check` | `DEMO_GATE_PASSED` (task-012c approved v2, hash verified) |

### 8개 관점 판정
1. **의도 충족 — 예.** `KeyboardInset.measure()` 가 `textFocused && (insetPx≥120 || shrunk≥120)` 일 때 `<html data-kb="open">` 을 달고, 아니면 `delete root.dataset.kb`(KeyboardInset.tsx 102~103). 리스너는 `visualViewport` resize·scroll, `window` resize, `focusin`/`focusout`, `orientationchange`, `visibilitychange`, 언마운트 정리(145행 `delete root.dataset.kb`)까지 있어 **고착 경로가 하단 탭과 같은 수준으로 막혀 있다**. 빈 자리(`aria-hidden` `h-[150px] lg:h-[84px]`, `FlowBar.tsx:40`)는 변형이 없어 유지 — 키보드가 열려도 마지막 칸 아래 여유가 남는다. 이 수정으로 `reveal()` 이 막대 높이를 모르는 문제는 **원인이 아니라 증상(막대 존재)을 제거**하는 방식이다 — 키보드 열림 동안 막대가 없으니 계산이 맞아진다(하단 탭과 같은 사용자 결정 D1 A 의 연장).
2. **Tailwind v4 임의 변형 — 정상.** 위 컴파일 결과대로 방출되고 특이도 (0,3,0)·`@layer utilities`. `FlowBar` 막대 `div`(41~46행)에는 `flex`·`block`·`grid` 클래스도 인라인 `display` 도 없어 `display:none` 과 충돌하는 규칙이 없다(`globals.css` 의 `display` 규칙은 `[data-tabbar]`·`.no-scrollbar::-webkit-scrollbar` 두 곳뿐, 막대와 무관). 안쪽 `grid`·`flex` 는 자식이라 부모 `none` 에 가려진다. 하단 탭은 `data-tabbar`+`globals.css`, 막대는 인라인 변형으로 **방식이 다르지만 같은 `:root[data-kb]` 에 걸려** 동작은 동일(L5).
3. **접근성.** `role="region"`·`aria-label`·`aria-live="polite"`(60행) 안내가 `display:none` 으로 접근성 트리에서 빠진다(헤드리스 `getClientRects()` 0). 키보드 열림 동안 막대 안 안내(예: 칸을 고치면 검증 결과가 지워져 "바뀐 값 N개 · 먼저 검증해요" 로 바뀜)는 낭독되지 않고, 복귀 때 다시 낭독되지도 않는다. 하단 탭과 같은 트레이드오프이고 키보드를 내리면 즉시 돌아와 **의도된 범위 안**으로 판단 — 관찰 L3. 숨김은 `display:none` 이라 포커스 가능한 막대 버튼이 키보드 열림 중 포커스를 받는 일도 없다(텍스트 칸에 포커스가 있어야 `data-kb` 가 켜짐).
4. **회귀 영향 — 없음.** 막대 한 곳만 바뀜. PRODUCTION 확인(U-C7)은 막대가 아니라 별도 레이어: `EditorChrome.tsx:84` `FlowBar` 와 `ApplySheet`·`ConfirmDropSheet`(`Sheet` 포털, `fixed inset-x-0 top-0 z-40`, `bottom: var(--kb-inset)`) 가 서로 다른 컴포넌트라 막대 숨김과 무관하게 열려 있다. 막대 정보(단계 4칸·안내·버튼)는 키보드를 내리면 모두 복귀. 단 키보드 열림 중에는 [검증]·[테스트]·[적용]·[초안 버리기] 버튼을 누를 수 없다 — 칸을 고친 뒤 키보드를 내려야 한다(하단 탭이 숨는 것과 같은 사용자 동작).
5. **6층·금기 — 위반 없음.** `FlowBar.tsx` 엔진명·model_id·Secret 0건, 6층 import 변화 없음(`./flow` 타입만), `globals.css`·`KeyboardInset`·`keyboard.ts` 무수정(021 미커밋 변경과 충돌 회피 — 합리적). **데모 v2 와의 차이 분류: implementation** — 데모 v2 `.flow` 는 `position: sticky; bottom: 0; z-index: 8`(모의 화면) 이고 키보드 개념이 없다. 구현은 `fixed`+키보드 열림 숨김이라 정보구조·문구·CTA 동작·단계 수·네비게이션 변화가 **없고** 숨김은 소프트 키보드가 뜨는 환경에서만 생기는 브라우저/기기 상태 대응이다 → 재승인 불필요(material 아님).
6. **테스트 — 변이에 강하나 CSS 방출은 못 본다.** 구조 불변식 3개(막대=`fixed`+변형 / 빈 자리=`aria-hidden`+변형 없음 / 변형 보유 `div` 정확히 1개)를 파싱으로 확인해 구현 복사만은 아님(M2 가 빈 자리 불변식을 따로 죽임). 다만 **클래스 토큰 존재만** 보므로 Tailwind 가 규칙을 방출하지 않는 회귀(업그레이드로 임의 변형 `&` 의미 변경 등)는 못 잡는다 — 내가 위 컴파일·헤드리스로 별도 확인했고 자동 가드는 없음(L2).
7. **문서.** §13-2 E 새 문장(6857행)은 사실과 일치(앱 1.0.1 WebView 가 창을 줄이지 않아 `data-kb` 미설정 → 대상 밖, task-021 네이티브 보정 APK 부터 동일 규칙 — `MainActivity.fitAboveKeyboard`·`versionCode 3`/1.0.2 미커밋 diff 와 부합). 그러나 **같은 문서 안에 낡은 서술 3곳이 남음**(L1).
8. **실제 키보드 시뮬레이션 — QA 책임** (Developer 미수행 명시). 내 검증은 `data-kb` 토글이라 `KeyboardInset` 이 진짜 키보드·`resizes-content` 에서 그 속성을 켜는 것까지는 증명하지 못한다(그 부분은 task-021 QA 가 본 것을 신뢰하되 FlowBar 화면에서 재측정).

### 이슈
```json
{ "reviewId": "REV-065", "status": "PASS_WITH_NOTES",
  "issues": [
    { "issue": "docs/screens.md 낡은 서술 3곳이 수정 후에도 '가릴 수 있다'·data-flowbar+globals.css 방식을 권고로 남김", "severity": "LOW",
      "component": "docs/screens.md:7193 · 7227 · 7297",
      "risk": "다음 구현자·QA 가 §13-12 ① 을 미해결로 읽거나 구현(Tailwind 변형)과 다른 방식(`data-flowbar`+globals.css)을 재도입할 수 있다",
      "evidence": "7193 '§13-12 ① … FlowBar 에 data-flowbar + globals.css :root[data-kb] [data-flowbar]{display:none}' · 7227 체크리스트 '…가려질 수 있다(코드 추적, 실기기 미확인 → §13-12 ①)' · 7297 확인 요청 표 ① 가 여전히 data-flowbar 권고. 6857 새 문장만 갱신됨. Developer 기록도 '지시 범위 밖이라 손대지 않음' 으로 인지",
      "recommendation": "Designer/Leader 가 QA 실기기 결과 확인 뒤 §13-7·§13-9·§13-12 ① 을 '해소 — FlowBar 인라인 변형으로 구현(REV-065)' 으로 정리. 7227 체크리스트는 가림 전제 문장만 고치고 검증 항목으로는 유지" },
    { "issue": "신규 테스트가 클래스 토큰만 보므로 CSS 방출 실패·선택자 의미 변경을 못 잡는다", "severity": "LOW",
      "component": "src/components/admin/configEditor/__tests__/flow.test.ts:76-91",
      "risk": "Tailwind 업그레이드·설정 변경으로 임의 변형 규칙이 안 나와도 단위 테스트는 통과하고 막대가 다시 키보드를 가린다",
      "evidence": "renderToStaticMarkup 문자열 파싱만 사용. 내가 변이 4종은 모두 잡았지만(4/4), 방출 여부는 postcss 컴파일·헤드리스로 별도 확인해야 했음",
      "recommendation": "자동 가드는 선택(CSS 컴파일 테스트는 무거움). QA 가 배포 직전 빌드 CSS 에서 `:root[data-kb]` 변형 규칙 존재를 grep 하는 1줄 확인으로 대체 가능" },
    { "issue": "막대가 숨는 동안 role=region·aria-live 안내가 접근성 트리에서 빠진다", "severity": "LOW",
      "component": "src/components/admin/configEditor/FlowBar.tsx:41-46, 60",
      "risk": "스크린리더로 키보드 입력 중 검증 결과 초기화 등 안내를 못 듣는다(복귀 때 재낭독 없음)",
      "evidence": "헤드리스 `data-kb` 설정 시 getClientRects() 0. 하단 탭과 같은 규칙",
      "recommendation": "조치 불필요(의도된 트레이드오프, 관리자 모바일 콘솔·키보드를 내리면 복귀). 접근성 요구가 생기면 별도 task 에서 시각적 숨김+스크린리더 노출 방식 검토" },
    { "issue": "수정의 실효가 task-021 의 미커밋 웹·네이티브 변경에 묶여 있다 — 현재 앱 1.0.1 에서는 무효과(해도 회귀 없음)", "severity": "LOW",
      "component": "src/components/shell/KeyboardInset.tsx(untracked) · android MainActivity.fitAboveKeyboard(미커밋, versionCode 3)",
      "risk": "FlowBar(`??` 미추적 012c 파일)만 먼저 배포되면 `data-kb` 가 안 켜져 결함 #1 이 계속 보이고, 앱은 새 APK 설치 전까지 동일",
      "evidence": "`git status`: FlowBar.tsx·KeyboardInset.tsx·keyboard.ts `??`, layout.tsx·globals.css `M`. 앱 1.0.1 WebView 는 키보드가 창을 줄이지 않아 `data-kb` 미설정(screens.md 6857·MainActivity 주석)",
      "recommendation": "Leader 가 012c UI 와 021 웹(KeyboardInset·globals.css·layout)을 같은 릴리스로 묶을지 결정. 앱은 021 APK(1.0.2) 설치 후 FlowBar 실기기 확인" },
    { "issue": "같은 `data-kb` 규칙을 두 방식으로 구현(탭=`data-tabbar`+globals.css, 막대=인라인 변형)해 한 곳만 보면 소비처를 놓친다", "severity": "LOW",
      "component": "src/app/globals.css:145-162 (주석이 하단 탭만 언급) · FlowBar.tsx:44",
      "risk": "`data-kb` 속성명·의미를 바꿀 때 FlowBar 를 grep 으로만 찾을 수 있다",
      "evidence": "globals.css 키보드 블록 주석에 FlowBar 언급 0건. FlowBar 주석은 `KeyboardInset` 을 가리킴(단방향)",
      "recommendation": "다음에 globals.css 를 손댈 때 주석에 'FlowBar 는 인라인 변형으로 같은 규칙을 따른다' 한 줄 추가(지금은 021 미커밋 변경과 충돌 회피 위해 미수정이 합리적)" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 5 },
  "high_risk_areas": ["키보드 열림→포커스 칸이 막대 뒤가 아닌 키보드 바로 위에 보이는가(360·390·412, 실제 탭+소프트 키보드)", "키보드를 내린 뒤 막대 복귀(고착 없음) — 뒤로가기·완료 키·바깥 탭·칸 언마운트 각각", "앱 1.0.1 에서는 data-kb 미설정이라 변화 없음 — 앱 1.0.2 APK 에서 재확인", "FlowBar·KeyboardInset 배포 순서 결합(L4)"],
  "native_change": false }
```

### QA 인계 (결함 #1 재측정 — 실제 키보드는 QA 의 몫)
- **측정 방법(웹, 모바일 Chrome 또는 폰 Chrome)**: 콘솔 편집 화면에서 값을 하나 바꿔 막대가 보이게 한 뒤 360·390·412px 에서 ① Form 아래쪽 칸·Raw 편집기 마지막 줄에 포커스 → 소프트 키보드 열림 → `document.documentElement.dataset.kb === 'open'`, 막대 `display:none`(`getComputedStyle(querySelector('[role=region][aria-label="적용 단계"]')).display`), 포커스 칸 `elementFromPoint` 가 칸 자신(막대 아님)·키보드 위 16px 이상, 빈 자리 `height` 150px(≥1024 84px) 불변 ② 키보드 닫기(뒤로가기·완료·바깥 탭 3종) → `dataset.kb` 삭제·막대 `display:block` 복귀(고착 없음) ③ 칸이 조건부로 사라지며 포커스가 풀리는 경우도 복귀 ④ 막대가 숨은 동안 [적용] 시트(PRODUCTION 확인 포함)가 막대와 무관하게 열림.
- **QA 가 이미 가진 방식**: `kbfaithful`(실제 탭 + viewport 780→450) 재사용 — 원래 결함 측정(포커스 칸 390~434 · 막대 상단 331 · 막대 높이 119, 360·390) 이 어떻게 달라지는지 같은 조건으로 재측정.
- **앱**: 1.0.1 은 `data-kb` 가 안 켜져 현상이 그대로일 수 있음 → task-021 네이티브 보정 APK(1.0.2) 설치 후 폰에서 확인(사용자 폰 실측 대기 항목과 합쳐도 됨).
- **빌드 산출 확인(1줄)**: 배포용 빌드 CSS 에 `:root[data-kb] .\[\:root\[data-kb\]_\&\]\:hidden` 규칙이 있는지 grep(L2 대체 가드).

### 데모 게이트·증거 흔적
- `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-012c-console-p2.md` → **`DEMO_GATE_PASSED`**(approved v2, 데모 해시 verified).
- `.claude/state/demo-gate/evidence.jsonl`: 012c 승인 줄 = `approve` v2, `ts 2026-10-01T08:17:28+09:00`, `prompt_ts 08:17:13`, 세션 `f3fdf531`(이 세션). 같은 시각 `prompts.jsonl` 에 사용자 발화 "대기 중인 데모 전부 권고안대로 승인"(08:17:13)이 실재 → 승인-발화 대응 일치. 파일 mtime 10-01 08:17 이후 불변(012c 신규 줄 없음), `events.jsonl` 에서 `check.mjs approve|waive` 호출·`.claude/state/demo-gate/` 쓰기 흔적 0건 → **에이전트 대리 승인·직접 쓰기 흔적 없음**.
- 데모 v2 vs 구현 차이 분류: 위 5번 — **implementation**(재승인 불필요). material·defect 0건.

### Leader 인계
- 판정 PASS_WITH_NOTES — QA 로 진행 가능(Critical 0·High 0). Low 5건은 모두 코드 수정 없이 정리/확인(L1 문서 정리·L4 배포 묶음 결정이 Leader 몫, L2·L3·L5 관찰).
- 이 수정으로 Developer 재순환은 필요 없음. QA 에서 실제 키보드로 막대 가림이 계속되면(예: `data-kb` 미설정 환경) 그때 Medium 으로 격상 후 `reveal()` 이 막대 높이를 빼는 방식(Designer §13-12 ① 의 두 번째 안) 검토.

## QA 기록 (012c 키보드 재측정 — REV-065 이후, 2026-10-03 08:00)

범위: 결함 #1(FlowBar 가 키보드 위로 올라와 아래쪽 입력 칸을 덮음) 수정 — `FlowBar.tsx` 의 `[:root[data-kb]_&]:hidden` — 의 **제한 재측정**. 직접 실행한 증거만 PASS, 못 한 것은 NOT_VERIFIED/미실행으로 적는다. 소스·prisma·정본·데모 수정 0건(리포트만).
환경: 미러 `~/.node-local/thekaiwa-qa-011b`(미러 FlowBar.tsx·KeyboardInset.tsx 가 NFS 와 `diff` 동일 확인) · dev 서버 127.0.0.1:3043(`APP_ENV=LOCAL`) · 역할 계정(admin·developer)만 · 실 LLM 호출 0 · M4 합성 0 · 설정 저장/적용 0건. 데모 게이트 `check.mjs` → `status: approved · approved_version: v2 · hash: verified`.

### 판정: **PASS** — 결함 0건(Critical 0·High 0·Medium 0). Low 관찰 3건 + NOT_VERIFIED 목록은 Leader 판단용
이 재측정은 결함 #1 해소 확인에 한정한다 — task 전체 판정은 앞선 `## QA 기록 (012c 콘솔 P2 — REV-062 이후…)` 와 Leader 가 합산한다.

### 항목별 판정표

| # | 항목 | 판정 | 실행 근거(측정값) |
|---|------|------|--------------------|
| 1a | configEditor 단위 테스트 | PASS | `node --import tsx --test` 26/26 |
| 1b | `tsc --noEmit` | PASS | exit 0 |
| 1c | 넓은 범위 테스트 | PASS | 522건 중 520 pass · 0 fail · **2 skip** — skip 2건은 brand 테스트 "미러에 android/ 없음"(미러 구성 때문, 제품 결함 아님) |
| 2 | 키보드 동반 가림(핵심) 360·390·412 — ①`data-kb==='open'` ②막대 `display:none` ③포커스 입력칸이 보이는 영역 안 + 칸 중앙 `elementFromPoint`=입력칸 ④스페이서 높이 불변 | **PASS** | claude-cli-local 텍스트 입력 5개(`runtime.modelByTier.fast·balanced·deep`·`runtime.prewarmMaxIdle`·`runtime.prewarmIdleTtlSec`) × 3폭 전부 `kb=open` · `bar=none` · 입력 **389.5~433.5 / vh 450**(키보드 위 여백 16.5) · hit=`input` · 스페이서 **150→150**. 화면 아래쪽(탭 전 입력 519.5~563.5)에서 탭해도 389.5~433.5 로 올라와 보임. 스크롤 끝 맨 아래 칸은 102.5~146.5(여백 303.5) |
| 2c | 옛 결함 재현(대조군) | PASS(하니스 유효) | 숨김 규칙만 CSS 로 무력화(`:root[data-kb] [role="region"][aria-label="적용 단계"]{display:block!important}`) → 막대 **331~450(h 119)** · 입력 **389.5~433.5** · hit=`div`(막대가 칸을 덮음) — 기존 결함 수치(입력 390/434 · 막대 상단 331 · 높이 119)와 일치. 대조 해제 후 막대 다시 `none` |
| 2d | 키보드 없이 포커스만 | PASS | `kb=null` · 막대 `block`(터치·포커스만으로는 숨지 않음) |
| 3 | Raw JSON(DEVELOPER) 마지막 줄 — 같은 4항목 | **PASS** | textarea(`aria-label="설정 JSON"`, rows 21, 높이 524) 3폭 모두 `kb=open` · `bar=none` · 중앙·아래끝 hit=textarea · 스페이서 150→150. 캐럿 이동 측정(키보드 450 + `Control+End`): 막대 숨김 상태에서 hit=`textarea`, **대조(막대 강제 표시)에서는 막대 331~450 이 마지막 줄 line box(429~453)를 통째로 덮고 hit=막대** — 수정 효과 확인. 관찰 O-1 참조 |
| 4a | 복구 경로 A: 뷰포트 780 복원 | PASS | 3폭 `kb=null` · 막대 `block/fixed` 661~780(h 119) · 버튼 최소 44 · 넘침 0 |
| 4b | 복구 경로 B: blur | PASS | 3폭 `kb=null` · 막대 `block/fixed` 331~450(뷰포트 450 기준 하단) |
| 4c | 복구 경로 C: 바깥 탭 | PASS | 3폭 `kb=null` · 막대 복귀 · active=body |
| 4d | 필드 소멸 복구: ① 탭 전환(Diff) ② 포커스 이동 없는 소멸 | PASS | ① 입력 0개 · `kb=null` · 막대 복귀 ② 소멸 직후(뷰포트 450 유지) `kb=null` · 막대 `block`; 780 복원 후 `block/fixed` |
| 5 | 적용 흐름 회귀(키보드 닫힘, **적용 안 함**) | PASS | 3폭: [검증] → [기능 테스트]("일부만 확인") → Diff(`runtime.vad.threshold` 줄) → [적용…] 대화창 열림. 이유 입력칸 보임(예: 360px 에서 548.8~618.8/vh 780)·hit=입력칸 · [적용] 버튼 높이 48 · 시트 가로넘침 0 · `data-kb` 없음 · Escape 로 닫음(DOM 0). **저장·적용 0건** |
| 5b | 온디바이스 연결(reazon-ondevice) 입력 2개 390px | PASS | `runtime.vad.endpointSilenceMs`·`runtime.vad.threshold` 둘 다 `kb=open` · `bar=none` · 입력 390~434/vh 450 · hit=input · 스페이서 150→150 |
| 6 | 정적(키보드 없음) 360·390·412 | PASS | 문서·본문 가로넘침 0(요소 `right>clientWidth` 0) · 막대 `fixed` **h 119** 661~780 · 스페이서 **150** · 버튼 ≥44(`초안 버리기` 176×44·`검증` 174×44 @390) · 막대 윗선~마지막 본문 여백 **71**(≥0) · 페이지 세로 스크롤 0 |
| 6b | 정적 1280×800 | PASS | 막대 `fixed` · **left 232**(사이드바 오른쪽)·bottom 800 · 스페이서 **84** · 버튼 44 · 여백 61 · 넘침 0 — 관찰 O-2 참조 |
| 7 | 콘솔·페이지 오류 | PASS | 전 구간 0건 |
| — | 실기기 S25+ Chrome 가상 키보드 · APK WebView · 스크린리더 | **NOT_VERIFIED** | 아래 목록 |

실행 체크 합계: core 69/69 · recovery 36/36 · raw 4항목 9/9 · raw 캐럿+온디바이스 5/5 · 적용 흐름+1280 정적 25/25 = **144/144 PASS**. 이 밖에 첫 실행에서 FAIL 로 찍힌 4건은 아래 "첫 실행 FAIL 4건 해명"(제품 결함 아님)에 정직하게 남긴다.

### 전·후 비교(핵심 수치)

| 항목 | 옛 결함(대조군 = 숨김 규칙 무력화) | 수정 후(실측) |
|---|---|---|
| 막대 `display` | `block` | **`none`** (`data-kb=open`) |
| 막대 위치 | 331~450 (h 119) | 없음(레이아웃에서 빠짐) |
| 아래쪽 입력 칸 위치 | 389.5~433.5 | 389.5~433.5(동일 — 막대만 사라짐) |
| 입력 칸 중앙 hit | `div`(막대) | **`input`** |
| Raw JSON 마지막 줄(429~453) hit | 막대가 통째로 덮음 | `textarea` |
| 스페이서 | 150 | 150 → 150(불변, 본문 끝 여유 유지) |
| 키보드 닫음 후 | — | `kb=null` · 막대 `fixed` 661~780 · h 119 · 버튼 44 |

### 원문 발췌(실행 출력)

```
browser 147.0.7727.101
PASS | K360-1 runtime.modelByTier.fast: ①data-kb=open ②막대 display:none ③입력칸 보임·elementFromPoint=입력칸 ④스페이서 불변 | pre.kb=null kb=open bar=none 입력 389.5~433.5/vh 450 (키보드 위 여백 16.5) hit=input spacer 150→150
PASS | C360 대조(숨김 규칙 무력화) → 막대가 입력칸을 덮음(하니스 유효성) | bar 331~450(h 119) · 입력 389.5~433.5 · hit=div
PASS | K360-L runtime.prewarmIdleTtlSec(화면 아래쪽에서 탭, top 519.5): ①②③④ | 탭 전 입력 519.5~563.5 → kb=open bar=none 입력 389.5~433.5/vh 450 hit=input spacer 150→150
PASS | P390A 뷰포트 450→780 복원 → data-kb 해제 · 막대 fixed 복귀 · 높이 119 · 버튼≥44 · 넘침 0 | kb=null bar=block/fixed rect 661~780 h119 active=input btnMin=44 overflow=0
PASS | P390D2 포커스 이동 없는 필드 소멸 → … | 소멸 후 450: kb=null bar=block active=body / 뷰포트 780 복원 후: kb=null bar=block/fixed
RAW JSON CARET 390px [수정 후] {"kb":"open","vh":450,"ta":{"top":-61,"bottom":463,"h":524},"lastLineBottom":453,"bar":{"display":"none"},"hitDesc":"textarea","selEnd":true}
RAW JSON CARET 390px [대조]    {"kb":"open","vh":450,"bar":{"display":"block","top":331,"bottom":450},"hitDesc":"div(막대)","selEnd":true}
A360d 적용 창: {"kb":null,"reason":{"top":548.8,"bottom":618.8,"h":70,"inView":true},"reasonHit":true,"applyBtn":{"top":728.8,"bottom":776.8,"h":48,"inView":true},"sheetOverflow":0,"docOverflow":0,"vh":780}
static[1280] {"kb":null,"docOverflow":0,"overCount":0,"bar":{"display":"block","position":"fixed","top":737,"h":63,"left":232,"bottom":800},"spacerH":84,"margin":61,"btns":["초안 버리기:98x44","검증:54x44"],"minBtn":44}
```

### 관찰(Low — 결함 아님, Leader 판단용)

- **O-1 (Low) 긴 텍스트영역 마지막 줄은 브라우저 네이티브 캐럿 스크롤 의존** — Raw JSON textarea 는 높이 524 로 키보드 450 보다 커서 `revealDelta` 가 0 을 돌려준다(task-021 설계, `keyboard.ts`: 칸이 보이는 영역보다 크면 브라우저에 맡김). 에뮬레이션에서 탭만 한 직후(캐럿 이동 전)에는 textarea 아래 끝이 544 로 vh 450 밖이다. `Control+End` 로 캐럿을 끝으로 옮기면(Chrome 네이티브 캐럿 스크롤) 마지막 줄 line box 가 429~453 — 아래쪽 3px 가 키보드 경계에 걸친다. 수정(막대 숨김)의 효과는 대조군으로 확인했고(막대가 있으면 그 줄이 통째로 가려짐), 줄 가시성 자체는 **실기기 IME 에서만 확정 가능**하다. 조치 불필요, 실기기 확인 항목에 포함.
- **O-2 (Low) 문서·task 문구와 실측 차이** — 지시문의 "lg 84" 는 **스페이서** 높이다(실측 84 ✓). 1280px 막대 자체 높이는 **63**(모바일 119 와 다름)이며 여백 61 이라 가림은 없다. 표기만 "막대 63 / 스페이서 84"로 정리하면 된다(Reviewer REV-065 관찰과 같은 종류).
- **O-3 (Low) 쓰기 흔적 1건 — 설정 아님** — 측정 전·후 LOCAL `ConfigurationVersion` 0→0, `AuditLog` 546→546, EngineConnection·FallbackPolicy·AppSetting 해시 전부 동일(변경 0). 단, `EngineHealth` 가 87→88: 새 행은 `style-bert-m4`(LOCAL) `kind=HEALTH`·`HEALTHY`·latency 6ms·checkedAt 2026-10-02T22:56:22Z(= 07:56:22 KST). 앞선 행(22:06:07Z·15:31Z)도 같은 종류라 주기 점검 또는 다른 dev 서버(3041)의 점검일 가능성이 높으나, 내 [기능 테스트] 클릭이 원인일 가능성은 배제하지 못했다(원인 귀속 불확실). 추가 전용 점검 기록이고 설정이 아니라 삭제하지 않았다.

### 첫 실행 FAIL 4건 해명(투명 공개)

1. `RAW360b·390b·412b`(3건): 내가 task 항목 밖에서 추가한 확장 어설션 "textarea 아래 끝 ≤ vh". 524px textarea 는 정의상 만족 못 하는 기준이고(위 O-1), 제품 결함이 아니다. **어설션을 완화하지 않고** 별도 `RAWC`(캐럿 이동 후 마지막 줄 위치 기록 + 막대 대조)로 대체해 수치를 O-1 에 공개했다.
2. `ONDEVICE 실행 오류(TimeoutError)`: 하니스가 마지막 칸을 맨 아래 스크롤로 맞췄더니 칸이 고정 막대(661~780) 아래에 가려져 탭을 못 한 것(칸 top 750). 스크롤을 `scrollIntoView({block:'center'})` 로 바꿔 재실행 → 입력 2개 모두 PASS(5b).

### 환경 한계(에뮬레이션 — 숨기지 않는다)
Playwright 의 `setViewportSize`(780→450, 실제 `touchscreen.tap` 으로 포커스 후)는 Chrome `resizes-content` 의 창 축소 + `data-kb` 경로를 재현하지만, **실제 IME 표시 시 Chrome 이 하는 "편집 칸 스크롤 인 뷰"·추천 단어 띠 높이 변화·`visualViewport` 미세 변화는 재현하지 않는다**. 위 PASS 는 "막대가 키보드 열림 동안 레이아웃에서 빠지고 닫히면 복귀한다"까지의 증거다.

### NOT_VERIFIED(미실행 사유 포함)
- 실제 S25+ Chrome 가상 키보드(IME 네이티브 스크롤·추천 띠·`visualViewport`) — 실기기 필요, 사용자 육안 확인
- APK WebView — 앱 1.0.1 은 `data-kb` 가 켜지지 않아(Capacitor 가 키보드 인셋을 WebView 에 넘기지 않음, `KeyboardInset.tsx` 주석) 현상이 그대로일 수 있음. **task-021 네이티브 보정 APK(1.0.2) 설치 후 폰에서 재확인**
- 스크린리더(TalkBack) 접근성 — 키보드 열림 동안 `role=region` 이 사라지는 점 포함, 미실행
- 다크 테마 렌더 — 이번 재측정은 light 만(미측정)
- 배포용 빌드 CSS 의 `[:root[data-kb]_&]:hidden` 규칙 확인(Reviewer 제안 L2) — 이번 범위가 dev 서버 한정(`npm run build` 금지)이라 미실행

### QA 시각 검증 조건(재현 조건)
- 브라우저: playwright-core + google-chrome **147.0.7727.101** headless, `isMobile`·`hasTouch`(coarse pointer 확인 true)
- 뷰포트: **360 / 390 / 412 × 780**, 키보드 열림 = 높이 780→**450**(탭으로 포커스한 뒤 `setViewportSize`, 800ms 안정 대기), 데스크톱 **1280×800**
- DSF: 모바일 **2.625**, 데스크톱 1
- 테마: **light 만** · locale **ko-KR** · timezone **Asia/Seoul** · `prefers-reduced-motion: reduce`
- 글꼴·로딩: `goto(..., waitUntil: networkidle)` 후 입력 칸 `waitForSelector` · 각 상태 250~800ms 대기
- 애니메이션: 비활성(reduced-motion + 주입 CSS `animation/transition-duration:0s`, `nextjs-portal` 숨김)
- 네트워크 fixture: **없음**(dev 서버 3043 LOCAL·실 DB, LLM·M4 호출 0)
- 캡처 범위: **DOM 계측만 — 스크린샷 0장**(근거는 측정 px·요소·hit 대상으로 기록)
- 허용 범위(Reviewer 차이 분류): 좌표·여백 ±0.6px, 터치 대상 ≥43.5px 를 같음으로 본다. 그 밖은 implementation 차이로 기록하고, 데모 v2 승인 범위를 넘는 구조 차이는 material 로 올린다(이번 측정에는 material·defect 0)

### 정리 확인
- 프로세스 정리: dev 3043 종료(PID 1179160·자식 1179176·1179248, PID 파일 기준 `kill`) · `ss -ltn` 에서 3043 비어 있음. 다른 QA(3041)·운영 3010 은 건드리지 않음
- 산출물 정리: **20개 삭제**(스크래치패드 `qa-kb` 17개[쿠키 2개 포함] + 미러 `.qa-kb` 3개) · 스크린샷 0장 · `/tmp/qa-artifacts` 에 내가 만든 것 없음(08:01 확인 시 존재하는 `TheKaiwa/task-025` 는 task-025 QA 의 것 — 건드리지 않음)
- 복제본: 내가 만든 `~/.node-local/thekaiwa*` 복제본 없음(`thekaiwa-qa-011b` 는 지정받은 기존 미러 — 삭제 안 함)
- DB: LOCAL ConfigurationVersion 0→0 · AuditLog 546→546 · 연결·정책·AppSetting 해시 동일, 쓰기 흔적은 O-3 의 EngineHealth +1 뿐

### 인계
- 결함 0건 — Developer 반송·Reviewer 재순환 없음. 이 재측정은 REV-065 수정의 PASS 확인이며, task 전체 진행·배포 판단은 Leader(앞선 QA 기록과 합산).
- 사용자 육안 확인 필요: 위 NOT_VERIFIED 목록(특히 S25+ Chrome IME 에서 Raw JSON 마지막 줄 가시성, APK 1.0.2 이후 앱 WebView)

## Leader 기록 (키보드 재측정 QA PASS 수용, 2026-10-03 08:05)

REV-065 이후 키보드 재측정 QA(2026-10-03 08:00, 144/144 PASS)의 원 기록을 Leader 가 직접 읽고 확인했다 — 대조군(수정 전 동작)이 옛 결함을 재현하고 수정본에서 닫히는 것까지 보았다.

- **결함 #1(FlowBar 가 모바일 키보드 입력칸을 가림) 종결.** Developer 반송·Reviewer 재순환 없음. 서버·보안 축은 앞선 QA(78/78 UI E2E, Secret 비반사, 쓰기 진입점 9곳) PASS 가 그대로 유효하다 — 이번 수정은 FlowBar 의 `data-kb` 숨김 1개와 스페이서 유지뿐이라 서버 코드를 건드리지 않았다.
- **Low 3건 수용(수정 없음)**
  - O-1: Raw JSON 마지막 줄이 키보드 가장자리를 3px 넘는다 — 네이티브 캐럿 스크롤에 달린 값이라 헤드리스로 확정할 수 없다. **사용자 폰 확인 항목**으로 둔다(S25+ Chrome IME).
  - O-2: 문서 표현(바 63px / `lg` 스페이서 84px) — `docs/screens.md` 정리 때 같이 고친다.
  - O-3: 기능 테스트가 `EngineHealth` 를 +1 했다 — 설정 변경이 아니다(ConfigurationVersion 0→0, AuditLog 546→546).
- **배포 묶음**: FlowBar 는 task-021 의 `data-kb`(KeyboardInset)에 의존하므로 **021 과 같은 웹 배치**로 나간다. 앱 WebView 는 APK 1.0.2(versionCode 3) 이후에만 키보드에 맞춰 줄어든다.
- **012c 상태**: QA 전 축 PASS → **배포 대기**. 남은 것은 Low 묶음(`task-012c-ui-fix` 후보: ⑦ 미사용 `EffectiveScreen` default export·`ConfigAccess.note` · ⑧ REV-054 Lows · ⑨ damage 문구·`issues[].key` 표시 · `MicTestCard.tsx:132` sr-only `<p>` 스크롤 · REV-062 L4 · REV-065 Lows 2/3/5), `docs/screens.md` 문구 정리, 빌드 CSS 에서 `[:root[data-kb]_&]:hidden` 규칙 존재 확인(Reviewer L2 — 푸시 전 빌드 때), 사용자 항목 U-C7(SUPER_ADMIN 운영 확인창 리허설)·폰 확인.
- 위 `## 최종 요약` 절(codex 임시 문구)은 012c 배포 완료 때 Leader 가 다시 쓴다.
