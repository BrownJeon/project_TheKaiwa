---
task_id: task-076
role: reviewer
review_id: REV-076S
verdict: PASS_WITH_NOTES
created: 2026-10-18
updated: 2026-10-18
tags:
  - type/task-record
  - domain/challenge
  - domain/lesson
  - domain/vocab
---

# task-076 reviewer 기록 — 서버 감사 REV-076S (챌린지 난이도 `level` · 생성 기준 수준 T)

> 이력서 [[task-076-improve-challenge-level-generation]] · developer 기록 [[task-076-dev-server-record]] · 감사 대상 = 서버 쪽만(`src/modules/**`·`src/app/api/**`·`src/types/**`·`docs/design/{api-contract,challenge}.md`). 화면(`src/components/**`)·task-075 파일은 제외. 코드·시험·문서는 고치지 않았고 이 파일만 새로 썼다.

## 최종 판정: **PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 5 · Info 4

판정 근거(요약): 규칙 한 곳(`targetLevel.ts`)이 승인 데모 v2 결정표 9줄·D4 A·D6 A·L7·L8·L9 와 일치하고, 소비처 5곳은 던지지 않는 읽기 실패 폴백·트랜잭션 밖 읽기·소유자 검사 불변을 지킨다. `Challenge.level` 을 읽는 서버 코드는 `view.ts`(출력)·`store.ts`(select)·`targetLevel.ts` 뿐이라 «챌린지 난이도 = 주제 난이도» 가정으로 깨지는 서버 경로가 없다. DB·스키마 변경 0(`git diff --stat -- prisma` 빈 출력). 직접 변이 17개 중 15개를 시험이 잡았고 생존 2개(상황·붙여넣은 글 수업에 T 적용)는 코드 diff 로 불변을 확인했으나 시험 공백으로 남긴다(L-3). 화면 단계에 넘길 사항은 아래 「화면 단계에 영향 주는 사항」.

## A~G 판정 표

