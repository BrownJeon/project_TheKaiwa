---
task_id: task-071
title: "task-071 Reviewer 기록 — 한글 표기가 숨겨지는 단어에 저장된 읽기로 한글 줄 보이기 (REV-071) — 최종"
role: reviewer
track: light
verdict: PASS_WITH_NOTES
created: 2026-10-15
tags:
  - type/rev-record
  - domain/vocab
aliases:
  - task-071 rev-record
  - REV-071
---

# task-071 Reviewer 기록 (REV-071) — 최종

이력서: [[task-071-improve-hangul-stored-reading]] · developer 기록: [[task-071-dev-record]] · 백로그: [[IMP-0045-hangul-fallback-stored-reading]]

## 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 3)

- 사용자 결정 「a로 진행해줘」(불일치/발음 없음이면 저장 읽기를 같은 분석기에 한 번 더 넣어 그 결과로 한글 줄)가 순수 함수 2개 + 훅 배선 1곳으로 사양 L1~L9 와 일치하게 들어갔고, **어긋난 발음이 `ready` 로 화면에 나가는 경로는 없다**(항목 7).
- light 트랙이라 QA 가 없다 — 이 재실행이 유일한 독립 확인이다. developer 보고와 **모든 수치가 일치**(tsc 0 · eslint 0 · 전체 4,125 중 4,123 통과·0 실패·2 건너뜀 · `next build` 0), 내가 직접 낸 변이 12개도 **전부 시험이 잡았다(생존 0)**.
- light 승격 필요: **없음**(변경 파일 9개 ≤ 12 · 신규 화면 0 · 마이그레이션 0 · 네이티브 0 · 인증/권한/Secret 0 · 서버·API·DB 0). Sonnet developer 반려 횟수 0 → Opus 승격 권고 없음.
- 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(status not_required, judge none), `evidence.jsonl` 에 task-071 줄 없음(에이전트가 approve/waive 를 대신 실행한 흔적 없음).

## 증빙 재실행 (미러 `~/.node-local/thekaiwa-rev071` — `thekaiwa-dev071` 하드링크 복제 후 `.next`·`tsconfig.tsbuildinfo` 제거, `src`·`tests`·`package.json` rsync; `diff -rq 저장소/src 미러/src` 0 · `diff -rq tests` 0 · `UserWordState` 724 · `.env` 없음, 가짜 `DATABASE_URL` 만)

| 항목 | 명령 | 결과 | developer 보고와 대조 |
|---|---|---|---|
| 타입 | `./node_modules/.bin/tsc --noEmit` | **exit 0** | 일치 |
| 린트 | `eslint src/components/{common,vocab,eval,chat,challenge}` | **exit 0** | 일치 |
| 새 시험 | `node --import tsx --test --test-concurrency=1 src/components/common/__tests__/wordHangulFallback.test.ts` | **tests 17 · pass 17 · fail 0 · skipped 0** | 일치(17) |
| common+vocab 시험 | 두 폴더의 `*.test.ts` 전부 | **tests 353 · pass 353 · fail 0** | (developer 의 547 은 lesson·topicWords 포함 묶음 — 이 묶음은 별도로 한 범위, 전체 시험에 포함됨) |
| 전체 시험 | `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)` | **tests 4125 · pass 4123 · fail 0 · skipped 2** | **일치**(4,125/4,123/0/2) |
| 빌드 | `./node_modules/.bin/next build > /tmp/claude-1000/rev071-build.log 2>&1; echo $?` | **exit 0** (`✓ Compiled successfully in 6.2s`, 기존 `claudeCli.ts` 동적 접근 경고만) | 일치 |
| 사후 | 변이 후 `diff` 미러 ↔ 저장소 `annotations.ts` 동일 · `thekaiwa-dev070` 의 `pickWordHangul` 0건·`dev071` 5건(원본 그대로) | 하드링크 오염 없음 | — |

