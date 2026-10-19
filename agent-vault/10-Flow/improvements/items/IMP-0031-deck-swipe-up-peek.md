---
imp_id: IMP-0031
title: "오늘의 단어 덱: 카드 위로 슬라이드 = 뜻 보기, 하단 [뜻 보기]·[객관식] 버튼 제거"
status: done
screen: "§5 오늘의 단어 덱 (+§23 카드 우선)"
area: ux
priority: ""
found_on: ""
created: 2026-10-12
updated: 2026-10-19
observed_ref: b89d779
related_task: "[[task-059-improve-today-words-card-first]]"
planned_task: "[[task-060-improve-deck-controls]]"
tags:
  - type/improvement
aliases:
  - IMP-0031
---

## 현상

(task-059 배포 뒤 사용자 사용 중 제기. 사용자 원문 번호 1)

## 기대하는 모습

> 단어장 카드의 위로 슬라이드하는 것을 '뜻 보기'기능으로 변경하고 하단의 '뜻 보기' 버튼과 '객관식' 버튼은 제거해줘.

## 근거

- 현재 코드: 위로 슬라이드 = 「표시」(다시 볼 카드) 토글(`VocabDeck.tsx` `onUp={deck.toggleFlag}`), 하단 `FlipControls` 앞면 = [뜻 보기][객관식] 두 칸(`FlipControls.tsx`), 카드 탭 = 객관식 열기(`cardFirst.tapAction`).
- task-059 확정 결정 D0(스와이프는 지금 그대로)을 사용자가 이번 요청으로 바꾼다 — 위로 슬라이드의 의미가 바뀌므로 「다시 볼 카드 표시」는 하단 도구 줄 [표시] 버튼으로만 남는다.

## 분류 메모 (착수 때 Leader)

- IMP-0032·0033 과 같은 화면·같은 제스처 지도(위/오른쪽/탭)·같은 하단 영역을 건드려 **한 task(task-060)** 로 묶는다. 원문 번호 2·3 은 [[IMP-0032-deck-hangul-button]]·[[IMP-0033-deck-swipe-right-skip-confirm]].
- 화면 구조 변경 → 데모 검토 게이트 대상(사용자 승인 뒤 구현).
