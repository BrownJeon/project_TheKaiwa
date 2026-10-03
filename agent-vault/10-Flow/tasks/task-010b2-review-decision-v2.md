---
task_id: task-010b2
title: "A11 reviewDecision@v2 — 응답 계약 정합(reason 추가·mixNote_ko 누락) + 관측 신뢰도 가중"
status: doing
base_ref: d775aac
risk_level: R1
roles_involved: [leader, judge, prompt-engineer, developer, reviewer, qa, deployer]
related_tasks: [task-010b-repetition]
tags:
  - type/task
  - domain/repetition
  - domain/prompt
  - domain/tutor
aliases:
  - reviewDecision v2
  - task-010b2
created: 2026-10-03
updated: 2026-10-03
---

## 목표 (Leader)
A11 복습 판단(`reviewDecision@v1`, sonnet 60s)이 응답 계약을 자주 어겨(1차 위반 → ajv 재시도) 60s 예산을 넘기고 그날 판단이 FALLBACK 으로 대체된다. 지시문과 스키마를 맞춰 **1차 통과율**을 올리고, 같은 버전 변경에 [[task-010b-repetition]] ★결정 3(관측 신뢰도 가중)을 함께 넣는다.

## 근거 (2026-10-03 실측)
- 운영 로그 21:18 `[json] 1차 응답 계약 위반 → 재시도: /decisions/0..2: 허용되지 않은 필드 'reason' 포함`.
- 개발 QA 스모크: A11 DAILY `sessionPlan` 1차 `mixNote_ko` 누락 → 재시도 복구.
- 운영 스모크 지표 `a11DailyMs 64662 FAILED`(예산 60s) → FALLBACK 세션(기능은 동작, TUTOR 판단 품질만 손실).
- A5 `reviewMix@v3`(같은 날)와 같은 패턴: 지시문 필드 나열과 스키마 required/additionalProperties 불일치.

## 범위
1. **PE — `reviewDecision@v2`**: `conversation/prompts/reviewDecision.ts` 지시문을 스키마(`structuredResponse/schemas.ts` A11)와 필드 단위로 대조 — decisions[] 허용 필드 정확히 나열(이유 필드 이름이 스키마와 다르면 스키마 이름으로; `reason` 같은 비허용 필드 금지 명시), sessionPlan 필수 필드(`mixNote_ko` 등) 명시. 실측 3회 이상(1차 위반 0 목표).
2. **★결정 3 관측 신뢰도 가중**: A11 입력 요약 `summarizeRecentObservations` 가 confidence < 0.6 관측을 SUCCESS/FAIL 집계에서 빼고 `uncertain N` 으로 따로 넘김(입력 필드 추가 → v2 지시문에 한 줄). 집계 코드는 developer(learning), 프롬프트는 PE.
3. 예산(60s)·재시도 정책은 바꾸지 않는다(1차 통과율로 해결). 개선 후에도 초과가 관측되면 별도 판단.

## 비범위
- A5·A4 프롬프트, 화면, DB 스키마.

## 관련 과거 이력 요약
- [[task-010b-repetition]]: A11 러너(`decision.ts runReviewDecisionJob` — completeJson 직후 `normalizeReviewDecision`, 실패 시 같은 tx FALLBACK), ★결정 3 규칙(0.6 미만 제외·uncertain N), 2단계 A5 v3 교훈(지시 필드 나열 = 스키마).
- 관련 승인 교훈: 없음(`/이슈기록 관련 ui` 0건).

## 판단 기록 (judge)
- [2026-10-03 21:23] intake engine=jev → task_type=local_fix · risk=R1 · developer_model=sonnet · track=standard · next=assign | overrides=- | fallback=- | tokens=1429 | 실호출모델=developer sonnet(집계)·PE(프롬프트 — 프롬프트 본문은 PE 담당이라 judge roles 에 없지만 Leader 배정)

## Prompt-Engineer 기록
- [21:28] **reviewDecision@v2 완료.** 파일: `conversation/prompts/reviewDecision.ts`·`__tests__/reviewDecision.test.ts`(스키마·엔진·예산·learning 무변경).
- **원인 대조표**(`REVIEW_DECISION_SCHEMA`, 전 층 additionalProperties:false) — v1 지시문은 required 이름을 **전부 담고 있었다**(누락 필드 없음):

  | 층 | 스키마 required | v1 지시 | 비고 |
  |---|---|---|---|
  | 최상위 | decisions·sessionPlan·rationale_ko | 모두 언급 | - |
  | decisions[] | itemId·nextIntervalDays·priority·reason_ko | 모두 언급(근거=`reason_ko`) | 산문 속에 흩어짐, "이 밖의 키 금지" 없음 → 모델이 `reason` 으로 축약(운영 21:18) |
  | sessionPlan | itemIds·mixNote_ko | 모두 언급 | `mixNote_ko` 가 "어떻게 섞을지" 꼬리에만 있어 itemIds 만 쓰고 누락(개발 QA) |

  근본 원인 = 필드 누락이 아니라 **형태가 산문으로만 제시됨 + 추가 키 금지 문구 없음**(A5 v3 와 같은 유형). 스키마와 지시가 근본적으로 어긋난 곳은 없어 스키마 변경 권고 없음.
