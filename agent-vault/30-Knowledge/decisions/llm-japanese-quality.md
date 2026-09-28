---
tags:
  - type/decision
  - domain/tutor
  - domain/infra
aliases:
  - LLM 실측
  - Claude CLI 지연
created: 2026-09-27
---
# Claude CLI 회화 턴(A1) 실측과 결정 — [[task-004-ai-client-persona]]

환경: 우분투 home-dev-x600, Claude CLI 2.1.222(구독 로그인), 모델 `claude-haiku-4-5`, 픽스처 `tests/prompts/fixtures/talk-corrections.json`(합성 20문장: 오류 16·정답 4), 스크립트 `tests/live/llm-measure.ts`. 사용자 프롬프트 ≈1,000자 + 페르소나(시스템 프롬프트) 2,522자.

## 1. 지연의 원인 두 가지 — 둘 다 CLI 기본값이었다
| 단계 | 'OK' 한 마디 | TALK 1회 | 원인 |
|---|---|---|---|
| CLI 기본 | 8.4~10.6s | 37~120s | ① 전역 설정 훅 12종·플러그인 12개가 **매 spawn 마다** 로드 ② haiku 가 **extended thinking** 으로 출력 10,615토큰(대부분 thinking) |
| `--setting-sources ""` + `--strict-mcp-config`(빈 MCP) + `--no-session-persistence` | 1.9~3.1s | — | ① 해소 |
| + `MAX_THINKING_TOKENS=0` + `--settings {"alwaysThinkingEnabled":false}` | — | 4.6~5.3s(353토큰) | ② 해소 |
| `--bare` | 사용 불가 | — | 구독(OAuth) 인증을 읽지 않음(API 키 전용) |

## 2. 변형 비교(thinking 끔, 3회씩)
| 변형 | 지연 | JSON | 원문 보존 |
|---|---|---|---|
| 페르소나 = `--system-prompt`, 스키마는 프롬프트 | 4.6~5.3s | 코드펜스 포함(extractJson 으로 해결) | ✅ |
| 페르소나 = `--agents`/`--agent` | 4.7~5.1s | 동일 | ✅ |
| `--system-prompt` + `--json-schema` | 5.5~6.3s | 깨끗 | ✅ — 20문장 실측에서는 **6/20 이 CLI exit 1**("structured output 최대 재시도 실패") |

## 3. 최종 20문장(기본값 확정 후, 2026-09-27)
| 항목 | 값 |
|---|---|
| 실패 / JSON 재시도 | 0 / 0 |
| 지연 p50 / p95 / max | **5.1s** / 5.8s / 5.8s (12s 초과 0) |
| 오류 검출 / 오탐(정답 문장 교정) | 16/16 / 0/4 |
| 교정문 기대값 일치 / 오류 유형 일치 | 15/16 / 12/16(`だです`·시제·`の→な` 를 CONJUGATION 으로 분류 — 분류 기준 차이, 교정 자체는 정확) |

재시도 원인 분석: 초기 3건은 전부 `replyJa` 3문장(모델이 일본어로 교정 설명을 덧붙임). 프롬프트에 "① 반응 ② 질문, 교정 설명은 correction 에만" 을 명시하고 **재시도는 3문장 초과부터**로 바꾼 뒤 0건.

## 4. 결정
1. Claude CLI 어댑터는 항상 `--setting-sources "" --strict-mcp-config --mcp-config {"mcpServers":{}} --no-session-persistence`, thinking 끔(env + settings 두 겹). thinking 은 `deep` tier 에서 connection `runtime.thinkingForDeep=true` 일 때만.
2. 페르소나는 `--system-prompt` 로 싣는다(지연 동일, Claude Code 기본 코딩 에이전트 시스템 프롬프트가 섞이지 않음). `--agents` 지원은 어댑터에 남긴다(model 금지 검사 유지).
3. `--json-schema` 는 **기본 끔**(+1s·실패 30%). 프롬프트 스키마 + extractJson + ajv + 1회 재시도로 계약을 지킨다. connection `runtime.jsonSchemaFlag=true` 또는 `KAIWA_LLM_JSON_SCHEMA_FLAG=1` 로만 켠다.
4. `replyJa` 는 목표 2문장, 계약 상한 3문장.

## 5. 남은 것 · 사용자 결정 필요
- **A1 p50 5.1s 는 목표(≤4s)를 넘는다.** 하한은 spawn ~1.9s + 생성 ~3s. 후보(task-007 에서 실측): ① **상주 CLI 세션**(`--input-format stream-json`, 채팅당 프로세스 1개 유지 → spawn 제거, 예상 ~3.2s) ② `replyReading`(후리가나)을 LLM 대신 코드(pyopenjtalk/형태소 분석)로 만들어 출력 토큰 절감 ③ 첫 문장 조기 TTS(`--include-partial-messages`). 음성 턴 5초 예산(design-spec §8)은 ①이 없으면 넘는다.
- **qwen(home-m4) 비교 보류**: thekaiwa 전용 `HOME_M4_API_KEY` 가 없다(다른 프로젝트 키는 쓰지 않음).

## 6. task-007 K4 — 출력 순서·첫 문장 단축 재실측(2026-09-28, prompt-engineer)

배경: developer 의 K2-1(예열 CLI 프로세스)·K2-2(`--include-partial-messages` 로 부분 JSON 스트림에서 `speech.style`→
`conversation.replyJa` 순 증분 추출, 문장 단위 조기 TTS)가 이 순서에 기대어 설계된다. `structuredResponse/schemas.ts`(필드·제약)와
`checks.ts`(후검증)는 이 task 의 파일 소유 경계 밖이라 바꾸지 않았다 — `prompts/talk.ts` 의 지시문만 바꿨다
(`TALK_PROMPT_VERSION` `talk@v1` → `talk@v2`, `prompts:sync` 로 Registry 에 반영하는 것은 그 테이블이 아직 없어 보류).

**변경 내용**
1. JSON 키 순서 지시 — 최상위 `speech → conversation → correction → learning → endOfTopic → proposals`, `conversation`
   안은 `replyJa → replyReading → replyKo`. `<...>` 자리표시자로 된 "[순서 예]"(값이 아니라 구조만 예시 — 모델이 자리표시자를
   그대로 베끼면 기존 `checkPlaceholderLeftovers`/ajv `enum` 검사가 이미 잡는 안전망이 있어 이 패턴을 썼다).
2. `conversation.replyJa` 첫 문장을 「そうですね。」「いいですね！」류의 아주 짧은 맞장구로 예시(TTFA — 문장 경계가 빨리 나올수록
   첫 청크 합성이 빨라진다). 교정 설명은 여전히 `correction` 에만(원칙 불변, 회귀 테스트로 확인).
3. **확인만(코드 변경 없음)**: `persona`(→ claudeCli `--system-prompt`)는 `(model, learner.level, mode)` 로만 정해지고,
   오늘 날짜·학습자 헤더(약점·연속 출석 등)·`altText`·이력 창·이번 발화는 전부 `system`/`messages`(stdin) 쪽으로만 간다 —
   `buildTalkRequest`·`buildChatRequest` 둘 다 이미 그런 구조였다. 같은 학습자·같은 수준이 이어지는 한 `--system-prompt`
   는 턴마다 바이트 동일 → K2-1 예열 프로세스가 재사용할 수 있다. `prompts.test.ts` 에 회귀 테스트로 박아 뒀다
   (날짜·헤더 세부값·altText·이력·발화만 다른 두 호출의 `persona.prompt` 바이트 동일 어서션).

**⚠ 상충 가능성 하나 남음**: `engine/json/schemaValidate.withJsonOnly` 가 `--json-schema` 미사용 경로(기본)에서 내 지시문
뒤에 `schemas.ts` 의 `TALK_SCHEMA` 를 그대로 `JSON.stringify` 해 붙인다 — 그 `properties` 선언 순서는
`conversation, correction, learning, speech, endOfTopic, proposals` 로 내 지시(`speech` 먼저)와 **반대**다(스키마 자체는
이 task 에서 바꾸지 않기로 했으므로 고칠 수 없다). 아래 실측에서는 이 상충에도 불구하고 순서 준수율이 100% 였다(자연어
지시 + 구체 예시가 이겼다) — 다만 haiku·20건뿐인 표본이라 다른 모델·더 큰 표본에서 뒤집힐 수 있다.

### 예산 확인(A1 사용자 프롬프트 ≤3,000자)
지시문이 +372자(734→1,106자) 늘었다. `buildTalkRequest` 의 `room` 계산(`TALK_USER_PROMPT_CAP - system.length - text.length - 40`)
이 창을 자동으로 줄여 캡을 지키므로 상수는 손대지 않았다. 로컬 시뮬레이션(파이썬으로 `renderHeader`/`renderTranscript`/`buildWindow`
로직을 그대로 복제해 확인, 코드 자체는 바꾸지 않음)으로 두 극단을 확인했다:
- 기존 단위 테스트 시나리오(20문장 × 6개 메시지·2,400자 꽉 찬 이력, altText 없음): 최대 2,869자(마진 131자) — 여전히 통과.
- altText(60자 가정) + 꽉 찬 이력 동시 조합(기존에는 테스트가 없던 조합): 최대 2,965자(마진 35자) — 여전히 통과하지만 여유가
  줄었다. `prompts.test.ts` 에 이 조합을 회귀 테스트로 새로 추가했다(altText 는 STT 인식 후보라 실사용 길이 상한이 코드에
  없다 — 훨씬 더 긴 altText 가 들어오면 이론상 캡을 넘을 수 있다. 이번 range 밖이라 손대지 않았지만, altText 길이 상한을
  두는 편이 안전하다는 점은 Leader 에게 별도로 전달할 만하다).

### 재실측 표(haiku, `--json-schema` OFF·기본 경로, 픽스처 20문장, 우분투, 2026-09-28)
`tests/live/llm-measure.ts --variant noflag`(ON 경로는 기존에도 기본 꺼짐·30% 실패로 프로덕션 경로가 아니라 이번에는 재실측하지
않았다 — §2·§4 결정 그대로).

