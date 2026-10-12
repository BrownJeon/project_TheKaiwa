---
task_id: task-060
title: "task-060 Developer 기록 (오늘의 단어 덱 조작 정리, IMP-0031·0032·0033, light 트랙)"
tags:
  - type/task
  - domain/improvement
  - domain/vocab
created: 2026-10-12
---

# task-060 — Developer 기록

이력서 본문: [[task-060-improve-deck-controls]]

## 진행 기록
- [착수] 이력서·덱 코드(VocabDeck·DeckToolbar·FlipControls·GestureHint·SwipeCardStack·useVocabDeck·deck·cardFirst·hooks·labels·FinishConfirmSheet·VocabCardFace)·시험·annotations 층·서버 `recordAttempt` 를 읽음.
- 전용 미러 `~/.node-local/thekaiwa-dev060`(`KAIWA_LOCAL_ROOT` sync + predeploy node_modules `cp -al`, package.json 동일 확인).
- 기준선(변경 전) `src/components` 전체 시험: exit 0, `# tests 1260 / # pass 1260 / # fail 0`.

## 서버 동작 확인(건너뛰기 확인 시트 문구 근거, 코드만 읽음 — 서버 무변경)
- `src/modules/learning/vocab/sessions.ts` `recordAttempt`: `skipped:true` → `answer='SKIPPED'`, 응답 `correctText = meaningSnap`(필수 문자열) → 덱이 뒷면(결과 띠 「건너뛴 카드」 + 뜻)을 그린다. 같은 `order` 에 답이 있으면 **첫 결과 그대로**(다시 풀기 불가). → 이력서 문구 「건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.」는 사실과 맞다(그대로 씀).

## 체크포인트 1 — 구현 1차 완료(시험 먼저 → 빨강 18 → 구현 → 초록)
- 시험 먼저: `deck.test.ts`·`cardFirst.test.ts` 수정·추가 후 미러 실행 → 56개 중 **18 fail**(새 함수 없음·옛 동작) 확인 → 구현 → **56/56 pass**.
- 변경 파일(소스 10 + 시험 2 = 12, light 한계 「12개 초과」 이내):
  - `src/components/vocab/deck.ts` — `resistX` 셋째 인자 `canSkip`(의미만, 값 규칙 그대로) · `KeyIntent` 에 `hangul` 추가·`skip`→`skipAsk` · H 키(KeyH 포함) · S = `skipAsk` · **↑(ArrowUp) 표시 해제** · `hangulPrefOf`·`displayToggleWrites` 순수 함수.
  - `src/components/vocab/cardFirst.ts` — `upAction`·`canAskSkip`·`rightAction`·`hangulBlock` 순수 함수, `CARD_FIRST` 에 `slotHint`·`slotHintNoChoice`·`flipBtn`·`skipBtn`·`prevByButton`·`hangul{label,none,settingOff}`·`skipSheet{title,body,confirm,cancel}` 추가, `answerFirst` 문구 교체, `KEY_HINT` 터치·키 문구 교체.
  - `src/components/vocab/hooks.ts` — `VOCAB_KEYS.hangulDefault`.
  - `src/components/vocab/useVocabDeck.ts` — `showHangul`(useStoredString + `hangulPrefOf`)·`toggleHangul(block)`·`toggleReading` 이 `displayToggleWrites` 사용.
  - `src/components/vocab/SwipeCardStack.tsx` — `canGoPrev`→`canSkip`, `onUp: () => boolean` 이고 true 일 때만 bump.
  - `src/components/vocab/FlipControls.tsx` — 앞면(뜻 있음): 버튼 없이 `h-[52px]` 자리 + 안내(`aria-hidden`) + sr-only [뜻 보기](firstRef)·[객관식](choicesRef).
  - `src/components/vocab/DeckToolbar.tsx` — 안 답한 카드 `[이전][읽기][표시][한글]`, sr-only [건너뛰기](줄 밖).
  - `src/components/vocab/SkipConfirmSheet.tsx`(신규) — 공용 Sheet, describedBy, 확정→취소, 첫 초점 [취소](setTimeout 0, LogSheets 와 같은 방식).
  - `src/components/vocab/VocabCardFace.tsx` — 앞면 한글 줄을 `showReading` 조건에서 뺌(덱이 넘기는 `hangul` 상태만 따름). **이력서 파일 목록에 없던 파일** — [읽기]/[한글] 분리에 필수(앞면 한글 줄이 `showReading ?` 로 묶여 있었다), 1줄 변경.
  - `src/components/vocab/VocabDeck.tsx` — onUp/onRight/canSkip 배선, `skipFor`(카드 order) 지역 상태 + 파생 `skipOpen`, 키 `hangul`·`skipAsk`, `faceHangul = deck.showHangul && 층`, `hangulBlock`(useDisplayPrefs), SkipConfirmSheet.
  - 시험: `src/components/vocab/__tests__/deck.test.ts`, `src/components/vocab/__tests__/cardFirst.test.ts`.
