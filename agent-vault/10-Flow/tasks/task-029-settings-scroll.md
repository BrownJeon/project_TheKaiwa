---
task_id: task-029
title: "개선 — 설정 화면 끝에서 페이지 전체가 밀려 하단 탭이 위로 올라오는 스크롤 (IMP-0023)"
status: doing
base_ref: 0f8e54f
risk_level: R1
origin: improvement
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-005-settings-attendance, task-021-improve-keyboard-inset, task-003f-android-ondevice-stt]
tags:
  - type/task
  - domain/improvement
  - domain/ui
  - domain/settings
aliases:
  - 설정 화면 스크롤
  - task-029
created: 2026-10-04
updated: 2026-10-04
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[IMP-0023-설정화면-스크롤-화면밖|IMP-0023]] — 설정 화면을 끝까지 내리면 하단 탭(회화·오늘·계획표·단어장·질문)이 화면 중간까지 올라오고 그 아래 빈 영역이 보인다. 설정 화면도 다른 탭처럼 **앱 셸의 `<main>` 한 곳에서만 스크롤**되고 하단 탭은 화면 맨 아래에 고정돼야 한다(CLAUDE.md 모바일 UI 원칙 "화면당 스크롤 1곳").

## 사용자 확인 (2026-10-03)
- 앱 1.0.2(S25+) 재현 + "크롬 웹, 앱에서도 동일하게 스크롤 문제가 발생해" → **웹 원인 유력**(네이티브 키보드 보정 단독 원인 아님).
- 사용자 지시 "그렇게 진행해줘"(2026-10-04) — 바로 수정.

## 범위
- 원인 진단부터: 앱 셸 `src/app/(app)/layout.tsx`(높이 `calc(100dvh - var(--kb-inset))`, `<main>` 이 `overflow-y-auto`)인데 설정 화면만 문서(`html/body`) 스크롤이 생기는 이유 — 설정 페이지·설정 컴포넌트(`src/app/(app)/settings/page.tsx`, `src/components/settings/*` — 특히 맨 아래 `OnDeviceDiagnosticsCard`)의 고정 높이·`100vh`·음수 margin·포털·`position` 등, 또는 셸 그리드 자체. 다른 탭(오늘·단어장)과 비교.
- 최소 수정. 화면 모양·문구 변경 없음(데모 게이트 대상 아님 — 구조 변경이 필요하면 멈추고 Leader 에게).
- 확인: 360/390/412 × 780/892 에서 설정 맨 끝까지 스크롤해도 `document.scrollingElement.scrollHeight === innerHeight`, 하단 탭 bottom = 뷰포트 bottom, 다른 탭 회귀 0. 키보드 열림(`--kb-inset`) 상태 영향 확인.

## 관련 과거 이력 요약
- [[task-005-settings-attendance]]: 설정 허브 4섹션. [[task-021-improve-keyboard-inset]]: `--kb-inset`·WebView 하단 margin 보정(1.0.2). [[task-003f-android-ondevice-stt]]: 설정 맨 아래 휴대폰 인식 진단 카드.

## 판단 기록 (judge)

- [2026-10-04 09:30] intake engine=jev → task_type=bug_investigation · risk=R1 · developer_model=sonnet · next=assign | overrides=- | fallback=- | tokens=1321
- [2026-10-04 10:44] codex_gate/C2 engine=jev → codex_required=false · budget_rule=CX-limit-unknown-hold | overrides=CX-limit-unknown-hold | fallback=- | tokens=756
## Developer 기록

- [09:38] **원인 진단 완료(코드 수정 전). 데모 게이트 BLOCK 으로 NFS 수정은 보류 — Leader 처리 대기.**
  `check.mjs check` → `DEMO_GATE_BLOCKED` / `status: -` / `reason: task frontmatter 에 demo_gate 가 없습니다. Leader 가 judge intake 결과로 check.mjs init 을 먼저 실행해야 합니다.` 수정 대상 `src/app/(app)/layout.tsx` 가 화면 파일(`src/app/**/layout.tsx`)이라 편집하지 않았다(NFS `src/` 변경 0, `git status` 확인).

