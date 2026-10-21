---
task: task-081
role: developer
part: ui-4b1 (수업 화면 연결·종료 카드·오늘 카드·logic·문구·타입 정리)
tags:
  - type/task-record
  - domain/lesson
---
# task-081 developer 화면 ④-B1 기록 — [[task-081-improve-lesson-chunk-step]]

## Developer 기록
- [16:30] 착수. 데모 게이트 `DEMO_GATE_PASSED` / `task: task-081` / `status: approved`. 미러 `~/.node-local/thekaiwa-dev081u4b1`(make-mirror.sh, `MIRROR_OK`). 가이드 §37-6·37-8·37-13 ⑥·37-15·37-17·37-18-1, 기록 ui3a·ui3b·ui4a·ui4b2 읽음. ④-B2 는 완료 상태 — `LESSON_CH.auxDone` 형 `(t, legacyCorrect?) => string`(1인자 호출 가능).
- [16:45] [체크포인트 1~5] 편집 완료(검증 전). ① `lessonCopy.ts` `HOME.startIntro`·`HOME.nextStage(n)`(`STAGE_COPULA`)·`HOME.doneBody(topic, pieces, speaking)`·`GEN.order[2..3]`·`U2.desc/exprDesc/exprDescPlay`·`END.statQuiz`→`END.statPieces` ② `logic.ts` `EndResult{pieces,…}`·`endResultFrom`(`pieceCount`)·`genPhase` «문법과 조각을…»·문제 부속 6개(`correctFromScore`·`quizPromptView`·`quizSummaryPrompt`·`quizReadingLeak`·`quizPromptLayerState`·내부 `koText/jaFromKo/filled/HANGUL_RE/segmentKana/normalizeKana`) 지움·`U3`/`AnnotationState`/`ReadingSegment`/`LessonQuiz` import 정리·`AuxLessonLine.done` 의 `score` 지움 ③ `types/lesson.ts` `LessonQuiz`·`LessonContent.quiz`·`LessonProgress.quiz`·`ProgressPatch.quiz` 지움, `CompleteResult` `score`·`result.quiz` nullable ④ `LessonScreen.tsx` `complete()` EndResult·`StageApply textFirst/trCache`·머리 주석 ⑤ `LessonEnd.tsx` 2/3칸·`TodayLessonCard.tsx` 5곳·`parts.tsx` 주석. 다음 첫 행동: 미러 sync → tsc. 미커밋: 위 7파일 + 이 기록.
- [17:05] [체크포인트 6] 시험 정리·새 시험 완료. tsc(미러 전체): 남은 3건 모두 `src/modules/conversation/__tests__/lessonPiecesLiveReg.test.ts:49-51`(PE 몫, 내 파일 0). 시험: 내 5파일 31/31 통과(`task081EndCard` 7·`lessonLogic` 9·`display` 5·`task025` 9·`task025b` 1), lesson+review 19파일 171 중 170 통과·1 실패(`review/__tests__/quizTrace081.test.ts` «소스 전수» — `plan/growthCopy.ts` 허용 항목 «수업 문제·말하기 과제» 가 이미 바뀌어 허용 목록이 낡음, ④-B2 몫), vocab+challenge+plan 562/562. 남은 일: eslint·변이·기록 마무리.
- [17:20] [완료] ④-B1 구현·검증 끝. 커밋·푸시·배포·DB 쓰기 없음, LLM 호출 0, 브라우저·dev 서버 안 띄움. 미러 `~/.node-local/thekaiwa-dev081u4b1` 정리 전(지울지는 Leader).

