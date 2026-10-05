---
task_id: task-037
title: "LLM JSON 구문 슬립 좁은 복구 (루트 조기 닫힘 — TALK·CHAT 한정 옵트인)"
status: in_progress
base_ref: 5a5c25c
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-036-remove-llm-reading-fields, task-019-cleanup-lint-env-strip, task-007-talk-voice-web, task-004-ai-client-persona]
tags:
  - type/task
  - domain/llm
  - domain/engine
aliases:
  - JSON 슬립 복구
  - extractJson 복구
  - task-037
created: 2026-10-05
updated: 2026-10-05
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[task-036-remove-llm-reading-fields]] 뒤 TALK 응답에서 **JSON 구문 슬립**이 늘었다(PE+QA 풀링 신규 8/176 vs 기존 1/164, Fisher p=0.038). 모양은 항상 같다 — 루트 객체를 한 칸 일찍 닫는다:

`{"speech":…,"conversation":{…},"correction":null,"learning":{…},"endOfTopic":false,"proposals":[]},"userKo":"…"}`
(`proposals` 뒤에 `}` 가 하나 더 나오고 그 뒤에 `,"userKo":…}` 가 이어짐 — `JSON.parse` 가 "루트 뒤 비공백 문자"로 실패.)

지금은 `parseError` → 1회 재시도(`runJsonWithRetry`)로 회복(실패 0)하지만 `done` 이 ≈1.5초 늦고 구독 호출이 한 번 더 든다. **그 한 칸을 결정적으로 고쳐 재시도를 없앤다.**

**설계 원칙 (judge R1 — 공용 파싱 경로 근처라 차분 퍼즈·옵트인으로 보강)**
1. **옵트인·요청 단위**: `extractJson` 자체는 바꾸지 않는다(전 프롬프트 A1~A11 공용). 이미 있는 `stripAdditionalProperties` 와 같은 방식으로 `ExtractOptions`·`RunJsonOptions`·`LlmRequest` 에 `repairRootClose?: boolean`(기본 false)을 추가하고 **TALK·CHAT 요청만 true**. 나머지 프롬프트(레슨 A4·평가·단어 보강 등)는 기본 false 로 동작 불변.
2. **복구는 좁고 결정적**: 원문(코드펜스 제거 후 첫 `{` 부터)에서 **문자열 리터럴을 인식하는 스캔**으로 루트 객체가 **처음 닫히는 위치** `i` 를 찾고, 그 뒤가 공백*·`,`·공백*·`"`(= 다음 키)로 시작하면 **그 `}` 하나만 지운 문자열**을 `JSON.parse` 한다. 루트가 객체여야 하고, 복구는 **한 번만**(여러 번·다른 모양은 복구하지 않음). 문자열 안의 `},"` 는 건드리지 않는다. **원문이 이미 파싱되면 복구 경로를 타지 않는다**(기존 결과와 바이트 동일 보장 — 차분 퍼즈 필수).
3. **검증은 그대로 엄격**: 복구된 객체도 ajv(`additionalProperties:false`·required)와 `extraCheck` 를 통과해야 한다. 복구 후 위반이면 기존 위반 경로(재시도)로 간다 — 복구가 계약을 느슨하게 만들지 않는다.
4. **관측**: 복구가 일어날 때마다 `console.warn('[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략')` (내용 없음 — 문장·응답 원문 금지) 한 줄과 결과의 `repaired: 'ROOT_CLOSE'`, 가능하면 `RequestTrace` LLM 단계에 `repaired` 표식 — **W1 감시가 복구 횟수를 셀 수 있게** 한다(재시도율로는 슬립 빈도를 못 본다).
5. 조기 음성(`turnAudio`)은 첫 호출의 스트림 조각을 쓴다 — 복구 성공 시 재시도가 없어 `earlyStop='RETRY'`·`AUDIO_TEXT_MISMATCH` 창이 줄어드는 부수 이득(REV-109 와 일관). 코드 변경은 필요 없음(확인만).

## 예상 변경 경로
- 신규 `src/modules/engine/json/repairRootClose.ts`(순수 함수 `repairRootClose(text): string | null`) 또는 `extractJson.ts` 에 export 추가(공용 `extractJson` 본문은 무변경)
- `src/modules/engine/json/schemaValidate.ts`(`ExtractOptions`·`RunJsonOptions`·`extractAndValidate`·`runJsonWithRetry`·`runJsonSoft`·`RunJsonResult.repaired`)
- `src/modules/engine/llm/index.ts`(요청 옵션 전달·결과 노출) · LLM 요청 타입(`repairRootClose?: boolean`)
- `src/modules/conversation/prompts/talk.ts`·`chat.ts`(요청 빌더에서 `repairRootClose: true`) — **프롬프트 문구·버전은 무변경**
- 테스트: 신규 `engine/__tests__/repairRootClose.test.ts` + `prompts.test.ts`(TALK·CHAT 만 켜짐 pin) + 필요 시 오케스트레이터 통합 1건
- 문서: `docs/design/api-contract.md`·`design-spec.md` §67 에 복구 옵션 한 줄(필요 시)
- 화면·DB·네이티브·persona·프롬프트 문구 변경 없음.

## 완료 기준 (QA 가 실행으로 확인)
1. **슬립 5건(task-036 PE 원자료 모양, 합성 문장으로 고정)** 이 복구되어 `runJsonWithRetry` 가 **재시도 없이(`attempts===1`)** 정상 객체를 돌려준다(옵션 on). 옵션 off(기본)면 지금과 같이 재시도(회귀 pin).
2. **차분 퍼즈**: 무작위 JSON·준JSON 텍스트 N≥10만 건에서 "기존 `extractJson` 이 성공하는 입력은 새 경로도 동일 결과(복구 미호출)", "복구가 나온 경우는 항상 루트 조기 닫힘 모양 한 가지뿐", 예외·무한 루프 0.
3. **음성 테스트**: 문자열 안 `},"`·루트 뒤 쓰레기(`{"a":1}}`·`{"a":1},{"b":2}`·배열 루트)·두 번 닫힘·중첩 깊은 모양은 복구하지 않는다(null) — 복구 후에도 ajv 위반이면 기존 재시도 경로.
4. TALK·CHAT 요청만 `repairRootClose: true`, 레슨·평가·단어 보강 등은 false(pin 테스트). `stripAdditionalProperties` 미적용(task-036 pin)은 그대로.
5. 개발 스모크 006·007 통과, 라이브 LLM 의존 없이 합성 슬립을 가짜 어댑터로 흘려 TALK 턴이 **LLM 1회**로 `done` 에 도달.
6. 마이그레이션·네이티브 0.

## 관련 과거 이력 요약
- [[task-036-remove-llm-reading-fields]]: W1 슬립 근거(PE 324회·QA 풀링 8/176 vs 1/164)·REV-108 권고 (B)(`extractJson` 좁은 복구는 감시 임계를 넘을 때 별도 task)·REV-109(조기 음성×슬립 — 복구하면 이 창도 줄어듦)·감시 임계(첫 TALK 100턴 `attempt=2` 8%·`ENGINE_ERROR` 1건). 운영 기준선 pm2-err.log `JSON 파싱 실패` 2줄(배포 전후 동일).
- [[task-019-cleanup-lint-env-strip]]: `stripAdditionalProperties` 옵트인 전례(A4 LESSON 한정, 공용 경로 불변) — 이번과 같은 방식.
- 승인된 교훈: 없음(`/이슈기록 관련` 0건).

## Judge 판정

- [2026-10-05 22:15] intake (Leader 가 `judge.mjs --input /tmp/judge-task-037-intake.json` 직접 실행 ×2 — 같은 결과, `/tmp/judge-task-037-intake.result.json`, `judge-result@2`·engine=jev·fallback 없음) → task_type=**local_fix** · complexity=1.68~1.72 · risk=**R1** · developer_model=**sonnet** · track=standard · demo=none(not_required) · next=assign · roles=developer·reviewer·qa · rule_overrides 없음.
- **Leader 판단**: judge 값 그대로(실호출모델=sonnet, 승격 규칙: 같은 결함 클래스 반려 2회·`maxTurns` 부분 종료 2회 시 opus). R2 보강 규칙(capability·ConfigurationVersion·`Correction.original`·`StatsSnapshot`)에 해당하지 않으나 공용 파싱 경로 근처라 **옵트인 + 차분 퍼즈**로 보수적으로 설계. Codex 는 한도 미기록 R1 이라 `CX-limit-unknown-hold` 예상(C2 에서 판정). PE 는 프롬프트 문구가 안 바뀌므로 호출 없음.
- `check.mjs init` → `not_required` 기록 완료.

## 판단 기록 (judge) — C2

- [2026-10-05 23:20] codex_gate C2 (Leader 직접 실행, `/tmp/judge-task-037-c2.json` → `/tmp/judge-task-037-c2.result.json`, `judge-result@2`·engine=jev·fallback 없음) → `codex_required: false` · `wanted_before_budget: false` · `budget_rule: CX-limit-unknown-hold` · `codex_calls_used: 0` · `codex_switch: on`. Codex 는 필요 없다고 판정(R1·옵트인·검증 불변). 입력 요약에 코드·diff·사용자 데이터 없음. override 없음.
- **Leader 좁은 재검증(REV-110 후속 반영 뒤, 2026-10-05 23:15)**: `dev-037c` 가 M-1·L-1·L-3·L-4 를 반영(변이 7건 killed·전체 1499/1500). 코드 변경은 `repairRootClose.ts` 비문자열 가드 1줄·주석뿐이라 reviewer 전면 재감사 대신 **REV-110 이 권고한 독립 퍼즈를 Leader 가 재실행**(`fuzz110.mts` 660,000건 — `FAILURES 0`·`maxCallMs 5.6ms`, 슬립 조립 `recovered==intended` 전부, 문자열 속 코드펜스 슬립 26,396/26,396 복구, 정상 입력 5종은 전부 `extractJson` 성공=복구 null) + `nonstr110.mts`(비문자열 `{}`·`undefined`·`null`·`["a"]` 옵션 on/off 모두 `{ok:false, parseError:true}` 동일) — 미러·NFS `repairRootClose.ts` `cmp` 동일. 재감사가 필요하다고 보면 사용자가 지시.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-05 21:28 |

## Developer 기록

