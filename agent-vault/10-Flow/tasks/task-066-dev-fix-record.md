---
task_id: task-066
role: developer-FIX
tags:
  - type/task-record
  - domain/ask
  - domain/speech
aliases:
  - task-066 감사 수정 기록
---
# task-066 developer FIX 기록 — 독립 감사(REV-066-U1·U2·S1) 결함 수정과 시험 보강

> 상위: [[task-066-ask-chatbot-voice]] · 감사 [[task-066-rev-u1-record]] · [[task-066-rev-u2-record]] · [[task-066-rev-s1-record]] · 구현 [[task-066-dev-u1-record]] · [[task-066-dev-u2-record]]

## 수정한 파일 목록 (커밋하지 않음 — 작업 트리 미커밋)
- 소스(`src/components/ask/`): `logic.ts`(+`replaceAskUrl`) · `homeLogic.ts`(+`planArrivals`) · `AskChatTab.tsx` · `useAskActivity.ts` · `voiceView.ts`(+`ASK_INPUT_MODE_SERVER`·`askModeOf`·`askShowSttAlert`·`AskInputMode`) · `useAskInput.tsx`(규칙을 컨트롤러로 위임) · **새** `askInputControl.ts`
- 소스(공용 음성): `src/components/speech/PushToTalkButton.tsx`(`cancelOutside` 일 때만)
- 시험: `ask/__tests__/{askChatTab,askActivity,askVoice}.test.ts` 고침·보강 · **새** `ask/__tests__/{askInputControl.test.ts, astCode.ts(시험 도구)}` · `speech/__tests__/pttCancelOutside.test.ts` · `src/modules/conversation/__tests__/askTurn.test.ts`(시험 1건만)
- 건드리지 않음: 서버 소스(`src/modules/**` 소스·`src/app/api/**`)·`docs`·`prisma`·`ChatMenuSheet.tsx`(아래 항목 1 ③ 근거)·`useAskInput` 밖의 U2 화면 부품.
- 검증 미러: `~/.node-local/thekaiwa-dev066f`(스크래치 `fsync.sh` 로 동기화, 변이 스크립트 `ffmut.py`, 시뮬레이션 `sim_replace.js`·`sim_after.ts`).

## 게이트 (미러 = 작업 트리, 끝에 `diff -rq src tests` 0 · `*.orig`/`*.rej`/`.mutbak` 0)
- `tsc --noEmit --incremental false` **exit 0** · eslint(`components/ask` 전체 + 바꾼 공용 파일·시험) **오류 0·경고 0**
- 단위 시험 `components/{ask,chat,talk,speech,shell,lesson}` + `modules/conversation` **1,797 중 1,797 통과** · 나머지 `components`·`app`·`modules/infra`·`types` **1,032 중 1,030 통과·0 실패·2 건너뜀(기존)**. 합계 2,829 중 실패 0.
- 실제 `claude` 실행 0회 · 운영/dev 서버 포트·gateway·DB 쓰기·`npm run build`/`dev` 미사용 · `DATABASE_URL=…invalid`.

## 항목 1 [F1 High] `replaceState` 수정 — 처리됨
- **전/후 시뮬레이션** [확실 — 직접 실행, Next 16.3.2 `app-router.js` 원문을 잘라 실행]:
  - 전(감사 `sim_replace.js`): `data = window.history.state` → `applied: []`(라우터 동기화 없음) / `data = null` → `applied: ["/ask?chat=abc"]`.
  - 후(`sim_after.ts` — 실제 `replaceAskUrl` 을 그 위에 올림): 수정 전 모양 `applied: []` · **수정 뒤 `replaceAskUrl(window.history, u)` → `applied: ["/ask?chat=abc"]`**, 원본 `replaceState` 에는 Next 내부 state 가 복사된 객체가 간다.
  - 전제 확인: 패치 `replaceState` 는 `data?.__NA || data?._N` 이면 동기화를 건너뛰고(`:268-279`), `HistoryUpdater` 가 history.state 에 `__NA: true` 를 심는다(`:54-57`) — 둘 다 직접 읽음. `applyUrlFromHistoryPushReplace` 는 `startTransition` 안에서 `ACTION_RESTORE` 를 보낸다(`:237-247`) → 기본 차선인 `setConv` 가 먼저, 주소 갱신은 그 뒤 렌더 [가능성 높음 — 실브라우저 미측정].
