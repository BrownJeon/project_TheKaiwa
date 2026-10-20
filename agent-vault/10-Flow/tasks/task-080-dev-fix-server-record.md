---
task: task-080
role: developer
name: dev-080-fix-server
tags:
  - type/task-record
  - domain/plan
  - domain/learning
---
# task-080 서버 수정 라운드 developer 기록 — [[task-080-plan-growth-analysis]]

앞선 기록: [[task-080-dev-server-record]] · [[task-080-dev-server2-record]] · 감사 [[task-080-reviewer-server-record]](REV-080-S). 사양 `docs/screens.md` §36-17-2(L11 C 규칙)·§36-6 B·§36-8. 미러 `~/.node-local/thekaiwa-dev080s`(재사용). 커밋·배포·DB 쓰기·`--apply` 없음.

## Developer 기록

- [07:29] `src/types/plan.ts` `GrowthSkill.oneSided: boolean` 추가(화면 갈래가 이어서 씀). 주석: C 규칙 · stage null ⇔ !enough 또는 oneSided.
- [07:33 체크포인트 1 — C 규칙 구현(시험 전)] 완료: `snapshots/index.ts`(`GrowthSkillCounts.fromCorrection`·`SKILL_COUNT_KEYS` 에 추가 → `mergeSkills` 가 증가만·모르는 키 보존으로 병합) · `observations/index.ts`(`GROWTH_FROM_CORRECTION_KINDS`={PROPOSED,REUSED}, `growthSkillDelta` 가 판정된 것만 `fromCorrection`+1, 불확실은 `continue`) · `snapshots/growth.ts`(`dailyFromCorrection`·`isOneSided(n,c)= n≥1 && 10c≥9n`, `buildGrowth` 가 기간 합으로 `oneSided`, 참이면 stage/trend null·spark [], recorded=false → false) · `backfillSkills.ts`(`TopUpResult.fromCorrectionAdded`·`topUpChanges` — `added` 는 관측 수라 `fromCorrection` 을 넣지 않고 따로 셈, 옛 행에 fromCorrection 만 모자란 경우도 갱신 대상 · `AxisWindowStat.oneSided` · 분포 칸 `oneSided`(enough 인데 숨김) · 보고서 `fromCorr=`·`oneSided(hidden)`·`(of which fromCorrection: N)`) · `scripts/backfill-growth-skills.ts`(머리 주석 운영 `--backup-dir` 안내 · `PROD_BACKUP_DIR`·`backupDirHint` dry-run 마지막 줄) · `.gitignore` `backups/`(check-ignore rc=0).
  - 결정 근거: `fromCorrection` 을 `SKILL_COUNT_KEYS` 에 넣어 병합·top-up·합계가 한 목록을 따르게 함. 응답 `skills[]` 에는 싣지 않음(계약은 `oneSided` 만) — `SkillCounts`(응답 펼침용)와 분리.
  - 다음 첫 행동: 미러 sync → 기존 task080 시험 실행(깨지는 deepEqual 갱신) → 새 시험.
- [07:36 체크포인트 2 — 시험] `task080SkillsDelta`·`task080Growth`·`task080Backfill` 갱신·추가 → 미러 **44/44 통과**. 새 시험: fromCorrection 셈(REUSED·PROPOSED 판정분만, 불확실·넘김·수업 문법 제외) · `mergeSkills` fromCorrection 증가만(덮어쓰기 아님·옛 칸 0 시작·실시간 경로 두 번) · `buildGrowth` C 규칙(정확히 90% 3일 합 — 날마다는 95·81.8·88.9% → 참, stage/trend/spark 숨김·enough 그대로 / 87.5% 단계·UP·spark / 899‰ 거짓·900‰ 참 / n=0·기록 전·옛 행 거짓 / 표본 부족이어도 판정) · topUp fromCorrection(옛 행은 fromCorrection 만, `added` 에 안 넣음, 멱등, R<C 어긋남) · axisWindowStat·분포 `oneSided` · apply 옛 행 fromCorrection 만 채움·보고서 줄·두 번째 실행 쓰기 0 · L-2 제목 정정 · L-4 `['10-01','10-02','10-02','10-03']`→3 · 스크립트 `backupDirHint`·`PROD_BACKUP_DIR`.
  - 주의: 가짜 DB `users` 에 `extra.obs` 사용자를 넣어야 apply 의 `lockUserRow` 가 통과한다(안 넣으면 조용히 건너뜀).
  - 다음 첫 행동: tsc·eslint → 변이 시험 5건 이상.
