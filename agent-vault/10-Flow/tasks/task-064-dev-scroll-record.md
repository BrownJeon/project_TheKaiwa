---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-scroll
---
# task-064 질문 방 답 도착 스크롤 위치(dev-scroll, QA64-B2-1) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 규칙 정본: `docs/screens.md` §25-5 J(J-1~J-9) · 결정 이유: [[task-064-designer-scroll-record]] · 재현 수치: [[task-064-qa-b2-record]] `QA64-B2-1`·`B2-1 보강`. 전용 미러 `~/.node-local/thekaiwa-dev064s`(`.env` 없음 — `node_modules` 는 `cp -al` 하드링크, 소스·시험은 `rsync`).

## 수정한 파일 목록 (미커밋 · `git add` 없음)

| 구분 | 파일 | 변경 |
|---|---|---|
| 소스 신규 | `src/components/chat/arrivalAlign.ts` | 순수 계산·판정: `arrivalTarget`(J-1) · `questionIdBefore` · `isArrival` · `answerStartPlan`(규칙 1·2·3·3′ 갈림) · `isTopInView` · `windowGrowthAction`(J-3) · `rowTop`·`measureArrivalTarget`(가짜 상자로도 시험되는 DOM 측정) · `ARRIVAL_WINDOW_MS`=2000 |
| 소스 수정 | `src/components/chat/MessageList.tsx` | 선택 prop `arrivalAlign?: 'bottom' \| 'answer-start'`(기본 `'bottom'`)·`pillLabel?: string` + `answer-start` 분기(레이아웃 효과 정렬·알약·2초 창·만짐 리스너). 기본 모드의 바닥 붙임 4곳·알약 조건·글은 그대로 |
| 소스 수정 | `src/components/ask/AskRoom.tsx` | `<MessageList … arrivalAlign="answer-start" pillLabel={ASK_COPY.newAnswer} />` 두 줄 |
| 시험 신규 | `src/components/chat/__tests__/arrivalAlign.test.ts` | 순수 함수 34건(J-7 합격선 3폭 · 짧은 답 · 4,000자 · 키보드 · ⌊C/3⌋ · clamp 양끝 · 경계 · 판정표 · 2초 창 · 가짜 상자 측정) |
| 시험 신규 | `src/components/chat/__tests__/arrivalAlignWiring.test.ts` | 연결 14건(ASK 만 켬 · 기본 렌더 동일 · 알약 글 · 정리 · J-4·J-6 순서) |
| 기록 | `agent-vault/10-Flow/tasks/task-064-dev-scroll-record.md` | 이 파일 |

건드리지 않음: `askCopy.ts`(`ASK_COPY.newAnswer`=「새 답」이 이미 있어 새 상수 불필요) · `TalkRoom`·`ChatRoom` · `useChatTurn` · `docs/**` · `src/modules/engine/**`.

## Developer 기록

- [착수] 읽음: screens.md §25-5 J·25-3 A/C, designer 기록, QA-B2 기록, `MessageList.tsx`·`AskRoom.tsx`·`askCopy.ts`·`followHold.ts`·`useChatTurn.ts`(done/폴링 도착 경로)·시험 도구 `readCode`. 전용 미러 `dev064s` 생성(`cp -al` 0.4초). 기준선: `src/components/{chat,ask}` 시험 179건 통과, `tsc --noEmit` 오류 0(19초).
- [체크포인트 1] 완료: `src/components/chat/arrivalAlign.ts`(순수 — `arrivalTarget`·`questionIdBefore`·`isArrival`·`answerStartPlan`·`isTopInView`·`windowGrowthAction`·`rowTop`·`measureArrivalTarget`) 신규, `MessageList.tsx`(prop `arrivalAlign`·`pillLabel`, `answer-start` 분기, 2초 창, 알약), `AskRoom.tsx`(prop 두 개 켬). 순수 시험 `chat/__tests__/arrivalAlign.test.ts` 34건 통과, `tsc --noEmit` 오류 0, eslint(변경 3파일) 0. 남은 일: 연결(소스) 시험 `chat/__tests__/arrivalAlignWiring.test.ts` + SSR 기본 마크업 동일 시험 → 변이 6종 → 전체 게이트 → 기록 마감. 다음 첫 행동: wiring 시험 작성. 주의점: 미러는 `rsync -a --delete $P/src/ $M/src/` 로 동기화(`.env` 없음, `sync-local.sh` 는 `.env` 를 복사하므로 쓰지 않음). 미커밋 파일: 위 세 개 + 시험.
- [체크포인트 2] 시험 작성·변이·게이트 마감. 아래 표·게이트.

## 규칙 구현 요약 (J → 코드)

