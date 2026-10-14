---
task_id: task-068
title: "task-068 Prompt-Engineer 기록 — 선생님 초안(뜻 채우기)이 조각(chunkType)도 채운다 (wordEnrich@v2, D5 초안 뒤 ★ A)"
status: done
tags:
  - type/task-note
  - domain/vocab
  - domain/conversation
aliases:
  - task-068 pe
created: 2026-10-14
updated: 2026-10-14
---

# task-068 Prompt-Engineer 기록

본 이력서: [[task-068-improve-wordbook]] · 데모 근거: `docs/demo/task-068-wordbook-v1.html`(D4 B 규칙표·D5) · 설계자 기록: [[task-068-designer-record]] · 형식 선례: [[task-066-pe-record]]

## 계약 (S-B 가 읽는 곳 — 코드 파일은 내가 건드리지 않았다)

**프롬프트 버전 키**: `wordEnrich@v2` — 상수 `WORD_ENRICH_PROMPT_VERSION`(`src/modules/conversation/prompts/wordEnrich.ts`, `conversation/index.ts` 가 이미 re-export). `prompts:sync` 는 미구현이라 이 상수가 정본이다(task-066 기록과 동일).

**출력(JSON 객체 하나, `--json-schema` + ajv, `additionalProperties:false`)** — v1 에 `chunkType` 한 칸이 **필수 키**로 더해졌다:

| 칸 | 타입 | 허용 값 |
|---|---|---|
| valid | boolean | |
| invalidReason | string \| null | valid=false 일 때만 한국어 한 문장 |
| reading | string \| null | 히라가나+ー |
| meaning | string \| null | 한국어 뜻 |
| partOfSpeech | string \| null | NOUN VERB ADJ_I ADJ_NA ADVERB PARTICLE EXPRESSION OTHER |
| **chunkType** (신규) | string \| null | **NAME · ACTION · FEELING · MODIFIER · EXPRESSION** (라벨 이름·액션·느낌·꾸밈·표현) |
| jlpt | string \| null | N5~N1 또는 null |
| example / exampleKo | string \| null | |

