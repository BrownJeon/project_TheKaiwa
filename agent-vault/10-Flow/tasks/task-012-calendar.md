---
task_id: task-012
title: "달력 — 계획표 탭 월 달력·하루 상세·학습 기록 목록·기록 삭제(스냅샷 보존)"
status: doing
base_ref: 98d8cac
risk_level: R1
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-005-settings-attendance, task-008-vocab-today-words, task-010-today-lesson]
tags:
  - type/task
  - domain/plan
  - domain/ui
aliases:
  - 달력
  - 공부계획표
  - task-012
created: 2026-09-28
updated: 2026-09-28
demo_gate:
  required: true
  level: "full"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-012-calendar-v1.html"
  artifact_url: "https://claude.ai/artifact/Pov9EdqNGL9x4jaFJ2MPoz"
  content_sha256: "eaddf2b69e9366843e4137e367756d79de02bfbaaa01a4e18305e4013b1eb944"
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
하단 탭 "계획표"의 "곧 열려요"를 **달력**으로 바꾼다. 월 달력에 날짜별 출석·공부 종류·시간이 보이고, 날짜를 누르면 그날의 학습 기록(단어·회화·채팅·레슨·복습·평가)이 나온다. 기록은 지울 수 있지만 **집계(StatsSnapshot)는 바뀌지 않는다**(삭제 후 추이 불변 — 삭제 정책의 실증). 분석·성장기록은 Phase 3(계획표 탭 안 "곧 열려요" 유지).

