---
imp_id: IMP-0005
title: "AI강사 음성이 어색함 — 억양·말투 설정이 플러그인에 종속되는지 확인"
status: planned
screen: ""
area: ""
priority: "P1"
found_on: ""
created: 2026-09-30
updated: 2026-09-30
observed_ref: 055dbcf
related_task: ""
planned_task: "[[task-022-improve-voice-range]]"
tags:
  - type/improvement
aliases:
  - IMP-0005
---

## 현상

ai강사의 목소리가 어색하고 억양이나 말투변경에 따라서 음성의 변화가 많지않은데 이것에 대한 설정은 플러그인에 종속되어있는건가?

## 기대하는 모습

(질문 — 착수 시 TTS 파라미터(Style-Bert-VITS2/SpeechProfile) 설정 범위를 확인해 답변)

## 근거

## 분류 메모 (착수 때 Leader)

- 사실 조사(질문 답변): **플러그인에 종속되지 않는다.** 안드로이드 플러그인 `@thekaiwa/sherpa-stt` 는 음성 **인식(STT)** 전용이고 TTS 는 맥 M4 의 Style-Bert-VITS2 서비스(`speech/tts-service`, :8200)가 만든다. 목소리·억양은 서버 쪽 값으로 정해진다.
- 억양·말투 결정 경로: `parameterResolver.ts` — 사용자 설정 > VoiceProfile 기본값 > 페르소나 > 대화 상황 > LLM `speech.style` 순으로 덮는다. 사용자가 조절 가능한 범위는 speed 0.6~1.2·pitch 0.8~1.2·intonation 0.8~1.2·styleWeight 0~2 (`RANGES`). LLM 은 스타일 이름 하나만 내고(ENCOURAGING·CHEERFUL·CALM·NEUTRAL) 실제 voice 가 가진 스타일로만 매핑된다.
- **변화가 적은 이유**: ① 시드 음성 모델 3종(jvnv-F1/F2/M1-jp)의 등록 스타일이 `Neutral`·`Happy` 둘뿐(`prisma/seed-data/voices.json`) — `Friendly`·`Calm` 은 후보 목록에 있어도 없어서 건너뛰고 Neutral 로 떨어진다. ② `renderingPlan.ts` 의 상황별 조정폭이 작다(styleWeight ×0.8~1.1, intonation ×0.95~1.15). ③ pitch/intonation 이 1.0 이 아니면 서버가 pyworld 후처리를 돌려 음질이 약간 떨어지고 지연이 +0.25초쯤 늘어(`kaiwa_tts/params.py` 주석) 기본값이 1.0 이다. 사용자가 설정 화면에서 값을 바꿨는지도 영향.
- 영향 파일(개선 시): `voices.json`(스타일 추가는 M4 쪽 모델 스타일 벡터 필요), `renderingPlan.ts`, `parameterResolver.ts`, `speech/tts-service`. 규모 M(원인 실측 후 확정). Leader 의견: 답변 자체는 끝났다. "어색함"이 어떤 장면(회화방 AI 응답 / 오늘의 회화 / 단어)인지, 사용자 설정을 만졌는지 확인한 뒤 튜닝 task 로 갈지 결정 — Q4. 코드 수정 전 M4 실측 필요(Codex 게이트 대상 아님).

## 착수 결정 (사용자 답변, 2026-09-30)

- Q4 "내가 ai강사를 어색하다고 느낀건 설정화면의 미리듣기였는데 … 일단은 설정에서 억양, 말투, 속도의 변경 차이를 지금의 2배가량 더 넓게 설정할수있도록 해줘" — 이번에는 범위 확대만, 다른 화면 어색함은 사용자 재테스트 뒤 판단.
- 우선순위·순서는 사용자가 지정하지 않아 **Leader 권고 순서**(P1→P2→P3)를 잠정 채택했다. 사용자가 바꾸면 이 값을 고친다.
- 담당 task: [[task-022-improve-voice-range]]
