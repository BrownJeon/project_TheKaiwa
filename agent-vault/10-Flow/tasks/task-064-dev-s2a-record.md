---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-S2a
---
# task-064 dev-S2a 기록 — ASK 턴 파이프라인(orchestrator)

상위: [[task-064-ask-anything-3a]] · 이전 단계 [[task-064-dev-s1-record]] · 프롬프트 [[task-064-pe-record]]

## 인터페이스 (S2b 가 읽고 라우트를 맞춘다)

- **진입점 변화 없음**: `startTurn({ userId, chatId, request, hooks? }) → TurnHandle`(`accepted`·`subscribe`·`done`) 그대로. `Chat.kind=ASK` 면 orchestrator 가 알아서 ASK 경로로 돈다(라우트 분기 불필요). 끊김 복구 `{resume:true}` 도 같은 함수.
- **요청 `scope`**: S2b 가 `chats/validate.ts` 의 `TurnRequest`(resume:false 쪽)에 `scope?: { key: 'THIS_WEEK'|'LAST_30D'|'ALL' }` 를 더한다(ASK 가 아닌 방에서 오면 라우트가 400). orchestrator 는 `request.scope?.key` 를 **구조적으로** 읽는다(필드가 아직 없어도 컴파일된다). 쓰는 조건: 직전 ASSISTANT 의 `toolLog.ask.needsScope` 가 있을 때만 — 아니면 무시.
- **orchestrator 방어(라우트 검증과 별개)**: ASK 인데 `inputSource !== 'TEXT'` 이거나 `utteranceId` 가 있으면 수락 전 `ApiError('VALIDATION')`(행 0·이벤트 0·LLM 0). 수락 트랜잭션(`acceptTurnTx`)도 같은 검사.
- **hooks**: ASK 는 `onAccepted`·`speaker`·`recordSelfCorrection`·`recordCorrectionProposed` 를 부르지 않는다. `gate` 는 채팅 확인과 병렬로 그대로 돈다 — ASK 에는 넘기지 말 것(발화가 없다).
- **SSE 이벤트(ASK)**: `accepted` → `status{stage:'PROMPT'}` → `status{stage:'LLM'}` → `status{stage:'PARSE'}` → `done` | `error`(1회). **규칙 되묻기 단락**(`classifyIntent().needsScope`)은 `accepted` → `status{PROMPT}` → `done`(조회·LLM·PARSE 없음, Leader 결정). `audio` 없음.
- **`done.data`(ASK)**: `{ userMessageId, assistantMessageId, conversation:{ answerMd, replyKo:null, sources:[{type,id:string|null,date,label}], confidence, needsScope:null|{prompt, options:[{key,label}]}, records:{intent,count} }, correction:null, proposals:[{id,kind,payload,status:'PROPOSED',messageId}], audioCount:0, traceId }`.
- **저장값(#29 DTO 재료)**: ASSISTANT `content`=살균된 `answerMd`, `translation`=null, `toolLog.ask={sources,confidence,needsScope,records}`(+ 측정 칸). **`askMetaFromToolLog(toolLog): AskMetaDto | null`**(`src/modules/conversation/orchestrator/ask.ts`) — #29 메시지 DTO 의 `ask` 객체를 만들 때 이 함수로 읽으면 모양 검사가 한 곳이다(공개 index 에는 아직 안 올림 — 같은 conversation 모듈 안 `../orchestrator/ask` import).
- **기본 제목 상수** `ASK_DEFAULT_TITLE = '새 질문'`(같은 파일) — #28 생성의 기본 제목과 같은 값이어야 첫 답 저장 때 제목이 바뀐다.
- **목록 `preview`**: 수락 때 질문 ≤60자, 답 `DONE` 저장 때 답 첫 줄 평문 ≤60자를 `Chat.preview` 에 쓴다 — 목록은 `Chat.preview` 를 그대로 읽으면 된다.

## 파일 표

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/orchestrator/ask.ts` | 신규 — `processAskTurn`(턴 본문)·`askTurnDeps`(시험 주입점)·`saveAskTurnTx`(저장 tx)·`loadAskHistory`/`loadAskPrev`(이 방·이 사용자만)·`askMetaFromToolLog`·`askAllowedProposals`·`finalizeAnswerMd`·`withScopeGuard`·`askScopeDates`·`askAnswerPreview`/`askQuestionPreview`/`askTitleFrom`·`routerScopeOutput`·상수(`ASK_DEFAULT_TITLE`·`ASK_SCOPE_OPTIONS`·`ASK_SCOPE_SENTENCES`·`ASK_TURN_BUDGET_MS`=170s 등) |
| `src/modules/conversation/orchestrator/index.ts` | ASK 분기 최소 수정: `acceptTurnTx` FEATURE_NOT_READY 해제 → ASK 글자 질문만(VALIDATION)·미리보기 질문 ≤60 · `precheckChat` ASK 허용 · `startTurn` ASK 는 LLM 선행 시작 없이 수락 뒤 `processAskTurn`(훅 미사용), `askScopeKeyOf`(요청 `scope` 구조적 읽기) |
| `src/modules/conversation/orchestrator/locks.ts` | 주석만(ASK 예산과 180s stale 관계) |
| `src/modules/conversation/__tests__/askTurn.test.ts` | 신규 21건 |
| `src/modules/conversation/__tests__/prompts.test.ts` | Leader 승인 범위 밖 수정(+3/−1, 아래) |

## Developer 기록
- [착수] 사양 읽음: api-contract §2-18-A, task-064 Leader 결정, S1 인계, PE `ask.ts`·`askResponse.ts`, orchestrator `index.ts`·`shape.ts`·`stream.ts`·`locks.ts`, proposals.
- [체크포인트 1] **완료**: `orchestrator/ask.ts`(신규) · `orchestrator/index.ts` ASK 분기(수락 tx 검증·미리보기, precheck FEATURE_NOT_READY 해제, startTurn ASK 는 LLM 선행 시작 없이 수락 뒤 `processAskTurn`) · 시험 `__tests__/askTurn.test.ts` 20건 통과 · Leader 추가 지시 반영(① 규칙 되묻기 단락 = 조회·LLM 0, 고정 문장·칩·MEDIUM·count 0·`shortCircuit:'NEEDS_SCOPE'` ② `prompts.test.ts` 목록 수정). 변이 16+1 중 단독 미검출 2(M4·M4b — 제안 종류 검사가 두 겹이라 각각은 동치, 둘 다 지우면 검출). **남은 일**: conversation+learning 전체 시험, tsc·eslint·build, 기록 정리. **주의**: 미러 `~/.node-local/thekaiwa-dev064s2a` — tsc 실패는 S2b 진행 중 파일(`chats/_lib/__tests__/turnRoute.test.ts`·`__tests__/askApi.test.ts`·`chats/index.ts` MessageDto ask 타입)뿐, 내 파일 오류 0. **미커밋(내 범위)**: `src/modules/conversation/orchestrator/{ask.ts,index.ts}` · `src/modules/conversation/__tests__/{askTurn.test.ts,prompts.test.ts}` · 이 기록.
- [범위 밖 시험 수정(Leader 승인)] `src/modules/conversation/__tests__/prompts.test.ts` task-037 목록 — `others` 에 `['ask(064)', buildAskRequest(…)]` 1줄, 정렬 목록 맨 앞 `'buildAskRequest'`, 그리고 **컴파일에 필요한 import 1줄**(`import { buildAskRequest } from '../prompts/ask'`) — 지시는 2줄이었으나 import 없이는 tsc 실패라 3줄(+3/−1).
- [완료] 전체 검증·변이·기록 정리. Reviewer 인계 가능.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev064s2a`, NFS `sync-local.sh` 후 · DB·LLM 접속 없음)
- `node --import tsx --test src/modules/conversation/__tests__/askTurn.test.ts` → **21 pass / 0 fail**.
- `conversation`+`learning` 전체(`find … -name '*.test.ts'`, `DATABASE_URL=가짜`) → **1614 pass / 0 fail**(PE 마감 뒤라 S1 기록의 범위 밖 2건도 해소 — 체크섬 확정 + 목록 수정).
- `tsc --noEmit` **exit 0** · `eslint src` **exit 0**(경고 5, 내 파일 0) · `next build` **exit 0**.
- 엔진명 grep(`reazon|whisper|style-bert|claude|speaker_id|model_id|sonnet|haiku|opus`) `ask.ts`·`index.ts` **0건**. 로그는 오류 이름·코드만(`[ask] 처리 실패: <name>`).

