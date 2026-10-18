---
imp_id: IMP-0049
title: "단어장 즐겨찾기 — 목록에서 바로 등록·조회 필터·상세/수정 화면에서도 등록"
status: planned
screen: "§4 단어장(/drawer/words) — 단어 목록·조회 필터·상세 시트·수정 폼"
area: behavior
priority: ""
found_on: "app/web"
created: 2026-10-18
updated: 2026-10-18
observed_ref: 6445dba
related_task: "[[task-068-improve-wordbook]]"
planned_task: "[[task-074-improve-word-favorites]]"
tags:
  - type/improvement
aliases:
  - IMP-0049
---

## 현상

단어장에는 단어를 따로 표시해 두고 골라 볼 방법이 없다. 보관(`archived`)은 「이제 안 볼 단어」를 치우는 기능이라 「자주 다시 보고 싶은 단어」를 표시하는 용도와 다르다.

## 기대하는 모습

단어장에 **즐겨찾기** 기능을 추가한다(사용자 요청 원문: 「단어장에 즐겨찾기 기능을 추가해줘. 단어목록에서 바로 등록할수있도록 해주고 조회필터에 즐겨찾기를 추가해줘. 또한 즐겨찾기 추가는 상세화면과 수정화면에서도 등록할 수 있도록 해줘」).

1. **단어 목록(행)에서 바로** 즐겨찾기를 등록·해제할 수 있다(상세를 열지 않고).
2. **조회 필터**에 즐겨찾기가 추가된다(즐겨찾기한 단어만 보기).
3. **상세 화면**과 **수정 화면**에서도 즐겨찾기를 등록·해제할 수 있다.

## 근거

- 사용자 요청 2026-10-18(task-072·073 폰 확인 정상 직후).
- 저장 구조 후보(Leader 사전 확인 [확실]): `UserWordState`(`prisma/schema.prisma:903`)가 기본 단어·내 단어 공통의 사용자별 상태(보관 포함)를 담는다 → `favorite` 칸을 여기에 두면 기본 단어도 즐겨찾기할 수 있고 보관(`ArchiveToggle`·`/words/[id]/archive`·`unarchive`·`archived=1` 쿼리)과 같은 구조로 만든다. 단 **DB 칸 추가는 사용자 승인 사항**(개발·운영이 같은 NAS DB).
- 목록 조회 필터는 현재 검색·출처(전체/내 단어/기본)·분류·조각·정렬·보관함이 AND(`parseWordListQuery`, `WordsScreen`).

## 분류 메모 (착수 때 Leader)
- 2026-10-18 Leader: 사용자 직접 지시로 즉시 착수 → [[task-074-improve-word-favorites]]. 화면 신규·구조 변경이라 데모 검토 게이트 대상(사용자 데모 승인 후 구현), DB 칸 추가는 별도 사용자 승인.
