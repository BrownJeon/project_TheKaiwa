---
task: task-051
role: developer
agent: A2
tags:
  - type/task-record
  - domain/vocab
---
# task-051 Developer A2 기록 — 서버 모듈(5단계 팩·지연 로딩·중복 키·시험·#46b 문서)

본 이력서: [[task-051-improve-n5-vocab-pack]] (이 파일은 A2 전용 — 본문은 수정하지 않는다)

## 체크포인트
- [16:58] 착수 — 읽음: 이력서 「사용자 결정」 두 절·「설계 v2」·「Leader 결정 — PE 측정 결과 처리」·Designer 「표시 이름 규칙」·「확인 못 한 것」, `seedPack.ts`·`index.ts`·#46b 라우트·`hooks.ts`(클라이언트가 `{pack:'N5'}` 고정 전송)·`task008.test.ts` E1 시험·`prisma/seed.ts`(OWNER 시드 `words-n5.json` 그대로)·`tx.ts`(기본 timeout 15s)·`WordEntry`(표기 unique 없음 — 같은 표기 다른 읽기 행 허용 확인)·api-contract #46b 두 줄(표 171행·본문 921행). 사실: `prisma/seed-data/jlpt/` 아직 없음(A1 생성 전). 전용 미러 `~/.node-local/thekaiwa-seed051a2`(node_modules 하드링크).
- [17:00] 타입 리프 `src/types/seedPack.ts` 작성 — `SEED_PACKS`(N5~N1)·`SeedPack`·`SEED_PACK_LABEL`(초보자 (N5)·초급 (N4)·중급 (N3)·고급 (N2)·최상급 (N1), 이 한 곳)·`SEED_PACK_COUNT`(생성 파일 재노출, `Record<SeedPack, number>` 로 고정)·`isSeedPack`·`seedPackCategory`. JSON import 없음.
- [17:01] 모듈 `learning/vocab/seedPack.ts` 재작성 — 단계별 리터럴 `import()` 5줄 + `createSeedPackStore(loader)`(단계별 1회 로드·검사·동결 캐시, 실패는 캐시 안 함) · `planSeedInsert`(순수 건너뜀 판정) · `insertSeedWords(tx,…)`(조회·삽입 500개씩, 같은 트랜잭션) · `addSeedPack` = 로드 → `withTransaction`(사용자 행 잠금 → insert). `parseSeedPackBody` 5값. 기존 export 이름(`SEED_PACKS`·`SeedPack`·`parseSeedPackBody`·`addSeedPack`·`seedPackWords`) 유지 — `seedPackWords` 만 async 로 바뀜. `index.ts`·#46b 라우트는 변경 불필요(그대로 컴파일).
- [17:02] 시험 — `task008.test.ts` E1 갱신(OWNER 원본 50개 검사는 `asSeedWords(words-n5.json)` 로 유지, pack 5값 허용·N6/n5 거절) · 새 `src/types/seedPack.test.ts`(타입 층) · 새 `src/modules/learning/__tests__/task051SeedPack.test.ts`(모듈 층: 중복 규칙·이전 50개 사용자·나눔 조회/삽입·실패 전파·지연 로더 주입·데이터 일관성 6개는 파일 없으면 skip).
- [17:03] 실행 증빙(전용 미러 `~/.node-local/thekaiwa-seed051a2`, DB 접속 없음 — 아래 원문). 미러의 Prisma 클라이언트가 하드링크 원본과 공유돼 낡아 있어(`Chat.endedAt` 없음 오류 40여 건) 미러 안에서만 `.prisma`·`@prisma/client` 를 실복사 후 `prisma generate`(DB 접속 없음).
- [17:04] 문서 — api-contract #46b 표 행(171)·본문 행(921)만 갱신. 다른 절 미변경.
- [17:05] **완료(A2)** — 아래 정리. 커밋 안 함(Leader). 20-Log 기록은 Leader 지시대로 이 파일에만 남김.