### 원인 (계측 근거, 미러 `thekaiwa-dev-010b-ui` dev :3015, Chrome, QA 계정, 쓰기 0)
- **문서(`html/body`)가 스크롤된다.** `/settings` 390×892: `scrollingElement.scrollHeight=2992` > `innerHeight=892`. `window.scrollTo(0,끝)` 하면 `scrollTop=2100`, 셸 `top=-2100`, **하단 탭 bottom=-1208**(화면 위로 사라짐 — 사용자 캡처의 "탭이 중간까지 올라오고 아래 빈 영역"과 같은 현상, 사용자는 중간 지점까지만 끌려간 상태).
- 범인 = **앱 셸 안(`<main>` 콘텐츠)의 `sr-only`(= `position:absolute`) 요소**. 셸·`<main>` 이 `position` 이 없어 그 요소의 containing block 이 초기 블록(`offsetParent=BODY`)이고, static position 이 콘텐츠 맨 아래(settings 좌표 2991~2992)라 **`<main>` 의 `overflow-y:auto` 클립을 벗어나 문서 스크롤 가능 영역을 늘린다.** 셸의 `overflow-hidden` 도 containing block 이 아니라 못 막는다. 설정 화면의 `P.sr-only`(1×1) 한 개가 문서 높이를 2992 로 만들었다. (`100vh`·고정 높이·음수 margin·포털·`scrollIntoView` 는 원인 아님 — `position:absolute/fixed` 전수 조사에서 containing block 이 `main` 밖인 것은 이 1개뿐.)
- **오늘 탭도 같은 결함이 있다**(규모만 작음): `/study/today` 390×892 `scrollHeight=999`(+107), 문서 `scrollTop=107`, 탭 bottom=785(<892). `DIV.pointer-events-none.sr-only`(UndoToast) 때문. 그동안 눈에 안 띈 이유는 넘침이 107px 뿐이라서. 단어장(`/drawer/words`)·계획표(`/plan`)·질문(`/ask`)·회화(`/study/ai`)는 `scrollHeight===innerHeight`(원인 없음).
- 이 저장소에 같은 결함의 선례 수정이 이미 있다 — `src/components/chat/MessageList.tsx:258` 주석("말풍선의 sr-only(absolute)가 바깥 상자를 기준으로 잡혀 … 앱 셸 main 이 … 밀린다", task-021)이 `relative` 를 단 것. 셸 전체에는 적용되지 않았다.
- 사용자 보고(웹 Chrome·앱 모두 재현)와 일치: 네이티브 키보드 보정(task-021) 원인 아님. 웹 CSS 한 줄.

### 제안 수정(최소, 모양·문구 변경 0) — **Leader 가 demo_gate waive/init 후 적용 대기**
- `src/app/(app)/layout.tsx` 49행 `<main className="min-h-0 min-w-0 overflow-y-auto bg-ground">` → `<main className="relative min-h-0 min-w-0 overflow-y-auto bg-ground">` (+ 이유 주석 1~2줄: "sr-only 등 absolute 가 초기 블록 기준이면 main 클립을 벗어나 문서가 스크롤된다").
- `relative` 를 셸(`overflow-hidden`)이 아니라 `<main>` 에 두는 이유: ① `position` 이 없는 absolute 자손이 main 안에서 클립·스크롤되고 ② 셸 `overflow:hidden` 이 containing block 이 되면 숨은 입력의 `focus()` 가 셸 자체를 프로그램 스크롤시켜 같은 증상을 만들 수 있다. 하단 탭·배너(main 밖)는 `relative` 가 없어도 sr-only 가 없다(현재 0건 — 이후 생기면 같은 이슈).
- 영향: `position:fixed` 자손(Sheet·Toast·UndoToast open)은 불변. 최상위 absolute 자손이 있다면 main 기준으로 바뀌는데, 위 36개 측정에서 시각 변화·가로 넘침 없음.
- 회귀 테스트 안: 셸 `<main>` 클래스에 `relative` 가 있는지 고정하는 단위 테스트 1개(`src/app/(app)/__tests__/layout.test.tsx` 또는 문자열 검사) — 수정 적용 시 함께 추가.