### 시험 대응표(지시 ①~⑫)
① 정상 턴(단계 순서·done 모양·toolLog.ask=done 구조화 칸·질문/기록/답 본문이 toolLog·Trace 에 없음·락 해제·traceId 전달·softExtraCheck 없음) ② GENERAL → sources []·count 0(조회가 뭔가 돌려줘도) ③ 기록 의도 0건 → count 0·프롬프트 0건 안내 ④ 규칙 되묻기 단락(LLM 0·조회 0·고정 문장·칩·MEDIUM·shortCircuit) / 칩 답 다음 턴 정상 LLM(직전 질문 의도·칩 범위·출처 CHIP·검색어는 직전 질문) / 직전 되묻기 없으면 scope 무시 / `askPrevFrom` ⑤ 안 실린 키(S9)·다른 type(REVIEW) 키 버림 ⑥ ADD_TOPIC·SCHEDULE_REVIEW·모양 틀린 제안 버림(+`askAllowedProposals` 단위) ⑦ `<script>`·`onerror`·`javascript:`·`data:`·`iframe`·링크/이미지·URL 제거(저장값·done 둘 다) ⑧ 이력 쿼리 where = chatId·userId·DONE(다른 방 0) ⑨ ENGINE_TIMEOUT·서버 예산 초과(LLM abort)·JsonSchemaError·답 없음 → FAILED·error 1회·저장 0·로그에 질문 원문 없음 ⑩ 구독자 없음/구독자 예외에도 저장 완료 ⑪ 음성 입력·발화 id → 수락 전 VALIDATION(수락 0·LLM 0) · `acceptTurnTx` 남의 방 404·VALIDATION 행 0·ASK 미리보기 ≤60 / CHAT 미리보기 불변 · CHAT 방은 기존 경로(ASK 의존 0) · 끊김 복구(resume) ASK 재실행 · 저장 tx 쓰기 순서·조건부 DONE·조건부 제목·CONFLICT.
⑫ **변이 17건**(`/tmp/claude-1000/s2a/mutate.py`): 검출 15 — 규칙 단락 제거·scope 무조건 사용·근거 type 필터 우회·서버 재살균 제거·이력 chatId 조건 제거·제목 기본값 조건 제거·FAILED 기록 누락·되묻기 가드 무력화·수락 tx ASK 검증 제거·ASK 미리보기 120자·GENERAL 건수 0 제거·예산 타이머 무시·startTurn ASK 검증 제거·칩 출처 CHIP→QUESTION·traceId 미전달. 단독 미검출 2 = 제안 종류 검사 두 겹(M4 종류 화이트리스트, M4b SET_LEVEL 분기의 kind 확인) — 각각은 다른 겹이 막는 동치 변이, **둘 다 지우면 검출**.

