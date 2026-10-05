---
task_id: task-036
title: "LLM 응답의 구 reading/replyReading 필드 제거 (talk·chat 프롬프트 계약 슬림화)"
status: in_progress
base_ref: d26e70b
risk_level: "R2"
roles_involved: [leader, judge, developer, prompt-engineer, reviewer, qa]
related_tasks: [task-026-improve-hangul-reading, task-004-ai-client-persona, task-006-chat-correction, task-007-talk-voice-web]
tags:
  - type/task
  - domain/conversation
  - domain/llm
aliases:
  - replyReading 제거
  - task-036
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
회화(A1 TALK)·채팅(A2 CHAT) 응답 계약의 `conversation.replyReading`(말풍선용 히라가나 한 줄, LLM 이 생성)을 없앤다. [[task-026-improve-hangul-reading]] 의 화면 A(E1-A: 한자 위 후리가나·아래 한글 줄이 히라가나 줄을 대체)와 분석기 기반 읽기(`#24r`)가 배포돼 `ChatMessage.reading` 은 **쓰기 전용**이 됐다 — 새 메시지에서도 아무 화면이 읽지 않는데 LLM 이 매 턴 그 줄을 생성한다.

**기대 효과**: 출력 토큰·JSON 길이 감소(문장 히라가나 한 줄 ≈ `replyJa` 길이) → 회화 턴 지연·`done` 시점 단축(5초 예산·chat p50 ≈4.8s). 첫 음성(조기 추출은 `speech.style`→`replyJa`)은 영향 없거나 소폭 개선.