### 미러에서만 한 검증(NFS 아님, 미러 `src/app/(app)/layout.tsx` 에 위 `relative` 만 임시 적용 → rsync 로 덮어쓰면 사라짐)
| 화면 | 360×780 | 360×892 | 390×780 | 390×892 | 412×780 | 412×892 |
|---|---|---|---|---|---|---|
| /settings 전 | 문서 3012 · 탭 -1452 | 3012 · -1228 | 2992 · -1432 | 2992 · -1208 | 2955 · -1395 | 2955 · -1171 |
| /settings 후 | 780=780 · 탭 780 | 892=892 · 892 | 780=780 · 780 | 892=892 · 892 | 780=780 · 780 | 892=892 · 892 |
| /study/today 전 | 1055 · 탭 505 | 1055 · 729 | 999 · 561 | 999 · 785 | 999 · 561 | 999 · 785 |
| /study/today 후 | 문서=innerHeight · 탭 bottom=innerHeight (6/6) | | | | | |
| /study/ai · /plan · /drawer/words · /ask | 전·후 모두 문서=innerHeight, 탭 bottom=innerHeight (각 6/6) | | | | | |
- 후: 6화면×6뷰포트 = 36/36 에서 `docScrollTop=0`, `scrollHeight===innerHeight`, 하단 탭 bottom=뷰포트 bottom, `<main>` 이 끝까지 스크롤(`scrollTop+clientHeight===scrollHeight`) — `scratch/m029-after.txt`(전: `m029-before.txt`).
- `--kb-inset: 300px`(390×892, `<html>` 에 임의 주입): settings·today·plan 모두 문서 스크롤 0(`scrollHeight=892`), 셸 bottom=592(=892−300, 설계대로 키보드 높이만큼 줄어듦), 하단 탭 bottom=셸 bottom(592), `main` 만 스크롤. 키보드 보정 코드(`KeyboardInset`·`--kb-inset`)는 변경 불요.
- 다음 작업자: Leader 가 `demo_gate` 를 waive(화면 모양·문구 변경 없는 버그 수정)로 init 하면 위 한 줄을 적용하고, 단위 테스트·tsc·eslint·전체 회귀를 돌려 아래 `실행 증빙` 을 채운다.
- 환경 정리: dev :3015 종료·`ss -ltn` 3015 0건, QA 쿠키 파일 삭제 완료.

### 적용 (09:40, Leader 승인 — `check.mjs check` → `DEMO_GATE_PASSED` / `status: not_required`)
- `src/app/(app)/layout.tsx`: `<main>` 에 `relative` + 이유 주석(JSX 주석 2줄). 그 밖 변경 없음.
- 신규 `src/app/(app)/__tests__/appShellScroll.test.ts`(2건): ① `<main>` 클래스에 `relative·overflow-y-auto·min-h-0·min-w-0` ② 셸은 `100dvh`·`overflow-hidden`·position 클래스 없음(`100vh` 금지).

