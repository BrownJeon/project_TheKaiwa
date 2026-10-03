---
task_id: task-010d
title: "상황 역할극 — Scenario·ScenarioTopic·주제→상황 선택·역할극 목표/종료 판정·레슨 말하기 연결"
status: doing
base_ref: 98d8cac
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, codex, qa, deployer]
related_tasks: [task-010-today-lesson, task-010b-repetition, task-010c-correction-mode, task-007-talk-voice-web]
tags:
  - type/task
  - domain/scenario
  - domain/talk
  - domain/prompt
  - domain/ui
  - domain/db
aliases:
  - 상황 역할극
  - 역할극
  - task-010d
created: 2026-09-28
updated: 2026-10-01
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-010d-scenario-roleplay-v1.html"
  artifact_url: "https://claude.ai/artifact/VbLHUXXbMnM4R4ZAv7vxgj"
  content_sha256: "473c0e0c983e34243acd33707ccc37fa84914960035a679cf6ac2242d6590a4d"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-01T08:17:27+09:00"
  approval_quote: "대기 중인 데모 전부 권고안대로 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
주제 아래 **상황**(예: 카페 주문 → "사이즈·온도 바꿔 주문하기", "포장으로 바꾸기") 단위 역할극을 연다. 상황마다 역할(학습자·선생님)·의사소통 목표·성공 조건·핵심 표현이 있고, 선생님은 역할을 연기하며 코치 모드로 교정한다. 역할극이 끝나면 목표 달성·사용 표현·다음 상황 예고를 보여 주고, 반복 학습(`RepetitionItem(SCENARIO)`)과 관측(`SCENARIO_COMPLETED`)에 남긴다. 레슨 5단계의 "말하기"에서 이 상황 역할극으로 이어 갈 수 있다.

완료 기준(design-spec §7-3 3차 보완 · §15 010d · learning-personalization §1·§1-6 · domain-model §9-1):
- 스키마(사용자 승인 후 push): `Scenario`·`ScenarioTopic` + `Lesson.scenarioId?`·`Chat.scenarioId?`·`Chat.lessonId?`(SetNull)
- 시드: 주제 5 × 상황 2 = **10개**(N5~N4, `isSeed`), 안정 id upsert(`prisma/seed-topics.ts` 패턴 재사용)
- API: `GET /api/v1/scenarios?topicId=&level=&recommended=1` · `GET /api/v1/scenarios/:id` · `POST /api/v1/chats {kind:'TALK', scenarioId, lessonId?}` · #58 `recommendedScenarios[]`(정합 #2)
- A1 역할극 모드: `[모드] TALK` + `[상황]` 헤더(역할·목표·핵심 표현 ≤ 예산) + 코치 교정(010c `hintKo`) + 종료 판정 `learning.scenario{goalAchieved, usedExpressionIds[], missedExpressionIds[], communicationSuccess}`(additive, 종료 턴만) — A1 ≤3,000자·12s 유지(종료 판정 턴만 20s 허용 검토는 PE 실측 후 Leader 결정)
- 종료: 학습자 [역할극 마치기] 또는 강사 `endOfTopic` → 결과 카드(목표 달성·쓴 표현·다음 상황 예고) → `StudyLog(TALK, DIRECT, result.scenario…)`·`RepetitionItem(SCENARIO)` upsert·`LearningObservation(SCENARIO_COMPLETED)` 한 트랜잭션
- 오늘 탭 "주제 → 상황" 2단 선택 + "바로 상황 고르기", 레슨 종료 카드·말하기 단계에서 "이 상황으로 역할극"
- 3폭 잘림 0, 엔진명 0, 타 사용자 404, 회화 TTFA·5초 지표 회귀 없음

## 사용자 결정·지시
- D1(2026-09-28 AskUserQuestion): "Phase 2 후반 별도 작업" → 이 task. 질문에 "포함하면 DB에 상황 테이블이 추가됩니다"를 명시했음.
- 2026-09-28: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘".
- **스키마 push 는 사용자 승인 후**(010b·010c 와 한 번에 요청). 구현 순서는 010b·010c 뒤(관측 테이블·코치 모드 재사용).

