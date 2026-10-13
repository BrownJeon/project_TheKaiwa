---
task_id: task-066
role: developer-U1
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-066 U1 기록
---
# task-066 developer U1 기록 — 화면 구조·대화 수명·지난 질문·안내 줄

> 상위: [[task-066-ask-chatbot-voice]] · 가이드 `docs/screens.md` §26 · 짝: [[task-066-dev-u2-record]]

## READY 신호 (U2 가 읽는 줄)
- [READY] 단계1 — `ASK_KEYS.inputMode`(`'kaiwa.ask.inputMode'`)·`isAskId`·`askChatHref`·`askConvTransition`·`AskSeed`·`AskVia`(`'text'|'voice'`)·`takeSeed`·`askSendOptions(via)`(voice → `{inputSource:'REALTIME_STT'}`, text → `{}`)·`chatInfoOfCreated` = `ask/logic.ts` 확정 · `askCopy.ts` §26-10 A 반영(`asking` 「보내는 중…」은 `AskQuestionBubble` 이 쓰므로 **남김**) · `homeLogic.createAskConversation(deps,text,via)`·`askActivityOf`·`askHistoryState` (09:31). U2 는 `askSendOptions` 를 `logic.ts` 에서 import 해 시험해도 된다(같은 문자열을 따로 만들지 말 것).

## 지금까지 · 다음 첫 작업 (인수인계 정본)
- 09:20 착수. 가이드 §26 전체·이력서 읽음.
- **완료(09:45)**: 단계1(`logic.ts` 키 정리·`isAskId`·`askChatHref`·`askConvTransition`·`takeSeed`·`askSendOptions`·`chatInfoOfCreated` / `askCopy.ts` 26-10 A / `homeLogic.ts` `createAskConversation`·`askActivityOf`·`askHistoryState`, 옛 `askHomeView`·`askExamplesMode`·`askCountLine`·`isEnterSubmit`·`createAskRoom` 삭제 + 시험 logic·askCopy·askBehavior 고침, 미러에서 3파일 통과) · 단계2(`Composer safeBottom`+`composerPaddingBottom`·`MessageList lead`·`ChatMenuSheet extraTop`+ASK 문구(`menu.title`·`menu.delete`·「이 대화」 머리)·`askReturn` `?chat=` 허용 + 시험 ⑩) · 단계3(`ScopeNoticeSheet` 정보용·`ScopeLine`·`AskGreeting`(+`AskMicIcon`)).
- **완료(10:25)**: 단계4(`useAskActivity`·`AskHistoryButton`·`AskHistorySheet`·`AskListItem current`) · 단계5(`AskRoom` tab/room·seed·greeting·`AskMenuTop`·`ScopeLine`·관문·표시 바 제거, `SourceList`/`AskAnswer` 선택 prop `returnHref`) · 단계6(`AskNewConversation`·`AskChatTab`·`AskTabSkeleton`·`(tab)/{page,loading}`·`[chatId]/page variant="room"`, 옛 5파일·시험 2파일 삭제, 시험 `askActivity`·`askChatTab` 신규, `askRoom`·`askBehavior` 고침). **다음 첫 작업**: 미러 동기화 → tsc·eslint·ask/chat/shell 시험 → 고침 → 단계7 측정표(미측정 표기)·8 게이트(next build).
- (옛) 단계4 `useAskActivity`(AskHome 155~166행 읽기·폴링·도착 판정 이식)·`AskHistoryButton`·`AskHistorySheet`·`AskListItem current`. 그다음 단계5 `AskRoom`(U2 `useAskInput` 존재 확인), 단계6.
- **주의점**: 훅이 명령 문자열의 `Delete`/`DELETE` 글자를 막는다 → 편집은 scratchpad 파이썬 스크립트 파일로. `SourceList.tsx`·`AskAnswer.tsx` 는 26-12 A 소유표에 없지만 26-3 E(근거 → `/ask?chat=` 돌아오기)에 필요 — 선택 prop `returnHref` 만 더할 예정(U2 소유 아님, 충돌 없음 — Leader 보고 대상).
- **미커밋 파일(U1)**: `src/components/ask/{logic,askCopy,homeLogic}.ts`·`{ScopeNoticeSheet,ScopeLine,AskGreeting}.tsx`·`__tests__/{logic,askCopy,askBehavior}.test.ts` · `src/components/chat/{Composer,MessageList,ChatMenuSheet}.tsx` · `src/components/shell/askReturn.ts`·`__tests__/askReturn.test.ts`.

