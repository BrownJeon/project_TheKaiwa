---
task_id: task-056
role: developer
tags:
  - type/dev-record
  - domain/conversation
  - domain/improvement
aliases:
  - task-056 developer(서버) 기록
created: 2026-10-11
updated: 2026-10-11
---

# task-056 — Developer(서버) 기록 (API #180 `POST /api/v1/chats/:id/phrase-help`)

> 본 이력서 [[task-056-improve-talk-phrase-helper]] · 계약 정본 [[task-056-pe-record]] §2~§7 · 화면 쪽은 다른 developer(이 파일은 서버 developer 만 쓴다).

## Developer 기록
- [19:xx] 착수. 할 일: ① `engine/router` `LLM_TASKS.phraseHelp` 등록(+ `prompts/phraseHelp.ts` 캐스트 한 줄) ② 서비스 `src/modules/conversation/chats/phraseHelp.ts`(선례 `replyPractice.ts`) ③ `chats/index.ts`·`conversation/index.ts` task-056 구역에만 export 추가 ④ 라우트 `src/app/api/v1/chats/[id]/phrase-help/route.ts` ⑤ 시험 `src/modules/conversation/__tests__/phraseHelpRoute.test.ts`(가짜 deps) ⑥ 스모크 `tests/live/task056-phrase-help-smoke.ts`(작성만) ⑦ 전용 미러 `~/.node-local/thekaiwa-dev056s` 에서 eslint·tsc·시험.
- [체크포인트 1] 완료: ① `LLM_TASKS.phraseHelp` 등록 + `prompts/phraseHelp.ts` 캐스트 `as LlmTask`(+ 바로 위 주석 한 줄을 사실에 맞게 고침) ② 서비스 `chats/phraseHelp.ts`(`helpPhrase`·`readPhraseHelpBody`·`phraseHelpScene`·`phraseHelpDeps`, `readPracticeChat`·`engineFailure` 재사용) ③ `conversation/index.ts` task-056 구역에 2줄 ④ 라우트. `chats/index.ts` 는 배럴이 아니라(대화 CRUD 파일) export 추가 불필요 — 선례 `replyPractice` 도 거기 없음.
  - 남은 일: 시험(서비스 `__tests__/task056PhraseHelp.test.ts`·라우트 `src/app/api/v1/__tests__/task056PhraseHelpRoute.test.ts`) · 스모크 `tests/live/task056-phrase-help-smoke.ts` · eslint·tsc·시험 실행.
  - 다음 첫 행동: 시험 작성.
  - 주의점: (a) **한도 위치 = #169 와 같은 순서**(라우트: 본문 400 → 한도 → 서비스). Leader 지시문의 흐름 나열은 「ENDED → PHRASE_BUSY → 한도」 순이지만 같은 지시가 「#169 방식을 그대로」라 했고 #169 는 REV-142 L-4 로 「DB 를 읽는 404·409 는 한도 안」이 확정된 순서라 그쪽을 따랐다 → 404·409 `ENDED`·`PHRASE_BUSY` 도 한도를 쓴다(400 만 미소모 — 계약 #180 「400 한도 미소모」와 일치). (b) 전용 미러: 기본 미러의 Prisma 클라이언트가 낡음(10-06, `Chat.endedAt` 없음) → `cp -al thekaiwa` 뒤 `.prisma` 만 `thekaiwa-predeploy` 에서 실복사(스키마 md5 동일 확인). 기본 미러·predeploy 무변경. (c) 일반 TALK 방에 `endedAt` 이 남은 경우(상황 삭제 → scenarioId SetNull)도 409 `ENDED`.
- [체크포인트 2] 완료: 시험 2파일(서비스 17·라우트 4) · 스모크 작성(실행 안 함) · eslint 0 · tsc 0(미러 전체 0건). 남은 일: 회귀 묶음(conversation·engine·api 전체) 결과 확인 · 변이 2~3건 · 최종 기록.
- [최종] **DONE** — 서버 #180 구현·시험 완료. 다음 첫 행동: 없음(reviewer 인계). 아래 「인계」 참조.

## 인계 (reviewer·Leader 용)

