---
task_id: task-079
role: reviewer
tags:
  - type/task-record
  - domain/learning
  - domain/prompt
aliases:
  - task-079 reviewer 기록
  - REV-079
updated: 2026-10-20
---
# REV-079 — task-079 갈래 A(코드 3건) 독립 감사

상위 이력서: [[task-079-improve-topic-words-quality]] · 대상: [[task-079-dev-record]] · 감사자 reviewer(`rev-079-audit`) · Read 전용(소스·시험 수정 0, 커밋·푸시 0, LLM 라이브 호출 0)
미러: `thekaiwa-rev079`(재실행용) · `thekaiwa-rev079m`(변이·병합 시험용, 둘 다 `make-mirror.sh` 로 생성, `mirror-audit --check` 통과) — 정리는 Leader 지시 시.

## 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 4 · Info 4)

```json
{ "reviewId": "REV-079", "status": "PASS_WITH_NOTES",
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 4, "info": 4 },
  "high_risk_areas": ["간체자 차단 목록(오탐=멀쩡한 단어 손실)", "가타카나 읽기 정규화 후 카드 [읽기] 버튼·단어장 중복 판정", "v4·중복 접기 병합 뒤 topicWords.ts 재검증"],
  "native_change": false }
```

light 트랙 범위 확인: 변경 7개 파일(+PE 병합 시 2개) ≤ 12, 마이그레이션·네이티브·인증·화면 코드 변경 없음 → 승격 불필요. 화면 파일이 diff 에 없어 데모 게이트 대상 아님(judge `none`/`DM-light-waive`) — `check.mjs` 는 돌리지 않았다(상태 파일 접촉 방지).

## 직접 재실행한 것 (개발자 보고를 믿지 않고 새 미러에서)

