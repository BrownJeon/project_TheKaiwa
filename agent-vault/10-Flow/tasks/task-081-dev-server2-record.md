---
task: task-081
role: developer
name: dev-081-server2
tags:
  - type/record
  - domain/lesson
---
# task-081 서버 갈래 2 — 완료 처리·점수 nullable·기록·챌린지 읽기·ASK (developer 기록)

상위 이력서: [[task-081-improve-lesson-chunk-step]] · 가이드 `docs/screens.md` §37-12-9·§37-13·§37-15·§37-16·§37-18-1

## Developer 기록

- [체크포인트 1] 구현 1차 완료(시험 전)
  - 완료: `lifecycle.ts`(점수 nullable·요약·키 생략·스냅샷 인자·63행 `dialogueCount` — 서버1 요청) · `snapshots/index.ts`(`LessonSnapshotData` score null·quiz 키 선택) · `observations.ts`(머리 주석만) · `challenges/{metrics,view}.ts`(null 읽기·`[null,null]` 얼리기·파서) · `types/challenge.ts`(3곳 nullable)
  - 남은 일: 미러 `dev081s2` → 시험 파일 작성 → tsc·eslint → 변이 시험 4+ → 기록 마무리
  - 다음 첫 행동: `src/modules/learning/__tests__/task081Server2.test.ts` 작성(가짜 tx + `prisma.$transaction` 교체 — `askRouteGuard.test.ts` 선례)
  - 주의점: 새 수업 판정 = `content.quiz.length === 0`(서버1이 `readStoredContent` 에서 `quiz: raw.quiz ?? []` 로 맞춤 — 서버1 확인 메시지 받음). 챌린지 스냅샷 읽기는 `quizTotal` 키가 숫자일 때만 숫자.
  - 미커밋 파일: 위 5개 + 이 기록
- [체크포인트 2] 시험 작성·통과 — `src/modules/learning/__tests__/task081Server2.test.ts` 10건 통과, 관련 기존 시험(task010·task010b·challengeMetrics·challengeService·task042·task076·recordRetrieval) 199건 통과. eslint(변경 7파일) 0. tsc 오류 2건 = 모두 `src/components/challenge/logic.ts`(287·479행, 화면 갈래 ④ 소유 — 가이드 §37-16 «types 먼저, 화면이 그 위에서»). 남은 일: 변이 시험 → 기록 마무리.
- [체크포인트 3 · 완료] 서버 갈래 2 구현·시험·변이 끝 — **미커밋**(커밋·배포·DB 쓰기 0, LLM 호출 0)

### 변경 파일
| 파일 | 무엇을 |
|---|---|
| `src/modules/learning/lessons/lifecycle.ts` | 순수 함수 3개 추가 `lessonQuizFigures`(문항 없음 → `score`·`quiz` null·`outcomes` [])·`lessonStudySummary`(새 수업 «문제 c/t» 빼기)·`lessonQuizResultKeys`(새 수업 `{}`) · 완료 트랜잭션이 이것만 씀 → `Lesson.score` null·응답 `lesson.score`·`result.score`·`result.quiz` null · StudyLog `result` 문항 4키 생략(옛 수업은 키 순서까지 그대로) · 스냅샷 인자 문항 키 조건부 · `CompleteLessonResult` 타입 nullable · 63행 `dialogueCount: h.content.dialogue.length`(서버1 요청 — progress.ts `ProgressLimits.dialogueCount?` 선택 칸, 빠지면 `progress.pieces` 늘 400) · 머리 주석 |
| `src/modules/learning/snapshots/index.ts` | `LessonSnapshotData.score: number \| null`·`quizCorrect?`·`quizTotal?` · 머리 주석(만들기만, 옛 행 불변) |
| `src/modules/learning/lessons/observations.ts` | 머리 주석만(새 수업 문항 관측 0·`wrongCount` 안 늚) — 로직 변경 없음 |
| `src/modules/learning/challenges/metrics.ts` | `LessonSnap`·`ComputedDayLesson` quiz `number \| null` · `lessonQuiz(d)` = `quizTotal` 키가 숫자일 때만 숫자(옛 행 `cnt` 그대로) · `pickMax(… ?? -1)`(같은 날 옛·새 수업이면 점수 있는 옛 수업이 대표) · 얼리기 `[null, null]` · `readChallengeResult` 가 `[null,null]` 받음(한쪽만 null 은 손상) |
| `src/modules/learning/challenges/view.ts` | `ChallengeDayView.lesson` 타입 nullable(로직 같음 — `r.quiz` 가 `[null,null]` 이면 참이라 lesson 행 유지) |
| `src/types/challenge.ts` | `ChallengeDayLesson`·`ChallengeResultDay.quiz`(`[number,number] \| [null,null] \| null`)·`DayChallenge.lesson` nullable |
| `src/modules/learning/__tests__/task081Server2.test.ts` (새) | 10건 |

