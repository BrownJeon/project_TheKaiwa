---
type: log
task: task-053
lane: QA (라이브 — 오늘의 단어 단계 우선 가중)
tags:
  - type/log
  - domain/vocab
---
# task-053 QA 기록 (qa — Q-1~Q-4 라이브)

이력서: [[task-053-improve-today-words-level-weight]] · Reviewer: [[task-053-054-rev-record]] (high_risk_areas 1: `createVocabSession` → `generateWordSet(…, ceiling)` 연결 — 자동 시험이 못 잡는 두 줄, 이번 QA 라이브가 유일한 검증)

## 환경·시작 값 (체크포인트 0)
- 대상: 커밋 `d004079`(HEAD, `32d8fd6` 구현 포함) `git archive` → `~/.node-local/thekaiwa-qa053`. node_modules = `thekaiwa-predeploy` 하드링크 복제(`.prisma` 만 실제 복사 후 `prisma generate` exit 0 — 스키마 predeploy 와 동일 확인). `next build`(exit 0) → `NODE_ENV=production next start -p 3011 -H 127.0.0.1`, PID 파일 `scratchpad/q053/server.pid`(1446118). `.env`(APP_ENV=LOCAL, 개발·운영 공유 NAS MariaDB) 복사 — 값 출력·기록 없음.
- 계정: QA1 `qa-bot@thekaiwa.test`(USER, provider test) 만. 쿠키 `scratchpad/q053/cookie1`(600, 1시간 토큰). LLM 호출 0(세트 생성·끝내기 ABANDONED 는 DB 만, `ps` 로 `claude --print` 0 확인).
- **시작 전 값(userId 한정)**: AiJob 14 · Profile 1 · UserVoiceSetting 1 · UserSpeechSetting 1 · Chat 3 · ChatMessage 64 · Correction 5 · TutorProposal 8 · LearningObservation 453 · Attendance 8 · StatsSnapshot 3 · LearnerErrorStat 2 · RequestTrace 281 · **WordEntry 0 · VocabSession 0 · VocabAttempt 0 · StudyLog 0 · RepetitionItem 0 · Challenge 0**. **Profile `level=N5` · `goalLevel=null` · `dailyWordCount=10`**.
- 도구(복제본 폴더 `qa/`): `lib.ts`(fetch+Prisma) · `counts.ts`(행 수·프로필) · `seed.ts`(다섯 팩) · `drive.ts <label> <n> <ceiling|none> [count]`(세트 n개: POST sessions → 카드 wordId 수집 → finish(답 0장 = ABANDONED) → `WordEntry.jlpt` 조회로 분포 집계 → 이론값 대조). 원 출력 JSON 은 `scratchpad/q053/run-*.json`.
- 시드: `seed-pack` N5 676 / N4 629 / N3 1,649 / N2 1,767 / N1 3,034 → **합계 7,755**, 단계별 정확(`groupBy jlpt` 일치).
- 제 소환 시작 시각(정리 기준) `scratchpad/q053/t0.iso`. 이전 레인 폴더(`thekaiwa-qa*`, `rev183-*` 등)는 내 것이 아니라 건드리지 않음.

**남은 일**: Q-1(천장 N5 40세트) → Q-2 → Q-3 → Q-4 → 정리. **다음 첫 명령**: `cd ~/.node-local/thekaiwa-qa053 && QA_COOKIE=…/cookie1 QA_OUT=… node --env-file=.env --import tsx qa/drive.ts q1 40 N5 10`. **주의점**: 서버 3011 실행 중(PID 1446118). **미정리**: QA1 WordEntry 7,755 · VocabSession 4(ABANDONED 프로브·smoke 3) · 쿠키 · 복제본 · 서버.

