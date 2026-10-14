---
tags:
  - type/task-note
  - domain/vocab
---
# task-068 — 기존 사용자 사본 이관 스크립트 재감사 (REV-068A2)

본 이력서: [[task-068-improve-wordbook]] · 원 감사 [[task-068-rev-a-record]] · 수정 기록 [[task-068-dev-sa-record]] (`[감사 A 수정]`·`[edited 판정 수정]`·「실행 런북」)

범위: 이관 부분만 — `src/modules/learning/vocab/seedCopyMigration.ts` · `scripts/migrate-seed-copies.ts` · 시험 `task068SeedCopyMigration.test.ts`·`task068SeedCopyEdited.test.ts`. 전용 미러 `~/.node-local/thekaiwa-rev068m`(= rev068 `cp -al`, 새 클라이언트 `UserWordState` 724 확인, `sync-local.sh` 로 NFS 소스 동기화) · DB 접속 0(`DATABASE_URL=mysql://invalid…`) · git 조작 0 · `.env` 읽기 0 · 소스·시험 수정 0(NFS 원본과 미러 `cmp` 동일 확인) · 다른 에이전트 메시지 0. 감사용 임시 스크립트는 세션 scratchpad 에만 둠.

## Reviewer 기록 (REV-068A2)

**판정: PASS_WITH_NOTES (= CONDITIONAL_PASS)** — Critical 0 · High 0 · Medium 1 · Low 5.
감사 A 의 REV-068A-1·2·4·5·8 은 **고쳐졌다**(아래 「이전 지적 확인」). 새로 남은 것은 `edited` 판정이 보지 않는 칸(분류·조각)과, 읽고 쓰기 사이 틈·백업 시점·롤백 절차의 보강이다. **이관 plan(읽기 전용)은 지금 실행해도 된다. 쓰기 단계(⑤-2 이후)는 아래 「승인 요청 전에 알려야 할 위험」을 사용자에게 알리고, 새 백업(⑤-2 직전)과 분류·조각 사전 점검(⑥ 전)을 승인문에 넣은 뒤 진행한다.**

### 지적

| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-068A2-1 | **Medium** | `seedCopyMigration.ts:51`(비교 칸)·`:126-128` | `delete-copies` 가 사용자가 고친 **분류(`category`)·조각(`chunkType`)** 을 보지 않고 지운다 — `edited` 비교 5칸에 없다 |
| REV-068A2-2 | Low | `migrate-seed-copies.ts:242,252,263,305-308` | 읽고 쓰기 사이 틈 — `state` 의 사본 상태 행 삭제·`delete` 의 FK Cascade/SetNull 이 그 사이 생긴 기록을 조용히 끊는다(삭제 where 가 참조·사본 상태·내용을 다시 확인하지 않음) |
| REV-068A2-3 | Low | S-A 기록 「실행 런북」 ①·⑤-2 | 백업이 `db:push` 전(①)과 삭제 전(⑥)뿐 — ⑤-2(`state`: 사본 옛 칸을 0 으로, 사본 상태 행 삭제)가 첫 비가역 쓰기인데 직전 덤프가 없다 |
| REV-068A2-4 | Low | 런북 「롤백 시나리오」 R2 | R2(배포 뒤·이관 전) 에 ⓐ(교정 모음 오류)가 빠짐 — 새 채택 경로(`corrections/[id]/accept/route.ts:14`)가 이관 전에도 `savedWordId` 를 기본 단어로 잇는다 |
| REV-068A2-5 | Low | 시험 `task068SeedCopyMigration.test.ts:218`(가짜 `$transaction` = `Promise.all`) | 가짜 DB 가 트랜잭션 원자성·롤백을 못 검증한다 + 변이 2건 생존(M19 `state` 옛 칸 되돌림 where, M14 정확 비교) |
| REV-068A2-6 | Low | `seedCopyMigration.ts:12,249-258` | 정책 노트 — 대상 행이 이미 있으면 사본의 「보관」 의도는 버려진다(`archived` = 대상 값) |