- **valid=true 이면 `chunkType` 은 항상 5개 중 하나**(null 이면 후검증 `checkWordEnrichV2` 위반 → `completeJson` 이 재시도 1회, 그래도 위반이면 기존대로 `JsonSchemaError`). **valid=false 이면 `null`**(다른 사전 칸과 같음 — 「항상 5개 중 하나」는 유효 입력에 대한 말이다. 무효 입력(한국어·영어)에 조각을 억지로 고르게 하면 의미 없는 값이 생겨서 null 로 뒀다).
- 5개 밖 값·키 누락은 ajv 가 막아 서버 파서까지 오지 않는다. 그래도 파서는 **방어적으로 allowlist 로 읽고, 읽지 못하면 `null`**: `chunkType: out.valid && WORD_CHUNK_TYPES.includes(out.chunkType) ? out.chunkType : null`. 화면은 `null` 이면 조각을 미리 고르지 않고 사용자가 고르게 한다(폼은 조각 필수 — D5 A). `null` 허용은 이 방어용이다.
- **새 export(전부 `prompts/wordEnrich.ts` 안, `conversation/index.ts` 는 내 소유가 아니라 손대지 않음)**: `WORD_CHUNK_TYPES`(5유형 상수) · `WordChunkType` · `WordEnrichResponseV2` · `WORD_ENRICH_OUTPUT_SCHEMA` · `checkWordEnrichV2`. 필요하면 S-B 가 index 에 `WORD_CHUNK_TYPES`·`WordChunkType` 을 더한다. L3(`learning`)는 L2 를 import 할 수 없으니 `WordEnrichOutput` 에 `chunkType: ChunkType | null`(Prisma 타입, **S-A 가 `EXPRESSION` 을 스키마에 더한 뒤**)을 자체로 더한다.
- **지금 tsc 가 내는 오류 2곳(예상된 것)**: `src/app/api/v1/words/route.ts:32`, `src/app/api/v1/lessons/[id]/memo/route.ts:49` — `LlmJsonRequest<WordEnrichResponseV2>` ↔ `LlmJsonRequest<WordEnrichOutput>` 불일치. 거짓 타입으로 숨기지 않으려고 빌더 반환형을 정직하게 V2 로 뒀다. `WordEnrichOutput` 에 `chunkType` 을 더하면 해소된다(그 필드는 어차피 draft 로 흘려야 한다).
- **옛 응답·캐시 호환**: ① `learning/vocab/enrich.ts` 의 초안 캐시는 프로세스 메모리(키 = 표현+수준, TTL 24h)라 blue/green 배포로 프로세스가 바뀌면 비워진다 — DB 에 보강 응답은 저장되지 않는다(사용자가 확인한 뒤 폼으로 저장하는 값만 `WordEntry` 로). ② 같은 프로세스에 v1 때 쌓인 항목이 남는 경우만 대비해 **`hit.draft.chunkType === undefined` 면 캐시 미스로 취급**하거나 캐시 키에 버전을 넣는 것을 권한다. ③ `toDraft` 는 필드를 하나씩 옮기므로 `chunkType` 을 **명시적으로 옮겨야** 한다(안 옮기면 조용히 사라진다 — 컴파일 오류도 안 난다). ④ **레슨 메모 경로**(`lessons/[id]/memo/route.ts` 가 같은 `enrichWord` 를 쓴다)도 이제 `chunkType` 이 딸려 온다 — `memoDraftFromEnrich` → TutorProposal 페이로드에 실을지는 S-B/Leader 결정(권고: 선택 칸으로 실어 두고, 이미 만들어진 옛 제안은 칸이 없으니 채택 시 `null`).
- 화면 문구: 초안이 채운 조각은 「선생님이 고른 조각이에요」+ 사용자가 바꿀 수 있음(데모 D5 초안 뒤 A).
- 경로: `LLM_TASKS.wordEnrich`(fast 티어, 20s, interactive) 그대로 — 실측 지연 p50 2.9s·p95 6.7s(재시도 포함)라 예산 안. home-m4(qwen) 경로로는 **재지 않았다**(Claude CLI 만).
- **J12 확인**: 교정·수업·평가·주제·시나리오·질문 프롬프트의 조각 enum 은 4유형 그대로이고 `EXPRESSION` 은 이 프롬프트의 스키마에만 있다(시험으로 고정 — 아래).
- 롤백: `WORD_ENRICH_PROMPT_VERSION='wordEnrich@v1'` + `jsonSchema` 를 `schemas.ts` 의 `WORD_ENRICH_SCHEMA`, `extraCheck` 를 `checkWordEnrich` 로, 지시문의 `chunkType` 줄 1개·「…partOfSpeech·chunkType·…」 두 곳을 되돌린다. S-B 가 `chunkType` 에 기대고 있으면 그쪽 파서가 `null` 로 읽으므로 화면은 사용자가 고르는 방식으로 돌아간다.

