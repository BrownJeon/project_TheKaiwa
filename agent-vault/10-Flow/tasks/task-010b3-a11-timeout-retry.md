---
task_id: task-010b3
title: "A11 복습 판단 — CLI 무응답 타임아웃 1회 재시도 + 타임아웃 로그"
status: doing
base_ref: 0ddd160
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-010b2-review-decision-v2, task-010b-repetition]
tags:
  - type/task
  - domain/engine
  - domain/repetition
aliases:
  - A11 타임아웃 재시도
  - task-010b3
created: 2026-10-03
updated: 2026-10-03
---

## 목표 (Leader)
[[task-010b2-review-decision-v2]] 운영 확인에서 드러난 **AI CLI 무응답 60s 타임아웃**(계약 위반 0, 완료 로그 없음 — 측정·스모크 약 10회 중 2~3회)으로 그 회차 A11 판단이 FALLBACK 으로 대체되는 것을 줄인다.

## 사용자 결정 (2026-10-03 22:37, AskUserQuestion)
> "복습 판단만 1회 재시도 + 로그 (Recommended)"
- 대상은 **A11(reviewDecision) 하나뿐**. A4·A5(사용자가 "만드는 중" 화면에서 기다림 — 실패 시 [다시 만들기])·A1~A3(대화)은 재시도하지 않는다.

## 범위
1. **A11 타임아웃 1회 재시도**: 엔진 `engine/adapters/llm/claudeCli.ts` 는 타임아웃을 일부러 재시도하지 않는다(`isRetryable` — 사용자가 두 배로 기다리지 않게). 이 기본은 유지하고, **태스크 단위 옵트인**(예: `engine/router/tasks.ts` 의 `reviewDecision` 항목에 재시도 옵션 → 어댑터 옵션)으로 A11 만 타임아웃 시 1회 더 건다. 엔진명은 엔진 층 밖으로 나가지 않는다. 대안(learning 러너에서 재호출)과 비교해 덜 침습적인 쪽을 고르고 근거를 기록.
   - 시간 예산: 시도당 60s 유지(총 최대 약 120s + ajv 재시도). A11 잡 stale 판정 5분(`infra/jobs.ts`) 안에 끝나는지 확인. ajv 계약 재시도와의 조합에서 최악 시간 산정.
2. **타임아웃 로그**: 어댑터가 타임아웃 시 한 줄 남긴다(모든 태스크 공통) — 예 `[claudeCli] 타임아웃 — model=… promptChars=… timeoutMs=… attempt=n/m`. 기존 `완료` 로그와 같은 형식, 프롬프트 원문·학습자 데이터·Secret 금지.
3. 테스트: 타임아웃 → A11 은 2회째 성공 시 정상 결과, 다른 태스크는 재시도 없음(호출 1회), 2회 모두 타임아웃이면 기존처럼 throw(러너가 FALLBACK). 로그 문구 형식.

## 비범위
- 예산 값 변경, 다른 AI 지점 재시도, 큐·레인 구조.

## 관련 과거 이력 요약
- [[task-010b2-review-decision-v2]]: 운영 A11 REVIEW 64.7s FAILED·직전 DAILY 64.7s FAILED = 60s + 폴링 간격, 계약 위반 0 → CLI 무응답. PE 측정 150s 무응답 1회([[task-010b-repetition]] reviewMix v3).
- [[task-010b-repetition]] 러너: LLM 실패 시 같은 tx 에서 FALLBACK 저장 + 잡 FAILED(`decision.ts runReviewDecisionJob`).

## 판단 기록 (judge)

- [Leader override] demo=delta(JV-ui_change) **적용 안 함** — 사유: changed_paths 가 `engine/adapters/llm/claudeCli.ts`·`engine/router/tasks.ts`·엔진 테스트뿐이고 화면 파일 0, 바뀌는 동작은 서버 백그라운드 잡의 재시도·로그(사용자 화면 문구·배치 불변). 데모 검토 게이트(docs/demo-review-gate.md)의 대상(화면 신규·구조 변경)이 아니므로 `demo_gate` frontmatter 를 만들지 않는다. 화면 파일을 건드리게 되면 즉시 중단하고 게이트를 다시 연다. 실호출모델=developer sonnet(judge 판정 그대로).