### 근거·시나리오

- **REV-068A2-1 [확실 — 실행]**. 사용자 UI 가 분류(`WordForm.tsx:141` 「분류」)·조각(`:140` `WordChunkPicker`)을 고치게 하고 `updateWord` 가 이를 받는다(`words.ts:496-503`; 옛 코드도 같음 — 감사 A 가 확인한 HEAD `words.ts:303-324`). 그러나 비교 칸은 `meaning·partOfSpeech·example·exampleKo·note` 뿐이다(Leader 정책: 기본 단어는 재분류·이름 정리로 달라지는 것이 정상). 시연(`scratchpad/probe-edited.ts`, 실제 `words-n5.json` 50행 + 실제 기본 단어 계획 7,757행): 50개 사본 모두에서 `category='내 폴더'`·`chunkType='ACTION'` 으로 바꿔도 **`edited 0` · `deletable 50`** (C 줄). 지우면 사용자가 붙인 분류·조각이 소실되고 기본 단어의 분류가 대신 보인다. 영향 범위는 사본 678행 전체(실사용자 1명 추정). **권고**: ⑥ 승인 전에 읽기 전용 SQL 로 사본의 분류·조각 분포를 확인한다 — 기대값은 HEAD 로직+현재 JSON 모의(`scratchpad/probe-cat.ts`): `category` = '초보자 (N5)' 628 · 'N5 기초' 50; `chunkType` = NAME 337 · ACTION 116 · MODIFIER 137 · FEELING 55 · NULL 33(옛 OWNER 50 = NAME 16·MODIFIER 8·ACTION 15·FEELING 9·NULL 2 / 팩 628 = NAME 321·ACTION 101·MODIFIER 129·FEELING 46·NULL 31). 다르면 사용자 편집 후보 — 다른 값이 나왔다고 곧 편집은 아니다(팩 JSON·재분류 규칙이 사본 생성 뒤 바뀌었을 수 있음, [가능성 높음]) 이므로 어느 사본인지 사람이 보고 결정. 코드로는 plan 에 「분류·조각이 사본 생성 모양과 다른 개수」 정보 줄을 더하는 것을 권한다(관문 아님, OWNER 50 은 `oldOwnerSeedCopy` 의 `category`/`chunkType` 를 이미 갖고 있고 팩 628 은 `asSeedWords`+`seedPackCategory`).
- **REV-068A2-2 [확실 — 코드]**. (a) `state`: 한 배치 트랜잭션이 대상 upsert 후 `userWordState.deleteMany({ userId, wordId in copyStateIds })`(`:263`)를 하는데 where 가 읽은 값과 비교하지 않아, `load` 이후 사용자가 사본을 풀어 늘린 사본 상태가 **더해지지 않은 채** 지워진다(대상 쪽 증가는 `increment` 라 안전 — 개발자 기록 ② 와 일치). (b) `state` 의 upsert update 분기는 `seenChanged = !target || …`(`:242`) 이라 **읽을 때 없던 대상이 쓰기 전에 생겼다면** 그 대상의 더 늦은 `lastSeenAt`·`lastResult` 를 사본 쪽 더 이른 값으로 덮을 수 있다(맞힘·틀림은 `increment` 라 안전). (c) `delete`: where 는 `id·userId·source·seedKey·옛 칸 기본값`(`:305-308`)만 다시 확인하고 **참조 0·사본 상태 행 없음·내용 불변은 읽을 때의 값**이다. 그 사이 생긴 `VocabAttempt`·`EvaluationItem`·`Correction` 은 FK `SetNull`, `UserWordState` 는 `Cascade`(`schema.prisma:917,982,1313,789`) 로 **조용히 끊긴다**. 창의 길이 = `load()` 의 쿼리 수십 회 + 삭제, 즉 수 초~수십 초; 런북이 「앱을 쓰지 않는 시간에」로 막았고 사용자가 사실상 1명이라 확률은 낮다. 개발자 기록의 「남은 위험 ②」는 (a) 만 적었다 — (b)(c) 도 같은 틈이다. **권고(한 줄 보강)**: 삭제 where 에 `attempts: { none: {} }, evalItems: { none: {} }, corrections: { none: {} }, states: { none: {} }` (`WordEntry` 관계명, `schema.prisma:891-894`) 를 더하면 SetNull/Cascade 가 일어나는 순간이 사라진다(`RepetitionItem` 은 FK 없음 → 틈 남음). 코드 수정이 싫으면 런북에 「사용자 앱 사용 중지 확인 → plan 재실행 → 곧바로 apply」를 못박는다.
- **REV-068A2-3 [확실 — 런북 대조]**. 런북 ① 은 `db:push` 전 전체 덤프, ⑥ 은 삭제 전 덤프. ⑤-2 의 「되돌리기」 칸은 「덤프 ① 로만 원상 복구」 라고 적는데 덤프 ① 은 ② 스키마·③ 시드·④ 배포 **이전**이라, 그것으로 복구하면 ④~⑤ 사이 사용자 활동(새 `UserWordState` 등)을 모두 잃는다. 이 단계는 사본 옛 칸을 0 으로 만들고 사본 상태 행을 지워 **합산 전 값을 대상과 분리할 수 없게** 하므로(대상에 합쳐진 값에서 원래 값을 되돌릴 수 없음) 사실상 비가역이다. **권고**: 런북에 「⑤-2 직전 백업(① 과 같은 명령)」 한 줄을 추가하고, ⑤-2 되돌리기 칸을 「직전 덤프에서 `WordEntry` 6칸·`UserWordState`(사본 id) 만 선택 복원」으로 바꾼다. `repoint`(⑤-3)는 사본이 남아 있는 동안 키 매칭으로 원래 id 를 다시 유도할 수 있어 같은 덤프로 충분.
- **REV-068A2-4 [가능성 높음 — 코드 대조]**. 런북 R2 는 ⓑ(`EXPRESSION` 조각 단어)만 적는다. 그런데 새 교정 채택은 같은 (표기, 읽기) 기본 단어가 있으면 새로 만들지 않고 그 기본 단어를 `savedWordId` 로 잇는다(`accept/route.ts:11-14`, task-068 L4). 즉 **이관 전(R2)** 에도 사용자가 교정을 채택하면 `Correction.savedWordId` 가 `userId` NULL 행을 가리킬 수 있고, 옛 서랍 교정 모음은 `savedWord: { select: { id, surface, userId } }`(HEAD `drawer.ts:82`, `userId` 필수 `String`)를 읽는다 → 옛 릴리스로 롤백하면 그 사용자의 교정 모음이 Prisma 오류를 낼 가능성이 높다(감사 A 가 R3 에 적은 것과 같은 원인). **권고**: R2 에 ⓐ 추가 — 롤백 전 `UPDATE Correction SET savedWordId = NULL WHERE savedWordId IN (SELECT id FROM WordEntry WHERE userId IS NULL)` (되돌릴 때만; 교정 자체·`StudyLog` 는 그대로).
- **REV-068A2-5 [확실 — 코드·실행]**. 가짜 DB 의 `$transaction` 은 `Promise.all(ops)` 이고 연산은 이미 실행 중인 Promise 라(`:218`), 「한 트랜잭션」 주장(원자성·실패 시 롤백)을 시험이 검증하지 못한다. 대신 내가 **지연 실행(PrismaPromise 같은)+순차 실행+롤백** 가짜 DB 로 확인했다(아래 R-1). 시험 보강 권고: 같은 지연 실행 가짜 DB 로 「n 번째 쓰기에서 실패 → 표 불변 → 재실행 수렴」을 고정. 변이 생존: **M19** `state` 의 옛 칸 되돌림 `updateMany` where 에서 `userId·source·seedKey` 를 빼도 시험 통과(방어 깊이 미고정); **M14** 비교를 `trim()` 허용으로 바꿔도 통과(비공백 텍스트의 정확 비교가 시험에 없음 — 실제 코드는 `blankToNull` 만 trim 이라 내가 직접 확인: 끝 공백 하나도 `edited`). 둘 다 데이터 손실 경로는 아니다.
- **REV-068A2-6 [확실 — 코드]**. 보관 정책 `③ 있으면 ③ → ② → ①` 에 의해 대상 행이 이미 있으면(사용자가 배포 뒤 기본 단어를 한 번이라도 풀었음) 사본의 옛 「보관」이 이어지지 않는다(시험 `:99-108` 이 이 선택을 고정). 새 코드는 사본의 옛 칸을 읽지 않으므로 배포~이관 사이 보관된 사본이 다시 보이는 구간도 있다. 정책 선택이고 되돌릴 수 있는 손실(보관 다시 누르기)이라 Low.

