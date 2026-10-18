---
task_id: task-075
role: reviewer
title: "task-075 reviewer 기록 — 오늘의 단어 덱 스와이프 방향 맞바꿈 (IMP-0050) 독립 감사"
review_id: REV-075
created: 2026-10-18
verdict: PASS_WITH_NOTES
tags:
  - type/task-record
  - domain/vocab
aliases:
  - task-075 감사 기록
  - REV-075
---

# task-075 reviewer 기록 (REV-075)

이력서 [[task-075-improve-deck-swipe-reverse]] · developer 기록 [[task-075-dev-record]] · 선례 [[task-070-dev-record]]. track **light**(QA·데모 면제) — light 승격 필요 없음(변경 파일 9개 ≤ 12, 신규 화면·마이그레이션·네이티브·인증/권한/Secret 변경 없음, 변경은 전부 `src/components/vocab/**`).
감사는 Read 전용(저장소 파일·시험·문서는 손대지 않음). 변이 실험은 변이용 미러 `~/.node-local/thekaiwa-dev075-mut`에서만 했고 전부 저장소 원본으로 복원 후 `cmp` 동일을 확인했다.

## 판정 요약

**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2(둘 다 코드 결함이 아니라 시험 공백·사양 괄호와의 차이). `native_change: false`.
방향 지도·움직임·문구·키보드·범위는 코드로 직접 따라가 확인했고, 독립 변이 18개 중 16개를 시험이 잡았다. 살아남은 2개는 «끌 때 카드가 손가락을 따라오는 부호(`translateX(${shownX}px)`)» 를 시험이 안 묶은 공백이다(코드 자체는 맞다). 막지 않는다.

## 항목 A~G 판정

| 항목 | 판정 | 근거(파일:줄) |
|---|---|---|
| A. 방향 지도 정확성 | **PASS** | 아래 A 표 |
| B. 움직임 방향(L3) | **PASS** | 아래 B 표 |
| C. 문구 누락(L4) | **PASS** | 아래 C |
| D. 키보드(L5)·범위 밖(L6) | **PASS** | 아래 D |
| E. 시험 약화 여부·직접 변이 | **PASS_WITH_NOTES** | 약화 없음, 변이 16/18 포착, 공백 2(F1) |
| F. 증빙 재실행 | **PASS** | 아래 F |
| G. 엔진명·6층·새 위험 | **PASS** | 아래 G |

### A. 방향 지도 — 호출 사슬을 코드로 따라간 결과

사슬: `SwipeCardStack.dragEnd`(`SwipeCardStack.tsx:93,102` `classifyGesture` → `onSwipe(g)`) → `VocabDeck.onSwipe`(`VocabDeck.tsx:232`) → `runSwipe(side, swipeCtx, {next: deck.next, prev: deck.prev, ask: askSkip})`(`cardFirst.ts:241`) → `swipeAction`(`cardFirst.ts:228`). 상태 `swipeCtx = {isCurrent, answered, busy: locked, hasPrev: canPrev(view)}`(`VocabDeck.tsx:91-92`, `locked = deck.exiting || finishing || !!card?.pending` `:75`).