### 설계-코드 차이 / 결정 근거
1. **규칙 되묻기 단락은 조회도 하지 않는다**(Leader 지시 「LLM 을 부르지 않고 즉시」 + `records.count:0`) — MIXED 문장 선택은 질문 글에 교정·표현 말(교정·고친·틀린·실수·표현·배운·외운)이 있으면 교정 문장, 아니면 공부 기록 문장(`askScopeSentence`).
2. **모델 되묻기 안전망 + 가드**: 범위 출처가 DEFAULT(기간 없음·칩 아님)일 때만 모델 `needsScope` 를 인정. CHIP·QUESTION 인데 모델이 되물으면 `extraCheck` 위반을 하나 더해 **JSON 재시도 1회**(`withScopeGuard`) — 칩을 누른 뒤 또 되묻는 고리를 막는다. 재시도 뒤에도 어기면 ENGINE_ERROR(FAILED, 다시 받기 가능).
3. **서버 예산 170s**(`ASK_TURN_BUDGET_MS`): ASK LLM 120s 에 JSON 재시도가 붙으면 240s 까지 갈 수 있어, 다른 인스턴스가 180s stale 로 정리(→ 늦은 저장 CONFLICT)하기 전에 서버 쪽 AbortController 로 끊는다. 요청 연결의 취소 신호는 연결하지 않는다(끊김 내성). 예산은 LLM 호출 구간만이라 수락~LLM 시작(이력·헤더·조회, 보통 1s 미만)은 별도.
4. **LLM 선행 시작 안 함**: TALK/CHAT 은 수락 커밋과 LLM 을 병렬로 띄우지만 ASK 는 분류·조회가 수락 뒤라 순차(커밋 100~500ms 는 ASK 지연 p50 11s 대비 작다).
5. **fromKst/toKst**: PE 권고대로 THIS_WEEK·LAST_30D 에 채운다 — learning `resolveRange` 가 공개 API 가 아니라 같은 규칙(월~일·오늘 포함 30일)을 `askScopeDates` 로 다시 계산(어긋나면 시험 `askScopeDates` 와 learning 시험이 따로 잡는다 — 공통화는 후속 후보).
6. **GENERAL 건수 0 강제**: 실제 `retrieveRecords` 는 GENERAL 에 0건을 주지만, 조회 결과와 무관하게 `records.count` 를 0 으로 고정(방어).
7. 제안 페이로드 저장 모양: ADD_WORD `{surface,reading,meaning}`(reading 빈 문자열 허용 — CHAT 과 같음) · ADD_STUDY_LOG `{summaryKo}` · SET_LEVEL `{level}`(평가 근거 `basis` 없음 — 채택 경로는 `level` 만 읽는다).
8. 훅: ASK 는 `onAccepted`·`speaker`·`recordSelfCorrection`·`recordCorrectionProposed` 를 부르지 않는다. 끊김 복구(resume)는 요청 `scope` 가 없지만 저장된 칩 글(「이번 주」 등)을 분류기가 기간 답으로 읽어 같은 범위가 된다.