### 변경·신규 파일 (전부 미커밋 — 커밋은 Leader 가 pathspec/hunk 로)
| 파일 | 내용 |
|---|---|
| `src/app/api/v1/chats/[id]/phrase-help/route.ts` (신규) | 세션 → `readJsonObject(req,1024)` → `readPhraseHelpBody`(400, 한도 미소모) → 한도 분당 10·하루 300(`phrase-help:`·`phrase-help-day:`) → `helpPhrase` → 200 `{items}` + `Cache-Control: private, no-store` |
| `src/modules/conversation/chats/phraseHelp.ts` (신규) | `helpPhrase`·`readPhraseHelpBody`·`phraseHelpScene`·`phraseHelpDeps`·`PHRASE_HELP_FAIL_MESSAGE`. `readPracticeChat`(`(id,userId)` 조회)·`engineFailure` 를 #169 에서 재사용 |
| `src/modules/conversation/index.ts` | task-056 구역(phraseHelp export 줄 바로 아래)에 2줄만. 같은 파일의 task-055 줄 3개는 다른 task 것 — 파일째 add 금지 |
| `src/modules/engine/router/tasks.ts` | `phraseHelp: { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' }` + 주석 1줄 |
| `src/modules/conversation/prompts/phraseHelp.ts` (PE 신규 파일) | 캐스트 `as unknown as LlmTask` → `as LlmTask` 1줄 + 바로 위 주석 1줄(「등록 전 컴파일용 unknown 경유」 → 「등록됨」, 사실과 맞춤). 로직 무변경 |
| `src/modules/engine/__tests__/additionalPropertiesStrip.test.ts` | **지시 범위 밖 1건(보고)** — 아래 「계약·범위 이탈」 ② |
| `src/modules/conversation/__tests__/task056PhraseHelp.test.ts` (신규, 17개) | 서비스·본문 400 시험(가짜 deps) |
| `src/app/api/v1/__tests__/task056PhraseHelpRoute.test.ts` (신규, 4개) | 라우트 파일 그대로(세션·한도 기록·서비스만 바꿔 끼움, #169 `task010dRateLimitOrder` 방식) |
| `tests/live/task056-phrase-help-smoke.ts` (신규, **실행 안 함**) | QA 용 라이브 스모크(QA4·QA2, localhost 전용·3010/PRODUCTION 거부, 정리 포함). 단계 1~9 + 선택 10(`SMOKE_CONTENTION=1`, 도우미 진행 중 턴 첫 바이트 ms 출력 — Leader 결정 1 의 QA 측정 항목) |

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev056s`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후)
- `node --import tsx --test --test-concurrency=4 $(find src/modules/conversation src/modules/engine src/app/api -name '*.test.ts')` → **1,162/1,162 통과**(fail 0·cancelled 0). 첫 실행은 1,161/1,162 — 실패 1 = 아래 ②(수정 뒤 통과).
- 새 시험만: `node --import tsx --test --test-concurrency=1 src/modules/conversation/__tests__/task056PhraseHelp.test.ts src/app/api/v1/__tests__/task056PhraseHelpRoute.test.ts` → **21/21**(서비스 17 + 라우트 4). PE 시험 `phraseHelp.test.ts` 의 「LLM_TASKS pin」 은 이제 건너뛰지 않고 통과.
- `./node_modules/.bin/tsc --noEmit -p .` → **0건**(미러 전체, 화면 쪽 포함 — 지금 시점 기준).
- `./node_modules/.bin/eslint <위 변경 파일 9개>` → **0**(경계 규칙 포함).
- 엔진명 grep(`claude|haiku|sonnet|opus|reazon|whisper|style-bert|sbv2|qwen|ollama`) — 라우트·서비스·시험 2파일 **0건**.
- 변이 확인(미러 사본에서만, 원복 확인): ① 한도를 본문 검사 앞으로 → 라우트 시험 실패 ② 거절 3종을 502 로 → 실패 ③ 동시 1건 잠금 제거 → 실패(처음엔 시험이 교착해 cancelled 로 숨었음 → 가짜 엔진이 첫 호출만 기다리게 고쳐 실패로 드러나게 함) ④ 장면 재료 없음을 404 로 → 실패 ⑤ Trace 에 질의 원문 → 실패 ⑥ `no-store` 헤더 제거 → 실패.

### 시험이 잠근 것
400 reason 8종(field·reason·한국어 message 그대로, 라우트에서 한도 차감 0·서비스 호출 0, 잘못된 JSON·1KB 초과 포함) · 404(남의·없는·CHAT·형식 틀린 id, 쿼리 전 404 포함, LLM 0·Trace 0) · 409 `ENDED`(`Chat.endedAt` 이면 관측 조회 없이 / 끝낸 표식 / 상황 삭제로 `scenarioId` 가 null 이 된 방에 남은 `endedAt`) · `TURN_RUNNING` 없음(deps 에 턴·메시지 조회 자체 없음) · `PHRASE_BUSY`(같은 사용자 동시 2건, 다른 사용자 무관, 실패·장면 읽기 실패 뒤에도 잠금 해제) · 429 분당 11번째·하루 301번째(분 창은 시계를 넘겨 비움, `Retry-After`=`retryAfterSec`) · 200 정상(1~3개, 모델 4개 → 앞 3개, 단일 항목 꼬리표 버림은 PE 보정) · 거절 3종 200 `{items:[]}`(사유 칸 없음, Trace 에만 `outcome`) · `INVALID` 502(`PHRASE_INVALID`) · 계약 위반 502 · 사용 불가 422→502 · 시간 초과 504 · 장면 재료 없음(`MISSING`)·읽기 예외(`ERROR`, 경고 로그는 오류 이름만) → 장면 없이 200 · 일반 회화방은 상황·끝낸 표식 조회 0 · 대화 수준 없으면 프로필 · Trace 직렬화에 질의·ja·ko·꼬리표·이유·장면 원문 0 · 서비스·라우트 소스에 DB 쓰기·학습 기록 테이블 0.

### 계약·범위 이탈 (Leader 판단 필요)
1. **[확실] 한도 차감 위치 = #169 순서**(라우트: 본문 400 → 한도 → 서비스). 지시문의 흐름 나열은 「ENDED → PHRASE_BUSY → 한도」 였지만 같은 지시가 「#169 방식을 그대로」라 했고, #169 는 REV-142 L-4(Codex C2)로 「DB 를 읽는 404·409 거절도 한도 안」(남의 대화 id 탐색이 한도 없이 DB 를 읽지 못하게)이 확정된 순서다. 그래서 **404·409 `ENDED`·`PHRASE_BUSY` 도 한도를 쓴다**. api-contract #180 행의 「400 한도 미소모」와는 일치. 나열 순서대로(404·409 미소모)를 원하면 라우트의 `rateLimit` 2줄을 서비스 안 `PHRASE_BUSY` 뒤로 옮기면 된다(라우트 시험 3번 기대값도 함께 바뀜).
2. **[확실] `additionalPropertiesStrip.test.ts` 핀 갱신(지시 파일 경계 밖)**: 이 엔진 시험은 「`stripAdditionalProperties: true` 를 켜는 프로덕션 코드는 lesson·topicWords 둘뿐」을 잠그는데, PE 산출 `prompts/phraseHelp.ts` 가 이를 켜서(pe-record §8-5 결정) 회귀 묶음에서 **실패**했다(내 변경 때문이 아니라 PE 파일이 원인 — PE 는 conversation 시험만 돌려 못 봄). 승인된 결정이라 목록에 `conversation/prompts/phraseHelp.ts` 를 넣고 근거 주석 2줄을 더했다(시험 이름 「둘뿐」→「셋뿐」). 되돌리려면 이 파일만 `git checkout` 하면 되지만 그러면 회귀 묶음이 빨갛다.
3. 장면 재료 **읽기 예외**도 404·500 이 아니라 장면 없이 진행(`console.warn` 에 오류 이름만, Trace `scene:'ERROR'`). pe-record §3 「읽지 못하면 장면 없이」를 예외까지 넓게 읽었다 [가능성 높음 — 의도와 일치].
4. 400 응답 `details` 는 `{field, reason}` 만(#178 처럼 `problems[]` 목록은 싣지 않음 — 지시 「field·reason·message 그대로」).

### 열린 질문
- 위 1(한도 순서) 확정 여부.
- QA: 스모크 10단계(경합 측정)는 턴이 학습 기록 행을 만든다(정리 포함). LLM 슬롯 직렬이라 다른 LLM 스모크와 동시 실행 금지.
- 미러 메모: 기본 미러 `~/.node-local/thekaiwa` 의 Prisma 클라이언트가 낡았다(10-06 생성, `Chat.endedAt` 없음). 이 전용 미러는 `.prisma` 만 `thekaiwa-predeploy` 에서 실복사(스키마 md5 동일)해 tsc 0 이 나왔다. 기본 미러는 건드리지 않았다.

## REV-190 보완 (서버 developer, 좁은 수정 — sonnet)

- [체크포인트 1] 진행 중. 완료: M1(`req.signal` → 서비스 → `deps.complete({ …, signal })`, 취소는 분류된 409 `CANCELLED` 로 조용히 종료) · M2·L1·L2·L4 시험 · L5 주석 2곳. 남은 일: 변이 재현(MUT2·MUT3·MUT7 + 취소 변이) · 회귀 묶음 · 최종 기록. 전용 미러 `~/.node-local/thekaiwa-fix056s`(기본 미러 `cp -al` + `.prisma` 만 predeploy 실복사, 스키마 md5 `8f493d1b…` 3곳 동일). 미커밋 파일: `src/modules/conversation/chats/phraseHelp.ts` · `src/app/api/v1/chats/[id]/phrase-help/route.ts` · `src/modules/conversation/prompts/phraseHelp.ts`(주석만) · `src/modules/conversation/__tests__/task056PhraseHelp.test.ts` · `src/app/api/v1/__tests__/task056PhraseHelpRoute.test.ts`.
- [최종] **DONE** — REV-190 의 M1·M2·L1·L2·L4·L5(주석 부분) 반영. 다음 첫 행동: 없음(좁은 재감사 reviewer 인계: M1·M2 만).

### 고친 것
| 지적 | 내용 |
|---|---|
| **M1** | 라우트 `helpPhrase(s.user.id, id, body, undefined, req.signal)` → 서비스 `helpPhrase(…, deps = phraseHelpDeps, signal?)` → `runPhraseHelp` → `deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })`. 엔진이 `name === 'AbortError'` 로 거절하면(`isAbortError`) 분류된 `ApiError('CONFLICT', '요청이 취소됐어요.', { reason: 'CANCELLED' })`(#47 `cancelledError` 와 같은 모양)로 끝낸다 → `toErrorResponse` 가 INTERNAL 이 아니라 `console.error`·500 이 없다. Trace: 단계·`errorCode` 모두 `CANCELLED` 코드만(`errorCode ??= classifyError(e).code` 로 취소 코드를 덮지 않음). 잠금은 기존 `finally` 가 그대로 푼다(코드 변경 없음). 신호를 안 주면 요청에 `signal` 칸 자체가 없다(기존 동작 그대로). 응답 형식·한도·오류 매핑·잠금 규칙 무변경. |
| **M2** | 서비스 시험 1건 — 질의 `ATM 에서 돈을 뽑고 싶어요` + 응답 [ATM 항목, `PWNED` 항목] → ATM 만 남고(`itemsKept` 1·`itemsDropped` 1), `PWNED` 뿐이면 502 `PHRASE_INVALID`, 같은 ATM 응답도 질의에 ATM 이 없으면 502(대조가 질의에 묶임). |
| **L1** | `phraseHelpDeps` 를 `createPhraseHelpDeps(db?)` 팩토리 + `phraseHelpDeps = createPhraseHelpDeps()` 로 바꿨다(동작 동일, `db` 는 시험이 소유 조회 배선을 고정하려고 받음 — 서비스 소스에 `prisma` 를 import 하지 않아 「DB 쓰기 0」 소스 시험 유지). 시험: `(id, userId)` 둘 다 where 에 있어야 읽히는 엄격한 가짜 db → where 가 `{id, userId}` · 남의 대화 null · 인자 뒤바뀜 null · `helpPhrase` 404. |
| **L2** | 라우트 시험: 유효한 JSON(`{queryKo:'안녕하세요'}`)에 공백 패딩 — 1025·5000바이트는 400 `요청 본문이 너무 큽니다.`(`details` 없음 = 질의 검사 reason 이 아니라 크기 거절, 한도·서비스 0), 1024바이트는 200 경계. |
| **L4** | 라우트 시험: 세션 없음 → 나쁜 본문(`{bad`)·영문 본문이어도 401(본문 검사·한도·서비스보다 먼저, 한도·서비스 0). 가짜 `requireSession` 이 진짜처럼 `UNAUTHENTICATED` ApiError 를 던진다. |
| **L5(일부)** | `prompts/phraseHelp.ts` 낡은 주석 2곳(23·40행: 「developer 가 추가한다」)을 「등록돼 있다(task-056 서버 developer)」로. 주석만, 로직 무변경. |

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056s` — 기본 미러 `cp -al` + `node_modules/.prisma` 만 `thekaiwa-predeploy` 실복사, 스키마 md5 `8f493d1b589892fca870956b4d92cdab` NFS·미러·predeploy 3곳 동일; 기본 미러·predeploy 무변경 확인)
- `eslint`(변경 5파일: 서비스·라우트·프롬프트 주석·시험 2) → **exit 0**
- `tsc --noEmit -p .`(미러 전체) → **exit 0, 0건**. (첫 실행은 `.next/dev/types/validator.ts` 의 TS2307 3건 — 기본 미러에서 하드링크로 딸려 온 낡은 `.next`(라우트가 `(tab)` 그룹으로 옮겨진 뒤 것) 때문, 내 변경과 무관. 내 미러 안에서만 `.next` → `.next.base` 로 이름을 바꿔 제외.)
- 새 시험만(`--test-concurrency=1`) `task056PhraseHelp`(서비스 17→21) + `task056PhraseHelpRoute`(4→7) + PE `phraseHelp`(23) → **51/51**(감사 때 44 → +7). 서비스 +4: 취소 2·finalize input 1·기본 배선 1 / 라우트 +3: 1KB 상한·401·`req.signal` 전달.
- 회귀 묶음(`find src/modules/conversation src/modules/engine src/app/api -name '*.test.ts'`, 동시 4) → **1,169/1,169**, fail 0·cancelled 0 (감사 때 1,162 → +7).
- 엔진명 grep(`claude|haiku|sonnet|opus|reazon|whisper|style-bert|sbv2|qwen|ollama|model_id|speaker_id`) — 서비스·라우트 소스 **0건**.

