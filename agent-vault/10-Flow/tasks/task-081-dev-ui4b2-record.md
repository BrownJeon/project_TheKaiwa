---
task: task-081
role: developer
part: ui-4b2 (복습·챌린지·성장 탭·단어장 «문제» 흔적 정리)
tags:
  - type/task-record
  - domain/lesson
---
# task-081 developer 화면 ④-B2 기록 — [[task-081-improve-lesson-chunk-step]]

## Developer 기록
- [15:28] 착수. 데모 게이트 `DEMO_GATE_PASSED` / `task: task-081` / `status: approved`. 미러 `~/.node-local/thekaiwa-dev081u4b2`(make-mirror.sh, exit 0). 가이드 §37-6·37-8·37-13 ⑥·37-15·37-18·37-18-1 읽음.
- [15:50] [체크포인트 1] 문구·로직 편집 완료(미검증). 완료: `review/{reviewCopy.ts,reviewLogic.ts,TodayReviewCard.tsx}`·`review/__tests__/{review.test.ts,reviewRegression.test.ts}` · `challenge/{DayStrip.tsx,logic.ts,challengeCopy.ts}`·`challenge/__tests__/logic.test.ts` · `vocab/topicCopy.ts` · `plan/growthCopy.ts`·`plan/__tests__/{growthCopy.test.ts,growthScreen.test.ts}`. 남은 일: 문구 시험 새 파일 → 미러 sync → tsc·eslint·시험 → 변이 → 기록. 다음 첫 행동: `review/__tests__/quizTrace081.test.ts` 작성. 주의: `RV_HOME.nextStage` 받침(가이드 밖, 같은 취지) · `GROWTH.how(…)[0]` «수업 문제» 는 Leader 결정 밖이라 그대로 둠 · `auxDone` 둘째 인자 호환 유지. 미커밋: 위 전부.
- [16:05] [체크포인트 2] 검증 1차 통과. tsc: 내 파일 오류 0(챌린지 `logic.ts` 287·479 해소), 남은 24건 = ④-A/④-B1 파일. eslint(14파일) 0(경고 0 — `auxDone` 은 미사용 인자 대신 넓힌 함수 형으로 호환). 시험 21파일 208 통과/0 실패. 남은 일: 변이 시험 → 기록 마무리. 다음 첫 행동: 미러에서 임시 파일+mv 변이 6건.
- [16:15] [완료] ④-B2 구현·검증 끝. 커밋·푸시·배포·DB 쓰기 없음. 미러 `~/.node-local/thekaiwa-dev081u4b2` 는 정리 전(지울지는 Leader).

### 변경 파일 (14 — 모두 미커밋)
| 파일 | 무엇을 |
|---|---|
| `src/components/lesson/review/reviewCopy.ts` | §37-8 복습 행 5개 글자 그대로 · `quizNote` 지움 · `RV_HOME.nextStage(n)` 받침 표(아래 «가이드와 어긋난 곳» ①) · `lessonCopy` 에서 `STAGE_COPULA`·`stageLabel` 읽기만 |
| `src/components/lesson/review/reviewLogic.ts` | `ReviewCard` done/donePending 의 `correct` 제거 · `correctFromScore` import 제거(④-B1 이 지울 함수) · `reviewLessonOf` 는 상태만 |
| `src/components/lesson/review/TodayReviewCard.tsx` | `RV_HOME.doneBody(n)`·`RV_HOME.nextStage(n)` 호출부 · 안 쓰는 `stageLabel` import 제거 |
| `src/components/challenge/{DayStrip.tsx,logic.ts,challengeCopy.ts}` | 제목·안내·열·캡션 2·머리 주석·`scoreRows` 회화 칸 «끝냄»·과제 DONE «끝냈어요»(`lessonScore` 옵션·286-287 점수 계산 삭제)·MET 줄·기록 줄 «· 끝냄»·규칙 줄 · `Dots` 부품과 `ScoreRow.lesson.dots` **제거**(37-15 «제거» 선택 — 죽은 코드 없음) |
| `src/components/vocab/topicCopy.ts` | `LESSON_CH.auxDone` — «문제 c/5 · » 뺌, 형은 `(t, legacyCorrect?) => string` 로 넓혀 지금 호출부(2인자)·④-B1 뒤 호출부(1인자) 둘 다 컴파일 |
| `src/components/plan/growthCopy.ts` | Leader 결정 §37-18-1 ② 4줄 + 주석 |
| 시험: `review/__tests__/{review,reviewRegression}.test.ts` · `challenge/__tests__/logic.test.ts` · `plan/__tests__/{growthCopy,growthScreen}.test.ts` · **새** `review/__tests__/quizTrace081.test.ts` | 아래 |

