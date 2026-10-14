---
task_id: task-068
title: "task-068 Reviewer 감사 A 기록 — DB 스키마·기본 단어 시드·재분류·이관 스크립트·배포 순서 안전성"
status: done
tags:
  - type/task-note
  - domain/vocab
aliases:
  - task-068 REV-A
created: 2026-10-14
updated: 2026-10-14
---

# task-068 Reviewer 감사 A 기록

본 이력서: [[task-068-improve-wordbook]] · S-A 기록 [[task-068-dev-sa-record]] · 전용 미러 `~/.node-local/thekaiwa-rev068a`(= rev068 `cp -al`; 변이 때마다 `cp --remove-destination` 으로 복사본을 만든 뒤 고치고, 끝나면 NFS 원본과 `cmp` — 15회 모두 「restored OK」) · DB 접속 0(`DATABASE_URL=mysql://invalid…`) · git 조작 0 · 소스·시험 수정 0 · `.env` 읽기 0.

## Reviewer 기록 (REV-068A)

**판정: PASS_WITH_NOTES (= CONDITIONAL_PASS)** — Critical 0 · High 1 · Medium 3 · Low 5.
**스키마 push·기본 단어 시드는 지금 승인 요청해도 안전하다. 678행 이관(④)은 REV-068A-1·-2 를 고치고 이관 부분만 좁게 재감사하기 전에는 승인 요청하지 않는다.**

### 지적

| ID | 심각도 | 위치 | 한 줄 |
|---|---|---|---|
| REV-068A-1 | **High** | `seedCopyMigration.ts:106` (+머리말 8행, 시험 `task068SeedCopyMigration.test.ts:36`) | 새 코드가 사본에 쓴 `UserWordState` 가 있으면 사본의 옛 누적 칸(맞힘·틀림·마지막 본 시각)을 버린다 |
| REV-068A-2 | Medium | `migrate-seed-copies.ts:221`·`seedCopyMigration.ts:134-139` | `delete-copies` 가 사용자가 고친 뜻·메모·예문·조각을 확인 없이 지운다 |
| REV-068A-3 | Medium | 배포·롤백 절차(HEAD `drawer.ts:82,108`, 운영 클라이언트 enum 4값) | 이관·배포 뒤 옛 릴리스로 되돌리면 깨지거나 단어장이 비는 경로 3개 |
| REV-068A-4 | Medium | `seedCopyMigration.ts:119-126`·`:138` | 대상이 사본을 못 덮는 `conflict` 사본은 영구히 남고 합칠 길이 없다(같은 단어 두 줄) |
| REV-068A-5 | Low | `migrate-seed-copies.ts:201-202,203,205,221` | repoint 의 `VocabAttempt`·`EvaluationItem` 은 사용자 조건이 없고, 시험이 Correction/RepetitionItem 사용자 조건·삭제 where 를 못 고정(변이 2건 생존) |
| REV-068A-6 | Low | `migrate-seed-copies.ts:88-147,215-226` | 읽고 나서 쓰기까지의 틈(TOCTOU) — 사이에 생긴 참조·상태가 FK SetNull·Cascade 로 끊김 |
| REV-068A-7 | Low | `docs/design/domain-model.md:942` | `User` 모델에 `wordStates UserWordState[]`(schema.prisma:517) 줄이 없음 |
| REV-068A-8 | Low | S-A 기록 「실행 순서」 | 백업 단계 누락(deploy-order §7 「백업 먼저」)·apply 뒤 확인에 `contentDiff=0` 없음·`delete-copies` 에 `--confirm-delete` 를 빠뜨리면 메시지 없이 「failed: Error」 |
| REV-068A-9 | Low | `baseWordSeed.ts:148,155` | `seedKey` 가 팩 JSON 순번이라 `scripts/seed-build` 가 팩을 다시 만들어 순서가 바뀌면 키가 밀린다(감지는 `--check-db` drift 뿐) |

### 근거·시나리오