### 변이 재현 (미러 사본에서만, 임시 파일 + rename 으로 적용 — 기본 미러 하드링크 보호 — 매번 NFS 원본으로 되돌리고 `cmp` 일치 확인)
| 변이 | 결과 |
|---|---|
| MUT2 `finalizePhraseHelp(r.data, { ...input, queryKo: '가' })` (감사에서 살아남음) | **잡힘** 50/51, 실패 = M2 시험 |
| MUT3 `readPracticeChat(chatId, userId, db)` 인자 뒤바꿈 (살아남음) | **잡힘** 50/51, 실패 = L1 시험 |
| MUT7 본문 상한 `1024 → 65536` (살아남음) | **잡힘** 50/51, 실패 = L2 시험 |
| M1a 라우트가 `req.signal` 안 넘김 | 잡힘 50/51 (라우트 `req.signal` 전달 시험) |
| M1b 서비스가 `complete` 요청에 `signal` 안 실음 | 잡힘 49/51 (취소 시험 2건, 연쇄 실패·멈춤 없음) |
| M1c `helpPhrase` 가 `runPhraseHelp` 에 `signal` 안 넘김 | 잡힘 49/51 (같은 2건) |
| M1d 취소 분기(`isAbortError`) 제거 → 엔진 실패 취급(500 INTERNAL) | 잡힘 49/51 (취소 시험 2건) |
| M1e `finally` 의 `inFlight.delete` 제거 | 잡힘 38/51 (13건) |
| L4' 세션 검사를 본문 검사 뒤로 | 잡힘 50/51 (401 시험) |

