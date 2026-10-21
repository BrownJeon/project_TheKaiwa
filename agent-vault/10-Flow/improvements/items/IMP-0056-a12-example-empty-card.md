---
imp_id: IMP-0056
title: "챌린지 주제 새 단어 카드에 예문이 비어 있는 경우(예문 검사 실패로 null) — 대조 쇼핑하기의 サイズ 1장"
status: done
screen: "§5 오늘의 단어 — 챌린지 주제 세트의 AI 새 단어 카드(A12)"
area: behavior
priority: ""
found_on: "qa/local"
created: 2026-10-19
updated: 2026-10-21
observed_ref: 69ecd6e
related_task: "[[task-078-improve-topic-words-level-yield]]"
planned_task: "[[task-079-improve-topic-words-quality]]"
tags:
  - type/improvement
aliases:
  - IMP-0056
---

## 현상

task-076 QA(10-18)에서 챌린지 주제 새 단어 카드 1장(대조군 «쇼핑하기» 세트의 サイズ)이 예문 없이 나왔다. 코드 동작은 설계대로다: 예문 검사(`checkTopicExample`)에 실패하면 그 카드의 `exampleJa`·`exampleKo` 만 null 로 만들고 단어는 통과시킨다(단어 생성 성공률을 깎지 않으려는 v2 설계). 다른 세트는 예문 10/10 이었다.

## 기대하는 모습

예문이 없는 카드가 드물거나, 있어도 카드 화면이 어색하지 않게(예문 줄 없이) 보인다. 예문이 필요한 학습 흐름(예문 읽기·번역 가리기)에서 빈 카드가 막히지 않는다.

## 근거

[[task-076-qa-a12-record]] 52·84행. **1장 관찰이라 빈도 미확인**. 코드 근거: `prompts/topicWords.ts` `checkTopicExample`(예문 불량 → 쌍을 null)·`assembleTopicWords` 의 `exampleNulled` 통계가 있으나 운영 집계는 따로 보지 않았다.

## 분류 메모 (착수 때 Leader)

- 2026-10-19 사용자 결정으로 IMP-0052(task-078)와 **분리해 접수만**(이번 변경 밖). 설계된 동작이라 «결함»인지 «허용 가능한 드문 현상»인지부터 판단이 필요하다 — 착수 때 `exampleNulledByReason` 분포를 모아 빈도와 이유(길이·문자·누락)를 먼저 잰다.
- 후보: ① 예문만 다시 생성 ② 예문 null 이유 로깅 ③ 카드 화면에서 예문 없음 처리 확인(화면 변경이면 데모 게이트).
- 같은 프롬프트를 task-078 이 바꾸므로 **착수는 task-078 이후**.

- **착수(2026-10-20, task-079)** — Leader 빈도 측정(저장된 AI 새 단어 57개·트레이스 10회, 읽기 전용): 예문 없음 0/57 — 재현 안 됨, 트레이스에 `exampleNulled` 기록만 추가(측정 수단). 빈도가 쌓이면 재판단.
- **종료(2026-10-21)** — 사용자 «폰 확인 모두 정상이야»(2026-10-21): 운영 배포 뒤 폰 확인 정상 → `done`.