### 직접 확인한 항목 (증거)

**R-1 합산·멱등 [확실 — 실행]** (`scratchpad/probe-atomic.ts`, 지연 실행 가짜 DB + 순차 트랜잭션 + 롤백 + 실패 주입)
1. 감사 A 시연 재현: 사본 옛 칸 5/2 + 사본 id 상태 1/0 → 실행기 `state` → 기본 단어 **6/2**, 사본 옛 칸 0·사본 상태 행 0, 다시 실행하면 written 전부 0.
2. 대상 행 10/0 도 있을 때 첫 트랜잭션의 쓰기 3개(upsert·옛 칸 되돌림·상태 행 삭제) **각각의 위치에서 실패 주입** → 모두 롤백(표 JSON 동일), 재시도 뒤 **16/2**(5+1+10 / 2) 로 수렴, 한 번 더 돌려도 변화 없음.
3. 같은 사용자 사본 150행(배치 100 + 50): 2번째 배치 트랜잭션에서 실패 → 1번째 배치는 커밋 유지(대상 100·옛 칸 0 100), 재시도 후 **150 대상 모두 정확히 1**(이중 합산·손실 없음).
4. 무작위 400세계(사본 옛 칸·사본 상태·대상 행을 임의 조합, 임의 위치 실패 주입 후 재시도): **위반 0** (합계 = 세 출처 합, 사본 상태 행 0, 사본 옛 칸 0, 한 번 더 실행해도 불변).
5. 코드 확인: 합산(`upsert`+`increment`)·옛 칸 0 되돌림·사본 상태 행 삭제가 한 `db.$transaction([...])`(`:266`) — 사용자·100쌍 단위. 표지 = 옛 칸 기본값 ∧ 사본 상태 행 없음(`statePending`, `seedCopyMigration.ts:262`). 한계: 이것은 가짜 DB 에서의 증명이고 실제 MariaDB 트랜잭션 의미(InnoDB)는 [추측 아님 — FK Cascade 가 이미 InnoDB 전제]이나 실DB 실행으로는 확인하지 못했다.
6. 틈은 REV-068A2-2.