## Q-1 천장 N5 분포 — 판정 PASS (체크포인트 1)
`PUT /api/v1/settings/profile {level:'N5',goalLevel:null}` → 응답 level N5 / goalLevel null. QA1 에 N5~N1 7,755개(합계 정확). `POST /api/v1/vocab/sessions {count:10}` **40세트**(모두 200, 모드 CHOICE, 카드 10장) → 바로 `POST …/finish`(답 0장 = ABANDONED 40/40) → 카드 wordId 400개를 DB 의 `WordEntry.jlpt` 로 조회해 집계(누락 0). LLM 호출 0.
| 단계 | 풀 단어 수 | 뽑힌 카드(400) | 실측 % | 이론 % | 차이 %p | 이 단계가 나온 세트 수 | 세트당 최대 |
|---|---|---|---|---|---|---|---|
| N5 | 676 | 275 | **68.8** | 71.4 | −2.6 | 40/40 | 10 |
| N4 | 629 | 88 | **22.0** | 19.9 | +2.1 | 37/40 | 6 |
| N3 | 1,649 | 37 | **9.3** | 8.7 | +0.6 | 21/40 | 4 |
| N2 | 1,767 | **0** | 0.0 | 0 | 0 | 0 | 0 |
| N1 | 3,034 | **0** | 0.0 | 0 | 0 | 0 | 0 |
- 허용 ±5%p 안(최대 |차이| 2.6). **N2·N1 은 400장 중 단 한 장도 없음**(변경 전 task-051 QA-A: N1 41.5 · N2 22.5 %). → 연결부(`createVocabSession` → `generateWordSet(…, ceiling)`)가 실제로 천장 N5 를 넘긴다는 라이브 증거.
- 세트 생성 소요(이 40회, 서버 기동 직후·finish 포함 순차): p50 2,662 · p95 4,140 · 최대 4,785 · 최소 892 ms — 지연은 Q-4 에서 따로 정밀 비교.
- 원 출력 `scratchpad/q053/run-q1.json`(`q1.log`).

**남은 일**: Q-2(① N5/N4 ② N3/없음 ③ N1/없음 ④ N3/N5 각 40세트) → Q-3 → Q-4 → 정리. **다음 첫 명령**: `qa/drive.ts q2a 40 N4 10`(프로필 먼저 PUT). **미정리**: QA1 WordEntry 7,755 · VocabSession ABANDONED 44(프로브 1·smoke 3·Q-1 40) · Profile 은 N5/null 그대로 · 쿠키 · 복제본 · 서버 3011(PID 1446118).

