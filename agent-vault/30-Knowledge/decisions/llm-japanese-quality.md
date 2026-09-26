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