**R-2 edited 판정** (`scratchpad/probe-edited.ts`, 실제 `prisma/seed-data/words-n5.json` + `planBaseWords` 7,757행)
- ① 매핑 대조: `git show HEAD:prisma/seed.ts` OWNER 단계(`:122-131`)와 `oldOwnerSeedCopy`(`seedCopyMigration.ts:138-153`)가 칸 하나까지 같다 — `surface·reading·meaning·partOfSpeech·chunkType ?? null·jlpt 'N5'·example·exampleKo·category 'N5 기초'·source 'SEED'`, `note` 는 넣지 않음→null. `words-n5.json` 은 `git log` 상 e22fd7e 한 판뿐. 빠진 선택 칸 null·create 가 실패했을 줄 null 처리도 타당.
- ② 거짓 음성: 비교 5칸 안에서는 열리는 경로가 없다 — 비공백 값은 바이트 일치(`blankToNull` 은 빈 문자열·공백뿐만 null), 부분 일치는 둘 다와 달라 edited(보수), 사용자가 (a)나 (b) 와 **똑같이** 적은 경우만 삭제되는데 그때는 내용 손실이 없다. **열리는 경로는 비교 밖 칸(분류·조각·수준) → REV-068A2-1.**
- ③ 거짓 양성(안전한 방향): 끝 공백 하나(예문 앞/뒤)도 edited(D·E 줄), (b) 기준 파일이 없으면 35행이 edited(F 줄 — 35 = 막는 쪽), 팩 JSON 이 사본 생성 뒤 바뀌었으면 팩 사본이 edited 로 plan 이 DIFF 정지(개발자 남은 위험 ②, 지우지 않을 뿐).
- ④ 모호 키: 같은 표기 두 줄이면 그 표기의 키를 모두 (b) 에서 제외(`:171`) — 막는 쪽으로만 작동(M12 잡힘). 실제 파일은 모호 키 0.
- ⑤ 재실행 숫자: 옛 OWNER 50행 → 짝 **50**·unmatched 0·dup 0·**edited 0**·**seed-origin 35**·삭제 가능 50, 칸별 차이 example 32 · exampleKo 32 · meaning 9. 한 칸만 고치면(뜻·예문·번역·메모·품사 각각, seed-origin 사본과 기본 단어와 같은 사본 각각) **정확히 그 사본 1개만 edited**, 삭제 가능 49. 기대값 줄 `edited 0/0 → ALL OK · seed-origin 35/≈35` 는 시험(678 모의: 옛 50+팩 628 → deletable 678)이 고정.

