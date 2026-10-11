---
task_id: task-056
role: prompt-engineer
tags:
  - type/pe-record
  - domain/conversation
  - domain/improvement
aliases:
  - task-056 prompt-engineer 기록
created: 2026-10-11
updated: 2026-10-11
---

# task-056 — Prompt-Engineer 기록 (회화방 일본어 도우미 `phraseHelp@v1`, API #180)

> 본 이력서 [[task-056-improve-talk-phrase-helper]] · 화면 쪽 [[task-056-designer-record]](+ `docs/screens.md` §22). 이 파일만 prompt-engineer 가 쓴다. 라우트·화면·`src/types/chat.ts`·`api-contract.md`·`tasks.ts` 는 건드리지 않았다.
> **상태: 프롬프트 모듈·JSON 계약·픽스처·시험 완료(DONE) — developer 인계 가능.** Leader 가 이 파일로 `api-contract.md` #180 행을 쓰고 judge C1 에 넘긴다.

## 0. 체크포인트 (신규 소환 1회차 — 앞선 소환이 100턴에서 끊김)
- [19:05] 작업 트리 확인 · 「선생님 마지막 말을 빼는 방향」은 **이미 코드에 반영돼 있었음**(입력 타입에 자리 자체가 없음, 시험 「맥락은 역할극 장면 한 줄뿐…」 이 잠금). 저장된 앞선 실측 결과 파일은 없어 이번에 재측정.
- [19:20] 전용 미러 sync → phraseHelp 22/22 · eslint 0 · tsc(내 파일 4건 타입 오류 수정). 실호출 배치로 튜닝 시작.
- [19:50] **최종 확정** — 아래 §1~§9. 마지막 실행: conversation 모듈 전체 시험 914/914, eslint 0, tsc 내 파일 0건(§7).
- 끊겼다면 다음 첫 행동: 없음(완료). Leader 몫 = §10.

## 1. 한 줄 결론 [확실]
회화방(일반·역할극)에서 학습자가 한국어로 `queryKo`(1~100자)를 보내면 → `fast`(haiku) 12초로 일본어 표현 1~3개(`ja`/`ko`/`labelKo?`/`whyKo?`)를 돌려준다. **저장 없음**, 맥락은 **수준 + (역할극일 때) 장면 한 줄**뿐, 질의·답 원문은 로그·Trace 에 남지 않는다.

## 2. 최종 계약 — 요청·응답 (api-contract #180 행의 재료)