### 남은 의문 (Leader 확인 요청)
1. **화면 충돌 — 규칙 되묻기에 「관련 기록을 못 찾았어요」 줄이 같이 뜰 수 있다**: `src/components/ask/logic.ts` `askAnswerView` 의 `noneLine` = `records.intent≠GENERAL && count===0` 인데, Leader 결정상 단락 답은 `records:{intent, count:0}` 이다. 화면 쪽에 `&& !a.needsScope` 가 필요해 보인다(dev-U 범위 — 내가 고치지 않음).
2. `src/types/ask.ts` `AskSource.id` 가 `string` 이다 — 계약은 `string | null`(집계 항목). 서버는 null 을 보낸다(dev-U 범위).
3. 지시문에는 「티어 review」로 적혀 있으나 코드 `LLM_TASKS.ask` 는 `balanced`(PE 기록도 balanced) — 덮어쓰지 않았다.
4. PE 가 권한 `conversation/index.ts` 의 ask 프롬프트 공개 export 는 하지 않았다(내 범위 밖, 서버는 모듈 내부 import 로 충분). S2b 는 `../orchestrator/ask` 의 `ASK_DEFAULT_TITLE`·`AskMetaDto`·`askMetaFromToolLog` 를 이미 쓰고 있다(확인).
5. 단락 문장·칩 라벨은 Leader 지시 문구 그대로 — 화면 문구 승인(designer)이 따로 필요하면 알려 달라.
