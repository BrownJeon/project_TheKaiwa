---
task: task-080
role: reviewer
name: rev-080-server
tags:
  - type/task-record
  - domain/plan
  - domain/learning
---
# task-080 서버 갈래 reviewer 기록 (REV-080-S) — [[task-080-plan-growth-analysis]]

감사 대상: 서버 갈래(미커밋) — 개발 기록 [[task-080-dev-server-record]] · [[task-080-dev-server2-record]]. 미러 `~/.node-local/thekaiwa-rev080s`(make-mirror.sh 신규). 소스 수정·커밋·`--apply` 없음.

## 중간 기록 (체크포인트 1)
- 확인 완료(코드 읽기): `backfillSkills.ts` 전체 · `scripts/backfill-growth-skills.ts` 전체 · `snapshots/{index,growth}.ts` · `observations/index.ts` · `scenarios/end.ts` diff · `recordRetrieval/range.ts`·`ask.ts`·`prompts/ask.ts` diff · `route.ts` · `infra/dates.ts` diff · `infra/tx.ts`(격리 = READ COMMITTED 확인 → 잠금 뒤 재읽기 유효).
- 후보 지적: (L1) 백업 기본 폴더 `./backups` 가 `.gitignore` 에 없음(`git check-ignore` 종료 1) — userId·행 id 담은 파일이 untracked 로 보임.
- 다음에 볼 것: 미러 시험·tsc·eslint 재실행, dry-run 쿼리 로그, 변이 3개 이상, 경계 직접 계산, `weekStartOf` 경계, 시험 질.

## 중간 기록 (체크포인트 2)
- 직접 재실행(미러): task-080 서버 시험 5파일 **44/44 통과** · `tsc --noEmit` 미러 전체 **종료 0** · dry-run 스크립트(인자 없음) **종료 0**, 출력에 `cuser`·`@`·`mysql` 0건, 보고 숫자 = 개발자 보고와 일치. 로깅 `PrismaClient` 로 같은 `runGrowthSkillsBackfill(apply:false)` 실행 → **SQL = SELECT 21건, 쓰기 0**(`DEBUG=prisma:query` 는 Prisma 6 에서 출력 안 돼 쓰지 못함 → 이벤트 로거로 대체).
- 격리 수준 확인: `withTransaction` = READ COMMITTED → 잠금 뒤 `findUnique` 가 잠금 대기 중 커밋된 행을 본다(§잠금 순서 유효). 가짜 DB 시험은 이 격리 의미를 증명하지 못하지만 코드 근거(tx.ts 주석)로 충분.
- 다음: 변이 3개↑ 재현, `weekStartOf`·ask 날짜 경계 직접 계산, 누락 시험 점검, 중간 지적 정리.

## 중간 기록 (체크포인트 3)
- 변이 직접 재현 **19건**(미러에서 임시 파일 + `os.replace`, 끝마다 NFS 본과 `cmp` 19/19 rc=0): 잡힘 17 · 살아남음 2 — ML(`longestRunOfDates` 중복 건너뜀 삭제: 시험 입력 `[a,a,a+1]` 은 가드 없이도 2 라 **공허**, Attendance 는 `@@unique(userId,date)` 라 실사용 영향 0 → Low) · MT(`skipped.rows` 셈 조건 — recount 가 비어 있지 않은 날만 도달하므로 **동등 변이**, 문제 아님). 잡힌 것: 추세 ±5%p 경계 · `minDays` 경계 · `before` 경계(`<` vs `<=`) · 신뢰도 0.6 경계 · end.ts·recordObservations 의 `skills` 쓰기 제거 · 질문 탭 두 곳 월요일 회귀 · 루브릭 상한 · `from` 주 수 off-by-one · spark 최소 건수 · `weekStartOf` 오프셋 · dry-run 에서 쓰기(`opts.apply` 삭제) · 백업 생략 · `lockUserRow` 삭제 · top-up `>` → `>=`/`!==`.
- `weekStartOf` 를 파이썬 독립 계산과 11개 날짜(연·윤년·2000·2038 경계)로 대조, `TZ=UTC·Asia/Seoul·America/Los_Angeles·Pacific/Kiritimati` 4개에서 전부 일치.
- ask·recordRetrieval 날짜 기대값(10-08→10-04~10-10 · 토 23:59→10-04 · 일 00:00→10-11~10-17 · 12-31→12-27~2027-01-02 · instants 10-03T15:00Z / 10-10T15:00Z)을 직접 계산해 사양 표와 일치 확인. `mondayOf` 잔존 0, 코드 안 `월~일` 은 롤백 설명 주석뿐.
- 후보 지적: (L1) 백업 `./backups` 비무시, (L2) 시험 제목 «없는 행은 만든다» 낡음(코드·단언은 «만들지 않는다»), (L3) 중복 날짜 시험 공허.

