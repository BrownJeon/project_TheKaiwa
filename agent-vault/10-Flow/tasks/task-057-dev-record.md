---
task_id: task-057
title: "task-057 Developer 기록 — 1단계 실측(세트 생성 지연 단계별 프로파일, 소스 무변경)"
tags:
  - type/task
  - domain/vocab
  - domain/performance
created: 2026-10-11
---

# task-057 Developer 기록 (1단계 실측)

상위 이력서: [[task-057-perf-today-words-set-creation]]

## ★ QA1 에 심은 것 / 정리 방법 (맨 위 고정)
- **대상 계정**: `qa-bot@thekaiwa.test` (USER) 한 명. 개발·운영 공유 NAS MariaDB.
- **심은 것**: `WordEntry` JLPT 5단계 전부(N5 676 · N4 629 · N3 1,649 · N2 1,767 · N1 3,034 = 7,755) — `addSeedPack` 모듈 함수 직접 호출. 측정 중 만든 `VocabSession`(전부 답 0장 = ABANDONED)·`VocabAttempt`(카드).
- **시작 값(2026-10-11 20:5x 확인)**: Chat 3 · ChatMessage 64 · Correction 5(ACCEPTED 0) · **WordEntry 0 · VocabSession 0 · VocabAttempt 0** · StudyLog 0 · StatsSnapshot 3 · TutorProposal 8 · Profile `level=N5 goalLevel=null dailyWordCount=10` → 지시서의 시작 값과 일치.
- **이 단계가 끝나도 단어 7,755개는 지우지 않음**(2단계·QA 가 같은 데이터를 씀). 측정이 만든 세트 390개·카드 4,080장(전부 ABANDONED)은 **끝에 지웠다** → 지금 QA1 은 **WordEntry 활성 7,755(보관 0, 정답/오답 카운터·lastSeenAt 전부 비어 있음: 단계 N5 676·N4 629·N3 1,649·N2 1,767·N1 3,034) · VocabSession 0 · VocabAttempt 0 · StudyLog 0 · StatsSnapshot 3 · Chat 3 · ChatMessage 64 · Correction 5(ACCEPTED 0) · TutorProposal 8 · Profile 불변**(2026-10-11 21:4x `counts2.ts` 확인).
- **시작 값(WordEntry 0)으로 복원**: `userId=QA1` 의 `WordEntry` 전부 삭제(`VocabAttempt`·`VocabSession` 은 이미 0). 도구: 미러 `~/.node-local/thekaiwa-dev057/scratch/cleanup.ts` 에 `BENCH_DROP_WORDS=1` 을 주고 실행(`node --env-file=<NFS .env> --import tsx scratch/cleanup.ts`), 실행 뒤 `scratch/counts2.ts` 로 확인. 2단계 QA 가 세트를 만들면 같은 방식으로 `ABANDONED` 세트를 지운다.
- 스키마·코드 변경 없음, StudyLog·StatsSnapshot·Profile 은 건드리지 않음(세트를 끝낼 때 답 0장 = ABANDONED 라 기록·스냅샷 0).

## 환경
- 미러: `D=~/.node-local/dev057-tree`(git archive `a834978`) · `M=~/.node-local/thekaiwa-dev057`(KAIWA_LOCAL_ROOT, `node_modules` 는 predeploy 미러에서 `cp -al`, **prisma generate·dev·build 안 함**, 스키마가 predeploy 와 동일함을 diff 로 확인). `.env` 는 미러에 복사하지 않았다(`node --env-file=<NFS .env>`).
- 측정 도구는 전부 `$M/scratch/*` 와 `$M/src/modules/learning/vocab/sessionsTimed.ts`(미러 전용 사본)에만 있다. 저장소 소스 변경 0.

## 체크포인트
(아래에 append)