## 체크리스트 1~10

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 순수 함수 정확성(L1~L4) | **PASS** | 아래 상태표. `annotations.ts:404-419` |
| 2 | 가장자리: 읽기 일치·`hangulLine` null | **수용** | 아래 가장자리 판정 |
| 3 | 훅 배선·React 규칙 | **PASS** | `annotations.ts:438-452` — `useAnnotations` 렌더마다 정확히 2번(조건·반복 없음, `const fallbacks = useAnnotations(words.map(...))` 무조건 호출). 두 번째 입력은 `wordFallbackText(on, states[i], w.reading)` → 불일치로 판정된 단어만 저장 읽기, 나머지 `''`. `texts`/`states`/`fallbacks` 배열이 모두 `words.map` 순서라 인덱스 `i` 대응(`useAnnotations` 는 `texts.map` 로 같은 길이를 돌려줌). 외부 `useMemo` deps 에 `states, fallbacks` 포함 → 두 번째 도착 시 갱신. 첫 분석이 `ready` 가 된 렌더에서 두 번째 글자는 캐시에 없어 `stateOf` → `LOADING`(요청 전 상태), 효과가 요청 → 도착 후 `ready`/`none`: 흐름 시험(`['ready','loading','loading']` → `['ready','ready','none']`) 이 고정 |
| 4 | 요청 부하·루프 | **PASS** | 추가 요청은 `wordFallbackText` 가 비지 않은 단어(어긋남·발음 없음, 저장 읽기 있음)만. `AnnotationClient.request` 의 캐시·진행 중·실패 재시도 상한(35s·2회)이 그대로 걸림(두 번째 호출도 같은 클라이언트). `useAnnotations` 효과 deps `[want, ver, wake]`, `want` 는 `key` 문자열 메모 → 같은 입력이면 새 `request` 없음·`emit` 없음 → 루프 없음(흐름 시험 「안정 상태에서 다시 그려도 새 요청 없음」). 새 타이머·폴링·fetch 없음(`git diff` 의 추가 줄에 `setTimeout\|setInterval\|fetch\|apiPost` 0). 표제어와 저장 읽기 글자가 같은 단어(히라가나 표제어)는 같은 캐시 칸 → 추가 요청 0 |
| 5 | 소비처 7곳 | **PASS** | 아래 표(직접 읽음). `WordRow`·`WordDetailSheet`·`EvalItems`·`cardFirst.ts`·`cardFirst.test.ts`·`japaneseDisplay.test.ts` diff 는 `git diff -U0` 로 **주석·문구·정적 시험 1개 갱신뿐**(코드 줄 변경 없음 확인) |
| 6 | 불변 | **PASS** | 후리가나(`alignWordRuby`)·`off`·`available:false`·문장 분석 소비처(`useAnnotations(문장)` 호출처, `src/modules` diff 0)·`CARD_FIRST.hangul`(라벨 파일 diff 0)·[한글] 버튼·저장 읽기/DB/시드(prisma·seed diff 0)·새 API 0·`speech/reading/client.ts` diff 0(서버 import 규칙 유지). `wordHangulState` 시그니처·동작 불변(호출처는 `pickWordHangul` 내부 한 곳) |
| 7 | 보호 규칙 취지 | **PASS** | `pickWordHangul` 이 `ready` 를 돌려주는 경로는 둘뿐: (a) 비대체 분기 `wordHangulState` — `ready` 는 `readingMatches` 참(또는 저장 읽기 없음 L3)일 때만 통과하고, 저장 읽기가 있으면서 `readingMatches` 거짓이면 `wordFallbackText` 가 비지 않아 이 분기에 오지 않는다. (b) 대체 분기 — `second.s === 'ready' && wordHangulUsable(second.segments, stored)`(= `readingMatches` ∧ `hangulLine !== null`). 변이 R4(읽기 대조 제거)·R9(두 번째 대신 첫 분석 반환)을 시험이 잡는다 |
| 8 | 문서 | **PASS** | `grep -nE "어긋난 발음\|readingMatches\|저장 읽기와 어긋\|한글 표기가 없어요" docs/screens.md` → 7872·8100·10600·13379·13393·13394. 7872·8100·10600(+8048 「저장 읽기 ≠ 분석 읽기면 한글 숨김」)은 모두 `[⚠ task-071 → §29: …]` 표기가 있고, 13379~13394 는 신설 §29 본문. 표기 없이 남은 거짓 서술 **0**. §29-2 상태표가 코드 상태표와 일치(7행) |
| 9 | 6층 경계·범위 | **PASS** | 컴포넌트가 `@/modules/speech/reading/client` 만 import(기존 경로, `hangulLine` 추가). 변경 파일 9개(코드·시험·문서). `grep -rniE "reazon\|sherpa\|whisper\|style-bert" src/components/common src/components/vocab` → 시험의 **부정 단언**(누출 금지 검사) 외 0건. 마이그레이션·네이티브·인증·신규 화면 없음 |
| 10 | 시험 품질 | **PASS(주의 1)** | 아래 변이 표 12/12 killed. 주의: 훅 렌더 자체는 시험이 없고 소스 스캔(문자열 고정)+흐름 시뮬레이션으로 대신한다(REV071-1) |