- 옛 동작을 단언하던 기존 시험 → 새 동작으로 고친 목록(단언 약화 없음, 같은 자리에 새 기대값):
  1. `deck.test.ts` resistX — 값 그대로, 설명만 「첫 카드를 오른쪽(이전)」→「건너뛸 수 없는 카드를 오른쪽(건너뛰기)」.
  2. `deck.test.ts` keyAction CHOICE — `ArrowUp → flag` 를 `ArrowUp → null` 로(이력서 A 「표시는 [표시]·F 키로만」), `S → skip` 을 `S → skipAsk` 로(이력서 C 「S = 확인 시트 열기」).
  3. `deck.test.ts` 카드 우선 keyAction — 열림에서 `s → skip` 을 `skipAsk` 로.
  4. `cardFirst.test.ts` fixedHint — 터치·front·frontNoChoice·open·self 기대 문구를 새 KEY_HINT 로(choice·done 그대로).
  5. `cardFirst.test.ts` blockedNextHint — 「뜻 보기나 객관식으로 먼저 답해 주세요」→「카드를 위로 밀거나 눌러서 먼저 답해 주세요」(이력서 E).
- 미커밋 파일: 위 12개 + 이 기록 파일(커밋 안 함 — Leader).

## 체크포인트 2 — 회귀 1건 수정 + 실행 증빙(완료)
- 회귀: 첫 `src/components` 전체 실행에서 `topic/__tests__/removalA11y.test.ts` 「M-1 기존 Sheet 호출처는 describedBy 를 넘기지 않는다 — 확인 시트 한 곳만」 1 fail(새 시트가 `Sheet describedBy` 를 넘김). 그 시험(범위 밖 파일)을 고치지 않고 `SkipConfirmSheet` 가 `Sheet describedBy` 대신 **두 버튼에 `aria-describedby={bodyId}`** 를 달도록 바꿈 — 첫 초점이 [취소]여도 화면 읽기가 본문을 읽는다. 내 구조 시험도 그에 맞춰 「Sheet describedBy 없음 + 버튼 설명 2곳」으로 잠금.

### 실행 증빙(전용 미러 `~/.node-local/thekaiwa-dev060`, NFS 원본 sync 후)
- `./node_modules/.bin/tsc --noEmit` → **exit 0**, 출력 없음.
- `./node_modules/.bin/eslint src` → **exit 0**, `✖ 5 problems (0 errors, 5 warnings)` — 경고 5건은 모두 기존 파일(`admin/trace/DiagnosticsScreen`·`settings/{LearningSettings,OnDeviceDiagnosticsCard,SpeechSettings,VoiceSettings}`), `components/vocab` 경고 0.
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/components -name '*.test.ts' | sort) src/modules/speech/__tests__/sttClientBoundary.test.ts` → **exit 0**, `# tests 1278 / # pass 1278 / # fail 0` (components 1276 = 기준선 1260 + 새 시험 16, 나머지 2 = 컴포넌트 경계 시험).
- 덱 두 시험만: `deck.test.ts`+`cardFirst.test.ts` → 56/56.
- `./node_modules/.bin/next build > log 2>&1` → **exit 0**, `✓ Compiled successfully in 6.6s`, 정적 21/21. 경고 3건은 기존(`persona/loader.ts`·`claudeCli.ts` Dynamic filesystem access) — 이 task 와 무관.
- 변이 확인(미러에서만 바꾸고 NFS 로 재동기화, `diff -r src/components/vocab` 동일 확인 RESTORED). 묶음 안에서 누적: ① bump 를 onUp 결과와 무관하게 → 1 fail ② +한글 이어받기 무시 → 2 fail(누적) / 복구 후 ③ [읽기] 누를 때 한글 굳히기 제거 → 1 fail ④ +이미 뒤집은 카드도 flip → 2 fail(누적) ⑤ +앞면 한글 줄을 다시 `showReading ?` 로 묶음 → 3 fail(누적). 다섯 변이 모두 잡힘.

### 높이·폭 예산(완료 기준 3 — 소스·계산 근거)
- 앞면 첫 줄 = `h-[52px]` 고정(안내 `line-clamp-2`, 13px×1.4×2 = 36.4px ≤ 52) · 뒷면 [알았어요][몰랐어요] = `h-[52px]` · 답한 카드 기록 줄 `min-h-[52px]`(한 줄) → 뒤집어도 첫 줄 높이 같음(렌더 시험으로 잠금). 무대 하한 `min-h-[224px]`·카드 200~340 그대로(deckStage 시험 통과).
- 안내 글 폭: 360 폭에서 슬롯 안쪽 312px, 「카드를 위로 밀면 뜻이 보여요 · 탭하면 객관식으로 풀어요」 약 330px → 2줄(`break-keep`), 3줄 불가. 보기 없는 카드 문구 약 220px → 1줄.
- 도구 줄 `grid-cols-4 gap-2`: 360 폭 칸 너비 (328−24)/4 = 76px, 「가」 아이콘 20px + 「한글」 12px×2 — 넘치지 않음(`TOOL` 에 `min-w-0`). 412 폭 89px.
- 터치 힌트 「↑ 밀어 뜻 보기 · ← 밀어 다음 · → 밀어 건너뛰기」 12px 약 255px < 328px(360 폭) — 말줄임 없음. 키 힌트(정밀 포인터) 앞면 문구는 약 340px — 360 폭 정밀 포인터에서는 끝이 말줄임될 수 있다(데스크톱 덱 폭 488px 에서는 들어감).
- 뒷면 듣기 줄(`DeckListenRow`, task-059 D3)은 그대로 뒷면에서만 생긴다 — 첫 줄 높이 불변과 별개로 기존 동작.