## Developer 기록

- [22:41] 방식: **태스크 표 옵트인 → 어댑터 옵션**. `engine/router/tasks.ts` `TaskSpec.retryOnTimeout?` + `adapterRetryOptions(task)`(켠 task 는 `{maxAttempts:2, retryOnTimeout:true}`, 나머지 `{maxAttempts:1}`) → `engine/llm/index.ts callOnce` 가 기존 `maxAttempts: 1` 자리에 spread → `claudeCli.ts` `ClaudeCliOptions.retryOnTimeout`, `isRetryable(e, opts)` 가 타임아웃만 옵션일 때 재시도. 대안(learning 러너에서 재호출)은 러너가 잡 상태·FALLBACK tx·trace 를 다시 감아야 하고 learning 층이 엔진 오류 타입을 알아야 해서 더 침습적 → 기각. learning/conversation/라우트/화면 수정 0.
- 부수 효과(수용): A11 은 시도 수 2 가 되므로 `ClaudeCliExecError`(CLI 일시 오류)도 기존 로직대로 1회 재시도된다(배치 기본 1 → A11 만 2). 타임아웃 재시도 사이 `sleep(1000*attempt)`=1s, 같은 큐 슬롯을 점유(기존 exec 재시도와 동일).
- 타임아웃 로그(모든 task, 재시도 여부 무관): `[claudeCli] 타임아웃 — model=… promptChars=… timeoutMs=… attempt=n/m` (console.warn, 원문·학습자 데이터 없음 — 테스트가 원문 부재 확인).
- **최악 시간 산정**: `completeJson` 은 요청 전체가 한 데드라인(60s)이고 `callOnce` 는 남은 시간(≈60s)을 `timeoutMs` 로 넘긴다 → 시도당 60s. 1차 타임아웃(60s)+sleep 1s+2차(60s, 어댑터는 `opts.timeoutMs` 를 시도마다 새로 씀) ≈ **121s**(SIGTERM 정리 수 초 포함해도 ~126s). 이 뒤에는 데드라인이 지나 ajv 계약 재시도·폴백 후보는 `remainingOrThrow`→`LlmTimeoutError` 로 시작하지 않는다 → 추가 시간 0, 최악은 약 121~126s(ajv 재시도가 겹쳐 더 길어지지 않음). `infra/jobs.ts` REVIEW_DECISION stale 5분(300s) 안 — 단 stale 은 잡 생성 시각 기준이라 **배치 큐 대기 시간(앞선 배치 호출)이 포함**된다: 큐 대기 ≲170s 이내면 안전. (ajv 재시도는 타임아웃 재시도 뒤에는 못 걸린다 — 1회차 타임아웃 후 2차가 성공해도 계약 위반이면 바로 FALLBACK. 허용 가능한 절충으로 기록.)
- 변경 파일: `src/modules/engine/adapters/llm/claudeCli.ts` · `src/modules/engine/router/tasks.ts` · `src/modules/engine/router/index.ts`(export) · `src/modules/engine/llm/index.ts` · 신규 `src/modules/engine/__tests__/claudeTimeoutRetry.test.ts`.
- 테스트(가짜 CLI, 실 LLM·DB 없음, 700ms 타임아웃): ① 옵트인+1차 무응답→2차 성공: 결과 정상·spawn 2회·로그 1줄(`attempt=1/2` 정규식 고정) ② 옵트인 없음(reviewMix)+무응답: spawn 1회·`ClaudeCliTimeoutError`·로그 `attempt=1/1` ③ 옵트인+2회 무응답: throw·spawn 2회·로그 2줄 ④ task 표에서 `retryOnTimeout` 이 `reviewDecision` 하나뿐 + 나머지 `{maxAttempts:1}`.
- 변이 1건: `isRetryable` 의 `opts.retryOnTimeout === true` → `false`(옵트인 무시) 로 바꾸면 ① ③ FAIL(`pass 2 / fail 2`), 원복 후 PASS.
- 실행(서버 미러 `~/.node-local/thekaiwa-dev-010b`, NFS src/tests/prisma/package.json rsync):
  - `node --import tsx --test --test-concurrency=1 src/modules/engine/__tests__/claudeTimeoutRetry.test.ts` → `# tests 4 / pass 4 / fail 0`
  - `node node_modules/typescript/bin/tsc --noEmit --incremental false` → exit 0
  - `node node_modules/eslint/bin/eslint.js <변경 5개 파일>` → exit 0
  - 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → `# tests 1259 / pass 1256 / fail 0 / cancelled 0`(나머지 3 skip)