- [22:3x] **체크포인트 ③ (배선 완료)** — 완료: `engine/json/repairRootClose.ts` 신규(순수 함수, 첫 글자 `{`·문자열 인식 스택 스캔·첫 닫힘 뒤 `,"`·되돌린 스캔이 마지막 글자에서 정확히 한 번 더 닫힘) · `schemaValidate.ts`(`ExtractOptions`·`RunJsonOptions`·`AnalyzeResult`/`RunJsonResult.repaired`·`extractAndValidate`: extractJson 실패+옵션 on 일 때만 복구→JSON.parse→ajv·extraCheck 그대로·`runJsonWithRetry`·`runJsonSoft`·`runJsonAnalysis` 전달·`noteRepair` 한 줄 warn) · `llm/index.ts`(`LlmJsonRequest.repairRootClose`·`LlmJsonResult.repaired`·`completeJson` 전달) · `prompts/talk.ts`·`chat.ts`(`repairRootClose: true` 한 줄씩, 프롬프트 문구·버전 무변경) · `orchestrator/index.ts` LLM 단계에 `repaired` 표식(조건부 spread 1줄). typecheck 통과(미러). 남은 일: 테스트(repairRootClose·prompts pin·task007 통합)·변이·문서·증빙. 다음 첫 행동: `engine/__tests__/repairRootClose.test.ts` 작성. 미커밋: 위 7개 파일(+ 이 이력서).
- [23:0x] **체크포인트 ④ (테스트 작성 완료, 변이·문서·증빙 남음)** — 완료: ① `engine/__tests__/repairRootClose.test.ts` 신규 14건(슬립 합성 5·음성 29줄·복구 후 ajv/extraCheck 엄격·복구본 JSON.parse 실패=옛 parseError·strip 병용·**차분 퍼즈 120,000건 ≈7s**·`runJsonWithRetry`/soft 재시도·로그 한 줄) ② `conversation/__tests__/prompts.test.ts` +2건(build*Request 10개 전수 pin — TALK·CHAT 만 true, prompts/ 소스 스캔으로 빌더 누락 방지·실제 TALK/CHAT 스키마+extraCheck 로 슬립 복구) ③ `conversation/__tests__/task007.test.ts` +1건(슬립 → 옵션 on 이면 LLM 1회·earlyStop≠RETRY·조기 음성이 최종 음성 / off 는 RETRY) ④ 신규 `conversation/__tests__/task037.test.ts` 4건(가짜 HTTP LLM 서버로 **실제 completeJson**·**실제 startTurn** 관통 — LLM 1회·done·RequestTrace LLM 단계 `repaired=ROOT_CLOSE`). 남은 일: 변이 확인(미러 사본에서만, cmp 원복)·문서 2곳·실행 증빙. 다음 첫 행동: 문서(api-contract·design-spec §67) → 변이 스크립트. 주의점: Prisma 모델 델리게이트는 Proxy 라 `mock.method(prisma.requestTrace,'create')` 불가 — `Object.defineProperty(prisma,'requestTrace',…)` 로 바꿔 끼우고 원복(task037.test.ts `captureTraces`). 미커밋: schemaValidate.ts·llm/index.ts·repairRootClose.ts·prompts/{talk,chat}.ts·orchestrator/index.ts + 테스트 4파일 + 이 이력서.
- [22:1x] **체크포인트 ⑤ (신규 developer 인수 — 점검·변이·문서·증빙 완료)** — 완료: (1) 설계 원칙 ①~⑦ 점검 — ① `extractJson.ts` 변경 0줄(git diff 無) ② 옵션 기본 false·`build*Request` 10개 전수 pin(TALK·CHAT 만 true, `prompts/` 소스 스캔으로 빌더 누락 방지) ③ 복구는 `extractAndValidate` 의 `extractJson` **catch 안에서만** 호출(성공 입력은 복구 미호출 — 차분 퍼즈로 증명) ④ 복구 객체도 `validateOutput`(ajv)·`extraCheck` 를 그대로 통과(변이 ⓑ1~ⓑ3 killed) ⑤ 로그는 `[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략`(경로 2문구 중 앞부분 동일, 내용 없음) ⑥ `orchestrator/index.ts` 변경 = RequestTrace **LLM 단계에 조건부 spread 1줄**(`repaired:'ROOT_CLOSE'`) — `done`·SSE·toolLog 불변, 그 밖 변경 없음 ⑦ 프롬프트 문구·`*_PROMPT_VERSION` 상수 diff 0(talk·chat 은 옵션 줄+주석만 +2줄). (2) **점검에서 고친 것 2건** — ㉠ 변이 ⓒ2(`completeJson` 이 옵션 기본값을 true 로) 가 **생존** → `task037.test.ts` 에 "옵션 값이 undefined 인 TALK 요청 → 복구 안 하고 재시도(2회)" 케이스 추가, ㉡ 같은 파일의 "옵트인하지 않은 요청(단어 보강)" 음성 테스트가 **빈 증명**이었음(슬립 본문이 TALK 모양이라 복구돼도 단어 보강 스키마 위반 → 같은 결과) → 슬립을 **단어 보강 스키마를 통과하는 문서**의 슬립(`wordSlip`)으로 교체(복구가 켜졌다면 1회로 성공했을 입력) — 두 재변이 모두 killed. ㉢ `docs/design/api-contract.md` 계측 줄(§#의 `RequestTrace` 단계 키 목록)에 LLM 단계 `repaired` 키 누락 → 추가. (3) 문서 2곳 사실 확인 — design-spec §67 한 줄·api-contract 구문 슬립 복구 항("복구되어도 ajv·후검증은 그대로 엄격·옵트인·extractJson 실패 응답에만·SSE/done 불변") 모두 구현과 일치, 과장 없음. 남은 일: 없음(체크포인트 ⑥ 최종 요약 → Reviewer 인계). 미커밋: src 변경 파일 + 테스트 4파일 + 문서 2곳 + 이 이력서(커밋·푸시 금지 — push=운영 배포).
- [22:1x] **변이 결과표 (미러 사본에서만 적용, 변이마다 NFS 원본으로 복사 원복 후 `cmp` 일치 확인 — 전 파일 일치)** — 대상 테스트 4파일(repairRootClose·task037·prompts·task007, 정상 70건 전부 pass 기준선).

| 변이 | 내용 | 결과 | killed 한 테스트(요지) |
|---|---|---|---|
| ⓐ | `repairRootClose` 문자열 인식 제거(`inString=true` 무력화 — 따옴표 안 `},"` 도 닫힘으로 셈) | KILLED 5 | 슬립 합성 5건 · 음성 29줄 · **차분 퍼즈** · runJsonWithRetry 5건 on/off · soft 경로 |
| ⓑ1 | 복구본 ajv 검증 우회 | KILLED 7 | 복구 후 ajv·extraCheck 엄격 · runJsonWithRetry 복구 후 위반 · strip 병용 · 퍼즈 · TALK·CHAT 실스키마 · completeJson(CHAT) |
| ⓑ2 | 복구본 extraCheck 우회(`evaluateAttempt`) | KILLED 1 | runJsonWithRetry: 복구 후 ajv 위반이면 기존 위반 경로(extraCheck 위반도 같다) |
| ⓑ3 | 복구본 extraCheck 우회(soft `runJsonSoft`) | KILLED 1 | soft 경로: 복구한 1차 응답에 extraCheck 위반이면 재시도 |
| ⓒ1 | 옵션 기본값 true(`extractOptionsOf`) | KILLED 2 | runJsonWithRetry 슬립 5건 on/off · soft 경로 off |
| ⓒ2 | 옵션 기본값 true(`completeJson`) | **생존 → 테스트 보강 후 KILLED 1** | completeJson(TALK) — 옵션 undefined 케이스(보강분) |
| ⓒ3 | 빌더 하나가 true(wordEnrich) | KILLED 2 | build*Request 전수 pin · 옵트인하지 않은 요청 음성(`wordSlip`, 보강 후) |
| ⓒ4 | 빌더 하나가 true(lesson A4) | KILLED 1 | build*Request 전수 pin |
| ⓒ5·ⓒ6 | TALK / CHAT 빌더에서 옵션 제거 | KILLED 4 / 3 | pin · 실스키마 슬립 · completeJson · startTurn(TALK) |
| ⓓ1 | 복구를 `extractJson` 보다 먼저 시도(순서 뒤집기) | **SURVIVED — 관찰 동치(사유 아래)** | — |
| ⓓ2 | ⓓ1 + repair 가 이미 정상 닫힌 입력도 문자열을 돌려줌(= 파싱되는 입력에도 복구 적용) | KILLED 7 | 음성 · 퍼즈 · 정상 1차 응답 불변 · 슬립 합성 등 |
| ⓓ3 | repair 함수만: 정상 닫힘 입력도 반환(호출 순서는 원본) | KILLED 3 | 슬립 합성 · 음성 · 퍼즈(`extractJson` 성공 입력은 복구 후보 null) |
| ⓔ1 | "그 뒤가 `,"` 로 시작" 조건 제거 | KILLED 2 | 음성(`{"a":1}}` 등) · 퍼즈 |
| ⓔ2 | 같은 조건 약화(`,` 만 보면 통과) | KILLED 2 | 음성(`{"a":1},{"b":2}}` 등) · 퍼즈 |
| ⓕ | "되돌린 문자열이 정확히 마지막 글자에서 닫힘" 검사 제거 | KILLED 2 | 음성(슬립 뒤 쓰레기·`}` 하나 더) · 퍼즈 |
| 추가 | g(되돌려 놓은 `}` push 제거)·h(첫 글자 `{` 조건 제거)·i(로그에 응답 내용)·j(Trace 표식 제거)·k(`completeJson` 결과 repaired 제거)·l(표식 미부착)·m5(괄호 짝 검사 제거)·m7(soft 표식 떨굼)·m9(옵션 미전달)·m11(지우는 `}` 가 마지막 글자) | 전부 KILLED(17·2·3·1·3·13·2·5·3·16) | — |

**ⓓ1 생존 사유**: `repairRootClose` 가 `extractJson` 이 파싱하는 입력에 항상 `null` 을 돌려주는 **불변식**을 따로 pin(퍼즈 안 `extractJson` 성공 입력 54,000건 전부 `fixed===null`, 그리고 ⓓ2·ⓓ3 이 이 불변식을 깨면 killed) — 그래서 호출 순서만 뒤집어도 모든 입력에서 결과가 같다(관찰 동치 변이). 구조상 "복구는 `catch` 안에서만 호출" 은 코드 리뷰 항목으로 둔다.
- [22:1x] **실행 증빙** (개발 미러 `~/.node-local/thekaiwa`, 출력 `| head` 없음): `npm run typecheck` → rc 0 · `eslint src/modules/engine src/modules/conversation` → rc 0(출력 0바이트) · `engine/__tests__` 전체 141건 141 pass · `conversation/__tests__` 전체 424건 424 pass · **전체 `npm test` 1497건 중 1496 pass · 1 skip · 0 fail**(직전 기준 1476 → +21 = repairRootClose 14 + prompts +2 + task007 +1 + task037 4) · 차분 퍼즈 로그 `[task-037 fuzz] {"texts":120000,"extractOk":54000,"notRepaired":28555,"repairedOk":17685,"repairedViolation":19760,"constructedSlips":33472,"repairNonNullButUnparsable":2949,"ms":7551}`(텍스트·스키마 쌍 기준 — 조립한 슬립 33,472건 전부 원 객체로 복구, 예외·무한 루프 0, 7.5초). 라이브 LLM·운영 포트·pm2 무접촉. 엔진명 grep(변경 파일) — 신규 누출 0(`schemaValidate.ts` 주석의 기존 `Claude CLI` 문구 2곳은 이번 변경 아님).
- [22:1x] **체크포인트 ⑥ (최종 요약 — Reviewer 인계)** — **변경 파일**: 신규 3 — `src/modules/engine/json/repairRootClose.ts`(순수 함수) · `src/modules/engine/__tests__/repairRootClose.test.ts`(14건) · `src/modules/conversation/__tests__/task037.test.ts`(4건, 가짜 HTTP LLM 서버로 실제 `completeJson`·`startTurn` 관통); 수정 — `engine/json/schemaValidate.ts` · `engine/llm/index.ts` · `conversation/orchestrator/index.ts`(Trace 표식 1줄) · `conversation/prompts/{talk,chat}.ts`(옵션 줄+주석, 프롬프트 문구·버전 무변경) · `conversation/__tests__/{prompts,task007}.test.ts`(+2·+1건) · `docs/design-spec.md`(§67 한 문장) · `docs/design/api-contract.md`(구문 슬립 복구 항 + 계측 줄에 `repaired` 키). **알고리즘**: `extractAndValidate` 가 `extractJson` 실패 + 요청이 `repairRootClose` 를 켠 경우에만 `repairRootClose(text)` 를 한 번 호출 — 코드펜스 제거 후 첫 글자가 `{` 이고, 문자열 리터럴(따옴표·`\` 이스케이프)을 인식하는 스택 스캔으로 루트가 **처음 닫히는** 위치 `i` 를 찾아 그 뒤가 `공백* , 공백* "` 일 때만 `}` 하나를 지운 문자열을 만든다(되돌려 놓은 셈으로 스캔을 이어 정확히 마지막 글자에서 한 번 더 닫혀야 함). 그 문자열을 `JSON.parse`(실패하면 옛 parseError) → 객체 확인 → **ajv·`extraCheck` 그대로** → 통과하면 `{ ok:true, data, repaired:'ROOT_CLOSE' }`. `runJsonWithRetry`/`runJsonSoft` 는 `attempts:1` 로 끝내고 `noteRepair` 로 내용 없는 한 줄을 남기며 `repaired` 는 **`data` 의 출처**를 따른다(재시도 응답이 data 면 표식 없음). `completeJson` → `LlmJsonResult.repaired` → orchestrator 가 Trace LLM 단계에 기록. **남은 위험**: ① 복구본 JSON 안 **문자열 값에 원본 개행**이 있으면(`extractJson` ③ 는 이스케이프해 주지만 복구는 안 함) 복구가 실패해 옛 재시도 경로로 간다 — 안전하지만 그 슬립은 절약되지 않음(좁게 두는 선택, 테스트로 pin) ② 슬립이 **다른 모양**(내부 객체만 조기 닫힘·두 번 닫힘·서문 섞임)이면 복구하지 않고 옛 재시도 — 엄격 스키마(`additionalProperties:false`·required)가 오복구 안전망(복구해서 스키마가 통과하려면 이동한 키가 정말 루트 키여야 함) ③ 로그 문구 2종(`재시도 생략` / `재시도 경로에서 복구본 사용`) — W1 은 접두 `구문 슬립 복구(ROOT_CLOSE)` 로 센다 ④ 프롬프트 키 순서가 바뀌어 `userKo` 가 마지막이 아니게 되어도 복구는 키 이름에 의존하지 않음(모양만 본다). **Reviewer 중점 후보**: ㉮ 복구 호출이 `extractJson` catch 안에서만 일어나는지(ⓓ1 이 관찰 동치라 구조 확인 필요) ㉯ `runJsonSoft` 의 `from()`·`noteRepair` 분기가 data 출처와 일치하는지(s1 복구 + extraCheck 위반 → s2 성공이면 표식 없음) ㉰ `noteRepair` 로그에 응답 내용이 없는지 ㉱ orchestrator Trace 표식 1줄이 `done`·SSE·toolLog 에 영향 없는지 ㉲ 테스트의 `Error.stackTraceLimit=0`(퍼즈 한정, finally 원복)·`captureTraces`(Prisma Proxy 델리게이트 교체·원복) 보조 코드 ㉳ api-contract 계측 줄에 내가 더한 `repaired` 표기. self_check: unit_test ✓ · lint ✓ · type_check ✓ · engine_name_leak ✗(없음) · native_change ✗(없음, 마이그레이션 0).
- [22:48] **체크포인트 ⑦ (REV-110 M-1·L-1·L-3·L-4 반영 — 신규 developer, Reviewer 재순환 대상)** — 완료(지시받은 4건만, 복구 알고리즘·`extractJson`·프롬프트·버전·persona·스키마·화면·`engine/adapters` 변경 0): ① **M-1** `conversation/__tests__/task037.test.ts` `captureTraces` — 원래 델리게이트 값(`original`)을 먼저 잡고 `{ configurable, writable, enumerable, ...originalDescriptor, value: original }` 로 복원, 반환에 `original` 추가(`prisma.requestTrace` 가 없으면 즉시 실패), `startTurn(TALK)` 테스트 끝에 `trace.restore()` 뒤 `prisma.requestTrace === trace.original` 단언 1줄(`t.after` 의 restore 는 그대로 — 멱등). ② **L-3** `engine/json/repairRootClose.ts` 맨 앞에 `typeof text !== 'string'` → `null` 가드(WHY 주석) — `schemaValidate.ts` 는 이번에 손대지 않음(복구 호출이 `try` 밖이어도 함수가 안 던지므로 옵션 on/off 의 오류 의미가 같아진다). 테스트 `repairRootClose.test.ts` +1건: `undefined·null·0·42·true·{}·{a:1}·['a']·[]` 에서 `repairRootClose===null`, `extractAndValidate` 옵션 on == off == `{ok:false,parseError:true}`. ③ **L-4** `prompts.test.ts` +1건(src 전체를 재귀 스캔해 테스트(`__tests__`·`*.test.ts`) 제외 파일 중 `/repairRootClose\s*[:=]\s*true\b/` 가 나오는 파일 = 정확히 `modules/conversation/prompts/{chat,talk}.ts`, 실패 문구에 "TALK·CHAT 빌더에서만 켠다(task-037 옵트인 경계)… 허용 목록 밖에서 켠 파일: …" 포함, `scanned > 100` 로 빈 증명 방지) + `repairRootClose.test.ts` +1건(`runJsonAnalysis` 가 옵션을 그대로 넘기는지 — `true` 는 슬립 복구(호출 1회·`repaired`), `undefined`·`false` 는 재시도(호출 2회·`repaired` 키 없음); 기존에 `runJsonAnalysis` 전달 줄을 고정하는 테스트는 없었다). ④ **L-1** `repairRootClose.ts` 머리 주석·조건 1·`docs/design/api-contract.md`(구문 슬립 복구 항)·`docs/design-spec.md`(§67 한 문장) 를 "`extractJson` ② 와 같은 **전역 코드펜스 표식 제거**를 거친 텍스트에서 `}` 하나를 지운다(문자열 값 안의 코드펜스 표식도 지워질 수 있음 — 슬립과 겹칠 확률 매우 낮고 `correction.original` 은 후검증 `extraCheck` 바이트 일치가 막는다)"로 정정(동작 변경 없음). **다른 테스트의 Prisma 복원 결함 점검**: `Object.defineProperty(prisma,…)`·`getOwnPropertyDescriptor` 사용처는 `task037.test.ts` 하나뿐. `task026s2`·`task007`·`task006`·`task010`·`task010c`·`sceneCap` 등은 `infra` 를 import 해도 `prisma` 를 직접 바꾸지 않음(`*Deps` 객체에 `mock.method`). 유일한 다른 교체는 `speech/tts/__tests__/lexiconCompoundGuard.test.ts:273` — `delegate.findFirst = …` 후 `finally` 에서 값(`original`)으로 되돌리는 방식이라 M-1 같은 undefined 복원 결함은 **없음**(프로브: 복원 뒤 `delegate.findFirst === original`). 다만 위임 객체의 `findFirst` 는 get 때마다 새 함수라 복원 후 자기 속성(원래 함수 값)이 남아 get 트랩을 가린다 — 동작은 동등, 이번 범위 밖이라 **손대지 않음**(원하면 별 task). 주의점: 스크래치 사본에서 변이를 돌릴 때 `prisma/`(seed-data json) 도 사본에 복사해야 `task037.test.ts` 가 로드된다(첫 시도는 파일 단위 실패 — 변이 결과가 아니라 하네스 누락, 이후 `prisma` rsync 추가 후 재실행했고 첫 실행 로그는 `mut038-run1-harness-missing-prisma.log` 로 구분). 미커밋: 위 파일 + 이 이력서.
- [22:48] **REV-110 반영 변이 결과** (스크래치 사본 `scratchpad/m038` = 미러 `src`·`tests`·`.claude`·`prisma` rsync + `node_modules` 심볼릭 링크, 대상 3파일 `repairRootClose·task037·prompts` 기준선 **52/52 pass**, 변이마다 미러에서 rsync 원복 후 NFS 원본 `src` 와 전체 `cmp` → 7건 전부 `RESTORE_CMP OK`; 사본의 `.env` 복사본은 삭제함):

| 변이 | 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|
| L3 | `repairRootClose` 의 `typeof text !== 'string'` 가드 제거 | KILLED(1) | `REV-110 L-3: 문자열이 아닌 입력…`(`repairRootClose(undefined)` 가 TypeError) |
| L4-c8 | `learning/repetition/decision.ts` 호출부 `{...request, priority:'batch', traceId, repairRootClose: true}`(빌더 밖) | KILLED(1) | `task-037 L-4: src 전체…`(기존 build*Request pin 은 통과 — 이 변이가 REV-110 c8 생존분) |
| L4-c8b | `learning/vocab/enrich.ts` `completeJson({...request, repairRootClose:true})`(공백 없는 표기) | KILLED(1) | `task-037 L-4: src 전체…` |
| L4-builder | `prompts/lesson.ts`(A4 빌더) 가 `repairRootClose: true` | KILLED(2) | `task-037 L-4: src 전체…` + 기존 `task-037: repairRootClose 는 buildTalkRequest·buildChatRequest 만 true…` |
| L4-c7 | `runJsonAnalysis` 가 옵션을 넘기지 않음 | KILLED(1) | `REV-110 L-4: runJsonAnalysis 는 repairRootClose 를 그대로 넘긴다…`(REV-110 c7 생존분) |
| L4-c7b | `runJsonAnalysis` 가 옵션을 항상 `true` 로 | KILLED(2) | `REV-110 L-4: runJsonAnalysis…` + `task-037 L-4: src 전체…`(리터럴 `true` 가 `schemaValidate.ts` 에 생김) |
| M1 | 옛 복원 방식(`originalDescriptor` 만으로 `defineProperty` — value undefined) | KILLED(1) | `startTurn(TALK): 슬립 응답으로도 LLM 1회에…`(끝의 복원 단언 — `prisma.requestTrace` 가 undefined) |

- [22:48] **실행 증빙 (REV-110 반영 후)** — 개발 미러 `~/.node-local/thekaiwa`(`sync-local.sh` 후), 출력 `| head` 없음: `npm run typecheck` → rc 0(출력 0바이트) · `node node_modules/eslint/bin/eslint.js src/modules/engine src/modules/conversation` → rc 0(0바이트) · `engine/__tests__` 전체 **143건 143 pass**(직전 141 → +2: L-3·runJsonAnalysis) · `conversation/__tests__` 전체 **425건 425 pass**(직전 424 → +1: L-4 소스 스캔) · **전체 `npm test` 1500건 중 1499 pass · 1 skip · 0 fail**(직전 1497 → +3). 대상 4파일(repairRootClose·task037·prompts·task007) 73/73. 라이브 LLM·운영 포트·pm2·`/home/brownjeon/apps/thekaiwa` 무접촉, 커밋·푸시 없음. L-1~L-3 가 `repairRootClose.ts` 를 건드렸으므로 REV-110 권고대로 Reviewer 부터 재순환(독립 퍼즈 `fuzz110.mts` `ROUNDS=3 PER=400000` 재실행 — 함수 본문은 가드 한 줄·주석만 달라졌고 알고리즘은 불변).

## Reviewer 기록 (REV-110, 2026-10-05, standard 트랙 · Read 전용)

> 코드 수정 0(변이·퍼즈·재현은 개발 미러 사본 `scratchpad/m110`·스크래치 스크립트에서만, 변이마다 NFS 원본에서 복사 원복 + `cmp` 일치 확인 → `RESTORE_CMP OK`). 라이브 LLM·운영(`/home/brownjeon/apps/thekaiwa`)·pm2·운영 포트·운영 DB 무접촉. 작업 트리의 `CLAUDE.md` 변경은 다른 세션 것이라 감사 제외. Codex 검토 결과는 이 시점 이력서에 없음(C2 판정은 Leader).

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 4 · Info 4. `native_change: false`(plugins·android·capacitor·Manifest·마이그레이션 0). 데모 게이트: 화면 변경 없음 — `check.mjs check` → `DEMO_GATE_PASSED`(status not_required). Sonnet developer 반려 횟수 0(이번이 첫 감사) → Opus 승격 권고 없음.

### 중점별 결론

1. **복구 함수 정확성·안전성 — 충족.** `repairRootClose.ts` 정독 + 적대 입력 직접 조립. 문자열(따옴표·`\\`·`\"`·`\uXXXX`·서러게이트·lone surrogate·원본 개행) 인식 정확, 괄호 스택 불일치 시 null, 첫 닫힘 뒤 `\s*,\s*"` 조건·"마지막 글자에서 정확히 한 번 더 닫힘" 검사 완전. 재귀 없음·O(n): 10MB 문자열 값 + 슬립 117ms, 깊이 50만 배열 24ms, 공백 200만 개 24ms(백트래킹 폭발 없음), 예외 0. 적대 입력 23종(`adv110.mts`): 서문/후문/코드펜스(서문 있는 슬립·후문 있는 슬립·`{메모}` 서문 → null 또는 복구본이 JSON.parse 불가), 슬립 2·3곳 → null, 배열 루트·빈/공백·BOM(복구됨, extractJson ② 와 동일 trim)·숫자 키(`1:2`)·따옴표 없는 키·작은따옴표 키 → null, 문자열 값 안 `},"`·`}`·`{` → 건드리지 않음. **복구 대상 텍스트 = `extractJson` ② 와 같은 코드펜스 제거본(`cleaned`)이며 첫 글자가 `{` 일 때만** — 서문/`{`~`}` 부분문자열(③)은 복구 대상이 아니라서 서문·후문의 `{`·`}` 로 인한 오복구 경로 없음(서문 변형 72,015건 전부 null). 단 L-1(문자열 값 안 ``` 도 제거)·L-2(원본 개행 미복구)·L-3(비문자열 입력) 참고.
2. **기존 동작 불변 — 충족.** ① `extractAndValidate` 는 `try { extractJson } catch { 복구 }` 구조(`schemaValidate.ts:288-296`) — 복구는 catch 안에서만 호출된다. 개발자 변이 ⓓ1(순서 뒤집기) 생존에 대한 의견은 아래 "ⓓ1 의견". ② 옵션 off: `extractOptionsOf` 가 `repairRootClose:false` 를 넘기고 반환 객체에 `repaired` 키가 아예 없으며(스프레드 조건부) `noteRepair` 는 `repaired` 없으면 즉시 return — 정상 1차 응답 `deepStrictEqual(on, off)`·`warns=[]` 테스트 + 내 퍼즈(옵션 on/off 결과 동일, `'repaired' in on` 0건)로 확인, 변이 c1·c2(기본값 true) killed. ③ 복구 객체는 `parsed` 로 합류해 `stripAdditionalProperties → validateOutput(ajv) → (evaluateAttempt)extraCheck / (soft)extra()` 를 그대로 거친다 — 우회 경로 0(변이 b1·b2·b3 killed, 내 퍼즈: 복구 후보 ≈417k 중 JSON.parse 가능분은 `on` 결과가 `validateOutput(JSON.parse(복구본))` 결과와 정확히 같고, 불가분은 옛 parseError 와 같음). ④ 복구 후 위반이면 `{ok:false, parseError:false, violations}` → 기존 재시도, 재시도 상한 1회·`JsonSchemaError` 타입·`attempts` 의미 불변(`completeJson`·`runJsonWithRetry` 테스트). 문구 차이는 I-1.
3. **독립 차분 퍼즈 — 불일치 0.** 개발자 퍼즈(mulberry·`genObject/genTalkDoc`·120,000건·시드 고정)와 다른 PRNG(xorshift128/splitmix32)·생성기·오라클로 **1,200,000건**(3시드 × 400,000, 95s, 호출당 최대 6ms). 11개 가족: 정상 compact/pretty/원본개행, 서문·후문·펜스 래핑(중괄호 포함), 실제 TALK 슬립(userKo·들여쓰기·펜스), 실제 TALK 문서의 **임의 구조 쉼표 앞에 `}` 삽입(1~3곳)**, 일반 객체 `}` 삽입, 슬립+원본 개행, 슬립+서문/후문, `}`/`{`/`,`/`"` 삭제 변이, 토큰 잡음, 인접 교환, 루트 직속 다중 슬립, 슬립+문자열 속 ``` . 단언: (I1) `extractJson` 성공 입력 ≈306k 전부 `repairRootClose===null` 이고 옵션 on/off 결과 동일; (I2) 복구본 = cleaned 에서 `}` 한 글자 삭제; (I3) **독립 오라클** — 복구본이 JSON.parse 가능하면 `{...JSON.parse(첫 닫힘까지), ...JSON.parse('{'+나머지)}` 와 deepStrictEqual(≈417k 복구 후보 중 JSON.parse 가능분 전부 일치); (I4) 복구본 불가이면 옵션 on 결과 = 옛 parseError. 예외·무한 루프 0. 복구율: 조립 TALK 슬립 `…proposals},"userKo":…}`(펜스·들여쓰기 포함) **119,817/119,817 = 100% 원 객체로 복구**; 문자열 속 ``` 포함 슬립 47,921/47,921 구조 복구(내용은 L-1); **문자열 값 안 원본 개행이 든 슬립 71,842건 중 13,758건(19.2%)만 복구, 80.8% 는 JSON.parse 실패 → 옛 parseError(재시도)로 안전하게 폴백**; 임의 쉼표 앞 `}` 삽입(단일) 104,525건 중 91,821건이 후보가 되고 52,355건은 원 객체와 일치(루트 직속 위치), 39,466건은 "구조는 파싱되지만 원 의도와 다른" 복구(중첩 객체를 일찍 닫은 슬립 — 키가 루트로 이동)였으나 **실제 `TALK_SCHEMA`·`CHAT_SCHEMA` ajv 를 통과한 것 0건**(루트 `additionalProperties:false` + 중첩 required — 개발자가 말한 "엄격 스키마가 오복구 안전망" 을 정량 확인); 슬립 2·3곳(15,875건)·서문·후문 섞인 슬립(72,015건)은 복구 0(좁게 둔 의도대로 재시도). **발생 가능성 평가**: 실측 슬립 5/5(task-036 REV-109)가 전부 `…"proposals":[]},"userKo":"…"}` 한 문자열이고 한 줄 문장·`correction:null` 턴이라 W1 모양의 복구율은 사실상 100% 로 본다. 원본 개행이 든 슬립은 TALK 의 `replyJa/replyKo`(한두 문장) 에서는 거의 없고 `explanationKo`(여러 줄 설명) 에서만 가능 — 곱(슬립 × 원본 개행) 이 희박해 Low(L-2).
4. **옵트인 경계 — 충족(L-4 보강 권고).** `build*Request` 10개 전수(`rg 'export function build\w+Request'`): `buildTalkRequest`·`buildChatRequest` 만 `repairRootClose: true`(`rg 'repairRootClose: true' src` 비테스트 2곳 = talk.ts:329·chat.ts:49). 나머지(레슨 A4·평가 A6/A7·반복 판단 A11·reviewMix A5·단어 보강 A10·chatReview A3·userTranslation)는 키 없음. `prompts.test.ts` pin 은 `prompts/*.ts` 소스 스캔으로 빌더 누락을 막고 변이 c3(단어 보강 true)·c5/c6(TALK·CHAT 옵션 제거) killed. `completeJson` 은 `withFallback` 콜백 안에서 `req.repairRootClose` 를 매번 읽으므로 폴백 connection 에서도 유지 — 스크래치 테스트(`fb110.test.ts`: A connection 두 번 비JSON → `JsonSchemaError` → B 에서 슬립 복구, `connectionKey==='B'`·attempts 1·repaired ROOT_CLOSE)로 실증. `engine/adapters` 본문·`extractJson.ts`·persona·프롬프트 문구/`*_PROMPT_VERSION`·`prisma/`·화면은 `git diff` 0줄 확인(talk·chat 은 옵션 줄 + 주석만).
5. **관측·로그·트레이스 — 충족.** `noteRepair` 로그는 `[json] 구문 슬립 복구(ROOT_CLOSE) — {재시도 생략|재시도 경로에서 복구본 사용}` 고정 문구뿐(변이 m9 로 로그에 data 를 넣으면 3건 killed). 두 문구 의미를 return 지점 7곳에 대입해 확인: `runJsonWithRetry` r1 수용 → "생략"(1차 응답 그대로), r2 수용 → "재시도 경로에서 복구본 사용"; soft 의 s1 수용(v1 없음) → "생략", 재시도 호출 실패 시 s1 로 복귀·s2 수용·s1 로 복귀 → "재시도 경로…" — 전부 정확. `repaired` 는 **`data` 의 출처**를 따라가므로 W1 접두 `구문 슬립 복구(ROOT_CLOSE)` 로 센 로그 수 = Trace `repaired` 표식 턴 수(둘 다 "복구본이 data 로 채택된 응답"에서만; 복구했지만 extraCheck/ajv 에 걸려 버려진 슬립은 둘 다 안 센다 — I-3). orchestrator 변경은 `steps.push({name:'LLM',…})` 안 조건부 스프레드 1줄뿐 — `done`·SSE·`toolLog`·`attempts` 필드 불변(diff 단일 hunk). `TraceStep` 값 타입(짧은 식별자)에 맞고 응답 문장은 Trace 에 없음(`task037.test` 가 `JSON.stringify(steps)` 에 문장 부재 단언). 조기 음성: 복구 성공 시 call 2 가 없어 `earlyStop` 이 `RETRY` 로 닫히지 않고(task007 신규 테스트 + task037 통합), 최종 `replyJa` = 스트림으로 나간 문장이라 `AUDIO_TEXT_MISMATCH` 창이 줄어든다 — `turnAudio` 코드 무변경. 스트림 리더는 슬립 위치(꼬리)보다 한참 앞의 `conversation.replyJa` 만 읽는다.
6. **테스트 품질 — 충족(M-1 외).** 개발자 변이표 재현: ⓐ(문자열 인식 제거) KILLED 5 · ⓑ1 KILLED 7 · ⓑ2/ⓑ3 KILLED 1·1 · ⓒ1 KILLED 2 · ⓒ2 KILLED 1(보강 후) · ⓒ3 KILLED 2 · ⓒ5/ⓒ6 KILLED 4/3 · ⓔ1/ⓔ2 KILLED 2/2 · ⓕ(마지막 글자 검사 제거) KILLED 2 · g(되돌린 `}` push 제거)·h(첫 글자 `{` 조건 제거)·k(괄호 짝 검사 제거)·m5(Trace 표식 제거)·m6·m7·m9 KILLED — 개발자 표와 전부 일치, ⓓ1 SURVIVED(관찰 동치) 일치. "보정한 음성 테스트(단어 보강)" 는 의미 있음: 변이 c3(단어 보강 빌더가 true) 에서 이 테스트가 killed 된다(복구가 켜져 있었다면 1회로 성공했을 입력이라는 설계 확인). 보조 코드: `Error.stackTraceLimit=0` 은 `try/finally` 로 원복되고 퍼즈 한정 — 오염 없음. `captureTraces` 는 **원복 실패(M-1)**. 시드 고정·결정적: 4개 파일 70/70 을 6회 반복(1+5) 전부 통과, 퍼즈 통계 동일(`texts 120000·extractOk 54000·repairedOk 17685`). `ms < 60_000` 상한은 여유 8배. 시간 의존은 task007 의 기존 `sleep` 패턴뿐.
7. **경계·문서 — 충족.** 신규 import 는 `schemaValidate.ts → ./repairRootClose` 와 `engine/llm → ../json/schemaValidate` 의 타입 1개뿐(층 위반·`index.ts` 우회 0). 엔진명·`model_id`·`speaker_id` 신규 누출 0(추가 라인·신규 파일 grep). `docs/design/api-contract.md`(구문 슬립 복구 항·계측 줄 `repaired`)와 `design-spec.md §67` 서술은 구현과 일치하고 과장 없음("복구되어도 스키마·후검증 엄격·옵트인·`extractJson` 실패 응답에만·SSE/done 불변" 확인). 다만 "`}` 하나만 지워" 는 엄밀히 "코드펜스 토큰 제거 + `}` 하나"(L-1) — 문구 정밀화 권고.

### ⓓ1 의견 (복구 호출 순서 뒤집기 변이가 관찰 동치로 생존)

**타당하며 구조 개선은 필요 없다.** 증명 스케치: 복구가 non-null 이려면 cleaned = `P}R`(P} 가 문자열 인식 스캔상 첫 완결 루트 객체, R 이 `\s*,\s*"…` 로 시작해 마지막 `}` 로 끝남)이어야 하고, 이 텍스트는 ①②(`JSON.parse`)가 루트 뒤 `,` 때문에 실패하고 ③ 의 부분문자열(첫 `{`~마지막 `}` = cleaned 전체; 개행 이스케이프는 문자열 안 글자만 바꿔 구조를 못 바꿈)도 같은 이유로 실패한다 → **복구 후보가 있으면 `extractJson` 은 반드시 던진다**. 그래서 순서를 뒤집어도 모든 입력의 결과가 같다(독립 퍼즈 ≈306k 개의 `extractJson` 성공 입력 전부 후보 null 로 실증, 개발자 54k 와 합쳐 반례 0). 구조적 보장(`catch` 안 호출)은 코드 리뷰 항목으로 충분하고 현재 코드가 그렇다. 유지보수 메모: 이 불변식은 `repairRootClose.ts` 가 나중에 확장되면(서문 허용·펜스 안쪽 구조 복구 등) 깨질 수 있으므로 **퍼즈의 I1 단언(`extractJson` 성공 입력 → 후보 null)은 계속 유지**해야 한다.

