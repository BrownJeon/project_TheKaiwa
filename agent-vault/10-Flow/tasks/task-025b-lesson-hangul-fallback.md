---
task_id: task-025b
title: "오늘의 회화 후속 — 퀴즈 질문 한글 폴백·활용형 매칭·종료 카드 링크 (025 후속)"
status: todo
base_ref: c1d93e5
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-025-improve-today-lesson]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - task-025b
  - 퀴즈 한글 폴백
created: 2026-10-03
updated: 2026-10-03
demo_gate:
  required: false
  level: "none"
  status: "pending_judge"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "leader"
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
[[task-025-improve-today-lesson]] 운영 반영(2026-10-03, 릴리스 `20261003-093130-2209ed2b`) 뒤 QA·Reviewer 가 남긴 알려진 Medium 1건과 Low 3건을 한 묶음으로 보정한다. 화면 구조는 바꾸지 않는다(구현 수준 보정 — 데모 게이트 수준은 Judge 접수 판정이 확정).

## 포함 항목
1. **D9 (Medium)** — `quizPromptView`(`src/components/lesson/logic.ts:225-228`)가 `promptKo` 가 비었을 때만 일본어 원문으로 폴백한다. LLM 이 promptKo 에 **일본어만** 넣으면 그 일본어가 질문으로 그대로 노출된다(사용자 요구 Q10 "퀴즈 문장 한글 병기" 위반). 한글(U+AC00–D7A3·호환 자모) 포함 여부로 판정하는 한글 인지 폴백으로 바꾸고 `StageQuiz.tsx:150-155` 표시 경로를 같은 함수로 맞춘다.
2. **로그 카운터 분리** — `src/modules/conversation/lessons/lesson.ts:349` 한 카운터가 서로 다른 두 종류(마지막 시도 완화 / promptKo 보정)를 섞어 센다. v8 롤백 기준 ②③④ 감시가 정확하려면 분리해야 한다.
3. **O2 (Low) — ④ 응용 대상 표현 활용형 매칭** — `曲がってください` 대 `曲がります` 처럼 활용형이 다르면 마지막 시도 완화로만 통과한다. 어간 기준 비교를 검토(과허용 주의 — 위양성 방어).
4. **결함 #1 (Low)** — `src/components/lesson/LessonEnd.tsx`(~145행) 종료 카드 "오늘로" `<Link className="flex h-11 …">` 에 `shrink-0` 없음 → x780 폭에서 20px 로 찌그러짐. 025 회귀가 아닌 기존 결함(마지막 커밋 67771a5).

## 가설(미재현 — 결함으로 세지 않음)
- **O3** 신규 계정 `GET /api/v1/speech/config` 500: 원문 로그가 없어 재현 전. 코드상 `getSpeechSetting`(`src/modules/preferences/index.ts:66`)이 `upsert` 라 **MariaDB 에서 신규 사용자 동시 첫 호출 시 P2002 경합**이 날 수 있다는 가설만 있다(Prisma upsert 는 MySQL 에서 네이티브가 아님). 재현되면 별도 접수. 이 task 에서 선제 수정하지 않는다.

## 비범위
- lesson@v8 프롬프트 자체 수정(롤백 기준 ①~④ 감시 결과가 나올 때까지 보류 — 프롬프트를 바꾸면 Reviewer 부터 재시작).
- 화면 구조·문구 변경, DB 스키마, 네이티브 변경(웹 배포만).
- REV-052 Medium·`〜` 물결표 이슈(별도 목록).

## 완료 기준
- 일본어만 담긴 promptKo 가 질문 영역에 노출되지 않는다(폴백 단위 테스트에 한글 없는 문자열·한글 섞인 문자열·빈 문자열 포함).
- 로그 카운터 2종이 분리되고 감시 질의가 가능하다.
- ④ 응용: 활용형 허용 케이스 통과, 무관 문장 위양성 0(테스트 고정).
- 종료 카드 링크가 x780·360·390·412 에서 높이·너비 유지.
- `tsc`·`eslint`·단위 테스트 0 fail → Reviewer → QA → 운영 반영 뒤 스모크 010 계열.

## 진행 기록
- [2026-10-03 09:50] Leader 등록. 다음: Judge 접수 → Developer.

## 최종 요약 (Leader)