## 설계-코드 차이(Leader 확인 필요한 것 포함)
1. **앞면 슬롯 높이 `h-[52px]`(이력서는 `min-h-[52px]`)** — 안내가 3줄로 늘어 높이가 바뀌는 길을 막으려고 고정 + `line-clamp-2`. 의미는 같음(52px 안).
2. **↑(ArrowUp) 키 = 표시 해제, 새 동작 없음** — 이력서 A 「표시는 [표시]·F 키로만」을 따름. screens.md §5-2 C 표의 `F`·`↑` 행은 Leader 가 고칠 곳. ↑ 를 뜻 보기(위로 밀기의 키 짝)로 줄지는 미정 — 지금은 아무 동작 없음.
3. **이전 4지선다(CHOICE) 세트의 위로 밀기** — 이력서에 없는 갈래. 고르기 전엔 뜻이 없으므로 `HINT.answerFirst`(「먼저 답을 골라 주세요」) 한 줄 안내, 카드는 튀지 않음. 터치 고정 힌트는 이력서대로 한 문구라 CHOICE 세트에서도 「↑ 밀어 뜻 보기」가 보인다(옛 세트에서만 사실과 어긋남).
4. **오른쪽 밀기 안내** — 답한·지난 카드는 첫 카드여도 같은 「이전 카드는 아래 [이전] 버튼으로 가요」(첫 카드에서 [이전]은 「첫 카드예요」로 막힘). 저장 중(안 답한 지금 카드)은 무반응 — 드래그 자체가 `locked` 로 막혀 실제로는 닿지 않는다.
5. **[한글] 막힘 원인 판별**: 앱 표시 설정이 로드됐고 한글 끔 → 「설정에서 한글 표기를 켜 주세요」, 켬인데 표제어 층이 `none`(분석 불가·실패·저장 읽기와 불일치) → 「이 카드는 한글 표기가 없어요」, `loading`·`ready`·설정 로드 전 → 막지 않음.
6. **한글 상태 이어받기 방식**: 새 키가 비어 있으면 읽을 때마다 [읽기] 값을 이어받고(쓰지 않음), **[읽기]를 누르는 순간** 지금 보이는 한글 값을 새 키에 먼저 굳힌다(`displayToggleWrites`). 마운트 효과에서 쓰는 방식은 하이드레이션 첫 렌더가 서버 스냅샷(null)을 보고 저장값을 덮을 위험이 있어 피했다.
7. **건너뛰기 확인 시트 설명 연결** — 위 회귀 참고(Sheet `describedBy` 대신 버튼 `aria-describedby`).
8. **VocabCardFace.tsx 수정**(이력서 파일 목록 밖, 같은 `components/vocab`) — 앞면 한글 줄이 `showReading ?` 에 묶여 있어 분리에 필수, 1줄.

## 미확인·Leader/designer 판단 필요
- **안내 중복**: 앞면 카드 안의 기존 안내(`frontHint` 「카드를 누르면 객관식으로 골라요」, task-059 승인 문구)와 새 첫 줄 안내(「…탭하면 객관식으로 풀어요」)가 같은 정보를 두 번 보인다. 이력서대로 둘 다 두었다 — 카드 안 안내를 줄일지 designer 판단.
- **sr-only 버튼의 초점 표시**: 새 카드의 첫 초점(`firstRef`)·C 로 보기를 닫을 때의 초점이 보이지 않는 [뜻 보기]/[객관식]에 간다(기존 초점 규칙 유지). 키보드 사용자에게 초점 위치가 보이지 않는다(WCAG 2.4.7). 슬롯에 초점 링을 보일지(예: `has-[:focus-visible]` 테두리)는 시각 결정이라 구현하지 않았다.
- 실기기 제스처 감각(위로 밀기 80px·오른쪽 60px 문턱에서 뜻 보기/확인 시트가 의도대로 갈리는지, 대각선 위가 위로 판정되는 기존 규칙)은 사용자 폰에서만 확인 가능 — NOT_VERIFIED.
- 개발 서버를 띄우지 않았으므로 브라우저 화면 확인(360/390/412)은 하지 않았다 — 렌더 시험·계산으로만.
- 커밋·push 안 함. screens.md(§5-2 B·C 표·§23) 갱신은 Leader 몫: 도구 줄 [한글], 첫 줄 안내, 제스처 지도, 키 표(H·S 확인·↑ 해제), 확인 시트.

## 수정 라운드(2026-10-12) — 초점 표시·안내 중복·옛 4지선다 터치 힌트 3건
범위: `src/components/vocab/**` 와 그 시험만. 서버·API·스키마·다른 task 파일 무변경, 커밋·push 안 함.

