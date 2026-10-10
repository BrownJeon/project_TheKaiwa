---
task_id: task-012b-2
title: "음성 P2 ② 분석 결과 화면 — 재확인 2안 카드(회화방·채팅방)·내 발화 기록·평가 결과 인식 텍스트 표기"
status: done
base_ref: 5c3a701
risk_level: R1
roles_involved: [leader, judge, designer, developer, reviewer, qa]
related_tasks: [task-012b-speech-p2, task-007-talk-voice-web, task-006-chat-correction, task-011-ai-evaluation, task-039-improve-tutor-explanation, task-010d-scenario-roleplay]
tags:
  - type/task
  - domain/speech
  - domain/ui
aliases:
  - 재확인 카드
  - 내 발화 기록
  - task-012b-2
created: 2026-10-06
updated: 2026-10-10
demo_gate:
  required: true
  level: "delta"
  status: "waived"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: "user"
  waived_at: "2026-10-06T23:43:51+09:00"
  waiver_quote: "데모 생략하고 진행해줘"
  active: false
---

## 목표 (Leader)
분석 STT(task-012b, 운영 워커 가동 중)가 판정한 **재확인 필요 발화**(`requiresReview`)를 학습자에게 보여 주고, 학습자가 두 안(실시간·분석) 중 하나를 고르거나 직접 고쳐 확정(#21a)하게 한다. 함께 **내 발화 기록**(지난 발화 목록·원음 30일 재생·확정 상태)과 **AI 평가 결과의 말하기 답 텍스트 출처 표기**를 연다. 대화 턴 지연·메시지 원문·교정 원문에는 영향이 없어야 한다.

## 사용자 결정·지시
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"** — 데모 승인 생략 의사. 단 `check.mjs waive` 가 이 문장을 인식하지 못해 **게이트 기록은 없다**(waived 아님, 훅 warn 단계). designer 는 승인용 데모 대신 **구현 가이드**를 낸다.
- 같은 날 사용자 답(AskUserQuestion, Leader 전달): DB 전부 승인(챌린지 D1·D2·D4·D5 + `EngineMetricsDaily` 컬럼 + `Correction.extraNoteKo`) · **운영 배포는 모든 작업이 끝난 뒤 한 번에** · M4 설치·배포 포함 · 챌린지 U3=B2. → 이 task 는 DB 변경 없음, push·배포는 Phase 2 일괄 마지막에.
- [[task-012b-speech-p2]] U3("재확인 2안 카드·발화 로그 데모 승인 + 발화 로그 위치")는 위 지시로 **데모 승인 없이 진행**. 위치는 아래 설계 방침의 권고안으로 Leader 가 정하고 최종 보고에 명시한다(사용자 확인 전 결정이라는 사실을 숨기지 않는다). U7(임계 0.85·ACCURATE 0.90)은 기본값 유지.

## 설계 방침 (Leader 초안 — designer·developer 가 확정)
- **카드를 띄우는 조건**: `status=ANALYZED && requiresReview=true && finalSource=REALTIME` 인 발화만. 이미 "글자로 고치기"로 확정된 발화(`finalSource=USER`)는 서버가 `requiresReview=false` 로 저장한다(task-012b ⑫ 확정 — `docs/design/api-contract.md:617`) [확실].
- **카드 문구 원칙**: "분석 안이 늘 옳다"로 쓰지 않는다 — 분석 STT 가 짧은 합성 음성에서 오히려 틀린 사례가 있었다(「駅はどこですか」→「低級はどこですか」, [[task-012b-speech-p2]] 285행). "이렇게 들렸어요 / 이렇게도 들렸어요 / 직접 고치기" 3선택, 엔진명 0.
- **확정의 효과**: #21a 는 `Utterance.finalText/finalSource` 만 바꾼다(D-B6) — 보낸 메시지·교정 원문·평가 답은 그대로. 카드에 "기록만 고쳐져요(이미 보낸 말과 교정은 그대로예요)" 류 안내를 둔다.
- **카드가 뜨는 시점**: 분석은 사용자별 디바운스(마지막 발화 +20초, 상한 첫 발화 +5분 — [[task-012b-speech-p2]] 539행)라 **대화가 멈춘 뒤** 결과가 나온다. 방에 들어올 때 + 방이 화면에 보이는 동안 저빈도 확인(예: 30초, 보일 때만) [추측 — developer 가 부하·배터리 기준으로 확정].
- **데이터 경로(파일 경계 핵심)**: conversation 의 메시지 DTO(#29)·`src/types/chat.ts` 를 **건드리지 않는다**. 새 사용자 API `GET` 발화 목록(소유자만, `chatId`·`reviewable` 필터, #22 형태 축약, 엔진 정보 0)을 speech 쪽에 두고 화면이 메시지 id ↔ 발화 `chatMessageId` 로 맞춘다 — 6층 원칙 "conversation↔speech 는 라우트·화면이 조합"과 같은 방향. API 번호는 Leader 가 배정(`#155~#160` 은 챌린지 예약 — `docs/design/challenge.md:758`).
- **내 발화 기록 위치(권고)**: **설정 › 음성 인식 아래 "내 발화 기록"** — 서랍장 전체는 Phase 3(014), 관리자 진단은 사용자 화면이 아니다. 목록 = 날짜·방 이름·텍스트(확정본)·재확인 표시·원음 재생(#21b, 30일 뒤 "원음 보관 기간이 지났어요"). 하단 탭 변경 없음.
- **평가 결과**: 말하기 문항 답 옆에 채점에 쓴 텍스트의 출처(D-B7: 직접 고친 글 / 다시 들은 결과 / 실시간 인식)를 짧게 표기 — 엔진명 없이.
- 5초 예산: 이 task 는 턴 경로를 건드리지 않는다. 목록 API 는 DB 만(목표 p95 ≤300ms [설계 목표]).

## 예상 변경 경로
- 서버: `src/modules/speech/utterances/**`(목록 함수) · `src/modules/speech/index.ts`(공개 API 추가) · `src/app/api/v1/speech/utterances/route.ts`(기존 POST #21 옆에 GET) 또는 새 하위 경로 · `src/types/`(새 `speech.ts` 또는 `talk.ts` 의 발화 타입 — `chat.ts` 금지)
- 화면: `src/components/speech/UtteranceReviewCard.tsx`(신규) · 회화방 삽입 지점(`src/components/talk/TalkRoom.tsx` 또는 사용자 말풍선 부품) · 채팅방 삽입 지점(`src/components/chat/MessageList.tsx` 또는 `MessageBubble.tsx`) · `src/components/eval/{EvalResult,EvalItems}.tsx` · 설정 진입(`src/components/settings/SpeechSettings.tsx`) · 새 화면 `src/app/(app)/settings/utterances/page.tsx`(경로는 designer)
- 문서: `docs/screens.md`(designer, 웨이브 끝 일괄) · `docs/design/api-contract.md`(Leader)
- 테스트: `src/modules/speech/__tests__/**` · `src/components/speech/__tests__/**` · `tests/live/task012b2-smoke.ts`(신규)

## 파일 경계 (다른 WP 와 충돌 방지 — [[phase2-batch-plan]] §2)
- **039 가 커밋되기 전에는 `src/components/chat/**` 를 건드리지 않는다**(039 미커밋: `MessageList.tsx`·`CorrectionCard.tsx`·`messages.ts`·`labels.ts`·`ChatReview.tsx`).
- `src/components/talk/TalkRoom.tsx` 는 이 task 가 먼저, 010d-B 가 나중(삽입은 최소 줄로 — 카드 부품은 `components/speech/` 에).
- `TalkTutorBubble.tsx`·`useTalkPlayback.ts` 는 012b-4 소유 — 건드리지 않는다.
- `conversation/**`·`src/types/chat.ts`·`prisma/**` 금지. 정본 문서는 Leader.
- 미러 `~/.node-local/thekaiwa-012b2`(dev 포트 3027), 라이브는 QA 계정 1·2(IDOR) — [[phase2-batch-plan]] §3·§6.

## 완료 기준 (QA 가 실행으로 확인)
1. 재확인 대상 발화가 있는 회화방·채팅방에서 카드가 해당 사용자 말풍선에 붙고, 세 선택 각각 #21a 성공 후 카드가 사라진다. 대상이 아닌 발화(`requiresReview=false`·`finalSource≠REALTIME`·`status≠ANALYZED`)에는 카드 0.
2. 확정 전후 `ChatMessage.content`·`Correction.original`·평가 답 바이트 일치(D-B6), 바뀐 것은 `Utterance.finalText/finalSource` 뿐.
3. 목록 API: 소유자만(타인 404·무세션 401), 응답·화면에 엔진명·`engineVersions` 0, `chatId` 필터가 다른 사람 방이면 404.
4. 내 발화 기록: 목록·원음 재생(30일 이내)·보관 기간 지난 원음 안내·빈 상태·오류 상태.
5. 평가 결과의 텍스트 출처 표기가 D-B7 규칙과 일치(직접 고침 / 분석 / 실시간).
6. 360/390/412 × 높이 780/892 가로 넘침 0, 터치 44px, 화면당 스크롤 1곳, 키보드(직접 고치기 입력)에서 입력칸 가림 없음.
7. 회화 턴 p50·TTFA 회귀 없음(이 task 는 턴 경로 무변경 — 카드 확인 요청이 턴 중 화면을 막지 않는지 확인).
8. 회귀: 단위 전부 + 스모크 007·006·011.

## 관련 과거 이력 요약
- [[task-012b-speech-p2]]: #22 GET·#21a PATCH(`{choice:'REALTIME'|'ANALYSIS'|'USER', text?}`) 서버 완료·운영 반영, 워커 2026-10-01 운영 기동. D-B5(분석만으로 finalText 불변)·D-B6(Utterance 만 변경)·D-B7(평가 채점 텍스트 선택)·⑫(USER 확정 발화는 서버가 재확인 제외). 신뢰도 분포 참고: p50 1.0, 0.85 미만은 합성 20문장 중 1건(분석 쪽 오인).
- [[task-007-talk-voice-web]]: 회화방·발화 1회 연결·#21b 원음 재생 최소판. [[task-006-chat-correction]]: 채팅방·"글자로 고치기". [[task-011-ai-evaluation]]: 말하기 문항 채점·결과 화면.
- [[task-039-improve-tutor-explanation]]: 채팅·교정 화면 파일을 미커밋으로 수정 중 — 이 task 의 채팅방 삽입은 그 커밋 뒤.
- 승인된 교훈: 없음(`/이슈기록 관련 speech` 0건, 2026-10-06).

## 승인 상태
- **DB**: 변경 없음.
- **M4**: 해당 없음.
- **데모**: 사용자 지시로 승인 생략 의사 — 게이트 기록 없음(위 "사용자 결정·지시"). `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다.
- **네이티브/APK**: 없음(웹만).

## 판단 기록 (judge)

## Leader 기록 (Phase 2 일괄 접수, 2026-10-06 21:50)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev·fallback 없음): standard · developer=**opus** · risk=R1 · demo=delta(`DM-low-confidence`) · 규칙 덮어쓰기 없음. 결과 JSON `/tmp/judge-task-012b-intake.result.json`.
- **데모 승인 생략**: 사용자 지시(2026-10-06): "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". delta 데모(승인용)를 만들지 않고 designer 가 **구현 가이드**를 낸다. 데모 게이트 도구 `check.mjs waive` 는 이 문장을 생략 요청으로 인식하지 못해(정규식 `(데모|목업|시안|mockup|demo)\s*(는|은|를|을|도)?\s*(생략|없이…)` — "데모화면 승인없이" 불일치) **정식 waive 기록은 없다** — 게이트 상태는 `init` 직후 값 그대로이고 편집 훅은 warn 단계라 막지 않는다. 사용자가 도구가 인식하는 문장(예: "데모 생략하고 진행해줘")을 한 번 입력하면 정식 기록으로 바꾼다.
- **사용자 승인 사항(AskUserQuestion 2026-10-06)**: DB 변경 전부 승인(추가만·백업 후 통합 `db push`) · 운영 배포는 전부 끝난 뒤 한 번에 · M4 설치·배포 포함 · 챌린지 U3=B2.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-06 21:48 |
| - | 생략 | - | - | "데모 생략하고 진행해줘" | 10-06 23:43 |

## Designer 기록

- [22:02] 디자인 스킬: layout·component(`project-ui-system` 미적용 — 학습 앱 화면) / 자체 점검 P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 2 (아래 §9)
- [22:02] 승인용 데모 대신 **구현 가이드**(사용자 지시 "데모화면 승인없이" — 게이트 기록 없음, Leader 기록 참조). 참고용 HTML 은 만들지 않았다. `docs/screens.md` 반영은 웨이브 끝 일괄(Leader 지시 때). 근거 표기: `[확인]` = 이번에 코드·정본을 직접 읽음 · `[추측]`.

### 012b-2 구현 가이드 — 재확인 카드 · 내 발화 기록 · 평가 결과 채점 글 출처

승인 데모: 없음(사용자 지시로 승인 생략 의사, 2026-10-06 — 게이트 기록 없음). 쓰는 토큰 이름: `accent`·`accent-soft`·`surface`·`surface2`·`line`·`ink`·`ink2`·`good`·`good-soft`·`bad` — **새 색 0**. `warn`·`accent` 톤 Badge 글자와 `ink3` 글자 금지(screens §1-1).

#### 0. 먼저 볼 것 — 설계 방침과 다른 점 3
1. **채팅방(CHAT)에는 카드를 붙일 발화가 없다** [확인 — 코드 / DB 는 미확인]: `components/chat/{Composer,ChatRoom}.tsx` 에 음성 입력(speech·stt·PushToTalk) import 가 0건이고, TALK 방은 `ChatRoom.tsx:99-100` 이 회화방으로 돌려보낸다. 발화가 붙는 사용자 메시지는 회화방에서만 생긴다. → **`components/chat/**` 삽입을 하지 않는 것을 권고**(C11 충돌·039 대기 하나가 사라진다). 완료 기준 1 의 "채팅방"은 QA 가 "CHAT 방 메시지에 연결된 발화 0건(DB 조회)"으로 확인하도록 바꾸는 것을 권고(Leader 결정 D-3).
2. **평가 결과의 "내가 고친 말"은 지금 #66 만으로 구분할 수 없다** [확인]: D-B7 은 USER 확정을 `inputSource=TEXT` 로 남기고(`api-contract.md:1202`), 글자로 쓴 답도 TEXT 다. #66 `items[]` 에 발화 연결 여부가 없다(`src/types/evaluation.ts:26-45`). → `voiced` 같은 칸이 필요(계약, D-2). 없으면 TEXT 는 전부 "글자로 답함"으로 보인다(오표기).
3. **대화를 지워도 발화 행·녹음은 남는다** [확인 — `prisma/schema.prisma` `Utterance.chat … onDelete: SetNull`]: 내 발화 기록에 "지운 대화"로 남는다. 사용자 기대("대화를 지우면 사라진다")와 다를 수 있다 — 화면은 정직하게 보여 주되 정책은 Leader/사용자 판단(D-5).

#### 레이아웃 설계 (page-layout-designer 7항목)
| 항목 | 재확인 카드(회화방) | 내 발화 기록(신규 화면) |
|---|---|---|
| 목표 | 다르게 들린 내 말 하나를 그 자리에서 확정 — 대화 흐름·입력 바를 막지 않고 | 말로 한 기록을 훑고, 확인이 필요한 말(수업·평가 발화 포함 — 거기엔 카드 자리가 없다)을 처리하고, 녹음을 다시 듣는다 |
| 첫 위계 | 접힘 줄 "들린 말 확인"(있다는 것만) → 펼치면 두 안을 위아래로 | 머리(← 내 발화 기록) → 필터 [전체 / 확인 필요 n] → 날짜별 목록 |
| 영역 | 내 말풍선 바로 아래, 교정 카드 위(전체 폭) | BackBar · 소개 1줄 · 필터·표시 스위치 줄 · 목록 · 더 보기 · 맨 아래 보관 안내 |
| 컴포넌트 | `UtteranceReviewCard`(신규) · `UtteranceFixSheet`(신규, 공용 `Sheet`) · `JaText`/`HangulLine` · `diffCodepoints`+`changedRanges` | `BackBar` · `Segmented` · `DisplayToggles` · `ReplayButton` · `UtteranceReviewCard variant="log"` · `Badge` |
| 상태 | §2-A R0~R9 · §2-B | §2-C L1~L14 |
| 행동 | 주 [이걸로 기록하기] / 보조 [직접 고치기]·[나중에] | 주 행 [확인하기] / 보조 ▶ 내 목소리·원래 화면 보기·더 보기 |
| 반응형 | 360~412 모두 위아래 쌓기(나란히 없음 — 17px 일본어 두 문장을 가로로 두면 360 에서 한 칸 ≈140px) | 한 열, 행 버튼 줄 `flex-wrap` |

#### 1. 화면 개요
| 항목 | 내용 |
|---|---|
| 목적 | 분석 결과 "다르게 들렸다"(`requiresReview`)인 내 발화를 학습자가 확정(#21a) · 발화 기록 열람·원음 재생 · 평가 채점 글의 출처 표시 |
| 진입 | ① 회화방 `/study/ai/talk/[chatId]` 내 말풍선 아래 ② 설정 › 음성 인식 › **내 발화 기록** `/settings/utterances`(U3 위치 권고안 — 사용자 확인 전 Leader 결정이라는 사실을 최종 보고에 적는다) ③ 평가 결과 `/study/today/eval/[id]` 문항별 "내 답" |
| 가시성 | 로그인 사용자 본인 것만(타인 404). 관리자 전용 요소 0. 엔진명·신뢰도 숫자 0 |
| 앱/웹 | 차이 없음(웹 화면만, 네이티브 0) |
| 하단 탭 | `/settings/utterances` 는 집중 화면이 아니다 — **탭 보임**(`components/shell/routes.ts` 무변경 = C9 충돌 회피) |

#### 2. UI 구조 (의사코드, 390px)

**A. 재확인 카드 `UtteranceReviewCard` — 상태**
| id | 조건 | 보이는 것 |
|---|---|---|
| R0 숨김 | "띄우는 조건" 하나라도 아님 | 아무것도 없음(자리 0) |
| R1 접힘(기본) | 조건 충족 | 44px 줄 1개 |
| R2 펼침 | R1 탭 | 안내 · 두 안(라디오) · 버튼 |
| R3 한 안만 | 분석 글이 비었거나 실시간 글과 글자가 같음 | 둘째 칸 대신 "한 번 더 들어 봤지만 알아듣지 못했어요." · 라디오 없이 [이대로 기록하기](choice REALTIME) · [직접 고치기] |
| R4 기록 중 | PATCH 진행 | 주 버튼 "기록하는 중…" `aria-busy` · 라디오·보조 버튼 `aria-disabled` |
| R5 기록함 | 200 | 카드 자리에 상태 줄 1개(good) — 이 방을 떠날 때까지 유지 |
| R6 이미 처리 | 409 NOT_REVIEWABLE | 상태 줄(ink2) "이미 확인한 말이에요." → 다음 목록 갱신 때 사라짐 |
| R7 없음 | 404 | 상태 줄 "이 기록을 찾을 수 없어요." |
| R8 실패(재시도) | 429·0·5xx | 주 버튼 아래 `role="alert"` 한 줄, 고른 안 유지 |
| R9 직접 고치기 | [직접 고치기] | `UtteranceFixSheet` 열림(§2-B) |

**띄우는 조건**(순수 함수 `isReviewable(u)` — `components/speech/utteranceReview.ts`, 단위 테스트): `u.status==='ANALYZED' && u.requiresReview && u.finalSource==='REALTIME' && u.realtimeText.trim()!==''` 이고 그 메시지가 `localStatus!=='SENDING'`. (USER 확정 발화는 서버가 이미 `requiresReview=false` — task-012b ⑫. 화면에서 한 번 더 막는다.) `hasSecond(u) = !!u.analysisText?.trim() && u.analysisText.trim() !== u.realtimeText.trim()`.
**U7 임계 표시 방식**: 신뢰도 숫자·임계(0.85/0.90)는 **어디에도 표시하지 않는다** — 숫자는 "한쪽이 맞다"로 읽히고, 분석 쪽이 틀린 사례가 있다(「駅はどこですか」→「低級はどこですか」, task-012b 285행). 모드에 따른 차이는 내 발화 기록 맨 아래 안내 한 줄로만 말한다(§7 ⓜ).

```
(회화방 renderUser — UserBubble 다음, 인라인 교정 카드 목록 앞)
<div className="mt-1.5 w-full min-w-0">                                   ← 교정 카드와 같은 전체 폭
  R1 접힘 / R2 머리줄 (같은 버튼):
  <button type="button" aria-expanded={open} aria-controls={`urc-${id}`}
    className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
    <EarIcon aria-hidden className="flex-none text-accent" />               ← 18px 장식(모양 단서)
    <span className="flex-none text-[14px] font-semibold text-ink">들린 말 확인</span>
    <span className="min-w-0 truncate text-[13px] text-ink2">다시 들어 보니 다르게 들렸어요</span>
    <span aria-hidden className={`ml-auto flex-none text-ink2 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
  </button>
  R2 본문:
  <div id={`urc-${id}`} className="mt-1.5 min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
    <p className="text-[13px] text-ink2 break-keep">ⓑ</p>
    <fieldset className="mt-2.5 flex min-w-0 flex-col gap-2">
      <legend className="sr-only">내가 한 말 고르기</legend>
      <p className="sr-only">두 문장에서 서로 다른 곳에 밑줄이 있어요.</p>
      <label className={radioCard(sel==='REALTIME')}>
        <input type="radio" name={`urc-${id}`} value="REALTIME" className="sr-only" />
        <span aria-hidden className={dot(sel==='REALTIME')} />                ← 20px 원: 끔 ring-2 ink2 / 켬 inset 6px accent
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-ink">이렇게 들렸어요</span>
          <span className="block text-[12px] text-ink2">선생님은 이 말을 듣고 답했어요</span>
          <JaText text={realtimeText} state={annA} ranges={diffA} className="mt-1 whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
          <HangulLine state={annA} size={13} />
        </span>
      </label>
      <label … value="ANALYSIS"> "이렇게도 들렸어요" / "한 번 더 들어 본 결과예요" / analysisText(diffB) </label>
    </fieldset>
    {audioAvailable && variant==='room' ? <p className="mt-2 text-[12px] text-ink2 break-keep">ⓖ</p> : null}
    <Btn className="mt-3 w-full" aria-disabled={!sel || saving || undefined} aria-busy={saving || undefined}>이걸로 기록하기 | 기록하는 중…</Btn>
    {err ? <p role="alert" className="mt-1.5 text-[12.5px] text-bad break-keep">{err}</p> : null}
    <div className="mt-1 flex flex-wrap items-center gap-x-1">
      <button type="button" className="h-11 px-1.5 text-[14px] font-medium text-ink underline underline-offset-4">직접 고치기</button>
      <button type="button" className="ml-auto h-11 px-1.5 text-[14px] text-ink2">나중에</button>      ← 접기만(서버 요청 없음)
    </div>
    <p className="mt-1 text-[12px] text-ink2 break-keep">ⓕ</p>
  </div>
  R5: <p role="status" tabIndex={-1} className="rounded-xl bg-good-soft px-3 py-2 text-[13px] font-semibold text-good break-keep">ⓗ</p>
</div>
```
- `radioCard(on)` = `flex min-h-14 min-w-0 cursor-pointer gap-2.5 rounded-xl border p-3 ${on ? 'border-accent bg-surface shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line bg-surface'} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent` — 선택은 **테두리 굵기 + 점 모양** 두 단서(색만 아님, `EvalStartScreen.tsx:36` 과 같은 선택 표현).
- 다른 곳 밑줄: `diffCodepoints(a, b)`(`components/chat/diff.ts` — **수정 없이 import 만**) → `changedRanges(segs, 'underline decoration-accent decoration-2 underline-offset-[5px]')`. diff 가 `null`(200자 초과)이면 밑줄 없이. 밑줄 경계가 한자 묶음 한가운데면 그 묶음 읽기만 빠진다(`cutRubyByRanges` 규칙 — 허용).
- 표시 층: 카드가 펼쳐질 때만 `useAnnotations([realtimeText, analysisText])` 한 번(§15-2 B 묶기) — 접힘 상태에서 분석 요청 0. 번역 칸 없음(발화엔 번역이 없다).
- 펼침은 **방에서 한 번에 하나**(훅의 `openId`). 펼치기 직전에 `FollowHoldContext`(`components/chat/followHold.ts` — 039 신규 파일, **039 커밋 뒤** import)의 `holdFollow()` 를 불러, 목록이 바닥으로 따라가며 누른 카드를 밀지 않게 한다(task-039 ⑧ 과 같은 규칙).
- 아무것도 안 고르고 [이걸로 기록하기]를 누르면(aria-disabled) 그 자리 `role="alert"` "먼저 하나를 골라 주세요." — `disabled` 속성을 쓰지 않는 이유: 비활성 버튼은 초점·낭독에서 빠져 이유를 알 수 없다.
- 성공 시 초점은 R5 줄로 `focus()` — 버튼이 사라져 초점이 `body` 로 떨어지지 않게.

**B. 직접 고치기 시트 `UtteranceFixSheet`** (공용 `Sheet` — 포털·열 때 제목 초점·닫을 때 초점 복귀·Esc 는 Sheet 가 이미 한다 [확인 `Sheet.tsx:28-40`])
```
<Sheet open title="직접 고치기" dismissible={!saving} onClose>
  <p className="text-[13px] text-ink2 break-keep">내가 실제로 한 말을 일본어로 적어 주세요.</p>
  <label htmlFor={tid} className="mt-3 block text-[13px] font-semibold">내가 한 말</label>
  <textarea id={tid} lang="ja" rows={3} maxLength={1000} enterKeyHint="done" defaultValue={realtimeText}
    aria-invalid={!!err || undefined} aria-describedby={`${tid}-count${err ? ` ${tid}-err` : ''}`}
    onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-[1.6] text-ink" />
  <p id={`${tid}-count`} className="mt-1 text-right text-[12px] tabular-nums text-ink2">{n}/1000</p>
  {err ? <p id={`${tid}-err`} role="alert" className="text-[12.5px] text-bad break-keep">{err}</p> : null}
  <BtnRow><Btn aria-busy={saving || undefined}>이대로 기록하기 | 기록하는 중…</Btn><Btn variant="ghost">취소</Btn></BtnRow>   ← 확정 → 취소 순서(BtnRow 규칙)
</Sheet>
```
- 입력칸엔 루비·한글 줄을 달지 않는다(§15-1 F).
- 보내기 규칙(`fixChoice`): `t = text.trim()` · 빈칸 → "한 글자 이상 적어 주세요."(요청 없음) · `t === realtimeText.trim()` → `{choice:'REALTIME'}` · `t === analysisText?.trim()` → `{choice:'ANALYSIS'}` · 그 밖 → `{choice:'USER', text:t}`. 같은 글을 USER 로 보내면 "분석 안 채택률"이 흐려진다(`api-contract.md:615`).
- 성공 → 시트 닫음 → (여는 버튼이 사라졌으므로) 초점을 카드 R5 줄로 다시 옮긴다.

**C. 내 발화 기록 `/settings/utterances` — 상태**
| id | 상태 | 표시 |
|---|---|---|
| L1 | 첫 로딩 | 목록 자리 `role="status"` "불러오는 중…" — **글자 ink2**(공용 `LoadingBlock` 은 ink3 = 명암 미달, §1-1) |
| L2 | 빈(전체) | 점선 상자, 글자 ink2: ⓛ 3줄 + [회화하러 가기](→ `/study/ai?tab=talk`, `Btn variant="ghost"`) |
| L3 | 빈(확인 필요 필터) | "확인할 말이 없어요." |
| L4 | 오류 | `ErrorBlock`("기록을 불러오지 못했어요.", 다시 시도) |
| L5 | 목록 | 아래 행 |
| L6 | 더 보기 중 | 버튼 "불러오는 중…" `aria-busy` |
| L7 | 더 보기 실패 | 버튼 아래 "더 불러오지 못했어요." + [다시 시도] |
| L8 | 끝 | "처음 기록까지 다 봤어요"(12px ink2) |
| L9 | 원음 재생 | `ReplayButton` "▶ 내 목소리" → "불러오는 중…" → "■ 멈춤" |
| L10 | 원음 없음 | `audioAvailable:false` → 버튼 대신 "녹음 보관 기간(30일)이 지났어요" · #21b 404 → 토스트 "녹음이 없어요. 내 목소리는 30일 동안만 보관해요." 1회 + 그 행 버튼 숨김(`gone` Set) |
| L11 | 확인 카드 펼침 | 행 아래 `UtteranceReviewCard variant="log"`(한 번에 하나, 접힘 줄 없이 R2 본문부터) |
| L12 | 확인 성공 | #21a 응답(#22 형태)으로 **그 행만** 바꿈: 본문 = `finalText`, 칩 = 결과. "확인 필요" 필터에서도 **바로 빼지 않는다**(목록이 튀지 않게 — 다음 불러오기 때 빠짐) |
| L13 | 세션 없음 | 서버 컴포넌트가 `/login?callbackUrl=/settings/utterances` |
| L14 | 분석 전·분석 실패 발화 | 칩 없음 — 사용자가 할 일이 없어 노이즈를 만들지 않는다 |

```
page.tsx(서버): auth → <UtteranceLog />                 ← components/speech/UtteranceLog.tsx (client)
<BackBar backHref="/settings" backLabel="설정으로" title="내 발화 기록" />
<div className="px-4 pb-6">
  <p className="mt-3 text-[13px] text-ink2 break-keep">말로 한 문장이 어떻게 기록됐는지 볼 수 있어요.</p>
  <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
    <Segmented size="sm" ariaLabel="보기" value={filter} options={[{value:'all',label:'전체'},{value:'review',label: n ? `확인 필요 ${n}` : '확인 필요'}]} />  ← URL ?filter=review 유지
    <div className="ml-auto flex gap-1.5"><DisplayToggles keys={['fu','hg']} onToast={toast.show} /></div>   ← 번역 스위치 없음
  </div>
  <ul aria-label="내 발화 기록" className="mt-2 min-w-0">
    (날짜 바뀔 때) <li role="separator" …>{formatDateDivider(createdAt)}</li>     ← 채팅 목록과 같은 모양
    <li className="min-w-0 border-b border-line py-3">                                ← 행 ≥56px
      <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink2">
        <time dateTime>{formatClock}</time><span aria-hidden>·</span><span className="min-w-0 truncate">{contextLabel}</span><span aria-hidden>·</span><span className="flex-none">{s}초</span>
        {chip ? <span className="ml-auto flex-none"><Badge tone={chip.tone}>{chip.label}</Badge></span> : null}
      </div>
      <JaText text={finalText ?? realtimeText} state={anns[i]} className="mt-1 whitespace-pre-wrap text-[16px] leading-[1.7] [overflow-wrap:anywhere]" />   ← 루비 줄간격 2.1(기본)
      <HangulLine state={anns[i]} size={13} />
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[13px]">
        {audio ? <ReplayButton idleLabel="▶ 내 목소리" ariaLabel={`${시각}에 한 말 녹음 듣기`} … /> : <span className="text-[12px] text-ink2">녹음 보관 기간(30일)이 지났어요</span>}
        {review ? <button type="button" aria-expanded={open} aria-controls={`urc-${id}`} className="h-11 px-1.5 font-semibold text-ink underline underline-offset-4">확인하기</button> : null}
        {href ? <Link href={href} className="ml-auto inline-flex h-11 items-center px-1.5 text-ink2">{linkLabel} ›</Link> : null}
      </div>
      {open ? <UtteranceReviewCard variant="log" … /> : null}
    </li>
  </ul>
  {nextCursor ? <Btn variant="ghost" className="mt-3 w-full">더 보기</Btn> : items.length ? <p className="mt-3 text-center text-[12px] text-ink2">처음 기록까지 다 봤어요</p> : null}
  <div className="mt-6 rounded-xl bg-surface2 px-3.5 py-3 text-[12.5px] text-ink2 break-keep">ⓜ 3줄</div>
</div>
```
- 표시 층: 화면에 그린 행 본문을 `useAnnotations(texts)` 한 묶음으로(더 보기로 붙은 행은 다음 묶음 — 채팅 목록과 같은 규칙).
- 칩(`chipOf` — Badge 톤은 `neutral`·`good` 만): 확인 대기(`isReviewable`) = neutral "확인 필요" · `wasReviewTarget && finalSource==='REALTIME' && !requiresReview` = good "처음 들린 말로 확인" · `finalSource==='ANALYSIS'` = good "다시 들어 본 말로 확인" · `finalSource==='USER'` = neutral "내가 고친 말"(회화방 [글자로 고치기] 경로 포함) · 그 밖 칩 없음.
- 문맥(`contextOf`, 응답 `context.kind` 기준): TALK → "회화" · 링크 "회화에서 보기" `/study/ai/talk/{id}` / LESSON → "오늘의 회화" · "수업에서 보기" `/study/today/talk/{id}` / EVALUATION → "AI 평가" · 평가 id 가 있을 때만 "평가에서 보기" `/study/today/eval/{id}` / UNSENT → "보내지 않은 말"(링크 없음) / DELETED → "지운 대화"(링크 없음). 방 제목은 conversation 표라 speech 목록이 직접 읽지 않는다 — 라우트가 조합해 주면 "회화 · {제목}"(선택, D-1).
- 원음 재생: 화면 단위 큐 1개(`createTtsPlaybackQueue` + `playParts('mine', id, [(s) => apiGetAudio('/api/v1/speech/utterances/{id}/audio', {signal:s})])` — `useLessonPlayback.playMine` 과 같은 방식, 새 재생 경로 0). 탭 핸들러 첫 줄 `unlockTtsAudio()`. 화면 가림 `interrupt('HIDDEN')`, 언마운트 `dispose()`. 한 번에 한 행만 소리.

**D. 설정 진입 — `SpeechSettings.tsx` 의 `MicTestCard` 아래 한 줄**
```
<Link href="/settings/utterances" aria-label={n ? `내 발화 기록, 확인할 말 ${n}개` : undefined}
  className="mt-2 flex min-h-14 min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5">
  <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">내 발화 기록</span>
    <span className="block text-[13px] text-ink2 break-keep">말로 한 문장과 녹음(30일)을 볼 수 있어요</span></span>
  {n > 0 ? <Badge>확인 {n}</Badge> : null}<span aria-hidden className="text-ink2">›</span>
</Link>
```
- `n` = 목록 API `reviewableCount`(`limit=1` 로 한 번). 로딩·실패면 배지 없음 — 줄은 늘 보인다(모드 조회 실패와 무관).

**E. 평가 결과 — `EvalResult.tsx:126`(`MyAnswer` default 가지 = 듣고 답하기·상황 답하기) 한 줄 교체**
`<p className="text-[12px] text-ink2">{answerSourceLabel(it)}</p>` — 함수는 `evalCopy.ts`:
| `inputSource` | 발화 연결(`voiced`, D-2) | 문구 |
|---|---|---|
| `TEXT` | 없음·모름 | 글자로 답함(지금 그대로) |
| `TEXT` | 있음 | 말로 답함 · 내가 고친 말로 채점했어요 |
| `SERVER_STT` | — | 말로 답함 · 다시 들어 본 말로 채점했어요 |
| `REALTIME_STT` | — | 말로 답함 · 처음 들린 말로 채점했어요 |
| `null` | — | 줄 없음 |
- "채점 뒤에 기록을 고쳐도 점수는 그대로"는 결과 화면이 아니라 내 발화 기록 안내(ⓜ)에서 말한다(결과 화면에 경고를 늘리지 않는다).
- `EvalItems.tsx`(풀이 중)는 **무변경** — 채점 전엔 출처가 정해지지 않는다(D-B7: 채점 잡 시작 시점에 고른다).

#### 3. API 호출 계획
| 용도 | 엔드포인트 | 메서드 | 파라미터 | 쓰는 필드 | 오류 처리 |
|---|---|---|---|---|---|
| 방 카드 | **신규 목록**(번호 Leader — #155~#160 은 챌린지 예약) `GET /api/v1/speech/utterances` | GET | `chatId`, `reviewable=1`, `limit=50` | `items[].{id, chatMessageId, status, realtimeText, analysisText, requiresReview, finalSource, audioAvailable}` | 401 → 앱 공통 · 404(남의 방) → 카드 0 · 그 밖 → 조용히 다음 주기(카드는 부가 정보 — 오류 UI 없음) |
| 내 발화 기록 | 같은 경로 | GET | `cursor`, `limit=20`, (`reviewable=1`) | `items[]` 전부 · `nextCursor` · `reviewableCount` | L4·L7 |
| 확정 | #21a `PATCH /api/v1/speech/utterances/:id` | PATCH | `{choice}` · `{choice:'USER', text}` | #22 형태(`finalText`·`finalSource`·`requiresReview`) | 409 → R6 · 404 → R7 · 400 → 시트 오류 · 429·0·5xx → R8 |
| 원음 | #21b `GET /api/v1/speech/utterances/:id/audio` | GET | — | wav | 404 → L10 |
| 평가 출처 | #66(기존) | GET | — | `items[].inputSource` + `voiced`(D-2) | 기존 |

목록 응답 **권고 모양**(D-1 — 엔진 정보·`transcriptConfidence`·`engineVersions` 0. 화면이 숫자를 쓰지 않으므로 싣지 않는다):
`{ items: [{ id, createdAt, durationMs, status, realtimeText, analysisText|null, finalText, finalSource, requiresReview, wasReviewTarget, audioAvailable, chatMessageId|null, context: { kind: 'TALK'|'LESSON'|'EVALUATION'|'UNSENT'|'DELETED', id|null, title?: string|null } }], nextCursor: string|null, reviewableCount: number }`
- `wasReviewTarget` = 서버가 `transcriptConfidence < engineVersions.reviewThreshold || flags 있음`(`api-contract.md:615`)으로 계산 — 화면이 `engineVersions` 를 받지 않게.
- `audioAvailable` = `audioPath && audioDeletedAt == null && audioExpiresAt > now`(Utterance 칸 있음 [확인]).
- 정렬 `createdAt desc, id desc`, 커서 = 마지막 행. `chatId` 필터가 남의 방이면 404(완료 기준 3).

#### 4. 상태 관리
- `useUtteranceReviews({ chatId, messages, paused })`(신규, `components/speech/`): `byMessage: Map<chatMessageId, ReviewItem>` · `openId` · `resolved: Map<utteranceId, choice>`(이 방을 떠날 때까지 R5 유지).
  - 불러오기: 방 첫 로드(메시지 #29 와 **병렬**, 기다리지 않음) · 화면이 다시 보일 때(`visibilitychange→visible`) · **30초 주기**는 ① 방이 보이고 ② 최근 6분 안에 만든 음성 메시지(`inputSource==='REALTIME_STT'`)가 있을 때만(분석 = 마지막 발화 +20초, 상한 첫 발화 +5분 — 그 뒤엔 새 카드가 생기지 않는다). 주기·창 [추측 — developer 가 부하·배터리 기준으로 확정, D-4].
  - **턴 보호(완료 기준 7)**: `paused`(= TalkState ≠ IDLE — 녹음·인식·보내기 대기·생각 중·말하는 중) 동안 주기 요청을 건너뛰고, IDLE 로 돌아오면 한 번. PATCH 는 막지 않는다(사용자 행동). 카드의 어떤 상태도 푸시투토크·입력 바를 막지 않는다.
  - 응답 반영: 펼쳐져 있거나 기록 중인 카드는 갱신하지 않는다(고르는 중에 사라지지 않게). 펼친 카드가 응답에서 빠졌으면(다른 기기에서 확정) 다음 PATCH 의 409 로 R6.
- 카드 내부: `sel: 'REALTIME'|'ANALYSIS'|null` · `phase: 'idle'|'saving'|'done'|'gone'|'error'` · `err` · `sheetOpen`. 성공 → `onResolved(dto)`.
- 내 발화 기록: `items` · `nextCursor` · `filter`(URL `?filter=review`) · `openId` · 재생 큐 1개 · `gone: Set<id>`. 필터를 바꾸면 목록 초기화 후 첫 페이지.

#### 5. 생성/수정 파일 (src/app·src/components 만)
| 파일 | 새/수정 | 내용 | 경계(phase2-batch-plan §2) |
|---|---|---|---|
| `src/components/speech/UtteranceReviewCard.tsx` | 새 | §2-A | C16 |
| `src/components/speech/UtteranceFixSheet.tsx` | 새 | §2-B | C16 확장(새 파일 — 충돌 없음) |
| `src/components/speech/useUtteranceReviews.ts` | 새 | §4 | 〃 |
| `src/components/speech/utteranceReview.ts` | 새 | `isReviewable`·`hasSecond`·`fixChoice`·`chipOf`·`contextOf` 순수 함수 | 〃 |
| `src/components/speech/utteranceCopy.ts` | 새 | §7 문구 단일 출처 | 〃 |
| `src/components/speech/UtteranceLog.tsx` | 새 | §2-C | 〃 |
| `src/app/(app)/settings/utterances/page.tsx` | 새 | 서버: auth → `<UtteranceLog />` | 새 경로 |
| `src/components/talk/TalkRoom.tsx` | 수정 **≈6줄** | import 2 · 훅 호출 1(`paused` = 이미 유도한 TalkState ≠ IDLE) · `renderUser` 안 `<UserBubble …/>` 다음 카드 1줄 + 조건 | C10: 012b-2 → 010d-B 순서. `TalkTutorBubble`·`useTalkPlayback` 무변경(012b-4) |
| `src/components/settings/SpeechSettings.tsx` | 수정 ≈12줄 | §2-D | — |
| `src/components/eval/EvalResult.tsx` · `evalCopy.ts` | 수정 1줄 + 함수 1 | §2-E | C16 |
| `src/types/speech.ts` | 새 | 목록 항목·#22 DTO 타입(`types/chat.ts` 금지) | — |
| 건드리지 않음 | — | `components/chat/**`(D-3 — `diff.ts` 와 039 커밋 뒤 `followHold.ts` 는 **읽기 import 만**) · `components/shell/routes.ts`(C9) · `types/chat.ts` · `conversation/**` · `prisma/**` | |

#### 6. 구현 순서
1. 순수 함수·타입·문구(`utteranceReview.ts`·`types/speech.ts`·`utteranceCopy.ts`) + 단위 테스트(띄우는 조건 6가지 · `fixChoice` 4가지 · 칩 4가지 · 문맥 5가지).
2. 서버 목록 API(계약 D-1) — 화면 1·3 과 병렬.
3. `UtteranceReviewCard`·`UtteranceFixSheet` → **내 발화 기록 화면**(방과 무관하게 끝까지 검증 가능 — 수업·평가 발화도 여기서 확인).
4. 설정 진입 줄 · 평가 결과 문구(D-2 결정 전엔 `voiced` 없이 표의 첫 행 규칙).
5. **039 로컬 커밋 뒤** TalkRoom 삽입(`followHold` import). 010d-B 보다 먼저 커밋.

#### 7. 한국어 문구 (`utteranceCopy.ts` 단일 출처)
| 키 | 문구 |
|---|---|
| ⓐ 접힘 | 들린 말 확인 · 다시 들어 보니 다르게 들렸어요 · (aria 는 보이는 글 그대로 + `aria-expanded`) |
| ⓑ 안내 | 다시 들어 보니 다르게 들린 곳이 있어요. 내가 실제로 한 말을 골라 주세요. |
| ⓒ 두 안 | 이렇게 들렸어요 / 선생님은 이 말을 듣고 답했어요 · 이렇게도 들렸어요 / 한 번 더 들어 본 결과예요 · (sr) 두 문장에서 서로 다른 곳에 밑줄이 있어요. |
| ⓓ 한 안 | 한 번 더 들어 봤지만 알아듣지 못했어요. · 이대로 기록하기 |
| ⓔ 버튼 | 이걸로 기록하기 · 기록하는 중… · 직접 고치기 · 나중에 · (미선택) 먼저 하나를 골라 주세요. |
| ⓕ 효과 | 고른 말은 내 발화 기록에만 남아요. 이미 보낸 말과 교정은 그대로예요. 한 번 고르면 바꿀 수 없어요. |
| ⓖ 소리 힌트(방만) | 말풍선 아래 ▶ 내 목소리로 들어 보고 골라도 돼요. |
| ⓗ 성공 | ✓ 기록했어요 · 처음 들린 말로 / ✓ 기록했어요 · 다시 들어 본 말로 / ✓ 기록했어요 · 내가 고친 말로 |
| ⓘ 실패 | 이미 확인한 말이에요. · 이 기록을 찾을 수 없어요. · 잠시 후 다시 눌러 주세요. · 연결하지 못했어요. 네트워크를 확인해 주세요. · 기록하지 못했어요. 다시 눌러 주세요. |
| ⓙ 시트 | 직접 고치기 · 내가 실제로 한 말을 일본어로 적어 주세요. · 내가 한 말 · {n}/1000 · 한 글자 이상 적어 주세요. · 1,000자 안으로 적어 주세요. · 이대로 기록하기 · 취소 |
| ⓚ 기록 화면 | 내 발화 기록 · 설정으로 · 말로 한 문장이 어떻게 기록됐는지 볼 수 있어요. · 보기 · 전체 · 확인 필요 {n} · 회화 / 오늘의 회화 / AI 평가 / 보내지 않은 말 / 지운 대화 · {s}초 · 확인 필요 / 처음 들린 말로 확인 / 다시 들어 본 말로 확인 / 내가 고친 말 · ▶ 내 목소리 · (aria) {시각}에 한 말 녹음 듣기 · 확인하기 · 회화에서 보기 / 수업에서 보기 / 평가에서 보기 · 녹음 보관 기간(30일)이 지났어요 · 녹음이 없어요. 내 목소리는 30일 동안만 보관해요. · 더 보기 · 불러오는 중… · 처음 기록까지 다 봤어요 · 기록을 불러오지 못했어요. · 더 불러오지 못했어요. · 다시 시도 |
| ⓛ 빈 | 아직 말로 한 기록이 없어요. / 회화에서 버튼을 누른 채로 말하면 여기에 쌓여요. / 회화하러 가기 · 확인할 말이 없어요. |
| ⓜ 맨 아래 안내 | 녹음은 30일 동안 보관한 뒤 자동으로 지워져요. 글자 기록은 남고, 여기서 지울 수는 없어요. / 기록을 고쳐도 이미 받은 평가 점수와 교정은 바뀌지 않아요. / ‘정확하게’ 인식 방식에서는 더 꼼꼼히 비교해서 확인할 말이 조금 더 생길 수 있어요. |
| ⓝ 설정 줄 | 내 발화 기록 · 말로 한 문장과 녹음(30일)을 볼 수 있어요 · 확인 {n} · (aria) 내 발화 기록, 확인할 말 {n}개 |
| ⓞ 평가 | 글자로 답함 · 말로 답함 · 내가 고친 말로 채점했어요 · 말로 답함 · 다시 들어 본 말로 채점했어요 · 말로 답함 · 처음 들린 말로 채점했어요 |

엔진명·"분석"·"인식률"·신뢰도 숫자 0건. "분석 STT" → "다시 들어 본", "실시간 인식" → "처음 들린". ⓜ 둘째 줄의 "글자 기록은 남고"는 `audioDeletedAt` 칸(행은 남고 파일만 지움)으로 본 것 [추측 — 정리 잡 코드 미확인, developer 확인].

#### 8. 주의사항 · QA 체크리스트
- **원문 무수정(D-B6)**: 카드·시트는 #21a 만 부른다. 성공 뒤에도 말풍선 글(`message.content`)·교정 카드·평가 답을 화면에서 바꾸지 않는다(내 발화 기록 본문만 `finalText`). QA: 확정 전후 `ChatMessage.content`·`Correction.original`·평가 답 바이트 일치.
- 360/390/412 × 780/892: 카드·행 가로 넘침 0(`min-w-0`·`[overflow-wrap:anywhere]`, 일본어에 `break-keep` 금지) · 터치 ≥44px(접힘 줄 44 · 라디오 칸 56 · 보조 버튼 h-11 · ▶ h-11 · 설정 줄 56) · 화면당 스크롤 1곳(방 = 메시지 목록, 기록 화면 = 앱 `main`, 시트 안은 예외) · 시트 입력칸이 키보드에 가리지 않음(`scrollIntoView nearest`, `AcceptCorrectionSheet` 와 같은 조건).
- 키보드: 라디오는 화살표로 이동(네이티브 input) · [이걸로 기록하기] Enter/Space · 시트 Esc·초점 복귀 · 성공 시 초점 R5 줄.
- 스크린리더: 회화 목록은 `role="log" aria-relevant="additions"`(`MessageList.tsx:296-299`) — **카드가 새로 붙으면 접힘 줄 글이 한 번 읽힌다**(짧게 둔 이유). 녹음 중엔 목록 `aria-live="off"`(기존) — 그동안 붙은 카드는 읽히지 않는다(의도: 스크린리더 음성이 마이크로 들어가지 않게).
- reduced-motion: 화살표 회전만 `motion-safe:`. 펼침 높이 애니메이션 없음.
- 오프라인·오류: 방 카드 목록 실패는 조용히(다음 주기), PATCH 실패만 카드 안 알림. 권한 거부 해당 없음(본인 데이터만).
- 엔진명 0: 화면·DOM 속성·`aria-*`·콘솔에 엔진 이름·confidence·`reviewThreshold` 0. 목록 응답에도 싣지 않는다(§3).

#### 9. 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer)
- 디자인 P0 0 · P1 0.
  - P2-1 카드가 지금 보는 곳보다 **위** 메시지에 늦게 붙으면 읽던 자리가 44px 밀릴 수 있다(바닥에 붙어 있으면 목록이 따라가 문제 없음). 분석은 대화가 멈춘 뒤 마지막 메시지들에 붙는 경우가 대부분이라 드묾 [추측] — 실기기에서 보이면 MessageList 쪽 보정(C11, 039 소유)을 Leader 에.
  - P2-2 확인할 말이 여럿이면 접힘 줄이 메시지마다 쌓인다 — 합성 20문장 중 1건 비율 기준 드묾 [추측]. 운영 분포를 보고 방 단위 요약("확인할 말 n개")으로 바꿀지 판단.
  - P2-3 공용 `LoadingBlock`·`EmptyBlock` 의 ink3 글자(기존 전역 이슈) — 새 화면은 ink2 로 직접 그린다.
- a11y Critical 0 · Major 0.
  - Minor-1 라디오 점은 장식(`aria-hidden`), 상태 전달은 네이티브 radio — 점 테두리 ink2(비텍스트 3:1↑).
  - Minor-2 `role="log"` 안 카드 추가 낭독 1회 — 정보성이라 허용.

#### 10. Leader·developer 결정 필요
| # | 항목 | 권고 |
|---|---|---|
| D-1 | 목록 API 번호·경로·응답(§3 권고 모양) · 방 제목 조합 여부 · `context.kind` UNSENT/DELETED 구분 | 권고 모양, 제목은 선택 |
| D-2 | #66 `items[].voiced`(그 문항에 발화가 연결됐는가 — 라우트 조합, learning→speech import ✗ 유지) | 추가. 없으면 TEXT 는 전부 "글자로 답함" |
| D-3 | 채팅방(CHAT) 삽입 생략 + 완료 기준 1 문구 정정 | 생략(QA 가 DB 0건 확인) |
| D-4 | 방 카드 주기(30초·최근 6분 창) | developer 실측 후 확정 |
| D-5 | 대화 삭제 뒤 발화 행·녹음 잔존 | 정책은 Leader/사용자. 화면은 "지운 대화"로 정직하게 |

## Developer 기록

- [10-06 23:3x, 시각 추정] **체크포인트 1 — 현황 점검(dev-012b2b 신규 소환, 앞 dev-012b2 는 기록 없이 80턴 종료)**. 기준 = 가이드 §2~§7·Leader 결정 D-1~D-5. `git status`·diff·파일 직접 읽음.
  - **이미 된 것(앞 dev)** — 서버: `src/modules/speech/utterances/list.ts`(신규 — `parseUtteranceListQuery`·`listUtterances`·`toUtteranceListItem`·`contextOfRow`·`REVIEWABLE_WHERE`·`listDb` 주입점, 키셋 커서 `createdAt desc,id desc`, 엔진·신뢰도 칸 0, `wasReviewTarget`·`audioAvailable` 서버 계산) · `utterances/index.ts`·`speech/index.ts` export · `utterances/evaluation.ts` `voicedEvaluationItems`(+`voicedDb` 주입점, `answerCameFrom` 재사용) · `app/api/v1/speech/utterances/route.ts` GET(#21c 로 표기, 60/분, `chatId` → `getOwnedChat` 404) · `app/api/v1/evaluations/[id]/route.ts` `items[].voiced` 조합(D-2). 타입 `src/types/speech.ts`(신규). 화면: `utteranceReview.ts`(순수 함수 — isReviewable·hasSecond·fixChoice·chipOf·contextOf·mergeReviews·hasRecentVoice·shouldPoll·resolveFailure·applyResolved, 주기 30초·창 6분 상수) · `utteranceCopy.ts` · `UtteranceReviewCard.tsx`(R0~R9 + `UtteranceReviewSlot`) · `UtteranceFixSheet.tsx` · `useUtteranceReviews.ts` · `useMinePlayback.ts` · `UtteranceLog.tsx`(L1~L14) · `UtteranceLogEntry.tsx` + `SpeechSettings.tsx` 진입 줄 · `app/(app)/settings/utterances/page.tsx` · `eval/evalCopy.ts` `answerSourceLabel` + `EvalResult.tsx` 한 줄 교체.
  - **미완성/빠진 것**: ① 단위 테스트 0(서버 목록·필터·소유자·#66 voiced · 화면 순수 함수·렌더) ② `tests/live/task012b2-screens.ts`·`task012b2-smoke.ts` 없음 ③ tsc·eslint 미확인 ④ 목록 API 번호 "#21c" 를 api-contract 빈 번호인지 미확인(D-1) ⑤ TalkRoom 삽입 — **task-039 미커밋**(`chat/followHold.ts` untracked, `chat/**` 수정 중) → 규칙대로 **삽입 안 함**(TalkRoom.tsx 는 깨끗).
  - **주의점**: (a) D-5 "지운 대화" — `Utterance.chat`·`chatMessage` 둘 다 `onDelete: SetNull` 이라 대화를 지우면 행의 연결 칸이 전부 비고, 평가 답으로 녹음했지만 내지 않은 발화(#21 은 evaluationItemId 를 받지 않음)도 전부 빈다 → **데이터로 구분 불가**. 앞 dev 는 `DELETED` 를 예약만 하고 전부 `UNSENT`("보내지 않은 말")로 냈다 — 지운 대화의 발화가 "보내지 않은 말"로 보이는 오표기 가능성. Leader 보고 대상(문구는 designer). (b) `EVALUATION` 문맥 id 는 null(평가 id 조회 경로 없음 — 링크 없음). (c) `useMinePlayback` 이 `@/modules/speech/tts/client`(클라이언트 안전 모듈, 기존 수업 화면과 같은 import)를 쓴다 — tts/** 는 012b-3·4 소유라 수정 금지.
  - **남은 일**: tsc·eslint → 단위 테스트(서버 `src/modules/speech/__tests__/task012b2.test.ts`·화면 `src/components/speech/__tests__/task012b2.test.ts(x)`·`evalCopy`) → live 스크립트 2개 → 미러 dev(3027) Playwright 일부 실행 → 체크포인트 2·3.
  - **다음 첫 행동**: `KAIWA_LOCAL_ROOT=~/.node-local/thekaiwa-012b2 bash scripts/sync-local.sh` 후 미러에서 `tsc --noEmit`.
  - **미커밋 파일(이 task)**: 위 "이미 된 것" 전부(신규 = list.ts·types/speech.ts·components/speech/{UtteranceReviewCard,UtteranceFixSheet,UtteranceLog,UtteranceLogEntry,useUtteranceReviews,useMinePlayback,utteranceReview,utteranceCopy}·settings/utterances/page.tsx).
- [10-06 23:4x, 시각 추정] **체크포인트 2 — 고친 것·단위 테스트**.
  - 고친 것: ① `useUtteranceReviews.ts` — 방 바뀜 초기화를 effect 안 setState(eslint `react-hooks/set-state-in-effect`)에서 렌더 중 비교로 옮기고, 응답 도착 전에 방이 바뀌면 버림(`roomRef`)·in-flight 표시를 방 id 로(방 전환 직후 첫 조회가 막히지 않게). ② `utterances/evaluation.ts` `voicedDb.linked` 반환 타입을 `Promise<…>` 로 명시(주입 테스트가 PrismaPromise 와 안 맞던 tsc 오류).
  - 신규 테스트: `src/modules/speech/__tests__/task012b2.test.ts`(14 — 질의 검사 400·userId 범위·reviewable 조건·키셋 커서·nextCursor·응답 키 13개 고정/엔진·신뢰도·경로 0·audioAvailable·wasReviewTarget·문맥·라우트 호출 순서 정적·#66 조합 정적·voiced 판정/50개 상한) · `src/components/speech/__tests__/task012b2.test.ts`(24 — isReviewable·hasSecond·fixChoice(코드포인트)·chipOf·contextOf·resolveFailure·applyResolved·D-4 상수·hasRecentVoice·shouldPoll·mergeReviews·mineStateOf·answerSourceLabel 5행·카드 R0/R1/R2/R3/R5 서버 렌더·설정 줄 렌더·서버 모듈 import 0·엔진명/숫자 0·카드는 #21a 만).
  - 실행 증빙(미러 `thekaiwa-012b2`, `DATABASE_URL=invalid` 덮어씀): 새 테스트 **38/38 통과** · `tsc --noEmit` **0 오류** · 변경 파일 eslint **0 문제**.
  - **D-4 확정값**: 주기 30초·창 6분(근거: task-012b 실측 30발화 백로그 p50 90초·최대 155초, 디바운스 상한 5분) + 턴 중(`paused`) 요청 0 · 화면 가림 중 0 · 쉬는 상태 복귀·화면 복귀 때 1회.
  - **D-1 번호**: `#21c GET /api/v1/speech/utterances`(api-contract 표에 21c 없음 확인 — 21a·21b 다음 빈 번호). 계약 문서 반영은 Leader.
  - 남은 일: `tests/live/task012b2-screens.ts`·`task012b2-smoke.ts` 작성 → 미러 dev(3027) 일부 실행 → 전체 단위(components+types, modules/speech) → 체크포인트 3.
  - 다음 첫 행동: `tests/live/task044-screens.ts`·`qa-session.ts` 형식 확인 후 screens 스크립트 작성.
- [00:03] **체크포인트 3 — 라이브 스크립트·화면 실측·회귀(구현 완료, TalkRoom 삽입만 대기)**.
  - 신규: `tests/live/task012b2-screens.ts`(API 가로채기 고정 응답 — #21c·#21a·#21b·#66, 그 밖 쓰기 차단·기록 / 포트 3010 거부·PRODUCTION 거부 / QA 계정 1 id 읽기만 → qa 토큰, 문맥 닫기 전 `clearCookies` / `SIZES=`·`ONLY=` 옵션) · `tests/live/task012b2-smoke.ts`(**작성만** — 무세션 401·질의 400 6종·응답 칸 13개·엔진 문자열 0·DB 대조 소유·커서·reviewable 조건·reviewableCount=DB·내 방 200/없는 방 404/계정 2 방 404·계정 2 목록에 계정 1 발화 0·계정 2 "확인 불가" 발화에 #21a/#21b → 404(소유자 검사가 깨져도 409 로 끝나 쓰기 없음)·#66 voiced boolean·남의 평가 404).
  - **화면 실측(미러 dev 127.0.0.1:3027, APP_ENV=LOCAL, 고정 응답)**: 6크기(360/390/412 × 780/892) × {L1·L2·L3·L4·L5·L11·R9(시트·입력칸 키보드 위)·설정 진입 줄·평가 결과 출처 4줄} + 390×892 {R5 성공·R6 409·R2 미선택 안내(요청 0)} = **57 검사 · 실패 0** — 가로 넘침 0·스크롤 영역 1곳(시트 열림 땐 main 0 + 시트)·엔진 문자열 0·설정 줄 높이 56. 44px 미만으로 잡힌 것은 **공용 부품뿐**: `Segmented size="sm"`(32)·`DisplayToggles`(32)·`ErrorBlock` [다시 시도](20) — 가이드가 고른 기존 부품(새 부품 아님, 이 task 범위 밖). 앱 공통 POST(출석 체크인·후리가나 `/api/v1/text/annotate`)는 스크립트가 막고 기록만.
  - **회귀(같은 미러, `DATABASE_URL=invalid`)**: `src/components`+`src/types` 단위 **546/546** · `src/modules/speech` 단위 **251 중 250 통과·1 SKIP(미러에 `speech/models` 없음 — 기존)·실패 0** · learning 평가 단위 25/25 · `tsc --noEmit` **0** · eslint(변경 파일 + live 2개) **0**. 보이지 않는 문자 0(`grep -P`). dev 서버 종료·3027 비움 확인.
  - **TalkRoom 삽입 대기**: task-039 아직 로컬 커밋 전(`chat/followHold.ts` untracked·`MessageList.tsx` 수정 중, 확인 00:01) → **삽입하지 않음**(`TalkRoom.tsx` 깨끗). 039 커밋 뒤 할 일(약 5줄): ① `TalkRoom.tsx` import 2(`UtteranceReviewSlot` ← `@/components/speech/UtteranceReviewCard`, `useUtteranceReviews` ← `@/components/speech/useUtteranceReviews`) ② `const view = deriveTalkState(…)` 다음에 `const reviews = useUtteranceReviews({ chatId, messages, paused: view.state !== 'IDLE' })`(조건부 return 앞인지 확인) ③ `renderUser` 의 `<UserBubble …/>` 바로 다음 `<UtteranceReviewSlot reviews={reviews} message={m} />` ④ `UtteranceReviewSlot` 안에서 `const hold = useContext(FollowHoldContext)`(← `@/components/chat/followHold`) 를 읽어 `onExpand` 기본값으로(슬롯은 MessageList 의 Provider 아래에서 렌더되므로 TalkRoom 이 아니라 슬롯이 읽어야 한다).
  - **Leader 보고 사항**: (1) D-5 "지운 대화" — 데이터로 구분 불가(대화 삭제·평가 미제출 녹음 모두 연결 칸 전부 null) → 지금은 `UNSENT`("보내지 않은 말")로 표시, `DELETED` 는 타입·문구만 예약. 지운 대화의 발화가 "보내지 않은 말"로 보이는 오표기 가능 — 문구 조정(designer) 또는 삭제 시점 표시 칸(스키마)이 필요. (2) `src/types/evaluation.ts` `EvaluationItem` 에 `voiced?: boolean` 이 없다(소유 밖) — 런타임은 동작(`answerSourceLabel` 이 구조적으로 받음), 타입 명시는 1줄 additive 권고. (3) api-contract 에 `#21c` 행·응답 모양·#66 `items[].voiced` 반영 필요(Leader). (4) `EVALUATION` 문맥 링크 없음(평가 id 를 speech 가 모름 — 라우트 조합 필요, 이번 범위 밖).
  - 미커밋 파일(이 task 전체): 서버 `src/modules/speech/utterances/{list.ts(신규),evaluation.ts,index.ts}`·`src/modules/speech/index.ts`·`src/app/api/v1/speech/utterances/route.ts`·`src/app/api/v1/evaluations/[id]/route.ts` / 타입 `src/types/speech.ts`(신규) / 화면 `src/components/speech/{UtteranceReviewCard,UtteranceFixSheet,UtteranceLog,UtteranceLogEntry,useUtteranceReviews,useMinePlayback,utteranceReview,utteranceCopy}`(신규)·`src/components/settings/SpeechSettings.tsx`·`src/components/eval/{EvalResult.tsx,evalCopy.ts}`·`src/app/(app)/settings/utterances/page.tsx`(신규) / 테스트 `src/modules/speech/__tests__/task012b2.test.ts`·`src/components/speech/__tests__/task012b2.test.ts`·`tests/live/task012b2-{screens,smoke}.ts`(신규).
  - 실행 증빙(재실행용, 미러 루트): `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 src/modules/speech/__tests__/task012b2.test.ts src/components/speech/__tests__/task012b2.test.ts` → 38/38 · `APP_ENV=LOCAL ./node_modules/.bin/next dev -H 127.0.0.1 -p 3027` 후 `SIZES=390x892 node --env-file=.env --import tsx tests/live/task012b2-screens.ts 3027` → 12/0.

### dev-012b2c
- [01:18] **TalkRoom 삽입 완료(task-039 `f01e469` 커밋 확인 뒤) + 마무리 검증**. 데모 게이트: `DEMO_GATE_PASSED` · `task: task-012b-2`(status waived, "데모 생략하고 진행해줘").
  - **변경 파일**: `src/components/talk/TalkRoom.tsx` **+4줄**(import 2 · `const reviews = useUtteranceReviews({ chatId, messages, paused: view.state !== 'IDLE' })` 1 — `deriveTalkState` 바로 다음, 첫 조건부 return(`load === 'loading'`) 앞 · `renderUser` 의 `<UserBubble …/>` 바로 다음 `<UtteranceReviewSlot reviews={reviews} message={m} />` 1, 교정 카드 `<ul>` 위) · `src/components/speech/UtteranceReviewCard.tsx`(슬롯: `useContext(FollowHoldContext)` 를 early return 앞에서 읽어 `onExpand={expandHandler(onExpand, hold)}` · 붙는 조건을 `slotEntry` 로) · `src/components/speech/utteranceReview.ts`(순수 함수 `slotEntry`·`expandHandler`·타입 `SlotMessage` 추가) · 신규 테스트 `src/components/speech/__tests__/task012b2room.test.ts`(6).
  - **계획(417행 ①~④)과 차이**: ① 계획 "≈5~6줄" → 실제 4줄(조건은 슬롯 안에 있어 TalkRoom 에 조건 줄 불필요). ② 슬롯이 `role` 을 받으면 USER 가 아닐 때 null(선생님 말 방어 — `renderUser` 는 원래 USER 행만 부르므로 동작 차이 없음). 그 밖 계획 그대로. `TalkTutorBubble`·`useTalkPlayback`·SSE 처리·#32 계약 **무변경**(diff 4줄 확인).
  - **코드로 확인한 것**: [확인] 슬롯은 `MessageList` 의 `FollowHoldContext.Provider`(MessageList.tsx:291) 안에서 그려진다 — 렌더 테스트에서 renderUser 자리 컨텍스트 = function, 목록 밖 = null. [확인] 방 안 재생 큐는 `useTalkPlayback` 하나 — `useMinePlayback` 은 `UtteranceLog`(기록 화면)만 쓰고 카드·슬롯은 소리 경로(playWav·큐·#21b) import 0. 카드의 ⓖ 안내는 기존 말풍선 ▶(`TalkUserActions` → `playback.replayMine`)를 가리킬 뿐이라 동시 재생·`playback.stop` 충돌 없음. 내 목소리 재생 중엔 `view.state = SPEAKING` → `paused` → 주기 요청 0, 끝나면 1회(펼친 카드는 `openRef` 로 유지).
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b2`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` → `prisma generate`, 모든 테스트 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`): 새 파일 + 기존 012b2 화면 **30/30** · `src/components`+`src/types` 단위 **561/561**(앞 체크포인트 546 + 이번 6 + 그 사이 다른 task 추가분) · `src/modules/speech` 단위 **251 중 248 통과·1 SKIP(미러에 `speech/models` 없음 — 기존)·2 실패** · `tsc --noEmit` **0** · eslint(TalkRoom·카드·utteranceReview·useUtteranceReviews·테스트 2·live 2) **0** · 보이지 않는 문자 0(`grep -P`). dev 서버·live 스크립트 **실행 안 함**(QA 몫).
  - **modules/speech 실패 2건은 이 task 밖**: `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts` "task-035 L-2" 2건 — 실제 결과에 `tokens` 칸이 더 붙어 고정값과 다름. 원인은 task-012b-4 의 **미커밋** `src/modules/speech/tts/renderingPlan.ts`(`tokens?: NormalizationToken[]` 추가, `git diff` 확인). 체크포인트 3(00:03)에는 0 실패였다 → 012b-4 developer/Leader 에 전달 필요(테스트 고정값 갱신 또는 비교에서 `tokens` 제외). 이 task 는 tts/** 를 건드리지 않았다.
  - **남은 위험**: (a) [추측] 말풍선의 ▶ 가 사라진 메시지(`gone` — #21b 404)에도 목록 응답의 `audioAvailable` 이 true 면 카드의 ⓖ "말풍선 아래 ▶" 안내가 남는다(드묾·P3, 고치려면 TalkRoom 에 줄이 늘어 이번엔 두지 않음). (b) 가이드 P2-1 그대로 — 바닥이 아닌 곳을 보는 중 위쪽 메시지에 카드가 늦게 붙으면 44px 밀림(`followHold` 는 "펼침"만 막는다). (c) `tests/live/task012b2-screens.ts` 의 묶음은 `log,entry,eval` 뿐 — **회화방 삽입은 라이브 스크립트가 보지 않는다**(아래 QA 인계에서 수동 확인 지점으로 넘김). (d) 방 첫 로드 때 #21c 조회는 메시지 조회와 병렬로 1회 나간다(설계대로) — CHAT 방으로 돌려보내지는 경우에도 1회.
  - **QA 인계 요약**: 미러에서 `APP_ENV=LOCAL ./node_modules/.bin/next dev -H 127.0.0.1 -p 3027`(운영 3010·PRODUCTION 은 두 스크립트가 거부). ① 화면: `node --env-file=.env --import tsx tests/live/task012b2-screens.ts 3027`(기본 6크기 × 기록 화면 L1~L14·시트 R9·설정 진입 줄·평가 출처 4줄, `SIZES=`·`ONLY=log,entry,eval` 로 줄일 수 있음, API 가로채기 고정 응답이라 DB 쓰기 0) — 기대: 가로 넘침 0·스크롤 영역 1곳·엔진 문자열 0·설정 줄 56px. ② 스모크: `QA_ACCOUNT=1|2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-qa1|/tmp/c-qa2` 후 `BASE=http://127.0.0.1:3027 node --env-file=.env --import tsx tests/live/task012b2-smoke.ts /tmp/c-qa1 /tmp/c-qa2`, 끝나면 쿠키 파일 삭제 — 기대: 무세션 401·질의 400 6종·응답 칸 13개·엔진/신뢰도 문자열 0·커서·`reviewableCount`=DB·**IDOR**(계정 2 방 `?chatId=` → 404, 계정 2 목록에 계정 1 발화 0, 계정 2 의 확인 불가 발화에 계정 1 이 #21a/#21b → 404 — 409 가 나오면 소유자 검사 깨짐) · #66 `items[].voiced` boolean·남의 평가 404. ③ **회화방 삽입 확인 지점(스크립트 밖, 수동)**: 확인 대상 발화가 있는 TALK 방에서 내 말풍선 바로 아래·교정 카드 위에 접힘 줄 1개(선생님 말풍선·보내는 중 말풍선엔 없음) · 바닥에 붙은 상태에서 펼쳐도 누른 줄이 위로 밀리지 않음(task-039 ⑧) · 녹음·생각 중·말하는 중엔 #21c 요청 0(네트워크 탭), 쉬는 상태로 돌아오면 1회 · 펼친 채 PTT/▶ 를 눌러도 카드 유지·소리 하나만 · 확정 후 말풍선 글·교정 카드 바이트 그대로(D-B6) · CHAT 방 연결 발화 0건(DB, D-3).
  - **미커밋 파일(이 task 전체)**: 체크포인트 3 목록 + `src/components/talk/TalkRoom.tsx`·`src/components/speech/__tests__/task012b2room.test.ts`(신규).

### dev-012b2d (REV-132)
- [01:50] **REV-132 보완 완료(Leader 결정 1~5, 6 은 초안만, 7 은 손대지 않음)**. 데모 게이트 `check.mjs check --task …` 첫 두 줄: `DEMO_GATE_PASSED` · `task: task-012b-2`(status waived, "데모 생략하고 진행해줘"). 커밋·푸시·db push·DB 쓰기·dev 서버·라이브 스크립트 실행 0.
  - **변경 파일**: 신규 `src/app/api/v1/_lib/evaluationVoiced.ts`(라우트 조합 헬퍼 — `src/app/api/v1/_lib/review.ts`·`voice.ts` 와 같은 자리·같은 관례) · 신규 `src/app/api/v1/_lib/__tests__/evaluationVoiced.test.ts`(9) · 신규 `src/components/speech/__tests__/task012b2race.test.ts`(11) · 수정 `src/app/api/v1/evaluations/[id]/route.ts`(판정식 3줄·`SPEAKING` 상수 → `withVoiced(...)` 1줄) · `src/components/speech/utteranceReview.ts`(`settleIfCurrent`·`requestGate`·`appendPage`·`refreshRoomReviews`·타입 추가) · `useUtteranceReviews.ts`(refresh 본문 → `refreshRoomReviews` 호출) · `UtteranceLog.tsx`(필터 표 `requestGate`) · `utteranceCopy.ts`(UNSENT 문구) · `src/types/speech.ts`(UNSENT 주석) · 테스트 문구 대조 갱신 `src/components/speech/__tests__/task012b2.test.ts`·`src/modules/speech/__tests__/task012b2.test.ts`(이름·정적 검사)·`tests/live/task012b2-screens.ts`(L5 기대 문구 1개 — 이 task 의 스크립트).
  - **① M-2 voiced 판정 분리**: 판정을 `_lib/evaluationVoiced.ts` 로 — `VOICE_ANSWER_KINDS`(옛 `SPEAKING` 과 같은 3종) · `voicedLookupInputs`(TEXT·말로 답할 수 있는 문항·빈 답 제외) · `markVoiced`(음성 출처 또는 대조 결과) · `withVoiced(userId, items, lookup, warn)`. 라우트는 `withVoiced(s.user.id, dto.items, voicedEvaluationItems)` 한 줄(speech 공개 API 주입) — 6층 그대로(learning→speech import 0, speech 는 평가 표를 안 읽음, `_lib` 은 `@/types` 도 import 하지 않는 순수 모듈). speech 쪽이 아니라 `_lib` 에 둔 이유: 문항 종류(말로 답할 수 있는가)는 learning 개념이라 speech 가 알면 안 되고, 라우트 조합 헬퍼 자리가 이미 있다. 시험: 음성으로 답함(대조 안 부름·문구 처음 들린/다시 들어 본) · **D-B7 고쳐 채점**(처음 들린 「駅はどこですか」→ #21a USER 「駅はどこにありますか」→ TEXT 답 = 고친 글 → true·"내가 고친 말로 채점했어요"·사용자 범위 1회) · 글자로 답함(녹음 없음·녹음 글과 다름 → false) · 옛 응답 호환(실패 → `voiced` 칸 없음 → "글자로 답함") · 집합(8종 전부 — 3종만 대조, "모두 같다"는 가짜 대조여도 나머지 5종 false) · 라우트 정적(판정식·종류명·`.has(` 가 라우트에 다시 들어오지 않음).
  - **② L-2 실패 흡수**: 대조가 던지면 `voiced` 칸을 **통째로** 뺀 원래 items(바이트 그대로)로 #66 정상 응답 + `console.warn` 1줄 `[evaluations] #66 voiced 대조 실패 — voiced 칸 없이 응답: <오류 이름>`. 음성 출처 답에만 true 를 싣지 않는 이유: 일부만 실으면 대조 못 한 TEXT 답이 "글자로 답함"으로 단정된다(없음 = 옛 응답과 같은 의미). 경고에 오류 메시지(접속 문자열·답 글이 섞일 수 있음)·사용자·문항 id 없음 — 시험이 확인. 대조할 TEXT 답이 없으면 대조 자체를 부르지 않는다.
  - **③ L-1 더 보기 ↔ 필터 전환**: `requestGate()`(표 번호) + `settleIfCurrent(run, stillCurrent)`(성공·실패 모두 조건이 바뀌었으면 `stale`). `UtteranceLog` — `pick` 이 `gate.invalidate()`, `loadMore` 는 `settleIfCurrent(() => apiGet(query(cursor)), gate.ticket())` 후 `stale` 이면 상태를 하나도 건드리지 않음(행·커서·"더 불러오지 못했어요" 섞임 0), 병합은 `appendPage`(기존 인라인 dedupe 와 같은 동작, O(n·m) → Set). 판별 유니온이라 `stale` 갈래를 빼면 `r.value` 에서 tsc 오류. 첫 조회 effect 의 `cancelled` 는 그대로.
  - **④ L-3 방 전환 응답 폐기**: 훅 refresh 본문을 `refreshRoomReviews(chatId, deps)`(턴 중·같은 방 진행 중 건너뜀 → 받기 → 방 바뀌었으면 `stale` → 응답 시점에 펼침·기록 중 카드 다시 읽어 병합 → 진행 중 표시는 자기 방일 때만 해제)로 옮기고 훅은 deps 만 묶는다(`currentRoom: () => roomRef.current`·`paused: () => pausedRef.current`·`apply: setEntries`). 동작 변화 없음(옛 코드와 같은 순서·같은 조건). 시험: 적용·방 전환 stale·옛 방 끝나도 새 방 진행 중 표시 유지·paused/진행 중 skip·실패 조용히·응답 기다리는 사이 펼친 카드 유지 + 훅·화면 배선 정적.
  - **⑤ M-3 문구**: `CONTEXT_COPY.UNSENT.label` "보내지 않은 말" → **"연결된 대화 없음"**(기록 줄 메타 `12:03 · 연결된 대화 없음 · 3초`, 링크 없음 그대로). **한계 명시**: 방에서 녹음만 한 말·지운 대화의 말·내지 않은 평가 답 녹음은 `Utterance.chat`·`chatMessage` 가 둘 다 `onDelete: SetNull` 이라 **데이터로 구분 불가** — 문구를 원인 중립으로 바꿔 오표기 가능성만 줄였다(스키마 변경 없음, `DELETED` 는 타입·문구 예약 그대로). `[추측]` 남는 어색함: 방은 있는데 메시지가 없는 행(`chatId` 있음·`chatMessageId` 없음)에도 "연결된 대화 없음" — 여기서 "대화"는 주고받은 말 뜻으로 읽힌다고 봤다. 더 정확히 하려면 그 행만 TALK 방 링크로 보내는 갈래(계약 값 변경)가 필요 — designer 판단 대상.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b2`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` → `prisma generate`, 테스트 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`): 이 task 테스트 5파일 **65/65**(REV-132 의 3파일 45 + `_lib` 9 + race 11) · `src/components`+`src/types` **572/572**(561 + 11) · `src/modules/speech` **262 중 261 통과 · 1 skip(미러에 `speech/models` 없음 — 기존) · 실패 0**(REV-132 때의 `lexiconCompoundGuard` 2건은 지금 미러에서 통과 — 012b-4 쪽에서 해소된 것으로 보임 `[추측 — 원인 커밋은 안 봄]`) · `src/app` 전체 **13/13** · `tsc --noEmit` **0** · eslint(변경·신규 12파일) **0 문제** · 보이지 않는 문자 grep **0** · 변경 화면 파일 엔진명 grep **0**.
  - **변이 재현**(scratchpad 사본 `…/scratchpad/dev012b2d/mir`, 소스·미러 무수정, 위 5파일 기준) — **14종 전부 검출**:

    | # | 변이 | 결과 |
    |---|---|---|
    | M3a′ | (REV M3a 이전본) `markVoiced` 의 `matched.has` → `!matched.has` | **검출** 5건 |
    | M3c′ | (REV M3c 이전본) `VOICE_ANSWER_KINDS` 비움 | **검출** 4건 |
    | M8a′ | (REV M8 이전본) 방 비교 `() => d.currentRoom() === chatId` → `() => true` | **검출** 2건 |
    | M8b | `refreshRoomReviews` 의 `stale` 갈래 삭제 | **검출** 2건 |
    | M8c | 훅 배선 `currentRoom: () => chatId`(roomRef 안 씀) | **검출** 1건(정적) |
    | L1a | `pick` 의 `gate.invalidate()` 삭제 | **검출** 1건(정적) |
    | L1b | `settleIfCurrent` 성공을 늘 ok | **검출** 4건 |
    | L1c | `settleIfCurrent` 실패를 늘 error | **검출** 2건 |
    | L1d | `loadMore` 표 대신 `() => true` | **검출** 1건(정적) |
    | L2a | 실패 흡수 대신 다시 던짐 | **검출** 1건 |
    | L2b | 경고에 `e.message` | **검출** 1건 |
    | L2c | 실패 때 음성 출처만 true 로 일부 싣기 | **검출** 1건 |
    | M3 | UNSENT 문구 되돌림 | **검출** 1건 |
    | R1 | 라우트 `const items = dto.items`(voiced 누락) | **검출** 2건(정적 2곳) |

    REV-132 원 변이(M3a·M3c — 라우트 안 식)는 그 식이 라우트에서 사라져(정적 검사가 다시 들어오는 것도 막음) 같은 자리로는 재현 불가 — 옮겨 간 자리에서 위 M3a′·M3c′ 로 재현. 훅 효과(주기 타이머·visibilitychange·쉬는 상태 복귀 1회)는 여전히 단위 시험 밖 — QA 네트워크 탭 확인 그대로.
  - **⑥ 정본 반영 필요(api-contract, Leader 소유 — 초안만, 정본 수정 안 함)**:
    - **#21c** `GET /api/v1/speech/utterances` — 내 발화 목록, 최근 것부터. 세션 필수(401). 질의 4키만(그 밖 400): `limit` 1~50(기본 20) · `cursor`(앞 응답 `nextCursor`, 불투명 — 깨지면 400) · `reviewable` `1`|`0`(1 = 지금 확인할 수 있는 발화만: 분석 끝·다르게 들림·`finalSource=REALTIME`·처음 들린 글 있음) · `chatId`(그 방에서 녹음한 발화만 — 남의 방·없는 방 **404**, 형식 틀리면 400). 사용자당 60/분(429). 응답 `{ items, nextCursor, reviewableCount }` — 정렬 `createdAt desc, id desc` 키셋 · `reviewableCount` = 같은 범위(`chatId` 있으면 그 방)의 확인할 수 있는 발화 수(커서·`reviewable` 무관). `items[]` 13칸 `{ id, createdAt, durationMs, status, realtimeText, analysisText(ANALYZED 일 때만, 그 밖 null), finalText, finalSource, requiresReview, wasReviewTarget, audioAvailable, chatMessageId, context: { kind: TALK|LESSON|EVALUATION|UNSENT|DELETED(예약 — 지금은 안 냄), id } }` — 엔진 이름·신뢰도·임계·원음 경로 없음(원음은 #21b). `Cache-Control: private, no-store`. **(→ `context.kind` 값 목록은 dev-012b2e 에서 갱신 — `ROOM_ONLY` 추가)**
    - **#66** `items[].voiced: boolean`(additive, task-012b-2 D-2) — 그 문항의 답이 녹음에서 왔는가. `inputSource` 가 `REALTIME_STT`·`SERVER_STT` 면 true, `TEXT` 면 말로 답할 수 있는 문항(LISTEN_RESPOND·SITUATION_RESPOND·CORRECTION_SPOT)에 붙은 녹음의 확정 글(또는 처음 들린 글)과 답이 같을 때 true(#21a 로 직접 고친 글로 채점된 경우 — D-B7), 그 밖 false. 녹음 대조가 실패하면 **칸 자체가 없다**(옛 응답과 같음 — 클라이언트는 없음을 "글자로 답함"으로 본다).
  - **남은 위험**: (a) `[추측]` UNSENT 문구의 방-있음 행 어색함(위 ⑤). (b) 훅의 effect 배선(타이머·가시성·복귀 1회)은 정적 검사·QA 몫 그대로. (c) `_lib` 경고는 `console.warn` — 운영 로그 수집 경로는 기존 `withApi` 와 같음, 반복 실패 때 요청마다 1줄. (d) 이번에 손대지 않음(Leader 7): 공용 부품 44px 미달·`ReplayButton` label-in-name.
  - **미커밋 파일(이번 추가)**: `src/app/api/v1/_lib/evaluationVoiced.ts`(신규)·`src/app/api/v1/_lib/__tests__/evaluationVoiced.test.ts`(신규)·`src/components/speech/__tests__/task012b2race.test.ts`(신규) + 위 수정 파일들. 이 task 전체 목록은 dev-012b2c 목록 + 이 셋.

### dev-012b2e (REV-135)
- [02:12] **REV-135 L-A·L-B 처리 완료(Leader 결정 1·2, 3 은 손대지 않음 — L-C·정본·공용 부품 44px)**. 데모 게이트 `check.mjs check --task …` 첫 두 줄: `DEMO_GATE_PASSED` · `task: task-012b-2`(status waived, "데모 생략하고 진행해줘"). 커밋·푸시·db push·DB 쓰기·dev 서버·라이브 스크립트·운영 3010 접촉 0.
  - **변경 파일(8, 전부 이 task 소속)**: `src/modules/speech/utterances/list.ts`(`contextOfRow` 한 갈래 + 주석) · `src/types/speech.ts`(`UtteranceContextKind` 에 `ROOM_ONLY` additive + 주석) · `src/components/speech/utteranceCopy.ts`(`CONTEXT_COPY.ROOM_ONLY` + 주석) · `src/components/speech/utteranceReview.ts`(`contextOf` 모르는 값 폴백) · `src/app/api/v1/_lib/evaluationVoiced.ts`(주석만) · 시험 `src/modules/speech/__tests__/task012b2.test.ts`(쓰인 곳 시험 갱신) · `src/components/speech/__tests__/task012b2.test.ts`(contextOf 갱신 + 시험 1 추가) · `src/app/api/v1/_lib/__tests__/evaluationVoiced.test.ts`(시험 1 추가). `tests/live/task012b2-screens.ts` 는 **수정 없음** — L5 기대 문구 "연결된 대화 없음"(u6 = UNSENT·chatId 없음)이 바뀌지 않아서.
  - **L-B 라벨 분리**: `contextOfRow` 순서 = 메시지(TALK) → 수업(LESSON) → 평가(EVALUATION) → **`chatId` 만 있음 → `ROOM_ONLY`(`id` = 방)** → 아무것도 없음 → `UNSENT`. 화면 문구 ROOM_ONLY "보내지 않은 말" · UNSENT "연결된 대화 없음"(그대로). **옛 값 의미 유지**: UNSENT 의 문구·링크 없음은 그대로이고, 옛 화면(새 값을 모름)도 폴백으로 같은 "연결된 대화 없음"을 보인다 — 즉 옛 클라이언트에는 이번 변경 전과 똑같이 보인다. **모르는 값 폴백**: `contextOf` 가 `Object.hasOwn(CONTEXT_COPY, kind)` 가 아니면 UNSENT 문구·링크 없음(`constructor`·`__proto__` 같은 상속 키도 같은 길 — `in` 으로 바꾸면 시험 실패, 변이 B7). ROOM_ONLY 는 방 id 를 싣지만 **링크는 없음**(링크 추가는 designer 결정 대상 — 지금은 서버 변경 없이 화면만 바꾸면 되는 상태). `[확인]` 근거: `Utterance.chat` `onDelete: SetNull`(schema) · 방 녹음은 수업·평가에 붙을 수 없음(`lessonUtteranceProblem`·`evaluationUtteranceProblem` 이 `chatId` 행을 409) · `ChatMessage` 를 개별로 지우는 코드 없음(`conversation` grep — 지우기는 방 통째로 `chat.deleteMany` → 메시지 Cascade·발화 방 칸 SetNull) → `chatId` 있음·`chatMessageId` 없음 = 방에서 녹음했지만 메시지로 가지 않은 말. **접근성 이름**: 쓰인 곳 문구는 기록 줄 메타 `<span>` 본문으로만 나가고 `aria-label` 에 들어가는 곳이 없다(`UtteranceLog.tsx` 172행·`mineAria` 는 시각만) `[확인]` — 바꿀 접근성 이름 없음. ROOM_ONLY 는 링크가 없어 링크 이름도 없음.
  - **L-A 종류 집합 동기화**: learning 의 `SUBJECTIVE_ITEM_KINDS` 는 `learning/evaluation/index.ts` 로 **공개되지 않음** `[확인]`(index 는 `EVAL_TIME_LIMIT_SEC`·`EVAL_LEVEL_UP_SCORE`·`gradeOf`·`computeTotal`·`levelUpBasis` 만) → Leader 결정대로 import 하지 않고 **두 집합이 같음을 단언하는 시험** 추가(`[...VOICE_ANSWER_KINDS].sort()` = `[...SUBJECTIVE_ITEM_KINDS].sort()` + 크기). 시험은 `scoring.ts` 를 **상대 경로**로 읽는다 — 별칭 `@/modules/learning/evaluation/scoring` 은 `src/app/**` 경계 규칙이 테스트에도 걸려 eslint error(직접 확인: `--stdin` 탐침 1 error), 상대 경로 화이트박스는 eslint.config 주석의 테스트 관례(예 `components/settings/__tests__/voiceSliderLogic.test.ts` → `../../../modules/preferences/voiceRanges`). `_lib` 본체는 import 0 그대로(주석에 "learning 집합과 같아야 하고 시험이 묶는다" 한 줄). module-dependency: 라우트(`src/app/**`)는 learning index 를 import 할 수 있으나 상수가 index 에 없어 해당 없음.
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b2`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` → `prisma generate`, 테스트 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"`): 이 task 테스트 5파일 **67/67**(65 + contextOf 모르는 값 1 + L-A 1) · `src/components`+`src/types` **573/573**(572 + 1) · `src/modules/speech` **262 중 261 통과·1 skip(미러에 `speech/models` 없음 — 기존)·실패 0** · `src/app` **14/14**(13 + 1) · `tsc --noEmit` **0 오류**(아래 격리 뒤) · eslint(변경 8파일) **exit 0** · 보이지 않는 문자 grep **0**(검출 능력 U+200B 시료 1건 확인) · 변경 화면·서버 파일 엔진명 grep **0**.
  - **미러 격리(보고)**: sync 직후 `tsc` 4 오류 — 전부 `src/modules/learning/__tests__/task010d.test.ts`(3)·`task010dCatalog.test.ts`(1), task-010d 진행 중(NFS 에 미커밋 수정 `learning/scenarios/{catalog,end,index,recommend,shape}.ts`·`__tests__/task010d.test.ts`)이라 소스와 시험이 맞지 않는 상태. 그 6파일만 **미러에서** `git show HEAD:` 로 되돌려 격리 → `tsc` 0. NFS 원본은 건드리지 않았다. 이 task 파일과 무관.
  - **변이 재현**(scratchpad 사본 `…/scratchpad/dev012b2e/mir`, 원본 NFS·미러 무수정, 매번 원 파일 복원·`cmp` 확인) — **12종 전부 검출**:

    | # | 변이 | 결과 |
    |---|---|---|
    | B1 | `contextOfRow` 의 ROOM_ONLY 갈래 삭제(옛 동작 — 방 녹음도 UNSENT) | **검출** 1 |
    | B2 | ROOM_ONLY 조건 뒤집기(`!r.chatId`) | **검출** 1 |
    | B3 | ROOM_ONLY `id` 를 null 로 | **검출** 1 |
    | B4 | ROOM_ONLY 문구를 "연결된 대화 없음"으로 | **검출** 1 |
    | B5 | UNSENT 문구를 옛 "보내지 않은 말"로 | **검출** 1 |
    | B6 | `contextOf` 모르는 값 폴백 삭제(`CONTEXT_COPY[c.kind]` 직접) | **검출** 1 |
    | B7 | `Object.hasOwn` → `in`(상속 키 통과) | **검출** 1 |
    | B8 | 폴백을 "지운 대화" 문구로(원인 단정) | **검출** 1 |
    | B9 | ROOM_ONLY 에 방 링크 붙이기 | **검출** 1 |
    | A1 | learning `SUBJECTIVE_ITEM_KINDS` 에만 4번째 종류 추가 | **검출** 1(L-A 시험) |
    | A2 | learning 쪽에서만 하나 뺌 | **검출** 1(L-A 시험) |
    | A3 | `_lib` `VOICE_ANSWER_KINDS` 에만 추가 | **검출** 2(기존 리터럴 시험 + L-A 시험) |

  - **⑥′ 정본 반영 필요(api-contract #21c `context` — Leader 소유, 초안만, dev-012b2d ⑥ 의 `context` 칸을 대체)**: `context: { kind, id }` — `kind` 는 `TALK`(회화 메시지로 보냄 · `id` = 대화방, 옛 행 null) | `LESSON`(오늘의 회화 수업 · `id` = 수업) | `EVALUATION`(AI 평가 문항 · `id` = null — 평가 id 조회 경로 없음) | **`ROOM_ONLY`(방에서 녹음했지만 메시지로 보내지 않음 · `id` = 대화방 — 방이 남아 있음, task-012b-2 REV-135 L-B)** | `UNSENT`(방 연결도 없음 — 방 밖 녹음·옛 행·연결된 대화가 지워짐·평가 답으로 녹음했지만 내지 않음 · `id` = null) | `DELETED`(예약 — 지금은 내지 않음). 판정 순서 = 메시지 → 수업 → 평가 → 방 → 없음. **값은 늘기만 한다(additive) — 클라이언트는 모르는 `kind` 를 UNSENT 와 같게(중립 문구·링크 없음) 다룬다.**
  - **남은 위험**: (a) `[추측]` 보내는 중(메시지가 아직 안 붙은 몇 초) 발화가 기록 화면에서 잠깐 "보내지 않은 말"로 보일 수 있다 — 기록 화면은 회화방과 동시에 열기 어려워 드묾, 새로 고치면 "회화"로 바뀜. 턴 실패로 메시지가 안 만들어진 경우는 문구가 맞다. (b) 라이브 스크립트 고정 응답에 ROOM_ONLY 행이 없다(지시대로 기대 문구 한 줄만 고치는 범위라 행을 늘리지 않음) — 360px 메타 줄 "보내지 않은 말" 길이는 "연결된 대화 없음"보다 짧아 넘침 위험은 작다 `[추측]`, QA 눈 확인 대상. (c) Designer 가이드 §ⓚ(276행)·응답 모양(312행)의 `context.kind` 목록에 ROOM_ONLY 가 없다(REV-135 I-D 와 같은 종류 — 구현이 정본, designer·Leader 몫). (d) L-C(훅 요청 URL·`more` 상태 갈래 시험 공백 5건)·I-A(실패 흡수 근거 문구)·I-B·I-C 는 이번 범위 밖 — 그대로.
  - **미커밋 파일(이번 변경)**: 위 8파일(전부 이미 이 task 미커밋 목록에 있음 — 새 파일 0).

## Reviewer 기록 (REV-132)

- [01:35] **REV-132 · 판정 PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 3 · Low 3 · Info 7. (에이전트 규약 판정표로는 PASS 범위 = Critical 0·High ≤1 이지만 Medium 3건이 남아 PASS_WITH_NOTES.) 대상 = task-012b-2 전체(서버 #21c·#66 `voiced` · 화면 · TalkRoom +4줄 · 테스트 3 · 라이브 스크립트 2). 표기: `[확인]` = 이번에 파일을 읽거나 명령을 실행해 본 것 · `[추측]` = 확인 못 한 것. `native_change: false`(웹만).
- **데모 게이트** `[확인]`: `check.mjs check --task <task.md>` → `DEMO_GATE_PASSED`(status waived). `evidence.jsonl` 23행(`kind:waive`, prompt_ts 23:43:26, transcript uuid `d64acf34…`)을 세션 transcript 에서 찾아 **human·external 사용자 메시지 원문 "데모 생략하고 진행해줘"** 와 일치함을 확인. 이 task 의 evidence 줄은 그 1건뿐이고 에이전트가 대신 실행한 approve/waive 흔적 없음. `.claude/state/demo-gate/` 직접 쓰기 흔적은 이 감사 범위에서 못 봄(파일 mtime 대조는 안 함 `[추측]`).
- **직접 재실행**(미러 `~/.node-local/thekaiwa-012b2`, 전부 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`, dev 서버·라이브 스크립트 실행 0) `[확인]`:
  - 이 task 테스트 3파일 **45/45**(서버 15 · 화면 23 · 방 7). dev 보고 "30/30" 은 화면 2파일(23+7)만 센 값 — 서버 15개가 더 있다.
  - `src/components`+`src/types` **561/561**.
  - `src/modules/speech` 251 중 **248 통과 · 1 skip · 2 실패** — 실패 2건 = `tts/__tests__/lexiconCompoundGuard.test.ts`(task-035 L-2 "prepareSegments 결과 고정"·"방어(lead)")이고 실제 결과에 `tokens` 칸이 더 붙어 고정값과 달라진 것 → **012b-4 소관**. 012b-2 테스트 3파일은 같은 실행에서 전부 통과 → 이 task 와 무관 확인. (미러의 `renderingPlan.ts`·`synthesize.ts` 는 NFS 현재본과 달라 NFS 쪽에서 이미 고쳐졌는지는 미확인 `[추측]`.)
  - `tsc --noEmit` **0 오류**(tsconfig include `**/*.ts` 라 `tests/live` 2개 포함).
  - eslint(이 task 변경·신규 25파일) **error 0 · warning 1** — `SpeechSettings.tsx:60` `react-hooks/set-state-in-effect`(기존 `void load()` effect; 이 task diff 는 import 1줄+JSX 1줄뿐이라 HEAD 와 같은 경고).
  - 보이지 않는 문자 grep **0건** · 사용자 화면 파일의 엔진명(reazon·whisper·style-bert·claude·sherpa·model_id·speaker_id·`engineVersions`·`transcriptConfidence`) **0건**(`types/speech.ts` 머리 주석의 설명 문구 1건뿐) · 비밀 하드코딩 0건(live 스크립트는 `process.env.JWT_SECRET`·쿠키 파일 인자).
- **변이 재현**(scratchpad 사본 `rev132/mir`, 소스·미러 무수정, 이 task 테스트 3파일 기준) — 10종 중 **7 검출 · 3 생존**:

  | # | 변이 | 결과 |
  |---|---|---|
  | M1 | `listWhere` 에서 `userId` 제거(IDOR) | **검출** 3건 실패(where·listUtterances 2) |
  | M2 | `slotEntry` 의 USER 조건 제거 | **검출** 2건(slotEntry·슬롯 렌더) |
  | M3a | #66 라우트 `voiced.has` → `!voiced.has` | **생존** 45/45 |
  | M3b | `voicedEvaluationItems` 의 `answerCameFrom` 부정 | **검출** 1건 |
  | M3c | #66 라우트 `SPEAKING` 집합 비움(TEXT 답을 아예 안 물음) | **생존** 45/45 |
  | M4 | `isReviewable` 의 `finalSource==='REALTIME'` 제거 | **검출** 1건 |
  | M5 | `REVIEWABLE_WHERE` 의 `finalSource` 제거(서버) | **검출** 1건 |
  | M6 | `shouldPoll` 이 `paused` 무시 | **검출** 2건 |
  | M7 | TalkRoom `paused: false` 고정 | **검출** 1건(정적 삽입 검사) |
  | M8 | 훅의 "응답 오는 사이 방 바뀌면 버림" 제거 | **생존** 45/45 |

### 지적

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| M-1 | **Medium** | `docs/design/api-contract.md` | **정본 미반영** `[확인]`: `21c`·`voiced` 가 0건 — 표 140~142행은 21·21a·21b 뿐이고 이 파일의 미커밋 diff 는 task-039 항목만이다. 코드·테스트·주석은 `#21c`·`items[].voiced` 를 이미 쓴다. 번호 충돌은 없다(`#21c` 사용처는 이 task 뿐 `[확인]`). 계약 갱신은 Leader 소유(dev 도 보고). 권고: 커밋 전에 #21c 한 행 + 응답 모양 `{items,nextCursor,reviewableCount}`·질의 4키·404/400·`Cache-Control` + #66 `items[].voiced`(옛 응답엔 없음) 반영. |
| M-2 | **Medium** | `src/app/api/v1/evaluations/[id]/route.ts:13·29-31` | **#66 `voiced` 판정식에 단위 테스트가 없다**(M3a·M3c 생존). 라우트의 `SPEAKING` 집합과 `inputSource==='REALTIME_STT'||'SERVER_STT'||voiced.has(it.id)` 식은 정적 import 검사(`task012b2.test.ts` 207-213행)뿐이다. 라이브 스모크 S9 도 voiced 가 boolean·음성 출처 true·미답 false 만 단언해(`task012b2-smoke.ts` S9~S9b) "TEXT 답 + 연결 발화 + 고친 말 → true"(D-B7 핵심 경로, 결과 화면 "내가 고친 말로 채점했어요")를 단언하는 곳이 없다 — M3a 는 S9b 가 잡지만 M3c 는 스모크로도 안 잡힌다 `[추측 — 스모크 코드 읽기만, 미실행]`. 권고: 판정식을 순수 함수로 빼서 단위 테스트(위치는 developer), 또는 최소한 QA 가 "음성 답 → #21a USER → 채점 완료" 평가 1건으로 실측. |
| M-3 | **Medium** | `src/modules/speech/utterances/list.ts:114-119` | **Leader 결정 D-5 미충족**: 결정은 "화면은 '지운 대화'로 정직하게 표시"인데 `contextOfRow` 는 `DELETED` 를 절대 내지 않고(예약만), 연결 칸이 전부 null 이면 `UNSENT`("보내지 않은 말")로 낸다. 지운 대화의 발화가 "보내지 않은 말"로 보인다. dev 가 근거를 보고했고 나도 확인: `Utterance.chat`·`chatMessage` 가 둘 다 `onDelete: SetNull`(schema 1393-1395)이라 "평가 답으로 녹음했지만 안 낸 발화"와 데이터로 구분 불가 `[확인]`. 권고: 구분 못 하는 값을 단정하는 문구("보내지 않은 말")를 중립 문구로(designer 소관) 하거나, 최종 보고에 "구분 불가·오표기 가능"을 명시. 구분하려면 스키마 칸이 필요하고 그건 사용자 승인 사항. |
| L-1 | Low | `UtteranceLog.tsx:79-90·92-101` | **"더 보기" 중 필터 전환 경쟁** `[확인 — 코드 읽기, 미재현]`: `loadMore` 는 취소 장치가 없고(`cancelled` 플래그는 첫 조회 effect 에만) `pick` 은 진행 중 요청을 무효화하지 않는다. 옛 필터의 응답이 새 필터의 첫 쪽 **뒤에** 도착하면 `setItems(prev=>[...prev,…])`·`setCursor` 가 새 목록에 다른 필터의 행·커서를 섞는다. 창이 좁다(더 보기 응답 대기 중 필터 탭). 권고: 필터 세대 번호 ref 로 응답 폐기. |
| L-2 | Low | `evaluations/[id]/route.ts:29` | `await voicedEvaluationItems(...)` 에 실패 흡수가 없다 — 표시용 부가 정보인데 이 조회가 실패하면 #66 전체가 500 이 된다(같은 DB 라 실제 확률은 낮음). 평가 결과·GRADING 폴링 경로라 fail-soft(`.catch(() => new Set())`)가 가이드의 "부가 정보는 조용히" 원칙에 맞다. |
| L-3 | Low | `useUtteranceReviews.ts` | 훅의 효과(주기 타이머·`visibilitychange`·쉬는 상태 복귀 1회·방 전환 응답 폐기)는 단위 테스트가 없다 — 순수 함수(`shouldPoll` 등)만 검증(M8 생존). 코드는 읽고 맞게 정리됨(타이머·리스너 cleanup, `pausedRef` 가 첫 effect 에서 먼저 갱신) `[확인]`. QA 가 방 안 네트워크 탭으로 확인. |
| I-1 | Info | 디자인 소관(Leader→designer) | 새 화면의 주 컨트롤이 공용 부품 `Segmented size="sm"`(32px)·`DisplayToggles`(32px)·`ErrorBlock` [다시 시도](20px) — 44px 미달(dev 의 live 측정 목록과 같음, 가이드가 고른 부품). `ReplayButton` 의 `aria-label`(`…에 한 말 녹음 듣기`)이 보이는 글자 "내 목소리"를 담지 않아 label-in-name 불일치(공용 부품 선례). 결함 판정 안 함. |
| I-2 | Info | `utteranceCopy.ts` `REVIEW_COPY.effect` | "고른 말은 내 발화 기록에만 남아요" — 평가 문항에 붙은 발화를 **채점 시작 전에** 고치면 D-B7 로 채점 글이 바뀔 수 있다(분석이 대화 뒤에 나오고 평가 풀이는 10분이라 매우 좁음). 문구 소관(designer). |
| I-3 | Info | `SpeechSettings.tsx:60` | 기존 eslint 경고(위 재실행). 이 task 변경분 아님. |
| I-4 | Info | `conversation/chats/index.ts` | `CHAT_SELECT`·`ChatRow` export 추가는 010d `rolePlay.ts` 소속 — 이 task 아님 `[확인]`. |
| I-5 | Info | `src/types/evaluation.ts` | `voiced?: boolean` 1줄은 계획서 파일 경계(`types/speech.ts` 신규만)에 없던 곳 — additive 라 문제 없고 brief 의 대상 파일. |
| I-6 | Info | `tests/live/task012b2-*.ts` | 실행 금지라 읽기·tsc·eslint 만: 3010·PRODUCTION 거부 · QA 계정 읽기만 · 쓰기 가로채기 · #21a 는 "확인 불가" 발화에만(소유자 검사가 깨지면 409 로 끝나 쓰기 없음)이라 안전 `[확인]`. dev 의 화면 실측(57 검사·실패 0)은 미재현. 회화방 삽입은 이 스크립트가 보지 않는다(dev 도 명시). |
| I-7 | Info | `list.ts` `EVALUATION` | 문맥 id 가 늘 null 이라 "평가에서 보기" 링크는 도달하지 않는 분기(계획된 범위 밖, dev 보고와 일치). |

### 7영역 점검 결과 `[확인]`
1. **아키텍처**: `speech/utterances/list.ts` 는 `infra`·`@/types/speech`·`../analysis/policy` 만 import(conversation·learning·preferences 0). `voicedDb.linked` 는 speech 소유 `Utterance` 만 읽는다(평가·문항 표 직접 조회 0, `evaluationItemId` 는 발화 쪽 FK 칸). `getOwnedChat`(conversation)·`voicedEvaluationItems`(speech)·`getEvaluation`(learning)은 **라우트가** 조합하고 `learning/index.ts` 에 speech import 0(정적 테스트로도 고정). 화면 8개 파일은 서버 모듈 import 0(예외 `speech/tts/client` — `useTalkPlayback`·`useLessonPlayback` 와 같은 선례). `types/chat.ts`·`conversation/**`·`prisma/**`·`components/chat/**`·`routes.ts` 수정 0(`chat/diff.ts`·`followHold.ts` 는 읽기 import 만).
2. **유지보수성**: 문구 단일 출처(`utteranceCopy.ts`)·순수 함수 분리(`utteranceReview.ts`)·중복 로직 재구현 없음(`answerCameFrom`·`wasReviewTarget`·`kstDateKey` 재사용). 하드코딩 상수(30초·6분)는 이름 있는 상수 + 근거 주석.
3. **안정성**: 목록 키셋 커서 `createdAt desc, id desc` + 같은 시각은 id 로 가름 — 신규 행이 위로 들어와도 페이지가 어긋나지 않음. 깨진 커서·모르는 키·`limit` 범위 밖은 400. 카드 PATCH 실패 5분기(409·404·429·0·5xx/400)가 R6~R8 로 갈리고 기록 중엔 갱신이 카드를 지우지 않음(`pinned`+`openRef`).
4. **운영성**: 이 task 는 쓰기 경로(PATCH #21a)를 새로 만들지 않고 기존 것만 부른다. 로그·Trace 에 텍스트 새 기록 0.
5. **성능**: 턴 경로 무변경. `paused` 동안 #21c 요청 0(`pausedRef`+`shouldPoll`), 화면 가림 중 0, 쉬는 상태 복귀·화면 복귀 때 1회, 6분 창 밖이면 주기 요청 0. 서버는 목록·개수 2쿼리(+`chatId` 면 방 확인 1). N+1 없음, `[userId, createdAt]` 인덱스.
6. **보안**: `listWhere` 가 늘 `userId` 로 묶음(M1 검출) · `chatId` 는 `getOwnedChat`(남의 방·없는 방 404 동일) · 응답에 원음 경로·URL·토큰·엔진·신뢰도·임계 없음(키 13개 고정 테스트, 원음은 `audioAvailable` boolean 만, 재생은 #21b 세션+소유자) · `Cache-Control: private, no-store` · 사용자당 60/분 · 페이지는 proxy 화이트리스트 + `auth()` redirect · `voicedDb.linked` 도 `userId` 로 묶음 · React 렌더라 XSS 경로 없음. 쓰기 가능한 새 경로 0.
7. **학습 원칙**: 카드·시트는 #21a 만 호출(정적 테스트로 고정)하고 말풍선 글·교정 `original`·평가 답·`StatsSnapshot` 을 건드리지 않음 `[확인 — 코드: 이 task 의 쓰기 호출은 PATCH 1종뿐]`. 엔진명·숫자 비노출. AI 산출 저장 경로 신규 0.

### 화면·TalkRoom 삽입 점검 `[확인 — 코드 읽기; 실화면은 미실행]`
- **TalkRoom** `git diff HEAD` = **+4줄·삭제 0**(import 2 · `const reviews = useUtteranceReviews({ chatId, messages, paused: view.state !== 'IDLE' })` · `<UtteranceReviewSlot reviews={reviews} message={m} />`). 훅은 `deriveTalkState` 다음(729행)이고 컴포넌트 수준 첫 조기 return(`load === 'loading'`, 948행)보다 앞 — 그 사이 조기 return 0(awk 로 확인). 슬롯은 `renderUser` 의 `UserBubble` 바로 다음·교정 `<ul>` 앞 1곳이고 `renderTutor`·`renderPending` 에 없음. `TalkTutorBubble`·`useTalkPlayback`·SSE·#32 호출부 diff 0.
- **FollowHold**: `FollowHoldContext.Provider`(MessageList.tsx:291) 아래에서 슬롯이 `useContext` 로 읽고 `expandHandler(onExpand, hold)` 순수 판정, 펼칠 때만(`if (!open) onExpand?.()`) 호출. 렌더 테스트가 `renderUser` 자리 context=function·목록 밖=null 을 고정.
- **재생 충돌 없음**: `useMinePlayback` 은 `UtteranceLog`(설정 화면)만 쓰고 TalkRoom·카드·슬롯은 소리 경로 import 0(정적 테스트). 방에서는 기존 `replayMine` 하나. 내 목소리 재생 중엔 `view.state=SPEAKING → paused` 라 요청 0.
- **상태 전수**: 카드 R0~R9(숨김·접힘·펼침·한 안·기록 중·기록함·409·404·재시도·시트) · 기록 화면 L1~L14(로딩·빈 2종·오류·목록·더 보기 중/실패·끝·재생 3상태·원음 없음·카드 펼침·확인 성공·세션 없음·칩 없음) 모두 코드에 있음. 접근성: 접힘 줄 `min-h-11`·라디오 칸 `min-h-14`·보조 버튼 `h-11`, `aria-expanded/controls`·`fieldset+legend`·오류 `role="alert"`·성공 `role="status"`+초점 이동·시트 `aria-describedby`, 일본어 `lang="ja"`(JaText·textarea), 선택은 테두리 굵기+점 모양 두 단서. 타이머·리스너 cleanup 있음(방 훅은 취소 장치 없는 fetch 이지만 언마운트 뒤 setState 는 무해).

### QA 인계 — high_risk_areas (갱신)
1. **#21c IDOR 라이브**(QA 계정 1·2): 계정 2 방 `?chatId=` → 404(계정 1 로), 계정 2 목록에 계정 1 발화 0, 계정 2 의 "확인 불가" 발화에 #21a/#21b → 404(**409 면 소유자 검사 깨짐**), 무세션 401, 질의 400 6종, 응답 칸 13개·엔진 문자열 0·`Cache-Control`.
2. **회화방 카드 수동**(라이브 스크립트가 안 봄): 내 말풍선 바로 아래·교정 카드 위 접힘 줄 1개(선생님·보내는 중엔 없음) · 바닥에 붙은 채 펼쳐도 줄이 안 밀림(039 ⑧) · 녹음·생각·말하기 중 #21c 요청 0(네트워크 탭)·쉬는 상태 복귀 시 1회 · 세 선택(REALTIME·ANALYSIS·USER) 각각 PATCH 성공 뒤 `Utterance.finalText/finalSource` 외 `ChatMessage.content`·`Correction.original`·평가 답 바이트 일치 · CHAT 방 연결 발화 0건(DB, D-3).
3. **#66 `voiced` 의 "내가 고친 말" 경로**(M-2): 음성 답 → #21a USER → 채점 완료 평가 1건에서 "말로 답함 · 내가 고친 말로 채점했어요", 글자 입력 답은 "글자로 답함", 음성 출처 두 가지는 각 문구. 옛 응답(`voiced` 없음) 호환.
4. **기록 화면**: 필터 전환 ↔ "더 보기" 경쟁(L-1), 404 토스트(L10), 지운 대화 발화의 표기(M-3), 360/390/412 × 780/892 가로 넘침·스크롤 1곳(`task012b2-screens.ts` 3027 — 미러 dev 서버), 시트 입력칸이 키보드에 안 가림.
5. **회귀**: 단위 전부(012b-4 의 `lexiconCompoundGuard` 2건은 별도) + 스모크 007·006·011, 회화 턴 p50·TTFA 변화 없음.

### Leader 확인 필요
- **M-1** api-contract 에 #21c·#66 `voiced` 반영(Leader 소유) — 커밋 전.
- **M-3** D-5 처리 방침: 문구를 중립으로 바꿀지(designer) · 최종 보고에 "구분 불가, 오표기 가능" 명시로 갈지.
- **M-2** `voiced` 판정식 단위 테스트를 이 task 안에서 요구할지, QA 실측으로 갈음할지.
- **I-1** 공용 부품 44px 미달·`ReplayButton` label-in-name → designer 에 전달할지(결함 판정 안 함).
- **012b-4 소관**: `lexiconCompoundGuard.test.ts` 2건(renderingPlan `tokens`) — 이미 dev-012b4app 에 전달됨, 이 task 와 무관.
- 데모 게이트: waive 근거는 실제 사용자 발화와 일치(위). 화면 구현의 승인본 대조는 승인 데모가 없어(waived) 구현 가이드(Designer 기록 §2~§7) 대비로만 봤고 material 차이 없음 — 단 M-3 은 가이드가 아니라 Leader 결정(D-5)과의 차이.

## Reviewer 기록 (REV-135)

- [02:05] **REV-135 · 판정 PASS_WITH_NOTES** — 이번 보완분(dev-012b2d) 신규 Critical 0 · High 0 · Medium 0 · Low 3 · Info 4. **이월 Medium 1(REV-132 M-1 api-contract 미반영 — Leader 반영 대기, 이번 보완분 책임 아님)**. 대상 = REV-132 보완 좁은 재검토(`_lib/evaluationVoiced.ts` 신규·라우트 1줄·`utteranceReview.ts`·`useUtteranceReviews.ts`·`UtteranceLog.tsx`·UNSENT 문구 + 테스트). `native_change: false`. 표기: `[확인]` = 이번에 읽거나 실행한 것 · `[추측]` = 못 한 것. **REV-132 항목 해소 현황**: M-2 해소 · L-1 해소 · L-2 해소 · L-3 해소(본문 이동분 — 훅 배선 일부는 아래 L-C) · M-3 문구 변경으로 해소(잔여 정확도는 아래 L-B) · **M-1 미해소(Leader)**.
- **데모 게이트** `[확인]`: `check.mjs check --task agent-vault/10-Flow/tasks/task-012b-2-analysis-result-ui.md` → 첫 두 줄 `DEMO_GATE_PASSED` · `task: task-012b-2`(status waived, "데모 생략하고 진행해줘"). `evidence.jsonl` 의 이 task 줄은 REV-132 때와 같은 1건(mtime 10-06 23:43:51 그대로) — 새 approve/waive 흔적 없음.
- **직접 재실행**(미러 `~/.node-local/thekaiwa-012b2` 를 NFS 에서 다시 sync·`prisma generate` 후, 전부 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`, dev 서버·라이브 스크립트·DB 쓰기 0) `[확인]`: 이 task 테스트 5파일 **65/65** · `src/components`+`src/types` **572/572** · `src/modules/speech` **262 중 261 통과·1 skip·0 실패**(skip = 미러에 `speech/models` 없음 — 기존) · `src/app` **13/13**(이 task 9 + 기존 4) · `tsc --noEmit` **0 오류** · eslint(변경·신규 12파일) **exit 0** · 보이지 않는 문자 grep **0**(검출 능력은 U+200B 시료 1건으로 확인) · 화면·`_lib` 파일 엔진명 0(`types/speech.ts` 머리 주석의 설명 문구 1건뿐 — REV-132 와 같음) · 비밀 하드코딩 0. dev 보고 숫자와 전부 일치. 참고: sync 뒤 NFS 의 `conversation/prompts/talk.ts`·`__tests__/talkScenario.test.ts`(010d 진행 중)가 미러와 달라졌다 — 이 task 와 무관.
- **항목 1 · M-2 voiced 순수화** `[확인]`: 5경우가 맞다. ① 음성 출처(`REALTIME_STT`·`SERVER_STT`)는 대조 없이 true(대조 호출 0 시험) ② **음성 답을 직접 고쳐 채점(D-B7)** — `pickGradingText` 가 USER 확정이면 `inputSource=TEXT`·`answerText=finalText` 로 저장한다는 것을 `speech/analysis/policy.ts:139-145`·`learning/evaluation/grade.ts:195-196` 에서 읽었고, `voicedEvaluationItems` 가 같은 `answerCameFrom`(finalText 또는 realtimeText 일치)으로 대조하므로 true 가 맞다 ③ 글자 답(녹음 없음·다름)=false ④ 옛 응답 호환(대조 실패 → 칸 없음) ⑤ 8종 중 3종만 대조(`LISTEN_RESPOND`·`SITUATION_RESPOND`·`CORRECTION_SPOT` = learning `SUBJECTIVE_ITEM_KINDS` 와 같은 값). 6층: `_lib` 는 import 0 의 순수 모듈, 라우트가 speech 공개 API(`voicedEvaluationItems`)를 주입, speech 는 `utterance` 표만 읽음(평가 표 직접 조회 0), learning→speech·speech→learning/conversation import 0 — grep 확인. 라우트는 `withVoiced(s.user.id, dto.items, voicedEvaluationItems)` 한 줄, 소유자 검사(`getEvaluation` 404)는 그 앞이며 `userId` 는 세션 값(변이 R3 로 확인). **정적 테스트가 옛 인라인 코드 재도입을 막는다**(변이 R2: 라우트에 `SPEAKING` 집합 재도입 → 검출).
- **항목 2 · L-2 실패 흡수** `[확인]`: 대조가 던지면 `voiced` 칸을 **통째로** 뺀 `[...items]` 로 200 응답(상태 코드·`Cache-Control`·`{...dto, items, result}` 모양 불변), 경고는 `console.warn` 1줄에 **오류 이름만**(`PrismaClientInitializationError` 등 — 메시지·사용자 id·문항 id·답 글 0, 시험이 4개 문자열 부재 확인). `console.warn` 은 이 저장소 `src/app/api/auth/**`·`infra/**` 와 같은 관례. 대조할 TEXT 답이 없으면 대조를 부르지 않는다. **설계 타당성**: 타당하다(옛 응답과 같은 모양·단순). 다만 "일부만 true 로 싣지 않는 이유 = 미확인 글자 답을 '글자로 답함'으로 단정하지 않기 위해"라는 **근거 서술은 부정확**하다 — `answerSourceLabel` 은 `voiced` 를 `inputSource==='TEXT'` 일 때만 보므로(`evalCopy.ts` 끝) 부분 true 설계여도, 칸 생략 설계여도 대조 실패 순간의 TEXT 답은 똑같이 "글자로 답함" 으로 보인다(→ I-A).
- **항목 3 · L-1 더 보기 × 필터** `[확인 — 코드·단위·변이, 실화면 미실행]`: `pick` 이 `gate.invalidate()`, `loadMore` 는 `gate.ticket()` 을 요청 **전에** 잡고 `settleIfCurrent` 로 성공·실패 둘 다 조건이 바뀌었으면 `stale` → `stale` 갈래는 상태를 하나도 안 건드린다(행·커서·`more`·"더 불러오지 못했어요" 섞임 0, 단위 + 정적 + 변이로 확인). 같은 필터 연타: `more==='loading'` 가드 + `appendPage` Set 중복 제거(이중 방어, S4 변이 검출). 빠른 필터 왕복: 표가 `pick` 마다 증가해 옛 요청은 모두 무효, `pick` 이 `setMore('idle')` 로 되돌려 stale 응답이 와도 `more` 가 멈춰 있지 않다. 첫 조회는 기존 `cancelled` 플래그. 언마운트 뒤 setState 는 React 18+ 에서 무해. **AbortController 는 쓰지 않는다** — 옛 요청은 끝까지 가고 응답만 버려진다(서버 읽기 2회 낭비뿐, I-B).
- **항목 4 · L-3 방 전환** `[확인 — 이전 본문과의 직접 diff 는 못 함(훅 파일이 미추적이라 옛 본문이 git 에 없음). 이력서 설명 + 현재 코드 + 시험으로 대조]`: `refreshRoomReviews` 순서 = 같은 방 진행 중·`paused` 면 skip → `inflight=chatId` → `settleIfCurrent(fetch, () => currentRoom()===chatId)` → stale/failed 면 상태 불변 → 응답 시점에 `keep()` 다시 읽어 병합 → `finally` 에서 `inflight` 가 **자기 방일 때만** 해제. 훅은 refs 만 묶는다(`currentRoom: () => roomRef.current`·`paused: () => pausedRef.current`·`inflight` ref·`apply: setEntries`), refs 갱신 effect 가 `[refresh]` effect 보다 먼저 선언돼 첫 조회가 최신 `paused` 를 읽는다. 타이머·`visibilitychange` cleanup·쉬는 상태 복귀 1회 effect 는 그대로. 방 A→B 도중·A→B→A 왕복에서도 stale/중복이 상태를 오염시키지 않음을 코드로 따라가 확인(`inflight` 소유가 방 id 단위).
- **항목 5 · M-3 문구** `[확인]`: `CONTEXT_COPY.UNSENT.label` = "연결된 대화 없음" — "보내지 않은 말"이라는 원인 단정은 사라졌다. 잔존 grep: 정확한 문구 "보내지 않은 말"은 사용자 화면·테스트·`tests/live`·`types/speech.ts`·`docs/` 에 **0건**(남은 곳은 이 이력서의 Designer 가이드 §ⓚ·경위 기록뿐 — 이력). 비슷한 "보내지 않은" 2건은 다른 뜻(api-contract 1052행 progress 절·`homeM4.ts` 연결 설정) — 무관. 문구가 들어간 곳 = `utteranceCopy.ts:104`·단위 테스트 2·`tests/live/task012b2-screens.ts` L5 기대문·`types/speech.ts` 주석 — 모두 일관. 이 문구는 `aria-label` 이 아니라 기록 줄 메타 `<span>` 본문이라 접근성 이름 문제 없음, 한국어라 `lang="ja"` 규칙 대상 아님(일본어 본문 `JaText` 는 그대로). **방은 있는데 메시지가 없는 행의 사용자 영향(dev `[추측]`에 대한 판단)** = 작지만 REV-132 의 "구분 불가" 판단을 **정정**해야 한다: `Utterance.chat` 이 `onDelete: SetNull` 이므로 `chatId` 가 있으면 그 방은 **존재한다** — 방은 지워진 대화(chatId=null)와 데이터로 갈린다. 그래서 `chatId` 있음·`chatMessageId` 없음 행(방에서 녹음했지만 말풍선으로 안 간 것 — 다시 녹음·글자로 고쳐 보냄 등)은 옛 문구 "보내지 않은 말"이 오히려 정확했고 새 문구가 덜 정확하다(L-B).

### 지적

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| L-A | Low | `src/app/api/v1/_lib/evaluationVoiced.ts:13` | `VOICE_ANSWER_KINDS` 가 learning 의 `SUBJECTIVE_ITEM_KINDS`(`learning/evaluation/scoring.ts:25` — 음성 답 검증 `answer.ts:33`·채점 `grade.ts` 가 쓰는 같은 3종) 와 **같은 값을 따로 정의**한다 `[확인]`. learning 이 4번째 서술형 종류를 추가하면 #66 `voiced` 는 그 종류의 D-B7 경우를 조용히 false("글자로 답함")로 낸다. `SUBJECTIVE_ITEM_KINDS` 는 `learning/index.ts` 로 export 되지 않고, 이 테스트는 값을 리터럴 3개와만 비교해 둘을 묶는 시험이 없다. 권고: learning index 로 export 해 `_lib` 가 쓰거나(라우트 층은 learning import 가능, 단 `_lib` 순수성 포기), 최소한 시험에서 `scoring.ts` 의 상수와 같은지 단언. REV-132 의 `SPEAKING` 중복이 옮겨 온 것. |
| L-B | Low | `src/modules/speech/utterances/list.ts:114-119` · `utteranceCopy.ts:104` | `contextOfRow` 가 `chatId` 있음·`chatMessageId` 없음 행도 UNSENT("연결된 대화 없음")로 낸다 — 방은 존재하는데 "연결된 대화 없음"은 부정확하고, 이 행이 `확인 필요` 칩과 함께 보일 수 있다(`REVIEWABLE_WHERE` 가 `chatMessageId` 를 요구하지 않음 `[확인]`). 지운 대화(chatId=null)와는 데이터로 갈리므로(위 항목 5) "구분 불가" 전제는 chatId 없는 행에만 맞다. **#21c 가 api-contract 에 아직 없어 값 추가 비용이 가장 싼 시점**이다. 권고(designer·Leader 결정): UNSENT 를 둘로 — 방만 있음(문구 "보내지 않은 말" + 방 링크 가능) / 방도 없음(중립 "연결된 대화 없음"). 안 하면 최종 보고에 한 줄. |
| L-C | Low | `useUtteranceReviews.ts` · `UtteranceLog.tsx` | 변이 프로브 **5건 생존** `[확인 — 이번에 만든 변이]`: H1 훅 요청 URL 의 `chatId: id` → `'x'` · H2 훅이 `inflight` ref 를 안 넘김(`{current:null}`) · S1 `loadMore` 성공 뒤 `setMore('idle')` 삭제(버튼이 영원히 로딩) · S2 `pick` 의 `setMore('idle')` 삭제(stale 응답이 상태를 안 건드리므로 이제 **이 한 줄만이** 필터 전환 때 `more` 를 되돌린다) · S3 `more==='loading'` 가드 삭제. 모두 현재 코드는 맞고(위 항목 3·4) 단위 시험은 순수 함수·모델 복제본(`afterMore`)만 본다. 화면 갈래는 정규식 정적 검사 + 사본 함수에 기대므로 H1 같은 오타(카드가 영영 안 붙음)는 QA 눈 확인으로만 잡힌다. 권고: 요청 URL 을 순수 함수(`reviewListUrl(chatId)`)로 빼서 단정, 가능하면 `UtteranceLog` 렌더 테스트. REV-132 L-3 의 "훅 효과는 단위 밖"이 일부만 해소된 상태. |
| I-A | Info | `evaluationVoiced.ts` 머리 주석·이력서 ② | 위 항목 2: 부분 true 를 안 싣는 이유로 든 "TEXT 답을 글자로 답함으로 단정" 은 두 설계 모두에서 같게 일어난다. 설계 변경 불요(옛 응답과 같은 모양이 단순). 주석·이력서 근거 문구만 정정 권고. |
| I-B | Info | `UtteranceLog.tsx` `loadMore` | `AbortController` 없음 — 버려진 응답의 요청은 끝까지 간다(사용자당 60/분 제한 안, 읽기 2회). 필요 시 후속. |
| I-C | Info | `evaluationVoiced.test.ts` 마지막 시험 | 라우트에 `\.has\(` 를 전부 금지한다 — 앞으로 라우트에 무관한 `.has(` 를 쓰면 시험이 오탐한다(재도입 방지 목적에는 충분). |
| I-D | Info | 이 이력서 Designer 가이드 §ⓚ·276행 | 가이드 문구 목록에 옛 라벨 "보내지 않은 말" 이 남아 있다 — 구현과 달라진 점을 가이드 쪽에도 주석 한 줄 권고(구현이 정본). |

### 변이 재현 `[확인]` — scratchpad 사본(`…/scratchpad/rev135/mir`, 원본 NFS·미러 무수정, 매번 원 사본 복원 확인) · dev 표 14종 **14/14 전부 재현·검출**(검출 건수까지 dev 보고와 일치)

| dev # | 내가 만든 변이 | 결과 |
|---|---|---|
| M3a′ | `markVoiced` `matched.has` → `!matched.has` | **검출** 5 |
| M3c′ | `VOICE_ANSWER_KINDS` 비움 | **검출** 4 |
| (D-B7) | `markVoiced` 에서 `\|\| matched.has` 삭제 — 고쳐 채점 판정 뒤집기 | **검출** 3 |
| M8a′/M8b | 방 비교 `() => true` / `stale` 갈래 삭제 | **검출** 2 / 2 |
| M8c | 훅 `currentRoom: () => chatId` | **검출** 1(정적) |
| L1a/L1b/L1c | `invalidate` 무동작(2) / `settleIfCurrent` 성공 늘 ok(4) / 실패 늘 error(2) | **검출** |
| L1d | `loadMore` 표를 `() => true` | **검출** 1(정적) — 추가로 stale 검사 삭제·`pick` 의 invalidate 삭제도 각 1(정적) |
| L2a/L2b/L2c | 흡수 대신 `throw` / 경고에 `e.message` / 실패 때 음성 출처만 true | **검출** 각 1 |
| M3 | UNSENT 문구 되돌림 | **검출** 1 |
| R1 | 라우트 `const items = dto.items` | **검출** 2(정적) |
| 추가 | 라우트에 `SPEAKING` 재도입(R2) 1 · `withVoiced(id, …)`(R3) 2 · 대조 항상 호출(L2d) 2 · `appendPage` 중복 제거 삭제(S4) 1 · `inflight` 무조건 해제(L3c) 1 | **검출** |
| 생존 5 | H1·H2·S1·S2·S3 (위 L-C) | **생존** — 시험 공백 |

### QA 인계 — high_risk_areas (갱신)
1. **#66 `voiced`(네트워크 탭)**: `GET /api/v1/evaluations/{id}` 응답 `items[].voiced` 가 **boolean 으로 전 문항에** 있는가(200). 음성으로 답한 평가 → "말로 답함 · 처음 들린/다시 들어 본 말로 채점했어요", **음성 답 → 직접 고침 → 채점** 평가 1건 → "말로 답함 · 내가 고친 말로 채점했어요"(D-B7), 글자 입력 답 → "글자로 답함", 고르기 문항 → `voiced:false`. 남의 평가 id 404. 실패 흡수는 단위 시험이 보증 — DB 장애를 일부러 만들지 않는다.
2. **기록 화면 더 보기 × 필터 전환**(네트워크 Slow 3G 권장): "더 보기" 직후 필터 탭 → 옛 필터 행·"더 불러오지 못했어요"가 새 목록에 안 섞임, 필터 왕복·연타 뒤에도 "더 보기" 가 계속 동작(S1·S2 생존 — 버튼이 로딩에 갇히지 않는지), 같은 필터 더 보기 연타 시 같은 행 중복 0.
3. **회화방 방 전환**(네트워크 탭): 요청 URL 이 `…/speech/utterances?chatId=<지금 방>&reviewable=1&limit=50` 인지 눈으로(H1 생존), 방 A 응답 대기 중 방 B 로 이동 → B 에 A 카드 0·B 첫 조회가 막히지 않음, 같은 방 동시 요청 ≤1(H2 생존), 녹음·생각·말하기 중 요청 0·쉬는 상태 복귀 시 1회(REV-132 항목 그대로).
4. **UNSENT 문구**: 방에서 녹음만 하고 보내지 않은 발화·`확인 필요` 칩과 함께 보일 때의 "연결된 대화 없음" 어색함(L-B), 360px 메타 줄(시각·문구·초·칩) 줄임표.
5. **이월**: #21c IDOR 라이브(계정 2 방 404·목록 격리·확인 불가 발화에 #21a/#21b → 404) — REV-132 인계 1·2 그대로.

### Leader 확인 필요
- **M-1(이월) 정본 반영**: api-contract 에 `#21c` 0건 `[확인]`(미커밋 diff 는 task-039 항목뿐). dev-012b2d 의 초안 ⑥ 을 코드와 대조했다 — 한도 1~50·기본 20·질의 4키·404/400·60/분·응답 13칸·`reviewableCount`·`Cache-Control: private, no-store` 가 `list.ts`·라우트와 일치 `[확인]`. **L-B 를 받아들이면 `context.kind` 값 하나가 늘므로 정본에 쓰기 전에 결정**하는 것이 쌈.
- **L-B**: UNSENT 를 둘로 가를지(designer 문구·`contextOfRow` 한 분기·테스트 3곳) — 이번 task 에서 할지 최종 보고 한 줄로 갈음할지.
- **L-A**: 학습 개념 중복 — `SUBJECTIVE_ITEM_KINDS` export 로 갈지 시험 단언으로 갈지(developer).
- **L-C**: 훅 요청 URL 순수 함수화·렌더 시험을 이 task 에서 요구할지, QA 네트워크 탭으로 갈음할지.
- 소유 밖 변경: `git diff HEAD`·`git status` 의 나머지(tts/**·engine/**·learning/scenarios/**·conversation/prompts/{talk,talkScenario,scenarioVerdict,scenarioInput}·prisma/seed*·tests/live/p2a-qa/** 등)는 012b-3·4·010d·challenge 등 **다른 작업 소속**으로 이 감사에서 제외. 이 task 파일은 mtime 대조로 dev-012b2d 보고 목록과 일치(`UtteranceReviewCard.tsx`·`TalkRoom.tsx`·`task012b2room.test.ts` 는 01:14~01:16 = dev-012b2c 이후 무변경).

## QA 기록

### qa-p2c-A (LLM 0 레인) — 중간 체크포인트 2026-10-07 08:30 KST

- **E1 `task012b2-smoke`**: 고정 행 없이 처음 돌렸을 때 **15 PASS · 5 SKIP**(계정 1 발화 0건 → S3c~e·S4·S6b·S8·S9 SKIP — SKIP 을 통과로 세지 않음). QA 전용 고정 행(`utt-fixtures.ts up` — QA1 방 1·발화 26(확인 대기 1·확정 1·방 없음 1·나머지 23)·완료 평가 1(문항 4: REALTIME_STT·SERVER_STT·TEXT·무응답), QA2 방 1·발화 2·완료 평가 1)을 DB 에 직접 만든 뒤 재실행 = **27 PASS · 0 FAIL · 0 SKIP**(#21c 쿼리 400 6종·항목 13칸 고정·최신순·소유 20/20·커서·reviewable 필터·reviewableCount=DB·방 필터 IDOR·#21a·#21b 남의 발화 404·#66 `voiced` 4종·남의 평가 404·엔진 문자열 0).
- **E2 #21a/#22 직접 검사(`utt-resolve.ts`) — 15 PASS(+정보 출력 1줄 R8 은 판정 제외)**: QA1→QA2 확인 대기 발화 PATCH 404(없는 id 와 같은 모양)·행 불변 · 본문 6종 400(행 불변) · USER 직접 고침에 XSS 문자열 `<img src=x onerror=alert(1)>…` 가 **리터럴 그대로 저장**(화면 이스케이프는 D/E 화면 구간에서 확인) · 확정 뒤 `realtimeText`·`analysisText`·ChatMessage 내용·번역·Correction 행 불변(원문 보존) · 재확정·이미 확정·분석 전 → 409 `NOT_REVIEWABLE` · 같은 발화 3중 동시 확정 → 200 정확히 1·나머지 409. **미확인(NOT_VERIFIED)**: "음성 답을 직접 고쳐 채점" 은 평가 제출이 LLM 채점(A7)을 부르므로 qa-p2c-B 에 넘김.
- 사고 기록(LLM 슬롯 겹침)은 task-010d `### qa-p2c-A` 에 같은 내용이 있다(이 레인 공통).

#### qa-p2c-A 최종 (2026-10-07 09:10 KST) — 판정: 012b-2 범위 결함 0(공용 결함 #3·#4 는 task-010d 기록 참조)

- **E 서버**: `task012b2-smoke` 27/27(고정 행) · `#21a/#22` 직접 검사 15 PASS(IDOR 404 같은 모양·행 불변, 본문 400 6종, 원문 보존, 409, 3중 동시 확정 1승) — 위 체크포인트.
- **E 화면(운영 빌드 3033, 3폭 × 780/892)**: `task012b2-screens` **57 검사 · fail 0**(스크립트가 목록하는 `small<44` 는 정보용 — 기록 화면 칩은 아래 실서버 히트 테스트로 재측정).
- **회화방 삽입(`UtteranceReviewSlot`) — PASS**(고정 응답 주입 + 실제 TalkRoom 화면): 음성(REALTIME_STT) USER 말풍선 `u1` 바로 뒤에 "들린 말 확인" 카드가 **정확히 1개**(순서 u1 → 카드 → 선생님 답, 글자(TEXT) 메시지 u2 뒤·선생님 말풍선 뒤에는 없음) 360/390/412 모두 · 390 에서 쉬는 중 33초 뒤 `#21c` 요청 +1(주기 30초, 6분 안 음성 메시지 있음) · **턴 진행 중(paused) 33초 동안 요청 증가 0** · 턴이 끝난 뒤 +1. `FollowHoldContext`(펼친 카드가 따라가기 스크롤을 붙잡는가)는 못 만들어 NOT_VERIFIED.
- **기록 화면(`/settings/utterances`, QA1 고정 행 29건, 실서버) — PASS**: 360/390/412 가로 넘침 0·틀 밖 요소 0·히트 테스트 44 미만 0·페이지 오류 0 · `ROOM_ONLY`("보내지 않은 말" 73px)·`UNSENT`("연결된 대화 없음" 84px) 라벨 잘림·넘침 0(scrollWidth=clientWidth, right ≤ 뷰포트) · 첫 쪽 20건+`더 보기` → **더 보기 직후 필터를 "확인 필요"로 바꾸면 확인 필요 목록만**(필터 밖 행 섞임 0) → "전체"로 되돌리면 첫 쪽부터 다시.
- 다크·한국어 줄바꿈은 task-010d 기록(공통). 엔진·신뢰도 문자열: #21c·#22·#66 응답 0, 화면 `src/components` 0.
- **LLM 이 필요해 못 한 것**: "음성 답을 직접 고쳐 채점"(#66 채점 경로, A7) → qa-p2c-B. `rp-denied`(마이크 거부)·실기기 → NOT_VERIFIED.
- 정리: QA1·QA2 고정 행(발화 29·대화 2·평가 2) 삭제 완료.

### qa-p2c-B (LLM 레인, 2026-10-07 09:55 KST) — 012b-2 범위: **PASS 15/15**

- **"음성 답을 직접 고쳐 채점"(D-B7) 실흐름** — 운영 빌드(`next start -H 127.0.0.1 -p 3034`)·실제 A6/A7(`tests/live/p2c-qa/b-eval-voice.ts`, QA1·임시 단어 5개): TALK 출제 24.1s DONE → 상황 문항에 발화(실시간 안·분석 안 다름·확인 대기) #67 연결 200(answerText=실시간 안) → #21a `choice:USER` 200(`finalText`=고친 말·`finalSource` USER·`realtimeText`·`analysisText` 불변) → QA2 의 #21a 404·행 불변 → 제출(A7) 18.2s DONE → **#66 해당 문항 `voiced:true`·`inputSource:TEXT`·`answerText`=고친 말**(DB 도 고친 말·점수·피드백), 나머지 문항 `voiced` 아님.
- **기록률**: Evaluation DONE 0→1 = StatsSnapshot(EVALUATION) 0→1 = StudyLog(EVALUATION) 0→1. #66 응답(4,271바이트)에 엔진·신뢰도 문자열 0, QA2 의 #66 404, 발화 원문(`realtimeText`) 보존·문항 연결 유지.
- 참고: 회화 평가는 단어장 단어 4개 이상이 필요(`NOT_ENOUGH_WORDS`, 계정 1 은 0개) — 스크립트가 임시 단어를 넣고 끝에 삭제. 채점 점수 0 은 고친 말이 출제 상황과 무관한 문장이라서(채점 입력이 고친 말이라는 증거는 DB `answerText`·`inputSource` 로 확인, LLM 입력 원문은 못 본다).
- 정리: QA1 평가 1·발화 1·AiJob·Trace·StatsSnapshot·StudyLog·임시 단어 5 삭제, 기준 덤프 대비 행 수 차이 0. 상세 판정·결함은 task-010d `### qa-p2c-B` 참조.

## 배포 기록

## 최종 요약

## Leader 결정 (designer 가이드의 결정 항목 확정, 2026-10-06 23:05)

designer 가이드(`## Designer 기록`)의 결정 D-1~D-5 를 **모두 designer 권고대로 확정**한다. 추가 조건만 적는다.
- **D-1** 목록 API 는 §3 권고 모양·번호는 developer 가 `api-contract.md` 의 빈 번호로 정하고 이력서에 기록(번호 충돌 확인), 방 제목 조합은 선택(비용 크면 생략).
- **D-2** #66 `items[].voiced` **추가**(라우트 조합 — learning→speech import 금지 유지). conversation/learning DTO 변경은 additive 한 칸뿐이며 옛 클라이언트는 무시.
- **D-3** 채팅방(CHAT) 삽입 **생략**. 완료 기준 1 은 "CHAT 방에 연결된 발화 0건(DB 조회)" 로 정정 — QA 가 DB 실측.
- **D-4** 방 카드 주기(30초·최근 6분 창)는 developer 가 실측으로 확정하고 이력서에 값을 남긴다.
- **D-5** 대화 삭제 뒤 발화 행·녹음은 **현 정책(남김, 30일 정리)을 바꾸지 않는다** — 화면은 "지운 대화"로 정직하게 표시. 정책 변경은 이번 범위 밖(최종 보고에서 한 줄 언급).
- 파일 경계: `TalkRoom.tsx` 삽입은 task-039 로컬 커밋 뒤, `chat/**` 는 건드리지 않음(D-3 으로 해소).

## 상태 정리 (2026-10-10)

- 상태 `todo` → `done`. 사용자 승인(2026-10-10 「2번 승인하고 진행해줘」) — Leader. 근거는 상태 감사 2건(읽기 전용) 결과를 Leader 가 일부 직접 대조한 것이다.
- Phase 2 릴리스 `20261007-104449-61044b91`(커밋 `1ccc105`). 감사 REV-132·REV-135 PASS_WITH_NOTES, qa-p2c-A 27/27 + 화면 57검사 실패 0, qa-p2c-B 15/15.
- 완료 기준 8개 중 1~6 충족. 7(턴 p50·TTFA 회귀)·8(스모크)은 이 이력서 안에 직접 증거가 없고 Phase 2 운영 회귀 스모크 201/202 로 갈음. 기준 1 의 「채팅방에 연결된 발화 0건」 DB 확인은 코드 확인뿐(QA 기록 없음).
- 남은 일(후속 추적): `docs/design/api-contract.md` 에 `#21c`(발화 목록)·`#66 voiced` 미반영(REV-132·135 M-1 이월, Leader 문서). 사용자 몫: 실기기·분석 결과 화면 확인.
