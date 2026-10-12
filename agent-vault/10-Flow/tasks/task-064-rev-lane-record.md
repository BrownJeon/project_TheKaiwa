---
tags:
  - type/review
  - domain/ask
  - domain/engine
task: task-064
reviewer: REV-064-L (ASK 전용 AI 실행 슬롯)
status: 완료 (PASS_WITH_NOTES)
---
# REV-064-L — task-064 「ASK 전용 AI 실행 슬롯(레인)」 독립 감사

대상: `claudeCli.ts` 큐 절 · `router/tasks.ts` · `llm/index.ts` · `claudeCliAskLane.test.ts` · `ask.test.ts`(기대 레인 1곳) · `askLimits.ts` 머리 주석. 검증은 전용 미러 `~/.node-local/thekaiwa-dev064l` 에서만 — 시작할 때 `diff -rq src` 차이(askLimits.ts 주석 수정분·레인 무관 컴포넌트 시험 2개)를 `rsync -a --checksum` 으로 맞췄고, 끝에 `diff -rq src tests` 0·`*.orig`·`*.rej` 0·가짜 CLI 잔존 프로세스 0 을 확인했다. QA 미러(`thekaiwa-rev064`)·3010/3011/3012 포트·실제 `claude` 실행·`npm test`(sync-local 이 다른 미러를 건드림)는 쓰지 않았다.

## 판정: PASS_WITH_NOTES — Critical 0 · High 0 · Medium 0 · Low 3 · Info 7

## 항목별 결과 (근거 `파일:줄`)

**1. 기존 동작 불변 — OK.** `git diff HEAD -- claudeCli.ts` 의 레인 관련 hunk 는 큐 절(타입·`Slot`·`pump`·`schedule`·주석)뿐이다. `callClaudeDetailed`(`claudeCli.ts:780-860`)의 `task`/`drive`/`RequeueAfterTimeout`/`isRetryable`/`maxAttempts` 기본값(`:782` `priority === 'batch' ? 1 : 2`)은 diff 에 없다. `pump`(`:710-728`)는 옛 `if (workerBusy) return` 을 `while (running < limit)` 로 바꿨지만 limit=1 이라 한 번에 하나만 꺼내고(`running++` 직후 조건 거짓), 종료 순서(자리 반환 → resolve/reject → 같은 슬롯 `pump`)가 옛 `workerBusy=false → resolve → pump()` 와 같다. 공용 슬롯 `next`(`:706`)는 `interactiveQueue.shift() ?? batchQueue.shift()` 로 옛 순서 그대로. 실행: 엔진 시험 전체 `src/modules/engine/**/*.test.ts` **189/189**(claudeTimeoutRetry 7·claudeCliAskLane 9·claudeWarm 포함), 연관 시험(ask·phraseHelp·reviewDecision·task056·topicWords·userTranslation·task026s2·task042·claudeWarm) **304/304**, `tsc --noEmit` exit 0, eslint(변경 6파일) exit 0.

**2. 슬롯 해제 보장 — OK (가장 중요한 항목).** `pump` 의 `.then(onOk, onErr)` 두 갈래(`:716-725`) 모두 `slot.running--` → resolve/reject → `pump(slot)`. 어떤 종료(정상·`ClaudeCliExecError`·`ClaudeCliTimeoutError`·`ClaudeCliAbortedError`·`RequeueAfterTimeout`)도 `task()` 의 resolve/reject 로 귀결된다(`collect` 가 `close`/`error` 에서 `finish` 로 항상 결말, 타임아웃·취소는 SIGTERM+5초 뒤 SIGKILL `:417-438`). `drive` 의 `sleep`(`:855`)은 슬롯 밖(`schedule` 이 이미 reject 로 돌려준 뒤)이라 슬롯을 쥐지 않는다. 직접 확인: **(R1b)** 재시도 sleep 중 abort → 프로세스 재기동 0(`start:Q1` 1회), 693ms 뒤(남은 sleep 끝) `ClaudeCliAbortedError`, 다음 ASK 즉시 완료 · **(R2)** ASK 20건을 성공·exit1·HANG 타임아웃·실행 중 취소·시작 전 취소로 섞어 던져도 동시 ASK 최대 1·시작/끝 쌍 일치·마지막 ASK 정상. 재진입은 `drive(next)` → `schedule(priority)` 라 ASK 큐 꼬리(시험 c-2 가 순서까지 고정). 무한 재진입 없음: `retrying = attempt < maxAttempts && isRetryable`(`:828`)이고 `nextAttempt = attempt+1 ≤ maxAttempts`. 덧붙임: 현재 task 표에서 `ask` 는 `retryOnTimeout` 없음·`maxAttempts 1`(`tasks.ts` `adapterRetryOptions`)이라 ASK 의 타임아웃 재진입은 **지금 연결상 도달하지 않는다**(어댑터 계약 시험으로만 고정) — 위험이 아니라 사실.

