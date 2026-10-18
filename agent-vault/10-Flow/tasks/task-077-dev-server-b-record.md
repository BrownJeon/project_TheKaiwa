---
task_id: task-077
role: developer
part: server-b
title: "task-077 서버 B — 레슨 일본어 도우미 입구 #184 developer 기록"
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
created: 2026-10-18
updated: 2026-10-18
---

# task-077 서버 B — #184 `POST /api/v1/lessons/:id/phrase-help` (developer 기록)

상위 이력서: [[task-077-improve-lesson-speak-translation-helper]] · 화면 정본 `docs/screens.md` §34(34-5·34-7) · 본보기 #180·#181.

## 진행 체크포인트
- [22:00] 착수. 읽음: 이력서·§34·데모 B2~B5·#180/#181 라우트·서비스·시험(task056PhraseHelpRoute·task072WordHelpServer). 미러 `~/.node-local/thekaiwa-dev077b` src = 저장소 동일(diff 0).
  - 결정(구현): 라우트가 `assertOwnedLesson`(learning index, 상태 무관 count 검사) → `helpLessonPhrase`(conversation index) 순서로 조합. 서비스는 `helpWordPhrase` 모양(장면 null·잠금 공유) + 모드 생략(v1 문장 표현). 수준 = 프로필(레슨 수준을 쓰려면 learning 새 읽기 함수가 필요 — 범위 밖, 아래 「Leader 확인」).
  - 남은 일: 서비스 함수 → 라우트 → 시험 → 미러 반영·검증 → 변이 → api-contract.
- [22:25] 체크포인트 — 구현·시험 작성 완료, 영향 시험 9파일 152/152 통과(미러).
  - 완료: `chats/phraseHelp.ts`(`helpLessonPhrase`·`LessonPhraseHelpDeps` 추가, `runPhraseHelp` 인자 이름 `chatId→refId`·`stepExtra` 타입 확장 — 기본 동작 불변) · `conversation/index.ts` export 한 줄 · 새 라우트 `lessons/[id]/phrase-help/route.ts` · 새 시험 2개(`conversation/__tests__/task077LessonHelpServer.test.ts` 18개, `app/api/v1/__tests__/task077LessonPhraseHelpRoute.test.ts` 12개).
  - 남은 일: eslint·전체 시험·next build → 변이 10+ → `api-contract.md` #184 → 기록 마무리.
  - 주의: 서버 A 가 `conversation/index.ts` 에 #185 줄을 이미 넣었다(`./chats/lessonTranslation`) — 미러 index 는 HEAD + 내 줄만(A 파일 없이 빌드하려고). 합쳐진 상태는 Leader 가 다시 돌린다.
  - 미커밋 파일: 위 5개 + 이 기록.
- [22:50] 체크포인트 — 변이 19/19 포착(아래 표), `api-contract.md` #184 행(§1-5)·§2-13 절·#180/#181 한도 공유 문구·§1-5 머리 반영. 전체 시험·next build 진행 중.

## 한 줄 요약
#184 `POST /api/v1/lessons/:id/phrase-help {queryKo}` → `{items}` — 레슨 소유만 보고(상태 무관) 장면 없는 회화방(#180 일반 모드)과 **같은 요청·같은 응답**으로 일본어 표현 1~3개를 낸다. 저장 없음, 한도(분당 10·하루 300)·동시 1건 잠금은 #180·#181 과 합산.

