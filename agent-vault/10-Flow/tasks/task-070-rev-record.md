---
task_id: task-070
title: "task-070 Reviewer 기록 — 오늘의 단어 덱 좌우 스와이프 방향 변경 (REV-070) — 최종"
role: reviewer
track: light
verdict: PASS_WITH_NOTES
created: 2026-10-15
tags:
  - type/rev-record
  - domain/vocab
aliases:
  - task-070 rev-record
  - REV-070
---

# task-070 Reviewer 기록 (REV-070) — 최종

이력서: [[task-070-improve-deck-swipe-prev]] · developer 기록: [[task-070-dev-record]] · 백로그: [[IMP-0044-deck-swipe-left-prev]]

## 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 3 + 관찰 1)

- 사용자 결정(왼쪽 = 이전 카드 · 오른쪽 = 푼 카드는 다음 카드(마지막이면 결과)/안 푼 카드는 건너뛰기 확인)이 코드·시험·문서에 일관되게 들어갔다. 위로 밀기·탭·키보드·버튼·건너뛰기 기록은 불변.
- 앞 reviewer(60턴 한도로 중단)의 확인분을 흡수하고, 남은 일(전체 시험 대조·변이 재현·D4/D5 판정·불변/경계·문서 Low 확정)을 이 소환에서 끝냈다. **QA 없음(light) — 변이 재현이 사실상 유일한 독립 시험 점검이었고, 결과 23개 중 20개 사망·3개 생존(생존 3개는 모두 task-070 이전부터 있던 훅 가드로 이번 변경이 만든 구멍이 아님).**
- light 승격 필요: **없음**(변경 파일 10개 ≤ 12 · 신규 화면 0 · 마이그레이션 0 · 네이티브 0 · 인증/권한/Secret 0). Sonnet developer 반려 횟수 0 → Opus 승격 권고 없음. 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(status not_required, judge none / `DM-light-waive`), 에이전트가 `approve`·`waive` 를 대신 실행한 흔적 없음(`evidence.jsonl` 에 task-070 줄 0).

## 증빙 재실행 (모두 미러 `~/.node-local/thekaiwa-rev070`, `diff -rq src` 0 으로 저장소와 동일 확인 후)

| 항목 | 명령/방법 | 결과 | developer 보고와 대조 |
|---|---|---|---|
| tsc | `tsc --noEmit` (앞 reviewer) | 종료 0 | 일치 |
| eslint | `eslint src/components/vocab` (앞 reviewer) | 종료 0 | 일치 |
| vocab 시험 | `__tests__` 전체 (앞 reviewer) | 267 통과 · 0 실패 | 일치 |
| **전체 시험(이 소환 재실행)** | `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` → `/tmp/claude-1000/rev070-fulltest.log` | **tests 4108 · pass 4106 · fail 0 · cancelled 0 · skipped 2 · FULL_EXIT=0** | 4108 중 4106 통과·0 실패·2 건너뜀 — **일치** |
| next build | `next build` (앞 reviewer, `/tmp/claude-1000/rev070-build.log`) | 끝 줄 `BUILD_EXIT=0`, `.overflow-x-clip{overflow-x:clip}` 가 번들 CSS 에 들어감을 확인 | 일치 |
| 변이 재현 | 아래 표 (23개, vocab `__tests__` 전체로 실행) | 20 사망 · 3 생존 | developer 35/35 사망(시험 78개)과 범위가 다름 — 아래 설명 |

