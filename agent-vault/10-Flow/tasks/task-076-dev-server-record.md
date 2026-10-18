---
task_id: task-076
role: developer
tags:
  - type/task-record
  - domain/challenge
  - domain/lesson
  - domain/vocab
created: 2026-10-18
updated: 2026-10-18
---

# task-076 developer 기록 — 서버 쪽 (챌린지 난이도 `level`·생성 기준 수준 T)

> 이력서: [[task-076-improve-challenge-level-generation]] · 화면 정본 `docs/screens.md` §33 · 승인 데모 v2(「D1~D11 권고대로 승인, 질문 5는 a로」) · 설계 `docs/design/challenge.md` §4-6.

## 한 줄 요약
#156 에 선택 `level`(N5~N1, 기본 주제 난이도, `Challenge.level` 에 얼림 — DB 변경 없음)을 받고, 규칙 함수 하나(`learning/targetLevel.ts` `resolveTargetLevel`: `T = 진행 중 챌린지 ? challenge.level : goalLevel ?? level`)를 오늘의 회화 주제 수업 수준·#58 추천 새 칸(`lessonLevel`·`levelSource`)·챌린지 주제 세트 「새 단어」 수준·내 단어장 세트 가중 기준(D6 A, `mineSetCeiling` 한 곳)이 같이 쓰게 했다. 붙여넣은 글·상황 수업·추천 `level`·주제 고르기·평가·집계·프롬프트 문구는 그대로.

