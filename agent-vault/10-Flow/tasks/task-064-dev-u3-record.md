---
task_id: task-064
role: developer
part: dev-U3 (화면 — 질문 목록 /ask)
tags:
  - type/task-record
  - domain/ask
  - domain/ui
aliases:
  - task-064 dev-U3
created: 2026-10-12
---

# task-064 — Developer 기록 (dev-U3: 질문 목록 `/ask`)

이력서 본문: [[task-064-ask-anything-3a]] · 이전 기록 [[task-064-dev-u-record]] · 구현 가이드 정본 `docs/screens.md` §25(25-4·25-7·25-11) · 계약 `docs/design/api-contract.md` §2-18-A · 승인 데모 v2

## 진행 기록
- [17:20] 신규 소환(이어받기 아님). 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED` / `task: task-064` (approved v2). 이전 dev-U 기록·§25(25-0~25-4·25-7·25-9~25-13) 읽음. 전용 미러 `~/.node-local/thekaiwa-dev064u3`(sync-local exit 0, predeploy node_modules `cp -al`, package.json 동일).
- dev-U2 의 `ScopeNoticeSheet`·`useScopeNoticeGate` 는 착수 시점에 아직 없음(`task-064-dev-u2-record.md` 도 없음) → 목록 부품부터, `AskHome` 통합은 마지막.
- [17:30] dev-U2 인터페이스 확인(`task-064-dev-u2-record.md` 맨 위 — `useScopeNoticeGate(): {acknowledged: boolean|null; ack()}`, `ScopeNoticeSheet {open, mode:'first'|'again', onConfirm?, onClose}`) → 파일이 이미 있어 그대로 import.

## 체크포인트 1 — 목록 부품·라우트 (17:35)
- **완료**: 시험 먼저 `ask/__tests__/askHome.test.ts`(18건) → 모듈 없음으로 실패 확인 → 구현.
  | 파일 | 내용 |
  |---|---|
  | `src/components/ask/homeLogic.ts`(새) | 목록 순수 계산: `askDraftCheck`·`askCountLine`·`isEnterSubmit`·`askHomeView`·`askExamplesMode`·`appendRooms`·`mergeFirstPage`·`askListPollDelay`(useChatTurn 폴링 상수 재사용)·`settleArrivals`·`lastAnswerOk`·`askRowView`·`ASK_ROW_CLASS`(= ChatListItem 링크 클래스)·`ASK_LIST_LIMIT` |
  | `src/components/ask/AskComposerCard.tsx`(새) | §25-4 B 그대로(제어 컴포넌트, `aria-disabled`, 900자 줄, 정밀 포인터 Enter, 범위 링크) |
  | `src/components/ask/AskExamples.tsx`(새) | `wrap`/`row`, 칩 4개 `onPick(q)` 만 |
  | `src/components/ask/AskListItem.tsx`(새) | 행 링크(`ASK_ROW_CLASS`), 둘째 줄·「답 만드는 중」 점 3개·「새 답」 |
  | `src/components/ask/AskHome.tsx`(새) | 목록·더 보기·첫 쪽 오류 상자·복귀 시 다시 읽기·「답 만드는 중」 폴링·「새 답」(#29 `limit=2` 로 성공 확인)·초안·삭제 토스트·보내는 범위 관문·#28 생성 → `pending.<id>` → `router.push` |
  | `src/components/ask/AskHomeSkeleton.tsx`(새) | 앱바 + 실제 카드·예시(`inert`) + 「지난 질문」 머리 + `ChatRowsSkeleton` |
  | `src/app/(app)/ask/(tab)/{page,loading}.tsx`(새) | 옛 `ask/page.tsx`(ComingSoon) 내용을 옮겨 교체, 옛 파일은 `find … -delete` |
- 미러: `askHome.test.ts` **18/18 pass**.
- **§25 와 다르게 한 곳**: ① 목록 순수 계산을 `logic.ts` 대신 새 파일 `homeLogic.ts` 에 둠(목록·방을 다른 developer 가 동시에 고쳐 같은 파일 충돌을 피하려고 — 지시 파일 목록 밖 새 파일 1개) ② 「새 답」 성공 확인: #27 에 답 상태가 없어(L-8) 후보 방마다 #29 `?limit=2` 를 한 번 읽어 마지막 메시지가 `ASSISTANT·DONE` 일 때만 붙임(확인 실패 = 안 붙임, `waiting` 에서는 뺌) ③ 폴링 재읽기는 `mergeFirstPage` — 더 보기로 받은 행·커서를 지킨다(`ChatList` 는 첫 쪽으로 바꿔 끼움) ④ 초안 복원은 수화 뒤 렌더에서 읽기(`useSyncExternalStore` 수화 신호 — 서버 렌더와 첫 화면 같게, effect 안 setState 없음) ⑤ 「보내는 범위」 시트 [알겠어요, 보내기]는 시트를 연 순간의 글(`heldRef`)을 보낸다.
- **남은 일**: tsc·eslint·전체 시험·build, 변이 확인 ≥6, 높이 메모.
- **미커밋 파일**: 위 표 전부 + `ask/__tests__/askHome.test.ts`, 삭제 `src/app/(app)/ask/page.tsx`.

## 체크포인트 2 — 검증 (17:45)
- **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev064u3`, sync-local 뒤):
  | 명령 | 결과 |
  |---|---|
  | `./node_modules/.bin/tsc --noEmit` | **exit 0** (처음 1건 = 내 시험 도우미 타입 → 고침) |
  | `./node_modules/.bin/eslint src` | **exit 0**, 경고 6(전부 내 파일 밖 — 기존 settings·admin + `modules/conversation/__tests__/ask.test.ts`), 내 경고 1건(안 쓰는 import) 고침 |
  | `node --import tsx --test --test-concurrency=1 $(find src/components src/app -name '*.test.ts')` | **1444 중 1443 pass, 1 fail** — 실패 = `topic/__tests__/removalA11y.test.ts` 「M-1 기존 Sheet 호출처는 describedBy 를 넘기지 않는다」: 허용 목록이 `TopicRemovalSheet` 하나인데 dev-U2 의 `ask/ScopeNoticeSheet.tsx` 가 `describedBy` 를 넘긴다(§25-9 가 요구하는 동작). **내 파일 아님 — dev-U2/Leader 몫**(허용 목록에 `ask/ScopeNoticeSheet.tsx` 추가가 맞다고 봄 [가능성 높음]) |
  | `askHome.test.ts` 단독 | 18/18 pass |
  | `./node_modules/.bin/next build` | **exit 0** — `○ /ask`(정적), `ƒ /ask/[chatId]` |