## 최종 판정 (REV-080-S) — **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 5 · Info 6)

`native_change`: false (서버·문서·스크립트뿐). 7개 검토 영역 전부 확인. 위 «중간 기록» 블록(체크포인트 1~3)을 이어서 완성했다.

### 직접 재실행한 것(미러 `thekaiwa-rev080s`, 개발자 보고를 믿지 않고 재현)
| 항목 | 결과 |
|---|---|
| 서버 시험 전체(learning·infra·conversation·app/api·types) | **tests 2156 · pass 2154 · fail 0 · skipped 2**(개발자 보고와 동일, 98.7초) |
| task-080 서버 시험 5파일 | 44/44 |
| `tsc --noEmit`(미러 전체) | 종료 0 |
| eslint(변경 서버 파일·새 시험·스크립트) | 종료 0 |
| 백필 dry-run(인자 없음) | 종료 0, 출력에 `cuser`·`@`·`mysql` 0건, 숫자 = 개발자 보고와 동일(6명·관측 626·대상 행 14·건너뜀 5행/235·더할 391) |
| dry-run 쿼리 로그(이벤트 로거 `PrismaClient` 로 `runGrowthSkillsBackfill(apply:false)`) | **SELECT 21건 · INSERT/UPDATE/DELETE 0** (`DEBUG=prisma:query` 는 Prisma 6 에서 출력이 없어 이벤트 로거로 대체) |
| 변이 직접 재현 19건(임시 파일 + `os.replace`, 끝마다 NFS 본과 `cmp` rc=0) | 잡힘 17 · 살아남음 2(아래 L-4·동등 변이) |
| 독립 계산 대조 | `weekStartOf` 11개 날짜(윤년·2000·2038·연 경계) × `TZ` 4종(UTC·Asia/Seoul·America/Los_Angeles·Pacific/Kiritimati) 모두 파이썬과 일치 / 질문 탭 날짜(10-08→10-04~10-10, 토 23:59→10-04, 일 00:00→10-11~10-17, 12-31→12-27~2027-01-02, 인스턴트 10-03T15:00Z·10-10T15:00Z) 사양 표와 일치 |
| `ask@v3` 체크섬 | 버전 문자열을 `ask@v2` 로 되돌려 계산하면 `0f6888ca…`(v2 pin)와 **정확히 일치** → 「버전 문자열만 바뀜」 주장 확인(증가는 SCOPE_KO 문구 변경에 대해 정당) |
| 복원 SQL 문법 | MariaDB 10.11 에 리터럴 `SELECT JSON_SET(…, JSON_EXTRACT('…','$'))`·`JSON_REMOVE` 실행 → `skills` 가 문자열이 아닌 **객체로** 들어가고 제거도 정상(`StatsSnapshot.data` = longtext). 테이블은 읽지도 쓰지도 않음 |
| 데모 게이트 | `check.mjs check --task task-080…` → `DEMO_GATE_PASSED`(approved v4, hash verified). `evidence.jsonl` 50번째 줄: kind=approve·version 4·`prompt_ts` 23:18:47(승인 직전 사용자 입력)·`session_id` 이 세션 — 에이전트가 대신 승인한 흔적 없음. 화면 대비는 UI 갈래 감사 몫 |