**R-3 삭제 안전 [확실 — 코드·시험·변이]**: `--confirm-delete`·환경변수 가드는 `main()` 이 DB 를 열기 전(`:410-419`, 종료 코드 2)·`runMigration` 두 곳(`:325-326`). 삭제 대상 = `deleteDecision(참조 0 ∧ 상태 표지 ∧ ¬edited)` ∧ where `{id in, userId, source:'SEED', seedKey:null, 옛 칸 기본값 6개}`; 짝 없음·중복·`RepetitionItem` 충돌 사본은 `pairs` 밖이거나 `refs-left` 라 건드리지 않는다(시험 흐름 `c4/c5`). 출력은 개수뿐·오류는 이름·코드만(시험이 단어·id 부재 단언). 한계 = REV-068A2-2(삭제 직전 「새로 읽기」 가 아니라 `load()` 때 값 + where 의 5칸 재확인).

**R-4 repoint 사용자 격리 [확실]**: `VocabAttempt {wordId, session:{userId}}` · `EvaluationItem {wordId, evaluation:{userId}}` · `Correction {savedWordId, userId}` · `RepetitionItem {userId, refType, refId}` (`:285-289`). 시험 `방어 깊이`(`:368-391`)가 다른 사용자(`u9`) 행 불변·where 모양·그 사본 삭제 거절을 단언하고, 변이 4종(M8a~d) 모두 잡힘.

**R-6 런북 대조**: 기대값 줄·`old OWNER seed file: rows=50 · usable keys=50 · ambiguous keys=0`·`seed-origin … 35/≈35`·`pending/copies with legacy counters/copy-id UserWordState rows`·`delete-copies would delete = 678 − edited − refs-left`·「written 전부 0」은 코드 출력(`expectationLine`·`fmt`)과 일치. `--check-db` 6값(`present 7757 · missing 0 · drift 0 · unknown 0 · owned 0 · contentDiff 0`)은 `seed-base-words.ts:135` 출력 라벨과 일치. `npm run db:migrate-seed-copies` 는 `sync-local.sh` 후 `~/.node-local/thekaiwa` 에서 실행(`package.json:18`)하므로 `process.cwd()/prisma/seed-data/words-n5.json` 이 읽힌다(rows=50 로 확인 가능; rows=0 이면 (b) 없이 막는 쪽). 되돌릴 수 없는 지점은 ⑥ 만 적었으나 실제로는 ⑤-2 부터 사실상 비가역(REV-068A2-3). 롤백 R1·R3 서술 정확; R2 는 ⓐ 누락(REV-068A2-4).

