---
task_id: task-038
title: "채팅 스모크(006) 6a·6b 날짜 의존 보정 — 새 KST 날의 DAILY 스냅샷 행"
status: done
base_ref: e4f99cf
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-037-json-slip-repair, task-006-chat-correction, task-010b-repetition]
tags:
  - type/task
  - domain/qa
  - domain/testing
aliases:
  - 006 스모크 6b 보정
  - task-038
created: 2026-10-06
updated: 2026-10-06
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
[[task-037-json-slip-repair]] 운영 검증 중 `tests/live/task006-smoke.ts` 의 **6b "점검 전후 행 수 변화 0"** 이 자정(KST) 이후 매번 실패했다(`{"w":0,"s":0,"snap":3,"err":2}` — 시작 때 `snap:2`). 037 이전 코드(커밋 `5a5c25c`)로 띄운 dev 서버에서도 **같은 숫자로 실패**해 037 과 무관함을 확인했다.

**원인(코드 근거)**: 점검(review)·턴이 학습 관측을 기록하면 `learning/observations/index.ts:107` 이 `bumpDailySnapshot(userId, todayKst(), …)` 로 **오늘(KST) DAILY 스냅샷 행을 INSERT(없으면 생성)** 한다(010b 이후 정상 동작). QA 계정(qa-bot)의 DAILY 행은 날짜별로 남아 있어(10-03·10-05) **그 날의 행이 이미 있으면 `snap` 이 안 변해 6b 가 통과**하고, **새 날의 첫 실행들은 행이 생겨 2→3 이 되어 실패**한다. 스모크 cleanup 은 `createdAt ≥ 시작` 행을 지우므로 이후 실행도 같은 이유로 계속 실패한다. 즉 6a·6b 의 `counts()` 가 "오늘 DAILY 행"을 불변으로 가정한 것이 010b 와 어긋난 **스모크 쪽 결함**이다(운영 코드는 정상).

**고칠 것**: `counts()` 의 `snap` 에서 **오늘(KST) DAILY 스냅샷 행을 제외**해 날짜와 무관하게 판정한다(오늘 DAILY 는 점검·턴이 정당하게 만들 수 있다 — 그 외 스냅샷(어제 이전 DAILY·VOCAB_SESSION·EVALUATION·LESSON)의 생성은 계속 불변으로 검사). 같은 가정을 쓰는 다른 `tests/live/*` 스모크가 있으면 같은 방식으로 최소 보정(없으면 기록만).

## 예상 변경 경로
- `tests/live/task006-smoke.ts`(`counts()`·6a·6b 설명 문구) — 필요 시 같은 패턴의 다른 `tests/live/task0*-smoke.ts`
- 운영 코드·화면·DB·프롬프트 변경 없음(테스트 스크립트만).

## 완료 기준 (QA 가 실행으로 확인)
1. **재현 후 해소**: 보정 전(HEAD)에는 dev 서버 3011 에서 006 스모크가 오늘 DAILY 행이 없는 상태에서 6b 실패(41/42)하고, 보정 후에는 **42/42**. 같은 날 연속 2회 실행해도 둘 다 42/42(오늘 DAILY 행 생성·cleanup 여부와 무관).
2. **다른 불변 검사는 약화되지 않음**: 점검 중 **어제 이전 DAILY·VOCAB_SESSION·EVALUATION·LESSON** 스냅샷이 새로 생기면 6a·6b 가 여전히 FAIL(변이 확인 — 예: 점검 후 임의 VOCAB_SESSION 행을 심으면 6b FAIL).
3. KST 날짜 경계 계산이 서버(`dates.todayKst()`)와 같은 값을 쓴다(자정 직전·직후 케이스를 단위로 확인).
4. 운영 코드·화면·DB 무변경(`git diff` 에 `tests/live` 외 없음), 라이브 LLM 호출은 스모크 실행분만(약 12회/실행).

## 관련 과거 이력 요약
- [[task-037-json-slip-repair]]: 운영 006 스모크 41/42 조사 — 1회차 12초 CLI 타임아웃(일시), 2·3회차 6b = 이 task 의 대상. 037 이전 코드 대조 실험 동일 실패.
- [[task-010b-repetition]]: 관측 기록이 `bumpDailySnapshot` 을 호출하도록 한 원인 변경.
- 승인된 교훈: 없음(`/이슈기록 관련` 0건).

## Judge 판정

- [2026-10-06 11:58] intake (Leader 가 `judge.mjs --input /tmp/judge-task-038-intake.json` 직접 실행 ×2 — 같은 결과, `/tmp/judge-task-038-intake.result.json`, `judge-result@2`·engine=jev·fallback 없음) → task_type=**local_fix** · complexity=0.69~0.74 · risk=**R1** · developer_model=**sonnet** · track=standard(light 아님 — `origin:"improvement"` 아님) · demo=none(not_required) · next=assign · roles=developer·reviewer·qa · rule_overrides 없음.
- **Leader 판단**: judge 값 그대로(실호출모델=sonnet). 테스트 스크립트만 바뀌므로 QA 는 가볍게(보정 전 재현 → 보정 후 42/42·연속 2회·변이 1건). PE 호출 없음. Codex 는 R1·한도 미기록 보류 예상(C2 에서 판정).
- `check.mjs init` → `not_required` 기록 완료.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-06 11:54 |

## Developer 기록