| 항목 | 판정 | 근거 |
|---|---|---|
| **A. 규칙 정확성** | 통과 | `targetLevel.ts:43-49` 순수 `resolveTargetLevel` — 챌린지(`isJlptLevel`) > `profile.goalLevel` > `profile.level` > null. `readTargetLevel:84-93` 은 챌린지가 있으면 프로필을 읽지 않고, 전체가 `try/catch` 라 던지지 않으며(변이 R11 포착) 로그는 오류 이름만(R12 포착 — `e.name`). `getInProgressChallengeLevel:58-67` 은 `findFirst` 1회(읽기만)·`isChallengeInProgress` 재사용(R14 포착). **한계 ①(시작 전 포함) 판정 = 결함 아님, 허용 가능한 차이**: ⓐ 가린 시드 예외·주제 삭제 ack 와 «판정 하나»(REV-152a L-1)를 유지하는 쪽이 한 정의를 두 곳에서 갈라 쓰는 것보다 안전 ⓑ 영향은 «내일 시작» 챌린지를 만든 당일의 생성 수준·뱃지 꼬리표 1일 앞당김뿐, 사용자가 직접 고른 난이도라 해가 작음 ⓒ 화면 쪽 초안이 이미 같은 집합으로 옮겨 쓰고 있다(`components/vocab/topicLogic.ts` `mineSetChallengeLevel` — 감사 범위 밖 파일을 읽어 확인만) → 서버·화면 문장이 어긋나지 않는다. 한계 ②(수업 과제를 끈 «단어만» 챌린지도 회화 T = 챌린지 난이도)도 규칙 문구 «진행 중 챌린지가 있으면» 그대로이며 사용자 요청(«챌린지의 난이도에 따라 생성»)과 맞다. 둘 다 폰·QA 확인 항목으로 남긴다. |
| **B-1 #156 `level`** (`validate.ts:46,69-73`·`service.ts:108`) | 통과 | 화이트리스트에 `level` 추가·모르는 키 400 유지(R15 포착). 값 검사는 `isJlptLevel` = `typeof==='string' ∧ 목록 포함` → 대소문자·공백·숫자·배열·객체·빈 문자열 400 `field:'level'`(시험 9종). `undefined`/`null` 만 «미지정» → `input.level ?? topic.level`(R2·R3 포착). `Challenge.level` 로 만들 때 얼림 — 수정 경로 없음(`challenge.update` 에 level 쓰는 곳 0건 grep). 소유자·트랜잭션·429·409 흐름은 diff 에 없음(불변). |
| **B-2 주제 수업 재료** (`generate.ts:111-137`) | 통과 | `TopicLessonDeps.targetLevel` 새 의존, 주제 수업만 `target?.level ?? topic.level`(R6 포착). `loadScenarioLessonMaterials`(`:103`)·text 분기(`:144`)는 diff 에 없음 = L7 대로 불변. 읽기는 `createLesson` 트랜잭션 밖(`route.ts:22` 에서 재료를 먼저 읽음). |
| **B-3 A4 입력** (`lessonInput.ts`) | 통과(범위 주의) | 두 분기 모두 `topicInput(m.topic, m.level)`. 이전에는 `t.level`(= 주제 행)을 썼고 `Lesson.level` 도 주제 수준이라 서로 같았으므로 developer 발견은 타당. 상황 수업은 `m.level` = 대표 주제 수준이라 바이트 불변(골든 시험 통과). **범위**: 챌린지가 없는 사용자의 **모든 주제 수업**도 A4 `[주제] … 수준 X` 줄과 `loadPersona({level: contentLevel})`(`prompts/lesson.ts:254,385`)이 T(= 목표 수준 ?? 지금 수준)로 바뀐다 — 결정표 5~8줄(«주제 수준 → N3» 등 색 칸)로 승인된 변화이며 A4 출력 검사에는 level 검사가 없어(`structuredResponse/checks.ts`) 검증 실패를 만들지 않는다. 호출자는 `app/api/v1/lessons/route.ts` 한 곳 뿐이라 프롬프트 수준과 저장 `Lesson.level` 이 같은 `m` 에서 나온다(R7 포착). |
| **B-4 #58 추천** (`today.ts:53-60,112-130,208`) | 통과 | `TodayLessonRecommendation = LessonRecommendation + {lessonLevel, levelSource}` — `level`(주제 난이도)·`reason`·주제는 건드리지 않는다(L8, R13 포착). 기준 못 정하면 둘 다 null(R8 포착). `recommendWithLessonLevel` 이 #58 이 이미 읽은 프로필을 재사용해 `getProfile` 2회 호출을 피함. `Promise.all` 두 갈래 모두 던지지 않거나(readTargetLevel) 기존과 같은 오류 전파(recommendTodayLesson). 라우트는 dto 를 그대로 `ok()` 로 내려 새 칸이 잘리지 않음(`today/route.ts`). |
| **B-5 주제 세트 새 단어** (`sessions.ts:477-479,589-592,613-621`·`topicSet.ts:470-486,514,542`) | 통과 | A12 를 실제로 부를 때만 챌린지 1회 읽음(`topicSetChallenge`, 실패 → null → 주제 수준, 로그 이름만). `topicWordsLevel` 은 «진행 중 챌린지의 그 주제»만 챌린지 난이도(R4 포착). 같은 `level` 이 `build` 의 `[수준]` 과 `assemble` 의 검사 ⑤ 창에 들어간다(R9 포착). 읽기는 `beginTopicWordsGeneration` 뒤 `try/finally` 안이고 함수가 던지지 않아 생성 중 표식이 새지 않음. |
| **B-6 내 단어장 세트 천장** (`sessions.ts:451-470`) | 통과 | `mineSetCeiling` 한 곳(D6 A): 챌린지 출처면 `t.level`, 아니면 `ceilingOf(level, goalLevel)`(R5 포착 — 목표 우선으로 바꾸면 8번 줄 실패). `levelCeilingFor` 는 챌린지·프로필을 `Promise.all` 로 병렬 읽고 어느 하나 실패해도 `undefined`(가중 없이 세트, R10 포착) — 챌린지는 있는데 프로필만 실패한 경우도 undefined 인데 «부가 기능이라 세트를 막지 않는다»는 기존 원칙과 맞다. 트랜잭션 밖에서 읽음(`createVocabSession:491`). D6 B 전환 = 함수 본문 한 줄. |
| **C. `Challenge.level` 파급 전수** | 통과(서버) | 아래 C 표. 서버에서 챌린지 `level` 을 읽는 곳은 3곳이고 어느 곳도 주제 난이도와 비교·필터하지 않는다. |
| **D. 보안·안정성** | 통과 | 아래 D 표. |
| **E. 시험** | 통과(공백 Low 1) | 아래 E 표·변이 표. |
| **F. 증빙 재실행** | 통과 | 아래 F 표. |
| **G. 계약 문서·DB** | 통과(문서 stale Low 2) | `git diff --stat -- prisma` = 0줄. #58 예시·#156 본문/화이트리스트/`level` 규칙/서버 먼저 배포, challenge.md §4-6 표가 코드와 일치. stale 3곳은 L-1·L-2. |