- **REV-068A-1 [확실 — 시연 실행]**. 새 코드는 `bumpWordStates`(`wordState.ts:77,82-84`)로 상태를 `UserWordState` 에만 쓰고(행이 없으면 0 에서 만든다) `WordEntry` 옛 칸은 읽지도 쓰지도 않는다. 그런데 이관 `matchSeedCopies` 는 `copyStates.get(c.id) ?? c`(`seedCopyMigration.ts:106`)라 사본 id 의 `UserWordState` 가 있으면 옛 칸을 통째로 버린다. 시연(순수 함수, `/scratchpad/legacy-loss.ts`): 사본 옛 칸 맞힘 5·틀림 2, 배포 뒤 새 코드가 만든 행 맞힘 1 → `state` 가 기본 단어로 옮기는 값 **1/0**(옛 5/2 소실). 배포(③)~이관(④) 사이에 사용자가 사본을 한 번이라도 풀면 그 사본의 이전 기록이 사라진다. 시험 `:31-36` 은 옛 칸이 0 인 픽스처라 「행이 옛 칸보다 우선」만 고정하고 합산 경우를 못 잡는다. **권고**: 사본의 유효 상태 = 옛 칸 + 새 행(맞힘·틀림 합산, 마지막 본 시각 큰 쪽, 마지막 결과는 더 나중 것, 보관은 새 행이 있으면 새 행) — 새 코드 행이 0 에서 시작한다는 사실이 근거. 시험에 「옛 칸 5/2 + 새 행 1/0 → 6/2」 추가.
- **REV-068A-2 [확실 — HEAD 코드 확인]**. 옛 운영 코드는 SEED 사본에도 `meaning·partOfSpeech·chunkType·example·exampleKo·note·category` 수정을 막지 않는다(`HEAD:words.ts:303-324`, `source` 제한 없음). 이관은 (표기, 읽기) 일치만 보고 기본 단어로 갈음하고 사본을 지우므로(`deleteDecision` 은 참조·상태만 본다) 사용자가 사본에 적은 `note`(VarChar 500)·고친 뜻이 소실된다. 지금 `plan` 출력에 「사본 내용이 기본 단어와 다른 개수」가 없어 승인 전에 크기를 알 수 없다. **권고**: `load` 에서 사본과 짝 기본 단어의 내용 칸(+`note`)을 비교해 개수를 `plan` 에 보이고, 다르거나 `note` 가 있는 사본은 `delete-copies` 가 거절(`content-edited`)하게 한다. 사용자가 확인해야 한다면 그 개수를 승인 요청문에 싣는다.
- **REV-068A-3 [확실 — 코드/클라이언트 확인] + [가능성 높음 — Prisma 오류 형태]**. 정방향(① 스키마 → ② 시드 → ③ 새 코드)은 안전하다: HEAD 의 `wordEntry` 접근 전부(`words.ts:125,148,276,277,291,333,355,368,369,389`, `sessions.ts:467-937`, `materials.ts:72`, `memo.ts:71`, `seedPack.ts:138,143`, `reviewSchedule/index.ts:226`)가 `userId` 조건이고 `wordListFilter`(`words.ts:231-234`)도 그렇다 → `userId` NULL 인 기본 단어 7,757행·`EXPRESSION` 값은 옛 코드에 닿지 않는다. 운영 릴리스 클라이언트는 `ChunkType` 4값(`/home/brownjeon/apps/thekaiwa/current/node_modules/.prisma/client/index.d.ts:341-346`)이지만 읽을 일이 없다. 그러나 **되돌릴 때**: ⓐ 이관·채택(L4)으로 `Correction.savedWordId` 가 기본 단어를 가리키면 옛 서랍 교정 모음이 `savedWord.userId`(필수 String)로 NULL 을 읽는다(`HEAD:drawer.ts:82,108`) → Prisma 오류 가능성이 높다. ⓑ 새 코드에서 사용자가 「표현」 조각 단어를 만들면(D5) 옛 클라이언트가 enum 밖 값을 읽어 그 사용자의 단어장 목록이 오류. ⓒ `delete-copies` 이후엔 옛 코드가 `userId` 소유 행만 읽어 **단어장이 비어 보인다**(상태는 `UserWordState` 에 있어 옛 코드가 못 읽음). **권고**: 배포 롤백 체크리스트에 ⓐⓑⓒ 를 적고, 이관 삭제 전에 덤프(WordEntry·UserWordState·VocabAttempt·EvaluationItem·Correction·RepetitionItem)를 받는다. `delete-copies` 가 사실상 되돌릴 수 없는 지점이다.
- **REV-068A-4 [확실 — 시연 실행]**. 사용자가 배포 뒤 기본 단어 쪽을 먼저 풀어 대상 행(맞힘 1)이 생기고 사본 옛 칸이 5/2 이면 `decideState`=`conflict`, `deleteDecision`=`state-conflict`(시연 출력)라 그 사본은 `state` 가 못 옮기고 `delete-copies` 가 영구히 거절한다 — 같은 단어가 「내 단어」와 「기본」으로 두 줄 남고 합치는 단계가 없다. **권고**: 사본 옛 칸(배포 전 값)을 대상에 더하는 `merge` 정책(대상 행이 배포 이후에 만들어진 것이 확실하므로 더해도 이중 집계가 아니다 — 단, 대상 행의 `createdAt` 이 배포 시각 이후일 때만) 또는 최소한 `conflict` 사본 목록을 사람이 처리하는 절차.
- **REV-068A-5/6 [확실]**. `VocabAttempt`·`EvaluationItem` 은 `userId` 칸이 없어(`schema.prisma:957`) 조건을 못 걸고 사본 id 로만 옮긴다 — 사본 id 는 사용자 고유라 실제 교차 사용자 영향은 없다(방어 깊이). 변이 ② 「Correction·RepetitionItem 사용자 조건 제거」·⑦ 「삭제 where 의 `source/seedKey:null` 제거」가 시험을 통과(생존).
- **REV-068A-7/8/9**: 문서·절차 보강. `INSERT IGNORE` 는 enum 값이 DB 에 아직 없을 때 `''` 로 조용히 저장하므로 apply 뒤 `contentDiff=0` 확인이 필요하다(스키마 push 가 같은 푸시로 enum 을 넣으므로 가능성은 낮음).

