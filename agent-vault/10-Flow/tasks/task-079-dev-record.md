---
task_id: task-079
role: developer
tags:
  - type/task-record
  - domain/learning
  - domain/prompt
aliases:
  - task-079 developer 기록
updated: 2026-10-20
---
# task-079 developer — 갈래 A: A12 새 단어 검사 3건 (IMP-0056·0057·0058, dev-079 미러)

상위 이력서: [[task-079-improve-topic-words-quality]] · LLM 라이브 호출 0회 · 화면·Prisma·API 계약 변경 없음 · 네이티브 변경 없음

## 한 줄 요약
(1) A12 Trace 단계에 예문 null 통계 두 칸 추가 (2) 가타카나 표기의 읽기를 가타카나로 정규화 (3) 중국어 전용 한자 2,275자를 표기(`SURFACE_SIMPLIFIED`)·예문(`EXAMPLE_JA_SIMPLIFIED`)에서 차단 — 차단 목록은 «GB2312 − 일본어 문자 표준» 으로 기계적으로 만들고 독립 디코더로 다시 검산했다. **전체 시험 4,551(통과 4,548·실패 0·건너뜀 3) · tsc 0 · 변경 파일 eslint 0.**

## 불편한 사실 · 알아 둘 것 (먼저)
- **`npm run lint`(= `eslint .`)는 이 작업과 무관하게 실패한다**: `tests/live/p3-qa/*.ts` 등 추적 중인 파일에서 `no-explicit-any` 54건(오류)·경고 86건. 내 변경 파일 6개는 오류 0·경고 0 (`--format json` 으로 파일별 확인). `tests/**` 는 qa 소유라 손대지 않았다 — Leader 가 «린트 통과» 를 `eslint .` 로 판정하면 기존 오류 때문에 막힌다.
- **기존 시험 한 건이 내 첫 구현을 깼다**: `topicWords.test.ts:200` 이 `prompts/topicWords.ts` 의 import 줄을 «`@/modules/engine` 아니면 `../structuredResponse/schemas`» 로만 허용한다. 새 파일을 직접 import 하면 실패해서(전체 시험에서 발견) `structuredResponse/schemas.ts` 에 **재내보내기 한 줄**을 두고 `topicWords.ts` 는 기존 schemas import 줄에 `hasChineseOnlyHanzi` 만 더했다. 그 시험은 건드리지 않았다(PE 소유). 대안(Leader 선택): 직접 import 로 바꾸고 그 시험의 정규식을 넓히기 — PE 가 같은 시험 파일을 고치는 중이라 피했다.
- **PE 미러 `pe079` 는 내 변경을 모른다**: PE 가 합격 뒤 NFS 에 자기 블록만 Edit 하면 합쳐지지만, PE 가 이미 돌린 시험은 내 변경 전 파일 기준이다. 병합 뒤 전체 시험을 한 번 더 돌려야 한다(위 import 줄 시험이 PE 쪽 `topicWords.ts` 편집과 충돌할 수 있는 유일한 지점이었다).
- **차단 목록은 «간체자 전부» 가 아니다**: JIS X 0212/0213 에 들어 있는 간체 모양(예: 开·个·吧·咖·啡·哪)은 일본어 표준에 있으므로 **빠져 있다**(미탐 허용, 오탐 금지). 번체 전용 글자(GB2312 밖: 這·們·說…)도 대상이 아니다. 미탐 쪽 실례 `开始` 는 통과한다.

## 변경 파일
| 파일 | 변경 |
|---|---|
| `src/modules/conversation/structuredResponse/chineseOnlyHanzi.ts` | **새 파일** — `CHINESE_ONLY_HANZI`(2,275자 문자열)·`hasChineseOnlyHanzi(text)` |
| `src/modules/conversation/structuredResponse/schemas.ts` | 재내보내기 1줄 (`topicWords.ts` import 줄 시험 때문) |
| `src/modules/conversation/prompts/topicWords.ts` | 검사·조립 코드만: `TopicWordDropReason` += `SURFACE_SIMPLIFIED` · `TopicExampleDropReason` += `EXAMPLE_JA_SIMPLIFIED` · `toKatakana`·`normalizeTopicReading` 신설 · `checkTopicExample` 에 간체자 검사 · `assembleTopicWords` 에 표기 검사(② 뒤)와 읽기 정규화(push 직전). SYSTEM_PROMPT·버전 상수·지시문·`TopicWordsAssembled` 출력 모양은 불변 |
| `src/modules/learning/vocab/topicSet.ts` | 로컬 `TopicWordsAssembled` 에 선택 칸 2개 · A12 Trace 단계에 `exampleNulled`(숫자)·`exampleNulledBy`(문자열) |
| `src/modules/conversation/__tests__/topicWordsQuality079.test.ts` | **새 시험 9개** |
| `src/modules/learning/__tests__/task079Trace.test.ts` | **새 시험 3개** |
| `src/components/common/__tests__/task079KatakanaReading.test.ts` | **새 시험 2개** (소비처 쪽) |

