---
task_id: task-076
role: reviewer
review_id: REV-076U
verdict: PASS_WITH_NOTES
tags:
  - type/task-record
  - domain/challenge
  - domain/lesson
  - domain/vocab
created: 2026-10-18
updated: 2026-10-18
---

# REV-076U — task-076 화면 감사 (챌린지 만들기·계획표 카드 / 오늘 탭 뱃지·칩·준비 줄)

> 이력서: [[task-076-improve-challenge-level-generation]] · 서버 감사: [[task-076-reviewer-server-record]] · 개발자 기록: [[task-076-dev-ui-create-record]] · [[task-076-dev-ui-today-record]] · 정본 `docs/screens.md` §33 · 승인 데모 `docs/demo/task-076-challenge-level-v2.html`
> 범위: 화면 A(만들기 ①③④ + 계획표 카드) + 화면 B(오늘 탭 P6·P7·P10). 서버(`src/modules/**`·`src/app/api/**`·`src/types/**`)는 감사 제외. 코드·시험·문서 수정 0(이 파일만 새로 씀).

## 판정

**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 3 · Info 6. `native_change: false`(`plugins/**`·`android/**`·`capacitor.config.ts`·Manifest diff 0).
[확실] 현재 코드는 §33·승인 데모 v2 와 일치하고 합쳐진 상태의 tsc·eslint·전체 시험·build 가 모두 통과했다. [확실] 다만 이 화면의 핵심 동작(고른 난이도가 알약·확인 단계에 보이는 것, 클릭이 값을 바꾸는 것, 내 수준/목표 값 전달)이 **행동 시험 없이 소스 정규식·QA 에만 의존**한다 — 직접 변이 18개 중 6개가 시험을 통과(생존)했다(M-1).

## 항목 A~G 판정

| 항목 | 판정 | 근거 요약 |
|---|---|---|
| A 사양 일치 | 통과 | 아래 세부표. 데모 v2 `C` 문구 상수·`COPYROWS`·`#a11y` 표·★ 합성(`goalScreen`)·알약 CSS(`.lp/.lpf.two/.lvn/.lvc/.cmpl/.gdl/.lvsep`)와 문구·마크업·간격(mt-3 / mt-5 pt-4 border-t / gap-2 / min-h-12 / 13px·11px ink2 / 12.5px)이 일치. 새 요소·새 문구·새 색 없음(토큰만) |
| B 표기 정본 | 통과 | `git diff -U0 -- src/components src/app` 의 추가 줄에서 «초보자…최상급»·`N1~N5` 는 **주석에만**. 이름·코드는 `levelLabel`/`levelName`(`SEED_PACK_LABEL`)로만(`lessonCopy.ts`·`topicCopy.ts`·`labels.ts`·`createParts.tsx`·`logic.ts`). 문장 속 이름+코드 뒤에 조사 0 — 시험이 5×5 전 조합으로 단언. 엔진명·`fetch`·`window.Capacitor`·`spawn` 추가 0 |
| C 상태·로직 | 통과(노트 2) | 아래 C 세부. L-1·I-4 |
| D 접근성·모바일 UI | 통과(실측은 QA) | 칸 높이 48(`min-h-12`)·native radio(`role="radio"` 0)·`min-w-0`·`truncate`·`grid-cols-5`·화면당 새 스크롤 0·새 색 0. 360/390/412·130% 는 정적으로 못 보므로 QA(L-2) |
| E 시험 | 노트 | 새 28개는 규칙·문구를 손으로 적은 정답으로 묶고(안내 줄 25칸·5×3 뱃지·11줄 판정표 등) 구현 식을 되풀이하지 않음. 소스 스캔은 배선(순서·속성)에만. 기존 UI 시험 변경 0(약화 없음). 단 **행동 시험 구멍 M-1** |
| F 증빙(합쳐진 상태) | 통과 | 아래 표 |
| G QA 인계 | 작성 | 아래 high_risk_areas |

