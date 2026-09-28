---
task_id: task-010c
title: "교정 방식 설정 — Profile.correctionMode(유창성 기본·코치), 회화 교정 표시·코치 힌트"
status: doing
base_ref: 98d8cac
risk_level: R1
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, deployer]
related_tasks: [task-005-settings-attendance, task-007-talk-voice-web, task-006-chat-correction, task-010b-repetition]
tags:
  - type/task
  - domain/settings
  - domain/talk
  - domain/prompt
  - domain/ui
  - domain/db
aliases:
  - 교정 방식
  - task-010c
created: 2026-09-28
updated: 2026-09-28
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-010c-correction-mode-v1.html"
  artifact_url: "https://claude.ai/artifact/3R8hFUYHumSxYThz4qdFg1"
  content_sha256: "40786f7f531ff28c0b6a8fbdd062ea5c6339ea015f7e010c53dcec2f0af630ff"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
설정에 "교정 방식"을 두고(기본 **유창성**), AI 회화(TALK)에서 교정을 보여 주는 방법을 바꾼다. 유창성 = 대화 흐름 우선, 의미 전달을 막는 큰 오류(MAJOR)만 그 자리에서 카드로, 나머지는 "모아 둔 교정"으로 쌓아 두었다가 학습자가 열어 본다(기록은 그대로 전부 남는다 — "철저 = 놓치지 않고 기록"). 코치 = 턴마다 교정하되 **정답 전에 힌트 한 번**(스스로 고쳐 말하게 유도), 역할극(task-010d)의 기본 모드.

