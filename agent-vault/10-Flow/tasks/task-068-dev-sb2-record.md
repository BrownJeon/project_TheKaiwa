---
task_id: task-068
title: "task-068 Developer S-B2 기록 — 오늘의 단어 세트·평가 재료·레슨 메모·복습 재료·교정 모음의 「내 단어 + 기본 단어」 조회/상태 갱신 전환 + 라이브 스모크 갱신"
status: in_progress
tags:
  - type/task-note
  - domain/vocab
aliases:
  - task-068 S-B2
created: 2026-10-14
updated: 2026-10-14
---

# task-068 Developer S-B2 기록

본 이력서: [[task-068-improve-wordbook]] · S-A 기록 [[task-068-dev-sa-record]] · 가이드 `docs/screens.md` §28-8 A(S-B 행 중 sessions·materials·memo·reviewSchedule·drawer)·§28-9 T28~T30·T25 · 계약 `api-contract.md` §2-9 task-068 개정 ⑤ · 전용 미러 `~/.node-local/thekaiwa-dev068b2`(dev068a 하드링크, `.prisma` 는 실제 복사본) · DB 접속 0 · git 조작 0 · SendMessage 0.

## Developer 기록

- [13:30] 착수 — 이력서·S-A 기록·가이드 §28-8/28-9·계약 개정 ⑤ 읽음. 미러 준비·`prisma generate`·tsc: 남은 오류는 전부 U 작업 중 파일(`components/vocab/*`) — 내 소유 파일 0. **S-B1 도우미 `vocab/wordState.ts` 아직 없음 → 「S-B1 도우미 대기」**, 그 시그니처(브리프)대로 코드부터 쓴다.
- [13:55] **단계 4 코드 완료(S-B1 `wordState.ts` 13:27 생김 — 그 시그니처 그대로 사용)**
  - `vocab/sessions.ts`: 세트 풀·분류 세트·주제 세트 뜻 보기·다시 풀기 뜻 보기 = `activeWordWhere(나)` · 다시 풀기 단어 카드 = `visibleWordWhere`(보관 무시 — 지금 규칙) · 끝내기 카운터 = `bumpWordStates`(`WordEntry.updateMany` 3번 삭제) · `NO_WORDS` `cta` = `['ADD_WORD']`(L7) · **`POOL_SELECT` = id·meaning·partOfSpeech·jlpt 4칸**(표기·예문은 뽑힌 카드 ≤30 만 `CARD_SELECT` 로 한 번 더 — `loadCardWords`) · 가중 상태 = 새 `loadActiveWordStates(db, 나)` = `userWordState.findMany({userId, archived:false})` **한 번**. ⚠ 결정: S-B1 `loadWordStates(db, userId, ids)` 는 1천 개씩 IN 이라 풀 7.8천이면 8번 — 상태 행은 본 적 있는 단어에만 있으므로 `(userId, archived, wrongCount)` 색인 범위 한 번이 더 싸다. 이 도우미는 `sessions.ts` 에서 export(평가 재료도 씀) — S-B1/Leader 가 `wordState.ts` 로 옮기고 싶으면 옮겨도 동작 같음.
  - 쿼리 모양(세트 생성 한 번): 사용자 행 잠금 → 진행 중 확인 → 풀 `wordEntry.findMany(AND[OR[userId=나, userId NULL∧SEED], states none{나, archived}])` 4칸 → (분류면 같은 조건 + category id만) → 오늘 끝낸 카드 → 내 상태 행 → 뽑힌 카드 ≤30 PK 조회 → 세트·카드 쓰기. task-057 실측(72ms) 때보다 쿼리 +2(상태·카드), 풀 칸은 11→4 — QA Q10 에서 재측정 필요.
  - `evaluation/materials.ts`: 재료 풀 = `activeWordWhere` 4칸 + `loadActiveWordStates` 병렬 → 나의 wrongCount desc·id asc 정렬·2,000 상한(예전 orderBy/take 와 같은 순서·상한). **J12**: 평가 재료 단어에는 `chunkType` 칸이 없다(프롬프트로 안 넘김) — 좁힐 곳 없음. `recentItems.chunkType` 은 `EvaluationItem.chunkType`(A6 출력 = 4유형) 원값 그대로(14일 중복 해시 입력이라 바꾸면 해시가 달라짐 — 그대로 둠).
  - `lessons/memo.ts` `wordbookMatches`: `AND[visibleWordWhere, surface in]` + 새 순수 `wordbookOrder`(내 단어 createdAt·id 먼저 → 기본 단어 jlpt N5→N1·seedKey·id — 계약 ② existingId 와 같은 순서). 매칭된 기본 단어 id 가 `applyWordbook` 의 `SKIP IN_WORDBOOK wordId` 로 가는 흐름 그대로(코드 변경 없음). **enrichWord `chunkType`(PE v2) 영향**: `memoDraftFromEnrich` → `MemoWordDraft` 에 `chunkType` 칸이 없어 **레슨 메모 제안 페이로드에는 실리지 않는다(무시)** → #38 채택 단어는 조각 null 로 저장(L1 허용). 싣고 싶으면 conversation `LessonWordDraft`·제안 payload·채택 경로까지 바꿔야 함(범위 밖 — Leader 판단).
  - `reviewSchedule/index.ts`: 새 순수 `reviewWordReadWhere(나, ids)` = `AND[visibleWordWhere, id in]`(S-A 의 import·`CHUNK_TYPE_BY_ITEM`·`asTopicChunkType` 줄은 안 건드림).
  - `conversation/corrections/drawer.ts`: `savedWord` 조건 = 내 단어 **또는** `userId NULL ∧ source SEED`(`isBaseWord` — L2 는 L3 import 안 함이라 같은 두 조건을 로컬에), select 에 `source` 추가(응답엔 안 실음).
  - 시험: 새 `__tests__/wordWhereFake.ts`(가짜 where 해석기 — AND·OR·states none/some·in·not, 모르는 키는 던짐 + 가짜 `userWordState`) · 새 `task068SB2.test.ts` 6건 · `task059CardFirst` +4건(T28 풀·빈 풀 cta·상태 조회 모양·기본 단어 끝내기) + 기존 끝내기 단언을 단어 행 → 상태 행으로 · `task055drawer` +1건(T30) + select 단언에 `source` · `task042`·`task051Homograph`(M2③ — 조회 모양이 바뀌어 orderBy 단언 대신 저장 역순 가짜로 같은 결과 확인)·`topicVisibility`(가짜 `userWordState`) 가짜 DB 갱신. 단언 의미 변경 = 카운터 위치(단어 행 → 상태 행)·M2③ orderBy 1줄뿐.