- [12:02] 착수. 데모 게이트 대상 아님(테스트 스크립트만, `demo_gate.status=not_required`) — 화면 파일 무수정. 읽은 것: `tests/live/task006-smoke.ts`(`counts()`·6a·6b·cleanup), `src/modules/infra/dates.ts`(`todayKst` — 외부 import 0 이라 스크립트가 그대로 import 가능, task011-smoke 가 `infra/storage` 를 import 하는 선례도 있음), `learning/observations/index.ts:107`·`snapshots/index.ts:127`(`bumpDailySnapshot` = 오늘 DAILY INSERT·`ON DUPLICATE KEY UPDATE`).
- [12:03] **재현(보정 전, HEAD 스크립트 그대로)**: 서버 = 미러 `next dev -H 127.0.0.1 -p 3011`(`APP_ENV=LOCAL`). 시작 시점 qa-bot StatsSnapshot = `DAILY 2026-10-03`·`DAILY 2026-10-05` 2행(오늘 2026-10-06 DAILY 없음 → 재현 조건 충족). 결과 **41/42 — `FAIL 6b 점검 전후 행 수 변화 0 — {"w":0,"s":0,"snap":3,"err":2}`**(6a 는 `snap:2 → snap:2` PASS, 점검이 오늘 DAILY 를 INSERT 해서 6b 에서 2→3). cleanup 이 `createdAt ≥ 시작` 행을 지워 종료 후 다시 2행(10-03·10-05)으로 복귀 — 이후 실행도 같은 이유로 계속 실패하는 구조임을 확인.
- [12:05] **보정**: `tests/live/task006-smoke.ts` — ① `import { todayKst } from '../../src/modules/infra/dates'`(서버와 같은 함수, 동치 재구현 아님) ② `counts()` 의 `snap` = `statsSnapshot.count({ where: { userId, NOT: { kind: 'DAILY', periodKey: { in: dailyDays } } } })`, `dailyDays = [...new Set([START_DAY, todayKst()])]`(START_DAY = 스크립트 시작 시 KST 날짜 — 자정을 넘겨 도는 실행도 시작 날·지금 날 두 날만 제외하고, 그 밖의 어제 이전 DAILY·VOCAB_SESSION·EVALUATION·LESSON 은 계속 센다) ③ 6a·6b check 문구에 `(오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038))` ④ 8a 의 인라인 `new Date(Date.now()+9h)…` 를 `todayKst()` 로 교체(같은 값 — 한 파일에 KST 계산 2종 방지).
- [12:06] KST 경계 단위 확인(스크래치 `scratch/task038/boundary.ts`, 커밋 대상 아님): `todayKst(2026-10-05T14:59:59.999Z)=2026-10-05`·`(15:00:00.000Z)=2026-10-06`·연말 2026-12-31/2027-01-01·윤년 2024-02-29 PASS, 옛 인라인 UTC+9 구현과 서버 함수가 7개 시각 모두 같은 값, 자정 통과 시 `dailyDays` = `["2026-10-05","2026-10-06"]`·같은 날이면 1개 — ALL OK.
- [12:07] 정적 검사: `eslint tests/live/task006-smoke.ts` exit 0(출력 없음), `tsc --noEmit` exit 0(`tests/live/task006-smoke.ts` 가 tsconfig `**/*.ts` 대상임을 `--listFilesOnly` 로 확인).
- [12:08] 다른 `tests/live` 스크립트 점검(`grep -rniE "StatsSnapshot" tests/`): "사용자 전체 StatsSnapshot 행 수(오늘 DAILY 포함) 불변" 가정은 **006 `counts()` 뿐**. 008(`kind:'VOCAB_SESSION'`·세션 id 한정)·010(`LESSON`)·011(`EVALUATION`)·012(2024-0x 격리 달·`allSnapshots()` 전체 행 JSON 비교(232·248행)는 "삭제 API 호출 전/후" 구간뿐이고 오늘 DAILY 는 앞 단계 0b 가 명시적으로 만든 뒤 `dailyBefore` 로 복원 — 날짜 의존 가정 없음)·010b(DAILY 를 `findMany` 로 백업·복원)·012b·010-ui-e2e 는 모두 종류·키 한정이거나 오늘 DAILY 를 명시 백업·복원 → **해당 없음, 무수정**.
- **체크포인트 1** — 완료: 보정 전 재현(41/42)·보정·KST 경계·eslint·tsc / 남은 일: 보정 후 42/42 ×2(사이 2분↑), 변이 확인(스크래치 사본), 전체 `npm test`, 서버 종료·정리 / 다음 첫 행동: 보정 후 1회차 실행 결과 확인(`scratchpad/run1-after.log`, 12:01:42 시작) / 주의점: 변이 사본 `scratch/task038/mut006.ts`·`run-ts.sh` 는 미러 scratch 에만 있음(NFS·커밋 대상 아님) / 미커밋 파일: `tests/live/task006-smoke.ts`(+ 이 이력서).
- [12:19] 보정 후·변이·전체 테스트 완료, 서버·스크래치 정리(아래 증빙).
- **체크포인트 2(최종)** — 완료: 보정 + 재현(41/42) + 보정 후 42/42 ×2 + 변이 5종 + KST 경계 + eslint·tsc·npm test / 남은 일: 없음(Reviewer 인계) / 다음 첫 행동: Reviewer 가 `git diff tests/live/task006-smoke.ts` 확인 후 6a·6b 재실행(오늘 DAILY 없는 상태에서) / 주의점: ① 변이 확인은 **6b 와 같은 `counts()`·같은 비교식을 점검 직후에 별도 probe 로 평가**한 방식(실제 6b check 가 FAIL 로 찍히는 형태는 아님 — 스모크 실행 4회 한도 때문), 심은 행 5종 모두 `snap 2→3` 로 불일치 검출 ② 오늘 DAILY 는 `START_DAY`·`todayKst()` 두 날만 제외하므로 자정 직전 시작 실행도 안전 ③ README `tests/live/README.md` 006 행의 설명은 미수정(문서는 Leader 영역 — 필요하면 "오늘 DAILY 제외" 한 줄 추가 제안) / 미커밋 파일: `tests/live/task006-smoke.ts`(+ 이 이력서). `CLAUDE.md`·`improvements/items/IMP-0024·0025` 는 다른 세션 변경 — 손대지 않음.

### 실행 증빙