## 1. IMP-0056 — 예문 null 통계를 Trace 에
- A12 단계에 `exampleNulled: <개수>`(TraceStep 은 숫자 허용이라 숫자 칸) + `exampleNulledBy: 'EXAMPLE_MISSING=2,EXAMPLE_JA_LEN=1'`(`dropped` 와 같은 `k=v` 연결, `.slice(0, 120)`). 통계를 안 주는 driver(구형·시험용)는 둘 다 `null`, 전부 통과면 `0` 과 `null`.
- 새 필드는 **로컬 타입에만** 선택 칸으로 더했다. 라우트 driver 는 `assemble: (raw, ctx) => assembleTopicWords(raw, ctx)` 그대로이고 L2 결과가 이미 `exampleNulled`·`exampleNulledByReason` 을 가지고 있어 구조적으로 맞는다(tsc 0).
- **`TopicWordsAssembled`(L2) 에 칸을 더하지 않았다**: `topicWords.test.ts:381` 이 빈 결과를 `deepEqual` 로 못박고 있고(PE 소유), `task049TopicWordsSeam` 이 단어 객체의 키 전수를 대조한다. 읽기 정규화 횟수 같은 카운터는 그래서 넣지 않았다(필요하면 PE 시험 갱신과 함께 후속).
- 한계: `exampleNulled` 는 «항목 검사 ①~⑦ 을 통과한 단어 중» 예문이 null 이 된 수라, 뒤의 `recheckTopicWords` 가 버리는 단어(중복·칸 폭)도 센다. 단어·예문 원문은 어디에도 없다(시험이 `JSON.stringify(trace)` 로 확인).

## 2. IMP-0057 — 가타카나 읽기 정규화
- 규칙: **표기 전부가 가타카나(U+30A1–30FA·ー·・, 가타카나 글자 1개 이상)** → `toKatakana(reading)`. 그 밖(한자·히라가나 섞임, 전부 히라가나)은 불변. 위치: `assembleTopicWords` 가 ①~⑦ 과 `readingMatchesSurface` 를 **모두 통과한 항목을 push 하는 줄** — 그래서 소리 불일치(`こうひい` ↔ コーヒー)는 정규화로 느슨해지지 않고 여전히 `READING_MISMATCH`.
- 근거 대조: 기본 사전 SEED 가타카나 표기 528개 전부가 가타카나 읽기(Python 으로 확인) → 시험이 528개에서 ① SEED 읽기에 정규화가 **항등** ② `toHiragana(읽기)` 를 정규화하면 SEED 읽기로 **정확히 돌아옴** ③ 히라가나로 와도 `readingMatchesSurface` 통과(=정규화가 필요했던 상황)를 확인한다. SEED 에 `・` 를 가진 표기는 없어, `ホット・ドッグ` 는 합성 시험 한 줄로만 본다.
- 소비처(깨지지 않음 — 읽기를 쓰는 곳 전부 가나 종류를 접는다): `kanaToHangul`(`tokenize` 첫 줄 `hiraToKata`) · `readingMatches`(`kataToHira` 로 양쪽 접음) · `alignWordRuby`(한자 없는 표기는 null 이라 읽기를 안 씀) · 중복 키 `normalizeTopicWordKey`·`recheckTopicWords` 는 **표기** 기준이라 읽기와 무관. 시험(`task079KatakanaReading`, components 층)이 528개 전부에서 한글 발음 동일·`readingMatches` 가타카나/히라가나 모두 true·루비 null 을 확인. TTS 는 읽기가 아니라 표기·예문을 받는다(`listenTexts(card)` = `soundText(card.surface)`·`soundText(card.example)`, `WordDetailSheet` 도 `w.surface` — 코드로 확인).
- 중복: 같은 표기를 읽기 종류만 달리해 두 번 내면 앞이 이기고 뒤는 `DUP_RESPONSE`(시험). 제외 목록과 같은 표기는 `DUP_EXCLUDED`.

## 3. IMP-0058 — 간체자 차단