### 문구 전 → 후
| 자리 | 전 | 후 |
|---|---|---|
| 복습 카드 끝냄 `RV_HOME.doneBody` | `5개 항목 · 문제 4/5 맞힘` | `5개 항목` |
| 복습 하던 수업 `RV_HOME.nextStage` | `다음은 ③ 조각예요.`(③ 이름 바뀐 뒤 그대로면) / `② 문법예요` | `다음은 ③ 조각이에요.` · `② 문법이에요` · `① 이해예요` · `⑤ 말하기예요` |
| 복습 생성 `RV_GEN.itemsNote` | `…5단계(이해 → 문법 → 문제 → 응용 → 말하기)…` | `…5단계(이해 → 문법 → 조각 → 응용 → 말하기)…` |
| `RV_LESSON.itemsNote` | `…오늘 대화·문제·말하기에 섞여 나와요.` | `…오늘 대화·응용·말하기에 섞여 나와요.` |
| `RV_LESSON.exprNote` | `…문제·응용·말하기에서 다시 써요.` | `…응용·말하기에서 다시 써요.` |
| `RV_LESSON.exprNoteNoAudio` | `이번 복습 항목이에요. 문제·응용·말하기에서 다시 써요.` | `이번 복습 항목이에요. 응용·말하기에서 다시 써요.` |
| `RV_LESSON.quizNote` | `틀린 문제는 수업을 마친 뒤 …` | 지움 |
| 챌린지 `COPY.scoreTitle` | `문제 점수 추이` | `날짜별 기록` |
| `COPY.scoreNote` | `수업은 5문제 중 맞힌 수, 단어는 그날 세트 합계예요.` | `회화는 끝낸 날만 표시하고, 단어는 그날 세트 합계예요.` |
| `CREATE.lessonBody` | `「t」 수업을 하루 1개 끝내요 · 약 15분 · 문제 점수와 상관없이 끝내면 완료` | `「t」 수업을 하루 1개 끝내요 · 약 15분` |
| 표 열 머리 / 캡션 2 | `수업 문제` / `날짜별 수업 문제와 단어 맞힘`·`지난 날 수업 문제와 단어 맞힘` | `회화` / `날짜별 회화 수업과 단어 맞힘`·`지난 날 회화 수업과 단어 맞힘` |
| 표 회화 칸 | `문제 4/5` + 점 ●●●●○ | `끝냄`(점 없음) · 없음은 그대로 `아직`/`수업 없음` |
| 오늘 할 일 DONE | `끝냈어요 · 문제 4/5` | `끝냈어요` |
| 달력 하루 줄 MET | `하루 목표를 다 채웠어요 · 문제 4/5 · 단어 …` | `하루 목표를 다 채웠어요 · 단어 …` |
| 하루 시트 기록 줄 | `오늘의 회화 「t」 · 문제 5/5` | `오늘의 회화 「t」 · 끝냄` |
| 규칙 줄 | `회화는 수업을 끝내기만 하면 완료예요(문제 점수와 상관없음).` | `회화는 수업을 끝내면 완료예요.` |
| 단어장·오늘 카드 보조 줄 `LESSON_CH.auxDone` | `✓ 오늘 「t」 수업 끝냄 · 문제 4/5 · 챌린지에는 세지 않아요` | `✓ 오늘 「t」 수업 끝냄 · 챌린지에는 세지 않아요` |
| **성장 탭** `AXES[VOCAB_RECALL].how` | `오늘의 단어·수업 문제를 풀면 쌓여요` | `오늘의 단어를 풀면 쌓여요` |
| **성장 탭** `AXES[GRAMMAR_PARTICLE].how` | `수업 문제와 대화 교정에서 쌓여요` | `대화 교정에서 쌓여요` |
| **성장 탭** `axisOneSidedSub.VOCAB_RECALL` | `오늘의 단어나 수업 문제도 풀면 단계가 보이기 시작해요.` | `오늘의 단어도 풀면 단계가 보이기 시작해요.` |
| **성장 탭** `axisOneSidedSub.GRAMMAR_PARTICLE` | `수업 문제도 풀면 단계가 보이기 시작해요.` | (빈 값 — 안내 줄을 그리지 않음. `ResultRows.tsx:110` `sub ? … : null` 규칙이 이미 있어 화면 코드 수정 없음, `growthScreen.test` 로 DOM 확인) |

### 결정과 근거
- `ScoreRow.lesson.dots` 는 «`dots: null` 남김» 대신 **제거** — 37-15 가 둘 다 허용, 읽는 곳이 `DayStrip` 하나라 남기면 죽은 필드. 37-8 의 `{ text: '끝냄', dots: null }` 와 글은 같음.
- 챌린지 null 견딤: 화면은 `quizCorrect`·`quizTotal` 을 **더는 읽지 않는다**(logic.ts·DayStrip 에서 참조 0). `days[].quiz` 튜플은 화면 코드에 참조가 없음(서버 `view.ts` 가 `r.quiz ? lesson : null` 로 `[null,null]` 을 «수업 있음» 으로 넘김 — 서버2 기록). 시험: null 점수 날의 `scoreRows`→«끝냄»·`dayLineView` MET 줄.
- `reviewRegression.test.ts` 는 **13건**(원래 14건 중 `StageQuiz` 시험 1건 삭제 — 지시의 «14개» 는 삭제 전 수로 봄). `LessonEnd` 시험의 `result` 는 `{pieces:null, correct, total, …}` 두 모양을 함께 실어 ④ 갈래가 `EndResult` 를 바꾸기 전·후 모두 그려지게 함(`Parameters<typeof LessonEnd>[0]['result']` 로 형 맞춤).
- `review.test.ts` 의 45초 문구는 리터럴 대신 `genPhase(50, null)` 위임으로 고정 — 문구 자체는 ④-B1 소유(`logic.ts genPhase`)라 그쪽이 바꿔도 내 시험이 깨지지 않게.
- `askCopy.ts:209` 는 지시대로 손대지 않음.

