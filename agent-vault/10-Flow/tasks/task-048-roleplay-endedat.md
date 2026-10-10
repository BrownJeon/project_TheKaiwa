---
task_id: task-048
title: "역할극 끝냄 표식 — 사용자가 마치기로 끝낸 역할극에 Chat.endedAt 저장 (DB 승인 2026-10-10)"
status: done
base_ref: 6e97554
risk_level: "R2"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-010d-scenario-roleplay, task-p2-db0-schema, task-049-topic-word-examples]
imp: [IMP-0017, IMP-0021]
tags:
  - type/task
  - domain/scenario
  - domain/db
aliases:
  - 역할극 endedAt
  - task-048
created: 2026-10-10
updated: 2026-10-10
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

# task-048 — 역할극 끝냄 표식 `Chat.endedAt`

## 사용자 요청 (원문)
- 2026-10-10 「DB 승인 대기 미구현 5건」 결정(C안) 1번: 「역할극을 끝내는 건 사용자가 끝낸것에 대해서 끝냄처리를 하도록 해줘.」 → 결정 기록 [[db-approval-decisions-2026-10-10]].
- 2026-10-10: 「지금 작업에 대해서 완료되면 알려주고 다음 작업 이어서 진행할 수 있도록 해줘」 → 사용자 입력이 필요한 지점(운영 배포 확인) 전까지 Leader 가 이어서 진행.

## 관련 과거 이력 요약 (Leader 큐레이션)
- [[task-010d-scenario-roleplay]] REV-140 의 Codex C2(concurrency) 지적: 「이미 끝낸 역할극인가」를 학습 관측 기록(`LearningObservation`)의 시간 창(`Chat.createdAt − 여유 ≤ occurredAt`)으로 찾아서, 시계 어긋남이면 이미 끝낸 대화를 못 찾아 **중복 기록 + `ROLEPLAY_ENDED` 우회**가 가능했다. 임시안 C+D(관측 `occurredAt: now` 명시 · 여유 1일→7일)가 **이미 운영 반영**(2026-10-07). 권고 1안 **F = `Chat.endedAt DateTime?`**(시계·창 무관, 사용자→Chat 잠금 행에 표식 → 확인·기록이 같은 tx, 추가 쿼리 0, 선례 `Chat.reviewedAt`)가 이번에 사용자 승인.
- 문서가 F를 「지금이 가장 싸다(운영에 끝난 역할극 0건이라 백필 불필요)」고 했던 전제는 **10월 7일 운영 개방으로 사라졌다** — 이미 끝난 역할극 행이 있을 수 있어 **백필(보정 스크립트)이 필요**하다.
- 승인된 교훈(`/이슈기록 관련 db scenario`): 없음. 공유 NAS DB 규칙: 사전 백업 → `migrate diff` 확인 → `db push` 한 번(task-045 선례), 승인 칸 외 변경 금지.

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 복잡도 2.60 · R2 · developer=**opus** · **track=standard**(`risk_r2`·`r2_path`·`complexity`) · demo=**none**(화면 변경 없음) · roles=developer, reviewer, qa(+designer?·PE? 는 불필요로 판단). 결과 JSON scratchpad `intake-t048.result.json`.

## 설계 (010d F안 그대로 — developer 는 먼저 코드를 읽고 어긋나면 보고)
1. **스키마**: `Chat.endedAt DateTime?` 추가 1칸(nullable·additive, 기본값 없음). 스키마는 [[task-049-topic-word-examples]] 의 `VocabAttempt.exampleSnap`·`exampleKoSnap` 와 함께 **단일 작성자가 한 번에** 쓴다(Leader 가 백업 → `migrate diff` → `db push` 1회).
2. **쓰기**: conversation 의 역할극 종료 흐름(`finishRolePlay`)에서 `endRolePlay`(learning `scenarios/end.ts`) 성공 뒤 **같은 트랜잭션**에서 `Chat.endedAt = now`(`Chat` 은 L2 소유 — 6층 유지). **사용자가 [마치기]로 끝낸 경우에만** 쓴다(다른 경로로 닫히는 역할극이 있으면 그 사실을 보고).
3. **읽기**: 턴 수락(`acceptTurnTx`)·종료 tx1·tx2·결과 읽기(`readScenarioRolePlayResult`)·카탈로그 `inProgress`·`listOpenRolePlayChats` 가 **잠근 Chat 행의 `endedAt` 을 먼저** 본다(`endedAt:null` 로 직접 거름). 관측 기반 판정은 **2차 방어로 그대로 둔다(OR)** — 백필 전·누락에 안전.
4. **응답 일관성**: 첫 종료 응답의 `endedAt` = 저장 값(= `now`), 재시도 응답(`replayed:true`)의 `endedAt` 도 같은 값.
5. **백필 스크립트** `scripts/backfill-roleplay-endedat.ts`: 역할극 Chat(`kind=TALK`·`scenarioId` 있음·`endedAt` 이 NULL)에 대해 종료 관측 행의 `occurredAt` 으로 `endedAt` 채움. **기본 dry-run(건수·표본만 출력), `--apply` 일 때만 UPDATE**, 이미 값이 있는 행은 건드리지 않음(멱등), 한 번에 한 트랜잭션 배치. **실행은 코드 배포 직전 사용자 확인 뒤**(운영 DB 데이터 쓰기).
6. 정본: `docs/design/domain-model.md` Chat 한 줄 + 010d 종료 흐름 설명 갱신(Leader).

## 하지 않는 것
화면 모양·문구 변경, 사용자 UI 의 「끝냄」 새 표시, 다른 DB 변경, `Chat` 외 표 변경, 관측 기반 판정 제거.

## 완료 기준
- `Chat.endedAt` 이 스키마·DB 에 있고(승인 3칸 중 1칸), 사용자가 마치기로 끝낸 역할극에 값이 저장된다.
- **시계 어긋남 모의**(`createdAt = occurredAt + 2일` 같은 가짜 tx)에서도 턴 수락 409 `ROLEPLAY_ENDED`·두 번째 종료 `replayed:true`·기록 호출 0. 동시 종료 상태기계에서 첫·둘째 응답의 `endedAt` 동일. `endedAt` 이 NULL 인 옛 행은 관측 기반 판정으로 계속 동작.
- 단위 시험·tsc·eslint·build 통과, 변이 확인, Reviewer PASS, QA(QA4 역할극 레인 실흐름 — 시작→턴→마치기→재종료·재개 시도) PASS.
- 백필 dry-run 건수 보고. 운영 배포·백필 `--apply` 는 **사용자 확인 후**.

## 상태 로그
- [2026-10-10] Leader — 접수·judge·이 이력서 작성. 다음: 스키마 3칸 단일 작성(task-048·049 공용) → 백업·`migrate diff`·`db push` → 구현.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-10 10:17 |

## Developer 기록 (스키마 3칸)

- [10:25] developer(신규 소환, 스키마 단일 작성자) — task-048·049 공용 스키마 3칸을 `prisma/schema.prisma` 에 추가. **커밋·push·`prisma db push` 하지 않음**(Leader 가 백업 → `migrate diff` 확인 → push 1회). 이 블록은 두 이력서에 같은 내용으로 붙인다.

### 변경 (사용자 승인 2026-10-10 의 3칸만)

| # | 칸 | 소속 | 타입 | 위치 |
|---|---|---|---|---|
| 1 | `Chat.endedAt` | task-048 | `DateTime?` (nullable·기본값 없음) | `Chat.reviewedAt` 바로 뒤 |
| 2 | `VocabAttempt.exampleSnap` | task-049 | `String? @db.Text` | `VocabAttempt` 스칼라 블록 뒤, 관계(`session`) 앞 |
| 3 | `VocabAttempt.exampleKoSnap` | task-049 | `String? @db.Text` | 2번 바로 아래 |

- 3번 타입 근거: `WordEntry.example`(`String? @db.Text`)·`WordEntry.exampleKo`(`String? @db.Text`) 를 직접 읽어 확인(schema 864~865행). 두 스냅샷 칸이 이 타입과 같다.
- `git diff --numstat -- prisma/schema.prisma` = `6 0`(추가 6줄·삭제 0). 6줄 = 칸 3줄 + 설명 주석 3줄(`///` 1줄씩). 승인 밖 변경 없음.
- **배치 결정(보고)**: `VocabAttempt` 는 HEAD 에서 `prisma format` 정규 상태다. `exampleKoSnap`(13자)이 기존 이름 열(`surfaceSnap` 11자 기준 폭 12)보다 길어, 기존 블록 안에 넣으면 블록 전체(약 16줄)가 재정렬되어 삭제 줄이 생긴다. 그래서 빈 줄로 분리한 **별도 정렬 그룹**(스칼라 블록 끝 `refId` 뒤)에 넣었다. 효과: ① 기존 줄 0글자 변경 ② `prisma format` 후에도 `VocabAttempt` 블록이 전후 동일(확인) ③ 새 3줄이 format 으로 바뀌지 않음(확인). 대신 「`meaningSnap` 바로 옆」이 아니라 같은 모델 스칼라 끝에 있다.
- **참고(이번 변경과 무관)**: HEAD `prisma/schema.prisma` 는 `prisma format` 기준 **이미 37구간이 비정규**다(`User`·`WordEntry`·`Chat`·1477행 이후 등). 이번 변경 후에도 37구간으로 같다(새 비정규 0). 그래서 파일 전체에 `prisma format` 을 적용하지 않았다(적용하면 무관한 수십 줄이 바뀐다). 정리는 별도 판단 사항.

### 검증 (미러 `~/.node-local/thekaiwa-db048`, `KAIWA_LOCAL_ROOT` 지정·`node_modules` 는 `thekaiwa-t047` 에서 `cp -al`)

