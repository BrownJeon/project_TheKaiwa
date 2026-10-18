---
task_id: task-075
role: developer
title: "task-075 developer 기록 — 오늘의 단어 덱 스와이프 방향 맞바꿈 (IMP-0050)"
created: 2026-10-18
tags:
  - type/task-record
  - domain/vocab
aliases:
  - task-075 개발 기록
---

# task-075 developer 기록

이력서 [[task-075-improve-deck-swipe-reverse]] · 선례 [[task-070-dev-record]] · track **light**(QA·데모 면제). 커밋·푸시·배포 안 함(미커밋). 데모 게이트 `check.mjs` → `DEMO_GATE_PASSED`(status not_required, judge none).

## 진행 로그
- [17:00] 이력서·070 기록·코드·시험 읽음 → 미러 `~/.node-local/thekaiwa-dev075`(= `cp -al` dev074-ui3, `.next` 삭제, src/tests/prisma rsync 후 `diff -rq` 동일 확인).
- [17:05] 코드 1차 완료(아래 변경 파일 9개). 편집은 저장소(NFS)에서 하고 미러에는 변경 파일만 `rsync`(임시 파일 후 rename — 하드링크 inode 오염 없음).
- [17:10] 시험 갱신·추가 → tsc 0 · eslint 0 · 전체 시험 4340/4337 통과 · build 0 · 변이 50/50 포착(아래).

## 한 줄 요약
**왼쪽 밀기 = 푼 카드는 다음 카드(마지막이면 결과)·안 푼 지금 카드는 건너뛰기 확인 시트, 오른쪽 밀기 = 이전 카드.** 방향 지도는 순수 함수 `cardFirst.swipeAction(side, state)` 한 곳에만 있고, 스택(`SwipeCardStack`)은 손가락이 간 쪽(`'left'|'right'`)을 가공 없이 `onSwipe` 로 넘기기만 한다(방향의 뜻을 모른다). 다음 카드로 넘어가는 카드는 **왼쪽**으로 날아간다(`FLY_OUT_TRANSFORM = translateX(-120%) rotate(-8deg)` — task-070 이전 값으로 복원). 위로 밀기·탭·버튼·키보드·서버·건너뛰기 기록은 손대지 않았다.

## 방향 지도: 070(전) → 075(후)

| 손가락 | 070 | 075 |
|---|---|---|
| 왼쪽 밀기 | 이전 카드(`deck.prev`) | **푼 카드 = 다음 카드**(`deck.next`, 마지막이면 결과) / **안 푼 지금 카드 = 건너뛰기 확인**(`askSkip`) |
| 오른쪽 밀기 | 푼 카드 = 다음 카드 / 안 푼 지금 카드 = 건너뛰기 확인 | **이전 카드**(`deck.prev`) |
| 날아가기 | 오른쪽(`translateX(120%) rotate(8deg)`) | **왼쪽**(`translateX(-120%) rotate(-8deg)`) |
| 끌 때 저항 | 왼쪽 = `canPrev(view)`, 오른쪽 = `canSwipeRight(skipCtx)` | 왼쪽 = `canSwipe('left')`(다음·확인 가능), 오른쪽 = `canSwipe('right')`(= `hasPrev`) |
| 키보드 | → 다음 · ← 이전 | **그대로** |

## 변경 파일 (코드 7 + 시험 2 = 9개, 12 이내 — light 유지)

| 파일 | 변경 |
|---|---|
| `src/components/vocab/deck.ts` | `FLY_OUT_TRANSFORM` 왼쪽 복원 · `SwipeSide` 타입 신설 · `resistX`/`canPrev` 주석(함수 본문 불변) |
| `src/components/vocab/cardFirst.ts` | `rightAction`·`canSwipeRight`·`RightResult` 삭제 → `swipeAction`·`canSwipe`·`runSwipe`·`SwipeState`·`SwipeResult` 신설 · `KEY_HINT` 터치 4종 새 문구 · 주석 |
| `src/components/vocab/SwipeCardStack.tsx` | props `canLeft/canRight/onLeft/onRight` → `canSwipe(side)`/`onSwipe(side)` · 판정 `g==='left'\|\|'right'` → `onSwipe(g)` · 저항 `resistX(drag.x, canSwipe('left'), canSwipe('right'))` · 머리말 |
| `src/components/vocab/VocabDeck.tsx` | `swipeCtx = { ...skipCtx, hasPrev: canPrev(view) }` · `onSwipe = (side) => runSwipe(side, swipeCtx, { next: deck.next, prev: deck.prev, ask: askSkip })` · 스택에 `canSwipe`·`onSwipe` · 머리말·무대 주석 |
| `src/components/vocab/useVocabDeck.ts` · `DeckToolbar.tsx` · `SkipConfirmSheet.tsx` | 주석의 왼쪽/오른쪽만 |
| `__tests__/deck.test.ts` · `__tests__/cardFirst.test.ts` | 아래 「시험 갱신」 |

