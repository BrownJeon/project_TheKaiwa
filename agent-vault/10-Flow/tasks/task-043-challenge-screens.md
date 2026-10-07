---
task_id: task-043
title: "계획표 개편·챌린지 화면 — S1~S5·S8 (IMP-0024, 설계서 T3)"
status: todo
base_ref: 5c3a701
risk_level: R1
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-040-improve-challenge-design, phase2-batch-plan, task-p2-db0-schema, task-041-challenge-core, task-042-topic-words-b2, task-044-today-integration, task-012-calendar, task-010d-scenario-roleplay]
imp: [IMP-0024]
tags:
  - type/task
  - domain/challenge
  - domain/ui
aliases:
  - 챌린지 화면
  - 계획표 개편
  - task-043
created: 2026-10-06
updated: 2026-10-06
demo_gate:
  required: true
  level: "full"
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
개선 항목 [[IMP-0024-챌린지-계획표-개편]] 의 **설계서 T3** — **계획표 탭 개편과 챌린지 전용 화면**(설계서 §8-3 의 S1~S5·S8). 정본은 `docs/design/challenge.md` v2.3 §8·§9·§13-5. 서버·API 는 [[task-041-challenge-core]] 가 만들고 이 task 는 소비만 한다.

- **계획표 `/plan`**: 맨 위 **챌린지 현황 카드**(진행 중 "n일째 / N일" · 오늘 할 일 · 달성률 · 수행 연속 / 챌린지 없음 시작 카드 / 내일 시작 / 최근 끝남 결과 한 줄) → 달력(task-012 그대로 + 챌린지 기간·달성 표시, 하루 시트에 "챌린지 n일째" 한 줄) → "분석 · 성장 기록(곧 열려요)" 자리 그대로(U9 = F1).
- **새 화면**: 챌린지 만들기(S3) · 챌린지 상세 = 수행 현황(S4) · 챌린지 하루 시트(S5) · 끝난 챌린지 결과·챌린지 기록(S8).
- 오늘 탭 연동(S6·S7)은 [[task-044-today-integration]] 몫이다.

**designer 는 승인용 데모가 아니라 구현 가이드를 낸다**(설계서 §13-5 + 데모 v2 `docs/demo/task-040-improve-challenge-design-v2.html`(승인 안 된 참고본)). 사용자 지시로 데모 승인을 생략했다 — 화면 코드 착수 전에 designer 가이드가 먼저 나온다.

## 사용자 결정
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**.
- 2026-10-06 사용자 답(AskUserQuestion, Leader 전달 — 이 이력서 작성자는 원문 대화를 보지 못함): **DB 전부 승인**(챌린지 D1·D2·D4·D5 — 모두 추가만) · **운영 배포는 모든 작업이 끝난 뒤 한 번에** · **챌린지 U3 = B2**(오늘의 단어 LLM 생성), 나머지 U1~U15·N1~N3 은 설계서 권고안으로 확정.
- 확정값 요약(설계서 §11-4a — ★ = 이 task 의 화면이 직접 따르는 것. 설계서 §11-5 의 선택 카드는 더 이상 고르는 칸이 아니라 **"확정" 표시용**이다):

| # | 결정 | 확정값 |
|---|---|---|
| U1·U2 | 데이터 모델·DB | A 새 표 `Challenge` · D1·D2·D4·D5 한 번에 승인(추가만) |
| U3 | 오늘의 단어 | **B2** — AI 가 매일 새 단어를 만든다(폴백·채움은 주제 표현) → S6·S7 은 [[task-044-today-integration]] |
| U4 | 풀 부족 | 주제 표현만(내 단어장으로 채우지 않음) |
| U5 ★ | 수업 만드는 시점 | C3+ 한 번 탭 — **[오늘 수업 만들기] 는 오늘 탭 회화 카드에만**, 계획표의 회화 줄은 오늘 탭으로 가는 줄 |
| U6 | 010d 범위 | 나눠서(A1-서버 지금 · A1-PE 039 뒤 · A2 T1 뒤 · A3+B 캡처 뒤 · 챌린지 2단계) |
| U7 | 지표 원천 | (iii) 읽을 때 계산 |
| U8 ★ | 연속·달성률 | 오늘 유예 — 오늘이 아직 안 끝났다고 달성률을 깎지 않는다 |
| U9 ★ | 계획표 IA | **F1** — 맨 위 챌린지 현황 카드 + 달력 유지 |
| U10 ★ | 탭 이름 | **"계획표" 유지** |
| U11 ★ | 기간·장수 | 7·14·30일 · 단어 5·10·15장(기본 표현 수를 넘는 장수는 비활성 + 이유 — 시드 주제는 15 비활성) |
| U12 ★ | 무엇을 셀지 | (가) 같은 주제면 어디서 했든 + 시작일이 오늘이면 만들기 전 공부도 |
| U13 ★ | 개수·조작 | 진행 중 1개 · 그만두기만(일시정지·목표 수정·기간 연장 없음) |
| U14 ★ | 하루 달성 기준 | W2 — 목표 장수의 80%(5→4·10→8·15→12)를 그날 합산 + 다시 풀기도 셈 + 수업은 끝내기만(W4 없음) |
| U15 | 주제 세트 다시 풀기 | A — 주제 세트로 다시 풀기 + 통계 포함 |
| N1 | [단어장에 넣기] | A — 바로 넣기 |
| N2 ★ | 챌린지 이름 | A — 자동 "<주제> N일 챌린지"(입력 단계를 늘리지 않음) |
| N3 ★ | [오늘 수업 만들기] 위치 | A — 오늘 탭 회화 카드에만 |
| 설계 판단 | 예문·A12 | E2 예문 없음 · fast(haiku)·[시작하기] 동기·벽시계 30초 |

## 설계 방침 (설계서 v2.3 요약)
- **IA(§8-2)**: 하단 탭 5개 그대로(회화·오늘·계획표·단어장·질문). `/plan`(하단 탭 보임, 스크롤 1곳) = ① 챌린지 현황 카드 ② 달력 + 챌린지 기간·달성 표시 + 하루 시트 한 줄 ③ "분석 · 성장 기록(곧 열려요)". 하위 화면은 하단 탭을 숨기고 `←` 로 돌아간다: `/plan/challenge/new`(만들기) · `/plan/challenge/:id`(상세 — 끝난 챌린지는 같은 경로가 결과 화면) · `/plan/challenges`(챌린지 기록 — 진행 중 맨 위 + 끝난 것). **경로 이름·숨김 여부의 최종안은 designer 가이드가 정한다.** 현재 `components/shell/routes.ts` 의 집중 화면 목록(`FOCUS_ROUTE_PREFIXES`)은 하단 탭과 권장 업데이트 띠를 함께 숨긴다 — 하위 화면에 같은 규칙을 쓸지는 designer 가 정한다.
- **API 소비**: #158(`GET /challenges/today` — 계획표 카드·오늘 탭용 요약, LLM 호출 없음) · #70(달력 `days[].challenge?`·`summary.challenge?`) · #71(하루 시트 `challenge?`) · #155(챌린지 기록) · #156(만들기) · #157(상세) · #159(그만두기) · #56(주제 목록 — 수준 창·끝낸 수업 수·기본 표현 수). 데이터 가져오기는 기존 `components/plan/usePlanData.ts` 방식(`apiGet`, 요청 키와 함께 상태 보관·늦게 온 응답은 순번으로 버림)을 따른다. 화면은 서버 모듈(`@/modules/**`)을 import 하지 않는다(§10-1).
- **화면 표(§8-3) — 꼭 그릴 상태**:

