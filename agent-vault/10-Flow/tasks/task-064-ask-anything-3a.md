---
task_id: task-064
title: "무엇이든 물어보세요(/ask) 3a — 일본어 표현·문법 질문 + 내 학습 기록 근거 답변(정형 조회·출처 카드) (Phase 3, standard 트랙)"
status: doing
waiting: user_demo_approval
base_ref: fa328cb
risk_level: "R2"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, deployer]
related_tasks: [task-006-chat-correction, task-056-improve-talk-phrase-helper, task-055-improve-corrections-collection, task-010b-repetition]
tags:
  - type/task
  - domain/ask
  - domain/conversation
  - domain/learning
aliases:
  - 질문 탭
  - 무엇이든 물어보세요
  - task-064
created: 2026-10-12
updated: 2026-10-12
demo_gate:
  required: true
  level: "full"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-064-ask-anything-v1.html"
  artifact_url: ""
  content_sha256: "aba72aa76fc0b3f2dc1bb62d9b6560ff6f4d789c33fa079101adf3a6e6b5cb78"
  decided_by: "judge"
  rule_id: "DM-kw-full"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-064 — 무엇이든 물어보세요 (/ask) 3a

## 사용자 요청 (원문)
- 2026-10-12 「task-060 배포 후 이어서 다음 작업들도 진행해줘」 → 로드맵 미완료 항목 중 하단 탭에 이미 있는 「질문」(`/ask`, 지금 「준비 중」 자리표시)을 Leader 가 다음 작업으로 골랐다(Phase 3, 로드맵 `[ ] (3) 일본어 표현·문법 질문`·`[ ] (3) 학습 기록 근거 답변과 출처 표시`).

## 관련 과거 이력 요약 (Leader 큐레이션)
- **설계(이미 있음)**: design-spec §7-7·§8 A9 · learning-personalization §3(조회 계층·계약·단계안)·§8 D2 · api-contract §2-18: 전용 엔드포인트 없음, `POST /api/v1/chats {kind:"ASK"}` + `#32 POST /api/v1/chats/:id/turns` 재사용. A9 = 페르소나 전체 + `[모드] ASK` + 학습자 헤더 ≤600자 + 조회된 본인 기록 ≤2,000자 + 최근 12개 ≤8,000자, 응답 `conversation.answerMd`·`sources[{type,id,date,label}]`·`confidence(HIGH|MEDIUM|LOW)`·`needsScope?`·`proposals[]`(ASK 허용 = `ADD_WORD`·`ADD_STUDY_LOG`·`ADD_TOPIC`·`SET_LEVEL`), sonnet(`runtime.tiers.review`), 120s, SSE.
- **조회 계층**: `learning/recordRetrieval`(L3) — 화이트리스트 함수만(`getProgressSummary`·`getDueReviews`·`getRecentCorrections`·`findExpressions`·`getLessonsByTopic`·`getSkillState`), LLM 은 SQL 을 만들거나 실행하지 않음, `userId` 는 세션에서만, 결과 건수 ≤20·총 ≤2,000자·발췌 ≤300자, 최소 필드 `{sourceRef{type,id,date,label}, text}`. 의도 분류 `classifyIntent`(규칙 우선 → 애매하면 haiku 1회, 입력 질문 ≤1,000자만): `PROGRESS`·`EXPRESSION`·`GENERAL`·`MIXED`.
- **현재 코드(2026-10-12 직접 확인)**: `Chat.kind=ASK` 는 스키마·타입에 이미 있고, `orchestrator/index.ts:145·404` 가 ASK 턴·수락을 `FEATURE_NOT_READY` 로 막고 있다. `src/app/(app)/ask/page.tsx` 는 `ComingSoon` 11줄. 교정 `correction` 은 ASK 에서 항상 `null`(계약), 제안 카드·채택 경로는 CHAT/TALK 것을 재사용할 수 있다.
- **교훈 task-056**: 회화 턴과 AI 호출이 같은 직렬 CLI 줄(`CLAUDE_CLI_CONCURRENCY=1`)을 쓴다 — 새 LLM 호출 지점은 먼저 지연 영향을 실측해 사용자에게 선택지로 올린다. ASK 는 별도 화면이라 회화 턴과 겹칠 일이 드물지만(한 사용자, 사용자당 락) A11 복습 판단·도우미와는 겹칠 수 있다. 승인된 교훈(`/이슈기록 관련`): 없음.
- 회화개선 세션(8bbde9)에 /ask 시작 여부 확인: 시작 안 함·공유할 결정 없음(2026-10-12), 번호 064 부터 이 세션이 쓴다.

