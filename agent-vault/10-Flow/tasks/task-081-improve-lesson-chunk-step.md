---
task_id: task-081
title: "오늘의 회화 개편 — «문제» 단계 제거·«조각» 단계 신설(IMP-0059) + 응용 마이크 기본·한글 번역"
status: done
waiting: ""
base_ref: 5af8e7d
risk_level: "R1"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-010-today-lesson, task-077-improve-lesson-speak-translation-helper, task-080-plan-growth-analysis, task-044-today-integration]
tags:
  - type/task
  - domain/learning
  - domain/lesson
  - domain/improvement
aliases:
  - 오늘의 회화 조각 단계
  - task-081
created: 2026-10-21
updated: 2026-10-21
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-081-lesson-chunk-step-v1.html"
  artifact_url: "https://claude.ai/artifact/NuAgnjnKLmYYgZ8gAZAR6h"
  content_sha256: "21ebca22782b50ee4fb46e716d23689bb21d6899fd811f397f8e8aff30e63d7a"
  decided_by: "judge"
  rule_id: "DM-kw-full"
  approved_by: "user"
  approved_at: "2026-10-21T14:01:33+09:00"
  approval_quote: "권고대로 승인, Q9는 A로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-081 — 오늘의 회화 «조각» 단계 신설·«문제» 단계 제거 (IMP-0059)

## 사용자 요청 (원문)

> 커밋하고 푸시해주고 IMP-0059 작업 진행해줘 (2026-10-21)

IMP-0059 원문(접수 2026-10-20·보완 2026-10-21, `agent-vault/10-Flow/improvements/items/IMP-0059-lesson-quiz-removal-chunk-step.md`):
> '오늘의 회화'에서 5가지 진행되는 항목 중에서 문제항목을 제거해주고 '조각'이라는 항목을 신규로 만들어서 앞에서의 회화내용의 문장들을 조각으로 나누어서 끊어볼수있는 형태로 구현해줘.
> 보완 1. 응용 항목에서 입력은 기본적으로 마이크로 말하는 방식을 기본으로 설정해주고 말한 내역에 대하여 한글번역도 함께 표기해줘
> 보완 2. 추가되는 '조각' 항목에 대하여 기존 조각공부법에 대한 강의영상과 요약내용을 …(TheThinker 레퍼런스)… 저장해놨으니 분석해서 설계에 참고해줘 → 분석은 IMP-0059 «설계 참고» 절(조각공부법: 이름·액션·느낌·꾸임 조각 + 연결 조각(조사), 슬래시 끊어 읽기·밑줄 라벨·조각 모으기·교체·확장).

## 확정 결정 (사용자 AskUserQuestion 2026-10-21 — 네 질문 모두 권고대로)

| # | 질문 | 답 |
|---|---|---|
| 1 | «조각» 단계 위치 | **문제 자리(3번째)에 대체** — 이해 → 문법 → **조각** → 응용 → 말하기. 단계 번호가 그대로라 진행 중인 기존 레슨의 `stageDone` 이 안 깨짐 |
| 2 | 문제 제거 뒤 문형·조사 기록·오답 기반 복습 입력 공백 | **완전 제거, 공백 감수** — 화면·생성·점수 표기를 모두 제거. 응용 단계 결과를 관측으로 보충하는 것은 후속 |
| 3 | 조사를 «연결 조각» 으로 포함 | **포함** — 이름·액션·느낌·꾸임(앱에 이미 4종) + 연결 조각(새 값, 레슨 내용 JSON 안에서만 — DB 구조 변경 없음) |
| 4 | 문장 분해 시점 | **수업을 만들 때 함께 저장** — 열 때 대기 없음, 검증은 «조각을 이어 붙이면 원문과 같아야 한다» 결정적 규칙. 기존 레슨은 조각 단계가 비어 보임 |

## 코드 재확인 (Leader — 읽기 전용 탐색 + DB 집계, 2026-10-21)