| 상황 | 손가락 | 코드 경로 | 결과 | 070 과 비교(`git show HEAD:…cardFirst.ts` `rightAction`) |
|---|---|---|---|---|
| 푼 카드(지금·지난) | 왼쪽 | `swipeAction('left')` busy 아님·answered → `next` → `deck.next` | 다음 카드, 마지막이면 `doFinish`(`useVocabDeck.ts:310-313`) | 070 오른쪽과 같은 본문(`rightAction` 동일 3줄) — 방향만 |
| 안 푼 지금 카드 | 왼쪽 | `canAskSkip` → `ask` → `askSkip` → `setSkipFor(card.order)` | **건너뛰기 확인 시트만**(기록 `deck.skip` 은 시트 확정에서만 `VocabDeck.tsx` 1곳) | 동일 — 방향만 |
| 안 푼 지난 카드(불가능 상태) | 왼쪽 | `canAskSkip` false → `none` | 무반응 | 동일 |
| 저장 중·넘기는/끝내는 중 | 왼쪽 | `busy` → `none`(드래그 자체도 `locked` 로 시작 안 됨 `SwipeCardStack.tsx:79`) | 무반응 | 동일 |
| 어떤 카드든 | 오른쪽 | `swipeAction('right')` 가 늘 `prev` → `deck.prev` | 둘째 카드 이후 이전 카드, 첫 카드는 `showHint(HINT.firstCard)`(`useVocabDeck.ts:331-334`), 넘기는 중은 `exitingRef` 로 무시 | 070 `onLeft={deck.prev}` 와 같은 함수·같은 가드 — 방향만 |
| 끌 때 저항 | 왼쪽 | `canSwipe('left')` = `swipeAction('left').kind !== 'none'` | 070 `canSwipeRight` 와 같은 식 | 인자 자리만 이동 |
| 끌 때 저항 | 오른쪽 | `canSwipe('right')` = `hasPrev` = `canPrev(view)` | 070 `canLeft={canPrev(view)}` 와 같은 값 | 인자 자리만 이동 |

`resistX(x, canLeft, canRight)` 는 `x<0`(손가락 왼쪽)에 `canLeft`, `x>0` 에 `canRight` 를 본다(`deck.ts:42-45`, 함수 본문 불변) — 스택이 `resistX(drag.x, canSwipe('left'), canSwipe('right'))`(`SwipeCardStack.tsx:105`) 로 부르므로 왼쪽 끌기 = 다음/확인 가능 여부, 오른쪽 끌기 = 이전 카드 유무. 인자 순서 맞다.
`runSwipe` 는 `swipeAction` 결과를 덱 동작에 잇기만 한다(`next/prev/ask` 각 1줄). 가장자리·막힘은 방향만 바뀌고 분기·문구는 그대로(L2 충족). 보너스: 오른쪽이 `prev` 고정이라 첫 카드의 «첫 카드예요» 안내가 사라지지 않는다(순수 함수에서 첫 카드를 `none` 으로 만들지 않은 D1 판단에 동의).

### B. 움직임 방향(L3)

| 점검 | 결과 |
|---|---|
| 끌기 부호 | `translateX(${shownX}px)`(`SwipeCardStack.tsx:118`) — `shownX` 는 손가락 `dx` 의 부호를 유지(저항 시 ×0.25 만). 맞다. |
| 기울기 | `rotate(${shownX * 0.05}deg)` — 손가락 쪽으로 기운다. 070 과 동일 식. |
| 날아가기 | `FLY_OUT_TRANSFORM = 'translateX(-120%) rotate(-8deg)'`(`deck.ts:23`). 이 값은 task-070 이전(task-008 원래 값)이었다 — `git log -S` 로 `54b65d0`(070)이 바꿨고 이번에 되돌린 것 확인. 왼쪽 밀기 = 다음 카드(`deck.next` 의 `exiting`)와 방향 일치. 버튼 [다음 카드]·키 → 로 넘겨도 같은 `exiting` 경로라 왼쪽으로 통일. |
| reduced-motion | 날아가기: 투명도만(`:111-112`), 끌기: `translateX` 만(`:118`) — 분기 070 그대로. |
| `onSwipe(g)` 가공 | `else if (g === 'left' || g === 'right') onSwipe(g)`(`:102`) — 뒤집기·하드코딩 없음, 호출 1곳. |
| 이전 카드 전환 | 날아가기 없이 원위치 + 새 카드 120ms 페이드(`:64-71`) — 070 과 같다. 사양 L3 괄호(「오른쪽으로 밀면 오른쪽으로 사라져 이전 카드」)와는 다르다 → 발견 F2(Low, 동의: 추가 안 함). |
| `overflow-x-clip`(D5) | 유지에 동의. 이전 카드로 가려고 카드를 오른쪽으로 끌 때 `main`(overflow-y-auto)에 가로 스크롤 범위가 생기는 위험은 070 의 «오른쪽 날아가기» 와 같은 종류다. 지우면 070 이전 상태(좌→우 끌기에 무방비)로 돌아갈 뿐이라 이득이 없고 `overflow-x: clip` 은 세로 튀기(`bump`)를 자르지 않는다. 뒤집을 근거 없음. |