- **변경 요지**: (1) 지시 첫머리에 한 줄 JSON 골격(정확한 키 이름)·"모든 키 필수·이 밖의 키 금지(reason·note 같은 이름·추가 키 거부)" (2) `reason_ko` 40자 안팎으로 안내(스키마 상한 80 유지 — 출력 토큰·지연 절감) (3) sessionPlan 은 itemIds 가 비어도 mixNote_ko 필수 명시 (4) 관측: `ReviewDecisionObservationSummary.uncertain?` 추가, `불확실N` 렌더(0·미지정 생략, 5축 상한 유지) + "불확실N 은 음성 인식 신뢰도가 낮은 관측 — 약하게만" 한 줄.
- **테스트**: 지시문에 스키마 required 9개 이름 전부 포함·골격 JSON 키 집합 == 스키마 required(드리프트 방어)·"이 밖의 키 금지" 문구·`불확실` 렌더(0 생략)·버전 `reviewDecision@v2`. conversation 20/20.
- **실측**(미러 sonnet, `tests/live/review-decision-measure.ts` 2배치 = 6회 순차, 429 없음):

  | run | attempts | elapsed | 결과 |
  |---|---|---|---|
  | normal(6건) | 1 | 9.5s / 8.7s | 1차 통과, decisions 6, 보정 0 |
  | focus-heavy(5건) | 1 | 8.2s / 7.0s | 1차 통과, 보정 0 |
  | single(1건) | 1 | 7.3s / 8.9s | 1차 통과, 보정 0 |

  1차 위반 0/6, 7.0~9.5s(prompt 합 5.4~5.9k자 중 persona 6.9k 포함, 사용자 프롬프트 2.3~2.8k자). 한계: 개발 측정은 v1 의 위반을 재현한 베이스라인이 없고(v1 위반은 간헐), 운영 64.7s 는 응답 길이보다 재시도·큐 혼잡 영향이 커 보인다 — 운영 로그에서 1차 위반 재발 여부를 계속 볼 것. 불확실 입력이 있는 실호출은 측정하지 않음(렌더는 단위 테스트로 확인).
- **검증**: tsc(--noEmit --incremental false, src 범위) 0 · eslint(변경 2파일) 0 · 전체 회귀 1254 중 fail 1.
- **⚠ Leader/Developer 조치 필요 1건**: `src/app/api/v1/_lib/__tests__/review.test.ts:30` 이 `'reviewDecision@v1'` 을 하드코딩 → v2 로 올리면 이 1건 fail(경계 밖이라 미수정). 한 줄 `'reviewDecision@v2'` 로 바꾸거나 `REVIEW_DECISION_PROMPT_VERSION` 상수 참조로. (`learning/__tests__/task010b.test.ts` 의 v1 문자열은 불투명 입력이라 영향 없음.)
- **Reviewer 인계**: ①지시문 골격 vs `REVIEW_DECISION_SCHEMA` 대응(테스트로 고정) ②`uncertain` 필드는 learning 쪽 집계가 채움 — `decision.ts` 의 observationSummary 타입(`{skill,success,fail}`)에 `uncertain?` 가 들어갔는지 연결 확인 ③프롬프트 길이 증가 ≈ +250자(헤더 아닌 [지시]) ④페르소나·엔진명 노출 없음.
- 남은 일: 위 review.test.ts 한 줄 · `prompts:sync`(SOURCE_CODE 버전 갱신)는 deployer/developer 단계. 다음 첫 행동: Reviewer 가 위 3점 확인.