### 지적 표 (근거 있는 것만)

| ID | 심각도 | 위치 | 내용·재현 | 권고 |
|---|---|---|---|---|
| M-1 | MEDIUM(비차단) | `conversation/__tests__/task037.test.ts:93-107` `captureTraces` | **"원복" 이 원복하지 않는다.** Prisma 클라이언트 Proxy 의 자기 속성 descriptor 는 `value: undefined`(재현: `Object.getOwnPropertyDescriptor(prisma,'requestTrace').value === undefined`, 원본 델리게이트는 `typeof 'object'`). 이 descriptor 로 `Object.defineProperty(prisma,'requestTrace', original)` 하면 이후 프로세스 안에서 `prisma.requestTrace` 가 `undefined`(재현 출력 `after restore typeof: undefined`). 현재는 이 test 가 파일의 마지막이고 `node --test` 가 파일마다 프로세스를 분리해 영향이 없지만, 뒤에 test 를 더하면 `recordTrace`(예외 삼킴)가 조용히 Trace 를 잃는 순서 의존 함정. | 원복을 `const originalValue = (prisma as any).requestTrace` 로 값을 잡아 `Object.defineProperty(prisma,'requestTrace',{ ...original, value: originalValue })` 로(재현 확인: 같은 델리게이트로 복귀) 또는 `recordTrace` 를 `mock.method` 로 가로채기. |
| L-1 | LOW | `engine/json/repairRootClose.ts:24` | 복구 대상이 `extractJson` ② 와 같은 **전역** 코드펜스 제거라 문자열 값 안의 ```/```json 도 지워진다(비펜스 슬립에서도). 퍼즈 `slip-talk-fenceInString` 47,921건이 모두 "펜스 제거본" 과만 일치 = 내용이 모델 출력과 달라짐을 확인. 슬립 × 문자열 속 ``` 는 극히 드물고 `correction.original` 은 `extraCheck` 원문 일치가 막아(복구 후 위반 → 재시도) 학습 데이터 오염은 없다. 문서·주석의 "`}` 하나만 지워" 는 엄밀히 사실이 아님. | 복구에서는 바깥 펜스(시작·끝)만 벗기거나, 최소한 문서·주석을 "코드펜스 토큰 제거 + `}` 하나" 로 정밀화. |
| L-2 | LOW | `engine/json/schemaValidate.ts:274-282` `parseRepaired` | 복구본 안 **문자열 값의 원본 개행**은 `extractJson` ③ 과 달리 이스케이프하지 않아 복구가 `JSON.parse` 에서 실패(원본 개행 슬립 71,842건 중 80.8%) → 옛 parseError 로 폴백(안전, 새 실패 모양 없음). 개발자가 남은 위험으로 보고한 항목과 같음(테스트로 pin). 실제 발생은 `explanationKo` 같은 여러 줄 값에서만 가능. | 선택: ③ 의 문자열 안 개행 이스케이프를 `fixed` 에도 적용(+테스트), 아니면 W1 에서 "복구 실패 슬립" 이 남는지 보고 판단. |
| L-3 | LOW | `engine/json/schemaValidate.ts:276` | `repairRootClose(raw)` 호출이 `try` 밖이라 **비문자열 `raw`** 는 옵션 on 에서 TypeError 가 새어 나온다(HEAD 는 `extractJson` 의 TypeError 를 삼켜 parseError). 재현: `extractAndValidate({}/undefined/['a'], …, {repairRootClose:true})` → `THROWS TypeError`(off 는 `{ok:false,parseError:true}`). 어댑터 계약(string) 위반(예: home-m4 `message.content` 가 객체) 일 때만. | `parseRepaired` 가 `repairRootClose` 호출까지 `try` 로 감싸 실패 시 `undefined`(= 옛 parseError). |
| L-4 | LOW | `prompts.test.ts` pin · `schemaValidate.ts:542` | 옵트인 경계 pin 이 `prompts/` 의 `export function build\w+Request` 소스 스캔뿐이라 **빌더 밖 호출부**가 `repairRootClose: true` 를 켜면 통과(변이 c8: `learning/vocab/enrich.ts` 가 `{...request, repairRootClose:true}` → SURVIVED). `runJsonAnalysis` 의 옵션 전달 줄(`:542`)은 비테스트 호출처가 없고 단언도 없음(변이 c7 SURVIVED). | `rg 'repairRootClose: true' src`(테스트 제외)가 talk.ts·chat.ts 둘뿐임을 소스 스캔으로 pin 하거나, 미사용 `runJsonAnalysis` 전달 줄을 빼고 필요할 때 추가. |
| I-1 | INFO | `schemaValidate.ts:458·488` | (옵트인 요청 한정) 중첩 객체를 일찍 닫은 슬립은 복구 뒤 스키마 위반이라 재시도 힌트가 `RETRY_PARSE` 대신 `RETRY_SCHEMA(위반 경로)` 로, 재실패 시 `JsonSchemaError.violations` 가 `['JSON 파싱 실패']` 대신 위반 목록으로 바뀐다. `parseError` 문자열에 분기하는 코드는 없음(rg 확인), 재시도 횟수·예외 타입·`attempts` 불변. | 조치 불필요 — "JsonSchemaError 의미 불변" 서술은 타입·횟수 기준임을 인지. |
| I-2 | INFO | `schemaValidate.ts:418` | 로그 문구 2("재시도 경로에서 복구본 사용")의 `savedRetry` 플래그를 뒤집어도(변이 m4) 단언이 없어 생존 — 의미는 코드 대입으로 정확함 확인, W1 은 접두로 세므로 비차단. | 선택: 2차 응답 복구 테스트에서 전체 문구까지 단언. |
| I-3 | INFO | W1 운영 해석 | 복구가 켜지면 슬립은 `[json] 1차 응답 계약 위반 → 재시도: JSON 파싱 실패` 줄 대신 `구문 슬립 복구(ROOT_CLOSE)` 줄(같은 stderr = pm2-err.log)을 남긴다 → 기준선 "`JSON 파싱 실패` 2줄" 은 이제 **슬립이 아닌 파싱 실패**의 기준선. 복구했지만 후검증에 걸려 버려진 슬립은 로그·Trace 에 안 잡힘(과소 집계 가능, 규모 작음). | QA·감시 문서에 접두 기준(`구문 슬립 복구(ROOT_CLOSE)`) 과 Trace `repaired` 건수를 함께 보라고 명시. |
| I-4 | INFO | 퍼즈 설계 | 개발자 퍼즈는 시드 고정이라 회귀 가드이지 탐색이 아니다 — 이번 독립 퍼즈가 그 공백을 메웠다(1.2M건 위반 0). `ms<60_000` 상한은 CI 지연에 안전. | 조치 불필요. |

### QA 에 넘길 high_risk_areas
1. **TALK·CHAT 슬립 → LLM 1회 → `done`**: 합성 슬립(가짜 HTTP LLM, 라이브 슬립은 ≈4% 자연 발생이라 재현 불가)으로 `attempts:1`·`done` 도달·`RequestTrace` LLM 단계 `repaired:"ROOT_CLOSE"`·저장 1회·SSE 이벤트 순서 불변(스모크 006·007 + 직접 SSE).
2. **조기 음성 × 복구**: `earlyStop` 이 `RETRY` 로 닫히지 않고 `AUDIO_TEXT_MISMATCH` 0(슬립 응답에서 들리는 문장 = 화면 최종 문장).
3. **옵션 경계 회귀**: 레슨 A4·평가 A6/A7·반복 판단 A11·reviewMix A5·단어 보강 A10 응답 파싱·재시도 동작 불변(스모크 010·011, 단어 보강 슬립 모양 입력은 재시도).
4. **로그·Trace 에 문장 내용 없음**: `pm2-err.log` 의 `구문 슬립 복구(ROOT_CLOSE)` 줄은 고정 문구뿐, Trace steps 에 응답 문장 부재.
5. **배포 후 W1 감시 대조**: 접두 `구문 슬립 복구(ROOT_CLOSE)` 로그 건수 = Trace `repaired` 턴 수(I-3 의 버려진 슬립 제외), `JSON 파싱 실패` 기준선 재해석.
6. M-1·L-1~L-4 보완이 들어가면 Reviewer 부터 재순환(특히 L-1·L-2·L-3 는 `repairRootClose.ts`/`parseRepaired` 를 건드리므로 독립 퍼즈 재실행 필요 — `scratchpad/fuzz110.mts`, `ROUNDS=3 PER=400000`).

### 재실행 수치 (개발 미러 `~/.node-local/thekaiwa`, `sync-local.sh` 후, 출력 `| head` 없음)
- `tsc --noEmit` rc 0(출력 0바이트) · `eslint src/modules/engine src/modules/conversation` rc 0(출력 0바이트)
- `engine` 141/141 pass · `conversation` 424/424 pass · **전체 `npm test` 1497건: 1496 pass · 1 skip · 0 fail**(55.0s) — 개발자 보고와 일치
- 대상 4파일(repairRootClose·task037·prompts·task007) 70/70 × 6회 반복 안정(퍼즈 통계 동일)
- 독립 퍼즈 1,200,000건 — 위반 0·예외 0·최대 6ms/호출 · 적대 입력 23종·성능 8종(`adv110.mts`) · 폴백 옵션 유지 스크래치 테스트 1건 통과

### 변이 결과 (스크래치 사본 `m110`, 대상 4파일 기준선 70/70, 매번 NFS 원본으로 복사 원복 후 cmp → RESTORE_CMP OK)
총 **27 변이: 23 KILLED · 4 SURVIVED**. KILLED — a(문자열 인식 제거)·a2(이스케이프 처리 제거)·b1(복구본 ajv 우회)·b2(evaluateAttempt extraCheck 우회)·b3(soft extra 우회)·c1(`extractOptionsOf` 기본값 true)·c2(`completeJson` 기본값 true)·c3(단어 보강 빌더 true)·c5(TALK 옵션 제거)·c6(CHAT 옵션 제거)·e1(`,"` 조건 제거)·e2(`,` 만 확인)·f(마지막 글자 검사 제거)·g(되돌린 `}` push 제거)·h(첫 글자 `{` 조건 제거)·k(괄호 짝 검사 제거)·m1(펜스 제거 생략)·m3(soft data 출처 불일치 표식)·m5(orchestrator Trace 표식 제거)·m6(`completeJson` 결과 repaired 누락)·m7(r1 표식 누락)·m8(복구 시 attempts 2)·m9(로그에 data 내용). SURVIVED — **d1**(순서 뒤집기, 관찰 동치 — 위 "ⓓ1 의견") · **c7**(`runJsonAnalysis` 옵션 미전달 — 호출처 없음, L-4) · **c8**(빌더 밖 호출부가 옵션을 켬 — L-4) · **m4**(로그 문구 2 의미 — I-2).
재현: 스크래치 `scratchpad/{fuzz110.mts,adv110.mts,mutate110.py,nonstr110.mts,prisma110*.mts}`(`mutate110.py` 는 미러 `src` 를 `scratchpad/m110` 로 rsync + `node_modules` 심볼릭 링크한 사본에서 실행, 사본 `m110` 은 세션 스크래치(`/tmp/claude-1000/…/scratchpad/m110`)에 남아 있다 — 삭제가 확인 게이트에 막혀 지우지 못했고, 프로젝트·미러와 무관하며 세션 종료 시 정리된다).