- [13:53] **[마무리] S-B2 마무리 developer** — 라이브 스모크 갱신 완료(실행 0) · 변이 확인 · 기대값 목록 · 게이트. DB 접속 0 · git 조작 0 · SendMessage 0 · 전용 미러 `~/.node-local/thekaiwa-dev068b2`.
  - **게이트(미러, 가짜 DB `DATABASE_URL=mysql://invalid…`)**: `tsc --noEmit` **0** · eslint(내 소유 파일 + `tests/live/p2c-qa/b-eval-voice.ts` + `task010.test.ts`) **0** · `learning/__tests__/*` + `conversation/__tests__/*` 전체 **1623건 중 1622 통과·0 실패**(1 skip = 변이 전 기준선도 같음). 내 시험 6개 파일 = 106건 통과(변이 전 102 + 보강 4).
  - **Leader 추가 지시 처리**: `learning/__tests__/task010.test.ts` `#62a 보강 결과 → 초안` 픽스처 `base` 에 `chunkType: null` 1칸(S-B1 의 `WordDraft.chunkType` 필수 추가 때문에 나던 tsc 3건 해소, 시험 의미 불변 — `chunkType` 은 `ChunkType | null`). 세션 끝내기는 이미 `bumpWordStates` **한 번 호출**(sessions.ts 875행)이라 S-B1 의견과 같은 모양 — 더 바꾼 것 없음.
  - **`tests/live` 갱신 완료**: 이전 developer 가 `README.md`·`task006`·`task008`·`task010`·`task011` 을 고쳤고, 이번에 `p2c-qa/b-eval-voice.ts` 1곳을 더 고침. 나머지 후보(`task007-smoke`·`task007-warm-measure`·`task010b`·`task012`·`task012b`·`task028-translation`·`task036/037-qa-turns`·`task042`·`task044-screens`·`task056`)와 후보 밖 `wordEntry`·`vocab/sessions` 를 쓰는 파일(`p2a/p2b/p2c/p3-qa*`·`task039-qa/*`·`task010-ui-e2e.mjs`·`challenge-ttfa`)까지 전수 grep 으로 훑었다.

  **A. 바꾼 기대값 (이전 → 새, 근거)**

  | 파일 | 이전 기대 → 새 기대 | 근거 |
  |---|---|---|
  | `README.md` task008 행 | 「#46b·seed-pack 동시 2·빈 단어장」 설명 → 총수=내 단어+기본 단어, 쪽 번호·`cursor` 400·조각 5종·`none` 400, 映画 보강 409 `BASE_DUPLICATE`, 기본 단어 403 `READ_ONLY`, 카운터 `UserWordState`, NO_WORDS=QA2 가 기본 단어를 모두 보관, **push·시드 뒤에만 실행** | 계약 §2-9 task-068 개정 |
  | `task006-smoke.ts` 8c | ADD_WORD 제안 채택 `映画館` → 새 TUTOR 행 1개 → `映画祭`(기본 단어에 없음) | 기본 단어 표기를 채택하면 새 행 없이 그 기본 단어 id 에 연결(L4) — 새 행을 보려면 기본 단어에 없는 표기 |
  | `task008-smoke.ts` | 단어 총수=내 단어 수 → 내 단어+기본 단어(약 7.8천); 커서 → `page`·`limit=7`+`total`·`pages`·`baseTotal`; `seed-pack` 동시 호출 → 404; `映画`·`映画祭` 보강 시험 표현 변경; 카운터 `WordEntry` 칸 → `UserWordState`; NO_WORDS(빈 단어장) → QA2 가 기본 단어를 `UserWordState(archived)` 로 모두 보관(상태 약 7.8천 행 만들고 바로 지움) | #40·#46b·#47 개정 (D1·D6·L2·L7) |
  | `task010-smoke.ts` 6 | 레슨 조각 `chunks[0]`·`[1]`·보강 `天気予報` → 기본 단어에 없는 조각·보강 `宇宙船`(실행 때 DB 로 골라냄) | 기본 단어에 있는 표현은 메모하면 `IN_WORDBOOK` 이라 조각 제안·보강(ENRICH)을 못 본다 |
  | `task011-smoke.ts` 1d | QA2 단어 수 = `wordEntry.count({userId, archived:false})` → 내 단어+기본 단어(내가 안 보관) 로 계산, `<6` 일 때만 NOT_ENOUGH_WORDS 분기 | QA2 도 기본 단어를 보므로 보통 이 분기는 건너뜀 |
  | `p2c-qa/b-eval-voice.ts` E0 (이번에 고침) | 단어 5개(`駅`·`出口`·`注文`·`右`·`左`) `POST /words` 성공 수 `made >= 4` → `내 단어+기본 단어 >= 4` (`made` 는 로그만) | 5개 모두 기본 단어(시드로 확인)라 등록이 409 `BASE_DUPLICATE` 로 거절되는 게 정상 — 평가 재료는 기본 단어가 채운다 |

  **B. 바꾸지 않았지만 QA 가 확인할 것 (판단 애매·실행 못 해 본 것)**

  | 파일·항목 | 왜 안 바꿨나 / 무엇을 확인 |
  |---|---|
  | **`task010-ui-e2e.mjs` 4k·4k2·4m(실패 예상)** | 메모 단어 `ちゅうもん`(=注文)·`コーヒー`·`冷たい` 가 **기본 단어**(시드 JSON 으로 확인; `いらっしゃいませ`·`持ち帰ります` 는 아님). 그래서 ① 4k 의 「단어 제안 · 대화 n번째 줄」 카드와 「사전에 싣는 모양으로 바꿨어요」 안내가 사라진다(`memoChanged` 는 **제안 카드에만** 나옴) ② 4k2 「이미 단어장에 있어요」 `=== 1` → 3줄(`SKIP_REASON` 은 건너뛴 단어마다 한 줄) ③ 4m 첫 「단어장에 추가」는 LLM 보강(A10) 제안 `いらっしゃいませ` 뿐이라 흔들릴 수 있음. 고치려면 **픽스처에 1구간 줄의 기본 단어에 없는 조각을 하나 넣고 메모 단어를 바꿔야 해서**(4/5 칩 수·4m2 「대화 6번째 줄」과 얽힘) 실행해 보지 않고는 안전하게 못 고친다 — 실행 가능한 환경에서 QA/Developer 가 같이 정리 |
  | `task012b-smoke.ts` phaseEval | `駅`·`予約`·`注文`·`静か` POST 4개가 전부 기본 단어 → 409 로 무시됨(응답 단언 없음, 정리는 `userId`+분류). TALK 출제(A6) 200 이 나오는지만 확인 |
  | `task012-smoke.ts`·`task010b-smoke.ts` | 분류(`WORD_CATEGORY`) 한정 세트라 풀이 내 단어뿐 — 결과 같음. 정리(`userId` 조건)가 기본 단어를 안 건드림 |
  | `task042-smoke.ts`·`task056-phrase-help-smoke.ts` | 주제 카드는 `wordId null`(`topicSet.ts` 가 단어장 테이블을 안 씀 — 코드 확인), 단어 수 비교는 `userId` 기준 |
  | `task044-screens.ts`·`p2a-qa/task044-screens-x.ts` | `/api/v1/words/categories` 목킹 모양이 계약 #46 그대로라 수정 불필요 (화면이 `/api/v1/words` 목록을 새로 부르면 목킹이 필요한지는 U1 화면 시험이 정함) |
  | `task039-qa/adopt-check.ts` | `addWord` 표기 `行きました(qa039)` 는 기본 단어가 아니라 WordEntry +1 그대로. 기본 단어 표기를 채택하면 +0 이고 `savedWordId`=기본 단어 id(L4) |
  | `p2b-qa/challenge-today-live-ui.ts` D10 | 「단어장에 넣기」 → `WordEntry +1`: A12 가 낸 새 단어가 기본 단어와 같은 표기면 새 행이 안 생길 수 있다(#41 동작은 S-B1 확인) |
  | `task039-qa/cleanup.ts`·`p2b-qa/final-clean.ts` | `userId` 조건이라 기본 단어는 안전. 다만 QA 가 **카테고리 없이** 기본 단어를 세트로 푼 뒤 남는 `UserWordState` 는 정리 대상이 아님(`task008-smoke` 는 자체 정리) — 필요하면 `userWordState.deleteMany({userId, createdAt>=SINCE})` 한 줄 |
  | 오늘의 단어 풀 크기 의존 | 세트 생성 쿼리 모양이 바뀜(풀 4칸 SELECT + 상태 한 번 + 카드 ≤30 PK) — **QA Q10 에서 세트 생성 시간 재측정**(task-057 72ms 기준), 평가 재료(#65)도 풀 약 7.8천 + 상태 한 번 |

  **C. 변이 확인 (전용 미러 사본만 깸 → 시험 → NFS 원본 `cp` 복구 → `cmp` 일치, 하네스 = 스크래치패드 `mut.mjs`, 변이마다 learning·conversation 시험 전체)**

  | # | 변이 | 결과 (잡은 시험) |
  |---|---|---|
  | ① | 세트 풀 보관 필터 제거(`activeWordWhere`→`visibleWordWhere`) | 잡힘 2 — T28 풀 · T28 빈 풀 |
  | ② | 세트 풀에서 기본 단어 제외(`userId` 만) | 잡힘 3 — T28 풀 · 풀 가중 상태 · 기본 단어 끝내기 |
  | ③ | 끝내기 카운터를 `WordEntry` 상태 칸에 씀 | 잡힘 2 — T28 끝내기 · #51 혼합 세트 끝내기 |
  | ④ | `bumpWordStates` 가 기본 단어 제외(`wordState.ts`) | 잡힘 2 — T28 끝내기 · bumpWordStates 단위 |
  | ⑤ | 빈 풀 `cta` 에 `SEED_PACK` 되살림 | 잡힘 1 — T28 빈 풀 |
  | ⑥ | 평가 재료 풀에서 기본 단어 제외 | 잡힘 3 — #65 재료 풀 · 많이 틀린 순 · NOT_ENOUGH_WORDS |
  | ⑦ | `wordbookMatches` 에서 기본 단어 제외 | 잡힘 2 — #62a 연결 · #62a 순서 |
  | ⑧ | `reviewWordReadWhere` 내 단어만 | 잡힘 1 — #63 읽기 범위 |
  | ⑨ | drawer `savedWord` 에서 기본 단어 제외 | 잡힘 1 — T30 |
  | 보조 X5~X12 | 이중 쓰기(bump+옛 카운터)·상태 로더가 남의 상태 읽음·drawer 가 남의 단어 노출·`isBaseWord` 가 `SEED` 안 봄·`wordbookOrder` 역전·`visibleWordWhere` 가 비SEED 주인 없음 포함·`notArchivedBy` 가 남의 보관 포함·평가 재료 오답 정렬 제거 | **전부 잡힘** |
  | 보조 X1~X4(보강 전 **못 잡음 4건**) | ⓐ 분류 세트의 분류 후보에서 기본 단어 제외 ⓑ 주제 세트 뜻 보기 재료 ⓒ 다시 풀기(주제) 뜻 보기 재료 ⓓ 다시 풀기(단어) 뜻 보기 재료 — 각각 「기본 단어 제외」와 「보관 필터만 제거」(ⓑⓒⓓ 는 X2b·X3b·X4b) | 시험이 비어 있어 보강 → 보강 후 **7건(X1~X4·X2b~X4b) 전부 잡힘** |

  **보강한 단언(`task059CardFirst.test.ts` +4건, 정상 코드 통과 확인)**: ① `T28 분류 세트` — 분류 이름이 기본 단어 분류(`초보자 (N5)`)와 같으면 기본 단어가 후보(보관한 w1 제외), 내 분류는 내 단어 m1 만 ② `T28 주제 세트 뜻 보기 재료` — 주제 풀 뜻 2개뿐이어도 기본 단어 뜻으로 보기 4개, 기본 단어 5개를 보관하면(남은 서로 다른 뜻 3개) 보기 없음 ③ `T28 다시 풀기(주제 세트)` — 같은 규칙(열림 → 보기 4개 / 5개 보관 → 보기 없음) ④ `T28 다시 풀기(단어 세트)` — 모든 단어가 기본 단어여도 보기 4개, 3개 보관하면 보기 없음·카드 5장은 그대로(카드는 보관 무시 규칙). 동등 변이(분류 풀 `inCategory` 에서 보관 필터만 빼기)는 `active ∩ inCategory` 라 결과가 같아 시험으로 가를 수 없음 — 일부러 안 건드림.
  - **남은 위험**: ① `task010-ui-e2e.mjs`(위 B 첫 줄)는 실행 환경 없이 고치지 않았다 — 실행하면 4k·4k2 가 실패할 것으로 예상 ② `tests/live/*` 는 전부 **한 번도 실행하지 않았다**(스키마 push·기본 단어 시드 전엔 실행 불가) ③ `loadActiveWordStates` 가 `sessions.ts` 에서 export 된다(S-B1 이 `wordState.ts` 로 옮겨도 동작 같음) ④ 레슨 메모 제안 페이로드에 `chunkType` 이 안 실리는 것(위 13:55 항목)은 Leader 결정 대기 그대로.
  - **미커밋 파일(이번 마무리 변경)**: `src/modules/learning/__tests__/task010.test.ts`(+`chunkType: null` 1칸) · `src/modules/learning/__tests__/task059CardFirst.test.ts`(+4건) · `tests/live/p2c-qa/b-eval-voice.ts`(E0) · 이 기록 파일. (그 앞의 S-B2 소유 파일·`tests/live` 5개 변경은 이전 developer 분 그대로 미커밋.)

## [감사 B 수정] REV-068B-1·2·3 (2026-10-14 14:2x, developer — 좁은 수정)

- **REV-068B-1 (Medium)**: `evaluation/materials.ts` — 풀 자르기(`slice(0, POOL_MAX=2,000)`)와 `POOL_MAX` 상수를 **삭제**. 앞 정렬(`wrongCount desc, id asc`)도 함께 뺐다 — 자르기가 없으면 아무 일도 안 하고, `pickEvalMaterials` 가 어차피 id 순으로 다시 세우므로 결과가 같다. 풀 = 보이고 내가 보관 안 한 단어 **전체**(내 단어 + 기본 단어)가 `pickEvalMaterials` 로 간다. `wordCount` 는 자르기가 없으니 `pool.length` = 실제 길이(= trace 메타 정확). `pickEvalMaterials` 선택 로직(14일 표기 ×0.1·가중·마지막 오답 내림차순)은 **바꾸지 않았다**.
- **REV-068B-2 (시험 틈)**: `task068SB2.test.ts` +3건 — ① 기본 단어 2,500 + 내 새 단어 3(오답 0, id 가 더 큼) 풀에서 `pickEvalMaterials` **입력 풀 길이 = 2,503** 이고 `m1·m2·m3` 가 후보에 있다 + `wordCount = 2,503` + 재료 ≤15 ② 같은 큰 풀에서 내가 보관한 기본 단어는 풀에서 빠지고, 풀에 붙은 오답 수는 나의 것(내 `m2`=4·기본 `b00002`=3·user-b 의 9 → 0)이고 재료는 오답 내림차순 ③ 이동한 `loadActiveWordStates` 단위(보관한 행·남의 행 제외, 행 없는 단어는 맵에 없음, 빈 상태 → 빈 맵). 입력 풀을 엿보려고 `loadEvaluationMaterials` 에 **시험 주입용 마지막 인자 `pick = pickEvalMaterials`** 를 더했다(기본값이라 호출처 `evaluations/route.ts` 영향 없음, `db` 가 이미 시험용 주입인 것과 같은 방식).
- **REV-068B-3 (Low)**: `loadActiveWordStates` 를 `vocab/sessions.ts` → `vocab/wordState.ts` 로 이동(본문 동일 — `STATE_SELECT` 재사용만 다름, 같은 칸 7개). re-export 없이 호출처 2곳(`sessions.ts` import 갱신·`evaluation/materials.ts` import 를 `../vocab/wordState` 로) 모두 고침. `grep -rn loadActiveWordStates src` = 정의 1 + 사용 2 + 주석·시험. 세트/평가 시험의 import 는 깨지지 않았다(이 함수를 직접 import 하던 시험은 없었다).
- **변이 3건 + 1(미러 `~/.node-local/thekaiwa-dev068e` 에서만, 매번 NFS 원본을 덮어 원복하고 마지막에 4파일 `cmp` 동일)**:

  | 변이 | 결과 |
  |---|---|
  | M1a 풀을 `.slice(0, 2_000)` 으로 되살림(옛 모양) | **잡힘 2** — 풀 길이/후보 단언·큰 풀 오답/보관 단언 |
  | M1b `pick(pool.slice(0, 2_000), …)` — `wordCount` 는 그대로(풀 자르기를 `wordCount` 가 가리는 변형) | **잡힘 2** — 입력 풀 길이를 직접 보기 때문에 잡힌다 |
  | M2 `wordCount: Math.min(pool.length, 2_000)` | **잡힘 2** |
  | M3 이동한 `loadActiveWordStates` 에서 `userId` 조건 제거 | **잡힘 4** — T28 풀 가중 상태·#65 많이 틀린 순(남의 기록)·큰 풀 시험·`loadActiveWordStates` 단위 |

- **실행 증빙(미러 전용)**: `tsc --noEmit` 0 오류 · `eslint`(materials·wordState·sessions·task068SB2.test) 0 · `learning/__tests__/*.test.ts` 전체 523건 중 522 통과 0 실패(1건은 skip/todo) · `task068SB2`(9건)·`task059CardFirst`·`task011`·`topicVisibility`·`task068WordState` 통과.
- ⚠ **트러블슈팅**: 합본 게이트 미러 `thekaiwa-rev068` 를 `cp -al` 한 `thekaiwa-dev068e` 의 `node_modules/.prisma/client` 가 **옛 스키마(10-13 21:07, `UserWordState` 없음)** 였다 — `tsc` 가 `userWordState`·`seedKey`·`EXPRESSION` 에서 100여 줄 실패. 원본 `rev068` 의 클라이언트는 그 뒤(14:02)에 새로 생성된 것이라 복사 시점에 따라 옛 것이 걸릴 수 있다. 고침: 내 미러의 `.prisma/client`(링크 수 1, 공유 아님)만 지우고 `rev068` 의 것을 `cp -a` — `prisma generate`·DB 접속 없음. 다음에 `cp -al` 하는 쪽은 `grep -c UserWordState node_modules/.prisma/client/index.d.ts` 로 먼저 확인할 것.
- **Leader 확인 필요**: 풀 자르기를 없앤 뒤에도 `pickEvalMaterials` 에는 **내 단어를 먼저 고르는 규칙이 없다**(`EvalMaterialWord` 에 `userId` 칸이 없고 가중은 `weightOf`(오답·정답·최근성)뿐 — 읽어서 확인). 오답 0 인 내 새 단어는 기본 단어와 같은 가중(둘 다 미노출 2.0)이라, 보이는 단어가 7.8천이면 재료 ≤15개 중 내 단어가 들어올 기대 개수 ≈ 15 × N/(N+7,757) — 내 단어 20개면 평가 1회당 약 0.04개(예전 풀이 내 단어뿐일 때는 대부분 내 단어). 이번 수정 범위(상한 제거·trace 정확성)에선 새 규칙을 만들지 않았다. 「내 단어 가중 ×N」·「내 단어 우선 쿼터」 같은 선택 규칙을 원하면 Leader 가 결정(사용자가 본 의미가 바뀌는 문제라 데모/가이드 확인 대상일 수 있음). `docs/design/api-contract.md` #65 에 풀 상한 2,000 언급은 grep 으로 찾지 못했다(문서 수정 없음).
- **미커밋 파일(이번 수정)**: `src/modules/learning/evaluation/materials.ts` · `src/modules/learning/vocab/wordState.ts` · `src/modules/learning/vocab/sessions.ts` · `src/modules/learning/__tests__/task068SB2.test.ts` · 이 기록 파일.

## [평가 수준 상한] 평가 재료(#65)에 오늘의 단어 세트와 같은 단계 천장 (2026-10-14 14:33, developer — 좁은 수정)

- **문제(Leader 가 코드로 확인)**: `pickEvalMaterials` 에는 세트(task-053)의 `levelFactor` 가중이 없었다. 풀이 사용자 N5 678개일 때는 안 보였지만 공용 기본 단어 7,757개(N5 676·N4 629·N3 1,649·N2 1,767·N1 3,034)로 커지면서 **N5 학습자의 평가 재료에 N1 이 약 39% 섞였다**(가중이 전부 같으면 기대값 ≈ 15 × 3,034/7,757).
- **결정(좁게)**: `evaluation/materials.ts` 만 고쳤다(`setGenerator.ts` 는 `levelFactor`·`ceilingOf`·`LEVEL_FACTOR_FLOOR`·`LevelCode` 가 이미 export 라 **건드리지 않음**). `weightOf`·최근 14일 ×0.1·오답 내림차순 정렬은 그대로.
  1. `pickEvalMaterials(pool, recentSurfaces, rng, now, max = 15, ceiling?: LevelCode | null)` — `ceiling` 이 있으면 가중에 `Math.max(levelFactor(w.jlpt, ceiling), LEVEL_FACTOR_FLOOR)` 를 곱한다(세트 `generateWordSet` 과 같은 식·같은 바닥값 `1e-9` → 천장 3단계 위는 사실상 0, 그래도 후보가 모자라면 **맨 마지막에만** 채운다). `ceiling` 이 없으면 분기(`ceiling ? … : base`)로 **곱셈 자체를 건너뛰어** 계산·난수 소비가 변경 전과 같다(후보에 `jlpt` 가 없으면 `levelFactor` 가 1 이라 값이 같다).
  2. `EvalMaterialWord` 에 `jlpt?: LevelCode | null`. 풀 SELECT 는 4칸 → **`jlpt` 1칸만 추가**(5칸). 프롬프트로 가는 재료는 라우트가 `{surface, reading, meaning, wrongCount}` 4칸만 골라 보내므로 `jlpt` 는 LLM 입력·trace 에 **새지 않는다**(`evaluations/route.ts` 확인).
  3. **천장 = `ceilingOf(level, goalLevel)`** — `level` = `input.level ?? 프로필 level`(이미 구하던 값), `goalLevel` = 프로필 목표 수준. 즉 **평가 수준과 목표 수준 중 어려운 쪽**(세트의 `levelCeilingFor` = 지금·목표 중 어려운 쪽과 같은 규칙, 단 평가는 사용자가 고른 평가 수준이 `level` 자리에 들어간다). 목표가 없으면 평가 수준. `jlpt` 가 null 인 단어(내 직접 입력)는 `levelFactor` 가 **계수 1**(단계 모르면 줄이지 않음)이라 불이익이 없다.
  4. **프로필은 한 번만 읽는다**: `profileOnce()`(메모이즈). `level` 을 안 준 요청은 전처럼 맨 앞에서 읽고 그 값을 `goalLevel` 에도 재사용, `level` 을 준 요청은 천장 때문에만 읽으므로 **주제(404)·단어 수(400) 검사 뒤**에 최근 문항 쿼리와 `Promise.all` 로 읽는다(검사에서 끝나는 요청에 읽기를 더하지 않고, 정상 요청은 왕복이 겹친다). `level` 을 준 요청에서 프로필 읽기가 **실패하면 평가 수준만으로 천장**을 잡고 평가는 만든다(천장은 부가 가중 — `levelCeilingFor` 와 같은 철학), `level` 을 안 준 요청은 전과 같이 실패한다.
  5. 시험 주입 자리 `readProfile: LevelReader = getProfile` 을 `loadEvaluationMaterials` 의 **마지막 인자**로 추가(`db`·`pick` 과 같은 방식, 기본값이라 `evaluations/route.ts` 호출 영향 없음). `LevelReader` 는 `vocab/sessions.ts` 의 기존 export 를 **타입으로만** import.
- **시험**(`learning/__tests__/task068SB2.test.ts`, 9 → 19건, 가짜 DB·`createRng` 고정 시드 50개 — 비결정 없음): ① 천장 없으면 변경 전과 같다 — 변경 전 알고리즘을 시험 안에 **참조 구현**으로 두고 목록·순서·**난수 소비(다음 rng() 값)** 가 `ceiling` 생략/null/undefined 모두 같음(+`jlpt` 칸이 없는 후보도) ② N5 천장 + N5 20 + N1 300: 50번 모두 N1 0개(대조: 천장 없으면 평균 > 12) ③ 점진적(N5 > N4 > N3 > N2, N2=0)·쉬운 단어 5개뿐이면 15개를 채우되 쉬운 5개는 반드시 포함 ④ N1 천장이면 N1 평균 > 12 ⑤ `jlpt` null/칸 없음 = N5 로 줬을 때와 **목록이 똑같다**(불이익 없음) ⑥ `loadEvaluationMaterials`→`pick` 에 넘긴 천장 5케이스(평가 N5·목표 N3→N3, 평가 N3·목표 N5→N3, 목표 없음→평가 수준, 같음, 목표 N1→N1) + 프로필은 사용자 id 로 **한 번만** ⑦ `level` 안 준 요청: 프로필 수준을 쓰고 같은 읽기 한 번으로 천장까지 ⑧ 읽기 실패 두 갈래 ⑨ 단어 수 부족이면 프로필 읽기 0 + SELECT 의 `jlpt` 가 `pick` 까지 간다 ⑩ end-to-end(기본 N5 20 + N1 300 + 내 단어 3): 30번 N1 0개, 내 단어는 들어온다. 기존 시험 5곳은 `PROFILE` 가짜 리더를 끼웠다(실제 `getProfile` 이 DB 를 치지 않게).
- **변이 6건**(미러 `~/.node-local/thekaiwa-dev068g` 사본만 깸 → `task068SB2`·`task011`·`topicVisibility`·`task051Homograph` 시험 → NFS 원본 `cp` 복구 → 매번 `cmp` 일치):

  | 변이 | 결과 (잡은 시험) |
  |---|---|
  | M1 천장 곱셈 제거(요청 ①) | **잡힘 4** — N5 천장 N1 0 · 점진 · null 불이익 없음 · end-to-end |
  | M2 `ceilingOf` 대신 `level` 만(요청 ②) | **잡힘 2** — 천장 5케이스 · 프로필 수준 경로 |
  | M3 SELECT 에서 `jlpt` 제거(요청 ③) | **잡힘 2** — SELECT→pick 단언 · end-to-end. ⚠ 처음엔 **end-to-end 가 못 잡았다**(결과의 `x.jlpt` 로 N1 을 세서 칸이 빠지면 0 으로 헛돎) → id 접두사로 세도록 고쳐 재실행 |
  | 보조 M4 `jlpt` null 을 N1 로 취급 | 잡힘 2 — null 불이익 없음 · end-to-end |
  | 보조 M5 목표 수준 무시(`ceilingOf(level, null)`) | 잡힘 2 — 천장 5케이스 · 프로필 수준 경로 |
  | 보조 M6 `pick` 에 `ceiling` 안 넘김 | 잡힘 4 |

- **실행 증빙(미러 `thekaiwa-dev068g`)**: `tsc --noEmit` 0 오류 · `eslint`(materials·task068SB2.test) 0 · `learning/__tests__/*.test.ts` 540건 중 539 통과·0 실패(1건 skip 은 기존) · `conversation/__tests__/*.test.ts` 1,103건 전부 통과(`evalGen`·`prompts` 포함) · 엔진명 grep `materials.ts` 0건. DB 접속·`prisma db push`·`.env` 읽기·git 조작·빌드·서버 기동 없음.
- **알려진 한계**: ① **내 단어 우선 규칙은 만들지 않았다**(Leader 결정 대기, 위 감사 B 항목 그대로) — 오답 0 인 내 단어(직접 입력은 `jlpt` null 이라 계수 1)의 뽑힐 확률은 풀 크기에 비례해 낮다. ② 천장은 세트와 같은 계수(위 1단계 ×0.3·2단계 ×0.05·3단계↑ 0)라 **N5 학습자 평가에도 N4·N3 가 섞인다** — 실제 풀(N5 676·N4 629·N3 1,649)과 미노출 가중이 같다고 하고 **계산한 기대 비율**은 N5 ≈ 71%·N4 ≈ 20%·N3 ≈ 9%(15개 중 약 10.7·3.0·1.3개, 실측 아님; N2·N1 ≈ 0). 목표 수준이 N3 이상이면 그만큼 천장이 올라간다. ③ 평가 수준(`input.level`)과 프로필 수준이 달라도 천장은 평가 수준과 **목표** 수준만 본다(프로필 지금 수준은 `level` 을 안 준 요청에서만 평가 수준이 된다). ④ `level` 을 준 요청도 이제 `getProfile`(upsert)을 부른다 — 프로필 행이 없던 사용자는 이때 기본값 행이 생긴다(`level` 을 안 준 요청과 세트 생성 `levelCeilingFor` 가 이미 하던 일). ⑤ 평가 출제 한 번에 **왕복 +1**(최근 문항 쿼리와 겹쳐 지연은 거의 없음), 풀 SELECT 에 `jlpt` 1칸(7.8천 행).
- ⚠ **트러블슈팅(미러 만들기)**: Leader 지시문의 `mv node_modules/.prisma node_modules/.prisma.shared && cp -a …` 는 `thekaiwa-rev068` 에 **`.prisma.shared` 가 이미 있어서**(10-10 에 만든 옛 사본) `.prisma` 가 그 디렉토리 **안으로** 들어갔고, `cp -a .prisma.shared .prisma` 는 옛 스키마(10-13 21:07, `UserWordState` 0)를 복사했다. 고침: 내 미러의 `node_modules/.prisma` 만 지우고 `thekaiwa-rev068/node_modules/.prisma` 를 `cp -a` → `grep -c UserWordState …/index.d.ts` = 724, 링크 수 1(공유 아님). 다음에 복사하는 쪽은 `ls -d node_modules/.prisma.shared` 가 이미 있는지 먼저 볼 것.
- **미커밋 파일(이번 수정)**: `src/modules/learning/evaluation/materials.ts` · `src/modules/learning/__tests__/task068SB2.test.ts`(task-068 신규 파일이라 git 에는 untracked) · 이 기록 파일. `setGenerator.ts`·`seedCopyMigration.ts`·`scripts/migrate-seed-copies.ts` 는 건드리지 않았다.
