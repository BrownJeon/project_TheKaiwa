---
task_id: task-077
title: "오늘의 회화 말하기(⑤) 개선 2건 — 「내가 한 말」 한글 번역 표기(IMP-0053) · 일본어 도우미 추가 + 하단 입력 영역 공통화(IMP-0054)"
status: doing
waiting: user
base_ref: 513f518
risk_level: "R1"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-056-improve-talk-phrase-helper, task-061-improve-helper-button-right-end, task-072-improve-word-add-helper, task-066-ask-chatbot-voice]
tags:
  - type/task
  - domain/lesson
  - domain/speech
  - domain/improvement
aliases:
  - 레슨 말하기 번역·도우미
  - task-077
created: 2026-10-18
updated: 2026-10-18
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-077-lesson-speak-helper-v1.html"
  artifact_url: "https://claude.ai/artifact/3atiN55EhtzWKyPuSwgfBw"
  content_sha256: "dae8cf1b61df36d9e81d5606d7bf2cebc44bfdf443fbdcae52892af69ee7c9e5"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-18T21:44:34+09:00"
  approval_quote: "A1~A5, B1~B8, B6-Q 권고대로 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-077 — 오늘의 회화 말하기(⑤) 「내가 한 말」 번역 + 일본어 도우미 + 입력 영역 공통화 (IMP-0053·0054)

## 사용자 요청 (원문)
(화면 캡처 첨부 — 오늘의 회화 5단계 「말하기」, `自己紹介をしましょう`) 「업로드한 화면에서 개선점 2개가 있어 1. 내가 한말에 대해서 한글로 번역한 것도 함께 표기해줘 2. 회화메뉴에 있는 일본어 도우미 기능을 추가해줘. 배치와 기능은 기존에 구현되어있는 회화화면의 배치로 동일하게 구현해줘. 가능하다면 기존에 있는 입력 영역을 공통화하여 재사용할 수도있도록 설계해서 구현해줘」(2026-10-18) → 접수 IMP-0053(번역)·IMP-0054(도우미+공통화), 같은 화면·같은 파일(`StageSpeak.tsx`)이라 **한 task·한 데모·한 릴리스**로 묶는다(구현은 서버 2갈래 → 공통화 리팩터 → 화면 순).

## judge 접수 (2026-10-18)
`feature` · 복잡도 2.11 · **R1** · developer **opus** · 트랙 **standard**(`too_many_paths`) · 데모 **delta**(`JV-ui_change`, `partial_restructure` 0.70) · roles designer·prompt-engineer?·developer·reviewer·qa · next `demo_first`. 결과 JSON `judge-result@2` (`judge-077-intake.result.json`, scratchpad).

