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

### 설계 확정 (Leader, designer §6-11 확인 — H1~H6)
- **H1 경로 누출 차단(보안)**: `binPath` 등 경로 키는 해석된 절대 경로를 응답에 싣지 않고 ref 만, `/` 로 시작하는 값 마스킹. 스모크에 "응답 내 서버 절대 경로 0" 자동 검사.
- **H2** 미실행 테스트 표현은 A 가 `src/types/admin.ts` 에 하나로 확정(EngineHealth enum + `detail.reason`).
- **H3** #102 항목마다 `shadowed:boolean`(모든 역할), `layers` 상세는 DEVELOPER 이상.
- **H4 정본 충돌**: 정본 5종 > admin-console 세부 문서 — `secrets.read_ref` = ADMIN 이상(role-permission §3), Voices 목록 = `voices.read`(api-contract #82·01 표), 403 = `data.details.missing`, #81 = api-contract 모양. admin-console/02 의 어긋난 문구는 정본에 맞춰 이후 정리.
- **H5 경계**: 서버 컴포넌트 헬퍼(`getConsoleAccess`·`requireConsolePage`·`userCan`)와 `src/types/admin.ts` 는 developer A 소유, B 는 import 만.
- **H6** `/admin`→`/admin/dashboard` redirect·`/admin/diagnostics/traces/[traceId]` 추가 승인(01 §3 표 갱신). 한국어 루트 404 는 backlog.

## 판단 기록 (judge)
- [2026-09-27 16:19] intake engine=jev → task_type=feature / risk=R2 / developer=opus / next=ask_user | overrides=- | fallback=- | tokens=1082
- [2026-09-27 16:23] codex_gate/C1 engine=jev → codex_required=true / mode=adversarial-review / focus=security | overrides=- | fallback=- | tokens=903
  - **override**(Leader): Codex 미호출 — 사용자 지시(Codex 한도 소진, 충전 후 재확인). 보안 초점(권한 404/403·Secret 누출·SSRF/spawn·QA role 계정 가드)은 reviewer 최우선 감사 + QA 권한 매트릭스 실측으로 대체.
  - **override**(Leader): `next=ask_user` 미적용 — 판단 대상은 admin-console/00~16·role-permission·configuration-resolution·api-contract 표에 정해져 있고, 유일한 미결(대시보드 갱신 주기)은 G5 기본값으로 정했다. 로드맵 조정(G1 발음 사전 이월·G2 #93b 이월)은 사용자 질문 대신 최종 보고에 명시한다. risk=R2 채택(capability·Secret·Role 매트릭스 = leader.md R2 보강 기준).

## Codex 검토

## Designer 기록
- [16:45] 산출물: `docs/screens.md` §6 Admin Console — Phase 1(6-0 결정~6-11 확인 요청) 신규, §2 설정·콘솔 행 갱신(콘솔 경로 8행). 코드·다른 문서 수정 없음.
- [16:45] 셸: `(admin)/layout.tsx` 별도 셸 = 환경 띠 32px(PRODUCTION `bg-bad text-surface`, 숨김 불가) + 콘솔 바 52px(☰·제목·↩앱으로) + `main` 1곳 스크롤, ≥1024 사이드바 232px. 모바일 메뉴 = 공용 `Sheet` 재사용. 메뉴 10개(ADMIN 9 — Plugins 없음), 값은 `menu.ts`(A)가 거른 목록을 props 로.
- [16:45] 404/403: USER 는 앱 공통 404(콘솔 전용 not-found 금지), 콘솔 사용자 capability 부족은 콘솔 안 403 카드(`details.missing`), 없는 id 는 콘솔 안 "찾을 수 없어요" 카드. 페이지마다 `requireConsolePage` 재검사.
- [16:45] Health/기능 테스트 = `EngineTestPanel` 하나(진행 초·결과 카드·429 카운트다운·409/403 안내). 꺼진 서비스(UNAVAILABLE)는 회색 결과 카드+안내 — 오류 아님. SKIPPED 는 `resultView` 가 파생. LLM 기능 테스트 뒤 30초 선잠금.
- [16:45] Effective: Source 배지 `{층} {SOURCE}`(ENVIRONMENT 굵은 윤곽·RUNTIME_OVERRIDE 빨강·나머지 회색), DEVELOPER 만 층 펼침(`layers` 있을 때). 시크릿은 ref 이름만, 존재 여부는 [시크릿 참조] 시트 열 때만(#101 감사). 절대 경로 값은 화면에서 가림(방어선).
- [16:45] `/settings` 맨 아래 "관리자 › AI Engine Console" 한 줄(서버 컴포넌트 `AdminConsoleEntry`, `engine.read`). 역할 요약 행은 두지 않음.
- Leader 확인 필요(상세 §6-11 ①~⑱):
  1. 403 본문 키 `details.missing`(02 의 `requiredCapability` 는 대체로만) 확정
  2. `secrets.read_ref` = ADMIN 이상(정본 매트릭스) vs 02 §3 "SUPER_ADMIN 만" 불일치
  3. Voices 메뉴 capability `voices.read`(01·#82) vs role-permission §4 `voices.manage` 불일치
  4. SKIPPED 응답 표현을 A 가 하나로(`ok:null, status:'NOT_APPLICABLE', detail.reason`) 정하길 권장
  5. #102 에 전 역할 `shadowed:boolean` 추가 요청(ADMIN 은 layers 가 없어 가려진 값 표시 불가)
  6. **서버 경로 누출 위험**: `claude-cli-local.binPath`(`$CLAUDE_CLI_PATH`)가 resolver 에서 절대 경로로 풀려 #91a·#102 에 실릴 수 있음 → PATH 키는 ref 만 응답하도록 A·reviewer 확인
  7. 화면↔서버 경계 함수(`getConsoleAccess`·`requireConsolePage`·`userCan`)와 `src/types/admin.ts` 소유자 지정
  8. IA 추가 경로 `/admin/diagnostics/traces/[traceId]`·`/admin` redirect → 01 §3 갱신, 20-Log 한 줄은 "다른 파일 수정 금지" 지시로 Leader 에 위임

## Developer 기록

### A(서버)
- **커밋(B 용 헬퍼·타입 선공개)**: `53cb989`(src/types/admin.ts DTO) → `2ec7bbb`(서버 모듈 + 헬퍼·H2/H4 반영 타입). `@/modules/admin` 에서 import:
  `requireConsolePage(capability?, {path?}) → Promise<ConsolePageAccess{viewer, allowed, missing}>`(세션 없음 → /login redirect, console.access 없음 → notFound()) ·
  `getConsoleAccess() → Promise<ConsoleViewer | null>`(viewer.menu = capability·Phase 1 로 거른 메뉴) · `userCan(capability) → Promise<boolean>`(설정 화면 콘솔 진입 행 = `userCan('engine.read')`) · `ADMIN_MENU`·`menuFor(role)`.
  미실행 표현(H2) = `HealthSkipReason`(src/types/admin.ts 주석): ok:false + status(EngineStatus enum) + `detail.skipped:true` + `detail.reason` ∈ NOT_APPLICABLE(UNKNOWN)·SERVICE_DOWN(UNAVAILABLE 등)·NOT_IMPLEMENTED(UNKNOWN). 403 = `data.details.missing` 만(H4).
- [17:05] **구현 완료** — 커밋 `53cb989`·`2ec7bbb`·`039030e`·`7ce4059`·`0a2b99f`. tsc 0 · lint 에러 0 · 단위 테스트 201/201(신규 30: 매트릭스 33행 전수·PRODUCTION P·resolver 8층 규칙·secret/경로 마스킹·seed↔Provider 정합) · 라이브 스모크 46/47(8b 는 B 의 /settings 진입 행 반영 대기).
- **파일**: `src/modules/admin/{permissions/{matrix,can,guard},console/{menu,overview},engines,configuration/effective,diagnostics/traces,voices,present,errors,index}.ts` · `src/modules/engine/{registry/{types,index},adapters/{providers,common/{httpHealth,schema},llm/{claudeCli.provider,homeM4.provider},stt/{sherpaReazon,fasterWhisper}.provider,tts/styleBertVits2.provider},connections,fallbackPolicy,configuration/resolver,health,functionalTest}` + 수정 `engine/{index,llm/index(probeConnection),trace(listTraces·getTrace·turnStats24h),adapters/llm/claudeCli(probeClaudeCliVersion)}` · `src/modules/infra/{audit,secrets,mask}.ts`+index·`infra/auth.ts`(역할 QA 토큰 운영 거부) · `src/proxy.ts` · `src/app/api/admin/v1/**`(route 19) · `src/types/admin.ts` · **범위 밖 추가(읽기 함수만)**: `src/modules/speech/voices/admin.ts`+index(Voice 관리자 조회 — speech 소유 테이블), `src/modules/preferences/index.ts#countUsersByVoice`(UserVoiceSetting 집계) · 테스트 `src/modules/{admin,engine}/__tests__/*` · `tests/live/{qa-session.ts,task005b-smoke.{sh,ts},README.md}`.
- **권한 구현**: `matrix.ts` = role-permission §3 전개 상수(33행, 단위 테스트가 NFS 정본 문서 표와 복사본 둘 다 대조). `can(role, cap, ctx)` 순수 함수 — 모르는 역할 문자열 전부 거부, `targetEnvironment=PRODUCTION` 이면 P 칸에 `config.apply.production`(override→override.production, import→config.import.production, voices.manage 는 productionSensitive 때만). `requireCapability(cap, ctx?)` = 라우트 19개 전부 핸들러 첫 줄: `infra.auth()`(JWT userId → **DB User.role**, 캐시 없음) → 세션 없음 401 → console.access 없음 404(힌트 없음) → 부족 403 `details.missing`. proxy: `/api/admin/**` 미인증 401·USER 404 봉투, `/admin/**` USER 는 앱 공통 404 rewrite(둘 다 DB 역할 조회 — Next16 proxy=Node 런타임). `menuFor` 는 console.access 먼저(USER 의 voices.read 로 메뉴가 새던 버그를 단위 테스트가 잡음). `?environment=` 다른 환경 보기 = environment.policy(SUPER_ADMIN), 다른 환경 행 실행 = ADMIN 404·SUPER_ADMIN 403 CROSS_ENVIRONMENT.
- **8층 resolver(읽기 전용, 캐시 없음)**: 채운 층 = DEFAULT(스키마) · SOURCE_CODE(어댑터 코드 상수: claude permissionMode·tools·concurrency, home-m4 systemFirst) · ENVIRONMENT(`KAIWA_CONN_<KEY>_<PATH>` > `KAIWA_<ROLE>_<PATH>`(역할 primary 만) > 스키마 envAlias, 시크릿 별칭은 값 대신 `env:NAME`) · DATABASE(ConfigurationVersion ACTIVE — 현재 0행, FALLBACK_POLICY 는 정책 행) · CONNECTION_PROFILE · RUNTIME_OVERRIDE(TEMPORARY). **빈 층** = APPLICATION_CONFIG(speech.config.yml 을 런타임이 아직 안 읽음 — 보이면 거짓), USER_SETTING(엔진 스키마에 userSettable 키 없음·context 는 Phase 2 → 400). 저장값 `"$NAME"` 은 NAME 이 그 키 envAlias 일 때만 "env 가 준다" 로 건너뜀(→ claude binPath source=ENVIRONMENT), 스키마에 없는 이름은 해석 안 함. shadowed = 기본값이 아닌 설정값이 더 높은 층에 가려졌을 때(H3, 모든 역할). ADMIN=SUMMARY(값·Source·shadowed·경고 코드만) / DEVELOPER+=FULL(sourceRef·layers·경고 상세).
- **Health/Test 결과(LOCAL, 17:0x 실측)**: claude-cli-local HEALTHY(`claude --version` 2.1.222, ~0.1s) · home-m4-lan **MISCONFIGURED**(/health 200 이지만 `env:HOME_M4_API_KEY` 비어 있음) · reazon-ondevice UNKNOWN(NOT_APPLICABLE, 상태 불변) · reazon-gateway UNAVAILABLE(ECONNREFUSED :8100 미가동) · whisper-voicevault HEALTHY(:8090) · style-bert-m4 UNAVAILABLE(ECONNREFUSED — M4 tts-service 미가동). 기능 테스트: claude-cli-local HEALTHY(haiku, 2.2~7.0s, schemaValid) · home-m4 MISCONFIGURED(키 없음, 호출 전 차단) · whisper UNKNOWN(NOT_IMPLEMENTED) · gateway·style-bert UNAVAILABLE(SERVICE_DOWN) · ondevice UNKNOWN(NOT_APPLICABLE). 30초 내 재실행 429. **Claude CLI 호출 총 2회**(수동 1·스모크 1). 스모크 끝에 Health·FUNCTIONAL_TEST Trace 삭제, LOCAL 6 connection 상태를 시작 전(UNKNOWN)으로 원복 확인.
- **보안 자기 점검(반례)**: ①미들웨어만 통과 — 라우트 19개 첫 줄 가드, `x-middleware-subrequest` 헤더로도 404(스모크 2e), 존재하지 않는 관리자 API 와 존재하는 API 의 USER 응답 바이트 동일(2c). ②JWT role 위조 — JWT 에 role 없음·`role:SUPER_ADMIN` 클레임 넣은 USER 토큰 404(2d). ③다른 환경 행 — 조회는 SUPER_ADMIN 만, 실행은 불가(ADMIN 404 숨김·SA 403), PRODUCTION 행 불변 대조(2j). ④Secret 누출 — 어떤 경로도 시크릿 값을 읽지 않음(env: 는 비어 있지 않은지, file: 은 stat 만·이름 규칙상 `/` 불가+dirname 재확인), SECRET_REF 에 평문이 오면 값 폐기(경고에도 값 없음), 응답은 `maskSensitive`(sk-/Bearer/JWT/32자+ hex·b64/URL 자격증명/토큰 쿼리/secret·token·apiKey 키 이름)+서버 경로 scrub, `envSecretAlias` 는 스키마 응답에서 제거, 스모크가 응답 158건에 서버 .env 비밀값 7종·서버 경로 grep → 0. ⑤SSRF — 헬스 주소는 Effective(DB·서버 env)만, 요청 본문 URL 무시(5e), http(s)만·URL 자격증명 거부·리다이렉트 미추종·본문 64KB·결과는 화이트리스트 숫자/짧은 토큰만, **헬스 요청에 시크릿 헤더를 싣지 않음**(Phase 2 주소 편집이 생겨도 X-Internal-Secret 유출 경로가 안 되게). ⑥spawn — `claude --version` argv 배열·셸 없음·5s·stdout 4KB·stderr 폐기·cleanEnv(우리 시크릿 제거), 실행 파일은 서버 env `CLAUDE_CLI_PATH` 만(DB `binPath` 는 spawn 하지 않음). ⑦QA 역할 계정 — provider `test`·`@thekaiwa.test`(Google 연결 fail-closed·도메인 검증 불가), qa:true 토큰은 localhost 직접 요청만(기존), **추가로 APP_ENV=PRODUCTION 서버는 USER 가 아닌 QA 토큰을 세션으로 인정 안 함**(infra/auth), 운영 도메인에서 SUPER_ADMIN QA 쿠키 → 401/307/404(스모크 10). dev 서버는 `-H 127.0.0.1` 필수(0.0.0.0 이면 LAN 에서 Host 헤더로 localhost 전제를 흉내낼 수 있음 — README 명시). ⑧잔여 위험 → 아래 한계.
- **스모크(완료 기준별)**: 2 권한 PASS(2a~2k) · 3 대시보드·배지 PASS · 4 Effective(6 connection·ENVIRONMENT source·SECRET ref·요약/전체·400/404)·Secret grep 0 PASS · 5 Health 6·UNAVAILABLE 사유·LLM 기능·Trace 원문 없음·429 PASS · 6 #101·감사 1행/조회 PASS · 7 plugins·engines·fallback·traces·voices PASS · 8 USER 진입 행 없음 PASS / **ADMIN 진입 행 FAIL(B 화면 대기)** · 10 운영 도메인 무효 PASS · H1 서버 경로 0 PASS. (1 build·9 3폭 = QA)
- **정본과 다르게 한 것**: ①스키마 키 이름을 seed 실제 저장 모양으로(`connection.binPath`·`runtime.modelByTier.*`·`runtime.vad.endpointSilenceMs`·`runtime.defaultModel`·`connection.manifestUrl` 등) — configuration-resolution §5-2 예시 이름(`connection.bin`·`runtime.tiers.*`)과 다름(런타임·seed 가 이미 이 이름) · 일부 범위(home-m4 timeoutMs max 600000). ②envAlias 는 **엔진 단위**로 적용(§2-1 은 별칭→`KAIWA_<ROLE>_*` 매핑이라 역할 primary 에만 적용될 여지) — home-m4 가 LLM primary 가 아니어서 AI_API_* 가 무의미해지는 것을 피함. ③`AI_API_KEY_REF`(값이 ref)를 home-m4 credentialRef 별칭으로 추가. ④#96 실패(타임아웃 포함)도 기록된 결과로 **200**(계약 504 대신 — 결과 카드 일관), 429 는 계약대로. ⑤#96 은 connection status 를 바꾸지 않음(Health 만 바꿈). ⑥`requireCapability(cap, ctx)` 시그니처(req 인자 없음 — ip 는 headers()). ⑦#137b 는 api-contract 대로 `console.access`(role-permission §4-2 "(인증만)" 과 다름 — USER 에 404 로 콘솔 비노출 일관). ⑧#128 `userId` 필터의 SUPER_ADMIN 판정을 `users.role.manage` 로 대리. ⑨#101 은 `?environment=` 미지원(존재 여부가 이 서버 기준이라). ⑩#81 은 api-contract 필드 + `isProduction`·`activeOverrides`, `services` 는 null(Phase 3). ⑪#102 `cacheHit` 항상 false(캐시 없음). ⑫proxy 가 DB 로 역할 조회(role-permission §5 "미들웨어는 DB 를 읽지 않음·JWT 힌트" 가정과 다름 — JWT 에 role 이 없고 Next16 proxy 가 Node 라 가능, 01 §8 시퀀스와는 일치).
- **한계·후속**: ①`next build` 는 지시대로 돌리지 않음 — **QA 격리 복제본 build 에서 proxy(Prisma import) 번들을 꼭 확인**(dev/Turbopack 에서는 정상). ②헬스 SSRF 는 주소가 서버 설정뿐이라 Phase 1 안전하나, Phase 2 에 관리자가 baseUrl 을 편집하게 되면 호스트 허용 목록(LAN·loopback) 필요. ③home-m4 는 `HOME_M4_API_KEY` 가 비어 있어 LOCAL 에서 MISCONFIGURED — 운영에서 Health 를 돌리면 Router 가 home-m4 를 건너뛴다(원래 키 없이 실패하던 경로라 기능 영향 없음). ④Health 는 연결 상태를 바꾸고 Router 캐시를 비운다 — PRODUCTION 에서 M4 가 꺼진 채 Health 를 돌리면 TTS 가 UNAVAILABLE 로 남는다(다시 Health 하기 전까지, 스케줄 Health 는 Phase 2). ⑤`lastUsedAt` null(SecretResolver 사용 추적 Phase 2). ⑥AuditLog 는 스모크 후에도 남음(QA 계정·LOCAL, 이번 실행 5행) — 불변 원칙. ⑦speech·preferences 에 읽기 함수 2개를 추가(범위 밖, 각 층 소유 테이블 규칙을 지키기 위해). ⑧**세션 중 사고**: .env 키 이름을 보려던 셸 명령의 마스킹이 실패해 `SPEECH_INTERNAL_SECRET` 값이 이 세션 도구 출력에 한 번 노출됨(파일·커밋·vault 에는 없음) — 대화 기록을 공유할 계획이 있으면 회전 권장(speech 쪽 .env 와 같은 값).

### B(화면)
- [17:15] **구현 완료** — 커밋 `6ea4ff1`(55파일, 내 경로만 지정 커밋). tsc 0 · lint 에러 0(경고 1 = `trace/DiagnosticsScreen.tsx:137` set-state-in-effect, 데이터 로드 패턴(A) — 저장소 정책상 warn) · 단위 테스트 201/201(신규 25: `src/components/admin/__tests__/{format,resultView,labels}.test.ts`). 엔진명 grep(claude·whisper·reazon·style-bert·haiku·sonnet·opus·qwen·sherpa) 내 파일 0건(테스트 픽스처도 중립 이름).
- **파일**: `src/app/(admin)/layout.tsx` · `(admin)/admin/page.tsx`(→dashboard redirect) · `(admin)/admin/{dashboard,speech/{realtime,analysis,tts},llm,voices,plugins,plugins/[id],connections,connections/[id],configuration,diagnostics,diagnostics/traces/[traceId]}/page.tsx` · `src/components/admin/console/{ConsoleShell,ConsoleProvider,EnvStrip,ConsoleBar,ConsoleNav,ConsoleStates,Badges,KeyValueList,MonoId,RefreshLine,ChipRadio,EngineTestPanel,TestResultCard,HealthHistoryList,SecretsSheet,EffectiveSummaryCard,DashboardScreen,RoleScreen,ConnectionsScreen,ConnectionDetailScreen,VoicesScreen,PluginsScreen,PluginDetailScreen}.tsx` + `{labels,format,resultView,connectionText,useAdminResource,useBulkHealth}.ts` · `configEditor/{EffectiveScreen,EffectiveRow,SourceBadge}.tsx` · `trace/{DiagnosticsScreen,TraceRow,TraceDetailScreen}.tsx` · `src/app/(app)/settings/{page.tsx(수정),AdminConsoleEntry.tsx}`.
- **A 헬퍼·타입 사용**: layout = `requireConsolePage()`(capability 없이 — 세션 없음 /login·USER notFound 를 가드가 먼저, 그 뒤에만 메뉴·환경을 읽음) + `getEnvironmentInfo(viewer.environment).appVersion`(try/catch, 실패해도 셸은 그림) → 클라이언트에는 `{role, capabilities, environment, appVersion, menu}` 만(이메일·id 미전달). 페이지 14개 = 첫 줄 `requireConsolePage(cap, {path})` → `allowed:false` 면 콘솔 403 카드(`missing`·`viewer.role`). `/settings` = `userCan('engine.read')`. `getConsoleAccess()` 는 쓰지 않음(requireConsolePage 가 redirect·404 까지 해 줌). DTO 는 전부 `@/types/admin`, `ClientConsoleAccess` 만 B 쪽(`ConsoleProvider.tsx`)에 정의. **A 에게 요청: 없음(차단 요소 없음)**. 참고 1건 — `getEnvironmentInfo` 는 DB 6쿼리라 셸 첫 렌더마다 돈다(버전만 쓰므로 가벼운 `appVersion` 공개 함수가 있으면 교체 가능, 급하지 않음).
- **가이드(screens §6)와 달라진 점**: ①`AdminConsoleEntry` 위치 = `src/app/(app)/settings/`(Leader 담당 파일 지정 범위, 가이드는 components/settings) — 서버 컴포넌트, 공용 ui 도 import 하지 않고 마크업 인라인. ②작은 조각은 파일을 합침: ConsoleNav(NavList·Sidebar·MenuSheet)·ConsoleStates(Forbidden·NotFound·Loading·LoadError·EmptyNote·BackLink)·Badges(Status·Voice·Trace·Step·Loaded·Neutral)·ChipRadio(+ToggleButton)·MonoId(+CopyButton)·TestResultCard(+TraceRef)·각 Screen(+Card)·SourceBadge(+SourceLegend). 추가: EffectiveSummaryCard·useBulkHealth·connectionText. 테스트 위치 `components/admin/__tests__`(Leader 지시). ③메뉴 라벨·묶음은 A 의 `menu.ts` 값(한국어 '대시보드'·'연결'…)을 그대로 쓰고, 묶음 이름(개요·엔진·자원·설정·진단)·설명(sub)만 화면 쪽 표로 매핑. ④`useEngineNames`/#90 미사용 — DTO 에 `engineName`·`engine.displayName` 이 있음. ⑤`ServiceEnvWarning` 미구현 — Phase 1 `EnvironmentDto.services = null`. ⑥**가림 강화(Leader 지시)**: `/`·`~/`·윈도 드라이브로 시작하는 문자열은 키와 상관없이 "서버 경로 · 표시하지 않음"(가이드는 path 키만), 객체·배열 안쪽도 `maskDeep`. 반대로 시크릿 의심 키라도 숫자·불리언은 그대로(maxTokens 등), `session` 은 시크릿 키 패턴에서 뺌(디버그 세션 id 표시). ⑦**기능 테스트 30초 선잠금을 모든 연결에**(가이드는 LLM 만) — 서버 `claimSlot` 이 연결마다 30초 1회라 STT/TTS 도 헛 429 가 남. ⑧SKIPPED 는 A 의 H2 단일 표현(`detail.skipped`+`detail.reason`) 기준, 가이드 대체 표현도 함께 읽음. NOT_APPLICABLE·NOT_IMPLEMENTED 안내는 서버 고정 문구(`detail.message`) 우선(worker 내장 연결은 ONDEVICE 가 아님). ⑨오류 코드표에 A 코드(ECONNREFUSED·HTTP_nnn·EXIT_n·SPAWN_FAILED·CREDENTIAL_MISSING·PLUGIN_NOT_LOADED·SCHEMA_INVALID·MODEL_NOT_LOADED …) 추가, 모르는 코드는 서버 `message` → 없으면 "실패했어요 ({code})". ⑩"연결 상태를 ○(으)로 바꿨어요"는 상태가 실제로 바뀌었을 때만. ⑪역할 페이지에 "지금은 예비 연결 {key} 로 돌고 있어요"(effectiveOrder[0] ≠ primary 일 때) 한 줄 추가. ⑫Effective 머리에 빈 층 번호·경고 줄 추가(DTO `emptyLayers`·`warnings`). ⑬`?target=`·`?tab=`·`?connection=` 은 서버 page 가 searchParams 로 읽어 props 로 넘김(클라이언트 useSearchParams 없음). ⑭Trace 단계는 A 의 평면 DTO 기준(`ms ?? latencyMs`, `connectionKey ?? connection`), 나머지 원시 키는 칩(가림 규칙 적용). ⑮#96 504/502 처리는 남겨 두되 A 는 실패도 200(기록된 결과)으로 준다 — 화면은 둘 다 회색 결과 카드.
- **확인 못 한 것**: dev 서버·브라우저 실행 금지 지시로 **360/390/412·≥1024 실제 렌더·가로 넘침·하이드레이션·메뉴 시트 포커스 복귀·30초 폴링의 탭 가림 동작·스크롤 1곳**을 보지 못함 → QA(`localhost:3011`, USER·ADMIN·DEVELOPER·SUPER_ADMIN 4계정). A API 와 화면을 브라우저로 붙여 본 적 없음(타입·계약 코드 대조만).
- **통합 시 확인할 가정**: ①USER `/admin/*` 404 = A proxy rewrite + layout/page 가드 `notFound()` 둘 다 앱 기본 404(콘솔 전용 not-found 없음). ②A 스모크 8b(ADMIN `/settings` 진입 행)는 `6ea4ff1` 로 PASS 여야 함. ③시크릿 시트는 **열 때마다** #101 1회(=AuditLog 1행), 연결 목록·상세 진입만으로는 0회. ④연결 상세 링크는 connection **id**, Effective `targetId`·칩 값은 **key**(A 가 둘 다 받음). ⑤#96 429 `details.retryAfterSec` → 버튼 카운트다운. ⑥"모두 상태 확인"·"주 연결 상태 확인"은 #95 를 순서대로(A 의 사용자당 분당 30회 제한 안 — seed 6개). ⑦ADMIN: 메뉴 9개(플러그인 없음)·진단 탭 없음·`/admin/plugins`·`/admin/diagnostics/traces/x` 직접 입력 → 콘솔 403 카드·Effective 펼침 없음·결과 카드 "Trace 보기" 없음. ⑧없는 id(`/admin/connections/zzz`·`/admin/plugins/zzz`·`/admin/diagnostics/traces/zzz`) → 콘솔 안 "찾을 수 없어요"(API 404). ⑨PRODUCTION 띠 = `bg-bad text-surface`, main 밖이라 스크롤·시트와 무관하게 보임.

## Reviewer 기록

## QA 기록

## 최종 요약
