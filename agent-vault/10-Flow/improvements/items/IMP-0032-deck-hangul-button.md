---
imp_id: IMP-0032
title: "오늘의 단어 덱: [읽기](히라가나)와 한글 표기 분리 — [건너뛰기] 자리에 [한글] 버튼"
status: planned
screen: "§5 오늘의 단어 덱"
area: ux
priority: ""
found_on: ""
created: 2026-10-12
updated: 2026-10-12
observed_ref: b89d779
related_task: "[[task-059-improve-today-words-card-first]]"
planned_task: "[[task-060-improve-deck-controls]]"
tags:
  - type/improvement
aliases:
  - IMP-0032
---

## 현상

(task-059 배포 뒤 사용자 사용 중 제기. 사용자 원문 번호 2)

## 기대하는 모습

> 카드 하단의 '읽기' 버튼을 히라가나 표기와 한글표기가 함께있는데 이것을 분리해줘. 한글표기는 '한글'이라는 버튼으로 생성해주고 '건너뛰기' 버튼을 제거하고 그자리에 배치해줘.

## 근거

- 현재 코드: 도구 줄 `DeckToolbar` 안 답한 지금 카드 = [이전][읽기][표시][건너뛰기]. [읽기] 하나가 `showReading` 한 값으로 앞면 표제어 후리가나(히라가나)와 한글 표기(`faceHangul = showReading && layers[view].hangul`)를 같이 켠다(`VocabDeck.tsx`).
- [건너뛰기] 버튼 제거 자체는 [[IMP-0033-deck-swipe-right-skip-confirm]] 에서 오른쪽 슬라이드 확인 방식으로 대체된다.

## 분류 메모 (착수 때 Leader)

- [[IMP-0031-deck-swipe-up-peek]] 과 같은 task(task-060)로 묶는다. 화면 구조 변경 → 데모 검토 게이트 대상.