## QA 기록 (QA, 2026-10-05, standard 트랙 · 코드 수정 0)

**판정: PASS (Critical 0 · High 0 · Medium 0 · Low 0 — 결함 0건)** · 비차단 관찰 4건(O-1~O-4) · `src/**`·`prisma/**`·`speech/**`·`plugins/**` 수정 0(QA 추가·수정 파일은 `tests/live/` 3개뿐 — `task037-slip-live.ts`·`task037-qa-turns.ts` 신규, `README.md` 2행) · 네이티브·마이그레이션·persona·화면 무변경 확인 · 데모 게이트 `demo_gate.status=not_required`(judge none, 화면 변경 0).
**NOT_VERIFIED(사유 있음)**: ① 운영 스모크 `SMOKE_ENV=PRODUCTION` 006/007·배포 후 W1 감시(접두 `구문 슬립 복구(ROOT_CLOSE)` 줄 수 = Trace `repaired` 턴 수 대조) — 배포 전이고 운영 3010·8100·pm2·PRODUCTION DB 무접촉 지시라 **배포 직후 deployer/Leader 몫**(개발 서버 동일 코드 실측은 아래 PASS) ② 화면 3폭(360/390/412)·실기기(STT·TTS·APK·권한 거부) — **화면·네이티브 코드 변경 0**(`git diff --name-only -- src/app src/components speech plugins android capacitor.config.ts` 출력 비어 있음)이라 해당 없음(N/A, 브라우저 검증 미수행을 PASS 로 적지 않음).

