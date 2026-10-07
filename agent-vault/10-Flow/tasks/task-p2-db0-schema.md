---
task_id: task-p2-db0
title: "Phase 2 통합 스키마 작성(DB0) — 챌린지 D1·D2·D4·D5 + TTS 관측 6칸 + 빈 모듈 스캐폴딩 + QA 계정 3·4"
status: todo
base_ref: 5c3a701
risk_level: "R2"
roles_involved: [leader, developer, reviewer]
related_tasks: [task-039-improve-tutor-explanation, task-040-improve-challenge-design, task-012b-3-tts-observability]
tags:
  - type/task
  - domain/db
aliases:
  - DB0
  - Phase 2 스키마
created: 2026-10-06
updated: 2026-10-06
---

## 목표 (Leader)
Phase 2 일괄([[phase2-batch-plan]] §4)의 **스키마 단일 작성자 작업**. `prisma/schema.prisma` 는 `db push` 가 파일 전체를 반영하므로 이 task 한 명이 모든 추가를 쓰고 Reviewer 가 승인 목록과 1:1 대조한 뒤 Leader 가 백업 → `migrate diff` 확인 → **한 번만** `db push` 한다. 다른 WP 는 `prisma/schema.prisma` 를 건드리지 않는다.

## 사용자 승인 (AskUserQuestion 2026-10-06 "전부 승인") — 이 목록이 전부다
| # | 변경 | 소속 task | 비고 |
|---|---|---|---|
| A | `Correction.extraNoteKo String? @db.VarChar(400)` | task-039 | **이미 작업 트리에 있음 — 유지** |
| B | enum `ChallengeStatus`(ACTIVE·COMPLETED·ENDED) | task-041(T1) | 새 enum 은 새 표 전용 — 기존 enum 값 추가 0 |
| C | model `Challenge` | task-041(T1) | `challenge.md` §3-2 그대로(`activeKey @unique`·인덱스·User Cascade·주제 SetNull) |
| D | `VocabSession.topicId String?` + 관계(SetNull) + `@@index([userId, topicId, date])` | task-042(T2) | D4 |
| E | `VocabAttempt.refType`·`refId` (nullable, FK 없음) | task-042(T2) | D5 |
| F | `EngineMetricsDaily` 6칸: `p99Ms Int?`·`ttfaP50Ms Int?`·`ttfaP95Ms Int?`·`rtfAvg Float?`·`cacheHitRate Float?`·`byVoice Json?` | task-012b-3 | `speech-platform/16-tts-productization-layer.md` §7.3 — **확장**(신설 아님) |
| — | 역방향 관계 `User.challenges`·`ConversationTopic.{challenges, vocabSessions}` | — | Prisma 스키마만, DB 칸 없음 |

**승인 밖(넣지 말 것)**: `VocabAttempt.exampleSnap`·`exampleKoSnap`(A12 예문 저장 — 추가 승인 필요) · 012c-3 `TtsQualityRun` 등 3표 · `JobKind`/`SnapshotKind` 값 추가 · 단어 은행 표 · 챌린지 T6 용 칸. 더하고 싶은 것이 보이면 줄을 넣지 말고 이력서에 "추가 승인 필요"로 기록.

## 예상 변경 경로 (이 task 소유)
- `prisma/schema.prisma`(위 표 B~F)
- 빈 모듈 스캐폴딩: `src/modules/learning/challenges/index.ts`·`src/modules/learning/scenarios/index.ts`(빈 export) + `src/modules/learning/index.ts` export 2줄 — 병렬 developer 가 같은 파일을 동시에 만들지 않게 하는 충돌 제거용
- `tests/live/qa-session.ts` — QA 계정 3·4 추가(provider `test` — 레인별 계정 분리, [[phase2-batch-plan]] §6: 3 = 챌린지 레인, 4 = 010d 레인)
- 산출(저장소 밖): `prisma migrate diff --script` SQL 은 scratchpad 에 저장