- **고친 것**: `logic.ts` 의 주입형 순수 도우미 `replaceAskUrl(h, url)` = `h.replaceState(null, '', url)`. `AskChatTab.replaceUrl` 은 `replaceAskUrl(window.history, u)` 만 부른다(직접 `history.replaceState`/`history.state` 0).
- **시험**: `askChatTab.test.ts` ⑨ 를 「결함 있는 호출 모양을 문자열로 고정」에서 「`replaceAskUrl` 한 곳만, 직접 history 호출 금지, `router.replace` 금지」로 고침(`router.push('/ask')` 는 새 질문에만) · **행동 시험** `F1 replaceAskUrl`(Next 의 `__NA/_N` 규칙 모델 위에서 첫 인자 `null`·세 번째 인자 기대 주소·동기화 1회, 대조군으로 옛 모양은 동기화 0) · `F1 전제`(설치된 Next 소스에 같은 규칙이 있는지 — 바뀌면 실패해 가정을 다시 확인하게 함; node_modules 가 없으면 건너뜀).
- **영향 4가지가 풀리는지 코드로 따라간 결과**:
  1. **하단 탭 「질문」 재누름** — 수정 전: 라우터의 현재 주소가 계속 `/ask` 라 `Link href="/ask"` 가 같은 주소로 보여 아무 일도 없었다. 수정 뒤: 생성 직후 라우터 주소가 `/ask?chat=<id>` 로 동기화 → `/ask` 로의 이동이 실제 이동이 된다 → 쿼리 `chat: id → null` 이면 `askConvTransition(id, null, conv.id)` = `'new'`(시험 `logic ⑨`), 페이지가 다시 마운트되면 `initialChatId=null` 로 빈 대화. 둘 중 어느 쪽이든 새 빈 대화. [코드 추적 — 실브라우저는 QA]
  2. **⋯ 「새 질문 시작」** — `onNewConversation={() => router.push('/ask')}` 가 같은 이유로 수정 전엔 무반응, 수정 뒤 ① 과 같은 이동.
  3. **삭제 뒤 이동** — `ChatMenuSheet.remove`(ASK) = 표지 `flash='deleted'` → `router.replace('/ask')`. 수정 뒤 라우터 주소가 `/ask?chat=<id>` 라 실제 이동이 되고 `AskRoom`(시트 포함)이 사라지므로 `busy` 로 잠긴 시트도 함께 없어진다. **`ChatMenuSheet` 방어는 넣지 않았다**: 수정 뒤 「화면이 안 바뀌는」 경로를 찾지 못했다 — 방(tab) 은 늘 `?chat=` 주소를 갖고(생성 직후 동기화·복원은 서버가 준 주소), 방(room) 은 `/ask/<id>` 라 `/ask` 가 다른 경로다. 남는 가능성은 `router.replace` 가 끝없이 안 끝나는 경우뿐인데 Next 는 요청 실패 시 하드 이동으로 떨어진다. 공용 `ChatMenuSheet`(기본 동작 한 글자 불변이 조건)에 닫기 방어를 더하면 정상 경로에서 시트가 먼저 닫히며 깜빡이는 쪽의 손해가 크다고 판단했다 [가능성 높음]. QA 가 삭제 직후 네트워크를 끊는 시나리오로 확인(아래).
  4. **`flash` 토스트** — 효과 `[show, q]` 가 `q` 가 `id → null` 로 바뀔 때(또는 마운트 때) 다시 돌아 표지를 읽고 지운다. 수정 전엔 이 화면에서 만든 대화는 `q` 가 `null` 그대로라 효과가 안 돌았다. 수정 뒤 정상.
  - 부작용 검토: 생성 직후 `q: null → id` 는 `askConvTransition(null, id, conv.id=id)` = `'none'`(상태 먼저·주소 나중 순서를 정규식 시험이 고정) · 404 `onGone` 의 `replaceUrl('/ask')` 로 `q: id → null` 은 `startNew()` 로 이미 빈 대화라 `'none'`(시험 `('c1', null, null) → none`) · `onLoadFailed` 는 주소를 안 바꾸고 빈 대화로.

