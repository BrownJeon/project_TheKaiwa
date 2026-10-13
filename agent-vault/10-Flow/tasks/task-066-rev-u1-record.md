---
tags:
  - type/review
  - domain/ask
task: task-066
reviewer: REV-066-U1 (화면 구조·대화 수명 — U1 몫)
status: 중간 (감사 진행 중)
---
# REV-066-U1 — task-066 U1 화면 구조·대화 수명 독립 감사

대상: §26 U1 몫 파일(`AskChatTab`·`AskNewConversation`·`AskGreeting`·`AskHistoryButton`·`AskHistorySheet`·`useAskActivity`·`ScopeLine`·`AskTabSkeleton`·`AskRoom`·`ScopeNoticeSheet`·`AskListItem`·`askCopy`·`logic`·`homeLogic`·`(tab)/{page,loading}`·`[chatId]/page`·공용 `Composer`·`MessageList`·`ChatMenuSheet`·`askReturn`). 개발자 기록 [[task-066-dev-u1-record]]. 검증은 전용 미러 `~/.node-local/thekaiwa-dev066u1` 에서만(시작 시 `diff -rq src tests` 0 확인). 작업 트리·docs 수정 0.

## 중간 기록 (턴 ≈18)
- 읽음: §26 전체, 이력서 결정, U1 기록, 라우트 3개, `AskChatTab`·`AskNewConversation`·`AskRoom`·`useAskActivity`·`homeLogic`·`logic`·`AskHistory*`.
- 미러 `src` 는 작업 트리와 동일(차이 0).
- 후보 발견 R-1 (Medium 후보): `useAskActivity.settle()` 이 **지금 대화를 제외하지 않고** 도착 판정 — 이 화면에서 바로 지켜보는 대화의 답이 끝나도(폴링이 돌고 있었다면) 토스트 「답이 도착했어요」 + `kaiwa.ask.newAnswer` 에 지금 대화 id 가 남아 나중에 「새 답 도착」 알약이 거짓으로 뜬다. 근거 `useAskActivity.ts` `settle`(전체 `items`) vs `askActivityOf`(개수 세기만 제외). 확정 증명 대기.
- 다음에 볼 항목: replaceState 가정(Next 16 소스), 공용 부품 불변 대조, 삭제 정리 grep, 프라이버시 문구, 스켈레톤, 변이.

## 중간 기록 2 (턴 ≈33) — replaceState 가정 확인 결과: **개발자 가정이 틀렸다**
- F1 (HIGH, 확정): `AskChatTab.tsx:26` `window.history.replaceState(window.history.state, '', u)`. Next 16.3.2 가 패치한 `replaceState`(`node_modules/next/dist/client/components/app-router.js:268-279`)는 `if (data?.__NA || data?._N) return originalReplaceState(...)`(`:271-273`)로 **라우터 동기화(`applyUrlFromHistoryPushReplace` → `ACTION_RESTORE`)를 건너뛴다.** Next 자신이 history.state 에 `__NA:true` 를 심는다(`HistoryUpdater` `:54-57`). 그래서 `window.history.state` 를 data 로 넘기면 브라우저 주소만 바뀌고 `useSearchParams()` 는 `null` 그대로. `null` 을 넘기면 동기화된다(Next 문서 `single-page-applications.md:548-563` 예시도 `null`). 실제 dist 원문을 잘라 실행한 시뮬레이션(scratchpad `sim_replace.js`): data=`history.state` → applied [] / data=`null` → applied [`/ask?chat=abc`].
  - 영향(탭 변형 `AskRoom` 안): ① 하단 탭 「질문」 재누름 = `Link /ask` → 라우터 canonical 이 이미 `/ask` 라 q 변화 없음 → 새 빈 대화 안 열림(26-3 B 2행·D1=B 핵심) ② ⋯ 「새 질문 시작」 `router.push('/ask')`(AskChatTab:126) 같은 이유로 무반응 ③ 삭제 `ChatMenuSheet.remove` 가 `router.replace('/ask')` 후 `setBusy(false)` 를 부르지 않음(`ChatMenuSheet.tsx:~100-104`) → 화면이 안 바뀌면 시트가 `busy`(닫을 수 없음, `dismissible={!busy}`)로 잠기고 토스트도 안 뜸 ④ `flash` 토스트 효과는 `[show, q]` 의존이라 q 가 안 변하면 안 돌아감. 복원(`/ask?chat=` 새로 마운트)·근거 돌아오기·`/ask/<id>` 갈래는 영향 없음(실제 내비게이션).
  - 시험은 소스 문자열(`router.replace` 금지)만 잠가 이 결함을 못 잡는다(askChatTab ⑨).
- F2 (후보 Medium): `useAskActivity.settle()` 지금 대화 미제외(위 R-1). 아직 재현 증명 전.

