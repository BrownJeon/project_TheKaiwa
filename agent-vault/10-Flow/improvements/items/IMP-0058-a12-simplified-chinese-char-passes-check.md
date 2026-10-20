---
imp_id: IMP-0058
title: "AI 새 단어(A12)가 일본어 단어에 중국 간체자를 섞어도 표기 검사 ②가 못 거름 — 怎样ですか"
status: planned
screen: "§5 오늘의 단어 — 챌린지 주제 세트의 AI 새 단어 카드(A12)"
area: behavior
priority: ""
found_on: "qa/local"
created: 2026-10-19
updated: 2026-10-20
observed_ref: db3ac2e
related_task: "[[task-078-improve-topic-words-level-yield]]"
planned_task: "[[task-079-improve-topic-words-quality]]"
tags:
  - type/improvement
aliases:
  - IMP-0058
---

## 현상

task-078 PE 개선 측정(2026-10-19)에서 모델이 일본어 단어 표기에 **중국 간체자**를 섞은 항목이 1건 나왔다: `怎样ですか`(의도는 いかがですか). 이번에는 모델이 스스로 `valid:false` 로 신고해 서버에서 버려졌지만, 표기 검사 ②(`SURFACE_ALLOWED`)는 CJK 통합 한자 범위 전체를 허용하므로 **모델이 `valid:true` 로 내면 그대로 통과**한다(코드 근거: `prompts/topicWords.ts` 의 `KANJI_CLASS` = `\u3400-\u4DBF\u4E00-\u9FFF`).

## 기대하는 모습

일본어 단어 카드의 표기에 일본어에서 쓰지 않는 간체자가 들어간 항목은 모델 자기 신고와 무관하게 서버가 거른다.

## 근거

[[task-078-pe-improve-record]] §관찰(`怎样ですか`). **1건 관찰이라 빈도 미확인**, 간체자가 통과해 카드로 나온 실사례는 아직 없다(이번 측정에서는 모델의 `valid:false` 가 막았다).

## 분류 메모 (착수 때 Leader)

- 2026-10-19 PE 가 «IMP-0055·0056·0057 어디에도 해당하지 않는다» 고 보고 → 사용자 결정(부수 관찰은 별도 IMP)대로 **접수만**(이번 task-078 범위 밖).
- 후보: ① 검사 ② 에 간체자 전용 문자(`样`·`这`·`们` 등) 차단 목록 또는 일본어 상용한자 대조 ② 프롬프트 지시 한 줄 — 같은 프롬프트(`topicWords@v3`)를 task-078 이 바꾸므로 **착수는 task-078 이후**.
- 영향이 카드 표기 문자라 사용자에게 잘못된 글자가 보일 수 있다 — 빈도를 먼저 잰다(`NOT_VALID` 에 몰린 표기 목록 수집).

- **착수(2026-10-20, task-079)** — Leader 빈도 측정(저장된 AI 새 단어 57개·트레이스 10회, 읽기 전용): 저장된 카드 간체자 0건(오탐 5건은 모두 일본어 한자), 트레이스 NOT_VALID·SURFACE_CHARS 0 — 검사 ② 에 간체자 전용 문자 차단 목록 추가(시드 7,755개 전수 통과 시험 포함).
