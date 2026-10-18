---
imp_id: IMP-0048
title: "뜻 채우기가 일본어가 아니라고 판정할 때 오타 단정 문구 완화"
status: done
screen: "§4 단어장 단어 추가 시트 — 표현 판정 실패 안내(`wordEnrich` invalidReason)"
area: copy
priority: ""
found_on: "app/web"
created: 2026-10-16
updated: 2026-10-16
observed_ref: 746d54c
related_task: "[[task-068-improve-wordbook]]"
planned_task: "[[task-073-improve-word-add-copy]]"
tags:
  - type/improvement
aliases:
  - IMP-0048
---

## 현상

표현 판정이 실패하면 선생님(LLM)이 사유를 한 문장으로 적는데, 사용자 사례(2026-10-15)에서 「일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다.」처럼 **틀린 추측을 단정**했다(실제 의도는 インパクト). 사용자에게 도움이 안 되고 오히려 혼란을 준다.

## 기대하는 모습

> 승인 (범위: W-3 판정 문구 단정 완화 — Leader 정리안 2026-10-16)

## 근거

- `src/modules/conversation/prompts/wordEnrich.ts` 규칙(`:92`): 「한국어·영어·오타·의미 없는 문자열이면 valid=false 로 하고 invalidReason 에 한국어로 이유를 한 문장」 — 추측을 단정하지 말라는 제약이 없다.
- 화면 문구 틀(`DRAFT_INVALID` = 「일본어 단어로 보기 어려워요. 표현을 확인해 주세요.」)은 이미 부드러운 편 — 문제는 그 아래 줄(LLM 이유)이다.
- 프롬프트 변경은 Prompt Registry 버전·회귀 픽스처가 따라간다(prompt-engineer 몫).

## 분류 메모 (착수 때 Leader)

- task-073(W-2+W-3 묶음, light). 가까운 일본어 후보를 자동 제안하는 W-1 은 도우미(task-072)가 대체해 제외했다.