| 규칙 | 구현 |
|---|---|
| J-1 계산식 | `arrivalTarget` = `clamp(aTop − min(aTop − qTop, ⌊C/3⌋) − pad, 0, max)`. `aTop`·`qTop` 은 `rowTop`(행 `getBoundingClientRect().top − 상자 top + scrollTop`), `pad` 는 `getComputedStyle(목록).paddingTop`. 행 찾기는 `answer-start` 일 때만 붙는 `<li data-mid>` |
| 규칙 1 도착(바닥 120px 안) | 레이아웃 효과에서 `answerStartPlan` = `align` → `alignAndWatch(답 id)` (정렬 + 2초 창 + 알약 지움). 짧은 답은 clamp 로 자동 바닥 |
| 규칙 2 위로 올려 둔 채 도착 | plan `pill` → 위치 유지(앞붙임이 같이 왔으면 그 보정만), 답 행 윗면이 안 보일 때만 `pillId` 설정. 알약 = `pillLabel`+aria-hidden 「↓」, 누름 `onArrivalPill` = `alignAndWatch` + `focusList()`. 사라짐: 누름 · `onScroll` 에서 바닥 도달/윗면 보임 · `scrollToBottom` |
| 규칙 3·3′ 재진입 | 첫 로드(`p.count===0`)에서 마지막이 DONE 답이면 `align`, 대기·실패·내 질문뿐·빈 방은 `default`(맨 아래) |
| 규칙 4 보내기·칩·handoff | `scrollToBottom` 3흐름(AskRoom 호출 2곳) 그대로 + `answer-start` 면 알약·2초 창도 끝냄 |
| 규칙 5·6 | 계산은 늘 그 순간 DOM. 앞붙임·펼침 hold·바닥일 때만 따라감은 기존 코드 그대로 |
| J-3 2초 창 | `alignRef{answerId, until, touched}` + `followContent` 관찰자 콜백이 `windowGrowthAction` 으로 `realign`(같은 식 재계산) / `hold` / `follow` / `none`. 목록 `pointerdown·touchstart·wheel·keydown` → `touched`. **시간 비교만 — 타이머 0개**, 리스너는 같은 이름으로 해제, 관찰자 `disconnect` |
| J-4 | 이동은 모두 `scrollTop` 대입(즉시). 도착 때 초점·도착 status 줄·`liveOff`·`role=log` 불변, 초점은 알약 누를 때만 |
| J-5 | `arrivalAlign` 기본 `'bottom'`, `pillLabel` 기본 없음 → 「새 메시지 ↓」. 기본 렌더는 `arrivalAlign` 없음/`'bottom'` 마크업 문자열 동일(시험), `answer-start` 와의 차이는 `data-mid` 뿐 |
| J-6 ① | `alignTo` 가 `scrollTop` 대입 직후 `settleBottom` 으로 `atBottomRef`·`atBottom` 을 새 위치로 재측정 → 같은 커밋의 `[pendingVisible, turn.phase]` 효과·내용 따라가기가 되돌리지 않음. ② 알약은 `pillId`(도착 답 id) — `leftAtLastId` 안 씀. ③ 대기 행 생김은 `answerStartPlan`=`default`. ④ 측정·대입은 `useLayoutEffect` |
| J-7 | 시험 기대값으로 사용(3폭 C=583/687/735, ±2, 바닥 ±1) |

## 변이 시험 (전용 미러 `dev064s` 의 소스 **사본**에만 적용 → 시험 → `rsync` 원복, 끝나고 `diff -rq` 로 NFS 와 동일 확인)

| 변이 | 대상 | 실패한 시험 |
|---|---|---|
| ㄱ 정렬 기준을 답 윗면(`lead=0`) | `arrivalAlign.ts` | J-7 긴 답 3폭 · 4,000자 3폭 · 질문 행 > ⌊C/3⌋ · padTop · clamp 아래끝 · 경계 · ⌊C/3⌋ 버림 · measureArrivalTarget (12건) |
| ㄴ ⌊C/3⌋ 상한 제거 | `arrivalAlign.ts` | J-7 질문 행 > ⌊C/3⌋(360→206) · J-7 키보드(C≈283) · ⌊C/3⌋ 버림 (3건) |
| ㄷ 클램프 제거 | `arrivalAlign.ts` | J-7 짧은 답 3폭 · clamp 아래끝 · clamp 위끝 2건 · 경계 (7건) |
| ㄹ 기본값 `'answer-start'` | `MessageList.tsx` | ② 기본값 · ② 기본 렌더 동일 · ② answer-start 렌더 차이 (3건) |
| ㅁ `atBottomRef` 재측정 제거(`alignTo` 의 `settleBottom`) | `MessageList.tsx` | ⑤ J-6 ① (1건) |
| ㅂ 알약 문구 상수 제거(`pillLabel={ASK_COPY.newAnswer}`) | `AskRoom.tsx` | ① AskRoom 켬 · ③ 알약 (2건) |
| ㅅ(추가) `data-mid` 상시 | `MessageList.tsx` | ② 기본 렌더 · ② answer-start 렌더 (2건) |
| ㅇ(추가) `settleBottom` 에서 `atBottomRef` 갱신 제거 | `MessageList.tsx` | ⑤ J-6 ① (1건) |
| ㅈ(추가) 리스너 해제 제거 | `MessageList.tsx` | ④ 정리 (1건) |
| ㅊ(추가) 창 판정이 `touched` 무시 | `arrivalAlign.ts` | windowGrowthAction 만졌거나 끝남 (1건) |
| ㅋ(추가) 정렬한 커밋도 기본 규칙 실행 | `MessageList.tsx` | ⑤ J-6 ③④ (1건) |
| ㅌ(추가) 보내기가 2초 창을 안 끝냄 | `MessageList.tsx` | ⑤ J-6 ② (1건) |