### A 세부 (위치별 형태 P1~P10)
| 자리 | 구현 대조 | 결과 |
|---|---|---|
| P1 알약 5칸 | `LevelPills`: native radio(`sr-only`+`peer`) 5칸·같은 `name`(`useId`)·`grid-cols-5 gap-2`·칸 `min-h-12`·이름 13px / 코드 11px `font-medium text-ink2`(보이는 두 줄 `aria-hidden`)·`sr-only` = `levelLabel` + 꼬리말(내 수준→내 목표→이 주제 기본, §33-2 순서)·선택 `peer-checked` 안쪽 2px accent + 굵게·초점 `peer-focus-visible` 2px accent offset 2 | 일치 |
| P2 비교 줄 | `LevelCompareLine`: 묶음마다 `whitespace-nowrap`(«… ·» 포함)·`id` + 난이도 `fieldset aria-describedby`·목표 없으면 그 묶음만 빠짐·내 수준 모르면 빠짐 | 일치 |
| P3 안내 줄 | `aria-live="polite"` `<p>` 가 비어도 자리 유지·`d≥2` 위 / `d<0` 아래 / 같음·+1 없음·경고색·`role=alert` 0·[다음] 비차단(블록 코드 추가 0) | 일치 |
| ③ 제목 | h2 «목표를 정해요» `ref=headRef tabIndex=-1`(단계 이동 시 초점 `useEffect([step])` 불변) → 난이도 `fieldset`(legend>h3 «어느 난이도로 할까요?»·설명 `levelBody`) → `mt-5 border-t pt-4` → «하루에 무엇을 할까요?» h3, 하위 내용(체크 2·장수·시작일) 불변 | 일치 |
| P4 ④ | 주제 줄에서 «· 코드» 삭제, 「난이도」 줄 = `levelLabel` + small «이 주제 기본» / «이 주제 기본은 {주제}»(한 덩어리), 이름→주제→난이도→기간→하루 목표 순 | 일치 |
| P5 계획표 | `<nowrap>난이도 {이름 (코드)}</nowrap> · <nowrap>날짜</nowrap>`. 날짜 꼴은 기존 `md()` = «10월 18일 ~ 10월 24일»(데모는 «10/18 ~ 10/24» 약식) — implementation 분류(§33-2 가 `md` 명시, 날짜는 이번 task 가 안 바꿈), 줄바꿈은 L-2 | 허용 |
| P6 회화 뱃지 | 두 카드(추천 `lessonLevel`·`levelSource` / 챌린지 `ctx.level`+`CHALLENGE`) 모두 `LevelBadge`: 보이는 «중급 (N3) · 내 목표» `aria-hidden nowrap` + `sr-only` «수업 난이도 중급 (N3), 내 목표 기준». 폴백(칸 null/없음)은 꼬리표 없이 `levelLabel(rec.level)` | 일치(폴백은 I-2) |
| P7 칩 | «챌린지 · {이름 (코드)} · 「주제」» 난이도 앞, sr «챌린지 주제: » 불변, `truncate` 유지 | 일치 |
| P8·P9 ① | 카드 뱃지 `LevelText` 한 덩어리·설명 쌍점 꼴(`TopicLevelsBody`, 목록 모르면 «—») | 일치 |
| P10 준비 줄 | `mineSetChallengeLevel`(ACTIVE ∧ 주제 있음 ∧ 종료일 ≥ 오늘, 시작 전 포함) → `todayLevelLine(myLevel, challengeLevel)`; 지금 카드·`MineSetPanel` 펼침이 같은 `wordsCardProps` 로 받음 | 일치 |

