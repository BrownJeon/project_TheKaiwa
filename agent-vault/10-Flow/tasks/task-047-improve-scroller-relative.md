---
task_id: task-047
title: "안쪽 스크롤 상자 위치 기준(relative) 누락 전수 점검·보정 — 앱 셸 main 이 같이 스크롤되는 잠복 결함 (IMP-0023 계열)"
status: done-deploy-pending
base_ref: 23e08b9
risk_level: "R1"
roles_involved: [leader, judge, reviewer, developer, qa]
related_tasks: [task-029-settings-scroll, task-045-improve-topic-scenario-manager, task-046-improve-tab-loading-flicker]
imp: []
tags:
  - type/task
  - domain/improvement
  - domain/ux
aliases:
  - 스크롤 상자 relative
  - task-047
created: 2026-10-10
updated: 2026-10-10
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-light-waive"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-047 — 안쪽 스크롤 상자 `relative` 누락 전수 점검·보정

## 사용자 요청 (원문)
- 2026-10-08: 「다음 작업 이어서 진행해줘」 → 다음 작업 후보를 질문(AskUserQuestion)했을 때 **010d 데모 게이트 정리**를 먼저 고르셔서 그것을 끝냄(면제 기록 완료). 그 질문에서 같이 물은 「스크롤 상자 작업을 고른 경우 데모를 건너뛸까요」에 「데모 면제」로 답했으나 **선택지 답이라 발화 증거가 아니다**(도구가 인정하지 않음) — 이 답을 면제로 쓰지 않는다.
- 2026-10-10: 「푸시하고 다음 작업 이어서 진행해줘」 → 보류해 둔 이 작업(Leader 권고 1순위)에 착수.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **IMP-0023 / task-029**: 설정 화면을 계속 내리면 하단 탭까지 위로 밀려 화면 밖 빈 영역이 보임(웹·앱 모두 재현) → 앱 셸 `<main>` 에 `relative` 추가(`0bd8275`)로 해결.
- **task-045 ui-e-fix (REV 범위)**: 공유 편집기에서 저장이 막혀 초점이 옮겨 가면 안쪽 `overflow-y-auto` 상자뿐 아니라 앱 셸 `main` 도 따로 스크롤돼 BackBar 가 화면 밖으로 밀림. **원인[확실]**: 안쪽 스크롤 상자에 `position` 이 없어 그 안의 `sr-only`(absolute·1px)가 앱 셸 `main`(`relative`) 기준으로 잡혀 `main.scrollHeight` 가 커짐. `ScenarioDraftScreen`·`VariantDraftScreen` 상자에 `relative` 를 주어 해결, 회귀 시험 `scenario/__tests__/editorScroller.test.ts`.
- **task-045 가 남긴 후보(고치지 않고 보고만 — 범위 15 파일 초과)**: 직접 `sr-only` 가 상자 안에 있는 것 [확실] `eval/EvalResult.tsx:373`·`eval/EvalRunner.tsx:517`·`eval/EvalScreen.tsx:34`·`scenario/RolePlayResultScreen.tsx:38`·`challenge/ChallengeCreateScreen.tsx:193`; 간접 [가능성 높음 — 미확인] `lesson/{LessonGenScreen:83,LessonEnd:90,StageSpeak:202,LessonScreen:293}`·`eval/{EvalHistory:164,EvalStartScreen:130}`·`scenario/{PracticeDock:102,RolePlayGoalCard:18}`; 콘솔 `admin/console/ConsoleShell.tsx:36` `main`·`ConsoleNav.tsx:67` aside. 「무조건 `relative` 는 위험(`absolute inset-0` 같은 명시 오프셋 자손이 먼 조상 기준일 수 있음)」이라 한 곳씩 확인.
- 승인된 교훈(`/이슈기록 관련 ui layout scroll`): 없음.
- 기계 원리(task-045 기록): 스크롤 상자는 abspos 자손의 containing block 이 아니면(위치 지정 없으면) 자손을 자르거나 같이 스크롤하지 않는다 → containing block 이 상자 밖(`main`)인 `sr-only` 의 정적 위치(상자 내용 깊은 곳)가 `main` 의 스크롤 가능 영역을 늘린다. **긴 세로 내용 + 깊은 곳의 `sr-only`** 일 때만 의미 있는 크기.

## judge 접수 (Leader 실행, `judge-result@2`) — 1차(후보 15파일 기준)
- `local_fix` · 복잡도 1.82 · R1 · developer=sonnet · **track=standard**(`too_many_paths`) · demo=**delta**(`JV-ui_change`·`DM-kw-delta`) · roles=designer, developer, reviewer, qa. 결과 JSON scratchpad `intake-t047.result.json`.
- **Leader 판단**: 변경이 화면 모양을 바꾸지 않는 위치 기준 클래스 보정이라 데모는 의미가 없다. 면제는 사용자 발화로만 확정되므로, **1단계(읽기 전용 전수 조사)로 실제 고칠 파일을 확정한 뒤 judge 를 다시 접수**한다. 실제 변경이 12파일 이하이고 구조 변경이 아니면 light 트랙(자동 면제 `DM-light-waive`, 사용자 결정 2026-10-03)이 적용되고, 넘으면 사용자에게 면제 문장을 채팅에 직접 입력해 달라고 요청한다(파일을 쪼개 한도를 피하지 않는다).

## 범위 (이번 task)
1. **전수 조사(읽기 전용, reviewer)**: `src/components/**`·`src/app/**` 의 모든 세로 스크롤 상자(`overflow-y-auto|overflow-auto|overflow-y-scroll|overflow-scroll`)를 찾아 분류 — 앱 셸 `main` 안인가, 위치 지정(`relative|absolute|fixed|sticky`)된 조상이 상자와 `main` 사이에 있는가, 상자 안(직접·공용 부품 경유)에 `sr-only`·`absolute` 자손이 있는가, 그 자손이 명시 오프셋(`inset-*|top-*|bottom-*|left-*|right-*`)으로 먼 조상을 기준 삼는가, 상자 내용이 긴가. 분류: A 고쳐야 함·안전 / B 고쳐야 하나 자손 때문에 판단 필요 / C 이미 안전 / D 해당 없음. 콘솔(`ConsoleShell` `main`)의 위치 기준도 포함.
2. **보정 방식 결정(Leader)**: (a) 해당 상자마다 `relative` 추가 + 회귀 시험 대상 확대 (b) 전역 규칙(예: `sr-only` 의 위치) — 조사 결과의 영향 범위로 판단.
3. **구현·시험**: 확정 파일에 보정 + 「앱 셸 아래의 모든 `overflow-y-auto` 요소는 위치 기준이 있다」를 거는 회귀 시험(대상 파일 목록을 `editorScroller.test.ts` 보다 넓게, 새 상자가 생겨도 걸리도록).
4. **검증**: 브라우저로 도달 가능한 화면에서 `main.scrollHeight == clientHeight` 및 초점 이동 뒤 `main` 비스크롤 확인(360/390/412), 데이터가 필요한 화면은 정적 분석 + 시험으로 갈음하고 NOT_VERIFIED 로 표기.
5. **하지 않는 것**: 화면 구조·문구·기능·간격 변경, DB·API·native 변경.

## 완료 기준
- 전수 조사 표(분류 A~D)가 이력서에 있고, A·B 는 모두 보정 또는 사유가 기록된다.
- 앱 셸 `main`(및 콘솔 `main`)이 안쪽 스크롤 상자의 `sr-only` 때문에 늘어나는 곳이 없다 — 회귀 시험이 새 상자도 잡는다.
- 화면 모양·간격 변화 0(보정은 `relative` 류 위치 지정만). 단위 시험·tsc·eslint·build 통과. 운영 배포는 **사용자 확인 후**.

## 상태 로그
- [2026-10-10] Leader — 접수·judge 1차·이 이력서 작성. 다음: reviewer 전수 조사(읽기 전용) → 조사 결과로 judge 재접수.

## Reviewer 기록 (REV-173 — task-047 전수 조사)

- [2026-10-10][reviewer] 읽기 전용 전수 조사. 대상 `base_ref 23e08b9` 작업 트리(소스·시험·설정 수정 0). 도구 약 40회. 임시 분석 스크립트·재현 HTML 은 scratchpad 에만 둠(`closure.py`·`fileclosure.py`·`repro*.html`). 판정 형식은 조사 보고라 PASS/FAIL 대신 분류 표.
- **총 후보 37곳**: `grep -rnE 'overflow-(y-|x-)?(auto|scroll)'` 원 줄 39개 − 주석 3줄(`(app)/layout.tsx:50`·`JapaneseText.tsx:212`·`PlaceChips.tsx:6`) = 코드 36줄 + 인라인 스타일 1곳(`vocab/WordForm.tsx:25` `style.overflowY='auto'`). 세로 스크롤 상자(Y) 22곳 + 가로 줄(`overflow-x-auto`, 계산값 세로도 auto) 15곳. `.ts`·`.css`·`globals.css` 에는 0건(`grep -rn` 확인), `overflow-[…]`·템플릿 조립 클래스 0건, `src/app/**` 에는 앱 셸 `main` 한 곳뿐 [확실 — grep].
- 판정 기준: 「비보호 abspos」 = 상자 안에 `sr-only`(Tailwind 4.3.3 정의: `position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%)`) 또는 접두어 없는 `absolute` 자손이 있고, 그 자손과 상자 사이에 `relative|absolute|fixed|sticky`가 없는 것. `before:/after:absolute` 24줄은 전부 자기 요소가 `relative`(같은 줄 22줄 + `lesson/parts.tsx:265` 는 앞 줄바꿈 클래스에 `relative`, `MessageList.tsx:329` 는 버튼 자체가 `absolute`) → 무관. 접두어 없는 `absolute`(명시 오프셋) 18줄·12파일은 전부 자기 부모가 `relative`이거나 상자 밖(`Sheet`·`MessageList` 알림 필)이라 **B 는 0건**.

### 결과 표 (Y = 세로 스크롤 상자, X = 가로 줄)

