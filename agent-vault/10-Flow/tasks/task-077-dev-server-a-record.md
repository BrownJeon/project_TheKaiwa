---
task_id: task-077
role: developer
part: server-a
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
aliases:
  - task-077 서버 A 기록
---
# task-077 서버 A — 「내가 한 말」 번역 입구 #185 (developer 기록)

상위 이력서: [[task-077-improve-lesson-speak-translation-helper]] · 승인 데모 v1(「A1~A5, B1~B8, B6-Q 권고대로 승인」, 2026-10-18 21:44)

## 한 줄 요약
`POST /api/v1/lessons/:id/speaking-translation {text}` → `{ko}` 를 새로 만들었다 — 레슨 소유 확인(learning) + 회화방 #32t 와 같은 `userTranslation@v1` 프롬프트·엔진 태스크·정리(conversation)를 라우트가 조합하고, 저장 없음·분당 20·동시 1건(둘 다 이 입구 전용 키/잠금)·원문 미보관. 새 시험 29개·변이 25개 전부 포착, 전체 시험 4,425(실패 0)·tsc 0·eslint 0.

## 변경 파일
| 파일 | 구분 | 내용 |
|---|---|---|
| `src/app/api/v1/lessons/[id]/speaking-translation/route.ts` | 새 | #185 라우트 — 세션 → 본문 → 한도 → `assertOwnedLesson` → `translateLessonSpeech(…, req.signal)`, `Cache-Control: private, no-store`, `maxDuration 30` |
| `src/modules/conversation/chats/lessonTranslation.ts` | 새 | `readLessonTranslationBody`(본문 400) · `translateLessonSpeech`(전용 잠금 Set·프로필 수준·`buildUserTranslationRequest`·`sanitizeUserTranslation`·취소·Trace) · `lessonTranslationDeps`(learnerLevel·complete·trace) |
| `src/modules/conversation/index.ts` | 수정 | 내 export **한 줄**(59행, `retryUserTranslation` 바로 아래). 서버 B 의 `helpLessonPhrase` 줄은 B 몫(손대지 않음) |
| `src/types/lesson.ts` | 수정 | `LessonSpeakingTranslation { ko: string }` 하나 추가(그 밖 바이트 불변) |
| `src/modules/conversation/__tests__/task077LessonTranslation.test.ts` | 새 | 서비스·본문 단위 시험 16개 |
| `src/app/api/v1/__tests__/task077LessonTranslationRoute.test.ts` | 새 | 라우트 + 진짜 서비스 시험 13개(세션·소유·엔진·프로필·Trace 만 가짜) |
| `docs/design/api-contract.md` | 수정 | §1-2 표 #62b 아래 #185 행 + §2-13 `#### #185` 절(#62b 절 뒤). 서버 B 의 #184 행(§1-5)은 B 몫 |

새 엔진 태스크·새 프롬프트 파일·DB/스키마 변경·새 의존성·새 환경변수 **없음**. 화면(`src/components/**`) 0.

