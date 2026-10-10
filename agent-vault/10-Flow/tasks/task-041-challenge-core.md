---
task_id: task-041
title: "챌린지 DB·서버 코어 — learning/challenges·#155~#159·#58 CHALLENGE·#62 응답·#70·#71 (IMP-0024, 설계서 T1)"
status: done
base_ref: 5c3a701
risk_level: R2
roles_involved: [leader, judge, developer, reviewer, codex, qa]
related_tasks: [task-040-improve-challenge-design, phase2-batch-plan, task-p2-db0-schema, task-042-topic-words-b2, task-043-challenge-screens, task-044-today-integration, task-010-today-lesson, task-012-calendar, task-008-vocab-today-words, task-010d-scenario-roleplay]
imp: [IMP-0024]
tags:
  - type/task
  - domain/challenge
  - domain/db
aliases:
  - 챌린지 서버 코어
  - challenge-core
  - task-041
created: 2026-10-06
updated: 2026-10-10
demo_gate:
  required: true
  level: "delta"
  status: "waived"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: "user"
  waived_at: "2026-10-06T23:43:51+09:00"
  waiver_quote: "데모 생략하고 진행해줘"
  active: false
---

## 목표 (Leader)
개선 항목 [[IMP-0024-챌린지-계획표-개편]] 의 **설계서 T1** — 챌린지의 서버 쪽 전부. 정본은 `docs/design/challenge.md` **v2.3** 이고 이 이력서는 그것을 구현 task 로 자른 것이다(새 규칙을 만들지 않는다).