## judge 접수 (Leader 실행, `judge-result@2`)
- demo=**full**(`DM-kw-full`·`DM-new-route`) · track=**standard**(light 아님) · developer=**opus**. 입력·결과: 스크래치 `judge-064-intake*.json`. judge 는 위험을 R1 로 냈으나 **Leader 가 R2 로 상향** — 새 LLM 호출 지점(A9) + 개인 학습 기록의 외부(Claude CLI) 전송 + 새 서버 조회 계층. judge `task_type`·`complexity`·`roles` 는 null/빈 값(키워드 규칙 미충족) — 역할은 아래 Leader 구성을 쓴다.
- 워크플로우(standard): Designer 데모(full) → **사용자 승인(직접 입력)** + D2 결정 → Prompt-Engineer(A9) → [Judge C1 → Codex?] → Developer(서버·UI) → Reviewer → [Judge C2] → QA → Deployer → Leader.

## 범위 (3a — 설계 §3-4 「Phase 3 기본」)
**한다**: ① 질문 탭 `/ask`(질문 방 목록·새 질문) · `/ask/[chatId]`(질문 방) ② `POST /api/v1/chats {kind:"ASK"}` 허용(`FEATURE_NOT_READY` 해제)과 ASK 턴 ③ `classifyIntent`(규칙 우선) ④ `recordRetrieval` 화이트리스트 조회(본인 기록만) ⑤ A9 프롬프트 `ask@v1`(+ JSON 계약, 회귀 픽스처, Prompt Registry sync) ⑥ 답변 + 출처 카드(레슨·교정·상황 상세로 이동) + 확신도 표시 + `needsScope` 되묻기 + 제안 카드(ADD_WORD·ADD_STUDY_LOG·ADD_TOPIC·SET_LEVEL, 채택해야만 저장).
**안 한다(후속)**: 3b MCP `propose_*`·조회 함수의 도구화 / 3c 로컬 임베딩 의미 검색(D4: 정형 조회로 못 푸는 질문 비율 실측 ≥20% 일 때만) / Japanese Knowledge Base(RAG 슬롯, `learning/knowledge`) / home-m4(qwen) 의 ASK·의도 분류(D7 현행 금지 유지) / 파인튜닝.

## 사용자 결정이 필요한 것 (데모 승인 때 함께 묻는다 — Leader 권고안 포함)
1. **D2 개인 학습 기록의 Claude CLI(외부) 전송 범위** [설계 §8 D2, 미결]: (a) 정형 요약만(횟수·점수·due 목록) / **(b) + 채택 교정 원문·레슨 표현 — Leader 권고(설계 권고와 같음)** / (c) + 대화 발췌 ≤300자(범위가 넓을수록 답이 구체적이지만 외부로 나가는 데이터가 늘어남). 권고 근거: (b) 까지는 사용자가 직접 채택·저장한 학습 산물이고 이메일·내부 id·엔진명·`toolLog`·원음·대화 전문은 어느 경우에도 안 나간다. (c) 는 `needsScope` 로 사용자가 범위를 명시한 질문에서만 허용하는 방안.
2. **의도 분류에서 LLM(haiku 1회)을 쓸지** [설계: 규칙 우선·애매할 때 haiku]: 권고 = 3a 에서는 규칙만 쓰고 애매하면 `MIXED`(기록+일반)로 처리, haiku 분류는 도입하지 않는다 — 직렬 CLI 줄에 호출 1건을 덜 올리고 지연을 줄이기 위해. 규칙 오분류 비율을 QA 에서 실측해 부족하면 도입.
3. **지연 영향 실측 결과 보고(QA 후)** — A9(sonnet, 최대 120s)가 CLI 줄을 점유하는 시간이 같은 시간대의 회화 턴 지연에 주는 영향. 결과에 따라 「질문 답변 중에는 회화 시작 안내」 등 선택지를 올린다.