- [20:5x→21:1x] **체크포인트 1 — 환경·도구 준비, 676개(N5) 첫 실측 완료, 예상 밖 결과**
  - 완료: 미러 구성(스키마 predeploy 와 동일 확인), QA1 시작 값 확인(지시서와 일치), `ping`(SELECT 1 왕복 p50 0.4ms · 빈 트랜잭션 1.1ms), N5 시드(676, 4.1s), 676개 기준 orig/p5/p7 각 6회.
  - **첫 발견(가설과 어긋남)**: 함수 전체 p50 ≈ 850ms 중 **`COMMIT` 한 문장이 p50 ≈ 750ms** — 풀 조회(`wordEntry.findMany`)는 7.8ms 에 불과. 676개에서는 조회·계산·INSERT 합이 전부 약 13ms. 7,755개 결과를 본 뒤 확정하되 병목 후보는 「쓰기 트랜잭션 COMMIT 지연」으로 이동.
  - **`getProfile` upsert(트랜잭션 밖) 가 알려진 p50 2ms 가 아니라 약 50ms** — upsert 가 내부에서 BEGIN→SELECT→SELECT→COMMIT 을 열고 그 COMMIT 이 ~48ms. 같은 시각의 `SELECT 1` 왕복은 0.4ms.
  - 남은 일: 4,721·7,755개 시리즈, 7,755 본 측정 25회(orig/p5/p7 교대), COMMIT 원인 분해(쓰기 행 수·빈 쓰기·서버 변수), 카테고리 5회, 동치 대조, 라우트 바깥 추정.
  - 다음 첫 명령: `tail -40 ~/.node-local/thekaiwa-dev057/scratch/out/scales.log` (백그라운드 `scales.sh` 진행 확인).
  - 주의점: Prisma `$on('query')` duration 은 ms 정수 단위(0.0 은 <0.5ms). 이벤트는 `sleep(25)` 후 수집. 도구는 전부 `$M/scratch`·`$M/src/.../sessionsTimed.ts`.
  - 미커밋 파일: 이 기록 파일 1개(저장소 소스 변경 0).

- [21:18] **체크포인트 2 — 5개 규모 시리즈·7,755 본 측정(25회)·격리 요청·COMMIT 분해·동치 대조 완료**
  - 완료: 규모 시리즈(676·1,305·2,954·4,721 각 6회 + 7,755 본 측정 25회, orig/p5/p7 교대) · 격리 요청(요청 전 4초 쉼, 12회) · `diag vars/idle/commit/commit2/status` · 동치 대조(메모리 6,240건 불일치 0 / DB 16건 불일치 0) · 페이로드 크기(`meta`).
  - **핵심 결론(잠정)**: Leader 가설 **틀림**. 7,755개 풀 조회(②)는 함수 전체 p50 2,635ms 중 **72ms(2.7%)**. 지배 항목은 **쓰기 트랜잭션 COMMIT(p50 1,420ms)** + 트랜잭션 밖 `getProfile` upsert 가 여는 내부 트랜잭션의 COMMIT(루프 중 p50 ~530ms, 한가할 때 3.6ms).
  - 남은 일: 풀 크기 A/B(`ab.sh` — QA1 N4~N1 을 보관했다가 복원, 백그라운드 진행 중), 카테고리 5회, 최종 표·권고 정리, QA1 상태 확인(복원 후 active 7,755·archived 0).
  - 다음 첫 명령: `tail -60 ~/.node-local/thekaiwa-dev057/scratch/out/ab.log` → `AB_DONE` 확인 → `node --env-file=... scratch/counts.ts`(미러에서) 로 상태 확인.
  - 주의점: ① 측정 루프는 쓰기 트랜잭션이 연달아 도는 구조라 COMMIT 대기가 부풀 수 있다 — 같은 조건의 과거 HTTP QA(p50 2.0~2.65초)와 함수 합(2.6초)이 일치하는 것으로 보아 과거 수치도 같은 구조. 격리(4초 쉼) 요청에서도 COMMIT p50 1.1초로 높다. ② 시드 직후 구간은 DB 플러시 영향으로 더 느릴 수 있어 7,755 본 측정은 마지막 시드(N1) 직후에 돌았다 — 격리 요청·A/B 로 보완.
  - 미커밋 파일: 이 기록 파일 1개(저장소 소스 변경 0).

