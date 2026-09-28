---
task_id: task-010b
title: "반복 학습 — RepetitionItem 3경로·LearningObservation 기록·A11 복습 판단(3~7일)·오늘의 복습·A5 복습 레슨"
status: doing
base_ref: 98d8cac
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, codex, qa, deployer]
related_tasks: [task-010-today-lesson, task-008-vocab-today-words, task-006-chat-correction]
tags:
  - type/task
  - domain/learning
  - domain/repetition
  - domain/prompt
  - domain/ui
  - domain/db
aliases:
  - 반복 학습
  - 오늘의 복습
  - task-010b
created: 2026-09-28
updated: 2026-09-28
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-010b-repetition-v1.html"
  artifact_url: "https://claude.ai/artifact/WtuZFyoPu2PbkJuzMGusJx"
  content_sha256: "dcd310bf3d45a946bad50deff0e59ddec8703bd4086edda8967224293553b02e"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
강사가 3~7일 사이에서 복습 시점을 정하고(A11), 코드는 범위·기록·추출·폴백을 맡는 반복 학습을 연다. 오늘 탭에 "오늘의 복습" 카드(근거 한 줄)를 띄우고, 사용자가 시작하면 A5 복습 레슨(레슨 화면 재사용)으로 공부한다. 동시에 학습 관측(`LearningObservation`)을 append-only 로 기록해 A11 판단 근거로 쓴다(능력 축 계산·표시는 Phase 3).

