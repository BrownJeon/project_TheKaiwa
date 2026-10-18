---
imp_id: IMP-0051
title: "오늘의 단어·회화를 챌린지 난이도 기준으로 생성하고, 챌린지가 없으면 프로필 목표수준 기준으로 — 챌린지를 만들 때 목표를 설정할 수 있게"
status: inbox
screen: "§5 오늘의 단어 · §12 오늘의 회화(레슨) · 챌린지 만들기(/plan/challenge/new)"
area: behavior
priority: ""
found_on: "app/web"
created: 2026-10-18
updated: 2026-10-18
observed_ref: 89fcefc
related_task: "[[task-040-improve-challenge-design]]"
planned_task: ""
tags:
  - type/improvement
aliases:
  - IMP-0051
---

## 현상

오늘의 단어·오늘의 회화를 만들 때 쓰는 수준 기준이 챌린지·프로필 목표와 일관되지 않다(Leader 가 코드로 읽어 확인한 현재 모습 — 착수 때 한 번 더 확인):

- **오늘의 회화(레슨)**: 활성 챌린지가 있으면 챌린지의 `level` 로 추천한다(`modules/learning/lessons/today.ts:97`). 챌린지 없이 자유로 만들면 프로필의 **현재 수준** `level` 을 쓴다(`lessons/generate.ts:134`) — 목표 수준(`goalLevel`)은 쓰지 않는다.
- **오늘의 단어**: 세트 만들기 상한이 프로필의 `level` 과 `goalLevel` 중 **높은 쪽**이다(`vocab/sessions.ts:442-451`, `setGenerator.ts` `ceilingOf`). 활성 챌린지의 `level` 은 읽지 않는 것으로 보인다.
- **챌린지의 난이도(`Challenge.level`)는 사용자가 정하지 않는다** — 만들 때 선택한 **주제의 `level` 을 그대로 복사**한다(`challenges/service.ts:107`). 챌린지 만들기 화면의 단계 「주제 → 기간 → 목표 → 확인」 중 「목표」는 하루 과제(`dailyGoal`: 레슨 여부·단어 개수)이지 난이도나 목표 수준이 아니다.

## 기대하는 모습

> 오늘의 단와 회화를 생성할때 챌린지의 난이도에 따라서 생성하도록 해주고 챌린지가 없다면 프로필에 생성되어있는 목표수준에 맞춰서 생성할수있도록해줘. 그렇게 하려면 챌린지를 설정할때 목표를 설정할수있도록 해줘

(사용자 요청 `/개선작업`, 2026-10-18)

1. **활성 챌린지가 있으면** 오늘의 단어·오늘의 회화 생성이 그 **챌린지의 난이도**를 기준으로 한다.
2. **챌린지가 없으면** 프로필에 설정된 **목표 수준**(`goalLevel`)을 기준으로 한다.
3. 위가 되려면 **챌린지를 설정(만들기)할 때 목표를 설정**할 수 있어야 한다.

## 근거

- 프로필에는 현재 수준 `level`(기본 N5)과 목표 `goalLevel`·`goalTopics`·`goalDeadline` 이 이미 있다(`prisma/schema.prisma` Profile).
- 챌린지 모델은 `level JlptLevel` 과 얼려 둔 `dailyGoal` 을 가진다(`schema.prisma` model Challenge, task-041 설계 `challenge.md`).
- 비슷한 기존 항목(모두 `done`, 겹치지 않음): IMP-0024 챌린지 기능 추가 · IMP-0028 오늘의 단어 단계 우선 가중(내 수준보다 어려운 단계가 쏠리지 않게) · IMP-0025 강사 응답 수준.

## 분류 메모 (착수 때 Leader)
- 2026-10-18 Leader 접수: `/개선작업` 에 `착수` 가 없어 **추가만** 한다. 구현은 사용자가 `착수` 를 지시할 때.
- **하나의 기능으로 접수한다**(생성 기준 변경과 챌린지 설정 화면 변경이 서로를 전제함). 크기가 크면 착수 때 task 를 나눈다(예: ① 생성 기준 규칙 ② 챌린지 설정 화면).
- **착수 전에 사용자와 정해야 할 질문(사실 확인 필요)**:
  1. 「챌린지를 설정할 때 목표」가 무엇인가 — (a) 챌린지의 **난이도(JLPT 단계)를 사용자가 직접 고르기**(지금은 주제 난이도 복사) (b) 챌린지 기간 끝에 도달할 **목표 수준** (c) 지금의 하루 과제(`dailyGoal`) 설정을 다른 말로 부른 것. 한 가지로 정해야 DB(`Challenge`에 칸이 필요한가)와 화면이 정해진다.
  2. 「챌린지 난이도에 따라 생성」의 **적용 범위** — 오늘의 단어 세트(풀 상한·가중)와 오늘의 회화(레슨) 둘 다인지, 챌린지 **주제 단어 세트**(`topicId` 세트)도 포함인지.
  3. 챌린지가 없을 때 프로필 `goalLevel` 이 **없는(null)** 사용자의 처리 — 지금처럼 현재 수준으로 되돌릴지.
  4. 오늘의 단어는 지금 「현재 수준과 목표 수준 중 높은 쪽」이 상한인데, 새 규칙(챌린지 > 목표 수준)이 이 상한·task-053 의 단계 우선 가중과 어떻게 합쳐지는지 — 어려운 단계가 쏠리는 문제(IMP-0028)가 다시 생기지 않게.
- **DB 변경 가능성**: (1)-(a)/(b) 를 고르면 `Challenge` 에 칸이 추가될 수 있다 → 개발·운영이 같은 NAS DB 라 **사용자 승인 사항**(백업 후 db push). 화면은 챌린지 만들기 단계가 바뀌므로 **데모 검토 게이트** 대상(데모 → 사용자 승인 → 구현). 생성 규칙은 LLM 프롬프트 입력(수준)을 바꾸므로 prompt-engineer·judge 판정 대상일 수 있다.
- 영향 파일 후보(추정): `lessons/{today,generate}.ts`, `vocab/{sessions,setGenerator}.ts`, `challenges/{service,validate,progress}.ts`, `components/challenge/ChallengeCreateScreen.tsx`, `docs/design/challenge.md`.