- [21:30] **체크포인트 3 — 풀 크기 A/B + 「트랜잭션 안에서 풀을 읽으면 COMMIT 이 느려진다」 발견**
  - 풀 크기 A/B(같은 코드·같은 루프, QA1 N4~N1 을 보관했다 복원): 활성 676개 → 함수 전체 p50 **739ms**(COMMIT 576) / 활성 7,755개 → **2,283ms**(COMMIT 1,150, 같은 코드). 읽기 구간 증가분은 +70ms 뿐이라 **총 시간 차의 대부분이 조회 시간이 아니라 쓰기·COMMIT 쪽 증가**. → 총 시간은 풀 크기에 의존하지만 그 경로가 「조회 자체」가 아니다.
  - 격리 실험(`diag.ts txread`, 같은 시각 교대·각 10회): COMMIT p50 — 쓰기만 600ms · **풀 11컬럼 읽기 후 쓰기 1,572ms** · 풀 5컬럼 읽기 후 쓰기 899ms · 쓰기 뒤 11컬럼 읽기 1,358ms. 즉 **같은 트랜잭션에서 풀을 읽으면 SELECT 자체는 30~70ms 인데 그 트랜잭션의 쓰기·COMMIT 이 +0.8~1.0초** 느려진다(읽는 컬럼이 적을수록 덜함).
  - 다음 첫 명령: `cat ~/.node-local/thekaiwa-dev057/scratch/out/txread2.log` (A 쓰기만 / B 바깥 읽기 직후 쓰기 / C 바깥 읽기 1.5초 뒤 쓰기 / D 안에서 읽기 / E 읽기 전용 트랜잭션 — 원인이 「트랜잭션 안」 때문인지 「큰 읽기의 DB 부작용」 때문인지 가른다).
  - 미커밋 파일: 이 기록 파일 1개(저장소 소스 변경 0).

- [21:36] **체크포인트 4 — 원인 위치 특정: 큰 읽기가 「바로 뒤따르는 쓰기 COMMIT」을 느리게 한다**
  - `diag.ts txread2`(교대 8회, 쓰기 직전 2초 쉼): COMMIT p50 — **A 쓰기만 176ms(p95 1,638)** · **B 트랜잭션 밖 풀 읽기 직후 쓰기 1,524ms** · **C 밖 읽기 1.5초 뒤 쓰기 912ms** · **D 안에서 읽기 1,158ms** · **E 읽기 전용 트랜잭션 전체 76ms(COMMIT 1ms)**. → 영향은 「트랜잭션 안에서 읽기」가 아니라 「큰 읽기 직후의 쓰기 fsync」(DB·스토리지 쪽 I/O 상태)이며 시간이 지나면 일부 풀린다. 읽기만 하는 트랜잭션은 빠르다.
  - 진행 중: 격리 요청 A/B(`series iso2`, 요청 전 2.5초 쉼, orig/p5/p7 각 22회) — 후속 확인용.
  - 남은 일: iso2 결과, 최종 표·결론 기록, QA1 최종 상태 확인.
  - 다음 첫 명령: `cat ~/.node-local/thekaiwa-dev057/scratch/out/iso2.log | grep -n "###\|8_total\|7_commit"`.

---

# ★ 1단계 실측 결과 (최종)

## 결론 한 줄
**Leader 가설 「내 단어 전체 통째 조회·역직렬화가 지연의 대부분」은 틀렸다.** 7,755개 풀 조회(②)는 함수 전체 p50 2,635ms 의 **72ms(2.7%)**. 지배 항목은 **쓰기 트랜잭션의 COMMIT(p50 1.1~1.4초)** 이고, 이 값은 행 수에 비례하지 않는 DB 쪽 고정 비용이다(`innodb_flush_log_at_trx_commit=1`·`sync_binlog=1`·버퍼풀 16MB 설정과 맞물린 것으로 보임 `[추측]` — 세부 기전은 확인하지 못함). 가벼운 컬럼 프로토타입은 읽기 구간을 36% 줄이지만(−30ms) **종단 p50 개선은 잡음에 묻혀 검출되지 않았다.**

