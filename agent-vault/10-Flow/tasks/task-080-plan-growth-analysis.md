---
task_id: task-080
title: "계획표 분석·성장기록 (Phase 3) — 성장기록 탭(능력 축·추이)과 분석 탭(공부계획서 제안) 데모부터"
status: doing
waiting: "user_verify"
base_ref: 8e87bf8
risk_level: "R2"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-010b-repetition, task-011-ai-evaluation, task-044-today-integration]
tags:
  - type/task
  - domain/learning
  - domain/ui
  - domain/plan
aliases:
  - 분석 성장기록
  - task-080
created: 2026-10-20
updated: 2026-10-20
demo_gate:
  required: true
  level: "full"
  status: "approved"
  version: 4
  repo_path: "docs/demo/task-080-plan-growth-analysis-v4.html"
  artifact_url: "https://claude.ai/artifact/WtJ7Hs3HYqax92FiyyT4UQ"
  content_sha256: "a4167a6f3c1449d09863aed1c1ea86ccbded8a156a240f942b15780f8d31316f"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-20T23:19:04+09:00"
  approval_quote: "v4 승인, Q9는 A로 해줘"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-080 — 계획표 분석·성장기록 (Phase 3, roadmap `(3) 분석·성장 기록(능력 축·추이)`)

## 사용자 요청 (원문)

> 2번 데모 바로 시작해줘 (2026-10-20 — «다음 작업 후보» 2번 = 분석·성장 기록(Phase 3), 1번(task-079) 배포 후 사용자 확인을 기다리는 동안 병행 시작)

## judge 접수 (2026-10-20)

- 입력 요약(156자). 결과 `judge-result@2`(스크래치 `judge-080-intake.result.json`): **feature · standard · R2 · 복잡도 2.07 · developer=opus · roles designer+prompt-engineer(조건부)+developer+reviewer+qa · demo `full`(JV-ui_change·DM-kw-full) · next=`demo_first`(blocking gate = demo)**. 사용자 승인 전에는 화면 코드를 쓰지 않는다.

## 정본이 정한 것 (직접 읽음)

