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
  status: "review_requested"
  version: 2
  repo_path: "docs/demo/task-012c-console-p2-v2.html"
  artifact_url: "https://claude.ai/artifact/6xHJK9pXzMpWxCfSZaT65o"
  content_sha256: "39b19fc822fdf8993110aac66a1ad652ae37bf757a176e4a3301508b5067583e"
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