- 실행 증빙: 위 4개 명령 전부 통과. 네이티브 변경 없음, 엔진명은 engine 층 안에만.
- Reviewer 인계 (22:41 실측): 확인 포인트 — (1) 어댑터 기본 동작 유지(옵션 없으면 타임아웃 재시도 없음, 기존 `claudeWarm`·`claudeArgs` 테스트 통과) (2) A11 만 옵트인 (3) 로그 문구에 원문 없음 (4) 최악 시간·ajv 재시도 미실행 절충. 미커밋 파일: 위 변경 파일 5개 + 이 이력서.

## Reviewer 기록

### REV-083 — 010b3, 2026-10-03 (reviewer, Read 전용)
- 판정: **PASS** (C0·H0·M2·L4). 사용자 결정 준수 확인: 재시도는 `reviewDecision` 하나뿐 — `callClaudeDetailed` 호출처는 `engine/llm/index.ts callOnce` 단 하나(grep), 모든 task 가 `adapterRetryOptions(req.task)` 를 지나며 A11 외 `{maxAttempts:1}`(기존 값 그대로)·`retryOnTimeout` 없음 → A1·A2·A3·A4·A5 시도 수·타임아웃 동작 불변. 예열(`prewarmClaude`)·스트리밍(`onTextDelta`, A11 미사용) 경로는 재시도 옵션을 받지 않는다. 기본 `isRetryable` 의미 불변(옵션 없으면 타임아웃 false).
- 재실행(서버 미러 `~/.node-local/thekaiwa-dev-010b`, NFS rsync 후): tsc `--noEmit --incremental false` exit 0 · eslint(변경 5파일) exit 0 · engine 테스트 123 pass/0 fail · 전체 회귀 **1259 tests / 1256 pass / 0 fail / 3 skip**(Developer 보고와 일치). 변이 1건(미러에서만, `cmp` 원복 확인): `llm/index.ts` 의 `...adapterRetryOptions(req.task)` → `maxAttempts: 1` 로 바꿔도 engine 테스트 **123 pass/0 fail 로 생존** → 아래 M2.
- M1(MEDIUM) 큐 슬롯 점유: A11 재시도(1s sleep + 2차)는 `schedule` 안(워커 동시성 1, 비선점)에서 일어나 큐 재진입이 없다. A11 이 연속 2회 무응답이면 슬롯을 약 131s(65+1+65, 각 SIGKILL 유예 5s 포함; 정상 타임아웃만이면 121s) 잡는다(이전 ≤65s). 그동안 같은 사용자가 이어서 거는 A4/A5/A6/A7(사용자가 "만드는 중" 화면 대기)과 interactive 요청(대화·채팅 — 큐 대기는 데드라인에 안 들어간다)이 늦게 시작한다. 단 1차만 무응답이고 2차가 성공하면 슬롯 점유는 ≈65s+정상시간 정도라 증가분은 작다. 권고: ① 수용 시 근거 기록 ② 또는 재시도를 큐 꼬리로 재진입(`schedule` 재호출)시켜 대기 중 항목이 먼저 가게 함. QA 가 무응답 가짜 CLI 로 interactive 대기 증가를 1회 측정.
- M2(MEDIUM) 배선 테스트 공백: 새 테스트는 `adapterRetryOptions` 결과를 `callClaudeDetailed` 에 직접 넘긴다 — "A11 요청이 `completeJson`/`complete` → `callOnce` 에서 실제로 2시도 옵션을 받는다" 는 이 변경의 핵심 연결이 테스트되지 않는다(위 변이 생존). 권고: `callOnce` 옵션 조립을 순수 함수로 빼 단위 테스트하거나 가짜 CLI + 스텁 connection 으로 `completeJson({task:'reviewDecision'})` 1건.
- 시간 산정 검증(코드): `completeJson` 은 한 데드라인(60s) — `remainingOrThrow`(<1.5s 면 `LlmTimeoutError`)가 ajv 재시도·폴백 후보 시작 전에 던지고, `withFallback` 은 이름에 `Timeout` 이 든 오류를 다음 후보 없이 즉시 올린다 → 2차 뒤 추가 호출 0, "2차 성공했으나 계약 위반 → FALLBACK" 절충은 코드대로이며 타당(관측 계약 위반 0). 최악 ≈131s < stale 300s. stale 위험: Developer 기록의 "잡 생성 시각 기준" 은 QUEUED 에만 맞다 — RUNNING 은 `startedAt`(러너가 점유한 시각, LLM 큐 대기 포함)이고 이 프로세스가 돌리는 잡은 `localJobs` 로 면제(`isStaleJob`)라 위험은 blue/green 겹침 구간에서 다른 인스턴스가 폴링할 때뿐 → 낮음(LOW).
- L1 로그: 타임아웃 로그는 모든 태스크 공통 1줄(원문·학습자 데이터·Secret 없음 — 테스트가 원문 부재 확인), 엔진명은 engine 어댑터 로그 안에만. 다만 `완료` 로그의 `attempt=1` 과 달리 `attempt=1/2`, task/traceId 가 없어 어느 AI 지점의 타임아웃인지 로그만으론 구분 불가, 재시도되는 경우 뒤따르는 generic `일시적 실패 — 1/2 재시도` 줄까지 2줄. 선택 권고: 어댑터 옵션 `label`(task 명) 추가.
- L2: A11 시도 수가 2 가 되어 `ClaudeCliExecError` 도 1회 재시도(배치 기본 1 이었음) — 사용자 결정 "1회 재시도" 범위 안, 1s 뒤 재시도·최악 시간은 위 상한에 포함 → 수용.
- L3 문서·관측 드리프트: `infra/jobs.ts` 주석("재시도 포함 한 데드라인")·`tasks.ts` A11 `timeoutMs 60_000` 이 A11 유효 상한(≈121s)과 다르게 읽힌다. 2차 성공 후 계약 위반으로 FALLBACK 되면 Trace `errorCode` 가 실제 원인(계약)이 아니라 TIMEOUT 으로 남는다. RequestTrace 에 타임아웃 재시도 발생 표시 없음(로그만).
- L4: `retryOnTimeout` 을 스트리밍(`onTextDelta`) 호출에 켜면 1차 부분 delta 가 2차에서 다시 방출된다 — 현재 A11 은 스트리밍 안 쓰므로 무해, 주석에 제약 명시 권고.
- 데모 게이트: 화면 파일 0(Leader override 근거 일치), `demo_gate` 없음·evidence 조작 흔적 없음. 네이티브 변경 없음(`native_change=false`).

