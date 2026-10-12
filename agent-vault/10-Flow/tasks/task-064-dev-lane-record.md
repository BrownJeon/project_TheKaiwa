---
tags:
  - type/task-record
  - domain/ask
  - domain/engine
aliases:
  - task-064 dev-lane
---
# task-064 ASK 전용 AI 호출 슬롯(dev-lane) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 근거: QA 실측(ASK 1건 ≈13초 동안 다른 사용자 채팅 턴 3.5초 → 14~16초) + 사용자 결정 「ASK 전용 슬롯 추가 후 배포」(2026-10-12). 전용 미러 `~/.node-local/thekaiwa-dev064l`(`.env` 없음 — `node_modules` 는 `thekaiwa-rev064` 에서 `cp -al` 하드링크, 소스·시험은 `rsync`). `thekaiwa-rev064`(QA 3011) 안에서는 아무것도 실행하지 않음.

## 수정한 파일 목록 (미커밋 · `git add` 없음)

| 구분 | 파일 | 변경 |
|---|---|---|
| 소스 | `src/modules/engine/adapters/llm/claudeCli.ts` | 큐 절: `workerBusy` 불리언 → 슬롯 객체 2개(`sharedSlot` = interactive 먼저·batch, `askSlot` = ASK 큐) + 상수 `SHARED_SLOT_CONCURRENCY = 1`·`ASK_SLOT_CONCURRENCY = 1`(이유 주석), `pump(slot)`·`schedule('ask')`, `export type ClaudeQueueLane`. `ClaudeCliOptions.priority` 타입·`maxAttempts`·`retryOnTimeout` 주석, `OUTPUT_CHAR_CAP` 주석(프로세스 최대 둘). **같은 파일의 StringDecoder 변경은 이전 task-064 미커밋분 — 내 것 아님** |
| 소스 | `src/modules/engine/router/tasks.ts` | `LlmLane` 에 `'ask'` 추가(주석), `LLM_TASKS.ask.lane` `'interactive'` → `'ask'`(QA 실측 주석) |
| 소스 | `src/modules/engine/llm/index.ts` | `requestLane(req)` 추가(= `req.priority ?? LLM_TASKS[task].lane`, `complete`·`completeJson` 이 씀), `adapterCallOptions`·`callOnce` 의 priority 타입 `LlmLane`, `LlmRequest.priority` 는 `'interactive' \| 'batch'` 그대로(주석: ASK 레인은 task 표로만) |
| 시험 | `src/modules/engine/__tests__/claudeCliAskLane.test.ts` | 신규 9건(a-1·a-2·b·c-1·c-2·d·e-1·e-2·f) |
| 시험 | `src/modules/conversation/__tests__/ask.test.ts` | 기존 1건의 기대값 `LLM_TASKS.ask.lane` `'interactive'` → `'ask'` + 제목(74·78행). 사양 변경의 직접 결과(게이트 1차에서 이 1건만 실패) — 다른 단언은 그대로 |
| 기록 | `agent-vault/10-Flow/tasks/task-064-dev-lane-record.md` | 이 파일 |

건드리지 않음: `claudeCli.provider.ts`(아래 판단)·`claudeWarmPool.ts`·`conversation/**` 소스(askLimits 포함 — 시험 1파일만)·`learning/**`·docs·prisma.

## Developer 기록

