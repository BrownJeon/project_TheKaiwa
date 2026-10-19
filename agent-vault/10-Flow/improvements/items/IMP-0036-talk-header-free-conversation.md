---
imp_id: IMP-0036
title: "회화 홈 상단 문구 「AI와 공부하기」를 「자유로운 대화」로 변경"
status: done
screen: "§3-2 A 회화 홈(/study/ai)"
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
  - IMP-0036
---

## 현상

(task-060 배포 뒤 사용자 요청, 2026-10-12)

## 기대하는 모습

> 그리고 '회화' 메뉴의 상단의 'AI와 공부하기' 문구는 '자유로운 대화'로 변경해줘

## 근거

- 정의 위치: `src/app/(app)/study/ai/(tab)/page.tsx:17` (`AppBar title="AI와 공부하기"`)와 로딩 자리표시 `src/components/chat/StudyAiSkeleton.tsx:43`. 하단 탭 라벨 「회화」는 그대로.

## 분류 메모 (착수 때 Leader)

- [[IMP-0035-tab-label-today-to-study]] 과 같은 task(task-065, light)로 묶는다. 문구만 변경.