### 요청 `POST /api/v1/chats/:id/phrase-help` — 본문 ≤1KB
```json
{ "queryKo": "string, 정리(trim·보이지 않는 글자 제거·공백 접기) 뒤 1~100 코드포인트, 한글 음절 ≥1" }
```
- 그 밖 키는 400 `unknown_key`. 화면이 막는 것은 빈칸·101자뿐이고 아래 사유는 서버가 막는다.
- **본문 검사는 LLM 앞** — `parsePhraseHelpBody(body)` 가 `{ok:true,value:{queryKo}}` 또는 `{ok:false,problems[]}`(문제를 한 번에 모음). 라우트는 `problems[0]` 을 `ApiError('VALIDATION', message, {field:'queryKo'|'body', reason})` 로 바꾼다(#166·#176·#178 와 같은 400).

| reason | 언제 | message(그대로 화면에 보여도 되는 한국어) |
|---|---|---|
| `type` | 본문이 객체가 아니거나 `queryKo` 가 글이 아님 | 요청 형식이 올바르지 않아요. / 하고 싶은 말은 글이어야 해요. |
| `required` | 없음·null·정리 후 빈 글 | 하고 싶은 말을 한국어로 써 주세요. |
| `max_length` | 101자 이상 | 하고 싶은 말은 100자까지 쓸 수 있어요. |
| `forbidden_char` | 꺾쇠 `< >`(전각 포함)·URL·남은 숨은 글자 | 꺾쇠(< >)는 쓸 수 없어요. / 인터넷 주소는 넣을 수 없어요. / 쓸 수 없는 글자가 있어요. |
| `no_text` | 글자·숫자가 하나도 없음(기호뿐) | 글자를 적어 주세요. |
| `no_hangul` | 한글 음절 0개(영문·일본어·자모뿐) — **LLM 을 부르지 않는다** | 하고 싶은 말을 한국어로 써 주세요. |
| `secret_like` | 키·비밀번호 모양 | 비밀번호·키처럼 보이는 글은 넣을 수 없어요. |
| `unknown_key` | `queryKo` 외 키 | 넣을 수 없는 항목이에요: {키} |

### 응답 200 — `{ "items": PhraseHelpItem[] }` (거절·못 찾음도 200 `{items: []}`)
```ts
// src/modules/conversation/structuredResponse/phraseHelp.ts  (PhraseHelpItem)
interface PhraseHelpItem {
  ja: string       // 필수. 한자·가나·숫자·문장부호(。、？！)만. 한글·괄호·따옴표(「」 포함)·슬래시·줄바꿈 없음. ≤100자, ≤3문장. 읽기(가나)는 안 준다 — 화면이 #24r 로 만든다.
  ko: string       // 필수. ja 의 한국어 뜻. 한글만(가나·한자 없음) ≤120자.
  labelKo?: string // 선택. 항목이 2개 이상일 때만, ≤8자("정중하게"·"편하게"·"더 공손하게"·"짧게"·"다른 표현").
  whyKo?: string   // 선택. 첫 항목 위주 한 줄, ≤60자. 한글, 일본어 낱말은 「」 안에만(≤30자).
}
// items: 1~3개, 첫 항목 = 가장 권하는 표현. status 가 OK 가 아니면 [].
```
- 화면이 쓰는 칸과 일치: designer §3 의 `items[1..3].{ ja, ko, labelKo?, whyKo? }` — 이름·선택성 그대로. `messageId`·`reading`·`id` 칸은 없다.
- **거절 사유는 구분해 알리지 않는다**(우회 시도를 돕지 않게): `NOT_A_PHRASE`(문법 설명·AI 에게 시키는 일·잡담)·`UNSAFE`(폭력·성적·사기·지시 바꾸기)·`TOO_LONG`(전 항목이 길이 초과)은 모두 200 `{items: []}` → 화면 `hp-none`(「이 말에 맞는 일본어를 찾지 못했어요.」).
- 쓸 수 있는 항목이 하나도 없으면(`INVALID`, 재시도 뒤에도) 502.
- 서버 보정(항목 단위): `ja`/`ko` 가 규칙 밖이면 **그 항목만** 버림, `labelKo`/`whyKo` 는 **그 칸만** 버림(항목 유지). 중복(가나·부호·공백 제거 후 같은 말)은 뒤 항목 버림. 3개 초과는 앞 3개.

### 모델 쪽 스키마 (`PHRASE_HELP_SCHEMA`, 엔진이 ajv 로 검증)
```json
{ "type":"object","additionalProperties":false,"required":["status","items"],
  "properties":{ "status":{"enum":["OK","NOT_A_PHRASE","UNSAFE"]},
    "items":{ "type":"array","maxItems":4,
      "items":{ "type":"object","additionalProperties":false,"required":["ja","ko"],
        "properties":{ "ja":{"type":"string","minLength":1,"maxLength":160},
                       "ko":{"type":"string","minLength":1,"maxLength":200},
                       "labelKo":{"anyOf":[{"type":"null"},{"type":"string","minLength":1,"maxLength":40}]},
                       "whyKo":{"anyOf":[{"type":"null"},{"type":"string","minLength":1,"maxLength":200}]} } } } } }
```
스키마는 구조만 본다(느슨한 상한). 정확한 한도·글자 종류는 코드(`fitPhraseHelp`)가 항목 단위로 본다 — 한 항목 때문에 응답 전체를 다시 부르지 않는다. 요청 옵션 `stripAdditionalProperties: true`(스키마 밖 키는 지우고 통과). 읽기·speaker·model·pitch 를 모델이 내는 칸은 없다.

### 한도 표 (`PHRASE_HELP_LIMITS`, 지시문·스키마·보정이 같은 값 — 시험이 잠금)
| 칸 | 값 | 비고 |
|---|---|---|
| `queryKo` | 1~100자 | 화면 `HELPER_MAX=100` 과 같음 |
| 장면 역할 이름 / 목표 | 12자 / 60자 | 입력 단계에서 자름 |
| `ja` | ≤100자·≤3문장 | **이번 소환에서 70→100**(§8-③) |
| `ko` | ≤120자 | **80→120**(§8-③) |
| `labelKo` / `whyKo` | ≤8자 / ≤60자(지시는 45자, 여유 15) | 모델이 지시를 10~20자 넘기는 경향 → 지시 `whyAsk=45` |
| 로마자 | ≤6자, 질의에 있던 낱말만 | `PWNED` 같은 주입 흔적 차단 |
| 모델이 내는 항목 | ≤4개(스키마) → 3개 | |

## 3. 맥락 입력 — 최종 결정 [확실]
`PhraseHelpInput = { queryKo, level?, scene?: { learnerRole, partnerRole, goalKo? } }` — 이것이 전부다.
- **수준**: `[수준]` 줄 하나(N5~N1 별 한 줄, 없으면 「일상 회화의 쉬운 말」). 어휘·문형을 「먼저 고르는 범위」일 뿐 하고 싶은 말이 수준 밖이어도 뜻이 우선.
- **장면**: 역할극 방일 때만 한 줄(`장면: 내 역할 손님 · 상대 역할 점원 · 목표 …`). 두 역할이 모두 있을 때만 붙는다. 용도는 **낱말 뜻·말투를 고르는 참고**(같은 「봉투」가 편의점=袋·우편=封筒, 상대가 친구면 편한 말)뿐이고 학습자가 적은 뜻을 바꾸거나 목표를 대신 말해 주는 데는 쓰지 않는다. 일반 회화방은 장면 없음.
- **넣지 않는 것**: 선생님 마지막 말, 이전 대화, 학습자 이름·프로필·기록, 원음. 입력 타입에 자리가 없고 시험 「맥락은 역할극 장면 한 줄뿐…」 이 `lastTutorJa`·`history`·`learnerName` 을 몰래 넘겨도 무시됨을 잠근다.
- **근거**(앞선 소환의 실측 — 코드 머리 주석, 저장된 원자료 없음 — + 이번 소환의 장면 효과 재확인): haiku 같은 10입력×2회에서 마지막 말을 함께 주면 모델이 질의를 「그 말에 대한 대답」으로 바꿔 써 낱말 20→18/20·말투 20→18/20 로 나빠졌고 얻은 것이 없었다. 장면 자체는 효과가 크다(편의점 장면에서 「봉투」 → 袋 2/2, 장면 없으면 封筒). 이번 소환 재측정 전체(문구 변형 포함 15회씩)에서도 c07(편의점 봉투) 15/15 에서 袋(封筒 0회), c08(친구 장면 「오늘 뭐 해?」) 15/15 첫 후보가 편한 말투(`register` 휴리스틱).
- 화면 문구는 맥락 사용을 약속하지 않는다(designer §22-9 와 일치) — 장면이 없어도 같은 계약으로 동작.
- 서버가 장면을 만드는 법(developer): `chat.scenarioId` 가 있고 상황 재료를 읽을 수 있으면 `scene = { learnerRole: material.roles.learner, partnerRole: material.roles.tutor, goalKo: material.goal.communicativeGoalKo }`. 재료가 없거나 읽지 못하면 **404 로 막지 말고 장면 없이 진행**(도우미는 장면에 의존하지 않는다 — #169 와 다른 점). 수준은 `chat.level ?? (await getProfile(userId)).level`(#169 와 같음).

## 4. 오류 매핑·한도 제안 (Leader 확정 사항)

| 상태 | 제안 | 화면(designer §22-9) |
|---|---|---|
| 400 `VALIDATION` | §2 표 8개 reason. **한도 미소모**(DB 안 읽음, #169 선례) | 안내 줄에 message |
| 401 | 세션 없음 | 기존 |
| 404 | 남의 대화·없는 대화·`kind !== 'TALK'` — `(id, userId)` 로만 조회 | `hp-error` |
| 409 `ENDED` | 마친 역할극(`chat.endedAt` 또는 `isScenarioRolePlayEnded`) | 판 닫고 마친 방 처리 |
| 409 `TURN_RUNNING` | **권고: 두지 않는다**(§10-1) | — |
| 409 `PHRASE_BUSY` | 선택. 사용자당 동시 1건(프로세스 메모리, `PRACTICE_BUSY`·`DRAFT_BUSY` 선례). 화면은 요청 중 재요청을 막으므로 두 탭·두 기기일 때만 도달 → 화면은 `hp-error` 로 읽으면 됨 | `hp-error` |
| 429 | 분당 **10**·하루 **300**(키 `phrase-help:<uid>`·`phrase-help-day:<uid>`, #169 와 같은 값). 단일 직렬 CLI 큐라 상한 자체보다 「사용자당 동시 1건」이 실질 방어선 | `hp-rate` |
| 502 | `INVALID`(재시도 뒤에도 쓸 수 있는 항목 0)·엔진 오류·사용 불가(422→502, #169 `engineFailure` 와 같게) | `hp-error` |
| 504 | 엔진 12초 | `hp-timeout` |
- 응답 헤더 `Cache-Control: private, no-store`. 저장·`StudyLog`·`StatsSnapshot`·`RepetitionItem`·단어장 행 **0**(제안만 — 화면의 [입력창에 넣기]는 입력창 채움일 뿐).
- 화면 12초: 엔진 `timeoutMs` 는 **실행 시간**만 센다(큐 대기 제외, tasks.ts 주석). CLI 큐가 전체 직렬(`concurrency 1`)이라 도우미가 회화 턴 뒤에 서면 화면이 먼저 12초에 끊을 수 있다 → 화면의 `AbortController` 12초가 총 상한 [확실, 코드 `claudeCli.ts` pump 확인].

## 5. 로그·`RequestTrace` — 원문이 남지 않는 지점 [확실]
- **응답 검사 문구는 전부 고정 문장**(`PROBLEM_TEXT`): 엔진이 1차 위반을 `console.warn('[json] 1차 응답 계약 위반 …')` 로 찍고 최종 실패 예외 메시지에도 싣기 때문에 질의·모델 출력 조각이 들어가면 안 된다. 시험 「모든 위반 문구는 고정 문장이다」 가 비밀 질의·일본어·`PWNEDX` 가 어떤 위반 문구에도 없음을 잠근다.
- **`phraseHelpTrace(fin)`** 가 Trace 단계에 싣는 값은 코드·숫자뿐: `{ outcome, itemsRaw, itemsKept, itemsDropped, labelDropped, whyDropped, firstJaChars, dropReasons(코드 목록) }`. ja·ko·이유·질의 원문 0. 시험 「Trace 수치: 코드·숫자·판 이름뿐이다」 가 JSON 직렬화에 원문이 없음을 잠근다.
- 서비스(developer)가 `steps.push({ name: 'PHRASE_HELP', ms, connection, model, attempts, promptChars, ...phraseHelpTrace(fin) })`, `recordTrace({ kind:'TURN', refType:'phraseHelp', refId: chatId, … })`. 에러 단계는 `{ name:'PHRASE_HELP', ms, errorCode }`.
- 엔진 `[claudeCli] 완료 — task=… promptChars=… elapsed=…` 로그에는 본문 없음(측정 중 확인). 지시문은 엔진명·speaker·model_id·connectionId 를 싣지 않는다(시험 「라이브 입력 54건 전부 만들어지고…」 가 54건 전부 확인).
- 브라우저 쪽(designer): 질의 초안·결과는 저장소에 안 남기고 `kaiwa.talk.helperTipSeen='1'` 하나뿐.

## 6. 모델 권고와 근거 [확실 — 아래 실측]
**권고: `fast`(haiku) · 12초 · interactive 레인 · 재시도 없음** — `engine/router/tasks.ts` `LLM_TASKS` 에 developer 가 추가:
```ts
// 회화방 일본어 도우미(task-056 #180, phraseHelp@v1) — 12s fail-fast, 재시도 없음. 저장 없음.
phraseHelp: { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' },
```
시험 「LLM_TASKS pin」 이 등록 뒤 이 값을 잠그도록 이미 들어 있다(등록 전에는 건너뜀). 모델 이름은 코드에 없다(tier→모델은 connection `modelByTier`).

실측(실제 Claude CLI 구독, 직렬 호출, 호출 간 0.8초, 합성 입력만, DB 미접속 스텁 연결, 12초 상한):

| 구성 | 호출 | 1차 통과 | 최종 실패 | hard 위반 | 지연 p50 / p95 / max |
|---|---|---|---|---|---|
| **최종 프롬프트·fast** 일반·경계 12입력×2 | 24 | 23/24 | 0 | 0 | 3.7s / 6.1s / 8.1s |
| 최종·fast 거절 11 + 일반·경계 9 | 20 | 19/20 | 0 | 0 | 2.7s / 6.0s / 8.8s |
| 최종·fast 긴 질의 3입력×3(74~93자) | 9 | 9/9 | 0 | 0 | 5.0s / 6.2s / 6.2s |
| **최종 합계** | **53** | **51/53 = 96.2%** (위반 3.8% ≤ 5% ✓) | **0/53** | **0** | 한 번이라도 재시도한 호출은 6~10초 |
| 참고: balanced(sonnet), 이전 문구, 12입력 | 12 | 11/12 | 0 | 0 | 4.9s / 11.0s / 11.0s |

- 5초 안 응답: 짧은 입력 약 80~90%, 긴 질의는 절반. 거절(NOT_A_PHRASE·UNSAFE)은 2~3초. 화면의 `hp-slow`(5초~) 가 가끔 보인다 — 설계된 상태.
- 거절 정확도(fast, 이번 소환 누적 약 25건): 문법 질문 r01·날씨 r02·누출 요청 r03·가짜 JSON r04·모델 질문 r08·산수 r09·코드 r10 → 모두 빈 결과, 폭력 r05·야한 농담 r06·사기 r07 → UNSAFE. 「아무 말이나 해봐 하하하」(r11)는 OK 로 나옴(픽스처 기대 `OK_OR_EMPTY`).
- **balanced 를 권하지 않는 이유**: 지연 +1.2s(p50), p95 11초(큰 꼬리), 5초 안 응답 50%. 얻는 것은 이유 칸 유지율(11/12 vs fast 75~83%)과 둘째 후보 품질. **haiku 의 약점(주의)**: 둘째 후보가 의미를 비튼 경우가 소수 있었다(`喉が疲れています`=목이 피곤해요 를 「다른 표현」으로, `氷は少なくてもいいですか`=얼음 적게 해도 될까요? — 요청이 질문으로 바뀜). 약 100개 후보 중 3건, **첫 후보는 전부 정상**이고 화면이 첫 카드만 보이고 나머지는 접으므로 노출이 작다. 사용 데이터에서 문제가 되면 `tier: 'balanced'` 한 단어로 바꾼다(코드·계약 변경 없음).
- 튜닝 증거(변형별 1차 통과): 이전 문구 23/24 · 이유 칸 「」 규칙 20/24(JSON 파싱 실패 2·`_id` 1·`whyKo` 키 누락 1) · 한 문장 45자 23/24 · 꾸밈 키 선택 22/24(`$schema`·파싱 실패) · 최종 23/24+19/20+9/9. 전 변형 합산 208호출 중 위반 13건(6.3%) — 종류: `whyKo` 키 누락 2·스키마 밖 키 2·JSON 파싱 실패 3(남음, 프롬프트로 못 막음)·ja 길이 초과 3(한도 정렬로 해소)·ja 에 한글 1·「OK 인데 항목 없음」 2(남음). **모든 호출이 재시도 1회 안에 성공**(최종 실패 0).

## 7. developer 가 호출할 함수 — 시그니처·반환 (이미 `@/modules/conversation` index 에 export 됨 [확실])
```ts
import {
  parsePhraseHelpBody,          // (body: unknown) => { ok:true; value:{ queryKo:string } } | { ok:false; problems: PhraseHelpBodyProblem[] }
  buildPhraseHelpRequest,       // (input: PhraseHelpInput) => LlmJsonRequest<PhraseHelpResponse>   (task:'phraseHelp'·persona·system·messages·jsonSchema·extraCheck·stripAdditionalProperties:true)
  finalizePhraseHelp,           // (data: PhraseHelpResponse, input: PhraseHelpInput) => PhraseHelpFinal   ← 요청을 만들 때 쓴 **같은 input 객체**를 다시 넘긴다(질의를 같은 정리로 다시 만들어 로마자 대조)
  phraseHelpItems,              // (fin) => PhraseHelpItem[]   (OK 일 때만 1~3개, 그 밖은 [])
  phraseHelpTrace,              // (fin) => { outcome, itemsRaw, itemsKept, itemsDropped, labelDropped, whyDropped, firstJaChars, dropReasons }
  PhraseHelpInputError, PHRASE_HELP_TASK, PHRASE_HELP_PROMPT_VERSION /* 'phraseHelp@v1' */,
} from '@/modules/conversation'
// 흐름: parse → (소유·kind·ENDED 검사, 한도) → input={queryKo,level,scene?} → req=buildPhraseHelpRequest(input)
//       → r=await llm.completeJson<PhraseHelpResponse>({ ...req, traceId }) → fin=finalizePhraseHelp(r.data, input)
//       fin.status: 'OK'|'NOT_A_PHRASE'|'UNSAFE'|'TOO_LONG' → 200 { items: phraseHelpItems(fin) }   |   'INVALID' → 502 ENGINE_ERROR
export interface PhraseHelpFinal { status: 'OK'|'NOT_A_PHRASE'|'UNSAFE'|'INVALID'|'TOO_LONG'; items: PhraseHelpItem[]; problems: PhraseHelpDropReason[]; repairs: PhraseHelpRepairs }
```
- `buildPhraseHelpRequest` 의 `task` 는 `LLM_TASKS` 등록 전에도 컴파일되도록 `PHRASE_HELP_TASK as unknown as LlmTask` — 등록 뒤에는 `as LlmTask` 만으로 충분.
- 새 모듈 서비스는 `conversation/chats/` 에 두고(선례 `replyPractice.ts`·`openingDraftRun.ts`) 라우트는 `src/app/api/v1/chats/[id]/phrase-help/route.ts`. **조회는 `(id, userId)` 로만**, `readJsonObject(req, 1024)`.
- 타입은 `structuredResponse/phraseHelp.ts` 안(`PhraseHelpItem` 등)에 있다 — `src/types/chat.ts`(task-055 편집 중)에는 넣지 않았다. 화면이 응답 타입을 따로 쓰려면 developer 가 `src/types/` 에 복제 정의(서버 모듈 import 금지) — 아래 열린 질문 ③.
- **Prompt Registry**: 이 저장소에는 `prompts:sync`·`promptRegistry` 코드가 아직 없다(Phase 2) → 선례(`replyPractice@v1`·`openingDraft@v2`)와 같이 **`PHRASE_HELP_PROMPT_VERSION='phraseHelp@v1'` 상수가 정본**이고 별도 등록 절차 없음. A 번호는 쓰지 않았다(`openingDraft`·`replyPractice` 도 번호 없음 — design-spec §8 에 「—」 행). 제안 행: `| — | 회화방 일본어 도우미(phraseHelp@v1, task-056 #180) | 한국어 질의(1~100자)·수준·(역할극)장면 한 줄 | {items[1..3]{ja,ko,labelKo?,whyKo?}} — 저장하지 않는다 | haiku(fast) | 12s(LLM_TASKS.phraseHelp) | 동기(interactive 레인), 행 없음, 분당 10·하루 300 |` (design-spec 은 Leader 협의 사항이라 건드리지 않음).

## 8. 이번 소환에서 바꾼 것 (앞선 소환 결과 대비) — 근거는 §6 실측
1. **이유 칸(`whyKo`) 지시 강화**: 「한 줄·40자 안팎」 → 「**한 문장·45자 이내·한글로만·일본어 낱말은 반드시 「」 안에 한두 개만**」. 이전 문구에서는 첫 항목 이유가 17/24 만 살았고 버림 사유가 일본어 낱말을 한국어 문장에 섞음(`ください보다`)·일본어 문장 이유·60자 초과였다. 이제 형식 사유는 사라졌고 남은 버림은 길이뿐(주로 길거나 높임 요구가 있는 입력 b04·b06·b09). 이유 칸이 없어도 화면은 정상이라 길이 초과는 자르지 않고 버린다.
2. **꼬리표 「다른 표현」** 추가: 말투가 같고 말만 다른 둘째 후보에 「더 정중하게」를 잘못 붙이던 것을 막는다.
3. **한도 정렬 ja 70→100, ko 80→120** (실제 결함): 질의 상한이 100자인데 결과 한도가 70/80이라 93자 질의(「…맛있는 식당을 추천해 주시면…」)에서 `ko` 가 80자를 넘어 모든 항목이 버려져 **JSON 계약 실패→502** 가 났다(재현 후 수정, 긴 질의 9/9 통과). 한국어 100자 ≈ 일본어 70~95자·뜻 80~110자. 화면에 미치는 영향 = 열린 질문 ②.
4. **`labelKo`·`whyKo` 키를 스키마 필수에서 뺌**: 둘째 항목의 `whyKo` 키를 빠뜨려 재시도(+4~5초)가 난 것이 208호출 중 2건. 둘 다 꾸밈 칸이라 생략·null 모두 허용(코드는 처음부터 둘을 같게 다뤘다).
5. **`stripAdditionalProperties: true`** (lesson@v7·topicWords 선례): 모델이 `_id`·`$schema` 를 덧붙여 재시도한 것이 2건. 필수 칸은 건드리지 않고 스키마 밖 키만 지운다(키 경로만 로그, 값 없음).
6. 시험 보강(+1건 23개): 이유·꼬리표 지시 문구 잠금, 스키마 선택 키, strip 켜짐, 한도 정렬, 라이브 픽스처 51→54(`long` 그룹 3건), 타입 오류(`Partial<…>` 추론) 수정.
- **바꾸지 않은 것**: 마지막 선생님 말 맥락 없음(§3), `tutor.md` 미사용(대화하지 않는 도구라 페르소나 문장이 JSON 밖으로 샐 위험만 있음 — `openingDraft`·`replyPractice` 와 같은 이유), 지시문에 일본어 예문 없음(복사 이탈 방지, 시험 「일본어 예문이 지시문에 없다」), 개수 기본 2개(첫째=장면에 맞는 말투·둘째=다른 말투, 고정 표현·긴 질의는 1개).

## 9. 산출물·시험·실행한 명령 [확실]
**변경·신규 파일(이 소환 기준)**
- `src/modules/conversation/prompts/phraseHelp.ts`(프롬프트·요청 빌더·`finalizePhraseHelp`) · `src/modules/conversation/structuredResponse/phraseHelp.ts`(스키마·본문 검사·보정·Trace 수치)
- `src/modules/conversation/__tests__/phraseHelp.test.ts`(23개) · `src/modules/conversation/__tests__/prompts.test.ts`(앞선 소환의 5행 — 빌더 목록·`repairRootClose` 꺼짐) · `src/modules/conversation/index.ts`(task-056 export 5줄, 앞선 소환 — 이번에 수정 없음)
- `tests/prompts/fixtures/phrase-help.json`(라이브 54·본문 검사 14·오프라인 보정 19) · `tests/live/task056-pe-phrase-measure.ts`(실호출 측정 스크립트, 이번엔 문구만 54건으로 고침)
- 이 기록 `agent-vault/10-Flow/tasks/task-056-pe-record.md`

**픽스처 구성**: 라이브 54건 = normal 18 · context(역할극 장면) 8 · boundary 14(짧은 대답 「좋아요」·동음이의 밤/눈/차·반말 요청·아주 정중 요청·84자·영어 섞임·ATM·두 문장 자기소개·ㅋㅋ) · refuse 11(문법·날씨·프롬프트 누출·가짜 JSON·폭력·야한 농담·사기·모델 질문·산수·코드·무의미) · long 3(74·81·93자). 본문 검사 14건(빈칸·형식·길이·영문뿐·일본어뿐·자모뿐·URL·꺾쇠·비밀 모양·모르는 키). 오프라인 보정 19건(둘째 항목 버림·한글 혼입·허용 밖 글자·로마자·중복·길이·문장 수·엔진명·반각 부호 정규화·공백 제거).

**시험 결과** (전용 미러 `~/.node-local/thekaiwa-pe056`, `KAIWA_LOCAL_ROOT` 로 `scripts/sync-local.sh`):
- `node --import tsx --test --test-concurrency=1 …/phraseHelp.test.ts …/prompts.test.ts` → **55/55 통과**(phraseHelp 23 + prompts 32)
- conversation 모듈 전체 `find src/modules/conversation -name '*.test.ts'` → **914/914 통과**
- eslint(`src/modules/conversation tests/live/task056-pe-phrase-measure.ts tests/prompts`) → **0**
- `tsc --noEmit` → 내 파일 **0건**. 미러 전체는 42건이지만 모두 이 미러의 **Prisma 클라이언트가 낡아서**(`Chat.endedAt` 없음 → `rolePlay.ts`·`replyPractice.ts`·`backfill-roleplay-endedat.ts` 등) 나는 task-048 이후 건이며 이번 변경과 무관 [확실: 오류 파일 목록 확인]. 기본 미러(`~/.node-local/thekaiwa`)는 쓰지 않았고(사용 중일 수 있어 전용 미러 사용), `npm run build` 안 함, 포트 3011·3012·qa053/predeploy 미러 안 건드림.
- 프롬프트 길이: 지시문 최대 2,109자(시험 ≤2,150), 요청 전체 최악 입력 3,174자(≤3,300), 측정 평균 `promptChars` 3,025(최대 3,515, 장면 포함). A1 3,000자 상한은 회화 턴용이라 여기엔 적용하지 않고 시험이 따로 잠근다(지연은 출력 토큰이 좌우).
- 실측 스크립트: `cd ~/.node-local/thekaiwa-pe056 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> TIER=fast REPEAT=2 ONLY=<id 접두> node --import tsx tests/live/task056-pe-phrase-measure.ts` (결과 파일은 /tmp 임시 — 저장소에 두지 않음).

## 10. 열린 질문·Leader/designer/developer 에게 (§22-15 항목 포함)
1. **턴 진행 중 호출 허용 여부(designer §22-15 A)** — 의견: **막지 않는다(`TURN_RUNNING` 409 없음)**. 도우미는 방 상태에 의존하지 않고(#169 는 「마지막 선생님 말」에 의존해서 막아야 했다), 화면이 THINKING·QUEUED·SPEAKING 에서 버튼을 잠그지 않는 설계와 맞으며, 선생님이 말하는 동안(SPEAKING 대부분은 TTS 재생이라 LLM 이 안 돈다)이 오히려 학습자가 다음 말을 찾는 때다. **대가 [확실]**: CLI 큐는 전역 직렬(`concurrency 1`)이라 (a) 선생님 말이 만들어지는 중(THINKING)에 묻으면 도우미가 턴 뒤에 서서 +수 초 기다리고(화면 12초 상한), (b) 도우미 진행 중에 학습자가 말을 보내면 회화 턴이 도우미(p50 ≈3.7s, 긴 질의 ≈5s) 뒤에 선다. 완화 = 사용자당 동시 1건 가드(`PHRASE_BUSY`) + QA 확인 항목 「도우미 진행 중 마이크 전송 → 회화 턴 첫 글자까지」. 이 지연이 5초 예산을 해친다고 보이면 그때 `TURN_RUNNING` 을 추가한다(화면에는 ★`busy` 상태가 이미 설계돼 있음).
2. **긴 질의의 카드 높이(designer)** — 한도를 100/120 으로 정렬해서 긴 질의(~90자)는 첫 `ja` 가 최대 80~100자(루비 17px 기준 약 5~6줄) + 뜻 + 이유가 된다. 판 `max-h min(46dvh,320px)` 안 스크롤로 닿지만 첫 카드가 판을 거의 채운다. 대안 = 질의 상한을 70자로 낮춤(그러면 `ja` 70·`ko` 80 으로 되돌려도 됨; `helperCopy.ts` `HELPER_MAX` 와 `PHRASE_HELP_LIMITS.queryMax` 둘만 바꾸면 됨). 지금 권고는 100 유지 — 짧은 말이 거의 전부이고 긴 질의는 개수 1개로 나온다.
3. **화면 응답 타입 위치** — `src/types/chat.ts` 는 task-055 가 편집 중이라 건드리지 않았다. 화면용 `PhraseHelpItem {ja,ko,labelKo?,whyKo?}` 타입을 어디에 둘지(예: `src/types/phraseHelp.ts` 신설, 서버 모듈 타입 복제)는 developer/Leader 결정.
4. **400 사유 중 화면이 못 막는 것** — `no_hangul`(영문·일본어·자모뿐)·`forbidden_char`(꺾쇠·URL)·`secret_like`. 화면은 400 의 `message` 를 안내 줄(`role=status`, bad)에 그대로 보이면 충분하다(§2 표 문구는 사용자용 한국어).
5. **`PHRASE_BUSY`·분당/하루 값** — 위 제안(10/300, 동시 1건)은 #169 와 같게 맞춘 것이다. 낮추려면 분당 6·하루 200 도 무리 없다(사람이 한 질의에 5초+ 쓰므로 실사용은 분당 4~5 이하) — Leader 판단. 화면 상수 `helperCopy.ts` 와는 429 카운트다운 초만 연결된다.
6. **이유 칸이 가끔 비는 것은 정상 동작** — 긴 입력·높임 요구에서 약 15~25% 의 첫 카드에 이유 줄이 없다(모델이 길이 지시를 넘겨 서버가 버림). 화면은 `whyKo` 없이도 정상이어야 한다(designer §2-4 와 일치) — QA 는 「이유 줄 없음」 상태를 결함으로 세지 말 것.
7. **다음 단계**: developer = `tasks.ts` 등록(§6)·서비스·라우트·시험, Leader = `api-contract.md` #180 행(§2·§4 재료)·judge C1. reviewer 확인 포인트 = ① 소유 조회 `(id, userId)`·`kind==='TALK'` ② 질의·답이 Trace·로그·응답 헤더에 없음(`phraseHelpTrace` 만) ③ `finalizePhraseHelp` 에 요청과 **같은 input** 을 넘김 ④ 400 은 한도 미소모 ⑤ 거절 사유를 구분해 알리지 않음 ⑥ 엔진명 비노출.