완료 기준(design-spec §15 010c · learning-personalization §2-7·§2-8):
- `Profile.correctionMode` enum `CorrectionMode{FLUENCY, COACH}` 기본 FLUENCY(스키마 — 사용자 승인 후 push), 설정 화면·API(#12 계열 learning 설정)에서 변경
- TALK 턴: 모드가 A1 헤더(`[교정] 유창성|코치`)로 전달, `strictness`(무엇을 오류로 볼지)와 독립
- 유창성: `severity=MAJOR` 교정만 즉시 카드, MINOR 는 회화방의 "모아 둔 교정 N" 칩 → 시트(채택·거절은 기존 흐름 그대로). **교정 행 생성 규칙은 바뀌지 않는다**(PROPOSED 로 모두 저장)
- 코치: A1 `correction.hintKo`(additive, nullable) — 카드가 힌트 먼저 보여 주고 [정답 보기]로 교정문 공개, "다시 말해 보기" 유도. 학습자가 다음 턴에 스스로 고치면 `LearningObservation(SELF_CORRECTION)`(010b 테이블, 코드 판정: 직전 교정의 corrected 와 다음 발화 정규화 일치/포함)
- CHAT(글 채팅)은 이번 범위 밖(교정 표시 불변)
- A1 예산(≤3,000자)·5초 지표 회귀 없음, 3폭 잘림 0

## 사용자 결정·지시
- D6(2026-09-28 AskUserQuestion): "설정 항목 추가·기본 유창성 (Recommended)".
- 2026-09-28 사용자: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘".
- **스키마 추가(`Profile.correctionMode` 컬럼 + enum)는 운영 공유 DB 라 사용자 승인 후 push** — 010b·010d 스키마와 한 번에 승인 요청.

## 관련 과거 이력 요약
- [[task-005-settings-attendance]]: 설정 허브(학습 섹션 `LearningSettings.tsx`, `Profile` 편집 API). [[task-007-talk-voice-web]]: 회화방·교정 카드 즉시 표시·A1 `talk@v2`(키 순서·예산·altText 상한 — [[llm-japanese-quality]] §6·§7). [[task-006-chat-correction]]: 교정 카드 채택/거절, `Correction.severity`(MINOR·MAJOR).
- `Strictness`(GENTLE·NORMAL·STRICT, 기본 STRICT) 는 범위, `correctionMode` 는 빈도·표시 — 충돌 없음(learning-personalization §2-8).

## Leader's Plan (2026-09-28)
- **L1** A1 프롬프트 `talk@v3`: 헤더에 교정 모드 1줄. 유창성은 "대화를 이어 가는 데 집중, 교정은 여전히 가장 중요한 1건을 correction 에 넣고 severity 를 정확히(의미 전달 실패만 MAJOR)". 코치는 "correction.hintKo 에 정답을 직접 말하지 않는 힌트 1문장". 스키마 additive(`hintKo` nullable, 기존 응답 호환). 예산·키 순서 규칙 유지, 회귀 픽스처.
- **L2** 모아 둔 교정: 서버 변경 최소 — 턴 `done` 이벤트에 교정 `severity`(이미 있음)·`deliver:'NOW'|'LATER'`(모드 적용 결과) 추가, 회화방 상세(#31 계열)에 미처리 LATER 교정 수. 시트는 기존 교정 카드 컴포넌트 재사용.
- **L3** 코치 자기수정 판정은 코드(LLM 없음): 직전 턴 교정(`hintKo` 있음, 아직 PROPOSED)의 `corrected` 정규화 문자열이 이번 발화에 포함되면 `SELF_CORRECTION(SUCCESS)` + 교정 카드에 "스스로 고쳤어요" 표시. 채택 여부는 사용자.
- **L4** 설정 문구: 유창성 "대화 흐름을 먼저 — 큰 실수만 바로 알려 주고 나머지는 모아 둬요" / 코치 "하나하나 짚어요 — 힌트를 먼저 주고 다시 말해 보게 해요". 역할극은 모드와 무관하게 코치(010d).
- 화면(데모 delta): 설정 학습 섹션 항목 + 회화방 "모아 둔 교정" 칩·시트 + 코치 힌트 카드(힌트→정답 보기→다시 말하기, 스스로 고침 표시).
- 파일 경계: PE `conversation/prompts/talk.ts`·스키마·checks / developer `preferences`(Profile)·`conversation/orchestrator`(deliver)·`api/v1/settings/**`·회화방·설정 화면(데모 승인 뒤)·`prisma/schema.prisma`(승인 전 push 금지).

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 09-28 18:07 |
| v1 | 검토요청 | docs/demo/task-010c-correction-mode-v1.html | https://claude.ai/artifact/3R8hFUYHumSxYThz4qdFg1 | 사용자 검토 요청 | 09-28 20:23 |

## 작업 기록

### 2026-09-28 19:40 Leader — judge intake
- `judge-result@2`(engine jev, needs_info=false): risk R2 · developer opus · demo **delta(DM-low-confidence)** · `next=demo_first` → `check.mjs init`. 데모는 Phase 2 나머지 task 와 **한 번에 사용자 검토 요청**(승인 요청 횟수 최소화), 스키마 push 승인도 같은 메시지로.

### 2026-09-28 20:36 Prompt-Engineer — talk@v3(교정 방식)

**산출물**: `conversation/prompts/talk.ts`(`talk@v2`→`talk@v3`), `conversation/structuredResponse/schemas.ts`(`correctionObject`에 `hintKo` additive 필드만 추가, `TutorCorrection` 인터페이스 동일 반영), `conversation/structuredResponse/checks.ts`(`checkTalkResponse` 에 hintKo-정답-누출 검사 한 줄 — 둘 다 지시대로 "한두 줄만 Edit", 다른 PE 의 `evalSchemas.ts`/`evalChecks.ts` 작업과 겹치지 않음), `conversation/__tests__/{prompts,structuredResponse,task006}.test.ts`(회귀·신규), `conversation/index.ts`(`CorrectionMode`·`CORRECTION_MODES` export), `tests/live/talk-correction-mode-measure.ts`(신규 실측 스크립트).

**확정 계약**: `TalkInput.correctionMode?: 'FLUENCY'|'COACH'`(생략 시 FLUENCY, D6). stdin(`system`) 쪽에 `[교정] 유창성|코치` 헤더 한 줄 추가 — **persona(`--system-prompt`)는 무변경**(K4-3 전제 유지, correctionMode 는 persona 를 만들지 않는 인자). `correction.hintKo: string|null` additive(스키마 required-but-nullable, CHAT_SCHEMA 는 correction 이 항상 null 이라 영향 없음). FLUENCY 는 hintKo 항상 null(즉시 교정문 — 카드/모아두기 분기는 orchestrator L2 몫), COACH 는 hintKo 에 정답을 말하지 않는 힌트. `checkTalkResponse` 가 "hintKo 가 corrected 를 그대로 포함하면 위반"을 재시도용으로 잡는다(강도는 낮게 — 프롬프트 문구 정확도보다 안전망 성격).

**예산 사고와 해결(중요, 재발 가능한 함정)**: `[교정]` 헤더 한 줄만 추가해도(문구를 아무리 줄여도) 특정 조합에서 3,000자 캡을 넘겼다. 원인 조사 결과 **v2 부터 이미 있던 구조적 결함**이었다 — `buildTalkRequest` 의 이력 창 예산(`room = CAP - system.length - text.length - 40`)이 `renderTranscript` 가 나중에 붙이는 메시지당 라벨 접두(`[학습자] `/`[선생님] `, ~7~9자)·블록 머리말 오버헤드를 40자로 과소 추정하고 있었다. 그 결과 "무거운 학습자 헤더 + altText **중간 길이**(≈60자, 극단으로 긴 값이 아니다) + 꽉 찬 이력" 조합의 실제 v2 마진이 **3자뿐**이었다(`/tmp` 스크립트로 v2 원본 재현해 직접 확인). 내가 추가한 어떤 문구든(≥4자) 이 조합에서 캡을 넘길 수밖에 없었다. **해결**: 문구는 최소로 줄이되(FLUENCY 15자·COACH 18자 추가), 근본 원인인 여유 상수를 `WINDOW_ROOM_SLACK`(이름 붙임) 40→140 으로 올렸다 — light/heavy 학습자 × FLUENCY/COACH × 발화 1~1,000자 × altText 60~50,000자 전 조합(80가지)에서 최소 84자 마진 확인. `prompts.test.ts` 의 "TALK: 예산" 테스트가 altLen=60(중간값, 극단값만으로는 이 함정을 못 잡는다)을 반드시 포함하도록 회귀로 남겼다 — **다음에 A1 프롬프트에 한 글자라도 추가할 사람은 이 교훈부터 볼 것**(극단값 스윕만으로는 최악 조합을 못 찾는다, 양자화 때문).

**severity 정확도 — 절충(문서화 필요)**: task 요구("유창성: severity 정확히, 의미 전달 실패만 MAJOR")를 위해 stdin 리마인더 문장을 추가했다가 예산 초과로 되돌렸다(persona §3-6 에 이미 같은 기준이 있어 완전히 안내가 없는 것은 아니다). 실측(FLUENCY 3턴, e01~e03 — 활용·존댓말·조사 오류로 뜻은 대체로 통함)에서 **3/3 전부 MAJOR** 로 나와 "의미 전달 실패만 MAJOR" 기준과는 어긋났다 — 예산이 이 task 의 1순위(operation_contract)라 절충했다. `WINDOW_ROOM_SLACK` 수정으로 84자 마진이 생겼으니, severity 정확도가 QA 에서 문제로 확인되면 짧은 리마인더(예: " severity 는 의미가 안 통해야만 MAJOR." 29자)를 다시 넣을 여지는 있다 — Leader/QA 판단 필요.

**실측 표(우분투, `--env-file=.env`, haiku, `tests/live/talk-correction-mode-measure.ts`, e01~e03 각 모드 3턴 = 총 6회, 2026-09-28)**:

| id | mode | 성공 | ms | attempts | severity | hintKo | 정답누출 | 위반 |
|---|---|---|---|---|---|---|---|---|
| e01 | FLUENCY | OK | 4,838 | 1 | MAJOR | null | false | 0 |
| e02 | FLUENCY | OK | 5,079 | 1 | MAJOR | null | false | 0 |
| e03 | FLUENCY | OK | 5,721 | 1 | MAJOR | null | false | 0 |
| e01 | COACH | OK | 5,479 | 1 | MAJOR | 「行く」를 과거형으로 바꿔 보세요. ～ました 앞에 어떤 형태가 와야 할까요? | false | 0 |
| e02 | COACH | OK | 5,714 | 1 | MAJOR | 명사 뒤에는 「だ」를 빼고 「です」만 붙여요. | false | 0 |
| e03 | COACH | OK | 6,687 | 1 | MAJOR | '만나다(会う)'는 누구를 만나세요? → 누구「に」를 생각해 보세요. | false | 0 |

6/6 성공, 재시도 0, 위반 0(위반율 0%, 목표 ≤5% 이내). FLUENCY 는 hintKo=null 3/3 준수, COACH 는 hintKo 채움 3/3·정답 누출 0/3(힌트가 정답을 되묻는 질문 형태로 잘 나왔다). 전부 12s fail-fast 안(최대 6.7s).

**developer 인계**: `TalkInput.correctionMode` 는 `Profile.correctionMode`(스키마 승인 대기)에서 읽어 넘기면 됨 — 스키마 push 전에는 생략(기본 FLUENCY)으로 그대로 돌아간다. 턴 `done` 이벤트에 `deliver:'NOW'|'LATER'`(모드+severity 로 분기, "모아 둔 교정" 칩)를 만드는 것은 Leader's Plan L2 대로 orchestrator 몫 — 이 파일은 `correction.severity`·`hintKo` 를 그대로 줄 뿐 분기하지 않는다. 코치 자기수정 판정(L3, `SELF_CORRECTION`)도 orchestrator/learning 몫(LLM 없음, 코드 판정).

**위반율**: 0/6(0%). A1 예산 불변식(≤3,000자) 회귀 테스트로 고정, 전체 회귀 662건(661 PASS·1 skip) 무관.

### 2026-09-28 20:47 Prompt-Engineer — Leader 후속: severity 경계 보강(같은 talk@v3, 미배포)

Leader 지시: 유창성 모드는 severity 로 즉시표시(MAJOR)/모아두기(MINOR)를 가르는데, 첫 실측(e01~e03)이 3/3 MAJOR 로
나와 게이팅이 무력화됐다는 지적 — 경계 픽스처 ≥10문장으로 재측정하고 ≥80% 일치를 확보하라는 지시.

**산출물**: `conversation/prompts/talk.ts` 수정만(`FLUENCY_SEVERITY_RULE` 신설·`WINDOW_ROOM_SLACK` 140→220), `tests/prompts/fixtures/talk-severity-boundary.json`(신규, 조사3·활용3·어휘오선택2·어순1·정중함1), `tests/live/talk-severity-boundary-measure.ts`(신규), `conversation/__tests__/prompts.test.ts`(severity 기준 문구 검증 테스트 추가 + altLen=60 필수 스윕). `structuredResponse`(schemas/checks) 무변경 — 이번 보강은 순수 프롬프트 문구·예산 슬랙 조정뿐이다. **`talk@v3` 버전 번호는 그대로**(아직 배포 전이라 버전을 올리지 않았다, Leader 지시대로).

**핵심 발견 — 1차 문구(약한 조건문) 실패 → 2차 문구(단정 분류) 성공**: "뜻이 통하면 MINOR" 식 조건문(62자)은 경계 픽스처 10문장 중 3/10(30%)만 맞았다 — 조사 3건·활용 3건이 전부 MAJOR 로 나와 1차 릴리스와 같은 실패가 재현됨(haiku 가 "문법이 틀렸다"는 사실에 강하게 끌려 MAJOR 로 매기는 편향, 조건문으로는 못 이김). "조사·활용·어순·존댓말 오류는 **항상 MINOR**. 완전히 다른 단어를 써서 말이 안 되거나 뜻이 반대로 바뀔 때만 MAJOR."(93자, 카테고리 직접 분류로 재작성)로 바꾸자 **10/10(100%)** — 목표 80%를 크게 초과 달성. e01~e03(첫 실측 실패 사례)도 재측정하면 전부 MINOR 로 바뀌어 경계 픽스처 밖에서도 일반화 확인. COACH 는 이 문구를 받지 않는다(게이팅과 무관, 손대지 않음 — 재측정해도 MAJOR 유지, 의도대로).

**예산**: 93자 문구가 `WINDOW_ROOM_SLACK`(9-1 참고, v2 부터 있던 0마진 결함) 140 만으로는 24자 마진까지 좁혀 220 으로 재상향 — light/heavy 학습자 × FLUENCY/COACH × 발화 1~1,000자 × altText 60~50,000자 전 조합 최소 103자 마진 재확인. `prompts.test.ts` 예산 회귀에 altLen=60(중간 길이 — 극단값 스윕만으로는 최악 조합을 못 찾는다는 교훈, [[llm-japanese-quality]] §9-1)을 반드시 포함시켰다.

**실측**: 경계 픽스처 10/10(100%, `tests/live/talk-severity-boundary-measure.ts`) + 기존 e01~e03 재측정 3/3 MINOR(이전 3/3 MAJOR 에서 뒤집힘, `talk-correction-mode-measure.ts`) — 상세 표는 [[llm-japanese-quality]] §9. 전체 회귀 663건(662 PASS·1 skip) 무관, typecheck/lint 클린.

**Leader/QA 참고**: 문서화한 대로 이번 severity 보강은 `[교정]` 헤더 줄(FLUENCY 전용)에만 있고 `talkInstruction()`(공통 correction 지시)은 무변경이다 — 향후 A1 프롬프트를 더 건드릴 사람은 `WINDOW_ROOM_SLACK` 예산 함정(§9-1)부터 반드시 확인할 것.

### 2026-09-28 18:30 Designer — 데모 v1 작성 (lint 통과, 검토 대기)
- [18:30] `docs/demo/task-010c-correction-mode-v1.html`(meta `task-010c-v1`, 토큰 `src/app/globals.css@sha256:72ff73699119`, 합성 데이터·인라인만, 97.8KB). 틀 표시·배율·모바일 접힘 목록은 승인된 [[task-010-today-lesson]] v2 방식 그대로. 상태 23개(#id): 설정 6(`set-compare`·`set`·`set-coach`·`set-saving`·`set-saved`·`set-fail`) · 유창성 10(`fl-compare`·`fl-flow`·`fl-sheet`·`fl-accept`·`fl-partial`·`fl-done`·`fl-empty`·`fl-loading`·`fl-error`·`fl-deeplink`) · 코치 6(`co-compare`·`co-hint`·`co-revealed`·`co-self`·`co-auto`·`co-nohint`) · 메뉴 1(`menu`).
- 설계 요지: 설정 = '교정 강도' 바로 아래 두 줄 선택 카드(유창성 기본 뱃지·코치) + 관계 한 줄("교정 강도는 무엇을, 교정 방식은 언제") + "말로 하는 회화에만" 한 줄, 저장은 기존 [학습 설정 저장] 그대로. 유창성 = MAJOR 는 기존 카드 즉시, MINOR 는 말풍선 표시 없이 칩 숫자만 +1(짧은 확대·녹음 끝난 뒤 낭독 1회) → 시트(기존 카드·오래된 것 위·채택 시트는 시트 위에 겹쳐 열고 복귀·모두 처리/빈/불러오는 중/오류). 코치 = 힌트 전엔 내 문장+힌트+"다시 말해 보세요"+[정답 보기]만(교정문·틀린 곳·채택 숨김), 상태 줄도 "힌트를 보고 다시 말해 보세요", 다음 말에 교정문 포함 시 "스스로 고쳤어요 ✓", 힌트 없는 교정은 기존 카드로.
- 결정 필요(권고): (a) 칩 위치 **A 머리 오른쪽**(360 은 "교정 N") vs B 입력 바 위 · (b) 정답 공개 **B 다음 말 뒤 자동(버튼도 있음)** vs A 누를 때만 · (c) designer 추가 — 회화 메뉴(⋯)에서 교정 방식 바꾸기 **B 메뉴에도(들려주는 방식처럼 즉시 저장)** vs A 설정에서만.
- Leader 확인 필요: ① [정답 보기] 후 따라 말한 경우를 "고쳐 말했어요"로 구분하려면 공개 여부가 서버 판정(L3)에 전달돼야 함(지금 L3 는 공개 여부를 모름) ② 홈 "채택을 기다리는 교정"의 LATER 교정 링크 `#cr_{id}` → 회화방이 모아 둔 교정 시트를 그 카드에 맞춰 열어야 함(L2 에 시트 목록 조회 필요 — 오래된 메시지는 클라에 없음) ③ (c)=B 면 회화 메뉴가 프로필 설정 저장을 직접 부름.
- 검증: `check.mjs lint --expect task-010c-v1` → DEMO_LINT_PASSED. 헤드리스 Chrome(CDP, 412×892 뷰포트, mobile) — 23개 상태 × 360/390/412 × 780/892 페이지 가로 넘침 0·틀 밖으로 나간 요소 0·스크롤 영역 가로 넘침 0·JS 예외/콘솔 오류 0, 1440 데스크톱 넘침 0. 흐름 실측: 유창성 말하기 → 칩 2→3·인라인 카드 수 불변·낭독 문구 확인 / 시트 채택(뜻 비움 → 검증 문구)·채택만·무시 → "모두 확인" → 닫으면 칩 사라짐 / 코치 힌트 → [정답 보기] 초점 "이렇게 고쳐요" / 고쳐 말하기 → "스스로 고쳤어요 ✓" / 결정 b A↔B 전환 반영 / 메뉴 코치 저장 토스트 / 설정 저장 성공·실패(선택 유지). 엔진명·모델명·task·Phase 문자열 0건.
- 다음: Leader Artifact 게시 → 사용자 검토. 승인 전 구현 가이드·screens.md·src 미작성.

### 2026-09-28 22:28 reviewer — REV-031

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 0). 범위: `conversation/prompts/talk.ts`(`talk@v3`)·`structuredResponse/{schemas(hintKo),checks}.ts`. **화면·orchestrator 미연결 확인** — `git diff` 로 `conversation/orchestrator/index.ts` 무변경 확인, `buildTalkRequest` 호출부(orchestrator L282·L520)가 `correctionMode` 를 전달하지 않아 이번 릴리스에서 실제로는 **항상 FLUENCY** 로 호출된다(설계대로 기본값).

- **운영 회화(A1) 경로에 미치는 실제 영향**: 이번 배포로 **모든 TALK 턴**에 `[교정] 유창성 — severity: 조사·활용·어순·존댓말 오류는 뜻이 통하니 항상 MINOR. …`(`FLUENCY_SEVERITY_RULE`, 93자) 한 줄이 stdin 프롬프트에 새로 추가된다 — v2 대비 신규 지시문. 이 자체가 "회귀 없음"을 요구하는 항목이라 아래를 직접 확인했다.
  - **3,000자 불변식**: `WINDOW_ROOM_SLACK` 이 40→140→220 으로 두 차례 상향됐고, `prompts.test.ts` 의 예산 회귀가 light/heavy 학습자 × FLUENCY/COACH × 발화 1~1,000자 × altText 60~50,000자(altLen=60 중간값 포함, 극단값만으로는 못 잡는 함정이 실측으로 이미 한 번 드러났던 지점) 전 조합에서 `TALK_USER_PROMPT_CAP=3,000` 을 넘지 않는지 검증 — 테스트 통과 확인(코드 읽음, 재측정 로그도 [[llm-japanese-quality]] §9-1 과 일치).
  - **키 순서 지시문**: `talkInstruction()` 의 `[지시]` 줄·`[순서 예]` JSON 이 v2 와 동일(교정 모드 줄은 `correctionInstructionLine()` 한 줄만 삽입, K4 TTFA 순서 지시 자체는 무변경) — 코드 diff 로 직접 확인.
  - **예열 `--system-prompt` 바이트 불변(K4-3)**: `persona = loadPersona({ sections:[1,3,4,6], level, mode:'TALK' })` — `correctionMode`·`[교정]` 줄은 `system`(stdin) 쪽에만 들어가고 `persona`(→ `--system-prompt`)는 `(model, level, mode)` 로만 정해짐(코드 확인) — CLI 예열 프로세스 재사용에 영향 없음.
  - **hintKo additive 호환**: `correctionObject.required` 에 `hintKo` 가 추가됐지만 `anyOf:[null, string]` 이라 과거 데이터·CHAT_SCHEMA(`correction:{type:'null'}` 로 override, `hintKo` 자체를 안 씀)는 영향 없음 — 스키마 코드로 직접 확인.
  - **severity 기준 변경이 교정 기록(Correction 행)에 주는 영향**: orchestrator 의 즉시표시/모아두기 분기(L2)가 아직 구현되지 않아 **severity 값과 무관하게 모든 교정이 지금처럼 즉시 카드로 표시**된다(orchestrator 무변경 확인) — "유창성 UI 가 아직 없으니 모든 교정은 즉시 표시된다"는 PE 의 주장을 코드로 검증, 회귀 없음.
- **정답 누출 방지**: `checks.ts checkTalkResponse` 가 `hintKo.includes(corrected)` 이면 재시도 위반으로 잡음 — 코드 확인.
- **CHAT 경로 불변**: `CHAT_SCHEMA` 가 `correction` 을 항상 `{type:'null'}` 로 고정해(schemas.ts 40행 근방) `hintKo` 요구조건이 CHAT 응답에 아예 적용되지 않음 — "CHAT 은 범위 밖" 주장과 일치.
- **QA 참고(동작 변화 없음, 확인만 필요)**: 이번 릴리스에서 사용자가 체감할 유일한 변화는 "유창성 모드의 severity 판정 정확도"(조사·활용 오류가 더 이상 항상 MAJOR 로 안 뜸 — 다만 화면에 severity 구분 UI 가 없어 학습자에게는 안 보임)뿐이다. `hintKo` 는 `correctionMode` 가 전달되지 않는 한 항상 null 이라 이번 배포로는 관측 불가능(향후 orchestrator 연결 시 재검증 필요 — 그때는 **developer 재순환**).
- 실행 검증: `tsc` 0 · `eslint` 0 · 단위 테스트(`prompts.test.ts`·`structuredResponse.test.ts`·`task006.test.ts` 포함) 706건 705 pass/1 skip/0 fail · `next build` 클린 성공(TALK 라우트가 쓰는 `buildTalkRequest` 포함 번들 정상).
- **릴리스 동반 가능**: 예 — 운영 회화 경로에 실제 영향이 있는 유일한 변경이지만, 예산·바이트 불변식·키 순서·CHAT 무영향을 전부 코드로 재검증했고 회귀 테스트가 최악 조합(중간 길이 altText)까지 커버한다.
