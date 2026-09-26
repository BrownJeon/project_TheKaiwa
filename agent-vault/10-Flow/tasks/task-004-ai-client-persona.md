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
- [ ] 4. conversation: `structuredResponse/schemas.ts`(TALK·CHAT·REVIEW JSON 스키마 — 필드명은 api-contract #32 `done`: conversation{replyJa,replyReading,replyKo}·correction{required,original,corrected,explanationKo,errorType,severity,chunkType}|null·learning{grammarPoint,difficulty}·speech{style}·endOfTopic·proposals) + `checkOriginalVerbatim`(원문 바이트 일치 또는 원문 부분 문자열) · `window/`(bjj buildWindow) · `prompts/{talk,chat,chatReview}.ts` · `conversation/index.ts`
- [ ] 5. `tests/prompts/fixtures/talk-corrections.json` 20문장(오류 16: 行くました·学生だです·友だちを会いました·日本語が勉強·明日…行きました·おいしいでした·食べるか·趣味は本を読みます·バスで乗ります·きれいだです·寒いでした·本が借りました·私は名前は·静かの公園·言ってくれ·家を帰りました / 정답 4) + 단위 테스트(argv·페르소나 필터·스키마·원문 검사)
- [ ] 6. `scripts/sync-local.sh` 에 `.claude/agents/tutor.md`·`tests/` 미러 복사 추가 → 우분투 typecheck·lint·test
- [ ] 7. 실측 스크립트(`tests/live/llm-measure.ts`): talk 20문장 × haiku, `--json-schema` 켬/끔 비교, 경과 p50/p95·스키마 위반율·원문 일치 → `30-Knowledge/decisions/llm-japanese-quality.md`
- [ ] 8. reviewer → qa → 최종 요약

## 결정·메모
- **TALK 예산 해석**: 페르소나(1·3·4(수준 행)·6(TALK 행) ≈2,600자)는 `--agents` 시스템 프롬프트, "총 ≤3,000자" 는 사용자 프롬프트(모드·학습자 헤더·창·발화)에 적용. 실측 지연으로 재판단.
- **qwen 비교 보류**: thekaiwa 전용 `HOME_M4_API_KEY` 가 `.env` 에 비어 있음(다른 프로젝트 키는 쓰지 않는다) — 사용자 발급 후 진행.
- 미커밋 없음: 1~3 은 아래 WIP 커밋에 포함(아직 typecheck 전).