### C. 문구 누락(L4) — 직접 grep

`grep -rn "왼쪽\|오른쪽\|← 밀어\|→ 밀어\|밀어" src` 를 `--include=*.ts,*.tsx`·시험 제외로 전수 확인.
- 방향을 말하는 곳은 vocab 덱 7개 파일뿐: `KEY_HINT` 4문구(`cardFirst.ts:425-431`), `deck.ts`·`cardFirst.ts`·`SwipeCardStack.tsx`·`VocabDeck.tsx`·`useVocabDeck.ts`·`DeckToolbar.tsx`·`SkipConfirmSheet.tsx` 의 주석. 모두 새 방향(왼쪽 = 다음/건너뛰기, 오른쪽 = 이전)과 일치. 옛 방향 낱말은 남지 않았다(`rightAction`·`canSwipeRight`·`RightResult`·`onLeft/onRight/canLeft/canRight`(prop 이름) 0건 — `grep` 으로 `SwipeCardStack` 사용처가 `VocabDeck` 1곳뿐임도 확인).
- 사용자에게 보이는 방향 문구는 `KEY_HINT.touch*` 4개뿐이고 새 문구가 `swipeAction` 실제 동작과 같다(예: 푼 카드 `← 밀어 다음 · → 밀어 이전`, 안 푼 뒷면 `← 밀어 건너뛰기 · → 밀어 이전`). 글자 수는 070 과 같다(`GestureHint` 는 `truncate`).
- `aria-label`·`aria-roledescription`(`SwipeCardStack.tsx:129-130`)과 `GestureHint`(`aria-hidden` 고정 힌트) 에는 방향 낱말이 없다. `SkipConfirmSheet`·`labels.ts` 본문에도 방향 낱말 없음. `cardFirst.ts:380` «카드를 위로 밀어도 뜻이 보여요» 는 위쪽이라 해당 없음.
- 참고(지적 아님): `docs/screens.md` 에 옛 방향 서술이 **27줄** 남아 있다(`왼쪽 밀기|오른쪽 밀기|← 밀어|→ 밀어|translateX(120|rightAction|canSwipeRight` 매칭). Leader 가 구현 뒤 동기화할 몫이다. (현재 `docs/screens.md` 의 미커밋 변경 +78줄은 §33 = task-076 designer 초안이고 task-075 와 무관.)

### D. 키보드(L5)·범위 밖(L6)

- 키: `keyAction` 이 `ArrowRight → next`, `ArrowLeft → prev`(`deck.ts:248-249`) — diff 에 이 줄 변경 없음. 키 처리는 `onKey → switch (intent.type)`(`VocabDeck.tsx:124-170`)로 `deck.next/prev` 를 직접 부르고 스와이프 지도(`swipeAction`)를 거치지 않는다 → 묶임 없음(시험에도 `deck.test.ts` 에 주석+단언 유지).
- 위로 밀기(`onUp`/`upAction`), [이전]·[다음 카드] 버튼(`onPrev={deck.prev}`·`onNext={deck.next}` — 구조 시험이 그대로 고정) 변경 없음.
- 서버·DB·네이티브: `git status` 상 변경은 `src/components/vocab/**` 9개 파일뿐(`prisma/`·`src/app/api/`·`src/modules/`·`android/`·`plugins/`·`capacitor.config.ts` 변경 0). `native_change: false`.

### E. 시험 약화 여부

