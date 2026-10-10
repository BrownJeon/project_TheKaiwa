---
task_id: task-042
title: "주제 단어 세트 서버 + A12 topicWords(B2) — #47 generate·#48·#49·#51·#53·topics/pool·폴백 (IMP-0024, 설계서 T2)"
status: done
base_ref: 5c3a701
risk_level: R2
roles_involved: [leader, judge, prompt-engineer, developer, reviewer, codex, qa]
related_tasks: [task-040-improve-challenge-design, phase2-batch-plan, task-p2-db0-schema, task-041-challenge-core, task-043-challenge-screens, task-044-today-integration, task-008-vocab-today-words, task-010-today-lesson, task-010b-repetition]
imp: [IMP-0024]
tags:
  - type/task
  - domain/challenge
  - domain/prompt
  - domain/db
aliases:
  - 주제 단어 B2
  - A12 topicWords
  - task-042
created: 2026-10-06
updated: 2026-10-10
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
개선 항목 [[IMP-0024-챌린지-계획표-개편]] 의 **설계서 T2**(v2.2 의 T5 흡수) — 챌린지 주제로 **오늘의 단어를 AI 가 매일 새로 만드는 서버 쪽 전부**(사용자 결정 U3 = **B2**). 정본은 `docs/design/challenge.md` v2.3 §4-3a~e·§5-2·§9-2.

- **A12 `topicWords`(신규 AI 지점, PE)**: 그 주제·수준의 새 단어를 만드는 요청 빌더·스키마·항목 검사·픽스처·실측. 엔진 task 표에 한 줄.
- **#47 주제 세트**: `topicId` + `generate?`(기본 true) — 그날 그 주제 첫 세트면 A12 를 **동기**로 부르고(벽시계 30초·취소 전파), 실패·지연·부족이면 B1 풀(주제 기본 표현 + 이 주제 수업 표현)로 **폴백·채움**. 응답 `generation{source, generatedNow, reason}` · 409 `{reason:'GENERATING'}`.
- **카드 저장·키**: 새 단어는 카드 스냅샷에만(`VocabAttempt.refType='AiWord'`·`refId=repetitionRefId(textJa)`), 반복 항목은 `('Expr', refId)` 로 — 수업 표현과 **같은 `RepetitionItem` 행**에 쌓이게(`repetitionKeyOfCard`). 단어장 자동 추가 0.
- **세션 DTO**: `topic{id, title, lessonCardCount, aiCardCount}` 를 #47·#48·#49·#51·#52·#53 이 같은 값으로. #51 은 주제 카드 반복 항목 등록·스냅샷 `data.topicId`·`wrongWords[].source`. #53 은 주제 세트로 다시 풀기(LLM 호출 없음). 오늘 제외 = 같은 주제 세트에서 **답한 카드만**.
- **스키마는 이 task 가 쓰지 않는다** — D4(`VocabSession.topicId`)·D5(`VocabAttempt.refType`·`refId`)는 WP-DB0([[task-p2-db0-schema]])가 쓰고 Leader 가 한 번에 push 한다. T2 는 `prisma/schema.prisma` 를 건드리지 않고 push 뒤 미러에서 `prisma generate` 만 한다.

## 사용자 결정
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**.
- 2026-10-06 사용자 답(AskUserQuestion, Leader 전달 — 이 이력서 작성자는 원문 대화를 보지 못함): **DB 전부 승인**(챌린지 D1·D2·D4·D5 — 모두 추가만, 백업 후 통합 `db push`) · **운영 배포는 모든 작업이 끝난 뒤 한 번에** · **챌린지 U3 = B2**(오늘의 단어 LLM 생성), 나머지 U1~U15·N1~N3 은 설계서 권고안으로 확정.
- 확정값 요약(설계서 §11-4a — ★ = 이 task 가 직접 쓰는 것):

| # | 결정 | 확정값 |
|---|---|---|
| U1·U2 | 데이터 모델·DB | A 새 표 `Challenge` · D1·D2·D4·D5 한 번에 승인(추가만) — D4·D5 가 이 task 몫(스키마 작성은 DB0) |
| U3 ★ | 오늘의 단어 | **B2** — A12 `topicWords` 가 매일 새 단어를 만든다. 폴백·채움은 B1 풀 (설계서 권고 B1 과 다름) |
| U4 ★ | 풀 부족 | 주제 표현만(내 단어장으로 채우지 않음). B2: 새 단어 → B1 풀 순 |
| U5 | 수업 만드는 시점 | C3+ 한 번 탭 — 단어 쪽 새 LLM 경로는 #47 의 A12 하나뿐 |
| U6 | 010d 범위 | 나눠서(A1-서버 지금 · A1-PE 039 뒤 · A2 T1 뒤 · A3+B 캡처 뒤 · 챌린지 2단계) |
| U7·U8·U9·U10 | 지표 원천·유예·IA·탭 이름 | (iii) 읽을 때 계산 · 오늘 유예 · F1 · "계획표" 유지 → [[task-041-challenge-core]]·[[task-043-challenge-screens]] |
| U11 ★ | 기간·장수 | 7·14·30일 · 단어 5·10·15장(기본 표현 수를 넘는 장수는 비활성 — 시드 주제는 15 비활성) |
| U12·U13 | 무엇을 셀지·개수 | (가) 같은 주제면 어디서 했든 · 진행 중 1개·그만두기만 |
| U14 ★ | 하루 달성 기준 | W2 — 목표 장수의 80%(5→4·10→8·15→12)를 그날 합산 + 다시 풀기도 셈 + 수업은 끝내기만(W4 없음) |
| U15 ★ | 주제 세트 다시 풀기 | A — 주제 세트로 다시 풀기 + 통계 포함 |
| N1 ★ | [단어장에 넣기] | A — 바로 넣기(카드 스냅샷 표기·읽기·뜻, 예문 없음) |
| N2·N3 | 이름·수업 만들기 위치 | 자동 "<주제> N일 챌린지" · 오늘 탭 회화 카드에만 |
| 설계 판단 ★ | 예문·A12 | **E2 예문 없음**(저장 칸 없음 — E3 는 추가 DB 승인 필요) · **fast(haiku)** · **G1 [시작하기] 동기** · **벽시계 30초** |

