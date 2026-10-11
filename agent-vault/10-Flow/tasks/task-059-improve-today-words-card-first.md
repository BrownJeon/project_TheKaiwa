---
task_id: task-059
title: "오늘의 단어: 카드 우선 방식 통합 — 푸는 방식 선택 제거·카드 기본·카드 탭 시 객관식·뜻 보기 면 단어/예문 재생 버튼 (IMP-0011, 데모 delta, standard 트랙)"
status: doing
base_ref: 382d10f
risk_level: "R2"
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-008-vocab-today-words, task-023-improve-vocab-screen, task-046-improve-tab-loading-flicker, task-049-topic-word-examples]
imp: [IMP-0011]
tags:
  - type/task
  - domain/improvement
  - domain/vocab
aliases:
  - 오늘의 단어 카드 우선
  - task-059
created: 2026-10-11
updated: 2026-10-11
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-059-today-words-card-first-v1.html"
  artifact_url: ""
  content_sha256: "5ee92a5850232c1aabe270522a3a6bd1240e9dde16f36c60e59911af1cd7a671"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: "user"
  approved_at: "2026-10-11T22:37:03+09:00"
  approval_quote: "task-059 데모 v1 승인, D0~D8은 권고대로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-059 — 오늘의 단어: 카드 우선 방식 통합 (IMP-0011)

## 사용자 요청·결정 (원문)
- **IMP-0011 기대(2026-09-30)**: 「방식을 객관식과 카드로 선택하는 것이 아니라 기본은 카드로 생성해주고 카드를 탭하면 객관식으로 고를수있도록 하고 '뜻 보기'로 나온 카드에서 단어와 예제 문장의 발음을 들을수있도록 재생버튼을 만들어줘」
- **추가 지시(2026-09-30)**: 오늘의 단어 **참고 화면을 업로드해 주겠다**(아직 도착 전). **스와이프는 기존과 똑같이 동작**(제스처·판정·동작 변경 없음). 참고 화면에서 가져오는 것은 **버튼 구성뿐이며 더 간소하게** 표현한다.
- **Q9 결정(2026-10-03, AskUserQuestion 권고안)**: **「답한 방식대로 기록」** — 스와이프만 한 카드 = 지금 FLIP 자가 표시 그대로, 객관식으로 고른 카드 = 서버 채점(CHOICE 와 같은 규칙), 정답·오답은 합산. 예(세트 5장): 食べる 오른쪽 스와이프(알아요)=정답(자가) · 行く 탭→객관식 '가다'=정답(채점) · 水 탭→객관식 '불'=오답(채점) · 高い 뜻 보기 후 왼쪽(몰라요)=오답(자가) · 友達 위 스와이프=다시 보기. 「표(DB) 변경 없이 가능」이라고 안내함 — attempt 의 `choices`·`chosenText` 로 구분.
- **2026-10-11 착수 결정**: 사용자 질문 「오늘의 단어의 개선작업은 언제 진행되는거야?」 → 선택 「**지금 전체 착수 (Recommended)**」(참고 화면 없이 설명만으로 designer 데모 v1부터, 참고 화면은 도착하면 v2 에 반영). **데모를 사용자가 승인하기 전에는 화면 코드를 쓰지 않는다.**

