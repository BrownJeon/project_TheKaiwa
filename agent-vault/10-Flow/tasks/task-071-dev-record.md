---
task_id: task-071
role: developer
title: "task-071 developer 기록 — 한글 표기가 숨겨지는 단어에 저장된 읽기로 한글 줄 보이기 (IMP-0045)"
created: 2026-10-15
tags:
  - type/record
  - domain/vocab
aliases:
  - task-071 개발 기록
---

# task-071 developer 기록

이력서 [[task-071-improve-hangul-stored-reading]] · 백로그 [[IMP-0045-hangul-fallback-stored-reading]] · track **light**(QA·데모 면제). 커밋·푸시·배포·DB 쓰기·서버 기동·운영 포트 접촉 없음(미커밋). 데모 게이트 `check.mjs` → `DEMO_GATE_PASSED`(status not_required, judge none).

## 한 줄 요약
단어 표제어 한글 줄이 「분석기 읽기 ≠ 저장 읽기」 또는 「발음 못 구함」이면 숨기는 대신, **저장 읽기를 같은 분석기에 한 번 더 넣어** 그 결과(저장 읽기와 같은 읽기 + 발음 있음)로 한글 줄을 만든다. 순수 함수 `wordFallbackText`(두 번째로 분석할 글자)·`pickWordHangul`(최종 상태)을 `annotations.ts` 에 두고, `useWordLayersList` 는 `useAnnotations` 를 한 번 더 불러 그 두 함수로만 정한다. 서버·DB·API·네이티브 변경 없음.

## 변경 파일 (9개 코드·문서 + 기록 — 12 이내, light 유지)

| 파일 | 변경 |
|---|---|
| `src/components/common/japanese/annotations.ts` | `hangulLine` import 추가 · `wordHangulUsable`(비공개) · **`wordFallbackText`** · **`pickWordHangul`** 신설 · `wordHangulState` 는 1단계로 그대로 유지(시그니처 불변) · `useWordLayersList` 에 두 번째 `useAnnotations` + `on` · 머리말·주석 |
| `src/components/common/__tests__/wordHangulFallback.test.ts` | **신규** — 순수 함수 시험 11개(①~⑩ + 저장 읽기 글자) · 훅과 같은 순서의 흐름 시험 4개(요청 수·중간 상태·한글 끔·캐시 공유) · 소스 스캔 2개 |
| `src/components/common/__tests__/japaneseDisplay.test.ts` | 옛 정적 시험(`hangul: wordHangulState(...)`) 1개를 새 배선(`pickWordHangul`·`on`·비대체 분기가 `wordHangulState`)으로 갱신 |
| `src/components/vocab/cardFirst.ts` | `hangulBlock` 주석만(새 규칙) |
| `src/components/vocab/WordRow.tsx` · `WordDetailSheet.tsx` · `eval/EvalItems.tsx` | 주석 한 줄씩만(「저장 읽기와 다르면 숨김」 → 재분석 후 숨김) |
| `src/components/vocab/__tests__/cardFirst.test.ts` | 단언 메시지 문자열만 |
| `docs/screens.md` | 옛 서술 4곳에 `[⚠ task-071 → §29: …]` 표기 + **§29 신설**(상태 규칙 표·부하·소비처) |

`CARD_FIRST.hangul` 문구·[한글] 버튼 동작·후리가나·문장 분석·저장 읽기·시드·DB·`modules/speech/reading/client.ts` 는 건드리지 않았다.

## 설계 결정 (사양과 달라진 점 없음 — 아래는 사양이 열어 둔 곳)

