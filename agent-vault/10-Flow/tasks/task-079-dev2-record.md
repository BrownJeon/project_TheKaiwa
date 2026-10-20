---
task_id: task-079
role: developer
tags:
  - type/task-record
  - domain/learning
  - domain/prompt
aliases:
  - task-079 developer 2차 기록
updated: 2026-10-20
---
# task-079 developer 2차 — v4 적용 + 같은 뜻 반복 접기 + 감사 보강 (dev079b 미러)

상위 이력서: [[task-079-improve-topic-words-quality]] · 앞 기록: [[task-079-dev-record]] · 감사: [[task-079-reviewer-record]] · PE: [[task-079-pe-record]]
LLM 라이브 호출 0회 · 화면·Prisma·API 계약·네이티브 변경 없음 · 커밋·푸시·배포·DB 쓰기 없음. 데모 게이트 `DEMO_GATE_PASSED`(not_required).

## 한 줄 요약
(1) PE 의 `v4-diff.patch` 를 1차 구현 위에 적용 — `meaningKo` 지시 줄이 PE 측정 미러와 **바이트 동일**. (2) `assembleTopicWords` 가 `meaningKo` 를 읽는 줄에서 같은 뜻 반복을 접는다(`업무, 업무`→`업무`). (3) 감사 F-1(목록 내용 방어선)·F-2·F-3(주석 사실 오류) 처리. **전체 시험 4,562 중 통과 4,559·실패 0·건너뜀 3 · tsc 0 · 변경 파일 eslint 0 · 변이 8종 전부 포착.**

## 변경 파일 (이번 소환분)
| 파일 | 변경 |
|---|---|
| `src/modules/conversation/prompts/topicWords.ts` | ① PE v4 패치(`meaningKo` 지시 1줄·`TOPIC_WORDS_PROMPT_VERSION` → `topicWords@v4`·버전 주석) ② `foldRepeatedMeanings` 신설·export ③ `assembleTopicWords` 의 `const meaningKo = foldRepeatedMeanings(o.meaningKo.trim())` 한 줄 + JSDoc 한 문장 |
| `src/modules/conversation/__tests__/topicWords.test.ts` | PE v4 패치 그대로(`V4_SYSTEM_GROWTH`·버전·길이 시험·v4 문구 고정 시험 1건). 이 파일은 PE 미러의 것과 `diff` 결과 **동일** |
| `src/modules/conversation/structuredResponse/chineseOnlyHanzi.ts` | **주석만**(F-2·F-3·F-5) — 코드·목록 불변(해시 아래 확인) |
| `src/modules/conversation/__tests__/topicWordsQuality079.test.ts` | F-1 시험 1개 추가(+ `createHash` import 한 줄) |
| `src/modules/conversation/__tests__/topicWordsMeaningFold079.test.ts` | **새 파일** — 접기 시험 9개 |

건드리지 않은 것: `topicSet.ts`·`schemas.ts`(재내보내기 3줄 포함, F-4 는 이번엔 손대지 않음)·`normalizeMeaning`·`MEANING_CHARS` 검사·`exampleNulled` 계측·반환 모양.

## 1. v4 적용 — 바이트 동일 확인
- `git apply --check` 통과(충돌 0) → `git apply`. 패치는 HEAD(725007c) 기준이고 작업트리에는 1차 구현이 미커밋으로 있었지만 겹치는 줄이 없어 그대로 들어갔다.
- **지시 줄 비교**: NFS `topicWords.ts` 의 `  '- meaningKo: …` 줄과 PE 측정 미러(`~/.node-local/thekaiwa-pe079/…/topicWords.ts`)의 같은 줄을 `diff` → 차이 없음, sha256 앞 16자 `12280867bf191889` 두 쪽 동일(줄 길이 473바이트). 
- **파일 전체 비교**: PE 미러 `topicWords.ts` ↔ NFS `topicWords.ts` 에서 PE 쪽에만 있는 줄(`<`)은 정확히 3개 — 1차 구현이 바꾼 import 줄, 이번 접기가 바꾼 `const meaningKo` 줄, 1차 구현이 바꾼 `words.push` 줄. SYSTEM_PROMPT 어느 줄도 달라지지 않았다(즉 PE 가 측정한 system 문구 = 지금 코드의 system 문구). `TOPIC_WORDS_PROMPT_VERSION` 값 두 쪽 `'topicWords@v4'`. `topicWords.test.ts` 는 두 쪽 `diff` 출력 없음(동일).

## 2. 같은 뜻 반복 접기