### C 세부
- `Draft.level: JlptLevel|null` — `EMPTY_DRAFT`·`parseDraft`(옛 초안·잘못된 값 6종 → null)·`selectedLevel`(`d.level ?? topic.level`): 손댄 값은 주제 변경 때 유지, 손 안 댄 값은 따라감(시험 + 변이 M2 포착). 
- 요청 본문 `level` **늘 전송**(결정 A-1): 서버 `parseCreateChallengeBody` 는 `level` 선택·JLPT 5값 외 400·같은 값이면 생략과 결과 동일(`service.ts` `input.level ?? topic.level`) → 안전. 새 번들 ↔ 이전 서버는 400 `unknown_key` 이나 L9(서버 먼저/같은 릴리스) 전제 — 같은 푸시라 간극 없음. 단 부분 롤백 금지(Info).
- 다시 도전: `?again` 효과가 #157 `level` 을 초안에 채움(`isJlptLevel` 가드). 값은 늘 non-null → ① 에서 주제를 바꿔도 그 값을 유지(§33 «고른 뒤 유지» 와 같은 뜻) — I-4.
- 저장 실패·오프라인: `submit` 의 catch 가 draft 를 건드리지 않음 → 고른 값 유지. 성공 시에만 `DRAFT_KEY` 삭제.
- `page.tsx`: 이미 호출하는 `getProfile` 한 번을 props 로(새 요청 0, null 안전: 컴포넌트가 `myLevel`/`goalLevel` null 이면 그 묶음·꼬리말만 뺌).
- `ChallengeCtx.level: string → JlptLevel`: 소비처는 `TodayLessonCard`·`TopicWordsCard`·`challengeCtxOf` 뿐, tsc 0.
- 서버 모듈이 components 를 import 하는 곳 0(층 방향 유지).
- `lessonLevel`/`levelSource` null·없음 폴백: `lessonLevelBadge` 가 둘 다 있을 때만 꼬리표(시험 4종: 둘 다 null·칸 없음·출처만 없음·수준만 없음).
- P10: #158 로딩/실패 중이면 지금 문장. 홈 첫 화면은 `todayRevealed` 가 챌린지 로딩 완료(또는 hold 시간)까지 붙잡으므로 문장이 뒤늦게 바뀌는 깜박임은 hold 초과 때만(Info).

## 발견