| # | 결정 | 이유 |
|---|---|---|
| D1 | 두 번째로 보내는 글자 = 저장 읽기를 **앞뒤 공백만 걷어** 그대로(가타카나·내부 공백 가공 없음) | Leader 개념 검증이 저장 읽기 그대로였다. 새 변환 규칙을 만들지 않는다(L5). 대조(`readingMatches`)는 가타카나→히라가나·공백 무시라 어느 쪽이어도 같은 읽기로 판정 |
| D2 | `wordHangulState` 는 **유지**하고 `pickWordHangul` 의 비대체 분기가 그것을 부른다 | L5 「기존 외부 약속을 바꾸지 말고 감싼다」. 시험·호출처 시그니처 변경 0 |
| D3 | 훅 메모 의존성에 `fallbacks` 추가 | 두 번째 분석이 도착하면(`ver` 증가 → 새 배열) 층이 갱신돼야 한다 — 소스 스캔으로 고정(변이 M10) |
| D4 | 두 번째 글자 배열은 렌더마다 만든다(메모 안 함) | 단어마다 `readingMatches`+`hangulLine` 한 번 — 기존 `surfaces` 매핑과 같은 비용 수준(수십 개 × µs). 메모를 더하면 의존성 억제 주석이 하나 늘 뿐 이득이 없다 |
| D5 | **첫 분석이 읽기는 맞는데 발음만 없는 경우(저장 읽기 있음)도 대체 대상**(L1 b) — 지금까지는 `ready` 라 빈 줄이 그려지고 덱 [한글]은 막히지 않았다 | 사양대로. 두 번째도 안 되면 `none` 이 되어 덱에서 「이 카드는 한글 표기가 없어요」가 나온다(더 정확해짐). 저장 읽기가 없는 단어는 옛 동작 그대로 |

## 소비처 회귀 확인 (코드로 확인 — 모두 `layers[i].hangul`/`word.hangul` 을 `HangulLine`·`hangulBlock` 에 그대로 넘기며 상태 종류는 새로 늘지 않았다)

| 소비처 | 읽는 방식(줄) | `loading` | `ready`(두 번째 segments) | `none` | 판정 |
|---|---|---|---|---|---|
| 덱 `VocabDeck`+`VocabCardFace` | `layers[view]?.hangul` → 앞면 `faceHangul`(= `deck.showHangul && layer`, 아니면 OFF)·뒷면 `backHangul`(VocabDeck:83-86) → `HangulLine`(CardFace:171·195). `hangulBlock({layer: …?.s})`(VocabDeck:87) | 앞·뒷면 모두 `HangulPlaceholder` 막대(기존과 같은 자리). `hangulBlock` 은 `loading` 이면 null → [한글] 안 막히고 「한글 표기가 없어요」 안 뜸(cardFirst.ts:237 `ready`·`loading` → null) | `HangulLine` 이 `hangulLine(state.segments)` 로 그림 — 두 번째 segments 도 같은 모양(`pickWordHangul` 이 `hangulLine !== null` 을 확인한 것만 통과). 뒷면 줄 높이 측정 키에 `backHangul.s` 가 들어 있어(CardFace:129) `loading → ready/none` 때 다시 잰다 — 기존 전이와 같음 | `HangulLine` null, `hangulBlock` → 「이 카드는 한글 표기가 없어요」 | OK |
| 결과 목록 `WordResultList` `Row` | `layers[i]?.hangul ?? OFF` → `<HangulLine as="span" size=12.5>`(:49,:122). `JaText` 는 `ruby` prop 이 `null`(≠ undefined)이라 `state` 로 루비를 만들지 않는다 | 막대 | 줄 | null | OK |
| 단어장 `WordsScreen` → `WordRow`(memo) | `useWordLayersList(list.items)`(:383) → `hangul={layers[i]?.hangul ?? OFF}`(:206) → `HangulLine as="span" size=12.5`(WordRow:56). 쪽 채움 `FillerRow` 는 `LOADING` 높이를 미리 잡는다(:101) | 막대(필러와 같은 높이 계열) | 줄 — `pickWordHangul` 이 `loading → ready` 로 상태 객체가 바뀌므로 memo 행이 다시 그려진다 | null | OK |
| 단어 상세 `WordDetailSheet` | `useWordLayers(word?.surface ?? '', word?.reading)`(:184) → `head.hangul` → `HangulLine size=14`(:396). 표제어 `JaText ruby={head.ruby}` 는 항상 정의된 값(null 가능)이라 `state` 로 루비를 만들지 않는다 | 막대 | 줄 | null | OK (단건 훅도 `useWordLayersList([..])[0]` 라 두 번째 호출 개수 고정) |
| 단어 제안 카드 `ProposalCard` | `useWordLayers(wordOpen ? surface : '', …)`(:58) → `HangulLine state={word.hangul}`(:138). 닫힌 제안은 `''` → 첫 분석이 `none`(공백) → 두 번째 글자 `''` → **요청 0** | 막대 | 줄 | null | OK |
| 평가 단어 상자 `EvalItems` `WordBox` | `useWordLayers(word, reading)`(:104) → `hits.length ? null : <HangulLine state={layers.hangul} size=14>`(:110). 정답 보호(`hits`)가 먼저라 새 정보가 보호 자리로 새지 않는다 | 막대 | 줄 | null | OK |
| 챌린지 만들기 `createParts` `ChunkPreview` | `useWordLayersList(shown.map(…))`(:47) → `HangulLine state={layers[i]?.hangul ?? OFF} size=12 as="span"`(:55) | 막대 | 줄 | null | OK |

