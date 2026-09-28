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