### 환경·재현 조건
- 코드 = NFS 작업본(미커밋) — `bash scripts/sync-local.sh` 후 `diff -rq src`·`diff -rq tests` 둘 다 출력 없음(rc 0). `APP_ENV=LOCAL`.
- **모듈 수준(항목 3)**: 미러 `~/.node-local/thekaiwa` 에서 `tests/live/task037-slip-live.ts` — 작업본 `buildTalkRequest`(talk@v8, `repairRootClose:true` 확인 후)로 `llm.completeJson` 직접 호출, 순차·호출 사이 1500ms, 합성 발화 32문장(`talk-corrections` 20 + `talk-userko` live 12) × 4패스, 실제 Claude CLI(haiku). 운영 DB·Trace 무접촉.
- **서버 수준(항목 4·5·6·7)**: 하드링크 복제본 `~/.node-local/thekaiwa-qa037`(NFS `src`·`tests` 실복사 — 다른 에이전트의 sync-local 재시작 영향 차단, `node_modules` 하드링크, `.env` 사본) → `SPEECH_GATEWAY_URL=http://127.0.0.1:8197`(아무도 안 떠 있음 — 운영 8100 무접촉) `next dev -H 127.0.0.1 -p 3011`(PID 파일로만 종료). QA 계정 `qa-bot`·`qa-bot2`(쿠키 권한 600 임시 파일, 스크립트 trap 으로 삭제). M4 TTS 는 합성 요청만.
- **Claude CLI 호출 수**: 사전 계산 ≈195회(슬립 포착 128+프로브 1 · 007 ≈8 · 006 ≈17 · 턴 계약 15×2=30 · 008 ≈6 · 011 ≈5) → 실제 `[claudeCli] 완료` 줄 **192회** = 모듈 수준 129(128+프로브 1, haiku talk) + dev 서버 63(chat 31·talk 19·reviewDecision 3·wordEnrich 3·evalGrade 3·chatReview 2·evalGen 2; 스크립트별 007=4·006=17·턴 계약=31·008=6·011=5). **429·한도 0건**. 스모크 사이 간격 2분 16초~2분 45초(007 은 슬립 포착 직후 ≈40초 — 한도 문제 없었음, O-4).