## 체크리스트 결과

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 방향 지도: 왼쪽 = 이전 카드(첫 카드면 안내) | OK | `VocabDeck.tsx` `onLeft={deck.prev}`, `useVocabDeck.prev` 가 `canPrev(v)` 로 `HINT.firstCard`. M1·M13·M18·M7 사망 |
| 2 | 오른쪽 = 푼 카드 다음(마지막이면 결과) / 안 푼 카드 건너뛰기 확인 / 저장·넘기는·끝내는 중 무반응 | OK | `cardFirst.rightAction`(busy → answered → canAskSkip) → `VocabDeck.onRight`(`next` → `deck.next()`, `ask` → `askSkip()`). 마지막 카드는 `deck.next` 안의 `doFinish` 분기(M6 사망). 건너뛰기 기록은 `deck.skip()` 1곳(확인 시트)이라는 기존 단언 유지 |
| 3 | 저항(`resistX`) | OK | 왼쪽 = `canPrev(view)`, 오른쪽 = `canSwipeRight(skipCtx)`(= `rightAction().kind !== 'none'`). M3·M10a/b/c·M11·M12·M16 사망 |
| 4 | 날아가는 방향 | OK | `deck.FLY_OUT_TRANSFORM = 'translateX(120%) rotate(8deg)'` 한 곳, `SwipeCardStack` exiting 분기가 그 값을 쓰고 reduced-motion 은 transform 없이 opacity 0.12s(앞 reviewer 렌더 확인). 저장소에 `translateX(-` 리터럴 0. M4 사망 |
| 5 | 불변: 위로 밀기·탭·답하기·건너뛰기 기록·버튼·키보드·재생 중 동작 | OK | `git diff` 에 `upAction`/`tapAction`/`keyAction` 변경 0. 키 `←` = `deck.prev`·`→`/Enter = `deck.next` 단언 유지. 소리 멈춤은 `view` 변경 효과 그대로(M9a 사망) |
| 6 | 키보드 → 와 제스처 → 의 비대칭(안 푼 카드에서 → 는 막힘 안내, 오른쪽 밀기는 확인 시트) | OK(의도, L5) | `rightAction` 주석·§24-6 이 명시. 터치 힌트가 카드 상태별로 말한다 |
| 7 | **D4** 무대 `overflow-x-clip` | **수용** | 아래 판정 |
| 8 | **D5** `fixedHint` 답한 카드 판단 선행 | **수용** | 아래 판정 |
| 9 | 안내 문구 | OK | `KEY_HINT` 4개 새 문구 모두 손가락 방향 기준·31자 이하(앞 reviewer 가 8상태 렌더로 확인). `CARD_FIRST.prevByButton` 은 코드·시험에서 정의 삭제(시험의 `in CARD_FIRST === false` 단언만 남음) |
| 10 | 문서 `docs/screens.md` | **Low** | REV070-1 |
| 11 | 6층 경계·엔진명·API/스키마/네이티브 | OK | 엔진명 grep(`reazon|sherpa|whisper|style-bert`)가 `src/components/vocab` 에서 시험의 누출 방지 정규식 4곳 외 0. 변경은 `src/components/vocab`·`docs/screens.md` 10파일, prisma/auth/android/plugins 변경 0 |
| 12 | 시험 품질 | OK + Low 2건 | 순수 함수는 직접 단언, 배선은 소스 스캔(task-069 교훈 반영). 생존 변이 3개는 REV070-2·3 |
| 13 | 주석만 바뀐 파일 | OK | `SkipConfirmSheet.tsx`·`DeckToolbar.tsx` `git diff -U0` 에서 코드 줄 변경 0, 주석 1줄씩만 |

### D4 판정 — 무대 `overflow-x-clip` : **수용**
- 필요성: `<main>` 이 `overflow-y-auto`(`src/app/(app)/layout.tsx:52`)라 x 도 auto 로 계산된다. 옛 왼쪽 날아가기는 음수 방향이라 스크롤 범위를 만들지 않았지만, 새 `translateX(120%)` 는 양수 방향이라 180ms 동안 가로 스크롤 범위가 생긴다. 목적(가로 스크롤 방지)에 맞다.
- 그림자·포커스 링 영향 없음: 클립이 걸린 `div`(`flex min-h-[224px] flex-1 items-center justify-center overflow-x-clip px-4 py-3`)의 자식은 `SwipeCardStack` 하나. 카드 면 `shadow-sm`(≤3px 번짐)과 스택 껍데기 `shadow-sm` 뿐이고 `ring-`/`outline`/`focus-visible` 은 `SwipeCardStack.tsx`·`VocabCardFace.tsx` 에 0, 음수 오프셋 절대 위치 자식 0. 카드는 폭 80%(최대 340px)로 가운데라 좌우 여유가 16px(패딩)+10% 이상이라 그림자가 잘리지 않는다.
- `overflow-x: clip` 은 다른 축을 `auto` 로 바꾸지 않아 세로 `bump`(`translateY(-16px)`)는 그대로 보인다(스펙 동작). 무대는 `main` 폭 전체라 드래그 중 카드가 화면 가장자리에서 잘리는 것은 뷰포트 가장자리와 같다. M17(클래스 제거) 사망.
- 한계(L4 dev): 클립 동작 자체는 CSS 효과라 단위 시험이 못 본다(클래스 존재만 스캔) → 폰 확인 항목.