### 변경 파일 (12 — 모두 미커밋)
| 파일 | 무엇을 |
|---|---|
| `src/components/lesson/lessonCopy.ts` | `HOME.startIntro`(듣기 → 문법 → 조각 → 응용 → 말하기) · `HOME.nextStage(n: number)` = `다음은 ${stageLabel(n)}${STAGE_COPULA[n-1]}. 단계마다 저장돼요.` · `HOME.doneBody(topic, pieces, speaking)`(pieces 가 1 이상일 때만 « · 조각 N개») · `GEN.order[2]`·`[3]` · `U2.desc`·`exprDesc`·`exprDescPlay` · `END.statQuiz` 지우고 `END.statPieces='오늘의 조각'`. `U3`·`U4`·`STAGE_*`·`PIECE_*` 안 건드림(옛 `U3.legacy*` 는 ③a 가 이미 지웠음) |
| `src/components/lesson/logic.ts` | `EndResult{pieces: number\|null, applicationDone, usedIds, missedIds, nextPreview}` · `endResultFrom(Pick<LessonDto,'content'\|'progress'>)` 가 `pieceCount(content)`(chunkLogic) · `genPhase` 45~75초 «문법과 조각을 만들고 있어요» · 문제 부속 지움 · `AuxLessonLine.done.score` 지움(읽는 곳이 `correctFromScore` 호출 하나뿐이었음) · 머리 주석 |
| `src/types/lesson.ts` | `LessonQuiz`·`LessonContent.quiz`·`LessonProgress.quiz`·`ProgressPatch.quiz` 지움(주석으로 «응답엔 실려 오지만 화면은 안 읽음») · `CompleteResult.lesson.score`·`result.score` → `number\|null`, `result.quiz` → `{…}\|null`(서버 `CompleteLessonResult` 와 같게) |
| `src/components/lesson/LessonScreen.tsx` | `complete()` → `{ pieces: pieceCount(lesson.content), applicationDone, usedIds, missedIds, nextPreview }` · `<StageApply … textFirst={textFirst} trCache={trCache} …/>`(④-A 표대로 — ⑤ 와 같은 변수) · 머리 주석. `st.replace` 는 `score: r.lesson.score ?? null` 그대로(형이 nullable 로 넓어짐). stage 3 줄 안 건드림 |
| `src/components/lesson/LessonEnd.tsx` | 숫자 칸 `stats` — `typeof pieces === 'number'` 이면 3칸 `grid-cols-3`, 아니면 2칸 `grid-cols-2` |
| `src/components/lesson/TodayLessonCard.tsx` | 84 `LESSON_CH.auxDone(t)` · 192·412 `HOME.nextStage(…stageDone + 1)` · 231·441 `HOME.doneBody(…, l.pieces / l?.pieces, …)` · `correctFromScore` import 지움 |
| `src/components/lesson/parts.tsx` | 주석만 — «①·③ 은 세 스위치 [히라가나][한글][번역], ② 는 [히라가나][한글]» |
| 시험 `__tests__/task025.test.ts` | 문제 머리·결과 목록 2건 지움(줄 다시 듣기·표현 소리·글자 비교 등 7건 + 문구 1건 남김) · `U3` import 지움 |
| 시험 `__tests__/task025b.test.ts` | 문제 머리 7건·안내 노트 1건 지움, 문제와 무관한 «종료 카드 오늘로 링크 shrink-0» 1건 남김 |
| 시험 `__tests__/display.test.ts` | `quizReadingLeak` 5건·`quizPromptLayerState` 1건 지움(단어 루비·readingMatches·화면 B 경계 5건 남김) |
| 시험 `__tests__/lessonLogic.test.ts` | 맞힌 수 시험 → 끝낸 카드 «조각 N개» 시험(5 단언) · genPhase 60초 기대값 · 종료 카드 값 `pieces` null·점수 칸 없음 · aux 모양에서 score 뺌 (9건 그대로) |
| 시험 `__tests__/task081EndCard.test.ts` (새) | 7건 — `endResultFrom` pieces(4·옛 null·모든 줄 실패 null·키 목록) · `LessonEnd` 서버 렌더 3칸/2칸·칸 순서·엔진명/«문제» 0·`END.recorded` 유지 · 오늘 카드 문구(시작 소개·끝냄 N 있음/없음·`nextStage` 5단계 전부·받침 표 = 이름 끝 받침 계산과 일치) · 생성 대기 `GEN.order`·`genPhase` 45/74초·`GEN.elapsed` 유지·`U2` 3문구·`END.statPieces` · 문구 전수(HOME·GEN·LESSON·U2·END 값 + 7파일 소스 주석 제외 «문제» 0·셈 «세요» 0·엔진명 0) · 문제 부속 지움(logic 내보내기 5개·`LessonQuiz`·quiz 칸·화면 호출부) · 배선(StageApply textFirst/trCache·설정 훅/뜻 메모리 1벌·onEnded 조각·오늘 카드 호출부) |