### 이전 지적 확인

| 감사 A | 상태 | 근거 |
|---|---|---|
| 068A-1 High (새 사본 상태가 옛 칸을 버림) | **해소** | 옛 칸+사본 상태+대상 합산, R-1 시연 6/2·무작위 400세계 0 위반 |
| 068A-2 Medium (고친 사본 삭제) | **해소(5칸)** · 비교 밖 칸은 REV-068A2-1 | `deleteDecision` 이 edited 거절, M9 잡힘 |
| 068A-4 Medium (conflict 사본 영구) | **해소** | `conflict` 개념 삭제, 대상 있으면 `merge`(M1 잡힘) |
| 068A-5 Low (repoint 사용자 조건·삭제 where 미고정) | **해소** | M7·M8a~d 잡힘 |
| 068A-8 Low (백업·`contentDiff`·`--confirm-delete` 메시지) | **대부분 해소** | 런북 ①·⑥ 백업·`contentDiff 0` 기재, `--confirm-delete` 누락은 DB 열기 전 종료 코드 2; 단 ⑤-2 직전 백업은 REV-068A2-3 |
| 068A-6 Low (TOCTOU) | 문서화됨, 일부만 | REV-068A2-2 |

### 변이 (전용 미러 `thekaiwa-rev068m`, 22회 실행 · 20 잡힘 · 2 생존, NFS 원본과 `cmp` 매번 원복)

| # | 변이 | 결과 |
|---|---|---|
| M1 | `state` 대상 합산 `increment` → 덮어쓰기 | 잡힘 |
| M2 | 옛 칸 0 되돌림 제거(멱등 깨기) | 잡힘 |
| M3 | 사본 id `UserWordState` 행 삭제 제거 | 잡힘 |
| M4 | (b) 옛 시드 비교 제거 → (a) 만 | 잡힘(6) |
| M5 | (a) 기본 단어 비교 제거 → (b) 만 | 잡힘(8) |
| M6 | 비교 칸에서 `meaning` 제외 | 잡힘(8) |
| M7 | 삭제 where 의 `source`·`seedKey` 제거 | 잡힘 |
| M8a~d | repoint 사용자 조건 제거 4종(VocabAttempt·EvaluationItem·Correction·RepetitionItem) | 각각 잡힘 |
| M9 | edited 사본 삭제 허용 | 잡힘(7) |
| M10 | 삭제 판단이 남은 참조 무시 | 잡힘(2) |
| M11 | 삭제·합산 표지가 사본 상태 행 무시 | 잡힘(3) |
| M12 | 모호 표기 (b) 제외 제거 | 잡힘 |
| M14 | 비교를 trim 허용으로 약화 | **생존**(Low, REV-068A2-5 — 손실 경로 아님) |
| M16 | 삭제 gating 통째로 제거(모든 짝 삭제) | 잡힘(2) |
| M17 | 삭제 where 의 `userId` 제거 | 잡힘 |
| M18 | 삭제 where 의 옛 칸 표지 제거 | 잡힘 |
| M19 | `state` 옛 칸 되돌림 where 에서 `userId·source·seedKey` 제거 | **생존**(Low, 방어 깊이) |
| M20 | 사본 상태 행을 하나도 안 지움(M3 변종) | 잡힘 |
| M21 | 사본 상태의 마지막 본 시각 무시 | 잡힘(3) |
| (대조) M15 무의미 변경 | 생존(정상) · M13 은 패턴 불일치로 건너뜀 | — |

### 승인 요청 전에 반드시 사용자에게 알려야 할 위험