## 관련 과거 이력 요약 (Leader 큐레이션)
- **현재 구조(2026-10-11 코드 확인)**: `src/components/vocab/TodayWordsCard.tsx:195` 에 `Segmented<VocabMode>` 「푸는 방식」(`MODE_OPTIONS` :24 — 4지선다 CHOICE / 뒤집기 카드 FLIP)과 「카드 장수」 선택. 덱 화면 `VocabSessionScreen`(83줄)·`VocabDeck`(243)·`VocabCardFace`(215)·`useVocabDeck`(494)·`deck.ts`(300)·`ChoiceList`·`FlipControls`·`SwipeCardStack`·`useAttemptQueue`. 세트 생성 API #47~#54 의 body `mode`, `VocabSession.mode`. **screens.md §5(1300행~)** 가 화면 가이드, 「E9 소리 버튼 없음」이 현재 설계.
- **재생 버튼 선례**: IMP-0001(task-023) 이 단어 상세 시트에 소리 듣기를 넣었다 — `WordSoundButton.tsx`·`useWordSound.ts`·`wordSound.ts`(범용 TTS 재생, 후리가나 토글·재생 큐 `speech/tts` 층 사용). 예문 재생(`example`/`exampleKo`)은 같은 경로로 가능한지 설계에서 확인.
- **채점 모델**: CHOICE 는 서버 채점(`attempt` 에 `choices`·`chosenText`), FLIP 은 자가 표시(알아요/몰라요/다시 보기). Q9 로 두 방식이 한 세트 안에 섞인다 → `VocabSession.mode` 값을 어떻게 둘지(예: 시작은 FLIP 로 저장·카드별 기록으로 구분 / 혼합 표시)가 developer·reviewer 와 정할 사항(스키마 0 원칙).
- 같은 카드 화면이 쓰이는 곳: 내 단어장 세트(`TodayWordsCard`)·주제 세트(`TopicWordsCard`)·챌린지 세트(`ChallengeStrip`)·재풀기·보관 세트(`KeptSets`) — 방식 선택 제거가 이들에 미치는 범위를 designer 가 확인해야 한다.
- 직전 영향: task-053(단계 우선 가중)·task-057(세트 생성 지연: 쓰기 COMMIT 대기, 코드 변경 없음)은 이 화면 구조와 무관.
- 승인된 교훈(`/이슈기록 관련 vocab 화면`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 2.02 · **R2**(키워드 규칙 `R2-kw-migration` — 스키마 변경 없음을 명시했으나 키워드로 상향) · developer=**opus** · **standard** · demo=**delta**(designer 소유, `DM-low-confidence`) · `next=demo_first`. 역할 designer → developer → reviewer → qa. 입력·결과: 스크래치 `judge-059-intake*.json`.

## 설계 (Leader — designer 가 화면 흐름을 데모로 제안, 사용자가 승인)
1. **방식 선택 제거**: `TodayWordsCard` 의 「푸는 방식」 선택을 없애고 세트는 항상 카드로 시작한다. 「카드 장수」 선택은 유지(범위 밖).
2. **카드 탭 → 객관식**: 카드(앞면 또는 뜻 보기 면)를 탭하면 같은 카드에서 4지선다로 고를 수 있다. 고르면 서버 채점(정답/오답 표시, CHOICE 와 같은 규칙). **스와이프의 제스처·판정·동작은 변경 없음**(정정 2026-10-11: 실제 스와이프는 위 = 다시 볼 카드 토글 · 왼쪽 = 다음 카드(답한 뒤에만) · 오른쪽 = 이전 카드이고, 알았어요/몰랐어요는 뜻 보기 면의 **버튼** — 아래 Q9 예시와 위 사용자 요청란의 「오른쪽 스와이프(알아요)」 서술은 앞선 Leader 예시의 오류였음. 사용자에게 알리고 D0 으로 확인). 탭과 스와이프의 충돌 규칙(탭 영역·길게 누름·키보드/TalkBack 대체 입력)은 designer 가 정한다.
3. **뜻 보기 면 재생 버튼**: 단어와 예문(후리가나/한글 표시 설정 그대로)을 각각 들을 수 있는 재생 버튼. 버튼은 **참고 화면의 구성을 따르되 더 간소하게** — 참고 화면 도착 전에는 designer 가 최소 구성안을 제안.
4. **기록**: Q9 대로 답한 방식대로. 합산 규칙·통계(`StatsSnapshot`)·세트 종료 요약 화면에서 객관식/자가 구분 표시 여부는 데모의 「결정 필요」로.
5. **호환**: 진행 중이던 세트·보관 세트·재풀기·주제/챌린지 세트·`VocabSession.mode` 기존 값(CHOICE/FLIP) 모두 깨지지 않게. API 응답 모양 변경이 필요하면 developer 가 계약(#47~#54)을 먼저 갱신하고 Leader 확인.

## 확정 결정 (사용자 승인 「task-059 데모 v1 승인, D0~D8은 권고대로」, 2026-10-11 22:37)

> 근거·모양: [[task-059-designer-record]] · 데모 `docs/demo/task-059-today-words-card-first-v1.html`(sha256 `5ee92a58…a7671`). **구현이 어긋나면 데모가 아니라 이 표를 기준으로 reviewer 가 반려한다.**

| # | 결정 | 확정(권고 A) |
|---|---|---|
| D0 | 스와이프의 뜻 | **A** 지금 그대로(위=다시 볼 카드·왼쪽=다음·오른쪽=이전). 알았어요/몰랐어요는 뜻 보기 면 **버튼**. |
| D1 | 어디를 탭하면 객관식 | **A** 앞면 아무 곳 탭(10px 미만 판정 그대로)으로 열고 다시 탭하면 닫힘. 같은 일을 하는 [객관식] 버튼도 둠. |
| D2 | 답한 뒤 넘어가기 | **A** 객관식은 그 자리에 머물고 [다음 카드], 스스로 표시는 0.4초 뒤 자동(둘 다 현재 동작). |
| D3 | 재생 버튼 | **A** 카드 바로 아래 한 줄에 [단어 듣기][예문 듣기]. 예문이 없거나 100자 초과면 [단어 듣기]만. |
| D4 | 키보드·TalkBack | **A** 모든 제스처에 화면 버튼과 키(새로 C 키), 초점 이동·화면 읽기 알림. |
| D5 | 결과에서 채점 방식 구분 | **A** 합산 타일 그대로 + 섞였을 때만 구분 한 줄(#49 `chosenText` 유무로 화면이 셈). |
| D6 | 이전 세트 | **A** 시작한 방식 화면 그대로 + 듣기 버튼 추가, 다시 풀기는 새 방식(카드 우선). |
| D7 | 버튼 최소안 | **A** 도구 줄 4칸 그대로(앞면 보기 버튼 8개→6개). 참고 화면이 오면 v2 에서 재검토. |
| D8 | 시작 카드 설명 문구 | **A** 그대로. |

**서버 명세(Leader 확정, `docs/design/api-contract.md` §2-10 #47·#50·#53 갱신 완료 — 스키마 변경 0)**:
- 카드 우선 세트 = `VocabSession.mode='FLIP'`(기존 값) + 카드마다 `choices`(풀 ≥4·서로 다른 뜻 ≥4일 때, 아니면 세트 전체 `choices:null` → 화면이 객관식 숨김). `mode` 생략 기본은 `FLIP`. `mode:'CHOICE'` 명시는 이전 그대로(이전 세트 호환).
- #50: `FLIP` 세트는 `selfResult` 와 `chosenText` 를 카드 한 장에 **하나만** 받는다(둘 다 → 400 `exclusive`). `chosenText` 는 서버 채점(`=== meaningSnap`), `choices` 에 없으면 400 `not_in_choices`. `CHOICE` 세트에 `selfResult` 는 계속 400 `mode`. 합산·`WordEntry` 카운터·반복 항목·관측·finish #51 은 변경 없음.
- #53: 다시 풀기는 원래 `CHOICE` 여도 새 세트는 `FLIP`+`choices`.
- 구현 지점(코드 확인 2026-10-11): `sessions.ts` `insertSession`(:352 — `mode==='CHOICE'` 일 때만 `choices` 를 만들던 것을 `FLIP` 에도), `recordAttempt`(:692 — `choice` 시도의 `s.mode !== 'CHOICE'` 400 을 `FLIP` 허용으로, `flip` 시도의 `s.mode !== 'FLIP'` 400 은 유지), `replayVocabSession`(:869~ — 새 세트 방식), 라우트 기본 `mode`, `toCardDto`(FLIP 카드에 `choices` 노출), 주제 세트 경로(`createTopicVocabSession` — 같은 `insertSession`).
- **L1 판단(Leader)**: FLIP 세트는 이미 뜻을 처음부터 싣고 있어 `choices` 가 정답을 더 드러내지 않는다. 「정답은 서버만 안다」(§5-0 3)는 `CHOICE` 세트에만 남기고 채점은 계속 서버 — reviewer 가 이 판단을 감사한다. **L2**(#50 혼합 수용)·**L3**(`choices` 없음 → 객관식 숨김 + 안내)·**L4**(#53 새 방식)는 위 명세로 확정. **L5·L6**(자리표시 `TODAY_CARD_H` 재측정 — 홈 카드가 약 75px 낮아짐 `[추측]`, `kaiwa.vocab.mode` 정리, `keyAction` C 키, 듣기 버튼 접근 이름, 덱용 짧은 실패 문구)는 구현 지시에 포함.

## 하지 않는 것
- 스와이프 제스처·판정 변경, 스키마 변경(DB 추가는 사용자 승인 사항), 단어 가중(task-053)·세트 생성 로직 변경, TTS 엔진/음성 설정 변경, 챌린지·주제 세트의 규칙 변경(화면 공유 범위 확인만).

## 완료 기준
1. 사용자가 데모 vN 을 승인(문장 그대로 기록).
2. tsc·eslint 0, 기존 세트·덱·시도 큐 시험이 수정 없이 통과(비호환 없음) + 새 시험(탭→객관식 전환·혼합 세트 기록·재생 버튼 배선·모드 제거 호환), reviewer 가 실행 증빙 재실행·변이 확인.
3. QA(QA 계정만, 쓰기 후 원복): 360/390/412 폭 가로 넘침 0·터치 44px·스와이프 불변·탭→객관식 정답/오답 서버 채점·혼합 세트 합산·재생 버튼(후리가나 설정 반영)·진행 중/보관/재풀기 세트 호환·주제/챌린지 세트 회귀·실기기 확인 항목 구분.
4. 배포 후 읽기 전용 스모크(웹만, DB 변경·APK 없음), 사용자 폰 확인.

## 상태 로그
- 2026-10-11 착수(IMP-0011 `triaged` → 사용자 「지금 전체 착수」). 접수·묶음(base_ref `382d10f`). 다음: 데모 게이트 init → designer 데모 v1.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-11 22:04 |
| v1 | 검토요청 | docs/demo/task-059-today-words-card-first-v1.html | - | 사용자 검토 요청 | 10-11 22:31 |
| v1 | 승인 | docs/demo/task-059-today-words-card-first-v1.html | - | "task-059 데모 v1 승인, D0~D8은 권고대로" | 10-11 22:37 |
