---
task_id: task-055
title: "Phase 3 서랍장 전체 — 채택 교정 모음 화면(`/drawer/corrections`)과 목록 API(#79)"
status: review
waiting: device_verify
base_ref: d004079
risk_level: "R1"
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-006-chat-correction, task-010c-correction-mode, task-039-improve-tutor-explanation, task-008-vocab-today-words]
tags:
  - type/task
  - domain/drawer
  - domain/conversation
aliases:
  - 채택 교정 모음
  - 서랍장 전체
  - task-055
created: 2026-10-11
updated: 2026-10-11
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-055-drawer-corrections-v1.html"
  artifact_url: ""
  content_sha256: "56a11a9b6face8865ed71cf220932c73859e868685e5d5dffaf9892f19ce4c9e"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-11T17:07:19+09:00"
  approval_quote: "task-055 데모 v1 승인, D1~D8은 권고대로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-055 — 채택 교정 모음 (Phase 3 서랍장 전체)

## 사용자 요청 (원문)
- 2026-10-11 Phase 3 방향 논의에서 AskUserQuestion 응답 「서랍장 전체 (채택 교정 모음)」 — 로드맵 노드 「(3) 채택 교정 모음(서랍장 전체)」. 사용자가 더 구체적인 요구를 말하지는 않았다 — 화면 설계는 designer 데모에서 사용자가 승인한다.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **이미 있는 것**: 설계서 `design-spec.md` §7-7 「서랍장: …`drawer/corrections`(채택 교정 모음)」, `screens.md` 라우트 표 `/drawer/corrections`(Phase 3 예약), **API 계약 #79** `GET /api/v1/drawer/corrections?errorType=&chunkType=&q=&limit=&cursor=` → `status=ACCEPTED` 교정만 `{items:[{id, original, corrected, explanation, errorType, severity, chunkType, chat:{id,title,kind}, savedWord?:{id,surface}, resolvedAt…}], nextCursor}` (상세 `api-contract.md` §2-17). `GET /api/v1/corrections?status=ACCEPTED` (#34)는 이미 있으나 서랍장용 필터(`errorType`·`chunkType`·`q`)·단어 연결 필드는 #79 가 정한다. **구현 없음**: `src/app/api/v1/drawer/` 없음, `src/app/(app)/drawer/` 에는 `words` 만.
- **데이터**: `Correction`(`original` 불변·`corrected`·`explanation`·`extraNoteKo`(JLPT 추가 설명, 옛 행 NULL)·`errorType` 9종(GRAMMAR·PARTICLE·CONJUGATION·VOCABULARY·POLITENESS·NATURALNESS·WORD_ORDER·PRONUNCIATION·OTHER)·`severity`·`chunkType`·`status` PROPOSED/ACCEPTED/REJECTED·`savedWordId`·`resolvedAt`), 채팅·메시지 삭제 시 교정도 함께 지워진다(Cascade — 허공에 뜬 행 없음). 채택하면 `StudyLog(ACCEPTED)`가 생긴다(제안→채택 원칙).
- **화면 규칙**: 하단 탭 5개(회화·오늘·계획표·단어장·질문) 고정, 탭 라벨은 IMP-0006 에서 서랍장→**단어장**으로 바꿨다 — 새 탭을 만들지 않고 `/drawer/words` 안에서 들어가는 길을 designer 가 정한다. **단어장 첫 화면 높이는 task-046 같은 높이 스켈레톤 상수(`wordsSkeletonSizes`)로 재 둔 값**이라 진입 요소를 더하면 스켈레톤·최종 높이가 어긋나지 않는지(상수 갱신 필요 여부)를 가이드에 적어야 한다(`screens.md` §17). 표시 스위치(히라가나·한글·번역) 앱 전체 한 값, 일본어는 `JaText`+`useAnnotations`.
- 승인된 교훈(`/이슈기록 관련 drawer correction`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 2.01 · R1 · developer=**opus** · **standard** · demo=**full**(`JV-ui_change`, owner designer) · `next=demo_first` → **사용자가 데모를 승인하기 전에는 화면 코드를 쓰지 않는다.** 역할 designer → developer → reviewer → qa. 입력·결과: 스크래치 `judge-055-intake*.json`.

## 설계 (Leader 초안 — designer 가 화면 흐름을 정함)
1. **API #79 + 모듈 조회 함수**(conversation/corrections 소유): 계약대로 `ACCEPTED` 만, 소유자 `where {userId}`, 필터 `errorType`·`chunkType`·`q`(원문·교정문·설명 부분 검색, 길이·특수문자 처리), 정렬 `resolvedAt desc`(+`id`), 커서 페이지(`limit` 1~50). 응답에 채팅(`id,title,kind`)·연결 단어(`savedWord`)·`extraNoteKo`. 읽기 전용 — 새 쓰기·스키마 변경 없음.
2. **화면 `/drawer/corrections`**: 채택한 교정 목록(원문 → 교정문, 설명, 오류 유형 뱃지, 채택한 날), 필터(오류 유형·조각 종류)·검색, 커서로 더 보기, 항목에서 원 채팅·연결된 단어로 이동, 빈 상태·오류·로딩(같은 높이 스켈레톤). 데모 승인 전에는 구체 구성(칩 vs 시트, 항목 카드 모양, 들어가는 길)을 확정하지 않는다.
3. **하지 않는 것**: 새 탭, 교정의 편집·삭제(`original` 불변, 삭제 경로 없음), 제안 상태(PROPOSED) 교정 목록(채팅방·모아 둔 교정 시트 몫), 서버 쓰기·스키마·네이티브 변경.

## 확정 결정 (사용자 승인 「task-055 데모 v1 승인, D1~D8은 권고대로」, 2026-10-11 17:07)

> 근거·모양·수치: [[task-055-designer-record]] · 데모 `docs/demo/task-055-drawer-corrections-v1.html`(sha256 `56a11a9b…19ce4c9e`). 사용자가 권고대로 승인했으므로 아래가 구현 기준이다. **구현이 어긋나면 데모가 아니라 이 표를 기준으로 reviewer 가 반려한다.**

| # | 결정 | 확정 | 구현 메모 |
|---|---|---|---|
| D1 | 들어가는 길 | **A** 앱바 아래 분절 `[단어 \| 채택한 교정]` | 두 화면 머리가 같은 자리. `WordsSkeleton` 에 같은 분절(inert) 추가 — 목록 시작 292→344px(+52), `WORD_SKELETON`·`WORD_CATEGORY_ROW` 상수 변경 없음, 변경 뒤 첫 화면 점프 ≤8px 재측정 |
| D2 | 카드 | **C** 요약 카드 | 윗부분 전체가 펼침 버튼, ✕ 내 문장(지운 글자 빨강 취소선)/✓ 고친 문장(넣은 글자 초록 밑줄)은 늘 보임, 설명은 2줄→펼치면 전체+시험 문법(`ExtraNoteLine`)+[원래 대화 보기 ›]+[단어 보기 ›]. 강조는 기존 `diffCodepoints` |
| D3 | 필터 | **A** 칩 두 줄 | 「유형」(개수=`facets.errorType`, 0개 숨김) + 「조각」(이름·액션·느낌·꾸밈, 개수 없음). AND, 바꾸면 커서 버리고 첫 쪽 |
| D4 | 더 보기 | **A** [교정 더 보기] 버튼 | 실패는 버튼 위 한 줄(받은 항목 유지), 끝 표시 「채택한 교정을 모두 봤어요 · n개」, 쪽 크기 20 |
| D5 | 원래 대화에서 ← | **A** 「교정 모음으로」 | 공용 변경은 `usePlanReturn` 한 곳(`BackBar`·`TalkRoomHeader`). 회화방 입력 바(`TalkRoom.tsx`)·마이크 영역은 건드리지 않는다(task-056 이 별도 진행 중) |
| D6 | 단어 보기 | **A** 이 화면 위 단어 상세 시트 | 기존 `WordDetailSheet`; 시트에서 단어를 지우면 목록을 다시 읽어 카드의 단어 링크를 거둔다 |
| D7 | 번역 | **A** 히라가나·한글 스위치만 | 번역 줄 없음(교정 데이터에 번역 칸 없음) — 이 화면은 번역 스위치를 따르지 않는다 |
| D8 | 검색 대상 | **B** 설명까지 | `original`·`corrected`·`explanation` 부분 일치 — 계약 §2-17 갱신 완료(Leader) |

- **계약 보완(Leader, 2026-10-11)**: `docs/design/api-contract.md` §2-17 에 `extraNoteKo` 추가, `facets` 는 「errorType 만 빼고 chunkType·q 반영」, `limit` 기본 20, `chunkType` 은 4종만(「없음」 필터 없음), 검색 3필드, 번역 없음, 이동 주소 규칙을 명시. `total` 필드는 두지 않는다(유형 칩 합 = 머리 줄 개수).
- **구현 범위**: API #79 + 모듈 조회 함수(`conversation/corrections`), 화면 `/drawer/corrections` + `loading.tsx`(같은 높이 자리표시 + 새 측정 상수 + `tabSkeleton.test.ts` 묶음 시험), `WordsSkeleton` 분절, `usePlanReturn` 변경, 시험. 서버 쓰기·스키마·네이티브 변경 없음 → 웹 배포만.
- **designer 가 못 확인한 것(QA·reviewer 확인 대상)**: ① 실기기 글꼴·루비 높이·TalkBack ② 역할극 교정이 `kind=TALK` 회화방 주소 `#cr_` 로 열리는지 ③ 단어 상세 시트 「점검 결과 보기 ›」가 회화(TALK) 출처 교정 단어에서도 열리는지(기존 동작이면 백로그).

## 완료 기준
1. 사용자가 데모 vN 을 승인(문장 그대로 기록).
2. `#79` 계약 일치(필터·커서·소유자 404/빈 목록·`limit` 경계) + 시험, tsc·eslint 0, reviewer 가 증빙 재실행·변이 확인.
3. QA(QA 계정만): 채택한 교정이 있는 계정으로 목록·필터·검색·더 보기·이동·빈 상태, 타인 교정이 안 보임(IDOR), 3폭 가로 넘침 0·터치 44px, 표시 스위치 반영.
4. 배포 후 읽기 전용 스모크(웹만, DB 변경·APK 없음), 사용자 폰 확인.

## 상태 로그
- 2026-10-11 접수·묶음(base_ref `d004079`). 다음: 데모 게이트 init → designer 데모 v1.
- 2026-10-11 16:57 designer 데모 v1 완료(lint `DEMO_LINT_PASSED`, 26상태×3폭 가로 넘침 0) → 게이트 `review_requested` → 사용자에게 전달(결정 D1~D8, D7·D8 은 Leader 초안과 달라 고지).
- 2026-10-11 17:07 **사용자 승인** 「task-055 데모 v1 승인, D1~D8은 권고대로」(문장 그대로 `check.mjs approve` 기록, `active` 는 developer 인계 때 켠다). 계약 §2-17 확정 규칙 갱신(Leader). designer 구현 가이드(`docs/screens.md` 새 절) 진행 중. 다음: judge C1(Codex 개입 판정) → developer(opus) → reviewer → qa.
- 2026-10-11 17:5x designer 구현 가이드 완료 — `docs/screens.md` §21(9299~9764행, 21-0~21-13) + 기존 3곳 최소 수정(§2 표 두 행·§4-2 A 의사코드 1줄). Leader 검토: 계약 §1 표 #79 행에 `chunkType`·`q` 반영, **`cursor` 요청에는 `facets` 생략**(첫 쪽만)으로 확정(§2-17 갱신), `ErrorBlock` 44px 미달은 공용 부품이라 이 화면에서만 우회(전역 이슈), 데모 G 「404 토스트」는 목록 화면에서 일어나지 않아 제외(수용). 가이드가 짚은 공용 부품 변경은 `ChunkChips`·`WordSearchBar`(prop 추가·기본 DOM 불변), `Segmented`·`CorrectionCard`·`ErrorBlock` 은 재사용 안 함(새 부품).
- 2026-10-11 17:5x **judge C1**(`judge-055-c1.result.json`): `codex_required=false`(`CX-limit-unknown-hold` — Codex 한도 값이 stale, 스위치 on) → Codex 없이 진행. 데모 게이트 `activate` 완료(`hash: verified`).
- 2026-10-11 17:5x **developer 병렬 소환**(opus, judge 판정): **A 서버** = 타입(`DrawerCorrectionItem/Page/Facets`, 먼저)·모듈 조회 함수·API #79·시험 → 기록 `task-055-dev-a-record.md`, 전용 미러 `thekaiwa-dev055a` / **B 클라이언트 기반** = 돌아오기(`correctionsReturn`+`usePlanReturn`)·문구·`DrawerSwitch`+단어장 분절·`ChunkChips`/`WordSearchBar` prop·`drawer/logic.ts` → 기록 `task-055-dev-b-record.md`, 미러 `thekaiwa-dev055b`. **C 화면 조립**(카드·칩·`CorrectionsScreen`·`page.tsx`·자리표시·`tabSkeletonSizes`·점프 실측)은 A·B 완료 후. 이후 reviewer → QA.
- 2026-10-11 18:0x **Developer A(서버) 완료 + Leader 재검증**: 타입 `DrawerCorrection{Item,Facets,Page}`·`conversation/corrections/drawer.ts`(`parseDrawerCorrectionQuery`·`drawerCorrectionWhere`·`listDrawerCorrections`)·`app/api/v1/drawer/corrections/route.ts`·시험 20개(변이 10종 모두 검출). Leader 직접 재실행: eslint 0·시험 20/20·tsc 0. 코드 대조: `parseLimit` 범위 밖 400, `sanitizeText` 길이 자르지 않음, `escapeLike`(Prisma `contains` 는 `%`·`_` 이스케이프 안 함 — task-008 실측). 계약에 없던 결정 3건(`resolvedAt IS NOT NULL` 조건·`q` 한 줄 정리·중복 파라미터는 첫 값)은 §2-17 에 명시. **라이브 미확인**: 실제 DB 에서 `q=%`·`q=_`·`q=\` 가 와일드카드로 동작하지 않는지(가짜 DB 시험뿐, Prisma 버전 6.19.3 불변 확인) → QA. 정렬은 `[userId,status,createdAt]` 인덱스라 `resolvedAt` 정렬이 filesort — 개인 앱 규모 `[추측]`, QA 실측.
- 2026-10-11 18:0x **Developer B(클라이언트 기반) 완료 + Leader 재검증**: `shell/correctionsReturn.ts`+`usePlanReturn` 확장(소비처 `BackBar`·`TalkRoomHeader`·`planReturn.ts` 무수정)·`drawer/{correctionsCopy,DrawerSwitch,logic}`·`WordsScreen`/`WordsSkeleton` 분절 한 줄·`ChunkChips withNone`·`WordSearchBar` prop(기본 DOM 불변 시험). Leader 직접 재실행: tsc 0·eslint 0·components+conversation 시험 1970/1970. 가이드와 달라진 점: `emptyKindOf` 는 facets 합이 아니라 받은 항목 수로 E1 판정(경합 방어)·두 기록 `at` 동률이면 계획표 우선·분절 초점 기록 20초 유효(가이드 외 추가)·검색 빈 칸 해제는 바 쪽 `typingCommit`·유형 9종 목록 클라이언트에 별도 보유(서버 모듈 import 방지, 라벨 키와 일치 시험). 변경된 `src` 는 task-055 파일뿐(다른 세션 코드 없음 확인).
- 2026-10-11 18:0x **Developer C(화면 조립) 소환**: 카드·칩·`CorrectionsScreen`·`page.tsx`·자리표시·`tabSkeletonSizes`·`WORD_SKELETON` 주석 갱신. 브라우저가 필요한 실측(A1 344px·A2 298px·점프 ≤8px·3폭·터치 44px·실제 카드 높이)은 QA 몫(교정 데이터 심기는 QA 계정 한정).
- 2026-10-11 18:3x **Developer C 완료**: `DrawerCorrectionCard`·`ErrorTypeChips`·`CorrectionsScreen`·`CorrectionsSkeleton`·`page.tsx`/`loading.tsx`·`tabSkeletonSizes`/`TabSkeleton`·시험 45건. 가이드와 다른 한 곳(수용): 돌아오기 복원 값을 서버 `searchParams` 가 아니라 화면의 `useSearchParams()` 로 읽는다(휴대폰 뒤로가기가 라우터 캐시의 옛 props 를 쓸 수 있음 — 계획표 `PlanScreen` 주석과 같은 이유) → 가이드 §21-6 C 정정. 카드 자리표시 높이 280 은 데모 평균의 가운데 값(미실측, QA 재측정).
- 2026-10-11 18:5x **감사 REV-184 PASS-with-fixes**(Critical 0·High 0·Medium 1·Low 4; 변이 15종 중 14종 시험이 검출, 생존 1종 = R1) — [[task-055-rev-record]]. judge C2: Codex 불필요(`CX-limit-unknown-hold`). 수정 **Developer D**: R1(단어장 검색 디바운스 기본값 고정 시험)·R2(단어 삭제 뒤 초점 대기 `focusWishStep`)·R4(40자 안내 해제 `keepSearchTooLong`), R3(50개 초과 로드 뒤 삭제 시 재조회 한계, 문서화)·R5(DOM 시험 없음)는 의도적으로 미수정. D 는 감사 범위를 넘어 `reloadKeep` 을 함수형 `setQuery` 에서 렌더 시점 값으로 바꿈 → reviewer 가 stale closure 를 별도 검증.
- 2026-10-11 19:0x **재검증 REV-185 PASS**(Critical 0·High 0·Medium 0·Low 2): R1·R2·R4 닫힘, `reloadKeep` 변경은 실위험 없음(단어 시트가 열려 있는 동안 전체 덮개·`dismissible={!busy}` 로 칩/검색/닫기 불가, `retry` 는 오류 상자에서만). Low 2건(시험 한 줄 — 초점 effect 의존성 `[list, open]`→`[open]` 변이와 `commitSearch` 의 `v.trim()` 제거 변이가 생존)은 백로그. 게이트(허용 목록 스냅샷 = HEAD `3bca818` + task-055 `src` 28개, 공유 파일 `conversation/index.ts` 는 task-056 줄 제외): tsc 0·eslint 오류 0·시험 3111/3112·`next build` 0.
- 2026-10-11 19:0x **QA 소환(순차 2갈래)**: α = API #79 라이브(계약·LIKE 특수문자·IDOR·원문·지연, QA 계정에 합성 데이터 ≥65건 심고 매니페스트로 정리 추적) → β = 화면(단어장 344px/교정 모음 298px·점프 ≤8px·카드 실높이·3폭·44px·어두운 화면·돌아오기 복원·경합·단어 시트 R2·회귀) 후 데이터 정리.
- 2026-10-11 20:2x **QA 전체 PASS(결함 0)** — [[task-055-qa-record]] (4갈래, 순차). **α** API #79 라이브: 계약 86/86(잘못된 입력 22종 400·커서 체인 70/70 중복 0·`facets` 의미·숨김 행 0 노출)·LIKE 55/55(`%` 3·`_` 2·`\` 2·`100%` 1 — **이중 이스케이프 `[추측]` 닫힘**, Leader 가 같은 서버에서 직접 재조회해 일치 확인)·IDOR(QA2 는 자기 5건만, 커서 교차도 0)·원문 바이트 일치·지연 첫 쪽 p95 7.1ms(70건)/7.7ms(300건). **β1** 화면 시각: 단어장 목록 시작 344px·교정 모음 298px(3폭)·분절 같은 자리 62/42·자리표시↔데이터 점프 0·3폭×13상태 가로 넘침 0·터치 44px 미만 0·세로 스크롤 상자 1곳·다크 명암비 최저 4.80(라이트)/5.22(다크)·task-055 몫 하드코딩 색 0·히라가나/한글 스위치 대칭·원문 70건 일치. **β2a** 동작: 분절 6회 이동에도 `history.length` 불변·칩 4연타 경합에서 옛 조건 결과 0회(앞선 3요청 abort)·복원 8케이스(TALK·CHAT × ←·뒤로가기 × S1·S2) 모두 같음·세션 기록 위조 21종 거절. **β2b** 단어 시트·회귀·정리: 열기·닫기 초점·표현 고치기(PATCH 1건)·삭제(토스트·버튼 소멸·위치·초점)·**R2 재현 PASS**(다시 읽기 응답 전 다른 카드 탭 → 초점 안 끌려감)·이미 지워진 단어 처리·디바운스 302ms·계획표/교정 기록 늦은 쪽 우선 8케이스. **정리**: QA1·QA2 행 수 시작 값 일치(Leader 재조회: QA1 Chat 3·ChatMessage 64·Correction 5·ACCEPTED 0·WordEntry 0·StatsSnapshot 3·TutorProposal 8, QA2 전부 0), 3011 서버 종료, 쿠키·`.env` 삭제. 도구 결함은 QA 스크립트 쪽 7건(제품 결함 아님: `off-token` 변수 읽기 오류·locator 모호성·계산 오류 등).
- **NOT_VERIFIED / 사용자 실기기**: 역할극 방 교정(시드에 역할극 없음)·TalkBack 낭독·키보드 올라온 시트 수정 폼·실제 글꼴 카드 높이(`cardHeight` 280 유지 — QA 권고 255 는 합성 한 줄 문장 기준)·CHAT 점검 `#cr_` 도착(시드가 점검 전이라 `reviewedAt` 만 대체해 본 관찰: 대상 요소·2초 강조는 있으나 스크롤이 대상 카드 화면 밖에서 멈춤 — `ChatReview.tsx` 미변경 코드, 실데이터 확인 필요).
- 2026-10-11 20:19 **운영 배포 완료(사용자 「task-055 푸시하고 배포 진행해줘」)**: 커밋 `114001c`(코드·문서 31개)+`1cf4d29`(vault) push `3bca818..1cf4d29` → webhook blue/green **릴리스 `20261011-201916-1cf4d29d`** `RELEASE_RESULT ok`·`migrated:false`·헬스 200(PRODUCTION `status: ok`)·pm2 3개 online, 롤백 대상 `20261011-180237-3bca8188`. 푸시 전 게이트(커밋된 HEAD `114001c`, `git archive` 기준): Prisma 생성 0·tsc 0·eslint 오류 0(경고 5)·전체 시험 3,123/3,124(건너뜀 1)·`next build` 0. 운영 읽기 전용 스모크(QA2 쿠키, 즉시 삭제): `/api/health`·`/api/app/version`·`/api/v1/settings/profile`·`/api/v1/corrections?status=ACCEPTED&limit=1`·`/study/ai`·`/study/today`·`/plan`·`/drawer/words`·**`/drawer/corrections`**·`/settings`·`/ask` 11경로 모두 200, 새 API 경계 쿠키 없음 401·`limit=0` 400·`errorType=grammar` 400, QA2 첫 쪽 `items=0 next=null facets={errorType:[]}`(채택 교정 0건 = 「아직 없음」 빈 상태), 화면 제목 「채택한 교정 · 단어장」. 새 라우트 `api/v1/drawer/corrections`·`(app)/drawer/corrections` 가 릴리스 빌드에 포함 확인.
- **공유 파일 커밋 처리(실수 1건 정정)**: `conversation/index.ts`·`docs/screens.md`·`docs/design/api-contract.md` 에 다른 세션(task-056)의 미커밋 줄이 섞여 있어, 작업트리에서 상대 줄(순수 추가)만 뺀 내용을 블롭으로 만들어 스테이징(`git update-index --cacheinfo`)했다. 처음에 `screens.md` §2 표 「회화」 행(81행)의 상대 수정을 내 변경으로 오인해 함께 스테이징했으나 검증 단계(상대 표지 검색)에서 발견해 HEAD 원본으로 되돌린 뒤 커밋 — 상대 몫은 작업트리에 그대로 남음. 스테이징 후 내용 검증(상대 표지 0)을 푸시 전 절차로 삼을 것.
- **상태 `review` / `waiting: device_verify`** (배포 완료, 사용자 폰 확인 대기). 아래는 배포 전 상태 메모: 코드는 미커밋(작업트리). 사용자가 푸시·배포를 승인하면: ① task-055 src·문서 pathspec 커밋(`conversation/index.ts` 는 task-055 hunk 만 `git apply --cached`) ② 커밋된 HEAD 기준 푸시 전 게이트 ③ push → webhook blue/green → 헬스·운영 읽기 전용 스모크(QA 쿠키 GET) ④ 사용자 폰 확인(위 NOT_VERIFIED).
- 동시 작업: 다른 세션 `회화개선` 이 task-056(IMP-0030 한국어 질의 일본어 도우미)을 맡음 — 회화방 입력 바(`TalkRoom.tsx`)·마이크 영역은 그쪽 소유, task-055 는 `usePlanReturn` 훅만 접점(D5 A). 구현 전에 상대 세션에 다시 알린다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 10-11 16:28 |
| v1 | 검토요청 | docs/demo/task-055-drawer-corrections-v1.html | - | 사용자 검토 요청 | 10-11 16:57 |
| v1 | 승인 | docs/demo/task-055-drawer-corrections-v1.html | - | "task-055 데모 v1 승인, D1~D8은 권고대로" | 10-11 17:07 |