**원칙·제약**
- 키 순서 `speech → conversation(replyJa → replyKo) → …`. `replyJa` 앞 순서는 그대로(조기 추출·문장 단위 합성 불변).
- 정확한 이름을 **지시 줄·골격·스키마 required·테스트 4곳에 일치**(A5·A11 교훈) — `replyReading` 이 4곳 어디에도 남지 않아야 한다.
- persona(`tutor.md`·`--system-prompt`)는 무변경(바이트 불변·예열 재사용 유지).
- DB: `ChatMessage.reading` **컬럼은 남긴다**(스키마 변경 없음, 마이그레이션 없음). 새 메시지는 `null`, 옛 메시지는 값 유지. 조회 응답(#32)의 `reading` 필드는 제거 대상 여부를 api-contract 와 함께 판단(옛 클라이언트·앱 WebView 는 서버 화면이라 영향 없음 — 확인).
- 레슨(A4)의 `dialogue[].reading` 등 **다른 reading 필드는 이번 범위 밖**(표시 전용 정본이 다름).
- 화면 변경 없음(말풍선은 이미 `reading` 을 쓰지 않음 — 확인 필수). 데모 불필요.

## 예상 변경 경로 (task-026 최종 요약의 변경 목록 기준 — 실측으로 확정)
- 프롬프트·계약: `src/modules/conversation/prompts/talk.ts`(talk@v7→v8 — Leader 초안의 v8→v9 는 오기, 실측 현재 v7) · `prompts/chat.ts`(chat@v2→v3 — 초안의 v3→v4 는 오기, 실측 현재 v2) · `structuredResponse/schemas.ts`(`TutorResponse`·required·properties)
- 서버: `src/modules/conversation/orchestrator/index.ts`(`saveTurn` 의 `reading`) · `done` 이벤트 페이로드
- 클라이언트·타입: `src/components/chat/useChatTurn.ts` · `src/types/chat.ts`
- 테스트: `conversation/__tests__/{task006,task007,task028,task010c,task026,task026s2,sceneCap,talkLength,lesson,prompts,structuredResponse}.test.ts`(리터럴·키 순서·버전 단언) · `engine/__tests__/jsonPathStream.test.ts`(입력)
- 문서: `docs/design/api-contract.md`(#32·SSE `done`) · `docs/design/tutor-persona-validation.md` · `.claude/agents/prompt-engineer.md`
- Prompt Registry: 프롬프트 키 버전 sync(운영 반영 시 `talk`·`chat` 새 버전) — PE 가 절차 확인

## 완료 기준 (QA 가 실행으로 확인)
1. `replyReading` 이 지시 줄·골격·스키마·테스트·코드·문서 어디에도 남지 않음(grep 0, 문서의 역사 기록 제외).
2. **측정(PE, 우분투 개발 미러, 순차·429 회피, 교차 실행, 각 arm n≥24)**: 출력 JSON 평균 글자·ms p50/p95·ajv 1차 통과율(재시도 비율)·교정 검출률(회귀 픽스처 — task-004 기준 16/16·오탐 0/4) — **통과율·검출률 비하락, 지연 비악화(개선 기대)**. 첫 음성 바이트 p50(`tests/live/task007-latency.ts`) 비악화.
3. 운영 스모크(`SMOKE_ENV=PRODUCTION`) 006 42/42·007 45/45 유지, 새 메시지 `ChatMessage.reading` null·말풍선 읽기 줄(후리가나·한글) 정상.
4. 마이그레이션·네이티브 변경 0(APK 불필요).

## 관련 과거 이력 요약
- [[task-026-improve-hangul-reading]]: `replyReading` 판단 = "유지(제거 안 함)" — **제거 가능 시점 = 화면 A·서버 분석 배포 뒤**, 그때 변경 목록(별도 PE+developer task)이 271행에 있음. 화면 A 는 `726daf7`(2026-10-04)로 운영 반영됨.
- [[task-004-ai-client-persona]]·[[task-006-chat-correction]]·[[task-007-talk-voice-web]]: A1/A2 응답 계약·키 순서·조기 추출.
- 승인된 교훈: 없음(`/이슈기록 관련` 0건).

## Judge 판정

- [2026-10-05 18:20] intake (Leader 가 `judge.mjs --input /tmp/judge-task-036-intake.json` 직접 실행 ×2 — 같은 결과, `/tmp/judge-task-036-intake.result.json`, `judge-result@2`·engine=jev·fallback 없음) → task_type=**structural** · complexity=1.77 · risk=**R2**(`R2-kw-migration,R2-kw-secret` — 요약의 "마이그레이션 없음"·"출력 토큰" 같은 부정/무관 키워드에 걸린 **오탐 가능**) · developer_model=**sonnet**(`MD-r2-path-only`: R2 라벨은 유지하되 경로 R2 가 아니라 opus 강제 안 함) · track=standard · demo=none(not_required) · next=assign · roles=developer·reviewer·qa.
- **Leader 판단**: R2 라벨은 **그대로 따른다**(오탐이어도 낮추지 않음 — 프롬프트 계약 변경이라 보수적 취급이 맞고, R2 는 한도 값이 없어도 Codex 개입 판정이 가능하다). developer_model=sonnet → 실호출모델=sonnet(승격 규칙: 같은 결함 클래스 반려 2회·`maxTurns` 부분 종료 2회 시 opus). PE(sonnet)는 judge roles 에 없지만 프롬프트·계약·측정 담당으로 팀 구성대로 호출. 순서: **developer(코드 일괄) → PE(A/B 측정·프롬프트 품질·Registry) → reviewer → [judge C2] → QA → deployer**. 직렬로 두는 이유: 계약 타입(`TutorResponse`) 변경이 서버·클라이언트·테스트에 걸쳐 한 번에 맞아야 typecheck 가 통과한다.
- `check.mjs init` → `not_required` 기록 완료.

## 판단 기록 (judge) — C1

- [2026-10-05 18:25] codex_gate C1 (Leader 직접 실행, `/tmp/judge-task-036-c1.json` → `/tmp/judge-task-036-c1.result.json`, `judge-result@2`·engine=jev·fallback 없음) → `codex_required: false` · `wanted_before_budget: false` · `budget_rule: CX-limit-unknown-r2` · `codex_calls_used: 0` · `codex_switch: on`. R2 이지만 Codex 는 필요 없다고 판정(설계가 task-026 에 이미 확정·삭제 위주). 입력 요약에 코드·diff·사용자 데이터 없음. override 없음.
- 구현 소환: `dev-036`(실호출모델=**sonnet**, judge 값 그대로).

## 판단 기록 (judge) — C2

- [2026-10-05 19:00] codex_gate C2 (Leader 직접 실행, `/tmp/judge-task-036-c2.json` → `/tmp/judge-task-036-c2.result.json`, `judge-result@2`·engine=jev·fallback 없음) → `codex_required: true` · mode=`adversarial-review` · focus=`error_handling` · `wanted_before_budget: true` · `budget_rule: CX-limit-unknown-r2` · `codex_calls_used: 0` · `codex_switch: on`. R2 는 한도 값이 stale 이어도 개입 가능. 입력 요약에 코드·diff·사용자 데이터 없음. override 없음.
- Codex 호출 1/4(187초, 성공): 지적 1건(Medium) — JSON 구문 슬립 × 조기 TTS 오디오 → reviewer `rev-036b` 가 **부분 채택(사실은 채택·Medium→Low·이번 변경이 만든 위험 아님·배포 비차단)**, REV-109. 채택분 = 테스트 T-A·T-B(`dev-036c`, 변이 ⓐⓑⓒ 모두 killed).

## Leader 결정 (2026-10-05 19:30) — W1 JSON 구문 슬립 수용·감시·롤백 기준

- **수용**: PE 실측 신규 TALK 구문 슬립 5/124(4.0%) vs 기준 0/124(Fisher p≈0.06), 총 재시도율 6 vs 2 건(p≈0.28 비유의), 5/5 재시도로 회복·FAILED 0, 재시도를 포함한 평균 지연 −318ms(p50 −337ms)로 **순이득**. 인과(필드 제거 → 슬립)는 입증되지 않았고 프롬프트 보강은 4%↔1% 를 가릴 표본이 안 되며 `extractJson` 좁은 복구는 공용 파싱 경로라 이번 R2 에 얹지 않는다(REV-108 권고와 동일). **정확한 표현**: 견고한 결론은 TALK 지연 p50 −337ms·CHAT p50 −546ms·출력 JSON −9.4%/−18.9%이고, p95 는 부트스트랩 95% 구간이 [−545, +421]ms 라 **판정 불가**(PE 요약의 "p95 비악화"는 과한 해석).
- **감시(배포 후, REV-109)**: 배포 직후 첫 TALK 100턴에서 `attempt=2`(toolLog `$.attempt`·RequestTrace LLM 단계 `attempts`) 8% 초과 · `earlyStop='RETRY'` 8% 초과 · `RequestTrace.status='ERROR'`+`errorCode='ENGINE_ERROR'` 1건 이상 중 하나라도 해당하면 `extractJson` 좁은 복구(REV-108 B)를 별도 task 로 열고, 지속·악화하면 talk@v7·chat@v2 로 **롤백**(`scripts/deploy.sh TheKaiwa --rollback` 또는 상수 되돌림 — 계약 외 변경 없음, DB 영향 없음)을 검토. 실기기에서 "들린 말과 화면이 다름" 1건이라도 보고되면 같은 절차.
- **운영 기준선(배포 전 채취, 읽기 전용 — pm2-err.log 카운트)**: `/home/brownjeon/apps/thekaiwa/shared/logs/pm2-err.log`(2026-10-01~10-05 10:40, 117줄, QA·스모크 트래픽 포함, 전 프롬프트 합산) — `1차 응답 계약 위반` 26줄 중 `JSON 파싱 실패` **2줄**(TALK 한정 분모는 로그에 없음 → 배포 전 v7 최근 100턴 `toolLog.attempt` 분포는 QA/deployer 가 DB 로 별도 확인 가능하면 보강). 배포 후 같은 로그의 `JSON 파싱 실패` 증가분을 본다.
- **후속(정리 backlog)**: O-1 `TurnAudio.metrics().mismatch` 를 서버가 어디에도 기록하지 않음 — task-007 C1-3 ③ 이 약속한 Trace 기록(불일치 시 `TTS_ALIGN` Trace 단계·`console.warn(traceId)`) 미구현 · REV-108 L-3·L-4(문서 잔재 `docs/screens.md:488·8052·8087`·`.codex/agents/prompt-engineer.toml` 생성본 재생성·persona `tutor.md:65` "읽기" 는 다음 persona 수정 때 그 행에서만 제거) · T-C(슬립→`runJsonWithRetry` `attempts===2` 단언).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-05 17:43 |

## Developer 기록

- [~17:35] 착수 — 사용처 전수 grep(src 22파일·문서 5·`.codex` 1·`tests/live` 1). **사실 정정**: HEAD 의 실제 버전은 `talk@v7`·`chat@v2` 다(지시문의 "v8·v3" 는 screens.md 가 적은 *제거 task 의 목표 버전* 이었음). 그래서 실제 +1 = **talk@v8 · chat@v3** 로 올렸다(버전 건너뜀 방지·screens.md/PE 기록과 일치). Leader 가 v9/v4 를 원하면 상수 2곳 + 테스트 3곳만 바꾸면 된다.
- [~17:42] **체크포인트 ② ④ 완료**
  - 완료: `structuredResponse/schemas.ts`(`TutorResponse.conversation`·`conversation` 스키마 required/properties 에서 읽기 줄 필드 제거) · `prompts/talk.ts`(talk@v8: 머리 주석·tail 지시 줄·키 순서 문구·`[순서 예]` 골격) · `prompts/chat.ts`(chat@v3: 지시 줄·머리 주석) · `orchestrator/index.ts`(`saveTurnTx` 의 `reading: null`) · `components/chat/useChatTurn.ts`(`onDone` 의 reading 줄 삭제) · `types/chat.ts`(`TurnDoneEvent.conversation`, `ChatMessage.reading` 주석) · `chats/index.ts`(`MessageDto.reading` 주석, 응답엔 그대로).
  - 테스트(약 13파일): `TutorResponse` 리터럴 정리 + `prompts.test.ts`(키 순서·버전 v8) · `task026.test.ts`(버전 v8/v3) · `jsonPathStream.test.ts` 입력 + 계약 밖 키 허용 1건 · 신규 부정 단언 2건(`prompts.test.ts`: 지시·골격·스키마·실 요청·persona 에 없음 / 옛 키를 내면 기본 경로 거부·strip 옵션 경로 통과 문서화).
  - 남은 일: 문서 3종(api-contract·tutor-persona-validation·prompt-engineer.md) · 증빙(typecheck·eslint·전체 npm test).
  - 다음 첫 행동: 문서 갱신 → `grep -rn replyReading src` 확인 → 실행 증빙.
  - 주의점: ① **스키마의 모르는 필드 처리 = 거부(reject)** — TALK/CHAT 요청은 `stripAdditionalProperties` 를 켜지 않아 `conversation.additionalProperties:false` 위반 → ajv 1회 재시도(≈+4~10s) → 재실패 시 `JsonSchemaError`(FAILED). 아래 "판정" 참고. ② `done.conversation` 은 검증을 통과한 `data.conversation` 객체 그대로(`shaped.reply`)라 코드 수정 없이 읽기 줄이 빠진다.
  - 미커밋 파일: 소스 20 내외(위 목록) + 이 task 이력서. `CLAUDE.md` 변경은 다른 세션 것(무접촉).
- [17:51] **체크포인트 ⑦ 완료(구현 전체)**
  - 완료: 문서 3종(`docs/design/api-contract.md`·`docs/design/tutor-persona-validation.md`·`.claude/agents/prompt-engineer.md`) 갱신, 실행 증빙 수집.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa`, 출력 미절단): `npm run typecheck` rc=0 · `npx eslint src/modules/conversation src/modules/engine src/components/chat src/types` rc=0(출력 없음) · `conversation/__tests__` 전체 + `engine/__tests__/jsonPathStream` **419/419 pass** · 전체 `npm test` **1472건 중 pass 1471 · fail 0 · skip 1**(직전 1469 → 신규 3건: prompts.test 2 + jsonPathStream 1).
  - `grep -rn replyReading src` = **1건** — `src/modules/conversation/__tests__/prompts.test.ts:61` `const REMOVED_READING_KEY = 'replyReading'`(부정 단언 전용 상수, 의도적). 그 밖 코드·테스트·스키마·프롬프트 0.
  - 판정(스키마의 모르는 필드): **거부(reject)**. `conversation` 스키마가 `additionalProperties:false` 이고 TALK·CHAT 요청은 `stripAdditionalProperties` 를 켜지 않는다(켜는 곳은 A4 LESSON 하나, `lesson.test.ts` 가 "TALK 은 안 지운다" 를 고정). 옛 습관으로 키를 내면 ajv 위반 → 1회 재시도(≈+4~10s, TALK 12s fail-fast 위협) → 재실패 시 `JsonSchemaError`(FAILED). `prompts.test.ts` 신규 테스트가 양쪽 동작(기본 거부·옵션 시 통과)을 문서화. 한 줄 대안 = `buildTalkRequest`·`buildChatRequest` 요청에 `stripAdditionalProperties: true` — **Leader/PE 결정 대기, 미적용**.
  - 위험(Leader·PE 중점): ① persona `tutor.md` §6 TALK 행(65행)에 아직 "…상황별·**읽기**·한국어 번역" 이 있다(CHAT 은 "TALK 과 같되") — 지시·스키마에는 없는데 persona 만 읽기를 언급해 모델이 옛 키를 추측해 낼 여지. persona 무변경 지시라 건드리지 않음. ② 버전 번호: HEAD 는 talk@v7·chat@v2 라 v8·v3 로 올림(지시문의 v9/v4 와 다름). ③ 문서 중 이 task 범위 밖에 옛 이름이 남은 곳: `docs/design-spec.md:183`(§67 구조화 응답 요약)·`docs/screens.md:488·8052·8087`(designer 가이드)·`.codex/agents/prompt-engineer.toml`(sync 스크립트 생성본)·`tests/live/talk-length-measure.ts`(v3 기준선 문구 상수, qa/PE 소유).
  - 말풍선 `reading` 미사용 근거: `MessageBubble.tsx`·`TalkTutorBubble.tsx`(`hasKanji` import 만)·`messages.ts` 에 `reading` 0건, `src/components` 전역에서 메시지 `.reading` 소비처 없음(남은 `reading` 은 단어·교정 카드·레슨·평가 필드).
  - 데모 게이트: `DEMO_GATE_PASSED` / task: task-036 (status not_required, judge 판정 none) — 화면 변경 없음(`useChatTurn.ts` 는 훅 한 줄 삭제).
  - 미커밋 파일: 소스 21(프롬프트 2·스키마 1·서버 2·클라이언트/타입 2·테스트 13 포함 — `git status` 참조) + 문서 3 + 이 이력서. `CLAUDE.md`·`board.md` 변경은 다른 세션/Leader 것(무접촉). 커밋·push 안 함.

- [19:00] **체크포인트 「REV-108 L-1·L-2 단언 보강」 완료**(신규 소환 developer, 테스트 파일만 — 제품 코드·프롬프트·스키마·persona·화면·DB 무변경, 커밋·push 안 함)
  - 완료: **L-1** `prompts.test.ts` 에 새 test `task-036(REV-108 L-1): buildTalkRequest·buildChatRequest 는 stripAdditionalProperties 를 켜지 않는다 …` 추가(기존 "옛 키 방출 시 기본 경로 거부" test 바로 뒤) — `assert.ok(!talk.stripAdditionalProperties)`·CHAT 동일 + 지시한 의도 주석 1줄(옛 키 방출은 거부(1회 재시도), PE 실측 0/160, 켜려면 사유와 함께 이 단언을 같이 바꾼다). **L-2** `task026s2.test.ts` 에 새 test `saveTurnTx(task-036, REV-108 L-2): 강사 행 DONE 갱신은 reading 을 null 로 명시해 쓴다 …` 추가 — 이음매는 **있었다**: 같은 파일의 `fakeTx` 가 강사 행 `chatMessage.updateMany` 인자를 `calls[1].args` 로 기록하므로 정적 소스 정규식이 아니라 **실행 단언**(`where.id==='ma'`·`data.status==='DONE'`·`data.content`·`data.reading === null` — `assert.equal` 은 strict 라 `undefined`(키 누락)도 실패).
  - 변경 파일(2): `src/modules/conversation/__tests__/prompts.test.ts` · `src/modules/conversation/__tests__/task026s2.test.ts`.
  - **변이 확인**(미러 `~/.node-local/thekaiwa` 사본에서만 → NFS 원본 `cp` 로 원복 → `cmp` 일치, 변이마다 두 파일 `prompts.test`+`task026s2.test` 49건 실행):
    | 변이 | 대상 | 결과 |
    |---|---|---|
    | M9 `buildTalkRequest` 에 `stripAdditionalProperties: true` | `prompts/talk.ts:323` | **killed** — 49건 중 정확히 신규 L-1 test(#7) 1건만 FAIL |
    | M10 `buildChatRequest` 에 `stripAdditionalProperties: true` | `prompts/chat.ts:43` | **killed** — 신규 L-1 test(#7) 1건만 FAIL |
    | M8 `saveTurnTx` `reading: null` → `''` | `orchestrator/index.ts:286` | **killed** — 신규 L-2 test(#32) 1건만 FAIL |
    원복 후 `talk.ts`·`chat.ts`·`orchestrator/index.ts` 모두 NFS 원본과 `cmp` 일치(NFS `src/` 는 변이 중 한 줄도 안 건드림).
  - **실행 증빙**(미러, 출력 미절단·리다이렉트 로그 전체 확인): 신규 단언 2 test 단독 실행 → `prompts.test`+`task026s2.test` 49/49 pass · `npm run typecheck` 상당(`tsc --noEmit`, sync 후) rc=0·출력 0줄 · `npx eslint src/modules/conversation` rc=0·출력 0줄 · `conversation/__tests__` 전체 + `engine/__tests__/jsonPathStream` **421/421 pass · fail 0 · skip 0**(직전 419 → 신규 2) · 전체 `npm test` **tests 1474 · pass 1473 · fail 0 · cancelled 0 · skipped 1**, exit 0(직전 1472/1471/skip 1 → 신규 test 2건만 증가, skip 1 은 기존 그대로). 변경 직후 미러↔NFS 5개 파일(`talk.ts`·`chat.ts`·`orchestrator/index.ts`·두 테스트) `cmp` 동일.
  - 남은 일: 없음(REV-108 L-1·L-2 닫힘). L-3(해석 문구)·L-4(`screens.md`·`.codex`·persona 잔재)는 이 후속의 범위 밖(Leader·designer 경로).
  - 다음 첫 행동: Reviewer 재확인(L-1·L-2 변이 M8·M9·M10 killed 확인) → QA 인계(REV-108 high_risk_areas 그대로).
  - 주의점: ① 기존 `task026s2` 의 번역 조건부 갱신 test(`calls[1].args` 를 `{translation:string}` 로 캐스트)는 건드리지 않고 L-2 를 **별도 test** 로 분리했다(실패 시 원인이 이름으로 바로 드러나도록). ② L-1 단언은 `!x.stripAdditionalProperties`(undefined·false 모두 통과) — "켜지 않음" 만 고정하며, LESSON(`lesson.test.ts:924` 가 true 를 고정)과는 독립.
  - 미커밋 파일: 이 후속 2파일 + 앞선 task-036 구현 미커밋분 그대로(`git status` 참조). `CLAUDE.md`·`board.md` 변경은 다른 세션/Leader 것(무접촉).

- [19:22] **체크포인트 「REV-109 T-A·T-B 추가」 완료**(신규 소환 developer, 테스트 파일만 — `turnAudio.ts`·프롬프트·스키마·persona·화면·DB 무변경, 라이브 LLM·TTS 0(fake 만), 커밋·push 안 함)
  - 완료: `src/modules/conversation/__tests__/task007.test.ts` 끝에 새 test 2건 + 도우미 2개(`slipRaw`·`stripFence`). 입력은 슬립 **구조**(`…"proposals":[]},"userKo":"…"}` + 코드펜스)를 빌더로 고정하고 문장은 합성(c02#1 형 2문장 / T-B 는 4문장) — 사람 이름·사용자 실데이터 없음. 각 test 가 `assert.throws(() => JSON.parse(stripFence(raw)), SyntaxError)` 로 "입력이 실제 구문 슬립(루트가 일찍 닫힘)"임을 먼저 고정(엔진 import 없이 순수 JSON 파싱 — 후속 (B) 복구가 들어와도 이 단언은 뒤집히지 않는다).
  - **T-A** `task-036 / REV-109 T-A: 구문 슬립 → 재시도 replyJa 가 1차와 같으면 조기 음성은 finalize 전에 이미 나가 있고, 경고 0·추가 합성 0` — gate 없는 speaker. `feed(slip, call 1)` → `earlyStop===null`·`calls.map(text)===['そうですか！','どんな映画でしたか？']`·`audios().length===2`(조기 경로가 실제로 켜졌다는 증거를 먼저 단언) → `feed(doc(REPLY), call 2)` → `earlyStop==='RETRY'`·`calls.length===2` → `mark=events.length` 에서 `events.slice(0,mark)` 에 audio 2개(= finalize 보다 먼저) → `finalize(같은 replyJa)` → `warnings()===[]`·`calls.length===2`·`events.length===mark`·`!mismatch && audioCount===2 && earlyChunks===2 && chunks===2`.
  - **T-B** `task-036 / REV-109 T-B: 구문 슬립 → 재시도 replyJa 가 1차와 다르면 이미 나간 음성은 남고(회수 불가), 불일치 확정 뒤 대기·진행 중 청크는 합성도 이벤트도 0` — 4문장 슬립 + speaker(청크 0 즉시, 청크 ≥1 은 gate). 동시 2 슬롯이 청크 1·2 로 차고 청크 3 이 **큐 대기**인 상태를 만든다(2문장으론 "오디오가 나감"과 "큐에 남음"이 동시에 안 된다 — 기존 `:137`·`:303` 은 gate 로 오디오 0). 단언: `audios().length===1`(finalize 전 조기 오디오)·`calls.map(chunkIndex)===[0,1,2]` → call 2 첫 조각 `earlyStop==='RETRY'` → `finalize(첫 문장이 다른 replyJa)` → **`Promise.race(settled, sleep 50)==='SETTLED'`**(큐 비움 증거) · `warnings()===['AUDIO_TEXT_MISMATCH']` · `events.length===mark+1`·`events[mark].data` = 경고(= 이미 나간 audio 뒤) · `audios()` deepEqual 이전 스냅샷(이미 나간 것 유지) · `mismatch===true` · `calls.length===3`(추가 합성 0 — 큐의 청크 3·최종 답 모두) → gate 해제·30ms 뒤 `events.length` 불변·`calls.length===3`·`audioCount===1`.
  - **변이 확인**(미러 `~/.node-local/thekaiwa` 사본에서만 적용 → NFS 원본 `cp` 로 원복 → 변이마다 `cmp` 일치, 변이당 `task007.test.ts` 20건 실행, 스크립트 `scratchpad/dev036c-mut*.sh`):
    | 변이 | 내용 | 결과(FAIL 난 test) |
    |---|---|---|
    | ⓐ | `turnAudio.ts:305` 불일치·자막전환 뒤 emit 가드 제거 | **killed** — 20건 중 3 FAIL: 기존 #15(`:303`)·#16(TEXT_ONLY 동시 2)·**신규 T-B(#20)**. T-A 는 불일치 경로가 아니라 해당 없음 |
    | ⓑ | `turnAudio.ts:213` `queue.length = 0` 제거 | **killed — T-B 1건만 FAIL**(기존 테스트는 못 잡던 변이). 메커니즘: `checkSettled` 가 `queue.length===0` 을 요구해 큐가 남으면 `settled()` 가 gate 에 묶인 진행 중 합성이 끝날 때까지 안 풀린다(`SETTLED` 경주 → `TIMEOUT`). 참고: `run()` 진입 가드(`:264`)가 있어 큐가 남아도 **speaker 호출은 안 늘어나므로** `calls.length` 단언만으로는 ⓑ 를 못 잡는다 → `settled` 경주 단언이 이 변이의 유일한 킬러 |
    | ⓒ | 정렬(앞부분 일치) 판정 항상 true(`if (!aligned)`→`if (false)`) | **killed** — 4 FAIL: 기존 #8·#15·#18 + **신규 T-B(#20)** |
    | ⓓ(보너스) | ⓑ + `run()` 진입 가드(`:264`) 제거 — 큐 청크 3 이 불일치 뒤 합성됨 | **killed — T-B 1건만 FAIL**(`calls.length===3` 단언이 잡음 → 이 단언이 장식이 아님을 확인) |
    | ⓔ1(보너스, T-A 용) | `finalize` 정렬 판정 항상 false → 같은 replyJa 인데도 경고·큐 비움 | **killed** — 8 FAIL, **T-A(#19)** 포함 |
    | ⓔ2(보너스, T-A 용) | `finalize` 가 이미 나간 문장까지 다시 합성(`splitForSpeech(replyJa)`) | **killed** — 3 FAIL: 기존 #6·#7 + **T-A(#19)**(`calls.length===2` 추가 합성 0) |
    | ⓕ(보너스, "합성이 막혀 우연히 통과" 방지) | `onDelta` 가 항상 return(조기 경로 꺼짐) | **killed** — 8 FAIL, **T-A(#19)·T-B(#20)** 모두 포함(`audios().length` 선행 단언이 조기 경로 off 를 즉시 드러냄) |
    원복 후 최종 `cmp` NFS↔미러 `turnAudio.ts` 일치, `git diff -- turnAudio.ts` 빈 출력(NFS `src` 는 변이 중 한 줄도 안 건드림).
  - **실행 증빙**(미러, 출력 미절단·리다이렉트 로그 전체 확인; 로그는 scratchpad `dev036c-*.log`): `task007.test.ts` 단독 `node --import tsx --test` → tests 20·pass 20·fail 0 · `npm run typecheck` rc=0·출력 0줄 · `eslint src/modules/conversation` rc=0·출력 0줄 · `conversation/__tests__` 전체 **tests 417·pass 417·fail 0·skip 0** · 전체 `npm test` **tests 1476 · pass 1475 · fail 0 · cancelled 0 · skipped 1**, exit 0(직전 1474/1473/skip 1 → 신규 test 2건만 증가, skip 1 은 기존 그대로).
  - 남은 일: 없음(REV-109 권고 (b) T-A·T-B 닫힘). 선택 T-C(슬립 원문 → `runJsonWithRetry` `attempts===2`·`extractAndValidate.parseError===true`, 후속 (B) 복구 도입 시 의도적으로 뒤집을 테스트)는 지시 범위(2건)를 지켜 **추가하지 않았다** — 필요하면 Leader 지시로. O-1(`AUDIO_TEXT_MISMATCH` 서버 기록)은 REV-109 가 별도 후속으로 분류(이 후속 범위 밖).
  - 다음 첫 행동: Reviewer 재확인(T-A/T-B 가 변이 ⓐⓑⓒ 를 killed 하는지 — 위 표: ⓐ·ⓒ 는 기존 테스트와 중복 킬, **ⓑ 는 T-B 단독 킬**) → QA 인계(REV-109 §7 그대로).
  - 주의점: ① T-A 는 불일치 경로가 아닌 **일치 경로** 테스트라 ⓐⓑⓒ 중 어느 것에도 걸리지 않는 게 정상이다 — T-A 의 킬러는 ⓔ1·ⓔ2·ⓕ. ② 두 test 모두 `sleep(10)` 으로 microtask·합성 settle 을 기다린다(기존 `:102`·`:137` 와 같은 방식) — 타이머 경합은 fake speaker 가 즉시 resolve 라 없고, gate 는 명시적 `release()` 로만 풀린다. ③ T-B 의 `elapsedMs: 100` 은 harness `elapsed: () => 100` 고정값(기존 harness 그대로).
  - 미커밋 파일: 이 후속은 `src/modules/conversation/__tests__/task007.test.ts` 1파일(+이 이력서). 앞선 task-036 구현 미커밋분 그대로(`git status` 참조). `CLAUDE.md`·`board.md` 변경은 다른 세션/Leader 것(무접촉). 커밋·push 안 함.

## Prompt-Engineer 기록 (2026-10-05)

- [18:40] **완료 — 프롬프트·계약 점검 통과 / 라이브 A/B 측정 완료 / 조건부 보완(strip) 미적용 / persona 무변경 / Registry 절차 확인.** 커밋·push 안 함. 판정: **조건부 통과(PASS with watch)** — 옛 키 방출 0/160, 교정 검출 80/80(=기준 유지)·오탐 0/20·`original` 무수정 80/80·replyKo/userKo 품질 동일, **지연 개선**(TALK p50 −337ms·CHAT p50 −546ms, 짝지은 비교 96/124·32/36 에서 작업본이 빠름), 출력 JSON −9.4%(TALK)·−18.9%(CHAT), 첫 문장 확정 시각 불변. 단 **1차 통과율 점추정은 하락**(TALK 98.4%→95.2%) — 원인은 옛 키가 아니라 JSON 구문 슬립 5건(아래 "관찰 W1", 작업본에만 나옴, Fisher p≈0.06) — Leader 판단 필요.
- 총 라이브 호출 **324건**(Claude CLI·haiku·구독): 스모크 4 + 1차 152(교정 TALK 20×2회×2팔=80 · userKo TALK 12×1×2=24 · CHAT 12×2×2=48) + 2차 88(교정 20+userKo TALK 12+CHAT 12, 각 ×2팔) + 3차 80(교정 TALK 20×2회×2팔 — 슬립 원인 확인용). 순차·교차·호출 간격 1.5s·429 0건. 계획은 최소 96건(n≥24×2팔×2프롬프트)이었고 1차 결과의 재시도 2건 대 0건을 확인하려 2·3차를 더했다.

### 1. 프롬프트·계약 점검 (요청 본문 덤프로 확인)

스크래치 `pe036-dump.ts`(HEAD 복원본 vs 작업본의 `buildTalkRequest`·`buildChatRequest` 실제 산출 요청 + 실제 CLI 로 가는 렌더 프롬프트 `renderTranscript(withJsonOnly(system, schema), messages)`):

| 항목 | HEAD talk@v7 | 작업본 talk@v8 | HEAD chat@v2 | 작업본 chat@v3 |
|---|---|---|---|---|
| `system` 글자 | 1,726 | **1,654**(−72) | 715 | **691**(−24) |
| 스키마 JSON 글자(프롬프트 `[출력 JSON 스키마]` 로 실림) | 2,193 | **2,129**(−64) | 1,419 | **1,355**(−64) |
| CLI 로 가는 렌더 프롬프트 글자(persona 별도) | 4,153 | **4,017**(−136) | 2,368 | **2,280**(−88) |
| 옛 키 이름 출현: system / schema / 렌더 프롬프트 / persona | 3 / 2 / 5 / 0 | **0 / 0 / 0 / 0** | 1 / 2 / 3 / 0 | **0 / 0 / 0 / 0** |
| `conversation.required` = `properties` 순서 | replyJa·(옛 키)·replyKo | **replyJa·replyKo** | 같음 | **replyJa·replyKo** |
| 최상위 required | speech·conversation·correction·learning·endOfTopic·proposals(userKo 는 선택·맨 끝) | 동일 | 동일 | 동일 |
| persona(`--system-prompt`) | 2,550자 sha d4f596bd… | **같음(바이트 동일)** | 2,094자 sha a3422e8f… | **같음** |
| `stripAdditionalProperties` | 없음 | 없음(미적용) | 없음 | 없음(미적용) |

- **지시 줄·골격·스키마 required·테스트 4곳 일치 — 통과.** HEAD↔작업본 TALK `system` diff 는 정확히 3줄(키 순서 문구 `conversation(replyJa→replyKo)` · replyJa 줄 꼬리에서 읽기 문구 삭제 · `[순서 예]` 골격)뿐이고 다른 줄은 바이트 동일. CHAT 은 replyJa 줄 하나. `grep replyReading src` = `prompts.test.ts:61` 부정 단언 상수 1건(의도적). 소스·지시문·스키마·타입 흔적 0.
- **`--json-schema` 로 실제 넘어가는 스키마**: 이 환경(개발 미러) 유효 값은 `runtime.jsonSchemaFlag=false`·`KAIWA_LLM_JSON_SCHEMA_FLAG` 미설정 → 플래그는 **꺼짐**(task-004 이후 기본), 스키마는 프롬프트 `[출력 JSON 스키마]` 로 들어간다(위 표 "스키마 글자"가 렌더 프롬프트에 그대로 포함). 플래그를 켠 경로도 같은 `req.jsonSchema` 객체를 `--json-schema` 인자로 넘기므로 옛 키 없음(객체 자체에서 확인). 운영(PRODUCTION) connection 값은 읽지 않았다(코드 경로 동일).
- **A1 예산**: 사용자 프롬프트(system+창+발화) 상한 3,000자 — system 이 72자 줄어 이력 창 예산이 그만큼 늘고 최악 조합 마진은 줄지 않는다(developer 의 예산 회귀 테스트 통과). 렌더 프롬프트(persona 제외) 전형 4,153→4,017자.
- **persona 65행 "읽기" 영향 판단**: 아래 §4.

### 2. 라이브 A/B 측정 (원 출력)

방법: 저장소 파일 `tests/live/task036-reading-ab.ts`(신규, 미커밋 — 커밋 여부 Leader). arm `head` = `git archive HEAD src`(d26e70b)를 `~/.node-local/thekaiwa-head036/src`에 풀어 그 `prompts/talk.ts`·`prompts/chat.ts` 를 동적 import(진짜 v7·v2 요청·스키마·후검증), arm `work` = 작업본 미러. 항목마다 번갈아 먼저(교차)·순차·1.5s 간격, 합성 입력만(`talk-corrections.json` 20문장 = 오류 16+정답 4, `talk-userko.json` live 12문장). 옛 키 방출은 **호출별 원문 스트림**에서 `"replyReading"` 을 찾아 센다(재시도로 가려진 1차 방출 포함). 첫 음성 지표는 운영 `TurnAudio` 와 같은 `createJsonPathStreamReader`+`StreamingSentenceSplitter`+`earlySentenceProblem` 을 스트림에 걸어 잰다. 모델 haiku, 결과 JSON·로그는 scratchpad `pe036/` 에 보관.

**합산 요약(1·2·3차, 행 320 — 스크립트 `SUMMARIZE_ONLY=` 출력 원문, 재시도 원문 줄만 230자로 줄임)**

```
## 합산 요약(/tmp/kaiwa-task036-ab-run1.json + /tmp/kaiwa-task036-ab-pass2.json + /tmp/kaiwa-task036-ab-pass3.json, 행 320)