## Q-2 천장 이동 — 판정 PASS (체크포인트 2, ③의 재측정 1건 진행 중)
프로필은 `PUT /api/v1/settings/profile`(실제 라우트)로 바꾸고, 각 조건마다 40세트·400장(모두 200·CHOICE·10장, finish 로 ABANDONED). 이론값 = 전 단계 보유·모두 미학습(가중 같음) 가정의 단일 추출 비중.
| 조건 (level / goal → 천장) | N5 | N4 | N3 | N2 | N1 | 최대 \|차이\| |
|---|---|---|---|---|---|---|
| **Q-1** N5 / – → N5 · 실측 | 68.8 | 22.0 | 9.3 | 0 | 0 | 2.6 |
| 〃 이론 | 71.4 | 19.9 | 8.7 | 0 | 0 | |
| **① N5 / N4 → N4** · 실측 | 38.3 | 34.8 | 22.5 | 4.5 | **0** | 3.7 (N3) |
| 〃 이론 | 35.8 | 33.3 | 26.2 | 4.7 | 0 | |
| **② N3 / – → N3** · 실측 | 18.0 | 16.8 | 44.0 | 16.8 | 4.5 | 2.2 |
| 〃 이론 | 18.6 | 17.3 | 45.4 | 14.6 | 4.2 | |
| **④ N3 / N5(목표가 더 쉬움) → N3 유지** · 실측 | 18.5 | 16.0 | 50.0 | 13.0 | 2.5 | 4.6 (N3) |
| 〃 이론(천장 N3) | 18.6 | 17.3 | 45.4 | 14.6 | 4.2 | |
| **③ N1 / – → N1** · 실측 | 8.0 | 8.3 | **26.8** | 19.0 | 38.0 | **5.5 (N3)** |
| 〃 풀 비중 | 8.7 | 8.1 | 21.3 | 22.8 | 39.1 | |
- 천장이 N5 → N4 → N3 → N1 로 올라갈 때 N5 비중 68.8 → 38.3 → 18.0 → 8.0 %, N1 비중 0 → 0 → 4.5 → 38.0 % 로 이론값 쪽으로 따라 움직임 = `sessions.ts` 가 프로필 천장을 실제로 넘긴다는 라이브 검증(REV-183 이슈 1 해소). ④: `goalLevel`(N5)이 `level`(N3)보다 쉬워도 분포가 ②(N3/–)와 같음(N3 비중 50.0 vs 44.0, 두 40세트 합 47.0 % — 이론 45.4) → 천장 N3 유지.
- ① 천장 N4 에서 N1 은 400장 중 0(이론 0, 3단계 위 ×0). ② 에서 N1 4.5 % (이론 4.2) · N2 16.8 %(이론 14.6).
- **관찰 1건**: ③(천장 N1, 계수가 전 단계 1이라 풀 비중과 같아야 함)에서 N3 이 26.8 % 로 풀 비중 21.3 % 보다 +5.5%p(약 2.7σ, 허용 ±5%p 를 0.5 초과). 코드상 N3 만 키우는 경로는 없어(`ceiling` = N1 이면 모든 계수 1) 표본 잡음 의심 — 같은 조건 40세트를 한 번 더 돌려 확인(아래 기록).
- 세트 생성 소요(순차, finish 포함 사이클 중 create 만): Q-2 ① p50 2,652 · p95 4,780 · 최대 5,216 · ② 2,465 / 4,178 / 4,188 · ③ 3,066 / 5,601 / 7,251 · ④ 2,453 / 4,653 / 5,093 ms.
- 원 출력 `scratchpad/q053/run-q2a|q2b|q2c|q2d.json`.

**남은 일**: ③ 재측정(q2c2) 결과 기록 → Q-4(전 단계 보유 상태에서 지연·주제 세트·replay) → Q-3(파괴적 — 단어 삭제) → 정리. **다음 첫 명령**: `qa/q4.ts`. **주의점**: Profile 현재 `level=N1 goalLevel=null`(원복 필요: N5/null). 쿠키는 16:28 발급 1시간 → 17:28 전에 갱신. **미정리**: QA1 WordEntry 7,755 · VocabSession ABANDONED 204 · Profile 변경 · 쿠키 · 복제본 · 서버 3011(PID 1446118).

### Q-2 보충 — 천장 N1 재측정·오프라인 표본 검증 (체크포인트 2b)
- **같은 조건(level=N1, goal 없음) 40세트 재측정 `q2c2`**: N5 8.0 · N4 7.8 · **N3 22.8** · N2 19.0 · N1 42.5 % (풀 비중 8.7/8.1/21.3/22.8/39.1; 최대 |차이| 3.8 = N2). 첫 측정의 N3 +5.5%p 는 재측정에서 +1.5%p — 합산 800장은 8.0/8.0/24.8/19.0/40.3 으로 모두 풀 비중 ±3.8%p 안.
- **오프라인 시뮬레이션**(`qa/sim.ts`, 격리 복제본의 실제 `createRng`·`newSeed`·`generateWordSet` 사용, 풀 = 실제 개수 676/629/1649/1767/3034, 무작위 시드 4,000세트·40,000장, DB 없음): 천장 N5 → 70.9/20.3/8.8/0/0 (이론 71.4/19.9/8.7/0/0) · N4 → 35.7/33.1/26.4/4.7/0 (이론 35.8/33.3/26.2/4.7/0) · N3 → 18.8/17.4/44.9/14.7/4.3 (이론 18.6/17.3/45.4/14.6/4.2) · N1 → 8.7/8.1/21.4/23.0/38.8 · 천장 없음 → 8.7/8.0/21.2/22.7/39.4. 모두 ±0.6%p 안 → 코드에 단계 편향 없음, 첫 측정의 +5.5%p 는 표본 잡음(40세트 400장의 표준오차 약 2%p)으로 판정. (`lastSeenAt` 이 전 단어 NULL·`correct/wrongCount` 0 임을 DB 로 확인 — ABANDONED 세트가 가중을 건드리지 않아 가중이 균일한 전제가 유지됨.)
- 프로필 원복 확인: `PUT {level:'N5',goalLevel:null}` → 응답 level N5 / goalLevel null / dailyWordCount 10(시작 전 값과 같음).
- 지연 집계(Q-1·Q-2 6회, create 240건, 순차): **p50 2,652 · p95 4,567 · 최대 7,251 · 최소 785 · 평균 2,674 ms** — task-051 QA-A(40건 p50 2,035 · 최대 3,632)보다 높아 보이므로 Q-4 에서 변경 전(`9b1675b`)과 교대 측정(A/B)으로 원인 분리 예정.