### 순수 함수 상태표 (`pickWordHangul(on, first, stored, second)` — 코드에서 직접 도출)

기호: 일치 M = `readingMatches(seg, stored)`, 발음 P = `hangulLine(seg) !== null`, 쓸 수 있음 U = M ∧ P, 글자 T = `wordFallbackText` 결과.

| on | first | stored | second | T(두 번째 요청 글자) | 출력 |
|---|---|---|---|---|---|
| false | 무엇이든 | 무엇이든 | 무엇이든 | `''` | `OFF` |
| true | `off`·`loading`·`none` | 무엇이든 | 무엇이든 | `''` | first 그대로 |
| true | `ready` | null·`''`·공백 | 무엇이든 | `''` | first 그대로(M 은 참으로 본다, P 무관 — 옛 동작과 같음) |
| true | `ready`, U 참 | 있음 | 무엇이든 | `''`(**요청 0**) | first(`ready`) |
| true | `ready`, U 거짓(M 거짓 또는 P 거짓) | 있음 | `loading` | `stored.trim()` | `LOADING` |
| true | 〃 | 〃 | `ready`, U(second) 참 | 〃 | `second`(`ready`) |
| true | 〃 | 〃 | `ready`, M 거짓 또는 P 거짓 | 〃 | `NONE` |
| true | 〃 | 〃 | `none`·`off` | 〃 | `NONE` |

→ `ready` 로 나가는 segments 는 항상 (M 참, 저장 읽기 없음, 또는 U(second) 참). **어긋난 발음 경로 없음.**

### 소비처 직접 확인 (사실: 모두 `layers[i].hangul`/`word.hangul` 을 `HangulLine` 에 그대로 넘기고, 상태 종류는 `off·loading·ready·none` 그대로)

| 소비처 | 읽는 줄 | 확인 |
|---|---|---|
| 덱 `VocabDeck`+`VocabCardFace` | `VocabDeck.tsx:78,83-87` `layers[view]?.hangul` → 앞면 `faceHangul`·뒷면 `backHangul`, `hangulBlock({layer: …?.s})` | `loading` → `HangulPlaceholder` 자리 막대(`JapaneseText.tsx:138`), `hangulBlock` 은 `ready`·`loading` 이면 null(`cardFirst.ts:237`) → 「한글 표기가 없어요」 안 번쩍임. 뒷면 높이 측정 키에 `backHangul.s` 포함(`VocabCardFace.tsx:129`) → `loading→ready/none` 때 다시 잼. `JaText ruby={ruby}`/`{showReading ? ruby : null}` 는 항상 정의된 값(null 포함) → `state` 로 루비를 만들지 않으므로 **두 번째 segments(표기=저장 읽기) 가 루비에 새지 않음**(`JapaneseText.tsx:70`) |
| 결과 목록 `WordResultList` | `:110,122` `layers[i]?.hangul ?? OFF` → `HangulLine as=span`(:49), `JaText ruby={ruby}` | OK |
| 단어장 `WordsScreen`→`WordRow` | `:383,206` → `WordRow.tsx:51,56` (`JaText ruby={ruby}`), 쪽 채움 `FillerRow` 는 `LOADING` 높이(:101) | OK |
| 단어 상세 `WordDetailSheet` | `:184` `useWordLayers`(→ `useWordLayersList([..])[0]`, 훅 개수 고정) → `JaText ruby={head.ruby}` + `HangulLine state={head.hangul}`(:390-396) | OK |
| 제안 카드 `ProposalCard` | `:58,137-138` — 닫힌 제안은 표제어 `''` → 첫 분석 `none` → T `''` → **요청 0** | OK |
| 평가 `EvalItems` `WordBox` | `:104,109-110` `JaText state={OFF}` + `hits.length ? null : HangulLine` — 정답 보호가 상태와 무관하게 먼저 | OK(보호 자리로 새 정보가 새지 않음) |
| 챌린지 `createParts` | `:47,54-55` `JaText state={OFF} ruby=…` + `HangulLine` | OK |

