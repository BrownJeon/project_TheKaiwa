---
imp_id: IMP-0043
title: "단어 추가할 때 키보드 입력과 마이크(말해서) 입력 둘 다 가능하게"
status: planned
screen: "§4 단어장(/drawer/words) 단어 추가 시트"
area: ui
priority: ""
found_on: "app/web"
created: 2026-10-15
updated: 2026-10-15
observed_ref: 473de65
related_task: "[[task-068-improve-wordbook]]"
planned_task: "[[task-069-improve-word-add-mic]]"
tags:
  - type/improvement
aliases:
  - IMP-0043
---

## 현상

단어 추가 시트(`WordAddSheet`)의 표현·읽기·뜻·예문 칸은 키보드로만 쓸 수 있다. 말해서 넣는 길이 없다.

## 기대하는 모습

> 단어 추가할때 키보드로 작성하는것과 마이크로 말해서 입력하는 것 둘다 가능하도록 해줘

(사용자 요청, 2026-10-15)

## 근거

- 실시간 인식은 **일본어로 고정**돼 있다(`speech/speech.config.yml:63` `language: ja`, 한국어 섞임 오인 방지로 자동 감지 끔). 그래서 마이크로 말해 넣을 수 있는 칸은 일본어 칸(표현·읽기·예문)뿐이고, 한국어 칸(뜻·예문 뜻·메모·분류)은 키보드만 된다 — 사용자 요청의 범위를 데모에서 확인받는다.
- 이미 있는 재료: `useRealtimeStt`(`purpose:'MIC_TEST'` = 원음 저장 안 함, 질문 탭·수업 「말로 쓰기」가 쓰는 길) · `useSpeechConfig`(#19 한 번 읽기) · 온디바이스/서버 경로 자동 선택·마이크 권한 안내. 새 인식 경로를 만들지 않는다(엔진명은 화면에 안 나온다).
- 단어 추가 시트는 두 단계(표현 한 칸 → [뜻 채우기] → 폼)이고 같은 `WordForm` 을 단어 수정 시트도 쓴다. 마이크를 폼 공용 칸에 붙이면 수정 시트에도 생기는지 여부를 정해야 한다(요청은 「추가할 때」).

## 분류 메모 (착수 때 Leader)

- task-069. 화면 변경(칸 옆 마이크 버튼) → judge 가 데모 수준을 정한다.
