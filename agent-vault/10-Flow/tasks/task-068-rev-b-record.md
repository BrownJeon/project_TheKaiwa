---
task_id: task-068
title: "task-068 Reviewer 감사 B 기록 — 서버 단어 모듈·API 라우트·세트/평가/복습 전환"
status: done
tags:
  - type/task-note
  - domain/vocab
aliases:
  - task-068 REV-B
created: 2026-10-14
updated: 2026-10-14
---

# task-068 Reviewer 감사 B 기록 (REV-068B)

본 이력서: [[task-068-improve-wordbook]] · 개발 기록 [[task-068-dev-sb1-record]] · [[task-068-dev-sb2-record]]. 읽기 전용 감사 — 소스·시험 수정 0, DB 접속 0, `.env` 읽기 0, git 조작 0, SendMessage 0. 변이·재현은 전용 미러 `~/.node-local/thekaiwa-rev068b`(하드링크 + `src` 실복사, `DATABASE_URL=mysql://invalid…`)에서만 했고 변이마다 NFS 원본과 `cmp` 일치로 원복을 확인했다. 확신 태그: [확실] = 이번 세션에 코드를 읽거나 실행해 직접 확인.

## 판정: PASS_WITH_NOTES (Critical 0 · High 0 · Medium 1 · Low 3)

QA 이전에 REV-068B-1 만 고치기를 권고한다(한 줄 수준 — 고치면 이 항목만 좁은 재감사). 나머지는 기록·QA 인계.

## 지적

| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-068B-1 | Medium | `evaluation/materials.ts:81-88` | 평가 재료 풀을 `slice(0, POOL_MAX=2000)` 으로 자르면서 기본 단어 7.8천이 들어와, 오답 0 인 단어는 id 앞 2천 개만 남는다 → 새로 만든 내 단어는 오답이 생기기 전엔 평가에 안 나온다 |
| REV-068B-2 | Low (시험 틈) | `task068SB2.test.ts` | 풀이 `POOL_MAX` 를 넘는 경우를 아무 시험도 안 본다 — 변이 M32(오답 정렬 제거)가 살아남음. B-1 수정과 함께 시험 추가 |
| REV-068B-3 | Low | `evaluation/materials.ts:15` ← `vocab/sessions.ts:165` | `loadActiveWordStates` 가 세트 모듈(`sessions.ts`)에 있고 평가 재료가 그것을 import — 개발 기록 스스로 「wordState.ts 로 옮겨도 됨」이라 적은 위치. 의존이 무거운 쪽으로 걸림 |
| REV-068B-4 | Low | `words.ts:386-400` `wrongSegment` | 「많이 틀린 순」은 쪽을 넘길 때마다 내가 틀린 단어 전부를 `take` 없이 읽어 JS 정렬한다. 상한은 보이는 단어 수(≈7.8천+내 단어)라 최악도 수 ms~수십 ms 규모로 추정하나 [추측] — QA 가 실측 |

### REV-068B-1 상세 (증거)
- 코드: `materials.ts:81-88` — `rows`(보이고 내가 보관 안 한 전부) → 나의 `wrongCount desc, id asc` 정렬 → `.slice(0, POOL_MAX)`. `POOL_MAX = 2_000`(`:20`). 예전에는 `orderBy: [wrongCount desc, id asc], take: POOL_MAX` 가 DB 쪽에서 같은 일을 했지만 풀이 내 단어(수백 개)뿐이라 상한이 걸리지 않았다.
- 재현 [확실]: 가짜 DB(스크래치 시험 `zzRevEvalPool.test.ts`, 미러에만 있음)에 기본 단어 7,757(id 오름차순 = 시드 순서, cuid 는 시간순) + 내 단어 20(오답 0, 더 큰 id) → `loadEvaluationMaterials` 40회 호출 시 **내 단어가 뽑힌 횟수 0**, `wordCount`("보관하지 않은 단어 수") = 2000(실제 7,777).
- 영향: `EvaluationMaterials.wordCount` 는 trace 메타(`evaluations/route.ts:43`)에만 쓰여 화면 영향은 없다. 그러나 평가 문항이 사용자 자신이 추가·채택한 단어를 거의 쓰지 않고 시드 앞부분(N5→N4)만 쓴다. 이미 7.8천 행을 메모리에 읽었으므로 DB 비용을 아끼려는 상한의 이유가 없다.
- 권고: `slice` 제거(또는 `POOL_MAX` ≥ 1만) 하고 `wordCount` 는 자르기 전 길이. 상한이 꼭 필요하면 오답 있는 단어 + 내 단어를 먼저 두고 나머지를 무작위로. 시험: 풀 > 상한에서 내 단어가 후보에 있고 `wordCount` 가 전체 수인지.

