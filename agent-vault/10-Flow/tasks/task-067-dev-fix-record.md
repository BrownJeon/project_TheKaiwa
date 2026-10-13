---
task: task-067
role: developer
part: FIX (감사 B 지적 REV-067B-1·2·3·4·5 — 작은 수정 5개)
tags: [type/task-note, domain/ask]
---
# task-067 developer FIX 기록

본 이력서: [[task-067-ask-history-title-paging]] — 감사 기록 [[task-067-rev-b-record]]. 승인 데모 v1(D1~D6 권고대로). 범위는 지적 5개뿐, 그 밖은 건드리지 않는다.

## Developer 기록
- [17:21] 착수. 데모 게이트 `DEMO_GATE_PASSED`(task-067, approved v1, hash verified). 전용 미러 `~/.node-local/thekaiwa-dev067u2`.
- 설계 메모: ① 오류 지움 = 순수 함수 `renameErrorAfterInput(variant, cur)` ② `askInitialConvId(q)` 주소만 ③ 저장 중 취소 허용 = 순수 함수 `renameCancelAllowed(variant, busy)` ④ 머리 단추 연결 = 렌더 결과에서 단추 `onClick` 을 실제로 눌러 보는 시험(react-dom 서버 렌더로는 핸들러가 안 보이므로 요소 트리를 직접 열어 본다) ⑤ 이중 제출 가드 = `saveRenameUnlessBusy(busy, o)` 로 빼서 busy 일 때 patch 0 을 시험.
- [17:40] 구현 5건 완료(미러 시험 31개 통과). 변경: `ChatRenameForm.tsx`(순수 함수 3개 추가 `saveRenameUnlessBusy`·`renameErrorAfterInput`·`renameCancelAllowed`, `save`/`onInput`/`onCancel` 가 사용) · `AskChatTab.tsx`(`askInitialConvId(q)` 주소만, `initialChatId` prop 삭제) · `(tab)/page.tsx`(prop 넘기는 줄 삭제 + 주석) · 시험 `chatRename.test.ts`(+3) · `askHead.test.ts`(+1) · `askChatTab.test.ts`(T22 갱신 + 페이지 단언).
- REV-067B-3 SSR 확인(Next 16.3.2 소스): `useSearchParams` → `useDynamicSearchParams` 는 `prerender-legacy`/`prerender-ppr`(정적 생성) 일 때만 CSR 로 bailout. `/ask` 는 `await searchParams`+`auth()` 라 동적 페이지 → 요청 렌더에서 실제 쿼리를 준다. 서버 prop 을 폴백으로 남길 경로 없음 → prop 완전 삭제(`isAskId` import 는 `callbackUrl` 계산이 계속 써서 page 에 남김).
- 변이(전용 미러에서만, 매번 원복 확인): M1a·M1b(오류 지움 무력화/배선)·M2a·M2b(default 저장 중 취소)·M3a·M3c·M3d(서버 값 되살림·prop 되살림·isAskId 제거)·M4(`onClick={onRename}` 삭제)·M5a·M5b·M5c(이중 제출 가드 삭제·false 고정·가드 우회) 11회 전부 KILLED.
- [17:55] 게이트(전용 미러 `thekaiwa-dev067u2`, 동기화 뒤): 바꾼 파일 eslint 0 · tsc 는 65줄 오류가 모두 이번 변경과 무관(미러의 낡은 prisma client `endedAt`·`userSeedOverride`, 낡은 `.next/types/validator.ts`, 낡은 시험 타입 `never`) — 바꾼 파일에서 난 오류 0 · 시험 `ask`+`chat`+`shell`+`app/_lib` 399개 통과, 그 밖 `components`·`app` 1248개 통과(실패 0).
- 변이 11회 전부 KILLED(위). NFS 소스는 최종 상태, 미러는 변이마다 원복 후 재동기화·`cmp` 확인.
- 문서에서 바뀐 사실(Leader 가 맞출 것): ① screens.md §27-1 D·T22 — `askInitialConvId(q)` = `isAskId(q) ? q : null`(서버 값 폴백 삭제), `AskChatTab` props = `{ teacherName }` 뿐, `(tab)/page.tsx` 는 `initialChatId` 를 넘기지 않음(`callbackUrl` 계산은 그대로), T22 단언 = `('B')=B · (null)=null · ('../x')=null`(서버 값이 A 여도 무시). §26 쪽 옛 문장(screens.md 11523·11530·11537·11597~11598)의 `initialChatId` 도 같은 이유로 낡음. ② §27-3 — 질문 칸은 입력하면 빈 값/초과 오류를 지움(저장 실패 문구는 유지), 회화·채팅(default) 저장 중 [취소] = 옛 `ChatMenuSheet` 처럼 메뉴로 돌아감(질문만 저장 중 무반응), 이중 제출 가드는 `saveRenameUnlessBusy` 로 요청 쪽에 있음. 새 export 3개: `saveRenameUnlessBusy`·`renameErrorAfterInput`·`renameCancelAllowed`(`ChatRenameForm.tsx`). U2 기록의 「회화·채팅 동작 불변」은 이제 사실.
- 남은 위험: 배선(onChange→오류 지움·[취소]·머리 단추)은 소스 구조·요소 트리 시험이고 실제 DOM 은 못 눌러 봄 → QA 실브라우저에서 ① 빈 칸 [저장] 뒤 글 쓰면 오류·빨간 테두리가 사라지는지 ② 머리 단추가 제목 칸을 여는지 ③ B-3 재현(서버가 그린 `/ask?chat=A` → 새 질문 시작 → 공부 탭 → 뒤로 = 빈 대화) 확인 필요. 미커밋 파일: 위 7개 소스·시험 + 이 기록(git 조작 안 함).
