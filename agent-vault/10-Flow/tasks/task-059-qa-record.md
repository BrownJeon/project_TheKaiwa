---
project: TheKaiwa
task: task-059
type: qa-record
role: qa
tags:
  - type/qa
  - domain/vocab
---
# task-059 QA 기록 — 갈래 α (서버 라이브 #47·#49·#50·#51·#52·#53)

> 본 이력서: [[task-059-improve-today-words-card-first]] · 감사 [[task-059-rev-record]](REV-186 PASS-with-fixes) · 구현 [[task-059-dev-s-record]]. 갈래 β(화면)는 별도 소환이 같은 데이터·서버를 쓴다.
> 환경: 검증 미러 `~/.node-local/thekaiwa-rev059`(HEAD `10a4e88` + task-059, `next build` 끝남, `.env` 는 저장소 것을 복사 — APP_ENV=LOCAL, 권한 600), 서버 `NODE_ENV=production next start -p 3011 -H 127.0.0.1`. 개발·운영 공유 NAS MariaDB — QA1(`qa-bot@thekaiwa.test`)·QA2(`qa-bot2@thekaiwa.test`) 계정에만 씀. 값(쿠키·DB URL·비밀)은 기록하지 않는다.
> 도구(저장소 밖): 미러 안 `qa059/{counts,probe,probe2}.ts`, scratchpad `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/q059/` (`c1`·`c2` 쿠키 600, `server.log`, `server.pid`, `manifest.json`).

## ★ 심은 것·정리 방법 (맨 위 고정 — 정리하는 쪽은 이것만 보면 된다)

- 지우는 대상은 **QA1·QA2 userId 한정**. 시작 값으로 되돌리는 조건 = 아래 「시작 값」 표와 `qa059/counts.ts` 출력이 같아질 때.
- 심기: QA1·QA2 각각 `POST /api/v1/words/seed-pack {pack:'N5'}`(기본 단어 팩 — `source=SEED, jlpt=N5`) + QA2 마커 단어 5개(접두 `QA059`, 직접 DB 삽입) → 전부 `WordEntry`. 시험으로 생기는 `VocabSession`·`VocabAttempt`(카드, 세션 삭제로 cascade)·`StudyLog(WORDS)`·`StatsSnapshot(VOCAB_SESSION·DAILY)`·`RepetitionItem`·`LearningObservation(VOCAB_RECOGNITION)` 도 같은 userId 로 지운다.
- 정리 순서(예): 1) `VocabSession` 삭제(`userId`) → 카드 cascade 2) `StudyLog`(type WORDS)·`StatsSnapshot`(**시작 값에 없던 것만**: QA1 은 시작 3행 `DAILY 2026-10-03/05/07` 보존, `VOCAB_SESSION` 전부·오늘/내일 `DAILY` 삭제 — 단 QA1 의 `DAILY 2026-10-05` 가 이미 `words.sessions 10` 을 갖고 있으니 **시작 3행은 건드리지 않는다**) 3) `RepetitionItem`·`LearningObservation(kind=VOCAB_RECOGNITION, 이번 작업 시각 이후)` 4) `WordEntry` 전부(시작 값 0) 5) 새로 생긴 `Profile` 없음(둘 다 시작부터 존재). 도구: 미러 안 `qa059/cleanup.ts`(작성·dry-run 확인 완료, 기본 dry-run, `--yes` 로 실행; QA1 시작 3행 보존 조건 포함 — **아직 실행하지 않음**, β 가 마지막에).
- ⚠ **A11 복습 판단 잡(LLM) 위험 — 이 갈래의 운영 규칙**: `POST /sessions/:id/finish` 가 세트를 실제로 끝내고(`finishedNow`) 반복 항목이 1개 이상이면 라우트가 `afterStudyCompleted` → `claimDecisionJob` 을 부른다. 가드 `studyDays ≥ 2 && RepetitionItem ≥ 2` 를 넘으면 **`claude --print`(sonnet) 잡이 서버 프로세스 안에서 실행**된다. QA1 은 이미 공부한 날이 2일(`DAILY 10-03·10-05` — 교정 채택·채팅) 있어 오늘 첫 끝내기 한 번이면 가드를 넘는다(실제로 과거 QA 가 AiJob `REVIEW_DECISION` 14건을 남김). → **LLM 호출 0 을 지키기 위해 QA1 은 `ABANDON`(답 0장 finish, 반복 항목 0·잡 없음)으로만 끝낸다. 실제로 `DONE` 으로 끝내는 시험(α-3 d·α-4)은 공부한 날이 0 인 QA2 에서만 한다**(오늘 DAILY 한 줄 = 1일 < 2 → 가드가 막아 잡이 걸리지 않음). 자정(KST)을 넘기면 QA2 도 2일이 되므로 DONE 으로 끝내는 세트는 **같은 KST 날짜 안에서 만들고 끝낸다**(세트 `date` 가 DAILY 날짜를 정한다).

## 시작 값 (심기 전, userId 한정 — `qa059/counts.ts start`, 2026-10-11 23:35 KST)

| 테이블 | QA1 (`qa-bot`) | QA2 (`qa-bot2`) |
|---|---|---|
| Chat | 3 | 0 |
| ChatMessage | 64 | 0 |
| Correction (전체 / ACCEPTED) | 5 / 0 | 0 / 0 |
| WordEntry | **0** | **0** |
| VocabSession | **0** | **0** |
| VocabAttempt | **0** | **0** |
| StudyLog | **0** | **0** |
| StatsSnapshot | **3**(`DAILY 2026-10-03·05·07`) | **0** |
| TutorProposal | 8 | 0 |
| RepetitionItem | 0 | 0 |
| LearningObservation | 453 | 27 |
| AiJob | 14 | 0 |
| Profile | `N5/null/10` | `N5/null/10` |

Leader 가 준 시작 값과 **일치**(QA1 Chat 3·ChatMessage 64·Correction 5/ACCEPTED 0·WordEntry 0·VocabSession 0·VocabAttempt 0·StudyLog 0·StatsSnapshot 3·TutorProposal 8·Profile `N5/null/10`, QA2 전부 0). 추가로 Leader 목록에 없던 값 — RepetitionItem 0·0, LearningObservation 453·27, AiJob 14·0 — 을 기록했다(finish 가 RepetitionItem·LearningObservation 을 만들기 때문).

## 체크포인트 0 — 서버 기동
- 서버 `next start -p 3011 -H 127.0.0.1` 리스너 PID **2798375**, `/proc/2798375/cwd` = `/home/brownjeon/.node-local/thekaiwa-rev059` 확인, `GET /api/health` 200. 쿠키 c1·c2 발급 23:36(1시간). `claude --print` 프로세스 0(시작 전 `ps` 확인).
- **남은 일**: α-1 심기(QA1·QA2 N5 팩 + QA2 마커) → α-2 → α-3 → α-4. **다음 첫 명령**: `S=…/scratchpad/q059; curl -s -X POST -H "Cookie: $(cat $S/c1)" -H 'Content-Type: application/json' -d '{"pack":"N5"}' http://127.0.0.1:3011/api/v1/words/seed-pack`.

## 체크포인트 1 — α-1 완료 · α-2 PASS(108/108) · α-3 거절 행렬 PASS(46/46) — 23:40 KST

**α-1 (심기)**: QA1 `POST /api/v1/words/seed-pack {pack:'N5'}` → `{added:676,skipped:0}`(1.1초). QA2 마커 단어 5개를 직접 삽입(`qa059/seed-qa2.ts`, 접두 `QA059`, 품사 NOUN, 예문 있음): 활성 3개(`QA059甲·乙·丙`, 뜻 `QA059뜻1·2·3`) + 보관 2개(`QA059丁`[뜻1]·`QA059戊`[뜻2]) — 「풀 3개」「풀 5개·뜻 3종」 두 상태를 보관 해제(`POST /api/v1/words/:id/unarchive`)로 전환해 쓴다. id 는 `scratchpad/q059/manifest-qa2.json`. 이 시점 증가분: QA1 WordEntry 0→676, QA2 WordEntry 0→5.
- 도구는 전부 미러 안 `qa059/`(저장소 밖): `lib.ts`(fetch 도우미+PASS/FAIL 집계, 로그 `scratchpad/q059/run.log`), `a2.ts`·`a2c.ts`·`a3r.ts`.

**α-2 #47·#49 모양 — PASS** (QA1 `a2.ts` 58/58 + QA2 `a2c.ts` 50/50; 출력 `scratchpad/q059/a-flip-card.json`·`b-choice-card.json`·`c-s1/s2-nochoice-card.json`)
- (a) `POST /sessions {count:10}`(mode 생략) → `session.mode==='FLIP'`·`downgraded:false`·`cardCount 10`·`status IN_PROGRESS`. **10장 모두** `choices` 4개(서로 다름, `meaning` 포함), 처음부터 `meaning`·`example`·`exampleKo`(비지 않은 문자열)·`answered:false`·`flagged:false`, `answer`/`correctText`/`chosenText`/`answeredAt` 키 없음. DB `VocabAttempt.choices` = 응답 `choices`, `meaningSnap` = 응답 `meaning`. 표기(wordId) 중복 0. 응답 전체에 `userId`·`seed` 문자열 0. 진행 중 세트가 있을 때 새 생성 → 409 + `details.sessionId` = 그 세트 id. `mode:null`·빈 body(`{}` → 프로필 기본 10장)도 FLIP+`choices`.
- (e) `GET /sessions/:id` 복원 — 미답 카드 배열이 POST 응답과 **JSON 동일**(FLIP·CHOICE 둘 다), 세션 키 16개 동일. (답한 카드 쪽은 α-3 에서.)
- (b) `mode:'CHOICE'` 명시(앞 세트를 ABANDON 한 뒤) → `mode CHOICE`·`downgraded:false`·`choices` 4개(서로 다름)·**카드 키 = {order,wordId,surface,reading,flagged,answered,choices} 7개뿐**(`meaning`·`example`·`exampleKo`·정답 키 0, 응답 본문에 `"meaning"`·`"correctText"`·`"example"` 문자열 0). DB `choices` 안에 `meaningSnap` 이 있고 정답 위치가 10장에서 여러 곳(고정 아님).
- (c) QA2 풀 3개(뜻 3종) 와 풀 5개(뜻 3종): 기본(FLIP) 요청 → 200·`mode FLIP`·**`downgraded:false`**·카드 3장/5장(`requestedCount 10` 유지)·**모든 카드에 `choices` 키 없음**(카드 키 9개 = FLIP 키에서 `choices` 만 뺌)·`meaning`·`example`·`exampleKo` 있음·DB `choices` NULL. `mode:'CHOICE'` 명시 → **`downgraded:true`·`mode FLIP`**·`choices` 키 없음, `GET` 으로 다시 읽어도 `downgraded:true` 유지. 보기 없는 카드에 `chosenText`(엉뚱한 값 또는 **정답 뜻 그대로**) → 400 `VALIDATION {field:'chosenText', reason:'not_in_choices'}`, 거절된 요청이 DB 에 아무것도 안 남김.
- (d) 잘못된 `mode`(`'X'`·`'flip'`·`'choice'`·`''`·`1`·`true`) → 전부 400 `VALIDATION {field:'mode', reason:'CHOICE|FLIP'}`. `count` 4·31·문자열, 알 수 없는 키, `category`+`topicId` → 400. 쿠키 없음 401, 깨진 JSON 400.
- (f) **키 집합 대조** — 계약과 일치:
  - 세션 객체 16키: `id,date,mode,requestedCount,cardCount,status,startedAt,finishedAt,downgraded,correctCount,wrongCount,skippedCount,durationSec,keptAt,replayOfId,topic`.
  - FLIP+보기 미답 카드 10키: `order,wordId,surface,reading,flagged,answered,choices,example,exampleKo,meaning`.
  - FLIP 보기 없는 카드 9키: 위에서 `choices` 만 없음.
  - CHOICE 미답 카드 7키: `order,wordId,surface,reading,flagged,answered,choices`.
  - `userId`·`seed`·`refType`·`refId`·`exampleSnap`·`meaningSnap` 등 내부 필드 노출 0.