### 변경 파일(소스 4 + 시험 1 = 5)
- `src/components/vocab/cardFirst.ts` — ① 순수 함수 `choicesToggleFocus(open, from)`(열면 `'first'`, 닫기·카드 탭은 `null`) ② `CARD_FIRST.slotHint` = 「카드를 위로 밀면 뜻이 보여요」, `slotHintNoChoice` = 「카드를 위로 밀어도 뜻이 보여요」(카드 안 `frontHint`·`tapToPeek` 는 그대로) ③ `KEY_HINT.touchChoice` = 「← 밀어 다음 · → 밀어 건너뛰기」 + `fixedHint` 가 `coarse && mode==='CHOICE'` 일 때 그것을 돌려줌(FLIP 터치 힌트 `KEY_HINT.touch` 그대로).
- `src/components/vocab/FlipControls.tsx` — 앞면 안내 자리의 sr-only [뜻 보기]·[객관식] 에서 `ref` 제거(`choicesRef` prop 삭제, 뒷면 [알았어요] 의 `firstRef` 는 그대로). 두 버튼은 `SR_CHIP` 클래스: 평소 `sr-only`, `:focus-visible` 일 때 52px 자리 가운데에 칩(`inset-0 m-auto h-8 w-fit` + `border-line`·`bg-surface`·`rounded-full`·앱 공통 `outline-2 outline-accent`). 부모는 `group/slot relative`(높이 `h-[52px]` 유지), 안내 글은 `group-has-[:focus-visible]/slot:invisible` 로 칩이 뜨는 동안만 감춤(겹침 방지).
- `src/components/vocab/VocabDeck.tsx` — `choicesRef` 와 `'choicesBtn'` 분기 삭제(초점 효과는 `next`→`nextRef`, 그 밖→`firstRef`; 앞면 안내 자리에서는 `firstRef.current` 가 비어 초점을 옮기지 않음).
- `src/components/vocab/useVocabDeck.ts` — `FocusTarget.kind` 에서 `'choicesBtn'` 삭제, `toggleChoices` 가 `choicesToggleFocus` 로 초점 종류를 정함.
- `src/components/vocab/__tests__/cardFirst.test.ts` — 아래 시험.

### 설계 메모
- `focus-visible:not-sr-only` 는 쓰지 않았다: position 을 `static` 으로 되돌려 자리 밖으로 밀어내고, 같은 변형의 `absolute` 와 우선순위가 같은 구체성이라 CSS 순서에 기댄다(Tailwind 4.3.3 정의 확인: `not-sr-only` = position:static·width/height:auto·padding/margin:0·overflow:visible·clip-path:none·white-space:normal). 대신 sr-only 가 숨기는 속성(크기·여백·잘림)만 `focus-visible:` 로 되돌린다 — 각 속성이 서로 다른 유틸이고 변형(0,2,0) 구체성이 기본 `.sr-only`(0,1,0)를 이기므로 순서 의존이 없다.
- 이름 있는 group(`group/slot`): 이름 없는 `group` 은 위쪽 어느 `.group` 조상이든 `:has(:focus-visible)` 에 반응해, 툴바 버튼에 초점이 가도 안내 글이 사라질 수 있다.
- 시험 단언을 바꾼 곳(스펙 변경이 요구, 약화 아님): ① `fixedHint` 의 `coarse+CHOICE → KEY_HINT.touch '터치가 먼저'` → `KEY_HINT.touchChoice`(수정 3) ② `CARD_FIRST.slotHint`·`slotHintNoChoice` 문자열 단언 → 새 문구(수정 2).

### 시험(먼저 고쳐 빨강 확인 → 구현 → 초록)
- 빨강: `cardFirst.test.ts`+`deck.test.ts` 59개 중 **5 fail**(fixedHint·문구·`choicesToggleFocus`·초점 구조·칩 구조), 구현 후 **59/59**.
- 새 시험 3개: `choicesToggleFocus`(열기 btn·key=first, 닫기·카드 탭=null) / 「초점 구조」(`sourceCode.ts` `readCode` 주석 제거본: 앞면 분기에 `ref=` 없음·`choicesRef` 없음·뒷면 `ref={r === 'CORRECT' ? firstRef : undefined}`·`ChoiceList` 첫 항목 ref·`nextRef.current`/`firstRef.current` 유지·`choicesBtn` 없음·훅이 `choicesToggleFocus(` 사용) / FlipControls 앞면 칩(두 버튼 모두 sr-only 이고 focus-visible 로 inset-0·m-auto·h-8·w-fit·overflow-visible·clip-path:none·border-line·outline 복원, position 변경 유틸 없음, 높이 한 자리 이상 없음, 부모 `relative`·`group/slot`·`h-[52px]`, 안내 글 `group-has-[:focus-visible]/slot:invisible`). 기존 시험 보강: 문구 단언 + 카드 안 안내 불변 + 탭·누르·객관식 단어가 첫 줄 안내에 없음, `fixedHint` 이전 4지선다 터치(면 무관)·정밀 포인터 키 힌트 불변.
- 변이 확인(미러에서만 바꾸고 NFS 로 복구, `diff -r src/components/vocab` SAME): M1 sr-only 버튼에 ref 재부착 / M2 `focus-visible:not-sr-only` 추가 / M3 `choicesToggleFocus` 가 닫을 때도 first / M4 `fixedHint` 가 CHOICE 터치도 `touch` / M5 `slotHint` 옛 문구 / M6 안내 글의 `group-has` 제거 / M7 훅이 닫을 때도 초점 이동 — **일곱 변이 모두 1 fail 로 잡힘**.