**3. 동시 실행 상한 — OK.** `spawn(` 은 `claudeCli.ts`·`claudeWarmPool.ts` 두 파일뿐이고 큐를 거치는 호출 경로는 `callClaudeDetailed → schedule` 하나(호출자: `engine/llm/index.ts:228` 한 곳, health 는 `probeClaudeCliVersion`). 별도 전역 세마포어 없음 → 실행 중 CLI 최대 = 공용 1 + ASK 1 = **2**(시험 d·b 의 `maxConcurrent` 로도 확인). 웜 풀: `take(key)`(`claudeWarmPool.ts:~214`)는 `pool.idle` 에서 지운 뒤 반환하는 **동기 함수**라 두 슬롯이 같은 대기 프로세스를 동시에 집을 수 없다(developer 주장 독립 확인). 예열은 `conversation/orchestrator/index.ts:738·836` 의 TALK 만 부른다 — ASK 는 키가 `isWanted` 가 아니라 `warm=OFF`·`replenish` 무동작. 다만 관리자가 fast/balanced tier 모델을 같게 두면 두 키가 같아질 수 있고, 그때 ASK 가 TALK 의 대기 프로세스를 먼저 집을 수 있다(TALK 이 cold → +≈0.8s, 이후 `replenish` 가 자가 복구) — 충돌은 아니고 품질 저하뿐(Info). 최악 프로세스 수 = 실행 2 + 대기 `prewarmMaxIdle`(기본 2 → **4**, 관리자 상한 4 → 6).

**4. 매핑 — OK.** `git diff HEAD -- router/tasks.ts` 는 `ask` 한 줄(`'interactive'`→`'ask'`)과 타입·주석뿐. 20개 task 전체를 시험 e-1 이 하드코딩 기대표와 대조(interactive 13·batch 6·ask 1 = 20) — 내가 표를 직접 대조해 일치. `learning/vocab/topicSet.ts:520` 의 별도 `request.priority ?? LLM_TASKS[request.task]?.lane` 은 Trace 기록용이고 A12(topicWords=interactive)라 값 불변(task042 통과, tsc 통과). 6층: `LlmLane|ClaudeQueueLane|requestLane|askSlot|askQueue|sharedSlot|*_SLOT_CONCURRENCY` 가 `src/modules/engine/` 밖에 **0건**, engine 의 conversation import 0건, ASK 경로 5파일(orchestrator/ask·prompts/ask·askResponse·chats/askView·askLimits)에 `claude|anthropic|sonnet|haiku|opus|CLAUDE_CLI` 0건. `LlmRequest.priority` 는 `'interactive'|'batch'` 그대로라 상위 층이 `ask` 레인을 직접 고를 수 없다.

**5. 시험 품질 — OK.** 새 9건은 가짜 CLI(`CLAUDE_CLI_PATH` 주입, node 스크립트)로 시작/끝 이벤트 순서를 `deepEqual` 로 고정하는 의미 있는 단언이다. 타이밍: 양성 대기는 `waitFor`(10ms 폴링)·`within`(4~8s 상한), 음성 단언은 `sleep(300~400)` 뒤 "시작 안 함" 확인이라 **느린 환경에서는 거짓 통과(변이 생존) 쪽으로만 약해지고 정상 코드가 거짓 실패하는 방향이 아니다**. c-2 는 재시도 sleep 1s 대 게이트 개방 1.5s(+스폰 지연) 사이 마진이 ≈0.6s — 부하에서 가장 먼저 흔들릴 후보. 실측: CPU 바쁜 루프 8개(12코어) 아래 9건 3회 연속 통과, 변이 12회 실행에서 베이스라인 거짓 실패 0.

**변이 12건 (미러 소스 사본에서만 적용, 각 후 즉시 원복) — 생존 0**