### C. `Challenge.level` 읽는 곳 전수(서버 grep: `challenge.level`·`row.level`·`r.level`·`level: ch…`·`challenges/**` 안 `level`)
| 위치 | 용도 | «챌린지 난이도 = 주제 난이도» 가정? |
|---|---|---|
| `challenges/store.ts:41` | `CHALLENGE_ROW_SELECT` 에 `level` 포함 | 아니오(선택만) |
| `challenges/view.ts:122` `toChallengeSummary` | #155·#157·#158 응답의 `level` = 저장값 | 아니오(그대로 노출 — 화면이 "챌린지 난이도"로 읽는다) |
| `challenges/progress.ts:132,151-157` `getActiveChallengeTopic` | `level` = **주제** 행의 `level`(챌린지 `level` 아님) → #58 `reason:'CHALLENGE'` 추천의 `level` | 주제 수준을 쓰므로 L8 과 일치(오히려 가정 반대) |
| `lessons/today.ts:107` | 위 값을 추천 `level` 로 | 위와 같음 |
| `targetLevel.ts:66,87` · `vocab/sessions.ts:478` | T·천장·새 단어 수준의 입력 | 신규 소비처(의도) |
| `challenges/{settle,metrics,topicProgress}.ts` | `level` 사용 0건 | 해당 없음(정산·집계는 영향 없음) |
| `topics/**`(`remove.ts` 의 ack, `visible.ts`, `pool.ts`) | `level` 로 챌린지를 거르거나 주제와 비교하는 코드 0건 | 해당 없음 |
| `app/api/v1/challenges/**` | `level` 사용 0건(서비스 위임) | 해당 없음 |
| 다시 도전 `?again` | 서버 없음 — #157 `level` 을 화면이 초안에 채움(화면 단계) | 서버 영향 없음 |
| 화면(범위 밖, 참고) | `components/vocab/topicLogic.ts:43`·`ChallengePlanCard.tsx:140` 가 `c.level` 을 챌린지 난이도로 표시 — 의미가 이제 «고른 난이도»라 의도와 일치 | 화면 단계에서 확인 |