| 점검 | 결과 |
|---|---|
| `resistX` 단언 | 호출·기대값 9개 그대로(메시지만 새 의미) — `git diff` 확인 |
| `canPrev`·`classifyGesture`·`keyAction` | 변경 없음(`keyAction` 은 주석만 추가) |
| `FLY_OUT_TRANSFORM` | 3 단언 유지: 부호 정규식(`-` 두 곳)·양수 값 없음(`/\(\d|\s\d/`, 옛 값 `translateX(120%) rotate(…)` 도 잡음)·리터럴 일치 |
| `rightAction` 6행·`canSwipeRight` 6단언 삭제 | `swipeAction`/`canSwipe`/`runSwipe` 가 **손으로 적은 8행 `LEFT_TABLE`**(구현 식 재계산 아님) × `hasPrev` 2 + 오른쪽 16 + 반대방향 가드 16 + `canSwipe` 전수 + `runSwipe` 스파이 32 + 좌표→동작 + 움직임 방향 + 힌트↔`swipeAction` 일치(24 상태) 로 **대체·확장** — 옛 6행은 새 표의 부분집합이다(안 푼/푼 지금·푼 지난·저장 중×2·안 푼 지난). 약화 아님. |
| 소스 스캔 | 070 의 `onLeft/onRight` 배선 단언을 `onSwipe(g)` 가공 금지·호출 1곳·저항 인자 순서·`runSwipe` 이음·`swipeCtx` 정의로 대체. 동작은 순수 함수 시험이, 배선만 스캔이 잡는 구조. |
| 구조 시험 중 제거된 단언 | `onRight` 본문의 `deck.skip|deck.prev|showHint` 금지 → `onSwipe` 본문 `'left'|'right'|deck.skip|showHint` 금지로 이관. `prevByButton` 부재 단언은 별도 test 로 이관(유지). |

**직접 변이(독립, 미러 `thekaiwa-dev075-mut`, 파일 하나를 임시 파일 + `os.replace` 로 깨고 deck·cardFirst·deckStage 85개 실행, 끝나고 임시 파일 + `os.replace` 로 복원, 마지막 `cmp` 5개 파일 동일 확인 `RESTORE_CMP OK`)** — 하니스 `scratchpad/rev075-mut.py`(개발자의 `mutate075.py` 와 별개로 새로 작성).

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| R01 | `swipeAction` 분기 뒤집기(`left` 가 prev, 나머지가 오른쪽 갈래) | 포착 | 힌트↔동작·swipeAction 왼쪽/오른쪽 외 8 |
| R02 | 안 푼 지금 카드 왼쪽 → `next`(확인 시트 없이 바로 다음) | 포착 | 힌트↔동작·swipeAction 왼쪽·runSwipe 외 4 |
| R03 | `FLY_OUT` translateX 만 양수 | 포착 | 움직임 방향·FLY_OUT |
| R04 | `FLY_OUT` 이동·기울기 모두 양수(옛 070) | 포착 | 움직임 방향·FLY_OUT |
| R05 | **스택 끌 때 `translateX` 부호 반전(일반 모션)** | **생존** | — (F1) |
| R06 | **스택 reduced-motion 끌 때 `translateX` 부호 반전** | **생존** | — (F1) |
| R07 | 왼쪽 갈래에서 `answered` 검사를 `busy` 앞으로 | 포착 | swipeAction 왼쪽·canSwipe·runSwipe |
| R08 | 오른쪽이 busy 이면 무반응 | 포착 | swipeAction 오른쪽·runSwipe |
| R09 | 덱이 `runSwipe` 에 `'left'` 상수 | 포착 | 구조(덱)·구조(M-1) |
| R10 | `hasPrev` 를 `view > 1` 로 | 포착 | 구조(덱) |
| R11 | `classifyGesture` 문턱 `>=` | 포착 | classifyGesture·손가락→동작 |
| R12 | `RESIST` 1(저항 없음) | 포착 | resistX·움직임 방향 |
| R13 | 키 → 를 prev 로 | 포착 | keyAction 2 |
| R14 | 오른쪽 판정을 `onTap` 으로 | 포착 | 구조(스택) |
| R15 | 훅 `next` 날아간 뒤 `goTo(v - 1)` | 포착 | 구조(훅) |
| R16 | 훅 `prev` 첫 카드 안내 제거 | 포착 | 구조(훅) |
| R17 | `touchDone` 이 «← 밀어 건너뛰기» 거짓 안내 | 포착 | fixedHint 4갈래·터치 힌트 문구·힌트↔동작 |
| R18 | 스택 `resistX` 제거(저항 소실) | 포착 | 구조(스택) |

