---
imp_id: IMP-0033
title: "오늘의 단어 덱: [건너뛰기] 버튼 제거 — 카드 오른쪽 슬라이드 시 건너뛸지 확인 안내 후 건너뛰기"
status: done
screen: "§5 오늘의 단어 덱"
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
  - IMP-0033
---

## 현상

(task-059 배포 뒤 사용자 사용 중 제기. 사용자 원문 번호 3)

## 기대하는 모습

> 2번의 '건너뛰기' 버튼 제거에 대하여 해당 기능은 카드를 오른쪽 슬라이드하게되면 건너뛸것인지에 대한 안내 문구를 띄워주고 사용자가 확인하면 건너뛰기가 되도록 변경해줘

## 근거

- 현재 코드: 오른쪽 슬라이드 = **이전 카드로**(`onRight={deck.prev}`), 건너뛰기는 도구 줄 [건너뛰기] 버튼·키 S(`deck.skip`, 안 답한 지금 카드에서만). 이번 요청으로 오른쪽 슬라이드의 의미가 「이전」 → 「건너뛰기(확인 뒤)」로 바뀌므로 「이전 카드」는 도구 줄 [이전] 버튼·키로만 남는다.

## 분류 메모 (착수 때 Leader)

- 사용자에게 알릴 결정거리(designer 데모에서 권고안과 함께 제시): ① 오른쪽 슬라이드가 안 답한 지금 카드가 아닐 때(이미 푼 카드·지난 카드) 동작 ② 확인 UI 모양(바닥 시트 vs 카드 위 띠) ③ 키 S 의 동작(바로 건너뛰기 vs 같은 확인).
- [[IMP-0031-deck-swipe-up-peek]]·[[IMP-0032-deck-hangul-button]] 과 같은 task(task-060). 화면 구조 변경 → 데모 검토 게이트 대상.
