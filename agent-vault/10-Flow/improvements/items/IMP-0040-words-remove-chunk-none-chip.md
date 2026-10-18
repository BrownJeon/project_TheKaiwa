---
imp_id: IMP-0040
title: "단어장 조각 필터에서 「없음」 칩 제거"
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
  - IMP-0040
---

## 현상

단어장의 조각 줄(`ChunkChips`)은 전체·이름·액션·느낌·꾸밈·없음 칩이다. 「없음」은 `WordEntry.chunkType` 이 비어 있는 단어(NULL)를 모은다.

## 기대하는 모습

> 4. 조각 필터 중에 '없음'은 제거해줘

(사용자 요청, 2026-10-14)

## 근거

- 「없음」 칩을 없애면 조각이 비어 있는 단어는 어떤 조각 칩으로도 찾을 수 없게 된다 → IMP-0041(조각이 비어 있는 단어를 새 유형으로 분류)이 먼저 끝나야 한다. 시드 7,805행 중 202행(2.6%)이 조각 없음, 사용자 계정에는 33행(2026-10-14 조회).

## 분류 메모 (착수 때 Leader)

- task-068 에 묶음. IMP-0041 선행.
