---
task_id: task-064
title: "무엇이든 물어보세요(/ask) 3a — 일본어 표현·문법 질문 + 내 학습 기록 근거 답변(정형 조회·출처 카드) (Phase 3, standard 트랙)"
status: review
waiting: device_verify
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
  status: "approved"
  version: 2
  repo_path: "docs/demo/task-064-ask-anything-v2.html"
  artifact_url: ""
  content_sha256: "8b899402acad58958f26447c3abddcc3a3b8dced61e842628eda4ae77683cbce"
  decided_by: "judge"
  rule_id: "DM-kw-full"
  approved_by: "user"
  approved_at: "2026-10-12T16:43:39+09:00"
  approval_quote: "task-064 데모 v2 승인, D1~D13은 권고대로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
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

## 사용자 승인 · 확정 결정 (2026-10-12 16:43 KST)
- **승인 원문(직접 입력)**: 「task-064 데모 v2 승인, D1~D13은 권고대로」 — `check.mjs approve` 로 기록(`docs/demo/task-064-ask-anything-v2.html` v2, sha256 `8b899402acad…`, 해시 검증 PASS), 구현 시작 `activate`.
- **확정값(전부 데모 ★ 권고)**: D1 B(맨 위 입력 카드+예시 칩, 아래 지난 질문) · **D2 범위 (b)**(정형 요약 + 채택 교정 원문·고친 문장·레슨 표현 — **단어장 단어는 보내지 않는다**: 사용자가 본 동의 문구·구현·계약이 모두 그렇고 이 줄만 낡았던 것을 QA A3a-1 이 찾아 2026-10-12 Leader 정정 — 안내 A: 첫 질문 보낼 때 시트 1회, 방 메뉴에서 다시 보기) · D3 A(답 아래 근거 3장+[n개 더 보기]) · D4 A(LOW 일 때만 한 줄) · D5 A(고정 칩 이번 주·지난 30일·전체 기간+[직접 쓸게요]) · D6 표시 C·**취소 버튼 없음**(단계 문구+경과 초+30·90초 안내) · D7 A(답→근거→제안) · D8(제목 첫 질문 앞 30자·목록 둘째 줄=마지막 답 첫 줄·삭제는 방 ⋯ 메뉴→확인) · D9 A(예문 블록만 후리가나·한글, 뜻 줄 항상) · **D10 A·D11 A·D12 A·D13 A = 3a 는 글자 질문만, 음성 받아쓰기(L 탭)는 한국어 인식 품질 실측 뒤 2단계**.
- **함께 적용되는 Leader 권고(사용자 미반대)**: 의도 분류는 규칙만(LLM 분류 없음)·지연 영향은 QA 실측 뒤 선택지로 보고.
- **C1(설계 직후)**: judge 가 `codex_required`(adversarial-review·security) → codex 에이전트가 계약 §2-18-A·설계를 읽기 전용 검토 중. **developer 는 Codex 결과를 Leader 가 반영한 뒤 시작.** 병렬 진행: designer `docs/screens.md` §25 구현 가이드 · prompt-engineer `ask@v1`.
- **서버 계약**: `docs/design/api-contract.md` §2-18-A(Leader 확정, additive) — `scope{key}`·`needsScope.options`·`records{intent,count}`·`preview`·`sourceKeys`→서버가 `sources[]` 생성·`toolLog.ask` 저장(스키마 변경 없음)·클라이언트 단절 후에도 서버 완주·분당 6/하루 200.

