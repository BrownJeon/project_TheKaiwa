---
tags: [type/task-note, domain/vocab]
---
# task-068 QA-W3 기록 — 오늘의 단어 세트·학습 상태 갱신·성능·기존 라이브 스모크 (실제 DB)

이력서: [[task-068-improve-wordbook]] · 감사 인계: [[task-068-rev-b-record]] · 같은 라운드 다른 레인: [[task-068-qa-w2-record]]
환경: 검증 서버 127.0.0.1:3011 (BUILD_ID `6AsaTjChU7esylTbQXz_I`, 공유 NAS DB, 기본 단어 7,757행 = N5 678 / N4 629 / N3 1,649 / N2 1,767 / N1 3,034). 내 계정 QA4(`qa-bot4`, 프로필 N5·목표 없음·dailyWordCount 10). QA3 는 읽기 전용(W2 가 주 사용 — 시작 시 QA3 내 단어 8개·상태 0).
시작 상태(QA4): 내 단어 0 · 상태 행 0 · 세트 0 · StudyLog 0.
작업 폴더: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/q068/w3/` (`sessions.jsonl`·`archived.jsonl` 에 만든 세트·보관 id 기록)

## 진행 기록 (항목마다 바로 append)

### A. 세트 생성 시간 (Q10) — PASS (회귀 없음, 단 꼬리가 길다 — 기존 NAS COMMIT 특성)
- QA4 로 `POST /api/v1/vocab/sessions {count:10}` **10회**(매회 직후 `finish` 로 ABANDONED 시켜 다음 생성 가능하게 함 — 답한 카드 0 → 기록·카운터 변화 0). 전부 200, `mode:"FLIP"`·`downgraded:false`·카드 10장·**10장 모두 `choices` 4개와 `meaning` 포함**.
- 전체 응답 시간(ms): 283 / 1,393 / 1,481 / 3,604 / 3,057 / 4,442 / 1,147 / 5,370 / 2,996 / 2,309 → **p50 2,309 · p95 5,370 · 최소 283 · 최대 5,370 · 평균 2,608** (n=10, p95 는 사실상 최대값).
- 기준 대조: task-057 의 「72ms」는 **풀 조회 구간 하나**이고 전체 함수는 p50 2,035~2,635ms(task-051/053 QA 2,035~2,652, task-057 격리 1.5~1.8초·꼬리 2.6~5초)로 **COMMIT 이 70~75%** 였다. 지금의 전체 p50 2.3초·꼬리 5.4초는 그 범위 안 [확실]. 새 구조(풀 7,757 + 내 상태 한 번)로 **눈에 띄는 회귀는 없다**.
- 풀 조회 구간만 따로(서버 밖 프리즈마 스크립트, 서버와 같은 where·select = `activeWordWhere`·`POOL_SELECT`, 12회 중 워밍업 2회 제외): **p50 32ms · 최대 44ms · 최소 31ms**, 상태 조회(`UserWordState`, 0행) 1ms. task-057 의 72ms(DB 29 + 매핑 43) 보다 빠르다 — 단 서버 안 구간 계측이 아니라 같은 쿼리를 별도 프로세스에서 잰 값 [가능성 높음].
- 같은 세트의 `finish`(ABANDONED) 도 1,016~3,917ms(쓰기 COMMIT 특성, 이번 변경과 무관).
- 서버 로그 구간: 서버 로그 파일 위치 미확인(Leader 가 띄운 프로세스) — 구간 로그는 얻지 못했다(`NOT_VERIFIED`).

### B. 풀 범위·수준 가중·보관 제외 — PASS (보관 제외 통계 확인은 약한 증거, 결정적 시험은 DB 픽스처로 보강)
- **수준 가중** (프로필 N5·목표 없음 → 천장 N5: N5 ×1 · N4 ×0.3 · N3 ×0.05 · N2/N1 ×0): 기본 팩 비율(678/629/1,649/1,767/3,034)로 계산한 기대 비율 N5 71% · N4 20% · N3 9% · N2·N1 ≈ 0. 실측 ①10세트×10장=100장: **N5 75 · N4 17 · N3 8 · N2 0 · N1 0** ②10세트×30장=300장: **N5 202 · N4 67 · N3 31 · N2 0 · N1 0**(67/22/10%) → N1·N2 0장, N5·N4 합 91~92%, 기대와 일치 [확실]. 풀이 기본 단어 7,757 중 약 4분의 3이 N2·N1 인데도 카드에 한 장도 안 나온다.
- **기본 단어가 카드로 나오는가**: 100장 전부 `userId NULL ∧ source SEED ∧ seedKey 있음`(DB 대조), 카드 `surface` 와 시드 단어 `surface` 불일치 0, 카드 `wordId` 가 없는 단어 0 [확실]. 100장 중 서로 다른 단어 97.
- **보관한 기본 단어 제외 (통계)**: QA4 가 API 로 N5 기본 단어 10개(明るい・暖かい・頭・あまり・飴・忙しい・生まれる・映画・起きる・お祖父さん)를 보관 → 목록 `archived=1` total 10 확인 → 그 뒤 **count=30 세트 10개(300장)** 생성: 보관 단어 등장 **0회**. 필터가 없었다면 기대 등장 ≈ 3.2회(N5 한 장당 확률 ≈ 30/949)이므로 우연히 0 일 확률은 약 4% — **통계적 확인이지 증명이 아니다**.
- **보관 제외 (결정적, DB 픽스처)**: 카테고리 「초보자 (N5)」(678개) 중 8개(会う・青・青い・赤・赤い・秋・開く・開ける)만 남기고 나머지 670개를 QA4 의 보관 상태로 둔 뒤(API 로 보관한 10개 + `UserWordState` 660행 직접 삽입 — QA4 한정, 끝나고 668행 삭제 확인) `category` 지정 세트 생성: count 5 → 5장, count 5 → 5장, count 8 → 8장, count 10 → **8장(요청 10, 풀 8)** 전부 남긴 8개 안·중복 0·`mode FLIP`·카드 `choices` 4개 있음. 8개마저 보관하면 `200 {session:null, empty:{reason:'NO_WORDS_IN_CATEGORY', cta:['ALL_CATEGORIES','ADD_WORD']}}` [확실]. (계약 #47: 난이도 이름 분류도 `category` 로 받는다 — 일치.)
- 정리: 픽스처 행 668개 삭제, API 보관 10개 `unarchive` 10/10 성공(`archived:false`) → 목록 `archived=1` total 0. QA4 의 `UserWordState` 행이 보관 해제 뒤에도 10개(0·0·null·archived=false) 남는다 — 마지막 정리에서 지움.

### C. 학습 상태 갱신·격리·멱등 — PASS
- 세트 S1(`cmv7r5zx100f9w12eyi5fj0b5`, 10장 FLIP): 카드 0~3 보기 정답(`chosenText`) · 4·5 보기 오답 · 6 자기 채점 틀림 · 7 자기 채점 맞힘 · 8 건너뜀 · 9 안 답함 → 각 `attempts` 응답 `answer` 가 기대(CORRECT/WRONG/SKIPPED)와 일치, `finish` 200: `correctCount 5 · wrongCount 3 · skippedCount 2`, `wrongWords` 3개, `studyLogId` 있음.
- **QA4 의 `UserWordState`** (DB 직접 읽음): 맞힌 5단어 `correct 1/wrong 0/lastResult CORRECT` · 틀린 3단어 `0/1/WRONG` · 건너뜀 2단어(8번, 안 답한 9번) `0/0/lastResult SKIPPED` — 계약(E5 맞힘·틀림 +1, 건너뜀은 `lastSeenAt`·`lastResult` 만)과 일치 [확실]. API 쪽도 `GET /api/v1/words/:id` 가 같은 값.
- **공용 행 불변**: 같은 10개 `WordEntry`(기본 단어) 행의 `correctCount/wrongCount/lastSeenAt/lastResult` 가 전부 0·null 그대로 — 공용 행에 쓰지 않는다 [확실].
- **다른 계정 격리**: QA3 의 같은 10단어 상세 = `0/0/null/archived false`, QA3 의 `UserWordState` 행 중 이 10단어 분 0행(QA3 전체 상태 행 수 1 → 1, 내 시험으로는 안 늘었다). QA3 `sort=wrong` 1쪽의 오답 수는 전부 0 이고 QA4 의 틀린 단어가 앞에 오지 않음.
- **기록**: QA4 `StudyLog(type WORDS)` 0 → 1(`result {correct 5, wrong 3, skipped 2, cardCount 10, durationSec 24}`), `StatsSnapshot` 0 → 2(`DAILY 2026-10-14` words.sessions 1/correct 5/wrong 3 + `VOCAB_SESSION` periodKey=세트 id).
- **오답순 정렬**: QA4 `GET /api/v1/words?sort=wrong&limit=7&page=1` 상위 3개가 방금 틀린 3단어(テープ・乗る・一月, wrongCount 1)이고 2쪽 첫 오답 수는 전부 0 — 나의 오답 우선 정렬 정상 [확실]. 응답 180ms.
- **같은 세트 두 번 끝내기(직렬)**: S1 에 `finish` 를 2번 더 → 모두 200·`DONE`·같은 집계, 상태 합계 correct 5 / wrong 3 그대로(+1 한 번), StudyLog 1·스냅샷 2 그대로 [확실].
- **동시에 끝내기**: 세트 S2(`count 6`, 보기 맞힘 2·틀림 2 후) 에 `finish` **4건 동시** → 전부 200·`DONE`·`2/2`(소요 4.4~5.9초), 답한 4단어 상태가 **각각 정확히 +1 한 번**, `StudyLog(WORDS)` 합계 1 → 2(세트당 1), `VOCAB_SESSION` 스냅샷 해당 세트 1행, DAILY `words {sessions 2, correct 7, wrong 5}` 누적이 맞음. 같은 `order` 를 병렬 3번 다시 보내면 3건 모두 첫 결과(CORRECT) 유지. `DONE` 뒤 답 보내기 409.
- 소요: 생성 2,352ms · S1 `finish` 5,081ms(동시 4건은 4.4~5.9초) — 쓰기 COMMIT 구간, 이번 변경 이전과 같은 성격.
- 만든 세트: S1·S2 (둘 다 DONE, 지울 길 없음 — 아래 정리).

### D. 내 단어 + 세트·삭제 정책 — PASS
- QA4 가 내 단어 3개 생성(試験甲/乙/丙QA068 — 조각 NAME・ACTION・EXPRESSION, 분류 `qa068w3`): 전부 200 `saved:true`·`origin MINE`·`readOnly false`. 목록 `source=mine` total 3, 전체 total 7,760(= 7,757 + 3), `baseTotal` 7,757 불변.
- **세트 풀에 들어가는가 (결정적)**: `category:'qa068w3'` 세트 → 카드 3장 = 내 단어 3개(풀 3 <4 라 `mode FLIP`·`downgraded:false`·`choices` 키 없음·`meaning` 있음 — 계약과 일치).
- **세트 풀에 들어가는가 (확률)**: 분류 없이 count 30 세트 10개(300장) → 내 단어가 **3번 나옴(甲・丙・乙 각 1번)** — 풀 ≈ 952 가중에서 한 단어가 한 세트에 뽑힐 확률 ≈ 3% 이니 기대 ≈ 1번 (3번은 포아송 기준 꼬리 ≈ 8%, 편향을 의심할 수준은 아님 [추측]; 내 단어의 `jlpt` 가 null 이라 수준 계수 1(= N5 와 같음)). 내 단어가 기본 단어와 같은 가중으로 풀에 섞인다 [확실].
- **삭제 정책** (분류 세트를 다시 만들어 甲 맞힘・乙 틀림・丙 맞힘으로 풀고 `finish` → DONE `2/1/0`, `wrongWords` = 乙 한 줄 `source WORD`): 乙·甲 삭제 → 둘 다 200 `{deleted:true, snapshotKept:true}`.
  - 삭제 전후 세트 상세(#49): 카드 3장이 **`surface`・정답(`correctText`)・`answer` 그대로**, 지운 두 카드만 `wordId null`(DB `VocabAttempt.wordId` 도 null, `surfaceSnap` 보존).
  - `StatsSnapshot`(그 세트의 `VOCAB_SESSION` + `DAILY`) 데이터 문자열 삭제 전후 **동일**, `GET /vocab/stats?days=30` 응답 **동일**, `StudyLog` 수 불변(3).
  - `UserWordState`: 내 단어 3개 분 3행 → 乙・甲 삭제 후 **1행**(丙) — cascade 로 상태가 함께 지워짐 [확실].
  - **보관→다시 풀기**: 그 세트 `keep` 200(`keptAt` 있음) → `replay` 200·`replayOfId` 일치·`mode FLIP`·카드 3장(지운 乙・甲은 `wordId null` 스냅샷 카드로 `surface`・`meaning` 유지, 丙은 id)·**3장 모두 `choices` 4개**(기본 단어가 보기 재료를 채움) → replay 세트는 ABANDONED 로 닫고 보관 해제.
- 정리: 나머지 丙 삭제 200 → `source=mine` total 0, DB 내 단어 행 0. (乙・甲 재삭제는 404 — 이미 삭제됨 확인)

### E. 오늘 탭(/study/today) GET 시간 — 기록 (판정 기준 없음, UI 는 W1)
- QA4 쿠키 `fetch` 8회씩, 로컬 127.0.0.1:3011 (단위 ms, p50/p95): 페이지 HTML `/study/today` **9 / 26**(25.6KB, 200) · `words/categories` **23 / 28** · `vocab/sessions?limit=10` **6 / 7**(3.7KB) · `vocab/sessions?kept=1&limit=5` **3 / 5** · `vocab/stats?days=30` **3 / 4** · 참고 단어장 탭 `words?limit=7` **99 / 100**(3.7KB — 기본 단어 7.8천 + 오프셋 정렬 쿼리).
- `lessons/today`(오늘 탭이 부르는 회화 카드)는 LLM 부작용 가능성이 있어 부르지 않았다(`NOT_VERIFIED`, 단어 범위 밖).

### F. 기존 라이브 스모크 — 진행 중 (1차 실행 중단 → 사본 패치 후 2차)
- 대상 선정: `git diff --stat -- tests/live` 변경 6개(README·`p2c-qa/b-eval-voice.ts`·`task006-smoke.ts`·`task008-smoke.ts`·`task010-smoke.ts`·`task011-smoke.ts`) 중 AI 를 안 부르는 것은 **`task008-smoke.ts` 뿐**(006=채팅 턴 약 16회·010=A4·011=A6/A7·b-eval-voice=평가 모두 Claude CLI 호출 → 미실행). `task010-ui-e2e.mjs` 미실행(지시).
- **실행 방법 편차(솔직히)**: `task008-smoke.sh` 는 ① `sync-local.sh`(= 다른 미러 `~/.node-local/thekaiwa` 를 건드림) 를 부르고 ② 계정이 `qa-bot`(QA1)·`qa-bot2`(QA2) 로 하드코딩돼 있고 시작·끝에 그 두 계정 데이터를 **전부 지운다**(W2 가 QA1·QA3 사용 중). 그래서 `.sh` 는 쓰지 않고 `.ts` 사본을 스크래치패드에 두고(`node_modules` 는 검증 미러로 심볼릭 링크) **이메일 상수 3곳만** `qa-bot4`(= 내 QA4) / `qa-developer`(두 번째 계정 — IDOR 용, 이 레인 밖 사용자와 겹치지 않음)로 바꿔 실행했다. 다른 변경 없음(diff 로 확인: 113·114·524행). 서버 3011, 쿠키는 `qa-session.ts` 로 발급.
- LLM 호출: 11a(映画祭)·11b(안녕하세요) 2회. 11c(コーヒー)는 409 라 LLM 없음. 시작 전·후 `claude --print` 프로세스 없음 확인.
- 3차 실행(`f3-smoke.log`, 사본·qa-bot4/qa-developer) 결과 **73/80 PASS, 실패 7건**(로그에 `FAIL 8h`·`FAIL 3b` 가 요약 직전에 한 번 더 찍혀 `grep ^FAIL` 은 줄이 겹쳐 보일 뿐 서로 다른 항목은 7개). 분류는 아래 [마무리 F].

### [마무리 F] 기존 라이브 스모크 실패 7건 분류 + QA4 정리 (QA-W3 마무리, 2026-10-14) — **LLM 호출 0, 스모크 재실행 없음, 소스·시험·스모크 파일 수정 없음**
- 방법: `f3-smoke.log` 의 FAIL 7줄 ↔ `tests/live/task008-smoke.ts`(저장소 파일, 사본과 이메일·청크 삽입 3곳만 다름) 단언 ↔ 현재 제품 코드·이력(`git log`·`08c9eb2` task-059 커밋·`api-contract.md` #53/#46b)·단위 시험을 대조. 모호한 곳은 QA4 에 **읽기·무기록 쓰기만**(세트 2개를 만들고 0장 답으로 ABANDONED, 풀 조회, 폐지 라우트 호출, 보강 호출 1회 = 기본 단어 중복이라 LLM 없이 409) 다시 재현했다.
- **핵심 사실 [확실]**: ① 기본 `mode` 가 task-059(2026-10-12, 커밋 `08c9eb2`)에서 CHOICE → **FLIP(카드 우선)** 으로 바뀌었다 — `sessions.ts:281`·`:306`(`mode ?? 'FLIP'`), 다시 풀기도 늘 `FLIP`+`flipChoices`(`sessions.ts:915~959`), 계약 #53 「원래 CHOICE 였던 보관 세트를 다시 풀어도 새 세트는 카드 우선(task-059 D6 A)」. ② 그 커밋은 `tests/live/*` 를 **한 파일도 안 바꿨다**(`git show --stat 08c9eb2 | grep -c tests/live` = 0)이고, 이 스모크의 마지막 기록된 실행은 task-036/037(77/77)·task-023(77/77)로 task-059 **이전**이다 — 즉 CHOICE 가정 5건은 task-068 과 무관하게 이미 어긋나 있었다. ③ task-068 diff 는 mode 기본값·replay 로직을 건드리지 않았다(`git diff HEAD -- sessions.ts | grep mode` 의 변경은 주석 1줄·`cards` 변수명뿐).

| # | 스모크 항목 (저장소 파일:줄) | 분류 | 근거 (현재 동작) |
|---|---|---|---|
| 1 | 11c 가타카나 표현 보강 (`:126-127`) | **(나)** | `コーヒー` 는 기본 단어(`userId NULL`, N5)라 보강 전에 `409 CONFLICT details.code=BASE_DUPLICATE`·`existingId=cmv7qro0…`(재현: 8ms, LLM 0). 계약 D9(기본 단어 표기 중복은 보강 전 409) 그대로 — 11g(映画)가 같은 동작을 PASS 로 이미 증명 |
| 2 | 2e #46b 폐지 → 404 (`:159-161`) | **(나)** + 문서 Low | `POST /api/v1/words/seed-pack` = **405**(본문 빈 문자열). 라우트 파일이 삭제돼 `words/[id]` 동적 라우트가 `seed-pack` 을 id 로 받는데 거기엔 POST 가 없어 Next 가 405. `GET` 은 404 `NOT_FOUND`. 옛 탭 호출이 실패한다는 의도는 충족 — 계약 #46b 의 「옛 탭 호출은 404」 문구와만 다름(QA068W3-1) |
| 3 | 3a 진행 중 CHOICE 미답 카드 (`:263`·`:270`) | **(가)** | S10 세트를 `mode` 없이 만들어 FLIP(기본). **명시 CHOICE 로 재현**: `{count:30, mode:'CHOICE'}` → `mode CHOICE`·`downgraded false`·30장 전부 `choiceCardHides`(보기 4개·`meaning/example/exampleKo/answer/correctText/chosenText/answeredAt` 키 없음), #49 재조회도 동일 → 정답 비노출 로직은 정상 |
| 4 | 6h′ ABANDONED 세트 재조회 (`:354`·`:361`) | **(가)** | `z` 를 `{count:5}`(기본 FLIP)로 만들어 `mode=FLIP` 카드가 뜻을 싣는다. 명시 CHOICE 30장 세트를 0장 답으로 `finish`(ABANDONED, `studyLogId null`) 뒤 #49 재조회 → 30장 전부 정답·예문 키 없음 [확실](REV-008 H1 유지) |
| 5 | 8d 삭제 단어 포함 replay → 전체 FLIP + `downgraded` (`:422`) | **(가)** | `mode==='FLIP'`·`replayOfId`·단어 목록(W3-D 에서 직접 확인)은 맞고 **`downgraded === true` 만** 어긋난다: replay 는 `newSeed('FLIP')` 이라 `requestedModeOf(seed)==='CHOICE'` 가 거짓 → `downgraded:false`(`sessions.ts:199`). 단위 시험 `task059CardFirst.test.ts:665` 가 `['FLIP', false, …]` 를 단언, 그 파일 28/28 PASS(미러에서 재실행). 삭제된 단어 카드도 보기 4개를 가진다(W3-D 확인) |
| 6 | 8h CHOICE 세트 replay → CHOICE 유지 (`:435`·`:441`) | **(가)** | `cs` 가 기본 FLIP 세트이고, 설령 CHOICE 로 만들어도 replay 는 계약 #53(task-059 D6 A)상 **FLIP+보기**가 정답 동작 — 「CHOICE 유지」 단언 자체가 폐기된 사양 |
| 7 | 3b CHOICE 정답 위치 분산 (`:503-510`) | **(가)** | 위치 분포는 `3/3/2/2` 로 합격선(3자리 이상·최대 ≤60%) 안인데 **표본 n=10 < 20** 에서 걸림 — 기본이 FLIP 이 되며 이번 실행의 CHOICE 세트가 `ts`(10장) 하나뿐. 독립 재현: CHOICE 30장 `7/6/8/9`(4자리·max 9 ≤ 18) 통과 |

- **(다) 제품 결함 의심: 0건.** 분류 (가) 5 · (나) 2.
- **결함 번호**
  - **QA068W3-1 [Low · 문서-동작 불일치]** 재현: `POST /api/v1/words/seed-pack {pack:"N5"}` (QA4 쿠키) → 기대(계약 #46b·`api-contract.md:171,940`) 「옛 탭 호출은 404」 / 실제 405 + 빈 본문(오류 봉투 `{success:false,…}` 없음). 영향: 옛 앱 탭이 이 라우트를 부르면 오류 처리 경로가 JSON 봉투를 못 읽을 수 있음 — 제품 동작은 어차피 실패이므로 무해 [가능성 높음; 옛 클라이언트의 오류 처리 방식은 확인 안 함]. 제안: 계약 문구를 「404 또는 405」로 맞추거나 `words/seed-pack/route.ts` 에 404 스텁을 둔다(Leader 판단).
  - **QA068W3-2 [Low · 시험 부채]** `task008-smoke.ts` 가 task-059(10-12) 이후 한 번도 갱신·실행되지 않아 CHOICE 가정 5건이 어긋나 있었다(제품 결함 아님). 이전 기록의 「77/77」은 task-059 이전 값.
- **고쳐야 할 스모크 기대값 목록** (파일은 고치지 않음 — `tests/live/task008-smoke.ts` 줄 번호 기준, QA 의 편집 허용 범위지만 이번 지시상 목록만)
  1. `:126` `surface: 'コーヒー'` → 기본 단어에 없는 가타카나(DB `userId NULL` 일치 0건 확인: `ラーメン`·`スマホ`·`ストレッチ`·`ハンバーガー`·`ボランティア`·`リモコン`·`コンビニ`·`ヨーグルト`; 있는 것: コーヒー·パソコン·アイスクリーム·サンドイッチ·エスカレーター·アルバイト). 안전하게는 실행 시작에 `prisma.wordEntry.count({where:{userId:null, surface}})===0` 를 확인. 근거: 기본 단어와 같은 표기는 D9 로 409. (새 표현이 LLM 에서 `valid:true` 로 나오는지는 LLM 0 규칙상 확인 못 함 — `NOT_VERIFIED`)
  2. `:161` `sp.status === 404` → `[404, 405].includes(sp.status)`(+ 라벨 「404/405」). 근거: 위 QA068W3-1. (문서 쪽을 고치면 라벨만 정리)
  3. `:259` 두 호출 `{ count: 10, category: 'S10' }` → `{ count: 10, category: 'S10', mode: 'CHOICE' }` — 3a 가 CHOICE 세트를 보게 함(이후 4a~7d 는 `chosenText`·DB `meaningSnap` 채점이라 그대로 통과; 카드 우선 FLIP 도 같은 채점이라 영향 없음).
  4. `:354` `{ count: 5 }` → `{ count: 5, mode: 'CHOICE' }` — 6h′ 가 의도한 CHOICE 미답 카드 비노출(REV-008 H1)을 보게 함.
  5. `:422`(8d) `rpS.session?.downgraded === true` → `=== false`, 그리고 `(rpS.cards ?? []).every((c) => Array.isArray(c.choices) && c.choices.length === 4)` 추가, 라벨 「전체 FLIP(downgraded, E4)」→「카드 우선 FLIP(downgraded false, task-059 D6 A)」.
  6. `:435` `{ count: 5 }` → `{ count: 5, mode: 'CHOICE' }` + `:441`(8h) 단언 교체: `rc.session?.mode === 'FLIP' && rc.session?.downgraded === false && rc.session?.replayOfId === csId && 같은 wordId 집합 && 모든 카드 choices 4개·meaning 문자열`, 라벨 「CHOICE 세트 replay → 카드 우선 FLIP(보기 새로 고름)」. (「정답 미노출」은 FLIP 이 뜻을 싣는 것이 사양이라 삭제.)
  7. `:510`(3b) 변경 불필요 — 3·4·6 번을 고치면 CHOICE 행이 S 10 + z 5 + cs 5 + ts 10 = 30 ≥ 20 (실행 순서와 무관하게 `mode:'CHOICE'` 행만 센다).
  - 같은 이유로 `task008-smoke.sh` 헤더/README 의 「77/77」 문구가 있으면 갱신 대상(확인하지 않음).
- **QA4 정리 확인** (DB 읽기 + API, 3차 스모크 끝의 「QA 데이터 정리」가 이미 QA4·qa-developer 데이터를 전부 지웠다 — 이전 QA 의 C·D 증거 세트 S1·S2·내 단어·상태 행도 함께 사라짐):
  - 이 재현 **전**: QA4 `source=mine` 0 · `archived=1` 0 · 진행 중 세트 0 · 보관(kept) 세트 0 · `UserWordState` **0행**(보관 해제 뒤 남은 0값 행 0, 값이 있는 행 0) · 세트(DONE) **0** · 세션 0 · attempt 0 · StudyLog 0 · StatsSnapshot 0. qa-developer 도 전부 0.
  - 이 재현 **후**(내가 만든 것): QA4 세션 **ABANDONED 2개**(count 5 FLIP · count 30 CHOICE, attempt 35행) · `UserWordState` 0 · StudyLog 0 · 스냅샷 0 · 내 단어 0 · 보관함 0 · 진행 중 0. 해롭지 않은 근거: ABANDONED 세트는 StudyLog·StatsSnapshot·상태 행을 만들지 않고 「오늘 끝낸 세트 제외」 규칙(DONE 만 대상)에 안 들어가며 QA4 계정에만 보인다. DB 직접 삭제는 하지 않았다(다음 스모크 실행의 정리 단계가 계정 데이터를 지운다).
- 확신: 분류 (가)(나)는 코드 줄·git 이력·계약 문구·명시 CHOICE 재현으로 뒷받침됨 [확실]. 8d·8h 의 live 재현(보관→replay)은 DONE 세트·StudyLog 를 남기기 때문에 하지 않고, W3-D 의 replay 관찰 + 단위 시험 28/28 + 계약으로 갈음 [가능성 높음]. 11c 의 대체 표현이 실제로 `valid:true` 가 되는지는 LLM 미호출 규칙으로 `NOT_VERIFIED`.
- 정리: 쿠키 파일(`w3b/c4`, 이전 `w3/c3·c4·cdev`) 삭제, 서버 3011 그대로(PID 3211574 미접촉), 띄운 프로세스 없음, `claude --print` 0개.