### M1 의 검증 범위
- **시험으로 확인한 것**: ① 라우트가 서비스 5번째 인자로 `req.signal` 을 넘긴다(진짜 `Request` + `AbortController`, abort 하면 서비스가 받은 신호도 abort). ② 서비스가 그 신호를 **같은 객체 그대로** 엔진 요청(`complete` 인자)에 싣는다. ③ 엔진 약속(신호 abort → `AbortError` 거절)을 따르는 가짜가 실제로 취소를 받고(`cancelled=true`), 서비스는 409 `CANCELLED` 로 끝낸다(`toErrorResponse` 가 409, `console.error` 호출 0, INTERNAL 아님). ④ 같은 사용자가 곧바로 다시 불러 200(`PHRASE_BUSY` 아님) — 잠금 해제. ⑤ Trace 에 `CANCELLED` 코드만, 질의·응답 원문 0. ⑥ 호출 전에 이미 끊긴 신호도 같은 길.
- **라이브에서만 확인 가능한 것(QA 몫, 아직 미검증)**: ⓐ 실제 브라우저/앱이 fetch 를 abort 했을 때 Next.js 가 `req.signal` 을 실제로 발화하는지(`vocab/sessions` 선례가 이미 의존하는 동작 — [가능성 높음]), ⓑ 실제 `claudeCli` 가 큐 대기 중이면 시작 안 함(`claudeCli.ts:756`)·실행 중이면 SIGTERM 하는지와 CLI 슬롯이 실제로 풀려 다음 회화 턴이 빨라지는지, ⓒ 화면 12초 시간 초과 직후 [다시 시도] 가 409 `PHRASE_BUSY` 가 아니라 정상 호출이 되는지. 권고 절차: 스모크 한 건을 큐 앞에 느린 호출을 세워 둔 채 시작 → 클라이언트가 abort → pm2 로그에 `[claudeCli]` 완료 줄 대신 취소, 곧바로 재질문 200.

