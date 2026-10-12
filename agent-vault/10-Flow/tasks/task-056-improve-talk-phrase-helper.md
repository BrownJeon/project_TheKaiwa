---
task_id: task-056
title: "회화방 일본어 도우미 — 말이 막힐 때 한국어로 물어보면 알맞은 일본어를 제안 (IMP-0030, 마이크 버튼 오른쪽에 별도 배치)"
status: done
base_ref: d004079
risk_level: "R1"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-007-talk-voice-web, task-010d-scenario-roleplay, task-006-chat-correction]
imp: [IMP-0030]
tags:
  - type/task
  - domain/improvement
  - domain/conversation
aliases:
  - 회화 도우미
  - 일본어 도우미
  - task-056
created: 2026-10-11
updated: 2026-10-12
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-056-talk-phrase-helper-v1.html"
  artifact_url: ""
  content_sha256: "704e8d58cb2a506717c08f7c954e221bd1a976b8969667aded11dae725e8319c"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-11T17:58:33+09:00"
  approval_quote: "4번만 'B안'으로 하고 나머지는 권고안대로 진행해줘"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-056 — 회화방 일본어 도우미 (IMP-0030)

## 사용자 요청 (원문)
- 2026-10-11 개선 백로그 [[IMP-0030-회화-한국어질의-일본어도우미]] 로 등록: 「회화 중에 사용자가 말하려고할때 잘 생각나지 않는 단어나 문장의 도움을 받기 위해서 한국어로 질의하면 적절한 일본어를 알려줄 수 있는 도우미가 있었으면 좋겠어.」 / 「이건 기존 마이크로 말하는 버튼 외에 우측에 바로 배치해서 별도로 도움을 받는 방식으로 해줬으면 좋겠어」
- 2026-10-11 `/개선작업 프로젝트:일본어교육 착수` 2단계 사용자 결정(AskUserQuestion): 우선순위 **P2, 지금 착수** · 적용 범위 **일반 회화방 + 역할극 방 둘 다**.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **이미 있는 것**: 「대답 연습」(`src/components/scenario/PracticeDock.tsx`)은 **역할극 방 전용**이다(`useRolePlay.ts` `target = active && !ended ? practiceTargetOf(messages) : null`). 마지막 선생님 말에 대한 답 예시(고르기·말하기·따라 하기)를 주며, 판 안에 마이크·보내기를 두지 않고 [입력창에 넣기]까지만 한다(D-8). 사용자가 한국어로 직접 묻는 입구는 없다.
- **방 컴포넌트**: 일반 회화방과 역할극 방은 같은 `src/components/talk/TalkRoom.tsx` 가 그린다(역할극은 `rp.active` 로 분기). 입력 영역은 `composerRef.current?.fill(text)` 로 입력창에 글자를 넣는 경로가 이미 있다.
- **`/ask`(무엇이든 물어보세요)**: `src/app/(app)/ask/page.tsx` 는 `ComingSoon`(Phase 3)뿐 — 호출 경로·계약이 없어 이 task 가 새 계약을 만들면 나중에 `/ask` 가 재사용할지 판단 대상이다.
- **원칙(CLAUDE.md)**: AI 는 제안만(저장은 사용자 채택 시), LLM 응답은 JSON 객체 하나 + ajv 1회 재시도, 5초 예산(12s fail-fast), 실시간 경로(푸시투토크→턴→TTS)에 분석을 동기로 넣지 않음, 엔진명 비노출, 6층 방향(conversation 모듈 소유·라우트가 조합), 원음·전체 대화 미보관.
- **음성 입력 제약(확인 필요)**: 온디바이스 STT 는 일본어 모델(ReazonSpeech)이고 안드로이드 기본 STT 는 금기다. 「한국어로 질의」를 **한국어 음성**으로 받으려면 새 STT 경로가 필요할 수 있다 — 이 task 의 첫 결정 사항(아래).
- 승인된 교훈(`/이슈기록 관련 talk voice ui`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- **1차**(`origin: improvement`): feature · 2.01 · R1 · developer=opus · `track: light` · demo=none(`DM-light-waive`, waived_level=delta). 스크래치 `judge-056-intake.json` / `.out.json`.
- **Leader 승격 → standard**: 이 항목은 입력 바 화면 구조 변경 + **새 AI 호출 지점(프롬프트·JSON 계약)** + 새 서버 라우트 + 새 판(시트) 이다. light 는 「작은 개선」용이고 한계에 「신규 화면」이 있다(`leader.md` `<agent_dispatch>` §4) — 판은 신규 화면 요소로 본다. light 면 prompt-engineer·designer·QA·데모 게이트가 모두 빠지는데 새 AI 계약에는 맞지 않는다.
- **2차**(`demo_pref: "require"` + `new_paths` 입력, 사용자 요구가 아니라 **Leader 승격 판단**): feature · 2.0 · R1 · developer=**opus** · **standard**(`track_blockers: demo_pref_require`) · demo=**delta**(`JV-ui_change`, owner designer) · `next=demo_first` → **사용자가 데모를 승인하기 전에는 화면 코드를 쓰지 않는다.** 역할 designer → prompt-engineer(필요 시) → developer → reviewer → qa. 스크래치 `judge-056-intake-v2.json` / `.out.json`.
- 사용자가 데모를 원하지 않으면 사용자 원문으로 `check.mjs waive`(judge 의 `waiver_requested` 만으로 생략하지 않는다).

## 판단 기록 (judge)
- intake: standard·R1·developer=**opus**·demo=delta(승인 완료). `developer_model=opus` → 실호출모델=**opus**(server·UI 2소환 분할, 각 maxTurns 80 대비). 위 「Leader 승격」 참조.
- **C1 (설계 확정 직후, 2026-10-11)**: `codex_required=false` · `budget_rule=CX-limit-unknown-hold`(Codex 한도 값이 오래돼 미확인 → 보류) · codex 스위치 on · 호출 0/4. override 없음 — Codex 검토 없이 진행. 스크래치 `judge-056-c1.json` / `.out.json`.

## 결정이 필요한 것 (designer 데모 전·중에 사용자에게)
1. ✅ **질의 입력 방식 — 결정됨(2026-10-11 사용자 「글자 입력으로 시작하자」)**: 첫 버전은 한국어 **글자 입력**(키보드). 한국어 **음성** 입력은 이번 범위 밖 — 온디바이스 STT 는 일본어 모델이라 새 STT 경로가 필요할 수 있어 하게 되면 별도 판단·승인 사항.
2. **결과 모양**: 일본어 표현 + 읽기 + 한국어 뜻 + 재생 + [입력창에 넣기](대답 연습 D-8 패턴). 후보 개수(1~3)·자연스러움 설명 한 줄 여부.
3. **마이크 오른쪽 배치**: 360/390/412px 입력 바 폭에서 푸시투토크(≥64px)와 도우미 버튼(≥44px)이 함께 들어가는 배치 — designer 데모에서 확인.
4. **`/ask` 와 호출 경로 공유 여부**: 같은 계약을 쓸지 별도로 둘지(prompt-engineer·Leader 판단).
5. **역할극 방**: 대답 연습과 도우미가 같은 화면 아래에 겹치지 않는 배치(둘의 역할 구분 문구 포함).

## 사용자 결정 — 데모 v1 승인 (2026-10-11 17:58, `check.mjs approve` 기록)
- 승인 원문: 「4번만 'B안'으로 하고 나머지는 권고안대로 진행해줘」. 데모 파일 `docs/demo/task-056-talk-phrase-helper-v1.html`(sha256 `704e8d58…8319c`).
- 확정: ① **A** 입력 바 위 판 · ② **B** 후보 최대 3개(첫 카드만 보이고 [다른 말투 n개 더 보기]로 접음) · ③ **A** 「왜 자연스러운지」 한 줄 있음 · ④ **B** 도우미 버튼은 **둥근 아이콘만 44px + 처음 한 번 안내** · ⑤ **A** 녹음 중 판 유지(전송 후 닫음) · ⑥ **A** 한국어 뜻 줄 항상 표시 · ⑦ **A** 역할극 방에서 대답 연습 부제도 함께 고침(「선생님 말에 맞는 대답 예시를 봐요」, 문구만·동작 불변).
- Leader 해석: ④B 의 「처음 한 번 안내」는 기기 안 1회 표시 플래그가 필요하다(질의·답 원문 저장이 아님) — 저장 위치(localStorage 등)와 문구는 designer 가이드에서 정하고, 원문 미보관 원칙과 충돌하지 않는지 reviewer 가 본다. ⑦A 는 대답 연습 **동작 변경이 아니라 입구 부제 문구만 변경**으로 본다(범위 안).
- API 번호: **#180** `POST /api/v1/chats/:id/phrase-help` 로 배정(#161~#179 사용 중·#160·#168 재사용 금지).

## 산출물 요약 (2026-10-11)
- designer: [[task-056-designer-record]] — 확정 구현 가이드 + `docs/screens.md` §22(회화방 일본어 도우미). ④B 안내 플래그 `localStorage kaiwa.talk.helperTipSeen='1'`(원문 저장 아님, `claimHelperTip()` 이 쓰고 다시 읽어 확인).
- prompt-engineer: [[task-056-pe-record]] — `phraseHelp@v1`(fast=haiku·12s·interactive 레인·재시도 없음), 맥락 = 수준 + (역할극) 장면 한 줄뿐, 거절은 200 `{items:[]}`. 실호출 53건 1차 통과 96.2%·최종 실패 0·일반 p50 3.7s/p95 6.1s·긴 질의 p50 5.0s. 시험 phraseHelp·prompts 55/55, conversation 전체 914/914, eslint 0. API #180 행은 `api-contract.md` 에 반영(Leader).

## Leader 결정 — prompt-engineer 열린 질문 (2026-10-11)
1. **턴 진행 중 호출**: `TURN_RUNNING` 409 는 **두지 않는다**(도우미는 방 상태에 의존하지 않고 화면도 안 잠근다). 대신 사용자당 동시 1건 `PHRASE_BUSY` 409(프로세스 메모리, `PRACTICE_BUSY` 선례)를 둔다. **위험(PE 확인, `claudeCli.ts` pump)**: CLI 큐가 전체 직렬이라 도우미 요청이 회화 턴 앞에 서면 회화 턴이 그만큼 늦어질 수 있다 — QA 항목에 「도우미 진행 중 마이크 전송 시 회화 턴 지연」 측정을 넣고, 5초 예산을 해치면 그때 막는다(`TURN_RUNNING` 추가). `[가능성 높음]` 실사용에서는 드물다.
2. **질의 상한 100자 유지**(ja 100/ko 120 한도). 긴 질의는 후보 1개라 카드 높이는 판 안 스크롤로 닿는다.
3. **응답 타입**: 서버 모듈을 화면에서 import 하지 않는다 → developer 가 **새 파일 `src/types/phraseHelp.ts`** 에 복제 정의한다. 공유 파일 `src/types/chat.ts`(task-055 편집 중)는 건드리지 않는다.
4. **429**: 분당 10·하루 300(#169 와 같은 값, 키 `phrase-help:<uid>`·`phrase-help-day:<uid>`).
5. **`whyKo` 가 비는 것은 정상**(길거나 높임 요구 입력에서 첫 카드 약 15~25%) — QA 가 결함으로 세지 않는다.
6. `LLM_TASKS` 에 `phraseHelp: { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' }` 추가는 developer 몫(시험이 값을 잠금).
7. **공유 파일 커밋 규칙(다른 세션 협의)**: `src/modules/conversation/index.ts`·`src/types/chat.ts` 등은 파일째 `git add` 금지, 자기 task 줄만 `git apply --cached` 로 스테이징. push 는 사용자 지시가 있을 때만, push 전에 양쪽 커밋 상태 확인.

## 설계 (Leader 초안 — designer·prompt-engineer 가 구체화)
1. **화면**: 입력 바 마이크 오른쪽에 도우미 버튼 → 탭하면 도우미 판(시트 또는 입력 바 위 판)에서 한국어로 질의 → 결과 카드(표현·읽기·뜻·재생·[입력창에 넣기]). 일반 회화방과 역할극 방 공통, 푸시투토크와 터치 영역이 겹치지 않는다. 키보드 inset·`:root[data-kb]` 규칙(IMP-0008)을 따른다.
2. **서버**: 새 라우트(번호는 `api-contract.md` 갱신 때 Leader 가 배정), conversation 모듈 소유의 호출 함수, Claude CLI 어댑터 경유, 소유자·capability 검사. 질의·응답 원문은 `RequestTrace`·로그에 남기지 않는다.
3. **프롬프트**: prompt-engineer 가 프롬프트 모듈·JSON 스키마·회귀 픽스처를 설계한다(번호는 Prompt Registry 기준). 5초 예산 안에 응답하고 실패 시 부드러운 폴백 문구.
4. **원칙**: AI 는 제안만 — 단어장 저장은 사용자가 채택할 때만(이 task 에서 저장 경로를 새로 만들지는 않는다, 필요하면 기존 단어 추가 경로 재사용을 판단).

## 하지 않는 것
- `/ask`(Phase 3) 구현, 대답 연습(`PracticeDock`) 동작 변경, 교정 모드·교정 채택 흐름 변경, 서버 스키마 변경(필요해지면 사용자 승인 먼저), 네이티브 변경(웹 배포만 `[가능성 높음]`), 안드로이드 기본 STT/TTS 사용, **한국어 음성 질의 입력**(사용자 결정 2026-10-11 — 글자 입력으로 시작).

## 완료 기준
1. 사용자가 데모 vN 을 승인(문장 그대로 기록).
2. 새 API·프롬프트 계약 시험(스키마 위반·시간 초과·소유자 검사·빈 질의), tsc·eslint 0, reviewer 가 증빙 재실행·변이 확인.
3. QA(QA 계정만): 일반 회화방·역할극 방 모두에서 도우미 열기→질의→결과→[입력창에 넣기], 푸시투토크와 겹침 없음(3폭 가로 넘침 0·터치 44/64px), 키보드 올라온 상태, 5초 예산, 표시 스위치(히라가나·한글·번역) 반영.
4. 배포 후 읽기 전용 스모크, 사용자 폰 확인.

## 상태 로그
- 2026-10-11 접수·묶음(base_ref `d004079`). `/개선작업 착수` 로 생성. 다음: 데모 게이트 init → designer 데모 v1.
- 2026-10-11 데모 게이트 init(`drafting`, delta, `JV-ui_change`) · designer 데모 v1 소환. 사용자 결정: 질의 입력은 **한국어 글자 입력으로 시작**(음성 제외) — designer 에게 전달.
- 2026-10-11 designer 데모 v1 완료(`docs/demo/task-056-talk-phrase-helper-v1.html`, lint 통과, 상태 `review_requested`) · 결정 7건(①~⑦)은 [[task-056-designer-record]] 참조. SendUserFile 로 보낸 파일은 사용자 화면에서 보이지 않았다 → Leader 가 게이트 절차의 **Artifact 게시**를 건너뛴 것이 원인 → 비공개 Artifact 로 게시: https://claude.ai/artifact/6H9W91sGLKTyj9B4BJyqY1 (게시용 사본은 `<html>`·`<head>`·`<body>` 태그만 뺀 것, 저장소 승인 정본은 무변경 sha256 `704e8d58cb2a5067…`). 도구는 `review_requested` 재기록을 거부해서(drafting·changes_requested 에서만 전이) `artifact_url` 칸은 비어 있다 — 링크는 검토 편의 수단이고 승인 정본이 아니다.

## 감사·QA 진행 요약 (2026-10-11 저녁)
- **감사**: 서버 REV-190→192, 화면 REV-191→193 모두 PASS_WITH_NOTES(Critical·High·Medium 0 최종). 서버 보완(취소 신호 전달·`signal.aborted` 하드닝·시험), 화면 보완(요청 수명주기 컨트롤러 분리·시험·칩 터치 영역).
- **QA-A(서버) PASS_WITH_NOTES**: 스모크 26/0/1, 저장 0·원문 0, 한도·`PHRASE_BUSY`·취소 후 재호출 확인. F-1 Low(배열 본문 400 사유 없음)는 계약 문서를 현실에 맞춤.
- **QA-B(지연·경합·취소·장애) PASS_WITH_NOTES**: 단독 p50 3.77s/p95 6.00s(5초 안 88%), 취소 후 자식 프로세스 0.53~0.58s 종료, 504 12.01s·502 확인. **경합 확인**: 도우미가 먼저 돌면 회화 턴 첫 음성 p50 2.19→5.16s. → **사용자 결정(2026-10-11): 녹음 시작 시 대기 중인 도우미 요청 자동 취소**(screens §22 반영, 구현 예정). 배포 직후 콜드 첫 호출 504(B-2) 재확인 필요.
- **QA-C(화면) FAIL → 진단**: F-1 환경 원인(STT 게이트웨이 부재→띠), F-2/F-3 실결함(blur→바 재등장→판 이동→click 소실; `onPointerDown preventDefault` 통일로 수정), F-4 QA 스크립트 오독, F-5 실결함(칩 히트 42px). 수정 소환 진행 중. ⑤A 실검증은 가짜 마이크+게이트웨이 흉내 또는 실기기.
- **화면 수정 완료**: F-2/F-3(판 안 버튼 7개 `onPointerDown preventDefault`, 첫 탭 38/38)·F-5(칩 히트 `before:-inset-y-[5px]`)·**자동 취소 구현**(`cancelPending()` — 마이크 누름 `onPress` 와 모든 턴 시작 `sendOutgoing`, 브라우저 18/18) → REV-194 PASS_WITH_NOTES(Low 2 = 소스 검사 시험이 주석 처리 코드를 통과시키는 약점 → TS 파서 기반 공용 도구 `src/components/__tests__/sourceCode.ts` 로 닫음, 변이 11건 사망).
- **QA-C2(화면 재검증) FAIL → Leader 재분류 PASS_WITH_NOTES**: 38/38·12/12(⑤A, 가짜 마이크+게이트웨이)·18/18(자동 취소)·상태/문구/저장소/엔진명 62 통과. 남은 FAIL 은 F-5 잔존 1건(Low): 칩이 **2행으로 줄바꿈될 때** 첫 행 칩의 실효 히트가 41.75px — 36px 칩 + 위·아래 각 4px 확장 = 44px 인데 행 간격(`gap-1.5`=6px)이 36+6=42px 피치라 확장 영역이 **2px 겹쳐 아래 칩이 받는** 기하 한계(REV-193 F-4 에서 이미 평가·수용: 손가락 접촉 오차 대비 무시 수준, 오터치 위험 아님). 행 간격을 8px 로 늘리면 해소되나 승인 데모의 레이아웃 변경(designer 사항)이라 하지 않는다. N-1(429 sr 줄이 서버 초에 고정)은 매초 낭독을 피하려는 의도된 설계. N-2(짧은 누름 뒤 RECOGNIZING 유지)는 가짜 게이트웨이가 `final` 을 안 보내서 생긴 **기존 STT 상태 기계의 동작**(`sttPhase==='finishing'`)이며 도우미와 무관 `[가능성 높음]`. N-3(입력 중 도우미 버튼 DOM 부재)은 §22-3/§22-6 설계대로.
- **다음**: QA-B2(자동 취소 뒤 턴 지연·콜드 504) 결과 → 통과 시 task-056 파일만 pathspec 커밋(사용자 지시 시) → 배포(사용자 승인) → 배포 직후 콜드 504·nginx 경유 abort 전파·실기기 확인 목록. 별건: task-058(#169·#178 취소 신호) 완료·미커밋, L2 중복 정의 통합은 task-056 커밋 뒤, 소스 검사 시험의 같은 약점이 의심되는 `scenario/__tests__` 5파일 정리는 후속.

## 커밋 (2026-10-12)
- 사용자 지시 「056 과 058 을 각각 별도 커밋」에 따라 로컬 커밋 **`facff39`**(task-056, 52파일: 통째 49 + 공유 파일 hunk 3 — `docs/screens.md` §22·도우미 줄, `api-contract.md` 제목·#180 행, 일일 로그 2줄). task-058 은 `30b8b4c` 로 별도. push 전 게이트(`git archive HEAD`) PASS(tsc 0·eslint src 오류 0·시험 3,274/3,274·build 0) 뒤 사용자 「push 하고 배포 + 운영 읽기 전용 스모크」 → push `10a4e88..6f8301c` → **운영 배포 완료: 릴리스 `20261012-003701-6f8301c0`**(`RELEASE_RESULT ok`·`migrated:false`·헬스 정상, 롤백 대상 `20261011-201916-1cf4d29d`). deployer 읽기 전용 확인 OK([[task-056-deploy-record]]). 남은 것: 콜드 스타트 504(운영 LLM 호출 필요 — 사용자 허락 시)·nginx 경유 abort 전파·**사용자 실기기(APK) 확인** 목록(ACTIVE `★★★★` 블록). 상태 `review` 는 사용자 실기기 확인 뒤 `done`.

## 최종 요약 (Leader, 2026-10-12)

**결과: 운영 배포 완료 + **사용자 검증 완료**(2026-10-12, 「이 세션의 회화개선작업은 검증되었으니 작업 마무리하고 팀 해제해줘」 — 세부 확인 항목은 말씀 없음, 이상 없다는 별도 언급도 없음).** 릴리스 `20261012-003701-6f8301c0`(커밋 `facff39`, task-058 `30b8b4c` 와 같은 push `10a4e88..6f8301c`, 사용자 「push 하고 배포 + 운영 읽기 전용 스모크」). 이후 task-061 이 버튼 위치만 우측 끝으로 옮겼다(릴리스 `20261012-130400-3c0427b8`).

**무엇이 생겼나 (사용자 관점)**
- 일반 회화방과 역할극 방의 입력 바에 **둥근 아이콘 버튼**(처음 한 번만 안내 말풍선). 말이 막힐 때 누르고 **한국어로 물어보면** 알맞은 **일본어 표현 1~3개**(일본어·한국어 뜻·상황 설명)를 받는다. 질의는 한국어 **글자 입력**으로 시작했다(한국어 음성은 새 STT 경로가 필요해 범위 밖).
- 결과는 **저장하지 않는다**(AI 는 제안만). API #180 `POST /api/v1/chats/:id/phrase-help`(`phraseHelp@v1`, fast=haiku 12초, 분당 10·하루 300, 사용자당 동시 1건 `PHRASE_BUSY`, 취소 시 409 `CANCELLED`).
- **사용자 결정 3개**: ① 글자 입력으로 시작 ② 마이크를 누르거나 회화 턴을 시작하면 **대기 중인 도우미 요청 자동 취소** ③ 선생님이 답을 만드는 동안(QUEUED·THINKING) 도우미 버튼 **잠금**. 근거(QA-B 실측): 도우미와 회화 턴이 같은 직렬 AI 호출 줄을 써서 도우미가 먼저 돌면 턴 첫 음성 p50 2.19→5.16s.

**검증**: 감사 서버 REV-190→192·화면 REV-191→193→194→195 모두 PASS_WITH_NOTES(Critical·High·Medium 0), QA A(서버 26/0/1)·B/B2(지연·경합·취소·장애 주입)·C/C2(화면 실측) PASS_WITH_NOTES. 푸시 전 게이트 tsc 0·eslint 0·시험 통과·`next build` 0. 운영 배포 뒤 deployer 읽기 전용 확인 OK([[task-056-deploy-record]]).

**알려진 한계(수용)**: 큐 대기 중 취소의 잠금 지연 · home-m4 폴백 호출은 취소 불가 · 취소 직후 0.6초 안 재호출은 `PHRASE_BUSY` · 칩 2행 줄바꿈 때 첫 행 실효 히트 41.75px · 상황이 삭제된 마친 방에서는 도우미 판이 조용히 닫힘. **미확인**: 운영 도우미 실호출 200·콜드 스타트 504(LLM 호출이 필요해 읽기 전용 범위 밖, 사용자 허락 시 QA 1건).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-11 17:03 |
| v1 | 검토요청 | docs/demo/task-056-talk-phrase-helper-v1.html | - | 사용자 검토 요청 | 10-11 17:34 |
| v1 | 승인 | docs/demo/task-056-talk-phrase-helper-v1.html | - | "4번만 'B안'으로 하고 나머지는 권고안대로 진행해줘" | 10-11 17:58 |
