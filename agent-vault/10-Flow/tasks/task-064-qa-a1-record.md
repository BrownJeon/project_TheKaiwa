---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-A1 기록 — ASK API 계약 검증 (QA, 2026-10-12 19:30~ KST)

> 본 이력서: [[task-064-ask-anything-3a]]. 계약 `docs/design/api-contract.md` §2-18-A. 환경: 검증 서버 `127.0.0.1:3011`(PID 789803, `next start`, cwd `~/.node-local/thekaiwa-rev064`, APP_ENV=LOCAL). **QA1(`qa-bot@thekaiwa.test`)=질문하는 사용자, QA4(`qa-bot4@thekaiwa.test`)=타인(IDOR)** 만 사용. 쿠키·`.env` 값은 기록하지 않는다. LLM(`claude --print`)을 부르는 요청은 0건이 목표 — 되묻기 단락 질문과 400/404 거절 요청만 쓴다.

## ★ 심은 것·정리 방법 (맨 위 고정)

- **시작 값**(19:29 KST, `qa064/a1counts.ts start rooms`) — 정리 뒤 이 값과 대조한다.

| 테이블 | QA1 | QA4 |
|---|---|---|
| Chat 합계 (ASK / TALK / CHAT) | 3 (0 / 0 / 3) | 0 (0 / 0 / 0) |
| ChatMessage | 64 | 0 |
| TutorProposal / Correction / WordEntry | 8 / 5 / 0 | 0 / 0 / 0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0 / 3 / 0 | 0 / 0 / 0 |
| AiJob | 14 | 3 |
| LearningObservation | 453 | 0 |
| RequestTrace | 281 | 102 |

  QA1 의 기존 CHAT 방 3개(`週末🎉の話😀` 22건·`새 채팅` 0건·`잡 경로` 42건)는 **손대지 않는다**. 
- 심는 것: QA1·QA4 의 ASK 방(앱 `POST /api/v1/chats`), 제한 시험용 CHAT·TALK 빈 방 각 1(삭제 대상), 되묻기 단락 질문으로 생기는 `ChatMessage`·`RequestTrace`(턴마다 1행). **`RequestTrace` 는 방을 지워도 남는 감사 행이라 시작 값으로 안 돌아온다 — 증가분 = 수락한 턴 수인지만 대조한다.** 
- 정리: 만든 방 전부 소유자 쿠키로 `DELETE /api/v1/chats/:id`(앱 API) → `qa064/a1counts.ts end` 로 Chat·ChatMessage·TutorProposal 이 시작 값과 같아졌는지 대조. 쿠키 파일(scratchpad `q064/a1/`) 삭제. 미러 `~/.node-local/thekaiwa-rev064/qa064/` 의 보조 스크립트는 남긴다(경로만 기록).
- 도구: 미러 `qa064/a1counts.ts`(행 수) · `qa064/a1http.mjs`(HTTP 시험 본체).

## 체크포인트 1 (19:35 KST, 도구 ~40회)

- **완료**: 1.인증(401 10건) · 2.방 만들기·목록(57건 PASS) · 3.턴 본문 검증 400(11건 + 순서 4건) · 4.되묻기 단락 SSE·저장 형태(3건 수락) · 5.분당 한도(4번째 `429 ASK_RATE` retryAfterSec=55·Retry-After 헤더 일치·창 풀린 뒤 재수락 200·슬롯 해제 확인) · 8.저장·표시(제목·preview·ask 4키) · 11.끊김(accepted+PROMPT 까지 읽고 끊어도 질문·답 완주 저장). 지금까지 FAIL 0, `server.log` 신규 줄 0, `claude --print` 프로세스 0.
- **남은 일**: 6.다른 종류 라우트 차단(translation·review·finish·phrase-help·reply-practice, CHAT/TALK 방 `scope` 400) · 7.IDOR 양방향 매트릭스 · 9.누출 grep · 10.서버 로그 · 정리·대조.
- **다음 첫 명령**: `cd ~/.node-local/thekaiwa-rev064 && node qa064/a1p5.mjs` (없으면 p5 부터 새로 작성). 상태 파일 scratchpad `q064/a1/state.json`(방 id·만든 방 목록 `created`), 응답 로그 `q064/a1/responses.ndjson`(누출 grep 재료), 결과 `results.ndjson`.
- **주의점**: QA1 일반 턴 한도 분당 12(거절 요청도 센다) — `a1lib.mjs` 의 `pace()` 가 11건/61초로 늦춘다. 서버 3011 은 끄지 않는다.
- **미정리 행**: QA1 ASK 방 A·B·C·D·+(공백제목·100자·XSS제목) + CHAT·TALK 빈 방 각 1, QA4 ASK 방 R4 — 전부 `state.json.created` 에 있고 마지막에 앱 DELETE 로 지운다.