| # | 명령 / 상황 | 결과(원 출력) |
|---|---|---|
| 1 | 보정 **전**(HEAD 스크립트), 시작 때 qa-bot StatsSnapshot = `DAILY 2026-10-03`·`DAILY 2026-10-05`(오늘 없음). `bash tests/live/task006-smoke.sh 3011`(12:00경 시작, 서버 = 미러 `next dev -H 127.0.0.1 -p 3011`, APP_ENV=LOCAL) | `PASS 6a … — {"w":0,"s":0,"snap":2,"err":2} → {"w":0,"s":0,"snap":2,"err":2}` · **`FAIL 6b 점검 전후 행 수 변화 0 — {"w":0,"s":0,"snap":3,"err":2}`** · `결과: 41/42 PASS · 턴 p50=4411ms` · `실패: 6b 점검 전후 행 수 변화 0` · `(QA 데이터 정리 완료)` — **재현됨** |
| 2 | 보정 **후** 1회차 `bash tests/live/task006-smoke.sh 3011`(12:01:42 시작, 시작 때 오늘 DAILY 없음 — 실행 1 의 cleanup 이 지운 상태) | `PASS 6a 턴 전후 …변화 0 (오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":2,"err":2} → {"w":0,"s":0,"snap":2,"err":2}` · `PASS 6b 점검 전후 행 수 변화 0 (…) — {"w":0,"s":0,"snap":2,"err":2}` · **`결과: 42/42 PASS · 턴 p50=4643ms`** |
| 3 | 보정 후 2회차(12:08:00 시작 — 1회차 종료 ≈12:05:40 로부터 2분 20초 뒤, 시작 때 오늘 DAILY 없음) | 6a·6b 같은 `PASS`(`snap:2 → snap:2`) · **`결과: 42/42 PASS · 턴 p50=4467ms`** |
| 4 | 변이 사본 `scratch/task038/mut006.ts`(미러 scratch 전용 — 6b 직후 `statsSnapshot.create` → 실제 `counts()`·`JSON.stringify(probe) !== JSON.stringify(before)` 평가 → 삭제), 12:15:00 시작 | `PASS 6a/6b`(원래 검사 통과) · `PASS MUT[VOCAB_SESSION] … — {"w":0,"s":0,"snap":3,"err":2}` · `PASS MUT[EVALUATION] … snap:3` · `PASS MUT[LESSON] … snap:3` · **`PASS MUT[이틀 전 DAILY](DAILY/2026-10-04) … snap:3`** · **`PASS MUT[30일 전 DAILY](DAILY/2026-09-06) … snap:3`** · `PASS MUT[대조] 심은 행을 지우면 다시 6b 비교가 같아야 정상 — snap:2` · `결과: 48/48 PASS`(MUT 의 PASS = "불일치가 검출됨"). 어제 DAILY(2026-10-05)는 qa-bot 에 이미 있는 행이라 심을 수 없어(유니크) 이틀 전·30일 전 DAILY 로 대체 |
| 5 | KST 경계(`scratch/task038/boundary.ts`) | `PASS 2026-10-05T14:59:59.999Z -> 2026-10-05` · `PASS 2026-10-05T15:00:00.000Z -> 2026-10-06` · 연말·윤년·옛 인라인 UTC+9 와 동일 값 14건 PASS · `midnight-cross set = ["2026-10-05","2026-10-06"]` · `same-day set = ["2026-10-05"]` · `ALL OK` |
| 6 | `node node_modules/eslint/bin/eslint.js tests/live/task006-smoke.ts`(미러) | 출력 없음, exit 0 |
| 7 | `npm run typecheck` | exit 0(출력 없음 — `tsc --noEmit`) |
| 8 | `npm run lint`(전체) | exit 1 — **내 변경과 무관**: 오류 2건은 미러 전용 `~/.node-local/thekaiwa/tmp-pe/t49.ts`(NFS 저장소에 없음, prompt-engineer 임시 파일 — `no-explicit-any` ×2)이고 나머지는 기존 `react-hooks/set-state-in-effect` 등 warning 7건. `tests/live/task006-smoke.ts` 는 0건(6번) |
| 9 | `npm test`(전체) | `# tests 1500 · # pass 1499 · # fail 0 · # skipped 1` · `# duration_ms 55104.634642` · exit 0 — 직전 1500/1499/1 과 동일 |
| 10 | 정리 | dev 서버: `ss -ltnp 'sport = :3011'` → next-server PID 1156311(부모 node 1156299)를 `kill` 로 종료, `ss -ltn \| grep -E ':(3011\|3012\|8197\|8198)'` 비어 있음. 운영 3010·8100 은 그대로 리슨(무접촉). qa-bot StatsSnapshot = `DAILY 2026-10-03`·`DAILY 2026-10-05` 2행(시작 전과 동일), qa-bot2 0행 — 변이 행·오늘 DAILY 잔존 0 |

## Reviewer 기록 (REV-111, 2026-10-06, standard 트랙 · Read 전용)

> 코드 수정 0. 스모크 자체(Claude CLI·dev 서버·DB 접속)는 실행하지 않았다 — NAS MariaDB 가 개발·운영 공유라 DB 무접촉(Prisma `NOT` 의미는 문서 규칙 + 개발자 실행 증빙의 `snap` 수치로 교차 확인). 운영(`/home/brownjeon/apps/thekaiwa`)·pm2·운영 포트 무접촉. 작업 트리 `CLAUDE.md` 변경은 다른 세션 것이라 감사 제외. Codex 검토: 이 task 는 아직 C2 판정 전(이력서에 `## Codex 검토` 없음) — 판정 대상 지적 없음.

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2 · Info 4. `native_change: false`(`git diff --stat` = `tests/live/task006-smoke.ts` +11/-4 뿐, 운영 코드·화면·DB·프롬프트·plugins·android 0). 데모 게이트: 화면 변경 없음 — `check.mjs check` → `DEMO_GATE_PASSED`(status not_required). Sonnet developer 반려 횟수 0(이번이 첫 감사) → Opus 승격 권고 없음. light 승격 불필요(변경 1파일·마이그레이션·네이티브·인증 변경 없음, 처음부터 standard).

### 중점별 결론

