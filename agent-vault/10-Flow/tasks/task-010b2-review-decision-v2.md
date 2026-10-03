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

## Prompt-Engineer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약 (Leader)