- [착수] 읽음: `engine/adapters/llm/claudeCli.ts`(큐 = `interactiveQueue`·`batchQueue` + `workerBusy` 1개, 비선점, 타임아웃 재시도 `RequeueAfterTimeout` → `drive` 재진입), `engine/router/tasks.ts`(`LLM_TASKS.ask` = balanced·120s·`interactive`), `engine/llm/index.ts`(`priority = req.priority ?? spec.lane` → `callOnce` → `adapterCallOptions`), `claudeCli.provider.ts`(`runtime.concurrency` 1~4·env `CLAUDE_CLI_CONCURRENCY`, `sourceCodeLayer` `code:…#pump` 값 1), `claudeWarmPool.ts`, `conversation/orchestrator/ask.ts`(작업 이름 `ask` 로만 `llm.completeJson` 호출 — priority 안 넘김), `conversation/chats/askLimits.ts`, 기존 큐 시험 `engine/__tests__/claudeTimeoutRetry.test.ts`(가짜 CLI 스크립트를 `CLAUDE_CLI_PATH` 로 주입 — 실제 claude 0회).
- [기준선] 전용 미러 생성(`cp -al` 0.4초). `tsc --noEmit` exit 0 · `src/modules/engine` 시험 180/180 통과.
- [체크포인트 1] 구현 + 시험 작성 완료. 새 시험 9/9 통과(전용 미러). 남은 일: 변이 5종 → 전체 게이트(tsc·eslint·engine+conversation 시험) → 판단·Info·위험 정리. 다음 첫 행동: 미러 소스 사본에 변이 ① 적용.
- [체크포인트 2] 변이 확인 완료 — 전용 미러의 소스 **사본**에만 적용 → 시험(`claudeCliAskLane` 9건 + 기존 `claudeTimeoutRetry` 7건 = 16건) → NFS 원본으로 즉시 복원(스크립트가 복원 후 바이트 동일 확인). 끝나고 `diff -rq` 로 engine·tests 동일, `*.orig`·`*.rej` 0, 가짜 CLI 잔존 프로세스 0. 아래 「변이 표」.
  - 시험 도구 수정 1회: 가짜 CLI 에 고아 방지 감시 타이머를 넣었다가 `unref()` 를 빠뜨려 즉시 응답 가짜도 15초 살아 있는 결함 → `.unref()` 로 고침(결함 상태의 변이 실행 1회는 버리고 다시 돌렸다). 첫 변이 실행(감시 타이머 넣기 전)에서 ② 가 c-1 을 통과했던 1회는 재현되지 않았다(이후 2회 연속 c-1 실패) — [추측] 부하로 Q4 시작이 늦어진 타이밍. ② 의 1차 포착 시험은 3회 모두 (b).
  - 주의: 이 시간대에 다른 에이전트가 작업 트리의 `src/components/ask/AskRoom.tsx`·`components/chat/MessageList.tsx`·`arrivalAlign.ts` 를 고치고 있다(내 변경 아님 — 게이트 전에 미러를 다시 맞춘다).

## 레인 설계

- [확실] 슬롯 2개: **공용 슬롯**(동시성 1, `interactiveQueue` 먼저 → 비면 `batchQueue`) + **ASK 슬롯**(동시성 1, `askQueue` FIFO). 두 슬롯은 서로의 `running` 을 보지 않는다 — ASK 가 돌아도 interactive·batch 가 즉시 시작하고, 반대도 같다. 실행 중 CLI 프로세스 최대 **2개**(+ 예열 대기 프로세스 ≤ `runtime.prewarmMaxIdle` 기본 2 → 최악 4개, 예전 최악 3개).
- [확실] 상수 `SHARED_SLOT_CONCURRENCY = 1`·`ASK_SLOT_CONCURRENCY = 1` — 설정 키 아님(이유 주석: 구독 rate limit 공유·프로세스당 수백 MB·관리자 설정은 ConfigurationVersion·AuditLog 의무).
- [확실] 공용 슬롯 동작은 그대로: `pump` 를 `while (running < limit)` 로 일반화했지만 limit 1 이라 한 번에 하나만 꺼낸다. 끝나면 `running--` → `resolve/reject` → `pump(같은 슬롯)` 순서(옛 `workerBusy=false` → resolve → `pump()` 와 같다). 기존 `claudeTimeoutRetry` 7건 그대로 통과(M-1 「A11 1차 무응답 중 들어온 interactive 가 2차보다 먼저」 포함).
- [확실] 타임아웃 재진입: `drive` 가 같은 `priority` 로 `schedule` 하므로 ASK 레인 재시도는 ASK 큐 꼬리로 간다(시험 c-2 가 순서까지 고정). 현재 `LLM_TASKS.ask` 는 `retryOnTimeout` 없음·`maxAttempts` 1(task 표) — 재진입은 어댑터 수준 계약으로만 시험했다.
- [확실] `maxAttempts` 기본값 `priority === 'batch' ? 1 : 2` 그대로 → `ask` 는 interactive 와 같은 2(라우터 경유 호출은 task 표가 항상 1 을 넘긴다).
- 연결: `LLM_TASKS.ask.lane = 'ask'`(L5) → `requestLane(req)` → `callOnce` → `adapterCallOptions.priority` → `schedule`. L2 `orchestrator/ask.ts`·`prompts/ask.ts` 는 `task: ASK_TASK('ask')` 만 넘기고 priority·레인·엔진 이름을 모른다(시험 f). `LlmRequest.priority` 타입은 `'interactive' | 'batch'` 그대로라 상위 층이 ASK 레인 이름을 쓸 수도 없다. engine 은 conversation 을 import 하지 않는다(변경 없음).
- 같은 사용자 동시 턴 락(409)·ASK 한도(분 3·하루 60·전역 진행 1+대기 2 `ASK_BUSY`)는 건드리지 않았다. 이제 ASK_BUSY 의 「진행 1+대기 2」 는 사실상 ASK 슬롯 1 실행 + ASK 큐 2 대기와 맞물린다.

