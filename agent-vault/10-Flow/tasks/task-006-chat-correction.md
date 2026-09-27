---
task_id: task-006
title: "AI 채팅 + 표현 점검 + 교정 채택"
status: in-progress
base_ref: 77aead8
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, codex]
related_tasks: [task-004-ai-client-persona, task-005-settings-attendance, task-017-dev-env-judge-codex]
tags:
  - type/task
  - domain/conversation
  - domain/ui
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-006: AI 채팅(텍스트) 화면과 SSE 턴 처리, 사용자 일본어 문장의 표현 점검 → 교정 제안(`PROPOSED`) 표시 → 사용자가 채택할 때만 저장.
완료 기준(§15): SSE 턴·락·폴링, `Correction.original` 바이트 일치, 채택 전 타 테이블 행 0, 타인 채팅·교정 IDOR 404, 이모지 입력 500 없음.
정본: `docs/design/api-contract.md` §2-6 대화 `/api/v1/chats`·§2-7 교정 `/api/v1/corrections`, `domain-model.md`(Chat·Message·Correction·TutorProposal), `module-dependency.md`(conversation L2, 턴은 app 층 조합).

**새 운용 첫 task** — [[task-017-dev-env-judge-codex]] 절차(judge 접수·C1/C2·codex)를 처음 실제로 적용한다. Jev 실제 호출 검증을 겸한다.

## 관련 과거 이력 요약
- [[task-004-ai-client-persona]]: engine router·Claude CLI 어댑터(설정/MCP 생략·thinking 끔)·페르소나 로더·프롬프트 3종, 회화 턴 p50 5.1s. `NoEngineAvailableError` 이름 규약.
- [[task-005-settings-attendance]]: `infra/http.ts`(봉투·오류 코드·withApi·requireSession·readJsonObject·rateLimit) — 채팅 API 도 이 패턴을 쓴다.

## 판단 기록 (judge)
- [2026-09-27] intake engine=jev(jev-1.13.0, 첫 실제 호출) → task_type=feature(conf 1.00) / complexity=2.97(conf 0.97, 4단계 중 Hard) / needs_info=0.38(아님) / risk=R2(high 0.96) / developer_model=**opus** / next=assign | overrides=- | fallback=- | tokens=1031($0.000043), 325ms
  - Leader 해석: R2 는 Jev 판정(규칙 경로 매칭 없음) — 교정 원문 무수정·채택 전 저장 0·IDOR·턴 잠금이 데이터 무결성·권한 영역이라 타당. `leader.md` R2 보강 기준(`Correction.original`)과도 일치. → C2 에서 규칙상 Codex 개입(R2), 한도 미기록이어도 R2 는 허용.

## Codex 검토

## Designer 기록

## Prompt-Engineer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