## 설계 결정 (뒤집어도 되는 것은 reviewer/Leader 가)

- **D1 방향 지도 단일 출처** `swipeAction(side, state)`: 왼쪽 = busy → none / 푼 카드 → next / 안 푼 지금 카드 → ask / 그 밖 none, 오른쪽 = 늘 prev. 오른쪽이 늘 `prev` 인 이유는 070 이 `onLeft={deck.prev}` 를 직접 걸어 첫 카드 안내(「첫 카드예요」)와 넘기는 중 무시를 `deck.prev` 안에 두었기 때문이다 — 순수 함수에서 첫 카드를 `none` 으로 만들면 안내가 사라지는 변경이라 그대로 뒀다(L2). 첫 카드의 저항만 `canSwipe('right') = hasPrev` 가 맡는다.
- **D2 스택은 방향을 모른다**: 070 의 `onLeft/onRight/canLeft/canRight` 를 `onSwipe(side)`/`canSwipe(side)` 로 바꿔, 컴포넌트에 방향 literal 이 남지 않게 했다(남은 literal 은 `classifyGesture`(좌표→쪽) · `swipeAction`(쪽→동작) · 스택의 `resistX` 인자 순서 한 줄뿐). 방향 뒤집기 변이가 숨을 자리를 줄이려는 구조 변경이다. `runSwipe` 는 `swipeAction` 결과를 덱 동작에 잇는 얇은 함수라 스파이 핸들러로 **동작 시험**이 된다.
- **D3 `hasPrev`** 는 `canPrev(view)`(deck.ts) 값을 `swipeCtx` 로 넘긴다 — 첫 카드 판단의 출처는 그대로 한 곳.
- **D4 `FLY_OUT_TRANSFORM`** 은 task-070 이전 값(`translateX(-120%) rotate(-8deg)`, `git show 54b65d0^`)으로 복원했다. 제스처·[다음 카드]·키 → 모두 `deck.next` 의 `exiting` 하나를 거치므로 왼쪽으로 통일된다(L3).
- **D5 무대 `overflow-x-clip` 유지**: 070 은 오른쪽으로 날아가는 카드 때문에 넣었지만, 이제는 **이전 카드로 가려고 카드를 오른쪽으로 끌 때** `main`(overflow-y-auto → x 도 auto)에 가로 스크롤 범위가 생기는 쪽이 같은 위험이다. 지우면 070 이전 상태로 돌아가는 것이라 시험(변이 M43)을 그대로 두고 주석만 고쳤다.
- **D6 키보드(L5)**: `keyAction` 은 `ArrowRight → next`, `ArrowLeft → prev` 로 스와이프 지도(`swipeAction`)와 **묶여 있지 않았다**(`deck.next`/`deck.prev` 를 직접 부름). 동작·코드 그대로, `deck.test.ts` 에 「키는 스와이프 지도를 거치지 않는다」 주석과 변이 M09(화살표 키 서로 바꿈) 가드만 확인했다. 안 푼 카드에서 키 →·[다음 카드]는 막힘 안내(`blockedNextHint`)이고 제스처 왼쪽은 확인 시트라는 070 의 비대칭도 그대로다.
- **D7 ⚠ L3 괄호 예시와 현행 구현의 차이 — Leader 확인 필요**: L3 는 「오른쪽으로 밀면 오른쪽으로 사라져 이전 카드」라고 적었지만, 070 에서도(그 전에도) **이전 카드로 가는 전환에는 날아가기가 없다**(드래그가 원위치로 리셋되고 새 카드가 120ms 페이드로 나타남 — `useVocabDeck.prev` 가 바로 `goTo(v-1)`). 사용자는 070 의 이 전환을 폰에서 「정상」으로 확인했다. 이전 카드에 오른쪽으로 날아가는 연출을 넣으려면 `exiting` 을 방향 상태로 바꾸고 `prev` 를 타이머로 지연해야 하는데, 훅은 렌더 시험이 없어 회귀를 못 잡고 L2(방향만 바꾼다)를 넘는 새 연출이다. **추가하지 않았다.** 이전 카드도 오른쪽으로 날아가게 하고 싶으면 후속 요청으로 알려 달라.