## 중간 기록 3 (턴 ≈45)
- 공용 부품 불변 — 직접 대조 완료: 미러에 HEAD 판(`git show HEAD:`)을 `ComposerHEAD/MessageListHEAD/ChatMenuSheetHEAD.tsx` 로 나란히 두고 `renderToStaticMarkup` 비교(시험 파일 `zzRevCompare.test.ts`, 끝에 제거): Composer 9상태(idle·busy·busyReason·ko·leading·blocked·placeholder·onTextChange·다른 chatId) / MessageList 11상태(빈·custom intro·두 메시지·꼬리 대기·진행 중·실패·tail·hasOlder·ask 옵션 묶음·여러 날) / ChatMenuSheet TALK·CHAT × turnBusy × extra 8건 — **전부 HEAD 와 바이트 동일**. 기본 `safeBottom` 마크업 `padding-bottom:max(8px, var(--safe-bottom))` 확인.
- 기존 시험(ask·chat·shell `__tests__`) 미러 실행 335 중 통과 335·실패 0.
- 삭제 정리: 삭제 5파일·시험 2개 참조 grep = 주석 2 + 부정 단언뿐(import 0). 옛 키 `scopeNotice.v1`·`pending`·`draft`·`takeAskHandoff` 읽기 0.
- 프라이버시/경계: 화면 문구에 엔진명·`MIC_TEST`·「질문 방」 0(`MIC_TEST` 는 `useAskInput.tsx:157` 코드 값뿐), `fetch(`/`window.Capacitor`/spawn 0, `dangerouslySetInnerHTML` 0, 범위 시트·줄 문구 26-10 A 원문과 일치, 대기 안내 L-1 문구 일치. 초안 키 `kaiwa.chat.draft.ask-new`(sessionStorage) — 보낼 때 `useAskInput.sendText` 가 먼저 비움(`:222`).

## 중간 기록 4 (턴 ≈58) — 변이 21건·tsc·eslint
- 미러(`~/.node-local/thekaiwa-dev066u1`, 소스 사본에서만 변이, 매번 원복 — 끝에 `diff -rq src` 0 확인): tsc `--noEmit --incremental false` **0**, eslint(U1 파일+라우트) **0**.
- 변이 21건 — 잡힘 15 · 생존 6:
  | # | 변이 | 결과 |
  |---|---|---|
  | M1a | 관문 재도입(금지어 포함) | 잡힘(① 소스 스캔) |
  | M1b | 관문 재도입(금지어 없이 `setScopeOpen(true); return`) | **생존** — 시험 공백(① 은 문구 스캔뿐) |
  | M2a | 열 때 방 생성(블록 효과) | 잡힘(④) |
  | M2b | 열 때 방 생성(한 줄 효과 `useEffect(() => void apiPost(...), [])`) | **생존** — 시험 공백(④ 정규식이 `\n  }, [` 모양 의존) |
  | M3 | AskRoom 효과 `takeSeed(s) && s` → `s` | 잡힘(⑤ 배선 2건) |
  | M4 | `replaceUrl` → `router.push` | 잡힘(⑨) |
  | M5 | `ASK_HREF` 를 `\?.*` 로 | 잡힘(⑩) |
  | M5b | `serializeAskReturn` 의 `isAskHref` 검사 제거 | 잡힘(3건) |
  | M6 | `isAskId` 형식 검사 제거 | 잡힘(⑨) |
  | M7 | 알약 우선순위 반전 | 잡힘(⑪) |
  | M8 | ASK 삭제 뒤 `router.replace('/ask')` 제거 | **생존** — 시험 공백(삭제 뒤 이동 미고정) |
  | M9 | 대기 안내 옛 문구 복원 | 잡힘(⑬ 2건) |
  | M10a | `Composer safeBottom` 기본 false | 잡힘(⑯) |
  | M10b | `MessageList lead` 기본 요소 | 잡힘(⑯) |
  | M11a | 폴링 cleanup 의 `stop()` 제거 | **생존** — 시험 공백(정리 미고정) |
  | M11b | `visibilitychange` 해제 제거 | **생존** — 시험 공백 |
  | M12 | `askActivityOf` 지금 대화 제외 제거 | 잡힘(⑪) |
  | M13 | `askConvTransition` 의 `n===convId→none` 제거 | 잡힘(⑨) |
  | M14 | `onGone` 의 `startNew()` 제거 | **생존** — 시험 공백(404 뒤 빈 대화 전환 미고정) |
  | M15 | **F1 수정안** `replaceState(window.history.state…)` → `(null…)` | **시험 ⑨ 가 실패** — 시험이 결함 있는 호출 모양을 문자열로 고정해 올바른 수정을 막는다 |
  | M16 | `settleArrivals` 토스트를 `fromPolling.length>0` 로 | 잡힘(⑫) |
- 생존 6건은 모두 동등 변이가 아니라 시험 공백(DOM 시험 도구가 없어 소스 스캔·순수 함수로만 잠그는 한계). 실제 결함(F1·F2)도 이 공백 때문에 시험을 통과했다.