1. **보정의 정확성 — 충족.** `NOT: { kind: 'DAILY', periodKey: { in: dailyDays } }`(`task006-smoke.ts:132`)는 Prisma 에서 객체 안 조건이 AND 로 묶인 뒤 부정되는 형태 = `NOT (kind='DAILY' AND periodKey IN (…))` 이다. 즉 "DAILY 이면서 그 두 날짜 중 하나"인 행만 빠지고, 어제 이전 DAILY·`VOCAB_SESSION`·`EVALUATION`·`LESSON` 은 계속 센다. 교차 증거: 개발자 실행 증빙 #2·#3 에서 시작 때 qa-bot 에 DAILY 2행(10-03·10-05, 오늘 아님)이 있었는데 `snap:2` — OR 의미(`kind≠DAILY AND periodKey∉…`)였다면 둘 다 빠져 0 이었을 것 — 이고, 변이 #4 에서 이틀 전·30일 전 DAILY 를 심으면 `snap:3` 으로 검출. `StatsSnapshot.kind`·`periodKey` 모두 NOT NULL(`prisma/schema.prisma:1263-1266`)이라 `NOT(…)` 의 NULL 삼치논리 함정도 없다. **`START_DAY ∪ todayKst()` 는 필요하고 과하지 않다**: 스모크는 3~5분 걸리고(README) 자정을 넘기면 점검·턴이 새 날 DAILY 를 만들 수 있다 — `Set` 한 줄·최대 2값이라 비용 0, 같은 날이면 1값(`dailyDays` 단위 확인은 개발자 증빙 #5). 반대로 서버가 UTC 날짜를 잘못 쓰는 버그(KST 00~09시에 어제 키)는 두 날 집합에 안 들어 계속 FAIL 로 잡히는 부수 이득도 있다.
2. **날짜 계산 일치 — 충족.** 서버의 DAILY 쓰기 호출부는 모두 `dates.todayKst()`(`observations/index.ts:107` `opts.date ?? dates.todayKst()`, `studyLog/index.ts:88` `recordCorrectionAccepted`) 또는 원천 기록과 같은 날(`recordAcceptedChatLog` 의 `log.date` = `entry.date ?? dates.todayKst()`, `sessions.ts:555`·`lifecycle.ts:169` — 이 둘은 006 의 턴·점검 경로가 아님). 006 의 턴(`turns/route.ts:34`·`correctionProposedHook`)·점검(`observations/corrections.ts:44`)은 `opts.date` 없이 호출 → **오늘(KST) 키만** 만든다. 스크립트는 같은 `todayKst`(`src/modules/infra/dates.ts:66`, 외부 import 0 이라 env 검증 등 부수 효과 없음)를 import 한다. import 경로 `'../../src/modules/infra/dates'` 는 같은 폴더 `task011-smoke.ts:15`(`infra/storage`)·`task012b-smoke.ts:19-21` 의 상대 경로 관례와 같다. 미러에서 해석 확인: `tsc --noEmit` exit 0 + 개발자 실행 2회(42/42)가 tsx 런타임 해석까지 증명. 경계 재계산(미러, 메모리 내 스크립트): `2026-10-05T14:59:59.999Z→10-05`·`15:00:00.000Z→10-06`·연말(12-31→2027-01-01)·윤년(2024-02-29→03-01) 등 7개 시각 모두 **옛 인라인 UTC+9 식과 `todayKst()` 가 동일**(`all-equal true`). 단위 테스트에도 같은 경계가 있다(`learning/__tests__/task012.test.ts:95-96`).
3. **검사 약화 여부 — 의미 있는 약화 없음.** 6a·6b 가 막으려던 WordEntry·StudyLog·LearnerErrorStat 불변과 "오늘 DAILY 이외 스냅샷 불변"은 그대로이고(`counts()` 의 w·s·err 행은 무변경, `before` 는 턴 전 `:143`), 6a·6b 둘 다 같은 `counts()` 를 쓴다(사용처 `:143·:217·:239` 3곳뿐). 8a 부작용 없음: 8a 의 `today` 교체(`:295`)는 같은 값이고 검사식(`chatTurns ≥ 10 && > before`)은 무변경, 8a 는 `counts()` 를 쓰지 않는다. cleanup(`:404-420`, 스냅샷 삭제 `:416`)은 무변경 — `statsSnapshot.deleteMany({ createdAt ≥ startedAt })` 가 오늘 DAILY 를 새로 만들었으면 지우고 이미 있던 행은 둔다. 다만 아래 **L-1**(오늘 DAILY *내용* 가드는 원래도 없었음)을 기록한다.
4. **정리·부작용 — 변경 없음.** 스크립트가 심는 데이터·cleanup 경로 diff 0. 개발자 증빙 #10: qa-bot 시작 전/후 `DAILY 2026-10-03`·`DAILY 2026-10-05` 2행 동일, qa-bot2 0행, 변이 행·오늘 DAILY 잔존 0. 이미 오늘 DAILY 행이 있던 날 006 이 그 행의 `data`(예: 8a 채택의 `chatTurns`, 관측 `observations.total`)를 올리고 되돌리지 않는 것은 **변경 전부터의 동작**(**I-1**)이며 이번 변경과 무관.
5. **다른 스크립트 — 개발자 판단에 동의.** `grep -rniE statsSnapshot tests scripts -l` = 008·012·010·010-ui-e2e·011·006·012b·010b·README 뿐. 직접 읽은 결과: 008(`kind:'VOCAB_SESSION'`·`periodKey` 세션 id 한정, DAILY 는 오늘 키 `findUnique`), 010(`LESSON` 한정·심은 행 id 삭제, DAILY 는 키 조회·백업 복원 `:436-437`), 011(`kind:'EVALUATION'` 한정 `:416`, DAILY 복원 `:453`), 012(`allSnapshots` 전체 행 비교 `:96`은 삭제 API 호출 구간 `:232-248` 뿐이고 오늘 DAILY 는 앞 단계 0b 가 만든 뒤 `dailyBefore` 로 복원 `:286-287`), 012b(DAILY `findUnique` 백업 복원 `:623-624`), 010b(`DAILY` 를 `findMany` 로 백업·복원 `:139·:177`, 새 행은 `created()` 로 삭제), 010-ui-e2e(`dailyBefore` 복원 `:544-545`). **"사용자 전체 StatsSnapshot 행 수(오늘 DAILY 포함) 불변" 가정은 006 `counts()` 뿐**이라 보정 대상 외 파일 무수정이 맞다. (003x·005·007 스모크는 `StatsSnapshot` 을 아예 안 만진다.)
6. **문서 — 한 줄 추가 권고(Leader 영역).** `tests/live/README.md:15` 006 행에 "6a·6b 의 StatsSnapshot 수는 오늘(KST) DAILY 행을 뺀다 — 점검·턴이 정당하게 만든다(task-038)" 정도의 한 문장을 넣는 것을 권한다. 이유: 이 스크립트가 다음 사람에게 "왜 날짜마다 6b 가 흔들렸나"를 다시 조사시키지 않게 하는 유일한 외부 기록이고(task-037 에서 이미 한 번 조사 비용이 들었다), README 가 8e 처럼 개별 항목 의미를 이미 적어 두는 문서다.

### 지적 표 (근거 있는 것만)