## 설계 방침 (설계서 v2.3 요약 — 근거 절 번호는 `docs/design/challenge.md`)
- **모듈 경계(§4-3a·§10-1)**: A12 요청 객체는 L2 `conversation.buildTopicWordsRequest` 가 만들고 **#47 라우트(app 층)가 값으로** `learning.vocab` 에 넘긴다(A10 `words/route.ts` 선례). L3 는 `engine.llm.completeJson` 만 부르고 응답은 **로컬 구조 타입**으로 받는다 — **L3 → L2 import 금지**. 엔진 task 표에 `topicWords: { tier:'fast', timeoutMs:20_000, lane:'interactive' }` 한 줄(`engine/router/tasks.ts`, 모델명은 코드에 없고 tier → 모델은 연결 `runtime.modelByTier`). 페르소나는 `tutor.md` 를 쓰지 않고 짧은 자체 `LlmPersona`("단어 목록 생성 도구, 대화하지 않고 JSON 하나만").
- **A12 입력(§4-3a)**: `topic{title, titleJa, description, level}`(수준 = 주제 수준) · `count = min(20, ceil(1.3 × 목표 장수))`(10→13·5→7·15→20, PE 실측으로 조정 [설계 목표]) · `exclude` = 그 주제 `TopicChunk.textJa` 전부 + 이 사용자가 이 주제로 만든 이전 새 단어 카드 `surfaceSnap`(최근 것부터 최대 300개·2,000자 [설계 목표]). **넣지 않는 것**: 사용자 약점·오답·회화 기록·단어장(과설계 방지·개인 기록 외부 전송 최소화). 내 주제 설명이 사용자 글이 되면 `INJECTION_GUARD` 로 데이터 취급.
- **A12 출력·스키마(§4-3a)**: `{ words: [{ textJa, reading, meaningKo, chunkType, jlpt, valid }] }`(`jlpt` N5~N1 또는 null, `valid` = 모델 자기 확신). **예문은 뺀다(E2)**. 스키마(ajv)는 구조만 — `words` 1~20·항목 `additionalProperties:false`·`chunkType` enum·길이(`textJa` 1~40 · `reading` 1~80 · `meaningKo` 1~80 = 카드 칸 80·120·200 안, 자르기 없음) · `stripAdditionalProperties:true`(lesson@v7 선례) · ajv 1회 재시도. **읽기 가나 패턴은 스키마에 넣지 않고 항목 검사로 버린다**(한 항목의 읽기 오류로 응답 전체가 재시도되면 사용자 대기가 두 배 — lesson@v3·v4 선례). `extraCheck` 없음. 프롬프트 ≤ 3,500자 [설계 목표 — PE 실측].
- **항목 검사(버림, §4-3a)**: ① `valid === true` ② `textJa` 에 가나·한자 1자 이상·한글·라틴 없음 ③ `reading` 이 `LESSON_READING_PATTERN` ④ `meaningKo` 에 한글 1자 이상 ⑤ `jlpt` 가 null 이거나 `levelWindow`(주제 수준 ±1) 안 ⑥ **중복** — `normalizeRefText(textJa)` 가 서버 쪽 전체 제외 집합(상한 없는 원본 + 이번 응답 앞 항목)에 있으면 버림 ⑦ **뜻 중복** — 정규화한 `meaningKo` 가 앞 항목·주제 기본 표현 뜻과 같으면 버림. 검사 함수는 L2 순수 함수(PE 픽스처 테스트), L3 가 DB 지식(제외 집합)으로 ⑥ 을 다시 적용.
- **언제·어떻게 부르나(§4-3b·§4-3e)**: **G1 — [시작하기] 때 #47 안에서 동기 생성**. 순서: 검증(`topicId` 와 `category` 동시 → 400, `generate` 는 `topicId` 와만) · 주제 소유(404) → (잠금 없이) 진행 중 세트면 409 `{sessionId}` → `todayAi`·`answered` 조회 → 생성 여부 판단 → **A12 는 트랜잭션 밖**(사용자 행 잠금을 30초 쥐지 않는다) → 항목 검사 ①~⑦ → 트랜잭션(`lockUserRow` → `assertNoInProgress` → 후보 = fresh 가 있으면 fresh 앞에서 `count` 장, 아니면 오늘 새 단어 중 answered 에 없는 것 → 모자라면 B1 풀로 채움 → 0장이면 `empty TOPIC_ALL_DONE_TODAY`) → `insertSession`.
- **상한·완화책(§4-3b·§5-2)**: ① 벽시계 **30초**(요청 시작부터 **큐 대기 포함** — 엔진 `timeoutMs` 는 프로세스 시작부터라 큐 대기를 재지 않는다) — 라우트가 `AbortSignal.any([req.signal, AbortSignal.timeout(30_000)])`(설계서 §12-3 기록: 우분투 Node v20.20.2, 20.3 부터 지원) · 큐에서 기다리던 중이면 프로세스를 띄우지 않고 실행 중이면 자식을 멈춘다 → B1 폴백 ② **취소 전파** — 손님이 끊으면 세트를 만들지 않는다(Next.js 라우트의 `req.signal` 전달은 이 저장소에서 확인한 적 없음 [추측] → **T2 라이브 테스트 필수**, 안 닿아도 30초가 최악을 묶는다) ③ **사용자당 동시 생성 1**(프로세스 메모리 표시 — 두 번째 요청은 409 `{reason:'GENERATING'}`, `generate:false` 는 막지 않음) ④ **하루 성공 1회 재사용** · 실패만 했으면 다음 [시작하기]·[한 세트 더] 에서 재시도, **사용자당 하루 3번**(초과 시 폴백 `LIMIT`, 메모리 버킷) ⑤ fast tier·예문 없음·`exclude` ≤ 2,000자.
- **폴백 사유(§4-3c, #47 응답에만 — 저장 안 함)**: `source` = `'AI'`(통과 ≥ 요청 장수) · `'MIXED'`(통과 1장 이상 < 요청 장수 → 새 단어 + B1 채움, reason `SHORT`) · `'TOPIC'`(B1 만). `reason` = `NEW_DONE`(오늘 새 단어를 다 풀었거나 모자람) · `TIMEOUT` · `FAILED`(엔진 오류·연결 없음) · `INVALID`(ajv 재시도 뒤에도 위반·통과 0장) · `LIMIT` · `SKIPPED`(사용자가 [주제 표현으로 바로 풀기] = `generate:false`). **폴백 세트도 하루 판정에 똑같이 더해진다**(판정은 카드 출처를 보지 않는다) — LLM 이 하루 종일 실패해도 B1 풀만으로 목표에 닿는다.
- **저장·키(§4-3d)**: 카드 `wordId=null` · `surface/reading/meaningSnap` · `refType='AiWord'` · `refId=repetitionRefId(textJa)`(sha1 정규화 표기 40자 — 수업 표현 `Expr` 과 **같은 함수**) · `choices`. 반복 항목(#51)은 `repetitionKeyOfCard(refType, refId)`(`AiWord → Expr`, 나머지 그대로) 한 함수로 — 같은 표기를 수업에서 만나면 한 행에 쌓인다(`@@unique(userId, refType, refId)`). 카드에 `'Expr'` 를 그대로 쓰지 않는 이유 = 새 단어와 수업 표현을 카드로 구분할 수 없어 `lessonCardCount` 가 새 단어까지 세기 때문. `WordEntry` 는 [단어장에 넣기](#41, N1 A)를 눌러야만 생긴다(자동 추가 0 — "AI 는 제안만"). 다시 풀기(#53)는 `AiWord` 카드를 그대로 복사(LLM 호출 없음), 보기는 주제 풀 뜻 ∪ 내 단어장 뜻 ∪ 같은 세트 다른 카드 뜻.
- **B1 풀(`learning/topics/pool.ts` 신규, §4-3 ①~⑩)**: `TopicChunk` ∪ `Lesson(userId, topicId, kind=NEW, status=DONE).content.chunks`(최근 60개, 정규화 표기 중복 제거) · 폭 필터(`textJa` > 80자·`reading` > 120자 제외) · 출처 키는 **수업 완료가 쓰는 함수 그대로** `lessonRepetitionItems(content, {topicChunkIds, outcomes: []})`(K1 — pool 이 sha1·분류를 다시 구현하지 않는다) · 오늘 제외 = 같은 주제 세트에서 **답한(맞힘·틀림) 카드만**(지금 단어 세트 규칙 `sessions.ts:308-313` 과 다름 — 같게 두면 일찍 끝낸 날 목표에 못 닿는다) · 가중치는 지금 공식 그대로 · 보기(CHOICE) 오답은 같은 주제 풀 뜻 ∪ 내 단어장 뜻, 서로 다른 뜻 < 4 면 FLIP 강등 · `empty.reason` = `TOPIC_EMPTY`·`TOPIC_ALL_DONE_TODAY`(그날 단어 과제를 채운 뒤에만). **pool 은 barrel `../lessons`(`lessons/index.ts`)를 import 하지 않고 `../lessons/content` 와 `../repetition` 을 직접 import**(순환 방지 — `lessons/today.ts → challenges → topics/pool → lessons/index → today.ts`) — T2 에 이 import 를 grep 으로 막는 검사(또는 lint 한 줄)를 둔다.
- **#51 finish(§9-2)**: 지금 트랜잭션 순서 그대로(새 잠금·새 표 쓰기 없음) + 주제 카드 답 → `RepetitionItem(CHUNK|EXPRESSION)`(`AiWord` 는 `('Expr', refId)`) · StudyLog 요약 "주제 단어 「카페 주문」 10장 …" · VOCAB_SESSION 스냅샷 `data.topicId` · `wrongWords[]` 에 `source: 'WORD'|'TOPIC'` · 응답 `challenge?: {challengeId, date, dayIndex, goalMet, goalMetNow, words:{answered, need}|null}` 는 **커밋 뒤** 라우트가 [[task-041-challenge-core]] 의 `challengeProgressAfter` 로 조합(try/catch → null, 실패해도 세트 끝내기는 되돌려지지 않음).
- **세션 DTO `topic`(§9-2)**: 주제 세트면 `{id, title, lessonCardCount, aiCardCount}`, 아니면(내 단어장 세트·주제가 지워짐) null. `lessonCardCount` = 카드 중 `refType='Expr'` 장수, `aiCardCount` = `refType='AiWord'` 장수. **카드 행에서 세므로 풀을 다시 읽지 않고, 새로 고침·이어 풀기·다시 풀기 뒤에도 값이 변하지 않는다.** 비용: #47·#53 = 만든 카드에서 셈 · #49 = 이미 읽는 카드에서 셈(`ATTEMPT_SELECT` 에 `refType` 추가, 카드 응답 `toCardDto` 에는 싣지 않음, `refId` 미노출 규칙 그대로) · #48 = 주제 세트만 대상 `vocabAttempt.groupBy` 1회 · #51 = 끝내기 트랜잭션이 이미 읽는 카드에서 셈 · #52 = 주제 세트일 때 `count` 1회.
- **새 단어 응답 규칙**: 카드 응답에 정답(`meaningSnap`)·`refId` 를 싣지 않는다(CHOICE 미답 상태). 엔진명·모델명 노출 0 — `generation.reason` 은 사유 코드만.
- **5초 지표(§5-2)**: B2 로 챌린지 1단계에 새 LLM 경로가 하나 생긴다 = #47 의 A12(interactive 레인, 사용자가 대기 화면에 있는 동안만). 비선점 직렬 큐라 오늘 탭 진입 직후(A11 DAILY batch 13~17s)·[오늘 수업 만들기](A4 batch 26~69s) 직후 [시작하기] 를 누르면 A12 가 그 남은 시간만큼 줄을 서고, 30초 상한에 걸리면 B1 폴백이 될 수 있다(목표는 막히지 않는다).
- **PE 진행(`pe-042-a12` — 별도 에이전트)**: developer 와 병렬(계약 = 설계서 §4-3a). 합격 게이트(§4-3a): 주제 5개 × 수준 픽스처로 haiku 실측 — **항목 통과율 ≥ 85%**(검사 ①~⑦ 뒤) · **사람 검수 읽기 정확 ≥ 95%** · **생성 p95 ≤ 15s**. 못 넘으면 `topicWords` task 표 한 줄을 `balanced` 로 바꾸고 벽시계 상한을 다시 정한다(코드 1줄, 모델명은 DB). 픽스처: 시드 주제 5개 × (첫날 · 이미 낸 표기 100개) + 주입 문자열이 든 주제 설명 1건. **developer 진행 순서**: A12 가 오기 전에 B1 풀·DTO·D5 등록·#53 부터, A12 가 온 뒤 생성 연결(동기 — 비동기 잡은 `JobKind` 값 추가라 승인 밖).
- **T6(챌린지 × 시나리오)는 보류** — 이 task 와 무관, 후속 한 줄 기록만(010d-B 이후 2단계 조건부).
- **진행 절차**: judge intake(R2) → PE(A12) ∥ developer → Reviewer → judge C2 → (판정 시) Codex → QA → Leader 로컬 커밋(pathspec). 정본 갱신(§11-3 T2 행 + `design-spec.md` §8 AI 지점 표에 A12 행)은 Reviewer PASS 뒤 **Leader 단독**(C17).

## 예상 변경 경로
- **PE**: `src/modules/conversation/prompts/topicWords.ts`(신규 — `buildTopicWordsRequest`·`TOPIC_WORDS_PROMPT_VERSION='topicWords@v1'`) · `src/modules/conversation/structuredResponse/topicWordsSchemas.ts`(신규 — 스키마·`TopicWordsResponse`·항목 검사 순수 함수 — **Leader 확인 필요 §2**) · `src/modules/conversation/index.ts`(export 한 줄 — 039 미커밋 파일 아님, 2026-10-06 22:00 확인) · `tests/prompts/fixtures/topic-words.json` · `tests/live/topic-words-measure.ts` · 단위 테스트(신규 파일 — 039 가 수정 중인 `conversation/__tests__/{lesson,prompts,task026,task028}.test.ts` 는 건드리지 않는다)
- **developer**: `src/modules/learning/topics/pool.ts`(신규 — 카드 출처 상수 `'AiWord'` 등 포함) · `src/modules/learning/vocab/{sessions.ts, distractors.ts, topicSet.ts(신규)}` · `src/app/api/v1/vocab/sessions/route.ts`(#47)·`[id]/route.ts`(#49)·`[id]/finish/route.ts`(#51)·`[id]/replay/route.ts`(#53) · `src/types/vocab.ts` · `src/modules/engine/router/tasks.ts`(한 줄)
- 테스트: `src/modules/learning/__tests__/**`(신규 파일 — 이름은 developer 가 정함) · `tests/live/`(스모크·참고치 도구 — 이름은 developer 가 정함)
- 문서(Leader 단독): `docs/design/domain-model.md`(§9-3 `VocabAttempt.refType` 값에 `'AiWord'` + `repetitionKeyOfCard` 규칙 한 줄 · `topicProgress`·`result.wordSets` 정의) · `api-contract.md`(#47 `generate`·`generation`·409 `GENERATING`, 세션 DTO `topic.aiCardCount`, #48·#49·#51·#52·#53 additive) · `module-dependency.md`(L3 `topics/pool`·`vocab/topicSet`, L2 `prompts/topicWords`·`topicWordsSchemas`, "요청은 라우트가 만들어 값으로" 규칙) · `design-spec.md` §8 A12 행

## 완료 기준 (QA 가 실행으로 확인)
설계서 §11-2 T2 행·§5-2 를 그대로 옮긴다.

1. **PE 합격 게이트**: 항목 통과율 ≥ 85% · 읽기 정확 ≥ 95%(사람 검수) · 생성 p95 ≤ 15s(위 방침). 못 넘으면 `balanced` 로 바꾼 결과와 재설정한 상한을 기록한다.
2. **단위·계약 테스트**:
   - **키 동일성**: pool 이 `lessonRepetitionItems` 에 넘기는 입력을 검증 — `topicChunkIds` 에 **그 주제의 조각 id 집합**(= 수업 완료 `lifecycle.ts:128-129` 와 같은 입력)이 들어가는지. 픽스처 수업 본문에 ⓐ 주제 조각 id 를 그대로 쓴 조각 ⓑ `new-N` 조각 ⓒ 다른 주제 조각 id 를 쓴 조각 → ⓐ `TopicChunk` · ⓑⓒ `Expr`, 그리고 `topicChunkIds` 를 빈 집합으로 바꾸면 ⓐ 가 `Expr` 로 바뀌어 테스트가 실패하는지(입력 누락 검출). 통합: 수업을 끝내 `Expr` 항목을 등록한 뒤 그 표현이 든 주제 세트를 끝내면 `RepetitionItem` **행 수가 늘지 않고** 그 행의 카운터만 오른다.
   - **`lessonCardCount`·`aiCardCount`**: 같은 세트의 #47 값 = #48 항목 값 = #49 값 = 그 세트의 `Expr`/`AiWord` 카드 수.
   - **폴백 전 경로**(가짜 엔진으로 시간 초과·엔진 오류·ajv 위반·통과 0·부족 → `SHORT`/`TIMEOUT`/`FAILED`/`INVALID`, `LIMIT`, `generate:false` → `SKIPPED`, 오늘 새 단어를 다 풂 → `NEW_DONE`) · **손님 취소 → 세트 0** · 벽시계 30초 → 폴백 세트 · **하루 성공 1회 뒤 재사용(LLM 0회)** · 생성 중 두 번째 요청 → 409 `GENERATING`.
   - 중복·뜻 중복 표기 버림 · 수준 창 · 카드 폭(표기 40·읽기 80·뜻 80) · **정답 미노출**(`meaningSnap`·`refId` 응답 0) · `barrel ../lessons` import 금지 grep · **L3 → L2 import 0**(eslint).
   - 오늘 제외 = 같은 주제 세트에서 답한 카드만(건너뛴 카드는 빼지 않고, 다른 주제·내 단어장 세트의 답은 영향 없음).
3. **5초 지표(§5-2)**:
   - **ⓑ 합격(결정적, #47 주제 세트)**: 요청 1건당 A12 **≤ 1회**(ajv 재시도 포함 호출 ≤ 2) · 그날 그 주제 생성 성공 뒤 같은 날 요청은 **0회**(재사용) · `generate:false`·두 번째 세트·`LIMIT` 은 **0회** · **`AiJob` 증가 0**(동기 — 잡을 만들지 않음) · lane = interactive · **벽시계 30초를 넘는 A12 Trace 0**(상한에서 중단돼 상태 중단으로 남음). 그 밖 챌린지 경로(#155~#159 등)는 [[task-041-challenge-core]] 의 ⓐ.
   - **참고치(LLM 직렬 슬롯)**: **(다)** 주제 세트 [시작하기] 대기 화면에서 곧바로 회화 탭으로 이동 → 첫 턴(A12 가 취소됐는지 Trace 로 확인 — 취소가 안 닿으면 남은 시간만큼 늦다는 사실을 기록) · **(라)** A12 대기 시간 p50/p95 — 오늘 탭 첫 진입 직후(A11 DAILY 겹침)와 평소 두 경우, 그리고 폴백 비율(사유별). 각 30턴 방식(`tests/live/task007-latency.ts`), 목표 회귀 ≤ +0.3s 는 [설계 목표]이며 합격 판정이 아니다.
   - **3분 지표(§5-2 (5))**: 그날 첫 세트는 A12 대기를 **포함해** 사용자 총시간 ≤ 180초 목표 [설계 목표 — task-008 실측 127.1s + 대기 ≤ 30s]. QA 가 첫 세트·두 번째 세트를 따로 잰다.
4. **QA 라이브(QA 계정 3)**: A12 실제 1회 → 새 단어 세트(읽기 가나·뜻·수준) · 같은 날 두 번째 세트 LLM 0 · 대기 화면 이탈 → A12 중단(Trace)·세트 0 · 폴백 문구 사유별 · **`WordEntry` 행 수 불변**(자동 추가 0) · `RepetitionItem` 병합(같은 표기 1행) · 누적 세트 수 = 답한 카드 ≥ 1 세트만(확인 표 13) · 다시 풀기 후 #54 불변·삭제 후 불변 · 엔진명 0.
5. 회귀: 단위 전부 + `tsc --noEmit`·변경 파일 eslint 0 + 기존 스모크(008 단어·010b·011 등 영향 경로).

## 파일 경계
계획서 [[phase2-batch-plan]] §2 충돌 지도 기준.
- **소유**: C6 `learning/vocab/{sessions,distractors}.ts`·`app/api/v1/vocab/sessions/**`(finish 포함)·`types/vocab.ts` · `learning/topics/pool.ts`·`learning/vocab/topicSet.ts`(신규) · `engine/router/tasks.ts` 한 줄 · PE 신규 파일 4개.
- **금지(C1·C2)**: `prisma/**`(DB0 만) · **task-039 미커밋 파일** — `conversation/prompts/{chat,chatReview,lesson,talk}.ts` · `conversation/structuredResponse/{schemas,checks}.ts` · `orchestrator/{index,shape}.ts` · `.claude/agents/tutor.md` · `src/types/chat.ts` 등(`git status` M, 039 로컬 커밋 전 아무도 손대지 않는다 — A12 는 새 파일에 스키마를 두어 `schemas.ts` 무수정) · `components/**`(043·044) · `learning/challenges/**`(041) · `learning/index.ts`(C5 — vocab export 는 이미 있음, 하위 `index.ts` 만) · `tests/live/qa-session.ts`(DB0).
- **PE 는 1명이 직렬로**(A12 → 010d 시드·초안 → A1-PE, 계획서 C2). A12 PE 는 `schemas.ts`·`talk.ts` 를 건드리지 않는다.
- **#51 `challenge?` 조합**은 T1 `challengeProgressAfter` 로컬 커밋 뒤(계획서 C6).
- **미러**: `~/.node-local/thekaiwa-042`, dev 포트 **3022**(`KAIWA_LOCAL_ROOT="$HOME/.node-local/thekaiwa-042" bash scripts/sync-local.sh`). **NFS 만 편집**, DB0 push 뒤 이 미러에서 `prisma generate` 1회. 남의 미완성 파일 때문에 `tsc` 가 깨지면 소유 밖 파일은 고치지 않고 기록 → Leader(계획서 §3 규칙 4). 종료 시 dev 서버 종료·포트 확인, 미러 삭제는 사용자 몫.
- **QA 계정 3**(챌린지 레인) — [[task-041-challenge-core]] QA 와 시간을 나누거나(둘 다 진행 중 세트·챌린지 1개 규칙에 걸린다) 계정 1 의 IDOR 만 병행. **LLM 슬롯**: A12 실호출·참고치 (다)(라)·3분 지표는 직렬 — 계획서 §6 순서 "… 041 TTFA 참고치 → **PE A12** → **042 스모크** → PE 010d 시드·초안 …". LLM 없는 라이브는 병렬 가능.
- **커밋·배포**: 로컬 pathspec 커밋만, **push 금지**(운영 배포는 모든 WP 뒤 한 번에).

## 선행·후행
- **선행**: WP-DB0 push + 미러 `prisma generate`([[task-p2-db0-schema]]) · 설계서 v2.3(확정) · PE A12 ∥ developer(계약 = §4-3a). #51 `challenge?` 조합은 [[task-041-challenge-core]] 로컬 커밋 뒤.
- **후행**: [[task-044-today-integration]](#47·#49·#51 계약 — 대기 화면·출처 문구) · [[task-041-challenge-core]]((b) `topicProgress.aiWord*` 가 T2 `topics/pool.ts` 상수를 읽음) · 010d(PE 직렬 슬롯: 이 A12 다음).
- **후속(이 task 밖)**: T6 챌린지 × 시나리오 — 보류(010d-B 이후 2단계 조건부, `SnapshotKind` 추가 가능성 = 승인 밖). 2단계 후보: 그날 같은 주제 두 번째 생성("새 단어 더")·어제 틀린 새 단어 몇 장 섞기·새 단어 미리 만들기(G2 — 추가 DB 승인 필요).

## 관련 과거 이력 요약
- [[task-040-improve-challenge-design]]: 설계 정본(`docs/design/challenge.md` v2.3 §4-3a~e·§5-2·§9-2). v2.2 까지의 권고 B1 이 사용자 결정으로 B2 가 됐다.
- [[task-008-vocab-today-words]]: 오늘의 단어 세트·A10 단어 보강(`prompts/wordEnrich.ts`·`vocab/enrich.ts` — A12 의 페르소나 없는 사전형 요청·`valid`·수준 창 규약의 선례) · 단어 1세트 3분 실측 127.1s.
- [[task-010-today-lesson]]: 수업 완료가 조각을 반복 항목으로 등록(`lessons/content.ts:167-195`, `lifecycle.ts:128-129`) — pool 의 키 단일 출처.
- [[task-010b-repetition]]: `RepetitionItem`·`@@unique(userId, refType, refId)`·A11 판단 잡(세트 끝낸 뒤에도 걸림) — `AiWord` 답이 `Expr` 항목으로 쌓이는 근거.
- [[task-041-challenge-core]]·[[task-043-challenge-screens]]·[[task-044-today-integration]]·[[task-p2-db0-schema]]: 같은 설계서의 형제 task.
- 승인된 교훈: 없음(`/이슈기록 관련` 4개 질의 0건, 2026-10-06).

## 승인 상태
- **DB**: D4(`VocabSession.topicId` + FK(SetNull) + 인덱스 `(userId, topicId, date)`)·D5(`VocabAttempt.refType`·`refId`, FK 없음) — **사용자 승인 완료(2026-10-06, Leader 전달 — D1·D2·D4·D5 전부, 추가만)**. **스키마 작성은 WP-DB0**([[task-p2-db0-schema]]), 백업 → `migrate diff` 확인 → `db push` 는 Leader 가 한 번만. T2 는 `prisma/schema.prisma` 를 쓰지 않는다. **승인 밖(넣지 말 것)**: `VocabAttempt.exampleSnap`·`exampleKoSnap`(E3 예문 저장) · `JobKind` 값(비동기 생성) · "단어 은행" 표 — 필요해 보이면 줄을 넣지 말고 이 이력서에 "추가 승인 필요"로 기록한다.
- **데모**: 사용자 지시 원문(위 인용)에 따라 데모 승인 없이 진행한다. 화면 0(서버 + PE)이라 judge 가 데모 none 으로 볼 것으로 설계서가 예상한다. `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다(손으로 쓰지 않음). 지시 원문은 `check.mjs waive` 규칙에 걸리지 않아 정식 waived 기록이 없다 — 이력서에는 원문만 인용하고 `waived` 로 적지 않는다.
- **운영 배포**: 모든 작업이 끝난 뒤 Leader 가 한 번에. 이 task 단독 배포·push 금지. M4·네이티브(APK) 변경 없음.
- **판정 예상(설계서 §11-2, 최종은 judge)**: R2(채점·정답 경로 + **새 LLM 지점** + 엔진 task 표 한 줄) · standard · 데모 none.

## 판단 기록 (judge)

## Prompt-Engineer 기록

- [22:22][pe-042-a12 중간] **완료**: `prompts/topicWords.ts`(스키마·검사기·조립·장수 판정 동봉 — 설계서 `structuredResponse/topicWordsSchemas.ts` 분리 안 따름, Leader 결정 ④) · 픽스처 `tests/prompts/fixtures/topic-words.json`(케이스 30 + 이상 응답 17) · 오프라인 `conversation/__tests__/topicWords.test.ts` 62/62 · tsc 0 · eslint 0 · `conversation/index.ts` export 2줄 · 라이브 스크립트 `tests/live/task042-topicwords-measure.ts`(DB 접촉 0 — `routerDeps.loadChain` 시드 연결 대체, `wordEnrich` task(fast·20s·interactive)로 호출). **haiku 1차 측정(33호출, 주제 5×6일 + 큰 제외 목록 3): 전부 성공·1차 ajv 33/33·재시도 0 · 항목 통과 388/433 = 89.6%(체인만 94.2%) · p50 7.0s·p95 10.5s·max 10.6s · 읽기 눈 판정 386/388(오류 2: 温めて→あためて·三つ目→みつめ, 판정자 = 모델 1인).** **남은 일**: 30일 깊은 체인(cafe-order, 제외 목록이 상한에 닿는 구간) 측정 → 게이트 판정·Developer 인계 기록 → 보고. **다음 첫 행동**: `pe042-haiku-deep.json` 요약(`DUMP=1`) 확인.

- [22:45][pe-042-a12 **최종**] **A12 `topicWords@v1` 확정 — haiku(fast) 유지, 게이트 3개 통과(아래 한계 단서).** 위 [22:22] 중간 기록의 "남은 일"(깊은 체인·게이트 판정·인계)을 끝냈고, 측정 도중 찾은 약점 2개를 프롬프트·스키마에 반영한 **최종 프롬프트로 33호출을 다시 측정**했다.
  - **프롬프트 명세**: system 1,345자(고정) + 스키마 JSON ≈640자 + JSON-only 지시 + 입력 5줄(`[주제]`·`[수준]`·`[개수]`·`[이번 초점]`·`[이미 낸 표기]`) + 짧은 자체 페르소나 ≈110자(tutor.md 안 씀 — 절 필터 없음). 응답 `{words:[{textJa, reading, meaningKo, chunkType, jlpt, valid}]}`(예문 없음 E2). 요청 장수 `min(20, ceil(1.3×목표))`. 규칙: 일상 회화 단어·짧은 표현(2~12자)만, 시험 문법 용어·급수 설명·후리가나·한글·로마자·슬래시·문장부호 금지, reading 은 가나만, jlpt 는 수준 ±1·모르면 null, `[이미 낸 표기]` 대조 후 다른 표현, 입력 안 지시문 무시. 한 항목 오류로 응답 전체를 재시도하지 않게 읽기·중복·수준은 스키마가 아니라 **항목 검사**가 버린다. `stripAdditionalProperties:true`, `extraCheck` 없음. 프롬프트 길이(엔진이 실제로 보내는 글자 수, 측정 `promptChars`): 제외 12~90개 **2,392~2,810자**, 상한(300개·2,000자) 근처 **4,324~4,334자** — 설계 목표 ≤3,500 은 제외 목록 ≈1,000자(≈130개, 10장/일 기준 12일째)까지만 지켜진다(설계서 산식이 스키마 JSON 을 세지 않았다). 출력 ≈1,300~2,200자.
  - **항목 검사(순수 함수 `assembleTopicWords`)**: ① `valid===true` ② 표기는 가나·한자·숫자·`〜`·`・` 만(한글·로마자·괄호·부호·공백 거부, 가나·한자 1자 이상) ③ 읽기는 가나·`ー`·`・` 만 + **표기의 가나 부분과 대응**(전부 가나면 가타/히라 무시하고 일치, 한자 섞이면 앞·뒤 가나 구간 일치 + 읽기 길이 ≥ 표기 글자 수) ④ 뜻에 한글 있고 가나 없음 ⑤ jlpt null 또는 주제 수준 ±1 ⑥ 중복(`normalizeRefText` 와 같은 정규화 — 서버 전체 제외 집합 + 응답 앞 항목) ⑦ 뜻 중복(앞 항목·주제 기본 표현 뜻) + 엔진명 비노출 + 길이(표기 80·읽기 120·뜻 80 = 카드 칸). 시드 정답 110쌍(주제 표현 60 + 시드 단어 50 중 chunkType 있는 48)이 **하나도 버려지지 않는다**(거짓 거절 0, 테스트로 고정).
  - **측정 표(합성 입력, haiku 직렬, 호출 간격 1.5s, DB 접촉 0 — 연결은 시드 값 stub, `wordEnrich` task 로 호출)**:

| 측정 | 호출 | 1차 ajv | 항목 통과 | 목표 장수 충족 | p50 / p95 / max | 비고 |
|---|---|---|---|---|---|---|
| 중간(프롬프트 초판) | 33 | 33/33 | 388/433 = 89.6% (체인만 94.2%) | 29/33 | 7.0 / 10.0 / 10.6s | 큰 제외 목록 스트레스 3호출은 주제를 섞어 설계한 탓에 43.6% — 대표성 없음 |
| 깊은 체인 v1(cafe-order 30일, 10장/일) | 30 | 29/30(재시도 1: `jlpt:"null"` 문자열) | 일 11~30 구간 붕괴 | 일 11 이후 감소 → 21~30일 통과 **3/100** | 7.2 / 8.1 / 16.5s | 제외 목록 163개 이상에서 같은 6~13개를 되풀이 |
| 깊은 체인 v1.2(+초점) | 30 | 30/30 | 일 16~30 통과 76/150 | 21~30일 **57/100** | 7.1 / 9.0 / 9.2s | 새 카드 총 201장(v1 155장) |
| **최종(표 기준값)** | **33** | **33/33 (재시도 0)** | **413/433 = 95.4%** (체인 376/394) | **33/33** | **7.2 / 9.9 / 10.9s** | 장수별 p50: 7개 4.8s · 13개 7.2s · 20개 9.9s(최대 10.9s) |

  - **게이트 판정(최종 33호출 기준 + 보강 측정)**: ① 항목 통과율 ≥85% → **95.4% 통과**(버려진 20: valid=false 8·로마자 표기 9·뜻 중복 2·제외 중복 1) ② 읽기 정확 ≥95% → **통과** — 자동 검사 거절 최종 측정 0건(초판 측정은 430개 중 1) + **눈 판정 412/413 = 99.8%**(오류: 想像→そうぞく). 앞선 두 측정까지 합치면 약 99.3%(오류 7/1,032: 三つ目→みつめ·温めて→あためて·もう一つ→もういっつ·ミルクははいれ(は 중복)·何になさい→なになさい·想像→そうぞく·温い→ぬくい(애매)). ③ p95 ≤15s → **통과** — 최종 p95 9.9s, 측정 126호출 전체(p50 7.1s·p95 9.9s)에서 15s 초과 1건(16.5s)·20s 초과 0건. **단서**: 판정자는 이 모델 한 명(원어민 검수 아님 — 같은 계열 모델의 맹점은 못 잡는다)·합성 입력 5주제(N5·N4)·큐에 다른 호출이 없는 조용한 상태·p95 는 표본 33이라 두 번째로 느린 값이다(0/33 초과의 95% 상한 ≈9% — "p95≤15s 입증"이 아니라 "초과가 드물다"). **주제 적합도(초판 측정에서 눈 판정 10호출)**: 주제 직접 관련 약 90%(129/143, 벗어난 것은 毎日·朝·夜·天気 같은 일반 시간·날씨 말 — 자기소개·주말 계획에 몰림) — 1인 판정. **내용 결함(읽기 외)**: 약 1~2% — 그 밖에 `そっですか`(오타)·`薄いめに`·`温かいままください`(비문)·`甘めです`(뜻 깨짐 "단편, 단쪽")·`キャリー`=테이크아웃(오역)·`景色がいいでした`(비문) 등, 검사로 못 잡는다.
  - **모델 권고**: **fast(haiku) 유지**, `balanced` 로 바꾸지 않는다(게이트 통과, sonnet 은 측정하지 않음 — 필요가 없었다). task 표 한 줄은 그대로(`topicWords: { tier:'fast', timeoutMs:20_000, lane:'interactive' }`) — 최대 10.9s·20개 요청도 20s 안. 벽시계 30초 상한은 큐 대기 몫이라 변경 근거 없음.
  - **측정 중 찾아 고친 것(재발 가능한 함정)**: ⓐ `jlpt` 를 모델이 JSON null 이 아니라 **문자열 `"null"`** 로 내 ajv 위반 → 재시도 +6s(깊은 체인 30호출 중 1회, 최종 측정에서도 한 호출에 3개) → 스키마가 `"null"` 을 받고 조립이 null 로 본다 + 지시문에 "따옴표 없는 JSON null". ⓑ **제외 목록을 넣어도 모델이 무시**: 같은 주제 15일째(제외 163개)부터 같은 표현 6~13개를 되풀이해 통과 0~2장으로 굳었다(프롬프트 글자 수까지 같아 같은 응답이 반복 — 재시도로는 안 풀린다) → `[이번 초점]` 8방향(명사·동작·상태·수량/부사·상대의 말·부탁/질문·인사/맞장구·덜 흔한 표현)을 `variant` 로 순환시켜 입력을 바꿈. 후반 21~30일 통과 3→57/100. **완전 해소는 아니다**: 16~25일 구간은 여전히 통과 40% 안팎. ⓒ valid=false 를 "제외 목록 중복 표시"로 오용하는 호출이 있었다(8/13 한 호출) → 지시문에 금지 문장. ⓓ 로마자 포함 표기(`Mサイズ`·`Lサイズ`)는 지시문에 예를 넣어도 나온다(cafe-order 호출의 ≈15%) — 검사가 버린다(설계서 ② 유지). 허용하려면 "가나·한자와 붙은 대문자 1~2자" 예외를 `SURFACE_ALLOWED` 에 넣으면 되는데 설계 결정이라 하지 않았다.
  - **Developer 인계(핵심)** — import 는 전부 `@/modules/conversation`(index.ts export 2줄을 PE 가 더함): `buildTopicWordsRequest`·`assembleTopicWords`·`classifyTopicWordsResult`·`topicWordsRequestCount`·`buildTopicWordsExcludeLine`·`TOPIC_WORDS_*`·타입(`TopicWordsInput`·`TopicWordsRequest`·`TopicWord`·`TopicWordsAssembled`·`TopicWordsOutcome`·`TopicWordDropReason`). **L3 는 L2 를 import 할 수 없으니 #47 라우트가 값으로 넘긴다.**
    1. **엔진 한 줄**: `engine/router/tasks.ts` 에 `topicWords: { tier: 'fast', timeoutMs: 20_000, lane: 'interactive' }`(PE 는 안 건드림). 이 키가 들어가기 전에는 요청의 `task` 가 `as unknown as LlmTask` 캐스트라 컴파일만 된다(`userTranslation` 선례).
    2. **요청**: `buildTopicWordsRequest({ topic:{title, titleJa, description, level(=주제 수준)}, targetCount, variant, exclude })` → `llm.completeJson<TopicWordsResponse>({ ...req, signal, traceId })`. `exclude` = **주제 기본 표현(`TopicChunk.textJa`) 먼저 + 이 사용자가 이 주제로 만든 이전 `AiWord` 카드 `surfaceSnap` 최근 것부터**(프롬프트에는 300개·2,000자까지만 실리고 오래된 새 단어가 잘린다). **`variant` = 이 사용자가 이 주제로 새 단어를 이미 만든 날 수(0부터)** — 반드시 넘긴다(생략하면 `exclude` 개수÷목표로 어림 — 대략 맞지만 번호가 날짜와 어긋난다). `targetCount` 는 1~20 정수(밖이면 `TopicWordsInputError`).
    3. **조립**: 라우트(또는 라우트가 만든 클로저)가 `assembleTopicWords(res.data, { level, exclude: [상한 없는 전체 제외 표기], excludeMeanings: [주제 기본 표현 뜻] })` → `.words`(통과 항목, 응답 순서) 앞에서 목표 장수 만큼 쓰고 여분은 버린다. `classifyTopicWordsResult(kept.length, targetCount)` → `generation.source`(`AI`/`MIXED`/`TOPIC`)·`reason`(`null`/`'SHORT'`/`'INVALID'`)·`fillCount`(B1 로 채울 장수). TIMEOUT·FAILED(엔진 오류·`NoEngineAvailableError`)·LIMIT·SKIPPED·NEW_DONE 은 호출자가 정한다. `JsonSchemaError`(ajv 재시도 2번 다 위반) = `INVALID`.
    4. **카드**: `surfaceSnap=textJa`(스키마가 ≤40자라 80칸에 안 걸림) · `readingSnap=reading`(≤80) · `meaningSnap=meaningKo`(≤80, 칸 200) · `refType='AiWord'` · `refId=repetitionRefId(textJa)`(`learning/repetition` — 정규화 sha1, 수업 `Expr` 과 같은 함수). `chunkType` 은 보기 고르기에만 쓰고 저장하지 않는다. `jlpt` 는 저장 칸이 없다. 단어장 자동 추가 금지(채택 때만).
    5. **폴백 조건**: 통과 0 → `TOPIC`+`INVALID`; 1장 이상 < 목표 → `MIXED`+`SHORT`; 시간 초과·취소·엔진 오류는 호출자. 1시도 안에서 ajv 재시도는 엔진이 알아서(최대 2호출 — 5초 지표 ⓑ 의 "A12 호출 ≤2").
    6. **모니터링 권고**: `assembleTopicWords` 결과의 `droppedByReason`(사유별 개수)·`received`·`kept` 를 Trace/로그에 남기면(학습자 텍스트 아님) 깊은 체인 포화(통과율 급락)를 운영에서 볼 수 있다.
    7. **장기 챌린지 경고**: 같은 주제 15일차 이후(10장/일, 제외 160개 이상) 새 단어가 목표를 못 채우는 날이 **절반 안팎**으로 늘 수 있다(실측 cafe-order 1주제 1체인 — 다른 주제는 미측정). 그 날은 `MIXED/SHORT` 가 되고 B1 풀(기본 표현 12 + 수업 표현)로 채워지므로 같은 기본 표현이 자주 반복된다 — 14·30일 챌린지의 "매일 새 단어" 기대치는 사용자에게 약속하지 않는 편이 안전하다(화면 문구 §4-3c 는 이미 사실대로).
  - **기존 테스트 2건 갱신(Leader 요청)**: ① `engine/__tests__/additionalPropertiesStrip.test.ts` — `stripAdditionalProperties:true` 를 켜는 프로덕션 코드 목록을 `[lesson.ts]` → `[lesson.ts, topicWords.ts]` 로. **켜는 근거**: 설계서 §4-3a 지시 + 20항목×6필드 응답에서 스키마 밖 키 하나로 응답 전체가 재시도되면 사용자가 기다리는 [시작하기] 가 6~12s 늘어나는 비용을 막는 보험, 키가 깨끗하면 무동작·필수 필드 이름 오류는 여전히 위반. **솔직한 단서**: 126호출에서 지운 키가 **0건**이라 효과는 측정으로 입증되지 않았다(예방 보험) — 효과가 끝내 0 이면 이 목록에서 빼도 된다(테스트 주석에 기록). ② `conversation/__tests__/prompts.test.ts` — `build*Request` 전수 목록에 `buildTopicWordsRequest` 추가 + `repairRootClose` 비활성 표(`others`)에 `topicWords(A12)` 추가. **구문 슬립 복구(`repairRootClose`)를 켜지 않는 이유**: TALK·CHAT 전용(task-037 옵트인 경계)이고 A12 는 JSON 이 짧고 항목 단위로 버려 복구 경로가 필요 없다. 측정에서 구문 슬립 0건.
  - **테스트·정적 검사 숫자**: `topicWords.test.ts` **64/64**(케이스 30 + 이상 응답 18 + 시드 정답 대조·드리프트 방지·제외 목록 상한·초점 순환 등) · `conversation/**` 전체 **550/550**(직전 478 → 새 파일 64 + 다른 에이전트의 미커밋 테스트 포함) · 엔진 strip 테스트 7/7 · 합계 557/557 · `tsc --noEmit`(스코프: index.ts + 새 파일 + 라이브 스크립트, conversation 전체 import 포함) 0 · eslint(새·수정 6파일) 0.
  - **산출물**: `src/modules/conversation/prompts/topicWords.ts`(신규) · `src/modules/conversation/index.ts`(export 2줄) · `src/modules/conversation/__tests__/topicWords.test.ts`(신규)·`prompts.test.ts`(2곳)·`src/modules/engine/__tests__/additionalPropertiesStrip.test.ts`(2곳) · `tests/prompts/fixtures/topic-words.json`(신규) · `tests/live/task042-topicwords-measure.ts`(신규 — `DEEP=<주제>:<일수>`·`TOPICS`·`RESUME=1`·`DUMP=1`, 결과 JSON 은 scratchpad). 미러 `~/.node-local/thekaiwa-pe042`(삭제는 사용자 몫).
  - **확인 못 한 것·위험**: 원어민·사람 검수(판정자가 모델 1인)·N3 이상·사용자 주제(#57) 입력·다른 4주제의 깊은 체인·구독 한도(측정 중 한도 0건)·큐에 다른 호출이 있을 때의 지연·`req.signal` 취소 전파(developer/QA)·실제 운영 `modelByTier`(시드 값 haiku 로 측정, DB 연결 값은 읽지 않음)·Prompt Registry 등록(`prompts:sync` 스크립트가 이 저장소에 없음)·`docs/design-spec.md` §8 A12 행(Leader 단독). 초점 4·5(상대가 하는 말·부탁/질문)는 12자를 넘는 문장형 표현(≤13자)이 나온다 — 막으려면 초점 문구에 "12자 안쪽" 한 줄을 더하면 되나 재측정이 필요해 하지 않았다.

## Developer 기록

- [22:19] 미러 `~/.node-local/thekaiwa-042` 생성(계획서 §3 rsync 하드링크 + sync-local + `prisma generate` — WP-DB0 스키마의 `VocabSession.topicId`·`VocabAttempt.refType/refId` 타입 확인).
- [22:19] **pool base 완료** — `src/modules/learning/topics/pool.ts`(NFS, 미커밋). T1 이 쓸 공개 이름: 카드 출처 상수 `CARD_REF_TOPIC_CHUNK`·`CARD_REF_EXPR`·`CARD_REF_AI_WORD`(`'AiWord'`)·`isTopicCardRefType` · 키 `repetitionKeyOfCard(refType, refId)`(`AiWord`→`Expr`)·`cardRepetitionKey` · 풀 `buildTopicPool`(순수)·`loadTopicPool(db, userId, topicId)` → `{entries, topicChunkIds, chunkTotal(폭 필터 뒤 기본 표현 수 = poolSize), lessonExprCount, lessonsRead}` · `lessonExprCount(db, userId, topicId)` · 새 단어 `topicAiWords(db, userId, topicId)` → `[{refId, surface}]`(refId 별 1개, 최근 세트부터 — `aiWordTotal` = 길이, 반복 항목은 `('Expr', refId)` 로 조회). `db` 는 `prisma` 또는 `tx`(Pick 타입). import 는 `../topics/pool` 직접(barrel 아님). 주제 접근 검사는 호출자 몫. 미러 `tsc --noEmit` 0 오류.
- [22:31] **중간 기록 1(체크포인트)** — 서버 구현 1차 완료, 테스트 작성 전.
  - 완료: `vocab/topicSet.ts`(신규 — A12 실행 `runTopicWords`(벽시계 race·손님 취소·Trace 1행)·`recheckTopicWords`(⑥ 서버 재적용 + 칸 폭)·`composeTopicCards`(새 단어 → 재사용 → B1 채움, 답한 키·같은 키·같은 표기 제외, 시드 셔플)·`todayTopicState`·`topicCardRepetitionInputs`(`AiWord`→`('Expr', refId)`)·`topicCardCounts`·생성 중 표시/하루 시도 버킷(메모리)) · `vocab/sessions.ts`(#47 `topicId`·`generate` 파싱·`createTopicVocabSession`(§4-3e 순서), 세션 DTO `topic{id,title,lessonCardCount,aiCardCount}` — #47·#48(groupBy 1회)·#49·#51·#52·#53 공통, #51 주제 카드 반복 항목·StudyLog "주제 단어 「…」"·스냅샷 `data.topicId`·`wrongWords[].source`, #53 주제 세트 → 주제 세트(카드 refType/refId 복사·LLM 0·보기 주제 풀 기준)) · `engine/router/tasks.ts` `topicWords` 한 줄 · 라우트 #47(driver = PE `buildTopicWordsRequest`·`assembleTopicWords`, `signal: req.signal`, `startedAt`)·#51(`challenge` = T1 `challengeProgressAfter`, 커밋 뒤 — **T1 연결 완료**) · `types/vocab.ts`(additive).
  - **A12 연결 상태**: PE `conversation/index.ts` export 2줄이 이미 있어 라우트에 연결함(PE "Developer 인계" 기록은 아직 없음 — 인계 문구 나오면 대조).
  - 결정(설계서에 없는 것 — Reviewer 확인 요망): ① A12 요청은 "값" 대신 **함수 묶음(driver)** 로 넘김 — `exclude` 가 DB 지식(learning)이라 요청을 라우트가 미리 만들 수 없음(A11 `ReviewDecisionDriver` 선례, L3→L2 import 0 유지) ② 하루 시도 3번은 성공·실패 모두 셈, **손님 취소만 되돌림** ③ "오늘 새 단어 있음(재사용)" 판정에서 **다시 풀기(#53) 세트는 뺌**(어제 세트를 오늘 다시 풀면 오늘 생성이 막히는 것 방지) ④ 손님 취소 응답 = 409 `{reason:'CANCELLED'}`(손님은 이미 없음) ⑤ #51 `challenge` 는 DONE 주제 세트면 멱등 재호출도 계산(같은 스냅샷 → 같은 값).
  - 소유 밖 필요 1건: `snapshots/index.ts` `VocabSessionSnapshotData` 에 `topicId?: string` 칸이 없어 sessions.ts 에서 교차 타입 변수로 넘김(동작 동일). 정본 타입에 한 칸 더할지 Leader 판단.
  - 남은 일: 단위 테스트(키 동일성 ⓐⓑⓒ·폴백 전 경로·30초·취소·하루 상한·409·중복·폭·정답 미노출·barrel grep·count 동일성) · `tests/live/task042-*` 스모크 작성 · eslint/tsc 재확인 · 최종 기록.
  - 다음 첫 행동: `src/modules/learning/__tests__/task042.test.ts` 작성.
  - 미커밋 파일(내 것): `learning/topics/pool.ts`(신규)·`learning/vocab/topicSet.ts`(신규)·`learning/vocab/sessions.ts`·`engine/router/tasks.ts`·`app/api/v1/vocab/sessions/route.ts`·`…/[id]/finish/route.ts`·`types/vocab.ts`. 미러 tsc 0 · 변경 파일 eslint 0.
- [22:46][developer 신규 소환] **중간 기록 2(체크포인트)** — 이어받아 점검. [확인] #51 끝내기 트랜잭션 본문은 **완결돼 있었다**(주제 카드 반복 항목·StudyLog "주제 단어 「…」"·스냅샷 `data.topicId`·`wrongWords[].source`·챌린지 쓰기 없음). [확인] T1 `challengeProgressAfter`(`learning/challenges/progress.ts`)는 이미 로컬에 있고 내부 try/catch → null 이라 #51 라우트 연결이 그대로 유효(커밋 뒤 호출). [확인] `task042.test.ts` 25건도 dev-042 가 이미 써 둠 → 미러 sync·`prisma generate` 뒤 tsc 0·25/25.
  - **점검에서 고친 결함 1건**: 생성 중 표시(`generatingUsers`)가 A12 직후 `finally` 에서 풀려 **세트 트랜잭션 커밋 전 틈**에 들어온 두 번째 요청이 "오늘 새 단어 없음"을 보고 A12 를 한 번 더 부를 수 있었다(그 뒤 409 `sessionId` 로 버려짐 — LLM 1회 낭비·하루 시도 1 소모). → `createTopicVocabSession` 을 나눠(`composeTopicSessionTx` 신규) **표시를 트랜잭션이 끝날 때까지 쥐게** 했다. 동작 변화: 그 틈의 두 번째 요청은 409 `GENERATING`(이전엔 LLM 재호출 뒤 409 `sessionId`).
  - 테스트 보강 4건(29/29): 위 틈의 409 `GENERATING`·A12 0회 · 벽시계 기준 `startedAt`(이미 30초 지남 → A12 0회·TIMEOUT·Trace `WALL_CLOCK`) · 다음 날 `exclude` = 기본 표현 → 이전 새 단어(카드로 낸 것만)·모델이 다시 내면 서버 재검사가 버림(SHORT) · 스냅샷 불변(멱등 재호출·다시 풀기 0행, 주제 SetNull 뒤 `data.topicId` 그대로·DTO `topic` null).
  - 남은 일: `tests/live/task042-*` 스모크 작성 → eslint(변경 파일)·learning+conversation 단위 전체 → 최종 기록. 다음 첫 행동: `tests/live/` 기존 스모크 형식(`qa-session.ts`·`challenge-smoke.ts`) 확인.
  - 미커밋(이번 추가): `learning/vocab/sessions.ts`(위 수정)·`learning/__tests__/task042.test.ts`(보강).
- [22:59][developer 신규 소환] **최종 기록 — 구현 완료, Reviewer 인계.** status DONE · risk HIGH(R2 — 동기 LLM·세트 트랜잭션·키 합치기) · 네이티브 변경 없음 · DB 쓰기·라이브 실행 0(QA 몫).
  - **변경 파일(전부 미커밋, NFS)**:

| 파일 | 변경 |
|---|---|
| `src/modules/learning/topics/pool.ts`(신규) | B1 풀·카드 출처 상수·`repetitionKeyOfCard`·`lessonExprCount` · **`topicAiWordHistory`(신규 — 단어 + `generationDays`, 쿼리 1회)**, `topicAiWords` 는 그 래퍼(T1 `topicProgress` 가 쓰는 모양 그대로) |
| `src/modules/learning/vocab/topicSet.ts`(신규) | A12 실행(`runTopicWords` 벽시계·취소·Trace 1행)·서버 재검사·카드 구성·생성 중 표시/하루 시도 버킷 · **driver 입력에 `variant`**·`TopicWordsOutput.jlpt` 에 `'null'` |
| `src/modules/learning/vocab/sessions.ts` | #47 주제 세트(`createTopicVocabSession` + **`composeTopicSessionTx` 로 분리**)·세션 DTO `topic`·#48 groupBy·#49·#51(반복 항목·StudyLog·스냅샷 `data.topicId`·`wrongWords[].source`)·#52·#53 |
| `src/app/api/v1/vocab/sessions/route.ts` | #47 driver(PE `buildTopicWordsRequest`·`assembleTopicWords`)·`req.signal`·`startedAt` |
| `src/app/api/v1/vocab/sessions/[id]/finish/route.ts` | 커밋 뒤 `challengeProgressAfter`(T1) → `challenge` |
| `src/app/api/v1/vocab/sessions/[id]/replay/route.ts` | 주석만(주제 세트 다시 풀기) |
| `src/modules/engine/router/tasks.ts` | `topicWords: { tier:'fast', timeoutMs:20_000, lane:'interactive' }` 한 줄 |
| `src/types/vocab.ts` | additive(`VocabSessionTopic`·`TopicGeneration`·`CreateSessionBody`·`EmptyReason` 2값·`FinishResult.challenge`·`wrongWords.source`) |
| `src/modules/learning/__tests__/task042.test.ts`(신규) | 29건(가짜 db/tx·가짜 엔진, DB·LLM 0) |
| `tests/live/task042-smoke.ts`·`.sh`(신규) | 라이브 스모크(작성만 — 아래 QA 인계) |

  - **점검에서 고친 결함(3)**: ① 생성 중 표시 해제 시점 — 세트 트랜잭션 커밋 전 틈의 두 번째 요청이 A12 를 한 번 더 부름 → 표시를 트랜잭션 끝까지 유지(위 22:46). ② **PE 인계 2 `variant` 미전달** — driver 입력에 `variant` 가 없어 L2 가 `exclude 개수 ÷ 목표`(기본 표현 12개까지 센 어림값)로 초점을 골랐다 → `topicAiWordHistory.generationDays`(새 단어를 만든 날 수, 다시 풀기 세트 제외)를 `variant` 로 넘긴다(테스트: 1일째 0 → 다음 날 1, 전날 세트 다시 풀기는 안 셈). ③ dev-042 테스트 파일 eslint 오류 1(`no-this-alias`)·경고 1 → 가짜 tx 를 클래스 밖 함수로.
  - **실행 증빙(미러 `~/.node-local/thekaiwa-042`, sync·`prisma generate` 뒤, `env -u DATABASE_URL`)**: `tsc --noEmit` **0 오류**(tests/live 포함) · eslint(변경 11파일) **0 오류 0 경고** · `task042.test.ts` **29/29** · `src/modules/learning/**` **227/227** · `src/modules/conversation/**` **550/550**(PE 의 `prompts.test.ts`·`topicWords.test.ts` 포함 — 지시문이 걱정한 PE 새 파일 때문의 실패 없음) · `engine/__tests__/additionalPropertiesStrip`+`app/api/v1/_lib` **9/9** · 전체 `src/**/*.test.ts` **1,765 중 통과 1,764 · 실패 0 · 건너뜀 1**(미러에서 `speech/models` 없음 — 기존 SKIP) · 숨은 문자 `grep -nP` 0 · 엔진명 grep(learning 변경 파일·라우트·types) 0 · `learning/**` 에서 `@/modules/conversation` import 0 · `topics/`·`challenges/` 에서 barrel `'../lessons'` import 0. dev 서버 띄우지 않음(포트 3022 리슨 0 확인).
  - **dev-042 결정 ①~⑤ 근거(Reviewer 확인 항목 — 그대로 둠)**: ① **함수 묶음(driver)** — `exclude` 가 DB 지식(이 주제 이전 새 단어 표기, learning 소유 표)이라 라우트가 요청 값을 미리 만들 수 없다. 값 대신 순수 함수 2개(`build`·`assemble`)를 받으면 L3 → L2 import 0 이 유지된다(A11 `ReviewDecisionDriver` 선례, 정적 검사 테스트로 고정). ② **하루 시도 3번 = 성공·실패 모두 셈, 손님 취소만 되돌림** — 설계서 §4-3b ④ "사용자당 하루 3번"은 LLM 비용·직렬 슬롯 보호가 목적이라 실패도 슬롯을 썼다. 취소는 대기 화면을 떠난 것이라 그날 다시 들어올 기회를 남긴다(되돌리지 않으면 이탈 3번에 그날 생성이 막힌다). ③ **#53 세트는 "오늘 새 단어 있음" 판정에서 제외** — 어제 세트를 오늘 다시 풀면 `AiWord` 카드가 오늘 날짜로 복사되므로, 세면 오늘 생성이 영영 막힌다(테스트: 다음 날 생성 테스트가 전날 세트의 다시 풀기를 끼워 확인). ④ **손님 취소 응답 409 `{reason:'CANCELLED'}`** — 손님이 이미 없어 응답은 읽히지 않는다. 세트를 만들지 않았다는 것을 Trace(`errorCode CANCELLED`)와 함께 남기는 용도이고, 4xx 라 5xx 경보에 섞이지 않는다. ⑤ **#51 `challenge` 는 DONE 주제 세트면 멱등 재호출에도 계산** — `challengeProgressAfter` 가 같은 스냅샷(periodKey = 세트 id)을 읽어 같은 값을 내므로 재시도한 화면이 토스트 상태를 잃지 않는다(`goalMetNow` 는 완료 순서 기준이라 재호출에도 처음 값).
  - **T1 연결 상태**: [확인] `challengeProgressAfter`(dev-041, `learning/challenges/progress.ts`, 미커밋)가 로컬에 있고 내부 try/catch → null 이라 #51 라우트는 **연결 완료**(대기 항목 없음). **커밋 순서 주의**: #51 라우트는 `@/modules/learning`(T1 이 바꾼 `learning/index.ts` 의 `export * from './challenges'`)에서, `types/vocab.ts` 는 `./challenge`(T1 신규 `src/types/challenge.ts`)에서 import 한다 → **T2 를 T1 보다 먼저 커밋하면 컴파일이 깨진다**(같이 또는 T1 뒤). 반대로 T1 `challenges/topicProgress.ts`·`service.ts` 는 T2 `topics/pool.ts` 를 import 한다 → **둘은 한 커밋 묶음으로** 넣는 것이 안전하다.
  - **소유 밖 1건(Leader 판단)**: `learning/snapshots/index.ts` `VocabSessionSnapshotData` 에 `topicId?: string` 칸이 없다. 지금은 `sessions.ts` 가 교차 타입 변수(`VocabSessionSnapshotData & { topicId?: string }`)로 넘기고 `createVocabSessionSnapshot` 이 `data` 를 통째로 저장해 동작은 같다(테스트 A10 에 해당하는 단위 검증 있음). 정본 타입에 한 칸 더하면 T1 `readChallengeSnaps` 와 타입이 맞물린다 — 1줄.
  - **문서 초안(Leader 단독 반영용)**: `api-contract.md` — #47 본문 `topicId?`(category 와 동시 400)·`generate?`(기본 true, `topicId` 와만) · 응답 `generation{source:'AI'|'MIXED'|'TOPIC', generatedNow, reason:'SHORT'|'NEW_DONE'|'TIMEOUT'|'FAILED'|'INVALID'|'LIMIT'|'SKIPPED'|null}`(주제 세트만, 저장 안 함) · 409 `{sessionId}` 외에 `{reason:'GENERATING'}`·`{reason:'CANCELLED'}` · 빈 상태 `TOPIC_EMPTY`·`TOPIC_ALL_DONE_TODAY`(cta `['MY_WORDS']`) · 세션 DTO `topic{id,title,lessonCardCount,aiCardCount}|null`(#47·#48·#49·#51·#52·#53 공통) · #51 `wrongWords[].source:'WORD'|'TOPIC'`·`reading`·`challenge?`. `domain-model.md` §9-3 — `VocabAttempt.refType` 값 `TopicChunk`·`Expr`·`AiWord`(+ `repetitionKeyOfCard`: `AiWord`→`Expr`, 같은 `repetitionRefId(textJa)`) · VOCAB_SESSION `data.topicId?`(주제 세트만, 생성 시 1회·불변). `module-dependency.md` — L3 `topics/pool`·`vocab/topicSet`, "A12 는 라우트가 만든 함수 묶음으로 받는다".
  - **QA 인계(라이브 — QA 계정 3, LLM 슬롯 직렬)**: 실행 `bash tests/live/task042-smoke.sh 3022`(서버는 미러에서 `next dev -H 127.0.0.1 -p 3022` 따로 · `ONLY=A` = LLM 없는 구간만 · `OVERLAP=1` = 오늘 탭 직후 겹친 대기 · `TRACE_DAYS=7` = 최근 Trace p50/p95·사유별). **같은 날 두 번째 실행은 dev 서버를 다시 띄운 뒤**(하루 시도 3·생성 중 표시가 서버 메모리 — 안 그러면 B~D 가 `LIMIT`). 정리: 이 실행이 만든 세트·카드·StudyLog·스냅샷·관측·AiJob(A11 잡이 끝나길 최대 150초 기다린 뒤)·새 반복 항목·계정 2 표식 주제를 지우고 기존 DAILY·반복 항목 카운터를 시작 값으로 되돌림, topicWords Trace 는 남김(원문 없음). 시작 전 계정 3 에 풀던 세트가 있으면 멈춘다. 체크리스트: **키 동일성**(A11 TopicChunk→CHUNK·Expr→EXPRESSION, B6·B9 같은 `('Expr', refId)` 1행·카운터만 증가) · **폴백**(A3 SKIPPED · 시간 초과·엔진 오류·LIMIT 는 단위 테스트 — 라이브에서 일부러 내기 어렵다) · **지연**(B 첫 세트 대기 ms, `TRACE_DAYS` p50/p95 — 참고치) · **정답 미노출**(A4·B5) · **타인 404**(A2 계정 2 의 내 주제·A8 #49) · **AiJob +0**(A5·B2) · **취소 전파**(C1 — [추측] Next.js 라우트 `req.signal` 이 손님 끊김에 닿는지 이 저장소에서 확인된 적 없음; FAIL 이면 30초 상한만 남는다는 뜻이라 Leader 보고) · 409 `GENERATING`(D1) · 30초 넘는 Trace 0(B10) · `WordEntry` 불변(A12) · 엔진명 0(Z).
  - **확인 못 한 것·위험**: [추측] `req.signal` 전파(위 C1) · 라이브·DB 실제 쿼리 모양(가짜 db 로만 검증 — 특히 `vocabAttempt.findMany` 의 `orderBy: [{ session: { startedAt } }]` 관계 정렬·`groupBy` 는 tsc 로 타입만 확인) · 메모리 버킷은 blue/green 두 프로세스·재시작에 따로라 최악은 하루 몇 번 더 부르는 것 · `count` 21~30 세트는 A12 상한 20 이라 항상 `MIXED/SHORT` · 같은 주제 15일차 이후 새 단어 부족(PE 경고 7 — `variant` 전달로 일부 완화, 그 날은 B1 반복) · A12 Trace 가 `kind:'TURN'` 이라 대시보드 `turnStats24h` 회화 턴 p50/p95 에 섞인다(lessonGen·evalGrade·reviewDecision 과 같은 기존 선례 — 분리는 이 task 밖) · 주제 설명의 주입 문구 방어는 PE 프롬프트 문장(A12) 몫.
  - **self_check**: `{ "taskId": "task-042", "status": "DONE", "risk_level": "HIGH", "self_check": { "unit_test": true, "lint": true, "type_check": true, "engine_name_leak": false, "native_change": false } }`
  - 미커밋 파일(최종, 내 소유): 위 표 10개. 미러 `~/.node-local/thekaiwa-042` 는 남겨 둠(QA 스모크용, 삭제는 사용자 몫).

### dev-042c (REV-121)

- [23:30][developer 신규 소환] REV-121 Low 보완만 함(로직 확장 0). DB·라이브·dev 서버·커밋·푸시 0. 네이티브 변경 없음.
  - **변경 파일(NFS, 미커밋)**:
    - `src/modules/learning/vocab/sessions.ts`: **L-2** A12 직후 끊김 분기(`if (opts.signal?.aborted)`)에서 `generating` 이면 `refundTopicWordsAttempt(userId, today)` 를 부른 뒤 409 `CANCELLED`. 생성 중 표시는 기존 `finally` 가 푼다. 시도를 쓰지 않은 경로(재사용·`LIMIT`·`SKIPPED`)는 되돌릴 것이 없어 그대로. **L-3** 스냅샷 변수 타입을 `VocabSessionSnapshotData` 로(Leader 가 `topicId?` 를 더해 교차 타입 불필요, 동작 동일).
    - `src/modules/learning/vocab/topicSet.ts`: **L-1** `runTopicWords` 바깥 `catch`(assemble 던짐 등 코드 오류)의 사유를 `INVALID` 에서 `FAILED` 로. 설계서 §4-3c 표의 `FAILED`(엔진 오류)·`INVALID`(ajv 뒤 위반·통과 0장) 정의에 맞춘 것이고, 화면(`topicReasonNotice`)은 둘이 같은 문구라 사용자에게 보이는 차이는 없다. `errorCode` 는 그대로 예외 이름.
    - `src/modules/learning/__tests__/task042.test.ts`: **L-2 테스트 1건 추가**(Trace 기록 순간 = A12 성공 뒤·세트 트랜잭션 전에 끊김 → 409 `CANCELLED`·A12 1회·세트 0·하루 시도 0·`isTopicWordsGenerating` false·같은 날 재진입 시 바로 생성(`AI`·시도 1)). **L-1** 기존 사유 테스트에 "assemble 예외 → FAILED" 단언 1개. **L-5** 경계 테스트를 넓힘: 대상 = `topics/` 비테스트 `.ts` 전부(지금 `index.ts`·`pool.ts`) + `vocab/topicSet.ts`·`sessions.ts`·`distractors.ts`. 값 import·re-export(여러 줄 포함, `import type`·`export type` 제외)를 경로로 풀어 `challenges/**`·`lessons/today`·barrel(`lessons`·`lessons/index`·learning `index`·`..`·`@/modules/learning`)이면 실패. 검사기 자체 확인 단언(여러 줄 import·`export *`·별칭·타입 전용 제외·`export function` 오탐 없음) 포함. `@/modules/conversation` 0 검사도 같은 파일 집합으로 넓힘.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-042`, `KAIWA_LOCAL_ROOT` sync + `prisma generate` 뒤, 테스트는 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"` 로 덮어써서):
    - `task042.test.ts` **30/30**(이전 29 + L-2 1건. L-1 은 단언 추가, L-5 는 기존 케이스 교체라 수 불변)
    - `src/modules/learning/**` **233/233**, 실패 0. 기대 228(227 + 1)보다 5 많다. 내 몫은 +1이고 [추측] 나머지 +5는 REV-121(23:20) 뒤 23:26~23:27 에 바뀐 T1 테스트(`challengeRecommend`·`challengeService`, 두 파일 합 24건 전부 통과)에서 온 것이다. 파일별 이전 수를 몰라 정확히 귀속하지는 못했다.
    - `tsc --noEmit` **0 오류**(REV-121 때의 `components/challenge/__tests__/logic.test.ts` 4건도 지금 sync 기준 0)
    - eslint(`sessions.ts`·`topicSet.ts`·`pool.ts`·`task042.test.ts`) **0 오류 0 경고**
    - 숨은 문자 `grep -nP` 0
    - **변이 확인**: 미러 사본에서 L-2 의 환불 줄을 지우면 새 테스트가 실패(1 fail)하고, 원복 뒤 NFS 와 `diff` 가 같은 것을 확인했다.
  - **하지 않은 항목(이력서 목록)**:
    - **L-4**: 라우트(`app/api/v1/vocab/sessions/route.ts`)와 `learning/index.ts`(Leader C5)는 소유 밖이다. Leader 가 index 에 `export type { TopicWordsDriver, TopicGenerationDto, VocabSessionTopicDto }` 를 더하면 라우트의 `Parameters<…>[2]` 유도를 지울 수 있다(선택).
    - **L-8**: 주제가 지워진 세트를 다시 풀 때 `refType/refId` 를 보존하는 문제. 지금은 주제 삭제 경로가 없어 생기지 않는다. 그 세트의 반복 항목 등록·모드 같은 의미를 정해야 하므로 010d 가 주제 삭제(#57)를 넣을 때 비주제 분기(`sessions.ts` `replayVocabSession` 아래쪽)에서 `refType: a.refType && a.refId ? a.refType : null` 같은 식으로 보존할지 함께 정한다.
    - **L-9**: 손님 취소 Trace 를 `ERROR` 에서 `PARTIAL` 로 바꾸는 안. A12 의 `PARTIAL` 은 지금 "통과 < 목표"라는 뜻이라 섞이고, 대시보드 오류율의 정의도 바뀐다. 관측 의미를 바꾸는 일이라 Leader 판단으로 넘긴다. 스모크 C1 은 `errorCode` 로 판정하므로 어느 쪽이든 영향이 없다.
    - **L-6**(풀 읽기를 사용자 행 잠금 트랜잭션 밖으로)·**L-7**(`AiWord` 답이 기존 `Expr` 행의 `meaningKo` 를 덮어씀): 지시대로 이번에는 하지 않았다. 후속 후보로 남긴다.
    - L-5 원문의 `challenges/**` 확장은 T1 소유라 이번 범위에서 뺐다. [확인] 지금 `challenges/*.ts` 에는 `../lessons` barrel·`lessons/today` 값 import 가 없다(`store.ts` 의 `../topics` 는 `topics/index.ts` 이고, 이 파일은 infra·preferences 만 import 한다). T1 테스트에 같은 검사를 두는 것은 Leader 판단이다.
  - **QA 인계 변경**:
    - ① A12 가 성공했는데 세트 직전에 끊기면 그날 시도가 되돌려진다. 그래서 이 틈에서 끊긴 뒤 같은 날 다시 들어오면 새로 생성되고 `LIMIT` 이 아니다. 실발생 틈은 마이크로태스크 1~2개라 라이브에서 일부러 내기 어렵고, 단위 테스트로 고정했다.
    - ② assemble 예외 사유는 `FAILED` 다. 라이브에서 내기 어렵고 화면 문구는 같다.
    - 체크리스트 나머지는 REV-121 §10 그대로다.
  - self_check: `{ "taskId": "task-042", "status": "DONE", "risk_level": "LOW", "self_check": { "unit_test": true, "lint": true, "type_check": true, "engine_name_leak": false, "native_change": false } }`
  - 미커밋(이번 손댄 것): `learning/vocab/sessions.ts`·`learning/vocab/topicSet.ts`·`learning/__tests__/task042.test.ts`.

## Reviewer 기록 (REV-121)

- [23:20][reviewer 신규 소환] **REV-121 판정 PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 9 · Info 6. 코드·스키마·문서 수정 0, DB 쓰기·dev 서버·라이브·커밋·푸시 0(미러 `~/.node-local/thekaiwa-042` 를 NFS 기준으로 다시 sync 해 정적·단위 검증만, 3022 리슨 0 확인, 임시 probe 파일 2개는 실행 뒤 삭제). 네이티브 변경 없음. 사용 근거 표지: `[확인]` = 이번 세션에서 파일을 읽거나 실행해 본 것, `[추측]` = 실행으로 못 확인.

### 1. 재실행 숫자 (미러 sync 후, `env -u DATABASE_URL`)

| 항목 | 결과 | 비고 |
|---|---|---|
| `task042.test.ts` | **29/29** | dev 기록과 같음 |
| `src/modules/learning/**` | **227/227** | 같음 |
| `src/modules/conversation/**` | **550/550** | 같음(PE `topicWords.test.ts` 64건 포함) |
| 전체 `src/**/*.test.ts` | **1,781 중 통과 1,780 · 실패 0 · 건너뜀 1** | dev 기록(1,764/1,765)보다 16건 많다 — sync 로 다른 WP(041·043 등)의 새 테스트가 들어왔고 전부 통과. 실패 0 |
| `tsc --noEmit` | **오류 4건, 전부 `src/components/challenge/__tests__/logic.test.ts`**(T4 task-043 의 미완성 파일 — `DayChallenge.words.need` 누락) | **T2 소유 파일 오류 0** [확인]. 소유 밖이라 고치지 않음 → Leader/dev-043 |
| eslint(T2 변경 + PE 파일 14개) | **0 오류 0 경고** | L3→L2 경계는 `eslint.config.mjs:105` `boundary('src/modules/learning/**', ['admin','conversation','speech'], …)` 로 **린트가 막는다** [확인] |
| 보이지 않는 문자 스캔 | **0건**(ZW·BOM·bidi·NBSP·제어문자, 15파일) | |
| 엔진명 grep(`pool.ts`·`topicSet.ts`·`sessions.ts`·라우트·`types/vocab.ts`) | **0건** | `claude|haiku|reazon|whisper|style-bert|model_id|speaker_id` |
| `learning/**` 에서 `@/modules/conversation` import | **0건** | |

가짜 DB 한계(재서술): 가짜 tx 는 이 파일이 쓰는 쿼리 모양만 해석한다. **실제 Prisma/MariaDB 로 실행되지 않은 것** — ① `vocabAttempt.findMany` 의 관계 정렬 `orderBy: [{ session: { startedAt } }, …]`(`readTodayTopicCards`·`topicAiWordHistory`) ② `where: { session: { …, replayOfId: null } }` 관계 필터(`todayAiWordExists`) ③ `groupBy({ by: ['sessionId','refType'], where: { refType: { in } } })`(`topicCountsOf`) ④ `lesson.findMany` 의 `content`(JSON) 60개 읽기 ⑤ FK(SetNull)·VarChar 폭. 타입(tsc)은 맞고 Prisma 6 이 지원하는 모양이지만 **QA 스모크(A·B 구간)가 첫 실행 증거**다.

### 2. 지적 표

| # | 심각도 | 위치 | 내용 · 근거 · 고칠 방법 |
|---|---|---|---|
| L-1 | LOW | `topicSet.ts:509-512`(`runTopicWords` 바깥 `catch`) | 예기치 못한 예외(드라이버 `assemble` 던짐·동기 `complete` 예외 등)를 모두 `reason:'INVALID'` 로 돌린다. 엔진 응답 위반이 아니라 코드·계약 오류이므로 `FAILED` 가 맞다(사유별 비율을 보는 (라) 참고치가 오염). `result = { ok:false, reason:'FAILED' }` 로. |
| L-2 | LOW | `sessions.ts:495`(`if (opts.signal?.aborted) throw cancelledError()`) | A12 가 **성공한 직후** 손님이 끊긴 좁은 틈이면 새 단어를 버리고(저장 칸 없음) 시도 횟수도 되돌리지 않는다(A12 중 취소는 `refundTopicWordsAttempt`, 이 틈은 안 함). 하루 3회에서 1회를 잃는다. 이 분기에서도 `refundTopicWordsAttempt(userId, today)` 를 부르면 "손님 취소만 되돌림"(결정 ②)과 일관된다. 틈이 매우 좁아 실발생은 드묾 [추측]. |
| L-3 | LOW | `sessions.ts:780` | Leader 가 `VocabSessionSnapshotData.topicId?` 를 이미 더했는데(`snapshots/index.ts`) 교차 타입 `VocabSessionSnapshotData & { topicId?: string }` 가 남아 있다. 동작 동일, 정리 한 줄: `const snapshot: VocabSessionSnapshotData = {…}`. |
| L-4 | LOW | `app/api/v1/vocab/sessions/route.ts:13` | `TopicWordsDriver` 타입을 `Parameters<typeof createVocabSession>[2]` 로 유도한다 — `sessions.ts` 가 `export type { TopicWordsDriver }` 를 하지만 `learning/index.ts` 가 다시 내보내지 않아서다(`learning/index.ts` 는 C5 = Leader 소유라 T2 가 못 건드림). Leader 가 index 에 `export type { TopicWordsDriver, TopicGenerationDto, VocabSessionTopicDto }` 를 더하면 유도 코드를 지울 수 있다(선택). |
| L-5 | LOW | `topics/pool.ts:5-11`·테스트 마지막 케이스 | 순환 방지(`pool` 은 barrel `../lessons` 금지)를 **grep 테스트가 `pool.ts` 한 파일만** 본다. 순환은 `lessons/today → challenges → topics/pool → lessons/index → today` 이므로 `topics/**`·`challenges/**`(T1) 에 `from '../lessons'` 가 생겨도 같은 순환이다. 테스트 대상을 `learning/topics/**`·`learning/challenges/**` 의 비테스트 파일로 넓히면 안전하다(또는 `no-restricted-imports` 한 줄). |
| L-6 | LOW | `sessions.ts:522-525`(`composeTopicSessionTx`) | 풀 읽기(`loadTopicPool` — 수업 최대 60개의 `content` JSON, 합 수 MB 가능)와 `loadRepetitionStats`·`wordEntry.findMany` 가 **사용자 행 잠금(`lockUserRow`)을 쥔 트랜잭션 안**에서 돈다. 개인 앱·단일 사용자라 실영향 작지만 잠금 순서 문서(`sessions.ts:7-14`)의 "트랜잭션 안에서는 짧게"와 어긋난다. `loadTopicPool` 은 잠금 전(A12 직전·`topicAiWordHistory` 옆)에 읽고 값으로 넘기면 된다(풀은 이 사용자 행이 바뀌어도 의미가 같다). QA 가 `#47` 응답 ms 를 재서 크면 올릴 항목. |
| L-7 | LOW | `registerRepetitionItems`(`repetition/index.ts:140-157`)·`topicSet.ts:352-364` | 같은 키 `('Expr', refId)` 의 기존 행(수업 완료가 만든 것)에 `AiWord` 카드 답이 합쳐질 때 `textJa`·`meaningKo` 가 **A12 의 뜻으로 덮어써진다**(update 가 두 칸을 항상 쓴다). 수업 완료도 같은 식으로 덮어쓰므로 새 종류의 위험은 아니지만(양쪽 다 AI 산출), A12 는 haiku·내용 결함 1~2%(PE 기록)라 복습 레슨(A5)에 들어가는 뜻이 더 나빠질 수 있다. 후속 후보: `AiWord` 출처는 **기존 행이 있으면 뜻을 덮어쓰지 않기**(입력에 `keepMeaning` 같은 표시). 이 task 범위 밖. |
| L-8 | LOW | `sessions.ts:844-857`(비주제 다시 풀기 분기) | 주제가 지워진 세트(`topicId` SetNull)를 다시 풀면 `src.topicId` 가 null 이라 비주제 분기로 가서 **카드의 `refType/refId` 를 버리고 `wordId=null`·FLIP 강등**이 된다 → 그 판에서 반복 항목이 등록되지 않는다. 지금은 주제 삭제 경로가 없어(#57 은 010d) 발생하지 않는다. 010d 가 주제 삭제를 넣을 때 이 분기가 `refType/refId` 를 보존하게 해 둘 것. |
| L-9 | LOW | `topicSet.ts:518-522`(Trace) | 손님 취소(`CANCELLED`)도 `status:'ERROR'` 로 남아 대시보드 `turnStats24h` 의 `errors` 에 들어간다(사용자 행동인데 오류율을 올림). `TraceStatus` 가 OK·ERROR·PARTIAL 뿐이라 스키마 변경 없이는 새 값이 없다 → `CANCELLED` 만 `PARTIAL` 로 남기는 안이 있다(스모크 C1 은 `errorCode` 로 판정하므로 영향 없음). 또 A12 Trace 가 `kind:'TURN'` 이라 같은 대시보드 p50/p95 에 섞이는 것은 `lessonGen`·`evalGrade`·`reviewDecision` 이 이미 같은 방식이다(`engine/trace/index.ts:150-157` 은 `refType` 를 거르지 않는다) — **선례와 같음, 이 task 새 결함 아님**. |
| I-1 | INFO | `tasks.ts:36-37` ↔ PE | 엔진 task 항목 실제 값 `topicWords: { tier:'fast', timeoutMs:20_000, lane:'interactive' }` — PE 권고(haiku 유지·최대 10.9s·20s 안)와 일치 [확인]. 모델명은 코드에 없다. PE 의 `task: TOPIC_WORDS_TASK as unknown as LlmTask` 캐스트는 이제 키가 있으니 `as LlmTask` 로 줄일 수 있다(PE 소유, 무해). |
| I-2 | INFO | LLM 직렬 큐 | 취소 사슬을 코드로 확인했다(아래 §4). 마지막 안전망 = 벽시계 30초 + 자식 SIGTERM→5초 뒤 SIGKILL 동안 슬롯이 최대 ~5초 더 묶인다(`claudeCli.ts:411-419`). |
| I-3 | INFO | `finish` 뒤 A11 | 주제 세트도 반복 항목이 등록되므로(`repetitionItems > 0`) 끝낼 때마다 A11 복습 판단 batch 잡이 걸린다(기존 단어 세트와 같은 규칙). 챌린지 하루 2~3세트면 잡 수가 늘어 직렬 큐 점유가 늘 수 있다 — 5초 지표 참고치 (라)에서 `AiJob` 증가·A11 겹침을 함께 볼 것. |
| I-4 | INFO | A12 시도 상한 | 시도는 성공·실패 모두 센다(결정 ②). 큐가 막혀(A4 레슨 26~69s·A11 13~17s 뒤) 30초 벽시계에 **프로세스가 시작도 못 하고** TIMEOUT 나는 경우도 1회로 센다 → 연속 3번이면 그날 `LIMIT`(B1 만). 설계가 수용한 위험(§5-2)이지만 운영에서 `LIMIT` 비율이 높으면 "프로세스 시작 전 TIMEOUT 은 0.5회" 같은 조정 후보. 코드는 시작 여부를 알 수 없다(엔진이 알려 주지 않음). |
| I-5 | INFO | 계약 문서 | `wrongWords[].reading`(단어 카드에도 새로 채워짐)·`topic`·`generation`·`challenge` 는 전부 additive. `api-contract.md` 반영은 Leader 몫(dev 문서 초안 있음). |
| I-6 | INFO | 설계서 문구 | 설계서 §4-3a·§10-1 은 "요청을 **값으로** 넘긴다"고 적었는데 구현은 **함수 묶음**(결정 ①)이다. 채택하되 §4-3a·`module-dependency.md` 문구를 "라우트가 만든 build·assemble 함수 묶음으로 받는다"로 맞춰야 한다(Leader 단독, Reviewer PASS 뒤). |

### 3. dev-042 결정 ①~⑤ 판정

| # | 판정 | 근거 |
|---|---|---|
| ① 요청을 함수 묶음(driver)으로 | **채택** | `exclude` 에 learning 소유 표(`VocabAttempt` `AiWord` 표기)의 값이 들어가므로 라우트가 요청 값을 미리 만들 수 없다. A11 `ReviewDecisionDriver` 선례, `eslint.config.mjs:105` 가 L3→L2 를 막고 `learning/**` 의 `@/modules/conversation` import 0 [확인]. 라우트(app)가 conversation·learning 둘을 조합 = 6층 규칙 안. 문구 정정 = I-6, 타입 export = L-4. |
| ② 하루 3시도 = 성공·실패 모두, 손님 취소만 되돌림 | **채택(L-2 보완 권고)** | 설계서 §4-3b ③ "사용자당 하루 3번"은 LLM 비용·직렬 슬롯 보호가 목적이라 실패도 슬롯을 썼다. 취소를 되돌리지 않으면 이탈 3번에 그날 생성이 막힌다. A12 성공 직후 끊긴 틈은 되돌려야 일관(L-2). 큐 막힘 TIMEOUT 소모는 I-4. |
| ③ 재사용 판정에서 다시 풀기(#53) 세트 제외 | **채택** | `todayAiWordExists`(`replayOfId:null`)와 `todayTopicState.todayAi`(`!replayOfId`)가 **같은 기준**이라 어긋나지 않는다 [확인]. 안 그러면 어제 세트를 오늘 다시 풀 때 `AiWord` 카드가 오늘 날짜로 복사돼 오늘 생성이 영영 막힌다(테스트 "다음 날 생성"이 전날 다시 풀기를 끼워 고정). `generationDays`(= variant)도 다시 풀기 제외 — 한 방향. |
| ④ 손님 취소 = 409 `{reason:'CANCELLED'}` | **채택** | 응답은 읽히지 않는다(손님 없음). 4xx 라 5xx 경보에 안 섞이고 같은 409 가족(`{sessionId}`·`GENERATING`)이라 T4 가 `details.reason` 하나로 분기한다. 세트 0은 테스트·스모크 C1 이 고정. |
| ⑤ #51 `challenge` 는 DONE 주제 세트면 멱등 재호출도 계산 | **채택** | `challengeProgressAfter` 는 내부 try/catch → null(`progress.ts:58-61`) [확인], 같은 스냅샷을 읽어 같은 값, 챌린지 쓰기 0(트랜잭션 밖·커밋 뒤). 재시도한 화면이 토스트 상태를 잃지 않는다. `goalMetNow` 가 재호출에도 처음 값인 것은 설계(완료 순서 기준)와 일치. |

### 4. 동기 LLM 생성 안전성 — 코드 근거

- **벽시계 30초(큐 대기 포함, `startedAt` 기준)** [확인]: 라우트 `const startedAt = Date.now()` 가 `requireSession`·본문 파싱보다 앞(`route.ts:34`), `deadlineAt = startedAt + 30_000`(`sessions.ts:486`), `runTopicWords` 가 `left = deadlineAt − now` 로 `setTimeout` 을 건다. 이미 지났으면 호출 0·`TIMEOUT`(단위 테스트가 `WALL_CLOCK` 까지 고정).
- **A12 는 트랜잭션 밖** [확인]: `topicAiWordHistory(deps.db …)`·`runTopicWords` 가 `composeTopicSessionTx` 앞. 트랜잭션 안에 LLM 호출 0.
- **손님 취소 전파 사슬**: `req.signal`(라우트) → `runTopicWords` 가 `ctl`(AbortController) 로 감싸 엔진에 `signal` 전달 → `completeJson` → `callOnce` → `adapterCallOptions` 가 `signal` 을 `callClaudeDetailed` 로 → **큐에서 기다리던 호출은 `task` 시작 때 `signal.aborted` 를 보고 프로세스를 띄우지 않는다**(`claudeCli.ts:756-759`) — **직접 실행으로도 확인**: 미리 abort 된 신호로 `callClaudeDetailed` 를 부르면 `[claudeCli] 취소 — 시작 전` 로그와 함께 1ms 에 `AbortError` 로 거절(spawn 시도 전). 실행 중이면 `collect` 가 SIGTERM, 5초 뒤 SIGKILL(`:411-419`). `AbortError` 는 라우터 폴백·JSON 재시도 대상이 아니다(`router/index.ts:121-123`, `claudeCli.ts:108`). `runTopicWords` 는 엔진 결과를 기다리지 않고 `Promise.race([call, stopped])` 로 돌아온다(`stopped` 리스너가 엔진 리스너보다 먼저 등록돼 취소가 먼저 이긴다). 뒤늦게 끝나는 `call` 의 거절은 `.then(…, …)` 로 삼켜 unhandled rejection 없음.
- **`req.signal` 이 연결 끊김에 실제로 닿는가**: 이 저장소에 선례가 없었으나 **설치된 Next 소스(미러 `node_modules/next/dist/server/web/spec-extension/adapters/next-request.js:46-62`)가 `response.once('close')` 에서 `writableFinished` 가 아니면 `controller.abort()`** 를 한다 [확인]. 운영 nginx 에 `proxy_ignore_client_abort` 없음(기본 off → 클라이언트가 끊으면 업스트림도 닫는다)·`proxy_read_timeout 600s` [확인, `/etc/nginx/sites-enabled/kaiwa….conf`]. **실제 끊김 → 서버 중단은 라이브 미확인** — QA C1 이 판정한다.
- **엔진 호출 수 ≤ 2** [확인]: LLM 폴리시 `fallbacks: []`(`prisma/seed-data/engines.json`)이고 보조 연결 `home-m4-lan` 의 `allowedTasks` 는 `wordEnrich·distractorGen·chatReviewFallback` 뿐이라 `topicWords` 는 **claude-cli 한 연결만**(`withFallback` 후보 1) → 호출 = ajv 재시도 포함 최대 2. 단 이는 **시드 값**이고 실제 DB 연결 행은 읽지 않았다(DB 금지) [추측: 콘솔에서 `allowedTasks` 를 바꾸지 않았다면 같음].
- **생성 중 표식 수명** [확인]: `beginTopicWordsGeneration`(`sessions.ts:473`) → `try { … composeTopicSessionTx } finally { if (generating) endTopicWordsGeneration }`. `begin` 과 `try` 사이엔 동기 대입뿐이라 누수 틈이 없고, `topicAiWordHistory`·`runTopicWords`·트랜잭션 어디서 던져도 `finally` 가 푼다. DB 가 멈춰도 Prisma 트랜잭션 `timeout 15s`·풀 타임아웃으로 정산된다.
- **상한 의미** [확인 — 직접 probe]: 같은 사용자 `begin` 5번 → `OK,OK,OK,LIMIT,LIMIT`, 환불 1회 → 사용 2·다음 `begin` OK. 요청당 A12 ≤ 1(테스트 "첫 세트").

### 5. 다중 프로세스·재시작에서 상한 한계 판정 — **허용**

- `ecosystem.config.js:83` `thekaiwa` `instances: 1`(운영 pm2 `cluster_mode`, `pm2 jlist` 로도 1) [확인]. 하루 3시도 버킷·`GENERATING` 표식은 **프로세스 메모리**라 **재시작·blue/green 전환(`startOrReload` — 잠깐 두 프로세스)·크래시마다 비워진다.**
- 깨지는 것: ① 3회 상한이 배포·재시작마다 0 부터(최악 = 배포 1회당 사용자당 A12 몇 번 더) ② 겹친 두 프로세스에서 `GENERATING` 409 가 안 걸려 A12 가 두 번 돌 수 있다.
- **안 깨지는 것(DB 쪽 보호)**: ③ "하루 성공 1회 재사용"은 `todayAiWordExists`(DB) 라 재시작과 무관 ④ 같은 사용자 세트 중복은 트랜잭션 안 `lockUserRow`→`assertNoInProgress`(409 `{sessionId}`)가 막아 **세트가 두 개 생기지 않는다**(낭비는 A12 한 번과 그 단어 버림뿐) ⑤ 큐 동시성 1 도 프로세스별이라 겹침 구간엔 CLI 2개가 잠깐 돈다(수 초).
- 판정: 개인용 앱·1명·`instances:1` 에서 **허용 한계**. 조건: `thekaiwa` `instances` 를 2 이상으로 올리면 상한·표식·큐 동시성이 모두 프로세스 수만큼 느슨해지므로 그때는 DB 쪽 표식(또는 잠금)이 필요하다 — 배포 문서에 한 줄 경고 권고.

### 6. 폴백·부족 채움 판정 [확인 — 코드·probe·테스트]

- `generation{source, generatedNow, reason}` 일관성: 새 단어 0 → `TOPIC`, 전부 → `AI`, 섞임 → `MIXED`(`generationSourceOf`). reason: 생성 성공 `null`/`SHORT`/`INVALID`, 재사용 `null`/`NEW_DONE`, 그 밖 `TIMEOUT`·`FAILED`·`INVALID`(엔진·ajv)·`LIMIT`·`SKIPPED` — 모든 경로에서 테스트로 고정(전 사유 단위). 폴백 세트도 목표 장수(풀이 허용하는 만큼)를 채워 **LLM 한도로 하루 목표가 막히지 않는다**(테스트 "엔진 실패 → 10장").
- **21~30장** [직접 probe]: 새 단어 20장 + B1 풀 채움 — count 21→21장(AI 20·`MIXED/SHORT`)·25→25장·30→30장, 카드 키 중복 0. A12 는 항상 `min(20, …)` 만 요청(`runTopicWords` 가 20 으로 자르고 L2 가 `topicWordsRequestCount`).
- **풀보다 큰 목표**(폴백, 새 단어 0): count 15·풀 12 → **12장**(모자란 만큼만, 세트가 비지 않음). `empty` 는 카드 0장일 때만(`TOPIC_EMPTY` = 풀·새 단어·오늘 새 단어 전무, 아니면 `TOPIC_ALL_DONE_TODAY`).

### 7. 저장·키·정답 미노출·소유자 [확인]

- 새 단어는 **카드 스냅샷에만**: `wordId=null`·`refType='AiWord'`·`refId=repetitionRefId(textJa)`(수업 `Expr` 과 같은 함수 import `../repetition`)·`recheckTopicWords` 가 표기 ≤80·읽기 ≤120·뜻 ≤200 초과를 **자르지 않고 버림**. `learning/vocab/**`·`topics/**` 에 `wordEntry.create|upsert` **0건**(자동 추가 0)·`challenge` 쓰기 0.
- 키 합치기: pool 이 `lessonRepetitionItems(content, { topicChunkIds: 그 주제 조각 id 전부, outcomes: [] })` 를 그대로 호출 — `lifecycle.ts:128-129` 와 **같은 입력**(둘 다 `topicChunk.findMany({ where: { topicId } })` 의 id 집합)이고, `AiWord → Expr` 는 한 함수(`repetitionKeyOfCard`)가 반복 항목 등록·오늘 제외·중복 비교에 모두 쓰인다. 입력 누락 검출 테스트(ⓐⓑⓒ) + 통합("행 수 불변·카운터만 증가")이 있다. `itemType` 도 수업(`EXPRESSION`/`CHUNK`)과 같다. (L-7 덮어쓰기 주의.)
- #47 응답에 `meaningSnap`·`refId`·`refType`·정답 위치 **0**(`insertSession` 이 `toCardDto(…answer:null)` 로만 만들고 `ATTEMPT_SELECT.refType` 는 건수 세기에만 쓴다 — 카드 DTO 에 안 실림). 타인·없는 주제 404 는 `getTopicRef` 와 **같은 규칙**(`OR:[{userId:null},{userId}]`, id ≤40자). `topicId`+`category` 동시·`generate` 단독·형식 오류 400, 알 수 없는 키 400.
- #53: 주제 세트는 주제 세트로(`topicId` 유지·카드 `refType/refId` 복사·LLM 0), 보기는 주제 풀 뜻 ∪ 단어장 뜻 ∪ 같은 세트 뜻(종류 구분 없이)이라 **선행 결함(`wordId=null` 이면 FLIP 강등)이 주제 세트에서는 풀렸다**(테스트 "CHOICE 유지"). 비주제 분기는 의도적으로 무변경(L-8 은 주제 삭제 때만).
- 세션 DTO `topic{id,title,lessonCardCount,aiCardCount}`: #47(`insertSession`)·#48(`topicCountsOf` groupBy 1회, 주제 세트 없으면 쿼리 0)·#49(읽는 카드에서 셈)·#51(트랜잭션이 읽은 카드/멱등은 groupBy)·#52(1회)·#53(`insertSession`)이 **모두 `toSessionDto`+`topicCardCounts` 공유**. 새 곳에 N+1 없음.
- #51 트랜잭션 순서는 기존과 **같다**(diff 로 확인: 사용자 행 → 세트 행 → 카드 → 단어 카운터 → 반복 항목 → StudyLog(DIRECT) → VOCAB_SESSION 스냅샷 → DAILY → 관측, 새 잠금·새 표 쓰기 0). 스냅샷 `data.topicId` 는 주제 세트만·생성 때 1회(멱등 재호출·다시 풀기·SetNull 뒤 모두 불변 — 테스트).

### 8. 순환·경계·범위 이탈

- **T1(`challenges`) ↔ T2(`topics/pool`)**: **런타임 순환 아님**. 값 import 도달 집합을 스크립트로 계산(`pool.ts` → `lessons/content`·`lessons/matching`·`repetition` 뿐, `challenges/**`·`vocab/**`·`lessons/today`·`index` 로 돌아오는 경로 0). 경로: `vocab/sessions → studyLog(calendar) → challenges → topics/pool → lessons/content`(단방향). **빌드 순서 결합만 있다**: T1 `topicProgress.ts`·`service.ts` 가 `pool.ts` 를 import 하고, T2 `types/vocab.ts` 가 T1 `types/challenge.ts` 를, 라우트가 T1 `challengeProgressAfter` 를 import. → **권고 커밋 순서(pathspec)**: ① `topics/pool.ts` 단독(의존이 전부 추적 중인 파일이라 혼자 서도 빌드됨) ② T1 ③ T2 나머지 — 또는 한 커밋.
- 6층: `learning→conversation` import 0·`app→conversation+learning` 조합 OK·L3 내부 `../topics/pool`·`../lessons/content` 깊은 import 는 선례 다수(`../lessons/matching`·`../repetition/review`). barrel `../lessons` 금지는 지켜짐(L-5: 검사 범위만 좁음). `learning/index.ts` 는 T2 가 안 건드렸고(diff = T1 두 줄뿐) 이름 충돌 0(tsc `export *` 충돌 오류 0).
- **범위 이탈 없음**: T2 소유 목록 밖 변경(`prisma/**`·`challenges/**`·`components/**`·`snapshots/**` 한 줄 제외·`conversation/**`(PE 파일 제외))에 T2 흔적 0. `snapshots/index.ts` 의 `topicId?` 1줄은 Leader 가 더한 것(+2줄 주석 포함)이고, `conversation/index.ts` export 2줄·`prompts.test.ts`·`additionalPropertiesStrip.test.ts` 는 PE(Leader 요청 기록 있음). `git status` 의 나머지 M 은 039·012b-3·041·043·010d 소유.
- **PE 산출 독립 관찰(인터페이스 정합만)**: `buildTopicWordsRequest`·`assembleTopicWords`·`TopicWordsDriver` 시그니처·`variant`·`exclude`·`excludeMeanings`·`level` 정합 OK(tsc). `classifyTopicWordsResult` 는 L3 가 못 쓰므로 `sessions.ts:530` 에 같은 규칙(`≥count→null / >0 SHORT / 0 INVALID`)이 복제돼 있다 — 의미 동일, 테스트가 SHORT·INVALID 를 고정. 라이브 측정 스크립트는 DB 접촉 0·`/tmp` 에만 쓴다(비개인 합성 단어).

### 9. 스모크 도구(`tests/live/task042-smoke.{ts,sh}`, 작성만 — 실행 금지 준수)

- 안전장치 OK: BASE 는 localhost 정규식만 허용 · `.sh` 가 `qa-session.ts`(PRODUCTION 거부 `qa-session.ts:31`)로 쿠키 생성·EXIT trap 으로 삭제·쿠키·비밀 미출력 · QA 계정 3(+2 IDOR) 하드코딩(`.test` 도메인) · 풀던 세트 있으면 중단 · **이 실행이 만든 행만** 정리(기준선 id 집합 차집합 + 기존 DAILY·반복 항목 복구) · 계정 2 표식 주제는 id 로 삭제 · 서버 재시작 전제(메모리 상한)가 `.sh`·헤더에 명시 · LEAK 정규식으로 엔진명 검사(Z).
- 주의 3: ① `restore` 가 계정 3 의 기준선 이후 **모든 종류 `StatsSnapshot`** 을 지운다 — 같은 계정을 041·043·044 QA 가 동시에 쓰면 그쪽 행도 지워진다(헤더·`.sh` 에 "동시에 돌리지 않는다" 명시, T1→T2→T4 직렬 규칙) ② 같은 날 두 번 돌리면 서버를 재시작하지 않는 한 B~D 가 `LIMIT`(문서화) ③ `QA_USER_WHERE` 같은 사용자 선택 환경변수는 쓰지 않고 이메일 고정(문제 없음).
- 커버 공백: **수업 `Expr` 행 ↔ `AiWord` 병합**(수업 완료로 만든 같은 표기 행에 새 단어 답이 쌓이는지)은 라이브 스모크가 안 본다(B9 는 같은 `AiWord` 를 다시 풀기로 맞히는 같은-카드 병합). 가짜 DB 단위 통합만 있다 → QA 가 수동 시나리오로 보강. count 21~30·풀보다 큰 목표 라이브도 없음.

### 10. QA 에 넘기는 `high_risk_areas` (우선순위 순)

1. **C1 손님 취소가 서버에 닿는가**(실제 끊김 — Next `signalFromNodeResponse` 는 소스로만 확인, nginx 경유 실측 없음): T_C 생성 요청 1.5초 뒤 끊기 → 세트 0·Trace `errorCode=CANCELLED`·**고아 `claude` 프로세스 0**(`ps`)·끊은 직후 회화 첫 턴이 지연되지 않는지(참고치 (다)). 안 닿으면 30초가 최악을 묶는다는 사실만 남으니 Leader 보고.
2. **벽시계 30초 실동작**: 직렬 큐가 막힌 상태(수업 생성 batch 진행 중)에서 [시작하기] → `TIMEOUT` 폴백 세트·Trace `totalMs ≤ ~30.5s`·`WALL_CLOCK`·SIGKILL 유예 5초 동안 슬롯이 묶이는 시간.
3. **실제 Prisma 쿼리 첫 실행**: 관계 정렬·`replayOfId:null` 관계 필터·`groupBy`·수업 content 60개 읽기 — #47·#48·#49·#51 응답이 정상이고 `#47` 응답 ms(L-6)가 과하지 않은지.
4. **키 합치기 라이브**: 수업 완료 `Expr` 행이 있는 표기를 새 단어가 맞힐 때 행 수 불변·카운터 증가(위 공백) — 모델이 같은 표기를 내게 하기 어려우면 DB 로 수업 `Expr` 항목을 미리 만들어 둔 뒤 `generate:false` B1 `Expr` 카드로 대체 확인.
5. **정답 미노출·타인 404·`WordEntry` 불변**(A4·A8·B5·A12 체크) + FLIP 강등 세트는 `meaning` 이 처음부터 실리는 것이 설계(F1)임을 구분.
6. **하루 상한·표식**: 서버 재시작 전후로 `LIMIT`·`GENERATING`(D1 동시 두 요청) 동작, 재시작 뒤 상한이 0 으로 돌아가는 것(허용 한계 §5)을 사실로 기록.
7. **`AiJob +0`·A12 Trace 1행·lane interactive**(B2·B3) + 이 실행의 대기 ms·`TRACE_DAYS` p50/p95·사유별 비율(참고치 (라)), `OVERLAP=1` 로 A11 겹침.
8. **count 21~30 · 풀(12)보다 큰 count**: 한 번씩(새 단어 20 + 채움 / 폴백 12장).
9. **#51 응답**: `wrongWords[].source`·`reading`·`challenge`(null 또는 객체)·`topic` 같음·ABANDONED 는 기록 0.
10. 사용자 화면 엔진명 0(Z).
- `native_change: false`.

### 11. 다음 단계

- Critical 0·High 0 → **QA 진행 가능**. Leader 확인 요청: ① L-2·L-3·L-1 은 dev 가 5분 안에 고칠 수 있는 한 줄들 — **이번 QA 전에 고치거나 후속으로 미뤄도 PASS 판정은 변하지 않음**(Leader 결정; 고치면 Reviewer 재순환 최소 확인 1회) ② 소유 밖 `tsc` 오류 4건(`components/challenge/__tests__/logic.test.ts`)은 dev-043 에게 ③ 문서(`api-contract`·`domain-model`·`module-dependency`·`design-spec` A12 행·설계서 §4-3a "값→함수 묶음" 문구)는 Reviewer PASS 뒤 Leader 단독(C17) ④ judge C2·Codex 판정 요청은 Leader 몫(이 기록은 Codex 지적을 받지 않았음 — 받으면 채택/오탐/범위 밖 판정 필요).

```json
{ "reviewId": "REV-121", "status": "PASS_WITH_NOTES", "summary": { "critical": 0, "high": 0, "medium": 0, "low": 9, "info": 6 },
  "high_risk_areas": ["req.signal 취소 전파 라이브(C1)·고아 claude 프로세스", "벽시계 30초 실동작·큐 막힘 폴백", "실제 Prisma 쿼리 첫 실행(관계 정렬·replayOfId 필터·groupBy·수업 content 60개)", "수업 Expr 행↔AiWord 병합 라이브 공백", "정답 미노출·타인 404·WordEntry 불변", "하루 상한·GENERATING(재시작 리셋 사실 기록)", "AiJob+0·A12 Trace·참고치 (다)(라)", "count 21~30·풀보다 큰 목표", "#51 wrongWords.source·challenge·topic 일치"],
  "native_change": false }
```

## QA 기록

### qa-p2a (2026-10-07 — LLM 0 레인 · **A 구간만**, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조)
- **`ONLY=A bash tests/live/task042-smoke.sh 3031` = 17/17 PASS**(bd6e291+스텁 1회·`0dfb374` 1회, 둘 다 17/17). 스크립트가 `ONLY=A` 를 지원하고(`:241 if (ONLY_A) return`) A 의 모든 호출이 `generate:false` 이거나 LLM 이전 400·404 라서 실행했다. **LLM 0 확인**: 시작 전 QA 계정 3 AiJob·RequestTrace 0, 종료 뒤도 0(`p2a-qa/qa-state.ts`) — A11 가드(공부한 날 ≥2·항목 ≥2) 미통과라 `#51` 이 REVIEW_DECISION 잡을 걸지 않는 계정 상태였다(A9 `#51` 포함).
- 확인된 것(`[확인]`): 입력 400(주제+분류·`generate` 단독)·없는/남의 주제 404 · `generate:false` → `SKIPPED`·`source TOPIC`·topicWords Trace +0·AiJob +0 · **정답·`refId`·`meaningSnap` 응답 미노출** · `topic` 두 수 `#47 = #48 = #49 = DB 카드 수` · 계정 2 `#49` 404 · `#51` → DONE·`wrongWords[].source TOPIC`·`wordId null`·`challenge` 칸 존재(null) · VOCAB_SESSION 스냅샷 `data.topicId` = 주제 · 답한 2장 → `RepetitionItem` 2행(TopicChunk→CHUNK) · **`WordEntry` 행 수 불변** · `#52` 보관 · `#53` 다시 풀기(주제 유지·refType/refId 복사·LLM 0) · 0답 끝내기 ABANDONED · 엔진명 누출 0.
- REV-121 high_risk 중 이 구간이 덮은 것: 3(실제 Prisma 쿼리 첫 실행 — `#47`·`#48`·`#49`·`#51`·`#52`·`#53` 정상 응답, 단 `generate:true` 세트의 수업 `content` 60개 읽기는 B 이후라 미확인) · 5(정답 미노출·타인 404·`WordEntry` 불변) · 9(`#51` `wrongWords.source`·`challenge`·`topic`). 실데이터 흐름(`challenge-live-ui.ts`)에서 `#51` `challenge` 객체 `{goalMet:true,goalMetNow:true,words:{4,4}}` 도 확인.
- **NOT_VERIFIED(LLM 직렬 슬롯 — qa-p2b)**: B~D(A12 실호출 1회·Trace +1·lane interactive·`totalMs ≤ 30s`·`AiJob +0`) · **C1 손님 취소가 서버에 닿는가**(`errorCode=CANCELLED`·고아 `claude` 프로세스 0) · 벽시계 30초 실동작 · 같은 날 두 번째 세트 LLM 0 · 하루 상한·`GENERATING`(서버 재시작 전후) · 수업 `Expr` ↔ `AiWord` 병합 라이브 공백 · count 21~30·풀보다 큰 목표 · 참고치 (다)(라)·3분 지표.

<!-- qa-p2b-start -->
### qa-p2b (2026-10-07 07:56~ KST · LLM 직렬 슬롯 · B~D 구간, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조) — 최종
- **`bash tests/live/task042-smoke.sh 3032` 전체 실행 2회**(스크립트에 "B~D 만" 구간 선택 없음 → A 는 LLM 0 이라 같이 돌렸다): **1차 27/29 · 서버 재기동(하루 시도 상한 3 초기화) 후 2차 29/29**. A 구간(A1~A15)은 두 번 다 PASS.
- **B~D 판정 `[확인]`**: B1 첫 세트 200·`generatedNow:true`·`source AI` · B4 새 단어 카드(읽기 가나·뜻 한글·`refId` sha1 40자·`aiCardCount`=DB) · B5 정답·`refId` 미노출 · B6 새 단어 답 → `RepetitionItem(Expr, refId)` 1행 · B7 같은 날 두 번째 세트 **Trace +0**(재사용)·`generatedNow:false` · B8 오늘 답한 새 단어 다시 안 나옴 · B9 다시 풀기 → 같은 행·카운터만 증가(병합) · **C1 손님이 1.5s 뒤 끊음 → 세트 0·Trace `errorCode=CANCELLED`(취소 전파, totalMs 1480~1486ms ≈ 끊은 시각 — 40초가 아니라 즉시)** · **D1 동시 두 요청 → 200 1 + 409 `{reason:'GENERATING'}` 1** · B10 벽시계 30초 초과 Trace 0.
- **A12 지연(참고치 — 아래 "오염 가능" 구간 표시)**: Trace `A12:interactive` totalMs **6777(1차)·6801(2차)·6884(트레이스 지연 측정)** ms · 요청 대기(응답 끝까지) 7770·7646·8859ms · 1.5s 취소 Trace 1480~1486ms · D 의 200 쪽 4188~4425ms. **전부 30초 한참 아래**(p95 판정 아님 — n=3). 같은 날 두 번째 세트 대기 116~1111ms(LLM 0). `claude` 프로세스: C1 취소 뒤 앱 형태 `claude --print …` 고아 0(`ps` — ppid 가 죽은 서버/1 인 것 없음) `[확인]`.
- **B2·B3 1차 FAIL 의 정체 — 테스트 경합, 제품 결함 아님(근거)**: ① 1차 로그 `B2 … trace+0 job+0`·`B3 {}`(= 응답 직후 한 번 조회에서 Trace 행이 안 보임) → 같은 시각 DB 에는 `topicWords/<TB> OK A12:interactive 6777ms` 행이 **존재**(`p2b-qa/trace-probe.ts` 로 확인, 이후 B7 `trace === trB2` 는 PASS) ② 코드: `learning/vocab/topicSet.ts:540` `trace: (t) => void recordTrace(t)` — **응답을 기다리지 않는 fire-and-forget**(`engine/trace/index.ts:44` `recordTrace` 는 `await prisma.requestTrace.create`). 호출은 `runTopicWords` 의 `finally`(A12 직후, `topicSet.ts:517-524`), 그 뒤 `composeTopicSessionTx`(세트·카드 트랜잭션)가 돈 다음 응답이 나가므로 보통 Trace 쪽이 먼저 커밋되지만 **순서 보장은 없다**(NAS DB 커밋 지연 변동). ③ `p2b-qa/trace-lag.ts`(A12 1회)로 재현 시도: **Trace 가 응답 끝보다 1.78s 먼저 만들어졌고 응답 끝 직후 첫 조회(3ms)에 보였다** — 즉 1차 실패는 매번 나는 일이 아니라 간헐 경합. 2차 전체 실행 B2·B3 PASS(`trace+1 job+0`, `lane interactive`, `totalMs 6801`). 재현율 1/3 실행(1차만 실패). ④ 판정: **`tests/live/task042-smoke.ts:258-262` 가 응답 직후 즉시 한 번 조회(폴링 없음)한다 — C1 은 최대 40초 폴링하는데 B2·B3 만 즉시 조회** → [결함 #3 Low · 테스트 불안정] 권고: Trace 가시를 최대 2~3초 폴링(어설션은 그대로). 제품 쪽은 의도(응답 비차단)라 수정 불필요. 만약 "응답 직후에 Trace 가 보여야 한다"는 요구가 있으면 Developer 판단(현재 설계·§4-3b 에 그런 요구는 못 찾음 `[추측 — 설계서 전문은 읽지 않음]`).
- **오염 가능 표시**: 07:58:52~08:03 사이 다른 QA 서버(`next dev -p 3033`)의 앱 형태 `claude --print` 프로세스가 `ps` 에 있었다(Leader 에게 중간 알림 → qa-p2c-A 가 서버 종료). 내 측정 중 **트레이스 지연 측정(07:59:32)·task042 2차 실행(08:00:12~08:01:00)** 이 겹쳤을 수 있어 "오염 가능" 으로 표시 — 다만 1차(07:56:25~, 겹침 전) 값과 6.8s 안팎으로 같아 영향은 관측되지 않았고, 나중에 내 서버의 유휴 **예열 풀 프로세스**(CPU 시간 0, `[claudeCli] … warm=HIT`)가 같은 모양임을 확인해 3033 의 그 프로세스도 유휴 예열 프로세스였을 가능성이 높다(`[가능성 높음]`, 그 시각 CPU 시간은 미확인).
- **NOT_VERIFIED(이번 B~D 에서 못 한 것)**: 서버 재시작 전후 `GENERATING` 하루 상한 표시 유지(서버 메모리 값이라 재시작하면 초기화 — 설계상 한계, 재시작 뒤 초기화는 간접 확인 — 하루 3번 상한을 쓴 서버를 재기동하자 B~D 재실행이 LIMIT 없이 통과) · count 21~30·풀보다 큰 목표(스모크 범위 밖 — 단위 테스트) · 수업 `Expr` ↔ `AiWord` 병합 라이브 공백(스모크 B6·B9 가 `RepetitionItem` 병합은 확인, 수업에서 만든 `Expr` 와의 병합은 이번 흐름에 수업이 없어 미확인 — 아래 F/D 에서 재확인 예정).
- **C1 취소가 서버에 닿는가 — 추가 확인(task-044 `cancel` 모드, 오늘 탭 UI 에서 링크·뒤로 가기·새로 고침 모두)**: 요청 `net::ERR_ABORTED` → Trace `CANCELLED` 2.1~2.4s · 세트 0 · 시도 환불(취소 3번 뒤 정상 시작이 LLM 호출) · 고아 `claude` 0 `[확인]` — 상세는 [[task-044-today-integration]] QA 기록.
- **A12 중 회화 턴 지연(참고)**: A12 가 도는 5~6.6s 동안 같은 서버에 TEXT 턴을 걸면 TTFA 가 +3.3~4.1s(5.2s·4.8s) — 비선점 직렬 큐 효과, 같은 기기에서는 대기 화면을 떠나면 A12 가 취소돼 안 생김. 상세는 [[task-044-today-integration]].
<!-- qa-p2b-end -->

## 배포 기록
<!-- Phase 2 일괄 배포 때 deployer 가 RELEASE_RESULT 근거로 기록. -->

## 최종 요약

## Leader 기록 (Phase 2 일괄 접수·결정, 2026-10-06 22:45)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev): risk=R1 · developer=opus · track=standard · demo=none(None) · 결과 JSON `/tmp/judge-task-042-intake.result.json`. **Leader 위험 보정**: **R2 유지/상향**(동기 LLM 호출·세트 트랜잭션·키 합치기)
- **데모 승인 생략 지시**: 사용자(2026-10-06) "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". 승인용 데모는 만들지 않고 designer 가 **구현 가이드**를 낸다. `check.mjs waive` 는 이 문장을 인식하지 못해(정규식: "데모" 바로 뒤 생략/없이) **정식 waive 기록은 없다** — 훅은 warn 단계라 막지 않는다.
- **`## Leader 확인 필요` 처리(Leader 결정)**: ① **스키마는 WP-DB0 단일 작성자**(`task-p2-db0-schema`) — 설계서 §11-1·§11-2 의 "T1 이 D1·D2, T2 가 D4·D5 를 쓴다" 문구는 이 결정으로 대체 ② **`src/types/plan.ts`·`src/types/lesson.ts` 와 plan/calendar·plan/day·lessons/today 라우트의 additive 변경(`challenge?`·`reason: 'CHALLENGE'`)은 T1 소유**(타입만 늘리는 변경 — T3·T4 는 소비만) ③ **`topics/pool.ts` 는 T2 가 만들되 base(B1 풀·`lessonExprCount`)를 가장 먼저 로컬로 내놓고, T1 의 `topicProgress` 는 그 뒤에 한다**(T1 의 다른 부분은 선행 가능) ④ PE 산출 파일 구성: 현재 PE 는 스키마를 `prompts/topicWords.ts` 안에 둔다 — 설계서의 `structuredResponse/topicWordsSchemas.ts` 분리와 다르지만 `schemas.ts`·`checks.ts`(task-039 구역)를 피하는 목적은 같아 **PE 구성을 따른다** ⑤ A12 레인은 **interactive**(사용자가 기다리는 호출 — 설계서 v2.3 따름, 계획서 batch 문구는 정정) ⑥ `components/lesson/LessonScreen.tsx`·`LessonEnd.tsx` 의 #62 `challenge?` 토스트는 **T4 소유**(010d-B 가 같은 `LessonEnd.tsx` 를 나중에 만진다 — T4 커밋 뒤) ⑦ QA 계정 3 은 T1→T2→T4(→T3) 순으로 **직렬**(같은 계정에 챌린지 행 1개만 가능).

## Leader 확인 필요
설계서·계획서·지시문이 서로 어긋나거나 비어 있어 이력서 작성자가 정하지 않은 항목이다.

1. **스키마 소유 문구 불일치.** 설계서 §11-1 직렬 고리 ①·§11-2 가 "T2 가 T1 스키마 커밋 위에 D4·D5 블록을 쓴다" 로 적은 반면, 지시문과 계획서 §2 C1 은 DB0 단일 작성자다. 이 이력서는 후자를 따랐다(T2 는 스키마 무수정). 설계서 §11-1·§11-2 문구 정정은 Leader 몫(C17).
2. **PE 신규 파일 구성이 문서마다 다르다.** 지시문은 "`conversation/prompts/topicWords.ts`(신규, 스키마 동봉)", 계획서 §1-2 WP-042 도 "스키마도 이 파일 안에" 인데, 설계서 §4-3a·§10-1·§11-2 는 **스키마·항목 검사를 `structuredResponse/topicWordsSchemas.ts`(신규) 로 분리**하고 `conversation/index.ts` export 한 줄을 적었다. 어느 쪽이든 `schemas.ts`·`checks.ts`·`talk.ts` 는 건드리지 않는다. 이 이력서는 설계서 쪽을 적었으니 파일 한 개로 합칠지 정해 주세요.
3. **A12 레인이 문서마다 다르다.** 계획서 §1-2 WP-042 ⑥ 은 "생성 호출은 batch 레인"이라 적었고, 설계서 v2.3 §4-3a·§5-2 는 `lane:'interactive'`(사용자가 대기 화면에서 기다리는 동기 호출 — 큐에서 batch 보다 먼저 서되 실행 중 batch 는 기다림)이다. 이 이력서는 설계서(확정본)를 따랐다.
4. **`topics/pool.ts` 순서.** 이 task 의 신규 파일인데 [[task-041-challenge-core]] 의 `topicProgress`(수업 표현 수·기본 표현 진행)도 import 한다(설계서 §10-1). T2 가 `pool.ts` 골격(타입·출처 상수)을 먼저 로컬 커밋할지, T1 을 두 단계로 나눌지 정해 주세요.
5. **계획서 §2 소유 표에 `conversation/index.ts`·`engine/router/tasks.ts` 행이 없다.** 두 파일 모두 2026-10-06 22:00 `git status` 상 task-039 미커밋 파일이 아님을 확인했고, 이 task 가 한 줄씩만 더하는 것으로 적었다. 010d PE 가 같은 `conversation/index.ts` 를 뒤에 만질 수 있으니 소유 표에 행을 더할지 확인.
6. **QA 계정 3 공유.** 계획서 WP-042 는 "QA 계정 3(041 과 시간 나눔 또는 계정 1 의 IDOR 만)" 두 안을 적었다. 어느 쪽으로 갈지, 또는 챌린지 레인 계정을 더 만들지 정해 주세요(사용자당 진행 중 챌린지 1개·풀던 세트 409 규칙 때문에 같은 계정을 동시에 쓰면 서로 409).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-06 22:11 |

## Leader 기록 (DB0 통합 `db push` 완료, 2026-10-06 22:17)

- **사용자 승인**: AskUserQuestion 2026-10-06 "DB 구조 변경 전부 승인". Reviewer REV-118 PASS_WITH_NOTES(승인 목록 9문장 1:1 일치·승인 밖 0·운영 공존 안전).
- **실행 순서(체크리스트 1~6 준수)**: ① 감사한 5파일 sha256 앞 16자·`git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 그대로 확인 ② **백업** `files/thekaiwa/backups/thekaiwa-20261006-221627-pre-p2db.sql.gz`(600, 227,836 B, "Dump completed on 2026-10-06 22:16:31", 53개 표) ③ **`migrate diff` 재실행**(`--from-schema-datasource` → 파일): 9문장·sha256 앞 16자 `66c04634550da524`(검토본과 동일)·삭제/경고/이름 변경 0 ④ **`prisma db push --skip-generate`**(`--accept-data-loss` 없음) 22:17:00~22:17:42 rc=0 "Your database is now in sync" ⑤ **검증**: `migrate diff` 재실행 = "This is an empty migration"(드리프트 0) · `information_schema`: `Challenge` 16칸·FK 2(`userId`·`topicId`)·인덱스 `activeKey` 유니크 + `(userId,status,startDate)` + `(userId,endedAt)` · 새 칸 10개 존재(`Correction.extraNoteKo`·`EngineMetricsDaily` 6·`VocabAttempt.refType/refId`·`VocabSession.topicId`) · 행 수 Correction 7·VocabSession 6·Challenge 0 · 운영 `/api/health` success·`status:ok`·`degraded:[]` · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online restarts 0(로그의 Prisma 오류 줄은 10-06 00:17 의 기존 `[jobs]` 줄 — push 와 무관) ⑥ 메인 미러 `prisma generate` 완료.
- **SQL 소속 task**: `Correction.extraNoteKo` = task-039 · `EngineMetricsDaily` 6칸 = task-012b-3 · `VocabAttempt.refType/refId`·`VocabSession.topicId`(+인덱스·FK) = task-042 · `Challenge` 표(유니크 1·인덱스 2·FK 2) = task-041. 이 push 로 **네 task 의 DB 선행이 충족**됐다(운영 코드는 추가분을 select 하지 않으므로 영향 없음).
- 복구 1순위: 새 칸·표만 역순으로 되돌리기(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸). 백업 전체 복원은 공유 DB 전체 되돌림이라 최후 수단.
- 이후: `git push` 는 사용자 지시대로 **전부 끝난 뒤 한 번** — 커밋은 pathspec(`git add -A` 금지).

## Codex 검토 (C2 checkpoint)

### [2026-10-06 14:33] C2 adversarial-review focus=concurrency — done
- judge 판정: codex_required=true · mode=adversarial-review · focus=concurrency / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a701(task_file) snapshot=f87c8dd
- 지적 2건:
  - [high] src/modules/learning/vocab/sessions.ts:471 — blue/green 배포 중 구·신 프로세스가 함께 요청을 받거나 프로세스 재시작 전후에 같은 사용자의 주제 세트 생성 요청이 겹칠 때, 생성 동시성 표식(`_generatingTopics`)과 시도 버킷(`attemptsByDay`)이 프로세스 로컬 메모리라 프로세스 경계를 넘지 못함 → A12가 중복 호출되거나 세트가 중복 생성될 수 있고, 하루 성공 1회·시도 3회 제한이 우회됨 (권고: 생성 상태와 일일 카운트를 DB 테이블로 옮기고 조건부 갱신으로 획득, 최소한 사용자 행 잠금 뒤 오늘 성공 여부를 다시 검사)
  - [medium] src/modules/learning/vocab/sessions.ts:495 — A12 완료 직후 signal 검사와 composeTopicSessionTx 커밋 사이에 클라이언트 연결이 종료되면, signal 검사가 진입 전에만 있고 트랜잭션이 signal을 받거나 검사하지 않음 → 취소된 요청이 세트를 생성하고, 재시도는 409로 막힘 (권고: 트랜잭션 진입 직후와 insertSession 직전에 signal 재검사, 또는 생성 결과를 임시 상태로 저장 뒤 취소 프로토콜 실행)
- 검토하지 못한 범위: 실 MariaDB에서 관계 필터·orderBy 쿼리의 격리 수준별 동작, Next.js 운영 서버의 req.signal 실제 전파, blue/green 배포 스크립트의 구·신 웹 프로세스 동시 요청 수신 시간, 실 LLM 어댑터의 abort 시 자식 프로세스 정리
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T143332Z-task-042-C2/raw.txt

## Leader 판정 (Codex C2 지적 2건, 2026-10-06 00:05)

Codex C2(호출 1/4)의 두 지적은 **Reviewer REV-121 이 이미 같은 가정을 판정한 항목**이라 별도 Reviewer 호출 없이 Leader 가 근거를 대조해 기록한다(새 근거 없음 — 필요하면 Reviewer 재판정 요청 가능).
- **[high] 프로세스 메모리 표식·시도 버킷이 blue/green·재시작에서 경계를 못 넘음 → A12 중복 호출·하루 상한 우회**: REV-121 "다중 프로세스·재시작 상한 — **허용 한계**" 와 동일. 근거: `thekaiwa` 는 `instances: 1`(`ecosystem.config.js`·`pm2 jlist`), 최악은 **A12 가 몇 번 더 도는 것(LLM 비용·큐 점유)** 뿐이고 **세트 중복은 DB 로 막힘**(트랜잭션 안 `assertNoInProgress`·하루 성공 1회 재사용은 DB 기준 `todayAiWordExists`). → **수용**. 감시: QA 서버 재시작 전후 `LIMIT`·`GENERATING` 확인(REV-121 QA high_risk 6), 배포 문서에 "`instances` ≥ 2 로 올리면 상한·표식·큐 동시성이 느슨해짐" 한 줄 경고(Leader 정본 반영 때).
- **[medium] `signal` 검사가 A12 완료 전에만 있어 저장(세트 트랜잭션) 중 연결 종료에는 세트 미생성 보장 없음**: dev-042c 가 이미 기록한 "세트 트랜잭션 도중 끊김은 기존과 같이 세트가 만들어진다 — 이번 범위 밖" 과 동일. A12 성공 직후~트랜잭션 전 끊김은 dev-042c(L-2)가 시도 복원·세트 0 으로 처리. 트랜잭션 도중 끊겨 세트가 만들어져도 **사용자 불이익 없음**(다음 진입 때 "풀던 세트 있음" 으로 이어 풀기, 중복 세트 없음). → **수용**(복잡도 대비 이득 없음).

## 상태 정리 (2026-10-10)

- 상태 `todo` → `done`. 사용자 승인(2026-10-10 「2번 승인하고 진행해줘」) — Leader. 근거는 상태 감사 2건(읽기 전용) 결과를 Leader 가 일부 직접 대조한 것이다.
- 주제 단어(A12) 서버. PE 게이트 통과율 95.4%·읽기 눈 판정 99.8%·p95 9.9s(판정자가 모델이라 사람 검수는 아님), qa-p2a 17/17·qa-p2b 29/29, 감사 REV-121 PASS_WITH_NOTES. Phase 2 릴리스에 포함. 완료 기준 5개 중 4개 충족, 1개 부분(3분 지표 미측정·폴백 사유 중 라이브 확인은 LIMIT 뿐·수업 `Expr`↔`AiWord` 병합 라이브 미확인).
- 예문 칸은 task-049 로 이어서 구현·배포됨(2026-10-10).
- 챌린지 정본 5종 미반영(`domain-model.md` 의 `Challenge` 엔티티 정의·`api-contract.md` 의 `/api/v1/challenges` #155~#159·`module-dependency.md` 의 `challenges/`) — 이 task 만의 일이 아니라 챌린지 전체의 문서 부채로 ACTIVE 백로그에서 추적한다.