### 항목별 판정

| # | 항목 | 판정 | 근거(핵심) |
|---|---|---|---|
| 1 | 정적·단위 | **PASS** | `npm run typecheck` exit 0 · `eslint src/modules/engine src/modules/conversation` exit 0·**0바이트** · `engine/__tests__` **143/143** · `conversation/__tests__` **425/425** · 전체 `npm test` **1500건 중 pass 1499 · fail 0 · skip 1**(skip = `#9 실제 배포 manifest(speech/models/reazonspeech-int8)` — 미러에 `speech/models` 가 없어서 생기는 **기존** 건) · 차분 퍼즈 로그 `[task-037 fuzz] {"texts":120000,"extractOk":54000,…}` 통과(완료 기준 2 — 10만 건 이상) |
| 2 | 옵트인 경계(코드) | **PASS** | `grep -rn "repairRootClose" src`(테스트 제외) — 켜는 리터럴 `repairRootClose: true` 는 **`prompts/chat.ts:49`·`prompts/talk.ts:329` 두 곳뿐**(나머지는 타입·전달·주석·`schemaValidate.ts`의 `=== true` 변환) · `git diff -- src/modules/engine/json/extractJson.ts` **출력 없음**(변경 0) · 버전 상수 `TALK_PROMPT_VERSION='talk@v8'`·`CHAT_PROMPT_VERSION='chat@v3'` HEAD 와 동일 · talk/chat 프롬프트 diff = 주석 1줄 + `repairRootClose: true` 1줄씩(+2줄 ×2) · `buildTalkRequest/buildChatRequest` 호출자 = orchestrator `startTurn`(talk/chat 턴) 한 곳 + 예열 모양 전달뿐 |
| 3 | **라이브 자연 슬립 포착** | **PASS** | **n=128**(요구 ≥120): 성공 128·FAILED 0·attempts 1회 128·**재시도 0건** · 1차 응답 파싱 실패(슬립) **3건(2.34%)** → 3건 모두 `repaired=ROOT_CLOSE`·`attempts=1`·재시도 생략(복구 못 한 슬립 0) · 3건 모두 모양 `…"endOfTopic":false,"proposals":[]},"userKo":"…"}`(`ROOT_CLOSE_THEN_USERKO`, 응답은 ```json 코드펜스 안) · 복구본 **독립 재검증**(스크립트가 직접 `repairRootClose`→`JSON.parse`→ajv(TALK_SCHEMA)→`extraCheck`) 3/3 parseOk·schemaOk·extraCheck 위반 0·`completeJson` `data` 와 deepEqual·`userKo` 가 루트 키 · 슬립 행 ms 3451/3321/3982(전체 p50 4341·p95 5339 — 재시도 지연 없음) · 서버 경로에서 추가로 자연 슬립 1건(항목 6) |
| 4 | 새 턴 계약·회귀(3011) | **PASS** | `task007-smoke` **47/47 PASS·FAIL 0·SKIP 1(J, TEXT_ONLY — 스크립트 정의)** · `task006-smoke` **42/42 PASS**(턴 p50 5053ms) · 신규 `task037-qa-turns` **TALK 15·CHAT 15턴 299/299 PASS**(`done.conversation` 키 = `replyJa`·`replyKo` 뿐·새 강사 행 `reading` NULL·content/translation 일치·#29 새 행 `reading:null`·옛 행 값 그대로·audio 이음=replyJa·status 경고 0) · 복구 안 한 정상 턴 29턴의 Trace LLM 단계에 `repaired` 키 없음(PASS) · 서버 로그 `구문 슬립 복구` 줄 = 아래 1줄(복구된 턴과 일치) |
| 5 | 옵트인 밖 요청 불변 | **PASS** | `task008-smoke`(A10 단어 보강·복습 판단) **77/77** · `task011-smoke`(A6 평가 생성·A7 채점) **60/60**(이전 61 은 평가 생성 실패 시에만 도는 '다시 만들기' 조건 항목 — 이번엔 실패 없어 제외) · 두 스모크 구간 서버 로그 `[json]`·`구문 슬립 복구` **0줄**(구간 claudeCli: 008=reviewDecision 3·wordEnrich 3 / 011=evalGen 2·evalGrade 3). 생략: `task010-smoke`(A4 레슨 — sonnet 다회·호출량 큼, A4 는 옵션 off 로 `build*Request` 10개 pin 테스트·단어 보강 슬립 입력이 재시도하는 `task037.test.ts` 로 갈음) |
| 6 | 관측·로그·Trace | **PASS(자연 발생 1건으로 실측)** | `task037-qa-turns` 30턴 중 **TALK #8 에서 자연 슬립 → 복구**: Trace LLM 단계 `attempts=1`·`repaired=ROOT_CLOSE`·`earlyStop` null, 서버 로그 `[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략` 1줄 → **Trace 표식 1 == 로그 증가 1**(스크립트 단언 PASS) · 로그 줄은 고정 문구뿐(`^\[json\] 구문 슬립 복구\(ROOT_CLOSE\) — (재시도 생략\|재시도 경로에서 복구본 사용)$` 단언 PASS — 응답·문장 0) · 모듈 수준 3건의 경고 줄도 전부 같은 고정 문구. 두 번째 문구(`재시도 경로에서 복구본 사용`)는 자연 발생 못 봄 → 합성 단위 `repairRootClose.test.ts`「runJsonWithRetry: 2차 응답이 슬립이어도…(attempts===2·repaired)」·「soft 경로: 복구한 1차 응답에 extraCheck 위반…」로 갈음 |
| 7 | 조기 음성 | **PASS** | 서버 30턴(+007 스모크)에서 `AUDIO_TEXT_MISMATCH` **0** · LLM `earlyStop='RETRY'` **0** · Trace attempts≥2 1턴(CHAT soft 위반 — O-2) · 슬립 복구 턴(TALK #8)은 audio 이음 = replyJa PASS · 모듈 수준 스트림 첫 문장이 최종 replyJa 의 prefix: **126/126**(복구 3/3). 복구 없는 HEAD 라면 이 3건은 재시도(`earlyStop=RETRY` 창)였음 — 복구로 사라짐 |
| 8 | 영향 없음·정리 | **PASS** | 화면·DB·네이티브·마이그레이션 0(`git diff --name-only -- prisma plugins android capacitor.config.ts .claude/agents/tutor.md src/modules/conversation/persona src/app src/components speech` 출력 없음, `git status --short -- …` 출력 없음) · LOCAL 남은 QA 데이터는 아래 · 프로세스·복제본·쿠키 정리 아래 |

### 결함·관찰

**결함 0건.** 비차단 관찰:
- **O-1 (슬립 빈도·모양)**: 자연 슬립 3/128(2.34%, Wilson 95% [0.8%, 6.7%]) — task-036 풀링 4.5% 와 같은 범위. **모양은 4건(모듈 3·서버 1) 전부 `…"proposals":[]},"userKo":…}` 한 가지**이고, 모듈 수준 3건은 모두 ```json 펜스로 감싸진 응답이었다(펜스 비율 자체는 안 셈). 다른 모양의 슬립(서문 섞임·내부 객체 조기 닫힘)은 이번 표본에 없어 "복구 안 하는 모양" 의 자연 발생은 NOT_VERIFIED(합성 음성 29줄·퍼즈 12만 건으로 갈음).
- **O-2 (참고, 이번 변경 무관)**: 서버 로그에 `1차 응답 계약 위반 → 재시도(soft): /learning/grammarPoint: 타입 오류 …/ must NOT have more than 80 characters` **2회**(006 스모크 1·`task037-qa-turns` CHAT #6 1 — 77 서버 turn 중). 파싱은 되고 ajv(`learning.grammarPoint` ≤80자) 위반이라 기존 재시도 경로 — 스키마·프롬프트 diff 0 이므로 이번 변경과 무관한 기존 위반 계열로 본다. 단 **로그만으로는 "복구 후 스키마 위반으로 버려진 슬립"(REV-110 I-3: 로그·Trace 에 안 잡힘)과 구분되지 않는다** — 어느 쪽이든 재시도 횟수는 같다(옛 코드는 같은 응답에서 파싱 실패 재시도). W1 에서 `JSON 파싱 실패` 기준선 해석 시 참고.
- **O-3 (개발 환경 정상 출력)**: 008 구간 `[router] LLM connection=home-m4-lan 실패(LlmMisconfiguredError) — 다음 후보`(LOCAL 에 home-m4 자격 증명 없음 → claude 로 폴백, 기존) · 011 구간 `prisma:error … StatsSnapshot_userId_kind_periodKey_key`(011 스모크가 의도한 "실패 주입 → GRADING 잔류·재시도" 항목 — 60/60 통과).
- **O-4 (QA 절차)**: 007 스모크를 슬립 포착 종료 직후(≈40초 뒤) 시작해 "스모크 사이 2분" 간격을 한 번 못 지켰다 — 429 0건이라 영향 없음. 이후 스모크 4회는 2분 16초 이상.

### 항목 3 원 출력 — `tests/live/task037-slip-live.ts` (RUNS=4, 32문장 × 4 = 128호출, 미러 `node --env-file=.env --import tsx`)
```
$ node --env-file=.env --import tsx tests/live/task037-slip-live.ts   (RUNS=4 GAP_MS=1500, 22:56~23:09)
task-037 라이브 슬립 포착 — work=talk@v8 · 작업 128개 = 총 호출(재시도 제외) 128 · 호출 간격 1500ms · 순차
[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략
{"i":56,"id":"u04","run":2,"ok":true,"ms":3451,"att":1,"rep":"ROOT_CLOSE","pfail":true,"shape":"ROOT_CLOSE_THEN_USERKO"}
[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략
{"i":84,"id":"c04","run":3,"ok":true,"ms":3321,"att":1,"rep":"ROOT_CLOSE","pfail":true,"shape":"ROOT_CLOSE_THEN_USERKO"}
[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략
{"i":122,"id":"u06","run":4,"ok":true,"ms":3982,"att":1,"rep":"ROOT_CLOSE","pfail":true,"shape":"ROOT_CLOSE_THEN_USERKO"}
## 요약
호출 128 · 성공 128 · FAILED 0
attempts 분포: 1회 128 · 2회 0
1차 응답 파싱 실패(슬립 후보) 3건 (2.34%)
  └ 복구 성공(repaired=ROOT_CLOSE, attempts=1) 3건
  └ 복구 안 됨 → 재시도로 회복 0건 · 최종 실패 0건
  └ 슬립 모양: {"ROOT_CLOSE_THEN_USERKO":3}
재시도 총 0건 = 슬립(파싱 실패) 0 + 계약 위반(파싱 OK) 0
복구본 독립 재검증: 3건 중 parseOk 3 · schemaOk 3 · extraCheck 위반 0 3 · completeJson data 와 deepEqual 3 · userKo 루트 키 3
조기 음성 prefix 일치(스트림 첫 문장 ⊂ 최종 replyJa): 전체 126/126 · 복구 3/3
ms p50 4328 · p95 5349 · 복구 행 ms [3451,3321,3982] · 재시도 행 ms []
경고 줄 집계: 구문 슬립 복구(ROOT_CLOSE) 3줄 (repaired 행 3) · 재시도 줄 0줄
슬립 u04#2 … tail="… \"endOfTopic\":false,\"proposals\":[]},\"userKo\":\"역은 어디입니까?\"}" indep={"fixedNonNull":true,"parseOk":true,"schemaOk":true,"extraViolations":[],"equalsReturnedData":true,"userKoIsRootKey":true}
슬립 c04#3 … tail="… \"endOfTopic\":false,\"proposals\":[]},\"userKo\":\"주말에는 집에서 천천히 쉬고 싶어요.\"}" indep={…동일 true…}
슬립 u06#4 … tail="… \"endOfTopic\":false,\"proposals\":[]},\"userKo\":\"저는 일본어를 공부하고 있는데 어렵습니다.\"}" indep={…동일 true…}
```
슬립 원문 1건(합성 발화 응답 — u04#2, 269자):
```
```json
{"speech":{"style":"NEUTRAL"},"conversation":{"replyJa":"駅はこちらです。何時の電車ですか？","replyKo":"역은 이쪽입니다. 몇 시 기차를 타세요?"},"correction":null,"learning":{"grammarPoint":"은/는 주제 표시 조사, 어디 위치 묻기","difficulty":"N5"},"endOfTopic":false,"proposals":[]},"userKo":"역은 어디입니까?"}
```
```
(`proposals` 뒤 `}` 가 하나 더 나오고 `,"userKo"` 가 이어짐 — 완료 기준 모양과 동일. 복구 후 `userKo` 가 루트 키.)

### 항목 1·2 원 출력
```
$ npm run typecheck > typecheck.log 2>&1; echo "typecheck exit=$?"          → typecheck exit=0   (diff -rq src/tests 미러 = NFS: rc 0)
$ node node_modules/eslint/bin/eslint.js src/modules/engine src/modules/conversation   → eslint exit=0 (0 bytes)
$ node --import tsx --test --test-concurrency=1 src/modules/engine/__tests__/*.test.ts        → # tests 143 # pass 143 # fail 0 # cancelled 0 # skipped 0
$ node --import tsx --test --test-concurrency=1 src/modules/conversation/__tests__/*.test.ts  → # tests 425 # pass 425 # fail 0 # cancelled 0 # skipped 0
$ npm test > npm-test.log 2>&1; echo "npm test exit=$?"
npm test exit=0 — # tests 1500 # suites 0 # pass 1499 # fail 0 # cancelled 0 # skipped 1 # todo 0 # duration_ms 53503.32024
ok 1304 - \#9 실제 배포 manifest(speech/models/reazonspeech-int8) 통과 — 저장소가 보이는 곳에서만(미러는 THEKAIWA_REPO) # SKIP 저장소 speech/models 가 없는 실행 위치(미러) — …
# [task-037 fuzz] {"texts":120000,"extractOk":54000,"notRepaired":28555,"repairedOk":17685,"repairedViolation":19760,"constructedSlips":33472,"repairNonNullBu…}
$ grep -rn "repairRootClose" src (테스트 제외, 켜는 곳만 — `grep -rnE "repairRootClose\s*[:=]\s*true" src | grep -v __tests__`)
src/modules/conversation/prompts/chat.ts:49:    repairRootClose: true,
src/modules/conversation/prompts/talk.ts:329:    repairRootClose: true,
$ git diff --stat -- src/modules/engine/json/extractJson.ts   → (출력 없음)
$ grep PROMPT_VERSION  → talk.ts:97 'talk@v8' · chat.ts:19 'chat@v3' (HEAD 동일)
```
핵심 단위 테스트 이름(합성 갈음 근거): `ok 712 - task-037: TALK·CHAT 슬립(루트 조기 닫힘) — 실제 스키마·extraCheck 로 복구가 통과하고, 옵션 없이는 파싱 실패` · `ok 840 - task-037: 구문 슬립 + repairRootClose → LLM 1회·earlyStop 이 RETRY 가 아니고 조기 음성이 최종 답의 음성 / 옵션 off 는 재시도(RETRY)` · `ok 908 - completeJson(TALK 요청 그대로): 슬립 1차 응답 → LLM 1회·attempts 1·repaired ROOT_CLOSE·로그 한 줄(내용 없음) / 옵션을 끄면 지금처럼 2회` · `ok 910 - 옵트인하지 않은 요청(단어 보강 등)은 슬립이 와도 복구하지 않고 지금처럼 재시도한다` · `ok 911 - startTurn(TALK): 슬립 응답으로도 LLM 1회에 done 에 도달하고 RequestTrace LLM 단계에 attempts 1·repaired=ROOT_CLOSE 가 남는다` · `ok 979 - 음성: 문자열 안 },"·루트 뒤 쓰레기·두 번 닫힘·배열 루트·빈 입력·이미 정상 → null` · `ok 983 - 차분 퍼즈 N=120000 …` · `ok 992 - REV-110 L-3 …` · `ok 993 - REV-110 L-4 …`.

### 항목 4~7 원 출력 (dev 서버 3011, 복제본)
```
$ DEV_PID=<next-server pid> DEV_LOG=<로그> bash tests/live/task007-smoke.sh 3011      (23:09:52~23:10:42)
PASS I1 대기 예열 CLI ≤ 2 — idle=1
SKIP J TTS 불가(TEXT_ONLY) → done 정상·audioCount 0·TTS_UNAVAILABLE — M4 는 운영과 공유 — 단위 테스트 conversation/__tests__/task007 "TEXT_ONLY" 로 갈음
PASS K7 DB: 이미 발화가 붙은 메시지에 두 번째 발화를 붙이면 P2002(chatMessageId @unique) — P2002
결과: PASS 47 / 47        (PASS 47 · FAIL 0 · SKIP 1)
$ bash tests/live/task006-smoke.sh 3011      (23:13:19~23:17:27, 007 과 2분 37초 간격)
결과: 42/42 PASS · 턴 p50=5053ms
$ BASE=http://127.0.0.1:3011 DEV_LOG=<로그> node --env-file=.env --import tsx tests/live/task037-qa-turns.ts <쿠키> 15      (23:20:12~23:23:43)
관찰(W1): 턴 30/30 · toolLog.attempt≥2 1 · LLM earlyStop='RETRY' 0
task-037 관측: Trace repaired 표식 1턴 · 표식 키가 있으나 값 없음 0 · AUDIO_TEXT_MISMATCH 0턴 · earlyStop=RETRY 0턴 · Trace attempts≥2 1턴
PASS  복구가 일어나지 않은 턴의 Trace LLM 단계에 repaired 키 없음 — 표식 없는 턴 29
PASS  repaired 표식 턴은 Trace attempts===1·earlyStop≠RETRY·AUDIO_TEXT_MISMATCH 0 — 표식 1턴 [{"k":"TALK","n":8,"a":1,"es":"null"}]
PASS  Trace repaired 표식 수 == 서버 로그 `구문 슬립 복구(ROOT_CLOSE)` 증가 줄 수 — trace=1 log+=1 (재시도 줄 +1)
PASS  복구 로그 줄은 고정 문구뿐(문장·응답 내용 없음) — 줄 1: ["[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략"]
   · TALK #8 total=3409ms firstAudio=1138ms attempt=1 earlyStop=- attempts(trace)=1 repaired=ROOT_CLOSE llmMs=2518 corr=N
   (CHAT #6 만 attempt=2 — llmMs 7971, `[json] 1차 응답 계약 위반 → 재시도(soft): /learning/grammarPoint: … 80 characters` — O-2)
결과: PASS 299 / 299
$ bash tests/live/task008-smoke.sh 3011      (23:26:00~23:27:45)  → 결과: 77/77 PASS (QA 데이터 정리 완료)   [구간 서버 로그 [json]·구문 슬립 복구 0줄]
$ bash tests/live/task011-smoke.sh 3011      (23:30:01~23:32:10)  → 결과: 60/60 PASS · 지표 {"wordsGenMs":13825,…,"talkTotal":78,"talkScores":"9,9,10,10,0,9",…}   [구간 서버 로그 [json]·구문 슬립 복구 0줄]
```
서버 로그 전 구간의 `[json]` 줄(전체 3줄):
```
71:  [json] 1차 응답 계약 위반 → 재시도(soft): /learning/grammarPoint: 타입 오류 — null이어야 함(현재 string) / … must NOT have more than 80 characters / … must match a schema in anyOf   (006 스모크)
177: [json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략                                                                                                                              (qa-turns TALK #8)
206: [json] 1차 응답 계약 위반 → 재시도(soft): /learning/grammarPoint: … (동일)                                                                                                       (qa-turns CHAT #6)
```
서버 로그 오류 grep: `⨯`·unhandled·TypeError 0 · 5xx 0(`prisma:error` 1건은 011 의도 주입 — O-3).

### 남긴 데이터·정리
- **LOCAL DB(QA 계정)**: 이번 QA 의 채팅·메시지·교정·단어·StudyLog·스냅샷 **0건 남음**(최근 2.5시간 QA 계정 `Chat`·`ChatMessage`·`Utterance`·`WordEntry`·`StudyLog`·`StatsSnapshot`·`Correction` 전부 0, 제목 `t037` 채팅 0). 남은 `RequestTrace` 5건(TURN 3·PREVIEW 2)은 007·008 스모크가 원래 남기는 QA 계정 행(LOCAL, task-036 QA 기록과 같은 부류). QA 계정 오래된 `Chat` 3건은 이번 QA 이전 것. 모듈 수준 슬립 포착은 Trace·DB 에 쓰지 않음.
- **산출물 정리: 스크린샷 0개(화면 검증 N/A — 만든 것 없음, `/tmp/qa-artifacts` 에 내 폴더 없음)**. 스크래치 결과 파일(`…/scratchpad/qa037/*.log·*.json`)은 세션 스크래치(프로젝트 밖) — 세션 종료 시 정리.
- **프로세스 정리: dev 서버 3011 종료(next-server PID 785499·부모 785487, PID 로만 종료) → `ss -ltn | grep -E ':(3011|3012|8197|8198)'` 출력 없음**(rc 1). 운영 3010·8100 은 내 것이 아니며 그대로 LISTEN. 복제본 `~/.node-local/thekaiwa-qa037` 삭제(`.env` 사본 shred 후, `ls -d ~/.node-local/thekaiwa*` 에 내 복제본 없음 — `thekaiwa-head036` 등은 다른 에이전트 것 그대로). 쿠키 임시 파일 전부 삭제(`/tmp` 에 `thekaiwa_session=` 내용 파일 0).

### Deployer 인계 (verdict=PASS, 결함 0건)
```json
{"from":"qa","to":"deployer","task":"task-037","verdict":"PASS","defects":0,
 "deploy_ref":"작업본 미커밋 → 커밋 후 origin/main ref(Leader 커밋·push 승인 뒤)",
 "migration_required":false,"reinstall_required":false,
 "post_deploy_checks":[
  "/api/health 본문 status=ok (degraded 의 stt_analysis_worker 는 기존 상태)",
  "SMOKE_ENV=PRODUCTION task006-smoke 42/42·task007-smoke 45/45 (포트 3010)",
  "360/390/412 세 폭 화면 확인 — 화면 코드 변경 0 이라 회귀 확인용(새 TALK/CHAT 턴 말풍선·후리가나·한글 줄)",
  "W1 감시: pm2-err.log 접두 `구문 슬립 복구(ROOT_CLOSE)` 줄 수 = Trace LLM 단계 `repaired:\"ROOT_CLOSE\"` 턴 수 대조(고정 문구뿐 — 응답 문장 0), `JSON 파싱 실패` 기준선은 '슬립이 아닌 파싱 실패' 로 재해석(REV-110 I-3), 첫 TALK 100턴 attempt=2 비율·ENGINE_ERROR 관찰",
  "롤백: scripts/deploy.sh TheKaiwa --rollback (DB·스키마 변경 없음 — 복구 옵션이 빠질 뿐 옛 재시도 경로로 복귀)"]}