| # | 화면 | 핵심 내용 | API | 꼭 그릴 상태 |
|---|---|---|---|---|
| S1 | 계획표 — 챌린지 없음 | 시작 카드 + 달력 + 성장 카드 | #158(`challenge:null`)·#70·#71 | 처음 사용자 · 로딩 · #158 오류(**달력은 그대로**) |
| S2 | 계획표 — 진행 중 | 현황 카드("4일째 / 7일" · 오늘 할 일 2칸 · 달성률 · 수행 연속) + 달력 달성 표시 + 하루 시트의 챌린지 줄. **할 일 줄은 버튼이 아니라 오늘 탭으로 가는 줄**("단어 4/8장 · 오늘 탭에서 하기", "회화 · 오늘 탭에서 하기") | #158·#70·#71 | 오늘 0/2 · 1/2 · 2/2 달성 · 수업 만드는 중(줄에 "만드는 중" 글자만) · 단어 일부(n/8장) · 어제 일부(수행 연속 0 — 기준 예시) · 내일 시작 · (선택) 수업 잡이 죽은 상태 "만들지 못했어요 · 오늘 탭에서 다시 ›"(기존 실패 표시 재사용) · 한 과제만 켠 챌린지는 그 과제 줄만(꺼진 과제 줄·"0/8장" 없음). 어제 ✕ 놓침은 S4·S5·S8 에서 보이므로 S2 에서는 생략 가능 |
| S3 | 챌린지 만들기 | ① 주제 카드(수준 창 #56·끝낸 수업 수·기본 표현 수) ② 기간 7·14·30 ③ 하루 목표(수업·단어 5/10/15장 — **기본 표현 수를 넘는 장수는 비활성 + 이유**, 안내 "하루에 10장 중 8장 이상 풀면 인정 · 세트를 나눠 풀어도 합쳐서 세요"(5→4·15→12)) + 시작일(오늘·내일) ④ 확인(날짜 범위·첫 과제 미리 보기) | #56·#156 | 주제 로딩·오류 · 409 진행 중 있음(→ 그 챌린지로) · 만들기 실패 · 목표 둘 다 끔(버튼 비활성 + 이유) · 장수 초과(400 `WORD_COUNT_OVER_POOL`) |
| S4 | 챌린지 상세 — 수행 현황 | 머리(주제·기간·"n일째 / N일") · 달성률·수행 연속·최장 · 날짜 띠(✓ ◐ ✕ 오늘 예정 그만둠 — 글자·모양) · 오늘 할 일 · 주제 표현 진행 · **새 단어 진행** · 문제 점수 추이("문제 n/5") · 챌린지 누적 · [그만두기] | #157·#159 | 로딩 · 오류 · 404 · 첫날 아침(달성률 "—") · 그만두기 확인(되돌릴 수 없음) |
| S5 | 챌린지 하루 시트 | 그날 결과(수업 "문제 n/5" · 단어 **그날 합계** 맞힘/틀림/건너뜀 — 세트가 둘 이상이면 "2세트 합계") · 원본 보기(그 점수를 낸 수업 / 그날 가장 많이 푼 세트 "외 n세트") | #157 `days[]`·원본 경로(#60·#49) | MET · PARTIAL · MISSED · UPCOMING · STOPPED · 원본 삭제됨(`refExists:false`) · 한 날 세트 2개 |
| S8 | 끝난 챌린지 결과·챌린지 기록 | 결과(N일 중 M일 달성 · 최장 연속 · 누적) · [다시 도전](같은 주제로 #156, **진행 중 챌린지가 없을 때만** — 있으면 "진행 중인 챌린지가 끝나면 다시 도전할 수 있어요") · 기록 목록 | #157·#155·#156 | 완주 · 일부 · 그만둠 · 목록 빈 상태 |

- **표기 규칙(§6-1·§13-1·§13-5)**:
  - **"수행 연속 n일"**(진행 중일 때만 — 하루 목표를 다 한 날만 센다)과 달력 요약 **"연속 출석 n일"**(앱을 연 날)을 이름으로 구분한다. 이모지·색만으로 구분하지 않는다. **끝난 챌린지(COMPLETED·ENDED)는 `streak:null` 이라 수행 연속을 보이지 않고 "최장 연속 n일"만** 보인다.
  - 수업 점수는 **"문제 n/5"** 하나로(점수 0~100·"80점·90점"·"평균 85" 금지 — 가능한 값은 5문항이라 {0,20,…,100} 뿐).
  - 달성률 `rate:null`(지난 날 0)은 **"—"**. 하루 상태는 글자 + 모양 병행(✓ 달성 · ◐ 일부 · ✕ 놓침 · 오늘 · 예정 · 그만둠).
  - **그만둔 챌린지는 그만둔 직후 화면 = 며칠 뒤 화면** — 그만둔 날(미달)과 그 뒤는 전부 "그만둠"이고 "예정" 칸이 하나도 없다. 그만둔 날 달성했으면 그날은 달성으로 센다.
  - **v2.3 새 단어 진행 줄(S4)**: "새 단어 30개 — 공부 28 · 익힘 0" + 도움말 한 줄("새 단어는 날마다 새로 나와요 — 다시 풀기·복습 수업으로 익혀요"). 새 단어 0개면 줄 생략. 기본 표현 줄("기본 표현 12개 — 익힘 7 · 공부 12 · 수업 표현 +5")은 수치 그대로, 이 수치의 근거는 세트 답이 아니라 **수업**이다.
  - **누적 세트 수 = 답한 카드(맞힘+틀림) ≥ 1 인 세트만**(Leader 결정) — 기준 예시 "수업 2 · 세트 3 · 맞힌 카드 21", 3일째가 건너뛰기만이면 "수업 2 · 세트 2 · 맞힌 카드 15"(그날 하루 시트는 "건너뛰기만 함 · 푼 0장", 세트 수 표기 없음).
  - 자정 넘김 안내(도움말 한 곳): "세트는 시작한 날로, 수업은 끝낸 날로 기록돼요 · 마지막 날 자정에 마감돼요". (선택) 마지막 날 머리 "7일째 / 7일 · 오늘 자정에 마감돼요".
  - 결과 화면에 "익힘 +n" 같은 증가분은 1단계에서 그리지 않는다. "표현 12개 자세히" 칩도 없다(Leader 결정 — 2단계 후보).
  - 일본어 본문 16px↑. 주제 일본어 제목은 한국어 제목 옆 **보조 표기**라 13px 유지(`LessonTopicsScreen.tsx:35` 와 같은 크기).
- **그리지 않는 것**: 주제가 지워진 챌린지(`endReason='TOPIC_REMOVED'` — 1단계 도달 불가) · 새 단어 예문 · "새 단어 더"·미리 만들기 · 일시정지·목표 수정 · 푸시 알림 · 랭킹·공유. 화면 문구에는 task·Phase 번호·엔진명·모델명을 쓰지 않는다("AI" 까지만). **T6(챌린지 × 시나리오 하루 과제)는 보류** — 후속 한 줄(010d-B 이후 2단계 조건부).
- **재사용 부품(§8-3)**: 달력·하루 시트(task-012), `Sheet`·`BackBar`·토스트, 새 색 없이 기존 토큰(`docs/screens.md` §1). 만들기 ① 단계의 주제 카드는 `LessonTopicsScreen` 부품 재사용 여부를 designer 가 판단.
- **진행 절차**: judge intake(신규 화면 → standard 추정, 데모는 지시로 생략) → **designer 구현 가이드**(`## Designer 기록` 에 먼저, `docs/screens.md` 는 웨이브 끝에 designer 1명이 일괄 — C18) → developer → Reviewer → QA → Leader 로컬 커밋(pathspec). 디자인 판단은 designer 전담(developer·reviewer 는 디자인 스킬을 쓰지 않고 문제는 Leader 를 거쳐 designer 에게 넘긴다).

## 예상 변경 경로
- `src/components/challenge/**` — 신규(현황 카드·만들기·상세·하루 시트·결과·기록 부품과 훅)
- `src/components/plan/**` — `PlanScreen.tsx`(맨 위 카드 삽입)·`CalendarSection.tsx`·`DaySheet.tsx`·`parts.tsx`·`usePlanData.ts`·`logic.ts`
- `src/app/(app)/plan/**` — `page.tsx` + 새 경로(예: `challenge/new/page.tsx`·`challenge/[id]/page.tsx`·`challenges/page.tsx` — 이름은 designer 가이드가 확정)
- `src/components/shell/routes.ts`(하위 화면 하단 탭 숨김 규칙이 필요하면)
- `src/types/plan.ts`(설계서 §11-2 는 T3 소유로 적음 — [[task-041-challenge-core]] 가 #70·#71 응답 타입에 `challenge?` 를 더해야 해서 **Leader 확인 필요 §1**)
- 테스트: 화면 로직 단위(`src/components/plan/__tests__/**`·`src/components/challenge/__tests__/**` 신규) · `tests/live/`(화면 스모크 — 이름은 developer 가 정함)
- 문서: `docs/screens.md`(designer, 웨이브 끝 일괄 — §2 화면 목록 행·새 §16 챌린지·§5·§12 오늘 카드는 T4 와 함께)

## 완료 기준 (QA 가 실행으로 확인)
설계서 §11-2 T3 행·§8-3·§13-5 를 그대로 옮긴다. 화면 데이터는 **고정 응답**으로 상태를 전수 확인하고(계획서 §6 "T3/T4 화면(데이터 고정)"), 실서버 연동은 [[task-041-challenge-core]] 머지 뒤 QA 계정 3 으로 확인한다.

1. **화면 로직 단위 테스트**: 상태 → 문구·모양 매핑(MET·PARTIAL·MISSED·TODAY·UPCOMING·STOPPED) · `n일째 / N일` · 달성률 "—"(0÷0) · 끝난 챌린지 `streak:null` → 최장 연속만 · 누적 세트 규칙 표시(답한 카드 ≥ 1 세트만) · 수행 연속 vs 연속 출석 이름 · 할 일 줄(꺼진 과제 줄 없음) · [다시 도전] 노출 조건(진행 중이 없을 때만).
2. **상태 전수(S1~S5·S8)** — 위 화면 표의 "꼭 그릴 상태"를 전부. **360 / 390 / 412 세 폭 × 높이 780 / 892**, 가로 넘침 0, **화면당 스크롤 1곳**, 터치 **44px** 이상, 최상위 그리드 `minmax(0,1fr)`·`min-width:0`, 일본어 본문 16px↑(주제 일본어 제목 13px 보조 표기 예외), **엔진명·모델명·task/Phase 번호 0**, 새 색 없음(기존 토큰), 하단 탭은 `/plan` 에서 보이고 하위 화면에서 숨고 `←` 로 돌아옴.
3. **기준 수치 일치**(설계서 §1-3 합성 데이터 — 같은 계산 함수로 만든 고정 응답): 진행 중 오늘 아침 **"4일째 / 7일" · 달성률 "67% · 3일 중 2일" · 수행 연속 0일 · 최장 2일** → 오늘 둘 다 끝내면 **75%(4일 중 3일) · 수행 연속 1일** · 끝난 예시 "자기소개 7일 챌린지" **71%(7일 중 5일) · 최장 3일** / "길 묻기 14일 챌린지" **60%(5일 중 3일) · 최장 2일 · 그만둠**(그만둔 직후 화면 = 며칠 뒤 화면, "예정" 0칸) · 첫날 아침 달성률 "—". 문제 점수 "문제 4/5"·"문제 5/5". 누적 "수업 2 · 세트 3 · 맞힌 카드 21"(건너뛰기만 한 날 상태는 "수업 2 · 세트 2 · 맞힌 카드 15"). 새 단어 "30개 — 공부 28 · 익힘 0" + 도움말. 두 세트 날 하루 시트 "2세트 합계 — 20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)" + 원본 "가장 많이 푼 세트 외 1세트".
4. **S3 만들기 규칙**: 기본 표현 수를 넘는 단어 장수는 비활성 + 이유("이 주제 표현이 12개라 15장은 고를 수 없어요") · 고른 장수별 인정 안내(5→4·10→8·15→12 + "세트를 나눠 풀어도 합쳐서 세요") · 수업·단어 둘 다 끄면 버튼 비활성 + 이유 · 409 `ACTIVE_EXISTS` → 그 챌린지로 이동 · 400 `WORD_COUNT_OVER_POOL` · 만들기 실패 표시 · 시작일 오늘/내일 · 확인 단계에서 날짜 범위·첫 과제 미리 보기.
5. **계획표 규칙**: #158 오류에도 달력은 그대로 · 챌린지 칸이 없는 달/날은 지금 달력과 동일 · 할 일 줄이 버튼이 아니라 오늘 탭으로 가는 줄 · [오늘 수업 만들기] 버튼이 이 task 화면에 **없음**(N3 = A) · 그만두기는 확인 시트(되돌릴 수 없음) 뒤 #159 · 하루 시트에서 원본 삭제됨 상태 처리.
6. **회귀**: task-012 달력 스모크(운영 32/32 기준) 유지 — 달력 변경은 "위에 카드 추가 + 칸에 달성 표시(글자·모양)"뿐. 요약의 "연속 출석 n일"·"분석 · 성장 기록(곧 열려요)" 자리 유지. 단위 전부 + `tsc --noEmit`·변경 파일 eslint 0.
7. 실서버 연동(T1 머지 뒤, QA 계정 3): 만들기 → 현황 카드 → 상세 → 그만두기 → 기록 → 다시 도전 왕복, 달력·하루 시트의 챌린지 칸.

## 파일 경계
계획서 [[phase2-batch-plan]] §2 충돌 지도 기준.
- **소유**: C9 `components/plan/**`·`app/(app)/plan/**`·`components/shell/routes.ts` · `components/challenge/**`(신규) · (설계서 기준) `types/plan.ts`. **043 먼저** — `routes.ts` 에 새 줄이 필요한 010d-B 는 T3 로컬 커밋 뒤에 더한다.
- **금지**: `src/modules/**`(서버 — 041·042 몫) · `prisma/**` · `components/vocab/**`·`components/lesson/**`(044 — C8) · `components/talk/**`·`components/chat/**`(C10·C11: 039·012b-2·012b-4·010d-B) · `docs/design/**`(Leader 단독, C17) · `docs/demo/**`(designer) · `docs/screens.md`(designer 1명이 웨이브 끝 일괄, C18) · `tests/live/qa-session.ts`(DB0).
- **미러**: `~/.node-local/thekaiwa-043`, dev 포트 **3025**(`KAIWA_LOCAL_ROOT="$HOME/.node-local/thekaiwa-043" bash scripts/sync-local.sh`). **NFS 만 편집**, DB0 push 뒤 이 미러에서 `prisma generate` 1회. 남의 미완성 파일 때문에 `tsc` 가 깨지면 소유 밖 파일은 고치지 않고 기록 → Leader(계획서 §3 규칙 4). 종료 시 dev 서버 종료·포트 확인(`ss -ltn`), 미러 삭제는 사용자 몫. 미러 `npm run build` 허용.
- **QA 계정 3**(챌린지 레인) — 041·042·044 QA 와 시간을 나눈다(사용자당 진행 중 챌린지 1개 규칙 — 동시에 쓰면 서로 409). 이 task 의 화면 검증은 LLM 이 필요 없어 **LLM 직렬 슬롯과 무관**.
- **커밋·배포**: 로컬 pathspec 커밋만, **push 금지**(운영 배포는 모든 WP 뒤 한 번에). APK 재빌드 불필요(웹만).

## 선행·후행
- **선행**: [[task-041-challenge-core]] API(타입은 설계서 §9 로 먼저 시작 가능, 통합은 T1 로컬 커밋 뒤) · **designer 구현 가이드**(설계서 §13-5 + 데모 v2). DB 변경 없음(DB0 push 와 무관, 단 서버 연동 QA 는 push 뒤).
- **후행**: 010d-B — `components/shell/routes.ts` 줄 추가는 이 task 로컬 커밋 뒤([[task-010d-scenario-roleplay]]) · 통합 QA(운영 모드 빌드) · 운영 배포 1회.
- **형제**: [[task-044-today-integration]](병렬 — 파일 겹침 없음: 044 는 `components/{vocab,lesson}`·`app/(app)/study/today`).
- **후속(이 task 밖)**: T6 챌린지 × 시나리오 — 보류(010d-B 이후 2단계 조건부, `SnapshotKind` 추가 가능성 = 승인 밖).

## 관련 과거 이력 요약
- [[task-040-improve-challenge-design]]: 설계 정본(`docs/design/challenge.md` v2.3)과 데모 v1·v2(승인되지 않은 참고본). §13-5(47~62)가 이 화면들의 구현 가이드 변경 요구.
- [[task-012-calendar]]: 계획표 달력·출석 요약·하루 시트(#70·#71)·"분석·성장 기록 곧 열려요" 자리 — 이 task 는 그 위에 카드를 얹고 칸에 표시를 더할 뿐 달력을 다시 만들지 않는다.
- [[task-041-challenge-core]]: 소비하는 API·타입(#155~#159·#58·#62·#70·#71)의 구현 task.
- [[task-044-today-integration]]·[[task-042-topic-words-b2]]·[[task-p2-db0-schema]]: 형제·선행 task. [[task-010d-scenario-roleplay]]: `routes.ts` 후행.
- 승인된 교훈: 없음(`/이슈기록 관련` 4개 질의 0건, 2026-10-06).

## 승인 상태
- **DB**: 변경 없음(스키마 작성은 [[task-p2-db0-schema]], 승인 범위는 D1·D2·D4·D5 — 이 task 는 소비만).
- **데모**: 사용자 지시 원문(위 인용)에 따라 **데모 승인 없이 진행**한다. 신규 화면이지만 designer 는 승인용 데모가 아니라 구현 가이드를 낸다(설계서 §13-5 + 승인 안 된 참고본 데모 v2). `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다(손으로 쓰지 않음). 지시 원문은 `check.mjs waive` 규칙에 걸리지 않아 정식 waived 기록이 없다 — 이력서에는 원문만 인용하고 `waived` 로 적지 않는다. 편집 전 훅은 warn 단계라 화면 파일 수정이 막히지 않지만 경고가 쌓인다.
- **운영 배포**: 모든 작업이 끝난 뒤 Leader 가 한 번에. 이 task 단독 배포·push 금지. M4·네이티브(APK) 변경 없음.
- **판정 예상(설계서 §11-2, 최종은 judge)**: R1 · standard(신규 화면) · 데모 none(가이드만).

## 판단 기록 (judge)

## Designer 기록

- [22:41] **T3 구현 가이드 v1**(designer 신규 소환, 데모 승인 생략 지시 — 승인용 데모 없음). 승인 데모: **없음**(사용자 지시 원문 위 인용). 시각 참조 = 승인 안 된 `docs/demo/task-040-improve-challenge-design-v2.html`(설계서 v2.2 기준·U3 기본 B1) — **설계서 v2.3 와 다른 곳은 v2.3 + 이 가이드가 이긴다**. 응답 모양 = dev-041 이 만든 `src/types/challenge.ts`·`src/types/plan.ts` additive 칸 그대로 [확인 — 작업 트리 22:36 읽음].
- 적용 토큰 이름(새 색 0): `ground` `surface` `surface2` `ink` `ink2` `ink3`(비텍스트·비활성 전용) `line` `accent` `accent-soft`(배경만 — 글자 금지, screens §1-1) `on-accent` `good` `good-soft` `warn-soft`(배경만 — `warn` 글자 금지) `bad` `bad-soft` · 키프레임 `lesson-indet`(motion-safe) · `:lang(ja)`.
- 디자인 스킬: layout·component / 자체 점검 P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 2(§10).

### 0. 결정 요약 (designer 확정 — developer 는 바꾸지 않고, 바꿔야 하면 Leader 경유)

| # | 결정 | 값 | 이유 |
|---|---|---|---|
| D1 | 새 경로 | `/plan/challenge/new`(만들기, `?step=1~4&again=<id>`) · `/plan/challenge/[id]`(진행 중 = 수행 현황 S4, 끝났으면 같은 경로가 결과 S8, `?day=YYYY-MM-DD&from=list`) · `/plan/challenges`(챌린지 기록) | 설계서 §8-2 그대로. `new` 정적 세그먼트가 `[id]` 보다 먼저(선례 `/study/today/talk/new`) |
| D2 | 하단 탭 | 세 경로 모두 **숨김** — `components/shell/routes.ts` `FOCUS_ROUTE_PREFIXES` 에 `'/plan/challenge/'`·`'/plan/challenges'` 두 항목 추가(그 밖 무변경) | screens §2 "하위 화면은 탭 숨김 + ←". 부수효과(권장 업데이트 띠도 숨음)는 **받아들인다** — 지금도 탭을 숨기는 하위 화면(`/study/today/talk/new`·`/study/today/eval/history`)이 같은 목록이라 띠가 숨는다(선례). 목록을 둘로 쪼개면 010d-B 가 같은 파일에서 또 판단해야 한다. 강제 업데이트 띠는 그대로 보인다(`AppUpdateBanner` forced 분기) |
| D3 | 화면 골격 | S3 = `flex h-full min-h-0 flex-col`: BackBar·단계 표시(flex-none) + **본문 한 곳만 스크롤**(`min-h-0 flex-1 overflow-y-auto`) + 아래 행동 줄(flex-none, `pb-[max(12px,env(safe-area-inset-bottom))]`) — `LessonEnd` 방식, sticky 없음. S4·S8·기록 = 셸 `main` 스크롤 + `BackBar sticky`(`VocabResult` 방식 — 공용 `Sheet` 가 `main` 스크롤을 잠그므로 시트가 있는 화면은 이쪽) | 화면당 스크롤 1곳 · sticky 는 상단 요약만 |
| D4 | 만들기 진행 | 4단계를 한 경로에서. 단계 = 주소 `?step=`(`router.push` — 휴대폰 뒤로 = 이전 단계), BackBar ← = 단계 1 은 `/plan`("계획표로"), 2~4 는 `?step=n-1`("이전 단계로"). 입력값 = 컴포넌트 상태 + `sessionStorage kaiwa.challenge.draft`(`{v:1, topicId, lengthDays, lesson, words, wordCount, start}` — 새로 고침·뒤로 보존, 성공하면 지움, 모든 접근 try/catch = `components/common/storage`). `?step` 이 2 이상인데 주제가 비면 1 로 | 단계 사이 이동을 브라우저 뒤로와 같게 |
| D5 | 만들기 성공 | `router.replace('/plan')` + 계획표에서 토스트 한 번 "챌린지를 시작했어요 · 오늘 탭에서 첫 과제를 해요"(`sessionStorage kaiwa.challenge.flash`, 읽고 지움) | 계획표 카드가 매일 보는 자리. replace 라 뒤로 가도 만들기로 안 돌아감 |
| D6 | [다시 도전] | `/plan/challenge/new?again=<끝난 챌린지 id>` → #157 로 같은 주제·기간·목표를 채우고 시작일 = 오늘로 **④ 확인 단계**에서 연다(바로 POST 하지 않음) | 날짜 범위를 보고 누르게. 주제가 없어졌으면 ① 로 + 안내 |
| D7 | 주제 카드 | `LessonTopicsScreen` 의 `TopicRow` 를 재사용하지 않고 `components/challenge/TopicRadioCard.tsx`(라디오) 신규 — **같은 시각 규칙**(min-h 72·rounded-[14px]·border-line·bg-surface·제목 15 semibold + 일본어 제목 13px ink2 보조 표기·설명 2줄·수준 Badge neutral) | `TopicRow` 는 내보내지 않는 파일 안 부품이고 시트를 여는 버튼이다. `components/lesson/**` 는 T4·012b-4·010d-B 구역(C8). 010d-B 상황 카드가 같은 모양이 필요하면 이 부품을 import(010d 이력서에 한 줄 — Leader) |
| D8 | 장수 고르기 | 공용 `Segmented` 에 비활성 칸이 없어 `components/challenge/ChoicePills.tsx` 신규(`role=radiogroup`, 칸마다 `aria-disabled`+`aria-describedby`=이유 문장 id, 보이는 높이 36 + `before:` 히트 44 — `Segmented` 와 같은 방식). 공용 `Segmented` 는 고치지 않는다 | 소유 밖 공용 부품 변경 회피 |
| D9 | 하루 표시 모양(글자+모양) | 단일 출처 `components/challenge/challengeCopy.ts` `DAY_VIEW`: MET `✓` "달성"(good-soft 바탕·good 글자) · PARTIAL `◐` "일부"(warn-soft 바탕·ink 글자) · MISSED `✕` "놓침"(surface 바탕·ink2 글자·ink3 1.5px 안쪽 테) · TODAY `·` "오늘"(surface·accent 2px 안쪽 테) · UPCOMING 빈 칸 "예정"(surface2·ink2) · STOPPED `–` "그만둠"(surface2·ink2). 색만으로 구분하지 않는다(글자·모양 둘 다) | §6-1·§13-1 6 |
| D10 | 고정 응답(QA) | 권고 **A = Playwright `context.route` 로 응답 바꿔치기**(선례 `tests/live/task010-ui-e2e.mjs:506`·`task036-ui.mjs:173`) — §6 | 운영 코드에 분기 0 |
| D11 | 달력 | 칸의 첫 칩 자리에 **챌린지 모양 칩**(원형 17px, MET·PARTIAL·MISSED 만) + 칸 아래 **3px accent 띠**(STOPPED 를 뺀 챌린지 날 전부 — 예정 날 포함) + 범례 4항목("챌린지 기간"·"✓ 목표 달성"·"◐ 일부"·"✕ 놓침")은 **그 달에 챌린지 날이 있을 때만**. 칸 크기 66px·칩 최대 3+n·roving tabindex·요약 3칸은 그대로 | §8-1 F1 "위에 카드 + 칸에 달성 표시만" |
| D12 | 하루 시트 챌린지 줄 | 복습 줄 아래 상자 링크 1개 → `/plan/challenge/[id]?day=<그날>` | §8-2. 인정 장수는 #71 에 없어 #158 `dailyGoal.wordsMinAnswered`(같은 챌린지일 때)로 보충(§11 ①) |
| D13 | (선택·마지막 단계) 원본에서 챌린지로 돌아오기 | `shell/planReturn.ts` 의 계획표 주소 허용(`PLAN_HREF`)에 `/plan/challenge/<id 1~40자 [A-Za-z0-9_-]>`(+`?day=`) 추가, 라벨은 그 주소일 때 "챌린지로"(`usePlanReturn` 이 라벨을 고르게) + 단위 테스트(다른 경로·`//`·백슬래시 거절 유지). 안 하면 원본의 ← 는 원래 자리(오늘로)로 간다 — 기능 손실 없음 | task-012 "원본에서 돌아오기" 규칙을 챌린지 하루 시트에도. 소유 = T3(C9 셸 영역, 다른 WP 가 안 만짐) |

### 1. 레이아웃 설계 (page-layout-designer 7항목)

| 항목 | 계획표 `/plan` | S3 만들기 | S4 상세 · S8 결과 | 기록 `/plan/challenges` |
|---|---|---|---|---|
| 목표 | 오늘 챌린지에서 **무엇이 남았나**와 **얼마나 잘 하고 있나**를 첫 화면(≈780)에서 | 4번 누르면 시작(주제 → 기간 → 목표 → 확인) | 날짜별 수행·지표를 한 화면에, 끝난 챌린지는 결과 | 지난·진행 중 챌린지를 찾기 |
| 주요 위계 | ① 챌린지 카드(n일째 · 오늘 할 일 · 달성률·수행 연속) ② 달력(띠·모양) ③ 성장 카드 "곧 열려요"(그대로) | 단계 표시 → 질문 1개 → [다음] | ① 지표 3칸 ② 날짜 띠 ③ 오늘 할 일 ④ 주제 표현·새 단어 ⑤ 점수 추이 ⑥ 누적 ⑦ 규칙(접힘) ⑧ 그만두기(맨 아래, 위험) / 결과: ① 결과 머리 ② 날짜 띠 ③ 해낸 것 ④ 다음 챌린지 | 진행 중 1행 → 끝난 것(끝난 날 역순) |
| 영역 | AppBar · 카드 · 달력 섹션(task-012 그대로) · 성장 카드 | BackBar · 단계 줄 · 본문(스크롤) · 행동 줄 | BackBar(sticky) · 본문(main 스크롤) · 시트 2종(하루·그만두기) | BackBar(sticky) · 목록 · 더 보기 |
| 컴포넌트 | `ChallengePlanCard`(+`TaskRows`·`StatTiles`) · 기존 `CalendarGrid`·`SummaryRow`·`DaySheet`(+`ChallengeDayLine`) | `StepIndicator` · `TopicRadioCard` · `RadioCard` · `CheckCard` · `ChoicePills` · `Segmented`(시작일 — 비활성 없음이라 공용 그대로) · `ConfirmSummary` | `StatTiles` · `DayStrip` · `TaskRows` · `TopicProgressBlock` · `ScoreTable` · `TotalsTiles` · `ChallengeDaySheet` · `EndChallengeSheet` · `ResultHero` | `ChallengeListRow` |
| 상태 | §3 표(카드 6변형 × 오늘 할 일 상태) | §3-3 표 | §3-4·§3-5·§3-6 표 | 로딩·빈·오류·더 보기 |
| 행동 | 주: [자세히] · 할 일 줄 → 오늘 탭 / 없음: [챌린지 시작] / 끝남: [다시 도전]·[결과 보기] | 주: [다음]·[챌린지 시작] | 주: 날짜 칸 → 하루 시트 · [오늘 탭에서 하기] / 위험: [그만두기](확인 시트) / 결과: [다시 도전]·[다른 주제로] | 행 → 상세 |
| 반응형 | 360: 카드 지표 2칸 그대로(각 ≥156px), 할 일 줄 글이 2줄로 감김 · 달력 칸 ≈43px(기존 히트 확장) | 라디오 카드 1열 · 장수 칩 3칸(각 ≥96px) · 시작일 2칸 | 날짜 띠 `grid-cols-7`(14·30일은 줄바꿈 2·5줄), 칸 ≈43px + 좌우 2px 히트 확장(달력과 같음) · 지표 3칸 `grid-cols-3`(값 20px) | 1열 |

### 2. 경로 · 셸 · 서버 페이지

| 경로 | `page.tsx`(서버) | 화면(클라이언트) | ← (BackBar) | 하단 탭 |
|---|---|---|---|---|
| `/plan` | 그대로 + 아무것도 더하지 않음(#158 은 화면이 읽는다) | `PlanScreen`(+카드) | — | 보임 |
| `/plan/challenge/new` | `auth()` 없으면 `/login?callbackUrl=…` · `todayKst()`·`dailyWordCount`(plan 페이지와 같은 계산) 넘김 · `useSearchParams` 를 쓰므로 `<Suspense fallback={null}>` | `ChallengeCreateScreen` | 단계 1 `/plan` "계획표로" · 2~4 `?step=n-1` "이전 단계로" | 숨김 |
| `/plan/challenge/[id]` | `auth()` · `todayKst()` · `<Suspense>` | `ChallengeScreen`(상태로 S4/S8 분기) | `from=list` 면 `/plan/challenges` "챌린지 기록으로", 아니면 `/plan` "계획표로"(`usePlanReturn` 이 계획표 하루 시트에서 온 경우 같은 달·날 시트로 — D12) | 숨김 |
| `/plan/challenges` | `auth()` | `ChallengeListScreen` | `/plan` "계획표로" | 숨김 |

- 하루 시트 챌린지 줄(D12)을 누를 때 `PlanScreen.openSource` 와 같은 방식으로 `rememberPlanReturn(planUrl(month, openDay), '/plan/challenge/<id>')` 를 적는다 — 상세의 ← 가 "계획표로"(같은 달·날 시트)가 된다(`planReturn.ts` 무변경으로 됨 — src 는 앱 경로면 받는다 [확인 `planReturn.ts:21-22,57-60`]).
- 새 파일은 `@/modules/**` 를 import 하지 않는다. 날짜 계산·표기는 `components/plan/logic.ts`(`dayLabel`·`daySpoken`·`timeLabel`·`addDays` 경유 — 이 파일이 이미 `infra/dates` 를 쓰는 것은 그대로)와 `components/common/format`(`kstDateKey`)·`components/vocab/format`(`formatMonthDay`)만.

### 3. 화면별 UI 구조 · 상태 · 문구 (의사코드 390px 기준. 문구는 `challengeCopy.ts` 단일 출처 — 아래 따옴표 그대로)

#### 3-1. 계획표 맨 위 `ChallengePlanCard` (S1·S2)

```
PlanScreen  div.min-w-0.px-4.pb-8
  ChallengePlanCard   ← 새로, MonthNav 위(첫 요소). 아래 달력과 간격 mt-[18px]
  section(달력 — 그대로, 아래 §3-2 변경만)
  section(분석 · 성장 기록 — 그대로)
```

| 변형(#158 → 판정 순서, 위가 이김) | 그리는 것 |
|---|---|
| `loading` | 회색 뼈대 카드(h 172, `aria-hidden`) + `p.sr-only role=status` "챌린지를 불러오는 중…" |
| `error`(#158 실패) | 카드 안 오류 상자(bad-soft·bad 글자) "**챌린지를 불러오지 못했어요.** 달력은 그대로 볼 수 있어요." + [다시 시도](44px, 밑줄 글자 버튼). **달력·하루 시트는 영향 없음** |
| `active`(`challenge.status=ACTIVE`, `today≠null`) | 아래 "진행 중 카드" |
| `tomorrow`(`challenge` 있음·`today=null`·`stats.dayIndex=0`) | 진행 중 카드와 같은 틀 — 머리 "챌린지 · **내일 시작**", 할 일 제목 "첫날 할 일 · 내일", 줄은 LATER 문구, 지표 "—"/"내일부터 셀게요" · "0일"/"내일 채우면 1일" |
| `ended`(`challenge=null` && `recentlyEnded≠null`) | 끝남 카드 |
| `none` | 시작 카드 |
| (`challenge` 와 `recentlyEnded` 둘 다) | **진행 중 카드만**(끝남은 기록에서) |

**진행 중 카드** (`section.rounded-[14px] border border-accent bg-surface p-3.5`, `aria-labelledby`=제목)
```
div.flex.items-start.justify-between
  p 12.5 ink2   "챌린지 · {dayIndex}일째 / {lengthDays}일"  (+ 마지막 날이면 " · 오늘 자정에 마감돼요")
  Link "자세히 ›"  → /plan/challenge/{id}   (min-h-11 min-w-11, 13 semibold ink 밑줄, aria-label "{title} 자세히")
h2 17 bold        {title}                    예: "카페 주문 7일 챌린지"
p 12.5 ink2       "{level} · {M월 D일} ~ {M월 D일}"   예: "N5 · 10월 3일 ~ 10월 9일"
[오늘 달성 상자]  todayMet 일 때만: ✓원 + "오늘 목표 달성!" + "수행 연속 {streak}일째예요. 내일도 이어 가요."(마지막 날: "오늘 자정에 결과가 저장돼요.")
h3 15 semibold    "오늘 할 일"  + 오른쪽 13 ink2 "{done} / {total} · {dayWord}"
TaskRows          (§3-1a)
[메모 줄]         WORDS=SHORT: "세트를 일찍 끝냈어도 괜찮아요. 오늘 탭에서 한 세트 더 풀면 오늘 푼 장수에 합쳐서 세요."
                  마지막 날: "세트는 시작한 날로, 수업은 끝낸 날로 기록돼요 — 자정을 넘겨 끝낸 세트는 이 챌린지에 들어가지 않아요."
StatTiles         grid-cols-2 gap-2 (§3-1b)
```
- `dayWord`: `todayMet` → "다 했어요" · 끝낸 과제 0 이고 SHORT 아님 → "아직 시작 전" · 그 밖 → "남은 것: 단어 · 회화"(남은 과제만, 순서 단어 → 회화).
- `done` = 상태 DONE 인 과제 수, `total` = `tasks.length`(한 과제만 켠 챌린지는 "0 / 1").
- 부제에 주제 일본어 제목은 없다(ChallengeSummary 에 칸 없음 — §11 ③).

**3-1a. `TaskRows`** (계획표 카드·S4 공용, `ul aria-label="오늘 할 일"`, 행 = `li > a|div` min-h 56, `flex gap-2.5`, 모양 원 22px `aria-hidden` + 글 열 `min-w-0 flex-1`(제목 14 semibold / 설명 12.5 ink2, 감김 허용) + 오른쪽 "가는 곳 ›"(13 semibold ink, 없으면 비움)). **버튼이 아니라 오늘 탭으로 가는 줄**(N3 = A) — 링크 전부 `/study/today`. [오늘 수업 만들기] 버튼은 T3 화면 어디에도 없다.

| 과제·상태 | 모양 | 제목 / 설명 | 가는 곳 | 화면 읽기 앞말(`sr-only`) |
|---|---|---|---|---|
| 단어 TODO | 빈 원(ink3 테) | "오늘의 단어" / "오늘 0/{need}장 · {n}장 세트 · 약 3분" | "오늘 탭에서 하기" | "할 일: " |
| 단어 IN_PROGRESS | 빈 원 | / "풀던 세트가 있어요 · 오늘 {answered}/{need}장" | "오늘 탭에서 이어서" | "할 일: " |
| 단어 SHORT | ◐ | / "오늘 {answered}/{need}장 · {need−answered}장 더 풀면 완료" | "오늘 탭에서 하기" | "덜 함: " |
| 단어 DONE | ✓ | / "{sets≥2 ? `${sets}세트 합쳐 ` : '오늘 '}{answered}장 풂({need}장 이상)" | 없음(div) | "끝냄: " |
| 단어 LATER(내일 시작) | 빈 원 | / "내일부터 · 하루 {n}장 중 {need}장 이상" | 없음 | "할 일: " |
| 회화 TODO | 빈 원 | "오늘의 회화" / "아직 안 만들었어요 · 오늘 탭에서 누르면 1분쯤" | "오늘 탭에서 하기" | "할 일: " |
| 회화 GENERATING | 도는 원(`animate-spin motion-reduce:animate-none`) | / "만드는 중 · 1분쯤" | "오늘 탭에서 보기" | "준비 중: " |
| 회화 READY | 빈 원 | / "수업이 준비됐어요 · 약 15분" | "오늘 탭에서 시작" | "할 일: " |
| 회화 IN_PROGRESS | 빈 원 | / "하던 수업이 있어요" | "오늘 탭에서 이어서" | "할 일: " |
| 회화 CONTINUE | 빈 원 | / "어제 만든 수업이 있어요 · 오늘 끝내면 오늘로 세요" | "오늘 탭에서 이어서" | "할 일: " |
| 회화 DONE | ✓ | / "끝냈어요"(S4 에서는 `days[오늘].lesson` 이 있으면 " · 문제 {c}/5") | 없음 | "끝냄: " |
| 회화 FAILED(죽은 잡 포함) | `!`(bad-soft 바탕·bad 글자) | / "만들지 못했어요" | "오늘 탭에서 다시" | "문제 있음: " |
| 회화 LATER | 빈 원 | / "내일 오늘 탭에서 만들어요" | 없음 | "할 일: " |

- `need` = `minAnswered`, `n` = `wordCount`(장수별: 5→4·10→8·15→12 — 서버가 얼린 값 그대로 쓴다, 화면이 계산하지 않음). 꺼진 과제는 `tasks` 에 없으니 그 줄을 그리지 않는다(§9-1).
- 링크 `aria-label` = "{앞말}{제목}, {설명}, {가는 곳}" 한 문장(예: "덜 함: 오늘의 단어, 오늘 4/8장 · 4장 더 풀면 완료, 오늘 탭에서 하기").
- "다른 수업 만드는 중(409)"은 #158 에 재료가 없어 계획표에서는 그리지 않는다(S6 만 — §11 ⑤).

**3-1b. `StatTiles`** (진행 중만. 칸 = `rounded-xl border border-line bg-surface px-3 py-2.5`, 값 20px bold tabular / 이름 12 ink / 보조 12 ink2)

| 칸 | 값 | 이름 | 보조 |
|---|---|---|---|
| 달성률 | `rate=null` → "—", 아니면 `Math.round(rate×100)%` | "달성률" | null 이면 `dayIndex=0` "내일부터 셀게요" / 그 밖 "오늘 채우면 생겨요" · 값이 있으면 "{elapsedDays}일 중 {metDays}일" |
| 수행 연속 | "{streak}일" | "수행 연속" | 1줄 "하루 목표를 다 한 날만 세요" + 2줄 `todayMet` "오늘까지 이어졌어요" / `dayIndex=0` "내일 채우면 1일" / 그 밖 "오늘 채우면 {streak+1}일" |

- 기준 수치(완료 기준 3): 진행 중 아침 "67% · 3일 중 2일" · "0일" · "오늘 채우면 1일" → 둘 다 끝내면 "75% · 4일 중 3일" · "1일" · "오늘까지 이어졌어요". 첫날 아침 "—" · "오늘 채우면 생겨요".
- **"지금 연속 출석"과 구분**: 같은 화면 달력 요약 셋째 칸(`SummaryRow`, "지금 연속 출석")에 **챌린지 카드가 진행 중일 때만** 보조 줄 "앱을 연 날"(12 ink2)을 더한다. 챌린지 쪽은 늘 "수행 연속" + "하루 목표를 다 한 날만 세요". 이모지·색으로 구분하지 않는다.

**끝남 카드**(`recentlyEnded`, 진행 중 없음 — `section.card` 테두리 line)
```
p 12.5 ink2  "챌린지 · {ENDED ? '그만둠' : '끝남'}"
h2 17 bold   {title}
p 13 ink     COMPLETED: "{lengthDays}일 중 {metDays}일 달성 · 최장 연속 {longestStreak}일"
             ENDED:     "{stopDay}일째에 그만뒀어요 · {elapsedDays}일 중 {metDays}일 달성 · 최장 연속 {longestStreak}일"
                        (elapsedDays=0 이면 "시작 전에 그만뒀어요")
p 12 ink2    "기록은 그대로 남아요"
BtnRow       [다시 도전](primary → /plan/challenge/new?again={id})  [결과 보기](ghost → /plan/challenge/{id})
Link ulink   "다른 주제로 시작" → /plan/challenge/new
```
- `stopDay` = `kstDateKey(endedAt)` 와 `startDate` 의 날 차이 + 1(1~lengthDays 로 자름) — #158 `result` 에 칸이 없어 계산(§11 ④). "수행 연속"은 쓰지 않는다(끝난 챌린지 `streak:null`).

**시작 카드**(`none`)
```
p 12.5 ink2  "챌린지"
h2 17 bold   "주제 하나로 매일 조금씩"
p 13 ink2    "주제를 하나 고르고 7·14·30일 중 기간을 정하면, 매일 그 주제로 단어를 풀고 회화 수업을 해요. 얼마나 잘 하고 있는지는 여기서 보여 드려요."
ul(가로, 감김) Badge neutral "하루 목표" · "오늘의 단어 {기본 장수}장" · "오늘의 회화 1개"    (기본 장수 = 설정 장수에 가장 가까운 5·10·15, 같으면 작은 쪽)
Link primary h-12 full  "챌린지 시작" → /plan/challenge/new
Link ulink 44           "챌린지 기록 보기" → /plan/challenges     (처음 사용자도 보임 — 빈 상태로 감)
```

#### 3-2. 달력 · 요약 · 하루 시트 변경 (task-012 화면 위에 덧붙이기만)

- `logic.ts`: `CellMark` 에 `{ kind: 'ch'; state: 'MET' | 'PARTIAL' | 'MISSED' }` 추가. `cellView` 가 `day.challenge` 를 보고 ① state 가 MET·PARTIAL·MISSED 면 칩 목록 **맨 앞**에 넣는다(기존 3개 + `+n` 규칙 그대로 — 챌린지 칩도 3개 안에 센다) ② `band = !!day.challenge && day.challenge.state !== 'STOPPED'` 를 돌려준다 ③ `cellLabel` 끝에 ", 챌린지 {dayIndex}일째 {달성|일부|놓침|오늘, 진행 중|예정|그만둠}".
- `parts.tsx` `Chip`: `kind:'ch'` = 원형(`rounded-full`) 17px, D9 색·글자.
- `CalendarSection.tsx` `CalendarGrid`: `band` 면 칸 안에 `span aria-hidden absolute inset-x-[5px] bottom-px h-[3px] rounded-[2px] bg-accent`(누를 수 없는 미래 칸 `span` 에도). `CalendarLegend` 에 `showChallenge` prop — true 면 "챌린지 기간"(17×3 띠)·"목표 달성"(✓칩)·"일부"(◐)·"놓침"(✕) 4항목을 끝에.
- `showChallenge` = 그 달 `days.some(d => d.challenge)`. 챌린지 칸이 없는 달·날은 **지금 달력과 픽셀 동일**(완료 기준 5).
- 그만둔 챌린지의 STOPPED 칸은 띠·칩 없음(이름 읽기만 "그만둠") — 계약만으로 "그만둔 날"과 "그 뒤"를 늘 구분할 수 없어 단순화(§11 ⑦).
- `SummaryRow`: prop `attendHint`(챌린지 진행 중 && 이번 달) → 셋째 칸 이름 아래 "앱을 연 날"(12 ink2). 그 밖은 지금 그대로.
- `DaySheet`: `data.challenge` 가 있으면 복습 줄 바로 아래(없으면 상태 줄 아래) `ChallengeDayLine`:
```
Link (rounded-xl bg-surface2 px-3 py-2.5 min-h-14 flex gap-2.5) → /plan/challenge/{challengeId}?day={date}
  모양 칩 lg(30px 원형, D9)
  div.min-w-0.flex-1
    p 14 semibold  "챌린지 {dayIndex}일째 — {달성|일부|놓침|오늘|예정|그만둠}"
    p 13 ink2      (아래 표)
  span 13 semibold "챌린지 ›"
목록 끝 p 12 ink2  "기록을 지워도 챌린지 달성·통계는 그대로예요."
```

| state | 설명 줄 |
|---|---|
| MET | "하루 목표를 다 채웠어요" + 있는 것만 " · 문제 {quizCorrect}/{quizTotal}" + " · 단어 {cardCount}장 중 {correct}장 맞힘" |
| PARTIAL | 수업만: "회화는 했고 단어는 안 했어요" · 단어 `ok:true` 만: "단어는 했고 회화는 안 했어요" · 단어 `ok:false`: need 를 알면(D12) "단어를 {correct+wrong}/{need}장만 풀었어요" 모르면 "단어를 {correct+wrong}장 풀었어요 · 하루 목표에는 못 미쳤어요" + 수업이 있으면 " · 회화는 했어요" |
| MISSED | 단어가 있고 `correct+wrong=0`: "건너뛰기만 해서 ‘놓침’이에요" · 그 밖 "이날은 챌린지 공부가 없었어요" |
| TODAY | "오늘 · 아직 진행 중이에요" |
| UPCOMING | "그날 오늘 탭에서 할 수 있어요" |
| STOPPED | "챌린지를 그만둔 뒤라 세지 않아요" |

- 링크 `aria-label` = "챌린지 {n}일째 {상태}, {설명}, 챌린지 화면에서 보기". 누르기 전에 `rememberPlanReturn(planUrl(month, openDay), '/plan/challenge/'+id)`(§2).

#### 3-3. S3 만들기 `/plan/challenge/new` — `ChallengeCreateScreen`

```
div.flex.h-full.min-h-0.flex-col.bg-ground
  BackBar  title="챌린지 만들기" subtitle="{step} / 4 · {주제|기간|목표|확인}"  (← D4)
  StepIndicator  ol aria-label="챌린지 만들기 4단계" — 4칸(원 22px 번호/✓ + 이름 12px), 지금 칸 aria-current="step" accent 테, 끝낸 칸 ✓
  div.min-h-0.flex-1.overflow-y-auto.px-4.pb-6.pt-3   ← 한 곳 스크롤
     [진행 중 안내 상자]   (#158 이 ACTIVE 를 주면 어느 단계든 맨 위 — 아래 409 상자와 같은 문구·버튼, [다음] 막음)
     단계 본문(아래)
  div.flex-none.border-t.border-line.bg-surface.px-4.pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]
     [이유 줄 role=alert 12.5 bad]   (막힌 [다음]을 눌렀을 때만)
     Btn primary h-12 w-full  단계 1~3 "다음" · 4 "챌린지 시작"(busy "시작하는 중…" + 도는 원)
```
- 단계가 바뀌면 그 단계 제목(`h2 tabIndex=-1`)으로 초점. [다음]이 막혔으면 `aria-disabled` + 누르면 이유 줄(`aria-describedby` 로 연결).

| 단계 | 본문 |
|---|---|
| ① 주제 | `fieldset` + `legend`(17 bold) "어떤 주제로 할까요?" + p 13 ink2 "내 수준에 맞는 주제를 보여 드려요({TopicList.level 를 · 로}). 챌린지 동안 매일 이 주제로 공부해요." + `TopicRadioCard` 목록(gap-2). 카드 = `label` 안 `input type=radio sr-only peer` + 보이는 카드(`peer-checked:ring-2 ring-accent ring-inset`, `peer-focus-visible:outline`), 줄: 제목 15 semibold + `span lang=ja 13 ink2` 일본어 제목 / 설명 13 ink2 2줄 / 메타 12 ink2 "끝낸 수업 {lessonCount}개 · {M월 D일}" 또는 good 글자 "아직 수업하지 않았어요" + " · 기본 표현 {chunks.length}개" / 오른쪽 수준 Badge neutral. **고른 카드만** 아래에 표현 미리 보기 3개 칩(`lang=ja` **16px**, 히라가나·한글 층 = `useWordLayersList`+`JaText`+`HangulLine` — 앱 표시 설정을 따름) + "외 {n−3}개 · 수업을 하면 늘어나요"(12 ink2) |
| ① 로딩 / 오류 / 빈 | 뼈대 4개(h 86, `aria-hidden`) + sr "주제를 불러오는 중…" / 오류 상자 "주제를 불러오지 못했어요." + [다시 시도] / 빈 상자 "고를 수 있는 주제가 없어요." — 셋 다 [다음] 막음("주제를 먼저 골라 주세요") |
| ② 기간 | `fieldset` legend "며칠 동안 할까요?" + p 13 ink2 "{오늘|내일} 시작하면 끝나는 날이에요. 기간은 시작한 뒤 바꿀 수 없어요." + `RadioCard` 3개: "7일" / "한 주 — 처음이라면 추천" / "{M월 D일 (요일)} ~ {M월 D일 (요일)}", "14일" / "두 주", "30일" / "한 달" |
| ③ 목표 | `fieldset` legend "하루에 무엇을 할까요?" + p 13 ink2 "고른 것을 다 끝낸 날이 ‘달성’이에요. 하나만 골라도 돼요." + `CheckCard` 2개(native checkbox): **"오늘의 단어 하루 {n}장"** / "AI 가 매일 「{주제}」 새 단어를 만들어 카드로 풀어요 · 만들지 못한 날은 주제 표현으로 풀어요" / "{고른 장수 인정 문장} · 세트를 나눠 풀어도 합쳐서 세요 · 건너뛴 카드는 세지 않아요" — **"오늘의 회화 1개"** / "「{주제}」 수업을 하루 1개 끝내요 · 약 15분 · 문제 점수와 상관없이 끝내면 완료" / "오늘 탭 회화 카드에서 [오늘 수업 만들기]를 한 번 누르면 만들어요(1분쯤)". 단어를 켰으면 아래 p 12.5 ink2 "하루 단어 장수 · 세트도 이 장수로 만들어요" + `ChoicePills` 5장·10장·15장 + 막힌 칸 이유 p 12 ink2(id 연결) **"이 주제 표현이 {chunks.length}개라 15장은 고를 수 없어요"**(둘 이상 막히면 "{가장 작은 막힌 장수}장 이상은") + 인정 문장(장수별: 5 → "하루에 5장 중 4장 이상 풀면 인정", 10 → "하루에 10장 중 8장 이상 풀면 인정", 15 → "하루에 15장 중 12장 이상 풀면 인정"). 기본 장수 = 설정 장수에 가장 가까운 고를 수 있는 값. 이어서 p 12.5 ink2 "시작하는 날" + 공용 `Segmented` 2칸 "오늘 {M월 D일}" / "내일 {M월 D일}" + 오늘이면 메모 p 12 ink2 "오늘 시작하면, 만들기 전에 오늘 끝낸 같은 주제 공부도 오늘(1일째)로 세요." 둘 다 끄면 이유 "하루 목표를 하나 이상 골라 주세요." 표현 5개 미만 주제면 단어 카드 비활성 + "이 주제 표현이 {n}개라 단어 과제를 켤 수 없어요" |
| ④ 확인 | h2 "이렇게 시작할까요?" + 카드 `dl`(grid 2열 dt 12.5 ink2 / dd 14): 이름 **"{주제} {N}일 챌린지"**(자동 — N2, 입력칸 없음) · 주제 "{주제} `span lang=ja 13 ink2`{일본어 제목} · {수준}" · 기간 "{M월 D일 (요일)} ~ {M월 D일 (요일)} · {N}일" · 하루 목표 "오늘의 단어 하루 {n}장({need}장 이상 풀면 완료) + 오늘의 회화 1개"(켠 것만) + h3 "{오늘|내일} 할 일 · 1일째" + `TaskRows`(TODO/LATER 미리 보기, 링크 없음) + h3 "이렇게 세요" + ul 12.5: "같은 주제면 오늘 탭 어디서 공부해도 세요." · "하루 목표를 다 채운 날이 ‘달성’, 일부만 한 날은 ‘일부’예요." · "단어는 하루에 푼 장수를 합쳐서 세요 — 세트를 일찍 끝냈으면 한 세트 더 풀어 채울 수 있어요." · "진행 중인 챌린지는 하나뿐이에요. 바꾸려면 그만두고 새로 시작해요." |
| ④ 시작 중 | 버튼 busy + `aria-busy`, 두 번 눌러도 요청 1번(ref) |
| ④ 400 `WORD_COUNT_OVER_POOL` | 본문 위 오류 상자 "**이 장수로는 만들 수 없어요** 「{주제}」 기본 표현이 {details.poolSize}개라 하루 {n}장은 고를 수 없어요. 장수를 줄여 주세요." + [장수 다시 고르기] → `?step=3` |
| ④ 400 그 밖·실패 | 행동 줄 이유 자리 "챌린지를 만들지 못했어요. 연결을 확인하고 다시 눌러 주세요." |
| ④ 409 `ACTIVE_EXISTS` | 본문 위 중립 상자(surface2·ink) "**이미 진행 중인 챌린지가 있어요** 챌린지는 한 번에 하나만 할 수 있어요. 새로 시작하려면 그 챌린지를 그만둔 뒤 다시 만들어 주세요." + BtnRow [진행 중 챌린지 보기](→ `/plan/challenge/{details.challengeId}`, replace) [계획표로] — [챌린지 시작] 막음 |
| ④ 404 주제 | 오류 상자 "**이 주제를 찾을 수 없어요** 주제가 지워졌거나 바뀌었어요. 주제를 다시 골라 주세요." + [주제 다시 고르기] → `?step=1` |
| ④ 429 | 이유 줄 "오늘은 챌린지를 여러 번 만들어서 더 만들 수 없어요. 내일 다시 만들어 주세요." |
| `?again=` | #157 읽는 동안 ① 대신 "불러오는 중…" → 채운 ④. 실패·404 면 ① 로 + 토스트 "지난 챌린지를 불러오지 못해 처음부터 골라요" |

#### 3-4. S4 상세(진행 중) `/plan/challenge/[id]` — `ChallengeScreen`(status=ACTIVE)

```
BackBar sticky  title={title}  subtitle="{dayIndex}일째 / {N}일 · {M월 D일} ~ {M월 D일}"(시작 전 "내일 시작 / {N}일 · …")
div.mx-auto.max-w-[520px].px-4.pb-8.pt-3
  section aria-label="수행 현황"   StatTiles3: 달성률 · 수행 연속("목표를 다 한 날만") · 최장 연속("이 챌린지에서")  grid-cols-3
     + p 12.5 ink2 메모:  fresh(elapsedDays=0 && !todayMet): dayIndex=0 "내일 시작해요. 첫날 목표를 채우면 달성률과 연속이 생겨요." / "첫날이에요. 오늘 목표를 채우면 달성률과 연속이 생겨요."
                          todayMet: "오늘 목표를 채워서 오늘도 달성률에 넣었어요. 수행 연속 {streak}일째예요."
                          그 밖: "오늘은 아직 끝나지 않아서 달성률에 넣지 않았어요. 오늘 채우면 수행 연속 {streak+1}일이 돼요."
  section h2 "날짜별"  DayStrip(§3-4a)
  section h2 "오늘 할 일 {dayIndex}일째 · {M월 D일 (요일)} · {done} / {total}"  TaskRows (+ [오늘 탭에서 하기] 없음 — 줄이 링크)
  section h2 "「{주제}」 표현"  TopicProgressBlock (topicProgress=null 이면 이 절 없음)
     p 12 ink2 "이 주제 실력이라 챌린지 전에 공부한 것도 함께 세요."
     막대 2개(제목 13 / 값 13 tabular "{mastered} / {total}", 트랙 surface2 h-1.5 · 채움 익힘=good 공부=ink2, aria-hidden — 값은 글로 있음): "익힘" chunkMastered/chunkTotal · "공부" chunkStudied/chunkTotal
     p 12.5 ink2 "수업에서 더 만난 표현 +{lessonExprCount} · 이 주제로 끝낸 수업 {lessonsDone}개{lessonsDone > totals.lessonsDone ? `(챌린지 전 ${lessonsDone − totals.lessonsDone}개 포함)` : ''}"
     [새 단어 줄]  aiWordTotal > 0 일 때만: p 14 "새 단어 {aiWordTotal}개 — 공부 {aiWordStudied} · 익힘 {aiWordMastered}" + p 12 ink2 "새 단어는 날마다 새로 나와요 — 다시 풀기·복습 수업으로 익혀요"
     공부 0(chunkStudied=0 && aiWordTotal=0): 위 막대 대신 정보 상자 "기본 표현 {chunkTotal}개 · 오늘부터 푼 만큼 여기 쌓여요. 챌린지 전에 이 주제로 공부한 것도 함께 세요."
  section h2 "문제 점수 추이"  (fresh 면 절 없음)  p 12 ink2 "수업은 5문제 중 맞힌 수, 단어는 그날 세트 합계예요."  ScoreTable(§3-4b)
  section h2 "이 챌린지에서 지금까지"  (fresh 면 절 없음)  grid-cols-3 칸: "{totals.lessonsDone}개 / 수업" · "{totals.wordSets}세트 / 오늘의 단어" · "{totals.wordsCorrect}장 / 맞힌 카드"
  details (summary min-h-11 14 semibold "챌린지는 이렇게 세요")  ul 12.5:
     "✓ 달성 = 하루 목표를 다 채운 날 · ◐ 일부 = 하나만 했거나 단어를 덜 푼 날 · ✕ 놓침 = 아무것도 안 한 날."
     "단어는 하루 {n}장 중 {need}장 이상 풀면 완료예요. 하루에 푼 장수를 합쳐서 세요. 건너뛴 카드는 푼 것으로 세지 않아요(건너뛰기만 한 세트는 공부한 날로도 세지 않아요)."
     "같은 세트를 다시 푼 장수도 하루 합계에 더해요."
     "회화는 수업을 끝내기만 하면 완료예요(문제 점수와 상관없음)."
     "같은 주제면 오늘 탭 어디서 공부해도 세요. 오늘 시작한 챌린지는 만들기 전에 끝낸 같은 주제 공부도 세요."
     "세트는 시작한 날로, 수업은 끝낸 날로 기록돼요 · 마지막 날 자정에 마감돼요."
     "달성률은 지난 날 수로 나눠요. 오늘은 채운 뒤에 들어가요."
     "수행 연속은 앱을 연 날(연속 출석)이 아니라 하루 목표를 다 한 날만 세요."
     "기록을 지워도 챌린지 달성은 그대로예요."
     (꺼진 과제가 있으면 그 과제 문장은 뺀다)
  Link ulink 44 "챌린지 기록 보기" → /plan/challenges
  div.mt-6  Btn danger w-full "그만두기"  + p 12 ink2 "그만두면 되돌릴 수 없어요. 지금까지 기록은 그대로 남아요."
```
- 상태: 로딩(뼈대 3덩이 + sr "챌린지를 불러오는 중…") · 오류(오류 상자 "**챌린지를 불러오지 못했어요.** 잠시 뒤 다시 시도해 주세요." + [다시 시도]) · 404(정보 상자 "챌린지를 찾을 수 없어요 · 주소가 바뀌었거나 이 계정의 챌린지가 아니에요." + [계획표로]) · 첫날 아침(달성률 "—") · 내일 시작 · 마지막 날("{N}일째 / {N}일 · 오늘 자정에 마감돼요" 부제) · 두 세트로 달성한 오늘 · 건너뛰기만 한 날이 있는 누적("수업 2 · 세트 2 · 맞힌 카드 15").
- `?day=YYYY-MM-DD` 로 들어오면 하이드레이션 뒤(`useSyncExternalStore` 패턴 — PlanScreen 과 같음) 그날 하루 시트를 연다. 시트를 닫거나 날을 옮기면 `history.replaceState` 로 주소 `?day=` 를 맞춘다(새로 고침·원본에서 돌아오기).

**3-4a. `DayStrip`** — `div role=group aria-label="날짜별 결과"` + `grid grid-cols-7 gap-1`, 칸 = `button` min-h 60·rounded-[10px], 좌우 `before:-inset-x-[2px]` 히트 확장(달력과 같은 방식), 안: 날짜 12 ink2 tabular("{D}({요일})", 14·30일은 "{M}/{D}") · 모양 원 22px(D9) · 단어 12("달성/일부/놓침/오늘/예정/그만둠"). `aria-label` "{M월 D일 요일}, {n}일째, {상태 말}" + `aria-haspopup="dialog"`. **roving tabindex**(Tab 한 번 + 방향키 ←→ ±1 · ↑↓ ±7 — `plan/logic.ts arrowDelta` 재사용), 시작점 = 오늘 칸(없으면 1일째). 아래 범례 `ul` 12 ink2: 그 챌린지에 있는 상태만("✓ 달성 = 목표를 다 함" · "◐ 일부 = 하나만 하거나 단어를 덜 풂" · "✕ 놓침" · "오늘" · "예정" · "– 그만둠 — 달성률에 넣지 않음").

**3-4b. `ScoreTable`** — `table`(caption sr-only "날짜별 수업 문제와 단어 맞힘") · thead "날" / "수업 문제" / "단어" · 행 = UPCOMING·STOPPED 뺀 날: `th scope=row` "{n}일째" + 12 ink2 "{M}/{D}{오늘이면 ' 오늘'}" · 수업 칸 "문제 {c}/5"(+ 5칸 점 막대 `aria-hidden`) 또는 TODAY "아직" / 그 밖 "수업 없음" · 단어 칸 "{correct}/{cardCount} 맞힘"(+ sets≥2 " · {sets}세트") · 건너뛰기만 "건너뛰기만 함" · 없음 TODAY "아직" / "안 함". 점수는 **"문제 n/5" 하나로**(점수 0~100·"80점"·"평균" 금지). 행이 8개 이상이면 최근 7개만 보이고 `details` "지난 날 모두 보기({k}일)".

#### 3-5. S5 챌린지 하루 시트 — `ChallengeDaySheet`(공용 `Sheet`)

- 제목 "{M월 D일 (요일)} · {n}일째". 본문:
```
상태 상자 (MET 은 good-soft 아닌 surface2 바탕 + 모양 원 lg — 글자 대비 유지)
  p 14 semibold "{달성|일부|놓침|오늘|{n}일째 · 예정|그만둠}"   p 13 ink2 이유(아래)
p 13 ink2  "그날 할 일 · {주제} · 오늘의 단어 하루 {n}장 중 {need}장 이상(세트 합계) + 오늘의 회화 1개"   (켠 과제만)
행 2개(달력 하루 시트 LogRow 와 같은 모양 — 종류 칩 lg "단"/"수" + 글 + ›):
  단어:  sets ≥ 2 → "오늘의 단어 {sets}세트 합계 — {cardCount}장 중 맞힘 {c} · 틀림 {w} · 건너뜀 {s}(푼 {c+w}장)"
         sets = 1 → "오늘의 단어 {cardCount}장 중 {c}장 맞힘" / "틀림 {w} · 건너뜀 {s}"
         건너뛰기만(c+w=0) → "건너뛰기만 함 · 푼 0장"(세트 수 표기 없음)
         Badge: ok → good "✓ 완료 · 푼 {answered}장({need}장 이상)" / !ok → neutral "◐ 덜 풂 · {answered}/{need}장" / 건너뛰기만 → neutral "✕ 건너뛰기만 함"
         링크(진행 중 && sessionId && refExists): "세트 결과 보기 ›"(sets≥2: "가장 많이 푼 세트 결과 보기 · 외 {sets−1}세트 ›") → /study/today/words/{sessionId}
  수업:  "오늘의 회화 「{주제}」 · 문제 {quizCorrect}/{quizTotal}" + 링크(진행 중 && lessonId && refExists) "수업 결과 보기 ›" → /study/today/talk/{lessonId}
         없음: TODAY "아직 안 했어요 · 오늘 탭에서 [오늘 수업 만들기]" / 그 밖 "하지 않았어요"
  refExists=false → 링크 없음 + Badge neutral "원본이 지워졌어요" + 아래 p 12 ink2 "원본을 지워도 챌린지 기록(달성·맞힌 수)은 그대로예요."
끝난 챌린지(status≠ACTIVE) → 링크 없음 + p 12 ink2 "끝난 챌린지라 끝날 때 저장된 결과만 보여요."
MISSED(진행 중) → p 13 ink2 "괜찮아요. 다음 날 하루 목표를 채우면 수행 연속이 다시 시작돼요."
TODAY → Link primary full h-12 "오늘 탭에서 하기" → /study/today
날 이동 줄: p 13 "{n}일째 / {N}일" + ‹ ›(44px, 처음·끝은 aria-disabled + 누르면 토스트 "첫날이에요"/"마지막 날이에요")
```
| state | 이유 문장 |
|---|---|
| MET | "하루 목표를 다 채웠어요" + `goalMetAt` 이 있으면 " · {오전|오후 h:mm}"(`plan/logic timeLabel`) |
| PARTIAL | 수업만 "회화는 했고 단어는 안 했어요" · 단어 ok 만 "단어는 했고 회화는 안 했어요" · 단어 !ok "단어를 {answered}/{need}장만 풀었어요"(+ 수업 있으면 " · 회화는 했어요") |
| MISSED | 건너뛰기만 "건너뛰기만 한 세트는 푼 것으로 세지 않아서 ‘놓침’이에요" · 그 밖 "이날은 챌린지 공부가 없었어요" |
| TODAY | "아직 진행 중이에요 · 오늘 할 일 {done} / {total}"(+ 단어 있으면 " · 단어 {answered}/{need}장") |
| UPCOMING | "그날 오늘 탭에서 할 수 있어요" |
| STOPPED | 그만둔 그날 "이날 챌린지를 그만둬서 달성률에 넣지 않아요" · 그 뒤 "그만둔 뒤라 세지 않아요" · 시작 전에 그만둠 "시작하기 전에 그만둬서 세지 않아요" |
- 데이터: 진행 중 = #157 `days[]` 그대로(`need` = `words.need`). 끝난 챌린지 = #157 `days[]`(T1 이 `result.days` 로 채움 — id 없음) — `lesson.lessonId`·`words.sessionId` 가 null 이면 링크 없음. 시트는 따로 읽지 않는다(상세 값으로 그림 — 로딩·오류 없음).
- 기준 수치: 두 세트 날 "오늘의 단어 2세트 합계 — 20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)" + "가장 많이 푼 세트 결과 보기 · 외 1세트 ›".

#### 3-6. S8 끝난 챌린지 결과(같은 `/plan/challenge/[id]`, status COMPLETED·ENDED) · 기록 `/plan/challenges`

**결과**
```
BackBar sticky title={title} subtitle="{끝남|그만둠} · {M월 D일} ~ {M월 D일}"
section.card ResultHero aria-labelledby=큰 글
  Badge: 그만둠 neutral "그만둠" · COMPLETED && metDays=lengthDays good "완주" · 그 밖 neutral "기간 끝"
  p 22 semibold (큰 글)  "{elapsedDays}일 중 {metDays}일 달성"   (시작 전 그만둠: "시작 전에 그만뒀어요")
  p 13 ink2              COMPLETED: "달성률 {rate%} · 일부 {partialDays}일 · 놓침 {missedDays}일"
                         ENDED: "{N}일 중 {stopDay}일째에 그만뒀어요 · 달성률 {rate%|—}"   시작 전: "{N}일 모두 그만둠 · 달성률 —"
section h2 "날짜별"  DayStrip(그만둠 칸 "–" "그만둠" — "예정" 칸 0개)  → 칸 → S5(끝난 챌린지 모드)
section h2 "해낸 것"  grid-cols-3: "{longestStreak}일 / 최장 연속" · "{lessonsDone}개 / 수업" · "{wordsCorrect}장 / 맞힌 카드" + p 12.5 ink2 "「{주제}」 오늘의 단어 {wordSets}세트"
                      (시작 전 그만둠: 빈 상자 "시작하기 전에 그만둬서 기록이 없어요.")
section h2 "다음 챌린지"  p 13 ink2 "같은 주제로 한 번 더 하거나, 다음 주제로 넘어가 보세요."
   진행 중 챌린지 없음(#158 challenge=null): BtnRow [다시 도전 ({N}일)](primary → /plan/challenge/new?again={id}) [다른 주제로](ghost → /plan/challenge/new)
   진행 중 있음(id 다름): 정보 상자 "지금은 「{그 title}」({dayIndex}일째)를 하고 있어요. 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요." + Link "진행 중 챌린지 보기 ›"
   (#158 실패: 버튼은 보이고, 누른 뒤 409 면 만들기 ④ 의 409 상자가 받는다)
p 12 ink2 mt-[18px] "이 결과는 챌린지가 끝날 때 한 번 저장돼요. 기록을 지워도 바뀌지 않아요."
```
- **"수행 연속"을 그리지 않는다**(끝난 챌린지 `streak:null` — 최장 연속만). 값은 `result.*` 를 쓰고 없으면 `stats`·`totals`.
- 기준 수치: 자기소개 "7일 중 5일 달성 · 달성률 71% · 최장 3일" / 길 묻기 "5일 중 3일 달성 · 14일 중 6일째에 그만뒀어요 · 달성률 60% · 최장 2일", 띠 ✓✓✕✓◐ 다음 9칸 전부 그만둠(그만둔 직후 = 며칠 뒤 같은 화면).
- `endReason='TOPIC_REMOVED'`(1단계 도달 불가)는 그리지 않는다 — 방어로 띠·지표 대신 한 줄 "주제가 지워져 이 챌린지 기록을 계산할 수 없어요"만.

**기록** `ChallengeListScreen` — BackBar sticky "챌린지 기록"(← `/plan` "계획표로"). #155 `status=ALL&limit=20`.
```
ul.flex.flex-col.gap-2  행 = Link(min-h 72 rounded-[14px] border-line bg-surface px-3.5 py-3, → /plan/challenge/{id}?from=list)
   b 15 semibold title  ·  span 12.5 ink2 설명  ·  오른쪽 Badge  ·  "›" ink2(aria-hidden)
   ACTIVE:    "{M월 D일} ~ {M월 D일} · {dayIndex}일째 · {elapsed ? `${elapsed}일 중 ${met}일 달성` : '아직 지난 날이 없어요'}"   Badge neutral 테 "진행 중"(bg-surface + ring-1 ring-ink2 — 글자 ink)
   COMPLETED: "{M월 D일} ~ {M월 D일} · {N}일 중 {met}일 달성"   Badge "완주"(good, met=N) / "기간 끝"(neutral)
   ENDED:     "{M월 D일} 시작 · {dayIndex}일째 그만둠 · {elapsed}일 중 {met}일 달성"(elapsed 0: "시작 전에 그만둠")   Badge neutral "그만둠"
p 12 ink2 "진행 중인 챌린지를 먼저, 끝난 챌린지는 끝난 날짜 순서로 보여 드려요."
nextCursor 있으면 Btn ghost w-full "더 보기"(busy "불러오는 중…", 실패 토스트 "더 불러오지 못했어요")
```
- 로딩: 뼈대 3줄(h 72) + sr "챌린지 기록을 불러오는 중…" · 오류: 오류 상자 "챌린지 기록을 불러오지 못했어요." + [다시 시도] · 빈: 점선 상자 "아직 챌린지 기록이 없어요. 주제 하나를 골라 첫 챌린지를 시작해 보세요." + Link primary "챌린지 시작".

#### 3-7. 그만두기 확인 `EndChallengeSheet`(공용 `Sheet`, busy 동안 `dismissible=false`)

- 제목 "챌린지를 그만둘까요?" · p 15 "「{title}」를 {dayIndex=0 ? '시작하기 전에' : `${dayIndex}일째에`} 끝내요." · ul 13:
  - dayIndex>1: "지금까지 기록(달성 {MET 수}일 · 일부 {PARTIAL 수}일)은 그대로 남아요."
  - dayIndex=0: "아직 시작 전이라 모든 날이 ‘그만둠’이 되고 달성률은 생기지 않아요."
  - todayMet: "오늘({dayIndex}일째)은 목표를 채워서 달성으로 넣어요 → 결과는 ‘{elapsedDays}일 중 {metDays}일 달성’."
  - 그 밖: "오늘({dayIndex}일째)은 아직 목표를 채우지 않아서 달성률에서 빠져요 → 결과는 ‘{elapsedDays ? `${elapsedDays}일 중 ${metDays}일 달성` : '달성률 —'}’."
  - "그만두면 되돌릴 수 없어요. 같은 주제로 다시 도전할 수는 있어요." · "오늘 공부는 그대로 할 수 있지만 이 챌린지에는 세지 않아요."
- BtnRow [그만두기](Btn danger, busy "그만두는 중…") [계속하기](ghost). 실패 p role=alert "그만두지 못했어요. 연결을 확인하고 다시 눌러 주세요."
- 성공(#159) → 시트 닫기 → #157 다시 읽기(결과 화면으로 바뀜) + 토스트 "챌린지를 그만뒀어요. 기록은 그대로 남아요." + 결과 큰 글로 초점. 409 `NOT_ACTIVE`(COMPLETED) → 다시 읽기 + 토스트 "이미 기간이 끝난 챌린지예요". 404 → 404 화면.

### 4. 데이터 출처 ↔ 화면 값

| 화면 값 | 원천(응답 필드) | 비고 |
|---|---|---|
| 카드 변형 | #158 `challenge`·`today`·`recentlyEnded` | §3-1 판정 순서 |
| "n일째 / N일" | `challenge.stats.dayIndex` / `lengthDays` | dayIndex 0 = 내일 시작 |
| 기간 | `startDate`·`endDate` → `formatMonthDay` | |
| 달성률 "67% · 3일 중 2일" | `stats.rate`·`elapsedDays`·`metDays` | null → "—" |
| 수행 연속 | `stats.streak`(ACTIVE 만) | 끝난 챌린지 null → 그리지 않음 |
| 최장 연속 | `stats.longestStreak` / 결과 `result.longestStreak` | |
| 오늘 할 일 | #158 `today.tasks[]`(S4 는 #157 `today`) | 순서 단어 → 회화, 꺼진 과제 없음 |
| "오늘 n/8장" | WORDS `answered`/`minAnswered` | 끝낸 세트 합계만(풀고 있는 세트 제외) |
| 회화 점수(S4 할 일 DONE) | #157 `days[dayIndex−1].lesson.quizCorrect` | 계획표 카드에는 없음 |
| 날짜 띠 | #157 `days[].state`·`dayIndex`·`date` | |
| 하루 시트 | #157 `days[i]`(`lesson`·`words`·`goalMetAt`) | 따로 읽지 않음 |
| 주제 표현·새 단어 | #157 `topicProgress.*` | #157 만(#158 없음) |
| 누적 | #157 `totals.*`(끝난 챌린지 `result.lessonsDone/wordSets/wordsCorrect`) | 세트 = 답한 카드 ≥ 1 |
| 결과 머리 | #157 `result.{metDays, elapsedDays, rate, partialDays, missedDays, stoppedDays, endReason}` | |
| 그만둔 날 n | `stats.dayIndex`(ENDED = 그만둔 날 — 타입 주석) · #158 끝남 카드는 `endedAt` 으로 계산 | §11 ④ |
| [다시 도전] 노출 | #158 `challenge`(진행 중 유무·id) | |
| 달력 칩·띠 | #70 `days[].challenge.state` | |
| "앱을 연 날" 보조 줄 | #158 진행 중 && 이번 달 | |
| 하루 시트 챌린지 줄 | #71 `challenge` + #158 `dailyGoal.wordsMinAnswered`(같은 id) | need 보충 |
| 만들기 주제 | #56 `items[]`(`chunks.length` = 기본 표현 수, `lessonCount`·`lastLessonAt`) · `level[]` | 장수 상한 = `chunks.length`, 최종 판단은 서버 400 `poolSize` |
| 만들기 결과 | #156 → `ChallengeDetail.id` | |
| 기록 | #155 `items[]`·`nextCursor` | |

### 5. 상태 관리 · 불러오기

- 불러오기 훅은 `components/plan/usePlanData.ts` 의 `useKeyedResource` 를 **export** 해서 쓴다(요청 키와 함께 상태 보관·늦게 온 응답은 순번으로 버림·`refresh` 는 지금 값 유지). `components/challenge/useChallengeData.ts`: `useChallengeToday()`(키 `'today'` 고정 + `refresh`), `useChallengeDetail(id)`, `useTopics()`, `useChallengeList()`(커서 이어 붙이기 — 이것만 자체 상태).
- 계획표: `PlanScreen` 이 `useCalendar`·`useDay` 옆에서 `useChallengeToday()` 를 부르고, 화면이 다시 보일 때(`visibilitychange` visible) **#158 만** `refresh()`(달력은 지금처럼 그대로). #158 실패가 달력 상태를 바꾸지 않는다.
- 쓰기: `apiPost('/api/v1/challenges', body)`(#156) · `apiPost('/api/v1/challenges/{id}/end', {})`(#159) — 두 번 눌러도 한 번(ref 가드). 오류 판별은 `toErr(e).status` + `detailString(err, 'reason'|'challengeId')` + `err.details?.poolSize`.
- 주소: 계획표 `?month&day&log` 그대로 · 상세 `?day`·`?from` · 만들기 `?step`·`?again`(값 검증: 날짜 형식·id `[A-Za-z0-9_-]{1,40}`·step 1~4, 틀리면 무시).
- 순수 로직(`components/challenge/logic.ts`, `today`·`now` 주입): `planCardKind` · `taskRowView(task)` · `dayWord` · `statTilesView(stats)` · `dayView(state)` · `daySheetView(day, goal, finished)` · `stopDayIndex(startDate, endedAt)` · `wordCountOptions(chunkCount)`(막힘·이유) · `minAnsweredOf(n)`(만들기 ④ 미리 보기용 — `ceil(4n/5)`, 화면 표시 전용, 판정은 서버) · `resultHeroView(detail)` · `listRowView(summary)` · `canRetry(challengeToday, id)`.

### 6. 고정 응답 주입 — QA 가 상태별 화면을 보는 방법 (developer 선택, 권고 A)

| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A (권고)** Playwright 응답 바꿔치기 | `tests/live/task043-ui.mjs`(이름은 developer) 가 `context.route('**/api/v1/challenges/today', …)`·`/challenges/*`·`/challenges?*`·`/plan/calendar*`·`/plan/day*`·`/topics*` 를 상태 id 별 JSON 으로 `fulfill`. JSON 은 `tests/live/fixtures/challenge/*.json` — **T1 의 순수 계산(`learning/challenges/metrics.ts`)을 부르는 작은 생성 스크립트**로 만든다(완료 기준 3 "같은 계산 함수로 만든 고정 응답"). 3폭 × 2높이 반복·가로 넘침·스크롤 1곳·44px·엔진명 grep 을 같은 스크립트에서 | 운영 코드 분기 0 · 선례(`task010-ui-e2e.mjs:506`·`task036-ui.mjs:173`) · 실 화면 코드 그대로 | 생성 스크립트 1개 |
| B 개발 전용 쿼리 | `useChallengeData` 가 `APP_ENV≠PRODUCTION` 일 때 `?fixture=<id>` 를 읽어 메모리 JSON 을 돌려줌 | 브라우저로 바로 봄 | 화면 코드에 시험 분기 · 운영 빌드에 고정 JSON 이 실릴 위험 — 쓰면 Reviewer 가 운영 번들 grep 확인 필수 |
| C 테스트 계정 DB 시드 | QA 계정 3 에 챌린지·스냅샷 행 직접 | 진짜 서버 | 공유 DB · 그만둔 당일·두 세트·소급 같은 상태를 만들기 어려움 · 스냅샷 불변 규칙과 충돌 — **권고하지 않음** |

상태 id(고정 응답 1개 = 화면 1장. 값은 설계서 §1-3 합성 데이터):
- S1 `s1.none` · `s1.ended`(카페 주문 오늘 그만둠) · `s1.ended-done`(자기소개 어제 끝남) · `s1.loading` · `s1.error`(#158 500, 달력 정상)
- S2 `s2.t0`(4일째 0/2·어제 일부 — 기준) · `s2.w1`(단어 먼저 1/2) · `s2.t1`(회화 먼저 1/2) · `s2.t2`(2/2 달성 — 75%·1일) · `s2.short`(단어 4/8장) · `s2.wip`(풀던 세트) · `s2.gen` · `s2.ready` · `s2.lip` · `s2.cont` · `s2.fail`(죽은 잡 FAILED) · `s2.last`(7일째) · `s2.retro`(어제 ◐→✓·수행 연속 3) · `s2.first`(오늘 시작 — "—") · `s2.tomorrow` · `s2.wordsonly` · `s2.lessononly` · `s2.both`(진행 중 + recentlyEnded → 진행 카드만) · `s2.sheet`(10/5 하루 시트 챌린지 줄)
- 달력 `cal.marks` · `cal.stopped`(길 묻기 9월) · `cal.span`(두 달에 걸친 챌린지의 지난 달) · `cal.none`(챌린지 없는 달 = task-012 와 픽셀 비교)
- 하루 시트 `day.met`·`day.partial`(need 보충)·`day.partial-noneed`(끝난 챌린지 날)·`day.missed`·`day.skiponly`·`day.today`·`day.stopped`
- S3 `s3.step1`~`s3.step4` · `s3.tload` · `s3.terr` · `s3.tempty` · `s3.cap15`(15장 막힘+이유) · `s3.nogoal` · `s3.tomorrow` · `s3.busy` · `s3.over`(400 poolSize) · `s3.fail` · `s3.c429` · `s3.c409` · `s3.c404` · `s3.active`(진입 때 진행 중 있음) · `s3.again`
- S4 `s4.normal` · `s4.two`(오늘 두 세트로 달성) · `s4.first` · `s4.tomorrow` · `s4.last` · `s4.skiponly`(누적 2·15) · `s4.noai`(새 단어 줄 없음) · `s4.fresh`(주제 공부 0 정보 상자) · `s4.end` · `s4.endbusy` · `s4.endfail` · `s4.end409` · `s4.loading` · `s4.error` · `s4.nf`
- S5 `s5.met` · `s5.partial` · `s5.today` · `s5.two` · `s5.skiponly` · `s5.upcoming` · `s5.gone` · `s5.frozen-missed` · `s5.frozen-stopped`
- S8 `s8.done` · `s8.full`(완주) · `s8.stopped` · `s8.stopmet`(6일째 달성 후 그만둠 — 6일 중 4일 67%) · `s8.stoppre`(시작 전 — 7칸 그만둠·"—") · `s8.blocked`(진행 중 있음) · `s8.r409` · `s8.list` · `s8.more` · `s8.lloading` · `s8.lempty` · `s8.lerror` · `s8.nf`

### 7. 생성/수정 파일 · 구현 순서

| 구분 | 파일 |
|---|---|
| 신규 `components/challenge/` | `challengeCopy.ts`(문구·D9 표 단일 출처) · `logic.ts`(순수) · `useChallengeData.ts` · `parts.tsx`(`DayGlyph`·`TopicChip`·`InfoBox`·`ErrorBox`) · `TaskRows.tsx` · `StatTiles.tsx` · `ChallengePlanCard.tsx` · `ChallengeDayLine.tsx` · `DayStrip.tsx` · `ScoreTable.tsx` · `TopicProgressBlock.tsx` · `ChallengeDaySheet.tsx` · `EndChallengeSheet.tsx` · `ChallengeScreen.tsx`(S4/S8 분기 + `ResultHero`) · `ChallengeListScreen.tsx` · `ChallengeCreateScreen.tsx` · `TopicRadioCard.tsx` · `ChoicePills.tsx` · `StepIndicator.tsx` · `__tests__/logic.test.ts` |
| 수정 `components/plan/` | `PlanScreen.tsx`(카드 삽입·#158·visibility·flash 토스트·`attendHint`·`showChallenge`·하루 시트 줄 연결) · `CalendarSection.tsx`(띠·범례·요약 보조 줄) · `DaySheet.tsx`(`ChallengeDayLine` 자리) · `logic.ts`(`CellMark`·`cellView`·`cellLabel`) · `parts.tsx`(`Chip` 원형) · `usePlanData.ts`(`useKeyedResource` export) · `__tests__/`(칸 표시·이름 읽기 케이스 추가) |
| 신규 `app/(app)/plan/` | `challenge/new/page.tsx` · `challenge/[id]/page.tsx` · `challenges/page.tsx` |
| 수정 셸 | `components/shell/routes.ts`(D2 두 항목) · (선택 D13) `planReturn.ts`·`usePlanReturn.ts` + `shell/__tests__` |
| 소비만(수정 금지) | `src/types/challenge.ts`·`types/plan.ts`(T1) · `types/lesson.ts`(`Topic`) |

순서: ① `challengeCopy`·`logic` + 단위 테스트(상태 → 문구·모양, "—", `streak:null`, 누적 규칙, 할 일 줄, [다시 도전] 조건, 장수 막힘) → ② `useKeyedResource` export·`useChallengeData` → ③ 공용 조각(`parts`·`TaskRows`·`StatTiles`·`DayStrip`) → ④ 계획표 카드·`PlanScreen` → ⑤ 달력 칩·띠·범례·요약·하루 시트 줄 → ⑥ `routes.ts` + 세 `page.tsx` → ⑦ S4 + S5 + 그만두기 → ⑧ S8 결과·기록 → ⑨ S3 → ⑩ (선택) D13 → ⑪ `tests/live` 고정 응답 스크립트(§6 A) + 3폭.

### 8. 360 / 390 / 412 × 780 / 892 · 접근성 체크리스트

- [ ] 가로 넘침 0(긴 챌린지 이름·주제 이름 `[overflow-wrap:anywhere] min-w-0`) · 화면당 스크롤 1곳(S3 는 본문 영역, 나머지 `main`) · 하단 탭: `/plan` 보임 · 하위 3경로 숨김 + ← 로 돌아옴.
- [ ] 첫 화면(780): 계획표 카드 전체 + 달력 머리(월 이동)까지 보임 — 412×780 기준 카드 높이 ≤ 480px(할 일 2줄·지표 2칸). 넘으면 메모 줄을 먼저 줄인다.
- [ ] 터치 ≥44px: [자세히]·할 일 줄(56)·날짜 띠 칸(60 + 좌우 2px)·장수 칩(히트 44)·시트 ‹ ›·[더 보기]·ulink.
- [ ] 일본어: 주제 일본어 제목 13px(보조 표기 예외 — `LessonTopicsScreen.tsx:35` 와 같음), 표현 미리 보기 16px + `lang=ja` + 표시 설정(히라가나·한글) 따름.
- [ ] 상태는 글자+모양(D9), 색만 금지 · `accent`·`warn` 글자 없음 · `ink3` 글자 없음(예정 칸 날짜는 ink2).
- [ ] 시트: 열면 제목 초점·닫으면 연 요소로(공용 `Sheet`) · 그만두기 busy 동안 닫기 막힘 · 하루 시트 ‹ › 경계는 `aria-disabled` + 이유 토스트.
- [ ] 날짜 띠·달력 roving tabindex(Tab 1번 + 방향키) · `aria-haspopup="dialog"`.
- [ ] 만들기: `fieldset/legend` · native radio/checkbox · 막힌 장수 칩 `aria-disabled` + 이유 `aria-describedby` · [다음] 막힘 이유 `role=alert` · 단계 이동 시 제목 초점 · busy `aria-busy`.
- [ ] 비동기: 로딩 `role=status` 문장 · 오류 `role=alert` · 성공 토스트(`role=status`).
- [ ] reduced-motion: 도는 원 `motion-reduce:animate-none`.
- [ ] 다크: 토큰만 써서 자동(새 색 0) — 390×892 다크 1장.
- [ ] 엔진명·모델명·task/Phase 번호 0(화면 글 전체 grep) — "AI" 까지만(만들기 ③ 단어 설명).

### 9. 주의사항 · 그리지 않는 것

- 그리지 않음: 결정 카드·"확정" 배지(§13-5 47 은 데모 전용 — 구현 화면에는 결정 UI 가 없다) · 주제가 지워진 챌린지 화면(방어 한 줄만) · 일시정지·목표 수정·기간 연장·이름 입력 · "표현 12개 자세히" 칩 · 결과의 "익힘 +n" · 푸시 알림·랭킹·공유 · 계획표의 [오늘 수업 만들기] · T6(시나리오 하루 과제).
- 계획표·상세·만들기는 **LLM 호출 0**(#155~#159·#56·#70·#71 만) — 5초 예산 영향 없음. "만드는 중" 줄은 아무 요청도 시작하지 않는다(보기만).
- 기록(StudyLog) 지우기 확인 문구는 그대로("통계와 성장 기록은 그대로") — 챌린지 달성도 안 바뀐다는 줄은 하루 시트 끝 한 줄로만.
- `docs/screens.md` 반영은 웨이브 끝 designer 1명(C18) — §2 목록 3행 + 새 §16 챌린지(이 기록을 옮김).

### 10. 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer — P0·P1·Critical·Major 0)

- P2-1 계획표 카드 + 달력이 한 화면에 "연속" 두 가지를 보인다 — 이름("수행 연속" vs "지금 연속 출석")·보조 줄("하루 목표를 다 한 날만 세요" vs "앱을 연 날")로 구분했지만 사용자 실측 전이다. 혼동 보고가 있으면 달력 셋째 칸을 "연속 출석"으로 줄이는 안.
- P2-2 30일 챌린지 날짜 띠 5줄(≈320px) — 상세 위쪽이 길어진다. 1단계는 그대로, 체감이 나쁘면 "이번 주만 + 전체 보기" 접기.
- P2-3 모양 글자(✓◐✕)를 T4 오늘 탭 띠도 같은 값으로 쓰지만 파일이 따로다(병렬 작업 충돌 회피) — 웨이브 끝에 하나로 합칠 후보.
- Minor-1 하루 시트 ‹ › 비활성 이유를 토스트로만 알린다(기존 달력 시트와 같음).
- Minor-2 장수 칩 막힘 이유는 칩 바깥 문장 하나에 묶여 있어 칩마다 읽히지는 않는다(`aria-describedby` 로 같은 문장).

### 11. 설계서·계약과의 모순·공백 (Leader 확인 — 이 가이드는 아래처럼 처리했다)

1. **#71 `challenge.words` 에 `need`(인정 장수)·`answered` 가 없다** — 하루 시트 PARTIAL 문구 "단어를 4/8장만 풀었어요"의 원천이 없음. 처리: 같은 챌린지면 #158 `dailyGoal.wordsMinAnswered` 로 보충, 아니면 "하루 목표에는 못 미쳤어요". 정식 해결 = T1 additive `words.need`.
2. **#158 `TodayTasks` LESSON 에 점수가 없다** — 데모의 계획표 회화 줄 "끝냈어요 · 문제 4/5 맞힘"을 그릴 수 없음. 처리: 계획표는 "끝냈어요"만, 상세(S4)는 `days[]` 점수.
3. **`ChallengeSummary.topic` 에 일본어 제목이 없다** — 데모 부제 "カフェで注文 · N5 · …" 대신 "N5 · 날짜". 필요하면 T1 additive `topic.titleJa`.
4. **#158 `recentlyEnded.result` 에 그만둔 날 번호가 없다** — `endedAt`(KST 날짜)으로 계산.
5. **"다른 수업 만드는 중(409)"을 계획표에서 그릴 재료가 없다**(#158 은 다른 수업을 모름) — 데모 S2 `busy` 상태는 계획표에서 빼고 S6(T4)에서만.
6. 설계서 §8-3 S2 "오늘 할 일 2칸" — 한 과제만 켠 챌린지는 1칸(§9-1 꺼진 과제 규칙이 우선).
7. 달력 그만둔 날 띠 — 데모는 그만둔 날까지 띠를 그렸지만, #70 상태만으로는 "그만둔 날에 달성"(그 날 MET, 다음 날부터 STOPPED)과 "그만둔 날 미달"(그 날부터 STOPPED)을 같은 규칙으로 가를 수 없다 → STOPPED 칸은 띠 없음으로 단순화.
8. 이력서 `## Leader 확인 필요` 3(하단 탭 숨김 부수효과)은 D2 로 정했다. 2(고정 응답 방식)는 §6 권고 A — developer 가 B 를 고르면 Reviewer 의 운영 번들 grep 을 완료 기준에 더한다.

### 12. 설계서 §13-5 반영 위치 (T3 해당 항목 — 전체 표는 [[task-044-today-integration]] `## Designer 기록` §12)

| # | 반영 | 위치 |
|---|---|---|
| 47 | 구현 화면에는 결정 UI 없음(데모 전용) — DB 안내 줄도 없음 | §9 |
| 48 | 만들기 ③ 단어 카드 설명을 B2 로("AI 가 매일 … 새 단어 … 만들지 못한 날은 주제 표현으로") | §3-3 ③ |
| 56 | S4 새 단어 진행 줄 + 도움말, 0개면 생략 · 기본 표현 줄 수치 그대로 | §3-4 |
| 57 | 누적 세트 = 답한 카드 ≥ 1 세트만(`totals.wordSets` 그대로) · 건너뛰기만 한 날 "건너뛰기만 함 · 푼 0장"(세트 수 표기 없음) | §3-4·§3-5 |
| 58 | 두 세트 날 "20장" — 하루 시트 기준 수치 | §3-5 |
| 59 | 소급 6·3·1 → 상태 `s2.retro` 값 | §6 |
| 60 | 15장 비활성 그대로 | §3-3 ③ |
| 62 | 데모 머리·개발 메모 = 데모 파일 몫(이 task 는 데모를 고치지 않음) | — |

### 13. 파일 경계 · 순서 (T3 관련 — 다른 WP 와 겹치는 파일)

| 파일 | T3 | 다른 WP | 순서·규칙 |
|---|---|---|---|
| `components/shell/routes.ts` | D2 두 항목 추가 | 010d-B(시나리오 경로 줄) · 012b-2 무변경 | **T3 로컬 커밋 먼저**, 010d-B 는 그 위에 줄만 |
| `components/shell/{planReturn,usePlanReturn}.ts` | (선택 D13) | 없음 | T3 단독 |
| `components/plan/**`·`app/(app)/plan/**` | 전부 | 없음 | T3 단독 |
| `components/challenge/**` | 신규 | T4 는 import 하지 않음(§10 P2-3) · T6 후속 | T3 단독 |
| `components/common/{Segmented,Sheet,ui,storage}` | import 만 | 전 WP | 수정 금지 |
| `components/lesson/LessonTopicsScreen.tsx` | 건드리지 않음(D7) | T4·010d-B 인접 | — |
| `TalkRoom.tsx`·`LessonEnd.tsx`·오늘 탭 컴포넌트 | 건드리지 않음 | 012b-2 → 010d-B / T4 → 010d-B / T4 | — |

## Developer 기록

- [23:05] **체크포인트 1** (dev-043, 신규 소환·opus)
  - 완료: 화면 코드 전부 1차 작성 — 신규 `src/components/challenge/{challengeCopy.ts,logic.ts,useChallengeData.ts,parts.tsx,ChallengePlanCard.tsx(+ChallengeDayLine),DayStrip.tsx(+ScoreTable·TopicProgressBlock),ChallengeSheets.tsx(하루 시트·그만두기),ChallengeScreen.tsx(S4/S8),ChallengeListScreen.tsx,ChallengeCreateScreen.tsx,createParts.tsx}` · 신규 `src/app/(app)/plan/{challenge/new,challenge/[id],challenges}/page.tsx` · 수정 `components/plan/{PlanScreen,CalendarSection,DaySheet,logic,parts,usePlanData}.tsx|ts` · `components/shell/routes.ts`(D2 두 줄). 미러 `~/.node-local/thekaiwa-043` 생성(§3 절차)·prisma generate. `tsc --noEmit` 0 오류(전체), 변경 디렉터리 eslint 0.
  - 남은 일: 단위 테스트(`challenge/__tests__/logic.test.ts`·plan 테스트 케이스 추가) → `tests/live/task043-screens.mjs`(Playwright 가로채기) → 가능하면 3025 실행 → 최종 기록.
  - 다음 첫 행동: `src/components/challenge/__tests__/logic.test.ts` 작성 후 미러에서 `node --import tsx --test src/components/challenge/__tests__/*.test.ts src/components/plan/__tests__/*.test.ts`.
  - 주의점: ① 파일 수를 줄이려 가이드 §7 의 작은 부품을 묶었다(TaskRows·StatTiles → `parts.tsx`, ScoreTable·TopicProgressBlock → `DayStrip.tsx`, 두 시트 → `ChallengeSheets.tsx`, StepIndicator·TopicRadioCard·ChoicePills·RadioCard·CheckCard → `createParts.tsx`, ResultHero → `ChallengeScreen.tsx`). ② `useKeyedResource` 를 export 하고 `errStatus`(404 화면 구분)를 더했다 — 기존 호출부 영향 없음. ③ #71 `words.need` 는 아직 타입에 없어 `dayChallengeNeed()` 가 있으면 쓰고 없으면 #158 보충. ④ #158 `recentlyEnded` 에 시작일이 없어 끝남 카드의 "{n}일째에 그만뒀어요" 조각은 뺐다("그만뒀어요 · …") — T1 필드 요청 후보. ⑤ `planReturn.ts` 무변경(Leader 23:20).
  - 미커밋 파일: 위 신규·수정 전부(커밋 안 함).
- [23:13] **체크포인트 2**
  - 완료: 단위 테스트 `src/components/challenge/__tests__/logic.test.ts`(15 테스트 — 카드 6변형·할 일 줄 단어/회화 전 상태·꺼진 과제·기준 수치 67%/75%/"—"·`streak:null`→최장만·하루 상태 글자+모양·#71 줄(need·보충)·S5 두 세트 날/건너뛰기만/원본 삭제/끝난 챌린지·점수 "문제 n/5"·S8 71%/60%/시작 전·기록 행·[다시 도전] 조건·그만두기 문장·S3 장수 막힘/인정 장수/초안·엔진명 0·`renderToStaticMarkup` 카드) + `plan/__tests__/planLogic.test.ts` 챌린지 칸 1 테스트. T1 이 #71 `words.need` 를 넣어 `dayChallengeNeed()` 를 정식 칸으로 바꿨다. `tests/live/task043-screens.ts`(가로채기 42상태 × 360/390/412 × 892/780) 작성·미러 3025 에서 실행 중.
  - 실행 증빙(미러 thekaiwa-043): `tsc --noEmit` 0 오류 · eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `routes.ts` `tests/live/task043-screens.ts`) 0 · `src/components`+`src/types` 단위 502/502 PASS(챌린지+계획표 33/33).
  - 주의점: ① **QA 계정 3 이 DB 에 아직 없다**(qa-session.ts 를 아무도 안 돌림 — 행 생성은 쓰기라 하지 않음). 화면 스크립트는 **QA 계정 1 의 읽기 전용 쿠키**(findUnique + jwt.sign, upsert 없음 — 미러 임시 스크립트, 실행 뒤 삭제)로 돌렸다. 챌린지 API 는 전부 가로채므로 계정 레인 충돌 없음. 서버 렌더의 `getProfile` 빈 upsert(기존 계획표와 같은 경로)는 막을 수 없다 — 프로필 행이 있는 계정만 쓰도록 스크립트가 확인. ② 측정 스크립트는 task-012 월 이동 [오늘](히트 42px — 기존 요소)을 터치 검사에서 뺀다.
  - 미커밋 파일: 체크포인트 1 목록 + `src/components/challenge/__tests__/logic.test.ts` · `src/components/plan/__tests__/planLogic.test.ts`(추가) · `tests/live/task043-screens.ts`.
- [23:21] **구현 완료 → Reviewer 인계** (dev-043)
  - 실행 증빙(미러 thekaiwa-043): `tsc --noEmit` **0 오류**(전체) · eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `src/components/shell/routes.ts` `tests/live/task043-screens.ts`) **0** · 단위 `src/components`+`src/types` **502/502 PASS**(챌린지 15 + 계획표 챌린지 칸 1 포함) · 화면 스크립트 `node --import tsx tests/live/task043-screens.ts --base http://127.0.0.1:3025 --user <쿠키>` **1491/1491 PASS** — 42상태 × 360/390/412 × 892/780(가로 넘침 0 · 스크롤 영역 ≤1 · 터치 44 · 엔진명/번호 0 · 기대 문구 · 하단 탭 `/plan` 만 · 페이지 오류 0). 1차 실행의 FAIL 10건은 전부 스크립트 쪽(불러오는 중 상태를 networkidle 로 기다림 · 범례의 "오늘의 단어"를 없음 검사 · aria-disabled 버튼 강제 클릭)이라 스크립트만 고쳐 재실행. 3025 dev 서버 종료·포트 비움 확인, 쿠키 파일 삭제.
  - 상태 커버: 가이드 §6 의 약 90개 중 **42개를 화면 스크립트로**(S1 4 · S2 11 · S3 12 · S4 6 · S5 2 · S8 7), 카드·할 일 13가지·하루 시트 6상태·장수 막힘·기록 행·그만두기 문장은 **단위 테스트로**. 스크립트에 없는 것: `s2.w1/t1/wip/ready/lip/cont/retro/wordsonly`·`cal.stopped/span/none`(픽셀 비교 없음)·`s3.busy/c429/c404/tomorrow/again`·`s4.two/tomorrow/last/skiponly/fresh/endbusy/endfail/end409/loading`·`s5.met/partial/today/upcoming/frozen-*`·`s8.full/stopmet/r409/more/lloading/nf`·다크 390×892.
  - 가이드와 다른 점(Reviewer 확인용): ① 부품 파일을 묶음(체크포인트 1 ①). ② 점수 표에서 꺼진 과제 열은 그리지 않는다(꺼진 과제 줄 없음 규칙). ③ 기록 목록 진행 중 행이 `dayIndex=0` 이면 "0일째" 대신 "내일 시작". ④ 끝남 카드(#158)는 시작일이 없어 "{n}일째에" 조각 생략. ⑤ 그만두기 확인의 "오늘(n일째)…" 문장은 `dayIndex≥1` 일 때만.
  - T1 필드 요청(Leader): **#158 `recentlyEnded` 에 `startDate`(또는 그만둔 날 `dayIndex`)** — 끝남 카드 "6일째에 그만뒀어요" 원천. #71 `words.need` 는 T1 반영 확인, 정식 칸으로 사용.
  - 소유 밖 필요 변경: 없음(`planReturn.ts`·공용 부품·types 무변경).
  - 남은 위험: ① **◐ 글자가 Chrome 기본 글꼴에서 작은 반점으로 보인다**(스크린샷 `s2.t0`·`s4.normal`·`s8.stopped`) → designer 확인 필요. ② **QA 계정 3 행이 DB 에 없다** — 실서버 연동 QA(완료 기준 7) 전에 `qa-session.ts`(upsert) 실행 필요(쓰기 — Leader/QA 몫). 화면 스크립트는 계정 1 읽기 전용 쿠키로 돌렸다. ③ 고정 응답은 손으로 옮긴 값 — T1 `metrics.ts` 계산 응답과의 대조는 QA. ④ 서버 렌더 `getProfile` 빈 upsert(기존 계획표와 같은 경로)는 가로채기로 막을 수 없다.
  - 미커밋 파일: 신규 `src/components/challenge/{challengeCopy.ts,logic.ts,useChallengeData.ts,parts.tsx,ChallengePlanCard.tsx,DayStrip.tsx,ChallengeSheets.tsx,ChallengeScreen.tsx,ChallengeListScreen.tsx,ChallengeCreateScreen.tsx,createParts.tsx,__tests__/logic.test.ts}` · `src/app/(app)/plan/{challenge/new/page.tsx,challenge/[id]/page.tsx,challenges/page.tsx}` · `tests/live/task043-screens.ts` / 수정 `src/components/plan/{PlanScreen.tsx,CalendarSection.tsx,DaySheet.tsx,logic.ts,parts.tsx,usePlanData.ts,__tests__/planLogic.test.ts}` · `src/components/shell/routes.ts`.

### dev-043b (REV-122)

- [23:49] **REV-122 Medium 4건(M-1·M-2·M-3·M-5) 수정 완료 → Reviewer 재순환** (dev-043b 신규 소환·opus, standard·R1). 데모 게이트 `check.mjs check` = `DEMO_GATE_BLOCKED`(status drafting) — Leader 결정(00:10 "BLOCKED 인지 진행")에 따름. 커밋·푸시·`db push`·DB 쓰기·dev 서버·라이브 없음.
  - **M-1 (S4 오늘 칸)**: `logic.ts` 에 `todayDayOf(days, todayIndex)`(일 번호로 찾음, 0·없음 → null)·`activeTodayView(d)`(오늘 번호 = `today.dayIndex ?? stats.dayIndex`, 그 칸의 수업 점수를 회화 끝냄 줄 "문제 n/5" 로) 추가. `stripFocusDate(days, todayIndex)` 를 번호 기준으로(없으면 첫 칸), `DayStrip` 에 `todayIndex` prop(진행 중만 넘김, 결과 화면은 첫 칸). **같은 원인이라 함께 고침**: `scoreRows(days, goal, todayIndex)` — 오늘이 MET 이면 점수 표 날짜에 " 오늘" 이 빠지던 것(가이드 §3-4b "{오늘이면 ' 오늘'}"). `ChallengeScreen` ActiveBody 가 `activeTodayView` 사용.
  - **M-2 (막힘 시각 비활성)**: `parts.tsx` `BLOCKED_DIM='aria-disabled:opacity-40'`·`ctaClass(busy)`(막힘 40%·보내는 중 70% — busy 도 `aria-disabled` 라서 두 aria 꾸밈이 겹치지 않게 JS 로 고름). 적용: 만들기 [다음]/[챌린지 시작](`ChallengeCreateScreen`), 장수 칩(`createParts` `ChoicePills` — 15장 막힘), 그만두기 시트 [계속하기](`ChallengeSheets`). 클릭 무시는 그대로(`onNext` block/busy, 칩 `!o.disabled`).
  - **M-3 (화면 스크립트 운영 가드)**: `tests/live/task043-screens.ts` — `APP_ENV=PRODUCTION` 거부 + `BASE.endsWith(':3010')` 거부(`challenge-smoke.ts:26` 선례), 머리 주석의 "QA 계정 3" → 실제(테스트 계정 세션 쿠키, dev-043 은 QA 계정 1 읽기 전용) 로 정정. **실행하지 않음**(QA 몫) — tsc·eslint 만.
  - **M-5 (◐ 글꼴 비의존)**: `parts.tsx` `PartialMark`(16×16 viewBox · 원 테두리 r6.5 1.5px + 왼쪽 절반 `currentColor` 채움 · 크기 1em = 둘레 글자 크기 · `aria-hidden`·`focusable=false`·`data-mark="partial"`) + `DayMarkInner`. `DAY_VIEW.PARTIAL` = `glyph:''` + `half:true`. 바꾼 곳: 달력 17px 칩(`plan/parts.tsx` `Chip`) · 달력 범례(같은 `Chip`) · 모양 원 sm/md/lg(`DayGlyph` — 날짜 띠·하루 시트 상태 상자·달력 하루 시트 챌린지 줄·카드) · 오늘 할 일 "덜 함" 원(`TaskGlyphIcon`) · 날짜 띠 범례(`STRIP_LEGEND.PARTIAL` 글에서 ◐ 빼고 `DayStrip` 이 그림을 앞에) · 하루 시트 배지("덜 풂 · n/m장" + `half` → 그림) · 규칙 첫 줄(`ruleLines` 에서 빼서 `COPY.ruleLegend.before/after` 사이에 그림). 크기·색 토큰·간격(글 앞 0.3em)·의미(글자+바탕색+범례 중복) 그대로, **새 색 0**. ✓·✕ 는 글자 유지.
  - M-4(스크립트 수치 정확도)·Low 10건은 **이번 범위 아님**(Leader 지시) — 수치 대조는 QA 가 T1 산출 응답·실서버로.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-043`, sync-local → prisma generate, 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`):
    - `src/components/challenge/__tests__` + `src/components/plan/__tests__` → **38/38 PASS**(challenge 20 = 기존 15 + logic M-1 1 + 새 `marks.test.ts` 4 · plan 18).
    - `src/components`+`src/types` 전체(`--test-concurrency=1`) → **523/523 PASS**(fail 0·skipped 0). 502 → 523 = 이번 +5, 나머지 +16 은 sync 로 들어온 타 WP(T2·T4 등) 테스트.
    - `tsc --noEmit`(전체) **0 오류**(exit 0) · eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `src/components/shell/routes.ts` `tests/live/task043-screens.ts`) **0**(exit 0).
    - 보이지 않는 문자(`grep -nP` U+200B–200F·2028·2029·FEFF·202A–202E·00A0) 변경 파일 **0** · `◐` 글자 `components/challenge`·`plan`·`app/(app)/plan`(테스트 제외) **0**(`marks.test.ts` 가 소스 검사로 고정).
    - 그림 확인(서버·DB 없이): `PartialMark` 만 정적 HTML 로 Chrome 캡처(scratchpad) — 11/12/14px 에서 반원이 또렷, 같은 크기 글자 ◐ 는 작은 점(dev-043 보고 재현). 색은 근사값이라 실제 토큰 화면은 QA.
  - 새 단위 테스트: logic `S4 오늘 칸은 일 번호로…`(오늘 MET → 회화 줄 "끝냈어요 · 문제 4/5"·띠 초점 오늘·점수 표 "10/6 오늘" 1개 / TODAY·PARTIAL 도 같은 칸 / 수업 없으면 점수 조각 없음 / `today` null → 칸 없음·첫 칸 초점·줄 0 / 끝난 챌린지 첫 칸) · marks 4건(SVG 모양 · 칩·범례·모양 원·하루 줄·띠·할 일 줄·배지·규칙·문구 전체에 ◐ 0 · 소스 ◐ 0 · [다음]/장수 칩 `aria-disabled` + `aria-disabled:opacity-40`).
  - **QA 인계 변경**: ① ◐ → SVG **시각 확인 필요** — 360/390/412 × 라이트·다크(달력 17px 칩·범례, 날짜 띠 22px 원·범례 줄, 계획표 카드 "덜 함" 줄, 하루 시트 상태 상자 30px·배지, 상세 규칙 첫 줄), 실기기 갤럭시 1회. ② 오늘 MET 날 S4(`s4.normal` 의 오늘 칸을 MET 로 바꾼 상태): 회화 줄 "문제 n/5"·띠 Tab 첫 초점이 오늘 칸·점수 표 " 오늘". ③ 만들기 [다음] 막힘(목표 둘 다 끔·주제 없음)과 15장 칩이 **흐리게** 보이는지, 보내는 중은 70%. ④ 화면 스크립트에 3010/PRODUCTION 거부가 생겼다(`--base http://localhost:3010` 이면 바로 오류).
  - **남은 위험**: ① **같은 ◐ 글자가 T4 소유 파일 3곳에 남아 있다** — `components/vocab/ChallengeStrip.tsx:21`·`vocab/ChallengeResultBox.tsx:18`·`lesson/ChallengeEndLine.tsx:22`(소유 밖이라 손대지 않음 → Leader 가 T4 에 `PartialMark` 재사용(`@/components/challenge/parts`) 또는 같은 방식 적용을 배정해야 오늘 탭·수업 끝에서도 같은 문제가 없어진다. 가이드 P2-3 "웨이브 끝에 하나로" 후보). ② 날짜 띠 칸의 accent 테두리는 여전히 `state==='TODAY'` 기준 — 오늘 목표를 채운 날엔 오늘 칸 표시가 ✓ 로만 남는다(가이드 §3-4a 에 오늘 칸 테두리 규정이 없어 **디자인 판단**이라 바꾸지 않음 → designer 확인 후보). ③ busy 70%/막힘 40% 수치는 선례(`EvalStartScreen`) 값이며 designer 가이드에 수치 규정은 없다. ④ 화면 스크립트 1491 은 재실행하지 않았다 — ◐ 를 기대 문구로 쓰는 단언은 없음(grep 확인)이라 깨질 곳은 없을 것 `[추측]`.
  - 변경 파일(전부 미커밋): `src/components/challenge/{parts.tsx,challengeCopy.ts,logic.ts,DayStrip.tsx,ChallengeScreen.tsx,ChallengeSheets.tsx,ChallengeCreateScreen.tsx,createParts.tsx,__tests__/logic.test.ts,__tests__/marks.test.ts(신규)}` · `src/components/plan/parts.tsx` · `tests/live/task043-screens.ts`.

### dev-043c (REV-127)

- [00:14] **REV-127 L-1 · 목록 이어 읽기(REV-126 의 T3 Low) · L-2 처리 완료 → Reviewer 재확인** (dev-043c 신규 소환·opus, standard·R1). 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED` · status `waived`(2026-10-06 23:43:51). 커밋·푸시·`db push`·DB 쓰기·dev 서버·화면 스크립트 실행·운영 3010 접촉 없음.
  - **L-1 (날짜 띠 오늘 테두리)**: `logic.ts` `stripCellIsToday(day, todayIndex)` = 상태 `TODAY` 또는 일 번호 칸(`todayDayOf` 와 같은 가드 — null·0 이면 번호로는 오늘 아님). `DayStrip.tsx` 칸 테두리를 이 함수로 바꿔 오늘 MET·PARTIAL·TODAY 모두 `border-accent`(기존 토큰, 새 색 0). REV-127 L-1 "고칠 방법"대로 칸 읽기 이름도 `stripCellAria(day, todayIndex)` 가 오늘 칸이면서 상태가 TODAY 가 아닐 때 ", 오늘" 을 붙인다(TODAY 는 상태 글자가 이미 "오늘"이라 겹치지 않음). 범례(`stripLegend`, 상태 기준)는 손대지 않았다.
  - **목록 이어 읽기**: `logic.ts` `readListPages(fetchPage, start, maxPages=5)` — 빈 쪽 + 커서면 다음 쪽을 이어 읽고(최대 5쪽), 같은 커서가 다시 오면 커서를 버리며(끝없는 반복 방지), 5쪽까지 비면 커서를 남긴다. `useChallengeData.ts` 첫 읽기·[더 보기] 둘 다 이 함수를 쓴다(요청 URL 은 기존과 같음 — 커서 없으면 `?status=ALL&limit=20`). `ChallengeListScreen.tsx` 빈 상태 문구는 `isListEmpty(items, cursor)`(행 0 + 커서 없음)일 때만, 행 0 + 커서면 목록·안내 줄 없이 [더 보기]만 그린다.
  - **L-2**: `tests/live/task043-screens.ts` 에 상태 2개 + `dom`(CSS 선택자 → 기대 개수) 검사 — `s4.met`(4일째 오늘 MET · 지표 `BOTH`: 기대 "4일째 / 7일"·"75%"·"끝냈어요 · 문제 4/5"·"10/6 오늘") · `s4.metlast`(마지막 날 7/7 MET, 시작 9/30: "7일째 / 7일"·"끝냈어요 · 문제 5/5"·"10/6 오늘"). 둘 다 `dom`: 띠 테두리 칸 정확히 1개 · 그 칸이 `2026-10-06` · 초점 시작(`tabindex=0`) · 읽기 이름 끝 "n일째, 달성, 오늘". **실행하지 않음**(QA 몫) — tsc·eslint 만. 상태 42 → 44.
  - 새 단위 테스트 2건(`challenge/__tests__/logic.test.ts`): ① 띠 테두리(정적 HTML) — 오늘 MET·TODAY·PARTIAL 모두 `2026-10-06` 1칸, 나머지 칸 `border-line`·읽기에 오늘 없음, MET 읽기 "10월 6일 화요일, 4일째, 달성, 오늘" / TODAY 읽기 "…, 4일째, 오늘"(중복 없음), 내일 시작(번호 0·모두 예정) 0칸, 끝난 챌린지(번호 없음·null, 마지막 날 MET) 0칸, 순수 판정 5건 ② 목록 — 빈 쪽 2개를 건너 셋째 쪽 행(호출 `[null,'c1','c2']`), 행 있는 쪽은 1회 호출, 같은 커서 반복은 2회 호출 뒤 커서 null, 최대 3쪽이 다 비면 커서 `k3` 를 남김 + `isListEmpty` 3경우.
  - 변이 확인(미러에서 임시 변경 → NFS 원본으로 복원, `cmp` 동일 확인): 테두리를 `state==='TODAY'` 로 되돌림 → ① FAIL(logic 17/18) · 이어 읽기 반복을 끔(`n < 1`) → ② FAIL(17/18).
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-043`, `KAIWA_LOCAL_ROOT` 로 sync → prisma generate, 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`):
    - challenge + plan 단위 → **40/40 PASS**(기존 38 + 새 2, fail 0).
    - `src/components`+`src/types` 전체(`--test-concurrency=1`) → **554/554 PASS**(fail 0·cancelled 0·skipped 0). REV-127 의 546 대비 +8 = 이번 +2, 나머지 +6 은 sync 로 들어온 다른 WP 테스트로 보임 `[추측]`(이번 변경이 더한 `test(` 는 2개).
    - `tsc --noEmit`(전체) **0 오류**(exit 0, 출력 0줄) · eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `src/components/shell/routes.ts` `tests/live/task043-screens.ts`) **0**(exit 0, 출력 0줄).
    - 보이지 않는 문자(`grep -nP` U+200B–200F·2028·2029·FEFF·202A–202E·00A0·2060–2064·00AD·2066–2069, 탐지식이 U+200B 를 잡는지 대조) 변경 6개 파일 **0** · 미러와 NFS 의 변경 파일 `cmp` 동일.
  - **남은 위험**: ① 날짜 띠 범례의 "오늘" 항목은 상태 기준이라 오늘 MET 날엔 범례에 없다 — 테두리 뜻은 칸 읽기 이름·점수 표 " 오늘"·머리 "n일째"로 전해지지만 눈으로 보는 범례 설명은 없다(designer 확인 후보, 이번 범위 밖). ② 화면 스크립트의 새 2상태·`dom` 검사는 실행 전이라 선택자(`.border-accent`·`aria-label$=`)가 실제 DOM 에 맞는지는 QA 실행으로 확인 필요(단위 테스트의 정적 HTML 과 같은 클래스·속성이라 맞을 것 `[추측]`). ③ 이어 읽기 최대 5쪽(100행) 너머까지 전부 건너뛴 행이면 [더 보기]만 보인다(REV-126 판정상 실사용 확률 사실상 0). ④ 칸 읽기 이름 ", 오늘" 추가는 REV-127 L-1 "고칠 방법"에 있던 것 — Leader 지시문에는 테두리만 적혀 있어 범위 판단을 Reviewer 가 확인해 주기 바람.
  - 변경 파일(전부 미커밋·untracked): `src/components/challenge/{logic.ts,DayStrip.tsx,ChallengeListScreen.tsx,useChallengeData.ts,__tests__/logic.test.ts}` · `tests/live/task043-screens.ts`.

## Reviewer 기록 (REV-122)

- [23:50] **REV-122 — 코드 감사 판정 PASS_WITH_NOTES · 데모 게이트 `DEMO_GATE_BLOCKED`(Leader 조치 필요)** (reviewer 신규 소환, Read 전용 — 코드·문서 무수정, 커밋·푸시·`db push`·DB 쓰기·운영 3010 접촉 없음). `base_ref 5c3a701` 미커밋 작업 트리 기준. light 아님(standard) — QA 진행.
- 건수: Critical 0 · High 0 · **Medium 5**(M-1~M-5) · Low 10 · Info 4. `native_change: false`(웹만 — `android/`·`plugins/`·`capacitor.config.ts` 변경 없음).
- 7영역: 아키텍처(6층·`@/modules` import 0 — 확인) · 유지보수성 · 안정성(이중 클릭 ref 가드·늦은 응답 순번 폐기·409/404 분기) · 운영성(LLM 호출 0·서버 쓰기는 #156·#159 뿐) · 성능(#155~#159·#56·#70·#71 읽기만, N+1 없음) · 보안(소유자 검사는 서버 404 에 맡김·`encodeURIComponent`·`dangerouslySetInnerHTML`/`localStorage`/`fetch(` 0) · 학습 원칙(점수 "문제 n/5" 하나·엔진명 0) 전부 검토.

### 데모 검토 게이트 (reviewer 부록 §7)

| 항목 | 결과 |
|---|---|
| `check.mjs check --task task-043…` | **`DEMO_GATE_BLOCKED` · status `drafting` · "사용자 승인이 기록되지 않았습니다"**(exit 1) — reviewer 규칙상 이 상태는 FAIL |
| 사용자 지시 실재 | **[확인]** 훅이 기록한 `.claude/state/demo-gate/prompts.jsonl` 156번째 줄(2026-10-06 20:29:31, 이 Leader 세션)에 "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고…" 원문이 있다 — 에이전트가 쓴 줄이 아니라 훅 기록 |
| 에이전트의 대리 기록 흔적 | **없음** — `evidence.jsonl`·`events.jsonl` 에 task-043 줄 0, frontmatter `demo_gate` 는 `drafting`·`waived_*` 빈 값·`active:false`(손댄 흔적 없음) |
| 승인 데모 대비 차이 분류 | 승인 데모가 없다(지시로 생략) → 기준 = designer 구현 가이드. 차이 전부 **implementation**(허용) 또는 아래 M-1·M-2 **defect**. **material 없음**(정보 구조·네비게이션·CTA 동작·단계 수 가이드와 같음) |
| **필요한 조치(Leader)** | 위 지시는 `check.mjs waive` 의 문구 인식 규칙에 걸리지 않는다고 Leader 가 적어 둔 상태다. **정식 `waived` 기록을 남기거나(사용자에게 인식되는 한 문장을 받아 `waive`) 게이트가 BLOCKED 임을 알고 진행한다는 결정을 Leader 가 이력서에 남겨야 한다.** 이것은 Developer 수정 사항이 아니라 Leader 기록 사항이다. 해소 전까지 이 REV 의 "PASS_WITH_NOTES" 는 **코드 감사 한정**이다 |

### 지적 표

| # | 심각도 | 위치 | 내용(근거) | 고칠 방법 |
|---|---|---|---|---|
| M-1 | Medium (defect) | `ChallengeScreen.tsx:175-176`, `logic.ts:264-266`, `ChallengeScreen.tsx:193` | 서버 하루 상태 우선순위는 **MET → TODAY**(`learning/challenges/metrics.ts:249-250`)라 **오늘 목표를 채운 날은 `days[]` 에 `TODAY` 칸이 없다**. 그런데 S4 는 `todayDay = days.find(state==='TODAY')`(175)로 오늘 칸을 찾아 ① 오늘 목표를 다 채운 가장 흔한 "다 했어요" 화면에서 `score=null` → 회화 DONE 줄의 "끝냈어요 **· 문제 n/5**" 가 사라진다(가이드 §3-1a·§4 `days[dayIndex−1].lesson`) ② `stripFocusDate`(날짜 띠 roving 시작점)가 TODAY 만 찾아 오늘이 MET 이면 **1일째**로 간다(가이드 "시작점 = 오늘 칸") | `todayDay = d.days.find(x => x.dayIndex === d.today?.dayIndex)`, `stripFocusDate(days, todayDate)`(없으면 첫 칸). 단위 테스트: 오늘 MET + 수업 점수 4/5 → 줄에 "문제 4/5" |
| M-2 | Medium (defect) | `ChallengeCreateScreen.tsx:276-283`(+`ChallengeSheets.tsx:157` ghost [계속하기]) | 막힌 [다음]·[챌린지 시작] 이 `aria-disabled` 뿐이고 **시각 비활성이 없다** — 공용 `Btn` 은 `disabled:opacity-40` 만 스타일(`common/ui.tsx:80-83`)이라 `aria-disabled` 에는 아무 모양이 안 붙는다. 저장소 선례는 className 으로 직접 준다(`eval/EvalStartScreen.tsx:227` `aria-disabled:opacity-40`). 완료 기준 4 "수업·단어 둘 다 끄면 **버튼 비활성** + 이유"·가이드 §3-3 | `className="w-full aria-disabled:opacity-40 aria-busy:opacity-70"`(Tailwind v4 선례 있음). [계속하기] 도 `aria-disabled:opacity-40` |
| M-3 | Medium | `tests/live/task043-screens.ts:23` | **운영 3010 거부 가드가 없다.** 정규식이 `http://localhost:3010` 도 통과시킨다. 같은 디렉터리 `challenge-smoke.ts:26` 은 `BASE.endsWith(':3010')` 를 거부한다. 챌린지·계획표·주제 API 는 가로채고 비-GET 은 200 으로 막지만, 서버 렌더 `getProfile` 빈 upsert·그 밖 GET 은 실서버로 간다 | `\|\| BASE.endsWith(':3010')` 한 줄 추가(+ 머리 주석의 "QA 계정 3" 표기를 실제 사용 계정과 맞추기) |
| M-4 | Medium (검증 공백) | `task043-screens.ts:36-92` | 고정 응답이 **손으로 쓴 값**이다 — 가이드 §6 A 가 권한 "T1 `metrics.ts` 를 부르는 생성 스크립트"가 아니고 완료 기준 3 "같은 계산 함수로 만든 고정 응답"이 충족되지 않았다(dev 도 보고서에 "손으로 옮긴 값"이라 적음). 값도 설계서 §1-3 과 다르다: 1일째 단어 8·1·1(문서 7·2·1)·2일째 7·2·1(문서 8·2·0)·3일째 "수업만"(문서 "단어만"), 날짜별 맞힘 합 15 인데 `TOTALS.wordsCorrect` 21. 1491/1491 은 **표기(포맷)** 검증이지 **수치 정확도** 검증이 아니다 | 코드 결함 아님 — **QA 가 T1 `computeChallengeMetrics` 산출 응답 또는 실서버(QA 계정 3)로 완료 기준 3 수치를 대조**(아래 high_risk 2). 스크립트 값은 설계서 §1-3 에 맞추면 이후 회귀에 유리 |
| M-5 | Medium (→ designer, `[추측]`) | `challengeCopy.ts:17-22`·`parts.tsx:26-27` | **`◐`(U+25D0) 글자가 "일부" 모양의 유일한 시각 단서**인 곳이 있다 — 달력 17px 칩(글자 칩 안에서 `aria-hidden`)과 계획표 "덜 함" 줄 원. dev 는 Chrome 기본 글꼴에서 작은 반점으로 보인다고 보고. 심각도 판단: 날짜 띠·하루 시트·읽기는 글자("일부")·`warn-soft` 바탕·범례 문구가 함께 있어 **의미가 완전히 사라지진 않는다**(Medium 이 아니라 Low 로 볼 여지) — 다만 달력 칩과 `SHORT` 줄은 글리프 의존이 커서 폰 글꼴에서 빈 네모(□)로 나오면 "색만으로 구분 금지" 원칙이 흔들린다. 갤럭시 S25+ 실제 글꼴은 확인 못 함 `[추측]` | **디자인 변경이 필요하면 designer 로** — CSS 로 그린 반원 칩(`linear-gradient` 반반)·SVG 같은 글꼴 비의존 모양 제안. 코드 쪽은 designer 결정 뒤. QA 는 실기기 확인 항목에 넣는다 |
| L-1 | Low | `ChallengeScreen.tsx:193` | S4 "오늘 할 일" 머리에서 요일이 빠짐 — 가이드 "{M월 D일 **(요일)**}" 인데 `md()`(`formatMonthDay`) 사용 | `dayLabel()` |
| L-2 | Low | `logic.ts:360`(`skipOnly`)·`:301` | 단어 과제를 끈 챌린지(`goal.words=false`)에서도 `days[].words` 가 있으면(타입 주석: "꺼져 있으면 `need`·`ok` null, 세트를 풀었으면 맞힘·틀림은 보인다") 그날 MISSED 이유가 "건너뛰기만 한 세트는 푼 것으로 세지 않아서 ‘놓침’" 으로 나올 수 있다(실제 이유는 수업 안 함) | `skipOnly = ctx.goal.words && !!w && w.answered===0`, `dayLineView` 는 `w.ok !== null` 가드 |
| L-3 | Low | `logic.ts:269`(`stopDayIndex`)·`:242`(`dayView`)·`usePlanData.ts:12`≈`logic.ts:25` | 죽은 코드 — `stopDayIndex` 는 테스트에서만, `dayView` 는 어디서도 안 쓰임(끝남 카드가 "{n}일째에" 를 뺐기 때문). `LoadStatus` 가 두 파일에 같은 정의로 중복. `daysBetween` 은 044 의 `vocab/topicLogic.ts` 에도 같은 이름(WP 다름 — 웨이브 끝에 하나로) | 안 쓰는 것 제거 또는 T1 필드가 오면 사용, 타입 하나로 |
| L-4 | Low | `ChallengeCreateScreen.tsx:197` | 서버 409 가 `challengeId:null` 일 수 있다(`service.ts:24`·`:115` 경합 복구에서 `findActive` 가 null) — 그때 [진행 중 챌린지 보기] 가 `/plan/challenge/`(빈 id)로 간다 | id 가 없으면 `/plan` 로 폴백 |
| L-5 | Low | `shell/__tests__/appUpdateStore.test.ts:53-57` | `isFocusRoute` 단위 테스트에 새 두 prefix 가 없다(탭·업데이트 띠 숨김이 브라우저 스크립트로만 확인됨) | `/plan/challenge/new`·`/plan/challenge/x`·`/plan/challenges` true, `/plan` false 4줄 |
| L-6 | Low | `task043-screens.ts:139`·`:125`·측정부 | ① `s4.noai` 는 `absent` 뿐이라 페이지가 오류 화면이어도 PASS 가능 → expect 한 줄 ② **일본어 16px·`lang=ja` 검사 없음**, 고른 주제 카드의 표현 미리 보기(`ChunkPreview`)가 어느 상태에도 안 그려진다(`s3.step1` 에 draft 없음) ③ 첫 화면(780) 카드 높이 ≤ 480(가이드 §8)·`cal.none` 픽셀 비교 없음 ④ `page.goto(...).catch(()=>undefined)` 가 이동 실패를 삼킨다(문구 단언이 있는 상태는 FAIL 로 드러남) | QA 가 ②③ 을 별도로 확인, ① 은 expect 추가 |
| L-7 | Low | `ChallengeScreen.tsx:149` | 결과 화면에서 #158 이 아직 로딩이면 [다시 도전]·[다른 주제로] 가 먼저 보이다가 진행 중 챌린지가 있으면 안내 상자로 바뀐다(깜빡임·누른 뒤 409 는 만들기 ④ 가 받아 안전) | 로딩 중에는 버튼 줄을 숨기거나 skeleton |
| L-8 | Low | `createParts.tsx:166-186` | `role=radiogroup/radio` 인데 화살표키 이동이 없고 칩마다 Tab 정지(기능 손실 없음 — 접근성 패턴 불일치) | 선택: roving tabindex + ←→, 또는 role 을 버튼 그룹으로 |
| L-9 | Low | `ChallengeScreen.tsx:91-93` | 그만두기 성공 뒤 `det.refresh()` 는 조용한 새로 읽기라 **실패하면 옛 ACTIVE 화면이 남고** 토스트는 "그만뒀어요" — 모순 | 성공 뒤에는 `det.reload()`(실패면 오류 상태 + 다시 시도) |
| L-10 | Low | `ChallengeCreateScreen.tsx:89-93` vs `:116-119` | `?again=` 의 주제가 #56 수준 창 밖이면 토스트 없이 조용히 ① 로 간다(가이드 "주제가 없어졌으면 ① + 안내" 는 `topic.id=null` 만 처리) | 목록에 없으면 같은 안내 토스트 |
| I-1 | Info | `routes.ts` | 한 줄 배열을 여러 줄로 재포맷 — diff 11줄이지만 의미는 2항목 추가뿐, 010d-B 가 줄만 더하기엔 오히려 쉽다. `planReturn.ts` 무변경 **[확인]** | — |
| I-2 | Info | `ChallengeCreateScreen.tsx:317`·서버 `service.ts:73` | 화면의 장수 상한은 `topic.chunks.length`(원본 개수), 서버 `poolSize` 는 `buildTopicPool(chunks, []).chunkTotal`(폭 필터·표기 중복 제거 뒤). 화면이 서버보다 **같거나 느슨**하다 → 서버 400 `WORD_COUNT_OVER_POOL` 상자(확인됨: 필드 `reason`·`poolSize`)가 받는다. 가이드 §4 가 이미 예고한 구조 | — |
| I-3 | Info (designer) | 가이드 §3-3 ② | 기간 단계 날짜 범위가 시작일(③에서 고름) 선택 전이라 항상 "오늘 시작" 기준이다 — ④ 확인에서 바로잡힘. 순서를 바꾸거나 "내일 시작이면 하루 밀려요" 한 줄을 designer 가 판단 | designer |
| I-4 | Info (designer) | `CalendarSection.tsx:118` 계산 | 셀 66px(안쪽 64)·`pt-1.5`·번호 16·칩 2줄(37px) → 칩이 3+n 으로 2줄이면 하단 3px 띠(`bottom-px`)가 칩 아랫변과 **약 2px 겹칠 수 있다**(스크린샷은 못 봄 `[추측]`). 첫 화면 로딩 뼈대 172px 대 실제 진행 중 카드 약 360~400px 라 #158 도착 때 달력이 아래로 밀린다(가이드 값) | designer 판단 |

### 가이드 대비 일치 표 (코드 읽기 + 단위 테스트 15·18)

| 가이드 항목 | 판정 | 근거 |
|---|---|---|
| 계획표 맨 위 카드 6상태(loading·error·active·tomorrow·ended·none)·판정 순서·"진행 중+끝남=진행 중만" | **일치** | `planCardKind`·`ChallengePlanCard.tsx`·테스트 1 |
| 오늘 할 일 줄 **13가지**(단어 5·회화 8) 문구·앞말·가는 곳·`aria` 문장 | **일치** | `taskRowView` ↔ 가이드 §3-1a 한 줄씩 대조, 테스트 2·3. 줄은 `Link`(오늘 탭), 버튼 0, [오늘 수업 만들기] 0(`renderToStaticMarkup` 로 확인) |
| 한 과제만 켠 챌린지 → 그 줄만·"0 / 1" | **일치** | 테스트 마지막 케이스 |
| 지표 칸·수행 연속 vs 연속 출석 구분("앱을 연 날" 보조 줄) | **일치** | `streakTile`·`SummaryRow attendHint`(진행 중+이번 달만) |
| 달력: ✓◐✕ 칩 맨 앞(3개 안에 셈)·그만둠은 띠·칩 없음·기간 띠·범례 4항목(그 달에 챌린지 날이 있을 때만) | **일치** | `cellView`·`CalendarLegend showChallenge`·planLogic 테스트. 챌린지 없는 칸은 `band:false`·칩 불변 |
| 하루 시트 챌린지 줄(상태별 설명·need 보충·"기록을 지워도…" 끝 줄) | **일치** | `dayLineView`·테스트 |
| S3 4단계(주제·기간 7/14/30·목표·확인)·장수 5/10/15 풀 상한·인정 문장·시작일·오류 6종(over·active·topic·rate·fail·409 막기) | **일치**(M-2 제외) | 문구 `CREATE`·`wordCountOptions`·`createErrorOf`·서버 필드(`reason`·`challengeId`·`poolSize`) 확인. 자동 이름은 서버 규칙(`service.ts:82`)과 동일 |
| S4 상세(지표 3칸·메모·날짜 띠·오늘 할 일·주제 표현·새 단어 줄·점수 추이·누적·규칙·그만두기) | **일치**(M-1·L-1 제외) | `ChallengeScreen.tsx`·`DayStrip.tsx` ↔ §3-4 |
| S5 하루 시트(MET·PARTIAL·MISSED·TODAY·UPCOMING·STOPPED·두 세트·건너뛰기만·원본 삭제·끝난 챌린지 링크 없음) | **일치**(L-2 제외) | `daySheetView`·테스트 |
| S8 결과·기록(수행 연속 미표시·최장만·그만둠 "예정" 0칸·[다시 도전] 조건·기록 행 3종·빈/오류/더 보기) | **일치** | `resultHeroView`·`canRetry`·`listRowView` |
| 설계서 v2.3 우선(데모 v2 와 다를 때) | **따름** | ③ 단어 설명 B2 문구·새 단어 진행 줄·누적 세트 규칙·15장 비활성·결정 UI/"확정" 배지 없음(grep 0)·"익힘 +n"·"표현 12개 자세히"·일시정지 없음(grep 0) |
| 하단 탭: `/plan` 보임·3하위 숨김·업데이트 띠 동반 숨김(D2 수용) | **일치** | `routes.ts` — `/plan` 은 두 prefix 모두 불일치. 단위 테스트는 L-5 |
| ← 복귀(하루 시트 → 챌린지 줄 → 상세 ←"계획표로" 같은 달·날) | **일치** | `BackBar` 가 `usePlanReturn` 을 쓰고 `rememberPlanReturn(planUrl, '/plan/challenge/<id>')` 의 src 가 경로와 같음 — `planReturn.ts` 무변경으로 동작 **[확인: 코드 읽기, 실동작은 QA]** |

### 독립 손계산 (화면 로직 함수를 손으로 돌려 확인 — 6건 모두 일치)

1. 설계서 §1-3 아침: 10/03 단어 7+2=9≥8·수업 → 달성, 10/04 8+2=10≥8·수업 → 달성, 10/05 수업 없음·단어 6+3=9≥8 → 일부 ⇒ 달성률 2/3=0.67 → `pct`=**67%**·"3일 중 2일", 수행 연속 어제가 일부라 **0일**·`오늘 채우면 ${0+1}일`=**1일**, 최장 2 — `planStatTiles(MORNING)` 과 같음.
2. 오늘 둘 다 끝냄: 3/4=0.75 → **75%**·"4일 중 3일", 오늘 달성이라 오늘부터 거슬러 10/05 일부에서 끊겨 **1일**·"오늘까지 이어졌어요" — `planStatTiles(BOTH_DONE)` 과 같음.
3. 자기소개(✓✓✓◐✓✓✕): 5/7=0.714→0.71 → **71%**·"7일 중 5일 달성", 최장 3(✓✓✓), `streak:null` → `planStatTiles`·`resultHeroView` 가 수행 연속을 그리지 않고 최장만 — 같음.
4. 길 묻기(✓✓✕✓◐ + 6일째 미달 그만둠): 지난 날 5·달성 3 → 3/5 → **60%**, 최장 2, 결과 문구 "**14일 중 6일째에 그만뒀어요** · 달성률 60%"(`stats.dayIndex`=그만둔 날 6), 7~14일째 전부 STOPPED → `stripLegend` 에 UPCOMING 없음 — 같음. 6일째 달성 후 그만둠은 6일 중 4일=67%(`s8.stopmet` 값).
5. 날짜 띠·기간: 2026-10-06 은 화요일(Python 확인) → 시작 오늘 7일 = "10월 6일 (화) ~ 10월 12일 (월)" — 스크립트 기대(`s3.step2`)와 `rangeLabel` 일치. 2026-10-05 월 → `stripDateText`="5(월)"·`stripCellAria`="10월 5일 월요일, 3일째, 일부" 일치.
6. `stopDayIndex('2026-09-20','2026-09-25T03:00Z',14)`: KST 09-25 12:00 → 날 차 5 +1 = 6, 시작 전(−1+1=0) 0 — 테스트와 일치. 두 세트 날 20장: 맞힘 6+틀림 2+건너뜀 12=20, 푼 8 ≥ need 8 → "2세트 합계 — 20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)" + "가장 많이 푼 세트 결과 보기 · 외 1세트 ›" — `daySheetView` 와 일치. 새 단어 "30개 — 공부 28 · 익힘 0" 문구 일치.
7. (소수 반올림 방어) `Math.round(rate×100)` 은 0.29·0.57·0.58 같은 둘째 자리 값에서 부동소수 오차(28.999…·56.999…)에도 올바르게 29·57·58.

### 재실행 숫자 (미러 `~/.node-local/thekaiwa-043`, 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`)

| 항목 | 기대 | **실제** |
|---|---|---|
| `src/components/challenge/__tests__` | 15 | **15/15 PASS** |
| `src/components/plan/__tests__` | — | **18/18 PASS** |
| `src/components`+`src/types` 전체(`--test-concurrency=1`) | 502 | **502/502 PASS**(fail 0·skipped 0) |
| `tsc --noEmit`(전체) | 0 | **0 오류**(exit 0) |
| eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `routes.ts` `tests/live/task043-screens.ts`) | 0 | **0**(exit 0) |
| 보이지 않는 문자(`U+200B-200F·2028·2029·FEFF·202A-202E`) 스캔 — 신규·수정 전 파일 | 0 | **0건** |
| 화면 스크립트 1491 | 42상태×3폭×(892: 6+E+A, 780: 3) | **손계산 일치** — 42상태·E(expect)=108·A(absent)=11 → (9×42+108+11)×3 = **1491**. 스크립트는 재실행하지 않음(QA 몫) |

- 단서: 미러는 dev 인계 시점 상태다. NFS 와 비교(`diff -rq`)하면 **T3 소유 파일(`components/challenge`·`plan`·`shell`·`app/(app)/plan`·`types`)은 동일**하고, 다른 것은 타 WP 파일뿐(`lesson/__tests__/lessonLogic.test.ts`·`vocab/__tests__/topic*`·`modules/learning/{challenges/service,lessons/today,vocab/sessions,vocab/topicSet}.ts`·`tests/live/challenge-*`·`task044-screens.ts`). 따라서 위 숫자는 T3 에 대해서는 NFS 현재 상태와 같고, 502 의 구성만 타 WP 변경분을 반영하지 않은 값이다. 타 WP 미완성 파일 때문에 실패한 항목은 없었다.

### 경계·소유 확인

- `components/challenge/**` 에 `@/modules`·`prisma` import **0**(grep). 엔진명·`AiWord`·`refType`·`speaker_id` 화면 노출 **0**(`aiWordTotal` 등은 JSON 필드명이라 화면 글자 아님). 하드코딩 색 0(토큰만). `window.Capacitor`·`fetch(`·`localStorage`·`innerHTML` 0.
- 소유 밖 변경 없음: `src/modules/**`·`prisma/**`·`components/{vocab,lesson,talk,chat}/**`·`planReturn.ts`·`globals.css`(task-039 의 키프레임 8줄 — T3 아님) 중 T3 가 손댄 것 없음. `src/types/{challenge,plan}.ts` 는 T1 산출을 소비만. `plan/page.tsx` 무변경.
- `useKeyedResource` export·`errStatus` 추가: 반환 객체에 칸만 늘었고 `useCalendar`·`useDay` 호출부는 `status·data·reload·refresh·patch` 만 쓴다 — **영향 없음**(plan 18/18).
- 순환 import 없음: `plan/{parts,CalendarSection}` → `challenge/challengeCopy`(타입만 import) · `challenge/*` → `plan/{logic,parts,usePlanData}` · `plan/PlanScreen` → `challenge/{ChallengePlanCard,useChallengeData}`.
- 새 페이지 3개 모두 `auth()`→없으면 `/login?callbackUrl=` 이고 소유자 확인은 서버(#157 404 — 남의 것·없는 것 구분 없음)에 맡긴다. 쓰기는 #156·#159 두 곳뿐, 둘 다 ref 가드로 이중 요청 차단.

### 개발자 보고 "가이드와 다른 점 ①~⑤" 판정

| # | 내용 | 판정 | 이유 |
|---|---|---|---|
| ① | 가이드 §7 의 작은 부품 파일들을 묶음 | **채택** | 파일 경계(§13) 안이고 응집도 높다. 단 `ChallengeDayLine` 이 `ChallengePlanCard.tsx` 에 있어 `plan/DaySheet` 가 카드 파일을 import — 기능 문제 없음 |
| ② | 점수 표에서 꺼진 과제 열을 그리지 않음 | **채택** | "꺼진 과제 줄·열 없음"(§9-1)과 같은 원칙 |
| ③ | 기록 목록 진행 중 행 `dayIndex=0` 이면 "내일 시작" | **채택(가이드 보완)** | 가이드 문형이면 "0일째"가 나옴 |
| ④ | 끝남 카드 "{n}일째에" 조각 생략 | **조건부 채택** | `recentlyEnded` 에 시작일·그만둔 날이 없고 `elapsedDays` 로는 그만둔 날 달성 여부에 따라 n 이 모호해 계산 불가(가이드 §3-1 `stopDay` 식은 startDate 가 필요한데 응답에 없음). 결과 화면(S8)·기록은 `stats.dayIndex` 로 정확. 보강하려면 Leader 가 T1 additive `recentlyEnded.startDate`(또는 `stopDay`) 를 결정 — **필수 아님**. 안 하면 `stopDayIndex`·`dayView` 죽은 코드 정리(L-3) |
| ⑤ | 그만두기 확인 "오늘(n일째)…" 문장은 `dayIndex≥1` | **채택** | 가이드의 `dayIndex=0` 전용 문장과 같은 의도(그 밖 분기를 그대로 쓰면 "오늘(0일째)"이 나옴) |
| (T1 필드 요청 1건) | #158 `recentlyEnded.startDate` | **Leader 결정** | 위 ④ |

### ◐ 글자 심각도 · 화면 스크립트 신뢰도

- ◐: **M-5(Medium, designer 이관 `[추측]`)**. 의미는 글자·바탕색·범례로 중복 전달되어 사라지진 않으나 달력 칩·`SHORT` 줄은 글리프 의존. 폰 실제 글꼴 미확인 → QA 실기기 항목 + designer 의 글꼴 비의존 모양 판단.
- 스크립트 신뢰도: **포맷·넘침·터치·탭 숨김·엔진명·페이지 오류는 실제 검사**(측정 함수가 `scrollWidth`·`overflow-y` 스크롤러·`::before` 히트 포함 44px·`nav[aria-label="주 메뉴"]` 를 직접 잰다, 느슨한 단언 없음, 거짓 PASS 소지는 `s4.noai` 한 곳). **수치 정확도·일본어 16px·`lang=ja`·실서버 연동은 검증하지 않는다**(M-4·L-6). 쓰기 안전: 챌린지·계획표·주제 API 는 가로채고 비-GET 은 200 으로 막음, 쿠키 파일 내용은 출력·저장 안 함(읽기만) — 단 3010 가드 없음(M-3).

### QA high_risk_areas (QA 에 전달)

1. **수치 정확도**(M-4): 화면 스크립트 값이 손으로 쓴 값 → 완료 기준 3(67→75·71·60·누적 2·3·21→3·4·29·"—")을 T1 `computeChallengeMetrics` 산출 응답이나 **실서버 QA 계정 3**(행이 아직 없음 — `qa-session.ts` upsert 는 Leader/QA 가 실행)으로 대조.
2. **오늘 달성(MET) 날 S4**(M-1 수정 뒤): 회화 줄 "문제 n/5"·날짜 띠 초점 시작점·"다 했어요" 상자.
3. **S3 만들기**: [다음] 막힘의 **시각 비활성**(M-2 수정 뒤)·이유 줄 `role=alert`·장수 15 비활성(표현 12개)+이유·409/400 `poolSize`/404/429 수동(스크립트 미포함: `s3.busy`·`c429`·`c404`·`tomorrow`·`again`)·단계 뒤로가기·새로 고침 초안 보존·`?again=`·**고른 주제 카드의 표현 미리 보기**(어느 스크립트 상태에도 없음) 후리가나/한글 층·16px.
4. **달력 회귀**: task-012 달력 스모크(운영 32/32 기준)·챌린지 없는 달 픽셀 동일(`cal.none` 미검사)·칩 3+n 과 3px 띠 겹침(I-4)·360px 터치.
5. **그만두기 왕복**: #159 busy 동안 시트 닫힘 막힘·409 NOT_ACTIVE·404·결과 큰 글 초점·`today.refresh`(L-9 실패 시 화면 모순)·결과 화면 "예정" 0칸·수행 연속 미표시·그만둔 직후 = 며칠 뒤 화면.
6. **셸**: 하단 탭 `/plan` 보임·3하위 숨김·권장 업데이트 띠도 숨김·강제 업데이트 띠는 보임·← 복귀(하루 시트 → 챌린지 줄 → 상세 ←"계획표로" 같은 달·날 시트).
7. **실기기·테마**: ◐ ✓ ✕ 글리프(M-5)·다크 390×892 1장·첫 화면(780) 카드 높이 ≤ 480.
8. **DB 쓰기 0 확인**: 이 3경로의 읽기 화면에서 `getProfile` 빈 upsert 외 쓰기가 없는지(만들기·그만두기만 쓰기).
9. **키보드·스크린리더**: 날짜 띠 roving(Tab 1번+방향키)·시트 초점 이동/복귀·토스트 `role=status`.

### designer 로 넘길 항목 (결함으로 판정하지 않음)

① ◐ 글꼴 비의존 모양(M-5) ② 기간 단계 날짜 범위가 시작일 선택 전(I-3) ③ 칩 3+n 과 3px 띠 겹침·카드 skeleton 172px ↔ 실제 카드 높이 차(I-4) ④ 가이드 P2-1(수행 연속 vs 연속 출석 혼동)은 사용자 실측 뒤 판단.

### 확인 못 한 것

- 화면 스크립트·dev 서버·브라우저를 **실행하지 않았다**(코드 읽기·손계산만) — 스크린샷·실제 가로 넘침·◐ 렌더링·`rounded-full!` 시각 효과(Tailwind v4 선례 확인, `.next` 산출 존재)는 못 봄. 갤럭시 실기기 글꼴 `[추측]`.
- NFS 현재 전체 상태 기준 `tsc`·502 는 미실행(미러 인계 시점 상태 — T3 소유 파일은 동일 확인).
- 실서버 연동(#155~#159 응답 모양과 화면의 일치)은 타입 대조(tsc 0)와 서버 코드 읽기까지만, 실응답 대조는 QA.
- Codex 검토: 이 task 는 judge 가 C2 개입을 판정하지 않아 `## Codex 검토` 없음(판정 대상 아님).

### 다음 단계 (권고)

1. **Leader**: 데모 게이트 정식 waive 기록 또는 BLOCKED 인지 진행 결정 기록(위 표). T1 `recentlyEnded.startDate` 추가 여부 결정(필수 아님).
2. **Developer(dev-043 신규 소환 또는 동일)**: **M-1·M-2·M-3**(각 1~5줄)을 QA 전에 수정 + L-1·L-2·L-4·L-5·L-9 같이(작은 것). 같은 결함 클래스 반려는 이번이 1회째(Sonnet 승격 권고 해당 없음 — developer 는 Opus). 수정 뒤 이 REV 를 Reviewer 부터 재순환(작은 diff 확인).
3. **QA**: 위 high_risk_areas 로 진행(M-1·M-2 수정 뒤 재순환 권장 — 안 고치고 QA 하면 같은 지점에서 되돌아온다).
4. **designer**: M-5·I-3·I-4 판단.

## Reviewer 기록 (REV-127)

- [00:08] **REV-127 — dev-043b(REV-122 M-1·M-2·M-3·M-5 수정) 재확인 판정 PASS_WITH_NOTES** (reviewer 신규 소환, Read 전용 — 코드·문서 무수정, 커밋·푸시·`db push`·DB 쓰기·dev 서버·브라우저·화면 스크립트 실행·운영 3010 접촉 없음. 변이 실험은 scratchpad 사본에서만 — 미러·NFS 원본 무수정). REV-122 의 7영역 결과는 유지하고 이번 diff 가 건드린 항목(아키텍처 import 방향·유지보수성·안정성(M-1 상태 경계)·운영성·보안(M-3 운영 가드)·학습 원칙(점수 "문제 n/5"·엔진명 0))만 다시 확인했다.
- 건수: Critical 0 · High 0 · **Medium 0** · Low 3 · Info 5. `native_change: false`(웹만 — `android/`·`plugins/`·`capacitor.config.ts` 변경 없음). **REV-122 의 M-1·M-2·M-3·M-5 4건 모두 수정 확인(재발 없음)**, M-4·Low 10건은 Leader 지시대로 이번 범위 밖(미변경).

### 데모 검토 게이트 (reviewer 부록 §7)

| 항목 | 결과 |
|---|---|
| `check.mjs check --task task-043…` | **`DEMO_GATE_PASSED` · status `waived`**(exit 0, waived_at 2026-10-06T23:43:51+09:00, waiver "데모 생략하고 진행해줘") |
| 사용자 입력 실재 | **[확인]** 훅이 기록한 `.claude/state/demo-gate/prompts.jsonl` 161번째 줄(ts 23:43:26)에 같은 문장, `evidence.jsonl` 21번째 줄(kind `waive`)의 `quote_sha256`(b748bd10…)이 그 문장의 sha256 과 일치, `transcript_uuid` d64acf34… 가 세션 transcript 에서 **`type=user`·`isSidechain=false`** 메시지(2026-10-06T14:43:26Z = KST 23:43:26) |
| 대리 기록 흔적 | **없음** — 승인(`approve`) 기록 0, `waive` 1건은 위 사용자 입력을 인용, frontmatter `waived_by: user`. `events.jsonl` 에 task-043 줄 0 |
| 시각 표기 정정 | 요청문의 "2026-10-07 00:43" 은 오기 — 실제 기록은 **2026-10-06 23:43 KST**(이력서 "데모 검토" 표는 맞음). dev-043b 기록의 "check = BLOCKED(drafting)" 는 이미 waived 가 된 뒤(23:43:51)라 낡은 문장이다(코드 영향 없음 — I-5) |
| 승인 데모 대비 차이 분류 | 승인 데모 없음(waive) → 기준 = designer 가이드. 이번 변경 중 **material 없음**(정보 구조·네비·CTA 동작·단계 수 불변). M-5 의 ◐ 글자 → SVG 는 **implementation**(기술적 필요 — 글꼴 비의존, 모양·색 토큰·의미 불변, Leader 지시) |

### REV-122 수정 확인 표

| REV-122 | 판정 | 근거 |
|---|---|---|
| **M-1** S4 오늘 칸을 TODAY 상태로 찾음 | **수정 확인** | 서버 하루 상태 우선순위 `metrics.ts:247-252` = STOPPED → UPCOMING → **MET(249) → TODAY(250)** → PARTIAL → MISSED 를 직접 읽었다(오늘이 MET 면 TODAY 칸 없음). `logic.ts:267` `todayDayOf(days, todayIndex)` = 일 번호로 찾음(0·없음 → null), `:273` `activeTodayView`(오늘 번호 = `today.dayIndex ?? stats.dayIndex`), `:281` `stripFocusDate(days, todayIndex)`, `:467` `scoreRows(days, goal, todayIndex)`. 쓰는 곳 3군데(`ChallengeScreen.tsx:175` 회화 줄·`DayStrip.tsx:27` 띠 초점·`DayStrip.tsx:93` 점수 표) 전부 같은 번호를 받는다. 남은 `state==='TODAY'` 는 하루 시트 문구(`logic.ts:393·414·436·450`)·띠 테두리(`DayStrip.tsx:56`)뿐 — 아래 손추적·L-1 |
| **M-2** 막힌 버튼 시각 비활성 없음 | **수정 확인** | `parts.tsx:13` `BLOCKED_DIM='aria-disabled:opacity-40'`, `:16` `ctaClass(busy)`(막힘 40% / 보내는 중 `opacity-70` — JS 로 하나만 골라 두 aria 꾸밈이 겹치지 않음). 적용: `ChallengeCreateScreen.tsx:277-280`([다음]·[챌린지 시작] — `aria-disabled={!!block\|\|busy\|\|undefined}`·`aria-busy` 유지), `createParts.tsx:176-179`(장수 칩 — 클래스는 항상, `aria-disabled` 는 막힌 칸에만 붙어 흐려짐은 막힌 칸만), `ChallengeSheets.tsx:162`([계속하기]). 클릭 무시 유지(`onNext` 의 `busy` 조기 반환·`block` 이면 이유만 표시, 칩 `!o.disabled`, 시트 `!busy && …`). 공용 `Btn` 의 `disabled:` 는 native 전용이라 충돌 없음. Tailwind 4.3.3 를 사본에서 직접 컴파일해 `.aria-disabled\:opacity-40[aria-disabled="true"]{opacity:40%}`·`.opacity-70` 가 만들어지는 것을 확인 |
| **M-3** 화면 스크립트 운영 가드 없음 | **수정 확인(코드 읽기 — 스크립트 실행 금지라 실행은 안 함)** | `task043-screens.ts:23` `APP_ENV`=PRODUCTION 이면 throw, `:25` 정규식(`http://(127.0.0.1\|localhost):숫자`, 끝 고정) + `BASE.endsWith(':3010')` → throw. 이 두 줄은 쿠키 읽기(`:27`)·Playwright 시작보다 위에 있어 `--base http://localhost:3010`·`http://127.0.0.1:3010`·끝에 `/` 가 붙은 주소·`[::1]`·`user@host` 형태는 모두 모듈 평가 단계에서 즉시 종료. `challenge-smoke.ts:25-26` 선례와 같은 문형. 머리 주석의 "QA 계정 3" 도 실제(계정 1 읽기 전용 쿠키)로 정정됨 |
| **M-5** ◐ 글꼴 의존 | **수정 확인** | `parts.tsx:30` `PartialMark` = 16×16 viewBox·원 테두리(r6.5·1.5)+왼쪽 절반 `path`(`M8 1.5a6.5 6.5 0 0 0 0 13z` — sweep 0 = 화면 반시계 → 왼쪽 절반)·`currentColor`·`width/height=1em`·`aria-hidden`·`focusable=false`, 새 색 0(hex·rgb 없음 — 테스트가 검사). ◐ → 그림으로 바뀐 곳: 달력 칩·범례(`plan/parts.tsx:23` `DayMarkInner`)·모양 원 sm/md/lg(`DayGlyph`)·할 일 "덜 함"(`TaskGlyphIcon`)·날짜 띠 범례(`DayStrip.tsx:73`)·하루 시트 배지(`ChallengeSheets.tsx:65`)·규칙 첫 줄(`ChallengeScreen.tsx:219-222`). **✓·✕ 는 글자 유지** |

### 손추적 — M-1 (서버 상태 우선순위를 전제로 `dayIndex` 기준이 맞는지, 7경우)

| # | 경우 | 입력 | 결과(코드로 따라가 확인) |
|---|---|---|---|
| 1 | 오늘 **MET**(4일째·수업 4/5) | `today.dayIndex=4`, days[4] 상태 MET(TODAY 칸 없음) | 오늘 칸 = 4일째 → 회화 줄 **"끝냈어요 · 문제 4/5"**, 띠 초점 `2026-10-06`, 점수 표 "10/6 **오늘**" 정확히 1개 ✓ |
| 2 | 오늘 **TODAY**(수업 3/5만) | 같은 번호, 상태 TODAY | 같은 칸 → "끝냈어요 · 문제 3/5", 띠 초점 오늘 ✓ |
| 3 | 오늘 TODAY·수업 기록 없음 | `lesson=null` | 점수 조각 없음(줄은 "수업이 준비됐어요 …"), 점수 표 오늘 줄 수업·단어 "아직" ✓ |
| 4 | 오늘 **PARTIAL**(서버는 오늘을 PARTIAL 로 보내지 않지만 코드가 상태에 의존하지 않음을 확인) | 상태 PARTIAL | 번호로만 찾으므로 같은 칸 ✓ |
| 5 | `today` **null** + `stats.dayIndex=0`(내일 시작) | `todayIndex=0` | `!todayIndex` → null → 칸 없음·줄 0·첫 칸 초점·" 오늘" 0 ✓ |
| 6 | 진행 중 **아님**(끝남·그만둠) | `ResultBody` 는 `todayIndex` 를 넘기지 않음 | `todayDayOf(…, null)` → null → 첫 칸 초점(`DayStrip.tsx:18` 기본값 null) ✓ |
| 7 | `today` null + `stats.dayIndex≥1`(`stats.dayIndex` 폴백) | — | 그 일 번호 칸이 오늘로 표시됨. **서버상 도달 불가** — `getChallengeDetail` 이 조회 앞에 `settleExpired`(`service.ts:157`)로 기간 지난 ACTIVE 를 닫고, `buildTodayTasks` 가 null 인 조건(기간 밖·주제 끊김)은 전부 그 전이에 걸린다(I-1) |

- 마지막 날(7/7)이 MET 인 경우도 같은 규칙으로 마지막 칸. `scoreRows` 의 폴백 `todayDay ? d===todayDay : d.state==='TODAY'` 는 번호가 없을 때만 상태를 보고, 번호가 맞으면 `d===todayDay`(같은 배열의 요소)라 " 오늘" 이 한 줄뿐이다.

### 변이 실험 — 새 테스트가 실제로 잡는지 (scratchpad 사본 `…/scratchpad/mut124`, 미러 `src` 복사 + `node_modules` 링크, 매번 원본 복원)

| 변이 | 대상 테스트 | 결과 |
|---|---|---|
| **`todayDayOf` 를 `d.dayIndex===todayIndex` → `d.state==='TODAY'` 로 되돌림(요청된 재현)** | `logic.test.ts` | **FAIL**(15/16 — "S4 오늘 칸은 일 번호로 찾는다…" 의 첫 단언 `[todayIndex, todayDay.date]` 에서 `2026-10-06` 이 빠짐) |
| `scoreRows` 의 오늘 판정을 상태로 되돌림 | `logic.test.ts` | FAIL(15/16) |
| `stripFocusDate` 를 상태 기준으로 되돌림 | `logic.test.ts` | FAIL(15/16) |
| `activeTodayView` 의 `todayDay` 를 상태 기준으로 되돌림 | `logic.test.ts` | FAIL(15/16) |
| `DAY_VIEW.PARTIAL` 을 `glyph:'◐'`(half 제거)로 되돌림 | `marks.test.ts` | FAIL(2/4) |
| `ctaClass(false)` 의 흐림 제거 | `marks.test.ts` | FAIL(1/4) |
| `ChoicePills` 칩의 `BLOCKED_DIM` 제거 | `marks.test.ts` | FAIL(1/4) |
| (대조) 변이 없이 복원한 사본 | challenge `__tests__` 전체 | **20/20 PASS** |

→ M-1 의 세 사용처(줄·띠·표)와 M-5·M-2 가 각각 독립적으로 회귀 방지된다.

### 지적 표

| # | 심각도 | 위치 | 내용(근거) | 고칠 방법 |
|---|---|---|---|---|
| L-1 | Low (designer 이관) | `DayStrip.tsx:55-57` | 날짜 띠 칸의 오늘 테두리(accent)가 상태 `TODAY` 일 때만 붙는다. M-1 로 오늘 칸 판정은 번호로 바뀌었지만 이 한 줄은 그대로라 **오늘 목표를 다 채운 날(상태 MET)에는 오늘 칸이 ✓ 만 보이고 오늘 표시가 없다**. 범례 `오늘` 도 `stripLegend`(상태 기준)라 TODAY 칸이 없으면 같이 사라진다. 그날 위치는 머리 "n일째 / m일"·점수 표 " 오늘"·첫 번째 UPCOMING 칸이 알려 주므로 혼동은 작다 | designer 가 정함(가이드 §3-4a 에 오늘 칸 테두리 규정 없음). 안 한다면 현행 유지. 한다면 `d.state==='TODAY' \|\| d.dayIndex===todayIndex` 한 줄(새 색 없음) + 칸 `aria-label` 에 ", 오늘" |
| L-2 | Low (검증 공백) | `tests/live/task043-screens.ts` | 42상태 화면 스크립트에 **오늘 MET 인 S4 상태가 없다**(`s4.normal` 은 오늘 TODAY). 이번 M-1 수정은 단위 테스트와 내 손추적으로만 확인됐고 브라우저 검사에는 걸리지 않는다. dev 도 스크립트를 재실행하지 않았다(`[추측]` — 기대 문구에 ◐·✓·✕·범례 문구가 없어 영향 없음은 grep 으로만 확인) | 스크립트에 `s4.met`(오늘 칸 MET + 수업 4/5, expect "끝냈어요 · 문제 4/5"·점수 표 " 오늘") 상태 1개 추가 또는 QA 가 수동 확인 |
| L-3 | Low (소유 밖) | `vocab/ChallengeStrip.tsx:21`·`vocab/ChallengeResultBox.tsx:18`·`lesson/ChallengeEndLine.tsx:22` | **dev 보고 확인 — ◐ 글자가 T4 소유 파일 3곳에 남아 있다**(`src` 전체 grep: 화면 문자열은 이 3곳뿐, 나머지는 서버 테스트 `challengeMetrics.test.ts` 의 표기용 기호). 셋 다 `aria-hidden` + 옆에 글자(띠·결과 상자 제목·"오늘 목표까지 …")가 뜻을 전해 의미는 안 사라지지만, `ChallengeStrip` 은 16px 원 안 10px 글자라 REV-122 M-5 가 짚은 "작은 반점/빈 네모" 위험이 가장 크다. 셋 다 untracked(T4 task-044 산출) | Leader 가 T4 보완에 배정: `import { PartialMark } from '@/components/challenge/parts'` 로 교체(`plan/parts.tsx` 가 이미 같은 방식) + T4 의 마크 테스트. 디자인 정본(`docs/design/challenge.md`)의 "◐" 표기는 "반원 그림"임을 한 줄 메모 |
| I-1 | Info | `logic.ts:274` | `today` null 인데 `stats.dayIndex≥1` 인 진행 중 상세는 서버가 만들지 않는다(위 손추적 7) — 폴백은 방어용 | — |
| I-2 | Info | 흐림 40%/70% | 선례 `eval/EvalStartScreen.tsx:227`(`aria-busy:opacity-70`·`aria-disabled:opacity-40`)과 같은 값. 대비는 토큰에서 직접 계산(근사 — 흐림은 요소 전체에 걸리므로 배경 포함): [다음] 막힘 라이트 **1.81:1**·다크 2.01:1, 보내는 중 라이트 **2.97:1**·다크 3.66:1, 15장 칩 막힘 라이트 1.73:1. WCAG 1.4.3 은 비활성 구성요소를 예외로 두고, 이유 문장은 전체 대비로 따로 보이며 `aria-describedby` 로 연결돼 있어 **위험도 낮음**. 다만 [다음] 이 막힘일 때 이유 문장은 한 번 눌러야 나온다(`tried`) | 수정 지시 아님 — QA 가 실기기에서 막힘 [다음] 이 "비활성으로 읽히되 라벨은 읽히는지" 확인 |
| I-3 | Info | `task043-screens.ts:23` | 가드의 `APP_ENV` 검사는 쉘 환경변수만 본다(스크립트가 `.env` 를 읽지 않음) — 실효 방어는 포트·호스트 검사(선례 `challenge-smoke.ts` 와 같은 구조) | 변경 불필요 |
| I-4 | Info | `docs/design/challenge.md` | 정본의 "일부 ◐" 표기는 그대로(기호 표기). 구현은 같은 의미의 반원 그림이라 불일치는 아님 | 다음 문서 갱신 때 "◐ = 반원 그림(PartialMark)" 한 줄 |
| I-5 | Info | dev-043b 기록 첫 줄 | "check = BLOCKED(drafting)" 는 23:43:51 waive 이후라 낡음. 이력서 `## Leader 결정 (… BLOCKED 처리, 00:10)` 도 waive 로 대체됨 | Leader 가 최종 요약에서 정식 waived 로 정리 |

### dev 가 짚은 디자인 미정 2건 판정

| 항목 | 판정 | 이유 |
|---|---|---|
| ⓐ 날짜 띠 오늘 테두리가 상태 TODAY 일 때만 | **결함 아님 — L-1 로 designer 확인 후보**(Low) | 가이드에 규정이 없고 혼동 가능성이 낮다. 위험은 "오늘 목표를 채운 사용자가 띠에서 오늘 위치를 못 짚는다" 하나뿐이고 수정이 한 줄(새 색 없음)이라 비용이 작다 |
| ⓑ 흐림 40%/70% 수치 | **위험도 낮음(수정 지시 아님)** — I-2 | 기존 선례 값과 동일, 계산한 대비는 WCAG 비활성 예외, 이유 문장은 별도 전체 대비 |

### 재실행 숫자 (미러 `~/.node-local/thekaiwa-043`, `KAIWA_LOCAL_ROOT` 로 sync 후 — 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`)

| 항목 | 기대 | **실제** |
|---|---|---|
| `src/components/challenge/__tests__` + `src/components/plan/__tests__` | 38/38 | **38/38 PASS**(challenge 20 = logic 16 + marks 4 · plan 18, fail 0·skipped 0) |
| `src/components`+`src/types` 전체(`--test-concurrency=1`) | 523 | **546/546 PASS**(fail 0·cancelled 0·skipped 0). 차이 +23 = 다른 WP 의 새 테스트 `src/components/speech/__tests__/task012b2.test.ts`(23건, 23:50 생성 — 파일의 `test(` 수로 확인), T3 와 무관 |
| `tsc --noEmit`(전체) | 0 | **0 오류**(exit 0, 출력 0줄) |
| eslint(`src/components/challenge` `src/components/plan` `src/app/(app)/plan` `routes.ts` `tests/live/task043-screens.ts`) | 0 | **0**(exit 0, 출력 0줄) |
| 보이지 않는 문자(U+200B–U+200F·U+2028·U+2029·U+FEFF·U+202A–U+202E·U+00A0·U+2060–U+2064·U+00AD·U+180E·U+2066–U+2069) + 제어문자 스캔 — T3 소유 27개 파일(challenge·plan·shell/routes·`app/(app)/plan`·task043-screens) | 0 | **0건**(탐지 방법이 U+200B 를 실제로 잡는지 대조 확인) |
| 반원 글자(U+25D0) — T3 소유 화면 소스(테스트 제외) | 0 | **0** · `src` 전체 화면 문자열은 T4 3곳만(L-3), `public/`·`android/`·`plugins/` 0 |

- 미러 T3 소유 디렉터리(`components/challenge`·`plan`·`shell`·`app/(app)/plan`·`types`)와 `tests/live/task043-screens.ts` 는 NFS 와 `diff -rq` 동일.

### 범위 이탈 확인

- dev-043b 가 건드린 파일(수정 시각 23:44–23:47) = `challenge/{challengeCopy,DayStrip,logic,ChallengeScreen,ChallengeSheets,parts,ChallengeCreateScreen,createParts}`·`challenge/__tests__/{logic,marks}.test.ts`·`plan/parts.tsx`·`tests/live/task043-screens.ts` — 전부 T3 소유·보고와 일치. `routes.ts`·`planReturn.ts`·`modules/**`·`prisma/**`·`vocab/**`·`lesson/**`·`globals.css` 는 이번 라운드에 손대지 않음. 같은 시간대의 다른 변경(T1 `modules/learning/challenges/*`·012b-2 `components/speech/*`·T4 `vocab/labels.ts` 등)은 다른 WP 이며 T3 파일과 겹치지 않는다.
- 경계: `components/challenge`·`plan/parts` 에 `@/modules`·`prisma` import 0, 엔진명·model_id·speaker_id 0, `console.*`·디버그 잔재 0, 새 색 0, 순환 import 없음(`plan/parts → challenge/parts`(runtime) → `challengeCopy`, `challenge/parts → ./logic` 는 타입만).

### QA high_risk_areas (REV-122 목록 갱신 — QA 에 전달)

1. **오늘 MET 날 S4**(브라우저로 직접): 서버 실응답에서 오늘 칸이 `MET`(TODAY 칸 없음)인지 → 회화 줄 "끝냈어요 · 문제 n/5"·날짜 띠 Tab 첫 초점이 오늘 칸·점수 표 "n/d 오늘" 1개·"다 했어요" 상자. 같은 화면을 오늘 TODAY·내일 시작·마지막 날(7/7 MET)·끝난 챌린지(첫 칸 초점)에서도(L-2: 스크립트에 이 상태가 없음).
2. **◐ → SVG 시각 확인**(실기기 갤럭시 1회 + 360/390/412 × 라이트·다크, 화면 글꼴 크게): 달력 17px 칩(칩 3개+n 줄·2줄일 때 3px 띠와 겹침 I-4 포함)·달력 범례·날짜 띠 22px 원·띠 범례 줄·하루 시트 30px 상태 상자·"덜 풂 · n/m장" 배지·계획표 카드 "덜 함" 줄·상세 규칙 첫 줄. 반원이 또렷한지(왼쪽 절반 채움), 칩·원 크기·정렬이 안 흔들리는지, 터치 44px 유지.
3. **막힘·보내는 중 흐림**: 만들기 [다음](목표 둘 다 끔·주제 없음)·15장 칩(표현 12개 주제)·[챌린지 시작] 보내는 중 70%·그만두기 시트 busy 때 [계속하기] 흐림 — 흐려 보이되 라벨이 읽히는지(I-2), 막힌 버튼을 눌러도 이동하지 않고 이유가 나오는지, 스크린리더가 `aria-disabled`·`aria-describedby` 를 읽는지.
4. **화면 스크립트 재실행**(dev-043b 이후 미실행): 1491 기대·`APP_ENV=PRODUCTION` 과 `--base http://localhost:3010` 이 시작 즉시 오류로 끝나는지(운영 접속 없이 거부 — 안전).
5. **수치 정확도**(M-4, 미변경): 완료 기준 3(67→75·71·60·누적 2·3·21→3·4·29·"—")을 T1 `computeChallengeMetrics` 산출 응답 또는 실서버 QA 계정 3 으로 대조(계정 3 행은 `qa-session.ts` upsert 필요 — Leader/QA 몫).
6. **S3 만들기**(REV-122 3번 유지): 장수 15 비활성+이유·409/400 `poolSize`/404/429·단계 뒤로가기·새로 고침 초안 보존·`?again=`·고른 주제 카드 표현 미리 보기 후리가나/한글 층·16px.
7. **달력 회귀·그만두기 왕복·셸·DB 쓰기 0·키보드/스크린리더**: REV-122 high_risk 4·5·6·8·9 그대로.
8. **T4 화면의 ◐ 3곳**(L-3 가 배정·수정되면): 오늘 탭 챌린지 띠·단어 결과 상자·수업 끝 줄에서 같은 시각 항목.

### 확인 못 한 것

- 화면 스크립트·dev 서버·브라우저를 **실행하지 않았다**(지시) — SVG 실제 렌더·흐림 시각·갤럭시 글꼴은 못 봄. 대비 수치는 토큰에서 계산한 근사값이다.
- 화면 스크립트 1491 은 dev-043b 이후 한 번도 안 돌았다(L-2·QA 4).
- 실서버 연동(#155~#159 응답과 화면의 실응답 대조)·T1 `metrics.ts` 계산값과 화면 수치 대조는 QA.
- Codex 검토: judge 가 C2 개입을 판정하지 않아 `## Codex 검토` 없음.

### 다음 단계 (권고)

1. **Leader**: ① L-3(T4 ◐ 3곳 → `PartialMark`) 를 T4 보완에 배정 ② L-1 을 designer 확인 항목으로 보관(결함 아님) ③ 이력서 최종 요약에서 데모 게이트를 정식 `waived` 로 정리(I-5).
2. **Developer(선택)**: L-2 `s4.met` 상태 1개 추가(작은 변경) — 안 해도 QA 수동 확인으로 대체 가능.
3. **QA**: 위 high_risk_areas 로 진행. REV-122 와 달리 되돌아올 Medium 은 남지 않았다.

## Reviewer 기록 (REV-129)

- [00:25] **REV-129 — dev-043c(REV-127 L-1·목록 이어 읽기·L-2 보완) 좁은 재검토 · 판정 PASS** (신규 소환 reviewer, Read 전용 — 코드·문서 무수정, 커밋·푸시·`db push`·DB 쓰기·dev 서버·브라우저·화면 스크립트 실행·운영 3010 접촉 없음. 변이 실험은 scratchpad 사본(`…/scratchpad/mut`)에서만, 매번 원복·마지막에 미러와 diff 0). 범위 = 변경 6개 파일(`challenge/{logic.ts,DayStrip.tsx,ChallengeListScreen.tsx,useChallengeData.ts,__tests__/logic.test.ts}` + `tests/live/task043-screens.ts`). **Critical 0 · High 0 · Medium 0 · Low 0 · Info 5.** `native_change: false`. REV-127 의 L-1·L-2 와 REV-126 이 넘긴 "목록이 빈 쪽+커서를 못 이어 읽음" 모두 해소.
- 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(waived). 이 task 의 근거 줄은 `evidence.jsonl` 21행 `kind=waive` → `prompts.jsonl` 161행 사용자 프롬프트(REV-127 이 이미 같은 확인을 했고 이번에 다시 맞춰 봄 — 같은 `session_id`·`prompt_ts` 23:43:26).

### 재실행 숫자 (미러 `~/.node-local/thekaiwa-043`, 이 REV 가 `KAIWA_LOCAL_ROOT` 로 sync 1회 + `prisma generate` 1회, 전부 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)

| 항목 | 개발자 보고 | 내 재실행 |
|---|---|---|
| challenge + plan 단위(`src/components/{challenge,plan}`) | 40/40 | **40/40**(fail 0·cancelled 0·skipped 0) |
| `src/components`+`src/types` 전체(`--test-concurrency=1`) | 554/554 | **554/554**(fail 0·cancelled 0·skipped 0) — 숫자 일치(T4 쪽 REV-128 도 같은 554) |
| `tsc --noEmit`(전체) | 0 | **0 오류**(출력 0줄) |
| eslint(`challenge`·`plan`·`app/(app)/plan`·`shell/routes.ts`·`tests/live/task043-screens.ts`, 27파일) | 0 | **0 error · 0 warning** |
| 보이지 않는 문자(U+200B–200F·2028·2029·FEFF·202A–202E·2060–2064·00AD·180E·2066–2069) 변경 6파일 | 0 | **0** |
| 미러 ↔ NFS(`cmp`) 변경 6파일 | 동일 | **동일** |
| 새 색·엔진명·`@/modules`/prisma/`window.Capacitor`/`spawn` import(변경 UI 파일) | 0 | **0**(hex 비슷한 `#155` 는 주석의 API 번호) |
| 범위 이탈(00:05 이후 수정된 `src`·`tests`·`prisma` 파일 중 위 6개 밖) | 0 | **0 — [확인]** |
| 화면 스크립트 상태 수 | 42 → 44 | **44**(`grep` 으로 `{ id:` 44줄) |

### 1. L-1 — 날짜 띠 오늘 테두리·읽기 이름 [확인(코드+단위+변이)]

- `stripCellIsToday(day, todayIndex)` = `day.state === 'TODAY' || todayDayOf([day], todayIndex) !== null`(`logic.ts:256`). `todayDayOf` 는 `!todayIndex || <1` 이면 null → **일 번호 0(내일 시작)·null(끝난 챌린지)은 번호로는 오늘이 아님**. 서버 쪽 근거를 직접 읽음: `metrics.ts` 의 하루 상태에서 `TODAY` 는 `ch.status === 'ACTIVE' && date === today` 일 때만 나오므로 끝난·그만둔 챌린지에는 TODAY 칸 자체가 없다 — 그래서 "끝난 챌린지엔 테두리 없음"은 `ResultBody` 가 번호를 안 넘기는 것(`ChallengeScreen.tsx:283`)과 합쳐 구조적으로 보장된다. 진행 중 상세는 `ActiveBody` 가 `activeTodayView` 의 `todayIndex`(= `today.dayIndex ?? stats.dayIndex`)를 넘긴다(`:175,186,207`). 오늘 칸은 서버가 오늘을 MET 로 주든 TODAY 로 주든 **한 칸**(일 번호는 칸마다 유일). 두 칸이 동시에 테두리가 되려면 서버가 TODAY 칸과 다른 번호를 줘야 하는데 같은 응답 안에서 계산돼 불일치할 수 없다 [코드 읽기].
- **새 색 0**: `border-accent`·`border-line` 기존 토큰 두 개만(`DayStrip.tsx:55-57`), 추가 CSS 없음.
- **읽기 이름 `, 오늘` 판정 = 범위 초과 아님, 수용.** REV-127 지적 표 L-1 의 "고칠 방법"에 "칸 `aria-label` 에 ', 오늘'" 이 이미 들어 있었다(이 이력서 852행). 충돌·중복: ① 상태가 TODAY 면 상태 글자가 이미 "오늘"이라 접미를 붙이지 않음(`stripCellAria`: `state !== 'TODAY' && …`) — "…, 오늘, 오늘" 불가 ② 접미는 마지막에만 붙어 "n일째, 달성, 오늘" 꼴(상태 단어와 어순 충돌 없음; 칸의 다른 접미/접두는 없음 — `aria-haspopup="dialog"` 는 속성) ③ 진행 중 챌린지에서 오늘이 PARTIAL/MISSED/STOPPED 인 경우는 서버상 만들어지지 않지만(위 우선순위) 만들어져도 "…, 일부, 오늘"처럼 읽혀 충돌 없음 ④ 범례(`stripLegend`)는 상태 기준이라 그대로 — 아래 I-1.
- **변이 실험**(scratchpad 사본에서 `logic.ts` 를 한 줄씩 바꾸고 `logic.test.ts` 실행, 기준선 18/18): **Ma** `stripCellIsToday` 를 상태만 보게 되돌림 → `not ok 11`(띠 테두리 테스트) · **Mb** `stripCellAria` 가 TODAY 에도 접미를 붙임 → `not ok 11` · **Mc** `todayIndex === null` 이면 모든 칸을 오늘로 봄 → `not ok 6`(상태 글자+모양)·`not ok 11` 2건. 테스트가 정적 HTML 로 칸마다 `border-accent`·`border-line`·`aria-label` 을 직접 읽으므로(오늘 MET·TODAY·PARTIAL=1칸, 다른 칸 선 색·읽기에 오늘 없음, 내일 시작 0칸, 끝난 챌린지 0칸) 판정 분기 반전이 그대로 실패로 나온다.

### 2. 목록 이어 읽기 `readListPages` / 훅 / 화면 [확인(코드 추적+단위+변이)]

- **무한 루프 없음**: 반복은 `n < maxPages`(기본 5)와 `seen`(시작 커서 + 지금까지 읽은 커서) 두 겹으로 막힌다. 손추적: ① 빈 쪽 2개 뒤 행 쪽 → 호출 `[null,'c1','c2']`, 커서 `c3` ② 같은 커서 반복(`'same'`) → 호출 2번 뒤 커서 null ③ 2주기 순환(a→b→a) → 호출 3번 뒤 null ④ 계속 새 커서(`k1,k2,…`)·`maxPages=3` → 호출 3번 뒤 마지막 커서(`k3`)를 남김(`seen` 에 안 넣었으므로 [더 보기] 가 이어서 읽음) — 기본 5면 첫 읽기 최대 5요청(행 100개 분량). ⑤ 반복 커서가 비지 않은 쪽에 붙어도 최종 커서는 null 로 정리.
- **중복 행**: 첫 읽기는 마지막으로 읽은 한 쪽의 행만 돌려준다(빈 쪽은 행이 없음). [더 보기] 는 `loadMore` 가 `seen = new Set(items.id)` 로 걸러 붙인다 — 같은 쪽이 한 번 더 와도 중복 행 0.
- **빈 상태 판정**: `isListEmpty(items, cursor)` = 행 0 **그리고** 커서 없음. 행 0 + 커서면 목록·안내 줄 없이 [더 보기]만(`ChallengeListScreen.tsx:36-79`). 더 읽어서 `[]`+null 이 되면 그때 빈 상태 문구. 행 있는 쪽의 뒤쪽이 비어 있는 경우도 목록 유지·[더 보기] 만 사라짐.
- **경쟁 상태**: ① **빠른 연타** — `busy` ref 가 첫 클릭에서 동기로 켜져 둘째는 반환(`useChallengeData.ts:55`); 완료 순간(`busy=false` 와 리렌더 사이)의 극미한 창에 눌려도 옛 커서로 같은 쪽을 한 번 더 읽는 것뿐이고 `id` 로 걸러 목록이 깨지지 않는다. ② **`reload` ↔ `loadMore` 겹침 불가** — `reload` 는 오류 상태의 [다시 시도]에서만 나오고, `loadMore` 는 커서가 있는 ready 상태에서만 눌린다(첫 읽기 중엔 커서 null) → 코드로 두 길이 만날 수 없음. ③ **첫 읽기 정리** — effect 의 `cancelled` 로 언마운트·재실행 뒤 `setState` 없음(StrictMode 이중 effect 는 두 번째만 반영). ④ **`loadMore` 는 언마운트 가드가 없음** — 읽기 중 화면을 떠나면 `setState`·토스트 호출이 사라진 컴포넌트에 가지만 React 18 이상은 조용히 무시한다(경고·누수 없음) → I-3. ⑤ 실패 시 `busy=false`·`more:'idle'`·**커서 유지**·토스트 → 다시 눌러 재시도 가능(다 읽다 실패한 부분 결과는 버려짐, 중복·누락 없음).
- **변이 실험**: **Md** 반복 상한 `n <= maxPages`(한 쪽 더) → `not ok 12` · **Me** 루프의 `!seen.has` 제거 → `not ok 12` · **Mf** 마지막 커서 정리 제거 → `not ok 12` · **Mg** `isListEmpty` 가 커서를 안 봄 → `not ok 12`. **Mh**(시작 커서를 `seen` 에 넣지 않음)는 테스트가 **못 잡았다(생존)** — 결과 값은 같고 같은 시작 커서가 되돌아올 때 요청이 1번 더 나갈 뿐이라 동작상 차이는 없다 → I-2(테스트에 `calls.length` 단언 1줄이면 잡힘).

### 3. 화면 스크립트 `s4.met`·`s4.metlast` + `dom` 선택자 — 컴포넌트와 대조 [확인(코드 읽기 — 실행 금지, tsc·eslint 만)]

- **상태 값**: `MET_TODAY_DAYS` = 10/3 시작 7일, 상태 `[MET,MET,PARTIAL,MET]` 이라 **4일째(10/6, 오늘) = MET·나머지 UPCOMING**, `today.dayIndex=4`·`stats=BOTH`(rate .75·todayMet) → 서버가 주는 "오늘 목표 달성한 날" 모양과 일치(TODAY 칸 없음). `s4.metlast` = 9/30 시작·`endDate` 10/6·`LAST_STATS.dayIndex=7`·`todayTasks({dayIndex:7})` → 7일째(10/6)=MET 마지막 칸. 두 상태 모두 `status:'ACTIVE'` 라 `ActiveBody` 로 그려지고 `todayIndex = today.dayIndex` (4·7).
- **`dom` 선택자 ↔ 실제 DOM**(모두 `DayStrip.tsx` 칸 `<button>` 한 개의 속성): `[data-strip].border-accent`=1 ✓(`data-strip` 은 칸에만, 오늘 칸만 `border-accent`) · `[data-strip="2026-10-06"].border-accent`=1 ✓ · `[…][tabindex="0"]`=1 ✓(`roving` 초깃값 `stripFocusDate(days, todayIndex)` = 오늘 칸 날짜, `tabIndex={0}` 가 `tabindex="0"` 로 렌더) · `[…][aria-label$="4일째, 달성, 오늘"]`=1 ✓(`stripCellAria` = "10월 6일 화요일, 4일째, 달성, 오늘" — 끝 일치), 마지막 날은 `"7일째, 달성, 오늘"` ✓.
- **기대 문구 일치**: "4일째 / 7일"·"7일째 / 7일" = 머리 부제(`ChallengeScreen.tsx:120`, 마지막 날은 뒤에 "· 오늘 자정에 마감돼요"가 붙어도 `includes`) ✓ · "75%" = `rateTile` ✓ · "끝냈어요 · 문제 4/5"(`s4.metlast` 는 5/5) = `activeTodayView` 가 오늘 칸(번호로 찾음) 수업 점수를 회화 행에 붙인 문구 — 날 4 `L(4)`·날 7 `L(5)` 와 일치(REV-127 손추적 1번과 같은 경로) ✓ · "10/6 오늘" = `scoreRows` 의 `dateText`(`${m}/${d}${today ? ' 오늘' : ''}`) 한 `<span>` 안이라 `innerText` 에 그대로 붙음 ✓, 점수 표는 `!isFresh` 일 때 그려지고 두 상태 모두 `elapsedDays≥4` 라 그려짐 ✓. `s4.metlast` 는 지난 7행이 모두 최근 7행 표에 들어가 접힌 `<details>` 안으로 밀리지 않음 ✓.
- **가드 유지 [확인]**: `task043-screens.ts:23` `APP_ENV=PRODUCTION` 거부 · `:25` 정규식(localhost·127.0.0.1 + 포트 숫자) + `BASE.endsWith(':3010')` 거부가 쿠키 파일 읽기(`:27`)·`chromium.launch` 보다 위에 그대로 있다. T4 와 같은 `03010` 우회(I-4)는 여기에도 동일.
- 실행하지 않았으므로 **실제 통과 여부는 QA 몫** — 위는 코드 대조이고, 선택자가 단위 테스트의 정적 HTML 과 같은 클래스·속성을 쓰는 것까지는 확인.

### 지적 표 (REV-129)

| ID | 심각도 | 파일:줄 | 내용 | 권고 |
|---|---|---|---|---|
| I-1 | INFO(디자인→Leader) | `DayStrip.tsx:70-77`·`logic.ts:stripLegend` | 오늘 MET 날은 오늘 칸의 "오늘" 표시가 **1px accent 테두리(색)뿐**이고 눈에 보이는 범례에도 없다 — 읽기 이름·점수 표 " 오늘"·머리 "n일째"가 말해 주는 것은 보조기기·표 쪽(dev 의 남은 위험 ① 과 같음). 새 결함이 아니라 REV-127 L-1 을 코드로 고친 뒤 남는 디자인 항목 | Leader→designer: 오늘 칸이 TODAY 가 아닐 때 범례에 "테두리 = 오늘" 한 줄을 둘지 결정(코드 변경은 그 뒤) |
| I-2 | INFO(테스트 공백) | `__tests__/logic.test.ts` 목록 테스트 | 시작 커서가 되돌아오는 경우(`readListPages(f,'c2')` → `[]`+`'c2'`)의 **요청 횟수**를 단언하지 않아 `seen` 에 시작 커서를 넣지 않는 변이(Mh)가 생존. 동작 결과는 같고 요청이 1번 늘 뿐 | 선택: `calls.length === 1` 단언 1줄 |
| I-3 | INFO | `useChallengeData.ts:55-70` | `loadMore` 는 언마운트 가드가 없다 — 읽는 중 화면을 떠나도 `setState`·`onMoreFail()`(토스트)이 호출되지만 React 18+ 에서는 무시된다. 첫 읽기는 `cancelled` 로 막혀 있어 비대칭일 뿐 | 조치 불필요(원하면 같은 `cancelled` ref 한 줄) |
| I-4 | INFO | `tests/live/task043-screens.ts:25` | 포트 가드가 `endsWith(':3010')` 이라 `03010` 입력은 통과(T4 REV-128 I-1 과 같은 한 줄이 `challenge-smoke.ts` 에도 있음) | 선택: `Number(port) === 3010` 비교로 세 파일 한 번에 |
| I-5 | INFO | `ChallengeListScreen.tsx:36-79` | 행 0 + 커서(5쪽 읽고도 비어 있음)면 설명 문구 없이 [더 보기] 한 버튼만 보인다(dev 남은 위험 ③ — 서버가 끝난 행만 연속 100개 건너뛰는 경우로 실사용 확률 사실상 0) | 조치 불필요 |

### QA `high_risk_areas` 갱신 (REV-127 목록에서 바뀐 것만 — 나머지 5·6·7번은 그대로)

1. **오늘 MET 날 S4(브라우저)** — 이제 화면 스크립트 `s4.met`·`s4.metlast` 가 덮는다. 눈으로도: 오늘 칸 한 개만 accent 테두리·Tab 첫 초점이 오늘 칸·스크린리더가 "10월 6일 화요일, 4일째, 달성, 오늘"로 읽는지, 오늘이 TODAY(`s4.normal`)일 때 "…, 4일째, 오늘"(**"오늘" 두 번 아님**), 내일 시작(`s2.tomorrow` 상세)·끝난 챌린지(`s8.*`)는 테두리 0칸, 14·30일 챌린지에서도 한 칸.
2. **화면 스크립트 첫 실행**(dev-043b 이후 미실행 — 44상태 × 3폭 × 2높이): `node --import tsx tests/live/task043-screens.ts --base http://localhost:<포트> --user <쿠키 파일>`. `s4.met`·`s4.metlast` 의 `요소 … n개` 4검사가 3폭에서 모두 통과하는지, 시작 즉시 `APP_ENV=PRODUCTION`·`--base …:3010` 이 오류로 끝나는지(운영 접속 없이 거부 — 안전). 운영 포트를 `03010` 으로 쓰지 않는다(I-4).
3. **기록 목록 `/plan/challenges` 이어 읽기** — 스크립트에는 이 경우 상태가 없다(`s8.list`·`s8.lempty`·`s8.lerror` 만). 필요하면 `challenges` 응답을 순서대로 `[]+커서` → `[]+커서` → `행+커서`(·마지막 `[]+null`)로 가로채 확인: 빈 쪽을 건너뛰고 행이 보이는지, [더 보기] 빠른 두 번 누름에 요청 1번, 읽기 실패 시 토스트+같은 커서로 다시 눌러 이어지는지, 행 0+커서면 [더 보기]만 있고 눌러서 `[]`+null 이면 "아직 챌린지 기록이 없어요." 로 바뀌는지.
4. 그 밖은 REV-127 의 2(◐→SVG 시각, 이제 **T4 3곳**(`ChallengeStrip`·`ChallengeResultBox`·`ChallengeEndLine`)도 `PartialMark` 로 바뀜 — REV-128), 3(막힘·보내는 중 흐림), 5(수치 정확도), 6(S3 만들기), 7(달력 회귀·그만두기 왕복·키보드/스크린리더) 그대로.

### Leader 확인

1. **I-1(오늘 MET 칸의 눈에 보이는 범례)** — designer 판단, 필수 아님. 지금은 테두리·읽기 이름·표로만 전달됨.
2. **커밋 순서** — T3 `src/components/challenge/` 전체가 untracked 이고 T4 3파일이 `challenge/parts.tsx` 를 import 한다(REV-128 확인 1). **T3+T4 한 커밋 또는 T3 먼저.**
3. 판정 PASS → **QA 로 진행 가능**(되돌아올 Medium 이상 없음). judge C2 가 필요하면 이 REV 뒤 Leader 가 호출.

## QA 기록

### qa-p2a (2026-10-07 — LLM 0 레인 · D 항목, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조)
- **고정 응답 `tests/live/task043-screens.ts`(원본, 수정 없음) = 합계 1590 · PASS 1587 · FAIL 3**(기대 1491 + `s4.met`·`s4.metlast` DOM 검사 99건 — **새 검사 전부 PASS**: 3폭 모두 오늘 칸 `border-accent` 1개·`tabindex=0`·읽기 이름 끝 "N일째, 달성, 오늘"). FAIL 3 = `s3.step2` 날짜 문구 "10월 6일 (화) ~ 10월 12일 (월)" 3폭 — **제품 결함 아님**: 스크립트 기준일이 2026-10-06 으로 하드코딩이라 오늘(10-07)과 어긋난 것, 실제 화면은 "10월 7일 (수) ~ 10월 13일 (화)"(스크린샷 `b1.sending` 의 기간 줄에서 확인). `APP_ENV=PRODUCTION`·`:3010` 거부 가드는 시작부 코드(`:36·:43`)로 확인했고 실제 접속은 하지 않았다 — `03010` 입력은 통과하는 구멍은 Leader 후속 메모 그대로.
  - (참고) 첫 실행은 FAIL 수백 건이었다: 내 미러 안에 남긴 옛 `.next` 복제 폴더가 Tailwind 소스 스캔에 걸려 CSS 가 깨진 **QA 환경 오류**(폴더를 미러 밖으로 옮기고 서버 재기동 뒤 정상) — 제품 결함 아님.
- **보강 사본 `tests/live/p2a-qa/task043-screens-x.ts`(원본 + 다크·날짜 동적·어절 줄바꿈·`<img>` 주입·XSS 상태 3·막힘/보내는 중 프로브 3·목록 이어 읽기 2)**: 라이트 2079 체크 / 다크 2229 체크, FAIL 3 = 내 프로브 `b3` 가 "탭 전" 상태에서 이유 문구를 기대한 도구 오류(이유는 탭 뒤에 나오는 설계, `s3.nogoal` 이 이미 PASS) — **제품 FAIL 0**. 전 상태 × 360/390/412 × 892/780: 가로 넘침 0 · 스크롤 영역 ≤1 · 터치 44px(`::before` 히트 영역 반영) · 엔진명·모델명·task/Phase 번호 0 · **다크 토큰 반전**(배경 휘도 <0.25·글자 >0.5, 계산값) · **한국어 어절 중간 줄바꿈 0**(한글 연속 구간 기준) · `<img src=x onerror=…>` 를 챌린지 제목·주제 제목에 넣은 `x1.plan`·`x2.detail`·`x3.list` = 글자 그대로 보이고 `img` 요소 0.
- **목록 이어 읽기(REV-127 #3·REV-126 L-1)**: 응답 순서를 `[]+c1 → []+c2 → 행+c3` 으로 주입(`c1.chain`) → 빈 쪽을 건너뛰고 "진행 중" 행과 [더 보기] 가 보이고 "아직 챌린지 기록이 없어요" 없음 · `[]+c1 → []+null`(`c2.emptychain`) → "아직 챌린지 기록이 없어요" 만 · 3폭 81/81 PASS. **NOT_VERIFIED**: [더 보기] 빠른 두 번 누름 요청 1번 · 읽기 실패 토스트+같은 커서 재시도.
- **실데이터 대조 `tests/live/p2a-qa/challenge-live-ui.ts` = 27/27 PASS**(QA 계정 3, 실제 DB 행·실제 API, LLM 0 — 챌린지(오늘−3 시작·수업+단어 5장→4장)·과거 3일 스냅샷 심기·**오늘 세트는 실제 `#47`→답 4→`#51`**): 서버 응답 `#157` = 손계산(4일째 / 7일·4일 중 2일·**50%**·수행 연속 1·최장 1)·상태 `MET,PARTIAL,MISSED,MET,UPCOMING×3`·누적 수업 3·세트 2·맞힌 카드 8·`#158` 두 과제 DONE·`#70` 칩 상태·`#71` 줄. **화면(3폭 모두)**: 상세에 "4일째 / 7일"·"50%"·"4일 중 2일"·"수행 연속"·"최장 연속"·"끝냈어요 · 문제 4/5"·"8장" · 계획표 카드 "챌린지 · 4일째 / 7일"·"50%"·"2 / 2 · 다 했어요" · 기록 목록 "진행 중"·제목·"4일째 · 4일 중 2일 달성" 전부 API 값과 일치, 페이지 오류 0·가로 넘침 0. **오늘 MET 날 S4(눈으로)**: 날짜 띠 `4(일) ✓달성 · 5(월) ◐일부 · 6(화) ✕놓침 · 7(수) ✓달성[오늘, 주황 테두리 1칸] · 8~10 예정`, 읽기 이름 "10월 7일 수요일, 4일째, 달성, 오늘"(오늘이 두 번 아님), 오늘 할 일 "2 / 2", 단어 "오늘 4장 풀음(4장 이상)"·회화 "끝냈어요 · 문제 4/5", 점수 표 오늘 행 "10/7 오늘". **참고(문서 정정)**: REV 가 S4 에 있다고 적은 "다 했어요"는 `dayWord`(`ChallengePlanCard.tsx:156`) 즉 계획표 카드 전용 문구다 — 상세 화면에는 없고 계획표 카드에는 "2 / 2 · 다 했어요" 로 있다.
- **막힘·보내는 중 흐림(REV-127 #3) — 눈 + 수치**: `다음`(차단·`opacity-40`) 글자/버튼 대비 4.80 → 흐림 적용 뒤 **1.39:1**(눈으로 라벨이 거의 안 읽힘, 이유 문구는 빨간 글씨로 읽힘) · `시작하는 중…`(`opacity-70`) **1.92:1**(읽히나 약함) · `계속하기`(그만두는 중 시트, `opacity-40`) 2.41:1. 비활성이 아니라 탭하면 이유를 보여 주는 `aria-disabled` 라 WCAG 비활성 예외가 적용된다고 단정할 수 없음 → **결함 #3(Medium·접근성, designer 판단)**. 비활성 `15장` 칩은 흐리지만 바로 아래 이유("이 주제 표현이 12개라 15장은 고를 수 없어요")가 읽힘.
- **결함 #3** `src/components/challenge/parts.tsx:13,17`(`BLOCKED_DIM = 'aria-disabled:opacity-40'`·`opacity-70`) / 실행 `task043-screens-x.ts --only b` → 위 대비값 / 기대: 흐려 보여도 라벨 대비 ≥3:1 / 원인: 버튼 전체에 불투명도를 줘서 글자와 배경이 함께 옅어짐 → 라벨은 `text-ink` 유지·배경만 옅게 등.
- **NOT_VERIFIED**: ◐ SVG 실기기(갤럭시 S25+·글꼴 크게) 시각 — 3폭 × 라이트·다크에서 반원이 보이는 것까지만 확인(DSF 2.625 에뮬레이션) · 스크린리더 실제 낭독(DOM 의 `aria-label` 만 확인) · [더 보기] 빠른 두 번/읽기 실패.

## QA 시각 검증
<!-- 화면 task. viewport 3폭 × 2높이·DSF·브라우저·테마·locale·timezone·폰트 대기·애니메이션 off·고정 응답 fixture·캡처 범위·허용 범위 -->
- 재현 조건(qa-p2a): viewport 360·390·412 × 높이 892(780 으로 줄여 재측정) · DSF 2.625 · isMobile·hasTouch · Chrome 147.0.7727.101 headless(`/usr/bin/google-chrome`) · 라이트 / 다크(`colorScheme` 에뮬레이션, 앱은 `prefers-color-scheme`) · locale ko-KR · timezone Asia/Seoul · `reducedMotion=reduce` · 글꼴: 시스템 글꼴 `networkidle`+700ms 대기 후 측정(웹폰트 별도 로딩 없음 `[추측]`) · 고정 응답(가로채기) 상태 전수 + 실데이터 대조(실제 서버 응답, 브라우저발 쓰기는 200 빈 응답으로 막음) · 캡처는 390 폭 몇 장만(`/tmp/qa-artifacts/TheKaiwa/qa-p2a/`, 판정 직후 삭제) · 허용 범위: 가로 넘침 0px·터치 <44px 0(히트 영역 포함)·엔진명 0 은 예외 없음, 대비는 수치로 기록(Reviewer 판단).
- 데모 게이트: 이 task 는 BLOCKED 상태를 알고 진행(Leader 결정) — 승인 데모 버전과의 픽셀 대조는 하지 않았다(`NOT_VERIFIED`, 데모 승인 기록 없음).

## 배포 기록
<!-- Phase 2 일괄 배포 때 deployer 가 RELEASE_RESULT 근거로 기록. -->

## 최종 요약

## Leader 기록 (Phase 2 일괄 접수·결정, 2026-10-06 22:45)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev): risk=R1 · developer=opus · track=standard · demo=full(JV-ui_change) · 결과 JSON `/tmp/judge-task-043-intake.result.json`. **Leader 위험 보정**: R1 유지
- **데모 승인 생략 지시**: 사용자(2026-10-06) "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". 승인용 데모는 만들지 않고 designer 가 **구현 가이드**를 낸다. `check.mjs waive` 는 이 문장을 인식하지 못해(정규식: "데모" 바로 뒤 생략/없이) **정식 waive 기록은 없다** — 훅은 warn 단계라 막지 않는다.
- **`## Leader 확인 필요` 처리(Leader 결정)**: ① **스키마는 WP-DB0 단일 작성자**(`task-p2-db0-schema`) — 설계서 §11-1·§11-2 의 "T1 이 D1·D2, T2 가 D4·D5 를 쓴다" 문구는 이 결정으로 대체 ② **`src/types/plan.ts`·`src/types/lesson.ts` 와 plan/calendar·plan/day·lessons/today 라우트의 additive 변경(`challenge?`·`reason: 'CHALLENGE'`)은 T1 소유**(타입만 늘리는 변경 — T3·T4 는 소비만) ③ **`topics/pool.ts` 는 T2 가 만들되 base(B1 풀·`lessonExprCount`)를 가장 먼저 로컬로 내놓고, T1 의 `topicProgress` 는 그 뒤에 한다**(T1 의 다른 부분은 선행 가능) ④ PE 산출 파일 구성: 현재 PE 는 스키마를 `prompts/topicWords.ts` 안에 둔다 — 설계서의 `structuredResponse/topicWordsSchemas.ts` 분리와 다르지만 `schemas.ts`·`checks.ts`(task-039 구역)를 피하는 목적은 같아 **PE 구성을 따른다** ⑤ A12 레인은 **interactive**(사용자가 기다리는 호출 — 설계서 v2.3 따름, 계획서 batch 문구는 정정) ⑥ `components/lesson/LessonScreen.tsx`·`LessonEnd.tsx` 의 #62 `challenge?` 토스트는 **T4 소유**(010d-B 가 같은 `LessonEnd.tsx` 를 나중에 만진다 — T4 커밋 뒤) ⑦ QA 계정 3 은 T1→T2→T4(→T3) 순으로 **직렬**(같은 계정에 챌린지 행 1개만 가능).

## Leader 확인 필요
설계서·계획서·지시문이 서로 어긋나거나 비어 있어 이력서 작성자가 정하지 않은 항목이다.

1. **`src/types/plan.ts` 소유.** 설계서 §11-2 는 T3 소유로 적었지만, #70·#71 응답에 `challenge?`(`days[].challenge`·`summary.challenge`·`day.challenge`)를 더하는 쪽은 [[task-041-challenge-core]] 라 두 task 가 같은 타입 파일을 만진다(`CalendarDay`·`CalendarSummary`·`DayResponse` 가 이 파일에 있음). T1 이 additive 타입 줄을 먼저 쓰고 T3 가 그 뒤에 쓰는지, 반대인지 정해 주세요.
2. **고정 응답(데이터 고정) 주입 방식.** 계획서 §6 은 "T3/T4 화면(데이터 고정)"이라고만 적었다. 끝난·그만둔·소급 달성·두 세트 날 같은 상태는 라이브로 만들기 어려워 고정 응답이 필요한데, 모의 응답 계층을 두는지 테스트 계정에 시드 행을 넣는지 정해진 바가 없다. QA 가 쓸 방식을 정해 주세요.
3. **하위 화면의 하단 탭 숨김 규칙.** `components/shell/routes.ts` 의 `FOCUS_ROUTE_PREFIXES` 는 하단 탭과 권장 업데이트 띠를 **함께** 숨기는 "집중 화면" 목록이다. 챌린지 하위 화면(`/plan/challenge/*`)을 이 목록에 넣으면 업데이트 띠도 숨는다. 설계서는 "최종안은 designer" 라고만 해서 이 부수효과를 designer 가이드에서 정할지 확인이 필요하다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 10-06 22:11 |
| - | 생략 | - | - | "데모 생략하고 진행해줘" | 10-06 23:43 |

## Leader 결정 (designer 가이드 결정 항목 확정, 2026-10-06 23:20)

- **API 필드 2건**: ⓐ "오늘 새 단어 n장 남음"(§13-5 49)은 **이번 범위에서 그리지 않는다**(원천 없음 — #158 에 칸을 더하지 않음, 2단계 후보). ⓑ 하루 시트의 "단어를 4/8장만 풀었어요"는 **T1 이 #71 `challenge.words` 에 `need`(= `dailyGoal.wordsMinAnswered`) 한 칸을 additive 로 더한다**(dev-041b 에 전달) — 같은 챌린지가 아닌 날은 designer 가이드대로 장수 없이 "목표에 못 미쳤어요".
- **고정 응답 주입**: designer **권고안**(Playwright 테스트 스크립트의 API 응답 가로채기 — 기존 테스트에 선례, 앱 코드에 테스트 훅 없음)으로 확정. 개발 전용 쿼리 방식은 쓰지 않는다(운영 빌드 혼입 위험).
- **`planReturn.ts`(챌린지 상세 ↔ 원 화면 복귀)** 는 하지 않는다(선택 사항 — 기능 손실 없음).
- 출처 문구는 설계서 v2.3("「카페 주문」 새 단어 10장")을 따르고 데모의 "오늘 처음 보는…" 문구는 쓰지 않는다. `LessonEnd.tsx` 는 Leader 결정 ⑥ 대로 T4 소유(이력서 "수정 금지" 표기는 이 결정으로 대체).

## Leader 결정 (데모 게이트 BLOCKED 처리, 2026-10-07 00:10)

REV-122 가 `check.mjs check` = `DEMO_GATE_BLOCKED`(정식 `waived` 기록 없음)를 FAIL 로 보고했다. **Leader 결정: BLOCKED 상태를 알고 진행한다.** 근거 — 사용자 지시 "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"(훅이 기록한 `.claude/state/demo-gate/prompts.jsonl` 에 원문 확인됨, 에이전트가 승인·waive 를 대신 만든 흔적 없음)가 **승인 생략의 명시적 사용자 지시**이고, `check.mjs waive` 는 문장에서 "데모" 바로 뒤에 "생략/없이" 가 이어져야 한다는 정규식 때문에 이 문장을 인식하지 못했을 뿐이다. 편집 훅은 warn 단계라 구현을 막지 않는다. **사용자가 "데모 생략하고 진행해줘" 한 번 입력하면 정식 `waived` 로 기록**하고, 최종 보고에 이 상태를 적는다. (같은 결정이 task-044·012b-2·012b-4·010d 에도 적용된다.)

## Leader 기록 (2026-10-07, REV-127·129 이후)

- **리뷰 결과**: REV-127 PASS_WITH_NOTES → dev-043c 보완 → REV-129 PASS (Critical0·High0·Medium0·Low0·Info5). Reviewer 재순환 완료, 코드 변경 루프 종료.
- **judge C2**: `codex_required=false`(`wanted_before_budget=true`, 규칙 `CX-limit-unknown-hold` — 한도 미확인이라 R2 만 Codex 호출). 입력·결과 `scratchpad/c2-043.*`. Codex 외부 검토 없이 QA 로 진행.
- **dev-043c 의 지시 밖 변경**(오늘 칸 읽기 이름 ", 오늘")은 REV-127 L-1 "고칠 방법"에 포함돼 있어 수용(REV-129).
- **커밋 순서**: `src/components/challenge/` 는 untracked 이고 T4(task-044) 파일 3개가 `parts.tsx`(PartialMark)를 import 한다 → **T3 와 T4 는 한 커밋으로 묶는다**(Leader 가 pathspec 으로).
- **designer 후보(wave 끝 일괄)**: 오늘 MET 날 오늘 칸 표시가 테두리뿐이고 범례에 "오늘" 설명 없음(REV-129 I-1) · 날짜 띠 범례 상태 기준 문구.
- **후속(선택)**: 포트 가드 `endsWith(':3010')` 가 `03010` 입력을 통과 → `Number(port) === 3010` 비교로 바꾸면 `task043-screens.ts`·`task044-screens.ts`·`challenge-smoke.ts` 가 한 번에 정리된다(Leader 가 QA 전에 묶어서 처리할지 판단).
- **다음**: QA(T3/T4 화면 + 실데이터 대조 — LLM 슬롯 직렬, QA 계정 3 생성 필요).

### 2026-10-07 developer (task-p2-ui-polish2)

judge 접수: local_fix · complexity 0.85 · R1 · developer_model=sonnet · **track=light**(QA·데모 면제). 데모 게이트 `waived`(task-043) 확인. 수정 범위 = qa-p2a 미해결 화면 결함 2건, 스타일 클래스만(동작·계약·문구 변경 없음).

- [10:2x] **결함 A (qa-p2a #3, 라벨 대비)** — 원인: `BLOCKED_DIM`(`aria-disabled:opacity-40`)·`ctaClass(busy)` 의 `opacity-70` 이 버튼 전체(글자+면)에 걸려 라벨이 면과 함께 옅어짐. 처방: `opacity` 를 전부 걷고 `aria-disabled:` 한정 면 클래스로 교체. 공용 `Btn`·`BtnRow` 는 건드리지 않음.
  - `src/components/challenge/parts.tsx`: `BLOCKED_DIM` 삭제 → `BLOCKED_FACE = 'aria-disabled:border aria-disabled:border-dashed aria-disabled:border-ink3 aria-disabled:bg-surface2 aria-disabled:text-ink2'`(막힘 = 회색 면 + 점선 테두리 + `ink2` 글자) · 신규 `BUSY_FACE = 'aria-disabled:border aria-disabled:border-accent aria-disabled:bg-accent-soft aria-disabled:text-ink'`(보내는 중 = 옅은 강조 면 + 강조 테두리 + 기본 글자색, 스피너·"시작하는 중…" 그대로) · `ctaClass(busy)` = `w-full ${busy ? BUSY_FACE : BLOCKED_FACE}`.
  - `ChallengeSheets.tsx:162`(끝내기 시트 ghost [계속]) · `createParts.tsx:179`(장수 칩): `BLOCKED_DIM` → `BLOCKED_FACE` 치환만(2곳). 칩은 선택 상태가 `aria-checked`+accent 2px 안쪽 링(`on`)이고 막힘 칩은 `on` 이 될 수 없어(`on = 선택 && !disabled`) 면 클래스가 선택 모양과 겹치지 않는다. 막힘 칩은 점선 테두리(`ink3`)가 더해져 "고를 수 없는 칸"이 모양으로도 구분됨. 별도 상수 분리는 불필요(같은 면이 자연스럽다).
  - 사용처 3곳 전수 확인: `parts.tsx`(`ctaClass` → `ChallengeCreateScreen.tsx:277` 단일 호출) · `ChallengeSheets.tsx:162` · `createParts.tsx:179`. `src/components/challenge` 안 다른 `opacity-N` 0건(grep).
  - **Tailwind 컴파일 실측**(미러에서 `@tailwindcss/postcss` 로 `globals.css` 컴파일, 브라우저 아님): `.aria-disabled\:bg-surface2[aria-disabled="true"]` 등은 속성 선택자가 붙어 (0,2,0) 이라 `.bg-accent`(0,1,0)·`.bg-surface` 보다 우선 — 클래스 순서와 무관. `aria-disabled:border` 의 `border-style: var(--tw-border-style)` 는 같은 요소의 `aria-disabled:border-dashed` 가 `dashed` 로 정하고, 보내는 중 면은 초기값 solid.
  - **대비 표**(WCAG 상대 휘도, `globals.css` 토큰 실제 색값을 스크립트로 파싱·계산; 불투명도는 그룹 합성 = 글자·면 모두 `α·원색 + (1-α)·뒷면`. 뒷면: 만들기 푸터·시트 = `surface`, 칩 = `ground`)

    | 상태 · 변형 | 라이트 전 | 라이트 후 | 다크 전 | 다크 후 |
    |---|---|---|---|---|
    | 막힘 · primary(다음/시작) | 1.80 (on-accent/accent, α.40) | **5.44** (ink2/surface2) | 2.03 | **6.77** |
    | 보내는 중 · primary | 2.95 (α.70) | **13.45** (ink/accent-soft) | 3.64 | **12.47** |
    | 막힘 · ghost(계속) | 2.41 (ink/surface, α.40) | **5.44** (ink2/surface2) | 3.39 | **6.77** |
    | 막힘 · 칩(ink2/surface2) | 1.73~1.75 (α.40) | **5.44** | 2.23~2.28 | **6.77** |
    | (참고) 활성 primary on-accent/accent | 4.80 | 4.80 | 6.17 | 6.17 |
    | (참고) 활성 ghost ink/surface | 15.81 | 15.81 | 13.77 | 13.77 |

    ※ QA 가 적은 1.39:1(막힘)·1.92:1(보내는 중)은 글자 색에 불투명도를 한 번 더 곱해 잰 값이라(라벨 `α·흰색+(1-α)·accent` 대 면 — 제 재계산으로 1.38·1.90 재현) 합성 모델에 따라 전 값이 다르다. **어느 모델이든 3:1 미만이라 결함은 실재하고, 후 값은 `opacity` 가 없어 모델 차이가 생기지 않는다**(글자·면이 각자 토큰 그대로).
    비문자 경계(참고, 비활성 컨트롤은 WCAG 1.4.11 면제): 막힘 면 `surface2` 대 `surface` 1.13~1.15, 점선 `ink3` 대 `surface2` 라이트 2.73·다크 3.79, 보내는 중 `accent` 테두리 대 `accent-soft` 4.08/4.72.
- [10:3x] **결함 B (qa-p2a 044 #2, 360px 줄바꿈)** — `src/components/vocab/TopicSetStart.tsx` `BtnRow` 3곳(busy409 포기·오류·비어 있음)의 버튼·링크 4개(`다시 시도` 2, `내 단어장으로 풀기`, `오늘로`)와 `skipBtn` 의 두 모양(`mt-6 w-full break-keep` / `break-keep`)에 호출 쪽 `className` 으로 `break-keep`(`word-break: keep-all`) 추가. `leading`·크기 변경 없음.
  - 360px 해소 근거 **[추측 — 라이브 미측정(QA 몫), 산술 추정]**: 반폭 버튼 글자 영역 = 360 − 32(페이지 px-4) − 28(Card p-3.5) − 8(gap) = 292 → /2 = 146 → − 32(버튼 px-4) = **114px**. QA 가 390(영역 129px)에서 한 줄·360(114px)에서 끊김이라 했으므로 라벨 폭 W 는 114 < W ≤ 129. 어절 비율(`내 단어장으로` 6음절+공백 ≈ 0.73W ≤ 95px < 114)로 1행 = "내 단어장으로", 2행 = "풀기". 높이 15px × 줄간격 1.5 × 2행 = 45px ≤ 버튼 48px(Link 는 테두리 1px 로 46px) 안에 든다. 오류·포기 행의 "주제 표현으로 바로 풀기"(영역 128px)도 "주제 표현으로 / 바로 풀기" 로 어절 경계에서 끊김.
- **시험**: `src/components/challenge/__tests__/marks.test.ts` 기존 흐림 시험 갱신(`BLOCKED_DIM`·`opacity-40/70` 문자열 단정 → `BLOCKED_FACE`/`BUSY_FACE`) + 신규 2건(① 면 클래스 opacity 0건·전부 `aria-disabled:` 한정·토큰만·`src/components/challenge` 전 파일 `opacity-N` 0건 ② 면 클래스가 가리키는 `bg-*`/`text-*` 토큰을 `globals.css` 에서 읽어 라이트·다크 대비 ≥ 3 단정). 신규 `src/components/vocab/__tests__/topicSetStartLayout.test.ts` 2건(BtnRow 3곳·태그 4개 전부 `break-keep`, skipBtn 두 분기 모두 `break-keep`).

#### 실행 증빙 (미러 `~/.node-local/thekaiwa-ui2`, `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`, 라이브·dev 서버·브라우저·build 미실행)
| 명령 | 결과 |
|---|---|
| `node --import tsx --test` `src/components/challenge`+`vocab` `*.test.ts` | **103 / 103 PASS** (fail 0) |
| `node --import tsx --test` `src/components`+`src/types` 전체 | **675 / 675 PASS** (fail 0) — 직전 기록 671 + marks 신규 2 + `topicSetStartLayout` 신규 2 (marks 기존 1건은 갱신) |
| `tsc --noEmit` | exit 0 |
| `eslint --max-warnings=0` `src/components/challenge` `src/components/vocab` | exit 0 |
| 변이 M1 `BLOCKED_FACE` 에 `aria-disabled:opacity-40` 되돌림 | 시험 5 FAIL(검출) |
| 변이 M2 busy 를 `opacity-70` 으로 되돌림 | 시험 4·5 FAIL(검출) |
| 변이 M3 막힘 글자를 `text-ink3` 로(대비 2.73) | 시험 4·6 FAIL(검출) |
| 변이 M4 `ChallengeSheets.tsx` 에 `aria-disabled:opacity-40` 재추가 | 시험 5 FAIL(검출) |
| 변이 M5 `내 단어장으로 풀기` 버튼에서 `break-keep` 제거 | `topicSetStartLayout` 1 FAIL(검출) |
| 변이 M6 skipBtn 반폭 분기에서 `break-keep` 제거 | `topicSetStartLayout` 2 FAIL(검출) |
변이는 전부 미러 사본에서만 하고 NFS 원본으로 복원·재동기화했다(복원 후 marks 6/6·layout 2/2 PASS, `diff -rq` 차이 0).

- **체크포인트**: 완료 = 결함 A·B 처방 + 시험(위) · 남은 일 = 없음(Reviewer 재감사 → 라이브 360/390/412 대조는 QA/Leader 몫) · 다음 첫 행동 = Reviewer 가 `git diff -- src/components/challenge src/components/vocab` 와 위 증빙 재실행 · 주의점 = 대비 "전" 값은 합성 모델에 따라 QA 값(1.39/1.92)과 다름(위 ※), 점선·강조 테두리는 designer 확인 후보(시각 의미는 유지하되 모양 변화 — 디자인 판단은 designer) · 미커밋 파일 = `src/components/challenge/{parts.tsx,ChallengeSheets.tsx,createParts.tsx,__tests__/marks.test.ts}`, `src/components/vocab/{TopicSetStart.tsx,__tests__/topicSetStartLayout.test.ts}`, 이 task 파일, `20-Log/2026-10-07.md`.
- **범위 초과 징후**: 없음(파일 6개·마이그레이션·네이티브·인증·신규 화면 없음).

## Reviewer 기록 (REV-145)

> task-p2-ui-polish2(light·R1·sonnet) 좁은 감사 — 미커밋 작업 트리 `git diff -- src` 5개 + 새 시험 1개. Read 전용(소스 무수정), 변이는 scratchpad `rev145/m` 사본에서만. 미러 `~/.node-local/thekaiwa-ui2` 는 작업 트리와 `diff -rq` 차이 0 확인 후 사용.

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2 · Info 3. native_change=false. light 범위 안(소스 5 + 시험 1 = 6파일 ≤ 12, 마이그레이션·네이티브·인증·신규 화면 없음) → "light 승격 필요" 아님. 데모 게이트 `check.mjs check --task task-043` = `DEMO_GATE_PASSED`(status waived, 사용자 원문 인용 — light 라 승인본 대조 없음).

### 재실행 숫자 (미러, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`, 라이브·dev 서버·build 미실행)
| 명령 | 결과 |
|---|---|
| `node --import tsx --test` challenge+vocab `*.test.ts` | **103 / 103 PASS** (fail 0) — dev 기록과 일치 |
| 같은 방식 `src/components`+`src/types` 전체 | **675 / 675 PASS** (fail 0) — 일치 |
| `tsc --noEmit` | exit 0 |
| 변경 6파일 `eslint --max-warnings=0` | exit 0 |

### 1. 범위·금지 요소 [확인(git diff 직접 읽기)]
- `git status -- src/modules prisma src/components/common .env .env.example` 출력 0줄 → 무변경. 변경 = `challenge/{parts,createParts,ChallengeSheets}.tsx`·`vocab/TopicSetStart.tsx`·`challenge/__tests__/marks.test.ts` + 신규 `vocab/__tests__/topicSetStartLayout.test.ts`. `ChallengeCreateScreen.tsx` 는 diff 0(속성 `aria-disabled`·`aria-busy`·`onClick` 그대로).
- 소스 변경은 className 문자열·import 이름뿐 — 핸들러·props·문구·API 계약 변경 0. 보이지 않는 문자(U+2028/2029/200B~200F/202A~202E/2060~2064/FEFF) grep 0건 · raw hex grep 0건 · 엔진명(reazon·whisper·style-bert·claude·model_id·speaker_id) 0건.
- `BLOCKED_DIM` 은 코드·시험에 0건(grep). 남은 곳은 `agent-vault` 의 과거 이력 문장뿐(역사 기록, 수정 대상 아님).

### 2. 대비 재계산 [확인(독립 스크립트 `rev145/contrast.mjs` — `globals.css` 라이트 `:root`·다크 `@media` 블록을 직접 파싱, sRGB 임계 0.04045)]
| 상태 · 라벨 | 라이트 | 다크 | dev 표 |
|---|---|---|---|
| 막힘 primary·ghost·칩 — `ink2`(#5a6359) on `surface2`(#eef0ea) | **5.44** | **6.77** | 5.44 / 6.77 일치 |
| 보내는 중 primary — `ink`(#1e2420) on `accent-soft`(#fbe9e3) | **13.45** | **12.47** | 13.45 / 12.47 일치 |
| (참고) 활성 primary `on-accent` on `accent` | 4.80 | 6.17 | 일치 |
| (참고) 활성 ghost `ink` on `surface` | 15.81 | 13.77 | 일치 |
| (경계, 비문자) 점선 `ink3` vs `surface2` | 2.73 | 3.79 | 일치 — 라이트 3 미만이나 비활성 컨트롤은 WCAG 1.4.11 면제, 라벨 대비는 별개 |
- 사용 토큰 6종(`surface2`·`ink`·`ink2`·`ink3`·`accent`·`accent-soft`) 전부 `globals.css` `@theme inline` 에 `--color-*` 로 존재. 컴파일 출력에도 `.aria-disabled\:bg-surface2` 등이 생성돼 조용히 무효가 되는 클래스 없음.
- **우선순위 [확인(컴파일 실측)]**: 미러 `@tailwindcss/postcss` 로 실제 소스 5파일(`@source`)만 컴파일(`rev145/compile.mjs`, 브라우저·dev·build 아님). 결과 `.aria-disabled\:bg-surface2[aria-disabled="true"]{background-color:var(--surface2)}` 등 8규칙이 모두 `@layer utilities` 안 — 속성 선택자 덕에 명시도 (0,2,0), `.bg-accent`·`.bg-surface`·`.border-line`·`.text-on-accent`(0,1,0)보다 우선(같은 레이어라 순서 무관). `aria-disabled:border-dashed` 는 `--tw-border-style: dashed` 를 같은 요소에 정해 `aria-disabled:border` 의 `border-style: var(--tw-border-style)` 와 합쳐져 dashed, 보내는 중 면은 초기값 solid. React 가 `aria-disabled` 를 `true|undefined` 로만 내려(`|| undefined` 3곳 전부) `[aria-disabled="true"]` 가 정확히 맞는다. 스피너는 `border-current` 라 `text-ink` 를 따라 옅은 면 위에서도 보임.

### 3·4. 사용처 3곳·`busy` 접근성 [확인(grep+코드 읽기)]
- `ctaClass` 사용처 = `ChallengeCreateScreen.tsx:277` 단일(그 외 `__tests__` 뿐). `ctaClass(busy)` 는 한쪽 상수만 실어 두 면이 겹치지 않음 — busy 이면 `aria-disabled` 가 항상 켜지므로(`!!block||busy||undefined`) BUSY 면이 실제로 적용됨.
- 칩 `createParts.tsx:179`: `on = o.value===value && !o.disabled` 라 막힘 칩은 `aria-checked=false`·accent 링 없음(= 선택됨+막힘 동시 상태가 구조적으로 없음, 기존 로직 그대로). 선택(링)·활성(`border-line bg-surface`)·막힘(회색 면+점선) 세 모양이 서로 다르고, 선택 색은 `aria-disabled:` 한정 클래스에 덮이지 않는다. 칩은 원래 `border` 라 폭 변화 없음(`border-dashed` 는 스타일만).
- 끝내기 시트 ghost: `border border-line` 위에 `aria-disabled:border-ink3`(0,2,0)가 색만 덮음, 폭 1px 그대로. 다크는 토큰(`:root` 미디어 재정의)을 그대로 따라 별도 분기 없음.
- `aria-disabled`·`aria-busy`·클릭 차단(`!busy && …`·`onNext` 조기 반환)·`aria-describedby` 전부 diff 0.

### 5. 결함 B `break-keep` [확인(코드)+손계산(추측 일부)]
- `Btn`·`BtnRow` 읽기: `Btn` 은 `inline-flex … rounded-xl font-semibold h-12 px-4`, `whitespace-nowrap`·`truncate`·`overflow-hidden` 없음. `BtnRow` = `flex gap-2 [&>*]:min-w-0 [&>*]:flex-1`. `.break-keep{word-break:keep-all}` 컴파일 확인. 호출 쪽 className 만 추가 — 공용 무수정.
- 붙은 곳: `BtnRow` 3곳의 `Btn`/`Link` 4개(`다시 시도` 2·`내 단어장으로 풀기`·`오늘로` Link) + `skipBtn` 두 모양(`mt-6 w-full break-keep` / `break-keep`) — 이 파일의 `<Btn`·`<Link`·`skipBtn(` 전수 grep 결과와 일치. BtnRow 밖 `<Link … mt-1 flex h-11 …>`(오늘로, 한 어절)는 끊길 곳이 없어 불필요.
- **가로 넘침 위험**: `keep-all` 이면 한 어절이 칸보다 넓을 때 줄바꿈 대신 넘친다. 최장 어절 = `단어장으로`(5음절)·`표현으로`(4음절). 15px 세미볼드 한글 1음절 ≈ 15px → 75px·60px. 가장 좁은 칸 = Card 안 반폭 버튼(`내 단어장으로 풀기`): 360 − 32(페이지 px-4) − 30(Card `p-3.5` + 테두리 2px; dev 는 28 로 적음) − 8(gap) = 290 → /2 = 145 → − 32(px-4) = **113px** > 75px. Card 밖 상태(busy409·error)는 128px. 360px 에서 넘침 없음, 여유 38px [가능성 높음 — 폰트 실측 아님].

### 6. 변이 재현 7건 (`rev145/m` 사본, 2파일 시험 8건 기준선 8/8 PASS)
| # | 변이 | 결과 |
|---|---|---|
| R1 | `BLOCKED_FACE` 에 `aria-disabled:opacity-40` 재삽입 | 검출(opacity 시험 FAIL) |
| R2 | `BLOCKED_FACE` 글자 `ink2`→`ink3`(대비 2.73) | 검출(2건 FAIL — 면 구분·대비 3:1) |
| R3 | 오류 상태 `다시 시도` Btn 의 `break-keep` 제거 | 검출 |
| R4 | 칩 `${BLOCKED_FACE}` 제거 | 검출 |
| R5 | 끝내기 시트 ghost 의 `BLOCKED_FACE` 제거 | **미검출 — challenge+vocab 103건 전체에서도 PASS**(아래 L-1) |
| R6 | `ctaClass(true)` 가 BLOCKED 사용 | 검출 |
| R7 | `skipBtn` 전폭 모양 `break-keep` 제거 | 검출 |
사본은 미러에서 복사해 원복했고 `diff -rq` 차이 0. 시험 품질: 대비 시험은 `globals.css` 를 읽어 라이트·다크 값으로 계산해 면 클래스가 가리키는 토큰이 없거나 색이 바뀌면 잡는 의미 있는 가드다. 정규식 시험(`<(?:Btn|Link)\b[^>]*>`)은 `className` 이 화살표 함수(`=>`) 뒤에 오면 `>` 에서 잘려 놓칠 수 있으나 현재 코드는 className 이 앞이라 유효(Info).

### 지적 표 (REV-145)
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L-1 | LOW | `ChallengeSheets.tsx:162` ↔ `marks.test.ts` | 끝내기 시트 [계속] 의 `BLOCKED_FACE` 부착이 어떤 시험에도 걸려 있지 않다(R5 103/103 통과). `opacity` 전수 시험은 있으나 "면 클래스가 붙어 있음" 가드는 `ctaClass`·칩만. 이 변경이 새로 만든 틈은 아니고(이전 `BLOCKED_DIM` 도 같은 곳이 미가드, 이 이력서 앞쪽 변이 표에도 칩만 기재) 회귀 시 라벨이 막힘 때 구분 없이 남는 정도 | `EndChallengeSheet` 렌더 시험 1건 또는 `ChallengeSheets.tsx` 소스에서 `BLOCKED_FACE` 가 `keepGoing` 버튼에 걸렸는지 정규식 1건(차단 아님, 다음 polish 때) |
| L-2 | LOW [추측] | `TopicSetStart.tsx` BtnRow·skipBtn | `keep-all` 은 어절 안에서 못 끊어서, 기기 글자 크기를 크게 쓰면(5음절 어절 75px × 배율 ≥ ~1.5 → ≥113px) 반폭 버튼 라벨이 칸을 넘칠 수 있다. 이전(어절 중간 줄바꿈)은 넘치지 않고 흡수. 360px 기본 글자에선 위 계산대로 여유 38px | QA 실기기에서 글자 크기 "큼" 설정으로 `내 단어장으로 풀기`·`주제 표현으로 바로 풀기` 육안 1회 |
| I-1 | INFO | 설계 | 막힘 모양이 "전체 흐림" → "회색 면+점선 테두리"로, 보내는 중 primary 가 "진한 강조 면" → "옅은 강조 면+강조 테두리"로 바뀌었다(대비 3:1↑ 충족, 동작·문구 불변). 위계·톤 판단이라 reviewer 는 결함 처리하지 않음 — developer 도 designer 확인 후보로 적음 | Leader 가 designer 에게 시각 확인 요청 여부 결정 |
| I-2 | INFO | 기록 | dev 의 반폭 칸 산술은 Card 테두리 2px 를 빼먹어 114px(실제 113px)이고, busy409·error 상태는 Card 밖이라 128px — 결론(넘침 없음) 불변 | — |
| I-3 | INFO | 대비 | 점선 `ink3`/`surface2` 라이트 2.73(<3). 비활성 컨트롤이라 1.4.11 면제이고 라벨 대비와 무관. 막힘 인지는 면 색 + 점선 + `aria-describedby` 이유 문장으로 중복 확보 | — |

### high_risk_areas (light 트랙이라 QA 없음 — Leader 가 실기기·사후 확인에 쓸 목록)
1. **실기기(S25+ 라이트·다크) 육안 대비**: 막힘 [다음]·15장 칩·[계속], 보내는 중 [챌린지 시작] 라벨이 또렷한지, 점선·옅은 강조 면이 "눌러도 되는 버튼"처럼 보이지 않는지(클릭하면 이유 안내가 뜨는 것은 그대로).
2. **360px 줄바꿈**: `/study/today/words/new` 대기 화면 비어 있음 상태 `내 단어장으로 풀기`가 `내 단어장으로 / 풀기` 로 어절 경계에서 끊기는지, 오류·busy409 의 `주제 표현으로 바로 풀기`.
3. **글자 크기 큼 + 다크 모드** 조합에서 반폭 버튼 가로 넘침·세로(h-12 고정, 2행) 잘림.
4. 위 변경은 클래스뿐이라 인증·권한·집계·LLM·스냅샷·ConfigurationVersion 영역 영향 0 [확인].

### Leader 확인
- I-1(막힘·보내는 중 시각 언어 변경)을 designer 에 확인할지 — 결함 아님, 판단 요청.
- L-1 은 이번 task 에서 막지 않고 다음 챌린지 polish 에 포함해도 무방(회귀 가드 틈, 동작 영향 없음).
- 배포 시 웹 변경만(네이티브 변경 없음, `versionCode` 증가 불필요).