- 미러 `prisma/schema.prisma` == NFS 파일(`cmp` 동일) 상태에서 실행.
- `prisma validate` → `The schema at prisma/schema.prisma is valid`.
- `prisma generate` → `Generated Prisma Client (v6.19.3)` 성공. 하드링크 공유 확인: 생성 후 링크 수 1(공유 아님), `thekaiwa-t047` 미러 클라이언트에는 새 칸이 없음(그쪽은 바뀌지 않음).
- `tsc --noEmit`(미러) → 오류 0건(약 15초). 새 칸을 쓰는 코드는 아직 없음.
- `prisma format`(미러 사본 한정): 새 3줄 변경 0, `VocabAttempt` 블록 전후 동일. `Chat` 블록의 다른 줄 정렬은 HEAD 에도 있던 비정규(`id`·`title`·`preview`·`messageCount`·`createdAt`·`updatedAt`)이며 내 `endedAt` 줄은 포함되지 않음.
- 보이지 않는 문자 검사 `git diff -- prisma | grep -nP '[\x{200B}-\x{200F}\x{2028}\x{2029}\x{FEFF}]'` → 0건.

### `prisma migrate diff` (읽기 전용 — DB 를 바꾸지 않는 명령)

`prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` (미러 `.env` 의 `DATABASE_URL` 은 값을 출력하지 않고 환경변수로만 전달, 종료 코드 0, stderr 없음). 출력 파일: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/db048-migrate.sql`

SQL 전문(193바이트):

```sql
-- AlterTable
ALTER TABLE `Chat` ADD COLUMN `endedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `VocabAttempt` ADD COLUMN `exampleKoSnap` TEXT NULL,
    ADD COLUMN `exampleSnap` TEXT NULL;
```

- 문장 수: `ALTER TABLE` 2문장 / `ADD COLUMN` 3개(`Chat.endedAt`·`VocabAttempt.exampleKoSnap`·`VocabAttempt.exampleSnap`) = 승인 3칸과 1:1. 옛 인덱스 삭제·드리프트·다른 표 변경 **없음**(DB 와 스키마가 이 3칸 외에는 일치).
- 세 칸 모두 nullable·기본값 없음이라 기존 행·구 코드에 영향 없는 additive 변경(구 코드는 새 칸을 SELECT 하지 않으므로 push 직후 구 코드도 동작 — Prisma 가 명시 칸만 읽는 것은 [가능성 높음], 이번에 구 코드 실측은 하지 않음).

### 인계

- 남은 일: Leader 가 NAS DB 백업 → 위 SQL 재확인 → `prisma db push` 1회. 그 뒤 task-048(`finishRolePlay` 쓰기·읽기 판정·백필 스크립트)·task-049(세트 생성 저장·복제 경로·응답 채움)의 서버 구현.
- 주의: 이 단계에서 `Chat.endedAt`·`exampleSnap`·`exampleKoSnap` 을 쓰거나 읽는 코드는 아직 없다. 구현 단계의 developer 는 `db push` 완료 뒤 미러에서 `prisma generate` 를 다시 돌려야 타입이 생긴다.
- 미커밋 파일: `prisma/schema.prisma`(+6줄). 미러 `~/.node-local/thekaiwa-db048` 는 임시(필요 없으면 정리 가능, 약 1GB 하드링크 사본).

## DB 적용 기록 (2026-10-10 10:2x KST, Leader) — task-048·049 공용 스키마 3칸
- 사용자 승인: [[db-approval-decisions-2026-10-10]] 1·2번. 단일 작성 diff = `Chat.endedAt DateTime?` · `VocabAttempt.exampleSnap Text?` · `VocabAttempt.exampleKoSnap Text?`(+6줄, 삭제 0), 승인 밖 변경 0.
- **백업** `files/thekaiwa/backups/thekaiwa-20261010-102226-pre-task048-049.sql.gz`(600, 320,799B, "Dump completed on 2026-10-10 10:22:33", CREATE TABLE 55). 복원(필요 시, 사용자 확인 후): `zcat <파일> | mysql --defaults-extra-file=<임시 600 옵션 파일> thekaiwa`.
- **적용 전 점검**: 스키마 NFS=미러(sha256 앞 16자 `f0aab06bc3403584`) · `migrate diff` 재실행 = 검토본과 바이트 동일(ALTER 2문장·ADD COLUMN 3개).
- **`prisma db push --skip-generate`** 1회: rc=0 「Your database is now in sync」 · 적용 후 `migrate diff` = 「empty migration」. 운영 헬스: `/api/health` 정상(구 코드는 새 nullable 칸을 읽지 않아 영향 없음).
- 다음: 구현 developer 는 미러에서 `prisma generate` 를 다시 돌려 새 칸 타입을 받는다.

## Developer 기록 (task-048 — 구현)

### 체크포인트 1 — B1 코드 읽기·계획 (2026-10-10, developer 신규 소환 opus)

**① 종료 기록을 쓰는 곳**

| 위치 | 내용 |
|---|---|
| `src/modules/conversation/chats/rolePlay.ts:494-546` `finishRolePlay` | 유일한 종료 진입점(라우트 `src/app/api/v1/chats/[id]/scenario/finish/route.ts:22`). tx1 `503-509`(사용자→Chat `FOR UPDATE` 재료·진행 중 턴·`deps.isEnded`·판정 대화) → 잠금 밖 판정 `518` → tx2 `519-527`(다시 잠금·재확인·`deps.endRolePlay` `524`·응답 `endedAt` `525`) |
| `src/modules/learning/scenarios/end.ts:152-290` `endScenarioRolePlay` | 호출자 tx 안에서 사용자 잠금 → 멱등 조회 `161-166`(`endedWhere`) → 반복 항목·StudyLog·DAILY → 끝낸 표식 관측 `244-272`(`occurredAt: now` 명시). `SCENARIO_COMPLETED` 관측을 쓰는 유일한 곳 |

**② 「끝났는가」를 읽는 곳**

