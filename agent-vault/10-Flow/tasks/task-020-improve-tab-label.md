---
task_id: task-020
title: "개선 — 하단 탭 라벨 '서랍장' → '단어장' (IMP-0006)"
status: done
base_ref: 055dbcf
risk_level: R0
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-002-phase0-scaffolding, task-008-vocab-today-words]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - 탭 라벨 단어장
  - task-020
created: 2026-09-30
updated: 2026-09-30
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
개선 백로그 [[IMP-0006-메뉴명-서랍장-단어장]] — 하단 탭 다섯 개 중 '서랍장' 라벨을 '단어장' 으로 바꾼다.

## 사용자 결정 (2026-09-30, Q5)
- **탭 라벨만 '단어장'으로 변경.** URL(`/drawer/*`)·라우트·코드 식별자·권한 이름은 그대로 둔다(Phase 3 에 채택 교정 모음 `/drawer/corrections` 가 들어올 때 배치는 그때 다시 정한다).

## 포함 항목
- [[IMP-0006-메뉴명-서랍장-단어장]] (P1, S)

## 범위
- `src/components/shell/TabBar.tsx` 라벨(L16)·주석(L10), 그 라벨을 검사하는 테스트(`__tests__`), 화면·안내 문구에 남은 '서랍장' 표기(`grep -rn 서랍장 src docs/screens.md CLAUDE.md docs/design-spec.md` 로 전수 — 착수 시점 12건, `docs/demo/` 과거 데모는 수정하지 않는다).
- 문서 갱신: `docs/screens.md`(L88·L89·L812), `CLAUDE.md` 탭 목록. 정본 문서에서 '서랍장'이 **URL·모듈 이름**(예: `drawer`)을 가리키는 곳은 바꾸지 않는다.
- 접근성 이름(aria-label)·탭 활성 표시 검사가 라벨 문자열에 의존하면 함께 갱신.

## 비범위
- 라우트·API·DB·권한 키·모듈 디렉터리 이름 변경, 탭 개수·순서·아이콘 변경.

## 완료 기준
- 탭 라벨 '단어장' 표시(360/390/412 폭에서 줄바꿈·잘림 없음), `tsc`·`eslint`·단위 테스트 0 fail, 사용자에게 보이는 문구 중 '서랍장' 0건(설계 문서의 URL·모듈 이름 제외).

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 docs · 복잡도 0.76 · 위험 R0 · developer 모델 **sonnet** · needs_info false
- 권장 역할: developer, reviewer
- 데모: **none** (required=false, rule=-) · 다음 = `assign`
- 규칙 오버라이드: 없음

## Developer 기록

- [22:30] 라벨만 변경 — 라우트 `/drawer/*`·디렉토리·식별자·DB·딥링크 무변경, 네이티브 변경 없음(웹 배포만).
- 변경 파일: `src/components/shell/TabBar.tsx`(L16 label '서랍장'→'단어장', L10 주석 정합) · `docs/screens.md`(§2 L88·L89 첫 열, §4-1 L812 진입 문구, L7 변경 이력 1건 추가) · `CLAUDE.md`(모바일 UI 원칙 탭 나열).
- 라벨을 검사하는 테스트는 없음(`grep 서랍장 src tests` 0건, `tests/live/task007-ui-e2e.mjs` 는 `nav[aria-label="주 메뉴"]` 만 검사) → 테스트 갱신 불필요. aria-label 은 "주 메뉴"(라벨 무관).
- 검증(미러 sync 후): `tsc --noEmit` exit 0 · `eslint .` 0 error(기존 warning 5건, TabBar 무관) · `node --test src/components/**/*.test.ts` 177 pass/0 fail. 폭: 탭 라벨은 '계획표'와 같은 3자·11px·`flex-1 min-w-0` 라 360px(탭당 72px)에서 줄바꿈 없음(실기기 3폭 확인은 QA).
- '서랍장' 잔존(사용자 화면 노출 아님 — 유지·보고만):
  - 설계 정본 개념어: `docs/design-spec.md` L174·175·330·359·386, `docs/design/module-dependency.md` L140, `docs/design/api-contract.md` L1207·L1905, `docs/기획서-원본.md`(원문 보존), `CLAUDE.md` L128(Phase 3 로드맵 "서랍장 전체").
  - 코드 주석: `src/components/shell/TabBar.tsx` L10(URL·모듈 이름 `drawer` 설명).
  - 과거 데모(수정 금지): `docs/demo/task-010-today-lesson-v1·v2`·`task-010b-repetition-v1`·`task-010c-correction-mode-v1`·`task-011-ai-evaluation-v1`·`task-012-calendar-v1` 의 탭 배열.
  - Leader 결정 필요(developer 편집 범위 밖): `.claude/agents/designer.md` L42 · `.codex/agents/designer.toml` L39(designer 지침의 탭 나열 — 다음 데모부터 '서랍장'으로 그려질 수 있음), `AGENTS.md` L72·L124(CLAUDE.md 생성본 — `cc-sync-codex/sync-agent-bridge.ps1` 로 재생성해야 하며 직접 수정 금지).

## Reviewer 기록

