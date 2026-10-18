---
task_id: task-074
role: developer
title: "task-074 서버 부분 developer 기록 — 즐겨찾기 칸·#182/#183·목록 favorite 필터"
tags:
  - type/task-record
  - domain/vocab
created: 2026-10-18
---

# task-074 서버 — developer 기록

이력서: [[task-074-improve-word-favorites]] · 미러 `~/.node-local/thekaiwa-dev074-sv`

## 진행
- [01] 기록 파일 생성. 이력서(L1~L8·최종 결정표·DB 반영 절차) 읽음.
- [02] 미러 `~/.node-local/thekaiwa-dev074-sv` 생성(`cp -al` dev072-ui → `.next` 삭제 · `.prisma`·`@prisma/client` 독립 복사(링크 수 1 확인) · `src`/`tests`/`prisma`/`package.json` 은 지우고 저장소에서 새로 복사 — 하드링크 공유 없음). `UserWordState` grep 724.
- [03] `prisma/schema.prisma` UserWordState 에 `favorite`·`favoritedAt`·`@@index([userId, favorite])` + 문서 주석 한 줄. `migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel <new> --script`(DB 접속 없음, 가짜 URL) → ALTER 1문(ADD COLUMN 2절) + CREATE INDEX 1문. 미러에서만 `prisma generate`(dev072-ui 클라이언트 `favoritedAt` 0건 그대로 확인).
- [04] `vocab/wordState.ts`: `favoritedBy(userId)`·`WordStateRow`/`EMPTY_WORD_STATE` 에 `favorite`·`favoritedAt`·공용 select `WORD_STATE_FIELDS`(보관·즐겨찾기 토글 응답이 목록과 같은 칸). `vocab/words.ts`: `WordDto`·`toWordDto`·`WordListQuery.favorite`·`parseWordListQuery`(`favorite=0|1`, 그 밖 400 `field:favorite`)·`wordListFilter`(`favorite` 일 때만 AND)·`READ_ONLY_KEYS`(+favorite·favoritedAt)·`setWordFavoriteTx`/`setWordFavorite`(보관과 같은 모양 — 잠금·보이는 단어·멱등·upsert). `learning/index.ts` 에 `setWordFavorite` 공개. 라우트 `words/[id]/favorite`·`unfavorite`(보관 라우트와 같은 모양, 한도 없음).
- [05] `src/types/vocab.ts`: `WordEntry.favorite?`·`favoritedAt?`(옵션 — 화면 코드·픽스처가 아직 모름, 서버는 늘 줌) + `WordFavoriteResponse`. 시험: `wordFakeDb.ts` 상태 기본값에 `favorite:false`·`favoritedAt:null`, `task068Words.test.ts` 쿼리 도우미에 `favorite:false`, 새 `learning/__tests__/task074Favorite.test.ts`(F1~F10) · `app/api/v1/__tests__/task074FavoriteRoutes.test.ts`(R1~R4, 진짜 라우트+진짜 learning+가짜 DB, 늦게 풀리는 세션 Promise). tsc 0. 관련 4파일 통과.
- [06] 정본 문서(이력서 「DB 반영 절차 ①」·Leader 지시대로 developer 가 편집): `docs/design/domain-model.md` UserWordState 블록(칸 2·색인 1·주석 3줄) · `docs/design/api-contract.md` §1 요약표 #40 쿼리·#182·#183 행(§1-5 머리말 범위 #161~#183) · §2-9 WordEntry 예시·`favorite` 설명 줄 · #40(`favorite` 의미: 0 = 조건 없음)·#43(read_only)·#45(별 유지)·#182/#183 행.
- [07] R5 계약 대조 시험 추가(요약표 #182·#183 행·§2-9 상세 행·#40 `favorite=`·번호 충돌 0). `eslint src prisma` 0 오류(경고 5 — 기존 화면 파일, 이번 변경과 무관). 전체 시험 백그라운드 실행.

## WordEntry 를 돌려주는 곳 — `favorite`·`favoritedAt` 실림 여부 (grep `toWordDto|withStates|loadWordStates|WORD_STATE_FIELDS`)
모든 단어 응답은 `toWordDto(w, state)` 한 곳에서 만들고 상태는 `loadWordStates`(STATE_SELECT) 또는 `WORD_STATE_FIELDS` 로 읽는다 → 두 select 에 별 칸을 넣어 아래가 모두 같은 방식으로 실린다.

| API | 함수 | 상태 출처 | archived | favorite·favoritedAt | 시험 |
|---|---|---|---|---|---|
| #40 GET /words | `listWords` → `withStates` | `loadWordStates` | O | O(요청자 기준, 행 없으면 false·null) | F5·F8·F9·R4 |
| #41 POST /words(직접 저장) | `createWord` → `toWordDto(w)` | 새 단어 = EMPTY | O(false) | O(false·null) | F10 |
| #35·#38 채택(교정·제안 accept) | `createWord(…, {linkBaseDuplicate})` | 기본 단어 연결 시 `withStates` | O | O(내 별, 남의 별 X) | F10 |
| #42 GET /words/:id | `getWordDetail` | `loadWordStates` | O | O | F5·F10 |
| #43 PATCH /words/:id | `updateWord` → `withStates` | `loadWordStates` | O | O(별 유지 — [저장] 응답이 별을 잃지 않음). 본문의 `favorite`·`favoritedAt` 는 400 `read_only` | F10 |
| #45 archive/unarchive | `setWordArchivedTx` | `WORD_STATE_FIELDS`(공용) | O | O(보관해도 별 그대로) | F7 |
| #182/#183 favorite/unfavorite | `setWordFavoriteTx` | `WORD_STATE_FIELDS` | O | O | F3~F7·R2 |
| 오늘의 단어 세트(#47~#52)·평가 재료 | `sessions.ts`·`evaluation/materials.ts` | `loadActiveWordStates`(같은 STATE_SELECT) | 응답에 없음(카드 DTO 는 상태 칸 미노출) | 없음(L6 범위 밖 — 덱 「즐겨찾기만」 아님) | 전체 시험 |
| #46 categories | `listCategories` | 집계만 | count·archivedCount | 없음(D6 A — 분류 칩 숫자 불변) | — |
- [08] 전체 시험(가짜 DATABASE_URL, `--test-concurrency=1`, src+scripts/seed-build): **4,278 중 통과 4,277 · 실패 0 · 건너뜀 1**. 변이 점검 16개(미러 사본에만 적용 → 저장소 파일로 되돌림 → `diff -rq` 동일) **16/16 포착**(표는 아래).

## 변이 점검 (미러 사본에만 적용 → 관련 4파일 시험 → 저장소 파일로 복원)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | `favoritedBy` 에서 `userId` 조건 제거(남의 별 섞임) | 포착 | R4·F2·F5 |
| M2 | 멱등성 깨기(같은 상태도 다시 씀 → `favoritedAt` 바뀜) | 포착 | R2·R4·F3 |
| M3 | 가시성 검사 제거(남의 단어도 찾음) | 포착 | R3·F5 |
| M4 | 목록 조건 AND → OR(별 OR 나머지) | 포착 | R4·F2·F5(·F8) |
| M5 | `favoritedAt` 규칙 변경(끄기에도 지금 시각) | 포착 | R2·F3 |
| M6 | 응답에서 `favorite` 누락 | 포착 | R2·R4·F3 |
| M7 | `favorite` 400 검증 제거 | 포착 | R4·F1 |
| M8 | 파싱 의미 변경(값이 있으면 true — `favorite=0` 도 켬) | 포착 | F1 |
| M9 | unfavorite 라우트가 켜기로 호출 | 포착 | R2·R4 |
| M10 | 라우트 `await requireSession()` 누락 | 포착 | R2·R3·R4(늦게 풀리는 세션 Promise) |
| M11 | 별 토글이 보관 칸(`archived:false`)도 씀 | 포착 | F7 |
| M12 | 사용자 행 잠금 제거 | 포착 | F4 |
| M13 | 목록 상태 select 에서 `favorite` 빠짐 | 포착 | R2·R4·F3 |
| M14 | 행이 없는데 끄기도 행 생성 | 포착 | F4 |
| M15 | #43 이 `favorite` 를 read_only 로 막지 않음 | 포착 | F10 |
| M16 | `favorite=0` 에 「별 없는 것만」 조건(반대 의미) | 포착 | R4·task008 #40 where·F2 |

**16/16 포착.** 스크립트는 세션 scratchpad `mutate074.py`(저장소 밖).

## 결정 (developer — reviewer 확인 대상)
- **D-a `favorite=0` = 조건 없음**(「즐겨찾기 아닌 것만」 아님). `archived=0` 은 「보관 아님만」이라 모양이 다르지만, screens.md §32-3 「다른 칸 = favorite 없음(서버 기본 0)」에서 「전체」 칸이 별 단어를 숨기면 안 되므로 이 뜻이어야 한다. 계약 #40 에 명시. [확실 — §32-3 문구 근거]
- **D-b 응답 모양 = 보관과 같게 `WordEntry` 전체**(`{favorite,favoritedAt}` 만이 아님). 보관 라우트가 `setWordArchived` 의 `WordDto` 를 그대로 `ok()` 하는 것을 코드로 확인. 타입 `WordFavoriteResponse extends Partial<WordEntry>`(#45 와 같은 꼴).
- **D-c 분당 한도 없음**(Leader 결정, 보관 라우트에도 없음). 대신 **사용자 행 잠금**(`lockUserRow`) — MySQL 에서 Prisma `upsert` 는 DB 네이티브 upsert 가 아니라 조회→생성 두 단계로 알고 있어 [가능성 높음 — Prisma 문서상 네이티브 upsert 는 PostgreSQL·CockroachDB·SQLite], 빠른 연타 두 요청이 같은 (사용자, 단어) 상태 행을 동시에 만들면 유니크 충돌로 500 이 날 수 있다. 보관 토글과 같은 방식.
- **D-d #43 본문의 `favorite`·`favoritedAt` → 400 `read_only`**(전에는 모르는 키라 `unknown_key`). 둘 다 400 이라 기존 화면에 영향 없음(화면 [저장]은 이 키를 보내지 않음). 보관 칸과 같은 처리.
- **D-e `WordEntry.favorite` 타입은 옵션(`favorite?: boolean`)**. 필수로 두면 화면·픽스처(`src/components/**` — 이번 범위 밖)의 `WordEntry` 리터럴이 tsc 에서 깨진다. 서버는 늘 싣는다(F9). 화면 developer 가 필요하면 필수로 올리고 픽스처를 고친다.
- **D-f `wordListFilter` 의 `favorite` 인자는 옵션**(기존 task008 시험·호출 모양 그대로). `WordListQuery.favorite` 는 필수(파서가 늘 채움).
- **D-g 정본 문서 편집**: developer 정의상 정본은 leader 영역이지만, 이력서 「DB 반영 절차 ①」과 이번 지시가 developer 에게 domain-model·api-contract 편집을 맡겼다. 이 범위(UserWordState 블록·#40/#43/#45/#182/#183·WordEntry 설명)만 고쳤다.
- **seedCopyMigration.ts**: 손대지 않음. 이미 끝난 일회성 이관(task-068 — 사본 0)이고 즐겨찾기는 이관 뒤에 생기는 칸이라 옮길 값이 없다. 다시 돌릴 일이 생기면 그때 별 칸 병합 규칙이 필요하다(지금은 불필요). [가능성 높음]
- **#46 분류 개수**: 바꾸지 않음(D6 A).
- [09] `next build`(미러, `.next` 지우고) **exit 0** — 라우트 `ƒ /api/v1/words/[id]/favorite`·`unfavorite` 확인. 엔진명 grep(새·변경 서버 파일) 0건. 저장소 ↔ 미러 `src`·`prisma` `diff -rq` 동일. 미러에 `.env` 없음.

## migrate diff SQL 원문 (HEAD 스키마 → 새 스키마, DB 접속 없음)
`prisma migrate diff --from-schema-datamodel <git show HEAD:prisma/schema.prisma> --to-schema-datamodel prisma/schema.prisma --script` (scratchpad `task074-migrate-diff.sql`)
```sql
-- AlterTable
ALTER TABLE `UserWordState` ADD COLUMN `favorite` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `favoritedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `UserWordState_userId_favorite_idx` ON `UserWordState`(`userId`, `favorite`);
```
= SQL 문 2개: `ALTER TABLE`(ADD COLUMN 2절 — 칸 2) + `CREATE INDEX` 1. 그 밖의 문장 없음(DROP·MODIFY 0). **주의(Leader 절차 ④)**: 이건 「HEAD 스키마 ↔ 새 스키마」 차이다. 실제 DB 가 HEAD 스키마와 이미 어긋나 있으면 `db push` 가 다른 문장을 낼 수 있으니 반영 전 「새 스키마 ↔ 실제 DB」 diff 를 Leader 가 따로 확인할 것(나는 DB 에 접속하지 않았다).

## 변경 파일
- `prisma/schema.prisma`(+4줄: 주석 1·칸 2·색인 1)
- `src/modules/learning/vocab/wordState.ts` · `src/modules/learning/vocab/words.ts` · `src/modules/learning/index.ts`
- 새 `src/app/api/v1/words/[id]/favorite/route.ts` · 새 `src/app/api/v1/words/[id]/unfavorite/route.ts`
- `src/types/vocab.ts`
- 시험: `src/modules/learning/__tests__/wordFakeDb.ts`(상태 기본값) · `task068Words.test.ts`(쿼리 도우미 1줄) · 새 `task074Favorite.test.ts`(F1~F10) · 새 `src/app/api/v1/__tests__/task074FavoriteRoutes.test.ts`(R1~R5)
- 정본: `docs/design/domain-model.md` · `docs/design/api-contract.md`
- 화면(`src/components/**`·`src/app/(app)/**`)·프롬프트·`package.json`·다른 모델·`docs/screens.md`·`docs/demo/**` 변경 0. 커밋·푸시·DB 접촉 0.

## 증빙 숫자
- `tsc --noEmit` 0 · `eslint src prisma` 0 오류(경고 5 = 기존 화면 파일 `react-hooks/set-state-in-effect`, 이번 변경과 무관) · 관련 4파일 51/51 + 라우트 R5 · **전체 4,278 중 4,277 통과·실패 0·건너뜀 1** · `next build` exit 0 · 변이 16/16 포착.

## 알려진 한계
1. 시험은 가짜 DB(메모리) 기준이다 — 실제 MariaDB 에서 `states: { some: { userId, favorite: true } }` 가 새 색인 `(userId, favorite)` 를 타는지, 행 수가 많을 때 `favorite=1` 목록 속도는 미측정(QA 서버에서 DB 반영 뒤 확인 권장). [추측: 단어 7.8천·별 수십 개 규모라 문제 없을 것]
2. 동시성(연타 두 요청)은 잠금 순서(F4)로만 확인 — 실제 DB 동시 요청 시험 아님.
3. `WordEntry.favorite` 타입이 옵션 — 화면이 `undefined` 를 `false` 로 다뤄야 한다(D-e).
4. DB 칸이 없는 상태(반영 전)에서 이 코드를 띄우면 상태를 읽는 모든 단어 API 가 실패한다(STATE_SELECT 에 `favorite`). **배포 전에 DB 반영이 먼저**여야 한다(이력서 구현 계획 5 순서와 같음).

## reviewer / QA 가 볼 곳
- reviewer: `words.ts` `setWordFavoriteTx`(잠금·가시성·멱등·upsert 키가 늘 `(요청자, 단어)`) · `wordListFilter`(`favoritedBy(userId)` AND) · `parseWordListQuery`(`favorite` 검증·0 = 조건 없음 D-a) · `READ_ONLY_KEYS` · `wordState.ts` `WORD_STATE_FIELDS`/`STATE_SELECT` · 라우트 2개(인증 await·learning index 만 import) · 계약 문서 #40/#43/#45/#182/#183.
- QA(DB 반영 뒤, QA 서버 `APP_ENV=LOCAL`): 실제 HTTP 로 A/B 두 계정 격리(A 별이 B 목록·상세·`favorite=1` 에 안 보임, B 가 A 의 내 단어 별 → 404) · 멱등(두 번 켜기 `favoritedAt` 같음) · `archived=1&favorite=1` · `favorite=2` 400 · 세션 없음 401 · 보관 토글 응답의 별 유지 · `PATCH` 본문 `favorite` 400 read_only · 기존 보관·삭제·수정·페이징 회귀.

## 감사 후 시험 보강 (REV-074S 지적 M-1·M-2·L-1·L-2·L-4 대응 — 제품 동작 변경 0)

- [A0] 시작. 미러 `~/.node-local/thekaiwa-dev074-t`(작업) · `…-t-mut`(변이) 준비 — `cp -al` → `.next` 삭제 → `src`(components 제외)·`tests`·`prisma`·`package.json` rsync, 저장소와 `diff -rq` 0. `prisma generate` 안 돌림(클라이언트 `favorite` 82건 확인만). 작업 순서: ① `UserWordState` 쓰기 경로 조사 ② 시험 추가 ③ 현재 코드 통과 확인 ④ 변이 재현(감사 5 + 새 3↑) ⑤ 문구 3곳 ⑥ lint·tsc·전체 시험.
- [A1] `UserWordState` 를 쓰는 경로 조사(`grep -rn "userWordState\|UserWordState" src scripts`, 원시 SQL 쓰기 0) → 아래 표. 시험 추가·변이 재현·문구 3곳 보정 완료. **제품 동작 변경 0** — 바뀐 비시험 파일은 주석 3곳(`words/route.ts`·`words/[id]/route.ts` JSDoc, `wordState.ts` 주석)과 정본 문서 한 행뿐(저장소 ↔ pre-change 미러 `diff` 로 주석만 다름을 확인).
- [A2] 새 시험이 현재 코드에서 통과 → 감사자의 생존 변이 5개 + 새 변이 12개를 별도 변이 미러에서 다시 넣어 **17/17 포착**. 처음 돌렸을 때 새 변이 N5(「끝내기가 새로 만든 상태 행을 `favorite=true` 로」)가 **생존** — 원인은 가짜 DB `createMany` 가 `data` 의 `userId`·`wordId` 외 칸을 버렸기 때문(실제 Prisma 와 다름) + 끝내기 종단 시험이 모든 단어에 행을 미리 깔아 새 행이 안 생겼던 것. → `wordFakeDb.ts` 가 `data` 를 그대로 반영하게 하고 `T74` 를 「일부만 별」까지 넓힌 뒤 재실행해 N5 포착.

### 추가한 시험 (8개 — 새 `test()` 8개 + 기존 F4 강화)
| 시험 | 파일 | 대응 | 내용 |
|---|---|---|---|
| F4(강화) | `learning/__tests__/task074Favorite.test.ts` | L-1 | 토글의 첫 DB 동작이 `lock:user` 이고 상태 읽기 앞 |
| F11 | 〃 | L-1(V8) | 켜기/끄기 × 상태 행 있음/없음 × 없는 id 6경우 모두 `log[0]==='lock:user'`·잠금 1회·보이는 단어 확인 → 상태 읽기 순서 |
| F12 | 〃 | **M-1** | `bumpWordStates` 직접: 맞힘·틀림·건너뜀·맞힘→건너뜀(같은 id 두 목록)·보관한 별·별 아닌 단어·새로 만든 행·남의 별 — `favorite`·`favoritedAt`·`archived` 유지, 새 행 별 아님, 카운터는 실제로 올랐음 |
| T74 ×2 | `learning/__tests__/task059CardFirst.test.ts` | **M-1** | 세트 만들기 → 답(자기 채점·보기 정답/오답·표시만) → `finishVocabSessionDetailed` 종단: 내 단어·기본 단어 × 전부 별/일부 별 → 별은 원래 별이었던 단어만(`favoritedAt` 유지, 행 수·카운터 합 2/2/1) · 세트 만들기와 답 0장 끝내기(ABANDONED)는 상태 쓰기 0 |
| F13 | task074Favorite | 보강 | 보관·풀기는 `favoritedAt`, 별 켜기·끄기는 `archivedAt` 을 그대로(양방향) |
| F14 | 〃 | M-1 확장 | 목록·상세·수정(#43, 빈 패치 포함)·생성(#41)·채택 연결이 상태 행을 안 쓴다(`state:upsert/updateMany/createMany` 0 + 행 JSON 동일) |
| F15 | 〃 | **M-2** | 즐겨찾기 × `wrong`·`recent`·`surface`, 별 아닌 틀린 단어(b2·a4·a1·b4)·보관한 별(a5)·남의 상태(B)가 섞인 픽스처. **기대값은 손으로 계산한 id 순서**(코드 출력 아님): `wrong+별` = b1,a2,b3,a3 · `wrong 전체` = a4,b1,b2,a2,a1,b3,b4,a3 · `recent+별` = a2,a3,b1,b3 · `surface+별` = b1,a2,b3,a3 · 보관함 = a5 · 출처·분류·B 사용자 · 쪽 이어붙이기(틀린 묶음→안 틀린 묶음 경계) |
| F16 | 〃 | L-2(V9) | `prisma/schema.prisma` 의 `UserWordState` 블록에 `favorite Boolean @default(false)`·`favoritedAt DateTime?`·`@@index([userId, favorite])`·`@@unique([userId, wordId])` — 없으면 **실패**(건너뛰지 않음) |
- 시험 도우미: `wordFakeDb.ts` 의 `userWordState.createMany` 가 `data` 칸을 그대로 반영(실제 Prisma 와 같게; 기존 호출자는 `userId`·`wordId` 만 넘겨 동작 불변).

### `UserWordState` 를 쓰는 경로 (별 유지 불변식 대응표)
| # | 경로 | 쓰기 | 별(`favorite`·`favoritedAt`) 영향 | 고정하는 시험 |
|---|---|---|---|---|
| 1 | #51 세트 끝내기 `bumpWordStates`(`sessions.ts`) | `createMany(skipDuplicates)` + 목록별 `updateMany`(카운터·`lastSeen*`) | 건드리지 않아야 함 | **F12 · T74(종단)** · 변이 V3·N3·N4·N5·N8 |
| 2 | #45 보관/풀기 `setWordArchivedTx` | `upsert` `{archived, archivedAt}` | 별 유지 | F7 · F13 · 변이 V2·N1 |
| 3 | #182/#183 `setWordFavoriteTx` | `upsert` `{favorite, favoritedAt}` | 이 경로만 별을 바꿈, `archived*` 유지 | F3~F7·F11·F13 · 변이 N2·N9·V8 |
| 4 | #44 단어 삭제 `deleteWord` | 단어 행 삭제 → 상태 행 cascade | 단어와 함께 사라짐(의도) | F6 |
| 5 | #43 수정 `updateWord` · #41 생성 `createWord`(채택 연결 포함) | 상태 **읽기만**(`withStates`) | 안 씀 | F10 · F14 · 변이 N7 |
| 6 | #47 세트 만들기(오늘의 단어 카드)·평가 재료 `materials.ts` | `loadActiveWordStates` **읽기만** | 안 씀 | T74(세트 만들기 상태 쓰기 0) · (평가 재료는 읽기 호출 하나뿐 — grep 으로 확인) |
| 7 | `scripts/migrate-seed-copies.ts`(일회성 task-068 이관, 사본 0) | `upsert`(카운터 `increment`·`lastSeen*`)·`deleteMany`(사본 상태) | `favorite` 를 쓰지 않음(create 는 DB 기본값 false) | `task068SeedCopyMigration.test.ts`(별 칸은 이번 범위 밖 — 다시 돌릴 일이 생기면 별 병합 규칙 필요) |

### 변이 재현 (별도 변이 미러 `~/.node-local/thekaiwa-dev074-t-mut` — `src`·`prisma` 는 하드링크가 아닌 실제 복사본, 매번 작업 미러 원문으로 복원, 복원 후 `diff -rq` 0)
감사자의 생존 5개(전체 learning + routes 시험 641개로 실행) — **5/5 포착**:
| 변이 | 넣은 방법 | 결과 | 실패한 시험 |
|---|---|---|---|
| V3 (M-1) | `bumpWordStates` 맞힘 `updateMany` data 에 `favorite:false` | **killed** | T74 · F12 |
| V4 (M-2) | `wrongSegment` where 가 모든 필터 무시 | **killed** | F15 |
| V4b (M-2) | `sort=wrong` 앞 묶음만 `favorite` 제외 필터 | **killed** | F15 |
| V8 (L-1) | `lockUserRow` 를 `state:findUnique` 뒤로 이동 | **killed** | F4(강화) · F11 |
| V9 (L-2) | 스키마 `@@index([userId, favorite])` 제거 | **killed** | F16 |
새로 만든 변이 12개 — **12/12 포착**:
| 변이 | 넣은 방법 | 결과 | 실패한 시험 |
|---|---|---|---|
| N1 | 보관 upsert data 에 `favoritedAt:null` | killed | F13 (+F8·F7 일부) |
| N2 | 별 토글 data 에 `archivedAt:null` | killed | F13 |
| N3 | 끝내기 **틀림** `updateMany` 에 `favorite:false`(V3 의 다른 경로) | killed | T74 |
| N4 | 끝내기 **건너뜀** `updateMany` 에 `favoritedAt:null` | killed | T74 |
| N5 | 끝내기 `createMany` 로 만든 새 행이 `favorite:true` | killed(보강 뒤 — 처음엔 **생존**, 위 [A2]) | T74 |
| N6 | `sort=wrong` 앞 묶음이 `archived` 조건 무시 | killed | F15 |
| N7 | 수정(#43)이 `userWordState.updateMany(favorite:false)` 호출 | killed | F10 · F14 |
| N8 | `finishVocabSessionDetailed` 가 끝내기 뒤 내 모든 별 지움 | killed | T74 |
| N9 | 잠금을 보이는 단어 확인 뒤·상태 읽기 앞으로 이동 | killed | F4(강화) · F11 |
| N10 | 스키마 `@@unique([userId, wordId])` 제거 | killed | F16 |
| N11 | `favorite` 조건이 `source=all` 일 때만 걸림 | killed | F2 · F8 |
| N12 | 스키마 `favoritedAt` 칸 제거 | killed | F16 |
하네스 `scratchpad/dev074t-mut.py`(저장소 밖). 1차 실행 로그 `dev074t-mut-run1.log`(N5 생존), 2차(최종) `dev074t-mut.log`(17/17).

### 문구/주석 보정 3곳 (L-4 — 제품 동작 불변)
1. `docs/design/api-contract.md:981` — #40 오류 요약 행에 `archived`·`favorite`(task-074, `0`·`1`·빈 값 외)·`sort` 를 필드 목록에 추가(`favorite` 외 둘도 실제로 400 인데 빠져 있었음).
2. `src/app/api/v1/words/route.ts`(GET JSDoc) · `src/app/api/v1/words/[id]/route.ts`(PATCH JSDoc) — `favorite=1` 필터(0·없음 = 조건 없음)·항목마다 `favorite`/`favoritedAt`, 수정은 `favorite`·`favoritedAt` 를 `read_only` 400 으로 거절하고 응답은 나의 상태 유지.
3. `src/modules/learning/vocab/wordState.ts:74-76` `loadActiveWordStates` 주석 — 「상태 행은 본 적 있는 단어에만」은 이제 사실이 아님 → 「풀었거나 보관하거나 즐겨찾기한 단어에만(별만 켠 단어도 행이 있다)」.

### 증빙 숫자 (작업 미러 `thekaiwa-dev074-t`, `.next` 삭제, 가짜 `DATABASE_URL`, `prisma generate` 안 돌림 — 클라이언트 `favorite` 82건 확인만)
| 항목 | 결과 |
|---|---|
| `tsc --noEmit --incremental false` | **exit 0** |
| `eslint src/modules/learning src/app/api/v1/words`(+routes 시험) | **exit 0**, 출력 0 |
| learning + routes 시험 | **641 중 통과 639·실패 0·건너뜀 2**(감사 때 633 → +8) |
| 전체 시험(`src` + `scripts/seed-build`) | **4,286 중 통과 4,283·실패 0·건너뜀 3**(감사 때 4,278 → +8; 건너뜀 3 = 미러에 `docs/`·`speech/models` 없음) |
| 건너뜀 해소(`KAIWA_PROJECT_ROOT`=저장소) | R5·T25·F16 포함 3파일 **34/34 통과·건너뜀 0** |
| 저장소 ↔ 작업 미러 | `src`(components 제외)·`prisma` `diff -rq` 0 |
| 화면 쪽 `src/components` | 건드리지 않음(작업 미러의 옛 사본으로 tsc 통과) |
`next build` 는 이번 변경(주석·시험·문서)이 번들에 영향이 없어 재실행하지 않음.

### 사고 기록 — 하드링크로 다른 미러 파일을 잠시 바꿨다가 복구함
작업 미러가 `cp -al` 하드링크 복사본이라, 내가 새 시험 두 파일을 `cp` 로 덮어쓰자 **같은 inode 를 공유하는 다른 미러의 같은 파일**(`thekaiwa-dev074-sv`·`thekaiwa-dev074-ui`·`thekaiwa-rev074s` 의 `task059CardFirst.test.ts`, `…-sv`·`…-rev074s` 의 `task074Favorite.test.ts`)이 내 새 내용으로 바뀌었다. 변이 하네스를 쓰기 전에 `stat -c %h`/`find -inum` 으로 발견해 **즉시 복구**: task059 는 git HEAD 내용, task074Favorite 는 내가 읽어 둔 원본(261줄)으로 되돌리고 링크를 끊었다(각 링크 수 1, 줄 수 705·261 확인). `…-dev074-ui2` 의 같은 파일은 inode 가 달라 영향 없음. 이후 작업 미러 갱신은 `rsync`(임시 파일 후 rename)만 썼고, 변이 미러는 `src`·`prisma` 를 실제 복사본으로 만들어 썼다. 교훈: **`cp -al` 미러에서는 `cp`/`>` 로 제자리 덮어쓰기 금지, `rsync` 나 `rm` 후 쓰기.** 다른 미러의 그 두 파일은 지금 원래 내용이지만, 그 미러 주인이 그 사이 이 파일들을 읽었다면 알려야 한다(Leader 보고).