## 게이트 (전용 미러 `~/.node-local/thekaiwa-dev064s`)

- `node --import tsx --test $(find src/components/chat src/components/ask -name '*.test.ts')` → **227건 통과 / 0 실패**(기준선 179 + 순수 34 + 연결 14).
- `node --import tsx --test --test-concurrency=1 $(find src/components -name '*.test.ts')` → 1,457건 중 통과 1,455 · 실패 0 (나머지 2건은 skipped, cancelled·todo 0).
- `tsc --noEmit --incremental false` → **오류 0**(17초, 다른 developer 의 `src/modules/engine` 미완성 변경이 섞였어도 통과).
- `eslint src/components/chat src/components/ask` → 오류 0·경고 0.
- 엔진명·모듈 경계: 변경 파일은 `components/chat`·`components/ask` 안 상대 import 뿐.

## QA 가 브라우저에서 확인할 것 (단위 시험으로 못 닫는 것)

1. J-7 표 실측 3폭 — 긴 답 도착(A1·A2: 질문 `<li>` 윗면 − 목록 위 12±2, `article` 범위 360 [48,242]·390 [48,277]·412 [48,293]), 짧은 답(되묻기 A3: 바닥 ±1·칩 4개 보임), 4,000자 합성(도착·재진입), 재진입 4방 × 3폭, 이어받은 대기 맨 아래 ±1.
2. **J-6 ① 실제 커밋 순서** — SSE `done` 로 긴 답이 도착한 직후 몇 프레임 지나서도 맞춘 자리에 머무는지(바닥으로 되돌아가면 `settleBottom` 순서 문제). 폴링 도착(이어받은 대기)도.
3. 위로 올려 둔 채 도착: `scrollTop` 변화 0(±1) · 「새 답 ↓」 1개(보이는 높이 36·히트 44) · 누르면 긴 답 기준 위치 + `document.activeElement` = 목록 · 알약이 바닥 도달/윗면 보임/다음 보내기에서 사라짐.
4. 2초 창: 폴링 도착 뒤 제안 카드가 붙어도 질문 `<li>` 윗면 변화 ≤2px, 예문 히라가나/한글 층 채움, 도착 직후 목록을 만지면(터치·휠·키) 더 이상 안 당겨 감. 값 2,000ms 는 [추측].
5. 키보드 열림(C≈283)·글자 200%·날짜 구분선이 질문/답 사이에 낀 경우.
6. 회귀: 채팅·회화·역할극 방에서 같은 시나리오(긴 답 도착·재진입·위로 올림)의 `scrollTop` 이 이전 빌드와 같고 알약 글이 「새 메시지 ↓」, DOM 차이 0.

## 설계 문서와 다르게 읽은 곳 · 남은 위험

- **알약을 안 띄우는 경우**: 위로 올려 둔 채 도착했지만 그 순간 답 행 윗면이 이미 보이는 영역 안이면 알약을 띄우지 않는다(J-2 규칙 2 의 「윗면이 들어옴 → 사라짐」과 같은 판정을 도착 시점에도 적용 — 안 그러면 첫 스크롤 이벤트에서 바로 사라진다). designer 규칙 문구에는 명시 없음 [가능성 높음 — 해석].
- `isArrival(prev, next)` 의 모양은 가이드 예시와 다르다: 같은 id 의 직전 상태(`prevStatus`)를 받는다 — 마지막 행끼리 비교하면 보내기가 거절돼 임시 말풍선이 걷히며 옛 답이 마지막이 될 때 도착으로 오인하기 때문(시험으로 고정).
- 2초 창은 `followContent` 관찰자를 쓴다 → `answer-start` 는 `followContent` 와 함께 넘겨야 한다(AskRoom 은 둘 다 넘기고 시험이 고정). 창 안에서 내용이 **줄어드는** 경우는 다시 맞추지 않는다(브라우저가 `scrollTop` 을 clamp) — 가이드 J-3 「내용이 늘 때」 그대로.
- 정렬 뒤 목록 상자 자체의 높이 변화(키보드 열고 닫기)에는 다시 맞추지 않는다(J-2 규칙 5 그대로). 첫 로드 직후 입력 바·표시 바 높이가 바뀌어 `C` 가 달라지면 첫 정렬 값이 어긋날 수 있다 [추측 — QA 재진입 실측에서 확인].
- 알약이 떠 있는 동안 `onScroll` 마다 `querySelectorAll('li[data-mid]')` 한 번 — 알약 구간(사용자가 위에서 읽는 동안)에만 돈다.
- 미러 `~/.node-local/thekaiwa-dev064s` 는 남겨 둠(`.env` 없음, 정리해도 무방).