## 계약 — UI-2 가 그대로 쓸 요약
- **요청**: `POST /api/v1/lessons/:id/speaking-translation` 본문 `{ "text": "<내가 한 말>" }` **하나뿐**. ⚠ `docs/screens.md` §34-7 초안은 `{ itemId, text }` → `translation` 으로 적혀 있으나 Leader 사양대로 **`{text}` → `{ko}`** 로 구현했다 — `itemId` 를 보내면 `400 unknown_key`. (screens §34-7 문구 정정은 Leader/designer 몫 — 미수정)
- **언제 부르나**(사양): 모범 답안과 다를 때만(같으면 #62b `modelAnswer.ko`, 호출 0). 레슨 상태 무관(끝낸 레슨도 200).
- **응답 200**: `{ "success": true, "data": { "ko": "주말에 친구를 만났어요." }, "message": null }`, 헤더 `Cache-Control: private, no-store`.

| 상황 | HTTP | `data.code` | `data.details` | 화면(§34-4·`userTrFailure` 갈래) |
|---|---|---|---|---|
| 세션 없음 | 401 | `UNAUTHENTICATED` | — | (로그인) |
| `text` 없음·null·공백/제어문자뿐 | 400 | `VALIDATION` | `{field:"text", reason:"required"}` | 「이 말은 번역할 수 없어요」 |
| `text` 가 글이 아님 | 400 | `VALIDATION` | `{field:"text", reason:"type"}` | 같음 |
| 정리 뒤 1,000 코드포인트 초과 | 400 | `VALIDATION` | `{field:"text", reason:"max_length"}` | 같음 |
| `text` 밖의 키(`itemId` 등) | 400 | `VALIDATION` | `{field:"body", reason:"unknown_key"}` | 같음 |
| JSON 아님·객체 아님·본문 8KB 초과 | 400 | `VALIDATION` | 없음 | 같음 |
| 남의·없는·형식이 잘못된 레슨 id | 404 | `NOT_FOUND` | — | 같음 |
| 분당 20회 초과(사용자당) | 429 | `RATE_LIMITED` | `{retryAfterSec}` + 헤더 `Retry-After` | 「잠시 뒤 다시 눌러 주세요」 |
| 같은 사용자의 레슨 번역이 이미 진행 중 | 409 | `CONFLICT` | `{reason:"TRANSLATION_BUSY"}` | 바쁨 줄(`DISPLAY_COPY.userTr.busy`) |
| 손님이 요청을 끊음(`AbortController`) | 409 | `CONFLICT` | `{reason:"CANCELLED"}` | (화면이 이미 버림 — 읽지 않음) |
| 번역이 정리에서 버려짐(빈 값·베끼기·한글 0·이중 높임·과길이) | 502 | `ENGINE_ERROR` | `{reason:"TRANSLATION_REJECTED"}` | 「번역을 가져오지 못했어요 · 다시 가져오기」 |
| 엔진 실패 | 502 | `ENGINE_ERROR` | (`traceId` 있을 수 있음) | 같음 |
| 엔진 시간 초과(15s) | 504 | `ENGINE_TIMEOUT` | | 같음 |
| 엔진 사용 불가 | 422 | `ENGINE_UNAVAILABLE` | | 같음(400/404 가 아니므로 실패 줄) |

- 판정 순서: 401 → 400(한도·DB·엔진 미접촉) → 429 → 404(한도는 씀) → 409 BUSY → 엔진.
- 화면 12초 상한 < 엔진 15초: 화면이 `AbortController` 로 끊으면 서버가 엔진 호출을 멈추고 잠금을 바로 푼다 → 곧이은 [다시 가져오기] 가 409 바쁨이 되지 않는다(시험으로 확인). **UI-2 는 시간 초과·다음 과제·새 녹음 때 fetch 를 abort 할 것.**

## 한도·잠금 설계
- 분당: `rateLimit('lesson-speaking-translation:'+uid, 20)` — #32t(`user-translation:`)·도우미 #180·#181·#184(`phrase-help:`·`phrase-help-day:`)와 **다른 키**. 프로세스 메모리 고정 창(기존과 같음). 본문 400 은 한도를 쓰지 않고, 소유 404 는 DB 를 읽으므로 한도 안(#180 REV-142 L-4 와 같은 순서).
- 동시 1건: `lessonTranslation.ts` 모듈 안 `Set<userId>` — #32t(`translation.ts` 의 Set)·도우미(`phraseHelp.ts` `withPhraseLock` Set)와 **별개**. 검사·등록이 같은 틱(await 없음), 해제는 `finally`(실패·취소·수준 읽기 실패에도 풀림).
- 취소: `signal?.aborted === true && isAbortError(e)` 일 때만 `CANCELLED`(어댑터 자체 타이머의 AbortError 가 409 로 둔갑하지 않게 — #180 과 같은 판정).
- Trace: `RequestTrace{kind:TURN, refType:'lessonTranslation', refId:<lessonId>}` 단계 `USER_TRANSLATION` = `ms·connection·model·attempts·promptChars·promptVersion·textChars·koChars·result(OK|REJECTED)·errorCode` — **원문·번역 0**. 기록 실패는 응답을 막지 않는다(`.catch`).

## 시험 (새 29개, 정답은 손으로 적은 표)
| 파일 | 시험 | 보는 것 |
|---|---|---|
| 서비스 | 본문 통과 표 9행 · 거절 표 14행 | 정리(공백·제어문자 제거, 줄바꿈 유지)·코드포인트 1~1,000(이모지 1,000 통과/1,001 거절)·`required/type/max_length/unknown_key` |
| 서비스 | 정상 · 신호 없음 · 단독 호출 방어 | `{ko}` 만, 엔진 1회, task `userTranslation`·`[모드] USER_TRANSLATION`·반말 규칙·`N3 수준`·`[입력] …`·schema required `userKo`·signal·traceId 상관 |
| 서비스 | 정리 표 11행 | 통과/버림(빈 값·공백·null·숫자·베끼기·한글 0·상한 200 초과·비일본어 베끼기), 엔진 1회(재시도 없음) |
| 서비스 | 엔진 오류 표 7행 · 수준 읽기 실패 · 취소 | 504/422/502/500 그대로 · 실패 뒤 잠금 풀림 · 끊긴 신호만 CANCELLED |
| 서비스 | 동시 1건 · 잠금 독립 ①② | 같은 사용자 409(수준·엔진 0)·다른 사용자 통과 · 레슨 번역 중에도 도우미(#181 Set)·#32t 통과, 그 반대도(대조로 각자 자기 잠금은 걸려 있음을 확인) |
| 서비스 | Trace · Trace 실패 · 로그 · 공개 API | 원문·번역이 Trace·콘솔에 없음, refType/refId, index export, 기본 deps 세 칸 |
| 라우트 | 정상 · 끝낸 레슨 · 401 · 본문 400 표 13행 · 경계 · 404(5종) | no-store·한도 키 1회·소유 (세션 uid, 경로 id)·`req.signal` 전달 · 400 은 한도·소유·엔진 0 · 404 는 엔진 0·한도 씀 |
| 라우트 | 한도 20/21 · 한도 독립 · 동시 1건 · 취소 · 오류 매핑 8행 · 저장 없음/원문 | 429·`Retry-After` · 레슨 한도 소진 뒤 #181·#32t 200, 그 반대도 · 409 BUSY · 409 CANCELLED 뒤 200 · 응답에 엔진·모델 이름 없음 · 실패 뒤 잠금 풀림 |

## 변이 점검 (별도 미러 `~/.node-local/thekaiwa-dev077a-mut`, 끝나고 원본 복원 `cmp` 동일)
| # | 변이 | 결과 |
|---|---|---|
| M01 | 라우트 소유 검사 제거 | 포착 |
| M02 | 한도 키를 도우미(`phrase-help:`)와 공유 | 포착 |
| M03 | 한도 키를 #32t(`user-translation:`)와 공유 | 포착 |
| M04 | 분당 20 → 30 | 포착 |
| M05 | 한도를 본문 검사 앞으로(400 이 한도 소모) | 포착 |
| M06 | 본문 상한 8KB → 기본 64KB | 포착 |
| M07 | 라우트가 `req.signal` 미전달 | 포착 |
| M08 | `Cache-Control` 제거 | 포착 |
| M09 | 길이 상한 +1 완화 | 포착 |
| M10 | 코드포인트 대신 UTF-16 길이 | 포착 |
| M11 | 모르는 키 허용 | 포착 |
| M12 | 한 줄 정리(줄바꿈 삭제) | 포착 |
| M13 | 빈 결과 통과(`ko ?? ''`) | 포착 |
| M14 | 정리 생략(모델 값 그대로) | 포착 |
| M15 | 오류 매핑 뒤바뀜(버림 → 409) | 포착 |
| M16 | 바쁨 409 → 429 | 포착 |
| M17 | 동시 잠금 해제 누락 | 포착 |
| M18 | 동시 잠금 없음 | 포착 |
| M19 | 이름만으로 취소 판정 | 포착 |
| M20 | 엔진에 신호 미전달 | 포착 |
| M21 | 실패 시 원문 `console.warn` | 포착 |
| M22 | Trace 단계에 원문 | 포착 |
| M23 | 저장 호출 추가(`prisma.lesson.updateMany`) | 포착(가짜 DB 연결 실패 → 500) |
| M24 | 학습자 수준 미전달 | 포착 |
| M25 | 다른 엔진 태스크 | 포착 |
**25/25 포착, 생존 0.** 한계: 「저장 호출 추가」를 `void …catch()` 처럼 결과를 기다리지 않는 형태로 넣으면 시험이 못 잡는다(코드 읽기 몫).

## 증빙 (미러 `~/.node-local/thekaiwa-dev077a`, 내 파일만 반영 — `index.ts` 는 HEAD + 내 줄, 서버 B·UI-1 변경 미포함)
- `./node_modules/.bin/tsc --noEmit` → 0
- `./node_modules/.bin/eslint <변경 6파일>` → 0 (라우트 시험의 `@/modules/engine` 타입 import 가 app 층 lint 규칙에 걸려 deps 에서 타입을 꺼내는 방식으로 바꿈)
- 새 시험 2파일 → 29/29 · 영향 시험(+`task026s2`·`userTranslation`·`task072WordHelpServer`·`task056PhraseHelpRoute`) → 99/99
- 전체 `find src scripts/seed-build -name '*.test.ts' | sort`, `--test-concurrency=1`, 가짜 `DATABASE_URL` → **tests 4,425 · pass 4,420 · fail 0 · skipped 5** (277s)
- `./node_modules/.bin/next build > log 2>&1; echo $?` → **0**(라우트 표에 `ƒ /api/v1/lessons/[id]/speaking-translation`, 경고는 기존 `persona/loader.ts` 파일 추적 경고뿐)
- 엔진·모델 이름 grep(`reazon|whisper|style-bert|claude|sbv2|haiku|sonnet|opus|qwen`) — 변경 5개 코드·시험 파일 0건(시험의 오류 이름도 `LlmTimeoutError`·`LlmError` 로 중립화)

## 알려진 한계
1. **일본어가 아닌 답**(글자 모드에서 한국어로 친 경우 등)은 모델이 그대로 베끼기 쉬워 `sanitizeUserKo` 가 버리고 502 `TRANSLATION_REJECTED` → 화면은 [다시 가져오기] 를 보이지만 다시 눌러도 대개 같은 결과. 사양(길이·타입만 검증)대로 두었다 — 화면이 일본어 없는 말은 부르지 않게 할지 UI-2/Leader 판단.
2. 인식이 뒤틀린 말은 들은 대로 옮긴다(A4 — 화면 힌트 「알아들은 말을 그대로 옮겼어요」 몫).
3. 수준을 읽을 때 Profile 행이 없으면 `getProfile` upsert 가 1행을 만든다(#32t·#180 과 같은 기존 동작).
4. 한도·잠금은 프로세스 메모리(blue/green 전환 시 초기화) — 기존 입구와 같음.
5. `screens.md` §34-7 의 요청·응답 칸(`{itemId,text}`·`translation`)이 구현 계약(`{text}`·`{ko}`)과 다름 — Leader 확인 필요(문서 정정만, 코드는 Leader 사양 기준).

## reviewer 가 볼 곳
- 6층: 라우트(app)가 `@/modules/learning`(`assertOwnedLesson`)·`@/modules/conversation`(index) 만 import, conversation 은 레슨을 모른다(lessonId 는 Trace refId 로만). `lessonTranslation.ts` 는 `../prompts/userTranslation`·`./requestCancel` 을 모듈 안에서 재사용.
- 잠금 독립: `lessonTranslation.ts` 의 `inFlight` 가 `translation.ts`·`phraseHelp.ts` 의 Set 과 다른 객체인지, 한도 키 문자열.
- 저장 없음: 서비스가 deps 세 칸(프로필 읽기·엔진·Trace) 밖의 DB 를 부르지 않는지.
- `api-contract.md` #185 행(§1-2)·절(§2-13) 문구가 코드와 같은지.

## 체크포인트
- [완료] 착수 — 본보기 읽기, 미러 착수 시점 차이 0.
- [완료] 구현 4파일 + 시험 2파일 → 미러 반영(임시 파일 + `mv`) → 시험·tsc·eslint 통과.
- [완료] 변이 25/25 포착(별도 미러, 원본 복원 `cmp` 동일) · 전체 시험 실패 0 · `api-contract.md` #185.
- [완료] `next build` 0. 서버 A 완료 → reviewer 서버 감사 대기(합쳐진 상태 재실행은 Leader).
- 미커밋 파일: 위 「변경 파일」 표 7개(커밋은 Leader 지시 시).

## REV-077S Low-1 보강

감사 [[task-077-reviewer-server-record]] Low-1 — «#185 에는 「저장 없음」을 소스 수준에서 고정하는 시험이 없다(#184 에는 있음). `void prisma.lesson.updateMany(…).catch()` 를 서비스·라우트에 넣어도 시험 29개가 통과했다» 를 닫음. **제품 코드 변경 0**, 시험 두 파일만 보강(기존 단언은 바꾸지 않음 — 위 「알려진 한계」 첫 문단의 "코드 읽기 몫"이던 구멍).

### 추가한 시험 (두 파일, +6개 → 서비스 시험 17→20, 라우트 시험 12→15, 합 29→35)
공통 장치 — **DB 호출 기록기**: 진짜 `prisma` 의 모든 모델 델리게이트(`Prisma.ModelName` 전부)와 `$transaction`·`$executeRaw(Unsafe)`·`$queryRaw(Unsafe)`·`$runCommandRaw` 를 «기록만 하고 null 을 돌려주는» 가짜로 바꿔 끼운다. `await` 하지 않는 숨은 쓰기는 가짜 `DATABASE_URL` 연결 실패가 응답에 안 나타나 응답 시험이 못 잡았는데, 기록기에는 호출이 남는다(기록기가 null 을 돌려주므로 `await` 쓰기도 응답을 안 깨뜨려 — 그래서 소스 스캔과 기록기 단언이 «쓰기 0» 근거다).

| 파일 | 시험 | 고정하는 것 |
|---|---|---|
| `src/modules/conversation/__tests__/task077LessonTranslation.test.ts` | 저장 없음(소스) | 주석 뺀 `lessonTranslation.ts` 에 `prisma`·트랜잭션/raw·쓰기 메서드(`create/update/updateMany/upsert/deleteMany`, `inFlight.delete` 만 허용)·`console`/stdout/logger·`.then(` 없음 · `void` 호출 정확히 1개(`void deps.trace(`)·`.catch(` 정확히 1개 · `getProfile(`·`llm.completeJson`·`recordTrace(` 는 기본 deps 블록 안에만(밖에서 부르면 실패) · `Object.keys(lessonTranslationDeps)` = `complete,learnerLevel,trace` · import 모듈 6개 고정(infra 는 `ApiError/classifyError/codePointLength/sanitizeText`, engine 은 `llm/newTraceId/recordTrace`+타입, preferences 는 `getProfile` 하나) |
| 〃 | 엔진·모델 이름 없음 | 서비스 소스에 `reazon/whisper/style-bert/claude/sbv2/haiku/sonnet/opus/anthropic/qwen/ollama/speaker_id/model_id` 0 |
| 〃 | 저장 없음(동작) | 성공·버림·엔진 오류·수준 읽기 오류·Trace 실패·바쁨·취소 경로 뒤, **그리고 이 파일 앞선 모든 시험이 지난 뒤** 기록기 `[]` + 기록기가 살아 있다는 대조(`void prisma.lesson.updateMany` + `await prisma.chatMessage.update` 가 실제로 남음) |
| `src/app/api/v1/__tests__/task077LessonTranslationRoute.test.ts` | 라우트 소스(엔진·spawn/fetch) | 엔진·모델 이름·`spawn`/`fetch(`/`child_process` 0 |
| 〃 | 저장 없음(소스) | 라우트에 `prisma`·트랜잭션/raw·쓰기 메서드(`delete` 포함)·`void`·`.then/.catch`·`console` 없음 · import 모듈 4개 고정, infra 는 `ok/rateLimit/readJsonObject/requireSession/withApi` 안에서만, conversation 은 `readLessonTranslationBody`·`translateLessonSpeech`, learning 은 **`assertOwnedLesson` 하나뿐**(DB 를 읽는 길은 소유 확인 1개) · `assertOwnedLesson(`·`translateLessonSpeech(` 호출 각 1회 |
| 〃 | 저장 없음(동작) | 200·400·401·404(남의·형식 틀린 id)·502(베낀 번역)·500(예외) 경로와 **앞선 모든 시험(409·429·취소 포함)** 뒤 기록기 `[]` + 기록기 생존 대조 |

### 변이 재현 (별도 미러 `~/.node-local/thekaiwa-dev077a-mut`, 임시 파일 + `os.replace`, 소스 link 1, 끝난 뒤 저장소 원본으로 복원·`cmp` 동일 — 스크립트 scratchpad `mut077low1.py`)
기준선(변이 없음) 서비스 시험 20/20 · 라우트 시험 15/15.

| # | 변이 | 판정 | 걸린 새 시험 |
|---|---|---|---|
| M7 | 서비스에 `void prisma.lesson.updateMany(…).catch(() => {})` (**감사가 놓친 것**) | **포착** | 서비스 소스·서비스 동작, 라우트 동작(진짜 서비스를 싣고 있음) |
| M7r | 라우트에 같은 `void prisma.lesson.updateMany(…).catch()` (**감사가 놓친 것**) | **포착** | 라우트 소스·라우트 동작 |
| M-A | 서비스가 번역을 `ChatMessage` 에 `await prisma.chatMessage.update(…)` | **포착** | 서비스 소스·서비스 동작·라우트 동작 |
| M-B | 라우트가 `await prisma.lesson.update(…)` 로 레슨 행 갱신 | **포착** | 라우트 소스·라우트 동작 |
| M-C | 서비스에 `await prisma.$executeRaw` | **포착** | 서비스 소스·서비스 동작·라우트 동작 |
| M-D | 서비스에 `void withTransaction((tx) => tx.studyLog.deleteMany(…)).catch()` | **포착** | 서비스 소스·서비스 동작·라우트 동작 |

6/6 포착, 생존 0. 각 변이를 소스 스캔과 기록기가 **서로 독립적으로** 잡는다(두 방식 다 실패 확인).

### 증빙 (미러 `~/.node-local/thekaiwa-dev077a`, 시험 두 파일만 임시 파일 + `mv` 로 반영 — 저장소와 `cmp` 동일, link 1)
- `./node_modules/.bin/tsc --noEmit` → 0 (21s)
- `./node_modules/.bin/eslint <시험 2파일>` → 0 (라우트 시험의 `@prisma/client` import 는 `seedScenarios.test.ts` 선례와 같고 app 층 lint 에 걸리지 않음)
- 서버 A 시험 2파일 → **35/35**(전 29 + 새 6), 영향 시험(`task026s2`·`userTranslation`·`task072WordHelpServer`·`task056PhraseHelp`·`task056PhraseHelpRoute`) 포함 7파일 → **127/127**, 가짜 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`
- 변경: 시험 2파일 + 이 기록뿐. 제품 코드·서버 B·UI·docs 변경 0, `native_change: false`.

### 메모
- 기록기는 그 시험 파일(= node:test 프로세스) 안에서만 `prisma` 를 바꿔 낀다 — 다른 시험 파일에 새지 않음(파일마다 별도 프로세스). #184 라우트 시험이 `prisma.lesson` 을 바꿔 끼우는 방식의 확장판이다.
- 소스 스캔은 «주석을 뺀 소스» 기준이라 `inFlight.delete(` 처럼 Set 잠금 해제는 `(?<!\binFlight)\.delete\(` 로 따로 허용했다 — 다른 이름의 Set 을 쓰게 바꾸면 이 시험이 알려 준다(의도된 경직).