## 수정한 파일 목록 (고정)
- `src/modules/conversation/prompts/wordEnrich.ts` — 버전 `wordEnrich@v1`→`@v2`, `WORD_CHUNK_TYPES`·`WordEnrichResponseV2`·`WORD_ENRICH_OUTPUT_SCHEMA`(v1 스키마를 물려받아 `partOfSpeech` 다음에 `chunkType` 필수 키)·`checkWordEnrichV2`, 지시문 `chunkType` 줄 1개 + 기존 두 줄에 `chunkType` 한 단어씩, 빌더 반환형 V2. `schemas.ts`(structuredResponse)·`checks.ts` 는 **건드리지 않았다**(편집 소유 밖 — 그래서 v2 스키마를 이 파일에서 v1 위에 얹었다).
- `src/modules/conversation/__tests__/wordEnrich.test.ts` — v2 로 갱신(+5건: 버전·5유형, 필수 키, v1 파생, 후검증, 지시문), 길이 상한 1,500→2,000자.
- `src/modules/conversation/__tests__/wordEnrichChunk.test.ts` — **새 파일**(11건): 조각 픽스처 구조 5 + J12 6.
- `src/modules/conversation/__tests__/task037.test.ts` — `wordSlip()` 응답에 `"chunkType":"NAME"` 한 칸(옵트인 안 한 요청의 「복구 안 함」 증명이 v2 스키마에서도 빈 증명이 되지 않게 — 슬립 복구 후 문서가 스키마를 통과해야 의미가 있다).
- `tests/prompts/fixtures/word-enrich.json` — v2: 유효 9건에 `expectedChunkType`.
- `tests/prompts/fixtures/word-enrich-chunk.json` — **새 파일**: 채점 25 + info 3 + 무효 2 + 측정 기준선(baseline).
- `tests/prompts/word-enrich-chunk-live.ts` — **새 파일**: 라이브 하네스(DB 0·직렬·누적 호출 상한 40 파일 기록·한도 신호/연속 실패 시 중단·`REPEAT`·`INVALID`).
- (기록) 이 파일. `tests/live/word-enrich-measure.ts`(옛 12건 측정기)는 손대지 않았다 — 조각 칸을 안 읽는다.