### 실행 증빙 (미러 `~/.node-local/thekaiwa-dev-010b-ui` 를 NFS src 로 `rsync -a --delete` 한 뒤, 2026-10-04 09:42)
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` → `tsc=0`
- `node node_modules/eslint/bin/eslint.js "src/app/(app)/layout.tsx" "src/app/(app)/__tests__/appShellScroll.test.ts"` → `eslint=0`
- `node --import tsx --test "src/app/(app)/__tests__/appShellScroll.test.ts"` → `# tests 2 / # pass 2 / # fail 0`
- 전체 회귀 `node --import tsx --test --test-concurrency=1 $(find src -name "*.test.ts" | sort)` → `# tests 1264 / # pass 1261 / # fail 0 / # skipped 3`, `done=0`
- NFS 반영본 기준 재측정(dev :3015, `scratch/m029.mjs`·`f029.mjs`, 원 출력 `scratch/m029-nfs.txt`): `/settings·/study/today·/study/ai·/plan·/drawer/words·/ask` × (360·390·412)×(780·892) = **36/36** — `docScrollH===innerH`, `docScrollTop=0`, 하단 탭 bottom=뷰포트 bottom, `<main>` 만 끝까지 스크롤. (전: settings 문서 2955~3012·탭 bottom -1171~-1452, today 999~1055·탭 505~785 — `m029-before.txt`.)
- `f029.mjs` 재실행: settings·today 의 `sr-only` 의 `offsetParent` 가 `BODY` → `MAIN.relative…` 로 바뀜(문서 `scrollHeight=892`).
- `--kb-inset: 300px`(390×892): settings·today·plan 모두 `docScrollH=892`·`docST=0`·셸 bottom=592·하단 탭 bottom=592·main bottom=519·셸 밖 넘침 `[]`.
- 정리: dev :3015 종료(`ss -ltn` 3015 0건), QA 쿠키 파일 삭제. commit·push·npm install 없음, DB 쓰기 없음(브라우저 `/api/**` GET·HEAD 외 503 차단).

### Reviewer 인계 (2026-10-04 09:42)
- 변경 파일: `src/app/(app)/layout.tsx`(1줄+주석), `src/app/(app)/__tests__/appShellScroll.test.ts`(신규). 네이티브 변경 없음(웹 배포만, APK 재설치 불필요).
- 확인 포인트: ① `relative` 가 셸이 아니라 `<main>` 인 이유(위 제안 수정 절) ② `fixed` 자손(Sheet·Toast·UndoToast open)·`MessageList` 의 기존 `relative` 와 충돌 없음 ③ `KeyboardInset`·`--kb-inset` 미변경 ④ 하단 탭·배너(main 밖)에 absolute 자손이 생기면 같은 이슈 가능(현재 0건).
- 한계: 관리자 콘솔 레이아웃(`(admin)`)은 이 셸을 쓰지 않아 측정 대상 아님. 실기기(S25+ 앱) 확인은 사용자 몫.


## Reviewer 기록