### 실행 증빙(전용 미러 `~/.node-local/thekaiwa-dev060`, NFS 원본 `sync-local.sh` 후)
- `./node_modules/.bin/tsc --noEmit` → **exit 0**, 출력 없음.
- `./node_modules/.bin/eslint src` → **exit 0**, `✖ 5 problems (0 errors, 5 warnings)` — 경고 5건은 기존 파일(task-060 1차 기록과 같은 5건), `components/vocab` 경고 0.
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/components -name '*.test.ts' | sort) src/modules/speech/__tests__/sttClientBoundary.test.ts` → **exit 0**, `# tests 1283 / # pass 1283 / # fail 0`. (1차 기록 1278 대비 +5: 내 새 시험 +3, 나머지 +2 는 공유 작업 트리의 다른 task(`scenario`·`talk` 시험 수정)에서 온 것으로 추정 — 내가 만든 변경 아님.)
- `./node_modules/.bin/next build > log 2>&1` → **exit 0**, `✓ Compiled successfully`, 정적 21/21. 기존 경고(`SPAWN_FAILED` 등 `claudeCli` 계열)는 이 task 와 무관.
- CSS 산출 확인(빌드 결과 `.next/static` css): `.focus-visible\:inset-0:focus-visible{inset:0}`·`m-auto`·`h-8`·`w-fit`·`overflow-visible`·`[clip-path:none]`·`border`·`px-3`·`outline-2` 전부 생성, `.group-has-[:focus-visible]/slot:invisible:is(:where(.group\/slot):has(:focus-visible) *){visibility:hidden}` 생성 — 모두 기본 `.sr-only` 보다 구체성이 높다.
- 브라우저 실측(정적 픽스처 — 위 css 를 인라인한 HTML 에 FlipControls 서버 렌더 마크업, 개발 서버 아님, 390 폭, 확인 뒤 정적 서버 종료·산출물 삭제): 평소 슬롯 328×52, 안내 글 한 줄(158×18px — 새 문구는 360 폭에서도 한 줄), sr-only 버튼 1×1. Tab → [뜻 보기] 칩 65.5×32 가 슬롯 정중앙(x 159.3~224.8, y 59~91, 슬롯 y 49~101), `:focus-visible` true, 안내 글 `visibility:hidden`, **슬롯 높이 52px·뒤따르는 요소 위치 불변**. 한 번 더 Tab → [객관식] 칩 61.9×32 같은 자리. 스크린샷으로 칩 윤곽(accent 2px)이 보임.

### 남은 의문·Leader 몫
1. **DeckToolbar 의 sr-only [건너뛰기]** 도 같은 문제(Tab 으로 닿아도 초점이 안 보임)다 — 이번 지시 범위(앞면 [뜻 보기]/[객관식])가 아니라 손대지 않았다. 같은 방식(칩)으로 고칠지 Leader 판단.
2. **닫을 때 초점**: C 로 객관식을 닫으면 초점이 더 이상 [객관식] 으로 가지 않는다 — 열려 있던 보기 버튼이 사라지면 초점은 `body` 로 떨어진다(키 단축키는 window 리스너라 계속 동작). 보이는 컨트롤이 없으므로 의도한 결과이나, 키보드 사용자가 닫은 뒤 초점이 어디 있는지 알리는 별도 표지는 없다.
3. **새 카드(앞면)의 첫 초점**: 앞면 안내 자리에는 자동 초점 대상이 없어 초점이 직전 위치(보통 [다음 카드] 등 보이는 버튼 또는 body)에 남는다. 이전에는 보이지 않는 [뜻 보기] 로 갔다.
4. `docs/screens.md` §23(약 10167·10170·10244·10376행)이 옛 `choicesRef`/`FocusTarget 'choicesBtn'`/「C 로 닫기 → [객관식] 초점」을 서술한다 — Leader 가 고칠 곳(첫 줄 안내 문구 2종·`touchChoice` 도 §23/§5-2 힌트 표에 반영).
5. 실기기에서 Tab 키(블루투스 키보드)로 칩이 나타나는 모습·TalkBack 포커스 이동은 NOT_VERIFIED(브라우저 실측은 데스크톱 Chromium).

### 미커밋 파일(이 라운드가 건드린 것)
`src/components/vocab/{cardFirst.ts,FlipControls.tsx,VocabDeck.tsx,useVocabDeck.ts,__tests__/cardFirst.test.ts}` + 이 기록 파일. (작업 트리의 task-060 1차 변경 12개·`SkipConfirmSheet.tsx` 는 그대로 미커밋.)

### 수정 라운드 추가(2026-10-12, Leader 지시) — 도구 줄 [건너뛰기] 도 Tab 으로 닿을 때만 칩으로 보이게
위 「남은 의문 1」을 이번 task 범위로 결정받아 처리. 범위 `src/components/vocab/**` 와 시험만, 커밋·push 안 함. 의문 2·3·4 는 Leader 몫이라 손대지 않음.

**변경 파일(신규 1 + 수정 3)**
- `src/components/vocab/srChip.ts`(신규) — `SR_CHIP` 클래스 한 곳(`FlipControls` 앞면 [뜻 보기]·[객관식]과 `DeckToolbar` [건너뛰기]가 같은 모양을 쓴다). 앞선 라운드에서 `FlipControls` 안에 있던 상수를 옮긴 것이라 앞면 칩 동작은 그대로.
- `src/components/vocab/FlipControls.tsx` — `SR_CHIP` 을 `./srChip` 에서 가져옴(상수 정의 삭제, 나머지 무변경).
- `src/components/vocab/DeckToolbar.tsx` — 안 답한 카드의 도구 줄을 `<div className="relative">` 한 겹으로 감싸고(높이·여백 없음, 칩의 위치 기준), [건너뛰기] 버튼은 4칸 격자 밖·`className={SR_CHIP}`·ref 없음. 답한 카드 도구 줄은 무변경.
- `src/components/vocab/__tests__/cardFirst.test.ts` — 칩 구조 단언을 `assertSrChip` 으로 묶어 앞면·도구 줄이 같이 쓰고, 새 시험 2개.