## Prompt-Engineer 기록
- [13:14 완료] 착수 → v2 설계 → 시험 → 라이브 38회 → 변이 7종 → 전체 conversation 시험 1,193/1,193.
- [읽은 것] 이력서 task-068 전체(D4·D5·J12), designer 기록, 데모 D4 규칙표·D5 문구, `prompts/wordEnrich.ts`·`structuredResponse/{schemas,checks}.ts`, `learning/vocab/enrich.ts`(읽기만 — `WordEnrichOutput`·`toDraft`·캐시), 두 호출 라우트, 기존 시험·픽스처·라이브 하네스(task-008 `word-enrich-measure.ts`, task-064 `ask-measure.ts` 의 DB 0 스텁 방식), 시드 7,755행의 품사×조각 교차표.
- [정의 문구 출처] 네 유형 = `tutor.md` §5 조각 프레임 그대로(이름=명사·대명사·명사구 / 액션=동사구 / 느낌=형용사·감정·평가 / 꾸밈=부사·수식·조사구·시간·장소), 표현 = 데모 D4 B 「문장 밖에서 통째로 쓰는 말(인사·대답·감탄·이음말)」, 동작성 명사 = 데모 D5 「勉強·準備 같은 명사도 액션」(의뢰서가 挨拶 추가). 의뢰서 괄호의 「상태」「접사·조사류」는 느낌·꾸밈 줄에 합쳤다. 프롬프트 지시문은 한 줄이고 **few-shot 예시는 넣지 않았다**(스키마 enum 이 강제, 규칙 정의만 — EXPRESSION 예시 おはよう・そうですか・それでは 만 보류 집합 밖 낱말로 넣음).
- [사실 — 시드가 보여 준 것] 기존 분류는 품사로 안 갈린다: NOUN 5,197 중 이름 3,309·**액션 1,341**·꾸밈 424·느낌 122, VERB 의 77은 느낌, ADJ_I 의 38은 꾸밈(高い·新しい 같은 속성), ADJ_NA 는 느낌 262 : 꾸밈 171. 그래서 정의는 「품사가 아니라 쓰임으로 고른다」를 명시했다. 형용사 속성/감정 경계(高い 등)는 시드도 갈려 점수에서 뺐다(info).
- [프롬프트 길이] A10 시험식 렌더(시스템+메시지+페르소나) v1 1,423자 → **v2 1,731자(+308자)**, 스키마 JSON 까지 실린 실제 CLI 입력 `promptChars` 2,806자(`withJsonOnly` 포함). 단어 보강은 대화 턴이 아니라 A1 3,000자 규칙 대상이 아니고 지연 영향은 실측으로 확인(아래).
- [라이브 실측 — 전용 미러 `~/.node-local/thekaiwa-pe068`, fast 티어(haiku)·Claude CLI·직렬·DB 접촉 0, **호출 38/40**]
  | 실행 | 호출 | 내용 |
  |---|---|---|
  | r1 (첫 패스) | 29 | 채점 25 + info 3 = 28행, 1회 재시도(c19 様: example 에 표기 없음 — **v1 규칙이지 chunkType 위반이 아님**) |
  | r1s-a/b (안정성) | 7 | でも×3, 様×2, 挨拶×2 |
  | r1x (무효 입력) | 2 | 사과·apple |
  **첫 패스 일치 24/25 (96%)** — 합격선 22/25 통과. 지시문에 예로 적힌 3개(勉強·準備·挨拶)를 뺀 **보류 22개는 21/22**. 동작성 명사 5개(勉強·準備·挨拶·運動·買い物) **5/5**(품사는 모두 NOUN 인데 ACTION), 이름 5/5, 느낌 4/4, 꾸밈 5/5(첫 패스 — 様 은 재호출에서 흔들림), 표현 4/5. 지시문에 없는 動作性 명사 運動·買い物도 맞아 일반화는 확인됐다. info 3: 高い→FEELING, 電話→NAME, 仕事→NAME(허용 범위 안 — 점수 제외).
  **틀린 단어 2개와 이유**
  1. **でも (표현 기대 → MODIFIER, 4/4 모두 같은 오답 — 체계적)**. 모델은 品詞를 PARTICLE 로 보고 「조사류 = 꾸밈」 줄로 간다(뜻은 「하지만, 그래도, 아무튼」으로 맞게 적는다). 시드 품사는 EXPRESSION 이라 D4 규칙표(이음말 → 표현)와 어긋난다. 이음말 중에서도 **でも 처럼 조사로도 쓰이는 낱말**에서만 생길 가능성이 크고(첫 패스의 다른 표현 4개는 4/4) 사용자가 칩을 바꿀 수 있어 위험은 낮다. 고친다면 「이음말」에 「접속사(문장 앞에서 앞 말을 잇는 말)」를 덧붙이고 「조사류」를 「조사」 대신 「문장 속에서 붙는 조사」로 좁히는 안이 있으나, 지금 측정한 문구가 곧 출시본이어야 해서 **이번에는 고치지 않았다**(고치면 25단어 전체를 다시 재야 하는데 남은 호출이 2회).
  2. **様 (꾸밈 기대 → 1/3 만 MODIFIER, 2/3 NAME)**. 단독 표기가 접사 「님」과 명사 「모양·방식」 둘 다라 모호하다(시드에도 `様` 이 N3 명사(이름)·N1 기타(접사)로 둘이 있다). 기대표를 접사로 둔 것은 데모 D4 규칙 5 를 따른 것. 점수 방어용으로 바꾸지 않았다.
  **다수결(낱말별 최빈값)로 보면 23/25** — 첫 패스 24/25 는 운이 따른 1건(様)을 포함한다. 합격선(22)은 두 방식 모두 넘는다.
  **계약**: 무효 입력 2건 모두 `valid=false`·`chunkType=null`·위반 0. 38회 중 chunkType 로 인한 1차 위반 0, 최종 실패 0, 엔진명 누출 0, valid=true 인데 chunkType 없음 0. 지연 p50 2.9s·p95 6.7s(재시도 1건 포함)·max 6.8s.