| 항목 | 결과 |
|---|---|
| 새 시험 3파일 14개 | 14/14 통과 |
| 전체 시험 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` | **4,551 중 통과 4,548 · 실패 0 · 건너뜀 3** (개발자 보고와 동일) |
| `tsc --noEmit` | 종료 0 |
| eslint(변경·신규 7개 파일) | 종료 0 |
| `eslint tests/live/p3-qa` | 54 오류(개발자 주장 «eslint . 는 기존 tests/live 54건으로 실패» 사실 확인 — 이번 변경과 무관). Leader 는 린트 게이트를 «변경 파일 eslint» 로 판정해야 한다 |
| 병합 가능성 | PE `v4-diff.patch` 를 `rev079m` 에 `patch -p1` → 충돌 0, 병합 상태에서 topicWords·topicWordsQuality079·task079Trace·topicDraft·task049TopicWordsSeam **158/158 통과** |

## 1. 간체자 차단 목록 (가장 중요) — 오탐 0 확인됨

독립 재현(스크래치 `rev-079-audit/verify.py`, 개발자 스크립트와 별도로 작성):
- GB2312 한자 6,763 − 일본어 합집합 12,743 = **2,275자, 파일의 목록과 양방향 차집합 0**(정렬·중복 없음·행 길이 50/25). 일본어 쪽은 Python `euc_jp`(0208+0212)·`euc_jis_2004`·`euc_jisx0213`(plane1·2)·`shift_jis`·`shift_jis_2004`·`shift_jisx0213`·`cp932` 디코드 + `iso2022_jp/_1/_3/_2004/_ext` 인코드 가능 여부까지 합쳤다. (`iso2022_jp_2` 는 GB2312 를 품고 있어 일부러 뺐다 — 첫 시도에서 이것이 합집합을 오염시켰고 거기서 거른 뒤 재실행.)
- **Node 독립 검산**(`TextDecoder` fatal): shift_jis 6,682 · euc-jp 6,682 · JIS X 0212 5,801 — 개발자 숫자와 일치, 합집합 12,204, **차단 목록과 겹침 0**. 정규식은 상태 없음(연속 호출 동일), 비 BMP(𠮟·𩸽)는 오류·매치 없음, 20,000회 호출 3ms.
- 시드 전수: `prisma/seed-data` 아래 JSON **12개 파일, 문자열 55,423개 전부 스캔 → 차단 글자 0**(시험 (a)는 같은 12개를 읽는다; 파일 존재·`>= 7755`·`received === seeds.length`·파일 수 `>= 10` 단언이 있어 빈 입력 헛통과가 아니다). JLPT 시드 7,755개 확인.
- 저장소 텍스트 스캔(agent-vault 제외): 차단 글자는 `scripts/seed-build/*`(员 — 간체자를 설명하는 주석·시험)와 새 시험뿐. 코드·시드·프롬프트에 일본어로 쓰인 곳 없음.
- 흔한 일본어 한자(国学気点体品商験記念 등 56개+)는 목록에 없다(시험 + 고정점 시험이 확인).
- **미탐 크기(의도된 대가)**: 흔한 중국어 글자 약 63자 표본 중 53자 차단, 10자(你·她·么·开·两·种·关·吧·哪·运)는 일본어 표준(주로 JIS X 0212/0213)에 있어 통과. JIS X 0213 규칙 때문에 GB2312 글자 86자(关 开 么 养 种 阴 荣 复 …)가 빠졌다. 즉 `开始`·`关于` 같은 단어는 지금도 통과 → **이전과 달라지지 않는 상태(회귀 아님)**, 사용자 불이익 아님.
- 파일 주석의 규칙 설명(`GB2312 − (0208 ∪ 0212 ∪ 0213 ∪ CP932)`)은 정확하다. 정확하지 않은 문장은 아래 F-2, F-3.

## 2. 가타카나 읽기 정규화

- 코드(`topicWords.ts` 의 `normalizeTopicReading`): 표기가 `^[ァ-ヺー・]+$` 이고 가타카나 글자 ≥1 일 때만 `toKatakana(reading)`. 한자·히라가나 섞임·전부 히라가나·`ー`/`・` 만인 표기는 불변(시험 표 12행 + 합성 2행). 위치는 push 직전이라 `readingMatchesSurface` 뒤 — 그 검사가 가나 종류를 접어 비교하므로 순서는 기능적으로 무관(변이 M5 는 동치 변이였다), 소리가 다른 읽기(`こうひい`)는 그대로 `READING_MISMATCH`.
- 소비처를 코드로 따라가 확인: 중복 키 `normalizeTopicWordKey`·`recheckTopicWords` = 표기 기준 / TTS = `listenTexts(card: Pick<VocabCard,'surface'|'example'>)` 라 읽기가 타입상 못 들어옴 / 한글 발음 줄은 분석 조각 기반(`kanaToHangul(pron)`)이라 저장 읽기와 무관 / `alignWordRuby`·`readingMatches` 는 가나 종류를 접음(시험이 528개 전부 확인). **깨지는 곳 없음.**
- 시험이 SEED 가타카나 표기 528+개 전부에서 항등·왕복을 대조 — 실제로 코퍼스를 읽는다.
- 화면에 나타나는 **부수 효과 2개(개발자 기록에 없음)** → F-6.

## 3. 트레이스 기록 (IMP-0056)

- `topicSet.ts:549-553` 에서 `exampleNulled`(숫자|null)·`exampleNulledBy`(고정 코드 `k=v` 연결, `.slice(0,120)`|null) 추가. `TraceStep` 인덱스 시그니처(`string|number|boolean|null|undefined`) 를 지킨다. 단어·예문 원문 없음(시험이 `JSON.stringify(trace)` 로 확인; 변이 M8 «단어 표기를 칸에 싣기» 가 3개 시험에 잡힘). `received`/`kept`/`dropped` 의미와 기존 칸 보존 확인(시험 2). A12 단계를 읽는 앱 코드는 없다(grep). 사유 코드는 8개 고정 값이라 120자 안에서 잘림만 발생 → F-7.

## 4. 6층 경계

- `chineseOnlyHanzi.ts` 는 import 0 인 순수 파일, 같은 L2 `structuredResponse/` 안. `topicWords.ts → ../structuredResponse/schemas` 는 기존 방향이다. 하위 층에서 상위 층 import·`index.ts` 우회 없음. 클라이언트(`src/components`, `src/app` tsx)에서 `@/modules/conversation` 을 import 하는 곳 0 → 번들 영향 없음.
- 우회 타당성: `topicWords.test.ts:200` 은 «import 줄이 engine 아니면 `../structuredResponse/schemas`» 로 고정(의도 = learning·infra·persona 금지). 재내보내기는 그 정규식을 맞추려는 구조이지 경계 위반은 아니다. 다만 F-4.

## 5. 기존 계약 불변

`git diff` 로 확인: 프롬프트 지시문·`TOPIC_WORDS_PROMPT_VERSION`·스키마·`TopicWordsAssembled`(L2) 모양·API 계약·Prisma·`LLM_TASKS` 변경 없음. 라우트 `vocab/sessions/route.ts:18` 은 그대로이고 L3 로컬 타입의 새 칸 2개는 선택 칸. `assembleTopicWords` 반환 키 전수는 `task049TopicWordsSeam` 이 대조하고 통과.

## 6. 시험의 질 · 변이 시험 (`rev079m`, 임시 파일 + mv 로 변이 후 원복·`cmp` 일치 확인)

| # | 변이 | 결과 |
|---|---|---|
| M1 | 목록 마지막 글자 `龟` → 일본어 JIS X 0208 한자 `亀`(길이 동일 — 고정점 시험 우회 시도) | **포착 2건**(오탐 점검·독립 디코더 검산) |
| **M1b** | `龟` → JIS X 0213 **전용** 한자 `丏`(U+4E0F, GB2312 아님) | **생존 — 14개 모두 통과** → F-1 |
| M2 | 예문 간체자 검사 제거 | 포착 1건 |
| M3 | 가타카나 전용 가드 제거(모든 읽기 정규화) | 포착 2건 |
| M4 | 가타카나 정규식 앵커 제거(«가타카나를 포함») | 포착 2건 |
| M5 | 정규화를 `readingMatchesSurface` 앞으로(느슨화 시도) | 생존 — **동치 변이**(그 검사가 가나 종류를 접음). 결함 아님 |
| M6 | 구형 driver 의 `exampleNulled` null → 0 | 포착 1건 |
| M7 | `toKatakana` 범위 `ぁ-ゖ` → `ぁ-ん`(ゔ 미변환) | 포착 2건 |
| M8 | 트레이스 칸에 단어 표기 싣기 | 포착 3건 |

개발자가 보고한 변이 3종(국 추가·정규화 무력화·표기 검사 제거) 외에 예문 검사·가드 앵커·범위·null 의미·원문 누출을 더 잡았다. 시험의 어서션이 항상 참인 것은 없다(각 변이가 실제로 실패시킴).

## 지적 사항

### Low

**F-1 독립 검산이 JIS X 0213 전용 한자를 덮지 못한다 (변이 M1b 생존).** `topicWordsQuality079.test.ts:200-217` 의 (b)는 WHATWG `shift_jis`·`euc-jp`(0208+0212)만 열거하고 Node `TextDecoder` 에는 JIS X 0213 이 없다. Node 디코더가 모르는 JIS X 0213 전용 BMP 한자는 539자이고, 그중 GB2312 에 있어 «0213 규칙» 으로 목록에서 빠진 글자가 86자다(关 开 么 养 种 阴 荣 …). 이런 글자나 그 밖의 0213 전용 글자를 사람이 목록에 넣어도 모든 시험이 통과한다(재현: `龟`→`丏`(U+4E0F, 0213 전용) 1글자 교체 → 14/14 통과). 목록은 «손대지 말고 다시 계산» 규칙이라 현재 결함은 아니고 미래 손편집 방어선만 비어 있다. 권고(비차단): 시험에 ① 목록 문자열의 고정 해시(sha256) 한 줄 — 의도적으로 갱신할 때만 바뀜 또는 ② JIS X 0213 전용 대표 글자(开·关·么·养·种·阴·荣 + 丏)가 `hasChineseOnlyHanzi` 에서 false 라는 단언을 추가.

**F-2 `chineseOnlyHanzi.ts` 주석 한 문장이 사실과 어긋난다.** 파일 머리 «반대로 中·日 모두 JIS 표준 밖이거나 JIS 안에 있는 간체 모양(예: 个·吧)은 빠져 있다» — JIS 표준 **밖**이면서 GB2312 에 있는 글자는 오히려 **차단 대상**이다. 의도는 «JIS 안에 있는 간체 모양(个 = JIS X 0208 2수준, 吧 = 0212/0213, 开·关 = 0213 전용)은 빠져 있다» 일 것이다(내가 코덱으로 확인). 권고: «中·日 모두 JIS 표준 밖이거나» 구절 삭제.

**F-3 «미탐은 다음 검사·눈 점검이 잡고» 는 A12 경로에서 사실이 아니다.** 같은 주석의 이 구절과 달리, 표기 간체 모양 글자(开·关·吧 등)를 이어서 잡는 검사가 A12 에는 없다(남는 안전망은 읽기 불일치 ③+ 뿐). 위 미탐 크기(대표 63자 중 10자)는 위험 아님이지만 주석은 «안 잡힌다·이전과 같다» 로 고쳐 두는 편이 다음 사람을 오도하지 않는다.

**F-4 `schemas.ts` 재내보내기 + `conversation/index.ts:13 export *` 로 2,275자 상수와 검사 함수가 conversation **공개 API** 에 올라간다.** `schemas.ts` 는 §67 응답 스키마·상수 파일인데 중국어 한자 검사 헬퍼를 얹은 것은 `topicWords.test.ts:200` 의 정규식을 맞추기 위한 우회다(의도는 learning·infra·persona import 금지이고 같은 폴더 `./chineseOnlyHanzi` 직접 import 는 그 의도를 해치지 않는다). 동작·경계에는 문제 없음. 권고: Leader 가 PE 의 v4 병합으로 어차피 `topicWords.test.ts` 를 고치므로 그때 정규식에 `\.\./structuredResponse/chineseOnlyHanzi` 를 허용하고 `schemas.ts` 재내보내기 3줄을 지우는 것이 더 깨끗하다(개발자 기록 §5-2 가 제시한 대안). 지금 유지해도 무방.

### Info

**F-5 선행 구현 중복.** `scripts/seed-build/enrich.ts:113-130` 이 이미 «일본어에 없는 한자(간체자 등)를 거른다» 는 목적으로 `TextDecoder('shift_jis')` 허용 집합(cp932 화이트리스트)을 만든다. 이번에 «일본어 표준 밖 한자» 정의가 두 개(화이트리스트 cp932 / 블랙리스트 GB2312−JIS)가 됐다. 런타임에 화이트리스트를 쓰면 JIS X 0212/0213 한자(cp932 밖)가 오탐이 되므로 블랙리스트를 고른 판단은 타당하나, 개발자 기록·파일 주석에 선행 사례와 이유가 없다. 권고: 파일 머리에 한 줄 상호 참조.

**F-6 정규화의 사용자 가시 부수 효과 2개 — QA 폰 확인 필요, 결함 아님.** (i) 새 AI 가타카나 카드는 읽기 = 표기가 되어 `VocabDeck.tsx:194 readingAvailable=false` → 툴바 [읽기] 가 `aria-disabled`, 누르면 힌트 «이 카드는 읽기가 따로 없어요»(`labels.ts:417`). 기본 사전 가타카나 카드와 같은 모습이 되는 것이 IMP-0057 의 목적이지만 개발자 기록은 «표시 통일» 이라고만 썼다. 한글 발음 줄은 분석 기반이라 영향 없음. (ii) [단어장에 넣기](`POST /api/v1/words`)는 (표기, 읽기) 바이트 일치로 기본 단어를 찾는다(`words.ts` `findBaseDuplicate`). 정규화 덕에 기본 사전과 같은 가타카나 단어는 이제 409 `BASE_DUPLICATE` → 결과 화면이 이미 `'exists'` 로 처리(`VocabResult.tsx` 409 분기)해서 «중복 사본이 조용히 생기던 것» 이 «이미 있음» 표시로 바뀐다 — 개선 방향. 이미 저장된 히라가나 읽기 카드(최근 2일치 3건)는 그대로라 한동안 두 모양이 섞인다(이관 없음, 개발자 기록 §6 과 일치).

**F-7 트레이스 칸의 두 가지 사소한 성질.** (i) `exampleNulled` 는 항목 검사 ①~⑦ 통과 단어 기준이라 이후 `recheckTopicWords` 가 버리는 단어도 센다(개발자 기록에 명시). (ii) `exampleNulledBy` 는 `dropped` 와 같은 방식의 120자 자름이라, 사유가 6종 이상 섞이면 토큰 중간에서 잘릴 수 있다(시험 3이 «앞에서부터 자름» 으로 고정). 측정 목적에는 충분.

**F-8 범위 밖 구멍 확인.** 병렬 경로 `topicDraftSchemas.ts`(사용자 주제 기본 표현 12개 생성)와 A12 `meaningKo`(④ 는 한글 포함·가나 없음만 보므로 한자 혼입 허용)에 같은 «한자 범위만 본다» 구멍이 남아 있다. 개발자가 후속으로 적었고 이번 판정 대상 아님 — IMP 후보로 접수 권고.

## QA(Leader)가 볼 곳 (high_risk_areas)

1. **병합 뒤 재실행**: v4(PE) + 중복 접기(developer 추가분)를 NFS 에 적용한 상태로 전체 시험·tsc·변경 파일 eslint 를 한 번 더(내 병합 시험은 중복 접기 전의 v4 diff 기준 158/158). 중복 접기 코드는 `assembleTopicWords` ④ 근처(`meaningKo` 후처리)에 들어가므로 `normalizeMeaning`(DUP_MEANING 키)과 `MEANING_CHARS` 순서, 그리고 `exampleNulled` 계측 위치를 건드리지 않는지 새 감사(좁게) 권장.
2. **폰 확인(배포 후)**: 새 가타카나 단어 카드(コーヒー류)에서 [읽기] 버튼 상태·힌트, 한글 발음 줄 유지, 결과 화면 [단어장에 넣기] 가 기본 단어와 같은 가타카나 단어에서 «이미 있음» 표시.
3. **운영 트레이스로 관찰**: `RequestTrace.steps[?].name='A12'` 의 `dropped` 에 `SURFACE_SIMPLIFIED`, `exampleNulledBy` 에 `EXAMPLE_JA_SIMPLIFIED` 가 어떤 빈도로 나오는지(0 이어도 정상 — 이번 전 측정 10회에서 간체자 사유 0). 오탐 의심 시 `dropped` 에 단어는 안 남으므로 시드 전수 시험이 유일한 사전 방어다.
4. N2 새 단어 장수(v4 도입 위험): 사용자 결정대로 배포 후 트레이스 `kept` 평균을 보고 8.0 미만이면 v3 복귀.

## 조건부 참고 의견 (이번 판정에 넣지 않음)

- v4 diff(`task-079-pe-data/v4-diff.patch`): 변경은 `meaningKo` 지시 1줄(+153자)·버전 상수·시험 상한 +153 뿐이고 `textJa`·`jlpt`·난이도 줄·스키마·검사에는 닿지 않는다 → N2 통과를 해칠 **구조적** 경로는 보이지 않는다. 다만 N2 가드의 비교 기준이 **같은 세션의 v3 N2 arm 이 아니라 task-078 때의 8.10(시간이 다른 표본)** 이다. 가드 결과 7.8(처음 실행 7.56)은 sd 1.93·n=10 이라 표준오차 약 0.6 으로 8.10 과 통계적으로 구분되지 않고, 모델·CLI 시점 차이도 섞인다 — PE 기록이 스스로 «깎았다는 증거도 없다» 까지만 말한다는 해석이 맞다. 호출 예비 9회가 남아 있으니 결정에 더 확신이 필요하면 **같은 입력의 v3 N2 arm** 을 동시에 재는 것이 가장 값싼 보강이다.
- 측정 설계: 교차 실행(같은 입력 짝)·눈가림 파일 분리·사전 등록은 적절. 허점은 ① 판정자 1명(AI) ② 합격선 (a) 절대 6% 가 판정 기준(엄격)과 달라 사후 면제가 필요했던 사전 등록 실수(이미 사용자 결정으로 처리됨) ③ v4 에서 새로 생긴 «같은 낱말 반복» 이 불량 판정에 포함되어 v4 효과 추정이 중복 접기 전·후 어느 쪽인지 섞이는 점. 중복 접기를 코드로 넣으면 v4 실효는 판정표의 «10/100(p=0.003)» 쪽에 가깝다 — 이 추정은 접기 구현이 `X, X` 만 접고 다른 뜻을 건드리지 않을 때만 성립하므로 구현 시험에 «다른 뜻은 보존» 을 넣을 것.

## 판정 근거 요약
- 7개 검토 영역 중 이번 대상에 해당하는 항목(유지보수성·안정성·운영성·학습 원칙·보안·아키텍처)을 모두 보았고 Critical·High·Medium 없음.
- Secret·사용자 데이터·원문 기록 없음, 새 입력 경로·외부 호출·네이티브 변경 없음.
