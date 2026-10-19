---
imp_id: IMP-0035
title: "하단 메뉴 「오늘」 문구를 「공부」로 변경(메뉴를 가리키는 화면 문구 포함)"
status: done
screen: "§1 앱 셸·하단 탭"
area: copy
priority: ""
found_on: ""
created: 2026-10-12
updated: 2026-10-19
observed_ref: 2e02ed8
related_task: ""
planned_task: "[[task-065-improve-menu-copy]]"
tags:
  - type/improvement
aliases:
  - IMP-0035
---

## 현상

(task-060 배포 뒤 사용자 요청, 2026-10-12)

## 기대하는 모습

> '오늘'메뉴의 문구를 '공부'로 변경해줘.

## 근거

- 정의 위치: `src/components/shell/TabBar.tsx:16` (`label: '오늘'`). 이 탭을 가리키는 화면 문구(「오늘로」 뒤로 버튼, 「오늘 탭 …」 안내)도 같은 이름으로 맞춘다. 「오늘의 단어/회화/평가」 같은 **기능 이름·날짜 표현은 바꾸지 않는다**.

## 분류 메모 (착수 때 Leader)

- [[IMP-0036-talk-header-free-conversation]] 과 같은 task(task-065, light)로 묶는다. 문구만 변경(화면 구조·동작 변경 없음).
