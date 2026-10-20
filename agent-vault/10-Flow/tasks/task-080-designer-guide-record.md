---
task_id: task-080
title: "task-080 designer 기록 — 구현 가이드(screens.md §36, 승인 데모 v4)"
role: designer
created: 2026-10-20
tags:
  - type/record
  - domain/ui
  - domain/plan
aliases:
  - task-080 designer guide
---

# task-080 designer 기록 — 구현 가이드

관련: [[task-080-plan-growth-analysis]] · 데모 기록 [[task-080-designer-record]] · [[task-080-designer-v2-record]] · [[task-080-designer-v3-record]] · [[task-080-designer-v4-record]]
승인 데모: `docs/demo/task-080-plan-growth-analysis-v4.html` (v4, 2026-10-20 23:19 «v4 승인, Q9는 A로 해줘»)

## Designer 기록

- [23:35] 읽음: 승인 데모 v4 전체(개발 메모 0~7절·상태표·낭독 순서·한계), v1~v4 기록, 이력서(Leader 기본 결정 13건·Q1~Q9·v1~v4 응답), `components/plan/*`·`drawer/DrawerSwitch`·`(tab)` 라우트·§17·§1, 정본 #70·#78·§2-18-A, `learning/snapshots`·`observations`(+corrections)·`attendance`·`repetition/review isStudyDay`·`scenarios/end`·`lessons/observations`·`vocab/sessions` 관측, `recordRetrieval/range`·`orchestrator/ask`·`prompts/ask`, `infra/dates`·`infra/tx`, prisma 스키마(관측·스냅샷·출석), 시험(`planLogic`·`planSkeleton`·ASK 범위 시험 3개).
- [23:58] `docs/screens.md` **§36** 추가(412줄, 약 68KB) + §2 표 계획표 행 갱신·`/plan/growth` 행 추가(«구현 전» 표기). `src/**`·데모 파일·정본(`docs/design/*`) 수정 0. 커밋·푸시·배포 없음. 20-Log 는 Leader 가 적는 이 task 관례에 따라 쓰지 않음.
- [23:58] 디자인 스킬: layout(36-0)·component(36-3 부품 표)·a11y 점검 항목(36-12) — 가이드 단계라 데모 자체 점검(v1~v4: P0·P1·Critical·Major 0)을 인용, 새 점검 실행 없음. `project-ui-system` 미적용(학습 앱 화면).

## 1. §36 요약 (절 구성)

36-0 레이아웃 설계 · 36-1 확정 결정 · 36-2 주소·라우트·분절(`plan/growth/{page,loading}` 은 `(tab)` 형제 — 달력 자리표시 누수 방지, `PlanSwitch` = DrawerSwitch 구조 복제·`mb-0`) · 36-3 UI 의사코드·부품 표 · 36-4 상태 표(9개) · 36-5 문구 표(`growthCopy.ts`) · 36-6 계산 규칙(서버/화면 구분, 정수 비교 경계) · 36-7 #78 응답 초안 · 36-8 DAILY `skills` 칸·쓰기 경로 2곳·백필(dry-run·top-up·잠금 순서·백업) · 36-9 달력 일요일 시작(시험 기대값·줄 수 바뀌는 달) · 36-10 질문 탭 «이번 주»(Q9 A, 정본 상수 `infra/dates WEEK_START_DOW`) · 36-11 시각 값 · 36-12 접근성 · 36-13 반응형·자리표시 · 36-14 파일 · 36-15 순서 · 36-16 QA·실기기 · 36-17 정정·Leader 확인 · 36-18 후속·문서 갱신 항목.

## 2. 정본·데모와 어긋난 곳 (코드로 확인)

1. **DAILY `attended` 는 늘 false** [확실 — `bumpDailySnapshot` 호출 8곳 전수, 체크인 #25 는 `Attendance` 만 씀] → 데모 근거표 «연속 출석 = DAILY attended» 정정, 출석 원천 = `Attendance`(#70 과 같음). 정본 #78 «StatsSnapshot 만»에 예외 문구 필요.
2. **SELF_CORRECTION 생산 코드 있음**(`chats/[id]/turns/route.ts` 코치 훅, 운영 0행) — 데모 «없음» 정정, 승인 «대화 유지 = 역할극 완료만»으로 제외.
3. 발음 교정 → `LISTEN_RESPOND` 축 매핑(`correctionSkill`) → 성장 집계에서 제외.
4. 데모 숫자 줄에 PARTIAL(일부) 없음 → «일부» 조각·«넘김» 괄호 밖(초안).
5. Q3 A «3일» 조건 문구 없음 → `needDays` 한 줄(초안).
6. 12주에서 «기간을 늘리면…» 거짓 → 뺌.
7. 셈 뜻 «세요» 2곳(데모 487·730행) — 2026-10-07 사용자 규칙(`copyNoSeyo.test.ts`)과 충돌 → 승인 글 유지 + 대안 제시.
8. 라디오 화살표 키·레이더 여백·분절 아래 간격·2027년 줄 수 바뀌는 달 2개 — 36-17 ⑧~⑪.
9. 설계서 §2-3 `LearnerSkillState`(EMA·0~100) 대신 Q4 B DAILY 칸 + 단계 4칸 — 정본 갱신 필요.

## 3. Leader 확인 필요 (§36-17 L1~L10 요약)

L1 출석 원천(`Attendance` 포함 vs 체크인이 DAILY 도 쓰게) · **L2 한쪽 증거 편향**(교정 제안은 틀림·일부만 남기고 대화의 맞는 문장은 관측이 없어 문형·조사·문장 산출이 낮게 보일 가능성 — 백필 dry-run 단계 분포로 판단) · L3 화면 글 정정 3건(재승인 필요 여부) · L4 «세요» 2곳 · L5 `--protein` 차트 사용·혼합 색 토큰화 · L6 자기수정 제외 · L7 #78 초안 정본 반영 · L8 PE 프롬프트 문구·버전, 정본 §2-18-A · L9 domain-model §9-3·learning-personalization §2-3·schema 주석·주 시작 결정 기록 · L10 백필 `--apply` 사용자 승인.

## 4. 한계

- 가이드 수치(자리표시 높이·첫 화면 위치)는 데모 측정값을 옮긴 것 — 실제 앱 실측은 developer/QA(36-13·36-16).
- 실데이터로 축 단계를 계산해 보지 않았다(읽기 전용 DB 조회도 안 함) — L2 판단은 백필 dry-run 보고에 맡겼다.
- 막대 그림 너비 측정(`useMeasuredWidth`)·8주 띠 라벨 컨테이너 기준(324px)은 데모 규칙을 옮긴 설계값이라 실기기 확인 필요.
