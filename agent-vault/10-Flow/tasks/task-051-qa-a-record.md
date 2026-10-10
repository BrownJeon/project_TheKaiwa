---
type: log
task: task-051
lane: A (삽입·집계·성능)
tags:
  - type/log
  - domain/vocab
---
# task-051 QA 레인 A 기록 (qa — 삽입·집계·성능)

- 대상 코드: 커밋 `46efd74` (`git archive` → `~/.node-local/thekaiwa-qa051a`, node_modules 는 `thekaiwa-qa049` 하드링크 복제 — prisma 스키마가 10cd615→46efd74 사이 무변경이라 클라이언트 동일). 서버: `next build`(exit 0) 후 `NODE_ENV=production next start -p 3011 -H 127.0.0.1`, PID 파일 `scratchpad/q051a/server.pid`(810981). APP_ENV=LOCAL, DB = 개발·운영 공유 NAS MariaDB.
- 계정: QA1 `qa-bot@thekaiwa.test`(USER, provider test) 만 사용. 시작 전 행 수(읽기 전용, userId 한정): AiJob 14 · Profile 1 · UserVoiceSetting 1 · UserSpeechSetting 1 · Chat 3 · ChatMessage 64 · Correction 5 · TutorProposal 8 · LearningObservation 453 · Attendance 8 · StatsSnapshot 3 · LearnerErrorStat 2 · RequestTrace 281 · **WordEntry 0 · VocabSession 0** (이전 QA 행이라 보존).
- 도구: `scratchpad/q051a/api.sh`(curl, 쿠키는 600 파일) · 서버 복제본 `qa/{counts,ops,q1}.ts`(QA1 userId 한정).

## A1 첫 호출·멱등·옛 50개 사용자 — 판정 PASS (알려진 한계 확인)
| 확인 | 기대 | 실제 |
|---|---|---|
| 단어 0개 QA1, `POST /api/v1/words/seed-pack {pack:'N5'}` | added 676 | **200 `{added:676,skipped:0}`, 10,030 ms(첫 호출)** |
| 같은 호출 재실행 | added 0 | 200 `{added:0,skipped:676}`, 503 ms |
| 분류 칩 | `초보자 (N5)` 676 | `[{category:'초보자 (N5)',count:676}]` |
| 옛 50개 모사(`words-n5.json` 50개를 category='N5 기초'·source=SEED·jlpt=N5 로 createMany) 후 N5 | added 628 · skipped 48 | **200 `{added:628,skipped:48}`, 7,102 ms**, 재호출 `{added:0,skipped:676}` 634 ms |
| 분류 칩(옛 50 사용자) | `N5 기초`(50) + `초보자 (N5)`(628) | `[{초보자 (N5),628},{N5 기초,50}]` — 총 678 |
| 철자 중복 2쌍 | ご飯/御飯·友だち/友達 | **확인**: `ご飯`(N5 기초)·`御飯`(초보자 (N5)) 둘 다 ごはん, `友だち`(N5 기초)·`友達`(초보자 (N5)) 둘 다 ともだち (알려진 한계 그대로) |
| 잘못된 pack | 400 VALIDATION | `N6`·`""`·`"n5"`·`{}`·`5`(숫자) → 400 `VALIDATION field=pack`, `{pack:'N5',x:1}` → 400 `unknown_key`, 배열 본문 → 400 「요청 본문은 JSON 객체」, 본문 없음 → 400, **쿠키 없음 → 401** |
- 부수 관찰: 옛 50 사용자 N5 후 `GROUP BY surface`(DB 콜레이션)로는 같은 표기 그룹이 `ベッド/ペット`·`また/まだ`(콜레이션이 탁음·반탁음을 같게 봄)·`私`(わたし 옛 / わたくし 팩)로 나오지만, 바이트(JS `===`)로는 `私` 만 같은 표기·다른 읽기. 팩 삽입은 JS 비교라 `ペット`·`まだ` 가 막히지 않고 들어옴(676 = 628+48 정확히 일치).

