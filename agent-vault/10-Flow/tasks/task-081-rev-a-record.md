---
task_id: task-081
title: "task-081 감사 A (서버·정본 정합) — reviewer 기록"
type: review-record
tags:
  - type/task
  - domain/lesson
  - domain/review
created: 2026-10-21
updated: 2026-10-21
---

# task-081 감사 A — 서버·정본 정합 (reviewer, Read 전용)

상위: [[task-081-improve-lesson-chunk-step]] · 서버 기록 [[task-081-dev-server1-record]] · [[task-081-dev-server2-record]]

## 판정: **PASS_WITH_NOTES** (REV-A, Critical 0 · High 0 · Medium 1 · Low 6)

실행: 미러 `~/.node-local/thekaiwa-t081int`(감사 대상 서버 파일 7개가 NFS 와 `cmp` 동일함을 확인한 뒤 읽기만) — `node --import tsx --test` 로 새 시험 2파일 24/24 통과. 코드·문서·미러 수정 0, 전체 시험·빌드·서버·DB·LLM 호출 0. 스크래치 스크립트 1건(`scratchpad/rev-081-a-nfd.ts`, `checkPieces` 순수 함수만 호출).

## 확인한 항목 (직접 읽음 = [확실])

| 영역 | 결과 |
|---|---|
| 1 소유자·입력 | `[확실]` 오디오 라우트는 `requireSession` → `rateLimit('tts:'+userId,60)` → `parseAudioBody`(본문 2KB) → `getLessonAudioSource` 의 `findFirst({id,userId})` 순서 그대로. `sub` 는 piece·phrase 에서만 필수(정수 0~23), 다른 kind 의 `sub`(null 포함) 400 `not_allowed`, `text`·`ja` 등 알 수 없는 키 `unknown_key`. 글은 서버가 저장된 `pieces` 로만 만든다(`audioText`: `type===null`·null 줄·키 없는 옛 줄·범위 밖 → null → 400). `progress.pieces.seen`: 객체·`onlyKeys(['seen'])`·길이 ≤ 줄 수·0 ≤ 정수 < 줄 수·중복 400·정렬·합집합 병합, 8KB 선검사 유지, 상태 잠금(`lockLessonForWrite`)·DONE 409 유지. |
| 2 호환 | `[확실]` `readStoredContent`: 옛 수업(quiz 배열)은 **같은 객체** 반환(시험이 `assert.equal` 로 고정), 새 수업은 `{...raw, quiz: []}` 사본(원본 불변), `quiz: null/{}/문자열` 은 손상. 완료: 새 수업(`content.quiz.length===0`)만 `Lesson.score`·응답·`result.quiz` null, StudyLog 요약 «문제» 빠짐·`score/quizCorrect/quizTotal/quizAnswered` 키 생략, 스냅샷 `score:null`·문항 키 생략. 옛 수업은 키 순서·문자열·JSON 바이트까지 시험이 고정(`JSON.stringify` 대조). LESSON 스냅샷은 만들기만 하고 고치는 쓰기 0(시험이 `update` 가 DAILY 행뿐임을 확인). `RepetitionItem` 은 새 수업도 조각·문형 0/0 으로 계속 등록, REVIEW 는 `studiedCount+1` 만 — `wrongCount` 가 레슨으로는 더 늘지 않는다(사용자 결정 D2 공백과 일치, 정본 §37-13 ④ 와 같음). 간격(`intervalDays`)은 정오답과 무관해 일정 영향 없음. |
| 3 제안→채택·6층 | `[확실]` L3(`learning`)에서 `@/modules/conversation` import 0(`content.ts`·`generate.ts`·`lifecycle.ts`·`challenges`·`snapshots` grep). 조각은 conversation `extraCheck` 가 `applyLessonPieces` 로 **같은 `data` 참조**를 제자리 정리(엔진 `schemaValidate.ts` 425·453행이 같은 참조를 돌려줌)한 뒤에야 `toStoredContent` 에 닿는다. 서버 diff(+줄)에 엔진명·모델명 0건. LLM 산출을 채택 없이 다른 테이블에 쓰는 새 경로 0(조각은 레슨 내용 JSON 안에만, 학습 데이터 테이블 행 0). |
| 4 «같음»·null | `[확실]` `checkPieces` 규칙 2 = `join.normalize('NFC') === line.normalize('NFC')`(관용 없음). 위반 줄만 null, 레슨 임계 `위반×2>줄` 이면 1회 재시도, 마지막 시도는 `tolerateInvalidPieces` 로 면책하고 줄만 null — A4(일반·상황 공용 `buildLessonRequest`)와 A5(`buildReviewMixRequest`) 모두 같은 구조, 새 `LessonGenOutput` 타입 일치. **단 아래 M1.** |
| 5 정본 정합 | api-contract #58(`pieces`)·#60(quiz 선택·`quiz ?? []`)·#61(`pieces.seen`·quiz 호환)·#62(score/quiz null)·#62c(`piece|phrase`·`sub`)·#185 노트, domain-model `Lesson.content.dialogue[].pieces`·`StatsSnapshot(LESSON)`·`Challenge.result [null,null]` 이 코드와 일치. 어긋난 곳은 아래 L3. 챌린지 읽기: `quizTotal` 키가 숫자일 때만 숫자(`lessonQuiz`), 같은 날 옛·새면 점수 있는 옛 수업이 대표(`?? -1`), 얼림 `[null,null]`·읽기 허용·한쪽만 null 은 손상 → 재계산 경로. ASK `sources.ts:218·416` 은 `typeof l.score === 'number'` 가드로 null 을 «0점» 으로 읽지 않음. |
| 6 시험 품질 | 아래 «시험 품질». |

