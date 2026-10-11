---
task_id: task-055
role: developer-a
title: "task-055 Developer A(서버) 기록 — API #79 GET /api/v1/drawer/corrections"
tags:
  - type/task-record
  - domain/drawer
  - domain/conversation
created: 2026-10-11
---

# task-055 Developer A(서버) 기록

> 본 이력서: [[task-055-drawer-corrections]] · 계약 `docs/design/api-contract.md` §2-17

## Developer 기록
- [17:40] **타입 파일 완료** — `src/types/chat.ts` 에 `DrawerCorrectionItem` · `DrawerCorrectionFacets` · `DrawerCorrectionPage` 추가(`CorrectionDto` 바로 아래). Developer B 가 import 해도 된다.
- [17:45] **서버 구현 완료(체크포인트)**
  - **완료(변경 파일)**: `src/types/chat.ts`(타입 3개 추가만) · `src/modules/conversation/corrections/drawer.ts`(신규 — `parseDrawerCorrectionQuery`·`drawerCorrectionWhere`·`listDrawerCorrections`·`DrawerCorrectionDb` 주입면) · `src/modules/conversation/index.ts`(export 3줄 추가) · `src/app/api/v1/drawer/corrections/route.ts`(신규, GET) · `src/modules/conversation/__tests__/task055drawer.test.ts`(신규, 20 시험).
  - **구현 요점**: where = `userId`·`status=ACCEPTED`·`resolvedAt IS NOT NULL`(커서 키 보장 — 채택 경로 `acceptCorrection` 은 늘 resolvedAt 을 쓰므로 실제로 빠지는 행 없음) + `errorType`·`chunkType` AND + `q` 는 `original|corrected|explanation` `contains` OR. 정렬 `resolvedAt desc, id desc`, 커서 `{t,id}`(`isTimeIdCursor`, 해석 불가 → DB 호출 전 400). 첫 쪽만 `groupBy(errorType)` 1회(같은 where 에서 `errorType: null`) 를 목록과 `Promise.all`, count 0 제거·많은 순→`ERROR_TYPE_RANK`(선언 순). `chat`·`savedWord` 는 findMany 한 번의 관계 select(N+1 없음), `savedWord.userId === 요청자` 일 때만 `{id,surface}`(userId 는 응답에 안 실음). `limit` = `parseLimit(raw, 20, 50)`, `q` = `sanitizeText` 후 코드포인트 ≤40(빈 값 = 없음).
  - **LIKE 이스케이프 근거(가정 아님)**: ① task-008(2026-09-27) NAS MariaDB 실측 — Prisma `contains:'%'` 가 전 행과 일치 = Prisma 는 `%`·`_` 를 이스케이프하지 않는다(`infra.escapeLike` 주석·[[task-008-vocab-today-words]] 트러블슈팅 ①). ② 그때와 지금 Prisma 버전이 같다 — `@prisma/client`·`prisma` **6.19.3**(미러 `node_modules` 확인, `package-lock.json` 은 7a77d1f(09-26)부터 6.19.3 그대로, 이후 lock 변경 커밋 3건에 Prisma 버전 변화 없음). ③ 그래서 기존 `infra.escapeLike`(`\`·`%`·`_` 앞에 `\`)를 써서 MariaDB 기본 이스케이프 문자 `\` 로 글자 그대로 찾는다(단어장 #40·발음 사전 검색과 같은 방식). ④ 시험의 가짜 DB 가 「이스케이프 없이 `%값%`」+ MariaDB LIKE 의미를 흉내 내고, 대조군(이스케이프 없이 `contains:'_'` → 전 행 일치)으로 시험이 누락을 잡을 수 있음을 보였다. 라이브 DB 동작 확인(`q=%`·`q=_`)은 QA 몫.
  - **남은 일**: Leader 보고. (20-Log 일일 로그 append 는 Leader 지시의 수정 허용 범위 밖이라 하지 않음 — Leader 가 기록.)
  - **주의점**: `facets` 는 cursor 요청에 키 자체가 없다(`'facets' in page === false`). 정렬이 `[userId,status,createdAt]` 인덱스와 달라 사용자 채택 행 전체 filesort — 개인 앱 규모라 둠(reviewer 확인 대상).
  - **미커밋 파일**: 위 5개 + 이 기록 파일(커밋·push 금지 지시).
- [17:47] **실행 증빙**(미러 `~/.node-local/thekaiwa-dev055a`, `KAIWA_LOCAL_ROOT=$M bash scripts/sync-local.sh` exit 0)
  - `./node_modules/.bin/tsc --noEmit` → **exit 0, `error TS` 0건**(동기화 시점의 B/C 작업 파일 포함 전체).
  - `./node_modules/.bin/eslint src/modules/conversation/corrections/drawer.ts src/modules/conversation/index.ts src/app/api/v1/drawer/corrections/route.ts src/modules/conversation/__tests__/task055drawer.test.ts src/types/chat.ts` → **exit 0**(경고·오류 0).
  - `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 src/modules/conversation/__tests__/task055drawer.test.ts` → **exit 0, 20/20 통과**.
  - 같은 명령에 기존 교정 시험 4개(`correctionRefs`·`task006`·`task010c`·`task039server`) 추가 → **exit 0, 91/91 통과**.
  - **변이 확인 10건**(미러의 `drawer.ts` 만 한 줄씩 바꿔 시험 → 원복, `cmp` 로 원복 확인): M1 이스케이프 제거 fail 2 · M2 facets 에 errorType 유지 fail 1 · M3 cursor 요청에도 facets fail 1 · M4 `id asc` fail 2 · M5 단어 소유 검사 제거 fail 1 · M6 userId 조건 제거 fail 3 · M7 status 조건 제거 fail 2 · M8 0개 유지 fail 1 · M9 개수 정렬 제거 fail 2 · M10 검색 대상 explanation→extraNoteKo fail 3 — **10/10 검출**.