## 측정 조건
- 코드: 커밋 `a834978`(git archive) 미러. 호출: `createVocabSession` 내 단어장 세트 경로 사본(`sessionsTimed.ts`) — `count=10, mode=CHOICE`, 카테고리 없음(기본), 세트는 답 0장으로 끝내(ABANDONED) 다음 생성이 막히지 않게 함. 풀 = 7,755개 전부, 프로필 `level=N5`, 오늘 DONE 세트 0건.
- DB: 개발·운영 공유 NAS MariaDB 10.11.11, 왕복(`SELECT 1`) p50 0.4ms, 빈 트랜잭션 1.1ms. 측정 중 다른 클라이언트의 DB 활동은 20초 샘플에서 0(커밋·fsync Δ=0) — 즉 지연은 **내 쓰기 자체와 DB 스토리지**에서 난다.
- 「루프」 = 생성→끝내기를 연달아 반복(과거 QA 방식과 동일). 「격리」 = 요청 사이 2.5~4초 쉼. 원자료: 미러 `scratch/out/*.json`(단계·SQL 이벤트 전부), 표는 `scratch/out/tables.md`.
- 한계: 공유 NAS 의 쓰기 지연 꼬리가 길다(루프 최대 5.5초, 격리 최대 5.4~7.4초). 표본 수 n=6~25 로는 ±300~500ms 차이를 구분하지 못한다. 각 단계 p50 의 합은 함수 전체 p50 과 같지 않다(분위수는 더해지지 않음).

## 표 1 — 7,755개 단계별 시간(변경 전 코드, 루프 25회, 워밍업 3회 제외, ms)
| 단계 | p50 | p95 | max |
|---|---:|---:|---:|
| ⓪ `levelCeilingFor`→`getProfile` upsert (트랜잭션 밖) | 533.2 | 1,179.3 | 2,092.7 |
| ① 트랜잭션 열기 | 1.2 | 2.2 | 2.3 |
| ① `lockUserRow` | 1.0 | 1.6 | 1.7 |
| ① `assertNoInProgress` | 1.4 | 2.3 | 2.4 |
| **② `wordEntry.findMany`(POOL_SELECT 11컬럼, 7,755행, JSON 1,721 KiB)** | **72.3** | 78.1 | 79.0 |
| ③ 카테고리 id 조회 | 0 (선택 안 함) / 6.0 (선택 시, n=5) | | |
| ④ 오늘 시도 조회 | 2.3 | 4.0 | 674.7 |
| ④ 풀 필터(CPU) | 0.5 | 0.9 | 1.0 |
| ⑤ `generateWordSet`(CPU) | 2.9 | 6.0 | 6.5 |
| ⑤ `distinctMeaningCount`(CPU) | 0.5 | 0.5 | 2.1 |
| ⑥ `insertSession` 합 | 471.5 | 1,207.7 | 1,514.4 |
| ⑥a `pickChoices` 10장(CPU) | 6.6 | 9.9 | 10.1 |
| ⑥b `VocabSession` INSERT+SELECT | 66.2 | 1,093.9 | 1,224.2 |
| ⑥c `VocabAttempt` createMany | 2.8 | 751.2 | 1,504.6 |
| ⑥d DTO(CPU) | 0.0 | 0.1 | 0.2 |
| **⑦ 커밋(콜백 끝~반환)** | **1,420.5** | 2,752.8 | 3,015.4 |
| **⑧ 함수 전체** | **2,635.4** | 3,827.8 | 5,454.6 |
- SQL 14문장/회. ②의 벽시계 72ms 중 DB 가 쿼리에 쓴 시간은 29ms, 나머지 약 43ms 는 Prisma 결과 매핑·JSON 파싱(JS 쪽).
- ⓪과 ⑦ 에 COMMIT 이 각각 한 번씩 있다: ⓪ `getProfile` upsert 는 **읽기뿐인데 내부 트랜잭션(BEGIN→SELECT→SELECT→COMMIT)** 을 열고, 루프에서는 앞선 쓰기의 대기에 걸려 COMMIT 이 p50 528ms(격리에서는 4ms). 두 COMMIT 합은 p50 약 2.0초.