## 발견 표

| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| M1 | **Medium** | `src/modules/conversation/structuredResponse/schemas.ts` `lessonPiece`·`lessonDialogueLine`(ja `maxLength 40`·ko `maxLength 30`·`pieces` `minItems 1/maxItems 24`·`slash` required) ↔ `lessonPieces.ts` 규칙 1·4 · `engine/json/schemaValidate.ts:465` | Leader 결정 37-18-1 ⑥ «조각 때문에 수업 생성이 실패하는 일을 만들지 않음» 이 **부분만** 실현됐다. 조각 규칙 중 길이·개수·`ko` 길이는 스키마가 먼저 ajv 하드 위반으로 막아, 한 조각이라도 `ja>40`·`ko>30`·줄의 `pieces` 가 빈 배열/24 초과·`slash` 누락이면 «위반 줄 null 저장» 이 아니라 레슨 전체 재시도 → 2차에서도 같으면 `JsonSchemaError` 로 **레슨 FAILED** 다. `checkPieces` 의 `count`/`ja_length`/`ko_invalid` 이유는 사실상 도달하지 않는 분기(스키마 뒤에서만 보임). | `[확실]` 메커니즘: `runJsonWithRetry` 2차 `evaluateAttempt` 가 ajv 실패면 throw(465행). 직접 호출 `checkPieces('あ。', [{ko:31자}])` → `ko_invalid`(규칙 쪽은 soft). `[가능성 낮음]` 빈도: 저장 레슨 줄 `ja` 중앙값 20·p90 25(PE 기록), PE 측정 재시도율 0~17% — 실제로 걸릴 확률은 낮다. | 스키마에서 `pieces`/조각의 min/max 제한을 풀어(타입·required 만 유지) `checkPieces` 가 줄 단위로 null 처리하게 하거나, 의도적으로 두는 것이면 결정 ⑥ 문구를 «의미 규칙 위반만 줄 null» 로 좁혀 기록. 골든 바이트가 바뀌므로 PE 와 함께. |
| L1 | Low | `lessonPieces.ts` `checkPieces`(저장 `ja: p.ja` 원본) → `content.ts audioText` | 같음은 NFC 로 비교하지만 **저장은 원본 문자열**이라, 조각이 NFD(분리 가나, `か+U+3099`)이고 줄이 NFC 여도 통과·저장된다. 그러면 조각 글의 코드포인트 수가 줄과 달라져 화면 `pieceRanges`(코드포인트 누적)·루비/한글 자르기가 어긋나고, 소리 글이 줄 부분 글과 바이트가 다르다. | `[확실]` 스크래치 스크립트: NFD 조각 `{ja:'が'(NFD)+'んばって'}` + 줄 `がんばって。` → `{"ok":true,"pieces":[{"ja":"…"(NFD 6코드포인트)…` 수락. LLM 이 NFD 를 내는 것은 드묾(`[가능성 낮음]`). | `checkPieces` 가 통과한 조각의 `ja` 를 `normalize('NFC')` 로 저장(또는 줄 `ja` 도 NFC 로 정규화). 규칙 소유자는 conversation 한 곳이라 거기서 한 줄. |
| L2 | Low | `lifecycle.ts:144 lessonQuizFigures` → `content.ts scoreQuiz` | 문제 단계가 사라진 뒤 **진행 중이던 옛 수업**(stageDone ≤ 2 에서 ③ 을 건너뛴 것)은 답이 한 칸도 없어도 완료되며, 분모에 5 가 들어가 `score 0`·`quizTotal 5`·`Lesson.score=0` 으로 저장된다(미답은 오답으로 안 세므로 `wrongCount` 는 안 늚). ASK 가 «점수 0점» 이라 말할 수 있고 옛 스냅샷에 0/5 가 남는다. 정본 §37-13 «옛 수업은 지금 동작 그대로» 와는 일치. | `[확실]` `scoreQuiz`: 미답 `null`→ `correct 0`, `total = quiz.length`, `score round(0/5)=0`. 이 상황 빈도는 사용자 1명 기준 배포 시점에 걸려 있던 수업 1건 이하(`[추측]`). | 선택: `answered === 0` 이면 옛 수업도 `score null`·`quiz null`(새 수업 취급)로. 안 하면 «배포 당시 진행 중 옛 수업 1건은 0점으로 기록될 수 있음» 을 보고서에 적기. |
| L3 | Low (문서) | `docs/design/api-contract.md:2110`(#71 `challenge.lesson:{quizCorrect, quizTotal}\|null` — nullable 아님)·`domain-model.md:1798`(Prisma 모델 주석 `quiz:[c,t]\|null` — `[null,null]` 없음)·`api-contract.md:1211·1223`(학습 관측·RepetitionItem 설명이 «quiz 문항마다 …»만) · 승인된 항목에 남은 «초안» 문구 | 개정 노트는 #58·#60·#61·#62·#62c·#185 에만 있고, 같은 필드를 쓰는 #71 의 타입 요약과 Prisma 주석이 낡았다. 또 «새 수업은 문항 관측 0건·정답/오답 0 등록, 레슨으로는 `wrongCount` 가 안 늚»(D2 결과)이 정본에 한 줄도 없다. 승인(Leader 결정 37-18-1)된 뒤에도 노트가 «초안» 으로 남아 있다. | `[확실]` 위 줄 번호를 직접 읽음. 코드 `DayChallenge.lesson` 은 `number\|null`(types/challenge.ts). | #71 요약·Prisma 주석에 nullable 한 줄, 1211·1223 에 «새 수업은 문항 없음» 한 줄, «초안» 문구 정리(문서 소유 = Leader). |
| L4 | Low | `lifecycle.ts:65`·`progress.ts:75` | `ProgressLimits.dialogueCount` 가 **선택**이라 한 줄만 빠져도 컴파일은 통과하고 `progress.pieces` 는 늘 400 `unsupported`(닫힌 쪽으로 실패, ③ 진행 저장이 조용히 안 됨). 지금은 63→65행에 정상 연결돼 있으나 이를 고정하는 시험이 없다(`updateLessonProgress` 를 부르는 시험 0건). | `[확실]` `rg updateLessonProgress --glob '*.test.ts'` 결과 0건, `rg dialogueCount` 호출부는 `lifecycle.ts:65` 하나. | `dialogueCount` 를 필수로(호출부가 하나뿐) 바꾸거나, `updateLessonProgress` 가짜 tx 시험 1건. |
| L5 | Low | `routes lessons/[id]/audio/route.ts` · `rateLimit('tts:'+userId, 60)` | 조각 칸·구간 듣기 탭이 모두 같은 분당 60 한도(#23 과 공유)를 소모한다(캐시 적중이어도 요청 수로 센다). ③ 에서 칸을 연달아 눌러 들으면 다른 TTS 와 합쳐 429 가능. 사양(37-12-6 «한도 같음»)대로이므로 결함은 아님. | `[확실]` 코드. | QA 가 ③ 에서 빠르게 탭할 때 429 안내가 자연스러운지 확인. 문제면 piece/phrase 만 별도 키. |
| L6 | Low | 배포 | 서버가 새 수업 응답에 `quiz: []` 를 내려 주므로, 배포 직전에 열려 있던 **옛 JS 탭**이 ③ 문제 단계(`StageQuiz`)를 그리면 빈 문항으로 보일 수 있다(데이터 손상 없음). 정본이 이미 «서버·화면·프롬프트 한 릴리스» 를 요구함. | `[추측]` | 한 릴리스 배포 유지, 새로고침 안내는 선택. |
| L7 | Low (사소) | `speaking.ts getLessonAudioSource` | `sub` 가 범위 밖이어도 에러 `field` 가 `'idx'`(메시지 «없는 문장이에요»)다. 클라이언트가 필드로 분기하지 않으면 무해. | `[확실]` | 선택. |

## 시험 품질

- 서버 1(14건)·서버 2(10건)는 핵심 단언을 실제로 한다: `parseAudioBody` 전 분기(필수·범위·다른 kind·`text` unknown_key)·`audioText` 6경계·`readStoredContent` 같은 객체/사본/손상·`pieces.seen` 경계·합집합·`unsupported`; 완료는 가짜 tx 에서 `Lesson.score`·StudyLog 키 **정확한 목록**(`Object.keys` deepEqual)·스냅샷 객체 deepEqual·관측 종류·반복 항목 0/0·옛 수업 `JSON.stringify` 바이트 대조·REVIEW `increment: 0`. 공허한 통과 없음(기대값이 손으로 쓴 문자열·객체, 구현에서 유도하지 않음). 개발자 변이 7+7건이 모두 죽었다는 기록과 일치하는 구조.
- 빠진 경계: (a) `updateLessonProgress`→`dialogueCount` 연결(L4) (b) NFD 조각(L1) (c) 스키마 하드 제약과 부드러운 위반의 충돌(M1) — 시험이 `extraCheck` 만 불러 ajv 를 거치지 않는다 (d) `getTodayLessons` 의 `pieces` 필드(DB 필요, 개발자도 한계로 기록) (e) 실제 MariaDB JSON 저장에서 키 생략 유지(개발자 한계 기록, `[가능성 높음]` 같음).
- 변이 재현은 하지 않았다(통합 시험이 같은 미러에서 돌고 있어 파일 교체를 피함) → «못 봄».

## QA 가 집중할 곳 (`high_risk_areas`)

1. **#61 진행 저장 `progress.pieces.seen`** — 새 수업에서 실제 PATCH 가 200 으로 합집합 저장되는지(L4 연결), 범위 밖·중복·`quiz` 비어 있지 않음 400, DONE 409.
2. **#62c 소리 `piece`/`phrase`** — `sub` 필수·다른 kind 의 `sub` 400·`text` 키 400·남의 레슨 404·문장부호 칸/null 줄/옛 줄 400·연속 탭 429(L5).
3. **#62 완료 실DB** — 새 수업: `Lesson.score` NULL, StudyLog `result` JSON 에 문항 키 없음, `StatsSnapshot(LESSON).data` 에 `quiz*` 키 없음·`score` null(MariaDB JSON 에서 실제 확인), 두 번째 완료 409, 챌린지 날 달성(MET)·`plan/day`·챌린지 상세의 `lesson.quizCorrect/quizTotal` null, 챌린지 종료 시 `result.days[].quiz [null,null]`.
4. **첫 라이브 생성 3경로** — 일반(`lesson@v10`)·상황(`lessonScenario@v2`)·복습(`reviewMix@v4`)에서 저장된 `dialogue[].pieces` 가 줄과 NFC 같음·`slash:false` 키 없음·null 줄 수(`RequestTrace` SAVE 단계 `piecesNullLines`)와 «나누지 못했어요» 줄, 생성 FAILED 율(M1).
5. **옛 수업 호환** — DB 에 옛 수업(quiz 있음)이 있으면 열기·③ 빈 상태·완료(L2 의 0점 포함)·오늘 카드 `pieces: null`.
6. **ASK 점수** — 점수 null 레슨이 «점수 0점» 으로 말해지지 않는지(질문 탭 실호출 1건).
7. **한 릴리스 배포** — 서버·화면·프롬프트를 한 번에(L6).

## 결론

Critical 0 · High 0 · Medium 1(M1, 사양 일부 미실현이나 확률 낮음) · Low 6. 6영역 중 인증·소유자·입력 검증, 옛 데이터·스냅샷 불변, 6층 경계, 정본 정합은 문제 없고, 위 표의 M1 은 Developer/PE 가 결정(스키마 완화 vs 결정 문구 좁히기) 후 재감사 없이 QA 로 진행해도 된다(QA 에서 실패율 관측). native_change: false.