## 규칙 함수 위치와 이유
- **`src/modules/learning/targetLevel.ts`**(learning 바로 아래 — 앞선 예 `refs.ts`). 처음엔 `challenges/` 에 두었으나 **task042 import 경계 시험(REV-121 L-5)** 이 `vocab/sessions.ts`·`vocab/topicSet.ts`·`topics/**` 의 `../challenges`(·`challenges/*`·`lessons/today`·barrel) **값 import 를 금지**한다(`lessons/today → challenges → topics/pool` 순환 방지). 이 파일은 `topics/visible`·preferences·infra 만 값 import 하므로 lessons·vocab·challenges 모두 순환 없이 쓴다(경계 시험 통과).
- **「진행 중」 판정 = 기존 단일 정의 `topics/visible.ts` `isChallengeInProgress`**(ACTIVE ∧ topicId ≠ null ∧ 종료일 ≥ 오늘 — **시작 전 포함**, 과제 켜짐 여부 무관, REV-152a L-1 "판정 하나"). 그래서 「내일 시작」 챌린지를 만든 당일에도 T = 챌린지 난이도·`levelSource:'CHALLENGE'` 다(#58 의 `reason:'CHALLENGE'` 추천은 지금처럼 기간 안·수업 과제 켜짐일 때만 — `getActiveChallengeTopic` 불변). **Leader 확인 권장**(알려진 한계 ①).
- 6층: 전부 L3 learning 안(+ L1 preferences·L6 infra 하향). 라우트 변경은 `lessonInput.ts`(#59 A4 입력 조립, app 층) 1곳뿐. 엔진명·모델명 노출 0.

## 변경 파일
| 파일 | 내용 |
|---|---|
| `src/modules/learning/targetLevel.ts` (새) | `JLPT_LEVELS`·`isJlptLevel` · 순수 `resolveTargetLevel(challengeLevel, profile)` → `{level, source:'CHALLENGE'\|'GOAL'\|'LEVEL'}`\|null · `getInProgressChallengeLevel(db, userId, now)`(읽기 1회) · `readTargetLevel(userId, {db?, now?, profile?})`(던지지 않음 — 실패 null, 로그는 오류 이름만, 챌린지가 있으면 프로필 안 읽음) |
| `challenges/validate.ts` | #156 화이트리스트에 `level`, 값 검사(N5~N1 외 400 `field:'level'`·`reason:'N5\|N4\|N3\|N2\|N1'`, 생략·null = null), `CreateChallengeInput.level` |
| `challenges/service.ts` | `level: input.level ?? topic.level` |
| `lessons/generate.ts` | `TopicLessonDeps.targetLevel` 새 의존(기본 `readTargetLevel`) → 주제 수업 `level = T ?? topic.level`. text·scenario 분기 불변 |
| `app/api/v1/lessons/_lib/lessonInput.ts` | **발견**: A4 프롬프트 `[주제] … 수준` 은 `m.level` 이 아니라 주제 행 `t.level` 을 쓰고 있었다 → `topicInput(t, m.level)`. 상황 수업 대표 주제는 `m.level` = 주제 수준이라 바이트 불변(골든 시험 통과) |
| `lessons/today.ts` | `TodayLessonRecommendation`(= 추천 + `lessonLevel`·`levelSource`) · 순수 `attachLessonLevel` · `recommendWithLessonLevel(userId, profile, over)`(#58 이 이미 읽은 프로필 재사용) — `recommendTodayLesson`·`LessonRecommendation` 불변 |
| `vocab/topicSet.ts` | `RunTopicWordsArgs.level?` — A12 build `topic.level` 과 assemble(검사 ⑤ 창)에 같은 값, 생략 = 주제 수준 |
| `vocab/sessions.ts` | `mineSetCeiling`(**D6 A 한 곳** — D6 B 는 본문을 `return ceilingOf(profile.level, profile.goalLevel)` 한 줄로) · `levelCeilingFor(userId, read?, challengeLevelOf?)`(둘을 병렬로, 하나라도 실패 → undefined, 트랜잭션 밖) · `topicWordsLevel(topic, challenge)`(그 주제가 진행 중 챌린지 주제일 때만) · 주제 세트는 A12 를 실제로 부를 때만 챌린지 1회 읽음(`deps.db`, 실패 → 주제 수준, 로그 이름만) |
| `src/types/lesson.ts` | `LessonRecommendation.lessonLevel?`·`levelSource?`(additive, 선택) |
| `src/types/challenge.ts` | `CreateChallengeBody.level?` |
| `docs/design/api-contract.md` | #58 예시·설명(새 칸, `level` 의미 불변, 시작 전 포함), #156 본문·화이트리스트·`level` 규칙·서버 먼저 배포 |
| `docs/design/challenge.md` | 머리 한 줄 · §4-3a 입력 수준·검사 ⑤ 주석 · **§4-6 새 절**(난이도 고르기·T 규칙·적용 표·D6 전환 한 곳) |
| 시험 | 새 `__tests__/task076.test.ts`(13) · `task042.test.ts` e2e 1개 + 가짜 `challenge.findFirst` 주제 조건 없을 때 전체 · `lessonInput.test.ts` 1개 · 기존 3개 의존 보강(`seedVisibility`·`task045Fix4` = `targetLevel: async () => null`, `task053` = `noChallenge`) |

## 소비처별 전 → 후
| 소비처 | 전 | 후 |
|---|---|---|
| #156 만들기 | `level` = 주제 난이도(키 보내면 400 unknown_key) | 선택 `level`, 없으면 주제 난이도 |
| #59 주제 수업 `Lesson.level`·A4 수준 | 주제 수준 | T(확정 못 하면 주제 수준) |
| #59 붙여넣은 글 / 상황 수업 | 학습자 수준 / 대표 주제·상황 수준 | 그대로(L7) |
| #58 `recommendation` | `{topicId, topicTitle, level, reason, nextPreview}` | + `lessonLevel`(T)·`levelSource`, `level` 의미 그대로(L8) |
| #47 주제 세트 새 단어(A12 `[수준]`·검사 ⑤) | 주제 수준 | 진행 중 챌린지의 그 주제면 챌린지 난이도, 아니면 주제 수준 |
| #47 내 단어장 세트 가중 기준 | `ceilingOf(level, goalLevel)`, 프로필 실패 undefined | 진행 중 챌린지면 `challenge.level`, 아니면 그대로. 챌린지·프로필 실패 undefined |

## API 계약 변경 (화면 단계에게 넘길 계약 요약)
- **#156 `POST /api/v1/challenges`** 본문 선택 `level: 'N5'|'N4'|'N3'|'N2'|'N1'`. 생략 또는 `null` = 주제 난이도. 그 밖(소문자·`"N6"`·숫자·배열 등) → **400 `VALIDATION` `details {field:'level', reason:'N5|N4|N3|N2|N1'}`**. 모르는 키는 여전히 400 `unknown_key`. 응답 `ChallengeDetail.level` = 저장값. 타입 `src/types/challenge.ts` `CreateChallengeBody.level?: JlptLevel`. **서버를 화면보다 먼저 배포**(옛 서버는 `level` 키를 400).
- **#157·#155·#158**: `level` 은 이미 행 값(`view.ts:122`) — 변경 없음. `?again=` 은 #157 `level` 을 그대로 채우면 된다.
- **#58 `GET /api/v1/lessons/today`** `recommendation` 에 `lessonLevel: JlptLevel|null`, `levelSource: 'CHALLENGE'|'GOAL'|'LEVEL'|null`. 둘 다 null = T 확정 실패(화면은 지금 뱃지 = `level`). **회화 뱃지(D7 B)는 `lessonLevel`·`levelSource` 를 쓴다**(`level` 은 주제 난이도 — 「주제 고르기」와 같은 값). 타입은 `src/types/lesson.ts` 에 선택 필드로 추가됨.
- P10(챌린지 중 준비 줄 「챌린지 난이도(…)까지의 단어가 주로 나와요.」)에 필요한 챌린지 난이도는 #158 `challenge.level`(계획표 카드와 같은 값)에서 얻는다 — 서버 추가 필드 없음.

## 시험
| 시험 | 내용 |
|---|---|
| task076 #1 | `resolveTargetLevel` 결정표 9줄(손으로 적은 정답) + 이상값 |
| task076 #2·#3 | #156 `level` 검증 표(허용 5·생략·null·거절 9종·모르는 키 400 유지) · 저장/응답 level · 미지정 = 주제 난이도 |
| task076 #4 | 진행 중 판정 — 없음·내일 시작(포함)·기간 지남(정산 전, 제외)·그만둠(제외)·읽기만 |
| task076 #5~#7 | 주제 수업 수준 9줄 × 챌린지 주제·다른 주제 · 챌린지 조회 실패 → 주제 수준(로그 이름만) · 상황 수업 불변 |
| task076 #8·#9 | #58 새 칸 1~8줄 · `level`·주제·reason 불변 · 실패 시 null · 추천 null |
| task076 #10·#11 | 새 단어 수준 9줄 × 챌린지 주제/다른 주제 · `runTopicWords` build·assemble 같은 값, 생략 = 주제 수준 |
| task076 #12·#13 | 천장 9줄 · 챌린지 실패/프로필 실패/이상값 undefined · `mineSetCeiling` 순수 표 9칸 |
| task042 e2e | `createVocabSession` 주제 세트: 챌린지 주제 → A12 build·assemble N3 · 다른 주제의 챌린지·기간 지난 챌린지 → 주제 수준 N5 |
| lessonInput | A4 `topic.level` = `m.level`(N2), 프롬프트 `[주제] … 수준 N2`, 재료 불변 |

## 변이 점검 (17개 — 포착 16 · 생존 1)
임시 미러 `~/.node-local/thekaiwa-dev076-mut`(node_modules 만 심볼릭, 소스는 실제 복사본 — 하드링크 0개 확인)에서 변이마다 임시 파일 → `os.replace`, 시험 4파일(task076·task042·challengeRecommend·lessonInput) 실행 후 저장소 원본으로 복원. 끝난 뒤 변경 8파일 `cmp` 동일·`diff -rq src` 차이 0. 스크립트: 세션 scratchpad `mut076.py`.

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | T 우선순위 뒤바꿈(목표 > 챌린지) | 포착 | task076 #1·#12·#13 |
| M2 | goalLevel null 이면 지금 수준으로 안 내려감 | 포착 | #1·#5·#8 |
| M3 | #156 level 검증 완화(아무 값) | 포착 | #2 |
| M4 | 화이트리스트에서 level 빠짐 | 포착 | #2·#3·#4 |
| M5 | 만들기가 고른 level 무시 | 포착 | #3·#4·#5 |
| M6 | 내 단어장 천장 분기 반전 | 포착 | #12·#13 |
| M7 | 챌린지 아닌 주제 세트에도 챌린지 난이도 | 포착 | task042 e2e·#10 |
| M8 | 주제 수업에 T 미적용 | 포착 | #5 |
| M9 | **상황 수업에 T 적용** | **생존** | — 상황 분기는 `readTargetLevel` 을 기본값(실제 DB)으로 부르게 되어 가짜 DB URL 에서 실패 → null → 원래 값. DI 없는 분기라 시험이 못 잡는다(알려진 한계 ③). 코드 불변으로 보증 |
| M10 | 추천 `level` 의미 변경(→ T) | 포착 | #8·#9 |
| M11 | A4 주제 입력 수준이 주제 행 수준(되돌림) | 포착 | lessonInput 새 시험 |
| M12 | 진행 중 판정 빠짐(기간 지난 ACTIVE 포함) | 포착 | task042 e2e·#4 |
| M13 | 검사 ⑤ 창만 주제 수준 | 포착 | task042 e2e·#11 |
| M14 | 천장 — 챌린지 조회 실패를 「없음」으로 | 포착 | #13 |
| M15 | 추천 T 에 목표 수준 안 넘김 | 포착 | #8 |
| M16 | 시작 전 챌린지 제외(기간 안만) | 포착 | #4 |
| M17 | 주제 세트가 챌린지 난이도를 읽지만 A12 에 안 넘김 | 포착 | task042 e2e |

## 증빙 명령 / 결과 (미러 `~/.node-local/thekaiwa-dev076`, 저장소 → 미러 반영은 `rsync -rlt`(임시 파일+rename), 변경 18파일 `cmp` 저장소와 동일)
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 |
| `./node_modules/.bin/eslint <변경 src 17파일>` | exit 0 |
| `DATABASE_URL=<가짜> node --import tsx --test --test-concurrency=1 <영향 9파일>` | 155/155 |
| `… task076.test.ts` | 13/13 |
| 전체 `find src scripts/seed-build -name '*.test.ts'`(`--test-concurrency=1`, 가짜 `DATABASE_URL`) | **4,356 · pass 4,351 · fail 0 · skipped 5** |
| 건너뛴 5개 재실행(`KAIWA_PROJECT_ROOT`·`THEKAIWA_REPO`=저장소, 4파일) | 29 중 pass 27 · fail 0 · skip 2(brand 시험 — 미러에 `android/` 없음, 이번 변경과 무관) |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | exit 0(Turbopack 경고 3 = 기존 페르소나 파일 추적) |
| 변이 17개(`mut076.py`) | 포착 16 · 생존 1(M9) |
| 엔진·모델명 grep(추가 줄) | 0 |

DB 접속·`prisma db push/generate`·운영/QA 포트·커밋·푸시 없음. 임시 변이 미러 `~/.node-local/thekaiwa-dev076-mut` 는 남겨 둠(원본과 동일 확인, 지워도 됨).

## 알려진 한계
1. **시작 전 챌린지도 「진행 중」**(단일 정의 `isChallengeInProgress` 를 따름) — 내일 시작 챌린지를 만든 당일 회화 수업·뱃지가 챌린지 난이도·「챌린지」가 된다. 기간 안만으로 좁히려면 `getInProgressChallengeLevel` 한 곳(시작일 비교 한 줄). **Leader 확인 권장.**
2. 수업 과제를 끈(단어만) 챌린지도 T 는 챌린지 난이도(규칙 「진행 중 챌린지가 있으면」 문자 그대로). #58 의 `reason:'CHALLENGE'` 추천은 지금처럼 수업 과제 켜짐일 때만.
3. 붙여넣은 글 수업 분기(`loadLessonMaterials` text)는 `getProfile` 을 직접 불러 DI 가 없어 「T 를 잘못 적용」 변이를 시험으로 못 잡는다(코드 불변 — 구조로 보증). 상황 수업 분기도 같은 이유(변이 M9 참고).
4. DB 읽기 증가: #58 +1(챌린지 findFirst), #59 주제 수업 +1(+챌린지 없으면 프로필 1), #47 내 단어장 세트 +1(프로필과 병렬), #47 주제 세트는 A12 를 실제로 부를 때만 +1. 모두 트랜잭션 밖·인덱스 `(userId,status)` 계열.
5. `getProfile` 는 행이 없으면 만든다(upsert, 기존 동작) — #59 주제 수업에서 챌린지가 없을 때 새로 부르게 됐다(붙여넣은 글 수업이 이미 같은 방식).
6. 실제 생성 품질(챌린지 난이도가 주제보다 2단계 이상 높거나 낮을 때 A4·A12 결과)은 오프라인 시험으로 볼 수 없다 — L5(prompt-engineer 점검 여부 Leader 판단).

## reviewer 가 볼 곳
- `src/modules/learning/targetLevel.ts` 전체(규칙·진행 중 판정·실패 처리) · 경계: task042 import 경계 시험 통과 여부.
- `lessonInput.ts` `topicInput(t, m.level)` — A4 바이트 불변(골든) + T 반영.
- `vocab/sessions.ts` `mineSetCeiling`·`levelCeilingFor`(Promise.all 실패 처리)·`topicSetChallenge`(A12 를 부를 때만 읽음).
- `today.ts` `recommendWithLessonLevel` — `recommendTodayLesson` 결과를 바꾸지 않음(기존 challengeRecommend 시험 그대로 통과).
- api-contract #58·#156, challenge.md §4-6.

## Developer 기록 (체크포인트)
- [체크포인트 1] 구현 1차, tsc 0. 규칙 위치를 `challenges/` → `learning/targetLevel.ts` 로 옮김(위 이유).
- [체크포인트 2] 영향 시험 9파일 155/155 · task076 13/13 · eslint 17파일 0 · 문서 갱신.
- [완료] 전체 시험 fail 0 · build 0 · 변이 16/17 포착. 다음 = reviewer 서버 감사(L9) → 화면 developer. 화면 단계는 위 「API 계약 변경」 절만 보면 된다.
- 미커밋 파일: 위 「변경 파일」 표 전부 + 이 기록(커밋은 Leader 지시).