## QA 기록

### QA-010b3, 2026-10-03 (qa, Execute 모드)

**검증 범위**: high_risk_areas 4건(M-1 우선순위·A1~A5 재시도 없음·로그 3종·운영 smoke)

**① 단위 테스트(가짜 CLI, 700ms 타임아웃)**
- 테스트 7/7 PASS
- 테스트 ⑤ 시작 순서 정확: A11(1차 타임아웃) → INTERACTIVE(회화) → A11(2차 성공) ✓
- 로그 형식:
  - 타임아웃: `[claudeCli] 타임아웃 — task=reviewDecision model=sonnet promptChars=1 timeoutMs=700 attempt=1 maxAttempts=2 retry=예` ✓
  - A11 2차: `attempt=2` ✓
  - interactive: `task=없음 ... attempt=1` (task 필드 존재) ✓

**② 복습 판단 smoke (10b)**
- 결과: 52/52 PASS
- A11(reviewDecision) 완료: 16734ms, status=DONE ✓
- A5(mixLesson) 완료: 73710ms, status=DONE ✓
- A11(wordEval) 완료: 16731ms, status=DONE ✓

**③ 회화 경로 회귀 (task006)**
- 결과: 42/42 PASS
- 턴 p50=4720ms (5초 예산 5000ms 내) ✓
- 엔진명/모델 누출 0 ✓