**남은 일**: A2(N4·N3·N2·N1 단계별 added·소요, N1 동시 2회) → A3 → A4. **다음 첫 명령**: QA1 단어 비우기(`node --env-file=.env --import tsx qa/ops.ts wipe-words`, 복제본 폴더에서) 후 N4 호출. **주의점**: 서버 3011 실행 중(PID 810981), 첫 N5 10초는 N1(3034)로 선형 외삽 시 30초 트랜잭션 상한을 넘길 수 있음 → A2 에서 실측. **미정리**: QA1 WordEntry 678행, 쿠키 `scratchpad/q051a/cookie1`, 복제본 폴더.

## A2 단계별 개수·소요 시간·이중 탭 — 판정 PASS (소요 시간 변동 큼 — 아래)
같은 QA1, 단어 0개로 비운 뒤 N5→N4→N3→N2 순서 단독 호출 → N1 은 **동시 2회**(병렬 curl). 원 출력 `scratchpad/q051a/a2-*.txt`.
| 단계 | 기대 added | 첫 호출 실제 | 소요 ms | 두 번째 호출 |
|---|---|---|---|---|
| N5 | 676 | `{added:676,skipped:0}` | 685 (처음 QA1 N5 호출은 10,030, 옛 50개 사용자는 7,102 — 같은 코드·같은 DB 인데 15배 변동) | `added 0 skipped 676` 29 ms |
| N4 | 629 | `{added:629,skipped:0}` | 5,899 | `added 0 skipped 629` 27 ms |
| N3 | 1,649 | `{added:1649,skipped:0}` | 6,323 | `added 0 skipped 1649` 55 ms |
| N2 | 1,767 | `{added:1767,skipped:0}` | 5,923 | `added 0 skipped 1767` 58 ms |
| N1 | 3,034 | 병렬 2회: A `{added:3034,skipped:0}` 3,341 ms · B `{added:0,skipped:3034}` 3,427 ms (B 가 사용자 행 잠금 대기 후 0) | 3,341 | `added 0 skipped 3034` 89 ms |
- **합계**: 다섯 단계 뒤 QA1 WordEntry **7,755** = 676+629+1,649+1,767+3,034, `jlpt`·`category` 5단계 모두 정확(고급 (N2) 1,767·중급 (N3) 1,649·초급 (N4) 629·초보자 (N5) 676·최상급 (N1) 3,034). **바이트 기준 (표기,읽기) 중복 그룹 0**, 표기만 같은 그룹 105(읽기가 다른 단어 — 設計 의도, 예 明日 あした/あす).
- **N1 단독 반복(지운 뒤 다시)**: 4,484 / 5,030 / 3,643 ms (3회, 모두 added 3034). 30초 트랜잭션 상한 대비 최대 5.0 초(약 17%). **관측 최대는 N5 첫 호출 10.0 초**(676행) — 같은 슬로다운이 N1 에 비례해 걸리면 상한에 근접할 수 있으나 이번 실측에서는 N1 이 가장 빠른 축에 속했다(DB 지연 변동 원인은 미규명; 같은 시각 레인 B 도 같은 NAS DB 를 씀). 한 번도 상한(30 s)이나 오류는 보지 못함.
- 서버 로그(`scratchpad/q051a/server.log`): 오류·timeout·P2028 매치 0건(시작 4줄뿐).

**남은 일**: A3(409 existingId 일관·같은 표기 다른 읽기·콜레이션 오탐 확인) → A4(sessions 5회 p50/최대, 단계 분포) → 정리. **다음 첫 명령**: `POST /api/v1/words {surface:'明日',meaning:'t'}` 반복(복제본 폴더 `scratchpad/q051a/api.sh`). **주의점**: QA1 은 현재 7,755 단어 보유(A3·A4 에 필요). **미정리**: QA1 WordEntry 7,755 · 쿠키 · 복제본 · 서버 3011.

