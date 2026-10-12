---
task_id: task-064
role: developer
part: dev-U (화면 — /ask 목록·질문 방·components/ask)
tags:
  - type/task-record
  - domain/ask
  - domain/ui
aliases:
  - task-064 dev-U
created: 2026-10-12
---

# task-064 — Developer 기록 (dev-U: `/ask` · `/ask/[chatId]` · `src/components/ask/**`)

이력서 본문: [[task-064-ask-anything-3a]] · 구현 가이드 정본 `docs/screens.md` §25 · 계약 `docs/design/api-contract.md` §2-18-A · 승인 데모 `docs/demo/task-064-ask-anything-v2.html`(v2)

## 진행 기록
- [17:15] 착수. 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED` / `task: task-064` (status approved, v2). §25 전체·25-11·25-13, 계약 §2-18-A, 이력서 Leader 결정 두 절 읽음. Leader 추가 결정(L-2 ADD_TOPIC 미구현, L-5 시트 문구 = 데모 문구, L-10 WORD 없음, L-8 실패 답에 「새 답」 없음, L-6/7/9/11) 반영 예정.
- [17:40] **공용 타입 `src/types/ask.ts` 먼저 만듦(dev-S2 import 용)** — `AskScopeKey`·`AskSourceType`(6종, WORD 없음)·`AskConfidence`·`AskIntent`·`AskSource{type,id,date,label}`·`AskScopeOption`·`AskNeedsScope{prompt,options}`·`AskRecords{intent,count}`·`AskMeta{sources,confidence,needsScope,records}`(= #29 `ask` 객체 = `toolLog.ask`)·`AskDoneConversation{answerMd,replyKo:null,…}`(#32 done.conversation)·`AskTurnRequest{text,inputSource:'TEXT',scope?}`·`AskChatMessage`(ChatMessage + `ask?`)·`AskProposalKind`(ADD_WORD·ADD_STUDY_LOG·SET_LEVEL) + 각 enum 배열 상수. `src/types/chat.ts` 는 범위 밖이라 고치지 않음 → 화면은 `ask` 를 메시지 객체의 런타임 칸으로 받아 `askMetaOf(unknown)` 로 검사해 읽는다(§25-3 C 의 `types/chat.ts` 확장 대신).
- 전용 미러 `~/.node-local/thekaiwa-dev064u`(sync + predeploy node_modules `cp -al`, package.json 동일).

## 체크포인트 1 — 순수 모듈·공용 확장 (18:20)
- **완료**: 시험 먼저 작성(`ask/__tests__/{answerMd,logic,askCopy}.test.ts`, `shell/__tests__/askReturn.test.ts`) → 모듈 없음으로 4파일 전부 실패 확인 → 구현: `ask/{askCopy.ts, answerMd.ts, logic.ts, AnswerMarkdown.tsx, ExampleBlock.tsx}`, `shell/askReturn.ts`.
- 공용 확장(기본값 = 지금 동작): `chat/useChatTurn.ts`(`SendOptions.scope`·`TurnDeps.toReply`·`TurnNoticeState.reason/status`·폴링 상수 export) · `chat/labels.ts`(`FailureView.code?` — `turnFailure` 가 코드가 있을 때만 싣는다) · `chat/MessageList.tsx`(`annotate`·`renderFailed`·`renderTrailingPending`·`focusable`+`focusList`) · `chat/Composer.tsx`(`lang`·`inputLabel`·`busyReason`) · `chat/TurnNotice.tsx`(`textOf`·`notFoundLink`) · `chat/ChatMenuSheet.tsx`(ASK 갈래) · `chat/ProposalCard.tsx`(`context`·SET_LEVEL 카드·모르는 kind → 안 그림) · `chat/ChatRoom.tsx`(ASK → `/ask/{id}` replace) · `common/japanese/JapaneseText.tsx`(`DisplayBar keys`) · `shell/routes.ts`(`'/ask/'`) · `shell/correctionsReturn.ts`(`pickBackHref` 5번째 인자 `askRaw` 선택 — 세 기록 중 늦은 쪽, 같으면 계획표→교정 모음→질문 방, `backLabelOf` 「질문으로」).
- 미러 실행: ask·shell·chat·common 시험 **257/257 pass**(기존 correctionsReturn·scrollBoxPosition·japaneseDisplay·labels 포함).
- **§25 와 다르게 한 곳(지금까지)**: ① `types/chat.ts` 대신 `types/ask.ts`(Leader 지시) — `ask` 는 런타임 칸 + `askOf()` 검사 ② 꼬리 대기 말풍선은 `renderPending(null)` 대신 새 슬롯 `renderTrailingPending` — 회화방이 `renderPending` 을 넘기고 있어 null 을 받게 바꾸면 회화방 타입·동작이 바뀐다 ③ 안내 줄 문구 구분에 `TurnNoticeState.status` 를 더함(가이드는 `reason` 만) — 네트워크 문구(ASK 전용 `net`)·409 를 가르려면 status 가 필요 ④ 실패 카드 시간 초과 구분에 `FailureView.code` 를 더함 ⑤ 인용 묶음 안의 빈 `>` 줄은 예문 판정에서 건너뜀(LLM 이 예문 사이에 `>` 빈 줄을 쓰는 경우 대비), 목록 표식은 들여쓰기 깊이와 무관하게 인식(중첩 목록은 평평하게) ⑥ 살균 스킴 목록은 서버 `sanitizeAskAnswerMd` 와 같은 `javascript|data|vbscript|file` + `://` 주소 + `www.`(임의 `scheme:` 전체를 지우면 「N5: …」 같은 글이 사라짐).
- **남은 일**: 화면 부품(SourceList·ScopeChips·AskPending·AskFailed·AskQuestionBubble·AskAnswer·ScopeNoticeSheet·useScopeNoticeGate·AskRoom·AskComposerCard·AskExamples·AskListItem·AskHome·AskHomeSkeleton) → 라우트 3개 → 구조 시험(⑯⑰) → tsc·eslint·전체 시험·build → 변이 확인.
- **미커밋 파일**: 위 전부 + `src/types/ask.ts`.
