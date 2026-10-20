---
task_id: task-080
title: "task-080 designer 기록 — 구현 가이드 보강(screens.md §36-17-3, 감사·점검 뒤 사용자 결정 L11·L12·L13)"
role: designer
status: done
created: 2026-10-21
updated: 2026-10-21
tags:
  - type/record
  - domain/ui
  - domain/plan
aliases:
  - designer-080-addendum
  - task-080 가이드 보강
---

# task-080 가이드 보강 (designer `designer-080-addendum`)

관련: [[task-080-plan-growth-analysis]] · 점검 [[task-080-designer-check-record]] · 최초 가이드 [[task-080-designer-guide-record]] · 구현 [[task-080-dev-ui-record]] · [[task-080-dev-ui2-record]]
승인 데모: `docs/demo/task-080-plan-growth-analysis-v4.html` (v4, sha256 앞 16자 `a4167a6f3c1449d0` — 이번에도 변경 없음 확인). 새 데모 버전 없음(사용자가 L12 를 권고대로 결정).
범위: 문서만(`docs/screens.md`). `src/**`·데모·정본(`docs/design/*`) 수정 0, 커밋·푸시·배포 0, 띄운 프로세스 0.

## Designer 기록

- [07:40] 읽음: §36 전체(36-0~36-18, 특히 36-17-2), 점검 기록, `ResultRows`·`CalendarSection`·`GrowthSummaryTiles`·`growthCopy`·`growthLogic`·`WeeklyBars`(읽기만), `observations/index.ts`(`correctionSkill`·`OBSERVATION_SKILL`·`growthSkillDelta`), api-contract #78 의 `oneSided`, 데모 CSS(`.psw`·`.cd + .cd`·`.sec`)·데모 `weeks:` 핸들러.
- [07:40] `docs/screens.md` §36 보강. 고친 소절: **머리 승인 문단**(보강 한 줄) · 36-0(위계·상태) · 36-2(분절 아래 12px 의 기준이 달력 탭임) · 36-3(의사코드에서 안내를 «공부결과» 카드 안으로, `GrowthSummaryTiles`·`ResultRows` props) · 36-4(②a·②b 기준, 새 ⑩ 한쪽 증거 행, 줄 모양 순서) · 36-5(`fewNote` 자리 표시, `axisOneSided`·`axisOneSidedSub`, 새 글 시험) · 36-6(B `oneSided` 화면 규칙, D 고른 주 왕복·진행선 제외, E 안내 자리·센 기준) · 36-7(`oneSided` 칸) · 36-9(«오늘» 단추 행) · 36-11(적음 안내·간격 정정·읽기 줄 nowrap·한쪽 증거 줄·소개 줄) · 36-12(낭독 순서·초점 링 정정·한쪽 증거 낭독) · 36-13(자리표시 알려진 한계 문장 교체) · 36-16(QA 9 수정·11~14 추가·실기기 3) · 36-17-2(결정 → 확정 사양 쪽지) · **새 36-17-3**(색인·확정 글·정정 ⑬~⑯·수정 라운드 파일·확인 필요) · 36-18(«능력» 후속 메모).
- [07:41] 디자인 스킬: 읽지 않음(가이드 문서 보강 — 새 화면·데모 없음, 점검은 [[task-080-designer-check-record]] 결과를 인용) / 자체 점검 해당 없음.

## 1. 확정한 것 (developer 는 §36 본문대로)

| 항목 | 확정 |
|---|---|
| **L11 한쪽 증거 줄** (`recorded && enough && oneSided`) | «표본 부족» 줄과 같은 모양, 진행선·4칸 막대·숫자 줄·추세·추이선·링크 없음. 오른쪽 `tooEarly`(«아직 판단하기 일러요») 재사용. 본문 + 축별 안내 한 줄. 낭독 = 이름 → 오른쪽 글 → 설명 → 본문·안내 한 문단, 숨김 글 없음 |
| **줄 모양 순서** | `!recorded`(기록 전) → `!enough`(표본 부족) → `enough && oneSided`(한쪽 증거) → `stage !== null`(단계) → 그 밖(표본 부족) |
| **L12 안내 자리** | «공부결과» 카드 안, 소개 줄 아래·첫 축 줄 위. 클래스는 `mt-2` 를 `mb-2` 로(위 간격은 소개 줄 `mb-2` 가 줌). 예약 높이 없음. `GrowthSummaryTiles` 는 숫자 카드 3만, `ResultRows` 가 `fewNote: Rich \| null` 을 받음(`GrowthScreen` 이 계산) |
| **안내 센 기준** | `recorded && enough` → **`recorded && stage !== null`**(한쪽 증거 축을 «보이는 축»으로 세면 안내와 바로 아래 줄이 모순) |
| **L13 «오늘» 단추** | `before:-inset-y-1.5` → `before:-inset-y-[7px]` 한 토막. 30(안쪽 여백 상자) + 12 = 42 였고 + 14 = 44. 보이는 알약 32px 그대로, ‹ › 와 눈에 보이는 높이는 맞추지 않음(눌림만 44). 선례 `JapaneseText.tsx:193` 같은 값 |
| **정정** | 분절 아래 12px·카드 사이 18px(데모 실렌더는 18·10px — 사양 우선) · 초점 링 = 브라우저 기본 링(36-12 옛 문장 삭제) · 읽기 줄 굵은 값 조각 `whitespace-nowrap` |
| **감사 L1 («기간 왕복»)** | 36-6 D 가 «기간을 바꾸면 다시 이번 주» 한 줄이라 **왕복 때 모호**했음(현재 `WeeklyBars` 의 `picked = {n, first, j}` 가 길이·첫 주가 같으면 되살아남). 문장 보강: 기간이 바뀔 때마다(4→8, 8→4, 4→8→4) 이번 주, 지표 칩은 유지(데모 `weeks:` 핸들러 1002~1003행 근거), `key={weeks}` 로 새로 만들면 지표도 초기화되니 쓰지 말 것, 시험 문장 추가. QA 14 |