## A3 같은 표기·다른 읽기 — 판정 PASS (① 실측) / NOT_VERIFIED (② 일부)
QA1 에 다섯 단계 모두 넣은 상태(7,755)에서. 원 출력은 이 대화 요약이 아니라 `scratchpad/q051a` 에 있음.
- **① 409 `existingId` 일관(PASS)**: `明日` 은 두 행(あした N5 `cmv2hzf7c…`·あす N4 `cmv2hzfs3…`). `POST /api/v1/words {surface:'明日',meaning:…}` 5회 → 전부 409 `existingId = cmv2hzf7c010mw1r9qq13juaa`(가장 먼저 만든 행, DB `createdAt,id asc` 순서와 일치). 읽기를 다르게(`reading:'みょうにち'`) 보내도 409 같은 id → **표기만 보는 정책 확인(다른 읽기를 직접 추가할 수 없음 — Leader 결정 후보로 이미 올라 있는 사항)**. `PATCH` 로 다른 단어 표기를 `明日` 로 바꿈 → 409 같은 id. 그 행을 지우면(`DELETE` 200 `snapshotKept:true`) 다음 호출은 409 `existingId = あす 행 id`(결정적, 다음으로 이른 행).
- **콜레이션 오탐 없음(PASS)**: DB 콜레이션이 같게 보는 `ベッド`·`ペット` 가 있는 상태에서 `ヘッド`(없던 표기) 추가 → **200 저장됨**(409 아님, 바이트 비교 `===` 가 걸러냄). 테스트 단어는 바로 삭제.
- **`enrich:true`(뜻 없음) 사전 중복 확인(PASS)**: `{enrich:true,surface:'明日'}` → 409 `existingId` (LLM 호출 전 — claude 프로세스 없음).
- **교정 채택 409 롤백(PASS, LLM 0)**: QA1 의 기존 PROPOSED 교정 1건에 `POST /corrections/:id/accept {addWord:{surface:'明日',…}}` → 409 `existingId`(あす 행), **전 표 행 수 전후 diff = {}**(Correction 은 PROPOSED 유지, LearnerErrorStat·관측·WordEntry 불변 — 트랜잭션 전체 롤백). 지운 N5 `明日/あした` 를 `seed-pack N5` 재호출로 되살림 → `{added:1,skipped:675}`(부분 삭제 뒤 재삽입 정상).
- **정적 확인(코드 읽기)**: 표기로 단어를 찾는 곳은 `findWordIdBySurface`(enrich 사전 확인)·`createWord`·표기 변경(PATCH) 세 곳뿐이고 모두 `findSameSurface`(가장 이른 행·바이트 비교) 경유. 그 밖의 `wordEntry.findFirst/Unique` 는 전부 id 키. → 같은 표기 여러 행이 레슨·평가 쪽 조회로 흘러들 경로는 발견하지 못함.
- **② 평가 생성·레슨 메모 연결 — NOT_VERIFIED**: 둘 다 LLM 슬롯(평가 생성 A5 · 레슨 A?)을 길게 쓰는 호출이라 하지 않음. 위 정적 확인만 근거. 교정 **채택 성공 경로**(새 표기 → 201 단어 1행 + 통계)도 QA1 의 옛 교정 행을 ACCEPTED 로 되돌릴 수 없게 바꾸므로 하지 않음(task-006 QA 가 이미 PASS).

**남은 일**: A4(오늘의 단어 세트 5회 p50·최대, 단계 분포 10세트) → 단어 50개 계정 비교 → 정리. **다음 첫 명령**: `POST /api/v1/vocab/sessions {count:10}` 후 `POST /sessions/:id/finish`(답 0장이면 ABANDONED, 기록 없음). **미정리**: QA1 WordEntry 7,755 · 쿠키 · 복제본 · 서버 3011.