## 항목 2 [F2 Medium] `useAskActivity.settle` 이 지금 대화를 안 뺌 — 처리됨
- **증거(재현 논리)**: 수정 전 `settle` 은 목록 전체 `items` 로 `arrivedTransitions` 를 불렀다. 지금 보는 대화 A 가 폴링 중 `running → done` 이 되면 `fromPolling=[A]` → #29 성공 확인 → `kaiwa.ask.newAnswer` 에 A 기록 + 토스트 「답이 도착했어요」. `AskRoom` 은 A 에 **들어올 때만** `newAnswer` 에서 A 를 지우므로, 새 질문으로 나간 뒤 알약이 거짓으로 「새 답」을 말한다.
- **고친 것**: `homeLogic.planArrivals(prevRunning, items, waiting, currentId)` = `arrivedTransitions` 에 지금 대화를 뺀 목록을 넘김(`askActivityOf` 와 같은 기준). `useAskActivity.settle` 이 그것을 부른다(`arrivedTransitions` 직접 호출 0).
- **시험**: `askActivity.test.ts` `F2 planArrivals`(지금 대화만 `running→done` → 토스트·새 답 0 / 지금 대화+다른 대화 → 다른 대화만 새 답+토스트 / 지금 대화가 `waiting` 이어도 제외 / `currentId=null` 이면 제외 없음 / `askActivityOf` 와 같은 기준) · `F2 배선`(AST: `planArrivals` 인자 4개·4번째 `currentChatId`·`arrivedTransitions` 직접 호출 0).

## 항목 3 [REV-U1 변이 생존 6건] 시험을 모양에 덜 의존하게 다시 씀 — 6/6 잡힘으로 바뀜
도구: 새 `ask/__tests__/astCode.ts`(주석을 걷어 낸 소스를 TypeScript 구문 트리로 읽어 「어디서 무엇을 부르는가」를 본다 — 한 줄 효과·줄바꿈·이름 모양에 안 기댐).
| 감사 변이 | 새 시험(askChatTab/askActivity) | 이번 재실행 결과 |
|---|---|---|
| M1b 관문 재도입(금지어 없이 `setScopeOpen(true); return`) | `① 보내기 경로는 범위 시트를 열지 않는다` — `setScopeOpen(비-false)` 의 주인(JSX 속성/변수 이름)이 `onOpen`·`onScope`·`openScopeFromMenu` 뿐 | **KILLED** |
| M2b 열 때 방 생성(한 줄 효과) | `④` — 4개 파일의 **모든 효과 콜백** 본문에 `apiPost`·`createChat`·`createAskConversation`·`create`·`onCreated`·`sendChip`·`onSend` 0 + `apiPost` 는 `createChat` 안 1곳, `createAskConversation` 은 `create` 안 1곳, `create` 이름은 선언+`onSend: create` 뿐 | **KILLED** (M2c: 효과에서 `create()` 호출도 KILLED) |
| M8 ASK 삭제 뒤 `router.replace('/ask')` 제거 | `삭제 뒤 이동` — `ChatMenuSheet.remove` 안에 `if (ask)` 아래 `router.replace('/ask')` + `writeStore(flash,'deleted')`(표지 먼저) + TALK·CHAT 이동 유지 | **KILLED** |
| M11a 폴링 cleanup 의 `stop()` 제거 | `폴링 정리` — 폴링 효과의 정리 함수에 `cancelled = true`·`stop()` 1회·`clearTimeout(holdTimer)`·`removeEventListener('visibilitychange', onVis)` | **KILLED** |
| M11b `visibilitychange` 해제 제거 | 같은 시험 + 파일 전체 add/remove 짝 | **KILLED** |
| M14 `onGone` 의 `startNew()` 제거 | `대화 없음(404)·불러오기 실패` — `onGone` 호출 순서 `[replaceUrl('/ask'), toast.show(goneToast), startNew()]` · `onLoadFailed` `[setFailed(conv.id), startNew()]` | **KILLED** |

## 항목 4 [REV-S1 F-2] 서버 시험 — 처리됨
`askTurn.test.ts` 에 `REV-S1 F-2 askInputKindOf`: `REALTIME_STT → VOICE`, `TEXT`·`SERVER_STT`·`null`·`undefined → TEXT`(이미 export 된 함수라 직접 단언 — 서버 소스 수정 0). 변이 「TEXT 아니면 VOICE」 **KILLED**.

