---
task_id: task-005b
title: "Admin Console 골격 (읽기 + Health·Functional Test)"
status: in-progress
base_ref: 36ebc7e
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, codex]
related_tasks: [task-002-phase0-scaffolding, task-004-ai-client-persona, task-006-chat-correction, task-008-vocab-today-words]
tags:
  - type/task
  - domain/admin
  - domain/engine
aliases:
  - 관리자 콘솔 골격
  - AI Engine Console
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-005b: Admin/Developer AI Engine Console 의 Phase 1 골격 — capability 가드(USER `/admin` 404), Dashboard, Effective Config + Source(env 가 덮어쓴 키는 `ENVIRONMENT`), Plugins·Connections, Health/Functional Test → `RequestTrace`·`EngineHealth`, Trace 조회, Secret 미노출.
정본: `docs/design/admin-console/00~16`(특히 00 §7 Phase 배치·01 메뉴 표·02 권한·03 Schema·04 Effective resolver·05 Source 우선순위·13 Trace·16 Environment), `docs/design/role-permission.md`, `docs/design/configuration-resolution.md`(8층), `docs/design/api-contract.md` §1 admin 표(#80~#129 중 Phase 1)·§0-3 capability 규약, `docs/design/domain-model.md`(Engine·EngineConnection·EngineHealth·FallbackPolicy·RequestTrace·User.role), `docs/design/module-dependency.md` L0 admin·L5 engine.

## 관련 과거 이력 요약
- [[task-002-phase0-scaffolding]]: Role 4단계·seed(Engine·connection 6·VoiceProfile·AppSetting), `/api/health`(admin.getHealthSummary), 6층 ESLint.
- [[task-004-ai-client-persona]]: `engine/router`(resolveConnection·withFallback·NoEngineAvailableError·`currentEnvironment`), `engine/adapters/llm/{claudeCli,homeM4}`, connection `runtime.modelByTier`.
- [[task-006-chat-correction]]: `engine/trace`(newTraceId·recordTrace, toolLog 키 `connection`), `infra/{http,tx,text,pagination}`, QA 계정 2개·dev 3011 스모크.
- [[task-008-vocab-today-words]]: dev 서버 화면 검증은 **`localhost:3011`**(127.0.0.1 은 하이드레이션 실패), 빌드 검증은 격리 복제본 `~/.node-local/thekaiwa-buildcheck`(미러에서 build 금지).

## Leader's Plan (2026-09-27)

### 요구사항 해석 (정본 인용)
- admin-console/00 §7 Phase 1 = "Role 4단계·capability·`(admin)` 골격·Effective Config 읽기·Source 표시·Plugins·Health·Functional Test·Trace 저장". 01 §10 Phase 1 = 셸·배지·Dashboard·Speech/LLM 읽기·Plugins·Connections 읽기·Diagnostics Health(+Pronunciation Dictionary P0 — 아래 G1 로 이월).
- role-permission §5: `admin/permissions/{matrix,can,guard}.ts`, `requireCapability` 가 라우트 첫 줄, `console.access` 없으면 **404**(존재 비노출)·있는데 capability 부족이면 **403 `{code:'FORBIDDEN', missing}`**, 미들웨어는 `/admin/**`·`/api/admin/**` 에서 `role=USER` 면 404 rewrite, 서버 컴포넌트도 렌더 전 `can`, capability 결과 캐시 금지. §7 민감 읽기(`secrets.read_ref` 목록 조회 등)는 AuditLog 1행.
- configuration-resolution §2~§3: 8층 Source 우선순위·Effective 산출 알고리즘·키별 Source, ENVIRONMENT 층 env 명명 규칙(§2-1), SECRET 키는 값 대신 `credentialRef`.

### 범위 결정 (Leader)
- **G1 발음 사전(Pronunciation Dictionary, 01 표 "1(P0)")은 task-003 이후로 이월** — 미리듣기·적용이 TTS 플랫폼 층과 M4 래퍼(`/g2p`·합성)에 의존(§15 표에서 005b 의존 = 002, **003**). 003 착수 시 함께 또는 직후 별도 task. ⚠ 로드맵 조정이므로 최종 보고에 명시.
- **G2 쓰기 0**: Phase 1 표의 #93b(credentialRef 연결/해제)는 ConfigurationVersion·Apply 흐름과 함께 Phase 2(012c)로 이월. 이번 task 의 쓰기는 **Health/Functional Test 결과(`EngineHealth`·`RequestTrace`)와 민감 읽기 AuditLog 뿐**.
- **G3 API(Phase 1 읽기·실행)**: #80 overview · #81 environment · #82·#82a voices 읽기 · #90 engines · #91·#91a engine-connections · #95 health 실행·#95a 결과 목록 · #96 functional test · #99·#99a fallback-policies · #101 secrets(**이름·존재 여부·마지막 사용만, 값 절대 없음**, 조회 시 AuditLog) · #102 config/effective · #103 config/schema/:engineId · #121·#122 plugins · #128·#129 traces · `GET /api/admin/v1/me/capabilities`(UI 숨김용).
- **G4 Health/Test 대상**: seed 된 connection 전부. 서비스가 떠 있지 않으면(M4 tts :8200·gateway :8100 등) **500 이 아니라 `UNAVAILABLE`+사유**로 기록. LLM functional test = 고정 JSON 스키마 1회(Claude 호출 비용 → connection 당 30초 1회 rate limit). STT/TTS functional test 는 서비스 불가 시 `SKIPPED/UNAVAILABLE`(테스트 자산·실합성은 task-003). health 호출은 spawn argv·타임아웃·SSRF 관점에서 **DB 의 seed connection baseUrl 만**(요청 본문 URL 금지).
- **G5 대시보드 갱신**: 30초 폴링(01 미결 — Phase 1 실측 전 기본값).
- **G6 엔진명**: 관리자 콘솔은 엔진·모델명을 **보여 주는 곳**이다(학습자 UI 금지 규칙의 예외 — `console.access` 보유자만). 단 Secret 값·credential 원문·서버 경로는 콘솔에도 금지.
- **G7 QA 계정**: capability 검증에 ADMIN·DEVELOPER·SUPER_ADMIN QA 계정이 필요 → `tests/live/qa-session.ts` 에 role 지정 QA 계정(`qa-admin@…test` 등) 추가 허용 — **localhost 전용 가드 유지, 운영 도메인 쿠키 무효 재확인 필수**(reviewer 초점).

### 구현 전략 (6층)
- **L0 admin**(app 층 조합): `permissions/{matrix,can,guard}`·`console/menu.ts`(`{path,label,capability,phase}` 단일 상수)·`overview`·`configuration`(effective 읽기 조합)·`diagnostics`(health/test 실행 조합)·`audit` 기록 호출. `app → engine` 직접 금지 — 관리자 라우트는 admin 경유.
- **L5 engine**: `registry`(Engine Descriptor 코드 — descriptor·configurationSchema·capabilities·healthCheck·functionalTest, 어댑터별) · `connections`(읽기) · `health`(실행·`EngineHealth` 기록) · `functionalTest` · `configuration/resolver`(8층 Effective + Source, 읽기 전용) · `trace`(조회 추가). 엔진명은 여기·adapters·seed 에만.
- **L6 infra**: `audit.record`(민감 읽기), `secrets`(credentialRef 존재 확인 — `env:`/`file:` 값 읽지 않고 존재만), `permissions` 는 admin 소유.
- **app**: `src/middleware.ts`(또는 현 `proxy.ts`) `/admin/**`·`/api/admin/**` USER → 404, `src/app/(admin)/admin/**`(레이아웃: 환경 배지·capability 필터 메뉴·403 페이지) · `src/app/api/admin/v1/**` · `/settings` 에 "관리자 › AI Engine Console" 행(engine.read 보유자만).
- **화면**: dashboard · speech/{realtime,analysis,tts} · llm (역할별: 선택된 engine/connection·Effective 요약·Health/Test 버튼) · voices(목록) · plugins·plugins/[id] · connections·connections/[id] · configuration(Effective 탭만, Source 배지) · diagnostics(Health 이력 + Trace 목록/상세). 모바일 412 에서도 쓸 수 있게(표 → 카드 목록, 화면당 스크롤 1곳).

### 작업 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §6 Admin Console(Phase 1): 레이아웃·배지·메뉴·페이지별 카드 구성·404/403 화면·Health/Test 실행 UX·Source 배지·3폭 | 1 |
| judge | C1·C2 | 2, 5 |
| developer A (Opus) | L0 admin·L5 engine(registry·connections·health·functionalTest·resolver·trace 조회)·L6 audit/secrets·미들웨어·API 18개·단위 테스트·`tests/live/task005b-smoke.sh`(role 별 QA 계정) | 3 |
| developer B (Opus) | `(admin)/admin/**` 화면·`components/admin/**`·설정 화면 진입 행 | 3 (A 병렬) |
| reviewer | capability 매트릭스 대조·404/403·Secret 누출·SSRF/spawn·6층·QA 계정 가드 | 4 |
| qa | 완료 기준 | 6 |

### 완료 기준 (qa 실행 확인)
1. tsc 0·lint 에러 0·단위 테스트 통과·**격리 복제본 build exit 0**(미러 build 금지).
2. **권한**: USER 로 `/admin/*` 페이지·`/api/admin/v1/*` 전부 404. ADMIN·DEVELOPER·SUPER_ADMIN 로 role-permission §3 매트릭스 표본(엔드포인트별 capability) 대조 — 부족 시 403 `missing`. 메뉴·탭은 capability 로 필터(없는 메뉴 미렌더).
3. Dashboard: 역할별 활성 connection·모델·상태·Environment 배지(PRODUCTION 경고색)·최근 Health.
4. Effective Config: 키마다 Source 표시, env 로 덮은 키는 `ENVIRONMENT`, 응답 전체에 Secret 값 0(서버 `.env` 의 실제 비밀값 문자열을 응답에서 grep → 0).
5. Health: seed connection 전부 실행 → `EngineHealth` 행, 떠 있지 않은 서비스는 `UNAVAILABLE`+사유(500 없음). LLM functional test 통과·지연 기록, `RequestTrace(FUNCTIONAL_TEST)` 원문 없음, 30초 내 재실행 429.
6. #101 secrets: 이름·존재·마지막 사용만, 조회마다 AuditLog 1행.
7. Plugins·engines·fallback 읽기, traces 목록·상세(`trace.read`), voices 목록.
8. `/settings` 의 콘솔 진입 행: USER 에게 없음, engine.read 보유자에게 있음.
9. 화면 360/390/412(dev `localhost:3011`): 가로 넘침 0·터치 ≥44px·403 페이지·PRODUCTION 배지.
10. QA role 계정 쿠키가 운영 도메인에서 무효(401/307).

### 네이티브 변경 / APK
없음.

## 판단 기록 (judge)
- [2026-09-27 16:19] intake engine=jev → task_type=feature / risk=R2 / developer=opus / next=ask_user | overrides=- | fallback=- | tokens=1082
  - **override**(Leader): `next=ask_user` 미적용 — 판단 대상은 admin-console/00~16·role-permission·configuration-resolution·api-contract 표에 정해져 있고, 유일한 미결(대시보드 갱신 주기)은 G5 기본값으로 정했다. 로드맵 조정(G1 발음 사전 이월·G2 #93b 이월)은 사용자 질문 대신 최종 보고에 명시한다. risk=R2 채택(capability·Secret·Role 매트릭스 = leader.md R2 보강 기준).

## Codex 검토

## Designer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