## 관련 과거 이력 요약 (Leader 큐레이션)
- **회화방 일본어 도우미** [[task-056-improve-talk-phrase-helper]](IMP-0030): 한국어로 물으면 일본어 표현 1~3개(API #180 `POST /api/v1/chats/:id/phrase-help {queryKo}`, 저장 없음, 분당 10·하루 300·사용자당 동시 1건), 버튼 자리 [[task-061-improve-helper-button-right-end]](우측 끝 44px, ■ 와 자리 맞바꿈, 말풍선 `right-4`). 정본 `docs/screens.md` §22-2.
- **단어 추가 도우미** [[task-072-improve-word-add-helper]]: 서버는 `runPhraseHelp`·잠금 Set·엔진 태스크·한도 키를 #180 과 공유(합산), UI(패널·카드·훅)는 단어용으로 복제. #181 은 `mode:'word'`(사전형 표제어)라 문장 표현용으로 못 쓴다.
- **질문 탭이 `VoiceBar`+`Composer` 묶음을 한 훅(`useAskInput.tsx`)으로 재사용한 선례** [[task-066-ask-chatbot-voice]] — 공통화 본보기. 고정 마크업 시험 `voiceSharedFrozen.test.ts`(기본 마크업 21종) 때문에 **새 prop 없이 그린 결과는 한 글자도 달라지면 안 된다**.
- 번역 선례: 채팅 `userKo`(턴 호출에 칸 추가, 비용 0)·#32t `userTranslation`(별도 LLM 호출, 분당 20·동시 1건). 레슨 ⑤ 에는 공짜로 얻을 곳이 없다(#62b 는 LLM 없음, `text/annotate` 는 번역 안 함).
- 교훈(`/이슈기록 관련`): 승인된 교훈 없음. 내부 교훈: ① 공용 부품 변경은 전수 조사·고정 시험 ② 소스 스캔 시험은 동작 변이를 못 잡는다 — 규칙은 순수 함수 동작 시험으로, 화면 배선은 렌더/호출 시험 ③ 하드링크 미러는 node_modules 만 하드링크하고 소스는 실제 복사(ISS-0009) ④ 환경(QA 서버·쿠키)은 Leader 가 먼저 갖춘다.

## 현재 코드 사실 (Explore 조사 2026-10-18 — developer 가 착수 때 재확인)
- `components/lesson/StageSpeak.tsx`(438줄): «내가 한 말» 말풍선 270–281(`JaText`+`HangulLine`), «내 목소리» 282–299, «모범 답안» 312–320(`modelAnswerJa`·`modelKo`), 하단 입력 369–435(글자 모드 인라인 textarea·마이크 아이콘·보내기 / 음성 모드 상태 줄·`KeyboardIcon`·`PushToTalkButton`·정지). 발화 제출 `POST /api/v1/lessons/:id/speaking`(#62b, **LLM 없음**, 코드 판정 `checkSpeaking`, 응답 `modelAnswer.{ja,reading,ko}`). 후리가나·한글 발음은 `useAnnotations` → `POST /api/v1/text/annotate`(번역 칸 없음).
- 회화방: `talk/{VoiceBar,PhraseHelperButton,PhraseHelperPanel,PhraseHelperCard,PhraseHelperTip,usePhraseHelper,phraseHelperLogic,helperCopy}`, `chat/Composer`(`ComposerHandle.fill`). 도우미 훅·서버 `helpPhrase` 에 회화방 전용 가정(`chatId`·`ended`·`TALK` 검사·턴 상태 잠금·`HelperRoomKind 'talk'|'rp'`).
- 레슨과 회화방 하단 영역은 `PushToTalkButton`·`MicLevelMeter`·`SttAlert`·`useRealtimeStt`(레슨은 `useLessonVoice`) 만 공유하고 나머지(키보드·마이크 아이콘, 상태 줄 grid, textarea)는 레슨이 복제. `Composer` 와 레슨 textarea 의 동작이 다름: Enter(회화 모바일 = 줄바꿈 / 레슨 = Shift 없으면 전송), 초안(300ms 디바운스·`KEYS.draft(chatId)` / 즉시 sessionStorage), 높이 상한(136 / 150px).
- `LessonScreen.tsx:307` `Toast bottomPx={stage === 5 ? 136 : 24}` 하드코딩 — 도우미 판이 열리면 하단 높이가 늘어 토스트가 가려진다.
- 다음 계약 번호: 최대 #183 → **#184**(레슨 도우미 입구)·**#185**(말하기 번역).

## 열린 결정 — Leader ★ 권고 (사용자가 데모에서 승인/변경)

### A. 「내가 한 말」 번역 (IMP-0053)
- **A1 ★ 자동·비차단**: 「내가 한 말」이 화면에 뜨면 곧바로 번역을 요청하고 줄은 «번역 중…» → 결과로 바뀐다(말하기 흐름을 막지 않음). 대안: 눌러서 보기(「번역 ▾」 토글 — 호출 수 감소, 한 번 더 누름).
- **A2 ★ 일치하면 무료·다르면 AI 1회**: 내 말이 모범 답안과 같으면(`compareAnswer` same) 모범 답안의 한국어 뜻(`modelKo`)을 바로 보이고 AI 를 부르지 않는다. 다르면 별도 AI 번역 1회(`userTranslation` 프롬프트·엔진 태스크 재사용, 새 라우트 #185 `POST /api/v1/lessons/:id/speaking-translation` 가칭, **저장 안 함**). 대안: 일치할 때만(ⓑ — 비용 0, 대부분의 다른 말은 번역 없음).
- **A3 ★ 번역 표시 스위치와 무관하게 항상 보임**(⑤ 모범 답안 뜻이 이미 스위치와 무관). 대안: `showTranslation` 스위치를 따름(⑤ 에는 도구 줄이 없어 켜는 방법이 없음 → 비권장).
- **A4 인식이 뒤틀린 말(캡처의 `ハンコクの進んでいます…`)**: ★ 있는 그대로 번역 + 번역 줄 앞 작은 라벨 «번역». **불편한 사실**: 뒤틀린 문장의 번역은 이상한 한국어가 된다(LLM 은 들은 대로 옮김) — designer 가 «인식된 대로 번역했어요» 한 줄 힌트 유무를 대안으로 비교한다.
- **A5 한도·실패**: 사용자당 분당 20·동시 1건(#32t 와 같은 수준, 별도 한도 키 — 도우미와 서로 막지 않음). 실패·시간 초과·한도는 말하기 흐름을 막지 않고 번역 줄만 «번역을 불러오지 못했어요 · 다시»(작게)로 둔다. 글자 모드로 입력한 문장도 같은 규칙.

### B. 일본어 도우미 + 공통 입력 영역 (IMP-0054)
- **B1 ★ 회화방과 같은 배치·기능**(정본 §22-2): 음성 모드 = 입력 영역 우측 끝 44px 「가あ」 버튼, 도우미가 열리면 ■ 와 자리 맞바꿈 / 글자 모드 = 입력 줄 마이크 오른쪽 / 판은 입력 영역 위로 열림 / 카드 = 일본어 + 한글 발음 + 한국어 뜻 + ▶, **글자 모드에서만 [입력창에 넣기]**(채우기만, 자동 전송 없음).
- **B2 ★ 레슨 맥락을 프롬프트에 넣지 않음**(회화방과 동일 동작 — `prompts/phraseHelp.ts` 헤더에 맥락을 넣으면 품질이 떨어진 실측 기록). 대안: 과제·목표 표현을 맥락으로 전달(PE 점검 필요).
- **B3 ★ 한도·동시 1건 잠금을 #180/#181 과 합산**(키 공유 — 새 정책 없음, 비용 상한 유지). 대안: 레슨 전용 별도 한도.
- **B4 ★ 새 서버 입구 #184 `POST /api/v1/lessons/:id/phrase-help`**(소유자 검사·저장 없음·`helpWordPhrase` 가 `chatId=null` 로 `runPhraseHelp` 를 부르는 모양이 본보기, `helpLessonPhrase` 가칭).
- **B5 ★ 잠금**: 녹음 중·인식 중·제출 확인 중(`recording`·`finishing`·`checking`)에는 도우미 버튼 잠금(회화방의 턴 상태 잠금과 같은 취지, 레슨엔 턴이 없음).
- **B6 ★ 공통화 범위(가능한 선까지, 회귀 0 우선)**: 음성 모드 = `VoiceBar` 재사용(선택 prop 추가 — **기본 마크업 불변, `voiceSharedFrozen` 통과**) + 레슨용 `lessonVoiceView`(`TalkView` 유도), 글자 모드 = `Composer` 재사용 + 레슨의 **현재 입력 동작 보존 옵션**, 도우미 훅·패널을 요청 함수·잠금 규칙 주입형으로 일반화(`HelperRoomKind` 에 `'lesson'` 추가). 회화방·질문 탭·시나리오 동작은 바꾸지 않는다. **결정 필요 B6-Q(불편한 사실)**: 레슨 글자 입력의 Enter(★ 현재 동작 유지 = Shift 없으면 전송) vs 회화방과 통일(모바일 Enter = 줄바꿈) — 통일하면 모바일 레슨 입력의 Enter 동작이 바뀐다.
- **B7 ★ 처음 한 번 안내 말풍선**: 회화방과 같은 저장 키 공유(이미 본 사용자에게 다시 안 띄움). 대안: 레슨 전용 키.
- **B8 하단 높이**: `LessonScreen` 토스트 오프셋 136 하드코딩을 실제 하단 영역 높이에 맞춘다. 도우미 판이 열려도 과제 카드·내가 한 말·모범 답안이 가려지지 않게(판 최대 높이·본문 스크롤 규칙은 designer).

## Leader 사전 결정 (사용자가 바꾸라면 바꾼다)
- **L1 DB·스키마 변경 없음.** 번역·도우미 응답은 저장하지 않는다. 원음·전체 대화·Secret·질의 원문은 `RequestTrace`·로그에 남기지 않는다(기존 도우미 규칙 그대로).
- **L2 엔진 경계**: LLM 은 기존 어댑터·엔진 태스크(`userTranslation`·`phraseHelp`) 재사용, 엔진명·모델명은 화면·라우트·L1~L4 에 노출 금지. 새 엔진 태스크를 만들지 않는다.
- **L3 공통화는 회귀 0 이 우선**: 기본 마크업 불변(`voiceSharedFrozen.test.ts` 통과), 회화방·질문 탭·시나리오가 쓰는 `VoiceBar`·`Composer`·`usePhraseHelper` 의 기존 동작·문구·시험을 약화하지 않는다. 막히면 «기본 값이 현재와 같은 선택 prop» 으로만 확장한다.
- **L4 구현 순서**: ① 서버 두 갈래(#185 번역·#184 도우미 입구, 서로 파일이 겹치지 않게) → 서버 감사 → ② 공통 입력 영역 리팩터(회귀 시험 먼저) → 레슨 화면(번역 줄·도우미·하단) → 화면 감사 → judge C2 → QA(Leader 가 환경 먼저) → 사용자 배포 승인.
- **L5 prompt-engineer**: 번역은 기존 `userTranslation`(반말은 반말로 옮김) 재사용이라 프롬프트 변경 없음이 기본. 레슨 맥락을 넣거나(B2 대안) 번역 품질 문제가 보이면 그때 부른다.
- **L6 비목표**: 레슨 ①~④·결과 화면, 회화방 UI 변경, 모범 답안 표시 규칙 변경, 번역 저장·이력, 서버 STT 경로.

## 구현 계획 (데모 승인 뒤)
1. **designer(opus)**: delta 데모 `docs/demo/task-077-lesson-speak-helper-v1.html` — ⑤ 말하기 상태(내가 한 말 번역: 로딩·성공·일치 즉시·실패·뒤틀린 문장 / 도우미: 음성 모드·글자 모드의 버튼·말풍선(처음 한 번)·판(질문 칩·결과 카드·로딩·오류·한도)·[입력창에 넣기] / 도우미 열림 시 본문·토스트 높이), 현재 vs 제안, 360/390/412 × 글꼴 100/130% × 라이트/다크, 결정 A1~A5·B1~B8 의 ★ 와 대안, 구현 가이드 `docs/screens.md` 새 절(승인 전 초안).
2. **사용자 데모 승인** → 게이트 `activate`.
3. **developer(opus) 서버 2갈래**: (a) #185 번역(`lessons/:id/speaking-translation`, 라우트·서비스·한도·시험·변이) (b) #184 도우미 입구(`helpLessonPhrase`·라우트·한도 합산·시험·변이) + `api-contract.md`. 서버 감사(reviewer).
4. **developer(opus) 화면**: 공통 입력 영역 리팩터(`VoiceBar` 선택 prop·`Composer` 옵션·`usePhraseHelper`/패널 일반화·`lessonVoiceView`) → `StageSpeak`·`LessonScreen` 적용 → 시험·변이. 화면 감사(reviewer) → judge C2 → QA(HTTP·Chrome, 회화방·질문 탭 회귀 포함).
5. 사용자 배포 승인 → 푸시 전 게이트 → 배포 → 운영 스모크 → 폰 확인.

## 완료 기준
1. ⑤ 「내가 한 말」 아래에 한국어 번역이 보이고(A1~A5 승인안), 실패해도 말하기 흐름이 안 막힌다.
2. ⑤ 에서 회화방과 같은 배치·동작의 일본어 도우미가 동작한다(B1~B8 승인안). 입력 영역이 공통 컴포넌트/훅으로 재사용되고 회화방·질문 탭·시나리오 동작은 그대로다.
3. tsc 0 · eslint 0 · 전체 시험(고정 마크업 시험 포함) · build 0 · reviewer PASS · QA PASS(회귀 포함) · 사용자 폰 확인.

## 상태 로그
- 2026-10-18 사용자 요청(화면 캡처 + 개선 2건) → Explore 조사(읽기 전용, 레슨 ⑤·회화방 도우미·공통화 후보·번역 선례) → judge intake(feature·R1·standard·delta·opus) → IMP-0053·0054 접수(`planned`) → 이력서 작성(열린 결정 A1~A5·B1~B8, Leader 사전 결정 L1~L6). 다음: 게이트 init → designer 데모 v1.
- 2026-10-18 21:40 designer(opus) 데모 v1 `docs/demo/task-077-lesson-speak-helper-v1.html`(133,199B·1,149줄, sha256 앞 16자 `dae8cf1b61df36d9`, lint PASSED, **★ 자체 시험 2,268칸 실패 0**(27상태×3폭×글꼴 2×테마 2×현재/★+대안 10, 대비 17,904개 최저 4.80), 회화방 vs 레슨 제안 하단 바 구조 차이 0·문구/이름 차이만) · `docs/screens.md` §34 +155줄(그 밖 불변 — Leader 가 `git diff` 확인) · 기록 [[task-077-designer-record]]. Leader 가 데모 전체를 읽고 비공개 Artifact 게시(https://claude.ai/artifact/3atiN55EhtzWKyPuSwgfBw) → 게이트 `review_requested` v1. **designer 가 Leader ★ 와 다르게 그린 3곳**: ① A4 ★ = 회화방 내 말 번역 칸과 같은 모양(구분선+15px 뜻, 라벨 «번역» 없음 — 이력서 원안 라벨 모양은 대안 C) + 말로 한 답에만 힌트 「알아들은 말을 그대로 옮겼어요」 ② A5 문구 = 앱 기존 `DISPLAY_COPY.userTr`(「번역을 가져오지 못했어요 · 다시 가져오기」, 새 문구 0) ③ B8 규칙 추가 = 판을 열 때 과제 문장이 가려져 있으면 본문을 과제 카드 머리로 한 번 맞춤. **데모가 사용자에게 묻는 질문 5개**(A4 힌트 유무·A1/A2 자동 번역 비용·B6-Q 레슨 글자 Enter·B8 판 높이(본문이 780px 높이에서 226px로 줄어듦)·placeholder 줄바꿈(도우미가 들어가 입력창이 좁아져 360px 에서 두 줄 → 빈 입력창 48→70px)). 부수 발견(범위 밖, 미수정): 회화방 빈 입력창도 같은 계산으로 높아질 수 있음(실기기 확인 필요). 다음: 사용자 결정·승인 문장.
- 2026-10-18 21:44 **사용자 데모 승인** 「A1~A5, B1~B8, B6-Q 권고대로 승인」 → 게이트 `approve --version 1`(인용 기록)·`activate` → `DEMO_GATE_PASSED`(approved v1, hash verified). `docs/screens.md` §34 머리 「승인 데모 v1」. **확정 = 데모 ★ 전부**(A1 자동·비차단 / A2 일치하면 `modelKo` 즉시·다르면 AI 1회 / A3 스위치 무관 / **A4 ★ = 회화방 내 말 번역 칸과 같은 모양(구분선·15px·라벨 없음) + 말로 한 답을 AI 가 옮겼을 때만 힌트 「알아들은 말을 그대로 옮겼어요」(designer 제안)** / **A5 ★ = 칸 안 한 줄 + [다시 가져오기], 문구는 `DISPLAY_COPY.userTr` 재사용(designer 제안)** / B1 회화방 §22-2 그대로 / B2 레슨 맥락 안 넣음 / B3 #180·#181 과 한도·잠금 합산 / B4 #184 / B5 녹음·인식·확인 중 잠금 / B6 공용 부품 재사용 + 선택 prop(기본값 = 지금) / **B6-Q 레슨 글자 Enter = 지금 그대로(Shift 없이 Enter 확인)** / B7 회화방과 같은 안내 저장 키 / **B8 ★ = 토스트 바닥 = 하단 묶음 실제 높이 + 12px · 판 최대 높이 회화방과 같음 · 판을 열 때 과제 문장이 가려져 있으면 과제 카드 머리로 한 번 맞춤(designer 제안)**). **질문 5(placeholder)는 사용자 답이 없어 데모가 그린 ★ = 레슨 placeholder 「일본어로 써서 답해 보세요」 지금 문구 그대로**(360px 에서 두 줄이 되어 빈 입력창이 커질 수 있음 → 폰 확인 항목, 「일본어로 답해 보세요」 한 줄 단축은 상수 한 줄로 가능). **Leader 구현 결정**: ① 분배 — 서버 A(#185 번역)·서버 B(#184 도우미 입구)·UI-1(공용 입력 영역 리팩터: `VoiceBar`·`Composer`·`usePhraseHelper`·패널·카드 일반화) **3갈래 병행**(파일 겹침 없음, 공유 파일 `modules/conversation/index.ts`·`api-contract.md`·`types/*` 는 각자 자기 줄만 편집하고 Edit 가 실패하면 다시 읽고 재시도) → 이어서 UI-2(레슨 배선: `StageSpeak`·`useLessonVoice`·`lessonVoiceView`·`LessonScreen` 토스트·번역 훅·`lessonCopy`) → 감사(서버·화면) → judge C2 → QA. ② 번역 라우트 #185 `POST /api/v1/lessons/:id/speaking-translation {text}` → `{ko}`(저장 안 함, 소유자 검사, 분당 20·동시 1건·**도우미와 별도 한도 키·잠금**, `userTranslation` 프롬프트·엔진 태스크 재사용). ③ 도우미 #184 `POST /api/v1/lessons/:id/phrase-help {queryKo}` → #180 과 같은 응답(`{items}`), `runPhraseHelp` 재사용(`chatId=null`, 장면 없음, 레슨 맥락 안 넣음), 한도 키·동시 1건 잠금은 #180/#181 과 공유. ④ 모범 답안과 같게 말했는지 판정은 클라이언트 `compareAnswer`(④ 응용과 같은 함수)로, 같으면 AI 를 부르지 않는다.
- 2026-10-18 23:10 developer 서버 B(#184 `POST /api/v1/lessons/:id/phrase-help`) 구현 완료 — `helpLessonPhrase`(장면 없는 회화방과 같은 요청·응답, 레슨 맥락 없음, 수준 = 프로필) + 라우트(소유 확인 `assertOwnedLesson`, 상태 무관) · 한도·잠금 #180·#181 합산 · 새 시험 30개 · 변이 19/19 · tsc 0·eslint 0·전체 시험 fail 0(4426)·build 0(미러, 내 파일만) · api-contract #184 행·§2-13 절. «Leader 확인(선택)»: 수준을 레슨 수준으로 바꿀지. 기록 [[task-077-dev-server-b-record]].
- 2026-10-18 22:03 developer 서버 A(#185 `POST /api/v1/lessons/:id/speaking-translation {text}`→`{ko}`, 저장 없음·분당 20·동시 1건 전용 키/잠금·`userTranslation@v1` 재사용) 구현 완료 — 새 시험 29·변이 25/25 포착·전체 4,425 실패 0·tsc/eslint/next build 0, ⚠ screens §34-7 의 `{itemId,text}`·`translation` 은 계약 `{text}`·`{ko}` 와 다름(Leader 확인) → [[task-077-dev-server-a-record]]
- 2026-10-18 22:17 reviewer 서버 감사 REV-077S(#185 번역 · #184 도우미) **PASS_WITH_NOTES** — Critical/High/Medium 0 · Low 2(#185 「쓰기 없음」 소스 시험 없음 — 변이 13개 중 숨은 쓰기 2개 생존 · #184 수준 = 프로필은 Leader 결정) · Info 4. 합쳐진 상태 재실행 tsc 0·eslint 0·전체 시험 4455(실패 0, skipped 5)·`next build` 0. UI-2 주의·QA high_risk_areas 는 기록 끝 → [[task-077-reviewer-server-record]]
- 2026-10-18 22:55 developer UI-1(공용 입력 영역 일반화) 완료 — `VoiceBar`(`stopLabel`·`statusId`)·`Composer`(`draftKey`·`enterSends`·`sendLabel`)·`usePhraseHelper`(`request` 주입·`ended`/`onEnded` 선택)·`helperCopy`(`'lesson'`·`lockedCheck`)·`phraseHelperLogic`(`lessonHelperLockReason`) 선택 prop·주입(기본값 = 지금, 호출부 0줄), 기본 마크업 93종 HEAD 와 동일·영향 464/464·전체 4423(fail 0)·build 0·변이 22/22 · **Leader 확인 필요: `voiceSharedFrozen` 4번째 시험이 StageSpeak 의 `keyboardLabel` 을 금지 → UI-2 착수 전 결정**(권고 b) · 기록 [[task-077-dev-ui1-record]].
- 2026-10-18 22:50~23:40 **구현 1단계 완료**: 서버 A(#185 번역, 변이 25/25)·서버 B(#184 도우미, 변이 19/19, 수준 = 프로필)·UI-1(공용 부품: `VoiceBar` `stopLabel`·`statusId` / `Composer` `draftKey`·`enterSends`·`sendLabel` / `usePhraseHelper` `request` 주입·`ended` 선택 / `'lesson'` 문구·`lockedCheck` / `lessonHelperLockReason`, **호출부 0줄 수정**, 기본 마크업·로직 93종 변경 전과 바이트 동일, 영향 시험 464/464, 변이 22/22, 전체 시험 실패 0). 서버 A·B 개발자는 80턴 한도로 멈췄다가 스스로 재개해 끝냄(그 사이 Leader 가 보낸 마무리용 개발자는 중복이라 즉시 중단 — 중복 편집 없음 확인). **서버 감사 REV-077S PASS_WITH_NOTES**(Critical·High·Medium 0·Low 2·Info 4): 서버 A+B 합쳐진 상태 첫 재실행 tsc 0·eslint 0·전체 시험 4,455 중 4,450 통과·실패 0·build 0, 변이 13개 중 11 포착, 생존 2 = **Low-1 #185 「저장 없음」 소스 시험 없음**(`void prisma.lesson.updateMany().catch()` 를 못 잡음, 코드는 현재 쓰기 없음) → 시험 보강 착수. Low-2 #184 수준 = 프로필(레슨 수준 아님) → **Leader 판정: 현행 유지**(회화방 도우미와 같은 동작·승인 B2 와 일치, 폰 확인 항목 + 최종 요약 한계로 보고). 기록 [[task-077-dev-server-a-record]]·[[task-077-dev-server-b-record]]·[[task-077-dev-ui1-record]]·[[task-077-reviewer-server-record]]. **Leader 판정(UI-1 막힘)**: `voiceSharedFrozen.test.ts` 4번째 시험(질문 탭 전용 prop 을 회화·수업 화면이 안 넘김)이 `lesson/StageSpeak.tsx`·`useLessonVoice.ts` 의 `keyboardLabel` 을 막음 → 승인 B6 A(레슨이 공용 `VoiceBar` 를 씀)와 충돌하므로 **옵션 (b) 승인**: 금지 목록에서 `keyboardLabel` 만 레슨 두 파일에 한해 허용(21종 고정 마크업 시험·픽스처·다른 금지어는 수정 금지, UI-2 가 수행·기록). 문서 정정: `docs/screens.md` §34-3 #185 행 `{text}`→`{ko}`(`itemId` 는 400). **UI-2(레슨 배선·번역 줄·도우미) 착수**(미러 `thekaiwa-dev077u2`).
- 2026-10-18 22:46 developer UI-2(레슨 ⑤ 배선) 완료 — 하단 = 공용 `VoiceBar`(`lessonVoiceView`)·`Composer`(레슨 초안 키·Enter 확인) · 도우미 #184(잠금 `lessonHelperLockReason`·결과 오면 판 닫힘) · 「내가 한 말」 뜻 #185(같으면 `modelKo`·다르면 AI·자동·끊기·12초·메모리) · 토스트 = 하단 높이+12 · `voiceSharedFrozen` 좁은 예외(레슨 두 파일 `keyboardLabel`만) · 공용 부품 코드 변경 0 · 새 시험 34·영향 629→663(fail 0)·전체 4516(fail 0)·build 0·변이 30/30 · Leader 확인(선택) 2건 · 기록 [[task-077-dev-ui2-record]].
- 2026-10-18 reviewer 화면 감사 REV-077U(UI-1 공용 부품 + UI-2 레슨 ⑤) **PASS_WITH_NOTES** — Critical·High·Medium 0 · Low 3(시험 구멍 2 = 안내 describedby 가드·카드 맞춤 배선 / 다시 보기 탭 연타 시 abort 직후 재요청 BUSY 틈 / 일본어 글자 없는 답도 #185 호출) · Info 9. 합쳐진 전체 상태 첫 재실행 tsc 0·eslint 0·전체 시험 4522(실패 0, skipped 5)·`next build` 0, 변이 18 중 16 포착, 변경 전 트리 차등 렌더 23,328조합 바이트 동일, 데모 게이트 PASSED. 기록 [[task-077-reviewer-ui-record]]
- 2026-10-19 00:10 **화면 감사 REV-077U PASS_WITH_NOTES**(Critical·High·Medium 0·Low 3·Info 9): 서버 A+B+UI-1+UI-2 합쳐진 전체 상태 첫 재실행 tsc 0·eslint 0·전체 시험 4,522 중 4,517 통과·실패 0·build 0, **회귀 검증 — 변경 전(HEAD)과 같은 렌더 하네스로 공용 말 바 23,040조합·입력창 288조합 = 23,328조합 전부 바이트 동일**, 호출부 수정 0, `voiceSharedFrozen` 수정은 8줄(레슨 두 파일 `keyboardLabel` 하나만, 21종 고정 마크업·픽스처 불변), 변이 18개 중 16 포착. Low-1(시험 구멍 M11·M13) → 시험 보강으로 닫음(변이 6/6 포착, 레슨 시험 94/94). Low-2(번역 요청 연속 전환 시 드문 409 바쁨)·Low-3(일본어 글자 없는 답도 #185 호출) → **승인 범위 내 한계·후속 제안**. 기록 [[task-077-reviewer-ui-record]]. judge C2 `codex_required:false`(`CX-limit-unknown-hold`, `wanted_before_budget:false`). 서버 Low-1(#185 「저장 없음」 소스 시험 없음)도 보강 완료(변이 6/6, 서버 A 시험 35/35). `docs/screens.md` §12-2 J·§22·§26·§34-13 구현 후 정정 완료(designer, +225/−15 18곳).
- 2026-10-19 01:30 **QA 3갈래 PASS(결함 0)** (QA 서버 127.0.0.1:3011 APP_ENV=LOCAL, 최종 코드 빌드, QA1·QA2·QA4, 원상 복구 확인): **QA-HTTP-3** [[task-077-qa-http3-record]] — 번역 4건 한국어 PASS(반말은 반말, 2.4~5.5초)·입력 검증 400 16종·401/404·1,000자 경계·#185 한도 20/분(동시 25건 → 200×1·409×19·429×5, `Retry-After: 60`)·취소 후 1초 안 잠금 해제·**#184 도우미 한도 합산**(#180+#184 분당 10, 잠금 양방향 409 `PHRASE_BUSY`, 이때 #185 는 영향 없음)·도우미 봉투 #180 과 동일·끝난 레슨 200·로그 원문 0 / **QA-Chrome-3(레슨 ⑤)** [[task-077-qa-chrome3-record]] — 음성 모드 하단 바 치수가 회화방과 동일(360/390/412 모두 117px, 「가あ」 44 우측 끝), 도우미 실제 #184 3.5~4.2초, 글자 모드 Enter 확인·Shift+Enter 줄바꿈·초안 복원, 번역(같으면 요청 0·다르면 `{text}` 만·캐시·연속 제출 abort·모의 500/504/끊김/502/429/409/400/404 설계대로·[다시 가져오기] 87×44), 판 열림·토스트 바닥 11.6~12.4px, 확인 중 잠금·실패 시 입력 복원, 폭 3×글꼴 2×다크 넘침·잘림 0 / **QA-Chrome-4(회귀)** [[task-077-qa-chrome4-record]] — 회화방(12조합 하단 바·Enter 모바일 줄바꿈/데스크톱 전송·초안·도우미 전체 흐름·회화방용 문구·내 말 번역 토글)·질문 탭(말 바 여백 8px·⌨ 「글자로 묻기」)·역할극(역할극 도우미 문구·마친 방 409 `ENDED` 띠)·단어 도우미(#181, 채우기만) 회귀 0, 레슨 전용 문구 새어 나옴 0. **관찰**: ① O-1 LLM 호출이 한 줄로 서서 번역이 16.4초 걸린 적(레슨 완료 직후 복습 판단 sonnet 16초 뒤에 줄 섬 — 서버 처리는 2.2초, 화면이 12초에 끊고 [다시 가져오기], 잠금은 1초 안에 풀림) ② 한국어만 친 답은 502 반복(후속) ③ 360px·100% 에서 placeholder 두 줄 → 빈 입력창 68px(질문 5, 390·412 는 한 줄) ④ 기존·무관: 예시 칩 36px·표시 칩 32px·역할극 「마치기」 36px 등 44px 미만, 도우미 칩을 눌러 결과가 나오면 초점이 body 로 가서 Esc 가 안 닫힘(`PhraseHelperPanel`, 이번 변경 밖). 스크린샷은 Leader 가 대표 3장 직접 확인(번역 줄 모양·판 열림 130%·글자 모드 360px 빈 입력창 두 줄). QA 서버 종료·`.env`·쿠키 삭제, 3011 리스너 0.
- 2026-10-19 01:40 사용자 결정(AskUserQuestion): **placeholder = 「한 줄로 줄이기」**(레슨 `U5.inputPlaceholder` → 「일본어로 답해 보세요」, screens.md 해당 줄·§34-13 반영) · **배포 = 「지금 커밋·푸시·배포」**.
- 2026-10-18(저녁→밤) **운영 배포 완료** — 코드 커밋 `b846e33`(31파일, 077 파일만 명시 경로)·문서 커밋 `e4513bb` → 푸시 전 게이트(HEAD 아카이브 → 미러 prisma generate·tsc 0·eslint 0·전체 시험 실패 0·build 0, `gate_head=` 새 SHA 확인) → `git push` `912363a..e4513bb` → 웹훅 `RELEASE_RESULT ok` 릴리스 **`20261018-235247-e4513bb3`**(직전 `20261018-201112-912363ac` = 롤백 대상, `migrated` false, DB 변경 없음; 배포 스크립트가 오래된 릴리스 `20261017-214103-b9ce1546` 정리). 배포 후 확인: `current` 심볼릭 = 새 릴리스 · `/api/health` PRODUCTION ok 11/11 · pm2 3개 online(재시작 0) · 번들 문자열(뜻 힌트 10개 파일·새 placeholder 10·구 placeholder 0·`locked_check` 3·엔진명 0) · `/login` 200. **운영 API 스모크**(QA4 의 끝난 레슨 `cmvdwjd6…`, 임시 쿠키는 즉시 삭제): 쿠키 없음 401 · `itemId` 포함 본문 400 `VALIDATION unknown_key` · 없는 레슨 404 · #185 `{text:"私は学生です。"}` 200 `{"ko":"나는 학생입니다."}` 2.2초 · #184 `{queryKo:"주말에 친구를 만났어요"}` 200 `items` 2개(週末に友達に会いました。/週末に友達と会いました。) 7.0초. **운영 화면 스모크**(읽기 전용 — 모든 POST 를 `page.route` 로 차단, 운영 데이터 생성 0): 360px·⑤ 말하기 화면 렌더, 「일본어 도우미」 44×44·판 열림·예시 칩 3개·가로 넘침 0·엔진명 0·외부 요청 0, 차단한 쓰기 = 출석 체크·`speaking-translation`·`text/annotate`(차단 때문에 번역 줄이 「번역을 가져오지 못했어요 · 다시 가져오기」로 보이는 것은 의도된 하네스 효과이고 결함 아님), XSS 문자열 답(QA4 데이터 `<img onerror>`)은 글자로 이스케이프되어 표시. 임시 운영 쿠키 삭제 확인.
- 2026-10-18 **다음: 사용자 폰 확인(아래 9개) → 이상 없음이면 IMP-0053·0054 `done`·이 task `status: done`.** 도우미 수준(프로필)·한국어만 친 글자 답의 번역 실패 줄은 알려진 한계로 보고(후속 후보).

## 최종 요약 (사용자용 — 운영 배포 완료, 폰 확인 대기)
- **바뀐 것**: ① 오늘의 회화 5단계 「말하기」에서 **「내가 한 말」 아래에 한국어 뜻**이 보입니다(말풍선 안 한글 발음 줄 아래). 모범 답안과 똑같이 말하면 AI 를 부르지 않고 모범 답안의 뜻을 바로 보이고, 다르면 AI 가 한 번 번역합니다(저장 안 함, 실패해도 말하기는 그대로 — 「번역을 가져오지 못했어요 · 다시 가져오기」). ② 말하기 단계에 **회화방과 같은 일본어 도우미**(「가あ」 — 한국어로 물으면 일본어 표현 1~3개, 글자 모드에서만 [입력창에 넣기])가 생겼습니다. ③ 하단 입력 영역(말 바·글자 입력·도우미)을 회화방과 **같은 부품**으로 바꿔 재사용합니다 — 회화방·질문 탭·시나리오는 한 글자도 바뀌지 않았음을 23,328가지 조합으로 확인했습니다. DB 변경 없음, 새 API 2개(#184 도우미·#185 번역).
- **알아 두실 동작**: 도우미의 한도(분당 10·하루 300)와 동시 1건 잠금은 회화방·단어 추가 도우미와 **합산**됩니다(번역은 별도 한도). 도우미가 알려 주는 표현의 수준은 **레슨 수준이 아니라 내 프로필 수준**입니다(회화방 도우미와 같은 동작). 글자 입력창은 이전처럼 Enter 로 확인하고 빈 칸 확인은 아무 일도 하지 않습니다(이전엔 토스트). ■ 정지 아이콘이 공용 바가 그리는 모양이라 안의 네모가 조금 작아졌습니다.
- **한계(불편한 사실)**: ① 인식이 뒤틀린 말은 번역도 이상한 한국어가 되고, 말로 한 답을 AI 가 옮겼을 때 「알아들은 말을 그대로 옮겼어요」 힌트가 붙습니다(음성 경로는 헤드리스에서 못 봐서 폰 확인). ② AI 호출이 한 줄로 서서 레슨을 끝낸 직후에는 번역이 10초 넘게 걸릴 수 있습니다(화면이 12초에 끊고 다시 가져오기). ③ 한국어로만 친 글자 답은 번역이 실패 줄로 보입니다(후속 후보). ④ 입력창 안내 문구는 사용자 결정으로 「일본어로 답해 보세요」 한 줄로 줄였습니다(360px 에서도 두 줄이 되지 않게 한 조치 — 폰에서 빈 입력창 높이를 확인해 주세요).
- **검증**: 서버·화면 독립 감사 PASS_WITH_NOTES(막는 결함 0, 시험 구멍은 보강), 전체 시험 4,522 중 실패 0·build 0, QA 실서버 3갈래 PASS(번역·도우미 API, 레슨 ⑤ 화면, 회화방·질문 탭·역할극·단어 도우미 회귀), 스크린샷 직접 확인. Codex 외부 검토는 한도 미확인으로 보류(judge).
- **폰에서 확인해 주세요**: ① 말하기에서 말한 뒤 「내가 한 말」 아래 뜻 줄·(말로 한 답) 힌트 ② 「가あ」 도우미 열기·질문·결과 카드·▶ (말 모드에는 [입력창에 넣기] 없음, 글자 모드에서만) ③ 녹음·인식 중 도우미 버튼이 잠기고 눌렀을 때 토스트 ④ 도우미 판이 열린 채 결과가 오면 판이 닫히는지 ⑤ 글자 입력 Enter 확인·Shift+Enter 줄바꿈·초안 ⑥ 360px 글꼴 크게(130%)에서 하단 영역·판 높이·토스트 위치 ⑦ 소프트 키보드가 올라온 상태에서 도우미 판 ⑧ 회화방·질문 탭 입력 영역이 이전과 같은지 ⑨ TalkBack(번역 줄·도우미 버튼 낭독).
- **배포·롤백**: 운영 릴리스 `20261018-235247-e4513bb3`(커밋 `b846e33` 코드 + `e4513bb` 문서, DB 변경 없음). 문제가 있으면 직전 릴리스 `20261018-201112-912363ac`(076)로 `scripts/deploy.sh TheKaiwa --rollback`(DB 변경이 없어 안전).
- **운영 확인 결과**: 헬스 11/11 ok·pm2 3개 online(재시작 0)·번들 확인·운영 API 스모크(번역 2.2초 · 도우미 7.0초)·읽기 전용 화면 스모크 모두 정상. 폰 확인 때 번역이 처음엔 몇 초 걸릴 수 있습니다(AI 호출이 한 줄로 서는 경우 10초 넘으면 「다시 가져오기」).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-18 20:57 |
| v1 | 검토요청 | docs/demo/task-077-lesson-speak-helper-v1.html | https://claude.ai/artifact/3atiN55EhtzWKyPuSwgfBw | 사용자 검토 요청 | 10-18 21:28 |
| v1 | 승인 | docs/demo/task-077-lesson-speak-helper-v1.html | https://claude.ai/artifact/3atiN55EhtzWKyPuSwgfBw | "A1~A5, B1~B8, B6-Q 권고대로 승인" | 10-18 21:44 |
