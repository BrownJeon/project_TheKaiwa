---
task_id: task-054
title: "역할극 목표 카드 표현 칩에 번역(한국어 뜻) 표시 — 「번역」 표시 스위치를 따른다 (IMP-0029, light 트랙)"
status: done
waiting: ""
base_ref: 9b1675b
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-010d-scenario-roleplay, task-026-reading-annotations]
imp: [IMP-0029]
tags:
  - type/task
  - domain/improvement
  - domain/scenario
aliases:
  - 목표 카드 번역
  - task-054
created: 2026-10-11
updated: 2026-10-19
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

# task-054 — 역할극 목표 카드 표현 칩 번역 표시 (IMP-0029)

## 사용자 요청 (원문)
- 2026-10-11 (스크린샷 첨부, 4단계 역할극 진행 화면) 「역할극에 대하여 목표상 표현들에 대하여 번역을 선택해도 번역이 되지않는 이슈가 있음」.

## 관련 과거 이력 요약 (Leader 큐레이션)
- 원인(코드 확인): `RolePlayGoalCard.tsx` 의 핵심 표현 칩은 `JaText`(루비)+`HangulLine` 만 그리고 `e.ko` 를 그리지 않으며 `useDisplayPrefs` 도 읽지 않는다. 데이터는 이미 있다(`keyExpressions[].ko`). 시작 전 시트(`ScenarioSheet` `ExprRow ko`)와 결과 화면(`RolePlayResultScreen` `ExprChip ko`)은 `ko` 를 이미 그린다. 설계 문서에 목표 카드 칩의 번역은 정의돼 있지 않았다(설계 누락).
- 표시 스위치: `useDisplayPrefs()` 의 `showTranslation`(기본 끔) — 앱 전체 한 값. 설정 문구 「번역 펼쳐 두기: 선생님 말과 내 말의 뜻을 처음부터 펼쳐요」.
- 승인된 교훈(`/이슈기록 관련 roleplay display`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 1.22 · R1 · developer=**sonnet** · **light 트랙**(Leader → Developer → Reviewer, 데모·QA 면제 — 사용자 결정 ADP-001 D-10) · demo=none(`DM-light-waive`). 입력·결과: 스크래치 `judge-054-intake*.json`.
- **light 한계(초과 시 standard 승격)**: 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증. 완료 기준: developer 실행 증빙(lint·typecheck·시험·컴파일)을 reviewer 가 재실행해 확인.

## 설계 (Leader)
1. `src/components/scenario/RolePlayGoalCard.tsx`: `useDisplayPrefs()` 로 `showTranslation` 을 읽고, **켜져 있고 `e.ko` 가 비지 않았으면** 칩 안쪽에 한국어 뜻을 줄바꿈 가능한 한 줄(작은 글자·`text-ink2`·`break-keep`)로 더한다. 꺼져 있으면 지금과 한 픽셀도 다르지 않다. 칩은 `min-w-0 max-w-full` 을 지키고 `flex-wrap` 안에서 줄바꿈, 펼친 영역의 높이 상한(`GOAL_REGION_MAX`)·스크롤은 유지. 쓴 표현 ✓ 표시·`sr-only` 문구는 그대로.
2. 켜짐/비어 있음 판단은 순수 함수 `expressionKo(show, ko)`(`scenario/logic.ts`, 예: 앞뒤 공백 제거 후 빈 값이면 null)로 빼서 시험한다(규칙이 화면 안에 숨지 않게).
3. `docs/screens.md` 의 역할극 방 목표 카드 서술에 「표현 칩은 번역 표시를 켜면 한국어 뜻을 함께 보인다(IMP-0029)」 한 줄(이 한 줄은 Leader 가 쓴다 — developer 는 건드리지 않는다).

## 하지 않는 것
- 시작 전 시트·결과 화면·말풍선 변경, 번역 데이터 새로 생성(이미 있는 `ko` 만 사용), 서버·스키마·API 변경, 칩 터치/동작 변경, 다른 화면 칩의 번역 확대(별도 판단).

## 완료 기준
1. 번역 켬 → 칩마다 한국어 뜻 표시, 끔 → 변경 전과 동일. 긴 뜻도 카드 폭 안에서 줄바꿈, 가로 넘침 없음(소스로 판단, 실측은 사용자 폰 확인).
2. 새 시험(순수 함수) + 기존 `scenario` 시험 수정 없이 통과, tsc·eslint 0, 컴파일(`next build` 전용 미러) 0.
3. reviewer 가 증빙을 재실행하고 변이(켬/끔 반전·빈 `ko`)를 시험이 잡는지 확인.
4. 배포 후 읽기 전용 스모크(웹만, DB 변경·APK 없음), 사용자 폰에서 번역 켜고 목표 카드 확인.

## 상태 로그
- 2026-10-11 접수·묶음(base_ref `9b1675b`). 다음: developer(sonnet).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-11 16:09 |

## Leader 기록 (2026-10-11) — 구현 확인
- **developer(sonnet) 완료**: 커밋 `1a3f04d`. 변경 3개 — `scenario/logic.ts`(`expressionKo`)·`RolePlayGoalCard.tsx`(`useDisplayPrefs().showTranslation` 으로 칩마다 한국어 뜻 한 줄)·`__tests__/logic.test.ts`. 시험 먼저(19 pass/1 fail 확인) 후 구현. 번역 줄은 `sr-only`(「, 썼어요」) 앞에 둬 읽는 순서가 「일본어 한글 뜻, 썼어요」, 꺼짐일 때는 DOM·순서 모두 변경 전과 같다. 훅은 조기 `return null` 앞.
- **Leader 직접 확인**: diff 정독(추가 JSX 는 `{ko ? <span …>{ko}</span> : null}` 한 줄) · 통합 게이트(053+054 합친 작업 트리): tsc 0 · eslint 오류 0 · 전체 시험 3,009/3,010 통과 · `next build` 0. 변이 2종(`!show`→`show`·빈 문자열 통과)을 시험이 잡음.
- **문서 한 줄 없음**: 역할극 방 목표 카드의 화면 가이드(「가이드 §3-D」)는 `docs/screens.md` 에 없고 task-010d 이력서·데모에만 있다 → 적을 자리가 없어 동작은 이 이력서와 IMP-0029 에 기록. **문서 공백은 백로그**(역할극 방 화면 가이드를 screens.md 로 옮기기).
- **확인 못 한 것**: 실기기 360/390/412 폭에서 긴 뜻 줄바꿈·`GOAL_REGION_MAX` 스크롤, 설정에서 번역을 켠 직후 방 안 즉시 반영(코드 판단) → 사용자 폰 확인.
- 다음: REV-183 → 웹 배포(light 트랙: QA·데모 면제).

## 감사 결과 (2026-10-11 저녁, Leader)
- **REV-183 PASS**(Critical 0·High 0·Medium 0·Low 1) — [[task-053-054-rev-record]]. light 트랙이라 QA·데모 게이트 면제.
- 2026-10-11 저녁 사용자 「053+054 푸시하고 배포 진행해줘」 → task-053 과 함께 push·배포. **배포 뒤 사용자 폰 확인이 닫는 조건**: 긴 한국어 뜻이 360/390/412 폭에서 줄바꿈되는지·`GOAL_REGION_MAX` 안에서 스크롤되는지·설정에서 「번역」을 켠 직후 방 안 목표 카드에 뜻이 바로 나오는지.

## 배포 (2026-10-11 18:02~18:0x, Leader)
- task-053 과 같은 push·릴리스 — **릴리스 `20261011-180237-3bca8188`**(`RELEASE_RESULT ok`·`migrated:false`·헬스 200·pm2 3개 online, 롤백 대상 `20261011-121420-0250368d`), 게이트·스모크 증빙은 [[task-053-improve-today-words-level-weight]] 「배포」 참고.
- 새 코드가 번들에 들어갔는지: 추가한 칩 줄의 클래스 문자열을 담은 정적 청크가 이전 릴리스 5개 → 새 릴리스 6개(+1). 화면 동작 자체는 이 환경에서 볼 수 없다(운영 역할극 방은 로그인 + 진행 중 방이 필요).
- **상태 `review` / `waiting: device_verify`** — 사용자 폰에서 역할극 방 목표 카드를 펼쳐 「번역」 표시를 켠 상태로 각 표현 칩 아래에 한국어 뜻이 나오는지, 꺼면 사라지는지, 긴 뜻이 줄바꿈되는지 확인하면 닫는다(IMP-0029 도 그때 done).