### 지운 부속 (`rg` 근거 — 지운 뒤 `src` 전체에서 참조 0, 남은 일치는 서버 자체 이름 `LessonQuizFigures`·`lessonQuizFigures` 와 주석뿐)
- `logic.ts`: `correctFromScore`(쓰던 곳: TodayLessonCard 3·logic 1·lessonLogic 시험 → 0) · `quizPromptView`·`quizSummaryPrompt`(task025·task025b 시험만 → 0) · `quizReadingLeak`·`quizPromptLayerState`(display 시험만 → 0) · 내부 `filled`·`HANGUL_RE`·`koText`·`jaFromKo`·`KANA_WORD`·`READING_NOISE`·`LEAK_WINDOW`·`normalizeKana`·`segmentKana`·`PROMPT_HIDDEN` · import `U3`·`AnnotationState`·`ReadingSegment`·`LessonQuiz`.
- `types/lesson.ts`: `LessonQuiz`(서버는 이 타입을 import 하지 않음 — `rg "from '@/types/lesson'" src/modules src/app` 는 `JlptLevel`·`LessonSpeakingTranslation` 뿐) · `LessonContent.quiz`(시험 고정물 2곳 `task081ChunkUi`·`reviewRegression` 은 `as unknown as` 라 영향 없음) · `LessonProgress.quiz`(`reviewRegression` 의 `progress: {quiz}` 는 `as LessonDto` 단언이라 영향 없음 — tsc 로 확인) · `ProgressPatch.quiz`(보내는 곳 0 — ③b 가 `useLesson.patchOf` 에서 지움).
- `lessonCopy.ts`: `END.statQuiz`.

### 결정과 근거
1. **`HOME.nextStage` 에 `?? '예요'`**: 가이드 식은 `STAGE_COPULA[n - 1]` 그대로인데 범위 밖 n(0·6)이면 `undefined` 가 글에 찍혀서 — 호출부는 `stageDone < 5` 일 때만이라 실제로는 안 나옴.
2. **`HOME.doneBody` 의 `pieces` 형 `number | null | undefined`**: #58 `pieces?` 가 옛 응답에 없을 수 있어 `l.pieces` 를 그대로 넘김. 가이드 식대로 0 도 생략(truthy).
3. **종료 카드 0**: `pieceCount` 가 0 이면(새 수업인데 누를 수 있는 조각이 하나도 없음 — 문장부호만) 가이드 «수이면 3칸» 대로 «0 오늘의 조각». 모든 줄이 null 인 수업은 `chunkMode='none'` → null → 2칸(§37-3-1 과 맞음).
4. **`AuxLessonLine.done.score` 제거**: 읽는 곳이 `LESSON_CH.auxDone(t, correctFromScore(aux.score))` 하나 — 남기면 죽은 칸.
5. **`CompleteResult` nullable**: 서버 `CompleteLessonResult`(lifecycle.ts:97-109)가 이미 `score: number|null`·`quiz: {…}|null` — 화면 타입이 어긋나 있었음(화면은 `result.quiz` 를 더는 안 읽음).

### 실행 증빙 (미러 `~/.node-local/thekaiwa-dev081u4b1`)
- `tsc --noEmit -p .`: 오류 3 — 전부 `src/modules/conversation/__tests__/lessonPiecesLiveReg.test.ts:49-51`(`LIVE_OK`·`DRY`·`COMPARE` 가 env 형에 없음, PE 갈래 파일). **내 파일·화면 소스 0**(시작 때 35 → 3).
- `eslint` 12파일: 0.
- 시험 `node --import tsx --test --test-concurrency=1`: 내 5파일 **31/31**(`task081EndCard` 7·`lessonLogic` 9·`display` 5·`task025` 9·`task025b` 1) · lesson+review 19파일 **171 중 170 통과·1 실패**(아래) · vocab+challenge+plan **562/562**.
- 변이 7건(미러에서 임시 파일 + `os.replace`, 원복 뒤 NFS 와 `filecmp` 같음 7/7 — 스크립트 `scratchpad/dev-081-ui4b1/mutate.py`): M1 종료 카드 늘 3칸 → 1 실패 · M2 받침 무시 → 1 · M3 조각 안 셈 → 1 · M4 대기 문구 «문제» 되돌림 → 3 · M5 StageApply `textFirst`·`trCache` 빠짐 → 1 · M6 끝냄 «조각 N개» 생략 → 2 · M7 옛 수업도 조각 칸 → 1. **7/7 잡힘.**

