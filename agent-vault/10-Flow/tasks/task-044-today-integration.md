---
task_id: task-044
title: "오늘 탭 연동·주제 단어 화면 — S6·S7, 새 단어 대기 화면·폴백 문구 (IMP-0024, 설계서 T4)"
status: todo
base_ref: 5c3a701
risk_level: R1
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-040-improve-challenge-design, phase2-batch-plan, task-p2-db0-schema, task-041-challenge-core, task-042-topic-words-b2, task-043-challenge-screens, task-008-vocab-today-words, task-010-today-lesson, task-010d-scenario-roleplay]
imp: [IMP-0024]
tags:
  - type/task
  - domain/challenge
  - domain/ui
aliases:
  - 오늘 탭 챌린지 연동
  - 주제 단어 화면
  - task-044
created: 2026-10-06
updated: 2026-10-06
demo_gate:
  required: true
  level: "delta"
  status: "waived"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: "user"
  waived_at: "2026-10-06T23:43:51+09:00"
  waiver_quote: "데모 생략하고 진행해줘"
  active: false
---

## 목표 (Leader)
개선 항목 [[IMP-0024-챌린지-계획표-개편]] 의 **설계서 T4** — **오늘 탭이 챌린지 주제를 따르게 하고, 주제 단어 세트 화면에 새 단어(B2) 흐름을 그린다**(설계서 §8-3 의 S6·S7). 정본은 `docs/design/challenge.md` v2.3 §4-3b·c·§5-4·§8-3·§9-2·§13-5. 서버·API 는 [[task-041-challenge-core]](#158·#58·#62)·[[task-042-topic-words-b2]](#47·#48·#49·#51·#53)가 만들고 이 task 는 소비만 한다.

- **S6 오늘 탭 `/study/today`**: 챌린지 띠("n일째 / N일" · 오늘 할 일 진행) · **오늘의 단어 카드 = 주제 단어 [시작하기]**("오늘 0/8장") + [내 단어장으로 풀기] · **오늘의 회화 카드 = "「카페 주문」 오늘 수업 [만들기]"**(한 번 탭 — 앱에서 유일한 챌린지 수업 생성 버튼). 챌린지가 있으면 **챌린지 수업 상태(`TodayTasks` LESSON)가 회화 카드의 주인**이고 다른 주제 수업은 보조 줄이다(`deriveLessonCard` 덮기).
- **S7 주제 단어 세트 `/study/today/words/[sessionId]`**: 덱은 지금 그대로 + 머리에 주제 칩·**출처 문구**·"오늘 n/8장" · **새 단어 만드는 중 대기 화면**(진행 표시·[주제 표현으로 바로 풀기]·떠나면 `AbortController` 취소·409 `GENERATING`) · 끝내기 확인 시트 · 결과("오늘 n/8장"·[단어장에 넣기]·챌린지 목표 달성 알림·소급 "어제 목표도 채웠어요").
- 계획표·챌린지 전용 화면(S1~S5·S8)은 [[task-043-challenge-screens]] 몫이다.

**designer 는 승인용 데모가 아니라 구현 가이드를 낸다**(설계서 §13-5 + 데모 v2 `docs/demo/task-040-improve-challenge-design-v2.html`(승인 안 된 참고본)). 사용자 지시로 데모 승인을 생략했다 — 화면 코드 착수 전에 designer 가이드가 먼저 나온다.

## 사용자 결정
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**.
- 2026-10-06 사용자 답(AskUserQuestion, Leader 전달 — 이 이력서 작성자는 원문 대화를 보지 못함): **DB 전부 승인**(챌린지 D1·D2·D4·D5 — 모두 추가만) · **운영 배포는 모든 작업이 끝난 뒤 한 번에** · **챌린지 U3 = B2**(오늘의 단어 LLM 생성), 나머지 U1~U15·N1~N3 은 설계서 권고안으로 확정.
- 확정값 요약(설계서 §11-4a — ★ = 이 task 의 화면이 직접 따르는 것. 설계서 §11-5 의 선택 카드는 더 이상 고르는 칸이 아니라 **"확정" 표시용**이다):

| # | 결정 | 확정값 |
|---|---|---|
| U1·U2 | 데이터 모델·DB | A 새 표 `Challenge` · D1·D2·D4·D5 한 번에 승인(추가만) |
| U3 ★ | 오늘의 단어 | **B2** — A12 `topicWords` 가 매일 새 단어를 만든다. 폴백·채움은 B1 풀(주제 기본 표현 + 이 주제 수업 표현). 설계서 권고 B1 과 다름 |
| U4 ★ | 풀 부족 | 주제 표현만(내 단어장으로 채우지 않음). B2: 새 단어 → B1 풀 순 |
| U5 ★ | 수업 만드는 시점 | C3+ 한 번 탭 — 오늘 탭 회화 카드 [오늘 수업 만들기], 새 LLM 경로 없음 |
| U6 | 010d 범위 | 나눠서(A1-서버 지금 · A1-PE 039 뒤 · A2 T1 뒤 · A3+B 캡처 뒤 · 챌린지 2단계) |
| U7·U8·U9·U10 | 지표 원천·유예·IA·탭 이름 | (iii) 읽을 때 계산 · 오늘 유예 · F1 · "계획표" 유지 |
| U11 ★ | 기간·장수 | 7·14·30일 · 단어 5·10·15장(시드 주제는 15 비활성) |
| U12·U13 | 무엇을 셀지·개수 | (가) 같은 주제면 어디서 했든 · 진행 중 1개·그만두기만 |
| U14 ★ | 하루 달성 기준 | W2 — 목표 장수의 80%(5→4·10→8·15→12)를 그날 합산 + **다시 풀기도 셈** + 수업은 끝내기만(W4 없음) |
| U15 ★ | 주제 세트 다시 풀기 | A — 주제 세트로 다시 풀기 + 통계 포함 |
| N1 ★ | [단어장에 넣기] | A — 바로 넣기("✓ 넣었어요"), 새 단어 카드도 같은 흐름(예문은 비어 있음) |
| N2 | 챌린지 이름 | A — 자동 "<주제> N일 챌린지" |
| N3 ★ | [오늘 수업 만들기] 위치 | A — 오늘 탭 회화 카드에만 |
| 설계 판단 ★ | 예문·A12 | E2 예문 없음 · fast(haiku) · **G1 [시작하기] 동기 대기 · 벽시계 30초 · 떠나면 취소** |

## 설계 방침 (설계서 v2.3 요약)
- **S6 오늘 탭(§8-3)** — 기본 문구(§13-5 49): 시작 전 "「카페 주문」 새 단어 10장 · 오늘 0/8장", 오늘 이미 만들었으면 "오늘 새 단어 n장 남음 · 오늘 m/8장". 장수별 문구(§13-2 18번): 5장 목표 → "오늘 0/4장"·S7 머리 "4장 이상 풀면 오늘 단어 완료" → "오늘 2/4장 — 2장 더" / 10장 목표 → "오늘 0/8장"·"8장 이상 풀면 오늘 단어 완료" → "오늘 4/8장 — 4장 더 풀면 완료" / 15장 → 시드 주제는 비활성이라 해당 없음.
- **S6 회화 카드의 주인 규칙(§8-3, `lesson/logic.ts` `deriveLessonCard`)**: 지금 규칙은 오늘 끝낸 새 수업이 하나라도 있으면 "끝냄" 카드라 챌린지 [만들기] 자리가 사라진다 → 챌린지가 있으면 **챌린지 수업 상태(#158 `TodayTasks` LESSON)가 카드의 주인**이고 다른 주제 수업은 보조 줄이다 — ① 오늘 다른 주제 수업을 이미 끝낸 날: [오늘 수업 만들기] 그대로 + 보조 줄 "「길 묻기」 수업 끝냄 · 챌린지에는 세지 않아요" ② 다른 주제 수업이 열려 있는 날(READY·IN_PROGRESS, 또는 어제 만든 다른 주제 수업 `resume`): 챌린지 [오늘 수업 만들기]가 주인, 열린 수업은 보조 줄 [이어서 하기]. "이어서 하기(어제 만든 수업)" 기본 상태는 **챌린지 주제 수업일 때만** 카드의 주인.
- **S6 꼭 그릴 상태(§8-3)**: 새 단어 [시작하기] 뒤 대기 화면 · 409 `GENERATING` · 수업 만들기 전 · 만드는 중(약 1분) · 다른 수업 만드는 중(409) · 준비됨 · 이어서 하기(어제 만든 **챌린지 주제** 수업) · 실패 · 단어 합계 미달로 끝냄("4장 더" [한 세트 더]) · 오늘 목표 달성 · 챌린지 없음(지금 화면 그대로) · 위 ①② · 풀던 세트 카드(#48 `limit=10` + #49 방어 조회 — 주제 칩·"지난 수업 표현 n개 포함", `TodayHome.tsx:92-105`).
- **대기 화면(§4-3b, §13-5 50)**: [시작하기] → #47 `{topicId, generate:true}` 동안 "오늘의 「카페 주문」 새 단어를 만들고 있어요 · 보통 10~20초" + 진행 표시 + **처음부터 보이는** 보조 버튼 **[주제 표현으로 바로 풀기]**(= 요청 취소 + #47 `{topicId, generate:false}`). **화면을 떠나면 `AbortController` 로 요청을 취소한다**(서버는 `req.signal` 이 취소되면 세트를 만들지 않음 — 이 취소가 서버에 닿는지는 [[task-042-topic-words-b2]] 라이브 항목). 떠나면 취소된다는 사실은 화면에 쓰지 않아도 된다(동작 메모만). 최대 30초 뒤에는 서버가 폴백 세트를 돌려줘 자동으로 이어진다. 409 `GENERATING`(다른 곳에서 새 단어를 만드는 중)은 대기 화면과 같은 모양 + "잠시 뒤 다시 열어 주세요" 또는 자동 재조회.
- **S7 덱 머리 출처 문구(§4-3c 표 · §13-5 51~53)** — #47 응답 `generation{source, generatedNow, reason}`·세션 DTO `topic.{lessonCardCount, aiCardCount}` 로 고른다. 새로 고침·이어 풀기(#48·#49)에는 `generation` 이 없으므로 `aiCardCount` 로 고른다(`aiCardCount = cardCount` → 새 단어 문구, `0 < aiCardCount < cardCount` → 섞인 문구, `aiCardCount = 0` → B1 문구; 폴백 사유 한 줄은 #47 응답 때만):

| 상황 | 덱 머리 문구 |
|---|---|
| 새 단어 세트(`source:'AI'`) | "「카페 주문」 새 단어 10장" + 주의 한 줄 **"AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요"** |
| 섞인 세트(`MIXED`, `SHORT`) | "새 단어 7장 + 「카페 주문」 표현 3장" + 주의 한 줄(카드마다 출처 표시는 하지 않음) |
| 오늘 새 단어를 다 풂(`NEW_DONE`) | "오늘 새 단어는 다 풀었어요 — 「카페 주문」 표현으로 이어서 풀어요" |
| 시간 초과·실패·ajv 위반(`TIMEOUT`·`FAILED`·`INVALID`) | "오늘은 새 단어를 만들지 못해 「카페 주문」 표현으로 골랐어요 · 다음 세트에서 다시 만들어 볼게요" |
| 하루 시도 한도(`LIMIT`) | "오늘 새 단어 만들기는 여기까지예요 · 「카페 주문」 표현으로 골랐어요" |
| 바로 풀기(`SKIPPED`) | "「카페 주문」 표현으로 만든 오늘의 단어 10장 · 지난 수업 표현 n개 포함"(n ≥ 1 일 때만 뒤 문구) |
| 두 번째 세트 | "오늘 만든 새 단어 중 안 푼 6장 + 「카페 주문」 표현 4장" — 카드 10장, 그날 합계 **20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)** |

  **폴백 세트도 "오늘 n/8장" 합계에 그대로 더해진다**(판정은 카드 출처를 보지 않는다) — 한 상태 이상에서 보여 준다. "AI 가 새 단어를 만들었어요" 류 금지 규칙은 **B1(폴백) 문구에만** 남고, 새 단어 세트는 사실대로 쓴다. 문구는 "AI" 까지만 — 엔진·모델 이름 0.
- **S7 덱·끝내기·결과(§8-3·§5-4)**:
  - 덱 머리 장수 = #158 `TodayTasks` WORDS `answered`(끝낸 세트 합계 — 풀고 있는 세트는 안 들어 있음) + 덱이 아는 이 세트의 답한 수. 첫 세트면 "8장 이상 풀면 …".
  - [여기서 끝내기] 확인 시트(합계 미달일 때): "지금 끝내면 오늘 단어는 8장 중 n장 — '일부'로 남아요. 남은 표현으로 한 세트 더 풀 수 있어요".
  - 결과: **"오늘 n/8장"**(n = #51 `challenge.words.answered`, 합계를 채운 세트의 결과에만 "오늘 단어 완료"). **익힘 증가분("익힘 7 → 8")·"표현 12개 자세히" 칩은 그리지 않는다**(Leader 결정 — 2단계 후보).
  - **목표 달성 알림은 그날을 달성으로 바꾼 완료에서만 한 번**(`goalMetNow`): 첫 세트 끝내기는 알림 없음, 합계를 채운 두 번째 세트 끝내기에서 "오늘 챌린지 목표 달성!", 이미 달성한 날 [한 세트 더] 결과에는 알림 없음.
  - **`challenge:null`**(다른 주제 세트·내 단어장 세트·복습/붙여넣기 수업·꺼진 과제·진행 중 없음·마지막 날 자정 뒤)이면 챌린지 줄·토스트를 그리지 않는다.
  - 소급(선택): 어제 시작한 세트를 오늘 끝내 어제 목표가 채워지면 `date` 가 어제 → "어제 목표도 채웠어요". 자정 넘김 안내는 기존 `DeckNotice.tsx` 문구 "세트는 시작한 날로, 수업은 끝낸 날로 기록돼요".
  - 결과 카드별 **[단어장에 넣기]**(#41, N1 A): 카드 스냅샷의 표기·읽기·뜻으로 바로 넣고(예문 없음) "✓ 넣었어요", 이미 같은 표기가 있으면 "단어장에 있어요". 결과 머리에 주의 한 줄(새 단어 세트일 때) 한 번. **자동으로 단어장에 들어간 단어는 없다**는 것이 화면에서 드러나야 한다(넣은 카드만 "✓ 넣었어요"). [보관]·[다시 풀기]는 주제 세트에서도 그대로(다시 풀기 = 주제 세트, 칩·"지난 수업 표현 n개" 같은 값).
  - `TOPIC_ALL_DONE_TODAY`(오늘 이 주제 표현을 다 풀었어요) 빈 상태는 **그날 단어 과제를 채운 뒤에만** 나온다 — 미달 상태와 함께 그리지 않는다. [한 세트 더] → 빈 상태 → [내 단어장으로 풀기]. 풀 적음("N장뿐")·FLIP 강등(서로 다른 뜻 < 4)도 그린다.
- **S7 꼭 그릴 상태**: 새 단어 세트 · 섞인 세트 · 폴백 세트(시간 초과·실패·한도·바로 풀기·오늘 새 단어 다 풂) · 두 번째 세트(합계 이어서 — "오늘 4/8장" 에서 시작) · 풀 적음 · FLIP 강등 · `TOPIC_ALL_DONE_TODAY` · 이미 단어장에 있음 · 자정 넘김 안내 · 소급.
- **그리지 않는 것**: 새 단어 예문(E2) · 그날 두 번째 생성 "새 단어 더"(2단계 후보) · 새 단어 미리 만들기(G2~G4) · 주제가 지워진 챌린지. 010d 의 "주제 → 상황 2단 선택"은 **오늘 탭에 넣지 않기를 권고**한다(회화 탭 '시나리오' 항목이 진입점 — 계획서 §1-2 — `TodayLessonCard`·`LessonTopicsScreen` 을 010d-B 가 피하도록). **T6(챌린지 × 시나리오)는 보류** — 후속 한 줄(010d-B 이후 2단계 조건부).
- **진행 절차**: judge intake(신규 상태·대기 화면 → standard 추정, 데모는 지시로 생략) → **designer 구현 가이드**(`## Designer 기록` 에 먼저, `docs/screens.md` §5·§12 오늘 카드 변경은 웨이브 끝에 designer 1명이 일괄 — C18) → developer → Reviewer → QA → Leader 로컬 커밋(pathspec). 디자인 판단은 designer 전담(developer·reviewer 는 디자인 스킬을 쓰지 않고 문제는 Leader 를 거쳐 designer 에게 넘긴다).

## 예상 변경 경로
- `src/components/vocab/**` — `TodayHome.tsx`·`TodayWordsCard.tsx`(S6 단어 카드)·`VocabSessionScreen.tsx`·`VocabDeck.tsx`·`useVocabDeck.ts`·`DeckNotice.tsx`·`DeckProgress.tsx`·`FinishConfirmSheet.tsx`·`VocabResult.tsx`·`WordResultList.tsx`·`labels.ts`·`logic.ts`·(신규) 대기 화면 부품·훅
- `src/components/lesson/TodayLessonCard.tsx`·`src/components/lesson/logic.ts`(`deriveLessonCard` 챌린지 덮기)
- `src/app/(app)/study/today/**`(`page.tsx`·`words/[sessionId]/page.tsx`)
- 테스트: `src/components/vocab/__tests__/**`·`src/components/lesson/__tests__/lessonLogic.test.ts`(신규 파일 또는 챌린지 케이스 추가) · `tests/live/`(화면 스모크·TTFA 참고치 — 이름은 developer 가 정함)
- 타입: 서버 응답 타입은 [[task-042-topic-words-b2]](`src/types/vocab.ts`)·[[task-041-challenge-core]](`src/types/challenge.ts`)가 만든다 — 이 task 는 import 만.
- 문서: `docs/screens.md`(designer, 웨이브 끝 일괄 — §5·§12 오늘 카드 변경)
- **목록 밖(Leader 확인 필요 §1)**: `src/components/lesson/{LessonScreen,LessonEnd}.tsx`(#62 `challenge?` 소비)

## 완료 기준 (QA 가 실행으로 확인)
설계서 §11-2 T4 행·§8-3·§13-5 와 계획서 §1-2 WP-044 를 그대로 옮긴다.

1. **화면 로직 단위 테스트**:
   - **출처 문구 선택** — `aiCardCount`·`generation.reason` 조합 전부(새 단어·섞임·`NEW_DONE`·`TIMEOUT`·`FAILED`·`INVALID`·`LIMIT`·`SKIPPED`·#48·#49 로 다시 연 세트).
   - **대기 화면 unmount → abort 호출**(떠나면 요청 취소, [주제 표현으로 바로 풀기] = 취소 + `generate:false`).
   - **`deriveLessonCard` 챌린지 덮기** — 다른 주제 수업 끝냄·열림·어제 만든 다른 주제 수업(보조 줄), 챌린지 주제 수업 `resume` 만 주인.
   - **덱 머리 장수** = #158 WORDS `answered` + 이 세트 답한 수 · 목표 장수별 문구(5→4·10→8) · 합계를 채운 세트에만 "오늘 단어 완료" · `goalMetNow` 에서만 알림 한 번.
2. **상태 전수(S6·S7)** — 위 "꼭 그릴 상태"를 전부(고정 응답). **360 / 390 / 412 세 폭 × 높이 780 / 892**, 가로 넘침 0, **화면당 스크롤 1곳**, 터치 **44px** 이상(푸시투토크류 해당 없음), `min-width:0`, 일본어 본문 16px↑, **엔진명·모델명·task/Phase 번호 0**, 새 색 없음.
3. **`challengeProgressAfter` null 일 때 줄·토스트 없음** — 다른 주제 세트·내 단어장 세트·복습·붙여넣기 수업·꺼진 과제·마지막 날 자정 뒤·진행 중 챌린지 없음 각각에서 챌린지 줄·목표 달성 토스트가 그려지지 않는다. 챌린지가 없는 사용자의 오늘 탭은 지금 화면 그대로.
4. **S6 회화 카드의 주인**: 오늘 다른 주제 수업을 끝낸 날·다른 주제 수업이 열려 있는 날에도 챌린지 [오늘 수업 만들기]가 주인이고 다른 수업은 보조 줄만. [오늘 수업 만들기] 는 앱 안에서 이 카드에만 있다(N3 = A).
5. **QA 라이브(QA 계정 3, 실서버 — [[task-041-challenge-core]]·[[task-042-topic-words-b2]] 머지 뒤)**:
   - **대기 중 회화 탭으로 이동 → 첫 턴 TTFA**(5초 참고치 (다) — A12 가 취소됐는지 Trace 로 확인, 취소가 안 닿으면 남은 시간만큼 늦다는 사실을 기록. 목표 회귀 ≤ +0.3s 는 [설계 목표]이며 합격 판정이 아니다).
   - 폴백 세트 문구(사유별) · **두 번째 세트**(오늘 새 단어 중 남은 것 + 채움, "오늘 4/8장" 에서 이어짐) · 합계 미달 끝내기 → "4장 더" [한 세트 더] · 합계를 채운 세트에서만 목표 달성 알림 · 다시 풀기 후 주제 칩·"지난 수업 표현 n개" 같은 값(새로 고침 뒤에도).
   - [단어장에 넣기] 로 `WordEntry` 가 생기고 **넣지 않은 새 단어는 단어장에 없음** · "단어장에 있어요".
   - 실기기(갤럭시 S25+, 앱 WebView ≈ 390px)에서 **새 단어 대기 화면**(진행 표시·[주제 표현으로 바로 풀기]·떠나기) 확인.
   - LLM 이 필요한 항목은 직렬 슬롯에서 한 번에 하나(계획서 §6). 대기 화면·폴백 문구는 가짜 엔진/고정 응답으로 LLM 없이 확인한다.
6. **회귀**: 오늘 탭의 기존 상태(챌린지 없음·내 단어장 세트·수업 카드 상태 전부)가 지금과 같다 · 단어 덱 기본 동작(스와이프·FLIP·CHOICE·끝내기·결과)·단어 스모크 008 · 단위 전부 + `tsc --noEmit`·변경 파일 eslint 0.

## 파일 경계
계획서 [[phase2-batch-plan]] §2 충돌 지도 기준(계획서가 설계서보다 좁다 — 아래 중 `components/lesson/**` 참고).
- **소유**: C8 `components/vocab/**` · `components/lesson/{TodayLessonCard.tsx, logic.ts}` · `app/(app)/study/today/**`. 설계서 §11-2 는 `components/{vocab,lesson}/**` 전체로 적었지만 계획서 C8 이 아래 세 파일을 다른 WP 로 나눴다 — **계획서를 따랐다**(Leader 확인 필요 §1).
- **금지**: `components/lesson/StageUnderstand.tsx`·`useLessonPlayback.ts`(012b-4 소유) · `components/lesson/LessonEnd.tsx`(010d-B 소유) · `src/modules/**`(서버 — 041·042 몫) · `prisma/**` · `components/plan/**`·`app/(app)/plan/**`·`components/shell/routes.ts`(043 — C9) · `components/talk/**`·`components/chat/**`(C10·C11) · `docs/design/**`(Leader 단독) · `docs/demo/**`(designer) · `docs/screens.md`(designer 일괄, C18) · `tests/live/qa-session.ts`(DB0).
- **미러**: `~/.node-local/thekaiwa-044`, dev 포트 **3026**(`KAIWA_LOCAL_ROOT="$HOME/.node-local/thekaiwa-044" bash scripts/sync-local.sh`). **NFS 만 편집**, DB0 push 뒤 이 미러에서 `prisma generate` 1회. 남의 미완성 파일 때문에 `tsc` 가 깨지면 소유 밖 파일은 고치지 않고 기록 → Leader(계획서 §3 규칙 4). 종료 시 dev 서버 종료·포트 확인(`ss -ltn`), 미러 삭제는 사용자 몫. 미러 `npm run build` 허용.
- **QA 계정 3**(챌린지 레인) — 041·042·043 QA 와 시간을 나눈다(진행 중 챌린지·풀던 세트 1개 규칙 — 동시에 쓰면 서로 409). **LLM 직렬 슬롯**: 대기 중 이탈 TTFA 참고치 (다)·실제 A12 호출을 쓰는 라이브는 한 번에 하나 — 순서 위치는 **Leader 확인 필요 §2**. 화면 상태 전수(고정 응답)는 LLM 이 없어 병렬 가능.
- **커밋·배포**: 로컬 pathspec 커밋만, **push 금지**(운영 배포는 모든 WP 뒤 한 번에). APK 재빌드 불필요(웹만).

## 선행·후행
- **선행**: [[task-041-challenge-core]](#158 `TodayTasks`·#62·#51 `challenge?`) · [[task-042-topic-words-b2]](#47 `generate`·`generation`·#48·#49 `topic{…}`·#51) · **designer 구현 가이드**(설계서 §13-5 + 데모 v2). 타입·계약은 설계서 §9 로 먼저 시작 가능, 통합은 T1·T2 로컬 커밋 뒤. DB 변경 없음(서버 연동 QA 는 DB0 push 뒤).
- **후행**: 통합 QA(운영 모드 빌드) · 운영 배포 1회. 010d-B 가 `LessonEnd.tsx`·(필요 시)`TodayLessonCard` 를 이 task 로컬 커밋 뒤에 만진다([[task-010d-scenario-roleplay]]).
- **형제**: [[task-043-challenge-screens]](병렬 — 파일 겹침 없음).
- **후속(이 task 밖)**: T6 챌린지 × 시나리오 — 보류(010d-B 이후 2단계 조건부, `SnapshotKind` 추가 가능성 = 승인 밖).

## 관련 과거 이력 요약
- [[task-040-improve-challenge-design]]: 설계 정본(`docs/design/challenge.md` v2.3)과 데모 v1·v2(승인되지 않은 참고본). §13-5(47~62)가 이 화면들의 구현 가이드 변경 요구.
- [[task-008-vocab-today-words]]: 오늘의 단어 세트·덱·결과·`DeckNotice`(자정 넘김 안내)·끝내기 확인 시트 — 이 task 가 그 위에 주제 칩·출처 문구·대기 화면을 얹는다. 단어 1세트 3분 실측 127.1s.
- [[task-010-today-lesson]]: 오늘의 회화 카드(`TodayLessonCard`·`deriveLessonCard`)·#58·#59 — 챌린지 수업 상태가 카드의 주인이 되도록 덮는다.
- [[task-041-challenge-core]]·[[task-042-topic-words-b2]]: 소비하는 API 의 구현 task. [[task-043-challenge-screens]]·[[task-p2-db0-schema]]: 형제·선행 task. [[task-010d-scenario-roleplay]]: `LessonEnd.tsx`·오늘 탭 파일 후행.
- 승인된 교훈: 없음(`/이슈기록 관련` 4개 질의 0건, 2026-10-06).

## 승인 상태
- **DB**: 변경 없음(스키마 작성은 [[task-p2-db0-schema]], 승인 범위는 D1·D2·D4·D5 — 이 task 는 소비만).
- **데모**: 사용자 지시 원문(위 인용)에 따라 **데모 승인 없이 진행**한다. 구조 변경(오늘 탭 카드 규칙·대기 화면)이 있지만 designer 는 승인용 데모가 아니라 구현 가이드를 낸다(설계서 §13-5 + 승인 안 된 참고본 데모 v2). `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다(손으로 쓰지 않음). 지시 원문은 `check.mjs waive` 규칙에 걸리지 않아 정식 waived 기록이 없다 — 이력서에는 원문만 인용하고 `waived` 로 적지 않는다. 편집 전 훅은 warn 단계라 화면 파일 수정이 막히지 않지만 경고가 쌓인다.
- **운영 배포**: 모든 작업이 끝난 뒤 Leader 가 한 번에. 이 task 단독 배포·push 금지. M4·네이티브(APK) 변경 없음.
- **판정 예상(설계서 §11-2, 최종은 judge)**: R1 · standard · 데모 none(가이드만).

## 판단 기록 (judge)

## Designer 기록

- [22:47] **T4 구현 가이드 v1**(designer 신규 소환, 데모 승인 생략 지시 — 승인용 데모 없음). 승인 데모: **없음**. 시각 참조 = 승인 안 된 `docs/demo/task-040-improve-challenge-design-v2.html`(설계서 v2.2·U3 기본 B1 — **B2 문구·대기 화면·폴백 상태는 데모에 없다**, 설계서 v2.3 §4-3b·c·§13-5 + 이 가이드가 정본). 응답 모양 = `src/types/challenge.ts`(T1)·`src/types/vocab.ts`·`types/lesson.ts` additive(T1·T2 작업 트리) 그대로 [확인 — 22:36 읽음: `VocabSessionTopic{id,title,lessonCardCount,aiCardCount}`·`TopicGeneration`·`CreateSessionBody.generate`·`FinishResult.challenge`·`wrongWords[].source`·`CompleteResult.challenge`·`LessonRecommendation.reason 'CHALLENGE'`].
- 적용 토큰 이름(새 색 0): `ground` `surface` `surface2` `ink` `ink2` `ink3`(비텍스트만) `line` `accent`(채움·테·막대) `accent-soft`(배경만) `on-accent` `good` `good-soft` `warn-soft`(배경만) `bad` `bad-soft` · 키프레임 `lesson-indet`(motion-safe) · `:lang(ja)`.
- 디자인 스킬: layout·component / 자체 점검 P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 2(§10).
- T3 가이드와 같은 규칙(모양 글자 ✓◐✕·"수행 연속"·"문제 n/5"·고정 응답 방식 A)은 [[task-043-challenge-screens]] `## Designer 기록` §0 D9·§6 을 따른다. 이 task 는 `components/challenge/**`(T3) 를 import 하지 않는다(병렬 충돌 회피 — 같은 값을 `topicCopy.ts` 에 둔다).

### 0. 결정 요약 (designer 확정)

| # | 결정 | 값 | 이유 |
|---|---|---|---|
| E1 | 새 단어 대기 화면 위치 | **새 경로 `/study/today/words/new`**(`TopicSetStart`). 주제 세트를 시작하는 **모든** 곳 — 오늘 카드 [시작하기]·[한 세트 더], 세트 결과 [한 세트 더] — 이 화면을 거친다. 이미 있는 집중 화면 접두 `'/study/today/words/'` 에 걸려 하단 탭·권장 업데이트 띠가 숨는다 → **`routes.ts` 무변경**(C9 = T3) | 설계서는 "S6 [시작하기] → S7 사이 대기 화면"이라고만 했다. 세트가 아직 없어 `/words/[sessionId]` 를 쓸 수 없고, 오늘 카드 안에서 기다리게 하면 결과 화면 [한 세트 더]에도 같은 대기 UI 를 또 만들어야 한다. 한 경로면 취소·409·폴백 처리가 한 곳 |
| E2 | 시작 값 넘기기 | `sessionStorage kaiwa.vocab.topicStart` 한 건 `{v:1, topicId, title, count, mode, wordsDone, at}`(TTL 60초) → `router.push('/study/today/words/new')`. 대기 화면은 처음 렌더에서 `useRef` 에 한 번 읽고(StrictMode 이중 effect 에도 같은 값), 끝나면(성공·떠남) 지운다. 없거나 60초 지났으면 `router.replace('/study/today')` | 주소에 값을 싣지 않아 새로 고침·주소 붙여넣기로 생성 요청이 다시 나가지 않게(60초 안 새로 고침은 다시 요청 — 서버 하루 시도 3·409 가 막는다) |
| E3 | 취소(§5-2 완화책 ①) | `AbortController` — 화면 unmount(← · 휴대폰 뒤로 · 다른 주소)·[주제 표현으로 바로 풀기]·`pagehide` 에서 `abort()`. **`visibilitychange:hidden` 은 취소하지 않는다**(다른 앱을 잠깐 봐도 이어서 — 서버 벽시계 30초가 상한). 취소 뒤 늦게 온 응답은 버리고 이동하지 않는다. "떠나면 취소돼요" 문구는 쓰지 않는다(§13-5 50) | 회화 첫 대답 지연 = A12 가 남아 있을 때뿐(§5-2) |
| E4 | 409 `GENERATING` | 대기 화면과 같은 모양 + "다른 화면에서 새 단어를 만들고 있어요 · 잠시 뒤 자동으로 다시 열어요" + **3초 간격 최대 5번** 같은 요청 자동 재시도(같은 signal — 떠나면 멈춤). 5번 넘으면 [다시 시도]·[주제 표현으로 바로 풀기] | §13-5 54 "자동 재조회" |
| E5 | 덱 머리 | ① 진행 줄(`DeckProgress`) 가운데 **주제 칩** ② 그 아래 **출처 줄**(지속, 12.5px ink2, 최대 2줄) ③ **챌린지 줄**(지속, 12.5px ink, 1줄 — 챌린지 주제 세트일 때만) ④ 폴백 사유는 `DeckNotice` 새 종류 `topicReason`(#47 직후 첫 열기 한 번, 닫기 ✕) | 출처는 새로 고침 뒤에도 보여야 하고(#49 `aiCardCount`), 사유는 #47 응답에만 있다(§4-3c) |
| E6 | 결과 화면 챌린지 상자 | #51 `challenge` 가 있을 때만(방금 끝낸 세트). 다시 열면(#49 DONE) 없음 | 원천이 #51 뿐(§5-4) |
| E7 | [단어장에 넣기] | 주제 세트 결과의 **모든 카드 행**(틀린·다시 볼·전체 목록)에 버튼. #41 본문 `{surface, reading, meaning}` 3필드(품사 생략 → 서버 기본 `OTHER` [확인 `learning/vocab/words.ts:150`], 예문 없음, `enrich` 없음 = 바로 저장). 409 → "단어장에 있어요". 상태는 카드 `order` 기준 한 곳(같은 카드가 두 목록에 있어도 같은 상태) | N1 A · §13-5 61 |
| E8 | 오늘 탭 카드 모드 | #158 이 끝난 뒤 정한다 — 그 전엔 두 카드 "불러오는 중…"(깜빡임 방지). #158 실패 = **지금 화면 그대로** + 맨 위 한 줄 오류 | 챌린지 없음 = 지금 화면(완료 기준 3) |
| E9 | 회화 카드 주인 | 챌린지 LESSON 과제가 있으면 `deriveChallengeLessonCard`(새 순수 함수)가 카드를 정하고, 다른 주제 수업은 **보조 줄 하나**. 없으면 지금 `deriveLessonCard` 그대로 | §8-3 S6 ①② |
| E10 | [내 단어장으로 풀기] | 단어 카드 안 펼침(`aria-expanded`) — 지금 준비 패널(장수·방식·분류·[시작하기]) 그대로 + "챌린지에는 세지 않아요" 한 줄. 대기 화면 빈 상태에서 누르면 `sessionStorage kaiwa.vocab.openMine`(한 번) + `/study/today` → 펼친 채 | U4 — 주제 세트에 단어장을 섞지 않고 따로 |
| E11 | 수업 종료 #62 `challenge` | `LessonScreen` 이 #62 응답의 `challenge` 를 종료 상태에 함께 보관 → `LessonEnd` 통계 아래 **한 줄 상자**(`ChallengeEndLine`) + `goalMetNow` 면 토스트 1번 "오늘 챌린지 목표 달성!". 다시 들어오면(#60) 없음 | Leader ⑥(T4 소유). 010d-B 가 나중에 같은 파일을 만지므로 변경 최소 |
| E12 | 문구 단일 출처 | `components/vocab/topicCopy.ts`(오늘 띠·단어 카드·회화 카드 챌린지 문구·대기·덱·결과·수업 종료 줄). `components/lesson/lessonCopy.ts` 는 C8 밖이라 고치지 않는다 | 파일 경계 |

### 1. 레이아웃 설계 (7항목)

| 항목 | 오늘 탭 S6 | 대기 화면 | 덱 S7 | 결과 S7 |
|---|---|---|---|---|
| 목표 | 챌린지 오늘 할 일 두 개를 첫 화면에서 바로 시작 | 10~20초를 기다리게 하되 언제든 주제 표현으로 빠져나가기 | 지금 푸는 세트가 무엇이고 오늘 몇 장 남았는지 | 이번 세트가 오늘 목표에 미친 영향 + 단어장에 넣을 카드 |
| 주요 위계 | ① 챌린지 띠 ② 오늘의 단어(주제) ③ 오늘의 회화(챌린지 수업) ④ 지금 화면 나머지(복습·평가·통계·보관) | ① 무엇을 기다리나 ② 진행 표시 ③ [주제 표현으로 바로 풀기] | 카드(지금 그대로)가 주인 — 머리 줄은 작게 | ① 챌린지 상자 ② 결과 숫자(지금 그대로) ③ 주의 한 줄 ④ 카드 목록 + [단어장에 넣기] |
| 영역 | AppBar · 띠 · 카드 2장 · 지금 카드들 | BackBar · 본문(스크롤 없음) | BackBar · 진행 줄 · 출처·챌린지 줄 · DeckNotice · 카드 · 보기 · 도구 | BackBar sticky · 본문(`main` 스크롤) |
| 컴포넌트 | `ChallengeStrip` · `TopicWordsCard`(+ `MineSetPanel`) · `TodayLessonCard`(챌린지 모드) | `TopicSetStart` · `useTopicSetStart`(+ 순수 `createTopicSetStarter`) | `DeckProgress`(+칩) · `TopicDeckLines` · `DeckNotice`(+종류) · `FinishConfirmSheet`(+메모) | `ChallengeResultBox` · `WordResultList`(+넣기) · `AddToWordbookButton` |
| 상태 | §3-1 표 | §3-5 표 | §3-6 표 | §3-8 표 |
| 행동 | 주: [시작하기]·[오늘 수업 만들기] / 보조: [내 단어장으로 풀기]·[다른 주제로 수업하기]·띠 → 계획표 | 보조(처음부터): [주제 표현으로 바로 풀기] · ← | 지금 그대로 | [한 세트 더](미달일 때만) · [단어장에 넣기] · 지금 그대로 |
| 반응형 | 360: 칩이 제목 옆에서 다음 줄로 감김(`flex-wrap`), 버튼 전폭 | 1열 | 칩 `max-w-[40%] truncate`, 출처 줄 2줄 제한 | 넣기 버튼은 행 오른쪽 고정(`flex-none`), 글 열 `min-w-0` |

### 2. 5초 예산 보호 UI 규칙 (§5-2 — 회화 첫 대답이 A12 큐 때문에 늦어지는 위험)

1. **새 단어 생성(`generate:true`)은 대기 화면에서만 보낸다.** 오늘 탭을 열 때·카드를 그릴 때·덱/결과를 열 때 #47 을 미리 부르지 않는다(미리 만들기 G2~G4 없음).
2. 대기 화면을 **떠나는 모든 길이 취소**다(E3). 집중 화면이라 하단 탭이 없어 회화 탭으로 가려면 ← 를 거쳐야 하고, 그 순간 unmount → `abort()`.
3. [주제 표현으로 바로 풀기]는 **대기 UI 가 보이는 순간부터** 있다(§13-5 50) — 누르면 먼저 취소, 그다음 `generate:false`.
4. 자동 재시도는 409 `GENERATING` 하나뿐(3초 × 5, 같은 signal). 시간 초과·실패 뒤 화면이 `generate:true` 를 다시 보내지 않는다(서버가 폴백 세트를 준다 — 다음 시도는 사용자가 [한 세트 더]를 누를 때).
5. 성공하면 `router.replace` 로 덱 — 뒤로 가기가 대기 화면으로 돌아와 다시 요청하지 않게.
6. 오늘 탭·덱이 더 부르는 #158 은 LLM 0(DB 만). 회화방·채팅방 파일은 건드리지 않는다.
7. 수업 [오늘 수업 만들기]는 지금 흐름 그대로(batch 잡 — 사용자가 누른 뒤만). 회화 카드가 자동으로 만들지 않는다(U5 C3+).

### 3. 화면별 UI 구조 · 상태 · 문구 (390px 기준. 문구는 `topicCopy.ts` 단일 출처 — 따옴표 그대로. 「주제」 = `challenge.topic.title`, n = `wordCount`, need = `minAnswered`)

#### 3-1. 오늘 탭 판정 (`TodayHome` — #46·#48·#54 + #58 + **#158** 을 같은 tick 으로)

| 조건 | 띠 | 단어 카드 | 회화 카드 |
|---|---|---|---|
| #158 로딩 | 없음 | "불러오는 중…" | "불러오는 중…" |
| #158 실패 | 오류 줄(아래) | **지금 카드** | **지금 카드** |
| `challenge=null` | 없음 | 지금 카드 | 지금 카드(`reason` 이 `CHALLENGE` 면 추천 줄 "챌린지 주제예요" — §11 ⑧) |
| 진행 중·`today=null`(내일 시작) | "「주제」 챌린지 · 내일 시작해요" | 지금 카드 | 지금 카드 |
| 진행 중·WORDS 과제 있음 | 진행 띠 | **`TopicWordsCard`** | (회화 줄 참고) |
| 진행 중·WORDS 과제 없음(꺼짐) | 진행 띠 | 지금 카드 | (회화 줄 참고) |
| 진행 중·LESSON 과제 있음 | — | — | **챌린지 모드**(§3-4) |
| 진행 중·LESSON 과제 없음(꺼짐) | — | — | 지금 카드 |

#### 3-2. 챌린지 띠

**`ChallengeStrip`**(카드들 위, `Link` → `/plan`, `rounded-[14px] border border-line bg-surface px-3.5 py-2.5 min-h-14 flex items-center gap-2`, 다음 카드와 간격 12px)
- 진행 중: `b 14` "「주제」 챌린지 · {dayIndex}일째 / {N}일" + `span 12.5 ink2` "오늘 할 일 {done} / {total}" · (모양) "단어"(SHORT 면 " {answered}/{need}장") · (모양) "회화" — 꺼진 과제는 뺀다. 모양 = DONE ✓(good-soft·good) · SHORT ◐(warn-soft·ink) · 그 밖 빈 원(ink3 테), `aria-hidden`.
- 오늘 달성(`today.goalMet`): `b` "✓ 오늘 챌린지 목표 달성" + `span` "수행 연속 {stats.streak}일째 · 내일도 이어 가요"(마지막 날 "오늘 자정에 마감돼요").
- 내일 시작: `b` "「주제」 챌린지 · 내일 시작해요" + `span` "내일 오늘 탭에서 첫 과제를 해요".
- 오른쪽 `span 13 semibold` "계획표 ›". `aria-label` = 한 문장(예: "카페 주문 챌린지, 4일째 / 7일, 오늘 할 일 1 / 2, 단어 4/8장, 계획표에서 보기").
- #158 오류: `div role=alert`(bad-soft·bad) "챌린지 정보를 불러오지 못했어요. 단어·회화는 평소처럼 할 수 있어요." + [다시 시도](밑줄 44px).

#### 3-3. 오늘의 단어 카드 `TopicWordsCard`

```
Card
  div.flex.flex-wrap.items-center.gap-x-2.gap-y-1
    h2 15 semibold "오늘의 단어"
    TopicChip "챌린지 · 「주제」"   (rounded-full bg-surface2 h-6 px-2 text-[12px] font-semibold text-ink2, sr-only 앞말 "챌린지 주제: ")
    (TODO) span.ml-auto 12 ink2 "약 {estimateMinutes(n)}분"
  본문(아래 상태 표)
  Link 버튼(ulink, min-h-11, 13 semibold ink 밑줄) "내 단어장으로 풀기"  aria-expanded aria-controls="mine-panel"   ← 풀던 세트 상태 빼고 늘
  div#mine-panel (펼쳤을 때) border-t border-line mt-2 pt-3
    p 12 ink2 "내 단어장 세트는 챌린지에는 세지 않아요"
    MineSetPanel = 지금 TodayWordsCard 준비 몸통(장수·방식·분류·[시작하기]·오류) / 단어장 빈 상태 / 오늘 풀 단어 없음 — 그대로
```

| 상태(판정 순서) | 본문 |
|---|---|
| 풀던 세트가 **챌린지 주제** 세트(#48 IN_PROGRESS·`topic.id`=주제) | 지금 `inProgress` 몸통 그대로 + 출처 줄(§3-6 B 함수, 12.5 ink2) + 12 ink2 "끝내면 오늘 합계에 더해져요" · [이어서 풀기]·[여기서 끝내기] |
| 풀던 세트가 다른 것(내 단어장·다른 주제) | 지금 `inProgress` 몸통(다른 주제 세트면 그 주제 칩) + 12 ink2 "이 세트를 끝내면 챌린지 단어를 시작할 수 있어요" |
| WORDS `TODO` | p 15 semibold **"「주제」 새 단어 {n}장 · 오늘 0/{need}장"** · p 13 ink2 "AI 가 매일 새로 만들어요 · 하루에 {n}장 중 {need}장 이상 풀면 오늘 단어 완료 · 나눠 풀어도 합쳐서 세요" · p 12.5 ink2 "방식" + 공용 `Segmented`(4지선다·뒤집기 — 저장된 선택 공유) · Btn primary full **"시작하기"**(`aria-label` "「주제」 새 단어 {n}장 시작하기") — 장수 칩은 없다(장수 = 목표 장수, §4-3 ⑦) |
| WORDS `SHORT` | p 15 semibold **"오늘 {answered}/{need}장 — {need−answered}장 더 풀면 오늘 단어 완료"** · p 13 ink2 "끝낸 세트 {k}개 · 맞힘 {c} · 틀림 {w} · 건너뜀 {s}"(오늘 #48 DONE 중 이 주제 세트 합 — 없으면 줄 생략) · 메모 상자(warn-soft·ink 13, `role=note`) "**세트를 일찍 끝냈어도 괜찮아요.** 한 세트 더 풀면 오늘 푼 장수에 합쳐서 세요. 건너뛴 카드는 다음 세트에 다시 나올 수 있어요." · 방식 `Segmented` · Btn primary full **"한 세트 더"** |
| WORDS `DONE` | p 15 semibold "✓ 오늘 단어 완료" · p 13 ink2 "{k≥2 ? `${k}세트 합쳐 ` : ''}{answered}장 풂({need}장 이상) · 맞힘 {c}" · Btn ghost full "한 세트 더" |
| WORDS `IN_PROGRESS`(서버는 풀던 세트를 아는데 #48 에 없을 때 — 방어) | "풀던 세트가 있어요" + Link primary "이어서 풀기" → `/study/today/words/{sessionId}` |
| 로딩·오류 | 지금 카드와 같음 |

- 장수별 문구(§13-2 18): 5장 목표 → "「주제」 새 단어 5장 · 오늘 0/4장" · "하루에 5장 중 4장 이상 풀면…" · "오늘 2/4장 — 2장 더 풀면 오늘 단어 완료" / 10장 → "…0/8장" · "…8장 이상…" · "오늘 4/8장 — 4장 더 풀면 오늘 단어 완료". 15장은 시드 주제에서 고를 수 없어 해당 없음.
- §13-5 49 의 "오늘 이미 만들었으면 '오늘 새 단어 n장 남음 · 오늘 m/8장'"은 **원천이 없어 그리지 않는다**(§11 ②) — T1 이 `ChallengeWordsTask.aiLeft?` 를 더하면 TODO·SHORT 의 첫 줄을 "오늘 새 단어 {aiLeft}장 남음 · 오늘 {answered}/{need}장"으로(값이 있을 때만).
- [시작하기]·[한 세트 더] = `startTopicSet()`: E2 토큰(`count` = `wordCount`, `mode` = 저장된 방식, `wordsDone` = state==='DONE') → `router.push('/study/today/words/new')`. 두 번 눌러도 한 번(ref).
- 풀던 세트 카드의 주제 칩·"지난 수업 표현 n개 포함"(§8-3 S6 끝) = #48 항목 `topic`(`TodayHome.tsx:92-105` 의 #49 방어 조회도 같은 `session.topic`) — 새로 고침 뒤에도 같은 값.

#### 3-4. 오늘의 회화 카드 — 챌린지 모드 (`TodayLessonCard` + `lesson/logic.ts deriveChallengeLessonCard`)

`deriveChallengeLessonCard(state58, today58, lessonTask, challenge)` → `{ kind, lesson?, other?, aux }` (순수, 단위 테스트):

| 순서 | 조건 | kind | 카드 |
|---|---|---|---|
| 0 | #58 로딩 / 실패 | `loading` / `error` | 지금과 같음 |
| 1 | `lessonTask.state=GENERATING` | `gen` | p 15 semibold "수업을 만들고 있어요" · p 13 ink2 "「주제」 · 1분쯤 걸려요. 다 되면 여기서 열 수 있어요." · 움직이는 막대(`lesson-indet`, `aria-hidden`) + `sr-only role=status` "수업을 만드는 중이에요" · Btn ghost "보러 가기" → `/study/today/talk/{lessonId}`. 잡 감시 = #58 같은 id 항목의 `jobId` ?? `lessonTask.jobId`(5초, `useJobWatch`) → 끝나면 #58·#158 다시 읽기 |
| 2 | `lessonTask.state=TODO` && #58 오늘 새 수업 중 **다른 주제(또는 붙여넣기)가 GENERATING** | `busy` | p 15 semibold "다른 수업을 만들고 있어요" · p 13 ink2 "「{그 주제 | 붙여넣은 문장}」 · 1분쯤 걸려요. 다 되면 여기서 열 수 있어요." · 막대 · 정보 상자(surface2 13) "챌린지 주제(「주제」) 수업은 이 수업이 다 된 뒤에 [오늘 수업 만들기]로 만들 수 있어요." · Btn ghost "보러 가기" → 그 수업. 잡 감시 = 그 수업 `jobId` |
| 3 | `TODO` | `make` | [보조 줄] · 추천 상자(surface2 rounded-xl px-3 py-2.5): 12 ink2 "챌린지 주제" + Badge(bg-surface) `level` / 15 semibold "「주제」" / 12 ink2 r3 · Btn primary full mt-3 **"오늘 수업 만들기"**(`aria-label` "「주제」 오늘 수업 만들기", busy "만드는 중…") = `useLessonCreate().create({topicId})` · p 12 ink2 "누르면 1분쯤 걸려요 · 주제는 챌린지 주제로 정해져 있어요" · Link ulink "다른 주제로 수업하기"(→ `/study/today/talk/new`, `aria-label` "다른 주제로 수업하기, 챌린지에는 세지 않아요"). r3 = dayIndex≤1 "챌린지 첫 수업이에요" / #58 `recommendation.reason='CHALLENGE'`·같은 주제·`nextPreview` 있음 "챌린지 {dayIndex}일째 · 지난 시간 예고 · {nextPreview.titleKo}" / 그 밖 "챌린지 {dayIndex}일째" |
| 4 | `READY` | `ready` | p 15 semibold "수업이 준비됐어요" · p 13 ink2 "「주제」 · 5단계 · 약 15분" · `MiniSteps done=0` · Btn primary "시작하기" |
| 5 | `IN_PROGRESS` | `progress` | p 15 semibold "하던 수업이 있어요" · p 13 ink2 `HOME.progressBody(주제, '오늘', stageDone)` · `MiniSteps` · 다음 단계 줄 · Btn primary "이어서 하기"(stageDone = #58 같은 id 항목) |
| 6 | `CONTINUE` | `continue` | p 15 semibold "어제 만든 챌린지 수업이 있어요" · p 13 ink2 "「주제」 · {M월 D일} 시작 · 5단계 중 {n}단계 끝냄"(#58 `resume` 이 같은 id 일 때 — 아니면 날짜·단계 줄 없이 "「주제」") · `MiniSteps` · p 12 ink2 "다음은 {단계}예요. 단계마다 저장돼요. 오늘 끝내면 오늘({dayIndex}일째) 회화로 세요." · Btn primary "이어서 하기" |
| 7 | `FAILED`(죽은 잡 포함) | `fail` | p 15 semibold "수업을 만들지 못했어요" · p 13 ink2 "「주제」 · 다시 만들면 대부분 잘 만들어져요." · Btn primary "다시 만들기"(`create({topicId})`) · Link ulink "다른 주제로 수업하기" |
| 8 | `DONE` | `done` | p 15 semibold "✓ 오늘 수업을 끝냈어요" · p 13 ink2 `HOME.doneBody(주제, correctFromScore(score), speaking)`(#58 같은 id 항목) · [다음 시간엔] 상자(accent-soft, 지금과 같음 — `nextPreview` 있을 때) · Btn ghost "다음 수업 만들기"(`create({topicId})`) · p 12 ink2 "오늘 회화 목표는 이미 채웠어요" · 밑줄 버튼 "끝낸 수업 결과 보기" |

- 머리: h2 "오늘의 회화" + 칩 "챌린지 · {dayIndex}일째"(`flex-wrap`).
- **보조 줄**(모든 kind 위, 하나만 — 열림 > 끝냄 순): #58 오늘 새 수업 중 `topic?.id ≠ 챌린지 주제`(붙여넣기 포함)인 것 + `resume`(id ≠ `lessonTask.lessonId`)
  - 열림(READY·IN_PROGRESS 또는 그 `resume`): `div rounded-xl border border-line px-3 py-2 flex items-center gap-2` — p 13 "「{t}」 수업이 열려 있어요 · 5단계 중 {n}단계 · 챌린지에는 세지 않아요" + Btn ghost h-11 px-3 "이어서 하기"(`aria-label` "「{t}」 수업 이어서 하기")
  - 끝냄(DONE): p 13 "✓ 오늘 「{t}」 수업 끝냄 · 문제 {c}/5 · 챌린지에는 세지 않아요"(버튼 없음)
  - {t} = 주제 제목, 없으면 "붙여넣은 문장"(`PASTED_TOPIC`).
- [오늘 수업 만들기] 는 **앱에서 이 카드에만** 있다(N3 A). 409 는 `useLessonCreate` 지금 처리 그대로(그 수업으로 이동) — 대부분은 `busy` 판정이 먼저 막는다.

#### 3-5. 대기 화면 `/study/today/words/new` — `TopicSetStart`

```
div.flex.h-full.min-h-0.flex-col.bg-ground
  BackBar backHref="/study/today" backLabel="오늘로" title="오늘의 단어" subtitle="「주제」 · {방식} · {n}장"
  div.px-4.pt-8  (스크롤 없음 — 내용이 짧다)
     상태별 본문(아래)
  p.sr-only role=status aria-live=polite  (상태 바뀔 때 한 번씩)
```

| 상태 | 본문 |
|---|---|
| `quiet`(요청 뒤 0.6초까지) | 보이는 것 없음 + sr "세트를 만드는 중…" — 두 번째 세트·바로 풀기·재사용은 대개 이 안에 끝나 덱으로 간다(깜빡임 없음) |
| `gen`(0.6초~) | h2 17 bold `tabIndex=-1`(이때 초점) **"오늘의 「주제」 새 단어를 만들고 있어요"** · p 14 ink2 **"보통 10~20초 걸려요"** · 진행 막대(h-1 rounded-full bg-surface2 + 안 w-2/5 bg-accent `motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]`, `aria-hidden`; reduced-motion = 멈춘 막대) · p 12 ink2 tabular `aria-hidden` 경과 "0:12" · Btn ghost full mt-6 **"주제 표현으로 바로 풀기"** · p 12 ink2 "새 단어 없이 「주제」 기본 표현과 지난 수업 표현으로 바로 풀어요" |
| `gen` 20초~ | 둘째 줄만 "조금 더 걸리고 있어요 · 늦어지면 「주제」 표현으로 바로 이어서 풀어요"(sr 한 번) — 30초 무렵 서버가 폴백 세트를 주면 그대로 덱 |
| `skipping` | 바로 풀기 버튼 busy "만드는 중…"(`aria-busy`), 앞 요청은 이미 취소 |
| `busy409` | h2 "다른 화면에서 새 단어를 만들고 있어요" · p "잠시 뒤 자동으로 다시 열어요" · 막대 · [주제 표현으로 바로 풀기] — 5번 실패 뒤 p "아직 만들고 있어요. 잠시 뒤 다시 시도해 주세요." + BtnRow [다시 시도](primary) [주제 표현으로 바로 풀기](ghost) |
| `error`(네트워크·5xx) | 오류 상자 "세트를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." + BtnRow [다시 시도] [주제 표현으로 바로 풀기] + Link 밑줄 "오늘로" |
| `rate`(429) | 같은 모양 "세트를 너무 자주 만들었어요. 잠시 뒤 다시 시도해 주세요." |
| `allDone`(`empty.reason=TOPIC_ALL_DONE_TODAY`) | Card: p 15 semibold "오늘 이 주제 표현을 모두 풀었어요" · p 13 ink2 "{wordsDone ? '오늘 단어는 이미 완료예요. ' : ''}오늘 푼 표현은 내일 다시 나와요." · BtnRow [내 단어장으로 풀기](primary — E10) [오늘로](ghost) |
| `topicEmpty`(`TOPIC_EMPTY`) | 같은 모양 "이 주제에는 아직 풀 표현이 없어요." |
| 409 `{sessionId}`(풀던 세트) | 화면 없이 `putSession(flash, "풀던 세트가 있어요. 이어서 풀거나 끝내 주세요.")` + `router.replace('/study/today')` |
| 성공 | `putSession(VOCAB_KEYS.notice(id), downgraded ? 'few' : '')` + `putSession(VOCAB_KEYS.topicGen(id), JSON(generation))` → `router.replace('/study/today/words/{id}')` |
| 토큰 없음·만료 | `router.replace('/study/today')` |

- 흐름: 처음 렌더 → 토큰(ref) → `POST /api/v1/vocab/sessions {topicId, count, mode, generate:true}`(`signal`) → 위 표. [주제 표현으로 바로 풀기] = `abort()` 뒤 새 컨트롤러로 `{…, generate:false}`.
- 테스트 가능하게 상태 기계를 순수 모듈로: `components/vocab/topicSetStart.ts` `createTopicSetStarter({ post, setTimer, clearTimer, onState })` → `{ start(), skip(), dispose() }`. `useTopicSetStart` 는 이것을 감싸 `dispose` 를 effect 정리에 둔다. 단위 테스트: `dispose()` → 진행 중 signal `aborted=true` · `skip()` → 먼저 abort 후 `generate:false` 1번 · 409 GENERATING → 3초 간격 ≤5번 · `dispose` 뒤 도착한 성공 → `onState` 호출 0 · 0.6초 타이머 · 20초 문구.

#### 3-6. 덱 머리 (`VocabDeck` — 세션 `topic≠null` 일 때만, 내 단어장 세트는 지금 그대로)

```
BackBar subtitle="「주제」 · {방식} · {n}장"
DeckProgress   "3 / 10"  [주제 칩 max-w-[40%] truncate, sr 앞말 "주제: "]  "남은 7장 · ★ 1"
TopicDeckLines flex-none px-4 pt-1.5
   B  p 12.5 ink2 leading-snug line-clamp-2   출처 줄(아래 함수)
   C  p 12.5 ink font-medium tabular mt-0.5   챌린지 줄(아래, 조건이 맞을 때만)
DeckNotice?    (기존 자리·우선순위: few/deleted > topicReason > fewer > resume > pastDate)
```
**B 출처 줄** `topicSourceLine(topic, cardCount, generation | null)`(순수):

| 조건 | 문구 |
|---|---|
| `generation` 있음 && `!generatedNow` && `aiCardCount>0`(오늘 만든 단어 재사용 — 두 번째 세트) | "오늘 만든 새 단어 중 안 푼 {ai}장{rest>0 ? ` + 「주제」 표현 ${rest}장` : ''} · AI 가 만든 단어는 틀릴 수 있어요" (기준 예시 "오늘 만든 새 단어 중 안 푼 6장 + 「카페 주문」 표현 4장") |
| `aiCardCount = cardCount` | "「주제」 새 단어 {n}장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요" |
| `0 < aiCardCount < cardCount` | "새 단어 {ai}장 + 「주제」 표현 {n−ai}장 · AI 가 만든 단어는 틀릴 수 있어요" |
| `aiCardCount = 0` | "「주제」 표현으로 만든 오늘의 단어 {n}장{lessonCardCount≥1 ? ` · 지난 수업 표현 ${lc}개 포함` : ''}" — "AI 가 새 단어를 만들었어요" 류 금지 |
- `rest` = cardCount − ai. 카드마다 출처 표시는 하지 않는다(§13-5 53).

**`DeckNotice` 새 종류 `topicReason`**(#47 직후 첫 열기 — `VOCAB_KEYS.topicGen(id)` 를 읽고 지움):

| `generation.reason` | 알림 |
|---|---|
| `TIMEOUT`·`FAILED`·`INVALID` | "오늘은 새 단어를 만들지 못해 「주제」 표현으로 골랐어요 · 다음 세트에서 다시 만들어 볼게요" |
| `LIMIT` | "오늘 새 단어 만들기는 여기까지예요 · 「주제」 표현으로 골랐어요" |
| `NEW_DONE` && `aiCardCount=0` | "오늘 새 단어는 다 풀었어요 — 「주제」 표현으로 이어서 풀어요" |
| `SHORT`·`SKIPPED`·`null`·(`NEW_DONE`·ai>0) | 없음(B 줄이 말한다) |
- 주제 세트일 때 기존 알림 문구: `few` → "뜻이 서로 다른 표현이 4개보다 적어서 이번엔 뒤집기 카드로 풀어요." · `fewer` → "오늘 풀 수 있는 이 주제 카드가 {n}장이라 {n}장으로 만들었어요." · `resume`·`pastDate` 그대로.

**C 챌린지 줄** `deckChallengeLine(tasks, session, here)`(순수 — `tasks` = 덱이 열릴 때 #158 한 번 더 읽은 `today`, `here` = 이 세트에서 지금까지 답한 수, `base` = WORDS `answered`, `run` = base + here):

| 조건 | 문구 |
|---|---|
| 챌린지 없음·#158 실패·WORDS 꺼짐·`session.topic.id ≠ 챌린지 주제` | 줄 없음 |
| `session.date ≠ tasks.date`(지난 날 시작한 세트) | "챌린지 · {M월 D일}에 시작한 세트라 그날({k}일째) 단어로 세요"(k = dayIndex − 날 차이, k<1 이면 줄 없음) |
| WORDS `DONE` | "챌린지 · 오늘 단어는 이미 완료 · 더 풀면 오늘 합계에 더해져요" |
| `run ≥ need` | "챌린지 · 오늘 {run}장 풂 · 이 세트를 끝내면 오늘 단어 완료" |
| `base=0 && here=0` | "챌린지 · {need}장 이상 풀면 오늘 단어 완료" |
| 그 밖 | "챌린지 · 오늘 {run}/{need}장 — {need−run}장 더 풀면 완료" (두 번째 세트 첫 화면 = "오늘 4/8장 — 4장 더 풀면 완료") |
- 줄은 `aria-live` 가 아니다(카드마다 읽히면 소란) — 지금 덱 알림(`announce`)만 쓴다. `[여기서 끝내기]` 시트에서 같은 값을 문장으로 알린다(§3-7).
- **높이 예산**: B 최대 2줄 + C 1줄 ≈ 56px 추가. 412×780·390×800 에서 스크롤 0 유지가 완료 기준(지금 예산 ≈640 + 56 + 알림 44 ≈ 740 < 780 [추측 — 실측 필요]). 넘치면 B 를 `line-clamp-1` 로 줄인다(글 전체는 스크린 리더에 그대로).

#### 3-7. 끝내기 확인 시트 (`FinishConfirmSheet` 에 선택 prop `challengeNote`)

| 조건(C 줄과 같은 입력, after = base + 이 세트 답한 수) | 메모 |
|---|---|
| 답 0장 | p 13 ink2 "오늘 단어는 {DONE ? '이미 완료' : `${base}/${need}장`} 그대로예요." |
| 지난 날 세트 | p 13 ink2 "이 세트는 {M월 D일}에 시작해서 그날 기록으로 남아요." |
| WORDS DONE | p 13 ink2 "오늘 단어는 이미 완료예요. 이 세트도 오늘 합계에 더해져요." |
| after ≥ need | p 13 ink2 "이 세트까지 오늘 {after}장 풀었어요 — 오늘 단어는 완료로 세요." |
| after < need | 메모 상자(warn-soft·ink, `role=note`) "**지금 끝내면 오늘 단어는 {need}장 중 {after}장 — ‘일부’로 남아요.** 남은 표현으로 한 세트 더 풀 수 있어요." |
| 챌린지 줄 없음 조건 | 메모 없음(지금 시트 그대로) |

#### 3-8. 세트 결과 (`VocabResult` — 주제 세트 `session.topic≠null`)

- BackBar subtitle "{날짜} · {방식} · {n}장 · 「{세트 주제}」".
- **챌린지 상자**(`ChallengeResultBox`, 결과 숫자 카드 위, #51 `challenge` 가 있을 때만 — `resultChallengeView(challenge, thisAnswered, todayKey)`, thisAnswered = 이 세트 맞힘+틀림, ans = `words.answered`, need = `words.need`):

| 조건(위가 이김) | 모양 | 문구 | 링크 |
|---|---|---|---|
| `goalMetNow` && date = 오늘 | ✓(good-soft·good) 상자 `role=status` | b "오늘 챌린지 목표 달성!" · 13 ink2 "「주제」 챌린지 {dayIndex}일째 · 오늘 단어 {ans}장 풂({need}장 이상)" | "챌린지 ›" → `/plan/challenge/{challengeId}` |
| `goalMetNow` && date < 오늘(소급) | ✓ 상자 `role=status` | b **"어제 목표도 채웠어요"** · "{M월 D일}({dayIndex}일째) · 이 세트는 시작한 날로 세서 그날 목표를 채웠어요" | "계획표 ›" → `/plan` |
| date = 오늘 && ans ≥ need && ans − thisAnswered < need && !goalMet(이 세트가 단어를 채움, 회화 남음) | ◐(warn-soft·ink) 상자 | b "오늘 단어 완료 · 챌린지 오늘 할 일 1 / 2" · "{ans}장 풂({need}장 이상) · 오늘의 회화가 남았어요" | "회화 ›" → `/study/today` |
| date = 오늘 && ans < need | 메모 상자(warn-soft·ink) | b "오늘 {ans}/{need}장 — {need−ans}장 더 풀면 오늘 단어 완료예요." · "이 세트는 ‘일부’로 남고, 한 세트 더 풀면 합쳐서 세요." + Btn primary h-11 **"한 세트 더"**(E1 경로, 같은 주제·`requestedCount`·방식) | — |
| date = 오늘 && `goalMet` && !goalMetNow | 정보 상자(surface2) | "오늘 목표는 이미 채웠어요 · 이 세트도 오늘 합계에 더해졌어요(푼 {ans}장)" | — |
| date = 오늘 && ans − thisAnswered ≥ need && !goalMet | 정보 상자 | "오늘 단어는 이미 완료예요 · 이 세트도 오늘 합계에 더해졌어요(푼 {ans}장) · 오늘의 회화가 남았어요" | "회화 ›" |
| date < 오늘 && !goalMetNow | 정보 상자 | "{M월 D일}({dayIndex}일째) 기록으로 남았어요 · 그날 단어 {ans}/{need}장" | — |
| `challenge=null`(다른 주제·내 단어장·꺼진 과제·자정 마감 뒤·진행 중 없음) | 없음 | — | — |
- "오늘 단어 완료" 글은 **합계를 채운 그 세트**(1·3행)에만. 목표 달성 알림은 `goalMetNow` 일 때 한 번(두 세트 날: 첫 세트 결과 = 4행, 둘째 = 1행). 익힘 증가분("익힘 7 → 8")·"표현 12개 자세히" 칩은 **그리지 않는다**.
- **주의 한 줄**(결과 숫자 카드 바로 아래 p 12.5 ink2, 주제 세트만): `aiCardCount>0` → "AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요 · 단어장에는 [단어장에 넣기]를 누른 단어만 들어가요" / 0 → "단어장에는 [단어장에 넣기]를 누른 표현만 들어가요".
- **카드 목록**(`WordResultList` prop `topicSet`·`addState`·`onAdd`): 제목 "틀린 단어 n" → 주제 세트는 "틀린 카드 {n}" + 옆 12 ink2 "단어장에 넣어 두면 내 단어장 세트에도 나와요". 주제 세트 행은 링크가 아니고 "지운 단어" 배지를 달지 않는다(주제 카드는 원래 `wordId` 가 없다 — 판별은 `session.topic≠null`, U4 로 주제 세트에는 단어장 카드가 없음). 행 오른쪽 `AddToWordbookButton`(flex-none):
  - 기본: Btn ghost `h-11 px-3 text-[13px]` "단어장에 넣기"(`aria-label` "{표기} 단어장에 넣기")
  - 넣는 중: `aria-busy` "넣는 중…"
  - 성공: `span role=status` 13 semibold good "✓ 넣었어요"
  - 409: `span role=status` 13 ink2 "단어장에 있어요"
  - 실패: 버튼 그대로 + 토스트 "단어장에 넣지 못했어요. 잠시 뒤 다시 눌러 주세요."
  - 본문 = `{surface: card.surface, reading: card.reading ?? undefined, meaning: card.correctText ?? card.meaning}` — 뜻이 비면 버튼을 그리지 않는다. 넣지 않은 카드는 단어장에 없다(자동 추가 0).
- [보관]·[다시 풀기]·[오늘로]·[단어장 보기] 그대로(다시 풀기 = 주제 세트 — 칩·출처 줄 같은 값).
- 다시 열기(#49 DONE)·새로 고침: 챌린지 상자 없음, 주의 줄·넣기 버튼은 있음.

#### 3-9. 수업 종료 줄 (`LessonScreen.complete` → `LessonEnd`, 새 `components/lesson/ChallengeEndLine.tsx`)

- `LessonScreen`: #62 응답 `r.challenge ?? null` 을 `onEnded` 에 셋째 인자로 넘겨 종료 상태에 보관, `LessonEnd` prop `challenge` 로. `goalMetNow` 면 `show('오늘 챌린지 목표 달성!')` 한 번(종료 화면 제목 초점 뒤 — `setTimeout 0`).
- `LessonEnd`: 통계 3칸 바로 아래 `<ChallengeEndLine challenge topicTitle={lesson.topic?.title}/>` 한 줄만 추가(010d-B 와 겹침 최소 — 010d-B 의 `LessonScenarioCard` 는 다음 수업 카드 아래·[이어서 말하기] 위 자리라 겹치지 않는다 [확인 — [[task-010d-scenario-roleplay]] 3-I·650행]).

| 조건 | 상자(rounded-[14px] border border-line bg-surface p-3.5 flex gap-3) |
|---|---|
| `goalMetNow` | ✓ 원(good-soft·good) · b 15 "오늘 챌린지 목표 달성!" · 13 ink2 "「주제」 챌린지 {dayIndex}일째 · 오늘 할 일을 다 했어요" · Link "챌린지 ›" → `/plan/challenge/{challengeId}` |
| `goalMet` && !goalMetNow | ✓ 원 · b 14 "챌린지 {dayIndex}일째 · 오늘 목표는 이미 채웠어요" · Link "챌린지 ›" |
| !goalMet | ◐ 원(warn-soft·ink) · b 14 "챌린지 {dayIndex}일째 · 회화 완료" · 13 ink2 "오늘의 단어가 남았어요" · Link "오늘 탭 ›" → `/study/today` |
| `challenge=null`(복습·붙여넣기·다른 주제·다시 들어옴) | 그리지 않음 |

### 4. 데이터 출처 ↔ 화면 값

| 화면 값 | 원천 | 비고 |
|---|---|---|
| 띠·카드 모드 | #158 `challenge`·`today.tasks[]`·`today.goalMet`·`stats.streak` | §3-1 |
| "오늘 m/need장" | WORDS `answered`·`minAnswered` | 끝낸 세트 합계 |
| 단어 카드 세트 합(맞힘·틀림·건너뜀·세트 수) | #48 오늘 DONE 세트 중 `topic.id`=주제 합 | 표시만(판정은 #158) |
| 풀던 세트 칩·출처 | #48 `topic`(+#49 방어 조회 `session.topic`) | |
| 회화 카드 주인 | #158 LESSON `state`·`lessonId`·`jobId` | |
| 회화 단계·점수·보조 줄 | #58 `todayLessons[]`(같은 id / 다른 주제)·`resume`·`recommendation` | |
| 대기 화면 분기 | #47 응답 `session`·`generation`·`empty`, 오류 409 `reason`/`sessionId`·429 | |
| 덱 출처 줄 | 세션 `topic.aiCardCount`·`lessonCardCount`·`cardCount` + (첫 열기) 저장한 `generation` | |
| 덱 사유 알림 | 저장한 `generation.reason`(#47 직후만) | |
| 덱 챌린지 줄 | 덱이 연 #158 `today` + 덱이 아는 이 세트 답 수 | |
| 결과 챌린지 상자 | #51 `challenge{date, dayIndex, goalMet, goalMetNow, words{answered, need}}` | 방금 끝냈을 때만 |
| 결과 주의 줄 | 세션 `topic.aiCardCount` | |
| [단어장에 넣기] | 카드 `surface`·`reading`·`correctText`/`meaning` → #41 | 409 = 있음 |
| 수업 종료 줄 | #62 `challenge` + `lesson.topic.title` | |

### 5. 상태 관리

- `TodayHome`: `useTodayChallenge(tick, lessonTick)`(#158 — `{state, data}`, 실패 시 지난 값 유지 안 함) 를 #58 과 같은 tick 으로. 수업 만들기·잡 끝남(`onReload`)은 #58·#158 을 함께 다시 읽는다. 화면 복귀(`visibilitychange`) 때 지금처럼 전부.
- 저장소 키(`components/vocab/hooks.ts` `VOCAB_KEYS` 에 추가, 전부 `putSession`/`takeSession`): `topicStart`(E2) · `topicGen: (id) => kaiwa.vocab.topicGen.{id}`(E5) · `openMine`(E10). flash 문구는 `labels.ts FLASH` 에 "풀던 세트가 있어요. 이어서 풀거나 끝내 주세요."(이미 `finishFirst` 와 같으면 재사용).
- `useVocabDeck`: 처음 불러올 때 `takeSession(topicGen(id))` → 상태 보관(사유 알림·재사용 문구용) · 세션이 주제 세트면 #158 한 번 읽어 `challengeToday` 보관(실패 = null) · #51 결과의 `challenge` 는 이미 `finishResult` 에 있음.
- `VocabResult`: `addState: Record<order, 'idle'|'busy'|'added'|'exists'>`(메모리 — 새로 고침 뒤 다시 누르면 409 → "단어장에 있어요").
- 순수 함수(`components/vocab/topicLogic.ts`, `today` 주입): `wordsCardModel` · `stripModel` · `topicSourceLine` · `topicReasonNotice` · `deckChallengeLine` · `finishChallengeNote` · `resultChallengeView` · `addBody(card)` / `components/lesson/logic.ts`: `deriveChallengeLessonCard`·`auxLessonLine`.

### 6. 고정 응답(QA) — T3 와 같은 **A 안**(Playwright `context.route` 로 #158·#58·#48·#49·#47·#51·#41·#62 바꿔치기)

- 대기 화면은 `route` 안에서 일부러 늦게 `fulfill`(예: 15초)·`page.on('requestfailed')` 로 떠날 때 `net::ERR_ABORTED` 확인 · 409 GENERATING 은 처음 2번 409 → 셋째 200.
- 상태 id: S6 `s6.none` · `s6.cerr` · `s6.loading` · `s6.tomorrow` · `s6.todo` · `s6.w1`(단어 끝·회화 남음) · `s6.t1`(회화 끝·단어 남음) · `s6.short`(1/8·4/8) · `s6.done` · `s6.twodone` · `s6.wip`(풀던 주제 세트) · `s6.mineip`(풀던 내 단어장 세트) · `s6.mineopen` · `s6.gen` · `s6.busy` · `s6.ready` · `s6.lip` · `s6.cont` · `s6.fail` · `s6.other`(다른 주제 끝냄) · `s6.otheropen` · `s6.otherresume`(어제 만든 다른 주제) · `s6.wordsonly` · `s6.lessononly` · `s6.recCh`(챌린지 회화 꺼짐 + 추천 CHALLENGE)
- 대기 `w.quiet` · `w.gen` · `w.gen20` · `w.skip` · `w.busy409` · `w.busy409-giveup` · `w.err` · `w.rate` · `w.ip409` · `w.alldone` · `w.alldone-short` · `w.topicempty` · `w.notoken` · `w.leave`(← → abort 확인)
- 덱 `d.ai` · `d.mixed` · `d.reuse`(6+4) · `d.timeout` · `d.failed` · `d.invalid` · `d.limit` · `d.skipped`(+지난 수업 표현 3) · `d.newdone` · `d.reopen`(#49 — 사유 알림 없음) · `d.fewer` · `d.flip` · `d.base4`("오늘 4/8장"부터) · `d.met` · `d.pastdate` · `d.other`(챌린지 줄 없음) · `d.fin-zero` · `d.fin-short` · `d.fin-fill` · `d.fin-done`
- 결과 `r.metnow` · `r.wordsdone` · `r.short` · `r.already` · `r.wordsalready` · `r.retro` · `r.pastday` · `r.null` · `r.added` · `r.exists` · `r.addfail` · `r.b1`(주의 줄 B1 문구) · `r.reopen`(상자 없음)
- 수업 종료 `le.metnow`(토스트) · `le.met` · `le.left` · `le.null`

### 7. 생성/수정 파일 · 구현 순서

| 구분 | 파일 |
|---|---|
| 신규 `components/vocab/` | `topicCopy.ts` · `topicLogic.ts` · `topicSetStart.ts`(순수 상태 기계) · `useTopicSetStart.ts` · `TopicSetStart.tsx` · `ChallengeStrip.tsx` · `TopicWordsCard.tsx` · `TopicDeckLines.tsx` · `ChallengeResultBox.tsx` · `AddToWordbookButton.tsx` · `useTodayChallenge.ts` · `__tests__/topicLogic.test.ts` · `__tests__/topicSetStart.test.ts` |
| 수정 `components/vocab/` | `TodayHome.tsx`(#158·띠·카드 분기·시작 함수·openMine) · `TodayWordsCard.tsx`(준비 몸통을 `MineSetPanel` 로 export — 동작 그대로) · `VocabDeck.tsx`(머리 줄·시트 메모) · `DeckProgress.tsx`(칩) · `DeckNotice.tsx`(+`topicReason`·주제 문구) · `deck.ts`(`pickNotice` 우선순위·주제 문구) · `useVocabDeck.ts`(`topicGen`·#158) · `FinishConfirmSheet.tsx`(`challengeNote`) · `VocabResult.tsx`(상자·주의·넣기·[한 세트 더]) · `WordResultList.tsx`(`topicSet`·넣기) · `hooks.ts`(키) · `labels.ts`(FLASH) |
| 수정 `components/lesson/` | `TodayLessonCard.tsx`(챌린지 모드 + 기본 카드 `CHALLENGE` 추천 줄) · `logic.ts`(`deriveChallengeLessonCard`·`auxLessonLine`) · `LessonScreen.tsx`(`complete` → `challenge` 보관·토스트 — Leader ⑥) · `LessonEnd.tsx`(prop 1 + 한 줄 — Leader ⑥) · 신규 `ChallengeEndLine.tsx` · `__tests__/lessonLogic.test.ts`(챌린지 케이스) |
| 신규 `app/(app)/study/today/` | `words/new/page.tsx`(auth → `TopicSetStart`) |
| 소비만 | `types/challenge.ts`·`types/vocab.ts`·`types/lesson.ts`(T1·T2) |

순서: ① `topicCopy`·`topicLogic`·`topicSetStart` + 단위 테스트(출처 조합 전부·abort·`deriveChallengeLessonCard`·덱 머리 장수·목표 장수별 문구·`goalMetNow` 한 번) → ② `useTodayChallenge`·`ChallengeStrip`·`TopicWordsCard`·`MineSetPanel` 추출 → ③ 회화 카드 챌린지 모드 → ④ 대기 경로·화면 → ⑤ 덱 머리·알림·시트 메모 → ⑥ 결과 상자·주의·넣기 → ⑦ 수업 종료 줄(T4 커밋 뒤 010d-B 가 `LessonEnd` 를 만진다) → ⑧ `tests/live` 고정 응답 스크립트 + 3폭 + (T1·T2 머지 뒤) 라이브.

### 8. 360 / 390 / 412 × 780 / 892 · 접근성 체크리스트

- [ ] 오늘 탭 첫 화면(780): 띠 + 단어 카드 [시작하기]까지 보임(412·390·360). 회화 카드 [오늘 수업 만들기]는 스크롤 한 번 안(첫 화면 밖이어도 됨 — 지금과 같음).
- [ ] 덱 412×780·390×800 스크롤 0(머리 줄 추가 뒤 — §3-6 높이 예산), 360×780 은 B 1줄 강등 허용.
- [ ] 가로 넘침 0(긴 주제 이름 칩 `truncate`, 글 `min-w-0`·`[overflow-wrap:anywhere]`) · 화면당 스크롤 1곳 · 대기 화면 스크롤 없음.
- [ ] 터치 ≥44: [내 단어장으로 풀기]·[다른 주제로 수업하기]·[이어서 하기](보조 줄)·[단어장에 넣기]·[주제 표현으로 바로 풀기]·띠 전체(56).
- [ ] 일본어 16px↑ 그대로(덱·결과 카드 — 지금 부품). 주제 이름은 한국어(`title`). 히라가나·한글·번역 표시는 지금 부품(`JaText`·`HangulLine`·`useWordLayersList`)이 앱 설정을 따른다 — 새 일본어 글 없음.
- [ ] 상태는 글자+모양(✓◐ + 문장), 색만 금지 · `accent`·`warn` 글자 0 · `ink3` 글자 0.
- [ ] 대기 화면: 대기 UI 가 뜰 때 h2 초점 · `role=status` 문장(0.6초·20초·409·오류에서 한 번씩) · 버튼 `aria-busy` · reduced-motion 막대 정지 · 경과 숫자 `aria-hidden`.
- [ ] 넣기 결과 `role=status` · 펼침 `aria-expanded`·`aria-controls` · 칩 sr 앞말.
- [ ] 다크 390×892 한 장 · 엔진명·모델명·task/Phase 번호 0(화면 글 grep — "AI" 까지만).

### 9. 주의사항 · 그리지 않는 것

- 그리지 않음: 새 단어 예문(E2 — 카드에 칸 없음, 결과·덱 뒷면에 예문 자리 비움) · "새 단어 더"(그날 두 번째 생성) · 새 단어 미리 만들기 · 오늘 탭 "주제 → 상황 2단 선택"(010d — 회화 탭 '시나리오'가 진입점, 이 화면에 넣지 않는다) · T6 · 익힘 증가분 · 카드마다 출처 표시 · "떠나면 취소돼요" 문구.
- 내 단어장 세트(#47 `topicId` 없음)는 B2 와 무관 — 지금 동작·문구 그대로(회귀 008).
- [단어장에 넣기]는 사용자 행위로만(#41). 결과 화면이 열릴 때 아무것도 저장하지 않는다.
- 화면 문구에 엔진·모델 이름 없음. `generation.reason` 코드값은 화면에 쓰지 않는다(문장으로만).
- `docs/screens.md` 는 웨이브 끝 designer 1명(C18) — §2 대기 경로 행, §5(덱·결과·대기)·§12(회화 카드) 갱신.

### 10. 자체 점검 (P0·P1·Critical·Major 0)

- P2-1 덱 머리 2~3줄이 카드 영역을 ≈56px 줄인다 — 실측 전 [추측]. 넘치면 B 1줄 강등 규칙(§3-6).
- P2-2 오늘 탭 단어 카드에 "세트 합"(#48)과 "오늘 n/need장"(#158) 두 원천 — 하루 세트가 10개를 넘으면 #48 합이 모자랄 수 있다(합 줄만 틀림, 판정 줄은 맞음). 1단계는 그대로.
- P2-3 모양 글자·칩 모양이 T3 `components/challenge` 와 같은 값이지만 파일이 따로다 — 웨이브 끝 합치기 후보.
- Minor-1 대기 화면 경과 숫자는 화면 리더에 읽히지 않는다(의도 — 매초 읽기 방지). 상태 문장으로 대신.
- Minor-2 덱 챌린지 줄은 live 가 아니라서 답할 때마다 읽히지 않는다(의도) — 끝내기 시트·결과에서 문장으로 알린다.

### 11. 설계서·계약·이력서 사이 모순·공백 (Leader 확인 — 이 가이드의 처리)

1. **출처 문구 원천이 갈린다** — 이력서 `## Leader 확인 필요` 3 · Leader 지시문의 "오늘 처음 보는 「카페 주문」 단어 N장"(데모 v2 U3 카드) vs 설계서 §4-3c·§13-5 49·51 "「카페 주문」 새 단어 10장". **설계서 v2.3 를 따랐다**(카드 "「주제」 새 단어 {n}장 · 오늘 0/{need}장", 덱 B 줄 "「주제」 새 단어 {n}장 · AI 가 만든 단어라 …").
2. **§13-5 49 "오늘 새 단어 n장 남음"의 원천 없음** — #158 `ChallengeWordsTask` 에 남은 새 단어 수가 없다(§9-1 이 풀 크기를 싣지 않는다고 정함). 처리: 그리지 않음. 넣으려면 T1 additive `aiLeft?: number|null`(오늘 이 주제 AiWord 카드 키 − 답한 키, LLM 0).
3. **대기 화면의 경로를 설계서가 정하지 않음** — E1 로 `/study/today/words/new` 확정(이유 E1).
4. **이력서 파일 경계 "금지: `components/lesson/LessonEnd.tsx`(010d-B 소유)" vs Leader 결정 ⑥ "T4 소유"** — ⑥ 을 따랐다(prop 1 + 한 줄, `ChallengeEndLine` 은 새 파일). 010d-B 는 T4 로컬 커밋 뒤.
5. `components/lesson/lessonCopy.ts` 는 C8 목록 밖 — 고치지 않고 `vocab/topicCopy.ts` 에 둔다(E12).
6. 클라이언트 타입 `WordCreateBody.partOfSpeech` 는 필수인데 서버는 선택(기본 OTHER) — 화면은 3필드 로컬 타입으로 보낸다(타입 파일 무변경).
7. `wrongWords[].source` 는 #51 에만 있고 #49 다시 열기에는 없다 — 주제 카드 판별은 `session.topic≠null` 로(U4 로 주제 세트에는 단어장 카드가 없다).
8. #58 `reason:'CHALLENGE'` 인데 챌린지 회화 과제가 꺼진 경우(지금 카드로 그림) 추천 이유 문구가 비어 "아직 해 보지 않은 주제예요"(START 문구)로 떨어진다 — 기본 카드에 "챌린지 주제예요" 한 줄 추가(`TodayLessonCard` 기본 분기, T4 파일).
9. 설계서 §8-3 S6 "만드는 중(약 1분)" vs 지금 `HOME.genBody` "보통 1~2분" — 챌린지 카드만 "1분쯤", 기본 카드 문구는 그대로(회귀 방지).
10. 이력서 `## Leader 확인 필요` 2(LLM 직렬 슬롯 위치)·4(QA 계정 3 공유)는 디자인 밖 — 그대로 Leader.

### 12. 설계서 §13-5 (47~62) 반영 위치 — T3·T4 전체

| # | 내용 | 반영 | 위치 |
|---|---|---|---|
| 47 | 결정 카드 "확정" 표시 | 구현 화면에는 결정 UI 가 없다(데모 전용) — 해당 없음 | T3 §9 |
| 48 | U3 카드 B2 설명 | 결정 카드 없음. 같은 내용을 만들기 ③ 단어 설명·오늘 단어 카드 둘째 줄에 | T3 §3-3 · T4 §3-3 |
| 49 | 오늘 카드 "「주제」 새 단어 10장 · 오늘 0/8장" | 그대로. "오늘 새 단어 n장 남음"은 원천 없음 | T4 §3-3 · §11 ② |
| 50 | 새 단어 만드는 중 대기 화면 | 새 경로 · 0.6초 뒤 · [주제 표현으로 바로 풀기] 처음부터 · 떠나면 취소(문구 없음) · 30초 폴백 자동 | T4 §3-5 · E1~E3 |
| 51 | 덱 머리 출처 문구 | B 줄(지속) + 사유 알림(첫 열기) · 기준 예시 = 새 단어 세트 | T4 §3-6 |
| 52 | 폴백 4종 | TIMEOUT·FAILED·INVALID / LIMIT / SKIPPED(B1 문구만) / NEW_DONE — 폴백 세트도 "오늘 n/8장" 합계에 더함(`d.timeout`→`d.base4` 흐름) | T4 §3-6 · §6 |
| 53 | 섞인 세트 | "새 단어 7장 + 「주제」 표현 3장", 카드별 출처 없음 | T4 §3-6 |
| 54 | 409 GENERATING | 같은 모양 + 자동 재시도 3초×5 | T4 §3-5 · E4 |
| 55 | 두 번째 세트 문구 | "오늘 만든 새 단어 중 안 푼 6장 + 「주제」 표현 4장" · 20장 합계는 S5 | T4 §3-6 · T3 §3-5 |
| 56 | 새 단어 진행 줄 | S4 "새 단어 30개 — 공부 28 · 익힘 0" + 도움말 | T3 §3-4 |
| 57 | 누적 세트 = 답한 카드 ≥1 | `totals.wordSets` 그대로 · 건너뛰기만 날 "푼 0장" | T3 §3-4·§3-5 |
| 58 | 두 세트 날 20장 | S5 기준 수치 | T3 §3-5 |
| 59 | 소급 6·3·1 | 상태 `s2.retro`·`r.retro` 값 | T3 §6 · T4 §6 |
| 60 | 15장 비활성 | S3 ③ | T3 §3-3 |
| 61 | 결과 [단어장에 넣기]·주의 한 줄·자동 추가 없음이 드러남 | 넣은 카드만 "✓ 넣었어요" | T4 §3-8 · E7 |
| 62 | 데모 머리·개발 메모 | 데모 파일 몫(이번엔 데모를 고치지 않음 — 이 기록이 대신) | — |

### 13. 파일 경계 · 순서 표 (T3·T4·010d-B·012b-2·012b-4 충돌 가능 파일)

| 파일 | T3(043) | T4(044) | 010d-B | 012b-2 | 012b-4 | 순서·규칙 |
|---|---|---|---|---|---|---|
| `components/shell/routes.ts` | 두 항목 추가 | **무변경**(E1) | 줄 추가 | 무변경 | 무변경 | T3 → 010d-B |
| `components/talk/TalkRoom.tsx` | — | **무변경** | 역할극 모드 | 카드 삽입 ≈6줄 | 무변경 | 012b-2 → 010d-B (039 커밋 뒤) |
| `components/lesson/LessonEnd.tsx` | — | prop 1 + 한 줄(⑥) | 역할극 연결 | — | — | **T4 → 010d-B** |
| `components/lesson/LessonScreen.tsx` | — | `complete` 응답 보관(⑥) | (필요 시) | — | 무변경 | T4 먼저 |
| `components/lesson/{TodayLessonCard,logic}` | — | 소유 | 피함 | — | 무변경 | T4 단독 |
| `components/lesson/{StageUnderstand,useLessonPlayback}` | — | **무변경** | — | — | 소유 | 012b-4 단독 |
| `components/lesson/{lessonCopy,LessonTopicsScreen}` | 무변경 | **무변경** | (상황 2단 선택 안 넣음) | — | — | 손대지 않음 |
| `components/vocab/**` | — | 소유 | — | — | 무변경 | T4 단독 |
| `app/(app)/study/today/**` | — | `words/new` 신규 | — | — | — | T4 단독 |
| `components/plan/**`·`app/(app)/plan/**`·`components/challenge/**` | 소유 | **import 0** | — | — | — | T3 단독 |
| `components/chat/**` | — | — | `StudyAiHome`·`NewChatSheet` | 무변경(D-3) | — | 039 커밋 뒤 |
| `components/common/**` | import 만 | import 만 | import 만 | import 만 | import 만 | 수정 금지 |
| `types/{challenge,plan,lesson,vocab}.ts` | 소비 | 소비 | (lesson·chat 은 010d) | — | — | T1·T2 소유 |
| `docs/screens.md` | 웨이브 끝 일괄 | 웨이브 끝 일괄 | 〃 | 〃 | 〃 | designer 1명(C18) |

## Developer 기록

- [23:55] **체크포인트 1 (dev-044, 신규 소환)** — 미러 `~/.node-local/thekaiwa-044` 생성(계획서 §3 절차, `prisma generate` 1회). 가이드 §7 순서 ①~⑦ 화면 코드 작성, `tsc --noEmit` 0 오류(작업 트리 전체 기준).
  - 완료(신규): `components/vocab/{topicCopy,topicLogic,topicSetStart}.ts` · `useTopicSetStart.ts` · `useTodayChallenge.ts` · `TopicSetStart.tsx` · `ChallengeStrip.tsx` · `TopicWordsCard.tsx` · `TopicDeckLines.tsx` · `ChallengeResultBox.tsx` · `AddToWordbookButton.tsx` · `components/lesson/ChallengeEndLine.tsx` · `app/(app)/study/today/words/new/page.tsx`
  - 완료(수정): `vocab/{TodayHome,TodayWordsCard(embedded·MineSetPanel),VocabDeck,DeckProgress(칩),DeckNotice(topicReason·주제 문구),deck(pickNotice 5번째 인자),useVocabDeck(topicGen ref·#158 1회),FinishConfirmSheet(challengeNote),VocabResult(상자·주의·넣기·한 세트 더),WordResultList(add·note),hooks(키 3)}` · `lesson/{TodayLessonCard(챌린지 모드·CHALLENGE 추천 줄),logic(deriveChallengeLessonCard),LessonScreen(#62 challenge 보관·토스트),LessonEnd(prop 1 + 줄 1)}`
  - 남은 일: 단위 테스트(topicLogic·topicSetStart·lessonLogic 챌린지) · eslint · `tests/live/task044-screens.ts`(가로채기) · 3폭 실행.
  - 다음 첫 행동: `src/components/vocab/__tests__/topicLogic.test.ts` 작성.
  - 주의점: ① `ChallengeEndLine.tsx` 는 소유 목록 밖 **신규 파일**(가이드 §3-9·§7 지정 — 다른 WP 와 겹치지 않음). ② `/study/today/words/new` 는 정적 경로라 `[sessionId]` 보다 먼저 잡힌다(`routes.ts` 무변경). ③ StrictMode 이중 effect 대비 — 대기 화면은 `setTimeout 0` 뒤 시작(요청 1번), 덱의 `topicGen` 은 ref 캐시. ④ 오늘 탭 끝내기 시트(풀던 주제 세트)에는 챌린지 메모를 넣지 않았다 — #48 의 진행 중 세트 맞힘·틀림 값을 믿을 수 없어서(가이드 §3-7 은 덱 시트만 지정).
  - 미커밋 파일: 위 신규·수정 전부(커밋 없음).
- [00:25] **체크포인트 2 — 구현 완료·인계(dev-044)**. 가이드 상태 구현: S6 띠 3(진행·달성·내일)+오류 1 · 단어 카드 7(wip·otherWip·ipDefense·TODO·SHORT·DONE·로딩/오류)+내 단어장 펼침 · 회화 카드 챌린지 모드 10(loading·error·gen·busy·make·ready·progress·continue·fail·done)+보조 줄 2+기본 카드 CHALLENGE 추천 줄 · 대기 화면 10(quiet·gen·gen20·skipping·busy409·포기·error·rate·allDone·topicEmpty, 409 풀던 세트→오늘, 토큰 없음→오늘) · 덱 머리(칩·출처 4문구·챌린지 줄 6조건·사유 알림 3·주제 few/fewer) · 끝내기 메모 5 · 결과 상자 7+주의 줄 2+[단어장에 넣기] 4상태+[한 세트 더] · 수업 종료 줄 3+토스트. 미구현(가이드대로): "오늘 새 단어 n장 남음"·익힘 증가분·예문.
  - 실행 증빙: `tsc --noEmit` 0 · eslint 변경 25파일+`tests/live/task044-screens.ts` 0 · 신규 단위 24/24 · `src/components`+`src/types` 전체 **518/518** · 보이지 않는 문자 0.
  - Playwright `tests/live/task044-screens.ts`(전부 가로채기, 쓰기 요청은 503 차단·기록): **실행 미완** — QA 계정 3 이 DB 에 없음(생성 = upsert 쓰기라 하지 않음 → 계정 1 읽기로 대체) · 6폭×17상태가 580초 안에 안 끝남(줄마다 출력·`SIZES=` 옵션으로 고침). 3폭 넘침·스크롤 1곳·44px·덱 780 스크롤 0 실측은 QA 몫(`SIZES=390x780 node --env-file=.env --import tsx tests/live/task044-screens.ts 3026` 부터).
  - T1·T2 필드 요청 없음. 소유 밖: 신규 `components/lesson/ChallengeEndLine.tsx`(가이드 지정) Leader 확인. 남은 위험 [추측]: 덱 머리 줄이 780 에서 카드 영역을 줄임(360·높이≤760 은 출처 1줄로 줄임, 실측 전).
  - dev 3026 종료·`ss -ltn` 0 확인. 미커밋: 체크포인트 1 목록 + `vocab/__tests__/{topicLogic,topicSetStart}.test.ts`·`lesson/__tests__/lessonLogic.test.ts`·`tests/live/task044-screens.ts`.

### dev-044b (REV-125)

- [00:05] **REV-125 Medium 3 + 보완 2 수정 완료(신규 소환 developer, opus)** — 범위: M-1·M-2·M-3(+L-1)·반원 글자→`PartialMark`·L-4. DB 쓰기·라이브·3010·A12 호출·dev 서버 기동 0. 커밋 없음.
  - **M-1 풀던 세트 몸통 재사용**: `TodayWordsCard.tsx` 의 풀던 세트 몸통을 `InProgressBody`(export)로 빼서 지금 카드와 `TopicWordsCard` 가 같이 쓴다(지금 카드 출력 그대로 — 같은 줄·같은 클래스). 안내 줄 문구는 `labels.ts IN_PROGRESS_NOTE`(저장됨·지난 날) + `inProgressNotes()`, 챌린지 줄은 `topicLogic.wipCardNotes(kind, date, today)` — 오늘 시작한 챌린지 주제 세트만 "끝내면 오늘 합계에 더해져요", **어제 시작한 주제 세트는 이 줄 없이 지금 카드의 "지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요."**(리뷰 원문 지시 그대로 — 새 문구 만들지 않음), 내 단어장·다른 주제 세트는 지난 날 안내 유지 + "이 세트를 끝내면 챌린지 단어를 시작할 수 있어요". `today` 를 모르면 "오늘 합계" 줄을 쓰지 않는다.
  - **M-2 멱등**: `topicSetStart.ts` 에 `working`(요청 중·409 재시도 대기 중)·`closed`(done·inProgress·resume 뒤)·`requestOpen`/`abortedOpen` 플래그. `skip()` 은 바로 풀기 요청이 이미 나가 있으면 무시(새 단어 요청 중이면 지금처럼 취소 후 전환), `retry()`·`start()` 는 진행 중이면 무시, 세트가 정해진 뒤엔 셋 다 무시 — 셋 다 받아들였는지 `boolean` 반환. `TopicSetStart.tsx` 바로 풀기 버튼은 보내는 중 `onClick` 을 뗀다(`aria-disabled` 유지, native `disabled` 는 흐림·초점 변화라 쓰지 않음). `useTopicSetStart` 는 다시 시도가 받아들여졌을 때만 경과 시계를 다시 잰다. **409 처리 결정**: 409 `{sessionId}` 를 받았을 때 **이 화면이 진행 중이던 요청을 취소한 적이 있으면**(그 요청이 서버에서 이미 세트를 만들었을 수 있음 — M-2 경로) 새 상태 `resume` → 그 세트 덱 `/study/today/words/{id}` 로 바로 `replace`. 취소한 적이 없는 409(진짜 다른 풀던 세트)는 가이드 §3-5 대로 오늘 탭 + "풀던 세트가 있어요" 안내(내 단어장 세트로 덱에 끌려가지 않게). Leader 지시 "409 후 풀던 세트로 곧바로 이동"을 이 범위로 좁힘 — 넓히려면 Leader 결정.
  - **M-3 + L-1 스크립트**(`tests/live/task044-screens.ts`, **실행 안 함 — QA 몫**): 맨 위 가드 `APP_ENV=PRODUCTION` 거부 + `BASE` localhost·`:3010` 거부(`challenge-smoke.ts:26` 같은 줄). 대기 행 `w.gen`·`w.busy409`·`w.leave` 는 `Fx.waitText` 로 `domcontentloaded` 진입 → 대기 문구가 보일 때까지(최대 60초) 기다린 뒤 **응답 보류 상태에서** 측정, 측정 전에 덱으로 넘어갔으면 FAIL 표시. 보류 시간 60초 → `HOLD_MS` 15초. `w.leave` 는 `requestfailed` 리스너를 **goto 앞**(`run` 의 새 `before` 인자)에 달고 `errorText` 를 함께 출력.
  - **반원 글자 → `PartialMark`**: `ChallengeStrip.tsx`·`ChallengeResultBox.tsx`·`lesson/ChallengeEndLine.tsx` 가 `@/components/challenge/parts` 의 `PartialMark` 만 import(export 있음 확인, T3 파일 수정 0). 주석의 반원 글자도 지움. **주의: `components/challenge/` 는 아직 git 미추적(`??`)** — T4 커밋이 T3 보다 먼저 나가면 import 가 깨진다(T3 와 같은 커밋 또는 T3 뒤).
  - **L-4 주의 문구 우선**: `topicCopy.SOURCE` 를 설명/주의로 나누고 `topicLogic.topicSourceParts()`(`{desc, note}`) 추가 — `topicSourceLine()` 은 둘을 " · " 로 이은 같은 문장(기존 테스트 문구 그대로). `TopicDeckLines` 는 `compact`(≤370폭/≤760높이)이고 주의가 있으면 한 줄 flex: 설명 `min-w-0 truncate`(먼저 줄어듦) + 주의 `flex-none max-w-full`(안 잘림, 한 줄보다 길면 주의만 두 줄로). 넓은 화면(2줄)과 주의 없는 B1 문구는 지금 그대로. **가이드와의 차이**: §3-6 강등 규칙("B 를 line-clamp-1")의 잘리는 쪽만 바꿈(문구·위치 그대로) — Leader 결정 범위.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-044`, sync-local 1회·`prisma generate`, `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"` 덮어쓰기): ① `vocab/__tests__/{topicLogic,topicSetStart}` + `lesson/__tests__/lessonLogic` **30/30**(T4 신규 22 = 기존 16 + 이번 6: 풀던 세트 3경우 문구·카드 렌더, 출처 두 부분·강등 렌더, 반원 글자 0·`data-mark="partial"` 3곳, 바로 풀기 두 번 누름, 다시 시도 두 번·진행 중, 409 resume/inProgress 구분) ② `src/components`+`src/types` 전체 **552/552**(fail 0·cancelled 0·skipped 0 — 518 에서 이번 6 + 다른 작업 28 늘어남) ③ `tsc --noEmit` **0 오류** ④ eslint 변경 16파일(테스트·스크립트 포함) **0 error·0 warning** ⑤ 보이지 않는 문자 0(`grep -nP`) ⑥ 반원 글자 0(`src/components/{vocab,lesson}`·`src/app/(app)/study/today`).
  - **변경 파일**: `src/components/vocab/{labels.ts, TodayWordsCard.tsx, TopicWordsCard.tsx, topicLogic.ts, topicCopy.ts, topicSetStart.ts, useTopicSetStart.ts, TopicSetStart.tsx, TopicDeckLines.tsx, VocabDeck.tsx, ChallengeStrip.tsx, ChallengeResultBox.tsx}` · `src/components/lesson/ChallengeEndLine.tsx` · `src/components/vocab/__tests__/{topicLogic,topicSetStart}.test.ts` · `tests/live/task044-screens.ts`. 소유 밖 0.
  - **QA 인계 변경**: high_risk 1 — 바로 풀기 빠른 두 번 누름은 요청 1번(덱으로 감)이 기대값, 새 단어 요청을 막 끝난 순간 바로 풀기를 눌러 409 가 오면 그 세트 덱으로 바로 감(오늘 탭 토스트 아님). high_risk 2 — 어제 시작한 주제 세트 오늘 카드에 "끝내면 오늘 합계에 더해져요" 가 **없어야** 하고 "지난 날 시작한 세트예요…" 가 있어야 함. high_risk 3 — 덱 `tight`(360 폭·760 이하 높이)에서 B 줄 끝 AI 주의가 온전히 보이고 설명이 말줄임되는지(`d.ai` 360×780). 스크립트는 M-3 수정 뒤라 대기 행을 그대로 써도 된다(`SIZES=390x780 node --env-file=.env --import tsx tests/live/task044-screens.ts 3026`).
  - **하지 않은 항목**(지시대로): L-2(지난 날 세트 답 0장 메모) · L-3(bfcache `pageshow`) · L-5(C 줄 truncate) · L-6(sessionStorage 폴백) · L-7 · L-8(수치 정정은 위 숫자로 대신) · L-9 · I-1·I-2.
  - **남은 위험**: [추측] ① 넓은 화면 2줄 모드에서 주제 이름이 아주 길면(출처 문장이 3줄 이상) `line-clamp-2` 가 주의를 자를 수 있다 — 시드 주제 길이로는 2줄 안(손계산 390폭 ≈550px/2줄 716px), designer 판단 대상. ② 360 폭 `compact` 에서 긴 주의("…읽기·뜻이 틀릴 수 있어요" ≈300px)가 남으면 설명은 거의 말줄임만 보인다(주제는 칩·부제에 있음). ③ Playwright 가 가로챈(보류 중) 요청이 페이지에서 취소될 때 `requestfailed` 를 내는지 실행으로 확인하지 않았다 — 안 나오면 `w.leave` 가 거짓 FAIL. ④ `resume` 은 "취소한 요청이 있었다"로 판단하므로, 그 사이 다른 기기에서 다른 세트를 시작한 드문 경우엔 그 세트 덱으로 간다(데이터 손실 없음).
  - 미커밋: 위 변경 파일 전부 + dev-044 체크포인트 목록.

## Reviewer 기록 (REV-125)

- [23:55] **REV-125 — task-044 (챌린지 T4: 오늘 탭 연동·주제 단어 화면) 독립 감사 · 판정 PASS_WITH_NOTES** (신규 소환 reviewer, Read 전용·코드 수정 없음). `base_ref 5c3a701` 미커밋 작업 트리. 기준 = designer 구현 가이드(§3·E1~E12)·설계서 v2.3. **Critical 0 · High 0 · Medium 3 · Low 9 · Info 2.** 7영역 검토 완료(아키텍처·유지보수·안정성·운영·성능·보안·학습 원칙). `native_change: false`(plugins·android·capacitor.config·Manifest 변경 없음, `versionCode` 해당 없음). 데모 게이트: 승인용 데모 없음(사용자 지시 — 가이드가 정본이라 "데모 vN 대비 차이 분류"는 가이드 대비로 대신함; material 차이 0, defect 후보는 M-1 하나).
- **권고(필수 아님 — Leader 판단)**: M-1·M-2·M-3 은 모두 작은 수정(합쳐서 ~30줄)이라 **QA 시작 전에 Developer 가 한 번 고치고 Reviewer 가 해당 줄만 재확인**하는 편이 낫다 — M-3 은 고치지 않으면 QA 가 이 스크립트를 돌려도 대기 화면 행이 엉뚱한 화면을 재고 `w.leave` 가 늘 FAIL 로 나온다. 고치지 않고 QA 로 넘기면 QA 는 M-3 때문에 대기 화면 5행을 직접 측정해야 한다.

### 재실행 숫자 (미러 `~/.node-local/thekaiwa-044`, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid` 덮어쓰기, 이 REV 가 sync-local 1회 실행)

| 항목 | 개발자 보고 | 내 재실행 |
|---|---|---|
| `tsc --noEmit` | 0 | **0 오류**(작업 트리 전체) |
| 신규 단위 | "24/24" | topicLogic 9 + topicSetStart 6 + lessonLogic 신규 1 = **신규 16건 전부 통과**. "24" 는 lessonLogic 파일 전체(9건, 기존 8 포함)를 합친 수 — 보고 수치 부정확(L-8), 결과는 같음 |
| `src/components`+`src/types` 전체 | 518/518 | **518/518 pass · 0 fail · 0 skipped**(exit 0) |
| eslint 변경 파일 31개 + `tests/live/task044-screens.ts` | 25파일+스크립트 0 | **0 error · 0 warning**(스크립트 마지막 수정 뒤 재실행 — json 출력으로 3파일 `errors=0 warn=0` 확인). `src/components` 전체는 5 warning(admin/settings 5파일 — 이 task 와 무관·기존) |
| 보이지 않는 문자 | 0 | 신규·수정 32파일 중 신규 0. 기존 U+3000 1건(`lesson/logic.ts:334` 정규식 — HEAD 에 있던 것, 의도) |
| 3폭·780 스크롤·44px 실측 | 미실행 | **나도 실행하지 않음**(지시: 재실행 금지, QA 몫) — 레이아웃 수치 전부 [추측] |

### 지적 표

| ID | 심각도 | 파일:줄 | 문제 · 근거 | 고칠 방법 |
|---|---|---|---|---|
| **M-1** | MEDIUM | `components/vocab/TopicWordsCard.tsx:111-125`(wip·otherWip 몸통) ↔ `TodayWordsCard.tsx:112-143` | 가이드 §3-3 은 풀던 세트 상태를 "지금 `inProgress` 몸통 **그대로** + 출처 줄 + 한 줄"로 정했는데 구현은 몸통을 새로 써서 ① 기존의 **"지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요."**(`today && s.date !== today`) 줄과 "답한 카드는 저장돼 있어요." 줄이 빠졌다 ② 어제 시작한 주제 세트를 오늘 이어 풀 때 **"끝내면 오늘 합계에 더해져요"**(`WORDS_CARD.wipNote`)가 그대로 나가는데 서버는 세트를 **시작한 날**로 센다(설계서 §5-4·덱 C 줄 `DECK_CH.past`·결과 소급 상자가 모두 그렇게 말함) — 화면 안에서 말이 엇갈리고 잘못된 사실. ③ `otherWip` 은 챌린지가 켜진 날 풀던 **내 단어장 세트**에도 쓰이는데(`wordsCardKind`) 그 경우 기존 카드의 지난 날 안내가 사라지는 회귀 | `kind==='wip'` 이고 `s.date !== today` 면 `wipNote` 대신 기존 지난 날 문구를 쓰고, 두 kind 모두 기존 두 줄("답한 카드는 저장돼 있어요."·지난 날 안내)을 그대로 둔다. 단위 테스트에 `wordsCardKind`+지난 날 케이스 1건 |
| **M-2** | MEDIUM | `components/vocab/topicSetStart.ts:108-139`(`run`·`skip`·`retry`) · `TopicSetStart.tsx:61-71` | **[주제 표현으로 바로 풀기]가 멱등이 아니다.** `skip()` 은 늘 `run(false)` → `abortCurrent()` 뒤 새 POST. 버튼은 `aria-disabled` 만 달고 `onClick={skip}` 은 그대로이고 `Btn` 스타일에 `pointer-events` 차단이 없다(`ui.tsx:79-84`는 `disabled:` 만) [확인]. 손가락으로 두 번 누르면(대기 화면에서 흔한 동작) 첫 skip 요청을 끊고 다시 보내는데, 서버가 첫 요청을 이미 처리했다면 둘째는 **409 `{sessionId}`** → `inProgress` → `router.replace('/study/today')` + "풀던 세트가 있어요" 토스트로 덱 대신 오늘 탭에 떨어진다(세트는 생겨 있어 [이어서 풀기] 로 복구 가능, 데이터 손실 없음). `retry()` 도 같다. 다른 곳(`startTopic`·`oneMore`·`useLessonCreate`)은 ref 가드가 있어 일관성도 깨짐. 단위 테스트가 skip 1회만 본다 | 상태 기계에서 `skip()` 은 `!generate && controller`(이미 skip 요청이 살아 있음)이면 무시, `retry()` 는 요청이 살아 있으면 무시. 테스트 1건(`skip(); skip()` → `calls.length` 2) |
| **M-3** | MEDIUM | `tests/live/task044-screens.ts:65-66, 152` | 대기 화면 행이 **엉뚱한 화면을 재고 `w.leave` 가 항상 실패한다**[가능성 높음]. `w.gen`·`w.busy409` 는 #47 응답을 **60초** 붙잡는데 모든 행이 `waitUntil:'networkidle'` 로 들어가므로 goto 가 60초 뒤(응답이 풀린 뒤)에야 끝나고, 그때 앱은 이미 `router.replace` 로 덱으로 가 있다 → 측정은 덱 화면. 개발자 기록의 "6폭×17상태가 580초 안에 안 끝남"과 맞는다(대기 2행×60초×6폭 = 720초). `w.leave` 도 같은 goto 뒤에 `requestfailed` 리스너를 달아서 요청이 이미 끝난 뒤라 "abort on leave"는 나올 수 없다 — **거짓 PASS 는 아니고 거짓 FAIL 쪽**이지만 취소 증빙이라는 목적을 못 한다. 같은 함정을 task-043 스크립트가 이미 풀어 놨다(`task043-screens.ts:242-244` "불러오는 중 상태는 응답을 붙잡아 두므로 networkidle 을 기다리지 않는다") | 대기 행(`w.*`)·`w.leave` 는 `waitUntil:'domcontentloaded'`(또는 `commit`) + 고정 대기(1.5초)로 들어가고 `requestfailed` 리스너는 goto **앞에** 단다. 지연 60초는 측정 뒤 `ctx.close()` 로 끊기므로 15초면 충분 |
| L-1 | LOW(운영 가드) | `tests/live/task044-screens.ts:17-18, 130` | **운영 포트 3010 거부가 없다.** `APP_ENV=PRODUCTION` 만 보고 `BASE` 는 인자를 그대로 쓴다. 쓰기는 막고 응답은 고정이지만 가로채지 않는 GET(`route.continue()`)이 인자가 3010 이면 운영 서버로 QA 사용자 토큰과 함께 나간다. REV-122 M-3(T3 스크립트)과 같은 종류 | `task043-screens.ts:25` 의 한 줄(`BASE` 가 localhost 가 아니거나 `:3010` 이면 throw) 복사 |
| L-2 | LOW | `components/vocab/topicLogic.ts:197-198` | **지난 날 세트를 답 0장으로 끝낼 때** 메모가 "오늘 단어는 0/8장 그대로예요"(`deckBase` 의 past 분기는 `base:0`) — 오늘은 4/8 이거나 이미 완료일 수 있어 사실과 다르다. 가이드 표 순서(답 0장 > 지난 날 세트)대로이긴 하나 past 의 base 를 0 으로 둔 탓 | past 일 때는 `zero` 문구 대신 중립 한 줄("이 세트는 {M월 D일}에 시작해서 그날 기록으로 남아요.")로, 또는 `zero` 에서 `b.past` 를 먼저 본다 |
| L-3 | LOW | `components/vocab/useTopicSetStart.ts:73-74` | `pagehide` 에서 `persisted`(bfcache 로 들어가는 경우)도 `dispose()`. 되돌아오면(`pageshow`) 요청은 없는데 화면은 `gen` 으로 남고 `skip()`·`retry()` 는 `disposed` 라 아무 일도 안 한다(← 만 동작). 앱 WebView·SPA 이동에선 거의 안 닿는 경로 | `pageshow` 의 `persisted` 면 `router.replace('/study/today')`(또는 `persisted` 일 때만 돌아와서 새 starter) |
| L-4 | LOW(디자인→Leader) | `components/vocab/VocabDeck.tsx:35`, `TopicDeckLines.tsx:10` | `tight`(≤370px 폭 또는 ≤760px 높이)에서 B 줄이 `line-clamp-1` 이 되는데 **AI 주의 문구가 줄 끝**이라 시각적으로 먼저 잘린다("…새 단어 10장 · AI 가 만든 단어라 읽…"). 가이드 §3-6 이 허용한 강등이지만 "AI 가 만든 단어는 틀릴 수 있어요"가 학습 원칙상 보여야 하는 문구라는 점에서 designer 판단 필요. 실기기 WebView 높이가 780 안팎이라 `(max-height:760px)` 에 걸릴 수 있다[추측] | 코드 변경 아님 — Leader 가 designer 에게: 강등 시 주의 문구를 앞으로 보내거나(`AI 새 단어 10장 · …`) 주의만 별도 한 줄 유지 |
| L-5 | LOW | `components/vocab/TopicDeckLines.tsx:11` | C 줄이 `truncate` 한 줄 — `DECK_CH.done`(약 31자)·`past`(약 33자)는 360~390 폭에서 잘릴 수 있다[추측, 실측 필요]. 스크린리더는 전체를 읽음 | QA 가 `d.met`·`d.pastdate` 를 360 에서 확인 → 잘리면 `line-clamp-2` 또는 문구 단축(designer) |
| L-6 | LOW | `useTopicSetStart.ts:27-30`(`writeStore` 직접 사용) | sessionStorage 가 막히면(`writeStore` 는 조용히 무시) 토큰이 안 남아 [시작하기] 가 대기 화면에서 곧바로 `/study/today` 로 돌아온다(알림 없음). 기존 notice·flash 흐름도 같은 한계지만 이쪽은 기능 자체가 안 된다. 앱 WebView·Chrome 에선 거의 없음 | 메모리 폴백 한 줄(모듈 변수) 또는 돌아올 때 flash 한 줄 |
| L-7 | LOW | `TodayHome.tsx` `FinishConfirmSheet`(오늘 탭 풀던 세트 [여기서 끝내기]) | 챌린지 메모가 없다 — 개발자 확인 요청 ②, **타당**(아래). 다만 사용자는 이 길로 끝내면 합계 미달 안내를 결과 화면에서 처음 본다 | 조치 불필요(2단계 후보로 기록) |
| L-8 | LOW | Developer 기록 `실행 증빙` | "신규 단위 24/24" 는 신규 16건(+기존 8)의 합 — 수치 정정 필요 | 이력서 한 줄 정정 |
| L-9 | LOW | `ChallengeResultBox.tsx`·`WordResultList.tsx:55` | 360 폭 **전체 카드 목록** 행에서 `flex-none` 오른쪽 묶음이 [결과 배지 + ★ + [단어장에 넣기](~115px)]라 글 열이 100px 안팎으로 줄 수 있다[추측]. `min-w-0` 로 줄바꿈은 되므로 넘침은 아님 | QA 360 에서 `r.added` + 전체 카드 목록 확인 |
| I-1 | INFO | `TopicSetStart.tsx:121, 161-163` | `error` 상태는 `role="alert"` 와 `role=status`(sr 같은 문장)가 함께 있어 두 번 읽힐 수 있다 | 선택 — `error` 일 때 status 비움 |
| I-2 | INFO | `TodayHome.tsx`(`tm.loading`) | #158 이 끝나기 전엔 **챌린지 없는 사용자도** 단어·회화 카드가 "불러오는 중…"으로 보인다(가이드 E8 의 의도된 동작 — 깜빡임 방지). #158 에 타임아웃이 없어 서버가 느리면 두 카드가 같이 늦게 열린다 | 조치 불필요, QA 는 #158 지연 시 카드 상태를 한 번 본다 |

### 취소·타이머·재시도 로직 판정 (핵심 2번)

- **화면을 떠나는 모든 길 → 요청 취소 [확인(코드 읽기)]**: `useTopicSetStart` effect cleanup(`starter.dispose()` → `controller.abort()`·`clearAll()`) — ←(`BackBar`)·휴대폰 뒤로·탭/링크 이동은 모두 unmount 를 거친다. `pagehide`(새로 고침·창 닫기) 도 `dispose`. [주제 표현으로 바로 풀기]는 **앞 요청 `abort()` 가 먼저**, 새 컨트롤러로 `generate:false`(`run` 첫 줄). **`visibilitychange` 핸들러는 어디에도 없어** 다른 앱을 잠깐 보는 것은 취소하지 않는다. 취소 뒤 늦게 온 응답은 `disposed || c !== controller || c.signal.aborted` 로 버려 상태 갱신·이동이 없다(테스트 `떠남`·`바로 풀기`가 확인). `api.ts:128-129` 가 `AbortError` 를 `ApiError` 로 바꾸지 않아 `toStartFailure` 의 `isAbort` 분기가 맞다. 응답 본문 읽기 중(`res.json()`)에 취소되면 `ApiError(200)` 로 바뀌지만 `signal.aborted` 검사가 먼저라 무시된다.
- **409 `GENERATING` 3초×5번**: 서버 응답은 `ApiError('CONFLICT', …, {reason:'GENERATING'})`(`sessions.ts:474`)로 `details.reason` 이 맞다 [확인]. 첫 요청+재시도 5번=6번, 5번째 재시도도 409 면 `gaveUp`. 재시도는 같은 컨트롤러·같은 signal 이고 타이머는 `later()` 로 `timers` 에 모여 `clearAll`/`dispose` 가 정리한다. `dispose` 뒤 대기 중 재시도 타이머가 발화해도 `disposed || c !== controller` 로 막힌다. 테스트가 간격(2,999ms 전 미발송)·5번 제한·포기·떠남 정지를 모두 본다. `generate:false` 는 서버가 `GENERATING` 게이트를 보지 않으므로(`sessions.ts:446`) skip 은 409 에 걸리지 않는다.
- **StrictMode 이중 마운트**: 시작을 `setTimeout 0` 으로 미뤄 첫 effect 정리가 요청 전에 `clearTimeout` 하고, 토큰은 `tokenRef` 에 한 번만 읽어(두 번째 effect 도 같은 값) unmount 정리(`useEffect(()=>()=>writeStore(null),[])`)가 지워도 문제없다 → **요청 1번**. `useVocabDeck` 의 `genRef`·`chAsked` 도 같은 방식으로 `takeSession` 1회·#158 1회. [확인(코드 읽기, 브라우저 실측은 QA)]
- **누수**: 대기 화면 `setInterval` 은 `ticking` 이 꺼지면 정리, `kick` 타이머 정리, 리스너 정리, `onState` 는 `disposed` 면 호출 0. 이 부분에 누수는 찾지 못함.
- 약점은 **M-2(멱등성)**·**L-3(bfcache)** 둘뿐이다.

### 가이드 "회화 첫 대답을 늦추지 않는 화면 규칙 7가지" — 코드 확인

| # | 규칙 | 결과 |
|---|---|---|
| 1 | `generate:true` 는 대기 화면에서만 | ✓ `generate` 를 보내는 곳은 `topicSetStart.ts` 하나, 오늘 탭 `start()` 는 `{count,mode,category}`(mine) — grep 으로 확인 |
| 2 | 떠나는 모든 길이 취소 | ✓ 위 판정 |
| 3 | 바로 풀기는 대기 UI 가 보이는 순간부터 | ✓ `gen`(0.6초~)부터. `quiet` 0.6초는 의도(가이드 표) |
| 4 | 자동 재시도는 409 하나뿐 | ✓ `error`·`rate` 는 사용자가 [다시 시도] 를 눌러야 함. 타임아웃·실패는 서버가 폴백 세트를 주므로 화면이 다시 안 보냄 |
| 5 | 성공은 `router.replace` | ✓ `useTopicSetStart:60` (뒤로 가기가 대기 화면으로 안 옴) |
| 6 | 오늘 탭·덱 #158 은 LLM 0 | ✓ `fetchChallengeToday` = `GET /api/v1/challenges/today` 뿐 |
| 7 | 수업 만들기는 사용자가 누른 뒤만 | ✓ `create({topicId})` 는 `onClick` 에서만, 카드가 자동 생성하지 않음 |

### 가이드 일치 요약 (S6·S7·수업 종료 — 문구·구조·상태)

- **일치(확인)**: S6 띠 3종(진행·달성·내일)+오류 / 단어 카드 상태 6(wip·otherWip·ipDefense·todo·short·done)+로딩·오류+[내 단어장으로 풀기] 펼침(`aria-expanded`) / 회화 카드 챌린지 모드 10 kind(loading·error·gen·busy·make·ready·progress·continue·fail·done)+보조 줄 2종(열림 > 끝냄 한 줄)+기본 카드 `CHALLENGE` 추천 줄 / 대기 화면 상태 10(quiet·gen·gen20·skipping·busy409·포기·error·rate·allDone·topicEmpty)+409 `{sessionId}` → 오늘 탭 flash+토큰 없음 → 오늘 / 덱(주제 칩 `max-w-[40%] truncate`·출처 줄 4종+두 번째 세트 재사용·사유 알림 3종·C 줄 6조건·끝내기 메모 5종·`pickNotice` 우선순위 few/deleted > topicReason > fewer > resume > pastDate) / 결과 7상자·주의 한 줄 2종·[단어장에 넣기] 4상태·[한 세트 더] / 수업 종료 줄 3종+토스트 1번. **문구는 설계서 v2.3**("「카페 주문」 새 단어 10장 · 오늘 0/8장")을 따랐고 데모 v2 의 "오늘 처음 보는…" 은 쓰지 않았다(`WORDS_CARD.todoHead`). "오늘 새 단어 n장 남음"·익힘 증가분·예문은 그리지 않음(Leader 23:20 결정과 일치).
- **차이(분류)**: ① **defect**: M-1(풀던 세트 몸통). ② **implementation(허용)**: 풀던 세트 flash 문구를 `labels.ts FLASH` 대신 `topicCopy.WAIT.ipFlash` 에 둠(같은 문장) · `wordsCardModel` 등 함수 이름이 가이드와 다름(`wordsCardKind` 등) · `tight` 쿼리 값 · `aria-controls` 가 닫힌 동안 없는 id 를 가리킴 · "오늘 2/4장 — 2장 더…" 장수별 문구는 서버 `minAnswered` 를 쓰고 없을 때만 `ceil(4n/5)` 로 계산. ③ **material 0**(정보구조·CTA·단계 변화 없음).
- **금지·경계 확인**: 새 색 0(`bg-good-soft`·`warn-soft`·`bad-soft`·`surface2` 와 `border-ink3` 비텍스트만 — `text-ink3`·`text-accent`·`text-warn` 0건) · 화면 문구에 엔진·모델·`AiWord`·`refType`·task/Phase 번호 0(단위 테스트 `화면 문구…`가 `topicCopy` 문자열을 검사하고 나는 비주석 grep 으로도 확인) · `generation.reason` 코드값은 화면에 안 나감.

### 데이터 계약·정확도 — 독립 손계산 (구현 값과 비교)

| # | 입력 | 내 계산 | 구현 |
|---|---|---|---|
| H1 | 목표 장수 5·10·15 | `ceil(4n/5)` = 4·8·12 | 화면은 서버 `minAnswered` 를 쓰고 없으면 같은 식 — "오늘 0/4장"·"0/8장" 일치, 테스트 5장 케이스 `오늘 2/4장 — 2장 더 풀면 완료` 일치 |
| H2 | 덱 C 줄 need=8: (base0,here0) · (base4,here0) · (base4,here3) · (base4,here4) · (base5,here0, DONE) | "8장 이상 풀면 오늘 단어 완료" · "오늘 4/8장 — 4장 더 풀면 완료" · "오늘 7/8장 — 1장 더" · run=8≥8 → "오늘 8장 풂 · 이 세트를 끝내면 오늘 단어 완료" · "이미 완료" | `deckChallengeLine` 일치(코드 줄 176-185, 테스트 5건 일치) |
| H3 | 끝내기 메모 base4·need8: here2 · here4 · here0 | 6<8 → "8장 중 6장 — '일부'로 남아요. 남은 표현으로 한 세트 더…" · 8≥8 → "이 세트까지 오늘 8장 풀었어요 — 오늘 단어는 완료로 세요." · "오늘 단어는 4/8장 그대로예요." | `finishChallengeNote` 일치 |
| H4 | 결과 #51 need8: ans4/this4 · ans9/this5+goalMetNow · ans9/this5(회화 남음) · ans14/this6(미달 아님·회화 남음) | short · metNow(알림 1번) · wordsDone("1 / 2" 는 단어+회화 두 과제일 때만 도달) · `ans-this=8≥8` → wordsAlready | `resultChallengeView` 일치 — **두 세트 날: 첫 세트 알림 없음, 둘째만 알림** |
| H5 | 출처 줄: ai10/n10 · ai7/n10 · ai6/n10+재사용 · ai0+지난 수업 3 | "「카페 주문」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요" · "새 단어 7장 + 「카페 주문」 표현 3장 · …틀릴 수 있어요" · "오늘 만든 새 단어 중 안 푼 6장 + 「카페 주문」 표현 4장 · …" · "「카페 주문」 표현으로 만든 오늘의 단어 10장 · 지난 수업 표현 3개 포함" | `topicSourceLine` 일치 |
| H6 | 소급: 세트 시작 10/06, 오늘 10/07 dayIndex 4 | diff=1 → k=3 → "10월 6일에 시작한 세트라 그날(3일째) 단어로 세요" | 일치. 챌린지 첫날(dayIndex1)+어제 세트는 k=0 → 줄 없음 일치 |
| 응답 필드 | `generation{source,generatedNow,reason}`·`topic{id,title,lessonCardCount,aiCardCount}`·`challenge.words{answered,need}`·`reason:'CHALLENGE'`·`ChallengeProgress.date` | `src/types/{challenge,vocab,lesson}.ts` 와 대조 | 필드명·널 처리(`topic?`·`generation?`·`challenge?`) 모두 일치, 클라이언트 타입 추가·서버 모듈 import 0 |

### 경계·보안·학습 원칙 (4번·7영역)

- 6층·ESLint: 화면 새 파일에 `@/modules/**` import 0(페이지가 `auth` 만 — 형제 `[sessionId]/page.tsx` 와 같음), `window.Capacitor`·직접 `fetch`·`spawn` 0, 모든 호출이 `apiGet/apiPost`. T3 `components/{challenge,plan}`·`talk`·`chat` import 0. 소유 밖 변경: 이 task 파일 목록에는 `src/modules/**`·`src/types/**`·`prisma/**`·`components/{plan,challenge,talk,chat,shell}/**` 변경이 없다(작업 트리의 해당 변경은 T1·T2·T3·039·DB0 몫이고 겹침 없음). `lesson/review/{TeacherWhy,reviewLogic}.tsx` 변경은 039 몫.
- **`routes.ts` 무변경 — 확인**: `FOCUS_ROUTE_PREFIXES` 에 `'/study/today/words/'` 가 이미 있고 `/study/today/words/new` 가 `startsWith` 에 걸린다(작업 트리의 routes.ts 변경은 T3 의 `/plan/challenge*` 추가분). `words/new/page.tsx` 는 정적이라 `[sessionId]` 보다 먼저 잡힌다.
- `LessonEnd.tsx` 변경 = import 2 + prop(타입 포함) 3줄 + JSX 1줄(총 +6) — 010d-B 가 같은 파일 다른 블록을 만져도 충돌이 작다. `LessonScreen.tsx` +15/-3(상태 1개·콜백 셋째 인자·토스트 1줄).
- **[단어장에 넣기]**: `POST /api/v1/words` `{surface,reading?,meaning}`(enrich 없음 → `createWord` 즉시 저장 `source:MANUAL`, 409 `{existingId}`) — 사용자가 누를 때만 호출([확인] `VocabResult.addWord` 가 유일한 호출부), 결과 화면이 열릴 때 저장 0. 넣지 않은 카드는 단어장에 없음.
- 학습 원칙: AI 산출(새 단어)은 세트 안에서만 쓰이고 단어장·`StatsSnapshot`·`StudyLog` 를 화면이 직접 건드리지 않는다. sessionStorage 에는 주제 id·제목·장수·방식·`generation`(코드값)만 — 토큰·원음·Secret 0.

### 개발자 확인 요청 2건 판정

1. **신규 `components/lesson/ChallengeEndLine.tsx`(소유 목록 밖)** → **타당, 승인.** 가이드 §3-9·§7 이 파일 이름까지 지정했고, Leader 결정 ⑥ 이 `LessonScreen`·`LessonEnd` 를 T4 소유로 바꿨다. 다른 WP 의 어떤 목록에도 이 경로가 없고(010d-B 는 `LessonScenarioCard`, 012b-4 는 `StageUnderstand`·`useLessonPlayback`) 새 파일이라 충돌 불가. `LessonEnd` 변경을 한 줄로 줄이는 효과도 있다. 조건: Leader 가 `phase2-batch-plan` 파일 경계 표에 한 줄 추가(010d-B 가 이 파일을 건드리지 않게 알림).
2. **끝내기 시트(오늘 탭 풀던 세트)에 챌린지 문구 미추가** → **타당.** 근거 [확인]: 서버 #48 항목의 `correctCount`·`wrongCount` 는 세트를 끝낼 때만 채워지므로(`sessions.ts:755`) 진행 중 세트의 맞힘·틀림은 `answeredCount`(건너뜀 포함 가능) 뿐이라 "합계 미달" 메모를 정확히 만들 수 없다. 가이드 §3-7 도 이 시트를 덱 쪽(`VocabDeck`)으로만 지정했고 덱은 카드 상태에서 직접 센다. 결과 화면이 미달 안내를 이어서 한다. 2단계 후보로 기록만.

### `tests/live/task044-screens.ts` 평가 (재실행하지 않음)

- **DB 쓰기 0** [확인]: Prisma 는 `user.findMany`(QA 계정 3→1 읽기)뿐, upsert·create 없음. 알려진 #158·#58·#46·#48·#49·#54·#47·`words/categories`·`vocab/stats` 는 고정 응답, 그 밖 **GET 은 통과**(`route.continue()`), **쓰기 요청은 503 차단 + 로그**. 쿠키·토큰 출력 없음(`account=` 이름만 출력). `APP_ENV=PRODUCTION` 거부 있음. **3010 거부 없음(L-1).**
- **실효성**: 6폭×(S6 10행·대기 3행·덱 5행)+`w.leave`. 가이드 상태 id 76개 중 약 17개만 덮는다(S6 10/25, 대기 3/14, 덱 3/20 — `d.ai`·`d.timeout`·`d.base4`(`d.mine` 은 대조용 추가), 결과 1/13(`r.reopen`), 수업 종료 0/4) — **상태 전수는 QA 가 이 스크립트를 확장해야 한다**. 넘침 측정이 `documentElement` 만 봐서 `overflow-hidden` 컨테이너 안쪽 넘침은 안 잡힌다(L-9 와 함께 QA 가 `main`·카드 `scrollWidth` 를 추가). `small` 터치 목록·행 단위 출력·`SIZES=` 옵션은 쓸 만하다. 미실행이라 PASS 로 오인할 출력은 없다(개발자가 "실행 미완" 으로 정직하게 적음). M-3 수정 전에는 대기 화면 행 신뢰 불가.

### QA `high_risk_areas` (실행 순서 권장)

1. **취소 전파(최우선)** — 대기 화면 ←·Android 뒤로·링크·새로 고침에서 `net::ERR_ABORTED`, **서버 Trace 에서 A12 취소 여부**와 대기 중 회화 탭 첫 턴 TTFA(참고치 (다), 합격 판정 아님), `visibilitychange`(앱 전환)로는 안 끊김, **[주제 표현으로 바로 풀기] 빠른 두 번 누름(M-2)**, 409 두 탭 동시(3초×5 후 포기 화면).
2. **어제 시작한 주제 세트를 오늘 이어 풀기(M-1·L-2)** — 오늘 카드 문구·덱 C 줄·끝내기 메모(답 0장 포함)·결과 소급 상자("어제 목표도 채웠어요").
3. **3폭×780/892**(360·390·412) — S6 첫 화면(띠 56px+단어 카드 [시작하기]가 780 에서 보이는지), **덱 머리(`d.timeout`= 알림+B 2줄+C 줄)의 780 스크롤 0** — `tight`(≤370폭/≤760높이) 강등 동작, 대기 화면 스크롤 0, 가로 넘침 0, 터치 44px, `lang`·다크 한 장. 실기기 WebView(≈390)에서 B 줄 주의 문구 잘림(L-4)·C 줄 truncate(L-5).
4. **360 결과 행**: [단어장에 넣기]+★+배지가 겹치는 `전체 카드 보기`(L-9), `r.added`·`r.exists`·`r.addfail`, DB 에서 **누른 카드만 `WordEntry` 생성·안 누른 새 단어 0행**.
5. `challenge:null` 6경우(다른 주제 세트·내 단어장·복습·붙여넣기 수업·꺼진 과제·마지막 날 자정 뒤)에서 줄·토스트 0, 챌린지 없는 사용자의 오늘 탭이 지금과 같음, 단어 스모크 008 회귀.
6. 두 세트 날(첫 세트 알림 없음 → 둘째 세트만 "오늘 챌린지 목표 달성!"), 수업 종료 줄(`goalMetNow` 토스트 1번·다시 들어오면 없음), 회화 카드 10 kind·보조 줄 4상황(다른 주제 끝냄·열림·어제 만든 다른 주제·붙여넣기 생성 중 busy).
7. 스크립트: M-3·L-1 수정 후 실행, 가이드 상태 id 확장(76개 중 약 17개만 덮음).

### 다음 단계

1. Leader: M-1·M-2·M-3(+L-1·L-2) 을 dev-044 에 한 번에 보낼지 결정 — 보낼 경우 수정 줄만 Reviewer 재확인 후 QA. 안 보내면 QA 는 위 `high_risk_areas` 2·1번을 직접 확인하고 스크립트 대기 행(5행)은 새로 측정.
2. Leader: L-4(주의 문구 강등)는 designer 에게(디자인 판단 — 나는 결함으로 판정하지 않음). `phase2-batch-plan` 파일 경계 표에 `ChallengeEndLine.tsx` 1줄.
3. judge C2(Codex 개입 판정)는 이 REV 뒤 Leader 가 호출 — Codex 결과가 오면 지적마다 채택/오탐/범위 밖을 이 절에 덧붙인다.
4. 확인 못 한 것: 브라우저 실측 전부(3폭·780·44px·StrictMode 이중 마운트·`ERR_ABORTED` 서버 도달·bfcache 동작)·Android WebView 동작·#158 지연 시 체감 — 전부 [추측] 이상으로 쓰지 않았다.

## Reviewer 기록 (REV-128)

- [00:22] **REV-128 — task-044 dev-044b(REV-125 보완) 좁은 재검토 · 판정 PASS_WITH_NOTES** (신규 소환 reviewer, Read 전용·코드 수정 없음). 범위 = REV-125 M-1·M-2·M-3·L-1·반원 글자·L-4 대응 + 소유 경계 회귀. **Critical 0 · High 0 · Medium 0 · Low 2 · Info 4.** REV-125 의 Medium 3 은 **모두 해소**, 새 Medium 이상 없음. `native_change: false`. 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(status `waived`, "데모 생략하고 진행해줘" 2026-10-06 23:43, [확인] `.claude/state/demo-gate/evidence.jsonl` 22행 `kind=waive`(task-044, 23:43:51)의 `prompt_ts` 23:43:26 이 `prompts.jsonl` 161행의 사용자 프롬프트("데모 생략하고 진행해…", 같은 `session_id`)와 맞고 이력서 데모 표와 일치 — 에이전트 대리 `approve`/`waive` 나 상태 파일 직접 쓰기 흔적은 이 줄에서 보이지 않음).
- **재실행(미러 `~/.node-local/thekaiwa-044`, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid` 덮어쓰기, 이 REV 가 sync-local 1회 + `prisma generate` 1회, NFS 무수정)**

| 항목 | 개발자 보고 | 내 재실행 |
|---|---|---|
| vocab·lesson 단위(topicLogic·topicSetStart·lessonLogic) | 30/30 | **30/30**(fail 0·cancelled 0·skipped 0) |
| `src/components`+`src/types` 전체 | 552/552 | **554/554**(fail 0) — +2 는 dev-043c 쪽 동시 변경(T3 `challenge/` 테스트, 다른 REV 에서 554 로 보고됨) [가능성 높음, 파일별 대조는 안 함] |
| `tsc --noEmit` | 0 | **0 오류** |
| eslint(T4 변경 31파일: 소유 파일+테스트 2+`tests/live/task044-screens.ts`+인접 vocab·lesson 수정 파일) | 16파일 0 | **0 error · 0 warning** |
| 보이지 않는 문자(`grep -nP`, T4 소유 18파일) | 0 | **0** |
| 엔진명·model_id·speaker_id(T4 화면 파일 비주석) | 0 | **0**. 직접 `fetch`·`window.Capacitor`·`spawn` 0, `@/modules` import 는 `words/new/page.tsx` 의 `auth` 1건(형제 `[sessionId]/page.tsx` 와 같은 패턴) |
| `src/modules/**`·`src/types/**`·`prisma/**`·`components/{plan,talk,chat,common,shell}` 침범 | 0 | **0 — [확인]** dev-044b 작업 창(23:55~00:05) 안에 수정된 해당 경로 파일은 `src/types/evaluation.ts` 1개뿐이고 그 diff 는 task-012b-2 의 `voiced?` 필드(T4 무관). T4 선언 파일 16개는 전부 `components/{vocab,lesson}`·`tests/live` 안 |
| ◐(U+25D0) 글자 | 0 | **화면 소스 0 — [확인]**: `src/components/**`·`src/app/**` 전체 grep 0건. 남은 곳은 `src/modules/learning/__tests__/challengeMetrics.test.ts` 의 서버 테스트 주석·기호표(화면 아님). U+25D1~25D3·25D6·25D7 도 0 |

### 1. M-1 (풀던 세트 몸통 공용화) — 해소 [확인]

- `InProgressBody`(export)를 지금 카드(`TodayWordsCard.tsx:112-125`)와 `TopicWordsCard.tsx:104-118` 이 같이 쓴다. 안내 줄은 `labels.inProgressNotes()`(저장됨 + 지난 날) 위에 `topicLogic.wipCardNotes(kind,date,today)` 가 챌린지 줄을 얹는다.
- **세 경우 문구**(단위 테스트가 문자열·렌더 둘 다 확인, 내가 코드로도 대조): 어제 시작한 주제 세트 = `[저장됨, 지난 날 안내]`(**"끝내면 오늘 합계에 더해져요" 없음**) · 오늘 시작한 주제 세트 = `[저장됨, "끝내면 오늘 합계에 더해져요"]`(지난 날 안내 없음) · 내 단어장 세트 = 오늘 `[저장됨, "이 세트를 끝내면 챌린지 단어를 시작할 수 있어요"]` / 어제 `[저장됨, 지난 날 안내, otherWipNote]`. `today` 를 모르면(빈 문자열) "오늘 합계"를 말하지 않는다.
- **지금 카드 출력 불변 — 직접 재현**: scratchpad 사본에 `HEAD:TodayWordsCard.tsx` 를 `TodayWordsCardHead.tsx` 로 두고 `inProgress` 상태를 두 구현으로 렌더해 문자열 비교 — 날짜 3(오늘·어제·일주일 전) × 답한 장수 5(null·0·3·10·12) × 주제 2(없음·있음) = **30조합 전부 HEAD 와 바이트 동일**. 변이: `wipCardNotes` 의 `today && sessionDate === today` 조건을 지우면 REV-125 M-1 테스트가 실패(`not ok 9`) 확인 후 원복.

### 2. M-2 (시작 상태 기계 멱등) + 409 분기 판단 — 해소 [확인], 판단은 아래

- 상태 기계(`topicSetStart.ts`): `working`(요청 중·409 재시도 대기 중, `finish()` 로만 해제)·`closed`(done·inProgress·resume 뒤 영구)·`requestOpen`(요청이 나가 있고 응답 전)·`abortedOpen`(열린 요청을 끊은 적 있음). 반환값 `boolean`으로 받아들임 여부를 알리고 훅은 `retry()` 가 받아들여졌을 때만 경과 시계를 다시 잰다(`useTopicSetStart.ts:93-95`). 바로 풀기 버튼은 `skipping` 일 때 `onClick` 을 뗀다(`TopicSetStart.tsx:66`, `aria-disabled`·`aria-busy` 유지) — 핸들러가 남아 있어도 기계가 무시하므로 이중 방어.
- **무시되는 경우 전부 확인**: ① 바로 풀기 두 번 → 둘째 `false`·요청 2건(새 단어 1 + 바로 풀기 1)·바로 풀기 요청 signal 끊지 않음 ② 다시 시도 두 번 → 둘째 `false`, 요청 중 `retry()` `false`(첫 요청 중에도), 409 재시도 대기 중 `retry()` `false`(자동 재시도만 나감) ③ 세트 확정(done)·resume·inProgress 뒤 `skip`·`retry`·`start` 모두 `false` ④ 포기(`gaveUp`)·`error` 뒤엔 다시 받아들임(`working` 해제). 허용되어야 하는 것: 새 단어 요청 중·409 재시도 대기 중 [주제 표현으로 바로 풀기] 는 받아들임(대기 화면의 정상 동작).
- **409 `{sessionId}` 분기 판단 (dev 가 Leader 지시보다 좁힌 부분)** — 코드는 `if (f.status===409) { if (abortedOpen && f.sessionId) resume else inProgress }`(`topicSetStart.ts:121-125`). 경우 표:

| 경우 | 기계의 선택 | 맞는가 |
|---|---|---|
| 새 단어 요청 중 바로 풀기 → 끊은 요청이 서버에서 이미 세트를 만들어 둘째가 409 | `resume`(덱으로) | **맞음** — 방금 취소한 요청의 세트(M-2 경합) |
| 끊은 적 없는 409(다른 기기·다른 탭의 풀던 세트) | `inProgress`(오늘 탭 + "풀던 세트가 있어요" 안내) | **맞음 · 가이드 §3-5 표 "409 `{sessionId}`(풀던 세트)" 행과 동일** |
| 409 GENERATING 재시도 대기 중 바로 풀기(끊을 열린 요청 없음) → 409 `{sessionId}` | `inProgress` | **맞음** — 대기 중엔 `requestOpen=false`(409 를 받은 순간 해제) 라 끊김으로 세지 않음. 단위 테스트가 확인 |
| 끊은 뒤 바로 풀기가 5xx → 다시 시도 → 409 `{sessionId}` | `resume`(`abortedOpen` 이 계속 true) | 대체로 맞음(끊은 요청이 만든 세트일 가능성이 가장 큼), 아래 L-2 |
| 네트워크 끊김으로 첫 요청이 오류(status 0, 끊은 적 없음) → 다시 시도 → 409 `{sessionId}`(서버엔 세트가 생김) | `inProgress`(오늘 탭) | 가이드 일치. 오늘 탭에서 [이어서 풀기] 로 복구, 데이터 손실 없음 |

- **가이드와의 일치 판정**: 취소 이력 없는 409 는 가이드 표와 **정확히 일치**한다. 취소 직후 409 를 덱으로 보내는 `resume` 은 **가이드 §3-5 표에 없는 추가 분기**(가이드가 취소 경합을 다루지 않음)이고 Leader 지시("409 후 풀던 세트로 곧바로 이동")를 **좁힌 것**이다 — 범위를 넓히지 않은 점은 안전한 방향이고 사용자가 보는 목적지(덱 vs 오늘 탭)만 바뀐다. 분류 = **implementation(Leader 지시분)**, material 아님. 다만 가이드 표·`docs/screens.md` 에는 아직 이 행이 없다(Leader 확인 3). Leader 원 지시문은 이력서에 없어(dev 인용만) 원문 대조는 못 했다 [확인 못 함].
- **변이 재현**(scratchpad 사본 `…/scratchpad/mut`, NFS·미러 무수정, 각 변이마다 원복·마지막에 미러와 diff 0 확인) — **7건 모두 테스트가 잡음**: ① 판정 분기를 뒤집기(`abortedOpen` → `!abortedOpen`) → `not ok 8`(409 분기)·`not ok 9`(그 밖 실패) 2건 ② `skip()` 의 `working && !generate` 제거 → `not ok 6`(두 번 누름) ③ `abortCurrent` 가 `abortedOpen` 을 안 세움 → `not ok 8` ④ 오류 처리에서 `requestOpen=false` 제거(409 대기를 열린 요청으로 오인) → `not ok 8` ⑤ `retry()` 의 `working` 검사 제거 → `not ok 7` ⑥ `skip()` 의 `closed` 검사 제거 → `not ok 6`·`not ok 8` ⑦ `resume` 이 `closed` 로 안 닫음 → `not ok 8`. 바로 풀기·다시 시도·409·세트 확정 뒤 재진입 4갈래가 변이에 민감한 테스트로 덮여 있다.

### 3. M-3 + L-1 (화면 스크립트) — 해소 [확인(코드 읽기·tsc·eslint, 실행 안 함)]

- **가드 위치**: `APP_ENV=PRODUCTION` 거부(20행)와 `BASE` 검증(23행: localhost·127.0.0.1 만, `:3010` 거부)이 모듈 최상위라 `main()`(Prisma 조회·`jwt.sign`·쿠키 설정·브라우저 시작)보다 앞이다. 최상위 import 중 `infra/jwt` 는 상수(`SESSION_COOKIE_NAME`)만 읽고 비밀키는 `getSecretKey()` 안에서만 읽는다(import 시 부작용 없음).
- **대기 화면 행**: `w.gen`·`w.busy409` 는 `waitText` 가 있어 `domcontentloaded`(+`.catch`) → `waitForFunction`(본문 글, 최대 60초) → 대기 문구가 보이면 **응답 보류 상태에서** 측정. 문구 일치 [확인]: `genTitle`("오늘의 「주제」 새 단어를 만들고 있어요")에 "새 단어를 만들고 있어요" 포함, `busyTitle`("다른 화면에서 새 단어를 만들고 있어요") 일치. 측정 전에 이미 덱으로 넘어갔으면 `FAIL left …`(`page.url()` 검사) — 엉뚱한 화면을 PASS 로 오인하지 않는다. 보류 `HOLD_MS` 15초(문구 확인이 대개 1초 안이라 측정이 보류 안에 끝남). `w.leave` 는 `before?.(page)` 가 `page.goto` **앞**(176행)에서 `requestfailed` 리스너를 달고 `errorText` 를 같이 출력.
- **L-1 우회 1건**(Info): 가드는 `BASE.endsWith(':3010')` 이라 `3010` 은 막지만 `03010` 처럼 앞에 0 을 붙인 인자는 정규식(`\d+`)을 통과하고 `endsWith(':3010')` 은 거짓이다(URL 은 포트를 10진수 3010 으로 해석). 의도적 입력이 필요하고 같은 한 줄이 `task043-screens.ts:25`·`challenge-smoke.ts:26` 에도 있어 T4 단독 결함은 아님.

### 4. 반원 글자 → `PartialMark` — 해소 [확인]

- `vocab/ChallengeStrip.tsx:9`·`vocab/ChallengeResultBox.tsx:8`·`lesson/ChallengeEndLine.tsx:8` 이 `import { PartialMark } from '@/components/challenge/parts'` 만 쓴다(이 export 는 `parts.tsx:30` 에 존재 — `viewBox 16`·`aria-hidden`·`data-mark="partial"`·`1em`, currentColor). T3 파일 수정 0. 단위 테스트가 세 화면에서 `data-mark="partial"` 존재·U+25D0 부재·`vocab`·`lesson`·`app/(app)/study/today` 소스 부재를 확인한다. 크기: 띠(`text-[10px]` → 10px, 원 16px 안)·결과 상자·수업 종료 줄(`text-[15px]` → 15px, 원 32px 안)로 칸 안에서 가운데 정렬(`grid place-items-center`) — 넘침 요소 없음 [코드 읽기].
- **커밋 순서 제약 [확인]**: `git ls-files src/components/challenge` 가 비어 있고 `git status` 가 `?? src/components/challenge/`(전체 미추적). T4 파일 3개가 그 폴더의 `parts.tsx` 를 import 하므로 **T4 가 T3 보다 먼저(또는 T3 없이) 커밋되면 빌드가 깨진다** → Leader 확인 1.

### 5. L-4 (출처 줄 분리) — compact 해소 · 넓은 화면 잔여 [확인 + 일부 계산]

- `topicSourceParts()` 가 `{desc, note}` 로 나누고 `topicSourceLine()` 은 `" · "` 로 이은 같은 문장(기존 문구·테스트 그대로). `TopicDeckLines` compact+주의 있음: flex 한 줄에서 설명 `min-w-0 truncate`(먼저 줄어듦) + 주의 `max-w-full flex-none break-keep`(줄어들지도 잘리지도 않음; 한 줄보다 길면 주의만 줄바꿈하고 설명은 폭 0 으로 사라짐). 주의 없는 B1("…표현으로 만든 오늘의 단어…")·넓은 화면은 기존 `line-clamp-1/2` 한 문장. 변이: 주의 span 의 `flex-none break-keep` 를 `truncate` 로 바꾸면 테스트(`not ok 10`) 실패 확인 후 원복.
- **코드로 판정 가능한 잔여(dev 의 [추측] ①을 계산으로 보강)**: 넓은 화면(`compact=false`)은 여전히 `line-clamp-2` 한 문장이라 **긴 제목 + 주의**면 문장 끝의 주의가 잘린다. 390폭 본문 폭 ≈358px·12.5px 한글 ≈11px/자 → 한 줄 ≈31자·두 줄 ≈62자. `allAi` 문구는 "「제목」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요" ≈ 제목+31자 → **제목 ≈30자 초과**에서, `mixed`/`reuse`(주의 17자 + 설명이 더 긺)는 **제목 ≈12~15자 초과**에서 주의가 잘릴 수 있다. 시드 주제("카페 주문" 4자)에선 해당 없음, 주제 제목 DB 한도는 VarChar(80~100)이라 사용자 주제가 길면 닿을 수 있다 [계산, 실측 아님]. 디자인 판단이라 결함으로 올리지 않고 Low 로 기록(L-1).
- compact(≤370폭 또는 ≤760높이)에서 360폭 본문 328px: 주의 ≈310px 이면 설명은 ≈18px 만 남아 사실상 "…" 만 보인다 — 제목은 칩·부제에 있으므로 정보 손실은 아니나 어색할 수 있다(designer 몫, dev 의 [추측] ② 와 같은 판단).

### 6. 회귀·경계 — 이상 없음

- 새 색·새 문구: 엔진·모델명·작업 번호 문구 0(단위 테스트 `화면 문구…` 통과), 반원 글자 0. `InProgressBody` 공용화로 지금 카드 출력 불변(위 30조합). 3폭: 이번 변경에서 폭 영향이 있는 것은 `TopicDeckLines` compact 분기와 `PartialMark`(고정 1em)뿐 — 가로 넘침 유발 요소 없음 [코드 읽기, 실측은 QA].

### 지적 표 (REV-128 신규·잔여)

| ID | 심각도 | 파일:줄 | 문제 · 근거 | 권고 |
|---|---|---|---|---|
| L-1 | LOW(디자인→Leader) | `vocab/TopicDeckLines.tsx:21` | 넓은 화면(2줄 모드) `line-clamp-2` 가 긴 제목에서 문장 끝의 AI 주의를 자를 수 있음(위 계산). REV-125 L-4 의 compact 쪽만 고쳐졌고 넓은 쪽은 dev 가 [추측]으로 남김 | Leader→designer: 넓은 화면도 주의를 별도 줄/앞쪽으로 둘지(코드 변경은 designer 결정 뒤) |
| L-2 | LOW | `vocab/topicSetStart.ts:66,86,122` · `useTopicSetStart.ts:61-63` | ① `abortedOpen` 은 한 번 서면 화면이 끝날 때까지 true 라, 끊은 뒤 **다른 기기에서 시작된 세트**의 409 도 `resume`(그 세트 덱)으로 간다(dev [추측] ④ 와 같음 — 데이터 손실 없음, 서버가 병행 세트를 막으므로 어차피 끝내야 하는 세트) ② `resume` 은 `notice`(`few`)·`generation`·flash 를 `putSession` 하지 않아 이 경합 경로의 덱엔 "뒤집기 카드로 풀어요" 알림이 빠진다. 출처 줄은 `aiCardCount` 로 대체되어 AI 주의는 유지됨 [확인] ③ 가이드 §3-5 표에 `resume` 행 없음 | 코드 변경 불필요(드문 경합). 문서: `docs/screens.md`·가이드 §3-5 표에 "취소 직후 409 → 그 세트 덱" 한 행 추가(Leader 일괄 갱신 때) |
| I-1 | INFO | `tests/live/task044-screens.ts:23` | 3010 거부가 `endsWith(':3010')` 이라 `03010` 입력이 통과 | `Number(PORT) === 3010` 로 비교(같은 줄이 043·challenge-smoke 에도 있음) — 선택 |
| I-2 | INFO | `tests/live/task044-screens.ts:231-235` | `w.leave` 의 `requestfailed` 가 라우트로 보류 중인(미응답) 요청이 취소될 때 발생하는지는 실행으로 확인 못 함(dev [추측] ③ 과 같음). 안 나오면 **거짓 FAIL** 쪽(거짓 PASS 아님). `measure()` 가 `documentElement` 만 봐서 `overflow-hidden` 안쪽 넘침을 못 잡는 점은 REV-125 그대로 | QA 가 처음 실행 때 `w.leave` 만 따로 확인, 안 나오면 `ctx.on('requestfailed')` 또는 서버 Trace 로 대체 |
| I-3 | INFO | `components/challenge/`(전체 미추적) ↔ T4 3파일 | 커밋 순서 제약(위 4번). REV-125 "T3 `components/challenge` import 0" 은 이 의존으로 더는 사실이 아님 — Leader 지시로 생긴 의존이고 `PartialMark` 시그니처가 바뀌면 T4 도 깨짐 | T3 와 한 커밋 또는 T3 먼저; 파일 경계 표에 한 줄 |
| I-4 | INFO | Developer 기록 | 보고 "552/552" 는 내 재실행 554(+2 는 dev-043c 쪽 동시 변경). 신규 T4 22건·30/30 은 일치 | 조치 불필요 |

### QA `high_risk_areas` 갱신 (REV-125 목록 대체 — 실행 순서 권장)

1. **취소 전파(최우선)** — 대기 화면 ←·Android 뒤로·링크·새로 고침에서 `net::ERR_ABORTED`(`w.leave` 로 확인, I-2), 서버 Trace 에서 A12 취소 여부와 대기 중 회화 탭 첫 턴 TTFA(참고치), `visibilitychange` 로는 안 끊김. **[주제 표현으로 바로 풀기] 빠른 두 번 누름 → 요청 1번·덱 도착**(M-2 해소 확인, 모바일 실터치 포함), 새 단어 요청을 막 끝낸 순간 바로 풀기 → 409 면 **그 세트 덱으로 이동**(오늘 탭 토스트 아님), 409 두 탭 동시(3초×5 후 포기 화면)·409 대기 중 바로 풀기 → 409 `{sessionId}` 는 오늘 탭 안내.
2. **어제 시작한 주제 세트를 오늘 이어 풀기** — 오늘 카드에 "끝내면 오늘 합계에 더해져요" **없음**·"지난 날 시작한 세트예요…" 있음, 내 단어장 세트(오늘·어제) 문구, 지금 카드(챌린지 없는 사용자) 풀던 세트 출력이 이전과 같음, 덱 C 줄·끝내기 메모(답 0장 포함 — REV-125 L-2 는 미조치)·결과 소급 상자.
3. **3폭×780/892**(360·390·412) — S6 첫 화면([시작하기] 가 780 에서 보임), **덱 머리 780 스크롤 0**, `tight`(≤370폭/≤760높이)에서 출처 줄: **주의가 온전히 보이고 설명이 말줄임**되는지(`d.ai` 360×780·390×760), 주의가 길 때 설명이 사라지는 모양 확인(L-1 compact), 넓은 화면 2줄에서 **긴 제목 주제**로 주의가 잘리는지(L-1) — 필요하면 시드에 긴 제목 주제 1개로 고정 응답. `PartialMark`(띠·결과 상자·수업 종료 줄) 크기·정렬·다크 한 장.
4. **360 결과 행**: [단어장에 넣기]+★+배지(REV-125 L-9), `r.added`·`r.exists`·`r.addfail`, DB 에서 **누른 카드만 `WordEntry` 생성**.
5. `challenge:null` 6경우에서 줄·토스트 0, 챌린지 없는 사용자의 오늘 탭이 지금과 같음, 단어 스모크 008 회귀.
6. 두 세트 날(첫 세트 알림 없음 → 둘째만 "오늘 챌린지 목표 달성!"), 수업 종료 줄(`goalMetNow` 토스트 1번), 회화 카드 10 kind·보조 줄 4상황.
7. 화면 스크립트: 처음 실행은 `SIZES=390x780 node --env-file=.env --import tsx tests/live/task044-screens.ts 3026`(3010 은 거부됨) — **`w.gen`·`w.busy409`·`w.leave` 3행**을 먼저 확인, 상태 id 76개 중 약 17개만 덮는 한계(REV-125)는 그대로.

### Leader 확인

1. **커밋 순서(필수)** — `src/components/challenge/` 가 아직 untracked(`??`)인데 T4 의 `ChallengeStrip.tsx`·`ChallengeResultBox.tsx`·`lesson/ChallengeEndLine.tsx` 가 그 폴더의 `parts.tsx`(`PartialMark`)를 import 한다. **T3+T4 를 한 커밋으로 묶거나 T3 를 먼저 커밋**할 것. T4 만 먼저 나가면 빌드(`next build`·webhook 배포)가 깨진다.
2. `phase2-batch-plan` 파일 경계 표에 "T4 → T3 `challenge/parts.tsx`(`PartialMark`) import" 한 줄(T3 가 시그니처를 바꾸지 않게) — 앞서 요청한 `ChallengeEndLine.tsx` 한 줄과 함께.
3. 가이드 §3-5 표·`docs/screens.md` 에 "끊은 요청 직후 409 → 그 세트 덱" 행 추가(designer 일괄 갱신 때) — 현재 코드와 문서가 한 행 어긋남(L-2).
4. L-1(넓은 화면 `line-clamp-2` 주의 잘림)은 designer 판단 대상 — 시드 주제로는 안 닿으므로 QA 전 필수는 아님.
5. 판정 PASS_WITH_NOTES → **QA 로 진행 가능**(Critical 0·High 0·Medium 0). judge C2(Codex 개입 판정)는 이 REV 뒤 Leader 가 호출 — 결과가 오면 지적마다 채택/오탐/범위 밖을 이 절에 덧붙인다.

## QA 기록

### qa-p2a (2026-10-07 — LLM 0 레인 · E 항목, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조) — **주제 세트 시작(A12) 이 필요한 흐름은 LLM 이라 실행하지 않았다**(고정 응답 부분만)
- **원본 `tests/live/task044-screens.ts 3031`(수정 없음, 6폭: 360·390·412 × 780·892) = 109 checks · fail 0**. 대기 화면 행: `w.gen`·`w.busy409`·`w.alldone` 6폭 모두 OK(가로 넘침 0·스크롤 0) · **`w.leave` = `abort on leave ok (net::ERR_ABORTED)`** — `requestfailed` 이벤트가 실제로 잡혀 "안 나오면 `w.leave` 가 FAIL 로 보일 수 있다"는 우려는 해소(원인 모호성 없음). 운영 포트 3010·PRODUCTION 거부 가드는 시작부 코드로만 확인(접속 안 함). 이 실행은 스텁 스냅샷(bd6e291+`scenarios` 빈 스텁)에서 했고 `0dfb374` 와 화면 코드 차이 없음(서버 파일만 추가 — `diff -rq` 확인).
- **보강 사본 `tests/live/p2a-qa/task044-screens-x.ts`(터치 히트 영역 `::before` 반영·다크·어절·`<img>` 주입·XSS=1(주제명을 페이로드로 치환)·모바일 에뮬레이션 DSF 2.625)**: 라이트 55 · 다크 55 · XSS 37 checks 각 **fail 1 — 전부 같은 1건 `w.alldone` 360×780(결함 #2)**. 나머지: 가로 넘침 0 · 스크롤 ≤1 · 엔진명 0 · **히트 영역 반영 44px 미만 0**(원본이 `small=…` 로 찍던 칩 `5장`·`4지선다`·`뒤집기 카드` 의 32px 는 `::before` 히트 영역으로 ≥44px — 원본의 `small` 목록은 판정이 아니라 참고 출력) · 다크 토큰 반전 PASS · `<img>` 주입 요소 0(XSS 행 37개 전부 `img=0`, 페이로드 글자가 14개 행의 본문에 그대로 보임).
- **결함 #2(Low)** `src/components/vocab/TopicSetStart.tsx:141`(`WAIT.mine`, `topicCopy.ts:121` "내 단어장으로 풀기") / 실행 `SHOT_DIR=… SHOT_ID=w.alldone SIZES=360x780 node --env-file=.env --import tsx tests/live/p2a-qa/task044-screens-x.ts 3031` / 실제: **360px 에서 주 버튼 라벨이 "내 단어장으로 풀 / 기" 로 어절 한가운데에서 줄바꿈**(스크린샷 확인, 390·412 는 한 줄) / 기대: 어절 단위 줄바꿈 또는 한 줄 / 원인 추정: 두 버튼이 `flex-1` 로 반반 나뉘는데 `break-keep` 이 없음 — 버튼 줄을 세로로 쌓거나 라벨 `break-keep`(designer 판단). 같은 CTA 행을 쓰는 `TOPIC_EMPTY` 도 같은 모양일 것 `[추측 — 이 행은 실행하지 않음]`.
- **NOT_VERIFIED(LLM·실기기)**: 대기 중 회화 탭 이동 → 첫 턴 TTFA·A12 취소의 서버 쪽 Trace(`errorCode=CANCELLED`)·고아 `claude` 프로세스 · 폴백 문구 사유별 라이브 · 두 번째 세트("오늘 4/8장" 이어서) · 합계 미달 끝내기 "4장 더" · `[단어장에 넣기]` 로 `WordEntry` 생성 확인 · 대기 화면 Android 뒤로 가기·새로 고침에서의 취소(`net::ERR_ABORTED` 는 앱 안 ← 링크만 확인) · **`[주제 표현으로 바로 풀기]` 모바일 실터치 빠른 두 번 누름**(데스크톱 에뮬레이션에서 요청 1번까지는 확인 못 함) · 409 두 탭 동시 · 실기기 갤럭시 S25+ 대기 화면.

<!-- qa-p2b-start -->
### qa-p2b (2026-10-07 08:15~ KST · LLM 레인 · D·F 실제 흐름, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조) — `[확인]` = 이번 세션에서 실행한 것, `NOT_VERIFIED` = 못 한 것
- **도구(새, `tests/live/p2b-qa/`)**: `challenge-today-live-ui.ts`(모드 `d`·`limit`·`f`) · `today-touch-probe.ts`. **고정 응답이 아니라 실제 서버·실제 DB·실제 A12/A4** — Playwright(playwright-core + 시스템 Chrome `/usr/bin/google-chrome`), 재현 조건: viewport 390×892 · DSF 2.625 · isMobile·hasTouch · 라이트 · ko-KR · Asia/Seoul · reducedMotion=reduce · 쓰기 요청 가로채지 않음(진짜 서버) · 대기는 DB·화면 문구 폴링(글꼴 로딩 별도 대기 없음) · 캡처 범위 = 상태별 화면(판정 후 삭제) · 허용 범위 = 가로 넘침 0px 예외 없음(데모 승인 기록 없음 — 픽셀 대조 `NOT_VERIFIED`, 사용자 "데모 생략" 지시 하).
- **D `d` 모드 13/13 PASS(1차 완주) → 재실행 14/14 PASS(화면 지표 체크 `V` 추가분 포함 — 같은 흐름·같은 결과, A12 Trace totalMs 4.8s·클릭→덱 6.4s)** — 단어만 켠 챌린지(10장·8장 인정)로: ① 오늘 탭 첫 화면 = 띠 "「자기소개」 챌린지 · 1일째 / 7일 · 오늘 할 일 0 / 1" + 단어 카드 "새 단어 10장 · 오늘 0/8장"·[시작하기] ② 클릭 → 대기 화면("오늘의 「자기소개」 새 단어를 만들고 있어요 · 보통 10~20초 걸려요"·[주제 표현으로 바로 풀기]) → **실제 A12 → 덱 열림 7.6s**(클릭→덱 URL, 첫 탐색 실행은 10.9s = dev 라우트 컴파일 포함) ③ **A12 Trace 1행(`A12:interactive`, totalMs 6.1~6.6s)**·덱 머리 "「자기소개」 새 단어 10장 · AI 가 만든 단어라 읽기·뜻이 틀릴 수 있어요"·카드 10장 전부 `AiWord` ④ UI 로 4장 풀기(DB 답 4) → 일찍 끝내기 시트("지금 끝내면 오늘 단어는 8장 중 4장 — ‘일부’로 남아요 …") → 결과 화면 "오늘 4/8장 — 4장 더 풀면 오늘 단어 완료예요 … [한 세트 더]" ⑤ 오늘 탭 = **띠 "단어 4/8장" · 카드 "오늘 4/8장 — 4장 더 풀면 오늘 단어 완료 · 끝낸 세트 1개 · 맞힘 4 · 틀림 0 · 건너뜀 6"·[한 세트 더]** ⑥ **[한 세트 더] → A12 0회(Trace 1→1)·덱 출처 줄 "오늘 만든 새 단어 중 안 푼 6장 + 「자기소개」 표현 4장 · AI 가 만든 단어는 틀릴 수 있어요"·이미 푼 새 단어 중복 0** ⑦ 6장(오답 2 포함) 풀고 끝내기 → 결과 "✓ 오늘 챌린지 목표 달성! … 오늘 단어 10장 풂(8장 이상)"·틀린 카드 2 각각 [단어장에 넣기] ⑧ **[단어장에 넣기] 한 번 → `WordEntry` 0→1(누를 때만)** ⑨ 오늘 탭 = **띠 "✓ 오늘 챌린지 목표 달성 · 수행 연속 1일째 · 내일도 이어 가요"·카드 "✓ 오늘 단어 완료 · 2세트 합쳐 10장 풂(8장 이상) · 맞힘 8"**·#158 단어 과제 `DONE answered 10 sets 2`. 푼 카드 → `RepetitionItem` 반영(Expr 8행 + TopicChunk). 두 요청(`POST /api/v1/vocab/sessions`) 사이 `POST /api/v1/lessons` 0회. 페이지 오류 0건.
  - **첫 두 번 실행의 FAIL 은 내 스크립트 결함**(끝내기 요청이 끝나기 전에 화면 문구로 "결과"를 오판해 /study/today 로 이동 → 세트 IN_PROGRESS 로 남음)이라 "세트 DONE 이 될 때까지 DB 폴링"으로 고쳐 다시 돌렸다(어설션은 그대로). 앱 동작 문제 아님 — 다만 **끝내기 요청 중 다른 화면으로 이동하면 끝내기가 취소되는지는 확인하지 못했다**(세트가 IN_PROGRESS 로 남았고 오늘 탭이 "풀던 세트가 있어요"를 띄운 것은 확인) `[추측 — 라우트 이동이 fetch 를 끊었을 가능성, 서버 완료 여부는 미확인]`.
- **D2 하루 시도 상한 폴백 `limit` 모드 4/5 PASS(1건은 내 스크립트 전제 판정 오류)**: 다른 주제 3개로 실제 A12 3회 소진 → 챌린지 주제로 오늘 탭 [시작하기] → **1.9s 만에 덱 열림·A12 0회(Trace 0)·카드 5장 전부 `TopicChunk`(AiWord 0)·덱 알림 "오늘 새 단어 만들기는 여기까지예요 · 「자기소개」 표현으로 골랐어요"(사유 LIMIT)** — 소진 판정 FAIL(`L-pre`)은 4번째 요청이 오늘 이미 새 단어를 만든 주제라 `reason LIMIT` 이 아니라 재사용(LIMIT 보다 먼저 판정)으로 나온 것을 내 스크립트가 못 읽은 것 → 전제 판정을 "실제 A12 3회"로 고침. **하루 시도 카운터(`attemptsByDay`)는 서버 메모리**라 dev 서버가 HMR 되면(`qa-sync.sh` 가 tutor.md 를 갱신해도) 초기화됨을 실측(동기화 직후마다 상한이 풀림 — 운영 `next start` 에서는 pm2 재시작·blue/green 배포 때만 초기화 `[가능성 높음]`).
- **F `f` 모드 9/9 PASS** — 챌린지(수업+단어 5장, 주제 자기소개) + 시드 상황 "처음 만나서 자기소개하기": ① **#59 `{scenarioId}` → `Lesson.scenarioId = 상황`·`topicId = 챌린지 주제`(대표 주제)·kind NEW** ② **#158 레슨 과제가 그 상황 수업의 `lessonId`·`GENERATING`·jobId 를 가리킨다** ③ 오늘 탭 회화 카드 "수업을 만들고 있어요 · 「자기소개」 · 1분쯤 걸려요"·**[오늘 수업 만들기] 버튼 0개**·`POST /api/v1/lessons` 0회 ④ 카드가 **폴링으로 스스로 "수업이 준비됐어요 · 5단계 · 약 15분"**(실제 A4 37.4s, 첫 시도 성공)·#158 READY 같은 lessonId ⑤ **[시작하기] → `/study/today/talk/<그 lessonId>`**·`POST /api/v1/lessons` 0회·`Lesson` 행 1개(일반 #59 `{topicId}` 새로 안 부름) ⑥ 상황 수업 #62 완료 200 → **`challenge` 객체**(`challengeId` 일치·`goalMet:false`(단어 미완)·`goalMetNow:false`·`words:null`) = **대표 주제가 챌린지 주제면 챌린지 수업으로 센다**(설계 `generate.ts:80-86` "주제 없는 상황 수업만 안 센다"와 일치) ⑦ 오늘 탭 회화 카드 "✓ 오늘 수업을 끝냈어요 · 「자기소개」 · 문제 5/5 맞힘 …"·띠 "단어 ✓ 회화"(1/2)·일반 수업 새로 안 만듦. 코드 판독으로 같은 결론: `learning/challenges/service.ts:211-227` `lessonTask` 가 `scenarioId` 로 거르지 않고(주제·kind·오늘·status≠DONE) 찾아 `lessonId` 를 돌려주고, `components/lesson/logic.ts` `deriveChallengeLessonCard` 의 ready/progress/continue 는 `task.lessonId` 로 열며 `create({topicId})`(= #59 일반 수업)는 `make`(레슨이 아직 없을 때)에서만 불린다 → qa-p2a 의 `[추측]` **확인**. (추가 관찰, Info) 일반 수업과 상황 수업이 같은 날 같은 주제로 둘 다 있으면 `lessonTask` 의 `orderBy createdAt desc` 가 최신 것을 고른다 — 이 조합은 실행 안 함(NOT_VERIFIED).
- **화면 지표 `[확인]`(390×892, 실제 흐름 상태별)**: 가로 넘침 0px 전 상태(오늘 탭 시작·대기·덱·결과·오늘 탭 달성·상황 수업 생성 중/준비됨/완료·수업 화면·LIMIT 덱) · 페이지 오류 0. 스크린샷 육안(f4 준비됨·d9 결과)에서 잘림·겹침 없음 — 단 좌하단의 둥근 "N" 은 Next dev 도구 배지(dev 서버 전용 — 운영 빌드에는 없음). **44px 미만 터치 대상 원시 rect 수**: 상태별 0~2개(오늘 탭 방식 칩 등 — 히트 영역 `::before` 미반영 raw 값, 판정은 아래 3폭 프로브).

- **3폭 프로브 `today-touch-probe.ts` PASS(360·390·412 × 892, 오늘 탭·챌린지 진행 중·단어+회화 켬, 실서버·실데이터, LLM 0)**: **가로 넘침 0px · 문서 세로 스크롤 없음(내부 스크롤 영역 1곳 = main) · 히트 영역(`::before` 확장 반영) 포함 터치 대상 최소 44px · 44px 미만 0개**. (qa-p2a 의 고정 응답 6폭 109 checks 와 별개로 실제 데이터 화면에서도 같은 결과.)
- **취소 전파 `cancel` 모드 6/6 PASS `[확인]`**(REV-125/128 high_risk 1, 실제 A12 를 대기 화면에서 끊음): ① **[오늘로] 링크**: 요청 `net::ERR_ABORTED`·Trace `CANCELLED` 1행(totalMs 2391ms)·세트 0 ② **Android 뒤로 가기(history back)** 동일(2397ms) ③ **새로 고침**: 기존 요청 ERR_ABORTED·Trace CANCELLED(2403ms)·**생성 요청이 다시 나가지 않음**(POST 3→3)·새로 고침 뒤 화면은 오늘 탭(`/study/today`)으로 돌아옴 ④ **[주제 표현으로 바로 풀기] 터치 두 번 누름**: `generate:false` 요청 **정확히 1번**·덱 도착·세트 1개(원래 A12 요청은 CANCELLED 2076ms) ⑤ **취소 3번 뒤에도 하루 시도 환불**: 정상 시작이 새 단어를 만든다(`generatedNow:true`, LIMIT 아님). 고아 `claude` 프로세스 없음.
- **A12 진행 중 회화 턴 TTFA(참고치 — `a12-overlap-ttfa.ts`, 같은 서버에서 A12 요청을 걸고 700ms 뒤 TEXT 턴, n=2 + 대조 1)**: 한가한 턴 TTFA **1.12s·1.60s** → A12 중 턴 TTFA **5.20s·4.84s**(+4.07s·+3.25s, done 6.72s·8.91s). 3번째 회차는 하루 시도 상한(LIMIT)이라 A12 없이 B1 로 252ms 만에 끝나 사실상 대조군: 턴 TTFA 1.96s(한가한 턴 1.67s 대비 +0.29s). **원인 = 비선점 직렬 LLM 큐**(A12 가 도는 5~6.6s 동안 턴이 줄을 선다 — 설계서 §5-2 가 인정한 위험). **사용자 경로로는**: 대기 화면을 떠나면(링크·뒤로·새로 고침·탭 이동) A12 가 취소되고(위 `cancel`) 큐가 풀리므로 같은 기기에서는 이 지연이 생기지 않는다 `[가능성 높음 — 하단 탭이 대기 화면에서 보이는지는 확인 안 함]`. **다른 기기·탭에서 새 단어를 만드는 중에 회화를 하면** 첫 음성이 최대 약 5초 늦어질 수 있다(5초 예산 초과 가능) — **Leader 판단 필요(수용 or 동시 두 번째 호출 순서 조정)**.
- **NOT_VERIFIED(이 task 범위 중 못 한 것)**: 360·412 폭의 **실제 흐름**(390 만 실행 — 프로브는 3폭이지만 오늘 탭 정지 화면만) · 폴백 사유 `TIMEOUT`·`FAILED`·`INVALID`·`NEW_DONE` 라이브(자연 재현 불가 — LLM 실패·30초 초과 유도 필요, LIMIT 만 라이브 확인) · **새 단어 요청을 막 끝낸 순간 바로 풀기 → 409 면 그 세트 덱으로** · **409 두 탭 동시(3초×5 후 포기 화면)** · **Android 실기기/APK 뒤로 가기·실터치**(데스크톱 에뮬레이션 터치만) · 끝내기 요청 중 화면 이동 시 서버 완료 여부(위 `[추측]`) · 같은 날 같은 주제의 일반 수업과 상황 수업이 **둘 다** 있을 때 챌린지 카드가 고르는 수업.
<!-- qa-p2b-end -->

## QA 시각 검증
<!-- 화면 task. viewport 3폭 × 2높이·DSF·브라우저·테마·locale·timezone·폰트 대기·애니메이션 off·고정 응답 fixture·캡처 범위·허용 범위·실기기 -->
- 재현 조건(qa-p2a): 원본 스크립트 = viewport 360·390·412 × 높이 780·892 · DSF 1(원본) · Chrome 147.0.7727.101 headless · 라이트 · ko-KR · Asia/Seoul · `reducedMotion=reduce` · 고정 응답(가로채기, 쓰기 요청은 503 으로 막고 기록) · 대기 화면 행은 `#47` 응답 15초 보류 후 `domcontentloaded` 로 측정. 보강 사본 = 360×780·390×892·412×892 · DSF 2.625·isMobile·hasTouch · 라이트/다크(`colorScheme`) · XSS 행은 주제명을 `<img src=x onerror=window.__x=1>` 로 치환 · 캡처 `w.alldone` 360×780 한 장(`/tmp/qa-artifacts/TheKaiwa/qa-p2a/`, 판정 직후 삭제) · 허용 범위: 가로 넘침 0px·히트 영역 포함 44px·엔진명 0 은 예외 없음.
- 데모 게이트: 승인 데모 버전과의 픽셀 대조는 하지 않았다(`NOT_VERIFIED` — 데모 승인 기록 없음, 사용자 "데모 생략" 지시 하에 진행).

## 배포 기록
<!-- Phase 2 일괄 배포 때 deployer 가 RELEASE_RESULT 근거로 기록. -->

## 최종 요약

## Leader 기록 (Phase 2 일괄 접수·결정, 2026-10-06 22:45)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev): risk=R1 · developer=opus · track=standard · demo=delta(DM-low-confidence) · 결과 JSON `/tmp/judge-task-044-intake.result.json`. **Leader 위험 보정**: R1 유지
- **데모 승인 생략 지시**: 사용자(2026-10-06) "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". 승인용 데모는 만들지 않고 designer 가 **구현 가이드**를 낸다. `check.mjs waive` 는 이 문장을 인식하지 못해(정규식: "데모" 바로 뒤 생략/없이) **정식 waive 기록은 없다** — 훅은 warn 단계라 막지 않는다.
- **`## Leader 확인 필요` 처리(Leader 결정)**: ① **스키마는 WP-DB0 단일 작성자**(`task-p2-db0-schema`) — 설계서 §11-1·§11-2 의 "T1 이 D1·D2, T2 가 D4·D5 를 쓴다" 문구는 이 결정으로 대체 ② **`src/types/plan.ts`·`src/types/lesson.ts` 와 plan/calendar·plan/day·lessons/today 라우트의 additive 변경(`challenge?`·`reason: 'CHALLENGE'`)은 T1 소유**(타입만 늘리는 변경 — T3·T4 는 소비만) ③ **`topics/pool.ts` 는 T2 가 만들되 base(B1 풀·`lessonExprCount`)를 가장 먼저 로컬로 내놓고, T1 의 `topicProgress` 는 그 뒤에 한다**(T1 의 다른 부분은 선행 가능) ④ PE 산출 파일 구성: 현재 PE 는 스키마를 `prompts/topicWords.ts` 안에 둔다 — 설계서의 `structuredResponse/topicWordsSchemas.ts` 분리와 다르지만 `schemas.ts`·`checks.ts`(task-039 구역)를 피하는 목적은 같아 **PE 구성을 따른다** ⑤ A12 레인은 **interactive**(사용자가 기다리는 호출 — 설계서 v2.3 따름, 계획서 batch 문구는 정정) ⑥ `components/lesson/LessonScreen.tsx`·`LessonEnd.tsx` 의 #62 `challenge?` 토스트는 **T4 소유**(010d-B 가 같은 `LessonEnd.tsx` 를 나중에 만진다 — T4 커밋 뒤) ⑦ QA 계정 3 은 T1→T2→T4(→T3) 순으로 **직렬**(같은 계정에 챌린지 행 1개만 가능).

## Leader 확인 필요
설계서·계획서·지시문이 서로 어긋나거나 비어 있어 이력서 작성자가 정하지 않은 항목이다.

1. **`components/lesson/**` 소유와 #62 `challenge?` 소비 화면.** 설계서 §11-2 T4 는 `components/{vocab,lesson}/**` 전체를 적었지만 계획서 C8 은 T4 를 `TodayLessonCard`·`logic` 으로 좁히고 `LessonEnd.tsx` 는 010d-B, `StageUnderstand.tsx`·`useLessonPlayback.ts` 는 012b-4 에 줬다. 이 이력서는 계획서를 따랐다. 그런데 #62 응답의 `challenge?`(수업을 끝낸 직후 "오늘 챌린지 목표 달성!")를 그릴 곳은 설계서 §5-4 순서도에만 있고 §8-3 화면 표·§11-2 T4 행에는 없다. 수업 완료 호출은 `LessonScreen.tsx`(`/complete` 호출부)에 있고 종료 카드는 `LessonEnd.tsx` 라서, 이 소비를 T4 가 맡아 두 파일을 만질지(웨이브 순서상 T4 → 010d-B 라 가능), 010d-B 로 넘길지, 이번 범위에서 뺄지 정해 주세요.
2. **LLM 직렬 슬롯에서 T4 의 위치.** 계획서 §6 순서("039 QA·A3 20회 → 041 TTFA 참고치 → PE A12 → 042 스모크 → PE 010d 시드·초안 → …")에 T4 의 대기 중 이탈 TTFA 참고치 (다)·실제 A12 라이브가 없다. 042 스모크 바로 뒤에 둘지 정해 주세요.
3. **S6 단어 카드 문구의 원천이 문서마다 조금 다르다.** 계획서 §1-2 WP-042 ⑦ 은 데모 v2 U3 카드의 B2 문구("오늘 처음 보는 「카페 주문」 단어 10장")로 가이드를 바꾸라고 적었고, 설계서 §13-5 49 는 "「카페 주문」 새 단어 10장 · 오늘 0/8장" 이다. 이 이력서는 설계서 확정본(§13-5·§4-3c 표)을 따랐다 — designer 가이드에서 확정되면 맞춰 주세요.
4. **QA 계정 3 공유.** 041·042·043·044 의 라이브가 모두 챌린지 레인 계정 3 을 쓰도록 적었다. 사용자당 진행 중 챌린지 1개·풀던 세트 409 규칙 때문에 동시에 돌리면 서로 409 라서, 시간을 나누는 순서(또는 계정 추가)를 정해 주세요.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-06 22:11 |
| - | 생략 | - | - | "데모 생략하고 진행해줘" | 10-06 23:43 |

## Leader 결정 (designer 가이드 결정 항목 확정, 2026-10-06 23:20)

- **API 필드 2건**: ⓐ "오늘 새 단어 n장 남음"(§13-5 49)은 **이번 범위에서 그리지 않는다**(원천 없음 — #158 에 칸을 더하지 않음, 2단계 후보). ⓑ 하루 시트의 "단어를 4/8장만 풀었어요"는 **T1 이 #71 `challenge.words` 에 `need`(= `dailyGoal.wordsMinAnswered`) 한 칸을 additive 로 더한다**(dev-041b 에 전달) — 같은 챌린지가 아닌 날은 designer 가이드대로 장수 없이 "목표에 못 미쳤어요".
- **고정 응답 주입**: designer **권고안**(Playwright 테스트 스크립트의 API 응답 가로채기 — 기존 테스트에 선례, 앱 코드에 테스트 훅 없음)으로 확정. 개발 전용 쿼리 방식은 쓰지 않는다(운영 빌드 혼입 위험).
- **`planReturn.ts`(챌린지 상세 ↔ 원 화면 복귀)** 는 하지 않는다(선택 사항 — 기능 손실 없음).
- 출처 문구는 설계서 v2.3("「카페 주문」 새 단어 10장")을 따르고 데모의 "오늘 처음 보는…" 문구는 쓰지 않는다. `LessonEnd.tsx` 는 Leader 결정 ⑥ 대로 T4 소유(이력서 "수정 금지" 표기는 이 결정으로 대체).

## Leader 기록 (2026-10-07, REV-125·128 이후)

- **리뷰 결과**: REV-125 → dev-044b 보완 → REV-128 PASS_WITH_NOTES (Critical0·High0·Medium0·Low2·Info4). Medium 3건 해소(변이 7건 검출).
- **409 처리 판단 수용**: dev-044b 가 "409 뒤 풀던 세트로 바로 이동"을 이 화면이 직전 요청을 스스로 취소한 경우에만 적용하고, 취소 이력이 없는 409 는 가이드 §3-5 대로 오늘 탭 + 안내로 보냈다. Reviewer 가 가이드와 충돌 없음·누락 없음으로 확인(REV-128). 모든 409 를 덱으로 보내면 사용자가 내 단어장 세트 덱으로 끌려가므로 **이 구현을 유지**한다. 잔여 L-2(한 번 취소한 뒤의 모든 409 가 덱 이동으로 처리 — 다른 기기 세트로 갈 수 있음, 데이터 손실 없음)는 후속 백로그.
- **judge C2**: `codex_required=false`(`CX-limit-unknown-hold`). 입력·결과 `scratchpad/c2-044.*`. QA 로 진행.
- **커밋 순서**: T3(task-043) 와 **한 커밋**(PartialMark import — REV-128).
- **designer 후보(wave 끝 일괄)**: 넓은 화면에서 긴 제목일 때 AI 주의 문구가 `line-clamp-2` 로 잘릴 수 있음(REV-128 L-1) · `docs/screens.md`·가이드 §3-5 표에 "취소 직후 409 → 그 세트 덱" 행 추가.
- **다음**: QA(오늘 탭 3폭·실데이터 대조, 화면 스크립트 `task044-screens.ts` 는 QA 가 실행 — `requestfailed` 이벤트 가정 확인).