1. **`delete-copies` 는 되돌릴 수 없다**(복구 = 덤프 복원, 덤프 뒤 기록은 잃음). **⑤-2(`state`)부터** 사본 옛 칸이 0 이 되고 사본 상태 행이 지워져 이미 사실상 비가역이다 → **⑤-2 직전에 새 덤프**(런북에 없음, REV-068A2-3)와 ⑥ 직전 덤프 둘 다 필요.
2. **사본의 분류·조각을 사용자가 고쳤으면 삭제로 사라진다** — `plan` 의 `EDITED 0` 은 이를 보지 않는다(REV-068A2-1). ⑥ 승인 전에 읽기 전용 SQL 로 `category`/`chunkType` 분포를 확인(기대값 위 근거 참조)하거나, 잃어도 된다는 사용자 결정을 받는다.
3. **앱을 쓰지 않는 시간에만 실행**한다. 읽고 쓰기 사이에 사용자가 사본을 풀거나 풀이 기록이 생기면: ⑤-2 에서는 그 증가분이 사본 상태 행과 함께 삭제돼 합산에서 빠지고, ⑥ 에서는 새 풀이 기록이 `SetNull` 로 단어와 끊기며 사본 상태가 `Cascade` 로 지워진다(REV-068A2-2). 사용자 1명이면 사용 중지만 확인하면 충분.
4. **plan 관문**: `copies 678·matched 678·unmatched/duplicate/ambiguousBaseKeys 0·edited 0 → ALL OK` 가 아니면 멈추고 보고. `seed-origin 35` 는 시드 파일로 계산한 추정치이고 실제 DB 값과 대조 전(관문 아님). 팩 사본 628행은 현재 팩 JSON 과만 비교하므로, 사본 생성 뒤 JSON 이 바뀌었으면 `edited>0` 으로 DIFF 정지(안전한 방향).
5. 롤백: R1(시드 직후)·R3(이관 뒤)는 런북이 정확, **R2 에 ⓐ(교정 모음 오류)를 추가**해야 한다(REV-068A2-4). 이관 뒤에는 롤백 대신 앞으로 고치기(fix-forward)가 기본.
6. `LearningObservation`(append-only)의 사본 id 는 삭제 뒤 dangling 으로 남는다(설계상 허용, plan 이 건수를 보고).

### QA 에 넘길 high_risk_areas

- 이관은 QA 의 일반 시험 범위가 아니라 사용자 승인 단계별 실행(plan → ⑤-2 → ⑤-3 → ⑥)이다. 각 단계 뒤 `plan` 재실행으로 `pending 0 / refs 0(충돌 제외) / deletable` 숫자를 기록.
- ⑤-2 직후 한 번 더 `state --apply` 가 written 전부 0 인지(멱등).
- ⑥ 뒤: 단어장 목록에서 기본 단어 + 사용자의 풀이 기록(`UserWordState`)이 사본의 옛 기록 합과 일치하는지, 교정 모음·반복 항목(`RepetitionItem`)이 열리는지.

native_change: false.

#### 정적 검사
- 미러(`thekaiwa-rev068m`, 현재 NFS 소스 동기화 상태)에서 `tsc --noEmit -p .` **exit 0**(오류 0). 두 시험 파일 **19/19 통과**(변이 전 기준선, `DATABASE_URL=mysql://invalid…`).

#### 감사 도구 메모
- 미러 생성: `cp -al thekaiwa-rev068 thekaiwa-rev068m`(rev068 의 `.prisma` 가 이미 새 클라이언트라 하드링크를 끊을 필요 없음 — 소스는 `rsync` 가 새 파일로 교체).
- 변이 하니스·확률 시험·JSON 회귀 스크립트는 세션 scratchpad(`probe-edited.ts`·`probe-atomic.ts`·`probe-cat.ts`·`mutate.py`)에만 있고 저장소에는 없다. `probe-atomic.ts` 의 지연 실행 가짜 DB 를 `task068SeedCopyMigration.test.ts` 에 옮기면 REV-068A2-5 가 닫힌다(Developer 몫).