### TALK 전체(교정 20문장 ×RUNS + userKo 12문장)
| arm | n | 성공 | FAILED | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | ms 평균 | 12s 초과 | 출력JSON 평균자 | 원문1 평균자 | replyReading 원문 방출(head=계약 필드·work=옛 키) | 최종 data 에 남음 | replyKo 한글 | 이중높임 | userKo 정리 | replyJa 문장 평균 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| head | 124 | 124/124 | 0 | 122/124 | 2 | 4946 | 5940 | 4838 | 0 | 466.7 | 535.4 | 124/124 | 124 | 124/124 | 0 | 124/124 | 2.26 |
| work | 124 | 124/124 | 0 | 118/124 | 6 | 4609 | 6054 | 4519 | 0 | 422.9 | 476.9 | 0/124 | 0 | 124/124 | 0 | 124/124 | 2.19 |
- ms 차이(work−head): p50 -337 · 평균 -318 · p95 114 — 순열검정 p(중앙값)=0.002 · p(평균)=0.003
- 출력JSON 평균자 차이(work−head): -43.8자 (-9.4%)

### TALK · 교정 세트(talk-corrections 20문장)
| arm | n | 성공 | FAILED | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | ms 평균 | 12s 초과 | 출력JSON 평균자 | 원문1 평균자 | replyReading 원문 방출(head=계약 필드·work=옛 키) | 최종 data 에 남음 | replyKo 한글 | 이중높임 | userKo 정리 | replyJa 문장 평균 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| head | 100 | 100/100 | 0 | 99/100 | 1 | 5097 | 5940 | 4945 | 0 | 490.2 | 567.9 | 100/100 | 100 | 100/100 | 0 | 100/100 | 2.24 |
| work | 100 | 100/100 | 0 | 96/100 | 4 | 4672 | 5997 | 4633 | 0 | 451.4 | 509.3 | 0/100 | 0 | 100/100 | 0 | 100/100 | 2.16 |
- ms 차이(work−head): p50 -425 · 평균 -311 · p95 57 — 순열검정 p(중앙값)=0.000 · p(평균)=0.005
- 출력JSON 평균자 차이(work−head): -38.9자 (-7.9%)

### CHAT(userKo 12문장)
| arm | n | 성공 | FAILED | 1차 통과(재시도 0) | 재시도 | ms p50 | ms p95 | ms 평균 | 12s 초과 | 출력JSON 평균자 | 원문1 평균자 | replyReading 원문 방출(head=계약 필드·work=옛 키) | 최종 data 에 남음 | replyKo 한글 | 이중높임 | userKo 정리 | replyJa 문장 평균 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| head | 36 | 36/36 | 0 | 36/36 | 0 | 4044 | 5641 | 4180 | 0 | 338.9 | 439.6 | 36/36 | 36 | 36/36 | 0 | 36/36 | 2.39 |
| work | 36 | 36/36 | 0 | 35/36 | 1 | 3498 | 5046 | 3789 | 0 | 274.9 | 355.2 | 0/36 | 0 | 36/36 | 0 | 36/36 | 2.28 |
- ms 차이(work−head): p50 -546 · 평균 -392 · p95 -595 — 순열검정 p(중앙값)=0.001 · p(평균)=0.027
- 출력JSON 평균자 차이(work−head): -64.0자 (-18.9%)

### 조기 추출(TALK, 스트림 → speech.style 완료 · replyJa 첫 문장 확정)
| arm | n | 스트림 수신 | style 완료 p50 | 첫문장 확정 p50 | 첫문장 p95 | 첫문장 평균 | 필터 통과 | prefix 일치 | style 먼저 |
|---|---|---|---|---|---|---|---|---|---|
| head | 124 | 124/124 | 1683 | 1841 | 2264 | 1875 | 122/124 | 124/124 | 124/124 |
| work | 124 | 124/124 | 1699 | 1801 | 2214 | 1868 | 123/124 | 124/124 | 124/124 |
- 첫문장 확정 차이(work−head): p50 -40 · 평균 -7 — 순열검정 p(중앙값)=0.008 · p(평균)=0.877

### 교정 검출(talk-corrections: 오류 16·정답 4 × RUNS)
| arm | 오류 검출 | 오탐(정답 교정) | 유형 일치 | 교정문 일치 | original 바이트 일치(검출분) |
|---|---|---|---|---|---|
| head | 80/80 | 0/20 | 60/80 | 71/80 | 80/80 |
| work | 80/80 | 0/20 | 60/80 | 73/80 | 80/80 |