요청한 3종 — 왼쪽/오른쪽 분기 뒤집기(R01)·안 푼 카드 → next(R02)·FLY_OUT 부호(R03·R04) — 모두 포착. 합계 **16 포착 / 2 생존**.

### F. 증빙 재실행(미러 `~/.node-local/thekaiwa-dev075`)

사전: 변경 파일 10개(코드 7 + 시험 3: `deck`·`cardFirst`·`deckStage`)를 저장소와 `cmp` → 전부 동일. `tsconfig.tsbuildinfo`·`next-env.d.ts` 링크 수 1(다른 미러 오염 위험 없음, ISS-0009 관련).

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | **종료 0**, 출력 없음 |
| `./node_modules/.bin/eslint src/components/vocab` | **종료 0**, 출력 없음 |
| `node --import tsx --test --test-concurrency=1 …/{deck,cardFirst,deckStage}.test.ts` | **85 tests · pass 85 · fail 0 · skipped 0** (개발자 기록과 일치) |
| 전체 시험(`find src scripts/seed-build -name '*.test.ts'`, 가짜 `DATABASE_URL`) | **4340 tests · pass 4337 · fail 0 · cancelled 0 · skipped 3**, 종료 0 (건너뜀 3은 docs/모델 대조 — 개발자 기록과 같은 수치·같은 이유, 개발자가 따로 돌려 41/41 통과로 확인한 항목) |
| `check.mjs check --task task-075…` | `DEMO_GATE_PASSED` (status not_required, judge none, `DM-light-waive`). `evidence.jsonl`·`events.jsonl` 에 task-075 줄 0건 — 에이전트가 `approve`/`waive` 를 실행했거나 `state` 를 직접 쓴 흔적 없음. |
| `next build` | 재실행 안 함(선택 항목) — 개발자 기록 «종료 0, 번들에 새 문구 있음·옛 문구 0건»; 이번 변경은 vocab 한정이라 위 tsc 로 갈음 |

### G. 엔진명 · 6층 경계 · 새 위험

