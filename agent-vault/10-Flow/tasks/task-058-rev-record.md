---
task_id: task-058
role: reviewer
tags:
  - type/review-record
  - domain/conversation
  - domain/tech-debt
aliases:
  - task-058 reviewer 기록
  - REV-197
created: 2026-10-11
updated: 2026-10-11
---

# task-058 — Reviewer 기록 · REV-197 (#169 reply-practice · #178 openings/draft 에 `req.signal` 전달)

> 이력서 [[task-058-cancel-signal-169-178]] · developer 기록 [[task-058-dev-record]] · 참조 감사 [[task-056-rev-server-record]](REV-190 M1 · REV-192 L-R1/L-R2). 번호는 task-056 예약 190~199 중 197. 코드·문서·시험 원본 수정 0 (Read 전용 + 자기 미러 사본에서만 변이).

## Reviewer 기록 (REV-197) — 최종

**판정: PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 2 · Info 3). QA 진행 가능. Low 2건은 차단 아님(시험 보강 1·중복 정의 1). `native_change: false`, 스키마·화면·네이티브 변경 0.

```json
{ "reviewId": "REV-197", "status": "PASS_WITH_NOTES",
  "issues": [
    { "issue": "호출부 `&& isAbortError(e)` 다리를 지키는 시험이 없다 (신호가 abort 된 상태 + AbortError 가 아닌 엔진 실패 → 기존 매핑이어야 함)",
      "severity": "LOW", "component": "src/modules/conversation/chats/replyPractice.ts:188 · openingDraftRun.ts:97 · __tests__/task058Cancel.test.ts",
      "risk": "나중에 누가 `isAbortError(e)` 를 지워 `signal?.aborted === true` 만 남겨도 시험이 전부 통과한다 → 신호가 끊긴 순간 겹친 진짜 엔진 오류/시간 초과(504)가 로그 없는 409 CANCELLED 로 둔갑하고 Trace 에 진짜 코드가 안 남는다. #169 는 화면 상한(PRACTICE_TIMEOUT_MS 12s)과 서버 fast 12s 가 같아 겹침이 현실적이다.",
      "evidence": "변이 I(`if (signal?.aborted === true && isAbortError(e))` → `if (signal?.aborted === true)`)를 전용 사본에서 재현 → 새 시험 11/11 통과(생존). developer 변이 16건 중 같은 것 없음(M3=signal 조건 제거, M4=분기 통째 제거). 현재 시험은 (aborted+AbortError)=취소, (live+AbortError)=기존 매핑, (live+Timeout)=기존 매핑만 있고 (aborted+Timeout) 조합이 비어 있다. `isAbortError` 자체는 단위 시험이 이름만 본다는 것을 잠그지만 호출부 결합은 잠그지 않는다.",
      "recommendation": "두 서비스 시험의 「엔진 실패는 기존 매핑」 케이스를 `abort 된 신호 + LlmTimeoutError` 로도 한 번 돌려 #169 504(+Trace `ENGINE_TIMEOUT`)·#178 502 `TIMEOUT` 이 유지됨을 단언 (코드 변경 없음, 시험 2~4줄)." },
    { "issue": "`isAbortError`·`cancelledError` 가 두 곳에 정의돼 있다 (requestCancel.ts 와 #180 phraseHelp.ts)",
      "severity": "LOW", "component": "src/modules/conversation/chats/requestCancel.ts:12,15 · chats/phraseHelp.ts:88,91",
      "risk": "한쪽만 조이는 표류가 이미 한 번 있었다(REV-190 → REV-192 L-R2 에서 phraseHelp 에만 신호 조건 추가). 지금은 동작이 같지만 이후 어댑터가 취소 오류 모양을 바꾸면 한 곳을 빼먹기 쉽다.",
      "evidence": "grep: phraseHelp.ts 에 같은 두 정의, requestCancel.ts 는 phraseHelp 를 import 하지 않음. 동작은 글자까지 같음(409 CONFLICT · '요청이 취소됐어요.' · reason CANCELLED).",
      "recommendation": "task-056 이 커밋한 뒤 phraseHelp.ts 에서 두 정의를 지우고 `import { cancelledError, isAbortError } from './requestCancel'` 한 줄로 합친다(동작 불변, 기존 시험 그대로 통과해야 함). 지금 합치지는 않는 판단은 타당 — phraseHelp.ts 는 다른 세션의 미커밋 새 파일이라 충돌 위험이 더 크다." }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 2 },
  "high_risk_areas": ["운영(nginx 경유)에서 실제 fetch abort → Next req.signal 발화", "실제 claudeCli 실행 중 취소 → SIGTERM·슬롯 해제·즉시 재호출 200", "큐 대기 중 취소 뒤 즉시 재호출 409 PRACTICE_BUSY/DRAFT_BUSY(수용한 한계)", "#169 화면 12s 상한과 서버 12s 의 경주(Trace 코드)", "취소가 없는 정상 경로의 무변화(신호가 요청에 실려도 예열 적중·응답 동일)"],
  "native_change": false }
```

