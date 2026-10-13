---
task: task-067
role: developer
part: U1 (지난 질문 시트 — 5개씩 쪽 · 행 ⋯ 메뉴 · 시트 삭제 · 문구)
tags: [type/task-note, domain/ask]
---
# task-067 developer U1 기록

본 이력서: [[task-067-ask-history-title-paging]] · 구현 가이드 `docs/screens.md` §27(27-4·27-5·27-8·27-10 T1~T8·T12~T14·T23·T24) · 서버 쪽 [[task-067-dev-s-record]].

## Developer 기록
- [착수] 데모 게이트 `DEMO_GATE_PASSED`(task-067 approved). 미러 `~/.node-local/thekaiwa-dev067u1`(cp -al).
- [단계 1 완료] ① `askCopy.ts` 새 키 전부 — `history.{loadingSr,emptyHint,pageError,pagerAria,prev,next,pageLabel,totalLabel,busyLabel,pageSr,pagingSr,rowMore,rowTitle,rename,toList,deleteBusyNote,confirmQ}` · **U2 몫 `head.{newConv,aria}` · `rename.{hint,count,empty,over,fail,saved}` · `menu.emptyNote`(J7 「제목 바꾸기」)**. 지울 키(`backLabel`·`roomLoadingTitle`·`subtitle`·`notFoundBody`·`toList`(최상위)·`more`·`moreBusy`)는 아직 둠(단계 5). ② `AskHistoryButton` `ref?: React.Ref<HTMLButtonElement>` prop(React 19). ③ `historyPaging.ts`(순수: `ASK_HISTORY_PAGE=5`·`AskListPage`·`historyListUrl`·`historyPages`·`isPaged`·`pushCursor`·`pageAfterDelete`·`fillerCount`·`canPrev/canNext`·`pagerView`·`rowRunning`·`liveRunningMap`·상태 전이 `beginPage/settlePage/resetPager/reloadAfterDelete/patchRow`·삭제 실행 `deleteHistoryRow(deps)`) + 시험 `askHistoryPaging.test.ts`.
- 결정: `src/types/chat.ts` 의 공용 `Paged<T>` 는 **고치지 않았다** — 가이드 27-4 C 대로 `historyPaging.ts` 안 `AskListPage = Paged<ChatSummary> & { total: number }`(다른 목록 #40 등은 `total` 을 안 내 공용 타입에 넣으면 거짓). `useAskActivity` 는 `total` 을 쓰지 않는다.
- 결정: 훅 상태 전이는 전부 순수 함수(`req` 를 상태에 싣고 효과가 그것을 읽음) — `set-state-in-effect` 규칙을 지키고 T6(늦은 응답)을 순수 시험으로 잠금.
- [Leader 공지 반영] 옛 `ask-u1`/`ask-u2` 에 SendMessage 금지 — 단계 1 알림을 옛 ask-u2(task-066)에 잘못 보냈음(그 에이전트는 파일 안 건드리고 종료). 이후 U2 조율은 이 기록 파일로만.
- [단계 2 완료] `useAskHistoryPages.ts`(열림·`resetKey` 는 렌더 중 조정 → `req` 를 효과가 읽어 `apiGet(historyListUrl)` · 응답은 `settlePage` 가 순서표로 거름) · `AskPager.tsx`(aria-disabled·흐림 40%·status 한 줄·가운데 라벨 aria-hidden).
- [단계 3 완료] `AskListItem`(링크 → 행 단추 `onOpen` + 형제 ⋯ 단추 `onMore`·`data-ask-row-more`·이름 `history.rowMore`·`running` 덮어쓰기 prop·`pr-[52px]`) · `useAskActivity`(`more`·`moreBusy`·`moreError`·`cursor` 삭제, 목록 상태 = 최근 20개 배열을 **그대로 바꿔 끼움**) · `homeLogic` `appendRooms` **와 `mergeFirstPage` 삭제**(결정: 더 보기가 없으면 mergeFirstPage 는 줄어든 목록(지운 대화)을 옛 행으로 남기는 버그만 남는다 — 유일한 사용처가 useAskActivity).
- [단계 4 완료(선택 props)] `AskHistorySheet`: 5개 쪽(`AskHistoryList` 상태 없는 부품 export — 공용 Sheet 는 포털이라 시험이 이 부품을 그림) + 하위 화면(이 대화·제목 바꾸기(`ChatRenameForm variant="ask"`)·삭제 확인) + `deleteHistoryRow`. 새 props `pageResetKey?·onOpen?·onRenamed?·onDeleted?·onToast?` 는 **아직 선택**(U2 의 AskChatTab 연결 전 빌드 유지) → U2 연결 확인 뒤 필수로. 시트가 하는 일: 삭제 성공 시 토스트(deletedToast)·removeId(waiting/newAnswer)·activity.refresh()·쪽 reload·`onDeleted(id, wasCurrent)` / 제목 저장 시 `pages.patch`·토스트(rename.saved)·`onRenamed(id,t)`. 초점: 행 ⋯→[제목 바꾸기] · 확인→[취소] · 목록으로/저장/취소→그 행 ⋯ · 다른 대화 삭제→시트 제목.
- `askCopy` `more`·`moreBusy` 삭제(시트만 썼음). **`toList`(최상위 「질문으로」)·`notFoundTitle` 은 지우면 안 됨** — `useAskInput.tsx:347`(`notFoundLink` 라벨)·`logic.ts:338` 이 쓴다(가이드 27-7 C 의 지울 목록과 다름 → Leader 보고). `backLabel`·`roomLoadingTitle`·`subtitle`·`notFoundBody` 는 U2 의 `askRoom.test.ts`(196·198행)가 아직 참조 → U2 단계 3 끝난 뒤 삭제.
- [게이트 중간] tsc: 내 파일 오류 0(남은 오류는 U2 진행 중 파일 AskChatTab·askChatTab.test·askRoom.test 뿐) · eslint(내 12개) 0 · 시험 3개 파일 46/46.
- 다음 첫 행동: 변이 시험(T1~T8·T12~T14·T23) → U2 AskChatTab 연결 확인 후 새 props 필수화 → 단계 5 키 삭제.
- 미커밋(내 것): src/components/ask/{askCopy.ts, AskHistoryButton.tsx, historyPaging.ts(새), useAskHistoryPages.ts(새), AskPager.tsx(새), AskListItem.tsx, useAskActivity.ts, homeLogic.ts, AskHistorySheet.tsx} · __tests__/{askHistoryPaging.test.ts(새), askActivity.test.ts, askCopy.test.ts} + 이 기록.
- [변이] 미러에서 15개(파일을 새 inode 로 바꿔 쓰고 원복 — cp -al 원본 미러 보호): T1 5→6 · T2 ceil→floor · T3 `>`→`>=` · T3 렌더 쪽 줄 늘 · T4 `disabled` 속성 · T4 total 무시 · T5 넘기는 중 [이전] 허용 · T6 옛 응답 반영 · T6 커서 안 자름 · T7 빈 자리 0 · T8 빈 쪽 머묾 · T12 알약 limit=5 · T13 쪽 값만 · T14 단추 안 단추 · T23 잠금 무시 → **1차 14/15**(T6 옛 응답 생존 — 시험이 새 요청이 끝난 뒤에만 옛 응답을 넣었다) → 「[다음] 기다리는 동안 옛 열기 응답이 먼저 옴」 단언 추가 → **15/15 KILLED**, 원복 뒤 23/23.
- [필수화] U2 의 `AskChatTab` 이 `pageResetKey·onOpen·onRenamed·onDeleted·onToast`·알약 `ref` 를 넘기는 것 확인(183~192행) → 시트 새 props **필수**로 바꿈(옛 `onClose` 대체 경로 삭제). tsc: AskChatTab 포함 내 쪽 오류 0.
- [단계 5 완료] U2 단계 3(AskRoom room 정리) 코드 반영 확인(`ASK_COPY.{backLabel,roomLoadingTitle,subtitle,notFoundBody}` 사용처 grep 0) → 네 키 삭제 + `askCopy.test` 에 「없음」 단언. **`toList`·`notFoundTitle` 은 남김**(useAskInput.tsx:347·logic.ts:338 사용 — 가이드 27-7 C 와 다름, Leader 보고).
- [게이트 최종(내 파일)] tsc: `src/components` 오류는 U2 의 `askChatTab.test.ts`(Node|null — 작성 중)뿐, 나머지는 미러의 낡은 `.next/types`. eslint(내 12개) 0. 시험 내 3개 파일 46/46 · `ask/__tests__` 전체 166 pass / 2 fail — 둘 다 U2 쪽: `askBehavior.test.ts` M-2(SourceList 의 옛 `/ask/${id}` 대체값 정규식 — U2 가 27-7 B 로 바꾼 결과, 시험 갱신 필요) · `askChatTab.test.ts` T10(U2 작성 중).
- **U2 에게**: ① `askBehavior.test.ts` M-2 정규식이 옛 `` `/ask/${encodeURIComponent(chatId)}` `` 대체값을 고정 — SourceList 를 바꾼 쪽에서 갱신 필요. ② 시트는 행 누름에 `onOpen(row)` 만 부른다(지금 대화 행 포함 — 닫기 판단은 AskChatTab). ③ 시트가 삭제·제목 저장 토스트를 직접 낸다(`onToast`) — AskChatTab 은 같은 토스트를 다시 내지 말 것.
- 미커밋(내 것): src/components/ask/{askCopy.ts, AskHistoryButton.tsx, historyPaging.ts(새), useAskHistoryPages.ts(새), AskPager.tsx(새), AskListItem.tsx, useAskActivity.ts, homeLogic.ts, AskHistorySheet.tsx} · __tests__/{askHistoryPaging.test.ts(새), askActivity.test.ts, askCopy.test.ts} + 이 기록. 미러 `~/.node-local/thekaiwa-dev067u1` 남아 있음(지워도 됨).