## 항목 5 [REV-U2 F-2 Low] `PushToTalkButton` — 처리됨(둘 다 고침, `cancelOutside` 가 있을 때만)
- ① `onPointerDown`: 남은 「밖」(`g.out`)이 있으면 `g.out=false`·`setOut(false)`·`co.onOutChange(false)` 로 풀고 시작(30초 자동 멈춤으로 버튼이 비활성이 돼 pointerup 이 안 온 경우).
- ② 취소는 시작·녹음·알아듣는 중(`cancellable`)일 때만 — 이미 보낸 뒤(STT 가 `idle`)에 밖에서 떼면 표시만 풀고 평소 뗌(`onRelease`, 대기 중엔 상태 기계가 무시) → 거짓 「보내지 않았어요」 토스트 없음. Esc 도 `resetOut()` 을 먼저 불러 표시를 풀고(뒤따르는 뗌의 중복 취소 토스트 제거).
- 기본 경로(`cancelOutside` 없음)는 한 글자도 안 바뀜 — `talk/__tests__/voiceSharedFrozen.test.ts`(확장 전 고정 21종)·`speech/__tests__/pttCancelOutside.test.ts` **12/12 통과**. 변이 3건 KILLED(아래).

## 항목 6 [REV-U2 F-1] 말 모드 배선 시험 — 처리됨(큰 재작성 없이 규칙만 추출)
- **추출**: `useAskInput` 안의 취소 표지(`cancelledRef`)·`onFinal` 분기·`canSendNow`·다시 보내기를 의존 주입형 순수 컨트롤러 **`askInputControl.ts`(`makeAskInputControl`)** 로 옮김. 훅은 한 번 만들어 `onFinal`/`press`/`cancel`/`canSendNow`/`resend` 를 꽂기만 한다(동작 동일: `press` = 표지·힌트 해제+인식 시작, `cancel` = 표지+밖 해제+인식 중단+토스트). 순수 도우미 `askShowSttAlert`(V7)·`ASK_INPUT_MODE_SERVER`·`askModeOf`(V15)는 `voiceView.ts`.
- **eslint 1줄**: `react-hooks/refs` 가 `useState(() => makeAskInputControl({...ref 읽는 클로저}))` 를 「렌더 중 ref 읽기」로 의심해 이유를 단 `eslint-disable-next-line react-hooks/refs`(저장소에 같은 방식 선례 다수) 한 줄을 넣었다. 그 클로저의 ref 읽기는 이벤트·콜백에서만 일어난다.
- **시험**: 새 `askInputControl.test.ts` 12건(가짜 의존): V2·V3·V4·V5·429·V17·`blockedLeftSec`·V7·V15 + 훅 배선(AST: 컨트롤러 1개·deps 10개·`read` 가 `busy` 를 false 로 고정하지 않음·`onResend`/`sendChip` 위임·규칙이 훅에 되돌아오지 않음). `askVoice.test.ts` 의 깨진 소스 정규식(`cancelledRef.current) return`)은 컨트롤러 소스로 옮기고, 콘솔·직접 호출 스캔 대상에 `askInputControl.ts` 추가.
- 훅 자체의 React 상태 연결(렌더·수화)은 여전히 DOM 시험 도구가 없다 → QA 몫(아래).

## 변이 표 (미러 소스 사본에서만 치환 → 지정 시험 실행 → 원복, 25건 중 **25건 KILLED · 생존 0**)
| 변이 | 실패한 시험(번호 - 이름 앞부분) |
|---|---|
| F1-M15 `replaceState(history.state…)` 되돌림 | askChatTab 5 `F1 replaceAskUrl — 첫 인자는 null…` |
| F1-b `AskChatTab` 이 직접 `history.state` 호출 | askChatTab 4 `⑨ 주소 적기` |
| F2 `planArrivals` 제외 제거 | askActivity 14 `F2 planArrivals` |
| F2-b `settle` 이 `currentChatId` 대신 `null` | askActivity 15 `F2 배선` |
| M1b 관문 재도입(금지어 없이) | askChatTab 2 `① 보내기 경로는 범위 시트를…` |
| M2b 열 때 방 생성(한 줄 효과) | askChatTab 3 `④` |
| M2c 효과에서 `create()` | askChatTab 3 `④` |
| M8 ASK 삭제 뒤 `router.replace` 제거 | askChatTab 8 `삭제 뒤 이동` |
| M11a 폴링 cleanup `stop()` 제거 | askActivity 16 `폴링 정리` |
| M11b `visibilitychange` 해제 제거 | askActivity 16 `폴링 정리` |
| M14 `onGone` 의 `startNew()` 제거 | askChatTab 7 `대화 없음(404)…` |
| V2 말 질문을 `'text'` 로 | askInputControl 1·3·6 |
| V3 `press` 가 취소 표지를 안 풂 | askInputControl 3 |
| V4 `cancel` 이 인식을 안 멈춤 | askInputControl 4 |
| V5 답 대기 무시(`busy:false`) | askInputControl 5 |
| V5b 훅이 `busy` 를 false 로 고정 | askInputControl 11 `훅 배선` |
| V7 오류 띠가 글자 모드에도 | askInputControl 9 |
| V7b 훅이 `askShowSttAlert` 안 씀 | askInputControl 12 |
| V15 모드 서버 스냅샷 `'voice'` | askInputControl 10 |
| V17 다시 보내기 429 검사 제거 | askInputControl 7 |
| REV-S1 F-2 `askInputKindOf` (TEXT 아니면 VOICE) | askTurn 28 |
| F-2① PTT 새 누름이 밖을 안 풂 | pttCancelOutside 5 |
| F-2② PTT 보낸 뒤에도 취소 | pttCancelOutside 6 |
| F-2③ PTT Esc 가 표시를 안 풂 | pttCancelOutside 7 |