## A4 7.7천 단어 보유 사용자의 오늘의 단어 — 판정 PASS(수치 기록)
QA1 에 N5~N1 다섯 단계(7,755개) 보유, `POST /api/v1/vocab/sessions {count:10}`(모드 기본 CHOICE) → 바로 `POST /sessions/:id/finish`(답 0장 = ABANDONED, 학습 기록 없음)로 진행 중 409 회피. 전 호출 200, LLM 호출 0(세트 생성은 DB 만). 원 출력 `scratchpad/q051a/a4-*.log`.
| 계정 상태 | 단어 수 | 생성 소요 ms(n) | p50 | 최대 |
|---|---|---|---|---|
| **5단계 전부** | 7,755 | **처음 5회**: 1,421 · 2,171 · 2,449 · 2,579 · 1,122 (요청대로 5회) → p50 **2,171** · 최대 **2,579** | 2,171 | 2,579 |
| 5단계 전부(40회 전체) | 7,755 | min 657 · p95 2,935 | **2,035** | **3,632** |
| 옛 50개만 | 50 | 1,035 · 493 · 723 · 1,243 · 1,035 | 1,035 | 1,243 |
| N5 팩만 | 676 | 592 · 513 · 569 · 491 · 492 | 513 | 592 |
- 해석: 단어가 늘면 세트 생성이 커진다 — 676개 513 ms → 7,755개 약 2.0 초(4배). 활성 단어 전부를 읽어 가중 표본·보기 재료로 쓰는 구조(`createVocabSession` 의 `findMany({userId, archived:false})`)라 선형에 가깝고, 50개 계정의 측정 변동(493~1,243)은 NAS DB 왕복 영향. 5초 예산(회화 턴) 대상은 아니며 세트 생성 자체에 합격선은 문서에 없음 → 결함 아님, 사용자 체감 약 2~3.6 초 **Info**.
- 끝내기(ABANDONED) 응답: 7.7천 계정에서 719~1,732 ms(생성보다 짧지만 무작업치고 큼) — 같은 이유로 보인다.
- **세트에 뽑힌 카드의 JLPT 단계 분포 (40세트·400장, 전부 ABANDONED, 세트 생성 시 `VocabAttempt.wordId`→`WordEntry.jlpt` 대조, 누락 0)**:
  | 단계 | 풀 비중(단어 수) | 뽑힌 카드(400) |
  |---|---|---|
  | N5 | 8.7% (676) | 20 = **5.0%** |
  | N4 | 8.1% (629) | 41 = 10.3% |
  | N3 | 21.3% (1,649) | 83 = 20.8% |
  | N2 | 22.8% (1,767) | 90 = 22.5% |
  | **N1** | **39.1% (3,034)** | **166 = 41.5%** |
  - 처음 12세트(120장)는 N1 41.7%·N5 7.5%. 세트 단위로는 N1 이 2~8장 사이를 오감(최악 한 세트 N1 8장/10).
  - 원인(코드): `weightOf`(`setGenerator.ts`) 는 맞힘·틀림 횟수와 마지막 본 시각만 보고 `jlpt`·`category`·`createdAt` 를 안 본다 → 새 계정은 전 단어 가중치가 2.0 으로 같고 **추출 확률 = 풀 비중**(N1 약 39%). N5 5.0%(기대 8.7%)는 -2.6σ 이나 가중치 코드에 단계 편향 경로가 없어 표본 잡음으로 판단 — 단, 40세트라 N5·N4 비중의 오차(±1.5~2%p)는 남는다.
  - **Leader 판단 재료**: 초보자(N5 676개 보유 상태가 아니라 **5단계를 다 넣은 사용자**)에게 오늘의 단어 한 세트(10장)의 약 9~10장 중 **N1 평균 4장, N5 평균 0.5~0.9장** — 초보자 목표 수준과 무관하게 큰 단계가 쏠려 나온다. 「내 수준 이하 우선」 정책은 별도 task 대상(이미 Leader 의 사용자 결정 후보로 올라 있음).

**남은 일**: 정리(QA1 WordEntry·VocabSession·VocabAttempt, 다른 표 증가분 확인) → 서버·복제본·쿠키 정리 → 최종 보고. **다음 첫 명령**: `qa/ops.ts wipe-sessions` → `wipe-words` → `qa/counts.ts 1` 로 베이스라인과 diff. **미정리**: QA1 WordEntry 676 · VocabSession 5(ABANDONED) · 쿠키 · 복제본 · 서버 3011(PID 810981).

## 체크포인트 최종 — 집계·정리 (qa 레인 A)
**판정 요약**: A1 PASS · A2 PASS · A3 ①PASS / ② NOT_VERIFIED(LLM 슬롯 항목) · A4 PASS(수치 기록). **결함 0건(Critical/High/Medium 없음)**, Low·Info 관찰 5건. 커밋 `46efd74` 격리 빌드(`next build` exit 0)·`next start` 3011, QA1 한정. 코드 수정 없음.

