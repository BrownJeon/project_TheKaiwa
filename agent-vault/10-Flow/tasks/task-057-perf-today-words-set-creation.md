---
task_id: task-057
title: "오늘의 단어 세트 생성 지연 개선 — 단계별 실측 후 내 단어 전체 통째 조회를 가벼운 컬럼 + 선택 카드 전체 컬럼으로 분리 (task-053 QA 부수 발견, standard 트랙)"
status: done
base_ref: a834978
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-053-improve-today-words-level-weight, task-051-improve-n5-vocab-pack, task-008-vocab-today-words]
tags:
  - type/task
  - domain/vocab
  - domain/performance
aliases:
  - 단어 세트 생성 지연
  - task-057
created: 2026-10-11
updated: 2026-10-11
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

# task-057 — 오늘의 단어 세트 생성 지연 개선

## 사용자 요청·결정 (원문)
- 2026-10-11 「커밋 및 푸시진행해주고 다음 작업 진행해줘」 — 구체 작업 지정 없음. Leader 가 로드맵의 남은 Phase 3 후보(`/ask` 는 task-056 의 호출 경로 결정과 겹침, 분석·성장 기록은 사용자 설계 입력 필요)보다 **실측으로 확인된 사용자 체감 문제**를 먼저 잡기로 판단했다. 사용자가 다른 방향을 원하면 바꾼다.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **실측 근거**: task-051 QA-A(전 단계 7,755개 보유 QA1, 세트 생성 40회) p50 **2,035ms**·최대 3,632ms. task-053 QA(Q-1/Q-2 240회) p50 **2,652ms**, 이어 교대 A/B 변경 전 서버 p50 **1,983~2,111ms**. 순수 계산(`generateWordSet`)은 풀 7,755개에서 세트당 **약 1.7ms**, 프로필 읽기(`getProfile` upsert 4문장)는 p50 **2ms**, DB 왕복은 1~2ms → **지연의 대부분은 계산·왕복이 아닌 다른 곳**(Leader 가설: 내 단어 전체를 긴 컬럼 포함해 통째 조회·역직렬화 `[가능성 높음 — 미프로파일링]`).
- **코드(2026-10-11 확인)**: `src/modules/learning/vocab/sessions.ts` `createVocabSession` 은 한 트랜잭션에서 `lockUserRow` → `assertNoInProgress` → `tx.wordEntry.findMany({ where: { userId, archived: false }, select: POOL_SELECT })`(POOL_SELECT = id·surface·reading·meaning·partOfSpeech·correctCount·wrongCount·lastSeenAt·example·exampleKo·jlpt, **7,755행 전부**) → (카테고리 필터 시 id 목록 추가 조회) → 오늘 끝낸 시도 조회 → `generateWordSet` → `distinctMeaningCount(active)` → `insertSession(…, sources: active)` 로 뜻 보기(`pickChoices`) 재료에도 전체 목록을 넘긴다. 같은 파일의 `replayVocabSession`(:913)은 이미 뜻 재료를 `{ id, meaning, partOfSpeech }` 3컬럼만 읽는다 — 줄이는 선례.
- 호출처 둘(`createVocabSession` 내 단어장 세트 / `createTopicVocabSession` 주제 세트의 보충 후보)·`generateWordSet` 은 **같은 시드·같은 후보 집합이면 같은 결과**(`SetCandidate` = id·correctCount·wrongCount·lastSeenAt·jlpt). 세트 재현성(`VocabSession.seed`)·task-053 의 단계 천장 가중을 바꾸면 안 된다.
- 승인된 교훈(`/이슈기록 관련 성능 지연 vocab`): 없음.

## judge 접수 (Leader 실행, `judge-result@2`)
- `structural` · 1.84 · **R1** · developer=**sonnet** · **standard** · demo=none. 역할 developer → reviewer → qa. 입력·결과: 스크래치 `judge-057-intake*.json`.