## 1. 확인한 것 (감사 항목별)

**범위** [확실]
- 변경은 지시한 7개뿐: `replyPractice.ts`(M) · `openingDraftRun.ts`(M) · `requestCancel.ts`(신규) · 두 라우트(M) · 시험 2개(신규). `git diff --stat` 4개 수정 파일 34+/10−, 다른 소스 파일 변경 없음. 전용 미러 `thekaiwa-rev058` 에서 7개 모두 NFS 와 `cmp` 동일.
- `phraseHelp.ts` 는 이 task 가 건드리지 않았다: mtime 20:54(task-058 편집 21:33 이전)이고, 내용 차이는 REV-192 사본 대비 L-R1/L-R2 반영분(주석 + `signal?.aborted === true &&` 조건)뿐 — task-056 쪽 후속 수정. 새 파일(untracked)이라 `git diff` 로는 못 본다 → [가능성 높음].
- `docs/design/api-contract.md:336,345` 에 #169·#178 행 `CANCELLED (task-058 …)` 가 이미 들어가 있다(미커밋 작업트리, 같은 파일에 task-056 줄이 섞여 있음) → developer 열린 질문 2 는 처리됨. 커밋 때 공유 파일 스테이징 주의(ACTIVE 메모와 동일).

**시그니처·호출부 호환** [확실]
- `grep -rn "suggestReply\|runOpeningDraft" src tests`: 호출부는 두 라우트 + 기존 시험(`task010dA3b2`·`task048`·`task045T4Drafts`·`task045Fix2Drafts`) + 라우트 모킹 시험(`task010dRateLimitOrder`·`task045T4Routes`) + 새 시험뿐. 새 인자는 모두 **마지막 선택 인자**라 기존 호출(3~4개 인자)을 깨지 않는다. 라우트는 `undefined` 를 명시해 기본 `deps` 를 쓰는데 JS 기본값 평가는 `undefined` 일 때 일어나므로 안전(라우트 시험이 `deps === undefined` 를 직접 단언). `Parameters<typeof runOpeningDraft>[2]` 를 쓰는 기존 시험(`task045Fix2Drafts:142`)은 3번째 위치가 그대로라 영향 없음. tsc 0 이 같은 결론.