## 2. 새 글 전문 (글자 그대로 — `growthCopy.ts`)

- `axisOneSided` = **교정 기록이 대부분이라 단계를 보이지 않아요.**
- `axisOneSidedSub`(축마다 문장째 상수)
  - `VOCAB_RECALL` = **오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.**
  - `GRAMMAR_PARTICLE` = **수업 문제도 풀면 단계가 보이기 시작해요.**
  - `SENTENCE_PRODUCTION` = **수업 «말하기» 과제도 하면 단계가 보이기 시작해요.**
  - `LISTEN_RESPOND`·`CONVERSATION_MAINTAIN` = (없음 — 서버가 `oneSided` 를 보낼 수 없는 축, 값이 비면 줄 생략)
- 오른쪽 글은 기존 `tooEarly` «아직 판단하기 일러요». 체 «…해요», 셈 뜻 «세요» 0, 급수·엔진명 0, 축 이름을 문장에 끼우지 않아 조사 처리 없음.
- 낭독 문구: 별도 숨김 글 없음. 읽히는 순서 = 문형·조사 / 아직 판단하기 일러요 / 조사·활용·문형을 맞게 쓰기 / 교정 기록이 대부분이라 단계를 보이지 않아요. 수업 문제도 풀면 단계가 보이기 시작해요.
- 승인 글 그대로 둔 것: `fewNote`(«기록 N일째예요. 능력 단계는 …») 글자. 자리만 옮겼다.

## 3. 사용자·Leader 확인 필요 (36-17-3 D 와 같음)

1. **안내 센 기준 변경**(`enough` → `stage !== null`) — L12 에 딸린 논리 수정, Leader 확인만.
2. **줄 선후 `!enough` 먼저** — 서버 `oneSided` 는 `enough` 와 무관하게 계산(`n ≥ 1 && 10·fromCorrection ≥ 9·n`)이라 관측 3건뿐인 새 사용자도 `true` 가 될 수 있다. 사양은 건수가 채워진 뒤에야 한쪽 증거 줄로 넘어간다(요청 문구 «건수는 채워졌으므로» 와 같은 전제). 대가: 20건·3일 전에는 «20건이 되면 단계가 보여요», 채운 뒤에 «교정 기록이 대부분이라…» 로 말이 한 번 바뀜. 대안 = `oneSided` 우선(진행선이 일찍 사라짐) 또는 서버가 `!enough` 면 `oneSided=false` 로 보냄. [가능성 높음] 사양이 낫다.
3. **새 글(L11) 전·후 공개** — 본문·안내 3개. 승인 데모에 없던 글이라 L3 선례(재승인 없이, 사용자에게 공개)를 따를지 Leader 판단.
4. **안내에 «역할극» 제외** — 요청 예시(«수업 문제·역할극 등»)와 다름. 역할극 완료는 «대화 유지» 축에만 쌓이고 그 축은 교정이 없어 `oneSided` 가 될 수 없다 [확실 — `OBSERVATION_SKILL`·`correctionSkill`·36-8 규칙 표].
5. **`fewNote` 의 «능력»** — 새 자리(카드 제목 «공부결과» 바로 아래)에서는 낱말이 겉돈다. 뜻은 오히려 더 맞음(가리키는 줄이 바로 아래). **기본 = 승인 글 유지**, 제안: «능력 단계는» → «단계는», `notRecordedBody` «아직 이 능력을…» → «아직 이 항목을…»(36-18 후속 후보와 같은 방향). 사용자 확인 필요.
6. **[단계는 이렇게 정해요] 여섯째 줄 제안(확정 아님)**: «교정으로 남은 기록이 대부분이면 단계를 보여 주지 않아요. 교정에는 틀린 문장만 남기 때문이에요.» 확인 전에는 `GROWTH.how` 5줄 그대로.

## 4. 발견 (범위 밖 — Leader 판단)

- **기존 코드 충돌 두 곳** [확실 — 코드 읽음]: ⓐ `ResultRows` 가 `stage === null` 이면 `Waiting` 으로 보내서, 한쪽 증거 줄(`enough` 참)이 «관측 119건 · 3일에 걸쳐 모이면 단계가 보여요(지금 3일)» 같은 **자기모순 문장**을 그린다 → 분기를 `Waiting` 앞에. ⓑ `fewNoteOf` 가 `enough` 로 세므로 한쪽 증거 축이 «먼저 보이기 시작했어요» 로 가리켜질 수 있다. 둘 다 §36 본문에 반영.
- **같은 42px 눌림 패턴 3곳** [가능성 높음 — 같은 계산, 실측 안 함]: `components/eval/EvalHistory.tsx:176`·`components/eval/EvalStartScreen.tsx:189`·`components/scenario/RolePlayGoalCard.tsx:94` 가 `h-8 … border … before:-inset-y-1.5`(30 + 12 = 42). 이번 범위 아님 — 별도 개선 항목 후보.
- 안내를 옮겨도 남는 알려진 한계(36-13에 적음): 기간 줄 1줄 계정 −18px(P2-3) · 360 숫자 칸 보조 글 접힘 +17/+38 · 글꼴 130% 일반 한계(P2-2).

## 5. 산출물

- `docs/screens.md` §36 (보강, +약 500줄 중 이번 보강분은 앞선 §36 본문에 섞여 있음 — 위치는 36-17-3 색인 참고)
- 이 기록. 스크래치 사용 0.