- `docs/design-spec.md` §7-6: 계획표는 `calendar`·`analysis`·`growth`. **분석** = `POST /plan/analysis {weeks}`(#74, 범위는 코드가 산출) → 코드가 입력 집계(출석·유형별 횟수·평가 추이·오류 유형 top5·오답 단어 top10·`RepetitionItem` FOCUS·목표) → A8(opus, batch 잡) → `StudyPlan(PROPOSED)` → 사용자 확인 → ACCEPTED(이전 ARCHIVED), 같은 `sourceRange.hash` 면 재생성 안 함, `GET /plan/analysis/latest`(#75)·`/plan/current`(#76). **성장기록** = `GET /plan/growth?weeks=`(#78) 는 **`StatsSnapshot` 만** 읽는다(삭제 후 추이 불변): 평가 5차원 레이더·일별 활동·연속 출석·수준 이력. **(3차 제안)** 능력 축 5개(`LearnerSkillState`: 어휘 회상·문형/조사·듣고 응답·문장 산출·대화 유지)와 관측 이벤트를 코드가 갱신해 A8·A11 의 근거로 쓰는 안.
- `learning-personalization-and-llm-data.md` D5(결정 2026-09-28): 관측 기록(`LearningObservation`)은 task-010b 에서 시작, **축 갱신·표시는 Phase 3**.
- 불변 원칙: AI 는 제안만(PROPOSED→사용자 채택), 집계는 `StatsSnapshot` 만, 엔진명 비노출, 사용자 입력 shell 금지.

## 데이터 현황 (Leader 2026-10-20, 읽기 전용 집계 — 내용 없음, 전체 8계정 중 개발·QA 계정 다수 포함)

| 항목 | 현황 | 데모 영향 |
|---|---|---|
| `StatsSnapshot` | DAILY 15행(계정별 4·9·1·1일)·VOCAB_SESSION 12·LESSON 6·**EVALUATION 0** | 성장기록의 «평가 5차원 레이더» 는 **평가(AI 평가)를 한 번도 안 했으면 비어 있다** → 빈 상태·유도 필요. 일별 활동도 가장 많은 계정이 9일 |
| DAILY `data` 키 | attended·words·talkTurns·chatTurns·corrections·lessons·reviews·evals·repetition·observations | 일별 활동·연속 출석은 지금 데이터로 가능 |
| `LearningObservation` | 676행: VOCAB_RECOGNITION 274·CORRECTION_PROPOSED 277·CORRECTION_ACCEPTED 30·CORRECTION_IGNORED 28·SENTENCE_PRODUCTION 39·GRAMMAR_USE 27·SCENARIO_COMPLETED 1 | 능력 축 5개 중 **듣고 응답·대화 유지는 관측이 거의 없다**(kind→축 매핑은 코드 상수, `SkillAxis` enum 은 스키마에 있음) |
| `LearnerSkillState` | **모델 없음**(스키마에 enum·관측만) | 능력 축 «저장» 은 새 테이블 = DB 변경(사용자 승인). Leader 권고: 테이블 없이 DAILY 스냅샷 JSON 에 축별 집계를 더하고 관측에서 1회 백필 — 정본의 «성장기록=스냅샷만» 원칙 유지 |
| `StudyPlan` | 0행 | 분석 탭은 처음엔 항상 «아직 계획 없음» |
| `LearnerErrorStat` | 5행 | 분석 입력 «오류 유형 top5» 가 거의 비어 있음 |
| 코드 | `/plan` 은 달력만(`PlanScreen`·`CalendarSection`·`usePlanData`), API #70·#71 만, `prompts/` 에 A8 없음, `JobKind.PLAN_ANALYSIS`·`StudyPlan` 모델은 있음 | 분석·성장 API(#74~#78)와 A8 프롬프트는 신규 |

> 불편한 사실: 지금 실사용 데이터로는 두 탭이 **거의 비어 보인다**(핵심 사용자 기준 9일, 평가 0건, 계획 0건). 데모는 «적을 때도 좋아 보이는 상태» 를 1급으로 설계해야 한다. 적은 데이터로 점수·수준을 단정하면 거짓 정밀이 된다.

## 구현 계획

1. **데모 v1(designer, opus)** — 성장기록 탭·분석 탭을 상태별로(적음/보통/풍부, 분석 5상태), 3폭×글꼴 130%×다크, «결정 필요» 패널 A/B(권고 표시). → Leader 가 Artifact 게시·검토 요청 → 사용자 승인.
2. 승인 뒤: designer 구현 가이드(`docs/screens.md`) → prompt-engineer(A8 `planAnalysis` 프롬프트 — 분석 탭 승인 범위에 따라) → developer(성장 API #78·스냅샷 축 집계·백필, 분석 API #74~#76·잡, 화면) → reviewer → qa → 배포(사용자 승인).
3. 구현 범위(성장기록만 먼저 / 분석 함께)는 데모 검토에서 사용자가 정한다(권고: 성장기록 먼저 — LLM 없이 지금 데이터로 가능, 분석은 데이터가 쌓인 뒤).

## 완료 기준 (데모 단계)
- 데모 lint 통과·`ui-design-reviewer`/`ui-accessibility-reviewer` 자체 점검 Critical·Major 0, 사용자 승인 기록(`check.mjs approve`).

## 상태 로그

- 2026-10-20 사용자 「2번 데모 바로 시작해줘」 → Leader 설계서·스키마·데이터 현황 확인(위 표)·judge 접수(feature·standard·R2·demo full·next=demo_first)·이력서 작성 → designer 데모 v1 소환 예정.

- 2026-10-20 **데모 v1 완성**(`designer-080-demo`): `docs/demo/task-080-plan-growth-analysis-v1.html`(130KB·합성 데이터), lint `DEMO_LINT_PASSED`(Leader 재실행 확인), `src/**` 변경 0. 자체 점검: 자동(Playwright+Chrome, 360/390/412×100·130%×성장 3단계×기간 3×분석 9상태, 라이트·다크) 콘솔 오류 0·가로 넘침 0·44px 미만 터치 0·11px 미만 글자 0·`lang=ja` 밖 일본어 0·엔진명 0 / ui-design P0 0·P1 0·P2 4 / accessibility Critical 0·Major 0·Minor 4. Leader 가 첫 화면·결정 패널(Q1~Q7 A/B)·성장 탭 날마다 띠가 렌더되는 것을 직접 스크린샷으로 확인(전수 검증은 아님). 기록 [[task-080-designer-record]].
- 2026-10-20 **Artifact 게시·검토 요청**: https://claude.ai/artifact/BcKPCvgQHzCLeS8or1y2nU (비공개), 게이트 `status --to review_requested --version 1`(sha256 `007d48c5…`). 사용자 승인 대기. 결정 필요 패널 Q1~Q7: Q1 구현 범위(★B 성장기록 먼저)·Q2 능력 축 표현(★B 가로 5줄+단계 라벨)·Q3 데이터 부족 기준(★A 관측 20건·3일, 분석은 공부한 날 5일+교정·틀린 기록 20건)·Q4 능력 저장(★B 기존 일별 기록에 칸 + 과거 1회 계산)·Q5 수준 이력(★A 이번 범위 제외)·Q6 [닫기](★A 거절로 남기기)·Q7 선생님 추정 수준(★B 보이지 않기).
- 2026-10-20 **Leader 기본 결정(정본·계약 어긋남 13건 중, 사용자가 뒤집을 수 있음)**: 1·2 #78 응답에 `streak·longestStreak·days[]·skills[]` 를 additive 로 추가하고 `errorTrend` 는 «스냅샷만» 원칙으로 제외 / 4 «듣고 응답» 은 «기록 전» 으로 표시하고 LISTEN_RESPOND 관측 기록은 별도 후속(이번 범위 밖) / 5 능력 축은 §2-3 대로 **교정 채택만으로 올리지 않는다**(기존 `bySkill` 은 하위 호환으로 두고 새 칸을 따로 계산) / 6 schema 주석 문구 정리는 구현 때 / 7 [다시 분석]: 같은 hash → reused, 다르면 서버가 기존 PROPOSED 를 REJECTED 처리 후 새 잡 / 8 `analysis.inputs`(숫자만) 는 기존 JSON 칸에 저장(DB 변경 없음 — 구현 때 `StudyPlan` 칸 확인) / 9 `evidence` 한국어 라벨은 코드 상수 / 10 weeks 1~4 → [2주][4주] / 11 잡 진행 이벤트 없음 → 움직이는 띠 + 시간 안내 / 12 계획 항목 완료 표시는 이번 범위 밖 / 13 분절 주소는 경로 방식(`/plan/analysis`·`/plan/growth`, 단어장 `DrawerSwitch` 선례). 3·Q5 는 사용자 결정.

- 2026-10-20 **사용자 응답(v1 검토)**: 「1. '날마다' -> '체크내역' / 2. 요일은 월 ~ 일 -> 일 ~ 토 로 변경해줘. 이건 달력의 요일 표기도 함께 변경해줘 / 그외에는 권고안대로 진행해줘」 → **Q1~Q7 = ★ 권고대로 결정**(Q1 B 성장기록 먼저·Q2 B 가로 5줄+단계 라벨·Q3 A 관측 20건·3일(분석: 공부한 날 5일+교정·틀린 기록 20건)·Q4 B 기존 일별 기록에 칸+과거 1회 계산·Q5 A 수준 이력 제외·Q6 A 닫기=거절로 남기기·Q7 B 선생님 추정 수준 숨김) + 변경 2건. 게이트 `status --to changes_requested --version 1 --quote …` 기록(v1 sha `007d48c5…`, v1 은 승인하지 않음). **주 시작을 월요일 → 일요일로 바꾸는 것은 2026-10-01 사용자 결정 «(c) 주 시작=월요일»(`plan/logic.ts` 주석)을 이번 지시가 대체**한다.
- 2026-10-20 **Leader 확인(코드, 읽기)**: 월요일 가정 위치 — `src/components/plan/logic.ts`(`WEEK_HEADERS`·`monthGrid` 의 `(weekdayOf(from)+6)%7`)·`CalendarSection.tsx` 요일 머리·`__tests__/planLogic.test.ts:46`·**ASK «이번 주» 범위**(`recordRetrieval/range.ts` `mondayOf`·`orchestrator/ask.ts:181`). 오늘 탭 «최근 7일»(`vocab/format.ts`)은 오늘이 맨 오른쪽인 연속 7일이라 요일 순서와 무관. **Leader 기본안**: 주 시작 상수 하나를 정본으로 두고 달력·성장·ASK 가 같이 쓴다(그러지 않으면 같은 «이번 주» 가 화면마다 달라짐) — ASK 범위가 일요일 시작으로 바뀌는 점은 사용자 확인 필요로 데모·보고에 올린다.
- 2026-10-20 **v2 작업 소환**(`designer-080-v2`, opus): 새 파일 `docs/demo/task-080-plan-growth-analysis-v2.html`(v1 불변) — «날마다»→«체크내역» 전수 치환·일요일 시작(체크내역 행 일~토·주별 막대 주 경계·«바뀌는 달력» 프레임·영향 범위 메모)·결정 패널 «결정됨». v2 완성 뒤 lint·점검·Leader 확인·Artifact 게시 → **사용자 v2 승인(한 줄) 필요**(Leader 는 대리 승인 금지, 보지 않은 버전은 승인 못 함).

- 2026-10-20 **데모 v2 완성**(`designer-080-v2`): `docs/demo/task-080-plan-growth-analysis-v2.html`, lint `DEMO_LINT_PASSED`(Leader 재실행), v1 해시 `007d48c5…` 불변·`src/**` 변경 0·«날마다» 0건(v1 11곳 치환). 바뀐 곳: 이름 «체크내역» / 주 시작 일요일(체크내역 행 일~토·«최근 N주»=이번 주 포함 일~토 주 N개·숫자 카드도 띠와 같은 범위로 맞춤 — v1 은 숫자 카드만 오늘부터 28일이었음) / «바뀌는 달력»(요일 머리 일~토, 10/1(목) 앞 빈칸 3→4칸, 칸 안 표시·챌린지 띠 불변, 현재 vs 바뀜 나란히, 일·토 색 구분은 현재 코드에 없어 만들지 않음) / 결정 패널 Q1~Q7 «결정됨»+Q8(주 시작=일요일)·**Q9 열림**(질문 탭 «이번 주») / 개발 메모 «0절 영향 범위»(코드로 확인한 것만, `planSkeleton.test.ts` 값 불변만 «추정») / 오늘 탭 «최근 7일» 영향 없음. 점검: Playwright+Chrome 360/390/412×100·130%×라이트·다크 폰 상태 약 156개 콘솔 오류·가로 넘침·44px 미만 터치·11px 미만 글자·엔진명 0, design P0 0·P1 0·P2 4, a11y Critical 0·Major 0·Minor 3(주된 P2: 130% 에서 체크내역 마지막 줄(토)이 하단 탭 뒤로 — 머리는 첫 화면 안). Leader 가 첫 화면·결정 패널 스크린샷으로 확인. 기록 [[task-080-designer-v2-record]].
- 2026-10-20 **designer 범위 초과 1건 Leader 판단**: Q1 B 를 화면에도 반영해 기본 분절을 [달력|성장] 두 칸으로(분석 9상태는 «범위: 분석 포함(나중)» 로 보존). 지시의 «이외는 v1 그대로» 를 넘지만 사용자가 Q1 을 B(성장기록 먼저)로 결정했으므로 **수용**(구현 첫 단계 화면 = [달력|성장], 분석 탭은 후속 task 에서 추가 — 사용자 승인 때 확인).
- 2026-10-20 **Artifact v2 게시·검토 요청**: https://claude.ai/artifact/Bg1k5EN9STUK52okHJtjPP (비공개), 게이트 `status --to review_requested --version 2`. **사용자 v2 승인(한 줄) 필요** + **Q9**: 질문 탭 «이번 주»(`recordRetrieval/range.ts` `mondayOf`·`ask.ts:181`·선생님에게 보내는 글 `prompts/ask.ts:145`·`api-contract.md:1517`)를 일요일 시작으로 맞출지(Leader 권고: 맞춤 — 안 맞추면 10/20(화) 기준 달력·성장 10/18~24 vs 질문 10/19~25 로 하루 어긋남).

- 2026-10-20 **사용자 응답(v2 검토)**: 「'주마다 공부량' 항목에서 '단어 세트' -> '단어', '대화 말 수' -> '대화'」 → 게이트 `status --to changes_requested --version 2 --quote …`(v2 sha `71125a87…`, v2 는 승인하지 않음 — 사용자가 v2 승인 한마디·Q9 답은 아직 주지 않음). Leader 확인: 지표 정의(v2 484·487줄 `label`)가 칩·막대 제목·읽기 줄·표 열 머리·접근성 이름으로 퍼지고, 개발 메모 근거표(1179·1180줄)에도 있음. 분석 탭 문구(495·892·901줄)의 «단어 세트» 는 다른 맥락이라 이번 지시 범위(주별 공부량 항목)에서 제외하고 남는 위치를 목록으로 사용자에게 알려 확장 여부를 묻는다.
- 2026-10-20 **v3 소환**(`designer-080-v3`, **sonnet 으로 낮춤 — 문구 두 개만 바꾸는 기계적 작업**, 팀 표의 Opus 에서 벗어난 Leader 판단): v2 복사 → v3 새 파일, lint·Playwright 넘침 점검. v3 완성 뒤 Artifact 게시·사용자 v3 승인(한 줄) + Q9 필요.

- 2026-10-20 **데모 v3 완성**(`designer-080-v3`, sonnet): `docs/demo/task-080-plan-growth-analysis-v3.html`, lint `DEMO_LINT_PASSED`(Leader 재실행)·v2 해시 `71125a87…` 불변·`src/**` 변경 0. Leader 가 v2↔v3 diff 로 확인: 메타·머리·«한눈에» v3 표시 + 지표 정의 label `'단어'`·`'대화'`(칩·읽기 줄·표 캡션·열 머리·개발 메모 근거표가 함께 바뀜) 외 변경 없음. **designer 가 «대화» 지표 주석에 한 문장 추가**(«대화에서 오간 말의 수예요.» — «대화 61번» 이 대화를 61번 했다는 뜻으로 오해되는 것 방지, 스크롤 높이 +18~23px; 사용자 지시 밖이라 보고에 올려 빼기·유지를 묻는다). 점검: Playwright+Chrome 3폭×100·130%×라이트·다크×성장 3단계×지표 6개 216건 — 새 이름·단위, 옛 이름 0, 가로 넘침·콘솔 오류·엔진명 0, 칩 6개 한 줄 스크롤 상자라 줄바꿈·잘림 없음(스크롤 폭 466→404px). 안 바꾼 «단어 세트»: 분석 탭 495·892·901줄 세 곳. 기록 [[task-080-designer-v3-record]].
- 2026-10-20 **Artifact v3 게시·검토 요청**: https://claude.ai/artifact/6iq2QKXt3noSv3ZUjP76kC (비공개), 게이트 `status --to review_requested --version 3`. **사용자 v3 승인(한 줄) 필요** + Q9(질문 탭 «이번 주» 일요일 시작 통일, Leader 권고: 맞춤) + 추가 확인(대화 주석 한 문장 유지/제거·분석 탭 «단어 세트» 범위 확장 여부).

- 2026-10-20 **사용자 응답(v3 검토)**: 「'능력 다섯 가지' -> '공부결과'」 → 게이트 `status --to changes_requested --version 3 --quote …`(v3 sha `2fcadb3a…`, v3 는 승인하지 않음 — v3 승인 한마디·Q9·«대화» 주석 유지/제거·분석 탭 «단어 세트» 범위는 아직 미답). v3 위치 7줄(한눈에 381·섹션 제목 627~628·Q2 1109·1133·근거표 1181·1213). 섹션 이름을 가리키지 않는 다른 «능력»(24줄)은 임의로 넓히지 않고 어긋남 후보 목록만 받는다.
- 2026-10-20 **v4 소환**(`designer-080-v4`, sonnet — 이름 하나 변경): v3 복사 → v4 새 파일, lint·Playwright·diff 확인. v4 완성 뒤 Artifact 게시. **Leader 메모**: 작은 수정이 한 번에 하나씩 오면 버전·검토가 계속 늘어난다 → v4 게시 때 «추가 수정은 모아서 알려 달라» 고 제안하고, 승인·Q9 를 같이 요청한다.

- 2026-10-20 **데모 v4 완성**(`designer-080-v4`, sonnet): `docs/demo/task-080-plan-growth-analysis-v4.html`, lint `DEMO_LINT_PASSED`(Leader 재실행)·v1·v2·v3 해시 불변(`007d48c5…`·`71125a87…`·`2fcadb3a…`)·`src/**` 변경 0. v3 → v4 diff 24줄(= 바뀐 12줄 × 앞뒤): 옛 이름 7곳(한눈에 설명·섹션 제목·낭독 이름·Q2 제목·미리보기·개발 메모 2곳) «공부결과»(10곳), 머리 배지·`demo-version`·«v3 → v4» 한 줄. 옛 이름 «능력 다섯 가지» 는 380행 v4 변경 설명문 1줄에만 남음(화면·패널·메모·머리·메타 0). 점검: Playwright 360/390/412×100·130%×라이트·다크×성장 ①②③ 36상태 — 제목 한 줄·겹침·잘림 0, 가로 넘침·콘솔 오류 0, `aria-labelledby`→제목·접근성 스냅샷 `region "공부결과"`, v3 대비 높이·줄 수 변화 0/36. «능력» 잔존 19줄은 바꾸지 않고 기록에 목록(앱에 그대로 나오는 글: 첫 화면 안내 «능력 단계는…» 621행·«아직 이 능력을…» 711행, 레이더 안내 737행은 대안 A 선택 시만). 기록 [[task-080-designer-v4-record]].
- 2026-10-20 **Artifact v4 게시·검토 요청**: https://claude.ai/artifact/WtJ7Hs3HYqax92FiyyT4UQ (비공개), 게이트 `status --to review_requested --version 4`. **사용자 승인(한 줄) 필요** + Q9(질문 탭 «이번 주») + «능력» 잔존 문구 정리 범위(제목은 «공부결과», 본문 «능력 단계»·«이 능력» 등) + «대화» 주석 유지/제거 + 분석 탭 «단어 세트» 범위.

- 2026-10-20 23:19 **사용자 데모 v4 승인** 「v4 승인, Q9는 A로 해줘」 → 게이트 `approve --version 4`(발화 대조 통과, sha256 `a4167a6f…`, `approved_version: v4`, 해시 verified). **Q9 = A: 질문 탭 «이번 주» 도 일요일 시작으로 통일**(정본 상수 하나를 달력·성장·질문이 같이 씀 — 질문 탭 범위·선생님에게 보내는 글 `prompts/ask.ts:145`·`api-contract.md:1517`·`types/ask.ts:8`·시험이 함께 바뀜). 사용자가 답하지 않은 항목은 **v4 그대로 구현**(권고 유지): 화면 본문 «능력 단계는…»·«아직 이 능력을…» 두 문구는 v4 그대로(제목 «공부결과» 와 어긋나 보임 → 후속 문구 정리 후보), «대화» 주석 한 문장 유지, 분석 탭 «단어 세트» 는 이번 범위 밖.
- 2026-10-20 **구현 계획(Leader)**: 범위 = **[달력|성장]**(Q1 B, 분석 탭·A8·공부계획서는 후속 task). 갈래: ① designer 구현 가이드(`docs/screens.md` 새 절 — `designer-080-guide` 작성 중, 응답 사양 초안 포함) → Leader 가 #78 정본 반영 ② developer 서버(주 시작 상수·ASK 범위·성장 API #78·DAILY 능력 축 새 칸·백필 스크립트 dry-run 기본) ③ developer UI(분절 [달력|성장]·성장 화면·달력 요일 일~토·`/plan/growth` 라우트) → reviewer → qa → 배포. **백필은 운영 데이터 1회 쓰기라 `--apply` 는 사용자 승인 뒤**. DB 스키마 변경 없음(승인 필요 사항 없음). 화면 파일 편집 전에 가이드에 승인 버전(v4)이 적혔는지 확인 후 `check.mjs activate`.

- 2026-10-20 **구현 가이드 완료**(`designer-080-guide`): `docs/screens.md` §36(414줄, 36-0~36-18)·§2 화면 표에 `/plan/growth` 행. v4 해시 불변·`src/**` 변경 0. 핵심: `/plan/growth` 는 `(tab)` 옆(달력 «곧 열려요» 가 먼저 안 보이게)·`PlanSwitch`(DrawerSwitch 선례)·`growthCopy.ts` 단일 출처·계산 규칙(서버/화면 구분, 정수 경계 20건·3일·역할극 5번·50/70/85%·±5%p)·#78 응답 초안·DAILY `skills` 칸·백필(dry-run 기본, `--apply` 는 사용자 승인 뒤, 백업·top-up·멱등)·달력 변경 표·질문 탭 상수. **가이드가 찾은 사실 2건**: ① [확실] DAILY `attended` 는 어떤 코드도 true 로 쓰지 않음(데모 근거표 오류) → 출석·연속·`since` 는 `Attendance` 에서 읽음 ② [가능성 높음] 승인 규칙대로면 «맞게 쓴 문장은 관측이 안 남아» 대화 많은 사용자의 문형·조사·문장 산출이 «시작 단계»로 치우칠 수 있음 → 백필 dry-run 의 계정별 단계 분포를 보고 표시 정책 결정. 기록 [[task-080-designer-guide-record]].
- 2026-10-20 **Leader 결정 L1~L10**(`screens.md` §36-17-1 에 기록): L1 `Attendance` 포함(정본 예외 한 줄)·L2 승인 규칙 그대로+백필 dry-run 분포로 사후 판단·L3 «일부»·needDays 한 줄·12주 둘째 줄 정정은 v5 없이 구현하되 사용자에게 전·후 공개·L4 사용자 기존 규칙(2026-10-07 셈 뜻 «세요» 금지) 적용 — 승인 글의 두 문장을 «…계산해요» 로(사용자에게 보고)·L5 코드 상수 색·L6 자기수정 제외·L8 `ask` 프롬프트 한 문구+버전 증가는 developer 가 관례대로(PE 생략)·L10 백필 `--apply` 는 배포 뒤 dry-run 보고와 함께 사용자 승인. 데모 게이트 `activate` 완료.
- 2026-10-20 **정본 갱신(Leader)**: `api-contract.md` #78(응답 additive·`weeks=4|8|12`·`errorTrend` 제거·원천에 `Attendance`)·§2-18-A «이번 주 일~토»·`domain-model.md` DAILY `skills` 칸·`attended` 미기록 명시·`learning-personalization §2-3` 개정 노트(`LearnerSkillState` 표 대신 DAILY 칸)·`design-spec.md` §7-6·결정 기록 `30-Knowledge/decisions/week-start-sunday.md`.
- 2026-10-20 **구현 소환(병행, opus — judge R2·복잡도 2.07, 훅이 model 명시를 권해 기록)**: `dev-080-server`(미러 dev080s — `infra/dates` 주 시작 상수 최우선·질문 탭 일요일·성장 API #78·DAILY `skills` 칸+쓰기 경로·백필 스크립트 dry-run) / `dev-080-ui`(미러 dev080u — `PlanSwitch`·`/plan/growth`·성장 화면 부품·`growthCopy`/`growthLogic`·달력 요일(마지막, `WEEK_START_DOW` 존재 확인 후)·시각 검증 포트 3021). 파일 소유 분리(서버: `src/modules/**`·`types/ask`·API 라우트·`scripts/`, 화면: `src/app/(app)/plan/**`·`src/components/plan/**`). 끝나면 reviewer → Leader 시험·실서버 확인 → qa → 배포(백필 `--apply` 는 사용자 승인 뒤).

- 2026-10-21 **서버 갈래 `dev-080-server` 80턴 한도로 중단**(백필 스크립트 직전, 이어받기 금지 규칙 — 351k 컨텍스트라 신규 소환). 끝난 것(기록 [[task-080-dev-server-record]]): ① `infra/dates` `WEEK_START_DOW`·`weekStartOf`(시험 5) ② 질문 탭 일요일 시작(`recordRetrieval/range.ts`·`ask.ts`·`prompts/ask.ts` `ask@v2→v3`, 시험 갱신 — ask 관련 7파일 183/183) ③ DAILY `skills` 칸(`mergeSkills`·`growthSkillDelta`, 두 쓰기 지점) ④ 성장 API(`learning/snapshots/growth.ts`·라우트·`src/types/plan.ts` `Growth*` 타입, 시험 17+3). 남음: 백필 스크립트·dry-run 실행·변이 시험(앞선 개발자 미실시)·전체 점검. → **`dev-080-server2`(opus) 소환**(백필 + 변이 5종 + dry-run 보고 + tsc/eslint). 화면 갈래 `dev-080-ui` 는 아직 진행 중(많은 파일 작성됨 — `PlanSwitch`·`Growth*`·`growthCopy/Logic`). 서버 갈래의 공용 타입·상수는 SendMessage 로 화면 갈래에 전달함.

- 2026-10-21 **화면 갈래 `dev-080-ui` 도 80턴 한도로 중단**(growthLogic 시험 직후, 신규 소환 규칙). 끝난 것(기록 [[task-080-dev-ui-record]]): 분절·라우트(`PlanSwitch`·`/plan/growth` page·loading)·부품 전부·문구 단일 출처(L3 정정·L4 «…계산해요»)·달력 일요일 시작(`WEEK_HEADERS`·`monthGrid`·시험)·시험(plan + `copyNoSeyo` 72/72, tsc 0·eslint 0 — developer 보고). 서버 갈래의 `Growth*` 타입은 `@/types/plan` 에서 import(중복 0). 남음: 변이 시험·시각 검증(헤드리스, fixture 응답)·자리표시 상수 실측·최종 점검 → **`dev-080-ui2`(opus) 소환**. 서버 마무리(`dev-080-server2`)와 병행 중. **교훈 후보**: 이번 task 의 두 갈래 모두 80턴에 걸림 — 큰 구현은 처음부터 2회차(마무리·검증)를 계획에 넣거나 갈래를 더 쪼갠다(이슈 후보로 기록 검토).

- 2026-10-21 **서버 갈래 마무리 완료**(`dev-080-server2`, opus): 백필 스크립트(`scripts/backfill-growth-skills.ts` + `learning/snapshots/backfillSkills.ts`)·시험 `task080Backfill.test.ts` 10개·**변이 11건 전부 포착**(지시 5 + 날짜 묶기·dry-run 쓰기·세트 소유자·사용자 잠금 등, 처음 2건 놓쳐 시험 보강)·서버 시험 146파일 2154개 중 2152 통과·실패 0·건너뜀 2·tsc 오류 0(미러 전체)·변경 파일 eslint 0. **dry-run(읽기만 — SQL SELECT 42건·쓰기 0·userId 출력 0)**: 계정 6·관측 626건·바꿀 행 기존 14 + 새로 만들 5·기간 10-03~10-21·어긋남 0. 기록 [[task-080-dev-server2-record]].
- 2026-10-21 **dry-run 이 찾은 사양 위반 전제 1건 → Leader 결정**: 사양 §36-8 은 «관측은 있는데 DAILY 행이 없는 날은 없다(방어)» 로 봤으나 실제 5행(관측 235건)이 있음 — [가능성 높음] `tests/live/*-smoke.ts` 정리 단계가 DAILY 행만 지우고 관측을 남긴 잔여분. 새 행을 만들면 #6 계정 공부결과 숫자 전부가 테스트 잔여분이 되고 `since` 도 앞당겨질 수 있음 → **결정: 행이 없는 날은 만들지 않고 «건너뜀(행 없음)» 으로 센다(기존 행 top-up 만)**. `dev-080-server2` 에 SendMessage 로 좁은 수정 지시(시험·변이·dry-run 재실행·L2 자료).
- 2026-10-21 **L2 판단 자료(dry-run)**: #1 계정 문형·조사 n=230·13%·**0단계**, 틀림 177건이 전부 교정 제안 관측이고 맞힘은 수업 문제 6건뿐 → **한쪽 증거 편향이 실제로 크다**(교정 제안은 틀림만 남기고 맞게 쓴 문장은 관측이 안 남음). 사용자에게 보여 주기 전에 결정 필요(규칙 변경은 사용자 결정): A 승인 규칙 그대로 표시 / B 교정 제안은 단계 계산에서 제외 / C 한쪽 증거만 있으면(예: 판정 관측 90% 이상이 교정 제안) «아직 판단하기 일러요» 로 두기(Leader 권고).

- 2026-10-21 **서버 수정 완료**(`dev-080-server2`, 행 없는 날은 만들지 않음): `bumpDailySnapshot` 으로 행을 만들던 경로 삭제, dry-run·`--apply` 같은 규칙(기존 행 top-up 만, 행 없음은 «건너뜀»). dry-run 재실행(SELECT 21건·쓰기 0·userId 출력 0): 갱신할 기존 행 14·건너뜀(행 없음) 5행·관측 235·더할 관측 391·어긋남 0. 시험 `task080Backfill.test.ts` 12/12, 변이 «행 없을 때 만들기»(계획·적용 양쪽) 포착(4개·1개 실패)·원복 `cmp` 일치, 서버 시험 전체 2156개 중 2154 통과·실패 0·건너뜀 2, tsc 오류 0, 변경 파일 eslint 0. **L2 갱신 숫자**: 문형·조사 표본 기준을 넘긴 계정 1개(#1, n=119·18%·0단계)이고 교정 제안 틀림 때문에만 0단계가 되는 계정이 바로 그 1개(제안을 빼면 표본 부족). #4·#6 은 건너뜀 처리로 모든 축 n=0. 계정별 분포는 [[task-080-dev-server2-record]] 체크포인트 9.
- 2026-10-21 **대기**: `dev-080-ui2` 화면 마무리(변이·시각 검증·자리표시 실측) + **사용자 L2 결정(A/B/C)**. 그 뒤 reviewer 소환(서버·화면 한 번에 — 백필 안전성·API·6층·접근성·글 조각 정정·«세요» 시험 확인).

- 2026-10-21 **화면 마무리 완료**(`dev-080-ui2`, opus): 변이 시험 17건 전부 포착(원복 `cmp` 일치)·시각 검증(`next build` + 127.0.0.1:3021, 성장 108조합(데이터 7상태×3폭×100·130%×라이트·다크, 오류·로딩 포함)·달력 12조합) 가로 넘침·11px 미만 글자·콘솔 오류·엔진명 0, 성장 화면 44px 미만 터치 0·동작(분절 `aria-current`·기간 4/8/12(28/56/84칸)·지표 칩 6개·‹ ›·«표로 보기»·AI 평가 0건 빈 상태) 정상·달력 일~토·10월 앞 빈칸 4·챌린지 띠·«곧 열려요» 없음·승인 데모와 눈 비교 차이 없음 / 자리표시 상수 3폭 중앙값 보정(숫자 칸 80→88·체크내역 290→330·주마다 공부량 300→347, 실측 단언 1줄) / plan 시험 + copyNoSeyo 72/72·tsc 전체 0·변경 파일 eslint 0 — developer 보고. 기록 [[task-080-dev-ui2-record]]. 지시와 다르게 한 것: `qa-session.ts` 는 upsert 라 쓰지 않고 QA 계정 id 만 읽어 메모리에서 토큰 생성(쿠키 파일 없음), 출석 체크인 POST 는 가짜 응답으로 차단. **발견 1건(범위 밖 보고)**: 달력 «오늘» 단추 터치 높이 42px(2026-10-03 부터). **미해결 1건**: 화면이 처음 뜰 때 밀림 — 모든 계정이 «적음» 상태라 자리표시에 없는 적음 안내(`fewNote`) 때문에 체크내역이 390/412 에서 67px·360 에서 103px 내려감(상수 보정으로 못 없앰) → designer 점검에 넘김.
- 2026-10-21 **독립 감사·점검 병행 소환**: `rev-080-server`(REV-080-S, sonnet — 백필 안전성·API #78·계산 규칙·DAILY `skills` 쓰기·질문 탭 일요일·`weekStartOf`) / `rev-080-ui`(REV-080-U, sonnet — 문구·접근성·훅·라우트·달력·계산·6층) / `designer-080-check`(opus — 구현 vs 승인 데모 + `ui-design-reviewer`·`ui-accessibility-reviewer` + 로딩 밀림 해결안 권고). 사용자 L2 결정(A/B/C) 대기 중.

- 2026-10-21 **REV-080-U PASS_WITH_NOTES**(`rev-080-ui`, Critical 0·High 0·**Medium 1**·Low 4·Info 5): M1 `useGrowthData` 상태 기계(재시도 500ms 유예·기간별 캐시·오류 잊기)에 자동 시험 없음(읽기로는 사용자 간 캐시 누출·토큰/로그 저장·중복 요청 없음) → QA 가 실제 브라우저로 확인(36-16 #6) / L1 기간 4→8→4 왕복 시 «고른 주» 가 복원됨 — 사양 36-6 D «기간을 바꾸면 다시 이번 주» 와 다름(`WeeklyBars.tsx:27-32`, 변이 R8 도 시험이 못 잡음) / L2·L3 ‹ › 끝 칸 `aria-disabled`·클릭 방어 시험 없음(방어 사라지면 `weeks[-1]` 로 화면 렌더 실패, R5·R5b 생존)·`copyNoSeyo.test.ts` 정규식에 «만·을·를» 없어 «역할극만 세요» 를 못 잡음(R1b 생존, 실제 방어는 `growthCopy.test.ts`). 직접 재실행: plan+copyNoSeyo 72/72·`src/components`+`infra`+`app` 시험 2144건 중 2143 통과·tsc 0·eslint 0, 달력 2000-01~2100-12 `monthGrid` 불일치 0·시간대 3종 동일·`weekStartOf` 2025-12~2027-12 전수 통과·`monthGrid`/`WEEK_HEADERS` 소비처 `CalendarSection` 하나뿐, 변이 10건 중 6 포착·4 생존, 데모 게이트 PASSED. 문구는 데모 v4 와 대조해 어긋난 10조각이 전부 사양(L3·L4·`docTitle`·낭독·`loadingSr`)이 정한 것. 첫 화면 밀림 원인은 `fewNoteOf` 하나·서버·클라이언트 자리표시는 같은 부품·같은 상수(둘 사이 점프 없음). 기록 [[task-080-reviewer-ui-record]].
- 2026-10-21 **대기**: `rev-080-server`·`designer-080-check` + 사용자 L2 결정(A/B/C). 모이면 **수정 1회로 묶는다**(화면 L1 동작·시험 보강 M1/L2/L3 + 서버 지적 + designer 밀림 해결안 + L2 선택 반영) → 좁은 재감사 → Leader 시험·실서버 확인 → QA → 배포 승인.

- 2026-10-21 **REV-080-S PASS_WITH_NOTES**(`rev-080-server`, Critical 0·High 0·Medium 0·Low 5·Info 6, `native_change` false): **백필 안전성 이상 없음** — 기본 읽기 전용·행 없는 날 미생성·top-up 멱등(두 번째 실행 0)·잠금 순서가 기존 쓰기와 같음(READ COMMITTED 라 잠근 뒤 재읽기 유효)·복원 SQL(JSON_SET/JSON_REMOVE) 문법을 MariaDB 에서 리터럴 SELECT 로 확인. Low: L-1 백업 기본 폴더 `./backups` 가 `.gitignore` 에 없고(`git check-ignore` 종료 1) 릴리스 폴더 안에 생김·백업 파일에 userId·행 id 가 있음 → `--apply` 때 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 필수 + `.gitignore` 에 `backups/` 추가 / L-3 `screens.md` §36-8 이 아직 «행 없으면 `bumpDailySnapshot` 으로 만든다» 라 결정과 반대(**Leader 가 고침 완료**) / L-2·L-4 시험 제목 낡음(`task080Backfill.test.ts:243`)·`longestRunOfDates` 중복 시험은 가드를 지워도 통과(운영 영향 없음). 직접 재실행: 서버 시험 2156 중 2154 통과·실패 0·건너뜀 2·tsc 0·eslint 0·dry-run 출력에 userId/이메일/연결 문자열 없음·SQL SELECT 21건 쓰기 0·변이 19건 중 17 포착·2 생존(1은 동등 변이)·`weekStartOf` 를 파이썬과 11개 날짜×시간대 4종으로 대조 일치·질문 탭 날짜를 사양 표와 대조 일치·`ask@v3` 체크섬은 버전 문자열만 바뀜. 기록 [[task-080-reviewer-server-record]].
- 2026-10-21 **Leader 조치 2건 즉시 처리**: `docs/screens.md` §36-8 문장을 «행 없는 날은 만들지 않음(건너뜀)» 으로 정정 완료. `.gitignore` 의 `backups/` 추가는 코드 수정 라운드에 포함(배포 절차에 `--backup-dir` 명시).

- 2026-10-21 **디자인 점검 완료**(`designer-080-check`, opus): 구현 60조합 vs 승인 데모 60조합(5상태×3폭×100·130%×라이트·다크) 비교 — 섹션 순서·색·글자 크기·빈 상태 문구·접힘 기본값 동일, **사양과 다른 구현 0건**(차이는 사양이 정한 분절 아래 12px·카드 사이 18px 뿐 — 데모는 공용 CSS 겹침으로 18·10px 로 그려졌음, 문서 정정만). ui-design P0 0·P1 0·P2 7, a11y Critical 0·Major 0·Minor 3, 가로 넘침·44px 미만 터치·11px 미만 글자 0(24조합, 표 모두 펼침). 같이 고칠 것: 읽기 줄 굵은 값이 «공부한 / 날 2일» 로 접힘 → `whitespace-nowrap`. 초점 링은 사양의 accent 2px 가 아니라 브라우저 기본 링(문서 정정). 범위 밖: 다크 앱바 아바타 대비 2.46:1. **밀림 전제 정정**: «모든 계정이 적음» 은 백필 `--apply` 전에만 맞음 — 백필 뒤 #1 계정은 3축이 표본 기준을 넘어 안내가 사라져 밀림 0/−1px(규칙 A 기준), L2 가 B·C 면 #1 에도 안내가 남을 수 있음. 밀림 실측(체크내역 기준) 백필 전 390 +67·412 +47·360 +84·130% +130. **권고 ②: 안내를 «공부결과» 소개 줄 아래로 이동**(데모와 배치 다름 — 사용자 확인 필요). ①(자리표시에 안내 예약)은 백필 뒤 #1 에서 −67px 로 거꾸로 밀려 비권고. reviewer L1(기간 왕복 시 고른 주 복원)은 사양·데모 모두 «이번 주로 돌아감» → 사양대로 고치기. 기록 [[task-080-designer-check-record]].
- 2026-10-21 **사용자 결정(AskUserQuestion, 세 질문 모두 권고대로)**: **L11 C 규칙**(판정 관측의 90% 이상이 교정 유래면 단계를 숨기고 «아직 판단하기 일러요») · **L12 적음 안내를 «공부결과» 소개 줄 아래로 이동**(승인 데모와 배치가 달라지는 곳) · **L13 달력 «오늘» 단추 44px 같이 수정**. 설계 확인: C 규칙은 DAILY `skills` 칸에 교정 유래 개수가 없으면 판정할 수 없어 **`fromCorrection` 칸 추가가 필요**(증가만·옛 행은 0 → 백필 전 = 승인 규칙 그대로) — `screens.md` §36-17-2·`api-contract` #78(`skills[].oneSided`)·`domain-model` 에 기록.
- 2026-10-21 **수정 라운드 소환**(감사 수정은 **1회로 묶음**): `designer-080-addendum`(sonnet — 가이드 보강: `oneSided` 행 문구·안내 이동·«오늘» 44px·정정) + `dev-080-fix-server`(opus — `oneSided` 타입 최우선·`fromCorrection`·`growth.ts`·백필·L-1~L-4·dry-run 재실행·변이 4). 이어서 `dev-080-fix-ui`(화면 L1 이번 주 복귀·시험 M1/L2/L3·안내 이동·`oneSided` 행·`nowrap`·«오늘» 44px) → 좁은 재감사 → Leader 시험·실서버 확인 → QA → 배포 승인.

- 2026-10-21 **가이드 보강 완료**(`designer-080-addendum`, sonnet): `docs/screens.md` 36-17-3 + 36-3·36-4·36-5·36-6 E·36-9·36-11·36-12·36-13·36-16 갱신, 승인 데모 v4 해시 불변·`src/**` 변경 0. ① «한쪽 증거» 행(표본 부족 행에서 진행선·숫자·링크만 뺀 모양) 새 글: 본문 «교정 기록이 대부분이라 단계를 보이지 않아요.» + 축별 안내(어휘 회상 «오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.»·문형·조사 «수업 문제도 풀면 단계가 보이기 시작해요.»·문장 산출 «수업 «말하기» 과제도 하면 단계가 보이기 시작해요.»), 안내에 «역할극» 제외(역할극은 «대화 유지» 축에만 쌓이고 그 축은 교정이 안 쌓여 한쪽 증거가 될 수 없음) ② 안내 위치 이동(`fewNote` → «공부결과» 소개 줄 아래, 센 기준 `enough` → `stage !== null`, 자리표시는 예약 안 함) ③ «오늘» 단추 `before:-inset-y-1.5` → `before:-inset-y-[7px]`(눌림 42→44px, 보이는 알약 32px 불변) ④ 정정 ⑬~⑯(간격 12/18/10px·초점 링 브라우저 기본·읽기 줄 `whitespace-nowrap`·**기존 코드 충돌 2곳**: `ResultRows` 가 `stage===null` 이면 «표본 부족» 으로 보내 한쪽 증거 줄이 «관측 119건 · 3일에 걸쳐…» 자기모순 문장을 그릴 뻔함 → 분기를 앞에 둠 / `fewNoteOf` 가 `enough` 로 세어 한쪽 증거 축을 «보이는 축»으로 셈 → `stage!==null`). 범위 밖 관찰: `EvalHistory`·`EvalStartScreen`·`RolePlayGoalCard` 에 «오늘» 단추와 같은 42px 눌림 패턴(실측 안 함). 기록 [[task-080-designer-addendum-record]].
- 2026-10-21 **Leader 결정(addendum 확인 필요 6건)**: ① 안내 센 기준 `stage!==null` 수용 ② 줄 선후 — **서버 `oneSided = recorded && enough && 10·fromCorrection ≥ 9·n` 로 정의 수정**(표본 부족이 먼저, 차면 한쪽 증거로 바뀜; 정본 `screens.md` 36-17-2·`api-contract` #78 수정, `dev-080-fix-server` 에 SendMessage) ③ 새 글은 L3 선례대로 재승인 없이 구현·**사용자에게 전·후 공개** ④ 안내에서 «역할극» 제외 수용 ⑤ `fewNote`·`notRecordedBody` 의 «능력» → «단계는» 제안은 **사용자 확인 전까지 승인 글 유지**(사용자에게 선택지로 보고) ⑥ [단계는 이렇게 정해요] 여섯째 줄 제안은 **사용자 확인 전까지 변경 안 함**(5줄 유지).

- 2026-10-21 **서버 수정 완료**(`dev-080-fix-server`, opus): C 규칙 구현(`oneSided = recorded && enough && 10·fromCorrection ≥ 9·n` — Leader 수정 정의 반영, 참이면 stage·trend null·spark []) · DAILY `skills[axis].fromCorrection`(교정 제안·재사용 중 판정된 관측만, 넘김·불확실 제외, 증가만) · `mergeSkills`·백필 top-up 도 이 칸 `max(0,R−C)` · 옛 행(칸 없음)은 0 → 판정 영향 없음 / 감사 수정: `.gitignore` 에 `backups/`·스크립트 머리 주석과 dry-run 마지막 줄에 운영용 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 안내·L-2 시험 제목·L-4 `longestRunOfDates` 중복 시험이 가드를 지우면 실패하도록. **서버 시험 146파일 2164건 중 2162 통과·실패 0·건너뜀 2**(처음 `task010b`·`task010d` 기존 시험 4건이 깨져 기대값에 `fromCorrection` 칸을 넣어 고침)·task080 시험 3파일 44/44·eslint 0·**변이 15건 전부 포착**(90% 경계·REUSED 빼기·덮어쓰기·top-up 에서 빼기·`enough` 조건 빼기 포함, 원복 `cmp`). dry-run(읽기 전용 SELECT 21·쓰기 0·userId 출력 0): 더할 관측 391건 중 `fromCorrection` 147건 / 4주 분포 — 문형·조사는 0단계였던 1계정이 `oneSided` 로 바뀜(oneSided 1·short 1·none 4), 어휘 1단계 1·2단계 1·short 2, 문장 1단계 1·short 1, 대화 유지 short 1. **#1 계정**: 문형·조사 교정 비율 95%(113/119)라 단계를 숨기고, 문장은 72%(31/43)라 1단계 그대로. 남은 `tsc` 오류 1건은 화면 쪽 `growthFixtures.ts:76`(`oneSided` 가 `boolean|undefined`) — 화면 수정 라운드에서 해결. 기록 [[task-080-dev-fix-server-record]].
- 2026-10-21 **`dev-080-fix-ui`(opus) 소환**: 한쪽 증거 행(줄 모양 순서·`ResultRows` 분기)·안내 이동(`stage!==null`·자리표시 예약 안 함)·«오늘» 단추 `-inset-y-[7px]`·L1 이번 주 복귀·`whitespace-nowrap`·시험 보강(M1 컨트롤러 분리 허용·L2·L3·픽스처 tsc)·시각 검증(포트 3021)·변이 ≥5·화면 점검. 바꾸지 않는 것: «능력» 문구·5줄 `how`·범위 밖 42px 패턴.

- 2026-10-21 **화면 수정 완료**(`dev-080-fix-ui`, opus; 파일 16개 — 사양 지침 15개를 약간 초과, 모두 `src/components/plan/**` + `copyNoSeyo.test.ts`): ① 한쪽 증거 행 — `rowShapeOf`(36-4 순서: 기록 전 → 표본 부족 → 한쪽 증거 → 단계)·`ResultRows`(새 글 2종, 진행선·막대·숫자·링크 없음)·`fewNoteOf` 는 **실제로 단계가 보이는 축만** 셈(서버 계약상 `stage!==null` 과 같고 서버가 틀려도 일관) ② 안내가 «공부결과» 카드 소개 줄 아래로(타일에서 제거)·자리표시는 예약 안 함·`growthSkeletonSizes` 는 주석만 ③ «오늘» `-inset-y-[7px]`(44px) ④ L1: 기간을 바꾸면 항상 이번 주로(4→8→4 포함, 지표 칩 유지)·`WeekNav` 분리(끝 칸 `aria-disabled`·클릭 무동작)·읽기 줄 굵은 값 `whitespace-nowrap`·`copyNoSeyo` 정규식에 만·을·를(새 위반 0) ⑤ **M1: 데이터 훅 상태 기계를 프레임워크 없는 `growthLoader.ts` 로 분리**(가짜 fetch·가짜 시계 시험 8개) — **사양 밖 변경: 기간 상태가 `GrowthScreen` → 훅으로, 재시도 추적이 요청 클로저 → 로더로 이동** ⑥ 픽스처 tsc 오류 수정·한쪽 증거 픽스처 추가. 점검(developer 보고): plan+challenge 시험 165/165·`tsc` 전체 0·eslint 0·변이 16/16 포착(**V3b — 고른 주 복원 줄을 지우는 변이는 소스 문자열 단언만 잡음, 행동 시험 없음**)·시각 검증 72조합(6상태×3폭×100·130%×라이트·다크) 가로 넘침·44px 미만 터치·11px 미만 글자·콘솔 오류 0·390/412 에서 안내가 카드를 밀지 않음·«오늘» 3폭 모두 44px·기간 왕복은 이번 주·재시도는 자리표시 ≥500ms 뒤 포커스가 오류 제목으로. **알려진 한계**: 360px 에서 카드가 +17/+38px 움직임(안내가 아니라 자리표시 상수 때문). 서버는 PID 로 종료·포트 3021 빔. 기록 [[task-080-dev-fix-ui-record]].
- 2026-10-21 **좁은 재감사 소환**(`rev-080-r2`, sonnet — 서버+화면 수정분: C 규칙·백필 안전성 유지·`growthLoader` 동작 동일성·한쪽 증거 행·안내 이동·달력·시험 질·V3b 위험 판단) + **Leader 게이트**(전용 미러 `lead080`: `tsc`·변경 파일 eslint·전체 시험, 백그라운드).

- 2026-10-21 **Leader 게이트 통과**(전용 미러 `lead080`, `src`·`tests`·`prisma` 작업트리와 동일 — `scripts` 는 동기화 대상 밖 파일(빌드·미러 도구)만 달라 정상, 백필 스크립트는 미러에 있고 eslint 대상): `tsc` 0·변경 파일 eslint 0·**전체 시험 4,677건 중 통과 4,674·실패 0·건너뜀 3**. 재감사 `rev-080-r2` 결과 대기 → 이어서 QA(실서버 확인 — #78 401·400·실데이터 응답·화면·달력·질문 탭 이번 주 회귀).

- 2026-10-21 **재감사 `rev-080-r2` 60턴 한도로 중단**(중간 기록 1줄뿐 — 서버 C 규칙 직접 대입 통과: 정확히 90%·89.9%·`enough=false` 면 거짓·신뢰도 0.59→`uncertain` 만·SKIPPED 제외·REUSED/PROPOSED 가 교정 유래·발음 축 제외·옛 행 0 시작; 이후 화면 시각 하네스(`matrix·shift·today·inter·rows` 모드)를 직접 만들다 턴 소진). 재개하지 않고 **범위를 둘로 나눠 신규 소환**: `rev-080-r2s`(서버 — 백필 안전성 유지·`fromCorrection` 쓰기·`growth.ts` 응답·시험 질·변이 3+) / `rev-080-r2u`(화면 — 로더 분리 동일성·`rowShapeOf`·안내 이동·달력/기간·시험 질·V3b 위험), 각 45턴·체크포인트 필수·**브라우저·하네스·서버 기동 금지**(시각 검증은 개발자 보고와 Leader QA 몫). 이슈 후보 **CAN-0017**(서브에이전트 턴 한도 반복 중단 — 이번 task 3회).

- 2026-10-21 **REV-080-R2U PASS_WITH_NOTES**(`rev-080-r2u`, Critical 0·High 0·Medium 0·**Low 2**·Info 5, 40턴 — 서버·브라우저·LLM 미사용): 직접 재실행 plan+challenge 165/165·tsc 0·eslint 0 / 변이 14건 중 13 포착(개발자 보고 16건 중 8건 직접 재현 + 로더 쪽 6건 추가, 원복 `cmp` 동일) / **로더 분리 동작 불변**(캐시는 화면 인스턴스 안이라 사용자 간 누출 없음·요청은 기존 `apiGet`·500ms 유예·오류 잊기·언마운트 뒤 무변화·기간 빠른 전환 레이스 안전) / `rowShapeOf` 사양 36-4 순서·한쪽 증거 줄에 진행선·숫자·링크 없음·새 글 36-5 와 글자 일치·`oneSided` undefined(옛 응답) 안전 / 안내는 «공부결과» 소개 줄 아래 / «오늘» 눌림 44px·보이는 모양 불변·소비처는 `PlanScreen`·`PlanSkeleton` 의 같은 `MonthNav` 뿐 / 기간 변경 시 이번 주 복귀·지표 칩 유지. Low: L-1 `growthLoader.ts:134` 재시도 중 상태가 기간을 비교하지 않음(지금 화면에서는 재시도 중 기간 분절이 눌리지 않아 도달 불가, 후속 정리) / L-2 구독 해제가 리스너를 지우는지 보는 시험 없음(변이 M12 미포착, 실해 없음). V3b(고른 주 복원 줄 삭제 변이를 소스 문자열 단언만 잡음) 실결함 위험 낮음. **QA 가 볼 곳**: 브라우저 4→8→4 왕복·오프라인 재시도의 초점 이동·한쪽 증거 축 계정의 TalkBack 낭독·글꼴 130% 360px 읽기 줄 «교정 채택 N개» 넘침·«오늘» 위·아래 가장자리 탭. 기록 [[task-080-reviewer-r2u-record]].

- 2026-10-21 **REV-080-R2S PASS_WITH_NOTES**(`rev-080-r2s`, Critical 0·High 0·Medium 0·**Low 1(문서)**·Info 5, 33툴 호출 — 소스 수정·커밋·`--apply`·서버 기동 없음): **백필 안전성 유지** — top-up 이 `fromCorrection` 칸도 `max(0,R−C)`·**코드에 INSERT/upsert 가 없어 행 없는 날을 구조적으로 만들 수 없음**·두 번째 실행 쓰기 0·쓰기는 `--apply` 뒤에만 도달·잠금 순서 사용자→DAILY `FOR UPDATE`→재읽기·`.gitignore` `backups/` 있음. **dry-run 직접 실행**: 종료 0·SELECT 21건뿐 쓰기 0·출력에 이메일·userId·연결 문자열 없음, 숫자(사용자 6·관측 626·대상 행 14·건너뜀 5행/235건·더할 391 중 `fromCorrection` 147)가 개발자 보고와 같고 **독립 SQL 로 센 교정 유래 관측(어휘 2·문형·조사 114·문장 31 = 147)도 일치**, 운영 DB 의 DAILY 행 중 `skills` 를 이미 가진 행은 0. 쓰기 지점은 `observations/index.ts`·`scenarios/end.ts` 두 곳뿐이고 둘 다 같은 트랜잭션, 역할극은 `fromCorrection` 0, `mergeSkills` 증가만·모르는 키 보존, 응답은 api-contract #78 과 같고 `errorTrend` 없음. 변이 14/14 포착(`enough` 조건·90% 경계·top-up 의 `fromCorrection` 칸 등), `task010b`·`task010d` 수정은 추가 줄만(검증 약화 없음), 서버 시험 2164 중 2162 통과·실패 0·skipped 2·tsc 0·eslint 0. Low(문서): `screens.md` 14774·14863 이 옛 정의(`n≥1`, `oneSided` 가 `enough` 와 무관)·14908 과 api-contract 의 «stage null ⇔ !enough» 에 `oneSided` 누락·15045 → **Leader 가 4곳 정정 완료**(`oneSided = recorded && enough && …`, `stage null ⇔ !enough 또는 oneSided`). Info: 건너뛰는 235건 중 교정 유래 판정 관측 130건은 분자·분모에서 함께 빠짐·**운영 `--apply` 는 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 명시 + 새 코드 먼저 배포한 뒤 적용**. 기록 [[task-080-reviewer-r2s-record]].
- 2026-10-21 **감사 종결**: 1차(S·U·디자인) + 재감사(R2S·R2U) 모두 PASS_WITH_NOTES·Critical/High/Medium 0, 문서 정정 4곳 완료. 다음: **QA**(Leader 직접 — 독립 QA 에이전트가 허위 보고한 전례 CAN-0016) → 실서버(미러 빌드 `qa080`, 3011)에서 #78 401·400·실데이터 응답 모양·`/plan`·`/plan/growth` 화면·달력 일~토·회귀.

- 2026-10-21 **QA 완료(Leader 직접 실행 PASS, 결함 0)**: 기록 [[task-080-qa-record]]. 실서버(미러 `qa080`, 3011): #78 무인증 401·`weeks` 5/abc/0/4.5 → 400·계정 4개×4·8·12주 12건 응답(일요일 주 경계·`skills` 5개·`oneSided`·`errorTrend` 없음·PII 없음) 전부 일치·DB 읽기 전용 대조 불일치 0·계정 격리·회귀 6페이지 200·화면 24행(가로 넘침·콘솔 오류·옛 문구 0)·기간 왕복 이번 주·달력 일~토(10/1 이 목요일 아래). **QA 계정에 skills 데이터가 없어** 단계·한쪽 증거 경로는 QA 계정 4 에 임시 스냅샷 10개를 넣어 확인(API 20개 확인 전부 통과·화면 한쪽 증거 줄·표본 부족·기록 전·평가·안내 위치 확인) 후 삭제(10/10, 행 수 원복). 서버 PID 종료·포트 비움·쿠키 삭제. NOT_VERIFIED: TalkBack·실기기·글꼴 배율·실계정 e2e(백필 `--apply` 뒤).
- 2026-10-21 **다음: 사용자 배포 승인 요청** — 알릴 것: ① QA 가 Leader 직접 실행 ② 감사 전 과정 PASS_WITH_NOTES·Critical/High/Medium 0 ③ 승인 데모와 달라진 곳(L3 글 조각 정정·L4 «세요»→«계산해요»·L12 안내 위치 이동·새 글 4개·로더 분리) ④ 360px 밀림 +17/+38px 한계 ⑤ 푸시하면 웹훅 재배포(`.gitignore`·`scripts/` 포함 — 코드 변경) ⑥ **백필 `--apply` 는 배포 뒤 별도 승인**(dry-run 보고 → 승인 → `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups`) ⑦ 질문 탭 «이번 주» 가 일요일 시작으로 바뀌고 `ask@v3` ⑧ 배포 뒤 폰 확인 항목.

- 2026-10-21 **운영 배포 완료**(사용자 「배포해줘」 — 승인 요청 때 알린 QA 가 Leader 직접 실행·승인 데모와 달라진 곳·360px 한계·월요일→일요일 결정 대체·배포 직후 공부결과가 거의 비어 보임·백필 별도 승인 등을 안 뒤). 게이트 재확인(작업트리 `src`·`tests`·`prisma` = 게이트 미러 동일) → 커밋 `e69f0b1`(코드·시험·스크립트·`.gitignore`) + `054be9f`(문서·vault) → 푸시 08:30 KST → 웹훅 → 릴리스 `20261021-083046-054be9f8`, **롤백 대상 `20261020-114338-8e87bf80`**(옛 코드는 `skills` 칸을 보존하므로 데이터 안전, 질문 탭 «이번 주» 만 월요일로 돌아감, DB 변경 없음). 확인: `current` 전환·pm2 3개 online 재시작 0·헬스 PRODUCTION ok·소스 `ask@v3`·성장 라우트 파일·클라이언트 번들 «공부결과»·«교정 기록이 대부분이라» 각 8파일·서버 번들 `fromCorrection` 7파일·`GET /api/v1/plan/growth` 무인증 401·/login 200·`scripts/backfill-growth-skills.ts` 포함. 운영에서 성장 화면·백필 `--apply` 는 실행하지 않음(읽기 전용 확인만).
- 2026-10-21 **배포 뒤 백필 dry-run 최신(읽기 전용 — `DRY-RUN (no writes)`, applied 0, 숫자만)**: 사용자 6·관측 626(세트 날짜로 묶는 어휘 카드 65·세트 삭제 → `occurredAt` 171·그 밖 390)·갱신할 기존 DAILY 행 14·건너뜀(행 없음) 5행/관측 235·더할 관측 391(교정 유래 147)·기간 2026-10-03~10-21·어긋남 0. 계정 분포(4주 화면 기준): 어휘 회상 1단계 1·2단계 1·표본 부족 2·없음 2 / 문형·조사 **한쪽 증거(단계 숨김) 1**·표본 부족 1·없음 4 / 듣고 응답 6 전부 기록 전 / 문장 산출 1단계 1·표본 부족 1·없음 4 / 대화 유지 표본 부족 1·없음 5. **#1 계정**(가장 활동이 많은 계정): 어휘 회상 n=46·72%·**2단계**, 문형·조사 n=119·18% 교정 유래 113 → **한쪽 증거로 단계 숨김**, 문장 산출 n=43·53%·**1단계**(교정 유래 31 = 72% 라 90% 미만 → 표시), 듣고 응답 기록 전, 대화 유지 없음. «교정 제안 때문에만 0단계가 되는» 계정 = 문형·조사 1개. 보고서 전체 `scratchpad/qa080/dryrun-final.txt`(숫자만).
- 2026-10-21 **대기**: 사용자 **백필 `--apply` 승인**(`--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 명시, 새 코드 배포 뒤라 순서 충족) + 사용자 폰 확인(최종 요약 «사용자가 확인할 것»).

- 2026-10-21 **백필 `--apply` 완료**(사용자 「백필 적용해줘」 — 승인 요청 때 알린 운영 데이터 쓰기·백업 위치·복원 방법·적용 전 공부결과가 비어 보임을 안 뒤). 절차: ① 적용 직전 dry-run 재실행 → 승인 숫자와 완전 일치(기존 행 14·더할 관측 391·교정 유래 147·건너뜀 5행/235·어긋남 0) ② 백업 폴더 `/home/brownjeon/apps/thekaiwa/shared/backups`(700) 생성 ③ `--apply --backup-dir=…` 실행(미러 `qa080` 의 배포와 같은 코드, 종료 0) → **`applied: rows=14 observations=391`**, 백업 `growth-skills-backup-20261021T012805Z.json`(권한 600·17KB·행 14·적용 전 `skills` 가 있던 행 0). **독립 확인**: 적용 뒤 dry-run → 대상 행 0·더할 관측 0·어긋남 0(**멱등**) / 백업 `plannedAdd` 합 538 = 391 + 교정 유래 147 / DB 읽기 전용 합계 — DAILY 16행 중 `skills` 보유 14행, success 76·partial 66·fail 115·skipped 132·uncertain 2 = 391, `fromCorrection` 147 / 운영 헬스 ok. 건너뜀 5행(관측 235)은 만들지 않음(Leader 결정). **복원 방법**(필요할 때만): 백업 파일의 `rows[i].id` 로 `UPDATE … JSON_REMOVE(data, '$.skills')`(적용 전 `skills` 가 없던 행이라 전부 이 경우) — 스크립트 머리 주석 참조, 백업 뒤 실시간으로 더해진 `skills` 증가분은 복원으로 사라짐.
- 2026-10-21 **대기**: 사용자 폰 확인(최종 요약) · 사용자가 «능력» 문구·여섯째 줄 선택. 커밋·푸시는 사용자 요청 시(vault 문서 일부 미커밋).

## 최종 요약 (사용자용 — 운영 배포·백필 완료, 사용자 폰 확인 대기)

> 양식: 워크스페이스 [`user-report-format.md`](../../../../docs/user-report-format.md) §3.

### [task-080] 계획표 성장기록 — [달력|성장] 탭, 체크내역·주마다 공부량·공부결과, 주 시작 일요일

- **상태**: ⏳ 사용자 폰 확인 대기 (운영 배포·백필 적용 완료)
- **무엇이 바뀌었나**: 계획표 위에 [달력 | 성장] 구간 탭이 생겼고 `/plan/growth` 에 성장 화면이 열립니다 — 연속 출석·공부한 날·이번 주 카드, **체크내역**(일별 공부 종류 띠), **주마다 공부량**(단어·수업·복습·대화·교정 채택·공부한 날), **공부결과**(능력 5개: 어휘 회상·문형·조사·듣고 응답·문장 산출·대화 유지 — 단계 4칸, 표본 부족은 «아직 판단하기 일러요», 판정 관측의 90% 이상이 교정에서 온 축은 단계를 숨김), AI 평가 점수. **주 시작이 일요일**로 바뀌어 달력(요일 머리 일~토)·성장·질문 탭 «이번 주» 가 같이 움직입니다. 달력 «오늘» 단추 눌림 44px.
- **배포**: ✅ 운영 반영 — 코드 `e69f0b1` + 문서 `054be9f` · 2026-10-21 08:30 KST · push(웹훅) · 릴리스 `20261021-083046-054be9f8`, 헬스 ok·pm2 3개 online · DB 구조 변경 없음
  - 같은 배포에 함께 실린 작업: 없음 (push 범위 `8e87bf8..054be9f` 은 task-080 커밋뿐)
  - 롤백: 직전 릴리스 `20261020-114338-8e87bf80`(옛 코드는 `skills` 칸을 보존, 질문 탭 «이번 주» 만 월요일로 돌아감)
  - **백필**: ✅ 2026-10-21 10:28 KST 적용 — 기존 일별 기록 14행에 능력 축 칸 391건(교정 유래 147) 추가, 백업 `/home/brownjeon/apps/thekaiwa/shared/backups/growth-skills-backup-20261021T012805Z.json`
- **AI 가 검증한 것**: 전체 시험 4,674/4,677(실패 0)·tsc 0·eslint 0, 독립 감사 5건 PASS_WITH_NOTES(Critical·High·Medium 0)·감사자가 독립 SQL 로 백필 숫자 대조, **QA 는 Leader 직접 실행 결함 0**(실서버 #78 401·400·12응답·DB 대조·회귀 6페이지·화면 24행·임시 데이터로 단계·한쪽 증거·평가 경로 확인 후 삭제), 운영 배포 확인(릴리스·헬스·pm2·번들·#78 무인증 401), 백필 적용 뒤 재실행 0건·백업·DB 합계 일치
  - 검증 못 한 것: TalkBack·실제 폰·실제 안드로이드 글꼴 배율·**운영 실계정의 성장 화면을 직접 열어 본 것**(사용자 세션 없이 확인 불가) · 360px 폭에서 첫 화면 카드가 +17/+38px 움직임(자리표시 상수, 390·412 는 0)
- **👉 사용자가 확인할 것** (앱 → 계획표):
  1. 상단 [달력|성장] 전환, 달력 요일 머리가 **일~토**이고 날짜가 맞는 칸(10/1 은 목요일 아래)에 있는지
  2. 성장 탭 → 체크내역·주마다 공부량 칩 6개·공부결과가 보이는지. **지금은 백필이 끝나 공부결과가 보여야 합니다** — 가장 활동이 많은 계정 기준 예상: 어휘 회상 «자리 잡는 중»(2단계)·문형·조사 «아직 판단하기 일러요 + 교정 기록이 대부분이라 단계를 보이지 않아요»·문장 산출 1단계·듣고 응답 «기록 전»
  3. 360px 폭이나 글꼴 크게(130%)에서 잘림·겹침 없는지
  4. 질문 탭 «이번 주» 질문(예: «이번 주에 내가 자주 틀린 조사 알려줘»)이 일요일부터 센 범위로 답하는지 (선택)
- **👉 사용자가 결정할 것**: 선택 — ① 화면 문구 «능력 단계는 기록이 모이는 대로…»·«아직 이 능력을…» 의 «능력» 을 «단계는» 쪽으로 정리할지(승인된 글 그대로 나갔음) ② [단계는 이렇게 정해요] 접이에 여섯째 줄(«교정으로 남은 기록이 대부분이면 단계를 보여 주지 않아요. 교정에는 틀린 문장만 남기 때문이에요.»)을 더할지
- **남은 일**: 분석 탭(A8 공부계획서)은 후속 task · 듣고 응답 관측 기록 코드·수준 이력은 후속 · 건너뛴 DAILY 행 5개(관측 235건)는 시험 잔여분으로 보여 방치 · 임시 미러 약 118개 정리(사용자 지시 시) · vault 문서 일부 미커밋(요청 시 커밋·푸시)
- **이슈·위험**: 서버·화면 developer 와 재감사 reviewer 가 턴 한도에 걸려 재소환(이슈 후보 CAN-0017) · 승인 데모와 달라진 곳(적음 안내 위치·글 조각 정정·«세요»→«계산해요»·새 글 4개)은 사용자 응답·Leader 결정으로 처리하고 공개함


## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 10-20 19:15 |
| v1 | 검토요청 | docs/demo/task-080-plan-growth-analysis-v1.html | https://claude.ai/artifact/BcKPCvgQHzCLeS8or1y2nU | 사용자 검토 요청 | 10-20 19:52 |
| v1 | 수정요청 | docs/demo/task-080-plan-growth-analysis-v1.html | https://claude.ai/artifact/BcKPCvgQHzCLeS8or1y2nU | "1. '날마다' -> '체크내역' 2. 요일은 월 ~ 일 -> 일 ~ 토 로 변경해줘. 이건 달력의 요일 표기도 함께 변경해줘 그외에는 권고안대로 진행해줘" | 10-20 22:04 |
| v2 | 검토요청 | docs/demo/task-080-plan-growth-analysis-v2.html | https://claude.ai/artifact/Bg1k5EN9STUK52okHJtjPP | 사용자 검토 요청 | 10-20 22:28 |
| v2 | 수정요청 | docs/demo/task-080-plan-growth-analysis-v2.html | https://claude.ai/artifact/Bg1k5EN9STUK52okHJtjPP | "'주마다 공부량' 항목에서 '단어 세트' -> '단어', '대화 말 수' -> '대화'" | 10-20 22:50 |
| v3 | 검토요청 | docs/demo/task-080-plan-growth-analysis-v3.html | https://claude.ai/artifact/6iq2QKXt3noSv3ZUjP76kC | 사용자 검토 요청 | 10-20 22:55 |
| v3 | 수정요청 | docs/demo/task-080-plan-growth-analysis-v3.html | https://claude.ai/artifact/6iq2QKXt3noSv3ZUjP76kC | "'능력 다섯 가지' -> '공부결과'" | 10-20 23:11 |
| v4 | 검토요청 | docs/demo/task-080-plan-growth-analysis-v4.html | https://claude.ai/artifact/WtJ7Hs3HYqax92FiyyT4UQ | 사용자 검토 요청 | 10-20 23:17 |
| v4 | 승인 | docs/demo/task-080-plan-growth-analysis-v4.html | https://claude.ai/artifact/WtJ7Hs3HYqax92FiyyT4UQ | "v4 승인, Q9는 A로 해줘" | 10-20 23:19 |