| ID | 심각도 | 위치 | 내용·재현 | 권고 |
|---|---|---|---|---|
| L-1 | LOW(비차단) | `tests/live/task006-smoke.ts:127-137` `counts()`·6a `:218`·6b `:240` | 오늘 DAILY 를 행 수에서 빼면서 **턴·점검이 오늘 DAILY 의 "채택 계열" 필드(`chatTurns`·`talkTurns`·`corrections.accepted`·`words`)를 부당하게 올리는 회귀**는 6a·6b 어디서도 잡히지 않는다. 변경 전에는 새 날에만 "행 생성"으로 우연히 걸렸고(그래서 날짜 의존 오탐이 났다), 오늘 행이 이미 있는 날엔 원래도 못 잡던 사각이다 — 즉 이번 변경이 실효 커버리지를 낮춘 것은 아니고 **새 날에도 그 사각이 똑같아진 것**. 8a(`:296-301`)는 채택 뒤 `chatTurns` 증가만 단언하고 채택 *전* 불변은 보지 않는다. 관련 경로: 턴은 `observations` 만 증가(`turns/route.ts:34`·`observations/index.ts:107`), 점검도 `recordObservations`(`corrections.ts:44`)뿐이라 지금 코드는 정상. | 선택 후속: 6a 직후 오늘 DAILY `data` 의 `chatTurns`·`talkTurns`·`corrections.accepted` 가 `before` 와 같음을 한 줄 단언(필드 화이트리스트 — `observations` 는 제외). 이번 task 범위 밖이라 정리 backlog 로 충분. |
| L-2 | LOW(미관) | `tests/live/task006-smoke.ts:125·218·240` | `DAILY_NOTE`(약 60자)를 **check id 문자열에 박아** 6a·6b 의 PASS 줄이 길어지고, 실패 시 `실패: …`(`:399` `failed.map((f) => f.id)`)에도 그 문구가 그대로 찍힌다. id 로 grep 하는 코드는 없다(`grep "6b 점검 전후"` 스크립트 0건 — task-006 이력서의 사람용 인용뿐). 동작 영향 없음. | 선택: 문구를 id 가 아니라 `note` 인자로 옮겨 id 를 `6a 턴 전후 …변화 0`·`6b 점검 전후 행 수 변화 0` 그대로 유지(과거 이력서·QA 표와 id 일치). |
| I-1 | INFO | `task006-smoke.ts:404-420` cleanup(`:416`) | 오늘 DAILY 행이 시작 전에 이미 있던 날, 006 이 올린 그 행의 `data`(`chatTurns`·`observations` 등)는 cleanup(`createdAt ≥ startedAt` 삭제)이 되돌리지 않는다 — **변경 전부터의 동작**이고 QA 계정 한정. 010·011·012b·010-ui-e2e 는 백업·복원하는 것과 비대칭이지만 6a·6b 판정은 오늘 DAILY 를 빼므로 결정성에 영향 없음. | 조치 불필요(원하면 정리 backlog 에서 010 계열처럼 백업·복원 통일). |
| I-2 | INFO | 개발자 증빙 #4 | 변이 확인이 "실제 6b FAIL 출력"이 아니라 **같은 `counts()`·같은 비교식을 점검 직후 별도 probe 로 평가**한 방식이다(개발자가 스스로 명시). 6b 의 판정식(`JSON.stringify(afterReview) === JSON.stringify(before)`)이 `counts()` 출력 전체 비교라 probe 와 동치임을 코드로 확인 — 수용. | QA 가 선택적으로 심은 행 1개(비-오늘 스냅샷)로 실제 6b FAIL 을 1회 확인하면 확정적(필수 아님). |
| I-3 | INFO | `task006-smoke.ts:296` 8a | `today` 가 이제 서버와 **같은 함수**라 8a 는 `todayKst()` 자체의 오류를 못 잡는 비독립 오라클이 된다(옛 인라인 식은 독립 구현이었다). `todayKst` 는 `task012.test.ts:95-96` 에서 경계 단위 검증되고 있고 한 파일에 KST 계산이 2종 있던 중복을 없앤 이득이 더 커서 수용. | 조치 불필요. |
| I-4 | INFO | 재실행 | `START_DAY`(`:126`)는 모듈 로드 시 한 번 계산 — `startedAt`(`:20`)과 같은 로드 구간이라 둘 사이 자정 통과는 비현실적. 시작 때 미래 날짜 DAILY 가 이미 있는 경우(before 에선 셈·after 에선 제외)만 이론상 오탐인데 cleanup 이 항상 지우므로 실사용에서 발생하지 않는다. | 조치 불필요. |

### 재실행 수치(미러 `~/.node-local/thekaiwa`, `scripts/sync-local.sh` 후 `diff -q` 로 NFS 원본과 동일 확인)
- `node node_modules/eslint/bin/eslint.js tests/live/task006-smoke.ts` → 출력 없음, **exit 0**
- `npm run typecheck`(NFS 에서 실행 — sync 후 `tsc --noEmit`) → **exit 0**
- `npm test`(전체) → `# tests 1500 · # pass 1499 · # fail 0 · # skipped 1` · `# duration_ms 52888` · **exit 0** (개발자 보고 1500/1499/1 과 동일)
- KST 경계(메모리 내 스크립트, DB·서버 무접촉): 7개 시각 `todayKst()` == 옛 인라인 UTC+9 식 → `all-equal true`
- `git diff --stat`(CLAUDE.md 제외) → `tests/live/task006-smoke.ts | 15 +++++++++++----`(11+/4-), 그 밖의 비-vault 변경 0
- 스모크(Claude CLI 호출)·dev 서버·DB 쿼리는 **실행하지 않음**(QA 몫)

### QA 에 넘길 high_risk_areas
1. **오늘 DAILY 행이 없는 날의 6a·6b**(이 task 의 재현 조건): 시작 전 qa-bot DAILY 가 비-오늘 행(10-03·10-05)뿐일 때 `bash tests/live/task006-smoke.sh 3011` → 6a·6b `PASS`·**42/42**. 같은 날 한 번 더(앞 실행 cleanup 이 오늘 DAILY 를 지운 상태, 2분↑ 간격) → 42/42. 개발자 증빙 #2·#3 의 독립 재현 1~2회면 충분.
2. **"그 밖의 스냅샷은 계속 센다" 실증**: 점검 직후 비-오늘 스냅샷 1행(`VOCAB_SESSION` 또는 이틀 전 DAILY)을 심고 `counts()` 가 `snap` +1 로 불일치를 내는지(필요하면 스크래치 사본에서 6b 직전에 심어 **실제 6b FAIL** 줄 1회 — 심은 행은 즉시 삭제, I-2).
3. **데이터 원복**: 실행 후 qa-bot `StatsSnapshot` 이 시작 전과 같은 행 집합(오늘 DAILY 가 새로 생겼다면 cleanup 으로 삭제됨), qa-bot2 0행 — 변이 행·잔존 0(`createdAt ≥ 시작` 삭제 경로는 무변경이지만 보정이 `snap` 판정만 바꿨으니 확인).
4. **변경 범위**: `git diff --stat` = `tests/live/task006-smoke.ts` 한 파일, 운영 코드·화면·DB·프롬프트 0, dev 서버·운영 포트 3010·8100 리스너 상태 유지, 라이브 LLM 호출은 스모크 실행분만.
5. 자정(KST) 통과 실행은 라이브 재현이 비현실적 → 단위(`dailyDays` 2값 집합·경계 7점 동치)로 갈음(이미 개발자·리뷰어 확인).

### 후속(비차단)
- L-1(오늘 DAILY 내용 가드)·L-2(id 에서 문구 분리)는 정리 backlog 후보. 보완이 들어가면 Reviewer 부터 재순환(스크립트 한 파일이라 가벼움).
- README 006 행 한 줄 추가(위 6번) — Leader 가 문서 커밋에 포함.

## QA 기록 (QA, 2026-10-06, standard 트랙 · 코드 수정 0)