- **변이 확인 13/13 잡힘**(별도 복사본 `~/.node-local/thekaiwa-dev064u3-mut`, 매번 원복): M1 폴링 상한 `>`→`>=` · M2 waiting 도 토스트 · M3 running/새 답 우선순위 뒤집기 · M4 행 클래스 `py-2.5`→`py-3` · M5 글자 수 줄 문턱 900→1000 · M6 펼친 목록 커서 잃기 · M7 실패 답에도 새 답 · M8 범위 관문 `!== true`→`=== false`(수화 전 null 통과) · M9 예시 칩이 바로 보내기 · M10 자리표시 `inert` 제거 · M11 입력창 `lang="ja"` · M12 「새 답」 accent 글자 · M13 생성 본문에 `inputSource` — 전부 `# fail 1`.
- **25-11 대응**: ⑪⑫ 는 이전 dev-U 의 `logic.test.ts` 가 이미 잠금 + 이번 `settleArrivals`(⑫ 확장) · ⑰ 목록 부분(라우트 `(tab)`·`ask/page`·`ask/loading`·`[chatId]/loading` 없음·`isFocusRoute('/ask')` false·자리표시 데이터 요청 0·`inert`·행 클래스 = ChatListItem) · ⑱ 목록 파일 마이크 import 0·생성 본문 `{kind:'ASK', title}` 만·목록에서 `/turns` 0.
- **높이(25-7 A)**: 운영 빌드 브라우저 실측은 **못 함** — `/ask` 는 로그인 화면이고 지시상 개발 서버·QA 계정 사용 금지. 클래스 합산(계산값): 입력 카드 = 테두리 2 + p-3 24 + 라벨 22.5 + 8 + 입력창 rows3 94 + 8 + 버튼 줄 44 + 8 + 범위 링크 44 = 254.5 · 예시 줄 = 제목 19.5 + mt-2 8 + 칩 44 = 71.5 · 「지난 질문」 머리 22.5 + mb 10 · 행 = ChatListItem 과 같은 클래스(67.5, 뱃지 줄 68.5) — 데모 예산과 같음. 자리표시(`AskHomeSkeleton`)는 같은 바깥 틀·같은 부품이라 위쪽 점프 0 기대(실측은 QA C1·C2).
- **dev-U2 와의 의존**: `AskHome` 이 `ScopeNoticeSheet`(default)·`ScopeNoticeMode`·`useScopeNoticeGate` 를 import(인터페이스 = dev-U2 기록 맨 위). `AskRoom` 쪽이 지켜야 할 목록 약속: ① 방 마운트 때 `ASK_KEYS.waiting`·`ASK_KEYS.newAnswer` 에서 그 id 제거 ② 답을 기다리던 중 언마운트하면 `addId(ASK_KEYS.waiting, id)` ③ 메시지 0개 + `ASK_KEYS.pending(id)` 가 있으면 키를 먼저 지우고 보내기. 목록은 `pending` 을 쓰기만 한다.
- **남은 의문(Leader)**: ① L-8 처리 방식 — 「새 답」 후보마다 #29 `?limit=2` 1회(후보가 생길 때만, 보통 0~1건). 서버 #27 additive `lastAssistantStatus` 가 생기면 이 요청을 뺄 수 있다 ② 새 파일 `ask/homeLogic.ts`(지시 목록 밖) ③ `removalA11y.test.ts` 허용 목록(위) ④ 임시 변이 복사본 `~/.node-local/thekaiwa-dev064u3-mut` 정리(지우기 명령이 훅에 걸려 남겨 둠) ⑤ 360/390/412 실측·TalkBack 은 QA.
- **미커밋 파일**: `src/components/ask/{homeLogic.ts, AskComposerCard.tsx, AskExamples.tsx, AskListItem.tsx, AskHome.tsx, AskHomeSkeleton.tsx, __tests__/askHome.test.ts}` · `src/app/(app)/ask/(tab)/{page.tsx, loading.tsx}` · 삭제 `src/app/(app)/ask/page.tsx`.