### 영역별 결과
1. **아키텍처**: `growth.ts` 는 `Pick<…,'findMany'|'findFirst'>` 타입이라 컴파일 단계에서 쓰기 불가, 라우트는 `requireSession → parseGrowthWeeks → getGrowth` 뿐(DB 직접 접근 0, `{success,data,message}`). `backfillSkills.ts` import = infra·`@/types/plan`·`../observations`·`./index`·`./growth`, 순환 없음. 엔진명 grep 0건.
2. **유지보수성**: 주 시작 계산이 `dates.weekStartOf` 한 곳으로 모임(`mondayOf` 삭제, 잔존 참조 0, 코드 안 «월~일» 은 롤백 설명 주석뿐). `askScopeDates` 와 `resolveRange` 의 중복은 층 규칙(conversation↔learning 직접 의존 금지) 때문에 남았지만 같은 상수를 쓴다.
3. **안정성**: 백필 적용 = 사용자별 트랜잭션(`withTransaction` = **READ COMMITTED** — `infra/tx.ts` 주석·코드로 확인 → 잠근 뒤 `findUnique` 가 대기 중 커밋된 행을 본다, 가짜 DB 시험이 증명하지 못하는 부분을 코드 근거로 확인) → `lockUserRow` → 재읽기·재계획 → 더할 행만 `FOR UPDATE`(날짜 오름차순) → 재읽기 → top-up → `mergeDaily`. 기존 쓰기의 잠금 순서(사용자 → DAILY)와 같고, `recordObservations` 호출자 전부가 사용자 행을 먼저 잠근다(`lockUserRow` 호출처 전수 확인: vocab finish·lesson complete·역할극 끝냄·회화 턴·교정 accept·평가 fencing). 행 없는 날은 만들지 않음(`bumpDailySnapshot` import 0) — 변이 MR·dev M12 로 확인. 멱등(두 번째 실행 0, 백업·트랜잭션 0).
4. **운영성**: 보고서는 순번·숫자만, 오류 출력은 이름·코드만. 백업은 첫 쓰기 전 1회·`wx`·600(L-1 참고).
5. **성능**: #78 = 병렬 읽기 4개(DAILY ≤ 84행·`findFirst` 1·출석·평가 전체), N+1 없음. 출석·평가 전체 읽기는 사양(전체 기간 최장 연속·`hasEvaluations`)의 결과.
6. **보안**: 인증 401(계산 호출 0, 잘못된 `weeks` 여도 인증 먼저) · 세션 `userId` 만(주소의 `userId` 무시 — 시험) · `weeks` 4|8|12 외 400(`'04'`·`'8.0'`·`'-4'` 포함) · 응답에 이메일·내부 id 없음(평가 `id` 예외) · 로그에 건수만(`[growth] 형식이 틀린 평가 스냅샷 N건`). 백필 SQL 은 전부 태그드 템플릿(파라미터 바인딩).
7. **학습 원칙**: DAILY 증가 전용(`mergeDaily`·`mergeSkills` 음수 무시, top-up `max(0,R−C)`, R<C 는 «어긋남»으로만 셈), `observations.bySkill` 코드 변경 0(diff 의 삭제 줄 3개는 import·주석·호출 한 줄뿐), 모르는 키 보존(옛 코드 롤백 시 칸 유지). DB 시간대 검증: 서버 `NOW()` 는 KST(SYSTEM)지만 `LearningObservation.occurredAt` 는 엔진 시각(UTC) — 미래 시각 행 0/684 → `todayKst(occurredAt)` 날짜 묶기가 유효.

### 지적

**Critical 0 · High 0 · Medium 0**

**Low**
- **L-1 백업 기본 폴더가 비무시·릴리스 안**: `scripts/backfill-growth-skills.ts:33` `backupDir = path.join(cwd,'backups')`, `.gitignore` 에 `backups/` 없음(`git check-ignore -v backups/x.json` 종료 1). 백업 파일은 `userId`·행 id·DAILY `data` 를 담는다(머리 주석은 «커밋 금지» 만 말함). 릴리스 폴더에서 돌리면 다음 배포 정리 때 사라진다. 위험: 실수 커밋 / 안전망 소실. 재현: `git check-ignore -v backups/x.json; echo $?`. 권고: `.gitignore` 에 `backups/` 추가 **또는** 기본을 `$DATA_ROOT` 아래로, 운영 실행 지시에 `--backup-dir=/home/brownjeon/apps/thekaiwa/shared/backups`(개발자 권고와 같음)를 명시. 복원은 데이터가 파생값이라 필수는 아니다(top-up 재계산 가능) — 그래서 Low.
- **L-2 시험 제목이 낡음**: `task080Backfill.test.ts:243` «apply — 백업이 첫 쓰기보다 먼저 · … **없는 행은 만든다** · …» — 단언(`insert 0`·행 없는 날 그대로 없음)과 정반대 문구. 다음 사람이 규칙을 잘못 읽는다. 권고: 제목을 «없는 행은 만들지 않는다» 로.
- **L-3 사양 문서가 구현·Leader 결정과 어긋남**: `docs/screens.md:14927`(§36-8) 「DAILY 행이 없는 날(…방어)은 `bumpDailySnapshot` 으로 만든다」가 그대로고, 10-21 결정(만들지 않음·«건너뜀»)은 task 이력서(119·122행)와 개발자 기록에만 있다(§36-17-1 에도 없음). QA 가 가이드대로 «행 생성»을 기대하면 오탐한다. 권고(Leader): §36-8 해당 줄과 §36-17-1 에 결정 한 줄 반영.
- **L-4 `longestRunOfDates` 중복 시험이 공허**: `task080Growth.test.ts:82` `['10-01','10-01','10-02']` 는 `if (d === prev) continue` 를 지워도 2 라 통과한다(변이 ML 생존). 운영 영향 0 — `Attendance` 가 `@@unique([userId, date])`(schema:1261)라 중복이 생기지 않는다. 권고: `[a, a+1, a+1, a+2]`(기대 3)로 바꾸면 가드를 증명한다.
- **L-5 낡은 회귀 픽스처**: `tests/prompts/fixtures/ask.json:174-176` THIS_WEEK 범위가 월~일(`2026-10-12`~`10-18`)인 채. `ask@v3` 이 «이번 주(일~토) 10-12~10-18»(10-12 는 월요일) 이라는 모순 글을 만든다. 현재 오프라인 시험은 범위를 명시해 영향 없고 라이브 측정 전용이지만, 다음 PE 측정 때 어긋난다(개발자도 qa/PE 몫으로 남겼다고 기록). 권고: PE/QA 가 다음 측정 전에 `2026-10-11`~`10-17` 로.