## Developer 기록
- [21:31] developer(learning 집계, 서브태스크 2항목) 완료 — **변경**: `learning/observations/index.ts`(`OBSERVATION_CONFIDENCE_MIN=0.6`·`ObservationSkillSummary`{skill,success,fail,uncertain}·`summarizeRecentObservations` 가 groupBy 2회(confidence gte 0.6 → success/fail, lt 0.6 → uncertain)·4번째 인자 db 주입), `learning/repetition/decision.ts`(타입 `ObservationSkillSummary` 사용, 미사용 `SkillAxis` import 제거), `learning/__tests__/task010b.test.ts`(테스트 1건), `app/api/v1/_lib/__tests__/review.test.ts`(Leader 추가 허용 — 'reviewDecision@v1' 하드코딩 → `REVIEW_DECISION_PROMPT_VERSION`). `_lib/review.ts` 는 `observationSummary: m.observationSummary` 로 그대로 통과 — 수정 불필요(PE 의 `uncertain?: number` 와 구조 호환, tsc 0).
- 결정·근거: `LearningObservation.confidence` 는 `Float @default(1)` NOT NULL → **null 없음**(기존 행도 1.0), 따라서 null 정책 불필요. uncertain 은 SUCCESS·FAIL 관측 중 conf<0.6 만 센다(PARTIAL·SKIPPED 는 원래 집계 밖이라 uncertain 에도 안 넣음 → 축별 success+fail+uncertain = 그 축 SUCCESS·FAIL 전부). uncertain 만 있는 축도 행으로 나온다(0/0/N). 쿼리: 기존 인덱스 (userId,occurredAt)·(userId,skill,occurredAt) 범위 위에서 confidence 필터 — 14일 범위라 추가 인덱스 불필요, 쿼리 1→2회(병렬).
- 실행(미러 `~/.node-local/thekaiwa-dev-010b`, rsync src/tests/prisma): `tsc --noEmit --incremental false` → exit 0 / eslint(learning·_lib·reviewDecision.ts) → exit 0 / task010b.test.ts 47 pass 0 fail / **전체 `node --import tsx --test` 1255 tests, pass 1252, fail 0**(3 skip).
- 변이: ① `lt`→`lte` ② `gte`→`gt` ③ gte 필터 제거 → 각각 task010b 46 pass 1 fail(새 테스트가 잡음), 원복 후 47 pass.
- Reviewer 인계: 집중 검토 — (a) groupBy 두 쿼리의 경계(0.6 포함 쪽 = 집계), (b) 반환 타입이 prompts 쪽 `ReviewDecisionObservationSummary` 로 흐르는 경로(uncertain optional), (c) learning→conversation import 없음(타입은 learning 소유 `ObservationSkillSummary`). 실 DB·LLM 미사용(가짜 groupBy 가 where 를 평가). commit·push 안 함. 미커밋: 위 4개 파일.

## Reviewer 기록

### REV-082 — 010b2, 2026-10-03 (reviewer · Read 전용)
**판정 PASS (C0·H0·M0·L3)**. 코드 수정 없음.

- **LLM 계약**: 지시문 골격 JSON 의 키 집합 = `REVIEW_DECISION_SCHEMA` required(최상위 3·decisions[] 4·sessionPlan 2) — `reviewDecision.test.ts` 가 파싱 비교로 고정(변이 ①골격 `reason_ko`→`reason` 시 1 fail 확인). "이 밖의 키 금지·reason·note" 문구 있음. `reason_ko` 40자 안팎 안내(<스키마 상한 80)·mixNote_ko 200·rationale 300 모두 스키마와 모순 없음, "최소 1건" = `decisions.minItems:1`, `itemIds` 빈 배열 허용 = `minItems:0`. "JSON 객체 하나뿐"은 엔진 `withJsonOnly`(`engine/llm/index.ts:190`)가 붙이므로 불변, ajv 재시도 경로·`extraCheck(checkReviewDecisionResponse)`·`normalizeReviewDecision`(3~7 클램프·FOCUS≤3·후보 밖 id 폐기·sessionPlan 부분집합) 무변경 — 충돌 없음. 엔진명·학습자 원문 지시문 유입 0(`mentionsEngineIdentity` 대상 문구 없음). 버전 상수 `REVIEW_DECISION_PROMPT_VERSION`('reviewDecision@v2')는 `_lib/review.ts:24` driver.promptVersion → 잡 기록 경로 그대로, review.test.ts 는 상수 참조로 전환. `uncertain` 렌더: >0 만 `·불확실N`, 0·미지정 생략, 5축 상한(SkillAxis 5개)과 일치 — 판단 왜곡 소지 없음(약한 근거 한 줄).
- **집계**: confidence `Float @default(1)` NOT NULL(`prisma/schema.prisma:1124`) → null 정책 불필요 확인. 경계 = `gte 0.6`(집계)·`lt 0.6`(uncertain) — 서로소·합집합 완전, 0.6 은 집계 쪽. 정의가 task-010b ★결정 3 원문("confidence < 0.6 인 관측을 SUCCESS/FAIL 집계에서 빼고 `uncertain N` 으로")과 일치(uncertain = SUCCESS·FAIL 중 저신뢰만, PARTIAL·SKIPPED 제외는 기존 집계 범위와 동일). groupBy 2회 `Promise.all`, `since` 한 번 계산해 같은 범위, 기존 인덱스 (userId,occurredAt)로 14일 범위·추가 인덱스 불필요. 6층: learning → conversation import 0(grep), 타입은 learning 소유 `ObservationSkillSummary`. 변이 ②`o.uncertain>0`→`!==undefined` 시 1 fail(생략 규칙 방어).
- **타입 흐름**: `ObservationSkillSummary{skill,success,fail,uncertain}` → `decision.ts ReviewDecisionMaterials.observationSummary` → `_lib/review.ts:43` 패스스루 → conversation `ReviewDecisionObservationSummary`(`uncertain?`) 구조 호환(tsc 0).
- **재실행(미러 `~/.node-local/thekaiwa-dev-010b`, rsync 후 src 동일)**: tsc `--noEmit --incremental false` exit 0 · eslint(변경 6파일) exit 0 · reviewDecision+task010b+review 69/69 · 전체 1255 tests, pass 1252·fail 0·skip 3(Developer 보고와 일치). 변이 2건 사망, 원복 cmp 일치(NFS 와도 동일). 실 LLM 호출 없음.