- `git diff` 추가 줄에 `reazon|whisper|style-bert|claude|model_id|speaker` 0건. 사용자 문구에 엔진·모델명 없음.
- 6층: 변경은 `src/components` 안에서만 일어났고 `./deck`·`./cardFirst` 상호 import 뿐(순환 없음: `cardFirst → deck` 타입, `deck → cardFirst` 없음 — `SwipeSide` 를 `deck.ts` 에 두어 `cardFirst` 가 `deck` 에서 가져옴). 라우트·모듈 층 접촉 없음. spawn/fetch/`window.Capacitor` 도입 없음.
- 보안·데이터: 소유자·capability·Secret·Trace·로그와 무관(UI 로직만). 서버 호출(#50 skipped)은 `deck.skip()` 1곳이고 확인 시트에서만 — 왼쪽 밀기가 직접 기록하지 않음을 `runSwipe` 가 `ask` 로만 잇고 시험이 `M40/R09` 류로 잡는다.
- 새 위험: **습관 반전** — 070 의 «오른쪽 = 다음/건너뛰기» 에 익숙한 손이 푼 카드를 오른쪽으로 밀면 이전으로 간다(개발자 L1 ⑤ 와 같은 지적). 의도된 반전이며 코드 결함 아님, 폰 확인 항목에 남는다. 이전 카드로 가는 오른쪽 밀기는 데이터를 쓰지 않으므로 되돌릴 수 없는 사고는 없다(건너뛰기 기록은 시트 확인을 한 번 더 거침).

## 발견

| ID | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| F1 | **Low** | 시험 공백: `src/components/vocab/__tests__/cardFirst.test.ts:788`(기울기만 묶음) ↔ `SwipeCardStack.tsx:118` | 끌 때 카드가 손가락을 따라오는 **`translateX(${shownX}px)` 부호**(일반 모션·reduced-motion 두 분기)를 시험이 묶지 않는다. 사양 L3 의 «끌기 부호» 가 동작 시험에 없고, 070 에서도 없던 공백이다(`git show HEAD:…cardFirst.test.ts` 에 `shownX` 0건). 코드 자체는 맞다. | R05·R06 변이(`-shownX`) 가 85개 시험을 전부 통과(생존) | `구조(task-075): 스택` 테스트에 `assert.match(stack, /translateX\(\$\{shownX\}px\)/g)` 로 일반·reduced 두 분기 각각 확인(개수 2) 한 줄 추가. 막지 않는다 — 렌더 시험이 없어 소스 스캔이 현실적 방어선. |
| F2 | **Low(정보)** | `useVocabDeck.ts:328-336`(`prev` 가 바로 `goTo(v-1)`) ↔ 이력서 L3 괄호 | 이력서 L3 는 «오른쪽으로 밀면 오른쪽으로 사라져 이전 카드» 라고 예시했지만 이전 카드 전환에는 날아가기가 없다(원위치 + 120ms 페이드). 070 에서 «왼쪽 밀기 = 이전» 도 같았고 사용자가 폰에서 정상 확인했다. | 코드 읽기 + 개발자 D7 | **Leader 사전 판단(D7)에 동의** — 추가하지 않는다. 이유: ① L2 «방향만 바꾼다» 범위 밖의 새 연출 ② `prev` 를 타이머로 지연하려면 `exiting` 을 방향 상태로 바꿔야 하고 훅은 렌더 시험이 없어 회귀를 못 잡는다. 사용자가 폰에서 «오른쪽으로 밀 때 카드가 그냥 사라지고 새 카드가 나와 어색하다» 고 하면 후속 요청으로. |

(뒤집은 사전 판단 없음: D5 `overflow-x-clip` 유지·D7 연출 추가 안 함·실기기 확인 이관 모두 동의.)

## high_risk_areas (QA 없음 — 사용자 폰 확인용으로 남김)

터치 제스처 자체(touchstart → touchend → `onSwipe`)는 이 환경에서 못 만진다. 사용자 폰에서 확인할 것:
1. 푼 카드를 **왼쪽**으로 밀면 카드가 왼쪽으로 날아가고 다음 카드, 마지막 푼 카드면 결과.
2. 안 푼 카드를 왼쪽으로 밀면 건너뛰기 **확인 시트**(취소하면 그대로, 시트에서만 기록).
3. **오른쪽**으로 밀면 이전 카드, 첫 카드는 오른쪽으로 조금만(×0.25) 따라오고 「첫 카드예요」.
4. 터치 힌트 한 줄(`← 밀어 건너뛰기 · → 밀어 이전` 등)이 360px 에서 잘리지 않는지.
5. 옛 습관으로 오른쪽 밀기 시 이전으로 가는 것(의도된 반전)과 이전 카드 전환에 날아가기가 없는 점(F2).
6. 위로 밀기(뜻 보기)·[이전]/[다음 카드] 버튼·키 ←/→ 회귀 없음.

## light 트랙 확인

① developer 기록에 tsc·eslint·단위·build 명령과 결과가 있음 ② tsc 0·eslint 0·대상 시험 85 통과를 **직접 재실행해 같은 결과** ③ light 범위 안(9파일 ≤ 12, 신규 화면·DB·네이티브·인증 없음) → **light 승격 불필요**. Sonnet developer 의 같은 결함 클래스 반려 0회(첫 감사) → Opus 승격 권고 없음.

## 환경 메모

- 하드링크 미러(ISS-0009): `dev075` 미러의 `tsconfig.tsbuildinfo`·`next-env.d.ts` 는 링크 수 1 이라 `tsc` 를 안전하게 돌렸다. 변이 미러 파일은 전부 링크 수 1 이고 임시 파일 + `os.replace` 로만 교체했다.
- scratchpad 로그 이름 `tsc075.log`·`eslint075.log`·`test075.log` 는 개발자 것과 겹쳐 덮어썼을 수 있다 — 증빙은 위 표의 수치로 갈음.