**α-3 거절 행렬 — PASS 46/46** (QA1, 기록이 안 남는 요청만 — `a3r.ts`)
- `chosenText`+`selfResult`·`selfResult`+`skipped`·3개 동시 등 5조합 모두 400 `one_answer`. FLIP+보기 카드에 보기에 없는 `chosenText`(무작위·끝 공백 변형·다른 카드의 보기) → 400 `not_in_choices`. 형식 오류 19종(`chosenText` 빈 값·숫자·201자, `selfResult` 소문자·MAYBE, `skipped:false`, `responseMs` -1·60001·1.5·문자열, `order` -1·문자열·30·카드 수 초과, 알 수 없는 키·`userId` 키, 답·표시 모두 없음, 답 없이 `responseMs`, `flagged` 문자열) 전부 400 `VALIDATION` + 기대 `field`. 깨진 JSON·배열 body 400, 쿠키 없음 401, **남의 세트 404**(QA2 쿠키로 QA1 세트에 attempt·GET), 형식이 틀린 id 404. 거절된 모든 요청 뒤 해당 세트 카드 6장에 `answer/chosenText/answeredAt/responseMs` 기록 0. 표시만(`{order,flagged}`) 200 → 토글 복귀 200.
- **`mode:'CHOICE'` 세트에 `selfResult`(CORRECT·WRONG) → 400 `VALIDATION {field:'selfResult', reason:'mode'}`**, 보기에 없는 `chosenText` 400, `chosenText`+`selfResult` 400 `one_answer`(모드 검사보다 먼저). ABANDONED 세트에 attempt → 409.
- 이 단계에서 QA1·QA2 세트는 전부 ABANDONED(답 0장 finish)로 닫음 — `StudyLog`·`StatsSnapshot`·`RepetitionItem`·`AiJob` 증가 0(아래 증가분 표).

**진행 중 증가분(시작 값 대비, 23:40)**: QA1 WordEntry +676 · VocabSession +10(전부 ABANDONED) · VocabAttempt +81 · 그 밖 0. QA2 WordEntry +5 · VocabSession +4(전부 ABANDONED) · VocabAttempt +16 · 그 밖 0.

**남은 일**: (1) α-4(e) 지연 표본(QA1, 만들고 ABANDON — 지금 가능) (2) QA2 에 N5 심기 + α-3 기록 행렬·finish·α-4 보관/다시 풀기/삭제 단어/주제 — **DONE 세트는 같은 KST 날짜 안에서**(자정 직전이면 00:00:30 이후로 미룸).
**다음 첫 명령**: `cd ~/.node-local/thekaiwa-rev059 && node --env-file=.env --import tsx qa059/a4time.ts`(작성 예정) → 그다음 QA2 `seed-pack`.
**주의점**: 서버 PID 2798375(3011, 안 끔). 쿠키 c1·c2 23:36 발급(1시간). `claude --print` 자식 없음(서버는 A11 잡을 걸지 않았음 — QA1 은 ABANDON 만).
**미정리**: 위 증가분 전부, 서버 프로세스, 쿠키 파일 `scratchpad/q059/c1`·`c2`, 미러 `.env`, 미러 `qa059/`.

## 체크포인트 2 — α-3 PASS · α-4 PASS · 갈래 α 종료 (23:48 KST, 결함 0건)

검증 스크립트 합계(`scratchpad/q059/run.log`, 미러 `qa059/*.ts`): **PASS 306 / FAIL 3** — FAIL 3건은 전부 **검증 스크립트의 기대값 오류**(제품 동작은 정상, 원인·재검증을 아래에 적음). 첫 `a2.ts` 실행의 6건 실패도 같은 종류(오류 응답 모양을 `error.code` 로 읽은 내 오타 — 실제 응답은 `{success:false,data:{code,details}}`)였고 고쳐서 58/58 재실행.

**α-3 #50·#51 행렬 — PASS (QA2, 74/74 + 위 QA1 거절 행렬 46/46)**
- 10장 FLIP+보기 세트(N5, QA2)에서 카드마다 다른 방식: 0 보기 정답 · 1 보기 오답 · 2 스스로 알아요 · 3 스스로 몰라요 · 4 건너뛰기 · 6 보기 정답(+`responseMs 1234`) · 7 보기 오답(+2500) · 8 스스로 알아요(+`flagged`) · 5 동시 5회 · 9 동시 5회(같은 방식). (a) 보기 답은 서버 채점 — 응답 `answer`·`correctText`(=카드 뜻)·`chosenText`(=고른 값)·`example`·`exampleKo`·`answeredAt`, 스스로 표시는 `selfResult` 그대로(`chosenText:null`). 응답 키 8개 고정. DB `VocabAttempt.chosenText` 는 보기로 답한 카드(0·1·6·7)에만 있고 스스로·건너뜀은 NULL, `responseMs`·`flagged` 기록 일치.
- (b) 거절: `one_answer`(5조합)·`not_in_choices`·`CHOICE` 세트의 `selfResult` → 400 `mode`·형식 오류 19종 — 위 체크포인트 1.
- (c) **첫 결과 유지(200, 변경 없음, 응답 JSON 동일)**: 보기로 답한 카드에 `selfResult`, 보기 오답 카드에 정답 `chosenText`, `selfResult` 카드에 `chosenText`(오답·정답 둘 다), 건너뜀 카드에 `selfResult`/`chosenText`, `selfResult` 카드에 `skipped`, 같은 보기 재전송(다른 `responseMs`) 8종 → 응답이 첫 응답과 동일하고 DB(`answer`·`chosenText`·`responseMs`·`answeredAt`)도 한 글자도 안 바뀜. **동시 5회**(같은 카드에 보기 정답·보기 오답·스스로 알아요·스스로 몰라요·건너뛰기 병렬): 5개 모두 200이고 **응답 5개가 완전히 동일**(= 먼저 잠근 요청의 결과), DB 한 건과 일치. 같은 방식 5회 병렬도 동일.
- #49 복원(답한 카드): 14키(`answer`·`correctText`·`chosenText`·`answeredAt` 추가), `chosenText` 는 보기로 답한 카드(0·1·6·7)만 문자열이고 나머지는 `null`, `meaning`·`choices`·`example`·`exampleKo` 유지. CHOICE 세트 부분 답: 답한 카드에만 `answer`·`correctText`·`chosenText`, 미답 카드는 7키 그대로(`meaning`·`example`·`correctText` 없음).
- (d) `finish` — 맞힘 5 · 틀림 4 · 건너뜀 1(DB 카드 `answer` 로 센 기대값과 일치, 답한 방식과 무관). `wrongWords` 4건 = DB 의 WRONG 카드와 wordId 집합 일치(**보기 오답 2 + 스스로 몰랐어요 1 + 동시 요청 승자/나머지 포함**, `source:'WORD'`). 응답 키 `session·studyLogId·wrongWords·flaggedCount·challenge`. `WordEntry` 카운터: CORRECT 단어 `correctCount 1`·`lastResult CORRECT`, WRONG 단어 `wrongCount 1`, SKIPPED 단어 두 카운터 0·`lastResult SKIPPED`, 전부 `lastSeenAt` 설정 — 카드 결과와 100% 일치. `StudyLog` 1행(`WORDS`/`DIRECT`/`refId=세트 id`), `summary` = 「오늘의 단어 10장(**카드**) · 맞힘 5 · 틀림 4 · 건너뜀 1」. `StatsSnapshot VOCAB_SESSION`(`{cardCount 10, correct 5, wrong 4, skipped 1, mode FLIP}`) + `DAILY`(`words.sessions 1·correct 5·wrong 4`, `repetition.studied 9`). `RepetitionItem` 9행(답한 9단어, `studiedCount 1`), `LearningObservation VOCAB_RECOGNITION` 10행(SUCCESS 5·FAIL 4·SKIPPED 1, refId=카드 id). `finish` 재호출 → 응답 JSON 동일, 새 행 0. **`mode:'CHOICE'` 세트**(5장, 보기 답 4 + 미답 1): 맞힘 2·틀림 2·건너뜀 1(미답 → SKIPPED 자동), `summary` = 「…5장(**보기 고르기**)…」, 스냅샷 `mode CHOICE`, `DAILY.words.sessions 2`(합산 정확).
- (e) 답 0장 세트 `finish` → `ABANDONED`·`studyLogId:null`, `StudyLog`·`StatsSnapshot`·`RepetitionItem`·`LearningObservation`·단어 카운터·`lastSeenAt` 변화 0.
- (f) `DONE`·`ABANDONED` 세트에 attempt(답·표시 모두) → 409.

**α-4 다시 풀기·보관·주제 — PASS (QA2, 60/62 + 재검증 5/5 + QA1 추가 12/12)**
- 전제: 보관 안 한 DONE·ABANDONED·없는 id → replay 409/409/404, 남의 세트 404, ABANDONED 보관 409, 잘못된 body 400. 보관 두 번 → 같은 `keptAt`, 목록 `?kept=1` 에 노출, 보관 해제 뒤 replay 409.
- (a) 혼합 세트 보관 → replay: 새 세트 **`mode FLIP`·`downgraded:false`·`replayOfId=원본`·카드 10장 모두 `choices` 4개(서로 다름·정답 포함)·`meaning`/`example`/`exampleKo` 있음**, 같은 단어 10개 집합이나 **카드 순서가 섞임**(새 시드), 보기도 원본과 다르게 새로 만듦(참고). 진행 중 있을 때 replay·새 생성 → 409 + `details.sessionId`. 동시 replay 2건 → 200 하나·409 하나. GET 복원 카드 동일.
- (b) `mode:'CHOICE'` 로 만든 세트(DONE·보관) → replay: **새 세트 `FLIP`+`choices` 4개+`meaning` 있음**.
- (c) **삭제된 단어**: 세트 한 단어를 `DELETE /api/v1/words/:id` → 원본 DONE 세트의 그 카드는 `wordId:null`이 되고 `surface`·`choices`·`answer`·`correctText`·`chosenText`·`answeredAt` 은 **스냅샷 그대로**, 다른 9장은 한 글자도 안 변함, `#54 stats` 응답 불변, 세션 카운터 불변. 그 세트를 replay → 삭제된 단어 카드가 `wordId:null`·`choices` 4개(정답 뜻 포함)로 **살아 있고** 나머지는 `wordId` 있음, DB `choices` 저장. 삭제 단어 카드에 보기 답 → 서버 채점 200(CORRECT). 그 세트 finish → DONE(맞힘 1·건너뜀 9, 카운터 갱신은 단어 없는 카드를 건너뜀). 참고 수치: replay 응답 ms — 삭제 전 952 / 삭제 후 486(단어 재료 조회 1회 추가에도 눈에 띄는 증가 없음).
- (d) 주제 세트(`generate:false` 만, **LLM 0**): 자기소개 시드 주제 5장 — `mode FLIP`·`downgraded:false`·`topic {id,title,lessonCardCount,aiCardCount}`·`generation {source,generatedNow:false,reason:'SKIPPED'}`(키 3개)·카드 `wordId:null`·**전부 `choices` 4개**·`meaning` 있음, 새 `WordEntry` 0. 보기 답 정답·오답+스스로 → finish: 맞힘 2·틀림 1·건너뜀 2, `wrongWords[0].source:'TOPIC'`·`wordId:null`, `challenge:null`, `summary` 「주제 단어 「자기소개」 5장(카드) · 맞힘 2 · 틀림 1 · 건너뜀 2」, 스냅샷에 `topicId`·`mode FLIP`. 보관 → replay: 같은 주제·같은 카드 표기·`lessonCardCount`/`aiCardCount` 동일·`choices` 4개·카드 `refType/refId` 복사. 추가로 QA1(abandon): 주제 세트 기본 FLIP+`choices`, `mode:'CHOICE'` 명시 주제 세트는 `CHOICE`(미답 카드에 `meaning`/`example`/`correctText` 없음), `generate:false` 를 `topicId` 없이 보내면 400 `topicId_required`, 문자열이면 400 `boolean`. 옛 번들이 보낼 수 있는 `mode:'FLIP'` 명시 = 기본과 같음. 카테고리 `초보자 (N5)` → FLIP+보기, 없는 분류 → `empty NO_WORDS_IN_CATEGORY`(200). **동시 생성 5회 → 200 하나·409 넷**(전부 이긴 세트 id 가리킴).
- (e) 지연(참고만, 공유 NAS 쓰기 COMMIT 영향): QA1 N5 676개, 생성(만들고 ABANDON, 순차) — **기본 FLIP+보기 count10 p50 574ms / p95 1086ms (n=16)** · `mode:'CHOICE'` 명시 count10 p50 608 / p95 1128 (n=16) · 기본 count30 p50 652 / p95 872 (n=8). → 보기를 FLIP 에도 만드는 새 경로가 이전 CHOICE 경로와 사실상 같다(task-057 의 COMMIT 대기 지배와 일치). QA2: replay 952/486ms, 주제 생성 1915ms, 주제 replay 1515ms.
- LLM·잡: QA2 `AiJob` 시작 0 → 끝 0, QA1 `AiJob` 14 → 14, `ps` 로 `claude --print` 자식 0, 서버 로그 오류·경고 0건.