- `src/modules/learning/challenges/**`(L3 신규): 만들기·목록·상세·오늘·그만두기·지연 전이(`settleExpired`)·`challengeProgressAfter`(#62·#51 응답용, 읽기 전용)·`challengeDayStates`(#70·#71 용)·`getActiveChallengeTopic`(#58 용) + 순수 `metrics.ts`(§6-4, `today`·`now` 주입).
- 새 API `#155~#159`(목록·만들기·상세·오늘·그만두기). 기존 라우트 additive: **#58**(`recommendation.reason='CHALLENGE'`) · **#62**(응답 `challenge?`, 트랜잭션 무변경) · **#70·#71**(챌린지 칸).
- 지표는 새 원장 없이 기존 `StatsSnapshot(LESSON·VOCAB_SESSION)` 을 **읽을 때 계산**한다(U7 = iii). 수업·세트 완료 트랜잭션에 챌린지 쓰기를 넣지 않는다.
- **스키마는 이 task 가 쓰지 않는다** — `Challenge`·`ChallengeStatus` 는 WP-DB0([[task-p2-db0-schema]])가 단일 작성자로 쓰고 Leader 가 한 번에 push 한다. T1 은 `prisma/schema.prisma` 를 건드리지 않고, push 뒤 자기 미러에서 `prisma generate` 만 한다.

## 사용자 결정
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**.
- 2026-10-06 사용자 답(AskUserQuestion, Leader 전달 — 이 이력서 작성자는 원문 대화를 보지 못함): **DB 전부 승인**(챌린지 D1·D2·D4·D5 — 모두 추가만, 백업 후 다른 승인 변경과 한 번에 `prisma db push`) · **운영 배포는 모든 작업이 끝난 뒤 한 번에** · **챌린지 U3 = B2**(오늘의 단어 LLM 생성), 나머지 U1~U15·N1~N3 은 설계서 권고안으로 확정.
- 확정값 요약(설계서 §11-4a — ★ = 이 task 가 직접 쓰는 것):

| # | 결정 | 확정값 |
|---|---|---|
| U1 ★ | 데이터 모델 | A — 새 표 `Challenge` |
| U2 ★ | DB 변경 | D1·D2·D4·D5 한 번에 승인(추가만) |
| U3 | 오늘의 단어 | **B2** — A12 `topicWords` 가 매일 새 단어를 만든다. 폴백·채움은 B1 풀 (설계서 권고 B1 과 다름) → [[task-042-topic-words-b2]] |
| U4 | 풀 부족 | 주제 표현만(내 단어장으로 채우지 않음). B2: 새 단어 → B1 풀 순 |
| U5 ★ | 수업 만드는 시점 | C3+ 한 번 탭(오늘 탭 회화 카드 [오늘 수업 만들기]) — 새 LLM 경로 없음, `#160` 예약은 쓰지 않음 |
| U6 | 010d 범위 | 나눠서(A1-서버 지금 · A1-PE 039 뒤 · A2 T1 뒤 · A3+B 캡처 뒤 · 챌린지 2단계) |
| U7 ★ | 지표 원천 | (iii) 기존 LESSON·VOCAB_SESSION 스냅샷을 읽을 때 계산 |
| U8 ★ | 연속·달성률 | 오늘 유예 |
| U9·U10 | 계획표 IA·탭 이름 | F1(맨 위 챌린지 카드 + 달력 유지) · "계획표" 유지 |
| U11 ★ | 기간·장수 | 7·14·30일 · 단어 5·10·15장(기본 표현 수를 넘는 장수는 비활성 — 시드 주제는 15 비활성) |
| U12 ★ | 무엇을 셀지 | (가) 같은 주제면 어디서 했든 + 시작일이 오늘이면 만들기 전 공부도 |
| U13 ★ | 개수·조작 | 진행 중 1개 · 그만두기만 |
| U14 ★ | 하루 달성 기준 | W2 — 목표 장수의 80%(5→4·10→8·15→12)를 그날 합산 + 다시 풀기도 셈 + 수업은 끝내기만(W4 없음) |
| U15 | 주제 세트 다시 풀기 | A — 주제 세트로 다시 풀기 + 통계 포함 |
| N1·N2·N3 | 단어장에 넣기 · 이름 · 수업 만들기 위치 | 바로 넣기 · 자동 "<주제> N일 챌린지" · 오늘 탭 회화 카드에만 |
| 설계 판단 | 예문·A12 | E2 예문 없음 · fast(haiku)·[시작하기] 동기(G1)·벽시계 30초 |

## 설계 방침 (설계서 v2.3 요약 — 근거 절 번호는 `docs/design/challenge.md`)
- **모델(§3)**: `Challenge`(새 표 — `activeKey @unique` 가 사용자당 진행 중 1개를 DB 에서 보증, ACTIVE 일 때 `userId`, **끝내는 모든 경로(COMPLETED 전이·#159)가 `activeKey=null` 을 함께 쓴다**) · `dailyGoal` Json 은 **만들 때 얼린다**(`{lesson, words, wordCount, wordsMinAnswered=ceil(4n/5), countSkipped:false, ruleVersion:1}`, `words:false` 면 두 장수 칸 null) · `result` Json 은 끝날 때 한 번만 쓰고 이후 불변 · `endedAt` = COMPLETED 는 endDate 다음 날 00:00 KST, ENDED 는 그만둔 시각. 스키마 작성은 DB0.
- **하루 달성(§6-0)**: 수업 과제 = 그날(**끝낸** KST 날짜) 챌린지 주제의 새 수업(`kind=NEW`) 1개 이상(점수 무관) · 단어 과제 = 그날(**세트를 시작한** KST 날짜) 주제 세트들의 (맞힘+틀림) **합계 ≥ `wordsMinAnswered`**(건너뜀 제외, 다시 풀기도 합산). 복습 수업·붙여넣기 수업(`topicId=null`)·내 단어장 세트·다른 주제는 세지 않는다. 하루 상태: MET · 수업을 끝냈거나 주제 세트에서 1장 이상 답했으면 PARTIAL(**건너뛰기만 한 세트는 한 것이 아님**) · 아무것도 없으면 MISSED.
- **계산(§6-4)**: `closeAt`(= `endedAt` ?? (오늘 > endDate ? endDate 다음 날 00:00 KST : now)) · `범위(s)`(`topicId ≠ null` && 시작일 00:00 ≤ `createdAt` < `closeAt` && 주제·날짜 일치) · 하루 상태 판정 **순서 STOPPED → UPCOMING → MET → TODAY → PARTIAL → MISSED**(그만둔 날 뒤가 "예정"으로 얼지 않게) · `elapsed`·`rate`(지난 날 0 이면 null)·`streak`(진행 중일 때만, 오늘 유예)·`longest`·누적(`lessonsDone`·`wordSets`·`wordsCorrect` — **v2.3: 세트 수는 답한 카드 ≥ 1 인 세트만**) · `goalMetNow` = 그날 스냅샷을 `(createdAt, id)` 순으로 더해 가다 **그날을 달성으로 바꾼 바로 그 스냅샷**만 true. 스냅샷 `data` 는 형태가 어긋나도 0 으로 읽는 방어 파싱(`vocab/stats.ts:39-48` 선례).
- **상태 전이(§5-5)**: ACTIVE → COMPLETED(오늘 > endDate — 읽거나 만들 때 **지연 전이**, 사용자 행 잠금 뒤 조건부 UPDATE) · ACTIVE → ENDED(#159, 이미 ENDED 면 같은 응답 — 멱등) · `topicId=null` 이면 ENDED(`result.endReason='TOPIC_REMOVED'` — 1단계 도달 불가). 마감 = 마지막 날 24:00(KST), 어느 시각에 전이를 실행해도 `result` 가 같아야 한다(결정적).
- **만들기 #156(§5-3·§9-1)**: 사용자 행 잠금 → 기간 지난 ACTIVE 지연 전이 → 진행 중 확인(409 `ACTIVE_EXISTS {challengeId}`) → `Challenge` 1행, 한 트랜잭션. P2002 도 409 로 변환. 요청 `{topicId, lengthDays:7|14|30, start:'TODAY'|'TOMORROW', dailyGoal:{lesson, words, wordCount?:5|10|15}, title?≤40자}`, `wordsMinAnswered`·`countSkipped`·`ruleVersion` 은 서버가 채운다. 오류: 400(둘 다 false·범위·모르는 키·`WORD_COUNT_OVER_POOL {poolSize}` — `poolSize` = 그 주제 기본 표현(`TopicChunk`) 수, 카드 폭 필터 뒤, 수업 표현 제외) · 404(주제 없음·남의 주제) · 429(사용자당 하루 20회). 자동 제목 = `truncateCodePoints(주제 제목, 60) + " N일 챌린지"`.
- **오늘 #158(§6-1·§9-1)**: `{challenge, today: TodayTasks, recentlyEnded}` — **LLM 호출 없음**. 할 일 순서 **단어 → 회화**. 수업 `GENERATING` 은 `infra.jobs.findActiveJob({userId, kind:'LESSON_GEN', refId})` 로 잡이 살아 있을 때만, 없으면 **표시만 FAILED**(`Lesson` 행은 쓰지 않는다 — "쓰기는 `Challenge` 만"). 어제 만든 챌린지 주제 수업은 [이어서 하기] — 기존 `older` 조회(`today.ts:121-125`)에 `topicId` 조건을 더한다. `TodayTasks` 에 풀 크기를 넣지 않는다(#158 이 수업 본문을 읽지 않게).
- **#58(§9-2)**: 진행 중 챌린지가 있고 오늘 챌린지 수업을 아직 안 끝냈으면 그 주제를 최우선(`reason:'CHALLENGE'`). LLM 호출을 늘리지 않는다.
- **#62 `challenge?`(§5-4)**: 라우트가 **커밋 뒤** `challengeProgressAfter` 를 읽어 붙인다. 값이 나오는 조건은 ACTIVE 챌린지 · `범위(s)` 통과 · LESSON 이면 `kind=NEW` · 그 과제가 `dailyGoal` 에서 켜져 있을 때뿐이고 **그 밖은 전부 null**(진행 중 없음·끝남·기간 밖·마지막 날 자정 뒤·다른 주제·내 단어장 세트·복습 수업·붙여넣기 수업·꺼진 과제). 실패(쿼리 오류·`dailyGoal` 형태 이상)는 로그만 남기고 `challenge:null` — 수업 완료는 절대 되돌려지지 않는다. 함수는 읽기 전용(지연 전이를 하지 않는다).
- **#70·#71(§9-2)**: `days[].challenge?: {challengeId, dayIndex, state}`(그 달에 걸친 챌린지 날만) · `summary.challenge?: {id, metDays, elapsedDays, streak}`(진행 중일 때) · `plan/day` 의 `challenge?: {challengeId, title, dayIndex, state, lesson, words}`.
- **상세 #157 `topicProgress`(§6-1)**: 기본 표현(`chunkTotal`·`chunkStudied`·`chunkMastered`)·수업 표현(`lessonExprCount`)·이 주제 수업 수(`lessonsDone` — `topics.doneLessonStats`, #56 카드와 같은 값)·**새 단어 진행**(`aiWordTotal`·`aiWordStudied`·`aiWordMastered` — 이 주제 `AiWord` 카드 키 + `RepetitionItem('Expr', refId)`, #157 만·#158 에는 없음). 익힘 = `correctCount ≥ 2 && correctCount > wrongCount`, 공부 = `studiedCount ≥ 1`.
- **층·import(§10-1)**: `challenges → {topics, topics/pool, snapshots(타입), preferences, infra}` 만. **`../lessons`·`../vocab`·`../studyLog` 를 직접 import 하지 않는다**(barrel `../lessons` 도 금지 — `lessons/today.ts → challenges → topics/pool → lessons/index → today.ts` 순환). `lessons/today.ts`·`studyLog/calendar.ts → challenges` 는 단방향. 수업·세트 완료 코드는 challenges 를 import 하지 않고, 응답 조합은 라우트(app 층)가 한다. `lessons/lifecycle.ts` 는 **변경 없음**.
- **소유자 검사(§3-3)**: #155~#159 는 `where {id, userId}`, 없거나 남의 것은 404. `topicId` 는 시드 또는 내 주제만(`getTopicRef`). 날짜는 전부 서버 KST(`infra.dates.todayKst`) — 클라이언트 날짜를 키로 쓰지 않는다. 엔진명·모델명 노출 0.
- **T6(챌린지 × 시나리오)는 보류**(010d-B 이후 2단계 조건부 — 역할극 완료 스냅샷이 필요하면 `SnapshotKind` 값 추가가 필요해 **승인 밖**). 이 task 에 포함하지 않고 파일도 만들지 않는다. 후속 한 줄 기록만.
- **진행 절차**: judge intake(R2 — C1·C2·Codex 개입은 judge 판정) → developer(judge `developer_model`) → Reviewer → judge C2 → (판정 시) Codex → QA → Leader 로컬 커밋(pathspec — 이 task 소유 파일만). 정본 갱신(§11-3)은 Reviewer PASS 뒤 **Leader 단독**(C17).

## 예상 변경 경로
- `src/modules/learning/challenges/**` — 신규(`index.ts` 빈 스캐폴딩은 DB0 가 만든다 — 2026-10-06 21:59 작업 트리에 이미 보임). 공개 API 는 이 하위 `index.ts` 에만 더한다(`learning/index.ts` 의 `export * from './challenges'` 는 DB0 가 넣는다 — 2026-10-06 22:00 작업 트리에 미커밋으로 이미 보임). 순수 `metrics.ts`.
- `src/modules/learning/lessons/today.ts`(#58 `CHALLENGE`) · `src/modules/learning/studyLog/calendar.ts`(#70·#71)
- `src/app/api/v1/challenges/**`(#155~#159 — 목록·만들기·상세·`today`·`[id]/end`) · `src/app/api/v1/lessons/[id]/complete/route.ts`(#62 응답 `challenge?` 조합, try/catch → null)
- `src/types/challenge.ts`(신규)
- 테스트: `src/modules/learning/__tests__/challenge*.test.ts`(이름은 developer 가 정함) · `tests/live/challenge-*`(신규 — 스모크·5초 참고치·QA 계정 정리 도구)
- 문서(Leader 단독, 설계서 §11-3 T1 행): `docs/design/domain-model.md`(§1 소유 표·§2-2·§3 모델·enum·칸·§4-3·§5 `ChallengeStatus`·§6 삭제 매트릭스 `Challenge` 행·§9-3 세 JSON 모양 `topicId?`/`dailyGoal`/`result`·Profile 주석) · `api-contract.md`(§1 총람 `#155~#159`·상세·#58·#62·#70·#71·§0-4 소유자 검사 목록에 `Challenge`·§2-13 잠금 순서 변경 없음 명시·`#160` 예약 해제) · `module-dependency.md`(L3 표 `challenges/`·import 단방향 규칙) · `design-spec.md`(§7-2·§7-6·§11 `/plan` 행·§15 task 행) · `learning-personalization-and-llm-data.md`(§2-9 한 줄)
- **목록 밖(Leader 확인 필요 §2)**: `src/types/plan.ts` · `src/types/lesson.ts` · `src/app/api/v1/plan/{calendar,day}/**` · `src/app/api/v1/lessons/today/route.ts`

## 완료 기준 (QA 가 실행으로 확인)
설계서 §11-2 T1 행·§6-4 확인 표·§5-2·§5-4 를 그대로 옮긴다.

1. **지표 단위 테스트 = §6-4 확인 표 1~14 를 그대로 픽스처로**(경계 포함) — 1(진행 중 오늘 아침: 띠 ✓✓◐오···, 지난 3·달성 2·**67%**, 연속 0·최장 2) · 2(오늘 둘 다 끝냄: **75%**, 연속 1) · 3(U8 B 아님을 확인하는 비교값) · 5(마지막 날도 오늘 유예) · 6(마지막 날 23:50 시작·00:10 끝낸 세트는 마감 뒤라 제외, 전이 직전 ACTIVE 와 COMPLETED 가 같은 값) · 7(자기소개 COMPLETED **71%**·최장 3) · 8a~8d(길 묻기 ENDED **60%**·최장 2, 그만둔 당일 계산 = 나중 계산, "예정" 0칸, 그만둔 뒤 공부는 세지 않음) · 9(`goalMetNow` — 4장+4장 두 세트에서 **첫째 거짓·둘째 참**) · 10(첫날 아침·내일 시작·내일 시작인데 오늘 그만둠 → `rate:null`) · 11a~11e(단어 합산·작은 세트·다시 풀기·건너뜀) · **12 = 소급 달성(세트 6·3·1 — 어제 ◐ → ✓, 연속 0 → 3, 누적 맞힌 카드 21)** · **13 = 건너뛰기만 한 세트(날 ✕, 누적 세트 2·맞힌 카드 15)** · 14(`topicId=null` → 전부 ✕ + `endReason='TOPIC_REMOVED'`). 두 세트 날은 **20장 중 맞힘 6·틀림 2·건너뜀 12(푼 8장)** + 수업 → 달성 75%·누적 세트 5.
2. **계약 단위 테스트**: `challengeProgressAfter` null 목록(§5-4 — 위 방침 그대로) · `words {answered, need}`(LESSON 이면 null) · `activeKey` — 동시 #156 두 개 → 하나만 성공·나머지 409, 끝낸 뒤 새로 만들기 성공, 끝내는 모든 경로가 `activeKey=null` · `ruleVersion`·`dailyGoal` 얼림(코드 상수를 바꿔도 진행 중 챌린지 수치 불변) · 지연 전이 결정성 · 픽스처는 `now ≥ 마지막 스냅샷 createdAt + 1ms`(진행 중 `closeAt = now`, 비교가 `createdAt < closeAt` 라서).
3. **QA 라이브(QA 계정 3 — 챌린지 레인)**:
   - 동시 두 #156 → 하나 409 · 끝낸 뒤 새로 만들기 성공 · **타인 챌린지·타인/없는 주제 404**.
   - StudyLog·Lesson 을 지운 전후 지표 동일(스냅샷 불변) · 같은 수업·세트를 두 번 완료해도 지표 +1 만(스냅샷 `@@unique`).
   - 23:59/00:01 경계·소급(확인 표 12) · 마지막 날 자정 마감(확인 표 6) · 그만둔 챌린지 `result.days[]` 가 그만둔 당일 계산 = 나중 계산.
   - 거의 동시에 끝낸 수업·세트의 `goalMetNow` 토스트가 한 번만.
   - 계획표 `GENERATING` 죽은 잡 → "만들지 못했어요" 표시 상태(회화 줄) · 오늘 다른 주제 수업이 끝났거나 열려 있어도 챌린지 수업 상태가 `TodayTasks` 의 주인.
   - **`challengeProgressAfter` 가 실패해도 수업 완료가 그대로**(응답 `challenge:null`).
   - 기존 클라이언트 영향 없음: #58·#62·#70·#71 의 기존 필드·모양 불변(additive).
   - **#157 p95**: 설계 목표 ≤ 300ms [설계 목표 — 합격 판정 아님, 수업 본문(최근 60개 `content`만 select) 읽기 포함이라 측정해 기록].
4. **5초 지표(§5-2) — 합격 판정은 결정적 검사, 지연은 참고치**:
   - **ⓐ 합격**: 챌린지가 새로 만든 경로(#155~#159 · #58·#62·#70·#71 의 챌린지 칸 조합 · 계획표 화면) 를 호출하는 테스트 전후로 **LLM 호출 수·`RequestTrace` 행·`AiJob` 행 증가 0**. 비교 기준은 같은 시나리오를 챌린지 칸 없이 돌린 값("챌린지 때문에 **더** 생긴 것 0" — 완료 뒤 A11 판단 잡 1건은 챌린지 전에도 생긴다).
   - **참고치(LLM 직렬 슬롯)**: 같은 세션에서 챌린지 전·후 각 **30턴**(`tests/live/task007-latency.ts` 방식)으로 TTFA·턴 p50 기록 — (가) 오늘 탭 진입(#58·#158) → 곧바로 회화 첫 턴 · (나) 주제 단어 세트 또는 수업을 끝낸 직후 → 곧바로 회화 첫 턴(A11 가드를 통과한 계정 — 공부한 날 2·항목 2 이상). 목표 회귀 ≤ **+0.3s** 는 [설계 목표]이고 합격 판정에 쓰지 않는다(턴 p50 4.2~4.7s·LLM 분산에 표본 10~30개로 0.3s 를 가려내기 어렵다 [가능성 높음]). 큰 회귀(+2s 이상)가 보이면 원인(A11 잡 겹침 여부)을 Trace 로 확인해 이력서에 남긴다.
   - (가) 반복은 하루 첫 진입 A11 잡이 하루 1번뿐(`decision.ts:168-173`)이라 **테스트 계정의 그날 `REVIEW_DECISION` AiJob 행을 지우는 정리 절차**를 T1 테스트 도구에 둔다(운영 계정 금지). (나)는 정리가 필요 없다.
5. **층·import 검사**: `challenges` 가 `../lessons`·`../vocab`·`../studyLog` 를 직접(또는 barrel 로) import 하지 않는다(grep/eslint) · L3 → L2 import 0 · 엔진명 0.
6. 회귀: 단위 전부 + `tsc --noEmit`·변경 파일 eslint 0 + 기존 스모크(008·010·011·012 등 영향 경로). 스키마 diff 범위 확인(승인 목록 D1·D2·D4·D5 뿐)은 **DB0·Leader 몫**이며 T1 QA 는 그 기록 존재만 확인한다.

## 파일 경계
계획서 [[phase2-batch-plan]] §2 충돌 지도 기준.
- **소유**: C4 `learning/lessons/today.ts`(041 먼저 → 010d-A3 는 T1 로컬 커밋 뒤) · C7 `app/api/v1/lessons/[id]/complete/route.ts`·`learning/studyLog/calendar.ts`·`app/api/v1/challenges/**`·`types/challenge.ts` · `learning/challenges/**` · `tests/live/challenge-*`.
- **금지**: `prisma/**` 전체(스키마 단일 작성자 = DB0, C1) · `learning/index.ts`(C5 — DB0 가 export 2줄을 넣는다, 이후 각자 하위 `index.ts` 만) · `learning/topics/pool.ts`(042 소유 신규 파일 — T1 은 import 만) · `learning/vocab/**`(042) · `learning/lessons/lifecycle.ts`(변경 없음) · `src/modules/conversation/**` 전체(task-039 미커밋 파일 다수) · `components/**`(043·044) · `tests/live/qa-session.ts`(DB0 만, C19).
- **미러**: `~/.node-local/thekaiwa-041`, dev 포트 **3021**(`KAIWA_LOCAL_ROOT="$HOME/.node-local/thekaiwa-041" bash scripts/sync-local.sh`, 계획서 §3 복제 절차). **NFS 만 편집**, DB0 push 뒤 이 미러에서 `prisma generate` 1회. 다른 WP 의 미완성 파일 때문에 `tsc` 오류가 나면 소유 밖 파일은 고치지 않고 이 이력서에 기록 → Leader 가 소유자에게(계획서 §3 규칙 4). 3010(운영)·3011/3012(기존 dev) 사용 금지. WP 종료 시 dev 서버 종료·포트 확인(`ss -ltn`), 미러 디렉터리 삭제는 사용자 몫. 미러 `npm run build` 허용(개발 전용).
- **QA 계정 3**(챌린지 레인, DB0 가 `tests/live/qa-session.ts` 에 추가 — 만든 행 정리 방법을 이력서에 남긴다). 사용자당 진행 중 1개·풀던 세트 409 규칙 때문에 같은 계정을 쓰는 042·043·044 QA 와 **시간을 나눈다**(동시에 돌리면 서로 409).
- **LLM 직렬 슬롯**: LLM 을 쓰는 라이브(위 4번 참고치 (가)(나))는 한 번에 하나 — 계획서 §6 순서 "039 QA·A3 20회 → **041 TTFA 참고치** → PE A12 → 042 스모크 → …". 041 API(#155~#159)·지표 라이브는 LLM 이 없어 다른 레인과 병렬 가능.
- **커밋·배포**: 로컬 pathspec 커밋만(`git -c safe.directory=$PWD -c user.name=brownjeon -c user.email=ifries8611@gmail.com commit`), **push 금지** — 운영 배포는 모든 WP 가 끝난 뒤 Leader 가 한 번에(계획서 §7).

## 선행·후행
- **선행**: WP-DB0 스키마 작성·Reviewer PASS·백업·`migrate diff` 확인·`db push`·미러 `prisma generate`([[task-p2-db0-schema]], 계획서 §4). 단위 테스트는 DB0 스키마가 작성되고 `prisma generate` 가 된 뒤 push 전에도 돌 수 있고, 라이브 QA 는 push 뒤. 이 task 소유 경로에 task-039 미커밋 파일은 없다(2026-10-06 22:00 `git status` 확인).
- **후행**: [[task-043-challenge-screens]](#155~#158·#70·#71 소비 — 타입은 설계서 §9 로 먼저 시작 가능, 통합은 T1 머지 뒤) · [[task-044-today-integration]](#158·#62 `challenge?`) · [[task-042-topic-words-b2]]((a) #51 응답 `challenge?` 조합은 T1 `challengeProgressAfter` 로컬 커밋 뒤, (b) T1 의 `topicProgress.aiWord*` 는 T2 `topics/pool.ts` 의 카드 출처 상수 머지 뒤) · 010d-A2·A3(`today.ts` 는 T1 로컬 커밋 뒤, [[task-010d-scenario-roleplay]]).
- **후속(이 task 밖)**: T6 챌린지 × 시나리오 — 010d-B 이후 2단계 조건부, 역할극 완료 인정에 `SnapshotKind` 값 추가가 필요할 수 있어 승인 밖이다(계획서 WP-045 보류).

## 관련 과거 이력 요약
- [[task-040-improve-challenge-design]]: 이 task 의 설계 정본(`docs/design/challenge.md` v2.3, REV-112·113·114 반영). 확인 표 1~14·§5-2 5초 지표가 완료 기준의 원천.
- [[task-010-today-lesson]]: 수업 생성(A4)·`claimLesson`·`today.ts`·#58·완료 트랜잭션 — 이 task 는 수업 완료 트랜잭션을 바꾸지 않는다(`lifecycle.ts` 변경 없음).
- [[task-012-calendar]]: 달력·하루 시트(#70·#71)·`studyLog/calendar.ts` — 이 task 는 챌린지 칸을 additive 로 더한다.
- [[task-008-vocab-today-words]]: VOCAB_SESSION 스냅샷(`data.date` = 세트 시작일)·세트 끝내기 규칙(1장만 답하고 끝내도 DONE) — 단어 과제 합산 기준의 근거.
- [[task-010d-scenario-roleplay]]: `today.ts` 를 같이 쓰는 후행(#58 `recommendedScenarios[]`) · 상황 수업의 `Lesson.topicId` 채움 규칙은 010d-A2 가 정한다.
- [[task-042-topic-words-b2]]·[[task-043-challenge-screens]]·[[task-044-today-integration]]·[[task-p2-db0-schema]]: 같은 설계서의 형제 task.
- 승인된 교훈: 없음(`/이슈기록 관련` — "챌린지 계획표 UI"·"프롬프트 LLM 단어"·"DB 스키마 push"·"화면 데모" 4개 질의 모두 0건, 2026-10-06 `cli.mjs related` 실행).

## 승인 상태
- **DB**: D1(enum `ChallengeStatus`)·D2(표 `Challenge`) — **사용자 승인 완료(2026-10-06, Leader 전달 — D1·D2·D4·D5 전부, 추가만)**. 스키마 작성자 = WP-DB0([[task-p2-db0-schema]]), 백업 → `migrate diff` 확인 → `db push` 는 Leader 가 **한 번만**. T1 은 `prisma/schema.prisma` 를 쓰지 않는다. 승인 범위 밖 변경(`SnapshotKind`·`JobKind` 값 추가 · 단어 은행 표 · T6 용 칸)이 필요해 보이면 줄을 넣지 말고 이 이력서에 "추가 승인 필요"로 기록한다.
- **데모**: 사용자 지시 원문(위 인용)에 따라 데모 승인 없이 진행한다. 이 task 는 화면 0(서버)이라 judge 가 데모 none 으로 볼 것으로 설계서가 예상한다. `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다(손으로 쓰지 않음). 지시 원문은 `check.mjs waive` 규칙에 걸리지 않아 정식 waived 기록은 없다 — 이력서에는 원문만 인용하고 `waived` 로 적지 않는다.
- **운영 배포**: 모든 작업이 끝난 뒤 Leader 가 한 번에(git push = webhook). 이 task 단독 배포·push 금지. M4·네이티브(APK) 변경 없음.
- **판정 예상(설계서 §11-2, 최종은 judge)**: R2 · standard · 데모 none. R2 근거 = `db push`·지연 전이 쓰기·`activeKey` 유니크 첫 사용.

## 판단 기록 (judge)

## Developer 기록

- [22:40] 체크포인트 1(dev-041, 신규 소환) — **완료**: 서버 코어 1차 구현, 미러 `~/.node-local/thekaiwa-041` 에서 `tsc --noEmit` 오류 0.
  - 신규: `src/types/challenge.ts` · `src/modules/learning/challenges/{metrics,validate,store,view,settle,service,progress,topicProgress,index}.ts` · `src/app/api/v1/challenges/{route.ts,[id]/route.ts,[id]/end/route.ts,today/route.ts}`
  - 수정: `learning/lessons/today.ts`(#58 CHALLENGE) · `learning/studyLog/calendar.ts`(#70·#71 칸, `withChallengeCalendar` 순수) · `app/api/v1/lessons/[id]/complete/route.ts`(#62 `challenge`) · `src/types/{plan,lesson}.ts`(additive)
  - `topicProgress` 는 dev-042 의 `topics/pool.ts`(22:19 base) 로 구현(`loadTopicPool`·`topicAiWords`·`repetitionKeyOfCard` import 만, pool 무수정).
  - **남은 일**: 단위 테스트(확인 표 1~14·계약·동시성·소유자·null 목록·LLM 0) → eslint → `tests/live/challenge-*` 작성 → 문서 초안·QA 인계.
  - **다음 첫 행동**: `src/modules/learning/__tests__/challenge*.test.ts` 작성(메모리 가짜 DB — `ChallengeDeps` 주입).
  - **주의점**: 서버 DTO 는 `@/types/challenge` 를 그대로 쓴다(단일 출처). `learning/index.ts` 가 `export * from './lessons'`·`'./challenges'` 를 함께 하므로 이름 충돌 금지(접두 Challenge). 테스트 DI = 모든 공개 함수 마지막 인자 `Partial<ChallengeDeps>`.
  - **미커밋 파일**: 위 전부(커밋은 Leader).
- [22:50] 체크포인트 2(dev-041b, 신규 소환 — 이어받아 마무리) — **점검 결과**:
  - 미러 sync → `prisma generate` → `tsc --noEmit` **rc=0** · `challengeMetrics`·`challengeService` 단위 **37/37 PASS**(`env -u DATABASE_URL`).
  - 확인 표 1~14·두 세트 날·n=1..30·STOPPED→UPCOMING·closeAt·오늘 유예·소급·건너뛰기만·topicId=null(TOPIC_REMOVED 는 service 테스트)·계약(400·404·409·P2002·429)·동시성·소유자 404·§5-4 null 목록·LLM 0(AiJob·RequestTrace 행 0·Challenge 밖 쓰기 0)·삭제 후 불변·얼린 dailyGoal — **이미 덮임**. 빠진 것: `parseEndChallengeBody`(#159 모르는 키 400) 단위 테스트 1건.
  - `learning/index.ts` 이름 충돌(Reviewer L-1): TS 타입 검사기로 확인 — challenges 공개 27개 전부 `learning` 에서 challenges 선언으로 해석, 명시 export 에 가려진 것 0, lessons·evaluation·scenarios star export 와 겹침 0.
  - `tests/live/challenge-{smoke.sh,smoke.ts,cleanup.ts}` 는 있음, **TTFA 참고치 래퍼 없음**. 스모크 결함 2건 발견: (1) C3 `recentlyEnded` — A·B 에서 그만둔(endedAt=지금) 챌린지가 C 의 COMPLETED(endedAt=오늘 00:00)보다 나중이라 C3 이 늘 FAIL (2) A16 — 기준 #58 이 건 A11 잡이 구간 중에 끝나며 Trace 를 쓰면 거짓 FAIL. 정리 도구는 QA 계정 확인을 `QA_USER_WHERE` 로 바꿀 것.
  - **남은 일**: 위 테스트 1건 · 스모크 2건 수정 · 정리 도구 · `tests/live/challenge-ttfa.{sh,ts}` 작성(실행 금지) · eslint · learning+conversation 단위 전체 · 최종 기록.
  - **미커밋 파일**: 체크포인트 1 목록 그대로 + `tests/live/challenge-{smoke.sh,smoke.ts,cleanup.ts}`.
- [22:55] **Leader 추가 지시 23:20**(#71 `plan/day` `challenge.words.need`) 반영 — `src/types/challenge.ts` `DayChallenge.words` 에 `need` 한 칸(`src/types/plan.ts` `DayResponse.challenge` 는 같은 타입을 써서 자동 반영) · `challenges/progress.ts` `dayChallengeOf` 가 `ViewDay.words.need`(= 얼린 `dailyGoal.wordsMinAnswered`, 끝난 챌린지는 얼린 `dailyGoal` 로 `fromResult` 가 같은 값) 를 채움 · `studyLog/calendar.ts` `getDay` 는 `c.words` 를 그대로 넘겨 코드 변경 없음(#70 `withChallengeCalendar` 는 `{challengeId, dayIndex, state}` 만이라 무관). **타입은 `need: number | null`** — 지시문은 `number` 였지만 단어 과제를 끈 챌린지(`wordsMinAnswered=null`)에서도 주제 세트를 풀면 `words` 가 실리므로 `ok` 와 같이 null 로 둔다(그 밖은 늘 숫자). 다른 새 칸 없음. 테스트: 5·10·15 → 4·8·12(진행 중·그만둔 뒤 같은 값)·단어 과제 끔 → null.
- [22:55] **완료(dev-041b)** — status DONE, risk MEDIUM.
  - **변경 파일**(전부 미커밋 — 커밋은 Leader pathspec):

| 구분 | 파일 |
|---|---|
| 신규 L3 | `src/modules/learning/challenges/{index,metrics,validate,store,view,settle,service,progress,topicProgress}.ts` |
| 신규 API | `src/app/api/v1/challenges/route.ts`(#155·#156) · `[id]/route.ts`(#157) · `[id]/end/route.ts`(#159) · `today/route.ts`(#158) |
| 신규 타입 | `src/types/challenge.ts`(서버·화면 DTO 단일 출처) |
| 수정(additive) | `learning/lessons/today.ts`(#58 `CHALLENGE`) · `learning/studyLog/calendar.ts`(#70·#71) · `app/api/v1/lessons/[id]/complete/route.ts`(#62 `challenge`, `kind=NEW` 일 때만 커밋 뒤 읽기) · `src/types/{plan,lesson}.ts` |
| 무변경 확인 | `app/api/v1/plan/{calendar,day}/route.ts`·`app/api/v1/lessons/today/route.ts`(pass-through — 모듈 반환값을 그대로 `ok()`) · `lessons/lifecycle.ts`(챌린지 import 0 — 단위 테스트로 단언) |
| 테스트 | `src/modules/learning/__tests__/{challengeFakeDb.ts,challengeMetrics.test.ts,challengeService.test.ts}` |
| 라이브 도구(작성만, **실행 안 함**) | `tests/live/challenge-{smoke.sh,smoke.ts,cleanup.ts,ttfa.sh,ttfa.ts}` |

  - **이번 점검에서 고친 것**: ① 스모크 C3 — A·B 에서 그만둔 챌린지(endedAt=지금)가 C 의 COMPLETED(endedAt=오늘 00:00)보다 나중이라 `recentlyEnded` 가 늘 그쪽을 가리켜 FAIL → C 앞에서 이 실행이 만든 끝난 행을 지우고, 계정 3 에 오늘 끝난 다른 챌린지가 있으면 경고 ② 스모크 A16 — 기준 #58 이 건 A11 잡이 구간 중에 끝나며 Trace 를 쓰면 거짓 FAIL → 앞뒤 모두 계정 잡이 끝난 뒤(≤150초) 센다 ③ 정리 도구 — QA 계정 판정을 앱과 같은 `QA_USER_WHERE`(infra/users) 로, infra prisma 재사용 ④ TTFA 참고치 래퍼 신규 ⑤ 단위 테스트 2건 추가(#159 본문 모르는 키 400 · #71 `words.need`). 코드(서버) 결함은 찾지 못했다.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-041`, `env -u DATABASE_URL`): `tsc --noEmit` **rc=0** · eslint(변경·신규 28개 파일 — challenges 9·챌린지 라우트 4·#62·#58·#70·#71 라우트 4·today·calendar·타입 3·테스트 3·라이브 3) **0건** · 챌린지 단위 **39/39** · **learning+conversation 단위 전체 43파일 777/777 PASS**(fail 0, 18.3s) · 보이지 않는 문자 스캔 0 · `challenges` 의 엔진명 0 · `../lessons|vocab|studyLog`·`@/modules/{conversation,engine,speech,admin}` import 0.
  - **확인 표 1~14 통과 여부**: 1 ✓ · 2 ✓ · 3 ✓(오늘 유예 — 분모 3, 0.5 아님) · 4 ✓(A) · 5 ✓ · 6 ✓(전이 직전 ACTIVE = COMPLETED, result 동일) · 7 ✓ · 8a·8b·8c ✓ · 8d ✓ · 9 ✓(첫째 거짓·둘째 참) · 10 ✓(셋 다 rate null) · 11a~11e ✓ · 12 ✓(ⓐⓑⓒ 띠·수치·연속 0→3·누적 3·3·21, `metBy` = 그 세트) · 13 ✓(✕·누적 2·2·15) · 14 ✓(✕✕✕오··· · 3·0·0, 전이 시 `TOPIC_REMOVED` 는 service 테스트) · 두 세트 날 ✓(20장·푼 8·맞힘 6·틀림 2·건너뜀 12 → ✓ 75%·세트 5) · `ceil(4n/5)` n=1..30 ✓. 표 4 의 옵션 B·표 3 의 B 값은 U8 = A 확정이라 "B 가 아님"만 단언.
  - **계약 단위 테스트 덮음**: #156 400(모르는 키·둘 다 끔·기간·장수·제목 41자·`WORD_COUNT_OVER_POOL{poolSize}`)·404(남의/없는 주제)·409 `ACTIVE_EXISTS{challengeId}`(순차·동시 — 잠금 직렬화)·**P2002 → 같은 409**(잠금을 우회한 동시 INSERT)·429(하루 20회, `retryAfterSec` = 다음 KST 자정) · #159 멱등·NOT_ACTIVE · `activeKey=null` 3경로(#159·COMPLETED·TOPIC_REMOVED) · 끝낸 뒤 새로 만들기 · 지연 전이 결정성(13일 vs 20일 전이 → result 동일) · 소유자 404(상세·그만두기·목록·오늘·#62) · §5-4 null 12경우(진행 중 없음·기간 밖·다른 주제·내 단어장·복습·붙여넣기·없는 스냅샷·마지막 날 자정 뒤·꺼진 과제·끝남·형태 이상·쿼리 오류) · `words{answered,need}`/LESSON null · `goalMetNow` 거의 동시 1번 · 시계 어긋남(createdAt > now) · 삭제 후 지표 불변(링크만 refExists=false) · #155 커서·필터·400 · #70·#71 겹침 규칙·기존 모양 불변 · **LLM 0**(모든 시나리오 `AiJob`·`RequestTrace` 행 0·`Challenge` 밖 쓰기 0, 엔진 import 0).
  - **`learning/index.ts` 이름 충돌(Reviewer L-1)**: TS 타입 검사기(`getExportsOfModule`)로 확인 — challenges 공개 27개 모두 `@/modules/learning` 에서 challenges 선언으로 해석 · 명시 export 에 가려진 것 0 · `./lessons`·`./evaluation`·`./scenarios` star export 와 같은 이름 0. (star 끼리 겹치면 tsc 가 TS2308 로 막지만 명시 export 와 겹치면 조용히 가려지므로 따로 확인했다.)
  - **QA 인계** — DB 는 22:17 적용 완료. 미러 3021 에서 `next dev -H 127.0.0.1 -p 3021`(dev 서버는 QA 가 띄움):
    1. `bash tests/live/challenge-smoke.sh 3021` — **LLM 없음**, 00:05~23:50 KST, QA 계정 3 단독(042·043·044 와 시간 나눔). A1~A16(동시 #156 하나 409·타인 404·#58 CHALLENGE·#70·#71·#159 멱등·끝낸 뒤 새로 만들기·**챌린지 경로 AiJob·Trace 증가 0**) · B1~B4(확인 표 12 소급·23:59/00:01 경계·**StudyLog·Lesson 삭제 전후 지표 동일**·그만둔 당일 result = 직전 상세) · C1~C4(마지막 날 자정 마감·지연 전이 endedAt=오늘 00:00·recentlyEnded) · D1 #157 p50/p95 참고치(20회)·D2 엔진명 0. 끝에 이 실행 행만 지운다.
    2. 남은 행 정리: `node --env-file=.env --import tsx tests/live/challenge-cleanup.ts [--dry-run]`(QA 계정 3 의 Challenge 전부 + 표식 `t041` 스냅샷·기록·수업) · (가) 반복용 `--review-decision-today`(오늘 끝난 REVIEW_DECISION 잡만). 둘 다 PRODUCTION 거부·`QA_USER_WHERE` 확인.
    3. **TTFA 참고치(LLM 직렬 슬롯 — 계획서 §6 "039 QA·A3 20회 → 041 TTFA" 순서)**: `bash tests/live/challenge-ttfa.sh 3021 30 both` — 챌린지 없음 → 진행 중 순서로 (가) #58+#158 직후 첫 턴 · (나) 주제 세트(`generate:false`, FLIP 5장, #53 다시 풀기 반복) 끝낸 직후 첫 턴, 각 30회 TTFA·턴 p50/p90 + A11 시작/겹침 수 + p50 차이. 00:10~21:30 KST 시작, 60~90분 [추측]. 텍스트 턴(STT 제외)·M4 TTS 사용. 끝에 이 실행의 챌린지·세트(+스냅샷·WORDS 기록)·턴 Trace·REVIEW_DECISION 잡·TALK 방 삭제(반복 항목 카운터는 되돌리지 않음 — QA 계정 3). **(나) 는 계정 3 이 A11 최소 기록 가드(공부한 날 2·항목 2)를 넘어야 의미가 있다** — 도구가 "A11 한 번도 안 걸림"을 출력하면 다른 날 공부 기록을 만든 뒤 다시(이 준비는 QA 몫 — 도구가 기록을 꾸며 넣지 않는다).
    4. 스모크가 못 덮는 라이브 항목(실제 수업 완료가 LLM A4 를 거쳐야 함 — QA 판단): #62 `challenge` 실값·거의 동시 수업+세트 끝내기의 `goalMetNow` 1번(단위 테스트로 덮음) · 계획표 `GENERATING` 죽은 잡 → FAILED 표시(단위 덮음) · `challengeProgressAfter` 실패 시 완료 그대로(단위 — 쿼리 오류 주입 시 null, 라우트는 catch 밖에 던지지 않음) · 기존 008·010·011·012 스모크 회귀.
  - **문서 초안(정본 갱신은 Leader 단독 — 아래는 구현 기준값)**:
    - `domain-model.md`: §1 소유 표 L3 `Challenge`(learning/challenges) · enum `ChallengeStatus {ACTIVE, COMPLETED, ENDED}` · §6 삭제 매트릭스 `Challenge` — 사용자 삭제 경로 없음 · 계정 삭제 Cascade · 주제 삭제 SetNull(진행 중이면 다음 조회 때 ENDED·`TOPIC_REMOVED`) · §9-3 JSON 모양: `dailyGoal = {lesson, words, wordCount: 5|10|15|null, wordsMinAnswered: ceil(4n/5)|null, countSkipped: false, ruleVersion: 1}`(만들 때 얼림) · `result = {ruleVersion, endReason: null|'USER'|'TOPIC_REMOVED', metDays, partialDays, missedDays, stoppedDays, elapsedDays, rate: 0~1|null, longestStreak, lessonsDone, wordSets, wordsCorrect, days: [{date, state, quiz: [맞힘,문항]|null, words: [맞힘,틀림,건너뜀,카드,세트]|null}]}`(끝날 때 1회, 불변) · `activeKey` = ACTIVE 일 때 userId·끝내는 모든 경로 null · `endedAt` = COMPLETED endDate+1 00:00 KST / ENDED 그만둔 시각.
    - `api-contract.md`: #155 `GET /api/v1/challenges?status=ACTIVE|FINISHED|ALL&limit≤50&cursor` → `{items: ChallengeSummary[], nextCursor}` · #156 `POST /api/v1/challenges` `{topicId, lengthDays: 7|14|30, start: 'TODAY'|'TOMORROW', dailyGoal: {lesson, words, wordCount?}, title?≤40}` → `ChallengeDetail` · 400 `unknown_key`/`NO_TASK`/`WORD_COUNT_OVER_POOL{poolSize}` · 404 주제 · 409 `ACTIVE_EXISTS{challengeId}` · 429 `{retryAfterSec}`(하루 20) · #157 `GET /api/v1/challenges/:id` → `ChallengeDetail`(`days[]`·`topicProgress`·`totals`·`today`·`result`) · #158 `GET /api/v1/challenges/today` → `{challenge, today, recentlyEnded}` · #159 `POST /api/v1/challenges/:id/end` `{}` → `ChallengeSummary`(멱등, COMPLETED 면 409 `NOT_ACTIVE`) · 전부 소유자 404·`Cache-Control: private, no-store`(GET)·LLM 0 · #58 `recommendation.reason += 'CHALLENGE'` · #62 응답 `challenge: ChallengeProgress|null` · #70 `days[].challenge?: {challengeId, dayIndex, state}`·`summary.challenge?: {id, metDays, elapsedDays, streak}` · #71 `challenge?: {challengeId, title, dayIndex, state, lesson: {quizCorrect, quizTotal}|null, words: {correct, wrong, skipped, cardCount, ok, need}|null}` · §0-4 소유자 검사 목록에 `Challenge` · §2-13 잠금 순서 변경 없음(#156·#159·지연 전이 = 사용자 행 잠금 → `Challenge` 만) · `#160` 예약 해제(U5 = C3+).
  - **남은 위험**: ① [가능성 높음] #158·#157 의 `findActiveJob` 은 오래된 `AiJob` 행을 FAILED 로 닫는다(infra 기존 동작, 설계 §6-1 이 허용) — 행 수는 늘지 않지만 "챌린지 경로 쓰기는 `Challenge` 만"의 예외 ② [추측] 달력 #70 은 그 달에 걸친 챌린지 최대 20개만 본다(하루 20회 생성 상한과 같은 크기 — 실사용에서 넘을 일은 드묾) ③ 지연 전이는 GET 안의 쓰기라 동시 GET 두 개가 같은 행을 전이하려 해도 사용자 행 잠금 + `status='ACTIVE'` 조건부 UPDATE 로 1번만 — 실제 DB 경합은 단위 테스트(메모리 DB)로만 확인, 라이브는 QA A4 의 동시 #156 이 대표 ④ TTFA (나) 는 계정 3 의 A11 가드 이력에 달려 있어 QA 준비가 필요 ⑤ T6(챌린지 × 시나리오)는 범위 밖·파일 없음.
  - **소유 밖 필요 변경**: 없음(042 의 #51 라우트가 이미 `challengeProgressAfter` 를 조합해 쓴다 — 계약 그대로).

### dev-041c (REV-120)

- [23:30] **완료(dev-041c, 신규 소환)** — status DONE, risk LOW. REV-120 의 M-1·L-1~L-5 처리. 제품 동작이 바뀐 곳은 L-1 방어 1곳(끝난 챌린지 행 건너뛰기)뿐이고, L-4 는 주입점만 냈다(동작 불변). 스모크·정리·TTFA 도구는 **실행하지 않았다**(라이브·DB 금지).
  - **변경 파일**(전부 미커밋):

| 파일 | 지적 | 내용 |
|---|---|---|
| `tests/live/challenge-smoke.ts` | M-1·L-3 | D 구간 재작성 — **D1a 진행 중**(D 에서 새로 심은 ACTIVE, 시작일 = B 와 같은 오늘−3 → B·C 스냅샷이 기간 안이라 실제 계산 경로) · **D1b 끝난**(C 에서 COMPLETED 로 전이된 `cId`, `result` 있음 → 링크 재계산 경로) 각각 20회. 20회 모두 200·기대 상태(ACTIVE/COMPLETED)일 때만 p50/p95(nearest-rank) 출력, 하나라도 어긋나면 **FAIL·"참고치 무효"**. 가드: `APP_ENV=PRODUCTION` 거부 · BASE localhost + **3010 거부** · 빈 쿠키 거부 · 두 계정 모두 `findFirst({AND:[{email}, QA_USER_WHERE]})` 확인 · infra `prisma` 재사용 · 확인 전에 멈추면 정리도 건너뜀(만든 행 0) |
| `tests/live/challenge-smoke.sh` | L-3 | `set -eu` · 포트 3010 거부 · 쿠키 파일이 비면 중단 |
| `tests/live/challenge-ttfa.{sh,ts}` | L-3·L-5 | 스모크와 같은 가드로 맞춤(`set -eu`·3010 거부·빈 쿠키 — 이전엔 `set -u` 만, 3010 허용이었다) + 머리말에 REVIEW_DECISION 삭제 범위(계정 3 전체)·동시 실행 금지 |
| `tests/live/challenge-cleanup.ts` | L-5 | 머리말 — 기본 실행은 **계정 3 의 `Challenge` 전부**, `--review-decision-today` 는 **계정 3 의 오늘 끝난 REVIEW_DECISION 잡 전부** · 다른 레인(042·043·044 QA·challenge-smoke·ttfa)과 동시 실행 금지 · `--dry-run` 먼저 (코드 변경 없음) |
| `src/modules/learning/challenges/service.ts` | L-2·L-1 | 머리 주석 정정(새 행 0·수업/세트/스냅샷 무수정, 예외 = `findActiveJob` 의 stale 잡 `FAILED('stale')`, 잡 행 수 불변, 레슨은 GENERATING 그대로·응답만 FAILED) · `finishedViewOrSkip` — #155 끝난 쪽·#158 `recentlyEnded` 에서 `ChallengeDataError` 만 잡아 그 행을 빼고 `console.error` 한 줄(`row.id` 만). 다른 예외·진행 중 행은 그대로 던진다 |
| `src/modules/learning/lessons/today.ts` | L-4 | `recommend` → `recommendTodayLesson(userId, level, over?: Partial<TodayRecommendDeps>)`(export) + `recommendByHistory`(기존 본문 그대로 이동) · 주입점 = `db`(lesson 조회)·`challenge`(`getActiveChallengeTopic` 의존성)·`byHistory`. 기본값 = 실제 DB·기존 규칙이라 라우트 동작 동일. `lessons/index.ts` 는 명시 export 라 **공개 API 무변경** · `../challenges` import 줄 1개 유지(층 테스트 통과) |
| `src/modules/learning/__tests__/challengeRecommend.test.ts`(신규) | L-4 | 4건 — ① 진행 중·오늘 챌린지 수업 미완료 → `CHALLENGE`·그 주제·그 주제 수준(학습자 N4 여도 N5)·기존 추천 0회·마지막 **새** 수업(복습·다른 주제·남의 것·READY 제외)의 `nextPreview`, 수업 전이면 null ② 오늘 그 주제 새 수업 스냅샷 뒤 → 기존 추천 결과를 **같은 참조로** 반환·마지막 수업 조회 0 · 수업 과제 끈 챌린지도 기존 추천 ③ 챌린지 없음·내일 시작·그만둔 챌린지 → 기존 추천 그대로(수준 그대로 넘김)·null 이면 null ④ 챌린지 쿼리 오류 → 기존 추천·로그는 `['[today] 챌린지 추천 계산 실패:', 오류 이름]` 만(메시지 없음) · 매 호출 쓰기 0·AiJob·RequestTrace 행 0 |
| `src/modules/learning/__tests__/challengeService.test.ts` | L-1 | 1건 — 끝난 3행 중 2행 `dailyGoal` 깨짐 → #155 전체 = 성한 1행·쪽 나눔(`limit=2` 첫 쪽 빈 items + 커서 → 다음 쪽 성한 행) · #158 `recentlyEnded` null(500 아님) · 로그 2줄 이상 전부 깨진 행 id · 그 뒤 새로 만들기·#158 진행 중 정상 · Challenge 밖 쓰기 0 |

  - **실행 증빙**(미러 `~/.node-local/thekaiwa-041`, sync → `prisma generate`, **`DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"` 덮어쓰기**):
    - 기준선(수정 전, 같은 방식): 챌린지 2파일 **39/39** · learning+conversation 43파일 **777/777** — 숫자는 `env -u` 때와 같다. 이 방식에서 DB 접촉 시도 **35건 전부 연결 거부**(`requestTrace.create` 34 · `chatMessage.updateMany` 1, 전부 기존 conversation 테스트) · 로그에 실제 DB 호스트 문자열 0.
    - 수정 후: 챌린지 3파일 **44/44**(39 + L-4 4 + L-1 1) · learning+conversation 44파일 **782/782**(fail 0, 16.1s) · DB 접촉 시도 35건 **기준선과 동일**(새 테스트 0건) · `tsc --noEmit` **rc=0**(tsconfig 가 `**/*.ts` 라 `tests/live` 포함) · eslint(변경 7파일 — 스모크·정리·TTFA·service·today·테스트 2) **0건** · `bash -n` 두 `.sh` OK · 보이지 않는 문자 스캔 0 · service·today 엔진명·`requestTrace|createJob|completeJson` 0.
    - 변이 확인(미러에서만 바꾸고 원복을 `cmp` 로 확인): L-1 의 `ChallengeDataError` 판정을 지우면 L-1 테스트 FAIL · `!challenge.lessonDoneToday` 조건을 지우면 L-4 ② FAIL → 새 테스트가 실제로 잡는다.
  - **테스트 실행 규칙 관찰(Leader 공유)**: `env -u DATABASE_URL` 은 미러 `.env` 를 다시 읽어, 기존 conversation 테스트의 `requestTrace.create`(FK 로 거부됨 — REV-120) 말고도 **`chatMessage.updateMany` 1건(쓰기 시도)** 이 실제 DB 에 닿는다 [확인 — 이번 무효 URL 로그의 `orchestrator/index.ts:654 patchToolLog`]. 실제 행이 바뀌었는지는 모른다 [추측: 가짜 id 라 0행]. 무효 URL 덮어쓰기를 전체 실행의 기본으로 둘 것.
  - **L-1 처리 범위와 Leader 판단 필요**: 한 것 = **끝난 행만** 건너뛰기(표시 전용 이력이라 빼도 상태가 바뀌지 않음 — 지시문이 준 "목록에서 제외 + 로그 한 줄" 그대로). 하지 않은 것(복구 정책이 필요해 Leader 판단): ① **진행 중 행**의 `dailyGoal` 이 깨지면 #155·#157·#158 이 500 이고, 숨기면 "챌린지 없음"으로 보이는데 #156 은 409 `ACTIVE_EXISTS` 라 사용자가 갇힌다 — 자동 종료(결과 없이 ENDED)·기본값으로 표시·관리 도구 중 무엇으로 풀지 결정 필요. #159 는 전이(`finishChallengeTx` 가 결과 없이 ENDED)는 커밋되지만 응답 조합에서 500 ② 끝난 행의 #157 상세도 500 그대로(응답의 `dailyGoal` 칸에 무엇을 보일지 결정 필요) ③ 깨진 행만 있는 쪽은 `items: []` + `nextCursor` 가 나올 수 있다 — T3·T4 목록 화면은 **items 가 비어도 커서가 있으면 이어 읽어야** 한다(인계).
  - **QA 인계 변경**:
    1. 스모크 D: 출력이 `INFO D1a #157 진행 중 p50 …·p95 …` · `INFO D1b #157 끝난(COMPLETED) p50 …·p95 …` 두 줄. 체크가 **D1a·D1b 2개 늘어** 결과 분모가 +2(합격 판정 = 20회 모두 200·상태 일치, 지연 값은 참고치). 어긋나면 그 줄에 "참고치 무효"와 상태 코드 목록이 찍힌다 → 완료 기준 3 의 p95 는 두 INFO 줄에서 옮겨 적는다(QA high_risk 3).
    2. 가드: `APP_ENV=PRODUCTION`·포트 3010·빈 쿠키·QA 계정 규칙 불일치면 **시작 전 중단**(행 0). `.sh` 는 `set -eu` 라 동기화·QA 세션 실패 시 바로 멈춘다(TTFA 도 같음).
    3. 정리·TTFA 는 **계정 3 전체 범위** — 042·043·044 QA·스모크와 동시에 돌리지 않는다(머리말 명시, L-5). 정리는 `--dry-run` 먼저.
    4. #58 CHALLENGE 분기는 단위로 덮였지만 라이브 A10(실제 DB)은 그대로 실행.
  - **남은 위험**: ① [가능성 높음] 진행 중 행 `dailyGoal` 깨짐의 복구 경로 없음(위 Leader 판단) ② [추측] 010d-A3 가 `today.ts` 를 이어 고칠 때 `recommend` 가 `recommendTodayLesson`·`recommendByHistory` 로 나뉜 것을 알아야 한다(같은 NFS 트리 — 덮어쓰기 주의) ③ 스모크 D1a·D1b 실제 출력은 QA 첫 실행에서만 확인된다 ④ `recommendByHistory`(기존 추천 본문)는 DB 를 읽어 단위 테스트에서 가짜로 바꿨다 — 그 본문 회귀는 010 라이브 스모크 몫.
  - **Reviewer 재확인 범위**: 제품 코드 diff 가 생겼다(`service.ts` L-1·L-2, `today.ts` L-4 주입점) — `tests/live/challenge-*` 와 함께 이 두 파일·테스트 2파일을 본다.
  - **미커밋 파일(이번 변경)**: `tests/live/challenge-{smoke.ts,smoke.sh,cleanup.ts,ttfa.ts,ttfa.sh}` · `src/modules/learning/challenges/service.ts` · `src/modules/learning/lessons/today.ts` · `src/modules/learning/__tests__/{challengeRecommend.test.ts(신규),challengeService.test.ts}` — 그 밖 dev-041b 목록 그대로. 커밋은 Leader pathspec.

### dev-041d (REV-124)

- [23:44] **완료(dev-041d, 신규 소환)** — status DONE, risk LOW. REV-124 권고안 A 그대로: 끝내는 시각을 사용자 행 잠금을 얻은 **뒤** 트랜잭션 안에서 잡는다. 응답 모양·API·`finishChallengeTx`·`settleExpiredTx` 시그니처·`metrics.ts` 불변. 라이브·DB·커밋 0.
  - **변경 파일**(전부 미커밋, NFS ↔ 미러 `cmp` 동일):

| 파일 | 내용 |
|---|---|
| `src/modules/learning/challenges/service.ts` | `endChallenge` — 잠금 전 `now`·`today` 제거, `lockUser` 다음 줄 `const lockedAt = deps.now()` → `settleExpiredTx(tx, userId, todayKst(lockedAt), lockedAt)`·`endedAt: lockedAt`·`finishChallengeTx(..., lockedAt)` · `createChallenge` — 트랜잭션 안 `settleExpiredTx` 호출만 `lockedAt` 으로(TOPIC_REMOVED 의 `endedAt`). `startDate`·`endDate`·하루 20회 세기·429 `retryAfterSec` 는 지시대로 요청 도착 시각 그대로 |
| `src/modules/learning/challenges/settle.ts` | `settleExpired` — 사전 점검(`due`)은 잠금 전 시각 그대로, 전이의 `today`·`now` 는 잠금 뒤 `lockedAt` · 머리 주석 정정(그만두기 `endedAt` = 잠금을 얻은 시각, 두 실행 시각 경로는 반드시 잠금 뒤) |
| `src/modules/learning/challenges/progress.ts` | 39줄 주석 정정 — "DB 서버 시계" → 스냅샷 `createdAt` 은 Prisma 엔진이 싣는 앱 호스트 시각(같은 시계), 보정은 같은 ms·시계 되돌림 방어(코드 무변경) |
| `src/modules/learning/__tests__/challengeService.test.ts` | 테스트 7건 추가(T-1 두 건 · T-2~T-6) + `snap()` 이 `Date` 도 받게(ms 단위 재현) + 기존 skew 테스트 주석의 "DB 시계" 표현 정정 |

  - **테스트 T-1~T-6**(가짜 DB 의 사용자 잠금 직렬화로 순서를 재현 — 헬퍼 `whileCompletionHoldsLock`: T1 이 잠금을 쥔 채 도착+50ms 에 스냅샷·+80ms 커밋, T2 는 도착 시각에 잠금 대기. 로그로 "T2 가 T1 스냅샷보다 먼저 잠금을 요청했다"까지 단언):
    - **T-1** 그만두기: `endedAt` = 도착+80ms(잠금 획득) > 스냅샷 +50ms → `result.lessonsDone 1`·`metDays 1`·day1 `MET` ✓ · **T-1(TOPIC_REMOVED)** `#158 settleExpired`·`#156 settleExpiredTx` 두 경로 모두 `endedAt` = 잠금 뒤 시각 ✓(주제가 끊긴 챌린지는 원래 아무것도 세지 않으므로 단언은 시각 순서)
    - **T-2** 반대 순서(그만두기가 잠금을 먼저 얻음) → 그 뒤 완료(+30ms)는 제외 `lessonsDone 0`·`STOPPED`, 이틀 뒤 재조회도 `result`·날 상태 동일, 행의 `result` 불변 ✓
    - **T-3** `createdAt = endedAt − 1ms` 포함(MET) · `= endedAt` 제외(STOPPED) ✓
    - **T-4** 앱 시계 −5s·−10ms·0·+10ms·+5s 이동 → 잠금 대기 중 완료 포함·그만둔 뒤 완료 제외, `endedAt − 도착 = 80ms`, 다섯 `result` 전부 동일 ✓
    - **T-5**(정적, 전제 고정) `schema.prisma` StatsSnapshot `createdAt @default(now())`(dbgenerated 아님) · `createLessonSnapshot`·`createVocabSessionSnapshot` 은 `statsSnapshot.create({ data: {` 이고 `createdAt`·raw SQL 없음 · `snapshots/index.ts` 에서 DAILY raw INSERT 를 빼면 `createdAt`·`NOW(` 0 · `src/**`(테스트 제외) 전체에서 StatsSnapshot raw INSERT 는 `'DAILY'` 만·`UPDATE StatsSnapshot SET … createdAt` 0·`statsSnapshot.create|createMany|upsert` 는 `snapshots/index.ts` 에만 ✓. 주석에 "MySQL 8.0.46·Prisma 6.19.3 REV-124 실측" 남김
    - **T-6** 완료 커밋 뒤 그만두기가 먼저 끝남 → `challengeProgressAfter` null, 그 완료는 `result` 에 포함(`lessonsDone 1`·MET) ✓
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-041`, `KAIWA_LOCAL_ROOT=… sync-local.sh` → `prisma generate`, **`DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`**):
    - 수정 전 기준선: 챌린지 3파일 **44/44**. 새 테스트를 수정 전 코드로 돌리면 **27건 중 24 PASS·3 FAIL**(T-1 두 건·T-4 — `endedAt` 00:30:00.000Z, 기대 .080Z) = 재현 확인
    - 수정 후: 챌린지 3파일 **51/51**(44 + 7) · learning 전체 17파일 **240/240** · learning+conversation 44파일 **790/790**(fail 0, 15.9s) · `tsc --noEmit` **rc=0·출력 0줄**(이번 sync 로 미러에 다른 WP 의 NFS 최신본도 들어갔고 그 상태에서 0) · eslint(변경 4파일) **0건** · 보이지 않는 문자 스캔 0
    - DB 접촉: 챌린지 테스트 **0건** · learning+conversation 실행의 시도 35건(`requestTrace.create` 34·`chatMessage.updateMany` 1 — 기존 conversation 테스트, dev-041c 기준선과 같은 수)은 전부 무효 URL 로 연결 거부
  - **변이 확인**(미러에서만 옛 동작으로 되돌린 뒤 원복, 매번 NFS 와 `cmp` OK): ① `endChallenge` 만 잠금 전 시각 → **T-1·T-4 FAIL** ② `createChallenge` 안 전이만 요청 시각 → **T-1(TOPIC_REMOVED, #156 경로) FAIL** ③ `settleExpired` 만 잠금 전 시각 → **T-1(TOPIC_REMOVED, #158 경로) FAIL** ④ `createLessonSnapshot` 에 `createdAt: new Date()` 주입 → **T-5 FAIL**. 세 수정 지점이 각각 다른 테스트에 잡힌다.
  - **QA 인계**(REV-124 §5 — 기존 `high_risk_areas` 1번에 추가, QA 계정 3 직렬, 미러 3021):
    1. **병렬 쌍 N회**: `POST /api/v1/challenges/:id/end` 와 세트 끝내기(#51, LLM 없음 — 주제 세트)를 거의 동시에(`&` 두 개 또는 `Promise.all`) 반복. 매 회차 새 챌린지(단어 과제 켬)를 만들고, 끝난 뒤 **읽기 전용 비교**: `result.wordSets`(= 센 세트 수) == 그 챌린지 기간의 `StatsSnapshot(kind=VOCAB_SESSION, data.topicId=그 주제)` 중 `createdAt < endedAt` 인 수. 수정 뒤 불일치 0 이어야 한다. 수업 완료(#62)는 LLM A4 를 거치므로 시간이 되면 같은 방식으로 `result.lessonsDone` 과 LESSON(NEW) 스냅샷 수 비교. 회차마다 남은 행은 `challenge-cleanup.ts --dry-run` 후 정리.
    2. 기존 A4(동시 #156)·스모크 B·C·D 시리즈는 변경 없이 통과해야 한다(제품 응답 모양 불변).
    3. (선택, 읽기 전용) 오늘 만든 LESSON·VOCAB_SESSION 스냅샷 `createdAt` 과 같은 완료의 `StudyLog.createdAt`·`Lesson.completedAt`(앱 시각)이 수십 ms 안 같은 쪽인지 — MariaDB 에서도 `createdAt` 이 앱 시계라는 전제(T-5)의 간접 확인.
  - **남은 위험**: ① [가능성 높음] NAS MariaDB 에서도 `createdAt` 이 엔진(앱) 시각이라는 전제 — MySQL 8.0.46 실측과 "값을 문장 전에 엔진이 정한다"는 추론, MariaDB 직접 확인은 QA 3번 몫. T-5 는 코드 쪽 전제(기본값 `now()`·raw INSERT 없음)만 고정한다 ② [추측] 실제 MariaDB 경합에서 잠금 뒤 SELECT 가 먼저 커밋된 완료를 보는 것은 READ COMMITTED + `FOR UPDATE` 뒤 읽기에 기대며(REV-124 가 `infra/tx.ts` 머리 주석으로 확인), 가짜 DB 로는 격리 수준을 재현하지 못한다 — QA 1번이 유일한 실측 ③ `createChallenge` 의 시작일·하루 횟수가 잠금 전 시각이라 잠금 대기가 자정을 넘는 극단의 틈은 그대로(REV-124 §8 INFO, 지시 범위 밖) ④ Codex ①(완료 응답 `challenge` null)은 설계 §5-4 허용 — 코드 변경 없음, T-6 으로 계약만 고정.
  - **Reviewer 재확인 범위**: 위 4파일 diff 만(제품 동작 변화 = `endedAt`·전이 `today` 를 잡는 시점 하나).
  - **미커밋 파일(이번 변경)**: `src/modules/learning/challenges/{service,settle,progress}.ts` · `src/modules/learning/__tests__/challengeService.test.ts` — 그 밖 dev-041b·041c 목록 그대로. 커밋은 Leader pathspec.

## Reviewer 기록 (REV-120, 2026-10-06 23:15, standard 트랙 · Read 전용 — 코드·스키마·문서 수정 0, 이 절만 기록)

- **판정: PASS_WITH_NOTES** — Critical 0 · High 0 · **Medium 1** · Low 5 · Info 4. 기준 `5c3a701` 미커밋 작업 트리. 제품 코드(지표·전이·만들기·라우트·응답)는 결함을 찾지 못했다. Medium 1건은 **라이브 스모크 도구**의 결함이라 QA 시작 전에 고쳐야 한다(Developer 가 `tests/live` 만 수정 → Reviewer 가 그 파일만 재확인, 제품 코드 재순환은 불필요 — 제품 코드에 변경이 없으므로).
- 검토한 7영역: ① 아키텍처(6층·순환·`learning/index.ts`·응답 봉투) ② 유지보수성 ③ 안정성(전이·잠금·결정성) ④ 운영성(로그·Secret) ⑤ 성능(쿼리 수·N+1) ⑥ 보안(소유자·입력·경로) ⑦ 학습 원칙(제안→채택·스냅샷 불변·완료 트랜잭션). 이 task 는 LLM 프롬프트·네이티브·설정 허브 변경이 없어 해당 항목은 "해당 없음"(`native_change:false`).

### 1. 독립 구현 대조 — 지표(핵심) **[확인] 전부 일치**
- 설계서 §6-0·§6-4 의사코드를 **처음부터 따로** 구현했다(`indep.mjs` — 코드의 `metrics.ts`·infra `dates` 를 쓰지 않고 KST 날짜 계산·스냅샷 순서·`goalMetNow` 를 prefix 재판정으로 직접 작성). 같은 입력으로 `computeChallengeMetrics` 와 비교:
  - **확인 표 27케이스**(1·2·4·5(아침/밤)·6(전이 직전 ACTIVE/COMPLETED)·7(COMPLETED/ACTIVE)·8a·8b·8c·8d·10(셋)·11a~11e·12ⓐⓑⓒ·13·14·두 세트 날) — 설계서 기대 띠·`지난 날·달성·달성률`·`연속·최장`·누적을 **독립 구현·코드 둘 다** 기대값과 비교: **27/27 일치**(표 3 은 U8=A 확정이라 "분모 3"만 확인 — 표 1 에 포함). 표 9(`goalMetNow` 첫째 거짓·둘째 참)는 아래 퍼징의 `goalMetNow` 전수 비교로 덮음.
  - **무작위 대조 7만 건**(시드 1·2·3·4·77, 챌린지 기간 7·14·30 · ACTIVE/COMPLETED/ENDED · 시작 전·마지막 날 뒤·그만둔 날 · 과제 켜짐 조합 · `topicId=null` · 다른 주제·REVIEW·같은 시각 동점 스냅샷 · 스냅샷 약 140만 개): **불일치 0**. 비교 항목 = 날짜별 상태·`elapsed/metDays/partial/missed/stopped`·`rate`·`streak`·`longest`·누적 3값·`closeAt`·`dayIndex`·`todayMet`·날짜별 세트 수/답한 장수/수업 수·**그날을 달성으로 바꾼 스냅샷(`metBy` = 독립 prefix 판정)**. 검출력 확인: 독립 구현의 STOPPED 규칙을 일부러 빼면 3,000건 중 2,977건이 어긋남(퍼저가 실제로 잡는다).
  - 경계: `kstDayStart('2026-10-03')` = `2026-10-02T15:00:00.000Z` · 시작일 00:00:00.000 정각 스냅샷 포함/1ms 전 제외 · `closeAt`(마지막 날 다음 00:00) 정각 제외/1ms 전 포함 · `ceil(4n/5)` n=1..30(코드 테스트 전수).
  - 서비스 수준 재현(가짜 DB, `svc.ts`): 기간 지난 ACTIVE 가 있어도 **#156 이 먼저 전이 후 새로 만들기 성공**(옛 행 COMPLETED·`activeKey` null·`endedAt`=마지막 날 다음 00:00 KST) · 기간 지난 ACTIVE 에 #159 → 409 `NOT_ACTIVE` · **동시 GET #158 두 개 → 전이 쓰기 1회** · **동시 #159×2 + #158 → 전이 쓰기 1회·전부 성공** · 그만둔 뒤 공부는 세지 않고 며칠 뒤 상세 = 그만둔 당일 결과.

### 2. 재실행 숫자 (미러 `~/.node-local/thekaiwa-041`, 미러는 NFS 와 task-041 소유 파일 전부 바이트 동일 — 042 쪽 4개 파일만 NFS 가 더 새롭다)
| 항목 | 결과 |
|---|---|
| 챌린지 단위(`challengeMetrics`+`challengeService`) | **39/39 PASS**(기대 39) |
| learning+conversation 단위 전체 | **43파일 777/777 PASS**, fail 0(기대 777) |
| `tsc --noEmit` | **rc=0** |
| eslint(변경·신규 파일 — challenges·라우트·타입·today·calendar·테스트·라이브 도구) | **0건**(rc=0) |
| 보이지 않는 문자·제어문자 스캔(`grep -nP`, U+200B~200F·202A~202E·2060~2064·2066~2069·FEFF·00AD·C0 제어) | **0건** |
| 엔진명·모델명·`llm|completeJson|createJob|requestTrace|speaker` grep(challenges·라우트·타입) | **0건**(주석 문구 제외) |
| import 순환(값 import 전체 그래프, 타입 import 제외) | **순환 0** |
- **주의(재현 방법)**: 위 777 실행 중 `engine/trace` 의 `requestTrace.create` 가 **FK 위반(`userId`)으로 14번 거부**되는 로그가 찍힌다 — 기존 conversation 테스트가 가짜 userId 로 실제 `recordTrace` 를 부른다. 미러에 `.env` 가 있어 Prisma 가 `DATABASE_URL` 을 다시 읽으므로 **`env -u DATABASE_URL` 은 DB 접촉을 막지 못한다**(FK 가 막아 행은 안 생겼다 [확인 — 로그의 14건이 전부 FK 거부], 그 밖의 기존 테스트가 쓴 것은 확인하지 못함 [추측: 없음]). 이 task 가 만든 문제는 아니다. 다음 검토부터는 `DATABASE_URL=mysql://none` 처럼 **무효 값으로 덮어** 돌리는 것을 권한다(Leader 규칙 보완 제안).

### 3. 지적 표
| # | 심각도 | 위치 | 내용 · 근거 | 고칠 방법 |
|---|---|---|---|---|
| M-1 | **MEDIUM** | `tests/live/challenge-smoke.ts:217`·`:236` | **D1(#157 p50/p95 참고치)이 이미 지워진 챌린지를 20번 부른다.** dev 가 C3 을 고치며 넣은 217행 `challenge.deleteMany({id in created, status in [COMPLETED, ENDED]})` 가 B4 에서 그만둔 `bId`(ENDED, `seedChallenge` 가 `created` 에 넣음)를 지우는데, D1 루프(236)는 그 `bId` 로 `GET /api/v1/challenges/${bId}` 를 부른다 → `findOwned` 404(가장 빠른 경로) 20번의 지연이 "#157 p50/p95"로 출력된다. 실패 신호 없이 **QA 완료 기준 3 의 p95 기록이 오염**된다 [확인 — 코드 흐름: 189~212 `bId` 생성·종료 → 217 삭제 → 236 사용]. | D 구간을 217행 앞으로 옮기거나(ACTIVE 일 때 측정), 새 ACTIVE 챌린지를 하나 만들어 그 id 로 재고, 끝난 챌린지(`cId`, result 있음) p95 도 따로 재서 두 값을 모두 기록. D1 에 `status===200` 아니면 FAIL 처리 추가. |
| L-1 | LOW | `store.ts:73-78`·`view.ts:80`·`service.ts:244·265·282` | `dailyGoal` 형태가 어긋난 행이 하나라도 있으면 `toMetricChallenge` 가 `ChallengeDataError` 를 던져 **#155 목록·#158(진행 중·`recentlyEnded`)·#159 응답(전이는 이미 커밋됨)이 500** 이 된다. 끝난 행도 `view.ts:80` 에서 먼저 파싱해 `result` 만으로는 못 읽는다. 사용자 삭제 경로가 없어 복구 방법이 없다. 서버만 쓰는 값이라 확률은 낮다(수동 DB 수정·미래 `ruleVersion` 2 에서 옛 행 `readDailyGoal` 엄격화). | 목록·`recentlyEnded` 에서 행 단위로 잡아 건너뛰거나(로그만), 끝난 행은 `dailyGoal` 파싱 실패여도 `result` 로 읽게 `toMetricChallenge` 를 느슨하게. 이번 범위에서는 문서에 한계로 남겨도 됨. |
| L-2 | LOW | `service.ts:3` ↔ `:201`(`jobs.findActiveJob`) · `infra/jobs.ts:109-110` | 머리 주석이 "잡 행을 만들거나 **고치지** 않는다"인데 `findActiveJob` 은 오래된 QUEUED/RUNNING 행을 `FAILED('stale')` 로 닫는다. 설계서 §6-1 이 허용한 동작이라 **위반은 아니다**(아래 §5 판정). 단위 테스트 `foreignWrites` 도 stale 행이 없는 가짜 DB 라 이 쓰기를 못 본다. | 주석을 "새 행을 만들지 않고, 죽은 생성 잡 행을 FAILED 로 닫는 infra 기존 동작만 탄다"로 정정. |
| L-3 | LOW | `tests/live/challenge-smoke.ts:120-128`·`challenge-smoke.sh:6-16` | 스모크가 **PRODUCTION 거부·`QA_USER_WHERE` 확인이 없다**(정리·TTFA 도구에는 있음). 계정을 `findUniqueOrThrow({email})` 로만 찾고 `challenge`·`statsSnapshot`·`lesson`·`studyLog` 를 직접 쓴다. `.sh` 에 `set -e` 도 없어 `qa-session.ts` 가 거부해도(쿠키 없음) 스모크가 이어 달린다. BASE 가 localhost 면 포트 3010(운영)도 허용된다. 개발·운영이 같은 DB 라 포트와 무관하게 같은 행에 쓴다. | `main()` 맨 앞에 `APP_ENV=PRODUCTION` 거부 + `AND:[{email},QA_USER_WHERE]` 확인 + 포트 3010 거부, `.sh` 에 `set -e`·쿠키 파일 비어 있으면 중단. |
| L-4 | LOW | `src/modules/learning/lessons/today.ts:76-86` | #58 `recommend()` 의 **CHALLENGE 분기(마지막 수업 `nextPreview` 조회·`reason:'CHALLENGE'`·오류 시 기존 추천 폴백)에 단위 테스트가 없다.** `getActiveChallengeTopic` 만 테스트되고 접착 코드는 라이브 A10 에만 덮인다. 010d-A3 가 같은 파일을 이어 고칠 예정이라 회귀 위험이 있다. | `recommend` 를 export 하거나 `activeChallengeSafely` 주입점을 두어 "챌린지 있음→CHALLENGE·오늘 수업 끝냄→기존 추천·계산 실패→기존 추천" 3건. |
| L-5 | LOW | `tests/live/challenge-cleanup.ts:36`·`challenge-ttfa.ts:101` | 기본 정리는 **QA 계정 3 의 `Challenge` 전부**, `--review-decision-today`·TTFA 는 계정 3 의 오늘 REVIEW_DECISION 잡 전부를 지운다(이 실행이 만든 행만이 아님). 머리말에 적혀 있고 042·043·044 와 동시 실행을 막는 규칙이 있으나, 스모크 머리의 "이 실행이 만든 행만"과 다른 범위다. | 동시 실행 금지를 QA 이력서 체크에 명시(코드 변경 불필요). |
| I-1 | INFO | `src/types/lesson.ts:5` ↔ `src/types/challenge.ts:5` | 두 타입 파일이 서로를 `import type` 한다(순환). TS 에서는 무해하지만 `JlptLevel` 을 중립 위치에 두면 깔끔하다. | 선택 |
| I-2 | INFO | `service.ts:51` ↔ `topics/index.ts:12-15` | 주제 소유 조회가 `getTopicRef` 와 같은 조건을 다시 쓴다(`level` 도 필요하고 `deps.db` 주입 때문). 한쪽 조건이 바뀌면 어긋날 수 있다. | `getTopicRef` 를 `level` 까지 돌려주게 확장하고 `db` 인자를 받게 하는 것을 후속 정리로. |
| I-3 | INFO | `metrics.ts:245`·`:325` | `any(d)`·`lessonsDone` 이 수업 과제를 끈 챌린지에서도 수업을 센다(끝낸 수업만 있어도 ◐). 설계서 §6-4 의사코드 그대로라 **코드 결함이 아니다**. 화면 문구("수업 n")가 이 경우 어떻게 보일지는 designer/Leader 확인 사항. | — |
| I-4 | INFO | `validate.ts:54` | `words:false` 인데 `wordCount` 가 와도 조용히 무시(400 아님). 설계서 "words:false 면 칸 null"과 맞고 위험 없음. | — |

### 4. 감사 초점별 판정
1. **지표 정확도** — 위 §1. 설계서 §6-4 와 어긋난 곳 0. 코드가 의사코드의 의도를 넘어 바꾼 곳도 0.
2. **데이터 무결성·동시성** — [확인] `activeKey` 를 쓰는 곳은 `service.ts:89`(만들기, `userId`)와 `settle.ts:37`(`finishChallengeTx` 하나 — COMPLETED 전이·#159·TOPIC_REMOVED 전부 이 경로, `activeKey:null`)뿐이고 `Challenge` 쓰기 호출은 `create` 1곳·`updateMany`(조건 `status:'ACTIVE'`) 1곳뿐(grep). 만들기 = `lockUserRow` → `settleExpiredTx` → 진행 중 확인(409) → 하루 20회(429) → INSERT 가 한 트랜잭션(READ COMMITTED — `infra/tx.ts` 가 "잠금 뒤 SELECT 가 커밋된 행을 본다"를 보장), P2002 는 같은 409. 지연 전이는 잠금 뒤 재조회 + 조건부 UPDATE 라 이중 쓰기 불가(재현 §1). 그만둔 당일·며칠 뒤 `result.days[]` 일치, 그만둔 뒤 스냅샷 미포함. `dailyGoal` 은 만들 때 얼리고(`freezeDailyGoal`) 이후 계산은 저장된 `wordsMinAnswered` 만 읽는다. 삭제 후 불변: 지표는 스냅샷만 읽고(수업·세트·StudyLog 삭제는 링크 `refExists` 만 바꿈, 테스트 덮음). 실제 MariaDB 경합은 가짜 DB 로는 못 본다 → QA A4.
3. **완료 트랜잭션 무변경** — [확인] `git diff HEAD -- lessons/lifecycle.ts` 빈 diff, `lifecycle.ts`·`vocab/*.ts`·`snapshots/` 에 `challenge` import 0, 단위 테스트가 `lifecycle.ts` 에 "challenges" 문자열 0 을 단언. #62 는 `completeLessonDetailed`·`afterStudyCompleted` 뒤에 `done.kind==='NEW'` 일 때만 `challengeProgressAfter` 를 부르고, 함수 본문 전체가 try/catch → 로그(`e.name` 만)·null. 쿼리 오류·`dailyGoal` 이상 주입 테스트로 null 확인. 043/042 의 #51 라우트도 같은 형태.
4. **LLM 0·Trace/AiJob 불증가** — [확인] challenges·라우트에 엔진·LLM·`createJob` import 0, 쓰기는 §2 의 두 호출뿐. #155~#159·#58·#62·#70·#71 시나리오 단위 테스트가 `AiJob`·`RequestTrace` 행 0·`Challenge` 밖 쓰기 0 을 단언. **`findActiveJob` 예외 판정(아래 §5)**.
5. **보안·경계** — [확인] #155~#159 모두 `requireSession` + `where {id, userId}`(남의 것·없는 것·형식 틀린 id 전부 404, 존재 은닉), 주제는 시드 또는 내 것만(없거나 남의 것 404 — 테스트 덮음), 입력은 화이트리스트(모르는 키·기간 7/14/30·장수 5/10/15·제목 ≤40자·`start` 는 `TODAY|TOMORROW` 만, 날짜는 서버 KST), 본문 4KB/1KB 상한, 커서 형태 검사, GET 은 `private, no-store`. 응답에 `userId`·`activeKey` 없음. 로그에 Secret·사용자 입력 없음(`row.id`·`e.name`). `learning/index.ts` `export *`: **TS 컴파일러 API 로 재확인** — challenges 공개 27개 전부 `learning` 에서 challenges 선언으로 해석, 명시 export 에 가려진 것 0, 다른 줄에 같은 이름 0. `src/app/api/v1/challenges/**` 는 `@/modules/learning`·`infra` 만. 하루 20회 429 가 막는 것 = 만들기·그만두기 반복으로 `Challenge` 행이 쌓이는 것(사용자 삭제 경로가 없음).
6. **응답 계약** — [확인] #155~#159 모양이 설계서 §9-1 과 일치(`ChallengeSummary`·`ChallengeDetail`·`TodayTasks`·`topicProgress` 8칸·`totals`·`recentlyEnded` — `endedAt`·`result` 요약이 설계서 "result요약"의 구체화). #58 은 `reason` 값 하나 추가, #62 는 `challenge` 키 추가(값 없으면 null), #70 `days[].challenge`·`summary.challenge` 는 해당 날·진행 중일 때만 키 존재(`withChallengeCalendar` 가 없으면 원본 객체 그대로 — 기존 달력 테스트가 모양 불변 확인), #71 `challenge` 는 챌린지 날만. `plan/{calendar,day}`·`lessons/today` 라우트는 `ok(await 모듈())` 통과형이라 **무변경**(diff 없음). `src/types/{plan,lesson}.ts` 변경은 additive(optional 칸 3개 + `reason` 값 + `CompleteResult.challenge?`) — 컴포넌트에 `recommendation.reason` 분기가 없어(grep) 옛 클라이언트 영향 없음. **`challenge.words.need: number | null` 타당**: 설계서 §9-1 "꺼진 과제 — `need`·`ok` = null" 과 같은 규칙이고, `ChallengeProgress.words.need`(#62·#51)는 단어 과제가 켜진 경우에만 나오므로 항상 숫자다. T3·T4 는 #71 `need` 가 null 일 수 있음을 처리해야 한다.
7. **스모크·정리 도구** — 작성만 검토(실행 안 함). 정리·TTFA 도구는 `QA_USER_WHERE` + PRODUCTION 거부 + 계정 3 한정 삭제(챌린지·표식 `t041` 스냅샷/기록/수업·이 실행 세트·Trace·REVIEW_DECISION 잡). 스모크는 이 실행 id·표식만 지우나 L-3 의 가드가 빠짐. dev 가 고친 결함 2건: **C3 수정 타당**(A·B 에서 그만둔 챌린지가 C 의 COMPLETED 보다 `endedAt` 이 늦어 `recentlyEnded` 가 그쪽을 가리키던 문제 — 이 실행이 만든 끝난 행을 먼저 지움) **단 그 삭제가 M-1 을 만들었다** · **A16 수정 타당**(기준 #58 이 건 A11 잡이 끝난 뒤 앞뒤를 센다 — 잡이 150초 안에 안 끝나면 "다시 실행"으로 안내). 두 도구 모두 비밀 출력·저장 없음(쿠키 파일 `mktemp` 600·종료 시 삭제, `qa-session` 출력 숨김).
8. **테스트 재실행** — §2. 다른 WP 의 미완성 파일로 인한 실패 없음.
9. **범위 이탈** — [확인] 이 task 의 변경은 소유 경로 안(`challenges/**`·`today.ts`·`calendar.ts`·`complete/route.ts`·`api/v1/challenges/**`·`types/{challenge,plan,lesson}.ts`·테스트·`tests/live/challenge-*`)뿐. `prisma/**`(DB0 몫)·`conversation/**`·`components/**`·`vocab/**`·`topics/**`·`snapshots/**`·`lifecycle.ts` 는 T1 이 고치지 않았다(`topics/pool.ts` 는 import 만). `learning/index.ts` 두 줄은 DB0 몫. 다른 WP 와 겹침 없음.

### 5. 지정 질문 판정
- **`findActiveJob` 예외 판정: 허용(위반 아님), 조치 불필요.** 근거 — ① 설계서 §6-1 이 "오래된 AiJob 행만 infra 가 닫고 Lesson 은 쓰지 않음"으로 명시 허용 ② `findActiveJob` 은 새 행을 만들지 않고 `isStaleJob`(이 프로세스가 돌리는 잡 제외·`staleAfterMs(kind)` 초과)인 `QUEUED/RUNNING` 행만 `FAILED('stale')` 로 바꾼다 — **행 수 증가 0**, 이미 죽은 잡의 표기를 앞당길 뿐이며 같은 함수를 기존 #58(`settleGenerating`)·#59·`/jobs/:id` 읽기 경로가 이미 쓴다 ③ 재시도 정책 불변 — 재생성은 사용자가 [다시 만들기]를 눌러야 시작(#59), 챌린지 경로가 자동 재시도를 만들지 않는다 ④ #158 은 수업이 `GENERATING` 일 때만 이 호출을 하므로 GET 폴링이 매번 쓰지 않는다. 남는 것은 주석 정정(L-2)과 QA 확인(죽은 잡·살아 있는 잡 각각에서 `AiJob` 행 수 불변, `Lesson.status` 가 `GENERATING` 으로 남음).

### 6. QA 로 넘기는 `high_risk_areas`
1. **실제 MariaDB 경합**(가짜 DB 로 못 본 것): 스모크 A4(동시 두 #156 → 200 하나·409 하나) + **추가 권장** — 동시 #159×2, 만료 행에 동시 #158×2, #159 와 #62 동시. 사용자 행 잠금과 `activeKey` 유니크가 함께 작동하는지(READ COMMITTED).
2. **자정·`@db.Date` 왕복**: B1(23:59 수업·00:01 끝낸 세트 소급)·C1~C4(마지막 날 자정 마감·`endedAt`=오늘 00:00 KST). 실제 DB 의 `startDate`/`endDate` 날짜가 KST 와 하루 어긋나지 않는지, `createdAt` 비교(`createdAt < closeAt`)가 DB 시계·앱 시계 차이에 안전한지.
3. **스모크 M-1 수정 후 실행** — D1 은 ACTIVE 챌린지와 끝난 챌린지(`result` 있음) 각각 20회 p50/p95(합격 판정 아님, 설계 목표 ≤300ms), D1 에 200 아닌 응답이 섞이면 FAIL.
4. **#62 실값(LLM A4 필요 — QA 판단)**: 챌린지 주제 새 수업 완료 → `challenge` 실값·`goalMetNow` 토스트 1번, 복습·붙여넣기·다른 주제 수업 → null, `challengeProgressAfter` 실패 주입 시 완료 그대로. 완료 응답에 키 `challenge` 가 항상 있고 값만 null 인지.
5. **기존 응답 회귀**: #58·#62·#70·#71 의 기존 키·모양 불변(스모크 A10b 는 #58 키 목록만 비교 — #70·#71·#62 는 챌린지 없는 계정에서 전후 비교를 추가), 008·010·011·012 스모크.
6. **`findActiveJob` 경로**: #158·#157 에서 `GENERATING` 수업의 살아 있는/죽은 잡 각각 — `AiJob` 행 수 불변·`Lesson` 은 `GENERATING` 유지·응답은 GENERATING/FAILED 표시.
7. **QA 계정 3 직렬화**: 042·043·044 와 시간을 나눈다. `challenge-cleanup.ts` 기본 실행은 계정 3 의 챌린지 전부를 지운다(L-5). TTFA 는 042 의 #47 `generate:false`·#53 다시 풀기 선행 필요(042 로컬 커밋 뒤).
8. **테스트 격리 주의**: `.env` 가 있는 미러에서는 `env -u DATABASE_URL` 로 DB 를 막지 못한다 — 단위 전체 실행은 `DATABASE_URL` 을 무효 값으로 덮어 돌린다(§2 주의).
9. **하위 task 인계**: T3·T4 는 #71 `words.need`/`ok` null 처리·`#158.today` null(내일 시작·기간 밖)·`ChallengeProgress.date` 가 어제일 수 있음·`recommendation.reason='CHALLENGE'` 를 소비한다.

### 7. 다음 단계
- **Developer(소규모, `tests/live` 만)**: M-1 수정 + L-3 가드 + L-2 주석(+선택 L-1·L-4). 제품 코드 diff 가 없으면 Reviewer 는 해당 파일만 재확인 후 judge C2 로. L-4 를 하면 `today.ts` 단위 테스트만 추가(제품 동작 불변).
- judge C2 → (판정 시) Codex → QA. 정본 문서(§11-3) 갱신은 Leader 단독(C17). `risk=R2`·`native_change:false`·`versionCode` 해당 없음.
- **확인 못 한 것**: 실제 MariaDB 에서의 동시성·`@db.Date` 왕복·p95, 실제 #62 수업 완료 라이브, TTFA 참고치, 스모크·정리 도구의 실행(금지) — 전부 QA 몫. 스모크 `lesson.create` 필수 칸이 맞는지는 tsc 통과로만 확인했다.

```json
{ "reviewId": "REV-120", "status": "PASS_WITH_NOTES",
  "issues": [
    { "issue": "스모크 D1 이 지워진 챌린지(404)를 재서 #157 p95 참고치가 오염", "severity": "MEDIUM", "component": "tests/live/challenge-smoke.ts:217,236", "risk": "QA 완료 기준 3 의 p95 기록이 실패 신호 없이 틀림", "evidence": "bId(ENDED)가 created 에 들어 있어 217 deleteMany 에서 삭제된 뒤 236 D1 루프가 bId 를 조회", "recommendation": "D 구간을 삭제 앞으로 옮기거나 새 ACTIVE·끝난(cId) 챌린지로 측정하고 200 아니면 FAIL" },
    { "issue": "dailyGoal 형태 이상 행이 목록·오늘·그만두기 응답을 500 으로 만듦(복구 경로 없음)", "severity": "LOW", "component": "store.ts:73-78 · view.ts:80", "risk": "서버만 쓰는 값이라 확률 낮음", "evidence": "toMetricChallenge 가 ChallengeDataError 를 던지고 list/today 가 행 단위로 잡지 않음", "recommendation": "행 단위 건너뛰기 또는 끝난 행은 result 로 읽기" },
    { "issue": "service.ts 머리 주석이 findActiveJob 의 stale 행 FAILED 처리와 모순", "severity": "LOW", "component": "service.ts:3,201", "risk": "오해", "evidence": "infra/jobs.ts:109-110", "recommendation": "주석 정정" },
    { "issue": "스모크에 PRODUCTION·QA_USER_WHERE·포트 3010 가드와 set -e 없음", "severity": "LOW", "component": "tests/live/challenge-smoke.ts:120-128 · challenge-smoke.sh", "risk": "공유 DB 직접 쓰기", "evidence": "정리·TTFA 도구에는 있음", "recommendation": "가드 추가" },
    { "issue": "#58 CHALLENGE 분기 단위 테스트 없음", "severity": "LOW", "component": "lessons/today.ts:76-86", "risk": "010d-A3 가 이어 고칠 때 회귀", "evidence": "테스트는 getActiveChallengeTopic 만", "recommendation": "recommend 주입점 + 3건" },
    { "issue": "정리 도구 삭제 범위가 QA 계정 3 전체", "severity": "LOW", "component": "challenge-cleanup.ts:36 · challenge-ttfa.ts:101", "risk": "동시 레인 간섭", "evidence": "머리말에 문서화", "recommendation": "QA 직렬 규칙 명시" } ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 5, "info": 4 },
  "high_risk_areas": ["MariaDB 동시성(#156·#159·#158)", "자정 경계·@db.Date 왕복", "스모크 D1 수정 후 p95", "#62 실값·goalMetNow", "기존 #58·#62·#70·#71 회귀", "findActiveJob 경로 AiJob 행 수 불변", "QA 계정 3 직렬화", "테스트 DB 격리(.env)"],
  "native_change": false }
```

## Reviewer 기록 (REV-124, 2026-10-06 23:36, Codex C2 지적 2건 판정 · Read 전용 — 제품 코드·스키마·문서 수정 0, 이 절만 기록)

- **판정: CHANGES_REQUESTED (소규모 — 코드 3곳 + 테스트, 제품 동작·응답 모양 불변)** — Codex ① **오탐(설계 허용)**, Codex ② **부분 채택(원인 정정)**. 채택분 심각도 MEDIUM(영향은 불변 `result` 영구 오염이지만 도달 확률은 극히 낮음). HIGH·CRITICAL 0. REV-120 의 PASS_WITH_NOTES 판정(지표·전이·완료 트랜잭션 무변경)은 그대로 유효하고, 이번 수정은 `endChallenge` 계열의 시각 선취 한 가지만 다룬다. 기준: NFS 작업 트리(task-041 소유 파일은 미러 `~/.node-local/thekaiwa-041` 과 sha256 전부 일치 — 확인 18개 파일).
- 확신 표기: `[확인]` = 이번 세션에서 코드를 읽거나 실행해 본 것, `[가능성 높음]`·`[추측]` = 추론.

### 0. 먼저 알아야 할 사실 — `StatsSnapshot.createdAt` 은 DB 시계가 아니라 앱 호스트 시계다
- [확인] LESSON·VOCAB_SESSION 스냅샷은 `snapshots/index.ts:157`(`createVocabSessionSnapshot`)·`:177`(`createLessonSnapshot`)의 `tx.statsSnapshot.create({ data: { userId, kind, periodKey, data } })` 로만 만들어지고 `createdAt` 을 넘기지 않는다. 스키마는 `createdAt DateTime @default(now())`(`schema.prisma:1329`)라서 DDL 에 `DEFAULT CURRENT_TIMESTAMP(3)` 가 생기지만, **Prisma 쿼리 엔진은 `now()` 기본값을 DB 에 맡기지 않고 INSERT 에 값을 직접 실어 보낸다.** 직접 실측했다(프로젝트 DB 아님 — 스크래치패드의 개인 SQLite 와 소켓 전용 **MySQL 8.0.46 임시 인스턴스**, 프로젝트와 같은 Prisma 6.19.3 엔진·쿼리 로그):
  - MySQL: `INSERT INTO scratch.Snap (id,createdAt,updatedAt) VALUES (?,?,?)` · 파라미터 `createdAt = "2026-10-06 14:28:44.686 UTC"` = 같은 호출의 Node 시각 창 `14:28:44.676~.688` 안. 표 정의에는 `createdAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` 가 있는데도 쓰이지 않았다. SQLite 도 같은 동작(`createdAt == updatedAt` 정확히 일치).
  - 프로젝트 DB 는 NAS MariaDB 라 그 서버로는 못 돌렸다. 값이 문장을 보내기 **전에** 엔진이 정하므로 서버 종류와 무관하다는 추론이 남는다 `[가능성 높음]`. 임시 MySQL 은 종료했고 소켓 파일도 사라진 것을 확인했다.
  - DB 시계로 쓰는 곳은 `snapshots/index.ts:129` DAILY raw INSERT 의 `NOW(3)` 뿐이다. 챌린지는 DAILY 를 읽지 않는다(`store.ts:84` `kind in ['LESSON','VOCAB_SESSION']`).
- 따라서 **Leader 측정 "DB 시계가 앱보다 +10ms 앞섬"은 챌린지 경계에 영향이 없다.** `createdAt`(엔진 = Node 프로세스 시각)·`endedAt = deps.now()`(같은 프로세스) 는 **하나의 시계**다. NTP 가 틀어져 수 초 벌어져도 앱↔DB 상대 오프셋이 아니라 앱 전체(KST 날짜 경계 포함)의 절대 오차이고 둘이 함께 움직인다. 이 전제는 지금 어떤 테스트도 지키지 않는다(권고 테스트 T-5).
- `progress.ts:39` 주석("앱 서버와 DB 서버 시계가 조금 어긋나도…")은 이 전제와 맞지 않는다. 보정(`now' = max(real, createdAt+1ms)`)은 같은 ms·시계 되돌림 방어로는 무해하지만 "DB 시계 보정"이라 읽히면 오해를 부른다 → 주석 정정(LOW).

### 1. Codex 지적 2건 판정

| # | Codex 지적 | 판정 | 근거(파일:줄 · 실행) | 심각도 |
|---|---|---|---|---|
| ① | `progress.ts:25` 완료 커밋 뒤 `challengeProgressAfter` 가 돌기 전에 그만두기·만료 전이가 ACTIVE 챌린지를 끝내면 응답 `challenge`·`goalMetNow` 가 사라짐 | **오탐(설계가 허용한 동작) — 수용** | 현상 자체는 [확인]으로 재현된다(재현 §2-C: `progress = null`, 그런데 같은 완료가 `result.lessonsDone = 1`·day1 `MET`). 그러나 설계서 §5-4 가 이 경우를 **명시 규칙**으로 둔다 — "값이 나오는 조건 ① 사용자의 **ACTIVE** 챌린지… 그 밖은 전부 null — 진행 중 챌린지 없음·**끝남(COMPLETED·ENDED)**…", "실패 격리: … 화면은 토스트만 못 보이고 계획표를 열면 정확한 값이 보인다". 단위 테스트 'null 목록'(`challengeService.test.ts:273`)에 "끝남→null"이 이미 들어 있다. 클라이언트가 보는 것은 **토스트 누락뿐, 거짓 토스트는 불가**다: `ChallengeEndLine.tsx:14` `if (!challenge) return null`이라 null 이면 줄 자체를 그리지 않고, 값이 있으면 정확한 계산값이다 `[확인: ChallengeEndLine]`, 토스트가 `goalMetNow` 에 묶인다는 점은 파일 머리 주석만 읽었다 `[추측: LessonScreen 본문 미확인]`. 서버 최종 상태는 정합하다 — 완료는 `result.days[]` 에 들어간다(②를 고치면 항상 보장). **도달 확률**: 사용자가 그만두기를 누를 수 있는 시점은 완료 응답을 받은 뒤이므로 한 기기에서는 불가능하고, 다른 탭·기기 또는 자정(마지막 날 `settleExpired`)에서 **커밋 뒤 첫 SELECT 까지 약 1회 왕복(NAS 8ms 안팎)** 안에 끼어들어야 한다. Codex 권고(끝난 챌린지도 함께 조회)는 §5-4 의 null 규칙을 바꾸고 `ChallengeProgress` 에 `status` 같은 칸을 더해야 UI 가 "끝난 챌린지의 달성 토스트"를 구분할 수 있어(T3·T4 영향) 이득 대비 비용이 크다. | INFO(수용) |
| ② | `settle.ts:28` `StatsSnapshot.createdAt` 은 DB 기본 시각, `endedAt` 은 앱 시각 → DB 가 앞서면 방금 커밋된 완료 스냅샷이 ENDED 의 불변 `result` 에서 영구 누락 | **부분 채택 — 전제(DB 시계)는 오탐, 같은 증상의 다른 원인은 실재** | 전제 오탐: §0 실측(createdAt = 엔진=앱 시각). **실재하는 원인**: `endChallenge`(`service.ts:127`)가 `now = deps.now()` 를 **사용자 행 잠금을 얻기 전**에 잡고, 그 값을 `endedAt`(`:134`)·`finishChallengeTx` 의 스냅샷 상한(`settle.ts:28` `loadChallengeSnaps(..., to.endedAt)`, 조건 `createdAt < endedAt`)에 쓴다. 완료 트랜잭션은 `lockUserRow` 를 쥔 채 스냅샷을 만들므로(`lifecycle.ts:102`·`vocab/sessions.ts:727→781`), 그만두기가 `now`(t2)를 잡고 **잠금 대기 중**일 때 먼저 들어간 완료가 t1(>t2)에 스냅샷을 만들고 커밋하면, T2 가 잠금을 얻은 뒤 읽는 스냅샷에서 그 완료는 `createdAt ≥ endedAt` 로 **제외**된다 — 커밋이 끝난 완료가 그만둔 시각보다 "나중"으로 취급되는 순서 역전. 시계 오차 없이 **단일 시계에서** 일어난다. 재현(§2): endedAt 00:30:00.000Z·snapshot.createdAt 00:30:00.050Z → `result.lessonsDone = 0`, day1 `STOPPED`(그 하루의 ✓ 가 영구히 사라짐), 수정안은 같은 끼어들기에서 `lessonsDone = 1`·`MET`. **창의 크기**: 그만두기 요청 도착 시각 ~ 잠금 획득 = 같은 사용자의 진행 중 완료 트랜잭션 잔여 구간(NAS 왕복 8ms × 수십 문장 ≈ 100~300ms), 교착 재시도(P2034)가 있으면 더 길다(재시도해도 `now` 는 콜백 밖이라 그대로). **영향**: `result` 는 끝날 때 1회·불변이라 복구 경로가 없다. 달성이었던 날이 ✕ 로 얼려지고 `metDays`·`rate` 가 낮아진다(기록 자체는 `StatsSnapshot` 에 남아 있음). | MEDIUM(확률 극히 낮음 · 영향 영구) |

- **②의 "도달 가능성"** — 현실적 경로는 둘뿐이다. (a) 같은 사용자가 두 기기·탭에서 수업(세트) 끝내기와 그만두기를 100~300ms 안에 겹쳐 누름 (b) 자동화·스모크(QA 의 병렬 호출). 한 화면에서 순서대로 누르는 사람은 불가. 그래서 사용자 영향은 사실상 0 에 가깝지만, **불변 데이터를 만드는 경로에서 순서가 뒤집힌다는 사실**과 수정 비용(코드 6줄 안팎)을 비교하면 고치는 쪽이 싸다. 코드는 이미 "언제 전이해도 결과가 같다"를 강한 불변식으로 삼고 있어(설계서 §5-5) 이 경합은 그 정신에 어긋난다.
- **자정 만료(COMPLETED)** 쪽은 같은 문제가 없다 — `endedAt` 이 전이 실행 시각이 아니라 고정 경계(endDate 다음 00:00 KST)라서 잠금 대기와 무관하다. 자정 전에 만든 스냅샷은 사용자 행 잠금 직렬화 덕에 `settleExpired` 의 읽기에 반드시 보인다(READ COMMITTED + 잠금 뒤 SELECT, `infra/tx.ts` 머리 주석). 영향을 받는 것은 `endedAt: now` 를 쓰는 **그만두기(#159)** 와 **TOPIC_REMOVED(1단계 도달 불가)** 둘이다.
- **DB 시계가 정말 앞서면?**(Codex 시나리오) — 이 코드에서는 일어나지 않는다. 그리고 Codex 권고(경계를 DB `CURRENT_TIMESTAMP`/`NOW(3)` 에서 얻기)는 오히려 **앱 시계로 쓰인 `createdAt` 과 DB 시계를 섞어 지금 없는 오프셋(+10ms, NTP 장애 시 수 초)을 새로 들여온다.** 반권고.

### 2. 재현 (스크래치패드 `scratchpad/repro/race.test.ts` — 미러의 가짜 DB·모듈을 import, 프로젝트 파일 무수정, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)
| 시나리오 | 결과 |
|---|---|
| A. 현재 코드: T1(완료)이 사용자 잠금을 쥔 채 스냅샷 `createdAt = t2+50ms` 를 만들고 커밋하는 동안 T2(그만두기, `now = t2`)가 잠금 대기 | `endedAt 00:30:00.000Z`·`snapshot.createdAt 00:30:00.050Z` → `result.lessonsDone 0`·day1 `STOPPED` — **완료 누락 재현** |
| B. 수정안(같은 로직, 차이는 `now`·`today` 를 `lockUser` 뒤 트랜잭션 안에서 잡는 것 하나) | `endedAt 00:30:00.080Z` > snapshot → `lessonsDone 1`·day1 `MET` — **누락 없음** |
| C. 완료 커밋 뒤 그만두기가 먼저 끝난 다음 `challengeProgressAfter` | `progress = null` · `result.lessonsDone 1`·`MET` — ① 은 알림만 null, 데이터는 정합 |
- 세 건 모두 PASS(기대대로 재현). 이 파일은 권고 테스트의 원형이다(Developer 가 `challengeService.test.ts` 로 옮기면 됨).

### 3. 권고 수정안 비교
**② `endedAt` 시각**
| 안 | 변경 | 효과 | 위험·단점 | 권고 |
|---|---|---|---|---|
| **A. `now`·`today` 를 사용자 잠금 뒤 트랜잭션 안에서 잡는다** | `service.ts` `endChallenge`(`:127-135`) · `createChallenge` 의 `settleExpiredTx` 호출(`:85-87`, TOPIC_REMOVED 경로의 `endedAt`) · `settle.ts` `settleExpired`(`:56-65`) — 각 콜백 맨 앞 `await deps.lockUser(...)` 다음 줄에 `const lockedAt = deps.now()` 를 두고 `today = dates.todayKst(lockedAt)`·`endedAt`·`finishChallengeTx` 의 `now` 에 그 값을 쓴다. 교착 재시도 때도 콜백이 다시 돌아 시각이 새로 잡힌다. ≈ 6~8줄 | 잠금 이전에 커밋된 완료는 모두 `createdAt < lockedAt`(단일 시계), 잠금 뒤에야 도는 완료는 `createdAt > endedAt`(그만둔 뒤 공부는 세지 않음)로 **순서가 항상 맞는다**. 출력 형태·API·`result` 모양 불변 | 없음. 바깥 `due` 사전 점검(`settleExpired`)은 지금처럼 잠금 전 시각으로 둬도 된다(확인용일 뿐) | **권고(최소·충분)** |
| B. 경계를 DB 시계(`SELECT NOW(3)`)로 | raw SQL 1~2곳 + 가짜 DB 확장 | 앱 시계로 쓴 `createdAt` 과 **다른 시계**를 비교하게 됨 → 오차가 새로 생김 | 단위 테스트가 DB 를 필요로 함 | 반권고 |
| C. 마진(+2~5초) | `endedAt` 또는 경계에 더함 | 수 초 안의 순서 역전을 가림 | "그만둔 뒤 공부는 세지 않는다"·`endedAt` 의미가 흐려지고, 끝난 챌린지의 #157 링크 재계산(`view.ts` 의 같은 마감 시각 재계산)과 얼린 `result` 가 어긋날 수 있음 | 반권고 |
| D. 수용(감시) | 0 | — | 불변 `result` 영구 오염 가능성이 남음 | 비권고(수정이 더 싸다) |

**① 응답 조합** — 권고 1개: **수용(A)**.
| 안 | 변경 | 효과 | 위험·단점 |
|---|---|---|---|
| **A. 수용 + 문서 한 줄** | 0줄(선택: §5-4 또는 단위 테스트에 "끝남 경합 → null·완료는 result 에 포함" 주석) | 토스트만 놓침. 서버 상태 정합(②를 고치면 항상) | 사라지는 것은 일회성 알림뿐 |
| B. 방금 끝난 챌린지도 조회(`endedAt ≥ 스냅샷 createdAt`) 후 재계산 | `progress.ts` 약 15줄 + `ChallengeProgress` 에 상태 칸 + §5-4 null 규칙 개정 + T3·T4 UI 분기 + 테스트 | 그만둔 직후에도 "목표 달성"을 보여 줌 | **설계 규칙 변경**·UI 가 끝난 챌린지를 진행 중처럼 오해할 수 있음·이득이 ms 창 하나 |
| C. 완료 트랜잭션 안에서 응답 값 확정 | `lifecycle.ts`·`vocab/sessions.ts` 에 챌린지 읽기 추가 | 경합 없음 | **"완료 트랜잭션 무변경" 불변식 위반**(REV-120 §4-3, 설계서 §5-4·§11 C17), 모든 완료의 임계 구간이 길어짐, 챌린지 오류가 수업 완료로 번질 위험 |
| D. 이후 #158 로 보정 | 이미 그렇게 동작(계획표를 열면 정확한 값) | — | 이미 충족 |

### 4. 필요한 테스트 (Developer — `challengeService.test.ts` 에 추가, 위 재현을 이식)
1. **T-1(핵심)** "그만두기 — 잠금 대기 중 커밋된 완료도 얼린 result 에 들어간다": 재현 A·B 의 끼어들기. 기대: `result.lessonsDone = 1`, 그날 `MET`, `endedAt > snapshot.createdAt`. 같은 끼어들기를 `settleExpired` 의 TOPIC_REMOVED 경로(`topicId=null`)에도 한 건.
2. **T-2** 반대 순서: 그만두기가 잠금을 먼저 얻고(완료 대기) 완료가 그 뒤 커밋 → 그 완료(`createdAt > endedAt`)는 `result` 에서 **제외**, `getChallengeDetail` 재조회도 같은 값(불변).
3. **T-3** 경계(서비스 수준): 스냅샷 `createdAt = endedAt − 1ms` 포함 · `= endedAt` 제외. (순수 함수 수준 "정각 제외/1ms 전 포함"은 `challengeMetrics.test.ts` 에 이미 있다.)
4. **T-4** 시계 오차 ±10ms·±5s: **의미가 있는 건 "앱 시계 하나"라는 전제를 고정하는 것**이다 — 서비스 수준에서 `clock` 을 ±10ms·±5s 움직여도(= 앱 시계 이동) 어느 쪽 스냅샷이 들어가는지가 `createdAt < endedAt` 순서로만 정해짐을 확인(순서 보존이면 결과 동일).
5. **T-5(전제 고정, 정적)**: `snapshots/index.ts` 의 `createLessonSnapshot`·`createVocabSessionSnapshot` 이 `createdAt` 을 넘기지 않고, LESSON·VOCAB_SESSION 에 대한 raw `NOW()` INSERT 가 없음을 `readFileSync` 로 단언(기존 '층·import' 테스트와 같은 방식). 이 전제가 깨지면 DB↔앱 시계 오차가 곧바로 지표에 들어온다 — 주석에 "Prisma `now()` 는 엔진이 값을 보낸다(MySQL 8.0.46·Prisma 6.19.3 로 REV-124 실측)" 를 남긴다.
6. **T-6** ① 계약 고정: 그만두기가 먼저 끝난 뒤 `challengeProgressAfter` → null, 같은 완료가 `result` 에는 포함(재현 C). `goalMetNow` 한 번만 규칙은 그대로(기존 표 9 테스트 유지) — null 이면 토스트 0번이라 중복 없음.

### 5. QA 로 넘기는 확인 (기존 `high_risk_areas` 1번에 추가 — QA 계정 3 직렬)
- **병렬 호출 쌍**: `POST /api/v1/challenges/:id/end` 와 세트 끝내기(#51, LLM 없음)를 거의 동시에 N회 반복 → 매 회차 읽기 전용으로 비교: 끝난 챌린지 `result` 가 센 세트 수 == 그 챌린지의 `StatsSnapshot(VOCAB_SESSION)` 중 `createdAt < endedAt` 인 수. 수정 전 코드에서는 가끔 어긋날 수 있고(확률 낮음), 수정 뒤에는 0 이어야 한다. 실제 MariaDB 경합은 가짜 DB 로 못 보므로 이 항목이 유일한 실측이다.
- 기존 A4(동시 #156)·스모크 B·C 시리즈는 변경 없이 그대로 통과해야 한다(제품 동작 불변).
- **앱 시계 전제 확인(읽기 전용, 선택)**: 오늘 만든 `StatsSnapshot(LESSON|VOCAB_SESSION)` 의 `createdAt` 과 같은 행의 `StudyLog.createdAt`·`lesson.completedAt`(둘 다 앱 시각)이 수십 ms 안에서 같은 쪽에 있는지 — DB 시계였다면 Leader 측정 오프셋만큼 일정하게 밀린다.

### 6. Developer 수정 지시 초안 (dev-041d — 신규 소환, 코드 수정 범위 한정)
- 파일: `src/modules/learning/challenges/service.ts`(`endChallenge`, `createChallenge` 안 `settleExpiredTx` 호출) · `src/modules/learning/challenges/settle.ts`(`settleExpired`) · `src/modules/learning/challenges/progress.ts:39` 주석 정정(DB 시계 표현 → "스냅샷 createdAt 은 Prisma 엔진(앱 호스트) 시각, 보정은 같은 ms·시계 되돌림 방어") · `src/modules/learning/__tests__/challengeService.test.ts`(T-1~T-6).
- 규칙: 사용자 행 잠금을 얻은 **뒤** `deps.now()` 로 `lockedAt` 을 잡고 `today = dates.todayKst(lockedAt)`·`endedAt`·`finishChallengeTx` 의 `now` 에 사용. `createChallenge` 의 `startDate`·`endDate`·429 `retryAfterSec` 는 지금대로(요청 도착 시각 기준, 영향 없음). 응답 모양·API·`finishChallengeTx` 시그니처·`metrics.ts` 불변. `settleExpiredTx(tx, userId, today, now)` 시그니처 유지(호출자가 값을 바꿔 넘김).
- 검증: 챌린지 단위(현재 44건 + 신규) · learning+conversation 전체 · `tsc --noEmit` · eslint(변경 파일). Reviewer 는 변경 파일만 재확인한다(제품 동작 불변이라 judge C2 재판정 여부는 Leader 결정 — Codex 호출 차수 현재 1/4).

### 7. 재실행 숫자 (미러 `~/.node-local/thekaiwa-041`, 이 task 소유 파일은 NFS 와 sha256 일치, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)
| 항목 | 결과 |
|---|---|
| 챌린지 단위 | **44/44 PASS**(`challengeMetrics` 20 · `challengeService` 20 · `challengeRecommend` 4, fail 0·cancelled 0·skipped 0) |
| `tsc --noEmit` | **rc=0, 출력 0줄** |
| DB 접촉 | 로그에서 `requestTrace.create`·FK 거부 0건 — 무효 URL 덮어쓰기가 먹혔다 |
| 재현 테스트(스크래치) | 3/3 PASS(시나리오 A 누락 재현 · B 수정안 포함 · C 알림만 null) |
- **구분**: 미러는 task-041 시점이라 다른 WP 의 미완성 NFS 파일(예: task-043 쪽 `need` 누락 테스트, task-042 의 `vocab/sessions.ts`·`topicSet.ts`·`task042.test.ts` 최신본)은 들어 있지 않다 — NFS 전체 `tsc` 는 이번에 돌리지 않았다(task-041 범위 밖). 위 `tsc rc=0` 은 "task-041 + 미러 시점의 나머지" 기준이다.
- 이 검토가 만든 부수 자원: 스크래치패드 SQLite·MySQL 임시 데이터 디렉터리(세션 폴더 안, 정리 불필요), 임시 mysqld 종료·`/tmp/kv041.sock` 삭제 확인. 프로젝트 DB·dev 서버·운영 3010 접촉 0.

### 8. 남은 위험·확인 못 한 것
- `[가능성 높음]` NAS MariaDB 에서도 `createdAt` 이 엔진 시각이라는 점 — 서버 종류가 값을 정하지 않는다는 추론이며 MariaDB 로는 확인하지 못했다(QA §5 세 번째 항목으로 간접 확인 가능).
- `[추측]` `LessonScreen` 의 토스트가 `goalMetNow` 에만 묶여 있다는 것 — 머리 주석으로만 확인.
- 실제 MariaDB 의 병렬 경합(§5 QA)·`challenge-smoke` 실행은 금지 범위라 하지 않았다.
- `createChallenge` 의 `today`·`startDate` 가 잠금 이전 시각이라, 잠금 대기가 자정을 넘기는 극단에서 시작일이 하루 앞서는 이론상 틈이 있다(잠금 대기 수백 ms·자정 경계 동시 — 무시 가능, INFO, 이번 수정 범위 밖).

```json
{ "reviewId": "REV-124", "status": "CHANGES_REQUESTED",
  "issues": [
    { "issue": "그만두기 endedAt 이 사용자 잠금 획득 전에 잡혀, 잠금 대기 중 커밋된 완료 스냅샷이 불변 result 에서 영구 누락(단일 시계 경합)", "severity": "MEDIUM", "component": "src/modules/learning/challenges/service.ts:127-135 · settle.ts:56-65 · service.ts:85-87", "risk": "달성이었던 날이 ✕(STOPPED) 로 얼려지고 metDays·rate 하락, 복구 경로 없음(확률 극히 낮음)", "evidence": "재현 A: endedAt 00:30:00.000Z < snapshot.createdAt 00:30:00.050Z → lessonsDone 0, 수정안 B → 1·MET. createdAt 은 Prisma 엔진(앱 호스트) 시각 — MySQL 8.0.46 + Prisma 6.19.3 INSERT 파라미터 실측", "recommendation": "now·today 를 lockUser 뒤 트랜잭션 안에서 잡는다(6~8줄) + 테스트 T-1~T-6" },
    { "issue": "progress.ts:39 주석이 'DB 서버 시계' 보정이라 적혀 있으나 createdAt 은 앱 시계", "severity": "LOW", "component": "src/modules/learning/challenges/progress.ts:39", "risk": "오해로 DB 시계 비교 코드가 새로 들어올 수 있음", "evidence": "REV-124 §0 실측", "recommendation": "주석 정정 + 전제 고정 정적 테스트 T-5" },
    { "issue": "Codex ① — 완료 응답 조합 중 그만두기·만료로 challenge=null", "severity": "INFO", "component": "src/modules/learning/challenges/progress.ts:25", "risk": "일회성 토스트 누락(거짓 토스트 불가)", "evidence": "설계서 §5-4 null 규칙(끝남→null)·재현 C(result 에는 포함)·ChallengeEndLine.tsx:14", "recommendation": "수용, 코드 변경 없음" } ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 1, "info": 1 },
  "codex_c2": { "adopted": 0, "partial": 1, "rejected_false_positive": 1 },
  "high_risk_areas": ["MariaDB 실제 병렬 그만두기×세트 끝내기(§5)", "기존 A4 동시 #156·B·C 스모크 회귀", "createdAt 앱 시계 전제(T-5 정적 테스트·QA 읽기 확인)"],
  "native_change": false }
```

## Reviewer 기록 (REV-126, 2026-10-06 23:56, REV-120·REV-124 이후 변경분 재확인 · Read 전용 — 제품 코드·스키마·문서 수정 0, 이 절만 기록)

- **판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · **Low 2** · Info 4. REV-124 수정(끝내는 시각을 사용자 행 잠금 뒤에 잡기)은 **세 곳 모두 정확**하고, dev-041c 가 제품 코드를 바꾼 두 곳(L-1 끝난 행 건너뛰기·L-4 추천 주입점)도 결함이 없다. 재순환 불필요 — 아래 Low 2건은 이번 변경이 만든 결함이 아니라 후속 인계(하나는 043 소유 파일)다. 기준: NFS 작업 트리, task-041 소유 29개 파일은 미러 `~/.node-local/thekaiwa-041` 과 sha256 전부 일치 `[확인]`.
- 확신 표기: `[확인]` = 이번 세션에 코드를 읽거나 실행한 것 · `[가능성 높음]`·`[추측]` = 추론. 프로젝트 DB·dev 서버·라이브·운영(3010) 접촉 0(`DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`, 챌린지 테스트의 DB 접촉 시도 0건·로그에 연결 거부 문자열 0).

### 1. 지적 표
| # | 심각도 | 위치 | 내용 · 근거 | 고칠 방법 |
|---|---|---|---|---|
| L-1 | LOW | `src/components/challenge/ChallengeListScreen.tsx:35`·`:67` (task-043 소유) ↔ `service.ts:303-310`(L-1 건너뛰기) | **dev-041c 가 남긴 인계 ③ 을 확인했다 — T3 목록은 이어 읽지 못한다.** 서버는 맞다: `nextCursor` 는 건너뛰기 전 원래 행(`rows`·`page`) 기준이라 `items: []` + `nextCursor` 가 나오고 다음 쪽이 이어진다(단위 테스트 `limit=2` 가 덮음). 그런데 화면은 `list.items.length === 0` 이면 빈 상태(`listEmpty`+[시작하기])만 그리고, [더 보기] 버튼(`list.cursor`)은 `else` 가지(`:67`) 안에만 있어 **빈 첫 쪽에서는 나오지 않는다**(`useChallengeList` 의 `loadMore` 는 있으나 부를 곳이 없음). 도달 조건 = 한 쪽(20개)이 전부 `dailyGoal` 깨진 끝난 행 — 수동 DB 수정·미래 `ruleVersion` 이 20개 연속일 때뿐이라 실사용 확률은 사실상 0. | 043 쪽에서 `[더 보기]` 를 빈 상태 가지 밖으로 빼거나, 서버 `listChallenges` 가 `items` 가 비면 한도(예: 5회) 안에서 다음 쪽을 이어 읽게. 어느 쪽이든 api-contract #155 에 "items 가 비어도 nextCursor 가 있을 수 있다" 한 줄(Leader). |
| L-2 | LOW | `service.ts:126-140`(`endChallenge`) · `store.ts:73-78` | dev-041c 의 "진행 중 행 `dailyGoal` 깨짐 — **복구 경로 없음**"은 API 수준에서는 **정확하지 않다.** 스크래치 재현(가짜 DB): 진행 중 행을 깨뜨리면 #155·#157·#158 은 `ChallengeDataError`, #156 은 409 `ACTIVE_EXISTS` 지만, **`POST /challenges/:id/end`(id = 409 `details.challengeId`)는 ENDED·`activeKey=null`·`result=null` 로 커밋한 뒤 응답 조립에서 500** 을 던지고, 그 뒤 #156 은 성공한다 `[확인]`. 화면에서는 닿을 수 없다(#158 이 500 이라 카드·상세가 없다) — 그래서 "사용자가 갇힌다"는 평가 자체는 유지된다. **이번 변경이 새로 연 경로는 없다** — 진행 중 행은 L-1 의 건너뛰기 대상이 아니어서 이전과 똑같이 던진다. 달력 #70·#71 은 `challengeStatesSafely` 가 잡아 챌린지 칸만 빠지고(그 달의 정상 챌린지 칸도 함께 빠짐) 공부 흐름(#58·#62)은 영향 없음(`getActiveChallengeTopic`·`challengeProgressAfter` 가 null) `[확인: 코드 읽기 — 이 달력·공부 흐름 쪽은 실행하지 않음]`. | Leader 판단 "수용·후속" 에 이 사실을 덧붙여 기록(운영 런북 한 줄: 위 `end` 호출). 후속에서 `endChallenge` 응답을 `dailyGoal` 없이도 조립하게 하거나 복구 수단을 둘 때 같이. |
| I-1 | INFO | `challengeService.test.ts:672-703`(T-5) | T-5 는 `StatsSnapshot` 생성을 `snapshots/index.ts` 에만 허용하는 정적 검사다(src 전체 `.statsSnapshot.create|createMany|upsert`·raw INSERT 검사). **010d 가 역할극 완료 스냅샷(`SnapshotKind` 추가)을 만들 때 다른 파일에서 `create` 하면 이 테스트가 실패**한다 — 의도된 가드(createdAt 앱 시계 전제)이므로 `snapshots/index.ts` 안에 함수를 두면 된다. | 010d 인계에 한 줄. |
| I-2 | INFO | `service.ts:85-89`(`createChallenge`) | 한 트랜잭션 안에서 시작일·하루 20회 세기·429 는 요청 도착 시각(`now`), 지연 전이만 잠금 뒤 시각(`lockedAt`)이다 — 잠금 대기가 자정을 넘는 극단에서 두 날짜가 갈린다. 충돌·불변식 위반은 없다(새 챌린지 시작일이 전이된 옛 챌린지 마지막 날과 겹쳐도 달력 `rank`·`createdAt` 규칙이 처리, 소급 규칙 U12 안). REV-124 §8 INFO 와 같은 사안 `[확인: 코드 경로]`. | 조치 없음. |
| I-3 | INFO | `service.ts:49` | 끝난 깨진 행은 읽을 때마다 로그 한 줄(`row.id` 만 — 개인정보·Secret 없음). 목록·#158 폴링마다 반복되어 로그가 늘 수 있다. | 후속에서 한 번만 남기기(선택). |
| I-4 | INFO | 문서(Leader 몫) | 정본 갱신 때 `endedAt`(ENDED) 설명은 "그만둔 시각" 보다 **"사용자 행 잠금을 얻은 시각"**이 정확하다(domain-model §3·§9-3·challenge.md §5-5·prisma 주석 `ENDED = 그만둔 시각` 은 그대로 둬도 의미는 통함). | C17 문서 갱신 때 한 줄. |

### 2. REV-124 수정 확인 — **[확인] 전부 정확**
| 확인 항목 | 결과 |
|---|---|
| `endChallenge`(`service.ts:129-137`) | `lockUser` 다음 줄 `lockedAt = deps.now()` → `settleExpiredTx(tx, userId, todayKst(lockedAt), lockedAt)`·`endedAt: lockedAt`·`finishChallengeTx(..., lockedAt)` — **`today`·`endedAt`·`now` 셋 다 `lockedAt`**. 잠금 전 시각은 남아 있지 않다. |
| `createChallenge`(`:85-89`) | 트랜잭션 안 `lockUser` 뒤 `lockedAt` 으로 `settleExpiredTx` 만 호출(TOPIC_REMOVED 의 `endedAt`). `startDate`·`endDate`·`made` 세기·429 `retryAfterSec` 는 요청 도착 시각 `now` 그대로 — I-2 외 충돌 없음. |
| `settleExpired`(`settle.ts:61-69`) | 사전 점검 `due` 는 잠금 전 시각(확인용), 전이의 `today`·`now` 는 `lockedAt`. |
| 교착 재시도 | `withTransaction` 이 P2034·P2010(1213)에서 콜백 전체를 다시 돌린다(`infra/tx.ts`) → 재시도 때 `lockedAt` 도 새로 잡힌다. |
| 자정 만료(COMPLETED) 경로 | `endedAt = kstDayStart(endDate+1)` 고정 경계(`settle.ts:51`)·`finishChallengeTx` 스냅샷 상한 = 그 경계 → 잠금 대기와 무관. `computeChallengeMetrics` 에서 `now` 는 `endedAt` 이 없을 때만 쓰인다(`closeAtOf`·`endDay`, `metrics.ts:184-218`) → `lockedAt` 을 `now` 로 넘겨도 결과가 변하지 않는다. 결정성 테스트(13일 vs 20일 뒤 전이 → `result` 동일) 유지. |
| 전제 | 스냅샷은 사용자 잠금을 쥔 채 만든다 — `lifecycle.ts:102`(`lockUserRow`)→`:168`(`createLessonSnapshot`), `vocab/sessions.ts:731`→`:785`(`createVocabSessionSnapshot`) `[확인]`. 두 생성 함수 외 `statsSnapshot.create` 없음(T-5). `createdAt`·`lockedAt` 은 같은 앱 시계, 잠금 해제(커밋)는 항상 `createdAt` 뒤라 `createdAt < lockedAt`(NAS 왕복 ≥ 수 ms 라 같은 ms 불가 `[가능성 높음]`). |
| 응답 모양·시그니처 | `endChallenge(userId,id,over?)`·`settleExpired(userId,deps)`·`settleExpiredTx(tx,userId,today,now)`·`finishChallengeTx(tx,row,to,now)`·`ChallengeSummary` 불변. 라우트 4개 무변경, `tsc` rc=0. |
| 주석 정정 | `progress.ts:39`·`settle.ts:7-9`·`service.ts:131` 의 "DB 서버 시계" 표현 제거, 남은 "DB 시계" 언급은 테스트 이름·메시지뿐(전제 설명). |
| T-1~T-6 이 실제 결함을 잡는가 — **직접 변이 재현**(스크래치 복사본 `scratchpad/mut126` 에서만 수정, 미러·NFS 무수정, 매번 원복 `cmp` 확인) | ① `endChallenge` 만 잠금 전 시각 → **T-1·T-4 FAIL**(25/27) ② `createChallenge` 안 전이만 요청 시각 → **T-1(TOPIC_REMOVED) FAIL** ③ `settleExpired` 만 잠금 전 시각 → **같은 테스트 FAIL** — 두 경로가 각각 따로 잡힌다 ④ 원복 후 27/27. T-1 의 `lockUser` 순서 단언(T2 가 T1 스냅샷보다 먼저 잠금을 요청)과 `setImmediate` 양보는 가짜 DB 의 FIFO 직렬화(`challengeFakeDb.ts:194-203`)에서 결정적이다. T-2(반대 순서 → 제외·불변)·T-3(경계 −1ms 포함·0 제외)·T-6(그만두기가 먼저 끝나면 null, 완료는 `result` 에 포함) 모두 PASS. |

### 3. dev-041c 제품 코드 변경 2곳 판정
- **ⓐ L-1 `finishedViewOrSkip`(`service.ts:44-52`) — 결함 없음.** `ChallengeDataError` 만 잡고 다른 예외·진행 중 행은 그대로 던진다 `[확인]`(변이: 전부 다시 던지게 하면 L-1 테스트 FAIL). 응답 계약 불변(`items` 에서 빠질 뿐), 건너뛴 행의 `nextCursor` 는 원래 행 기준이라 쪽 나눔이 이어진다(L-1 단위 테스트 `limit=2`). 건너뛰는 곳은 #155 끝난 쪽·#158 `recentlyEnded` 둘뿐이고 #157 끝난 행 상세는 여전히 500(`buildChallengeView` 가 던짐 — 사용자가 목록에서 그 행을 볼 수 없으므로 닿는 경로가 없다). 로그는 `row.id` 만. **갇힘 경로 판정: 새로 열린 것 없음**(L-2 §표). 진행 중 행 복구는 Leader 판단(수용·후속) 유지.
- **ⓑ L-4 `recommend` 분리(`today.ts`) — 동작 불변 `[확인: git diff HEAD 직접]`.** `recommendByHistory` 본문은 기존 `recommend` 와 동일하다(차이 = nextPreview 한 줄을 `previewOf` 로 뽑은 순수 리팩터, 같은 `readStoredContent(...)?.nextPreview` 검사). `getTodayLessons` 의 호출 한 줄만 `recommendTodayLesson(...)` 로 바뀌었고 `lessons/index.ts`(명시 export)·`lessons/today/route.ts` 는 무변경 → **공개 API·라우트 동작 불변**. `recommendTodayLesson`·`TodayRecommendDeps` 는 `today.ts` 에서만 export(barrel 미노출). LLM·잡·Trace 0(읽기만 — 새 테스트 4건이 `AiJob`·`RequestTrace`·쓰기 0 단언, 변이: `!lessonDoneToday` 조건 제거 → 4건 중 ② FAIL). 순환 없음(`lessons/today → challenges → topics·topics/pool → repetition·lessons/content` 값 import 에 barrel `../lessons` 없음, 단위 '층·import' 테스트 PASS).
  - **010d-A3 인계(이름)**: `recommend` → `recommendTodayLesson`(주입점 `TodayRecommendDeps{db,challenge,byHistory}`) + `recommendByHistory`(옛 본문, 비공개) + `previewOf`·`activeChallengeSafely`. `today.ts` 는 NFS 공용이라 덮어쓰기 주의. 설계서·010d L-B2 가 #58 `recommendedScenarios[]` 를 뺐으므로 A3 가 `today.ts` 를 만질 일은 없을 수 있다 `[추측]`.
  - 단위 테스트가 `byHistory` 를 가짜로 바꿨으므로 **기존 추천 규칙(CONTINUE·NEXT_TOPIC·START)의 회귀는 라이브 010 스모크가 유일한 확인**이다(dev-041c 남은 위험 ④와 같음) → QA.

### 4. 스모크·정리·TTFA 도구(작성만 — 실행 안 함) `[확인: 코드 읽기]`
- **가드는 실제 동작 코드**: `challenge-smoke.ts:24-31`(`APP_ENV=PRODUCTION` 거부·BASE 정규식 localhost 한정+`:3010` 거부·빈 쿠키 거부) · `uid()`(`:78-82`)가 `AND:[{email}, QA_USER_WHERE]` 로 **두 계정 모두** 확인한 뒤에만 `qa3` 를 채우고 정리도 `qa3` 가 비면 건너뜀(`:272`) · `.sh` `set -eu`·`PORT=3010` 거부·쿠키 `-s` 검사·`mktemp`+`trap rm`. 정리(`cleanup.ts:25-27`)·TTFA(`ttfa.ts:23-27,151-152`)도 같은 가드. `APP_ENV` 가 미러 `.env` 에서 `LOCAL  # 주석` 형태라 `--env-file` 이 인라인 주석을 자르는지 확인했다 — Node 20.20.2 에서 `APP_ENV=PRODUCTION  # …` 도 `"PRODUCTION"` 으로 읽혀 가드가 뚫리지 않는다 `[확인: 임시 env 파일로 실행]`.
- **D1a·D1b**(`:132-145,265-267`): 20회 모두 `status===200 && data.status===기대`(ACTIVE/COMPLETED)일 때만 p50/p95(nearest-rank)를 찍고, 하나라도 어긋나면 `check` FAIL + "참고치 무효"(지연 미출력). `dId`(오늘−3 시작 ACTIVE)는 B·C 스냅샷이 기간 안이라 실제 계산 경로, `cId`(C 에서 COMPLETED 로 전이, `result` 있음)는 링크 재계산 경로. M-1(지운 행 404 지연) 재발 방지 `[확인]`. 체크 총수 = 문자 26 + D1a·D1b = **28**(예외 시 `RUN` FAIL 1건 추가).
- **정리 범위**: 스모크는 이 실행 id·표식 `t041` 행만 지움(`:271-278`). `cleanup.ts` 기본 = **QA 계정 3 의 `Challenge` 전부**(`:38`·`:47` `where {userId}`), `--review-decision-today` = 계정 3 의 오늘 끝난 REVIEW_DECISION 잡 전부(QUEUED·RUNNING 제외) — 머리말 경고(L-5)·`--dry-run` 존재 `[확인]`. TTFA 끝 정리는 "이 실행 시작 뒤 끝난 REVIEW_DECISION 전부"(머리말 명시). 모두 QA 계정 한정.

### 5. 재실행 숫자(미러 `~/.node-local/thekaiwa-041`, 이 task 소유 파일 NFS 와 sha256 일치, 미러 sync 는 하지 않음 — dev-041d 의 23:42 상태 그대로, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)
| 항목 | 결과(기대) |
|---|---|
| 챌린지 3파일(`challengeMetrics`+`challengeService`+`challengeRecommend`) | **51/51 PASS**(51) — fail 0·cancelled 0·skipped 0 |
| learning 17파일 | **240/240 PASS**(240) |
| `tsc --noEmit` | **rc=0, 출력 0줄**(`tests/live` 포함 — tsconfig `**/*.ts`) |
| eslint(챌린지 모듈·today·calendar·타입 3·테스트 4·라이브 도구 3·챌린지 라우트·#62 라우트) | **rc=0, 출력 0줄** |
| 보이지 않는 문자·제어문자·CR 스캔(U+200B~200F·202A~202E·2060~2064·2066~2069·FEFF·00AD·061C·180E·C0 제어, task-041 소유 25개 파일) | **0건** |
| 엔진명·`completeJson|createJob|recordTrace|@/modules/{engine,conversation,speech,admin}` grep(challenges·라우트·타입·today.ts) | **0건**, `../lessons|vocab|studyLog` import 0 |
- 구분: NFS 전체 `tsc`·다른 WP(042·043·044·010d) 최신 파일은 범위 밖이라 돌리지 않았다(미러는 23:42 sync 기준).
- 이 검토가 만든 부수 자원: 스크래치패드 `mut126`(미러 `src` 복사본 + 변이·원복·재현용 테스트 1개, 정리 불필요)·`envtest.env`. 프로젝트 파일·미러·DB 변경 0.

### 6. 범위 이탈
[확인] task-041 의 변경은 소유 경로 안뿐이다 — `challenges/**`·`today.ts`·`calendar.ts`·`complete/route.ts`·`api/v1/challenges/**`·`types/{challenge,plan,lesson}.ts`(additive 만)·테스트·`tests/live/challenge-*`. `prisma/**`·`lifecycle.ts`(diff 0)·`snapshots/`·`vocab/**`·`conversation/**`·`components/**` 는 T1 이 고치지 않았다. 작업 트리의 `snapshots/index.ts` +2줄·`vocab/sessions.ts`·`learning/index.ts` 두 줄·`qa-session.ts` 는 각각 042·DB0 소유 변경. `today.ts` 는 T1 외 변경 없음(010d 가 만질 때 T1 커밋 뒤). 데모 게이트: `DEMO_GATE_PASSED`(waived) — T1 은 화면 0.

### 7. QA 로 넘기는 `high_risk_areas`(REV-120 §6·REV-124 §5 를 갱신 — 번호 유지)
1. **실제 MariaDB 경합 — 갱신**: (a) **`POST /challenges/:id/end` × 세트 끝내기(#51, LLM 없음) 거의 동시 N회** — 매 회차 새 챌린지(단어 과제 켬), 끝난 뒤 읽기 전용 비교 `result.wordSets` == 그 주제 `StatsSnapshot(VOCAB_SESSION)` 중 `createdAt < endedAt` 수, **불일치 0**(시간이 되면 #62 수업 완료로 `lessonsDone` 도) (b) 동시 #159×2·만료 행에 동시 #158×2·#159 × #62 (c) 앱 시계 전제 읽기 확인(선택) — 오늘 만든 스냅샷 `createdAt` 이 같은 완료의 `StudyLog.createdAt`·`Lesson.completedAt` 과 수십 ms 안(MariaDB 에서도 앱 시계). QA 계정 3 직렬, 회차마다 `challenge-cleanup.ts --dry-run` 후 정리.
2. 자정·`@db.Date` 왕복(스모크 B1·C1~C4) — 그대로.
3. **스모크 M-1 수정본 첫 실행**: 체크 **28개**(분모 확인), D1a(진행 중)·D1b(끝난) 두 INFO 줄 → 완료 기준 3 의 #157 p95 는 두 값을 옮겨 적는다. 20회 중 하나라도 200·상태 불일치면 FAIL·참고치 무효.
4. #62 실값(LLM A4)·`goalMetNow` 토스트 1번·`challengeProgressAfter` 실패 시 완료 그대로 — 그대로.
5. **기존 응답 회귀 — 추가**: #58 은 `recommendTodayLesson` 분리 뒤 **기존 추천 규칙(CONTINUE·NEXT_TOPIC·START)을 단위 테스트가 가짜로 대체**했으므로 **010 라이브 스모크(65/65 기준)가 유일한 회귀 확인**. #62·#70·#71·008·011·012 스모크도.
6. `findActiveJob` 경로(`GENERATING` 수업 죽은/살아 있는 잡 — `AiJob` 행 수 불변·`Lesson` 은 `GENERATING` 유지) — 그대로.
7. QA 계정 3 직렬화·**정리 도구 범위 = 계정 3 전체**(`--dry-run` 먼저, 042·043·044·스모크·TTFA 와 동시 금지) — 그대로.
8. 테스트 격리 — 단위 전체 실행은 `DATABASE_URL` 무효 값 덮어쓰기(`.env` 가 있는 미러에서 `env -u` 는 DB 를 못 막는다).
9. TTFA 참고치는 LLM 직렬 슬롯(042 로컬 커밋 뒤, #47 `generate:false`·#53 필요) — 그대로.
10. **하위 task 인계 — 추가**: T3 목록은 `items: []`+`nextCursor` 를 처리하지 못한다(L-1, 확률 사실상 0이나 043 확인) · #71 `words.need` null 처리 · `#158.today` null · `ChallengeProgress.date` 가 어제일 수 있음 · `recommendation.reason='CHALLENGE'`. **라이브로 `dailyGoal` 을 일부러 깨뜨리는 확인은 하지 않는다**(공유 DB 에 비정상 값 — 단위가 덮음).

### 8. 확인 못 한 것
- 실제 MariaDB 에서의 병렬 경합·`createdAt` 이 엔진(앱) 시각이라는 전제의 MariaDB 직접 확인(MySQL 8.0.46 실측은 REV-124) — QA 1번.
- 스모크·정리·TTFA 의 실제 실행(금지)·`lesson.create` 필수 칸은 `tsc` 통과로만 확인.
- `LessonScreen` 토스트가 `goalMetNow` 에만 묶이는지(REV-124 `[추측]` 유지).
- NFS 전체(다른 WP 최신본 포함) `tsc`·eslint.

```json
{ "reviewId": "REV-126", "status": "PASS_WITH_NOTES",
  "issues": [
    { "issue": "T3 목록 화면이 items 가 비고 nextCursor 가 있는 쪽을 이어 읽지 못함(L-1 건너뛰기로 생길 수 있는 응답)", "severity": "LOW", "component": "src/components/challenge/ChallengeListScreen.tsx:35,67 (task-043)", "risk": "한 쪽 20개 전부 dailyGoal 깨진 끝난 행일 때만 — 실사용 확률 사실상 0", "evidence": "빈 상태 가지가 [더 보기](list.cursor)를 그리지 않음; 서버는 원래 행 기준 cursor 라 이어짐(단위 테스트)", "recommendation": "더 보기를 빈 상태 밖으로 또는 서버가 빈 쪽을 이어 읽기 + api-contract #155 한 줄" },
    { "issue": "진행 중 행 dailyGoal 깨짐 '복구 경로 없음' 평가가 API 수준에서는 부정확 — POST /end 가 ENDED 로 커밋한 뒤 응답만 500", "severity": "LOW", "component": "service.ts:126-140 · store.ts:73-78", "risk": "화면에서는 닿지 않아 갇힘 유지(이번 변경이 연 경로는 없음)", "evidence": "스크래치 재현: list/today/detail ChallengeDataError·create 409·end 후 status ENDED·activeKey null·result null·그 뒤 create 성공", "recommendation": "Leader 판단(수용·후속)에 사실 덧붙이기 + 런북 한 줄, 후속에서 응답 조립 관대화" },
    { "issue": "T-5 정적 가드가 다른 파일의 StatsSnapshot 생성을 막음(010d 역할극 스냅샷 시 주의)", "severity": "INFO", "component": "challengeService.test.ts:672-703", "risk": "의도된 가드 — 인계 필요", "evidence": "src 전체 statsSnapshot.create|createMany|upsert 는 snapshots/index.ts 에만 허용", "recommendation": "010d 인계 한 줄" } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2, "info": 4 },
  "rev124_fix_confirmed": { "endChallenge": true, "createChallenge_settle": true, "settleExpired": true, "midnight_completed_path_fixed_boundary": true, "mutation_T1_T4_fail_reproduced": true },
  "high_risk_areas": ["MariaDB 실제 병렬 /end × #51 (result.wordSets vs createdAt<endedAt)", "스모크 28체크·D1a/D1b", "기존 추천 규칙 회귀(010 라이브 스모크)", "자정·@db.Date", "#62 실값·goalMetNow", "findActiveJob 경로", "QA 계정 3 직렬·정리 범위", "T3 빈 items+cursor(043 확인)"],
  "native_change": false }
```

## QA 기록

### qa-p2a (2026-10-07 01:15~02:50 KST · LLM 0 레인 · A 항목) — `[확인]` = 이번 세션에서 실행한 것, `NOT_VERIFIED` = 못 한 것
- **환경**: 스냅샷 `git archive bd6e291` → `~/.node-local/thekaiwa-qa-p2a-src`(+ 저장소에 없는 `learning/scenarios/index.ts` 빈 스텁 1개, 아래 결함 #1) → Leader 지시(02:0x)로 `0dfb374` → `…-src2`. 미러 `~/.node-local/thekaiwa-qa-p2a`, `next dev -H 127.0.0.1 -p 3031`(APP_ENV=LOCAL), 운영 3010·M4·운영 DB 데이터 변경 0. `SINCE=2026-10-06T16:19:41Z`(01:19:41 KST). 시작 전 QA 계정 3 은 챌린지·세트·스냅샷·잡·Trace·반복 항목 전부 0행(`p2a-qa/qa-state.ts`), 종료 뒤도 전부 0행(`p2a-qa/qa-cleanup.ts`).
- **A. `tests/live/challenge-smoke.sh 3031` = 28/28 PASS**(bd6e291+스텁 1회·`0dfb374` 1회, 둘 다 28/28). 분모 28 확인. D1a #157 진행 중 p50 18ms / p95 22ms · D1b 끝난 p50 17ms / p95 20ms(20회 모두 200·기대 상태 — [설계 목표 ≤300ms] 참고치, 합격 판정 아님).
- **5초 지표 ⓐ(결정적)**: 스모크 A16 `jobs 0→0 · traces 0→0`(#155~#159·#58·#70·#71) · 보충 R 전 구간 `AiJob 0→0`(Z) · 실데이터 흐름 `jobs 0→0 traces 0→0` `[확인]`. 챌린지 때문에 더 생긴 AiJob·RequestTrace 0.
- **보충 도구 `tests/live/p2a-qa/challenge-race.ts`(QA 계정 3, LLM 0) — REV-126 high_risk 1·2**: 총 4회 실행(20·12·4·8 회차), 마지막 `0dfb374` 8회차 포함 전부 PASS.
  - **R1 `#159`(그만두기) × `#51`(세트 끝내기) 거의 동시, 오프셋 −150~+150ms, 매 회 새 챌린지·새 세트 = 총 44회 — `result.wordSets·wordsCorrect` 와 "그 세트의 `StatsSnapshot(VOCAB_SESSION).createdAt < endedAt`" 판정 불일치 0.** 반영 쪽·제외 쪽 두 분기 모두 관측(10/10 · 6/6 · 1/3 — 마지막 회는 표시 생략). 두 요청 상태 전부 200.
  - **R1c 앱 시계 전제**: 스냅샷 `createdAt`·챌린지 `endedAt` 모두 요청 시각 구간 ±50ms 안(벗어남 0회) — 앱 호스트 시계가 쓰이고 있음을 실 MariaDB 에서 확인(REV-126 §8 "확인 못 한 것" 해소).
  - 참고(Info): 반영된 경우의 `#51` 응답 `challenge` 가 **모두 null**(17/17 — Codex C2 지적 1 "완료 커밋 뒤 계산이라 동시 그만두기가 먼저면 null" 의 실측 빈도. REV-124 수용 사항과 일치). 반대로 "응답엔 진행이 있었는데 결과에서 제외"는 0회.
  - R0 순차: 첫 세트 2장 → `challenge{goalMet:false,goalMetNow:false,words:{answered:2,need:4}}` · 둘째 세트 2장 → `{goalMet:true,goalMetNow:true,words:{4,4}}`(합산, 확인 표 11a) · #158 `WORDS:DONE 4/2세트` PASS.
  - R2 동시 `#159`×3 = 전부 200·응답 동일·ENDED·`activeKey null`. R3 만료 ACTIVE 행 + 동시 `#158`×3 = 전부 200·COMPLETED 1번·`endedAt = endDate+1 00:00 KST`(`2026-10-04T15:00:00Z`)·`activeKey null`·ACTIVE 0. R4 만료 행 + 동시 [`#158`,`#156`] = 둘 다 200(409 아님)·옛 행 COMPLETED·ACTIVE 정확히 1. R5 만료 행 + 동시 [`#159`,`#158`] = `#159` **409 `NOT_ACTIVE`(COMPLETED)** · `#158` 200 · 최종 COMPLETED — 계약(`docs/design/challenge.md:926`) 그대로. R6 같은 세트 동시 `#51`×3 = 전부 200·스냅샷 1(이중 제출 멱등). `goalMetNow:true` 가 3/3 응답에 실림(같은 세트의 멱등 재호출은 같은 값 — `finish/route.ts:14` 주석 그대로).
  - 호출 소요(dev 모드·NAS DB, 동시 실행 구간, 참고치): `#156` p50 0.6~0.7s · `#47(generate:false)` p50 0.5~0.6s · `#51` p50 1.3~2.0s / p95 4.9~6.1s · `#159` p50 0.9~1.3s / p95 2.8s.
- **계약 확인(Info)**: `docs/design/api-contract.md`(bd6e291) 에는 #155~#159 줄이 없고 `docs/design/challenge.md §` 에만 있다 — 문서 갱신(C17) 몫.
- **NOT_VERIFIED(LLM·실기기 레인으로)**: `#62` 수업 완료와의 경합·수업 `goalMetNow` 토스트 1번·`challengeProgressAfter` 실패 시 완료 그대로(실패 주입 필요) · `findActiveJob`(GENERATING 죽은/살아 있는 잡) 경로 · `#58` 기존 추천 규칙(CONTINUE·NEXT_TOPIC·START) 회귀 = **010 라이브 스모크(65/65 기준)는 A4 LLM 을 써서 실행하지 않았다** · TTFA 참고치 (가)(나) · 시각 23:59/00:01 실시간 경계(스모크가 DB 로 심은 값만 확인 — B1·C1~C4 PASS).
- 층·import·`tsc`·`eslint`·단위는 G 항목: `bd6e291`+스텁 기준이 아니라 **`0dfb374` 스냅샷**에서 실행 — 1846 중 1844 통과·실패 0·건너뜀 2(components+types+modules 158파일), `tsc --noEmit` rc=0, `eslint .` 0 오류·5 경고(기존 settings·admin 컴포넌트).
- **[결함 #1] High → 해소(Leader `0dfb374`)** — `src/modules/learning/index.ts:60` `export * from './scenarios'` 인데 커밋 `bd6e291` 트리에 `src/modules/learning/scenarios/` 가 없었다(010d 미커밋, 작업 트리에만 untracked). 재현: `git archive bd6e291` 클린 복제에서 `tsc --noEmit` → `TS2307: Cannot find module './scenarios'`(그 한 줄뿐), `next dev` → `Module not found: Can't resolve './scenarios'`(`@/modules/learning` 를 쓰는 라우트 전부 영향) / 기대: 커밋 단독으로 빌드·기동 / 원인: DB0 가 `learning/index.ts` export 2줄을 먼저 넣고 `scenarios/` 는 010d 커밋으로 미룸. **`0dfb374` 스냅샷에서**: `tsc` rc=0 · `next build`(별도 미러 `~/.node-local/thekaiwa-qa-p2a-build`, 하드링크 복제 + `.next` 제외·쓰기 파일 링크 끊음) **rc=0**(`Compiled successfully in 5.5s`, 정적 16쪽, `/api/v1/challenges{,/[id],/[id]/end,/today}`·`/api/v1/scenarios{,/[id]}`·`/plan/challenge/[id]`·`/plan/challenge/new`·`/plan/challenges` 라우트 생성, 경고 3건은 `persona/loader.ts:97·102` "Dynamic filesystem access" 기존 항목). 권고: push 전 "클린 체크아웃 tsc"를 커밋마다 돌릴 것(부분 커밋에서 export 만 먼저 들어가는 경우를 잡는다). `bd6e291` 자체의 `next build` 는 실행하지 않았다(tsc·dev 로 실패가 이미 확정, 수정본이 `0dfb374`).
- 환경 정리: 위 미러 폴더(`thekaiwa-qa-p2a`·`-src`·`-src2`·`-build`·`-oldnext`·`-newnext1`)는 `rm -rf` 가 막혀 그대로 둠 — 사용자 정리 대상.

<!-- qa-p2b-start -->
### qa-p2b (2026-10-07 07:55~ KST · LLM 레인 · 최종) — `[확인]` = 이번 세션에서 실행한 것, `NOT_VERIFIED` = 못 한 것
- **환경**: 스냅샷 `git archive b7843ee`(HEAD) → `~/.node-local/thekaiwa-qa-p2b-src`(+ 새 QA 도구 `tests/live/p2b-qa/` 복사) · 미러 `~/.node-local/thekaiwa-qa-p2b`(qa-p2a 미러를 `rsync --link-dest`로 복제, `.next`·`.prisma` 제외 → `prisma generate`) · `next dev -H 127.0.0.1 -p 3032`(APP_ENV=LOCAL), 운영 3010·M4 쓰기·운영 DB 데이터 변경 0 · `SINCE=2026-10-06T22:55:57Z`(07:55:57 KST) · QA 계정 3 시작 상태 전 행 0.
- **도구(새, 저장소 `tests/live/p2b-qa/`)**: `challenge-lesson-live.ts`(R1·RI·RR·RD) · `trace-probe.ts`·`trace-lag.ts`(읽기 전용 Trace 점검) · `qa-sync.sh`. 소스 수정 0.
- **B. T1 LLM 항목 (REV-120 §6 4·6 · REV-126 §7 4·6) — `challenge-lesson-live.ts all` 18/20(실패 2건 = 내 스크립트 로그 읽기 경합 + A4 생성 실패, 제품 결함 아님) + `dead-check` 4/4 + `race-real` 2/2**:
  - **R1 실제 A4 수업 + 챌린지 `[확인]` 전부 PASS**: 챌린지 생성 후 #158 단어 TODO·수업 TODO → #59 → **생성 중 #158·#157 43회 폴링 중 42회가 `GENERATING`(jobId 일치)·AiJob 행 수 불변·`Lesson` GENERATING 유지·잡 행 FAILED 로 안 닫힘**(살아 있는 잡 경로) → READY → 단어 세트 4장 #51 `challenge{goalMet:false, goalMetNow:false, words{4,4}}` → 수업 진행·**#62 완료 200 — 응답에 `challenge` 키 있음, `{goalMet:true, goalMetNow:true, words:null, challengeId·date 일치}`(이 수업이 달성을 채움 → 토스트 1번)** → 두 번째 #62 **409**(`challenge` 키 없음) → #158 수업 DONE·goalMet → 달성 뒤 세트 `goalMet:true·goalMetNow:false`. #62 전후 AiJob 행 1→1(A11 REVIEW_DECISION 없음 — QA 계정 3 는 공부한 날 1일 → 가드 미통과). A4 생성 87.9s(아래 A4 관측 참조).
  - **RI `challengeProgressAfter` 실패 주입 `[확인]`**(LLM 0, R1 수업 내용을 복제한 수업 행 · QA 행의 `dailyGoal` 을 `{broken:true,lesson:'x'}` 로 깨뜨림): **#62 200·`challenge:null`(키는 있음)·수업 DONE·StudyLog 1·LESSON 스냅샷 1**(완료는 되돌려지지 않음) · 복구 뒤 #158 정상(수업 DONE·goalMet true)·#159 200. 서버 로그에 `[challenges] 진행 중 챌린지의 dailyGoal 형태가 올바르지 않습니다: <행 id>` **한 줄**(스택·원문 없음 — dev 로그 줄 152 직접 확인). **스크립트의 RI2 FAIL 은 내 스크립트의 로그 즉시 읽기 경합**(dev 로그가 응답보다 늦게 flush)이라 스크립트를 "3초까지 기다림"으로 고쳤다(어설션은 그대로) — 이번 실행의 사실 판정은 위 줄 직접 확인으로 PASS. **쿼리 오류 주입(DB 단절 등)은 `NOT_VERIFIED`**(코드 수정·DB 권한 조작 필요 — 단위 테스트 몫, 라이브 불가).
  - **RR `#62` × `#159` 경합 `[확인]` — 복제 수업 12회(오프셋 end 시작 −150~+1500ms) 불일치 0**: `result.lessonsDone == (LESSON 스냅샷 createdAt < endedAt)`·ENDED·`activeKey null`·수업은 항상 DONE·LESSON 스냅샷 존재·HTTP 24건 전부 200. 반영 11 · 제외 1(−150ms). 거짓 토스트 0(응답에 진행이 있었는데 결과에서 제외된 경우 0). **참고(Info, REV-124 수용 사항의 실측)**: 반영됐는데 응답 `challenge` 가 null 인 경우 **5/11**(end 시작 오프셋 +0~+450ms 구간 = 그만두기가 완료 커밋 뒤 첫 SELECT 앞에 끼어든 경우 — 토스트만 못 뜨고 데이터는 정합). 복제 수업은 R1 에서 생성된 A4 수업 본문을 DB 로 복사한 것(`LLM 0`) — 실제 A4 수업 1건 경합은 `all` 의 RR4 가 A4 생성 실패로 못 돌아 `race-real` 모드로 다시 돌렸다: **RR4 A4 DONE 55.5s · RR5 `#62` × `#159`(+400ms) 둘 다 200·수업 DONE·`result.lessonsDone = 1` = 스냅샷 규칙(반영)·응답 `challenge` null(REV-124 수용 사항) PASS** `[확인]`.
  - **RD `findActiveJob` 죽은 잡 경로 `[확인]` 4/4 PASS**(실제 A4 잡을 건 직후 dev 서버 프로세스 그룹 kill → 잡 RUNNING·레슨 GENERATING 상태로 서버 재기동): ① 재기동 직후(잡 나이 20s <5분) #158 = `GENERATING`·jobId 일치·AiJob 행 수 불변·잡 행 그대로 → **죽은 잡도 5분(LESSON_GEN `staleAfterMs`)까지는 "만들고 있어요"로 보인다(Info·설계 범위 — 화면이 최대 5분 "생성 중"을 보여 줌)** ② 잡 행 `createdAt·startedAt` 을 6분 전으로 되돌린 뒤(QA 행) #158 = `FAILED`·jobId null·**AiJob 행 수 불변**·잡 행 `FAILED('stale')` ③ **`Lesson` 행은 GENERATING 그대로**(챌린지 경로가 Lesson 을 쓰지 않음) ④ #157 도 FAILED·다시 불러도 잡 행 추가 쓰기 0(`finishedAt` 불변).
- **A4 관측(참고치 — 서버 로그 줄 기준, 통계 아님)**: 이 QA 창에서 A4(`lesson`, sonnet) 수업 생성 6건(R1·RR4 1차·상황 수업 F·010 스모크 주제/붙여넣기·`race-real`, dead-start 는 kill) 중 **첫 시도 `[json] 1차 응답 계약 위반 → 재시도` 가 4건**(`/quiz/3/choices: 항목 수 4개 초과`·`speaking[1].targetIds 가 chunks·grammar id 에 없다`·`JSON 파싱 실패` ×2) · 구문 슬립 자동 복구(`ROOT_CLOSE`) 1건 · **최종 레슨 FAILED 1건**(RR4 1차 — 주말 계획/N4, 1차 `JSON 파싱 실패` → 재시도 `JsonSchemaError` → 75.2s 후 FAILED, 같은 주제를 `race-real` 에서 다시 하자 55.5s 에 DONE). 생성 시간: 첫 시도 성공 37.4s·55.5s(`race-real`)·재시도 포함 78~88s. 챌린지·상황 수업 변경이 만든 일이 아니라(챌린지 경로는 A4 요청을 바꾸지 않음) **기존 A4 신뢰도 이슈의 재현** `[가능성 높음]` — 단, 챌린지 카드의 `FAILED`·[다시 만들기] 경로를 실제 사용자가 밟을 빈도는 이 비율에 직접 달려 있다(Leader 판단: prompt-engineer 의 lesson 신뢰도 후속 task 로 넘길지).
- **E. TTFA·지연 참고치 `[확인]`(참고치 — dev 모드·NAS DB·M4 TTS 실제·같은 서버 예열 `warm=HIT`, 합격 판정 아님)**: `bash tests/live/challenge-ttfa.sh 3032 8 both`(스냅샷 코드, TEXT 턴, **조건당 n=8, 총 32턴**, 분당 12턴 간격 5.5s):
  | 시나리오 | 조건 | n | TTFA p50 | TTFA p90 | 턴 p50 | 턴 p90 |
  |---|---|---|---|---|---|---|
  | (가) 오늘 탭 진입 직후 | 챌린지 없음 | 8 | 1.79s | 2.63s | 4.72s | 5.67s |
  | (가) | 진행 중 | 8 | 1.27s | 2.11s | 3.41s | 4.92s |
  | (나) 주제 세트 끝낸 직후 | 챌린지 없음 | 8 | 1.05s | 1.53s | 3.75s | 4.72s |
  | (나) | 진행 중 | 8 | 1.10s | 3.17s | 3.16s | 5.85s |
  - **진행 중 − 없음 TTFA p50 차이: (가) −0.52s · (나) +0.05s**(설계 목표 ≤ +0.3s 이내 — 단 n=8 이라 노이즈 범위, 판정 아님). **32턴 합산 TTFA p50 1.34s / p90 2.29s / p95 2.63s · 턴(done) p50 3.82s / p90 5.59s / p95 5.67s**(= 회화 30턴 참고치 대용). 이상치 1건: 진행 중/(나) #4 TTFA 3.17s.
  - **한계(중요)**: **A11(오늘 탭 진입 직후 DAILY 배치 판단 잡)이 32턴 중 한 번도 안 걸렸다**(시작 0/16·턴 시점 실행 중 0/32) — QA 계정 3 가 최소 기록 가드(공부한 날 2·항목 2)를 못 넘겨서 → **"A11 과 겹친 TTFA" 는 이번에 측정 못 함(`NOT_VERIFIED`)**. 위 값은 A11 이 없는 조건. 계정 3 에 다른 날 공부 기록을 DB 로 만들어야 한다(Leader 결정 — 실데이터 아님).
  - `task007-latency` 는 **실행하지 않음**: gateway WS(운영 127.0.0.1:8100)·운영 앱 콜백이 공유 DB 에 발화 행을 만드는 경로라 "TEXT 경로만·운영 접촉 금지" 지시와 충돌 — TEXT 턴 지표는 위 `challenge-ttfa` 32턴이 대신한다.
  - **오염 점검**: 측정 구간 `claude --print` 프로세스를 3초 간격 112회 표본 — 전부 내 서버(3032)의 프로세스 1개(PPID = 내 next-server). 앞서 07:58 에 3033 서버에서 보고 Leader 에 알린 프로세스는 **예열 풀의 유휴 프로세스**였을 가능성이 높다(`ps -o time` 이 00:00:00·CPU 1%, 내 서버의 예열 프로세스도 같은 모양) `[가능성 높음 — 그 시각 CPU 시간은 확인 안 함]` → 1차 알림("LLM 슬롯 겹침")은 과잉일 수 있음. 어쨌든 겹침 후보 구간(07:58~08:03)의 A12 지연(6.8~6.9s)은 겹치지 않은 구간(6.8s)과 같았다.
- **C. 기존 추천 규칙 회귀 `[확인]` — `task010-smoke.ts`(미러 코드, 내 서버 3032, QA 계정 1·2): 64/65 PASS, 실패 9d 1건 = task-039 QA 의 알려진 실패와 같다(제품 회귀 아님)**:
  - 통과: #56 주제·#58 오늘(START → 끝낸 뒤 **CONTINUE + nextPreview**, 기존 추천 규칙 CONTINUE·START 라이브 회귀 확인)·#59 생성·재요청·409·타 사용자 404·#60 상세·진행·메모·말하기·오디오(합성 892ms, 재요청 캐시 51ms)·**#62 완료 한 트랜잭션(StudyLog 1·LESSON 스냅샷 1·DAILY +1·RepetitionItem 11)·중간 실패 전부 롤백·두 번째 완료 409**·붙여넣기 생성/완료 경합(200 하나·409 하나)·엔진명 0. 지표: A4 주제 수업 83.3s(attempts 2)·붙여넣기 46.1s·메모 3.1s·첫 소리 2.9s. (NEXT_TOPIC 은 이 스모크가 안 건드림 — 라이브 `NOT_VERIFIED`.)
  - **9d 실패 원인(이번에 직접 확인)**: 어설션이 `reviewDecisionJobId === null`·`nextReview === null` 을 요구하는데, **QA 계정 1(`qa-bot`)에 이전 QA 가 남긴 2일치 DAILY 학습일(2026-10-03·10-05)이 있어 오늘 수업 완료로 학습일이 3일 → A11 최소 기록 가드(공부한 날 ≥2·항목 ≥2) 통과 → REVIEW_DECISION 잡이 걸린다**(서버 로그에 `task=reviewDecision` 호출 1건 19.1s, 같은 계정의 `AiJob REVIEW_DECISION` 이력 10건 — 이전 QA 분 포함). 스모크의 시작 정리(`wipe`)는 오늘 치만 지우고 과거 DAILY 는 두므로 "시작 정리 규칙이 잔여를 지우면 통과"라는 가설은 **반증**됨. 챌린지·상황 수업 변경과 무관. **[결함 #4 Low · 테스트 환경 의존]** `tests/live/task010-smoke.ts:354` 가 계정의 과거 학습일에 의존 — 권고: 스모크가 시작 때 계정 1 의 과거 DAILY 를 백업 후 제외하거나 어설션을 "가드 미통과일 때만 null" 로(어설션 완화가 아니라 전제 고정은 Developer/prompt-engineer 판단). 계정 1 의 과거 DAILY 는 이전 QA 가 만든 행이라 이번에 지우지 않았다.
- **참고(Info) `[router] LLM connection=home-m4-lan 실패(LlmMisconfiguredError) — 다음 후보`**: LOCAL 환경에서 `wordEnrich`(010 스모크의 단어 보강) 가 home-m4-lan 연결 오설정 후 다음 후보로 폴백 — 호출은 성공(`task=wordEnrich haiku 2.9s`). 이번 변경과 무관한 LOCAL 설정 상태.
- **G. 정리 `[확인]`**: QA 계정 3 의 `SINCE`(07:55:57 KST) 이후 행 전부 삭제 — 스냅샷 1·학습 관측 85·반복 항목 5·Trace 32·챗 방 1(`p2b-qa/final-clean.ts`, 시작 전 계정 3 은 전 행 0 이었음) → **종료 상태 계정 3 전 행 0**(`qa-state.ts`). 계정 1(`qa-bot`) 에는 task010 스모크가 남긴 A11 잡 2·Trace 2·관측 16 삭제(`clean-acct1.ts`); 계정 1·2 의 `p2cA-fixture` 채팅 방 2개(07:07 KST)는 **qa-p2c-A 의 것이라 그대로**(내 010 스모크는 계정 1·2 의 레슨·잡·기록을 지우는 도구지만 챗 방은 안 지움). `TtsCache` 64건(SINCE 이후)은 내용 해시 캐시라 사용자 귀속이 없어 **삭제하지 않음**(운영과 같은 캐시 키 공간 — 30일 정리 대상, 실사용자 행과 구분 불가). `EngineMetricsDaily` SINCE 이후 0건(`p2a-qa/qa-cleanup.ts --dry-run`).
  - **프로세스 정리**: dev 서버 3032 종료(프로세스 그룹 kill)·`ss -ltn` 포트 비움·내 `claude` 잔여 0·`claude` 감시 루프 종료. 3033 은 qa-p2c-A 서버 — 내 것이 아님. **산출물 정리**: 스크린샷 14개 + 폴더 삭제(`/tmp/qa-artifacts/TheKaiwa/qa-p2b`)·쿠키 3개 삭제·스냅샷/미러의 `.env` 사본 삭제(파일 단위). **폴더 삭제 목록(재귀 삭제 명령이 훅으로 막혀 그대로 둠 — 사용자 정리 대상)**: `~/.node-local/thekaiwa-qa-p2b`(미러, 하드링크 복제 — 삭제해도 p2a 미러에 영향 없음)·`~/.node-local/thekaiwa-qa-p2b-src`(스냅샷 `b7843ee`).
- **새 도구 `tests/live/p2b-qa/`(소스·프롬프트 수정 0, 기존 도구는 수정 안 함)**: `challenge-lesson-live.ts`(R1·RI·RR·RD·`race-real`) · `challenge-today-live-ui.ts`(d·limit·f·cancel) · `a12-overlap-ttfa.ts` · `today-touch-probe.ts` · `trace-lag.ts` · `trace-probe.ts` · `final-clean.ts` · `clean-acct1.ts` · `qa-sync.sh`. **함정(다음 QA 용)**: ① `qa-sync.sh`/`sync-local.sh` 가 `tutor.md` 를 매번 복사해 dev 서버가 HMR 되며 **서버 메모리 값(하루 시도 `attemptsByDay`·생성 중 표시)이 초기화**된다 — 상한 시험은 동기화 직후 한 번에 ② `task010-smoke.sh`·`task007-latency.sh` 는 `cd ~/.node-local/thekaiwa`(공용 개발 미러)로 고정돼 있어 HEAD 스냅샷 미러에서는 `.sh` 를 쓰지 말고 `.ts` 를 직접 실행해야 한다 ③ tsx(esbuild keepNames)로 `page.evaluate` 에 이름 있는 함수를 넘기면 `__name is not defined` — `page.addInitScript('window.__name=(f)=>f')`.
<!-- qa-p2b-end -->

## 배포 기록
<!-- Phase 2 일괄 배포 때 deployer 가 RELEASE_RESULT 근거로 기록. -->


## Codex 검토

### [2026-10-06 14:20] C2 adversarial-review focus=concurrency — done
- judge 판정: R2 · developer=opus · track=standard · Codex 개입 C2(Reviewer PASS 직후) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a701(task_file) snapshot=af9cfed
- 지적 2건:
  - [medium] src/modules/learning/challenges/progress.ts:25 — 완료 트랜잭션 커밋·사용자 잠금 해제 뒤 `challengeProgressAfter` 실행 vs 동시 그만두기/만료 전이 경합 → 달성한 완료 요청이 응답에서 challenge=null(또는 goalMetNow 누락)·기록에는 완료 반영 불일치 (권고: progress 재계산이 ACTIVE만 보지 말고 방금 종료된 챌린지도 포함, 또는 완료 커밋 직후 동일 트랜잭션에서 상태·스냅샷 재읽기로 응답 값 확정)
  - [medium] src/modules/learning/challenges/settle.ts:28 — 앱 서버 `now()` vs MariaDB `CURRENT_TIMESTAMP`의 시계 불일치·`finishChallengeTx` 의 `createdAt < endedAt` 조건 → 완료된 스냅샷이 종료 이력에 영구 누락·불변 result 에서 복구 불가 (권고: 종료 경계를 DB 시계에서 얻거나 사용자 잠금 획득 뒤 DB CURRENT_TIMESTAMP 읽어 사용)
- 검토하지 못한 범위: 실 MariaDB에서의 동시 요청 경합 재현 · MariaDB와 앱 서버 실제 시계 오차 측정 · p95 성능 및 잠금 대기 시간 · UI·대화·TTS 변경(도메인 밖)
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T142037Z-task-041-C2/raw.txt

## 최종 요약

## Leader 기록 (Phase 2 일괄 접수·결정, 2026-10-06 22:45)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev): risk=R1 · developer=opus · track=standard · demo=delta(JV-ui_change) · 결과 JSON `/tmp/judge-task-041-intake.result.json`. **Leader 위험 보정**: R1→**R2 로 상향**(API 5개·공유 응답 additive·지표 계산·스냅샷 읽기 — 계획서 WP 위험 R2)
- **데모 승인 생략 지시**: 사용자(2026-10-06) "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". 승인용 데모는 만들지 않고 designer 가 **구현 가이드**를 낸다. `check.mjs waive` 는 이 문장을 인식하지 못해(정규식: "데모" 바로 뒤 생략/없이) **정식 waive 기록은 없다** — 훅은 warn 단계라 막지 않는다.
- **`## Leader 확인 필요` 처리(Leader 결정)**: ① **스키마는 WP-DB0 단일 작성자**(`task-p2-db0-schema`) — 설계서 §11-1·§11-2 의 "T1 이 D1·D2, T2 가 D4·D5 를 쓴다" 문구는 이 결정으로 대체 ② **`src/types/plan.ts`·`src/types/lesson.ts` 와 plan/calendar·plan/day·lessons/today 라우트의 additive 변경(`challenge?`·`reason: 'CHALLENGE'`)은 T1 소유**(타입만 늘리는 변경 — T3·T4 는 소비만) ③ **`topics/pool.ts` 는 T2 가 만들되 base(B1 풀·`lessonExprCount`)를 가장 먼저 로컬로 내놓고, T1 의 `topicProgress` 는 그 뒤에 한다**(T1 의 다른 부분은 선행 가능) ④ PE 산출 파일 구성: 현재 PE 는 스키마를 `prompts/topicWords.ts` 안에 둔다 — 설계서의 `structuredResponse/topicWordsSchemas.ts` 분리와 다르지만 `schemas.ts`·`checks.ts`(task-039 구역)를 피하는 목적은 같아 **PE 구성을 따른다** ⑤ A12 레인은 **interactive**(사용자가 기다리는 호출 — 설계서 v2.3 따름, 계획서 batch 문구는 정정) ⑥ `components/lesson/LessonScreen.tsx`·`LessonEnd.tsx` 의 #62 `challenge?` 토스트는 **T4 소유**(010d-B 가 같은 `LessonEnd.tsx` 를 나중에 만진다 — T4 커밋 뒤) ⑦ QA 계정 3 은 T1→T2→T4(→T3) 순으로 **직렬**(같은 계정에 챌린지 행 1개만 가능).

## Leader 확인 필요
설계서·계획서·지시문이 서로 어긋나거나 비어 있어 이력서 작성자가 정하지 않은 항목이다.

1. **스키마 소유 문구 불일치.** 설계서 §11-1 직렬 고리 ①·§11-2 가 "T1 이 `schema.prisma` 에 D1·D2 를 쓰고 커밋 → T2 가 D4·D5" 로 적은 반면, 지시문과 계획서 §2 C1 은 DB0 단일 작성자다. 이 이력서는 후자를 따랐다(T1 은 스키마 무수정). `docs/design/challenge.md` §11-1·§11-2 문구 정정은 정본이라 Leader 몫(C17).
2. **설계서 T1 파일 목록 밖의 공유 파일.** #70·#71 응답에 `challenge?` 를 더하려면 `src/types/plan.ts`(설계서는 T3 소유로 적음)를, #58 `reason` 에 `CHALLENGE` 를 더하려면 `src/types/lesson.ts`(지금 `reason: 'CONTINUE' | 'NEXT_TOPIC' | 'START'`, `types/lesson.ts:66`)를, #62 `challenge?` 타입도 같은 곳이 필요해 보인다. 라우트 `src/app/api/v1/plan/{calendar,day}/**`·`lessons/today/route.ts` 가 pass-through 인지도 확인하지 않았다. T1 이 additive 타입 줄을 먼저 쓰고 T3·T4 가 그 뒤에 만지는지, 다른 규칙인지 정해 주세요.
3. **`topics/pool.ts` 소유와 T1 선행.** 설계서 §10-1 은 `challenges → ../topics/pool` 로 수업 표현 수(`lessonExprCount`)·표현 진행을 읽게 하는데, `pool.ts` 는 T2 의 신규 파일이다. §11-2 T1 선행 칸은 "새 단어 진행(`aiWord*`)만 T2 상수 머지 뒤"라고 하지만 `lessonExprCount`·기본 표현 쪽도 pool 에 의존해 보인다. T2 가 `pool.ts` 골격(타입·출처 상수)을 먼저 로컬 커밋할지, T1 의 `topicProgress` 를 두 단계로 나눌지 정해 주세요.
4. **QA 계정 3 은 새 계정이라 A11 가드 이력이 없다.** 참고치 (나) 는 "공부한 날 2·항목 2 이상" 계정이 필요한데 준비 방법·주체가 설계서에 없다. (가) 반복용 `REVIEW_DECISION` AiJob 정리 절차는 "T1 테스트 도구에 둔다"고만 적혀 있다 — developer 가 만들지 QA 가 준비할지 확인.
5. **QA 라이브 항목 이관.** 설계서 §11-2 T1 QA 열의 "push 전 스키마 diff = D1·D2·D4·D5 뿐" 은 스키마를 DB0 가 쓰게 되면서 DB0·Leader 몫이 됐다. T1 QA 에서는 기록 존재 확인만으로 두었다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-06 22:11 |
| - | 생략 | - | - | "데모 생략하고 진행해줘" | 10-06 23:43 |

## Leader 기록 (DB0 통합 `db push` 완료, 2026-10-06 22:17)

- **사용자 승인**: AskUserQuestion 2026-10-06 "DB 구조 변경 전부 승인". Reviewer REV-118 PASS_WITH_NOTES(승인 목록 9문장 1:1 일치·승인 밖 0·운영 공존 안전).
- **실행 순서(체크리스트 1~6 준수)**: ① 감사한 5파일 sha256 앞 16자·`git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 그대로 확인 ② **백업** `files/thekaiwa/backups/thekaiwa-20261006-221627-pre-p2db.sql.gz`(600, 227,836 B, "Dump completed on 2026-10-06 22:16:31", 53개 표) ③ **`migrate diff` 재실행**(`--from-schema-datasource` → 파일): 9문장·sha256 앞 16자 `66c04634550da524`(검토본과 동일)·삭제/경고/이름 변경 0 ④ **`prisma db push --skip-generate`**(`--accept-data-loss` 없음) 22:17:00~22:17:42 rc=0 "Your database is now in sync" ⑤ **검증**: `migrate diff` 재실행 = "This is an empty migration"(드리프트 0) · `information_schema`: `Challenge` 16칸·FK 2(`userId`·`topicId`)·인덱스 `activeKey` 유니크 + `(userId,status,startDate)` + `(userId,endedAt)` · 새 칸 10개 존재(`Correction.extraNoteKo`·`EngineMetricsDaily` 6·`VocabAttempt.refType/refId`·`VocabSession.topicId`) · 행 수 Correction 7·VocabSession 6·Challenge 0 · 운영 `/api/health` success·`status:ok`·`degraded:[]` · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online restarts 0(로그의 Prisma 오류 줄은 10-06 00:17 의 기존 `[jobs]` 줄 — push 와 무관) ⑥ 메인 미러 `prisma generate` 완료.
- **SQL 소속 task**: `Correction.extraNoteKo` = task-039 · `EngineMetricsDaily` 6칸 = task-012b-3 · `VocabAttempt.refType/refId`·`VocabSession.topicId`(+인덱스·FK) = task-042 · `Challenge` 표(유니크 1·인덱스 2·FK 2) = task-041. 이 push 로 **네 task 의 DB 선행이 충족**됐다(운영 코드는 추가분을 select 하지 않으므로 영향 없음).
- 복구 1순위: 새 칸·표만 역순으로 되돌리기(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸). 백업 전체 복원은 공유 DB 전체 되돌림이라 최후 수단.
- 이후: `git push` 는 사용자 지시대로 **전부 끝난 뒤 한 번** — 커밋은 pathspec(`git add -A` 금지).

## 상태 정리 (2026-10-10)

- 상태 `todo` → `done`. 사용자 승인(2026-10-10 「2번 승인하고 진행해줘」) — Leader. 근거는 상태 감사 2건(읽기 전용) 결과를 Leader 가 일부 직접 대조한 것이다.
- 챌린지 코어(`Challenge` 서버). 완료 기준 6/6 충족: 스모크 28/28, `#159`×`#51` 경합 44회 불일치 0, LLM 레인 `challenge-lesson-live` 18/20(실패 2건은 스크립트·A4 생성 실패, 제품 결함 아님), dead-check 4/4, race-real 2/2. 감사 REV-120·124·126, Codex C2 2건 판정. Phase 2 릴리스에 포함.
- NOT_VERIFIED: 실시간 자정 경계, A11 과 겹친 TTFA(QA 계정 3이 가드를 못 넘김), `NEXT_TOPIC` 라이브. 010 스모크 9d 실패는 낡은 기대값(제품 결함 아님).
- 챌린지 정본 5종 미반영(`domain-model.md` 의 `Challenge` 엔티티 정의·`api-contract.md` 의 `/api/v1/challenges` #155~#159·`module-dependency.md` 의 `challenges/`) — 이 task 만의 일이 아니라 챌린지 전체의 문서 부채로 ACTIVE 백로그에서 추적한다.