**시험(먼저 → 빨강 → 구현 → 초록)**
- 새 시험: ① 「DeckToolbar [건너뛰기]」 — sr-only+focus-visible 칩 클래스 전부, 감싸는 겹 클래스가 정확히 `relative`(높이·여백·flex·grid 없음), 칩이 4칸 격자 밖·격자 뒤(Tab 순서는 [한글] 다음)·4칸 모두 `h-[52px]`, 답한 카드에는 칩 자체가 없음 ② 「초점 소스 가드」(`sourceCode.ts` `readCode`) — `DeckToolbar` 의 `ref=` 는 답한 카드 분기의 `ref={nextRef}` 한 곳뿐(나머지에 ref·`skipRef`·`useRef` 없음), `VocabDeck` 의 `.focus(` 호출은 효과 한 곳이고 대상은 `nextRef.current`/`firstRef.current` 뿐, `FocusTarget` 종류는 `'next' | 'first'` 뿐, `SkipConfirmSheet` 는 `querySelector`/`getElementById` 없이 [취소] ref 로만 초점.
- 빨강: 61개 중 1 fail(① 칩 구조 — 도구 줄 `relative` 겹·칩 클래스 없음). ② 는 현재 코드가 이미 만족하는 회귀 못박기라 처음부터 초록, 변이로 검증.
- 초록: `cardFirst`+`deck` **61/61**.
- 변이 7개(미러에서만 바꾸고 NFS 로 복구, `diff -r` SAME): N1 [건너뛰기] 를 `sr-only` 로 되돌림 / N2 [건너뛰기] 에 `ref={nextRef}` / N3 감싸는 `relative` 제거 / N4 감싸는 겹에 `pt-2` / N5 [건너뛰기] 를 4칸 격자 안으로 / N6 `FocusTarget` 에 `'skip'` 추가 / N7 `SR_CHIP` 에 `focus-visible:not-sr-only` — **모두 잡힘**(N5·N7 은 2 fail).

**실행 증빙(미러 `~/.node-local/thekaiwa-dev060`, 매번 NFS sync 후)**
- `tsc --noEmit` → **exit 0**.
- `eslint src` → **exit 0**, `✖ 5 problems (0 errors, 5 warnings)`(기존 5건 동일), `components/vocab` 경고 0.
- `src/components` 전체 + `sttClientBoundary` → **exit 0**, `# tests 1285 / # pass 1285 / # fail 0`(앞 라운드 1283 + 새 시험 2).
- `next build` → **exit 0**, `✓ Compiled successfully`, 정적 21/21. 빌드 css 에 `focus-visible:inset-0`·`w-fit`·`group-has-[:focus-visible]/slot` 규칙 존재.

**브라우저 실측(정적 픽스처 — 빌드 css 인라인 HTML 에 GestureHint·FlipControls 앞면·DeckToolbar 서버 렌더, 개발 서버 아님, 360·412 폭, 끝난 뒤 정적 서버 종료·산출물 삭제)**
- Tab 7번째([한글] 다음)에 [건너뛰기] 에 닿음, `:focus-visible` true. 칩 73.8×32 가 도구 줄 328×52 정중앙(360 폭: x 143.1~216.9, y 237~269 / 줄 y 227~279).
- **레이아웃 불변**: 감싸는 겹·4칸 격자·4칸 각각·도구 줄 바깥 상자·덱 전체·뒤따르는 요소의 위치·크기가 초점 전후 모두 동일(칸 76×52 @360, 89×52 @412).
- **가려지는 요소**: 칩이 덮는 것은 도구 줄의 **[읽기]·[표시] 두 칸의 가운데 일부**뿐이다 — 각 칸의 안쪽 32.9px×32px(360 폭 칸 76px 기준 오른쪽/왼쪽 약 43%, 아이콘·라벨이 칩 가장자리에서 잘려 보임 — 스크린샷 확인; 412 폭 칸 89px 은 안쪽 37%). [이전]·[한글] 칸, 위의 안내 줄·앞면 안내 자리는 덮지 않음(세로 겹침 0). `visibility:hidden` 으로 숨는 요소 없음. 칩이 닿는 동안에도 두 칸 버튼 자체는 그대로 있고 초점은 칩에 있다.

**남은 의문(이 건)**
- 위 「가려지는 요소」: 도구 줄 위·아래에 칩이 들어갈 빈자리가 없어(위쪽 8px 간격 뒤는 안내 자리·보기·[알았어요] 버튼, 아래쪽은 12px 여백) 줄 위에 얹었다. [읽기]·[표시] 두 칸의 일부가 칩에 가려지는 것이 싫다면 선택지: (a) 지금(Tab 으로 칩에 닿은 동안만 일시적으로 덮임) (b) 칩을 줄 위 안내 자리로 올리되 안내 글처럼 그 자리 내용을 감춤(보기·[알았어요] 상태에서는 컨트롤을 덮게 되어 비권장) (c) 칩이 뜨는 동안 두 칸을 흐리게. 이 라운드는 (a) 로 구현. 확정 지시가 있으면 따른다.
- 실기기(블루투스 키보드·TalkBack)에서의 칩 모습은 NOT_VERIFIED(브라우저 실측은 데스크톱 Chromium).

**미커밋 파일(이 추가 라운드가 건드린 것)**: `src/components/vocab/{srChip.ts(신규),FlipControls.tsx,DeckToolbar.tsx,__tests__/cardFirst.test.ts}` + 이 기록 파일.