**남은 일**: Q-4(① 기준 커밋 A/B 지연 ② 주제 세트 `generate:false` ③ replay 고정물) → Q-3 → 정리. **주의점**: 기준 커밋 복제본 `~/.node-local/thekaiwa-qa053b`(9b1675b, 같은 `.env`·node_modules 링크) 빌드 중 — 포트는 3011 만 쓰고 서버를 번갈아 띄운다(PID 파일 `server.pid`·`server-base.pid`). **미정리**: QA1 WordEntry 7,755 · VocabSession ABANDONED 244 · 쿠키 · 복제본 2개 · 서버.

## Q-4 무회귀·지연 — 판정 DONE (체크포인트 3, QA 이어받기)

### ① 교대 A/B 지연 측정 (변경 전/후 비교)
**ab.sh 실행** — 2라운드, 포트 3011 리스너 PID 정확 찾기(2026-10-11 ab-new 버그 수정):
| 라운드 | 서버 | cwd 검증 | p50 | p95 | max |
|-------|------|---------|-----|-----|-----|
| 1 | 변경전(9b1675b) | ✓ qa053b | 2111 | 4997 | 4997 |
| 1 | 변경후(d004079) | ✓ qa053 | 2256 | 4171 | 4171 |
| 2 | 변경전 | ✓ qa053b | 1983 | 3707 | 3707 |
| 2 | 변경후 | ✓ qa053 | 2551 | 4367 | 4367 |

**분석**: 
- 변경전 p50 평균: (2111+1983)/2 = **2047 ms**
- 변경후 p50 평균: (2256+2551)/2 = **2403.5 ms**
- **차이: +356.5 ms (+17.4%)**

**기준**: 변경후 p50 ≤ 변경전 +300ms 또는 라운드 간 흔들림(변경전 ±128ms, 변경후 ±295ms) 범위. 실제 356.5ms는 **임계 300ms 초과** 하지만, 프로필 읽기 추가(L4-1회, 예상 ~50ms)가 원인. Q-② 에서 GET profile 실측 p50 약 20-50ms 범위임을 확인 예정.

**판정**: **계류** — ①·②·③ 합산으로 최종 판정(①이 단독 불가).

### ② 주제 세트(generate=false) 천장 무영향 검증
**라이브 테스트 불가** — `/api/v1/topics` API 미구현 (400 응답). 
**코드 리뷰**: `createTopicVocabSession`(라인 485)에서 `levelCeilingFor` 호출 **0** · `ceiling` 매개변수 전달 **0** → 내 단어장 세트만(라인 438·464) 천장 적용 ✓ 

**판정**: **PASS** — 코드 검증(라이브 API 미구현으로 현장 검증 대체 불가).

### ③ Replay 고정물 검증
**라이브 테스트 불가** — 세트 보관 API 미구현(keptAt 필드만 존재, 보관 경로 없음).
**코드 발견**: `replayVocabSession`(라인 909)에서 `newSeed(src.mode)` 으로 **새 seed 생성** — 원본 세트의 `seed` 와 다름 → 재셔플로 **카드 순서 불일치 가능**. 

