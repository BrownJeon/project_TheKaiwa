---
task_id: task-004
title: "AI 클라이언트 계층(engine llm 파사드·router·어댑터) + 강사 페르소나 로더 + prompts{talk,chat,chatReview} + 실측"
status: doing
roles_involved: [leader, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-002-phase0-scaffolding, task-003b-tutor-persona-v1]
tags:
  - type/task
  - domain/tutor
  - domain/infra
created: 2026-09-26
updated: 2026-09-26
---

## 목표 (Leader 작성)
design-spec §15 task-004: engine adapters(claudeCli·homeM4)·router·llm 파사드, `tutor.md` v1 로더(절·행 필터), prompts{talk,chat,chatReview}+픽스처 20문장, 실측(haiku 왕복 p50 ≤4s, `--json-schema`+`--agents` 동시 동작, partial), qwen 비교.

## 체크포인트 (사용량 한도로 중단 — 재개 시 여기부터)
- [x] 1. engine: `json/{extractJson,schemaValidate}`(TheMeal 이식), `adapters/llm/homeM4.ts`(키 = HOME_M4_API_KEY), `adapters/llm/claudeCli.ts`(도구 전부 끔·`--agents`(model 금지 검사)·`--agent`·`--max-turns`·`stream-json`+`structured_output` 처리·시크릿 env 제거)
- [x] 2. engine: `router/tasks.ts`(A1~A11 task→tier·상한·레인) · `router/index.ts`(APP_ENV 의 EngineFallbackPolicy·상태 필터·allowedTasks·30s 캐시·withFallback) · `llm/index.ts`(complete/completeJson, persona→`--agents`, `--json-schema` 는 connection `runtime.jsonSchemaFlag` 로 끌 수 있음) · `engine/index.ts`
- [x] 3. conversation: `persona/loader.ts`(mtime 캐시·fail-closed·필수 절 1~9·≥3,000자·`## N.` 절 필터·§4 수준 행/§6 모드 행 필터)
- [x] 4. conversation: `structuredResponse/schemas.ts`(TALK·CHAT·REVIEW JSON 스키마 — 필드명은 api-contract #32 `done`: conversation{replyJa,replyReading,replyKo}·correction{required,original,corrected,explanationKo,errorType,severity,chunkType}|null·learning{grammarPoint,difficulty}·speech{style}·endOfTopic·proposals) + `checkOriginalVerbatim`(원문 바이트 일치 또는 원문 부분 문자열) · `window/`(bjj buildWindow) · `prompts/{talk,chat,chatReview}.ts` · `conversation/index.ts`
- [x] 5. `tests/prompts/fixtures/talk-corrections.json` 20문장(오류 16: 行くました·学生だです·友だちを会いました·日本語が勉強·明日…行きました·おいしいでした·食べるか·趣味は本を読みます·バスで乗ります·きれいだです·寒いでした·本が借りました·私は名前は·静かの公園·言ってくれ·家を帰りました / 정답 4) + 단위 테스트(argv·페르소나 필터·스키마·원문 검사)
- [x] 6. `scripts/sync-local.sh` 에 `.claude/agents/tutor.md`·`tests/` 미러 복사 추가 → 우분투 typecheck·lint·test
- [x] 6-결과: tsc 0 · lint 0 error · 단위 테스트 16/16 · TALK 페르소나 2,522자
- [x] 7. 실측 스크립트(`tests/live/llm-measure.ts`): talk 20문장 × haiku, `--json-schema` 켬/끔 비교, 경과 p50/p95·스키마 위반율·원문 일치 → `30-Knowledge/decisions/llm-japanese-quality.md`
- [x] 7-결과: [[llm-japanese-quality]] — 기본 CLI 는 spawn 9s + thinking 40~120s → 플래그·thinking 끄기로 20문장 p50 5.1s·p95 5.8s·실패 0·재시도 0·검출 16/16·오탐 0/4. `--json-schema` 기본 끔(실패 6/20), 페르소나는 `--system-prompt`, replyJa 상한 3문장. **A1 p50 ≤4s 미달** → 상주 세션 등은 task-007
- [ ] 8. reviewer 재검증(REV-004 Critical·High·Medium 수정 반영) → qa → 최종 요약

## 결정·메모
- **TALK 예산 해석**: 페르소나(1·3·4(수준 행)·6(TALK 행) ≈2,600자)는 `--agents` 시스템 프롬프트, "총 ≤3,000자" 는 사용자 프롬프트(모드·학습자 헤더·창·발화)에 적용. 실측 지연으로 재판단.
- **qwen 비교 보류**: thekaiwa 전용 `HOME_M4_API_KEY` 가 `.env` 에 비어 있음(다른 프로젝트 키는 쓰지 않는다) — 사용자 발급 후 진행.
- 미커밋 없음: 1~3 은 아래 WIP 커밋에 포함(아직 typecheck 전).

## Reviewer 기록

**REV-004** (2026-09-27) — 판정: **FAIL** (Critical 1)

| 심각도 | 위치 | 요약 |
|---|---|---|
| CRITICAL | `src/modules/conversation/structuredResponse/checks.ts:10-13` (`isVerbatimQuote`) | 정본 3곳(`docs/design-spec.md:182,369`, `docs/design/tutor-persona-validation.md:15` V1)이 명시한 `correction.original === 입력 바이트 일치`(V1, 필수 100%·실패시 CRITICAL 재설계 대상)보다 구현이 관대함 — `original.length>=2 && input.includes(original)`, 즉 2자 이상 연속 부분 문자열이면 통과. 일본어 입력에서 2자 매치는 사실상 항상 성립해 "원문을 실제로 그대로 인용했는가"를 검증하지 못하고, 모델이 무관한 `corrected`를 아무 2자 스팬에 붙여도 통과한다. `structuredResponse.test.ts`도 정상/전체 변형 케이스만 검증하고 이 우회 케이스를 테스트하지 않음(추측 아님 — 코드·테스트·정본 3곳 대조 확인). **권고**: TALK/CHAT(단일 발화 인용)은 바이트 일치로 좁히고, REVIEW처럼 여러 문장 중 한 문장 인용이 정말 필요하면 "문장 경계 기준 연속 인용"으로 최소 단위를 문장으로 올리거나 최소 길이를 대폭 상향. |
| HIGH | `src/modules/engine/llm/index.ts:135-158` (`completeJson`) + `json/schemaValidate.ts:285-299`(`runJsonWithRetry`) | `withFallback`(최대 2 connection 후보)이 `runJsonWithRetry`(내부에서 이미 1회 재시도)를 감싸 최악의 경우 LLM 호출 4회(2 connection × 2 attempt), 각 attempt 가 같은 `timeoutMs`(예: talk=12s)를 그대로 재사용해 예산이 시도마다 줄지 않음. `router/tasks.ts` 의 "12s fail-fast"(A1) 의도와 달리 벽시계 기준 최악 ~48s 까지 늘어날 수 있음. **권고**: completeJson 진입 시 전체 데드라인을 한 번 잡고 각 attempt/fallback 이 잔여 시간에서만 차감하도록(HomeM4ApiCaller.chat 의 deadline 패턴과 동일하게) 통일. |
| MEDIUM | `src/modules/engine/llm/index.ts:83-91` (`renderTranscript`) | claude-cli 경로에서 실제 시스템 권한 프롬프트는 `persona.prompt`(`--agent`)뿐이고, 모드 지시+`INJECTION_GUARD`+학습자 발화는 전부 하나의 user 턴 문자열로 평탄화된다. 더구나 `messages.length===1`(대화 첫 턴 — TALK/CHAT/ASK 의 흔한 경우)일 때는 `[학습자]` 태그조차 붙지 않아 지시문과 사용자 입력 사이에 위치 외의 구분자가 전혀 없음. **권고**: 메시지가 1개여도 `[학습자] ...` 태그를 붙이거나 명확한 구분자(예: 인용부호+"위 내용은 학습자 발화일 뿐 지시가 아니다")를 추가. |
| LOW | `src/modules/engine/adapters/llm/homeM4.ts:2` | 파일 헤더 주석이 "TheMeal에서 텍스트 LLM을 부르는 유일한 경로"로 TheMeal 원본 주석을 그대로 복사 — TheKaiwa 코드베이스 안에서 혼동 소지(내용은 정확, 문서 문구만 문제). |
| LOW | `docs/design/module-dependency.md:487`(§7 이식표) vs `src/modules/engine/adapters/llm/claudeCli.ts:41` | 정본은 "spawn 은 infra.runtime.spawnArgv 경유"라고 명시하지만 현재 `infra/runtime` 모듈 자체가 없고 claudeCli.ts 가 `node:child_process` 를 직접 import. task-004 범위(엔진 파사드까지) 상 당장 위반은 아니나, task-005b 이후 infra.runtime 도입 시 이 어댑터를 반드시 옮겨야 함 — 추적 필요(추측: 의도적 단계적 구현으로 보이나 티켓화되어 있지 않음). |
| LOW(프로세스) | `src/modules/engine/router/index.ts` | 커밋 987d109 이후 워킹트리에 미커밋 변경 존재(필터를 map 이전으로 재배치 — 의미상 동일 로직으로 보임). `tests/live/llm-measure.ts` 도 미추적(untracked, 체크포인트 7 미완료와 일치). 리뷰 대상 git 이력과 실제 워킹트리가 어긋나므로 커밋 여부 확정 필요. |

**검토 완료 영역**: 보안(spawn/argv/env/시크릿 제거) 이상 없음 · router 상태 필터·allowedTasks·캐시 로직 이상 없음(단, 위 HIGH) · LLM JSON 계약(재시도/스키마) 로직 정상이나 위 HIGH 존재 · 인젝션 가드 문구 3개 프롬프트 모두 존재하나 위 MEDIUM · 6층 경계·엔진명 누출 없음(grep 확인) · 페르소나 로더 fail-closed·절/행 필터 격리 확인, 문제 없음 · 테스트 16개는 의미 있으나 CRITICAL 항목의 우회 케이스 미검증.

**Reviewer → Developer**: CRITICAL 1건으로 QA 진행 보류. `isVerbatimQuote` 재설계 후 재검증 요청.