| # | 심각도 | 내용 | 근거 | 권고 |
|---|---|---|---|---|
| L-1 | LOW | 집계 쿼리가 가짜 groupBy(where 직접 평가)로만 검증 — 실 DB 에서 `confidence` Float 비교·`outcome in` 조합은 미실행 | `task010b.test.ts` fakeObsGroupBy | QA 가 운영/개발 DB 에서 `summarizeRecentObservations` 1회 실호출(저신뢰 레슨 말하기 관측 보유 계정)로 uncertain>0 확인 |
| L-2 | LOW | 효과 근거가 약함: v1 위반 재현 베이스라인 없음·실측 6/6 1차 통과는 표본 작음, 운영 64.7s 가 재시도 때문인지 큐 혼잡인지 불명, uncertain 입력 실호출 미측정(PE 가 스스로 명시) | PE 기록 실측표 | 배포 후 운영 로그에서 `[json] 1차 응답 계약 위반`·A11 `a11DailyMs` 재발 모니터링, 재발 시 예산 별도 판단(Leader 범위 3항과 일치) |
| L-3 | LOW | 골격 예시값(`nextIntervalDays:4`·`priority:NORMAL`)이 모델 앵커링 가능 | `reviewDecision.ts` 지시 둘째 줄 | 실측 보정 0건이라 영향 낮음. 운영에서 간격 분포가 4일로 쏠리면 예시값을 비워 둘 것 |

- **QA high_risk_areas**: ①A11 DAILY·LESSON 실호출 1차 통과(attempts=1)·a11DailyMs ≤60s ②불확실 입력(레슨 말하기 STT 0.5 관측 보유) 시 프롬프트 `불확실N` 렌더·판단 폴백 아님 ③실 DB groupBy 2회 결과(축별 success+fail+uncertain = SUCCESS·FAIL 전체) ④`prompts:sync` 가 v2 를 레지스트리에 반영(deployer 단계) ⑤기존 A11 소비 경로(복습 판단 저장·FOCUS≤3) 회귀. `native_change=false`.

## QA 기록

### 010b2, 2026-10-03 (qa · 화면 변경 없음)

**VERDICT: PASS** (결함 0건, 육안 확인 필요 0건)

#### 검증 항목
- ✅ **라이브 스모크**: 52/52 PASS (A11 DAILY elapse=13.2s ≤60s, attempt=1)
- ✅ **1차 계약 위반**: 0건 (grep "[json] 1차 응답 계약 위반" = 0)
- ✅ **실 DB 집계** (REV-082 L-1): confidence=0.6 경계 검증 ✓ — uncertain≥0.59 분류·축별 합 정확
  - 관측 생성 전: confident=[], uncertain=[]
  - 테스트 행 3개 (conf 0.5 SUCCESS, 0.59 FAIL, 0.6 SUCCESS) 생성·집계 확인·정리
  - 생성 후: confident에 0.6 SUCCESS 포함, uncertain에 0.5·0.59 포함 (예상대로)
- ✅ **불확실 렌더**: task010b 테스트 47/47 PASS — "관측 신뢰도 가중: 0.59 → uncertain, 0.6(경계) → 집계 포함"
- ✅ **엔진명·모델 누출**: 0건 (smoke 9a 스캔 `hits=0`)

#### 지표
| 항목 | 값 | 기대 | 상태 |
|------|-----|------|------|
| A11 DAILY elapsed | 13.2s | ≤60s | ✅ |
| A11 attempt | 1 | 1 | ✅ |
| 스모크 PASS | 52/52 | 52/52 | ✅ |
| 1차 위반 | 0 | 0 | ✅ |

#### 정리
- dev서버 3014 → 종료·포트 비움
- 미러 테스트 행 삭제 (생성 3 → 정리 완료)
- 운영 접근 없음

## 최종 요약 (Leader)
- [2026-10-03 21:37] codex_gate/C2 engine=jev → codex_required=false, budget_rule=CX-limit-unknown-hold | overrides=CX-limit-unknown-hold | fallback=- | tokens=909
