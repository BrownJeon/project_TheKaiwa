---
imp_id: IMP-0053
title: "오늘의 회화 말하기(⑤) 「내가 한 말」에 한글 번역을 함께 표기"
status: planned
screen: "§12 오늘의 회화(레슨) ⑤ 말하기 — 「내가 한 말」"
area: behavior
priority: ""
found_on: "app/phone"
created: 2026-10-18
updated: 2026-10-18
observed_ref: 513f518
related_task: "[[task-056-improve-talk-phrase-helper]]"
planned_task: "[[task-077-improve-lesson-speak-translation-helper]]"
tags:
  - type/improvement
aliases:
  - IMP-0053
---

## 현상

오늘의 회화 5단계 「말하기」에서 말하면 「내가 한 말」 말풍선에 인식된 일본어 문장 + 후리가나 + 한글 발음 줄이 나온다. **한국어 뜻(번역)은 없다.** 반면 같은 화면의 「모범 답안」에는 한국어 뜻이 있다. 사용자가 방금 한 말이 한국어로 무슨 뜻인지 알 수 없다.

(조사 사실, Explore 보고 2026-10-18 — 구현 때 재확인) `StageSpeak.tsx` 270–281 «내가 한 말»은 `JaText` + `HangulLine` 뿐. 발화 제출 #62b(`POST /api/v1/lessons/:id/speaking`)는 **LLM 이 없고**(목표 표현 포함 여부만 코드 판정) 응답에 번역이 없다. `/api/v1/text/annotate` 도 형태소 분석(후리가나·발음)만 하고 번역은 안 한다. 번역을 이미 쓰는 곳(채팅 `userKo`·#32t `userTranslation`)은 전부 LLM 생성이다.

## 기대하는 모습

> 내가 한말에 대해서 한글로 번역한 것도 함께 표기해줘

(사용자 요청 + 화면 캡처, 2026-10-18 — 캡처에서 인식 결과가 `私はハンコクの進んでいますまだ 勉強ディ・ヨン号の 勉強です` 처럼 **뒤틀려 있다**)

- 「내가 한 말」 말풍선에 한국어 번역이 함께 보인다.

## 근거 · 분류 메모 (착수 때 Leader)

- 공짜로 얻을 곳이 없다: 번역은 별도 LLM 호출 1회(또는 내 말이 모범 답안과 같을 때 `modelKo` 재사용)가 필요하다 → 비용·지연·한도 결정이 필요하다(task-077 이력서 열린 결정).
- **불편한 사실**: 인식이 뒤틀린 문장은 번역도 이상한 한국어가 된다(있는 그대로 번역하기 때문). 화면에서 어떻게 보일지(힌트 유무)가 설계 쟁점이다.
- 영향 파일 후보: `components/lesson/{StageSpeak,lessonCopy}.tsx`, 새 훅·새 라우트(`POST /api/v1/lessons/:id/speaking-translation` 가칭, 계약 #185 후보), `modules/conversation/prompts/userTranslation.ts`(재사용), `docs/design/api-contract.md`, `docs/screens.md` §12.