## Leader 결정 — 데모 v1 의 열린 질문(계약 보완, 2026-10-12, 사용자가 바꾸라면 바꾼다)
designer 가 데모 v1 에서 올린 6개 질문([[task-064-designer-record]] 「열린 질문」)을 Leader 가 아래처럼 정한다. 구현 전 `docs/design/api-contract.md` §2-18 에 additive 로 반영한다.
1. **근거 `sources[].type`** = `LESSON | CORRECTION | SCENARIO | REVIEW | WORD | STUDY_LOG`. 이동 주소는 기존 라우트 재사용: 교정 → `/drawer/corrections?focus=<id>`(첫 쪽 밖 교정도 찾는지 developer 가 확인, 못 찾으면 목록 맨 위+검색), 복습 항목 → `/study/today`(복습 카드), 나머지는 해당 상세. 서버가 `type` 별로 주소를 만들지 않고 클라이언트 매핑 한 곳(`askCopy`/`sourceHref`)에서 만든다.
2. **「관련 기록을 못 찾았어요」 줄** = **서버 신호**(additive `conversation.records:{count:number}`)로 정한다 — 프롬프트가 본문에 쓰는 방식은 비결정적이라 택하지 않는다. 기록 질문인데 `count=0` 이면 화면이 그 줄을 그리고 일반 설명으로 답한다.
3. **되묻기 칩 답** = 칩이 `needsScope.options[{key,label}]` 를 받아 #32 요청에 additive `scope:{key}` 를 실어 보내고, 서버는 **직전 USER 질문의 의도**에 그 범위를 결합해 `retrieveRecords` 한다(칩 글자만으로 분류하지 않음). D5 A 채택.
4. **질문 방 목록 미리보기** = ASK 목록 응답에 additive `preview`(마지막 ASSISTANT 답 첫 줄 평문 ≤60자, 읽을 때 계산 — 스키마 변경 없음). 없으면 첫 질문.
5. **보내는 범위 안내 확인 저장** = 기기별 `localStorage`(`kaiwa.ask.scopeNotice.v1`, 범위가 바뀌면 키 버전을 올려 다시 보인다 — 새 기기에서 다시 보이는 쪽이 안전). 스키마·서버 변경 없음.
6. **진짜 취소(D6 Y)** = 3a 에서 안 한다. 화면 이탈 = [나가서 기다리기], 서버는 답을 끝까지 만든다. 지연 실측(QA) 뒤 재검토.
- designer 데모와 이 이력서 초안의 다른 점: **D9(예문 뜻 줄 항상 표시)** — 이력서 초안은 「번역 표시도 앱 스위치를 따른다」였으나 번역 기본값이 끔이라 설명의 핵심인 뜻이 숨는다는 designer 근거가 타당해 권고안 A(예문 블록만 히라가나·한글 스위치, 뜻 줄은 늘 보임)를 따르되 **사용자 결정 항목**으로 올린다.
- 데모의 한계(사용자에게 알림): 답 본문은 **글자가 조금씩 오지 않고 끝에 한 번에** 나타난다(#32 SSE 에 증분 이벤트 없음, Claude CLI `--json-schema` 출력 특성) — 최대 120초 동안 단계 문구(PROMPT→LLM→PARSE)와 경과 초만 보인다.

## 구현 계획 (승인 뒤)
- **P0 데모(designer)**: `docs/demo/task-064-ask-anything-v1.html` — `/ask` 목록·빈 상태·새 질문, 질문 방(스트리밍 답변·출처 카드·확신도·`needsScope` 칩·제안 카드·오류/지연 상태), 360/390/412. 승인 후 구현 가이드 `docs/screens.md` §25.
- **P1 prompt-engineer**: `ask@v1` 모듈·스키마(`answerMd·sources·confidence·needsScope·proposals`)·회귀 픽스처. 출처 대조(`sources[]` 가 실제 행과 일치 ≥95%) 검사 기준 포함.
- **P2 developer-S(서버)**: `recordRetrieval`(6 함수 + `retrieveRecords`)·`askRouter.classifyIntent`·오케스트레이터 ASK 분기(`FEATURE_NOT_READY` 해제)·A9 호출·SSE `sources` 이벤트·`correction:null`·제안 생성·`RequestTrace`(원문 질문·기록 본문 미저장). **developer-U(UI)**: `/ask`·`/ask/[chatId]`·`components/ask/**`·출처 카드·제안 카드 재사용. 파일 영역을 나눠 병렬.
- **P3 reviewer**: 6층 경계(conversation→learning 읽기 5종)·userId 격리·최소 필드·외부 전송 범위(D2)·엔진명 누출·LLM 계약. **qa**: 타 사용자 행 0건·`sources` 대조·`needsScope` 흐름·제안→채택 행 수·지연 실측·3폭 화면. **deployer**: 웹 배포(스키마 변경 없음 확인 — `Chat.kind` ASK 는 이미 있음).

## 완료 기준 (초안)
1. 질문 방에서 일본어 표현·문법 질문과 학습 기록 질문(진도·복습·교정·배운 표현)에 답이 오고, 기록 근거 답에는 출처 카드가 붙으며 누르면 해당 레슨·교정·상황으로 이동한다.
2. 타 사용자 기록이 조회·프롬프트·출처 어디에도 나오지 않는다(`userId` 세션 주입, 격리 시험).
3. 외부 전송은 사용자가 정한 D2 범위 안에서만(최소 필드·건수·글자 상한 시험), 이메일·내부 id·엔진명·`toolLog`·원음·대화 전문 없음.
4. 제안(ADD_WORD 등)은 채택해야만 저장되고 `Correction`·`StudyLog` 자동 생성 없음(ASK 는 교정 금지).
5. 기존 회화·채팅·도우미 지연이 퇴행하지 않음(실측 보고), tsc 0·eslint 0·전체 시험·build 0.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다(`check.mjs init` 이 기록). 이 표는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성 전 | - | - | judge: full (DM-kw-full, DM-new-route) | 10-12 |
| - | 작성중 | - | - | judge: full (DM-kw-full) | 10-12 13:12 |
| v1 | 검토요청 | docs/demo/task-064-ask-anything-v1.html | - | 사용자 검토 요청 | 10-12 13:36 |

## 상태 로그
- 2026-10-12 Leader 가 로드맵에서 /ask 선택 → 설계 문서·현재 코드 확인 → judge 접수(standard·demo full) → 이력서 작성. 다음: `check.mjs init` → designer 데모 v1.
