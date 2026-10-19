---
task_id: task-068
title: "단어장 개선 — 7개씩 페이징 · 기본 단어 7,755개 처음부터 추가 · 난이도 필터/기본 단어 버튼 제거 · 조각 「없음」 제거와 조각 유형 재정의 · 직접 입력 수준→조각 (IMP-0037~0042, standard·R2)"
status: done
waiting: ""
base_ref: 1ecd475
risk_level: "R2"
roles_involved: [leader, judge, designer, developer, prompt-engineer, reviewer, qa, deployer]
related_tasks: [task-051-improve-n5-vocab-pack, task-023-improve-vocab-screen, task-008-vocab-today-words, task-053-improve-today-words-level-weight, task-057-perf-today-words-set-creation, task-063-nas-db-write-settings]
tags:
  - type/task
  - domain/vocab
  - domain/improvement
aliases:
  - 단어장 개선
  - 기본 단어 처음부터 추가
  - 조각 유형 재정의
  - task-068
created: 2026-10-14
updated: 2026-10-19
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-068-wordbook-v1.html"
  artifact_url: "https://claude.ai/artifact/AUnTux7AD2XCwE2n5Bx5U9"
  content_sha256: "568bdb54aaf7e0cf185183565738deb716c5f24cb42d25285112b7716e7ea31a"
  decided_by: "judge"
  rule_id: "DM-kw-delta"
  approved_by: "user"
  approved_at: "2026-10-14T12:55:03+09:00"
  approval_quote: "task-068 데모 v1 승인, 결정(D1~D10)은 권고대로"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

# task-068 — 단어장 개선 (IMP-0037~0042)

## 사용자 요청 (원문, 2026-10-14)
> 단어장 메뉴에 대하여 개선작업 진행해줘
> 1. 단어장 목록에 대하여 페이징처리해줘. 페이징은 7개씩 해줘
> 2. 기본 배포해놓은 단어 7755개의 단어는 처음부터 추가해놔야하고 사용자가 필요한 단어들을 추가하는 형태로 구현될 수있도록 해줘.
> 3. 기본 단어를 모두 추가했기에, 조건 필터중에 난이도에 대한 것은 제거해줘
> 4. 조각 필터 중에 '없음'은 제거해줘
> 5. 지금 추가되어 있는 단어 중에 조각이 '없음'으로 분류되어 있는 것이 있는데 기존에 분류되어 있는 단어들을 기준으로 조각에 대한 유형을 다시 정의해줘
> 6. 단어장 추가시 직접 입력의 경우 '수준' 항목은 제거해주고 대신에 조각에 대한 선택을 할 수 있는 항목으로 교체해줘. 이것은 이미 배포되어 있는 단어들도 포함된 내용으로, 배포된 단어들도 조각항목으로 표기될 수 있도록 해줘