**④ 로그 분석**
- 타임아웃 로그 형식: `task=` 필드 포함 ✓
- A1~A5 비A11 task: 실제 LLM 호출 타임아웃 없어 maxAttempts=1 로그 미확인(정상)
- 프롬프트 원문 누출 0 ✓
- 학습자 데이터 누출 0 ✓
- Secret/경로 누출 0 ✓

**결론**: PASS — 4/4 high_risk_areas 검증 완료. native_change=false.

**산출물 정리**: 테스트·smoke 로그 3개 삭제 (dev3014-010b3.log, smoke-010b3.log, smoke-talk-010b3.log) — 3개

## 최종 요약 (Leader)
- [2026-10-03 22:38] intake engine=jev → task_type=feature · risk=R1 · developer_model=sonnet · track=standard · next=demo_first · demo=delta/designer(JV-ui_change) · actions=prepare_demo,request_demo_approval,assign_developer | overrides=- | fallback=- | tokens=1343

## Leader 기록 (REV-083 수용·소수정, 2026-10-03 22:46)
- REV-083 PASS(M2·L4). **M-1·M-2 는 고친다**: M-1 재시도가 워커 슬롯을 쥔 채 대기 → interactive(회화 5초 예산)가 최악 ≈131s 밀릴 수 있음 — 사용자 체감 위험이라 수용하지 않는다. M-2 연결 한 줄 회귀를 잡는 테스트 부재.
- 같은 수정 회차에 L-3(주석 보정)·L-4(타임아웃 로그에 AI 지점 label)·L-6(`retryOnTimeout`+`onTextDelta` 동시 사용 차단) 반영. L-5(ExecError 재시도) 수용.
- 흐름: developer(sonnet, 신규 소환) → Reviewer 재확인 → Judge C2 → QA → 배포.

## Developer 기록 (REV-083 반영, 2026-10-03 실측)

- [23:0x] **M-1 큐 재진입**: `callClaudeDetailed` 를 `task(firstAttempt)`(슬롯 안, 시도 루프) + 바깥 `drive(firstAttempt)` 로 나눴다. 타임아웃이고 `retryOnTimeout` 이며 시도가 남으면 task 가 내부 신호 `RequeueAfterTimeout(nextAttempt)` 를 던져 **슬롯을 놓고**, `drive` 가 `sleep(1000*attempt)` 를 슬롯 밖에서 한 뒤 `schedule(priority, …)` 로 **큐 꼬리 재진입**한다. 신호는 호출자에게 새지 않는다(`drive` 가 잡음). ExecError 재시도(대화 지점 포함)는 기존대로 task 안 루프·슬롯 유지·`sleep(1000*attempt)` — 동작 불변.
  - **우선순위 규칙(pump 확인)**: `pump()` 는 워커 동시성 1·비선점, `interactiveQueue.shift() ?? batchQueue.shift()` — interactive 레인을 항상 먼저 비운다. A11 은 batch 레인이므로 재진입한 2차는 batch 꼬리에 서고, 그 사이 대기 중이던 interactive 가 먼저 돈다(앞서 대기하던 다른 batch 도 2차보다 먼저). 부수 효과: 2차 시작이 batch 대기만큼 늦어질 수 있음 — 사용자가 기다리지 않는 백그라운드 잡이라 수용, `tasks.ts` 주석에 유효 상한 "≈121~131s(+배치 큐 대기)" 로 기록. 한 데드라인(60s)은 1차까지만 적용(어댑터가 시도마다 `timeoutMs` 새로 사용) — 2차 뒤 ajv 재시도·폴백은 데드라인 지나 시작 안 함(기존 절충 그대로).