## 최종 결과 (19:41 KST) — 요청 약 200건, 확인 204건 중 203 PASS · 1 도구 한계(재시도 PASS) · **제품 결함 0건**

> 실행: 미러 `~/.node-local/thekaiwa-rev064/qa064/{a1lib.mjs,a1p1~p8b.mjs,a1cleanup.mjs}`(HTTP) · `a1counts.ts`·`a1db.ts`·`a1classify.ts`(읽기 전용 DB·분류 사전 확인). 서버 3011(PID 789803)은 끄지 않았다. 쓴 계정 = QA1·QA4 뿐, 127.0.0.1 직접 요청만.

| # | 항목 | 요청 → 결과 | 판정 |
|---|---|---|---|
| 1 | 인증 | 쿠키 없음 8종(방 만들기·목록·턴·상세·제목·삭제·점검·번역) + 쓰레기 쿠키 2종 → 전부 401 `UNAUTHENTICATED` | PASS |
| 2 | 방 만들기·목록 | `{kind:"ASK"}` → 200(응답 11키, 「새 질문」·빈 방·`running:false`·`topic:null`·`scenario` 키 없음). 거절 20종(빈 객체·잘못된 kind·`topicId/scenarioId/lessonId/level/voice/inputSource/foo:null/__proto__` 금지 키·제목 숫자·101자·배열·문자열·깨진 JSON·64KB 초과·빈 본문) 전부 400 `VALIDATION`+`field`/`reason`, 거절이 방을 만들지 않음. 제목 100자 허용·공백만=「새 질문」·XSS 문자열은 글자 그대로. 목록 `?kind=ASK` 는 ASK 만, `kind=TALK`·`CHAT` 에 ASK 0건, `kind` 생략은 종류 혼재(항목마다 `kind` 표기), `kind=BOGUS/ask`·잘못된 커서·`limit=0/1000/abc` 는 400, 정렬 `lastMessageAt desc`, 커서 쪽 넘김 겹침 없음 | PASS |
| 3 | 턴 본문·순서 | 400 11종(text 없음·빈 문자열·공백만·숫자·**1001자**·`inputSource` BOGUS·ASK+`utteranceId`·ASK+`SERVER_STT`·TEXT+`utteranceId`·`scope.key` BOGUS·`scope` 문자열) + 추가 9종(`scope` {}·{key:5}·[]·소문자, `resumePending:"yes"`, `clientTimings.sttMs:-1`, 배열 본문, 깨진 JSON, 16KB 초과) 전부 400 `field` 일치. **1000자(경계) 수락**, CHAT·TALK 방에 `scope`(유효·무효 키) → 400 `reason:"ASK"`. 순서: 없는 방+빈 본문=400(본문 먼저), 없는 방+정상=404, 내 ASK 방+음성=400(종류별), **한도 소진 중에도 400/404 가 429 보다 먼저**. 거절 4건 직후 정상 3건 연속 수락 | PASS |
| 4 | 되묻기 단락(LLM 0) | `accepted → status{PROMPT} → done` 만(LLM·PARSE·TTS·audio 없음), `done` = {userMessageId, assistantMessageId, conversation{answerMd, replyKo:null, sources:[], confidence:MEDIUM, needsScope{prompt==answerMd, options:[THIS_WEEK 이번 주·LAST_30D 지난 30일·ALL 전체 기간]}, records{intent, count:0}}, correction:null, proposals:[], audioCount:0, traceId}. intent: 「내 진도 어때?」=PROGRESS · 「내가 자주 틀린 조사 알려줘」=EXPRESSION · 1000자 패딩=PROGRESS. 저장 상세에 같은 `ask`(sources·confidence·needsScope·records 4키) | PASS |
| 5 | 분당 한도 | 같은 사용자 1분 안 3건 수락, **4번째 `429 RATE_LIMITED` `details:{reason:"ASK_RATE", retryAfterSec:55}`** + `Retry-After: 55` 헤더(일치), SSE 아님. 본문에 질문 원문·방 id·사용자 id·이메일 없음. 약 60초 뒤 재수락 200(앞선 슬롯 해제 확인 = `ASK_BUSY` 아님). 동시 2건 → 200+409(`CONFLICT`)이고 **409 가 몫을 되돌림**(이후 2건 연속 수락, 그다음 4번째만 429). 하루 60건·`ASK_BUSY` 는 미실시 | PASS / **미실시**(아래) |
| 6 | 다른 종류 라우트 | ASK 방: 번역(USER·ASSISTANT 메시지) 400 `reason:"kind"` · 점검 400 `reason:"kind"` · 상황 마치기 400 `reason:"not_scenario"` · 도우미·대답 연습 **404**(서비스 자체 검사 — 계약 3-A 마지막 문장 「이미 TALK/CHAT 이 아니면 거절하는 라우트는 그대로」와 일치). 없는 메시지·남의 방은 404(400 이 아님), 500자 id 404 | PASS |
| 7 | 격리(IDOR) | QA4→QA1 방 GET·`after=`·PATCH·DELETE·턴·번역·점검·마치기·도우미·대답 연습 → 전부 404, 공격 뒤 QA1 방 제목·메시지 6건 그대로. QA1→QA4 방 대칭 전부 404, QA4 방 그대로. 양쪽 목록(`kind=ASK`·생략)에 남의 방 0건, QA1 커서를 QA4 가 써도 QA4 방만. 이상한 id(500자·SQL 조각·`../`·`%00`) 404/500 아님 | PASS |
| 8 | 저장·표시 | USER `content`=보낸 질문(1000자 포함 바이트 일치)·`inputSource:"TEXT"`·`translation:null`·`utteranceId:null`, ASSISTANT `content`=`answerMd`·`ask` 4키·`translation/reading/learning/speechStyle` null·`traceId`=done.traceId, 응답에 `toolLog`·모델·연결·`shortCircuit` 없음, `?after=` 폴링 OK. 방 제목=첫 질문(XSS 질문은 `<img src=x onerror=alert(1)> …` 30자 — 줄임표 포함), 명시 제목 방은 유지, PATCH 제목 변경 200(정리)·빈/공백/101자/숫자/없음 400. 진행 중: 목록 `running:true`·`preview`=첫 질문, 상세 PENDING 강사 행 `ask:null`·`content:""`·`chat.running:true`, 끝나면 `preview`=답 첫 줄 | PASS |
| 9 | 응답 누출 | 응답 본문 196건(SSE 포함, 89KB) grep `reazon|whisper|style-bert|sbv2|claude|qwen|ollama|model_id|speaker_id|toolLog|@thekaiwa.test|DATABASE_URL|JWT` **0건**, QA1·QA4 userId 문자열 0건, 계약 밖 키(`userId·environment·connection·promptChars·llmMs·shortCircuit·scopeKey` 등) 0건 | PASS |
| 10 | 서버 로그 | `server.log` 152바이트·5줄 그대로(기동 줄만) — 질문 조각 11종(「진도」「틀린」「조사」「onerror」「<img」…) 0줄, `처리되지 않은 예외` 0, `Unhandled|TypeError` 0, `[ask]`·`[api]`·Error 0, 쿠키·토큰 0. 추가: `ChatMessage.toolLog`(ASK 답) 키 = `ask,attempt,connection,llmMs,model,promptChars,scopeKey,scopeSource,shortCircuit,totalMs,traceId`·질문 조각 0건, `RequestTrace` TURN 15행 단계 = `ACCEPT·PROMPT·SAVE` 뿐(LLM 단계 0)·질문 조각 0건 | PASS |
| 11 | 끊김 내성 | ① `accepted`+`status:PROMPT` 까지만 읽고 끊기 → 질문·답 2건 DONE·`running:false` ② 응답 헤더만 받고 즉시 끊기 → 질문·답 완주 저장 ③ 끊긴 뒤 같은 사용자 다음 ASK 턴 200(락 해제, 409 아님). 서버 로그 새 줄 0 | PASS |