**검증 스크립트 FAIL 3건의 원인(제품 결함 아님)**
1. `del.m1.othersUnchanged`(a4) — 내 비교가 삭제된 단어 카드까지 포함했음. 별도 재검증(`chk2.ts` 5/5): 다른 단어 삭제 후 **다른 카드는 완전 동일**, 삭제 단어 카드는 `wordId`·`example`·`exampleKo` **세 키만** 바뀌고(나머지 스냅샷 동일).
2. `topic.noWordCreated`(a4) — 기대값 식 오류(삭제 반영을 이미 한 값에서 또 1을 뺌). `WordEntry` 수는 680 → 680(주제 세트가 단어를 만들지 않음).
3. `nochoice.on.FLIP+noChoicesKey`(chk3) — 카드 수 기대값 5 오류: 마커 `QA059甲` 이 오늘 DONE 세트에 이미 들어 있어 풀 4 → 카드 4장(오늘 끝낸 단어 제외 규칙). DB 확인: 4장 모두 `choices` NULL, 응답 200·`FLIP`·`downgraded:false`.

**관찰(결함 아님)**
- **I-A (기존 동작, task-049 규칙) 삭제된 단어 카드의 예문 소실**: 내 단어장 카드는 예문 스냅샷이 없고 지금 단어를 읽는다 → 단어를 지우면 그 카드(진행 중·DONE·replay 새 세트 모두)의 `example`/`exampleKo` 가 `null`. 새로 생긴 문제가 아니며 화면 규칙 D3(「예문 없으면 [단어 듣기]만」)과 맞다.
- **I-B 「풀 ≥4」 조건**: `material = 풀(오늘 끝낸 단어 제외) ≥ 4 && 활성 단어의 서로 다른 뜻 ≥ 4`. 활성 단어가 많아도 **오늘 끝낸 단어를 뺀 풀이 3 이하**가 되면(하루 여러 번 끝낸 날) 그 세트는 보기가 없다 — 계약 문구(「풀 ≥4」)와 일치하는 의도된 동작이고, 마지막 세트에서만 보이는 상태라 화면은 알림(`noChoice`)으로 처리한다(REV-186 R-6 와 같은 문구 문제).
- **I-C 서버는 「뜻을 보고 객관식을 골랐는가」를 모른다**(REV-186 I-1 그대로).

## ★ β(화면 QA) 인계 — 반드시 읽을 것

1. **A11 복습 판단(LLM) 위험이 β 에서도 그대로다.** `finish` 가 세트를 실제로 끝내고 반복 항목이 생기면 서버 프로세스가 `claude --print`(sonnet) 잡을 건다(가드 = 공부한 날 ≥2 && 반복 항목 ≥2). **QA1 은 이미 공부한 날이 2일(10-03·10-05)이라 첫 끝내기부터 LLM 이 돈다.** **QA2 는 지금 공부한 날이 1일(`DAILY 2026-10-11`)이라 KST 10-12 이후에 DONE 세트를 하나라도 끝내면 2일이 되어 마찬가지로 열린다**(23:50 이전이면 오늘 안에서는 안전). 화면 QA 에서 「답하고 끝내기」 흐름을 돌릴 때는 ① QA2 의 시험 기록을 먼저 정리(`qa059/cleanup.ts --yes` — QA2 `StatsSnapshot`·`RepetitionItem` 포함, 그러면 공부한 날 0 으로 돌아감)한 뒤 하루 안에서 끝내거나 ② 서버를 `CLAUDE_CLI_*` 를 존재하지 않는 경로로 덮어써(`.env` 가 아니라 프로세스 환경으로) 다시 띄우거나 ③ LLM 한 번을 감수한다고 Leader 가 결정해야 한다. 이 갈래는 ①②를 하지 않고 QA2 에서만 DONE 을 만들었다.
2. **서버**: `127.0.0.1:3011`, 리스너 PID **2798375**(`ss -ltnp | grep :3011`), cwd = `~/.node-local/thekaiwa-rev059`, `NODE_ENV=production next start`, **켜 둔 상태**(안 껐다). 종료는 PID 로만(`kill 2798375`) 후 `ss -ltn` 으로 포트 비움 확인.
3. **쿠키 재발급**(23:36 발급 → 00:36 만료): `cd ~/.node-local/thekaiwa-rev059 && QA_ACCOUNT=1 node --env-file=.env --import tsx tests/live/qa-session.ts $S/c1`(QA2 = `QA_ACCOUNT=2` → `$S/c2`), `S=/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/q059`. 내용은 `thekaiwa_session=…`. 429 면 2분 쉼.
4. **데이터**: QA1 = N5 676 단어(모두 보관 안 함), 세트 55개 전부 `ABANDONED`, 진행 중 0 — 화면 QA 가 바로 세트를 시작할 수 있다. QA2 = N5 676 + 마커 5 − 삭제 2 = 679 단어, 세트 14개(DONE 4: 혼합 M1[보관]·CHOICE M3[보관]·삭제 단어 replay·주제 세트[보관], 나머지 ABANDONED), 진행 중 0, `StudyLog` 4·`StatsSnapshot` 5(`DAILY` 1 + `VOCAB_SESSION` 4). 매니페스트: `scratchpad/q059/manifest.json`(+`sessions.json`·`manifest-qa2.json`).
5. **「보기 없는 풀」 화면 재현**: `node --env-file=.env --import tsx qa059/nochoice.ts on`(QA2 의 SEED 단어 674개를 보관 → 활성 마커 5개·뜻 3종, 오늘 끝낸 `QA059甲` 은 풀에서 빠져 **카드 4장·`choices` 없음**) / `off` 로 복원. 시험 완료·복원 확인함(현재 `off` 상태 — 활성 679).
6. **세트 생성 시 QA2 의 「오늘 끝낸 단어 제외」**: 오늘(10-11) DONE 4세트(약 22단어)가 풀에서 빠짐. 10-12 가 되면 풀린다.

## 증가분(시작 값 대비, 23:48 KST) · 미정리

| 테이블 | QA1 시작→현재 | QA2 시작→현재 |
|---|---|---|
| WordEntry | 0 → 676 | 0 → 679 |
| VocabSession | 0 → 55(전부 ABANDONED) | 0 → 14(DONE 4·ABANDONED 10) |
| VocabAttempt | 0 → 666 | 0 → 85 |
| StudyLog | 0 → 0 | 0 → 4 |
| StatsSnapshot | 3 → 3 | 0 → 5 |
| RepetitionItem | 0 → 0 | 0 → 16 |
| LearningObservation | 453 → 453 | 27 → 57(+30 VOCAB_RECOGNITION) |
| AiJob | 14 → 14 | 0 → 0 |
| Chat·ChatMessage·Correction·TutorProposal·Profile | 변화 없음 | 변화 없음 |

- 정리: `cd ~/.node-local/thekaiwa-rev059 && node --env-file=.env --import tsx qa059/cleanup.ts`(dry-run) → `--yes` → `qa059/counts.ts` 로 위 시작 값 표와 대조(QA1 `StatsSnapshot` 시작 3행 `DAILY 10-03·05·07` 은 보존하는 조건 포함).
- 미정리 목록: 위 증가분 전부, 서버 프로세스 PID 2798375, 쿠키 파일 `scratchpad/q059/c1`·`c2`(권한 600, β 종료 때 삭제), 미러 `.env` 복사본(`~/.node-local/thekaiwa-rev059/.env`, 600 — 미러 정리 때 같이), 미러 `qa059/` 폴더(저장소 밖). 스크린샷 0장(`/tmp/qa-artifacts` 사용 안 함 — `산출물 정리: 0개 삭제`).

---

# 갈래 β1 — 홈 자리표시 실측(R-2)·덱 상호작용 (QA, 2026-10-12 00:00 KST 전후 — 날짜가 10-11 → 10-12 로 넘어감)

> 환경: 서버 3011(PID 2798375, cwd `~/.node-local/thekaiwa-rev059`, `ss -ltnp` 재확인) · 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스, `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:'reduce'`(홈 측정) · 쿠키 c3·c4 = 23:51 발급(1시간). 도구(저장소 밖): scratchpad `q059/b1/{lib,dlib,b1-home-static,b1-home-sweep,b1-home-jump,b2-deck}.mjs` · 미러 `qa059/{counts34,cleanup34,dbcard}.ts`.
> **심은 것(추가)**: QA3 = `seed-pack N5` 676단어(23:52) — 정리 `qa059/cleanup34.ts --yes`(시작 값 전부 0). QA4 = 심은 것 없음(시작 AiJob 3 그대로). 자정 규칙: 세트는 전부 **10-12 날짜**로만 만든다(공부한 날 1일 유지 → A11 가드 미충족). `ps` 로 `claude --print` 0 확인.

## 체크포인트 β1-1 — 홈 카드 자리표시 실측 (00:00)
- (a) 방식 줄 **0**(카드 안 `방식` 글자 0·`aria-label` 에 방식 0). 순서 = 제목+「약 3분」 → 설명 「카드를 넘기며 뜻을 맞혀요. 틀린 단어일수록 자주 나와요.」(D8 A 원문) → 「장수」 → 분절 `카드 장수`(5/10/15/20/30장, 32px 칩·그룹 38) → [시작하기](48). 폭 3개 모두 문서 가로 넘침 0.
- (b) **실제 렌더 높이(카드 `div.rounded-[14px]`) — 임시 상수와 정확히 일치**:

| 상태 | 360 | 390 | 412 | 임시값 `TODAY_CARD_H.word` |
|---|---|---|---|---|
| 단어 676(QA3) 준비 | **230.25** | **210.75** | **210.75** | narrow 230.25 / wide 210.75 / narrowBelow 370 |
| 단어 0개 빈 상태(QA4) | **240** | **240** | **240** | (상수 없음 — 자리표시와 안 맞는 상태) |

  폭 스윕 340→440(4px)+360→380(1px): QA3 는 **369→230.25, 370→210.75** 에서만 바뀜(= `min-[370px]` 와 일치, 설명 문구 1줄↔2줄), QA4 는 전 구간 240. 회화 카드 253.63·평가 카드 217.13(≤361)/199.13 도 기존 상수(253.6/217.1/199.1)와 같다.
- (c) 탭 이동 점프(단어장→오늘, 계획표→오늘 × 지연 0/700/1500/2500ms × 3폭, rAF 기록): **QA3(단어 있음) 24조합 전부 블록 위치·높이 점프 0px, CLS 0, 자리표시가 먼저 보임**. **QA4(단어 0개): 단어 카드 높이 +9.7px(360)/+29.2px(390·412), 아래 두 카드가 같은 만큼 밀림, CLS 0~0.008** — task-046 합격선 ≤8px 초과(§23-7 A 가 예고한 「첫 사용자 한정」 변화).
- (d) **권고 상수값 = 임시값 그대로(변경 0)**: word `{ narrow: 230.25, wide: 210.75, narrowBelow: 370 }`, `H_CLASS.word` 의 `min-[370px]` 유지. 임시값과의 차이 = 0.00px. `todaySkeleton.test.ts` 의 값·몸통값(카드−60.5 → 169.75/150.25)도 그대로 유효. (빈 상태 240 은 상수에 반영하지 않는다 — 단어가 있는 흔한 상태 기준 규칙.)
- (e) 주제 시작 카드·챌린지 단어 카드·[내 단어장으로 풀기] 펼침: 코드 쪽은 `MODE_OPTIONS`/`modePicker`/`푸는 방식` 이 앱 코드(소스 `src/components`)에 없음(`grep` — 관리자 `LexiconImportSheet` 의 「가져오는 방식」만 남음, 무관). **DOM 실측은 아래 β1-1(e) 항목에 이어서 기록.**

