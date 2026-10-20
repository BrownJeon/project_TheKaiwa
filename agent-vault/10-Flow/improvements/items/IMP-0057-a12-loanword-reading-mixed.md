---
imp_id: IMP-0057
title: "외래어 새 단어의 읽기 표기가 호출마다 히라가나/가타카나로 섞임 — せーる·さいず·れじ vs レジ·サイズ"
status: planned
screen: "§5 오늘의 단어 — 챌린지 주제 세트의 AI 새 단어 카드(A12)"
area: behavior
priority: ""
found_on: "qa/local"
created: 2026-10-19
updated: 2026-10-20
observed_ref: 69ecd6e
related_task: "[[task-078-improve-topic-words-level-yield]]"
planned_task: "[[task-079-improve-topic-words-quality]]"
tags:
  - type/improvement
aliases:
  - IMP-0057
---

## 현상

task-076 QA(10-18)에서 외래어 단어의 `reading`(읽기)이 호출마다 히라가나(せーる·さいず·れじ)와 가타카나(レジ·サイズ)로 섞여 나왔다. 코드는 읽기 검사에서 가나 종류(히라·가타)를 무시한다(コーヒー ↔ こーひー 허용 — `readingMatchesSurface` 주석) — 그래서 어느 쪽도 통과한다. 사용자 화면에서 이 차이가 어떻게 보이는지(읽기 줄·후리가나·한글 발음)는 **확인되지 않았다**.

## 기대하는 모습

외래어(가타카나 표기) 단어의 읽기 표기가 한 규칙으로 일관된다(예: 표기가 가타카나면 읽기도 가타카나, 또는 항상 히라가나).

## 근거

[[task-076-qa-a12-record]] 84행. 코드 근거: `prompts/topicWords.ts` `readingMatchesSurface`(`toHiragana` 로 종류 무시). **화면 영향·빈도 미확인.**

## 분류 메모 (착수 때 Leader)

- 2026-10-19 사용자 결정으로 IMP-0052(task-078)와 **분리해 접수만**(이번 변경 밖). 영향이 화면에서 보이지 않는다면(읽기를 히라가나로 정규화해 쓰는 경로가 있을 수 있음) 낮은 우선순위일 수 있다 — 착수 때 `reading` 이 화면·TTS·한글 발음 변환에 어떻게 쓰이는지부터 확인한다 [추측: 영향 작음].
- 후보: ① 프롬프트 지시(`reading` 규칙 한 줄) ② 서버 정규화(통과 시 히라가나로 통일) ③ 현 상태 유지.
- 같은 프롬프트를 task-078 이 바꾸므로 **착수는 task-078 이후**.

- **착수(2026-10-20, task-079)** — Leader 빈도 측정(저장된 AI 새 단어 57개·트레이스 10회, 읽기 전용): 가타카나 표기 11개 중 3개가 히라가나 읽기(27%), 기본 사전은 528/528 가타카나 → 서버에서 가타카나로 정규화.