## 관련 과거 이력 요약
- [[task-010-today-lesson]]: 레슨 말하기 3과제(상황 없이)·종료 카드 "이어서 말하기"(`POST /chats {kind:'TALK',topicId}`)·주제 시드 안정 id(`seed-topics.ts`)·A4 신뢰도 교훈. [[task-010c-correction-mode]]: 코치 모드 `hintKo`·자기수정 관측. [[task-010b-repetition]]: `LearningObservation`·`registerRepetitionItems`. [[task-007-talk-voice-web]]: 회화방·예열 CLI·첫 문장 조기 합성(A1 `talk@v2` 키 순서 — 역할극 헤더를 넣어도 `--system-prompt` 안정성 유지할 것: 상황 헤더는 stdin 쪽).

## Leader's Plan (2026-09-28)
- **L1 시드 설계(PE+designer 협의, PE 소유)**: 상황 10개 각각 `roles{learner,tutor}`·`goal{communicativeGoal_ko, successCriteria[2~3]}`·`keyExpressions`(가능하면 `TopicChunk` 참조 3~5개)·`completionRule{requiredExpressions, tutorJudgement:true}`·난이도 1~5. `prisma/seed-data/scenarios.json` 단일 출처.
- **L2 종료 판정**: 강사가 `learning.scenario` 로 제안 → 코드가 `usedExpressionIds ⊆ keyExpressions`(보정 패턴), `goalAchieved` 는 강사 판단 + 코드 규칙(필수 표현 수 충족) 둘 다 표시. 학습자에게는 "선생님 판단"으로 보여 주고 채택 개념 없음(직접 행위 = 역할극 마치기 → DIRECT 기록).
- **L3 레슨 연결**: 레슨 종료 카드 [이 주제로 이어서 말하기] 옆에 추천 상황 1개 [상황 역할극]. 레슨의 `speaking` 은 그대로 두고, 역할극은 별도 대화(`Chat.lessonId`)로 연결.
- **L4 화면(데모 full)**: 주제 시트에 상황 목록(목표 한 줄·난이도·한 적 있음), "바로 상황 고르기" 목록, 역할극 회화방 상단 목표·역할 카드(접기), 진행 중 표현 체크(쓴 표현 ✓), [역할극 마치기] 확인, 결과 카드(목표 달성/아직·쓴/못 쓴 표현·다음 상황 예고·다시 하기), 코치 힌트 카드(010c 재사용).
- 파일 경계: PE `conversation/prompts/talk.ts`(역할극 헤더·종료 판정)·스키마·checks·`seed-data/scenarios.json` / developer `learning/scenarios/**`·`api/v1/scenarios/**`·chats 생성 확장·종료 트랜잭션·`prisma/{schema.prisma,seed-*.ts}`(승인 전 push 금지)·화면(데모 승인 뒤). push 금지.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 09-28 18:07 |
| v1 | 검토요청 | docs/demo/task-010d-scenario-roleplay-v1.html | https://claude.ai/artifact/VbLHUXXbMnM4R4ZAv7vxgj | 사용자 검토 요청 | 09-28 20:23 |
| v1 | 승인 | docs/demo/task-010d-scenario-roleplay-v1.html | https://claude.ai/artifact/VbLHUXXbMnM4R4ZAv7vxgj | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |

## 작업 기록

### 2026-09-28 19:40 Leader — judge intake
- `judge-result@2`(engine jev, needs_info=false): risk R2 · developer opus · demo **full(JV-ui_change)** · `next=demo_first` → `check.mjs init`. 데모는 Phase 2 나머지 task 와 **한 번에 사용자 검토 요청**(승인 요청 횟수 최소화), 스키마 push 승인도 같은 메시지로.