## 표 1b — 격리 요청(실사용에 더 가까움, 7,755개, 변경 전 코드)
| 조건 | 함수 전체 p50/p95/max | 커밋 p50/p95/max | 풀 조회 | 읽기 구간 합(①~⑤) | ⓪ getProfile |
|---|---|---|---|---|---|
| 요청 전 4초 쉼 (n=12) | 1,508 / 2,803 / 3,181 | 1,097 / 1,679 / 1,753 | 77 | 87 | 4.3 |
| 요청 전 2.5초 쉼 (n=22) | 1,843 / 2,608 / 5,402 | 1,351 / 2,483 / 3,743 | 74 | 85 | 4 |
→ **격리 요청에서도 커밋이 전체의 70~75%**, 풀 조회는 4~5%.

## 표 2 — 느린 SQL 5개 (7,755 루프, 요청당 문장별 합계 p50, `$on('query')` duration)
| # | 문장(앞 80자) | 회당 | p50 ms | p95 ms |
|---|---|---|---:|---:|
| 1 | `COMMIT` | 2회(⓪ upsert tx + ⑦ 본 tx) | 2,020 (본 tx 1,420 · upsert tx 528) | 3,117 |
| 2 | `INSERT INTO VocabSession (id,userId,date,mode,requestedCount,cardCo…` | 1 | 64 | 1,091 |
| 3 | `SELECT WordEntry.id, surface, reading, meaning, partOfSpeech, … FROM WordEntry` (11컬럼) | 1 | 29 | 32 |
| 4 | `SELECT VocabAttempt.id, wordId FROM VocabAttempt LEFT JOIN VocabSession…` (오늘 시도) | 1 | 1 | 2 |
| 5 | `INSERT INTO VocabAttempt (id,sessionId,wordId,order,surfaceSnap,rea…` | 1 | 1 | 750 |
→ 풀 조회 SELECT 는 3위(29ms). 1·2·5위는 전부 **쓰기 문장이 DB 스토리지에 막히는 시간**이다(p95 에서 INSERT 도 0.75~1.1초씩 멈춤).

## 표 3 — 규모 의존성 (변경 전 코드, 루프; 읽기=①~⑤ 합, 단위 ms)
| 활성 단어 수 | ② 풀 조회 p50 | 읽기 구간 합 p50 | 함수 전체 p50 | 커밋 p50 | 표본 |
|---:|---:|---:|---:|---:|---|
| 676 | 8 | 14 | 850 | 744 | n=6 (재측정 n=10: 10 / 17 / 739 / 576) |
| 1,305 | 14 | 21 | 975 | 651 | n=6 |
| 2,954 | 29 | 36 | 1,546 | 1,020 | n=6 |
| 4,721 | 44 | 51 | 3,105 | 1,783 | n=6 |
| 7,755 | 72 | 82 | 2,635 | 1,420 | n=25 (복원 직후 재측정 n=10: 73 / 84 / 2,283 / 1,150) |
- **읽기 구간은 단어 수에 거의 선형**(다섯 점 기울기 ≈ 0.01ms/단어: 14→21→36→51→82) `[확실]` — 다만 7,755개에서도 80ms 대.
- **함수 전체는 단어 수와 함께 커지는 경향**(같은 시각 보관/복원 A/B: 활성 676 → 739ms, 활성 7,755 → 2,283ms) 이지만 증가분 1.5초 중 읽기 구간은 70ms 뿐 → 나머지는 쓰기·COMMIT 쪽. 정확한 선형 여부는 표본·잡음 때문에 말할 수 없음.
- 지시서의 「N5+N4+N3 ≈ 2,300개」는 실제 2,954개(676+629+1,649)였다 — 규모 점은 676·1,305·2,954·4,721·7,755 다섯 개로 쟀다.