### 시험·변이 (실행 증빙)
- `tsc --noEmit`(미러): 내 14파일 오류 0. 남은 24건 = ④-A/④-B1 몫 — `lesson/LessonScreen.tsx:313`(StageApply props) 1 · `lesson/logic.ts:319,327`(`U3.legacyPrompt`) 2 · `lesson/__tests__/task025.test.ts` 6 · `task025b.test.ts` 15. 서버2 가 남긴 `challenge/logic.ts` 287·479 는 해소.
- `eslint` 14파일: 오류 0·경고 0.
- `node --import tsx --test --test-concurrency=1` 21파일(review 5·challenge 8·plan growth 5·vocab 3): **208 통과 / 0 실패**. 새 `quizTrace081.test.ts` 6건(복습 문구·받침·챌린지 문구/null·보조 줄 1·2인자·성장 4줄·소스 전수 «문제» 0·엔진명 0·셈 «세요» 0).
- 소스 «문제» 허용 2곳(시험 허용 목록에 이유 주석): `challenge/logic.ts` `'문제 있음: '`(만들기 실패 줄 낭독 접두어 — «탈» 뜻, 퀴즈 아님) · `growthCopy.ts` `GROWTH.how` 첫 줄(아래 ②).
- 변이 6건(미러에서 임시 파일 + `os.replace`, 원복 뒤 NFS 와 `cmp` 같음 6/6): M1 복습 끝냄 점수 되살림 → quizTrace 2 실패 · M2 `dots` 되살림 → quizTrace 1·logic.test 1 · M3 문형·조사 안내 되살림 → quizTrace 2·growthCopy 2·growthScreen 1 · M4 보조 줄 «문제» → quizTrace 2 · M5 복습 받침 무시 → quizTrace 1 · M6 열 머리 «수업 문제» → quizTrace 1. **6/6 잡힘.**

### ④-B1 이 고칠 호출부
- `src/components/lesson/TodayLessonCard.tsx:84` — `LESSON_CH.auxDone(t, correctFromScore(aux.score))` → `LESSON_CH.auxDone(t)`(지금도 컴파일됨). 그 뒤 `topicCopy.ts` 의 넓힌 형(`legacyCorrect?`)은 지워도 됨(후속 한 줄).
- `correctFromScore` 를 `lesson/logic.ts` 에서 지울 때 `review/**` 는 이미 참조 0.

### 가이드와 어긋난 곳 · Leader 확인
1. **[가이드 밖 같은 취지 — 확인 요청] `RV_HOME.nextStage`**: 복습 «하던 복습» 카드가 `다음은 ${label}예요` 고정이라 ③ 이름이 «조각» 이 되면 «다음은 ③ 조각예요» 가 나온다(이번 task 가 만드는 오류). 37-18-1 ③ 이 오늘의 회화 `HOME.nextStage` 에 승인한 `STAGE_COPULA` 규칙을 같은 모양으로 적용(`(n: number)` 로 바꾸고 호출부 1곳 정리). 되돌리려면 한 줄.
2. **[Leader 결정 밖 — 그대로 둠] 성장 탭 `GROWTH.how(min, minSession)[0]`**(`growthCopy.ts:129`, «성장 탭 단계 규칙» 첫 줄): `오늘의 단어·수업 문제·말하기 과제·대화 교정·역할극에서 맞히고 틀린 기록(관측)으로 계산해요.` — 새 수업은 문제 관측을 만들지 않아 «수업 문제» 가 틀린 안내가 된다(옛 수업 관측은 남음). 4줄 결정에 없어 바꾸지 않았다. 제안: `오늘의 단어·말하기 과제·대화 교정·역할극에서 맞히고 틀린 기록(관측)으로 계산해요.`(+ `growthCopy.test.ts:89` 기대값). 결정 주시면 2파일 한 줄씩.
3. 지시문의 «끝냈어요/아직/수업 없음» 은 37-8 표(`'끝냄'`)를 따랐다 — 과제 줄은 «끝냈어요», 표 칸은 «끝냄».

### 한계
- 브라우저·dev 서버 미실행(지시) — 화면은 정적 렌더 시험(growthScreen·reviewRegression)으로만 확인, 3폭·130% 확인은 QA 몫.
- 복습 카드 `TodayReview.score` 는 여전히 응답에 올 수 있으나 화면은 읽지 않음(타입은 `src/types/**` — 건드리지 않음).