| ID | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| M-1 | **Medium** | `ChallengeCreateScreen.tsx` `GoalStep`(≈316-410)·`ConfirmStep`(≈412-485)·`createParts.tsx` `LevelPills` onChange·`plan/challenge/new/page.tsx:20` | 이 task 화면의 핵심 상호작용이 **행동 시험 없이 소스 정규식·QA 에만** 의존. 변이 18개 중 **6 생존**: M4 `ConfirmStep` 의 `level` 변수 = 주제 난이도(확인 단계가 고른 값을 안 보임), M5 `GoalStep` `sel` = 주제 난이도(알약이 고른 값을 안 보임), M6 `LevelPills` onChange 가 새 값을 안 보냄(클릭해도 안 바뀜), M8 `page.tsx` 내 수준↔목표 바꿔 전달, M9 `levelCtx` 내 수준↔목표 뒤바뀜, M16 ① 설명 `levels={[]}`. 현재 코드는 모두 맞다(읽어서 확인). 개발자 기록의 «화면 안 함수라 렌더 안 함»은 `GoalStep`/`ConfirmStep` 에는 맞지 않다 — 두 함수는 `useId` 외 라우터 훅을 쓰지 않는다(`useRouter`/`useSearchParams` 는 71·72줄 본 컴포넌트에만). **권고**: ① `GoalStep`/`ConfirmStep` 을 export(또는 `createParts` 로 이동)해 정적 렌더 시험(선택 칸 checked·확인 dd·비교 줄 값·안내 줄) [가능성 높음 — 시도는 안 함], ② `LevelPills` 는 함수 컴포넌트라 직접 호출해 `<input>` 의 `onChange` 를 호출하는 시험, ③ `page.tsx` props 두 칸은 소스 정규식 한 줄. 이번 배포는 막지 않되 **QA 가 ③ 고르기·④ 확인·비교 줄 값(프로필과 일치)을 실제 화면에서 확인해야 한다** |
| L-1 | Low | `challengeCopy.ts:levelBody` | «…처음엔 주제 난이도로 골라 두었어요.» 가 다시 도전(`?again`)으로 ③ 에 돌아온 경우 사실과 다를 수 있음(그때 처음 값 = 지난 챌린지 난이도). 개발자가 이미 지적 — 데모 문구 표에 대안이 없어 designer/Leader 판단 필요(문구는 바꾸지 않음) |
| L-2 | Low | `ChallengePlanCard.tsx:140-147` | 부제가 길어져 360px·글꼴 130% 에서 «난이도 최상급 (N1)» / «10월 18일 ~ 10월 24일» 사이에서 두 줄이 되면 카드가 약 17px 길어져 자리표시(`PLAN_SKELETON.challengeCardH` 278.4)와 어긋남. 데모는 날짜를 «10/18 ~ 10/24» 약식으로 측정했고 실제 `md()` 는 «10월 18일 ~ 10월 24일»(더 긺). 줄바꿈 지점(묶음 사이)과 형태는 승인 범위 — 실측은 QA |
| L-3 | Low | `ChallengeCreateScreen.tsx:179` | `submit` 의존성이 원시값 4개 → `[draft, goal, router, topic]`. `goal`(`effectiveGoal`)은 렌더마다 새 객체라 콜백이 매 렌더 재생성. 동작·안전 문제 없음(`busyRef` 가드 불변). 정리하려면 `goal` 대신 원시 필드로 되돌릴 것 |
| I-1 | Info | `LearningSettings`·`DiagnosticsScreen` 등 5곳 | eslint 경고 5(`react-hooks/set-state-in-effect`) 전부 이번 diff 밖 파일 |
| I-2 | Info | `lessonCopy.ts:lessonLevelBadge` 마지막 줄 | 서버가 T 를 못 정한 경우 꼬리표 없이 «초급 (N4)»(이름+코드)로 그림 — D11 일치, 서버 #59 도 그때 주제 난이도로 수업을 만들어 보이는 값 = 실제 값. 허용(implementation) |
| I-3 | Info | `LessonTopicsScreen.tsx:47·82` | 흐름 밖 코드 뱃지 «N4» 는 질문 5 a 로 범위 밖 — 오늘 탭 «중급 (N3) · 내 목표» ↔ [다른 주제] 목록 «N4» 혼재는 사용자가 승인한 상태 |
| I-4 | Info | `ChallengeCreateScreen.tsx:120` | `?again` 이 지난 챌린지 난이도를 늘 non-null 로 채워, 그 값이 주제 난이도와 같아도 ① 에서 주제를 바꾸면 따라가지 않음. 스펙(§33-2 «지난 난이도 채움»)대로이고 ④ 에 «이 주제 기본은 …» 로 보임. 따라가게 하려면 같은 값일 때 null |
| I-5 | Info | 알약 꼬리말 순서 | 데모 스크립트 내부는 이 주제→내 수준 순으로 조립하나 데모 낭독 표·§33-2 는 내 수준→내 목표→이 주제 기본. 구현은 §33-2 따름(implementation) |
| I-6 | Info | 배포 | 새 번들은 #156 에 `level` 을 항상 싣는다 — 같은 릴리스 서버(REV-076S PASS_WITH_NOTES)와 함께 나가야 하며 서버만/화면만 부분 롤백 금지 |

**데모 차이 분류**: material 0 · defect 0 · implementation 3(P5 날짜 꼴, 꼬리말 순서, P6 폴백 표기). 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …task-076-improve-challenge-level-generation.md` → `DEMO_GATE_PASSED` (approved v2, hash verified), `docs/demo/task-076-challenge-level-v2.html` sha256 `90a51f2f…8dc9fe74b73a2839276a8b33b4307996c4f5dc00b3f276c8dd` = frontmatter `content_sha256`. `evidence.jsonl` 46행 = approve v2(2026-10-18T18:19:44+09:00, prompt_ts 18:19:02, quote 해시 기록) — `approve`/`waive` 를 에이전트가 대신 실행한 흔적·`.claude/state/demo-gate/` 직접 쓰기 흔적은 이 task 에서 발견 못 함(사용자 인용문 «D1~D11 권고대로 승인, 질문 5는 a로» 와 이력서 기록 일치).

## F 증빙 재실행 — **두 화면이 합쳐진 상태 (처음)**

미러 `~/.node-local/thekaiwa-rev076u` — 시작·종료 시점 모두 `diff -rq` 저장소 `src` 와 차이 0, 소스·tsbuildinfo link 1(node_modules 만 하드링크). 가짜 `DATABASE_URL`, DB·네트워크·포트 접근 0.
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | rc 0 |
| `./node_modules/.bin/eslint src/components src/app src/modules src/types` | 에러 0 · 경고 5(전부 diff 밖, I-1) · rc 0 |
| 전체 시험 351파일 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)` | tests **4384** · pass **4379** · fail **0** · cancelled 0 · skipped 5 · rc 0 (화면 A 4373 + 화면 B 11 = 4384 와 맞음) |
| 건너뛴 4파일(`task074FavoriteRoutes`·`task068Words`·`modelPackage`·`brand`)을 `KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO` = 저장소로 | 29 중 27 통과 · 0 실패 · 2 건너뜀(`brand` — `process.cwd()/android` 필요, 이번 변경과 무관: `android/`·`brand.ts` diff 0) |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | 0 (✓ Compiled, 경고 3 = 기존 `persona/loader` 파일 추적, `/plan/challenge/new` 경로 생성 확인) |