### D5 판정 — `fixedHint` 터치 갈래에서 「답한 카드/지난 카드」 선행 : **수용**
- `git diff` 상 바뀐 것은 터치(coarse) 분기의 두 줄 순서뿐이고 정밀 포인터 분기·`blockedNextHint` 는 변경 0.
- 상태공간으로 따지면 옛/새 결과가 갈리는 곳은 **`mode === 'CHOICE'` 이면서 (`answered` 또는 `!isCurrent`)** 하나뿐이다(그 밖의 7개 터치 상태는 순서와 무관하게 같은 문자열). 그 상태에서 옛 순서는 「→ 밀어 건너뛰기」를 말하지만 새 지도에서 답한 카드의 → 는 **다음**이라 옛 순서를 두면 거짓 안내가 된다. 즉 사양 L6(안내가 실제 동작과 맞게)의 필수 귀결이다. `!isCurrent && !answered` 는 실제로 도달할 수 없는 상태(지난 카드는 답했거나 건너뜀)라 거기서 「→ 밀어 다음」이 틀릴 일은 없다. M14(옛 순서 복원) 사망.
- 앞 reviewer 의 8상태 렌더(터치 힌트 최대 31자)와 대조해 다른 상태의 힌트가 바뀌지 않음을 확인.

## 변이 재현 (이 소환에서 직접 — 미러에서만, 변이마다 백업 → 적용(전후 diff 비어 있지 않음, 파일별 `old` 문자열 존재 확인) → vocab `__tests__` 전체 실행 → 원복(`cmp` 로 저장소와 동일 확인))

| ID | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | `VocabDeck` `onLeft`/`onRight` 연결 뒤바꿈 | 사망 | 구조(task-070) 덱 배선, 기존 덱 배선 |
| M2 | `rightAction` 푼 카드 `next` → `none` | 사망 | rightAction 단위, canSwipeRight |
| M3 | `resistX` 왼쪽/오른쪽 허용 조건 뒤바꿈 | 사망 | resistX 단위 |
| M4 | 날아가는 방향 `translateX(120%)` → `-120%` | 사망 | FLY_OUT_TRANSFORM 단위 |
| M5a | `rightAction` 안 푼 카드 `ask` → `next` | 사망 | rightAction 단위 |
| M5b | `onRight` 의 `ask` 분기 → `deck.next()` | 사망 | 구조(task-070) 덱 배선 · 구조(M-1) |
| M6 | `next()` 마지막 푼 카드 `doFinish` 분기 제거 | 사망 | 구조(task-070) 훅 |
| M7 | `prev()` 첫 카드 「첫 카드예요」 안내 제거 | 사망 | 구조(task-070) 훅 |
| **M8a** | `next()` 의 `exitingRef` 가드 제거 | **생존** | — |
| **M8b** | `prev()` 의 `exitingRef` 가드 제거 | **생존** | — |
| M9a | 카드(`view`)가 바뀌면 소리 멈춤 효과 제거 | 사망 | 구조(task-070) 덱 배선 |
| **M9b** | 넘기는 중/끝내는 중(`exiting`·`phase`) 소리 멈춤 효과 제거 | **생존** | — |
| M10a | `canLeft` 입력을 `true` 로 | 사망 | 구조(task-070) 덱 배선 |
| M10b | `canRight` 입력을 `true` 로 | 사망 | 구조(task-070) 덱 배선 |
| M10c | `canRight` 를 옛 `canAskSkip` 로 되돌림 | 사망 | 구조(task-070) 덱 배선 |
| M11 | `SwipeCardStack` 이 `resistX` 에 넘기는 canLeft/canRight 뒤바꿈 | 사망 | 구조 스택 저항 |
| M12 | `canPrev` `view > 0` → `view >= 0` | 사망 | canPrev 단위 |
| M13 | `SwipeCardStack` 판정 left/right 뒤바꿈 | 사망 | 구조(task-070) 스택 |
| M14 | `fixedHint` D5 순서를 옛 순서로 | 사망 | fixedHint 7갈래·터치 4갈래 |
| M15 | `next()` 의 `setExiting(true)` 제거(날아가기 없이 전환) | 사망 | 구조(task-070) 훅 |
| M16 | `rightAction` busy 무반응 제거 | 사망 | rightAction 단위, canSwipeRight |
| M17 | 무대 `overflow-x-clip` 제거 | 사망 | 구조(task-070) 덱 |
| M18 | `prev()` `goTo(v - 1)` → `goTo(v + 1)` | 사망 | 구조(task-070) 훅 |