### 2026-09-28 18:30 designer — 데모 v1
- 파일 `docs/demo/task-010d-scenario-roleplay-v1.html`(1,800줄·161KB, 인라인 CSS·JS, 합성 데이터) — `check.mjs lint --expect task-010d-v1` **DEMO_LINT_PASSED**. 토큰 값·틀 표시(실제 폭·높이 배치 후 같은 배율 축소, 폭 360/390/412·세 폭, 높이 780/892, 배율 한 화면/폭 맞춤, 테마)는 승인된 [[task-010-today-lesson]] v2 그대로. token-source `globals.css@sha256:22f382529f92`(지금 파일 — v2 이후 developer 가 keyframe 만 추가, 토큰 값 동일).
- 상태 42개(주소 `#id`): 주제 고르기 8(현재 vs 제안 2 — 주제 목록·주제 시트, 달성한 상황 있음, 상황 목록 로딩·오류·빈) · 바로 상황 고르기 5(추천 3 + 수준별 N5/N4/N3, 빈 N3, 로딩·오류) · 상황 확인 시트 6(해 봄·처음·달성, 자막만, 시작 실패, 찾을 수 없음) · 역할극 회화방 16(첫마디 준비·먼저 말 걸기·대화 중 표현 체크·코치 힌트→정답 보기→스스로 고침·선생님 마무리 띠·마치기 확인·한 마디도 안 함·글자 입력·자막만·마이크 막힘·보내지 못한 말·수업에서 이어짐·오류·404) · 결과 5(정리 중·달성·거의·아직·기록 실패) · 수업 연결 2(종료 카드 현재 vs 제안, 추천 → 시트 → 수업 이어진 역할극).
- 합성 상황 10개(카페 주문 ①사이즈·온도 바꿔 주문하기 ②포장으로 바꾸고 계산하기, 길 묻기 ①역에서 출구 묻기 ②길 잃었을 때 다시 확인하기 — 역할·목표·성공 조건 3·핵심 표현 4·필수 2, 나머지 6개는 목록용). 푸시투토크(72px)를 누르고 떼면 대본 다음 말로 처리 → 표현 ✓·코치 카드·스스로 고침·선생님 마무리·결과까지 클릭으로 이어짐.
- 결정 필요 5(designer 권고): (a) 목표 카드 = **B 첫 마디 뒤 자동 접힘**(780 높이 대화 자리 약 550px vs 늘 펼침 약 340px 실측) · (b) 표현 체크 = **A 보이기(카드에서 숨김 가능)** · (c) 마치기 = **B 선생님도 마무리 제안**(띠 [마치고 결과 보기]·[조금 더 하기], [마치기]는 늘 있음) · (d) 결과 제목 = **A 선생님 판단 + 필수 표현 둘 다 채워야 "달성", 선생님만 달성이면 "거의 다 왔어요"**(기록 규칙과 제목 일치) · (e) 주제 시트 순서 = **A 수업 먼저, 상황 아래, 표현 12개는 접음**.
- 코치 카드는 010c 데모 문구에 맞춘 간단판(힌트 → "다시 말해 보세요" → [정답 보기] → [채택]/[무시], "스스로 고쳤어요 ✓"). 상세 동작은 010c 데모가 정본.
- 검증(헤드리스 Chrome, 창 412×892): 42상태 × 3폭 × 2높이 = 252 경우 **페이지 가로 넘침 0 · 틀 밖으로 나간 요소 0 · JS 오류 0 · 엔진명/모델명/task·Phase 번호 0**. 클릭 흐름 23단계 PASS(주제 → 시트 → 상황 → 시작 → 5턴 → 마무리 띠 → 결과 → 다음 상황, 마치기 확인, 수업 종료 카드 → 역할극, 결정 b·c·d·e 전환). 주 버튼 위치(틀 안 CSS px, 780 기준): [역할극 시작] 768(시트 하단 고정) · 결과 [다음 상황] 727~748 · 결과 아직 [다시 해 보기] ≤638 · 주제 시트 [수업 만들기] 451. 수업 종료 카드의 역할극 추천은 940~960(첫 화면 아래 — 승인본 [이어서 말하기]와 같은 자리, 노트에 명시).
- 다음: Leader Artifact 게시·검토 요청(010b·010c 등과 한 번에). 승인 전 `docs/screens.md` 가이드·화면 코드 없음.

### 2026-10-01 developer
- [08:26] DB 스키마 추가(사용자 "db추가 승인") 반영 — 상세는 [[task-010b-repetition]] 스키마 반영(Developer 기록 2026-10-01). push 는 Leader.