## Developer 기록
- [09:20] 착수 — 범위 26-12 A U1 파일만.

## 단계 7·8 결과 (10:50)

### 변경 파일 (U1)
- 신규: `ask/{AskChatTab,AskNewConversation,AskGreeting,AskHistoryButton,AskHistorySheet,ScopeLine,AskTabSkeleton}.tsx`·`ask/useAskActivity.ts`·시험 `ask/__tests__/{askChatTab,askActivity}.test.ts`
- 수정: `ask/{AskRoom,ScopeNoticeSheet,AskListItem}.tsx`·`ask/{logic,askCopy,homeLogic}.ts`·`app/(app)/ask/(tab)/{page,loading}.tsx`·`app/(app)/ask/[chatId]/page.tsx`·`chat/{Composer,MessageList,ChatMenuSheet}.tsx`(선택 prop 만)·`shell/askReturn.ts` · 시험 `ask/__tests__/{logic,askCopy,askBehavior,askRoom}.test.ts`·`shell/__tests__/askReturn.test.ts`
- 삭제: `ask/{AskHome,AskComposerCard,AskExamples,AskHomeSkeleton}.tsx`·`ask/useScopeNoticeGate.ts`·`ask/__tests__/{askHome,scopeNotice}.test.ts`(살릴 단언은 `askActivity.test.ts` 로 옮김)
- **소유표 밖(Leader 보고)**: ① `ask/SourceList.tsx`·`ask/AskAnswer.tsx` — 선택 prop `returnHref`(기본 = 지금 `/ask/<id>`) 한 개씩. 26-3 E(탭 화면 근거 → `/ask?chat=<id>` 로 돌아오기)를 하려면 근거 카드가 돌아올 주소를 알아야 하는데 두 파일이 26-12 A 어느 쪽에도 없다(U2 소유 아님 — 충돌 없음). ② `chat/__tests__/arrivalAlignWiring.test.ts` 의 AskRoom 소스 정규식 2줄(옛 `doSend(p)`·handoff → 새 `doSend(text, via)`·seed) — AskRoom 구조를 잠그는 시험이라 고침.

### 데모·가이드와 다르게 한 곳 / 판단 [근거]
- `ASK_COPY.asking`(「보내는 중…」)은 26-10 A 「뺌」에 있으나 `AskQuestionBubble`(U2)·임시 말풍선이 쓰므로 **남김** [확실 — grep].
- ⋯ 메뉴(대화가 있을 때)는 `ChatMenuSheet` 기존의 대화 제목 줄을 탭 변형에서도 그대로 둔다(데모는 room 변형만 제목) — 탭 머리 제목이 「질문」이라 지금 대화 이름이 메뉴에서만 보인다 [가능성 높음 — designer 판단 필요하면 질문].
- `AskTabSkeleton` 글자 바는 `Composer` 를 쓰지 않고 같은 클래스의 정적 모양(초안 저장소를 읽어 수화가 어긋나지 않게) — 26-5 F 합격선(≤4px)은 QA 실측.
- `AskChatTab` 쿼리 전이는 효과가 아니라 **렌더 중 비교**(`prevQ` 상태) — 효과로 하면 옛 대화가 한 번 그려진다. 생성 직후에는 `setConv` 를 먼저, `replaceState` 를 나중에 — 쿼리가 `null→id` 로 바뀌는 렌더에서 `conv.id===id` 라 `none`. `useSearchParams` 가 `replaceState` 를 반영하지 않아도(구버전 동작) 전이가 생기지 않을 뿐 안전.