공통: (1) 새 상태 종류 없음(`off·loading·ready·none` 그대로). (2) `loading` 이 길어지는 곳은 어긋난 단어(≈3.7%)뿐이고 그때도 기존 `loading` 자리(막대)를 그대로 쓴다. (3) 첫 분석이 도착한 렌더에서 두 번째는 아직 캐시에 없어 `stateOf` 가 `loading` → 어긋난 단어가 `none` 으로 번쩍이지 않는다(흐름 시험 「중간 상태」로 고정). (4) 저장 읽기가 이미 캐시에 있으면(다른 화면·같은 글자) 추가 요청 없이 곧바로 `ready`.

## 증빙 (미러 `~/.node-local/thekaiwa-dev071` — `thekaiwa-dev070` 하드링크 복제, `UserWordState` 724회 확인, 저장소 `src/`·`tests/`·`package.json` rsync)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 |
| `./node_modules/.bin/eslint src/components/common src/components/vocab` (+ `eval chat challenge`) | exit 0 / exit 0 |
| 새 시험 `src/components/common/__tests__/wordHangulFallback.test.ts` | 17 통과 · 0 실패 |
| 관련 묶음 `common + vocab + lesson 전 시험 + modules/conversation/__tests__/topicWords.test.ts` | 547 통과 · 0 실패 |
| 전체 시험 `find src scripts/seed-build -name '*.test.ts'` (`--test-concurrency=1`) | **4,125 중 4,123 통과 · 0 실패 · 2 건너뜀(기존)** |
| `./node_modules/.bin/next build > /tmp/claude-1000/dev071-build.log 2>&1` | **exit 0** (`✓ Compiled successfully`; 기존 `claudeCli.ts:898` 동적 파일 접근 경고만) |
| 엔진명 누출 grep(`reazon\|whisper\|style-bert`) 변경 소스 | 0건 |

## 변이 점검 (미러의 `annotations.ts` 한 곳만 깨고 새 시험 + `japaneseDisplay.test.ts` + `cardFace.test.ts` 실행 → 복구; 스크립트 스크래치패드 `mutate.py`)

| # | 변이 | 결과(실패한 시험 수 · 대표) |
|---|---|---|
| M1 | `wordHangulUsable` 의 저장 읽기 대조 제거(어긋난 두 번째도 채택) | **KILLED** 8 · ②③⑤ |
| M2 | `wordHangulUsable` 의 `hangulLine` 확인 제거(七=しち 형 채택) | **KILLED** 5 · ⑤⑦ + 흐름 |
| M3 | 두 번째 대기 중 `LOADING` 대신 `NONE`(번쩍임) | **KILLED** 4 · ② + 중간 상태 |
| M4 | 두 번째가 `ready` 면 검사 없이 채택 | **KILLED** 5 · ④⑤ |
| M5 | 정상 단어도 두 번째 요청(첫 분석 정상 검사 제거) | **KILLED** 3 · ① + 흐름(요청 수) |
| M6 | 한글 끔인데 두 번째 요청(`!on` 제거) | **KILLED** 1 · ⑨ |
| M7 | 첫 분석이 loading/none 이어도 두 번째 요청(`ready` 확인 제거) | **KILLED** 4 · ⑩ + 흐름 |
| M8 | 비대체 분기가 `wordHangulState` 대신 `first` 반환 | **KILLED** 3 · ⑨ + 정적 시험 |
| M9 | 두 번째가 안 되면 첫 분석(어긋난 발음)을 그대로 반환 | **KILLED** 7 · ④⑤⑥⑦ |
| M10 | 훅 메모 의존성에서 `fallbacks` 제거(두 번째 도착 후 갱신 안 됨) | **KILLED** 1 · 배선 스캔 |
| M11 | 저장 읽기 공백 처리 제거(공백뿐도 요청) | **KILLED** 2 · ⑧ |
| M12 | 첫 분석 발음 없음(noPron)을 대체 대상에서 제외 | **KILLED** 2 · ⑦ + 흐름 |
| M13 | 훅이 1단계 `wordHangulState` 만 호출(2단계 배선 제거) | **KILLED** 2 · 정적·배선 스캔 |
| M14 | 훅의 `on` 에서 `prefs.loaded` 제거 | **KILLED** 2 · 정적·배선 스캔 |
| M15 | 훅의 두 번째 `useAnnotations` 가 저장 읽기 전부 요청(어긋남 검사 우회) | **KILLED** 1 · 배선 스캔 |
| M16 | 저장 읽기 앞뒤 공백 그대로 전송(`trim` 제거) | **KILLED** 2 · ⑧ + 글자 시험 |
| M17 | 첫 분석이 loading 인데 두 번째 상태를 따름 | **KILLED** 1 · ⑩ |