### 규칙 (`foldRepeatedMeanings`)
쉼표 `,` 로 나눈 토큰을 앞에서부터 보며, 앞뒤 공백을 뗀 문자열이 **앞에서 이미 나온 토큰과 같으면** 버린다. 
- 떨어진 반복도 접는다: `정식, 식사, 정식` → `정식, 식사` (사용자 결정 «앞 토큰과 같으면»을 «앞의 어느 토큰이든»으로 읽었다 — 인접만 접으면 `정식, 식사, 정식` 이 남는다).
- 첫 뜻·남는 토큰의 글자와 순서는 그대로, 남는 토큰의 구분 공백도 원문 그대로(`정식,  식사,식사` → `정식,  식사`). **접을 것이 없으면 입력 문자열을 그대로 돌려준다**(`정식,한 끼 식사` 도 바이트 불변 — 쉼표 뒤 공백을 맞추려고 다시 잇지 않는다).
- 한 글자라도 다르면 다른 뜻(`보고, 보고서`·`업무, 업모`·`보고하다, 보고`). 대소문자·전각 같은 정규화로만 같은 것(`Menu, menu`)도 접지 않는다 — 그건 ⑦ 키(`normalizeMeaning`)의 몫이다. 빈 토큰(`a,,b`)은 비교하지 않고 만지지 않는다.
- 쉼표가 전각(`，`)이거나 `、`·`/` 로 나뉜 반복은 접지 않는다(사용자 결정이 «쉼표(,)» 였고, 프롬프트도 «쉼표로 구분» 이라 모델이 그대로 낸다 — PE 측정에서 다른 구분자는 보이지 않았다. `[추측]` 표본 200단어 기준).

### 위치 판단 — «접기 → ④ → ⑦» 순서가 자연스럽다
`const meaningKo = foldRepeatedMeanings(o.meaningKo.trim())` — **`meaningKo` 를 읽는 바로 그 줄**이다. 뒤의 검사·키·출력이 모두 같은 변수를 쓰므로 «접은 결과를 같은 자리에서 쓴다».
1. **④ MEANING_CHARS (길이 ≤ 80·한글 있음·가나 없음)**: 접기는 토큰을 지우기만 하므로 한글·가나 판정은 바뀌지 않는다(남는 첫 토큰이 지워진 토큰과 같은 문자열이라). 바뀌는 것은 길이 한 가지뿐인데, 스키마(`TOPIC_WORDS_SCHEMA.meaningKo.maxLength: 80`)가 이미 80자 초과를 앞단에서 걸러 실제 경로에서는 영향이 없다. 시험이 걸리는 경우를 확인한다(가나·한글 없는 반복은 접어도 `MEANING_CHARS`).
2. **⑦ DUP_MEANING (`normalizeMeaning` 키)**: 이쪽이 접기를 **앞에 둬야 하는 진짜 이유**다. `normalizeMeaning` 은 쉼표·공백을 지워 이어 붙이므로 `업무, 업무` 의 키는 `업무업무` 라서, 기본 표현의 뜻 `업무`·앞 항목의 `업무` 와 **같은 뜻인데도 중복으로 안 잡혔다**. 접은 뒤 키를 쓰면 `업무`로 정확히 잡힌다(시험이 접기 전 키로는 새던 사례를 DUP_MEANING 으로 확인). `normalizeMeaning` 자체는 한 글자도 바꾸지 않았다.
3. **ENGINE_NAME 검사** 는 `[textJa, reading, meaningKo]` 에 접힌 문자열을 본다. 접기가 지우는 것은 남는 토큰과 같은 문자열뿐이라 «엔진명이 있다/없다» 판정은 같다(`[가능성 높음]` — 쉼표를 가로지르는 엔진명은 없다).
4. **`exampleNulled` 계측**: 단어 검사를 모두 통과한 뒤 `checkTopicExample` 직전·직후 — 접기와 무관한 자리라 그대로(시험: 접힌 항목 3개 중 예문이 비는 1개만 `exampleNulled: 1`·`EXAMPLE_MISSING`). 반환 모양(`words/received/dropped/droppedByReason/exampleNulled/exampleNulledByReason`)과 단어 객체 7개 칸 그대로(시험이 키 전수 대조).
5. **접기는 항목을 버리지 않는다**: `received 3 · dropped []` — 글만 고친다.