## 사용자 추가 요청 (2026-10-12, 데모 v1 검토 뒤 — 원문) → 데모 v2 로 반영
> 데모화면에 대하여 결정사항 체크했어. 추가적으로 변경할 사항에 대하여 아래에 작성하니까 확인해서 데모화면 현행화해줘
> 1. 답을 기다리는중인 상태에서 '나가서 기다리기'버튼은 제거해줘.
> 2. 해당 챗봇에게 채팅의 형식말고 마이크를 통한 말로 연상되는 단어나 문장을 말하거나 상황을 설명하면 강사가 번역이나 설명을 답변해주는 것도 가능했으면 좋겠어.
- **데모 v1 의 D1~D9 선택값은 Leader 에게 전달되지 않았다**(데모 HTML 의 선택은 사용자 브라우저에만 있음). 사용자가 승인 문장에 **바꾼 항목만** 적게 하고, v2 에는 「내 선택 요약」 글 상자(복사해서 붙일 수 있는 문장)를 넣는다. 그때까지 D1~D9 는 ★ 권고를 기본으로 둔다.
- **요청 1 반영**: 답 기다리는 화면에서 [나가서 기다리기] 버튼 제거(D6 취소 X 안도 삭제). 나가는 길은 앱 상단 뒤로·하단 탭뿐이고, 서버는 답을 끝까지 만든다는 안내 문구 한 줄만 둔다(버튼 아님 — 35초·95초 단계). 목록의 「답 만드는 중」 행과 돌아왔을 때의 도착 표시는 유지. 구현 조건: ASK 턴은 클라이언트가 SSE 를 끊어도 서버가 답을 끝까지 만들어 저장해야 한다(`req.signal` 취소 연결 금지 — task-058 의 취소 신호는 #169·#178 한정).
- **요청 2 해석(Leader, 확인 필요)**: 질문 방 입력에 **마이크**를 더해, 한국어로 상황을 설명하거나 생각나는 단어·문장(일본어 포함)을 말하면 받아쓴 글이 입력창에 채워지고(편집 가능) 보내면 강사가 번역·설명으로 답한다. 답을 소리로 읽어 주는 것은 요청에 없어 이번 범위에 넣지 않고 선택지(D12)로만 둔다.
- **기술 사실(Leader 확인)**: ① 실시간 음성 인식(앱 온디바이스·gateway)은 **일본어 전용**(ReazonSpeech) — 한국어 불가 ② 서버 Whisper 경로(VoiceVault whisper-service 재사용, `language` 매개변수 어댑터)는 한국어도 인식 가능하나 설정은 `language: ja` 고정(자동 감지 끔 — 한국어 섞임 오인 방지) ③ 기존 음성 업로드 한도 60초·2MB 는 16kHz 모노 녹음과 맞음 ④ 동기식 짧은 받아쓰기 경로는 아직 없음(분석 STT 는 `SpeechJob` 큐) → **새 서버 경로 + 한국어 인식 품질 실측이 필요**. 오디오는 우리 서버 안에서만 처리(외부 AI 로 안 감) — 받아쓴 글만 질문으로 쓰이고, ASK 는 원음을 저장하지 않는 쪽을 권고. 일본어만(즉시, 기존 경로 재사용)과 한국어 포함(새 경로)의 선택은 사용자 결정(D10).
- **단계 제안**: 글자 ASK(3a) 먼저 → 음성 입력(3a-2)은 한국어 인식 품질 실측 뒤 같은 task 의 후속 단계로 — 사용자 결정(D13).

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

## Leader 결정 — 데모 v2 의 열린 질문(2026-10-12, 사용자가 바꾸라면 바꾼다)
designer 가 v2 에서 올린 4건([[task-064-designer-record]] 「v2 (현행화)」 열린 질문)에 대한 Leader 결정이다.
1. **질문 방에서 하단 탭 숨김** = 유지(채팅방과 같은 규칙, 입력 바·키보드 높이 확보). 대기 중 나가는 길은 상단 ‹·안드로이드 뒤로 → 질문 목록 → 하단 탭. 방 안에서 탭을 보이게 하려면 v3 필요(권고하지 않음).
2. **근거 유형 추가** = `sources[].type` 에 `EVALUATION`(평가 상세 `/study/today/eval/[id]` 로 이동) 추가. `SCENARIO`(상황 연습)는 별도 상세 화면이 없으므로 그 상황이 만든 **역할극 방**(`/study/ai/talk/[chatId]`)이 아직 있으면 거기로, 없으면 카드를 누를 수 없게 라벨만 보인다. 최종 enum = `LESSON | CORRECTION | SCENARIO | REVIEW | WORD | STUDY_LOG | EVALUATION`.
3. **음성 받아쓰기 경로 계약**(D13 후속 2단계로 미룸) = 지금은 정하지 않는다. 2단계 착수 조건은 「한국어 받아쓰기 품질 실측(대표 발화 N개의 문장 오류율 기준)」과 「요청마다 언어를 넘기는 인자(새 `language`) 추가」 — 그때 계약 §2-18 에 additive 로 쓴다.
4. **D10 C(일본어만, 기존 실시간 연결 재사용)** = 3a 범위 밖. 선택되면 ASK 에 말소리를 저장하지 않는 실시간 연결을 열어도 되는지 계약 확인부터(권고 안 함).

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
| v1 | 수정요청 | docs/demo/task-064-ask-anything-v1.html | - | "1. 답을 기다리는중인 상태에서 '나가서 기다리기'버튼은 제거해줘. 2. 해당 챗봇에게 채팅의 형식말고 마이크를 통한 말로 연상되는 단어나 문장을 말하거나 상황을 설명하면 강사가 번역이나 설명을 답변해주는 것도 가능했으면 좋겠어." | 10-12 13:55 |
| v2 | 검토요청 | docs/demo/task-064-ask-anything-v2.html | - | 사용자 검토 요청 | 10-12 15:49 |
| v2 | 승인 | docs/demo/task-064-ask-anything-v2.html | - | "task-064 데모 v2 승인, D1~D13은 권고대로" | 10-12 16:43 |

## 상태 로그
- 2026-10-12 Leader 가 로드맵에서 /ask 선택 → 설계 문서·현재 코드 확인 → judge 접수(standard·demo full) → 이력서 작성. 다음: `check.mjs init` → designer 데모 v1.

## 구현·검증 진행 (2026-10-12 저녁, Leader — 미커밋·미배포 상태)

**서버·보안 감사 REV-064-S: PASS_WITH_NOTES** ([[task-064-rev-s-record]]) — 변이 49건 중 41건 시험이 잡음, 엔진명·층 위반·HTML 싱크·외부 링크·본문 로그 0. Medium 2: S-1 살균 단일 패스(해소, 고정점 반복) · S-2 공용 AI 호출 줄 공유(아래 사용자 결정으로 처리).

**QA (검증 서버 = 최종 코드 스냅샷 미러, 127.0.0.1:3011, QA 계정만)**

| 갈래 | 기록 | 결과 |
|---|---|---|
| A1 API 계약 | [[task-064-qa-a1-record]] | 204 확인 중 203 PASS(1은 도구 문제, 재확인 PASS) · 제품 결함 0 · AI 호출 0 · 격리·한도(429)·되묻기 단락·응답/로그 누출 0 |
| A2 라이브 실측 | [[task-064-qa-a2-record]] | 결함 0 · AI 10회 · **ASK 1건(약 13초)이 도는 동안 다른 사용자 채팅 3.5초→14~16초(+10.4/+12.3초)**, 실패 0 · 409·한도 환불(60초 창 판정)·끊김 후 완주(약 12초 뒤 저장) 확인 |
| A3a 전송 범위 D2=(b) | [[task-064-qa-a3a-record]] | 프롬프트 21건 전부 **동의 범위 위반 0**(제외 12종 0) · 상한·비신뢰 구역 이스케이프 PASS · 저장 형태에 질문·기록 본문 0 · 심은 행 정리 대조 차이 0 |
| A3b 실제 답변 | [[task-064-qa-a3b-record]] | 7개 실험 PASS · 적대 문장 지시 이행 0 · count=DB · 제안은 제안만(채택 전 행 0) · AI 11회 |
| B1 화면(모의) | [[task-064-qa-b1-record]] | 3폭 PASS · Low 3 |
| B2 화면(실제 답) | [[task-064-qa-b2-record]] | **중단**(AI 4/5) — Medium QA64-B2-1 발견 |

**발견·처리**
- QA64-B1-1(방 오류 재시도 버튼 20px) → 수정(dev-lo, 1줄) + 시험 공백 3건 보강(M6f·M7c·M8d) — 변이 16건 전부 잡힘 ([[task-064-dev-lo-record]]).
- QA64-B1-2(429 잠금 시 [보내기] 접근성 이름이 초 원값)·B1-3(알 수 없는 유형 카드 빈 원) → 수용(후속).
- QA64-B2-1(Medium): 답이 도착하면 목록이 바닥에 붙어 긴 답의 첫 문단·질문이 화면 밖 → designer 가 §25-5 J 규칙(질문 말풍선 윗면 정렬) → developer 구현([[task-064-dev-scroll-record]]) → REV-scroll 진행. **Leader 결정**: 알약 문구 「새 답 ↓」(기존 `ASK_COPY.newAnswer`), 승인 데모 v2 에 없는 작은 요소지만 light 트랙 데모 면제(사용자 결정 ADP-001 D-10)로 데모 v3 없이 진행 — 배포 승인 때 고지.
- **S-2 → 사용자 결정(2026-10-12, 질문 도구 응답) 「ASK 전용 슬롯 추가 후 배포」**: AI 호출 줄에 ASK 전용 슬롯 1개(최대 동시 2) → judge feature·R1·opus·standard → developer 구현 ([[task-064-dev-lane-record]], 변이 7종 잡힘) → REV-lane 진행. 같은 사용자의 회화·채팅 락(409)은 그대로.
- A3b Low-1(「단어장에 추가해줘」가 EXPRESSION 으로 분류돼 무관한 최근 교정 최대 4건이 함께 전송 — 동의 범위 안) → 수용(후속: 분류 규칙·추가 요청 GENERAL), A3b Low-2(프롬프트 문체 2건) → 후속, Low-3(방 삭제 후 PROPOSED 제안이 30일 남음, `onDelete: SetNull`) → Leader 판단 후속.
- 동의 문구에 열거되지 않은 보조 칸이 실제 나감(A3a 관찰 1): 레슨·상황 제목, 교정 유형 라벨·누적 횟수, 평가 5항목 점수, 출석 일수, 문법 패턴 짧은 뜻, 복습 예정 표현의 뜻, 헤더의 선생님 이름·목표·약점 코드 — 제외 12종과 겹치지 않음. **배포 승인 때 사용자에게 고지.**
- 문서 정정: §25-5 B `noneLine` 수식에 `!needsScope`(구현 일치) · 계약 §2-18-A 3-A(도우미·대답 연습은 404)·제목 규칙(29자+…) 실제 동작에 맞춤.
- (이 항목은 배포로 닫힘 — 아래 「운영 배포」)

## 운영 배포 (2026-10-12 23:24 KST, Leader — 사용자 승인: 질문 도구 응답 「그대로 커밋·푸시·배포 (권장)」)

- **마지막 감사·QA 정리**: REV-lane PASS_WITH_NOTES(변이 12건 생존 0) · REV-scroll PASS_WITH_NOTES(변이 30건 중 25 포착, 회화·채팅 마크업 18건 동일) · dev-nit(L-1 설정 설명·L-2 시험 예외·SCROLL-4 click 만짐, 변이 포착) · QA-A4(슬롯 재측정: 채팅 기준선 3.02초, ASK 중 다른 사용자 채팅 3.07/3.87/3.71초, 최대 동시 AI 프로세스 2, 프로세스당 RSS 약 350~400MB, ASK 끼리 직렬, 같은 사용자 409 불변, 한도 환불) · QA-B3/B4(스크롤 합격선 3폭 PASS: 재진입·SSE 도착·폴링 도착·위로 올림 알약 「새 답 ↓」 1개·클릭 후 정렬 12±2·초점 목록·키보드·글자 200%·회화/채팅 회귀 0, 결함 Low 1 = QA64-B4-1 대기 카드 재진입 360폭 14px, 새 코드 경로 아님·수용).
- **커밋**: 코드 `c3fb3f1`(src·tests·.env.example 100개: 신규 68·수정 31·삭제 1) · 문서 `6bff544`(docs 4개) · vault `59eb4f8`(33개). `.obsidian/` 5개는 제외(이 작업 것 아님).
- **푸시 전 게이트**(HEAD `59eb4f8`, `git archive` 사본): prisma generate 0 · eslint 오류 0(경고 5 기존) · 시험 3,794건 중 3,793 통과·실패 0·건너뜀 1 · build 0. **tsc 는 첫 실행 exit 2** — 상시 미러에 남은 이전 빌드의 `.next/types/validator.ts` 가 삭제한 `ask/page.tsx` 를 참조하는 낡은 생성물(소스 오류 아님): 방금 끝난 `next build` 가 생성물을 갱신한 뒤 같은 미러에서 `tsc` 재실행 **exit 0·출력 0**, validator 의 `ask/page.js` 참조 0, HEAD 에 해당 파일 없음.
- **push** `812b52c..59eb4f8`(로컬 커밋 5개: task-065 배포 기록·task-064 데모 v2 문서 + 이번 3개) → 웹훅 START 23:23:59 → 릴리스 **`20261012-232359-59eb4f85`** `RELEASE_RESULT ok`·`migrated:false`(스키마·APK 변경 없음). **롤백 대상 `20261012-143811-812b52c1`**(`bash scripts/deploy.sh TheKaiwa --rollback`). 배포 로그의 `SPAWN_FAILED` 는 Next 빌드의 「동적 파일 접근이 프로젝트 전체 추적」 경고가 인용한 기존 코드 한 줄(`claudeCli.ts:898` 버전 탐지)이지 오류가 아니다.
- **배포 직후 확인**: 운영 헬스 200 `PRODUCTION`·`status ok`·`degraded []`·checks 11개 전부 true · pm2 3개 online·재시작 0·cwd 새 릴리스 · 번들: `(app)/ask/` 에 `[chatId]`·`(tab)` 만(옛 `page.js` 없음), `answer-start` 2·「새 답」 11·「자유로운 대화」 1·범위 안내 키 5개 파일, 「나가서 기다리기」 0, ASK 레인 매핑 청크 2 · **운영 읽기 전용 스모크(QA2, GET 14건·쓰기 0·AI 0)** 7개 항목 PASS: 무인증 `/ask` 307→로그인, QA2 쿠키로 `/ask`·`/study/ai`·`/study/today`·`/plan`·`/settings`·`/drawer/words`·`/drawer/corrections` 200, 하단 탭 「회화·공부·계획표·단어장·질문」, `/api/v1/chats?kind=ASK`·`kind=CHAT` 200(QA2 방 0), 응답·HTML 에 엔진명·Secret 계열 0, 없는 id 404, 23:24 이후 서버 로그 오류 패턴 0, 운영 node 자식 `claude` 0 ([[task-064-qa-prod-record]]).
- **부수 조치**: QA 가 호스트 이상 2건 보고 — ① 스왑 2,047/2,047MB 가득(점유 상위 mysqld·java·n8n, 이번 배포 탓 아님; 다만 AI 프로세스 동시 2개 추가 약 700MB 에 주의) ② `thekaiwa-dev064s2b` 고아 시험 프로세스 9개(약 5시간 53분, dev-S2b 의 `node --test` 가 남김) → cwd·명령줄 확인 뒤 해당 PID 에만 SIGTERM, 잔존 0·가용 메모리 18,100→18,540MB, 운영 3010·pm2 무영향.
- **남은 일(사용자 몫)**: 폰(앱 WebView)에서 ① 하단 「질문」 탭 → 첫 질문 시 보내는 범위 안내 시트 → 일반 질문 1건(범위 칩이 필요한 질문은 칩) ② 긴 답이 도착했을 때 질문과 답 첫 문단이 보이는지(스크롤 규칙), 위로 올려 둔 채 도착하면 「새 답 ↓」 ③ 근거 카드 눌러 원래 기록으로 이동 후 「질문으로」 돌아오기 ④ 제안 카드(ADD_WORD)는 채택/거절 버튼으로 ⑤ 느낌상 지연(ASK 중 다른 화면은 안 막히는지 — 같은 계정은 409 가 정상). **운영에서 실제 질문 한 번을 QA 계정으로 해 보는 확인은 아직 안 했다(POST·AI 호출이라 사용자 허락 필요).** 임시 미러 정리(dev064*·pe064·rev064*·`rev064-tree`)는 사용자 지시 시.
- **알려진 한계(배포 때 고지한 것 그대로)**: 보조 전송 칸(레슨·상황 제목, 교정 유형·횟수, 평가 점수, 출석 일수, 문법·복습 표현의 뜻, 헤더 정보) · 분류 오류 시 무관한 최근 교정 최대 4건 동반 · 한도 메모리 저장 · 같은 사용자 ASK 중 회화·채팅 409 · 승인 데모 v2 에 없는 「새 답 ↓」 알약 · AI 프로세스 동시 2개.

## Codex 검토 (C1, 2026-10-12)

### 검토 요약
- **모드**: adversarial-review (security 초점)
- **스냅샷**: b7e9258d14677308eacec0d1c8100a46cced9b09
- **소요**: 103초
- **지적 건수**: 4건 (high 2·medium 2)
- **검토 범위**: 설계 문서(api-contract·learning-personalization) 정본 기반, 구현 코드는 아직 없음

### 지적 목록

#### 1️⃣ [HIGH] DoS 취약점 — 인증 사용자의 공용 LLM 슬롯 무한 점유
- **위치**: api-contract.md:1397
- **조건**: 인증 사용자가 120초에 가까운 ASK 요청을 반복하고 연결을 즉시 끊을 때
- **근거**: 사용자별 동시 실행은 1건 제한이지만 전역 LLM 실행 슬롯(`CLAUDE_CLI_CONCURRENCY=1`)은 공용 단일. 하루 200건 한도는 최악의 경우 약 6.7시간의 지속 실행을 허용한다.
- **영향**: 한 사용자가 공용 슬롯을 점유하여 다른 사용자의 회화·채팅·복습 판단 요청 지연/타임아웃.
- **권고**: ASK를 공용 큐에 넣고 사용자별 연속 실행 상한·전역 대기열 상한·실행시간 기반 사용자 쿼터 추가. 백그라운드 완주는 제한된 시간 예산만 허용.

#### 2️⃣ [HIGH] 문서 정본 충돌 — 개인 기록 외부 전송 범위 불일치
- **위치**: api-contract.md:1403 vs learning-personalization-and-llm-data.md:335, 358, 363
- **조건**: 개발자가 두 정본 문서를 동시에 기준으로 따를 때
- **근거**: api-contract는 D2=(b) 확정 후 "대화·발화 원문 제외" 명시, learning-personalization은 원문 발췌 ≤300자 허용·"사용자 결정 필요" 명시. 인계 묶음에서 둘 다 정본으로 지정.
- **영향**: 허용되지 않은 개인 대화 원문이 Claude CLI 프롬프트에 포함될 수 있음. 구현·리뷰·QA가 서로 다른 기준으로 통과.
- **권고**: learning-personalization을 D2=(b) 확정 내용으로 즉시 맞추고 대화 발췌 허용 문구·사용자 결정 문구 제거. 외부 전송 DTO 별도 타입화 + 부정 시험.

#### 3️⃣ [MEDIUM] 저장형 프롬프트 주입 — 출처 의미적 검증 부재
- **위치**: api-contract.md:1401
- **조건**: 조회된 교정 설명·레슨 표현·단어에 모델 지시가 포함되거나 사용자가 유효한 sourceKeys를 임의로 인용할 때
- **근거**: 설계는 임시 키(`S1`…`Sn`) 존재성만 확인하고 버린다. 저장 데이터 구획화·비신뢰 마킹·의미적 일치 검증 규칙이 없다.
- **영향**: 저장형 프롬프트 주입으로 답변·확신도·제안이 조작되거나 무관한 기록이 신뢰 가능한 출처처럼 표시.
- **권고**: 조회 블록을 명시적 비신뢰 구역으로 직렬화. sourceKeys·confidence·proposals는 서버 재검증. 출처 선택은 함수 산출 유형·답변 의도와 일치할 때만 허용. 저장형 주입 문자열 회귀 시험.

#### 4️⃣ [MEDIUM] XSS 위험 — answerMd 마크다운 렌더링 계약 부재
- **위치**: api-contract.md:1400
- **조건**: LLM이 HTML·위험 URL 스킴·렌더러 확장 문법을 answerMd에 출력하고 클라이언트가 HTML 지원 렌더러로 표시할 때
- **근거**: answerMd 정의는 "한국어 마크다운 ≤4,000자"만. 허용 태그·링크 스킴·raw HTML 처리·살균 계약 없음. 설계 단계라 렌더러 구현도 미확인.
- **영향**: 저장형 XSS, 피싱 링크, 앱 WebView의 의도하지 않은 외부 이동.
- **권고**: raw HTML 금지, 마크다운 노드·링크 스킴 allowlist 계약화 (http/https/내부경로만). 렌더링 전후 javascript:/data:/이벤트 속성/iframe 거부 시험.

### Leader 판정 (2026-10-12 — 지적 근거를 계약·문서·코드로 직접 대조)
| # | 지적 | 판정 | 조치 |
|---|---|---|---|
| 1 | HIGH · 공용 LLM 슬롯 점유(DoS) | **부분 채택** | 위험은 실재(`CLAUDE_CLI_CONCURRENCY=1` 전역 1슬롯, 사용자 수는 초대제라 적음). 한도 **분당 6·하루 200 → 분당 3·하루 60**, **전역 대기 상한**(실행 1+대기 2 초과 → `429 ASK_BUSY`) 추가 — 계약 §2-18-A 3항. 실행시간 기반 쿼터는 구현 대비 이득이 작아 후속 후보. 영향은 QA 실측으로 보고. |
| 2 | HIGH · 문서 정본 충돌 | **채택** | `learning-personalization` §8 D2 에 「결정(2026-10-12): (b)」·(c) 불허, §3-5 표·충돌 문단 정정. 계약 5항에 `ExternalRecordItem` 별도 타입 + 부정 시험 필수. |
| 3 | MEDIUM · 저장형 프롬프트 주입 | **부분 채택** | 비신뢰 구역 직렬화·경계 이스케이프(PE)·서버 재검증(`sourceKeys` ⊆ 제공 키, 의도별 type 필터, `proposals` 기존 스키마)·주입 회귀 시험 = 채택(계약 9항). **의미적 일치 검증은 기각** — 신뢰도 낮고 근거 카드는 본인 기록으로만 연결돼 최악이 본인 기록 라벨 오표시. |
| 4 | MEDIUM · `answerMd` XSS | **채택** | 계약 8항: 서버 살균(HTML·링크/이미지 문법·스킴 URL 제거) + 클라이언트 화이트리스트 노드만 React 요소로, 3a 는 링크 렌더 없음, 부정 시험. designer §25·PE 지시문에 전달. |

### 검토하지 못한 범위
- 구현 코드 없음: Prisma WHERE 조건, 캐시 키의 userId 포함, 런타임 JSON 스키마 후검증, 마크다운 렌더러 설정
- 병렬 작업 중: ask@v1 프롬프트 모듈과 회귀 픽스처는 스냅샷에 없음 → 실제 주입 방어 문구 미검증
- 운영 환경: 전역 LLM 큐 스케줄링·rate-limit 저장소의 다중 프로세스 원자성은 실행 검증 불가

### 원본 위치
- **raw 로그**: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261012T074936Z-task-064-C1/raw.txt`
- **결과 JSON**: 위 run_dir의 stdout (codex-result@1 스키마)


## Codex 검토 (C2, 2026-10-12)

### 검토 요약
- **모드**: adversarial-review (security 초점)
- **스냅샷**: 708ebdfc (base: fa328cb)
- **소요**: 141초
- **지적 건수**: 1건 (medium 1)
- **범위**: C1 4건 지적의 구현 방어 재검증 + 새 위험 적대 검토

### C1 4건 지적의 구현 방어 현황
| # | C1 지적 | C2 확인 결과 |
|---|---|---|
| 1 | HIGH · DoS(공용 LLM 슬롯 무한 점유) | ⚠️ 부분: 분당 3·하루 60 제한은 구현됐으나 저장소가 프로세스 메모리(medium 1건 발견) |
| 2 | HIGH · 문서 정본 충돌(D2 범위) | ✅ 해소: learning-personalization 정정, 외부 전송이 정형 요약+채택 교정만 |
| 3 | MEDIUM · 저장형 프롬프트 주입 | ✅ 방어: `sourceKeys` 재검증, `proposals` 종류·길이 필터 확인 |
| 4 | MEDIUM · `answerMd` XSS | ✅ 방어: `sanitizeAskAnswerMd` 살균, React 텍스트 노드만 렌더링 |

### Codex 신규 지적

#### 1️⃣ [MEDIUM] 프로세스 로컬 메모리 한도 저장소 — 재시작·다중 인스턴스에서 제한 우회
- **위치**: `src/modules/conversation/chats/askLimits.ts:43-49` (저장소), 97-108 (검사)
- **조건**: 서버 재시작 또는 blue/green, PM2 등 둘 이상의 애플리케이션 프로세스 동시 ASK 요청
- **근거**: 분당·일일 소비량, 진행/대기 슬롯이 `globalThis.__kaiwaAskLimits` 프로세스 로컬 Map 저장. `admitAskTurn` 은 이 로컬 상태만 검사. 재시작 시 즉시 초기화되고, N개 인스턴스에서는 사용자당 일일 제한과 전역 슬롯 상한이 각각 N배로 적용됨 (예: 2인스턴스 → 일일 120회·전역 슬롯 상한 6개)
- **영향**: 인증된 사용자가 재시작 후 또는 인스턴스를 오가며 일일 60회 제한 초과 가능. 전체 시스템에서 ASK 대기 요청이 2개를 넘어 공용 단일 CLI 큐를 점유해 회화·채팅 턴 지연 또는 서비스 고갈
- **권고**: 분당·일일 소비량과 ASK 진행/대기 슬롯을 MariaDB 또는 공유 원자 저장소(예: Redis)로 옮기고, 사용자별 창 소비 및 전역 슬롯 획득·해제를 원자적으로 처리. 최소한 배포 중 두 인스턴스가 동시에 ASK 요청을 받지 않음을 검증하고, 재시작으로 일일 제한이 초기화되는 위험을 별도로 보완해야 함

### 아래 항목은 구체적 결함 없음 (ㅇ = 확인됨)
- ㅇ **IDOR 방어**: 세션 userId 기반 조회 필터, 6개 함수 WHERE `userId = ?` 확인
- ㅇ **외부 전송 범위(D2)**: 정형 요약+채택 교정만, 대화 원문·원음·`toolLog`·내부 id·이메일 없음
- ㅇ **저장형 프롬프트 주입 경계**: `sourceKeys` ⊆ 제공 키 검증, `proposals` 종류·길이·enum 필터
- ㅇ **XSS 이중 방어**: `sanitizeAskAnswerMd` 살균 통과(Reviewer 39건 적대 입력), React 텍스트 노드 렌더링
- ㅇ **어댑터 변경**: UTF-8 StringDecoder 청크 경계만 보정, 새로운 명령·권한 확대 경로 없음

### 검토하지 못한 범위
- 단위 시험·타입 검사·빌드 (읽기 전용 제약)
- 실제 다중 인스턴스 부하 시험
- 운영 nginx/PM2 요청 분배, 사용자 Export 구현

### 원본 위치
- **run 디렉토리**: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261012T101149Z-task-064-C2`
- **raw.txt**: 위 run_dir의 raw.txt (Codex 실행 요약·JSON)

---