합계 **23개: 사망 20 · 생존 3**(M8a·M8b·M9b). 사양이 요구한 필수 7개(M1~M7)는 전부 사망, 추가 항목 중 배선 변이(M10a/b/c·M11·M13·M5b)도 전부 사망. 사망 수가 developer 의 35/35 와 다른 것은 변이 집합이 다르기 때문이다(나는 `exitingRef` 가드·소리 멈춤 효과 같은 훅 쪽을 추가로 겨냥했다).

### 생존 변이 3개 — 어떤 변이이고 위험이 무엇인가
- 세 줄 모두 `git show HEAD:` 에 이미 있던 줄이고(`useVocabDeck.ts` 302·327행, `VocabDeck.tsx` 112·115행) task-070 diff 에 없다 → **이번 변경이 만든 시험 구멍이 아니라 기존 구멍**이다. 훅은 렌더하지 않고 소스 스캔으로만 묶는 설계(dev 한계 L2)의 결과.
- M8a/M8b (`exitingRef` 가드): 가드가 없으면 날아가는 180ms 안에 → 키/버튼을 연타해도 `next()` 가 두 번 돈다. 그러나 두 호출 모두 같은 `viewRef.current` 에서 `v + 1`(이전은 `v − 1`)을 계산해 `goTo` 가 같은 목표를 두 번 설정하므로 **카드를 건너뛰지는 않는다**(멱등). 영향은 `exiting` 타이머 중복과 포커스 시퀀스 중복 정도 → Low.
- M9b (넘기는 중/끝내는 중 소리 멈춤): 없으면 날아가는 180ms 동안(그리고 `phase` 가 `finishing` 으로 간 동안) 소리가 더 이어질 수 있다. `view` 효과(M9a)는 잡혀 있어 카드가 바뀌면 멈춘다 → Low.

## 결함 목록

| ID | 등급 | 위치 | 근거 | 권장 수정 |
|---|---|---|---|---|
| REV070-1 | **Low (문서)** | `docs/screens.md` 1632 · 1659 · 10210 · 10258 · 10263 (+ 선택 1743) | `[⚠ task-070 → …]` 표기 없이 옛 지도가 사실처럼 남아 있다. ① **1632** 저항 행 「안 답한 카드의 왼쪽, 첫 카드의 오른쪽」— 지금은 첫 카드의 왼쪽, 그리고 다음·확인 시트를 못 여는 상태의 오른쪽. ② **1659** CHOICE 흐름도 「(다음 / ← 밀기 / →키)──▶ 다음 카드」 — ← 밀기는 이전이다. ③ **10210** §23 상태표 F0 행 마지막 칸 「막힘 … + 튕김(×0.25 저항)」 — 안 푼 카드의 오른쪽 밀기는 튕김이 아니라 확인 시트를 연다(F1·B0 행은 「막힘」만 써서 키/버튼 기준으로 맞다). ④ **10258** E.5 「왼쪽 = 막힘(안 답함), 오른쪽 = 이전, 위 = 표시」 — 왼쪽 = 이전, 오른쪽 = 푼 카드는 다음/안 푼 카드는 확인 시트. ⑤ **10263** 흐름도 「Ac(머묾) ─[다음]/← 밀기/→/Enter─▶ 다음 카드」 — ← 밀기는 이전, 다음은 오른쪽 밀기. ⑥(선택) **1743** 상태표 `next()` 행 「`canNext` 아니면 hint + 튕김」 — 키/버튼 경로의 서술이라 거짓은 아니나 제스처 튕김은 사라졌다. ⑦(선택) **10156** 「§5-0 5(제스처 의미)·저항 … 그대로 유효」 — task-059 시점 서술이고 10094 머리 표기(「충돌하면 §24 가 이긴다」)가 덮지만 task-070 표기는 없다. | 위 줄에 task-060 방식 `**[⚠ task-070 → §24-6: …]**` 표기만 추가(수정은 reviewer 가 하지 않음). 이미 `[⚠ task-070 …]` 표기가 있는 1313·1608·1630·1631·1927·1928·10120·10208·10220·10357·10586·10587·10629 는 정상. §24-6 본문(10638~10652)은 코드와 일치함을 확인 |
| REV070-2 | Low (시험, 기존 구멍) | `useVocabDeck.ts` 302·327행 `exitingRef.current` 가드 | M8a·M8b 생존. 훅을 렌더하지 않아 가드가 시험 어디에도 없다 | 구조(task-070) 훅 시험에 `/next = useCallback\(\(\) => \{\s*if \(phaseRef\.current !== 'playing' \|\| exitingRef\.current\) return/` 와 `prev` 짝 두 줄 추가(선택, 후속) |
| REV070-3 | Low (시험, 기존 구멍) | `VocabDeck.tsx` 114~116행 소리 멈춤 효과 | M9b 생존 | 구조(task-070) 덱 시험의 `stopSound` 단언 옆에 `\[deck\.exiting, deck\.phase, stopSound\]` 효과 존재 단언 1줄(선택, 후속) |
| (관찰, 결함 아님) | — | 제스처 습관 | 옛 지도(오른쪽 = 이전)에 익숙한 손으로 푼 카드를 오른쪽으로 밀면 **다음 카드**로 가고, 마지막 푼 카드면 결과(`doFinish`)로 간다. 사용자가 고른 지도(L1)의 귀결이며 dev 한계 L1 에 기록됨. 되돌림 = 왼쪽 밀기·[이전] | 폰 확인 항목으로 둔다. 거슬리면 마지막 카드의 오른쪽 밀기에만 확인을 붙이는 후속 IMP 를 사용자가 판단 |