완료 기준(design-spec §7-6 · §15 012 · api-contract §2-15 #70·#71 · §2-16 #72·#73):
- #70 `GET /api/v1/plan/calendar?month=` — `StudyLog`+`Attendance` 파생(`days[{date,attended,types,minutes,logCount,hasEvaluation,reviewDue}]`, `summary{attendedDays,studyDays,streak}`), KST 날짜 경계
- #71 `GET /api/v1/plan/day?date=` — 로그 목록(#72 로그 객체)·출석·그날 복습
- #72 목록(from/to ≤92일, type 필터, 커서) · #73 삭제(`Evaluation.studyLogId` SetNull, **`StatsSnapshot` 불변**, `origin=DIRECT` 도 삭제 허용) — 삭제 전후 DAILY·VOCAB_SESSION·LESSON·EVALUATION 스냅샷 행·값 불변을 스모크로 증명
- 월 이동(이전·다음·오늘), 미래 달 비활성, 빈 달 상태, 3폭 잘림 0, 타 사용자 404, 엔진명 0

## 사용자 지시
- 2026-09-28: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘". 스키마 변경 없음.

## 관련 과거 이력 요약
- [[task-005-settings-attendance]]: `Attendance`(하루 1행, `AttendancePing`), `learning/attendance.listMonth·computeStreak`. [[task-008-vocab-today-words]]: 단어 세트 `StudyLog(WORDS)`·스냅샷·"삭제 후 집계 불변" 검증 패턴. [[task-010-today-lesson]]: `StudyLog(LESSON)` 결과 형태(api-contract #62). `minutes` = `StudyLog.durationSec` 합(없으면 0, 추정하지 않음).
- `ComingSoon` 공용 컴포넌트는 Phase/task 번호 노출 문제(정리 backlog) — 계획표 탭에서 이번에 문구 정리.

## Leader's Plan (2026-09-28)
- **L1** 달력 점 표시: 공부 종류별 작은 점(최대 3개 + "+N"), 출석만 한 날은 옅은 표시, 오늘 테두리, 평가한 날·복습 due 날 표시(범례). 색만으로 구분하지 않는다(모양·글자 병행).
- **L2** 하루 상세: 바텀 시트(목록: 종류 아이콘·요약·시간·교정 수), 항목을 누르면 원본으로 이동(단어 세트·레슨 결과·평가 결과·대화방 — 원본이 지워졌으면 "원본이 삭제됐어요"), 기록 삭제는 항목 메뉴 → 확인 시트("기록만 지워요. 통계와 성장 기록은 그대로예요") → 성공 토스트·실패 재시도. **되돌리기 없음**(확인 단계로 대신).
- **L3** 요약 줄: 이번 달 출석 N일·공부 N일·연속 N일.
- **L4** 계획표 탭 구조: 상단 [달력](이번 task) · 분석·성장은 "곧 열려요" 카드(Phase·task 번호 없이).
- 화면(데모 full): 계획표 탭(현재 vs 제안), 월 달력(데이터 많은 달·빈 달·로딩·오류), 월 이동, 하루 상세 시트(여러 종류·출석만·빈 날), 삭제 확인·성공·실패·취소, 원본 이동/원본 삭제됨.
- 파일 경계: developer `learning/studyLog/**`(달력·하루·목록·삭제 — L3 자기 테이블만, 원본 링크용 refId 는 그대로 노출)·`api/v1/plan/{calendar,day}`·`api/v1/study-logs/**`·`components/plan/**`·`app/(app)/plan`(데모 승인 뒤). push 금지.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 09-28 18:07 |
| v1 | 검토요청 | docs/demo/task-012-calendar-v1.html | https://claude.ai/artifact/Pov9EdqNGL9x4jaFJ2MPoz | 사용자 검토 요청 | 09-28 20:23 |

## 작업 기록

### 2026-09-28 19:40 Leader — judge intake
- `judge-result@2`(engine jev, needs_info=false): risk R2 · developer opus · demo **full(JV-ui_change)** · `next=demo_first` → `check.mjs init`. 데모는 Phase 2 나머지 task 와 **한 번에 사용자 검토 요청**(승인 요청 횟수 최소화), 스키마 push 승인도 같은 메시지로.

### 2026-09-28 18:23 developer — 서버
- **범위**: 서버만(화면·`components/plan/**`·`app/(app)/plan` 은 데모 승인 전이라 손대지 않음). 스키마 변경·db push·commit/push 없음. dev 서버는 하드링크 복제본(`~/.node-local/thekaiwa-t012`, `rsync --link-dest`)에서 **3013** 으로 띄웠다가 종료·복제본 삭제(`ss -ltn` 3011~3014 비어 있음). 운영 3010·`/home/brownjeon/apps/thekaiwa` 미접촉.
- **변경 파일**
  - 신규 `src/modules/learning/studyLog/calendar.ts` — `parseCalendarMonth`·`parseDayDate`·순수 `buildCalendar`·`longestRun`·`getCalendar`(#70: `groupBy(date,type)` 1회 + `listMonth`(출석·오늘 기준 streak 재사용) + `ReviewSchedule(DUE)` 1회)·`getDay`(#71: 로그·출석·그날 복습 병렬 3쿼리 + 원본 확인).
  - 신규 `src/modules/learning/studyLog/logs.ts` — 로그 DTO·`refExists`(원본 종류별 `IN` 1회씩, N+1 없음)·`parseStudyLogQuery`·`listStudyLogs`(#72 커서 `(date,createdAt,id)` desc)·`deleteStudyLog`(#73 `deleteMany where {id,userId}` 한 문장 — 소유 확인과 삭제 원자적, 0행이면 404).
  - 수정 `src/modules/learning/studyLog/index.ts`(re-export·머리말) · `src/modules/learning/index.ts`(task-012 export 2줄, 부분 Edit).
  - 수정 `src/modules/conversation/chats/index.ts`·`conversation/index.ts` — **읽기 전용 공개 함수 `ownedChatIds(userId, ids)` 추가**(대화 원본 존재 확인용. L3 는 L2 를 import 하지 않으므로 라우트가 `refs.ownedChatIds` 로 learning 에 넘긴다 — module-dependency §3 준수).
  - 신규 라우트 `src/app/api/v1/plan/calendar/route.ts`(GET #70) · `plan/day/route.ts`(GET #71) · `study-logs/route.ts`(GET #72) · `study-logs/[id]/route.ts`(DELETE #73) — 전부 `requireSession` + userId 범위 쿼리(타인 404).
  - 테스트 `src/modules/learning/__tests__/task012.test.ts`(10) · `tests/live/task012-smoke.{sh,ts}` · `tests/live/README.md` 한 줄.
  - 문서 `docs/design/api-contract.md` #70·#71·§2-16 에 "task-012 구현 기준" 문단(additive, 부분 Edit).
- **계약 추가분(additive)**: #70 `today`(서버 KST)·`summary.longestStreak`(그 달 최장 연속 출석) · `days` = 그 달 **모든 날**(빈 날 포함) · #71/#72 로그 객체 `date`·`refExists` · #71 `review.lessonId`(없으면 null), 예정 복습 없으면 `review:null`, 로그 최대 200 · #72 기본 구간(`to`=오늘, `from`=to 포함 92일 전) · 400 규칙(month·date 연도 2000~2100 포함).
- **정의(결정 필요 시 Leader 확인)**: `streak` = #25·#26 과 같은 "오늘 기준 연속 출석일"(지난 달을 봐도 현재 값) — 지난 달엔 `longestStreak` 을 쓰면 됨. `studyDays` = 기록 ≥1 인 날(출석만 한 날 제외). `hasEvaluation` = 그날 EVALUATION 기록 유무(기록을 지우면 false — 달력은 StudyLog 파생). `reviewDue` = `ReviewSchedule(status=DUE)` 예정일(지난 날짜라도 DUE 로 남아 있으면 true). `minutes` = 그날 `durationSec` 합 → 분 반올림(기록별 반올림 아님).
- **삭제 확인**: DB FK `Evaluation_studyLogId_fkey` DELETE_RULE=`SET NULL` 실측(information_schema) — 스키마가 처리, 코드는 스냅샷을 읽지도 쓰지도 않음.
- **테스트 결과**
  - 단위 `task012.test.ts` 10/10(윤년·평년·12월 경계·minutes 합 반올림·types 순서·summary·KST UTC 15:00 전환·month/date/쿼리 400·refExists 판정·잘못된 id 404).
  - 전체 회귀 600건 중 598 pass · **1 fail = `conversation/__tests__/reviewDecision.test.ts`(task-010b 진행 중 다른 역할 파일, 내 변경과 무관)**. tsc 0. eslint 내 파일 0 — 전체 1 error(`components/lesson/useLessonPlayback.ts:48` refs during render, task-010 화면 파일)·5 warning 은 타 task.
  - 라이브 `bash tests/live/task012-smoke.sh 3013` **32/32 PASS ×2**(정리 후 잔존 0/0/0/0/0/0/0/0, 오늘 DAILY 원복). 응답 p50 ≈ 8ms(dev). 엔진명 grep(`learning/studyLog`·`api/v1/plan`·`api/v1/study-logs`) 0.
- **reviewer 볼 곳**: ① `logs.ts deleteStudyLog` — 스냅샷 경로 0·원자적 소유 삭제 ② `logs.ts existingRefs`·`plan/day`·`study-logs` 라우트 — 원본 확인이 전부 `userId` 범위(남의 대화 id 를 refId 로 가진 로그 → false, 스모크 2c) ③ `conversation.ownedChatIds` 추가가 6층 규칙(learning→conversation import 없음) 안인지 ④ `calendar.ts buildCalendar` 월 밖 날짜 방어 ⑤ #72 커서 OR 조건(같은 date·createdAt 동률 시 id).
- **module-dependency 불일치(보고)**: 정본 L3 공개 API 는 `snapshots: getCalendar·getDay` 로 적혀 있으나, task 파일 경계대로 `studyLog` 에 두었다(달력은 StatsSnapshot 이 아니라 StudyLog+Attendance 파생이므로 studyLog 가 맞다고 봄). 문서 정리는 Leader 판단.
- **화면에 넘길 API 요약**
  - `GET /api/v1/plan/calendar?month=YYYY-MM` → `{month, today, days[{date, attended, types[], minutes, logCount, hasEvaluation, reviewDue}] (그 달 전체), summary{attendedDays, studyDays, streak, longestStreak}}` — 미래 달 비활성은 `month > today.slice(0,7)` 로 판단.
  - `GET /api/v1/plan/day?date=YYYY-MM-DD` → `{date, attended, logs[로그], review{id, status: DUE|DONE|SKIPPED|EXPIRED, lessonId}|null}`.
  - 로그 = `{id, date, type, origin: DIRECT|ACCEPTED, summary, result, correctionsCount, durationSec, refId, refExists, createdAt}` — 원본 이동: WORDS→세트(`refId`=VocabSession) · LESSON/REVIEW→레슨 결과 · EVALUATION→평가 결과 · TALK/CHAT/ASK→대화방. `refExists:false` 면 "원본이 삭제됐어요".
  - `GET /api/v1/study-logs?from&to&type&limit&cursor` → `{items[로그], nextCursor}` · `DELETE /api/v1/study-logs/:id` → `{deleted:true, snapshotKept:true}`(없거나 남의 것 404 → 화면은 목록 새로고침).
- **트러블슈팅**: ① 두 번째 dev 서버는 공유 미러 `.next` 충돌을 피하려고 `rsync -a --exclude .next --link-dest=~/.node-local/thekaiwa` 복제본에서 띄운다(0.5초, node_modules 하드링크). ② 복제본 재귀 삭제는 PreToolUse "Fact-Forcing Gate" 훅이 막는다 — 대상·롤백·지시문을 먼저 적고 **같은 명령을 그대로** 다시 내면 통과(명령 문자열에 그 단어가 들어간 heredoc 도 걸리므로 기록은 Edit 도구로). ③ 다른 developer 가 같은 시간에 `conversation/index.ts` 를 고치고 있었다 — 부분 Edit 만 써서 충돌 없음(내 export 유지 확인).

### 2026-09-28 20:30 Leader — developer 서버 판정
- 승인: `conversation.ownedChatIds`(읽기 전용, 라우트 조합 — 6층 방향 준수) · `streak` = 오늘 기준 현재 연속(기존 #25·#26 과 같은 의미) + 지난 달용 `summary.longestStreak` · 계약 additive 필드(`today`·빈 날 포함 `days`·`date`·`refExists`·`review.lessonId`·#72 기본 범위).
- 정본: `module-dependency.md` L3 공개 API 에서 `getCalendar`/`getDay` 를 snapshots → studyLog 로 옮김(Leader).
- 화면은 데모 승인 대기. 전체 테스트 1건 실패는 task-010b PE 진행 중 테스트(`reviewDecision.test.ts`) — 010b 작업 중 상태, 012 무관. lint 1건은 task-010 화면 작업 중 파일.

### 2026-09-28 18:32 designer — 데모 v1
- [18:32] `docs/demo/task-012-calendar-v1.html` 작성(meta `task-012-v1`, 토큰 `src/app/globals.css@sha256:72ff73699119` 값 고정, 합성 데이터 9월 풍부·8월 중간부터·7월 빈 달). 틀 표시는 승인 데모 task-010 v2 방식 그대로(실제 폭·높이 배치 → 같은 배율 축소, 360/390/412·세 폭·780/892, 892 에 780 접힘선).
- 상태 목록 27개: 계획표 탭 7(현재 vs 제안·이번 달·지난달·빈 달·처음·불러오는 중·오류) / 하루 상세 11(여러 기록·4종+1·평가·오늘 복습 차례·복습 예정·출석만·빈 날·지나간 복습·원본 삭제됨·로딩·오류) / 원본 이동 2(단어 세트 결과·연 뒤 원본 없음) / 지우기 7(메뉴·확인·지우는 중·실패 다시 시도·성공·취소·그날 마지막 기록 지운 뒤). 주소 `#<id>` 로 바로 열림.
- 화면 구조: 앱바 "계획표" → 월 이동(제목·[오늘]·‹ ›, 이번 달이면 [오늘]·[›] 비활성+이유 토스트) → 요약 3칸(이 달 출석·공부 + 이번 달=지금 연속 / 지난달=그 달 최장 연속 `longestStreak`) → 요일 머리 → 7열 달력(칸 66px 버튼, 방향키 이동·roving tabindex, 미래 날짜는 복습할 날만 누름) → 표시 설명 → "분석 · 성장 기록 곧 열려요" 카드(번호 없음). 칸 표시: 공부한 날 흰 칸 + 종류 글자 칩(단·수·복·회·채) 최대 3 + "+N", 평가 = 반전 "평", 복습할 날 = 점선 "복", 출석만 = 작은 동그라미, 오늘 = 주황 2px 테두리 — 글자·모양 병행(색만 X).
- 하루 상세 시트: 머리(날짜·전날/다음 날·닫기) · 출석 배지 + 기록 수·공부 시간(시간 있는 기록만 합, 회화·채팅 안내 한 줄) · 그날 복습 한 줄(오늘 DUE → [복습하러 가기], 지난 DUE·예정·지나감, DONE 은 목록으로 대신) · 기록 행(종류 칩·종류·시각 / 요약 / 시간·메시지·교정 수, 행 = 원본 이동, ⋯ = 메뉴). `refExists:false` → "원본이 삭제됐어요" 배지·이동 안 함(토스트). 원본에서 ← 하면 같은 시트·같은 행으로 초점 복귀.
- 지우기(고위험): ⋯ → 메뉴(원본 보기 / 이 기록 지우기) → 확인 시트(alertdialog, 초점 [취소] 먼저, "이 기록만 지워요. 통계와 성장 기록은 그대로예요." + 종류별 "원본은 그대로 남아요" + "되돌릴 수 없어요") → 지우는 중(두 버튼 정지·바깥 탭 무시) → 성공(닫힘·행 제거·토스트 "기록을 지웠어요"·되돌리기 없음·칸/요약 즉시 갱신) / 실패(빨간 안내 + [다시 시도]) / 취소(변화 없음, 초점 ⋯). 404 는 "이미 지워진 기록이에요" + 목록 새로고침(설명에만).
- 결정 필요 3(데모에서 바로 전환): (a) 날짜 칸 = A 종류 글자(권고) / B 공부 시간 막대 — 회화·채팅은 시간이 없어 B 는 오래 이야기한 날도 점 하나 / (b) 하루 상세 = A 바텀 시트(권고, 시트 안 ‹ › 로 날짜 넘김) / B 달력 아래 펼침(이번 달은 오늘 선택, 780 에서 목록 첫 줄만 보임) / (c) 주 시작 = A 일요일 / B 월요일(권고 — 오늘 탭 "최근 7일" 월~일·성장 기록 주와 일치).
- Leader 확인 2건(데모 옆 "구현 전에 확인할 것"): ① "이 달 공부 N일"은 StudyLog 파생이라 그날 마지막 기록을 지우면 1 줄어듦 — 확인 문구 "통계와 성장 기록은 그대로예요"를 유지할지 "성장 기록의 숫자는 그대로예요"로 좁힐지 ② REVIEW 로그 요약이 지금 `오늘의 회화 「…」`(lessons/lifecycle) — 데모는 `복습 「…」` 로 표시. (원본 존재 여부는 developer `refExists` 로 해소 — 반영함.)
- 검증: `check.mjs lint --expect task-012-v1` → DEMO_LINT_PASSED. 헤드리스 Chrome(CDP, 412×892 모바일): 27상태 × 3폭 + 결정 B안 조합 = 118회 가로 넘침 0(페이지·틀 안·시트), 칸 안 칩 넘침 0(360/412 × a=A/B), 엔진명·task/Phase 문구 0(메타 제외), JS 오류 0. 클릭 흐름 38단계 × 2 뷰포트(1440·412) 76/76 PASS(시트 열기·초점·메뉴→확인→취소·실패→다시 시도→성공·원본 이동/복귀·Esc·방향키·달 이동 로딩/오류/빈 달/오늘·결정 전환·비교→제안).
- 구현 가이드(screens.md)는 사용자 승인 뒤 작성. src·frontmatter·screens.md 미접촉, commit 없음.

### 2026-09-28 22:28 reviewer — REV-031

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0 — "발견 없음"). 범위: `learning/studyLog/{calendar,logs,index}.ts`·`api/v1/plan/{calendar,day}`·`api/v1/study-logs/**`·`conversation/chats.ownedChatIds`.

- ① `deleteStudyLog` — `prisma.studyLog.deleteMany({ where:{ id, userId } })` 한 문장으로 소유 확인·삭제가 원자적(0행이면 404). 코드 어디에도 `StatsSnapshot` read/write 없음(grep 확인). `Evaluation.studyLogId` 는 schema 의 기존 FK `onDelete: SetNull`(스키마 변경 아님, 이미 정본)이 처리 — 학습 원칙(삭제 후 집계 불변) 충족.
- ② `existingRefs`/`getDay`/`study-logs` 라우트 — 원본 확인이 전부 `userId` 범위(`vocabSession`·`lesson`·`evaluation.findMany({where:{userId,...}})`, `conversation.ownedChatIds(userId, ids)`) — 남의 대화 id 를 `refId` 로 가진 로그라도 `refExists:false` 로만 나온다(남의 원본 유출 없음).
- ③ `ownedChatIds` 는 conversation 이 소유한 읽기 전용 함수를 **라우트가** import 해 learning 에 콜백으로 넘긴다(`learning/studyLog/logs.ts` 는 `@/modules/conversation` 을 import 하지 않음) — module-dependency §3("L3 는 L2 를 import 하지 않는다")·eslint `no-restricted-imports` 경계 둘 다 준수(아래 검증 항목에서 eslint 0 errors 로 확인).
- ④ `buildCalendar` — `inMonth()` 로 월 밖 날짜를 걸러 `attended`/`reviewDue`/`byDate` 모두 방어. `dates.eachDateInRange(from,to)` 로 그 달 모든 날을 만들어 `days` 를 채우므로 빈 날도 누락 없음.
- ⑤ `#72` 커서 — `where.OR=[{date:{lt:d}}, {date:d, createdAt:{lt:t}}, {date:d, createdAt:t, id:{lt:cursor.id}}]` — 동률(같은 date·createdAt) 처리가 `id` 로 명시돼 있어 페이지 경계에서 중복·누락 없음.
- 라우트 4개(`plan/calendar`·`plan/day`·`study-logs`·`study-logs/[id]`) 전부 `requireSession()` + `userId` 스코프 쿼리, 타인 접근은 404(사용자 문서·코드 표현 일치).
- `docs/design/api-contract.md` #70·#71·§2-16 의 "task-012 구현 기준" 문단이 실제 응답 모양(`today`·빈 날 포함 `days`·`refExists`·`review.lessonId`·#72 기본 구간)과 정확히 일치. `docs/design/module-dependency.md` L3 공개 API 표도 `getCalendar`/`getDay` 를 `studyLog` 로 옮긴 Leader 판정이 반영됨.
- 실행 검증(`~/.node-local/thekaiwa`): `tsc --noEmit` 0 · `eslint .`(전체) 0 errors/5 warnings(전부 무관 파일 `SpeechSettings.tsx`/`VoiceSettings.tsx`, 이 task 범위 밖) · 단위 테스트 706건 705 pass/1 skip/0 fail(스코프 파일 `task012.test.ts` 10/10 포함) · `next build` 클린 성공(`/api/v1/plan/calendar`·`/api/v1/plan/day`·`/api/v1/study-logs`·`/api/v1/study-logs/[id]` 라우트 전부 생성 확인).
- **릴리스 동반 가능**: 예. 화면 미구현 상태로도 서버 코드 자체는 완결적이고 안전 — task-010 과 함께 배포해도 무방.