## 변이 표 (전용 미러 소스 사본에서만, 각 변이 후 즉시 복원)

| # | 변이 | 실패한 시험 (16건 중) |
|---|---|---|
| ① | `LLM_TASKS.ask.lane` → `'interactive'` (ASK 가 공용 레인으로) | e-1 task 표 매핑 · e-2 파사드 연결 (2) |
| ①b | `schedule` 의 `'ask'` 분기 무력화(ASK 항목이 interactiveQueue 로) | a-1 · a-2 · c-2 · d · e-2 (5) |
| ② | `ASK_SLOT_CONCURRENCY = Infinity`(ASK 동시성 무제한) | **b FIFO 직렬** · c-1 · c-2 (3, 재실행 2회 동일) |
| ③ | 실패(reject) 분기에서 ASK 슬롯 `running--` 누락 | **c-1 실패·타임아웃·취소 뒤 해제** · c-2 · d · e-2 (4 — 뒤 셋은 새어 버린 슬롯의 연쇄) |
| ③b | 성공(resolve) 분기에서 ASK 슬롯 `running--` 누락 | a-2 · b · c-1 · c-2 · d · e-2 (6) |
| ④ | 타임아웃 재진입을 interactive 로(`firstAttempt > 1 && ask → 'interactive'`) | **c-2** (1) |
| ⑤ | 공용 슬롯이 ASK 슬롯이 빌 때만 꺼냄(interactive 가 ASK 를 기다림) | **a-2** · d · e-2 (3) |

기존 `claudeTimeoutRetry` 7건은 모든 변이에서 통과(공용 슬롯 동작을 건드리지 않는 변이들이라 기대대로).

## 판단·Info

- **`runtime.concurrency` (Info: 선언만 있고 큐가 무시함)** — [확실] `claudeCli.provider.ts` 스키마 키(1~4, env 별칭 `CLAUDE_CLI_CONCURRENCY`, RESTART_REQUIRED)는 `pump` 가 읽지 않는다(`runtimeReaders` 에도 없음). 이번에도 연결하지 않았다.
- **`sourceCodeLayer` `'runtime.concurrency': { value: 1, sourceRef: code:…#pump }` 는 바꾸지 않음** — [가능성 높음] 이 값은 8층 해석의 SOURCE_CODE 층 표시값일 뿐(위 층 ENVIRONMENT·DATABASE 가 덮으면 표시만 바뀌고 런타임은 무관)이고, 키 이름·설명이 「동시 실행 수」= 이 키가 언젠가 연결된다면 다스릴 **공용 큐** 동시성이다. 공용 슬롯은 여전히 1 이고 `pump` 도 그대로 있어 값·출처가 사실과 맞는다. 2 로 바꾸면 「공용 큐가 2개 동시」로 읽혀 더 틀린다. ASK 슬롯은 이 키가 다스리지 않는 별도 고정 슬롯이다. 다만 키 설명(「동시 실행 수(구독 rate limit 을 6개 프로젝트가 공유)」)만 보면 전체 프로세스가 1개라고 오해할 수 있다 → **Info(Leader 판단)**: 설명에 「공용 큐 — ASK 전용 슬롯 1개 별도」를 덧붙일지. 스키마 설명 문자열 변경이라 이번 범위에서는 하지 않았다.
- **웜 풀** — [확실] 예열은 TALK 만 한다(`prewarmTalkTurn` → `llm.prewarm`). ASK 호출은 키가 원해진 적이 없어 `take` 결과 없음 → `warm=OFF`, `replenish` 도 하지 않는다. 키가 우연히 같아져도(관리자가 tier 모델·페르소나를 같게 둔 경우) `take` 는 동기 함수라 두 슬롯이 같은 대기 프로세스를 동시에 꺼낼 수 없다(먼저 꺼낸 쪽만 쓰고 다른 쪽은 cold) — 충돌 없음. `trackActive`(종료 시 정리)는 두 슬롯의 자식을 모두 등록한다.
- **큐 깊이 보고** — [확실] 큐 길이·busy 를 읽는 곳이 없다(`warmPoolSnapshot` 은 예열 풀 상태만, 쓰는 곳은 시험뿐 — 헬스·진단 라우트에 없음). 추가하지 않았다.
- **askLimits.ts 주석 (Info)** — [확실] `conversation/chats/askLimits.ts` 머리 주석이 「공용 LLM 슬롯 `CLAUDE_CLI_CONCURRENCY=1` 을 질문이 몰아 쓰지 않게 — 회화·채팅 턴을 굶기지 않는다」라고 적혀 있어 이제 사실과 다르고(ASK 는 전용 슬롯), L2 에 엔진 env 이름이 있다. 이 task 이전부터 있던 문구라 고치지 않았다(시험 f 는 이 파일만 엔진 이름 검사에서 뺐다). Leader 가 정하면 「ASK 전용 슬롯(실행 1) 뒤 대기를 2개로 묶는다」로 바꾸면 된다.
- **슬롯 동기 예외** — [가능성 높음] `item.task()` 가 동기로 던지면 슬롯이 샌다(옛 `pump` 도 같음). 넣는 task 는 항상 async 함수(`() => task(firstAttempt)`)라 동기 예외가 없다. 공용 슬롯 동작을 1글자도 안 바꾸려고 `Promise.resolve().then(...)` 감싸기는 하지 않았다.
- **learning `topicSet.ts` 의 레인 계산 중복 (Info)** — [확실] `learning/vocab/topicSet.ts:520` 이 Trace 용으로 `request.priority ?? LLM_TASKS[task]?.lane` 를 따로 계산한다(A12 topicWords = interactive, 이번 변경과 무관하게 값 그대로 — `task042` 43건 통과). 같은 규칙이 이제 `llm.requestLane` 에 있으므로 나중에 그것을 쓰면 한 곳이 된다. 범위 밖이라 두었다.