## 가장자리 판정 (항목 2) — **수용**

- 옛 동작(`git show HEAD:…/annotations.ts` + 소비처 직접 확인): 저장 읽기가 있고 **읽기는 일치하는데 `hangulLine` 이 null** 이면 `wordHangulState` 는 `ready` 를 그대로 돌려줬다(옛 코드는 `annotations.ts` 에서 `hangulLine` 을 아예 부르지 않았다). 그러면 `HangulLine` 은 `state.s === 'ready'` 이고 `hangulLine(segments)` 가 null → **아무것도 그리지 않음**(`JapaneseText.tsx:140-141`), 덱 `hangulBlock` 은 `ready` 라 null → [한글] 버튼이 눌리지만 보이는 것이 없음. 이력서 「사실」 절의 「`hangulLine` null 이면 앞단에서 none」은 옛 코드와 다르다(앞단 처리 없음) — 사양 L1 (b) 는 새로 만든 규칙으로 읽어야 하며, 구현은 그 L1 (b) 와 일치한다.
- 새 동작: 두 번째 분석을 시도 → U 면 한글 줄이 **생김**(개선), 아니면 `NONE`. 렌더는 목록 행·상세·제안·평가·챌린지에서 옛 `ready`+null 과 새 `none` 모두 `HangulLine` → null 이라 **화면 차이 없음**. 달라지는 곳은 덱뿐: [한글]이 「이 카드는 한글 표기가 없어요」로 정직하게 막힌다(옛: 눌러도 빈 줄). 새로운 화면 문제(빈 줄→문구)는 없고 문구는 이미 `CARD_FIRST.hangul.none` 의 같은 의미다. `loading` 막대는 첫 분석 대기 때부터 이미 보이던 것이 이어질 뿐이라 막대가 새로 생기거나 사라지는 레이아웃 흔들림이 늘지 않는다(첫 `loading` → 두 번째 `LOADING` 은 같은 상수 객체).
- 규모: 개념 검증 파일(`hangul-fallback-out.json`, 읽기 전용 참고)에서 noPron 은 3/289. 극소수라 수용.

## 변이 점검 (직접 재현 12개 — 미러에서만, `os.replace` 로 새 inode 교체 후 깨고 원복·`diff` 0 확인, 스크립트 `rev071-mutate.py`, 시험: 새 시험 + `japaneseDisplay` + `cardFace` + `cardFirst` 137개)

| # | 영역 | 변이 | 결과 (실패 수 · 대표) |
|---|---|---|---|
| R1 | 요청 0 규칙 | 정상 단어도 두 번째 요청 글자 반환 | **KILLED** 3 · ① + 흐름 2 |
| R2 | 첫 상태 가드 | 첫 분석이 loading/none 이어도 두 번째 요청 | **KILLED** 3 · ⑩ + 흐름 2 |
| R3 | 상태 전이 | 두 번째 대기 중 `loading` 대신 `none` | **KILLED** 4 · ② ⑦ + 중간 상태 |
| R4 | **보호 규칙** | 두 번째가 저장 읽기와 어긋나도 `ready`(읽기 대조 제거) | **KILLED** 2 · ④ + 본문 스캔 |
| R5 | 발음 확인 | 두 번째 `hangulLine` null 인데 `ready`(七=しち 형) | **KILLED** 4 · ⑤ + 흐름 2 |
| R6 | 저장 읽기 없음 | 저장 읽기 없을 때 표제어 글자로 재요청 | **KILLED** 1 · ⑧ |
| R7 | **배선** | 훅에서 두 번째 `useAnnotations` 호출 제거 | **KILLED** 1 · 배선 스캔 |
| R8 | **배선** | 훅 두 번째 상태 인덱스 어긋남(`fallbacks[i+1]`) | **KILLED** 2 · 정적 + 배선 스캔 |
| R9 | 선택 결과 | 두 번째 일치해도 첫 분석(어긋난 발음) 반환 | **KILLED** 5 · ③ ⑦ + 글자 시험 |
| R10 | D5 가장자리 | 읽기 일치·발음 없음(첫 분석)을 정상으로 취급 | **KILLED** 2 · ⑦ + 흐름 |
| R11 | **React 규칙** | 두 번째 `useAnnotations` 를 `on ?` 조건부 호출 | **KILLED** 1 · 배선 스캔 |
| R12 | 한글 끔 | 한글 끔인데 두 번째 요청 허용(`!on` 제거) | **KILLED** 1 · ⑨ |