### 남은 실패·오류와 몫 (내 파일 아님 — 건드리지 않음)
| 위치 | 내용 | 몫 |
|---|---|---|
| `lesson/review/__tests__/quizTrace081.test.ts:84` «소스 전수» | `plan/growthCopy.ts` 허용 항목 `수업 문제·말하기 과제` 가 없다고 실패 — `growthCopy.ts:129` 가 ④-B2 제안 ②(«오늘의 단어·말하기 과제·대화 교정·역할극…») 로 이미 바뀌었는데 시험 허용 목록이 낡음. 허용 목록에서 그 항목을 지우면 통과(growthCopy 의 «문제» 는 105행 주석뿐) | ④-B2(또는 Leader 가 ② 를 적용한 갈래) |
| `modules/conversation/__tests__/lessonPiecesLiveReg.test.ts:49-51` | tsc 3건 | PE |
| `vocab/topicCopy.ts:90` `LESSON_CH.continueNote(stage, d)` | `다음은 ${stage}예요` 고정 — 챌린지 «이어서 하기» 카드(`TodayLessonCard.tsx:410`)에서 ③ 이 «다음은 ③ 조각예요»·② «② 문법예요» 로 나옴. `HOME.nextStage`·`RV_HOME.nextStage` 와 같은 받침 오류(가이드 37-6/37-8 표에 없음). 호출부만으로는 못 고침(문구가 «예요» 를 붙임) — `(n: number, dayIndex)` 로 바꾸고 `STAGE_COPULA` 쓰면 한 줄 + 호출부 한 줄 | ④-B2 파일 — Leader 결정 필요 |
| `modules/learning/lessons/content.ts:45` 주석 | «`types/lesson.ts` `LessonQuiz` 와 같은 모양» — 이 갈래가 `LessonQuiz` 를 지워 낡은 주석 | 서버 갈래(주석만) |
| `vocab/topicCopy.ts:101` `auxDone` 넓힌 형 `(t, legacyCorrect?)` | 호출부가 1인자로 바뀌어 이제 `(t: string) => string` 로 좁혀도 됨(④-B2 기록 «후속 한 줄») | ④-B2 |

### 가이드와 어긋난 곳
- 없음(문구는 37-8 글자 그대로). 위 `continueNote` 는 가이드 표 밖 같은 취지 오류라 보고만.

### 한계
- 브라우저·dev 서버 미실행(지시) — 오늘 카드(`TodayLessonCard`)는 훅이 많아 서버 렌더 대신 순수 문구 시험 + 소스 배선 시험으로만 확인. `LessonEnd` 는 서버 렌더로 칸 수 확인.
- 실제 완료 흐름(#62 응답 → 종료 카드 3칸)·#58 `pieces` 가 오늘 카드에 오는지는 서버 응답이 필요 — QA 몫.

### QA 가 볼 곳
- 새 수업 끝냄 → 종료 카드 [N 오늘의 조각][만든 문장][쓴 표현] 3칸 · 다시 들어와도(#60 DONE) 같은 N · 옛 수업 다시 열기 → 2칸(360px 에서 2칸 폭).
- 오늘 카드 끝냄 «주제 · 조각 N개 · 말하기 표현 u/t»(옛 수업은 조각 생략) · 하던 수업 «다음은 ② 문법이에요»·«③ 조각이에요»·«④ 응용이에요» · 시작 소개 «듣기 → 문법 → 조각 → 응용 → 말하기» · 챌린지 카드 다른 수업 끝냄 보조 줄에 «문제 c/5» 없음 · 챌린지 «이어서 하기» 카드의 받침(위 표 — 지금은 «조각예요»).
- 생성 대기 «이런 순서로» ③ 조각·④ 말로 만들기 · 45~75초 «문법과 조각을 만들고 있어요».
- ④ 응용이 마이크 기본으로 열리고(⑤ 와 같은 `textFirst`), ④ 에서 받은 뜻이 ⑤ 같은 글에서 다시 호출되지 않는지(같은 `trCache`).
- 미커밋 파일: 위 12개 + 이 기록.
