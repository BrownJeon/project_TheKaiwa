---
imp_id: IMP-0039
title: "단어장 조건 필터에서 난이도 필터 제거"
status: done
screen: "§4 단어장(/drawer/words)"
area: ui
priority: ""
found_on: "app/web"
created: 2026-10-14
updated: 2026-10-14
observed_ref: 1ecd475
related_task: "[[task-023-improve-vocab-screen]]"
planned_task: "[[task-068-improve-wordbook]]"
tags:
  - type/improvement
aliases:
  - IMP-0039
---

## 현상

단어장 머리의 분류 칩(`CategoryChips`)은 `WordEntry.category` 값을 칩으로 보여 준다. 기본 단어 팩의 분류 이름은 난이도 이름과 같다(초보자 (N5)·초급 (N4)·중급 (N3)·고급 (N2)·최상급 (N1), 옛 50개는 「N5 기초」).

## 기대하는 모습

> 3. 기본 단어를 모두 추가했기에, 조건 필터중에 난이도에 대한 것은 제거해줘

(사용자 요청, 2026-10-14)

## 근거

- 분류 칩 줄이 난이도 필터인지(= 분류 칩 전체 제거) 난이도 이름 칩만 제거하고 다른 분류는 남기는지는 사용자 의도를 데모에서 확인한다. 분류 칩은 오늘의 단어 카드도 같이 쓴다(`CategoryChips` 주석) → 오늘의 단어 쪽 영향 범위도 데모에서 정한다.
- IMP-0038 이 끝나야 의미가 있는 변경(모든 단계가 이미 들어 있음).

## 분류 메모 (착수 때 Leader)

- task-068 에 묶음. 화면 변경 → 데모 게이트.