```
```json
{"taskId":"task-037","status":"DONE","deliverables":["tests/live/task037-slip-live.ts","tests/live/task037-qa-turns.ts","tests/live/README.md"],"blockers":[],"risk_level":"LOW","metrics":{"talk_p50_ms":4328,"talk_p95_ms":5349,"vocab_set_sec":null,"live_talk_calls":128,"natural_slips":3,"slips_repaired":3,"retries":0,"failed":0,"server_turns":30,"server_natural_slips":1,"audio_text_mismatch":0,"early_stop_retry":0}}
```

## 최종 요약 (Leader, 2026-10-05)

**한 일** — task-036(구 `replyReading` 제거) 뒤 TALK 응답에서 늘어난 **JSON 구문 슬립**(루트 객체를 `…"proposals":[]},"userKo":"…"}` 처럼 한 칸 일찍 닫음)을 결정적으로 고쳐 재시도(`done` ≈ +1.5초·구독 호출 1회)를 없앴다. 순수 함수 `repairRootClose(text)`(문자열 리터럴을 인식하는 단일 스캔으로 루트가 처음 닫히는 위치를 찾고, 그 뒤가 `,"다음 키"` 일 때만 그 `}` 하나를 지운 문자열을 돌려줌 — 되돌린 스캔이 정확히 마지막 글자에서 한 번 더 닫히는지까지 확인)를 추가하고, **요청 단위 옵트인**(`repairRootClose?: boolean`, 기본 false — `stripAdditionalProperties` 와 같은 길로 `ExtractOptions`·`RunJsonOptions`·`LlmJsonRequest`)으로 **TALK·CHAT 요청만** 켰다. 복구는 `extractJson` 이 **실패했을 때만**(원문이 이미 파싱되면 복구 경로를 타지 않음) 호출되고, 복구된 객체도 ajv(`additionalProperties:false`·required)·`extraCheck` 를 그대로 거친다(복구 후 위반이면 옛 재시도 경로). 복구가 일어나면 내용 없는 로그 한 줄 `[json] 구문 슬립 복구(ROOT_CLOSE) — …` 와 `RequestTrace` LLM 단계 `repaired` 표식, 결과 `repaired:'ROOT_CLOSE'`. 공용 `extractJson.ts` 본문·프롬프트 문구/버전(talk@v8·chat@v3)·persona·DB·화면·어댑터 **무변경**(마이그레이션·APK 0).

**사용자 결정** — 없음(후속 정리). Leader 판단: ① judge 값(local_fix·R1·sonnet·standard) 그대로, 단 공용 파싱 경로 근처라 옵트인+차분 퍼즈로 보수적 설계 ② 복구는 extractJson 본문이 아니라 별도 함수·요청 옵션(blast radius 최소) ③ `dev-037` 이 `maxTurns 80` 으로 끊겨 신규 소환(`dev-037b` 마무리·`dev-037c` 지적 반영) ④ REV-110 후속(코드 변경이 가드 1줄·주석뿐)은 reviewer 전면 재감사 대신 **Leader 가 reviewer 권고 독립 퍼즈 재실행**(660,000건 `FAILURES 0`·비문자열 on/off 동일)으로 좁게 재검증.

**검증** — judge intake(R1·standard)·C2(Codex 불필요) → Developer(Sonnet) 구현·마무리·반영 → **REV-110 PASS_WITH_NOTES**(Medium 1 = 테스트 Prisma 원복 결함·Low 4 — 모두 반영: M-1 복원 단언·L-1 서술 정정·L-3 비문자열 가드·L-4 `src` 전체 옵트인 pin; 독립 퍼즈 1,200,000건 위반 0·변이 27건 중 23 killed(생존 4 = 관찰 동치·보강 대상)) → **QA PASS(결함 0)**: **실제 Claude CLI(haiku) TALK 128호출 중 자연 슬립 3건(2.34%) — 3건 모두 복구되어 `attempts=1`·재시도 0·FAILED 0**, 슬립 모양이 `…"proposals":[]},"userKo":"…"}` 와 같고 복구 후 `userKo` 가 루트 키, 스크립트 독립 재복구도 ajv·extraCheck 3/3 통과. dev 서버 경로에서도 자연 슬립 1건이 Trace `repaired=ROOT_CLOSE` 1건·로그 1줄과 일치(로그는 고정 문구뿐). 스모크 007 47/47·006 42/42·턴 계약 299/299(정상 29턴은 `repaired` 표식 없음)·008 77/77·011 60/60(옵트인 밖 로그 `구문 슬립 복구` 0건), `AUDIO_TEXT_MISMATCH` 0·`earlyStop=RETRY` 0·스트림 첫 문장 prefix 일치 126/126, 전체 테스트 1500건 중 1499 통과·1 skip(기존). 화면 변경 없음(3폭·실기기 N/A).

**알려진 한계·후속** — ① 슬립 응답의 **문자열 값 안 원본 개행**이 섞이면 복구하지 못하고(독립 퍼즈상 해당 슬립의 19%만 복구) 옛 재시도로 폴백(안전·테스트로 고정) ② 슬립이 다른 모양(서문 섞임·내부 객체만 조기 닫힘·두 번 닫힘)이면 복구하지 않고 재시도 — 오복구 안전망은 `additionalProperties:false`·required(독립 퍼즈: 구조만 파싱되는 오복구 39,466건 중 실제 TALK·CHAT 스키마 통과 0) ③ 복구 로그 문구가 두 가지(`재시도 생략`/`재시도 경로에서 복구본 사용`) — W1 감시는 접두 `구문 슬립 복구(ROOT_CLOSE)` 로 센다 ④ 서버에서 `learning.grammarPoint` 80자 초과 소프트 재시도 2회(QA O-2)는 스키마·프롬프트 diff 0 이라 이번 변경과 무관해 보이나 로그만으로는 "복구 후 스키마 위반으로 버려진 슬립"과 구분이 안 됨 — 감시 때 확인 ⑤ `lexiconCompoundGuard.test.ts:273` Prisma `findFirst` 복원이 프록시 get 을 가림(동작 동등·범위 밖 — 별도 정리). **W1 감시 지표 갱신**: 슬립은 이제 `JSON 파싱 실패` 재시도로 보이지 않고 **`구문 슬립 복구(ROOT_CLOSE)` 로그 건수 = Trace LLM 단계 `repaired` 턴 수**로 센다. `JSON 파싱 실패` 는 "슬립이 아닌 파싱 실패"(기준선 2줄 — 10-01~10-05 전 프롬프트·QA 트래픽 포함)로 재해석. 임계(`attempt=2` 8% 초과·`ENGINE_ERROR` 1건)는 그대로, 복구율 자체의 상한은 두지 않되 **복구 건수 급증(예: 100턴 중 15건 이상)** 이 보이면 모델이 다른 습관으로 바뀐 신호이므로 확인.

**배포 상태** — 운영 배포 전(로컬 커밋·push 대기). 배포 뒤: `SMOKE_ENV=PRODUCTION` 006 42/42·007 45/45, health, 소스 `cmp`, 그리고 위 감시.