## L2: 가장자리·막힘 동작 070 ↔ 075 대조

| 상황 | 070 (손가락) | 075 (손가락) | 같은가 |
|---|---|---|---|
| 첫 카드에서 이전 | 왼쪽 · 저항 ×0.25 · 놓으면 `deck.prev` 가 「첫 카드예요」 | **오른쪽** · 저항 ×0.25(`hasPrev=false`) · 놓으면 `deck.prev`(같은 안내) | 방향만 |
| 마지막 푼 카드에서 다음 | 오른쪽 → `deck.next` → `doFinish`(결과) | **왼쪽** → `deck.next` → `doFinish` | 방향만 |
| 안 푼 지금 카드 | 오른쪽 → 건너뛰기 확인 시트(`askSkip`, 기록은 시트에서만) | **왼쪽** → 같음 | 방향만 |
| 안 푼 지난 카드(있을 수 없는 상태) | 오른쪽 none · 저항 | **왼쪽** none · 저항 | 방향만 |
| 저장 중·넘기는/끝내는 중 | 드래그 시작 안 됨(`locked`)·오른쪽 none | 드래그 시작 안 됨 · **왼쪽** none (오른쪽 prev 는 `deck.prev` 가 `exitingRef`/phase 로 무시) | 방향만 |
| 키보드 →/← · [이전]·[다음 카드] | → `deck.next`(안 푼 카드는 막힘 안내) · ← `deck.prev` | 그대로 | 그대로 |
| 소리 멈춤(`view`/`exiting` 변화) | 카드가 바뀌면 멈춤 | 같음 | 그대로 |
| 이전 카드 전환 연출 | 날아가기 없음 · 120ms 페이드 | 같음 | 그대로(D7) |
| reduced-motion | 투명도만(0.12s) | 같음 | 그대로 |
| 위로 밀기·탭·건너뛰기 기록(#50) | — | — | 손대지 않음 |

## 문구 교체 목록 (전수 `grep -rn "왼쪽\|오른쪽\|← 밀어\|→ 밀어\|밀어" src` 후 교체 — 방향을 말하는 곳은 아래뿐이었다)

| 위치 | 070 | 075 |
|---|---|---|
| `KEY_HINT.touch` | ↑ 밀어 뜻 보기 · ← 밀어 이전 · → 밀어 건너뛰기 | ↑ 밀어 뜻 보기 · ← 밀어 건너뛰기 · → 밀어 이전 |
| `KEY_HINT.touchChoice` | ← 밀어 이전 · → 밀어 건너뛰기 | ← 밀어 건너뛰기 · → 밀어 이전 |
| `KEY_HINT.touchBack` | ← 밀어 이전 · → 밀어 건너뛰기 | ← 밀어 건너뛰기 · → 밀어 이전 |
| `KEY_HINT.touchDone` | ← 밀어 이전 · → 밀어 다음 | ← 밀어 다음 · → 밀어 이전 |
| 주석 | `deck.ts`(FLY_OUT·resistX·canPrev), `cardFirst.ts`(`canAskSkip`·`fixedHint`·`KEY_HINT` 머리·`swipeAction`), `SwipeCardStack.tsx`, `VocabDeck.tsx`(머리말·`onSwipe`·무대), `useVocabDeck.ts`(`next`·`prev`), `DeckToolbar.tsx`, `SkipConfirmSheet.tsx` | 새 방향 |

- 문구는 글자 수 그대로(touch 만 가장 길고 나머지는 ≤ — 시험이 글자 수로 묶음). `aria-label`·`aria-roledescription`·`GestureHint` 컴포넌트·`CARD_FIRST`·`HINT` 에는 방향 낱말이 없어 바꿀 곳이 없었다(`GestureHint` 는 힌트를 스크린리더에서 숨기고 버튼이 같은 기능을 한다 — 070 과 같음). 엔진명·모델명 없음(시험 `문구(task-060)` 정규식 통과).

## 시험 갱신 (기존 단언은 같은 강도로 방향만 바꿈 — 약화 없음)

| 시험 | 070 | 075 |
|---|---|---|
| `deck.test` resistX | 수치 단언 9개 + 부호 단언 1개 | **같은 호출·같은 기대값 그대로**(메시지만 새 의미: 왼쪽 = 다음·확인 가능, 오른쪽 = 이전 있음) |
| `deck.test` canPrev | 3 단언 | 그대로 |
| `deck.test` FLY_OUT | 정규식(양수)·`doesNotMatch(/-/)`·리터럴 일치 3개 | 정규식(음수 두 곳)·양수 값 없음·리터럴 일치 3개 |
| `deck.test` keyAction | → next · ← prev | 그대로(+ L5 주석) |
| `cardFirst.test` fixedHint 7갈래·터치 4갈래 | 문구 단언 | 같은 위치의 문구 단언만 새 문구로 |
| `cardFirst.test` 터치 힌트 문구 | `← 밀어 이전` 필수·`← 밀어 다음\|→ 밀어 이전` 금지 등 | `→ 밀어 이전` 필수·`→ 밀어 (다음\|건너뛰기)\|← 밀어 이전` 금지 등(키마다 같은 개수) + 글자 수 가드 그대로 |
| `cardFirst.test` rightAction(6행)·canSwipeRight(6단언) | 표 6행 · 6 단언 | **삭제 후 확장 교체**: ① `swipeAction` 왼쪽 8갈래 × `hasPrev` 2 = 16 ② 오른쪽 16 ③ 반대 방향 가드 16 ④ `canSwipe` 전수 ⑤ `runSwipe` 스파이 32갈래 ⑥ 손가락 좌표 → 동작 ⑦ 움직임 방향(끌기 부호·저항·날아가기 부호) ⑧ **힌트 ↔ `swipeAction` 일치**(상태 32갈래 중 안 푼 지난 카드 제외 24) |
| `cardFirst.test` 소스 스캔 | 스택 7 · 덱 ≈14 | 스택(손가락 쪽 → `onSwipe(g)` 가공 금지·호출 1곳·저항 인자 순서·FLY 상수·reduced-motion·잠금·기울기 부호) · 덱(`onSwipe`→`runSwipe` 핸들러 이음·`canSwipe(side,…)`·`hasPrev`·`overflow-x-clip`·`skipCtx`·키/버튼 불변) |

- 시험 수: 대상 3파일 78 → **85**, 전체 4333 → **4340**(+7: 삭제 2 + 신설 9).
- 정답표(`LEFT_TABLE`)는 **손으로 적은 8행** — 구현 식을 시험이 다시 계산하지 않는다. `runSwipe` 시험의 기대값도 이 표와 오른쪽 `prev` 고정에서 나온다.

## 증빙 (미러 `~/.node-local/thekaiwa-dev075`, 변경 파일 9개 `cmp` 저장소와 동일)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | **종료 0**, 출력 없음 |
| `./node_modules/.bin/eslint src/components/vocab` | **종료 0**, 출력 없음 |
| `node --import tsx --test … deck.test.ts cardFirst.test.ts deckStage.test.ts` | 85 tests · pass 85 · fail 0 |
| 전체 `find src scripts/seed-build -name '*.test.ts'` (`--test-concurrency=1`, 가짜 `DATABASE_URL`) | **4340 tests · pass 4337 · fail 0 · skipped 3**(건너뜀 3은 docs/모델 대조 — 기존) · 243.8s |
| 건너뛴 3개를 `KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO`=저장소 경로로 따로 실행(4파일) | 41 tests · pass 41 · fail 0 · skipped 0 |
| `./node_modules/.bin/next build > log 2>&1` | **종료 0**(`BUILD_EXIT=0`) |
| 번들(`.next`) 확인 | 새 문구 「← 밀어 다음 · → 밀어 이전」「← 밀어 건너뛰기 · → 밀어 이전」·`translateX(-120%) rotate(-8deg)`·`overflow-x:clip` 있음 · 옛 「← 밀어 이전」「→ 밀어 다음」「→ 밀어 건너뛰기」·`translateX(120%) rotate(8deg)` **0건** |
| 엔진명 누출 | 변경 파일은 모두 `src/components/vocab/**` — 새 문구에 엔진·모델명 없음 |
| `git status` | 내 변경은 `src/components/vocab/**` 9개뿐. `docs/screens.md`·`docs/demo/`는 designer(task-076)가 작업 중이라 손대지 않음 |

## 변이 점검 (50개 전부 포착 — 하니스 `scratchpad/mutate075.py`, 별도 미러 `thekaiwa-dev075-mut` 의 파일 하나를 **임시 파일에 써서 `os.replace`** 로 깨고 deck·cardFirst·deckStage 시험 85개를 돌린 뒤 저장소 원본으로 복원 — 끝나고 `cmp` 로 복원 확인)

| # | 변이 | 결과 | 잡은 시험(요약) |
|---|---|---|---|
| M01 | FLY_OUT 이동·기울기 모두 오른쪽(옛 070 값) | 포착 | FLY_OUT · 움직임 방향 |
| M02 | FLY_OUT 기울기만 오른쪽 | 포착 | FLY_OUT · 움직임 방향 |
| M03 | FLY_OUT 이동만 오른쪽 | 포착 | FLY_OUT · 움직임 방향 |
| M04 | resistX 왼쪽이 canRight 를 봄 | 포착 | resistX · 움직임 방향 |
| M05 | resistX 오른쪽이 canLeft 를 봄 | 포착 | resistX · 움직임 방향 |
| M06 | resistX 왼쪽 저항 제거 | 포착 | resistX · 움직임 방향 |
| M07 | classifyGesture 좌우 반전 | 포착 | 손가락→동작 · 움직임 방향 · classifyGesture |
| M08 | canPrev 가 첫 카드 허용 | 포착 | canPrev |
| M09 | 키 ArrowRight/Left 서로 바꿈(L5) | 포착 | keyAction 2개 |
| M10 | swipeAction 오른쪽이 next | 포착 | 힌트↔동작 · swipeAction 오른쪽 외 5 |
| M11 | swipeAction 오른쪽이 첫 카드에서 none(안내 소실) | 포착 | swipeAction 오른쪽 · runSwipe |
| M12 | swipeAction 왼쪽 busy 검사 제거 | 포착 | swipeAction 왼쪽 · canSwipe |
| M13 | swipeAction 푼 카드가 ask | 포착 | 힌트↔동작 · swipeAction 왼쪽 외 5 |
| M14 | 푼/안 푼 분기 뒤바뀜(안 푼 → next) | 포착 | 동일 |
| M15 | 방향 조건 반전(left 가 prev) | 포착 | 8개 |
| M16 | 안 푼 지난 카드도 ask(canAskSkip 우회) | 포착 | swipeAction 왼쪽 외 5 |
| M17 | canSwipe 오른쪽이 `!hasPrev` | 포착 | canSwipe · 움직임 방향 |
| M18 | canSwipe 왼쪽이 늘 true | 포착 | canSwipe · 움직임 방향 |
| M19 | canSwipe 오른쪽이 늘 true(첫 카드 저항 누락) | 포착 | canSwipe · 움직임 방향 |
| M20 | runSwipe next 가 prev 를 부름 | 포착 | runSwipe |
| M21 | runSwipe ask 가 next 를 부름(바로 다음) | 포착 | runSwipe |
| M22 | runSwipe prev 호출 누락 | 포착 | runSwipe |
| M23 | KEY_HINT.touch 옛 070 문구 | 포착 | fixedHint 7갈래 · 터치 힌트 문구 외 |
| M24 | KEY_HINT.touchDone 옛 070 문구 | 포착 | fixedHint 터치 4갈래 외 |
| M25 | KEY_HINT.touchBack 옛 070 문구 | 포착 | fixedHint 터치 4갈래 외 |
| M26 | KEY_HINT.touchChoice 낱말 틀림(다음) | 포착 | fixedHint 7갈래 · 터치 힌트 문구 외 |
| M27 | fixedHint 4지선다 분기를 답함 앞으로 | 포착 | fixedHint 7갈래·터치 4갈래 외 |
| M28 | fixedHint 뒷면 힌트가 touch(↑ 포함) | 포착 | fixedHint 터치 4갈래 |
| M29 | canAskSkip 가 푼 카드도 허용 | 포착 | canAskSkip |
| M30 | 스택: 좌우를 뒤집어 onSwipe 에 | 포착 | 구조(스택) |
| M31 | 스택: 저항 인자 순서 뒤바뀜 | 포착 | 구조(스택 저항) |
| M32 | 스택: 날아가기 literal 을 오른쪽으로(상수 우회) | 포착 | 구조(스택) |
| M33 | 스택: reduced-motion 도 날아감 | 포착 | 구조(스택) |
| M34 | 스택: 드래그 잠금에서 locked 제거 | 포착 | 구조(스택) |
| M35 | 스택: 오른쪽 판정 무시 | 포착 | 구조(스택) |
| M36 | 스택: 끌 때 기울기 부호 반전 | 포착 | 구조(스택) |
| M37 | 덱: 저항 side 를 뒤집어 canSwipe 에 | 포착 | 구조(덱) |
| M38 | 덱: hasPrev 가 늘 true | 포착 | 구조(덱) |
| M39 | 덱: next/prev 핸들러 서로 바꿈 | 포착 | 구조(덱) |
| M40 | 덱: ask 가 바로 deck.skip | 포착 | 구조(덱) · 구조(건너뛰기 한 곳) |
| M41 | 덱: onSwipe 가 side 를 뒤집어 runSwipe 에 | 포착 | 구조(덱) · 구조(건너뛰기 한 곳) |
| M42 | 덱: skipCtx.busy 가 늘 false | 포착 | 구조(덱) |
| M43 | 덱: 무대 overflow-x-clip 제거 | 포착 | 구조(덱) |
| M44 | 덱: onSwipe 연결 끊음 | 포착 | 구조(덱 배선 2개) |
| M45 | 덱: swipeCtx 에서 isCurrent 고정 | 포착 | 구조(덱) |
| M46 | 훅: prev 첫 카드 안내 제거 | 포착 | 구조(훅) |
| M47 | 훅: next 마지막 푼 카드 결과 분기 제거 | 포착 | 구조(훅) |
| M48 | 훅: next 안 푼 카드 막힘 안내 제거 | 포착 | 구조(훅) |
| M49 | 훅: prev 가 두 칸 뒤로 | 포착 | 구조(훅) |
| M50 | 훅: next 가 두 칸 앞으로 | 포착 | 구조(훅) |

**생존 0 / 50.** 방향·상태 규칙(M04~M22, M29)은 동작 시험이, 문구(M23~M28)는 문구 + `swipeAction` 일치 시험이, 배선(M30~M45)과 훅(M46~M50)은 소스 스캔이 잡는다. 스택·덱의 배선 변이는 렌더 시험이 없어 소스 스캔에 기댄다(다음 한계 참조).

## 알려진 한계

- **L1 터치 제스처 실기기 미확인**: 이 환경에는 jsdom/브라우저 입력이 없어 touchstart→touchend 로 `onSwipe` 가 불리는 경로는 소스 스캔으로만 묶었다(좌표 → 쪽 = `classifyGesture`, 쪽 → 동작 = `swipeAction`/`runSwipe` 는 동작 시험). 폰에서 확인할 것: ① 푼 카드를 왼쪽으로 밀면 카드가 **왼쪽으로 날아가** 다음 카드, 마지막 푼 카드면 결과 ② 안 푼 카드를 왼쪽으로 밀면 건너뛰기 확인 시트(취소하면 그대로) ③ 오른쪽으로 밀면 이전 카드(첫 카드는 오른쪽으로 조금만 따라오고 「첫 카드예요」) ④ 터치 힌트 한 줄이 360px 에서 잘리지 않는지 ⑤ 옛 습관(070: 오른쪽 = 다음)으로 푼 카드를 오른쪽으로 밀면 **이전**으로 가는 점.
- **L2 훅 `useVocabDeck` 은 렌더하지 않는다**: `prev`/`next` 실제 상태 전이는 소스 스캔(070 에서 만든 것)으로만 묶인다. 이번 변경은 훅 로직을 건드리지 않았다(주석만).
- **L3 이전 카드 전환은 날아가기 없음**(D7) — Leader 확인 필요.
- **L4 `KEY_HINT.touchChoice` 와 `touchBack` 이 같은 문자열**이라 `fixedHint` 에서 두 분기를 서로 바꾸는 변이는 동등 변이다(070 L3 과 같다) — 시험이 못 잡는 것이 정상.
- **L5 `overflow-x-clip` 은 CSS 효과라** 클래스 존재만 스캔한다. 데스크톱에서 카드를 오른쪽으로 크게 끌면 화면 가장자리에서 잘린다(손가락 드래그의 정상 모습).

## 문서 동기화 필요 (`docs/screens.md` — 개발자 수정 금지, designer/Leader 가 구현 뒤 반영)

070 지도(왼쪽 = 이전, 오른쪽 = 다음/건너뛰기)를 말하는 줄이 **§24-6 표·저항·안내 문구·알려진 한계(≈ 10643–10652행)** 와 그 요약인 **§24-1 두 행(≈ 10587·10606·10622·10629행) · §5 제스처/조작 수/목업 힌트(≈ 1313·1314·1477·1630–1632행) · §23 D0·상태 표·공통 줄·소리 줄(≈ 10120·10156·10208–10220·10258·10263·10357행)** 에 남아 있다(grep: `왼쪽 밀기|오른쪽 밀기|← 밀어|→ 밀어|translateX\(120|rightAction|canSwipeRight`, 행 번호는 designer 작업 중이라 어긋날 수 있다). 새 지도와 새 이름(`swipeAction`/`canSwipe`/`runSwipe`, `FLY_OUT_TRANSFORM = translateX(-120%) rotate(-8deg)`, 터치 힌트 4문구)은 위 「방향 지도」·「문구 교체 목록」 표를 그대로 옮기면 된다. 070 이 쓴 표기 방식(`[⚠ task-075 → §24-6]`)을 따르는 편이 안전하다.

## 환경 메모 (재발 가능 문제)

- **Fact-Forcing Gate(파괴적 명령 훅)**: `rm -rf` 가 포함된 명령은 첫 호출이 차단되고 안내(대상·되돌리기·사용자 지시 원문)를 요구한다. 안내를 본문에 적은 뒤 **글자 하나 다르지 않은 같은 명령을 다시 호출**해야 통과한다(명령을 조금이라도 바꾸면 다시 차단 — 이번에 3번 막혔다). 한 명령에 `cp -al`·`rsync --delete`·`rm -rf` 를 묶으면 전체가 막히므로 나눠 실행했다.
- **하드링크 미러 오염(ISS-0009 관련)**: `tsc --noEmit` 가 `incremental: true` 라 `tsconfig.tsbuildinfo` 를 **제자리 쓰기** 해서 같은 inode 를 공유하는 다른 미러(dev074-ui3 외 4곳, link 6)의 캐시 파일이 바뀌었다(17:01). 소스·`node_modules` 는 아니고 tsc 가 파일 해시로 다시 검증하는 캐시지만, 이후 내 미러(dev075)는 `tsconfig.tsbuildinfo`·`next-env.d.ts` 를 `cp -p` 후 `mv` 로 **링크를 끊어** 쓴다(link 1). 다른 미러는 건드리지 않았다. 미러 생성 도구가 생기면 이 두 파일은 복사 대상에 넣을 것.
- 미러 편집 방식: 저장소(NFS)가 유일한 원본이고 미러에는 변경 파일만 `rsync`(임시 파일+rename) — 지시의 「미러에서 작업 후 결과 복사」와 방향만 반대, 결과는 `cmp` 동일.

## reviewer 가 볼 곳

1. `cardFirst.ts` `swipeAction`/`canSwipe`/`runSwipe` ↔ `VocabDeck.tsx` `onSwipe`·`swipeCtx` ↔ `useVocabDeck.next/prev` — 왼쪽 밀기가 안 푼 카드에서 막힘 안내가 아니라 확인 시트를 여는지, 푼 카드·마지막 푼 카드에서 `deck.next`(→ 결과)로 가는지, 오른쪽이 늘 `deck.prev` 인지.
2. `SwipeCardStack.tsx` — `onSwipe(g)` 가공 없음, `resistX(drag.x, canSwipe('left'), canSwipe('right'))` 순서, `FLY_OUT_TRANSFORM`(왼쪽), reduced-motion 분기.
3. 결정 D5(`overflow-x-clip` 유지)·D7(이전 카드 날아가기 없음) — 유지·변경 판단.
4. 시험 변경이 약화가 아닌지(위 「시험 갱신」 표): resistX 단언 10개(호출·기대값) 동일, FLY_OUT 3 단언 동일 강도, rightAction/canSwipeRight → 표 전수로 확장.
5. 재실행(미러): `./node_modules/.bin/tsc --noEmit` · `./node_modules/.bin/eslint src/components/vocab` · `node --import tsx --test --test-concurrency=1 src/components/vocab/__tests__/{deck,cardFirst,deckStage}.test.ts` · 변이 `python3 scratchpad/mutate075.py 1 25` / `26 50`(미러 `thekaiwa-dev075-mut`, 저장소 원본으로 복원).

## 미커밋 파일
`src/components/vocab/{deck.ts,cardFirst.ts,SwipeCardStack.tsx,VocabDeck.tsx,useVocabDeck.ts,DeckToolbar.tsx,SkipConfirmSheet.tsx}` · `src/components/vocab/__tests__/{deck,cardFirst}.test.ts` · 이 기록 · 이력서 상태 로그 한 줄. (`docs/screens.md`·`docs/demo/**`·task-076 파일은 다른 에이전트 몫.)

## REV-075 F1 보강

reviewer 감사 [[task-075-reviewer-record]] 의 Low 발견 F1(끌 때 `translateX(${shownX}px)` 부호를 시험이 안 묶음, 변이 R05·R06 생존)만 처리했다. **제품 코드 변경 0**, 시험 파일 한 곳.

**추가한 것** — `src/components/vocab/__tests__/cardFirst.test.ts` 의 「구조(task-075): 스택」 소스 스캔 묶음 바로 뒤에 시험 1개를 새로 두었다(기존 단언은 한 줄도 바꾸지 않음. 같은 시험 안에 넣으면 총 개수가 85 에 머물러 별도 시험으로 분리 — 실패 이름도 또렷해진다).
`구조(task-075): 스택 — 끌기 translateX 는 일반·reduced-motion 두 분기 모두 shownX 그대로(부호 반전 없음)`
1. `SwipeCardStack.tsx` 에서 `translateX(${shownX}px)` 리터럴이 **정확히 2곳**(일반 분기 · reduced-motion 분기).
2. `translateX(` 자체도 **정확히 2곳** — 세 번째 형태가 생기거나 한 곳이 다른 식으로 바뀌면 잡는다.
3. 부호 반전 형태(`translateX(${-shownX}px)` · `translateX(-${shownX}px)`)가 없음(`/translateX\(\s*(?:\$\{\s*-|-\s*\$\{)/`).

**실행 증빙**(미러 `~/.node-local/thekaiwa-dev075`, 변경한 시험 파일 하나만 임시 파일 + `mv` 로 반영하고 저장소와 `cmp` 동일, `tsconfig.tsbuildinfo` 링크 수 1 확인 후 실행)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 0, 출력 없음 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 0, 출력 없음 |
| `node --import tsx --test --test-concurrency=1 src/components/vocab/__tests__/{deck,cardFirst,deckStage}.test.ts` | **86 tests · pass 86 · fail 0 · cancelled 0 · skipped 0** (이전 85 → 86) |

**변이 확인 — 별도 미러 `~/.node-local/thekaiwa-dev075-mut`** (변이 전 저장소와 `SwipeCardStack.tsx` 동일 확인, 임시 파일 + `os.replace` 로 교체, 하니스 `scratchpad/f1-mut.py`)

| # | 변이 | 결과 |
|---|---|---|
| R05 | 일반 분기 `translateX(${-shownX}px)` | **포착** — 새 시험만 실패 |
| R06 | reduced-motion 분기 `translateX(${-shownX}px)` | **포착** — 새 시험만 실패 |
| R05b | 일반 분기 `translateX(-${shownX}px)` | **포착** |
| R06b | reduced-motion 분기 `translateX(-${shownX}px)` | **포착** |

변이 **2/2**(요청분 R05·R06) 포착, 변형 2개도 포착(합 4/4). 실패한 시험은 매번 새 시험 1개뿐이라 기존 85개와 겹치지 않는다. 끝나고 변이 미러의 `SwipeCardStack.tsx` 를 저장소 원본으로 복원했고 `cmp` 로 저장소 = 미러 동일(시험 파일도 동일)을 확인했다.

**주의점** — 리터럴 개수 단언이라 `shownX` 변수명을 바꾸거나 두 분기를 하나의 식으로 합치는 리팩터링을 하면 이 시험도 함께 고쳐야 한다(의도된 결합). 렌더 시험이 없는 환경에서 소스 스캔이 현실적 방어선이라는 감사 권고와 같다. 변경 파일은 시험 `cardFirst.test.ts` 와 이 기록뿐이다.