### 열린 질문 (Leader 판단)
1. 취소 응답 코드: #47 선례를 따라 409 `CONFLICT {reason:'CANCELLED'}` 로 했다. 끊긴 손님이 읽을 응답이 아니라서 화면에는 영향 없음. api-contract #180 행의 `reason` 목록에 `CANCELLED`(손님이 끊은 경우, 응답을 읽는 쪽이 없음)를 한 줄 적을지는 문서 담당(Leader) 몫.
2. **같은 구멍이 #169(`chats/[id]/reply-practice`)·#178(`scenarios/openings/draft`) 등 다른 「저장 없는 제안 호출」 라우트에도 있다**(감사 M1 말미 지적, `grep req.signal` 로 `vocab/sessions` 외엔 아무도 안 넘김 확인). 이번 지시 범위 밖이라 손대지 않았다 — 필요하면 별도 task.
3. `helpPhrase` 시그니처 5번째 인자(`signal`)라 라우트가 4번째에 `undefined` 를 넘긴다. 기존 17개 시험 호출을 안 바꾸려는 선택. 옵션 객체로 바꾸려면 시험 호출부 수정이 따른다.

## REV-192 보완 (서버 developer, 좁은 수정 — sonnet, judge local_fix·R1)

- [최종] **DONE** — REV-192 Low 2건(L-R1 주석·L-R2 하드닝) 반영. 설계·계약·응답 형식·잠금 규칙 무변경. 완료: 주석 3곳 정정 · 취소 판정에 `signal?.aborted === true` 추가 · 시험 1건 추가(+ 기존 시험 이름 1개 정정). 남은 일: 없음. 다음 첫 행동: 없음(필요하면 좁은 재감사 reviewer 인계: L-R1·L-R2 만). 미커밋 파일(전부 신규 untracked, 내가 이번에 건드린 3개): `src/modules/conversation/chats/phraseHelp.ts` · `src/app/api/v1/chats/[id]/phrase-help/route.ts` · `src/modules/conversation/__tests__/task056PhraseHelp.test.ts`.