### 부수 효과 · 알아 둘 것
- 접기 빈도는 따로 계측하지 않는다(반환 모양을 바꾸지 말라는 불변 조건 때문). 운영에서 «v4 가 같은 뜻 반복을 몇 번 만들었나» 는 트레이스에 안 남는다. 필요하면 `exampleNulled` 처럼 선택 칸 한 줄을 후속으로 더할 수 있다(`TopicWordsAssembled` 모양 변경 + `topicWords.test.ts:381` deepEqual 갱신 필요).
- **접기가 만든 뜻이 «틀렸는가» 는 보지 않는다**: `업무, 업무` → `업무` 는 뜻을 늘리지도 줄이지도 않는다(같은 낱말을 한 번 더 적은 것뿐). 접으면 어색함만 사라진다.
- 기본 사전 시드의 뜻 7,755개(쉼표 뜻 2,366개)에는 접기가 **0건** 걸린다 — 시험이 코퍼스로 확인(정상 뜻을 건드리지 않는다는 증거, 쉼표 뜻이 2,000개 미만이면 시험이 실패해 헛통과를 막는다).

## 3. 감사 보강
- **F-2·F-3**(`chineseOnlyHanzi.ts` 머리 주석): 틀린 구절(«中·日 모두 JIS 표준 밖이거나»)을 삭제하고 «JIS 표준 **안에** 있는 간체 모양도 빠져 있다 — 个(JIS X 0208)·吧·你·她·两·哪·运(0212/0213)·开·关·么·养·种·阴·荣(0213 에만 있는 GB2312 글자 86자)»로 바로잡았다. «미탐은 다음 검사가 잡는다» 를 «A12 경로에는 이를 잡는 다음 검사가 없다(남는 안전망은 읽기 불일치 ③+ 정도) — 이 목록 전에도 통과하던 것이라 회귀 아님» 으로 고쳤다. `开始`·`关于` 가 지금도 통과한다고 명시. 나열한 글자와 86자 숫자를 Python 코덱(gb2312 ∩ euc_jisx0213, 0208∪0212∪cp932 제외)으로 직접 재확인했다(86 일치, 个는 euc_jp/cp932 에, 开·关·么·养·种·阴·荣 은 0213 에만).
- **F-5**(Info): 같은 주석에 `scripts/seed-build/enrich.ts` 의 cp932 화이트리스트 선행 사례와 블랙리스트를 고른 이유(JIS X 0212/0213 한자가 cp932 밖이라 화이트리스트가 오탐을 만든다) 한 줄을 더했다. 지시 범위(F-2·F-3·F-1)를 넘는 주석 한 줄이라 알린다.
- **F-1 시험 방어선** (`topicWordsQuality079.test.ts` 새 시험 1개):
  - ① JIS 표준 안의 대표 글자 16개(个 吧 你 她 两 哪 运 开 关 么 养 种 阴 荣 复 + JIS X 0213 전용 丏)가 목록에 **없고** `hasChineseOnlyHanzi` 도 false. 알려진 미탐(`开始`·`关于`·`你好`·`养成`)도 «통과한다» 고 못박았다(목록에 글자를 더해 «고치려는» 손편집이 먼저 깨지게). `这么` 는 这 때문에 걸린다.
  - ② 목록 크기 2,275 + 정렬한 목록의 sha256 고정 `8b244eb78b2f4aa720eec8b9252c8f49d47382c56a1c294c24a9b643b061475f`(Python·시험 양쪽에서 같은 값 계산). 의도해서 다시 계산했다면 해시를 함께 갱신하라는 설명 주석과, 실패 메시지가 새 해시를 보여 주는 문구 포함.
- F-4(재내보내기 위치)는 지시대로 손대지 않았다.