### 결정과 근거
- 새 수업 판정 = `content.quiz.length === 0`. 서버1 이 `readStoredContent` 에서 새 수업에 `quiz: []` 를 돌려줌(메시지로 확인, `StoredLessonContent.quiz` 는 필수 배열 그대로). 문항이 빈 옛 수업은 없었음(옛 스키마가 문항 고정) — 있더라도 가이드 37-12-9 «`content.quiz` 가 비면 셋 다 null» 과 같다.
- `scoreQuiz`·`quizTargetTally`·`lessonRepetitionItems` 는 손대지 않음 — 빈 배열이면 자연히 0/빈 Map. 그래서 새 수업은 조각·문형을 정답·오답 0 으로 **계속 등록**(종료 카드 «복습할 항목으로 기록했어요» 참), REVIEW 는 `studiedCount+1` 만. **결과: 레슨 완료로 `RepetitionItem.wrongCount` 가 더는 늘지 않는다** → A11 복습 후보(오답 가중)·AI 평가 «오답 N회» 재료 감소(사용자 결정 D2 공백 — 가이드 37-13 ④).
- 챌린지 스냅샷 읽기에서 «키 없음 = null» 로 한 이유: 지금 `cnt()` 는 키가 없으면 0 → 새 수업이 «문제 0/0» 으로 읽힘. 얼린 결과 `days[].quiz` 는 «그날 수업 있음» 표시를 겸하므로(view.ts `r.quiz ? lesson : null`) null 로 두면 수업이 사라짐 → `[null, null]` 로 얼림. 롤백 시 옛 코드는 `[null,null]` 결과를 손상으로 보고 스냅샷으로 다시 계산(`readChallengeResult` null → 재계산 경로) — 깨지지 않음.