## 감사 지적 반영 라운드(2026-10-12) — REV-060-1 M-1·L-1·L-2·L-3
범위: `src/components/vocab/**` 소스·시험만. 서버·API·docs·다른 세션 파일 무변경, 커밋·push·add 안 함. 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED`(`not_required`, judge none). L-4·L-5(문서)·L-6 은 지시 밖이라 손대지 않음.

### 변경 파일(소스 2 + 시험 1 = 3)
- `src/components/vocab/cardFirst.ts`
  - **M-1** 순수 함수 `skipSheetOpen({ skipFor, order, answered, phase })` — 연 카드가 지금 보이고(`order` 같음, 0 포함) · 안 답했고 · `phase==='playing'` 일 때만 true. `DeckPhase` 는 `import type` 으로만 가져옴(런타임 순환 없음).
  - **L-1** `KEY_HINT.touchDone`(`← 밀어 다음 · 이전 카드는 [이전]`, 21자) · `KEY_HINT.touchBack`(`← 밀어 다음(답한 뒤) · → 밀어 건너뛰기`, 25자) 추가, `fixedHint` 의 `coarse` 갈래를 4갈래로: 옛 4지선다 → `touchChoice` / 답한·지난 카드 → `touchDone` / 안 답한 지금 카드의 뒷면 → `touchBack` / 앞면 → `touch`(31자, 그대로). 새 문구는 모두 `touch` 이하라 12px 한 줄(약 328px)에 들어간다(글자 수 시험으로 잠금).
- `src/components/vocab/VocabDeck.tsx`
  - `skipOpen` 을 `skipSheetOpen(...)` 호출로 교체(컴포넌트 안 인라인 조건 삭제).
  - **L-3** `if (skipFor !== null && !skipOpen) setSkipFor(null)` — 열림 조건이 풀리면 연 카드 기록을 비운다. 효과가 아니라 **렌더 중 상태 정리**(같은 저장소 `scenario/ExpressionEditor.tsx` 의 패턴)라 `react-hooks/set-state-in-effect` 경고가 늘지 않는다.
  - **L-2** `askSkip` 가드에 `endOpen` 추가(`!card || endOpen || deck.phase !== 'playing' || !canAskSkip(skipCtx)`).
- `src/components/vocab/__tests__/cardFirst.test.ts` — 새 시험 7개(아래).

### 시험(먼저 → 빨강 6 → 구현 → 초록)
- 빨강: `cardFirst`+`deck` 68개 중 **6 fail**(터치 4갈래·터치 문구·`skipSheetOpen`·`onUp`·열림 배선·L-3; `onUp` 1건은 내 시험의 `block()` 끝 `}` 처리 오류라 정규식을 `\}$` 로 고침 — 단언 약화 아님). [한글]/H 키 배선 시험은 코드가 이미 맞아 처음부터 초록(회귀 못박기, 변이로 검증).
- 초록: **68/68**(기존 61 + 7).
- 새 시험 7개
  1. `fixedHint 터치 4 갈래` — 이전 4지선다·답한/지난 카드(면 무관)·안 답한 뒷면(보기 열림 무관)·앞면(보기 있음/없음/열림) + 문구 정확값 + 뜻 없는 카드 앞면.
  2. `터치 힌트 문구` — `touchDone` 에 ↑·→·건너뛰기·뜻 보기·표시 없음, `touchBack` 에 ↑·뜻 보기·이전·표시 없음 + `→ 밀어 건너뛰기` 있음, 세 문구 모두 글자 수 ≤ `touch`.
  3. `skipSheetOpen` — 열림 조건 각각(skipFor null / 다른 order / order null / 답함 / phase 6종)에서 false, 모두 충족할 때만 true, `order 0` 도 true.
  4. 구조 M-1(한글/읽기) — 주석 제거본(`readCode`)에서: `<DeckToolbar … onHangul={() => deck.toggleHangul(hangulBlocked)} onReading={deck.toggleReading} hangulAvailable={!hangulBlocked} showHangul={deck.showHangul}`, 서로의 핸들러가 아님, 키 `switch` 의 `case 'hangul': deck.toggleHangul(hangulBlocked)`·`case 'reading': deck.toggleReading()`, `DeckToolbar.tsx` 의 [읽기] 칸 `onClick={onReading}`·[한글] 칸 `onClick={onHangul}`(각 1곳, 칸의 aria 속성과 같은 요소).
  5. 구조 M-1(onUp) — `onUp` 콜백의 마지막 문장이 `return r.kind === 'flip'`, `return true`·`return !!…` 없음.
  6. 구조 M-1·L-2(건너뛰기 배선) — `skipOpen = skipSheetOpen({ skipFor, order: card?.order ?? null, answered, phase: deck.phase })` 하나(인라인 조건 재등장 금지), `<SkipConfirmSheet open={skipOpen}`, `askSkip` 이 `!card`·`endOpen`·`deck.phase !== 'playing'`·`!canAskSkip(skipCtx)` 가드 뒤에 `setSkipFor(card.order)` 로만 연다(그 안 `setSkipFor` 호출 1개, 파일 전체 인자는 `card.order`(1곳)·`null` 뿐), 열림 경로 셋(오른쪽 밀기 `if (r.kind === 'ask') askSkip()` · `case 'skipAsk': askSkip()` · `onSkipAsk={askSkip}`), `\bdeck\.skip\b` 는 시트 확정 `onConfirm={() => { setSkipFor(null) deck.skip() }}` 한 곳(참조 전달 포함).
  7. 구조 L-3 — `if (skipFor !== null && !skipOpen) setSkipFor(null)` 존재, `skipOpen` 계산 뒤 · `askSkip` 앞 본문(effect 아님), 순수 규칙 `skipFor:null` → 닫힘.
- 변이 18개(미러에서만 바꾸고 NFS 로 복구, `diff -rq src/components/vocab` SAME) — **전부 잡힘**: N1 [한글] 버튼이 `toggleReading`(1 fail) · N2 `hangulAvailable={true}` · N3 H 키가 `toggleReading` · N4 `onUp` 항상 true · N5 `skipSheetOpen` 에서 `!answered` 제거 · N6 `askSkip` 에서 `canAskSkip` 제거 · N7 `askSkip` 에서 `endOpen` 제거 · N8 L-3 비우기 제거 · N9 S 키가 `deck.skip()` 직행(2 fail) · N10 오른쪽 밀기가 `deck.skip()` 직행(2 fail) · N11 답한 카드도 `touch` · N12 `DeckToolbar` [한글] `onClick={onReading}` · N13 `skipSheetOpen` phase 검사 제거 · N14 `onSkipAsk={deck.skip}` · N15 `endOpen` 가드를 `/* */` 주석 처리 · N16 `canAskSkip` 가드를 `/* */` 주석 처리 · N17 `touchBack` 분기 제거 · N18 열림 조건을 컴포넌트에 다시 인라인. (REV-060-1 의 M2·M3·M7·M10·M11·M12 포함. 주석 처리한 코드가 통과하는 경우 없음 — N15·N16.)

### 실행 증빙(전용 미러 `~/.node-local/thekaiwa-dev060`, 매번 NFS `sync-local.sh` 후)
- `./node_modules/.bin/tsc --noEmit` → **exit 0**, 출력 없음.
- `./node_modules/.bin/eslint src` → **exit 0**, `✖ 5 problems (0 errors, 5 warnings)` — 기존 5건(`admin/trace`·`settings/*`)과 같고 `components/vocab` 0건.
- `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src/components/vocab src/components/__tests__ -name '*.test.ts' | sort)` → **exit 0**, `# tests 181 / # pass 181 / # fail 0 / # skipped 0`. 덱 두 시험(`cardFirst`+`deck`) 68/68.
- 같은 방식 `src/components` 전체 → **exit 0**, `# tests 1290 / # pass 1290 / # fail 0`(다른 세션의 talk/scenario 변경도 함께 동기화된 숫자 — 내 새 시험은 +7).
- `./node_modules/.bin/next build > log 2>&1` → **exit 0**, `✓ Compiled successfully`. 개발 서버는 띄우지 않았다.

### 의문·Leader 몫
1. **뜻 없는 카드(`peekable:false`)의 앞면도 터치 힌트가 `touchBack`** — 지시는 「앞면은 `touch`」였지만 그 카드에서는 ↑ 가 뜻을 열지 않고(`upAction` → 안내) 정밀 포인터 갈래(`side==='back' || !peekable → self`)가 이미 같은 규칙이라 맞췄다(거짓 「↑ 밀어 뜻 보기」 방지, L-1 의 취지). 지시대로 `touch` 를 원하면 `fixedHint` 한 줄(`|| !s.peekable`)과 시험 1줄만 되돌리면 된다.
2. **`touchBack` 문구**: `← 밀어 다음(답한 뒤) · → 밀어 건너뛰기` — 「답한 뒤」는 ← 가 답하기 전엔 막힘 안내(`blockedNextHint`)라서 넣었다. 더 짧게 `← 다음(답한 뒤) · → 건너뛰기` 도 가능.
3. 360 폭 한 줄(말줄임 없음)은 글자 수(25자·21자 ≤ 31자, 31자 문구가 약 255px)로만 확인 — 브라우저 실측은 안 함(NOT_VERIFIED).
4. 문서: `docs/screens.md` §24/§23 의 터치 고정 힌트 서술을 4갈래로 고치는 건 Leader 몫(`touchDone`·`touchBack` 문구 포함). L-5(옛 서술 포인터)도 그쪽.
5. 시험의 `block()` 도우미는 같은 들여쓰기의 닫는 `}` 를 찾는다 — 포매터가 `askSkip`·`onUp`·`onRight` 의 중괄호 모양을 바꾸면 시험이 먼저 알려 준다(의도된 결합).

### 체크포인트
- 완료: M-1(`skipSheetOpen` + 소스 구조 시험 4개)·L-1(터치 4갈래)·L-2(`endOpen` 가드)·L-3(렌더 중 비우기) + 시험 7개 + 변이 18/18.
- 남은 일: 없음(Reviewer 는 diff 만 재확인: `cardFirst.ts`·`VocabDeck.tsx`·`cardFirst.test.ts`).
- 주의점: `VocabDeck` 의 렌더 중 `setSkipFor(null)` 은 `skipFor !== null && !skipOpen` 일 때만 불리므로 무한 렌더가 없다(null 이면 조건 거짓).
- 미커밋 파일(이 라운드가 건드린 것): `src/components/vocab/{cardFirst.ts,VocabDeck.tsx,__tests__/cardFirst.test.ts}` + 이 기록 파일. (task-060 1차·이전 수정 라운드 변경은 그대로 미커밋.)