| 항목 | task-004 기준(2026-09-27, `talk@v1`) | task-007 K4 재실측(2026-09-28, `talk@v2`) |
|---|---|---|
| 실패 / 재시도 | 0 / 0 | 0 / 1(5%, `correction.chunkType` enum 위반 1건 — 순서·첫 문장 변경과 무관) |
| 지연 p50/p95/max | 5.1s / 5.8s / 5.8s | 4.96s / 6.14s / 9.41s(12s 초과 0) |
| 오류 검출 | 16/16 | 16/16 |
| 오탐(정답 문장 교정) | 0/4 | 0/4 |
| 오류 유형 일치 | 12/16 | 12/16 |
| 교정문 정확 일치 | 15/16 | 13/16(변동 — correction 지시문은 이번에 안 건드렸다, LLM 표본 변동으로 본다) |
| **키 순서 준수(top: speech 가 conversation 보다 앞)** | 측정 안 함(v1 에는 순서 지시가 없었다) | **20/20(100%)** |
| **키 순서 준수(conv: conversation 의 첫 키가 replyJa)** | 측정 안 함 | **20/20(100%)** |
| **replyJa 첫 문장 글자 수** | 측정 안 함 | min 5 · p50 6 · p90 8 · max 15(e09 하나만 15자, 나머지는 5~8자) |

### 결론 · developer 에게 전달할 것
1. K4 변경은 지연·검출력을 해치지 않았다(p50 은 오히려 소폭 개선됐지만 표본 변동 범위 안이라 "개선"으로 홍보하지 않는다).
   키 순서·첫 문장 단축은 이번 20건 표본에서 100% 달성 — K2-2(조기 추출)가 이 순서에 기대어 설계해도 된다.