### 관찰·참고 (결함 아님 — 계약 문구와의 차이를 Leader 가 알고 있으면 된다)
- **O-1 (Info)** `POST /chats` 성공 상태는 ASK·CHAT·TALK 모두 HTTP 200(요청서는 201 로 적었으나 계약 #28 은 상태 코드를 쓰지 않고 `ok()` 공통 봉투가 200).
- **O-2 (Info)** `kind` 생략 `GET /chats` 는 TALK·CHAT·ASK 가 한 목록(항목마다 `kind`). 「섞이지 않는다」는 `?kind=ASK` 필터 기준 — 질문 탭 화면이 반드시 `kind=ASK` 를 보내야 한다(코드 확인은 UI 레인 몫).
- **O-3 (Info)** 동시 턴 `409` 의 `details.runningMessageId` 가 `null` — 먼저 도착한 턴의 강사 행이 아직 없을 때(메모리 락) `turnConflict(null)` 설계(orchestrator/index.ts:116), TALK·CHAT 과 동일, 계약 #32 예시는 `"m_…"`.
- **O-4 (Info)** 계약 §2-18-A 3-A 첫 문장은 「표현 점검·도우미·대답 연습·상황 마치기·번역은 ASK 이면 400」이나 도우미·대답 연습은 실제 404(같은 항 마지막 문장이 이를 허용). 문구 정리 후보.
- **O-5 (Info)** 방 제목 자르기는 `truncateCodePoints` 라 「앞 29자 + …」(총 30자). 계약 「앞 30자」와 한 글자 차이.
- **O-6 (Info)** 일반 턴 한도 `rateLimit('turn:<user>', 12)`(분당 12)는 본문 400·404 거절도 센다(ASK 몫과 별개, 계약 #32 「분당 12턴」). ASK 몫(분당 3·하루 60)은 거절이 쓰지 않음을 확인.
- **A1-21c (도구 한계, 제품 아님)** 첫 폴링(목록+상세 동시, 샘플 간 ~0.5s)이 PENDING 구간(~0.6s)을 못 잡아 FAIL 로 기록됐고, 상세만 촘촘히 폴링한 A1-22a 에서 PASS(PENDING 샘플 6개: `ask:null`·`content:""`·`running:true`).

### 미실시 (이유)
- **하루 60건 한도(`ASK_DAILY`)** — 요청대로 라이브 미실시(시험이 덮음). 하루 한도 `retryAfterSec ≥ 3601` 하한도 미확인.
- **`ASK_BUSY`(진행 1+대기 2 초과)** — 검증 계정이 2개뿐이고 사용자당 락 때문에 동시 ASK 가 최대 2건, 단락 턴은 ~1초에 끝나 슬롯 3개를 채울 수 없다. LLM 을 타는 긴 턴 3건 이상이 필요해 LLM 0 원칙과 충돌 → 단위 시험 몫.
- **칩 `scope` 를 쓴 두 번째 턴(범위 결합 조회)·GENERAL 질문·제안 카드·출처 카드** — 전부 LLM 단계로 가서 보내지 않았다(`scope` 는 형식 검증 400 경계와 「직전 되묻기 없으면 무시」(A1-15a)까지만).
- **`resumePending:true` 복구** — 저장된 질문을 다시 돌려 LLM 로 이어질 수 있어 보내지 않았다.
- **ASK 실패(`FAILED`) 뒤 preview·긴 LLM 답의 preview 60자 줄임** — 실패 유발 수단·긴 LLM 답이 필요해 미실시(단락 고정 문장은 33자).

### 정리 대조 (19:41)
| 테이블 | QA1 시작→끝 | QA4 시작→끝 |
|---|---|---|
| Chat (ASK/TALK/CHAT) | 3 (0/0/3) → 3 (0/0/3) | 0 → 0 |
| ChatMessage | 64 → 64 | 0 → 0 |
| TutorProposal / Correction / WordEntry | 8/5/0 → 8/5/0 | 0/0/0 → 0/0/0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0/3/0 → 0/3/0 | 0/0/0 → 0/0/0 |
| AiJob / LearningObservation | 14/453 → 14/453 | 3/0 → 3/0 |
| RequestTrace | 281 → 295 (**+14 = 수락한 턴 14건**) | 102 → 103 (+1 = 수락 1건) |

- 방 12개(QA1 11, QA4 1) 전부 소유자 쿠키 앱 `DELETE /api/v1/chats/:id` → `{deleted:true}`, 이후 GET 404. QA1 의 기존 CHAT 방 3개는 손대지 않음. `RequestTrace` 증가분은 방 삭제와 무관하게 남는 감사 행(정상, 질문 조각 0건 확인).
- **LLM 단계로 샌 요청: 0건** — 수락한 15턴 모두 SSE `status` 가 `PROMPT` 뿐, `RequestTrace` 단계에 `LLM` 없음, 검증 중 `claude --print` 프로세스 0(수시 `ps` 확인).
- 쿠키 파일(scratchpad `q064/a1/c1·c4`)·응답 로그·상태 파일 삭제. 미러 `qa064/` 보조 스크립트는 남김. 서버 3011 유지(Leader 가 끈다).