**판정: PASS (Critical 0 · High 0 · Medium 0 · Low 0 — 결함 0건)** · `src/**`·`prisma/**`·`speech/**`·`plugins/**`·`tests/live/task006-smoke.ts` 수정 0(QA 가 만진 저장소 파일은 `tests/live/README.md` 006 행 한 줄 추가뿐 — Leader 승인) · 네이티브·마이그레이션·화면·persona 무변경(`git diff --name-only -- src prisma speech plugins android capacitor.config.ts .claude/agents` 출력 없음) · 데모 게이트 `not_required`(화면 변경 0).
**NOT_VERIFIED**: 보정 **전**(HEAD) 스크립트의 재현(완료 기준 1 전반)은 QA 가 다시 돌리지 않았다 — Claude CLI 한도 절약(범위 지시)·개발자 증빙 #1(41/42)을 신뢰하되, **오늘 DAILY 행이 실제로 생겨 제외 대상이 됐음**은 변이 실행의 MUT-INFO 로 직접 확인했다(아래). 자정(KST) 통과 실행은 라이브 재현 비현실적 → 단위(`dailyDays` 2값 집합·경계 7점)로 갈음. 화면·실기기 항목은 해당 없음.

### 환경·재현 조건
- 코드 = NFS 작업본(미커밋) — `scripts/sync-local.sh` 후 `diff -q` NFS↔미러 `tests/live/task006-smoke.ts` 동일. `APP_ENV=LOCAL`, dev 서버 = 미러 `~/.node-local/thekaiwa` 에서 `next dev -H 127.0.0.1 -p 3011`(PID 파일로만 종료). `SMOKE_ENV` 미설정. 운영 `/home/brownjeon/apps/thekaiwa`·pm2·3010·8100·PRODUCTION DB 무접촉.
- **Claude CLI 호출 수**: 사전 계산 3회 실행 × README "약 16회" = ≈48회 → 실제 dev 서버 로그 `[claudeCli] 완료` **51회**(실행당 17). 앱 자체 분당 턴 제한(3b·3c) 429 는 실행당 3회씩(HTTP 로그의 `POST …/turns 429` 9줄) — CLI 한도·429 0건. 실행 간격: 1회차 종료 12:35:03 → 2회차 시작 12:37:27(2분 24초) → 2회차 종료 12:41:35 → 변이 시작 12:43:52(2분 17초).
- 시작 전 기준선(읽기 전용, 스크래치 `snaplist.ts`): qa-bot StatsSnapshot = `DAILY/2026-10-03`·`DAILY/2026-10-05` 2행, **오늘(2026-10-06) DAILY 없음**(= 이 task 의 재현 조건) · wordEntry 0 · studyLog 0 · learnerErrorStat 2 · qa-bot2 StatsSnapshot 0행. 세 실행 각각 시작 직전에 같은 목록을 확인했다(1회차 12:30:43·2회차 12:37:27·변이 12:43:52 — 매번 동일 2행).

### 항목별 판정

| # | 항목 | 판정 | 근거(핵심) |
|---|---|---|---|
| 1 | 정적 | **PASS** | `eslint tests/live/task006-smoke.ts`(미러) 출력 없음·exit 0 · `npm run typecheck` exit 0 · 전체 `npm test` **`# tests 1500 · # pass 1499 · # fail 0 · # skipped 1`**(skip 1 = 기존) · `git diff --stat -- . ':!CLAUDE.md' ':!agent-vault'` = `tests/live/README.md | 2 +-` · `tests/live/task006-smoke.ts | 15 +++++++++++----` 두 파일뿐(README 는 QA 추가분) |
| 2 | 날짜 경계 | **PASS** | 스크래치 `boundary.ts` — `todayKst()` 를 **독립 오라클(`Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'})`)** 과 같이 비교: `2026-10-05T14:59:59.999Z→2026-10-05`·`15:00:00.000Z→2026-10-06`·`2026-12-31T14:59:59.999Z→2026-12-31`·`15:00:00.000Z→2027-01-01`·`2028-02-28T15:00:00.000Z→2028-02-29`(윤년)·`2028-02-29T15:00:00.000Z→2028-03-01`·`2027-02-28T15:00:00.000Z→2027-03-01` 7/7 서버 함수·오라클·기대값 일치, `dailyDays` 집합 같은 날 1값·자정 통과 2값(`["2026-10-05","2026-10-06"]`) |
| 3 | 보정 후 42/42 ×2 | **PASS** | 1회차 **42/42**(p50 4655ms)·2회차 **42/42**(p50 4337ms) — 둘 다 시작 때 오늘 DAILY 행 없음. 6a·6b 둘 다 `snap:2 → snap:2`/`snap:2`로 PASS(아래 원 출력). 8a `chatTurns=11` PASS. 종료 후 qa-bot StatsSnapshot = 시작 전 2행 동일(createdAt·updatedAt 값까지 동일), qa-bot2 0행 |
| 4 | **6b 가 실제 FAIL 하는 변이(핵심)** | **PASS** | 스크래치 사본(저장소·미러 원본 무수정)에서 `5d` 직후·`6b` 직전에 `statsSnapshot.create({kind:'DAILY',periodKey:'2026-10-04'})`(이틀 전 DAILY) 한 줄 삽입 → **`FAIL 6b … {"w":0,"s":0,"snap":3,"err":2}` · `결과: 41/42 PASS` · `실패: 6b …`**(6a 는 PASS — 변이를 6a 뒤에 심었으므로). 같은 시점 관찰: 6b 시점 qa-bot StatsSnapshot **전체 4행** = `DAILY/2026-10-03, DAILY/2026-10-04(변이), DAILY/2026-10-05, DAILY/2026-10-06(점검·턴이 만든 오늘 행)` 인데 `counts().snap=3` → **오늘 행은 제외되고(4→3) 이틀 전 변이 행은 센다(2→3)** = 보정이 재현 조건의 행을 실제로 빼면서도 비-오늘 스냅샷 생성은 계속 검출함을 직접 확인 |
| 5 | README 한 줄 | **PASS** | `tests/live/README.md` 006 행(15행) 끝에 "6a·6b 의 StatsSnapshot 수는 오늘(KST) DAILY 행을 뺀다(task-038 — 010b `bumpDailySnapshot` 이 새 날의 첫 점검·턴에서 오늘 행을 만든다)." 한 문장만 추가 — `git diff` 변경 줄 `+1/-1`(해당 행 한 줄), 다른 행 무수정 |
| 6 | 영향 없음·정리 | **PASS** | 아래 정리·남은 데이터 참조 |