완료 기준(design-spec §15 010b 행 · §7-4 · learning-personalization §2-2·§2-5):
- `RepetitionItem` 등록 3경로: 레슨 완료(task-010 에 있음) + **교정 채택**(`Correction` 채택 트랜잭션 안, `refType='Correction'`, `feedbackCount+1`) + **단어 세트 finish**(`refType='WordEntry'`, 정오답 반영) — 각 경로의 기존 트랜잭션 안에서, 행 수 대조
- `feedbackCount ≥ 3` 또는 강사 지정 → `priority=FOCUS`, FOCUS 는 `intervalDays ≤ 3` 강제
- A11 `REVIEW_DECISION`(sonnet 60s, 잡·batch): 완료 트랜잭션 **뒤** enqueue + 하루 첫 진입 재판단(하루 1회), 코드 후검증(3~7 클램프·FOCUS ≤3·누락 → 3일 폴백·입력에 없던 id 폐기), 실패·타임아웃 → `decidedBy=FALLBACK`
- 최소 기록 가드: 학습일 2일·재료 2건 미만이면 복습을 열지 않음(#58 `guard`)
- 균등 랜덤 추출: due 항목 `weight = 1/(1+studiedCount) × (FOCUS?2:1)`, 최근 3세션 노출 ×0.5, 비복원·seed 저장, 세션 크기 = `dailyMinutes` 환산(15분 → 6~8)
- `ReviewSchedule(DUE, itemIds, seed, decidedBy, tutorRationale)` → #58 `review` · #63 start(A5 잡, `chunks ⊆ mixSpec` 후검증·1회 재시도) · #64 skip · 복습 레슨 완료 시 `ReviewSchedule DONE` + 항목 `studiedCount+1`
- `LearningObservation` 기록(아래 L3), 원문·오디오 복제 없음(`refType/refId` 만)
- 3폭 잘림 0, 엔진명 0, 타 사용자 404

## 사용자 결정·지시
- D5(2026-09-28 AskUserQuestion): "관측 기록만 Phase 2 (Recommended)" → `LearningObservation` 은 이 task, `LearnerSkillState` 는 Phase 3.
- 2026-09-28 사용자: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘".
- **DB 스키마 추가(`LearningObservation` + enum 3종) 는 운영 공유 DB `db push` 라 사용자 승인 후 적용**(Leader 가 다른 Phase 2 데모 승인 요청과 묶어서 요청). 승인 전에는 스키마 파일·코드·단위 테스트까지만.

## 관련 과거 이력 요약
- [[task-010-today-lesson]]: `learning/repetition.registerRepetitionItems`(레슨 경로, refType `TopicChunk`/`Expr`/`Grammar`, 상한 12, `nextDueAt=오늘+3`, `decidedBy=FALLBACK`) — 이 task 가 교정·단어 경로에서 재사용. REV-028 L2: 비일괄 쓰기 — 호출 규모 커지면 재검토. #58 은 `review:null, guard:null` 로 비워 둠, #62 응답 `reviewDecisionJobId:null`. 레슨 화면(5단계)은 task-010 에서 구현 중 — REVIEW 레슨도 같은 화면.
- [[task-008-vocab-today-words]]: 세트 finish 단일 트랜잭션(여기에 RepetitionItem·관측 추가). [[task-006-chat-correction]]: 교정 채택 트랜잭션(`acceptCorrection`, `recordCorrectionAccepted`, `LearnerErrorStat`).
- A4 `lesson@v2` 교훈(PE): "출력 서브셋 ⊆ 입력 풀" 요구는 공통 규칙 문구 + 결정적 보정(`repairLessonResponse`)으로 — **A5 `chunks ⊆ mixSpec` 도 같은 패턴 재사용**([[llm-japanese-quality]] §8).

## Leader's Plan (2026-09-28)

### 범위 결정
- **L1 스키마(승인 후 push)**: domain-model §9-2 의 `LearningObservation` + `ObservationKind`·`ObservationOutcome`·`SkillAxis` enum 을 §3 본문으로 승격(`EXPRESSION_REUSE` 도 learning-personalization §2-2 에 있으니 enum 에 포함). `LearnerSkillState` 는 만들지 않는다. `ReviewSchedule`·`RepetitionItem` 은 이미 정본대로(변경 없음).
- **L2 A11 입력**: due·후보 `RepetitionItem` ≤40건(`nextDueAt ≤ 오늘+1` 우선, 그다음 FOCUS·오답 많은 순) + 학습자 헤더 ≤600 + 최근 관측 요약(코드 집계: 축별 성공/실패 수 최근 14일, 원문 없음) + `LearnerErrorStat` top5. 출력 계약 design-spec §8 A11 행 그대로.
- **L3 관측 기록(Phase 2 범위)**: 단어 세트 finish → 카드별 `VOCAB_RECOGNITION`(정답 SUCCESS·오답 FAIL·건너뜀 SKIPPED) / 교정 제안 생성 → `CORRECTION_PROPOSED`, 채택 → `CORRECTION_ACCEPTED`, 거절 → `CORRECTION_IGNORED` / 레슨 완료 → quiz 문항별(대상이 grammar 면 `GRAMMAR_USE`, chunk 면 `VOCAB_RECOGNITION`), 말하기 과제별 `SENTENCE_PRODUCTION`(표현 모두 사용 SUCCESS·일부 PARTIAL·없음 FAIL·건너뜀 SKIPPED). 발화 경로면 `confidence` = STT 신뢰도(없으면 1.0, 텍스트 1.0). 관측은 **해당 트랜잭션 안에서** 쓰고(기록률), DAILY 스냅샷 `observations{bySkill,…}` 증가. `SELF_CORRECTION`·`CORRECTION_REUSED`·`SCENARIO_COMPLETED` 는 010c/010d/Phase 3.
- **L4 A11 실행 시점**: 레슨·복습 레슨·단어 세트 완료 트랜잭션 뒤 enqueue(사용자당 대기 중 1개로 합침) + #58 첫 호출(그날 판단 없음) 시 enqueue. 같은 날 2회 이상 판단하지 않는다(`AiJob` 조회). 화면은 결과를 기다리지 않는다(다음 #58 에서 반영).
- **L5 오늘의 복습 생성**: A11 결과(또는 폴백)로 항목 `intervalDays·priority·nextDueAt·decidedBy·decisionReason` 갱신 → 오늘 due 가 있으면 균등 랜덤 추출로 `ReviewSchedule(userId,dueDate=오늘)` upsert(`@@unique([userId,dueDate])`), `tutorRationale` = A11 `rationale_ko` 요약 ≤300자(폴백이면 코드 문구 "지난 학습에서 틀리거나 오래된 항목을 골랐어요").
- **L6 A5 복습 레슨**: #63 이 `Lesson(kind=REVIEW, sourceLessonIds 대신 mixSpec=RepetitionItem 스냅샷)` + `AiJob(REVIEW_GEN)` 생성, A5 는 A4 스키마 재사용(`reviewMix@v1`, 대상 = mixSpec 항목만 — 보정·후검증은 A4 패턴). 완료는 #62 그대로(kind REVIEW 면 `StudyLog(REVIEW)`·`ReviewSchedule DONE`·mixSpec 항목 `studiedCount+1`·A11 enqueue).
- **L7 화면(데모 게이트)**: 오늘 홈 "오늘의 복습" 카드 — 상태: 가드(기록이 더 쌓이면 열려요, 남은 조건 표시) / 오늘 복습 있음(항목 수·FOCUS 수·강사 근거 한 줄·[복습 시작]·[오늘은 건너뛰기]) / 만드는 중 / 진행 중 / 완료 / 판단 대기(오늘 판단 전). 복습 레슨은 task-010 레슨 화면(단계·종료 카드) 재사용 + 머리 "복습". 카드 위치는 오늘의 회화 카드 위(복습 우선) — designer 가 A/B 로 제시.
- **L8 교정 채택 → 항목**: `textJa = corrected`, `meaningKo = explanationKo 앞부분` 스냅샷, `itemType=EXPRESSION`, 같은 표현 재채택은 `feedbackCount+1`.

### 역할 분담·파일 경계
- designer: 데모 `docs/demo/task-010b-repetition-vN.html`(delta — 오늘 홈 복습 카드 상태 전부 + 복습 레슨 머리·종료 카드 차이, 현재 vs 제안).
- prompt-engineer: `conversation/prompts/reviewDecision.ts`(A11 `reviewDecision@v1`)·`reviewMix.ts`(A5 `reviewMix@v1`)·스키마·후검증·보정·픽스처.
- developer: `learning/{repetition,reviewSchedule,observations}/**`·`learning/vocab`(finish 에 항목·관측)·`conversation/corrections`(채택에 항목·관측 — 라우트 조합 또는 L3 공개 함수 경유, 6층 방향 준수)·`api/v1/lessons/today`·`api/v1/reviews/**`·잡 실행기·`prisma/schema.prisma`(승인 전 push 금지). 화면은 데모 승인·activate 뒤. push 금지.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 09-28 18:07 |
| v1 | 검토요청 | docs/demo/task-010b-repetition-v1.html | https://claude.ai/artifact/WtuZFyoPu2PbkJuzMGusJx | 사용자 검토 요청 | 09-28 20:25 |

## 작업 기록

### 2026-09-28 19:40 Leader — judge intake
- `judge-result@2`(engine jev, needs_info=false): risk R2 · developer opus · demo **delta(DM-low-confidence)** · `next=demo_first` → `check.mjs init`. 데모는 Phase 2 나머지 task 와 **한 번에 사용자 검토 요청**(승인 요청 횟수 최소화), 스키마 push 승인도 같은 메시지로.

### 2026-09-28 19:55 Prompt-Engineer — A11 복습 판단·A5 복습 혼합

**산출물**: `conversation/prompts/reviewDecision.ts`(`reviewDecision@v1`)·`reviewMix.ts`(`reviewMix@v1`), `conversation/structuredResponse/{reviewSchemas,reviewChecks,reviewRepair}.ts`(신규 — `schemas.ts`·`checks.ts` 는 다른 PE 가 A6/A7 평가 프롬프트로 동시 작업 중이라 무변경 유지, 충돌 0), `conversation/__tests__/{reviewDecision,reviewMix}.test.ts`(30건, 전체 신규), `tests/prompts/fixtures/{review-decision,review-mix}.json`, `tests/live/{review-decision,review-mix}-measure.ts`, `conversation/index.ts` export 추가. `tutor.md` **무변경**(§6 REVIEW_DECISION 행·§7 복습 규칙이 이미 R-2 로 반영돼 있었다 — learning-personalization §2-8 확인).

**A11 확정 계약**(`REVIEW_DECISION_SCHEMA`): 입력 후보 ≤40건·≤4,000자(우선순위 순서로 채우고 초과분은 뒤에서 자름, `skippedCandidates`) + 헤더 ≤600 + 관측 요약(`ReviewDecisionObservationSummary[]`, 5축 성공/실패, 원문 없음) + `LearnerErrorStat` top5. 출력 `{decisions[{itemId,nextIntervalDays,priority,reason_ko≤80}], sessionPlan{itemIds[],mixNote_ko≤200}, rationale_ko≤300}`. **스키마는 `nextIntervalDays` 를 1~30 으로만 제한한다(3~7 강제 안 함)** — 범위 클램프를 재시도가 아니라 결정적 코드로 처리하는 쪽이 더 신뢰도가 높다는 설계 판단(아래).

**후검증 2단 분리**(A4 lesson@v2 의 "재시도 vs 결정적 보정" 분리를 그대로 계승):
1. `checkReviewDecisionResponse`(`extraCheck`, 재시도 유발) — 엔진명 노출만 본다(`rationale_ko`·`reason_ko`·`mixNote_ko` 전부).
2. `normalizeReviewDecision`(별도 함수, **`extraCheck` 로 연결하지 않음** — `llm.completeJson` 호출 뒤 developer/잡 실행기가 직접 부른다) — ① 후보 풀에 없는 itemId 폐기(환각 방어, 중복도 처음 것만) ② 3~7 클램프 + FOCUS ≤3(사실상 고정 3) ③ 판단 안 된 후보는 폴백(기존 intervalDays 유지, 없으면 초기 3, `reason_ko="이번엔 판단하지 못해 기존 간격을 유지해요"`) ④ `sessionPlan.itemIds` 를 후보 풀 부분집합으로 정리. **반환 `decisions` 는 후보 풀 전체를 정확히 한 번씩 담는다** — developer 가 "판단 못 받은 항목"을 따로 분기할 필요가 없다. `counts{clamped,discarded,fallback,sessionPlanPruned}` 로 로그화.

**A5 설계 판단(문서화 필요)**: mixSpec 항목은 전부 `chunks[]` 자리로만 들어간다(`RepetitionItem` 이 `textJa`/`meaningKo` 스냅샷만 가져 `LessonGrammarPoint` 가 요구하는 pattern/예문 데이터가 원천적으로 없다 — `grammar[]` 는 A4 처럼 자유 id 로 재료를 설명하는 메타 텍스트). **`schemas.ts`·`checks.ts`·`repair.ts` 무변경 재사용**(`LESSON_SCHEMA`·`checkLessonResponse`·`repairLessonResponse`) — mixSpec 을 `LessonTopicChunkInput` 모양(`ReviewMixItemInput`)으로 렌더링하면 "chunks ⊆ mixSpec"이 기존 "chunks ⊆ topic.chunks" 그대로 적용된다. 세션이 4개 미만이면(`LESSON_CHUNKS_MIN=4`) 자연스러운 연결에 필요한 최소한의 `new-N` 예외를 허용하는 문구를 넣었다(아래 실측에서 실제로 발동·1회 재시도로 해결됨 — 정상 동작 확인).

**실측 표(우분투, `--env-file=.env`, sonnet, 2026-09-28)**:

A11(`tests/live/review-decision-measure.ts`, 지시대로 정상·FOCUS 많음·항목 1개 3회):

| run | 성공 | ms | attempts | 후보 | decisions | clamped | discarded | fallback | planPruned |
|---|---|---|---|---|---|---|---|---|---|
| normal(6건) | OK | 8,426 | 1 | 6 | 6 | 0 | 0 | 0 | 0 |
| focus-heavy(FOCUS 4/5건) | OK | 8,350 | 1 | 5 | 5 | 0 | 0 | 0 | 0 |
| single-item(1건) | OK | 6,094 | 1 | 1 | 1 | 0 | 0 | 0 | 0 |

3/3 성공, 재시도 0, 보정 0건(모델이 3~7·FOCUS≤3 지시를 스스로 지켰다 — 클램프는 "안전망"으로 남기되 이번 표본에선 발동 안 함). 60s 예산 안에서 여유 큼(최대 8.4s).

A5(`tests/live/review-mix-measure.ts`, 지시대로 2회 — 픽스처 6항목 + 소규모 3항목):

| run | 성공 | ms | attempts | 재료 | 위반 | dialogue | chunks(new) | grammar |
|---|---|---|---|---|---|---|---|---|
| fixture-6items | OK | 30,832 | 1 | 6 | 0 | 10 | 6(0) | 3 |
| small-3items | OK | 50,140 | **2**(1차 `chunks` minItems:4 위반 — 3항목만 채우고 new-N 예외를 안 씀) | 3 | 0 | 8 | 4(**1**) | 3 |

2/2 성공. **재발 가능한 함정(기록)**: mixSpec 이 `LESSON_CHUNKS_MIN`(4) 보다 적으면 1차 시도에서 모델이 종종 mixSpec 항목 수 그대로만 채워 스키마 위반이 나고(이번 표본은 재시도로 해결됨, 기존 `schemaValidate` 1회 재시도 메커니즘이 그대로 커버) — developer 가 **세션 크기를 항상 ≥4 로 구성**하면(design-spec 대로 dailyMinutes 6~8건) 이 경로 자체를 피할 수 있다. 3개 미만 세션을 만들 계획이면 Leader 에게 알릴 것.

**developer 인계 — 와이어링 지점**:
- A11: 잡 실행기에서 `buildReviewDecisionRequest` → `llm.completeJson` → **바로 `normalizeReviewDecision({candidates: 원래 후보(itemId·intervalDays·priority)}, result.data)` 호출** → 그 결과의 `decisions`(후보 풀 전체 1:1)로 `RepetitionItem.intervalDays/priority/nextDueAt/decidedBy='TUTOR'/decisionReason` upsert. LLM 실패·타임아웃(`completeJson` 예외)은 기존 폴백 그대로(`decidedBy='FALLBACK'`) — 이건 `normalizeReviewDecision` 호출 전 단계이므로 이 함수와 무관.
- A5: `buildReviewMixRequest`(mixSpec → `ReviewMixItemInput[]`, `chunkType` 은 developer 가 원 `RepetitionItem.itemType` 에서 추정 매핑 — 최종 출력 분류는 LLM 이 다시 하므로 추정이 틀려도 검증에 영향 없음, 파일 상단 주석 참고) → `completeJson` → 기존 A4 완료 트랜잭션과 동일 경로(quiz 재채점 등).
- `ReviewDecisionCandidateInput.itemType`/`ReviewMixItemInput.chunkType` 타입은 `RepetitionItem` 도메인 enum 과 리터럴로 맞춰 뒀다(스키마 확정 전이라 문자열 리터럴 유니온으로 선언 — Prisma enum 이 확정되면 값 집합만 대조해 주면 된다).

**위반율**: A11 0/3(0%), A5 0/2(0%, JSON 계약 기준 — 1건의 스키마 재시도는 기존 A4 안전망이 정상 동작한 것으로 "위반"이 아니라 "회복"으로 집계). 둘 다 목표(≤5%) 이내.

### 2026-09-28 20:24 designer — 데모 v1
- 파일 `docs/demo/task-010b-repetition-v1.html`(meta `task-010b-v1`, 토큰 `src/app/globals.css@sha256:72ff73699119` = v2 와 같음, 인라인만·합성 데이터) — `check.mjs lint --expect task-010b-v1` **DEMO_LINT_PASSED**(경고 0). 승인 v2 파일은 손대지 않음(sha256 `5c9159f5…` 그대로). v2 의 틀 표시(실제 CSS 폭·높이 배치 후 같은 배율 축소·배율 선택·휴대폰에서 접히는 상태 목록·상단 컨트롤 한 줄)와 레슨 화면 코드를 그대로 가져와 복습에서 달라지는 곳만 바꿈. 지난번 결정 a·b·d(순서대로·누를 때만 재생·가리고 듣기)는 고정.
- 범위(delta): ① 오늘 홈 "오늘의 복습" 카드 — 현재(v2 승인 홈) vs 제안 + 상태 14개: 복습 있음(선생님 판단/기본 규칙 폴백·[자세히] 펼침)·가드(공부한 날 1/2일·복습할 재료 0/2개 막대)·판단 대기·**오늘은 복습 없음(다음 예정일 — Leader 목록에 없던 상태, 추가)**·만드는 중·만들기 실패·하던 복습(시작 전이면 "준비됐어요")·오늘 완료(다음 복습/판단 대기)·불러오는 중·오류 / ② 건너뛰기 — 누른 직후·실패·건너뛴 뒤(성공·실패·취소 전부, A/B 둘 다 동작) / ③ 복습 수업 — 수업 화면 현재 vs 제안, 대기·실패, ① "이번 복습 항목"(종류·읽기·뜻·틀림/교정 횟수·공부 횟수·출처·● 집중, 접기), ② 복습 표현·문형 집중 표시, ⑤ 집중 표현 못 쓴 예 / ④ 복습 종료 카드 — 현재 vs 제안, 다음 복습(선생님 판단: 3·5·7일 묶음 + 근거 [자세히] / 판단 대기 / 판단 실패 = 지난 간격).
- 근거 표시: 카드엔 `rationale_ko` 첫 문장(두 줄 clamp) + [자세히](전체 ≤300자 + 이번 항목 칩). 폴백은 선생님 아바타 대신 ⓘ + "지난 학습에서 틀리거나 오래된 항목을 골랐어요" + "이번엔 기본 규칙으로 골랐어요". 근거 속 「…」는 화면이 `lang="ja"` 로 감쌈(구현도 같은 방식 권고).
- 결정 필요(데모 패널, 권고 표시): (a) 카드 위치 — **권고 A "할 일이 있을 때만 오늘의 회화 위"**(복습 있음·만드는 중·하던 복습·실패일 때만 위, 없음·완료·건너뜀·대기·가드는 아래) vs B 늘 아래. 실측 근거: 390×780 에서 스크롤 영역 707px, 단어 카드가 커서 복습 카드 시작 y=449 → 늘 위에 두면 복습 없는 날에도 [수업 만들기]가 673→767~918 로 밀려 첫 화면 밖. 하이브리드면 복습 있는 날 [복습 시작] 665(360: 684) 첫 화면 안, 없는 날 [수업 만들기] 673(360: 693) 그대로. (b) 건너뛰기 — **권고 B 바로 건너뛰고 5초 되돌리기**(화면이 #64 호출을 5초 늦춤, 서버 변경 없음) vs A 확인 시트. (c) 복습 수업 만드는 때 — **권고 A [복습 시작] 누를 때**(현 계약) vs B 판단 직후 미리 만들기(서버 흐름 변경 필요). (d) 가드 자리 — **권고 B '곧 열려요' 안** vs A 오늘의 회화 아래 작은 카드.
- 검증(헤드리스 Chrome): 목록 29상태 × 3폭(360/390/412) × 높이 2종(780/892) = 174 조합을 데스크톱 1400×900 · 모바일 412×892 · 모바일 360×740 에서 — 페이지 가로 넘침 0 · 틀 안 가로 넘침 0 · JS 오류 0 · 엔진명·모델명·task/Phase 번호 0. 클릭 흐름 29단계 PASS(복습 시작→대기→수업→마치기→판단 대기→4초 뒤 채움 / B 되돌리기·5초 저장·저장 실패 / A 시트 취소·실패·성공 / a·c·d 다른 선택 / 판단 결과 3종 / 비교 화면 2종).
- **Leader 확인 요청(계약 — 가이드 전에 필요)**: ① #58 `guard` 가 `{reason, needed?:1}` 뿐 — 남은 조건 두 개를 보이려면 `guard.studyDays{have,need}`·`guard.items{have,need}` additive ② #58 `review` 에 카드용 `status`·`itemCount`·`focusCount`·`preview[]`(≤7, `textJa`·`priority`)·`decidedBy`·`tutorRationale`·`decidedAt`·`lessonId`/`stageDone`/`jobId` + `decisionPending` + `nextReview{date,days,itemCount}`(없음·완료·건너뜀 카드) 필요 ③ ① 항목 목록의 **읽기**는 `RepetitionItem` 에 스냅샷이 없음(원천 조각·단어에는 있음) — #63 mixSpec 스냅샷에 싣거나, 없으면 줄 생략 ④ 출처는 refType 로만 "수업·회화 교정·단어 세트" 3가지(주제명 없음 — 데모도 그렇게 맞춤) ⑤ 복습 종료 카드의 다음 복습(항목별 간격 묶음·근거)을 A11 뒤 어디서 읽을지 — #60 REVIEW 레슨에 `nextReview{decidedBy, rationaleKo, groups[{days,date,itemIds}]}` additive 권고(#62 는 `reviewDecisionJobId` 로 #55 폴링 → 끝나면 #60 재조회) ⑥ #58 한 번에 회화·복습 카드를 같이 읽으면 두 카드 오류가 같이 남 — 가이드에서 한 줄로 합칠지 정함 ⑦ 결정 (c) B 가 선택되면 A11 뒤 REVIEW_GEN 자동 enqueue(서버 흐름 변경).
- 구현 가이드(screens.md)는 사용자 승인 뒤 작성. 코드·frontmatter·screens.md 수정 없음, commit 없음.

### 2026-09-28 22:28 reviewer — REV-031

**판정: PASS**(계약 전용 검토 — Critical 0 · High 0 · Medium 0 · Low 0). 범위: `conversation/prompts/{reviewDecision,reviewMix}.ts`·`structuredResponse/{reviewSchemas,reviewChecks,reviewRepair}.ts`. developer(서버 wiring)·스키마 push 는 아직 없음(사용자 승인 대기) — grep 확인(`buildReviewDecisionRequest`/`buildReviewMixRequest`/`normalizeReviewDecision` 은 `conversation/index.ts` export 와 자기 테스트 파일 밖에서 호출되지 않음, `prisma/schema.prisma` diff 없음). `learning/repetition/index.ts` 는 이미 존재하는 task-010 산출물(레슨 경로)이라 이번 검토 대상이 아님(신규 파일 없음, 수정 없음).

- **3~7일·FOCUS≤3 강제는 스키마가 아니라 코드**: `REVIEW_DECISION_SCHEMA.nextIntervalDays` 는 1~30 만 강제(재시도 최소화 설계) → `normalizeReviewDecision`(`reviewRepair.ts`) 이 `finalizeInterval` 로 3~7 클램프 + `FOCUS` 면 추가 ≤3 클램프. 후보 풀에 없는 `itemId` 폐기(환각 방어)·중복 제거·판단 안 된 항목 폴백(기존 간격 유지 또는 초기 3)까지 결정적 함수로 처리 — 반환 `decisions` 가 후보 풀 전체를 정확히 1번씩 담아 호출자가 "판단 못 받은 항목"을 따로 분기할 필요가 없다. 로직을 직접 추적해 규칙(§ 문서 6가지) 전부 코드와 일치함을 확인.
- **A5 mixSpec 부분집합**: `buildReviewMixRequest` 가 A4 의 `LESSON_SCHEMA`/`checkLessonResponse`/`repairLessonResponse` 를 무변경 재사용하고 `allowedChunkIds` 를 mixSpec id 로만 채워 "chunks ⊆ mixSpec" 을 기존 "chunks ⊆ topic.chunks" 규칙 그대로 재사용 — 새 검증 코드를 만들지 않고 이미 회귀 검증된 A4 경로를 태운 설계가 합리적.
- **엔진명·프롬프트 주입**: `checkReviewDecisionResponse` 가 `rationale_ko`·`mixNote_ko`·모든 `reason_ko` 를 `llm.mentionsEngineIdentity` 로 검사. `INJECTION_GUARD` 두 프롬프트 모두 포함.
- **로그 코멘트 속 모델 티어 언급**(`reviewDecision.ts` 머리말 "sonnet·60s")은 코드 주석일 뿐 런타임 문자열·응답에 나타나지 않음 — 화면·사용자 노출 경로 없음 확인(grep). 위반 아님.
- 실행 검증: `tsc` 0 · `eslint` 0 · 단위 테스트에 `reviewDecision.test.ts`·`reviewMix.test.ts` 포함해 전체 706건 705 pass/1 skip/0 fail · `next build` 성공(이 task 는 라우트가 없어 빌드 표에는 나타나지 않음 — export 만 번들에 포함, 타입 에러 없음으로 간접 확인).
- **릴리스 동반 가능**: 예 — 서버 미연결 상태라 사용자 경로에는 어떤 영향도 없다(순수 export 추가). 향후 developer 가 A11/A5 를 실제로 연결할 때는 이 REV-031 이 아니라 **재순환**(연결 코드가 생기면 그 시점에 다시 감사)이 필요하다.
