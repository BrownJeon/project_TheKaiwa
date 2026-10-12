---
task_id: task-064
title: "task-064 Designer 기록 — 질문 방 스크롤 위치 규칙 (QA64-B2-1)"
status: done
tags:
  - type/task-note
  - domain/ask
aliases:
  - task-064 designer scroll
created: 2026-10-12
updated: 2026-10-12
---

# task-064 Designer 기록 — 질문 방 스크롤 위치

본 이력서: [[task-064-ask-anything-3a]] · QA 근거: [[task-064-qa-b2-record]] `QA64-B2-1`·`B2-1 보강` · 앞 기록: [[task-064-designer-record]] · 승인 데모 `docs/demo/task-064-ask-anything-v2.html`(v2 — 화면 구조 그대로, 빠진 스크롤 규칙만 채움, light 트랙·데모 면제) · 산출 = `docs/screens.md` §25-5 J + 25-3 A `AskRoom`·C `MessageList` 두 행.

## Designer 기록
- [21:33] 착수·읽기 끝(턴 1~13). 읽은 것: QA-B2 기록(QA64-B2-1·보강 수치), screens.md §25 전체(25-0~25-13), §3-2 C 채팅 스크롤 규칙(281~282행), §9-2 E 회화 `MessageList` 슬롯(3774~3798행), 데모 v2 「J 키보드·긴 답」(스크롤 위치 규정 없음 — `scrollTop` 코드 0건 [확실]), `MessageList.tsx`(읽기만), `followHold.ts`, `AskRoom.tsx`(읽기만), `useChatTurn.ts` `onAccepted`·`onDone`.
- [21:33] 사실 확인 [확실 — 코드 직접 읽음]: ① 바닥 붙임 경로 4곳 = 첫 로드(`p.count===0`) · 메시지 바뀜 효과(`atBottomRef`) · 진행 말풍선 효과(`[pendingVisible, turn.phase]`) · `followContent` ResizeObserver(내용 증가). ② 대기 행과 답 행은 **같은 id**(`accepted.assistantMessageId`) → 기다리는 동안 위로 올렸다면 답이 와도 `lastId === leftAtLastId` 라 「새 메시지 ↓」 알약이 안 뜬다(채팅방도 같음 — 지금 동작). ③ SSE `done` 은 메시지·제안·`phase` 를 한 동기 구간에서 바꿔 한 렌더로 묶인다. 폴링(이어받은 대기) 도착은 `reloadProposals()` 가 비동기라 제안 카드가 늦게 붙는다. ④ 같은 커밋에서 메시지 효과 → 진행 말풍선 효과 순서로 돈다 — 정렬 뒤 `atBottomRef` 를 바로 다시 재지 않으면 두 번째 효과가 바닥으로 되돌린다(구현 함정 — 가이드 J-7 에 적음). ⑤ 누가 줄 = 아바타 28 + 간격 8 = 36px(`TeacherAvatar sm h-7`, `AskAnswer gap-2`). ⑥ 방 목록 보이는 높이 C = 화면 높이 − 157(BackBar 52·표시 바 44·입력 바 61) — QA 수치(360×740 → 583, 390×844 → 687)와 일치, 412×892 → 735 [가능성 높음 — 계산].
- [21:33] 결정 방향: 도착·재진입 때 **직전 질문 말풍선 윗면**을 목록 위 여백(12px)에 맞춘다(질문 행이 C/3 를 넘으면 답 행 위 C/3 까지만). 근거: A2 실제 답 첫 문장이 「네, 둘 다 사과 상황에서…」처럼 질문에 대한 응답으로 시작 → 질문이 같이 보여야 읽힌다. 짧은 답은 같은 식이 바닥으로 자동 귀결(clamp). 위로 올려 둔 상태면 위치 유지 + 「새 답」 알약(탭 = 같은 정렬). 공용 prop 기본값 = 지금 동작.
- [21:36] 산출 완료(턴 14~21). `docs/screens.md` 수정은 세 곳뿐: ① §25-5 끝(I 다음, 25-6 앞)에 **J 스크롤 위치** 새 소절(J-1 계산식 · J-2 상황별 규칙 1·2·3·3′·4·5·6 · J-3 도착 정렬 유지 창 2초 · J-4 모션·초점·읽기 · J-5 prop · J-6 구현 함정 · J-7 합격선 · J-8 후속 후보 · J-9 Leader 확인) ② 25-3 A `AskRoom.tsx` 행 끝 한 구절 ③ 25-3 C `chat/MessageList.tsx` 행(더하는 것·이유 각 한 구절). 다른 절·미커밋 변경 안 건드림, git 쓰기 명령 0.
  - 규칙 요약: `target = clamp(aTop − min(질문 행, ⌊C/3⌋) − pad, 0, max)` — 도착(바닥 120px 안)·재진입(마지막 DONE 답)에 적용, 짧으면 자동 바닥. 위로 올려 둔 채 도착 = 위치 유지 + 알약 「새 답 ↓」(탭 → 정렬 + `focusList`). 재진입 대기·실패 = 맨 아래. 보내기·칩·handoff `scrollToBottom` 그대로. 이동은 즉시, 초점·도착 status 불변.
  - prop: `arrivalAlign?: 'bottom' | 'answer-start'`(기본 bottom) + `pillLabel?: string`(기본 지금 「새 메시지 ↓」), 순수 `chat/arrivalAlign.ts` + 시험.
  - 합격선: 긴 답 = 질문 `<li>` 윗면 − 목록 위 = 12±2, `article` 윗면 − 목록 위 ∈ 360 [48,242] · 390 [48,277] · 412 [48,293] / 짧은 답 = 바닥 ±1 / 4,000자 = 긴 답과 같음 / 위로 올림 = `scrollTop` 변화 0.
  - 확신: 계산식·함정은 [확실](코드 읽음), C/3 상한 [가능성 높음], 2초 창 [추측 — QA 실측으로 조정].
  - Leader 확인: 알약 문구 A 「새 답 ↓」(권고)/B 「새 메시지 ↓」, 데모 vN+1 없이 진행 여부(권고: 진행 — 구조 불변, 기존 패턴 재사용).
  - 디자인 스킬: 미적용(light 트랙·데모 면제 — judge 데모 none 상당) / 자체 점검은 J-4(모션·초점·라이브 영역)·J-7 회귀 줄로 대신함.