## 변경 파일
| 파일 | 변경 |
|---|---|
| `src/app/api/v1/lessons/[id]/phrase-help/route.ts` | **새** 라우트 — 세션 → 본문 → 한도(#180 과 같은 키) → `assertOwnedLesson`(learning index) → `helpLessonPhrase`(conversation index), `req.signal`·`no-store` |
| `src/modules/conversation/chats/phraseHelp.ts` | `helpLessonPhrase`·`LessonPhraseHelpDeps` 추가. 내부 `runPhraseHelp` 는 인자 이름 `chatId→refId`·`stepExtra` 타입만 넓힘(`mode?`/`entry?`/`promptVersion`) — #180·#181 호출·동작 불변(기존 시험 그대로 통과) |
| `src/modules/conversation/index.ts` | export 한 줄(`helpLessonPhrase`) |
| `src/modules/conversation/__tests__/task077LessonHelpServer.test.ts` | **새** 서비스 시험 18개 |
| `src/app/api/v1/__tests__/task077LessonPhraseHelpRoute.test.ts` | **새** 라우트 시험 12개(진짜 `assertOwnedLesson` + 가짜 `prisma.lesson`, #180·#181 라우트 동시 적재) |
| `docs/design/api-contract.md` | §1-5 머리(#161~#184)·#184 행·#180 행 429/PHRASE_BUSY 공유 문구·#181 행 공유 문구·§2-13 `#### #184` 절 |

`src/types/phraseHelp.ts` 는 고치지 않았다 — 응답이 #180 과 같아 `PhraseHelpRequest`·`PhraseHelpResponse` 를 그대로 쓰면 된다.

## 계약 (UI-1·UI-2 가 그대로 쓸 요약)
- 요청: `POST /api/v1/lessons/${lessonId}/phrase-help`, 본문 `{ queryKo }`(`PhraseHelpRequest` — trim 뒤 1~100 코드포인트·한글 1자 이상, 모르는 키 400). 클라이언트 12초 시간 초과·마이크 누름·다음 과제에서 `AbortController` 로 끊으면 서버도 엔진을 멈춘다.
- 응답 200: `PhraseHelpResponse` = `{ items: [{ ja, ko, labelKo?, whyKo? }] }`(1~3개, 빈 배열 = 못 찾음·거절). **#180 과 바이트까지 같은 봉투**.

| 상태 | code / reason | 화면 상태(§22-9 그대로) |
|---|---|---|
| 200 `items.length>0` | — | 결과 카드 |
| 200 `items:[]` | — | `h-none` |
| 400 | `VALIDATION`(`required`·`max_length`·`no_hangul`·`no_text`·`forbidden_char`·`secret_like`·`type`·`unknown_key`, 크기 초과는 reason 없음) | 안내 줄(`message`) |
| 401 | `UNAUTHENTICATED` | 로그인 |
| 404 | `NOT_FOUND` 「수업을 찾을 수 없어요.」 | `hp-error`(§22-9 의 404 처리 그대로) |
| 409 | `CONFLICT` `PHRASE_BUSY` | 회화방 훅이 지금 #180 의 `PHRASE_BUSY` 를 다루는 방식 그대로 |
| 409 | `CONFLICT` `CANCELLED` | 화면이 먼저 버림 |
| 429 | `RATE_LIMITED` + `retryAfterSec`·`Retry-After` | `h-rate`(카운트다운) |
| 502 | `ENGINE_ERROR`(`PHRASE_INVALID`·`ENGINE_UNAVAILABLE`) | `h-error` |
| 504 | `ENGINE_TIMEOUT` | `h-timeout` |

- **#180 과 다른 점**: 409 `ENDED` 없음(레슨 상태 무관 — 끝난 레슨도 됨) · 404 문구가 「수업을 찾을 수 없어요.」 · 레슨 맥락을 프롬프트에 싣지 않는다 · 수준 = 프로필.

## 한도·잠금 공유 설계
- 한도: 라우트가 #180·#181 과 **같은 문자열 키·같은 값**(`phrase-help:${uid}` 10/분, `phrase-help-day:${uid}` 300/일)으로 `rateLimit` — 공용 메모리 창 하나를 세 입구가 나눠 쓴다. 순서도 #180 과 같다(400 은 미소모, 404·409 는 소모).
- 잠금: 서비스가 #180·#181 과 같은 내부 `withPhraseLock`(같은 `inFlight` Set)을 쓴다 — 새 Set·새 정책 없음.
- 레슨 번역 #185(서버 A)와는 키·잠금이 별도라 서로 막지 않는다.

## 시험
| 파일 | 개수 | 핵심 |
|---|---|---|
| 서비스 `task077LessonHelpServer.test.ts` | 18 | 요청 = 장면 없는 회화방 요청(바이트 비교) · 단어 모드 아님 · 본문이 모드·장면·과제 문장을 못 넣음 · 수준 = 프로필 · 1/2/3(4→3)개 · 빈 목록 3종 · INVALID 502 · 엔진 오류 502/502/504 + 오류 봉투가 #180 과 바이트 동일 · 입력 오류 400 · **잠금 공유 양방향**(레슨↔회화·단어, 같은 틱 4건 중 1건) · 실패 뒤 잠금 해제 · 취소 409 · Trace(refId=레슨 id, entry, 원문 0) · 로그 원문 0 · 저장 없음 |
| 라우트 `task077LessonPhraseHelpRoute.test.ts` | 12 | 200·no-store·한도 키·소유 질의 `(id,userId)` · **#180 과 바이트 동일**(성공·빈·BUSY·400) · 상태 5종 모두 200 · 404(남의·없는·형식 틀린, 같은 봉투, 한도 소모, 서비스 0) · 본문 400 13종(한도·소유·서비스 0) · 1KB · 401 우선 · 분당 429 · **한도 합산 분당**(#180+#181+#184=10 → 셋 다 429, 반대도) · **하루 합산**(#180·#184 번갈아 300) · signal 전달 · 라우트 소스(엔진명·쓰기·import) |
| 기존(약화 없음) | — | `task056PhraseHelp`·`task056PhraseHelpRoute`·`task072WordHelpServer`·`phraseHelp`·`phraseHelpWord`·`askRouteGuard`·`task045T4Routes` 그대로 통과(영향 9파일 152/152) |

## 변이 점검 (임시 미러 `~/.node-local/thekaiwa-dev077b-mut`, 시험 4파일 82개로 판정)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M01 | 라우트 소유자 검사 제거 | 포착 | 라우트 1·4 |
| M02 | 분당 한도 키 분리(`lesson-phrase-help:`) | 포착 | 라우트 1·4·8·**9(합산)** |
| M03 | 하루 한도 키 분리 | 포착 | 라우트 1·4·8·**10(하루 합산)** |
| M04 | 잠금 분리(레슨 전용 키) | 포착 | 서비스 잠금 공유 3개 |
| M05 | 단어 모드로 호출 | 포착 | 서비스 10개 |
| M06 | 레슨 맥락 주입(질의에 수업 표시) | 포착 | 서비스 바이트 비교 등 2 |
| M07 | 레슨 맥락 주입(장면 목표) | 포착 | 서비스 바이트 비교 |
| M08 | 저장 호출 추가(라우트가 레슨 행 갱신) | 포착 | 라우트 11개 |
| M09 | 오류 매핑 뒤바뀜(504→502) | 포착 | 서비스 엔진 실패 |
| M10 | 원문 로그(`console.info` 질의) | 포착 | 서비스 로그 + task072 console 스캔 |
| M11 | 끝난 레슨(DONE) 거절 상태 검사 추가 | 포착 | 라우트 1·3 등 5 |
| M12 | 소유 확인을 한도보다 먼저 | 포착 | 라우트 4·8 |
| M13 | 한도를 본문 검사보다 먼저 | 포착 | 라우트 5·6 |
| M14 | `req.signal` 미전달 | 포착 | 라우트 11 |
| M15 | 수준을 프로필에서 안 읽음(N5 고정) | 포착 | 서비스 3개 |
| M16 | Trace `refId` 누락 | 포착 | 서비스 Trace |
| M17 | 소유 확인 인자 뒤바뀜 | 포착 | 라우트 10개 |
| M18 | `Cache-Control` 누락 | 포착 | 라우트 1·2 |
| M19 | 본문 상한 완화(64KB) | 포착 | 라우트 6 |

**19/19 포착, 생존 0.** 끝난 뒤 변이 미러 두 파일을 원본으로 되돌리고 `cmp`(저장소·dev077b 미러와 동일) 확인, 임시 파일 0. 스크립트 `scratchpad/mut077b.py`.

## 증빙 (미러 `~/.node-local/thekaiwa-dev077b` — 내 파일 5개만 반영, index.ts 는 HEAD + 내 줄)
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 |
| `./node_modules/.bin/eslint <변경 파일 5개>` | exit 0, 경고 0 |
| 영향 시험 9파일(`task077LessonHelpServer`·`task077LessonPhraseHelpRoute`·`task056PhraseHelp`·`task056PhraseHelpRoute`·`task072WordHelpServer`·`phraseHelp`·`phraseHelpWord`·`askRouteGuard`·`task045T4Routes`) | 152/152 통과 |
| 전체 시험 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)`(가짜 `DATABASE_URL`) | tests 4426 · pass 4421 · **fail 0** · skipped 5 · exit 0 (271s) |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | **0** — 경로표에 `ƒ /api/v1/lessons/[id]/phrase-help` (로그의 error 글자 2건은 기존 코드 조각 경고, 이번 변경과 무관) |
| 변이 19개 | 19 포착 / 0 생존 |
| 엔진명 grep(새 라우트·서비스 추가분) | 0건 |

서버 A(#185)·UI-1 의 파일은 미러에 없다 — 합쳐진 상태의 tsc·전체 시험·build 는 Leader 가 다시 돌린다.

## 알려진 한계 · Leader 확인
1. **수준 = 프로필**(레슨의 `Lesson.level` 이 아님). 회화방(#180)은 대화 수준(없으면 프로필)을 쓴다 — 레슨 수준을 쓰려면 learning 에 레슨 수준 읽기 함수가 새로 필요하고(내 담당 파일 밖) B2(맥락 안 넣음)와의 경계도 판단이 필요해 **본보기 #181 대로 프로필**로 두었다. 챌린지 난이도(task-076)로 N2 레슨을 하는 N4 사용자는 N4 범위 표현을 받는다. «Leader 확인 필요(선택)» — 바꾸려면 route 가 레슨 수준을 읽어 서비스 인자로 넘기는 작은 변경.
2. 한도 합산이라 회화방·단어 추가에서 분당 10 을 다 쓰면 레슨에서 429 가 날 수 있다(데모 B3 위험 문구 그대로, 화면 `h-rate`).
3. 소유 확인과 도우미 호출 사이에 레슨이 지워지면 도우미는 그대로 답한다(레슨 내용을 읽지 않고 저장도 없어 영향 없음, Trace `refId` 만 지워진 id).
4. 서비스 `helpLessonPhrase` 는 소유를 직접 확인하지 않는다(브리프대로 라우트가 조합). `lessonId` 는 Trace `refId` 로만 쓰여 남의 id 를 넘겨도 읽거나 쓰는 것이 없다 — 다른 호출자가 생기면 라우트처럼 `assertOwnedLesson` 을 먼저 불러야 한다(주석에 적음).
5. Trace 단계 키가 입구마다 다르다(#181 `mode:'word'`, #184 `entry:'lesson'`, #180 없음) — 관리자 Trace 화면은 문자열 그대로 보여 주므로 문제는 없으나, 집계를 만들 때는 `refType:'phraseHelp'` 하나에 세 입구가 섞여 있다는 점을 알아야 한다.

## reviewer 가 볼 곳
- `src/modules/conversation/chats/phraseHelp.ts` — `helpLessonPhrase`(잠금 → 프로필 수준 → 장면 null·모드 생략 → `runPhraseHelp`), `runPhraseHelp` 인자 이름·`stepExtra` 타입 변경이 #180·#181 동작을 바꾸지 않는지(기존 시험 통과).
- `src/app/api/v1/lessons/[id]/phrase-help/route.ts` — 순서(401 → 400 → 429 → 404 → 409 → 엔진), 한도 키가 #180·#181 과 글자까지 같은지, 상태 검사가 없는지.
- `docs/design/api-contract.md` — §1-5 #184 행·머리, #180/#181 행 공유 문구, §2-13 `#### #184`.
- 시험 두 파일 — 라우트 시험은 진짜 `assertOwnedLesson` 에 가짜 `prisma.lesson` 델리게이트를 꽂는다(`Object.defineProperty(prisma, 'lesson', …)`, 같은 방식의 선례 task037·task039server).