**생존 변이: 없음.** 한계: 배선(R7·R8·R11)은 **소스 스캔 1~2개 시험만이 잡는다** — 문자열을 고정한 시험이라 통과/실패 의미는 있으나 훅의 실제 렌더 동작은 아니다(React 테스트 라이브러리가 없는 이 저장소의 기존 한계, task-069·070 과 같은 방식). 흐름 시뮬레이션(`makeFlow`)이 훅과 같은 순서의 요청 수·중간 상태를 고정해 이를 보완한다.

## 결함·관찰 목록

| ID | 등급 | 위치 | 내용 | 권장 |
|---|---|---|---|---|
| REV071-1 | Low | `wordHangulFallback.test.ts:257-279` | 훅 배선 시험이 정규식으로 소스 문자열을 고정한다 — 훅의 렌더 동작은 실행해 보지 못한다(변이 R7·R8·R11 은 이 스캔 1~2개만 잡음). 훅 코드를 리팩터링하면 시험 문자열도 같이 갱신해야 한다 | 조치 불필요. 이후 React 렌더 시험 도구가 들어오면 훅 렌더 시험으로 교체 |
| REV071-2 | Low | `annotations.ts:443` | 두 번째 `useAnnotations` 입력 배열(`words.map(wordFallbackText)`)을 렌더마다 만들어 단어마다 `readingMatches`+`hangulLine` 을 다시 계산한다(`pickWordHangul` 에서 한 번 더). 미러 실측 500단어·렌더당 약 2.5ms(실사용 20~50개면 <0.3ms) | 조치 불필요(D4 수용). 목록이 수백 개로 늘면 `useMemo(…, [states, key])` 로 감쌀 것 |
| REV071-3 | Low | 설계 관찰 | 읽기 **일치**만 대조하고 **발음(pron) 자체**는 저장 읽기와 대조하지 않는다 — 분석기가 히라가나 글자 `ぬるい` 를 읽은 발음이 틀릴 수 있다(예: 단어 안의 는 は·へ·を 를 조사 발음으로 읽을 가능성 [추측]). 사양 L2 가 정한 「같은 분석기·읽기 일치」의 범위이고 Leader 개념 검증 파일에서 は/へ/を 를 포함한 저장 읽기 8개(はく·はじく·はす·はた·はかり·はたち·はれる·へん) 중 조사 발음으로 읽힌 것은 **0**(하꾸·하지꾸·하스·하따·하까리·하따찌·하레루·헹). 저장 읽기 자체가 틀린 단어(私=わたくし 등)는 L9 로 범위 밖이며 이제 숨김 대신 저장 읽기 기준 한글이 보인다 | 조치 불필요. 사용자 폰(N5 21개 카드)에서 이상한 표기가 보이면 저장 읽기 검수 후속 IMP(후보 C)로 |

(참고 Info, 조치 없음: `lesson/__tests__/display.test.ts:59` 제목 「…한글을 숨긴다」는 `readingMatches` 단독 의미라 여전히 참. 이력서 「사실」절의 「`hangulLine` null 이면 앞단에서 `none`」은 옛 코드와 달라 위 가장자리 판정에 정정 기록.)

## 사용자 폰 확인(Leader 몫) 권장 항목

1. 오늘의 단어 N5 21개 카드에서 温い 등 한글 줄이 누루이로 보이는지 · 정상 카드 한글 줄은 그대로인지.
2. 어긋난 카드에서 한글 자리 막대가 잠깐 보였다 줄로 바뀌는지(「한글 표기가 없어요」가 번쩍이지 않는지) · 七 만 남는지.
3. 단어장 목록·상세에서 숨겨졌던 단어의 한글이 생겼는지 · 느려 보이지 않는지.

## high_risk_areas / native_change
- high_risk_areas: 없음(QA 단계 없음 — light). 폰 확인은 위 3개.
- native_change: **false**. versionCode 변화 없음. 웹 배포만(`migrated false` 대상).
