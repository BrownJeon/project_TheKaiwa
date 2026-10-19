---
imp_id: IMP-0054
title: "오늘의 회화 말하기(⑤)에 일본어 도우미 추가 — 회화방과 같은 배치·기능, 하단 입력 영역 공통화·재사용"
status: done
screen: "§12 오늘의 회화(레슨) ⑤ 말하기 하단 입력 영역 · §22 일본어 도우미"
area: behavior
priority: ""
found_on: "app/phone"
created: 2026-10-18
updated: 2026-10-19
observed_ref: 513f518
related_task: "[[task-056-improve-talk-phrase-helper]]"
planned_task: "[[task-077-improve-lesson-speak-translation-helper]]"
tags:
  - type/improvement
aliases:
  - IMP-0054
---

## 현상

AI 회화방(회화 탭)에는 일본어 도우미(한국어로 물으면 일본어 표현 1~3개 제안, 입력 영역 우측 끝 「가あ」 버튼, task-056·061)가 있지만, **오늘의 회화 5단계 「말하기」에는 없다.** 말하기 중 할 말이 막혀도 도움을 받을 수 없다.

(조사 사실, Explore 보고 2026-10-18 — 구현 때 재확인) 레슨 ⑤ 하단 영역(`StageSpeak.tsx` 369–435)은 회화방의 `VoiceBar`·`Composer` 와 **코드를 거의 공유하지 않고 인라인으로 다시 만들었다**(키보드·마이크 아이콘, 상태 줄 grid, textarea 복제). 공유하는 것은 `PushToTalkButton`·`MicLevelMeter`·`SttAlert`·`useRealtimeStt`(레슨은 `useLessonVoice` 가 감쌈) 정도다. 도우미 훅 `usePhraseHelper`(`chatId`·`ended`·`onEnded`·URL 이 박힘)와 서버 `helpPhrase`(`chat.kind === 'TALK'` 검사)는 회화방 전용 가정이 있다. 질문 탭(`useAskInput.tsx`)이 `VoiceBar`+`Composer` 묶음을 한 훅으로 재사용한 선례가 있다.

## 기대하는 모습

> 회화메뉴에 있는 일본어 도우미 기능을 추가해줘. 배치와 기능은 기존에 구현되어있는 회화화면의 배치로 동일하게 구현해줘. 가능하다면 기존에 있는 입력 영역을 공통화하여 재사용할 수도있도록 설계해서 구현해줘

(사용자 요청 + 화면 캡처, 2026-10-18)

- 말하기 단계에서 회화방과 **같은 위치·같은 동작**의 일본어 도우미를 쓸 수 있다(음성 모드: 입력 영역 우측 끝 버튼 · 글자 모드: 입력 줄 마이크 옆, 판은 입력 영역 위로 열림, 글자 모드에서만 [입력창에 넣기]).
- 하단 입력 영역(마이크·글자 입력·도우미 버튼)을 회화방과 공통 컴포넌트/훅으로 만들어 재사용한다 — 가능한 범위에서(동작 회귀가 없는 선까지).

## 근거 · 분류 메모 (착수 때 Leader)

- **불편한 사실**: 공통화는 회화방·질문 탭·시나리오가 쓰는 `VoiceBar`·`Composer` 를 건드릴 수 있어 회귀 위험이 크다. 고정 마크업 시험 `voiceSharedFrozen.test.ts`(기본 마크업 21종)가 있어 **새 prop 없이 그린 결과는 한 글자도 달라지면 안 된다**. 또 레슨 글자 입력의 동작(Enter 는 Shift 없으면 항상 전송, 초안 sessionStorage 즉시 기록, 높이 상한 150px)이 `Composer`(모바일 Enter = 줄바꿈, 초안 300ms 디바운스, 136px)와 다르다 — 통일하면 모바일 Enter 동작이 바뀐다.
- 서버: 레슨 맥락용 새 입구가 필요하다(#181 단어 도우미는 사전형 표제어 모드 고정). `helpWordPhrase` 가 `chatId=null` 로 `runPhraseHelp` 를 부르는 모양이 본보기. 한도(분당 10·하루 300)·동시 1건 잠금은 #180/#181 과 키를 공유하는 것이 기본 — 합산할지는 열린 결정.
- 영향 파일 후보: `components/lesson/{StageSpeak,useLessonVoice,LessonScreen,lessonCopy}`, `components/talk/{VoiceBar,usePhraseHelper,PhraseHelperPanel,PhraseHelperCard,helperCopy,phraseHelperLogic}`, `components/chat/Composer`, 새 `lessonVoiceView`, `modules/conversation/chats/phraseHelp.ts`, 새 라우트(`POST /api/v1/lessons/:id/phrase-help` 가칭, 계약 #184 후보), `docs/design/api-contract.md`, `docs/screens.md` §12-2·§22, 시험(`voiceSharedFrozen`·`phraseHelper*`).