### 결함·관찰
**결함 0건.** 비차단 관찰:
- **O-1 (README 문구)**: README 006 행의 "Claude CLI 약 16회" 는 이번 실측에서 실행당 17회였다(경계 오차 — 문구 수정은 이번 범위 밖, Leader 판단).
- **O-2 (Reviewer 후속 L-1·L-2 재확인)**: 보정은 "오늘 DAILY 행의 *수*"를 뺀 것이라 점검·턴이 오늘 DAILY 의 채택 계열 필드(`chatTurns` 등)를 부당하게 올리는 회귀는 6a·6b 가 못 잡는다(Reviewer L-1 과 동일 — 이번 변경이 낮춘 커버리지 아님). check id 에 문구가 박힌 점(L-2)도 그대로 — 차단 아님.
- **O-3 (QA 범위)**: 6a 에 대한 별도 변이는 안 했다(6a 는 같은 `counts()`·같은 비교식 — 6b 변이로 갈음, 코드 `task006-smoke.ts` 의 `counts()` 사용처 3곳).

### 정리·남은 데이터
- dev 서버 3011: `ss -ltnp 'sport = :3011'` → next-server PID 1235319(부모 node 1235303)를 PID 로만 `kill`, `ss -ltn | grep -E ':(3011|3012|8197|8198)'` **출력 없음**(rc 1). 운영 3010(127.0.0.1)·8100 리스너는 그대로 유지. `~/.node-local/thekaiwa*` 복제본은 이번에 만들지 않음(기존 `thekaiwa-dev-030`·`-head036` 등은 다른 세션 것 — 무접촉).
- LOCAL 에 남은 QA 데이터: 세 실행 모두 스모크 cleanup(`createdAt ≥ 시작` 삭제)으로 복귀 — 종료 후 qa-bot StatsSnapshot = 시작 전 2행(DAILY 10-03·10-05) 동일, 오늘 DAILY·변이 행 잔존 0, qa-bot2 0행, wordEntry·studyLog 0, learnerErrorStat 2(시작 전과 동일). **변이 행(10-04)은 스모크 cleanup 이 지웠고 `snaplist` 로 부재 재확인**.
- 스크래치: 미러 `~/.node-local/thekaiwa/scratch/qa038/`(boundary.ts·snaplist.ts·task006-smoke-mut.ts·run-mut.sh — 커밋 대상 아님)와 `/tmp/qa-artifacts/TheKaiwa/task-038/` 로그 — 이력서 기록 뒤 파일 단위로 삭제(아래 `산출물 정리` 줄 참조).

### 명령과 원 출력

```
$ (미러) node node_modules/eslint/bin/eslint.js tests/live/task006-smoke.ts ; echo "eslint exit=$?"
eslint exit=0
$ npm run typecheck        → typecheck exit=0 (tsc --noEmit, 출력 없음)
$ npm test                 → npm test exit=0
# tests 1500 · # suites 0 · # pass 1499 · # fail 0 · # cancelled 0 · # skipped 1 · # todo 0 · # duration_ms 53055.147632

$ node --import tsx scratch/qa038/boundary.ts
PASS 2026-10-05T14:59:59.999Z -> todayKst=2026-10-05 expected=2026-10-05 intl-oracle=2026-10-05
PASS 2026-10-05T15:00:00.000Z -> todayKst=2026-10-06 expected=2026-10-06 intl-oracle=2026-10-06
PASS 2026-12-31T14:59:59.999Z -> todayKst=2026-12-31 expected=2026-12-31 intl-oracle=2026-12-31
PASS 2026-12-31T15:00:00.000Z -> todayKst=2027-01-01 expected=2027-01-01 intl-oracle=2027-01-01
PASS 2028-02-28T15:00:00.000Z -> todayKst=2028-02-29 expected=2028-02-29 intl-oracle=2028-02-29
PASS 2028-02-29T15:00:00.000Z -> todayKst=2028-03-01 expected=2028-03-01 intl-oracle=2028-03-01
PASS 2027-02-28T15:00:00.000Z -> todayKst=2027-03-01 expected=2027-03-01 intl-oracle=2027-03-01
same-day set ["2026-10-06"] midnight-cross set ["2026-10-05","2026-10-06"]
ALL OK

$ node --env-file=.env --import tsx scratch/qa038/snaplist.ts   (기준선·각 실행 직전 — 동일)
todayKst = 2026-10-06 · now = 2026-10-06T03:30:43.520Z
qa-bot@thekaiwa.test StatsSnapshot rows=2
   DAILY/2026-10-03 createdAt=2026-10-03T09:38:17.454Z updatedAt=2026-10-03T14:10:41.707Z
   DAILY/2026-10-05 createdAt=2026-10-05T00:56:14.516Z updatedAt=2026-10-05T14:56:48.202Z
   wordEntry=0 studyLog=0 learnerErrorStat=2
qa-bot2@thekaiwa.test StatsSnapshot rows=0
   wordEntry=0 studyLog=0 learnerErrorStat=0

$ bash tests/live/task006-smoke.sh 3011      (1회차 12:31:03~12:35:03)
PASS 6a 턴 전후 WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat 변화 0 (오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":2,"err":2} → {"w":0,"s":0,"snap":2,"err":2}
PASS 6b 점검 전후 행 수 변화 0 (오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":2,"err":2}
PASS 8a ADD_STUDY_LOG 채택 → StudyLog(ACCEPTED, CHAT) + DAILY 증가 — status=200 chatTurns=11
결과: 42/42 PASS · 턴 p50=4655ms
(QA 데이터 정리 완료)
(QA 쿠키 삭제)

$ bash tests/live/task006-smoke.sh 3011      (2회차 12:37:27~12:41:35, 시작 전 오늘 DAILY 없음 — pre2 확인)
PASS 6a 턴 전후 … 변화 0 (오늘 DAILY 행은 …제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":2,"err":2} → {"w":0,"s":0,"snap":2,"err":2}
PASS 6b 점검 전후 행 수 변화 0 (오늘 DAILY 행은 …제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":2,"err":2}
PASS 8a ADD_STUDY_LOG 채택 → StudyLog(ACCEPTED, CHAT) + DAILY 증가 — status=200 chatTurns=11
결과: 42/42 PASS · 턴 p50=4337ms
(QA 데이터 정리 완료)
(QA 쿠키 삭제)

$ bash scratch/qa038/run-mut.sh 3011         (변이 12:43:52~12:47:46 — 5d 직후 DAILY/2026-10-04 심음)
PASS 6a 턴 전후 … 변화 0 (…) — {"w":0,"s":0,"snap":2,"err":2} → {"w":0,"s":0,"snap":2,"err":2}
FAIL 6b 점검 전후 행 수 변화 0 (오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038)) — {"w":0,"s":0,"snap":3,"err":2}
  MUT-INFO 6b 시점 qa-bot StatsSnapshot 전체 4행: DAILY/2026-10-03, DAILY/2026-10-04, DAILY/2026-10-05, DAILY/2026-10-06 · counts().snap=3
결과: 41/42 PASS · 턴 p50=4665ms
실패: 6b 점검 전후 행 수 변화 0 (오늘 DAILY 행은 점검·턴이 정당하게 만들 수 있어 제외(010b bumpDailySnapshot — task-038))
(QA 데이터 정리 완료)
(QA 쿠키 삭제)

$ snaplist (변이 후·종료 후)  → qa-bot StatsSnapshot rows=2 (DAILY/2026-10-03·DAILY/2026-10-05, createdAt·updatedAt 시작 전과 동일), wordEntry=0 studyLog=0 learnerErrorStat=2, qa-bot2 rows=0
$ kill <dev PID>; ss -ltn | grep -E ':(3011|3012|8197|8198)'  → 출력 없음; ss -ltn | grep -E ':(3010|8100)\b' → 127.0.0.1:3010·127.0.0.1:8100 LISTEN 유지
```

