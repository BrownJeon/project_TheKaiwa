# 시드 데이터 출처·라이선스

## JLPT 단계별 기본 단어 — `prisma/seed-data/jlpt/{n5,n4,n3,n2,n1}.json`

> **이 다섯 파일은 CC BY-SA 4.0(Creative Commons Attribution-ShareAlike 4.0 International) 으로 배포한다.**
> CC BY-SA 4.0 데이터(OpenJLPT·JMdict)에서 파생했기 때문이다(동일조건 변경허락). 라이선스 전문: https://creativecommons.org/licenses/by-sa/4.0/
> 이 라이선스는 이 다섯 파일에만 해당하며, 저장소의 다른 파일(앱 코드·`words-n5.json` 등)의 라이선스를 바꾸지 않는다.

**비공식 목록 — JLPT 공식 어휘 목록이 아니다.** JLPT 주최 측(국제교류기금·JEES)은 2010년 개정 이후 급수별 어휘 목록을 공개하지 않는다
(https://www.jlpt.jp/e/faq/ — "Why is 'Test Content Specifications' no longer available after the 2010 revision of the JLPT?").
여기의 급수(N5~N1)는 아래 공개 자료가 추정한 값이다. 앱 화면의 단계 이름(초보자·초급·중급·고급·최상급)은 이 급수를 1:1 로 옮긴 표시 이름이다.

### 사용한 자료

| 자료 | 만든 이 | 라이선스 | 이 파일에서 쓴 것 |
|---|---|---|---|
| **OpenJLPT** v0.3.0 — https://github.com/evanclan/OpenJLPT (`data/json/vocab/n{5,4,3,2,1}.json`, 트리 `ada3a00c1f4300efb3fa4cac6ab46b0bbb7a789d`, 2026-10-10 받음) | evanclan | **CC BY-SA 4.0** — 저장소 `NOTICE.md`: "Because it incorporates data licensed under CC BY-SA 4.0 (a share-alike license), the entire OpenJLPT dataset is released under CC BY-SA 4.0" · "Distribute any derivative dataset under CC BY-SA 4.0 (ShareAlike)" | 표기(`word`)·읽기(`reading`)·단계(`level`)·품사태그(`pos`)·영어 뜻(`meanings`, 생성 입력으로만)·항목 순서 |
| **JLPT 급수별 어휘 목록** (OpenJLPT 의 급수 배정 출처) — https://www.tanos.co.uk/jlpt/ (현재 접속 불가). 보관본: https://web.archive.org/web/2023/http://www.tanos.co.uk/jlpt/jlpt5/ · 라이선스 문구 보관본: https://web.archive.org/web/2023/http://www.tanos.co.uk/jlpt/sharing/ | Jonathan Waller (Tanos) | **CC BY** (버전 미명시) — "Everything on this site (that I'm not selling), is licenced under Creative Commons "BY". … use anything here however you like (commercial or non-commercial), but credit my site." (보관본 「Updated: October 12, 2011」) | OpenJLPT 를 거쳐 표제어 목록·급수 |
| **JMdict** (OpenJLPT 의 읽기·품사·영어 뜻 출처) — https://www.edrdg.org/jmdict/j_jmdict.html | Electronic Dictionary Research and Development Group (EDRDG) | **CC BY-SA 4.0** — https://www.edrdg.org/edrdg/licence.html | OpenJLPT 를 거쳐 읽기·품사태그·영어 뜻 |

- **쓰지 않은 것**: OpenJLPT 가 함께 싣는 Tatoeba 예문(CC BY 2.0 FR)은 **쓰지 않았다** — 입력에도 넣지 않았고 예문은 새로 생성했다. KANJIDIC2·문법 데이터도 쓰지 않았다.

### 가공 내용 (변경 표시 — CC BY-SA 4.0 §3(a)(1)(B))

1. OpenJLPT 의 표기·읽기는 **그대로** 옮겼다(바꾸지 않음). 단계 안 항목 순서도 OpenJLPT 순서를 유지했다.
2. **한국어 뜻(`meaning`)·품사(`partOfSpeech`)·조각 유형(`chunkType`)·일본어 예문(`example`)·한국어 번역(`exampleKo`)은 AI(Claude)가 생성**했다.
   입력은 공개 사전 데이터(표기·읽기·JMdict 품사태그·영어 뜻)뿐이다. 생성 도구·프롬프트·검사 규칙: `scripts/seed-build/`(README 에 재현 절차).
3. 자동 검사(`scripts/seed-build/validate.ts`)를 통과하지 못한 항목, AI 가 뜻·예문을 확신하지 못한 항목(원본의 드문 표기-읽기 짝 포함)은 **넣지 않았다** —
   그래서 단계별 개수가 OpenJLPT 원본 수(674·630·1,659·1,778·3,070)보다 적을 수 있다. 실제 개수는 `src/types/seedPackCounts.ts`.
4. 사람 검수는 **표본만** 했다(단계별 무작위 30~40개, `agent-vault/10-Flow/tasks/task-051-sample-review.md`). 나머지 항목의 뜻·예문에는 오류가 남아 있을 수 있다.
5. 형식: 레코드마다 7필드(`surface·reading·meaning·partOfSpeech·chunkType·example·exampleKo`), 한 줄에 한 레코드.

### 표기 의무를 지키는 곳

- 저장소: 이 파일.
- 앱: 설정 화면 맨 아래 「단어 자료 출처」 줄(사용자 결정 2026-10-10, task-051).
- 이 파일들을 다시 배포하거나 고쳐서 배포하면 같은 CC BY-SA 4.0 으로 두고, 위 출처 표기와 변경 표시를 함께 옮겨야 한다.

> 이 문서는 법률 판단이 아니다. SA 조항의 「배포」 범위 해석은 사용자 결정(2026-10-10, task-051 「사용자 결정」)으로 기록돼 있다.

## 그 밖의 시드

- `words-n5.json`(기존 기본 단어 50개), `topics.json`·`scenarios.json`·`lexicon.json`·`voices.json`·`engines.json`: 이 프로젝트에서 직접 작성한 데이터(외부 목록에서 가져오지 않음, task-002 이후).
