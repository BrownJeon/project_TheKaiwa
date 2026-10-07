---
imp_id: IMP-0025
title: "AI 강사의 응답·교정은 일상회화에서 쓰는 문법·단어를 중심으로, JLPT 식 문법 표현은 추가 설명으로"
status: planned
screen: ""
area: "behavior"
priority: "P2"
found_on: ""
created: 2026-10-06
updated: 2026-10-06
observed_ref: e4f99cf
related_task: ""
planned_task: "[[task-039-improve-tutor-explanation]]"
tags:
  - type/improvement
aliases:
  - IMP-0025
---

## 현상

(원문에 현상 설명 없음 — 기대하는 모습만 기재.)

## 기대하는 모습

사용자 원문(그대로):

```
2. AI강사가 응답하거나 교정해 줄때는 일상회화에서 주로 사용하는 문법이나 단어를 메인으로 알려주고 JLPT와 같은 문법적인 표현들은 추가 설명으로 알려줬으면 좋겠어.
```

## 근거

사용자 구두 요청 2026-10-06 — 첨부 파일·스크린샷 없음.

## 분류 메모 (착수 때 Leader)

**재확인(2026-10-06, 현재 코드 `5c3a701` 기준): 부분 해결 — 핵심 요구("일상회화 메인 + JLPT 식 추가 설명")는 유효.**
- 이미 있는 것: 페르소나 "원어민 관점"(교과서 일본어와 실제가 다르면 둘 다 보이고 어느 쪽이 자연스러운지 한 줄 — `tutor.md` §1·§2·§4)·N5·N4 는 문법 용어 없이 쉬운 말(task-028)·교정 설명 "어느 조각이 왜 틀렸는지 1~2문장". **JLPT 를 직접 지시하는 문구는 없다**(급수는 난이도 척도 `목표 JLPT Nx` 와 단어 `jlpt` 필드뿐).
- **없는 것**: "일상회화에서 실제 쓰는 문법·단어를 메인으로, JLPT 식 문법 표현은 추가 설명으로" 라는 **규칙**과 응답 계약의 **"추가 설명" 칸**(`correction.explanationKo`·`learning.grammarPoint`·`difficulty` 모두 단일 문자열). TALK 프롬프트는 페르소나 §2(원어민 관점)를 **싣지 않는다**(§1·3·4·6만). 레슨 문법 단계는 "핵심 문형" 중심(`lesson.ts:256`). 실제 출력이 JLPT 식인지는 라이브 실측 전이라 `[추측]`.
- 방안 **A 문구만**(스키마·화면 무변경): `tutor.md` §1 또는 §3 에 원칙 1줄 + `talk.ts:233-236`·`chatReview.ts:83`·`lesson.ts:256` 문구 수정. TALK 페르소나 한도 2,800자 대비 여유 약 250자(`persona.test.ts:20`), A1 3,000자 예산 마진 좁음, 프롬프트 버전 `talk@v9`·`chatReview@v2`·`lesson@v9`. `task028.test.ts:84-111`("문법 용어는 쓰지 않습니다" 단언) 갱신 필요.
- 방안 **B "추가 설명" 칸(additive)**: `schemas.ts`(예 `extraNoteKo` nullable)·`checks.ts`·`TutorCorrection`·`orchestrator`·`types/chat.ts`·`CorrectionCard.tsx`(접이식 줄) 등 — 출력 토큰 증가(TALK 5초·TTFA 예산), `Correction.explanation` 컬럼은 하나라 새 컬럼은 **DB 승인**, 합쳐 저장하면 불필요.
- Leader 의견: **A 먼저**(작고 독립적, PE 가 라이브 샘플로 효과 측정) → 부족하면 B. 화면 변경 없음 → 데모 게이트 불필요(방안 B 에서 접기 UI 가 생기면 delta 데모). 프롬프트 계약 변경이라 PE + developer + reviewer + QA(라이브 측정), judge intake 로 트랙 판정.