### 확인 끝난 영역 (발견 없음 포함)

- **A-1 옛 코드 호환 [확실]**: 스키마 변경은 전부 추가·완화(`userId` NULL 허용, `seedKey` 새 칸, `UserWordState` 새 표, `ChunkType` 값 끝에 추가 — `schema.prisma` diff). HEAD 의 `wordEntry` 접근 전수 확인(위 REV-068A-3) → 정방향에서 깨지는 경로 없음. 릴리스마다 자기 `node_modules/.prisma` 를 가져(`releases/<id>/node_modules` 실디렉터리) 개발 미러의 `db:generate` 가 운영 클라이언트를 바꾸지 않는다. `db push` 대상 열 변경(WordEntry.userId·ChunkType 열 4개)은 작은 표라 짧다.
- **A-2 시드 [확실 — 순수 계획 실행]**: 7,757행 = 팩 7,755 + 옛 50 중 짝 없는 2행(N5X-0004 友だち, N5X-0007 ご飯), `seedKey` 7,757 유일·형식 `^N[1-5]X?-\d{4}$` 위반 0, (표기, 읽기) 중복 0, 빈 칸 0, 4바이트 문자 0행, 최대 길이 표기 10·읽기 10·뜻 20·분류 8·키 8(한도 80/120/200/40/40 이내). 시드 `example`/`exampleKo` 는 Text 칸. `--apply`: `CONFIRM_SEED_BASE_WORDS=yes` 없으면 CLI(`seed-base-words.ts:178-182`)와 러너(`:104`) 두 곳에서 쓰기 0, dry-run 은 `db=null` 로 DB 를 열지 않음(`:102`), `--update` 는 `where {seedKey, userId: null}` + 표기·읽기 일치 행만(`:114-123`). 8조각은 배열형 `$transaction`(타임아웃 옵션 없음, 커밋 한 번) — 연결이 끊기면 전부 롤백되고 `skipDuplicates` 로 재실행 안전. NAS 커밋 지연에서의 위험은 시간이 길어지는 정도(Low, 별도 지적 없음).
- **A-3 재분류 [확실]**: 규칙이 표현 122·꾸밈 64·이름 11·느낌 3(빈 조각 200→0)을 정확히 재현하고 시험이 실제 JSON 으로 단언(변이 ④ 두 가지 모두 잡힘). 규칙 없는 품사는 던진다(시험 `:85`). 원본 `jlpt/*.json`·`words-n5.json` 은 `git diff HEAD` 변경 0(새 파일 `chunk-reclass.json` 만). 표본 11개 배정이 자연스럽다: ありがとう·こんにちは·しかし→표현, 様(さま)·ちゃん·その·日→꾸밈, これら·どこ·何・封建→이름, 不可·著名→느낌 (이의 없음. 一気=원샷이 표현으로 가는 것은 품사 규칙의 결과로 허용 범위).
- **A-5 enum 흐름 [확실]**: DB 의 `EXPRESSION` 이 4유형 계약으로 새는 경로 없음 — `reviewSchedule/index.ts:249`·`lessonInput.ts`·`seedOverride/ops.ts`·`drawer.ts` 가 `asTopicChunkType` 으로 좁히고, 평가 재료 `pool` 은 `chunkType` 을 고르지 않으며(`materials.ts:72-79`) 평가 항목 조각은 LLM 4값(`generate.ts:65,95`), 교정은 LLM 스키마 4값. `?chunkType=EXPRESSION` 은 400(시험 `task055drawer.test.ts:211`).
- **A-7 문서**: `domain-model.md` 의 `WordEntry`·`UserWordState`·`ChunkType` 변경이 `schema.prisma` 와 칸·제약·인덱스까지 일치. 단 REV-068A-7(`User.wordStates` 줄).
- **A-4 나머지 [확실]**: 단계 분리(plan/state/repoint/delete-copies)와 가드(`CONFIRM_MIGRATE_SEED_COPIES=yes`·`--apply`·`--confirm-delete`) 정상, 짝 맞춤은 (표기, 읽기) 바이트 일치뿐이고 짝 없음·중복 사본·기본 단어 키 겹침은 어떤 단계도 안 건드림(시험·변이 ⑩ 잡힘), `state` 는 대상이 있으면 덮지도 더하지도 않고 멱등(변이 ⑥ 잡힘), 남은 참조가 한 건이라도 있으면 삭제 거절(변이 ① 잡힘), 출력은 개수뿐이고 오류는 이름·코드만, `Correction`·`RepetitionItem` 은 사용자 조건 있음, 반복 항목 유일 제약 충돌은 옮기지 않고 사본 삭제를 거절(변이 ⑫ 잡힘). 중간에 끊겨도 사본은 `delete-copies` 전까지 그대로라 `state`(만든 `UserWordState` 행)·`repoint` 모두 사본 기준으로 재유도 가능 — 되돌림 스크립트는 없다.