2. **순서는 스키마가 아니라 지시문으로 미는 것이라 강제되지 않는다.** K2-2 구현에 폴백을 반영해야 한다 — 부분 JSON 스트림을
   파싱하다 `speech`/`conversation.replyJa` 가 예상한 자리에 없으면(다른 키가 먼저 완성되면) 조기 추출을 포기하고 최종 JSON
   완성을 기다리는 경로로 넘어가게(이미 계획에 있는 "재시도가 일어나 최종 replyJa 가 이미 낸 문장으로 시작하지 않으면 멈추고
   `AUDIO_TEXT_MISMATCH`" 처리와 같은 종류의 방어).
3. `correction.chunkType` enum 위반(이번 1/20)은 기존에도 있던 실패 모드(오류 분류 프롬프트와 무관, `checks.ts`·`schemas.ts`
   소유자인 developer/leader 판단 영역) — 이 task 에서는 손대지 않았다.

### 남은 것
- 표본 20건(haiku)뿐 — sonnet(레슨·평가·PLAN 등에도 유사한 순서 요구가 생기면) 재확인이 필요하다.
- `--json-schema` ON 경로는 이번에 재실측하지 않았다.
- altText 시나리오는 라이브로 실측하지 않았다(픽스처에 altText 케이스가 없다) — 시뮬레이션·단위 테스트로만 예산을 확인했다.
- altText 길이 상한 부재(구조적, 이 task 범위 밖) — 위 예산 확인 절 참고, Leader 전달 대상. → **§7 에서 해소(2026-09-28)**.

## 7. altText 길이 상한 — 결정(2026-09-28, Leader)

**문제**: `TalkInput.altText`(STT 두 번째 후보, "이 말이 맞나요?" 되묻기용)는 길이 상한 없이 헤더 줄로 들어갔다. `buildTalkRequest` 는 `system.length`(altText 포함)만큼 이력 창을 줄이지만, altText 자체가 길면 창을 0으로 줄여도 캡을 넘는다. **실측**: altText 5,000자 → 사용자 프롬프트 7,459자(캡 3,000의 2.5배).

**결정**
1. 자르는 곳 = `conversation/prompts/talk.ts`(프롬프트 예산의 소유자). speech 는 후보 텍스트를 넘길 뿐 캡을 모른다(6층 경계) — 스키마·라우트 변경 없음. 현재 altText 를 넘기는 호출자는 없다(Phase 2 음성 P2 `requiresReview` 에서 연결 예정) — 연결하는 쪽은 원문 그대로 넘기면 된다.
2. `TALK_ALT_TEXT_MAX = 200`(발화 한 턴 분량) — 넘으면 앞 199자 + "…"(코드포인트 단위, 서러게이트 쌍 보존). 제어문자·연속 공백은 공백 하나로.
3. **예산 연동**: 상한과 별개로 `캡 − (헤더·지시문·발화·transcript 여유 120)` 로 한 번 더 자른다 — 지시문·헤더가 나중에 길어져도 캡 불변식이 유지된다. 남는 자리가 8자 미만이면 후보 줄을 **생략**하고 평소처럼 교정한다(잘린 후보로 되묻는 것은 혼란). 발화 원문은 자르지 않는다.
4. 결과(최악 조합: 헤더 상한·발화 1,000자·긴 이력): altText 201자·1,000자·5,000자·50,000자 전부 ≤3,000자. altText 없을 때 프롬프트는 바이트 그대로(예열 CLI·캐시 영향 없음).

**회귀 테스트**: `conversation/__tests__/prompts.test.ts` — ① 발화 길이 {1, 20, 500, 1,000} × altText {201, 1,000, 5,000, 50,000} 전 조합에서 `renderTranscript(...).length ≤ TALK_USER_PROMPT_CAP`·발화 원문 무손상·잘린 후보 ≤200자+"…" ② `clampAltText` 단위(그대로·정리·서러게이트·예산 부족 생략).
**남은 것**: altText 경로 라이브 실측(되묻기 응답 품질)은 호출자가 연결되는 Phase 2 음성 P2 때.

## 8. A4 레슨 신뢰도 보강(targetIds 결정적 보정) — 결정(2026-09-28, Leader)

**문제**: task-010 developer 서버 실측(주제 경로 3회)에서 1회 `FAILED` — `application`·`speaking` 의 `targetIds` 가 **입력 `topic.chunks` 에는 있지만 이번 응답 `chunks` 에는 없는 id** 를 가리켰다. lesson@v1 인계 때 prompt-engineer 가 이미 "재발 가능한 함정"으로 적어 둔 패턴이 그대로 재발한 것 — 프롬프트 문구만으로는 재발을 완전히 막지 못한다는 뜻이다.

**결정(Leader, ①+② 둘 다)**
1. **프롬프트 보강(`lesson@v2`)**: targetIds 규칙을 `chunks` 바로 뒤(더 앞)·더 짧게("**먼저 chunks·grammar 에 넣은 id 만** 쓴다")로 옮기고, reading 필드에 한자·로마자 금지 **예시**(「私は元気です。」·「watashi wa genki desu」는 틀림, 「わたしはげんきです。」가 맞음)를 추가했다.
2. **결정적 보정(`repairLessonResponse`, `conversation/structuredResponse/repair.ts`)**: `buildLessonRequest` 의 `extraCheck` 가 `checkLessonResponse` 보다 **먼저** 이 함수를 부른다. 규칙(상세는 `repair.ts` 파일 주석):
   - targetIds 가 가리키는 id 가 ① 입력 `topic.chunks`(프롬프트에 실은 것)에는 있고 ② 이번 응답 `chunks`·`grammar` 에는 없으면 "보정 대상". **입력에도 없는 id(환각)는 손대지 않는다.**
   - `chunks.length < 8` 이면 그 조각을 입력 데이터 그대로(`textJa`·`reading`·`meaningKo`·`chunkType`, `isNew:false`) 채워 넣는다. 캡·가나 패턴을 못 맞추면 채우지 않는다.
   - 못 채웠으면(이미 8개) 그 id 를 참조한 `targetIds` 에서 뺀다 — 단 빼서 빈 배열이 되면 그 occurrence 는 손대지 않는다(스키마 `minItems:1` 위반을 만들지 않기 위해서다).

**"AI 산출을 채택 없이 저장하지 않는다"(CLAUDE.md) 원칙과 충돌하지 않는 이유**: 이 보정이 채워 넣는 값은 전부 **이미 `TopicChunk` 테이블에 있고 이번 레슨 생성 프롬프트에 실제로 실었던** 조각 데이터다(`isNew:false` 로 출처를 응답에도 남긴다) — AI 가 새로 만들어 낸 내용이 아니다. AI 산출물(dialogue·grammar·quiz·application·speaking 의 문장·설명·정답)은 한 글자도 건드리지 않는다. 저장·채택 여부는 이 보정보다 훨씬 뒤(완료 트랜잭션)에서 정해지는 기존 흐름 그대로다 — 이 보정은 LLM 응답이 **JSON 계약을 지키는지** 보는 검증 단계에서 끝난다.

**엔진 참조 동일성(읽기 전용 확인, 엔진 코드 미수정)**: `extraCheck` 가 받는 `data` 는 `engine/json/schemaValidate.ts` `extractAndValidate` → `extractJson`(`JSON.parse`)이 만든 객체 그대로이고, `evaluateAttempt`가 `extraCheck(result.data)` 를 부른 뒤 그 `result`(= 같은 `data` 참조)를 그대로 돌려줘 `runJsonWithRetry` → `completeJson` → 호출자까지 이어진다. 중간에 복제(clone)·동결(freeze)하는 코드가 없다 — `src/modules/engine/**` 파일을 하나도 고치지 않고 in-place 보정만으로 최종 반환값을 고칠 수 있다.

**실측 1차(2026-09-28, `tests/live/lesson-measure.ts --runs-topic 5 --runs-source 2`, 총 7회)**: 6/7 성공.

| run | 성공 | ms | attempts | 위반 | dialogue | chunks(new) |
|---|---|---|---|---|---|---|
| topic#1 | OK | 65,731 | 2(1차 ajv 위반 `exampleUnused` 필드, targetIds 와 무관) | 0 | 9 | 8(0) |
| topic#2 | **FAILED** | 63,712 | 2(재시도도 실패) | - | - | - |
| topic#3 | OK | 72,647 | 2(보정 `removed=1`) | 0 | 10 | 8(0) |
| topic#4 | OK | 30,519 | 1(보정 `removed=1`) | 0 | 10 | 8(1) |
| topic#5 | OK | 34,867 | 1 | 0 | 8 | 8(0) |
| sourceText#1 | OK | 30,923 | 1 | 0 | 9 | 6(6) |
| sourceText#2 | OK | 35,172 | 1 | 0 | 10 | 8(8) |

**topic#2 FAILED 원인 분석(로그 재구성)**: 1차 응답에서 `repairLessonResponse` 가 `removed=3`(자리가 없어 뺀 것 3건)까지는 고쳤지만, 2건(`quiz[3]→chunk-07`, `quiz[4]→chunk-08`)은 **그 occurrence 의 `targetIds` 가 그 id 하나뿐**이라 규칙 3("빼서 빈 배열이 되면 보정하지 않는다")에 걸려 그대로 위반으로 남았다 → 재시도(2차 호출) 발생. 그런데 2차 응답에서 모델이 이 위반 문구("이 레슨의 chunks·grammar id 에 없다")를 "chunks 에 추가해서 고치자"로 해석해 `chunks` 를 8개보다 **더** 채워 보냈고, ajv 가 `maxItems:8` 위반으로 즉시 거부했다(마지막 시도라 재시도 없이 `JsonSchemaError`). 즉 **repair 자체는 정확히 의도대로 동작**했지만(뺄 수 있는 것은 빼고, 뺄 수 없는 것만 위반으로 남김), 그 "남은 위반"의 재시도 문구가 모델을 "8개 상한을 이미 채웠다"는 사실을 모른 채 잘못된 방향(추가)으로 유도했다.

**추가 조치(같은 실측 세션에서 즉시 반영)**: `checkLessonResponse` 의 targetIds 위반 문구에 `data.chunks.length` 를 보고 조건부 힌트를 덧붙였다 — 이미 8개(상한)면 "새로 추가하지 마세요, targetIds 에서 빼거나 다른 기존 id 로 바꾸세요"를 명시한다(`LESSON_CHUNKS_MAX` 상수를 `schemas.ts` 로 올려 `repair.ts`·`checks.ts` 가 공유). 재검증(같은 픽스처, 주제 경로 2회 추가):

| run | 성공 | ms | attempts | 비고 |
|---|---|---|---|---|
| topic#1(재검증) | OK | 31,234 | 1(보정 `removed=2`, 전부 다른 참조가 남아 있어 완전히 뺐다) | 위반 0 |
| topic#2(재검증) | OK | 53,431 | 2(1차 ajv 위반 `answerIndexNote` 필드, targetIds 와 무관) | 위반 0 |

2회 모두 성공. topic#2 는 재시도가 있었지만 원인이 targetIds 캐스케이드가 **아니라** 매번 다른 이유의 ajv 스키마 위반(스키마 밖 필드 `exampleUnused`/`answerIndexNote` — 모델이 가끔 설명용 필드를 덧붙이는 일반적인 이탈, targetIds 와 무관)이었다 — 힌트 보강 뒤 이 표본(2회)에서는 "8개 상한인데 추가하려는" 패턴이 재현되지 않았다. **1차(7회) + 재검증(2회) = 총 9회 중 8회 성공(88.9%)**, 유일한 실패(topic#2, 1차)는 힌트 보강 **이전** 실행이었다.

**결정**: 이 보정은 `structuredResponse`(prompt-engineer 소유) 안에서만 끝난다 — 엔진·라우트·learning 어디도 고치지 않았다. `LESSON_PROMPT_VERSION` 은 `lesson@v2`.

**회귀 테스트**: `conversation/__tests__/lesson.test.ts`(+7, 총 34건) — `repairLessonResponse` 채우기/8개 상한 제거/빈 배열 미보정/환각 id 미보정/같은 id 여러 occurrence 한 번만 채움, `buildLessonRequest.extraCheck` 통합(보정 뒤 위반 0 확인), `lesson@v2` 버전·id 규칙 위치·reading 금지 예시. 전체 회귀 565건(564 PASS·1 skip, 기존) 무관.

**남은 것**: `chunks` 8개 상한에 걸린 채 `targetIds` 도 단일 참조라 "뺄 수도 채울 수도 없는" 경우(위 topic#2 의 근본 원인)는 여전히 재시도에 의존한다 — 프롬프트 힌트를 강화했을 뿐 구조적으로 없앤 것은 아니다. 표본이 작아(추가 2회) 완전히 해소됐다고 단정하지 않는다. 만약 운영에서 이 실패가 다시 관측되면 다음 후보: ① `targetIds` 단일 참조를 뺄 때 완전히 비우는 대신 이미 응답에 있는 다른 유효 id(예: 첫 chunks 항목)로 **치환**하는 규칙 추가(Leader 승인 필요 — 현재 스펙은 "빈 배열이면 손대지 않는다"만 허용) ② `chunks` 개수 상한을 여유 있게(예: 10) 올리는 스키마 변경(developer/Leader 검토). → **②는 2026-09-28 Leader 2차 결정으로 "보정 전용" 범위에서 해소**(아래).

### 8-1. 후속 — 보정 전용 chunks 상한 10 (2026-09-28, Leader 2차 결정)

topic#2 FAILED 재현: repair 가 뺄 수 있는 것은 빼고 뺄 수 없는 2건만 위반으로 남겼는데, 재시도에서 모델이 그 위반을 "chunks 에 추가"로 해석해 8개 **초과**로 응답 → ajv `maxItems` 최종 실패. Leader 결정: **LLM 에게 알리는 스키마·프롬프트는 4~8 그대로 두고("모델은 8 까지만 안다"), 보정이 채워 넣을 때만** `LESSON_REPAIR_CHUNKS_MAX = 10`(`repair.ts`, `LESSON_CHUNKS_MAX` 와 분리)까지 허용 — 채우는 값이 AI 산출이 아니라 우리 `TopicChunk` 데이터라 원칙 충돌 없음(근거는 `repair.ts` 신규 상수 옆 주석), ajv 는 원본 파싱 직후(보정 전) 끝나 있어 보정이 만드는 9·10개짜리 배열은 다시 검증되지 않으므로 안전. `checkLessonResponse` 는 chunks 개수를 애초에 검사하지 않아 **변경 없이** ≤10 을 허용한다(확인만 함).

**서버 쪽 확인(읽기 전용, `src/modules/learning/lessons/**`)**: `chunks.length` 를 8 이하로 가정·제약하는 코드 없음(`generate.ts:174` 로그 usage 1건뿐, 제약 아님). 참고 1건: `learning/repetition/index.ts` `REPETITION_LESSON_ITEM_CAP=12` — `lessonRepetitionItems` 가 chunks(이제 ≤10)+grammar(≤3)=13 을 `.slice(0,12)` 로 자르므로 chunks 가 정확히 10 개인 극히 드문 경우 grammar 1건이 등록에서 빠질 수 있다(기존에도 "상한 12(조각 우선)"로 설계된 소프트 truncation이라 크래시·불변식 위반 아님) — 수정 불필요, developer/Leader 참고용.

## 9. A1 talk@v3 — 교정 방식(correctionMode) 예산 사고·severity 정확도 보강 (2026-09-28, task-010c)

### 9-1. 예산 — 헤더 한 줄만 더해도 v2 부터 있던 0마진 조합이 드러났다

`[교정] 유창성|코치` 헤더 한 줄(task-010c 1차)을 추가하자 특정 합성 조합(무거운 학습자 헤더 + `longHistory` + altText
**중간 길이** ≈60자)에서 3,000자 캡을 넘겼다. 원인은 새 문구 길이가 아니라 `buildTalkRequest` 의 이력 창 예산 계산
(`room = CAP − system.length − text.length − 40`)이 `renderTranscript` 가 나중에 붙이는 메시지당 라벨 접두(`[학습자] `/
`[선생님] `, ~7~9자)·블록 머리말 오버헤드를 40자로 과소 추정하고 있었기 때문이다 — **v2 원본을 그대로 재현해 확인한 결과
이 조합의 실제 마진은 이미 3자뿐**이었다(어떤 추가든 ≥4자면 넘긴다). 극단으로 긴 altText(5만자 등)가 아니라 **중간
길이**가 최악이었던 이유: altText·이력 창이 서로 다른 "양자화 단위"(이력은 메시지 ~240자 단위)로 남은 예산을 나눠
가지기 때문에, 중간 길이 조합이 오히려 마진이 더 좁을 수 있다 — 극단값 스윕만으로는 이런 최악 조합을 못 찾는다(재발
가능한 함정으로 기록). `talk.ts` 의 이 슬랙을 `WINDOW_ROOM_SLACK` 으로 이름 붙이고 40→140(1차)→220(2차, 아래 9-2
이후) 으로 올렸다. `prompts.test.ts` 의 예산 회귀 테스트가 altLen=60 을 반드시 포함하도록 고쳤다(빠지면 이 함정을
다시 놓친다).

### 9-2. severity 정확도 — 1차는 실패, Leader 후속 지시로 재설계

유창성 모드는 orchestrator 가 `severity` 로 즉시 표시(MAJOR)/모아두기(MINOR)를 가르므로(task-010c L2) severity 판정
정확도가 이 모드의 핵심 기능이다. **1차 릴리스**(persona §3-6 의 일반 기준만 믿고 stdin 쪽엔 아무 것도 안 넣음)를
`tests/live/talk-correction-mode-measure.ts`(e01~e03, 활용·문법·조사 오류로 뜻은 대체로 통함)로 실측한 결과 **3/3
전부 MAJOR** — 유창성 모드의 "MINOR 는 모아 둔다" 게이팅이 사실상 무력화됐다(예산 우선순위로 절충하고 넘어갔었다).

Leader 후속 지시(같은 날): 경계 사례 픽스처 ≥10문장(조사 3·활용 3·어휘 오선택 2·어순 1·정중함 1, 각 기대 severity)을
`tests/prompts/fixtures/talk-severity-boundary.json` 으로 새로 만들고, 유창성 모드로 실측해 일치율 ≥80% 를 확인하라는
지시였다.

**1차 시도(약한 문구, 실패)**: `[교정] 유창성 — 조사·활용·존댓말·어순처럼 뜻은 통하면 MINOR, 단어를 잘못 써서 뜻이
달라지거나 안 통하면 MAJOR`(62자, "if-then" 형태 서술). 경계 픽스처 10문장 실측 → **3/10(30%)** 일치. 조사 3건·활용
3건이 **전부 MAJOR** 로 나와(기대는 전부 MINOR) 1차 릴리스와 같은 패턴이 재현됐다 — haiku 는 "문법·조사가 틀렸다"는
사실 자체에 강하게 이끌려 severity 를 그 즉시 MAJOR 로 매기는 경향이 있고, 추상적인 "뜻이 통하면"이라는 조건문으로는
이 편향을 못 이긴다는 뜻이다.

**2차 시도(단정적 분류, 성공)**: `[교정] 유창성 — severity: 조사·활용·어순·존댓말 오류는 뜻이 통하니 **항상 MINOR**.
완전히 다른 단어를 써서 말이 안 되거나 뜻이 반대로 바뀔 때만 MAJOR.`(93자) — 조건문("~하면 MINOR")을 버리고 **오류
유형 자체를 직접 분류**(조사·활용·어순·존댓말 = 무조건 MINOR)하는 단정문으로 바꿨다. 재측정 결과 **10/10(100%)** 일치
(조사 3/3·활용 3/3·어순 1/1·정중함 1/1 전부 MINOR, 어휘 오선택 2/2 전부 MAJOR). `talk-correction-mode-measure.ts`
의 e01~e03 도 재측정 시 전부 MINOR 로 바뀌었다(1차 릴리스 때는 전부 MAJOR 였다) — 경계 픽스처 밖에서도 일반화됐다.
COACH 모드는 이 문구를 받지 않는다(severity 게이팅과 무관, e01~e03 COACH 재측정은 여전히 MAJOR — 의도한 그대로).

**교훈(재발 방지)**: 분류 판단을 LLM 에게 맡길 때 "조건이 참이면 이렇게 분류하라"(if-then) 보다 **"이 카테고리는
이렇게 분류한다"(카테고리 직접 나열)** 쪽이 haiku 같은 작은 모델의 강한 사전 편향(문법 오류=심각하다)을 이기는 데
더 효과적이었다 — 이번 사례는 정확히 8배 차이(30%→100%)였다. 예산이 빠듯한 지점에서 문구를 늘릴 때는 "예시를 더
넣기"보다 "조건문을 단정문으로 바꾸기"를 먼저 시도해 볼 가치가 있다.

**예산 재확인**: 93자 문구 반영 뒤 전 조합(light/heavy 학습자 × FLUENCY/COACH × 발화 1~1,000자 × altText 60~50,000자)
재측정 결과 최소 103자 마진(`WINDOW_ROOM_SLACK=220` 반영 후, 최악 조합은 heavy COACH text=1 alt=201로 FLUENCY 밖).

**실측 표(우분투, haiku, `tests/live/talk-severity-boundary-measure.ts`, 2026-09-28, 2차 문구)**:

| id | category | expected | actual | match | ms |
|---|---|---|---|---|---|
| b01 | PARTICLE | MINOR | MINOR | OK | 5,321 |
| b02 | PARTICLE | MINOR | MINOR | OK | 5,672 |
| b03 | PARTICLE | MINOR | MINOR | OK | 5,845 |
| b04 | CONJUGATION | MINOR | MINOR | OK | 5,175 |
| b05 | CONJUGATION | MINOR | MINOR | OK | 5,061 |
| b06 | CONJUGATION | MINOR | MINOR | OK | 5,023 |
| b07 | VOCABULARY | MAJOR | MAJOR | OK | 6,467 |
| b08 | VOCABULARY | MAJOR | MAJOR | OK | 6,780 |
| b09 | WORD_ORDER | MINOR | MINOR | OK | 5,096 |
| b10 | POLITENESS | MINOR | MINOR | OK | 5,251 |

10/10 일치(100%, 목표 80% 초과 달성), 재시도 0·위반 0, 전부 12s fail-fast 안(최대 6.8s).

**회귀 테스트**: `conversation/__tests__/prompts.test.ts` — `[교정] 유창성` 줄에 severity 기준 문구가 있는지(코치는
없는지), 예산 스윕에 altLen=60 포함(9-1). `talk@v3` 버전은 그대로 유지(아직 미배포). `structuredResponse` 무변경
(스키마·checks 는 1차 hintKo 작업에서만 손댔다, 이번 severity 보강은 `talk.ts` 안에서만 끝난다).

**실측(주제 경로 2회, Leader 지시)**: 둘 다 1차 시도 성공·위반 0. `topic#1` 은 실전에서 **보정이 실제로 8→10 으로 채우는 것**을 확인했다(`[lesson] repair — filled=2 removed=0`, `ms=31,322`, `chunks:10`). `topic#2` 는 보정 불필요(위반 없음, `ms=32,116`).

**회귀 테스트**: `lesson.test.ts` 기존 2건을 8→10(보정 전용 상한)로 갱신 + 신규 1건(8개 상태에서 2개 채워 10 도달 → 3번째는 제거, `filled:2, removed:1`) — 총 +8(35건). 전체 회귀 566건(565 PASS·1 skip) 무관.

## 9. A6·A7(평가) 실측·루브릭 조정 라운드(2026-09-28, prompt-engineer, [[task-011-ai-evaluation]])

**준비물**: `tests/live/eval-gen-measure.ts`(A6, WORDS 2회+TALK 2회 — 두 번째 호출은 첫 번째 결과의 해시를 `recentHashes` 로 넘겨 14일 중복 회피가 실전에서 재시도를 유발하는지까지 본다) · `tests/live/eval-grade-rubric-measure.ts`(A7, `tests/prompts/fixtures/eval-grade-rubric.json` 20건 — N5~N4 × LISTEN_RESPOND/SITUATION_RESPOND/CORRECTION_SPOT × {good·partial·wrong·empty·wrong_language} 조합, 각 `expectedScoreRange` 부여). 채점은 문항을 섞지 않고 **1건씩 고립된 A7 호출**로 돌린다(캘리브레이션 목적 — "이 답 하나에 이 점수가 합리적인가"를 보는 것이라 여러 항목을 한 번에 채점하는 실제 서비스 흐름과는 다르다, 실제 서비스 흐름 자체는 `evalGrade.test.ts` 의 다항목 합성 응답 테스트로 커버).

### 9-1. 1차 시도(20:00 KST) — Claude CLI 세션 한도(429)로 BLOCKED

`node --env-file=.env --import tsx tests/live/eval-gen-measure.ts` 4건 전부 2초 내 `ClaudeCliExecError: claude CLI 실패(exit=1): stderr 없음` 로 즉시 실패했다. 원인 확인을 위해 `claude` CLI 를 직접 호출한 결과 `"is_error":true,"api_error_status":429,"result":"You've hit your session limit · resets 8:20pm (Asia/Seoul)"` — 이 작업 세션이 쓰는 Claude 구독 자체가 한도에 걸려 있었다(시각 18:30 KST, 리셋 20:20 KST). 같은 조건에서 기존 `tests/live/word-enrich-measure.ts`(A10, 이번 task 와 무관한 기존 지점)도 동일하게 즉시 실패해, 환경 공통 이슈이지 evalGen/evalGrade 프롬프트·스키마 문제가 아님을 확인했다.

### 9-2. 재실측(20:22 KST, 한도 리셋 후) — A6

1차 실행(4건 중 2건 FAILED):

| run | 성공 | ms | attempts | 위반 | 재료비율 | 비고 |
|---|---|---|---|---|---|---|
| WORDS#1 | OK | 20,166 | 2 | 0 | 100% | 1차 응답에서 `items[7].prompt` 안에 `expected` 가 잘못 중첩 + `items/8,9` 의 `expected` 누락 — 재시도로 해결 |
| WORDS#2(dedup) | **FAILED** | 17,887 | - | - | - | 재시도 후에도 `items[0,1,2,4,5]` 가 WORDS#1 과 핵심(단어)이 겹침 |
| TALK#1 | OK | 11,647 | 1 | 0 | 100% | |
| TALK#2(dedup) | **FAILED** | 28,825 | - | - | - | 재시도 후에도 `items[0]` 이 TALK#1 과 겹침 |

**원인 분석 ①(CHUNK_CLASSIFY `expected` 누락)**: `WORDS#1`·`WORDS#2` 1차 응답 모두 마지막 두 문항(CHUNK_CLASSIFY)에서 `expected` 를 빠뜨렸다. 원래 계약은 `expected:{}`(빈 객체) — "정답이 없는 빈 객체를 일부러 채우라"는 요구가 부자연스러워 모델이 통째로 생략한 것으로 보인다(2회 중 2회 재현, 100%). **원인 분석 ②(14일 중복 회피 실패)**: 기존 위반 문구가 `items[N] 는 최근 14일 안에 이미 낸 것과 핵심 표현/문장이 같다`처럼 **어떤 단어인지 밝히지 않아서**, 재시도에서도 모델이 "오답이 많으니 우선 써야 한다"는 [재료] 지시를 그대로 따라 **같은 단어를 다시** 골랐다. 게다가 WORDS#2 는 1차 응답이 스키마 위반(①)으로 걸려 재시도 예산이 그 수정에 쓰이고 나서야 dedup 위반이 드러나(2차 응답에서 처음 검사됨) 교정 기회 자체가 없었다.

**조치(`evalGen@v1` → `evalGen@v2`, 라이브로 확인 후 즉시 반영)**:
1. `evalSchemas.ts` — CHUNK_CLASSIFY 의 `expected` 를 빈 객체 대신 `{chunkType}`(top-level 과 같은 값)으로 바꿈. 모델이 이미 정답을 자연스럽게 만들어 내는 필드(다른 kind 의 `expected.answer` 등)와 같은 패턴이라 생략 유인이 없다.
2. `evalChecks.ts` — 결정적 보정 `repairEvalGenChunkTypeSync` 신설: `expected.chunkType` 과 top-level `chunkType` 이 어긋나면(둘 다 같은 값이어야 정상) top-level 을 `expected` 기준으로 맞춘다(LLM 재호출 없음, `repairEvalGenWordLinks` 와 같은 원칙).
3. `evalChecks.ts` — 14일 중복 위반 문구에 **충돌한 실제 단어/문장을 그대로 인용**(`items[0]('注文')는 ... '注文'는 [재료]에서 오답이 많아도 이번에는 쓰지 말고 ...`)하도록 바꿔, 재시도에서 모델이 "그 값만 피하면 된다"는 걸 명확히 알게 했다.

**재측정(20:33 KST) — 4건 전부 성공**:

| run | 성공 | ms | attempts | 위반 | 재료비율 |
|---|---|---|---|---|---|
| WORDS#1 | OK | 11,744 | 1 | 0 | 100% |
| WORDS#2(dedup) | OK | 18,458 | 2 | 0 | 100%(1차에서 `注文·会計·席` 3건 충돌 → 재시도로 전부 다른 단어로 교체) |
| TALK#1 | OK | 12,831 | 1 | 0 | 100% |
| TALK#2(dedup) | OK | 19,763 | 2 | 0 | 100%(1차는 dedup 이 아니라 ASSEMBLE `order`/`pieces` 불일치로 재시도, 정상 회복) |

**요약**: n=4, 성공 4/4(100%), ms 12,000~19,800(재시도 없을 때 ~12,000·1회 재시도 시 ~18,500~19,800), attempts 1~2, 최종 위반 0, 재료 비율 항상 100%(≥60% 목표 크게 상회 — 작은 재료 풀(15개)+각 kind 별 1~4개뿐이라 자연히 전부 링크됨, 재료가 더 많아지는 실제 운영에서는 이보다 낮아질 수 있음). 프롬프트 길이(비최악 조합, 실측): WORDS 1,953자·TALK 2,208자(캡 4,500 대비 여유 큼).

### 9-3. 루브릭 조정 라운드 — A7, 20건

**1차(20:34 KST, `evalGrade@v1`)**: 20/20 성공(JSON 계약 위반 0), **범위내 18/20(90%)**.

| id | 종류 | 실제점수 | 기대범위 | 판정 |
|---|---|---|---|---|
| g05 | wrong_language(LISTEN_RESPOND) | 6 | [0,2] | ✗(한국어로 답했는데 의미 전달만 보고 후하게 줌) |
| g18 | partial(CORRECTION_SPOT) | 9 | [4,6] | ✗(틀린 곳만 짚고 고친 문장을 안 썼는데도 거의 만점) |
| 그 외 18건 | | | ✓ |

**원인**: ① 프롬프트에 "답이 일본어가 아니면 낮게 채점하라"는 지시가 없어 의미 전달만으로 후한 점수를 줌. ② CORRECTION_SPOT 의 채점 기준을 명시하지 않아 "틀린 곳 짚기"만으로 거의 만점을 줌(고친 문장 제시는 A7 이 스스로는 필수로 여기지 않음).

**조치(`evalGrade@v1` → `evalGrade@v2`)**: `evalGradeInstruction` 에 두 줄 추가 — "답이 일본어가 아니면(한국어·영어 등) 의미가 통하더라도 score 0~2" / "CORRECTION_SPOT 은 틀린 곳 짚기 + 고친 문장 제시 **둘 다** 있어야 완성, 고친 문장이 없으면 절반 이하(0~5)".

**재측정(20:36 KST, `evalGrade@v2`) — 범위내 19/20(95%)**:

| id | 종류 | 실제점수 | 기대범위 | 판정 |
|---|---|---|---|---|
| g05 | wrong_language | 1 | [0,2] | ✓(수정됨) |
| g18 | partial(CORRECTION_SPOT) | 5 | [4,6] | ✓(수정됨, feedback: "고친 문장을 함께 제시하지 않아 완성도가 부족합니다") |
| g10 | good(SITUATION_RESPOND) | 7 | [8,10] | ✗(경계 1점 미달) |
| 그 외 17건 | | | ✓ |

**g10 잔여 편차 분석**: `answerText` 가 **픽스처 자체의 `modelAnswerJa`(「いいえ、大丈夫です。」)와 동일한 문자열**인데도 7점(A7 은 "무엇이 필요 없는지(袋)를 명시하지 않아 상황 설명이 조금 부족"이라 채점) — 모델 답 자체를 8~10 범위로 기대한 **픽스처 설계가 다소 낙관적**이었다(실제 원어민도 구체성을 지적할 수 있는 지점이라 A7 의 판단 자체가 불합리하지 않음). 20건 중 1건(5%)·경계 1점 차이라 **추가 프롬프트 변경은 하지 않는다**(더 손대면 20건짜리 합성 셋에 과적합할 위험 — 이 정도 편차는 실사용 QA 로 계속 지켜볼 항목으로 남긴다).

**요약**: n=20, JSON 계약 위반 0/20(0%), 지연 4.5~7.9s(대부분 5~6s, 120s 예산 대비 여유 큼), 프롬프트 길이(1문항 기준) 2,060~2,300자(캡 8,000 대비 여유 큼 — 서비스에서는 최대 5문항을 한 번에 보내므로 `evalGrade.test.ts` 의 5문항 최악 조합 예산 테스트가 실제 상한 케이스에 더 가깝다). 최종 범위내 19/20(95%).

**회귀 테스트**: `evalGen.test.ts`(+2, CHUNK_CLASSIFY `expected` 형태 갱신 + `repairEvalGenChunkTypeSync` 신규 2건) — 총 37건, `evalGrade.test.ts` 영향 없음(문구만 추가). 전체 회귀 662건(661 PASS·1 skip) 무관. `PROMPT_VERSION` 은 `evalGen@v2`·`evalGrade@v2`.

**재발 가능한 함정(추가)**: ③ **"빈 객체를 채우라"는 요구는 피한다** — LLM 은 정답이 없어 보이는 필드를 통째로 생략하는 경향이 있다(CHUNK_CLASSIFY `expected:{}` 사례). 정답이 다른 곳(top-level)에 이미 있어도 그 필드에 **같은 값을 자연스럽게 복제**해 채우게 하는 편이 생략 확률을 크게 낮춘다 — 대신 두 값이 어긋날 수 있으니 결정적 보정(동기화)으로 신뢰성을 확보한다(`repairEvalGenChunkTypeSync`). ④ 채점 프롬프트가 "무엇을 더 중요하게 볼지"(언어 자체가 틀렸을 때의 감점 폭, 부분 답의 완성 기준)를 명시하지 않으면 모델은 "의도가 전달됐는가"에 후하게 기운다 — 채점 기준의 **엄격도를 구체적 예시로 명시**해야 한다.

## 10. A4 화면 E2E 결함 2건 — reading 가타카나 허용·모범 답 콘텐츠 매칭 (2026-09-28, Leader, `lesson@v3`)

(번호가 §9 와 겹친다 — 같은 시각 다른 task(task-010c·task-011)가 이미 §9 를 두 번 썼다. 이 절은 task-010 전용이다.)

**문제(developer 화면 E2E, "21:02 developer — 화면(완료)" 절)**:
1. **HIGH**: sourceText 경로 8회 중 4회 FAILED. 1차 응답 6/8 이 `dialogue[].reading`·`grammar[].exampleReading` 에 외래어(カフェ·ホットコーヒー·抹茶ラテ 등)를 **가타카나로 그대로** 적어 `KANA_READING_PATTERN`(히라가나만) 위반 — 정작 그게 **맞는 표기**라 규칙 자체가 틀렸다.
2. **MEDIUM**: 스모크 1회에서 `speaking[0].modelAnswerJa` 가 자기 `targetIds`(コーヒー·ケーキ)의 표현을 **어느 쪽도 담지 않아** 화면에 "아직 안 쓴 표현"이 떴다.

**결정 1 — reading 필드 히라가나+가타카나 허용**: LESSON 의 reading 5개 필드(`dialogue.reading`·`chunks.reading`·`grammar.exampleReading`·`application.modelReading`·`speaking.modelReading`) 전용 `LESSON_READING_PATTERN`(`schemas.ts`, `぀-ヿ` 한 범위 — 히라가나+가타카나+ー+・ 전부 포함 + 최소 문장부호) 을 새로 만들어 이 5곳에만 적용했다. **공유 상수 `KANA_READING_PATTERN` 은 바꾸지 않았다** — A6/A7(`evalSchemas.ts`, 이 세션에 §9 를 쓴 다른 prompt-engineer 가 동시에 작업 중)의 `READING_INPUT` 등이 같은 상수를 써서, 값을 바꾸면 그쪽 계약이 조용히 달라지기 때문이다(교차 확인 결과: `evalSchemas.ts` 는 `LESSON_READING_PATTERN` 을 쓰지 않으므로 이번 변경의 영향을 받지 않는다). 프롬프트(`lessonInstruction`)도 "가나(히라가나 또는 가타카나)로만, 외래어는 가타카나 그대로(「コーヒー」), 억지로 히라가나로 바꾸지 말 것"으로 고쳤다.

**결정 2 — 모범 답 콘텐츠 매칭(결정적 보정 + 검사)**: `checkLessonResponse` 에 application·speaking 의 `modelAnswerJa` 가 자기 `targetIds`(chunk 만, grammar 는 대상 아님)의 `textJa`·`reading` 을 담고 있는지 보는 검사를 추가하고, `repairLessonResponse` 에 못 담은 chunk id 를 targetIds 에서 빼는 보정(④)을 추가했다(기존 ①~③ 뒤에 실행, 빼서 빈 배열이 되면 손대지 않고 위반으로 남겨 재시도). 정규화(NFKC → 가타카나→히라가나 → 소문자 → 공백·구두점 제거)는 서버 `learning/lessons/matching.ts` 의 `normalizeForMatch`/`kataToHira` 와 **정규식을 문자 단위로 그대로 복사**했지만 그 파일을 **import 하지 않는다**(module-dependency §3-1, conversation(L2) 은 learning(L3) 을 import 하지 않는다 — eslint `no-restricted-imports` 로도 막혀 있다, 신규 `structuredResponse/matching.ts`). 학습자 자유 발화용 활용형 어간 근사·정중형 어미 제거(서버의 `chunkForms`/`cores`)는 재현하지 않는다(Leader 지시 범위 = "공백·구두점 제거·가타카나→히라가나"까지, AI 가 스스로 만든 정돈된 모범 답이 대상이라 그 정도로 충분하다고 판단).

**동치성 고정**: `__tests__/lessonMatching.test.ts` — 서버 `learning/__tests__/task010.test.ts` 가 이미 검증한 `kataToHira('コーヒー')→'こーひー'`·`normalizeForMatch(' ｺｰﾋｰ を、ください。 ')→'こーひーをください'`·`normalizeForMatch('〜てください！')→'てください'` 와 **같은 입력·같은 기대값**을 내 쪽 구현에도 돌려 확인(두 파일이 정규식을 각자 손대면 이 골든 케이스가 갈라지는 것으로 드러난다).

**서버 쪽 확인(읽기 전용, `src/modules/learning/lessons/**`)**: `matching.ts` 를 다시 읽어 정규화 규칙(NFKC·`kataToHira`·`STRIP`)을 정확히 옮겼는지만 확인했고, 다른 서버 코드를 고칠 필요는 없었다(이번 결정은 전부 `conversation/structuredResponse` 안에서 끝난다).

**실측(2026-09-28, `tests/live/lesson-measure.ts --runs-topic 3 --runs-source 5`, 총 8회, Leader 목표 8/8)**:

| run | 성공 | ms | attempts | 위반 | chunks(new) | 비고 |
|---|---|---|---|---|---|---|
| topic#1 | OK | 32,526 | 1 | 0 | 10(0) | 보정 filled=2 |
| topic#2 | OK | 30,685 | 1 | 0 | 10(0) | 보정 filled=2 removed=2 |
| topic#3 | OK | 54,164 | 2 | 0 | 9(1) | 1차 ajv 위반(quiz.choices 중복, 이번 결정과 무관) → 재시도로 회복, 보정 filled=1 |
| sourceText#1 | OK | 33,262 | 1 | 0 | 6(6) | 보정 contentMismatchRemoved=1 |
| sourceText#2 | OK | 36,181 | 1 | 0 | 7(7) | 보정 contentMismatchRemoved=5 |
| sourceText#3 | OK | 34,584 | 1 | 0 | 8(8) | 보정 contentMismatchRemoved=2 |
| sourceText#4 | OK | 55,442 | 2 | 0 | 8(8) | 1차 ajv 위반(quiz 5개 미만, 이번 결정과 무관) → 재시도로 회복, 보정 contentMismatchRemoved=3 |
| sourceText#5 | OK | 33,366 | 1 | 0 | 6(6) | 보정 contentMismatchRemoved=3 |

**8/8 성공(100%, 목표 달성)**. reading 가나 패턴 위반 **0건**(8회 전부 — v2 실측에서 sourceText 8회 중 6회가 이 원인으로 위반했던 것과 대조적). `contentMismatchRemoved` 가 sourceText 5회 전부에서 발생(1~5건씩, 합계 14건) — 붙여넣기 경로는 원문에서 뽑은 표현이 많아(사전에 없던 새 chunk, `isNew:true`) 모범 답과 어긋나는 사례가 실제로 잦다는 뜻이고, 이 보정이 없었다면 훨씬 더 많은 재시도·실패가 났을 것으로 보인다(v2 실측·개발 스모크에서 관찰된 것과 같은 방향). 남은 재시도 2건은 이번 두 결정과 무관한 별개의 ajv 위반(quiz 중복 선택지·quiz 5개 미만)이었고 둘 다 1회 재시도로 정상 회복했다.

**회귀 테스트**: `lesson.test.ts`(기존 테스트 중 `validLessonResponse` 의 `speaking` 3개를 자기 targetIds 표현을 실제로 담게 재작성 + reading 패턴 테스트를 가타카나 허용/한글 금지로 갱신 + `LessonRepairResult` 에 `contentMismatchRemoved` 필드 추가로 기존 `assert.deepEqual` 6건 갱신 + 신규 3건: 모범 답 불일치 제거·빼면 빈 배열이라 미보정 후 위반·grammar targetId 는 대상 아님, 총 38건) + 신규 `lessonMatching.test.ts`(7건: 골든 케이스 3 + `chunkAppearsIn` 4) = LESSON 관련 45건 전부 PASS. 전체 회귀 687건(686 PASS·1 skip, 기존) 무관. `LESSON_PROMPT_VERSION` 은 `lesson@v2`→`lesson@v3`.

**재발 가능한 함정(추가)**: ⑤ **"○○만 써라"는 규칙은 실제 도메인 데이터를 먼저 확인하고 정한다** — reading 을 "히라가나만"으로 못박은 것은 A10 `WORD_ENRICH_READING_RE`(단어 하나의 사전적 읽기)를 그대로 따온 것이었는데, LESSON 의 reading 은 **문장·대화**의 읽기라 외래어가 자연스럽게 섞이고, 그 경우 가타카나 표기가 오히려 정답이다 — 같은 "읽기" 개념이라도 **단어 단위와 문장 단위는 다른 규칙이 필요할 수 있다**. ⑥ 모범 답(AI 가 스스로 만든 예시 문장)이 자기 자신이 가리키는 목표를 실제로 담는지는 **스키마·존재 검증만으로는 잡히지 않는다** — "id 가 있다"와 "내용이 그 id 를 반영한다"는 별개의 계약이고, 후자는 도메인 특화 정규화(이 경우 서버의 표현 매칭 규칙)를 목적별로 가볍게 복제해서라도 봐야 한다.


## 10. evalGen@v3 — TALK 출제 modelReading 가타카나 허용(2026-09-28, prompt-engineer, Leader 지시, [[task-011-ai-evaluation]])

**문제**: developer 스모크에서 A6 TALK 출제가 4회 중 3회 재시도·1회 완전 FAILED. 원인은 `LISTEN_RESPOND`·`SITUATION_RESPOND` 의 `expected.modelReading`(모범 답 **문장 전체**의 읽기)이 `KANA_READING_PATTERN`(히라가나만)이라, 모범 답에 외래어(コーヒー 등)가 있으면 자연스러운 표기(가타카나)를 그대로 써서 위반이 났다 — task-010 `lesson@v3`(§8-1 윗절, `LESSON_READING_PATTERN` 신설)과 **원인·해법이 완전히 동일**하다.

**결정**: `evalSchemas.ts` 에 평가 전용 상수 `EVAL_SENTENCE_READING_PATTERN`(히라가나+가타카나+장음+최소 문장부호, `LESSON_READING_PATTERN` 과 같은 문자 범위)을 신설하고 `LISTEN_RESPOND`·`SITUATION_RESPOND` 의 `expected.modelReading` 에만 적용했다. **`KANA_READING_PATTERN`(schemas.ts) 은 바꾸지 않았다** — 다른 prompt-engineer 가 A11/talk@v3 로 같은 상수를 쓰고 있어 값을 바꾸면 그쪽 계약이 조용히 달라진다.

**READING_INPUT(`expected.reading`/`accepted`, 단어 하나의 읽기 문항)는 그대로 히라가나만 유지** — 판단 근거(`evalSchemas.ts` 해당 상수 옆 주석에도 동일 기록):
1. A10(`WORD_ENRICH_READING_RE`)이 이미 "가타카나 외래어도 읽는 대로 히라가나로 적는다"를 검증된 규칙으로 강제하고 있다(실측·회귀 테스트로 확인됨).
2. READING_INPUT 은 "이 단어를 어떻게 읽는가"를 묻는 **읽기 능력 평가 문항** — surface 가 가타카나(サイズ)여도 정답은 관례상 언제나 히라가나(さいず)이고, 가타카나 원표기를 정답으로 받아들이면 "읽기를 물은" 목적 자체가 사라진다. LESSON 의 `modelReading`/`chunks.reading`·evalGen 의 `modelReading` 은 TTS·후리가나 표시용 참고 정보(채점 대상 아님)라 목적이 다르다.
3. 관찰된 실패도 modelReading 에서만 났다(READING_INPUT 위반은 관찰된 적 없음) — 문제가 없는 곳을 넓히면 "정답이 가타카나 그대로여도 됨"을 학습자에게 잘못 보여줄 위험만 커진다.

대신 `prompts/evalGen.ts` 지시문에 A10 과 같은 문구("surface 가 가타카나 외래어여도 reading·accepted 는 항상 히라가나로")를 명시해 위반 자체를 줄였다.

**실측(`tests/live/eval-gen-katakana-measure.ts`, TALK 4회+WORDS 1회, 독립 호출)**:

| run | 성공 | ms | attempts | 위반 |
|---|---|---|---|---|
| TALK#1 | OK | 29,254 | 2(1차 `JSON 파싱 실패` — reading 패턴과 무관한 일반적 이탈, 재시도로 해결) | 0 |
| TALK#2 | OK | 12,068 | 1 | 0 |
| TALK#3 | OK | 11,046 | 1 | 0 |
| TALK#4 | OK | 12,658 | 1 | 0 |
| WORDS#1 | OK | 10,030 | 1 | 0 |

**TALK 4/4 성공(목표 달성), reading 패턴 위반 0/5.** TALK#1 의 재시도는 원인이 JSON 파싱 실패(모델이 코드펜스·잡담을 섞는 등 일반적 이탈)였지 modelReading 패턴 위반이 아니었다 — 이번 수정으로 그 실패 유형은 관측되지 않았다.

**회귀 테스트**: `evalGen.test.ts` +3(modelReading 가타카나 허용 스키마 통과 2건 + 한자/로마자/한글 여전히 금지 1건 + READING_INPUT 히라가나 유지 확인 1건 — 실제로는 신규 3개 test 블록) → 26건(기존 23+3). 전체 회귀 706건(705 PASS·1 skip) 무관. `EVAL_GEN_PROMPT_VERSION` 을 `evalGen@v2`→`evalGen@v3` 로 올림.

**재발 가능한 함정(추가)**: ⑦ "읽기(reading)" 필드는 전부 같은 규칙을 쓰면 안 된다 — **단어 하나의 읽기**(사전적·평가 대상)는 항상 히라가나, **문장 전체의 읽기**(TTS·후리가나 참고용)는 외래어 자연스러운 표기(가타카나)를 허용하는 것이 맞다. 새 reading 필드를 추가할 때는 먼저 "이 필드가 무엇을 평가/표시하는가"부터 분류하고 패턴을 고른다(⑤ 의 연장 — LESSON 에서 한 번, 이번에 다시 한번 같은 함정이 재현됐다. 세 번째부터는 기본값을 "문장=느슨, 단어=엄격"으로 시작할 것).

## 11. A4 붙여넣기 신뢰도 — 운영 11b 후속 진단(2026-09-28, prompt-engineer, [[task-010-today-lesson]])

**배경**: 2026-09-28 22:38 운영 배포(sha 67771a5) 뒤 3010 스모크 11b(붙여넣기 레슨 READY)가 재시도 2회 뒤에도 FAILED(64s). QA 회차에서도 같은 11b 가 1회 실패한 적이 있었다(REV-030 절 "QA 11b 1회 실패는 재현 안 됨" — 당시엔 원인 미상으로 운영 관찰 항목으로 남겨 뒀다). `AiJob.error` 에는 실패 사유가 코드로만 남고(스모크가 끝에 행을 지움) 어느 검사에 걸렸는지는 기록이 없어, 이번에 운영 스모크와 바이트 단일 원문으로 직접 재현했다.

### 11-1. 1차 진단 — 원인은 reading pattern, 「」 인용부호 누락(lesson@v4)

`tests/live/lesson-paste-diagnose.ts`(신규, `buildLessonRequest.extraCheck` 를 감싸 시도마다 위반을 기록) 로 운영 스모크 원문(`tests/live/task010-smoke.ts:388` 의 `src`, 「ご注文はお決まりですか」대화체 인용 포함)을 **8회** 재현:

| run | 결과 | 위반 |
|---|---|---|
| paste#1 | FAILED | dialogue[2].reading·application[0].modelReading·speaking[0].modelReading pattern |
| paste#2 | OK | - |
| paste#3 | FAILED | grammar[0].exampleReading·speaking[0].modelReading pattern |
| paste#4 | FAILED | grammar[1].exampleReading·speaking[2].modelReading pattern(1차는 JSON 파싱 실패) |
| paste#5 | OK | - |
| paste#6 | FAILED | dialogue[2].reading·grammar[0].exampleReading·application[0]·speaking[0] pattern |
| paste#7 | FAILED | application[1].modelReading pattern |
| paste#8 | OK(재시도) | 1차 콘텐츠 매칭(④) 위반 → 재시도로 회복 |

**5/8 실패, 전부 `LESSON_READING_PATTERN`(lesson@v3, 히라가나+가타카나 `぀-ヿ`) 위반**. `tests/live/lesson-paste-raw-capture.ts`(신규, `JsonSchemaError.raw` 를 `extractJson` 으로 역파싱해 reading 필드를 문자 단위로 재검사)로 실패 원문 하나를 확보 — `dialogue[2].reading = "てんいんさんに「ごちゅうもんはおきまりですか」ときかれて、…"` 에서 오펜더가 정확히 `「`(U+300C)·`」`(U+300D) 두 글자였다. 원문에 대화체 인용이 있으면 모델은 reading 에도 그 인용부호를 자연스럽게 남기는데(、。！？를 이미 보존하는 것과 같은 이유), 그 두 글자가 히라가나·가타카나 블록(U+3040~30FF)이 아니라 "CJK 기호·문장부호" 블록(U+3000~303F)에 있어 스키마가 거부했다 — **모델 행동은 맞았고 스키마가 좁았던 경우**.

**조치**: `schemas.ts` 의 `LESSON_READING_PATTERN` 에 「」『』(U+300C~300F)를 추가(`lesson@v4`). 프롬프트 지시문(`lessonInstruction`)은 바꾸지 않았다 — 모델을 다른 방향으로 유도할 이유가 없었다(v3 의 가타카나 사례와 달리 이번은 검증이 틀렸을 뿐).

**재측정(같은 원문 8회 + 주제 2회, lesson@v4)**: reading pattern 위반 **0/17**(전 attempt 합계) — 완전히 사라짐. 9/10 성공(1/8 은 다른 이유로 잔존, 아래 11-2).

### 11-2. 2차 진단 — 잔존 실패는 콘텐츠 매칭(④), 모델에게 규칙을 알려준 적이 없었다(lesson@v5)

v4 재측정에서 드러난 유일한 잔존 실패 유형은 `checkLessonResponse`④(v3 에서 추가된 "modelAnswerJa 가 자기 targetIds 의 chunk 표현을 담고 있는지" 검사) — `repairLessonResponse`④ 가 이미 "다른 참조가 남아 있으면 빼고, 유일한 참조면 손대지 않는다"로 최대한 보정한 뒤에도 남는, **단일 참조라 뺄 수 없는** 경우다. 원인 확인: `lessonInstruction` 어디에도 "modelAnswerJa 가 targetIds 의 표현을 실제로 담아야 한다"는 지시가 없었다 — v3 는 검사·보정만 만들고 지시문에는 대응 문구를 빠뜨렸다.

**조치**: `lessonInstruction` 의 id 규칙 바로 뒤에 "모범 답 내용 규칙"을 신설(`lesson@v5`) — chunk targetIds 는 문장 안에 실제로 써야 하고, grammar targetIds 는 문형을 살린 자연스러운 문장이면 충분하다고 명시(matching.ts·checks.ts 의 grammar 예외와 일치).

**재측정(같은 원문 8회 + 주제 2회, lesson@v5)**: 9/10 성공. 1차 시도의 콘텐츠 매칭 위반 발생률이 3/8(v4 재측정) → 2/8(v5 재측정)로 낮아졌으나(표본이 작아 통계적으로 확정은 아니다), **1/8 은 재시도까지 다 쓰고도 같은 이유(단일 참조)로 최종 FAILED** — 지시문만으로는 0% 를 보장하지 못했다.

### 11-3. 3차 조치 — 데이터 무결성과 콘텐츠 품질을 분리, 재시도 소진 시에만 후자를 눈감는다(lesson@v6)

④는 "존재하지 않는 id 를 가리킨다"(①~③, 데이터 무결성)와 성격이 다르다 — "실재하는 chunk 를 가리키긴 하는데 모범 답이 그 표현을 완벽히 보여주지 못한다"는 **콘텐츠 품질** 문제다. 단일 참조라 repair 가 뺄 수 없는 극히 드문 잔여 사례까지 매번 레슨 전체를 잃는 것은 과한 대가라고 판단해:

- `checks.ts` `checkLessonResponse` 에 `tolerateContentMismatch?: boolean` 옵션 추가 — true 면 ④(콘텐츠 매칭)만 건너뛰고 ①~③·한글 혼입·엔진명 노출은 그대로 강제한다.
- `lesson.ts` `buildLessonRequest` 의 `extraCheck` 가 클로저 카운터(`extraCheckAttempt`)로 "이 extraCheck 가 몇 번째로 불렸는가"를 세어, **`engine.llm.completeJson`(`runJsonWithRetry`) 이 허용하는 최대 시도(2, 1차+재시도 1회 고정)에 도달했을 때만** `tolerateContentMismatch:true` 를 준다. 1차에는 그대로 강제해 재시도가 깨끗이 고칠 기회를 준다.
- **알려진 한계(정직하게 기록)**: 이 카운터는 "extraCheck 가 불린 횟수"이지 "몇 번째 LLM 원문 호출인가"가 아니다 — 1차 원문이 ajv(파싱·스키마) 단계에서 걸리면 extraCheck 자체가 안 불려 카운터가 늘지 않는다. 그래서 "1차가 ajv 로 걸리고 2차가 콘텐츠 매칭만 남는" 드문 겹침에서는 관대하게 봐주지 못하고 그대로 실패할 수 있다 — 기존 동작과 같아 **퇴보는 아니다**, 다만 그 경우까지 완전히 덮지는 못한다. 관측된 실패 표본(11-1·11-2 전부)은 모두 "1차·2차 모두 ajv 통과 + 콘텐츠 매칭만 위반"이라 이 카운터로 충분히 잡힌다.

**검증 방식(라이브 호출 대신 단위 테스트로 직접 확인)** — `lesson.test.ts` 에 `req.extraCheck!` 를 같은 위반 데이터로 두 번 호출해 1차는 위반, 2차는 눈감음을 직접 검증하는 테스트 2건(콘텐츠 매칭 눈감음 / id 존재 위반은 2차에도 그대로) + `checkLessonResponse` 옵션 자체를 검증하는 테스트 1건을 추가했다(총 45건 PASS, 전체 회귀 713건 중 712 PASS·1 skip 무관, `tsc`·`eslint` 클린).

**라이브 재검증 미완료 — Claude CLI 세션 한도**: lesson@v6 의 라이브 재측정(같은 원문 8회 + 주제 2회)을 시도했으나 **10/10 이 시작 2초 안에 `ClaudeCliExecError`(exit=1)로 즉시 실패**했다 — 직접 `claude --print` 로 확인한 결과 `"You've hit your session limit · resets 1:20am (Asia/Seoul)"`(§9-1 과 같은 종류의 환경 제약, 이 세션이 쓰는 구독이 한도에 걸렸다 — 프롬프트·스키마 문제가 아니다). 세션 한도가 풀린 뒤 재측정 필요(목표: 붙여넣기 8/8, 다음 세션 또는 QA 가 이어서). lesson@v6 의 로직 자체는 위 단위 테스트로 확인됐지만, **실제 LLM 응답에서 이 경로가 기대대로 발동하는지는 아직 라이브로 확인되지 않았다** — 이 문서를 읽는 다음 세션은 이 절을 먼저 확인할 것.

### 11-4. 버전 요약

`LESSON_PROMPT_VERSION`: `lesson@v3`(운영 배포분, 11b 실패 원인) → `lesson@v4`(reading pattern에 「」『』 추가, 스키마만) → `lesson@v5`(모범 답 내용 규칙 지시문 추가) → `lesson@v6`(콘텐츠 매칭 눈감음, 재시도 소진 시에만). 변경 파일: `src/modules/conversation/structuredResponse/schemas.ts`(`LESSON_READING_PATTERN`) · `src/modules/conversation/structuredResponse/checks.ts`(`LessonCheckContext.tolerateContentMismatch`) · `src/modules/conversation/prompts/lesson.ts`(지시문·extraCheck 카운터) · `src/modules/conversation/__tests__/lesson.test.ts`(+13건, 32→45) · 신규 `tests/live/lesson-paste-diagnose.ts`·`tests/live/lesson-paste-raw-capture.ts`.

**developer 제안(코드 변경 없음, 관측 개선 사양만)**: 지금 `AiJob.error` 에는 실패 코드만 남아(예: `ENGINE_ERROR`) 어느 검사에 걸렸는지 사후에 알 방법이 없다(이번 진단도 별도 라이브 스크립트로 원문을 다시 뽑아야 했다). `checkLessonResponse`/스키마 위반의 **검사 코드만**(원문·학습자 텍스트는 절대 없이) `AiJob.error` 에 `LLM_INVALID:<checkCode>` 형태로 남기면(예: `LLM_INVALID:READING_PATTERN`·`LLM_INVALID:CONTENT_MATCH`·`LLM_INVALID:TARGET_ID`) 다음에 비슷한 잔존 실패가 나올 때 스모크 로그만으로 원인을 바로 좁힐 수 있다. `checks.ts` 위반 문구는 현재 자유 텍스트라 코드화하려면 각 위반에 짧은 상수 코드를 붙이는 작은 리팩터가 필요하다 — developer·Leader 판단.

**재발 가능한 함정(추가)**: ⑧ 검사(`checks.ts`)와 보정(`repair.ts`)을 먼저 만들고 그에 대응하는 **지시문을 프롬프트에 빠뜨리는** 패턴이 이번에도 재현됐다(v3 가 ④ 검사·보정을 만들 때 지시문을 안 붙였다가 v5 에서 뒤늦게 채움) — 새 후검증 규칙을 추가할 때는 "이 규칙을 모델이 프롬프트만 보고 알 수 있는가"를 체크리스트로 넣을 것. ⑨ 데이터 무결성(존재하지 않는 참조)과 콘텐츠 품질(존재는 하지만 완벽히 안 담김)은 **다른 심각도**로 다뤄야 한다 — 전자는 항상 강제하되, 후자는 재시도까지 소진한 뒤라면 "완벽하지 않은 결과라도 살리는" 게 "아무것도 못 주는" 것보다 나을 수 있다(이번 lesson@v6 의 tolerateContentMismatch 가 그 사례). ⑩ 라이브 실측 스크립트를 여러 라운드(진단·1차 수정·2차 수정·3차 수정) 연속으로 돌리면 Claude CLI 구독 세션 한도(§9-1 과 동일 계열)에 걸릴 수 있다 — 한 세션에서 재측정을 몇 차례나 돌릴지 미리 예산을 잡고, 한도에 걸리면 "재시도"가 아니라 "다음 세션/시간대로 이월"이 맞는 대응이다.

## 12. A4 스키마 밖 필드(quiz[] 의 q·conjugationNote 등) — ajv 전 결정적 제거(2026-09-29, prompt-engineer, [[task-010-today-lesson]])

**배경**: lesson@v6 운영 반영(§11) 뒤 라이브 재검증(Leader 01:50 절)에서 새 재시도 원인이 드러났다 — 1차 응답의 `quiz[]` 항목에 스키마 밖 필드(`q`·`conjugationNote`)가 붙어 ajv `additionalProperties` 위반 → 재시도(+약 30s, 한 번은 재시도 중 149s 상한 초과로 FAILED). §11 의 콘텐츠 매칭(④)·reading pattern 과는 **다른 계층**의 문제다 — 그 둘은 ajv 통과 **후** `extraCheck`(repair→check)가 잡는 것이고, 이번은 ajv **자체**가 거부해 `repairLessonResponse` 가 관여할 기회조차 없었다.

**원인 확인**: 검증 순서는 `extractJson`(파싱) → ajv(`validateOutput`) → (통과 시에만) `extraCheck`. 라이브로 확보한 1차 원문에서 스키마 밖 키는 **필수 필드가 전부 채워진 뒤에 덧붙은 것**이었다(예: quiz 항목에 `promptKo`·`promptJa`·`choices`·`answer`·`targetIds`·`explanationKo` 가 다 있고 그 위에 `q`·`conjugationNote` 가 얹힘) — 이름을 바꿔치기한 사례(필수 필드 자리를 비우고 그 자리에 다른 이름을 쓴 경우)는 관측되지 않았다. "결정적으로 지워도 안전한" 전제(필수 필드가 이미 다 있음)를 실제로 만족한다.

**조치(결정적, LESSON 한정)**: `engine/json/schemaValidate.ts` 에 `enableAdditionalPropertiesStrip(schema)`(WeakSet 등록) 신설 — 등록된 스키마에 한해 `extractAndValidate` 가 ajv 호출 **직전**에 스키마 트리를 따라가며 `additionalProperties:false` 이고 `properties` 에 없는 키만 in-place 로 지운다. required 키는 항상 `properties` 에도 있어 "추가" 취급되지 않으므로 원천적으로 안 건드리고, 이름이 바뀐 경우는 그 필수 필드 자리가 여전히 비어 있어 ajv 가 그대로 잡아 지금처럼 재시도한다(추측 매핑 없음). `schemas.ts` 에서 `LESSON_SCHEMA` **하나만** 등록했다 — 순수 `validateOutput`(ajv 만, `engine/index.ts` 의 `validateAgainstSchema`)과 TALK·CHAT·WORD_ENRICH·CHAT_REVIEW·EVAL_GEN·EVAL_GRADE 는 손대지 않아 동작이 전혀 바뀌지 않는다(회귀 테스트로 TALK_SCHEMA 를 직접 대조). `lessonInstruction` 끝에 "정해진 키만 씁니다" 한 줄도 보조로 추가(+151자, 예산 9,500자 안에서 흡수) — 핵심 방어는 결정적 제거이고 이 줄은 발생률을 낮추는 보조 수단이다. `LESSON_PROMPT_VERSION`: `lesson@v6` → `lesson@v7`.

**딥임포트 예외**: `schemas.ts` 가 `@/modules/engine` 배럴을 거치지 않고 `engine/json/schemaValidate` 를 직접 import 한다 — 이 시점에 `engine/index.ts`·`engine/llm`·`engine/adapters`·`engine/functionalTest`·`admin`·`infra` 가 task-012c developer 작업으로 동시에 uncommitted 상태라 배럴에 새 export 를 추가하면 충돌 위험이 있었다(`schemaValidate.ts` 자체는 그 범위 밖). `lesson.test.ts` 가 이미 같은 파일을 테스트에서 직접 import 하는 전례가 있어 완전히 새로운 패턴은 아니다. 배럴이 안정되면 재노출로 정리하는 것을 후속 과제로 남긴다.

**검증**:
- 단위: 격리 스냅샷(`git archive HEAD(37e2ad7)` + 이번 5개 변경 파일만 덮어씀, task-012c 동시 편집분 배제)에서 `tsc`·eslint 클린, 전체 단위 **758/758 PASS·0 fail·3 skip**(신규 8건 — lesson@v7 4건 + `engine/__tests__/additionalPropertiesStrip.test.ts` 4건: additionalProperties 제거·미등록 스키마 불변·이름 바뀐 필수 누락은 여전히 잡힘·anyOf null 분기).
- 라이브(미러, 실제 Claude CLI, Claude CLI 총 11회 — 예산 14회 이내): `lesson-paste-diagnose.ts --runs-paste 4 --runs-topic 3` — **n=7 성공=7 실패=0**.

| run | 결과 | attempts | 1차 위반 원인 |
|---|---|---|---|
| paste#1 | OK | 1 | - |
| paste#2 | OK | 1 | - |
| paste#3 | OK | 2 | 콘텐츠 매칭④(speaking modelAnswerJa) — 이번 수정과 무관, 기존 lesson@v6 눈감기로 회복 |
| paste#4 | OK | 2 | `quiz/3/choices` 중복(ajv uniqueItems) — 이번 수정과 무관 |
| topic#1 | OK | 1 | - |
| topic#2 | OK | 2 | `quiz/2/choices` 5개 초과(ajv maxItems) — 이번 수정과 무관 |
| topic#3 | OK | 1 | **`quiz/0/choicesNote` 스키마 밖 필드 → 조용히 제거되어 재시도 없이 통과**(로그: `[json] 스키마 밖 필드 제거: quiz/0/choicesNote`) |

**topic#3 이 이번 수정의 직접 증거다** — 이전에 관측된 필드명(`q`·`conjugationNote`)과 다른 새 이름(`choicesNote`)인데도 제네릭 스키마 트리 워커가 잡아냈다(하드코딩된 필드명 목록이 아니라 스키마 구조 기반이라 일반화됨). 이 표본에서 additionalProperties 로 인한 재시도는 0건 — 1건은 "재시도"가 아니라 "조용히 흡수"됐고, 그것이 정확히 목표한 효과다. 표본 7건이라 "재시도율 몇 % 감소"를 통계로 확정하지는 않는다(§11-3 의 v6 한계 기록과 같은 절제).

**변경 파일**: `src/modules/engine/json/schemaValidate.ts`(`enableAdditionalPropertiesStrip`·`stripAdditionalPropertiesWalk`) · `src/modules/conversation/structuredResponse/schemas.ts`(등록 1줄) · `src/modules/conversation/prompts/lesson.ts`(`lesson@v7`) · `src/modules/conversation/__tests__/lesson.test.ts`(+4) · 신규 `src/modules/engine/__tests__/additionalPropertiesStrip.test.ts`(4건). 다른 A 지점 무변경.

**재발 가능한 함정(추가)**: ⑪ ajv `additionalProperties:false` 위반은 `extraCheck`/`repair.ts` 가 절대 못 본다 — 그 둘은 ajv **통과 후**에만 불리므로, "결정적 보정"을 추가할 때 "이 위반이 ajv 단계인가 extraCheck 단계인가"를 먼저 가려야 한다(같은 "결정적으로 고치기" 원칙이라도 훅을 거는 위치가 다르다). ⑫ 모델이 스키마에 없는 참고용 키를 붙이는 습관은 **필드명이 고정돼 있지 않다**(`q`→`choicesNote` 로 다른 회차에 다른 이름이 나옴) — 특정 필드명을 화이트리스트로 막는 방식은 두더지 잡기가 되므로, 스키마 구조 기반(무엇이 아니라 "어디에 있어야 하는가")으로 일반화해 지우는 편이 맞다.