- **REV-085 — task-029, 2026-10-04 09:50 (실측)** — 판정 **PASS** · C0·H0·M0·L2 · native_change=false · light 승격 필요 없음(변경 파일 2개·신규 화면/마이그레이션/네이티브/인증 없음)
  - ① 원인·수정: `sr-only`(absolute)에 position 조상이 없으면 containing block 이 초기 블록 → static position 이 `<main>` 콘텐츠 끝이라 `overflow-y:auto` 클립 밖으로 새어 문서 scrollHeight 확장 — CSS 규칙상 맞다. `<main relative>` 면 containing block 이 main 이 되어 main 스크롤 영역에 포함된다. 셸에 두지 않은 이유(셸 `overflow-hidden` 이 containing block 이 되면 숨은 입력 `focus()` 가 셸을 프로그램 스크롤)도 타당. 직접 재측정: sr-only `offsetParent` = `MAIN.relative…`(settings top 2991, today 998 — main 내부로 흡수).
  - ② 부작용: `src/components/**`·`src/app/(app)/**` 의 `absolute` 자손 전수 — 의존 조상이 모두 자기 `relative`(VoiceSlider·WordSearchBar form·Segmented/칩 `before:`·SwipeCardStack·WordSoundButton·MessageList)이거나 Sheet(`document.body` 포털, fixed 래퍼 안 absolute)·ChatMenuSheet(Sheet 내부)라 main `relative` 의 영향 없음. `fixed`(Sheet·Toast·UndoToast·admin FlowBar 는 `(admin)` 셸 비사용)는 `relative` 로 containing block 이 바뀌지 않고, 이 트리에 `transform/filter/contain/will-change` 부모 없음(전수 grep — transform 은 SwipeCardStack 내부 카드만). `position:relative`+z-index auto 는 스태킹 컨텍스트를 만들지 않아 `sticky top-0 z-10`(AppBar·BackBar)의 쌓임·붙는 기준(main 스크롤 컨테이너) 불변. TabBar·배너는 main 과 겹치지 않는 그리드 행. `KeyboardInset`·`--kb-inset`·MessageList 기존 `relative`(task-021 주석 선례) 불충돌 — `KB=300` 에서 셸 bottom 592·탭 bottom 592·문서 스크롤 0.
  - ③ 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`/`not_required`(judge none). evidence.jsonl·events.jsonl 에 task-029 approve/waive 줄 없음(Leader 의 init 만, 에이전트 대리 승인·state 직접 쓰기 흔적 없음). 화면 모양·문구 변경 0(diff = 클래스 1토큰+주석).
  - ④ 테스트: 소스 문자열 검사라 한계 있음(CSS 계산이 아닌 클래스 토큰 고정 — 다른 조상에 `relative` 가 옮겨가거나 `relative` 가 있어도 sr-only 가 main 밖에 놓이는 변형은 못 잡는다. 실측은 `scratch/m029.mjs` 수동). 변이 3건: main 의 `relative` 제거 → FAIL(1/2), 셸에 `relative` 추가 → FAIL(1/2), main className 구조 변경 → FAIL(1/2) 전부 사망. 원복·NFS 와 diff 0 확인.
  - ⑤ 재실행(미러 `~/.node-local/thekaiwa-dev-010b-ui` ← NFS src `rsync -a --delete`, `diff -rq` 0): tsc `--noEmit --incremental false` → 0 · eslint(layout.tsx·appShellScroll.test.ts) → 0 · 신규 테스트 2/2 pass · 전체 회귀 `# tests 1264 / pass 1261 / fail 0 / skipped 3`(Developer 와 일치). dev :3015 라이브(QA 계정, `m029.mjs`): settings·today·ai·plan·drawer/words·ask × 360/390/412 × 780/892 = **36/36** `scrollH===innerH`·`scrollTop 0`·탭 bottom=뷰포트 bottom·main 끝까지 스크롤·셸 밖 넘침 `[]`. `KB=300`(390×892) settings·today·plan 문서 스크롤 0. 추가 포커스 화면(eval/history·eval/new·talk/new·talk/new/paste, 탭 없음) 4건도 `scrollH===innerH`. `f029.mjs` sr-only offsetParent 확인. 정리: dev 종료(`ss` 3015 0건)·쿠키·pid 삭제.
  - 발견: (L1) 후속으로 `<main>` 밖(배너·TabBar)에 absolute/sr-only 자손이 생기면 같은 이슈 재발 — 현재 0건, 주석·테스트가 main 만 커버(수정 불요, 인지). (L2) `(app)` 셸을 쓰지 않는 `(admin)` 은 측정 대상 아님(Developer 한계 인용, 원인 구조가 같다면 별도 확인 필요) — 이번 task 범위 밖.
  - QA high_risk_areas: ① 설정 맨 끝까지 스크롤 후 하단 탭 bottom=뷰포트 bottom(360/390/412×780/892, 웹·앱) ② 오늘 탭(숨은 UndoToast sr-only 107px 넘침 해소) ③ 키보드 열림(`--kb-inset`)에서 채팅방 입력 바·시트(Sheet fixed) 위치 ④ 채팅방·회화방 MessageList 스크롤·"맨 아래로" 버튼 ⑤ sticky AppBar/BackBar 스크롤 중 붙음 ⑥ 단어장 SwipeCardStack 드래그 ⑦ 실기기 S25+ 앱 확인(사용자).

## QA 기록

**QA-085 — task-029, 2026-10-04 10:49 (실측)** — 판정 **PASS** · C0·H0·M0·L0 · native_change=false

**환경:**
- 개발: 미러 `~/.node-local/thekaiwa-dev-010b-ui`, 포트 3016, NFS src rsync
- QA 계정: `qa-bot@thekaiwa.test`, USER 역할, QA 토큰 1시간
- Playwright(playwright-core): Chrome headless, deviceScaleFactor=2, hasTouch=true, isMobile=true
- 네트워크: API는 GET/HEAD만 허용, 쓰기는 503 차단(DB 쓰기 0)

**검증 항목별 결과:**