## 표 4 — 커밋 지연 분해 (QA1 한정, 7,755개 보유 상태)
| 실험 | 결과 |
|---|---|
| DB 서버 변수 | MariaDB 10.11.11 · `innodb_flush_log_at_trx_commit=1` · `sync_binlog=1` · `log_bin=ON`(ROW) · `innodb_flush_method=fsync` · doublewrite ON · **`innodb_buffer_pool_size=16MB`** · `innodb_io_capacity=200` · 리두 96MB · semi-sync OFF |
| 한가한 상태 | `profile.upsert` p50 3.6ms · `lockUserRow` 트랜잭션 1.6ms · 읽기 전용 트랜잭션(7,755행 읽기) 전체 76ms(COMMIT 1ms) |
| 쓰기 크기별 COMMIT p50 (n=6~8, 중앙값이 요동) | 세션 행만(카드 0장) 238·575 · 카드 1장 107 · +10장 589~624 · +30장 570 · 영향 행 0 UPDATE 59(p95 735) → **행 수에 비례하지 않는다. 쓰기 트랜잭션마다 대략 0.1~0.9초(p95 0.7~1.6초)의 고정 비용** |
| `wordId` FK 유무 | 카드 10장 null 589ms vs 실제 단어 662ms (차이는 잡음 범위) |
| 큰 읽기와의 상호작용(교대 8회, `txread2`) | COMMIT p50: 쓰기만 176 · **밖에서 풀 읽기 직후 쓰기 1,524** · 밖에서 읽고 1.5초 뒤 쓰기 912 · 안에서 읽기 1,158. 풀을 읽은 **직후의 쓰기**가 느려지고 시간이 지나면 일부 풀림(`txread` 10회: 5컬럼 읽기 후 899ms vs 11컬럼 1,572ms). 기전은 DB·스토리지 I/O 경합으로 보이나 `[추측]` |
→ 사용자가 보는 시간의 하한은 「쓰기 트랜잭션 1회의 COMMIT」(0.25~0.9초, 꼬리 1.5초↑)이며 앱 코드로 줄일 수 없다. 같은 비용이 `recordAttempt`·`finish` 등 다른 쓰기 엔드포인트에도 붙을 것으로 보이나 이번에 직접 재지 않았다 `[가능성 높음]`.