## 게이트 (전용 미러 `~/.node-local/thekaiwa-dev064l`)

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입 | `./node_modules/.bin/tsc --noEmit` | exit 0 (구현 전 기준선도 0) |
| eslint | `node node_modules/eslint/bin/eslint.js <변경 5파일>` (claudeCli.ts·tasks.ts·llm/index.ts·claudeCliAskLane.test.ts·ask.test.ts) | 오류 0 · 경고 0 |
| 단위 시험 | `node --import tsx --test --test-concurrency=1 $(find src/modules/engine src/modules/conversation -name '*.test.ts' \| sort)` | **1330/1330 통과**(73파일 = engine 17 + conversation 56). 1차 실행 1329/1330 — `ask.test.ts` 레지스트리 1건이 옛 레인 `interactive` 를 단언 → 기대값 갱신 후 통과 |
| 관련 | `src/modules/learning/__tests__/task042.test.ts`(레인을 Trace 에 적는 유일한 다른 곳) | 43/43 |
| 새 시험 단독 | `claudeCliAskLane.test.ts` | 9/9, 약 5.7초. 실제 claude 실행 0회(가짜 CLI 를 `CLAUDE_CLI_PATH` 로 주입) |
| 변이 | 위 표 7종(요구 5종 + ①b·③b) | 전부 1건 이상 실패로 잡힘. 변이 ① 은 이제 conversation `ask.test.ts` 레지스트리 시험에도 걸린다(1차 게이트에서 확인) |

## 남은 위험

- **구독 rate limit** — [가능성 높음] AI 프로세스가 동시에 2개까지 뜬다(ASK 가 sonnet 으로 ≈13s 도는 동안 회화·채팅 haiku 도 동시에). 구독 한도를 여러 프로젝트가 공유하므로 혼잡 시간대에 한도 오류(`ClaudeCliExecError` → interactive 기본 재시도 경로)가 예전보다 잦을 수 있다. 실측 없음 — 배포 뒤 `[claudeCli] 일시적 실패` 줄 빈도를 보면 된다.
- **메모리** — [가능성 높음] 실행 2 + 예열 대기 ≤2 = 최악 CLI 4개(프로세스당 100~200MB 추정 — provider 설명 기준, 이번에 재지 않음) → 예전 최악 3개보다 1개 많다. 우분투 서버 여유는 확인하지 않았다.
- **웜 풀** — [확실] 충돌 없음(위 판단). ASK 는 예열을 쓰지 않아 매번 cold(≈2.5~3s 고정비 포함) — 이번 변경 전과 같다.
- **ASK 대기열** — ASK 끼리는 여전히 직렬이다. 질문 3건이 몰리면(ASK_BUSY 한도 안) 세 번째는 앞 두 건(≈26s)을 기다린다 — 사용자 결정 범위(슬롯 1개)대로.
- 같은 사용자의 ASK 대기 중 회화·채팅 409 락은 현행 설계 그대로(요구 6).

- [체크포인트 3] 게이트 통과·기록 마감. 미커밋 파일 = 위 「수정한 파일 목록」 6개(소스 3·시험 2·기록 1). 전용 미러 `thekaiwa-dev064l` 은 남겨 둠(Reviewer 재실행용 — 정리는 Leader 지시).
