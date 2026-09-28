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
updated: 2026-09-29
demo_gate:
  required: true
  level: "full"
  status: "drafting"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
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
| **012c (이 이력서)** | **설정 편집 코어**: 편집 가능 키 표(D-C4)·Validate(5단계)·Test(후보로 Functional Test)·Diff(#106, blocked·summaryHash)·Apply(#107, 버전+감사+물화 한 트랜잭션)·Raw JSON(#110·#111 dryRun)·버전 목록/상세(#108·#108a)·Rollback(#109)·연결 수정(#93)·enable/disable(#93a)·**credentialRef 연결(#93b)**·Fallback 편집(#100)·AppSetting(#123b, 정책 키 제외)·VoiceProfile 기본값(VOICE_PROFILE scope)·**감사 조회(#137)**·PRODUCTION 보호(§8-1)·**선결 보안 3종(D-C3)**·FT 슬롯 원자성(D-C9) + 화면(설정 Form/Raw/Diff 탭·연결 상세 편집·역할 페이지 Fallback 편집·이력 화면·PRODUCTION 확인 다이얼로그) | 서버: 없음(스키마 0). 화면: **데모 승인(U-C4)**. 운영 반영 뒤 PRODUCTION 리허설(U-C7) | **full**(judge) |
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
| D-C3 | **편집 전 선결 보안 3종(R2)** | 003d C2 F1·005b 한계 ② | (a) **시크릿을 보내는 모든 어댑터 origin 고정** — home-m4 `x-api-key` 는 지금 DB `connection.baseUrl` 로 그대로 나감 → 서버 env(`AI_API_BASE`) origin 과 같을 때만 전송, 아니면 호출 0·MISCONFIGURED(TTS `readServiceSecretFor` 패턴 재사용). (b) **credentialRef 허용 목록** — `env:` 이름은 엔진 스키마가 허용한 이름만(home-m4 = API 키 변수 2개), 부팅 시크릿 계열(JWT·내부 시크릿·TTS 시크릿·DB URL·OAuth 시크릿·초대코드 등) 거부. 안 그러면 SUPER_ADMIN 이라도 ref 를 부팅 시크릿으로 바꿔 그 값을 연결 주소로 보낼 수 있다. `file:` 은 기존 이름 규칙(SECRETS_DIR 안). (c) **baseUrl 호스트 허용 목록** — loopback·LAN(192.168.219.0/24)·서버 env 에 적힌 서비스 origin 만, Validate(편집)·Health·Test·실호출 공통, userinfo·비 http(s) 거부. `connection.binPath` 는 계속 spawn 에 쓰지 않음(READ_ONLY) |
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
8. 보안: 허용 밖 baseUrl → Validate 400 + (DB 를 직접 바꿔도) 어댑터 호출 0·시크릿 전송 0 · credentialRef 부팅 시크릿 계열 → 400 · Health SSRF 허용 목록 · 응답·감사·스냅샷·서버 로그에 시크릿 형태 문자열 0(grep, 005b 방식).
9. #93b: SUPER_ADMIN 만, 값 필드 400, ref 형식·허용 목록·존재 확인, 버전+감사(`credentials.set`/`credentials.clear`).
10. FT 슬롯: 두 프로세스(3017·3018) 동시 요청 → 실행 1건(Claude 호출 1)·나머지 429.
11. #137: 필터·페이지, LEXICON 필터에 옛 `scope=null` `lexicon.*` 포함, `before/after` 에 값 0.
12. 화면(데모 승인 뒤): Form↔Raw JSON 단일 draft 동기화·Diff·적용·Rollback·PRODUCTION 확인 다이얼로그·권한별 버튼 **렌더링 0**(비활성 아님), 360/390/412 + 데스크톱 넘침 0, 엔진명 하드코딩 0(DTO 표시명만).
13. 회귀: 005b·003g 스모크 PASS, 회화 턴 p50 무영향(007 latency), 스모크 뒤 LOCAL 대상 행·버전 수 기준선 동일.

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

### developer 인계 (2026-09-29, Leader → developer A(opus) — 서버)
**착수 시점**: **task-012b 커밋(QA PASS) 뒤**. 012b 가 미커밋으로 `src/modules/{infra/index.ts,infra/internalAuth.ts,infra/users.ts,admin/health.ts,engine/stt/index.ts,preferences/index.ts,speech/index.ts,speech/utterances/**}` 를 고치고 있다 — 그 전에는 아래 0단계(읽기 전용 조사)만. Codex C1 결과가 오면 채택분을 먼저 반영한다(Leader 가 이 절에 덧붙임).

**읽을 것(이 순서)**: 이 이력서 "003g 패턴 재사용"·"설계 결정 후보 D-C1~D-C13" 표 + "03:20 Leader(메인) 확정" + "02:45 정본 갱신" → `docs/design/configuration-resolution.md` §6-1~§6-3(012c 단락)·§8-1·§8-2·§10(편집 선결 게이트)·§11 · `docs/design/api-contract.md` §2-19·§2-21(#93·#93a·#93b·#96)·§2-23(머리 규칙~#111)·§2-24 #123b·§2-27 #137 · `docs/design/role-permission.md` §3·§4-2·§6·§7 · `docs/design/admin-console/{03,04,06,08,09,10}`(머리 주석 우선) · `docs/design/module-dependency.md` 규칙 6·8 · 선례 코드 `src/modules/admin/speech/lexicon.ts`(L0 조합·PRODUCTION·감사) · `src/modules/speech/tts/lexiconStore.ts`(잠금·버전 전이) · `lexiconRules.readSnapshotStrict`(엄격 재검증) · `src/modules/admin/permissions/*` · `src/modules/engine/configuration/resolver.ts` · `src/modules/engine/router/index.ts`(행 JSON·30초 캐시·`clearRouterCache`).

**범위 = 012c 1단계 서버. 스키마 0 · 화면 0(데모 게이트) · M4·Python 0.**
0. **"편집 키 표" 선행(012b 커밋 전에도 가능, 읽기 전용)** — 각 어댑터 스키마 키(`src/modules/engine/adapters/**/*.provider.ts`) × {소비자 APP/PYTHON/CLIENT · 런타임이 실제로 읽는 곳(파일:행 — 행 JSON 인지 env 인지) · editability · strict · env 가 이기는지 · 012c 편집 허용 여부와 이유}. `FALLBACK_POLICY` 칸, `AppSetting` 일반 키(`appSettingSchema` 초안), `VoiceProfile.defaults` 칸 포함. 결과를 이 이력서 "Developer 기록" 에 표로 → **Leader 확인 뒤 확정**(허용 = APP 소비 + 동등성 테스트 가능한 키만, D-C4).
1. **첫 커밋 = D-C3 선결 게이트 + D-C9** (주소·자격 키 편집 API 는 이 커밋이 reviewer 를 통과하기 전 열지 않는다):
   - (a) home-m4 API 키 전송 대상 고정 — `src/modules/engine/llm/index.ts` 209~212(DB `connection.baseUrl` 로 키 전송)를 TTS 의 `infra.readServiceSecretFor` 방식으로: 허용 origin = 서버 env(`AI_API_BASE`) origin, 다르면 호출 0·`MISCONFIGURED(TARGET_NOT_ALLOWED)`. 시크릿을 보내는 다른 어댑터가 더 있는지 전수 확인해 기록.
   - (b) credentialRef 허용 목록 — 엔진 스키마에 연결별 허용 `env:` 이름, 부팅 시크릿 계열 거부 목록(세션 서명 키·내부 서비스 시크릿·TTS 서비스 시크릿·DB URL·OAuth 시크릿·초대코드 등 — 실제 env 이름 목록은 코드 상수, 문서·로그에 값 없음), `file:` 기존 규칙. `rule:"refNotAllowed"`.
   - (c) 연결 주소 호스트 허용 목록 — loopback·`192.168.219.0/24`·서버 env 서비스 origin, userinfo·비 http(s)·리다이렉트 추종 거부. Health(`engine/adapters/common/httpHealth.ts`)·Functional Test·실호출·Validate 공통 헬퍼. `rule:"hostNotAllowed"`.
   - D-C9: `src/modules/engine/functionalTest/index.ts` `claimSlot` → `EngineConnection.lastFunctionalAt` 조건부 UPDATE(영향 1행일 때만), 메모리 Map 제거.
   - 단위 테스트(반례: 다른 origin·같은 host 다른 port·IPv6·기본 포트 표기·userinfo·리다이렉트·부팅 시크릿 ref·없는 ref) → reviewer 먼저 한 번(Leader 가 REV 요청).
2. `src/modules/engine/configuration/{editable,validate,diff,versions,rollback}.ts`(+ `appSettingSchema`) — Validate 5단계·rule 15종, Diff(blocked·무상태 summaryHash), 버전 기록(기준선 v1·`_meta`·diff 봉투·`restoredFromVersion`), 목록/상세/compare/integrity, Rollback 엄격 재검증. engine 은 버전·검증·Diff 만 — 대상 물화는 소유 층.
3. 소유 층 tx 쓰기 공개 함수: engine(`EngineConnection` 칸·enabled·credentialRef, `EngineFallbackPolicy`) · preferences(`AppSetting` — `voice.preview.defaultText` 변경 시 `textVersion` +1) · speech(`VoiceProfile.defaults`·표시명·정렬). 전부 `(tx, …)` 인자.
4. `src/modules/admin/configuration/{editor,history}.ts` — `infra.withTransaction` 하나(대상 행 `FOR UPDATE` → `baseVersion` → 기준선 → 물화 → 버전 → 감사), PRODUCTION 게이트 전 항목(`confirm:"PRODUCTION"`·summaryHash 재계산·testResultId(`EngineHealth` 행: ok·30분·대상·`detail.candidateHash`)·reason≥10·SUPER_ADMIN·엄격 키 본인·교차 환경 `crossEnvironment`), 감사 action(`config.baseline|apply|raw_apply|rollback`·`credentials.set|clear`·`engine.connections.enable|disable`), 커밋 뒤 캐시 무효화. #137 감사 조회(LEXICON = 옛 `scope=null` `lexicon.*` 포함).
5. 라우트: `src/app/api/admin/v1/{config/{validate,test,diff,apply,versions,versions/[id],versions/[id]/rollback,raw/[scope]/[targetId]},engine-connections/[id](PUT 추가),engine-connections/[id]/{enabled,credential},fallback-policies/[role](PUT 추가),app-settings/[key],audit}/route.ts` — 첫 줄 `requireCapability`, 얇게. DTO 는 `src/types/admin.ts` 설정 절(단일 출처).
6. 테스트: `src/modules/{engine,admin}/__tests__/task012c*.test.ts` — 매트릭스(ADMIN Form·DEVELOPER Raw·SUPER_ADMIN credential), PRODUCTION 게이트 전 분기(가짜 env), 기준선·동시 2요청·변경 0·NO_CHANGE·ALREADY_ACTIVE·422 재검증·droppedKeys, **편집 허용 키 전부 "런타임 실사용값 == Effective" 테스트**, 감사 1:1, 시크릿 grep 0. 라이브 `tests/live/task012c-smoke.{sh,ts}`.

**하지 말 것**: `prisma/schema.prisma` 변경·`db push`(완료 조건 = 빈 diff) · 화면(`src/components/**`·`src/app/(admin)/**`·`menu.ts` 의 phase 열기 — 데모 승인·activate 뒤 developer B) · `src/modules/conversation/**`·`.claude/agents/tutor.md`(012c-2) · Python(`speech/**`) · `ecosystem.config.js`·`deploy.yml`·`.env*` · **PRODUCTION 행 라이브 쓰기(교차 환경 포함) 금지** — PRODUCTION 경로는 단위 테스트로만 · 운영 3010·운영 pm2 금지 · 커밋·push 금지(완료 후 변경 파일 목록을 기록, Leader 가 QA PASS 뒤 커밋).

**개발 환경**
- 격리 복제본 `~/.node-local/thekaiwa-012c-<시각>`(미러에서 `node_modules` 는 `cp -al`, `.next`·`logs` 제외 — ACTIVE "운영과 분리한 빌드 검증" 패턴), **dev 포트 3019**(2프로세스 경합 시험은 같은 복제본 하드링크로 3020 추가), `-H 127.0.0.1`, `APP_ENV=LOCAL`. **기동은 `env -i HOME="$HOME" USER="$USER" LANG="$LANG" PATH="$PATH" APP_ENV=LOCAL node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3019`**(에이전트 세션 env 가 Claude CLI 자식에 넘어가면 `ClaudeCliExecError` — 012b 트러블슈팅). 브라우저 확인은 `localhost:3019`. 작업 뒤 `ss -ltn` 으로 3019·3020 정리, 복제본 삭제.
- **QA 계정: 사용자(USER)는 `qa-bot`(QA_ACCOUNT=1)만** — `qa-bot2` 는 012b 라이브가 쓴다. 역할 계정 `qa-admin`·`qa-developer`·`qa-super`(tests/live/qa-session.ts)는 사용 가능.
- DB 는 운영과 공유 — **LOCAL 행만**. 스모크는 시작 전 LOCAL 대상 행(연결·Fallback·AppSetting·VoiceProfile)과 버전 수를 기록 → 끝에 **자기가 만든 `ConfigurationVersion` 행만 id 로 삭제 + 대상 행 바이트 원복 대조**(003g 선례). AuditLog 는 불변이라 남는다(QA 계정 행). 개발 dev 서버의 연결 행이 바뀌므로 다른 에이전트의 LOCAL dev 서버(3011·3017 등)가 떠 있으면 시험 시간을 기록.
- Claude 구독: LLM 연결 config/test 는 30초 1회 슬롯, 스모크의 LLM 호출 수를 기록.

**완료 보고("Developer 기록")**: 편집 키 표(0단계) · 변경 파일 목록 · tsc·eslint·단위 결과 · 라이브 완료 기준 1~11(화면 12 제외) 중 확인한 것 · D-C3 반례 결과 · 정본과 다르게 한 점 · 남은 위험. 다음은 reviewer → judge C2.

## Codex 검토
- C1: judge `codex_required=true`(adversarial-review · security, 2026-09-29 02:35) — **Leader(메인) 호출 대기**.

## Designer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 배포 기록

## 최종 요약