## 4. 실제로 실행한 것 (dev079b 미러 · NFS 에서 고치고 `sync-local.sh` 로 채움)
| 항목 | 결과 |
|---|---|
| 새 시험 | 접기 9개 + F-1 1개 + (PE v4 문구 고정 1개 = `topicWords.test.ts`) — 전부 통과 |
| 전체 시험 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` | **4,562 중 통과 4,559 · 실패 0 · 건너뜀 3**(건너뜀은 기존), 종료 0, 약 285초. 직전(1차) 4,551 → +11 = 접기 9 + F-1 1 + v4 문구 1 |
| `tsc --noEmit` | 종료 0, 출력 없음 |
| eslint (변경·신규 시험 파일 9개: `topicWords.ts`·`chineseOnlyHanzi.ts`·`schemas.ts`·`topicSet.ts`·`topicWords.test.ts`·`topicWordsQuality079`·`topicWordsMeaningFold079`·`task079Trace`·`task079KatakanaReading`) | 종료 0, 오류·경고 0 (`tests/live/**` 의 기존 54건은 범위 밖이라 보지 않음) |
| 미러 | `dev079b`(전체 시험·tsc·eslint)·`dev079b-mut`(변이용) — 둘 다 `make-mirror.sh` 로 생성, `mirror-audit.sh --check` 통과(`exposed_source=0`). 정리는 Leader 지시 시 |

## 5. 변이 시험 (`dev079b-mut`, 임시 파일에 쓴 뒤 `mv`, 끝나고 원문 복원·NFS 와 동일 확인 `RESTORED_IDENTICAL_TO_NFS True`)
기준선: 접기·품질·`topicWords` 시험 3파일 125개 모두 통과. 아래는 전부 **실패로 포착**.
| # | 변이 | 실패한 시험 |
|---|---|---|
| M1 | 접기 끄기(함수가 입력을 그대로 돌려줌) | 6개(대표 사례·규칙·한 글자 차이·④·⑦·계측) |
| M2 | 조건 느슨화(앞 2글자만 같으면 접음) | 2개(**한 글자 차이는 접지 않음** + 시드 코퍼스 불변) |
| M3 | 접기 위치를 ⑦ 뒤(push 시점)로 이동 | 1개(⑦ 접은 뜻 비교) |
| M4 | 목록 마지막 글자 龟 → 丏(JIS X 0213 전용, 감사의 M1b 재현) | 1개(F-1 — 대표 글자) |
| M5 | 목록에 JIS 안 간체 모양 开 추가 | 1개(F-1 — 대표 글자) |
| M6 | 인접 토큰만 비교(떨어진 반복 안 접음) | 2개(규칙·⑦) |
| M7 | 접을 것이 없어도 `, ` 로 다시 이음(원문 보존 깨기) | 3개(규칙·불변·모양) |
| **M8** | 목록 마지막 글자 龟 → 俱(0213 전용이지만 **대표 글자 목록에 없음** — 해시만 잡아야 하는 변이) | 1개(F-1 — sha256 줄. 같은 변이가 (a)(b)(c)·고정점 시험을 모두 통과함을 함께 확인 → 해시가 실제로 새 구멍을 막는다) |

## 6. 한계 · Reviewer 가 볼 곳
1. **병합 뒤 좁은 재감사(감사 «QA 가 볼 곳 1»)**: 접기 코드는 `assembleTopicWords` 의 `meaningKo` 읽는 줄 한 곳과 새 함수 하나다. `normalizeMeaning`·④ 검사·`exampleNulled` 계측·반환 모양은 `git diff` 로 줄 단위 불변을 확인할 수 있다(위 §2 «위치 판단» 5항).
2. 접기 규칙이 «떨어진 반복»까지 접는 것은 사용자 문구(«앞 토큰과 같으면»)의 해석이다. 인접 반복만 접기를 원하면 `kept` 마지막 토큰과만 비교하도록 한 줄 바꾸면 되고, M6 가 그 차이를 시험이 구분함을 보였다.
3. v4 의 효과 추정(Leader 눈가림: 불량 단어 27→13/100)은 접기 **전** 판정이다. 접기로 어색함이 사라진 정도(10/100 쪽)는 이 구현이 `X, X` 만 접고 다른 뜻을 건드리지 않을 때 성립한다 — 시험이 «다른 뜻 보존»(`정식, 한 끼 식사`·`예약,예매`)을 못박았다.
4. N2 새 단어 장수 위험(사용자 결정에 따라 배포 후 트레이스 `kept` 평균 8.0 미만이면 v3 복귀)은 이 구현으로 줄지도 늘지도 않는다: 접기는 항목을 버리지 않고, ⑦ 중복 판정만 접은 키로 하는 것이 유일한 변화다(`업무, 업무` 가 기본 표현·앞 항목 `업무` 와 같은 뜻이면 이제 걸려 장수가 1장 줄 수 있다 — 같은 뜻 카드가 한 세트에 두 번 나오는 것을 막는 방향).
5. 접기 빈도 비계측(§2 부수 효과).

## 7. 미커밋 파일 (이번 소환 포함 전체)
- 수정: `src/modules/conversation/prompts/topicWords.ts` · `src/modules/conversation/__tests__/topicWords.test.ts` · `src/modules/conversation/structuredResponse/schemas.ts` · `src/modules/learning/vocab/topicSet.ts`
- 새 파일: `src/modules/conversation/structuredResponse/chineseOnlyHanzi.ts` · `src/modules/conversation/__tests__/topicWordsQuality079.test.ts` · `src/modules/conversation/__tests__/topicWordsMeaningFold079.test.ts` · `src/modules/learning/__tests__/task079Trace.test.ts` · `src/components/common/__tests__/task079KatakanaReading.test.ts` · (PE) `tests/prompts/topic-words-meaning-live.ts` · 이 기록
