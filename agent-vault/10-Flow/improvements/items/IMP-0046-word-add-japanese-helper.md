---
imp_id: IMP-0046
title: "단어 추가 시트에 일본어 도우미(가あ) 추가 — 회화방 입력 줄과 같은 방식"
status: done
screen: "§4 단어장(/drawer/words) 단어 추가 시트 — 표현 칸"
area: ui
priority: ""
found_on: "app/web"
created: 2026-10-15
updated: 2026-10-15
observed_ref: 746d54c
related_task: "[[task-056-improve-talk-phrase-helper]]"
planned_task: "[[task-072-improve-word-add-helper]]"
tags:
  - type/improvement
aliases:
  - IMP-0046
---

## 현상

단어 추가 시트의 표현 칸에는 일본어를 직접 써야 한다(키보드 또는 task-069 「말로 쓰기」 — 인식기가 일본어 고정). 「임팩트」처럼 **한국어로만 아는 단어의 일본어 표기를 모르면** 넣을 길이 없다(사용자 사례: 말로 쓰기가 「インペクト」로 잘못 받아 적혀 「일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다.」로 거절됨).

## 기대하는 모습

> 업로드한 사진의 표시한 영역에서의 회화 메뉴의 방식과 같이 일본어 도우미를 추가해줘.

(사용자 요청, 2026-10-15 밤 — 첨부 사진: 회화방 하단 입력 줄을 동그라미로 표시. 왼쪽 키보드 · 가운데 마이크 · 오른쪽 둥근 「가あ」 = task-056 일본어 도우미 버튼.)

회화방 도우미 방식 = 한국어 **글자**로 질의 → 일본어 후보(최대 3, 표현·읽기·뜻·재생·왜 자연스러운지) → [입력창에 넣기]. 이를 단어 추가 시트에 같은 방식으로 붙인다.

## 근거

- 재사용 대상(task-056, 사용자 승인 데모): `src/components/talk/{PhraseHelperButton,PhraseHelperPanel,PhraseHelperCard,PhraseHelperTip,usePhraseHelper}.tsx` · 서버 `conversation/chats/phraseHelp.ts`(`helpPhrase`)·`prompts/phraseHelp.ts`(`phraseHelp@v1`, haiku·12s)·`types/phraseHelp.ts`.
- **걸림돌**: 서버 입구가 채팅방에 묶여 있다 — `POST /api/v1/chats/[id]/phrase-help`(#180), `helpPhrase(userId, chatId, …)` 가 대화의 소유·`kind=TALK`·종료 여부·역할극 장면을 읽는다. 프롬프트 입력 자체는 `{queryKo, level, scene}` 뿐이라 **채팅방 없는 입구**를 새로 만들면 된다.
- 질의 입력은 한국어 **글자**(음성 제외) — 온디바이스 인식기가 일본어 모델이라 한국어 음성은 새 인식 경로가 필요(task-056 사용자 결정 2026-10-11 「글자 입력으로 시작하자」 유지).
- 프롬프트는 「말하려는 표현」용(말투 변형 `labelKo`·`whyKo`)이라 **한 단어 질의(임팩트)가 사전형 표제어로 나오는지** prompt-engineer 확인 필요.
- 한도·동시성: 사용자당 분당 10·하루 300·동시 1건(`PHRASE_BUSY`), Claude CLI 큐 직렬이라 회화 턴과 서로 늦출 수 있음(task-056 기록).

## 분류 메모 (착수 때 Leader)

- 새 서버 입구 + 새 화면 판 + 프롬프트 확인 → standard·데모(회화방 데모 기반 delta) 예상. 관련: [[IMP-0043-words-add-mic-input]](마이크 말로 쓰기), 「임팩트」 실패 조사(2026-10-15), 후보 W-1~W-4 범위 정리.