## 설계 (Leader — 1단계 실측 결과에 따라 확정)
**1단계 실측 (코드 변경 없음).** 전용 미러에서 `createVocabSession` 의 단계별 시간을 잰다: ① 트랜잭션 시작·`lockUserRow`·`assertNoInProgress` ② `wordEntry.findMany`(POOL_SELECT, 7,755행) ③ 카테고리 조회 ④ 오늘 시도 조회 ⑤ `generateWordSet`+`distinctMeaningCount` ⑥ `insertSession`(카드 생성·뜻 보기 `pickChoices`·INSERT 들) ⑦ 커밋 ⑧ 라우트 바깥(인증·프로필 upsert·직렬화). 20회 이상 p50/p95, 대상 데이터는 QA1 에 JLPT 5단계 전체(7,755개)를 심은 상태. 실측 도구는 저장소에 두지 않는다(미러의 복사본에 타이머를 넣는다). **결과를 표로 기록한 뒤에만 2단계**로 간다 — 가설이 틀리면(예: 트랜잭션·잠금·INSERT 가 지배) 설계를 바꾸고 Leader 에게 보고한다.
**2단계 구현 (가설이 맞을 때).**
1. **후보는 가벼운 컬럼만**: 뽑기에 필요한 `{ id, correctCount, wrongCount, lastSeenAt, jlpt }`(+ 카테고리 필터에 필요한 값)만 읽는다. `generateWordSet` 입력 모양은 그대로.
2. **뜻 재료는 3컬럼**: `{ id, meaning, partOfSpeech }`(replay 와 같은 모양)로 `pickChoices`/`distinctMeaningCount` 에 넘긴다.
3. **선택된 카드만 전체 컬럼**: 뽑힌 id 들에 대해서만 `POOL_SELECT` 전체(예문 포함)를 읽어 `toCardSeed` 에 넘긴다.
4. 트랜잭션 경계·`lockUserRow`/`assertNoInProgress` 순서·오류 코드(`NO_WORDS`·`NO_WORDS_IN_CATEGORY`·`ALL_DONE_TODAY`·FLIP 강등 조건)·`VocabSession.seed` 계약·응답 모양은 **그대로**.
5. 주제 세트(`createTopicVocabSession`)·재풀기·챌린지는 이번 범위 밖(필요하면 실측에서 발견한 동일 패턴을 기록만).
**동치 증명(핵심)**: 같은 시드·같은 풀에서 변경 전/후가 **같은 카드 id 순서·같은 뜻 보기**를 내야 한다 — 변경 전 구현을 시험 안의 기준(oracle)으로 두고(가짜 DB), 여러 시드·풀 크기·카테고리·FLIP 강등 경계에서 비교하는 시험을 둔다.

## 하지 않는 것
- 화면·스키마·API 계약 변경, `generateWordSet` 가중 규칙·task-053 천장 변경, 인덱스 추가(DB 변경은 사용자 승인 사항), 캐시 도입(상태 일관성 검토 없이는 안 함), 주제 세트·재풀기 구조 변경.

## 완료 기준
1. 1단계 실측표가 기록되고 병목이 확인됨(가설과 다르면 설계 갱신 + Leader 승인).
2. 기존 세트 생성·재풀기·주제 세트 시험이 수정 없이 통과 + 동치 시험 통과, tsc·eslint 0, 전체 시험 통과.
3. reviewer 가 실행 증빙을 재실행하고 변이(후보에서 한 컬럼 빼기·선택 카드 조회 누락·뜻 재료 필터 뒤집기)를 시험이 잡는지 확인.
4. QA(QA 계정만, 같은 데이터로 **교대 A/B**: 변경 전 `a834978` ↔ 후, 서버 리스너 cwd 검증): 세트 생성 p50/p95 개선율, 카드·뜻 보기·예문이 변경 전과 같은 형태, 7,755개/소량/카테고리/FLIP 강등 경계, 정리 후 QA 계정 시작 값 복원. **목표(추정, 실측 후 조정)**: p50 이 변경 전 대비 40% 이상 감소 — 병목이 DB 왕복·트랜잭션이면 목표를 낮추고 사유 기록.
5. 배포 후 읽기 전용 스모크(웹만, DB 변경·APK 없음).

