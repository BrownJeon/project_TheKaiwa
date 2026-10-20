---
task_id: task-080
title: "task-080 developer 화면 갈래 기록 — 분절 [달력|성장]·/plan/growth·달력 일요일 시작"
status: doing
tags:
  - type/record
  - domain/plan
  - domain/ui
aliases:
  - dev-080-ui
created: 2026-10-20
updated: 2026-10-20
---

# task-080 화면 갈래 (developer `dev-080-ui`)

> 사양: `docs/screens.md` §36(36-17-1 Leader 결정 L1~L10 포함) · 승인 데모 `docs/demo/task-080-plan-growth-analysis-v4.html` · 이력서 [[task-080-plan-growth-analysis]]. 서버 갈래는 `dev-080-server`.
> 미러 `~/.node-local/thekaiwa-dev080u`(make-mirror.sh) · 스크래치 `scratchpad/dev-080-ui/` · 커밋·푸시·배포·DB 쓰기 없음.

## Developer 기록

- [착수] 데모 게이트 `approved` v4·`active: true` 확인(이력서 frontmatter). `src/modules/infra/dates.ts` 에 `WEEK_START_DOW`·`weekStartOf` 이미 있음(서버 갈래가 만듦, 93·96행). `src/types/plan.ts` 에 Growth 타입 없음 → 처음엔 화면 쪽 `growthTypes.ts` 를 만들었으나, Leader 알림(서버 갈래가 `types/plan.ts` 끝에 `GrowthWeeks`·`GROWTH_WEEKS`·`GrowthAxis`·`GROWTH_AXES`·`Growth*` 를 붙임)대로 **지우고 `@/types/plan` 을 import**(중복 정의 0). 참고: 서버 타입 `GrowthEvaluation.grade` 가 `string` 이라 화면은 `GRADE_LABEL[grade as EvalGrade] ?? ''` 로 방어.
- [항목 1 분절·라우트] `PlanSwitch.tsx`(DrawerSwitch 구조 복제, `mb-0`, `markPlanFocus`/`takePlanFocus` TTL 20초) · `app/(app)/plan/growth/{page,loading}.tsx`(`(tab)` 형제, auth→로그인 리다이렉트, metadata «성장 · 계획표») · `PlanScreen`/`PlanSkeleton` 맨 위 분절 + `GrowthSoonCard` 삭제(`parts.tsx` 는 `AnalysisSoonCard` 로 바꿈). tsc·eslint 0.
- [부품] `growthCopy.ts`(GROWTH 단일 출처 — L3 `countLine`·`needDays`·12주 둘째 줄 빼기, L4 «…계산해요» 두 곳) · `growthLogic.ts`(36-6 D·E 순수 계산, 차트 색 `GROWTH_TONE`) · `GrowthSummaryTiles`·`CheckHistoryStrip`(@container, 8주 라벨 `@min-[324px]`)·`WeeklyBars`(읽기 줄 `role=status` 한 요소 고정, `BarsSvg` 분리)·`ResultRows`·`EvalRadarSection`·`GrowthCharts`(`RadarChart`·`Sparkline`·`useMeasuredWidth`)·`GrowthSkeleton`(+`growthSkeletonSizes.ts` 시작값 — 실측 전)·`useGrowthData`(기간별 캐시·busy·retry 500ms 유예)·`GrowthScreen`(`GrowthBody`·`GrowthError` 분리 — 정적 렌더 시험용).
- [항목 2 달력] `WEEK_START_DOW` 존재 확인(서버 갈래) → `logic.ts` `WEEK_HEADERS` 일~토(상수 회전)·`monthGrid` 앞 빈칸 `(wd − WEEK_START_DOW + 7) % 7`·주석, `CalendarSection.tsx` 주석, `planLogic.test.ts`(2026-09=2·02=0·2024-02=4·06=1·10=4, 시간대 2, 줄 수 18개 달 새 시험)·`planSkeleton.test.ts`(순서 `<PlanSwitch`→…, 곧 열려요 없음, 자리표시 분절 inert, 요일 머리 일~토) → 28/28 통과.
- [시험] 새 `__tests__/growthFixtures.ts`(데모 ①②③ + 완전 처음, 응답 모양) · `growthLogic.test.ts` 17 · `growthCopy.test.ts` 5(글자·L3·L4·옛 이름·엔진명·급수) · `planSwitch.test.ts` 4 · `growthRoute.test.ts` 2 · `growthScreen.test.ts` 14(정적 렌더 — 섹션 순서·aria-labelledby·role=status 1·aria-busy·축 3상태·링크 2·SVG aria-hidden·자리표시·오류) + `copyNoSeyo.test.ts` 대상에 `plan/growthCopy.ts` 추가 → plan 시험 + copyNoSeyo 72/72, tsc 0·eslint 0. 다음: 변이 시험 → next build·헤드리스 시각 검증(3021) → 자리표시 상수 실측.