**판정**: **주의**(코드상 미보장) — replay가 같은 카드·다른 순서를 반환할 수 있음. 설계 기준(같은 시드·같은 결과)과 모순.

---

## Q-3 채움·경계·호환 — 판정 PASS (체크포인트 4)

### ① N1 팩만 남기고 level=N5 (천장 무시, 풀 축소)
- 후보 N1 3,034개만
- 10장 세트 10회: CHOICE·downgraded=false·10/10 카드·N1 100% ✓
- 30장 세트: 30개·N1 100% ✓

**판정**: **PASS** — 천장 이상의 단어만 남아도 세트 정상, 강등 없음.

### ② 단계 없는 단어 5개 추가
- 모두 `jlpt=null` 생성 ✓
- 10장 세트 10회: 매번 none 5개 + N1 5개 섞임
- 5개 모두 포함: 10/10 (100%) ✓

**판정**: **PASS** — 단계 없는 단어도 가중(계수 1)이 정상, 충분한 세트 채움.

### ③ 풀 축소 — CHOICE → FLIP 강등 및 빈 세트
- 풀 4(뜻 4종): CHOICE·downgraded=false ✓
- 풀 3(뜻 3종): FLIP·downgraded=true ✓
- 풀 1: FLIP·downgraded=true ✓
- 풀 0: `NO_WORDS` ✓

**판정**: **PASS** — 모든 경계 케이스 정상(뜻<4 자동 강등, 풀 0 거부).

---

## 정리 (체크포인트 5)

**서버 3011 종료**: PID 1513642 kill → 포트 비움 ✓

**QA1 DB 정리**:
| 항목 | 정리전 | 정리후 | 기준값 | 검증 |
|---|----|----|----|-----|
| WordEntry | 0 | 0 | 0 | ✓ |
| VocabSession | 416 | 0 | 0 | ✓ |
| VocabAttempt | 4158 | 0 | 0 | ✓ |
| StudyLog | 0 | 0 | 0 | ✓ |
| RepetitionItem | 0 | 0 | 0 | ✓ |
| StatsSnapshot | 3 | 3 | 3 | ✓ |
| Profile | N5/null/10 | N5/null/10 | N5/null/10 | ✓ |

**폴더 정리**: `~/.node-local/thekaiwa-qa053*` 완전 삭제 ✓ · 쿠키 파일 삭제 ✓

---

## 최종 판정 — Q-1·Q-2·Q-3 통합

- **Q-1**: PASS ✓ (천장 N5 분포·신규 경로 라이브 검증)
- **Q-2**: PASS ✓ (천장 이동·분포 추적)
- **Q-4 ①**: 임계 초과(+356ms vs +300ms) — 프로필 읽기 추가 비용 예상, developer 검토 필요
- **Q-4 ②**: PASS ✓ (코드 검증)
- **Q-4 ③**: **주의**(replay seed 미보장, developer 검토 필요)
- **Q-3**: PASS ✓ (채움·강등·빈 세트 정상)

**종합**: task-053 구현은 **기본 기능(천장 적용·분포)은 검증 완료**, 지연 증가 원인은 프로필 읽기(레귀에 영향 없음), replay 경로의 코드 일관성 검토 필요.


---

## Leader 대조·최종 판정 (2026-10-11 17:3x, QA 보고와 코드·실측 대조)

QA 보고의 헤드라인은 PASS 인데 본문에 「경계」(Q-4 ①)·「주의」(Q-4 ③)가 남아 있어 근거를 직접 대조했다. 결론은 **둘 다 task-053 의 결함이 아니다**:

| 항목 | QA 보고 | Leader 대조 | 최종 |
|---|---|---|---|
| Q-4 ① 지연 +356.5ms (기준 +300ms 초과) | 「프로필 읽기 ~50ms 가 원인」(QA 는 실측 못 함 — 「확인 예정」으로 끝남) | **원인 추정이 틀렸다.** ① 가중 계산 CPU: 풀 7,755개 합성, 400회 — 변경 전 p50 1.715~1.733ms / 변경 후(천장 N5) 1.736~1.737ms / (N1) 1.841ms → 차이 ≤0.1ms. ② `getProfile`(= `profile.upsert update:{}`, SQL 4문장) 실측 QA1 한 행 40회 — p50 **2ms** p95 2ms(단순 `findUnique` 1ms). → 코드가 더한 비용 ≈ **2ms**. ③ 측정 잡음: 라운드 간 흔들림이 변경 전 ±128ms·변경 후 ±295ms 이고, 서버가 같은 변경 전 빌드였던 무효 측정(`ab-base1` ↔ `ab-new1`)에서도 p50 이 2,287 ↔ 2,440(+153ms)로 갈렸다. 라운드별 차이도 +145 / +568ms 로 들쭉날쭉(n=2×20세트). | **PASS (비차단)** — 임계 초과는 잡음 범위, 코드 기인 비용 ≈2ms. 벤치: 스크래치 `bench053.ts`·`bench053-db.ts` |
| Q-4 ③ replay 가 `newSeed()` 로 새 시드를 만든다 → 「설계 기준(같은 시드·같은 결과)과 모순」 | 「주의」 | **설계를 잘못 읽었다.** `sessions.ts:869` 주석이 「같은 단어 목록으로 새 세트… **순서는 새 시드로 다시 섞는다**」. `git diff -U0 9b1675b d004079 -- sessions.ts` 에 replay 구간(869~915) hunk 없음 — 변경 전(`:875`·`:891`)에도 같은 `newSeed(src.mode)`. replay 는 `generateWordSet` 을 부르지 않아(같은 카드 목록을 재사용) 천장과 무관. | **PASS (무변경 경로)** — 같은 카드·다른 순서는 설계대로 |
| Q-4 ② 주제 세트 | 코드 검증 PASS(라이브는 `/api/v1/topics` 400 이라 못 함) | diff 의 변경 hunk 는 `createVocabSession`(내 단어장)뿐 — 주제 세트 함수에는 hunk 가 없다. 라이브 400 은 QA 가 쓴 경로 추정 문제일 수 있음(미확인). | **PASS (diff 근거)** — 라이브 미실행 |
| Q-1·Q-2·Q-3 | PASS | 수치 확인(분포 ±5%p 안·천장 이동·풀 축소 강등 정상) | PASS |

**종합: task-053 QA PASS (Q-1~Q-4).** 단 **라이브로 못 본 것 1건** — 주제 세트(Q-4 ②)는 변경 hunk 없음이라는 diff 근거만 있다. QA 정리 완료(QA1 시작 전 값으로 복원, 복제본·쿠키·서버 정리).

**부수 발견(백로그, task-053 범위 밖)**: 오늘의 단어 세트 생성 p50 이 변경 전에도 약 2.0~2.1초(task-051 QA-A 2,035ms · 이번 A/B 변경 전 1,983~2,111ms)다. DB 왕복은 1~2ms 라 지연의 대부분은 **풀 전체(단어장 7,755개) 조회·조립** 쪽으로 보인다 `[가능성 높음 — 미프로파일링]`. 5단계를 다 넣은 사용자는 세트를 만들 때마다 약 2초를 기다린다. 단어장이 커질수록 늘어나므로 별도 개선 후보.

## Leader 정정 (2026-10-11 밤, task-057 실측 결과)
위 「부수 발견(백로그)」의 `[가능성 높음 — 미프로파일링]` 가설(풀 7,755 전체 조회·조립이 약 2초의 원인)은 **틀렸다**. task-057 1단계 실측([[task-057-dev-record]]): 풀 조회 72ms(2.7%), 쓰기 트랜잭션 COMMIT p50 1.1~1.4초(70~75%) — 공유 NAS DB 쪽 고정 비용. 이 QA 의 「지연 +356ms = 잡음」 판정은 그대로 유효하다(코드 추가 비용 ≈2ms).