### 읽는 곳 전수 확인 표 (`rg "quizCorrect|quizTotal|quizAnswered"`·`statsSnapshot.find*`·`FROM StatsSnapshot`·`lesson.score`, 시험 제외)
| 읽는 곳 | 무엇을 읽나 | 새 수업 영향 | 처리 |
|---|---|---|---|
| `challenges/store.ts:83`·`metrics.ts readChallengeSnaps` | LESSON 스냅샷 `kind`·`topicId`·`date`·`quizCorrect/Total` | 키 없음 → 지금은 0 | **null 로 읽게 고침** |
| `challenges/metrics.ts dayMet`·`progress.ts:32-38`·`service.ts:218` | 스냅샷 **존재**(개수)·`kind === 'NEW'` | 없음(완료 판정 불변) | 시험으로 고정(MET) |
| `challenges/metrics.ts freezeChallengeResult`·`readChallengeResult`·`view.ts:65` | `days[].quiz` 튜플 | null 쌍 | `[null,null]` 얼리기·파서 허용 |
| `challenges/progress.ts:84` → `DayChallenge.lesson` | `quizCorrect/Total` | null 통과 | 타입만 |
| `components/challenge/logic.ts:286·317·450·485` (화면) | 같은 값 표시 «문제 n/5» | tsc 오류 2(287·479) | **화면 갈래 ④ 몫**(37-8 — 화면은 더 읽지 않음) |
| `snapshots/growth.ts:346-348` | DAILY·EVALUATION 만 | 없음 | — |
| `reviewSchedule/core.ts:59` | DAILY 만 | 없음 | — |
| `reviewSchedule/core.ts:239` | `Lesson.score ?? null` | 이미 null 허용 | — |
| `vocab/stats.ts:88` | VOCAB_SESSION 만 | 없음 | — |
| `snapshots/backfillSkills.ts:327` | DAILY 만 | 없음 | — |
| `recordRetrieval/sources.ts:139` | DAILY 만 | 없음 | — |
| `recordRetrieval/sources.ts:218·416` (ASK) | `Lesson.score` | `typeof l.score === 'number'` 가드가 이미 있음 → null 은 점수 언급 생략 | 변경 없음·시험 고정 |
| `lessons/today.ts:191`(#58)·`rows.ts toLessonDto`(#60) | `Lesson.score` | 이미 `number \| null` | 서버1 몫(변경 불필요) |
| StudyLog `result.score/quiz*` 읽는 곳 | — | 서버 코드 0곳(`rg` 결과 lifecycle 쓰기뿐) | — |
| 분석(«분석·성장기록» Phase 3) | LESSON 스냅샷 읽는 코드 아직 없음 | — | — |

### ASK «점수» 확인 결과 (Leader 결정 ④)
- 질문 맥락 조립에서 레슨 점수를 싣는 곳은 `recordRetrieval/sources.ts` 두 곳뿐(`getProgressSummary` 218행 «점수 N점», `getLessonsByTopic` 416행 «(점수 N점)») — 둘 다 이미 `typeof l.score === 'number'` 일 때만 붙임. `askRouter`·`orchestrator/ask.ts`·`prompts/ask.ts` 는 레슨 점수를 직접 싣지 않음(`prompts/ask.ts:306` 은 «점수를 지어내지 말라» 지침만). `StudyLog.summary` 는 ASK 로 보내지 않음(sources.ts 머리 주석 10행).
- **평가 점수도 싣는다**: `getProgressSummary` 의 EVALUATION 후보(`평가(…) 완료`·`{totalScore}점`·루브릭 세부). → Leader 결정 ④ 규칙상 **`askCopy.ts:209` «공부 횟수·점수·복습 예정 목록» 은 그대로 둔다**(화면 갈래 몫이라 바꾸지 않음 — 확인 결과만 전달).

### 시험 · 실행 증빙 (미러 `~/.node-local/thekaiwa-dev081s2`, `make-mirror.sh` 로 생성)
- `node --import tsx --test src/modules/learning/__tests__/task081Server2.test.ts` → **pass 10 / fail 0**: 순수 3함수 · 관측(문항 0건·말하기 그대로) · 새 수업 완료 전 과정(stageDone 4 → `Lesson.score` null·응답 null 3개·StudyLog 요약·키 목록 정확히·스냅샷 `{kind,topicId,score:null,stageDone,itemCount,date}`·관측 SENTENCE_PRODUCTION 만·반복 항목 3건 0/0 등록·LESSON 스냅샷 update 0) · stageDone 3 → 409 · 새 REVIEW(증가 1/0/0·create 0) · 옛 수업 진행 중 답 [0,1] 그대로 채점(요약 문자열·StudyLog 키 순서·스냅샷 JSON 바이트 같음·문항 관측·wrongCount) · 챌린지 null 읽기·MET·대표 수업·`[null,null]` 왕복·한쪽 null 손상 · ASK null 점수 생략·옛 80점 유지.
- 관련 기존: task010·task010b·challengeMetrics·challengeService·task042·task076·recordRetrieval → **pass 199 / fail 0**.
- eslint(변경 7파일) 출력 0. `tsc --noEmit` → 오류 2건, 둘 다 `src/components/challenge/logic.ts`(287·479행 — `{correct,total}` 에 `number|null`) = 화면 갈래 ④ 파일. 내 파일·서버1 파일 오류 0(63행 `dialogueCount` 도 통과).

### 변이 시험 (NFS 원본을 스크래치에 복사 → 임시 파일 + `mv` 로 변이 → sync → 시험 → 복사본으로 `mv` 원복 → `cmp` 같음 확인)
| 변이 | 결과 |
|---|---|
| M1 새 수업에도 점수 계산(`lessonQuizFigures` 빈 배열 분기 제거) | 잡힘(4건 실패) · cmp 같음 |
| M2 StudyLog 에 `quizCorrect:0, quizTotal:0` | 잡힘(3건) · cmp 같음 |
| M3 옛 수업 스냅샷에서 문항 키 빼기 | 잡힘(옛 수업 시험) · cmp 같음 |
| M4 ASK 가 null 을 «점수 0점» 으로(sources.ts) | 잡힘(ASK 시험) · cmp 같음 |
| M5 챌린지 읽기가 키 없음을 0 으로 | 첫 변이는 괄호 없는 화살표 본문이라 **문법 오류로 파일 전체 실패**(유효한 변이 아님) → M5b 로 다시: 잡힘(챌린지 2건) · cmp 같음 |
| M6 `[null,null]` 결과 거부 | 잡힘 · cmp 같음 |
| M7 복습 레슨에 오답 1 더하기 | 잡힘(REVIEW 시험) · cmp 같음 |

### 가이드와 어긋난 곳 · 한계
- 가이드 37-15 는 `observations.ts` «변경 없음 — 머리 주석» 이라 그대로 따름. `challenges/view.ts` 는 가이드 표에 따로 없지만 «챌린지 서버 읽기» 범위라 타입 한 줄만 바꿈.
- 얼린 결과 `days[].quiz` 에 `[null, null]` 이라는 새 값 모양이 생긴다 — 정본 `api-contract.md` 챌린지 응답 설명(«`lesson.quizCorrect/quizTotal` nullable»)에는 있으나 `Challenge.result.days[].quiz` 저장 모양은 명시 안 됨 → Leader 가 정본에 한 줄 반영 필요(문서는 제 소유 아님).
- 완료 전 과정 시험은 가짜 tx 라 실제 MariaDB JSON 저장(키 생략이 그대로 남는지)은 확인 안 함 — Prisma 는 `undefined` 키를 JSON 에 쓰지 않고, 여기는 스프레드로 키 자체를 만들지 않으므로 [가능성 높음] 같음. QA 실제 DB 한 건 확인 권장.
- 같은 날 옛·새 수업이 섞이면 챌린지 대표 수업 = 점수 있는 옛 수업(전환기 하루만 해당).

### reviewer 가 볼 곳
1. `lifecycle.ts` 옛 수업 경로 바이트 불변 — StudyLog `result` 키 순서·요약 문자열·스냅샷 키 순서(시험 7번이 JSON 문자열로 비교).
2. `metrics.ts lessonQuiz` 판정 기준(`quizTotal` 키가 숫자) · `pickMax ?? -1` · `quizPair` 가 한쪽 null 을 거부.
3. LESSON 스냅샷을 고치는 경로 0(시험 4번 — `statsSnapshot.update` 는 DAILY 행만).
4. 남은 tsc 2건이 화면 갈래 ④ 파일뿐인지.
