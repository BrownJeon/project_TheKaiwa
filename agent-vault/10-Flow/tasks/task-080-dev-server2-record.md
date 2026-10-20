---
task: task-080
role: developer
name: dev-080-server2
tags:
  - type/task-record
  - domain/plan
  - domain/learning
---
# task-080 서버 갈래 마무리 developer 기록 — [[task-080-plan-growth-analysis]]

앞선 기록: [[task-080-dev-server-record]](체크포인트 1~4). 사양 `docs/screens.md` §36-8·36-17-1(L2·L10). 미러 `~/.node-local/thekaiwa-dev080s`(재사용, `mirror-audit --check` 종료 0). 커밋·배포·DB 쓰기·백필 `--apply` 없음.

## Developer 기록

- [체크포인트 5 — 백필 구현] 완료. 새 `src/modules/learning/snapshots/backfillSkills.ts`(순수: `observationDailyDate`·`recountByDate`·`topUpSkills`·`planUserBackfill`·`axisWindowStat`·`distributionBucket`·`formatGrowthSkillsBackfillReport` / DB: `readUserBackfillInputs`(읽기만)·`applyUserBackfill`(tx)·`runGrowthSkillsBackfill`), 새 `scripts/backfill-growth-skills.ts`(얇음 — 인자·백업 파일·prisma·출력), `snapshots/index.ts` `SKILL_COUNT_KEYS` export, `learning/index.ts` 에 run/format·타입 export. 시험 새 `learning/__tests__/task080Backfill.test.ts` 9개 통과(미러).
  - 결정 근거: apply 는 사용자별 트랜잭션에서 `lockUserRow` **뒤에 관측·세트·DAILY 를 다시 읽어** 계획을 다시 세운다(사용자 잠금을 잡은 뒤에는 `recordObservations`·역할극 끝냄이 관측을 더 쓸 수 없어 R 이 고정). 더할 날만 DAILY 행 `FOR UPDATE` → 잠근 뒤 `findUnique` 로 다시 읽은 `data` 에 `mergeDaily({skills})` — 사용자 잠금 없이 DAILY 를 쓰는 다른 경로(평가·studyLog)의 다른 칸 증가를 덮지 않게. 행이 없으면 `bumpDailySnapshot`. 트랜잭션 상한 60초(`BACKFILL_TX_TIMEOUT_MS`), 교착 재시도는 `withTransaction` 그대로(재계산이라 안전).
  - 백업: apply 이고 더할 것이 있을 때만, 첫 쓰기 전에 `<backup-dir>/growth-skills-backup-<UTC>.json`(`wx`·600, 기본 `./backups`) — `{userId, periodKey, id, data, plannedAdd}`. 복원 SQL(JSON_SET/JSON_REMOVE `$.skills` 만)은 스크립트 머리 주석.
  - 분포: 적용 뒤 칸으로 계정마다 축 5개 × 창 3개(4w·12w·all) `n·days·rate·stage·short·uncertain·skipped`, 4주 창 계정 수 분포(stage0~3·short·none·unrecorded). 단계는 표본 기준과 무관하게 내고 `short` 로 표시(L2 판단 자료).
  - 다음 첫 행동: tsc·eslint → dry-run 실행 → 변이 시험.
  - 미커밋 파일(이번): `src/modules/learning/snapshots/backfillSkills.ts`(새) · `scripts/backfill-growth-skills.ts`(새) · `src/modules/learning/__tests__/task080Backfill.test.ts`(새) · `src/modules/learning/snapshots/index.ts` · `src/modules/learning/index.ts` · 이 기록.
