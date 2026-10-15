---
task_id: task-070
role: developer
title: "task-070 developer 기록 — 오늘의 단어 덱 좌우 스와이프 방향 변경 (IMP-0044)"
created: 2026-10-15
tags:
  - type/record
  - domain/vocab
aliases:
  - task-070 개발 기록
---

# task-070 developer 기록

이력서 [[task-070-improve-deck-swipe-prev]] · 백로그 [[IMP-0044-deck-swipe-left-prev]] · track **light**(QA·데모 면제). 커밋·푸시·배포 안 함(미커밋). 데모 게이트 `check.mjs` → `DEMO_GATE_PASSED`(status not_required, judge none).

## 한 줄 요약
왼쪽 밀기 = 이전 카드(`deck.prev`), 오른쪽 밀기 = 푼 카드는 다음 카드(마지막이면 결과 — `deck.next`)·안 푼 카드는 건너뛰기 확인 시트. 갈림은 순수 함수 `cardFirst.rightAction` 이 `next | ask | none` 으로 돌려주고 부모는 그 결과로만 분기. 다음 카드로 넘어가는 카드는 늘 오른쪽으로 날아간다. 위로 밀기·탭·답하기·건너뛰기 기록(#50)·키보드·버튼은 손대지 않았다.

## 변경 파일 (10개 — 12 이내, light 유지)

| 파일 | 변경 |
|---|---|
| `src/components/vocab/deck.ts` | `resistX(x, canLeft, canRight)` 새 지도(왼쪽 = 이전 카드 있음, 오른쪽 = 다음·확인 가능) · `canPrev(view)` 신설 · `FLY_OUT_TRANSFORM = 'translateX(120%) rotate(8deg)'` 신설 |
| `src/components/vocab/cardFirst.ts` | `rightAction` → `RightResult = next \| ask \| none`(힌트 종류 폐기) · `canSwipeRight` 신설 · `GestureResult` 에서 `ask` 제거 · `CARD_FIRST.prevByButton` 삭제 · `KEY_HINT` 터치 4종 새 문구 · `fixedHint` 터치 갈래 순서(답함 → 4지선다) |
| `src/components/vocab/SwipeCardStack.tsx` | props `canGoNext/canSkip` → `canLeft/canRight`, 날아가기 `FLY_OUT_TRANSFORM`(오른쪽), 머리말 갱신. 판정(`g === 'left'` → `onLeft`, `'right'` → `onRight`)은 그대로 |
| `src/components/vocab/VocabDeck.tsx` | `onLeft={deck.prev}` · `onRight` = `rightAction` 결과로 분기(`next` → `deck.next()`, `ask` → `askSkip()`) · `canLeft={canPrev(view)}` · `canRight={canSwipeRight(skipCtx)}` · 무대에 `overflow-x-clip`(아래 결정 D4) · 머리말 갱신 |
| `src/components/vocab/useVocabDeck.ts` | `prev` 가 `canPrev(v)` 사용(첫 카드 안내 동일) · 주석. 로직 변경 없음 |
| `src/components/vocab/SkipConfirmSheet.tsx`, `DeckToolbar.tsx` | 주석만(「안 푼 카드의 오른쪽 밀기」) |
| `src/components/vocab/__tests__/deck.test.ts` | `resistX` 새 지도 · `canPrev` · `FLY_OUT_TRANSFORM` |
| `src/components/vocab/__tests__/cardFirst.test.ts` | `rightAction`·`canSwipeRight`·`fixedHint`·`KEY_HINT` 갱신, 소스 스캔 3개(스택·덱·훅) 신설 + 옛 구조 시험 2개 갱신 |
| `docs/screens.md` | §24-6 신설 + 옛 서술에 `[⚠ task-070 → …]` 표기·갱신(§5 제스처·목업·조작 수·힌트·표·체크리스트, §23 D0·상태 표·공통 줄·소리·높이 수정 메모·⑪, §24-1 두 행·24-3·24-4·24-5) |

## 설계 결정 (사양과 달라진 점 / 사양에 없던 추가 — reviewer 가 뒤집어도 된다)

- **D1 (사양 L1·L4 그대로)** 왼쪽 밀기가 하던 일을 코드로 읽고 오른쪽으로 옮겼다. `deck.next` 가 이미 안 푼 카드 막힘(`blockedNextHint`)·마지막 푼 카드 결과(`doFinish`)·날아가기(`exiting`)를 다 가지므로 푼 카드의 오른쪽은 `deck.next()` 를 부르기만 한다 — 마지막 카드·막힘 판단을 컴포넌트에 복제하지 않았다. 안 푼 카드는 `deck.next` 의 막힘 안내를 거치지 않고 건너뛰기 확인으로 간다(키 →·[다음 카드]는 막힘 안내 그대로 — L5 비대칭).
- **D2 `rightAction` 의 `busy`** 는 푼 카드에도 적용(무반응). 드래그 자체가 `locked` 에서 시작되지 않아 실제 경로에선 도달하지 않지만 순수 함수가 같은 규칙을 말하도록 했다. 안 푼 **지난** 카드(있을 수 없는 상태)는 이전의 「[이전] 안내」 대신 `none`. 안내 문구 종류(`hint`)가 사라져 `CARD_FIRST.prevByButton` 과 시험의 단언을 삭제했다.
- **D3 저항 입력** = `canPrev(view)`(deck.ts) / `canSwipeRight(skipCtx)`(= `rightAction(...).kind !== 'none'`). `resistX` 는 인자 이름만 방향 기준(`canLeft`/`canRight`)으로 바뀐 순수 함수. 마지막 푼 카드의 오른쪽은 자유(결과로 감) — 옛 왼쪽 밀기와 동일.
- **D4 (사양 외 추가) 무대 `overflow-x-clip`** — `main` 은 `overflow-y-auto`(→ x 도 auto)라 카드가 `translateX(120%)` 로 오른쪽으로 날아가면 가로 스크롤 범위가 180ms 생긴다(옛 왼쪽 날기는 음수 방향이라 스크롤 범위를 만들지 않았다). 데스크톱의 상시 스크롤바에서는 높이가 15px 줄며 덱이 튈 수 있다. 무대 `div` 한 곳에서 가로만 자른다(세로 `bump` 는 잘리지 않음, 번들 CSS 에 `.overflow-x-clip{overflow-x:clip}` 확인). 불필요하다고 보면 한 단어 삭제로 되돌릴 수 있고 변이 M25 가 이 스캔을 묶는다. 디자인 결정이 아니라 레이아웃 방어라고 판단했으나 designer 의견이 필요하면 Leader 가 돌려 달라.
- **D5 (사양 외 추가) `fixedHint` 터치 갈래에서 「답한 카드/지난 카드」를 「이전 4지선다」보다 먼저 판단** — 옛 순서는 답한 4지선다 카드에도 「→ 밀어 건너뛰기」를 말했는데 새 지도에서 그 카드의 → 는 다음이다(거짓 안내). 옛 시험이 「4지선다 터치는 면과 무관」을 단정하던 것을 안 답한 카드로 좁혀 고쳤다.
- **D6 문구**(L6, 31자 이하 한 줄 유지, 손가락 방향 기준): `touch` 「↑ 밀어 뜻 보기 · ← 밀어 이전 · → 밀어 건너뛰기」 · `touchChoice`·`touchBack` 「← 밀어 이전 · → 밀어 건너뛰기」 · `touchDone` 「← 밀어 이전 · → 밀어 다음」. `touchChoice` 와 `touchBack` 이 같은 문자열이 됐지만 근거(4지선다 안 답함 / 뜻 본 카드)가 달라 키는 두 개로 둔다 — 둘의 분기를 서로 바꾸는 변이는 동등 변이라 시험이 못 잡는다(알려진 한계 L3).
- **D7 날아가는 방향**(L3): 제스처·[다음 카드]·키 →·자동 다음 모두 `deck.next` 의 `exiting` 하나를 거치므로 `FLY_OUT_TRANSFORM` 한 곳을 바꿔 통일했다. reduced-motion 은 기존대로(투명도 0.12s, transform 없음). 이전 카드는 날아가기 없이 바로 전환(새 카드 120ms 페이드) — 기존과 같다.
- **하지 않은 것**: 위로 밀기·탭·답하기 로직·건너뛰기 기록·키 매핑·버튼 구성·6층 경계·API·스키마·네이티브. 새 의존성 없음.

## 증빙 (미러 `~/.node-local/thekaiwa-dev070`, 저장소 src/tests/package.json rsync 동기 후)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | **종료 0**, 출력 없음 |
| `./node_modules/.bin/eslint src/components/vocab` | **종료 0**, 출력 없음 |
| `node --import tsx --test … deck.test.ts cardFirst.test.ts deckStage.test.ts` | 78 tests · pass 78 · fail 0 |
| vocab 전체 `find src/components/vocab -name '*.test.ts'` | 267 tests · pass 267 · fail 0 |
| 전체 `find src scripts/seed-build -name '*.test.ts'` (`--test-concurrency=1`) | **4108 tests · pass 4106 · fail 0 · skipped 2**(건너뜀 2는 기존, task-069 기준 4101/4099 → +7 시험) |
| `DATABASE_URL=가짜 ./node_modules/.bin/next build > /tmp/claude-1000/dev070-build.log 2>&1` | **종료 0** |
| 번들 확인(`.next`) | 새 문구 「← 밀어 이전 · → 밀어 다음」·`translateX(120%) rotate(8deg)`·`.overflow-x-clip{overflow-x:clip}` 있음 · 옛 「← 밀어 다음」·「이전 카드는 아래 [이전] 버튼으로 가요」·`translateX(-120%)` 없음 |
| 엔진명 누출 | 변경 파일은 모두 `src/components/vocab/**` — 새 문구에 엔진·모델명 없음(시험 `문구(task-060)` 의 정규식 통과) |

## 변이 점검 (35개 전부 사망 — 하니스 `mutate070.py`, 미러의 파일 하나를 깨고 `deck`·`cardFirst`·`deckStage` 시험 78개를 돌린 뒤 NFS 원본으로 복원)

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M01 | resistX 왼쪽이 `canRight` 를 봄 | 사망 | resistX 새 지도 |
| M02 | resistX 오른쪽이 `canLeft` 를 봄 | 사망 | resistX 새 지도 |
| M03 | resistX 왼쪽 저항 제거 | 사망 | resistX 새 지도 |
| M04 | `canPrev` 가 첫 카드 허용(`>= 0`) | 사망 | canPrev |
| M05 | 날아가기를 옛 값(왼쪽 −120%)으로 | 사망 | FLY_OUT_TRANSFORM |
| M06 | `rightAction` 푼 카드가 `ask` | 사망 | rightAction |
| M07 | `rightAction` busy 검사 제거 | 사망 | rightAction · canSwipeRight |
| M08 | `rightAction` 안 푼 카드를 항상 `ask` | 사망 | rightAction · canSwipeRight |
| M09 | `canSwipeRight` 가 `next` 만 자유 | 사망 | canSwipeRight |
| M10 | `fixedHint` 4지선다 분기를 답함 앞으로(옛 순서) | 사망 | fixedHint 2개 |
| M11 | `KEY_HINT.touch` 왼쪽 = 다음(옛 문구) | 사망 | fixedHint · 터치 힌트 문구 |
| M12 | `touchDone` 에 「→ 밀어 건너뛰기」 | 사망 | fixedHint 터치 4갈래 · 터치 힌트 문구 |
| M13 | `prevByButton` 안내 부활 | 사망 | rightAction(`'prevByButton' in CARD_FIRST`) |
| M14 | 스택: 왼쪽 판정이 `onRight` | 사망 | 구조 스택 |
| M15 | 스택: 오른쪽 판정이 `onLeft` | 사망 | 구조 스택 |
| M16 | 스택: 날아가기 literal 을 왼쪽으로(상수 우회) | 사망 | 구조 스택 |
| M17 | 스택: `resistX(drag.x, canRight, canLeft)` 인자 뒤바뀜 | 사망 | 구조(저항) |
| M18 | 스택: reduced-motion 도 날아감 | 사망 | 구조 스택 |
| M19 | 덱: `onLeft={deck.next}` | 사망 | 구조 덱 |
| M20 | 덱: onRight 의 `next` 분기가 `deck.prev()` | 사망 | 구조 덱 |
| M21 | 덱: `canLeft={true}` | 사망 | 구조 덱 |
| M22 | 덱: `canRight` 가 옛 규칙(`canAskSkip`) | 사망 | 구조 덱 |
| M23 | 덱: `ask` 분기가 바로 `deck.skip()` | 사망 | 구조 덱 · 구조(건너뛰기 한 곳) |
| M24 | 덱: `onRight={deck.next}`(rightAction 우회) | 사망 | 구조 덱 · 구조(건너뛰기 한 곳) |
| M25 | 덱: 무대 `overflow-x-clip` 제거 | 사망 | 구조 덱 |
| M26 | 훅: `prev` 첫 카드 안내 제거 | 사망 | 구조 훅 |
| M27 | 훅: `next` 마지막 푼 카드 결과 분기 제거 | 사망 | 구조 훅 |
| M28 | 훅: `next` 안 푼 카드 막힘 안내 제거 | 사망 | 구조 훅 |
| M29 | 훅: `next` reduced-motion 시간 제거 | 사망 | 구조 훅 |
| M30 | 덱: `skipCtx.busy` 가 늘 false | 사망 | 구조 덱 |
| M31 | 덱: `locked` 에서 `exiting` 제거 | 사망 | 구조 덱 |
| M32 | 덱: 소리 멈춤 효과가 `view` 를 안 봄 | 사망 | 구조 덱 |
| M33 | 스택: 드래그 잠금에서 `locked` 제거 | 사망 | 구조 스택 |
| M34 | 훅: `prev` 가 두 칸 뒤로(`v - 2`) | 사망 | 구조 훅 |
| M35 | 훅: `next` 가 두 칸 앞으로(`v + 2`) | 사망 | 구조 훅 |

생존 0. task-069 의 교훈(훅·배선 시험 구멍)에 따라 첫 구현에서 소스 스캔 3종(스택·덱·훅)과 `skipCtx`·`locked`·소리 멈춤 효과 스캔을 함께 넣었다. 스캔은 `readCode`(주석 제거) 위에서 `\s*` 로 공백에 둔감한 정규식이다 — 줄 번호에 기대지 않는다.

## 알려진 한계

- **L1 실기기 미확인** — 오른쪽 문턱(60px)에서 푼 카드는 다음, 안 푼 카드는 확인 시트로 갈리는 체감, 옛 습관(오른쪽 = 이전)으로 푼 카드를 밀면 **다음**으로 가 버리는 점(되돌림은 왼쪽 밀기·[이전]) — 사용자 폰 몫.
- **L2 훅은 렌더하지 않는다** — `useVocabDeck` 은 소스 스캔으로만 묶었다(훅을 렌더하는 시험은 만들지 않았다). `prev`/`next` 실제 상태 전이(`goTo`·`exiting` 타이머)는 스캔이 아니라 기존 동작을 그대로 쓰는 것에 기댄다. 브라우저/폰에서 왼쪽 밀기 → 이전 카드, 마지막 푼 카드 오른쪽 → 결과를 직접 보는 것이 가장 확실하다.
- **L3 동등 변이** — `KEY_HINT.touchChoice` 와 `touchBack` 이 같은 문자열이라 `fixedHint` 에서 두 분기를 서로 바꿔도 시험이 못 잡는다(결과 동일).
- **L4 `overflow-x-clip` 은 CSS 효과라 단위 시험으로 클립 동작을 보지 못한다**(클래스 존재만 스캔). 데스크톱에서 카드를 크게 끌면 화면 가장자리에서 잘린다(손가락 드래그의 정상 모습).
- **L5 `deck.canNext`**(deck.ts)는 이전부터 컴포넌트가 쓰지 않는 순수 함수다 — 건드리지 않았다.
- 360px·글꼴 130%↑에서 터치 힌트 한 줄 `truncate` — 새 문구는 옛 문구와 같은 길이 이하(시험이 글자 수로 묶음)지만 실기기 확인 전이다.

## reviewer 가 볼 곳

1. `cardFirst.ts` `rightAction`/`canSwipeRight` ↔ `VocabDeck.tsx` `onRight` ↔ `deck.next` — 오른쪽 밀기가 안 푼 카드에서 막힘 안내(`blockedNextHint`)가 아니라 확인 시트를 여는지, 푼 카드·마지막 푼 카드에서 `deck.next` 로 가는지.
2. `deck.ts` `resistX`/`canPrev` + `SwipeCardStack.tsx` — 저항 방향, `FLY_OUT_TRANSFORM`(오른쪽), reduced-motion 분기.
3. 결정 D4(`overflow-x-clip`)·D5(`fixedHint` 순서) — 사양 밖 추가라 유지·삭제 판단.
4. `docs/screens.md` §24-6 과 옛 서술 표기(grep: `왼쪽 = 다음|왼쪽 밀기|오른쪽 밀기|← 밀어 다음|→ 밀어 이전|translateX\(-120|prevByButton`)에 거짓 서술이 남았는지. `§5·§23` 본문은 task-060 방식대로 지우지 않고 `[⚠ task-070 → …]` 로만 표기했다.
5. 재실행 명령(미러): `./node_modules/.bin/tsc --noEmit` · `./node_modules/.bin/eslint src/components/vocab` · `node --import tsx --test --test-concurrency=1 src/components/vocab/__tests__/{deck,cardFirst,deckStage}.test.ts`.
6. 변이 하니스: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/mutate070.py` (미러 전용, NFS 는 건드리지 않고 매번 NFS 원본으로 복원).

## 미커밋 파일
`docs/screens.md` · `src/components/vocab/{DeckToolbar.tsx,SkipConfirmSheet.tsx,SwipeCardStack.tsx,VocabDeck.tsx,cardFirst.ts,deck.ts,useVocabDeck.ts}` · `src/components/vocab/__tests__/{cardFirst,deck}.test.ts` · 이 기록 · 이력서 상태 로그 한 줄.