- [07:39 체크포인트 3 — 변이 시험 12건(미러 파일만 임시 파일+`os.replace`, 끝마다 NFS 본으로 되돌려 `filecmp` 일치)] **12/12 잡힘**: M1 `10c ≥ 9n`→`>`(3 실패) · M2 REUSED 를 교정 유래에서 빼기(4) · M3 `mergeSkills` fromCorrection 덮어쓰기(1) · M4 top-up 에서 fromCorrection 빼기(2) · M5 `longestRunOfDates` 중복 가드 삭제(1, L-4 보강 확인) · M6 `n ≥ 1` 가드 삭제(2) · M7 불확실도 교정 유래로 셈(1) · M8 oneSided 여도 spark(3) · M9 oneSided 여도 trend(1) · M10 넘김도 교정 유래(1) · M11 `added` 에 fromCorrection 섞기(1) · M12 분포 `oneSided` 칸 없애기(2). 스크립트 스크래치 `dev-080-fix-server/mut.py`. NFS↔미러 9파일 `cmp` 동일, `.muttmp` 잔여 0.
  - tsc(미러 전체): 오류 1건 — `src/components/plan/__tests__/growthFixtures.ts(76,3)` `oneSided: boolean | undefined` → 화면 갈래 파일(내 소유 아님, 화면 갈래가 `oneSided` 를 이어서 쓰는 중으로 보임 [가능성 높음]). 서버 파일 오류 0. eslint(변경 서버 파일·시험·스크립트·`learning/snapshots` 전체) 종료 0.
  - 다음 첫 행동: 서버 시험 전체 → dry-run 재실행(쿼리 로그로 SELECT 만 확인).
- [07:44 체크포인트 4 — Leader 정의 수정 반영: `oneSided = recorded && enough && 10·fromCorrection ≥ 9·n`(`n ≥ 1` 버림)] `growth.ts isOneSided(enough, n, c)` · `buildGrowth` 가 enough 를 넘김 · `axisWindowStat` 도 같은 함수(enough 먼저 계산) · `types/plan.ts` 주석 «recorded=false 또는 !enough 면 늘 false» · 보고서 머리 «oneSided = enough and …». 시험 경계 교체: 19건 3일 교정 100% → false·stage null / 20건 2일 교정 100% → false·stage null / 같은 20건 3일 → true / 정확히 90%·89.9%(899‰)·900‰ / 기록 전 축은 표본이 차도 false(백필 쪽 3일 30건) / 분포 short 우선.
  - 변이 15건 다시 실행 → **15/15 잡힘**(앞 12건 + M6 `enough &&` 빼기 3 실패 · M6b axisWindowStat 에 enough 대신 true 1 · M6c buildGrowth 에 enough 대신 n>0 1 · M6d axisWindowStat recorded 조건 빼기 1). 모두 `filecmp` 원복 확인.
- [07:44 실행 증빙] 서버 시험 전체(미러, `node --import tsx --test --test-concurrency=1`, `src/modules/{learning,infra,conversation}`·`src/app/api`·`src/types` 146파일): **tests 2164 · pass 2162 · fail 0 · skipped 2**(처음 실행 때 `task010b`·`task010d` 기존 시험 4개가 skills deepEqual 에 `fromCorrection` 이 없어 실패 → 기대값에 칸 추가로 해결, 그중 `recordCorrectionsProposed` 실경로가 fromCorrection 1 을 쓰는 것을 확인). task080 3파일 44/44. `tsc --noEmit` 미러 전체: **오류 1 — 화면 갈래 파일 `src/components/plan/__tests__/growthFixtures.ts:76`(`oneSided: boolean|undefined`)**, 서버 파일 0. eslint(변경 서버 파일·시험 6개·스크립트) 종료 0. 엔진명 grep 0. NFS↔미러 `cmp` 동일(.gitignore 는 미러 동기화 대상 아님).
- [07:44 dry-run 재실행(읽기 전용)] `node --import tsx scripts/backfill-growth-skills.ts`(인자 없음) 종료 0 · 쿼리 로그 확인 실행 **SQL = SELECT 21, 쓰기 0** · 출력 userId·이메일 0건. 숫자(2026-10-21 KST): users 6 · 관측 626 · 대상 기존 행 14 · 건너뜀(행 없음) 5행/235 · 더할 관측 391(그중 fromCorrection 147: 문형·조사 114 · 문장 31 · 어휘 2 · 대화 유지 0) · 어긋남 0 · applied 0.
  - **C 규칙 뒤 4주 분포(계정 수)**: 어휘 stage1=1 stage2=1 short=2 none=2 · 문형·조사 **oneSided=1** short=1 none=4(stage 0 이던 #1 이 oneSided 로 바뀜) · 문장 stage1=1 short=1 none=4 · 대화 유지 short=1 none=5 · 듣고 응답 unrecorded=6.
  - 계정별 4주: #1 어휘 n=46 72% 2단계(교정 0) · #1 문형·조사 n=119 교정 113(95%) → oneSided(숨김) · #1 문장 n=43 교정 31(72%) → 1단계 그대로 · #2 어휘 n=27 63% 1단계(교정 1) · #2 문형·조사 n=8 short · #2 문장 n=6 short · #3 어휘 n=1 short · 대화 유지 n=1 short · #5 어휘 n=6 short.
  - 마지막 줄에 백업 폴더 안내(운영 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups`). `--apply`·커밋·배포·DB 쓰기 없음.
- 미커밋 파일(이번 라운드): `src/types/plan.ts`(Growth 구역 oneSided) · `src/modules/learning/snapshots/{index,growth,backfillSkills}.ts` · `src/modules/learning/observations/index.ts` · `scripts/backfill-growth-skills.ts` · `.gitignore` · 시험 `src/modules/learning/__tests__/{task080Backfill,task080Growth,task080SkillsDelta,task010b,task010d}.test.ts` · 이 기록. 스크래치 `dev-080-fix-server/`(mut.py·verify.mts·dryrun.txt·alltests.log — 일회용).
- 남은 일: 없음(서버 갈래). 화면 갈래 tsc 1건은 그쪽 몫.