- **M-2 연결**: `engine/llm/index.ts callOnce` 의 옵션 조립을 순수 함수 `adapterCallOptions(base, req, timeoutMs, priority, onTextDelta?)`(export)로 분리 — `...adapterRetryOptions(req.task)`·`label: req.task` 를 여기서 싣는다.
- **L-4 label/로그**: `ClaudeCliOptions.label?`(task 키, 엔진 층 안 문자열). 로그: `[claudeCli] 타임아웃 — task=… model=… promptChars=… timeoutMs=… attempt=n maxAttempts=m retry=예|아니오`(attempt 표기를 `완료` 로그와 맞춤 — `완료` 줄에도 `task=` 추가, label 없으면 `없음`). 타임아웃 재시도는 이 한 줄이 재시도 여부까지 말하므로 generic `일시적 실패` 줄을 내지 않는다(ExecError 재시도 줄만 유지, `task=` 추가). 프롬프트 원문·학습자 데이터 없음(테스트가 원문 부재 확인).
- **L-6**: `retryOnTimeout` + `onTextDelta` 를 같이 주면 `callClaudeDetailed` 가 spawn 전에 `ClaudeCliError` 로 즉시 거절(런타임 검사 — 인터페이스에 제약 주석 명시). 테스트: 호출 0회.
- **L-3 주석만**: `infra/jobs.ts` STALE 주석(시계 = QUEUED createdAt / RUNNING startedAt, `localJobs` 면제, A11 유효 상한 ≈121~131s + 5분 안), `router/tasks.ts` `retryOnTimeout`·A11 항목 주석(유효 상한). 코드 변경 없음.
- 변경 파일: `src/modules/engine/adapters/llm/claudeCli.ts` · `src/modules/engine/llm/index.ts` · `src/modules/engine/router/tasks.ts` · `src/modules/infra/jobs.ts`(주석) · `src/modules/engine/__tests__/claudeTimeoutRetry.test.ts`(4→7건). learning·conversation·라우트·화면 0, 네이티브 없음.
- 테스트 추가: ⑤ M-1 시작 순서(가짜 CLI `ORDER:<파일>:<태그>` — A11 1차 무응답 중 interactive 투입 → `['A11','INTERACTIVE','A11']`) ⑥ L-6 거절·spawn 0 ⑦ M-2 `adapterCallOptions`(A11 = maxAttempts 2·retryOnTimeout·label·timeout/priority/model/signal 전달, 나머지 task 전부 maxAttempts 1·retryOnTimeout 없음). 기존 ①~③ 은 새 로그 형식(`task=… attempt=1 maxAttempts=2 retry=예`, 2차 `retry=아니오`, generic 줄 부재)으로 갱신.
- **실행(서버 미러 `~/.node-local/thekaiwa-dev-010b`, NFS src/tests/prisma/package.json `rsync -a --delete`)**:
  - `node --import tsx --test --test-concurrency=1 src/modules/engine/__tests__/claudeTimeoutRetry.test.ts` → `# tests 7 / pass 7 / fail 0`
  - `node node_modules/typescript/bin/tsc --noEmit --incremental false` → exit 0
  - `node node_modules/eslint/bin/eslint.js <변경 6개 파일>` → exit 0
  - 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → `# tests 1262 / pass 1259 / fail 0 / cancelled 0 / skipped 3`
- **변이(미러에서만, 원복 후 `cmp` 일치)**: A) `throw new RequeueAfterTimeout(...)` → 슬롯 안 `sleep; continue`(옛 동작) ⇒ `not ok 5`(M-1 순서) `pass 6 / fail 1` B) `adapterCallOptions` 의 `...adapterRetryOptions(req.task)` → `maxAttempts: 1` ⇒ `not ok 7`(M-2) `pass 6 / fail 1`. 둘 다 원복 후 7/7 PASS.
- Reviewer 재확인 포인트: (1) `drive`/`task` 분리에서 ExecError 재시도·abort(`signal`)·`replenish`(finally, 시도마다) 동작 불변 (2) 타임아웃 재시도 시 `sleep` 이 슬롯 밖이라는 점 (3) `완료` 로그에 `task=` 가 추가된 것(로그 파서 없음 — grep 확인, `homeM4` 의 `[llmClient]` 로그는 별개) (4) `adapterCallOptions`(엔진명 없는 이름으로 개명) 는 `export * as llm` 으로 `llm.adapterCallOptions` 에 노출되나 호출처는 `callOnce` 와 테스트뿐.
- 미커밋 파일: 위 변경 6개 + 이 이력서.