### D. 보안·안정성
| 점검 | 결과 |
|---|---|
| 입력 검증 | 타입·대소문자·공백·배열·객체 거부 + 모르는 키 400. `isJlptLevel` 은 `typeof string` 먼저라 배열/객체가 `includes` 에 들어가지 않음. DB enum 에는 검증된 5값만 도달. |
| 소유자·capability | `requireSession` → `session.user.id` 로만 읽음. 새 읽기 3종(`findFirst({userId,…})`·프로필 upsert)이 모두 `userId` 한정. 타인 값 노출 경로 없음. |
| 추가 DB 읽기 | #58 +1(챌린지 `findFirst`, 프로필 재사용) · #59 주제 수업 +1(+챌린지 없을 때 프로필 1) · #47 내 단어장 세트 +1(프로필과 병렬) · #47 주제 세트 A12 직전 +1. 전부 `await` 가 `withTransaction`/`composeTopicSessionTx` 전, 인덱스 `@@index([userId,status,startDate])`, ACTIVE 는 `activeKey` 유일이라 1행. N+1 없음. |
| 읽기 실패 격리 | `readTargetLevel`(null)·`levelCeilingFor`(undefined)·`topicSetChallenge`(null) 모두 삼키고 지금 동작으로 폴백 — 변이 R10·R11 포착. 로그 3곳 모두 `e.name` 만(`targetLevel.ts:90`·`sessions.ts:617`). |
| `getProfile` upsert 부작용 | 행이 없으면 만든다(기존 #58·붙여넣기 수업과 같은 동작) — #59 주제 수업에서 챌린지가 없을 때 새로 부르게 됐을 뿐. 신규 사용자 동시 요청 경쟁이 나도 `try/catch` 로 null → 주제 수준 폴백이라 수업 생성은 막히지 않음(경쟁 시 오류 종류는 추정). |
| 6층·import | 신규 파일은 learning 바로 아래, `topics/visible`·preferences·infra 만 값 import. `topics/**`·`vocab`·`challenges` 가 `challenges` 를 값 import 하지 않는 REV-121 L-5 경계 시험(task042) 통과. 하위→상위 import·`index.ts` 우회 0. |
| 엔진명·Secret·spawn | 추가 줄 grep(`reazon|whisper|style-bert|claude|model_id|speaker_id|sbv2|spawn|fetch(|secret|token|password`) 0건. 새 `console` 로그 2곳은 오류 이름만. |
| 학습 원칙 | AI 산출 저장 경로·`StatsSnapshot`·`Correction.original` 접점 없음. 읽기/수준 값 선택만 바뀜. |

### E. 시험 평가
- 결정표 9줄 정답은 `task076.test.ts:42-52` 의 **손으로 옮긴 표**(구현 식 재사용 없음, 데모 `#rules` 와 줄 대조: 1~9줄 챌린지·프로필·T·회화·새 단어·천장 값 일치 확인). 이 표 하나를 규칙·회화·#58·새 단어·천장 5개 소비처가 공유.
- 기존 시험 변경 5개는 모두 **약화가 아니라 배선 보강**: `seedVisibility`·`task045Fix4`는 새 필수 의존 `targetLevel: async () => null` 만 추가, `task053`은 기존 단언 7개를 그대로 두고 `noChallenge` 인자만 끼움, `task042` 가짜 `challenge.findFirst` 는 `where.topicId` 가 있을 때 기존과 같은 비교를 유지하고 없을 때만 전체(실제 DB 의 «주제 조건 없는 조회»를 흉내) + 새 e2e 1개, `lessonInput` 은 새 시험 1개 추가.
- 기본 배선(`TOPIC_LESSON_DEPS.targetLevel`·`readInProgressChallengeLevel` 의 실제 prisma 경로)은 DB 필요라 단위로 못 본다 — 타입이 필수 필드로 강제하므로 누락은 tsc 가 잡지만 «틀린 함수 연결»은 못 잡음(L-3 에 포함).

### F. 증빙 재실행(미러 `~/.node-local/thekaiwa-rev076s`, 서버 `src/modules`·`src/app/api`·`src/types` 가 저장소와 `diff -rq` 동일, 소스 hardlink 0)
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 |
| `./node_modules/.bin/eslint` 변경 16파일(소스 10 + 시험 6) | exit 0 |
| `DATABASE_URL=<가짜> node --import tsx --test --test-concurrency=1 task076·task042·task053·seedVisibility·challengeRecommend·task045Fix4·lessonInput` | 105/105 pass |
| 같은 방식, `src/modules/learning`·`src/modules/conversation`·`src/app/api/v1/{lessons,challenges,vocab}` 전체 108파일 | tests 1,874 · pass 1,873 · fail 0 · skipped 1(기존) |
| `src/components` 의 challenge·vocab 시험 포함 선택 실행(task-075/화면 작업 중 파일 포함 스냅샷) | 487/487 pass(참고용, 감사 대상 아님) |
| `git diff --stat -- prisma` | 빈 출력(0) |
| 전체 시험·`next build` | 선택 항목 — developer 보고(4,351 pass·fail 0·build exit 0)를 재실행하지 않음 |

## 직접 변이 실험(미러에서만, 임시 파일 + `os.replace`, 변이마다 저장소 원본으로 복원 후 `cmp` 동일 확인, 끝난 뒤 `.mut-*` 잔재 0·서버 디렉터리 `diff -rq` 동일). 스크립트: 세션 scratchpad `mut076s.py`

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| R1 | 프로필 안에서 지금 수준을 목표 수준보다 먼저 | 포착 | task076 규칙표·회화·#58 |
| R2 | `level:null` 을 400 으로 | 포착 | #156 검증 시험 |
| R3 | 고른 `level` 무시(`topic.level ?? input.level`) | 포착 | #156 저장·진행 중 판정·회화·#58 |
| R4 | 다른 주제 세트에도 챌린지 난이도 | 포착 | task042 e2e·새 단어 수준 표 |
| R5 | 천장이 챌린지 없을 때도 T(목표 우선) | 포착 | task053·천장 표·`mineSetCeiling` 표 |
| R6 | 주제 수업에 T 미적용 | 포착 | 회화 수준 표 |
| R7 | A4 입력이 주제 행 수준(되돌림) | 포착 | lessonInput 새 시험 |
| R8 | 기준 못 정할 때 `levelSource` 를 `'LEVEL'` 로 거짓 표시 | 포착 | #58 null 시험 |
| R9 | 검사 ⑤ 창만 주제 수준 | 포착 | task042 e2e·`runTopicWords` 시험 |
| R10 | 챌린지 조회 실패를 «없음»으로 삼킴 | 포착 | 천장 실패 시험 |
| R11 | `readTargetLevel` 이 던짐 | 포착 | 회화·#58·실패 시험 |
| R12 | 로그에 `e.message` | 포착 | 회화 실패 시험(로그 정확 일치) |
| R13 | 추천 `level` 의미 변경(L8 위반) | 포착 | #58 시험 2개 |
| R14 | 진행 중 판정 빠짐(기간 지난 ACTIVE 포함) | 포착 | 진행 중 판정·task042 e2e |
| R15 | #156 화이트리스트 확장(`goalLevel` 허용) | 포착 | unknown_key 시험 |
| R16 | **상황 수업에 T 적용(M9 재현)** | **생존** | 없음 — `ScenarioLessonDeps` 에 주입점이 없어 기본(실제 prisma, 가짜 URL)이 실패→null 로 원래 값이 나옴 |
| R17 | **붙여넣은 글 수업에 T 적용** | **생존** | 없음 — 같은 이유(`getProfile` 직접 호출) |

R16·R17 판단: 현재 코드는 두 분기가 diff 에 없음을 직접 확인(`generate.ts` diff 는 `TopicLessonDeps`·`loadTopicLessonMaterials` 뿐)했으므로 **지금 결함은 아니다**. 그러나 미래 회귀를 시험이 잡지 못하므로 L-3 로 기록하고 QA 라이브 행으로 보증을 요청한다(상황 수업·붙여넣은 글 수업 `Lesson.level` 불변).

## 발견 목록

| ID | 심각도 | 위치 | 내용 · 근거 | 권고 |
|---|---|---|---|---|
| L-1 | Low | `docs/screens.md:14250`(§33-3 표 마지막 행) | «오늘의 회화 추천 … 추천 `level` = T, 새 `levelSource`» — 구현은 L8 대로 `level` = **주제 난이도**, 새 칸 `lessonLevel`(= T)·`levelSource`. 화면 구현자가 이 줄을 따르면 `rec.level` 을 T 로 오인한다(현재 저장소의 화면 초안은 `lessonLevel` 을 쓰고 있어 어긋나지 않음). | §33-3 행을 «`lessonLevel`·`levelSource` 두 칸, `level` 은 주제 난이도»로 고친다(Leader·designer 문서). |
| L-2 | Low | `docs/design/domain-model.md:2419`·`docs/design/api-contract.md:359`(엔드포인트 색인)·`:2033`(#156 불릿 모양) | ① `Challenge` 행 설명 «`level`(주제 수준을 만들 때 복사)» 가 stale — 이제 «사용자가 고른 난이도(없으면 주제 수준), 만들 때 얼림» ② #156 색인 행의 요청 본문·오류에 `level?`·`VALIDATION field:'level'` 없음 ③ #156 본문 첫 불릿이 `level` 불릿에 기존 문장(`lengthDays`·`start`·`dailyGoal`·`wordCount`·`title` 설명)이 흡수되어 읽기가 어렵다. 정본 5종에 속하는 문서라 stale 은 누적 위험. | 세 곳 문구 정리(코드 변경 없음). |
| L-3 | Low | `generate.ts`(상황 분기 `:103`·text 분기 `:144`)·시험 공백 | 상황·붙여넣은 글 수업에 T 를 적용하는 회귀를 시험이 잡지 못한다(R16·R17 생존). 기본 배선(`TOPIC_LESSON_DEPS.targetLevel`, `readInProgressChallengeLevel`)의 «함수 연결 오류»도 단위로는 못 본다. 지금 코드 불변은 diff 로 확인. | QA 라이브 행으로 보증(아래 high_risk_areas 3·1). 장기적으로는 `loadScenarioLessonMaterials`·text 분기에 `TopicLessonDeps` 같은 주입점을 두고 «T 를 읽지 않음»을 동작으로 단언(선택). |
| L-4 | Low | A4·A12 생성 품질(개발 기록 한계 6 = L5) | 챌린지 난이도가 주제와 2단계 이상 다를 때(예: N4 주제 + N1, N5 주제 + N2) A4 가 N4 조각 재료로 N1 수업을 쓰거나, A12 검사 ⑤ 창(±1) 때문에 유효 새 단어가 모자라 B1 채움으로 떨어지는 정도는 오프라인으로 볼 수 없다. 사용자 승인(질문 3: 상한 없음)이라 결함은 아님. | QA 라이브 샘플 최소 2쌍(높게·낮게)과 A12 가 채워진 장수 확인. prompt-engineer 점검 여부는 Leader 판단. |
| L-5 | Low | `targetLevel.ts:20-24` | `JLPT_LEVELS`·`isJlptLevel` 가 같은 모듈 군에 이미 있는 `topics/index.ts` `JLPT_ORDER`·`scenarios/shape.ts` `SCENARIO_LEVELS`·`vocab/setGenerator.ts` `LEVEL_ORDER` 와 같은 정의의 또 한 사본이다(저장소 grep 으로 상수·판별 함수가 이미 10여 곳). 값이 다섯 개로 고정이라 오류 위험은 낮다. | 다음 정리 때 한 곳으로 모으기(이번 task 범위 밖). |
| I-1 | Info | `evaluation/materials.ts:131`·`challenges/index.ts:4` | 주석 stale — «오늘의 단어 세트 `levelCeilingFor` 와 같은 규칙»(챌린지 중에는 달라짐; 평가는 L6 범위 밖이라 동작은 맞음), «import: ../topics·../topics/pool·preferences·infra 만»(`validate.ts` 가 `../targetLevel` 을 값 import). | 주석만 갱신. |
| I-2 | Info | `generate.ts` `claimLessonTx` `sameLessonWhere` | 같은 날 같은 주제의 READY/IN_PROGRESS 수업은 수준과 무관하게 재사용된다 — 새 챌린지를 만들기 전에 이미 만든 수업은 이전 수준 그대로이고 #58 `lessonLevel` 은 새 T 를 말한다. 기존 규칙이고 화면은 하던 수업을 먼저 보이므로 영향이 작다. | 폰 확인 한 줄(선택). |
| I-3 | Info | 한계 ①② 판정 | 시작 전 챌린지·단어만 챌린지의 T 적용은 허용(A 표 판정). 서버·화면(초안)이 같은 «진행 중» 집합을 쓴다. | 폰 확인: «내일 시작» 챌린지를 만든 당일 오늘 탭 문구, «단어만» 챌린지의 회화 수준. |
| I-4 | Info | 비챌린지 주제 수업의 변화 범위 | B-3 에 적은 대로 이번 변경은 챌린지 사용자만이 아니라 **모든 사용자의 주제 수업** 수준(`Lesson.level`·A4 프롬프트·페르소나 섹션)을 T 로 바꾼다. 결정표 5~8줄로 승인된 범위이나 영향 범위로서 Leader 보고에 한 줄 필요. | 최종 요약에 명시. |

## 화면 단계에 영향 주는 사항
1. **L-1**: `docs/screens.md` §33-3 마지막 행을 따르지 말고 `lessonLevel`·`levelSource` 를 쓸 것(`level` 은 주제 난이도 — «주제 고르기»와 같은 값). `levelSource` 가 null 이면 둘 다 null(지금 뱃지로 폴백).
2. #156 은 모르는 키를 400 으로 막으므로 **서버를 먼저 배포**(L9). 화면은 `level` 을 생략하면 주제 난이도(기존 동작)이니 «고르지 않으면 보내지 않기»가 가장 안전. 값은 `N5|N4|N3|N2|N1` 정확히(소문자·공백 불가, 400 `field:'level'`).
3. 준비 줄(P10)의 «챌린지 중» 판정은 서버 `isChallengeInProgress`(ACTIVE ∧ 주제 있음 ∧ 종료일 ≥ 오늘 — **시작 전 포함**, 과제 켜짐 무관)와 같아야 문장이 맞는다 — 화면 초안(`mineSetChallengeLevel`)은 이미 그렇게 옮겨 있음(이번 감사 범위 밖이라 읽기만 확인, 화면 감사에서 재확인).
4. `topicLogic.ts` `challengeCtxOf` 의 `level: c.level` 은 이제 «고른 챌린지 난이도» — 주제 세트 칩에서 주제 난이도로 오인되는 문구가 없는지 화면 감사에서 확인.

## QA 에 넘기는 high_risk_areas
1. **상황 수업·붙여넣은 글 수업 불변(L7, 변이 R16·R17 생존)**: 진행 중 챌린지(예: N2)가 있는 상태에서 상황 수업·붙여넣은 글 수업을 만들어 `Lesson.level` 이 각각 대표 주제/상황 수준·학습자 수준 그대로인지 실제 HTTP 로 확인.
2. **#156 `level` 경계**: `N5..N1` 저장·응답 `level`, 생략/null = 주제 난이도, `"n3"`·`"N6"`·`""`·`3`·`["N3"]` 400 `field:'level'`, 모르는 키(`goalLevel`) 400, 이미 ACTIVE 면 409.
3. **#58 새 칸**: 챌린지 없음(목표 있음/없음)·챌린지 있음(주제보다 높게/낮게/미지정)·«내일 시작»·«단어만» 챌린지에서 `lessonLevel`·`levelSource` 값과 `level`(주제 난이도)·`reason` 불변.
4. **#59 주제 수업 `Lesson.level`**: #58 의 `lessonLevel` 과 같은 값(추천 주제·«다른 주제» 모두), 같은 날 재사용(I-2).
5. **주제 세트 새 단어 수준(품질, L-4)**: 챌린지 난이도가 주제와 2단계 이상 다를 때 A12 가 채운 장수·B1 채움 비율, 다른 주제 세트는 주제 수준 그대로.
6. **내 단어장 세트 가중(D6 A)**: 챌린지 중 난이도 기준 가중(예: 목표 N3 + 챌린지 N5 → N3 단어가 거의 안 나옴), 챌린지 종료·기간 지남 후 원래 기준 복귀.
7. **오늘의 평가·집계·정산은 불변**(L6 범위 밖): 같은 날 평가 단어 수준 규칙과 챌린지 결과 집계가 이전과 같은지 회귀 1~2건.
8. **신규 사용자(프로필 행 없음)** 의 첫 #59/#58 호출이 막히지 않음.

native_change: false(서버만, `android/**`·`plugins/**`·Manifest 변경 없음) · DB 변경 없음.

## Codex 검토
없음(이번 서버 감사 시점에 task 이력서 `## Codex 검토` 항목이 아직 오지 않음) — 판정 기준은 그대로.