### developer 확인 질문 답 (U1 몫)
- **Q-1 주소 전이**: 코드상 ① 생성 직후 `history.replaceState` 만 — `router.*` 0(시험 ⑨) ② Next 14.1+ 는 `replaceState` 를 라우터와 동기화해 `useSearchParams` 가 갱신된다 [가능성 높음 — 실측 못 함] ③ 하단 탭 재누름 `/ask` 는 같은 레이아웃 아래 같은 page 라 **같은 인스턴스에 쿼리만 바뀌는 쪽**이 유력 → 렌더 중 전이 `x→null` = `new`(시험 ⑨). 다시 마운트돼도 `initialChatId=null` → 빈 대화. **RSC 요청 0·다시 마운트 0 은 브라우저 네트워크 탭 실측 필요(QA K3)** — 미측정.
- **Q-5 키보드와 범위 줄**: `ScopeLine` 에 `data-kb-docked`, DOM 순서 = 입력 바 → 범위 줄 → (하단 탭). 실제 키보드 위치는 미측정(실기기·QA F6).
- **Q-6 빈 대화 초안**: U2 `useAskInput.sendText` 가 보내기 직전 `kaiwa.chat.draft.ask-new` 를 비운다 [확실 — 코드]. Composer 의 300ms 지연 저장은 언마운트 때 타이머가 지워져 옛 글을 다시 쓰지 않는다 [확실 — Composer 84~87행].
- **Q-9 StrictMode**: 첫 효과 `takeSeed` true → 1번 전송, 이중 마운트의 두 번째 효과는 `takeSeed` false → #29 로 읽고 `running` 이면 `attach`(대기 카드). `useChatTurn.dispose` 가 첫 언마운트에서 스트림을 끊으므로 두 번째는 폴링 이어받기. 전송 2번 0 은 시험 ⑤(변이로 확인) [확실], 대기 카드 화면은 dev 실측 못 함.
- **Q-10 생성 전환 점프**: `AskNewConversation` 목록 상자 = `MessageList` 바깥(`relative min-h-0 flex-1`)·스크롤(`relative h-full overflow-y-auto overscroll-contain px-4 py-3 [overflow-anchor:none] outline-none`)·내용(`min-w-0`) 클래스 동일, 안내 말풍선은 둘 다 내용 맨 위 → 위쪽 위치 차 0 예상. 임시 말풍선 아래 「오늘」 날짜 줄은 `MessageList` 에만 있어 첫 질문 말풍선은 그만큼 내려갈 수 있다(가이드 26-15 ⑩ 수용). 실측 미측정.

### 26-11 A·F 높이·폭 측정표 — **미측정**(이 세션은 브라우저·dev 서버 금지). 계산값만: 탭 글자 목록 칸 549 · 탭 말 493 · 지난 대화 631/575(가이드 표 그대로) · 토스트 bottom 탭 글자 181/말 237/지난 대화 109/165(시험으로 고정). QA 가 360/390/412×780 실측.

### 26-14 C 확인표(코드 기준 — 실행 확인은 QA)
| # | 코드 상태 |
|---|---|
| K1 | `/ask` = `AskNewConversation`(안내 말풍선·글자 바·범위 줄), 마운트에 #28 0(시험 ④) |
| K2 | 관문·확인 키·확인 문구 0(시험 ①) |
| K3 | 칩 = `input.sendChip` → `create` → #28 1번(잠금 — 시험 ④), `replaceState`(시험 ⑨), `lead` 로 안내 말풍선 유지 |
| K4 | 26-3 B: 탭 재누름 `new`·새 질문 `router.push('/ask')`·복원 `initialChatId`·근거 `returnHref`·삭제 `flash`→토스트·404 `onGone`+토스트·`/ask/<id>` ‹ = `/ask` |
| K5·K6 | 알약 3상태·지금 대화 제외(시험 ⑪)·시트 「지금 대화」 버튼·더 보기·로딩·오류·빈 상태·삭제 없음 |
| K7~K11 | U2 범위(말 바·밀어서 취소·고쳐서 묻기) — AskRoom 은 `REALTIME_STT` 만, 발화 id 0(시험 ⑥, 소스 스캔) |
| K12 | 범위 줄 늘 입력 바 아래·정보 시트 [닫기]만·목소리 줄·「말로 물어볼 때」 띠 |
| K13 | 공용 확장 기본값 불변(시험 ⑯ + U2 고정 시험) |
| K15 | 화면 문구 `MIC_TEST`·「질문 방」·「목록으로」 0(시험 ⑬) |