- **5단계 정의**: `lessonCopy.ts:8 STAGE_NAMES`·`stageDone` 0~5(`validate.ts:12 LESSON_STAGE_MAX`)·완료 가능 `stageDone ≥ 4`(`lifecycle.ts:27`)·`LessonScreen.tsx` 단계별 분기(1 이해·2 문법·3 `StageQuiz`·4 응용·5 말하기). 생성 JSON(`schemas.ts:496 LESSON_SCHEMA`·`lesson.ts`, 버전 `lesson@v9`): `dialogue[]`(6~10줄 `{speaker, ja, reading, ko}` + 저장 시 `segment`)·`chunks[]`(4~8개 «오늘의 표현» — 문장 분해 아님)·`quiz` 5·`application` 3·`speaking` 3. **REVIEW 레슨(`reviewMix`)도 같은 스키마·5단계**.
- **«문제» 제거가 닿는 곳**: `Lesson.score`(quiz 점수 — 오늘 카드 «문제 c/5»·ASK «점수 N점»·`StudyLog` 요약·`StatsSnapshot(LESSON)` `quizCorrect/Total/score`·챌린지 화면 «문제 n/5»)·`LearningObservation`(코드 전체에서 `GRAMMAR_USE` 를 만드는 곳이 문제 단계뿐 — 성장 탭 문형·조사 수업 입력이 사라짐)·`RepetitionItem` 정오답(`wrongCount` → A11 복습 후보·평가 생성 «오답 N회»)·완료 조건 `stageDone ≥ 4`·`readStoredContent` 가 `quiz` 없으면 null(손상 취급 — 완화 필요)·문제 전용 부속 코드(`quizPromptView`·`quizReadingLeak`·`checks.ts`·`repair.ts`)·종료 카드 «문제 정답»·생성 대기 표·복습 문구. **챌린지 «오늘의 회화 완료» 판정은 `StatsSnapshot(LESSON)` 존재 여부라 quiz 와 무관**(영향은 표시에 한정).
- **응용 현재 입력**: 기본 글자 입력, «말로 쓰기» 토글(`useLessonVoice` `MIC_TEST`+`PushToTalkButton`, `VoiceBar`·`Composer` 미사용). 말하기(⑤)는 `VoiceBar`·`Composer`·도우미·`useSpeakTranslation`(#185). 재사용: #185 는 `{text}` 만 받고 레슨 소유만 확인(모범 답안과 같으면 `modelKo` 즉시 사용·AI 호출 없음). 걸리는 점: 다시 열면 `via`(voice/text) 정보 없음·`textFirst` 폴백(서버 인식 꺼짐·브라우저 막힘)이 응용엔 없음·`lessonToastBottom` 이 `stage !== 5` 를 말하기로 하드코딩·`voiceSharedFrozen` 시험이 `StageSpeak.tsx`·`useLessonVoice.ts` 만 허용·#185 한도 사용자당 동시 1건·분당 20.
- **이해 단계·조각 재료**: 문장 데이터에 **조각·끊어읽기 정보 없음**. 재사용: `JaText` `ranges`(응용 비교의 글자 구간 밑줄)·`POST /api/v1/text/annotate`(#24r — `{surface, ruby, pron, boundary 'phrase'|'particle'}`, 품사·조각 유형 없음)·`ChunkType` 라벨(`lessonCopy.ts:13-14`). Prisma `ChunkType` 5종(EXPRESSION 포함)·레슨·LLM 스키마는 4종. **조각 단위 재생은 지금 불가** — `audioText`(`content.ts parseAudioBody`) 가 줄 번호만 받음(임의 문장 합성 방지) → 새 kind 필요.
- **DB**: `Lesson.content`·`Lesson.progress` 가 Json → 조각 분해·진행은 **스키마 변경 없이** 가능(`progress.ts:117 onlyKeys` 허용 목록에 새 키·8KB 상한). `Lesson.promptVersion` VarChar(20)(`lesson@v10` 가능).
- **«5» 하드코딩**: 서버 `validate.ts`·`lifecycle.ts`·프롬프트 `lesson.ts`·`reviewMix.ts`·화면 `LessonScreen`·`logic.ts`·`parts.tsx`(`grid-cols-5`)·`TodayLessonCard`·문구(`lessonCopy`·`topicCopy`·`reviewCopy`·`challengeCopy`)·설계서(`screens.md` §2·§12, `api-contract.md` #58~#62)·시험·프롬프트 골든(`tests/prompts/fixtures/{lesson,lesson-general-golden,review-mix}.json`).
- **기존 레슨(DB 집계)**: 13건 — READY 5(`stageDone` 0)·IN_PROGRESS 1(`stageDone` 4)·DONE 7 → 단계 3번 대체라 번호 보정 불필요, 옛 레슨은 조각 데이터가 없어 «조각 단계 비어 보임» 화면이 필요. 프롬프트 버전 `lesson@v7` 2·`lesson@v9` 8·`lessonScenario@v1` 1·`reviewMix@v3` 2.
- **위험**: LLM 출력 증가(문장당 조각 분해)로 120초 잡 예산·재시도·`checks.ts`/`repair.ts` 전체 영향·프롬프트 골든 재측정·REVIEW 레슨 동시 변경 / 관측·성장 공백(`GRAMMAR_PARTICLE`·`VOCAB_RECALL` 수업 입력 소멸 → 한쪽 증거 증가) / 복습·평가 오답 순환 약화.

## judge 접수 (2026-10-21)

- 첫 입력 요약(159자)은 `needs_info`·demo `delta`(낮은 확신)로 나옴 → UI 가 **새 화면 신설 + 기존 화면 제거**임을 명시한 요약(147자)으로 재실행 — 결과 `judge-result@2`(스크래치 `judge-081-intake-r2.result.json`): **feature · standard · R1 · 복잡도 2.05 · developer=opus · roles designer+prompt-engineer(조건부)+developer+reviewer+qa · demo `full`(DM-low-confidence·DM-kw-full) · next=`demo_first`**. 사용자 승인 전에는 화면 코드를 쓰지 않는다.

## Leader 기본 결정 (사용자가 뒤집을 수 있음 — 데모 «결정 필요» 패널에 올림)

- **REVIEW 레슨(`reviewMix`)·상황 레슨(`lessonScenario`)도 같은 단계 구조**로 맞춘다(같은 스키마·같은 화면 — 한쪽만 바꾸면 분기 폭증).
- **기존 레슨**(조각 데이터 없음)은 «이 수업은 조각 나누기가 없어요» 빈 상태 + [다음 단계] — 단계 번호·완료 조건 `stageDone ≥ 4` 는 유지.
- **조각 재생**(조각 탭 → 그 조각만 읽어 주기)은 이번 범위에 **포함**(사용자가 «끊어볼 수 있는 형태» 를 원함, IMP-0012 구간 재생 선례) — 새 audio kind·`parseAudioBody` 허용·TTS 호출 경로 검토는 developer/reviewer 몫.
- **응용 마이크 기본**: 마이크로 말하기가 기본, 글자 입력은 보조(마이크 불가·서버 인식 꺼짐이면 글자 우선 폴백). 말한 내용 한글 번역은 말하기(⑤)의 #185 재사용.
- 조각 → 단어장/반복 항목 채택, 조각 교체·문장 확장 퀴즈(강의 ⑤⑦)는 **이번 범위 밖(후속)** — 데모에는 «나중» 으로 표시만.

## 구현 계획

1. **데모 v1(designer, opus)** — 레슨 5단계 표시(이해·문법·조각·응용·말하기)·조각 단계(문장별 슬래시 끊어 읽기·조각 밑줄+라벨(이름·액션·느낌·꾸임·연결)·조각 탭 재생·뜻·한글 줄·토글)·응용(마이크 기본 + 내가 한 말 한글 번역 + 글자 대체)·기존 레슨 빈 상태·오늘 카드·종료 카드·생성 대기 표 갱신(문제 점수 표기 제거)·3폭×130%×다크·«결정 필요» A/B. → Leader Artifact 게시 → 사용자 승인.
2. 승인 뒤: designer 가이드(`docs/screens.md`) → **prompt-engineer**(레슨·복습 프롬프트 v10 — 조각 분해, 생성 시간·크기·실패율 라이브 측정(호출 예산은 그때 사용자 승인), 프롬프트 골든) → developer(서버: 스키마·검증(조각 합 = 원문)·`content.ts`·`lifecycle`·관측·점수 표기 제거·새 audio kind·`progress` 키 / 화면: `StageChunk`·`StageApply` 마이크 기본·`LessonScreen`·카드·문구) → reviewer → qa → 배포(사용자 승인).
3. 큰 구현이라 **처음부터 서버·화면·마무리 검증을 분리한 소환**을 계획한다(턴 한도 반복 CAN-0017 반영).

## 완료 기준 (데모 단계)
- 데모 lint 통과·자체 점검 Critical·Major 0·사용자 승인 기록(`check.mjs approve`).

## 상태 로그

- 2026-10-21 사용자 「커밋하고 푸시해주고 IMP-0059 작업 진행해줘」 → vault 커밋·푸시(`5af8e7d`) → 착수 게이트 충족(task-009) → Leader 재확인(읽기 전용 탐색·DB 집계) → 사용자 결정 4건(권고대로) → judge 접수(standard·R1·demo full) → 이력서 작성 → designer 데모 v1 소환 예정.

- 2026-10-21 **데모 v1 완성**(`designer-081-demo`, opus): `docs/demo/task-081-lesson-chunk-step-v1.html`(1,099줄·합성 데이터), lint `DEMO_LINT_PASSED`(Leader 재실행)·`src/**` 변경 0. 상태 28개 × 「현재 vs 제안/제안만/세 폭」 × 360·390·412 × 780·892 × 글꼴 100·130% × 테마, 결정 패널 Q1~Q12(+Q6b), 섹션 `#glance`(불편한 사실 먼저)·`#decide`·`#changes`·`#a11y`·`#limits`·`#devmemo`. 자체 점검 design P0 0·P1 0·P2 4 / a11y Critical 0·Major 0·Minor 3, 실측(Playwright+Chrome) 5,376조합 가로 넘침·44px 미만 터치·콘솔 오류 0·클릭 흐름 통과. Leader 가 첫 화면(한눈에·결정 패널)을 스크린샷으로 확인(전수 아님). 디자이너 보고: ③ 은 한 문장씩(문장 k/n)·문장 안 조각 칸(읽기 루비·일본어·밑줄·이름표)+빗금·조각 탭 시 그 조각만 재생+한국어 뜻·④ 카드 안 마이크 기본(누르고 말하기 72px)+「⌨ 글자로 쓰기」+말한 뒤 한국어 뜻 줄·옛 수업 ③ 빈 상태·「문제 n/5」 제거(종료 카드·오늘 카드·생성 대기·챌린지 표). 기록 [[task-081-designer-record]].
- 2026-10-21 **디자이너 발견 2건 → 사용자 결정 필요**: ① **Q9 «표현 조각» 6종째** — 인사·대답(はい·すみません·お願いします)은 이름·액션·느낌·꾸밈·연결 어디에도 안 맞음 → 앱 단어장의 기존 «표현 조각»(`CHUNK_LABEL.EXPRESSION` — 「문장 밖에서 통째로 쓰는 말」)을 6종째로 쓰자는 제안(사용자 결정 3 «4종+연결» 과 다름) ② **Q12 밑줄 색** — 기존 토큰 재사용(이름 protein·액션 accent·느낌 carb·꾸밈 good·표현 ink 끊은 선·연결 ink3 점선, 새 색 0)인데 protein·carb 는 성장 탭 차트 색 → **Leader 결정: 수용**(색은 장식, 정보는 이름표 글자, 새 색 없음 — 사용자에게 공개). 그 밖 구현 때 고칠 것: ④ 말한 뒤 [비교하기] 가 390·780 에서 접힘선 +39px(최종 결과 뒤 nearest 스크롤)·«다음은 ③ 조각이에요» 받침 처리(지금 «예요» 고정)·단어장 `CHUNK_DEF.MODIFIER` 풀이에 «조사구» 포함이라 연결 조각과 겹침(③ 은 그 풀이 미사용)·`readStoredContent` 가 `quiz` 없으면 손상 처리(서버 완화 필수).
- 2026-10-21 **Artifact 게시·검토 요청**: https://claude.ai/artifact/NuAgnjnKLmYYgZ8gAZAR6h (비공개), 게이트 `status --to review_requested --version 1`. 사용자 답 형식: «Q1 A, Q2 A … Q9 …» 또는 «권고대로 승인» → `check.mjs approve --version 1 --quote 원문`(대리 승인 금지).

- 2026-10-21 14:01 **사용자 데모 v1 승인** 「권고대로 승인, Q9는 A로」 → 게이트 `approve --version 1`(발화 대조 통과, sha256 `21ebca22…`, 해시 verified). **Q1~Q12(+Q6b) = ★ 권고대로**: Q1 마지막 문장까지 넘기면 [다음 단계]·Q2 문장 안 조각 칸(밑줄+이름표)+빗금·Q3 단계 아래 접힘 모아 보기·Q4 연결 조각 따로 칸+점선·Q5 옛 수업 빈 상태+[다음 단계]·Q6 응용 카드 안 마이크 기본+글자로 쓰기·Q6b 뜻 줄 말한 직후+비교 뒤 «내 문장»·Q7 종료 카드 [오늘의 조각 N][만든 문장][쓴 표현]·오늘 카드 «주제·조각 N개·말하기 표현 u/t»·Q8 조각+구간 두 버튼·Q10 «참고용» 한 줄 고지·Q11 ② 문구에서 «조각»·«문제·» 빼기·**Q9 A = «표현 조각» 6종째**(인사·대답 — 사용자 결정 3 의 4종+연결에 이 한 가지 추가, B 는 5종 안에 억지로 넣기)·**Q12 밑줄 색 기존 토큰 재사용(Leader 수용, 새 색 0)**.
- 2026-10-21 **Leader 방향 승인(데이터 초안 — PE·designer 가이드가 세부 확정, reviewer 검증)**: ① 조각 데이터 `dialogue[i].pieces?: {ja, type: NAME|ACTION|FEELING|MODIFIER|LINK|EXPRESSION|null, ko, slash?}[] | null`(레슨 내용 JSON 안, **DB 구조 변경 없음**) — 읽기·한글은 LLM 이 아니라 서버 읽기 분석기(task-036 «LLM 읽기 필드 제거» 원칙), `type null` = 문장부호·기호(누를 수 없음·뜻 없음), 검증 = 조각 `ja` 를 이으면 원문 문장과 같아야 함·줄 단위 null 허용(절반 넘으면 재생성은 PE 가 임계 확정) ② 진행 키 `progress.pieces.seen`(클라이언트 허용 목록·8KB 상한) ③ 새 소리 kind `piece`·`phrase` — 서버가 저장된 내용에서 텍스트를 만들고 클라이언트 텍스트는 받지 않음(임의 문장 합성 방지 유지) ④ 새 레슨 내용에는 `quiz` 없음·`Lesson.score` 는 nullable 유지·`readStoredContent` 는 `quiz` 없이도 정상(옛 수업은 `quiz` 를 그대로 가지므로 양쪽 허용) ⑤ REVIEW·상황 레슨도 같은 구조 ⑥ `lesson@v10`·`reviewMix@v4` 계열 프롬프트(PE).
- 2026-10-21 **다음**: designer 구현 가이드(`docs/screens.md` §37, 데모 v1 승인 명시) → 정본 갱신(api-contract #58~#62·`screens.md` §2·§12·§14·§34) → `check.mjs activate` → **PE**(레슨·복습 프롬프트 v10: 조각 분해 프롬프트·스키마·결정적 검증 규칙·골든·**라이브 측정 호출 예산은 그때 사용자 승인**) → developer 서버/화면/마무리 **분리 소환**(CAN-0017) → reviewer → qa → 배포.

- 2026-10-21 **구현 가이드 완료**(`designer-081-guide`, opus): `docs/screens.md` §37(약 580줄, 37-0~37-19)·§2·§12·§14·§34 머리에 «§37 로 대체/넓어짐» 한 줄·승인 데모 해시 `21ebca22…` 불변·`src/**`·`docs/design/*` 변경 0. ③ `StageChunk` 의사코드·부품 6파일·`chunkLogic.ts` 순수 함수 9개·④ `StageApply` 마이크 기본(+[비교하기] nearest 스크롤)·상태 표 31행·문구 표·접근성·서버 계약 초안(37-12: 조각 저장 모양·LLM 스키마·줄 검증 6규칙(«같음» = NFC 완전 일치)·종류 판정 지침·소리 `{kind:'piece'|'phrase', idx, sub}`·#58 `pieces`·#61 `pieces.seen`·#62 점수 nullable)·37-13 «문제» 제거 영향(옛 수업 불변)·소환표(PE → 서버 → 화면③ → 화면④·표기 → 마무리, 서버·화면·프롬프트 한 릴리스). 기록 [[task-081-designer-guide-record]].
- 2026-10-21 **Leader 결정(가이드 37-18 확인 필요 → 37-18-1 에 기록)**: ② 성장 탭 안내 4줄 수용(문형·조사 `axisOneSidedSub` 빈 값 — **문제 단계가 없어지면 문형·조사 축은 대화 교정만 쌓여 단계가 사실상 안 보임**, 사용자에게 공개)·③ 데모 밖 문구 3곳(`genPhase`·`U2.desc`·`STAGE_COPULA` 받침 — 지금 «② 문법예요» 오류도 함께) 수용·④ ASK «점수» 는 developer 가 확인·⑥ **재시도 뒤에도 조각 검증이 안 넘으면 레슨 실패 대신 위반 줄 null 저장**·정정 ⑦(`PIECE_TYPE_LABEL` 6종 분리)·⑧(`aria-live`) 수용·**37-12·37-13 초안 Leader 승인**. **정본 갱신(Leader)**: `api-contract.md` #58·#60·#61·#62·#62c·#185 개정 노트, `domain-model.md` `Lesson.content.dialogue[].pieces`·`StatsSnapshot(LESSON)`, `screens.md` §1-1(밑줄 색 토큰 재사용). 데모 게이트 `activate`.
- 2026-10-21 **`pe-081-design`(PE 1단계, 라이브 호출 금지) 소환**: 스키마·타입(최우선)·`validatePieces` 한 곳 구현·`checks.ts`/`repair.ts`·프롬프트 `lesson@v10`·`reviewMix@v4`·`lessonScenario@v2`·시험·**측정 하네스 준비(실행 금지, `MAX_CALLS` 하드 상한·`main()` 가드)**·`RequestTrace` 베이스라인(읽기 전용)·눈가림 판정 표 생성기·합격선 제안. **2단계(라이브 측정·골든 재기록)는 사용자 호출 예산 승인 뒤**.

- 2026-10-21 **사용자 라이브 호출 예산 승인** 「40회 승인, 진행해줘」 — **PE 2단계(레슨·복습·상황 레슨 생성 측정 + 골든 재기록) 라이브 호출 하드 상한 40회**(재실행·사고 포함 총량 — 하네스 `MAX_CALLS`·호출 원장 `calls.json` 이 강제, 초과 시 즉시 중단·보고). 1단계(`pe-081-design`)가 끝난 뒤 **신규 소환**(큰 컨텍스트 재사용 금지 규칙)으로 2단계를 시작한다. 합격선은 측정 전에 이 이력서에 고정(1단계 제안 → Leader 확정), 조각 분해 품질은 눈가림 표를 Leader 가 판정.

- 2026-10-21 **PE 1단계 완료**(`pe-081-design`, 라이브 호출 0): `schemas.ts`(`quiz` 제거·`dialogue[].pieces` 필수 — 널 칸은 파일 관례 `anyOf [null,…]`)·`lessonPieces.ts`(`validatePieces` 6규칙, `conversation/index.ts` 로 내보냄)·프롬프트 `lesson@v10`·`reviewMix@v4`·`lessonScenario@v2`(조각 지침 한 줄을 A4·A5·상황이 공유)·`LESSON_USER_PROMPT_CAP` 9,500→9,900(+363자)·하네스 `tests/prompts/lesson-pieces-live.ts`(가드 4겹·DRY 통과·시험 8개)·조각 픽스처 `lesson-pieces-cases.json`(좋은 줄 26+나쁜 줄 26)·베이스라인 `RequestTrace` 읽기 전용. 시험 conversation+engine 1,584 통과·eslint 0·tsc 오류 2건(`LessonGenOutput` 불일치 — `app/api/v1/lessons/route.ts`·`_lib/review.ts`, developer 몫). 기록 [[task-081-pe-record]]. 추정: 출력 +20~35% → LLM 단계 중앙값 운영 v9 42.6초 → 51~57초(합격선 G1a 60초에 가까움·재시도 나면 120초 잡 예산 위험).
- 2026-10-21 **Leader 결정(PE 확인 필요 5건)**: ① 서버가 같은 함수를 직접 쓰는 방식은 L3→L2 import 금지로 불가 → 요청의 **`extraCheck` 가 `pieces` 를 제자리 정리해 돌려주는 방식 수용**(위반 줄 null·재시도 뒤에도 넘으면 마지막 시도에서 면책 `tolerateInvalidPieces`, 레슨 실패 없음 — 37-18-1 ⑥ 와 일치, reviewer 대조) ② 지연 위험은 **측정으로 판단**(합격선 G1 사전 등록 아래) ③ `tutor.md` §1 한 구절(문제→조각) 수정으로 TALK persona 해시 변화·`talk-general-golden.json` persona 해시만 변경·`lesson-general-golden.json` 재기록 **수용**(사용자에게 공개 — 강사 소개 문구의 사실 정정) ④ A5(복습) `stripAdditionalProperties` 는 **켜지 않음**(기존 가드 시험이 켜는 빌더를 셋으로 못박음 — 이번 범위 밖) ⑤ PE 가 더한 slash 확장(뒤에 type 있는 조각이 없으면 slash 제거) 수용.
- 2026-10-21 **측정 합격선 사전 등록(이 줄 이후 수정 금지 — 측정 뒤 바꾸지 않음)**: G1a 1차 성공 호출 경과 중앙값 ≤ 60초 · G1b 전체 최대 ≤ 100초 · G1c 120초 초과 호출 0 · G2a 재시도율 ≤ 17%(12회 중 2) · G2b 최종 실패(던짐) 0 · G3a 조각 null 줄 비율(전체 풀링) ≤ 10% · G3b 마지막 시도 면책(조각 위반 줄 null 저장) 0건 · G3c 1차에서 조각 임계로 재시도한 호출 ≤ 1건 · G4 `koNoHangul`(type 있는 조각 대비) ≤ 3% · G5a 조사 조각이 LINK 가 아닌 비율 ≤ 3% · G5b です/ます·활용 어미 분리 줄 ≤ 5% · **G6 눈가림 Leader 판정(≥ 40줄): 틀림 ≤ 5%·맞음 ≥ 70%·맞음+어색 ≥ 92%**. 출처: [[task-081-pe-record]] §7.
- 2026-10-21 **호출 계획(사용자 승인 40회 안)**: ① PE 2단계 **core 12회** ② core 가 경계에 걸리면 Leader 가 extra 6회(같은 입력 되풀이) 승인 ③ 지침 줄을 고쳐 변형 재측정 12회는 Leader 판단 — 총량 **상한 30회**(하네스 `HARD_CAP`·`MAX_CALLS`·원장). PE 는 core 12 를 끝내고 **보고 후 멈춘다**(extra·변형은 Leader 지시 없이 실행 금지).
- 2026-10-21 **judge C1**(`codex_gate` C1, R1): `codex_required:false`·`wanted_before_budget:true`(`CX-limit-unknown-hold`) — Codex 외부 검토 보류(task-078·079 와 같음).
- 2026-10-21 **병행 소환 3**(파일 소유 분리 — CAN-0017): `pe-081-measure`(PE 2단계 라이브 core 12회·눈가림 표·골든 재기록 / 미러 `pe081b`) · `dev-081-server1`(생성 연결·`readStoredContent`·진행·소리 kind·`today` `pieceCount`·`types/lesson.ts`·레슨 라우트 / 미러 `dev081s1`) · `dev-081-server2`(`lifecycle`·점수 nullable·`StudyLog`·스냅샷·관측·챌린지 읽기·`types/challenge.ts`·ASK «점수» / 미러 `dev081s2`). 그 뒤 화면③ → 화면④·표기 → 마무리.
- 2026-10-21 **병행 소환 3 실행** — `pe-081-measure`(prompt-engineer, 라이브 core 12회·`LIVE_OK=task-081`·눈가림 표 SHEET_N=40 SEED=81·열쇠는 `task-081-pe-data/sealed/`·골든 재기록, 기록 `task-081-pe-measure-record.md`) · `dev-081-server1`(developer opus, 생성 연결·`readStoredContent`·진행·소리 kind·`today` `pieceCount`·`types/lesson.ts`, 기록 `task-081-dev-server1-record.md`) · `dev-081-server2`(developer opus, `lifecycle` 점수 nullable·`StudyLog`·스냅샷·관측·챌린지 읽기·ASK «점수» 확인, 기록 `task-081-dev-server2-record.md`) 백그라운드 시작. 파일 소유 분리 확인 완료(서버1: lessons 의 content·progress·validate·today·generate·rows·`api/v1/lessons/**`·`_lib/review.ts`·`types/lesson.ts` / 서버2: lifecycle·observations·snapshots·challenges·recordRetrieval·`types/challenge.ts` / PE: tests/prompts·conversation). 미러 `pe081b`·`dev081s1`·`dev081s2`. `LessonContent.quiz` 는 선택(`quiz?`)으로만 바꿔 tsc 초록 유지, 화면 갈래가 `StageQuiz` 제거 뒤 타입 정리(Leader 결정). 완료 알림 대기 — 호출 총량 상한 30(승인 40 내), PE 는 core 12 뒤 멈추고 보고.
- 2026-10-21 **서버 갈래 2 완료(dev-081-server2, 보고 수령 — Leader 미검증 항목은 아래 «검증 대기»)**: 변경 7파일(`lessons/{lifecycle,observations}.ts`·`snapshots/index.ts`·`challenges/{metrics,view}.ts`·`types/challenge.ts`) + 새 시험 `__tests__/task081Server2.test.ts`. 새 수업(quiz 없음) 완료 시 `Lesson.score`·응답 `lesson.score`/`result.score`/`result.quiz` null, `StudyLog` 요약에서 «문제 c/t» 제거·결과의 점수·`quiz*` 4키 생략, 스냅샷 `score:null`·`quizCorrect/quizTotal` 생략. 옛 수업은 키 순서·문자열까지 불변. 조각(표현)·문형은 정답/오답 0 으로 계속 `RepetitionItem` 등록, REVIEW 레슨은 `studiedCount+1` 만 — **레슨 완료로 `wrongCount` 가 더는 늘지 않음**(기록). 챌린지: 키 없는 스냅샷은 null 로 읽음(전엔 0/0), «오늘의 회화 완료» 판정은 스냅샷 존재 여부라 불변(시험 고정), 챌린지 최종 결과 `days[].quiz` 는 `[null,null]` 로 저장(날 유지). ASK: 점수는 `recordRetrieval/sources.ts` 218·416행에서 null 이면 이미 생략 → 코드 불변, `askCopy.ts:209` «점수» 문구는 평가 점수도 있어 결정 ④ 대로 유지. 시험 10/10 + 관련 기존 199/199, 변이 7/7 잡힘·원복 `cmp` 일치(변이 5 는 첫 시도가 문법 오류라 다시 작성). **tsc 2 오류 = `src/components/challenge/logic.ts` 287·479행**(타입을 null 허용으로 넓힌 결과, 화면 갈래 ④ 소유 — §37-16 대로 타입 먼저). 정본 반영(Leader): `api-contract.md` 챌린지 DTO `lesson.quizCorrect|null,quizTotal|null`, `domain-model.md` `Challenge.result.days[].quiz` `[null,null]` 추가.
- 2026-10-21 **Leader 재확인(서버 2)**: 미러 `dev081s2` 의 7파일이 NFS 와 `cmp` 일치, `task081Server2.test.ts` 직접 재실행 10/10 통과(변이 7/7 은 developer 보고 — 미재현).
- 2026-10-21 **검증 대기(QA 몫)**: 완료 시험은 가짜 트랜잭션이라 «생략한 키가 실제 MariaDB 저장물에서도 빠진다» 는 미확인 → QA 에서 실제 행 1건으로 확인(임시 계정·정리 필수). 화면 갈래 ④ 는 `challenge/logic.ts` 287·479 null 처리 포함.
- 2026-10-21 **서버 갈래 1 완료 수령(dev-081-server1) + Leader 재확인**: 미러 `dev081s1` 변경 파일이 NFS 와 `cmp` 일치(0건 차이)·`task081Server1.test.ts` 직접 재실행 14/14. 보고: 새 시험 14/14·레슨 관련 697건 중 696 통과·1 건너뜀·0 실패·eslint 0·변이 7/7 잡힘(원복 일치). **지시와 다르게 한 곳(Leader 수용)**: `LessonContent.quiz` 를 선택(`quiz?`)으로 바꾸지 않고 **필수 유지**(선택으로 바꾸면 `StageQuiz.tsx` 12곳·`logic.ts:181` tsc 오류) — 서버는 새 수업에도 `quiz: []` 를 내려 줘서 필수 타입이 실제 응답과 맞음, 화면 갈래가 `StageQuiz` 제거 때 정리. `speaking.ts` 한 줄(`sub` 전달, 가이드 §37-15 서버 몫)·`lessonInput.test.ts` 기대값(`lessonScenario@v2`) 수정. `ProgressLimits.dialogueCount` 선택(없으면 조각 진행 저장 400 — 서버 2 가 `lifecycle.ts:63` 에 넣음). tsc 남은 오류 2 = `challenge/logic.ts:287·479`(화면 ④ 몫). 화면 ③a 에 넘길 공용 픽스처 `pieceRuleCases.json`.
- 2026-10-21 **PE 2단계 core 12회 결과 수령(pe-081-measure)**: 호출 12(원장 start/end 12/12·CLI 시도 14·재시도 2·한도 문구 0)·경과 10분 5초. 합격선 대비: G1a 42.6초(≤60)·G1b 80.2초(≤100)·G1c 0·G2a 16.7%(2/12, 경계)·G2b 0·G3a 4.9%(5/102)·G3b 0·G3c 0·G4 0/528·G5a 1.5%(2/137) **합격**, **G5b 5.9%(6/102) 불합격**(い·な형용사 뒤 です 를 따로 쪼갠 6줄, 5줄이 자기소개 N5 한 호출). 응답 JSON 중앙값 6,645자·최대 7,582자(pieces 38.2%), 줄당 조각 7.6·끊어 읽기 2.04, 종류 분포 LINK 26.5·NAME 24.4·FEELING 13.1·EXPRESSION 12.9·ACTION 12.9·MODIFIER 10.2%. null 5줄 모두 `join_mismatch`(25자 이상 15줄 중 4줄 27% vs 미만 87줄 중 1줄). 골든 재기록 파일 0(1단계에서 요청 바이트 골든 2개 이미 재기록, 시험 96개 통과). 재시도 2건은 조각과 무관(speaking `modelAnswerJa`·`application` 3개 초과, cafe-order 80초대).
- 2026-10-21 **G6 눈가림 판정(Leader 1인, 열쇠 열기 전 [[g6-judgment]] 에 고정)**: 40줄 중 틀림 0(0%, ≤5% 합격)·맞음 27(67.5%, ≥70% **불합격**)·어색 13·맞음+어색 100%(≥92% 합격). 어색 원인 4: ① です/ですか 를 앞 조각에서 뗌 5줄(G5b 와 같은 뿌리) ② 종류가 지침 표와 어긋남 5줄(부사+です→느낌·する동사/상태 동사→느낌·수량→꾸밈·통째 표현→액션) ③ 뜻 풀이 3줄(문말 よ «~이에요/~이요(강조)»·목적 に «~으로») ④ 끊어 읽기가 명사-조사 사이를 가름 1줄. 열쇠 열람 후: 전부 `arm v10`, 어색은 R-6·자기소개·카페 주문·여행 이야기 등 **여러 호출에 흩어짐**(한 호출 문제 아님) → 프롬프트 지침 문제. 한계: 1인 판정, 경계 사례(この·よ 풀이)에서 한 줄만 달라도 70% 를 넘나듦(경계 상태) — 합격선은 바꾸지 않음.
- 2026-10-21 **Leader 결정 — 지침 보정 후 재측정 6회**: G5b·G6(맞음) 가 불합격이고 원인이 같은 뿌리(지침 표를 덜 따름)이며 고칠 수 있으므로 **그대로 배포하지 않고 PE 3단계 소환**(`pe-081-tune`, 신규 소환): 프롬프트 지침 4가지 보정(증가 ≤ +450자, 눈가림 표 문장을 예시로 쓰지 않음)·결정적 보정 1가지(`slash` 가 LINK 조각 바로 앞이면 LINK 로 옮김 — 글·순서·종류 불변, «같음» 정의 불변)·재측정 **라이브 6회**(누적 18 ≤ 상한 30 ≤ 승인 40)·새 눈가림 표 SHEET_N=40 SEED=82(`blind-sheet-r2.md`, 열쇠 봉인). 같은 합격선(G1~G6)을 새 표본에 적용(6회라 비율은 참고용 병기), 보정이 안 먹으면 «있는 그대로 배포 + 사용자 공개 + 폰 확인에서 판단» 도 선택지로 남긴다. 화면 갈래는 이 결과와 무관하게(조각 데이터 모양 불변) 병행 진행: `dev-081-ui3a`(chunkLogic·문구 U3/STAGE/PIECE·재생 훅 `sub`) 소환 완료 → 이어서 ③b(컴포넌트)·④.
- 2026-10-21 **화면 ③a 완료 수령(dev-081-ui3a) + Leader 재확인**: 미러 `dev081u3a` 변경 파일 NFS 와 `cmp` 일치, `task081Chunk.test.ts` 직접 재실행 17/17. 보고: `chunkLogic.ts`(37-4-2 전 함수·순수)·`phraseText`/`pieceCount` 를 서버와 같은 공용 픽스처(`pieceRuleCases.json`, 6+5건)로 검사·변이 9/9 잡힘(원복 `cmp` 일치)·`lessonCopy.ts` `STAGE_NAMES`('조각')·`STAGE_COPULA`·`PIECE_TYPE_ORDER/LABEL`(6종)·`U3` 전면 교체(`HOME/GEN/U2/U4/END` 불변)·`playLines` `sub?`(piece·phrase 에만 실음, 다른 kind 요청 바이트 불변을 시험이 고정)·`useLesson` `'pieces'`(중복 제거·정렬 후 전송). 가이드와 다른 곳: `phraseText` 는 `string|null`·`pieceRanges` 두 번째 인자(원문, 불일치 시 null)·`U3.phraseLead/Tail/Stop`(일본어 부분 `lang=ja`)·한글 줄에서 슬래시 뒤 연결 조각은 붙이지 않고 한 칸 띄움. 알려진 한계(QA 확인): 실제 분석기가 조사를 앞 낱말에 묶어 한 분석 조각으로 내면 그 줄은 빗금 없는 일반 한글 줄로 대체(잃는 것 없음, 빗금이 실제로 얼마나 나오는지 QA 가 봄). tsc 남은 오류 39 = ③b `StageQuiz.tsx` 12 + ④ `lesson/logic.ts` 2·`challenge/logic.ts` 2·옛 문제 시험 21+2(task025·025b·reviewRegression, 옛 U3 키를 읽음). 시험 15파일 168 중 165 통과·실패 3 = 위 옛 문제 시험(④ 에서 정리).
- 2026-10-21 **화면 ③b 소환(`dev-081-ui3b`)**: `ChunkSentence.tsx`(Card·Tiles·Strip·HangulLine·Empty)·`PieceCollect.tsx`·`StageChunk.tsx`(37-3 전체·진행 `pieces.seen`·초점 이동)·`LessonScreen.tsx` stage 3 교체(complete()/EndResult 는 ④ 몫)·`StageQuiz.tsx` 삭제·`useLesson` `'quiz'` 제거·렌더 시험 + 변이 ≥ 4. 브라우저/dev 서버 금지(시각 3폭 확인은 Leader QA). 미러 `dev081u3b`. 이어서 ④(응용 마이크 기본·종료 카드·오늘 카드·성장 탭 4줄·문구 3곳·`types/lesson.ts` `quiz` 정리·`challenge/logic.ts`·옛 문제 시험 정리).
- 2026-10-21 **화면 ③b 완료 수령(dev-081-ui3b) + Leader 재확인**: 인덱스에 스테이지된 파일 0(`StageQuiz.tsx` 삭제는 작업 트리에만 — 보고의 `git rm --cached` 실수는 되돌려진 것 확인), 미러 `dev081u3b` 가 NFS 와 `cmp` 일치, `task081ChunkUi.test.ts` 직접 재실행 18/18. 보고: 새 `ChunkSentence.tsx`·`PieceCollect.tsx`·`StageChunk.tsx`·`LessonScreen.tsx` stage 3 교체(`complete()` 불변)·`useLesson` `'quiz'` 제거·변이 10/10·관련 20파일 211 통과·실패 3(전부 ④ 몫)·tsc 39→28(전부 ④: `challenge/logic.ts` 2·`lesson/logic.ts` 2·`reviewRegression` 3·`task025b` 15·`task025` 6)·eslint/엔진명 0. **위험**: `reviewRegression.test.ts` 14개가 `Cannot find module '../../StageQuiz'` 로 로드 실패(이전엔 13 통과) → 복습 수업 회귀 감시 공백, ④-B2 가 17행·109~116행을 먼저 정리하도록 지시. 가이드와 다른 곳(Leader 수용): 전부 null 새 수업 → 옛 수업 판정은 `chunkMode` 대신 «어떤 줄에도 `pieces` 키가 없을 때만»(37-3-1 에 맞춤)·첫 문장 도착 때 초점을 [다음 문장] 으로(추가)·구간 듣기 버튼 `min-h-11` 줄바꿈 허용·끝낸 단계 다시 볼 땐 저장 안 함. 서버 렌더 시험이라 루비·한글 빗금 줄·클릭·초점·360px/130% 배치는 QA 몫.
- 2026-10-21 **화면 ④ 3분할 소환(파일 소유 분리)**: **④-A `dev-081-ui4a`**(`StageApply.tsx` 마이크 기본·뜻 줄·`aria-live`·`U4` 블록만 `lessonCopy.ts`) ∥ **④-B2 `dev-081-ui4b2`**(`review/**` 문구·`reviewRegression.test.ts` 복구·`challenge/**`·`plan/growthCopy.ts` 성장 탭 4줄(+시험)·`vocab/topicCopy.ts`). **④-B1(예정)**: `lesson/logic.ts`(`EndResult`·`genPhase`·문제 부속 지움)·`LessonEnd.tsx`·`TodayLessonCard.tsx`·`lessonCopy.ts`(`HOME/GEN/U2/END`)·`LessonScreen.tsx`(`complete()`·`StageApply` 새 props 연결)·`parts.tsx` 주석·`types/lesson.ts` `quiz` 정리·`task025/025b/display` 시험 — `lessonCopy.ts`·`LessonScreen.tsx` 가 ④-A 와 겹쳐 ④-A 완료 뒤 소환. 그 다음 마무리(전체 빌드·시험·tsc) → reviewer → Leader 게이트·QA.
- 2026-10-21 **사용자 지시 「진행완료되면 결과정리해서 알려줘. 점검사항 및 배포작업 진행하자」** — 개발 완료 후 결과 정리 보고 + 점검(reviewer 감사·Leader QA) → 통과 시 커밋·푸시·배포까지 진행하는 것으로 해석(배포는 origin ref 기준이라 푸시 포함). **보류 조건**: 감사 Critical/High·QA 결함·재측정(G5b·G6)이 개선되지 않을 때는 배포하지 않고 사유와 함께 먼저 보고. 공유 작업트리에 task-081 과 무관한 수정(`.claude/agents/{deployer,leader}.md`·`.codex/**` 등)이 있으므로 **경로 지정(pathspec) 커밋만** 한다. Leader QA 준비: 임시 수업 시드 스크립트 `scratchpad/qa081/seed-lessons.mts`(새 수업 2·전부 null 1·옛 수업 1, PE 측정 결과의 대화로 만듦, LLM 호출 0).
- 2026-10-21 **PE 3단계 결과 수령(pe-081-tune) — 지침 보정 + 재측정 6회**: 호출 6(원장 start/end 6/6·재시도 0·실패 0, **누적 18** ≤ 상한 30 ≤ 승인 40). 조각 지침 한 줄 869 → 1,201자(+332), 눈가림 표 문장 미사용, 버전 이름 `v10/v2/v4` 그대로(미배포), `LESSON_USER_PROMPT_CAP` 9,900 → **10,300**(실제 최악 10,218; 다른 줄을 깎아 상쇄하지 않고 올림 — 회귀를 볼 호출이 부족해서; CAP 은 런타임 강제가 아닌 설계 한도). 결정적 보정: `slash` 가 켜진 조각 바로 뒤가 LINK 면 LINK 연속 구간 끝으로 옮김(`lessonPieces.ts`, 글·순서·종류 불변, `slashMoved`) — 가이드 §37-12-3 7번으로 반영. 시험 conversation+engine 1,600 통과·eslint 0·변이 9/9. **G1~G5b 모두 합격**: G5b 5.9% → 0%·재시도 0/6·null 줄 0/52·1차 성공 중앙값 43.3초. 자동 탐지: 홀로 떨어진 です 류 22개 → 0, 명사-조사 사이 slash 14 → 2(이 2개는 정리 단계가 옮김). **원인 ②(종류 표기)는 그대로**(一つ→꾸밈 2/2, よろしくお願いします→액션 4/4 …) — PE 추정(확인 안 됨): `tutor.md` §5 chunks 4유형 정의가 pieces 6유형과 충돌. 6호출은 주제 수업만(복습·상황·붙여넣기 없음).
- 2026-10-21 **G6 2차 판정(Leader 1인, 열쇠 열기 전 [[g6-judgment-r2]] 에 고정)**: 40줄 중 틀림 0(0%)·**맞음 30(75.0%, ≥70% 합격)**·어색 10·맞음+어색 100%(합격). 1차 대비 원인 ①(です 분리 5→0)·③(뜻 풀이 3→0)·④(명사-조사 끊어 읽기 1→0) 해소, **남은 어색 10줄은 전부 ② 종류·조사 붙임**: よろしくお願いします→액션(3)·一つ→꾸밈(2)·조사를 앞 덩어리에 붙임 それは/次の/写真を撮りました(3)·前に→꾸밈·お待ちください→표현·小さい→꾸밈. 열쇠 열람 후 어색은 6호출 전반에 분포(자기소개·카페·길 묻기·여행). 독립 표본만 38줄 76.3%. 한계: 1인 판정·n=40·합격선과 5%p 차(한두 줄에 뒤집힐 수 있음).
- 2026-10-21 **Leader 결정**: PE 후속 선택지 중 **ⓐ 그대로 수용**(G6 합격 — 지침 표를 따르지 않는 ② 종류 표기는 «알려진 한계» 로 사용자에게 공개하고 후속 개선 후보로 남긴다: `tutor.md` §5 4유형 정의와의 충돌 확인·지침 맨 앞 «6유형» 선언은 폰 확인 뒤 필요하면 IMP 로). 페르소나(`tutor.md`) 추가 수정은 TALK 페르소나 해시를 또 바꾸므로 하지 않음. **추가 확인 1건**: 주제 수업 6호출은 복습·상황·붙여넣기를 포함하지 않았으므로 `pe-081-reg` 로 **회귀 3호출**(core 와 같은 입력 `R-6`·`S-cafe-order-N5`·`SRC-paste-N4`, `PLAN=reg`, 누적 21 ≤ 30) 소환 — 프롬프트 길이 상한·계약 위반·지연 확인용(품질 게이트 아님, 전체 줄은 Leader 가 훑음).
- 2026-10-21 **화면 ④-A 완료 수령(dev-081-ui4a)**: `StageApply.tsx` 마이크 기본(`voiceMode` 초기값 `!textFirst`, 늦게 `textFirst` 가 와도 아직 말·글이 없을 때만 글자 모드)·알아들은 말 상자 `aria-live="polite"`+`JaText`+`HangulLine`+뜻 줄·비교 뒤 «내 문장» 뜻 줄·`via` 화면 메모리만(저장 안 함)·번역 훅 하나·[비교하기] rAF 뒤 `nearest` 스크롤·`lessonCopy.ts` `U4` 만. 새 시험 15/15·관련 7파일 111건 통과·변이 7/7·eslint 0. 호출부 `LessonScreen.tsx:313` 이 새 props(`textFirst`·`trCache`) 미전달 → ④-B1 몫. **데모와 다른 곳(Leader 수용)**: 모범 답안과 같게 말했을 때 데모 `a-same` 은 «알아들은 말을 그대로 옮겼어요» 힌트를 보이지만, 구현은 가이드 §37-7(`ok, ai` 일 때만)·⑤ 규칙을 따라 뺐다 — 이 경우 뜻은 AI 번역이 아니라 모범 답안 뜻이라 힌트가 오히려 틀린 안내가 됨(데모의 불일치로 판단). 알아들은 뒤 상태 줄 문구는 «지금 부품 그대로». 못 본 것(QA): 누름·늦게 온 `textFirst`·스크롤·실제 #185 호출 수·상자 안 `aria-live` 이중 낭독(TalkBack).
- 2026-10-21 **화면 ④-B2 완료 수령(dev-081-ui4b2) + Leader 재확인**: 미러 `dev081u4b2` 변경 파일 NFS 와 `cmp` 일치, `reviewRegression`·`growthCopy`·`challenge` 시험 97/97 직접 재실행(`reviewRegression` 은 `StageQuiz` 시험 1개를 지워 14 → 13개로 복구, 로드 실패 해소). 복습 문구·챌린지(점 `Dots` 컴포넌트·`dots` 필드 제거, 점수 null 이면 «끝냄»)·성장 탭 4줄(전·후 표는 `task-081-dev-ui4b2-record.md`)·단어장 `auxDone`(«문제 c/5 · » 제거, 옛 둘째 인자는 받아 호환 — ④-B1 이 호출부를 `auxDone(t)` 로). `challenge/logic.ts` 287/479 tsc 오류 해소, `ResultRows.tsx:110` 이 빈 값 줄을 이미 건너뜀. **Leader 결정 2건**: ① `RV_HOME.nextStage` 에 `STAGE_COPULA` 적용(가이드 밖 — 안 하면 복습 카드가 «다음은 ③ 조각예요») **수용**. ② 성장 탭 «단계는 이렇게 정해요» 첫 줄이 «오늘의 단어·수업 문제·말하기 과제…» 라 새 수업엔 틀린 안내 → 결정 ② 와 같은 근거로 **«오늘의 단어·말하기 과제·대화 교정·역할극에서 맞히고 틀린 기록(관측)으로 계산해요.»** 로 Leader 가 직접 수정(`growthCopy.ts:129` + 시험 기대값·«문제» 0 단언 추가, 미러에서 7/7). 허용한 «문제» 예외: `challenge/logic.ts` `'문제 있음: '`(수업 생성 실패의 스크린리더 접두 — 퀴즈와 무관). `askCopy.ts` 불변(결정 ④).
- 2026-10-21 **화면 ④-B1 소환(dev-081-ui4b1)**: `lessonCopy.ts`(`HOME/GEN/U2/END`·옛 키 정리)→`logic.ts`(`EndResult{pieces,…}`·`genPhase`·문제 부속 지움)→`types/lesson.ts` `quiz` 정리→`LessonScreen.tsx`(`complete()`·`StageApply` 새 props 연결)→`LessonEnd`(3칸/2칸)·`TodayLessonCard`·`parts` 주석→옛 문제 시험 정리·새 시험. 목표: 프로젝트 전체 tsc 0. 병행: `pe-081-reg`(복습·상황·붙여넣기 회귀 3호출).
- 2026-10-21 **회귀 확인 3호출 결과 수령(pe-081-reg)**: 호출 3(원장 start/end 3/3)·**누적 21** ≤ 30 ≤ 승인 40. `PLAN=reg`(상한 3, `HARD_CAP` 20 불변, core 의 `R-6`·`S-cafe-order-N5`·`SRC-paste-N4` 와 같은 입력). 경과 R-6 38.4→41.8초·S-cafe 44.1→41.5초·SRC-paste 38.1→42.8초, 재시도 0/3, 최종 실패 0, 계약 위반 0, 프롬프트 +332자(persona 7,075자 포함 11.1~12.6K자; persona 뺀 system+user 3.6~5.1K자 → 상한 10,300 근처 아님), `koNoHangul` 0/140, 조사 오분류 0%, 분리 줄 0%. null 줄 1/27(3.7%) — SRC-paste 의 `お弁当はどうでしたか。おいしかったですか。` 가 `type_null_mismatch`(정리 전 원본이 없어 원인 미상). **G1~G5b 전부 통과 — 복습·상황·붙여넣기 경로에 회귀 없음.** 시험 파일은 `npm test` 가 못 찾는 `tests/prompts/` 에 있어 Leader 가 `src/modules/conversation/__tests__/lessonPiecesLiveReg.test.ts` 로 옮김(미러에서 5/5).
- 2026-10-21 **회귀 표본 26줄 Leader 훑기(게이트 아님, 확인용)**: 눈에 띄는 오류 — `韓国から来ました` 를 한 조각 «꾸밈» 으로(명사+から+동사를 묶고 종류도 틀림 — 틀림급 1줄/26=3.8%)·`よろしくお願いします` 를 «꾸밈» 으로 2줄(이 구절은 지금까지 액션/꾸밈/표현 세 가지로 흔들림)·`緊張しています` 느낌 2건·`お召し上がりですか` 표현. 대부분 ② 종류 표기 계열 — 이미 공개하기로 한 «알려진 한계» 와 같은 뿌리이고, 전체 틀림 비율(1차 0/40·2차 0/40·회귀 1/26)은 합격선(≤5%) 안. 결론: 사용자 보고에 «조각 종류 표기가 가끔 틀려요 — 특히 «よろしくお願いします» 류, 드물게 묶음 자체가 틀림» 을 폰 확인 항목으로 포함.
- 2026-10-21 **화면 ④-B1 완료 수령(dev-081-ui4b1)**: `lessonCopy.ts` `HOME/GEN/U2/END` 37-8 글자 그대로·`HOME.nextStage(n)` `STAGE_COPULA`·`logic.ts` `EndResult{pieces,…}`(`pieceCount` 로 셈)·`genPhase` «문법과 조각을…»·문제 부속 지움(`correctFromScore`·`quizPromptView`·`quizSummaryPrompt`·`quizReadingLeak`·`quizPromptLayerState`, 지운 뒤 `rg` 참조 0)·`types/lesson.ts` `LessonQuiz`·`quiz` 칸 제거(서버는 이 타입을 import 하지 않음)·`LessonScreen` 이 `StageApply` 에 `textFirst`·`trCache` 전달·완료 결과에 조각 수·`LessonEnd` 3칸/2칸·`TodayLessonCard` 5곳. 새 시험 `task081EndCard.test.ts`, 31/31·vocab·challenge·plan 562/562·변이 7/7, 화면 소스 tsc 35 → 0.
- 2026-10-21 **Leader 마무리 보정 3건**: ① `review/__tests__/quizTrace081.test.ts` 의 허용 목록에서 성장 탭 첫 줄 항목 제거(내가 고친 문구 때문에 실패하던 시험) ② `vocab/topicCopy.ts` `LESSON_CH.continueNote` 가 «예요» 를 고정해 챌린지 «이어서 하기» 카드가 «다음은 ③ 조각예요» 로 나오던 받침 오류 — 시그니처를 `(nextStage, dayIndex)`(서술격이 붙은 문자열)로 바꾸고 `TodayLessonCard` 가 `STAGE_COPULA[stageDone]` 를 붙여 호출 ③ 내가 옮긴 `lessonPiecesLiveReg.test.ts` 의 타입 오류 3건(`NodeJS.ProcessEnv` 명시).
- 2026-10-21 **통합 검증(Leader, 미러 `t081int` = NFS 현재 상태, src·tests·prisma `diff -rq` 동일)**: **tsc 전체 오류 0**. eslint(`src tests/prompts`)·전체 시험(`find src scripts/seed-build -name '*.test.ts'`)은 백그라운드 실행 중, 운영 빌드 대기. 병행: **reviewer 감사 3갈래**(A 서버·정본 `rev-081-a` / B 프롬프트·LLM 계약·하네스 `rev-081-b` / C 화면·접근성·문구 `rev-081-c`, Read 전용, 기록 `task-081-rev-{a,b,c}-record.md`).
- 2026-10-21 **통합 시험 결과(Leader, 미러 `t081int`)**: eslint(`src tests/prompts`) 종료 0 · **전체 시험 4,844건 중 통과 4,841·실패 0·건너뜀 3**(종료 코드 0) · tsc 오류 0. 운영 빌드(`next build`) 실행 중.
- 2026-10-21 **감사 A(서버·정본, `rev-081-a`) 결과 — PASS_WITH_NOTES (Critical 0·High 0·Medium 1·Low 7)**: 소유자·입력 검증·`pieces.seen` 경계·옛 수업 호환·옛 스냅샷 불변·6층 경계·엔진명 0·정본 일치 [확실]. **M1(Medium)**: 결정 37-18-1 ⑥ «조각 때문에 수업 생성이 실패하지 않음» 이 부분만 실현 — LLM 출력 스키마 하드 한계(조각 `ja` 40자·`ko` 30자·한 줄 24조각·`slash` 필수)를 넘으면 «위반 줄 null» 이 아니라 재시도 뒤 `JsonSchemaError` 로 수업 FAILED. **Leader 결정: 코드는 건드리지 않고 결정 문구를 좁힘**(screens.md 37-12-4 에 적용 범위 명시) — 근거: 라이브 21회 호출에서 스키마 위반 실패 0건, 스키마를 풀면 요청 바이트가 바뀌어 측정·골든이 무효. 후속 후보로 남김. L1 NFD 조각(저장은 되나 화면 범위 계산 어긋날 수 있음, LLM 출력이 NFC 라 드묾) · L2 진행 중이던 옛 수업을 문제 한 칸도 안 풀고 끝내면 `score 0`·`quizTotal 5` 기록(기존 동작) · L4 `dialogueCount` 선택(현재 `lifecycle.ts:65` 연결 정상, 고정 시험 없음) · L5 조각·구간 탭이 TTS 분당 60 한도 소모(사양대로) · L6 배포 직전 열린 옛 탭 표시 어긋남(한 릴리스 배포로 해소) · L7 `sub` 범위 밖일 때 오류 필드가 `idx`. **L3 정본 낡은 곳은 Leader 가 수정 완료**: #71 `challenge.lesson` nullable·`domain-model` Prisma 주석 `[null,null]`·D2 결과 한 줄(관측·반복 항목·`wrongCount`)·«초안» 문구 6곳+헤더 3곳을 «Leader 승인» 으로. QA 집중: #61 실저장·#62c 입력 경계/429·#62 완료 뒤 실DB 키 생략과 챌린지 `[null,null]`·3경로 첫 라이브 생성의 NFC 일치·null 줄·FAILED 율·옛 수업 호환·ASK 점수 null.
- 2026-10-21 **운영 빌드(미러 `t081int`, 수정 전 상태) 성공 — 종료 0.**
- 2026-10-21 **감사 C(화면·접근성·문구, `rev-081-c`) 결과 — PASS_WITH_NOTES (Critical 0·High 0·Medium 2·Low 6)**: 엔진명·`fetch`·`Capacitor`·`dangerouslySetInnerHTML`·금지어 6개·하드코딩 색·`modules/**` 우회 import 0, 문구 §37-8 글자 일치, «문제» 잔재는 허용 항목 `'문제 있음: '` 하나, 제거한 것(`StageQuiz`·`correctFromScore`·`LessonQuiz`·`Dots`) 참조 0, 서술격 5단계 모두 오늘 카드·복습 카드·챌린지 이어서 하기에 반영, 데모 게이트 `DEMO_GATE_PASSED`(승인 기록은 현재 세션의 사용자 승인, 대리 승인 흔적 없음). 새 시험 5파일 63건 통과, 변이 7건 중 3건 잡힘(생존 4건 중 1건은 동치, 나머지 3건 = 소리 없음 탭 재생 가드·뜻 줄 `heard.text===draft` 가드·마지막 문장 도착 초점 → 서버 렌더 시험의 한계, QA 몫). **F1(Medium)** ④ 알아들은 말 상자 `aria-live="polite"` 안에 자체 `aria-live` 인 `SpeakTranslation` 이 중첩 → 뜻이 두 번 읽힐 수 있음 → **Leader 가 수정**: 바깥 상자의 live 를 떼고 안쪽 알아들은 글 칸(`<div aria-live="polite">`)에만 두고 뜻 줄은 형제로(시험 갱신, 미러 15/15·tsc 0·eslint 0). **F2(Medium)** 조각 칸 `whitespace-nowrap` 인데 서버는 `ja` 40자까지 허용 — 데모의 가장 긴 칸은 11자, 14자 이상 조각이 360px·130% 에서 카드 밖으로 넘칠 수 있음 → **QA 에서 실측**. Low: 말한 뒤 글자로 고쳐 [비교하기] 시 힌트 오표시 가능성·`auxDone` 호환 껍데기·일본어 이중 낭독(가이드가 정한 구조)·조각 수 0 일 때 종료/오늘 카드 규칙 차이·모아 보기 `aria-controls` 가 없는 id(가이드 모양)·인터랙션 시험 없음. 데모와 다른 곳(모범 답안과 같게 말하면 힌트 뺌)은 §37-7 ④-5 와 ⑤ 기존 규칙에 맞음(재승인 불필요).
- 2026-10-21 **감사 B(`rev-081-b`) 턴 한도(60) 도달 — 최종 보고 없이 중단**(이어받기 금지 규칙 — CAN-0017 재발 사례). 중간 기록(`task-081-rev-b-record.md`): `lessonPieces.ts` 불변식 2만 건 무작위 시험 위반 0·40여 건 경계 입력 위반 0·범위 시험 232건 통과, 잠정 발견 **Critical/High/Medium 0 · Low 5 · Low-Med 1**(① `slashMoved` 가 꼬리 정리로 다시 지워지는 이동도 셈(계측만) ② NFD 조각 «같음» 통과 ③ `tutor.md` hunk 2개(§1 한 줄 + §6 표 LESSON 행 `quiz`→`pieces`, LESSON persona 만 §6 영향) ④ 골든 `capturedFrom` 라벨 낡음·`lesson.ts` 주석 10,215 ≠ 실측 10,218 ⑤ A5 `stripAdditionalProperties` 미사용(군더더기 키 1개로 재시도 +40s) ⑥ 하네스 `HARD_CAP`/`MAX_CALLS` 는 실행 1회 상한이고 총량 40회 «강제» 문구는 과장 — 총량은 사람(Leader)이 관리). **남은 4항목만 좁혀 `rev-081-b2` 소환**(상황 경로 주입 표면·screens.md §37-12 ↔ 코드 대조·새 시험 단언 품질·측정 해석 정직성).
- 2026-10-21 **감사 B2(`rev-081-b2`) 결과 — PASS_WITH_NOTES, 이전 잠정 6건과 합쳐 Critical 0·High 0·Medium 2·Low 12, 코드 수정 요구 없음**: 상황 경로 새 주입 표면 없음(사용자 글 user, 조각 지침 system)·A4 일반·상황·붙여넣기는 같은 `lessonInstruction`+`extraCheck`, 복습(A5)은 같은 지침 상수+복사본 `extraCheck`. 측정 수치는 저장된 행에 하네스 `summarize`/`gate` 재실행으로 보고와 일치 확인(G2a 정확히 2/12 통과·G5b 5.88% 불합격 → r2 0/52). **Medium = 문서와 코드 어긋남 8건(D1~D8, 전부 문서 수정)** → Leader 가 `screens.md` §37-12 에서 수정 완료(slash 지우는 조건·옮김 예외 둘·골든 재기록 범위·스키마 `anyOf` 모양·검증 위치 `lessonPieces.ts`·하드 한계 목록·높임 괄호 지침 미탑재·です 붙임 확정 규칙). **사용자 보고에 반드시 넣을 정직성 항목(B2)**: ① G6 1차 67.5% → 2차 75% 는 통계적으로 구분되지 않음(Fisher p≈0.62) ② 정형 인사 오분류는 1/102줄 → 4/52줄로 늘었음 ③ 복습·상황·붙여넣기는 보정 후 각 n=1(회귀 3호출이 뒤를 받침) ④ «호출 21회» 는 재시도를 더하면 CLI 23회 ⑤ 하네스는 실행마다 상한을 걸고 원장으로 사후 집계했으며 40회 한도는 소환 지시와 원장 합산으로 지킴(«하네스가 40회를 강제» 라고 쓰지 않음) ⑥ 눈가림 «열쇠 열기 전 고정» 은 판정자 진술 + 파일 시각(키 파일 atime 이 mtime 과 같아 독립 증명은 못 함).
- 2026-10-21 **Leader QA 완료**(기록 `task-081-qa-record.md`): API 읽기 23(내 기대 오류 4건 정정)·쓰기 27/27·소리 입력 경계·실DB 저장 확인(새 수업 `score null`·StudyLog 문항 키 생략·스냅샷 `score:null` 문항 키 없음·관측 `SENTENCE_PRODUCTION` 만·옛 수업 불변)·실제 Chrome 3폭×글꼴 2단계 79건(1차는 내 도구 결함 3가지로 27 실패 → 도구 수정 뒤 78 통과 + ④ 1건 프로브 통과)·임시 수업·파생 행은 기준선과 대조해 새 행만 삭제. 못 되돌린 것: 계정 3(QA 봇)의 기존 복습 항목 22행이 완료 직후 폴백으로 일괄 갱신(task-081 과 무관한 기존 동작). 못 본 것: 실기기·TalkBack·끝낸 수업의 오늘 카드 «조각 N개»·실서버 AI 생성 수업의 저장·다크/가로/키보드.
- 2026-10-21 **커밋·푸시·운영 배포(사용자 «점검사항 및 배포작업 진행하자»)**: 코드 커밋 `b2b1d14`(82파일·+9,583/-1,152, task-081 파일만 경로 지정 — `.claude/agents/{deployer,leader}.md`·`.codex/**` 는 타 작업이라 제외, 비밀 값 스캔 0) → `git push origin main`(`5af8e7d..b2b1d14`, 16:24 KST) → webhook 자동 배포 → 릴리스 `20261021-162422-b2b1d141`(롤백 대상 `20261021-083046-054be9f8`), `current` 전환 16:25. 운영 확인: 헬스 `status ok`(DB·LLM·STT·TTS 전부 true·`env PRODUCTION`)·pm2 `thekaiwa`·`-speech-gateway`·`-speech-worker` online·재시작 0·새 릴리스 cwd·무인증 `GET /lessons/today`·`POST /lessons/x/audio` 401·로그인 페이지 200·번들에 새 문구(«오늘의 조각 모아 보기»·«조각을 눌러 보세요»·«글자로 쓰기»·«알아들은 말을 그대로 옮겼어요») 포함·옛 «문제 점수 추이»·«수업 문제·말하기 과제» 문구 0. DB 변경 없음·네이티브 변경 없음(APK 재설치 불필요).
- 2026-10-21 **종료** — 사용자 «폰 확인 모두 정상이야»(2026-10-21). 폰 확인 항목 전부 정상 → status done·waiting 비움.

## 최종 요약 (사용자용 — 2026-10-21 Leader 작성, 양식 docs/user-report-format.md §3)

### [task-081] 오늘의 회화 — «문제» 단계를 없애고 «조각» 단계 신설, 응용은 마이크 기본 + 한글 뜻

- **상태**: ⏳ 사용자 확인 대기 (운영 반영 완료)
- **무엇이 바뀌었나**: ① 오늘의 회화 5단계가 이해·문법·**조각**·응용·말하기가 됐다(문제 5개 단계 삭제). ③ 조각에서는 대화 문장을 이름·액션·느낌·꾸밈·표현·연결 6가지 조각으로 나눠 보여 주고, 칸을 누르면 그 조각의 소리와 뜻이 나오며, 「구간 듣기」와 「오늘의 조각 모아 보기」가 있다. ② ④ 응용은 마이크로 말하는 것이 기본이고(서버 인식이 안 되면 글자 입력으로 열림) 말한 내용 아래에 한글 뜻이 함께 나온다. ③ 종료 카드는 새 수업에서 「오늘의 조각 N개」 칸이 생기고(옛 수업은 2칸), 오늘·복습·챌린지 카드의 「문제 c/5」 표기와 챌린지 점수 점이 사라졌다.
- **배포**: ✅ 운영 반영 — 커밋 `b2b1d14` · 2026-10-21 16:24~16:25 KST · push(webhook, blue/green) · 릴리스 `20261021-162422-b2b1d141` · 결과 ok(헬스 ok·pm2 3개 online)
  - 같은 배포에 함께 실린 작업: 없음(이 push 는 task-081 단독, 직전 배포는 task-080 `054be9f8`)
  - 앱 재설치 불필요(웹 배포만, DB 변경 없음, 롤백: `bash scripts/deploy.sh TheKaiwa --rollback` — 서버·화면·프롬프트가 한 릴리스라 부분 롤백 금지)
- **AI 가 검증한 것**: tsc 0·eslint 0·전체 시험 4,844건 중 4,841 통과(실패 0)·reviewer 감사 3갈래 PASS_WITH_NOTES(Critical·High 0)·Leader QA(API 50건·실DB 저장 키·실제 Chrome 폭 3×글꼴 2단계 79건)·운영 헬스/번들/무인증 401. AI 호출 21회로 조각 품질 측정(눈가림 40줄 판정 2차: 틀림 0%·맞음 75%·어색 25%)
  - 검증 못 한 것: 실기기·TalkBack·진짜 마이크 인식·앱(WebView)·끝낸 수업의 오늘 카드 «조각 N개»·실서버에서 AI 가 만든 수업의 저장·다크/가로/키보드
- **👉 사용자가 확인할 것**:
  1. 앱/폰 Chrome → 공부 탭 → 오늘의 회화에서 **새 수업을 하나 만들기**(대기 1~2분) → ③ 조각 단계 — 문장마다 칸(밑줄+이름표)이 나뉘고, 칸을 누르면 그 조각 소리와 뜻이 나오며, 마지막 문장에서 「다음 단계」가 뜨면 정상. 조각 소리가 어색하지 않은지, 130% 글꼴에서 칸이 줄 밖으로 넘치지 않는지도 봐 주세요. (지금부터 가능)
  2. ④ 응용 — 처음부터 마이크 화면으로 열리고, 말한 뒤 일본어·한글 발음·한글 뜻이 상자에 나오는지(앱에서 온디바이스 인식 확인). 마이크가 안 되면 「글자 입력으로 열었어요」 안내가 뜨는지.
  3. 수업을 끝낸 뒤 종료 카드에 「오늘의 조각 N개」 칸이 있고, 공부 탭 오늘의 회화 카드가 «조각 N개 · 말하기 표현 u/t» 로 나오는지, 하던 수업 카드가 «다음은 ③ 조각이에요» 인지.
  4. 성장 탭 → 「단계는 이렇게 정해요」 문구가 바뀐 것(«수업 문제» 가 빠짐) 확인.
  5. 이전에 만든 옛 수업을 열면 ③ 에서 «조각 나누기가 없어요» 안내가 뜨고 바로 다음 단계로 갈 수 있는지.
- **👉 사용자가 알아 두실 것(결정 아님, 변경·한계 공개)**:
  - **조각 종류 표기가 가끔 틀려요** — 특히 「よろしくお願いします」·「一つ」 같은 정형 표현·수량. 눈가림 판정에서 어색 25%(대부분 종류 표기), 틀림 0%였지만 라이브 확인 표본 26줄 중 1줄은 묶음 자체가 틀렸다. 정형 인사 오분류는 보정 뒤 오히려 늘었다(1/102줄 → 4/52줄). 지침 보정은 «です/ですか 분리»·«끊어 읽기가 명사-조사 사이를 가름»·«뜻 풀이» 는 해소했으나 종류 표기는 그대로다. 원인 후보 = `tutor.md` 의 4유형 정의와 조각 6유형의 충돌(확인 안 됨, 페르소나를 또 바꾸면 회화 페르소나 해시가 다시 바뀌어 이번엔 안 건드림).
  - **문형·조사 능력 축은 이제 대화 교정으로만 쌓임** — 문제 단계가 없어져 수업에서 문형 관측이 생기지 않고, 레슨 완료로는 틀린 횟수가 더는 늘지 않는다(복습 후보·AI 평가의 «오답 N회» 재료 감소). 성장 탭 안내 5줄(축 안내 4줄 + 「단계는 이렇게 정해요」 첫 줄)이 이에 맞게 바뀌었다(전 → 후 표는 `task-081-dev-ui4b2-record.md`).
  - **드문 실패**: 조각 규격(조각 하나 40자·뜻 30자·한 줄 24조각 등)을 넘는 극히 드문 경우 수업 생성이 실패해 「다시 만들기」가 필요하다(라이브 21회에서 0건).
  - **조각 소리가 TTS 분당 한도(60)를 쓴다**: 칸을 매우 빠르게 연타하면 429 안내가 뜰 수 있다.
  - 문구 3곳이 가이드 밖에서 바뀜: 생성 대기 «문법과 조각을…»·주제 카드 «표현과 문형»·받침(«③ 조각이에요») — 사용자 승인 없이 글 조각 수준으로 구현(공개).
  - 측정 해석의 한계: 눈가림 판정은 Leader 1인, 1차 67.5% → 2차 75% 는 통계적으로 구분되지 않음, 복습·상황·붙여넣기는 3회 확인뿐.
- **👉 사용자가 결정할 것**: 없음(권고: 폰 확인 뒤 거슬리는 종류 표기가 많으면 후속으로 `tutor.md` 4유형 정의 정리를 별도 개선으로 접수)
- **남은 일**: IMP-0059 는 사용자 폰 확인 뒤 `done`·이력서 `done`. 후속 후보(모두 접수 전): 조각 종류 표기 개선(`tutor.md` 충돌 확인)·출력 스키마 하드 한계 완화 여부·조각을 단어장 «조각» 으로 채택하는 흐름(결정 3 의 후속)·F2 긴 조각 넘침 실측(14자 이상 표본 필요)·`LessonContent` NFD 방어.
- **이슈·위험**: 서버·화면·프롬프트 한 릴리스(부분 롤백 금지). 감사 B 가 턴 한도(60)에서 보고 없이 멈춰 좁혀 다시 소환(CAN-0017 재발 사례 — 이슈 후보 등록은 사용자 지시 시). QA 계정 3(봇)의 기존 복습 항목 22행이 완료 때 폴백으로 갱신돼 되돌리지 못함(영향 없음).

## 배포 기록

| 일시(KST) | 커밋 | 릴리스 | 방식 | 포함 작업 | 결과 | 롤백 대상 |
|---|---|---|---|---|---|---|
| 2026-10-21 16:24~16:25 | `b2b1d14` (`5af8e7d..b2b1d14`) | `20261021-162422-b2b1d141` | git push → webhook 자동 배포(blue/green) | task-081(단독) | 헬스 ok·pm2 3개 online(재시작 0)·무인증 401·번들 새 문구 포함 — 앱 재설치 불필요 | `20261021-083046-054be9f8` |

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (DM-kw-full) | 10-21 10:42 |
| v1 | 검토요청 | docs/demo/task-081-lesson-chunk-step-v1.html | https://claude.ai/artifact/NuAgnjnKLmYYgZ8gAZAR6h | 사용자 검토 요청 | 10-21 11:10 |
| v1 | 승인 | docs/demo/task-081-lesson-chunk-step-v1.html | https://claude.ai/artifact/NuAgnjnKLmYYgZ8gAZAR6h | "권고대로 승인, Q9는 A로" | 10-21 14:01 |