| # | 변이 | 잡은 시험 |
|---|---|---|
| M1 | `LLM_TASKS.ask.lane` → interactive | e-1 · e-2 |
| M2 | ASK 슬롯 동시성 99 | b · c-2 (c-1 은 타이밍상 생존 — dev 기록과 같음) |
| M3 | 취소(Aborted) 거절 때만 `running--` 누락 | c-1 · c-2 · d · e-2 |
| M4 | 재진입을 interactive 레인으로 | c-2 |
| M5 | 공용 슬롯이 ASK 슬롯이 비어야 꺼냄 | a-2 · d · e-2 |
| M6 | 다른 task(chat) 레인을 ask 로 | e-1 · e-2 |
| M7 | 공용 슬롯 순서 batch 먼저 | d · e-2 |
| M8 | ASK 슬롯만 모든 거절에서 `running--` 누락 | c-1 · c-2 · d · e-2 |
| M9 | `requestLane` 이 task 표를 무시 | e-1 · e-2 |
| M10 | ASK 큐에 넣고 공용 슬롯을 pump | a-1 · a-2 · b · c-1 · c-2 · d · e-2 (7) |
| M11 | 타임아웃 재시도를 큐 재진입 없이 슬롯 안에서 | c-2 · 기존 M-1(claudeTimeoutRetry) |
| M12 | ASK 슬롯이 공용 슬롯과 `running` 카운터 공유 | a-1 · a-2 · b · c-2 · d · e-2 |

**6. 운영 위험 — Info.**
- 한도 오류: 코드로 확인한 사실 — 구독 한도 오류가 CLI 비정상 종료·`is_error` 결과로 오면 `ClaudeCliExecError`(`:539-541`·`:549-551`). 라우터 경유 호출은 `maxAttempts 1`(`adapterRetryOptions`)이라 재시도 없이 `withFallback` 으로 가는데, 회화·채팅·ASK 는 home-m4 `allowedTasks` 밖(`homeM4.provider.ts:72`, `router/index.ts:4`)이라 **후보가 하나뿐 → 사용자에게 「AI 분석에 실패했습니다」 계열 오류**가 나온다(폴백 없음). CLI 가 429 를 내부 재시도로 흡수하면 증상이 길어진 지연→TALK 12s fail-fast 타임아웃(`withFallback` 이 Timeout 은 그대로 올림)으로 나타난다. 동시 2개에서 한도가 실제로 더 자주 걸리는지는 실제 `claude` 를 돌릴 수 없어 **[추측] 확인 불가**. 안전장치: 롤백이 한 줄(`tasks.ts` `ask.lane` → `'interactive'`)이고 그러면 ASK 슬롯은 놀고 옛 동작으로 돌아간다.
- 종료: `trackActive` 가 두 슬롯의 자식을 모두 등록하고(`runCold :601`·`runWarm :613`) SIGTERM/exit 훅(`claudeWarmPool.ts` `installHooks`)이 `killAll` 로 실행 중·대기 프로세스를 정리한다 → 두 슬롯 모두 정리됨. 한계(기존과 동일): `pump` 는 `shuttingDown` 을 보지 않아 `killAll` 뒤에도 대기 항목을 꺼내 새 자식을 띄울 수 있다 — 프로세스가 곧 종료돼 실해는 작다(공용 슬롯에 이미 있던 성질, ASK 큐 대기 ≤2건 추가).
- 본문 노출: 이번 변경이 추가한 로그 줄 0. 기존 줄은 길이·태스크 이름·시도 수만(`:818-821`, `:829-832`).
- 메모리: pm2 `max_memory_restart: 512M`(`ecosystem.config.js:86`)은 Next 프로세스만 센다 — 자식 CLI(프로세스당 수백 MB)는 제외. 실행 2개 + 대기 2개 = 호스트 메모리 압박이 한 단계 올라간다(배포 후 `free -m` 관찰 권장).

**7. 문서·설정 일치 — Low(Leader 결정).** `claudeCli.provider.ts:48-55` 의 `runtime.concurrency`(기본 1, 1~4, 「동시 실행 수」)와 `:94` `sourceCodeLayer` 값 1, `.env.example:24` `CLAUDE_CLI_CONCURRENCY=1` 은 처음부터 큐에 연결돼 있지 않다(런타임이 읽지 않음, `runtimeReaders` 에도 없음). 이번 변경 전에는 표시값 1 이 실제 상한과 우연히 맞았으나 **이제 실제 상한은 2 라 콘솔 표시와 어긋난다.** developer 의 판단(값 1 은 「공용 큐」 기준으로 사실, 2 로 바꾸면 더 틀림)은 옳다 — 바꿀 것은 값이 아니라 설명이다. 제안(적용은 Leader): 설명을 「공용 큐 동시 실행 수(코드 고정 1, 현재 설정과 무관) — ASK 전용 슬롯 1개 별도」로 한 줄 추가, 필요하면 `domain-model.md:2587` 시드 설명도.