## 1단계 실측 결과 (2026-10-11, developer sonnet — [[task-057-dev-record]])
- **Leader 가설은 틀렸다 `[확실]`**. 7,755개 풀 조회는 함수 전체 p50 2,635ms 중 **72ms(2.7%)**(DB 쿼리 29ms + Prisma 결과 매핑 약 43ms), 격리 요청에서도 4~5%. 지배 항목은 **쓰기 트랜잭션의 COMMIT**(루프 p50 1,420ms, 격리 1.1~1.35초 = 전체의 70~75%). COMMIT 은 쓰는 행 수에 비례하지 않는 쓰기 트랜잭션당 고정 비용(0.1~0.9초, 꼬리 1.5초↑) — 공유 NAS MariaDB 10.11.11 설정(`innodb_flush_log_at_trx_commit=1`·`sync_binlog=1`·`innodb_buffer_pool_size=16MB`·`io_capacity=200`)과 맞물린 것으로 보이나 기전은 `[추측]`. 큰 읽기(풀 조회) 직후의 쓰기 COMMIT 이 더 느려지는 현상(교대 8회: 쓰기만 176ms → 풀 읽기 직후 1,524ms)도 관측.
- 단계별(p50, ms): `getProfile` upsert 533(루프; 격리 4) · 트랜잭션 열기·잠금·확인 약 4 · 풀 조회 72 · 오늘 시도 2.3 · 뽑기 3.4 · `insertSession` 472 · COMMIT 1,420 · 전체 2,635. SQL 14문장/회, 느린 SQL 1~3위는 `COMMIT`(요청당 2회)·`INSERT VocabSession`·풀 `SELECT`.
- 가벼운 컬럼 프로토타입(p5 5+3컬럼 2회 조회, p7 7컬럼 1회 조회): 읽기 구간 −14.5ms(18%)/−29.7ms(36%), 페이로드 1,721→1,034KiB, 같은 카드·뜻 보기 대조 이상 없음(메모리 6,240건·실제 코드 16건) — 그러나 **종단 p50 개선은 잡음(±0.5~1초)에 묻혀 검출되지 않음**(격리 22쌍: orig 1,843 / p5 2,026 / p7 2,089ms).
- 규모 의존성: 읽기 구간은 단어 수에 거의 선형(676→7,755개 14→82ms, 기울기 0.01ms/단어)이지만 7,755개에서도 80ms 대. 함수 전체는 단어 수와 함께 커지는 경향(활성 676 → 739ms, 7,755 → 2,283ms)이나 증가분 1.5초 중 읽기는 70ms — 나머지는 쓰기·COMMIT. 과거 QA 수치(2.0~2.65초)는 생성→끝내기를 연달아 돌린 루프라 앞선 쓰기의 대기가 부풀림(실사용 격리 p50 1.5~1.8초, 꼬리 2.6~5초).

## 결정 (Leader, 2026-10-11): 구현하지 않고 종료
- **슬림 컬럼 구현(설계 2단계)은 하지 않는다.** 줄일 수 있는 구간이 격리 기준 4~5%(이상적으로도 −30ms)이고 종단 개선이 검출되지 않아, R1 이지만 핵심 학습 경로(`sessions.ts`)를 건드릴 이유가 없다. 완료 기준 4의 「p50 40% 감소」는 앱 코드로 달성할 수 없다.
- **보류 후보(사용자 판단 필요, 이번에 하지 않음)**: ① 공유 NAS DB 서버 설정 점검 — 버퍼풀 16MB 증설·`innodb_flush_log_at_trx_commit`/`sync_binlog` 완화(내구성 trade-off)·binlog 용도·스토리지 지연 확인. **전 프로젝트에 영향하는 HOME-SERVER 영역이고 사용자 승인 사항**, 효과 미검증. 같은 쓰기 지연이 `recordAttempt`·`finish` 등 다른 쓰기 엔드포인트에도 붙을 것으로 보이나 직접 재지 않음 `[가능성 높음]`. ② `getProfile` 을 `findUnique` 우선(없을 때만 upsert)으로 — 읽기뿐인 호출이 내부 쓰기 트랜잭션(4문장+COMMIT)을 여는 것을 없앤다. 격리에서 3.6→1ms, 연달아 쓰는 구간에서는 수백 ms. `preferences` 소유라 별도 판단.
- 측정 정리: QA1 의 측정용 단어 7,755개를 `userId=QA1` 한정으로 삭제해 시작 값(WordEntry 0·VocabSession 0·VocabAttempt 0·나머지 시작 값)으로 복원했고 Leader 가 재조회로 확인.
- 교훈: 지연 원인은 **코드 읽기 가설로 구현에 들어가지 말고 먼저 실측**(이번에 가설이 틀렸고 실측 1단계가 구현을 막았다). 과거 QA 수치를 근거로 쓸 때는 측정 방식(루프 vs 격리)을 확인.

## 상태 로그
- 2026-10-11 접수·묶음(base_ref `a834978`). 다음: developer(sonnet) 1단계 실측.
- 2026-10-11 1단계 실측 완료 → 가설 오류 확인 → **구현 없이 종료(`done`)**. 코드 변경 0, 커밋 0.
