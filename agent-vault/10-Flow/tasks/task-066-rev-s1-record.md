---
tags:
  - type/review
  - domain/ask
  - domain/speech
task: task-066
reviewer: REV-066-S1 (서버 S1′ — ASK 턴이 실시간 음성 인식 글자를 받도록)
status: 완료 (PASS_WITH_NOTES)
---
# REV-066-S1 — task-066 S1′ 서버 변경 독립 감사

대상: `chats/validate.ts` · `orchestrator/{index,ask}.ts` · `_lib/turnRoute.ts` + 시험 3파일(`askApi`·`askTurn`·`turnRoute`). 개발자 기록 [[task-066-dev-s1-record]]. 검증은 전용 미러 `~/.node-local/thekaiwa-dev066s` 에서만 — 시작 시 `diff -rq src tests` 0, 끝에 스크래치 2파일 제거 후 다시 `diff -rq src tests` 0·`*.orig`/`*.rej` 0·잔존 프로세스 0. 작업 트리·docs 수정 0, 실제 `claude` 실행 0, `DATABASE_URL=…invalid`, 운영/3010/3011/dev·build 미사용.

## 판정: PASS_WITH_NOTES — Critical 0 · High 0 · Medium 0 · Low 2 · Info 5

## 항목별 결과 (근거 `파일:줄`)