### 최종 인계
- **verdict=PASS · 결함 0건** — Leader 로 보고(이 task 는 테스트 스크립트·문서뿐이라 배포 대상 아님 → deployer 인계 없음, `reinstall_required: false`). 미커밋 파일: `tests/live/task006-smoke.ts`(+11/-4, 개발자)·`tests/live/README.md`(+1/-1, QA — Leader 문서 커밋에 포함).

**산출물 정리: 21개 삭제**(`/tmp/qa-artifacts/TheKaiwa/task-038/` 로그·마커·PID 파일 + 미러 `scratch/qa038/` 4개(`boundary.ts`·`snaplist.ts`·`task006-smoke-mut.ts`·`run-mut.sh`) + `/tmp/qa038-*.log` 2개 — 파일 단위 `rm -f`·`rmdir`, 스크린샷 0개(화면 변경 없음)). **프로세스 정리: dev 3011 종료·포트 비움**(`ss -ltn | grep -E ':(3011|3012|8197|8198)'` 출력 없음, 운영 3010·8100 유지).

## 최종 요약 (Leader, 2026-10-06)

**한 일** — 채팅 라이브 스모크 `tests/live/task006-smoke.ts` 의 6a·6b("턴·점검 전후 WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat 변화 0")가 **오늘(KST) DAILY 스냅샷 행을 불변으로 가정**해, 새 날의 첫 점검·턴이 오늘 행을 만들면(`learning/observations/index.ts:107` `bumpDailySnapshot(todayKst())` — 010b 이후 정상 동작) 자정 이후 매번 `snap 2→3` 으로 실패하던 결함(task-037 운영 검증 중 발견·037 이전 코드 대조 실험으로 037 과 무관 확인)을 고쳤다. `counts()` 의 `snap` 에서 **"DAILY 이면서 시작일 또는 오늘(KST)인 행"만 제외**(`NOT: { kind: 'DAILY', periodKey: { in: [START_DAY, todayKst()] } }` — 시작일을 같이 빼 자정을 넘기는 실행도 안전), 날짜는 서버 `infra/dates.ts` 의 `todayKst()` 를 import(8a 의 인라인 `Date.now()+9h` 도 교체, 같은 값), 6a·6b check 문구에 사유 한 줄, `tests/live/README.md` 006 행에 "오늘 DAILY 제외" 한 문장. **운영 코드·화면·DB·프롬프트 무변경(테스트 스크립트와 README 뿐)**.

**사용자 결정** — 없음(후속 정리). Leader 판단: judge 값(local_fix·R1·sonnet·standard·데모 none) 그대로, `START_DAY ∪ todayKst()` 보존(REV-111: 스모크 3~5분이라 자정을 넘길 수 있고 비용은 `Set` 한 줄), L-2(보정 문구가 check id 에 들어가 출력이 길어짐)는 외관이라 backlog, README 한 줄은 QA 가 추가(task-037 때 같은 원인 조사에 비용이 들었음).

**검증** — Developer(Sonnet, 보정 전 재현 41/42 `snap 2→3`·보정 후 연속 2회 42/42·변이 probe 5종) → **REV-111 PASS_WITH_NOTES**(Low 2·Info 4 — `NOT`+객체 AND 의미·날짜 키·8a 교체·다른 스모크 점검 모두 확인) → judge C2 는 R1·테스트 전용이라 생략 가능 판단(코드 변경 0) → **QA PASS(결함 0)**: eslint·typecheck·전체 1500건 중 1499 통과(skip 1 기존), `todayKst()` 경계 7개 시각 Intl 오라클 일치(자정 직전·직후·연말·윤년), **오늘 DAILY 행이 없는 상태에서 006 스모크 42/42 연속 2회**(`snap:2 → snap:2`), **변이 실제 실행에서 `FAIL 6b …{"snap":3,"err":2}`·41/42 가 찍힘**(점검 직후 이틀 전 DAILY 행 삽입 — 오늘 행은 제외되고 이틀 전 행은 센다 = 불변 검사가 약해지지 않았다는 직접 증거), 정리 확인(qa-bot StatsSnapshot 시작 전과 동일 2행·qa-bot2 0행·dev 포트 비움·운영 3010·8100 유지). Claude CLI 호출: QA 51회(실행당 17회 — README 의 "약 16회"는 17회로 보는 게 정확).

**알려진 한계·후속** — L-1: 오늘 DAILY 를 행 수에서 빼면 턴·점검이 오늘 DAILY 의 `chatTurns`·`corrections.accepted` 등 **값**을 부당하게 올리는 회귀는 6a·6b 가 못 잡는다(오늘 행이 이미 있던 날에도 원래 못 잡던 사각 — 이번이 새로 만든 것 아님; 한 줄 단언 추가 후보) · L-2 check id 문구 · 보정 전(HEAD) 41/42 재현은 QA 가 재실행하지 않고 developer 증빙을 신뢰(NOT_VERIFIED)·자정을 넘기는 라이브 실행은 단위로 갈음.

**배포 상태** — 운영 영향 0(운영 번들 변경 없음). `tests/live` 는 webhook 의 "문서·기록만" 건너뜀 목록(`agent-vault/`·`docs/`·`.claude/`·`CLAUDE.md`·`AGENTS.md`·`README.md`)에 없어 **이 코드 커밋을 push 하면 운영 재배포(pm2 재시작)가 일어나므로 로컬 커밋으로 두고 push 는 다음 운영 코드 변경과 묶는다**(task-035 때와 같은 결정). vault 기록 커밋만 먼저 push(docs_only 건너뜀).