### 3-1. 차단 목록을 만든 방법 (손으로 고르지 않았다)
- **규칙**: 목록 = **GB2312 한자 6,763자 − (JIS X 0208 ∪ JIS X 0212 ∪ JIS X 0213 ∪ CP932 확장)** = 2,275자. 일본어 문자 표준에 있는 글자는 하나도 들어가지 않으므로 신자체(国·学·気·体·点·品)·구자체(國·學)·일본식 한자는 **정의상** 빠진다. Leader 임시 후보가 品·点·体 를 잘못 잡은 문제는 이 방식에서는 생길 수 없다.
- 재계산 스크립트(Python 3.10, 표준 라이브러리 코덱만):
```python
def table(codec, leads, trails, prefix=b''):
    out = set()
    for a in leads:
        for b in trails:
            try: s = (prefix + bytes([a, b])).decode(codec)
            except Exception: continue
            if len(s) == 1: out.add(s)
    return out
cjk = lambda c: '一' <= c <= '鿿' or '㐀' <= c <= '䶿'
gb = {c for c in table('gb2312', range(0xA1, 0xF8), range(0xA1, 0xFF)) if cjk(c)}          # 6,763
jp = table('euc_jp', range(0xA1, 0xFF), range(0xA1, 0xFF))
jp |= table('euc_jp', range(0xA1, 0xFF), range(0xA1, 0xFF), b'\x8f')                        # JIS X 0212
jp |= table('euc_jisx0213', range(0xA1, 0xFF), range(0xA1, 0xFF))
jp |= table('euc_jisx0213', range(0xA1, 0xFF), range(0xA1, 0xFF), b'\x8f')
sj = list(range(0x81, 0xA0)) + list(range(0xE0, 0xFD))
jp |= table('shift_jis_2004', sj, range(0x40, 0xFD)) | table('cp932', sj, range(0x40, 0xFD))  # NEC/IBM 확장
jp = {c for c in jp if cjk(c)}                                                              # 12,743
block = ''.join(sorted(gb - jp))                                                            # 2,275
```
  (스크래치 `dev-079-code/derive.py` 와 같다. 정렬 순서 = 코드포인트 순.)
- 출력 파일 `chineseOnlyHanzi.ts` 는 50자씩 줄로 나눈 문자열 배열 + 위 규칙을 주석으로 가진다. 고칠 때는 목록을 손대지 말고 다시 계산한 뒤 시험 세 가지를 통과시킨다.

### 3-2. 오탐 점검 결과 (시험으로 못박음)
| 점검 | 결과 |
|---|---|
| (a) JLPT 시드 7,755개의 표기·읽기·예문 + 다른 시드 JSON(주제·시나리오·사전·재분류…) 모든 문자열 | 차단 글자 **0**. 시드 표기 전부를 `assembleTopicWords` 에 넣어도 `SURFACE_SIMPLIFIED` 0 |
| (b) Node `TextDecoder` 로 열거한 일본어 한자(shift_jis 6,682 · euc-jp 6,682 · JIS X 0212 5,801) | 겹침 **0**, 열거한 일본어 한자 중 막히는 글자 **0** (목록을 만든 Python 코덱과 다른 도구로 재검산) |
| (c) 목록 전부 GBK 로 디코드 | **2,275/2,275** (중국어에 있는 글자만 들어 있음) |
| 이름 댄 일본어 한자 | 記念品·体験·点滴·商品·品質·点·体·品·国·学·気 통과(Leader 임시 목록이 잡았던 5건 포함), 経験·関係·会議·国際·駅·売る·続く·読む·団体 등 64개 통과 |
| 간체자 대표 | 怎样ですか(样)·这个(这)·我们(们)·记念品(记)·买い物(买)·请问·谢谢·说明·学习(习만 걸림, 学은 통과)·电话 — 전부 `SURFACE_SIMPLIFIED` |
| 저장소 전체 텍스트 스캔(src·prisma·speech·docs·plugins·.claude) | 차단 글자는 IMP-0058·task-051 문서의 인용(样·员 등)뿐 — 코드·시드에 일본어로 쓰인 곳 없음 |
- 변이 시험으로 시험이 실제로 잡는지 확인했다(미러에서 임시 변경 뒤 복구·diff 일치 확인): ① 목록에 `国` 추가 → 5건 실패(오탐 점검 3건 + 고정점 + 예문) ② 읽기 정규화 무력화 → 3건 실패 ③ 표기 검사 제거 → 1건 실패.