## E 직접 변이 18개 (별도 복사본 `~/.node-local/thekaiwa-rev076u-mut` — src 복사 link 1 + node_modules 심볼릭, 임시 파일 + `os.replace`, 대상 시험 = challenge·vocab·lesson `__tests__` 전부 44파일, 스크립트: 세션 스크래치 `mut.py`)

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | 요청 `level` 에 고른 값 무시(`topic.level` 만) | 포착 | #156 본문 |
| M2 | 주제가 고른 값을 덮어씀(`topic?.level ?? d.level`) | 포착 | 보이는 선택 D9 A |
| M3 | 안내 임계 2→1 | 포착 | 안내 줄 전수 |
| **M4** | **확인 단계 `level` 변수 = `topic.level`** | **생존** | — (소스 정규식은 JSX `level={level}` 만 봄) |
| **M5** | **알약 `sel` = `topic.level`(고른 값이 안 보임)** | **생존** | — |
| **M6** | **알약 onChange 가 `value` 를 보냄(클릭해도 안 바뀜)** | **생존** | — (정적 렌더라 이벤트 없음) |
| M7 | 안내 줄이 `levelHint(topic.level, …)` | 포착 | 배선 ③ 정규식 |
| **M8** | **`page.tsx` 내 수준↔목표 바꿔 전달** | **생존** | — (page.tsx 시험 없음) |
| **M9** | **`levelCtx` 내 수준↔목표 뒤바뀜** | **생존** | — |
| M10 | 챌린지 카드 출처 꼬리표 `LEVEL` | 포착 | P6 렌더 · 배선 |
| M11 | 마지막 날 제외(`endDate <= today`) | 포착 | P10 판정표 |
| M12 | `TodayHome` 이 챌린지 난이도를 안 넘김 | 포착 | 배선(소스) |
| M13 | 잘못된 `level` 파싱 통과 | 포착 | 초안 |
| M14 | 비교 줄 묶음 nowrap 빠짐 | 포착 | 비교 줄 렌더 |
| M15 | 다시 도전이 level 초안에 안 채움 | 포착 | 배선 ④(소스) |
| **M16** | **① 설명 `levels={[]}`** | **생존** | — |
| M17 | 칩에 난이도 안 넘김 | 포착 | P10 렌더 · 배선 |
| M18 | `TodayWordsCard` 가 `challengeLevel` 무시 | 포착 | P10 렌더 · 배선 |

12 포착 · 6 생존. 복원 확인: 변이마다 스크립트가 원본 일치를 단언, 끝난 뒤 `diff -rq` 저장소 `src` = 변이 복사본 = 리뷰 미러 차이 0, 대표 5파일 `cmp` 같음. 개발자 기록의 «21/21·17/17 포착»은 그들이 고른 변이 목록에 한해 맞고, 위 생존 6개는 그 목록 밖(상태 연결·props 전달 구역)이다. 생존 6개는 모두 사용자에게 보이는 결함이 될 수 있는 변이다(동등 변이 아님).

