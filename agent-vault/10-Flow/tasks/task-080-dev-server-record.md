---
task: task-080
role: developer
name: dev-080-server
tags:
  - type/task-record
  - domain/plan
  - domain/learning
---
# task-080 서버 갈래 developer 기록 — [[task-080-plan-growth-analysis]]

사양: `docs/screens.md` §36(특히 36-6~36-10·36-17-1). 미러 `~/.node-local/thekaiwa-dev080s`(make-mirror.sh 로 새로 만듦). 커밋·배포·DB 쓰기·백필 `--apply` 없음.

## Developer 기록

- [23:40] 체크포인트 1(주 시작 상수) 완료 — `src/modules/infra/dates.ts` 에 `WEEK_START_DOW = 0`·`weekStartOf(date)` 추가, 시험 `src/modules/infra/__tests__/weekStart.test.ts` 5개 통과(미러). 화면 갈래는 `@/modules/infra/dates` 또는 `dates.weekStartOf`(infra index 의 `dates` 네임스페이스) 로 쓸 수 있다.
- [23:55] 체크포인트 2(질문 탭 «이번 주» 일요일 시작, Q9 A) 완료 — `recordRetrieval/range.ts`(`mondayOf` 삭제 → `dates.weekStartOf`, 주석 일~토·그 주 토요일), `orchestrator/ask.ts askScopeDates`(중복 계산 → `dates.weekStartOf`), `prompts/ask.ts`(`SCOPE_KO.THIS_WEEK='이번 주(일~토)'`, `ASK_PROMPT_VERSION` `ask@v2`→`ask@v3` + 머리 주석 v3·롤백 방법), `prompts/askResponse.ts` 머리 주석 버전, `types/ask.ts` 주석. 시험: `recordRetrieval.test.ts`(⑤ resolveRange 10-08 → 10-04~10-10, 토 23:59 같은 주·일 00:00 새 주, 연 경계 12-27~2027-01-02, `weekStartOf` 4개 / ⑤ 주 경계 시험을 토/일 경계로 다시 씀) · `askTurn.test.ts`(10-15 → 10-11~10-17 + 일·토·월 3줄 추가, ④-b 오늘 10-12(월) 범위 10-11~10-17) · `ask.test.ts`(«이번 주(일~토) 2026-10-11~2026-10-17» + 옛 이름 0, 버전 v3, 체크섬 pin `98a645fa…`(버전 문자열만 바뀜, v2 pin 은 주석에 보존)). 실행: 4파일 111/111, ask 관련 7파일 183/183 통과. Prompt Registry: `prompts:sync` 미구현(task-066 PE 기록과 같음) — 상수·체크섬·pin 이 정본이라 DB 동기화 없음. 남김: `tests/prompts/fixtures/ask.json`·`tests/live/ask-measure.ts` 주석(월~일)은 qa/PE 영역이라 안 고침(픽스처는 범위 날짜를 명시적으로 넣어 동작 영향 없음).
- [00:20] 체크포인트 3(DAILY `skills` 칸, 36-8) 완료 — `snapshots/index.ts`: `GrowthSkillCounts`·`DailySkillsDelta`·`DailyDelta.skills?`·`mergeSkills`(증가만·모르는 축/칸 보존), `mergeDaily` 는 기존 칸이 있거나 증가분에 축이 1개 이상일 때만 `skills` 를 만든다(교정 채택만 한 날 = 칸 없음). `observations/index.ts`: `GROWTH_SKILL_OF_KIND`(표 그대로 — 채택·무시·자기수정·CONVERSATION_MAINTAIN 은 키 없음 = 세지 않음, 교정 제안·재사용은 행 `skill`) + `growthSkillDelta(rows)`(발음 교정 축 LISTEN_RESPOND 제외, 신뢰도 < 0.6 → `uncertain` 만, 칸 없으면 1) + `recordObservations` 가 같은 `bumpDailySnapshot` 호출에 `skills` 를 함께 넘김. `scenarios/end.ts`: 끝냄 관측의 같은 호출에 `skills: growthSkillDelta([endObservation])`. `observations.bySkill` 은 그대로(안 씀). 시험: 새 `learning/__tests__/task080SkillsDelta.test.ts` 7개 + 기존 `task010b.test.ts`(채택 = skills 칸 없음·제안 MAJOR/MINOR·거절 제외·단어 세트 날짜)·`task010d.test.ts`(역할극 달성 = CM success 1·판정 없음 = uncertain 1)에 단언 추가 — 64/64.
- [00:35] 체크포인트 4(#78 성장 API) 완료 — 새 `src/modules/learning/snapshots/growth.ts`: 순수 `parseGrowthWeeks`·`growthRange`·`dailyKinds`·`longestRunOfDates`·`dailySkillCounts`·`skillStage`(정수 비교)·`skillTrend`(Δ 정수식)·`skillSpark`·`evaluationFromSnapshot`·`buildGrowth` + DB `getGrowth(userId, weeks, now, db)`(Attendance 전체 날짜 · 기간 안 DAILY · 가장 이른 DAILY periodKey · EVALUATION 전부 — 읽기 4개, 쓰기 0). `GROWTH_AXIS_RECORDED.LISTEN_RESPOND=false`. 응답 타입은 `src/types/plan.ts` 끝에 `Growth*` 로 추가(36-7 모양, 화면 공용 — Leader 에게 SendMessage 로 알림). 라우트 `src/app/api/v1/plan/growth/route.ts`(requireSession → parseGrowthWeeks → getGrowth, DB 직접 접근 없음). `learning/index.ts` 에 `getGrowth`·`parseGrowthWeeks`·`growthSkillDelta`·`mergeSkills` 등 내보냄. 시험: `learning/__tests__/task080Growth.test.ts` 17개 · `app/api/v1/__tests__/task080GrowthRoute.test.ts` 3개 통과. tsc: 내 파일 오류 0(남은 2건은 화면 갈래 진행 중 `components/plan/PlanScreen.tsx`·`PlanSkeleton.tsx` 의 `GrowthSoonCard` — 내 범위 밖).