## 폰 확인 항목 (NOT_VERIFIED — QA 없음, 실기기 몫)
1. 오른쪽 문턱(60px)에서 푼 카드는 다음, 안 푼 카드는 확인 시트로 갈리는 체감, 옛 습관(오른쪽 = 이전)으로 푼 카드를 밀었을 때의 당황 정도.
2. `overflow-x-clip` 이 실기기 WebView 에서 오른쪽 날아가기 때 가로 스크롤 흔들림을 막는지(CSS 효과라 단위 시험 불가).
3. 360px·글꼴 130%↑ 에서 터치 힌트 한 줄 `truncate`(새 문구는 옛 문구와 같은 길이 이하).
4. 안 푼 카드·첫 카드의 왼쪽 밀기 저항 + 「첫 카드예요」 안내가 뜨는지.

## 절차 기록
- 이 소환은 미러 `~/.node-local/thekaiwa-rev070` 만 변이했고 매번 `cmp` 로 저장소 원본과 동일 복원을 확인했다(마지막에 `diff -rq` 0, `.rev070bak` 잔여 0). 저장소 `src/`·`docs/` 는 읽기만 했다.
- **고지**: 변이 하니스를 `scratchpad/mutate070.py` 에 썼는데, 같은 경로에 developer 의 하니스가 있었고 **내 파일로 덮어썼다**(세션 scratchpad 는 공유). developer 변이 35개의 정의는 [[task-070-dev-record]] 표에 남아 있고 저장소·볼트 산출물에는 영향이 없다.
- Codex 검토: 이 task 에는 없음(judge light, C2 개입 판정 대상 아님).
- high_risk_areas (QA 없음 → 사용자 폰 확인용): 오른쪽 밀기 문턱·푼/안 푼 갈림, 마지막 푼 카드의 오른쪽 밀기(결과 이동), 오른쪽 날아가기의 가로 스크롤.
- `native_change`: false · `versionCode` 변경 불필요(웹 배포만).

```json
{ "reviewId": "REV-070", "status": "PASS", "issues": [
  { "id": "REV070-1", "severity": "LOW", "component": "docs/screens.md:1632,1659,10210,10258,10263(+1743)" },
  { "id": "REV070-2", "severity": "LOW", "component": "src/components/vocab/useVocabDeck.ts:302,327" },
  { "id": "REV070-3", "severity": "LOW", "component": "src/components/vocab/VocabDeck.tsx:114-116" } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 3 }, "native_change": false }
```
> Output Schema 판정 규칙(PASS = Critical 0·High ≤1)상 `status` 는 PASS 이고, 사람이 읽는 판정은 **PASS_WITH_NOTES**(수정 없이 진행 가능, Low 3건은 선택 후속, 문서 Low 는 Leader 가 배포 전 한 번에 정리하길 권장)이다.