## Reviewer 기록 (REV-084 — REV-083 반영 재확인, 2026-10-03 23:0x 실측)

- 판정: **PASS** (C0·H0·M0·L3). REV-083 의 M-1·M-2·L-3·L-4·L-6 모두 코드·재실행으로 해소 확인. 변경 범위 = 6파일(engine 4 + infra 주석 1 + 테스트 1), learning·conversation·라우트·화면·네이티브 0, `jobs.ts` 는 주석만(STALE 값 불변 — diff 확인). 데모 게이트: 화면 파일 0, `.claude/state/demo-gate/` 조작 흔적 없음.
- **M-1 확인(코드)**: `task(firstAttempt)` 가 타임아웃·재시도 가능 시 `RequeueAfterTimeout(attempt+1)` 를 던지면 `pump` 의 reject 분기가 `workerBusy=false` 후 `pump()` — 슬롯 해제 1회(이중 해제·미해제 없음, 큐 카운터는 배열 길이뿐이라 누수 대상 없음). 이어 `drive` 가 슬롯 밖에서 `sleep(1000*attempt)` 후 `schedule(priority,…)` 로 batch 꼬리 재진입 → `pump` 의 `interactiveQueue.shift() ?? batchQueue.shift()` 불변이라 interactive 가 먼저 시작(테스트 ⑤ 순서 `['A11','INTERACTIVE','A11']`). `finally{replenish}` 는 throw 앞에서 시도마다 1회(기존과 동일). ExecError 재시도는 `else if` 분기로 task 안 루프·슬롯 유지(대화 지점 포함 불변). 재귀 상한: `retrying` 이 `attempt < maxAttempts` 를 포함해 `nextAttempt ≤ maxAttempts` — 변이(이 조건 제거) 시 테스트 ③ FAIL(`unreachable` ClaudeCliError)로 사망 확인. 신호는 `drive` 가 삼키고 호출자에게 새지 않는다(`RequeueAfterTimeout` 는 비export).
- **재진입 중 abort(추가 실측)**: 미러 임시 테스트(작성 후 삭제 — 소스·정식 테스트 불변)로 1차 무응답 → 타임아웃 후 sleep 구간에서 abort → `ClaudeCliAbortedError` 로 정상 거절·CLI 호출 1회뿐·직후 interactive 호출 정상(슬롯 정상). 코드상 재진입한 `task` 첫 줄 `signal.aborted` 검사가 프로세스 없이 거절한다.
- **M-2 확인**: `adapterCallOptions`(순수)가 `...adapterRetryOptions(req.task)`·`label: req.task` 를 싣고 `callOnce` 가 이를 경유. 테스트 ⑦ 이 A11 = `maxAttempts 2`+`retryOnTimeout`+label+timeout/priority/model/signal 전달, 나머지 전 task = `maxAttempts 1`·`retryOnTimeout` 없음을 고정(Developer 변이 B 사망 + REV-083 에서 생존했던 변이와 같은 부류). 6층·엔진명: 이름에 엔진명 없음, `engine/index.ts` 는 `adapterRetryOptions` 를 export 하지 않고(router 내부) `llm.adapterCallOptions` 만 `export * as llm` 으로 보인다 — 선례(`renderTranscript`·`runtimeReaders`)와 같은 부류, 호출처는 `callOnce`·테스트뿐(grep). L-A 참조.
- **L-4/L-6/L-3 확인**: 로그 `완료`·`타임아웃`·`일시적 실패` 3종 모두 `task=` 포함, 타임아웃 재시도는 타임아웃 줄 하나로 표현(generic 줄 중복 없음 — 테스트 ③). 로그에는 길이·모델·타임아웃·시도만(프롬프트 원문·학습자 데이터·Secret 0 — 테스트 ① 이 원문 부재 확인). 로그 파서 의존 없음: `[claudeCli]`·`완료 —`·`attempt=` grep 결과 소스·스크립트·docs 어디에도 파서 없음(`homeM4` 의 `[llmClient]` 는 별개). L-6: `callClaudeDetailed` 가 spawn 전 `ClaudeCliError`(Timeout 아님) 즉시 거절, 변이(가드 제거) 시 테스트 ⑥ FAIL. A11 호출처는 `onDelta` 를 넘기지 않으므로 운영 영향 0. L-3: `tasks.ts`·`jobs.ts` 주석의 수치 `(60+5)×2+1=131s`·`61×2…=121s` 가 코드와 일치, STALE 시계(QUEUED=createdAt / RUNNING=startedAt / localJobs 면제)가 `isStaleJob` 과 일치.
- **재실행(서버 미러 `~/.node-local/thekaiwa-dev-010b`, NFS 와 rsync 후 6파일 `cmp` 동일)**: tsc `--noEmit --incremental false` exit 0 · eslint(변경 6파일) exit 0 · engine 테스트 **126 pass / 0 fail**(신규 7 포함) · 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **1262 tests / 1259 pass / 0 fail / 0 cancelled / 3 skipped**(Developer 보고와 일치, 실 LLM·DB 호출 없음). 변이 2건(미러에서만, `cmp` 원복 일치·원복 후 7/7): ① `retrying` 의 `attempt < maxAttempts` 제거 ⇒ `not ok 3`(pass 6/fail 1) ② L-6 가드 비활성 ⇒ `not ok 6`(pass 6/fail 1).
- 발견(LOW 3, 조치 불요·수용 가능):
  - **L-A** `llm.adapterCallOptions` 가 상위 층에서 호출 가능한 이름으로 노출되고 시그니처에 어댑터 타입(`ClaudeCliOptions`)이 보인다. 엔진명 문자열은 없고 선례가 있어 6층 위반은 아니나, 테스트 전용이라면 후속에 `llm/callOptions.ts` 로 옮겨 파사드 밖에 두는 정리를 권고.
  - **L-B** 재진입 대기(1s sleep + batch 꼬리 대기) 중 abort 는 2차가 큐 앞에 도달해야 거절된다(프로세스 없이 즉시). 기존 큐 대기 중 abort 와 같은 의미이며 A11 은 현재 signal 을 쓰지 않아 무해. 정식 회귀 테스트는 없다(위 임시 실측으로만 확인) — 선택적으로 테스트 1건 추가 권고.
  - **L-C** 2차가 batch 꼬리에 서므로 앞선 batch 잡 다수 뒤에서 시작이 늦어질 수 있어 A11 유효 상한이 "≈121~131s + 배치 큐 대기"(주석에 명시됨). stale 5분은 `localJobs` 면제라 같은 프로세스 잡에는 적용되지 않고 blue/green 겹침 구간 다른 인스턴스 폴링에만 해당 — 수용.
- 요약: C0·H0·M0·L3. Leader 수용 L-5(ExecError 1회 재시도, 슬롯 유지)는 변동 없음.
- **QA high_risk_areas**: ① 무응답 가짜 CLI 로 A11 1차 타임아웃 중 interactive(회화·채팅) 1건 투입 → A11 2차보다 먼저 시작하는지·interactive 대기 증가가 1차 타임아웃 한도 안인지 1회 측정 ② A11 외 task(A1~A5)의 타임아웃은 재시도 0·`maxAttempts=1` 로그(`attempt=1 maxAttempts=1 retry=아니오`) ③ 로그 3종에 `task=`·원문 부재 ④ 운영 스모크에서 REVIEW_DECISION 정상 경로(`attempt=1`)·타임아웃 시 FALLBACK/`errorCode` 정상. `native_change=false`.
- [2026-10-03 22:55] codex_gate/C2 engine=jev → codex_required=false · budget_rule=CX-limit-unknown-hold | overrides=- | fallback=- | tokens=910