백로그: [[IMP-0037-words-paging-7]] · [[IMP-0038-words-default-pack-preadd]] · [[IMP-0039-words-remove-level-filter]] · [[IMP-0040-words-remove-chunk-none-chip]] · [[IMP-0041-words-chunk-types-redefine]] · [[IMP-0042-words-add-chunk-instead-of-level]] (6건 모두 `planned` → 이 task).

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-051-improve-n5-vocab-pack]] — 기본 단어 팩 N5~N1 7,755개(676·629·1,649·1,767·3,034)를 **버튼으로 넣는** 방식으로 배포(`addSeedPack`, 사용자 행 잠금, 표기 바이트 일치 중복은 `skipped`, `source=SEED`, `category`=단계 이름). 옛 `N5 기초` 50개 행은 안 바꿈. 사용자 표본 검수 대기.
- [[task-023-improve-vocab-screen]] — 단어장 조각 필터·뱃지·상세 소리 듣기(IMP-0001~0003). 조각 줄은 전체·이름·액션·느낌·꾸밈·없음.
- [[task-008-vocab-today-words]] — 단어장 CRUD·분류·정렬 `GET /api/v1/words`(#40, 커서 방식 `limit`·`cursor`), 오늘의 단어.
- [[task-053-improve-today-words-level-weight]]·[[task-057-perf-today-words-set-creation]] — 오늘의 단어는 내 단어장에서 뽑고 단계 우선 가중. 7,755개 풀 조회는 72ms(지연 원인 아님) — 7,755개가 한 사용자에게 모두 있어도 오늘의 단어는 설계상 문제 없음.
- [[task-063-nas-db-write-settings]] — 공유 NAS MariaDB 쓰기 지연(`innodb_flush_log_at_trx_commit=1`·`sync_binlog=1`, 버퍼풀 16MiB, 권한 때문에 조정 못 함, blocked). 대량 insert 는 **한 트랜잭션 `createMany`** 로 커밋 횟수를 줄여야 한다.
- 승인된 교훈(`/이슈기록 관련 단어장 백필 DB 데이터`): 없음.

## 사실 (2026-10-14 직접 확인 — [확실])
- **사용자 DB**: 계정 8개 — 실사용자 구글 1개(SUPER_ADMIN)의 단어 **678개**(전부 `source=SEED`, 조각 없음 33행, 수준 없음 0행)·QA용 test 계정 7개는 단어 0개. 678 = 옛 50개 + N5 팩 628개(중복 제외)로 보인다 — N4~N1(약 7,077개)은 들어 있지 않다. (앞서 제가 한 추측 「50개」는 틀렸다.)
- **단어장 화면**: 한 번에 30개(`WordsScreen` `PAGE = 30`) + 「단어 더 보기」(커서). 기본 단어 추가 버튼은 ① 빈 단어장 화면(`WordsEmpty` `noWords`) ② 오늘의 단어 빈 카드(`TodayWordsCard`) ③ 단어 추가 시트 맨 아래 작은 글자(`WordAddSheet`, 설정의 학습/목표 수준 팩만) 세 곳.
- **필터 줄**: 검색 / 분류 칩(`CategoryChips` = `WordEntry.category` 값 — 팩 단어의 분류는 단계 이름 「초보자 (N5)」…, 옛 50개는 「N5 기초」; 오늘의 단어 카드도 같은 부품을 씀) / 조각 칩(`ChunkChips` = 전체·이름·액션·느낌·꾸밈·없음) / 정렬 / 보관함.
- **조각**: `ChunkType` enum = NAME·ACTION·FEELING·MODIFIER 4가지, `WordEntry.chunkType`/`Correction.chunkType` 은 NULL 허용(=「없음」), `TopicChunk.chunkType` 은 필수. 시드 7,805행: 이름 3,327 · 액션 2,576 · 꾸밈 1,031 · 느낌 669 · **없음 202(2.6%)**. 없음 202행 = 표현(인사·관용구·접속·감탄) 117 · 기타(접사·조수사·대명사류) 62 · 조사 16 · 부사 3 · な형용사 3 · 명사 1 — 네 유형 정의에 안 맞는 부류다.
- **계정 생성/수준**: `WordEntry.jlpt` 는 DB 에 남고(단계 가중 등이 읽음) 화면 입력 칸만 없앤다. `Profile` 에는 「기본 단어를 넣었는지」 표지가 없다.

## DB 구조 (현재 → 목표, 2026-10-14)

**현재 (사실 — 코드로 확인)**: 단어는 한 테이블 `WordEntry` 뿐이고 **전부 사용자 소유**다(`userId` 필수, 사용자 삭제 시 함께 삭제). 컬럼: 내용(`surface`·`reading`·`meaning`·`partOfSpeech`·`chunkType`·`jlpt`·`example`·`exampleKo`·`note`·`category`) + 출처(`source` = MANUAL·CORRECTION·LESSON·EVALUATION·TUTOR·SEED, `sourceRefId`) + **사용자별 학습 상태**(`correctCount`·`wrongCount`·`lastSeenAt`·`lastResult`·`archived`·`archivedAt`). 기본 단어는 따로 있지 않고 팩 버튼을 누르면 `source=SEED` 사본이 그 사용자 행으로 복사된다(실사용자 678행). 참조하는 곳: `VocabAttempt.wordId`·`EvaluationItem.wordId`·`Correction.savedWordId`(모두 FK, 삭제 시 SetNull, 표기·뜻은 `…Snap` 스냅샷 컬럼에 별도 보존). 코드가 `prisma.wordEntry` 를 직접 쓰는 곳은 6개 모듈(`vocab/words.ts`·`vocab/sessions.ts`·`vocab/seedPack.ts`·`lessons/memo.ts`·`evaluation/materials.ts`·`reviewSchedule/index.ts`).

**목표 (사용자 지정: 기본 단어 공용·읽기 전용 / 사용자 단어는 사용자만 관리)** — Leader 설계안(데모·감사에서 확정):
- `WordEntry` 한 테이블에서 **구분한다**: 기본 단어 = `userId` 없음(NULL) + `source=SEED` + 고정 키 `seedKey`(유일, 시드 재실행에 멱등), 사용자 단어 = `userId` 있음. 기존 `where {id, userId}` 로 고치고 지우는 모든 쿼리가 기본 단어(userId NULL)를 **자연히 건드리지 못한다**(읽기 전용을 코드 한 곳이 아니라 쿼리 모양으로 보장) + 서버 라우트에서 기본 단어 수정·삭제 요청은 명시 거절.
- 사용자별 학습 상태는 새 테이블 `UserWordState(userId, wordId, correctCount, wrongCount, lastSeenAt, lastResult, archived, archivedAt)`(유일 `userId+wordId`, 사용자·단어 삭제 시 cascade)로 모은다 — 기본 단어에 쓰는 유일한 길. 사용자 단어도 같은 테이블을 쓰면 조회 경로가 하나가 된다(권고: 모든 단어의 학습 상태를 여기로, 기존 `WordEntry` 의 상태 컬럼은 이관 뒤 미사용).
- 단어장 목록·오늘의 단어 풀·평가 재료·복습 재료는 「내 단어 + 기본 단어」를 읽고 상태는 `UserWordState` 를 LEFT JOIN. 쪽 번호 조회(7개씩)는 offset + `total`.
- 기본 단어는 **앱이 쓰지 않고 시드 스크립트만** 쓴다(`prisma/seed-data/jlpt/*.json`·`words-n5.json` → 멱등 upsert, 오타 수정도 시드로 전원에게). 사용자 단어와 같은 표기·읽기를 입력하면 막고 안내(D10).
- `VocabAttempt`/`EvaluationItem`/`Correction` 의 FK 는 같은 테이블이라 **그대로 기본 단어 id 를 가리킬 수 있다**(스키마 변경 최소).
- **기존 실사용자 678행(전부 SEED 사본)은 이관**: 기본 단어 행과 표기·읽기로 짝을 맞춰 ① `UserWordState` 로 학습 상태 복사 ② `VocabAttempt`/`EvaluationItem`/`Correction` 의 단어 id 를 기본 단어 id 로 옮김 ③ 사본 삭제(단어 id 를 옮기기 전에 지우면 SetNull 로 연결이 끊긴다). dry-run 후 **사용자 승인**.
- **스키마 변경(공유 DB, 사용자 승인)**: `WordEntry.userId` NULL 허용 + `seedKey` 컬럼(유일) + 새 테이블 `UserWordState`. 모두 추가·완화라 기존 행·옛 코드(`where userId`)에 영향 없음. 순서: 스키마 push → 기본 단어 시드 → 새 코드 배포 → 678행 이관.
- **영향**: ① QA(test) 계정도 기본 단어 7,755개가 보이게 된다 → 「빈 단어장」을 기대하는 라이브 스모크·시험(`tests/live/*`, 단어 0개 가정)은 갱신 필요 ② 29개 시험 파일이 `wordEntry` 를 쓴다(가짜 DB 쓰는 단위 시험 위주, 갱신 범위 확인 필요) ③ 「기본 단어 추가」 코드·API #46b 는 제거.

## Leader 해석 (사용자가 바꾸라면 바꾼다 — 데모에서 확인받는다)
1. **7개씩 페이징** = 단어장 목록(30개+더 보기)을 쪽 방식으로 바꾼다. 7,755개 이상이면 약 1,108쪽이라 `‹ 이전 · n/N · 다음 ›` 에 쪽 바로가기가 필요할 수 있다(서버 #40 은 커서 방식 → 쪽 번호 조회 지원 필요, `total` 은 이미 있음).
2. **기본 단어 = 공용 읽기 전용** (**2026-10-14 사용자가 DB 구조를 지정해 이 항목의 방식이 바뀜** — 아래 「DB 구조」). 사용자별 복사·백필·가입 시 훅은 하지 않는다. 기본 단어 7,755개는 단어 테이블에 소유 사용자 없는 공용 행으로 한 번만 두고 모든 사용자가 계정 생성 즉시 본다(읽기 전용). 사용자가 추가한 단어는 그 사용자 값으로 적재되고 그 사용자만 관리한다. 사용자별 학습 기록(맞힘/틀림/마지막 결과)·보관은 사용자별 상태 테이블에 둔다. 기본 단어 추가 버튼 3곳 제거. (이전 해석 「가입 때 넣기 + 기존 실사용자 백필 약 7,077행」은 폐기.)
3. **난이도 필터 제거** = 분류 칩 줄(난이도 이름 칩)을 없앤다. 분류 칩 전체를 없앨지, 난이도 이름 칩만 없애고 다른 분류는 남길지 → 데모 결정. 오늘의 단어 카드의 분류 칩 영향도 정한다.
4. **조각 「없음」 칩 제거** = 5번이 끝나 조각이 모두 채워진 뒤에만 의미가 있다.
5. **조각 유형 재정의** = 선택지 ① 네 유형 유지 + 202행을 가장 가까운 유형에 배정 ② 유형 추가(예: 「표현」 = 인사·관용·접속·감탄 117행 + 접사·조수사·조사 78행은 꾸밈에 배정) — ②는 `ChunkType` enum(MariaDB ENUM) 값 추가 = 공유 DB 스키마 변경(사용자 승인), 라벨·칩·시험 파급. Leader 권고 ②(한 유형 추가) — 인사·접속은 「이름/동작/느낌/꾸밈」 어디에도 안 맞고, 접사·조사류는 꾸밈과 가깝다. 데모에서 실제 단어 예시로 비교.
6. **직접 입력 폼** = 「수준」 칸 삭제 → 「조각」 선택(필수 선택). 기본 팩 단어도 행·상세·수정 시트에 조각이 보이게(지금 어디서 빠졌는지 확인). 직접 입력 단어의 수준은 비워 둠.

## 열린 결정 (데모에서 ★ 권고안과 함께 묻는다 — designer 가 화면으로 보여 준다)
- D1 쪽 이동: ★ A `‹ 이전 · 3 / 1,108 · 다음 ›` + 쪽 번호로 이동 / B 이전·다음만 / C 번호 칩.
- D2 쪽 상태: ★ 검색·필터·정렬·보관함이 바뀌면 1쪽부터, 단어 상세를 닫으면 보던 쪽 유지.
- D3 분류 칩: ★ A 분류 칩 줄 전체 제거(난이도 이름뿐이므로) / B 난이도 이름 칩만 제거. 오늘의 단어 카드 분류 칩도 같은 결정.
- D4 조각 유형: ★ B 「표현」 한 유형 추가(5유형) / A 네 유형 유지 + 배정 / C 두 유형 추가. 각 안에서 202행이 어디로 가는지 예시 표.
- D5 직접 입력 조각 선택: ★ 필수(칸 안내, 선택 안 하면 저장 불가 안내) / 기본값 「이름」 미리 선택.
- ~~D6 처음부터 추가의 대상·시점~~ **폐기**(공용 기본 단어라 복사·백필·가입 훅이 없다).
- D6′ 기본 단어 보관(숨기기): ★ 허용(내용은 읽기 전용, 보관 상태만 사용자별) / 보관도 막음.
- D7 기본 단어 추가 버튼 3곳과 빈 단어장 화면: ★ 버튼 제거, 빈 화면은 「단어 직접 추가」만.
- D8 조각 뱃지 표시 범위: ★ 목록 행·상세·수정·추가 시트 모두(기본 팩 단어 포함).
- D9 내 단어가 기본 단어와 같은 표기·읽기일 때: ★ 저장을 막고 「기본 단어에 이미 있어요」+ 그 단어 보기 / 허용(중복).
- D10 출처 필터: ★ 목록 위에 「전체 · 내 단어 · 기본 단어」 분할 칩 추가(분류 칩을 없애는 대신 내 단어만 모아 보는 길) / 추가 안 함.
- D11 기본 단어 표시: ★ 행·상세에 「기본」 표시 + 기본 단어 상세에는 수정·삭제 없이 보관(숨기기)만 / 표시 없음.

## 승인된 결정 (2026-10-14 12:55 사용자 「task-068 데모 v1 승인, 결정(D1~D10)은 권고대로」 — 데모 v1 ★ 전부, sha256 `568bdb54…`)
- **D1** `‹ 이전 · n / N · 다음 ›` + 가운데를 눌러 쪽 번호 입력으로 이동, 쪽 줄은 목록 바로 아래(고정 줄 규칙 예외 없음), 한 쪽 7개 · **D2** 단어장 화면에 있는 동안만 보던 쪽 기억(검색·조각·정렬·보관함·출처가 바뀌면 1쪽, 상세·추가 시트를 닫으면 보던 쪽) · **D3** 난이도 이름 칩(초보자 (N5)…최상급 (N1)·옛 「N5 기초」)만 제거, 직접 정한 분류 칩은 남김, 오늘의 단어 카드도 같게 · **D4** ★ B = `ChunkType` 에 「표현」(`EXPRESSION`) 한 값 추가(5유형), 조각이 빈 기본 단어 200행 → 표현 122·꾸밈 64·이름 11·느낌 3 · **D5** 직접 입력은 조각을 꼭 고름(「수준」 칸 제거) + 선생님 초안(뜻 채우기)이 조각도 채움 · **D6** 기본 단어 보관(숨기기) 허용(내용은 읽기 전용) · **D8** 조각 뱃지는 목록 행·상세·수정·추가 모두 · **D9** 내 단어가 기본 단어와 같은 표기·읽기면 저장 막고 「기본 단어에 이미 있어요」+ 그 단어 보기 · **D10** 「전체 · 내 단어 · 기본 단어」 출처 칩 추가, 행 표시는 「내 단어」에만.
- **Leader 확정(구현 때 정한 것, 화면 밖)**: ① `ChunkType` 새 값 이름 `EXPRESSION`(라벨 「표현」), 교정·수업·평가 프롬프트는 4유형 그대로(새 값을 내지 않음, J12) ② 기본 단어 = 단계 팩 N5~N1(7,755) ∪ 옛 `words-n5.json` 중 팩에 없는 행(표기·읽기 기준 중복 제거 — 합쳐서 하나도 잃지 않게), `seedKey` 형식 `N5-0001`(단계-일련번호) ③ 「최근 추가」 정렬에서 기본 단어끼리는 `seedKey` 오름차순(N5→N1), 내 단어가 앞(J7) ④ 사용자 단어 학습 상태도 `UserWordState` 로 모음(조회 경로 하나), `WordEntry` 의 상태 컬럼은 이관 뒤 미사용으로 남김(컬럼 삭제는 후속·승인) ⑤ 실사용자 678행 이관: 표기·읽기로 기본 단어와 짝 맞춤 → 학습 상태 복사 → `VocabAttempt`/`EvaluationItem`/`Correction` 단어 id 옮김 → 사본 삭제(검증 뒤 별도 승인). 기본 단어에 짝이 없는 행은 없도록 ②에서 합침.
- **분담**: **designer**(구현 가이드 `docs/screens.md` §28 + `api-contract.md` #40 쪽 번호·출처 필터·#41 초안 조각·#46b 제거) → **S-A**(스키마 `userId` NULL·`seedKey`·`UserWordState`·`EXPRESSION` + 기본 단어 시드·조각 재분류 + 이관 스크립트(dry-run/apply 분리) — DB 접속·push 금지, 단위 시험은 가짜 DB) → **S-B**(6개 모듈 조회·상태 갱신 전환 + 라우트 + 시험·QA 스모크 갱신) → **U**(화면) · **prompt-engineer**(`wordEnrich` 초안 조각 칸, 시험 픽스처) 병행. 스키마 push·기본 단어 시드·이관 apply 는 **사용자 승인 후**, QA 는 승인된 push 뒤 전용 환경에서.

## 구현 가이드 완성·Leader 결정 (2026-10-14, `docs/screens.md` §28 + `api-contract.md` §2-9 개정, [[task-068-designer-record]] [가이드])
- 산출: S-A([[task-068-dev-sa-record]])는 스키마·시드·재분류·이관 스크립트·시험(14건, 변이 15개)까지 끝냄 — 기본 단어 **7,757행**(팩 7,755 + 옛 50개 중 짝 없는 2행 友だち·ご飯), 재분류 표현 122·꾸밈 64·이름 11·느낌 3(빈 조각 200→0). PE `wordEnrich@v2`([[task-068-pe-record]]) 완료 — 라이브 24/25. 이어서 **S-B1/S-B2(서버 모듈·라우트)·U1/U2(화면)** 병렬.
- **L1** #41 저장 `chunkType` 은 「선택」(폼만 꼭 고르게, 오늘의 단어 결과의 [단어장에 넣기]·채택 경로는 조각 없이도 저장) — **수용**. **L2** v1 「추가만」 규칙의 예외 4건(`cursor` 폐지·`chunkType=none` 거절·`jlpt` 거절·#46b 삭제)을 같은 배포에서 함께 바꿈 — **수용**(폐기 기간 없음). **L3** 새 코드 배포 ~ 678행 이관 사이 같은 단어 두 줄 — **수용**: 이관 dry-run 을 배포 전에 검증하고 **배포 직후 같은 자리에서 apply**(사용자 승인은 두 건을 함께 받음). **L5** 설정 「지금 수준」 도움말 문구 변경 — 수용. **L6** 정렬은 `jlpt`(N5→N1) 다음 `seedKey` — 수용. **L7** #47 `cta` 에서 `SEED_PACK` 삭제 — 수용. **L8** 「내 단어」 빈 화면의 작은 빈틈 — 수용.
- **L4 (Leader 변경 결정)**: 교정 채택(#35)·제안 채택(#38)에서 넣을 단어가 **기본 단어와 같은 표기·읽기면 409 로 채택을 되돌리지 않는다** — 기본 단어 7.8천 개라 흔해질 충돌이 핵심 기능(교정 채택)을 막는 퇴보가 되기 때문. 이때는 단어를 새로 만들지 않고 **그 기본 단어 id 를 `savedWordId`/결과로 연결**하고 채택은 그대로 진행(내 단어끼리의 중복은 지금처럼 409). 직접 입력(#42)의 `BASE_DUPLICATE` 409 는 D9 대로 유지. 구현: `createWord` 에 채택용 옵션(기본 단어 중복이면 기존 기본 단어를 돌려줌) → 채택 라우트 두 곳.
- **분담(확정)**: S-B1 = `words.ts`·`wordState.ts`(새 공용 도우미)·`enrich.ts`·`seedPack.ts`·`types/seedPack.ts`·`learning/index.ts`·`app/api/v1/words/**`·`corrections/[id]/accept`·`proposals/[id]/accept` 라우트 + 해당 시험 / S-B2 = `sessions.ts`·`materials.ts`·`memo.ts`·`reviewSchedule/index.ts`·`conversation/corrections/drawer.ts` + 해당 시험 + `tests/live/*` 스모크 갱신 / U1 = 목록 화면(`WordsScreen`·`WordsPager`·`WordsJumpSheet`·`wordsPaging`·`logic`·`ChunkChips`·`WordsSkeleton`·자리표시·`labels`·`types/vocab`) / U2 = 폼·상세·행·홈(`WordForm`·`WordAddSheet`·`WordDetailSheet`·`WordRow`·`WordChunkPicker`·`validate`·`WordsEmpty`·`TodayWordsCard`·`TodayHome`·교정 모음 prop·설정 도움말).

## 구현·감사 진행 (2026-10-14 저녁)
- **구현 완료**: S-A(스키마·시드 7,757·재분류 122/64/11/3·이관 스크립트) · PE(`wordEnrich@v2`, 라이브 24/25) · S-B1(단어 서버·라우트·`wordState.ts`) · S-B2(세트·평가·메모·복습·교정 모음 + 라이브 스모크 파일 갱신, 실행 안 함) · U1(목록 7개씩 쪽·쪽 이동 시트·출처 칩·안내 띠) · U2(폼 조각 선택·기본 단어 읽기 전용 상세·넣기 UI 제거). 문서 정정(L4: 채택 경로는 기본 단어에 연결, domain-model).
- **감사 3갈래 모두 PASS_WITH_NOTES**([[task-068-rev-a-record]]·[[task-068-rev-b-record]]·[[task-068-rev-c-record]], Critical 0·High 1): A **High REV-068A-1**(이관 합산 시 새 상태가 옛 누적 기록을 덮음) → 합산(+1/·최댓값·보관은 대상 우선)·멱등 표지(사본 옛 칸 0 되돌림·사본 상태 행 삭제)로 수정 / A-2·-4·-5 고친 사본 보호(`edited`)·conflict 제거·방어 깊이 / B Medium REV-068B-1(평가 재료 풀 2,000개 상한이 내 새 단어를 밀어냄) → 상한 제거 + **평가 재료에 오늘의 단어와 같은 수준 상한(`levelFactor`) 적용**(N5 학습자 평가에 N1 단어가 39% 섞이는 퇴보를 Leader 가 발견) / C Medium REV-068C-1(쪽 넘기는 중 다시 읽기 실패 시 고착) → `pageError` 로 수정, C-4 안내 띠 ✕ 스크롤·C-5 스크립트 경로 / C-3(`WordsScreen` 배선 시험 구멍)은 QA 필수 항목.
- **이관 edited 판정 수정(Leader 발견)**: 옛 소유자 시드 50행 중 35행이 팩 쪽 내용과 달라 사용자가 안 고쳐도 `edited 35` 로 잡히는 문제 → 「고쳤는지」를 (a) 짝 기본 단어 내용 또는 (b) 사본이 만들어질 때 받은 옛 시드 모양과의 비교(둘 다와 다르면 edited)로 변경, 실제 JSON 회귀 시험 edited 0, 678 모의 ALL OK. **이관 부분 재감사 A2 PASS_WITH_NOTES**([[task-068-rev-a2-record]], Critical 0·High 0·Medium 1·Low 5; 변이 22 중 20 잡힘, 합산·멱등을 지연 실행 가짜 DB 로 직접 재현) — Medium REV-068A2-1(`edited` 비교에 `category`·`chunkType` 없음 → 사용자가 고친 분류·조각이 삭제와 함께 사라짐)은 코드 비교를 늘리지 않고 **⑥ 직전 읽기 전용 SQL 확인 + 백업 세 번**으로 처리(런북 보완, [[task-068-dev-sa-record]] 끝 「Leader 보완」).
- **합본 게이트(3차, 100개 파일 overlay)**: prisma validate 0·generate 0·tsc 0·eslint 오류 0·시험 4,066 중 통과 4,064·실패 0·skip 2·`next build` 0.
- **알려진 한계(수용·기록)**: 「でも」 등 시드 재분류(표현)와 선생님 초안(꾸밈) 불일치(미리 선택일 뿐) · 평가에서 내 단어 우선 규칙 없음(오답 0인 내 단어의 확률이 풀 크기에 비례해 낮음) · N5 학습자 평가에 N4·N3 가 섞임(기대 N5 71·N4 20·N3 9%, 세트와 같은 계수) · 레슨 메모 제안 페이로드에 `chunkType` 안 실림(채택 단어 조각 null 허용) · `task010-ui-e2e.mjs` 4k·4k2·4m 실패 예상(메모 단어가 기본 단어라 제안 카드가 사라짐) · 이관 후 옛 릴리스 롤백 시 사본 기록이 0 으로 보임·「표현」 단어가 있으면 옛 목록 오류 → 덤프 복원이 유일한 길 · 이관 중 사용자가 사본을 풀면 증가분 손실 가능(앱 안 쓰는 시간에 실행).

## 1단계 DB 실행 완료 (2026-10-14 15:40, 사용자 승인 「1단계 실행 (권장)」 — 배포·이관·삭제 제외)
- **백업**: `mysqldump --single-transaction` 전체 스키마 → `~/db-backups/thekaiwa-pre-task068-20261014-153944.sql.gz`(395,451B·권한 600, gzip 무결성 OK, 55개 표, `WordEntry` 포함, 끝 표시 확인). 접속 정보는 임시 설정 파일(600)로만 쓰고 즉시 삭제.
- **스키마 push**: 먼저 `prisma migrate diff`(읽기 전용)로 차이 SQL 43줄을 확인 — 조각 `ENUM` 4곳(`Correction`·`EvaluationItem`·`TopicChunk`·`WordEntry`)에 `EXPRESSION` 추가 · `WordEntry.seedKey` 추가·`userId` NULL 허용·`seedKey` 유일 인덱스 · 새 표 `UserWordState`(+인덱스·FK 2). **삭제·축소 변경 0.** `db push` 첫 시도는 「유일 제약 추가 시 중복이 있으면 실패」 일반 경고(`seedKey` 는 새 컬럼이라 전부 NULL — 중복 불가)로 멈췄고, 같은 SQL 임을 확인한 뒤 `--accept-data-loss` 로 반영(49초, exit 0).
- **기본 단어 시드**: dry-run(DB 안 염) → `--check-db`(적용 전 seedKey 행 0·missing 7,757) → `--apply`(31초, 8조각×1,000행 한 트랜잭션) → `--check-db`: `seedKey rows=7757 · present 7757 · missing 0 · unknown 0 · drift 0 · contentDiff 0 · owned 0` = 기대값과 일치. 최종 조각 분포 이름 3,324 · 액션 2,561 · 느낌 663 · 꾸밈 1,087 · 표현 122 · 빈 값 0.
- **옛 운영 코드 호환 확인(읽기 전용)**: 릴리스 `20261013-211110-20813a8d`(옛 코드) — 헬스 PRODUCTION ok 11/11 · `/drawer/words`·`/study/today`·`/drawer/corrections`·`/study/ai`·`/plan` 200 · QA2 로 `GET /api/v1/words?limit=5` 200·항목 0·합계 0(기본 단어가 옛 코드에 안 보임), 쿠키·`.env` 즉시 삭제.
- 다음: 실제 DB QA(QA 서버 `127.0.0.1:3011` ← 합본 미러 새 코드, QA 계정만, 실제 AI 호출 최소) → 통과 시 배포 승인 요청.

## 실제 DB QA 결과 (2026-10-14 16~18시, QA 서버 3011 ← 합본 미러, QA 계정만, LLM 호출 소량)
- **W1 목록·쪽·필터**([[task-068-qa-w1-record]]): 3정렬×1,109쪽 전수 순회 id 7,757 유일(중복·누락 0)·시드 JSON 대조 순서 불일치 0·`cursor`/`chunkType=none`/잘못된 `page·limit·sort·source` 거절 모두 계약대로. 화면·쪽 이동 시트·D2 쪽 상태·안내 띠 ✕ 비스크롤 PASS. **배선 구멍(REV-068C-3) 실화면 확인 PASS**(늦게 온 옛 응답 무시·쪽 넘기는 중 다시 읽기 500 복구·내 단어 마지막 쪽 삭제 시 앞 쪽·`visibilitychange`). 응답 시간 recent p50 96/p95 107ms·wrong 125/317ms(최대 2,257ms 일시 지연)·surface 101/111ms. **결함 QA068W1-1(QA 등급 Medium) 쪽 줄 y 위치가 쪽마다 흔들림**(390 기본 설정 41.9px·360/412 66.5px, 원인 행 높이 72.6~105.8px 가변 vs 빈 자리 단일 높이) — Leader 판단: **알려진 한계로 수용**(「≤2px」기준은 쪽 줄이 한 화면에 고정된 task-067 시트의 것; 여기서는 쪽 도착 시 목록 맨 위로 스크롤되고 쪽 줄이 목록 끝에 있어 끝까지 내려 누르는 동작에는 영향이 없음 — 폰에서 거슬리면 행 높이 고정으로 후속 수정).
- **W2 폼·읽기 전용·격리**([[task-068-qa-w2-record]]): API(읽기 전용 403 `READ_ONLY`·생성/수정/삭제·`BASE_DUPLICATE` 409·보관 사용자 격리·stats) + 선생님 초안(LLM 2회, 勉強→ACTION 등) + 화면(「수준」 칸 없음·조각 5칩·「조각을 골라 주세요」·초안 미리 선택·실제 `映画` 중복 안내·기본 단어 상세 읽기 전용·편집 우회 6종 차단)·교정 모음 4칩·`chunkType=EXPRESSION` 400·접근성 360/390/412×라이트/다크 — **결함 0**.
- **W3 세트·성능·스모크**([[task-068-qa-w3-record]]): 세트 생성 p50 2.3s·p95 5.4s(이전 기준 p50 2.0~2.6s·꼬리 2.6~5s 범위 — 회귀 없음, 풀 조회 구간 p50 32ms) · 수준 가중(N5 학습자 300장: N5 202·N4 67·N3 31·N2/N1 0) · 보관 제외(결정적 확인) · 학습 상태 갱신·격리(QA3 불변)·공용 행 불변·같은 세트 두 번/동시 4건 끝내기 +1 한 번 · 내 단어가 풀에 들어감·삭제 정책(스냅샷 유지, 상태 cascade) — PASS. 라이브 스모크 `task008` 73/80: 실패 7건은 **제품 결함 0** — (가) 5건 task-059 이전 사양(세트 기본 모드 CHOICE→FLIP)에 묶인 낡은 기대값(스모크가 task-059 이후 한 번도 갱신·실행되지 않음) · (나) 11c `コーヒー` 기본 단어라 409 · 2e 405(계약 문구 「404 또는 405」로 정정). 고칠 스모크 목록은 QA 기록(줄 번호 포함) — **후속(이번 배포와 별개)**.
- **이관 `plan`(읽기 전용, 실제 DB, 승인 요청 전)**: 사본 678(사용자 1)·기본 단어 7,757·짝 678/678·unmatched/duplicate/ambiguous 0·**edited 0**·seed-origin 35 · 상태 합산 대상 40(create 40·merge 0) · 참조 `VocabAttempt` 70·`RepetitionItem` 3(충돌 0)·`EvaluationItem`/`Correction` 0, 참조가 걸린 사본 45 · `LearningObservation` 30(추가 전용, 안 옮김) · **ALL OK**.
- QA 서버(3011) 종료, 합본 미러 `.env` 삭제. QA 계정 정리 확인(내 단어 0·보관함 0·진행 중 세트 없음; 남은 건 QA4 DONE/ABANDONED 세트 몇 개와 값 0의 상태 행 — 해롭지 않음).

## 운영 배포·이관 (2026-10-14 16:27~, 사용자 승인 「배포 + 이관 함께 (권장)」 — 사본 삭제 제외)
- **배포**: 푸시 `20813a8..c3ffa32`(코드 `81138b9` · 문서 `0fe8441` · 볼트 `c3ffa32`) → webhook → 릴리스 `20261014-162727-c3ffa322`, `RELEASE_RESULT {"status":"ok","migrated":false}`, **롤백 대상 `20261013-211110-20813a8d`**. 헬스 PRODUCTION ok 11/11 · pm2 `thekaiwa`·gateway·worker online(재시작 0) · 번들에 새 문구 3종(「조각을 골라 주세요」「기본 단어에 이미 있어요」「쪽으로 이동」) 있음·옛 문구(「기본 단어 한 번에 넣기」·`useSeedPack`) 0 · `seed-pack` 라우트 디렉터리 없음.
- **백업 #2**: `~/db-backups/thekaiwa-pre-migrate-task068-<시각>.sql.gz`(953,285B·600, gzip OK, 56개 표 `UserWordState` 포함, 끝 표시 확인).
- **이관 `plan` 재확인(읽기 전용)**: 위 「이관 plan」과 동일 — 사본 678·짝 678/678·edited 0·seed-origin 35·상태 합산 대상 40·참조 VocabAttempt 70 / RepetitionItem 3(충돌 0)·**ALL OK**.
- **`state --apply`**(2초, exit 0): `UserWordState` **upsert 40** · 사본 inline 카운터 **40개 비움** · 사본 상태 행 삭제 0 · 이후 `pending=0` · 사본 삭제 0. 기대값(40)과 일치.
- **`repoint --apply`**(4초, exit 0): `VocabAttempt` **70** · `RepetitionItem` **3** 을 기본 단어 id 로 옮김(`EvaluationItem`·`Correction` 0). 이후 `plan`: **참조 전부 0 · 상태 pending 0 · edited 0 · 삭제 대상(delete-copies would delete) 678 · skip 0**. 기대값과 일치. `LearningObservation` 30 은 추가 전용이라 건드리지 않음.
- **운영 읽기 전용 스모크**(QA2 쿠키 임시 발급 → 즉시 삭제, GET 만): `/api/health`·`/drawer/words`·`/study/today` 200 · `GET /api/v1/words?page=1&limit=7` 200 → `total 7757 · pages 1109 · baseTotal 7757 · items 7`(전부 기본 단어 `SEED`) · `source=base&sort=surface&page=2`·`source=mine` 200 · 옛 `/api/v1/words/seed-pack` **404**. 미러 `.env`·쿠키 파일 삭제 확인.
- **이관~삭제 사이 한때의 소유자 계정 상태 [확실, `wordState.ts:12-14` 직접 확인]**: 가시성이 「내 단어 OR 기본 단어」라서 사본 678개가 남아 있는 동안 소유자(실사용자 1명) 단어장에는 같은 단어가 사본(「내 단어」, 학습 기록 0으로 비워짐)과 기본 단어(학습 기록 보유) 두 번 보였다(합계 8,435·오늘의 단어 풀·평가 재료에도 중복 가능). 기록은 기본 단어 쪽이라 손실은 없었고, 아래 「사본 삭제 실행」으로 해소.
- **사본 삭제는 별도 승인 후 실행**(아래 「사본 삭제 실행」). 승인 전 이 단계의 조건 — 백업 #3 · 읽기 전용 SQL 로 사본 `category`·`chunkType` 분포 확인(예상과 다르면 중단) · `plan` ALL OK. 되돌리기는 백업 #3 복원뿐.
## 사본 삭제 실행 (2026-10-14, 사용자 승인 「지금 삭제 (권장)」 — AskUserQuestion)
- **승인 근거**: 이관 직후 소유자 단어장에 같은 단어가 사본+기본 단어로 두 번 보이는 상태(`visibleWordWhere` = 내 단어 OR 기본 단어)를 알리고 삭제 시점을 물음 → 「지금 삭제 (권장)」.
- **백업 #3**: `~/db-backups/thekaiwa-pre-delete-copies-task068-<시각>.sql.gz`(954,116B·600, gzip OK, 56개 표 `UserWordState` 포함, 끝 표시 확인) — 접속 정보는 임시 설정 파일(600)로만 쓰고 즉시 삭제.
- **삭제 전 읽기 전용 SQL 확인(예상과 정확히 일치)**: 사용자 소유 `WordEntry` 678행·사용자 1명·`source` 전부 SEED·`seedKey` 있는 사용자 행 0 · `category` '초보자 (N5)' 628 / 'N5 기초' 50 · `chunkType` NAME 337 / MODIFIER 137 / ACTION 116 / FEELING 55 / NULL 33.
- **`plan`**: 사본 678·짝 678/678·edited 0·상태 pending 0·참조(VocabAttempt·EvaluationItem·Correction·RepetitionItem) 전부 0·삭제 대상 678·skip 0·**ALL OK**.
- **`delete-copies --apply --confirm-delete`**(5초, exit 0): **사본 678개 삭제**. 이후 `plan`: 사본 0(사용자 0)·기본 단어 7,757 그대로·참조 0.
- **사후 확인(읽기 전용)**: `WordEntry` 기본(userId NULL) 7,757 / 사용자 소유 0 · `UserWordState` 43행(사용자 3명: 소유자 이관분 40 + QA 계정의 값 0 행)·정오답 합 6/5·**끊긴 참조 0** · 기본 단어 조각 분포 NAME 3,324 · ACTION 2,561 · MODIFIER 1,087 · FEELING 663 · EXPRESSION 122(빈 값 0) · 헬스 PRODUCTION 11/11 · pm2 `thekaiwa`·gateway·worker online 재시작 0 · 미러 `.env` 삭제 확인.
- **되돌리기**: 백업 #3 복원뿐(사본의 학습 기록·참조는 이미 기본 단어 쪽으로 옮겨져 있음). 이관 후 롤백(`--rollback`)은 아래 주의 참고.
- **롤백 주의(사본 삭제 후)**: 코드만 롤백(`--rollback`)하면 옛 코드는 사용자 소유 단어만 보는데 사본이 이미 없어 **소유자 단어장이 비어 보인다**(기본 단어·학습 기록은 DB 에 있으나 옛 코드가 읽지 않음). 롤백이 필요하면 코드 롤백 + **백업 #3 복원**(또는 새 코드로 고쳐서 전진)이 필요하다 — 새 코드 결함은 롤백보다 전진 수정이 안전.

## 위험·승인 사항 (구현 전 명시)
- **스키마 변경(공유 DB, 사용자 승인)**: `WordEntry.userId` NULL 허용 + `seedKey`(유일) + 새 테이블 `UserWordState` (+ D4 ②/C 채택 시 `ChunkType` enum 값 추가) = `prisma db push`. 모두 추가·완화라 옛 코드와 호환. 순서: 스키마 push → 기본 단어 시드(약 7,755행, 한 트랜잭션 `createMany`·멱등 upsert, task-063 commit 지연) → 새 코드 배포 → 기존 실사용자 678행 이관(상태 복사·단어 id 옮김·사본 삭제, dry-run → **사용자 승인**) → 조각 재분류(시드 JSON 기준, 이관 전 시드에 반영).
- **되돌리기**: 스키마·시드 추가는 되돌릴 필요가 없고(옛 코드가 무시), 이관은 사본 삭제 전까지 되돌릴 수 있다 → 이관 스크립트는 「짝 맞춤·상태 복사·id 옮김」과 「사본 삭제」를 단계 분리하고 사본 삭제는 검증 뒤 따로 승인.
- **QA 계정도 기본 단어가 보임**: 「빈 단어장」을 기대하는 라이브 스모크·시험(`tests/live/*`) 갱신 필요, 29개 시험 파일(`wordEntry`) 갱신 범위 확인.
- **오늘의 단어**: 풀이 7,755개로 커지고 기본 단어 상태는 `UserWordState` JOIN — task-053 가중·task-057 실측(72ms)로 문제 없을 것으로 보되 QA 에서 세트 생성 시간 재측정.
- **성능**: 목록 7개씩 쪽 + 정렬(최근·오답·가나다) + 필터 + `total` 이 「내 단어 + 기본 단어」 JOIN 이라 인덱스·쿼리 형태를 감사 때 확인(약 7.8천 행).

## 구현 계획 (데모 승인 뒤)
- designer 구현 가이드(`docs/screens.md` §28 후보) → developer **S**(서버·DB: 스키마(`WordEntry.userId` NULL 허용·`seedKey`·`UserWordState`, D4 채택 시 enum), 기본 단어 시드 스크립트(멱등 upsert, 조각 재분류 반영), 6개 모듈의 「내 단어 + 기본 단어」 조회·상태 갱신 전환(`words.ts`·`sessions.ts`·`memo.ts`·`materials.ts`·`reviewSchedule`), #40 쪽 번호 조회 + `total`·출처 필터, 기본 단어 수정·삭제 거절, 기본 단어 추가 코드·#46b 제거, 기존 실사용자 678행 이관 스크립트(dry-run/apply·단계 분리), 기존 시험·QA 스모크 갱신) / **U**(화면: 쪽 줄 `WordsPager`, 필터 줄 정리(분류 칩 제거·출처 필터), 추가 시트 조각 선택, 행·상세 조각 뱃지·「기본」 표시, 기본 단어 상세 읽기 전용, CTA 3곳 제거) → reviewer → QA(실제 Next 라우터·3폭·1,100쪽 이동 성능·QA 픽스처 계정 7,755행) → 합본 스냅샷 게이트 → **사용자 배포 승인** → 푸시 전 게이트 → push → 스모크. DB 쓰기(백필·재분류)는 **배포 후 사용자 승인 따로**.
- prompt-engineer: AI 단어 보강 초안(task-008)이 `chunkType` 을 내는 프롬프트 스키마에 새 유형이 필요한지(D4) 판단 — 필요 없으면 생략.

## 완료 기준 (초안)
1. 단어장 목록이 7개씩 쪽으로 나뉘고 쪽 이동이 동작한다(검색·필터 조합 포함, 마지막 쪽·빈 결과 처리).
2. 기본 단어 7,755개는 공용 읽기 전용 행으로 한 번만 DB 에 있고, 모든 사용자(새 계정 포함)가 계정 생성 즉시 단어장에서 본다. 사용자가 고치거나 지울 수 없고(서버가 거절) 학습 기록·보관은 사용자별로만 저장된다. 사용자가 추가한 단어는 그 사용자 값으로 적재되고 그 사용자만 보고 관리한다. 기존 실사용자 678행은 학습 기록을 잃지 않고 기본 단어로 이관된다. 기본 단어 추가 버튼은 어디에도 없다.
3. 분류(난이도) 칩과 조각 「없음」 칩이 없다. 조각이 비어 있는 단어가 0개다(재분류 결과 표).
4. 단어 추가 시트의 직접 입력에 「수준」 대신 「조각」 선택이 있고, 기본 팩 단어를 포함한 모든 단어가 조각 뱃지로 표기된다.
5. 기존 보장 불변: 6층 경계, 엔진명 비노출, 본인 단어만, 오늘의 단어·교정 모음·질문 탭 동작 불변, QA 계정 빈 단어장 시험 불변.
6. tsc 0 · eslint 0 · 전체 시험 통과 · `next build` 0 · QA(실제 Next 라우터 3폭) · 사용자 폰 확인.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다(`check.mjs init` 이 기록). 이 표는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성 전 | - | - | judge: delta (DM-kw-delta) | 10-14 |
| v1 | 검토요청 | docs/demo/task-068-wordbook-v1.html (sha256 `568bdb54…`) | https://claude.ai/artifact/AUnTux7AD2XCwE2n5Bx5U9 | 사용자 검토 요청(결정 D1~D10, 승인 문장 「결정(D1~D10)은 권고대로」) | 10-14 |
| - | 작성중 | - | - | judge: delta (DM-kw-delta) | 10-14 11:26 |
| v1 | 검토요청 | docs/demo/task-068-wordbook-v1.html | https://claude.ai/artifact/AUnTux7AD2XCwE2n5Bx5U9 | 사용자 검토 요청 | 10-14 12:39 |
| v1 | 승인 | docs/demo/task-068-wordbook-v1.html | https://claude.ai/artifact/AUnTux7AD2XCwE2n5Bx5U9 | "task-068 데모 v1 승인, 결정(D1~D10)은 권고대로" | 10-14 12:55 |

## 상태 로그
- 2026-10-14 사용자 요청(단어장 개선 6건) → 현재 구현·DB 사실 확인(실사용자 단어 678개, 조각 없음 202행 분포) → IMP-0037~0042 접수 → judge 접수(standard·R2·demo delta·opus) → 이력서 작성. 다음: `check.mjs init` → designer 데모 v1(delta, Artifact 게시) → 사용자 검토.
- 2026-10-14 사용자 추가 지시 「단어테이블에 기본 단어와 사용자단어 데이터를 분류하고 기본 단어는 모든 사용자가 기본적으로 보는 것으로 하고 읽기전용으로 사용하며 사용자가 추가한 단어에 대해서는 사용자가 입력한 값에 대해서 DB테이블에 적재하고 사용자만 관리하는 형태로 구현해줘」(+ 「단어장의 단어에 대한 DB테이블 구조가 어떻게 구성하고있어?」) → 현재 구조(`WordEntry` 한 테이블, 전부 사용자 소유, 기본 단어는 사용자별 사본) 설명 + 요청 2 의 방식을 **공용 읽기 전용 기본 단어 + 사용자별 상태 테이블**로 변경(백필·가입 훅 폐기, 위 「DB 구조」·D6′·D9~D11 반영). 작성 중인 designer 에게 전제 변경 전달.
- 2026-10-14 designer 데모 v1 완성·Artifact 게시([[task-068-designer-record]]): 1,501줄·169,440B, lint 통과, 폰 점검 377렌더 JS 오류·가로 넘침·11px 미만·44px 미만 터치·엔진명 0, 한 글자 줄바꿈 6폭 0 → 게이트 `review_requested`. **designer 가 바꾼 ★ 3개(Leader 검토 결과 수용)**: ① D3 난이도 칩 = ★ B(난이도 이름 칩만 뺌, 직접 정한 분류 칩은 남김 — 요청 문장 그대로, 폼의 「분류」 칸이 남는 한 줄 통째 제거는 거를 길을 없앰) ② D10 행 표시 = 「내 단어」에만 표시(거의 모든 행이 기본 단어라 「기본」 표시는 정보가 안 됨, 상세에는 둘 다) ③ D1 쪽 줄 자리 = ★ 목록 바로 아래(고정 줄 규칙의 예외를 만들지 않음). **데모가 확인한 사실**: 조각이 빈 기본 단어는 200행(이력서의 202행에는 옛 50개 중 2행이 섞임) — D4 배정: A 꾸밈 119·느낌 70·이름 11 / ★B 표현 122·꾸밈 64·이름 11·느낌 3 / C 표현 122·붙는말 49·꾸밈 15·이름 11·느낌 3 · 조각 뱃지는 목록 행·상세에 이미 있고 빠진 곳은 추가·수정 폼 · `ChunkType` 은 4개 테이블이 같이 씀(EvaluationItem 포함) · 선생님 초안(뜻 채우기)은 지금 조각을 내지 않음 · 기본 단어 7,755행 안에 표기·읽기가 같은 행 0개 · 단어 7개 + 필터 줄은 390×780 한 화면에 안 들어감. **구현 때 정할 것(결정 필요, 화면 밖)**: 실사용자 678행의 학습 기록 이관 + 옛 「N5 기초」 50개 중 기본 단어에 없는 행 처리(Leader 권고: 기본 단어로 합쳐 잃지 않게) · 「최근 추가」에서 기본 단어끼리의 순서(J7) · D4 새 유형을 교정·수업·평가 프롬프트가 내지 않게 할지(J12, prompt-engineer).
- 2026-10-14 데모 v1 승인(「결정(D1~D10)은 권고대로」) → 구현(S-A·S-B1·S-B2·U1·U2·PE) → 감사 A/B/C/A2(High 1 수정: 이관 상태 덮어쓰기→합산·멱등) → 합본 게이트(시험 4,066) → 1단계 DB(백업·스키마 push·기본 단어 시드 7,757) → 실제 DB QA W1~W3(결함 0, 알려진 한계 수용) → 사용자 승인 「배포 + 이관 함께」 → 푸시·배포(릴리스 `20261014-162727-c3ffa322`) → 백업 #2 → `state` 40 · `repoint` 70+3 → 운영 읽기 전용 스모크 통과 → 사용자 승인 「지금 삭제」 → 백업 #3·분포 확인·`delete-copies` 678 삭제·사후 확인(사본 0·기본 단어 7,757·끊긴 참조 0). **사용자 폰 확인만 남음.**

## 최종 요약 (배포·이관 단계 기준, 2026-10-14)
**한 일**
- 단어장이 한 쪽에 **7개씩** 나뉘고(`‹ 이전 · n / N · 다음 ›` + 쪽 번호 이동 시트), 기본 단어 **7,757개**(요청 7,755 + 기존 보강 2)가 **모든 사용자에게 처음부터** 공용 읽기 전용으로 보입니다. 새 계정도 가입 즉시 7,757개를 봅니다.
- 단어 DB: 기본 단어는 `WordEntry` 에 `userId 없음 + seedKey` 로 한 번만 저장, 사용자가 추가한 단어는 그 사용자 소유로 적재, 학습 기록·보관은 새 표 `UserWordState` 에 사용자별로 저장. 기본 단어를 고치거나 지우면 서버가 거절합니다(403).
- 난이도 이름 칩·조각 「없음」 칩·「기본 단어 한 번에 넣기」 버튼 제거. 조각이 비어 있던 기본 단어 200개를 재분류(표현 122·꾸밈 64·이름 11·느낌 3)하고 **조각 「표현」 유형을 새로 추가**.
- 직접 입력의 「수준」 칸을 **조각 선택(필수)** 으로 교체, 선생님 초안이 조각을 미리 골라 줌. 기본 단어와 같은 표기+읽기를 직접 입력하면 「기본 단어에 이미 있어요」로 막고 그 단어로 안내.
- 기존 사용자의 단어 사본 678개 중 학습 기록(40개)·시험 답안(70)·복습 항목(3)을 기본 단어 쪽으로 합쳐 옮겼습니다. 잃은 기록 없음.

**검증**: tsc 0 · eslint 0 · 시험 4,066 통과 · `next build` 0 · 감사 3갈래 + 이관 재감사 · 실제 DB QA(1,109쪽 ×3정렬 전수 순회 중복·누락 0, 폼·읽기 전용·사용자 격리, 세트 생성 p50 2.3s) · 운영 읽기 전용 스모크 통과.

**남은 일 / 알려진 한계**
1. ~~사본 삭제~~ **완료(사용자 승인 「지금 삭제」)** — 백업 #3 → 분포 확인(예상과 일치) → `delete-copies` 678개 삭제 → 사본 0·기본 단어 7,757·끊긴 참조 0. 이제 소유자 단어장도 중복 없이 기본 단어 7,757개로 보입니다. 되돌리기는 백업 #3 복원뿐.
2. 사용자 폰 확인: 쪽 이동·필터(출처 칩 전체/내 단어/기본 단어)·추가 시트 조각 선택·기본 단어 상세 읽기 전용·오늘의 단어·평가 난이도 혼합.
3. 알려진 한계(수용): 쪽 줄 y 위치가 쪽마다 최대 42~66px 흔들림(행 높이 가변) · 「でも」 시드=표현 vs 초안=꾸밈 · 평가에서 내 단어 우선 없음 · 평가 재료에 N4/N3 약 20%/9% 섞임 · 수업 메모 제안은 조각을 싣지 않음 · 공용 `Sheet` Tab 포커스 누출(기존) · 라이브 스모크 `task008` 낡은 기대값 7건(제품 결함 아님, 후속).
4. 롤백 주의: 사본이 삭제됐으므로 코드만 롤백하면 소유자 단어장이 비어 보임 → 롤백보다 전진 수정이 안전, 필요 시 백업 #3 복원.