## 체크포인트 β1-2 1차 — QA3 UI 로 5장 세트 풀기 (00:05, `b2-deck.mjs`, 390×844)
- 홈에서 UI(`5장` 탭 → `시작하기` 탭)로 시작: 요청 본문 `{"count":5,"category":null}`(**mode 안 보냄**), 응답 `mode FLIP·downgraded false`, 카드 5장 전부 `choices` 4개.
- 1차 결과 54 PASS / 5 FAIL — FAIL 5건은 전부 **스크립트 오류**(오탐; 아래 「재검증」에서 다시 잼): ① `C0.requestBody` 가 표시(깃발) 요청 `{order,flagged}` 를 집음 ② `snd.retapStops` 가 `aria-live` 줄을 안 읽음(오디오는 `started 1→stopped 1` 로 멈춤 확인) ③④⑤ 서버 응답 지연(NAS 쓰기 1~3초)이라 0.7~0.9초 뒤에 화면을 읽어 자동 다음·건너뜀 띠가 아직 안 바뀐 것.
- PASS 요지: 카드 면 안 `button/a/input` **0개** · 앞면 안내문 두 문구 원문 일치 · 객관식 버튼 추가 · **탭 합 9px=열림, 합 10px=무반응** · 위 −79=무반응/−81=표시 토글(카드 안 넘어감) · 왼 −60=무반응/−61=「뜻 보기나 객관식으로 먼저 답해 주세요」 · 오른쪽(첫 카드)=「첫 카드예요」 · 탭 열기 시 보기 4개(✓/✗ 없음)·다시 탭 닫힘·**탭/열기/닫기 모두 `VocabAttempt` 기록 0**(DB) · **touchend 뒤 호환 mouse/click 이벤트 0**(touchstart,touchend 만) · 유령 click 시뮬(탭 좌표 요소에 click) 무영향 · [객관식] 버튼 → 첫 보기 `1번` 초점 · 정답: `✓ 정답` 단 하나+띠 「맞았어요」+듣기 줄 2칸(44px)+[다음 카드] 초점·같은 카드 재답 요청 0 · 답한 뒤 왼쪽 밀기=다음 카드, 오른쪽 밀기=이전(읽기 전용: 보기 4개 `aria-disabled`, 탭 무반응), 다시 왼쪽=최전선 카드 · 오답: `✗ 내 답`+정답 `✓ 정답` 동시 · 스스로 알았어요/몰랐어요 DB `answer` CORRECT/WRONG·`chosenText` NULL · 소리 실패 5종 문구·역할(alert/status) 원문 일치 · DONE: 맞힘2·틀림2·건너뜀1, `chosenText` 는 보기 카드 2장에만, AiJob 0→0(QA4 3→3), `claude --print` 0.
- **남은 일**: 스크립트 오류 5건 재검증 + β1-3 높이(3폭·Q4 위험 조합) + β1-4 잔여(예문 없음/100자 초과·표시 설정·재탭 알림 어긋남) + β1-1(e) DOM. **다음 첫 명령**: `cd scratchpad/q059/b1 && node b3-heights.mjs` (작성 중). **주의**: QA3 세트 2개(ABANDONED 1·DONE 1, 모두 10-12), 서버 PID 2798375 살려 둠, 쿠키 c3·c4 00:51 만료.

## 체크포인트 β1-2 재검증·β1-3·β1-4·β1-1(e) — 완료 (00:13 KST)

**1차 스크립트 오류 5건 재검증 — 전부 PASS**(`b3-heights.mjs`·`b6-misc.mjs`, 390×844·360×740·412×892·390×800·412×780 5개 화면 크기):
- 보기 답 요청 본문 = `{order, chosenText, responseMs, flagged}` 키 4개뿐(`selfResult`·`skipped` 없음) — 앞 오탐은 표시(깃발) 요청 `{order,flagged}` 를 집은 것.
- 소리 재생 중 같은 버튼을 다시 누르면: 버튼이 「단어 듣기」로 돌아오고 오디오 `stopped 0→1`, 덱 `aria-live` 줄이 30ms 에 **「소리를 멈췄어요」** 로 바뀌어 2.5초 뒤까지 유지, `role=status`/`alert` 줄에 남은 「재생 중」 글 없음 → **감사 Low(재탭 직후 알림 어긋남) 재현 안 됨**(5개 크기 모두 같은 시퀀스). 받는 중(불러오는 중)에 다시 눌러 취소해도 같은 알림·버튼 복귀·늦게 온 응답이 재생되지 않음(`AudioBufferSourceNode.start` 0회).
- 알았어요/몰랐어요 → 응답 도착 뒤 **다음 카드까지 538~550ms**(타이머 400ms + 렌더·폴링 ≤150ms) — 5개 크기 일정, 화면 크기와 무관. 다음 카드로 넘어가면 소리 멈춤(`stopped` +1, 새 카드에 듣기 줄 없음, 새 재생 시작 0), 12초 안에 늦게 온 응답도 재생 안 됨.
- 건너뛰기 → 띠 「건너뛴 카드」 + 「건너뛴 카드로 기록했어요」 + 도구 줄 [이전][표시][다음 카드 ›](마지막 카드는 [결과 보기 ›]) + 듣기 줄 2칸(44px). DB `answer=SKIPPED`.

**β1-3 높이·폭·넘침 — 5개 크기 × 8상태, 40+ 측정, 가로 넘침 0·44px 미만 0·덱·`main` 세로 스크롤 0** (DONE 세트 30개 중 이 측정분, 전부 QA3·날짜 10-12). 카드 높이(px):

| 상태 | 360×740 | 390×800 | 412×780 | 390×844 | 412×892 | 데모(740/800/780) |
|---|---|---|---|---|---|---|
| F0 앞면·닫힘 | 340 | 340 | 340 | 340 | 340 | 340 |
| F1 보기 열림 | **287.5** | 340 | **327.5** | 340 | 340 | 282/340/322 |
| Ac 객관식 답한 뒤(듣기 줄) | **243.5** | **303.5** | **283.5** | 340 | 340 | 242/302/282 |
| B0 뜻 보기 면(듣기 줄) | 340 | 340 | 340 | 340 | 340 | 340 |
| Ak 건너뜀(듣기 줄) | 340 | 340 | 340 | 340 | 340 | — |
| 이전 4지선다 처음 / 답한 뒤 | 287.5 / 243.5 | 340 / 303.5 | 327.5 / 283.5 | 340 / 340 | 340 / 340 | — |

  앱이 데모보다 보기 열림 +5.5px·답한 뒤 +1.5px 큰 것 외엔 일치(참고). 모든 면에서 `DeckListenRow` 버튼 높이 44, 앞면 두 칸 52, 보기 52, 도구 52(BackBar 「오늘로」「끝내기」 44).