### 변이 (미러 전용, 15회 실행·13 잡힘·2 생존)

| # | 변이 | 결과 |
|---|---|---|
| M1 | `deleteDecision` 에서 참조 남음 거절 제거 | 잡힘(3건) |
| M2 | repoint 의 Correction·RepetitionItem 사용자 조건 제거 | **생존**(REV-068A-5) |
| M3a | 시드 러너의 확인 가드 제거 | 잡힘 |
| M3b | 시드 CLI 의 확인 가드 제거 | 잡힘(CLI 종료코드) |
| M4a | 재분류 한 값 변경(expected 유지) | 잡힘(계획 실패) |
| M4b | 표기 목록에서 どこ 제거(expected 는 안 맞춤 — 값 불일치) | 잡힘(계획 실패, 의미 없는 잡힘) |
| M4b' | 표기 목록에서 どこ 제거 + expected 를 10/65 로 일관되게 | 잡힘(시험 3·4번 — 행동 고정 확인) |
| M5 | `seedKey` 4자리→3자리 | 잡힘(2건) |
| M6 | `state` 가 conflict 대상 덮어쓰기 | 잡힘 |
| M7 | 삭제 where 의 `source:'SEED', seedKey:null` 제거 | **생존**(REV-068A-5) |
| M8 | `--update` where 의 `userId:null` 제거 | 잡힘 |
| M9 | `stateCovers` 가 마지막 본 시각 무시 | 잡힘 |
| M10 | 같은 사용자 중복 사본도 짝으로 처리 | 잡힘 |
| M11 | 시드 apply 의 `skipDuplicates` 제거 | 잡힘 |
| M12 | 반복 항목 충돌 무시하고 repoint | 잡힘 |