| 위치 | 지금 판정 | 이번 변경 |
|---|---|---|
| `rolePlay.ts:327-364` `readRolePlayEndFacts`(원시 SELECT `330`) | Chat 잠금 행에서 `createdAt` 만 | SELECT 에 `endedAt` 추가 → `facts.chatEndedAt` |
| `rolePlay.ts:506` tx1 `deps.isEnded` | 관측 창 | `facts.chatEndedAt !== null` 먼저, NULL 이면 관측 |
| `rolePlay.ts:511` 재생 `deps.readResult` / `525` tx2 | 관측 `occurredAt` | 응답 `endedAt` = `Chat.endedAt` 우선, 관측 창 하한 = min(createdAt, endedAt) − 7일 |
| `rolePlay.ts:269-301` `rolePlayChatView`·`chatRolePlayView`(#29, select `297`) | 관측 | select 에 `endedAt`, 결과 `endedAt` 우선순위 같게 |
| `rolePlay.ts:562-571` `rolePlayListBadges`(#27, `chats/index.ts:132·145`) | 한 쪽 배치 관측 조회 1회 | `LIST_SELECT` 에 `endedAt` → 값 있는 행은 조회 없이 `ended:true`, NULL 행만 배치 조회(다 차 있으면 조회 0) |
| `rolePlay.ts:590-614` `listOpenRolePlayChats`(#161·#162, 라우트 `scenarios/route.ts:15·25`·`[id]/route.ts:15·23`·`[id]/fork/route.ts:27`) | 후보 → 카탈로그가 관측으로 거름 | `where.endedAt: null` 로 직접 거름 |
| `src/modules/learning/scenarios/catalog.ts:236-249` `inProgress` | `endedScenarioRolePlayChatIds`(관측) | 그대로(2차 방어 — 후보에 NULL 행만 남음) |
| `src/modules/conversation/orchestrator/index.ts:139-150` `acceptTurnTx`(SELECT `142`, 판정 `149`) | 관측 창 | SELECT 에 `endedAt`, 값 있으면 관측 조회 없이 409 `ROLEPLAY_ENDED` |
| `src/modules/conversation/chats/replyPractice.ts:62-64·80·144` `suggestReply`(#169) | 관측 | select 에 `endedAt`, 값 있으면 조회 없이 409 `ENDED` |
| `end.ts:50-53` `endedWhere`·`59-72` `endedScenarioRolePlayChatIds`·`127-130` `isScenarioRolePlayEnded`·`137-150` `readScenarioRolePlayResult` | `Chat.createdAt − 7일` 창 | `isScenarioRolePlayEnded`·배치 조회는 그대로(2차 방어). 멱등 조회·결과 읽기는 `chatEndedAt` 을 받으면 하한을 min(createdAt, endedAt) − 7일로(지금보다 좁아지지 않음) |

**③ [마치기] 밖에서 「끝남」이 되는 경로 — 없음 [확실]**: `SCENARIO_COMPLETED` 관측을 쓰는 곳은 `end.ts:244-271` 하나, 그 함수를 부르는 곳은 `rolePlay.ts:524` 하나, 그 함수를 부르는 곳은 finish 라우트 하나. 선생님 마무리(`endOfTopic`)는 메시지 `toolLog.meta` 표시일 뿐 종료를 기록하지 않는다(`rolePlay.ts:392` 는 판정 재료로만 읽음). 대화 지우기(`chats/index.ts:313` `deleteMany`)는 행 삭제, 상황 지우기는 `Chat.scenarioId` SetNull(일반 회화가 됨) — 둘 다 「끝남」이 아니다. 따라서 `endedAt` 은 [마치기] 경로(tx2) 하나에서만 쓴다.

**④ 6층**: learning `scenarios/*` 는 `Chat` 을 읽거나 쓰지 않는다(`.chat.` 0건 [확실]) — conversation 이 잠근 행에서 읽은 값을 입력으로 넘긴다. `Chat.endedAt` 쓰기는 L2 conversation `finishRolePlay` tx2 에서 `tx.chat.updateMany({ where: {id, userId, endedAt: null} })`(멱등, 선례 `review/index.ts:141` `reviewedAt`). learning 은 `chatEndedAt` 값을 창 하한·「쓰지 않음」 판단에만 쓴다(Chat 표 접근 0). 어긋남 없음.

**계획(쓰기 원칙)**: `Chat.endedAt` 이 정본, 관측은 2차 방어(OR). learning `endScenarioRolePlay` 는 `chatEndedAt` 이 있으면 **어떤 경우에도 쓰지 않는다**(관측을 찾으면 그 결과 재생, 못 찾으면 빈 재생) — 이중 방어. 옛 행(NULL)을 재생 때 채우는 「지연 백필」은 하지 않는다(읽기 경로에 쓰기가 생김 — 백필 스크립트가 맡음).

- 남은 일: B2~B5. 다음 첫 행동: 미러 `~/.node-local/thekaiwa-e048` 준비 → end.ts·rolePlay.ts 수정.
- 미커밋 파일: 없음(이 단계는 읽기만).

### 체크포인트 2 — B2·B3·B4 구현 + B5 시험 (2026-10-10)
- 완료: `learning/scenarios/end.ts`(`SCENARIO_END_MARK` 상수 · `scenarioEndLookupSince(createdAt, endedAt?)` = min − 7일 · `ScenarioEndInput.chatEndedAt` — 있으면 어떤 경우에도 쓰지 않음 · 결과 읽기 `chat.endedAt` 으로 창) · `scenarios/index.ts`(상수 export) · `conversation/chats/rolePlay.ts`(잠근 행 `endedAt` 읽기 `rawDateOrNull` · tx1 `chatEndedAt` 먼저 · tx2 처음 기록이면 `markRolePlayChatEnded`(`endedAt: null` 조건부) · 응답·#29 `endedAt` = `Chat.endedAt` 우선 · #27 뱃지 NULL 행만 배치 조회 · `listOpenRolePlayChats` `endedAt: null`) · `chats/index.ts`(`LIST_SELECT` 에 `endedAt` — 응답 모양 불변, `serializeChat` 이 칸을 고름) · `orchestrator/index.ts`(턴 SELECT `endedAt`, 있으면 관측 조회 없이 409) · `chats/replyPractice.ts`(#169 select `endedAt`, 있으면 관측 판정 없이 409 `ENDED`) · `scripts/backfill-roleplay-endedat.ts`(신규).
- 시험: 기존 3파일 갱신(`task010d`·`task010dA3b`(finishWorld 에 `chat.updateMany`·트랜잭션 직렬화·`isEnded` 횟수)·`task010dA3b2`(#169 어댑터 select)) + 신규 `task048.test.ts` + 학습 2파일에 1건씩. 역할극 관련 133/133 통과, tsc 0.
- 백필 dry-run(개발 미러, 공유 DB 읽기 전용): **대상 0건**(NULL 0·채움 0). 별도 읽기 전용 건수: 역할극 TALK 대화 0 · `scenarioId` 있는 대화 0 · 끝낸 표식 관측 0 · TALK 대화 1(내용 출력 없음).
- 남은 일: 변이 5건↑ · 정본 2곳 · 전체 시험·eslint·build · 이력서 마무리·일지.
- 다음 첫 행동: scratchpad 복사본에서 변이 실행.
- 주의: 공유 DB 에 지금 역할극 행이 0이라 백필은 현재 할 일이 없다(실기기 시험 대화가 지워졌거나 다른 DB — [추측]). `--apply` 는 실행하지 않음.
- 미커밋 파일: `src/modules/learning/scenarios/{end,index}.ts` · `src/modules/conversation/chats/{rolePlay,index,replyPractice}.ts` · `src/modules/conversation/orchestrator/index.ts` · `scripts/backfill-roleplay-endedat.ts` · 시험 `src/modules/conversation/__tests__/{task010d,task010dA3b,task010dA3b2,task048}.test.ts` · `src/modules/learning/__tests__/{task010d,task010dA3b}.test.ts`.

### 체크포인트 3 — 완료 보고 ([10:41], developer) · status 제안: Reviewer 인계

**변경 파일**(미커밋, 커밋·push·`db push` 하지 않음)
- 구현: `src/modules/learning/scenarios/end.ts` · `src/modules/learning/scenarios/index.ts` · `src/modules/conversation/chats/rolePlay.ts` · `src/modules/conversation/chats/index.ts`(`LIST_SELECT` 1줄) · `src/modules/conversation/chats/replyPractice.ts` · `src/modules/conversation/orchestrator/index.ts` · 신규 `scripts/backfill-roleplay-endedat.ts`
- 시험: `src/modules/conversation/__tests__/{task010d,task010dA3b,task010dA3b2}.test.ts`(갱신) · 신규 `task048.test.ts` · `src/modules/learning/__tests__/{task010d,task010dA3b}.test.ts`(1건씩 추가)
- 문서: `docs/design/domain-model.md`(Chat Prisma 블록·ER·소유 표 `endedAt`) · `docs/design/api-contract.md` #167 한 구절. ⚠ `domain-model.md` 에는 **이 task 전부터 있던 다른 미커밋 변경**(끝부분 EngineMetricsDaily 정정 2줄)이 함께 있다 — 경로 커밋 때 같이 들어간다.
- task-049 소유 파일(`prompts/topicWords.ts`·`tests/prompts/**`·`learning/vocab/**`·`topicWords.test.ts`)은 건드리지 않음.

**실행 증빙**(미러 `~/.node-local/thekaiwa-e048`, `KAIWA_LOCAL_ROOT` 지정 sync, `prisma generate` 로 새 칸 타입 받음)
- 역할극 관련 시험(`conversation/__tests__/task010d*·task048`·`learning/__tests__/task010d*`) 133/133 통과.
- 전체 `src/modules/conversation/**`·`src/modules/learning/**`·`src/app/**` 시험 89파일 **1340/1340 통과**(`--test-concurrency=1`, 가짜 `DATABASE_URL`). 이 실행에는 진행 중인 task-049 작업 트리(`topicWords.test.ts`)도 포함됐고 통과.
- `npx tsc --noEmit` rc=0 · 변경 13파일 `npx eslint` rc=0 · `./node_modules/.bin/next build` rc=0(로그의 "Error" 두 줄은 내가 손대지 않은 페르소나·spawn 코드 프레임 경고).
- 보이지 않는 문자 `git diff -- src scripts docs` 0건 · 신규 2파일 0건. 엔진명(reazon·whisper·style-bert·claude·sbv2) 추가 줄 0건.

**변이**(scratchpad `mut048/` 복사본 — src·scripts·prisma·tests·.claude 복사, node_modules 심볼릭 링크, 무변이 기준선 82/82 통과 확인 뒤 실행, 파일은 새 inode 로 바꿔 쓰고 되돌림, 끝에 `diff -rq` 동일): **15건 전부 검출**. M1 `endedAt` 쓰기 제거 · M2 재생 응답 우선순위 반전 · M3 tx1 판정 순서 반전 · M4 종료 관측 폴백 제거 · M5 턴 관측 폴백 제거 · M6 덮어쓰기 허용(`endedAt: null` 조건 제거) · M7 백필 dry-run 이 쓰기 · M8 턴 `endedAt` 확인 제거 · M9 learning 「표식 있으면 안 씀」 제거 · M10 창 하한이 `endedAt` 무시 · M11 진행 중 후보 거름 제거 · M12 #27 표식 행도 조회 · M13 #169 표식 확인 제거 · M14 tx2 응답 표식 무시 · M15 #29 우선순위 반전.

**백필 dry-run**(공유 DB 읽기 전용): 대상 **0건**(역할극 대화 NULL 0 · 채움 0 · 일치 0). 읽기 전용 건수 확인: `scenarioId` 있는 대화 0 · 끝낸 표식 관측 `SCENARIO_COMPLETED` 0 · TALK 대화 1. → 지금은 백필할 행이 없다. 다만 배포 전까지 사용자가 역할극을 마치면 생기므로 배포 직전에 dry-run 을 한 번 더 돌려 0 이 아니면 `--apply`(사용자 확인 뒤).

**추가 쿼리 증감**: 읽기 쿼리는 늘지 않는다 — 기존 SELECT 에 칸 1개만 더함. 표식이 있으면 줄어든다: 턴 수락 −1(관측 조회 생략) · 종료 재시도 tx1 −1 · #169 −1 · #27 한 쪽의 역할극 행이 모두 표식이면 −1 · 카탈로그 진행 중 후보가 모두 표식이면 −1. 늘어나는 것은 **처음 종료 1회의 `UPDATE Chat` 1문장**(표식 쓰기 자체). #29 는 결과 칸(판정·표현) 때문에 관측·기록 읽기가 그대로 필요해 증감 0.

**가이드와 달라진 점·결정**
1. `isScenarioRolePlayEnded`(관측 판정)는 바꾸지 않고 **호출하는 쪽(conversation)이 `endedAt` 을 먼저** 본다 — 관측 함수는 2차 방어 그대로.
2. learning `endScenarioRolePlay` 에 입력 `chatEndedAt` 을 더했다 — 있으면 **어떤 경우에도 쓰지 않음**(관측을 찾으면 그 결과, 못 찾으면 빈 재생). conversation tx2 는 이 값을 넘기고, 처음 기록일 때만 `markRolePlayChatEnded`(`updateMany where {id, userId, endedAt: null}`, 선례 `reviewedAt`). 6층 유지: learning 은 Chat 표에 접근하지 않는다.
3. 결과·멱등 조회의 관측 창 하한을 **min(`createdAt`, `endedAt`) − 7일**로 — 표식이 있으면 시계 어긋남이 커도 결과를 찾고, 지금보다 창이 좁아지지 않는다(`scenarioEndLookupSince` 둘째 인자, 생략 시 기존과 같음).
4. 응답 `endedAt` 은 `Chat.endedAt` 이 먼저, NULL 이면 관측 시각(옛 행). #29·재시도·동시 종료 모두 같은 규칙.
5. 옛 행(NULL)을 재생 때 채우는 「지연 백필」은 **하지 않음**(읽기 경로에 쓰기가 생긴다) — 백필 스크립트가 맡는다.
6. 백필은 같은 사용자의 표식 관측만, 시간 창 없이(시계 어긋남 행도), 가장 이른 `occurredAt`. 상수 `SCENARIO_END_MARK` 를 learning 에서 export 해 기록·조회·백필이 같은 조건을 쓴다.
7. 시험 인프라: `finishWorld` 가짜 트랜잭션을 직렬화(실제 사용자 행 잠금 흉내)하고 `chat.updateMany` 를 더했다 — 동시 종료 시험(Promise.all)용.

**알려진 한계**
- `Chat.endedAt` 은 있는데 관측이 없는 행(정상 경로로는 생기지 않음 — 같은 tx 에서 둘 다 쓰고, 백필은 관측에서만 채움): 턴·#169 는 409, 재종료는 쓰기 없이 빈 결과(`outcome NOT_YET`·0), #29 `ended` 는 null 로 보인다(화면은 열린 대화처럼 보이지만 말하면 409).
- 상황이 지워져 `scenarioId` 가 NULL 이 된 끝낸 대화는 예전처럼 일반 회화로 다룬다(턴 확인은 `scenarioId` 있을 때만 — 화면과 맞추려고 그대로 둠).
- 백필 스크립트는 대상 행의 `updatedAt` 도 바꾼다(Prisma `@updatedAt`) — #27 정렬은 `lastMessageAt` 이라 목록 순서 영향 없음 [가능성 높음].

**NOT_VERIFIED**: 실제 DB 에 `endedAt` 이 저장되는 라이브 흐름(dev 서버·라이브 호출 금지 — QA4 역할극 레인에서 확인 필요) · MariaDB `DATETIME(3)` 에서 `Chat.endedAt` 과 관측 `occurredAt` 이 같은 값으로 저장되는지(같은 JS `Date` 라 ms 까지 같을 것 — [가능성 높음]) · 백필 `--apply` 실제 실행(지시대로 안 함).

**Reviewer 에게**: ① tx2 의 `!r.replayed && facts.chatEndedAt === null` 조건과 learning 의 「표식 있으면 안 씀」이 이중으로 맞물리는지 ② `rawDateOrNull` 이 원시 쿼리 글 값·빈 값을 맞게 다루는지 ③ `listChats` 응답에 `endedAt` 이 새지 않는지(`serializeChat` 이 칸을 고름) ④ 백필의 사용자 일치 조건·멱등.
- native_change: false · 미커밋 파일: 위 「변경 파일」 전부.

## Reviewer 기록 (REV-176 — task-048 감사)

### REV-176 (2026-10-10 reviewer, 신규 소환 sonnet) — 역할극 끝냄 표식 `Chat.endedAt` (커밋 `ad39547`)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 5 · Info 3 · `native_change=false`. 코드 수정 0(Read 전용) — 변이·프로브는 scratchpad 사본(`snap048`·`mut048`)에서만. 영역 A~F 전부 검토. 서버·DB 쓰기·백필 스크립트 실행 0(`DATABASE_URL` 은 항상 무효 값).

**검증 환경**: `git archive ad39547` → scratchpad `snap048`(불변). `node_modules` 는 `thekaiwa-e048` 에서 `cp -al`, `.prisma` 는 독립 복사본으로 교체 후 스냅샷 안에서 `prisma generate`. `npm run build`·`sync-local` 안 씀.

| 항목 | dev 보고 | 이번 재현(스냅샷) |
|---|---|---|
| `src/modules/conversation/**`·`learning/**`·`src/app/**` 시험 | 89파일 1340/1340 | **89파일 1300/1300** (`--test-concurrency=1`) — 차이 40 = 커밋에 없는 task-049 작업 트리 시험(`topicWords.test.ts` 예문 28쌍·응답 8건 등)이라 [가능성 높음]. 보고와 모순 아님 |
| `tsc --noEmit` | rc 0 | **rc 0** |
| eslint(변경 src·scripts 13파일) | rc 0 | **rc 0** |
| `next build` | rc 0 | **rc 0** (경고 = 기존 페르소나 파일 추적 경고, 변경 파일 아님) |
| 보이지 않는 문자(`git diff 6e97554 ad39547`) | 0 | **0** |
| 엔진명·model_id·speaker_id(추가 줄) | 0 | **0** |
| `src/components`·`src/app` 변경(6e97554..ad39547) | finish 라우트 외 없음 | **0줄**(라우트도 안 건드림) · android·plugins·capacitor 변경 0 |

#### A. 정확성·동시성 — PASS_WITH_NOTES
- **① 이중 맞물림 [확인 — 코드 추적 + 변이]**: 학습이 쓰는 조건(`chatEndedAt` 비어 있고 관측 없음)과 conversation 이 표식을 쓰는 조건(`!r.replayed && facts.chatEndedAt === null`)은 정확히 같은 경우다 — learning 이 새로 쓰면 항상 `replayed:false`+표식 NULL → 표식도 쓴다. **둘 다 막혀 종료가 영영 기록되지 않는 상태 없음**(표식 있음→learning 이 재생·쓰기 0, 표식 NULL+관측 있음→재생이라 `replayed:true` 로 표식 안 씀=옛 행은 NULL 유지, 백필 몫). **둘 다 열려 중복 기록 없음**: 사용자 행 잠금(`lockUserRow`→`Chat FOR UPDATE`)이 두 종료를 직렬화하고, 둘째 tx2 는 잠금을 얻은 *뒤에* 읽으므로 첫째의 관측·`endedAt` 을 본다(InnoDB 잠금 읽기·반복 읽기 전제 — REV-140 이 같은 순서를 추적했고 이번에 락 순서·읽기 순서는 안 바뀜. 실 DB 경합은 가짜 직렬화 시험으로만 확인 [가능성 높음]). 종료×종료 → 응답 `endedAt` 동일(시험 ④), 응답 유실 뒤 재시도 → `replayed:true`+저장 값(시험 ①), 종료×턴 → 락 순서(user→Chat)가 `acceptTurnTx` 와 같아 사이클 없음(REV-140 추적 그대로, 새 락 없음 — `markRolePlayChatEnded` 는 이미 잠근 행의 `updateMany`).
- **③ 옛 행(NULL)**: 관측 기반 2차 방어가 그대로 동작 — `isScenarioRolePlayEnded`·`endedScenarioRolePlayChatIds` 본문 무변경, 호출 지점 전수(`orchestrator:151`·`rolePlay:431`·`replyPractice:82`·`rolePlay:595`·`catalog:239`) 확인, 시험 ③이 고정. 옛 행 재종료는 쓰기 0·표식 안 씀(읽기 경로 쓰기 없음).
- **⑤ 창 경계**: `scenarioEndLookupSince(createdAt, endedAt?)` = min−7일. 표식이 없거나 늦으면 기존과 같고(좁아지지 않음), 올바르지 않은 시각은 걸러 null(하한 없음 — 느리지만 정확). 시험이 +2일·+8일(7일 창 안·밖) 어긋남과 `new Date('nope')` 를 실제 값으로 쓴다.
- **⑥ 6층**: learning `scenarios/*` 의 `.chat.` 접근 0·conversation import 0, conversation 은 `@/modules/learning` 인덱스로만 `SCENARIO_END_MARK` 등을 가져옴, 순환 없음, 백필은 `@/modules/{learning,infra}` 인덱스만.
- **② `endedAt` 있음+관측 없음**: 정상 경로로는 못 만든다 [확인] — 쓰기는 같은 tx(`end.ts` `createMany` → `markRolePlayChatEnded`), 백필은 관측이 있는 행에서만 채움, 관측 삭제 경로 0(`learningObservation.delete*`·raw `DELETE` grep 0건, `User` cascade 만). → L-3.
- **④ 시각 파싱**: 실제 `$queryRaw` 가 주는 `Date` 는 안전(같은 JS `Date` 가 `endedAt`·`occurredAt` 둘에 `DATETIME(3)` 로 저장). 문자열 분기만 문제 → L-2.

#### B. API·노출 — PASS
`serializeChat` 은 필드를 골라 쓰는 구조 — 프로브(TZ=Asia/Seoul)에서 `endedAt`·`scenarioId` 가 있는 행을 넣어도 응답 키 11개(`id,kind,title,topic,level,lastMessageAt,preview,messageCount,reviewedAt,running,createdAt`)뿐. #27 은 `{...serializeChat, scenario:{id,ended}}` 로 `ended` 불리언만 노출(api-contract #167 구절과 일치 — 그 줄만 바뀜). 새 읽기 지점 전부 `userId` 조건: `readPracticeChat {id,userId}`·`chatRolePlayView`·`listOpenRolePlayChats {userId,…}`·`markRolePlayChatEnded {id,userId,endedAt:null}`·원시 SELECT 후 `chat.userId !== userId` → 404. 타인의 `endedAt` 읽기 경로 0.

#### C. 백필 스크립트 — PASS_WITH_NOTES (읽기만, 실행 안 함)
기본 dry-run(`apply:false` 면 `$transaction`·`updateMany` 호출 0 — 시험이 ops 로 확인), 인자는 `--apply` 뿐(오타 `--aply` 등은 exit 2, DB 접속 전). 대상 = `kind=TALK`·`scenarioId not null`·`endedAt null`, 관측 조건은 기록·조회와 같은 상수 `SCENARIO_END_MARK` 를 그대로 펼침(리터럴 중복 없음), 값 = 사용자·chat 이 일치하는 관측 중 가장 이른 `occurredAt`(결과 읽기가 고르는 행과 같음), 시간 창 없음(어긋난 행도 채움), UPDATE 는 `{id,userId,endedAt:null}` 조건 → 멱등·산 사용자 종료와 경합해도 같은 값(둘 다 `now`=`occurredAt`). 배치 100·배치마다 `$transaction`. 출력은 건수·chat id 5개·시각 범위·카운트뿐(대화·제목·이름·연결 문자열 없음, 오류는 이름·코드만). `scripts/sync-local.sh` 가 `scripts/*.ts` 를 미러에 동기화하므로 미러에서 `node --import tsx scripts/…` 로 실행 가능. `tsc`·`next build`·eslint 에 섞여도 깨지지 않음(전부 rc 0). → L-1, L-5.

#### D. 스키마·DB 승인 일치 — PASS
`git show ad39547 -- prisma/schema.prisma` = +6줄(Chat: 주석+`endedAt DateTime?`, VocabAttempt: 빈 줄+주석+`exampleSnap String? @db.Text`+`exampleKoSnap String? @db.Text`) — 결정 기록 승인 목록과 1:1, 기본값·인덱스·관계 추가 없음. src·scripts 에 `exampleSnap`·`exampleKoSnap` 사용 0(task-049 영역). **공유 DB 에 실제 칸이 있는지는 DB 에 접속하지 않아 확인 못 함 — Leader 의 적용 기록(`DB 적용 기록 10:2x`)을 신뢰**(NOT_VERIFIED).

#### E. 시험의 질 — PASS_WITH_NOTES
`task048.test.ts` 와 갱신 시험은 의미 있는 것을 고정한다 — 시계 어긋남 시험이 `createdAt = 표식 + 2일·8일` 실제 값을 쓰고 "관측 가짜는 못 찾음" 상태에서도 409/replayed 를 요구, 동시 종료는 사용자 행 잠금을 흉내 낸 직렬화 fake 위에서 `Promise.all`, 결과 `endedAt` 은 관측 시각(OBS_AT)과 저장 값(FINISH_NOW)이 달라 우선순위를 가른다. 시험은 DB 에 닿지 않음(무효 URL, 가짜 db). **변이 7건 직접 재현**(`mut048` 복사본, 파일마다 원본 복원, 끝에 `diff -rq` 동일 확인):

| 변이 | 결과 |
|---|---|
| A tx2 의 `markRolePlayChatEnded` 호출 제거 | KILLED(①·④) |
| B tx1 의 `chatEndedAt !== null ||` 제거 | KILLED(①·②) |
| C learning 「표식 있으면 안 씀」 제거 | KILLED(learning 시험 1건) |
| D 표식 쓰기의 `endedAt: null` 조건 제거(덮어쓰기 허용) | KILLED(①·④) |
| G #27 뱃지가 `endedAt` 무시 | KILLED |
| **E 백필 `owner.get(refId) !== o.userId` 검사 제거** | **SURVIVED** (6파일 전부 통과) |
| **F 백필 UPDATE where 에서 `userId` 제거** | **SURVIVED** (id 유일이라 동치에 가까움) |
→ L-1.

#### F. 범위·규칙 — PASS_WITH_NOTES
화면·문구·API 필드 변경 0, `@/modules/*` 규칙 준수(모듈 내부는 상대 import, 층 간은 인덱스), 엔진명 0, 보이지 않는 문자 0, native 0. 문서는 코드와 일치(Chat Prisma 블록·ER·소유 표·#167). → L-5.

#### 발견 이슈
| ID | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| L-1 | LOW | `scripts/backfill-roleplay-endedat.ts:67`, `task048.test.ts` 백필 fixture | **교차 사용자 방어 줄이 시험으로 고정되지 않음.** 변이 E 생존: fixture 의 모든 chat 이 U 소유라 쿼리 `userId in [U]` 가 OTHER 의 관측을 이미 걸러내 검사 줄이 한 번도 쓰이지 않는다. 운영 데이터를 쓰는 스크립트의 방어 심층이라 `--apply` 전에 고정 권고: 한 배치에 두 사용자의 chat 을 두고, 관측 `userId=U2`·`refId=U1 의 chat id` 인 불일치 행을 fake 가 돌려주게 해 채우지 않음을 확인. 변이 F 생존은 id 유일성 때문에 동치에 가까워 별도 조치 불필요. |
| L-2 | LOW | `rolePlay.ts:69-73` `rawDateOrNull` (같은 패턴: `createdAt` 문자 분기 `rolePlay.ts:~361`, `orchestrator:150`) | **문자열 분기가 서버 TZ 로 해석된다.** 프로브: `TZ=Asia/Seoul` 에서 `'2026-10-10 10:00:00.123'` → `01:00:00.123Z`(9시간 어긋남), `TZ=UTC` 에서만 정확. 실제 `$queryRaw` 는 `Date` 를 주므로 지금 경로엔 영향 없음 [가능성 높음 — 실DB 미확인]. 만약 문자로 오면 「끝남」 truthiness 는 맞지만 응답 `endedAt`·창 하한이 어긋남. 권고(2줄): tz 표지 없는 문자열은 `'Z'` 를 붙여 UTC 로 해석하거나 문자 분기를 없애 `Date` 만 신뢰. `rawDateOrNull` 단위 시험(빈 문자열·쓰레기·`Date`·tz 유무 문자) 추가. |
| L-3 | LOW | `end.ts:180` / `rolePlay.ts:529-549` | **`endedAt` 있음+관측 없음 상태의 증상**(dev 공개와 일치, 내가 재추적): 재종료 시 `replayed:true`·`outcome NOT_YET`·`turns 0` 의 빈 결과를 돌려주고(결과 화면이 비어 보임), #29 `ended:null`(열린 대화처럼 보이나 말하면 409), #27·카탈로그는 「끝남」. 정상 경로로는 못 만든다 [확실](위 ②). 수동 DB 편집이나 이후 정리 작업이 관측만 지우면 생긴다. 코드 변경 불필요 — 정본 문서(`domain-model.md` Chat 줄 또는 task 이력서)에 「관측 `SCENARIO_COMPLETED` 를 지우면 `Chat.endedAt` 도 함께」 한 줄 권고. |
| L-4 | LOW | 시험 공백 | #27/#28 응답에 `endedAt` 이 새지 않음을 고정하는 시험 없음(`listChats` 시험 파일 자체가 없음 — `serializeChat` 의 명시 필드 구조는 프로브로만 확인, 회귀 시 무검출), `readRolePlayEndFacts` 가 글로 온 `endedAt` 을 받는 경로 시험 없음(`acceptTx` 만). `serializeChat` 키 집합 단위 시험 1건 권고. |
| L-5 | LOW | 문서 | `docs/design/{domain-model,api-contract}.md` 변경은 `ad39547` 에 없고 작업 트리 미커밋이며, `domain-model.md` 에는 task-048 과 무관한 `EngineMetricsDaily` 정정 2줄이 같이 있다(dev 공개). 경로 커밋할 때 함께 들어가므로 Leader 가 의도 확인 후 커밋(필요 시 `git add -p`). |
| I-1 | INFO | 백필 운영 | 배치 단위 커밋이라 중간 실패 시 일부만 적용되고 실패 메시지에는 진행 수가 없다(이름·코드만) — 재실행이 멱등이라 안전, `before` 카운트로 확인. `updatedAt`(`@updatedAt`)이 같이 바뀌지만 `Chat.updatedAt` 소비자 0(grep). 개발·운영이 같은 DB 라 환경 가드가 없고 `--apply` 플래그가 유일한 보호 — 실행은 사용자 확인 뒤. |
| I-2 | INFO | 설계 | 지연 백필 없음·`scenarioId` SetNull 된 끝난 대화가 일반 회화로 열리는 동작은 기존과 같음(회귀 아님). |
| I-3 | INFO | 읽기 비용 | 읽기 쿼리는 늘지 않고 표식이 있으면 줄어듦(턴 −1, 재종료 tx1 −1, #169 −1, #27·카탈로그 조건부 −1). 늘어나는 것은 처음 종료 1회의 `UPDATE Chat` 1문장. `listOpenRolePlayChats` 의 `endedAt:null` 은 기존 `(userId, kind, lastMessageAt)` 인덱스를 그대로 쓰고 마친 대화가 후보 상한(`OPEN_ROLE_PLAY_MAX`)을 차지하지 않게 되어 오히려 이득. |

**권고 처리 순서(블로킹 아님)**: L-1·L-2·L-4 는 같은 파일 군의 작은 보강(시험 3건 + 2줄)이다. QA 와 병행하지 말고 *QA 로 가기 전에* 한 번에 처리하면 재순환이 한 번뿐이다. 건너뛰고 QA 로 가면 이후 수정이 생길 때 Reviewer 재순환에 포함된다. 어느 쪽이든 `--apply` 전에는 L-1 이 닫혀 있어야 한다(권고).

**QA 로 넘기는 `high_risk_areas`**(QA4 역할극 레인 — 공유 DB 에 역할극 데이터가 0건이라 *새로 만들어* 검증해야 함):
1. 실 DB 왕복: [마치기] 후 `Chat.endedAt` 이 저장되고 같은 대화 `LearningObservation(SCENARIO_COMPLETED).occurredAt` 과 **ms 까지 같은 값**(`DATETIME(3)`) · 응답 `endedAt` 도 같은 값(raw 읽기가 `Date` 를 주는지 포함 — L-2 의 전제).
2. 마친 뒤: 턴 409 `ROLEPLAY_ENDED`, #169 409 `ENDED`, 재마치기 `replayed:true`+같은 `endedAt`+기록 행 수 불변(StudyLog·RepetitionItem·관측·DAILY), 시작 카탈로그 `inProgress` 에서 빠짐, #27 뱃지 `ended:true`, #29 결과 화면.
3. **더블탭/동시 두 요청** [마치기]: 관측 1행·StudyLog 1행·`endedAt` 1값, 응답 둘의 `endedAt` 동일.
4. 옛 행(NULL) 2차 방어: 테스트 대화 1건의 `endedAt` 만 NULL 로 되돌려(QA 테스트 데이터 한정, DB 쓰기는 Leader 승인 범위 확인) 턴 409·#27 `ended:true`·재마치기 `replayed:true`·표식 미기록 확인.
5. 응답 JSON: #27 항목·#28 응답에 `endedAt` 키 없음, 다른 사용자 계정으로 타인 chat 마치기/턴/#169 → 404.
6. 백필: **QA 가 `--apply` 를 실행하지 않는다.** dry-run 은 읽기라 가능(`matched` 0, 새로 만든 행은 이미 채워져 `filled` 에 잡힘), 위 4번의 NULL 행으로 `matched 1` 확인까지.

**NOT_VERIFIED**: 공유 DB 에 칸 3개가 실제 존재(DB 접속 안 함 — Leader 적용 기록 신뢰) · 실 DB 에서 `Chat.endedAt`=`occurredAt` ms 일치와 raw 읽기 타입 · 백필 CLI 실제 실행(`.env` 로딩·`tsx`·`@/` 별칭 — 미러에서 dry-run 으로 확인 필요) · 실서버 락 경합(가짜 직렬화로만 검증) · blue/green 중 구·신 코드 혼재(구 코드는 새 칸을 읽지 않고 관측만 써서 신 코드가 NULL 로 읽고 2차 방어로 처리 — 코드로만 확인) · 화면(UI 변경 0이라 해당 없음).

**Sonnet 승격 권고 판단**: 해당 없음(이번 task 는 judge `developer_model=opus`, 반려 0회).

## Developer 기록 (REV-176 수정 — L-1·L-2·L-4)

### [10:55] developer 신규 소환(sonnet) — REV-176 L-1·L-2·L-4 처리 (커밋·push·db push 안 함, 미커밋)

**조치**
- **L-2 (동작 변경 — 이것 하나)**: `src/modules/conversation/chats/rolePlay.ts` — `parseRawDateTime(v)` 신설·export(시간대 표지 없는 `YYYY-MM-DD[ T]HH:mm[:ss[.fff]]` 글은 `…T…Z` 로 UTC 해석, 표지 있는 글·`Date` 는 그대로) → `rawDateOrNull` 이 이것을 씀. 같은 파일 `readRolePlayEndFacts` 의 `chatCreatedAt` 글 분기(리뷰의 「같은 패턴」)도 `parseRawDateTime` 로 바꿈(`Date`·표지 있는 글의 결과는 이전과 같음).
- **L-1 (시험)**: `task048.test.ts` 에 「백필 교차 사용자 방어」 — 한 배치에 U·OTHER 대화 4개, 관측 2개는 `userId` 와 `refId` 소유자가 어긋남(U 대화+OTHER 표식, OTHER 대화+U 표식). 가짜 조회가 어긋난 행을 포함해 4행을 돌려줬음을 `seen` 으로 확인(헛도는 시험 방지) → dry-run `matched 2`·범위에 어긋난 시각 제외, `--apply` 는 `updated 2`·어긋난 두 대화 NULL 유지. `backfillDb` 가짜에 `seen`(조회가 돌려준 행 수) 추가 — 기존 시험 영향 없음. 백필 스크립트는 **수정 안 함**.
- **L-4 (시험)**: ① `serializeChat`(#27 `listChats` 가 `{...serializeChat(c), ...(badge ? {scenario: badge}: {})}`, #28 `createChat` 이 `serializeChat(c,false)`)에 `endedAt`·`scenarioId` 가 있는 행을 넣어도 응답 키가 11개뿐·`endedAt` 값이 어떤 키로도 새지 않음, `createChat`(가짜 db)도 같음. #27 의 `scenario` 칸은 `{id, ended}` 뿐임을 기존 뱃지 시험(`deepEqual`)이 이미 고정. ② `rawDateOrNull`·`parseRawDateTime` 단위(Date·ISO Z·오프셋·tz 없는 글 3모양·공백·빈 값·null·undefined·쓰레기·Invalid Date). ③ 덤: `readRolePlayEndFacts` 가 글로 온 `endedAt`·`createdAt` 을 UTC 로 읽고 빈 값·칸 없음·쓰레기는 `chatEndedAt: null`(L-4 의 「`readRolePlayEndFacts` 글 경로 시험 없음」).

**L-2 근거(UTC 관례)**: ① Prisma 는 MySQL/MariaDB `DATETIME` 을 항상 UTC 로 저장·해석한다(Chat.endedAt·LearningObservation.occurredAt 둘 다 Prisma 가 쓴 값 → 같은 JS `Date` 를 UTC 로). ② 코드베이스 관례: `src/modules/infra/dates.ts:8-10` 머리말 — 「서버 로컬이 KST 라 로컬 자정을 넣으면 하루 어긋난다 → UTC 자정으로 읽고 쓴다」, `Date.UTC`·`getUTC*` 사용. ③ 서버는 `TZ=Asia/Seoul`(`date +%Z`=KST, `/etc/timezone`)이고 `ecosystem.config.js`·`.env.example` 에 `TZ` 지정 없음 → 표지 없는 글을 `new Date` 에 주면 KST 로 읽혀 9시간 어긋남(리뷰 프로브와 같음). 문자열 분기를 지우지 않은 이유: `ChatLockRow.endedAt`·`createdAt` 타입이 `Date | string` 이고 드라이버 설정에 따라 글이 올 수 있다고 코드가 이미 가정함 — 가정을 없애는 대신 맞게 읽게 함.

**실행 증빙**(미러 `~/.node-local/thekaiwa-e048`, `KAIWA_LOCAL_ROOT` 지정 sync·`prisma generate`, 가짜 `DATABASE_URL`)
- `task048.test.ts` 8/8(기존 4 + 신규 4) — `TZ=Asia/Seoul`·`TZ=UTC`·`TZ=America/Los_Angeles` 세 환경 모두 8/8(프로세스 시간대는 시험이 바꾸지 않고 `Date.UTC` 기대값과 비교).
- `src/modules/conversation/**`·`learning/**`·`app/**` 시험 89파일 **1352/1352 통과**(`--test-concurrency=1`; task-049 작업 트리 포함).
- `eslint`(rolePlay.ts·task048.test.ts·backfill 스크립트) rc 0. `tsc --noEmit` rc 2 — 오류 **1건뿐이고 내 파일 아님**: `src/modules/learning/__tests__/task042.test.ts(967,33) TS2698 Spread types may only be created from object types`(task-049 가 진행 중인 파일, 이번 변경 전부터 diff 에 있음 — task-049 개발자 몫). 내 변경 파일 오류 0.
- 보이지 않는 문자 `git diff -- src scripts` 0건. 엔진명 추가 0. `next build` 는 이 묶음에서 실행 안 함(지시: 빌드 필수 아님, task-049 파일이 진행 중이라 tsc 가 막혀 있어 의미 없음) — **NOT_VERIFIED**.

**변이**(scratchpad `mut048b/` 복사본 — 파일마다 새 inode 로 바꿔 쓰고 원복, 끝에 `src`·`scripts` `diff -rq` 동일 확인; 시험은 `task048.test.ts` 단독)

| 변이 | 결과 |
|---|---|
| M1 백필 `owner.get(refId) !== o.userId` 검사 제거 (L-1) | **KILLED** — 새 L-1 시험(7/8) |
| M2 `parseRawDateTime` 글 전부 `new Date(s)` 로 되돌림 (L-2) | **KILLED**(TZ=Asia/Seoul: 6/8, L-2 단위·facts 시험 둘 다) · TZ=UTC 에선 생존(고유한 한계 — 서버 시간대가 UTC 면 이 결함은 보이지 않음) |
| M3 `serializeChat` 응답에 `endedAt` 추가 (L-4) | **KILLED** — 응답 키 시험 |
| M4a `rawDateOrNull` 맨 앞 빈 값(null·undefined·'') 가드 제거 | SURVIVED — **동치 변이**: 가드를 지워도 `parseRawDateTime` 이 `String(v)`→Invalid Date→NaN 거름으로 같은 null 을 돌려줌(가드는 읽기 쉬우라고 남긴 것) |
| M4b `rawDateOrNull` 잘못된 값 거름(`isNaN`) 제거 | **KILLED** |
| M5 백필 `--apply` 가드(`opts.apply &&`) 제거 | **KILLED** — dry-run 시험(쓰기 0) |
| M6 정규식에서 `T` 구분형 제외 | **KILLED** |
| M7 `trim()` 제거 | **KILLED**(TZ=Asia/Seoul) |
| M8 `chatCreatedAt` 글 분기를 옛 `new Date(String())` 로 되돌림 | **KILLED** — facts 시험 |
| M9 백필 UPDATE where 에서 `userId` 제거 | SURVIVED — 리뷰의 변이 F 와 같은 **동치에 가까운 변이**(id 가 유일해 같은 행만 바뀜, 방어 심층) |

**가이드와 달라진 점**: ① 「`createdAt` 문자 분기도 같은 패턴」 중 `rolePlay.ts` 의 것은 고쳤고(같은 파일), **`orchestrator/index.ts:150`**(`new Date(String(chat.createdAt))`)은 허용 파일 밖이라 **고치지 않았다** — 영향: 턴 수락 때 관측 조회 하한(`isScenarioRolePlayEnded` 의 `createdAt`)만 쓰이고 실제 `$queryRaw` 가 `Date` 를 주면 무관, 문자로 오고 서버가 KST 면 하한이 9시간 일러져 창이 넓어질 뿐(좁아지지 않음 — 느슨한 쪽). 고치려면 `parseRawDateTime` 한 줄(Leader 승인 시). ② `rawDateOrNull` 단위 시험 범위를 가이드보다 넓혀 `parseRawDateTime`·facts 경로까지.

**알려진 한계**: 시간대 해석 시험은 서버가 UTC 일 때는 L-2 결함 변이를 잡지 못한다(결함 자체가 KST 에서만 보임) — 이 환경은 KST 라 잡힌다. L-3(문서 한 줄)·L-5(미커밋 문서)는 이번 묶음 범위 밖(Leader 몫).

**미커밋 파일(내 변경)**: `src/modules/conversation/chats/rolePlay.ts` · `src/modules/conversation/__tests__/task048.test.ts`. (작업 트리의 task-049 변경 — `learning/vocab/**`·`learning/__tests__/task008·task042.test.ts` 등 — 은 내 것이 아님.)
- 다음 첫 행동(Leader): 두 파일 경로 지정 커밋 → Reviewer 재검증(L-1·L-2·L-4).

## QA 기록 (qa-048 — 역할극 endedAt 실흐름)

### 체크포인트 1 — 환경·기준선·Q1 (2026-10-10 11:0x, qa 신규 소환 sonnet)
- **환경**: 서버 `http://127.0.0.1:3074`(커밋 `23dfba3` 스냅샷 `next start`, `APP_ENV=LOCAL`, 공유 NAS DB) 헬스 `degraded`(`stt_analysis_worker` false — 이번 항목과 무관, db·llm·tts true). 운영 3010 접촉 0. 미러 `~/.node-local/thekaiwa-qa048`. QA 쿠키 c4(QA4)·c1(QA1) 은 scratchpad `q048/` 에 600 권한(끝에 삭제). 스크립트 `q048/qa048-flow.mts`(복사본이 미러 루트에도 있음 — 끝에 삭제), 원 출력 `q048/phaseA.log`.
- **시작 전 기준선(QA4, userId 칸이 있는 전 표)**: Profile 1 · UserVoiceSetting 1 · UserSpeechSetting 1 · Attendance 3 · RequestTrace 73 · Chat/ChatMessage/Correction/LearningObservation/StudyLog/RepetitionItem/StatsSnapshot/Scenario 전부 0 (StatsSnapshot 해시 `4f53cda18c2baa0c` = 빈 목록). 공유 DB 전역: `scenarioId` 있는 Chat 0 · SCENARIO_COMPLETED 관측 0 · `Chat.endedAt` 채워진 행 0. (`q048/baseline2.json`)
- **상황 선택**: 지시는 「시드 상황 선택」이었으나 「시드 상황 불가침」과 충돌하지 않게 010d 스모크처럼 QA4 가 #163 으로 만든 자기 상황 1개(접두 `qa048-…`)를 썼다 — 끝에 지움.
- **Q1 결과 (실서버·라이브 LLM, 턴 2회 + 마치기 1회, 약 16초): 21/21 PASS** — `q048/phaseA.log`

| # | 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| ① | 마치기 응답 `endedAt` | 문자열·`replayed:false` | 200, `2026-10-10T02:01:57.858Z`, outcome ACHIEVED·turns 2 | PASS |
| ② | DB `Chat.endedAt` == 응답 | 같음 | `02:01:57.858Z` == `02:01:57.858Z` | PASS |
| ③ | 관측 `SCENARIO_COMPLETED.occurredAt` == `Chat.endedAt` == 응답 (ms 까지) | 셋 동일 | `02:01:57.858Z` / `02:01:57.858Z` / `02:01:57.858Z` (관측 1행, StudyLog 1행) | PASS |
| ④ | 마친 뒤 턴 | 409 `ROLEPLAY_ENDED`, 메시지 행 불변 | 409 `ROLEPLAY_ENDED`, 5→5 | PASS |
| ⑤ | 반응 연습 #169 | 409 `ENDED` | 409 `ENDED` | PASS |
| ⑥ | 재마치기 | `replayed:true`·같은 `endedAt`·같은 studyLogId, 기록 행 수 불변 | 200 `replayed:true` `02:01:57.858Z`, 관측 1·StudyLog 1·RepetitionItem 1·DAILY 해시 `820dbc58bb`·`Chat.endedAt` 전후 동일 | PASS |
| ⑦ | 카탈로그 `inProgress`·#27 뱃지·#29 | 빠짐·`ended:true`·결과 | 상세·목록 `inProgressChatId` 사라짐, 뱃지 `{id,ended:true}`, #29 `scenario.ended.outcome=ACHIEVED`·`ended.endedAt` == 저장 값 | PASS |
| ⑧ | #27·#28 응답 `endedAt` 키 | 없음 | #28 시작 응답·#27 목록(마치기 전·후) raw 에 `"endedAt"` 0건 (참고: #29 에는 `scenario.ended.endedAt` 1건 — 계약된 결과 노출, `chat` 최상위에는 없음) | PASS |

**남은 일**: Q2①(동시 마치기)·Q2②(마치기×턴)·Q2③(옛 행 NULL)·Q2④(권한)·Q3(백필 dry-run·정리). **다음 첫 명령**: `cd ~/.node-local/thekaiwa-qa048 && SP=<scratchpad>/q048 node --env-file=.env --import tsx qa048-flow.mts B` (이어서 C·D·CLEAN). 상태 `q048/state.json`.
**미정리 행(QA4)**: Chat A(`state.json` chats.A)·ChatMessage 5·관측 1·StudyLog 1·RepetitionItem 1·DAILY StatsSnapshot 1·상황 1·RequestTrace 증가분·(Attendance 증가 여부는 마지막에 확인). 정리는 `qa048-flow.mts CLEAN`.

### 체크포인트 2 — Q2·Q3① (2026-10-10 11:1x)
원 출력: `q048/phaseB.log`·`phaseC.log`·`phaseC2.log`·`phaseD.log`·`backfill-dryrun.log`·`backfill-badarg.log` (scratchpad). 대화: A(Q1·옛 행 시험) · B(동시 마치기) · C(턴∥마치기, 턴 먼저) · C2(마치기∥턴, 마치기 먼저).

**Q2 (실서버·라이브 LLM) — 판정 전부 PASS**

| # | 확인 | 기대 | 실제 | 판정 |
|---|---|---|---|---|
| ①a | 동시 마치기 2개(`Promise.all`) | 둘 다 200·`endedAt` 동일 | 200/200, 둘 다 `2026-10-10T02:03:01.533Z`, 한쪽 `replayed:true`·다른 쪽 `false`, studyLogId 동일 | PASS |
| ①b | 기록 행 수 | 관측 1·StudyLog 1·`endedAt` 1값 | 관측 1 · StudyLog 1 · `Chat.endedAt` == 관측 `occurredAt` == 응답 (`…01.533Z`), RepetitionItem 은 상황당 1건이라 증가 0 | PASS |
| ② (C) | 턴 진행 중 마치기(턴 먼저, 60ms 뒤 마치기) | 409 `TURN_RUNNING` 또는 안전한 순서 | 턴 200 · 마치기 409 `TURN_RUNNING` · 관측 0 · `endedAt` NULL(미기록, 안전). 턴이 끝난 뒤 다시 마치기 → 200 `replayed:false`, `Chat.endedAt`(`02:03:56.892Z`) == 관측 == 응답, 관측 1·StudyLog 1 | PASS |
| ② (C2) | 마치기 먼저(턴이 60ms 뒤 도착) | 같음 | 마치기 409 `TURN_RUNNING`(판정 LLM 구간에 턴이 수락되어 tx2 재확인에서 거절) · 턴 200 · 메시지 5행(USER 2) · 관측 0 · `endedAt` NULL — **불변식 유지, 기록 없음(안전)**. ※ 로그의 `FAIL Q2②`·`FAIL Q2②b` 2줄은 **QA 스크립트 버그**(C2 분기에서 `[turn,finish]` 결과 순서를 뒤집어 대입 → 로그의 `turn=409 finish=200` 은 실제로 `finish=409 turn=200`). 메시지 행 수(5)·관측 0·`endedAt` NULL 로 손으로 재판정 = 허용 결과 (나) | PASS (스크립트 오표기 정정) |
| ③a | A 의 `Chat.endedAt` 만 NULL 로 되돌림(QA4 가 만든 행 1개, `updateMany` 1건) 뒤 턴 | 409 `ROLEPLAY_ENDED`(관측 기반) | 409 `ROLEPLAY_ENDED`, 메시지 행 불변 | PASS |
| ③b | 다시 마치기 | `replayed:true`, 새로 쓰이지 않음 | 200 `replayed:true`, 응답 `endedAt` = 관측 `occurredAt` = 원래 값 `2026-10-10T02:01:57.858Z`, **DB `Chat.endedAt` 는 NULL 그대로**(지연 백필 없음 — 설계대로), 관측·StudyLog·RepetitionItem·DAILY 해시 불변 | PASS |
| ③c | NULL 행의 읽기 | 끝남으로 보임 | #27 뱃지 `ended:true`, 카탈로그 `inProgressChatId` 는 A 아님(C2 가 진행 중으로 잡힘 — 정상), #169 409 `ENDED` | PASS |
| ④ | 권한 | 404 | QA1 → A 의 마치기·턴·#169·#29 전부 404(행 불변, QA1 Chat 수 불변) · QA4 존재하지 않는 id 마치기·턴·#169 404 · 쿠키 없음 401 | PASS |

**Q3① 백필 dry-run (미러 `node --env-file=.env --import tsx scripts/backfill-roleplay-endedat.ts`, `--apply` 실행 안 함)**: rc 0 · `mode: DRY-RUN (no writes)` · 역할극 대화 `endedAt` NULL=2(A, C2)·채워짐=2(B, C) · `matched 1`(NULL+관측 있음 = A, 표본 chat id == A) · `updated 0` · `occurredAt` 범위 `02:01:57.858Z..02:01:57.858Z` · 실행 후 A 의 `endedAt` 여전히 NULL(dry-run 이 쓰지 않음 DB 로 재확인). 잘못된 인자 `--aply` → rc 2, `unknown argument(s)` 출력(DB 접속 전). **`--apply` 가드(코드 읽기)**: UPDATE 와 `$transaction` 은 `opts.apply && fills.length` 일 때만, UPDATE 조건은 `{id, userId, endedAt: null}`(멱등), 관측↔대화 소유자 불일치 행은 건너뜀. ※ 공유 DB 이므로 미러가 곧 운영과 같은 DB — 운영 데이터는 이번 dry-run 시점에 역할극 대화가 우리 4건뿐이라 대상이 운영 사용자 행이 아님.

**남은 일**: 정리(`qa048-flow.mts CLEAN`)·기준선 대조·서버 로그 확인·임시 파일 삭제·일지 한 줄·최종 보고. **미정리**: QA4 의 Chat 4건(A, B, C, C2)·관련 메시지·관측 3·StudyLog 3·RepetitionItem 1·DAILY StatsSnapshot 1·상황 1·RequestTrace 증가분.

### 체크포인트 3 — 정리·최종 판정 (2026-10-10 11:3x)

**정리 결과(`q048/clean.log`, `after.json` vs `baseline2.json`)**: 삭제 — 관측 5(SCENARIO_COMPLETED 3 + 턴 관측 2)·StudyLog 3·RepetitionItem 1·RequestTrace 12·Chat 4(메시지 cascade)·상황 1·DAILY StatsSnapshot 1. **QA4 의 userId 칸 보유 전 표 수가 시작 전과 바이트 동일**(Profile 1·UserVoiceSetting 1·UserSpeechSetting 1·Attendance 3·RequestTrace 73·StatsSnapshot 해시 `4f53cda18c2baa0c`·Chat/메시지/교정/관측/StudyLog/RepetitionItem/Scenario 0). 공유 DB 전역 `scenarioId` 있는 Chat **0**·SCENARIO_COMPLETED 관측 0·`Chat.endedAt` 채워진 행 0 (= 시작 전과 동일). QA1 에는 만든 행 0(Chat 수 불변·창 안 RequestTrace 0). 임시: 쿠키 c4·c1 삭제 · 미러 루트의 QA 스크립트 삭제 · 서버(3074)는 끄지 않음(지시). 서버 로그 `qa048-server.log` 20줄에 error·exception·unhandled·P20xx **0건**(기동 + `claudeCli 완료` 12건; `claudeCli 취소` 2건(93ms·6ms)은 오류가 아니며 어느 요청에서 났는지는 확인 못 함 [추측: 거절된 요청의 예열/취소]).

**최종 판정: PASS (결함 0건, Critical/High/Medium/Low 모두 0)** — Q1 21/21 · Q2 전 항목 · Q3 정리 후 행 수 불변. 합산 PASS 40/40 (스크립트 오표기 FAIL 2줄은 위 C2 설명대로 정정 — 제품 결함 아님).

**검증한 것 vs 못 한 것**
- 실 DB 왕복으로 확인: `Chat.endedAt` == `LearningObservation.occurredAt` == 응답 `endedAt` (ms 까지, 3개 대화 모두), 동시 마치기 2개 → 관측·StudyLog 1행·`endedAt` 1값·응답 동일, 옛 행(NULL) 2차 방어(턴 409·재마치기 `replayed:true`·`endedAt` NULL 유지·기록 불변), 소유자·존재·401, 백필 CLI(`.env` 로딩·`tsx`·`@/` 별칭 — REV-176 의 NOT_VERIFIED) dry-run 실제 실행 rc 0.
- **턴∥마치기 경합은 두 방향(턴 먼저·마치기 먼저) 모두 실서버에서 `finish 409 TURN_RUNNING`(미기록·`endedAt` NULL, 이후 재시도 성공) 쪽만 관측**했다. 단위 시험이 고정한 다른 두 순서((가) 턴이 먼저 끝나고 마치기 성공 · (다) 마치기가 먼저 이겨 턴 409)는 실서버에서 재현하지 못했다 — NOT_VERIFIED(재현이 타이밍 의존; 불변식은 두 방향 모두 유지됨). 이력서에 지시된 「문서 §종료×턴 동시 (a)~(d)」라는 절 이름은 문서에서 찾지 못해 010d 스모크가 쓰던 허용 결과 3종으로 판정했다.
- NOT_VERIFIED: blue/green 중 구·신 코드 혼재(구 코드는 새 칸을 읽지 않음 — 코드로만) · 백필 `--apply`(지시대로 실행 안 함) · 화면(UI 변경 0이라 해당 없음, 360/390/412 대상 아님) · 실기기.
- 운영 메모(결함 아님): 옛 행(NULL)은 **다시 마치기로 채워지지 않는다**(지연 백필 없음, 설계) — 운영 배포 뒤 그 사이 끝난 역할극이 있으면 백필 `--apply` 가 필요하다. 이번 시작 시점 공유 DB(= 운영) 역할극 대화는 0건이었다.
- LLM 호출: 턴 7 · 판정 5 (haiku, `claudeCli 완료` 12건), 직렬 슬롯 `ps` 확인 후 단계별 실행.

## 최종 요약 (Leader, 사용자용 — 2026-10-10, 배포 확인 대기)
**결과**: 사용자가 [마치기]로 끝낸 역할극에만 `Chat.endedAt`(끝난 시각)을 저장하고, 턴 수락·재종료·결과·카탈로그·목록이 이 값을 먼저 봅니다(NULL 인 옛 행은 관측 기반 판정으로 계속 동작 — 2차 방어). 화면 모양·문구·API 응답 필드는 바뀌지 않습니다.
**검증**: 감사 REV-176(PASS_WITH_NOTES, High·Medium 0)→Low 수정(백필 교차 사용자 방어 시험·`rawDateOrNull` 시간대·직렬화 `endedAt` 미노출 시험)→QA(qa-048, 라이브 LLM): `Chat.endedAt`·관측 `occurredAt`·마치기 응답이 **밀리초까지 같은 값**, 마친 뒤 턴 409 `ROLEPLAY_ENDED`·#169 409 `ENDED`·재마치기 `replayed:true`(기록 행 수 불변), 동시 마치기 관측·StudyLog 1행씩, 마치기×턴 경합 안전, 옛 행(NULL) 2차 방어 동작, 타인 대화 404. 시험·`tsc`·`eslint`·`next build` 통과, 변이 다수 검출. QA 행은 전부 정리(공유 DB 역할극 대화 0건 복귀).
**DB**: 사용자 승인 3칸 중 1칸. 2026-10-10 백업(`thekaiwa-20261010-102226-pre-task048-049.sql.gz`) → `migrate diff` 검토본 대조 → `db push` 1회 완료, 적용 후 빈 diff. 운영과 같은 DB(`192.168.219.154:3306/thekaiwa`)라 **배포 전에 이미 컬럼이 있어** 코드만 배포하면 된다.
**알려진 한계**: 지연 백필 없음(옛 NULL 행은 재마치기로 안 채워짐 — 백필 스크립트 몫). `orchestrator/index.ts:150` 의 `new Date(String(chat.createdAt))` 는 서버가 KST·값이 문자열일 때 관측 조회 하한이 9시간 일러지는 동일 패턴 — 창이 넓어지는 쪽이라 틀린 판정은 안 만들어 이번엔 미수정. 턴∥마치기 경합의 두 순서는 실서버 재현 못 함(단위 시험으로 고정). blue/green 구·신 혼재·백필 `--apply` 는 미검증.
**백필**: `scripts/backfill-roleplay-endedat.ts`(기본 dry-run, `--apply` 만 UPDATE). **현재 공유 DB 에 역할극 대화가 0건이라 대상 0건 — 지금은 `--apply` 가 필요 없다.** 배포 직후 dry-run 을 한 번 더 돌려 0 이 아니면 사용자 확인 뒤 `--apply`.
**남은 일**: 사용자 배포 확인(커밋 `ad39547`·`23dfba3`) → 배포 후 스모크와 백필 dry-run.

## 배포 기록 (2026-10-10 21:1x KST, Leader) — task-048·049 공용
- 사용자 승인: 배포 확인 질문(예문 대기 +3.5초·퀴즈 힌트 부작용·백필 불필요를 함께 고지)에 「둘 다 지금 배포」 선택.
- `git push origin main`(`6e97554..869e28d`, 로컬 커밋 8개 — 코드 `ad39547`·`23dfba3`·`94518d0`·`638948d`·`ff60d2f`, 문서·vault). QA 검증 코드(`10cd615`)와 push 코드가 같음을 확인(`10cd615`→`HEAD` 사이 `src`·`prisma`·`scripts`·`tests` 변경 0).
- webhook blue/green → **릴리스 `20261010-121054-869e28d6`**, `RELEASE_RESULT ok`(`migrated:false` — DB 3칸은 사전 `db push` 로 이미 적용), 헬스 `ok`(degraded 없음, PRODUCTION), pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` 모두 새 릴리스 경로에서 online. 직전 릴리스 `20261010-064417-402b193e` 는 롤백 대상(`scripts/deploy.sh TheKaiwa --rollback`).
- 운영 읽기 전용 스모크(QA2 쿠키, 데이터 쓰기·LLM 호출 0): `/study/ai?tab=talk|scenario`·`/study/today`·`/plan`·`/drawer/words`·`/ask`·`/settings`·`/study/today/eval/new`·`/plan/challenges`·`/plan/challenge/new`·`/study/ai/scenario/new` 11경로 전부 200.
- **백필 dry-run(운영 DB, UPDATE 0)**: `matched 0`·`updated 0` — 역할극 대화가 0건이라 `--apply` 불필요(실행하지 않음).
- 남음: 운영에서 새 단어 예문이 실제로 나오는지 사용자 실기기 확인(챌린지 주제 단어 세트 시작 → 카드 뒷면) · 역할극을 처음 쓰는 시점에 `endedAt` 저장 확인(DB 가 비어 있어 운영 실흐름은 아직 증명되지 않음 — QA 는 개발 서버+공유 DB 에서 통과).