**취소 정확성** [확실 — 코드 + 시험 + 변이]
- 신호 전달: 라우트 `req.signal` → 서비스 마지막 인자 → `deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })` → `LlmRequest.signal`(`llm/index.ts:53`) → `adapterCallOptions`(`:205`)에서 `ClaudeCliOptions.signal`. 신호가 없으면 칸 자체가 없다(시험 `!('signal' in req)`).
- 둘 다 필요한 판정: `signal?.aborted === true && isAbortError(e)`. 이름만 같은 live-신호 AbortError 는 기존 매핑(#169 500 INTERNAL+로그 1, #178 502 `ENGINE_FAILED`·로그 0), 시간 초과(`LlmTimeoutError`)는 live 신호에서 기존 매핑(#169 504 · #178 502 `TIMEOUT`). 다만 **(abort 된 신호 + 비-AbortError) 조합은 시험이 없다 → L1.**
- 잠금: `inFlight.add` 직후(사이에 await 없음) `try`, 해제는 `finally` 한 곳(`replyPractice.ts:217-218`, `openingDraftRun.ts:131-132`). 성공·검증 거절·엔진 오류·시간 초과·취소 어느 경로도 `finally` 를 지난다. `inFlight.delete` 를 지우는 변이(C·H)가 4/11 실패로 잡힘.
- Trace: 취소는 단계·`errorCode` 에 `CANCELLED` 만, 바깥 catch 는 `errorCode ??= classifyError(e).code` 라 취소 코드를 덮지 않는다. 시험이 질의·문장·역할 원문 0 을 단언(역할 이름·한국어/일본어 문장 모두). 변이 G(`errorCode = 'CANCELLED'` 제거)가 1/11 로 잡힘. 원래 `errorCode` 는 바깥 catch 에서만 채워졌으므로 `??=` 는 비취소 경로 동작 불변 — `errorCode` 대입은 두 파일 모두 이 두 곳뿐(grep).
- 응답: `cancelledError()` = 분류된 `ApiError('CONFLICT', '요청이 취소됐어요.', {reason:'CANCELLED'})` → `toErrorResponse` 409, `console.error` 0 (시험 단언). 문구·코드·reason 이 #47 `sessions.ts:473`·#180 과 글자까지 같다.

**#178 특수성(재시도·25s)** [확실 — claudeCli/llm/router 코드 읽음]
- 취소는 재시도로 넘어가지 않는다: ① `callClaudeDetailed.task` — `ClaudeCliAbortedError`(이름 `AbortError`)는 `ClaudeCliTimeoutError`도 `ClaudeCliExecError`도 아니라 `isRetryable` false → 즉시 throw(`claudeCli.ts:795-800`), 시작 전 이미 끊긴 신호는 `:756` 에서 프로세스를 쓰지 않고 거절. ② `withFallback` — `name === 'AbortError'` 는 다음 후보로 넘기지 않고 바로 올림(`router/index.ts:121-123`). ③ `runJsonWithRetry`(비-soft) — 호출 예외를 잡지 않고 전파. 두 task 모두 `softExtraCheck` 를 쓰지 않는다(grep) — soft 경로는 2차 호출 실패 시 1차 데이터를 쓰는 분기가 있지만 해당 없음.
- 실행 중 취소: `collect` 의 `onAbort` 가 SIGTERM(+5초 뒤 SIGKILL) → close 에서 `aborted` 를 `timedOut` 보다 먼저 봐 `ClaudeCliAbortedError` 로 거절.
- home-m4 폴백 경로는 신호를 받지 않는다(`callOnce` 의 `caller.chat(messages,{timeoutMs})`) — 이력서 「하지 않는 것」과 같음. 두 라우트 comment 에 한계(큐 대기 시 차례가 올 때 해제)가 정확히 적혀 있다.
- `maxDuration = 60` 은 그대로(#178 route.ts:7), 취소로 줄거나 늘지 않는다.
- 화면 맞물림 [확실]: #178 `openingFlight.ts` 의 abort 는 ① 30s 벽시계(`OPENING_TIMEOUT_MS`, 서버 상한 25s 보다 길어 서버가 먼저 끝나는 쪽) ② [그만두기](시작 800ms 뒤부터) ③ `dispose`(언마운트). 모두 `cur`/`release` 로 응답을 버리는 구조(`cur !== run` 이면 무시)라 409 `CANCELLED` 가 살아 있는 UI 에 도달하지 않는다. 오히려 변경 전에는 취소 직후 [다시 만들기] 가 최대 25s 동안 `DRAFT_BUSY`(한도 소모)였는데 이제 실행 중 취소는 즉시 풀린다. #169 `usePractice.ts:73` 도 `{signal: ac.signal}` 을 넘기고 12s(`PRACTICE_TIMEOUT_MS`)·`cancel()` 에서 abort — 같은 결론.

**응답·계약 불변 / 6층** [확실]
- `git diff`: 라우트 변경은 주석 + `req.signal` 인자뿐, `rateLimit` 두 줄·본문 검사 순서·`Cache-Control` 그대로. 서비스는 `engineFailure`/`engineError`/`classifyError` 매핑 줄 변경 없음.
- `requestCancel.ts` 는 conversation 모듈 안 `chats/` 의 같은 층 파일, `@/modules/infra`(하위 층)의 `ApiError` 만 import, `conversation/index.ts` 에 노출하지 않음 → 6층·`index.ts` 우회 규칙 위반 없음. eslint 7파일 0건(JSON 보고서로 7파일 모두 검사된 것 확인). 엔진명 grep(claude·haiku·sonnet·opus·reazon·whisper·style-bert·sbv2·qwen·ollama·model_id·speaker_id) 변경 소스 0건.
- 보안: 소유자 검사(`readChat(userId,…)` 404)·`requireSession`·한도 순서 불변. 취소 응답·Trace·로그에 질의/본문 원문 없음. Secret·경로·spawn 변경 없음.

## 2. 재현 수치 (전용 미러 `~/.node-local/thekaiwa-rev058` — `thekaiwa-fix058` 에서 `cp -al` 후 최상위 일반 파일 실복사, `.prisma` 는 `thekaiwa-predeploy` 에서 실복사, `prisma/schema.prisma` md5 `8f493d1b…` NFS 와 동일, 새 `sync-local.sh`)

| 항목 | 결과 |
|---|---|
| `eslint`(7파일, `--format json`) | **exit 0**, 7파일 오류 0·경고 0 |
| `tsc --noEmit`(증분) / `--incremental false`(전체, 18s) | **exit 0 / exit 0**, 오류 0 (다른 세션의 task-056/057 미커밋 파일이 같이 sync 됐지만 오류 없음) |
| 새 시험 2개 | **11/11** (서비스 7 + 라우트 4), 1.4s |
| 회귀 `find src/modules/conversation src/modules/engine src/app/api -name '*.test.ts'`(동시 4) | **1,181/1,181**, fail 0·cancelled 0, 30s — developer 수치와 일치 |

**변이 재현 9건** (별도 사본 `thekaiwa-rev058m` = rev058 의 `cp -al`; 하드링크 보호를 위해 임시 파일 + `os.replace` 로만 적용, 매번 NFS 원본으로 되돌리고 `cmp` — **9/9 동일**, 5개 소스 모두 rev058·rev058m 과 NFS `cmp` 동일 재확인; 스크립트 `scratchpad/mut058r.py`). 각 변이는 새 시험 11건만 실행:

| 변이 | 결과(실패/11) | 잡은 시험 |
|---|---|---|
| A #169 엔진 요청에서 `signal` 제거 | 4/11 잡힘 | 라우트(신호 전달)·전 구간·서비스 취소·사전 abort |
| B #178 `signal?.aborted === true &&` 제거(이름만) | 1/11 잡힘 | 「live 신호의 AbortError」 시험 |
| C #169 `finally` 의 `inFlight.delete` 제거 | 4/11 잡힘 | 전 구간(재호출 200)·취소·사전 abort·live 신호 (멈춤 없음) |
| D #178 라우트 `req.signal` 제거 | 2/11 잡힘 | 라우트 신호 전달·전 구간 |
| E #169 라우트가 신호를 `deps` 자리에 넘김 | 2/11 잡힘 | 라우트 신호 전달(`deps === undefined` 단언)·전 구간 |
| F `reason: 'CANCELLED'` 오타 | 9/11 잡힘 | 취소를 단언하는 거의 전부 |
| G #178 취소 때 Trace `errorCode='CANCELLED'` 제거 | 1/11 잡힘 | 서비스 취소 시험(Trace 코드) |
| H #178 `finally` 의 `inFlight.delete` 제거 | 4/11 잡힘 | 전 구간·취소·사전 abort·live 신호 |
| **I #169 `&& isAbortError(e)` 제거 (`signal?.aborted === true` 만)** | **0/11 — 생존** | (없음) → **L1** |

→ developer 의 「변이 16건 전부 잡힘」은 그가 고른 16건에 한해 맞다. 내가 고른 것 중 I 만 생존. 요구 3건 이상(신호 전달 제거=A·D, `signal?.aborted` 조건 제거=B, `inFlight.delete` 제거=C·H)은 모두 포함해 재현했다.

## 3. developer 질문 4건에 대한 의견

1. **`phraseHelp.ts` 도 `requestCancel.ts` 로 통합?** 의견: 하되 **task-056 커밋 뒤 별도 소변경**으로(L2). 지금 미커밋·다른 세션 소유 파일을 만지면 충돌 비용이 이익보다 크다. 통합 효과는 실제로 있다 — REV-190→192 에서 신호 조건이 phraseHelp 에만 뒤늦게 붙은 표류가 이미 있었다. 합칠 때 phraseHelp 쪽 두 정의 삭제 + import 한 줄이면 되고 기존 `task056PhraseHelp*.test.ts` 가 그대로 회귀망이다.
2. **api-contract 의 `CANCELLED`** — 이미 작업트리에 반영됨(#169 `:336`, #178 `:345`). 해소. 커밋 때 같은 파일에 섞인 task-056 줄(#180 행 등)을 함께 쓸지 task 별로 나눌지만 Leader 가 결정.
3. **새는 AbortError 의 매핑 차이(#169 500 vs #178 502)** — **회귀가 아니라 HEAD 그대로**다. diff 에 `engineFailure`(#169, `ApiError` 가 아니고 `ENGINE_UNAVAILABLE` 이 아니면 원본을 다시 던짐)와 `engineError`(#178, 모든 비-429 를 `ENGINE_ERROR` 로 감쌈) 변경이 없고, 두 줄 모두 task-058 이전 코드다. 시험이 현재 동작을 고정한 것은 「취소로 둔갑하지 않음」을 증명하려는 용도로 타당. 실제 엔진에서는 **신호가 live 인 AbortError 가 나올 수 없다**(`ClaudeCliAbortedError` 는 `opts.signal` 이 abort 됐을 때만, homeM4 는 자기 abort 를 `LlmTimeoutError` 로 감쌈, `homeM4.ts:414`) → 이론상 방어이고 통일할 이유 없음. 통일하려면 별도 task.
4. **화면 호출부/abort 시점** — 위 「#178 특수성」 마지막 항목. 문제 없음, 오히려 개선.

## 4. QA / 사용자 라이브 확인 사항

- **서버가 떠 있어야 확인 가능, 시험으론 못 닫은 것** [확인 못 함]: ① 실제 브라우저/앱 fetch abort 가 **nginx 경유 운영**에서 `req.signal` 을 발화하는지(`docs/nginx/*.conf` 에 `proxy_ignore_client_abort` 없음 = 기본 off → 업스트림 연결을 닫아 줄 것으로 읽힘 [가능성 높음]; #180 QA-B 는 개발 서버 직결에서만 확인) ② 실제 `claudeCli` 가 #169(fast)·#178(balanced)에서 SIGTERM 하고 `[claudeCli] 취소` 로그가 남는지 ③ 큐 앞에 느린 호출을 세운 큐 대기 중 취소 → 즉시 재호출이 앞선 호출이 끝날 때까지 409 `PRACTICE_BUSY`/`DRAFT_BUSY` 인지(수용한 한계, #180 QA-B 에서도 NOT_VERIFIED).
- 권고 스모크: #178 호출 → 1~2초에 클라이언트 abort → pm2 로그 `[claudeCli] 취소 — elapsed=…` + 직후 같은 사용자 재호출 200 + `RequestTrace.errorCode='CANCELLED'`·질의 원문 0. #169 동일(역할극 방, 마지막 DONE 선생님 말 필요).
- 취소 없는 정상 호출 1건씩(#169 200 형태 `{messageId,ja,ko,…}` · #178 200 `{ja,reading,warnings}`)이 변하지 않았는지 — 신호가 요청에 실려도 응답·예열 적중이 같아야 한다(`warmKeyOf` 가 `warmArgs(opts)` 만 쓰고 신호는 안 쓴다).
- 이 task 의 QA 는 QA1 계정의 `WordEntry`/`VocabSession` 행 수 대조를 하지 않는다(이력서 상태 로그: QA1 에 task-057 측정용 7,755개) — QA3/QA4 사용.

## 5. 확인 못 한 것 (정직하게)

- 라이브 `req.signal` 발화·SIGTERM·슬롯 해제·큐 대기 취소는 위 §4 대로 **직접 실행하지 않았다**(서버 기동 금지 범위·미러에서 서버 미기동). 코드 경로는 읽어서 확인([확실]), 실제 동작은 [가능성 높음].
- `phraseHelp.ts` 의 task-058 이전 상태: untracked 라 HEAD 대조가 불가하다 — mtime 과 REV-192 사본 diff 로 추론했다.
- 변이는 9건뿐(요구 3건↑, 챙길 영역 위주). 지시한 「무작위 3건」 이상을 넘겼으나 전수는 아님.

## 6. 재검증 요청 시 좁은 범위

L1 시험 보강을 반영하면 `task058Cancel.test.ts` 변경분과 변이 I 재현(0/11 → ≥1/11)만 보면 된다(코드 변경 없음). L2 통합을 반영하면 `phraseHelp.ts` import 변경 + `task056PhraseHelp*.test.ts` 통과만 보면 된다.