## 표 5 — 프로토타입 비교 (미러 사본, 실제 코드 변경 아님)
정의: **orig** = 변경 전 · **p5** = 후보 5컬럼 `{id,correctCount,wrongCount,lastSeenAt,jlpt}` + 뜻 재료 3컬럼 `{id,meaning,partOfSpeech}` 2회 조회 + 선택 카드만 전체 컬럼(Leader 설계) · **p7** = 후보+뜻 재료를 7컬럼 `{id,correctCount,wrongCount,lastSeenAt,jlpt,meaning,partOfSpeech}` 한 번 조회 + 선택 카드만 전체 컬럼.
| 지표 (7,755개) | orig | p5 | p7 |
|---|---:|---:|---:|
| 조회 페이로드(JSON) | 1,721 KiB | 735+565=1,300 KiB (2문장) | **1,034 KiB** (1문장) |
| 풀 조회 합(②+선택 카드) p50 — 루프 n=25 | 72 | 59 | **44** |
| 읽기 구간(①~⑤) p50 — 루프 n=25 | 82 | 69 | **55** |
| 짝지은 읽기 구간 차이(orig−변형) | — | 14.5ms (18%) | **29.7ms (36%)** |
| 읽기 구간 p50 — 격리 n=22 | 85 | 70 | 56 |
| SQL 문장 수/회 | 14 | 16 | 15 |
| **함수 전체 p50 — 루프 n=25** | 2,635 | 2,185 | 2,619 |
| **함수 전체 p50 — 격리 n=22** | **1,843** | 2,026 | 2,089 |
| 격리: orig 가 더 빠른 쌍 | — | 13/22 | 14/22 |
| 격리: 짝지은 총합 차이 orig−변형 p50 | — | −110ms | −387ms |
- **종단 개선은 검출되지 않았다**: 읽기 구간 −30ms 는 확실하지만 총합의 잡음(커밋 표준편차 ≈ 0.5~1초)이 10배 이상 크다. 총합이 오히려 길게 나온 구간은 커밋·INSERT 지연의 우연이다.
- 작은 풀(676)에서는 읽기 구간 17 → 15ms(차이 2ms).
- **같은 카드 대조**: ① 메모리 대조 — 6,240건(풀 6종: 전체·N5만·5개·3개·뜻 3종 중복·뜻 4종 중복 / 카테고리 3 / 장수 5·10·30 / 천장 4종 / 시드 40 / 오늘 완료 제외 임의 집합, DB 반환 순서를 섞은 입력) **카드 id 순서·뜻 보기·모드 불일치 0**, 그중 FLIP 강등 2,587건 포함. ② 실제 코드 경로(DB) — 시드 4개 × 케이스 4(CHOICE 10장 / 카테고리 5장 / CHOICE 30장 / FLIP 10장) = 16건, orig·p5·p7 의 세션 모드·`downgraded`·카드 전체(order·wordId·표기·읽기·보기·예문) JSON **전부 일치**.
- 동치가 성립하는 이유: 뽑기(`generateWordSet`)는 후보 id 로 정렬하고 `{id,correctCount,wrongCount,lastSeenAt,jlpt}` 만 읽으며, 보기(`pickChoices`)도 id 정렬 뒤 `{meaning,partOfSpeech}` 만 읽는다. 난수 소비 순서가 같으면 같은 결과.

## 라우트 바깥 비용 추정 (항목 4)
- `POST /api/v1/vocab/sessions` 가 하는 일: 프록시(JWT 검증, 관리자 경로만 DB) → `auth()`(JWT 검증 + `user.findUnique` 1문장, 한가할 때 `findUnique` 약 1ms) → `readJsonObject` → `parseCreateSessionBody` → `count` 가 본문에 있으면 `getProfile` 생략(`TodayHome` 은 항상 `count` 를 보냄 — 함수 안 `levelCeilingFor` 의 upsert 1회가 ⓪) → `createVocabSession` → `ok()` 직렬화(카드 10장 약 3KB).
- 알려진 HTTP p50(2,035 / 1,983~2,111 / 2,652ms, 모두 루프)과 같은 조건의 함수 합(2,635 / 2,283 / 2,257ms)이 **같은 범위** → HTTP−함수 차(「라우트 바깥」)는 커밋 잡음(±0.5~1초) 안에 묻혀 뺄셈으로 구할 수 없다. 코드 경로상 추정은 **약 10~25ms 수준** `[추측 — Next 요청 처리 시간은 직접 재지 않음]`. 즉 과거 QA 수치 2.0~2.65초는 사실상 **함수 안의 DB 쓰기 지연**이다.
- 다만 과거 수치는 「생성→끝내기」를 연달아 돌린 루프라 ⓪의 `getProfile` COMMIT 대기(루프 p50 ≈ 530ms, 격리 4ms)까지 부풀어 있다 → 실사용(요청 사이 간격이 큼)은 격리 값 **p50 1.5~1.8초(꼬리 2.6~5초)** 에 가깝다.

