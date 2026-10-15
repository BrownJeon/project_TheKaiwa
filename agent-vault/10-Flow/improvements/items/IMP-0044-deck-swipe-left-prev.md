---
imp_id: IMP-0044
title: "오늘의 단어 카드 스와이프: 왼쪽 밀기를 이전 카드로, 오른쪽 밀기를 다음 카드·건너뛰기 확인으로"
status: done
screen: "§5 오늘의 단어 카드 덱(VocabDeck)"
area: ui
priority: ""
found_on: "app/web"
created: 2026-10-15
updated: 2026-10-15
observed_ref: b317b27
related_task: "[[task-060-improve-deck-controls]]"
planned_task: "[[task-070-improve-deck-swipe-prev]]"
tags:
  - type/improvement
aliases:
  - IMP-0044
---

## 현상

오늘의 단어 카드 덱에서 **왼쪽으로 밀면 다음 카드**(푼 카드만, 안 푼 카드는 「먼저 답하세요」 안내로 막힘)로 가고, **오른쪽으로 밀면 건너뛰기 확인 시트**가 열린다(task-060). 이전 카드로 가는 길은 하단 [이전] 버튼과 ← 키뿐이라, 손가락으로 되돌아가려면 버튼을 눌러야 한다.

## 기대하는 모습

> 오늘의 단어 카드 스와이프할때 왼쪽으로 스와이프하면 지금은 건터뛰기가 되는데 이전 카드로 이동하는 걸로 변경해줘

(사용자 요청, 2026-10-15)

사용자가 「왼쪽 = 건너뛰기」라고 적었지만 코드상 왼쪽은 「다음 카드」, 건너뛰기는 오른쪽이다 — Leader 가 방향 지도를 보여 주고 사용자가 정했다(AskUserQuestion, 2026-10-15): **왼쪽 = 이전 카드 · 오른쪽 = 푼 카드는 다음 카드 / 안 푼 카드는 건너뛰기 확인**. 위로 밀기(뜻 보기)·탭·키보드(←이전 →다음)·[이전]/[다음 카드] 버튼은 그대로.

## 근거

- 코드: `SwipeCardStack.tsx` 머리말(왼쪽=다음, 오른쪽=건너뛰기 확인) · `VocabDeck.tsx:275-276` `onLeft={deck.next}` `onRight={onRight}` · `deck.ts` `resistX(x, canGoNext, canSkip)` · `cardFirst.ts` `rightAction`·`canAskSkip` · `useVocabDeck.ts:301-335` `next`/`prev`.
- `SwipeCardStack` 은 `VocabDeck` 하나만 쓰므로 오늘의 단어와 주제 덱이 같은 동작을 공유한다.
- 키보드는 이미 ← = 이전, → = 다음이라 새 제스처와 방향이 일치한다.

## 분류 메모 (착수 때 Leader)

- task-070. 화면 동작 변경 → judge: light·demo 면제.