(실행 15회 = M1·M2·M3a·M3b·M4a·M4b·M4b'·M5~M12. 의미 있는 서로 다른 변이는 14종.)

## 사용자 승인 요청 전에 알려야 할 위험

1. **스키마 `db push`** — 공유 DB 라 push 즉시 운영(옛 릴리스)에도 적용된다. 변경은 추가·완화뿐이고 옛 코드는 영향 없음(위 A-1). 영향 표: `WordEntry`(userId NULL 허용·`seedKey` 유일 칸)·`ChunkType` 열을 쓰는 4개 표(값 추가)·새 표 `UserWordState`. **백업 먼저**(deploy-order). 되돌리려면 `EXPRESSION`·`userId NULL` 행을 먼저 지워야 한다(그냥 되돌리는 push 는 거절되거나 데이터를 잃는다).
2. **기본 단어 시드** — 7,757행·한 트랜잭션. 쓰기 전엔 옛 코드에 보이지 않고, 쓴 뒤에도 옛 코드는 읽지 않는다. 되돌림은 `userId IS NULL AND seedKey IS NOT NULL` 행 삭제이며 **새 코드를 배포하기 전에만** 안전하다(배포 뒤엔 사용자 `UserWordState` 가 cascade 로 같이 지워진다). apply 뒤 `--check-db` 는 `present 7757 · missing 0 · drift 0 · unknown 0 · owned 0 · contentDiff 0`.
3. **새 코드 배포(③)~이관(④) 사이** — 사본 678행이 「내 단어」로, 기본 단어 7,757행과 같은 단어가 두 줄로 보이고, 사본의 옛 누적은 안 보인다(새 코드는 `UserWordState` 만 읽는다). 이 구간에 사용자가 사본을 풀면 REV-068A-1 로 옛 기록이 사라지므로 **수정 전엔 이관을 진행하지 않는다**.
4. **이관(④)** — `plan` 의 기대값은 copies 678·matched 678·unmatched 0·duplicate 0·ambiguous 0·conflict 0. `state`·`repoint` 는 사본이 남아 있어 재유도 가능하나 되돌림 스크립트는 없다. **`delete-copies` 는 사실상 되돌릴 수 없다**(옛 릴리스로 롤백하면 단어장이 비어 보임, REV-068A-3 ⓒ) — 덤프를 받고, REV-068A-2 의 「고친 사본」 개수를 확인한 뒤 별도 승인을 받는다.

## QA 에 넘길 high_risk_areas

- 시드 적용 전후 옛 릴리스 스모크: 단어장 목록·오늘의 단어·평가 만들기·교정 모음이 200(기본 단어 7,757행이 DB 에 있는 상태).
- `--check-db` 출력 6개 값과 이관 `plan` 기대값(위 3·4) — 재실행 멱등 확인.
- 이관 수정 후: 「옛 칸 5/2 + 새 행 1/0 → 6/2」·「대상 행이 있고 사본이 더 큰 conflict」·「고친 사본 삭제 거절」 시험이 단위 시험에 있는지.
- 롤백 리허설: 이관 `repoint` 뒤 교정 모음, `EXPRESSION` 단어 생성 뒤 옛 목록, 삭제 뒤 옛 단어장.
- 실제 사용자 DB 읽기 전용 확인(사용자 승인 뒤): 사본 중 `note IS NOT NULL` 개수·기본 단어와 내용이 다른 사본 개수.

native_change: false (이번 감사 범위에 네이티브 변경 없음).