- [시험 — 미러에서] `wordEnrich.test.ts` 15건 + `wordEnrichChunk.test.ts` 11건 + `task037.test.ts` 모두 통과. **`src/modules/conversation` 전체 `*.test.ts` 1,193건 중 1,193 통과**(`--test-concurrency=1`, `DATABASE_URL` 무효값). eslint(바꾼 6파일) exit 0. `tsc --noEmit` — 내 파일 오류 0, **예상된 2곳**(위 계약)만 내 변경으로 생김(그 밖의 오류는 prisma 생성물이 낡은 미러에서 다른 작업이 만든 것 — `userSeedOverride`·`exampleSnap` 등, 내 변경과 무관).
- [변이 7종 — 각각 정확한 시험이 잡음, 미러에서만 고치고 되돌림] ① `CHUNK_TYPES` 에 EXPRESSION 추가 → J12 스키마 시험·5유형 시험·소스 스캔 3건 FAIL ② `prompts/lesson.ts` 에 `chunkType … EXPRESSION` 줄 → 소스 스캔 FAIL ③ `tutor.md` 에 EXPRESSION → 페르소나 시험 FAIL ④ `chunkType` 을 required 에서 뺌 → 필수 키·v1 파생 시험 FAIL ⑤ valid=true 후검증 삭제 → 후검증 시험 FAIL ⑥ 5유형에서 EXPRESSION 삭제 → 5건 FAIL ⑦ 지시문 `chunkType` 줄 삭제 → 지시문 시험 FAIL. 검사기 자체의 빈 증명 방지 시험(변이 줄/enum 을 주입해 잡는지)도 2건 있다. 그리고 J12 스키마 스캔은 `FOUR` 를 **리터럴**로 고정했다(`CHUNK_TYPES` 에서 계산하면 상수가 바뀔 때 기대값도 같이 바뀌어 1차 변이에서 놓쳤던 것을 고침).
- [J12 구조] `structuredResponse/`·`prompts/` 의 모든 모듈(25+)이 내보내는 값과 `buildEval*Schema` 호출 결과(WORDS·TALK)를 훑어 NAME·ACTION 을 가진 문자열 배열이 **전부 정확히 4값**인지 확인하고(발견 6곳 이상을 하한으로 둠 — 빈 증명 방지), wordEnrich 모듈만 따로 5값을 확인한다. 같은 폴더 소스에서 한 줄에 `chunkType` 과 맨 낱말 `EXPRESSION` 이 같이 있는 곳이 없음(기준선 0건)도 확인. 그리고 `corrections/drawer.ts` 에 이미 「EXPRESSION 은 단어 전용, J12」 주석과 4유형 집합이 들어 있다(다른 사람 작업) — 그 파일은 시험에 넣지 않았다(진행 중인 파일).

## 남은 일 / 다음 첫 행동
- **S-B**: `WordEnrichOutput` 에 `chunkType` + `toDraft` 에서 옮기기(allowlist, 못 읽으면 null) + 캐시 `undefined` 미스 처리 + (선택) 메모 제안 페이로드. 두 라우트 tsc 오류가 해소되는 것이 신호.
- **designer/Leader**: `docs/design/api-contract.md` #41 의 draft 필드 목록에 `chunkType` 이 빠져 있다(`reading/meaning/partOfSpeech/jlpt/example/exampleKo`) — 계약 문서 갱신(내 소유 아님). `design-spec.md` §8 A10 행의 프롬프트 버전·길이(v2, 1,731자)도 같이.
- **QA(선택)**: 실제 앱에서 勉強·準備(동작성 명사)를 뜻 채우기로 눌러 「액션」이 미리 골라지는지, でも·様 처럼 모호한 낱말에서 사용자가 칩을 바꿀 수 있는지 확인. 라이브 호출은 기준선과 같은 25단어(`word-enrich-chunk-live.ts`)를 쓰면 되고, 남은 호출 예산은 이번 task 한도(40) 중 2회다.
- **내가 안 한 것**: home-m4(qwen) 경로 실측 · 25단어 재측정(문구를 고치지 않았으므로 불필요) · `docs/*`·`learning/**`·라우트·화면 · git·배포·DB.