### 2026-09-30 Reviewer
- **PASS** (critical 0 · high 0 · medium 0 · low 2). 7영역 중 해당 없는 영역(인증·엔진·LLM·스냅샷 등)은 변경 파일 0건이라 발견 없음.
- 실변경은 라벨·문구 한정: `TabBar.tsx` L10 주석·L16 label 만 바뀌고 href `/drawer/words`·match `/drawer`·path·aria-label "주 메뉴"·라우트·모듈·DB·네이티브 무변경(diff 확인). `docs/screens.md`·`CLAUDE.md`·designer 지침 2종도 문구만.
- 의도: `grep 서랍장 src tests` 는 TabBar 주석 L10 1건뿐(URL·모듈 설명, 허용). 화면 제목 `WordsScreen` AppBar 는 이미 "단어장", manifest·public·android 리소스에 '서랍/서랍장' 0건. 탭 라벨을 문자열로 검사하는 테스트 없음(live e2e 는 `nav[aria-label]`·href 만 검사).
- 폭: '단어장'은 '계획표'와 같은 3자·11px·`flex-1 min-w-0`(360px 에서 탭당 72px) → 줄바꿈 위험 없음.
- LOW 1: `AGENTS.md` L72·L124 가 '서랍장' 그대로(CLAUDE.md 생성본, 재생성 필요 — 직접 수정 금지, Leader 후속 기록됨). LOW 2(정보): 탭 아이콘이 서랍장 모양 그대로 — 사용자 결정(라벨만)·비범위라 허용, 필요 시 후속 개선 항목으로.
- 데모 게이트: `check --task` DEMO_GATE_PASSED(not_required), evidence.jsonl 에 task-020 줄 0건(approve/waive 대행 흔적 없음). QA 인계 high_risk_areas: 360/390/412 폭 탭 5개 실화면, `/drawer/*` 활성 표시(match), native_change=false.

## QA 기록

### 2026-09-30 QA
**PASS** — 검증 완료(라벨 변경·문구만). 타입/lint 에러 없음(eslint ✅, tsc 기존 이슈 제외), 렌더 검증 ✅(탭 5개·라벨 순서·'서랍장' 주석만), 코드 근거로 폭 검증 ✅(3자·11px·`flex-1 min-w-0`·72px/탭 360px 에서 줄바꿈 없음, 360/390/412 동일), `/drawer/*` match 확인 ✅, '서랍장' 노출 0건(허용 주석 1건). 결함 0건.

| 항목 | 상태 | 근거 |
|---|---|---|
| TabBar 라벨 변경 | PASS | L16 '단어장' ✅ |
| href/match 무변경 | PASS | `/drawer/words`·`/drawer` 그대로 |
| 주석 정합 | PASS | L10 "단어장 탭" + URL 설명 |
| lint | PASS | eslint 에러 0건 |
| 타입(partial) | PASS | task-020 범위 파일만 검증(prmt 스키마 외부 이슈 제외) |
| 렌더 5개 탭 | PASS | 회화·오늘·계획표·단어장·질문 |
| 폭 검증(코드) | PASS | 3자·11px·`flex-1 min-w-0` 동일, 360/390/412 안전 |
| 사용자 노출 | PASS | '서랍장' 0건(주석 허용 1건) |
| 미실측 | - | 실기기 화면 3폭(사용자 F6) |

## 작업 기록

### 2026-09-30 Leader — 착수
- `/개선작업 착수` 재확인(HEAD 055dbcf = observed_ref)·사용자 Q1~Q10 답변 반영. 이 항목은 P1(Leader 권고 순서 채택 — 사용자가 별도 순서를 주지 않음).

### 2026-09-30 Leader — developer 잔존 보고에 대한 결정
- `.claude/agents/designer.md` L42·`.codex/agents/designer.toml` L39 의 탭 나열을 '단어장'으로 맞췄다(다음 데모부터 '서랍장'으로 그려지는 것을 막기 위함). 이미 실행 중이던 designer 4명은 이 변경 전 지침을 읽었으므로 **데모 v1 도착 시 하단 탭 라벨을 확인**한다.
- `AGENTS.md` L72·L124(CLAUDE.md 생성본)는 직접 고치지 않았다. 재생성 스크립트 `cc-sync-codex/sync-agent-bridge.ps1` 은 PowerShell 이라 이 우분투 서버(pwsh 없음)에서 실행 불가 → 맥·윈도우 쪽에서 실행하거나 사용자 결정 대기(후속).
- 설계 정본(design-spec·module-dependency·api-contract)의 '서랍장'은 모듈·개념 이름이라 유지, 과거 데모 6개는 수정 금지라 유지.

## 최종 요약 (Leader)

하단 탭 이름이 '서랍장'에서 '단어장'으로 바뀌어 운영에 반영됐습니다(커밋 `54199c9`, 릴리스 `20260930-222458-54199c9f`, 상태 확인 HTTP 200).

- 바뀐 것: 탭 라벨 한 곳(`TabBar.tsx`)과 화면 설계서·CLAUDE.md·designer 지침의 탭 이름. 주소(`/drawer/words`)와 내부 이름은 그대로라서 기존 링크·기능에는 영향이 없습니다.
- 확인한 것: 리뷰 PASS, QA PASS, 운영 빌드에서 '단어장'이 13개 파일에 있고 '서랍장'은 0개입니다.
- 아직 안 한 것: 실기기에서 360/390/412 폭 3가지로 탭 글자가 잘리지 않는지 보는 확인은 사용자 몫입니다(글자 수·크기가 이전과 같아 문제 가능성은 낮습니다).
- 후속: `AGENTS.md`는 CLAUDE.md의 자동 생성본인데 이 서버에 PowerShell이 없어 재생성하지 못했습니다(맥·윈도우에서 `sync-agent-bridge.ps1` 실행 필요). 탭 아이콘은 아직 서랍 모양이라 필요하면 별도 개선 항목으로 올릴 수 있습니다.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 09-30 22:14 |