## 위험·학습 원칙·보안 (7영역 요약)
- 아키텍처: 화면 파일만 변경, 서버→components import 0, `index.ts` 우회·엔진명·`fetch`·`window.Capacitor`·`spawn` 추가 0. 발견 없음.
- 보안: 신규 엔드포인트 0, 클라이언트 `level` 은 서버가 5값 검증(400)·소유자 검사 불변. 발견 없음.
- 학습 원칙: AI 산출 저장·`StatsSnapshot`·`Correction` 접촉 0(화면 표기만). 발견 없음.
- 성능: 새 요청 0(`getProfile` 재사용), `mineSetChallengeLevel` O(1). 발견 없음.
- 운영성/안정성: 해당 없음(화면). 발견 없음.

## QA 에 넘길 high_risk_areas

1. **만들기 ③ 실제 동작(M4·M5·M6 생존 구역)**: 알약 클릭→선택 모양·값 변화, ←/→ 키 이동, Tab 한 번에 묶음 통과, 주제를 바꿔도 고른 값 유지 / 손 안 댄 값은 새 주제 난이도로 따라감, 안내 줄(내 수준보다 2·3·4단계 위 / 아래 / 같음·1단계 위는 비움), [다음] 비차단.
2. **프로필 값 전달(M8·M9 생존 구역)**: 비교 줄의 «내 수준»·«내 목표» 값이 프로필 설정과 같은지(수준만 바꿔 보기, 목표 없음 → «내 목표» 묶음만 빠짐), 알약 꼬리말·안내 기준이 «내 수준» 인지.
3. **④ 확인 «난이도» 줄 = 고른 값(M4 구역)**, 다름/같음 작은 글, 만든 직후 계획표 카드 부제 «난이도 …» 와 #156 응답 `level`(브라우저 network 로 요청 본문에 `level` 포함 확인) 일치.
4. **다시 도전 `?again=`**: ④ 난이도가 지난 값으로 채워지는지, ③ 으로 돌아가 문구(L-1)·주제 바꾸기(I-4) 동작.
5. 저장 실패/오프라인 시 고른 난이도 유지, 진행 중 챌린지가 있을 때 ③ 모양(막힘 InfoBox 아래 제목·알약), ① 설명(M16 구역)·주제 카드 뱃지 한 줄.
6. **오늘 탭 TodayHome 배선(렌더 시험 없음)**: 회화 뱃지 두 카드(추천 CHALLENGE/GOAL/LEVEL 출처별, 챌린지 카드), 챌린지 칩(긴 주제 이름 말줄임에서도 난이도 보임), P10 준비 줄(챌린지 중 / 없음 / 내일 시작 / 단어 과제 꺼짐 / 기간 끝난 날), #158 로딩·실패 시 지금 문장.
7. **360/390/412 × 글꼴 100/130%**: 알약 이름(데모 실측 360px·130% 여유 +6.6px — 잘리면 간격 8→6px), 비교 줄 묶음 줄바꿈, **계획표 부제 2줄과 카드 높이/자리표시 차이(L-2)**, 회화 뱃지 한 줄(최대 «최상급 (N1) · 내 목표» 130% 162px), 가로 스크롤 0.
8. TalkBack: 알약 한 칸이 «초급 (N4), 내 수준, 이 주제 기본, 라디오 버튼, 선택됨» 한 번만, 비교 줄이 묶음 설명으로, 안내 줄 `aria-live`, 뱃지 낭독 한 번(보이는 글 중복 없음), 칩 «챌린지 주제: …».
9. 다크 모드: 알약 선택(안쪽 2px accent)·초점 링 대비.
10. 배포: 서버(REV-076S)와 같은 릴리스로 나갈 것 — 새 번들이 #156 에 `level` 을 늘 싣는다(이전 서버면 400).

## 권고 요약
- M-1(Medium): 가능하면 배포 전 `GoalStep`/`ConfirmStep` export + 정적 렌더/직접 호출 시험 추가(Developer 수정 → Reviewer 재감사 범위는 시험 파일 한정). 시간이 없으면 QA 가 high_risk 1~3 을 실화면으로 확인하는 조건으로 진행 가능.
- L-1·L-2: designer/Leader 판단(문구·자리표시 높이). L-3: 선택.
- 개발자 반려 횟수 0 (Sonnet 승격 권고 해당 없음 — developer 모델 opus).