## 완료 기준
1. `prisma format`·`validate`·`generate` 통과, `tsc --noEmit`·변경 파일 eslint 0.
2. `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (**읽기 전용 — DB 를 바꾸지 않음**) 출력이 위 승인 목록의 문장만: 표 1(Challenge)·enum 1(MariaDB 는 컬럼 ENUM)·칸 1(extraNoteKo)+칸 1(topicId)+칸 2(refType·refId)+칸 6(EMD)·인덱스·FK. **그 밖의 문장(예: 옛 인덱스 삭제·다른 task 의 드리프트)이 나오면 push 하지 않고 이력서에 문장을 붙여 Leader 판단**. 이 저장소에서 `migrate diff` 를 써 본 기록이 없다(`challenge.md` [추측]) — 안 되면 `git diff` 로 대체하고 사유 기록.
3. 개발 서버·라이브·DB 쓰기 금지, **`prisma db push` 금지**(Leader 가 백업 뒤 한 번).

## 파일 경계
- 미러 `~/.node-local/thekaiwa-p2db`(`KAIWA_LOCAL_ROOT`, [[phase2-batch-plan]] §3 복제 절차). NFS 만 편집.
- 이 task 밖의 소스(`src/modules/**` 구현·화면·프롬프트)는 건드리지 않는다.

## Developer 기록
- [22:00] 체크포인트 1 (developer dev-p2-schema) — **완료**: 미러 `~/.node-local/thekaiwa-p2db` 생성(§3 절차: rsync `--link-dest` 로 node_modules 하드링크, `.cache/`·`.prisma/` 제외, lock 복사, `KAIWA_LOCAL_ROOT` sync, `prisma generate` — 메인 미러 `.prisma/client` 와 inode 다름·`@prisma/client` 쓰기 0 확인). 편집 전 기준 `tsc --noEmit` 0 오류. `prisma/schema.prisma` 에 표 B~F + 역방향 관계 추가(+69줄, 삭제 0), 빈 모듈 2개·barrel 2줄·QA 계정 3·4 작성. `prisma validate`·`generate` 통과. **남은 일**: tsc·eslint·단위 테스트·`migrate diff`(읽기 전용) 대조 표·최종 기록. **주의**: `prisma format` 은 이 파일의 **기존 줄 약 100줄**(User 관계 블록·Profile·UserVoiceSetting·WordEntry·TtsCache·VoiceModel 등 정렬)을 바꾼다 — HEAD 파일 자체가 포맷 안 된 상태라서이고 내 추가와 무관(HEAD·내 버전을 각각 포맷해 비교한 변경 집합이 같음). 그래서 NFS 파일에는 format 을 적용하지 않았다. **미커밋 파일**: `prisma/schema.prisma` · `src/modules/learning/{challenges,scenarios}/index.ts`(새 파일) · `src/modules/learning/index.ts` · `tests/live/qa-session.ts`.
- [22:05] 체크포인트 2 — **구현 완료(DONE, risk R2)**. push·DB 쓰기·dev 서버·라이브·커밋 0.

### 변경 파일
| 파일 | 변경 | 승인 행 |
|---|---|---|
| `prisma/schema.prisma` | +69줄 / 삭제 0 (`git diff HEAD --stat`). 머리 주석 2줄(2026-10-06 승격 이력) · enum `ChallengeStatus`(PlanStatus 뒤) · `User.challenges` · `VocabSession.topicId`+`topic`(SetNull)+`@@index([userId, topicId, date])` · `VocabAttempt.refType VarChar(30)`·`refId VarChar(40)` · `ConversationTopic.{challenges, vocabSessions}` · model `Challenge`(StudyPlan 뒤, L3 구역 — `challenge.md` §3-2 필드·타입·`@unique`·인덱스 2·관계 그대로, 주석만 줄임) · `EngineMetricsDaily` 6칸(p95Ms 뒤) · `Correction.extraNoteKo`(039, 그대로 유지) | A~F + 역방향 |
| `src/modules/learning/challenges/index.ts` | 새 파일 — 머리 주석 + `export {}` | 스캐폴딩 |
| `src/modules/learning/scenarios/index.ts` | 새 파일 — 머리 주석 + `export {}` | 스캐폴딩 |
| `src/modules/learning/index.ts` | +3줄 — 구분 주석 1 + `export * from './challenges'` · `export * from './scenarios'` | 스캐폴딩 |
| `tests/live/qa-session.ts` | +6/−1 — 계정 `'3'` `qa-bot3@thekaiwa.test`(USER, 챌린지 레인) · `'4'` `qa-bot4@thekaiwa.test`(USER, 010d 레인), 머리 주석·오류 문구. 기존 `upsert`(provider `test`, `@thekaiwa.test` — `infra/users.ts` `QA_USER_WHERE` 와 같은 규칙) 그대로라 **행은 QA 가 처음 실행할 때 생긴다** — 지금 DB 에 만든 행 0 | QA 계정 |

새 관계는 기존 정렬 블록을 다시 맞추지 않게 **빈 줄로 나눈 별도 묶음**에 넣었다(`VocabSession.topic`·`ConversationTopic` 역방향 2줄) — `ConversationTopic?` 가 기존 열 폭보다 길어 같은 묶음에 넣으면 `prisma format` 이 기존 줄 공백을 바꾸기 때문이다.

### `prisma format` — NFS 파일에 적용하지 않음
`prisma format` 은 **기존 줄 약 100줄**(User 관계 블록 전체·Profile·UserVoiceSetting·WordEntry·TtsCache·VoiceModel·DebugSession 등의 열 정렬, 공백만)을 바꾼다. 원인은 HEAD 파일이 원래 포맷 안 된 상태라서다 — HEAD 와 내 버전을 각각 scratchpad 에서 포맷해 비교하면 변경 집합이 같고, 차이는 내 `User.challenges` 한 줄이 이웃 줄과 같이 한 칸 당겨지는 것뿐이다 [확실 — 실행 비교]. 승인 밖 줄을 건드리지 않으려고 포맷 결과는 버렸다(미러도 NFS 로 다시 sync). 공백 정리는 별도 작업(스키마 의미 변화 0)으로 Leader 판단.

### `migrate diff` 대조 (읽기 전용)
명령: 미러에서 `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` — `--from-url "$DATABASE_URL"` 와 같은 DB(스키마 datasource 의 `env("DATABASE_URL")`, 미러 `.env`)를 읽는다. URL 이 셸 변수·argv(`ps` 에 보임)에 실리지 않게 이 형태를 썼다. exit 0, 출력 55줄, URL·비밀번호 문자열 0건. SQL 원문: scratchpad `p2db-migrate-diff.sql`(아래 표가 그 전부).

| # | SQL 문장 | 승인 행 | 소속 task |
|---|---|---|---|
| 1 | `ALTER TABLE Correction ADD COLUMN extraNoteKo VARCHAR(400) NULL` | A | 039 |
| 2 | `ALTER TABLE EngineMetricsDaily ADD COLUMN byVoice JSON NULL, cacheHitRate DOUBLE NULL, p99Ms INTEGER NULL, rtfAvg DOUBLE NULL, ttfaP50Ms INTEGER NULL, ttfaP95Ms INTEGER NULL` | F(6칸) | 012b-3 |
| 3 | `ALTER TABLE VocabAttempt ADD COLUMN refId VARCHAR(40) NULL, refType VARCHAR(30) NULL` | E | 042 |
| 4 | `ALTER TABLE VocabSession ADD COLUMN topicId VARCHAR(191) NULL` | D | 042 |
| 5 | `CREATE TABLE Challenge (…16칸… status ENUM('ACTIVE','COMPLETED','ENDED') NOT NULL DEFAULT 'ACTIVE', level ENUM('N5'…'N1'), UNIQUE INDEX Challenge_activeKey_key(activeKey), INDEX Challenge_userId_status_startDate_idx, INDEX Challenge_userId_endedAt_idx, PK id) utf8mb4_unicode_ci` | B(enum = 컬럼 ENUM)·C | 041 |
| 6 | `CREATE INDEX VocabSession_userId_topicId_date_idx ON VocabSession(userId, topicId, date)` | D | 042 |
| 7 | `ALTER TABLE VocabSession ADD CONSTRAINT VocabSession_topicId_fkey … REFERENCES ConversationTopic(id) ON DELETE SET NULL ON UPDATE CASCADE` | D | 042 |
| 8 | `ALTER TABLE Challenge ADD CONSTRAINT Challenge_userId_fkey … REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE` | C | 041 |
| 9 | `ALTER TABLE Challenge ADD CONSTRAINT Challenge_topicId_fkey … REFERENCES ConversationTopic(id) ON DELETE SET NULL ON UPDATE CASCADE` | C | 041 |

- **승인 밖 문장 0** — DROP·MODIFY·옛 인덱스 삭제·다른 task 드리프트 없음. 기존 DB 와 HEAD 스키마 사이 선행 불일치도 없다(문장이 전부 이번 추가분으로 설명됨) [확실 — 출력 전부 대조].
- `-- Warnings`(데이터 손실 경고) 없음 → `--accept-data-loss` 불필요.
- FK 짝 확인(읽기 전용 `information_schema` 조회): `User.id`·`ConversationTopic.id` = `varchar(191)` · `utf8mb4_unicode_ci`, 대상 표 전부 InnoDB·`utf8mb4_unicode_ci` — 새 FK 칸(VARCHAR(191), 새 표 unicode_ci)과 맞다. MariaDB `10.11.11`. `Challenge` 표 아직 없음. 행 수: VocabSession 6 · VocabAttempt 50 · EngineMetricsDaily 0 · Correction 7 → ALTER 잠금 시간 무시할 수준 [가능성 높음].
- `Challenge.topicId`·`VocabSession.topicId` 는 FK 칸이 인덱스 맨 앞이 아니라 InnoDB 가 FK 용 인덱스를 따로 만든다. migrate diff 에는 안 나오지만 기존 `Lesson.topicId`(같은 모양, `@@index([userId, topicId])`)가 드리프트로 잡히지 않으므로 push 뒤에도 드리프트가 되지 않는다 [가능성 높음].

### 검증 숫자 (미러 `thekaiwa-p2db`)
- `prisma validate` 통과 · `prisma generate` 통과(v6.19.3, 미러 전용 `.prisma/client` — 메인 미러 생성물에 `model Challenge` 0, inode 다름).
- `tsc --noEmit`: 편집 전 0 → 편집 후 **0 오류**.
- eslint(변경 4파일: `learning/index.ts`·`challenges/index.ts`·`scenarios/index.ts`·`tests/live/qa-session.ts`): **0**.
- 단위 테스트 `src/modules/conversation` + `src/modules/learning` 전체(`node --import tsx --test --test-concurrency=1`): **624/624 pass, fail 0**(17.3s).
- 보이지 않는 문자 grep(변경 5파일): 0건.

### 승인 밖으로 보이는 것 — 넣지 않음, "추가 승인 필요"
1. `docs/design/domain-model.md` §10(2724행)의 `EngineMetricsDaily` 확장 제안은 **8칸**(`queueDelayMs Int?`·`modelLoadMs Int?` 포함)이다. 승인·16 §7.3·012b-3 이력서는 6칸이라 6칸만 넣었다. 012b-3 대시보드가 Model Load Time(16 §7.3 대시보드 항목)을 일별로 보이려면 `modelLoadMs` 가 필요해질 수 있다 [추측] → 필요하면 추가 승인.
2. `VocabAttempt.exampleSnap`·`exampleKoSnap`(A12 예문) — 넣지 않음(이력서 승인 밖 목록 그대로).
3. **정본 갱신 필요(Leader 영역)**: 스키마 머리말은 "정본 domain-model §3 → 이 파일 순서"인데 `domain-model.md` 에 `Challenge`·`ChallengeStatus`·`VocabSession.topicId`·`VocabAttempt.refType/refId`·EMD 6칸이 아직 없다(`extraNoteKo` 만 있음, grep 확인). `challenge.md` §11-3 은 구현 task 안에서 반영하기로 했으니 041·042·012b-3 완료 기준에 넣거나 Leader 가 한 번에 옮긴다.
4. `prisma format` 공백 드리프트(위 절) — 의미 변화 없음, 별도 정리 여부만.

### Reviewer 에게 보일 핵심
- 승인 목록 1:1: diff 는 **추가만**(삭제 0). 새 enum 은 `ChallengeStatus` 하나이고 `Challenge.status` 에서만 쓴다 — 기존 enum 값 추가 0(`JobKind`·`SnapshotKind` 무변경).
- `onDelete`: `Challenge→User` Cascade · `Challenge→ConversationTopic` SetNull · `VocabSession→ConversationTopic` SetNull. `VocabAttempt.refType/refId` 는 FK 없음(RepetitionItem 규약·길이 30/40 같음).
- `activeKey String? @unique @db.VarChar(40)` → `Challenge_activeKey_key`. 인덱스 `(userId, status, startDate)`·`(userId, endedAt)`·`VocabSession(userId, topicId, date)`.
- `extraNoteKo` 2줄은 039 작업 트리 그대로(내가 바꾸지 않음).
- `challenge.md` §3-2 대비 차이는 **주석 문구만**(필드명·타입·속성·관계·인덱스 동일): `dailyGoal` 주석의 U14 대안 설명(W1/W3/W4) 3줄을 줄였고 `result` 주석의 REV 번호를 뺐다.
- `learning/index.ts` 의 `export *` 두 줄: 하위 모듈이 export 를 더할 때 다른 barrel 이름과 겹치면 `tsc` 가 잡는다(041·010d 주의).

**남은 일(Leader)**: Reviewer 스키마 감사 → 백업 → push 직전 `migrate diff` 재실행(작업 트리가 그새 바뀌지 않았는지 — 같은 9문장이어야 함) → `prisma db push` 1회 → 각 미러 `prisma generate`. **다음 첫 행동(재소환 시)**: 없음 — 리뷰 지적이 오면 그 줄만 수정. **미커밋 파일**: 위 변경 파일 표 5개.

## Reviewer 기록 (REV-118)

**판정: PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 3 · Info 5) — `prisma db push` 진행 가능. 차단 지적 없음. 단 아래 "Leader push 직전 체크리스트"를 지킬 것. 감사 2026-10-06 22:10 KST, reviewer 신규 소환(코드·스키마·문서 수정 0, DB 쓰기 0, 커밋·push 0).

**감사 대상 고정**(sha256 앞 16자 — 달라지면 그 파일을 다시 감사): `prisma/schema.prisma` 6d692334b89d66f7 · `learning/index.ts` 60b88aa75b1fa7f9 · `learning/challenges/index.ts` fe00ddf849c78b16 · `learning/scenarios/index.ts` b3ca266f50f9b6c3 · `tests/live/qa-session.ts` 55ae690bf12a340e. `git diff HEAD --numstat -- prisma/schema.prisma` = 추가 69 / 삭제 0, `prisma/` 아래 다른 파일 변경 0.

### 1. 승인 목록 1:1 대조 [확인]
- 추가 줄 전부가 표 A~F + 역방향 관계 + 머리 주석 2줄(주석만)에 속한다. 삭제 0(`git diff -U0` 의 `-` 줄 0), 기존 줄 공백 불변(`prisma format` 미적용), 추가 줄의 줄끝 공백·CR·보이지 않는 문자 0.
- 모델 53→54(`Challenge`), enum 61→62(`ChallengeStatus`). `JobKind`·`SnapshotKind` 블록은 HEAD 와 diff 0. 기존 enum 값 추가 0. `VocabAttempt.exampleSnap`·`exampleKoSnap`·`TtsQualityRun` 등 3표·단어 은행·T6 칸 0.
- `enum ChallengeStatus` + `model Challenge` 를 `challenge.md` §3-2 코드 블록과 **주석 제거·공백 정규화 후 대조: 27줄 = 27줄, diff 0**(필드명·타입·`@db`·`@unique`·인덱스 2·관계·`onDelete` 동일). 차이는 주석 문구뿐(dev 기록과 일치). `VocabSession.topicId`·`topic`·`@@index([userId, topicId, date])`·`VocabAttempt.refType VarChar(30)`·`refId VarChar(40)` 도 §3-2 와 동일. `VocabSession` 의 `date` 칸은 `@db.Date` 로 실재(894행).

### 2. 직접 `migrate diff` 재실행 [확인]
- 명령(미러 `~/.node-local/thekaiwa-p2db`, 먼저 `KAIWA_LOCAL_ROOT=… sync-local.sh` 로 NFS→미러 동기화 후 NFS·미러 `schema.prisma` 동일 확인): `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`. 방향 = DB 현재 상태 → 스키마 파일. exit 0, 출력 55줄, stderr 는 `package.json#prisma` 폐기 경고뿐, URL·비밀번호 문자열 0.
- **dev 가 scratchpad 에 남긴 `p2db-migrate-diff.sql` 과 바이트 단위 동일**(sha256 앞 16자 66c04634550da524 둘 다). 문장 수 **9**(ALTER ADD COLUMN 4 · CREATE TABLE 1 · CREATE INDEX 1 · ADD CONSTRAINT 3) — dev 표 1~9 와 순서·내용 일치.
- 파괴적 문장 grep(삭제·타입 변경·이름 변경·`Warnings`·`data loss` 키워드) **0줄**. 기존 표에 대한 `NOT NULL` 추가 0(새 칸 전부 `NULL`). 새 표 `Challenge` 의 `dailyGoal JSON NOT NULL` 은 새 표라 무관. 옛 인덱스 삭제·다른 task 드리프트 0 → DB 의 현재 스키마 = HEAD 스키마(드리프트 0).
- 읽기 전용 조회로 DB 에 아직 DB0 산출물이 없음을 확인: `Challenge` 표 0건, 새 칸 7곳 전부 없음, QA 계정 3·4 행 없음(dev 의 "DB 쓰기 0" 기록과 일치). 대상 표 전부 InnoDB·`utf8mb4_unicode_ci`, `User.id`·`ConversationTopic.id` = `varchar(191)` `utf8mb4_unicode_ci` → 새 FK 칸과 짝이 맞음(FK 오류 1215 위험 없음). MariaDB 10.11.11. 행 수 VocabSession 6·VocabAttempt 50·EMD 0·Correction 7.
- `JSON` 은 MariaDB 에서 `longtext` + `json_valid` CHECK 별칭 — 기존 `ConversationTopic.tags`·`StudyPlan.curriculum` 과 같은 형태임을 `information_schema` 로 확인(`byVoice`·`dailyGoal`·`result` 도 동일).
- FK 뒷받침 인덱스: `VocabSession(userId, topicId, date)` 는 topicId 가 맨 앞이 아니라 InnoDB 가 `VocabSession_topicId_fkey` 를 따로 만든다. 같은 모양인 `Lesson.topicId`(`Lesson_topicId_fkey` + `Lesson_userId_topicId_idx`)가 이미 있고 이번 diff 에 `Lesson` 인덱스 삭제 문장이 없으므로 push 뒤 드리프트로 잡히지 않는다.

### 3. 스키마 품질 [확인]
`Challenge`: `activeKey String? @unique VarChar(40)` → `Challenge_activeKey_key`(InnoDB 유니크는 NULL 다중 허용 — 설계 의도), 인덱스 `(userId,status,startDate)`·`(userId,endedAt)` 가 `userId` FK 를 맨 앞으로 덮고 `topicId` FK 는 InnoDB 자동 인덱스, `User` Cascade·`ConversationTopic` SetNull, `startDate`·`endDate` `@db.Date`(기존 `VocabSession.date` 와 같은 규약). `@@map`·`@map` 0건인 저장소 규약과 일치. `refType VarChar(30)`·`refId VarChar(40)` = `RepetitionItem.refType/refId`(1113-1114행)와 같은 길이, `repetitionRefId()`(`repetition/index.ts:87`)는 sha1 hex **정확히 40자**(접두 없음), `TopicChunk.id` 는 cuid 25자라 둘 다 들어간다. EMD 6칸: `Int?` 3·`Float?` 2(DOUBLE)·`Json?` 1 — MariaDB 매핑 적정, 기존 `@@unique([connectionId,date])` 무변경. `ChallengeStatus` 는 `Challenge.status` 에서만 사용(grep). 역방향 3개(`User.challenges`·`ConversationTopic.{challenges,vocabSessions}`)는 각 모델 쌍에 관계가 하나뿐이라 이름 충돌·의미 겹침 없음(`prisma validate` 통과 + 직접 확인).

### 4. 운영 공존 판정: **안전** [확인]
- **같은 DB 확인**: dev `.env` 와 운영 `shared/.env` 의 `DATABASE_URL` 에서 접속 정보·옵션을 뺀 host/port/db 부분의 해시가 일치(값 비출력) → 이 push 는 곧 운영 DB 변경이다. 운영 `APP_ENV=PRODUCTION`.
- 옛 코드는 새 칸을 읽거나 쓰지 않는다: `VocabSession`·`VocabAttempt`·`Correction` 의 조회·생성·갱신(`src/` 비테스트 전수 grep)이 전부 명시 `select`(`SESSION_SELECT`·`ATTEMPT_SELECT`·`CORRECTION_SELECT` 는 칸 나열)·명시 `data` 이고, 이 표들에 대한 raw SQL 에 `SELECT *` 0건(`FOR UPDATE` 는 `id` 만). → 새 칸이 응답에 새거나 직렬화가 깨질 곳 0. 새 칸은 전부 nullable 이라 옛 코드의 `create` 는 NULL 로 들어간다. `EngineMetricsDaily` 는 `src`·`scripts`·`prisma/seed*` 어디에서도 참조 0건(코드 소비자 없음). 새 표·새 enum 은 옛 코드가 모른다. `JlptLevel` 은 컬럼 ENUM 이 표마다 따로라 `Challenge.level` 이 다른 표에 영향 없음.
- 삭제 경로: 사용자 삭제·주제 삭제·조각 삭제·행 삭제 SQL·사용자 데이터 내보내기 열거 코드 **0건**(`src`·`scripts`·`tests/live` grep) → Cascade·SetNull 이 실제로 실행될 코드 경로가 현재 없다(DB 수준 규칙만 존재). 계정 삭제 시에만 `Challenge` Cascade.
- 롤백/재배포: 옛 릴리스로 `--rollback` 해도 추가 칸은 남아 무해(옛 코드가 select 로만 접근).

### 5. 스캐폴딩·QA 계정 [확인]
- `challenges/index.ts`·`scenarios/index.ts` 는 주석 + `export {}` 뿐 — import 0이라 순환 위험 0. 같은 이름의 `challenges.ts`·`scenarios.ts` 형제 파일 없음(디렉터리 해석 모호성 없음). ESLint 경계(`eslint.config.mjs:105` `learning/**`)는 eslint 0 으로 통과. `learning/index.ts` 끝 3줄(구분 주석 + `export *` 2)은 기존 명시 export 뒤에 있고 같은 barrel 이 이미 `export * from './lessons'`(40행)·`'./evaluation'`(51행)을 쓴다. → L-1 참고.
- `qa-session.ts`: 계정 `'3'` `qa-bot3@thekaiwa.test`·`'4'` `qa-bot4@thekaiwa.test`, provider `test`·role USER, 기존 `upsert`·역할/공급자 검증·`APP_ENV=PRODUCTION` 거부 그대로. `ACCOUNTS` 는 모듈 비공개 상수로 다른 파일이 import 하지 않으며(스모크는 전부 `tsx qa-session.ts` 스크립트 호출), 계정 개수·이름에 의존하는 스모크 없음(grep). 비밀 하드코딩 0(`JWT_SECRET` 은 env). `infra/users.ts:22` `QA_USER_WHERE`(provider test + `@thekaiwa.test`)에 새 계정이 자동 포함되고 `listQaUserIds` 의 `take: 50` 여유 충분.

### 6. DB 쓰기 없음 확인 [확인]
위 2절 읽기 전용 조회 결과(Challenge 표·새 칸·QA 계정 3·4 부재) + `git status` 상 스키마 외 DB 산출물 없음(`prisma/migrations` 디렉터리도 없음 — `db push` 전용 규약 유지) + dev 기록의 "db push·행 생성 0" 과 일치. `scripts/sync-local.sh` 의 `KAIWA_LOCAL_ROOT` 변경(미커밋)은 21:27 Leader 작업(phase2-batch-plan 127행 기재)이지 dev-p2-schema 의 변경이 아님.

### 7. 재실행 숫자 (전용 미러 `thekaiwa-p2db` 에서만)
`prisma validate` 통과 · `prisma generate` 통과(v6.19.3, 이 미러 `.prisma` inode 가 메인 미러와 다름 — 메인 미러 생성물에 `model Challenge` 0 유지) · `tsc --noEmit` **0 오류**(증분) · `tsc --noEmit --incremental false` **0 오류**(12.5s) · eslint(변경 4파일) **0** · `src/modules/conversation` + `src/modules/learning` 단위 테스트 37파일 **624/624 pass, fail 0, cancelled 0, skipped 0**(12.8s) — dev 기록과 일치. 테스트는 가짜 tx/db 로 동작(직접 `prisma.` 호출 0, `task037` 은 `recordTrace` 를 가로챔)해 DB 를 쓰지 않는다. 미러 sync 가 다른 WP 의 진행 중 파일(예: `prompts/topicWords.ts`)도 가져오지만 tsc·테스트에 영향 없었다.

### 지적 표
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L-1 | LOW | `src/modules/learning/index.ts:59-60` · 이력서 "tsc 가 잡는다" | 절반만 맞다. 두 `export *` 끼리 이름이 겹치면 TS2308 이지만, 같은 barrel 의 **명시** `export { … } from`(41~57행 형태)과 겹치면 명시 쪽이 **조용히 이긴다**(ES 규칙, 컴파일 오류 없음) [확실 — 언어 규칙, 이번에 재현 테스트는 안 함]. 지금은 learning 하위에 Scenario·Challenge 이름의 export 0건이라 무해하고 `export *` 패턴 자체는 기존(40·51행)과 일관. | 041·010d 리뷰에서 새 export 이름을 barrel 의 명시 export 이름과 grep 대조(특히 010d `scenarios`). 비차단. |
| L-2 | LOW | `prisma/schema.prisma:7`(머리말 "정본 → 이 파일 순서") · `Challenge.result` 주석("JSON 모양은 정본 domain-model §9-3") | `docs/design/domain-model.md` 에 `Challenge`·`ChallengeStatus`·`VocabSession.topicId`·`VocabAttempt.refType/refId`·EMD 6칸이 0건(grep) — 스키마 쪽이 먼저 나가고 §9-3 참조가 빈 곳을 가리킨다. 갱신 담당은 이미 지정됨(`challenge.md` §11-3 = T1·T2, EMD = 012b-3 이력서 62행 Leader). | push 와 같은 날 `domain-model.md` §9 에 "승격됨(2026-10-06) — 정의는 `challenge.md` §3-2·`16` §7.3" 포인터 1줄(Leader). 비차단. |
| L-3 | LOW(Leader 결정) | `docs/design/domain-model.md:2724` ↔ `16-tts-productization-layer.md` §7.3·승인 표 F | EMD 확장이 정본 §10 은 **8칸**(`queueDelayMs`·`modelLoadMs` 포함), 16 §7.3·승인·012b-3 이력서·스키마는 **6칸**. 6칸만 넣은 dev 판단은 맞다(승인 목록). 다만 16 §7.3 대시보드가 "Model Load Time"을 보이고 과거 구간은 EMD 에서 읽는다고 적어, 012c-3 이 과거 구간 모델 로드·큐 지연을 보이려면 **두 번째 push 가 필요**해질 수 있다 [추측 — 012c-3 범위 미확정]. | push 전에 사용자에게 `Int?` 2칸 추가 승인 여부를 한 번 묻는다(추가·nullable·위험 0). 안 묻는다면 `domain-model.md:2724` 를 6칸으로 정정하고 2칸은 "추가 승인 필요"로 표시. |
| I-1 | INFO | `Challenge.activeKey VarChar(40)` | `userId` 를 담는다. 실제 id 는 전부 cuid(25자)라 맞지만 DB 가 `User.id`(191)와 길이를 맞추진 않는다. 설계서 그대로·`AiJob.refId` 선례. | 조치 없음. |
| I-2 | INFO | `VocabSession.topicId` SetNull | 주제가 지워지면 주제 세트가 "내 단어장 세트"로 읽힌다. 현재 주제 삭제 경로 0 → 도달 불가. | #57 구현 task 에서 이 의미를 확인. |
| I-3 | INFO | `prisma format` | HEAD 파일이 비포맷이라 적용하면 기존 약 100줄 공백이 바뀐다는 dev 설명은 직접 재현하지 않았다(추가만·삭제 0 은 직접 확인). 미적용 판단은 승인 범위 보존상 옳다. | push 경로에서 `prisma format` 금지. |
| I-4 | INFO | DB 계정 권한 | `INNODB_TRX` 조회가 1227(PROCESS 권한 없음)로 거부 — push 전에 다른 세션의 장시간 트랜잭션을 볼 수 없다. 대상 표가 ≤50행이라 ALTER 는 즉시 끝나는 크기. | 메타데이터 잠금 대기가 길어지면 중단 후 재시도(push 는 diff 를 다시 계산하므로 멱등). |
| I-5 | INFO | 메인 미러 `.prisma/client/schema.prisma` | 다른 미러와 하드링크로 공유(nlink 3, `thekaiwa-dev-030` 확인). push 뒤 메인 미러에서 generate 하면 공유 inode 에 영향 가능 [추측 — generate 의 쓰기 방식 미확인]. 추가 스키마라 해롭지 않음. | 인지만. 미러마다 generate 필요. |

### 7영역 점검 요약
| 영역 | 결과 |
|---|---|
| 아키텍처 | 6층 위반 0(빈 모듈 import 0·eslint 0), 새 표는 L3 `learning/challenges` 소유, API 변경 0 |
| 유지보수성 | `Challenge` 정본 대조 diff 0, 명명 규약 일치, 하드코딩 0 |
| 안정성 | 잡 상태·트랜잭션 변경 0. DDL 은 비트랜잭션이라 중간 실패 시 push 재실행으로 수렴 |
| 운영성 | 설정 엔티티 아님(ConfigurationVersion·AuditLog 대상 아님). 백업·롤백은 아래 체크리스트 |
| 성능 | 새 인덱스 3(Challenge 2 + VocabSession 1), 조회 경로 변경 0 |
| 보안 | Secret 하드코딩 0, URL 출력 0, QA 계정은 `QA_USER_WHERE` 규칙·PRODUCTION 거부 유지 |
| 학습 원칙 | AI 산출 저장 경로·`Correction.original`·`StatsSnapshot` 무변경, 새 enum 은 `Challenge.status` 전용 |

### Leader push 직전 체크리스트 (`prisma db push` — git push 가 아니다)
1. **고정 확인**: 위 sha256 5개와 `git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 이 그대로인지. 다르면 그 파일만이라도 재감사(스키마 diff 필수).
2. **백업**(task-018 방식): `mysqldump --single-transaction --routines --triggers --hex-blob` → `files/thekaiwa/backups/thekaiwa-<ts>-pre-p2db.sql.gz`(600, "Dump completed", 접속 정보 비출력, 옵션 파일 즉시 삭제). 복원은 공유 DB 전체 되돌림이라 1순위는 새 칸·표만 되돌리는 역순 정리(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸).
3. **push 직전 `migrate diff` 재실행**(위 명령, 먼저 sync): 같은 **9문장**·`Warnings` 없음·sha 동일. 다르면 push 중단. 기대 SQL 은 scratchpad `rev118-diff.sql` = dev 의 `p2db-migrate-diff.sql` (sha256 앞 16자 66c04634550da524).
4. **push**: 전용 미러에서 `prisma db push --skip-generate`, **`--accept-data-loss` 금지**(경고가 나오면 중단). 출력은 파일로 받아 URL·비밀번호 문자열이 없는지 확인한 뒤 요약만 기록. 실행 시각을 이력서에 남긴다.
5. **push 직후**: `migrate diff` 재실행 → 빈 결과("empty migration")로 드리프트 0 확인 · `information_schema` 로 `Challenge` 표(16칸)·FK 3·인덱스 확인 · 운영 `GET /api/health` ok(boolean)와 pm2 로그에 Prisma 오류 0(1~2분). 운영 pm2 재시작은 불필요(추가만·옛 코드는 select 로만 접근).
6. **generate**: 전용 미러는 완료. 메인 `thekaiwa`·WP 미러들은 각자 `prisma generate`(I-5).
7. **QA 계정**: 3·4 행은 dev QA 가 처음 `QA_ACCOUNT=3` 또는 `4` 로 실행할 때 upsert 로 생긴다(APP_ENV 가 PRODUCTION 이 아닌 환경에서만).
8. **git**: DB push 뒤에도 `git push` 금지(webhook 운영 배포 — 사용자 "전부 끝난 뒤 한 번"). 커밋은 pathspec 으로 이 5개 파일만(작업 트리에 다른 WP 미커밋 약 35개 — `git add -A` 금지). `Correction.extraNoteKo` 는 039 이력서에도 "DB0 통합 push 로 반영됨" 한 줄 교차 기록.
9. **기록·문서**: 이 이력서 frontmatter `status: todo` 갱신, 백업 파일명·push 시각·push 후 diff 결과 기록, L-2·L-3 처리.

### QA 에 넘길 high_risk_areas (push 뒤 라이브 확인)
① push 직후 운영 옛 릴리스 정상(운영 QA 토큰은 거부되므로 `/api/health` + 로그 관찰) ② `activeKey` 유니크: NULL 다수 허용·같은 값 중복 거부를 041 라이브에서 실제 INSERT 2건으로 확인(설계상 InnoDB 동작 — 이번 감사에서 실행은 안 함) ③ QA 계정 3·4 첫 upsert 후 `listQaUserIds` 포함 ④ `native_change: false`.

```json
{ "reviewId": "REV-118", "status": "PASS_WITH_NOTES", "issues": [
  { "issue": "barrel export * 이름 충돌 주장 부정확(명시 export 가 조용히 우선)", "severity": "LOW", "component": "src/modules/learning/index.ts:59-60", "risk": "향후 041·010d 가 같은 이름을 export 하면 한쪽이 가려짐", "evidence": "ES 규칙; learning 하위 Scenario·Challenge export 0건(grep)", "recommendation": "리뷰 때 이름 대조" },
  { "issue": "정본 domain-model.md 에 승격 항목 없음·머리말 순서 불일치", "severity": "LOW", "component": "prisma/schema.prisma:7", "risk": "정본-구현 드리프트 기간", "evidence": "grep 0건; 갱신 담당 지정됨(challenge.md §11-3·012b-3 62행)", "recommendation": "push 와 같은 날 포인터 1줄" },
  { "issue": "EMD 확장 정본 8칸 vs 승인·구현 6칸 — 012c-3 이 2칸 추가 push 를 요구할 수 있음", "severity": "LOW", "component": "docs/design/domain-model.md:2724", "risk": "Phase 2 단일 push 약속 깨짐", "evidence": "16 §7.3 대시보드 Model Load Time·과거는 EMD", "recommendation": "push 전 사용자에게 2칸 추가 승인 여부 질문 또는 문서 6칸 정정" } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 3 },
  "high_risk_areas": ["push 직후 운영 옛 릴리스 정상(health·로그)", "activeKey 유니크 NULL 다수 허용/중복 거부 실측(041)", "QA 계정 3·4 첫 upsert"], "native_change": false }
```

## Leader 기록 (DB0 통합 `db push` 완료, 2026-10-06 22:17)

- **사용자 승인**: AskUserQuestion 2026-10-06 "DB 구조 변경 전부 승인". Reviewer REV-118 PASS_WITH_NOTES(승인 목록 9문장 1:1 일치·승인 밖 0·운영 공존 안전).
- **실행 순서(체크리스트 1~6 준수)**: ① 감사한 5파일 sha256 앞 16자·`git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 그대로 확인 ② **백업** `files/thekaiwa/backups/thekaiwa-20261006-221627-pre-p2db.sql.gz`(600, 227,836 B, "Dump completed on 2026-10-06 22:16:31", 53개 표) ③ **`migrate diff` 재실행**(`--from-schema-datasource` → 파일): 9문장·sha256 앞 16자 `66c04634550da524`(검토본과 동일)·삭제/경고/이름 변경 0 ④ **`prisma db push --skip-generate`**(`--accept-data-loss` 없음) 22:17:00~22:17:42 rc=0 "Your database is now in sync" ⑤ **검증**: `migrate diff` 재실행 = "This is an empty migration"(드리프트 0) · `information_schema`: `Challenge` 16칸·FK 2(`userId`·`topicId`)·인덱스 `activeKey` 유니크 + `(userId,status,startDate)` + `(userId,endedAt)` · 새 칸 10개 존재(`Correction.extraNoteKo`·`EngineMetricsDaily` 6·`VocabAttempt.refType/refId`·`VocabSession.topicId`) · 행 수 Correction 7·VocabSession 6·Challenge 0 · 운영 `/api/health` success·`status:ok`·`degraded:[]` · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online restarts 0(로그의 Prisma 오류 줄은 10-06 00:17 의 기존 `[jobs]` 줄 — push 와 무관) ⑥ 메인 미러 `prisma generate` 완료.
- **SQL 소속 task**: `Correction.extraNoteKo` = task-039 · `EngineMetricsDaily` 6칸 = task-012b-3 · `VocabAttempt.refType/refId`·`VocabSession.topicId`(+인덱스·FK) = task-042 · `Challenge` 표(유니크 1·인덱스 2·FK 2) = task-041. 이 push 로 **네 task 의 DB 선행이 충족**됐다(운영 코드는 추가분을 select 하지 않으므로 영향 없음).
- 복구 1순위: 새 칸·표만 역순으로 되돌리기(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸). 백업 전체 복원은 공유 DB 전체 되돌림이라 최후 수단.
- 이후: `git push` 는 사용자 지시대로 **전부 끝난 뒤 한 번** — 커밋은 pathspec(`git add -A` 금지).