| # | 파일:줄 | 구역 | 위치 기준 | abspos 자손(직접/경유) | 오프셋 | 내용 길이 | 분류 | 근거 |
|---|---|---|---|---|---|---|---|---|
| 1 | `app/(app)/layout.tsx:52` main | 앱 셸 | 자신 `relative` | — | — | 긴 | **C** | task-029. 시험 `appShellScroll.test.ts:12` |
| 2 | `chat/MessageList.tsx:302` Y | 앱 셸>채팅 | 자신 `relative`+바깥 래퍼 `relative`(:292) | 말풍선 sr-only `MessageBubble:192·193·238` | pill `:329 absolute bottom-3` 은 바깥 래퍼 기준 | 긴 | **C** | task-021 주석 `:300` |
| 3 | `scenario/ScenarioDraftScreen.tsx:239` Y | 앱 셸 | 자신 `relative` | HangulLine·`DraftEditor` | `Changed` 는 자기 `relative` | 긴 | **C** | task-045 ui-e-fix, `editorScroller.test.ts` |
| 4 | `scenario/VariantDraftScreen.tsx:33` Y | 앱 셸 | 자신 `relative` | `peer sr-only` 라디오(`VariantAxes:66`) | — | 긴 | **C** | 같음 |
| 5 | `common/Sheet.tsx:99` Y | 시트(포털 `fixed`) | 조상 `fixed inset-x-0 top-0`(:66)+`absolute` 패널(:78) | 시트 본문 자손(`ScenarioSheet:438`·`LexiconImportSheet:71` 등) | 패널 기준 | 중간 | **D** | containing block 이 시트 패널이라 `main` 무관(`fixed` 시트 안이라 앱 셸 `main` 이 containing block 이 아님) |
| 6 | `chat/Composer.tsx:146` Y(textarea) | 앱 셸>채팅 | 없음 | 자손 없음(textarea) | — | 짧음 | **D** | 자식이 없는 요소 |
| 7 | `vocab/WordForm.tsx:25` Y(인라인 스타일, textarea) | 단어 시트 안 | 없음 | 자손 없음 | — | 짧음 | **D** | 클래스가 아니라 `style.overflowY` — 전역 CSS 규칙으로는 안 잡히는 유일한 곳(자손 없어 무해) |
| 8 | `admin/console/ConsoleShell.tsx:36` main Y | **콘솔** | **없음** — 조상 `data-app-shell`(grid·overflow-hidden, position 없음)·그 위 `body` 까지 위치 지정 없음 → containing block = 초기 블록 | `DiffView:82·139`(`span.sr-only`, 줄 안), `ConfigScreen:534`(`p.sr-only role=status`), `TraceDetailScreen:126`, `LexiconList:37`(caption) | `sr-only` 는 없음. 접두어 없는 `absolute` 는 `configEditor/ui.tsx:97` 토글 점뿐, 부모 `relative`(:96) | 긴(설정·diff·표) | **A** | 앱 셸은 task-029 로 고쳤으나 콘솔 main 은 미조치. **문서 자체가 늘어남** — W1 재현 문서 높이 2568>757, 숨은 라디오 `focus()` 때 `window` 가 1811 스크롤 [확실 — 단순화 HTML] |
| 9 | `admin/console/ConsoleNav.tsx:67` aside Y(lg+) | 콘솔 | 없음 | 자손 없음(`ConsoleNavList` 는 링크만, `Sheet` 는 포털) | — | 짧음 | **D** | `fileclosure` 결과 marks 는 `Sheet` 뿐 |
| 10 | `lesson/LessonGenScreen.tsx:83` Y | 앱 셸 | 없음 | 복습 모드만: `ReviewGenItems`→`TeacherWhy:92`(`p>span.sr-only`)·`FocusBadge:23`, 그리고 `HangulLine`(`JapaneseText.tsx:148`) | 없음 | 짧음~중간 | **A**(조건부·낮음) | 일반 생성 화면엔 sr-only 없음. 복습 레슨 대기 화면에서만 |
| 11 | `lesson/LessonEnd.tsx:90` Y | 앱 셸 | 없음 | `ExprChip`(`lesson/parts.tsx:125` 버튼 비위치 `span.sr-only`), `challenge/parts.tsx:102·138`, `ScenarioCard:25`, `HangulLine` | 없음 | 중간 | **A** | `parts.tsx:109-125` 버튼 클래스에 position 없음 확인 |
| 12 | `lesson/StageSpeak.tsx:202` Y | 앱 셸 | 없음 | `ExprChip`(`parts:125`), `HangulLine`, `JaText` | 없음 | 중간 | **A** | |
| 13 | `lesson/LessonScreen.tsx:293` Y | 앱 셸 | 없음 | `StageUnderstand:184·195`(`div.grid>span.sr-only`), `StageQuiz:132`, `StageApply:232`, `parts:125·234·237`, `HangulLine`; `PushToTalkButton:79 absolute -inset-1.5` 은 부모 버튼 `relative`(:77) | 있으나 안쪽 `relative` 기준 | 긴(레슨 5단계) | **A** | 가장 위험이 큰 곳(긴 내용+깊은 sr-only) |
| 14 | `eval/EvalHistory.tsx:164` Y | 앱 셸 | 없음 | 로딩 분기 `:73 p.sr-only`(상자 맨 위) | 없음 | 목록 페이지(중간~긴) | **A**(낮음) | 지금은 로딩 때 상자 맨 위에만 — 깊은 위치 아님 |
| 15 | `eval/EvalRunner.tsx:517` Y | 앱 셸 | 없음 | `:534 section>h2.sr-only`(비위치), `EvalItems:277 label.sr-only`, `HangulLine`, `PushToTalkButton`(자기 `relative`) | 없음 | 중간~긴 | **A** | task-045 가 보고한 직접 sr-only [확실] |
| 16 | `eval/EvalStartScreen.tsx:130` Y | 앱 셸 | 없음 | 없음(`KindOption`·`Btn`·`Link`·`Badge` 만, 칩은 자기 `relative`) | — | 중간 | **D**(잠복) | `fileclosure` marks 0 |
| 17 | `eval/EvalResult.tsx:373` Y | 앱 셸 | 없음 | `:375 h2.sr-only`(상자 직계), `LevelCard :336 p.sr-only`, `JaBlock`·`HangulLine` | 없음 | 긴(문항 목록) | **A** | 직접 sr-only [확실] |
| 18 | `eval/EvalScreen.tsx:34` Frame Y | 앱 셸 | 없음 | 없음(`GenScreen`·`ReadyScreen`·`GradingScreen` 에 sr-only/absolute 없음; `:270 p.sr-only` 는 `Frame` 밖 로딩 분기) | — | 중간 | **D**(잠복) | task-045 가 직접 sr-only 로 적은 `:270` 은 상자 밖으로 확인 — 후보 정정 |
| 19 | `challenge/ChallengeCreateScreen.tsx:193` Y | 앱 셸 | 없음 | `createParts:69·101·131` `label.block>input.peer.sr-only`(label 비위치), `challenge/parts:102·138`, `HangulLine` | 없음 | 긴(주제 라디오 목록) | **A** | 포커스되는 숨은 입력이라 `focus()` 영향이 가장 직접적 |
| 20 | `scenario/PracticeDock.tsx:102` Y | 앱 셸>회화방 | 없음(`TalkRoom` 루트 `flex h-full…` 에 position 0건) | `:193 fieldset>legend.sr-only`, `HangulLine` | 없음 | 짧음(최대 `46dvh`/320px) | **A**(낮음) | 상자가 작아 정적 위치가 화면 근처 |
| 21 | `scenario/RolePlayGoalCard.tsx:18` 상수 `GOAL_REGION_MAX` Y(`#rp-goal`) | 앱 셸>회화방 | 없음 | `:66·68`(`span>span.sr-only`), `:117`, `HangulLine` | 없음 | 짧음(최대 `40dvh`) | **A**(낮음) | **상수 문자열이라 `editorScroller.test.ts` 식 `className=` 스캐너가 못 잡는 형태** |
| 22 | `scenario/RolePlayResultScreen.tsx:38` Y | 앱 셸 | 없음 | `:41 p.sr-only`(로딩), 결과 본문의 `lesson/parts`(125·234·237)·`ScenarioCard:25`·`HangulLine` | 없음 | 중간~긴 | **A** | 직접 sr-only [확실], 본문 경유분은 import 그래프 기준 [가능성 높음] |
| 23 | `common/japanese/JapaneseText.tsx:219` X | 앱 셸·콘솔 | 칩 버튼이 각각 `relative` | 없음 | `:193` before 는 칩 기준 | 짧음 | **D** | |
| 24 | `chat/RoomIntro.tsx:20` X | `MessageList`(relative) 안 | — | 없음 | — | 짧음 | **D** | |
| 25 | `vocab/CategoryChips.tsx:66` X | 앱 셸 | 칩 `relative`(:15) | 없음 | — | 짧음 | **D** | |
| 26 | `vocab/ChunkChips.tsx:54` X | 앱 셸 | 칩 `relative`(:16) | 없음(`:44 sr-only` 는 줄 밖 형제) | — | 짧음 | **D** | |
| 27 | `admin/console/ChipRadio.tsx:46` X | 콘솔 | — | 없음 | — | 짧음 | **D** | |
| 28 | `admin/configEditor/ReasonFields.tsx:75` X | 콘솔 | — | 없음 | — | 짧음 | **D** | |
| 29 | `admin/configEditor/RawTab.tsx:96` X(textarea) | 콘솔 | — | 없음 | — | 가변 | **D** | |
| 30 | `admin/configEditor/RawTab.tsx:99` X(pre) | 콘솔 | — | 없음 | — | 가변 | **D** | |
| 31 | `admin/lexicon/WriteConfirmFields.tsx:68` X | 콘솔 | — | 없음 | — | 짧음 | **D** | |
| 32 | `admin/lexicon/AccentPicker.tsx:73` X | 콘솔 | — | 없음 | — | 짧음 | **D** | |
| 33 | `eval/EvalHistory.tsx:166` X | 앱 셸(#14 상자 안) | 칩 `relative`(:176) | 없음 | — | 짧음 | **D** | |
| 34 | `eval/EvalRunner.tsx:494` X | 앱 셸 | — | 없음 | — | 짧음 | **D** | |
| 35 | `eval/EvalStartScreen.tsx:179` X | 앱 셸(#16 상자 안) | 칩 `relative`(:189) | 없음 | — | 짧음 | **D** | |
| 36 | `challenge/DayStrip.tsx:133` X | 앱 셸 | 없음 | `:135·143 caption.sr-only` | 없음 | 짧음(7열 표) | **A**(낮음) | 표 위쪽 캡션이라 깊은 위치 아님 — 위험 작음 |
| 37 | `scenario/PlaceChips.tsx:36` X | 앱 셸 | 칩 `relative`(:47) | 없음 | — | 짧음 | **D** | |

### 요약 카운트
- **A 13**: 세로 12(콘솔 main 1 + 앱 셸 아래 11) + 가로 1(`DayStrip`). 그중 조건부·낮음 5(LessonGen·EvalHistory·PracticeDock·RolePlayGoalCard·DayStrip).
- **B 0** (접두어 없는 `absolute` 18줄·12파일 전수: `settings/VoiceSlider`·`DisplaySettings`, `vocab/{WordSearchBar,SwipeCardStack,WordSoundButton,TodayHome}`, `admin/configEditor/ui.tsx`, `speech/PushToTalkButton`, `plan/CalendarSection`, `scenario/DraftEditor`, `chat/MessageList`, `common/Sheet` — A 상자 안에 들어오는 것은 `PushToTalkButton`·`DraftEditor`뿐이고 둘 다 자기 `relative` 부모를 가짐)
- **C 4**: 앱 셸 main, `MessageList`, `ScenarioDraftScreen`, `VariantDraftScreen`.
- **D 20**: 세로 6(Sheet·Composer·WordForm·ConsoleNav·EvalStart·EvalScreen) + 가로 14.
- **E 0.** (판단 보류 없음 — 다만 아래 NOT_VERIFIED 참조)
- 합 13+0+4+20 = 37 ✓

### 4. 앱 셸·콘솔 `main` 점검
- **앱 셸**: `(app)/layout.tsx:52` 단일 `<main className="relative min-h-0 min-w-0 overflow-y-auto …">` — 경로 분기 없음. `isFocusRoute` 는 `TabBar.tsx:44`·`AppUpdateBanner.tsx:50` 만 숨기고 `main` 은 건드리지 않음 → 모든 `(app)` 경로(탭 홈·하위·focus)에 `relative` 적용 [확실 — grep·소스]. `(app)` 아래 `page.tsx`/`layout` 들에는 position 클래스 0건(`className=` 전수 확인: 설정 화면 래퍼뿐), `loading.tsx` 4개는 `TabSkeleton`(sr-only 1개, main 기준). 시험 `appShellScroll.test.ts:12·:17` 가 `relative` 고정 + 셸 `data-app-shell` 에는 position 금지(포커스 스크롤 대상이 되지 않게).
- **콘솔**: `ConsoleShell.tsx:36` main 에 **`relative` 없음**, `aside`(`ConsoleNav.tsx:67`)도 없음, 조상 `data-app-shell` 그리드(`overflow-hidden`)·`(admin)/layout.tsx`(바로 `ConsoleShell`)·`app/layout.tsx`(`html lang`·`body`) 어디에도 position 없음 → 콘솔 `sr-only` 의 containing block 은 초기 블록(문서). 앱 셸과 달리 **안쪽 상자가 없어도** 콘솔 main 안 `sr-only` 가 문서 스크롤을 늘린다. `html, body {height:100dvh}`(`globals.css:111`)라 문서가 스크롤 가능. 콘솔에는 이를 고정하는 시험이 없다(`ConsoleShell` 시험 0건).
- **`(auth)`**(`login`·`invite`): `src/app/(auth)` 에 `overflow-*` 0건 — 문서가 정상 스크롤하는 일반 페이지라 해당 없음. **`(admin)`**: 레이아웃이 `ConsoleShell` 에 위임하므로 위 콘솔 점검이 전부.

### 재현 근거 (단순화 HTML, headless Chrome 147, 390×844 — 앱 DOM 아님)
`scratchpad/repro3.html` 결과(수치 그대로): 
- W1 콘솔형(main 비위치·안쪽 상자 없음·`<p>` 줄 안 `sr-only`+flex 라벨 숨은 라디오): 문서 `scrollHeight` 2568 > 757, `radio.focus()` 후 `window.scrollY` 1811.
- W2 앱 셸형(main `relative`, 상자 없음): 문서 757 유지.
- W3 A 상태(main `relative`+상자 비위치): `main.scrollHeight` 2516 > clientHeight 705, `focus()` 뒤 `main.scrollTop` 1811(상자 0) — task-045 QA-E 증상과 일치.
- W4 (a) 상자 `relative`: `main` 705 유지, 상자가 2400 으로 스크롤(초점이 상자 안에서 보이게 감).
- W5/W6 (c) `.sr-only{position:fixed}`: `main` 705 유지하지만 **초점이 아무것도 스크롤하지 않음**(상자 0 — 이미 `relative` 인 W6 도 W4 의 2400 에서 0 으로 후퇴).
- W8 (b) `@layer base { .x { position:relative } }`: 계산값 `relative`, 결과 W4 와 같음(main 705·상자 2400).
- repro2: 접두어 없는 보이는 abspos 는 항상 새어 나가 문서/`main` 을 늘림(V1·V2). 1px `sr-only` 는 **앞뒤가 블록이고 혼자 있는 줄**(빈 익명 블록)이면 안 세는 반면(V3·V5·V7) `<p>text <span sr-only> more</p>` 같이 줄 안·flex 라벨 안에 있으면 센다(V6·W1·W3) — 실제 `HangulLine`·`ExprChip`·`peer sr-only` 입력 모양은 후자. 그래서 「sr-only 가 있다」만으로는 피해가 안 나는 경우도 있다(위험 크기 판단에 반영: A 낮음).

### 5. 보정 방식 비교 (권고: (b) + 시험, 보조로 콘솔 main 명시 `relative`)
| | 바뀌는 요소 | 위험 | 시험 가능성 |
|---|---|---|---|
| (a) 상자마다 `relative` | 13파일(콘솔 1 + 앱 셸 11 + `DayStrip`) + 시험. 잠복 D 2곳(EvalStart·EvalScreen)을 더하면 15. 한 번에 고쳐도 새 상자·상수 문자열(`GOAL_REGION_MAX`)·`cn()` 은 또 빠진다 — 이번 후보가 15곳 쌓인 이유가 곧 (a) 의 재발 양식(task-021·029·045 가 각각 한 곳씩 고침) | 위치만 지정, 시각 변화 0(B 0건). 단 `RolePlayGoalCard`처럼 상수/조립 클래스는 편집 위치가 헷갈림 | `editorScroller.test.ts` 식 `className=` 스캔은 상수·변수 조립을 못 잡음 → 파일 전체 토큰 스캔으로 바꿔야 함 |
| (b) `globals.css` 한 규칙 | 규칙 1개(클래스 기반 Y 21곳 중 이미 `relative` 인 4곳을 뺀 17곳이 계산값만 바뀜; X 줄은 일단 제외 권장) + (선택) `ConsoleShell` main 명시 | `@layer base`에 두면 `.static/.absolute/.fixed/.sticky` 유틸리티(`utilities` 층)가 이긴다 → 가드(`:not(.absolute)…`) 불필요. `position:relative` 는 오프셋 없는 상자라 레이아웃 변화 0; 그리기 순서에서 위치 지정 상자가 같은 쌓임 안의 비위치 형제 위로 올라오는 점만 검토 필요(텍스트 겹침이 있는 곳은 `MessageList` 외 없음, 이미 `relative`) [추측 — 화면 비교 전] | 한 번에 걸림: 규칙 존재+선택자 목록이 코드의 스크롤 토큰을 전부 덮는지를 소스 스캔으로(아래 6번). 새 상자는 자동 보호 |
| (c) `.sr-only` → `position:fixed` | 앱 전체 `sr-only` 코드 81줄(`grep` 기준)의 동작이 바뀜 | **W5/W6 재현으로 초점 스크롤 소실**(키보드·스위치 사용자의 숨은 라디오/체크 이동 때 상자가 안 따라감 — 이미 `relative` 로 올바르게 동작하던 MessageList·편집기까지 후퇴). `transform` 조상(예 `Sheet` 패널 `min-[900px]:-translate-x-1/2`) 아래에선 `fixed` 기준이 문서→조상으로 바뀜. Tailwind 유틸리티를 덮어써야 해 층 순서 함정 | 시험은 쉽지만 기능 후퇴라 비권장 |

- **권고 (b)**: 문제의 뿌리가 「스크롤 상자 ≠ abspos 의 containing block」이라서 스크롤 상자 쪽 한 규칙이 맞다. 규칙은 `@layer base { :where(.overflow-y-auto, .overflow-auto, .overflow-y-scroll, .overflow-scroll) { position: relative } }` 꼴. 근거 W8. Tailwind 4.3.3 컴파일 결과에서 층 순서가 의도대로인지는 빌드 산출물로 확인 필요 [추측].
- (b) 의 약점 한 가지: 규칙이 컴포넌트 밖에 있어 읽는 사람이 모른다 → 규칙 위 주석에 task-021·029·045·047 경위를, `layout.tsx` 주석에서 포인터를 달 것. 가로 줄(`overflow-x-auto`)은 포함하지 않아도 되나(15곳 중 abspos 자손은 `DayStrip` 캡션 하나), 포함해도 시각 변화는 없다. 인라인 스타일(`WordForm`)은 못 덮지만 자손이 없다.
- 굳이 (a)를 택한다면 최소 대상은 **콘솔 main 1 + 레슨/평가/챌린지/역할극 11 = 12파일**(+ `DayStrip`)이고, light 트랙 상한 12파일을 시험 파일까지 합치면 넘는다 → standard 트랙. (b) 는 `globals.css`·시험 1~2·(선택)`ConsoleShell` = 3~4파일이라 light 요건(12파일 이하·신규 화면·마이그레이션·네이티브·인증 변경 없음)에 든다. 단 CSS 전역 규칙이라 시각 회귀 확인(360/390/412)은 해야 한다.

### 6. 회귀 시험 설계 (제안만, 새 파일 예: `src/components/common/__tests__/scrollBoxPosition.test.ts`)
1. **대상 하드코딩 금지**: `src/components`·`src/app` 아래 `.tsx` 를 재귀로 읽고(`__tests__` 제외) 파일 **전체 텍스트**에서 주석(`//…`·`/*…*/`·JSX `{/*…*/}`)을 먼저 지운 뒤 토큰을 뽑는다 — `className=` 속성만 보면 `RolePlayGoalCard.tsx:18` 같은 상수 문자열을 놓친다(`editorScroller.test.ts` 의 한계로 REV-168 이 이미 Info 로 적음). 정규식: `(?<![\w-])((?:[\w\[\]-]+:)*)overflow-(?:y-)?(?:auto|scroll)(?![\w-])` 와 인라인 `overflow(Y)?\s*[:=]\s*['"]?(auto|scroll)`.
2. **규칙 (b) 채택 시**: ① `globals.css` 에서 `@layer base` 블록을 찾아 `:where(...)` 선택자에 `.overflow-y-auto`·`.overflow-auto`·`.overflow-y-scroll`·`.overflow-scroll` 이 모두 있고 선언이 `position: relative` 인지(문자열이 아니라 중괄호 단위 파싱, 주석 제거 후) ② 소스의 모든 세로 스크롤 토큰이 **접두어 없는 위 4개 중 하나**인지 — `md:overflow-y-auto`·`max-lg:overflow-auto`·`overflow-[auto]`·`overflow-y-[…]` 같은 변형은 규칙이 안 덮으므로 실패시키고, 같은 요소에 접두어 없는 `relative|absolute|fixed|sticky` 토큰(`md:relative` 는 불인정)이 있을 때만 통과 ③ 인라인 스타일 `overflow: auto` 는 허용 목록에서만 통과.
3. **규칙 (a) 채택 시**: 토큰이 속한 `className` 문자열(또는 상수 선언 문자열)에 `relative|absolute|fixed|sticky`(접두어 없는 정확 토큰) 가 있어야 하고, 아니면 허용 목록.
4. **허용 목록 형식**: `const ALLOW: Record<string, string> = { 'src/components/common/Sheet.tsx': 'fixed 포털 시트 안 — containing block 이 시트 패널', 'src/components/chat/Composer.tsx': 'textarea — 자손 없음', 'src/components/vocab/WordForm.tsx': '인라인 스타일 textarea — 자손 없음', 'src/components/admin/console/ConsoleNav.tsx': '링크만 — sr-only 생기면 재검토' }`. 키는 파일 경로, 값(사유)은 비어 있으면 실패, **허용 목록에만 있고 코드에는 없는 항목도 실패**(썩지 않게). 같은 파일에 상자가 둘 이상이면 키에 `#<토큰 순번>`.
5. **빈 통과 방지**: 스캔이 읽은 파일 수·스크롤 토큰 수가 하한(예: 토큰 ≥ 22, 알려진 파일 `MessageList`·`EvalResult`·`ConsoleShell` 포함)을 넘는지 단언 — 디렉터리 이동으로 0건 통과를 막는다(`editorScroller` 의 `editorScreens()` 단언과 같은 취지).
6. **기존 시험과의 관계**: `editorScroller.test.ts`(편집기 화면에 `relative` 명시)는 (b) 로 가도 **유지** — 규칙이 빠져도 편집기만큼은 명시 `relative` 가 지켜 준다. `appShellScroll.test.ts` 는 그대로(셸 `data-app-shell` position 금지 포함). 콘솔은 새 시험 하나로 `ConsoleShell` `main` 토큰에 `relative` 가 있는지 고정(앱 셸 `main` 시험을 본뜸).
7. **변이로 확인할 것**: 규칙 제거, 선택자에서 `.overflow-auto` 삭제, 소스에 `md:overflow-y-auto` 추가, 허용 목록 사유 비움, 허용 항목 코드에서 제거 — 모두 실패해야 함.
8. 브라우저 실측은 QA 몫: 360/390/412 폭에서 A 화면(레슨 단계·평가 결과·챌린지 만들기·역할극 결과·콘솔 diff)의 `main.scrollHeight - main.clientHeight`(콘솔은 `documentElement.scrollHeight - innerHeight`)와 숨은 입력 `focus()` 뒤 `main`·`window` 스크롤이 0 인지.

### 고칠 파일 목록 (A, 이유 분류 포함)
- 방식 (a) 기준 **13파일**: `src/components/admin/console/ConsoleShell.tsx`(main, **유일하게 현재도 증상 가능**) · `lesson/{LessonGenScreen,LessonEnd,StageSpeak,LessonScreen}.tsx` · `eval/{EvalHistory,EvalRunner,EvalResult}.tsx` · `challenge/{ChallengeCreateScreen,DayStrip}.tsx` · `scenario/{PracticeDock,RolePlayGoalCard,RolePlayResultScreen}.tsx`. 시험 1~2 파일 별도. 잠복 D(`EvalStartScreen`·`EvalScreen`)는 지금 안 고쳐도 되나 (a)로 가면 같이 두는 편이 안전.
- 방식 (b) 기준 **3~4파일**: `src/app/globals.css`(규칙 1개) · `src/components/admin/console/ConsoleShell.tsx`(선택, 명시) · 새 시험 · (선택) 주석 포인터용 `src/app/(app)/layout.tsx`.
- 위험 순서(실제 피해 가능성): ① 콘솔 main(문서 스크롤, 시험 0건) ② 레슨 화면·평가 결과·챌린지 만들기(긴 내용+포커스되는 숨은 입력) ③ 역할극 결과·평가 진행 ④ 나머지 낮음.

### 이 task 계획에 대한 Leader 참고 의견
- 이력서 「범위 1」의 분류 A~D 는 그대로 쓸 수 있었다. 새로 확인된 점: (i) task-045 가 직접 sr-only 로 적은 `EvalScreen.tsx:34`/`:270` 은 **상자 밖**이라 후보에서 빠진다(D 잠복). (ii) 콘솔은 「안쪽 상자」가 아니라 **main 자체가 위치 기준이 없는** 별개 양태라 앱 셸 시험으로는 안 걸린다. (iii) 「sr-only 가 있으면 항상 늘어난다」가 아니라 줄 안·flex 안 모양일 때만(재현 근거 참조).
- judge 재접수 시 참고: (b) 이면 변경 3~4파일(`globals.css` 전역 CSS 1블록 + 시험)이라 light 후보지만 **전역 CSS 는 시각 영향 범위가 넓어** 트랙(light/standard)과 데모 면제 여부는 Leader 가 판단.

### NOT_VERIFIED
- 실제 앱 화면(레슨·평가·챌린지·콘솔 diff)에서의 `main`/문서 `scrollHeight` 실측 — 로그인·데이터가 필요해 하지 않음. 위 수치는 단순화 HTML 재현.
- 콘솔 `DiffView` 등 실제 길이에서 문서가 늘어나는지(W1 은 같은 구조의 모의, 실제 sr-only 위치는 코드로만 확인).
- `HangulLine` 계열은 표시 설정 `showHangul` 이 켜진 계정에서만 렌더 — 꺼진 계정은 다른 sr-only(`ExprChip`·`peer sr-only` 등)만 남음.
- 경유 부품은 import 그래프(스크립트)와 대표 지점 정독으로만 확인(전 부품 정독 아님): `RolePlayResultScreen` 의 `ResultBody` 내부, `ReviewGenItems` 하위 등은 [가능성 높음].
- Tailwind 4.3.3 빌드 산출물에서 `@layer base` 규칙의 실제 순서·`:where()` 처리, 앱 WebView(Chromium 버전 차이)·Safari 동작.
- (b) 적용 시 `position:relative` 로 인한 그리기 순서 변화(겹치는 형제) — 코드상 겹침은 보이지 않으나 화면 비교 전.
- 위험 크기(낮음/높음)는 내용 길이를 코드로 추정한 것.
- 이력서 외 수정 0: `git status` 기준 새 변경은 이 이력서·일지뿐.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-10 00:17 |

## Leader 결정 (2026-10-10, REV-173 전수 조사 뒤)
- **조사 결과 수용**: 후보 37곳(세로 22·가로 15) → A 13·B 0·C 4·D 20·E 0. 콘솔 `main` 은 안쪽 상자 없이도 문서 스크롤을 늘리는 별개 양태(현재 증상 가능한 유일한 곳, 고정 시험 0). task-045 가 적은 `EvalScreen.tsx:34/:270` 은 상자 밖이라 후보에서 제외(정정).
- **보정 방식 = (b') 전역 규칙을 `main` 안으로 좁힘**: `@layer base { :where(main .overflow-y-auto, main .overflow-auto, main .overflow-y-scroll, main .overflow-scroll) { position: relative } }` + 콘솔 `ConsoleShell` `main` 에 명시 `relative` + 소스 스캔 회귀 시험. 이유: (a) 상자마다 고치기는 task-021·029·045 가 한 곳씩 고치고도 15곳이 쌓인 같은 양식이 되풀이되고 상수 문자열·`cn()` 은 또 빠진다. (c) `.sr-only{position:fixed}` 는 재현(W5/W6)에서 초점 스크롤이 사라져 후퇴 → 비권장. **`main` 안으로 좁힌 이유**: 조사가 짚은 약점이 `position:relative` 로 인한 그리기 순서 변화인데, 포털로 `body` 에 붙는 공용 `Sheet` 등 문제 없는 곳(D)은 건드리지 않아 바뀌는 요소를 줄인다. `@layer base` 라 `absolute|fixed|sticky` 유틸리티는 그대로 이긴다. **한계 [추측]**: 그리기 순서 영향은 화면 비교 전이라 확정 못 함 → QA 에서 변경 전후 화면 비교로 확인.
- **judge 재접수(2차, 실제 변경 3파일)**: `local_fix` · 복잡도 1.10 · R1 · developer=sonnet · **track=light** · demo=**none**(`DM-light-waive`) · roles=developer, reviewer. 결과 `intake-t047b.result.json`. 변경 파일 `src/app/globals.css`·`src/components/admin/console/ConsoleShell.tsx`·`src/components/shell/__tests__/scrollBoxPosition.test.ts`. 이 판정은 파일을 쪼개 한도를 피한 것이 아니라 보정 방식(a)→(b')로 바뀌어 실제 변경이 줄어든 결과다(1차 접수의 15파일 후보는 조사 전 추정이었다).
- **Leader 보정**: light 라도 전역 CSS 라 시각 영향 범위가 넓으므로 **QA 화면 비교(변경 전후, 360/390/412)는 유지**한다. 범위가 12파일을 넘거나 구조 변경이면 standard 로 승격.

## Developer 기록 (task-047 — 전역 규칙·콘솔 main·회귀 시험)

- [2026-10-10][developer(sonnet)] light 트랙 · 데모 게이트 `DEMO_GATE_PASSED`(task-047 / status not_required / 필요 없음(judge 판정 none)) · 커밋·push 안 함(Leader 가 diff 확인 뒤 경로 지정 커밋). 화면 모양·간격·문구·기능·API·DB·native 변경 0 — **위치 지정(`position: relative`)만**.
- **native_change: false** (plugins·android·capacitor.config·Manifest 무변경, versionCode 변동 없음).

### 변경 파일 (코드 3)
| 파일 | 내용 |
|---|---|
| `src/app/globals.css` (+19) | `@layer base { :where(main .overflow-y-auto, main .overflow-auto, main .overflow-y-scroll, main .overflow-scroll) { position: relative } }` 1개 + 한국어 이유 주석(task-021·029·045·047 경위, `main` 으로 좁힌 이유, `@layer base` 라 `absolute\|fixed\|sticky` 유틸리티가 이긴다는 점, 시험 위치). `body {…}` 블록과 상태바 안전장치 사이에 둠 |
| `src/components/admin/console/ConsoleShell.tsx` (+2 −1) | 콘솔 `<main>` 클래스 맨 앞에 `relative` + WHY JSX 주석 한 줄. 나머지 클래스 순서·간격 그대로. `ConsoleNav` aside 는 건드리지 않음 |
| `src/components/shell/__tests__/scrollBoxPosition.test.ts` (신규) | REV-173 §6 을 (b') 로 좁혀 구현. 8개 시험(자체 점검 3 + 실제 5) |
- 기존 `editorScroller.test.ts`·`appShellScroll.test.ts` **수정 0** — 그대로 통과(전체 실행에 포함).
- 이력서(이 파일)·일지 외 수정 0. `@/modules/*` import 0, 보이지 않는 문자 0(diff·새 파일 모두 `grep -nP` 0건).

### 실행 증빙 (홈 미러 `~/.node-local/thekaiwa-t047`, `KAIWA_LOCAL_ROOT` 로 sync)
| 명령 | 결과 |
|---|---|
| `DATABASE_URL=mysql://invalid… node --import tsx --test src/components/shell/__tests__/scrollBoxPosition.test.ts` | **8/8 pass** |
| `node --import tsx --test $(find src/components src/app -name '*.test.ts*')` | 114 파일, **1058 pass / 0 fail** (editorScroller·appShellScroll 포함) |
| `./node_modules/.bin/tsc --noEmit` | rc=0 |
| `./node_modules/.bin/eslint <시험·ConsoleShell>` | rc=0 |
| `APP_ENV=LOCAL CLAUDE_CLI_PATH=/bin/false ./node_modules/.bin/next build > build.log 2>&1; echo $?` | **rc=0** (`✓ Compiled successfully`, TypeScript 통과) |

### 빌드 산출물 확인 (`.next/static/chunks/*.css`, 단일 CSS 62,747B)
- 층 선언 순서: `@layer properties{…}` → `theme` → `base` → `components;` → `utilities{…}` — **`base` 가 `utilities` 보다 앞**(= `.absolute|.fixed|.sticky|.relative` 유틸리티가 이긴다).
- 규칙은 Tailwind 의 preflight 와 **같은 `@layer base` 블록 끝에** 합쳐져 살아 있다(`:where()` 보존·최소화됨). 실제 조각(인용):
  `…[hidden]:where(:not([hidden=until-found])){display:none!important}:where(main .overflow-y-auto,main .overflow-auto,main .overflow-y-scroll,main .overflow-scroll){position:relative}}@layer components;@layer utilities{.\@container{container-type:inline-size}.pointer-events-none{…`
- 유틸리티: `.absolute{position:absolute}` `.fixed{position:fixed}` `.relative{position:relative}` `.sticky{position:sticky}` 가 모두 `@layer utilities` 안(오프셋 6682 > base 블록 2861). 규칙 오프셋 6556(= base 블록 안).

### 계산된 위치값 실측 (dev 서버 `127.0.0.1:3071`, LOCAL·QA 계정 읽기 전용, 360×740 / 390×844 / 412×892, 모바일 에뮬레이션)
방법: 같은 쪽에서 (후)=현재 상태, (전 모의)=`main .overflow-*:not(.relative…) {position:static!important}`(콘솔은 `main{position:static!important}` 추가)를 주입해 규칙이 없던 때와 같게 만든 값. 화면 이동·초점 이동만 했고 저장·전송 없음.
| 화면(QA2) | `main` 안 상자 | `position` 후 / 전(모의) | `main` Δ(scrollHeight−clientHeight) 360·390·412 | 비고 |
|---|---|---|---|---|
| `/settings` | 없음(`main` 이 스크롤러) | — | 3359·3236·3150 (후=전) | `main` 자체 position `relative`. Δ 는 페이지 길이 |
| `/study/ai?tab=scenario` | 없음 | — | 1631·1527·1479 (후=전) | 동일 |
| `/study/ai/scenario/new` | `div.relative.overflow-y-auto` | relative / relative(명시) | 0·0·0 | 상자 Δ 5·0·0 |
| `/study/today/eval/new` | `div.overflow-y-auto.overscroll-contain` | **relative / static** | 0·0·0 | 상자 Δ 246·142·94 |
| `/plan/challenge/new` | `div.overflow-y-auto` (숨은 라디오 9개) | **relative / static** | 0·0·0 | 상자 Δ 118·0·0, 마지막 라디오 `focus()` → main 0·상자 0·창 0 (후=전, 내용이 짧아 안 넘침) |
| `/study/today/eval/history` | `div.overflow-y-auto.overscroll-contain` | **relative / static** | 0·0·0 | |
| 콘솔 `/admin/dashboard` | — | `main`: **relative / static** | main 271·148·100, 문서 0·0·0 | |
| 콘솔 `/admin/llm` | — | `main`: **relative / static** | 765·661·613, 문서 0 | |
| 콘솔 `/admin/speech/tts/lexicon` | — (`caption.sr-only` 1) | `main`: **relative / static** | 612·490·442, 문서 0 | |
| 콘솔 `/admin/history` | — | `main`: **relative / static** | 0·0·0, 문서 0 | |
- 모든 `main`(앱 셸)은 `relative`, `main` 의 명시 `relative` 상자는 그대로, 규칙이 바꾼 상자(eval/new·challenge/new·eval/history)는 `relative`. 세 폭에서 같은 값. **지금 QA 계정 데이터로는 누수가 재현되지 않는다**(내용이 짧거나 sr-only 가 깊지 않음 — REV-173 「긴 내용+깊은 sr-only 일 때만」과 일치).
- **주입 실험(재현 확인)**: 같은 빌드·실제 DOM 에서 클라이언트에만 `2400px` 채움 요소를 `/plan/challenge/new` 의 마지막 숨은 라디오 앞에 넣고 `focus()`:
  | 폭 | 후(규칙 있음) main Δ · 초점 뒤 main/상자 scrollTop | 전(모의) main Δ · 초점 뒤 main/상자 |
  |---|---|---|
  | 360 | **0** · 0 / 2518 | 2314 · **2314** / 0 |
  | 390 | **0** · 0 / 2395 | 2190 · **2190** / 0 |
  | 412 | **0** · 0 / 2327 | 2142 · **2142** / 0 |
  → 규칙 없음: `main` 이 따로 늘어나 초점이 `main` 을 스크롤(task-045 증상), 규칙 있음: `main` 은 안 늘고 상자가 스크롤. 규칙의 효과를 실제 빌드 CSS 로 확인.
- **콘솔 확인(390폭, 실제 셸)**: `/admin/speech/tts/lexicon` 의 `main` 안에 `2400px` 채움 + 맨 아래 `position:absolute` 1px 점을 넣고 `documentElement.scrollHeight−innerHeight`: `main` `relative` → **0**, `main` `static` → **2851**(= 조상에 위치 지정이 없어 문서가 늘어남, 셸의 `overflow-hidden` 이 막아 주지 않음). `ConsoleShell` 의 직접 `relative` 가 필요하다는 REV-173 §4 를 실제 셸에서 확인. (같은 화면의 실제 `caption.sr-only` 로 주입한 첫 시도는 정적 위치가 깊지 않아 0 이었다 — 위 1px 점 실험이 정본.)

### 변이 확인 (복사본에서 python 치환 → 시험 → 원복, `diff -rq pristine work` 출력 없음)
| 변이 | 결과 |
|---|---|
| M1 규칙 블록 제거 | 실패(globals.css 규칙 시험) |
| M2 선택자에서 `main .overflow-auto` 삭제 | 실패 |
| M3 선언 `position: static` | 실패 |
| M4 소스에 `md:overflow-y-auto` 요소(새 파일) 추가 | 실패(변형 시험) |
| M5 허용 목록 사유(Sheet) 비움 | 실패(허용 목록 시험) |
| M6 허용 항목을 코드에서 제거(ConsoleNav 의 토큰 삭제) | 실패 2(허용 목록 stale + 토큰 하한) |
| M7 `ConsoleShell` `relative` 제거 | 실패 2(`<main>` 자신 규칙 + 콘솔 main 시험) |
| M8a 규칙을 층 밖(unlayered)으로 | 실패 |
| M8b 규칙을 `@layer components` 로 이동 | 실패 |
| M9 인라인 `style={{ overflowY: 'auto' }}` 새 파일 | 실패 |
| M10 `ConsoleNav` 에 `sr-only` 포함(가드 `mustNot`) | 실패 |
| M11 앱 셸 `(app)/layout.tsx` `main` 의 `relative` 제거 | 실패(`<main>` 자신 규칙; `appShellScroll` 시험도 같은 파일을 읽어 막지만 이 변이에서 따로 돌리지는 않음) |
| M12 `Sheet` 에서 `createPortal(` 제거(가드 `must`) | 실패 |
| M13 `overflow-[auto]` 새 파일 | 실패 |
| M14 `RolePlayGoalCard` 상수 문자열을 `max-lg:overflow-auto` 로 | 실패 2(변형 + 상수 문자열 sentinel) |
| M15 같은 변형이지만 같은 요소에 `relative` 추가 | 변형 시험 **통과**(의도: 직접 위치 지정이 있으면 허용), 상수 sentinel 만 실패 |
- 기준선(원본)은 8/8. 변이 시험 도구는 scratchpad `mut/driver.py`(저장소 밖).

### 가이드와 달라진 점·판단
1. **허용 목록의 의미를 (b') 에 맞게 정리**: 접두어 없는 표준 토큰은 규칙이 덮으므로(`main` 안이라고 가정) 기본 통과이고, 허용 목록은 「규칙이 안 닿거나 닿을 필요가 없는 상자」의 사유 기록이다. 코드로 확인해 REV-173 표와 같게 4곳: `common/Sheet.tsx`(`document.body` 로 `createPortal`하는 `fixed` 시트 — 사실상 `main` 밖), `chat/Composer.tsx`(textarea·자손 없음 — 채팅방 `ChatRoom` 에서는 `main` 안이라 규칙이 `relative` 로 만들고 `ScenarioSheet` 안에서는 포털이라 그대로, 어느 쪽이든 무해), `vocab/WordForm.tsx`(인라인 `style.overflowY`, 자손 없음), `admin/console/ConsoleNav.tsx`(`aside` 는 `main` 의 형제, 링크만). **가이드에 없던 가드 추가**: 항목마다 사유가 기대는 사실을 파일 텍스트로 확인(`must`/`mustNot`) — Sheet 는 `createPortal(` 존재, 나머지는 `sr-only`·접두어 없는 `absolute` 부재. 안 두면 사유가 코드와 어긋나도 모른다.
2. **`<main>` 자신 검사를 일반 규칙으로**: 규칙 선택자 `main .overflow-*` 는 `main` 요소 자신에는 안 닿으므로 `<main className="…overflow-y-auto…">` 는 같은 className 에 접두어 없는 위치 지정이 있어야 한다(앱 셸·콘솔 둘 다 걸림). ⑥ 콘솔 시험은 이와 별도로 명시(`appShellScroll` 을 본뜸).
3. **스캔 범위**: 지시는 `.tsx` 였으나 `.ts` 도 읽는다(상수 문자열이 `.ts` 에 생겨도 잡기 위한 상위 집합; 현재 `.ts` 의 토큰은 0). 읽는 파일 620, 토큰 22(= REV-173 세로 22곳 정확히 일치). 하한은 파일 ≥300·토큰 ≥22 + 알려진 상자(`MessageList`·`EvalResult`·`ConsoleShell`·`LessonScreen`·`RolePlayGoalCard`·`WordForm`·앱 셸 `layout`) 존재 + 상수 문자열(`RolePlayGoalCard`) 이 class 로 잡히는지.
4. **인라인 정규식 확장**: REV 후보 정규식(`overflowY = 'auto'`)은 `WordForm` 의 `style.overflowY = cond ? 'auto' : 'hidden'` 삼항을 못 잡아 같은 줄의 따옴표 auto|scroll 도 잡게 넓혔다(`===` 비교·`getComputedStyle(p).overflowY` 읽기·`[overflow-y:auto]` 임의 속성은 제외/변형으로 분류). 임의 속성 `[overflow-y:auto]` 와 `overflow-[auto]` 는 변형으로 분류.
5. 시험 위치는 지시대로 `src/components/shell/__tests__/` (REV §6 예시는 `common/__tests__`).
6. 규칙 주석은 한국어로 경위·이유를 길게 적었다(지시 「간결」보다 약간 김 — task-021·029·045·047 경위와 `main` 한정 이유를 CSS 가 직접 설명하게). 줄이길 원하면 Reviewer 가 알려주면 된다.

### 알려진 한계
- **정적 분석**이라 「이 상자가 `main` 안인가」를 알 수 없다 — 새로 생긴 `main` 밖 상자가 abspos 자손을 가지는 경우는 이 시험이 못 잡는다(허용 목록은 알려진 `main` 밖·인라인 항목의 사유 기록). `main` 안 새 상자는 규칙이 자동으로 덮는다.
- className 문자열 추출은 「토큰에서 가장 가까운 따옴표 쌍」 휴리스틱이라 템플릿 리터럴 안에 따옴표가 낀 특수 모양에서는 틀릴 수 있다(현재 22곳은 출력으로 확인). `<main` 판별은 가장 가까운 `<` 기준.
- 가로 줄(`overflow-x-auto` 15곳, `DayStrip` 캡션 포함)은 규칙 대상이 아니다(Leader 결정). 가로 줄 안에 깊은 sr-only 가 생기는 경우는 못 덮는다.
- 인라인 정규식은 같은 줄에서만 본다(줄을 나눠 쓴 객체 속성은 못 잡음).
- 규칙이 `main` 의 **후손**만 덮는다 — 앱 셸·콘솔 `main` 자신은 직접 `relative` 를 유지해야 하고 시험이 그것을 고정한다.

### NOT_VERIFIED (Reviewer·QA 에게)
- **그리기 순서(쌓임) 변화**: 위치 지정이 새로 생긴 상자(eval/new·challenge/new·eval/history·레슨·평가·역할극·`Composer` 등)가 같은 쌓임 안의 비위치 형제 위로 올라오는지 — 이번엔 **계산값만** 확인했고 **픽셀 비교(변경 전후, 360/390/412)는 안 했다**(Leader 지시대로 QA 몫). 겹치는 형제가 코드상 보이지 않는다는 REV-173 판단 외 근거 없음.
- 데이터가 필요한 화면의 실제 측정: 레슨 5단계·평가 결과·역할극 결과·챌린지 진행·콘솔 `DiffView`(QA 계정에 데이터 없거나 LLM 불가). 위 주입 실험은 DOM 에 채움을 넣은 모의다.
- 앱 WebView(Chromium 버전 차이)·Safari·실기기.
- 빌드 산출물은 LOCAL 미러 빌드 — 운영 빌드/Turbopack 설정이 같지만 운영에서 CSS 순서를 따로 확인한 것은 아니다(같은 소스·같은 Tailwind 4.3.3).

### 정리
- 실측 서버(3071)·자식 프로세스 종료, 쿠키 2개·미러의 `.env` 복사 삭제. QA 계정 데이터 생성·삭제 0(세션 토큰 발급은 기존 계정 `upsert update:{}`), 운영 서버(3010)·`db push`·`seed.ts` 접촉 0.
- 사용자 정리 폴더에 `~/.node-local/thekaiwa-t047` 추가(`node_modules` 는 `thekaiwa-t046-qa` 와 하드링크 공유, `.next` 빌드 산출물 포함).
- 임시 도구(저장소 밖, scratchpad): `measure047.mjs`·`inject047.mjs`·`con-debug.mjs`·`mut/driver.py`.

### 체크포인트 (인계용)
- **완료**: 전역 규칙 1개(`globals.css`)·콘솔 `main` `relative`·회귀 시험 8개·변이 15개·빌드 CSS 확인·세 폭 실측·주입 실험·정리.
- **남은 일**: Reviewer 감사(아래 「Reviewer 에게」), QA 화면 비교(변경 전후 픽셀·쌓임 확인, 360/390/412), 운영 배포는 사용자 확인 후.
- **다음 첫 행동(Reviewer)**: `git diff -- src` 3파일 확인 → 미러에서 시험 재실행(`KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-t047 bash scripts/sync-local.sh` 후 `node --import tsx --test src/components/shell/__tests__/scrollBoxPosition.test.ts`) → 허용 목록 사유·가드(`Sheet`·`Composer`·`WordForm`·`ConsoleNav`) 타당성, 규칙 주석 길이.
- **Reviewer 에게 넘길 사항**: ① 쌓임(그리기 순서) 변화는 미확인 — QA 픽셀 비교 필요 ② 허용 목록이 「`main` 밖」을 정적으로 증명하지 못한다는 한계를 수용할지 ③ `Composer` 를 허용 목록에 둔 판단(채팅방에선 `main` 안이라 규칙이 덮고 시트 안에선 포털) ④ 규칙 주석이 길다.
- **미커밋 파일**: `src/app/globals.css` · `src/components/admin/console/ConsoleShell.tsx` · `src/components/shell/__tests__/scrollBoxPosition.test.ts`(신규) · 이 이력서 · `agent-vault/20-Log/2026-10-10.md`.

## Reviewer 기록 (REV-174 — task-047 구현 감사)

- [2026-10-10][reviewer(sonnet)] 읽기 전용 감사. 대상 커밋 `9c8301d`(기준 `23e08b9`, 3파일 +379 −1). **불변 스냅샷**: `git archive 9c8301d` → scratchpad `snap174`(+`node_modules` `cp -al`, 깨진 링크 0, `.env` 없이 더미 `DATABASE_URL`). 개발자 미러 `~/.node-local/thekaiwa-t047/src` 와 `diff -rq` 출력 없음 [확실]. 변이 재현은 별도 복사본 `w175`(원복 뒤 `diff -rq -x probe.ts snap174/src w175/src` 출력 없음). 소스·시험·설정 수정 0, 도구 약 40회.
- **판정: PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 1 · Low 4 · Info 3). light 승격 필요 없음(변경 3파일·신규 화면/마이그레이션/네이티브/인증 변경 없음). `native_change: false`. QA 진행 가능 — 단 Medium 1건(시험의 `!` 수식어 구멍)은 개발자가 시험만 보강하도록 권고(아래 지시문).

### 직접 실행(스냅샷) — 개발자 보고와 일치
| 명령 | 결과 |
|---|---|
| `DATABASE_URL=mysql://invalid… node --import tsx --test src/components/shell/__tests__/scrollBoxPosition.test.ts` | **8/8 pass** |
| `node --import tsx --test $(find src/components src/app -name '*.test.ts*')` | **1058 tests, 1058 pass, 0 fail** (114파일). `editorScroller`·`appShellScroll` 수정 0 |
| `tsc --noEmit` | rc=0 |
| `eslint scrollBoxPosition.test.ts ConsoleShell.tsx` | rc=0 |
| `APP_ENV=LOCAL CLAUDE_CLI_PATH=/bin/false DATABASE_URL=더미 next build > build174.log 2>&1; echo $?` | **rc=0** (Turbopack, 16.3.2) |
| `git diff 23e08b9 9c8301d \| grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` | 출력 없음. native(`android\|plugins\|capacitor`) 변경 0 |
| `node ../.claude/tools/demo-gate/check.mjs check --task …task-047…md` | `DEMO_GATE_PASSED` · status `not_required`(judge 판정 none) · `evidence.jsonl` 에 task-047 줄 0 — 에이전트의 approve/waive 대행 흔적 없음 |

### A. 규칙의 정확성 — **PASS**
- ① [확실 — 선택자 의미] `:where(main .overflow-y-auto, main .overflow-auto, main .overflow-y-scroll, main .overflow-scroll){position:relative}` 는 자손 결합자라 **`main` 요소 자신에는 안 닿는다**(그래서 두 `main` 에 직접 `relative` + 시험 `mainSelf`). `main` 밖인 포털 `Sheet`(`createPortal(…, document.body)`, `open` 아니면 `null` — 대체 렌더 경로 없음 `Sheet.tsx:60·65·106`)·`ConsoleNav` aside(`main` 형제)는 비매치. `<main` 은 앱 셸 `(app)/layout.tsx:52`·콘솔 `ConsoleShell.tsx:37`·`(auth)/login:54`·`(auth)/invite:21` 뿐인데 `(auth)` 에는 `overflow` 0건(grep) → 규칙이 `(auth)` 에서 바꾸는 요소 0. 명시도 0(`:where`)에 `@layer base` 라 `absolute|fixed|sticky|relative|static` 유틸리티가 항상 이긴다. `globals.css` 에 층 밖 `position` 선언 0(grep: 이 규칙 하나).
- ② [확실 — 스냅샷 빌드 산출물 직접 확인] `.next/static/chunks/3c6lg_-t0_xl7.css`(64,468B): 층 순서 `@layer properties`(0) → `theme`(1484) → `base`(2902) → `components;`(6705) → `utilities{`(6723). 규칙은 base 블록 끝 `…[hidden]:where(:not([hidden=until-found])){display:none!important}:where(main .overflow-y-auto,main .overflow-auto,main .overflow-y-scroll,main .overflow-scroll){position:relative}}@layer components;@layer utilities{…`(오프셋 6597, 1회). `.absolute`·`.fixed`·`.relative`·`.sticky` 는 utilities 안(7089~7191). **개발자 인용과 구조 동일**. CSS 크기 차(62,747B 대 64,468B, 첫 차이 `--tw-outline-style`)는 스냅샷에 `docs/`·`agent-vault/` 가 있어 Tailwind 가 더 많은 텍스트를 스캔한 결과 — 규칙·층과 무관.
- ③ [가능성 높음] 가로 줄(`overflow-x-auto`) 제외는 현재 코드에서 맞다. 가로 줄 15곳 중 abspos 자손은 `DayStrip` 캡션(표 맨 위 = 줄의 정상 위치)뿐이고, 세로 상자 안의 가로 줄은 이제 containing block 이 `relative` 상자라 샌다고 보기 어렵다. 단 **미래 위험**(Info I-1): 숨은 입력(`peer sr-only`)이 `overflow-x-auto` 줄 안에서 화면 오른쪽 밖에 있으면 정적 위치가 `main` 의 **가로** 스크롤 영역을 늘릴 수 있다(재현하지 않음). `ChipRadio` 등 현재 가로 줄은 `<button>` 칩이라 해당 없음.

### B. 그리기 순서·위치 변화 — **PASS_WITH_NOTES (확정 결함 0, 시각 비교는 QA)**
이 규칙이 새로 `relative` 로 바꾸는 상자(앱 셸 `main` 후손, 이미 `relative` 가 아닌 것) **14곳**을 `grep` 으로 직접 뽑아 확인: `chat/Composer:146`(textarea)·`scenario/PracticeDock:102`·`scenario/RolePlayGoalCard:18`(상수, 사용처 `:48` 클래스 `min-w-0 px-4 pb-3` + 상수)·`eval/{EvalRunner:517,EvalHistory:164,EvalStartScreen:130,EvalResult:373,EvalScreen:34}`·`lesson/{LessonGenScreen:83,LessonEnd:90,StageSpeak:202,LessonScreen:293}`·`challenge/ChallengeCreateScreen:193`·`scenario/RolePlayResultScreen:38`. (REV-173 의 A 11 + 잠복 D 2 + `Composer`.) 이미 `relative` 였던 4곳(앱 셸 main·`MessageList`·`ScenarioDraft`·`VariantDraft`)은 값 불변.
- ① [확실 — 코드 정독] 각 상자는 「머리/탭줄 + 상자(flex-1) + 하단 액션」 세로 띠 구조(`TalkRoom.tsx:1060~1090`: 머리 → `RolePlayGoalCard`(상자) → `DisplayBar` → `MessageList`(wrapper `relative`) → 띠 → `PracticeDock`(상자) → `VoiceBar`/`Composer`)로 **띠끼리 레이아웃상 겹치지 않는다**. 14곳 클래스에 음수 여백·`translate`·`z-*`·`top/left/inset` 오프셋 0(grep). 상자보다 앞서 나오는 위치 지정 z-auto 형제는 `before:/after:` 히트영역 유사요소(투명)뿐: `TtsRuntimeStatusIndicator`(`before:-inset-y-3.5`, 회화 머리·평가 머리·레슨 머리), `StageSteps` 칩(`after:` 연결선은 nav 안). 상자 앞 형제 `BackBar` 는 이 화면들(`LessonGen·LessonEnd·EvalHistory·EvalStart·EvalResult·ChallengeCreate·RolePlayResult·EvalScreen`)에서 `sticky` 가 없는 평범한 띠이고(확인: 각 파일 `BackBar` 줄이 상자 줄 바로 앞), `AppBar`/`BackBar sticky` 는 `z-10`, `Toast/UndoToast` 는 `fixed z-50` 이라 z-index 가 있어 **상자 내용이 그 위로 올라올 수 없다**. `StageSpeak` 의 `PushToTalkButton` 은 상자(`:202`~`:368`)가 아니라 그 뒤 하단 띠(`:405`, `flex-none border-t bg-surface`) 안이라 트리 순서가 상자보다 뒤 → 변경 전후 같은 위에 그려진다. 남는 이론상 위험은 인접 띠의 투명 히트영역(예: `EvalRunner` 머리 표시등의 유사요소가 아래 `nav` 로 약 4px 걸침)이 **탭 판정에서** 뒤로 밀리는 정도인데, 걸치는 곳이 상자가 아니라 `nav`/머리 띠이고 상자 쪽은 `pt-3.5` 빈 여백이라 실효 없음 [가능성 높음].
- ② [확실] 상자 안 `absolute`/`sticky` 자손의 명시 오프셋: `PushToTalkButton:79`(`-inset-1.5`, 부모 버튼 `relative:77`)·`DraftEditor:37`(부모 `relative:36`)·`WordSoundButton:54`(부모 `relative:40`) — 전부 안쪽 `relative` 부모 기준이라 불변. `sticky` 는 스크롤 상자가 위치 지정이 없어도 기준이 같다(`BackBar/AppBar` 는 상자 밖). 접두어 붙은 `md:absolute` 등 0건(grep), `before/after:absolute` 는 자기 요소가 `relative`(REV-173 24줄 중 표본 `StageSteps:264`·`EvalHistory:176`·`createParts:179` 확인).
- ③ [확실] `fixed` 자손은 containing block 이 뷰포트(상자에 `transform` 없음)라 영향 없음. 브라우저 쪽 `offsetParent` 의존 JS 는 `grep offsetTop|offsetParent|offsetLeft` 로 **`EvalRunner.tsx:163` 하나**(`cur.offsetLeft`)뿐이고 그 `strip` 은 상자(`:517`)가 아니라 `nav` 안이라 offsetParent(앱 셸 `main`)가 불변.
- ④ [확실] 콘솔 `main` `relative`: 콘솔 `main` 후손의 `absolute` 는 `admin/configEditor/ui.tsx:97` 하나(부모 `:96` `relative` → 불변), `fixed` 는 `FlowBar.tsx:44`(`z-[8]`, 뷰포트 기준 불변). 콘솔 껍데기 행(`EnvStrip`·`ConsoleBar`·`ConsoleSidebar`)에 위치 지정/`z-*` 0이고 `main` 은 마지막 grid 행이라 겹침 없음. `(auth)`·`(admin)` 레이아웃은 REV-173 §4 대로(관리자 레이아웃은 `ConsoleShell` 위임, 로그인/초대는 규칙이 닿는 상자 0).
- **QA 화면 비교 대상(쌓임 의심 지점 — 코드로는 확정 못 함)**: 아래 「high_risk_areas」.

### C. 시험의 질 — **PASS_WITH_NOTES**
- ① 의미 있는 고정인가: 시험 4(실제 `globals.css` 규칙 존재·층·선언), 5(빈 통과 방지), 6(변형·인라인·`main` 자신), 7(허용 목록 사실 가드), 8(콘솔 `main` 토큰)은 **실제 파일을 읽어** 판정한다. 시험 1~3 은 판별기 자체 점검(모양 사례·정책·CSS 파서)이라 자기 참조 성격이나 판별기가 틀렸을 때 실제 시험이 빈 통과하는 것을 막는 역할이라 정당. **다만 `kind='class'`(접두어 없는 표준 토큰)는 `main` 자신이 아닌 한 어떤 경우에도 실패하지 않는다** — 안전은 시험 4(규칙 존재)에 전적으로 기댄다. 그러므로 허용 목록 `Sheet`·`Composer`·`ConsoleNav` 항목은 합격/불합격을 바꾸지 않고 「사유 기록 + `must/mustNot` 사실 가드」만 한다(헤더 `:11~12` 가 `main` 밖 새 상자를 못 잡는다고 이미 인정). 합격 선.
- ② 정규식 직접 탐침(복사본에서 `scanSource` 에 입력, `probe.ts`): 
  - 정상 처리: `cn()` 인자 분리·상수 문자열(`GOAL_REGION_MAX`)·`md:`·`max-lg:`·`group-hover:`·`overflow-[auto]`·`overflow-y-[scroll]`·`[overflow-y:auto]`·여러 줄 속성·`style.overflow = 'auto'`·`setAttribute('style','overflow-y: auto')`·`md:overflow-y-auto!`(variant 로 잡힘).
  - **구멍 M-1(Medium)**: `!overflow-y-auto`(앞 `!`)·`overflow-y-auto!`(Tailwind 4 뒤 `!`)가 **`class`(규칙이 덮음)로 분류**된다 — `CLASS_TOKEN`(`:42`) 경계 `[^\w-]` 가 `!` 를 먹고 뒤쪽 `!` 는 `(?![\w-])` 를 통과. 그러나 실제 생성 클래스 `.\!overflow-y-auto`/`.overflow-y-auto\!` 는 선택자 `.overflow-y-auto` 에 안 걸려 **상자가 `relative` 가 안 되는데 시험은 통과**. 재현: 새 파일 `<div className="!overflow-y-auto p-2"><span className="sr-only">x</span></div>`(X1)·`overflow-y-auto!`(X2) → 8/8 pass(아래 변이 표). 현재 소스 0건(잠복).
  - Low L-1: `stripComments`(`:25`) 가 문자열·JSX 텍스트 안의 ` // `(앞 글자가 `:`/따옴표/`\` 가 아닌 경우)를 줄 주석으로 오인해 **같은 줄 뒤쪽을 지운다**. 재현 `const u = 'a // b'; const c = <div className="md:overflow-y-auto"/>` → 토큰 0개로 통과(P3), `<p>그리고 // 슬래시</p><div className="md:overflow-y-auto"/>` 동일(P3b). URL(`://`)은 보호됨.
  - Low L-2: `enclosingString`(`:47~53`) 은 「가장 가까운 따옴표 쌍」 휴리스틱이라 템플릿 안 삼항 `` `${open ? 'p-1' : 'p-2'} md:overflow-y-auto` `` 에서 `cls` 가 쓰레기 구간(`} md:overflow-y-auto`}/>\nconst b = <i className=`)이 된다(P1). 그 구간에 `fixed`/`relative`/`sticky` **식별자**가 우연히 있으면 `hasPositionToken` 이 오통과할 수 있다(변형·`main` 자신 검사에만 영향). 개발자가 「알려진 한계」로 적음.
  - Info I-2: `P12` `<main className={x ? 'overflow-y-auto' : 'relative'}>` 는 다른 가지의 `relative` 를 못 봐 실패 — fail-closed 라 오히려 안전.
  - Info I-3: 동적 조립 `` `overflow-${a}-auto` ``(X3) 과 `globals.css` 의 클래스형 `.scrolly{overflow-y:auto}`(X4) 는 스캔 대상이 아니라 통과. 헤더 주석에 「동적 조립·`.css` 는 못 잡는다」를 한 줄 더 적으면 좋다. 현재 소스 0건.
- ③ 허용 목록 가드: `Sheet`(`createPortal(` 존재)·`Composer`/`WordForm`/`ConsoleNav`(`sr-only|absolute` 부재)는 주석 제거 뒤 파일 텍스트로 확인한다. `ConsoleNav` 의 자손 `ConsoleNavList`(`ConsoleNav.tsx:12`)는 **같은 파일**이라 가드가 실효 [확실]. `Sheet` 의 `createPortal(` 존재만으로는 「본문이 `main` 밖」을 증명하지 못하지만(주석에 들어가면 `stripComments` 가 지움) 포털을 빼면 가드가 깨지므로 합격 선. 약하다고 볼 정도는 아님.
- ④ 하한: 파일 ≥300(실제 620)은 넉넉. **토큰 ≥22 는 현재 정확히 22** → 정상 리팩터로 세로 스크롤 상자 하나를 지우면 「정규식이나 경로가 깨졌나?」로 실패한다. 의도라면(상자 수 변동을 눈에 띄게) 괜찮으나 안내 문구가 실제 원인을 가린다. 이미 알려진 상자 6곳+앱 셸 `layout`+`GoalCard` kind 를 이름으로 고정하고 있으니 숫자는 느슨히(예: ≥15) 둬도 빈 통과는 막힌다. Low L-3.
- ⑤ **변이 직접 재현 8건**(복사본, 시험 파일만 실행, 항목마다 원복): 개발자 보고와 같은 결과.

| 변이 | 결과 |
|---|---|
| 기준선 | 8/8 pass |
| M1 규칙 블록 제거 | 실패 1(globals.css 규칙) |
| M2 선택자 `main .overflow-auto` 삭제 | 실패 1 |
| M4 새 파일 `md:overflow-y-auto` | 실패 1(변형) |
| M7 `ConsoleShell` `relative` 제거 | 실패 2(`<main>` 자신 + 콘솔 main 시험) |
| M8b 규칙을 `@layer components` 로 | 실패 1 |
| M12 `Sheet` 에서 `createPortal(` 제거 | 실패 1(허용 목록 가드) |
| M14 `GoalCard` 상수를 `max-lg:overflow-auto` | 실패 2(변형 + 하한/sentinel) |
| M-layout 앱 셸 `main` `relative` 제거 | 실패 1(`<main>` 자신) |
| **X1 새 파일 `!overflow-y-auto` + `sr-only`** | **8/8 pass — 오통과(M-1)** |
| **X2 새 파일 `overflow-y-auto!` + `sr-only`** | **8/8 pass — 오통과(M-1)** |
| X3 새 파일 `` overflow-${a}-auto `` | 8/8 pass(I-3, 한계) |
| X4 `globals.css` 에 `.scrolly{overflow-y:auto}` | 8/8 pass(I-3, 한계) |
- ⑥ `editorScroller.test.ts`·`appShellScroll.test.ts` diff 0, 114파일 전체 통과로 **공존 확인**. 서로 겹치는 단언(앱 셸 `main` 의 `relative`, 편집기 상자의 명시 `relative`)은 모순이 아니라 이중 방어.

### D. 구조·범위·규칙 — **PASS**
- `git diff 23e08b9 9c8301d` 전체 정독: `globals.css`(+19: 주석 12줄 + 규칙 1개), `ConsoleShell.tsx`(`relative` 1 토큰 + JSX 주석 1줄), 시험(신규). **문구·간격·동작 변경 0**, 위치 지정(`position: relative`)뿐. JSX 주석 `{/* … */}` 는 grid 자식 노드를 만들지 않는다. 시험은 `node:assert/strict`·`node:fs`·`node:path` 만 import(`@/modules/*` 0, 엔진명 0). 보이지 않는 문자 0, native/Android 변경 0, `versionCode` 변동 없음. 앱 WebView 호환: 이 스타일시트는 이미 Tailwind 4 의 `@layer`/`:where()` 를 쓰므로 새 문법 도입 없음 [확실 — 빌드 산출물이 전부 `@layer`].
- 규칙 주석이 길다(12줄)는 개발자 질문(④): 경위·이유가 코드 밖 어디에도 없어 이 규칙의 「왜 `main` 으로 좁혔나」를 CSS 가 직접 설명하는 편이 낫다. **수용**. 단 주석 속 「15곳」(REV-173: A 13 + 잠복 D 2)은 이 규칙이 실제로 계산값을 바꾸는 14곳(위 B 목록)과 숫자가 달라 읽는 사람이 헷갈릴 수 있다 — Info I-4(숫자 대신 task-047 참조로 충분).

### E. 문서 후속(위치만 — 이번 감사에서 수정하지 않음)
1. `docs/screens.md` 마지막 절 `## 17. task-046 …`(`8824`행) 뒤에 새 절 `## 18. 안쪽 스크롤 상자의 위치 기준 (task-047)`: 규칙 한 줄·`main` 자신은 직접 `relative`·`absolute|fixed|sticky` 가 이김·가로 줄/동적 조립/`.css` 는 못 덮는다·새 세로 스크롤 상자를 만들 때의 체크.
2. `docs/screens.md:2051` 콘솔 껍데기 예시 `<main className="min-h-0 min-w-0 overflow-y-auto bg-ground">` 가 `relative` 없이 낡았다 → 맞출 것(`:203`·`:1440` 의 「`main` 이 스크롤되지 않는다」 서술은 그대로).
3. `CLAUDE.md` 「모바일 UI 원칙」(`75`행) 「화면당 스크롤 1곳」 뒤에 한 문장 — 「`main` 안 세로 스크롤 상자는 `globals.css` 규칙이 `relative` 로 만든다, `main` 자신은 직접 `relative`」.
4. (선택) `src/app/(app)/layout.tsx:50` 주석에 규칙 위치 포인터.

### 발견 목록
| ID | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| M-1 | **Medium** | `src/components/shell/__tests__/scrollBoxPosition.test.ts:42`(`CLASS_TOKEN`)·`:73`(분류) | `!overflow-y-auto`·`overflow-y-auto!` 가 `class` 로 분류돼 규칙이 못 덮는데 통과(X1·X2 재현, 소스 0건 잠복). 시험의 약속(「새 상자도 잡는다」)과 어긋남 | `!` 가 앞뒤에 붙은 토큰을 `variant`(규칙이 못 덮음)로 분류 + 판별기 자체 점검에 두 줄 추가 |
| L-1 | Low | 같은 파일 `:25`(`stripComments`) | 문자열·JSX 텍스트 안 ` // ` 가 뒤쪽을 지움(P3/P3b) | 한계 주석 한 줄 또는 문자열 인지 제거. 현재 소스에 해당 모양 0 |
| L-2 | Low | 같은 파일 `:47~53`(`enclosingString`) | 템플릿 안 삼항에서 `cls` 쓰레기(P1) → 식별자 `fixed` 등으로 오통과 가능 | 이미 「알려진 한계」. 수용 가능 |
| L-3 | Low | 같은 파일 `:333` | 토큰 하한이 현재값(22)과 같아 정상 리팩터에도 깨지고 안내가 원인을 가림 | 하한을 느슨히(≥15) 하거나 메시지에 「상자를 지웠다면 하한을 낮출 것」 |
| L-4 | Low | `src/app/globals.css` 규칙 주석 | 「15곳」이라는 숫자가 실제 변경 14곳·REV-173 A 13 과 어긋남 | 숫자 제거 |
| I-1 | Info | 규칙 범위 | 가로 줄 안 숨은 입력의 가로 누수 가능성(미재현) | 문서 §18 에 한계로 적기 |
| I-3 | Info | 시험 헤더 | 동적 조립·`.css` 클래스는 못 잡음(X3·X4) | 헤더 한 줄 |
| I-5 | Info | 규칙 범위 | `overflow-hidden` + 긴 숨은 내용 + 인라인 `sr-only` 조합은 이 task 범위 밖(규칙은 `auto|scroll` 만) | 필요 시 후속 후보 |

### 개발자 수정 지시문 초안 (M-1, 시험 파일만)
> `scrollBoxPosition.test.ts` 의 `CLASS_TOKEN` 이 `!overflow-y-auto` 와 `overflow-y-auto!`(Tailwind 중요 표시)를 접두어 없는 표준 토큰(`class`)으로 분류해, 실제 클래스 `.\!overflow-y-auto` 가 규칙 `.overflow-y-auto` 에 안 걸리는데도 통과한다(복사본 재현: 새 파일에 `<div className="!overflow-y-auto"><span className="sr-only">x</span></div>` → 8/8 pass). `class` 로 판정하기 전에 토큰 바로 앞 글자가 `!` 이거나 바로 뒤 글자가 `!` 이면 `variant` 로 분류하도록 고치고, 판별기 자체 점검(시험 1)에 `kinds('<div className="!overflow-y-auto">') === ['variant']`, `kinds('<div className="overflow-y-auto!">') === ['variant']` 두 줄을 더하라. 다른 코드·소스는 건드리지 말 것. 고친 뒤 시험 파일 diff 만 Reviewer 가 좁게 재확인한다(QA 와 병행 가능, 재순환 전체는 불필요).

### QA 에 넘길 high_risk_areas (변경 전후 화면 비교, 360/390/412, `native_change: false`)
1. **회화방 하단 쌓임**: `PracticeDock`(bg-surface·border-t, `TalkRoom.tsx:1087`) ↔ 위 띠(`strip`) ↔ 아래 `Composer`/`VoiceBar`, 역할극 모드에서 `RolePlayGoalCard` 펼침 영역(`TalkRoom.tsx:1063`, `max-h 40dvh`) ↔ `TalkRoomHeader` 표시등 히트영역. Composer textarea 초점·키보드 올림 때 위치 이동 없음.
2. **레슨 화면**: `StageSteps` 연결선(`after:`) ↔ 상자 위 이음새, 5단계 `StageSpeak` 하단 `PushToTalkButton` 후광(`-inset-1.5`) 이 상자 아래 끝과 겹치는 모습, `LessonEnd`·`LessonGenScreen`(복습 모드).
3. **평가**: `EvalRunner` 머리의 표시등(`TtsRuntimeStatusIndicator`, 말하기 유형) ↔ `nav` ↔ 상자 이음새, `EvalResult`·`EvalHistory`·`EvalStartScreen` 목록 끝까지 스크롤·하단 버튼 가림 없음.
4. **챌린지 만들기**(`ChallengeCreateScreen`): 숨은 라디오에 키보드 방향키/탭 초점을 옮겨 `main` 이 아니라 **상자**만 스크롤되는지(BackBar/하단 탭이 안 밀림). 내용이 길어지는 계정이면 더 좋음.
5. **역할극 결과**(`RolePlayResultScreen`): 긴 결과에서 같은 확인.
6. **콘솔**: 설정 편집(`ConfigScreen`, `FlowBar` 고정 막대 `z-[8]`·토글 점 `ui.tsx:96~97`)·diff·이력·발음 사전 표에서 문서 스크롤이 생기지 않는지, 1024px 이상 사이드바 유무 폭에서 `main` 위치.
7. 공통: 위 화면의 변경 전(`23e08b9`)/후(`9c8301d`) **픽셀 비교** — 계산값만 본 개발자 실측(위치값)을 보완.

### NOT_VERIFIED
- 그리기 순서(쌓임)·히트 판정의 **시각/동작 확인 전부**(코드로 겹침 근거를 못 찾았다는 뜻일 뿐, 렌더 비교 아님) — QA 몫.
- 실제 앱 WebView(Chromium 버전)·Safari·실기기, 긴 내용 데이터(레슨 5단계·평가 결과·역할극 결과·콘솔 `DiffView`).
- 가로 줄 안 숨은 입력의 가로 누수(I-1)와 `overflow-hidden` 조합(I-5)은 재현하지 않음.
- 운영 빌드(`scripts/deploy.sh`)에서의 CSS 층 순서는 미확인 — 같은 소스·같은 Tailwind 4.3.3 이므로 같을 가능성이 높으나 배포 뒤 확인 대상.
- 도구 한계: 이 감사는 서버를 띄우지 않았다(지시).

## Developer 기록 (REV-174 수정 — M-1·L-3·L-4)

- [2026-10-10][developer(sonnet)] REV-174 PASS_WITH_NOTES 지적 수정. **시험 파일과 `globals.css` 규칙 주석만** 고침(규칙 선택자·선언, `ConsoleShell.tsx`, 소스 불변). 미커밋(Leader 가 diff 확인 뒤 경로 지정 커밋). `native_change: false`.

### 조치
| 항목 | 조치 |
|---|---|
| **M-1** | `scrollBoxPosition.test.ts` 의 `CLASS_TOKEN` 분류에서 토큰 바로 앞 글자(경계 그룹)나 바로 뒤 글자가 `!` 이면 `variant` 로 분류(`!overflow-y-auto`·`overflow-y-auto!`·`md:!overflow-auto`). 판별기 자체 점검에 `kinds` 3줄 + 정책 3줄(`bad('<div className="!overflow-y-auto">…') === 1`, `overflow-y-auto!` 1, `relative !overflow-y-auto` 0) 추가 |
| **L-3** | 토큰 하한 22 → **15**, 파일 하한 300 유지(실제 약 620). 이유를 시험 안 주석에 적음(하한은 「디렉터리 이동·정규식 고장으로 0건 통과」만 막고, 일부만 놓치는 고장은 알려진 상자 이름 검사가 잡는다). 알려진 상자에 `common/Sheet.tsx` 추가(7곳). 실패 메시지에 「상자를 대거 정리한 변경이면 하한·목록을 함께 손볼 것」 추가 |
| **L-4** | `globals.css` 규칙 주석 「같은 결함이 15곳 남아」→ 「같은 결함이 남아, 한 규칙으로 바꿨다 (조사 당시 후보 15곳 중 이 규칙이 실제로 새로 `relative` 로 바꾸는 상자는 14곳)」. 주석 1줄 추가만, 규칙·공백·순서 불변 |
| **L-1** (선택, 함) | `stripComments` 의 줄 주석 제거를 정규식에서 줄 단위 스캐너로 교체: **같은 줄에서 닫히는 따옴표 밖의 `//`** 만 주석으로 본다(`'a // b'`·`"https://…"` 보존). 짝 없는 따옴표(JSX 텍스트 아포스트로피·여러 줄 템플릿)는 문자열로 보지 않아 옛 동작으로 되돌아가고, `\` 는 다음 글자를 건너뛰어 정규식 리터럴 `/^W\//` 의 `\/` 를 주석 시작으로 오인하지 않는다. 자체 점검 5줄 추가(문자열 안 `//`·URL·정규식 리터럴·줄 끝 주석·짝 없는 아포스트로피) |
| **L-2** (선택, **안 함**) | 템플릿 리터럴 안 삼항 따옴표가 `enclosingString` 의 className 구간 추정을 흐리는 문제는 따옴표 짝 휴리스틱을 파서 수준으로 바꿔야 해서 건너뜀. 시험 머리 주석에 「알려진 한계」로 적음. I-3(동적 조립 `overflow-${x}-auto`·`.css` 클래스형 규칙은 스캔 대상 아님)과 L-1 의 남은 한계(JSX 텍스트의 따옴표 밖 `//`)도 같은 머리 주석 2줄에 적음 |

### 실행 증빙 (홈 미러 `~/.node-local/thekaiwa-t047`, `KAIWA_LOCAL_ROOT` 로 sync, NFS 와 `diff -rq src` 출력 없음)
- 시험 3개(`scrollBoxPosition` + `editorScroller` + `(app)/__tests__/appShellScroll`): **14/14 pass**. `src/components/**` 전체 **1001/1001 pass**, `src/components + src/app` 전체 **1058/1058 pass**(REV-174 와 같은 수, 새 단언만 늘었고 시험 개수는 그대로).
- `tsc --noEmit` rc=0. `eslint scrollBoxPosition.test.ts` rc=0. 보이지 않는 문자 `git diff -- src | grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` 0건.
- `next build` **생략**: 이번 변경은 시험 파일과 CSS **주석**뿐이라 번들 산출물이 같다(주석은 빌드에서 제거됨). 규칙·층 순서 확인은 REV-174 의 산출물 점검이 그대로 유효.
- **L-1 스캐너 개정이 실제 소스 스캔을 바꾸지 않음**: 개정 전(`HEAD`)·후 시험으로 `scanTree()` 를 덤프해 `cmp` — 620파일 22토큰, 열쇠·종류·토큰·`mainSelf`·`cls` 전부 동일. 또 옛 정규식 방식과 새 스캐너를 `components`+`app` 전 소스 줄 단위로 비교해 **다른 줄 0개**(첫 시도에서 정규식 리터럴 `/^W\//` 두 줄이 달랐고 `\` 건너뛰기를 넣어 해소 — `app/api/v1/speech/config/route.ts`·`app/models/[...path]/route.ts`).

### 변이 재현 (새 scratchpad 복사본 `work`, 항목마다 원복, 마지막 `diff -rq pristine work` 출력 없음)
| 변이 | 수정 **전** 시험(HEAD) | 수정 **후** 시험 |
|---|---|---|
| 기준선 | 8/8 | 8/8 |
| **M-1 X1** 새 파일 `<div className="!overflow-y-auto"><span className="sr-only">x</span></div>` | **8/8 pass (오통과)** | **실패 1** (변형: 직접 위치 지정 필요) |
| **M-1 X2** `overflow-y-auto!` | **8/8 pass (오통과)** | **실패 1** |
| M-1 X3 `md:!overflow-y-auto` | (미시험) | 실패 1 |
| L-1 새 파일 `const u = 'a // b'; <div className="md:overflow-y-auto">` | **8/8 pass (오통과)** | **실패 1** (이제 잡힘) |
| M1 규칙 블록 제거 | — | 실패 1 |
| M2 선택자 `main .overflow-auto` 삭제 | — | 실패 1 |
| M4 새 파일 `md:overflow-y-auto` | — | 실패 1 |
| M7 `ConsoleShell` `<main>` 의 `relative` 제거 | — | 실패 2 (`<main>` 자신 + 콘솔 main 시험) |
| M12 `Sheet.tsx` 의 `createPortal(` 제거 | — | 실패 1 (허용 목록 가드) |

### 가이드와 달라진 점·판단
- 가이드의 L-3 예시(「알려진 파일 `MessageList`·`EvalResult`·`ConsoleShell`·`Sheet` 포함 여부」)대로 `Sheet` 를 알려진 상자 목록에 더했다(`Sheet` 는 토큰이 1개라 열쇠가 경로 그대로 — 토큰이 둘 이상으로 늘면 `…#1` 열쇠가 되어 이 항목이 깨지므로 그때 목록을 손볼 것).
- L-4: Reviewer 는 「숫자 제거」를 권했으나 Leader 지시(후보 15곳 중 실제 14곳)대로 숫자를 정확한 표현으로 바꿨다. 「14곳」은 REV-174 가 `grep` 으로 센 값을 인용한 것이고 이번에 다시 세지 않았다(주석 숫자는 시간이 지나면 낡을 수 있어 「조사 당시」로 한정).

### 미해결·한계
- L-2(템플릿 안 삼항 따옴표)·I-3(동적 조립·`.css`)·JSX 텍스트의 따옴표 밖 `//` 는 시험이 못 잡는다 — 현재 소스에 해당 모양 0건, 시험 머리 주석에 기록.
- 하한 15·알려진 상자 7곳은 판단값이다. 세로 스크롤 상자를 대거 정리하면 하한과 목록을 함께 손볼 것.
- Reviewer 재확인은 시험 파일 diff 와 `globals.css` 주석 1줄만 좁게 보면 된다.

### 변경 파일 (미커밋)
- `src/components/shell/__tests__/scrollBoxPosition.test.ts` (+57 −5 근처)
- `src/app/globals.css` (주석 2줄)

## QA 기록 (qa-047-b — 콘솔 변경 전후 비교)

> 체크포인트 1 (진행 중) — 환경: 변경 전 `http://127.0.0.1:3072`·변경 후 `http://127.0.0.1:3073`(Leader 기동, 둘 다 LOCAL·`next start`), `QA_ACCOUNT=super` 쿠키(scratchpad 파일, 권한 600, 종료 시 삭제). 측정 스크립트 `scratchpad/qa047b/qa047b-compare.mjs`(원 출력 `scratchpad/qa047b/out/`). 방법: 화면마다 **4회 로드(A1·A2=변경 전 두 번, B1·B2=변경 후 두 번)** 로 노이즈를 거른다 — 일관된 차이 = (A1==A2 이고 B1==B2 인데 A1!=B1). 시계·「N초 전」텍스트는 `visibility:hidden` 으로 가려 시각 노이즈 제거(양쪽 동일; 첫 시도에서 「마지막 갱신 HH:MM:SS」 시계가 노이즈 원인임을 확인).
> 
> **B1 완료 — 콘솔 유휴 상태, 10개 화면 × 5개 폭**(dashboard·connections·configuration·llm·speech/tts·speech/tts/lexicon·lexicon/versions·history·diagnostics·voices; 폭 360/390/412 모바일(`isMobile`·DSF 2.625) + 1024/1280 데스크톱) × 맨 위·맨 아래 + 모바일 dashboard 는 메뉴 시트 열기·닫기까지 = 106개 상태 셀, 오류 0.
> - 겹침 순서(9×16 격자 `elementsFromPoint` 상위 5): 일관된 차이 **0점**(노이즈 0점). 픽셀: 일관된 차이 **0%**(노이즈 최대 0.0088%). 문서 스크롤 누수 `docDelta` 전 셀 변경 전 0 → 변경 후 0(악화 0). `main` 계산값 변경 전 `static` → 변경 후 `relative`(전 화면).
> - 기하: 일관된 차이 요소 **2개**(전 셀 중) — `/admin/speech/tts/lexicon` 의 맨 아래 상태, 1024·1280 폭에서만: `table > caption`(`sr-only` 1×1px) 의 위치가 변경 전 문서 기준(y=635/617)에서 변경 후 `main` 기준(y=330/362)으로 이동(차이 = 그 시점 `main.scrollTop` 305/255 와 일치). 보이지 않는 1×1 요소의 좌표 변화이며(규칙의 의도된 결과: `sr-only` 가 `main` 스크롤을 따라감) 픽셀·겹침 차이 0. 시각 변화 아님.
> - 판정(B1): **PASS**.
>
> **B2 완료 — 콘솔 상호작용 상태(읽기 전용, 설정 저장·적용·되돌리기·연결 테스트 미조작), 13개 사례 × 5개 폭 = 185개 상태 셀, 오류 0.**
> 사례: ① 설정 편집 화면 열기(`/admin/configuration?target=claude-cli-local&tab=form|raw|diff`, `?scope=APP_SETTING&tab=form`) × {맨 위·초점 이동·맨 아래} — 초점은 첫 라디오(탭 줄)·첫 텍스트 입력(`input[type=text]`/`textarea`)·첫 `[role=switch]` 토글(`focus()` 만, 값 변경 없음) 각각 ② diff/이력(`/admin/speech/tts/lexicon/versions` mainSH 2040, `/admin/history`) ③ 표·가로 줄 화면 가로 스크롤 끝까지(`/admin/speech/tts/lexicon`, `/admin/voices`, `/admin/connections`, `/admin/diagnostics?tab=traces`) ④ 키보드 `Tab` 5회·추가 7회·`Shift+Tab` 5회(`/admin/dashboard`, 사이드바/바 링크 초점 이동).
> - **문서 스크롤 누수·`window.scrollY`·`main.scrollTop`·`activeElement`·가로 스크롤 상자 상태**: 변경 전후 차이 **0건**(185셀 전부 동일). 문서 `docDelta` 전 셀 0, 문서 가로 넘침 0.
> - 겹침 순서(9×16 격자): 일관된 차이 **0점**. 기하: 2셀(B1 과 같은 `lexicon` 맨 아래 `table > caption` `sr-only` 1×1px, 데스크톱 1024·1280만 — 좌표만 이동, 시각 변화 없음).
> - **픽셀: 11개 셀에서 데스크톱(1024·1280)만 소수 픽셀 차이** — 전부 설정 화면(`configuration`)의 초점 상태: 52px(0.005%, 최대 채널차 ±2/255)·35px(최대 ±5/255, 2 초과 8px)·32px(±5)·28px(±1)·10px(±1)·3px(±2). 위치는 초점 링·둥근 모서리 가장자리(예: APP_SETTING 폼 `x=300·404, y=241~246` 의 주황색 테두리 모서리 안티앨리어싱 `[204,87,51]→[204,86,50]`, `[213,120,90]→[212,116,86]`)이고 두 번의 독립 전체 실행(1차 0.0032%/0.0031%, 2차 35/32px)에서 같은 곳에 재현되어 **결정적**이다. 모바일(360/390/412)은 0px. 요소 위치·크기·겹침 순서 변화는 없다(기하·겹침 0) — 레이어 합성 변경에 따른 가장자리 래스터 차이로 보이지만 [추측] 확정하지 못함. 육안으로 식별 불가한 수준(최대 5/255, 총 35px).
> - 판정(B2): **PASS_WITH_NOTES**(합격선 「픽셀 0」 엄격 적용 시 데스크톱 초점 링 모서리 서브픽셀 차이 ≤35px 가 남음 — 시각 결함 아님, Leader 판단).
>
> **B3 완료 — 문서 스크롤 누수 재현 대조(실제 콘솔 화면 2곳 × 폭 2 × 변형 2, 서버 쓰기 없음·새로고침 원복).** 화면: `/admin/speech/tts/lexicon/versions`(mainSH 2040)·`/admin/configuration`. 방법: 페이지 안에서 `main` 안쪽 래퍼 끝에 높이 2400px 빈 블록을 덧붙이고 (a) `radio`: `<label><span class="sr-only">x</span><input type="radio" class="peer sr-only"></label>` 덧붙이고 `input.focus()` (b) `dot`: `position:absolute;width:1px;height:1px` 점 덧붙임. `main` 계산값·조상 사슬은 변경 전 `main:static < div:static < div:static < body:static < html:static`, 변경 후 `main:relative < div:static < …`(조상은 둘 다 위치 지정 없음 — 규칙의 효과가 `main` 한 곳에서만 나온다는 단서).
>
> | 폭 | 화면 | 변형 | 변경 전(3072) 문서Δ / scrollY / main.scrollTop | 변경 후(3073) 문서Δ / scrollY / main.scrollTop |
> |---|---|---|---|---|
> | 390 | versions | radio | 3640 / 3640 / 0 | **0 / 0 / 3680** |
> | 390 | versions | dot | 3641 / 0 / 0 | **0 / 0 / 0** |
> | 390 | configuration | radio | 3108 / 3108 / 0 | **0 / 0 / 3148** |
> | 390 | configuration | dot | 3109 / 0 / 0 | **0 / 0 / 0** |
> | 1280 | versions | radio | 3664 / 3664 / 0 | **0 / 0 / 3704** |
> | 1280 | versions | dot | 3665 / 0 / 0 | **0 / 0 / 0** |
> | 1280 | configuration | radio | 2797 / 2797 / 0 | **0 / 0 / 2837** |
> | 1280 | configuration | dot | 2798 / 0 / 0 | **0 / 0 / 0** |
>
> - 변경 전: `sr-only` 입력 초점(radio)에서 **문서가 스크롤**(`window.scrollY`=문서Δ, 콘솔 바·환경 띠까지 같이 밀림)·`main` 은 움직이지 않음, 점(dot)은 문서 높이만 늘어남(Δ≈3100~3665). 변경 후: 문서Δ 0·`window.scrollY` 0·**`main` 만 스크롤**(radio 는 `main.scrollTop`=최대치, 초점이 안에서 보이게 감). 개발자 재현(1px 점, Δ=2851→0)과 같은 방향이며 실제 콘솔 화면 2곳·2폭에서 대조가 나온다 → 규칙·콘솔 `main` `relative` 의도대로 동작.
> - 판정(B3): **PASS**.
>
> ### 종합 판정 (qa-047-b)
> | 항목 | 판정 | 근거 |
> |---|---|---|
> | B1 콘솔 유휴 비교 | PASS | 106셀: 겹침 0·픽셀 0%·문서Δ 0→0·기하 변화는 보이지 않는 `sr-only` caption 1×1px 좌표 이동 1건(데스크톱 맨 아래) |
> | B2 상호작용 상태 | PASS_WITH_NOTES | 185셀: 문서Δ·scrollY·scrollTop·초점·가로 스크롤 차이 0, 겹침 0, 데스크톱 초점 링 모서리 서브픽셀(≤35px, ≤±5/255, 결정적) 11셀 |
> | B3 누수 대조 | PASS | 변경 전 문서Δ 2797~3665 → 변경 후 0, 두 폭·두 화면·두 변형 |
> - FAIL 0 · 결함 없음. NOT_VERIFIED: ① 콘솔 `ConnectionDetail`·`plugins/[id]`·`diagnostics/traces/[traceId]`·`speech/realtime|analysis` 상세 화면(비교 대상 밖; `speech/*`·`plugins` 는 discover 로 열림만 확인) ② 변경 시 나타나는 FlowBar 고정 막대(편집 값 변경 필요 — 수정 금지로 미조작; 설정 폼 DOM 에 `fixed` 래퍼 1개는 존재, 기하·겹침 차이 0) ③ 데이터가 없어 안 열리는 상태(대량 감사 로그·긴 `DiffView`) ④ 실기기·앱 WebView ⑤ 사용자 앱 화면(`(app)`) — 이 레인(qa-047-b)은 콘솔만.
> - 산출물 정리: scratchpad `qa047b/` 의 쿠키 파일·crop.png·dbg 스크립트 삭제, 서버(3072·3073)는 끄지 않음(Leader 소유). 스크립트·원 출력 `…/scratchpad/qa047b/{qa047b-compare.mjs,out/b1-*.jsonl,out/b2-*.jsonl,out/b3.jsonl,out/b1-summary.txt,out/b2-summary.txt}`.
>
> **재현 조건(시각 검증)**: Chrome(`/usr/bin/google-chrome` headless) · 폭×높이 360×740 / 390×844 / 412×892(`isMobile`·`hasTouch`·DSF 2.625), 1024×768 / 1280×800(`isMobile:false`·DSF 1) · ko-KR · Asia/Seoul · light(OS 기본 `prefers-color-scheme`; `reducedMotion: reduce`) · `document.fonts.ready` 대기 + networkidle + 1s · 애니메이션·전환·캐럿 투명 주입 · 시계/「N초 전」 텍스트 `visibility:hidden` · 캡처 범위: 뷰포트(상태별) · 네트워크 fixture 미사용(실서버 3072/3073 읽기 전용) · 로드당 4회(A·A·B·B)로 노이즈 분리.

## QA 기록 (qa-047a — 앱 셸 변경 전후 비교)

- [2026-10-10][qa(sonnet)] 대상 `9c8301d`(변경 후 3073) ↔ 변경 전(3072, 규칙 없음). **판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · **Low 1(QA-047a-L1)** · Info 2. 서버는 끄지 않았다(Leader 지시). 소스·시험 수정 0, LLM 슬롯 미사용(`claude --print` 프로세스 0 확인, 서버 `CLAUDE_CLI_PATH=/bin/false`).
- 측정 스크립트(원본은 scratchpad `q47/qa047a-compare.mjs`, 이력서에는 방법만): 화면마다 **A1(3072) → B(3073) → A2(3072)** 순서로 연달아 열어 노이즈 바닥(A1 vs A2)과 변경(A1 vs B)을 같이 쟀다. 비 GET 요청은 `route.abort`(저장·체크인 POST 차단), 읽기 전용.

### QA 시각 검증 — 재현 조건
| 항목 | 값 |
|---|---|
| 뷰포트 | 360×740 · 390×844 · 412×892 (모바일 에뮬레이션 `isMobile+hasTouch`, DSF 2.625), 콘솔 추가 1280×800(DSF 1) |
| 브라우저 | `/usr/bin/google-chrome` headless(Playwright `playwright-core`) |
| 테마·지역 | light(시스템 기본) · ko-KR · Asia/Seoul · `reducedMotion: reduce` + `animation/transition/caret-color` 전부 끔 주입 |
| 로딩 대기 | `domcontentloaded` → `networkidle`(12s 한도) → +1s → 「불러오는 중」 문구 사라질 때까지(7s 한도) → `document.fonts.ready` → +0.3s |
| 네트워크 | 실서버(운영 빌드 `next start` 127.0.0.1:3072/3073, LOCAL) · 읽기 전용 · 같은 쿠키 |
| 계정 | QA1(교정 카드·채팅 3개) · QA2(없음) · QA4(상황 시트) · super(콘솔, 추가 — 아래 사유) |
| 캡처 범위 | 뷰포트 1장(맨 위 / `main`·안쪽 상자 맨 아래로 스크롤한 뒤), 비교는 PNG 디코드 후 픽셀 단위(채널 차 >24 = 「보이는 차이」, >0 = 「정확한 차이」) |
| 허용 범위 | 기하 차이 0(반올림 0.5px) · 겹침 순서 차이 0 · 픽셀 차이 = 같은 서버 두 번 비교(노이즈)와 같거나 작음 · 누수 지표 변경 후 ≤ 변경 전 |
| 데모 게이트 | `demo=none`(light·`DM-light-waive`) — 기준 화면 = 변경 전 3072 (승인 데모 없음) |

### A1. 앱 셸 화면 변경 전후 비교(유휴) — **PASS** (144 상태 = 24 화면 × 맨 위/맨 아래 × 3폭, 오류 0)
**노이즈 바닥(변경 전 두 번 비교): 기하 차이 0 · 겹침 순서 차이 0 · 픽셀 차이 0(정확 일치)** — 이 화면들은 시각·무작위 요소가 없어 노이즈가 0 이다.
**변경(A1 vs B): 기하 차이 0(비-sr) · 겹침 순서 다른 점 0/144×(9×16 격자) · 픽셀 차이 0(정확 일치) · 누수 지표 전=후 · 가로 스크롤(`scrollWidth−clientWidth`) 0=0 · 문서 세로 누수 0=0 · 초점/스크롤 위치 전=후.**

| 화면(계정) | 도달 | `main` 안 상자 `position` 전→후 | 기하/겹침/픽셀 차이 | `main.scrollHeight−clientHeight` 전=후(390) |
|---|---|---|---|---|
| `/settings`(QA1) | 200 | 상자 없음 | 0/0/0 | 3223(맨 아래 `scrollTop` 3223 동일) |
| `/study/ai?tab=talk`·`?tab=chat`(QA1, QA2) | 200 | 상자 없음 | 0/0/0 | 0 |
| `/study/ai?tab=scenario`(QA1) · 상황 시트(QA4, 시트 열림 `dialog 1/1`) | 200 | 상자 없음 | 0/0/0 | 1527 |
| `/study/today`(QA1, QA2) | 200 | 상자 없음 | 0/0/0 | 260 |
| `/plan`(QA1, QA2) | 200(`?month=2026-10`) | 상자 없음 | 0/0/0 | 460 |
| `/drawer/words`(QA1, QA2) · `/ask` | 200 | 상자 없음 | 0/0/0 | 0 |
| `/study/today/eval/new` | 200 | **static→relative 1곳** | 0/0/0 | 0 |
| `/study/today/eval/history` | 200 | **static→relative 1곳** | 0/0/0 | 0 |
| `/plan/challenge/new` | 200 | **static→relative 1곳** | 0/0/0 | 0 |
| `/plan/challenges` | 200 | 상자 없음 | 0/0/0 | 0 |
| `/study/ai/scenario/new` | 200 | relative→relative(이미 있음) | 0/0/0 | 0 |
| `/study/today/talk/new` · `/paste` | 200 | 상자 없음 | 0/0/0 | 67 · 0 |
| `/study/ai/chat/<QA1 채팅 42건>` | 200 | MessageList relative→relative · **Composer `textarea.overflow-y-auto` static→relative** | 0/0/0 (유휴) | 0(상자 `scrollTop` 3775 동일) |
| `/settings/scenarios` · `/settings/utterances` | 200 | 상자 없음 | 0/0/0 | 84 · 0 |

- 위치값이 실제로 바뀐 요소는 **4개 화면의 상자뿐**(eval-new·eval-history·challenge-new·chat-room 의 Composer). 나머지 20개 화면은 `main` 안에 세로 스크롤 상자가 없어 규칙이 닿지 않는다. 360 폭 `challenge-new` 맨 아래 상태에서 sr-only(1px) 5개의 rect 만 달랐다(상자 안으로 기준이 옮겨 갔기 때문 — 의도된 변화, 비-sr 요소 0).
- 열리지 않은 화면: 없음(전부 200, 로그인 리다이렉트 없음). 데이터가 없어 못 연 화면은 아래 NOT_VERIFIED.

### A2. 상호작용 상태 비교 — **PASS (+ Low 1 관찰)** (3폭 × 상태 17개, 오류 0)
| 상태 | 열림 확인 | 기하 | 겹침 | 픽셀 | 초점 뒤 `main`·`window` 스크롤 |
|---|---|---|---|---|---|
| ① 회화 탭 [＋ 새 회화] 시트 | `dialog 1/1` | 0 | 0 | 0 | 변화 0 |
| ② `/study/ai/scenario/new` 입력칸 초점 | 필드 1개 | 0 | 0 | 0 | 변화 0 |
| ③ `/plan` 날짜 칸 → `DaySheet` | `dialog 1/1`, 칸 10개 중 10번째 | 0 | 0 | 0 | 변화 0 |
| ④ `/settings` 토글·슬라이더·라디오 9개 순차 초점 | — | 0 | 0 | 0(초점 0·중간·마지막 3상태) | **전=후 완전 일치**(마지막 `main.scrollTop` 360:2492 · 390:2077 · 412:2040, 둘 다 같음, `window` 0). 초점이 화면 밖 컨트롤을 보이려고 `main` 을 움직이는 것은 설계된 동작이며 변경 전에도 같다 |
| ⑤ 단어장 [검색] 입력 초점(QA1·QA2) | 입력 1개 | 0 | 0 | 0 | 변화 0 |
| ⑥ (추가) 채팅방 Composer textarea 초점 | `textarea=1` | **0** | **0** | **차이 있음 — 아래 L1** | 변화 0 |

#### [QA-047a-L1] Low — Composer(`textarea.overflow-y-auto`) 초점 때 포커스 링 가장자리 안티앨리어싱이 변경 후 달라진다
- 실행: `W=390 MODE=a2 ONLY=a2-chat-composer-focus node qa047a-compare.mjs` — `/study/ai/chat/<QA1 채팅>` 에서 Composer textarea 에 `focus()`.
- 실제: 변경 전(A1) vs 변경 후(B) 보이는 차이 픽셀 **0.147%**(360 0.169% · 412 0.141%), 정확 차이 0.304%, **노이즈 0**(A1 vs A2 완전 일치). 위치는 textarea 둘레(CSS 좌표 x 12~356, y 792~836 @390)와 전송 버튼 원둘레(희미). 최대 채널 차 78/255 — 링 위쪽 가장자리 한 줄이 A 는 `(255,255,255)→(229,151,0)`, B 는 `(251,238,215)→(236,180,71)→(229,151,0)` 로 **링이 약 0.3 기기 픽셀 위로 번진다**. 육안으로 나란히 봐도 구별되지 않는다(캡처 비교로 확인). 유휴(초점 없음) 상태는 차이 0.
- 기하·겹침: **0**(rect·`elementsFromPoint` 모두 같음). 계산된 스타일 전수 비교(전 요소 모든 속성, 노이즈 0)에서 달라진 것은 이 textarea 의 `position: static → relative`(+ 파생 `top/left/right/bottom: auto→0px`) **9개 속성뿐**.
- 기대: 픽셀 차이 0. 원인 추정 [가능성 높음]: 전역 규칙이 클래스명(`overflow-y-auto`)만 보고 `textarea` 같은 폼 컨트롤까지 위치 지정해 Chromium 이 이 요소를 따로 그려(위치 지정 요소는 자기 페인트 층) 포커스 링 box-shadow 의 소수 픽셀 스냅이 달라진다. 영향: 시각 차이 사실상 없음, 기능 차이 없음 — **Leader 판단 사항(수용 또는 `textarea` 제외)**. 같은 이유로 `overflow-y-auto` 를 단 다른 폼 컨트롤에도 닿는다(소스에서 `textarea`+`overflow-*` 같은 줄 매치는 0, 클래스를 `cn()`/상수로 합치는 곳은 정적 검색으로 못 잡음 — 개발 확인 필요).

### A3. 스크롤 누수 재현(대조) — **PASS** (변경 전은 새고 변경 후는 안 샌다, 3폭 모두)
방법: 상자에 높이 2400px 블록(`flex:none`) + 마지막 줄 `<label><span class="sr-only">x</span><input type="radio" class="peer sr-only"></label>` 를 DOM 으로 덧붙이고 그 입력에 `focus()`. 서버 쓰기 없음. (첫 시도에서 `flex-col` 상자는 블록이 0 으로 줄어 대조가 약했다 → `flex:none` 으로 보정해 재측정, 아래는 재측정값.)

| 화면·상자 | `position` 전→후 | 변경 전 `main` Δ(주입 후→초점 후) · `main.scrollTop` | 변경 후 `main` Δ · `main.scrollTop` · 상자 `scrollTop` | 판정 |
|---|---|---|---|---|
| `/plan/challenge/new` | static→relative | 360: 2423 · 2423 / 390: 2300 · 2300 / 412: 2232 · 2232 | **0 · 0 · 2518 / 2395 / 2327** | PASS(개발자 보고 2314→0 재현) |
| `/study/today/eval/new` | static→relative | 360: 2650 / 390: 2546 / 412: 2498(`main` 이 스크롤) | **0 · 0 · 2682 / 2578 / 2530** | PASS |
| `/study/today/eval/history` | static→relative | 360: 1940 / 390: 1836 / 412: 1788 | **0 · 0 · 1972 / 1868 / 1820** | PASS |
| `/study/ai/scenario/new` 편집기 | relative→relative | 0 | 0 · 0 · 상자만 스크롤(2405/2301/2253) | PASS(전후 모두 0, 대조 기대와 일치) |
| `/study/ai/chat/<id>` MessageList | relative→relative | 0 | 0 · 0 · 상자 6839/6175/6127 | PASS(이미 안전) |
| 같은 방 Composer textarea | static→relative | 0(상자 자체가 스크롤 불가·2px) | 0 | 영향 없음 |
| `/settings` | 상자 없음 | — | — | 해당 없음(`main` 이 스크롤 상자 자신) |
| `/plan/challenges`·`/study/today/talk/new`·`/drawer/words` | 상자 없음 | — | — | 해당 없음 |

- 대조가 두 서버 모두 0 이거나 모두 >0 인 경우(= 규칙이 안 먹는 FAIL 후보)는 없다 — 규칙은 의도대로 동작한다(상자는 `main` 의 자손, 계산된 `position: relative`).

### 추가(Leader 지시 밖, 변경 파일에 `ConsoleShell` 이 있어 high_risk_areas #6 확인) — 콘솔 `main` (super QA 계정, LOCAL 에서만 유효·읽기 전용)
- 사유·범위: 지시한 계정은 QA1/2/4 였으나 콘솔 변경(`ConsoleShell main relative`)이 실제 변경 파일이고 high_risk_areas 에 있어 QA super 계정(`qa-super@thekaiwa.test`, 기존 QA 고정 계정) 쿠키로 **읽기 전용 GET 9화면**만 열었다(`/admin/dashboard·configuration·history·connections·llm·plugins·voices·speech/tts·speech/tts/lexicon`, 쓰기·진단 실행·LLM 없음). 다른 계정 데이터 생성·삭제 없음.
- 결과(72 상태 = 9화면 × 맨 위/맨 아래 × 360/390/412/1280): **기하 차이 0(비-sr) · 겹침 순서 차이 0 · 문서 세로 누수 0=0 · 가로 0=0 · 스크롤 위치 전=후**. `main` 위치 `static → relative` 가 9화면 전부에서 확인. 픽셀 차이는 38 상태에서 0.002~0.019%(같은 서버 두 번 비교 노이즈 0.003~0.019% 와 같은 범위 — 시각·실시간 지표 표시가 있어 바닥이 0 이 아니다; 390·1280 에서 노이즈 표본을 2번 더(A1-A3, A1-A2 재측정) 뽑아 변경값이 그 범위 안임을 확인, 예: `c-llm` 390 노이즈 0.0063·0.0183·0.0191 ↔ 변경 0.0078). 기하·겹침이 0 이라 구조 변화 없음 → **PASS(픽셀은 노이즈 이내)**.
- **콘솔 누수 대조(A3 방식)**: `main` 에 2400px + sr-only 라디오 주입 후 초점. **1280 폭**(문서가 스크롤하는 폭): 변경 전 `window.scrollY` 2092(`/admin/history`)·2837(`/admin/configuration`)·문서 높이 +2092·+2837 — 문서 전체가 따로 스크롤·늘어남(= 이번에 고친 결함), 변경 후 `window` 0·문서 Δ 0·`main.scrollTop` 2092/2837 로 `main` 만 스크롤. **390 폭**(`main` 이 스크롤 상자): 변경 전 초점이 `main` 을 전혀 움직이지 못함(`scrollTop` 0), 변경 후 `main.scrollTop` 2087/3148 로 숨은 입력이 보이도록 이동 — 개선. 둘 다 **PASS**.

### Info
- **I-1** 변경 후 빌드 CSS(1개, 62,337→62,747B)에 쓰이지 않는 유틸리티 8개가 새로 생겼다: `.overflow-auto`·`.overflow-scroll`·`.overflow-visible`·`.overflow-y-scroll`·`.p-1`·`.max-lg\:overflow-auto`·`.md\:overflow-y-auto`·`.[overflow-y:auto]`(규칙 단위 diff: 변경 전 전용 1 = 병합된 `.overflow-y-auto` 규칙, 변경 후 전용 9 = 위 8개 + 새 `:where(...)` 규칙, 공통 979규칙의 순서 동일). 원인 [추측]: Tailwind 가 새 시험 파일(`scrollBoxPosition.test.ts`)의 문자열·주석 속 토큰을 후보 클래스로 읽음. 24화면·콘솔에서 기하·픽셀 차이가 0 이라 DOM 에 쓰이는 곳은 없다는 근거(해당 클래스를 실제로 단 요소가 있었다면 변경 전 CSS 에도 규칙이 있었을 것).
- **I-2** `main` 안 세로 스크롤 상자 4곳(eval-new·eval-history·challenge-new·chat Composer)이 이번에 실제로 `relative` 가 됐고, 나머지는 이미 안전하거나 상자가 없다. 이 변화가 닿는 곳이 얼마 안 되는 만큼 데이터가 필요한 화면(아래)에서 닿는 곳이 더 있을 수 있다.

### NOT_VERIFIED (데이터·계정·실기기가 없어 못 연 것 — PASS 로 적지 않음)
- 레슨 화면(`StageSteps` 연결선·`StageSpeak` 하단 `PushToTalkButton` 후광·`LessonEnd`·`LessonGenScreen`), `EvalRunner`(머리 표시등·`nav`)·`EvalResult` 긴 결과, `RolePlayResultScreen`, 회화방(`TalkRoom` — `PracticeDock`·`RolePlayGoalCard`·`TalkRoomHeader` 표시등; QA 계정에 TALK 방이 없어 채팅방 `MessageList`/`Composer` 로 갈음), 챌린지 상세·진행 중 챌린지, `/study/today/words/new`(열면 세션이 시작될 수 있어 열지 않음), 콘솔 설정 편집(`ConfigScreen` `FlowBar`·diff 뷰·표 긴 데이터), `/admin/diagnostics`(외부 호출 우려로 열지 않음).
- 키보드를 실제로 올렸을 때의 위치(가상 키보드 흉내 없이 `focus()` 만), 실제 앱 WebView·Safari·실기기, TalkBack, 운영 빌드 배포본의 CSS 층 순서(같은 Tailwind·같은 소스라 같을 가능성이 높으나 배포 뒤 확인).
- 타 계정(데이터 많은 사용자)의 긴 목록에서 새로 `relative` 가 된 상자 위로 올라오는 형제 요소 가림 — 이번 데이터(교정 카드 있는 QA1·없는 QA2)에서는 겹침 순서 차이 0.
- 라이트 모드만 측정(다크 토큰 반전은 이 변경과 무관해 범위 밖).

### 정리·체크
- 실행 명령(요약): `W=360|390|412 MODE=a1|a2|a3|ac node qa047a-compare.mjs <out.jsonl> [ONLY=…]`(+ 3폭 병렬), `node dbg-style.mjs`(계산된 스타일 전수 비교), `node a3c.mjs`(콘솔 누수 대조). 원 출력: scratchpad `q47/{a1,a2,a2c,ss,ac,cn,a3,a3b}-*.{jsonl,log}`, 빌드 CSS 두 개 `css-307[23]-*.css`.
- **미정리 행·폴더 없음**: QA 데이터 생성·삭제 0(비 GET 전부 차단). QA 계정 쿠키 파일 4개(QA1·QA2·QA4·super)·`/tmp/qa-artifacts/TheKaiwa/task-047/` 비교 PNG 삭제. 띄운 서버 없음(3072·3073 은 Leader 소유, 그대로 둠). `claude --print` 프로세스 0.

## Developer 기록 (QA-047a-L1 처리 — textarea 제외)

- [2026-10-10][developer(sonnet)] QA-A 의 Low 1건(QA-047a-L1: 채팅방 `Composer` `textarea` 초점 링 가장자리 픽셀 0.14~0.17%)을 처리했다. **`globals.css` 전역 규칙 선택자에서 `textarea` 를 빼고(`:not(textarea)`) 시험을 맞췄다.** 소스(`ConsoleShell.tsx` 포함)·다른 파일은 불변. 미커밋(Leader 가 diff 확인 뒤 경로 지정 커밋). `native_change: false`, 마이그레이션 없음, 새 의존성 없음.
- 데모 게이트: 화면 파일(`src/app/globals.css`)을 건드리지만 보이는 의미는 변하지 않고(변경 전과 같은 화면으로 되돌림) task 의 `demo=none` 판정 범위 안이다.

### 변경 파일 (미커밋)
- `src/app/globals.css` — 규칙 선택자 4개를 `main .overflow-y-auto:not(textarea)` 꼴로, 규칙 주석에 한 단락(폼 컨트롤 제외 사유, QA-047a-L1) 추가. `:where()` 유지(명시도 0), `@layer base` 유지.
- `src/components/shell/__tests__/scrollBoxPosition.test.ts` — `REQUIRED_SELECTORS` 를 새 선택자 4개로, `Composer.tsx` 허용 사유 문구를 「규칙에서도 `:not(textarea)` 로 제외」로 보강, 머리 주석 1줄, CSS 규칙 판정 자체 점검에 「`:not(textarea)` 삭제 → 실패」 단언 1개.

### 판단 — `textarea` 만으로 충분한가
- `grep -rnE 'overflow-(y-)?(auto|scroll)' src`(시험 제외)에서 폼 컨트롤 태그에 이 클래스를 쓰는 곳은 **`src/components/chat/Composer.tsx:146` 의 `<textarea>` 하나뿐**. `<input>`·`<select>` 에 쓰는 곳 0건. `WordForm.tsx` 의 `textarea` 는 인라인 스타일(`style.overflowY`)이라 클래스 규칙이 애초에 닿지 않는다. → `:not(textarea)` 로 충분.
- 한계: 앞으로 `input.overflow-y-auto` 가 생기면 같은 부작용이 되살아날 수 있다. 시험은 이것을 잡지 않는다(정적 스캔이 요소 태그를 보지 않음). 현재 소스 0건이라 가드를 더하지 않았다(규칙 주석에 「`input`·`select` 에는 이 클래스를 쓰는 곳이 없다」고 현황을 적음).

### 빌드 산출물 확인 (미러 `~/.node-local/thekaiwa-t047-qa`, `next build` rc=0, `.next/static/chunks/2vdq9hzp5so1f.css` 62,905B)
- 규칙이 그대로 살아 있다(인용): `…:where(main .overflow-y-auto:not(textarea),main .overflow-auto:not(textarea),main .overflow-y-scroll:not(textarea),main .overflow-scroll:not(textarea)){position:relative}}@layer components;@layer utilities{…`
- 위치 확인(중괄호 깊이 계산): `@layer base{` 는 오프셋 2861~6720, 규칙은 6549(그 안), `@layer components;` 6720, `@layer utilities{` 6738 → **규칙은 `@layer base` 안, utilities 보다 앞**, `:not(textarea)` 4개 보존, 층 밖 규칙 없음.

### 실행 증빙 (홈 미러 `~/.node-local/thekaiwa-t047`, `KAIWA_LOCAL_ROOT` 로 sync, NFS 와 `diff -rq src` 출력 없음)
- 시험 3개(`scrollBoxPosition` 8 + `editorScroller` + `src/app/(app)/__tests__/appShellScroll`): **14/14 pass**. (지시문의 `src/components/shell/__tests__/appShellScroll.test.ts` 는 없는 경로 — 실제 파일은 `src/app/(app)/__tests__/` 에 있다.)
- `src/components/**`+`src/app/**` 전체(114파일): **1058/1058 pass**(기준 1058 과 같음 — 새 단언은 기존 시험 안에 들어감).
- `tsc --noEmit` rc=0. `eslint scrollBoxPosition.test.ts` 오류 0(`globals.css` 는 eslint 설정 밖이라 「File ignored」 경고뿐). 보이지 않는 문자 `git diff -- src | grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` 0건.

### 변이 확인 (새 scratchpad 복사본 `mut47b/work`, 항목마다 `pristine` 에서 원복, 끝에 `diff -rq pristine work` 출력 없음)
| 변이 | 결과(8개 중) | 실패한 시험 |
|---|---|---|
| M1 `:not(textarea)` 4개 모두 삭제 | 실패 1 | `globals.css` 규칙 시험 |
| M2 선택자 1개 삭제(`.overflow-scroll`) | 실패 1 | 〃 |
| M3 선언 `position: static` | 실패 1 | 〃 |
| M4 `.overflow-auto` 한 개에서만 `:not(textarea)` 삭제 | 실패 1 | 〃 |
| M5 `@layer base` 블록 이름을 바꿔 규칙 제거 | 실패 1 | 〃 |
| M6 `LessonEnd.tsx` 에 `md:overflow-y-auto` 추가(표준 토큰 옆) | 실패 1 | 소스 스캔(변형 직접 위치 지정 필요) |
| M7 `LessonEnd.tsx` 의 표준 토큰을 `md:overflow-y-auto` 로 | 실패 1 | 〃 |
| M8 `:not(textarea)` → `:not(input)` | 실패 1 | `globals.css` 규칙 시험 |
- 빠진 변이: 층 밖 이동(기존 판별기 자체 점검이 `ruleProblems` 로 이미 고정, 새로 만들지 않음).

### L1 실측 해소 확인 (변경 전 `127.0.0.1:3072` ↔ 변경 후 `127.0.0.1:3073`, 같은 QA1 쿠키, 읽기 전용: 비 GET `route.abort`, LLM 불가 `CLAUDE_CLI_PATH=/bin/false`, 모바일 에뮬레이션 DSF 2.625, `reducedMotion: reduce` + 애니메이션 끔)
후 서버 = 미러 `thekaiwa-t047-qa` 에서 `sync-local` → `prisma generate` → `next build`(rc 0) → `APP_ENV=LOCAL … next start -H 127.0.0.1 -p 3073`. 측정은 QA-A 스크립트(`qa047a-compare.mjs`)를 경로만 바꿔 복사해 재사용(A1(3072) → B(3073) → A2(3072) 순서로 연달아 열어 노이즈 바닥과 변경을 같이 측정).

| 확인 | 360 | 390 | 412 |
|---|---|---|---|
| ⓐ 채팅방 `Composer` `textarea` **초점** 변경 전↔후 픽셀 차이(보이는 >24 / 정확 >0) | **0% / 0%** | **0% / 0%** | **0% / 0%** |
| 〃 같은 상태 노이즈 바닥(변경 전 2회) | 0 / 0 | 0 / 0 | 0 / 0 |
| 〃 기하 차이 / 겹침 순서 차이 | 0 / 0 | 0 / 0 | 0 / 0 |
| 〃 맨 아래 상태(`composer-focus-bottom`) 픽셀 | 0 / 0 | 0 / 0 | 0 / 0 |
| 〃 변경 전 QA-A 값(참고) | 0.169 / – | 0.147 / 0.304 | 0.141 / – |
| ⓑ `textarea` 계산된 `position` 전→후 | static→**static** | static→**static** | static→**static** |
| 〃 `MessageList` | relative→relative | 〃 | 〃 |
| 〃 `Composer` 초점 상태 전 요소 계산된 스타일 전수 비교(`dbg-style.mjs`, 390) | 차이 **0개 속성**(노이즈 0, QA-A 는 9개) | | |
| ⓒ `/study/today/eval/new`·`/eval/history`·`/plan/challenge/new` 상자 `position` | static→**relative** | 〃 | 〃 |
| 〃 3화면 × 맨 위/맨 아래 픽셀 차이(보이는/정확) | 0 / 0 | 0 / 0 | 0 / 0 |
| 〃 기하(비-sr)·겹침 차이 | 0 | 0 | 0 |
| ⓒ' 스크롤 누수 대조(DOM 2400px + 숨은 라디오 `focus()`) 변경 후 `main` Δ / `main.scrollTop` / 상자 `scrollTop` — `challenge-new` | 0 / 0 / 2518 | 0 / 0 / 2395 | 0 / 0 / 2327 |
| 〃 `eval-new` | 0 / 0 / 2682 | 0 / 0 / 2578 | 0 / 0 / 2530 |
| 〃 `eval-history` | 0 / 0 / 1972 | 0 / 0 / 1868 | 0 / 0 / 1820 |
| 〃 변경 전(참고, 규칙 없음) `main` Δ | 2423 · 2650 · 1940 | 2300 · 2546 · 1836 | 2232 · 2498 · 1788 |
| 〃 채팅방 `MessageList`·`Composer` `textarea` | 전후 모두 0(textarea 는 스크롤 가능 높이 2px) | 〃 | 〃 |
| ⓓ 노이즈 바닥(변경 전 서버 2회 비교): 모든 상태에서 보이는 0 / 정확 0, 기하·겹침 0 | ✔ | ✔ | ✔ |
- 총 비교: a2(채팅방 초점) 9상태 + a1(4화면×맨위/맨아래) 24상태 + a3(누수) 15건(폭당 5) + 스타일 전수 1건 — 오류 0, 접속 200/200.
- 360 폭 `challenge-new` 맨 아래에서 `sr-only`(1px) 5개의 rect 만 달랐다(상자 안으로 기준이 옮겨 간 의도된 변화 — QA-A 기록과 같다. 비-sr 요소는 0).
- 결론: **QA-047a-L1 해소**(0.147% → 0%), 기존 이득(스크롤 누수 대조 `main` Δ → 0)은 유지.

### 가이드와 달라진 점·판단
- 지시문의 시험 경로 `src/components/shell/__tests__/appShellScroll.test.ts` 는 존재하지 않는다 → 실제 `src/app/(app)/__tests__/appShellScroll.test.ts` 로 대체해 실행했다.
- 변이를 치환할 때 `rm -rf` 를 쓰는 사전 훅(GateGuard)에 걸려 새 디렉터리(`mut47b`)를 만들어 쓰는 방식으로 바꿨다(이전 `mut47` 은 만들어지지 않음).
- 시험에 「공백이 다른 `:not( textarea )` 는 거부」 단언을 넣었다가 지시(공백·순서에 느슨하게)와 어긋나 지웠다. 실제 파서는 줄바꿈·들여쓰기에 느슨하다(`:where(` 안 최상위 쉼표로 자르고 공백을 접는다).

### 알려진 한계
- `input`·`select` 에 이 클래스가 붙는 미래 변경은 시험이 잡지 않는다(위 판단 참조).
- 실기기·TalkBack·가상 키보드 상태는 이번에도 NOT_VERIFIED. 읽기 전용이라 Composer 에 글을 입력해 본 상태(여러 줄로 커진 textarea)는 열지 않았다 — 위치값이 `static` 으로 변경 전과 같으므로 그 상태도 같은 계산 경로다 [가능성 높음].

### 정리
- 띄운 서버 `127.0.0.1:3073`(내가 기동, pid 2432263) 종료, `127.0.0.1:3072`(변경 전)는 Leader 소유라 그대로 둠. 쿠키 파일(`q47l1/ck1`) 삭제, PNG 산출물 없음(`art/` 비어 있음). QA 데이터 생성·삭제 0. `claude --print` 프로세스 0.
- 미러 `~/.node-local/thekaiwa-t047-qa` 는 재빌드된 상태(`.next` = 이 변경 포함)로 남겨 둠. 스크래치 복사본 `scratchpad/mut47b`.

### 체크포인트 (인계용)
- 완료: 규칙 선택자 `:not(textarea)`·주석·시험 맞춤·변이 8건·빌드 CSS 확인·3폭 실측. 남은 일: Reviewer 가 diff(`globals.css` 선택자·주석, 시험 15줄)만 좁게 확인 → Leader 가 경로 지정 커밋. 다음 첫 행동: `git diff -- src` 확인.
- 미커밋 파일: `src/app/globals.css`, `src/components/shell/__tests__/scrollBoxPosition.test.ts`.

---
## Reviewer 기록 (REV-175 — task-047 textarea 제외 재감사)

- [2026-10-10][reviewer(sonnet)] 대상: QA-047a-L1 처리 로컬 커밋 `3d0485c`(직전 `1b9d099` 대비 `src/app/globals.css`·`src/components/shell/__tests__/scrollBoxPosition.test.ts` 2파일, +20/-4). 읽기 전용 — 소스·시험 수정 0. 불변 스냅샷 `git archive 3d0485c`(scratchpad `r175/snap`, `node_modules` 는 `cp -al` 하드링크, `.env` 복사·값 미출력)에서 직접 실행했다.
- **판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · **Low 1(L-1)** · Info 2. `native_change: false`.

### 판정 항목별
| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 선택자 의미 | **PASS** | 빌드 CSS 를 헤드리스 Chrome(`file://` 로 빌드 산출 `.css` 적용)에서 `getComputedStyle(position)`: `main` 안 `div.overflow-y-auto`·`.overflow-auto`·`.overflow-y-scroll`·`.overflow-scroll` → **relative**, `textarea.overflow-y-auto`·`textarea.overflow-auto` → **static**, `div.overflow-y-auto.absolute` → absolute · `.sticky` → sticky(utilities 층이 이김), `overflow-x-auto` → static, `main` 밖 `.overflow-y-auto` → static. 명시도: `@layer base { main .specprobe{position:static} }`(0,1,1)와 같은 층에서 `div.overflow-y-auto.specprobe` 가 **static** → `:where()` 안 `:not(textarea)` 가 명시도를 더하지 않는다. `src` 전수(`scan.mjs`, 시험 제외·주석 줄 포함 후보 24줄, `overflowY` 인라인 포함): `textarea` 는 `Composer.tsx:146` 하나, `input`·`select`·`contenteditable`·`role=textbox|combobox` 에 이 클래스를 쓰는 곳 **0**(`WordForm.tsx:25` 는 인라인 `style.overflowY` 라 클래스 규칙이 닿지 않음, `VocabDeck.tsx:78` 는 `isContentEditable` 읽기뿐). |
| 2 | 혜택 0 전제 | **PASS** | `Composer.tsx` 에 `sr-only`·`absolute`·`relative` 0건. `textarea` 는 자식 요소를 가질 수 없고, 같은 `form` 형제는 `leading`(`TalkRoom.tsx:1112` 일반 `button`+`svg`)·전송 `button` 뿐이라 `sr-only` 형제도 없다. 형제의 containing block 은 textarea 가 아니라 가장 가까운 위치 지정 조상(`main`)이므로 textarea 의 `position` 이 형제 기준을 바꾸지 않는다. 즉 task-021·029·045 가 막으려던 시나리오(`main` 기준 `sr-only` 가 `main` 스크롤을 늘림)는 textarea 에서 성립하지 않는다. |
| 3 | 빌드 CSS | **PASS** | 스냅샷 `next build`(`node node_modules/next/dist/bin/next build > log 2>&1`) rc=0, `.next/static/chunks/1kk2coxi6yq6y.css`. 규칙은 **1건**, 4개 선택자 모두 `:not(textarea)` 보존, 중괄호 깊이 계산으로 `@layer base`(오프셋 2913~6760) **안**, `@layer utilities`(6795) **앞**, 층 밖 `main .overflow-*` 규칙 0. (개발자 보고 CSS 62,905B 와 크기가 다른 것은 스냅샷 루트의 `docs/`·`agent-vault/` 를 Tailwind 가 후보 클래스로 함께 읽은 탓 [가능성 높음] — 규칙 위치와 무관.) |
| 4 | 시험 | **PASS_WITH_NOTES** | 새 단언 의미 있음: `REQUIRED_SELECTORS` 가 `:not(textarea)` 꼴이라 실제 `globals.css` 에서 하나라도 빠지면 시험 4가 실패하고, 자체 점검의 `bare` 단언(`:not(textarea)` 전부 삭제 → 문제 4건)이 판별기 자체를 고정한다. 파서 `whereList` 는 `(`·`[` 깊이로 최상위 쉼표만 자르고 공백을 접어 다중행 `:where(\n …\n)`·`:not(textarea)` 의 괄호에 견고(자체 점검에 다중행 케이스 있음, 실제 파일이 다중행으로 통과). **직접 변이 6건**(스냅샷 `src` 의 복사본 `work` 에서 항목마다 `pristine` 에서 복원, 마지막 `diff -rq pristine/src work/src` 출력 없음·rc 0): M1 `:not(textarea)` 전부 삭제 / M2 선택자 1개 삭제 / M3 `position: static` / M4 `:not(input)` 로 교체 / M5 `:not( textarea )`(공백) / M6 선택자 1개만 `:not` 삭제 — **전부 실패 1건(시험 4 `globals.css 규칙`)**, 나머지 7개 통과. `Composer.tsx` 허용 사유는 새 규칙과 모순 없음(`mustNot: sr-only|absolute` 가드도 유효, `hitProblems` 는 표준 토큰을 기본 통과시키므로 허용 목록은 사유 기록+가드 역할). `editorScroller.test.ts`(`src/components/scenario/__tests__/`)·`src/app/(app)/__tests__/appShellScroll.test.ts` 수정 0(`git diff 1b9d099 3d0485c --stat` 에 없음). |
| 5 | 범위 | **PASS** | `git diff 1b9d099 3d0485c` 정독: 변경은 규칙 선택자 4개·주석 2줄·시험의 `REQUIRED_SELECTORS`/허용 사유 문구/머리 주석/자체 점검 1단언뿐. 보이지 않는 문자 `grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` 0건, `android/`·`plugins/`·`capacitor.config.ts` 변경 0, `versionCode` 해당 없음. |
| 6 | 직접 실행 | **PASS** | 스냅샷, `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test`: 새 시험 포함 3파일 **14/14**, `src/components/**`+`src/app/**` **114파일 1058/1058 pass**(fail·cancelled·skipped 0), `tsc --noEmit` rc=0, `eslint scrollBoxPosition.test.ts` rc=0. 개발자 보고(114파일 1058)와 일치. |

### 발견
| ID | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L-1 | Low | `src/app/globals.css:135` | 규칙 주석 「조사 당시 후보 15곳 중 이 규칙이 실제로 새로 `relative` 로 바꾸는 상자는 14곳」이 이번 변경으로 어긋난다. REV-174 의 14곳 목록 첫 항목이 `chat/Composer:146`(textarea)이었고, 이제 규칙이 textarea 를 뺐으므로 새로 relative 가 되는 상자는 13곳이다(같은 문서 위 REV-174 L-4 와 같은 종류 — 숫자가 코드와 어긋남). 동작 영향 0. | 숫자를 지우거나(「…바꾸는 상자는 14곳」→ 삭제) 13곳으로 고친다. 주석만 수정이라 Reviewer 재순환 없이 Leader 가 경로 지정 커밋에 묶어도 되는 수준. |
| I-1 | Info | 규칙 전체 | 제외는 `textarea` 하나뿐이다. 실제 Chrome 에서 `input.overflow-y-auto` 는 **relative** 가 된다(검증함). 현재 `src` 에 그런 요소가 0 이라 영향 없고, 시험은 요소 태그를 못 봐서 미래의 `input`/`select` 를 잡지 못한다(개발자도 한계로 명시). 생기더라도 결과는 QA-047a-L1 과 같은 서브픽셀 차이 수준. | 조치 불요. 생기면 선택자에 같은 방식으로 추가. |
| I-2 | Info | `scrollBoxPosition.test.ts` 파서 | `:not( textarea )` 같은 공백 변형은 문자열 비교라 실패한다(M5). 안전한 방향의 엄격함이고, 실제 파일 서식(`:not(textarea)`)과 다중행은 통과. | 조치 불요. |

### 결론
- **`textarea` 제외는 맞다** — 폼 컨트롤은 자손이 없어 보호 대상이 아니며(혜택 0), 제외된 요소는 textarea 만이고 나머지 `main` 안 세로 스크롤 상자는 모두 그대로 relative 이다. 명시도 0·층 순서·utilities 우선이 실제 브라우저 계산값으로 유지된다.
- 남는 위험: 위 L-1(주석 숫자), I-1(미래 `input` 이 relative 가 되는 서브픽셀 차이).
- QA 에 넘길 high_risk_areas: 없음 추가(개발자가 변경 전 3072 ↔ 후 3073 로 `Composer` 초점 픽셀 0% 를 이미 확인, 이 감사에서 서버 실측은 하지 않음).

### NOT_VERIFIED
- 실기기·TalkBack·가상 키보드 상태의 textarea 초점·여러 줄 입력(개발자도 미확인, 위치값이 `static` 으로 변경 전과 같아 같은 경로 [가능성 높음]).
- 앱 DOM 안에서의 실측(내 확인은 빌드 CSS 를 단순화한 HTML 에 적용한 것; 앱 화면 픽셀 비교는 개발자·QA 의 3072↔3073 측정에 의존).

### 감사 중 내 실수(공개)
- 첫 빌드를 `npm run build` 로 돌렸더니 이 스크립트는 `scripts/sync-local.sh` 로 **기본 개발 미러 `~/.node-local/thekaiwa`** 를 동기화하고 거기서 빌드한다(`KAIWA_LOCAL_ROOT` 미설정). 결과: 그 미러의 `src/prisma/public/tests/scripts/android/plugins/.env` 가 스냅샷(=NFS HEAD) 내용으로 `rsync --delete` 됐고 `.next/build` 가 이 빌드(타입 검사 단계 실패 — 그 미러의 Prisma 클라이언트가 최신 스키마보다 오래돼 `userSeedOverride` 타입 오류, 이번 변경과 무관)로 덮였다. 확인: 그 미러를 cwd 로 쓰는 실행 프로세스 0(운영은 `/home/brownjeon/apps/thekaiwa/releases/…` 별개), `diff -rq NFS/src ↔ 미러/src` 출력 없음, `.env` 는 NFS 와 `cmp` 동일, `.next/dev` 불변. 해를 입은 것은 미러의 `.next/build` 뿐이라 다음 `next dev`/`build` 가 다시 만든다 [확실 — 위 확인]. 이후 빌드는 스냅샷 안에서 `node node_modules/next/dist/bin/next build` 로 직접 돌려 이 문제를 피했다. 다음 감사에서는 `KAIWA_LOCAL_ROOT` 없이 `npm run build|lint|typecheck` 를 쓰지 않는다.
- 정리: scratchpad `r175/`(스냅샷·변이 복사본·로그) 외 남긴 것 없음. 서버 기동 0, `claude --print` 0, DB 접속 0.

## 상태 로그 (이어서 — 2026-10-10 Leader)
- 흐름: judge 1차(15파일 후보 → standard·demo delta) → **REV-173 전수 조사**(37곳 → A 13·B 0·C 4·D 20·E 0) → 보정 방식 (b')로 결정 → judge 2차(실제 3파일 → **light·demo none, `DM-light-waive`**) → 개발자 구현 `9c8301d` → **REV-174 PASS_WITH_NOTES**(Medium 1: 시험이 `!overflow-y-auto` 를 놓침) → 수정 `1b9d099`(시험·주석) → **QA 두 갈래**(앱 셸 qa-047-a·콘솔 qa-047-b, 변경 전 3072 ↔ 후 3073 운영 빌드 비교) PASS_WITH_NOTES → QA-047a-L1(채팅방 `Composer` `textarea` 초점 링 픽셀 차이) → 전역 규칙에서 `textarea` 제외 `3d0485c` → **REV-175 PASS_WITH_NOTES** → 주석 수치 보정(13곳) + 문서(`docs/screens.md` §18·콘솔 셸 예시 `relative`·`CLAUDE.md` 한 줄).
- **데모 게이트**: 사용자가 선택지 질문(AskUserQuestion)에서 「데모 면제」를 골랐으나 **발화 증거가 아니라 쓰지 않았다**. 실제 변경이 3파일로 줄어 judge 가 light 트랙 자동 면제(`DM-light-waive`, 사용자 결정 2026-10-03)로 판정 — 파일을 쪼개 한도를 피한 것이 아니라 보정 방식이 바뀌어 변경이 줄어든 결과(경위는 위 「Leader 결정」).
- **상태: done-deploy-pending** — 로컬 커밋만(미 push·미배포). 운영 배포는 사용자 확인 후.

## 최종 요약 (Leader, 사용자용)

**결과**: 앱 셸 `main` 안의 안쪽 세로 스크롤 상자 전체와 콘솔 `main` 에서, 화면 속 숨은 입력(스크린리더용 `sr-only` 라디오·체크)에 초점이 갈 때 상자뿐 아니라 **`main`(콘솔은 문서 전체)이 따로 스크롤돼 상단 바·하단 탭이 밀리던 잠복 결함**을 막았습니다. 화면 모양·간격·문구·기능은 바뀌지 않고 위치 지정(`position: relative`)만 바뀝니다. DB·API·서버·네이티브 변경은 없습니다.

**무엇이 바뀌었나(파일 3개)**
- `src/app/globals.css`: `@layer base` 에 전역 규칙 1개 — `main` 안의 `overflow-y-auto|overflow-auto|overflow-y-scroll|overflow-scroll` 상자(단 `textarea` 제외)에 `position: relative`. 명시도 0 이라 `absolute|fixed|sticky` 유틸리티가 항상 이깁니다.
- `src/components/admin/console/ConsoleShell.tsx`: 콘솔 `main` 에 `relative`(조상에도 위치 지정이 없어 안쪽 상자가 없어도 같은 문제).
- `src/components/shell/__tests__/scrollBoxPosition.test.ts`: 소스를 스캔해 새 스크롤 상자가 규칙에서 빠지는 형태(`md:overflow-y-auto`·`!overflow-y-auto`·인라인 스타일 등)로 만들어지면 실패시키는 회귀 시험.

**검증**: 전수 조사(후보 37곳)·감사 REV-173/174/175(전부 PASS 또는 PASS_WITH_NOTES, Critical·High 0)·운영 빌드 변경 전후 비교 QA(앱 셸 144 상태·콘솔 291 셀: 요소 위치·겹침 순서·픽셀 차이 0, 예외 아래). 스크롤 누수 대조(상자에 2400px 블록 + 숨은 라디오 `focus()`): 앱 셸 `main` Δ **1788~2650 → 0**, 콘솔 문서 Δ **2797~3665 → 0**. 단위 시험 `src/components`+`src/app` 114파일 1058개 통과·`tsc`·`eslint`·`next build` 통과, 시험 변이 수십 건 모두 잡힘.

**솔직하게 밝힐 점**
- 이 결함은 **예방 성격**입니다. 현재 QA 계정 데이터(내용이 짧음)로는 실제 화면에서 자연 재현되지 않았고, 효과 대조는 상자에 DOM 으로 긴 내용을 주입해 재현한 것입니다. 사용자가 실제로 겪은 사례는 IMP-0023(설정 화면)과 task-045 편집기뿐입니다.
- **전역 CSS 라 모든 화면에 영향**이 있어 변경 전후 화면 비교를 했습니다. 차이는 보이지 않는 요소 하나(콘솔 `lexicon` 표의 `sr-only caption` 좌표가 `main` 기준으로 바뀜)와, 콘솔 설정 화면 데스크톱 초점 링 가장자리의 서브픽셀 차이(최대 채널 ±5/255, 모바일 0 — 콘솔 `main` 에 `relative` 를 다는 것 자체의 결과)뿐입니다. `textarea` 를 규칙에서 뺀 이유는 채팅방 입력창 초점 링 가장자리 픽셀이 달라졌기 때문입니다(해소 확인: 0%).
- **데이터가 있어야 열리는 화면은 실측하지 못했습니다**: 레슨 단계, 평가 진행/결과, 역할극 결과, 진행 중 챌린지, 콘솔 설정 편집/diff. 정적 분석(REV-173 표)과 단순화 재현으로 갈음했습니다.
- 앱 WebView·Safari·실기기·가상 키보드 상태는 확인하지 못했습니다.

**남은 일**: ① 사용자 확인 후 `git push`(= 운영 배포, `src` 변경이라 blue/green 재빌드; 롤백 대상 직전 릴리스 `20261008-145346-5d0d8f8d`) ② 배포 뒤 실기기에서 화면이 이전과 다르게 보이는지(특히 레슨·평가·콘솔) 확인.