## 발견 목록

| ID | 심각도 | 위치 | 내용·재현 | 권고 |
|---|---|---|---|---|
| L-1 | Low | `claudeCli.provider.ts:48-55,94` · `.env.example:24` | 위 7항 — 콘솔·env 가 「동시 실행 수 1」을 말하지만 실제 프로세스 상한 2. 키는 원래 무효(선언만) | 설명 한 줄(Leader 결정). 값은 유지 |
| L-2 | Low | `claudeCliAskLane.test.ts:374-375` | (f) 가 `askLimits.ts` 를 엔진 이름 검사에서 제외 — Leader 가 주석을 고쳐 지금은 `claude\|…` 0건이라 예외가 필요 없다. 남기면 나중에 askLimits.ts 에 엔진 이름이 다시 들어가도 이 시험이 못 잡는다 | 예외·주석 제거(시험 1줄) |
| L-3 | Low | `docs/design/api-contract.md:1397` | ASK_BUSY 문구 「회화·채팅 턴을 굶기지 않기 위함」 — 회화·채팅은 전용 슬롯으로 이미 분리돼 사실이 달라졌다(이제 목적은 ASK 큐 길이 상한). 레인 구조는 정본 어디에도 없음(`module-dependency.md:515` 는 TheMeal 이식 표의 「2레인 큐」 한 줄) | 문구 정정 + 필요하면 module-dependency 엔진 절에 「공용 2레인 + ASK 슬롯」 한 줄 |
| I-1 | Info | `claudeCli.ts:818-821` | 완료 로그에 큐 대기시간이 없다 — 이번 병목은 QA 수작업 측정으로 찾았다. 두 슬롯이 다시 포화돼도 로그만으로는 안 보인다 | 후속 후보: `queueWaitMs` |
| I-2 | Info | 웜 풀 | fast/balanced tier 모델을 같게 두면 ASK 가 TALK 대기 프로세스를 집을 수 있음(상단 3항) | 현 설정(haiku/sonnet)에서는 해당 없음 |
| I-3 | Info | `claudeCli.ts:703-707` | 큐 상태가 모듈 변수(웜 풀은 `globalThis`). dev HMR 에서는 상한이 새는 기존 성질, 운영은 QA 측정(ASK ↔ 채팅이 같은 큐에서 막힘)이 프로세스 전역임을 입증 | 조치 불필요 |
| I-4 | Info | `claudeCli.ts:855` | 재시도 sleep 이 취소를 즉시 보지 않는다(R1b: 693ms 뒤 거절). 기존 성질, ASK 는 현재 재시도 경로 미도달 | 조치 불필요 |
| I-5 | Info | `learning/vocab/topicSet.ts:520` | 레인 계산 중복(`requestLane` 과 같은 규칙) — dev 기록과 같음 | 후속 정리 후보 |
| I-6 | Info | 종료 | `pump` 가 `shuttingDown` 미확인(6항) | 기존 성질 |
| I-7 | Info | 운영 | 동시 2 프로세스의 실제 한도 오류 빈도는 코드로 확인 불가 | 배포 후 `ClaudeCliExecError`·`[router] LLM … 실패` 줄 수 관찰, 문제 시 롤백 한 줄 |

## 전달

- QA high_risk_areas: ① 라이브 실측 — ASK 진행 중 다른 사용자(또는 다른 세션) 채팅 턴 지연이 3.5s 근처로 유지되는지 ② ASK 취소·타임아웃 직후 다음 ASK 가 즉시 시작되는지(슬롯 영구 점유 없음) ③ ASK+채팅 동시 시 `[claudeCli]` 오류·`[router] LLM … 실패` 줄과 호스트 메모리 ④ 같은 사용자의 ASK 중 회화·채팅은 여전히 `409`(사용자 락, 슬롯과 무관).
- native_change: false (웹·서버 변경만, `versionCode` 해당 없음).
- Leader 결정 필요: L-1 설명 한 줄 여부 · L-3 문구 정정 · L-2 시험 정리는 Developer 1줄.
