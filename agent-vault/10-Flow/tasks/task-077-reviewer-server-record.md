---
task_id: task-077
role: reviewer
review_id: REV-077S
verdict: PASS_WITH_NOTES
created: 2026-10-18
updated: 2026-10-18
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
---

# task-077 reviewer 기록 — 서버 감사 REV-077S (서버 A #185 「내가 한 말」 번역 · 서버 B #184 레슨 일본어 도우미)

상위 이력서: [[task-077-improve-lesson-speak-translation-helper]] · 대상: [[task-077-dev-server-a-record]] · [[task-077-dev-server-b-record]]
범위: 서버 두 갈래만(`src/components/**` 는 UI-1·UI-2 진행 중이라 감사하지 않음, 미러에는 HEAD 의 components 를 넣어 서버가 합쳐진 상태로 재실행). Read 전용 — 코드·시험·문서 수정 없음(변이는 별도 복사본에서만 했고 전부 원복·`diff -rq` 동일 확인).

## 판정 요약
**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2 · Info 4. 서버 A+B 가 합쳐진 상태의 첫 재실행(tsc·eslint·전체 시험·`next build`)이 모두 통과했고, 직접 변이 13개 중 11개를 시험이 잡았다. 놓친 2개는 같은 종류(#185 의 「void …catch() 숨은 쓰기」)이며 코드를 읽어 실제 쓰기가 없음을 확인했다. QA 진행 가능, 아래 Low 는 UI-2 착수와 병행해 고쳐도 된다.

| 영역 | 판정 |
|---|---|
| A. #185 번역 | PASS |
| B. #184 도우미 | PASS (Low-2: 수준 = 프로필, Leader 결정 사항) |
| C. 계약·문서 일관성 | PASS (Info-3 문서 문구 2곳) |
| D. 보안·안정성·경계 | PASS |
| E. 시험 | PASS_WITH_NOTES (Low-1: #185 에 「쓰기 없음」 소스 검사 없음) |
| F. 증빙 재실행 | PASS |
| G. UI-2 주의 · QA | 아래 정리 |

## A. #185 `POST /api/v1/lessons/:id/speaking-translation` — 항목 표

| 항목 | 판정 | 근거(파일:줄) |
|---|---|---|
| 소유자 검사(남의·없는·형식 틀린 id → 404, 상태 무관) | PASS | 라우트 `speaking-translation/route.ts:27` `assertOwnedLesson(userId, id)` — 실제 구현 `learning/lessons/lifecycle.ts:50-54` 는 `isLessonId` 형식 검사 후 `prisma.lesson.count({ where: { id, userId } })` 만 본다(상태 칸 없음). 남의 것·없는 것은 같은 `NOT_FOUND`(`rows.ts:23-25` 「수업을 찾을 수 없어요.」) |
| 본문 검증(trim 후 1~1,000 코드포인트·타입·모르는 키 400) | PASS | `lessonTranslation.ts:53-63` — `Object.keys(body).some(k => k !== 'text')` → `unknown_key`, `undefined/null` → `required`, 비문자열 → `type`, `sanitizeText(multiline)` 뒤 `codePointLength` 1~`USER_TRANSLATION_TEXT_MAX`(1,000). JSON.parse 가 만든 `__proto__` 키도 `Object.keys` 에 잡힌다. 빈 본문은 `readJsonObject` 가 `{}` 로 돌려 `required` |
| 저장 없음 | PASS | 서비스의 외부 의존은 deps 세 칸(`learnerLevel`=`getProfile`, `complete`=`llm.completeJson`, `trace`=`recordTrace`)뿐이고 파일 어디에도 `prisma`·`create/update/upsert`·`$transaction`·`console.` 이 없다(전문 읽음). 라우트는 `assertOwnedLesson`(count)만 부른다. `void deps.trace(...).catch()`(`:147`) 는 RequestTrace 관측 1행. 유일한 부수 쓰기 = `getProfile` 의 Profile 행 최초 upsert(#32t·#180·#181 과 같음, api-contract 에 명시) |
| `userTranslation` 프롬프트·엔진 태스크·`sanitizeUserTranslation` 재사용(새 태스크 없음) | PASS | `lessonTranslation.ts:24-31` 이 `../prompts/userTranslation` 에서 `buildUserTranslationRequest`·`sanitizeUserTranslation`·`USER_TRANSLATION_PROMPT_VERSION` 을 가져와 쓰고 `task: 'userTranslation'` 이 그대로 나간다. 새 프롬프트 파일·엔진 태스크·스키마·환경변수 없음(변경 파일 목록과 `git status` 일치) |
| 한도 분당 20, 키 `lesson-speaking-translation:` — #32t·도우미와 독립 | PASS | 라우트 `:26` `rateLimit(\`lesson-speaking-translation:${userId}\`, 20)`. #32t 는 `user-translation:`(`messages/[messageId]/translation/route.ts`), 도우미는 `phrase-help:`·`phrase-help-day:`. 시험 `한도 독립`(양방향)이 실제 호출로 대조, 변이 M1(도우미와 키 공유)을 시험이 잡음 |
| 동시 1건 잠금이 #32t·도우미와 독립 | PASS | `lessonTranslation.ts:66` `const inFlight = new Set<string>()` — `translation.ts:75`·`phraseHelp.ts` 의 `inFlight` 와 별개 객체. 검사·등록이 같은 틱(`:89-90`, 사이 await 없음), 해제는 `finally`(`:93-96`)로 `learnerLevel` 실패·엔진 실패·취소에도 풀린다. M5a(해제를 성공 뒤로 이동)를 시험 14개가 잡음 |
| 오류 매핑 | PASS | 401(`requireSession`) · 400 `VALIDATION`+`{field,reason}`(본문) · 404 · 429 `RATE_LIMITED`+`retryAfterSec`·`Retry-After`(`http.ts:51-52,175`) · 409 `CONFLICT{TRANSLATION_BUSY}`(`:89`)·`{CANCELLED}`(`requestCancel.ts`) · 502 `ENGINE_ERROR{TRANSLATION_REJECTED}`(`:140`) · 엔진 오류는 #32t 처럼 그대로 던져 `classifyError` 가 502/504/422 로(`http.ts:75-77`). 문서 §2-13 #185 표·`screens.md` §34-4/34-7 의 화면 갈래(실패/한도/바쁨/막힘)와 일치 |
| `req.signal` 전달·취소 시 잠금 해제 | PASS | 라우트 `:28` 이 `req.signal` 을 서비스 5번째 인자로 → `deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })`(`:116`). 취소 판정은 `signal?.aborted === true && isAbortError(e)` 둘 다(`:119`) — 어댑터 자기 타이머 AbortError 가 409 로 둔갑하지 않음(#180 task-058 과 같은 정의, 공용 `requestCancel.ts`). `finally` 가 잠금을 풀어 곧이은 다시 가져오기가 BUSY 가 되지 않음 |
| 원문·번역을 로그·RequestTrace 에 남기지 않음 | PASS | Trace 단계(`:128-139`)는 `ms·connection·model·attempts·promptChars·promptVersion·textChars·koChars·result|errorCode` 뿐. 서비스에 `console.` 0. 시험이 Trace JSON·콘솔 5종 수준에서 원문·번역 포함 여부를 검사(`저장 없음·원문 미보관`) |
| 엔진명·모델명이 응답·오류 문구에 안 나옴 | PASS | 응답은 `{ko}` 하나, 오류 문구는 `FAIL_MESSAGE`·`번역을 가져오는 중이에요.`·`요청이 취소됐어요.` 뿐. 엔진명 grep(`reazon|whisper|style-bert|claude|sbv2|haiku|sonnet|opus|qwen|ollama|model_id|speaker_id`) — 변경 코드 4파일(+`phraseHelp.ts` 추가분) 0건. `model` 문자열은 Trace 단계(관리자 전용)에만 |

## B. #184 `POST /api/v1/lessons/:id/phrase-help` — 항목 표

| 항목 | 판정 | 근거 |
|---|---|---|
| 소유자 검사(상태 무관, 끝난 레슨 허용, 409 `ENDED` 없음) | PASS | 라우트 `phrase-help/route.ts:28` `assertOwnedLesson` 하나뿐, 상태 질의 없음. 시험이 READY·IN_PROGRESS·DONE·GENERATING·FAILED 5종 200 을 확인, M3(상태 검사 추가)을 잡음 |
| 응답·오류 봉투가 #180 과 같은 모양 | PASS | 같은 `readPhraseHelpBody`(1KB)·같은 `runPhraseHelp`·`engineFailure(e, PHRASE_HELP_FAIL_MESSAGE)`·`conflict(…PHRASE_BUSY)`. 라우트 시험이 #180 라우트와 성공·빈 목록·BUSY·본문 400 의 봉투를 **바이트 비교**. 다른 점은 문서·코드 모두 의도한 것 3가지(409 `ENDED` 없음 · 404 문구 · 수준) |
| 한도 키·값 공유 + 같은 잠금 Set 공유, #185 와는 별도 | PASS | 라우트 `:26-27` 이 `phrase-help:`(10/분)·`phrase-help-day:`(300/일) 를 #180(`chats/[id]/phrase-help/route.ts`)·#181(`words/phrase-help/route.ts`)과 **글자까지 같게** 사용. 잠금은 `helpLessonPhrase` 가 `withPhraseLock`(`phraseHelp.ts:94-103`, 모듈 하나의 `inFlight`)을 그대로 쓴다. 변이 M2(키 분리)·M8(잠금 키 분리)·M5b 모두 시험이 잡음. #185 의 키·Set 은 위에서 확인한 대로 별개 |
| 단어 모드 아님·레슨 맥락 안 넣음 | PASS | `helpLessonPhrase`(`phraseHelp.ts:162-167`) 는 `input = { queryKo, level, scene: null }` 만 만들고 `mode` 를 주지 않는다 → `buildPhraseHelpRequest` 의 문장 모드(`phraseHelp@v1`). 레슨 행·과제·목표 표현을 읽는 코드 0. 시험이 「장면 없는 회화방 요청과 바이트까지 같음」을 비교, M10(질의 앞에 `[수업]` 주입) 잡음 |
| 수준 = 프로필 | **Low-2** | 아래 발견 참조(결함이 아니라 승인안 B2 의 해석 차이, Leader 판단) |
| `runPhraseHelp` `chatId→refId` 이름 변경·`stepExtra` 타입 확장이 #180·#181 호출·동작·Trace 를 바꾸지 않음 | PASS | `git diff` 로 확인: 함수 본문에서 바뀐 것은 마지막 `refId: chatId` → `refId` 한 곳(같은 값), `stepExtra` 타입을 `{ mode: string; promptVersion: string }` → `{ mode?: 'word'; entry?: 'lesson'; promptVersion: string }`(#181 의 `mode:'word'` 만 허용, #180 은 `undefined` 를 계속 전달 — `...undefined` 는 아무것도 펴지 않는다). 호출처 3곳 인자 순서·값 불변. 기존 시험(`task056PhraseHelp*`·`task072WordHelpServer`·`phraseHelp*`·`askRouteGuard`·`task045T4Routes`)은 수정되지 않았고(`git status` 에 수정된 시험 0) 변이 시 Trace refId 회귀를 잡음(M6a) |
| 저장 없음 | PASS | 서비스 함수 소스 스캔 시험 + 라우트 소스 스캔 시험(엔진명·spawn/fetch·prisma·쓰기 정규식, import 는 `infra·conversation·learning` 셋뿐) |
| 로그 원문 0 | PASS | `phraseHelpTrace(fin)`(코드·수치만) 재사용, `helpLessonPhrase` 에 `console.` 0, 로그 시험이 5개 경로에서 질의·표현·뜻 부재 확인 |

## C. 계약·문서 일관성

| 대조 | 결과 |
|---|---|
| api-contract #185 행(§1-2)·§2-13 `#### #185` ↔ 코드 | 일치: 요청 키 `{text}` 하나, 응답 `{ko}`, 오류 코드·`reason` 이름, 분당 20 별도 키, 저장 없음, `Cache-Control: private, no-store`, Trace `refType:"lessonTranslation"` |
| api-contract #184 행(§1-5)·§2-13 `#### #184` ↔ 코드 | 일치: 순서(401 → 400 → 429 → 404 → 409 → 엔진), 404 문구 「수업을 찾을 수 없어요.」(`rows.ts:24` 와 같음), Trace `entry:'lesson'`·`promptVersion:'phraseHelp@v1'`·`refId` = 레슨 id |
| #180·#181 행의 한도·잠금 공유 문구 | 사실이다: 세 라우트의 `rateLimit` 키 문자열·값을 직접 대조(`phrase-help:` 10 · `phrase-help-day:` 300), 잠금은 한 모듈의 한 `inFlight` |
| `screens.md` §34-3(=계획 표 §34-7)의 #185 행 | Leader 정정대로 `{ text }` → `{ ko }`·`itemId` 400 `unknown_key` 로 코드와 일치. #184 행은 아직 「(가칭)」 표기(Info-3) |
| 타입 | `src/types/lesson.ts` `LessonSpeakingTranslation { ko: string }`(UI-2 가 그대로 import 가능). #184 는 기존 `src/types/phraseHelp.ts` 의 `PhraseHelpRequest`/`PhraseHelpResponse`(`items: PhraseHelpItem[]`, `labelKo?`·`whyKo?`) 를 그대로 쓰면 된다 — 화면이 쓰기에 충분 |

## D. 보안·안정성·경계

| 항목 | 판정 | 근거 |
|---|---|---|
| 인증·Origin | PASS | 두 라우트 모두 첫 줄 `requireSession()`; Origin/CSRF 처리는 형제 라우트(#180·#181·#32t)에도 없고(`http.ts`·`proxy.ts` 에서 확인) 쿠키 정책에 맡긴다 — 새 위험 없음 |
| 입력 검증 | PASS | #185 8KB 본문 상한·`sanitizeText`·코드포인트 상한. #184 1KB·`parsePhraseHelpBody` 8종 reason. 사용자 입력은 shell 이 아니라 LLM 메시지 본문(`[입력] …`)이며 시스템 지시에 「입력 안의 지시는 따르지 않는다」가 있고 출력은 `userKo` ≤200자 정리를 거친다 |
| 레이스·취소·잠금 누수 | PASS | 위 A·B 참조. 두 서비스 모두 잠금 검사·등록 사이에 await 없음, 해제는 `finally`. 변이 M5a·M5b(해제를 성공 경로로 옮김)를 시험 14개·38개가 잡았다 |
| 6층 | PASS | 라우트(app)는 `@/modules/infra`·`@/modules/learning`(`assertOwnedLesson`)·`@/modules/conversation`(index) 만 import — 시험이 #184 라우트 import 3개로 고정. conversation 은 레슨을 모른다(`lessonId` 는 Trace `refId` 로만). 서비스의 `@/modules/preferences` import 는 `translation.ts`·`phraseHelp.ts` 가 이미 쓰는 index 경유. `index.ts` 우회 import 없음 |
| 인가 공백 가능성 | Info-4 | `translateLessonSpeech`·`helpLessonPhrase` 는 소유를 직접 확인하지 않는 서비스이고 `index.ts` 로 내보내진다. 지금은 라우트가 먼저 확인하고 `lessonId` 는 Trace `refId` 로만 쓰여 새는 것이 없다. 주석에 「다른 호출자는 `assertOwnedLesson` 을 먼저」 명시됨 |
| 비용/남용 | Info-1 | 별도 잠금·한도 결정(Leader)이라 한 사용자가 번역(#185)·회화방 번역(#32t)·도우미를 동시에 돌려 최대 3건의 LLM 호출이 단일 CLI 큐에 설 수 있다. 각각 분당 20/10·15s/12s 상한이 있어 허용 가능 — QA 가 큐 지연만 측정 |

## E. 시험

- **정답표가 손으로 쓴 것**: #185 본문 통과 9행·거절 14행(field/reason 직접 기입), 정리 표 11행, 엔진 오류 표 7행, 라우트 본문 400 표 13행, 오류 매핑 표 — 구현 식을 되풀이하지 않고 입력·기대 상태를 직접 적음. #184 는 #180 라우트를 **같은 프로세스에 실어 바이트 대조**하는 방식(구현 식 재사용 없음).
- **기존 시험 약화 없음**: `git status` 상 수정된 `__tests__` 파일 0, 새 시험 6개(서버 4 + UI-1 2)만 untracked. 영향 시험 9파일 165/165 통과.
- **양방향 한도·잠금 시험**: #185 ↔ 도우미/#32t 독립(`한도 독립`·`잠금 독립 ①②` 각각 양방향 + 「각자 자기 잠금은 걸려 있음」 대조), #184 ↔ #180/#181 공유(분당·하루·잠금 양방향, 같은 틱 4건 중 1건).
- 한계: #184 에는 서비스·라우트 소스 스캔이 있으나 **#185 에는 없다**(Low-1).

### 직접 변이 표 (변이 전용 복사본 `~/.node-local/thekaiwa-rev077s-mut`, 임시 파일 + `os.replace`, 끝난 뒤 원본 바이트 복원·`diff -rq` 동일 확인, 스크립트 scratchpad `mut077s.py`)

| # | 변이 | 판정 | 잡은 시험 수 |
|---|---|---|---|
| M1 | #185 한도 키를 도우미(`phrase-help:`)와 공유 | 포착 | 3 |
| M2 | #184 분당 한도 키 분리(`lesson-phrase-help:`) | 포착 | 4 |
| M3 | #184 에 레슨 상태 검사 추가(DONE → 409 `ENDED`) | 포착 | 5 |
| M4 | #185 모르는 키 허용 | 포착 | 2 |
| M5a | #185 잠금 해제를 `finally` 에서 성공 경로로 이동(예외 시 누수) | 포착 | 14 |
| M5b | 도우미 공용 `withPhraseLock` 해제를 성공 경로로 이동 | 포착 | 38 |
| M6a | #180 `helpPhrase` 가 `runPhraseHelp` 에 `chatId` 대신 `null` 전달(refId 이름 변경 회귀) | 포착 | 2 |
| M6b | #184 `helpLessonPhrase` 가 `refId` 로 `null` 전달 | 포착 | 1 |
| M7 | #185 **서비스**에 `void prisma.lesson.updateMany(…).catch()` 추가 | **생존** | 0 |
| M7r | #185 **라우트**에 같은 숨은 쓰기 추가 | **생존** | 0 |
| M8 | #184 잠금 키를 `'L:'+userId` 로 분리(#180/#181 과 비공유) | 포착 | 3 |
| M9 | #185 소유 확인을 한도보다 먼저(404 가 한도를 안 씀) | 포착 | 2 |
| M10 | #184 질의 앞에 `[수업]` 표시(레슨 맥락 주입) | 포착 | 2 |

13개 중 11 포착 · 2 생존(기준선: 변이 없을 때 9파일 165/165 통과). 생존 2개는 모두 Low-1 의 같은 갭이다.

## F. 증빙 재실행 — 서버 A + B 가 합쳐진 상태의 첫 재실행

미러 `~/.node-local/thekaiwa-rev077s` — `diff -rq src <저장소 src> --exclude=components` 차이 0, `src/components` 는 `git archive HEAD` 와 차이 0(UI-1 진행 중 파일 미반영). node_modules 만 하드링크, 소스·tsbuildinfo link 1 확인. 저장소 `package.json`·tsconfig·eslint·next 설정 동일.

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 (19.7s) |
| `./node_modules/.bin/eslint <서버 A·B 변경 코드 6 + 시험 4 = 10파일>` | exit 0 |
| 영향 시험 9파일(서버 시험 4 + `task056PhraseHelp`·`task056PhraseHelpRoute`·`task072WordHelpServer`·`phraseHelp`·`phraseHelpWord`; 이 중 `userTranslation`·`task026s2` 는 전체 시험에 포함) | 165/165 |
| 전체 시험 `find src scripts/seed-build -name '*.test.ts' \| sort`, `--test-concurrency=1`, 가짜 `DATABASE_URL` | tests 4455 · pass 4450 · **fail 0** · skipped 5 · 269s |
| `./node_modules/.bin/next build` | exit 0, 경로표에 `ƒ /api/v1/lessons/[id]/phrase-help`·`ƒ /api/v1/lessons/[id]/speaking-translation`; 경고는 기존 `persona/loader.ts` 동적 파일 추적 경고뿐 |

(skipped 5 는 개발자 두 기록과 같은 수 — 미러에 `android/` 가 없어 건너뛰는 시험 포함.)

## 발견

| ID | 심각도 | 위치 | 내용·근거 | 권고 |
|---|---|---|---|---|
| Low-1 | LOW | `task077LessonTranslation.test.ts`·`task077LessonTranslationRoute.test.ts` | #185 에는 「저장 없음」을 소스 수준에서 고정하는 시험이 없다(#184 에는 서비스 소스 스캔 `저장 없음: 레슨 도우미 함수 소스…`·라우트 소스 스캔이 있음). 변이 M7(서비스)·M7r(라우트)에서 `void prisma.lesson.updateMany(...).catch()` 를 넣어도 시험 29개가 모두 통과했다(`await` 하지 않는 쓰기는 가짜 DB 연결 실패가 응답에 반영되지 않음 — 개발자 기록 「한계」와 같은 내용). 코드를 읽어 **현재는 쓰기 0** 임을 확인했으므로 결함은 아니고 회귀 방지 구멍이다 | #184 시험의 두 개를 본떠 추가: ① `lessonTranslation.ts` 소스에서 `prisma`·쓰기 메서드·`$transaction`·`console.` 부재 + `Object.keys(lessonTranslationDeps)` 가 `['complete','learnerLevel','trace']` ② 라우트 소스 import 가 `@/modules/{conversation,infra,learning}` 셋뿐이고 `prisma|withTransaction|\.(create|update|upsert|delete)\(` 부재. UI-2 와 병행 가능, QA 이전에 하면 좋음 |
| Low-2 | LOW | `phraseHelp.ts:162-168` (`helpLessonPhrase`) · api-contract #184 | 수준 = 프로필(`getProfile().level`)이고 레슨 수준(`Lesson.level`)을 읽지 않는다. 승인안 B2(「회화방과 동일 동작·레슨 맥락 안 넣음」) 안에서 개발자가 #181 을 본보기로 고른 것이고 api-contract 에 명시돼 있어 **결함이 아니라 해석 차이**다. 다만 회화방 #180 은 `chat.level ?? profile.level` 이므로 엄밀히 「회화방과 같음」은 레슨 수준을 쓰는 쪽이고, task-076 으로 챌린지 난이도가 생긴 뒤에는 프로필 N4 사용자가 N2 챌린지 레슨에서 N4 범위 표현을 받는다(받는 표현이 학습자가 지금 소화할 수 있는 쪽이라 해가 되지는 않음). 바꾸려면 learning 에 레슨 수준 읽기 함수를 새로 두고 라우트가 서비스 인자로 넘기는 작은 변경이 필요하다(서버 B 파일 밖) | 이번 배포에서는 현행 유지 + 폰 확인 항목에 「챌린지 난이도가 프로필과 다른 레슨에서 도우미 표현 수준」을 넣고, 이상하면 후속 IMP. 바꾸는 쪽을 택하면 Leader 가 사양을 확정(B2 와 충돌하지 않음 — 레슨 *내용*이 아니라 *수준 숫자* 하나) |
| Info-1 | INFO | 설계 | 위 D의 「비용/남용」 — 번역(#185)·회화방 번역(#32t)·도우미는 서로 막지 않아 한 사용자의 동시 LLM 호출이 최대 3건. Leader 결정 사항이며 상한은 각 한도로 막혀 있음 | QA 가 동시 실행 시 단일 큐 지연(타임아웃 12/15s 안인지) 측정 |
| Info-2 | INFO | 계약 | 일본어가 아닌 말(글자 모드에서 한국어로 친 답 등)은 모델이 베끼기 쉬워 `sanitizeUserKo` 가 버리고 502 `TRANSLATION_REJECTED` → 화면은 [다시 가져오기] 를 보이지만 같은 글로 다시 눌러도 대개 같은 결과(개발자 알려진 한계 1번) | UI-2 에서 일본어 글자(히라가나·가타카나·한자)가 하나도 없는 말은 #185 를 부르지 않고 번역 칸을 만들지 않거나 「이 말은 번역할 수 없어요」(막힘) 갈래로 보낼지 결정 |
| Info-3 | INFO | 문서 | `docs/screens.md` §34-7 #184 행이 아직 「`/api/v1/lessons/:id/phrase-help`(가칭)」(#185 행은 「구현 확정」으로 정정됨). api-contract 표에서 #185 행이 #62b 아래, #184 행이 §1-5 에 있어 번호 순서와 위치가 다르다(각 행 머리에 위치 이유가 적혀 있어 혼동은 작음). `task077LessonTranslationRoute.test.ts:66` 의 가짜 소유 확인은 404 문구가 「레슨을 찾을 수 없어요.」로 실제(`rows.ts:24` 「수업을…」)와 달라 문구 대조는 #184 시험(`task077LessonPhraseHelpRoute.test.ts:192`)만 한다 | Leader 가 §34-7 의 「(가칭)」 제거. 시험 문구는 선택적 정리 |
| Info-4 | INFO | 구조 | `translateLessonSpeech`·`helpLessonPhrase` 가 소유를 확인하지 않는 서비스로 `index.ts` 에 공개됨(Trace `refId` 로만 사용, 주석에 호출자 책임 명시) | 현행 유지. 다른 호출자가 생기면 라우트처럼 `assertOwnedLesson` 선행 |

Critical/High/Medium: **발견 없음**.

summary: `{ "critical": 0, "high": 0, "medium": 0, "low": 2, "info": 4 }` · `native_change: false`(서버·문서만, 네이티브·`versionCode` 변경 없음)

## G-1. UI-2 에게 넘길 주의 (화면 쪽 요구)

1. **#185 본문은 `{ text }` 하나뿐** — `itemId`·`lessonId` 를 같이 보내면 400 `unknown_key` 로 거절된다. 화면은 `compareAnswer(text, modelAnswerJa).kind === 'same'` 이면 호출하지 않고 `modelAnswer.ko` 를 쓴다.
2. **취소(abort) 시점**: 화면 12초 시간 초과·다음 과제·새 녹음 시작·화면 이탈(StageSpeak 언마운트)에서 `AbortController.abort()`. 서버는 엔진 호출을 멈추고 409 `CANCELLED` 로 끝내며 잠금을 즉시 푼다 — 취소하지 않으면 최대 15초 동안 잠금을 쥐어 곧이은 [다시 가져오기] 가 409 `TRANSLATION_BUSY` 가 된다. **409 `CANCELLED` 는 줄을 만들지 말고 버릴 것**(이미 버린 요청의 응답).
3. **409 `TRANSLATION_BUSY`** = 이 입구의 이전 호출이 아직 도는 중(다른 탭·재진입 등) → 바쁨 줄(`DISPLAY_COPY.userTr.busy`) + 다시 가져오기; 잠깐 뒤 재시도하면 풀린다.
4. **502 `TRANSLATION_REJECTED`**(정리에서 버려짐)와 엔진 502/504/422, 화면 12초는 모두 같은 「번역을 가져오지 못했어요 · 다시 가져오기」. 400·404 는 「이 말은 번역할 수 없어요」(단추 없음). 429 는 `Retry-After`·`data.details.retryAfterSec` 를 쓸 수 있다.
5. 일본어 글자가 없는 말(Info-2)과 STT 가 뒤틀린 말은 502 가 반복될 수 있음 — 호출 생략 여부를 Leader 와 정할 것. 번역 힌트 「알아들은 말을 그대로 옮겼어요」는 **AI 번역이 성공했을 때만**(`same` 즉시 번역에는 없음).
6. **#184**: 요청 `{ queryKo }`(trim 1~100 코드포인트·한글 1자 이상), 응답 `data = { items }` — #180 과 같은 봉투라 `usePhraseHelper` 의 요청 함수만 주소 주입으로 바꾸면 된다. 오류 매핑은 §22-9 그대로이되 **409 `ENDED` 는 오지 않고**, 409 `PHRASE_BUSY` 는 *다른 도우미*(회화방·단어 추가)와도 공유된다(같은 사용자가 두 화면에서 동시에 물을 때). 404 문구는 「수업을 찾을 수 없어요.」.
7. 한도 합산: 분당 10·하루 300 을 회화방·단어 추가·레슨이 나눠 쓰므로 레슨에서 429(`h-rate` 카운트다운)가 날 수 있다. 번역 한도(#185 분당 20)와는 독립이라 도우미 429 중에도 번역은 된다.
8. 두 입구 모두 `Cache-Control: private, no-store`, 응답에 엔진·모델 이름 없음. 서버는 아무것도 저장하지 않는다 — 같은 글 캐시는 화면 메모리에서만(§34-4).

## G-2. QA high_risk_areas (실서버 확인이 필요한 곳)

1. **한도 합산·독립(실제 쿠키 세션, 실 서버)**: #180+#181+#184 합쳐 분당 10 → 세 라우트 모두 11번째 429(`Retry-After`), 하루 300 합산, 그리고 그동안 #185 는 계속 200(분당 20, 키 별도).
2. **잠금 합산·독립**: 레슨 도우미 진행 중에 회화방/단어 도우미 호출 → 409 `PHRASE_BUSY`(반대도), 레슨 도우미 진행 중에 #185·#32t 호출 → 막히지 않음(반대도). 취소(abort) 직후 즉시 재호출이 200 인지(잠금 해제).
3. **끝난(DONE) 레슨**에서 #184·#185 가 200(409 없음), 남의 레슨 id·없는 id·형식 틀린 id 는 둘 다 같은 404, 쿠키 없음 401.
4. **실제 LLM 번역 품질**: 반말은 반말로, STT 가 뒤틀린 문장, 글자 모드의 한국어 입력(502 `TRANSLATION_REJECTED` 빈도), 1,000자 근처 긴 글, 줄바꿈 포함 글. 15초 엔진 상한 vs 화면 12초.
5. **도우미 표현 수준**: 프로필 수준과 다른 챌린지 난이도 레슨에서의 표현 수준(Low-2) — 폰 확인 항목.
6. **RequestTrace 행 점검(관리자 Trace)**: `refType:'lessonTranslation'`·`'phraseHelp'`, `refId` = 레슨 id, 단계에 원문·번역·질의 없음, `entry:'lesson'` 표시. 로그(`pm2 logs`)에도 원문 없음.
7. **첫 호출 부수 효과**: Profile 행이 없는 사용자의 첫 #184/#185 호출이 Profile 1행을 만든다(기존 #32t·#180·#181 과 같은 동작).
8. **동시 3건 지연(Info-1)**: 번역 + 회화방 번역 + 도우미를 한꺼번에 눌렀을 때 단일 큐 대기로 12/15초를 넘기지 않는지.

## 체크포인트
- [완료] 이력서·개발자 기록·정본(`api-contract.md` #184·#185·#180·#181 행·절, `screens.md` §34-4/34-7) 대조, 변경 코드 전수 읽기(서비스 2·라우트 2·`phraseHelp.ts` diff·`index.ts`·`types`), 시험 4파일 구조 확인.
- [완료] 미러 `thekaiwa-rev077s` 로 tsc·eslint·전체 시험(4455/0 실패)·`next build` 0, 변이 13개(`thekaiwa-rev077s-mut`, 복원·`diff -rq` 동일).
- 미커밋 대상: 이 기록 파일만(감사 중 코드·시험·문서 변경 0).