17개 모두 시험이 실패했다(생존 0). 변이를 거친 뒤 미러를 저장소 파일로 복구(`diff` 동일)했고 `thekaiwa-dev070` 에는 `pickWordHangul` 이 0건임을 확인(하드링크 오염 없음).

## 알려진 한계
1. **실제 분석기 출력은 이 세션에서 확인하지 못했다**(운영 포트 접촉 금지). 시료 segments 는 Leader 개념 검증 사례(温い→누루이·丈夫→죠-부·七)의 모양을 합성한 것이다. 288/289 구제는 Leader 의 실측을 근거로 한다 — 사용자 폰에서 N5 21개 카드 확인이 최종 확인.
2. **훅 렌더 자체는 시험하지 못한다**(React 테스트 라이브러리 없음). 대신 훅과 같은 순서(첫 분석 상태 → 두 번째 글자 → 두 번째 상태 → 결정 → 요청)의 흐름을 `AnnotationClient` 위에서 흉내 내 요청 수·중간 상태를 고정하고, 훅 배선(호출 개수 2·`pickWordHangul` 로만 결정·메모 의존성)은 소스 스캔으로 고정했다.
3. 어긋난 단어는 첫 분석 → 두 번째 분석 **두 번의 왕복** 뒤에 한글이 나온다(그 사이 막대). 덱은 10장을 한 번에 받고 어긋난 카드는 평균 0.4장이라 체감은 작을 것이다.
4. 七(しち) 1개와 저장 읽기 자체가 의심스러운 단어(私=わたくし 등)는 이번 범위 밖(L9) — 七 은 계속 숨는다.
5. 저장 읽기 안의 내부 공백은 가공 없이 분석기에 보낸다(D1). 기본 단어에는 거의 없을 것으로 보이나 [추측].
6. 저장 읽기가 있는 단어에서 「읽기는 맞고 발음만 없던」 경우는 이전에 빈 줄(`ready`)이었는데 이제 두 번째 시도 → 안 되면 `none`(덱: 「한글 표기가 없어요」) — 동작이 바뀌는 유일한 비의도적 가장자리(D5, 사양 L1 b).

## reviewer 가 볼 곳
- `annotations.ts` 의 `wordHangulUsable`·`wordFallbackText`·`pickWordHangul`·`useWordLayersList` — 두 번째 결과가 `readingMatches` + `hangulLine` 을 **모두** 통과해야 보이는지(어긋난 발음 경로 없음), 비대체 분기가 옛 `wordHangulState` 와 같은지.
- 새 시험 파일의 흐름 시험(요청 수 5+4, 중간 상태 `['ready','loading','loading']`)과 소스 스캔 정규식이 공백·주석·줄 번호에 둔감한지.
- 재실행: 미러에서 `tsc`·`eslint`·`node --import tsx --test --test-concurrency=1 src/components/common/__tests__/wordHangulFallback.test.ts src/components/common/__tests__/japaneseDisplay.test.ts src/components/vocab/__tests__/cardFace.test.ts`·`next build`. 변이는 스크래치패드 `mutate.py`(미러 파일을 깼다가 저장소에서 복구).
- `docs/screens.md` §29 와 옛 서술 4곳의 `[⚠ task-071 → §29]` 표기.
- 사용자 폰 확인(Leader 몫): 오늘의 단어 N5 21개 카드에서 温い 등 한글 줄이 보이는지 · 정상 카드 한글 줄은 그대로인지 · 느려 보이지 않는지.