- [체크포인트 6 — dry-run 실제 실행(읽기 전용)] 미러에서 `node --import tsx scripts/backfill-growth-skills.ts`(인자 없음) 종료 0. 같은 계산을 Prisma 쿼리 로그를 켠 확인용 실행(스크래치 `verify.mts`)으로 한 번 더 돌려 **SQL 동사 = SELECT 42건, INSERT/UPDATE/DELETE 0**. 출력에 userId·이메일·연결 문자열 0건(grep). 보고서(숫자만, 2026-10-21 KST):
  ```
  users with countable observations: 6 · observations read: 626
    vocab cards dated by set date: 65 (set crossed midnight: 10) · set deleted -> occurredAt: 171 · others by occurredAt: 390
  target DAILY rows: existing=14 missing(create)=5 · observations to add: 626 (지금 skills 칸 C 는 전부 0 — 배포 전)
    CONVERSATION_MAINTAIN success=0 partial=0 fail=1 skipped=0 uncertain=0
    GRAMMAR_PARTICLE      success=13 partial=55 fail=177 skipped=16 uncertain=0
    SENTENCE_PRODUCTION   success=10 partial=45 fail=6 skipped=22 uncertain=2
    VOCAB_RECALL          success=113 partial=0 fail=40 skipped=126 uncertain=0
  date range: 2026-10-03 .. 2026-10-21 · mismatch(R<C) cells=0 rows=0 · applied 0 · backup -
  계정별(4주=12주=전체, 데이터가 10-03 이후뿐이라 세 창이 같음):
    #1 어휘 n=46 days=3 72% 2단계 | 문형·조사 n=230 days=5 13% 0단계 | 문장 n=55 days=5 52% 1단계 | 대화 유지 n=0
    #2 어휘 n=27 days=8 63% 1단계 | 문형·조사 n=8 94% short | 문장 n=6 67% short(불확실 2) | 대화 유지 n=0
    #3 어휘 n=21 days=2 95% short | 문형·조사 n=7 days=1 50% short | 대화 유지 n=1 0% short
    #4 어휘 n=10 days=1 100% short · #5 어휘 n=6 days=1 50% short · #6 어휘 n=43 days=1 70% short (그 밖 축 n=0)
  4주 분포: 어휘 stage1=1 stage2=1 short=4 · 문형·조사 stage0=1 short=2 none=3 · 문장 stage1=1 short=1 none=4 · 대화 유지 short=1 none=5 · 듣고 응답 unrecorded=6
  ```
  - **L2 자료(Leader 보고)**: #1 문형·조사 13%·0단계 — 읽기 전용 kind 분해: 교정 제안 FAIL 177·PARTIAL 47, 수업 문법 SUCCESS 6·SKIPPED 12, 교정 재사용 0. 틀림 **전부**가 교정 제안(MAJOR=FAIL) 관측이라 «한쪽 증거 편향»이 실제로 크다(맞힘은 수업 6건뿐). 표시 정책 판단 필요(구현 규칙은 안 바꿈).
  - **사양과 다른 사실(Leader 보고)**: §36-8 은 «관측만 있고 DAILY 행이 없을 수는 없다»고 봤지만 **없는 행 5개**(관측 235건: #1 교정 제안 123 · #3 교정 제안 7 + 지워진 세트 카드 20 · #4 지워진 세트 카드 10 · #6 지워진 세트 카드 75). 원인 [가능성 높음]: `tests/live/*-smoke.ts` 정리 단계가 DAILY 행을 지우고(task008-smoke 528행·task012-smoke 287행 등) append-only 관측은 남김. 백필은 사양대로 이 5행을 `bumpDailySnapshot` 으로 **새로 만든다** — 그 행은 공부 종류 0(공부한 날 아님)이지만 ① 그 관측이 공부결과 n 에 들어가고(#6 은 전부 이것) ② 가장 이른 DAILY 가 앞당겨지면 `since`(기록 전 주 판정)가 바뀔 수 있다. 만들지 않게 할지(옵션 추가)는 Leader 결정 — 지금 구현은 사양 그대로.
- [체크포인트 7 — 변이 시험] 미러 파일만 임시 파일+`os.replace` 로 바꾸고 시험 → `rsync --checksum` 으로 NFS 본으로 되돌린 뒤 `cmp` 일치 확인(11건 모두 restored). 결과: M1a/b/c `skillStage` 50·70·85 `<`→`<=` 각각 잡힘(task080Growth 1 실패) · M2 `GROWTH_SKILL_OF_KIND` 에 `CORRECTION_ACCEPTED` 추가 잡힘(5 실패) · M3 `WEEK_START_DOW=1` 잡힘(13 실패) · M4 top-up `R−C`→`R` 잡힘 · M5 발음 교정 제외 줄 삭제 잡힘(5 실패) · M6 단어 카드 날짜를 늘 occurredAt 잡힘(4) · M7 dry-run 에서도 적용(`opts.apply &&` 삭제) 잡힘 · M8 세트 소유자 검사 삭제 잡힘(3) · M11 `lockUserRow` 삭제 잡힘. **처음 놓친 것 2건 → 시험 보강**: M9(잠근 뒤 다시 top-up 하지 않고 계획값 사용)·M10(잠금 전 읽은 data 에 병합) — 새 시험 «행을 잠그는 사이 바뀐 data 기준으로 병합» + 가짜 DB `findMany` 가 data 를 복제해 돌려주게 고친 뒤 둘 다 잡힘. `task080Backfill.test.ts` 10/10.

### 가이드(§36-8)와 어긋난 곳
- **사실 차이 → Leader 결정(2026-10-21)으로 규칙 변경**: «관측만 있고 DAILY 행이 없을 수는 없다(방어로 만든다)» → 실제 5행. 결정: **행이 없는 날은 만들지 않고 «건너뜀(행 없음)» 으로만 센다**(기존 행 top-up 만, dry-run·apply 같은 규칙). 체크포인트 9.
- **사양에 없던 정함**: 백업 기본 경로 `./backups`(실행 폴더 기준). 운영 실행 때는 릴리스 폴더가 정리되므로 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups` 를 권장(deploy 문서 반영은 Leader). 더할 것이 0이면 apply 여도 백업·트랜잭션을 만들지 않는다(멱등 재실행 = 0건·파일 0개).
- **보고서 확장**: «축별 단계 분포»를 계정별 4w·12w·all 세 창 + 4주 창 계정 수 분포(stage0~3·short·none·unrecorded)로 냈다. 단계는 표본 기준과 무관하게 계산하고 `short` 로 표시(화면은 short 면 단계를 안 보임).

### 한계
- 세트가 지워진 단어 카드 관측은 세트 날짜를 알 수 없어(`refId` = 카드 id, 관측에 sessionId 없음) occurredAt 날짜로 묶는다 — 자정을 넘긴 지운 세트는 하루 밀린다. 배포 뒤 실시간으로 세트 날짜에 들어간 뒤 그 세트를 지우고 백필하면 그 날짜는 «어긋남», occurredAt 날짜는 한 번 더 더해질 수 있다(드묾 — 지금은 C 가 전부 0 이라 해당 없음).
- 잠금 전제: 관측 쓰기 경로가 사용자 행을 먼저 잠근다(단어 세트·수업·역할극 끝냄은 `lockUserRow` 확인, 교정 제안은 회화 턴 tx 의 사용자 잠금 [가능성 높음 — 직접 확인 안 함]). 이 전제가 깨져도 DAILY 행 잠금 뒤 다시 읽어 top-up 하므로 **이중 계산은 없고**, 드물게 1건 덜 더할 수 있으나 다시 실행하면 채워진다(top-up 멱등).
- 복원은 `data.skills` 만 되돌린다 — 백업 뒤 실시간으로 더해진 skills 증가분도 함께 사라진다(늦게 되돌릴 땐 `plannedAdd` 만큼 빼기). 백업 파일에 userId·행 id 가 있다(복원 뒤 삭제, 커밋 금지).
- `tests/live/*-smoke.ts` 정리가 DAILY 행을 지우면 그 관측은 «건너뜀(행 없음)»으로 매번 세어진다(만들지 않으므로 숫자 오염 없음). 시험 정리 방식은 qa 영역이라 안 고침.
- 같은 이유로, 실제 사용자 관측인데 DAILY 행이 (알 수 없는 이유로) 없는 날이 있다면 그 관측은 공부결과에 들어가지 않는다(Leader 결정의 대가 — 현재 5행 모두 시험 잔여분으로 보임 [가능성 높음]).
- apply 는 사용자당 트랜잭션 하나(상한 60초) — 가장 큰 계정도 관측 수백 건이라 충분하다고 봄 [가능성 높음, apply 미실행이라 실측 없음].

### reviewer 가 볼 곳
1. `snapshots/backfillSkills.ts applyUserBackfill` — `lockUserRow` → 재읽기·재계획 → 더할 날(기존 행만)만 `SELECT … FOR UPDATE`(날짜 오름차순) → `findUnique` 재읽기 → `topUpSkills` 재계산 → `mergeDaily({skills})` 갱신 / 잠금 결과 0행이면 건너뜀(만들지 않음 — `bumpDailySnapshot` import 없음). 잠금 순서가 `recordObservations` 와 같은지.
2. `runGrowthSkillsBackfill` — dry-run 은 `transaction`·`backup` 을 부르지 않음(시험이 잠금·쓰기·백업 0 확인), apply 는 백업이 첫 쓰기 전, `transaction`/`backup` 없으면 쓰기 전에 throw.
3. 개인정보 — `formatGrowthSkillsBackfillReport` 는 순번·숫자만(시험이 'cuser' 0 확인), 스크립트 오류 출력은 이름·코드만.
4. 6층 — `learning/snapshots/backfillSkills` 는 infra(`dates`·`lockUserRow`·`Tx`)·`@/types/plan`·`../observations`·`./index`·`./growth` 만 import. 스크립트는 `@/modules/learning`·`@/modules/infra` 공개 API 만.
5. `snapshots/index.ts` 의 변경은 `SKILL_COUNT_KEYS` export 한 줄.

### 실행 증빙 (체크포인트 8 — 서버 갈래 전체 점검, [00:20])
- 서버 시험 전체(미러, `node --import tsx --test --test-concurrency=1` · `src/modules/{learning,infra,conversation}`·`src/app/api`·`src/types` 146파일): **tests 2154 · pass 2152 · fail 0 · skipped 2**(101초). `task080Backfill.test.ts` 10/10 포함.
- `tsc --noEmit`(미러 전체): **오류 0**(화면 갈래 파일 포함 — 앞선 기록의 `GrowthSoonCard` 2건은 사라짐).
- eslint(변경 서버 파일·시험·스크립트·`src/modules/learning` 전체·ask 프롬프트 2파일·types): **종료 0**.
- 엔진명 grep(새 파일 2개): 0건. NFS ↔ 미러 `cmp` 8파일 동일(변이 원복 확인).
- 미커밋 파일(서버 갈래 마무리 분): `src/modules/learning/snapshots/backfillSkills.ts`(새) · `scripts/backfill-growth-skills.ts`(새) · `src/modules/learning/__tests__/task080Backfill.test.ts`(새) · `src/modules/learning/snapshots/index.ts` · `src/modules/learning/index.ts` · 이 기록. 스크래치 `dev-080-server2/`(dryrun.txt·verify.mts·kinds.mts·mut.sh — 일회용).
- 남은 일(서버 갈래): 없음. Leader 결정 대기 2건 — L2 표시 정책(문형·조사 편향), 없는 DAILY 5행을 백필이 만들지 여부. `--apply` 는 미실행(L10).

- [체크포인트 9 — Leader 결정 반영: 행 없는 날은 만들지 않음] `backfillSkills.ts`: `planUserBackfill` 이 행 없는 날을 계획에서 빼고 `skipped{rows, observations}` 로 셈, `applyUserBackfill` 은 잠금 결과 0행이면 건너뜀(`bumpDailySnapshot` 경로·import 제거), 보고서 `targetRows`(기존 행 수)·`skippedNoRow` 로 바꿈(«새로 만들 행» 줄 → «skipped (no DAILY row, not created)»), 백업 행은 기존 행만(`id`·`data` non-null). L2 자료로 `stage0ByProposals4w`(4주 창에서 표본 기준 넘겨 0단계인데 교정 제안 관측을 빼고 다시 세면 0단계가 아닌 계정 수)를 보고서 끝 줄에 추가. 스크립트 머리 주석(규칙·백업·복원 — 새 행 복원 줄 삭제) 갱신.
  - 시험 `task080Backfill.test.ts` 12/12: dry-run(대상 행 2 · 건너뜀 1행/3관측 · 더할 4 · 쓰기 0) · apply(INSERT 0 · 행 없는 날 그대로 없음 · 기존 행 top-up 그대로 · 두 번째 실행 0, 건너뜀은 매번 같은 수) · 새 «계획 뒤 행이 사라져도 만들지 않음» · 새 «L2 — 교정 제안 때문에만 0단계인 계정 수(제안 빼면 short 인 계정 셈, 수업 문제로도 0단계면 안 셈)».
  - 변이: M12 «행 없을 때 만들기»(계획 + 적용 두 곳) → 4개 실패로 잡힘 · M12b «적용에서만 만들기» → 1개 실패로 잡힘. 둘 다 `rsync --checksum` 원복·`cmp` 일치.
  - dry-run 재실행(인자 없음, 종료 0, 출력 userId 0건) + 쿼리 로그 확인 실행: **SQL = SELECT 21건, 쓰기 0**. 새 숫자(2026-10-21 KST):
  ```
  users 6 · observations read 626 (세트 날짜 65·자정 넘김 10 · 지운 세트→occurredAt 171 · 그 밖 390)
  target DAILY rows (existing only): 14 · skipped (no DAILY row, not created): rows=5 observations=235
  observations to add: 391
    CONVERSATION_MAINTAIN success=0 partial=0 fail=1 skipped=0 uncertain=0
    GRAMMAR_PARTICLE      success=13 partial=32 fail=82 skipped=16 uncertain=0
    SENTENCE_PRODUCTION   success=10 partial=34 fail=5 skipped=22 uncertain=2
    VOCAB_RECALL          success=53 partial=0 fail=27 skipped=94 uncertain=0
  date range 2026-10-03 .. 2026-10-21 · mismatch(R<C) cells=0 rows=0 · applied 0
  계정별 4주(=12주=전체):
    #1 어휘 n=46 days=3 72% 2단계 | 문형·조사 n=119 days=3 18% 0단계 | 문장 n=43 days=3 53% 1단계
    #2 어휘 n=27 days=8 63% 1단계 | 문형·조사 n=8 94% short | 문장 n=6 67% short(불확실 2)
    #3 어휘 n=1 short · 대화 유지 n=1 0% short   #5 어휘 n=6 50% short   #4·#6 전 축 n=0(전부 건너뛴 행이었음)
  4주 분포: 어휘 stage1=1 stage2=1 short=2 none=2 · 문형·조사 stage0=1 short=1 none=4 · 문장 stage1=1 short=1 none=4 · 대화 유지 short=1 none=5 · 듣고 응답 unrecorded=6
  stage 0 only because of correction proposals (4w): GRAMMAR_PARTICLE=1 (그 밖 축 0)
  ```
  - **L2 자료**: 표본 기준을 넘긴 문형·조사 계정은 1개(#1)뿐이고, 그 1개가 «교정 제안 틀림 때문에만 0단계»다(제안을 빼면 short). 즉 지금 문형·조사 0단계로 보일 계정 1/1 이 교정 제안 편향이다.
  - 실행 증빙 [00:24]: 서버 시험 전체(같은 146파일) **2156 · pass 2154 · fail 0 · skipped 2** · `tsc --noEmit` 미러 전체 **오류 0** · eslint(`scripts/backfill-growth-skills.ts`·`learning/snapshots`·`learning/index.ts`·새 시험) **종료 0** · NFS↔미러 `cmp` 동일. `--apply`·커밋·배포 없음. 미커밋 파일 목록은 체크포인트 8 과 같음.
