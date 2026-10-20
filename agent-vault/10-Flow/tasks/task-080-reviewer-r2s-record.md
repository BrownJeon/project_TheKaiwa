---
task: task-080
role: reviewer
name: rev-080-r2s
tags:
  - type/task-record
  - domain/plan
  - domain/learning
---
# task-080 수정 라운드 서버 분 좁은 재감사 — REV-080-R2S

상위: [[task-080-plan-growth-analysis]] · 앞선 [[task-080-reviewer-server-record]] · [[task-080-reviewer-r2-record]] · 개발자 [[task-080-dev-fix-server-record]]. 미러 `~/.node-local/thekaiwa-rev080r2`(mirror-audit --check 종료 0, 공유 0). 소스 수정·커밋·`--apply` 없음.

## Reviewer 기록 (REV-080-R2S)

- [체크포인트 0] 기록 파일 생성, 미러 sync. 앞선 R2 가 이미 통과시킨 서버 C 규칙 대입은 건너뜀.
- [체크포인트 1 — 위험 영역 1·2 코드 읽기 완료] `backfillSkills.ts` 전체·`scripts/backfill-growth-skills.ts` 전체·`snapshots/index.ts`·`observations/index.ts`·`scenarios/end.ts`·`types/plan.ts`·`.gitignore` diff 읽음. top-up 이 `SKILL_COUNT_KEYS`(fromCorrection 포함)로 칸마다 `max(0,R−C)`, `fromCorrectionAdded` 를 `added` 와 따로 셈(`topUpChanges`=둘 중 하나), 행 없는 날은 `planUserBackfill` 에서 `continue`(만들지 않음, `skipped` 는 `t.added>0` 일 때만), 쓰기 경로는 `opts.apply && targetRows>0` 뒤에서만 `deps.backup`→`deps.transaction`, 잠금 순서 `lockUserRow`→재읽기·재계획→DAILY `FOR UPDATE`(날짜 오름차순)→`findUnique` 재읽기→`topUpSkills` 재계산→`update`. `.gitignore` `backups/` → `git check-ignore -v backups/x.json` rc=0. 다음: dry-run 직접 실행(SELECT-only 쿼리 로그), `growth.ts` 읽기, 변이.
- [체크포인트 2 — 위험 영역 1 dry-run 직접 실행] 미러에서 `node --import tsx scripts/backfill-growth-skills.ts`(인자 없음, `--apply` 없음) 종료 0, 출력 55줄, `cuser|@|mysql|mariadb|://` grep 0건(이메일·연결 문자열·userId 없음, 계정은 `#n` 순번; 마지막 줄에 OS 경로 `…/backups` 만). 숫자: users 6 · 관측 626 · 대상 기존 DAILY 행 14 · 건너뜀(행 없음) rows=5 observations=235 · 더할 관측 391(그중 fromCorrection 147: GRAMMAR_PARTICLE 114 · SENTENCE_PRODUCTION 31 · VOCAB_RECALL 2 · CONVERSATION_MAINTAIN 0) · 어긋남 cells=0 · applied 0 · backup `-` — 개발자 보고와 일치. 4주 분포: 어휘 stage1=1 stage2=1 short=2 none=2 / 문형·조사 oneSided=1 short=1 none=4 / 문장 stage1=1 short=1 none=4 / 대화 short=1 none=5 / 듣고 응답 unrecorded=6.
  - 쿼리 로그(스크래치 `rev-080-r2s/qlog.mts` — 이벤트 로거 `PrismaClient` 로 `runGrowthSkillsBackfill({db}, {apply:false})`): **SELECT 21건 · 그 밖의 SQL 0**, `applied={rows:0,observations:0}`, `backupPath=null`.