## 영역별 결과

- **B-1 읽기 전용 (최우선) — 결함 없음 [확실]**: 앱 코드에서 `WordEntry` 를 쓰는 곳은 `words.ts` 의 `create`(userId=나, :244)·`update({where:{id,userId}})`(:536)·`deleteMany({where:{id,userId}})`(:551) 3곳뿐. 나머지 `wordEntry.(create|update|delete…)` 는 승인 후 수동 실행 스크립트(`scripts/seed-base-words.ts`·`scripts/migrate-seed-copies.ts`)와 `tests/live` 정리 코드(모두 `userId` 로 한정 — 기본 단어를 지우는 정리 코드 0)뿐. 원시 SQL 로 단어를 쓰는 곳 0(`$queryRaw` 는 `FOR UPDATE` 잠금류뿐). 기본 단어 id 에 대한 #43/#44 는 `where {id,userId}` 가 못 찾고 `isBaseWord` 로 403 `READ_ONLY`, 남의 단어 404. 기본 단어에 쓰는 앱 경로는 `UserWordState` 의 upsert/createMany/updateMany(보관 `setWordArchivedTx`, 끝내기 `bumpWordStates`)뿐이고 `bumpWordStates` 는 `visibleWordWhere` 로 남의 id 를 거른다.
- **B-2 사용자 격리 — 결함 없음 [확실]**: `visibleWordWhere` = 내 단어 + (`userId NULL ∧ source SEED`). `states` 관계 필터(`none`/`some`, `archivedBy`·`notArchivedBy`·`noWrong`·`wrongSegment`), `loadWordStates`, `loadActiveWordStates`, `setWordArchivedTx`, #42 stats(`session.userId`·`evaluation.userId`), `listCorrectionRefsByWord`(userId), `drawer.ts savedWord`(내 단어 또는 기본 단어만) 모두 `userId: 나`. 다른 사용자의 상태·기록이 합산되는 경로 0.
- **B-3 목록 #40 — 결함 없음(QA 실측 필요)**: 오프셋 `(page-1)*limit`, 묶음 이어 붙이기(`readPage`) 경계, 쪽 초과 → `items: []`·`pages` 최소 1, `cursor`·`chunkType=none` 400, 정렬 3종의 총순서(최근: 내 단어 `createdAt desc,id desc` → 기본 단어 `jlpt,seedKey,id` / 오답: wrong>0 묶음(JS 총순서) → 틀림 없는 내 단어 → 기본 단어 / 가나다: `surface,userId desc,seedKey,id` — 동률 해소 칸이 모두 유일값이라 쪽 사이 안정) 확인. 출처 `base` + 보관함 = 내가 보관한 기본 단어, 이상 없음. `jlpt` ENUM 선언 순서 N5→N1 확인(`schema.prisma:38`). 실제 MariaDB 에서만 확인되는 가정(NULL 이 `DESC` 에서 뒤, ENUM 정렬, `seedKey` 콜레이션에서 `N5-` < `N5X-`)은 QA 인계.
- **B-4 생성/중복/채택 — 결함 없음 [확실]**: #41 `jlpt` 400, 보강 전 `assertEnrichSurfaceFree`(LLM 앞, 소스 순서 시험), `BASE_DUPLICATE` 409(표기·읽기, 같은 표기·다른 읽기 저장), L4 `linkBaseDuplicate` 는 교정·제안 두 채택 라우트 모두 같은 트랜잭션 안에서 기본 단어 DTO 를 돌려주고 `savedWordId`/`result.wordId` 가 기본 단어 id 가 된다(내 단어끼리는 409 유지). `jlpt` 는 #41/#43 거절·채택 경로 수용. 참고(계약 ② 그대로, 지적 아님): 채택 입력에 읽기가 없으면 같은 표기의 기본 단어(같은 표기·다른 읽기가 105쌍) 중 순서 첫 행에 연결되고 사용자가 보낸 뜻·예문은 저장되지 않는다.
- **B-5 세트·평가·복습·교정모음 — REV-068B-1 외 결함 없음**: 세트 풀 = `activeWordWhere` 4칸 SELECT + 상태 1회 + 카드 ≤30 PK(쿼리 수 +2), 풀 7.8천에서 JS 비용 `pickChoices×30` 13ms·`generateWordSet` 9ms [확실, 벤치]. 끝내기는 상태 전이 가드(`IN_PROGRESS` 아닐 때 조기 반환) 뒤에서 `bumpWordStates` 한 번이라 재시도·중복 완료에서 +1 이 두 번 오르지 않는다. 다시 풀기는 보관을 무시하고 보이는 단어로 카드를 재구성, 지워진 단어는 `wordId null` → 스냅샷. 메모 `wordbookMatches`·`wordbookOrder`, 복습 `reviewWordReadWhere`, `drawer.savedWord` 이상 없음.
- **B-6 계약 일치·경계 — 결함 없음**: 라우트 5개의 상태 코드·`details.code`(`READ_ONLY` 403 / `BASE_DUPLICATE` 409+`existingId`)·DTO `origin`·`readOnly`·`{items,total,page,pages,limit,baseTotal}` 가 `api-contract.md` §2-9 개정 ①②③ 과 일치. `seed-pack` 라우트 폴더 삭제 확인(옛 호출 404). `learning` 은 conversation·speech 를 import 하지 않음(grep 0). 감사 대상 파일에 엔진명·model_id 0. tsc 0 · eslint(대상 7곳) 0 [확실].
- **B-7 시험 품질·변이**: 시험은 문자열 단언이 아니라 가짜 DB(`wordFakeDb.ts`·`wordWhereFake.ts` — 모르는 칸·연산은 던짐)로 행동을 고정한다. 변이 **24건 실행 → 23건 잡힘, 1건 생존**. 생존은 M32(평가 재료의 오답 정렬 제거 — 풀이 `POOL_MAX` 를 넘는 시험이 없어 안 걸림 = REV-068B-2, B-1 과 같은 뿌리).
- **B-8 범위 밖 변경**: 변경 파일 108개(agent-vault 제외)를 S-A·S-B1·S-B2·U1·U2·PE 소유 목록과 대조 — **어느 목록에도 없는 파일 0**. 교차 편집 메모: ① `learning/__tests__/task010.test.ts`(`chunkType: null` 1칸) — Leader 지시로 S-B2 가 고침 ② `reviewSchedule/index.ts` — S-A(`TopicChunkType` 좁히기)와 S-B2(`reviewWordReadWhere`)가 같은 파일을 나눠 고침 ③ `lessons/_lib/lessonInput.ts`·`lessons/content.ts`·`seedOverride/ops.ts`·`vocab/topicSet.ts`·`types/topic.ts` — 소유자 표기가 이력서에 없으나 J12(교정·수업·주제 4유형 유지)의 `asTopicChunkType` 좁히기라 S-A 몫으로 판단 [가능성 높음] ④ `package.json` 스크립트 2줄(S-A 의 시드·이관 스크립트 등록).

