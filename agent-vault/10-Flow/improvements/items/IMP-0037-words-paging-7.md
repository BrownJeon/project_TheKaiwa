---
imp_id: IMP-0037
title: "단어장 목록을 7개씩 페이징"
status: planned
screen: "§4 단어장(/drawer/words)"
area: ux
priority: ""
found_on: "app/web"
created: 2026-10-14
updated: 2026-10-14
observed_ref: 1ecd475
related_task: "[[task-008-vocab-today-words]]"
planned_task: "[[task-068-improve-wordbook]]"
tags:
  - type/improvement
aliases:
  - IMP-0037
---

## 현상

단어장 목록이 한 번에 30개씩 읽고 「단어 더 보기」로 이어 붙인다(`WordsScreen.tsx` `PAGE = 30`). 기본 단어 팩이 모두 들어오면 7,700개가 넘어 끝없이 이어지는 목록이 된다.

## 기대하는 모습

> 1. 단어장 목록에 대하여 페이징처리해줘. 페이징은 7개씩 해줘

(사용자 요청, 2026-10-14)

## 근거

- 현재 API #40 은 커서 방식이라 쪽 번호로 건너뛸 수 없다. 7,755개를 7개씩 나누면 약 1,108쪽이라 이전/다음만으로는 부족할 수 있다 → 쪽 이동 방식은 데모에서 결정.
- 같은 작업 묶음: IMP-0038(전체 기본 단어 추가)·0039·0040·0041·0042.

## 분류 메모 (착수 때 Leader)

- task-068 에 묶음. 화면 변경 → 데모 게이트.