**1. 회화·채팅 불변성 — OK (단독 오류 불변, 겹친 오류 우선순위만 Low).**
- 직접 대조: 옛 `validate.ts`(`git show HEAD:`)와 새 파일을 미러에 나란히 두고 본문 조합 **31,104건**(text 3 × inputSource 9 × utteranceId 6 × scope 3 × coachRevealed 2 × clientTimings 2 × resumePending 4 × 종류 {TALK,CHAT,ASK,남의 방}) 을 라우트 순서(본문 → 소유·종류 → 종류별)대로 흘려 결과를 비교했다. **기본 옵션(`parseTurnBody(body)`)은 TALK·CHAT·남의 방 전 구간에서 옛 결과와 0건 차이**(`validate.ts:166` 기본 `opts = {}` 이면 `!opts.deferVoiceUtterance` 가 참이라 옛 줄과 같음). 라우트가 `defer:true` 로 돌 때 TALK·CHAT 의 차이는 전부 「옛 `400 utteranceId/required`」가 바뀌는 경우뿐이고, 바뀌는 곳은 ① 남의 방 → 404 ② `coachRevealed`·`clientTimings`·`scope` 등 **다른 오류가 함께 있는 요청**에서 그쪽 400 이 먼저 나옴(`scope` 가 유효해도 TALK·CHAT 에선 `scope/ASK` 가 먼저 — `validate.ts:193` 이 `194` 보다 앞) 두 가지다. 음성 필드 하나만 틀린 단독 요청은 코드·필드·사유·메시지가 같다(`voiceNeedsUtterance()` 한 함수 공유, `validate.ts:140-142`).
- 호출부: 운영에서 `parseTurnBody` 호출은 `turnRoute.ts:32` **한 곳**(항상 `defer:true`), `assertTurnFitsKind` 도 `turnRoute.ts:34` 한 곳 — 둘은 항상 쌍이고 `startTurn`/`talkChatHooks` 보다 앞(`:34` → `:35`). `defer` 를 켜지 않는 TALK·CHAT 운영 경로는 없다(나머지 호출은 시험뿐). 따라서 이어받기가 빠지는 틈이 없다.
- 400→404(남의 방): [확실] 정보 노출은 **늘지도 줄지도 않는다**. 옛 동작은 방 소유와 무관하게 400 이라 소유 오라클이 없었고, 새 동작의 404 는 「없음」과 「남의 방」이 구분되지 않는 같은 응답이며, 다른 모든 유효 요청이 이미 같은 404 를 낸다. 개발자 기록의 「안전한 방향」은 과장이 아니지만 이득이 있는 변경도 아니다(순서 일관성 개선). 시험이 고정(`turnRoute.test.ts` 「회귀(TALK·CHAT)」 마지막 단언).
- 에러 순서: 본문 400 → 소유·종류 404 → 종류별 400 → ASK 한도 429(`turnRoute.ts:32-38`). `api-contract` 는 순서를 문장으로 못 박지 않고(§2-18-A·#32 에 순서 서술 없음) 순서 주석은 `turnRoute.ts:1-4` 머리뿐이며 이번 변경이 그 주석을 갱신했다.

**2. 보안·프라이버시 — OK.**
- `utteranceId` 우회: 값이 오는 모든 형태가 막힌다 — 유효 문자열 → `assertAskInput` 400 `notAllowed`(`validate.ts:181`); 빈 문자열·41자 이상·숫자·불리언 → `optionalId` 가 본문 검사에서 400 `id`(`:34-38`); `null`·생략 → 없음으로 읽혀 통과(정상). `inputSource` 생략/`null` + `utteranceId` → `REALTIME_STT` 로 읽혀 거절. `TEXT`+`utteranceId` → 본문 검사 400 `inputSource`(`:166`). 대소문자 다른 값·배열·숫자 → 허용 목록 검사로 400(`:158-161`). 위 조합은 31,104건 비교에서 ASK 결과가 전부 `400` 또는 의도된 OK 로만 나왔다.
- DB 열거 검증: ASK 에 저장되는 값은 `TEXT|REALTIME_STT` 둘뿐(`assertAskInput` 이 라우트·`startTurn` precheck·`acceptTurnTx` 세 겹 — `index.ts:147`, `:774`)이고 둘 다 Prisma `InputSource` 값이라 오류 값이 Prisma 예외(500)로 갈 수 없다.
- 로그·Trace: 변경 파일에 추가된 `console.*` 0(기존 줄은 `e.name` 만). Trace PROMPT 단계에 추가된 필드는 `inputKind`(열거 `TEXT|VOICE`) 하나(`ask.ts:430,446,468`). 시험 ⑫-a 가 「Trace·toolLog 직렬화에 질문 본문이 없음」을 단언. 오류 `details` 는 field·reason 만. 원음·발화 행: S1 은 어느 경로에서도 `Utterance`/`speech` 를 호출하지 않는다(ASK 는 `talkChatHooks` 를 안 부름 — `turnRoute.ts:36-40`).
- `resumePending`: `acceptTurnTx` 가 잠근 `Chat` 행의 `userId` 일치를 먼저 확인(`index.ts:143-144` 404)한 뒤 그 `chatId` 안에서만 사용자 행을 읽는다(`:200-204`) — 타 사용자 행 접근 불가. `inputKind` 는 **저장된 행** 의 `inputSource`(`USER_MESSAGE_SELECT` 포함, `:130`)에서 읽어 요청 값을 쓰지 않는다. `USER_MESSAGE_SELECT` 에서 `inputSource` 를 빼면 `AcceptedTurn.userMessage.inputSource` 필수 속성 때문에 **tsc 가 막는다**(V20, TS2741 2건 실측).

**3. 한도·락 불변 — OK.** 음성 질문도 같은 `admitAsk`→`startTurn`→`done.then(release, release)` 줄을 탄다(`turnRoute.ts:36-46`, 변경 hunk 는 `parseTurnBody` 인자 1줄과 주석뿐). 새로 생긴 던지기 지점 `assertAskInput`(`startTurn` precheck)은 `try` 안이라 턴 락을 풀고(`index.ts:~789-795` catch → `releaseTurnLock`) 던지며, 라우트의 `catch` 가 `admission.refund()` 를 부른다. 수락 전 `assertTurnFitsKind` 거절은 `admitAsk` 보다 앞이라 몫 0(시험 「음성 질문 거절은 수락 전」이 이어 분당 3건 통과로 확인). 변이 V8(refund 제거)은 10건이 잡는다.

**4. 프롬프트 연결 — OK.** `askInputKindOf`(`ask.ts:412-414`)는 `REALTIME_STT` 만 `VOICE`, 그 밖(`TEXT`·`SERVER_STT`·null)은 `TEXT`. `buildAskPlan` 쪽에서도 `normalizeAskInputKind` 가 `'VOICE'` 외를 `TEXT` 로 접어 두 겹이다(`prompts/ask.ts:324-326`). TEXT 경로 바이트 불변: PE 의 `ask.test.ts` 「inputKind: 기본·명시 TEXT·알 수 없는 값은 같은 요청(바이트 동일)」이 빌더 수준을 고정하고, 이번 `askTurn` ⑫-a 가 파이프라인 수준에서 「글자 질문엔 표지 없음 + 질문 글(messages) 바이트 동일」을 단언한다. 단 `askInputKindOf` 자체에 `null/undefined/SERVER_STT → TEXT` 단언은 없다(F-2).

**5. 시험 품질 + 변이 20건 (전용 미러 소스 사본, 매번 즉시 원복) — 잡힘 18 · 생존 2.**

| # | 변이 | 결과 (잡은 시험 수) |
|---|---|---|
| V1 | 허용 목록에서 `REALTIME_STT` 제거 | 잡힘 (9) |
| V2 | `utteranceId` 거절 제거 | 잡힘 (8) |
| V3 | `inputSource` 허용 목록 검사 제거(허용 밖 값 통과) | 잡힘 (7) |
| V4 | `askInputKindOf` 항상 TEXT | 잡힘 (3) |
| V5a | `askInputKindOf` 항상 VOICE | 잡힘 (2) |
| V5b | `askInputKindOf` TEXT 아니면 VOICE(null·SERVER_STT 도 VOICE) | **생존 → 시험 공백(F-2)** |
| V6 | `parseTurnBody` 옵션 기본값을 `defer:true` 로(회화 영향) | 잡힘 (2: task006 + askApi 회귀) |
| V7 | TALK·CHAT 의 「음성은 발화 id 필수」 이어받기 제거 | 잡힘 (2) |
| V8 | 라우트 `refund` 제거 | 잡힘 (10) |
| V9 | resume 이 저장값을 무시하고 TEXT | 잡힘 (1: ⑫-c) |
| V10 | 라우트가 `deferVoiceUtterance` 안 켬 | 잡힘 (4) |
| V11 | `acceptTurnTx` ASK 방어선 제거 | 잡힘 (2) |
| V12 | `startTurn` precheck ASK 방어선 제거 | 잡힘 (2) |
| V13 | `utteranceId` 거절을 `REALTIME_STT` 일 때만 | 잡힘 (3) |
| V14 | 허용 목록에 `SERVER_STT` 추가 | 잡힘 (7) |
| V15 | NEEDS_SCOPE Trace 의 `inputKind` 제거 | 잡힘 (1) |
| V16 | 본 경로 Trace 의 `inputKind` 제거 | 잡힘 (2) |
| V17 | `buildAskPlan` 에 `inputKind` 미전달 | 잡힘 (2) |
| V18 | 수락 트랜잭션이 ASK 사용자 행 `inputSource` 를 TEXT 로 덮어씀 | 잡힘 (1: ⑫-e) |
| V19 | TALK·CHAT 에서 `scope` 검사와 음성 검사 순서 바꿈 | **생존 → 동등(두 오류가 함께 올 때의 우선순위만 다름, 시험이 순서를 고정하지 않음 — F-1 에 기록)** |
| V20 | `USER_MESSAGE_SELECT` 에서 `inputSource` 제거(resume 의 실제 SELECT) | 시험은 생존, **tsc 가 TS2741 2건으로 막음 → 동등(컴파일 시점 잡힘)** |

게이트 재현: 변경 7파일 eslint 0 · `tsc --noEmit` 0 · `src/modules/conversation`+`src/app/api/v1/chats` 시험 **1,185/1,185** (개발자 기록과 일치) · 대상 6파일(askApi·askTurn·turnRoute·task006·task007·task010c) 118/118.

**6. 계약 문서 영향 (Leader 가 고친다 — 아래 「고칠 문장」).**

**7. 6층·엔진명 — OK.** 새 코드의 import: `validate.ts`(`@prisma/client` 타입·`@/modules/infra`·`@/types/ask`), `ask.ts`(`InputSource` 타입 추가뿐, 기존 `@/modules/engine` import 는 이전부터), `turnRoute.ts`(`infra`·`conversation`). L2 → speech/engine 신규 import 0. `reazon|whisper|style-bert|claude|sherpa|sbv2|model_id|speaker_id` grep 변경 4파일 0건(`validate.ts:15` 주석의 일반어 "gateway" 1건은 엔진명이 아님).

## 발견 목록

| ID | 심각도 | 위치 | 내용·재현 | 권고 |
|---|---|---|---|---|
| F-1 | Low | `validate.ts:165,193-194` | TALK·CHAT 에서 `REALTIME_STT`+발화 id 없음에 **다른 오류가 겹친** 요청은 이제 그 다른 400 이 먼저 나온다(예: `+coachRevealed:"x"` → 옛 `utteranceId/required` → 새 `coachRevealed/boolean`; `+scope:{key:'ALL'}` → `scope/ASK`). 단독 오류·정상 요청은 불변. 31,104건 비교의 차이 전부가 이 범주 + 남의 방 404. 시험은 우선순위를 고정하지 않음(V19 생존) | 조치 불필요(둘 다 400, 클라이언트가 한 번에 한 오류만 보여 줌). 우선순위를 못 박고 싶으면 `scope` 줄과 음성 줄 순서를 정하고 시험 1건 |
| F-2 | Low | `ask.ts:412-414` | `askInputKindOf` 단위 단언 없음 — V5b(`TEXT` 아니면 `VOICE`)가 생존. 현재 도달 가능한 값은 `TEXT|REALTIME_STT` 뿐(ASK 행은 `assertAskInput` 을 거쳐 저장)이라 실해 없음. 다만 null/`SERVER_STT` 가 오는 옛·외부 행이 생기면 시험이 못 잡음 | `askInputKindOf(null/undefined/'SERVER_STT'/'TEXT') === 'TEXT'`, `('REALTIME_STT') === 'VOICE'` 4줄 단언 |
| F-3 | Info | `turnRoute.ts:32` | `defer:true` 가 TALK·CHAT 의 「발화 id 필수」를 `assertTurnFitsKind` 한 곳에만 기댄다. 현재 호출부는 1곳이라 안전하나, 이후 다른 라우트가 `parseTurnBody(…,{defer:true})` 만 쓰고 종류별 검사를 빼면 무발화 음성 턴이 TALK 로 샌다 | 옵션 주석(`validate.ts:132-137`)이 이미 쌍 사용을 명시. 새 호출부가 생기면 이 감사 항목을 재확인 |
| F-4 | Info | `src/types/ask.ts:71-74` | 클라이언트 요청 타입이 `inputSource: 'TEXT'` 고정 + 주석 「TEXT 만(3a)」 — 서버와 어긋남. S2(화면) 가 넓혀야 컴파일됨(타입이 막아 줌) | S2 developer 에게 인계: `'TEXT' \| 'REALTIME_STT'` 로 확장하고 **`utteranceId` 는 타입에서 제외**(보내면 400) |
| F-5 | Info | `useUtteranceReviews`·`utteranceReview.ts:126-133` | 발화 없는 `REALTIME_STT` 메시지가 ASK 방에 생긴다(#29 에서 `utteranceId:null, audioAvailable:false`). 지금 `hasRecentVoice` 사용처는 `TalkRoom` 뿐이라 영향 0. ASK 화면이 이 훅을 재사용하면 존재하지 않는 발화를 폴링한다 | S2 에 「ASK 방에서 `useUtteranceReviews`·`UtteranceReviewCard`·`TalkRoom` 재생(`canMine`) 로직 재사용 금지」 인계 |
| F-6 | Info | `ask.ts`(clientTimings 미사용) | 음성 질문에서 `clientTimings`(예: `sttMs`)를 보내도 서버는 수락만 하고 ASK Trace 에 쓰지 않는다(`index.ts:~803` ASK 분기가 `clientTimings` 이전에 반환). api-contract #32 「서버는 Trace `STT` step 에 쓴다」와 ASK 에서만 어긋남 | 계약 문장에 「ASK 는 수락 후 무시」 한 줄(Leader), 또는 후속으로 STT 단계 기록 |
| F-7 | Info | 시험 구조 | `askTurn` ⑫-c(끊김 복구의 입력 방식)는 `acceptTurn` 목(mock)이 `inputSource` 를 돌려주는 가정 위에 서 있다. 실제 `acceptTurnTx` 의 resume SELECT 연결은 시험이 아니라 **컴파일 타입**이 지킨다(V20) | QA 라이브에서 음성 질문 → 강제 실패 → `resumePending` 1건으로 `inputKind=VOICE` 유지 확인 |

## 계약 문서에서 고칠 문장 (Leader — `docs/design/api-contract.md`)

1. **`:1392` §2-18-A 「범위」** — 「글자 질문만(3a). 음성 받아쓰기(데모 L 탭)는 2단계(D13) — `inputSource`≠`TEXT`·`utteranceId` 는 ASK 에서 `400`.」 → 거짓. 제안: 「글자 질문 + 음성 질문(task-066): 마이크로 말하면 회화와 같은 **실시간 음성 인식이 글자로 바꾼 뒤** 그 글자만 보낸다(`inputSource:"REALTIME_STT"`, `utteranceId` 없음). 원음·발화 행(`Utterance`)은 질문에 연결하지도 서버에 저장하지도 않는다. `inputSource` 는 `TEXT|REALTIME_STT` 만이고 `SERVER_STT`·`utteranceId` 는 ASK 에서 `400`.」
2. **`:1396` §2-18-A 3항** — 「`inputSource` 는 `TEXT` 만」 → 거짓. 제안: 「`inputSource` 는 `TEXT`·`REALTIME_STT`(발화 id 없이)만 — 그 밖 `400 {field:'inputSource', reason:'TEXT|REALTIME_STT'}`. `utteranceId` 는 어떤 `inputSource` 와도 `400 {field:'utteranceId', reason:'notAllowed'}`(`inputSource:TEXT`+발화 id 는 본문 검사에서 `400 {field:'inputSource'}`). 음성 질문도 같은 한도(분당 3·하루 60·`ASK_BUSY`·수락 전 실패 환불)·같은 락을 쓴다. 저장되는 사용자 메시지의 `inputSource` 는 받은 값 그대로.」
3. **`:792` #32 필드 표 `inputSource` 행** — 「`utteranceId` 없이 `REALTIME_STT` 는 `400`」 → ASK 에선 거짓. 제안: 「…는 TALK·CHAT 에서 `400`(방 종류를 안 뒤에 검사 — 남의 방은 먼저 `404`); ASK 는 반대로 발화 id 없는 `REALTIME_STT` 가 정상(§2-18-A)」.
4. **`:1398` §2-18-A 7항 「로그·추적」** — 「의도·건수·단계 시간·모델 티어만」에 「+ Trace PROMPT 단계의 입력 방식 `inputKind`(`TEXT|VOICE` 열거값)」 추가.
5. **`:155` #32 목록 행 / #32 `clientTimings` 설명(`:~785`)** — 「서버는 이번 Trace `STT` step 에만 쓴다」에 「ASK 는 값을 받기만 하고 쓰지 않는다」 한 줄(F-6).
6. (선택) **§2-18-A 5항 D2=(b)** 전송 범위에 「음성 질문이어도 나가는 것은 인식된 글자뿐 — 원음은 서버 밖으로 나가지 않는다」.
7. 오류 사유 `ASK_TEXT_ONLY` 는 문서에 없으므로 삭제할 문장 없음(`src`·`tests`·`scripts` grep 도 0건).

## 전달

- **QA high_risk_areas**: ① 라이브: ASK 방에 `{text, inputSource:'REALTIME_STT'}` → SSE 정상·사용자 행 `inputSource=REALTIME_STT`·`Utterance` 행 수 불변·Trace PROMPT `inputKind=VOICE` ② 거절 6종: `+utteranceId`(REALTIME_STT/생략/SERVER_STT)·`SERVER_STT`·`VOICE`·`TEXT+utteranceId` → 400 이고 분당·하루 몫 불변 ③ 회귀: TALK 방에 발화 id 없는 `REALTIME_STT` → 400 `utteranceId/required`, 남의 방 → 404, **정상 음성 회화 1턴(실기기)** ④ 음성+글자 합산 분당 3·`ASK_BUSY`·409 환불 ⑤ 음성 질문 강제 실패 → `resumePending` 으로 `inputKind=VOICE` 유지(F-7) ⑥ 실제 인식 문장 10~20건의 오인식 대응(PE ⒜ — 모의 입력 외 실측 없음) ⑦ pm2 로그·RequestTrace 에 질문 글 없음(grep) ⑧ #29 에서 ASK 사용자 메시지 `inputSource:REALTIME_STT, utteranceId:null, audioAvailable:false`.
- **S2 developer**: F-4·F-5. 질문 전송 본문은 `{ text, inputSource: 'REALTIME_STT' }`(+선택 `clientTimings`, `scope`) — `utteranceId` 금지, `/api/v1/utterances` 호출 금지, `useUtteranceReviews`·`canMine` 재사용 금지.
- native_change: false (서버·웹 변경, `versionCode` 해당 없음).