### 3-3. 예문(`checkTopicExample`)에도 넣었다 — 근거
- 넣었다: **새 사유 `EXAMPLE_JA_SIMPLIFIED`**, 예문 쌍만 null·단어는 유지(v2 규칙 그대로). 검사 순서는 문자 구성(`EXAMPLE_JA_CHARS`) 다음, 길이(ko) 앞.
- 근거: ① 예문은 카드에 그대로 보이는 일본어 글이고, 예문의 한자 허용 범위(U+4E00–9FFF)는 표기와 같아 같은 구멍이 있다 ② 목록이 «일본어 표준에 없는 글자» 만이라 오탐 위험은 표기와 같은 수준(시드 7,755개 예문 전부 통과, `EXAMPLE_JA_SIMPLIFIED` 0건) ③ 실패해도 잃는 것은 예문뿐(단어 생성 성공률 불변) ④ 새 코드가 `exampleNulledBy` 로 따로 집계돼 측정 가능.
- 한국어 번역(`exampleKo`)은 이미 CJK 한자를 금지하므로 불필요. 한국어 뜻(`meaningKo`)에 한자가 섞이는 경우는 이번 범위 밖.

## 4. 시험 · 도구 결과 (dev079 미러, 실제 실행)
- 새 시험 14개: `topicWordsQuality079`(9) · `task079Trace`(3) · `task079KatakanaReading`(2) — 전부 통과.
- 영향 받는 기존 시험 묶음(topicWords·topicDraft·prompts·task049TopicWordsSeam) 186개 통과.
- **전체 시험** `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')`: **4,551 중 통과 4,548 · 실패 0 · 건너뜀 3**(건너뜀은 기존). 1회차에 실패 1건(위 import 줄 시험)이 있었고 고친 뒤 2회차에서 0.
- `tsc --noEmit` 종료 0. eslint: 변경·신규 6개 파일 오류 0·경고 0. `eslint .` 전체는 기존 `tests/live/**` 의 54 오류로 종료 1(위 «불편한 사실»).
- 미러 `~/.node-local/thekaiwa-dev079` 는 `make-mirror.sh` 로 만들었다(NFS 에서 고치고 sync). 프로세스를 띄운 것은 시험 실행뿐이고 모두 종료됨. 포트·DB·LLM 사용 없음.

## 5. 한계 · Reviewer 가 볼 곳
1. **차단 목록 미탐**: JIS 표준 안에 있는 간체 모양(开 등)·번체 전용 글자는 못 잡는다. 오탐을 0 으로 만든 대가이며, 의도다. 더 잡으려면 «표준 밖» 이 아니라 “간체→번체 매핑 표” 가 필요한데 그건 일본어 한자와 겹치는 글자(国·学)를 따로 빼는 큐레이션이 되어 오탐 위험이 커진다.
2. **재내보내기**: `schemas.ts` 한 줄이 `topicWords.ts` import 줄 시험을 맞추려는 구조다. Leader 가 직접 import + 시험 정규식 확대를 원하면 `schemas.ts` 줄을 지우고 두 줄만 고치면 된다.
3. 병렬 경로(`topicDraftSchemas.ts` — 사용자 주제 기본 표현 12개 생성 검사)에도 같은 «한자 범위만 본다» 구멍이 있다. 이번 범위 밖이라 두었다 — 드리프트 시험(`topicDraft.test.ts:473`)이 A12 와 같은 표로 대조하므로, 넣으려면 두 곳을 같이 고쳐야 한다. 후속 후보.
4. 문서: `docs/design/challenge.md` §4-3a 등에 «항목 검사 사유 코드» 목록이 있다면 `SURFACE_SIMPLIFIED`·`EXAMPLE_JA_SIMPLIFIED` 두 코드가 늘었다(문서는 Leader 소관 — 수정하지 않음).
5. Reviewer 확인 제안: ⓐ `chineseOnlyHanzi.ts` 의 «규칙» 주석과 위 스크립트가 같은 결과를 내는지(Python 으로 2,275 재현) ⓑ `topicWordsQuality079` (b)·(c) 가 ICU 없는 Node 에서 빈 집합으로 헛통과하지 않는지(디코더 크기 단언이 막는다) ⓒ 읽기 정규화 위치가 `readingMatchesSurface` 뒤인지.
6. 배포 영향: 서버 코드만(검사 완화 없음, 강화 2건 + 표시 통일 1건). DB·화면·API 계약·네이티브 변경 없음. 정규화는 새로 만드는 단어에만 적용 — 이미 저장된 단어의 읽기는 그대로다(이관 없음).

## 6. 미커밋 파일
- 수정: `src/modules/conversation/prompts/topicWords.ts` · `src/modules/conversation/structuredResponse/schemas.ts` · `src/modules/learning/vocab/topicSet.ts`
- 새 파일: `src/modules/conversation/structuredResponse/chineseOnlyHanzi.ts` · `src/modules/conversation/__tests__/topicWordsQuality079.test.ts` · `src/modules/learning/__tests__/task079Trace.test.ts` · `src/components/common/__tests__/task079KatakanaReading.test.ts` · 이 기록
