# task-065 — Reviewer 기록

이력서 본문: [[task-065-improve-menu-copy]] · 개발 기록: [[task-065-dev-record]]

## REV-065-1 (최종) — 판정: **PASS_WITH_NOTES**

감사 대상: light 트랙, `src` 수정 16 + 신규 시험 1 = 17개(미커밋, 69줄 +69/−69). 파일 수가 light 한계(12)를 넘었으나 Leader 가 승격 대신 **전수 대조**로 대체하기로 했고, 아래 「전수 대조」가 그 결과다. 소스·시험·문서는 고치지 않았다(감사 도구는 저장소 밖 스크래치 + 리뷰 전용 미러만 사용, 미러는 스냅샷과 `diff -rq` 로 복구 확인).

| 심각도 | 건수 |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| 정보 | 6 |

데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …/task-065-improve-menu-copy.md` → `DEMO_GATE_PASSED` · `status: not_required`(judge none, `DM-light-waive`). `.claude/state/demo-gate/evidence.jsonl` 에 task-065 줄 0건 — 에이전트가 `approve`·`waive` 를 대신 실행한 흔적 없음. 승인 데모가 없는 문구 작업이라 material/implementation/defect 대조 대상 없음.

### 1. 사용자 지시 충족 — 충족
- 하단 탭 라벨 「공부」: `src/components/shell/TabBar.tsx:16` `label: '공부'`, `href`·`match` 는 `/study/today` 그대로. 「회화」·계획표·단어장·질문 라벨 불변.
- 회화 홈 제목 「자유로운 대화」: `src/app/(app)/study/ai/(tab)/page.tsx:17` 과 `src/components/chat/StudyAiSkeleton.tsx:43`, 둘 다 `<AppBar title="자유로운 대화" />`. `ai/(tab)/loading.tsx` 는 `StudyAiSkeleton` 을 그대로 렌더한다(task-046 짝 규칙 충족).
- `AI와 공부하기` 는 화면 문자열 0건. 남은 3건은 모두 주석(`page.tsx:7`·`StudyAiHome.tsx:4`·`studyAiTabs.ts:2`).

### 2. 전수 대조(핵심) — 누락·오변경 없음
방법: TypeScript 파서로 주석을 걷은 뒤 `src/**/*.ts(x)` 의 `오늘` 포함 줄 **385개 전부**를 목록화해(스크래치 스크립트) 한 줄씩 분류했다. `src` 의 json 3개·css 1개도 확인(css 는 주석 1줄).
- (a) 바뀐 69줄 전부가 「오늘 탭/오늘 화면/오늘로」 즉 **그 탭·화면 자체를 가리키는 말**이다. 기능 이름(「오늘의 단어/회화/복습/표현/평가」)·날짜 표현(「오늘 N/M장」「오늘 푼 장수」「오늘 자정에 마감」「오늘 시작」)·`[오늘 수업 만들기]` 버튼은 바뀐 줄에 없다 → 오변경 0.
- (b) 사용자에게 보이는 문자열에서 `오늘 ?(탭|화면|홈|메뉴|페이지|으로|로)` 잔존 **0건**(시험 이름·설명 12건과 코드 주석 제외 — 화면 비노출). 따옴표로 둘러싼 단독 `'오늘'` 8건은 모두 날짜 자리: `vocab/format.ts:47`·`TodayWordsCard.tsx:246`(세션 날짜)·`lessonCopy.ts:52`(HOME.today, 「오늘 시작」)·`evalCopy.ts:371`(basisRow 날짜)·`CalendarSection.tsx:275`(달력 범례)·`plan/logic.ts:187`·`challenge*`(칸 상태)·`historyQuery.ts`(관리자 필터). 누락 0.
- (c) 문법: 바뀐 문장은 모두 자연스럽다. 「공부」가 겹치는 곳 2건은 Low(아래 L-2).
- 사용자 눈에 보이는 `오늘` 중 이름이 헷갈리는 1건: `eval/evalCopy.ts:83` `START.sub: '오늘'`(AI 평가 시작 화면 소제목, `EvalStartScreen.tsx:129` 의 `BackBar subtitle`). 같은 시리즈 화면 소제목이 `종류 · 레벨`·날짜이고 탭 이름 자리가 아니라서 **날짜 표기로 보고 유지가 합리적**이다(승인 데모 `task-011` 도 `'오늘'`). 확신: [가능성 높음] — 문서만으로 판별 불가, 사용자가 탭 이름이라고 보면 한 글자 수정.

### 3. 서버 메시지·프롬프트·API 응답 — 불일치 없음
- `src/modules/**` 비주석 `오늘` 중 「오늘 탭/화면」류는 0건 — 서버 쪽은 일일 한도(「오늘은 …더 만들 수 없어요」)·`오늘의 회화/복습` 요약·`[오늘] 날짜` 프롬프트 헤더뿐이라 클라이언트만 바꿔도 어긋나지 않는다.
- LLM이 읽는 곳(`.claude/agents/tutor.md`·`prisma/seed.ts`·`src/modules/conversation/prompts/**`)에 탭 이름을 가리키는 문구 없음 → 선생님 응답이 옛 이름을 말할 경로 없음.

### 4. 로딩 자리표시 = 실제 화면 제목 — 일치
- 회화 홈: page `자유로운 대화` = `StudyAiSkeleton` `자유로운 대화`(신규 시험이 잠금).
- 공부 홈(`/study/today`): `today/(tab)/page.tsx:21` = `vocab/TodaySkeleton.tsx:50` = `오늘의 공부`(Leader 유지 결정, `todaySkeleton.test.ts:70` 이 `<h1>오늘의 공부</h1>` 잠금). 일치.
- 뒤로 글자(`공부로`)는 상수(`evalCopy`·`lessonCopy`·`reviewCopy`·`topicCopy`)와 인라인(`VocabDeck`·`VocabResult`·`VocabSessionScreen`)에서 모두 한 단어로 통일, 대기·생성 화면(`WAIT.back/today`, `GEN.backToday`)도 같은 글자.

### 5. 시험
- `challenge/__tests__/logic.test.ts` diff 대조: 옛 `오늘 탭에서 …` 단언 7줄(문자열 7개)만 1:1로 `공부 탭에서 …` 로 바뀌었고, 단언 개수·`equal`/`deepEqual` 종류·나머지 인자 불변 → **약화 없음**. 시험 이름의 「링크는 오늘 탭」은 설명이라 그대로(화면 비노출).
- 신규 `shell/__tests__/menuCopy.test.ts`(2개): `readCode`(= 주석 제거 소스, `src/components/__tests__/sourceCode.ts`)로 읽는다. 탭 라벨은 `href→label` 5쌍을 `deepEqual`, 제목은 `<AppBar title="…">` 전수를 뽑아 `['자유로운 대화']` 와 skeleton 일치를 확인한다(식이 `{TITLE}` 로 바뀌면 `[]` 가 되어 실패 — 조용히 통과하지 않음).
- **변이 재현 7건(리뷰 미러 `~/.node-local/thekaiwa-rev065`, 끝난 뒤 `diff -rq` 로 스냅샷과 동일 확인)** — 모두 시험이 잡았다:
  | 변이 | 결과 |
  |---|---|
  | M1 `TabBar` 라벨 공부→오늘 | menuCopy 1 fail |
  | M5 `/study/today` 탭 줄을 `//` 주석 처리 | menuCopy 1 fail |
  | M6 계획표 탭 라벨도 「공부」 | menuCopy 1 fail |
  | M2 `StudyAiSkeleton` 제목 옛 문구 | menuCopy 1 fail |
  | M3 `page.tsx` 의 `AppBar` 를 `{/* … */}` 로 주석 처리 | menuCopy 1 fail(주석 코드가 통과하지 않음) |
  | M3b `page.tsx` 는 옛 제목, 새 제목은 주석 안에만 | menuCopy 1 fail |
  | M4 `challenge/logic.ts` 한 줄을 옛 `오늘 탭에서 이어서` 로 | logic.test 1 fail |
- 커버리지 한계(정보 I-1): M7(`evalCopy.ts` `back: '공부로'`→`'오늘로'`)·M7b(`VocabDeck` `backLabel`)는 해당 폴더 시험(eval 42·vocab 176)이 **전혀 잡지 못했다** — 탭 라벨·회화 제목 외 문구 약 60줄은 어떤 시험도 지키지 않는다.

### 6. 규칙·경계 — 위반 없음
- 엔진명·`model_id`·`speaker_id`·Secret 문자열: diff·신규 시험에 0건. 보이지 않는 유니코드(ZWSP·BiDi·BOM·소프트하이픈) 0건.
- 변경은 `src` 16(+신규 시험 1)뿐. 서버·API·스키마·`docs`·`android`·`plugins`·`capacitor.config.ts` 변경 0, 범위 밖 파일 0(같은 작업트리의 task-064 데모·vault 변경은 감사 제외). 6층 import 변경 없음. **native_change: false** → `versionCode` 증가·APK 재빌드 불필요(앱은 `server.url` 로 운영 웹을 로드 — 웹 배포 전에는 앱에도 안 보인다).

### 7. 알릴 부작용(사용자가 놀랄 수 있는 변화)
- 챌린지 할 일 줄 버튼·읽기 이름: 「공부 탭에서 하기/이어서/보기/시작/다시」, 계획표 달력 빈 상태 CTA 「공부 탭으로」, 챌린지 결과 안내 「공부 탭 ›」. 뒤로 글자 「공부로」(「공부로 돌아가기」 포함) 22곳.
- 접근성 이름: 하단 탭 링크 이름 「오늘」→「공부」, 챌린지 줄 `aria` 끝말 「…공부 탭에서 하기」. `nav aria-label="주 메뉴"` 불변.
- 이름 불일치 가능성(Leader 결정 유지): 탭 「공부」 ↔ 화면 제목 「오늘의 공부」 ↔ 뒤로 「공부로」.
- `src` 밖 남은 「오늘」: `public/manifest.webmanifest` 는 `start_url: /study/today`(라우트, 문구 아님)뿐 · `android/**`·`capacitor.config.ts` 에 탭 이름 문구 없음 · 앱 알림/푸시 문구 없음. `docs/` 에는 옛 이름이 `AI와 공부하기` 9건·`오늘 탭` 51건·`오늘로` 32건·`오늘 홈` 55건 남아 있고(`docs/screens.md` 등, **Leader 몫**), `CLAUDE.md`·`.claude/agents/designer.md:42` 의 탭 목록도 옛 이름이다.

### 스냅샷 게이트 대조(Leader 스냅샷 `/tmp/claude-1000/rev065/`, `head=2e02ed8 overlay_files=17 skipped_foreign_count=0`)
- 결과 파일 직접 확인: `sync=0 tsc=0 eslint=0 test=0 build=0 DONE`.
- tsc: `tsc.log` 0바이트(오류 0) = developer 보고와 일치.
- eslint: `✖ 5 problems (0 errors, 5 warnings)` = developer 보고와 일치. 경고 5건은 이 task 가 건드리지 않은 `DiagnosticsScreen`·`LearningSettings`·`OnDeviceDiagnosticsCard`·`SpeechSettings`·`VoiceSettings` 의 `react-hooks/set-state-in-effect`(기존).
- 시험: `# tests 3368 · pass 3367 · fail 0 · skipped 1`(전체 `src`+`scripts/seed-build`). developer 의 「1,292/1,292」는 `src/components` 만이라 **범위가 달라서 숫자가 다르다**(모순 아님). 신규 2개(`ok 788`·`ok 789`)가 실행·통과. 건너뜀 1건은 `#9 실제 배포 manifest(speech/models/reazonspeech-int8)` — 「저장소 speech/models 가 없는 실행 위치(미러)」 사유의 기존 환경 skip, 이 task 와 무관.
- build: `✓ Compiled successfully in 5.9s`, `Finished TypeScript`, 종료 0. 경고 3건은 기존 `Dynamic filesystem access`(persona/loader·claudeCli) — 이 task 무관, developer 보고와 일치.

### 발견 목록
- **L-1 (Low)** `tests/live/task043-screens.ts:134`·`tests/live/p2a-qa/task043-screens-x.ts:141` 가 `expect: ['만들지 못했어요', '오늘 탭에서 다시']`, `tests/live/p2b-qa/challenge-today-live-ui.ts:389` 가 `getByRole('link', { name: '오늘로' })` 를 쓴다. 수동 라이브 스크립트라 게이트에 안 걸리지만 다시 돌리면 실패한다(근거: 이번에 바뀐 `challenge/logic.ts` 의 `go='공부 탭에서 다시'`·`topicCopy.ts` `WAIT.today='공부로'`). 권고: 해당 문자열을 새 문구로 갱신(후속 정리, 이 task 필수 아님). `task010-ui-e2e.mjs:263` 은 설명 글자뿐이라 영향 없음.
- **L-2 (Low)** 「공부」 겹침 2곳 — `src/components/challenge/challengeCopy.ts:177`·`src/components/challenge/logic.ts:508` 「같은 주제면 공부 탭 어디서 공부해도 인정돼요」. 뜻은 맞지만 어색하다. 권고: 「같은 주제면 공부 탭 어느 화면에서 해도 인정돼요」처럼 앞/뒤 한쪽 교체. `src` 전체에서 이 문장을 단언하는 시험은 없고(`grep` 확인) 두 파일의 상수 2곳만 바꾸면 된다.
- **I-1 (정보)** 새 시험은 탭 라벨·회화 제목만 잠근다. 안내문·뒤로 글자 60여 줄이 되돌아가도 잡히지 않는다(M7·M7b). 선택 권고: `readCode` 로 `src/components/**` 비주석 소스에 `오늘 탭|오늘 화면|오늘로` 가 0건임을 단언하는 시험 1개.
- **I-2 (정보)** `evalCopy.ts:83` `START.sub: '오늘'` — 위 2절. 유지 권고(날짜 표기로 판단).
- **I-3 (정보)** `chat/StudyAiHome.tsx:60`·`StudyAiSkeleton.tsx:46` `Segmented ariaLabel="공부 방식"` — 화면 읽기 도구가 회화/채팅/상황 전환을 「공부 방식」이라 읽는데 새 하단 탭도 「공부」다. 디자인 판단이라 감사 결함으로 보지 않고 Leader 를 거쳐 designer 에게 넘긴다.
- **I-4 (정보)** 문서의 옛 이름(위 7절 건수)은 Leader 가 정리한다. developer 는 `src/**` 만 건드리라는 설계 6번을 지켰다.
- **I-5 (정보)** 탭 「공부」 ↔ 화면 제목 「오늘의 공부」 ↔ 뒤로 「공부로」 공존은 Leader 결정이다. 사용자가 어색하다고 하면 `today/(tab)/page.tsx`·`TodaySkeleton.tsx`·`todaySkeleton.test.ts` **세 파일을 같이** 바꿔야 로딩→실화면 깜빡임이 없다(developer 후보 1과 동일, 근거 확인).
- **I-6 (정보)** `20-Log/2026-10-12.md` 는 task-064 변경이 섞여 있어 이 감사에서 한 줄을 덧붙이지 않았다 — Leader 가 `→ [[task-065-improve-menu-copy]]` 색인을 남겨 달라.

### high_risk_areas / 다음 단계
- QA 없음(light). Leader 판단 항목: L-2 문장 손질 여부, L-1 후속 정리 task 여부, I-3 designer 전달 여부, 문서 정리.
- Sonnet developer 반려 횟수: 0회(이번이 첫 감사).

PASS_WITH_NOTES