## 변경 파일
- `src/types/seedPack.ts` (신규)
- `src/types/seedPack.test.ts` (신규)
- `src/modules/learning/vocab/seedPack.ts` (재작성)
- `src/modules/learning/__tests__/task051SeedPack.test.ts` (신규)
- `src/modules/learning/__tests__/task008.test.ts` (E1 시험 1개 + import 2줄)
- `docs/design/api-contract.md` (#46b 두 행만)
- 미커밋 전부. `src/types/seedPackCounts.ts`(A1 소유)는 읽기만.

## 실행 증빙 (원문 발췌)
```
# tsc --noEmit (미러, 데이터 파일 없음)
scripts/seed-build/build.ts(80,9): error TS2741 …            ← A1 작업 중 파일, A2 범위 밖
src/modules/learning/vocab/seedPack.ts(63..67,20): error TS2307: Cannot find module '../../../../prisma/seed-data/jlpt/n5.json' … (n5~n1 5건)   ← A1 데이터 생성 전이라 당연
# tsc --noEmit (미러에만 자리표시 `[]` 5개를 만든 뒤 — 실행 후 삭제·재동기화)
scripts/seed-build/build.ts(80,9): error TS2741: Property 'NODE_ENV' is missing …   ← 유일한 오류(A1)
# eslint (변경 파일 7개 지정)  lint=0
# eslint . (미러 전체)  ✖ 140 problems (54 errors, 86 warnings) — 오류 파일: tests/live/p3-qa/** 53건 · src/components/settings/VoiceSettings.tsx 1건, A2 파일 0건(기존)
# node --import tsx --test src/types/seedPack.test.ts …/task051SeedPack.test.ts …/task008.test.ts
# [task-051] 데이터 일관성 시험 건너뜀: prisma/seed-data/jlpt/{n5,n4,n3,n2,n1}.json 이 아직 없다(A1 생성 뒤 Leader 가 실행)
# tests 38 / pass 32 / fail 0 / cancelled 0 / skipped 6
# learning·types·components/vocab 시험 47파일 전체: tests 536 / pass 530 / fail 0 / skipped 6
# (시험의 시험) 미러에만 가짜 jlpt 5파일 + 가짜 seedPackCounts 로 task051SeedPack 실행: tests 12 / pass 12 (동적 import 로더 경로 포함)
#   → n5 에서 私 의 읽기를 わたくし 로 바꾸면: not ok 12 '이전 50개 私/わたし: 새 N5 에 같은 표기·다른 읽기만 있다 → 다시 누르면 추가된다' (검출 확인)
#   → 미러는 sync-local 로 원복(jlpt 디렉토리 없음·seedPackCounts 원래 값 확인)
```

## 설계-코드 차이 (Leader 확인 필요)
1. **트랜잭션 상한 15s → 30s**(`SEED_TX_TIMEOUT_MS`) — N1 3,070개(조회 7번·삽입 7번)를 원격 NAS MariaDB 에서 한 트랜잭션으로 넣을 때 기본 15s 에 걸릴 수 있어서. [추측] 실제 소요는 미측정(QA 가 3,070개 삽입 시간을 잴 때 함께 확인). 그동안 그 사용자의 행 잠금이 유지된다(같은 사용자 턴이 기다림).
2. **팩 안 (표기, 읽기) 중복은 한 번만 넣는다**(`planSeedInsert`) — 지시에 없던 방어. 데이터 일관성 시험은 중복 자체를 실패로 본다.
3. **보관(archived) 단어도 「있는 단어」로 센다** — 현행 동작 유지(조회에 `archived` 조건 없음).
4. **레코드의 여분 칸(`jlpt` 등)은 버리고 단계는 팩에서 정한다** — 데이터 일관성 시험이 `jlpt` 칸이 있으면 단계와 같은지만 단언.
5. `parseSeedPackBody` 오류 문구: 「지원하지 않는 단어 팩입니다(N5·N4·N3·N2·N1 중 하나).」, `reason` = `N5|N4|N3|N2|N1`(SEED_PACKS 에서 만듦).
6. 데이터 일관성 시험에 **단계 사이 (표기, 읽기) 중복 0** 과 **이전 50개 ⊂ 새 N5 (같은 표기면 같은 읽기)** 단언을 넣음 — 「이전 50개 사용자가 다시 눌러도 두 번 안 들어감」을 데이터로 보장하는 조건. 이전 50개 중 새 N5 에 같은 표기가 아예 없는 단어(이력서의 표기 불일치 6개 등)는 실패가 아니라 목록만 출력한다(그 단어는 규칙상 새 단어로 들어감 → 그 사용자 기준 `skipped` 는 50 미만).

## 미확인
- [가능성 높음] Turbopack 운영 빌드에서 단계별 JSON 청크 분리·`import()` 결과의 `.default` = 배열 — `npm run build` 금지라 확인 못 함. tsx(node 20)에서는 확인. Reviewer/Leader 가 빌드 후 `.next/server/chunks` 크기와 #46b 호출 1회로 확인 필요.
- 실제 DB 에서 한 트랜잭션 롤백(중간 실패 시 0행)·3,070개 삽입 시간 — 가짜 tx 로는 「예외를 삼키지 않음」만 확인. QA 측정 항목.
- 실제 MariaDB 콜레이션에서 `surface IN (…)` 500개 조회 성능(`@@index([userId, surface])` 있음).
- 같은 표기·다른 읽기 두 행이 생긴 뒤 표기만 보는 다른 경로(`findWordIdBySurface`·채택 저장 중복 검사 등)가 어느 행을 고르는지 — 이 task 범위 밖, 조사 안 함.
- 데이터 파일이 필요한 시험 6개는 A1 생성 전이라 skip. A1 완료 뒤 Leader 가 `node --import tsx --test src/modules/learning/__tests__/task051SeedPack.test.ts` 로 실행.

## B(화면) 인계 — 쓸 export (`@/types/seedPack`, 클라이언트 import 가능)
- `SEED_PACKS`(순서 N5→N1) · `type SeedPack` · `SEED_PACK_LABEL[pack]`(표시 이름) · `seedPackCategory(pack)`(분류 칩 이름, 표시 이름과 같은 글자) · `SEED_PACK_COUNT[pack]`(개수) · `isSeedPack(v)`(예: `Profile.level`/`goalLevel` 값 검사)
- 요청: `POST /api/v1/words/seed-pack` body `{ pack: SeedPack }` → `SeedPackResult {added, skipped}`(`@/types/vocab`, 변경 없음). 지금 `components/vocab/hooks.ts` 는 `{ pack: 'N5' }` 고정 — B 가 바꿀 곳.