- [체크포인트 3 — 위험 영역 2·3 코드 읽기] `observations/index.ts`: `growthSkillDelta` 가 `GROWTH_FROM_CORRECTION_KINDS`={CORRECTION_PROPOSED,CORRECTION_REUSED} 이고 `key !== 'skipped'` 일 때만 `fromCorrection++`(불확실은 `continue` 앞이라 제외), 쓰기 지점 두 곳(`recordObservations` · `scenarios/end.ts` `endObservation`=SCENARIO_COMPLETED → `GROWTH_FROM_CORRECTION_KINDS` 밖이라 0) 모두 `bumpDailySnapshot(…,{observations, skills: growthSkillDelta(…)})` 한 호출·같은 tx. `mergeSkills`: `{...cs}` 로 모르는 키 보존 + `SKILL_COUNT_KEYS` 증가만(`d>0`), `mergeDaily` 가 `c.skills!==undefined || delta.skills 비어있지 않음` 일 때만 `skills` 생성(칸 없는 날 행에 `skills` 안 생김). `observations.bySkill`(`observationDailyDelta`) 코드 diff 0. `growth.ts`: `isOneSided(enough,n,c)=enough&&10c>=9n`, `buildGrowth` 는 **기간 합**(`days` 전체 합산 후 판정), `oneSided` 면 `stage/trend=null`·`spark=[]`, 미기록 축은 `oneSided:false` 포함 반환(항상 있음), `enough` 는 oneSided 와 무관하게 건수·날짜 기준 그대로, `errorTrend` 없음(`GrowthResponse` 타입에도 없음), `getGrowth` 는 `Pick<…,'findMany'|'findFirst'>` 라 쓰기 불가, import = infra·`@/types/plan`·`../attendance` 뿐.
  - 문서 정합 지적 후보(코드 아님): `docs/screens.md:14774·14863` 은 아직 «`n ≥ 1 && 10·fromCorrection ≥ 9·n`·서버 oneSided 는 enough 와 무관» 이라 쓰여 있어 14101(최종 «recorded && enough && …») 및 구현과 어긋남, `screens.md:14908`·`api-contract.md:1492` 의 «stage null ⇔ !enough» 도 oneSided 를 빼먹음 — Low.
- [체크포인트 4 — 위험 영역 4 변이 직접 재현] 미러에서 임시 파일 + `os.replace` 로 14건(스크래치 `rev-080-r2s/mut.py`), 매 건 뒤 NFS 본과 `filecmp` 일치(불일치 출력 0)·`.muttmp` 잔여 0. 시험 6파일(task080Growth·Backfill·SkillsDelta·GrowthRoute · task010b · task010d) 기준 베이스라인 111/111 통과, **14/14 잡힘(생존 0)**: M1 `enough &&` 빼기(3 실패) · M2 `>=`→`>`(3) · **M3 top-up 에서 `fromCorrection` 칸 빼기(2)** · M4 `topUpChanges` 가 fromCorrection 만 모자란 옛 행 무시(2) · M5 REUSED 를 교정 유래에서 제외(4) · M6 넘김도 교정 유래(1) · M7 `mergeSkills` 음수 허용(2) · M8 oneSided 여도 spark(2) · M9 dry-run 도 쓰기 경로 진입(2) · M10 역할극 끝냄 skills 쓰기 제거(2) · M11 기간 합 대신 마지막 날 값(3) · M12 axisWindowStat 에서 `recorded` 조건 빼기(1) · M13 apply 가 잠근 뒤 재읽기 대신 바깥 계획 값 사용(1) · M14 불확실도 교정 유래로 셈(1).
  - 기존 시험 수정 정당성: `git diff` 로 `task010b`(+8줄)·`task010d`(+2줄) 모두 **추가 줄만**(삭제 0) — 기존 단언은 그대로 두고 `skills` 단언을 더함(제안 MAJOR=틀림·MINOR=일부 + `fromCorrection:1`, 거절은 안 셈, 교정 채택만 한 날은 `skills` 칸 없음, 세트 finish `fromCorrection:0`, 역할극 끝냄 `fromCorrection:0`·판정 못 한 끝냄 `uncertain:1`). 검증 약화 없음.
- [체크포인트 5 — 위험 영역 5 재실행 + 독립 대조] 미러(`thekaiwa-rev080r2`, 최신 sync) 서버 시험 전체(`src/modules/{learning,infra,conversation}`·`src/app/api`·`src/types` 146파일, `--test-concurrency=1`): **tests 2164 · pass 2162 · fail 0 · skipped 2**(개발자 보고와 동일, 60초) · `tsc --noEmit` 미러 전체 **종료 0**(개발자 보고의 화면 갈래 1건은 지금 없음) · eslint(`learning/snapshots` 전체·`observations/index.ts`·`scenarios/end.ts`·스크립트·`types/plan.ts`·시험 6개) **종료 0**.
  - **독립 SQL 대조(읽기 전용 SELECT, 스크래치 `indep.mts`)**: 기존 DAILY 행과 같은 (사용자, KST 날짜)에 묶이는 교정 유래 판정 관측(`CORRECTION_PROPOSED/REUSED`·성공/일부/틀림·신뢰도 ≥0.6·발음 축 제외) = 어휘 2 · 문형·조사 114 · 문장 31 = **147** → dry-run 의 `fromCorrection 147`(114·31·2)과 정확히 일치. DAILY 행 중 `skills` 를 이미 가진 행 = **0**(→ C=0 전부, 이전 라운드 코드가 운영 DB 를 건드린 흔적 없음, 어긋남 0 과 일치). 행 없는 날의 교정 유래 판정 관측 = 130(건너뛴 235 중) — 건너뜀 결정 때문에 분자·분모 모두에서 빠진다(결함 아님, 아래 Info).
  - `LearningObservation` 쓰기 지점 전수(`grep createMany|create|upsert`, 시험 제외): `observations/index.ts:156`·`scenarios/end.ts:285` 두 곳뿐이고 둘 다 직후 `bumpDailySnapshot(…, {observations, skills: growthSkillDelta(…)})` 같은 tx. 백필 스크립트 자동 호출 경로 없음(`package.json`·`scripts/*.sh`·`ecosystem.config.js`·`deploy.yml` 에 `backfill` 0). 엔진명 grep 0.

