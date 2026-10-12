---
task_id: task-065
title: "메뉴 문구 변경 — 하단 「오늘」→「공부」(그 메뉴를 가리키는 화면 문구 포함), 회화 홈 상단 「AI와 공부하기」→「자유로운 대화」 (IMP-0035·0036, light 트랙)"
status: review
waiting: deploy
base_ref: 2e02ed8
risk_level: "R0"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-046-improve-tab-loading-flicker, task-002-phase0-scaffolding]
imp: [IMP-0035, IMP-0036]
tags:
  - type/task
  - domain/improvement
  - domain/copy
aliases:
  - 메뉴 문구
  - task-065
created: 2026-10-12
updated: 2026-10-12
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

# task-065 — 메뉴 문구 변경 (IMP-0035·0036)

## 사용자 요청 (원문, 2026-10-12)
> '오늘'메뉴의 문구를 '공부'로 변경해줘. 그리고 '회화' 메뉴의 상단의 'AI와 공부하기' 문구는 '자유로운 대화'로 변경해줘

## 관련 과거 이력 요약 (Leader 큐레이션)
- 하단 탭 5개(회화·오늘·계획표·단어장·질문)는 `src/components/shell/TabBar.tsx` 상수(`label`)에 있다(라우트 `/study/today` 불변). 회화 홈 상단 제목은 `src/app/(app)/study/ai/(tab)/page.tsx:17` 와 로딩 자리표시 `src/components/chat/StudyAiSkeleton.tsx:43` 의 `AppBar title`. 하단 탭 라벨 「회화」는 그대로.
- 「오늘 탭」을 가리키는 화면 문구가 코드 곳곳에 있다(`VocabResult`·`VocabSessionScreen` 의 뒤로 버튼 「오늘로」, 「오늘 탭 ‘보관한 세트’에서 …」 안내 등) — 메뉴 이름만 바꾸면 「공부」 탭으로 가는 버튼이 「오늘로」라고 적히는 불일치가 생긴다.
- 승인된 교훈(`/이슈기록 관련`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `docs` · 복잡도 1 · R0 · developer=**sonnet** · **light 트랙**(Leader → Developer → Reviewer, 데모·QA 면제 — 사용자 결정 ADP-001 D-10) · demo=none(`DM-light-waive`). 입력·결과: 스크래치 `judge-065-intake*.json`.
- light 한계(초과 시 standard 승격): 파일 12개 초과 · 신규 화면 · 마이그레이션 · 네이티브 · 인증 — 해당 없음 예상(문구 상수·`AppBar title`·몇 개 안내 문구).

## 설계 (Leader — 문구만 바꾼다. 화면 구조·동작·라우트 불변)
1. **하단 탭 라벨**: `TabBar.tsx` 의 `label: '오늘'` → `'공부'`. 접근성 이름(`aria-label`)·`title` 등 라벨을 쓰는 곳이 있으면 같이.
2. **그 탭의 화면 제목**: `/study/today` 화면의 `AppBar title`(「오늘」로 쓰이고 있다면)·로딩 화면(`(tab)/loading.tsx`)·문서 `<title>`/metadata 에 「오늘」이 그 탭 이름으로 쓰이면 「공부」로. (task-046 규칙: 로딩 자리표시와 실제 화면의 제목은 같아야 한다.)
3. **회화 홈 제목**: `AppBar title="AI와 공부하기"` 두 곳(`(tab)/page.tsx`, `StudyAiSkeleton.tsx`) → `"자유로운 대화"`.
4. **그 메뉴를 가리키는 화면 문구**: 사용자에게 보이는 글 중 **오늘 탭/화면 자체를 가리키는 것**만 「공부」로 — 예: 뒤로 버튼 「오늘로」→「공부로」, 「오늘 탭 ‘보관한 세트’에서…」→「공부 탭 …」. **바꾸지 않는 것**: 기능 이름(「오늘의 단어」「오늘의 회화」「오늘의 평가」), 날짜 표현(「오늘 공부한 날」「오늘 끝낸 세트」「오늘 복습」 등), 코드 주석, 라우트·API·키·테스트 이름. 애매하면 바꾸지 말고 dev-record 에 후보로 적는다(Leader 가 판단).
5. 시험: 옛 문구를 단언하는 시험만 새 문구로 고친다(단언 약화 금지). 새 시험은 불필요하면 만들지 않되, 탭 라벨 5개가 `공부` 포함으로 정의된 단위 시험이 있으면 갱신.
6. 문서(`docs/screens.md`·로드맵 등)의 문구는 **Leader 가 쓴다** — developer 는 `src/**` 만.

## 완료 기준
1. 하단 탭에 「공부」가 보이고 「오늘」은 탭 이름으로 남지 않는다. 회화 홈 상단이 「자유로운 대화」. 로딩 자리표시와 실제 화면 제목이 같다.
2. 「오늘의 …」 기능 이름·날짜 표현은 그대로. 변경한 문구 목록과 바꾸지 않은 후보 목록을 dev-record 에 남긴다.
3. tsc 0 · eslint 오류 0 · `src/components` 전체 시험 통과 · `next build` 0(전용 미러). Reviewer 가 재실행.

## 구현·감사 결과 (2026-10-12, Leader)
- **구현**(developer sonnet): 소스 15 + 시험 2 = 17개 파일, 시험 1,292/1,292·tsc 0·eslint 오류 0·build 0(전용 미러). 기록 [[task-065-dev-record]]. **light 한계(12개 초과) 초과** — 전부 문구 치환이라 standard 승격(데모 추가)은 의미가 없다고 보고, Reviewer 전수 대조(비주석 「오늘」 385줄 전부 분류)로 대체한 것이 Leader 결정.
- **감사 REV-065-1 PASS_WITH_NOTES**(Critical 0·High 0·Medium 0·Low 2·정보 6, [[task-065-rev-record]]): 전수 대조 **누락 0·오변경 0**, 서버 메시지·프롬프트에 「오늘 탭」류 없음, 로딩 제목 짝 일치. **L-1** 수동 라이브 스크립트 3곳이 옛 문구 기대 → 새 문구로 수정, **L-2** 「공부」가 겹친 문장 2곳 → 「같은 주제면 공부 탭 어디서 해도 인정돼요」로 손봄(`challengeCopy.ts`·`challenge/logic.ts`). 정보 I-1(「오늘 탭|오늘 화면|오늘로」 잔존 0 가드 시험)은 선택 권고라 이번엔 미반영.
- **Leader 결정(애매 후보)**: `/study/today` 화면 제목 「오늘의 공부」 유지(기능 이름 구절·로딩과 일치) · `evalCopy` `START.sub '오늘'` 유지(AI 평가 부제의 날짜·기능 의미) · `Segmented ariaLabel="공부 방식"` 유지(designer 판단 후보) · 코드 주석의 옛 이름 유지.
- **스냅샷 게이트**(HEAD + src 변경): tsc 0·eslint 오류 0(경고 5 기존)·시험 3,368건 중 3,367 통과·실패 0·건너뜀 1·build 0.
- **문서**: `docs/screens.md` §2 머리에 이름 변경 안내, `CLAUDE.md`(프로젝트)·`.claude/agents/designer.md` 의 탭 목록 표기 「오늘」→「공부」. 나머지 docs 의 「오늘 탭」(약 50곳)·「오늘로」·「AI와 공부하기」는 안내 한 줄로 갈음(대량 치환 안 함).
- **배포 성격**: 웹 문구만(스키마·네이티브 변경 없음 — 앱 WebView 도 웹 배포 후 새 문구, versionCode·APK 불필요).

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-12 |

## 상태 로그
- 2026-10-12 사용자 요청 → IMP-0035·0036 등록(planned) → judge 접수(light·R0·sonnet) → 이 이력서 작성. 다음: developer(sonnet) → reviewer.