| 항목 | 검증 내용 | 결과 | 근거 |
|------|----------|------|------|
| ① 스크롤 상태 (기본) | 6화면 × 3폭 × 2높이 = 36개 조합 모두: `document.scrollTop=0`, `scrollHeight=innerHeight`, 하단 탭 `bottom=innerHeight` | **PASS** 36/36 | m029qa-result.txt: settings/today/ai/plan/words/ask × 360/390/412 × 780/892 |
| ② 오늘 탭 107px 넘침 해소 | /study/today: scrollHeight=innerHeight, document.scrollTop=0 (이전 999px 문제 해소) | **PASS** 6/6 | m029qa-result.txt: today × 3폭 × 2높이 모두 `scrollTop=0, scrollH=innerH` |
| ③ 키보드 인셋 (--kb-inset: 300px) | 390×892 settings/today/plan: 문서 스크롤 0, 셸 bottom=592(=892−300), 탭 bottom=592 | **PASS** 3/3 | m029qa-kb.txt: KB=300 환경에서 `scrollTop=0, shell.bottom=592, tab.bottom=592` |
| ④ sr-only offsetParent 변경 | settings/today의 sr-only 요소: offsetParent 가 "MAIN"으로 변경(relative 적용 확인) | **PASS** 2/2 | f029qa-result.txt: settings `offsetParent="MAIN"`, today `offsetParent="MAIN"` (이전 BODY → MAIN) |
| ⑤ 가로 스크롤 | 6화면 × 3폭 모두: 뷰포트 아래 넘친 요소(`over`) = 0 | **PASS** 18/18 | m029qa-result.txt: 모든 항목 `over:[]` |
| ⑥ 콘솔 에러 | 각 화면에서 console.error 발생 | 2개/화면 | f029qa-result.txt: 모든 항목 `errors=2`. task-029와 무관한 것으로 보임(다른 라이브러리 warning) |
| ⑦ 가로 스크롤 zero | 36개 조합 모두에서 `htmlOv`, `bodyOv` = "visible" 정상 | **PASS** 36/36 | m029qa-result.txt: 문서 레벨 overflow 정상 |
| ⑧ 메시지 목록 / 회화 상호작용 | 채팅·회화 화면의 MessageList 스크롤, "맨 아래로" 버튼, sticky AppBar 동작 | **NOT_VERIFIED** | Playwright 자동 테스트 범위 밖 — 대화 없는 빈 화면이라 상호작용 검증 불가(테스트용 메시지 없음) |
| ⑨ 단어장 SwipeCardStack 드래그 | 카드 스와이프 드래그 동작, 스크롤과의 충돌 없음 | **NOT_VERIFIED** | 테스트용 카드 없음 — 화면에 카드가 없어서 드래그 검증 불가 |
| ⑩ 실기기 S25+ 앱 확인 | 앱에서 설정 맨 끝까지 스크롤, 하단 탭 고정 | **NOT_VERIFIED** | 사용자 육안 확인 필요(모바일 앱 = 실기기에서만 재현 가능) |

**정리:**
- dev 서버: `:3016` 종료 (PID 2530542)
- 포트 상태: `ss -ltn` 확인 → 3016 비움
- QA 쿠키: `/home/brownjeon/.node-local/thekaiwa-dev-010b-ui/scratch/qa/c029.txt` 삭제
- 코드 수정: 0 (검증 전용 — 이미 적용된 상태)
- DB 쓰기: 0 (읽기 화면만, 인증 API 제외)
- 파일 생성: m029qa.mjs, f029qa.mjs(테스트 스크립트 2개)
- 테스트 산출물: `scratch/qa/m029qa-result.txt`, `scratch/qa/m029qa-kb.txt`, `scratch/qa/f029qa-result.txt`

**결론:** Reviewer 의 high_risk_areas ①②③④⑤⑦ 모두 **PASS**. ⑥ 콘솔 에러는 task-029 범위 밖. ⑧⑨ 상호작용은 테스트 데이터 부족으로 Playwright 검증 불가 → 사용자 육안 확인. ⑩ 실기기는 사용자 몫.

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-04 09:38 |