## 최종 판정 (REV-080-R2S) — **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 1 · Info 5)

`native_change`: false. 위 체크포인트 0~5(시험 질·재실행·독립 대조 포함)를 이어서 완성. 소스 수정·커밋·`--apply`·서버 기동 없음(스크래치 `rev-080-r2s/` 일회용, 미러 `.muttmp` 잔여 0, 미러 변경 6파일 NFS 와 `cmp` 동일, `backups/` 폴더 어디에도 생기지 않음).

### 영역별 결과
1. **백필(운영 쓰기) 안전성 — 유지됨.** top-up 이 `SKILL_COUNT_KEYS` 로 `fromCorrection` 도 칸마다 `max(0,R−C)`(옛 행은 관측 칸이 맞아도 `fromCorrectionAdded` 로 갱신, `added` 에는 섞지 않음) · **행 없는 날 미생성**(`backfillSkills.ts` 에 `create/createMany/upsert/INSERT/bumpDailySnapshot` 0건, 구조적으로 불가) · 멱등(두 번째 실행 targetRows 0 → 백업·트랜잭션 0) · 쓰기 경로 = `opts.apply && targetRows>0` 뒤 `deps.backup`→`deps.transaction` 뿐(M9 변이로 확인) · 잠금 순서 사용자(`lockUserRow`)→재읽기·재계획→DAILY `FOR UPDATE`(날짜 오름차순)→`findUnique` 재읽기→`topUpSkills` 재계산(M13) · `.gitignore` `backups/` (`git check-ignore` rc=0) · 백업 `wx`·0600 · dry-run 출력 55줄에 이메일·userId·연결 문자열 0(마지막 줄 로컬 경로뿐) · **dry-run 직접 실행**: 종료 0, 쿼리 로그 **SELECT 21 · 그 밖 0**, applied 0. 숫자 = users 6 · 관측 626 · 대상 행 14 · 건너뜀 5행/235 · 더할 391(fromCorrection 147) · 어긋남 0 — 개발자 보고와 같고 **독립 SQL(기존 DAILY 행에 묶이는 교정 유래 판정 관측) 147 = 어휘 2 + 문형·조사 114 + 문장 31 과 정확히 일치**, `skills` 를 이미 가진 DAILY 행 0(→ 전부 C=0).
2. **`fromCorrection` 쓰기·병합 — 이상 없음.** 쓰기 지점은 `observations/index.ts:156-157`·`scenarios/end.ts:285-286` 두 곳뿐(전수 grep)이고 둘 다 같은 tx·같은 `bumpDailySnapshot` 호출에 `skills: growthSkillDelta(…)`. 역할극(SCENARIO_COMPLETED)은 `GROWTH_FROM_CORRECTION_KINDS` 밖이라 0(010d 단언). `mergeSkills` = `{...cs}` 로 모르는 키 보존 + 증가만(M7 음수 허용 변이 잡힘), HEAD 의 `mergeDaily` 도 `...c` 라 코드 롤백해도 `skills` 칸 남음. 칸 없는 옛 행은 0 으로 읽혀 판정 영향 없음(시험 + 운영 DAILY 에 `skills` 0행). `observations.bySkill`(`observationDailyDelta`) 코드 변경 0.
3. **`growth.ts` 응답 — 사양·계약 일치.** `isOneSided(enough,n,c)=enough&&10c≥9n` 단일 정의를 백필(`axisWindowStat`)이 재사용(중복 재구현 없음) · 기간 합 판정(M11) · `oneSided` 항상 존재(미기록 축도 `false`) · 참이면 `stage/trend=null`·`spark=[]`·`enough` 불변 · 응답에 `fromCorrection`·`uncertain`·`errorTrend` 키 없음(시험) · 필드 집합이 api-contract #78 예시와 일치 · `getGrowth` 는 `Pick<…,'findMany'|'findFirst'>` 라 쓰기 불가 · import = infra·`@/types/plan`·`../attendance` 뿐(6층 방향 유지), 엔진명 grep 0.
4. **시험 질.** 베이스라인 111/111 → 변이 **14/14 잡힘**(생존 0 — 개발자 15건과 별개로 직접 재현: `enough` 조건·90% 경계·**top-up 의 fromCorrection 칸**·REUSED 제외·넘김/불확실 혼입·dry-run 쓰기 진입·잠근 뒤 재읽기·기간 합·`recorded` 조건 등). `task010b`(+8줄)·`task010d`(+2줄)는 **추가 줄만**이라 검증 약화 없음.
5. **재실행.** 서버 전체 2164 중 2162 통과 · 0 실패 · 2 skipped(보고와 동일), `tsc` 0, eslint 0.