## 2단계 설계에 대한 권고 (Leader 설계안과 달라야 할 곳)
1. **목표 재설정 필요.** 「p50 40% 이상 감소」는 이 변경으로 달성 불가능하다(코드가 줄일 수 있는 풀 조회+매핑은 격리 기준 전체의 4~5%, 이상적으로 줄여도 −30ms ≈ −2%). 사용자 체감 개선이 목적이면 이 task 는 효과 대비 가치가 낮다 — 진행 여부를 Leader 가 결정할 것.
2. **그래도 진행한다면 p5 가 아니라 p7 모양을 권한다**: 후보+뜻 재료를 7컬럼 한 번에 읽고 선택된 id 만 전체 컬럼으로 읽는다(p5 는 같은 테이블을 두 번 훑어 −14ms, p7 은 −30ms, SQL 1문장 적음). 동치는 위 대조로 확인됨(변이 시험 대상: 후보 컬럼 하나 빼기 → 동치 깨짐 / 선택 카드 조회 누락 / 뜻 재료 필터 뒤집기). `createTopicVocabSession` 의 `{id, meaning}` 조회는 이미 가볍다.
3. **진짜 병목은 앱 밖(DB 서버 설정)**: `innodb_flush_log_at_trx_commit=1`+`sync_binlog=1`+binlog ROW+fsync 가 쓰기 트랜잭션마다 0.25~0.9초(꼬리 1.5초↑)를 먹는다. 옵션: ① `innodb_flush_log_at_trx_commit=2`/`sync_binlog` 완화(내구성 약화 — 최대 1초 분량 손실 가능) ② `innodb_buffer_pool_size` 16MB → 증설 ③ binlog 용도 점검(복제·PITR 쓰는지) ④ 리두/binlog 를 빠른 디스크로. **공유 NAS DB 라 전 프로젝트에 영향이 가는 운영 결정 → 사용자 승인 사항**이며 효과는 미검증(읽기 전용 변수 조회까지만 했다) `[추측]`.
4. **앱 코드로 실제 체감을 줄이는 소수 옵션**(검증·일관성 검토 필요, 이번 범위 밖): ⓐ `getProfile` upsert 를 `findUnique` 우선 + 없을 때만 upsert 로(읽기뿐인 호출이 트랜잭션을 열어 COMMIT 대기에 걸림; 격리 3.6→1ms, 연달아 쓰는 구간에서는 수백 ms) — `preferences` 소유라 Leader 판단. ⓑ 후보 목록 메모리 캐시+무효화(쓰기 경로가 많아 일관성 위험, Leader 가 이미 보류한 항목). ⓒ UI 쪽 즉시 반응(designer).
5. **QA 방법론 주의**: 루프(생성→끝내기 연달아)는 COMMIT 대기를 부풀리고(루프 ⓪ 530ms vs 격리 4ms), 표본 25쌍으로는 ±300~500ms 효과를 검출하지 못한다. 2단계 교대 A/B 를 한다면 요청 사이 ≥2.5초 쉼, 쌍 ≥ 30, 그리고 **서버 단계 타이머(읽기 구간) 병기** 로 판정하고, 총합 p50 목표는 쓰지 말 것.
6. **「주의: 같은 방식의 주제 세트 경로」** — `createTopicVocabSession` 은 `wordEntry.findMany({id, meaning})`(가벼움)이라 동일 패턴 아님. 재풀기(`replayVocabSession`)도 이미 3컬럼.

## 남은 위험·주의
- 측정은 공유 NAS 위에서 약 1시간 연속 쓰기를 한 뒤라 DB 꼬리가 후반에 더 길어졌다(격리 최대 7.4초). 절대 수치보다 **구성 비율**(커밋 70% 이상, 풀 조회 5% 미만)을 믿을 것.
- 원인의 하위 기전(버퍼풀 16MB 에 의한 플러시·fsync 경합)은 직접 확인하지 못한 추정이다 `[추측]`. 확정된 것은 「행 수와 무관한 고정 커밋 비용」과 「큰 읽기 직후 쓰기 커밋이 더 느려짐」이라는 관측뿐이다.
- 저장소 소스·docs·prisma 변경 0, 커밋·push 0. 미러(`~/.node-local/thekaiwa-dev057`, `dev057-tree`)와 `scratch/` 도구는 남겨 둠.