- **Q4 위험 조합 — FAIL (결함 #1, Medium)**. 아래 표는 같은 세트 `POST /api/v1/vocab/sessions {topicId:자기소개, count:10, generate:false}`(주제 카드 ≤5 → `cardCount<requestedCount` → **서버가 만드는 `fewer` 알림**, 주입 없음)를 카드 탭 → 보기 정답 탭 → 답한 뒤 상태에서 잰 것:

| 화면 | 카드 | 무대(카드 자리) 안쪽 | 카드가 무대 밖으로 나온 양 | 이웃과 겹침 |
|---|---|---|---|---|
| **360×740** | **200(하한)** | 155.8 | 위 10.1 · 아래 10.1 | **알림 박스 아래 10.1px 덮음 + [단어 듣기](44px) 위쪽 10.1px(23%) 덮음** |
| 390×800 | 215.8 | 215.8 | 0 | 없음 |
| 412×780 | 200(하한) | 195.8 | 2.1(무대 여백 안) | 없음 |

  (알림이 2줄(63px)인 360 폭에서 발생. 같은 높이의 `topicReason`·`noChoice` 문구도 동급. 스크린숏 확인: 카드가 알림 박스 모서리를 가리고 아래 듣기 버튼 글자가 반쯤 잘려 보임 — 스크린숏은 지움.) 이전 4지선다+`few` 알림(1줄 `few` 문구가 360 에서 2줄) 답한 뒤도 360×740 에서 카드 200·무대 안쪽 180.5 로 **이웃 겹침은 없으나 위·아래 여유 2.3px**(듣기 줄 +44 때문에 하한에 닿음). `deckScroll`·`mainScroll` 은 0 이라 **스크롤이 생기는 게 아니라 겹침으로 나타난다.**

**β1-4 듣기 — PASS**(`/api/v1/speech/tts` 를 `page.route` 로 모의, 서버·엔진 호출 0): 뜻 보기 면 [단어 듣기][예문 듣기](44px, 각 139px 폭) · 예문 없음/101자 → [단어 듣기] 한 칸(286px 꽉 참), 정확히 100자 → 두 칸 · 요청 본문 키 `text` 하나뿐 · 받는 중 라벨 「불러오는 중」+`aria-label` 「단어 불러오는 중, 누르면 취소」+`aria-busy` · 재생 중 「멈추기」+「단어 소리 멈추기」+live 「단어 소리 재생 중」 · 실패 5종 문구·역할 원문 일치(fail 「목소리를 불러오지 못했어요 · 다시 눌러 주세요」 alert / slow 「목소리 응답이 늦어요 · 잠시 후 다시 눌러 주세요」 alert / offline 「연결하지 못했어요 · 네트워크를 확인해 주세요」 alert / textonly 「지금은 선생님 목소리를 들을 수 없어요(자막만)」 status / rate 「너무 자주 눌렀어요 · 잠시 후 다시 들어 주세요」 status) · blocked 문구(「소리를 켜려면 ▶ 를 한 번 더 눌러 주세요」)는 **NOT_VERIFIED**(헤드리스는 오디오가 막히지 않음 — 실기기/자동재생 차단 환경 필요) · **표시 설정**(`GET /api/v1/settings/profile` 을 모의, PUT 은 서버로 안 보냄) 히라가나·한글·번역 켬 vs 끔: 카드 글자는 달라짐(한글 발음 줄 있음/없음, `<rt>` 4개/1개)인데 **보낸 소리 글은 두 경우 모두 예문 원문과 같음**(`私は毎朝コーヒーを飲みます。`).

**β1-1(e) 챌린지 단어 카드 등 — PASS**(`b4-topic.mjs`, `GET /api/v1/challenges/today` 만 모의, 세트 생성 POST 는 서버로 안 보내고 끊음): 챌린지 주제 카드 TODO·SHORT(한 세트 더) × 3폭 — 카드 글자에 「방식」 0·`radiogroup` 0·가로 넘침 0(TODO 233.5px·SHORT 300.5px), [내 단어장으로 풀기] 펼침 — 「카드 장수」 그룹+[시작하기] 있고 「방식」 0(높이 TODO 470/451/451·SHORT 537/518/518), 대기 화면 `/study/today/words/new` 본문 「「자기소개」 · 10장」 — 「방식」「4지선다」「뒤집기」 0.

**β1-2 최종 결과**: `b2-deck.mjs`(UI 로 시작→한 세트 DONE) + 재검증 모두 반영 시 **FAIL 0**(스크립트 오류 5건 제외, 제품 결함 0). 가로 스와이프·탭 임계는 px 기준이라 390×844 한 폭에서만 측정(폭 무관).
- **결함 #1 (Medium)** Q4 위험 조합 360×740 — 위 표. 재현: QA3 쿠키, 360×740 `isMobile+hasTouch`, 위 `POST` 로 세트 생성(주제 카드가 ≤5 인 날) → `/study/today/words/<id>` → 카드 탭 → 보기 1개 탭. 기대: 알림·듣기 줄·카드가 서로 겹치지 않음(하한 200 보장 또는 알림 닫힘). 실제: 카드 위·아래 10.1px 씩 이웃을 덮음. 원인 추정: 무대 `flex-1` 높이 = 740 − (BackBar 52 + 진행 48 + 출처 줄 23.2 + 알림 63 + 듣기 줄 44 + 힌트 18 + 보기 240 + 도구 72) = 약 180 → 카드 `min-h-[200px]` 가 무대보다 커서 `items-center` 로 위아래로 번짐.
- **관찰 #2 (Low)** 단어 0개(첫 사용자) 홈 점프 +9.7/+29.2px — 위 β1-1.
- **관찰 #3** 서버 쓰기 응답이 0.2~1.5초(공유 NAS COMMIT) — 화면 시험은 상태 변화를 대기해 읽어야 한다(고정 sleep 금지).

## β1 종료 상태 · β2 인계

- **LLM 호출 0**: QA3 `AiJob` 0→0, QA4 3→3(시작값 그대로) — 각 스크립트 전후 대조 8회 모두 동일, `ps` 로 `claude --print` 0(수시 확인). TTS 는 `page.route` 모의만(서버 `/api/v1/speech/*` 로 나간 요청 0). QA3 의 공부한 날 = **1일**(`DAILY 2026-10-12` 한 행) → A11 가드 미충족.
- **QA3 현재(23:51 심음→00:13)**: WordEntry 676 · VocabSession **33(DONE 30·ABANDONED 3)·진행 중 0** · VocabAttempt 162 · StudyLog 30 · StatsSnapshot 31(`VOCAB_SESSION` 30+`DAILY` 1) · RepetitionItem 36 · LearningObservation 147 · AiJob 0. 세트 날짜 전부 **2026-10-12**. **β2 주의: DONE 세트는 10-12(KST) 안에서만 — 10-13 00:00 이후 DONE 이 생기면 공부한 날 2일+반복 36개로 A11(LLM) 잡이 걸린다.** 그 전에 QA3 를 정리(`qa059/cleanup34.ts --yes`)하면 공부한 날이 0 으로 돌아간다.
- **QA4**: 심은 것 0, 단어 0·세트 0(홈 빈 상태 시험용), `AiJob 3` 은 시작값.
- **서버**: `127.0.0.1:3011` PID **2798375** 살려 둠(`ss -ltnp` 확인). **쿠키**: c3·c4 23:51 발급 → **00:51 만료** — 재발급 `cd ~/.node-local/thekaiwa-rev059 && QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts $S/c3`(QA4 = `QA_ACCOUNT=4 … c4`), `S=/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/q059`.
- **도구**: scratchpad `q059/b1/` — `lib.mjs`·`dlib.mjs`(헬퍼)·`b1-home-static/sweep/jump.mjs`(홈)·`b2-deck.mjs`(UI 로 5장 세트 풀기)·`b3-heights.mjs`(`W=360 H=740 EXTRAS=0|1`)·`b4-topic.mjs`(챌린지 카드 모의)·`b5n.mjs`(Q4 자연 재현)·`b6-misc.mjs`. 미러 `qa059/{counts34,cleanup34,dbcard}.ts`.
- **정리 목록(미정리)**: QA3 시드·세트·기록 전부(`cleanup34.ts`), 서버 PID 2798375(β2 가 마지막에), 쿠키 c3·c4·c1·c2, 미러 `.env`·`qa059/`, scratchpad `q059/`. 스크린숏 2장은 이미 삭제(`산출물 정리: 2개 삭제`, `/tmp/qa-artifacts/TheKaiwa/task-059` 폴더 제거 확인). 내가 띄운 프로세스: 없음(Playwright 크롬은 스크립트 종료와 함께 모두 종료, 서버는 α 것을 그대로).
- **NOT_VERIFIED(β1 범위 밖·불가)**: 어두운 화면 Q7(명암비), 키보드 Q16·화면 읽기 Q17·저장소 Q18·엔진명 Q19(β2), 실기기(밀기/탭 손 느낌·TalkBack·실제 TTS·S25+ 글꼴 줄바꿈), 소리 `blocked` 안내(헤드리스 불가).

---

# 갈래 β2 — 결과 화면·이전 세트 호환·키보드/접근성/다크·계획표 요약 (QA, 2026-10-12 00:17~ KST)

> 환경: 서버 3011(PID 2798375, `ss -ltnp` 재확인) · 브라우저 = `playwright-core`+`/usr/bin/google-chrome` 헤드리스, `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:'reduce'` · 쿠키 c1~c4 **00:17 재발급**(01:17 만료) · 도구(저장소 밖): scratchpad `q059/b2/{b7-setup,b7-del,b8-result,b8-shot}.mjs`·`b7-sessions.json`·`old-ids.json`, 미러 `qa059/b2list.ts`. 서버 PID·`claude --print` 0 수시 확인.
> **심은 것(β2 추가, 전부 QA3·날짜 10-12, 정리 = `qa059/cleanup34.ts --yes`로 함께)**: DONE 세트 4개 — X(혼합: 객관식 틀림★·스스로 몰랐어요★·객관식 맞힘·스스로 알았어요·건너뜀, 보관) · Y(같은 구성 + 카드 0·1 의 단어 `DELETE`(ナイフ·大切) → `wordId:null`, 보관) · P(객관식만: 맞힘2·틀림2★·건너뜀, 보관) · Q(스스로만: 알았어요2·몰랐어요2★·건너뜀, 보관). 단어 2개 삭제(QA3 WordEntry 676→674). ids 는 `b7-sessions.json`.

## 체크포인트 β2-1 — 결과 화면(D5) PASS (00:25)

- **LLM 호출 0**: 세트 4개 finish 전후 `AiJob` QA3 0→0·QA4 3→3, 결과 화면 측정 3회 전후도 동일, `ps` `claude --print` 0.
- (a) **섞인 세트**(X·Y·기존 `3knelm`) — 3폭(360×740·390×844·412×892) 모두: 제목 「5장 중 2장 맞혔어요」, 타일 `2 맞힘/2 틀림/1 건너뜀`(합산 그대로), 둘째 줄 「걸린 시간 7초 · 다시 볼 카드 2장」, **구분 한 줄 「객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요」**(§23-8 ⑫ 원문 일치, 걸린 시간 줄 바로 아래) · **방식 뱃지**: 전체 목록 5행 = 객관식 맞힘/객관식 틀림/스스로 알았어요/스스로 몰랐어요/건너뜀(3knelm 전체 확인), 「틀린 단어 2」·「다시 볼 카드 2」 두 목록의 행도 방식 뱃지(「객관식 틀림」·「스스로 몰랐어요」), 행 둘째 줄에 「정답 처음으로 · 내 답 왜」(객관식 오답만 내 답, 뱃지에 내 답 없음 = §23-12 ⑧ 일치).
- (b) **섞이지 않은 세트** — 구분 한 줄 **없음**·방식 뱃지 **없음**: P(객관식만·FLIP) 제목 「…맞혔어요」, 전체 목록만 맞힘/틀림/건너뜀 뱃지, 틀린 단어·다시 볼 카드 목록 행은 ★·›만 · Q(스스로만) 제목 **「…알았어요」**·같은 모양 · `stt0in`(전부 건너뜀) 「5장 중 0장 알았어요」·타일 0/0/5 · `gtamqj`(CHOICE 이전 세트) 「5장 중 1장 맞혔어요」·부제 「오늘 · **4지선다** · 5장」 · `a478zj`(주제 FLIP) 부제 「오늘 · 5장 · 「자기소개」」(방식 이름 없음), 전체 목록 행 오른쪽 「맞힘/건너뜀+[단어장에 넣기]」.
- (c) 틀린 단어 행 링크 `/drawer/words?word=<id>`(지운 단어 행은 링크 없음 `DIV`) · 미보관 세트 [☆ 이 세트 보관](298×48) · 보관 세트 「★ 보관한 세트예요」+[다시 풀기]·[보관 풀기](144/146×48) · 상단 [오늘로] 44×44·하단 [오늘로] 159×48·[단어장 보기] 161×48 · 「전체 카드 5장 보기」 summary 328×44. 모든 컨트롤 높이 ≥44(under44 0).
- (d) **360px 최악 행** — Y 틀린 단어: `[지운 단어 61.5px][스스로 몰랐어요 93.3px][★ 14px]` = 오른쪽 상자 180.8px(`›` 없음, 지운 단어는 링크 아님) → 왼쪽 글줄 109.2px. `[객관식 틀림 72][★ 14][› 4.7]` 102.8px(링크 행). **가로 넘침 0**(문서 `scrollWidth−clientWidth` 0, `right>clientWidth` 요소 0, 행 `scrollWidth>clientWidth` 0), 뱃지 높이 22px 한 줄(줄바꿈 없음), 스크린숏 확인: 뱃지가 한 줄로 나란히, 표제어(ナイフ·大切+ルビ)·한글 발음·「정답 …」 줄이 겹치거나 잘리지 않음. 행 높이 75~96px(루비·발음 줄에 따라). 앱 문구는 「**지운 단어**」(Leader 메시지의 「삭제된 단어」와 다름 — 기존 문구, 결함 아님).
- (e) 새로고침: 위 측정이 전부 직접 URL 진입(전체 새 로드)에서 나온 모양이며 같음. 보관 세트 목록에서 열기는 β2-2(b)에서 다시 확인.
- 참고: 결과 `main` 스크롤 한 곳(`main` scrollHeight 988~1476 > clientHeight, 다른 안쪽 스크롤 상자 없음).
- **남은 일**: β2-2 → β2-3 → β2-4. **다음 첫 명령**: `cd scratchpad/q059/b2 && node b9-legacy.mjs`(작성 예정). **주의**: 시각 00:25 이후 쿠키 c1~c4 01:17 만료, KST 10-13 00:00 이후 QA3 DONE 금지.

## 체크포인트 β2-2 — 이전 세트 호환·다시 풀기(D6) PASS (00:48 KST, 스크립트 b9a·b9b·b9c 합 PASS 33/FAIL 0 — b9a 첫 실행의 A1 FAIL 3 은 내 필터가 KeptSets 아닌 `li` 3개를 섞은 스크립트 오류, b9b 에서 정확한 필터로 3폭 PASS 재측정)

- **(a) 이전 4지선다·진행 중**(QA3 `POST /sessions {count:5, mode:'CHOICE'}` → 카드 7키(`order,wordId,surface,reading,flagged,answered,choices`)·정답 미노출, API 로 2장 답함): 홈 「풀던 세트가 있어요」 줄 **「오늘 시작 · 4지선다 · 5장 중 2장 답함」**(`modeTag`), [이어서 풀기] → 덱 부제 **「4지선다 · 5장」**, 이어 풀기 알림 「이어서 풀어요 · 2장은 이미 답했어요.」, 보기 4개(`1 저쪽·2 양복…`)가 **처음부터 열림**, [뜻 보기]·[객관식] 버튼 없음, 카드 글자 「あちら 한글 발음: […]」뿐(뜻·정답 미노출), **답하기 전 듣기 줄 0**, 터치 힌트 「← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시」. **C(영문·한글 자판 `code:'KeyC'`) 무시**(live 줄·카드·보기 수 불변). 보기 탭 → `✓ 정답`+카드 「✓ 맞았어요 저쪽 あちらです。…」+**듣기 줄 [단어 듣기]·[예문 듣기] 44px** 가 **답한 뒤에만** 나타남. 새 FLIP 세트(홈 시작·다시 풀기)의 부제/줄에는 방식 이름 없음(「오늘의 단어 5장」·「오늘 시작 · 5장 중 0장 답함」).
- **보관 세트 줄(`modeTagAfter`)** 3폭 PASS: QA3 5줄 = 「오늘 · 5장」×4 + **「오늘 · 5장 · 4지선다」×1**(이전 CHOICE 세트만), 둘째 줄 「맞힘 2 · 틀림 2 · 건너뜀 1」, 행 높이 64.5~65.5, [다시 풀기] 91×48, 가로 넘침 0. QA2 줄: 「어제 · 5장」·「어제 · 5장 · 4지선다」·「어제 · 10장」.
- **보관 줄·결과 화면 [다시 풀기]**(X 줄, 이전 CHOICE `gtamqj` 결과): 새 세트 `mode FLIP·downgraded false·replayOfId=원본`, 카드 전부 `choices` 4개+`meaning`, 덱 = **앞면 [뜻 보기](52)+[객관식](52)**, 힌트 「카드를 누르면 객관식으로 골라요」, 부제 방식 이름 없음. 결과 화면 부제는 이전 세트에서 「오늘 · 4지선다 · 5장」, 새 세트 부제는 「5장」.
- **(e) 보관 줄 → 결과 열기**: X 행 탭 → 같은 결과(「5장 중 2장 맞혔어요」·구분 한 줄·「★ 보관한 세트예요」), 문서 넘침 0, 뒤로가기로 홈 복귀.
- **(b) 보기 없는 풀**(QA2 `nochoice on` — 활성 5개·뜻 3종): 홈 [시작하기] → `POST {count:10,category:null}` 200, 세트 5장·`downgraded:false`·**카드에 `choices` 키 없음**, 덱 = [객관식] 없음·**[뜻 보기] 단독 358px(전폭)**·카드 안내 「탭하면 뜻이 보여요」·알림 **「뜻이 서로 다른 단어가 4개보다 적어서 이번엔 객관식 없이 풀어요.」**(§23-8 ⑤ 원문), **C 무시**, 카드 탭 → 뜻 보기 면(듣기 줄·[알았어요][몰랐어요]), 기록 0, 홈 줄 「오늘 시작 · 5장 중 0장 답함」(방식 이름 없음). **보관 줄 [다시 풀기]·결과 화면 [다시 풀기]**(QA2 M1 10장, 풀이 보기 없는 상태) → 새 세트 `choices` 0·덱 알림 같은 문구·[객관식] 없음(두 경로 모두). 주제 세트 다시 풀기(주제 카드 풀 기준)는 풀이 영향 없이 5장 모두 `choices` 있음·알림 없음(정상, 보기 재료가 주제 카드). **홈·결과 화면 자체에는 알림이 없다 — 알림은 세트를 만든 화면(홈 시작·보관 줄 다시 풀기·결과 다시 풀기)이 남겨 덱 첫 열기에 한 번 보이는 설계(§23-4 D)와 일치.**
- **(d) 주제·챌린지·진입 화면**: 주제 세트(API `generate:false`, QA3): 덱 부제 「「자기소개」 · 2장」(오늘 쓸 수 있는 주제 카드 2장이라 `fewer` 알림), 방식 이름·「뒤집기」·「4지선다」 0, [뜻 보기][객관식] 있음. 챌린지 카드·[내 단어장으로 풀기]·대기 화면은 β1 에서 확인(방식 줄 0). **생성 요청 본문 캡처(POST 는 서버로 안 보냄)**: 홈 [시작하기](5장) = `{"count":5,"category":null}`, 옛 주제 시작 토큰(`sessionStorage kaiwa.vocab.topicStart` 에 `mode:'CHOICE'`) → 대기 화면 요청 = `{"topicId":…,"count":5,"generate":true}`, **`mode` 키 0**.
- **(e) 저장소**: `localStorage['kaiwa.vocab.mode']='CHOICE'`(+`readingDefault`='keep'·`category`='xx')를 심고 홈 방문 → `mode` **삭제됨(null)**, 다른 두 키 그대로.
- **LLM 호출 0**: AiJob QA1 14→14·QA2 0→0·QA3 0→0·QA4 3→3(스크립트 전후), `ps` `claude --print` 0. TTS `/api/v1/speech/*` 는 `page.route` abort(서버 호출 0). QA2·QA1 은 ABANDON 만(DONE 0).
- **관찰(결함 아님)**: ① 덱 알림 `few`·`deleted` 문구에 「뒤집기 카드로 풀어요」가 남아 있음(`DeckNotice.tsx`) — 클라이언트가 `mode:'CHOICE'` 를 안 보내므로 새 화면에서는 나오지 않고 옛 번들이 만든 강등 세트에서만 보임(23-4 D 대로). ② 위 (b) 결과로 「뒤집기」「4지선다」 글자는 이전 CHOICE 세트 표시 외에는 어디에도 나오지 않음.
- **남은 일**: β2-3(키보드·접근성·표시 설정·다크) → β2-4(계획표). **다음 첫 명령**: `cd scratchpad/q059/b2 && node b10-keys.mjs`(작성 예정, QA3 새 FLIP 세트). **주의**: QA3 에 **이전 CHOICE 진행 중 세트 1개**(답한 3장) — 새 세트를 만들려면 먼저 API `finish`(DONE, 10-12 안)로 닫아야 함. 쿠키 c1~c4 00:17 발급(01:17 만료).

## 체크포인트 β2-3 — 키보드·접근성·표시 설정·다크 (00:30 KST) — 결함 0건, 관찰 3건·NOT_VERIFIED 별도

스크립트: `b10-keys.mjs`(26항목: PASS 25 / FAIL 1 = **K9b 는 내 단언 오류**) · `b11-display.mjs` · `b12-rt.mjs`·`b12b.mjs` · `b14-fail.mjs` · `clib.mjs`(대비 측정 = 캔버스로 색→rgba, 조상 배경 합성, WCAG 상대휘도) — 같은 페이지에서 `emulateMedia({colorScheme})` 로 라이트↔다크 전환 측정.

**(a) 키** (390×844, QA3 새 FLIP 5장 — 서버 채점·요청 본문까지 대조): 앞면 닫힘에서 `1` 무시(요청 0) · `C` → 보기 4개 열림, 초점 **1번 보기**, 카드 안내 「카드를 다시 누르면 객관식을 닫아요」, 요청 0 · 열림에서 초점 해제 후 `Space`·`Enter` 무시(요청 0) · 열림에서 `→` = 막힘 「먼저 답을 골라 주세요」 · `C` 다시 → 닫힘, 초점 **[객관식]**(`aria-expanded=false`) · **한글 자판**(`key:'ㅊ'`,`code:'KeyC'`) → 열림 · 숫자 `N`(오답 보기) → `POST {order,chosenText,responseMs,flagged}` 키 4개뿐·`chosenText` = 보기 N, 서버 채점, 초점 [다음 카드 ›], 듣기 줄 44px · `→` 다음 카드(초점 [뜻 보기]) · 앞면 닫힘 `→` = 「뜻 보기나 객관식으로 먼저 답해 주세요」 · `Space` → 뜻 보기 면, 초점 **[알았어요]**, live 「뜻이 보여요」 · 뜻 보기 면 `C` 무시(보기 0·live 변화 없음 — **K9b 는 직전 막힘 힌트의 남은 문구(「뜻 보기나 객관식…」)를 내 정규식이 잡은 단언 오류, 실제 증거는 `choices 0`·polite live 가 「뜻이 보여요」 그대로**) · 뜻 보기 면 `→` = 「알았어요·몰랐어요를 먼저 골라 주세요」 · `2` → `POST {order,selfResult:'WRONG',responseMs}`(chosenText·skipped 키 없음), 0.4초 뒤 자동 다음 · 열림 상태 `S` → `{order,skipped:true}`(열림에서도 건너뜀) · `F` → `{order,flagged:true}`·`표시 aria-pressed=true` · `R` → 카드 읽기 줄 토글 · `Space` 뒤 `1` → `selfResult CORRECT` · 마지막 카드 `S` 뒤 [결과 보기 ›]. **이전 4지선다 세트에서 `C`(영문·한글 자판) 무시** — β2-2 C3·C3b. 한 카드에 `chosenText`·`selfResult` 를 같이 보낸 본문 0(요청 전부 기록·대조).
**(b) 화면 읽기·접근 이름**: 덱 polite live 줄 문구 원문 일치 — 「객관식 보기 4개가 나왔어요」·「객관식을 닫았어요」·「뜻이 보여요」·「틀렸어요. 정답 {뜻}」(현행 코드 문구)·「단어 소리 재생 중」·「소리를 멈췄어요」(사용자가 멈춤 누른 직후)·카드마다 「N번째 카드, {표제어}」. **GestureHint 상시 마운트 줄 2개**(`role=status`·`role=alert`): 세 상태(앞면·열림·답함·듣기 재생·실패·세트 끝) 동안 같은 DOM 요소·같은 역할 유지(요소 참조 보존 확인, 재마운트·역할 교체 0). 실패 안내는 `role=alert`(「목소리를 불러오지 못했어요 · 다시 눌러 주세요」), 막힘 힌트는 `role=status`. 버튼 접근 이름: 보기 「1번, 안녕히 가세요」…, 듣기 재생 중 「멈추기[단어 소리 멈추기]」(β1 에서 불러오는 중 「단어 불러오는 중, 누르면 취소」 확인), [객관식] `aria-expanded=false`, BackBar 「오늘로」.
**(c) 히라가나·한글 표시**(프로필 GET 모의, PUT 서버 차단): 끔 → 덱 뒷면 **예문 루비·한글 발음 줄 사라짐**(`한글 발음:` 0, 예문 루비 0), 켬 → 돌아옴(`한글 발음` 4줄). 결과 목록: 끔 → `<rt>` 0·한글 줄 0, 켬 → rt 6·한글 줄 16. **소리 요청 본문 `text` = 두 설정에서 동일**(`走る`, `公園を走ります。` — 루비·한글 없음). ⚠ **관찰 O-1**: 끔이어도 덱 카드 **표제어 위 읽기 루비**(예 日曜日→にちようび, 앞·뒷면)는 남는다 — 덱 자체 「읽기」 토글(R)이 정하는 기존 동작(`git diff HEAD` 에 이 로직 변경 없음, 소유 task-008/033). 결함으로 올리지 않고 Leader 판단용.
**(d) 어두운 화면**(`prefers-color-scheme: dark`): 토큰 반전 확인(본문 배경 rgb(246,247,244)→rgb(20,24,22), 글자 rgb(90,99,89)→rgb(174,182,172)). **글자 명암비 전부 ≥4.5 — 라이트/다크**: 표제어 15.81/13.77 · 앞면 안내 6.24/7.68 · [뜻 보기](흰/어두운 글자 on 주황) 4.80/6.17 · [객관식]·도구 15.81/13.77 · 고정 힌트 5.81/8.61 · 객관식 ✓ 정답 5.27/5.59 · ✗ 내 답·띠 「틀렸어요」 5.32/6.23 · 건너뜀 띠 5.44/6.77 · 듣기 idle 15.81/13.77 · **듣기 재생 중(`bg-ink text-surface`) 15.81/13.77** · **듣기 실패(`border-bad text-bad`) 글자 6.54/6.69·테두리 6.08/7.5** · **자막만(mute `bg-surface2 text-ink2`) 5.44/6.77** · 결과: 제목 15.81/13.77, 타일 라벨 6.24/7.68, 걸린 시간·**구분 한 줄 6.24/7.68**, 방식 뱃지 5개 5.27~5.44/5.59~6.77, **지운 단어 뱃지 5.44/6.77**, ★ 4.80/5.22, [다시 풀기]·[오늘로] 4.80/6.17. **테두리(3:1)**: 열림 카드 accent 4.46/5.85 · 듣기 재생 중 14.7/15.4 · 실패 6.08/7.5 · 보기 ✓/✗ 테두리 5.8~7.5 ✓. **관찰 O-2**: 중립 외곽선(`--line` — [객관식]·도구·보기·듣기 idle 의 회색 테두리)은 1.22(라이트)/1.55(다크) — 기존 토큰이고 이 버튼들은 글자 라벨이 식별을 맡으므로 이번 변경의 결함으로 올리지 않음. **하드코딩 색**: 소스 grep(`src/components/vocab/*.tsx`·`cardFirst.ts`의 `#hex`·`rgb(`·`text-white` 류·`[#…]`) 0건(주석의 `#158` 같은 번호만) + 렌더 스캔(덱 74요소·결과 186요소, 글자·배경·테두리색을 루트 토큰 21/23개와 대조) **토큰 외 색 0**(라이트·다크 모두).
**NOT_VERIFIED**: TalkBack(카드 이중 탭이 만드는 이벤트·읽기 순서·`aria-expanded` 낭독 — 실기기) · 소리 `blocked` 안내문·`ring-2 ring-accent` 고리의 대비(헤드리스는 오디오가 안 막힘) · 스스로 답 live 「알았어요/몰랐어요로 기록했어요」 낭독(0.4초 자동 다음 때문에 polite 줄이 곧 「N번째 카드…」로 덮여 스크립트에서 못 잡음 — 문구는 §23-6 C 와 코드 대조만) · 실제 TTS 음성·S25+ 글꼴/터치 손 느낌.
**관찰 O-3 (Low, 기존 동작)**: 막힘 힌트(2초)가 `Space` 로 뜻 보기 면에 넘어간 뒤에도 남은 시간 동안 「뜻 보기나 객관식으로 먼저 답해 주세요」로 보임(K9 live) — 힌트 타이머 기존 규칙.
**관찰 O-4 (추측, 미실행)**: `C` 로 열면 초점이 1번 보기라 Space/Enter 가 그 보기를 그대로 고른다(§23-6 「초점이 버튼이면 맡김」의 결과, 의도로 보임) — 실행해 확인하지 않았다.

## 체크포인트 β2-4 — 계획표 날짜 시트(Leader 결정 4) PASS (00:36)
`/plan`(QA3, 3폭)에서 「10월 12일 월요일, 오늘, 출석, 공부 1가지: 오늘의 단어」 칸을 눌러 날짜 시트: 시트 안 오늘의 단어 줄이 **「오늘의 단어 5장(카드) · 맞힘 2 · 틀림 2 · 건너뜀 1」**(새 FLIP 세트 23줄), 이전 CHOICE 세트는 **「…5장(보기 고르기) · …」**(13줄), 주제 세트 「주제 단어 「자기소개」 5장(카드) · …」. 새 코드가 만든 기록에 「뒤집기」 0. **저장된 옛 문구는 그대로**: 옛 문구를 흉내 낸 `StudyLog`(QA3 에 직접 삽입 1행 — `result.qaFixture='task-059-b2-legacy-summary'`, id `cmv3zgwdm0001w1gtx7l1txu2`, 정리 시 userId 삭제에 포함) 「오늘의 단어 10장(뒤집기) · 맞힘 6 · 틀림 3 · 건너뜀 1」 이 시트에 **그대로 1줄** 보임(`displaySummary` 는 REVIEW 접두사만 바꾸고 나머지는 저장 문구). 3폭 모두 시트 가로 넘침 0·문서 넘침 0. **QA1 은 `StudyLog` 가 0행, QA2 의 4행은 모두 새 코드가 만든 「카드」/「보기 고르기」**라 「뒤집기」 실기록이 없어 위 삽입 행으로 대체(코드: `plan/logic.ts displaySummary`).

## β2 종료 상태 · 정리 인계 (00:36 KST)
- **LLM 호출 0**: `AiJob` QA1 14→14 · QA2 0→0 · QA3 0→0 · QA4 3→3(β2 스크립트 15회 전후 모두 동일), `ps` `claude --print` 0(수시 확인). TTS·speech 호출은 `page.route` 모의(서버 `/api/v1/speech/*` 로 나간 요청 0). QA1·QA2 는 ABANDON 만, QA3 DONE 은 전부 KST 10-12 안(공부한 날 1일 유지 → A11 가드 미충족).
- **데이터(정리 대상, 지우지 않음)**: QA3 = WordEntry **674**(676 중 `ナイフ`·`大切` 삭제) · VocabSession **47(DONE 36·ABANDONED 11, 진행 중 0)** · VocabAttempt 229 · StudyLog **37**(36 + 위 픽스처 1) · StatsSnapshot 37 · RepetitionItem 58 · LearningObservation 177 · AiJob 0 · 보관(kept) 세트 5개(X·Y·P·Q·gtamqj). QA1 = 변화 없음(55 ABANDONED). QA2 = 변화 없음(세트 18개 = α 14 + β2 ABANDONED 4, WordEntry 679·SEED 보관 해제 상태로 복원 확인 `active 679`). QA4 = 0(AiJob 3 시작값). 정리 = `qa059/cleanup34.ts --yes`(QA3·QA4), `qa059/cleanup.ts --yes`(QA1·QA2) 후 `counts34.ts`·`counts.ts` 대조. β2 추가 목록은 `manifest.json` 의 `b2` 키.
- **서버**: `127.0.0.1:3011` PID 2798375 살려 둠. **쿠키** c1~c4 00:17 발급 → 01:17 만료. 내가 띄운 프로세스 없음(Playwright 크롬 전부 종료 — 최근 40분 내 시작한 headless 크롬 0, 남은 headless 크롬은 9-15 에 시작된 다른 도구 것).
- **산출물 정리**: 스크린숏 6장(`res-X-360`·`res-Y-360`·`r-Y-360-top/sec0/sec1/sec2`) 삭제, `/tmp/qa-artifacts/TheKaiwa/task-059` 폴더 제거 확인(`산출물 정리: 6개 삭제`).
- 결함 번호: β2 신규 결함 **0건**(β1 결함 #1 은 별도 수정 중, 이번 갈래에서 재검증 안 함). 관찰 O-1~O-4.

---

# 갈래 γ — 수정본(결함 #1 수정) 새 빌드 재측정 + 전체 정리 (QA, 2026-10-12 00:38~ KST)

> 환경: 수정본 미러 `~/.node-local/thekaiwa-rev059b`(HEAD `10a4e88` + task-059 34개 파일, 게이트 tsc=0 eslint=0 test=0 build=0). 도구(저장소 밖): scratchpad `q059/g/{lib,dlib}.mjs` + 스크립트, 미러 `thekaiwa-rev059b/qa059/`(옛 미러에서 복사). 규칙: DONE 세트 새로 만들지 않음(답한 뒤 상태는 IN_PROGRESS 로 두고 `qa059/dropsess.ts` 로 세트 삭제 — finish 를 부르지 않으니 StudyLog·Stats·반복 항목 0, 지운 세트의 VocabAttempt 는 cascade).

## 체크포인트 γ-1 — 서버 교체·검증 PASS (00:40)
- 옛 서버: `ss -ltnp` 리스너 PID 2798375, `/proc/2798375/cwd` = `thekaiwa-rev059` 확인 → 그 PID 로만 `kill`, 3011 비움 확인.
- 새 서버: `cd ~/.node-local/thekaiwa-rev059b && NODE_ENV=production next start -p 3011 -H 127.0.0.1` → 리스너 PID **2968522**, `/proc/2968522/cwd` = `/home/brownjeon/.node-local/thekaiwa-rev059b` 확인, `GET /api/health` 200(status degraded — stt_analysis_worker, 로컬 환경 기존 상태, 이번 변경과 무관). `claude --print` 프로세스 0.
- 수정 클래스: 새 빌드 `.next/static/chunks/1l5y97ht70l0p.css` 에 `.min-h-\[224px\]{min-height:224px}` 있음, **서버가 그 CSS 를 실제로 내려줌**(curl grep 확인), 옛 빌드(`thekaiwa-rev059/.next/static`)에는 0개, 소스 `VocabDeck.tsx:220` = `flex min-h-[224px] flex-1 items-center justify-center px-4 py-3`(NFS 저장소와 동일).
- 쿠키 c3·c4 00:39 재발급(01:39 만료), c1·c2 는 00:17 발급(01:17 만료 — 이번 갈래는 QA3·QA4 만 사용).
- **남은 일**: γ-2(a~e) → γ-3 → γ-4. **다음 첫 명령**: `cd scratchpad/q059/g && node g1-defect.mjs`(작성 예정). **주의**: 서버 PID 2968522(3011) 켜 둠, 옛 미러 `thekaiwa-rev059/.env` 와 새 미러 `.env`·`qa059/` 는 γ-4 에서 정리.

## 체크포인트 γ-2 — 결함 #1 수정본 재측정 (00:45 KST) — 결함 #1 PASS(겹침 0), 부작용·챌린지 조합 실측 후속 1건
스크립트(scratchpad `q059/g/g1.mjs`, GROUP=A~E, 결과 JSON `g1-*.json`): 환경 = `isMobile+hasTouch` DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:reduce`, QA3, 세트는 만든 뒤 `IN_PROGRESS` 로만 두고(`finish` 0회) `dropsess.ts` 로 삭제, `/api/v1/speech/**` abort, 챌린지는 `GET /api/v1/challenges/today` 만 `page.route` 모의. 요소 위치는 `getBoundingClientRect`, 카드↔형제 요소 교차는 세로 교차 > 0.5px 로 판정, 스크롤 = `main.scrollHeight−clientHeight`(정수 반올림)·`scrollTop`, [다음 카드] 가시 높이 = 버튼 rect ∩ `main` rect ∩ 뷰포트, 보이는 부분 가운데 `elementFromPoint` 가 그 버튼인지(hit).

**(a) 결함 조합 360×740 + 주제 세트(`generate:false`, 오늘 쓸 수 있는 카드 2장 → 서버 `fewer` 알림 2줄 63px) + 답한 뒤 — 전/후**

| 항목 | 수정 전(β1) | 수정 후(γ) | 기대 |
|---|---|---|---|
| 카드 높이 | 200(하한) | **200** | 200 |
| 무대 안쪽 | 155.8 | **200** | 200 |
| 카드가 무대 밖으로(위/아래) | 10.1 / 10.1 | **0 / 0** | 0 |
| 카드↔알림·듣기 줄·힌트 교차 | 있음(알림 10.1·듣기 버튼 23% 덮음) | **없음(교차 0)** | 0 |
| `main` 세로 스크롤(scrollHeight−clientHeight) | 0 | **44**(자식 하단 784.2 = 740+44.2) | ≈44.2 |
| [다음 카드] 가시 높이 | 52(겹침으로 카드가 가림) | **19.8**(top 720.2, hit=true) | ≈19.8 |
| 문서 가로 넘침 | 0 | 0 | 0 |

- **보이는 19.8px 을 터치 탭 → 다음 카드로 넘어감 PASS**(`touchscreen.tap` 가시 영역 중앙, hit=true). 새 카드로 간 뒤 `main` scrollTop 0·scrollHeight=clientHeight(스크롤 0).
- **알림 [✕] 닫기 → 스크롤 0 으로 복귀 PASS**: 닫기 뒤 sh−ch 0, 카드 218.8(안쪽이 커짐), [다음 카드] 가시 52(top 676).
- **스크롤된 채(맨 아래, scrollTop 44) 왼쪽 밀기 → 다음 카드 PASS**, 이동 뒤 `scrollTop 0`(e 항목 PASS). **스크롤된 채 [다음 카드] 탭**(가시 52) → 다음 카드, 뒤 `scrollTop 0` PASS. **키보드**: 답한 뒤 초점이 [다음 카드 ›] (`preventScroll` 이라 화면은 안 올라옴), **Enter → 다음 카드 PASS**.
- 주제+`fewer`+**보기 열림** 360×740: 카드 200, 무대 안쪽 200, 자식 하단 740.2 → **+0.2** (정수 scrollHeight 라 sh−ch 는 0 — 1px 흔들림 없음), 교차 0.

**(b) 다른 변경 조합**

| 조합 | 전/후 카드 | 후 sh−ch(기대) | 후 [다음 카드] 가시 | 교차 |
|---|---|---|---|---|
| 412×780 주제+fewer 답한 뒤 | 200→200 | **4**(+4.2) | 52 전부(하단 패딩 12 중 4.2 접힘) | 0 |
| 390×800 주제+fewer 답한 뒤 | 215.8→215.8 | **0**(0) | 52 | 0 |
| 360×740 이전 4지선다(`mode:'CHOICE'` 명시)+`few` 2줄 알림 답한 뒤 | 200→200 | **20**(+19.5) | **44.5/52**(하단 7.5px 접힘, 글자 보임) | 0 |
| 360×740 주제+fewer 보기 열림 | 200→200 | 0(+0.2) | — | 0 |
| 412×780 주제+fewer F0 / 열림 | 340 / 239.8 | 0 / 0 | — | 0 |
| 390×800 주제+fewer F0 / 열림 | 340 / 259.8 | 0 / 0 | — | 0 |
| 360×740 주제+fewer F0 | 340 | 0 | — | 0 |

**(c) 챌린지 주제 세트(`#158` 모의, 챌린지 줄 +20.7px — 출처·챌린지 블록 100~143.9) + 알림 + 답한 뒤**

| 화면 | 열림 sh−ch | 답한 뒤 sh−ch | [다음 카드] 가시 (답한 뒤) | 교차 |
|---|---|---|---|---|
| **360×740** | **21**(prev 가시 43.1/52) | **65** | **0** (top 740.9 > main 하단 740 — **도구 줄 [이전][표시][다음 카드] 전체가 접힘선 아래**, hit=null) | 0 |
| 412×780 | 0 | **25** | 39.1/52 (글자 보임) | 0 |
| 390×800 | 0 | **5** | 52 (전부) | 0 |

  감사(REV-187)가 계산으로 예측한 +21/+25/+5/+65 와 **정확히 일치**. 360×740 답한 뒤에서 도구 줄이 완전히 가려지는 것이 **실측으로 확인**됨. 이 상태에서 다음 카드로 가는 길(전부 실측): ① 카드 왼쪽 밀기(스크롤된 채·안 된 채 모두) → **PASS** ② 알림 [✕](44×44, 화면 상단) → 닫으면 도구 줄 가시 52·스크롤 2 → PASS ③ **카드 밖(힌트 줄)에서 위로 터치 드래그(120px) → `main` scrollTop 65 → [다음 카드] 가시 52 → 탭하면 다음 카드로 → PASS** ④ 키보드 Enter(초점이 [다음 카드]) → PASS ⑤ 힌트 줄 「← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시」는 이 상태에서도 **보임**(top 474.9). → **「도구 줄이 완전히 가려지고 다른 길이 없음」 조건은 충족되지 않는다**(길 5개 실측) → 감사 L-1 은 **Medium 으로 승격하지 않고 Low 유지**를 권한다. 다만 [건너뛰기]·[표시]·[다음 카드] 버튼 자체가 안 보인다는 사실과 「알림을 닫으면 버튼이 나타난다」는 사용자가 알 단서가 없다는 점은 후속 백로그(designer 결정: 감사 제안 ⓐ `scrollIntoView({block:'nearest'})` 또는 ⓑ 정보성 알림 자동 닫기)에 근거가 된다. 실제 챌린지 주제 세트 + 360×740 급 소형 화면 + `fewer`/`topicReason` 알림이 동시에 있어야 나오는 조합이다(S25+ 412×892·앱 390×844 에서는 해당 없음).

**(d) 불변 확인 — 수정 전(β1) 값과 같음 PASS** (일반 N5 5장 세트, 5개 화면 크기 × 상태; 카드 높이 / `main` sh−ch / 교차):

| 상태 | 360×740 | 390×800 | 412×780 | 390×844 | 412×892 | β1 값과 |
|---|---|---|---|---|---|---|
| F0 앞면·닫힘 | 340 | 340 | 340 | 340 | 340 | 동일 |
| F1 보기 열림 | 287.5 | 340 | 327.5 | 340 | 340 | 동일 |
| Ac 객관식 답한 뒤(듣기 줄) | 243.5 | 303.5 | 283.5 | 340 | 340 | 동일 |
| B0 뜻 보기 면 | 340 | 340 | 340 | 340 | 340 | 동일 |
| 이전 4지선다 처음 / 답한 뒤 | 287.5 / 243.5 | 340 / 303.5 | 327.5 / 283.5 | 340 / 340 | 340 / 340 | 동일 |

  위 전부 `main` 스크롤 0·카드↔형제 교차 0·문서 가로 넘침 0·카드 높이 ≥200.
- (f) **자동 다음 경로(스스로 알았어요/몰랐어요, 538~550ms) 재측정은 하지 않았다**(이 수정이 건드리지 않은 경로 + 스스로 답은 기록이 남는 DONE 흐름이라 LLM 규칙상 보류) → NOT_VERIFIED(코드상 무관, `VocabDeck.tsx` 변경은 무대 클래스 한 줄).
- (g) 알림 **3줄**(큰 글꼴) 변형은 실측하지 않음 → NOT_VERIFIED(하한 200 이라 겹침 불가는 코드 근거 REV-187 §6, 스크롤만 늚).
- **LLM 호출 0**: A~E 모든 그룹 전후 `AiJob` QA3 0→0·QA4 3→3, `ps` `claude --print` 0. QA3 DB: 세트 47·시도 229·StudyLog 37·StatsSnapshot 37·반복 58 = γ 시작과 동일(만든 IN_PROGRESS 세트 전부 삭제, finish 0회).
- 결함: **신규 0건**. 결함 #1(겹침) 수정 확인. 후속 관찰 **G-1 (Low, 후속 백로그)** = 위 (c) 360×740+챌린지+알림 답한 뒤 도구 줄 전체 접힘(길 5개 있음).
- **남은 일**: γ-3(소형 회귀: 홈 자리표시·덱 열림/닫힘·정답/오답·이전 4지선다·DONE 세트 결과 열기·콘솔 오류) → γ-4. **다음 첫 명령**: `cd scratchpad/q059/g && node g2-regress.mjs`(작성 예정). **주의**: 서버 PID 2968522(3011), 쿠키 c3·c4 00:39 발급(01:39 만료), QA3 에 IN_PROGRESS 세트 없음.

## 체크포인트 γ-3 — 새 빌드 소형 회귀 PASS 17/17 (00:55 KST)
스크립트 `q059/g/g2-regress.mjs`(17 항목)·`g2-home.mjs`·`g2-home-qa1.mjs`. QA3 FLIP·CHOICE 세트는 IN_PROGRESS 로만 두고 삭제(finish 0회), speech 호출 abort.
- **홈 카드 자리표시 높이 — 같은 상태 기준 수정 전과 동일**: 단어 676개·오늘 끝낸 세트 없음(QA1) **360=230.25 · 390=210.75 · 412=210.75**(수정 전 값과 정확히 같음, 「방식」 줄 0, 문서 가로 넘침 0) · 단어 0개(QA4) **240/240/240**(같음). ⚠ **관찰 G-2 (Low, 기존 동작·task-059 무관)**: QA3 처럼 **오늘 이미 끝낸 세트가 있는 계정**은 카드가 **250.25/230.75/230.75** — 카드 안에 「오늘 2세트를 끝냈어요 · 맞힘 2/10」 한 줄(18px + `mt-0.5` 2px = +20px)이 더 붙는다(`TodayWordsCard.tsx:180`, `HEAD` 에 이미 있는 코드, 값은 `data.recent` 의 오늘 DONE 세트). 이 줄은 자리표시 상수(`TODAY_CARD_H.word` 230.25/210.75)에 들어 있지 않으므로 **오늘 한 세트라도 끝낸 사용자는 로드 뒤 카드가 +20px 커지고 아래 카드가 밀린다**(구조상 상수 대 실측 차이로 계산 — 점프를 따로 재지는 않음). 원래 β1 점프 측정(24조합 0px)은 QA3 에 오늘 DONE 세트가 생기기 전에 재서 이 줄이 없던 상태였다. 이번 수정(무대 클래스 한 줄)과 무관하고 task-059 가 만든 변화도 아니다 → 결함 아님, 후속 백로그(자리표시 상수에 조건부 +20 또는 줄 고정 높이) 참고용.
- **덱 열림/닫힘 PASS**: 앞면 [뜻 보기]+[객관식] 있음·보기 0개 → 카드 탭 → 보기 4개(✓/✗ 없음) → 카드 다시 탭 → 보기 0개·안내 「카드를 누르면 객관식으로 골라요」 · 열고 닫기만으로 답한 카드 0(기록 없음) · 화면 글에 「뒤집기」·「4지선다」 0.
- **보기 정답/오답 PASS**: 오답 → `✗ 내 답`(고른 보기)+`✓ 정답` 정확히 1개 동시, 띠 「틀렸어요」, 보기 전부 `aria-disabled`, 듣기 줄 [단어 듣기][예문 듣기] 각 44px · 정답 → `✓ 정답` 1개·`✗` 0개·띠 「맞았어요」 · 문서 가로 넘침 0.
- **이전 4지선다 세트 PASS**(`mode:'CHOICE'` 명시): 처음부터 보기 4개 열림·[뜻 보기]/[객관식] 버튼 없음·부제 「오늘의 단어 4지선다 · 5장」, 보기 탭 → 서버 채점 `✓ 정답`(오답이면 `✗ 내 답`+`✓ 정답`).
- **기존 DONE 세트(QA3 섞인 세트 X) 결과 화면 PASS**(360/390/412): 「5장 중 2장 맞혔어요」·구분 한 줄 「객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요」 유지·방식 뱃지 8개 렌더·`right>clientWidth` 요소 0·문서 가로 넘침 0·44px 미만 컨트롤 0.
- **콘솔 오류 0**(`console.error`·`pageerror` 전 구간 0건). **LLM 호출 0**: AiJob QA1 14→14·QA3 0→0·QA4 3→3, `ps` `claude --print` 0.
- **남은 일**: γ-4 전체 정리. **다음 첫 명령**: `cd ~/.node-local/thekaiwa-rev059b && node --env-file=.env --import tsx qa059/cleanup.ts`(QA1·QA2 dry-run) → `qa059/cleanup34.ts`(QA3·QA4 dry-run) → 눈으로 확인 후 `--yes`.

## 체크포인트 γ-4 — 전체 정리 완료 (01:00 KST)
- **dry-run 먼저 → 눈으로 확인 → `--yes`**: 대상은 전부 QA 계정 `userId` 한정(`qa-bot`·`qa-bot2` = `cleanup.ts`, `qa-bot3` = `cleanup34.ts`). QA1 `StatsSnapshot`·`StudyLog`·`RepetitionItem`·`LearningObservation(VocabAttempt)` 삭제 0(시작 DAILY 3행 보존), QA2 마커 `QA059` 단어 포함 `WordEntry` 679·세트 18·StudyLog 4·StatsSnapshot 5·반복 16·관찰 30 삭제, QA3 `WordEntry` 674·세트 47·StudyLog 37(옛 문구 픽스처 1행 포함)·StatsSnapshot 37·반복 58·관찰 177 삭제, QA4 건드린 것 없음.
- **정리 전/후 시작 값 대조 (`counts.ts`·`counts34.ts` 출력)**:

| 테이블 | QA1 시작 → 정리 후 | QA2 시작 → 정리 후 | QA3 시작 → 정리 후 | QA4 시작 → 정리 후 |
|---|---|---|---|---|
| Chat / ChatMessage | 3 / 64 → **3 / 64** | 0 / 0 → **0 / 0** | 0 → **0** | 0 → **0** |
| Correction (전체 / ACCEPTED) | 5 / 0 → **5 / 0** | 0 / 0 → **0 / 0** | 0 → **0** | 0 → **0** |
| WordEntry | 0 → **0** (676 삭제) | 0 → **0** (679 삭제) | 0 → **0** (674 삭제) | 0 → **0** |
| VocabSession / VocabAttempt | 0 / 0 → **0 / 0** | 0 / 0 → **0 / 0** | 0 / 0 → **0 / 0** | 0 → **0** |
| StudyLog | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |
| StatsSnapshot | 3(`DAILY 10-03·05·07`) → **3 (보존)** | 0 → **0** | 0 → **0** | 0 → **0** |
| TutorProposal | 8 → **8** | 0 → **0** | 0 → **0** | 0 → **0** |
| RepetitionItem | 0 → **0** | 0 → **0** | 0 → **0** | 0 → **0** |
| LearningObservation | 453 → **453** | 27 → **27** | 0 → **0** | 0 → **0** |
| AiJob | 14 → **14** | 0 → **0** | 0 → **0** | 3 → **3** (시작값 그대로) |
| Profile (레벨/목표/일일) | N5/null/10 → **동일** | **동일** | **동일** | **동일** |

- **서버·프로세스**: 새 서버는 `ss -ltnp` 리스너 PID **2968522**(cwd `thekaiwa-rev059b` 확인) 한 개만 `kill`, PID 사라짐 확인, 포트 3011·3012·8197 모두 비움. 옛 서버 2798375(γ-1)도 종료됨. Playwright 헤드리스 크롬은 스크립트 종료와 함께 전부 종료(남은 headless 크롬 0). `claude --print` 0.
- **삭제한 비밀·임시물**: 쿠키 파일 `q059/c1~c4` 삭제, `~/.node-local/thekaiwa-rev059b/.env`·`thekaiwa-rev059/.env` 삭제(둘 다 부재 확인), `/tmp/qa-artifacts/TheKaiwa/` 폴더 자체 없음(이번 갈래 스크린숏 0장, `산출물 정리: 0개 삭제`), scratchpad `q059/` 전체 비밀 형태 스캔(`thekaiwa_session=`·JWT `eyJ…`·`mysql://`·`DATABASE_URL`·`JWT_SECRET`·`sk-`·`Bearer`) 0건.
- **남은 미정리(Leader 몫, 지우지 않음)**: 미러 폴더 `~/.node-local/thekaiwa-rev059`·`thekaiwa-rev059b`(안에 `.next` 빌드·`qa059/` 도구 스크립트 — 비밀 없음), `thekaiwa-rev059m`·`thekaiwa-rev059bm`·`thekaiwa-dev059*`·`rev059-tree`·`rev059b-tree`, scratchpad `q059/`(스크립트·JSON·서버 로그 — 세션 스크래치패드, 비밀 0건).

## 갈래 γ 결론 (QA 판정)
| 항목 | 판정 | 근거 |
|---|---|---|
| γ-1 서버 교체·검증 | **PASS** | 옛 PID 2798375(cwd rev059) 종료 → 새 PID 2968522(cwd rev059b), `/api/health` 200, 서버가 내려준 CSS 에 `.min-h-\[224px\]{min-height:224px}` 있음(옛 빌드 0개) |
| γ-2 결함 #1 재측정 | **PASS** (결함 #1 수정 확인, 신규 결함 0) | 360×740 결함 조합 카드↔알림·듣기 줄 교차 0·카드 200·`main` 스크롤 44(+44.2)·[다음 카드] 가시 19.8·가시부 탭 이동·알림 닫기 시 스크롤 0·밀기/Enter/스크롤된 채 탭 이동·이동 뒤 scrollTop 0. 불변 대조군 5크기×6상태 전부 수정 전 값과 동일. |
| γ-2(c) 챌린지 조합 | **관찰 G-1 (Low, Medium 승격 안 함)** | 360×740+챌린지+알림 답한 뒤 도구 줄 가시 0(예측 +65 정확히 일치)이나 길 5개 실측(밀기·알림 ✕·카드 밖 드래그 스크롤·Enter·힌트 줄 보임) |
| γ-3 소형 회귀 | **PASS 17/17** | 홈 높이 230.25/210.75/240 동일, 열림/닫힘, 정답/오답, 이전 4지선다, DONE 결과 3폭, 콘솔 오류 0 |
| γ-4 전체 정리 | **PASS** | 시작 값 대조 전부 일치(위 표), 서버·쿠키·.env·포트 정리 |
- **NOT_VERIFIED**: 스스로 답 자동 다음(400ms) 재측정(DONE 흐름이라 LLM 규칙상 보류, 코드 무관), 알림 3줄 변형, TalkBack·실기기 손 느낌·실제 TTS 음성·`blocked` 안내문(β1·β2 에서 이미 분리).
- 결함 목록: **0건**(Critical·High·Medium 0). 관찰 G-1(Low, 위 (c) — 소형 화면+챌린지+알림 조합 도구 줄 접힘, 후속 백로그 근거), G-2(Low, 기존 동작 — 오늘 끝낸 세트가 있으면 홈 카드가 자리표시보다 +20px).