### replyReading 원문 방출 — 원문 기준 160건(head 는 그 팔의 계약 필드라 정상 — work 팔 방출 0건이 옛 키 방출)
- 재시도 talk/work/c02#1 ms=6156 raw1="```json\n{\"speech\":{\"style\":\"ENCOURAGING\"},\"conversation\":{\"replyJa\":\"そうですか！どんな映画でしたか？\",\"replyKo\":\"그렇군요! 어떤 영화였어요?\"},\"correction\":null,\"learning\":{\"grammarPoint\":\"〜に行きました( …"
- 재시도 chat/work/u03#1 ms=7890 raw1="```json\n{\n  \"speech\": {\n    \"style\": \"CHEERFUL\"\n  },\n  \"conversation\": {\n    \"replyJa\": \"そうですね。私もコーヒーが好きです。毎日飲みます。ブラウンさんは、どのくらいの頻度で飲みますか？\",\n    \"replyKo\": \"그래요. 저도 커피를 좋아해요 …"
- 재시도 talk/work/c04#4 ms=6057 raw1="```json\n{\"speech\":{\"style\":\"ENCOURAGING\"},\"conversation\":{\"replyJa\":\"いいですね。どんなことをしたいですか？\",\"replyKo\":\"좋네요. 어떤 걸 하고 싶으세요?\"},\"correction\":null,\"learning\":{\"grammarPoint\":\"〜た …"
- 재시도 talk/head/u03#4 ms=7996 raw1="```json\n{\"speech\":{\"style\":\"CHEERFUL\"},\"conversation\":{\"replyJa\":\"そうですか！私もコーヒーが好きです。毎日飲みます。ブラウンさんは、コーヒーをどのように飲みますか？\",\"replyReading\":\"そうですか！わたしもこーひーがすきです。まいにちのみます。ぶらうんさんは、こーひーをどのよ …"
- 재시도 talk/work/u03#4 ms=6689 raw1="```json\n{\"speech\":{\"style\":\"CHEERFUL\"},\"conversation\":{\"replyJa\":\"そうですね！私もコーヒーが好きです。毎日飲みます。ブラウンさんは、どんなコーヒーが好きですか？\",\"replyKo\":\"그렇군요! 저도 커피를 좋아합니다. 매일 마셔요. 브라운님은 어떤 커피를 좋아하세요?\"},\ …"
- 재시도 talk/work/u08#4 ms=6366 raw1="```json\n{\"speech\":{\"style\":\"NEUTRAL\"},\"conversation\":{\"replyJa\":\"1000円です。袋に入れましょうか？\",\"replyKo\":\"천 원입니다. 봉투에 넣어드릴까요?\"},\"correction\":null,\"learning\":{\"grammarPoint\":\"疑問文(いく …"
- 재시도 talk/head/e04#5 ms=9216 raw1="```json\n{\"speech\":{\"style\":\"ENCOURAGING\"},\"conversation\":{\"replyJa\":\"そうですね。毎日勉強していますね。今日は何を勉強しましたか？\",\"replyReading\":\"そう ですね。まいにち べんきょう して いますね。きょう は なに を べんきょう しましたか。\",\"replyKo …"
- 재시도 talk/work/c01#5 ms=6054 raw1="```json\n{\"speech\":{\"style\":\"NEUTRAL\"},\"conversation\":{\"replyJa\":\"駅ですね。あそこです。\",\"replyKo\":\"역이군요. 저기입니다.\"},\"correction\":null,\"learning\":{\"grammarPoint\":\"疑問文（どこですか）\",\"diffi …"
- 재시도 talk/work/c04#6 ms=5997 raw1="```json\n{\"speech\":{\"style\":\"ENCOURAGING\"},\"conversation\":{\"replyJa\":\"いいですね。何をしますか？\",\"replyKo\":\"좋네요. 뭘 하실 거예요?\"},\"correction\":null,\"learning\":{\"grammarPoint\":\"〜たい(希望を表す)\" …"
```

**차수별(같은 스크립트 표에서 발췌)**

| 차수 | 프롬프트 | arm | n | 재시도 | ms p50 | ms p95 |
|---|---|---|---|---|---|---|
| 1차 | TALK | head | 52 | 0 | 5,024 | 5,928 |
| 1차 | TALK | work | 52 | 1 | 4,436 | 5,481 |
| 1차 | CHAT | head | 24 | 0 | 4,048 | 5,373 |
| 1차 | CHAT | work | 24 | 1 | 3,561 | 5,046 |
| 2차 | TALK | head | 32 | 1 | 4,670 | 5,980 |
| 2차 | TALK | work | 32 | 3 | 4,407 | 6,366 |
| 2차 | CHAT | head | 12 | 0 | 3,840 | 5,641 |
| 2차 | CHAT | work | 12 | 0 | 3,445 | 4,405 |
| 3차 | TALK | head | 40 | 1 | 5,113 | 5,908 |
| 3차 | TALK | work | 40 | 2 | 4,746 | 6,054 |

**핵심 수치(합산)**

| 지표 | TALK head(v7) | TALK work(v8) | CHAT head(v2) | CHAT work(v3) |
|---|---|---|---|---|
| n / 성공 / FAILED | 124 / 124 / 0 | 124 / 124 / 0 | 36 / 36 / 0 | 36 / 36 / 0 |
| ajv 1차 통과(재시도 0) | 122/124(98.4%) | **118/124(95.2%)** | 36/36 | **35/36(97.2%)** |
| ms p50 / p95 / 평균 | 4,946 / 5,940 / 4,838 | **4,609 / 6,054 / 4,519** | 4,044 / 5,641 / 4,180 | **3,498 / 5,046 / 3,789** |
| 재시도 제외 p50 / p95 / 평균 | 4,910 / 5,908 / 4,776 | **4,579 / 5,517 / 4,433** | 4,044 / 5,641 / 4,180 | 3,498 / 4,802 / 3,672 |
| 출력 JSON 평균 글자(검증 통과 data) | 466.7 | **422.9**(−43.8, −9.4%) | 338.9 | **274.9**(−64.0, −18.9%) |
| 원문(호출 1 스트림) 평균 글자 | 535.4 | 476.9 | 439.6 | 355.2 |
| 옛 키 원문 방출(작업본만 의미) | (계약 필드 124/124) | **0/124** | (계약 필드 36/36) | **0/36** |
| replyKo 한글 포함 / 이중 높임 | 124/124 / 0 | 124/124 / 0 | 36/36 / 0 | 36/36 / 0 |
| userKo 정리(sanitize) 통과 | 124/124 | 124/124 | 36/36 | 36/36 |
| replyJa 문장 평균(상한 2, 허용 3) | 2.26 | 2.19 | 2.39 | 2.28 |
| 12s 초과 | 0 | 0 | 0 | 0 |

- **지연**: TALK 중앙값 −337ms(−6.8%, 순열검정 p=0.002)·평균 −318ms(p=0.003), 짝지은 비교(같은 입력·같은 차수 쌍) 작업본이 **96/124 더 빠름**(부호검정 p<1e-4, 짝 중앙 차이 −363ms). CHAT 중앙값 −546ms(−13.5%, p=0.001)·짝 32/36(p=2e-6). **p95 는 TALK 에서 +114ms(5,940→6,054)** — 재시도(≈6.0~6.7s)가 꼬리에 얹힌 탓이고 재시도 제외 p95 는 −391ms(5,908→5,517)이다. 최대치 TALK head 9,216(재시도 1건)·work 6,689.
- **출력**: 읽기 줄을 뺀 만큼 JSON −9~19%. 모델이 길이를 바꾸지 않았다(replyJa 문장 평균 2.19 vs 2.26, 상한 준수는 오히려 약간 좋음).
- **조기 추출(첫 음성 직전 단계, 합산 TALK 124/arm)**: speech.style 완료 p50 1,683→1,699ms · **replyJa 첫 문장 확정 p50 1,841→1,801ms(−40ms)·평균 1,875→1,868(n.s.)** · 스트림 수신 124/124 · **style 이 첫 문장보다 먼저 124/124(양 팔)** · 첫 문장이 최종 replyJa 의 앞부분(prefix 일치) **124/124(양 팔, 재시도 6건 포함)** · 안전 필터 통과 122→123/124. → `speech.style`→`replyJa` 조기 추출·문장 단위 합성은 안 깨졌고 첫 음성 시작 시점은 비악화(읽기 줄은 replyJa 뒤에 나오던 것이라 첫 음성은 원래 영향 없음 — `done` 시점만 앞당겨짐). `task007-latency.ts`(게이트웨이+M4 TTS 포함 E2E, 개발 서버 3011 필요)는 돌리지 않았다 — QA 완료 기준 2 몫.
- **교정 검출(talk-corrections, FLUENCY 기본 모드, 합산 5회전)**: 오류 검출 head **80/80**·work **80/80** · 오탐(정답 문장 교정) **0/20·0/20** · `original` 바이트 일치(검출분) **80/80·80/80** · 교정문 일치 71/80·73/80 · errorType 일치 60/80·60/80(라벨은 주관적 — e02·e05·e10 등 양 팔 공통). task-004 기준 16/16·오탐 0/4 유지.
- **계약 위반 사례(전부)**: work 7건 = **JSON 구문 슬립 5**(c02#1·c04#4·u08#4·c01#5·c04#6 — 전부 루트를 `"proposals":[]` 뒤에서 한 번 일찍 닫고 `,"userKo":"…"}` 를 이어 붙임 → `JSON 파싱 실패` → 재시도 성공) + replyJa 3문장 초과 2(chat u03#1·talk u03#4 — `コーヒーが好きです。` 입력이 head 에서도 같은 위반을 냄). head 2건 = replyJa 문장 초과 1(u03#4) + `correction.chunkType=PARTICLE`(스키마 허용값 밖, e04#5). **옛 키가 원인인 위반 0건.**

### 3. 조건부 보완 — `stripAdditionalProperties` 미적용(근거)
- 승인 조건 "신규 arm 에서 옛 키 방출 1건이라도" → **작업본 원문 160호출(TALK 124+CHAT 36, 재시도 전 1차 응답 포함)에서 0건**. 95% 신뢰 상한 ≈ 1.9%(rule of three). 방출 시 비용은 ajv 위반 1회 재시도(+≈1.5~3s)이고 FAILED 는 재시도에서도 또 내야 하므로 위험은 작다 → 적용 안 함(strip 은 계약 드리프트를 가린다). `lesson.test.ts` "TALK 은 스키마 밖 필드를 지우지 않는다" 단언은 **무변경**. 표본 한계 사실만 기록: 0/160 은 "방출 거의 없음"이지 "절대 없음"이 아니다.

### 4. persona §6 TALK 행 "읽기" (보고만, 무변경)
- 65행 `conversation`(…상황별·**읽기**·한국어 번역)은 의미상 낡았지만(TALK persona 안의 "읽기" 는 이 한 곳, `replyReading` 문자열은 0건) **영향 관측 없음**: 작업본 160호출에서 옛 키 방출 0, 지시 줄·골격·스키마가 정확한 키 이름을 모두 보여 주므로 persona 의 낡은 문구가 모델을 끌지 않았다. persona 바이트 불변(예열·시스템 프롬프트 캐시 재사용 유지). **권고: 지금 안 고친다. 다음에 persona 를 다른 이유로 고칠 때 이 행에서 "읽기" 만 지우고(CHAT 행은 "TALK 과 같되" 라 자동), 레슨 행의 "화자·일본어·읽기·한국어"(`dialogue[].reading`)는 맞는 표현이니 건드리지 않는다.** persona 변경은 Leader 승인 사항이라 직접 수정하지 않았다.

### 5. Prompt Registry (읽기 전용 확인 — 쓰기·sync 실행 0)
- `package.json`·`scripts/` 어디에도 **`npm run prompts:sync` 가 없다**(design-spec §8·`prompt-engineer.md` 책임 4 에는 적혀 있으나 미구현 — task-012c D-C12: Prompt Registry 는 **012c-2** 몫으로 넘겨졌고 `src/app/api/admin/v1` 에 prompts 라우트도 없음). DB 는 `PromptTemplate` 11행(`ask·chat·chatReview·evalGen·evalGrade·lesson·planAnalysis·reviewMix·talk·teacher-persona·wordEnrich`, `reviewDecision` 키 없음)·**`PromptVersion` 0행**(읽기 전용 count, `pe036-registry-check.ts`).
- 따라서 talk@v8·chat@v3 의 "반영 절차" = **코드 상수(`TALK_PROMPT_VERSION`·`CHAT_PROMPT_VERSION`)가 릴리스에 실려 가는 것이 전부**다. 런타임은 TS 빌더가 만든 프롬프트를 그대로 쓰고(DB ACTIVE 본문을 읽지 않음), `ConfigurationVersion`·AppSetting·시드 변경 없음. `teacher-persona` 키도 persona 바이트 불변이라 무변경. 운영 DB 쓰기·sync 안 함, 개발 DB 에 만든 행 없음. 012c-2 가 생기면 `prompts:sync` 가 이 상수를 `PromptVersion(SOURCE_CODE)` 로 올리게 되므로 그때 `talk@v8`·`chat@v3` 가 첫 기록 후보다(그 시점에 `prompt-engineer.md` 책임 4 의 `npm run prompts:sync` 문구가 아직 미구현이었음을 정정).

### 6. 관찰·위험 (Leader·Reviewer 중점)
- **W1 (watch) — JSON 구문 슬립 `…"proposals":[]},"userKo":…}`**: 5/124(4.0%) work-TALK vs 0/124 head(Fisher 양측 p≈0.06) — 3개 차수 모두에서 나왔고(1·2·2건) head 는 한 번도 없었다(task-026 의 v7 측정 0/52 를 더하면 v7 은 0/176). CHAT 은 0/36·0/36. 가설: `proposals` 가 예전 마지막 키였던 관성 + 작은 키 하나(`userKo`)가 뒤에 붙은 구조 — 읽기 줄을 뺀 것과의 인과는 **입증 못 함**(괄호 표기 유형은 두 팔 분포가 비슷해 아님, 우연 배제 못함). 총 TALK 1차 위반율 work 6/124=**4.8%**(목표 ≤5% 안이지만 95% 상한 ≈10%)·head 2/124=1.6%(Fisher p=0.28 — 유의하지 않음). 비용: 재시도 턴 ≈6.0~6.7s(12s fail-fast 안, `earlyPrefixOk` 는 전부 참이라 조기 음성 불일치도 없음), 평균 지연은 여전히 −318ms.
  - 선택지(결정은 Leader): **(A) 수용**(지연 이득이 재시도 비용보다 큼) · **(B) developer: `extractJson` 에 좁은 복구 추가** — 파싱 실패가 "루트가 닫힌 뒤 `,"키":…}` 가 이어지는" 모양이면 직전 `}` 를 한 번 지우고 재파싱(복구 결과는 ajv 가 어차피 다시 검증) → 재시도 자체가 사라지고 같은 슬립이 다른 필드에서 나와도 흡수 · **(C) PE: 프롬프트 보강 후 A/B 재측정**(예: 키 순서 문구에 "userKo 는 마지막 키 — 그 뒤에서만 닫음", 약 +20자·A1 예산 여유는 이번 −72자로 충분). 요청하시면 (C)를 같은 방식(약 80호출)으로 측정해 보겠습니다. 이번에는 Leader 사전 승인 범위(strip·persona)가 아니어서 프롬프트를 더 바꾸지 않았다.
- W2: 이 task 범위 밖에 낡은 이름이 남은 곳 — `docs/screens.md:488·8052·8087`(designer 가이드, `done`→`reading=replyReading` 서술), `.codex/agents/prompt-engineer.toml`(sync 스크립트 생성본 — 재생성 필요), `tests/live/talk-length-measure.ts:45`(task-024 의 v3 기준선 문구 상수 — **이 스크립트는 task-036 이후 재현 불가**라 머리에 경고를 달았고 동작은 안 바꿈). `docs/design-spec.md:183`·`api-contract.md` 는 developer 가 이미 정정.
- W3: `ChatMessage.reading` 컬럼·#32 조회 DTO `reading` 필드는 남아 있어 옛 메시지는 값 유지, 새 메시지는 null — QA 가 "말풍선 읽기 줄(후리가나·한글) 정상"을 새 메시지로 확인.

### 7. 산출물·잔재 정리
- 신규: `tests/live/task036-reading-ab.ts`(A/B 스크립트 — 환경변수 `BASE_SRC`=HEAD 복원 src, `RUN_START`·`PHASES`·`SUMMARIZE_ONLY` 등은 파일 머리 주석) · 수정: `tests/live/talk-length-measure.ts`(머리 경고 주석만). 소스·테스트·프롬프트·persona·스키마 **무수정**(A/B 가 보완 조건에 안 걸림).
- 미러 `~/.node-local/thekaiwa` 는 `sync-local.sh` 로 작업본에 맞춰 둠(개발 전용). 스크래치: `~/.node-local/thekaiwa-head036/`(HEAD d26e70b `src` 복원 + `node_modules` 심볼릭 링크 — 재측정용으로 남김, 필요 없으면 Leader 가 그 디렉토리만 삭제; 커밋 이후 재현하려면 `git archive d26e70b src` 로 다시 푼다) · 결과·로그·요청 덤프는 scratchpad `pe036/`.
- PE 재확인(미러, 라이브 호출 없음): `prompts`·`task026`·`talkLength`·`sceneCap`(A1 예산 회귀 포함)·`jsonPathStream` 테스트 **101/101 pass**, `tsc --noEmit`·eslint 신규 live 스크립트 통과.
- 쿠키·티켓 사용 0, dev 서버 기동 0, 3011·3012·8197 리슨 없음(확인함), 운영 경로·pm2·3010·8100 무접촉(8100 은 원래 떠 있던 운영 gateway). 개발 DB 읽기 전용 count 1회 외 쓰기 없음.

```json
{"taskId":"task-036","status":"DONE","deliverables":["tests/live/task036-reading-ab.ts","tests/live/talk-length-measure.ts"],"blockers":[],"risk_level":"MEDIUM","violation_rate":{"talk_work":0.048,"talk_head":0.016,"chat_work":0.028,"chat_head":0.0,"old_key_emission_work":0.0},"prompt_chars":{"talk_system":1654,"talk_system_before":1726,"talk_rendered":4017,"chat_system":691,"chat_rendered":2280}}
```

## Reviewer 기록 (REV-108, 2026-10-05, standard 트랙 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1(W1 감시) · Low 4 · Info 3. `native_change: false`(plugins·android·capacitor·Manifest·prisma 무변경 — `git diff --name-only` 0건). **persona(`tutor.md`·`persona/` 로더)·레슨/평가 프롬프트·화면 컴포넌트(`useChatTurn.ts` 한 줄 삭제 외)·DB 스키마 무변경 확인.** 데모 게이트 `DEMO_GATE_PASSED`(`not_required`, judge none — 화면 변경 없음, `evidence.jsonl` 에 task-036 줄 0건 = 에이전트의 approve/waive 흔적 없음). 반려 0회(Sonnet developer, 같은 결함 클래스 반복 없음). 의도(구 `replyReading` 을 지시 줄·골격·스키마 required·타입·테스트에서 한꺼번에 제거, 키 순서 `speech→conversation(replyJa→replyKo)→…` 유지, persona 바이트 불변) **충족**. Medium 이하는 전부 **비차단 후속** — QA 진행 가능, Developer 재수정 필수 없음.

### 점검 중점 결과
| # | 결론 |
|---|---|
| 1 계약 정확성 | **충족.** `grep -rn replyReading src docs .claude tests .codex` = 코드·스키마·지시문 **0건**(src 의 1건 = `prompts.test.ts:61` 부정 단언 상수, 그 밖은 문서 역사 기록·`tests/live` A/B 스크립트·`talk-length-measure.ts` 주석 상수·생성본 `.codex` — 아래 L-4). 미러에서 `buildTalkRequest`·`buildChatRequest` 실제 산출을 **직접 덤프**(스크래치 `rev108/dump.ts`, LLM 호출 0): TALK `system` 에 키 순서 문구 `speech → conversation(replyJa→replyKo) → correction → learning → endOfTopic → proposals → userKo` · `[순서 예]` 골격이 같은 순서 · 스키마 properties 선언 순서 `speech·conversation·correction·learning·endOfTopic·proposals·userKo` · `required` 6키(`userKo` 만 REV-086 M3 대로 제외) · `conversation.required=properties=[replyJa,replyKo]`. CHAT 도 `conversation` 동일(키 순서 문구는 원래 없음). 스키마·system·`withJsonOnly` 렌더 프롬프트(TALK 3,980자·CHAT 2,243자)에 옛 키 0. persona sha256 TALK `d4f596bd3e8e6060`(2,550자)·CHAT `a3422e8f17257eba`(2,094자) = PE 가 적은 HEAD 값과 동일(파일·로더 diff 0) → `--system-prompt` 바이트 불변·예열 재사용 유지. 버전 `talk@v8`·`chat@v3`(변이 M6a/M6b killed — 아래). `stripAdditionalProperties` 요청 필드 없음(`undefined`). |
| 2 조기 추출·스트림 | **충족.** `jsonPathStream.ts` 는 문자 단위 상태기계로 `['speech','style']`·`['conversation','replyJa']` 경로만 흘리고(`turnAudio.ts:143-144`) 다른 키의 존재·부재·위치에 의존하지 않는다 — `replyReading` 참조 0. 새 테스트(`jsonPathStream.test.ts:31-40`)는 `replyJa`·`replyKo` 사이에 계약 밖 키가 끼어도 조각·`speech.style` 불변을 조각 1/4/1000 에서 고정 — 타당(단 특성화 테스트, I-1). 조기 문장→최종 `replyJa` 앞부분 일치는 PE 원자료(행 320) 재집계로 **work TALK 124/124·head 124/124 일치, 재시도 8행(양 팔) 전부 일치** — 슬립 재시도에서도 `AUDIO_TEXT_MISMATCH` 경로로 안 간다. |
| 3 서버 저장·응답 호환 | **충족.** `saveTurnTx` diff 는 `reading: shaped.reply.replyReading \|\| null` → `reading: null` **한 필드뿐**(`orchestrator/index.ts:285-286`): `lockUserRow`·`where{id,status:PENDING,createdAt}`·`count===0 → CONFLICT`·USER 번역 조건부 갱신·`Correction.original`(서버 `text` — `shape.ts`)·`StatsSnapshot`(TALK/CHAT 저장은 안 건드림)·소유자 검사 경로 전부 불변. `ChatMessage.reading` 컬럼·#29 `reading` 필드 유지는 타당(옛 메시지 값 호환·서버 롤백 시 v7 이 다시 써도 무해·마이그레이션 0). **SSE `done.conversation` 에서 빠진 필드를 읽는 코드는 없다** — `src` 전역 `\.reading`/`replyReading` 소비처: 서버 `chats/index.ts:206`(DB→DTO 그대로)·`evalGen.ts:87`(WordEntry 필드, 무관)뿐, 클라이언트는 `useChatTurn.ts:353-361` 이 `replyJa`·`replyKo` 만 읽고 `TalkRoom.tsx:388` 은 `audioCount·selfCheck·correction` 만. **배포 중 옛 JS(`replyReading ?? null`)가 새 `done` 을 받아도** `undefined ?? null` 이라 깨지지 않고, 새 JS 가 옛 서버 `done` 을 받아도 그 키를 안 읽어 무해(양방향). 말풍선·`MessageBubble` 등 어느 컴포넌트도 `message.reading` 을 안 읽는다(grep 0). 운영 스모크 스크립트(`task006/007-smoke.ts`)에 `conversation.reading` 단언 0. |
| 4 옛 키 방출 위험 | **수용 가능.** 코드 경로 추적: 옛 키 방출 → `conversation.additionalProperties:false` 위반 → `runJsonWithRetry` 1회 재시도(`schemaValidate.ts:397-415`, 위반 문구가 `RETRY_SCHEMA` 로 모델에 되돌아가 "스키마에 없는 필드는 제거") → 재실패 시 `JsonSchemaError` → 턴 `FAILED`(`ENGINE_ERROR`). 한 데드라인(TALK 12s, `completeJson` `remainingOrThrow` — 남은 1.5s 미만이면 `LlmTimeoutError`) 안에서 돌고, 재시도 턴 실측 6.0~6.7s(최대 head 9.2s)라 12s 안. 첫 호출이 ≥~10.5s 로 느린데 방출까지 겹칠 확률은 사실상 0. 0/160(PE 원문 스트림) → 단측 95% 상한 ≈1.9%(rule of three) 맞음. strip 미적용·`lesson.test.ts` 불변 결정 **타당**: strip 은 구문 슬립(W1, 파싱 실패)을 못 고치고 계약 드리프트를 가리며, LESSON 외 전역 정책(`lesson.test` 가 "TALK 은 안 지운다" 고정)과 어긋난다. 단 "요청이 strip 을 안 켠다" 자체는 테스트로 안 박혀 있다(L-1). |
| 5 PE 측정 신뢰도·W1 | **방법 타당, 해석 일부 과함(L-3), W1 은 Medium 감시(M-1).** 스크립트(`task036-reading-ab.ts`)는 HEAD 팔을 `git archive HEAD src` 복원본의 `prompts/{talk,chat}.ts` 동적 import 로 만든다(요청·스키마 되돌림 흉내가 아님) + `buildReq` 가 **head 에 옛 키 있음·work 에 없음을 매 호출 전 단언**(115-117행) — 기준선 구성 확인. 순차·1.5s 간격·항목마다 교차·3개 패스로 순서 뒤집기·합성 입력만·`timeoutMs 25s`(12s 는 사후 집계)·429 중단·DB 쓰기 0(`completeJson`/라우터 경로에 `create/update` 없음, 확인)·비밀·운영 경로·pm2·포트 접촉 0·고정 경로는 개발용 기본값(`~/.node-local/thekaiwa-head036`, `BASE_SRC` 로 덮음). 집계 코드(분위수 nearest-rank·순열검정 시드 고정) 오류 없음 — **원자료 JSON(행 320)에서 독립 재집계해 표의 숫자(재시도 2/6, 슬립 5/0, p50 −337, 짝 96/124)가 전부 재현됨.** 한계는 아래 M-1·L-3. |
| 6 테스트 품질 | **약화 없음, 일부 미고정(L-1·L-2).** 14여 개 수정은 diff 전수 확인 결과 `replyReading` 리터럴 제거·버전 문자열·키 순서 단언 정정뿐 — 단언 의도 약화 0(`task026.test.ts:58` 는 `replyJa:''·replyKo:''` 로 minLength 위반 검증이 여전히 성립). 신규 부정 단언(`prompts.test.ts:61-90`)은 변이에 걸린다(아래 13회 실행 중 10 killed). |
| 7 경계·보안·로그·문서 | **이상 없음(L-4 잔재 제외).** 추가 `import` 는 테스트의 `engine/json/schemaValidate`·`engine/llm`(기존 테스트 패턴, ESLint 통과) 뿐 — 6층 방향 위반 0. 엔진명(`reazon\|whisper\|style-bert\|claude\|model_id\|speaker_id`) 추가 줄 0. 추가 `console.*` 0(로그에 사용자 문장 없음). A/B 스크립트 출력은 합성 문장·`id`·ms 뿐. 문서 4종 사실 일치: api-contract #29 예시 `reading:null`·#29/#32 주석·"strip 안 켠다" 문구(코드와 일치)·`design-spec §67`·`tutor-persona-validation V4`·`prompt-engineer.md` 책임 3. `prompts:sync` 미구현 사실(012c-2 몫)은 `package.json`·`scripts/` 에서 확인 — talk@v8·chat@v3 반영 = 코드 상수가 릴리스에 실려 가는 것이 전부, `ConfigurationVersion`·DB 쓰기·sync 없음(PE 기록과 일치). |

### 지적 표
| # | 심각도 | 위치 | 분류 | 재현·근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | MEDIUM | `prompts/talk.ts:281-291`(`talkInstruction`·골격 289행)·`engine/json/extractJson.ts:12-47`(파싱) ↔ PE 기록 W1 | 신규 실패 모드 관찰(원인 미입증) | 원자료 재집계: work-TALK 에서 JSON 구문 슬립(`…"proposals":[]},"userKo":"…"}` — 루트를 한 번 일찍 닫음) **5/124**(95% CP [1.3%, 9.2%]) vs head **0/124**(상한 2.9%), Fisher 양측 **p=0.060**(task-026 v7 측정 0/52 를 더하면 v7 0/176). 총 재시도율 6/124 vs 2/124 는 **p=0.281(비유의)**. **5건 전부 `"correction":null` 턴**(정답 문장 c01·c02·c04 + u08): 정답 문장 4개 × 5회 = 20행 중 work **4/20** vs head 0/20(p=0.106), 교정 있는 문장 0/80 vs 0/80, 5/44 vs 0/44 p=0.055 — `correction` 객체가 없을 때 중첩이 단순해져 닫는 괄호를 한 번 더 쓰는 쪽으로 기운다는 가설과 맞지만 **읽기 줄 제거와의 인과는 입증 못 함**(슬립 분류는 재시도 원문을 본 뒤의 사후 분류라 다중 비교 보정 전 p, 같은 문장을 5~6회 반복했으므로 독립 입력은 32개 — 항목 단위 4/32 vs 0/32 p=0.113). CHAT 은 0/36·0/36(CHAT 은 `[순서 예]` 골격이 없다). **비용은 작다**: 5/5 재시도로 회복(재시도 8행 전부 성공), 총 6.0~6.4s·`done`(번역·교정 카드 확정)만 ≈+1.5s 늦고 **첫 음성·문장 합성은 영향 없음**(조기 문장 prefix 일치 8/8, 슬립은 응답 끝에서 발견되고 `replyJa` 는 이미 스트리밍됨). 평균 지연은 여전히 −318ms. | **W1 권고 아래 (A)** — 이 task 는 수용·배포, `extractJson` 변경은 이 task 에 섞지 않는다. 배포 후 감시 지표를 QA/deployer 인계(하단). |
| L-1 | LOW | `prompts.test.ts:92-109`·`talk.ts:294-327`(`buildTalkRequest`)·`chat.ts:28-47`(`buildChatRequest`) | 테스트 미고정(변이 생존) | "TALK·CHAT 요청은 strip 옵션을 켜지 않는다"(api-contract:789·PE §3·developer 기록)는 결정인데, 새 테스트는 `extractAndValidate(raw, schema)` 기본 동작만 검증한다. 미러에서 `buildTalkRequest` 반환에 `stripAdditionalProperties: true`(M9)·`buildChatRequest` 에 같은 줄(M10)을 넣어도 conversation 테스트 **419/419 통과(생존)**. `lesson.test.ts:924-926` 는 LESSON 이 켠다는 쪽만 고정. | 한 줄씩: `assert.ok(!buildTalkRequest({…}).stripAdditionalProperties)`·CHAT 동일(`lesson.test.ts:924` 옆). 결정이 코드에서 우연히 뒤집히는 것을 막는다. |
| L-2 | LOW | `orchestrator/index.ts:286`(`reading: null`)·`task026s2.test.ts:73-81` | 테스트 미고정(변이 생존) | 완료 기준 3 "새 메시지 `ChatMessage.reading` null" 의 서버 쪽 보증이 단위 테스트에 없다. `reading: ''`(M8)로 바꿔도 419/419 통과(생존). `task026s2.test.ts` 의 `fakeTx` 가 이미 `calls[1].args.data` 를 기록(assistant `updateMany`)하므로 단언 1줄이면 된다. | `assert.equal(assistant.data.reading, null)` 를 `task026s2.test.ts:79` 부근(`assistant.data.translation` 단언 옆)에 추가. 코드 변경 아님. |
| L-3 | LOW | PE 기록 §2·§6 해석 문장 | 해석 과함(수치는 맞음) | "p95 +114ms 는 재시도 탓, 재시도 제외 p95 −391ms" 와 요약의 "지연 비악화" 에서 **p95 는 결론을 낼 수 없다** — 비짝 부트스트랩(5,000회) p95 차이 95% 구간 **[−545, +421]ms**(n=124 의 p95 는 상위 6개 행이 정한다). "재시도 제외"는 사후 조건부 통계(재시도는 그 팔의 실제 경험). 견고한 주장은 **p50**: −337ms(구간 [−627, −54]), 짝 비교 96/124 에서 work 가 빠름·짝 중앙차 −363ms(재시도 없는 117쌍 중앙차 −368ms). 순열검정 p 들도 같은 문장 반복(독립 입력 32)이라 낙관적. 결론(출력 −9.4%/−18.9%·p50 개선)은 유지, 표현만 "p50 개선, p95 판정 불가(검정력 부족)" 로. | 이력서·최종 요약 문구 정정(코드 영향 0). |
| L-4 | LOW | `docs/screens.md:488·8052·8087` · `.codex/agents/prompt-engineer.toml:25`(git 추적 생성본) · `.claude/agents/tutor.md:65` | 문서·생성본·persona 잔재(범위 밖 타당) | `screens.md:488` `done` 행이 아직 `reading=replyReading` 을 지시하고 `8052·8087` 은 "제거는 별도 task(PE talk@v8·chat@v3)" 미래형 — 구현자가 가이드를 그대로 따르면 지운 필드를 되살린다. `.codex` 생성본은 `{conversation:{replyJa,replyReading,replyKo}…}` 로 stale. persona §6 TALK 행(65행)에 "…상황별·**읽기**·한국어 번역" 이 남아 **가장 높은 권한 계층의 유일한 잔재**(지시·스키마와 불일치) — 다만 PE 원문 160호출 옛 키 방출 0 이고, 바꾸면 `--system-prompt` 바이트가 달라져 예열 풀 무효화·재측정이 필요하므로 **지금 안 고치는 PE 판단에 동의**. | designer: `screens.md` 3곳 정정(Leader 경유). `.codex` 는 `cc-sync-codex/sync-agent-bridge.ps1` 로 재생성. persona "읽기" 삭제는 다음 persona 변경 때(Leader 승인). 어느 것도 이번 배포 차단 아님. |
| I-1 | INFO | `jsonPathStream.test.ts:31-40` | 특성화 테스트 | 새 테스트는 변경 전 코드에서도 통과하는 성질(경로 리더가 다른 키에 무관)을 문서화 — task-036 회귀를 잡는 용도가 아니다. 단독으로도 유효. | 조치 불요. |
| I-2 | INFO | A/B 스크립트 CHAT 팔 | 측정 조건 | 프로덕션 CHAT 은 `onTextDelta` 를 안 주지만(TALK 만 조기 경로, `orchestrator/index.ts` `startLlmRun`) A/B 는 두 팔 모두 스트리밍으로 돌렸다 — 양 팔 동일 조건이라 편향 없음, 절대 ms 만 운영 CHAT 과 다를 수 있음. | 조치 불요. |
| I-3 | INFO | `domain-model.md` ChatMessage `reading`(1143행)·`MessageDto` | 컬럼 유지 | 컬럼 유지·응답 필드 유지는 api-contract 에 "옛 값 호환·새 메시지 null" 로 이미 적힘. `domain-model.md` 에는 레거시 표기가 없다(필수 아님). | 조치 불요(후속 정리 시 한 줄 주석 후보). |

### W1(JSON 구문 슬립)에 대한 권고
**(A) 수용 + 배포 후 감시 — 이번 task 에서는 `extractJson`·프롬프트를 더 건드리지 않는다.**
- 왜 수용: ① 인과 미입증(p=0.06 은 사후 분류·반복 표본이라 낙관적, 총 재시도율 차이는 비유의) ② 사용자 체감 비용이 작다(첫 음성 불변·`done` 만 ≈+1.5s·5/5 회복·12s 안) ③ 평균은 이득(−318ms, p50 −337ms) ④ 아직 운영에 안 나갔고 배포 후 실측이 더 큰 표본이다.
- **(C) 프롬프트 보강은 비권장**: 4% 대 1% 를 가리려면 팔당 ≈250 이상의 호출이 필요해 측정 불가능하고, 골격·키 순서 문구는 이미 정확한 순서를 보여 준다(슬립은 지시 부족이 아니라 괄호 계수 실수). 보강문은 오히려 키 순서 문구를 늘려 A5·A11 식 불일치 위험을 다시 만든다.
- **(B) `extractJson` 좁은 복구는 별도 후속 task 후보**(감시 임계 초과 시): 독립 프로토타입(스크래치, 운영 코드 무변경)으로 5/5 슬립 원문을 문자열 인식 스캔(루트가 닫힌 직후 `,"키":` 가 이어지면 그 닫는 `}` 를 한 번 제거해 재파싱)으로 **전부 복구**됨을 확인 — 새 파싱 분기는 기존 ①②③ 이 모두 실패한 입력에만 작동하므로 지금 통과하는 출력은 안 바뀌고, 복구본은 ajv·`extraCheck`·`correction.original` 바이트 검사를 그대로 거친다. 다만 `engine/json/extractJson.ts` 는 L5 공용(전 프롬프트)이라 **이 R2 task 의 범위를 넓히지 않고** 자체 테스트·Reviewer 순환을 가진 task 로.
- **감시·전환 기준(QA/deployer 인계)**: 배포 직전 v7 의 최근 TALK 100턴과 배포 후 첫 TALK 100턴에서 `RequestTrace` `LLM` 단계 `attempts=2` 비율(및 pm2 로그 `[json] 1차 응답 계약 위반 → 재시도: JSON 파싱 실패` 줄 수)을 비교. **배포 후 100턴 중 재시도 >8%(A/B 신뢰상한 ≈ 9~10%) 이거나 `JsonSchemaError`·`ENGINE_ERROR`(`AI 응답 형식…`) 가 1건이라도 이 경로로 나면 (B) 후속 task 를 연다.** 롤백(`--rollback`)은 DB·스키마 변경이 없어 즉시 가능(v7 이 `reading` 을 다시 쓸 뿐).

### 변이 결과(미러 `~/.node-local/thekaiwa` 에서 1건씩 → NFS 원본 `cp` 로 원복 → `cmp` 일치 확인, 매번 conversation 테스트 419건 + `jsonPathStream` 실행, 운영·pm2·운영 포트 무접촉)
| 변이 | 대상 | 결과 |
|---|---|---|
| M1 스키마 `required`·`properties` 에 옛 키 복원 | `schemas.ts` | **killed**(6 FAIL — 신규 2 + 스키마 통과 4) |
| M2 `[순서 예]` 골격에 옛 키 복원 | `talk.ts` | **killed**(신규 계약 테스트) |
| M3 TALK `replyJa` 지시 줄 꼬리에 옛 키 문구 복원 | `talk.ts` | **killed**(신규 계약 테스트) |
| M4 키 순서 문구 `replyJa→replyReading→replyKo` 복원 | `talk.ts` | **killed**(2 FAIL — 기존 키 순서 테스트 + 신규) |
| M5 CHAT 지시 줄에 옛 키 문구 복원 | `chat.ts` | **killed**(신규 계약 테스트) |
| M6a `TALK_PROMPT_VERSION` → `talk@v7` | `talk.ts` | **killed**(4 FAIL) |
| M6b `CHAT_PROMPT_VERSION` → `chat@v2` | `chat.ts` | **killed**(2 FAIL) |
| M7 스키마 `properties` 순서 `replyKo` 먼저 | `schemas.ts` | **killed**(신규 `Object.keys` 순서 단언) |
| M8 `saveTurnTx` `reading: null` → `''` | `orchestrator/index.ts` | **survived**(L-2) |
| M9 `buildTalkRequest` 에 `stripAdditionalProperties: true` | `talk.ts` | **survived**(L-1) |
| M10 `buildChatRequest` 에 `stripAdditionalProperties: true` | `chat.ts` | **survived**(L-1) |
| M11 골격에서 `userKo` 를 앞으로 이동 | `talk.ts` | **killed**(기존 userKo 이름·순서 테스트) |
| M12 키 순서 문구 `endOfTopic↔proposals` 교환 | `talk.ts` | **killed**(기존 userKo 이름·순서 테스트) |

13회 실행(변이 12종, M6 을 a/b 로 나눔) 중 **10 killed · 생존 3**(M8·M9·M10 = L-1·L-2, 둘 다 한 줄 단언으로 닫힘 — 코드 결함 아님). 원복 후 4개 파일 `cmp` 동일, `rsync -an` 차이는 mtime 뿐 → `sync-local.sh` 재실행으로 정리. NFS `src/` 는 한 줄도 건드리지 않음(변이는 미러에서만).

### 재실행(개발 미러, `bash scripts/sync-local.sh` 후 핵심 7파일 `cmp` 동일)
- `npm run typecheck`(NFS 루트 → sync 후 미러 `tsc --noEmit`) → **exit 0**, 출력 0줄. `npx eslint src/modules/conversation src/modules/engine src/components/chat src/types` → **exit 0**, 0줄 · `eslint tests/live/task036-reading-ab.ts tests/live/talk-length-measure.ts` → exit 0.
- `conversation/__tests__` 전체 + `engine/__tests__/jsonPathStream` → **419/419 pass · fail 0 · skip 0**(개발자 보고와 동일).
- 전체 `npm test` → **tests 1472 · pass 1471 · fail 0 · skipped 1**, exit 0(보고와 동일).
- 요청 본문 덤프(LLM 호출 0): 위 중점 1 의 수치. **라이브 LLM(Claude CLI) 호출 0** — PE 원자료(`scratchpad/pe036/*.json`, 행 320)만 재집계했다(Fisher·부트스트랩 5,000회·슬립 원문 확인, 읽기 전용).
- 운영(`/home/brownjeon/apps/thekaiwa`)·pm2·운영 포트·운영 DB 무접촉. 스크래치 `rev108/`·`rev108-*.log` 는 scratchpad 에만 있다.

### QA 로 넘기는 high_risk_areas
1. **새 TALK/CHAT 턴의 `done` 모양·저장값** — `done.conversation` 이 `{replyJa, replyKo}` 둘뿐인가, 같은 턴 `ChatMessage.reading` 이 `NULL` 인가(DB 읽기), #29 응답에서 새 메시지 `reading:null`·**배포 전 옛 메시지는 값 유지**(원문 그대로)인가.
2. **운영 스모크**(`SMOKE_ENV=PRODUCTION`, 포트 3010): 006 42/42·007 45/45 유지, `AUDIO_TEXT_MISMATCH` 경고 0.
3. **완료 기준 2 의 미실행 항목** — 첫 음성 바이트 p50(`tests/live/task007-latency.ts`, 개발 서버 3011 필요)은 PE 가 안 돌렸다(조기 추출 단계만 A/B 로 대리 측정: 첫 문장 확정 p50 1,841→1,801ms). QA 가 비악화를 직접 확인.
4. **W1 감시**(위 권고): 배포 전·후 TALK 100턴 `attempts=2` 비율·pm2 `[json] 1차 응답 계약 위반` 줄 수·`JsonSchemaError`/`ENGINE_ERROR` 건수 — 임계 8%/1건 초과 시 Leader 에 (B) 후속 task 제안.
5. **말풍선 읽기 줄**(후리가나·한글)은 새 메시지에서도 정상 — 이제 전적으로 `#24r` 분석 경로(`message.reading` 아님). 한자 포함 새 강사 말풍선 1건·360/390/412px 확인(화면 코드 무변경이므로 회귀 확인용).
6. **옛 탭 호환**(선택): 배포 전에 연 탭이 새 서버 `done` 을 받아도 말풍선이 깨지지 않는지(코드상 `undefined ?? null` 이라 안전 — 확인용).
7. **네이티브·DB·persona 무변경** — APK·마이그레이션·예열 풀 재기동 불필요(persona 바이트 불변, `--system-prompt` 해시 동일).

```json
{"reviewId":"REV-108","status":"PASS_WITH_NOTES","issues":[
 {"issue":"W1 JSON 구문 슬립 5/124 vs 0/124(p=0.060), 전부 correction:null 턴, 인과 미입증","severity":"MEDIUM","component":"src/modules/conversation/prompts/talk.ts:281-291; src/modules/engine/json/extractJson.ts:12-47","risk":"TALK 재시도율 상승(done +≈1.5s, 12s 안)","evidence":"원자료 재집계: 슬립 5/124 vs 0/124 Fisher p=0.060, 재시도 6/124 vs 2/124 p=0.281, 5건 모두 correction:null, 8/8 재시도 회복·prefix 일치","recommendation":"수용 + 배포 후 TALK 100턴 attempts=2>8% 또는 JsonSchemaError 1건이면 extractJson 좁은 복구를 별도 task 로"},
 {"issue":"TALK·CHAT 요청이 stripAdditionalProperties 를 안 켠다는 결정이 테스트로 고정 안 됨(M9·M10 생존)","severity":"LOW","component":"src/modules/conversation/__tests__/prompts.test.ts:92-109","risk":"우연한 뒤집힘이 재시도·계약 드리프트 은폐로 이어짐","evidence":"변이 M9·M10 conversation 419/419 통과","recommendation":"buildTalkRequest·buildChatRequest 반환의 stripAdditionalProperties 부정 단언 2줄"},
 {"issue":"새 메시지 reading null 이 서버 단위 테스트로 고정 안 됨(M8 생존)","severity":"LOW","component":"src/modules/conversation/orchestrator/index.ts:286; src/modules/conversation/__tests__/task026s2.test.ts:73-81","risk":"완료 기준 3 서버 보증이 코드뿐","evidence":"변이 M8 reading:'' 419/419 통과","recommendation":"assistant.data.reading === null 단언 1줄"},
 {"issue":"PE 해석: p95 판정 불가인데 '비악화·재시도 제외 감소'로 서술","severity":"LOW","component":"task-036 Prompt-Engineer 기록 §2·§6","risk":"과대 해석이 최종 요약으로 전파","evidence":"p95 차이 부트스트랩 95% 구간 [-545,+421]ms; p50 -337 구간 [-627,-54]","recommendation":"p50 개선·p95 판정 불가로 문구 정정"},
 {"issue":"문서·생성본·persona 에 구 읽기 줄 잔재","severity":"LOW","component":"docs/screens.md:488,8052,8087; .codex/agents/prompt-engineer.toml:25; .claude/agents/tutor.md:65","risk":"가이드 추종 시 지운 필드 부활, persona 와 계약 불일치(방출 0/160)","evidence":"grep replyReading / persona 65행 '읽기'","recommendation":"designer 정정·.codex 재생성·persona 는 다음 변경 때(Leader 승인)"}],
 "summary":{"critical":0,"high":0,"medium":1,"low":4},
 "high_risk_areas":["새 턴 done 모양·ChatMessage.reading NULL 및 옛 메시지 값 유지","운영 스모크 006 42/42·007 45/45·AUDIO_TEXT_MISMATCH 0","첫 음성 p50(task007-latency) 직접 측정","W1 감시(TALK 100턴 attempts=2 비율·JsonSchemaError)","새 말풍선 읽기 줄(#24r) 3폭","옛 탭 호환(선택)"],
 "native_change":false}
```

## Codex 검토 (C2 adversarial-review)

### [2026-10-05 19:03] C2 adversarial-review focus=error_handling — done
- judge 판정: intake 우 R2·complexty 1.77·track standard · C1 codex_required:false · C2 codex_required:true (Reviewer M-1·W1 후) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=d26e70b(task_file) snapshot=19b2516
- 지적 **1건(medium)**: [MEDIUM] `src/modules/conversation/prompts/talk.ts:289` — JSON 구문 슬립(replyReading 제거 후 5/124)과 조기 TTS 오디오 전송의 조합 → 화면 최종 답변과 다른 첫 문장을 음성으로 들을 수 있음(권고: 배포 전 구문 슬립 원문 고정·통합 테스트·AUDIO_TEXT_MISMATCH 감시 추가)
- 검토하지 못한 범위: 외부 LLM 재호출 A/B 재현 · 운영 환경 실제 TTS 완료 타이밍 · blue/green 실제 네트워크 조합
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261005T100225Z-task-036-C2/raw.txt

**Codex 분석 상세 (Summary)**:

| 항목 | 판단 |
|---|---|
| replyReading 제거 타입/SSE 호환성 | 회귀 없음 ✓ |
| saveTurnTx 트랜잭션·원칙 | 위반 없음 ✓ |
| JSON 경로 추출(jsonPathStream) | 경로 리더 동작 불변 ✓ |
| **JSON 구문 실패 + 조기 음성** | **Medium 위험** ⚠ |

**핵심 위험 (Codex M1)**:

1. **구문 슬립 관찰** (Reviewer W1과 일치):
   - 변경본 TALK 5/124 구문 실패 (`…"proposals":[]},"userKo":"…"}` 패턴)
   - 기준본 0/124
   - 모두 `correction: null`(정답 문장) 턴

2. **조기 오디오 전송 문제** (Codex 추가 지적):
   - `turnAudio.ts:178-188` — 첫 LLM 응답의 `replyJa`를 즉시 합성 큐에 넣음
   - `turnAudio.ts:304-310` — **최종 JSON 검증 전에** 오디오 이벤트 전송 가능
   - 구문 실패 → 재시도 → `replyJa` 달라짐 → 이미 전송된 음성은 회수 불가

3. **영향**:
   - 사용자가 화면 최종 답변과 다른 **첫 번째 문장을 음성으로** 들음
   - A1 예산 위반 가능(재시도 5~7s + 1차 오디오까지)
   - 옛 키 방출 감시만으로는 이 경로 탐지 불가

**Codex 권고** (배포 차단 X, 감시 강화):

배포 전:
- 구문 슬립 원문(5건) → 재현 입력으로 고정, 통합 테스트 추가
- 1차/재시도 `replyJa` 불일치 + 1차 오디오 전송 타이밍 단언

운영 감시 (현재 W1 규칙 확대):
- `attempts=2` 비율 (기존)
- + `parseError` 로그 줄 수
- + **`AUDIO_TEXT_MISMATCH` 건수** (신규)
- + **재시도 전 audio 이벤트 발생** (신규)

대응 경로:
- **(현행 A) 배포 수용** — 첫 음성 불일치 가설로만, 재현 조건 미확인.
- **(후속) 강화**: 파싱 실패 확인 전 첫 청크 전송 보류 또는 재시도 시 1차 `replyJa` 접두부 보존.

---

**QA 인계 추가 항목** (Reviewer high_risk_areas 통합):

기존 4번 항목("W1 감시")을 다음과 같이 확대:
> 4b. **W1+Codex 감시** (통합): 배포 전 TALK 100턴 기준본 vs 배포 후 100턴 에서 다음 지표 비교:
>   - `attempts=2` 비율 (임계 >8%)
>   - `pm2 log | grep '[json] 1차 응답 계약 위반 → 재시도'` 줄 수
>   - `RequestTrace.error` 에서 `JsonSchemaError`/`ENGINE_ERROR` 건수 (임계 1건)
>   - **`TurnAudio.events[].type === 'AUDIO' AND 같은 턴에서 LLM.attempts > 1` (Codex 신규)**
>   - **`TurnAudio 내 replyJa(1차) ≠ replyJa(최종)` 재시도 회수** (Codex 신규)
>   
>   임계 이상이면 Leader 에 (B) 후속 task 제안 — `extractJson` 좁은 복구 + `turnAudio` 오디오/답변 일관성.


## Reviewer 기록 (REV-109 — Codex C2 지적 판정, 2026-10-05, Read 전용)

**판정: 부분 채택 — 사실은 채택, "이번 변경이 만든 위험·배포 차단" 은 기각.** Codex 원 심각도 Medium → **Low(비차단 후속)** 로 하향. 코드·프롬프트·persona·화면 수정 0(NFS `src` 무접촉, 실험은 개발 미러 `~/.node-local/thekaiwa/scratch/rev109/` 에서만 — fake 화자·fake LLM, **라이브 LLM 0·DB 0·운영 `/home/brownjeon/apps/thekaiwa`·pm2·운영 포트 무접촉**). 전체 REV-108 판정(PASS_WITH_NOTES)은 변하지 않는다. 신규 소환 reviewer(이전 reviewer 컨텍스트 과다).

### 1. 사실 확인 — 지적은 코드와 맞다(줄 번호 정확), 그러나 새 창이 아니다
- **맞는 부분**: `turnAudio.ts:142-145`(리더가 `conversation.replyJa`·`speech.style` 만 감시) → `:148-157`(`onDelta` — call 1 조각만) → `:178-188`(`earlySentence` → `enqueue(s,true)`) 로 call 1 의 `replyJa` 문장이 **JSON 검증 전에** 합성되고, `:304-310` 의 `audio` 이벤트 송신 가드는 `mismatch`/`textOnly` 뿐이라 **"검증 완료" 가 가드가 아니다**. 불일치는 `finalize`(`:195-217`)가 **나중에** 알아내 남은 큐만 비운다(`:213` `queue.length=0`) — 이미 나간 이벤트는 회수 불가. 이 서술은 전부 사실.
- **창의 크기(재현)**: 슬립은 JSON 꼬리(`…"proposals":[]},"userKo":…}`)에서 생기므로 `replyJa` 는 그보다 한참 앞에서 이미 닫혀 있다. 그래서 창에 들어가는 것은 **첫 문장이 아니라 call 1 `replyJa` 의 필터 통과 문장 전부**다(재현: 슬립 원문 5건 중 4건에서 `audioBeforeFinalize=2`/2 — 5번째 `u08#4` 는 숫자 비율로 `FILTER_SCRIPT` 가 조기 경로를 꺼 오디오 0). 시간축 추정(기록값 기반): `firstSentenceMs` p50 1.8s(PE) + 청크0 `ttfaServerMs` p50 0.52s·p95 1.35s(task-007 30턴) → **첫 audio 이벤트 ≈2.3~3.2s**, call 1 종료(슬립 발견) ≈4.5s, 재시도 +≈1.5s → `finalize` ≈**6.0~6.7s**(PE 재시도 턴 ms). 창 ≈ 3~4s, 그 사이 청크 1~2개가 이벤트로 나가 재생 중이다. (재현 스크립트는 합성 40ms 로 **상대 순서만** 본다 — 위 절대 시간은 기록 기반 추정이고 직접 실측이 아니다.)
- **이번 변경이 만든 창인가 → 아니다(기존 task-007 설계).** `git diff` — `turnAudio.ts`·`jsonPathStream.ts`·`engine/json`·`engine/llm` **무변경**, `orchestrator/index.ts` 는 `reading: null` 한 줄뿐. 이 창은 `6d8b3b1`(task-007 A, 2026-09-28) 설계고, **task-007 C1-3 ③ "최종 검증 실패(재시도) 시 이미 나간 문장은 되돌릴 수 없음을 잔여 위험으로 수용(…클라는 최종 텍스트로 정정)"** + `api-contract.md:797` "잔여 위험(검증 전 문장 1~2개가 소리로 나갈 수 있음)은 C1-3 판정으로 수용" 에 이미 적혀 있고, 클라 정정 경로(`TalkRoom.tsx:377-383` `queue.abortTurn`·`withdrawChunks`·PendingBubble)와 서버 단위 테스트(`task007.test.ts:137·303·360`)가 있다. **새로 생긴 것은 재시도 확률 변화(W1)뿐**이다.

### 2. 이번 변경의 노출 증가 — 점추정 ≈0, 상한도 작음
| 항목 | 값 | 근거 |
|---|---|---|
| 슬립(파싱 실패 재시도) 확률 | work 5/124(4.0%, CP 95% [1.3%, 9.2%]) vs head 0/124 (p≈0.06) | PE 원자료(REV-108 재집계 일치) |
| 슬립 5건이 실제로 파싱 실패인가 | **5/5 `parseError=true`**(재현: `extractAndValidate`) → 재시도 확정 | `rev109/repro.ts` 0단계 |
| 재시도가 `replyJa` 를 바꿨나 | **0/5(간접 증거 3겹)**: ① 최종 data 직렬화 길이(PE 행 `outChars` 255·258·246·235·247)가 call-1 원문에서 **루트를 일찍 닫은 `}` 하나만 제거한 compact JSON 길이와 5/5 정확히 일치**(재현 `sameLength:true`) ② `engine/llm/index.ts:215` 가 재시도 때 `[이전 응답]\n<previousRaw>`(≤8,000자)+`RETRY_PARSE` 를 system 에 동봉 → 모델이 복사·정정 ③ 대조군: **내용이 바뀐 재시도**(스키마 위반 — head u03#4·e04#5, work u03#4)는 길이 차가 36·18·27자로 구별됨 | PE 행·재현 |
| 한계(정직) | 최종 `replyJa` **원문은 PE 행에 저장돼 있지 않다**(`retryRaw` 는 call-1 원문뿐, `earlyPrefixOk` 는 **첫 문장만** 비교) → "문자 단위 동일" 은 입증 못 함, 길이 정합+메커니즘의 추정. n=5 라 통계 상한은 45%(rule of three) | 스크립트 `task036-reading-ab.ts:174` |
| 증가분 | 점추정 4.0%×0 ≈ **0**, 현실 가정(≤10%) **≤0.4%/TALK 턴**, 통계 상한 4.0%×45% ≈ **1.8%**(비현실적 상한). 비교: 기존(비슷한 재시도, 스키마 위반) head 1.6% — 같은 자릿수 이하 | 계산 |
- **내용이 정말 바뀌면(재현 CHANGED)**: 4/5 에서 `AUDIO_TEXT_MISMATCH` 경고·이미 나간 `audio` 2개 유지·**추가 합성 0**(`speakerCallsAfter===speakerCallsBefore`)·재생 즉시 중단+최종 텍스트 정정. 사용자 체감 = "들은 문장과 화면 최종 답이 다른" **1회성**. 저장·교정·학습 기록은 최종 검증본만(`Correction.original` 바이트 검증은 사용자 발화 대상이라 음성과 무관) → **데이터 무결성 영향 0**.
- **Codex "A1 5초 예산 위반 가능" 은 부정확**: 첫 음성은 call 1 에서 나가므로 재시도가 첫 음성을 늦추지 않는다. 늦어지는 것은 `done`(+≈1.5s, 6.0~6.7s ≤ 12s fail-fast). 감시가 "옛 키 방출뿐" 이라는 지적은 맞다(REV-108 이 슬립·`attempts` 감시로 이미 보완).

### 3. 판정·권고 (a~d)
| # | 질문 | 답 |
|---|---|---|
| (a) | 배포 전 필수? | **아니오(비차단).** 기존 수용 위험 + 증가분 점추정≈0 + 사용자 영향 1회성·무결성 0. 배포 차단 사유 아님. |
| (b) | 저비용 보강? | **가능 — 권고(테스트만, 1 dev 사이클).** 이음매 `conversation/__tests__/task007.test.ts` `harness()`(84-98행: `feed(doc, call, size)`·`audios()`·`warnings()`). **기존 구멍**: `:137`·`:303` 은 `gate` 로 합성을 막아 "이미 나간 청크 = 0" 인 경우만 보고, `:360`(턴 전체)도 `!names.includes('audio')`·`audioCount 0`. 슬립 원문을 call 1 로 먹이는 테스트·"이미 나간 청크가 있을 때 불일치" 가 **둘 다 없다**. 추가 2건: **T-A** 슬립 원문 1건(c02#1, 합성 문장 — `rev109-slips.json` 의 `raw`)을 상수로 → `h.feed(SLIP,1)`·`sleep(10)` → `audios().length===2`(검증 전 조기 오디오 = 창을 문서화) → 재시도 첫 조각 `h.feed('{"speech"…',2)` → `metrics().earlyStop==='RETRY'` → `finalize(같은 replyJa)` → 경고 0·`calls.length===2`(추가 합성 0). **T-B** 같은 입력에서 `finalize(다른 replyJa)` → `warnings()` `['AUDIO_TEXT_MISMATCH']`·`audios().length===2`(이미 나간 것은 남는다 — 회수 불가를 단언으로 명시)·`metrics().mismatch===true`·`calls.length` 불변·settled 뒤 도착 청크 이벤트 0(청크1 을 `gate` 로 붙잡고 3문장 입력이면 큐 비우기까지). 변이 제안: ⓐ `:305` 가드 제거 ⓑ `:213` `queue.length=0` 제거 ⓒ 정렬 판정 항상 true — T-A/T-B 가 각각 killed 여야 한다. 선택 **T-C**(엔진): 슬립 원문 → `runJsonWithRetry` `attempts===2` + `extractAndValidate(raw1).parseError===true`(현재 슬립은 재시도라는 사실을 고정 — 후속 (B) 복구 도입 시 의도적으로 뒤집음). Codex 가 요구한 "1차/재시도 `replyJa` 불일치·1차 오디오 전송 타이밍 단언" 은 T-A/T-B 로 충족. 턴 전체(`startTurn`) 변형(`:360` 의 `gate`→즉시 speaker)은 DB mock 이 많아 비용 대비 이득이 낮아 선택. |
| (c) | 감시 지표만으로 충분? | **대리 지표(상한)로 충분, 단 "AUDIO_TEXT_MISMATCH 건수" 는 지금 서버에서 못 읽는다(O-1).** 아래 §4. |
| (d) | 후속 task? | ① **"첫 청크 전송을 구문 확인 뒤로 미루기" 는 기각** — 첫 음성이 call 1 완결(≈4.5s+)로 밀려 task-007 C1-3 핵심 결정(첫 음성 ≈3s)·5초 예산이 무너진다(2~3s 확정 손해 vs 점추정≈0 위험). ② "재시도에서 접두부 보존" 계약 강화는 **이미 사실상 보존**(`[이전 응답]` 동봉)이고 `RETRY_PARSE` 는 L5 공용(전 프롬프트)이라 문구 강화의 파급이 커 지금은 비권고. ③ **근본 해법 = REV-108 (B)**: `extractJson` 좁은 복구(PE 프로토타입 5/5 복구) — 슬립 클래스에서 재시도 자체가 사라지면 이 창도 소멸. **트리거**: 배포 후 감시 임계 초과 또는 "들린 말≠화면" 체감 보고. 독립 task(자체 테스트·Reviewer 순환). ④ O-1(서버 기록)은 소규모 후속 — §4. |

### 4. 감시 — 정확한 위치 (Codex·REV-108 4b 항목 교정)
- **먼저 교정**: 위 "Codex 검토" 절의 4b 항목 중 `TurnAudio.events[].type==='AUDIO'`·`TurnAudio 내 replyJa(1차)≠(최종)`·`RequestTrace.error` 는 **영속되지 않거나 없는 컬럼**이다(`events` 는 SSE 로만 나가고, `RequestTrace` 컬럼은 `status`·`errorCode`·`steps`). 아래로 대체한다.
- **O-1 (LOW, 기존 갭 — 이번 변경 무관)**: `TurnAudio.metrics().mismatch` 는 `turnAudio.ts` 밖 어디서도 읽지 않는다(grep) — `AUDIO_TEXT_MISMATCH` 는 SSE `status` 로 클라에만 간다. task-007 C1-3 ③ 이 약속한 "발생 시 **Trace `AUDIO_TEXT_MISMATCH` 기록**" 이 **미구현**. `earlyStop` 은 `index.ts:537` 에서 `finalize`(`:560`) **이전**에 읽어 불일치를 못 담는다.
- **읽을 수 있는 지표** (모두 **재시도 중 조기 경로가 켜져 있던 턴의 상한**이지 실제 불일치 수가 아니다):
  1. **재시도율** — `ChatMessage.toolLog` JSON `$.attempt`(강사 행 `status='DONE'`·TALK, `JSON_VALUE(toolLog,'$.attempt')`) 와 `RequestTrace`(`kind='TURN'`, `refType='chatMessage'`) `steps` 의 `name='LLM'` 단계 `attempts`.
  2. **조기 음성 뒤 재시도(= 불일치 가능 모집단)** — 같은 LLM 단계 `earlyStop='RETRY'`(조기 경로가 켜진 채 call 2 시작). `FILTER_*`·`PARSE` 는 조기 경로가 이미 꺼진 재시도라 노출 없음. 같은 Trace 의 `TTS[i]` 단계 `early:true` 가 실제 조기 청크.
  3. **슬립 계열** — pm2 로그 `/home/brownjeon/apps/thekaiwa/shared/logs/pm2-err.log`(`console.warn` → stderr) 의 `[json] 1차 응답 계약 위반 → 재시도: JSON 파싱 실패`(스키마 위반 재시도는 같은 접두에 위반 문구가 붙는다).
  4. **재시도 후 실패** — `RequestTrace.status='ERROR' AND errorCode='ENGINE_ERROR'`(`JsonSchemaError` 는 `infra/http.ts:31` 로 `ENGINE_ERROR` 에 묶인다 — 원인 구분은 같은 시각 pm2-err 의 `[json]` 줄).
- **임계(REV-108 W1 유지 + 보강)**: 배포 직전 v7 TALK 최근 100턴 대비 배포 후 첫 TALK 100턴에서 ⓐ `attempt=2` >8% ⓑ `earlyStop='RETRY'` >8%(또는 ⓐ 와 어긋남 — ⓑ 는 ⓐ 이하여야 한다) ⓒ `ENGINE_ERROR`(재시도 후 실패) ≥1건 중 하나라도 해당 → Leader 에 (B) 후속. **QA 는 배포 후 실기기·웹 회화 5턴 이상에서 "들린 말 ≠ 화면" 체감 1건이라도 있으면 보고**(`AUDIO_TEXT_MISMATCH` 가 뜨면 UI 가 PendingBubble "답을 정리하고 있어요" 로 바뀐다 — 화면으로 관측 가능).
- **O-1 해소(소규모 후속, 비차단)**: `index.ts:586-590`(`await audio.settled()` 직후)에서 `steps.push({ name:'TTS_ALIGN', ms:0, mismatch:m.mismatch, earlyChunks:m.earlyChunks, earlyStop:m.earlyStop })` + 불일치일 때만 `console.warn('[turn] AUDIO_TEXT_MISMATCH', a.traceId)`(사용자 문장·원문 없음). 테스트는 `console.warn` spy 또는 `turnDeps` 에 `recordTrace` 주입. **권고: 이번 R2 task 범위를 넓히지 말고 배포 후 첫 정리 task 로**(필요하면 같은 커밋 가능 — `index.ts` 는 이미 이 task 가 만진 파일).

### 5. 지적 표
| # | 심각도 | 위치 | 분류 | 근거 | 권고 |
|---|---|---|---|---|---|
| X-1 | LOW(Codex 원 MEDIUM 하향) | `turnAudio.ts:178-188,195-217,304-310` ↔ `talk.ts:289` | 기존 수용 위험(task-007 C1-3 ③)·이번 변경 노출 증가 미미 | 재현 §1·§2: 창 존재(call-1 조기 청크 2/2 가 `finalize` 전에 이벤트로 나감), 내용 변경 시 경고+회수 불가, 슬립 재시도는 길이 정합 5/5·`[이전 응답]` 동봉으로 내용 유지 추정 | 배포 차단 아님. T-A/T-B 권고(비차단), 근본은 (B) |
| T-1 | LOW | `task007.test.ts:137,303,360` | 테스트 구멍 | "이미 나간 청크가 있는 불일치"·"슬립 원문 call 1" 단언 없음 | §3(b) T-A/T-B(+T-C) |
| O-1 | LOW | `turnAudio.ts:212`·`index.ts:537,586-590` | 관측 갭(기존) | `m.mismatch` 미기록(grep), C1-3 ③ 약속 미이행 | §4 후속 |
| I-1 | INFO | Codex 영향 서술 | 부정확 | "5초 예산 위반" — 첫 음성은 call 1 → 재시도와 무관, `done` 만 +≈1.5s | 조치 불요 |

### 6. 재현 입력·스크립트(읽기 전용 산출, 코드 무수정)
- 슬립 원문 5건(PE `retryRaw` 에 call-1 원문 전체가 들어 있음 — 길이 248~271 < 600): scratchpad `rev109-slips.json`(id·raw) · 스크립트 `rev109-repro.ts`(= 미러 `~/.node-local/thekaiwa/scratch/rev109/repro.ts`) — 실 `TurnAudio`·실 `jsonPathStream`·실 `runJsonWithRetry`+`extractAndValidate`(`TALK_SCHEMA`), fake 화자(40ms)·fake LLM. 실행 `cd ~/.node-local/thekaiwa && SLIPS=<json> node --import tsx scratch/rev109/repro.ts`.
- 결과 요약: 0단계 5/5 `parseError`·길이 정합 5/5 · VERBATIM 4/5 조기 오디오 2개가 `finalize` 전 송신·경고 0·추가 합성 0·`earlyStop='RETRY'`(5번째 `FILTER_SCRIPT`) · CHANGED 4/5 `AUDIO_TEXT_MISMATCH`·이미 나간 2개 유지·추가 합성 0.
- 미러·NFS 핵심 8파일(`turnAudio`·`orchestrator/index`·`schemaValidate`·`extractJson`·`jsonPathStream`·`talk`·`schemas`·`llm/index`) `cmp` 동일 확인 후 실행. NFS `src` 변경 0.

### 7. QA 로 넘기는 것(REV-108 high_risk_areas 에 더함)
- 4b 를 위 §4 로 **교체**(대리 지표 4종·임계 ⓐⓑⓒ). 배포 전 baseline(v7 최근 TALK 100턴의 `attempt`·`earlyStop`·pm2-err `[json]` 줄 수)은 **QA/deployer 가 배포 직전에 먼저 채취**(이 감사는 운영 로그를 읽지 않았다 — 무접촉 지시).
- 실기기·웹 회화에서 "들린 말 ≠ 화면 최종 답" 체감·PendingBubble 전환 관찰(발생 시 `traceId` 확보).
- T-A/T-B 가 배포 전에 들어오면 변이 ⓐⓑⓒ killed 를 Reviewer 가 재확인(작은 재순환).

```json
{"reviewId":"REV-109","status":"PASS_WITH_NOTES","scope":"Codex C2 지적 1건 판정(부분 채택 — 사실 채택·심각도 하향·비차단)","issues":[
 {"issue":"검증 전 조기 오디오 송신 + 재시도로 replyJa 변경 시 이미 나간 음성 회수 불가(Codex M1)","severity":"LOW","component":"src/modules/conversation/orchestrator/turnAudio.ts:178-188,195-217,304-310","risk":"들은 문장≠화면 최종 답 1회성(데이터 무결성 영향 0)","evidence":"재현 rev109-repro: VERBATIM 4/5 조기 오디오 2개 finalize 전 송신·무경고, CHANGED 4/5 AUDIO_TEXT_MISMATCH·이미 나간 2개 유지·추가 합성 0; 슬립 5/5 parseError, 최종 data 길이=call-1 원문−`}` 1개 5/5 일치; task-007 C1-3③ 수용·api-contract:797","recommendation":"배포 비차단. 단위 테스트 T-A/T-B, 근본은 extractJson 좁은 복구(B) 후속"},
 {"issue":"이미 나간 청크가 있는 불일치·슬립 call-1 스트림 테스트 부재","severity":"LOW","component":"src/modules/conversation/__tests__/task007.test.ts:137,303,360","risk":"창이 문서화·고정되지 않음","evidence":"세 test 모두 gate 로 합성을 막아 audios()=0","recommendation":"T-A/T-B(+T-C) 추가, 변이 ⓐⓑⓒ killed"},
 {"issue":"AUDIO_TEXT_MISMATCH 서버 측 미기록(task-007 C1-3③ 약속 미이행)","severity":"LOW","component":"src/modules/conversation/orchestrator/turnAudio.ts:212; index.ts:537,586-590","risk":"운영에서 실제 불일치 건수를 못 센다(대리 지표 earlyStop='RETRY'·attempt 로 상한만)","evidence":"grep: m.mismatch 읽는 곳 turnAudio.ts 뿐, earlyStop 은 finalize 이전 스냅샷","recommendation":"TTS_ALIGN Trace 단계+console.warn(traceId) 소규모 후속"}],
 "summary":{"critical":0,"high":0,"medium":0,"low":3,"info":1},
 "high_risk_areas":["4b 감시 교체(attempt·earlyStop='RETRY'·pm2-err [json] 줄·ENGINE_ERROR)","배포 전 baseline 채취(QA/deployer)","실기기 들린 말≠화면 체감","T-A/T-B 도입 시 변이 재확인"],
 "native_change":false}
```

## QA 기록 (QA, 2026-10-05, standard 트랙 · 코드 수정 0)

**판정: PASS (Critical 0 · High 0 · Medium 0 · Low 0 — 결함 0건)** · 비차단 관찰 6건(O-1~O-6) · `src/**`·`prisma/**`·`speech/**`·`plugins/**` 수정 0(QA 추가 파일은 `tests/live/` 3건뿐 — 아래) · 네이티브·마이그레이션·persona 무변경 확인 · 데모 게이트 `DEMO_GATE_PASSED`(`not_required`, `check.mjs check` 출력: `status: not_required / demo: 필요 없음(judge 판정 none)`).
**NOT_VERIFIED(사유 있음)**: ① 운영 스모크 `SMOKE_ENV=PRODUCTION` 006 42/42·007 45/45(완료 기준 3 일부) — 배포 전이고 운영 3010·8100·pm2·PRODUCTION DB 무접촉 지시라 **배포 직후 deployer 몫**(개발 서버 동일 코드 실측은 아래 PASS) ② 운영 TALK 100턴 baseline·배포 후 100턴 비교(Leader 가 따로 채취 — REV-109 §7) ③ 실기기(STT·TTS·APK·권한 거부) — 웹 변경뿐·네이티브 무변경이라 해당 없음.

### 환경·재현 조건
- 코드 = NFS 작업본(미커밋 24파일, `bash scripts/sync-local.sh` 후 `diff -rq src`·`diff -rq tests` 동일 확인) · `APP_ENV=LOCAL`.
- **작업본 서버**: 하드링크 복제본 `~/.node-local/thekaiwa-qa036new`(NFS `src` 실복사·`node_modules` 하드링크·`.env` 사본, 다른 에이전트의 sync-local 재시작 영향 차단) → `next dev -H 127.0.0.1 -p 3011`(브라우저는 `localhost:3011`), `SPEECH_GATEWAY_URL=http://127.0.0.1:8197`.
- **HEAD(d26e70b) 서버**: 복제본 `~/.node-local/thekaiwa-qa036head` — `git archive HEAD src`(작업본과 비테스트 소스 차이 정확히 7파일: `useChatTurn.ts`·`chats/index.ts`·`orchestrator/index.ts`·`prompts/chat.ts`·`prompts/talk.ts`·`structuredResponse/schemas.ts`·`types/chat.ts`) → `next dev -p 3012`, gateway 8198.
- **개발 gateway 2개**(운영 8100 무접촉): dev venv(`~/.node-local/thekaiwa-speech-dev`) uvicorn 127.0.0.1:8197(콜백 `APP_INTERNAL_URL`=3011)·8198(=3012), 모델 `DATA_ROOT/models`(reazonspeech-int8), 시크릿은 `.env` 값 그대로(출력 0). M4 TTS(192.168.219.100:8200)는 합성 요청만.
- 계정: QA 전용 `qa-bot`(1)·`qa-bot2`(2) — 쿠키는 권한 600 임시 파일, 끝에 삭제. Claude CLI 완료 호출 **약 179회**(작업본 서버 136 — talk 77·chat 43·chatReview 2·wordEnrich 3·reviewDecision 4·evalGen 4·evalGrade 3 / HEAD 서버 43 talk), 429 0건(스모크가 의도한 3b 제외).
- **QA 추가·수정 파일(tests/live)**: `task036-qa-turns.ts`(신규, SSE 계약 직접 확인) · `task036-ui.mjs`(신규, 실 Chrome) · `task007-latency.ts`(`WS_REWRITE` 환경변수 4줄 추가 — 개발 gateway 로 돌리기 위함, 어설션 변경 0) · `README.md` 3행. `npm run typecheck` exit 0, eslint exit 0(경고 0).

### 항목별 판정

| # | 항목 | 판정 | 근거(핵심) |
|---|---|---|---|
| 1 | 정적·단위 | **PASS** | typecheck exit 0 · eslint(conversation·engine·components/chat·types) exit 0·0줄 · conversation 전체+`jsonPathStream` **423/423** · 전체 `npm test` **1476 중 pass 1475 · fail 0 · skip 1**(기존 #9 manifest — 보고값과 일치) · `grep replyReading`: 코드·스키마·지시문·타입 **0건**, 남은 줄 전부 의도(아래 목록) — 단 `docs/screens.md:488` 은 역사 기록이 아닌 지시 문장(O-3, Reviewer L-4 동일) |
| 2 | 새 턴 계약(실서버 3011) | **PASS** | `task007-smoke` **47/47 PASS·FAIL 0·SKIP 1(J, TEXT_ONLY — 스크립트 정의)** · `task006-smoke` **42/42 PASS**(턴 p50 4474ms) · 직접 SSE **48턴(TALK 24·CHAT 24)** 전부: `done.conversation` 키 = `replyJa·replyKo` 뿐(옛 키·`reading` 0), DB 새 강사 행 `reading IS NULL` 48/48, `content===replyJa`·`translation===replyKo`·`DONE` 48/48, #29 새 행 `reading:null` 48/48, 심어 둔 **옛 행 4건(reading 값 있음)은 #29 가 값 그대로** 반환(4회 × 2종), 옛 행이 있는 방에서도 새 턴 정상, FAILED 0·`AUDIO_TEXT_MISMATCH`(직접 SSE 48턴) 0·`CORRECTION_ORIGINAL_MISMATCH` 0 |
| 3 | 첫 음성 비악화 | **PASS(악화 징후 없음 — 개선 추세, 통계적으로는 비유의)** | 작업본 vs HEAD **각 n=40**(ABBA·HEAD-first BAAB 두 라운드 교차, 모두 OK): stop→첫 audio p50 **2680 vs 3026ms(−346)** · 요청→첫 audio p50 1800 vs 2084(−284)·p90 2914 vs 3324 · 요청→done p50 5147 vs 5850(−703). 서버 구간 `LLM 첫 문장 확정` p50 run별 **작업본 960·1008·994·993 / HEAD 1044·1027·1027·1024 — 작업본 4 run 전부가 HEAD 4 run 전부보다 낮음(−34~−84ms)**. E2E 차이는 노이즈 안(중앙값 차 95% 구간 [−689,+169], p=0.14) — "악화 없음"의 증거이지 "개선 입증"은 아님 |
| 4 | 화면(UI) | **PASS** | 실 Chrome 147, CHAT·TALK × 360/390/412 × 780/892 + 다크 390×892 = **104/104 PASS**: 새 강사 말풍선 표시 · 후리가나(`<ruby>`, rt 11px) >0 · 한글 줄(`p[lang=ko]` `[…]`) 표시 · 잘림 0·말풍선 화면 안·가로 넘침 0·페이지 세로 스크롤 0 · 콘솔·페이지 오류 0·5xx 0 · 엔진명 문자열 0 · 보내기 44px · PTT 72×72px(≥64) · XSS 리터럴(img 0·onerror 미실행·글자로 보임) · 다크 토큰 반전(`rgb(20,24,22)`) |
| 5 | 옛 JS 호환 | **PASS** | grep: `src` 에 `replyReading` 소비처 0(코드 흔적은 부정 단언 상수 1건뿐). **브라우저 실증**: HEAD 사본 페이지(옛 `useChatTurn` — `replyReading ?? null` 줄이 HEAD 복제본에 실재 확인)에서 보낸 턴의 `/turns` 요청만 새 서버로 우회 → 새 `done`(키 `replyJa·replyKo`) 수신, 옛 클라이언트가 예외 0(console error 0)으로 강사 말풍선을 그림(내용 일치) |
| 6 | W1 관찰 | **관찰(임계 미초과)** | 아래 W1 표. 작업본 서버 talk+chat 턴 113 중 재시도 7(6.2%) — talk 5/72(6.9%, JSON 파싱 실패 3 = 4.2%), chat 2/41(4.9%, replyJa 3문장 소프트 위반 — 슬립 아님) · HEAD talk 3/40(7.5%, 파싱 실패 1). talk·chat 의 `ENGINE_ERROR`·`JsonSchemaError` **0건**. 임계(>8%·ENGINE_ERROR ≥1) 미초과이나 표본 작음 — 풀링 슬립률 상승 신호는 O-1 |
| 7 | 영향 없음 | **PASS** | `task008-smoke`(A10 단어 보강·오늘의 단어) **77/77** · `task011-smoke`(A6 평가 생성·A7 채점·SET_LEVEL) **61/61**. 생략: `task010-smoke`(A4 레슨 — sonnet 2~3회·3~4분, A4 모듈·스키마·`reading` 필드 코드는 이번 diff 에 한 줄도 없고 `lesson.test.ts` 단위 통과로 갈음) |
| 8 | 완료 기준 4 | **PASS** | `git diff --name-only -- prisma plugins android capacitor.config.ts .claude/agents/tutor.md src/modules/conversation/persona` 출력 비어 있음 · `git status --short -- prisma plugins android capacitor.config.ts` 비어 있음 · 화면 소스 변경은 `src/components/chat/useChatTurn.ts` 1줄 삭제뿐 |

### 결함·관찰

**결함 0건.** 비차단 관찰:
- **O-1 (W1, Leader 알림 후보 — 임계 미초과)**: JSON 구문 슬립(`JSON 파싱 실패` 재시도) 작업본 QA 표본 talk 3/72(4.2%) vs HEAD 3개 중 1/40(2.5%)(Fisher p=0.63) — HEAD 에서도 1건 나옴. PE 표본(작업본 5/124 vs HEAD 0/124)과 **풀링하면 8/176(4.5%) vs 1/164(0.6%), Fisher p=0.038**(독립 실험 풀링이라 느슨) → "작업본에서 슬립이 더 잦다"는 방향 신호가 두 표본에서 같다. 비용은 REV-108 대로 `done` +≈1.5s·첫 음성 영향 0 가정(QA 표본: 작업본 지연 40턴의 `AUDIO_TEXT_MISMATCH` 2건이 파싱 실패 때문인지 소프트 재시도(correction 규칙) 때문인지는 서버 로그만으로 구분하지 못했다 — 서버가 불일치를 기록하지 않는 REV-109 O-1 갭). 배포 후 TALK 100턴 감시(REV-109 §4 대리 지표)와 임계(attempt=2 >8%·`ENGINE_ERROR` ≥1 → (B) `extractJson` 좁은 복구 task) 유지 권고. **QA 판정은 변경 없음(결함 아님 — REV-108 W1 (A) 수용 결정 범위).**
- **O-2 `AUDIO_TEXT_MISMATCH`**: 첫 음성 측정 40턴×2에서 작업본 2건·HEAD 1건(양 팔 모두 발생 — task-007 C1-3 ③ 수용 설계, 재시도가 `replyJa` 를 바꾼 경우). 직접 SSE 48턴에서는 0건.
- **O-3 문서 잔재(Low, REV-108 L-4 와 동일, 이번 라운드에서 안 고침)**: `docs/screens.md:488`(`done` 행이 아직 `reading=replyReading` 을 지시)·`:8052`·`:8087`(미래형 서술). 구현자가 가이드를 그대로 따르면 지운 필드를 되살릴 수 있음 → designer 정정(Leader 경유). 지정 grep 범위 밖: `.codex/agents/prompt-engineer.toml`(생성본 — 재생성), `.claude/agents/tutor.md:65` persona "읽기"(PE·Reviewer 가 다음 persona 변경 때로 합의).
- **O-4 evalGen `JsonSchemaError` 1건**(task011-smoke 실행 중 `[router] … 실패(JsonSchemaError)`, A6 `[재료] 단어장에서 고른 문항 0%` 규칙 재시도 후 실패 → 스모크의 "다시 만들기" 경로로 회복, 61/61). 이번 변경(A1·A2)과 무관 — A6 프롬프트·스키마 diff 0. HEAD 대조 실행은 안 함(기록만).
- **O-5 (개발 서버 한정)**: Next dev 도구 배지(좌하단 "N" 원)가 입력창 placeholder 일부를 가림 — `nextjs-portal` 은 개발 서버에만 있고 운영 빌드엔 없음(기존 스크립트들도 숨김 처리). 앱 결함 아님.
- **O-6 하네스 정정(QA 자체 결함, 앱 무관)**: 내 직접 SSE 스크립트 초판이 `audio` 이벤트를 **도착 순서**로 이어 `replyJa` 와 비교해 2·3회차에 오탐 FAIL(총 5건: 길이 동일·앞뒤 문장 순서만 바뀜 — 캐시 HIT 청크가 먼저 도착)이 났다. 클라이언트(`chunkIndex` 순 재생)처럼 정렬하도록 고쳐 4회차 124/124 PASS. 007 스모크 A8 은 처음부터 정렬 비교라 영향 없음. 어설션 완화가 아니라 비교 대상을 올바르게 정렬한 수정.

### 첫 음성 측정 (작업본 vs HEAD, n=40/40) — 스크립트 원 출력 합산

방법: `WS_REWRITE='ws://127.0.0.1:8100=>ws://127.0.0.1:{8197|8198}' bash tests/live/task007-latency.sh {3011|3012} 10` 를 **작업본·HEAD·HEAD·작업본(run1~4) + HEAD·작업본·작업본·HEAD(run5~8)** 순서로 교차(런 사이 20s, 턴 간격 ≥5.5s, stt20 wav01~10, 모든 턴 OK·`#24` 404 재시도 0·받기 실패 0). 합산은 런 로그의 턴 줄(`stop→audio`·`stt`·`req→done`)을 파이썬으로 합쳐 계산(`scratchpad/qa036/combine.py`, nearest-rank p50/p90, 순열검정 20,000·부트스트랩 5,000, 시드 36).

```
== new n=40 ok=40
  stop→첫 audio 이벤트                   n=40 p50= 2680 p90= 4814 mean=   3196
  stop→첫 청크 바이트                      n=40 p50= 2708 p90= 4839 mean=   3223
  요청→첫 audio(≈ stop→audio − stt)     n=40 p50= 1800 p90= 2914 mean=   1914
  stop→final(STT)                    n=40 p50= 1005 p90= 2357 mean=   1282
  요청→done                            n=40 p50= 5147 p90= 8160 mean=   5714
    └ 첫 청크 MISS stop→bytes           n= 9 p50= 3022 p90= 4839 mean=   3441
    └ 첫 청크 HIT  stop→bytes           n=31 p50= 2629 p90= 4975 mean=   3160
  HIT 31/40
== head n=40 ok=40
  stop→첫 audio 이벤트                   n=40 p50= 3026 p90= 5694 mean=   3408
  stop→첫 청크 바이트                      n=40 p50= 3051 p90= 5880 mean=   3493
  요청→첫 audio(≈ stop→audio − stt)     n=40 p50= 2084 p90= 3324 mean=   2169
  stop→final(STT)                    n=40 p50= 1123 p90= 2425 mean=   1239
  요청→done                            n=40 p50= 5850 p90= 9516 mean=   6154
    └ 첫 청크 MISS stop→bytes           n=11 p50= 4025 p90= 5714 mean=   4100
    └ 첫 청크 HIT  stop→bytes           n=29 p50= 2599 p90= 6003 mean=   3264
  HIT 29/40
[stop→첫 audio] new−head median: -324ms  perm p=0.414  boot95%=[-1011,+502]
[stop→첫 audio] new−head mean: -212ms  perm p=0.463  boot95%=[-766,+346]
[요청→첫 audio] new−head median: -290ms  perm p=0.140  boot95%=[-689,+169]
[요청→첫 audio] new−head mean: -255ms  perm p=0.158  boot95%=[-605,+91]
[요청→done] new−head median: -712ms  perm p=0.155  boot95%=[-1408,+521]
[요청→done] new−head mean: -440ms  perm p=0.283  boot95%=[-1240,+365]
```
런별 서버 구간(스크립트 표, Trace 기반 — run1 new / run2 head / run3 head / run4 new / run5 head / run6 new / run7 new / run8 head):
`LLM 첫 문장 확정 p50` 960 / 1044 / 1027 / 1008 / 1027 / 994 / 993 / 1024 · `LLM 총 p50` 3967 / 3980 / 3975 / 2928 / 3258 / 2747 / 3013 / 3224 · `ttfaServerMs p50`(캐시 영향 큼) 15 / 618 / 424 / 707 / 652 / 62 / 16 / 17 · `AUDIO_TEXT_MISMATCH` 1 / 0 / 1 / 1 / 0 / 0 / 0 / 0 · `CORRECTION_ORIGINAL_MISMATCH`·`TTS_UNAVAILABLE` 전 런 0.
해석 한계: STT(`stop→final`)가 두 gateway 간 노이즈(p50 877~1313ms)라 `stop→audio` 차에 섞인다 → STT 를 뺀 `요청→첫 audio` 와 서버 구간(`첫 문장 확정`)을 함께 본다. TTS 캐시 HIT 비율(31/40 vs 29/40)은 비슷하나 M4 합성 노이즈가 커서 n=40 에서도 E2E 차이는 통계적으로 유의하지 않다(95% 구간이 0 을 포함). **결론: 악화 징후 없음(모든 지표 중앙값이 작업본 쪽이 낮거나 같음, 서버 구간은 PE 측정(첫 문장 −40ms)과 같은 방향).**

### 새 턴 계약 직접 확인 — `tests/live/task036-qa-turns.ts` (원 출력 발췌)
4회 실행(턴 4·6·8·6 ×2종 = TALK 24·CHAT 24). 2·3회차의 FAIL 5건은 위 O-6 하네스 순서 오류(수정 후 4회차 전체 PASS), 계약 항목은 4회 모두 FAIL 0:
```
회차  결과                     done.conversation키 DB reading NULL DB content/translation SSE순서 #29 새 reading:null #29 옛 행   status경고0
1     PASS 86/86              8/8                 8/8             8/8                    8/8     8/8                 4/4        8/8
2     PASS 122/124 (하네스 2)   12/12               12/12           12/12                  12/12   12/12               4/4        12/12
3     PASS 159/162 (하네스 3)   16/16               16/16           16/16                  16/16   16/16               4/4        16/16
4     PASS 124/124            12/12               12/12           12/12                  12/12   12/12               4/4        12/12
```
대표 턴(1회차 TALK #1):
```
PASS  TALK #1 SSE 순서 accepted 첫째·done 마지막·error 0 — events=accepted,status,status,status,audio,audio,status,done
PASS  TALK #1 done.conversation 키 = [replyJa, replyKo] 뿐 — keys=replyJa,replyKo
PASS  TALK #1 done 최상위에 reading·replyReading 없음 — top=userMessageId,assistantMessageId,conversation,correction,selfCheck,learning,speech,endOfTopic,userTranslation,proposals,audioCount,traceId
PASS  TALK #1 DB 강사 행 reading NULL — reading=null
PASS  TALK #1 DB content === replyJa·translation === replyKo·status DONE — status=DONE contentEq=true translationEq=true
PASS  TALK #29 옛 메시지 1 reading 값 그대로 — reading="そうですね。きょうは なにを しましたか。"
PASS  TALK #29 새 메시지 reading:null (erq494) — reading=null hasKey=true
```
4회차(기록 회차) 관찰 표 — `관찰(W1): 턴 12/12 · toolLog.attempt≥2 0 · LLM earlyStop='RETRY' 0`:
```
| TALK | 1 | 1164 | 4627 | 3407 | 1 | null |   | CHAT | 1 | - | 5593 | 4570 | 1 | null |
| TALK | 2 | 3572 | 5167 | 2776 | 1 | null |   | CHAT | 2 | - | 4969 | 4248 | 1 | null |
| TALK | 3 | 1323 | 3827 | 2692 | 1 | null |   | CHAT | 3 | - | 4145 | 3910 | 1 | null |
| TALK | 4 | 1647 | 3381 | 2441 | 1 | null |   | CHAT | 4 | - | 4446 | 3578 | 1 | null |
| TALK | 5 | 1179 | 6315 | 4083 | 1 | null |   | CHAT | 5 | - | 4130 | 3444 | 1 | null |
| TALK | 6 | 2150 | 4289 | 3074 | 1 | null |   | CHAT | 6 | - | 4169 | 3989 | 1 | null |   (열: 종류 | n | 첫 audio ms | 총 ms | LLM ms | attempt | earlyStop)
```
(1회차 CHAT #2 만 `attempt=2` — 서버 로그 `[json] 1차 응답 계약 위반 → 재시도(soft): conversation.replyJa 는 3문장 이내여야 한다`, 슬립 아님.)

### 정적·단위 원 출력
```
$ npm run typecheck > typecheck.log 2>&1; echo "typecheck exit=$?"
typecheck exit=0
> thekaiwa@0.1.0 typecheck
> bash scripts/sync-local.sh && cd $HOME/.node-local/thekaiwa && node node_modules/typescript/bin/tsc --noEmit
$ diff -rq src ~/.node-local/thekaiwa/src → exit 0 · diff -rq tests ~/.node-local/thekaiwa/tests → exit 0
$ node node_modules/eslint/bin/eslint.js src/modules/conversation src/modules/engine src/components/chat src/types
eslint exit=0   (0줄)
$ node --import tsx --test --test-concurrency=1 src/modules/conversation/__tests__/*.test.ts src/modules/engine/__tests__/jsonPathStream.test.ts
conv tests exit=0 — # tests 423 # pass 423 # fail 0 # cancelled 0 # skipped 0
$ npm test > npm-test.log 2>&1
npm test exit=0 — # tests 1476 # suites 0 # pass 1475 # fail 0 # cancelled 0 # skipped 1 # todo 0 # duration_ms 45420.765439
ok 1280 - \#9 실제 배포 manifest(speech/models/reazonspeech-int8) 통과 — … # SKIP 저장소 speech/models 가 없는 실행 위치(미러) — …
$ npx eslint tests/live/task036-qa-turns.ts tests/live/task007-latency.ts tests/live/task036-ui.mjs → exit 0, 경고 0 (QA 추가분)
```
`grep -rn replyReading src docs .claude tests` — 18줄, 전부 분류됨(코드·스키마·지시문 0):
- `src/modules/conversation/__tests__/prompts.test.ts:61`(부정 단언 상수 `REMOVED_READING_KEY`)·`:113`(의도 주석) — 의도
- `docs/design/tutor-persona-validation.md:18`(V4 "구 기준" 서술)·`docs/design-spec.md:183`·`docs/design/api-contract.md:789`·`.claude/agents/prompt-engineer.md:29` — 제거 사실 기록(역사 설명)
- `tests/live/task036-reading-ab.ts` 5줄(A/B 측정 스크립트 — 옛 키 방출 판정 정규식·설명)·`tests/live/talk-length-measure.ts:49`(task-024 기준선 문구 상수, PE 가 머리에 재현 불가 경고) — 측정 스크립트
- **`docs/screens.md:488`·`:8052`·`:8087` — 지시/미래형 서술 잔재(O-3, Low)**

### 스모크 원 출력(작업본 서버 3011, 마지막 줄들)
```
$ DEV_PID=<next-server pid> DEV_LOG=<로그> bash tests/live/task007-smoke.sh 3011      (19:29~19:30)
PASS I1 대기 예열 CLI ≤ 2 — idle=1
SKIP J TTS 불가(TEXT_ONLY) → done 정상·audioCount 0·TTS_UNAVAILABLE — M4 는 운영과 공유 — 단위 테스트 conversation/__tests__/task007 "TEXT_ONLY" 로 갈음
PASS K7 DB: 이미 발화가 붙은 메시지에 두 번째 발화를 붙이면 P2002(chatMessageId @unique) — P2002
결과: PASS 47 / 47        (줄 집계: PASS 47 · FAIL 0 · SKIP 1)
$ bash tests/live/task006-smoke.sh 3011      (19:32~19:36, 007 과 2분 간격)
PASS 12 사용자 응답(JSON·SSE)에 엔진·모델명·toolLog 0건 — hits=0
결과: 42/42 PASS · 턴 p50=4474ms
$ bash tests/live/task008-smoke.sh 3011  → 결과: 77/77 PASS (QA 데이터 정리 완료)
$ bash tests/live/task011-smoke.sh 3011  → 결과: 61/61 PASS · 지표 {"wordsGenMs":12287,…,"talkTotal":75,…}
```
(개발 007 스모크는 K 항목(task-018)이 있어 운영 기준 "45/45" 와 항목 수가 다르다 — 운영 `SMOKE_ENV=PRODUCTION` 은 deployer.)

### W1 집계(서버 로그 `[claudeCli] 완료`·`[json] 1차 응답 계약 위반` 파싱, 직전 `완료` 줄의 task 로 귀속 — 호출 순차라 인터리브 없음)
```
== 작업본 3011   talk: 호출 77 턴 72 재시도 5 (6.9%) 그중 JSON 파싱 실패 3 / chat: 호출 43 턴 41 재시도 2 (4.9%) 파싱 0 / talk+chat: 턴 113 재시도 7 (6.2%)
   재시도 사유: talk — correction.corrected==original ×2(소프트, 기존 규칙)·JSON 파싱 실패 ×3 / chat — replyJa 3문장 이내 ×2(소프트, 기존 규칙)
   talk·chat 의 ENGINE_ERROR/JsonSchemaError: 0  (로그의 JsonSchemaError 1줄은 evalGen — O-4)
== HEAD 3012     talk: 호출 43 턴 40 재시도 3 (7.5%) 그중 JSON 파싱 실패 1 — 사유: JSON 파싱 실패 ×1·correction 스키마(chunkType=OTHER) ×1·corrected==original ×1
   ENGINE_ERROR/JsonSchemaError: 0
Fisher: QA talk 파싱 실패 3/52(검정 시점 표본; 최종 72턴 기준 비율 4.2%) vs 1/40 p=0.63 · PE+QA 풀링 8/176 vs 1/164 p=0.038
```
`RequestTrace` 쪽: 직접 SSE 4회차 12턴은 Trace LLM 단계 `attempts=1`·`earlyStop=null`(조기 경로 켜진 채 재시도 0). 스모크·측정 스크립트는 끝에 자기 Trace 를 지우므로 로그 집계가 전체 표본이다(1회차는 Trace 기록이 늦어 `earlyStop` 미수집 → 스크립트에 최대 5s 대기 폴링 추가).

### QA 시각 검증 — 재현 조건(데모 게이트 §8, `demo_gate: not_required` 라 승인 데모 대비 비교는 해당 없음·동작 확인)
- 브라우저 **Chrome 147.0.7727.101**(`/usr/bin/google-chrome` headless, playwright-core) · viewport **360×780·360×892·390×780·390×892·412×780·412×892**(대표 390, 경계 360·412) · **DPR 2.625·isMobile·hasTouch** · **light 6조합 + dark 390×892** · locale **ko-KR** · timezone **Asia/Seoul** · 글꼴 로딩 완료 대기 `document.fonts.ready` + networkidle + 1.2s · 애니메이션 비활성 `reducedMotion: reduce` · **네트워크 fixture 사용 안 함**(실 dev 서버 3011·실 dev gateway 8197 — 읽기 분석 `#24r` 포함) · 캡처 범위: 판정은 DOM 측정값(스크린샷 근거 아님), 육안 확인용으로 390×892 light/dark × 채팅·회화 4장만 촬영 → 판독 후 삭제 · 허용 범위: 기존 화면과 동일(이번 변경은 화면 코드 무변경이라 Reviewer 차이 분류 해당 없음).
- 육안 판독(390×892): 채팅 — 사용자 말(핑크)·강사 말(흰) 모두 후리가나가 한자 위에 얹히고(`行{い}`·`毎日勉強` 등) 아래에 `[한글 발음]` 줄·`번역 ▾`·시각, XSS 말은 `<img src=x onerror="window.__xss=1">` 가 글자로 그대로 보임. 회화 다크 — 후리가나·한글 줄·`▶ 다시 듣기`·문법 칩·말하기 버튼 정상, 다크 토큰 반전.
- 측정값 예: `rt` 11px · 보내기 버튼 높이 44px · 말하기 버튼 72×72px · 페이지 가로 `scrollWidth == clientWidth`(360/390/412) · 페이지 세로 스크롤 0 · 가로 넘침 요소 0.
- 실행: `node tests/live/task036-ui.mjs --base http://localhost:3011 --head http://localhost:3012 --user <쿠키> --out /tmp/qa-artifacts/TheKaiwa/task-036`(미러에서) → `결과: PASS 104 / 104`.

### 남긴 데이터·정리
- **LOCAL DB(QA 계정)**: 이 QA 의 채팅·메시지·교정 **0건 남음**(직접 SSE·UI·지연 스크립트가 방 삭제로 cascade, 확인: 최근 80분 `ChatMessage` 0, `t036`/`t007` 제목 채팅 0). UI 스크립트가 남긴 TURN Trace 4건은 삭제. 남은 Trace 5건(PREVIEW 2·reviewDecision 3)은 기존 007·008/011 스모크 스크립트가 원래 남기는 QA 계정 행(LOCAL). TTS 캐시 행·wav 는 공유 캐시(기존 스모크와 같은 부류). 합성 발화 행 0.
- **산출물 정리: 스크린샷 4개 삭제**(`/tmp/qa-artifacts/TheKaiwa/task-036` 디렉터리까지 제거 — 근거는 위 관찰 글).
- **프로세스 정리: dev 3011·3012 종료(next-server PID 로만 종료)·dev gateway 8197·8198 종료 → `ss -ltn | grep -E ':(3011|3012|8197|8198)'` 비어 있음**(운영 3010·8100 은 내 것이 아니며 그대로 LISTEN). 복제본 `thekaiwa-qa036new`·`thekaiwa-qa036head` 삭제(`.env` 사본 shred 후) — `ls -d ~/.node-local/thekaiwa*` 에 내 복제본 없음(`thekaiwa-head036` 은 PE 것, 그대로). 쿠키 임시 파일 전부 삭제.

### Deployer 인계(verdict=PASS, 결함 0건)
```json
{"from":"qa","to":"deployer","task":"task-036","verdict":"PASS","defects":0,
 "deploy_ref":"작업본 미커밋 → 커밋 후 origin/main ref(Leader 커밋·push 승인 뒤)",
 "migration_required":false,"reinstall_required":false,
 "post_deploy_checks":[
  "/api/health 본문 status=ok (degraded 의 stt_analysis_worker 는 기존 상태)",
  "SMOKE_ENV=PRODUCTION task006-smoke 42/42·task007-smoke 45/45 (포트 3010)",
  "새 TALK/CHAT 턴 done.conversation 키 = replyJa·replyKo, ChatMessage.reading NULL, AUDIO_TEXT_MISMATCH 0",
  "화면 360/390/412 3폭에서 새 강사 말풍선 후리가나·한글 줄 확인",
  "W1 감시: 배포 직전 v7 TALK 최근 100턴 baseline 대비 배포 후 100턴 attempt=2 >8% 또는 ENGINE_ERROR ≥1 → Leader ((B) extractJson 복구 task)",
  "롤백: scripts/deploy.sh TheKaiwa --rollback (DB·스키마 변경 없음, v7 이 reading 을 다시 쓸 뿐)"]}
```
```json
{"taskId":"task-036","status":"DONE","deliverables":["tests/live/task036-qa-turns.ts","tests/live/task036-ui.mjs","tests/live/task007-latency.ts"],"blockers":[],"risk_level":"LOW","metrics":{"talk_p50_ms":5147,"talk_p95_ms":null,"vocab_set_sec":null,"first_audio_stop_p50_ms":{"work":2680,"head":3026},"req_to_first_audio_p50_ms":{"work":1800,"head":2084},"w1_retry_rate":{"work_talk":0.069,"head_talk":0.075,"work_json_parse_fail":0.042,"head_json_parse_fail":0.025}}}
```
(`talk_p50_ms` = 턴 요청→done p50 5147ms 작업본. p95·단어 세트 소요는 이 task 범위 밖/표본 부족으로 미측정.)

## 최종 요약 (Leader, 2026-10-05)

**한 일** — 회화(A1 TALK)·채팅(A2 CHAT) LLM 응답 계약에서 구 `conversation.replyReading`(말풍선용 히라가나 한 줄)을 제거했다(talk@v7→**v8**·chat@v2→**v3**). 화면 A(후리가나·한글)와 서버 분석(#24r)이 읽기 줄을 대신한 뒤로 `ChatMessage.reading` 은 쓰기 전용이었는데 LLM 이 매 턴 그 줄을 생성하고 있었다. 지시 줄·`[순서 예]` 골격·키 순서 문구·스키마 required/properties·`TutorResponse` 타입·테스트 일치(A5·A11 교훈), 키 순서는 `replyJa` 앞 그대로(조기 추출·문장 단위 합성 불변), 서버는 새 메시지에 `reading: null`(컬럼·옛 메시지 값 유지·#29 응답 필드 유지), `done` 에서 읽기 필드 제거. persona·DB 스키마·화면(말풍선은 이미 `reading` 미사용 — `useChatTurn` 1줄 삭제뿐)·레슨/평가 프롬프트 무변경. **마이그레이션·네이티브 변경 0.**

**사용자 결정** — 없음(후속 정리). Leader 판단: ① judge 값(structural·R2·sonnet·standard, R2 는 요약 키워드 오탐 가능성이 있어도 그대로) ② 버전 번호는 실측 현재 v7·v2 기준 +1(초안의 v9·v4 는 오기 — 이력서 정정) ③ **W1(JSON 구문 슬립) 수용 + 배포 후 감시·롤백 기준**(위 "Leader 결정" 절) ④ strip 옵션 미적용(옛 키 방출 0/160)·persona 무변경.

**검증** — judge intake·C1(Codex 불필요)·C2(Codex 필요, 1회 호출) → Developer(Sonnet) 구현 → PE A/B 라이브 측정(324회) → **REV-108 PASS_WITH_NOTES**(Medium 1 = W1) → dev-036b 단언 보강(변이 3건 killed) → **Codex C2 지적 1건(Medium) → REV-109 부분 채택**(조기 음성×슬립 창은 task-007 기존 설계의 알려진 한계·Low·비차단) → dev-036c T-A·T-B 테스트(변이 ⓐⓑⓒ killed) → **QA PASS(결함 0)**.
- 실측 효과(PE, 각 arm TALK 124·CHAT 36): 지연 p50 TALK 4,946→4,609ms(−337)·CHAT 4,044→3,498ms(−546), 출력 JSON TALK −9.4%·CHAT −18.9%, 교정 검출 80/80·오탐 0/20 동일, 옛 키 방출 0/160. **p95 는 판정 불가**(부트스트랩 95% 구간 [−545,+421]ms).
- QA 독립 실측(작업본 vs HEAD 각 n=40 교차): 첫 음성(손 뗌→첫 audio) p50 2,680ms vs 3,026ms·턴→done p50 5,147ms vs 5,850ms — **악화 없음, 개선 입증은 아님**(p=0.14). 직접 SSE 48턴 `done.conversation` 키 = `replyJa`·`replyKo` 뿐·새 강사 행 `reading` NULL·옛 행 값 유지·`AUDIO_TEXT_MISMATCH` 0. 개발 스모크 007 47/47·006 42/42·008 77/77·011 61/61. 말풍선 읽기 줄 360/390/412×780/892·다크 104/104(실 Chrome). 옛 JS 호환 PASS. 전체 테스트 1476건 중 1475 통과·1 skip(기존).

**알려진 한계·후속** — ⚠ **W1 신호**: QA 풀링(PE 표본 포함) 구문 슬립 신규 8/176 vs HEAD 1/164(Fisher p=0.038) — 두 표본이 같은 방향이라 "우연"으로만 보기 어렵다. 다만 QA 표본의 TALK 총 재시도율은 신규 6.9% vs HEAD 7.5% 로 **같고**(슬립이 다른 재시도 사유를 대체), 5/5 재시도로 회복·FAILED 0·평균 지연은 여전히 단축 → 순이득이라 수용하되 **`extractJson` 좁은 복구(REV-108 B)를 후속 task(037 후보)로 우선 진행**해 슬립 범주 자체를 없애는 것을 권고. 감시·롤백 기준은 위 "Leader 결정" 절. 그 밖: O-1 불일치 건수 서버 미기록(task-007 C1-3 ③ 미구현) · `docs/screens.md:488·8052·8087`·`.codex/agents/prompt-engineer.toml`(생성본)·persona `tutor.md:65` "읽기" 문구 잔재 · T-C 단언 · QA 가 수정한 `tests/live/task007-latency.ts`(`WS_REWRITE` 4줄)·신규 `task036-*` 스크립트 3개 커밋 포함. NOT_VERIFIED: 운영 스모크(배포 직후 Leader 실행)·실기기.

**배포 상태** — 운영 배포 전(로컬 커밋·push 대기 — 이번 push 에는 task-035 로컬 커밋 2개(`3a0945c`·`d26e70b`)도 함께 나간다). 배포 뒤: `SMOKE_ENV=PRODUCTION` 006 42/42·007 45/45, 운영 새 메시지 `ChatMessage.reading` NULL, **W1 감시(첫 TALK 100턴)** 를 확인한다.