## 변이 결과 (미러 사본만 깨고 시험 → NFS 원본으로 복구 → `cmp` 일치)

| # | 변이 | 결과 |
|---|---|---|
| M1 / M1b | 기본 단어 수정 허용(`cur` 에서 userId 제거) / 403 던지기 제거 | 잡힘(T12) ×2 |
| M2 | `visibleWordWhere` 에서 기본 단어 제외 | 잡힘 22건 |
| M3 | `visibleWordWhere` 에 남의 단어 포함 | 잡힘 14건 |
| M4 | `notArchivedBy` 제거 | 잡힘 14건 |
| M5 | 기본 단어 정렬 `jlpt desc` | 잡힘(T17) |
| M6 | `total = rows.length` | 잡힘(T16) |
| M7 | 채택 경로 409 되살림 | 잡힘(L4) |
| M8 | `loadWordStates` 에서 userId 제거 | 잡힘 3건 |
| M9 | `bumpWordStates` 가 기본 단어 제외 | 잡힘 2건 |
| M10 | `archivedBy` userId 제거 | 잡힘 4건 |
| M11 | #42 stats 의 `session.userId` 제거 | 잡힘(T14) |
| M12 / M13 | `wrongSegment`·`noWrong` 의 userId 제거 | 잡힘(T17) ×2 |
| M14 | `loadActiveWordStates` userId 제거 | 잡힘 2건 |
| M15 / M31 | drawer `isBaseWord` 항상 true(남의 단어 노출) / 기본 단어 숨김 | 잡힘 ×2 |
| M16 | `setWordArchivedTx` 보이는 단어 검사 제거 | 잡힘 2건 |
| M21 | `cursor` 허용 | 잡힘(T11) |
| M26 | 오프셋 `page*limit` | 잡힘 3건 |
| M27 | 다시 풀기 카드 재료를 내 단어만 | 잡힘 4건 |
| M28 / M29 | 삭제에서 userId 제거 / #44 403 제거 | 잡힘(T12) ×2 |
| M30 | 기본 단어 중복 판정에서 읽기 무시 | 잡힘(T13) |
| **M32** | **평가 재료의 오답 정렬 제거** | **생존 — REV-068B-2** |