**Info**
- I-1 변이 MT(`skipped.rows` 증가 조건) 생존 = **동등 변이**(그 분기는 recount 가 비어 있지 않은 날만 도달 → `added > 0` 이 항상 참).
- I-2 `skillSpark` 의 `Math.round(x*1000)/1000` 은 표시용이라 비교에 안 쓰이나 `.5` 경계 부동소수 오차 가능(영향 ±0.001).
- I-3 `learning/index.ts` 공개 API 에 백필 실행 함수(`runGrowthSkillsBackfill` 등)가 노출된다 — 스크립트가 쓰려면 필요하나 표면이 넓어진다(실사용 라우트에서 import 하지 않는지 grep 으로 확인: 호출처는 스크립트·시험뿐).
- I-4 백필 중간에 한 사용자 트랜잭션이 실패하면 보고 없이 `backfill failed: <name> <code>` 로 끝난다(앞 사용자는 커밋, 뒤는 미실행). 멱등이라 다시 실행하면 이어지나, 운영자는 dry-run 재실행으로 남은 양을 봐야 한다. 부분 롤백(트랜잭션 안 쓰기 중간 실패)은 Prisma 에 맡겼고 시험은 롤백 의미를 모사하지 못한다.
- I-5 개발자 공개 한계 재확인: 세트가 지워진 카드 관측은 `occurredAt` 날짜로 묶여, **배포 후 실시간으로 세트 날짜에 이미 더해진 뒤** 세트를 지우고 백필하면 한 번 더 더해질 수 있다(드묾, 지금은 C 가 전부 0).
- I-6 L2 자료(개발자 보고 재현): 표본 기준을 넘긴 문형·조사 계정은 1개(#1, n=119)이고 그 0단계는 교정 제안 틀림 때문이다(제안을 빼면 short). 규칙 변경이 아니라 표시 정책 결정 사항(Leader·사용자).

### QA(Leader)가 볼 곳 — high_risk_areas
1. **`--apply` 운영 절차**(사용자 승인 뒤에만): dry-run → 승인 → `--backup-dir=<지속 폴더>` 로 apply → 같은 명령 dry-run 재실행에서 `observations to add: 0`·`mismatch cells=0`·`skipped rows=5 observations=235`(같은 값) 확인 → 백업 파일은 복원 가능 확인 뒤 보관/삭제. 적용 전 수치(대상 행 14·더할 391)가 적용 직후 달라졌다면(실시간 쓰기) top-up 이 흡수해야 하므로 `applied.observations ≤ 391` 이 정상.
2. **실시간 쓰기 3경로**(배포 후): 단어 세트 finish(세트 날짜로 묶임, 자정 넘긴 세트는 세트 날짜 행에), 레슨 완료, 역할극 끝냄(대화 유지 1번·판정 없음은 불확실만)이 `skills` 를 **같은 트랜잭션**으로 올리는지 — 한 번 끝낸 뒤 DAILY `data.skills` 를 읽기로 확인.
3. **#78**: 인증 없음 401 · `weeks=5` 400 · `weeks=12` 200 · 주소에 `userId` 를 붙여도 내 데이터 · 백필 전(칸 없음 → 전 축 «아직») 과 후 모두 정상 응답.
4. **질문 탭 «이번 주»**: 일요일에 «이번 주» 칩 → 범위 `일~토`(오늘이 일요일이면 오늘 하루부터 6일 뒤 토요일까지), 프롬프트에 «이번 주(일~토)» 로 들어가는지(로그/트레이스).
5. 달력·성장·질문 탭의 주 시작이 같은지(일요일) — UI 갈래 감사와 교차.
6. 문서 정합: L-3(screens.md §36-8)·L-5(ask.json) 반영 여부.
