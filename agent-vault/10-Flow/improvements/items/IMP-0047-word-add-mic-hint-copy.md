---
imp_id: IMP-0047
title: "단어 추가 「말로 쓰기」 안내 문구 — 일본어 발음으로 말하라는 예시와 인식 직후 확인 안내"
status: planned
screen: "§4 단어장 단어 추가 시트 — 표현·예문 「말로 쓰기」(task-069)"
area: copy
priority: ""
found_on: "app/web"
created: 2026-10-16
updated: 2026-10-16
observed_ref: 746d54c
related_task: "[[task-069-improve-word-add-mic]]"
planned_task: "[[task-073-improve-word-add-copy]]"
tags:
  - type/improvement
aliases:
  - IMP-0047
---

## 현상

「말로 쓰기」 안내가 「일본어로 말하면 표현이 바뀌어요. 칸에 들어간 뒤 고칠 수 있어요.」뿐이라, **한국어 발음으로 말하면 엉뚱한 글자가 들어간다**는 점이 드러나지 않는다(사용자 사례 2026-10-15: 「임팩트」를 말했더니 「インペクト」가 들어가 거절됨).

## 기대하는 모습

> 승인 (범위: W-2 마이크 안내 문구 — Leader 정리안 2026-10-16: 「일본어 발음으로 말해 주세요 (예: インパクト)」, 인식 직후 「잘못 알아들었을 수 있어요」)

## 근거

- 인식기가 일본어 고정(`speech/speech.config.yml:63`)이라 한국어·영어식 발음의 외래어는 오인식되기 쉽다 — 실측 사례 1건(インペクト).
- 문구 위치: `src/components/vocab/labels.ts` `WORD_MIC_COPY.hint`(표현·예문), 인식 직후 안내는 `WordMicField`/`useWordMic` 의 결과 반영 단계.

## 분류 메모 (착수 때 Leader)

- task-073(W-2+W-3 묶음, light). 한국어 음성 인식(W-4)은 제외 — 새 인식 경로가 필요하고 「안드로이드 기본 STT 미사용」 원칙과 충돌.