**관찰(결함 아님, Leader 판단 재료)**
1. [Low, 위험 후보] **seed-pack 소요가 같은 코드·같은 DB 에서 15배 흔들림** — N5 676행이 10,030 / 7,102 / 685 ms, N4 5,899 · N3 6,323 · N2 5,923 ms 인데 N1 3,034행은 3,341 / 4,484 / 5,030 / 3,643 ms, 2차 N4 1,505 · N3 2,632 · N2 2,963 · N1 2,189 ms. 30 초 트랜잭션 상한(`SEED_TX_TIMEOUT_MS`)을 넘긴 적은 없지만, N5 에서 본 최대 지연(10 s)이 N1 비율로 번지면 상한에 닿을 수 있다(미재현·추정). 상한을 넘으면 전부 롤백되고 같은 호출을 다시 하면 되는 구조(멱등 확인)라 데이터 손상은 없다. 화면(레인 B)이 로딩 표시·실패 후 재시도 문구를 갖췄는지 확인 권장.
2. [Info] **동시 2회 안전** — N1 병렬 두 요청이 A `added 3034` / B `added 0` (잠금 대기 후), 중복 행 0, 바이트 (표기,읽기) 중복 그룹 0.
3. [Info] **표기 우선 중복 정책** — 같은 표기·다른 읽기(明日 あした/あす)를 직접 추가·교정 채택·표기 변경하면 409 `existingId`(가장 이른 행, 호출마다 동일, 그 행을 지우면 다음 행). 콜레이션 오탐은 없음(`ヘッド` 저장 성공). 이미 Leader 결정 후보.
4. [Info] **분류 칩 API 순서 = 개수 내림차순** — 최상급 (N1) 3,034 → 고급 (N2) 1,767 → 중급 (N3) 1,649 → 초보자 (N5) 676 → 초급 (N4) 629. 화면에서 단계 순서(N5→N1)로 재정렬하는지는 레인 B 소관.
5. [Info] **세트 생성 시간은 단어 수에 비례** — 676개 p50 513 ms, 50개 p50 1,035 ms(DB 왕복 변동), 7,755개 p50 2.0 초·p95 2.9 초·최대 3.6 초(40회). 오늘의 단어 뽑기에 단계 편향 로직이 없어 **N1 비중 = 풀 비중(40세트 400장: N1 41.5% vs 풀 39.1%, N5 5.0% vs 8.7%)**.

**검증하지 못한 것(NOT_VERIFIED)**: ① 평가 생성·레슨 메모 연결(LLM 슬롯 길게 점유 — 정적 확인만) ② 교정 채택 **성공** 경로(옛 교정 행 상태 되돌림 불가) ③ 화면(레인 B) ④ 운영(PRODUCTION) 서버 시간 — 이번 측정은 로컬 `next start`+공유 NAS DB, 레인 B 가 같은 시각 같은 DB 를 쓴 상태.

**정리 결과**
- QA1(`qa-bot@thekaiwa.test`) 행: WordEntry(최대 7,755)·VocabSession(최대 40, 시도 행 cascade) 삭제 → **QA1 userId 칸 보유 전 표 수가 시작 전과 동일(`DIFF {}`)**: AiJob 14 · Profile 1 · UserVoiceSetting 1 · UserSpeechSetting 1 · Chat 3 · ChatMessage 64 · Correction 5(PROPOSED 유지) · TutorProposal 8 · LearningObservation 453 · Attendance 8 · StatsSnapshot 3 · LearnerErrorStat 2 · RequestTrace 281. 다른 사용자 행은 만지지 않음(모든 삭제가 QA1 userId 한정, 실행 전 개수 출력).
- 프로세스 정리: 내 서버 3011(PID 810981) PID 파일로만 종료, `ss -ltn` 에서 3011 비움(3010 개발 미러·3012 레인 B 서버는 내 것이 아니라 그대로). 복제본 `~/.node-local/thekaiwa-qa051a` 삭제 확인(`thekaiwa-qa051b` 는 레인 B 소유). 쿠키 `scratchpad/q051a/cookie1` 삭제. 스크린샷·PNG 산출물 없음(산출물 정리: 0개). 원 출력 로그는 scratchpad `q051a/*.log|txt` 에만(프로젝트 밖).