## QA 인계 — high_risk_areas (실제 DB·실제 Next 라우터에서만 확인되는 것)
1. **#40 쪽 이동 정합**: qa 계정으로 정렬 3종 × 1쪽~마지막 쪽(≈1,109쪽, limit 7)을 전부 순회해 id 중복 0·누락 0·합계 = `total`. 쿼리 p95(깊은 쪽 offset ≈7.8천, `NOT IN` 보관 서브쿼리 + `jlpt,seedKey` filesort, TEXT 칸 포함 SELECT), 「많이 틀린 순」은 오답 이력이 많은 계정으로.
2. **실DB 정렬 가정**: `ORDER BY userId DESC` 에서 NULL 이 뒤, `jlpt` ENUM 선언 순서, `seedKey` 콜레이션(`N5-` < `N5X-`), `surface` 콜레이션 동치(はは/ぱぱ) 행의 쪽 사이 순서.
3. **상태 격리**: qa-bot·qa-bot2 가 같은 기본 단어에 다른 상태·보관을 가질 때 목록·상세·stats·세트 가중·평가 재료·#46 분류 개수가 각자 값만 보는지(`UserWordState` 행 수 대조).
4. **세트 생성 시간(Q10)**: 풀 7.8천 + 상태 1회 조회, 사용자 행 잠금 유지 시간(task-057 72ms 기준).
5. **평가 재료**: REV-068B-1 수정 뒤 내 단어(오답 0)가 출제 후보에 들어오는지, 오답 우선이 유지되는지.
6. **L4 채택 실동작**: 기본 단어와 같은 표기로 교정 채택 → `savedWordId` = 기본 단어 id, 같은 표기·다른 읽기 단어의 연결 대상, 동시·중복 클릭, 서랍장 교정 모음 연결 표시.
7. **끝내기 멱등**: 같은 세트 `finish` 두 번·동시 호출 → `UserWordState` +1 한 번, 기본 단어 카드 포함.
8. **삭제 연쇄**: 내 단어 삭제 시 `UserWordState` cascade·`VocabAttempt`/`EvaluationItem`/`Correction` SetNull·`StatsSnapshot` 불변, 사용자 삭제 cascade.
9. **L3 창(배포~이관)**: 사본 678행과 기본 단어가 함께 보이는 동안의 목록·세트·평가, 이관 뒤 상태 보존(S-A 이관 스크립트 몫이나 라이브에서 확인).
10. **`tests/live/*` 는 한 번도 실행되지 않음**(스키마 push·시드 전엔 실행 불가) — 개발 기록대로 `task010-ui-e2e.mjs` 4k·4k2·4m 은 실패할 것으로 예상. 정리 코드는 모두 `userId` 한정이라 기본 단어를 지우지 않음을 확인했다.

native_change: false (서버·시험만).
