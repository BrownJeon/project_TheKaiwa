---
task_id: task-068
title: "task-068 Developer S-B1 기록 — 단어 서버 모듈(words·wordState·enrich·seedPack)·#40~#46 라우트·채택 경로(L4) 전환"
status: done
tags:
  - type/task-note
  - domain/vocab
aliases:
  - task-068 S-B1
created: 2026-10-14
updated: 2026-10-14
---

# task-068 Developer S-B1 기록

본 이력서: [[task-068-improve-wordbook]] · S-A [[task-068-dev-sa-record]] · PE [[task-068-pe-record]] · 전용 미러 `~/.node-local/thekaiwa-dev068b1`(068a 에서 `cp -al`, `.prisma` 는 실제 복사본) · DB 접속 0(시험 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`), git 조작 0.

## Developer 기록

- [13:05] **단계 1 완료(도우미 시그니처)** — S-B2 는 이 줄부터 쓴다. 파일 `src/modules/learning/vocab/wordState.ts`(새):
  - `visibleWordWhere(userId)` = `{ OR: [{ userId }, { userId: null, source: 'SEED' }] }` · `notArchivedBy(userId)` = `{ states: { none: { userId, archived: true } } }` · `activeWordWhere(userId)` = `{ AND: [visible, notArchivedBy] }` — 약속한 그대로.
  - 덧붙임(시그니처 변경 아님): `archivedBy(userId)`(= `states.some` 보관 — #40 `archived=1`) · `EMPTY_WORD_STATE`(행이 없을 때 값, 동결).
  - `WordStateRow`·`loadWordStates(db: Pick<Tx,'userWordState'>, userId, wordIds)` — 중복 id 제거, 1,000개씩 나눠 조회, 빈 목록이면 DB 호출 0, 행 없는 단어는 맵에 없음.
  - `WordStateDelta`·`bumpWordStates(tx, userId, d, now)` — ① 대상 id 를 `visibleWordWhere` 로 걸러 남의 단어·지워진 단어는 조용히 뺌(FK 오류·남의 상태 쓰기 방지) ② `userWordState.createMany(skipDuplicates)` 로 없는 행을 기본값으로 ③ 목록별 `updateMany` 1번씩(맞힘 `correctCount +1`·틀림 `wrongCount +1`·건너뜀 시각·결과만) — 예전 `wordEntry.updateMany` 3번과 같은 결과(같은 id 가 두 목록이면 맞힘→틀림→건너뜀 순, 한 목록 안 중복은 1번). **`WordEntry` 에는 쓰지 않는다.** 호출자(S-B2 `finishVocabSession`)는 지금처럼 사용자 행 잠금 아래에서 부르면 된다.
  - 공용 가짜 DB `src/modules/learning/__tests__/wordFakeDb.ts`(새 — S-B2 도 써도 됨): `wordEntry`(findMany·findFirst·count·groupBy·create·update·updateMany·deleteMany)·`userWordState`(findMany·findUnique·createMany·updateMany·upsert)·`vocabAttempt.count/groupBy`(session.userId)·`evaluationItem.count`(evaluation.userId) — Prisma where(AND/OR/NOT·in·not·contains·gt·`states some/none`)·orderBy(MariaDB NULL 규칙·`jlpt` ENUM 순서) 해석, 모르는 칸·연산은 던짐. 픽스처 `word()`·`base(id, seedKey)`·`state()`.
  - 시험 `task068WordState.test.ts` 4/4.
- [13:35] **단계 ①~④ 완료(서버 계약 그대로 — U·S-B2 는 아래 「인계」부터)**
  - `src/types/seedPack.ts`: `LEVEL_CATEGORY_NAMES`(단계 표시 이름 5 + `N5 기초`, 동결)·`isLevelCategory(v)`(바이트 일치) 추가.
  - `vocab/words.ts`(다시 씀): `WORD_CHUNK_TYPES` 5유형 · DTO `origin`·`readOnly`·상태 6칸 = 나의 `UserWordState`(칸을 하나씩 옮겨 `userId`·`seedKey` 누출 0) · `parseWordInput(raw, prefix, { jlpt: false })`(#41 만 `jlpt` 400 `unknown_key`) · `parseWordListQuery`(`page` 1~100,000·`source`·`cursor` 400 `use_page`·`chunkType=none` 400) · `listWords` → `{items,total,page,pages,limit,baseTotal}`.
  - **#40 쪽 조회 결정(raw SQL 안 씀)**: 정렬별 「순서 있는 묶음」을 이어 붙이는 오프셋 — 최근 = [내 단어 `createdAt desc,id desc`] + [기본 단어 `jlpt asc, seedKey asc, id asc`] · 가나다 = 한 묶음 `surface asc, userId desc(MariaDB DESC 에서 NULL 뒤 = 내 단어 먼저), seedKey asc, id asc` · 많이 틀린 = [나의 `wrongCount>0` 단어를 읽어 JS 정렬(같은 수 안은 최근 순서)] + [틀림 없는 내 단어] + [틀림 없는 기본 단어]. 각 묶음은 `count` + `skip/take` 라 Prisma 로 표현되고 가짜 DB 로 동작 시험이 된다. 쿼리 수: 최근 = count 3(내·기본·baseTotal) + findMany ≤2 + 상태 1. ⚠ Q3(성능)는 QA 실측 — 틀린 단어 묶음은 전부 읽는다(세트를 푼 단어 수 이하).
  - #41 보강 전: `assertEnrichSurfaceFree(userId, surface)`(내 단어 409 `{existingId}` → 기본 단어 표기만 409 `BASE_DUPLICATE`) — **`findWordIdBySurface` 는 없앴다**(라우트 한 곳만 썼음). LLM 전에 부름(시험이 라우트 소스 순서 단언).
  - `createWord(userId, input, tx?, { linkBaseDuplicate })`: 내 단어 중복 → 409(그대로) → 기본 단어 중복(표기 같고 읽기 비었거나 같음) → 409 `BASE_DUPLICATE`, **채택 경로는 `linkBaseDuplicate: true` 로 그 기본 단어 DTO(`origin:'BASE'`)를 돌려줌(L4)** — `corrections/[id]/accept`·`proposals/[id]/accept` 두 라우트에 옵션만 더함(그 결과 `savedWordId`/`result.wordId` = 기본 단어 id). `existingId` = 기본 단어 순서(`compareBaseWords`: jlpt N5→N1 → seedKey → id) 첫 행.
  - #42 `getWordDetail`: 내 단어 또는 기본 단어, `stats` 는 `session.userId`/`evaluation.userId` = 나만. #43 `updateWord`: 기본 단어 403 `READ_ONLY`(`where {id,userId}` 로 못 찾고 기본 단어면), `jlpt` 키 400 `read_only`, `chunkType:null` 400 `required`, 표기 바뀜 → 내 단어 중복, 표기·읽기 바뀜 → 기본 단어 중복, 쓰기 `update({ where: { id, userId } })`. #44 같은 403. #45 `setWordArchivedTx`: 보이는 단어면 `UserWordState` findUnique → 바뀔 때만 upsert(`archivedAt` 유지), `WordEntry` 쓰기 0. #46 `listCategories`: `groupBy(category,userId)` 두 번(전체·나의 보관) → `categoryBucketOf`(기본 단어·null·난이도 이름 → null 묶음).
  - `vocab/enrich.ts`: `WordEnrichOutput.chunkType: ChunkType | null` · `toDraft` 가 5유형 허용 목록으로만 옮김(그 밖·없음 → null, valid=false → null) · `cachedDraft` 는 `draft.chunkType === undefined`(v1 초안)면 미스. → **tsc 의 `words/route.ts`·`lessons/[id]/memo/route.ts` 2건 해소.**
  - `vocab/seedPack.ts`: `parseSeedPackBody`·`addSeedPack`·`insertSeedWords`·`planSeedInsert`·`ExistingWord`·`SEED_*_CHUNK` 삭제. **남김**: `asSeedWords`·`SeedWord`·`createSeedPackStore`·`loadJlptJson`·`seedPackWords`·`SEED_PACKS` 재수출(`baseWordSeed.ts` 가 `asSeedWords`·`SeedWord` 를 씀 — grep 확인).
  - 삭제 `src/app/api/v1/words/seed-pack/route.ts`(폴더째). `learning/index.ts`: seedPack 수출 3개·`findWordIdBySurface` 제거, `assertEnrichSurfaceFree`·`WORD_CHUNK_TYPES`·`WORD_SOURCE_FILTERS`·wordState 도우미 5개·새 타입 추가.
  - 시험: 새 `task068Words.test.ts` 13건(T9 서버·T11·T12·T13×2·T14·T15·T16·T17·T25·L4/T29·본문·초안 조각) — `prisma` 싱글턴의 대리자를 가짜 DB 로 바꿔 끼움(askRouteGuard 방식). 갱신 `task008.test.ts`(none 단언 → T11, where 모양, 초안 픽스처 `chunkType`, C2-1 보관 순서 `lock → word:findFirst → state:findUnique → state:upsert`) · `task051SeedPack.test.ts`(폐지 함수 시험 4건 삭제, 로더·데이터 일관성 유지).
  - **변이 20개 → 처음 19/20**(M16 「틀린 수에 남의 상태 섞임」 놓침 — 같은 단어에 다른 사용자 상태가 있는 픽스처가 없었음 → B 의 `b1` 상태 추가) → **20/20**. 목록: 기본 단어 수정·삭제 거절 제거 · visibleWordWhere 기본 단어 제외 · notArchivedBy 제거 · seedKey 글자 순만 · total=items.length · 채택 409 되살림 · 저장도 표기만 · #42 wordId 만 · 보관을 공용 행에 · none 받음 · 끝내기 카운터 공용 행 · #46 접기 제거 · DTO 행 그대로(userId 누출) · 초안 조각 안 옮김 · 보강 전 기본 단어 확인 제거 · 가나다 기본 단어 먼저 · #41 jlpt 허용 · existingId 입력 순서. (변이는 미러 사본에만, 매번 NFS 원본으로 복구·바이트 대조.)
  - 게이트(미러, 내 파일): tsc — 내 파일 0, **남은 1파일 3건 = `src/modules/learning/__tests__/task010.test.ts:392·394·395`(레슨 메모 시험 픽스처에 `chunkType` 없음 — `WordDraft` 에 칸이 생긴 탓, 아래 S-B2 인계 ①)** · eslint(바꾼 파일 14개) 0 · 관련 시험 6파일 60/60 + `task068Words` 13/13.

### 인계 (계약에서 벗어난 점 없음 — 아래는 쓰는 쪽이 알아야 할 것)
- **U(화면)**: ① #40 응답에 `nextCursor` 없음, `page` 는 1부터(화면 0부터면 +1) ② 409 두 갈래는 `details.code === 'BASE_DUPLICATE'` 유무 ③ 403 `details.code === 'READ_ONLY'` ④ #46 은 기본 단어·난이도 이름을 `category:null` 로 접어 줌 — 화면 `visibleCategories` 의 난이도 이름 제외는 이중 안전장치 ⑤ `seed-pack` 라우트가 없어졌다(`components/vocab/hooks.ts` 의 호출은 U 몫) ⑥ #43 은 `jlpt` 키를 보내면 400 — `diffPatch` 에서 빼야 함 ⑦ 채택 경로는 기본 단어와 같아도 409 가 아니다(L4) — Q7 「교정 채택 시 같은 표현 안내」는 이제 **내 단어 중복일 때만** 나온다(가이드 28-9 Q7·T13 끝줄은 L4 이전 문장).
- **S-B2**: ① `src/modules/learning/__tests__/task010.test.ts` 392·394·395행 `WordDraft` 픽스처에 `chunkType: null`(또는 값) 추가 필요(tsc 3건 — 내 소유가 아니라 손대지 않음) ② `lessons/memo.ts` `memoDraftFromEnrich` 로 오는 초안에 이제 `chunkType` 이 있다 — 제안 페이로드에 실을지는 PE 권고대로 S-B2/Leader 판단(채택 경로 `parseWordInput` 은 `chunkType` 을 받으므로 실으면 그대로 저장됨) ③ 세트 끝내기는 `bumpWordStates(tx, userId, { correctIds, wrongIds, skippedIds }, now)` 한 줄로 바꾸면 예전 3번의 `updateMany` 와 같은 결과 ④ 가짜 DB `wordFakeDb.ts` 를 써도 된다(필요한 연산이 없으면 그 파일에 더해도 됨 — 내가 다시 고칠 일은 없다) ⑤ `tests/live/*` 의 `seed-pack` 호출은 이제 404.
- **Leader**: ① 정본 `domain-model.md` 미반영(S-A 와 같음) ② 가이드 28-9 T13 끝줄·Q7 은 L4 결정과 어긋난다(문서 몫) ③ 응답 `message` 는 계약 예시 문구 그대로(「기본 단어에 이미 있어요.」·「기본 단어는 고칠 수 없어요.」·지우기는 「기본 단어는 지울 수 없어요.」).
- [13:41] **S-B1 완료** — 추가 확인: learning·conversation 전체 시험 1,619/1,619 · 바뀐 모듈을 import 하는 그 밖의 시험 11파일 58/58(미러). 남은 tsc 는 S-B2 인계 ①(task010.test.ts 3건)과 U 진행 중 화면 파일뿐. 미커밋 파일(내 것): `src/modules/learning/vocab/{words,wordState(새),enrich,seedPack}.ts` · `src/types/seedPack.ts` · `src/modules/learning/index.ts` · `src/app/api/v1/words/{route.ts,[id]/route.ts,[id]/archive/route.ts,[id]/unarchive/route.ts,categories/route.ts}` · 삭제 `src/app/api/v1/words/seed-pack/route.ts` · `src/app/api/v1/{corrections,proposals}/[id]/accept/route.ts` · 시험 `src/modules/learning/__tests__/{task068Words(새),task068WordState(새),wordFakeDb(새),task008,task051SeedPack}.test.ts`(wordFakeDb 는 .ts).