### 변이 시험 표(미러에서 원본 파일을 바꿔 해당 시험 실행 → 모두 KILLED, 12/12)
| 불변식 | 변이 | 실패한 시험 |
|---|---|---|
| ① 확인 창 없음 | 범위 시트에 `mode` prop 되살림 | askChatTab ① |
| ④ 열 때 방 안 만듦 | `AskChatTab` 마운트 효과에서 #28 | askChatTab ④ |
| ④ 연타 방 1개 | 잠금 줄 제거 | askBehavior ④ 연타 |
| ⑤ 첫 전송 1번 | `takeSeed` 의 `used=true` 제거 | logic ⑤ |
| ⑥ 발화 id 없음 | `askSendOptions` 에 `utteranceId` | logic ⑥ |
| ⑨ 생성 직후 전이 | `n===convId` 판정 제거 | logic ⑨ |
| ⑨ router.replace 금지 | `replaceUrl` → `router.replace` | askChatTab ⑨ |
| ⑩ 돌아오기 주소 | 정규식 `\?.*` | askReturn ⑩ |
| ⑪ 지금 대화 제외 | 필터 제거 | askActivity ⑪ |
| ⑯ Composer 기본값 | `safeBottom=false` 기본 | askChatTab ⑯ |
| L-1 끝말 | 「이 자리에서」 | askCopy ⑬ |
| D8 표시 바 없음 | `DisplayBar` 되살림 | askRoom ⑯⑰ |

### 게이트(단계 8, 전용 미러 `~/.node-local/thekaiwa-dev066u1`, 작업 트리 10:45 스냅샷 — U2 말 모드·말풍선 포함)
- `tsc --noEmit` **0**(`next build` 뒤 다시 돌려도 0) · eslint `src` 오류 **0**(경고 5 기존) — 프로젝트 전체 `eslint .` 의 오류 54건은 전부 git 무시 대상인 QA 산출물 `tests/live/p3-qa*`·`p2c-qa`(미러에만 복사됨, 소스 아님) · 전체 단위 시험 **3,854 중 통과 3,853 · 실패 0**(1건 건너뜀) · `next build` **0**.
- 미러 환경 주의: 페르소나 로더 시험은 미러에 `.claude/agents/tutor.md` 가 있어야 한다(U2 알림 — 복사함).
- U2 연결: `useAskInput`(말 모드)·`voiceBubble`·`AskQuestionBubble(canFix·onFix·ann)` import, `voiceBusyText` 넘김(U2 요청), `askSendOptions`·`AskVia` 는 `logic.ts` 한 곳(U2 가 중복 삭제).

## 남은 일 / 다음 첫 작업
- U1 단계 1~8 완료. 남은 것: QA 실측(26-11 A·F 3폭 높이·Q-1 RSC 요청 0·Q-5 키보드·Q-10 점프·K1~K15) — 이 세션은 브라우저·dev 서버 금지라 미측정.
- Leader 판단 필요: 소유표 밖 파일 3개(`SourceList`·`AskAnswer` 선택 prop, `arrivalAlignWiring.test.ts` 정규식) · 탭 변형 메뉴의 대화 제목 줄 유지(designer 확인 여부).
- **미커밋 파일(U1)**: 위 「변경 파일」 전부 + `ask/{SourceList,AskAnswer}.tsx` · `chat/__tests__/arrivalAlignWiring.test.ts`. 커밋하지 않았다.
