---
task_id: task-003b
title: "강사 에이전트 역할정의·페르소나 v1 + 학습 설계 보완(주제·상황·반복 학습·기록 조회·M4 방안)"
status: done
roles_involved: [leader, prompt-engineer]
related_tasks: [task-001-initial-planning, task-002-phase0-scaffolding, task-004-ai-client-persona]
tags:
  - type/task
  - domain/tutor
  - domain/conversation
  - domain/lesson
  - domain/plan
aliases:
  - 페르소나v1
  - 강사역할정의
  - 학습설계보완
created: 2026-09-26
updated: 2026-09-26
---

## 목표 (Leader 작성)
기획서의 강사 에이전트 역할·기능을 기준으로 현재 설계를 대조해 차이를 사용자에게 보고하고, 확정된 방향(단일 페르소나·일본인 원어민·교정에 철저·한국어 설명+일본어 대화·사용자 지정 이름)으로 `tutor.md` v1 을 작성한다. 동시에 사용자 지시로 학습 설계를 보완한다: 주제·상황 기반 오늘의 회화, 성장 적응 과제 선택, '무엇이든 물어보세요' 기록 활용, M4 모델/파인튜닝 방안, 평가 지표. **문서만, 코드 없음.**

## 관련 과거 이력 요약
- [[task-001-initial-planning]] 에서 tutor.md v0(bjj `gym-master.md` 구조) 작성. 정본 5종·설계 문서 33종 확정.
- bjj 페르소나 설계 근거(`gym-master-chat-plan.md` L8·L168·L184·§5·§6·§14, `gymMasterPersona.js`, `masterChat.js` L126~L195): 파일 하나 공용·원칙마다 근거·제안만·도구 상한·`--agents` 에 model 미포함·mtime 캐시·fail-closed·헤더 600자·창 12개/8,000자·라이브 검증 3종.

## Leader 지시사항
- 기획서 대조표 15건 작성 → 사용자 피드백: **#2 스케줄·커리큘럼 주체 = 강사, #11 청취 구간 반복·단어 메모·종료 지점 반영, #1(개발팀 편입)·#13(타임아웃) 은 현재 설계 유지**, 반복 규칙 재정의(3~7일 강사 판단, 학습 횟수 DB 기록, 균등 랜덤, 피드백 많은 항목 FOCUS 3일).
- 산출: `tutor.md` v1, `docs/design/tutor-persona-validation.md`, `docs/design/learning-personalization-and-llm-data.md`(서브에이전트 작성), design-spec §0·§7-3·§7-4·§7-6·§7-7·§8·§11·§15·§16·§18 보완, 정본 갱신(domain-model 본문: `Profile.teacherName`·strictness STRICT·`AiJob.payload`·`ReviewSchedule` 교체·`RepetitionItem`·enum 3종·`JobKind.REVIEW_DECISION`; §9 제안 절 / api-contract: 정합성 + §6 제안 / module-dependency §10 / configuration-resolution 엔진 id / admin-console/13 보존 90일), 정합성 수정 16+1건.
- prompt-engineer 인계: task-004 에서 프롬프트 모듈 `{talk,chat,chatReview,reviewDecision}` + 검증 세트 V1~V9 실체화.

## Prompt-Engineer 기록
- (task-004 에서 기록)

## Developer 기록
- (해당 없음 — 코드 없음. Phase 0 준비로 `prisma/schema.prisma`(정본 §3 추출, 48 모델)·`package.json`·`.devmirror`·`scripts/sync-local.sh` 만 배치)

## Reviewer 기록
- (해당 없음)

## QA 기록
- (해당 없음)

## 최종 요약
- **무엇을**: 강사 역할을 기획서와 대조해 15건 차이를 보고했고, 사용자 결정에 따라 복습 주기를 "코드 3일 고정"에서 **강사가 3~7일에서 판단(코드는 범위 강제·기록·균등 랜덤 추출, 피드백 많은 항목 FOCUS 3일)** 으로 바꿨다. `tutor.md` v1(일본인 원어민·교정 철저·한국어 설명+일본어 대화·사용자 지정 이름·복습 판단 모드) 과 검증 세트 사양, 학습 설계 보완 문서(주제·상황 역할극, 관측·능력 축 제안, ASK 기록 조회 계층, M4 모델 후보·LoRA 방안·지표)를 만들고 정본·설계안을 정합성 있게 갱신했다.
- **왜**: 기획서는 강사 에이전트가 스케줄·커리큘럼을 구성한다고 했는데 1차 설계는 코드가 정하고 있었다. 사용자가 강사 주도로 되돌리되 범위·기록은 시스템이 보장하도록 결정했다.
- **결과**: 문서만 변경, 코드 0줄. 사용자 결정 필요 항목은 `learning-personalization-and-llm-data.md` §8 로 집계.
- **다음 후보**: 사용자 DB 권한 SQL 실행 → 스키마 push(48 테이블) → task-002 Phase 0.
