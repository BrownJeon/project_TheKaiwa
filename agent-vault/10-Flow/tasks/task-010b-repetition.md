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
updated: 2026-10-01
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-010b-repetition-v1.html"
  artifact_url: "https://claude.ai/artifact/WtuZFyoPu2PbkJuzMGusJx"
  content_sha256: "dcd310bf3d45a946bad50deff0e59ddec8703bd4086edda8967224293553b02e"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: "user"
  approved_at: "2026-10-01T08:17:26+09:00"
  approval_quote: "대기 중인 데모 전부 권고안대로 승인"
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
| v1 | 승인 | docs/demo/task-010b-repetition-v1.html | https://claude.ai/artifact/WtuZFyoPu2PbkJuzMGusJx | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |

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

### 2026-10-01 developer — Developer 기록: DB 스키마 추가(사용자 "db추가 승인" 4건, 추가만)
- [08:26] **범위**: `prisma/schema.prisma` + `docs/design/domain-model.md` 만. `db push`·`migrate`·`generate` **실행 안 함**(Leader 가 백업 뒤 push → generate). 코드·API·화면 변경 없음, commit 없음.
- [08:26] **추가 내역**: ① 010b — `LearningObservation`(§9-2 → §3 승격, `User` FK Cascade, `@@index([userId,occurredAt])`·`([userId,skill,occurredAt])`, `refType/refId`·`wordId`·`scenarioId` FK 없음) + enum `ObservationKind`(13종, learning-personalization §2-2 의 `EXPRESSION_REUSE` 포함)·`ObservationOutcome`·`SkillAxis`. `LearnerSkillState` 는 안 만듦(Phase 3). ② 010c — enum `CorrectionMode{FLUENCY,COACH}` + `Profile.correctionMode @default(FLUENCY)`(NOT NULL + DEFAULT → 기존 행은 FLUENCY). ③ 010d — `Scenario`(§9-1 그대로, `User?` FK Cascade)·`ScenarioTopic`(`@@id([scenarioId,topicId])`, `weight Int @default(1)`) + `Lesson.scenarioId?`·`Chat.scenarioId?`·`Chat.lessonId?`(모두 SetNull) + 역방향 `User.scenarios/observations`·`ConversationTopic.scenarios`·`Scenario.lessons/chats`·`Lesson.chats`. ④ 011 — `EvaluationItem.textRevealedAt DateTime?`.
- [08:26] **검증(미러, 읽기 전용)**: `prisma validate` 통과. `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script`(접속 문자열은 Prisma 가 `.env` 에서 직접 읽음 — 셸·로그에 노출 없음) → **ADD COLUMN 5**(Chat.lessonId·Chat.scenarioId·Lesson.scenarioId·EvaluationItem.textRevealedAt·Profile.correctionMode) · **CREATE TABLE 3**(Scenario·ScenarioTopic·LearningObservation) · **ADD FOREIGN KEY 7** · DROP/MODIFY/데이터 손실 **0**. 운영 DB 와 기존 스키마 사이 드리프트도 0(diff 에 이번 변경만 나옴). SQL 전문은 세션 scratchpad `db-diff-2026-10-01.sql`(Leader 전달).
- [08:26] **정본 갱신(domain-model.md)**: §3 블록 동기화(실물과 머리 주석·기존 주석 2곳 외 일치) · §1 L3 소유 표(+Scenario·ScenarioTopic·LearningObservation, 빠져 있던 RepetitionItem)·규칙 6(`correctionMode`) · §2-2 ER · §4-1/4-2/4-3 행 · §5-9(`Scenario.status`·관측 append-only) · §6(계정·Lesson·주제·사용자 Scenario 삭제, 관측 삭제 경로 없음) · §8 #14·#15 승격 표시 + #20~#22 신규(아래 질문) · §9 머리·9-1·9-2 승격 표시. api-contract·module-dependency 는 **안 건드림**.
- [08:26] **정본에서 한 발 나간 곳(Leader 확인 요청, §8 #20)**: §9 제안 블록은 `Scenario.userId`·`LearningObservation.userId` 에 관계 선언이 없었다. 규칙 §6("계정 삭제 = 소유 행 전부 Cascade")·learning-personalization §2-2("보존·삭제는 StudyLog 와 같다" — StudyLog 는 User Cascade)·`ConversationTopic` 선례를 근거로 **`User` FK(Cascade)를 붙였다**(칼럼 추가 없음, FK 제약 2개). 빼야 하면 push 전에 두 줄만 지우면 된다.
- [08:26] **문서 불일치(§8 #21·#22, 스키마 영향 없음)**: `ScenarioTopic.weight` — domain-model §9-1 `Int @default(1)`·`@@id` vs learning-personalization §1-2 "0~1·`@@unique`" → 정본(domain-model) 따름. `Scenario.completionRule`/`goal` JSON 키 — §9-1 `{requiredExpressions, requiredBranches, tutorJudgement}`·`communicativeGoal_ko` vs LP `{minKeyExpressions, requireBranchHandled, requireGoalAchieved}`·`communicativeGoal` → Json 칸이라 010d 시드(PE) 확정 때 통일.
- [08:26] **push 뒤 주의**: `generate` 후 `@prisma/client` 가 `CorrectionMode` enum 을 내보낸다 — `conversation` 의 같은 이름 문자열 유니온 타입(`'FLUENCY'|'COACH'`)과 값은 같으나 한 파일에서 둘 다 import 하면 이름 충돌. `Profile.strictness` 주석을 "교정 범위(무엇을 오류로 볼지)"로 고쳤다(새 칸과 "빈도" 뜻이 겹치지 않게, LP §2-8).

## Leader 기록 (2026-10-01 17:00 — 서버 와이어링 착수·계약 결정)

- **착수 근거**: 데모 v1 사용자 승인(10-01 08:17, 결정 a=A 하이브리드 위치·b=B 바로 건너뛰기+5초 되돌리기·c=A [복습 시작] 누를 때 생성·d=B '곧 열려요')·DB 추가 적용 완료(10-01). 010c 가 `learning/observations`(`recordObservations`·`observationRow`, 스냅샷은 안 건드림)를 먼저 만들었으므로 010b 는 그 모듈에 **단어 세트·교정·레슨 관측 + DAILY 스냅샷 `observations` 증가**를 더한다.
- **1단계(이번 dispatch) = 서버만**: A11/A5 와이어링·`RepetitionItem` 3경로·`LearningObservation`·`ReviewSchedule`·#58 `review`/`guard` 채움·#60 REVIEW 확장·#62 `reviewDecisionJobId`/`nextReview`·#63/#64·단위 테스트·라이브 스모크. **화면(오늘 홈 카드·복습 수업 머리)은 2단계** — `TodayHome.tsx`·`study/today/page.tsx` 를 025/011 이 아직 커밋 전에 만지고 있어 충돌을 피한다(011 QA PASS·커밋 뒤).
- **designer 확인 요청 ①~⑦ 에 대한 Leader 계약 결정(additive 만 — 기존 키 변경 없음)**
  1. #58 `guard` = `{reason:"cycle"|"insufficient"|"stale", needed?:1, studyDays:{have,need}, items:{have,need}}` — `insufficient` 일 때 두 막대용 값을 채운다(need = 2·2, 가드 상수는 `repetition` 에 이미 있으면 재사용).
  2. #58 `review`(없으면 null) = `{id, status:DUE|DONE|SKIPPED, itemCount, focusCount, preview[≤7]{textJa, priority}, decidedBy:TUTOR|FALLBACK, tutorRationale, decidedAt, lessonId|null, stageDone|null, jobId|null}` + 최상위 `decisionPending:boolean`(오늘 판단 전·A11 잡 진행 중) + `nextReview:{date, days, itemCount}|null`(오늘 복습 없음·완료·건너뜀 카드용 — 가장 이른 `nextDueAt` 묶음). `preview` 는 우선순위(FOCUS 먼저)·`textJa` 만(읽기·뜻 없음).
  3. **읽기(가나) 줄은 만들지 않는다** — `RepetitionItem` 에 스냅샷이 없고 새 칸을 만들지 않는다(DB 추가는 이미 끝남). 화면 ① "이번 복습 항목"에서 읽기 줄은 생략(designer 가 2단계 가이드에서 반영). 뜻은 `meaningKo` 그대로.
  4. 출처 = `refType` 로만 3종("수업"=TopicChunk·Expr·Grammar / "회화 교정"=Correction / "단어 세트"=WordEntry). 주제명 없음.
  5. #60 REVIEW 레슨에 `nextReview{decidedBy, rationaleKo, groups[{days, date, itemIds}]}` additive. #62 응답의 `reviewDecisionJobId` 를 #55 로 폴링 → 끝나면 #60 재조회(`nextReview` 가 `null` → 채워짐). 판단 실패(`FALLBACK`)면 groups 는 지난 간격, `rationaleKo` 는 코드 문구.
  6. #58 한 응답에 회화·복습이 같이 담기는 것은 **유지**(오류가 같이 남는 문제는 2단계 화면 가이드가 한 줄 오류로 합친다 — 서버는 `review`/`guard` 계산이 실패해도 `todayLessons` 는 내려주고 `review:null` 로 degrade, 오류는 로그만).
  7. 결정 (c)=A 이므로 A11 뒤 REVIEW_GEN 자동 enqueue **없음**(#63 가 [복습 시작] 때만).
- **역할**: developer(Opus) 1단계 서버 → Reviewer(REV-059 이후 다음 번호) → [Judge C2 → Codex?] → QA. designer 는 병행해 **2단계 구현 가이드**(`docs/screens.md` 신규 절 — 데모 v1 기준, 읽기 줄 제외·위 계약 반영)만 쓴다(코드·데모 수정 없음).

## Designer 기록 (2단계 구현 가이드, 2026-10-01)

- [14:28] **산출물**: `docs/screens.md` **§14 오늘의 복습**(신규 절 — §13 은 Leader 콘솔 가이드 자리라 비워 둠, 파일 끝에 붙임) + §5-5 컴포넌트 표에 `TodayReviewCard` 한 줄. 첫 줄 `승인 데모: docs/demo/task-010b-repetition-v1.html (v1)`, 적용 토큰 이름 나열. 데모·코드·frontmatter 수정 없음, commit 없음.
- [14:28] **구성**: 14-0 결정 8줄 · 14-2 A 홈 카드 16행 표(데모 14상태 + 로컬 건너뜀·숨김, 조건 = #58 `review`/`guard`/`decisionPending`/`nextReview` + `todayLessons` 의 복습 레슨 상태) · 자리 규칙(a=A: 5~10번 위 / 11~15번 아래 = 오늘의 회화와 AI 평가 사이 / 가드 = 맨 아래 "곧 열려요") · B 가드 막대 · **C 건너뛰기 5초 — 떠나면(visibility hidden·pagehide·언마운트) 즉시 #64(keepalive) 권고**(보인 대로 저장·결정 b 의 대가 그대로·잃는 것 없음·백그라운드 타이머 불신), 실패 플래그 sessionStorage · D 대기·실패 복습판 · E 머리 "복습" 뱃지 · F ① 항목 카드(읽기 줄 없음, `StageUnderstand` 무수정 — `LessonScreen` 이 앞에 끼움) · G ② 집중 표시(칩만) · H ③ 한 줄 · I 종료 카드 다음 복습(#62 jobId → #55 → #60) · 14-3 상태 훅 3개 · 14-4 API · 14-5 컴포넌트(`src/components/lesson/review/*` 신규 + 기존 12파일 선택 prop) · 14-8 문구 · 14-9 QA 체크리스트 초안 · 14-10 건드리지 말 것.
- [14:28] **실측으로 찾은 것**: ① `deriveLessonCard` 가 `kind` 를 안 거른다 + 서버 `todayLessons` 는 복습 레슨도 담는다 → 필터 한 줄 필요(가이드 반영) ② `resume` 에 `kind` 가 없어 지난 날짜 하던 복습이 "하던 수업"으로 샌다 → 서버 요청 ★① ③ `LessonEnd`·`LessonGenScreen` 은 `topic:null` 을 "붙여넣은 수업"으로 다룬다 → `kind` 분기를 먼저(가이드 반영) ④ 011 이 "곧 열려요"(`TodayComingSoon`)를 지움 → 가드일 때만 칸을 되살림 ⑤ A5 는 문형을 새 id 로 써서 ② 문형 카드엔 집중 표시 불가 ⑥ 공용 `Toast` 는 `pointer-events-none` → `UndoToast` 신규 ⑦ `apiPost` 에 keepalive 없음 → `ApiOptions.keepalive` 선택 옵션.
- [14:28] **데모와 다른 점 10건**(§14-11 표 — 오류 합침·가드 칸·아래 자리·읽기 줄·문형 집중·시각 표기·완료 문구·처음 복습·실패 초점·떠남 처리). 재승인 없이 가이드로 처리하자는 판단 — Leader 확인 요청.
- [14:28] **Leader 확인 요청(서버 1단계와 대조)**: ★① #58 `resume` NEW 만 ★② #60 REVIEW(모든 status)에 `reviewItems[{id,itemType,textJa,meaningKo,priority,wrongCount,feedbackCount,studiedCount,refType}]` ★③ #63 연결 레슨 FAILED 면 같은 일정으로 재생성 ④ #58 `nextReview.decidedBy`(선택) ⑤ #62 `nextReview` = #60 모양 ⑥ `guard` `cycle`/`stale` 뜻 ⑦ #64 FAILED 허용·IN_PROGRESS 409 ⑧ `todayLessons` 에 복습 레슨 유지(또는 `review.lessonStatus`·`score`).

## Developer 기록 (서버 1단계, 2026-10-02)

> 에이전트 `dev-010b-server`(Opus). 이전 Developer 가 사용량 한도로 중간에 멈춘 뒤 이어받음. 시각은 `date` 기준(작업은 10-02 23:40 ~ 10-03 00:12 KST). commit·push·`db push`·`generate`·`npm install`·실 LLM·DB 쓰기 스모크 **없음**.

### 감사(이전 산출물 — 어디까지 되어 있었나)
- [23:41] 이전 산출물은 10-01 14:15~14:41 사이에 멈춰 있었다(그 뒤 src 변경 없음). 미러 `~/.node-local/thekaiwa-dev-010b` 에 `rsync -a --delete` 로 `src/ tests/ prisma/ package.json` 동기화 후 감사: **tsc(비증분) 0 · eslint 0 · learning+conversation 단위 421/421**. 즉 서버 와이어링은 거의 끝나 있었고, **010b 전용 단위 테스트·라이브 스모크·api-contract 반영·Developer 기록이 없었다.**
- 이전 Developer 가 만든 것(코드를 읽고 계약과 대조해 **유지**): `repetition/{decision.ts(A11 잡 적재·합치기·사용자별 실행 줄·폴백·판단 저장·완료 레슨 판단 기록), review.ts(순수 규칙), index.ts(FOCUS 임계·교정 뜻 스냅샷·markRepetitionStudied)}` · `reviewSchedule/{core.ts, index.ts}`(#58 복습 칸·#63·#64·#60 extras·afterStudyCompleted) · `observations/{index.ts(+DAILY observations 증가), corrections.ts}` · `lessons/{observations.ts(신규), lifecycle.ts(복습 레슨 완료 분기·관측·completeLessonDetailed), generate.ts(REVIEW_GEN 종류), today.ts(복습 칸·resume NEW 만), rows.ts(서버 칸 숨김), index.ts}` · `snapshots/index.ts(observations 병합)` · `vocab/sessions.ts(finishVocabSessionDetailed·WORD 항목·카드 관측)` · `learning/index.ts` exports · `infra/jobs.ts`(REVIEW_GEN·REVIEW_DECISION stale 5분) · `conversation/{review/index.ts(ReviewHooks), corrections/index.ts(rejectCorrectionIn·AcceptedCorrection.explanation/severity), orchestrator/index.ts(recordCorrectionProposed 훅 — 010c 변경과 같은 파일), index.ts}` · `speech/utterances/confidence.ts`(신규)+export · 라우트 `_lib/review.ts`(신규 — ReviewDecisionDriver·A5 요청·교정 관측 훅) · `reviews/[id]/{start,skip}`(신규) · `lessons/today`·`lessons/[id]/complete`·`vocab/sessions/[id]/finish`·`corrections/[id]/{accept,reject}`·`chats/[id]/review`·`chats/[id]/turns`(교정 제안 훅 한 줄).
- 같은 파일에 섞인 **다른 task 변경은 건드리지 않았다**: `prompts/reviewMix.ts`·`__tests__/reviewMix.test.ts` 의 diff 는 task-025(reviewMix@v2) 몫, `lessons/content.ts`(quiz promptKo·chunk 오디오)도 025, orchestrator·turns 의 교정 방식·자기수정 부분은 010c.

### 고친 것(이유)
- [23:55] **★③ #63 FAILED → 같은 레슨 행 되살리기**: 이전 코드는 새 Lesson 을 만들고 세션을 새 행에 다시 이었다(옛 FAILED 행이 고아로 남고, 그 행의 #60 `reviewItems` 가 빈 배열이 됨). ★③ 원문("#59 의 FAILED 행 되살림과 같은 규칙")·가이드 §14-2 A 6번("같은 행으로 되살림")대로 **그 행을 GENERATING 으로 되살리고 새 REVIEW_GEN 잡**(옛 잡이 늦게 끝나도 `isCurrentJob` 펜싱으로 버려짐). 점유 본체를 `claimReviewStart(tx, …)` 로 빼서 가짜 tx 단위 테스트가 가능하게 했다.
- [23:56] **★④ `nextReview.decidedBy` 값**: 이전 `'TUTOR'|'RULE'` → **`'TUTOR'|'FALLBACK'`**(다른 칸의 DecidedBy 와 같은 값). 이상하게 우회하던 `nextReviewSummary`(가짜 배열 생성)를 순수 `nextReviewOf(date, today, counts)` 로 교체.
- [23:56] **★⑧ `review.score`** additive 추가(복습 레슨 점수 — 홈 완료 카드 "문제 c/5"). `lessonStatus` 는 이전 코드에 있었다.
- [23:57] **교정 채택은 "공부"가 아니다**: 이전 코드는 교정 채택 등록에서도 `studiedCount+1`·`lastStudiedAt=now` 를 썼다. design-spec §7-4("레슨·세트 = 학습 횟수, 교정 = 강사 피드백 횟수")·목표("교정 채택 … feedbackCount+1")·가이드 ⑧("처음 복습해요")에 맞춰 `RepetitionItemInput.studied?:boolean`(기본 true) 추가, 교정 채택은 `studied:false` → 새 항목 `studiedCount 0·lastStudiedAt null`, 재채택은 피드백만 +1(3회 → FOCUS·3일). 레슨·세트 경로 동작은 그대로(기존 task010 테스트 무변경 통과).
- [00:02] **트랜잭션 안 self-deadlock 위험 제거**: `ensureTodaySchedule` 이 사용자 행을 잡은 tx 안에서 `getProfile()`(전역 prisma 로 **Profile upsert**)을 불렀다 — Profile 행이 없으면 INSERT 의 FK 검사가 우리 tx 의 `User FOR UPDATE` 를 기다려 스스로 막힌다(15s 타임아웃). `dailyMinutes` 를 **트랜잭션 전에** 읽어 넘기도록 바꿈(A11 잡 저장·#58 폴백 세션 둘 다).
- [23:58] #64 전이를 `status=DUE` 조건부 `updateMany` 로(동시 시작·건너뛰기 한쪽만), 본체를 `skipReviewIn(tx, …)` 로 분리. A11 적재 본체를 `claimDecisionJob(tx, …)` 로 분리(동작 동일).
- [23:59] #58 폴백 세션 경로에 due 존재 사전 확인(없으면 잠금 트랜잭션을 열지 않음 — #58 은 홈마다 읽힌다).

### 파일별 변경(이번 dispatch)
| 파일 | 변경 |
|---|---|
| `src/modules/learning/repetition/index.ts` | `studied` 플래그(등록·합치기), 머리말 |
| `src/modules/learning/repetition/review.ts` | `nextReviewOf`(TUTOR/FALLBACK) ← `nextReviewSummary` 대체, `ReviewGuard` 주석(★⑥ cycle·stale 예약값) |
| `src/modules/learning/repetition/decision.ts` | `claimDecisionJob(tx,…)` 분리, 저장 전 `getProfile` |
| `src/modules/learning/reviewSchedule/core.ts` | `nextReviewForUser`→`nextReviewOf`, DTO `score`, `skipReviewIn` 분리+조건부 전이, `ensureTodaySchedule(dailyMinutes 필수)`, `ensureFallbackSchedule` 프로필 선읽기 |
| `src/modules/learning/reviewSchedule/index.ts` | `claimReviewStart(tx,…)` 분리+★③ 같은 행 되살림, 폴백 사전 확인, export(`skipReviewIn`·`SkipReviewResult`·`ReviewClaim`) |
| `src/modules/learning/observations/corrections.ts` | 교정 채택 `studied:false`, 주석 |
| `src/modules/learning/__tests__/task010b.test.ts` | **신규 36건**(아래) |
| `src/app/api/v1/_lib/__tests__/review.test.ts` | **신규 2건** — A11 finalize = `normalizeReviewDecision`(1:1·3~7·FOCUS≤3·환각/중복 id 폐기·폴백 byTutor false·counts), 교정 제안 훅 tx 경유 |
| `src/modules/speech/__tests__/utteranceConfidence.test.ts` | **신규 2건** — 발화 신뢰도 규칙·잘못된 id 는 DB 안 읽음 |
| `tests/live/task010b-smoke.{sh,ts}` | **신규**(미실행) — 아래 |
| `docs/design/api-contract.md` | 표 #58·#62·#63·#64 · §2-13 잠금 순서·#58 복습 칸(guard·★⑥ 뜻·review·decisionPending·nextReview·mode·cycle·★①·★⑧·degrade)·`resume` NEW 만·#60 `reviewItems`/`nextReview`·#62 복습 레슨·관측·A11 적재·#63·#64 전문 · #33·#35·#36·#51 additive 한 단락씩(Edit 대상 줄만) |
| `docs/design/domain-model.md` | §9-3 DAILY `observations?` 선택 칸 · `Lesson.progress.reviewDecision`(서버 전용) 행 |
| `docs/design/module-dependency.md` | §10 `learning/repetition`·`reviewSchedule`(신규 행)·`observations` 행을 구현 기준으로, 라우트 조합 시퀀스(driver 방식) |

### 계약 대응표
| 계약 | 구현 위치 | 상태 |
|---|---|---|
| 17:00-1 `guard{reason,needed?,studyDays{have,need},items{have,need}}` | `repetition/review.ts reviewGuardOf` · 상수 `REVIEW_GUARD_STUDY_DAYS=2`·`REVIEW_GUARD_ITEMS=2` · 공부한 날 = DAILY `isStudyDay` | ✅(이전) + 테스트 |
| 17:00-2 `review{…}`·`decisionPending`·`nextReview{date,days,itemCount}` | `reviewSchedule/core.ts toTodayReviewDto`·`index.ts getTodayReviewState`(+`decisionJobId` additive) | ✅ |
| 17:00-3 읽기 줄 없음 | `reviewItemsFor`·`preview` 에 reading 없음(A5 입력에만 원천 읽기) | ✅ 테스트(키 고정) |
| 17:00-4 출처 refType 3종 | `repetitionSourceOf` + `reviewItems[].refType/source` | ✅ |
| 17:00-5 #60 `nextReview{decidedBy,rationaleKo,groups}`·#62 jobId→#55→#60 | `decision.ts recordLessonDecisions`(판단 직후 묶음을 `progress.reviewDecision` 에 고정)·`lessonReviewExtras` | ✅ |
| 17:00-6 회화·복습 한 응답, 복습 실패 시 degrade | `lessons/today.ts reviewStateSafely` | ✅ |
| 17:00-7 REVIEW_GEN 자동 enqueue 없음 | #63 에서만 생성 | ✅ |
| ★① resume NEW 만 | `today.ts` `kind:'NEW'` | ✅(이전) |
| ★② #60 REVIEW 모든 status `reviewItems` | `lifecycle.getLesson` + `LESSON_SELECT.reviewSchedule.itemIds` | ✅(이전) |
| ★③ FAILED → 같은 일정으로 재생성 | `claimReviewStart` **같은 행 되살림** | ✅ **고침** |
| ④ `nextReview.decidedBy` | `nextReviewOf` TUTOR/FALLBACK | ✅ **고침**(RULE→FALLBACK) |
| ⑤ #62 `nextReview` = #60 모양 | `LessonNextReview` 공용 | ✅ |
| ⑥ cycle/stale/insufficient 뜻 | 서버는 `insufficient` 만 — 나머지 예약값, api-contract #58 에 한 줄씩 | ✅ 문서 |
| ⑦ #64 FAILED 허용·IN_PROGRESS 409 | `skipReviewIn` | ✅ + 테스트 |
| ⑧ todayLessons 에 복습 레슨 유지 + `lessonStatus`·`score` | `today.ts`(필터 없음)·DTO | ✅ `score` 추가 |
| 목표: `normalizeReviewDecision` completeJson 직후 | `_lib/review.ts driver.finalize` ← `decision.ts runReviewDecisionJob` 이 `llm.completeJson` 바로 뒤 호출 | ✅ 테스트·변이 |
| A5 세션 ≥4 | `reviewSessionSize`(4~12, 15분→8)·`pickReviewSession` 가까운 예정으로 4까지 채움 | ✅(항목 총수 <4 인 사용자는 예외 — 위험 ②) |
| 폴백(LLM 실패·타임아웃) | `fallbackPlan`(지난 간격·피드백≥3 FOCUS 3·코드 근거)·잡 FAILED(오류 코드만)·세션도 FALLBACK | ✅ |

### 실행한 명령과 원 출력(미러 `~/.node-local/thekaiwa-dev-010b`)
- `./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json` → 출력 없음, `tsc exit=0`(감사 시점·수정 뒤·스모크 추가 뒤 3회 모두).
- `./node_modules/.bin/eslint src tests/live/task010b-smoke.ts` → `✖ 5 problems (0 errors, 5 warnings)`(경고 5건은 `src/components/settings/VoiceSettings.tsx` 등 컴포넌트 `react-hooks/set-state-in-effect` — 010b 파일 아님), `eslint exit=0`.
- `node --import tsx --test --test-concurrency=1 src/modules/learning/__tests__/task010b.test.ts src/app/api/v1/_lib/__tests__/review.test.ts` → `# pass 38 # fail 0`; speech 신규 → `# tests 4 # pass 4`(review 2 포함 실행분).
- 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → `# tests 1163 # pass 1162 # fail 0 # skipped 1`(learning+conversation 감사 시 421/421).
- **변이 검사**(미러에서만 바꾸고 NFS 와 `cmp` 동일 확인): ① 되살림 끔 → 2 FAIL ② studied 무시 → 2 FAIL ③ #64 IN_PROGRESS 검사 끔 → 1 FAIL ④ finalize 에서 normalize 우회 → 1 FAIL ⑤ DAILY 하루 1회 끔 → 1 FAIL — 5/5 검출, 복원 후 38/38.
- `timeout 900 flock ~/.node-local/thekaiwa-build.lock ./node_modules/.bin/next build` → `build exit=0`, 라우트 표에 `ƒ /api/v1/reviews/[id]/skip`·`ƒ /api/v1/reviews/[id]/start`. 경고 3건은 기존 `persona/loader.ts` 동적 fs(010b 무관). (이 미러에 NFS `next.config.ts` 를 한 번 복사했다 — 내용 동일.)

### 단위 테스트 36건(learning) 요지
순수: 세션 크기·가중치·추출 재현/비복원/4까지 채움/FOCUS·최근 감쇠(시드 300 집계)·가드 모양·공부한 날·A11 후보 순서·다음 복습일(KST 경계)·묶음·`nextReviewOf`·KST 하루 시작 / 항목: FOCUS 임계·뜻 스냅샷·출처 3종·교정 `studied:false`(0·null·피드백 1→3 FOCUS 3일)·복습 완료 `markRepetitionStudied`(타인·없는 id 건너뜀) / A11: 폴백·`applyReviewDecisions`(클램프·FOCUS 유지·마지막 학습일+간격·TUTOR/FALLBACK·근거 200)·`claimDecisionJob`(가드 null·DAILY 하루 1회·진행 중이면 그 잡·대기 잡 합치기·실행 중이면 새 잡·stale 대기 잡 무시) / 세션: 재추출 없음·due 없음 null·시드 재현·근거 300·폴백 문구·due 2 → 4 / 완료 DONE / 미리보기 FOCUS 먼저 / #64 ★⑦ 8케이스 / #63 ★③ 되살림·stale·살아 있는 잡·재사용 3상태·새 행+연결·409 GENERATING·NOT_DUE·타인 404 / 관측 행·교정 관측·DAILY 증가분·병합 / **가짜 커밋 저장소로 "채택 뒤 409 → 항목·관측·DAILY 0"**·거절·제안·단어 세트(세트 날짜 DAILY)·레슨 관측(quiz·말하기 5분기·STT 신뢰도) / #60 progress 서버 칸 숨김.

### 라이브 스모크(작성만) — `tests/live/task010b-smoke.{sh,ts}`
- **라이브 미실행(사유: 010c QA 와 QA 계정·쿼터 경합 — Leader 가 QA 종료 후 SendMessage 로 실행 지시 예정)**. tsc·eslint 만 통과 확인.
- 실행: 미러에서 `next dev -H 127.0.0.1 -p 3011` 띄운 뒤 `bash tests/live/task010b-smoke.sh 3011`(dev-010b 미러면 `KAIWA_MIRROR=~/.node-local/thekaiwa-dev-010b bash …`), 운영 `SMOKE_ENV=PRODUCTION bash tests/live/task010b-smoke.sh 3010`. QA1·QA2 전용. LLM: A11 3·A5 1·A3 1.
- 정리 방식: 시작 때 QA 두 계정의 관련 15개 테이블 id 집합을 찍고 끝에 **그 뒤 생긴 id 만** 삭제, 손댄 기존 반복 항목·오류 통계·DAILY 는 시작 전 값으로. 이전 실행이 남긴 표식 행(`refId smk010b-*`·분류 `t010b스모크`·채팅 제목 `smk010b`)만 시작 때 지움. QA1 에 오늘 복습 일정·오늘 판단 잡·진행 중 세트가 있으면 **아무것도 쓰지 않고 exit 2**(겹침). 주의: 스모크 정리는 QA 계정의 `LearningObservation` 테스트 행도 지운다(제품 경로에는 삭제 없음).
- 항목: 0 인증·404 / 1 QA2 가드 모양(기록이 이미 충분하면 NOTE) / 2 심기(옛 날짜 DAILY 2·8일 전 학습 due 6개 — A11 이 어떤 간격을 내도 due 유지) / 3 첫 #58 판단 잡·같은 잡·DONE·세션 필드·항목 3~7/FOCUS≤3·하루 1회 / 4 ★① / 5 ★⑧ FAILED 카드·IDOR·★③ 같은 행·재사용·만드는 중·A5·★② 키 고정·chunks⊆mixSpec·★⑦(QA2 FAILED 200·처리됨 409·타인 404) / 6 진행·★⑦ IN_PROGRESS 409·말하기·완료(세션 DONE·studied+1·정오답·REVIEW 로그·스냅샷·DAILY reviews·관측 8·DAILY observations)·2회째 409 행 0·A11 → #60 nextReview(3~7·FOCUS≤3·묶음 합)·서버 칸 숨김·#58 완료 카드·끝난 일정 409 / 7 A3 → PROPOSED 관측·IDOR·채택(EXPRESSION·studied 0·피드백 1)·재채택 피드백 2·거절 IGNORED·단어 중복 409 롤백 / 8 단어 세트 형태 불변·WORD 항목·카드 관측·DAILY(세트 날짜)·A11 1개·멱등 재호출 잡 0·단어 항목 판단 / 9 엔진명 0. 지표: `a11DailyMs`·`a11ReviewMs`·`a11WordsMs`·`a5Ms`·`a3Ms`.
- **A11/A5 라이브 측정 호출 순서**(Leader 실행 지시 때, 모두 순차 1건씩·429 면 중단): ① 단위 회귀(위 명령) → ② `node --env-file=.env --import tsx tests/live/review-decision-measure.ts`(PE 픽스처 3회 — 와이어링과 무관한 프롬프트 기준선) → ③ `tests/live/review-mix-measure.ts`(2회 — 6항목·3항목, 3항목은 `chunks` 4 미만 재시도 경로 확인) → ④ 스모크 `task010b-smoke.sh`(실제 와이어링: A11 DAILY → A5 → A11 REVIEW → A3 → A11 WORDS 순) → ⑤ 결과의 `metrics`·FAIL 을 이 task 에 기록.

### 데모·가이드와 달라진 점
- 서버만 — 화면 파일 0. 가이드 §14 와 다른 점: ① ★④ 값이 `TUTOR|FALLBACK`(가이드는 값 미정·"없으면 중립 문구") ② #58 에 `decisionJobId`(additive — 가이드는 #58 재조회 방식이라 안 써도 됨) ③ `review.score`·`reviewItems[].source`(additive 편의). ④ 클라이언트 타입 `src/types/lesson.ts` 는 2단계(화면)에서 맞출 것 — 지금은 025 가 미커밋으로 만지는 파일이라 손대지 않음.

### 남은 위험(Leader 판단 필요 표시 ★)
1. ★ **A11 호출 빈도**: design-spec §7-4 대로 레슨·복습·**단어 세트 완료마다** 판단 잡(대기 중 잡에만 합침)이고 "하루 1회" 는 #58 첫 진입(DAILY)에만 적용했다. 단어 세트를 하루 여러 번 하면 sonnet 호출도 그만큼(1회 ≈8s). 구독 쿼터가 문제면 "완료 트리거도 사용자당 N분 1회" 같은 상한이 필요 — 사양 결정 사항.
2. ★ 반복 항목이 **4개 미만**인 사용자(교정 채택만 2~3건)는 세션이 2~3개 → A5 첫 시도 `chunks` minItems 위반 → 1회 재시도로 회복(PE 실측 3항목 1/1 회복, 2항목은 미측정). 가드(재료 2)를 4로 올리거나 PE 지시문 보강 중 택일 — Leader·PE.
3. ★ **관측 신뢰도(010c L-3 후속)**: 레슨 말하기는 이제 발화 인식 신뢰도(0.5/분석 일치도/1.0)를 싣지만, 턴 경로(TALK 교정 제안·자기수정)는 여전히 1.0(+`meta.input`). A11 입력 요약(`summarizeRecentObservations`)은 신뢰도를 보지 않고 SUCCESS/FAIL 을 센다 — "낮은 신뢰도 관측 가중치 하향" 규칙(예: 0.6 미만 제외)은 정하지 않았다(설계 권한 밖 — Leader 범위 메모 대상).
4. **공유 트리 영향**: `recordObservations` 가 DAILY `observations` 를 같이 올리므로 010c 의 자기수정 관측도 이제 DAILY 를 바꾼다(Leader 지시 그대로). 010c QA 가 공유 트리로 dev 서버를 띄우면 #58 첫 진입이 QA 계정의 A11 잡을 걸 수 있다(가드 통과 시) — 쿼터 경합 원인이 될 수 있음.
5. 프로세스 안 판단 실행 줄: blue/green 전환·재시작으로 대기 잡이 죽으면 5분 뒤 stale → 그날 #58 은 폴백 세션(FALLBACK)으로 이어진다(재판단 없음 — 하루 1회 규칙).

### Reviewer(REV-061) 인계 포인트
- 6층: learning → conversation import 0(eslint 경계 통과), A11·A5 는 라우트 `_lib/review.ts` 가 driver·요청 값으로 넘김. 엔진명 grep(010b 파일) 0건.
- 집중 검토: ① `decision.ts runReviewDecisionJob` — completeJson 직후 finalize(normalize), 실패 시 같은 트랜잭션을 FALLBACK 으로, `markJobStage` 펜싱·`DecisionSuperseded` ② `claimReviewStart` 되살리기 + `generate.ts isCurrentJob(kind=REVIEW_GEN)` 세대 펜싱 ③ 잠금 순서(사용자 행 먼저 — #63·#64·복습 완료·판단 저장) ④ 교정 채택 `studied:false` 의미 변경(이전 Developer 코드 대비) ⑤ tx 안에서 전역 prisma 쓰기 금지(getProfile 이동) — 레슨 완료 tx 안의 `utteranceConfidences` 는 **읽기만**(다른 연결) ⑥ `Lesson.progress.reviewDecision` 서버 칸(#61 unknown_key 로 막힘·응답에서 숨김) ⑦ GET #58 의 부수 효과(EXPIRED 전이·DAILY 잡 적재·폴백 세션) ⑧ 스모크 정리 방식(id 집합 차이 삭제·기존 행 복원).
- QA high_risk_areas 후보: 하루 1회 판단·FOCUS ≤3·3~7 클램프·세션 ≥4·★③ 같은 행·★⑦·롤백 시 관측 0·DAILY observations 날짜(세트 날짜)·타인 404·엔진명 0.

```json
{ "taskId": "task-010b", "status": "DONE", "deliverables": ["서버 1단계 와이어링 감사·보완", "단위 40건(learning 36·app 2·speech 2)", "tests/live/task010b-smoke.{sh,ts}(미실행)", "api-contract #58·#60·#62·#63·#64(+#33·#35·#36·#51) additive", "domain-model §9-3·module-dependency §10"], "blockers": ["라이브 스모크·실 LLM 미실행 — 010c QA 종료 후 Leader 지시 대기"], "risk_level": "MEDIUM", "self_check": { "unit_test": true, "lint": true, "type_check": true, "engine_name_leak": false, "native_change": false } }
```

## Leader 기록 (서버 1단계 검수·★ 위험 결정, 2026-10-03 00:20)

- **직접 재실행**(Developer 보고를 그대로 믿지 않음): 미러 `~/.node-local/thekaiwa-dev-010b` 에서 NFS 와 `cmp` 일치(reviewSchedule/index·repetition/decision·task010b.test·task010b-smoke) → `tsc --noEmit --incremental false` 0 · eslint(repetition·reviewSchedule·observations·_lib/review·reviews·chats/[id]/review·task010b.test) 0 · `task010b.test.ts`+`review.test.ts` **38/38 통과**. 전체 스위트는 백그라운드 재실행 중(결과는 아래 REV-061 인계 때 확인).
- **★ 위험 5건 결정** (코드 변경 없음 — 리뷰 범위를 흔들지 않기 위해):
  1. **A11 호출 빈도 — 현행 유지, 계측만 추가.** 개인용 앱(초대코드 소수)이라 단어 세트 반복이 쿼터를 위협할 규모가 아니고, "대기 중 잡에 합침" 이 이미 폭주를 막는다. QA·배포 후 `a11*Ms` 지표로 사용자·일별 A11 호출 수를 센다. **하루 10회 초과가 관측되면** 그때 "완료 트리거 사용자당 N분 1회" 상한을 별도 작업으로 넣는다(사양 변경이라 선제 구현 안 함).
  2. **항목 4개 미만 사용자 — 가드는 현행 유지, PE 가 2항목 A5 를 1회 실측.** 3항목은 1회 재시도로 회복이 실측됐고, 2항목은 미측정이다. 010c QA 가 끝나 LLM 쿼터가 비면 PE 가 2항목 1회 호출을 돌려 **회복되면 현행 유지, 실패하면 가드 재료를 3으로 올린다**(가드 숫자만 바꾸므로 Developer 소규모 수정 → Reviewer 부터 재순환). 데모 결정 (d)B '곧 열려요' 문구는 그대로.
  3. **관측 신뢰도 가중치 — 규칙을 지금 정해 두고 구현은 2단계(또는 `task-010b-obs-conf`)로 미룬다.** 규칙: A11 입력 요약 `summarizeRecentObservations` 는 **confidence < 0.6 인 관측을 SUCCESS/FAIL 집계에서 빼고 `uncertain N` 으로 따로 넘긴다**(턴 경로는 1.0 이라 영향 없음, 레슨 말하기 STT 0.5 만 해당). A11 프롬프트 입력 필드가 늘어나므로 prompt-engineer 가 `reviewDecision@v2` 로 같이 다룬다. 지금 구현하면 이미 감사 대기 중인 프롬프트·집계 코드를 다시 흔들게 된다.
  4. **DAILY `observations` 증가가 010c 자기수정 관측에도 적용** — 의도된 동작으로 수용(관측은 출처와 무관하게 하루 기록). api-contract 에 이미 적힌 문장을 REV-061 이 확인한다.
  5. **재시작 중 A11 잡 소실 → 5분 뒤 FALLBACK** — 수용(하루 1회 규칙상 재판단 없음이 의도). QA 가 "stale 대기 잡이 가드를 막지 않는다" 를 단위+스모크 둘 다로 확인한다.
- **QA 쿼터 경합 주의(위험 4 의 실질)**: 010c QA 재실행이 쓰는 미러 `thekaiwa-qa-011b` 는 010b 서버 변경을 받기 전 사본이어야 한다 — 확인 전까지 010b 라이브 스모크·A11/A5 실측은 **보류**(Developer 에게 지시하지 않음).
- **다음**: ① 전체 스위트 확인 → ② **Reviewer REV-061 발주**(집중 검토 6점은 위 Developer 인계 그대로 + 결정 3 의 "구현 안 함" 이 범위 밖임을 명시) → ③ [Judge C2 → Codex?] → ④ 010c QA 종료 후 QA(+PE 2항목 실측). 2단계(화면)는 011 커밋 후 `check.mjs activate`.

## Reviewer 기록 (REV-061 — 010b 서버 1단계 감사, 2026-10-03 00:36)

> Read 전용 독립 감사. NFS 소스·문서는 수정하지 않았다(mutation 은 미러 `~/.node-local/thekaiwa-rev-061` 에서만, 전부 원복·NFS 와 `rsync -rcn src tests prisma` 차이 0 확인). 실제 LLM·DB 쓰기·운영 접근·`next dev`·`npm install`·`prisma generate`·git 변경 명령 모두 미사용.

### 판정: **PASS_WITH_NOTES** (스키마 판정 PASS — Critical 0 · High 0 · Medium 1 · Low 10)

- 감사 범위 7영역(아키텍처·유지보수성·안정성·운영성·성능·보안·학습 원칙) 전부 검토. 집중 점검 ①~⑩ 중 코드 결함으로 확정된 것은 없고, **자동 검증의 구멍 1건(Medium)** 과 Low 10건을 남긴다.
- **관측 신뢰도 가중(confidence < 0.6 제외)은 Leader ★ 결정 3(2단계 또는 `task-010b-obs-conf` + `reviewDecision@v2`)에 따라 결함으로 보고하지 않았다.**
- Codex 검토 결과는 전달되지 않아 채택/오탐 판정 대상 없음.

### 이슈 (output schema 요약)

```json
{
  "reviewId": "REV-061",
  "status": "CONDITIONAL_PASS(스키마) → PASS_WITH_NOTES(Medium 1·Low 10, High 0)",
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 10 },
  "native_change": false
}
```

#### Medium (1)

| # | 이슈 | 위치 | 근거·재현 | 권고 |
|---|---|---|---|---|
| M-1 | **A11 잡 러너 `runReviewDecisionJob` 의 핵심 불변식(잡 펜싱·LLM 실패 시 같은 트랜잭션 FALLBACK·사용자 행 잠금)을 결정적으로 검증하는 자동 테스트가 없다** | `src/modules/learning/repetition/decision.ts:357-412` (러너), `:213-232` (`drainDecisions`), `:145-163` (`scheduleReviewDecision`) | grep: `runReviewDecisionJob`·`scheduleReviewDecision`·`waitDecisionChain`·`DecisionSuperseded` 를 참조하는 테스트 0건(단위 `task010b.test.ts`·`review.test.ts`·smoke 모두). mutation 3종 **생존**: M11(`markJobStage` 펜싱·`DecisionSuperseded` 제거), M12(LLM 실패 시 `failJob`-같은-tx 대신 항상 `completeJob`), M13(저장 tx 의 `lockUserRow` 제거) → 78/78 통과. 정적 읽기로는 세 가지 모두 올바르다(`:392` 잠금 → `:393` 펜싱 → `:397-398` 분기). 다만 smoke 3c 는 실제 LLM 결과(DONE/FAILED)에 따라 분기해 결정적 FAILED·stale 경로를 못 만든다 | DB 없는 러너 단위 테스트 추가(주입 driver·`fakeTransaction`·`jobs` 페이크: ① LLM throw → plan=FALLBACK 저장+job FAILED 가 같은 tx ② `markJobStage=false` → 저장 0·`DecisionSuperseded` 삼킴 ③ `completeJob=false` → 롤백). 또는 smoke 에 LLM 실패 주입 모드. **차단 사유 아님 — QA 전 보강 권고, 2단계 착수 전까지** |

#### Low (10)

| # | 이슈 | 위치 | 비고 |
|---|---|---|---|
| L-1 | 교정 **재채택**(`studied:false`)이 기존 항목의 `nextDueAt`·`decidedBy=FALLBACK` 를 다시 쓴다 — 이미 강사가 판단한 항목의 일정이 재채택으로 초기화될 수 있음 | `observations/corrections.ts:56-61` → `repetition/index.ts markRepetition…` | ④: correct/wrong 집계는 `studied:false` 라 오염 없음(M15 로 확인), FOCUS 문턱(피드백≥3)은 `feedbackCount` 로만 오른다. 의도 범위 안이지만 일정 초기화는 사양 문구에 없음 — api-contract 에 한 줄 명시 권고 |
| L-2 | 3~7·FOCUS≤3 상수가 `reviewRepair.ts`(conversation)와 `repetition/index.ts`(learning)에 **이중 정의** | `conversation/structuredResponse/reviewRepair.ts` ↔ `learning/repetition/index.ts:91` | 층 규칙상 learning→conversation import 금지라 불가피. 양쪽 모두 테스트가 못 박음(M1·M2·M3 사망). 값이 갈라지지 않게 정본 문서 한 곳에 상수 표 권고 |
| L-3 | api-contract `#64` 제목 블록이 **중복**(1089·1094행) — 두 번째는 요약만 있고 첫 번째와 내용이 겹침 | `docs/design/api-contract.md:1089,1094` | 문서 정리 |
| L-4 | 교정 채택 라우트의 "같은 tx 합성"(채택+관측 등록) 롤백은 **단위가 아니라 미실행 라이브 smoke 7f** 로만 검증. 단위는 `registerAcceptedCorrection` 등록 함수만 `fakeTransaction` 으로 롤백 확인(M16 으로 비공허 확인) | `app/api/v1/corrections/[id]/accept/route.ts`, smoke 7f | QA 가 smoke 7f 를 실행할 때 확인 |
| L-5 | #58 GET 이 `expireOldSchedules` 로 **쓰기**를 한다(만료 전이) — 소유자 범위·멱등이라 안전하나 "GET 부작용" 범주 | `reviewSchedule/index.ts:75`, `core.ts:140` | 사용자 범위·`updateMany` 조건부. 문서에 부작용(A11 적재·만료·폴백 세션)을 이미 적음 |
| L-6 | `drainDecisions` 는 QUEUED 잡을 조건부 갱신으로 집지만 **stale 검사가 없다**(재시작 뒤 오래된 QUEUED 가 있으면 그대로 실행) | `decision.ts:213-232` | `jobs` 의 REVIEW_DECISION stale 5분 정리는 별도 경로. 하루 1회 규칙과 충돌은 없음(`decisionJobToday`) — 관찰 |
| L-7 | 후보가 비면 A11 잡이 **FALLBACK 으로 DONE** 처리(항목 0건 저장·오늘 세션만 시도) | `decision.ts` 빈 후보 분기 | 의도된 단락이나 Trace `steps` 에 빈 후보 표시 없음 — 운영성 관찰 |
| L-8 | 레슨 완료 tx 가 열린 동안 `utteranceConfidences`(speech)를 **전역 prisma(읽기)** 로 조회 — 두 번째 커넥션 사용 | `app/api/v1/lessons/[id]/complete/route.ts:22`, `speech/utterances/confidence.ts:17` | 쓰기 아님(⑤ 충족). 풀 고갈 위험은 낮음(사용자당 분당 한도). 관찰 |
| L-9 | `reviewDecision` 서버 전용 칸의 #61 쓰기 차단(400 `unknown_key`)에 **전용 테스트 없음** — M9(화이트리스트에 `'reviewDecision'` 추가) 생존. 다만 `parseProgressPatch`·`mergeProgress` 가 그 키를 복사하지 않아 사실상 등가 변이(near-equivalent) | `learning/lessons/progress.ts:117`, `rows.ts:59-62` | 응답 은닉(`publicProgress`)은 smoke 6k 가 확인. 단위 한 건 권고 |
| L-10 | 건너뛰기를 **GENERATING 중** 하면 `REVIEW_GEN` 잡이 계속 돌고 READY 복습 레슨이 SKIPPED 세션에 연결된 채 남는다(고아) | `reviewSchedule/core.ts skipReviewIn`, Leader ★⑦ | **설계 결정(★⑦)** 이라 결함 아님 — 목록은 `kind:'NEW'` 만 resume 하므로 노출 없음. 관찰만 |

(참고) `components/settings` 테스트 하나가 `modules/preferences/voiceRanges` 를 import 하는 것이 보였으나 010b 범위 밖(022)이라 목록에서 제외.

### 집중 점검 ①~⑩ 결과

| ① | A11 러너: normalize 직후 3~7·FOCUS≤3·풀 밖 itemIds 폐기, 실패 시 같은 tx FALLBACK, 펜싱 | 정적 OK(`reviewRepair.normalizeReviewDecision` + `applyReviewDecisions` 이중 clamp, M3·M8·M14 사망). **러너 자체 테스트 부재 → M-1** |
|---|---|---|
| ② | `claimReviewStart` 같은 행 되살림(GENERATING)·`isCurrentJob(REVIEW_GEN)` 세대 펜싱 | OK(M5 사망, `generate.ts`·`jobs.ts` 읽음) |
| ③ | 잠금 순서(사용자 행 먼저) — #63·#64·복습 완료·A11 저장 | OK — 역방향 잠금 없음(교착 사이클 불성립). `api-contract` 잠금 문단과 코드 일치 |
| ④ | 교정 채택 `studied:false` 의미 변경 | OK(집계 오염 없음, M15 사망) — 재채택 일정 초기화는 L-1 |
| ⑤ | tx 안 전역 prisma **쓰기** 0, `utteranceConfidences` 읽기 전용 | OK(L-8 관찰) |
| ⑥ | `progress.reviewDecision` 서버 전용(#61 차단·응답 은닉·병합 보존) | OK — 차단 테스트 전용 케이스 부재 L-9 |
| ⑦ | #58 GET 부작용의 소유자·하루 1회, 타인 id 404 무누출 | OK(세션 사용자 범위, `skipReviewIn`·`lockSchedule` 소유자, M7a/b/c 사망) |
| ⑧ | 사용자 직접 행위 StudyLog(DIRECT)+StatsSnapshot 단일 tx, 롤백 시 0 | OK — `fakeTransaction` 이 **공허하지 않음**(M16: draft→직접 저장으로 바꾸면 `[0,0,0]` 단언이 실패) |
| ⑨ | 6층 경계·엔진명·Secret | OK — learning→conversation/speech import 0, learning→app/components 0, speech/worker prisma 0, 010b 파일 엔진명 grep 0, Trace `steps` 는 개수·ms·decidedBy 뿐(원음·전체 대화·Secret 없음) |
| ⑩ | api-contract·domain-model·module-dependency ↔ 코드 | OK(`nextReview.decidedBy ∈ TUTOR/FALLBACK`, `review.score`, `reviewItems[].source`, `decisionJobId`, 오류 코드) — L-3 중복 제목만 |

### 실행한 명령과 결과 요약

| 명령(미러 `~/.node-local/thekaiwa-rev-061`, node_modules 는 `thekaiwa-dev-010b` 심볼릭) | 결과 |
|---|---|
| `tsc --noEmit --incremental false` | exit 0 (`/tmp/claude-1000/rev061/tsc.log`) |
| `eslint` (감사 범위 파일 전체) | exit 0 (`eslint.log`) |
| `node --import tsx --test --test-concurrency=1` 010b 3개 파일(`task010b.test.ts`·`_lib/__tests__/review.test.ts`·`utteranceConfidence.test.ts`) | tests 40 · pass 40 · fail 0 (`test-base.log`) |
| 같은 방식 전체 스위트 | tests 1163 · pass 1161 · fail 0 · skipped 2 (`test-full2.log`) |

- **이상 징후 기록**: (a) 첫 백그라운드 010b 실행이 `exit=1` 만 남기고 출력이 없었다 — 포그라운드 재실행 2회 모두 40/40·exit 0, 재현 안 됨(실행 레이스 추정). (b) 전체 스위트 첫 실행은 미러에 `.claude/agents/tutor.md` 가 없어 `PersonaUnavailableError`(ENOENT)로 94건 실패 — **제품 결함이 아니라 미러 환경 누락**, NFS 의 `tutor.md` 를 미러에만 복사해 재실행 → 0 fail. 브랜드 테스트 2건 skip 은 미러에 `android/` 가 없어서다. Developer 보고 1162 vs 이번 1161+2skip 차이는 이 환경 요인.

### Mutation 표 (미러 한정, 각 실행 뒤 원복·동일성 확인, 대상 테스트 78개 = `task010b`+`task010`+`_lib/review`+`conversation/reviewDecision`)

| ID | 변이 | 기대 | 실제 |
|---|---|---|---|
| M1 | learning `clampInterval` 의 3~7 clamp 제거 | 실패 | **사망** (5 fail) |
| M2 | learning `clampInterval` 의 FOCUS≤3 상한 제거 | 실패 | **사망** (6 fail) |
| M3 | `reviewRepair` clamp 3~7 제거 | 실패 | **사망** (2 fail) |
| M4 | `pickReviewSession` 4건 채우기 제거 | 실패 | **사망** (2 fail) |
| M5 | #63 되살림: 같은 행 → 새 행 | 실패 | **사망** (2 fail) |
| M6 | `skipReviewIn` IN_PROGRESS 409 제거 | 실패 | **사망** (1 fail) |
| M7a | `lockSchedule` 소유자 `AND userId` 제거 | 실패 | **사망** (3 fail) |
| M7b | `skipReviewIn` `findFirst` 소유자 제거 | 실패 | **사망** (1 fail) |
| M7c | `markRepetitionStudied` `findMany` 소유자 제거 | 실패 | **사망** (1 fail) |
| M8 | `normalizeReviewDecision` 풀 밖 itemId 폐기 제거 | 실패 | **사망** (3 fail) |
| M9 | #61 화이트리스트에 `'reviewDecision'` 추가 | 실패 | **생존** (78/78) — 근사 등가(L-9) |
| M11 | `decision.ts` `markJobStage` 펜싱·`DecisionSuperseded` 제거 | 실패 | **생존** (78/78) → M-1 |
| M12 | `decision.ts` LLM 실패 시 같은-tx `failJob` 제거(항상 `completeJob`) | 실패 | **생존** (78/78) → M-1 |
| M13 | `decision.ts` 저장 tx 의 `lockUserRow` 제거 | 실패 | **생존** (78/78) → M-1 |
| M14 | `applyReviewDecisions` 의 `priorityAfterFeedback` 제거 | 실패 | **사망** (1 fail) |
| M15 | `registerAcceptedCorrection` `studied:false→true` | 실패 | **사망** (1 fail) |
| M16 | 테스트 `fakeTransaction` draft→직접 저장(롤백 비공허성) | 실패 | **사망** (1 fail) |

17건 실행(M10 은 결번) — 13 사망 · 4 생존(M11·M12·M13 = 러너 테스트 부재, M9 = 근사 등가).

### 기각한 후보
- "FOCUS 항목 수 상한 3" — design-spec §7-4 의 FOCUS≤3 은 **간격 상한**(항목 수 아님)이라 결함 아님.

### QA `high_risk_areas`

```json
{
  "high_risk_areas": [
    "A11 러너 runReviewDecisionJob: LLM 실패 시 FALLBACK 이 같은 tx 로 저장되고 잡이 FAILED 로 닫히는지(smoke 3c 는 실제 결과에 따라 분기 — 결정적 실패 주입 필요)·stale 5분 잡·DecisionSuperseded 로 결과 폐기·사용자 행 잠금(M11·M12·M13 생존)",
    "#63 복습 시작: FAILED 복습 레슨을 같은 행으로 되살림·REVIEW_GEN 세대 펜싱·재클릭 reused·타 사용자 404",
    "#64 건너뛰기: IN_PROGRESS 409·NOT_DUE 409·GENERATING/READY/FAILED 허용(★⑦)·타인 404·조건부 DUE 전이",
    "교정 채택 트랜잭션(채택+관측+RepetitionItem+DAILY) 롤백 시 0행 — smoke 7f(단위는 등록 함수만)",
    "#58 GET 부작용: A11 적재 하루 1회·폴백 세션·expireOldSchedules·타인 id 404 무누출",
    "Lesson.progress.reviewDecision 서버 전용 칸: #61 400 unknown_key·#60/#58 응답 은닉·병합 보존(smoke 6k)",
    "레슨 완료 tx: utteranceConfidences 전역 prisma 읽기(두 번째 커넥션)·StudyLog(DIRECT)+StatsSnapshot 단일 tx",
    "3~7 clamp·FOCUS≤3·피드백≥3 승격·세션 4~12 채우기",
    "교정 재채택 시 기존 항목 nextDueAt·decidedBy 초기화(L-1)"
  ]
}
```

### Judge C2 의견
**권고 — C2 를 돌려 Codex 검토를 붙일 것.** 초점은 `decision.ts` 동시성(사용자별 인프로세스 체인 `chains`, QUEUED 병합 `updateMany`, `markJobStage` 펜싱 vs 사용자 행 잠금 순서)과 A11 저장 tx 안 `failJob`/`completeJob` 분기. 이 영역이 M-1 로 자동 검증 구멍이 있는 곳이라 외부 시선의 가치가 가장 크다. Codex 가 off 이거나 예산이 소진이면 M-1 의 러너 단위 테스트 보강으로 갈음 가능(차단 사유 아님).

### 미실행 (사유)
- 라이브 smoke `tests/live/task010b-smoke.{sh,ts}` 실행 — 지시 금지(DB 쓰기·실제 LLM), 정적 읽기만(546행 중 단언 목록·분기 확인).
- 실제 LLM(A11·A5·A3) 호출·품질 확인 — 금지.
- DB 쓰기·`db push`·`prisma generate`, 운영 서버 접근, `next dev`, `npm install` — 금지.
- 요청 수준(HTTP) 런타임 검증(skip 라우트·#58 GET·교정 accept 라우트 실호출) — DB 필요로 미실행, 정적 읽기와 단위로 대체. QA 가 smoke 로 확인.
- `prompts/reviewMix.ts`·`conversation/review/index.ts` 는 010b 와이어링 부분(`ReviewHooks.recordCorrectionsProposed`, 교착 재던짐·그 외 경고만)만 읽음 — reviewMix@v2·lesson@v8 은 task-025 범위로 제외.
- `git diff`/상태 외의 git 변경 명령 일절 미사용.

### 데모 검토 게이트
이번 단계는 서버 전용 1단계(화면 변경 없음)라 `check.mjs check` 대상이 아니다 — 2단계(화면)는 011 커밋 후 `check.mjs activate`(Leader 기록). `evidence.jsonl` 의 승인 줄 대조·`approve`/`waive` 대리 실행 흔적 점검은 화면 변경이 없는 단계라 이번 감사에서 **미확인(대상 아님)**.

→ 다음: Developer 가 M-1 러너 테스트(권고)·L-1 문구·L-3 중복 정리를 처리하고 `task010b` 재실행 → Judge C2 → (Codex?) → QA.

## Developer 기록 (REV-061 반영, 2026-10-03 00:42)

> `dev-010b-server`. REV-061 지시 3건(M-1·L-9·문서 L-1/L-3)만 처리. 라이브 스모크·실 LLM·DB 쓰기·`db push`·`generate`·`npm install`·commit·push·git 되돌리기 명령·포트·QA 계정 **미사용**. 미러 `~/.node-local/thekaiwa-dev-010b`(`rsync -a --delete` 로 `src/`·`tests/` 동기화)에서만 실행.

### 변경 파일
| 파일 | 변경 |
|---|---|
| `src/modules/learning/repetition/decision.ts` | **최소 seam(동작 변경 없음)** — 아래 diff 그대로. Reviewer 는 이 부분만 재확인하면 된다 |
| `src/modules/learning/__tests__/task010b.test.ts` | 테스트 7건 추가(36 → 43), import 2줄(`runReviewDecisionJob`·타입 3종, `parseProgressPatch`) |
| `docs/design/api-contract.md` | L-3: `#64` 중복 제목 줄(옛 요약 "`#64 … → {id,status:"SKIPPED",resolvedAt}`. 다음 학습일에 코드가 다시 DUE 를 만든다.") 삭제 — 같은 내용이 바로 위 `#64` 본문 둘째 줄("다음 학습일에 코드가 다시 DUE 세션을 만든다")에 있어 내용 손실 없음. L-1: `#35` task-010b 단락에 "재채택 때 일정 다시 정함(의도)" 한 문장 |
| `docs/design/domain-model.md` | L-1: §9-3 표에 `RepetitionItem`(교정 재채택 갱신) 행 1줄 |

**seam diff(`decision.ts`, +29 −8 — `runReviewDecisionJob` 이 바깥과 닿는 7곳을 주입 가능하게, 기본값 = 기존 호출 그대로)**:
```diff
+export interface DecisionRunnerDeps {
+  readJob(userId, jobId): Promise<{ payload; traceId } | null>
+  loadMaterials(userId, today): Promise<ReviewDecisionMaterials>
+  completeJson: typeof llm.completeJson
+  dailyMinutes(userId): Promise<number | null | undefined>
+  transaction: <R>(fn: (tx: Tx) => Promise<R>) => Promise<R>
+  updateJobProgress: typeof jobs.updateJobProgress
+  recordTrace: typeof recordTrace
+}
+const RUNNER_DEPS: DecisionRunnerDeps = {
+  readJob: (userId, jobId) => prisma.aiJob.findFirst({ where: { id: jobId, userId }, select: { payload: true, traceId: true } }),
+  loadMaterials: (userId, today) => loadReviewDecisionMaterials(userId, today),
+  completeJson: (req) => llm.completeJson(req),
+  dailyMinutes: async (userId) => (await getProfile(userId)).dailyMinutes,
+  transaction: (fn) => withTransaction(fn),
+  updateJobProgress: (id, progress, stage) => jobs.updateJobProgress(id, progress, stage),
+  recordTrace: (t) => recordTrace(t),
+}
-export async function runReviewDecisionJob<T>(userId, jobId, driver): Promise<void> {
+export async function runReviewDecisionJob<T>(userId, jobId, driver, deps: DecisionRunnerDeps = RUNNER_DEPS): Promise<void> {
-  const job = await prisma.aiJob.findFirst({ where: { id: jobId, userId }, select: { payload: true, traceId: true } })
+  const job = await deps.readJob(userId, jobId)
-    const m = await loadReviewDecisionMaterials(userId, today)
+    const m = await deps.loadMaterials(userId, today)
-        await jobs.updateJobProgress(jobId, 10, 'LLM')
+        await deps.updateJobProgress(jobId, 10, 'LLM')
-        const r = await llm.completeJson({ ...request, priority: 'batch', traceId })
+        const r = await deps.completeJson({ ...request, priority: 'batch', traceId })
-    const { dailyMinutes } = await getProfile(userId)
-    const saved = await withTransaction(async (tx) => {
+    const dailyMinutes = await deps.dailyMinutes(userId)
+    const saved = await deps.transaction(async (tx) => {
-    void recordTrace({ … })
+    void deps.recordTrace({ … })
```
- 트랜잭션 **안**의 코드(`lockUserRow` → `jobs.markJobStage` → `applyReviewDecisions` → `ensureTodaySchedule` → `recordLessonDecisions` → `failJob`/`completeJob` 분기·`DecisionSuperseded`)는 **한 글자도 안 바꿨다** — 그 줄들은 넘겨받은 `tx` 만 쓰므로 가짜 tx 로 그대로 검증된다. `drainDecisions` 는 4번째 인자를 안 넘겨 기본값(운영 구현)을 쓴다. `scheduleReviewDecision` 은 무변경(본체 `claimDecisionJob` 은 이전에 단위 테스트됨).
- `withTransaction` 의 기본 `opts`(재시도 2·15s)는 `(fn) => withTransaction(fn)` 로 그대로 적용된다.

### 추가한 테스트(`task010b.test.ts`)
| 테스트 이름 | 무엇을 고정하나 |
|---|---|
| `L-9 #61: 서버 전용 칸 reviewDecision 은 클라이언트가 쓸 수 없다(400 unknown_key)` | 단독·정상 칸과 섞임 두 경우 `VALIDATION unknown_key` |
| `M-1 ① A11 실패(LLM throw) → FALLBACK 저장과 잡 FAILED 가 같은 트랜잭션 하나(잠금 → 펜싱 → 저장 → FAILED)` | 트랜잭션 1회 · tx 연산 `lock → job:SAVE:1 → … → job:FAILED:1`(DONE 없음) · 잡 FAILED/`ENGINE_TIMEOUT` · 항목 FALLBACK(지난 간격·코드 근거) · 세션 FALLBACK · 레슨 판단 기록 FALLBACK · Trace ERROR |
| `M-1 ①′ 같은 트랜잭션 증명: 커밋이 실패하면 FALLBACK 저장도 잡 FAILED 도 둘 다 없다(러너는 던진다)` | FAILED 전이를 tx 안에서 시도한 뒤 커밋 실패 → 항목·세션·레슨·잡 전부 시작 상태(잡 RUNNING) |
| `M-1 ② 펜싱: 잡이 이미 닫혔으면(markJobStage=false) 잠금 뒤 바로 멈추고 저장 0 — DecisionSuperseded 는 삼킨다` | tx 연산이 정확히 `['lock','job:SAVE:0']` · resolve(삼킴) · 변화 0 · 잡 FAILED(stale) 유지 |
| `M-1 ③ completeJob=false(저장 직전 잠금 밖 stale 정리에 짐) → 트랜잭션 전체 롤백·결과 버림(삼킴)` | 저장은 시도(`items:update`·`schedule:create`) → `job:DONE:0` → 롤백 → 변화 0 · 잡은 바깥이 쓴 FAILED(stale) |
| `M-1 ④ 정상: 강사 판단 → 항목 TUTOR(3~7·FOCUS ≤3)·세션 TUTOR·레슨 판단 기록·잡 DONE(같은 tx, 잠금 먼저)` | `lock → job:SAVE:1 → … → job:DONE:1`(FAILED 없음) · 9일 → 7·FOCUS 3 · 기존 진행 칸 보존 · Trace OK |
| `M-1 ⑤ 후보가 없으면 LLM 을 부르지 않고 같은 tx 로 잡 DONE(항목 0건·FALLBACK 근거) — REV-061 L-7 현행 동작 고정` | LLM 0회 · 잠금 먼저 · 항목 쓰기 0 · 잡 DONE |

가짜 세계(`runnerWorld`): 저장 트랜잭션이 저장소 **사본**에 쓰고 콜백이 끝까지 성공해야만 반영(롤백 흉내), tx 안 연산 순서를 `ops` 에 기록, `beforeJobWrite` 로 "잠금 밖 stale 정리가 먼저 커밋됨"을 흉내, `failCommit` 으로 커밋 실패 주입. LLM 오류는 `name='LlmTimeoutError'` Error(→ `ENGINE_TIMEOUT`).

### 변이 재확인(미러에서만 적용 → 실행 → NFS 파일로 원복 · `cmp` 동일 확인)
| 변이 | 내용 | 기대 | 실제(`task010b.test.ts` 43건) |
|---|---|---|---|
| M11a | `markJobStage` 펜싱 줄 삭제 | 실패 | **사망** — 39 pass / 4 fail(①·②·③·④) |
| M11b | `catch` 의 `DecisionSuperseded` 삼킴 삭제 | 실패 | **사망** — 41 / 2 fail(②·③) |
| M12 | LLM 실패에도 같은 tx `failJob` 대신 항상 `completeJob` | 실패 | **사망** — 41 / 2 fail(①·①′) |
| M13 | 저장 tx 의 `lockUserRow` 삭제 | 실패 | **사망** — 38 / 5 fail(①·②·③·④·⑤) |
| M9 | #61 화이트리스트에 `'reviewDecision'` 추가 | 실패 | **사망** — 42 / 1 fail(L-9) |
| 원복 | `decision.ts`·`progress.ts` NFS 와 `cmp` 동일 | 통과 | 43 / 0 fail |

### 명령과 원 출력 요약(미러)
- `./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json` → 출력 0줄, `tsc exit=0`.
- `./node_modules/.bin/eslint src tests/live/task010b-smoke.ts` → `✖ 5 problems (0 errors, 5 warnings)`, `eslint exit=0` — 경고 5건은 컴포넌트(`react-hooks/set-state-in-effect`, 이전과 같음), 010b 파일 0건.
- 010b 관련 `node --import tsx --test --test-concurrency=1 src/modules/learning/__tests__/task010b.test.ts src/app/api/v1/_lib/__tests__/review.test.ts src/modules/speech/__tests__/utteranceConfidence.test.ts` → `# tests 47 # pass 47 # fail 0 # skipped 0`(43+2+2).
- 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → `# tests 1170 # pass 1169 # fail 0 # skipped 1`(이전 1163 + 이번 7).

### Reviewer 재확인 범위
- `decision.ts` seam(위 diff) — 기본값이 이전 호출과 1:1 인지, 트랜잭션 안 코드 무변경인지. 그 밖 운영 코드 변경 없음. 문서 2곳(api-contract #35·#64, domain-model §9-3 한 행).
- 남은 Low(L-2·L-4·L-5·L-6·L-8·L-10)는 REV-061 판정대로 관찰·QA 확인 항목이라 이번 범위에서 손대지 않았다.

## Leader 기록 (REV-061 반영 수용, 2026-10-03 00:43)

Developer 보고(M-1 러너 테스트·L-9·문서 L-1/L-3)를 직접 확인했다.
- 미러 `thekaiwa-dev-010b` ↔ NFS `src/` 차이는 `components/talk/TalkRoom.tsx` 1개뿐(010c 개발자가 병렬로 수정 중인 파일, 010b 무관). `decision.ts` 는 동일(`diff -q`).
- Leader 가 `decision.ts` 355–440행 seam 을 직접 읽음: 기본 `RUNNER_DEPS` 가 이전 호출(`prisma.aiJob.findFirst`·`loadReviewDecisionMaterials`·`llm.completeJson`·`getProfile().dailyMinutes`·`withTransaction`·`jobs.updateJobProgress`·`recordTrace`)과 1:1, 트랜잭션 안 줄(`lockUserRow → markJobStage → applyReviewDecisions → ensureTodaySchedule → recordLessonDecisions → failJob|completeJob`)은 무변경. 운영 호출자(`drainDecisions`)는 4번째 인자를 넘기지 않아 기본값을 쓴다.
- Leader 재실행(미러, 원 출력): `tsc --noEmit` → exit 0·출력 0줄 / `eslint decision.ts task010b.test.ts` → exit 0 / `task010b.test.ts` → `# tests 43 # pass 43 # fail 0`.
- 운영 코드가 바뀌었으므로(동작 변경 없는 seam) **Reviewer 가 seam diff 와 변이 M11–M13·M9 사망 여부를 재확인**한다(REV-064, `decision.ts` + 새 테스트 7건 한정). 그 뒤 Judge C2(Reviewer 권고: `decision.ts` 동시성 중심 Codex, 010b Codex 0/4) → QA.
- 남은 Low(L-2·L-4·L-5·L-6·L-8·L-10)는 REV-061 판정대로 QA 관찰 항목. 확률 가중(관측 신뢰도)은 이번 범위 밖(`task-010b-obs-conf` + `reviewDecision@v2`).

## Reviewer 기록 (REV-064 — 010b seam·러너 테스트 재감사, 2026-10-03 00:51)

> Read 전용 독립 재감사(REV-061 이후 Developer 변경분 한정). NFS `src/`·`tests/`·`docs/` 는 수정하지 않았다 — 변이는 미러 `~/.node-local/thekaiwa-rev-061` 에서만(미러 동기화 00:45:18, `.claude/agents/tutor.md` 포함·`TalkRoom.tsx` 제외), 변이마다 NFS 원본을 덮어 복원하고 `cmp` 로 확인(전부 `cmp-OK`). 실제 LLM·DB 쓰기·`next dev`·`npm install`·`prisma generate`·`db push`·git 변경 명령·포트·QA 계정 모두 미사용. 데모 검토 절은 건드리지 않았다.

### 판정: **PASS** (Critical 0 · High 0 · Medium 0 · Low 2 — 둘 다 관찰·비차단)

- REV-061 **M-1 해소**(러너 불변식이 결정적 단위 테스트 7건 + 변이 12/12 사망으로 고정), **L-1 해소**(재채택 일정 재설정이 문서로 의도 명시, 코드와 일치), **L-3 해소**(#64 중복 제목 병합, 내용 손실 없음), **L-9 해소**(`unknown_key` 전용 테스트, M9 사망). REV-061 Low L-2·L-4·L-5·L-6·L-8·L-10 은 지시대로 재론하지 않는다(판정 유지).
- 7영역 중 이번 변경분과 닿는 영역(① 아키텍처·② 유지보수성·③ 안정성·⑦ 학습 원칙)을 코드로 확인했고, ④ 운영성·⑤ 성능·⑥ 보안은 변경분이 닿지 않음을 diff 로 확인(아래 "범위").
- Codex 검토 결과는 이 단계에 전달되지 않아 채택/오탐 판정 대상 없음.

### 1. seam(`decision.ts`) 동작 무변경 검증 — 결함 없음

방법: REV-061 미러에 둔 seam 이전 사본(415행)과 현재 파일(436행)을 `diff`. 변경은 인터페이스·기본값 상수·호출부 치환뿐이다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 기본값이 옛 호출과 1:1 | OK | `RUNNER_DEPS`(`decision.ts:367-375`): `readJob`=`prisma.aiJob.findFirst({where:{id,userId},select:{payload,traceId}})`, `loadMaterials`=`loadReviewDecisionMaterials`, `completeJson`=`llm.completeJson`, `dailyMinutes`=`(await getProfile(userId)).dailyMinutes`, `transaction`=`withTransaction`, `updateJobProgress`=`jobs.updateJobProgress`, `recordTrace`=`recordTrace` — 시그니처·인자 순서 동일 |
| 트랜잭션 내부 줄 불변 | OK | 저장 tx(`:412-`)의 `lockUserRow → jobs.markJobStage(jobId,90,'SAVE',tx) → applyReviewDecisions → ensureTodaySchedule → recordLessonDecisions → failJob(tx)/completeJob(tx)` 가 사전 사본과 바이트 동일. `deps.transaction` 으로 바뀐 것은 `withTransaction` 호출 한 곳뿐이고, 트랜잭션 안은 여전히 전역 `prisma` 를 쓰지 않고 `tx` 만 쓴다 |
| 운영 호출부 | OK | 운영 호출은 `drainDecisions` 의 `decision.ts:221` `runReviewDecisionJob(userId, job.id, driver)` 한 곳, 4번째 인자 없음 → `RUNNER_DEPS` |
| 공개 면 | OK | `learning/index.ts:44-45` 는 `scheduleReviewDecision`·`REVIEW_FALLBACK_REASON_KO` 와 타입만 재노출 — `DecisionRunnerDeps`·`runReviewDecisionJob` 은 새로 노출되지 않는다. 테스트는 같은 모듈(`learning/__tests__`)에서 직접 import 하므로 `index.ts` 우회 아님 |
| 6층·엔진명 | OK | `grep -rniE 'reazon|whisper|style-bert|claude'` 가 `decision.ts` 에서 0건. 새 import 없음(하위 층 `infra`·`engine/trace`·`llm` 어댑터 경유 그대로) |
| 시그니처 호환 | OK | 4번째 인자 기본값이라 기존 호출 3인자 호환. `tsc --noEmit` exit 0 |

### 2. 새 테스트 7건(`task010b.test.ts` L-9 `:927`, `runnerWorld` `:977`, M-1 ① `:1074` ①′ `:1092` ② `:1103` ③ `:1115` ④ `:1137` ⑤ `:1153`) 감사

- **가짜 환경 충실도 — 양호.**
  - `tx.aiJob.updateMany` 는 `where.status.in` 에 현재 상태가 있을 때만 count 1(= 실제 `jobs.markJobStage`·`completeJob`·`failJob`(`infra/jobs.ts`)의 `status in [QUEUED, RUNNING]` 조건부 전이와 같은 의미). 닫힌 잡이면 count 0 이라 ②·③ 이 현실의 분기를 탄다.
  - 롤백은 `transaction` 이 저장소를 `draft` 로 복제해 콜백이 **끝까지 성공했을 때만** `Object.assign(store, draft)`(`:1059-1061` 근처). 콜백이 던지면(`DecisionSuperseded`) 초안 폐기 = Prisma 대화형 트랜잭션의 throw → 롤백과 같다. `failCommit` 은 콜백 완료 **뒤** 던져 "쓰기는 다 했는데 커밋이 실패"를 흉내 낸다(①′).
  - ③ 의 `beforeJobWrite` 는 `draft.job` 과 `store.job` 을 **둘 다** FAILED 로 바꿔, 잠금 밖에서 먼저 커밋된 stale 정리(READ COMMITTED)를 정확히 모사한다.
  - 연산 기록(`ops`)은 가짜 `tx` 메서드가 실제로 불린 순서로 쌓인다(호출 시점 push) — 러너 코드의 순서를 반영하지, 테스트가 정해 둔 순서를 재생하지 않는다.
- **공허 통과(vacuous pass) 위험 — 없음.** 실패 주입(`llm:'throw'`)·`completeJson` 호출 횟수·`transaction` 호출 횟수(=1)·저장소 전/후 `JSON.stringify` 비교(`unchanged`)를 함께 단언해, 아무것도 실행되지 않아도 통과하는 경로를 막았다. 변이 12/12 사망이 이를 실증한다.
- **호출 순서 과적합 — 의도된 범위 안(Low 관찰 L-11).** 단언 대부분이 불변식 자체(잠금 먼저·펜싱 바로 다음·잡 전이가 같은 tx)라 순서 고정이 곧 계약이다. 다만 `ops.at(-1)`(`:1081,1097,1131,1143,1160`)과 ② 의 `deepEqual(w.ops, ['lock','job:SAVE:0'])`(`:1109`)는 "마지막 쓰기가 잡 전이" 라는 현재 구현에 묶여, 훗날 같은 tx 안에 무해한 쓰기(예: 감사 행)를 뒤에 추가하면 오탐으로 깨진다. 같은 tx 보장은 ①′(커밋 실패 시 전부 롤백)가 순서와 무관하게 이미 독립 증명하므로, 마지막-쓰기 단언은 "의도 문서화" 로 보고 유지해도 무방.

### 3. 변이 재실행 — 내 원 출력(미러, `node --import tsx --test --test-concurrency=1 …/task010b.test.ts`)

기준선(변이 전, 미러): `tsc --noEmit` exit 0 · `eslint`(decision.ts·task010b.test.ts·lessons/progress.ts) exit 0, 출력 0줄 · `task010b.test.ts` exit 0 `# tests 43 # pass 43 # fail 0`.

| ID | 변이(미러에서만) | exit | `# tests/pass/fail` | 죽은 테스트·원인 | 복원 |
|---|---|---|---|---|---|
| M11a | 저장 tx 의 펜싱(`markJobStage`) 줄 삭제 | 1 | 43/39/4 | ①②③④ `ERR_ASSERTION` | cmp-OK |
| M11b | `DecisionSuperseded` 삼킴(catch 블록) 삭제 | 1 | 43/41/2 | ②③ — `error: 'review decision superseded'` 가 밖으로 샘 | cmp-OK |
| M12 | LLM 실패에도 항상 `completeJob` | 1 | 43/41/2 | ①①′ — `expected: 'job:FAILED:1'` `actual: 'job:DONE:1'` | cmp-OK |
| M13 | 러너 저장 tx 의 `lockUserRow` 삭제 | 1 | 43/38/5 | ①②③④⑤ — `expected: 'lock'` `actual: 'job:SAVE:1'` | cmp-OK |
| M9 | #61 화이트리스트에 `'reviewDecision'` 추가 | 1 | 43/42/1 | L-9(`#61`) — `Missing expected exception.` | cmp-OK |
| X1 | `completeJob` false 를 무시(롤백 대신 커밋) | 1 | 43/42/1 | ③ | cmp-OK |
| X2 | 잠금 ↔ 펜싱 순서 역전 | 1 | 43/38/5 | ①②③④⑤ | cmp-OK |
| X3 | 폴백도 `decidedBy=TUTOR` 로 기록 | 1 | 43/42/1 | ① | cmp-OK |
| X4 | 후보 0건에도 LLM 호출 | 1 | 43/42/1 | ⑤ | cmp-OK |
| X5 | `recordLessonDecisions` 호출 삭제 | 1 | 43/41/2 | ①④ | cmp-OK |
| X6 | 펜싱을 저장 뒤로 이동 | 1 | 43/39/4 | ①②③④ | cmp-OK |
| X7 | 오류 코드가 있어도 Trace 상태 `ERROR` 설정 삭제 | 1 | 43/42/1 | ① | cmp-OK |

- **생존 0/12**, 동등 변이 없음. 전부 `ERR_ASSERTION` 또는 의도한 예외 누출로 죽었고 컴파일 오류·크래시로 죽은 것은 0건(`SyntaxError|ERR_MODULE|TSError|Cannot find` grep 0). Developer 주장(M9·M11a·M11b·M12·M13 사망, 39/41/41/38/42 통과 수)과 내 수치가 일치한다. X1~X7 은 감사자 추가분.
- 변이 후 미러를 NFS 와 `rsync -rcn` 한 결과 학습 계층 파일 차이 0. 남은 차이 3건(`components/talk/TalkRoom.tsx`·`modules/conversation/prompts/talk.ts`·`modules/conversation/__tests__/prompts.test.ts`)은 010c 가 병렬로 고친 파일로 REV-064 범위 밖(미러는 그 파일들의 직전 버전).

### 4. 문서 확인 — 결함 없음

| 항목 | 확인 | 결과 |
|---|---|---|
| api-contract #35 (L-1) | task-010b L8 항목에 "재채택 때 그 항목의 일정은 다시 정해진다(의도된 동작 — REV-061 L-1) … `nextDueAt = 오늘 + 간격`(3~7·FOCUS ≤3 클램프)·`decidedBy=FALLBACK` … 다음 A11 판단이 그 일정을 다시 정한다" | 코드 `repetition/index.ts:154-155`(갱신)·`:178-179`(신규)가 `nextDueAt=addDays(today, interval)`·`decidedBy='FALLBACK'`, `studied:false` 면 `studiedCount`·`lastStudiedAt` 불변(`:148`) — **문서 = 코드** |
| api-contract #64 (L-3) | `git diff` 로 옛 한 줄 제목("… 다음 학습일에 코드가 다시 DUE 를 만든다.") 이 새 제목 + 불릿 3개로 병합됨 | 옛 서술은 `1092행` "다음 학습일에 코드가 다시 DUE 세션을 만든다" 로 보존, 소유자·`DUE` 만·`IN_PROGRESS` 409·`NOT_DUE` 409·★⑦ 허용 상태·조건부 전이 모두 유지 — **내용 손실 없음**. 요약표 #64 행의 응답도 `{id,status:"SKIPPED",resolvedAt}` 로 본문과 일치 |
| domain-model §9-3 | `RepetitionItem`(교정 재채택 갱신, task-010b) 행 신설 | 같은 교정문 `refType="Correction"`·`refId=sha1(정규화 교정문)`, `feedbackCount+1`(3회 → FOCUS)·`nextDueAt` 재설정·`decidedBy=FALLBACK`, `studiedCount`·`lastStudiedAt` 불변 — #35 와 코드에 일치 |

### 5. 이슈

| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L-11 | Low(관찰) | `task010b.test.ts:1081,1097,1109,1131,1143,1160` | 마지막 쓰기·`ops` 전체 일치 단언이 "잡 전이가 tx 의 마지막 쓰기" 라는 현재 구현에 묶여, 같은 tx 에 무해한 쓰기를 뒤에 추가하면 오탐 | 이번엔 유지(의도 문서화, ①′ 이 순서 무관 원자성을 별도로 증명). 마지막 쓰기 단언을 바꾸게 되면 `includes` 로 완화 |
| L-12 | Low(관찰) | `decision.ts:213-232` (`drainDecisions`), `:196-206` (`kickDecisionChain`) | seam 은 `runReviewDecisionJob` 만 덮는다. claim 루프(`updateMany` 조건부 점유·`CHAIN_MAX`)·`markLocalJob`·러너가 던졌을 때 `jobs.failJob(job.id, code)`(트랜잭션 밖) 로 닫는 경로, `chains` Map(프로세스 로컬)은 여전히 전역 `prisma` 직접 사용이라 결정적 테스트가 없다(합의된 범위). ①′ 의 "러너는 던진다" 뒤 실제 마감은 이 경로 | QA 라이브 smoke 3c 와 동시 2요청 확인으로 갈음. 추후 필요하면 같은 방식으로 `drainDecisions` 의존성 주입(범위 밖) |

Critical 0 · High 0 · Medium 0 · Low 2. `native_change=false`(`plugins/**`·`android/**`·`capacitor.config.ts` 변경 없음 — 이번 변경분은 `decision.ts`·테스트·문서뿐).

### 6. 실행한 명령과 원 출력 요약

- `date` 기준 최종 재검증 시작 00:48:48.
- `rsync -rcn --exclude 'src/components/talk/TalkRoom.tsx' --itemize-changes $NFS/src/ $MIRROR/src/` → 차이 3건(위 010c 병렬 파일), 학습 계층 0건. `tests/` 차이 0.
- `./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json` → `tsc exit=0`, 출력 0줄.
- `./node_modules/.bin/eslint src/modules/learning/repetition/decision.ts src/modules/learning/__tests__/task010b.test.ts src/modules/learning/lessons/progress.ts` → `eslint exit=0`, 출력 0줄(경고·오류 없음 — 요약 줄이 출력되지 않는 정상 종료).
- 전체 스위트 1회: `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → 파일 120개, `real 0m34.249s`, `full exit=0`, `# tests 1171 # suites 0 # pass 1169 # fail 0 # cancelled 0 # skipped 2 # todo 0`. 스킵 2건은 `brand:` 테스트 2건의 `# SKIP 미러에 android/ 없음`(환경 사유, 010b 와 무관).
- 010b 관련 3파일 합산(Developer 인용 `47/47` = 43+2+2) 중 `task010b.test.ts` 는 내 실행에서도 `43/43`.

### 7. 미실행 (사유)

- 라이브 smoke `tests/live/task010b-smoke.{sh,ts}`·HTTP 요청 수준 검증(#58 GET·#63·#64·교정 accept 라우트 실호출) — DB 쓰기·실제 LLM 이 필요해 지시상 금지, 정적 읽기와 단위로 대체. QA 몫.
- 실제 LLM(A11·A5) 호출 — 금지.
- DB 쓰기·`db push`·`prisma generate`·`npm install`·`next dev`·운영 서버 접근 — 금지.
- **"안쪽 호출에서 `tx` 를 빼먹는" 변이**(예: `jobs.failJob(jobId, errorCode)` 처럼 `tx` 인자 생략) — 이 변이는 가짜 `tx` 를 거치지 않고 전역 `prisma` 로 새서 DB 에 닿을 수 있어 미실행. 미러에 `.env` 가 없어 실제로는 연결 실패로 죽을 가능성이 높지만 **미검증**이다(①·②·③ 의 `ops` 단언도 그 호출을 기록하지 못해 별도로 실패하므로 동등한 방어는 있어 보이나 실측하지 않음).
- `prompts/talk.ts`·`TalkRoom.tsx`(010c 병렬 변경) — REV-064 범위 밖.
- 데모 게이트 `check.mjs check` — 이번 변경은 화면이 없는 서버 seam·테스트·문서뿐이라 대상 아님(REV-061 과 같다). `evidence.jsonl` 대조·`approve`/`waive` 대리 실행 흔적 점검은 **대상 아님으로 미실시**.

### 8. Judge C2 의견

**권고(가벼운 1회): Codex 를 붙이되 범위를 좁힌다 — 필수는 아님.** 010b Codex 예산 0/4 사용. REV-061 에서 이 영역이 M-1(자동 검증 구멍)로 최우선이었으나, 이번 seam 테스트가 **러너 한 번 실행의 트랜잭션 내부 불변식**(잠금 → 펜싱 → 저장 → FAILED/DONE, 롤백 원자성, `DecisionSuperseded` 삼킴)을 결정적으로 고정해 외부 시선의 한계 가치는 REV-061 때보다 낮아졌다. 그럼에도 가짜 저장소는 **단일 스레드·단일 커넥션**이라 아래는 여전히 코드 읽기로만 확인된다:
1. 두 연결 사이의 실제 잠금 순서(사용자 행 → 잡 행)가 `claimDecisionJob`(`decision.ts:170-` 근처 `scheduleReviewDecision` 의 `lockUserRow`)·`jobs` stale 정리·`completeJob` 과 교착 없이 맞물리는지.
2. `drainDecisions`(`:213-232`) 의 조건부 점유(`updateMany … status:'QUEUED'`, count≠1 이면 `continue`)와 pm2 blue/green·재시작 때 **다중 프로세스** 가 같은 QUEUED 잡을 집을 때의 안전성(`chains`·`markLocalJob` 은 프로세스 로컬).
3. `withTransaction` 재시도(최대 2) 때 러너 콜백이 두 번 실행될 수 있는데, 콜백 밖에서 이미 만든 `plan`·`decidedAt` 을 재사용해도 안전한지(쓰기 전부 `tx` 안이라 안전해 보임).
- Codex 질문은 위 3개로 한정해 `decision.ts:120-235`·`:355-440` 만 보내면 충분. Codex 가 off 이거나 예산 사유로 생략하면 **QA 라이브 smoke 3c + 동일 사용자 동시 2요청 확인**으로 갈음 가능하다(내 판정은 Codex 결과와 무관하게 PASS).

### 9. QA `high_risk_areas` (REV-061 9항목 중 이번 수정으로 바뀐 것만)

```json
{
  "high_risk_areas": [
    "A11 러너 runReviewDecisionJob — 트랜잭션 내부 불변식(잠금→펜싱→저장→FAILED/DONE·원자 롤백·DecisionSuperseded 삼킴)은 단위로 고정됨(M-1 해소, 변이 12/12 사망). QA 는 실제 DB 에서만 확인 가능한 것에 집중: 같은 사용자 동시 2요청(잡 하나·QUEUED 병합)·LLM 실제 실패 시 FALLBACK 저장+잡 FAILED(smoke 3c)·stale 5분 잡·프로세스 재시작 뒤 QUEUED 처리(L-12)",
    "Lesson.progress.reviewDecision 서버 전용 칸 — parseProgressPatch 수준 400 unknown_key 는 단위로 고정됨(L-9 해소, M9 사망). 요청 수준 400 과 #58/#60 응답 은닉·병합 보존은 여전히 smoke 6k",
    "교정 재채택 시 기존 항목 nextDueAt·decidedBy 초기화 — 결함이 아니라 문서화된 의도 동작(L-1 해소). QA 는 '문서 = 동작' 확인: 같은 교정문 재채택 → 같은 행 feedbackCount+1(3회 → FOCUS·간격 ≤3)·nextDueAt = 오늘 + 클램프 간격·decidedBy=FALLBACK·studiedCount·lastStudiedAt 불변"
  ],
  "unchanged_from_rev_061": "#63 복습 시작(같은 행 되살림·세대 펜싱)·#64 건너뛰기(문서 중복만 정리, 동작 변경 없음)·교정 채택 tx 롤백(smoke 7f)·#58 GET 부작용·레슨 완료 tx(L-8)·3~7 clamp/FOCUS≤3/세션 4~12 — REV-061 목록 그대로"
}
```

→ 다음: Judge C2(위 의견) → (Codex?) → QA. 운영 코드가 바뀐 seam 은 이번 재감사로 닫혔고 Developer 재작업 요청은 없다.

## Judge 기록 (C2, 2026-10-03 00:55)

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-010b",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": true,
    "wanted_before_budget": true,
    "mode": "adversarial-review",
    "focus": "concurrency",
    "budget_rule": "CX-limit-unknown-r2",
    "codex_calls_used": 0,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 0,
    "focus": {
      "choice": "concurrency",
      "confidence": 0.94
    },
    "high_risk_change": {
      "noul": 0.12
    },
    "reviewer_doubt": {
      "noul": 0.89
    }
  },
  "rule_overrides": [],
  "fallback": null,
  "input_tokens": 1076,
  "cost_usd": 0.000045,
  "latency_ms": 255
}
```

engine: jev
결정: codex_required=true · mode=adversarial-review · focus=concurrency · budget_rule=CX-limit-unknown-r2
규칙 덮어쓰기: 없음

## Codex 검토 (C2, adversarial-review, focus=concurrency)

**[2026-10-03 10:57] C2 adversarial-review focus=concurrency — 완료**

- **Judge 판정**: task-010b Judge C2 `codex_required=true, mode=adversarial-review, focus=concurrency` (2026-10-03 00:55) / **호출 차수: 1/4**
- **대상**: 
  - repo = `/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa`
  - base = `98d8cac` (task frontmatter `base_ref`, task-010-today-lesson 커밋)
  - base_source = `task_file` (정상)
  - snapshot = `99b7d51` (base..HEAD 스냅샷)
  - duration = 74초

- **지적 1건**: [**Medium**] `src/modules/learning/repetition/decision.ts:145`
  - **조건**: 잡 생성 커밋 직후 `kickDecisionChain` 호출 전 프로세스 종료 또는 blue/green 전환
  - **영향**: QUEUED 잡이 프로세스 로컬 Promise 체인에만 등록되고, DB 폴러가 없어 최대 5분간 실행 안 됨 → stale 으로 FAILED. 같은 날 `decisionJobToday` 재시도도 차단 → **사용자의 복습 판단·일정 생성 누락** 가능성
  - **권고**: 
    1. DB 기반 워커 추가 또는 주기적 QUEUED 잡 드레이너
    2. 모든 활성 QUEUED 잡 반환 경로에서 현재 프로세스가 안전하게 drain을 깨우도록 설계
    3. stale/restart 실패 시에도 같은 날 새 세대 잡 생성 가능하도록 `decisionJobToday` 조건 조정
    4. 프로세스 종료·DAILY 요청 동시성을 통합 테스트로 고정

- **검토하지 못한 범위**:
  - 실제 MariaDB 두 연결을 사용한 잠금·교착 실측 (QA 라이브 smoke)
  - pm2 blue/green 종료 타이밍 통합 테스트
  - HTTP 요청 수준 라우트 검증

- **원본**: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261002T155656Z-task-010b-C2/raw.txt` (및 stdout 로그)

**Codex 평가 요약** (자동 검토 요청사항 3개):
- ✅ 두 연결 간 잠금 순서 (user→job): **명백한 역순 교착 없음**, 조건부 점유(`updateMany` status 검사)는 **코드상 중복 실행 무료**
- ✅ `withTransaction` 재시도 시 콜백 재실행: **트랜잭션 안 쓰기는 롤백 후 재실행되어 안전** (동등성·중복성 O)
- ⚠ 다중 프로세스 안전성: **프로세스 내구성 공백 발견** — 잡 생성·db 커밋·프로세스 로컬 실행 사이의 비원자성. 별도 초기화(폴러/스케줄러)로 보완 권고.

**다음**: Reviewer 가 Codex 지적(Medium 1건) 채택·오탐 판정 → Developer 가 필요 시 수정 → QA.
}

## Reviewer 기록 (Codex C2 지적 판정, 2026-10-03 01:03 date 실측)

> 대상: 위 `## Codex 검토 (C2, adversarial-review, focus=concurrency)` 의 [Medium] 1건. 코드·문서 수정 없음(Read 전용). 위 Judge(00:55)·Codex(10:57) 표기는 서버 시계와 달라 순서만 참고. Codex 가 인용한 `decision.ts:145` 는 `scheduleReviewDecision` 함수 머리이고 실제 `kickDecisionChain` 호출은 `:152`(판단에 영향 없음).

### 판정: **부분 채택 · 심각도 Medium → Low** (REV-064 PASS 유지, QA 진행 가능)

| 지적 내용 | 판정 | 근거 |
|---|---|---|
| 프로세스 내구성 공백 — 잡 행(DB)과 실행(프로세스 안 Promise 줄)이 비원자적, DB 폴러 없음 | **사실** | `decision.ts:196-206`(`chains` Map·`kickDecisionChain`) 은 프로세스 로컬. `jobs.ts:1-6` 이 "같은 프로세스 백그라운드·나이 기준 stale" 을 설계로 못박음. 죽으면 `jobs.ts:66-71`(`isStaleJob`)·`:100-128`(`findActiveJob(ByKind)` 지연 정리)·`:222-228`(`sweepStaleJobs`, 기동 시 **나이 기준만** — blue/green 안전) 로 5분 뒤 `FAILED('stale'|'restart')`. 재기동해도 갓 만든 고아는 5분간 살아 있다(Codex 의 "최대 5분" 은 맞다) |
| "사용자의 복습 판단·**일정 생성** 누락" | **부분 오탐** | 일정은 안 빠진다. `reviewSchedule/index.ts:76-89`(#58): 고아가 stale 정리되면 `job=null` → `decisionJobToday`(FAILED 포함)가 있어 DAILY 는 안 걸지만 곧바로 이어지는 폴백 분기(due 항목 존재 시 `ensureFallbackSchedule`)가 `decidedBy:FALLBACK` DUE 세션을 만든다(api-contract #58 `:963` 이 이 안전망을 이미 명시). 레슨 완료 트랜잭션이 `nextDueAt = 오늘 + intervalDays(3~7)`·`decidedBy=FALLBACK` 을 이미 써 둠(api-contract `:1022-1033`) → A11 은 "다듬기"이지 "생성"이 아니다. **빠지는 것은 그날 TUTOR 판단(간격·근거 문구 정교화)뿐** |
| 같은 날 `decisionJobToday` 재시도 차단 | **사실이나 의도** | `decision.ts:117-118` 은 상태 무관(FAILED 포함) — L4 "하루 한 번" 규칙(Leader ★ 위험 결정). `task010b.test.ts:447-455` 가 못박음 |

### 확인 4항 근거

1. **시나리오 실재 여부**
   - 커밋→킥 창(`decision.ts:147-152`): `withTransaction` 이 resolve 된 같은 연속(continuation)에서 동기 호출 → 사실상 마이크로초. 이 창 자체가 현실 경로는 아니다.
   - 현실 경로 ① RUNNING 중 사망: A11 타임아웃 60s(`engine/router/tasks.ts:25`) + 저장 tx. pm2 `max_memory_restart:512M`·기본 `kill_timeout`(`ecosystem.config.js` `thekaiwa` 앱, SIGTERM 대기 없음)·배포 시 구 인스턴스 종료(blue/green 종료 방식은 **미검증** — `scripts/deploy.sh` 가 TheKaiwa 디렉터리 밖) 에 진행 중 잡이 끊긴다.
   - 현실 경로 ② `drainDecisions` 의 `findFirst`/`updateMany`(`:214-217`)가 try 밖 → DB 일시 오류면 `kickDecisionChain` 의 `.catch`(`:201`)가 로그만 남기고 QUEUED 잡이 고아로 남는다.
   - 결과: QUEUED/RUNNING 고아 → ≤5분 `decisionPending:true`(#58: `!job` 이 거짓이라 폴백도 안 걸림) → `stale` FAILED → 위 폴백 세션. DAILY 가 같은 날 끝내 null 이 되는 것도 코드상 맞다(`:169-173`, FAILED 도 `todayJob` 으로 잡힘).
2. **공통 설계 속성 여부**: **공통**. `runJobInBackground`(`jobs.ts:188-203`) 계열 CHAT_REVIEW·LESSON_GEN·REVIEW_GEN·EVAL_GEN·EVAL_GRADE 가 같은 프로세스 실행·같은 5분 stale 규칙이고(`jobs.ts:17-25`) api-contract `:1199` 가 "프로세스가 죽으면 잡은 5분 뒤 stale FAILED" 를 수용된 한계로 적어 둠(task-006 범위결정 4). 010b 고유 증폭 요인은 **L4 "하루 한 번이 FAILED 도 센다"** 하나뿐이다.
3. **피해 범위**: 항목 손상·일정 부재 없음. 익일 DAILY 는 `countNeedingDecision`(`decision.ts:109-113`, `nextDueAt ≤ 내일`)이 있으면 다시 걸린다. 같은 날 비-DAILY 트리거(`afterStudyCompleted`, `reviewSchedule/index.ts:121`)는 `claimDecisionJob`(`:177-180`)이 **살아 있는 QUEUED 고아에 합쳐 `run:true` 로 킥**하거나 새 잡을 만들어 킥하므로 같은 날에도 회복된다(DAILY 경로만 `run:false` — `:171-172`). 사용자 가시 증상: #58 `decisionPending` ≤5분 → 폴백 세션, #55 잡 조회에서 `FAILED('stale')`, 새 레슨 완료 직후라면 `lessonReviewExtras`(`:156`)가 그 사이 `nextReview:null`(미세한 표시 공백). 소비하는 UI 는 아직 없음(서버 1단계) — API 수준 증상.
4. **최소 수정안**
   - **(a) 권고 — QUEUED 고아 킥**: `decision.ts` 에 멱등 `kickDecisionQueue(userId, driver)`(= `kickDecisionChain` 얇은 공개 래퍼, 안전한 이유: 점유가 조건부 `updateMany`(`:216-217`)라 중복 실행 없음·`chains` 가 사용자별 직렬) 를 두고 `getTodayReviewState` 가 `job.status==='QUEUED'` 일 때 호출. 변경 ≈15줄(`decision.ts`·`reviewSchedule/index.ts`) + 테스트(활성 QUEUED 가 있을 때 #58 이 킥한다 / 이미 RUNNING 이면 안 깨운다 / 기존 DAILY 테스트 `:447-455` 의 "실행 안 깨움" 은 `claimDecisionJob` 레벨이라 유지). 효과 범위: QUEUED 고아와 경로 ② 만 구제. RUNNING 고아는 그대로 ≤5분+폴백. 락·펜스 영역 인접이므로 수정 시 **Reviewer 재순환 필요**.
   - **(b) 비권고 — `decisionJobToday` 가 stale/restart FAILED 를 무시**: `error ∈ {stale,restart}` 로 구분은 가능하나 L4 규칙(테스트가 고정)을 바꾸고, 반복 사망 시 5분마다 새 잡·`decisionPending` 이 되풀이될 수 있어 하루 1회 재시도 상한이 따로 필요하다. 이득(그날 TUTOR 판단 1회 회복) 대비 규칙 변경 폭이 크다.
   - **(c) 비권고(현 시점) — DB 드레이너/워커**: 프로젝트 공통 인프라 변경(전 잡 종류 영향). 운영에서 고아가 실제로 반복 관측될 때 별도 task.
   - **의견**: 010b 서버 1단계는 **차단하지 않는다**(Low, 안전망 있음, 공통 설계). (a) 는 010b **2단계**(UI 가 #58 을 폴링하며 "판단 중" 표시 상한을 두는 단계)에 함께 넣거나 별도 소형 task. 지금 1단계에서 넣으면 락 인접 영역을 또 건드려 재감사 비용이 이득보다 크다.

### 후속 권고(코드 변경 없이 가능한 것)
- api-contract #58 `decisionPending` 항목에 한 문장: "프로세스가 죽어 잡이 stale 로 정리되면 그날은 TUTOR 판단 없이 기본 규칙(FALLBACK) 세션이 열린다(다음 날 DAILY 가 다시 판단)." — Leader/Developer 문서 반영.
- QA(서버 1단계 라이브): QA 계정에서 오래된(>5분) QUEUED `REVIEW_DECISION` 행이 있을 때 #58 이 폴백 세션을 내고 `decisionPending:false` 로 돌아오는지 1회 확인(행 주입·정리는 QA 범위).
- 검토하지 못한 것: 실제 프로세스 kill·pm2 reload 재현, 실 MariaDB 두 연결 경합(Codex 와 동일), `scripts/deploy.sh` 의 구 인스턴스 종료 방식.

```json
{"reviewId":"REV-064-F1","taskId":"task-010b","codexFinding":"decision.ts kick 후 프로세스 내구성 공백","judgment":"PARTIAL_ADOPT","severity":{"codex":"MEDIUM","reviewer":"LOW"},"verdictChange":"none (REV-064 PASS 유지)","fix":{"recommended":"(a) QUEUED 고아 kick — 010b 2단계 또는 별도 소형 task","scope":"decision.ts+reviewSchedule/index.ts ≈15줄+테스트, Reviewer 재순환 필요","notRecommended":["(b) decisionJobToday stale 무시","(c) DB 드레이너(운영 반복 관측 시 별도)"]},"blocksQA":false}
```

## Leader 기록 (Codex C2·REV-064 수용, 2026-10-03 01:05)

- **REV-064 PASS**(Critical 0·High 0·Medium 0·Low 2: L-11·L-12) 수용. **Judge C2**(00:55) = Codex 필수(adversarial-review·concurrency) → Codex 1회 실행(010b 호출 1/4) → 지적 1건(Medium, decision.ts 커밋→kick 사이 고아 잡) → **Reviewer 판정 = 부분 채택·Low 로 하향**(오탐 부분: "일정 생성 누락"은 사실이 아님 — stale 정리 직후 #58 이 FALLBACK 세션을 즉시 만든다. 맞는 부분: 그날 TUTOR 판단만 빠지고 같은 날 재시도는 없음, 5종 잡 공통의 수용된 한계).
- **결정(Leader)**: 010b 1단계에서는 **코드를 고치지 않는다**. 근거 — 커밋→kick 창은 ms 단위, RUNNING 중 종료도 5종 잡 공통 설계(api-contract §1199 수용), 피해는 '그날 판단 품질'에 한정되고 다음 날 DAILY 가 회복한다. 권고안 (a)(#58 이 QUEUED 고아를 다시 깨움, ~15줄+테스트)는 **010b 2단계(화면이 #58 을 폴링하는 단계) 또는 별도 소형 task 에서** 처리하고, 그때는 Reviewer 부터 재순환한다. (b) decisionJobToday 가 stale-FAILED 무시·(c) DB 드레이너는 비권고.
- 문서 반영: api-contract #58 설명(963행)에 "고아 → 그날은 FALLBACK 세션·같은 날 재시도 없음(수용된 한계)" 한 문장 추가.
- QA 에 넘길 항목(REV-064 high_risk_areas + 이 건): ① A11 러너 — 실 DB 동시 2요청, LLM 실패 폴백, stale 5분 잡 ② `Lesson.progress.reviewDecision` 요청 400·응답 은닉(smoke 6k) ③ 재채택 일정 초기화 = "문서 = 동작"만 확인 ④ **오래된 QUEUED 행이 있을 때 #58 이 폴백 세션을 내는지 1회**(Reviewer 후속 권고). QA 는 012c QA·010c 재QA 와 QA 계정·LLM 쿼터가 겹치지 않게 순차로 돌린다.
- 정정: Judge C2 기록의 시각 `01:09` 는 Judge 가 쓴 값이 실제(JSON 산출 00:55:31)와 달라 `00:55` 로 고쳤다(미래 시각 — 시각은 `date` 실측 원칙 위반. 이후 Judge 호출 프롬프트에 date 실측을 명시한다).

## QA 기록 (010b 1단계 서버 — REV-064 이후, 2026-10-03 07:35)

> 범위 = 서버 1단계(A11 러너·`RepetitionItem`·`LearningObservation`·A5 복습 레슨·`#58·#60·#61·#63·#64`). 화면·2단계·신뢰도 가중·`/api/health` 는 이번 범위 밖. 코드·정본·데모는 손대지 않았다.

### 판정

✅ **검증 통과(서버 1단계 한정)** — 지정 5개 묶음 전부 실행 PASS, **결함 0건(Critical 0·High 0·Medium 0)**, Low/관찰 5건은 아래 "관찰". 보안 이상 없음(응답·로그에 경로·명령어·엔진명·model·프롬프트 버전 노출 0, 쿠키 값 미출력). **deployer 인계는 하지 않는다** — 이번 라운드는 서버 1단계 한정이고 2단계(화면)가 남았으므로 배포 판단은 Leader.

### 환경·방법 (재현 조건)

- 미러 `~/.node-local/thekaiwa-qa-011b`(NFS `src/` rsync, `npm install`·`prisma generate` 안 함) · dev 서버 `127.0.0.1:3043`·`APP_ENV=LOCAL`. **운영 3010·pm2·`/home/brownjeon/apps/**`·운영 DB 행은 읽기·쓰기 모두 0**(개발·운영이 NAS MariaDB 를 공유하므로 **qa-bot2(계정 2) 행만** 건드림 — 010c QA 의 qa-bot 과 분리).
- **LLM 실패 주입(②·③·④·⑤)** = 서버를 `CLAUDE_CLI_PATH=/nonexistent/claude` 로 띄워 spawn 이 결정적으로 실패하게 함(A11·A5 는 m4 폴백이 없어 곧바로 FAILED → 실제 LLM 호출 0회). **실 LLM(B)** = `.env` 의 `claude` 로 서버 재기동, 호출 **3회**(상한 6): 서버 로그 `[claudeCli] 완료 — model=sonnet … attempt=1` 3줄(A11 DAILY promptChars=2771 11.3s · A5 7317자 29.3s · A11 완료뒤 2792자 9.1s)·`AiJob` 3행·`RequestTrace` +3 과 일치(ajv 재시도 없음).
- **stale 잡 재현** = qa-bot2 소유 `AiJob` 행의 `createdAt/startedAt` 을 과거로 둔 가짜 행(7분·4.5분·2분·"10분 전 생성·2분 전 시작")을 직접 넣고 #58·#55 를 호출. 이 가짜 행은 러너가 건드리지 못하게(`inert`) 두고 정확 id 로만 삭제. **프로세스를 실제로 죽여 고아를 만드는 시나리오는 하지 않았다(미실행 — 아래).**
- 스크립트 = 스크래치 `qa010b.ts`(qa-bot2 전용, BASE 3043 외 거부) A→R(복원)→A→B→R. 쿠키는 600 파일·값 미출력. 정확 id 삭제.

### 항목별 판정

| # | 항목 | 판정 | 실행 근거 |
|---|---|---|---|
| 1 | 기본 게이트 | PASS | 단위 `task010b.test.ts`(45)+`utteranceConfidence.test.ts`(2) = `# tests 47 · pass 47 · fail 0 · skipped 0` · `tsc --noEmit` exit 0 · eslint(변경 파일) exit 0 · `check.mjs` DEMO_GATE_PASSED(승인 v1). 전체 스위트는 돌리지 않음(지정 범위만) |
| 2① | 같은 사용자 동시 요청 → 잠금·교착 없음·잡 중복 없음 | PASS | A①a 동시 2요청 200/200 ms=494·497, `REVIEW_DECISION` 잡 시작 0→1·가리킨 jobId 1개 · ①c 일정 ≤1·서버 로그 교착/잠금 대기/5xx 0 · ①d 동시 6요청 200×6 잡 1·일정 1(1048~1068ms). **실 CLI**(B①a)도 200/200 ms=244·232, 잡 1·jobId 1 |
| 2② | LLM 실패 → FALLBACK 저장·잡 FAILED | PASS | A②a 잡 FAILED·`error=ENGINE_ERROR`(DB 도 동일, 경로·명령어 없음)·finishedAt · ②b 세션 DUE·`decidedBy=FALLBACK`·근거 "지난 학습에서 틀리거나 오래된 항목을 골랐어요"·항목 6(4~12)·항목 간격 `F3F F3F N5F N7F N3F N7F`(시드 12·1 이 3~7 로 클램프, FOCUS ≤3, 피드백 3↑ FOCUS 유지)·항목 reason "이번엔 판단하지 못해 기존 간격을 유지해요" · ②c 같은 날 재진입에도 새 잡 0·같은 세션 |
| 2③ | 5분 넘은 잡 + #58 → `FAILED('stale')`·FALLBACK 세션 | PASS | A③a 7분 RUNNING → 행 `FAILED/stale`·#55 도 `FAILED/stale`·③b 세션 FALLBACK(6항목) · ⑥a #55 로만 조회해도 `FAILED/stale` 로 정리 · **경계**: ⑦a 2분 QUEUED·⑦b "10분 전 생성·2분 전 시작" RUNNING(startedAt 기준)·⑦c 4.5분 RUNNING 은 모두 살아 있음(pending=true·같은 jobId·새 잡 0). 5분 정각 지점은 미측정(4.5↔7 사이) |
| 2④ | 오래된 QUEUED 1행 + #58 → FALLBACK 세션 (Codex 지적 재현) | PASS | A④a 7분 QUEUED → `FAILED/stale`·`decisionPending=false`·④b 세션 FALLBACK 6항목(크기 4~12)·④c `jobsToday=1`(새 DAILY 잡 없음). **"같은 날 DAILY 재시도 없음" = 수용된 한계, 있는 그대로 기록**(api-contract:963 이 이제 이 한계를 명시 — 실측과 일치) |
| 3 | `Lesson.progress.reviewDecision` 서버 전용 | PASS | B⑥b `#61` 에 `progress.reviewDecision`(단독·quiz 와 혼합) → 400 `unknown_key`(details.field=`progress.reviewDecision`)·DB progress 불변 · B⑦a 레슨 완료+A11 DONE 뒤 DB 칸 `{jobId=A11 잡·decidedBy=TUTOR·rationaleKo·decidedAt·groups 3d×2 4d×1 5d×1 6d×1 7d×1}` 존재 · B⑦b `#58·#60·#63·#61(DONE 뒤)` 본문 전체에 문자열 `reviewDecision` 0·`#60 progress` 키 = `quiz,speaking` · B⑦c `#60 nextReview.groups` = DB 칸과 동일·days 3~7·date=오늘+days·FOCUS 묶음 ≤3·묶음 합 = 공부한 항목 6 |
| 4 | 재채택 일정 초기화("문서 = 동작")·채택 tx 롤백 시 행 0 | PASS | A⑧a 첫 채택 → EXPRESSION·refType Correction·refId=sha1(교정문)·studied 0·lastStudiedAt null·피드백 1·뜻=설명 첫 문장·FALLBACK·nextDueAt=오늘+간격 · ⑧b 채택은 A11 잡을 만들지 않음 · ⑧c TUTOR 판단(간격 10·10일 뒤) 항목 재채택 → 같은 행·피드백 2·간격 7 클램프·nextDueAt=오늘+7·`decidedBy=FALLBACK`·studied/lastStudied 불변 · ⑧d 3번째 채택 → 피드백 3 → FOCUS·간격 3·nextDueAt=오늘+3 · ⑧e `CORRECTION_ACCEPTED` 관측 3행(SUCCESS·GRAMMAR_PARTICLE) · ⑧f 재승인 409 · ⑧g 거절 → IGNORED(SKIPPED) 1행·항목 0 · **⑧h 단어 중복 409 → 항목·관측·오류통계·단어·DAILY 변화 0·교정 PROPOSED 유지(행 0 증가)** · ⑧i 롤백 뒤 같은 교정 단독 채택 200 · ⑧a/⑧j 모르는 키 400·타인 id 404 · 교정 채택은 StudyLog 를 만들지 않음(B 이전 `studyLog` 0 유지) |
| 5 | `#63` FAILED 복습 레슨 되살림·세션 4~12·FOCUS ≤3·간격 3~7 | PASS | A⑤a FAILED → **같은 행** GENERATING(행 수 불변·REVIEW_GEN 잡 refId=그 레슨) · ⑤b A5 실패 주입 → 잡 FAILED(코드만)·레슨 같은 행 FAILED · ⑤c 다시 #63 → 또 같은 행·새 잡 · ⑤d 동시 2번 누름 200/200(`reused=false,true`)·행 수 불변 · **실 LLM B⑤a~e**: 같은 행 되살림 → A5 DONE(32.2s)·#60 READY·reviewItems=세션 항목(순서)·세션 6(4~12)·세션 FOCUS 항목 간격 ≤3·chunks ⊆ mixSpec∪new-N · B①c 실 A11 항목 `F3T F3T N6T N4T N5T N5T`(3~7·FOCUS ≤3·피드백 3 FOCUS 유지·nextDueAt=마지막 학습일+간격) |

### 원문 발췌

```
== QA010b phase A 41/41 PASS · 누출 0 ==   (실패 주입 서버, 실 LLM 0회, 깨끗한 상태에서 1회)
== QA010b phase B 18/18 PASS · 누출 0 ==   (실 CLI, LLM 3회)
지표 {"realConcurrent2Ms":[244,232],"a11DailyMs":17011,"a11DailyStatus":"DONE","a5Ms":32206,"a5Status":"DONE","a11ReviewMs":22311,"a11ReviewStatus":"DONE","realLlmCalls":3,"serverLogBad":[]}
PASS ④a 7분 묵은 QUEUED + #58 → 그 잡 FAILED("stale")·decisionPending false — row=FAILED/stale pending=false jobId=null
PASS ④c 새 판단 잡 없음(수용 한계 기록) — jobsToday=1
PASS B⑥b #61 progress.reviewDecision(단독·quiz 와 섞어서) → 400 unknown_key·DB progress 불변 — bad1=400/unknown_key/progress.reviewDecision bad2=400/unknown_key
PASS B⑦b #58·#60·#63·#61 본문 어디에도 "reviewDecision" 키 없음 — progressKeys=quiz,speaking #63=409/NOT_DUE #61(DONE)=409/ALREADY_DONE
PASS ⑧h 단어 중복 409 → 채택 트랜잭션 전체 롤백(항목·관측·오류통계·단어·DAILY 변화 0, 교정 PROPOSED, 항목 0행 증가) — word=200 dup=409
```

### 행 수 전/후 (qa-bot2)

| 시점 | learningObservation | studyLog | statsSnapshot | reviewSchedule | lesson | aiJob | requestTrace | correction | chatMessage/chat | tutorProposal | vocabSession | wordEntry | repetitionItem | learnerErrorStat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 시작 전(기준선) | 0 | 0 | 0 | 0 | 0 | 0 | 60 | 0 | 0/0 | 0 | 0 | 0 | 0 | 0 |
| A(깨끗한 재실행) 종료 | 5 | 0 | 3 | 0 | 0 | 0 | 60 | 5 | 2/1 | 0 | 0 | 1 | 8 | 2 |
| B 종료 | 13 | 1 | 4 | 1 | 1 | 3 | 63 | 5 | 2/1 | 0 | 0 | 1 | 6 | 2 |
| **최종 복원 후** | **0** | **0** | **0** | **0** | **0** | **0** | **60** | **0** | **0/0** | **0** | **0** | **0** | **0** | **0** |

복원 = 이 실행이 만든 행만 정확 id 로 삭제(삭제 수 `learningObservation 13·correction 5·chatMessage 2·chat 1·studyLog 1·reviewSchedule 1·lesson 1·aiJob 3·requestTrace 3·repetitionItem 6·learnerErrorStat 2·wordEntry 1·statsSnapshot 4`) → 기준선과 전 테이블 일치(`PASS 복원 완료`). 기존 행을 고친 것은 없다(기준선이 전부 0 이었음).

### 정직 공개 (실행 중 내 쪽 오류·환경 차이)

1. **내 스크립트 전제 오류 → 첫 실행 A 39/41 (③b·④b FAIL)**: "코드가 만든 폴백 세션(`ensureFallbackSchedule`)도 항목 간격을 3~7 로 클램프한다"고 잘못 가정했다. 실제로는 항목 판단을 쓰는 건 **A11 러너의 `fallbackPlan` 뿐**이고 세션만 만드는 코드 폴백은 항목을 건드리지 않는다(②는 러너 폴백이라 클램프가 일어남). 제품 결함이 아니다. 단언을 "코드 폴백 세션은 간격·우선순위·decidedBy·nextDueAt·studied·feedback 을 바꾸지 않는다"로 고쳐 다시 돌렸다. (기존 단언을 약화한 게 아니라 잘못된 전제를 바로잡은 것이며, 두 로그를 모두 남겼다 — 원본 FAIL 은 위 설명대로.)
2. **더럽혀진 상태에서 재실행하면 ⑧e FAIL(스크립트 인공물)**: 이전 실행의 `CORRECTION_ACCEPTED` 6행이 남아 있어 사용자 전체를 세는 단언이 3 이 아니게 됨. 복원(R) 후 깨끗한 상태에서 재실행해 **41/41** 확인. 제품 문제 아님.
3. **누출 정규식 조정**: 첫 실행의 "누출 5"는 전부 `GET /api/v1/jobs/:id`(#55) 응답의 `"kind":"REVIEW_DECISION"` 이다. `JobDto.kind` 는 문서화된 필드(domain-model.md:696 enum·api-contract:963·1967)라 엔진명 누출이 아니다 → 그 경로의 그 한 문자열만 허용하고 다른 경로·다른 문자열은 전부 누출로 센다. 재실행 누출 0.
4. 미러 `package.json` 을 NFS 에서 복사해 둠(미러 한정 부작용). 미러에 `android/` 가 없어 브랜드 관련 테스트는 이 환경에서 skip 되는 환경 원인이며 지정 47개 범위 밖이다.
5. `tests/live/task010b-smoke.sh` 는 **돌리지 않았다** — qa-bot(계정 1)을 쓰고 010c QA 와 계정·쿼터가 겹친다. 같은 항목을 qa-bot2 로 직접 짠 스크립트로 대체(스모크의 6k·7f 와 동일 관점).

### 관찰 (결함 아님 — Leader 참고)

- **O-1 (Low)** 코드 폴백 세션은 항목 간격을 클램프하지 않아 DB 에 범위 밖 값(12·1)이 있으면 그대로 둔다. 모든 쓰기 경로(등록·러너·폴백)가 3~7 로 클램프하므로 앱 경로로는 만들어질 수 없는 값(내가 직접 심음). 방어가 필요하면 `ensureFallbackSchedule` 에서도 클램프할 수 있으나 필수 아님.
- **O-2 (Low)** `#55` `kind` 에 `REVIEW_DECISION` 이 노출된다 — 문서화된 필드이고 엔진명이 아니다. 2단계 화면이 이 값을 사용자에게 그대로 표시하지 않는지는 화면 QA 에서 확인.
- **O-3 (수용 한계)** 같은 날 DAILY 재시도 없음 — 실측 일치(`jobsToday=1`). 2단계 또는 별도 소형 task 의 QUEUED 고아 kick(Leader 결정)에서 다룬다.
- **O-4** stale 경계 5분 "정각"은 측정하지 않음(4.5분 alive, 7분 stale). 단위 테스트가 경계를 고정.
- **O-5** 백그라운드 A11·A5 지연: A11 DAILY 17.0s·완료 뒤 22.3s(폴링 포함)·A5 32.2s — 회화 5초 예산과 무관한 비동기 잡(동시 요청 응답 자체는 232~497ms).

### NOT_VERIFIED / 미실행

- **프로세스를 실제로 죽여 만드는 고아 잡**(배포 전환 중 종료)·서버 기동 시 `'restart'` 스윕 — 가짜 stale 행으로 대체(실 프로세스 kill 미실행: 개발 서버를 도중에 죽이면 공유 DB 에 반쯤 쓴 상태가 남을 위험).
- 2단계 화면·360/390/412 폭·터치 타겟·XSS 리터럴·사용자 화면 DOM 엔진명 — **이번 범위 밖(해당 화면 없음)**.
- 신뢰도 가중·`/api/health` 본문 — 범위 밖. 전체 단위 스위트(1169) — 미실행(Reviewer 값 인용 안 함).
- 실기기 항목(STT·TTS·APK·권한 거부) — 해당 없음.
- 운영 환경 스모크 — 금지 범위라 미실행.

### 정리

- 프로세스 정리: dev 3043 종료·포트 비움(A 서버·B 서버 각각 PID 파일로만 종료, `pkill -f` 미사용, 마지막 `ss -ltn` 3043 비어 있음, 내 `next dev`·`qa010b` 프로세스 0). `~/.node-local/thekaiwa*` 신규 복제본 0(`thekaiwa-qa-011b` 는 Leader 지정 기존 미러라 유지).
- 산출물 정리: 23개 삭제(스크래치 `qa010b-srv` 폴더 1 + 내부 19(쿠키·기준선·스크립트·로그·PID 파일·node_modules 링크 포함) + 단위·tsc·eslint 로그 3), 스크린샷 0장, `/tmp/qa-artifacts` 없음.

```json
{ "taskId": "task-010b", "status": "DONE", "scope": "stage1-server", "verdict": "PASS", "defects": [], "risk_level": "LOW", "realLlmCalls": 3, "metrics": { "a11_daily_ms": 17011, "a11_after_complete_ms": 22311, "a5_ms": 32206 }, "notVerified": ["actual process-kill orphan", "stage2 screens", "full unit suite"] }
```