### 고친 것
| 지적 | 내용 |
|---|---|
| **L-R1** (주석만, 로직 0) | 「잠금은 `finally` 가 즉시 푼다」를 사실대로 정정 3곳 — `phraseHelp.ts` 머리 설명(12행 부근) · `helpPhrase` 위 doc 주석(93행 부근) · 라우트 `req.signal` 주석(25행 부근). 문구: 엔진이 **실행 중이면 abort 즉시 거절되어 바로 풀리고, 큐에서 차례를 기다리는 중이면 차례가 올 때(앞선 호출이 끝난 뒤) 풀린다.** 수용 이유 한 줄: 재시도도 같은 큐 뒤에 서므로 기다리는 시간은 같다. |
| **L-R2** (한 줄) | `runPhraseHelp` 의 취소 분기 `if (isAbortError(e))` → `if (signal?.aborted === true && isAbortError(e))` (WHY 주석 1줄: 어댑터가 자기 타이머로 만든 AbortError 가 새도 진짜 오류가 로그 없는 409 로 둔갑하지 않게). 요청에 실어 보낸 신호가 실제로 abort 된 경우에만 취소. `isAbortError` 자체는 그대로. |
| 시험 | 신규 1건 `취소 판정은 오류 이름만이 아니라 신호도 본다(REV-192 L-R2)…`: 항상 `AbortError` 로 거절하는 같은 가짜 엔진으로 ① abort 된 신호 → 409 `CONFLICT/CANCELLED`, Trace(최상위·단계) `CANCELLED`(기존 동작 유지) ② 살아 있는 신호 → `CANCELLED` 아님, `classifyError` = `INTERNAL`(500, `toErrorResponse` 500)·`console.error` 1회(조용히 삼키지 않음)·Trace(최상위·단계) `INTERNAL`, 이어서 같은 사용자의 다음 호출 200 → `PHRASE_BUSY` 잠금 해제. 기존 취소 시험 1건의 **이름만** 「잠금 즉시 해제」→「실행 중 취소라 잠금 즉시 해제(큐 대기 중 취소는 차례가 올 때 — 수용)」로 정정(reviewer 가 짚은 과대 표현, 본문 불변). |

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056s2` — `thekaiwa-fix056s` 를 `cp -al` + 이번 NFS 소스로 `sync-local.sh`; 스키마 md5 `8f493d1b589892fca870956b4d92cdab` NFS·미러·predeploy 3곳 동일; 낡은 `.next` 는 앞 미러에서 이미 `.next.base` 로 치워진 상태; 기본 미러·`thekaiwa-predeploy`·포트 3011/3012 무사용, `git add`·커밋·push 0)
- `eslint`(변경 3파일: 서비스·라우트·시험) → **exit 0**
- `tsc --noEmit -p .`(미러 전체) → **exit 0, 0건**
- 서비스 시험 파일 → **22/22**(이전 21 → +1)
- 새 시험 3파일(`task056PhraseHelp` 22 + `task056PhraseHelpRoute` 7 + PE `phraseHelp` 23) → **52/52**, fail 0·cancelled 0
- 회귀 묶음(`find src/modules/conversation src/modules/engine src/app/api -name '*.test.ts'` 75파일, 동시 4) → **1,170/1,170**, fail 0·cancelled 0 (REV-192 때 1,169 → +1)
- 엔진명 grep(`claude|haiku|sonnet|opus|reazon|whisper|style-bert|sbv2|qwen|ollama|model_id|speaker_id`) — 서비스·라우트 소스 **0건**
- 미러 3파일을 NFS 원본과 `cmp` 동일 확인

### 변이 재현 (미러에서만, 임시 파일 + rename 으로 적용해 앞 미러와의 하드링크를 건드리지 않음 — 매번 NFS 원본으로 되돌리고 `cmp` 일치 확인)
| 변이 | 결과 |
|---|---|
| L-R2 조건 제거: `signal?.aborted === true && isAbortError(e)` → `isAbortError(e)` (REV-192 가 지적한 결함 그대로) | **잡힘** 21/22, 실패 = 신규 시험 (살아 있는 신호의 AbortError 가 CANCELLED 로 둔갑). 기존 취소 시험 2건은 신호가 abort 상태라 통과 — 그래서 신규 시험이 필요했다 |
| 취소 인식 자체 제거: `false && isAbortError(e)` | 잡힘 19/22, 실패 = 취소 시험 2건 + 신규 시험(① 쪽) — 「abort 된 신호 → CANCELLED」 방향도 잠겨 있다 |
| 원복 | 두 번 모두 `cmp` 일치(`RESTORED_CMP_OK`) |

### 열린 질문 (Leader 판단)
1. **살아 있는 신호의 AbortError 는 502 가 아니라 500 INTERNAL(+오류 로그)로 간다** — reviewer JSON 권고는 「502」라고 적었지만, `classifyError` 가 이름으로 아는 건 UNAVAILABLE·TIMEOUT·ENGINE·VALIDATION 집합뿐이고 `AbortError` 는 어디에도 없어서 모르는 예외 = 500(`engineFailure` 도 `ENGINE_UNAVAILABLE` 만 502 로 바꾼다). 지시(「기존 오류 매핑으로」·매핑 변경 금지)를 따라 매핑은 손대지 않았고, 시험은 현재 동작(500·로그 1회)을 잠근다. 「어댑터가 AbortError 를 새게 만든 결함이 조용히 409 가 되지 않고 로그로 드러난다」가 이 하드닝의 목적이라 500 이 오히려 맞다고 본다 [가능성 높음]. 502 로 바꾸려면 `classifyError` 이름 집합이나 서비스 분기를 건드려야 해서 범위 밖.
2. L-R1 의 큐 대기 잠금 한계는 지시대로 수용(코드 변경 0). QA 가 reviewer §6-3 의 라이브 확인(큐 앞 긴 호출 → 3~5초 abort → 즉시 재질문이 큐가 빌 때까지 409 `PHRASE_BUSY`)에서 이 동작을 「설계상 수용」으로 보면 된다.