## 남은 위험 · QA 가 실제 흐름으로 확인할 항목
1. **F1 (브라우저·앱 WebView 필수)**: 빈 대화에서 첫 질문(칩/글자/말) → 주소가 `/ask?chat=<id>` 로 바뀌고 **같은 화면에서** 답이 이어지는지(질문이 사라지거나 두 번 나가지 않는지, RSC 요청·다시 마운트 여부는 네트워크 탭) → 그 직후 **하단 탭 「질문」 재누름 = 새 빈 대화** · ⋯ **「새 질문 시작」 = 새 빈 대화** · **삭제 직후 `/ask` 빈 대화 + 토스트 「삭제했어요」 + 시트 닫힘**(삭제 직후 네트워크를 끊는 경우도: 시트가 「삭제 중…」에 오래 잠기지 않는지) · 뒤로 가기(이전 대화 `?chat=` 열기).
2. **V3 (사용자에게 보이는 위험)**: 말 질문 → 밖에서 떼서 취소 → **바로 다시 말 질문**이 정상 전송되는지(취소 표지가 다음 누름에서 풀려야 한다) · 취소 뒤 늦게 도착한 인식 글이 보내지지 않는지.
3. **V5 (사용자에게 보이는 위험)**: 답을 기다리는 중 손을 떼면 줄 세워 보내지 않고 「보내지 못한 말」 띠가 뜨는지 · 429 로 막힌 동안 말해도 띠 · 띠의 [다시 보내기] 가 429 중엔 안내 토스트만.
4. PTT F-2: 밖에서 누른 채 30초 자동 멈춤 → 그 뒤 밖에서 뗌 → 「보내지 않았어요」가 **안 뜨는지**(이미 보낸 말) · 비활성 버튼의 pointerup 전달은 브라우저별로 달라 다음 누름에서 「밖」 모양이 남지 않는지.
5. 하이드레이션: 세션 모드가 `voice` 인 채 새로고침/직접 `/ask` — 콘솔 경고·입력창→말 바 깜빡임(훅 렌더 시험 없음, REV-U2 항목 4).
6. 이번 수정 범위 밖(그대로): F-3(플러그인 `saveWav` 기본값 true — 다음 네이티브 변경 때), 한 글자 단어는 말로 못 묻는 설계 규칙, 계약 문서 고칠 문장 7건(Leader 몫).

## 체크포인트 (이어받기용)
- 완료: 항목 1~6 전부 · 변이 25/25 KILLED · 게이트 위 숫자. **남은 일 없음** — Reviewer 재감사(U1 F1/F2·U2 F-1/F-2 수정 확인) 대기.
- 다음 첫 행동(이어받는 사람): 미러 `~/.node-local/thekaiwa-dev066f` 에서 `diff -rq src tests` 0 확인 후 재감사 요청에 따라 처리.
- 주의점: `react-hooks/refs` eslint-disable 1줄 · `askChatTab.test.ts` 안 로컬 `walk(dir)` 와 AST 도구 `walk` 이름 충돌(`walkAst` 로 가져옴) · Next 전제 시험은 `node_modules/next/...app-router.js` 가 없으면 건너뜀.
- 미커밋 파일: 위 「수정한 파일 목록」 전부(U1·U2·S1·designer 쪽 기존 미커밋 변경은 그대로 둠).