### 지적
**Critical 0 · High 0 · Medium 0**

**Low**
- **L-1 사양 문서 잔여 어긋남(코드 아님)**: `docs/screens.md:14774`·`:14863` 은 아직 «서버 `oneSided` 는 `enough` 와 무관 · `recorded && n ≥ 1 && 10·fromCorrection ≥ 9·n`» 이라 쓰여 있어 최종 정의(`:15101` «`recorded && enough && …`», 구현·api-contract #78·`types/plan.ts`)와 다르다. `screens.md:14908`·`api-contract.md:1492` 의 «`stage: … null ⇔ !enough`» 도 `oneSided` 로 숨는 경우를 빼먹었다(`types/plan.ts` 주석은 «null ⇔ !enough 또는 oneSided» 로 맞음). `screens.md:15045` 12번 QA 항목의 «`!enough && oneSided:true`(n=3)» 응답은 서버가 더는 보내지 않는 값이다. 위험: QA/후속 화면 작업자가 낡은 줄을 기준으로 불가능한 응답을 기대하거나 시험 고정값을 만든다(화면 분기는 `!enough` 먼저라 방어적으로 무해). 권고(Leader): 위 4곳을 최종 정의로 정정.

**Info**
- I-1 L2 자료 `stage0ByProposals4w` 는 `oneSided` 로 숨겨진 축의 내부 `stage` 도 센다(dry-run `GRAMMAR_PARTICLE=1` = 화면에는 «아직 판단하기 일러요» 로 나올 계정). 라벨 «stage 0 only because of correction proposals» 는 C 규칙 이전 판단 자료로 읽어야 한다.
- I-2 «행 없는 날 미생성» 결정으로 건너뛰는 235건 중 교정 유래 판정 관측이 **130건**(독립 SQL) — 분자·분모에서 함께 빠져 계정 #1 의 4주 비율이 실제 기록보다 덜 한쪽으로 보일 수 있다. 결함이 아니라 결정의 결과(Leader 승인). `--apply` 뒤에도 dry-run 의 `skipped rows=5 observations=235` 는 그대로 남는 것이 정상.
- I-3 `--backup-dir` 를 빼면 기본은 여전히 실행 폴더 `./backups`(gitignore 됨·다음 배포 때 지워짐). 안내는 dry-run 마지막 줄·스크립트 머리 주석에만 있고 apply 출력은 `backup: <경로>` 한 줄. `PROD_BACKUP_DIR` 은 안내 문자열용 상수(실사용 경로는 인자). 운영 지시에 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 를 명시하면 충분.
- I-4 dry-run 마지막 줄에 로컬 절대 경로(`…/backups`)가 출력된다 — 앱 사용자 정보·Secret 은 아니다.
- I-5 이전 감사 Info(I-3 공개 API 표면·I-4 중간 실패 시 부분 적용·I-5 세트 삭제 뒤 재집계 이중 계산 가능성)는 이번 수정으로 바뀌지 않았다.

### QA(Leader)가 볼 곳 — high_risk_areas
1. **적용 순서**: 새 코드 배포 → dry-run(위 숫자 ±실시간 변화) → 사용자 승인 → `--apply --backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` → 같은 명령 dry-run 재실행에서 `observations to add: 0 (of which fromCorrection: 0)` · `mismatch cells=0` · `skipped rows=5 observations=235` · `applied.observations ≤ 391`·`fromCorrection ≤ 147`. 적용 전에 코드를 배포하지 않으면 옛 코드의 실시간 쓰기는 `skills` 를 올리지 않아 재실행으로 메워야 한다(멱등).
2. **적용 뒤 #78**: 계정 #1 문형·조사 `enough:true · oneSided:true · stage:null · trend:null · spark:[]`(4주 n=119, 교정 113), 같은 계정 문장 1단계·어휘 2단계, 표본 부족 계정은 `oneSided:false`·`stage:null`; 8/12주로 바꿔 기간 합 판정이 달라질 수 있음(같은 축이 4주엔 숨김·12주엔 단계 가능)을 사양으로 인지.
3. **실시간**: 교정 제안 1건(틀림) 뒤 DAILY `skills.<축>.fromCorrection` 이 같은 tx 에서 +1, 역할극 끝냄은 `CONVERSATION_MAINTAIN` 만 +1 이고 `fromCorrection` 0, 교정 채택만 한 날은 `skills` 칸 없음.
4. **문서 정합**: L-1 4곳 정정(Leader).
