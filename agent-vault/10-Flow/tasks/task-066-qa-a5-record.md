---
project: TheKaiwa
task: task-066
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
  - domain/speech
---
# task-066 QA-A5 기록 — 음성 질문 서버 라이브 검증 (QA, 2026-10-13 10:23~ KST)

> 본 이력서: [[task-066-ask-chatbot-voice]]. 감사: [[task-066-rev-s1-record]](「QA 가 꼭 확인할 것」 1~6)·개발: [[task-066-dev-s1-record]]·프롬프트: [[task-066-pe-record]](`ask@v2`). 앞 실측: [[task-064-qa-a2-record]]·[[task-064-qa-a4-record]]. 환경: 검증 서버 `127.0.0.1:3011`(PID 1752028, `next start`, cwd `~/.node-local/thekaiwa-rev064`, BUILD_ID `lMnBwf9FushnMNfp4SwNu`, APP_ENV=LOCAL — 운영과 별도 프로세스). **QA3(`qa-bot3`)=질문자, QA4(`qa-bot4`)=다른 사용자.** 쿠키·`.env` 값은 기록하지 않는다. **실제 AI(Claude CLI) 호출 합계 ≤8회**(예정 7: 항목1 2 + 항목2 4 + 항목6 1, 여유 1). 같은 서버를 화면 갈래(B5a·B5b)도 쓰므로 지연은 판단하지 않는다.

## ★ 심은 것·정리 방법 (맨 위 고정)

- **시작 값**(10:24 KST, `~/.node-local/thekaiwa-rev064/qa064/a5counts.ts start rooms`) — 정리 뒤 이 값과 대조한다.

| 테이블 | QA3 | QA4 |
|---|---|---|
| Chat (ASK / TALK / CHAT) | 0 (0 / 0 / 0) | 0 (0 / 0 / 0) |
| ChatMessage | 0 | 0 |
| **Utterance / SpeechJob** | **0 / 0** | **0 / 0** |
| WordEntry / TutorProposal / Correction / StudyLog | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| StatsSnapshot / RepetitionItem / LearningObservation | 0 / 0 / 0 | 0 / 0 / 0 |
| AiJob | 0 | 3 (기존) |
| RequestTrace | 29 | 112 |

- 심는 것: QA3 ASK 방(항목 1·2·3·4·5용), QA3 CHAT 방·TALK 방(항목 6), QA4 CHAT 방(항목 6-②의 남의 방). 질문·턴이 만드는 `ChatMessage`·`RequestTrace`·(AI 가 낸) `TutorProposal`. `RequestTrace` 는 방을 지워도 남는 감사 행이라 증가분 = 수락한 턴 수인지만 대조.
- 정리: 만든 방 전부 소유자 쿠키로 앱 `DELETE /api/v1/chats/:id` → `a5counts.ts end` 로 시작 값과 대조. 쿠키·임시 파일 삭제, 내가 띄운 자식 감시 프로세스(`a5watch.mjs`)만 종료. 서버 3011 은 끄지 않는다.
- 도구: 미러 `qa064/a5lib.mjs`(a4lib 복사, PID·쿠키 경로만 교체)·`a5counts.ts`·`a5watch.mjs`(자식 `claude` 감시)·`a5classify.ts`(사전 분류 — 「요즘 내 학습 어땠어?」는 **MIXED·needsScope=false** 라 되묻기 단락이 아니다 → 한도 시험에는 「내 진도 어때?」·「내가 자주 틀린 조사 알려줘」·「내가 틀린 문장들 다 보여줘」(모두 needsScope=true)를 쓴다).

## 진행 기록

### 체크포인트 1 (10:30 KST, 도구 ~30회) — 항목 1·3·4·5 완료, 항목 2 진행

> 하네스 교훈(결함 아님) `[확실]`: `POST /chats/:id/turns` 에는 요청 **본문 검사 전**에 사용자당 고정창 `rateLimit('turn:<userId>', 12)`(분당 12회)가 걸려 있다(`turns/route.ts:76`, `reason` 없는 `429 RATE_LIMITED`). 거절 시험을 22건 몰아 보냈더니 13번째부터 일반 `429`(`reason` 없음, `retryAfterSec` 60)가 나와 **그 구간의 400/ASK_RATE 판정은 무효**로 버리고 창이 풀린 뒤 12건 이하로 나눠 재시험했다(1차 시도 5건 포함 거절 21건 중 12건은 정상 400). ASK 몫(분당 3)은 이 일반 한도와 별개이며 그 구간에 소비된 적 없음(수락 턴 0이었음).

**항목 3 (거절, AI 0) — 전부 PASS** — 모두 SSE 아님·`application/json`·500 0건, 직후 되묻기 단락 질문 3건 수락(항목 4 참조)
| 요청 본문(inputSource / utteranceId) | 상태 | details |
|---|---|---|
| `REALTIME_STT` + 가짜 id | 400 | `{field:'utteranceId', reason:'notAllowed'}` |
| (inputSource 생략) + 가짜 id | 400 | `{field:'utteranceId', reason:'notAllowed'}` |
| `SERVER_STT` | 400 | `{field:'inputSource', reason:'TEXT|REALTIME_STT'}` |
| `SERVER_STT` + 가짜 id | 400 | `{field:'utteranceId', reason:'notAllowed'}` |
| `TEXT` + 가짜 id | 400 | `{field:'inputSource', reason:'REALTIME_STT|SERVER_STT'}` (본문 검사 단계 — 계약 §2-18-A 3항과 일치) |
| `"VOICE"` / `"realtime_stt"`(소문자) / `["REALTIME_STT"]` / `123` / `{}` / `true` / `""` | 400 ×7 | `{field:'inputSource', reason:'REALTIME_STT|SERVER_STT|TEXT'}` |
| `null` + 가짜 id | 400 | `{field:'utteranceId', reason:'notAllowed'}` |
| `REALTIME_STT` + utteranceId `""` / `123` / 41자 / `[id]` | 400 ×4 | `{field:'utteranceId', reason:'id'}` |
| `REALTIME_STT` + text 1,001자 / 빈 문자열 | 400 ×2 | `{field:'text', reason:'length 1~1000' / 'blank'}` |
- `null` 단독(`inputSource:null`, 발화 id 없음)은 **400 이 아니다** — 생략과 같이 `TEXT` 로 읽혀 검증을 통과한다(한도가 찬 상태에서 `429 ASK_RATE` 가 나옴 = 검증 통과 증거). 과제 문구는 「null → 400」 이었으나 REV-S1 이 이미 「null·생략 → 없음으로 읽혀 통과(정상)」 로 적은 기존 동작이고, 발화 id 가 함께 오면 400 이라 우회는 없다 → 결함 아님(관찰 O-1).

**항목 4 (한도 공유, AI 0) — PASS** `[확실]` 직전 거절 5건(400) 뒤 같은 창에서: 단락-1 음성(`REALTIME_STT`) 200 → 단락-2 음성 200 → 단락-3 글자(`inputSource` 생략) 200(셋 다 `accepted→status:PROMPT→done`, `needsScope` 있는 되묻기 문구, LLM 없음) → **4번째 음성 `429 {reason:'ASK_RATE', retryAfterSec:49}`**(창 시작 = 단락-1 수락). 즉 음성 2 + 글자 1 = 3건 수락, 4번째 429 — **음성도 같은 몫**이고 **거절 5건은 몫 0**. 한도가 찬 상태에서도 `utteranceId` 거절은 `400`(검증이 한도보다 먼저) `[확실]`.

**항목 1·5 (창 B, 10:29 KST, AI 2회) — PASS**
| 단계 | 요청 | 결과 |
|---|---|---|
| AI1 | R1 `{text:'大丈夫', inputSource:'REALTIME_STT'}` | 200 SSE `accepted→status:PROMPT→LLM→PARSE→done`, accepted→done 9.9s. `done` 키 7개(userMessageId·assistantMessageId·conversation·correction=null·proposals·audioCount·traceId). `conversation`: replyKo null, **sources [] , confidence HIGH, needsScope null, records {intent GENERAL, count 0}**, 답 297자 |
| AI2 | R1 `{text:'「大丈夫」는 어떤 뜻으로 쓰여?'}`(inputSource 생략) | 200, 10.9s, 답 420자(방 기록 참조 「방금 말씀드린 것처럼」), 제안 0 |
| 409 ×2 (AI2 진행 중 +1.5s) | 같은 사용자 QA3 이 (a) 다른 ASK 방 R7, (b) 같은 방 R1 에 음성 질문 | **409 CONFLICT ×2**(응답 9·6ms, SSE 아님, `details.runningMessageId`=진행 중 강사 메시지 id 일치) |
| 환불 확인 | AI2 `done` 직후 단락 음성 질문 | **200**(몫 3번째 — 수락 2건 + 409 2건이 몫을 안 썼다는 증거: 썼다면 이 요청이 429) → 그다음 음성 질문 `429 ASK_RATE retryAfterSec 36` |
- ①답(AI1) 모양 `[확실]`(직접 읽음): 첫 문장 「大丈夫(だいじょうぶ)」라고 말씀하셨네요(인식 글 인용+읽기) → **뜻** 「괜찮다·문제없다」 → **쓰임**(안부 확인·안심, 거절 「大丈夫です」, 반말/존댓말) → **예문 블록 2개** 「`> 大丈夫ですか。` + 다음 줄 한국어 뜻」(인용 블록 문법, 이전 A2/A4 답과 같은 형태). 링크·HTML 0.
- ② `done.ask` 해당: `conversation.records.intent=GENERAL`, `sources=[]` ✓ (GENERAL 은 sources 항상 빈 배열).
- ③ 저장된 사용자 메시지의 `inputSource`: **DB 직접 조회(`a5db.ts`) `REALTIME_STT`**, 글자 질문은 `TEXT`. #29 상세 DTO(`GET /chats/:id`): 사용자 메시지 `inputSource:'REALTIME_STT', utteranceId:null, audioAvailable:false`(마이크 표지 근거), 강사 메시지 `ask` 4키(sources·confidence·needsScope·records).
- ④ **`Utterance` 0→0, `SpeechJob` 0→0**(QA3·QA4 모두, 음성 질문 전후), DATA_ROOT(`files/thekaiwa`) 아래 시작 시각 이후 **새 파일 0개**, 메시지에 붙은 발화 연결 0.
- ⑤ `RequestTrace`(`TURN`, 단계 `ACCEPT RETRIEVE PROMPT LLM PARSE SAVE`) PROMPT 단계: AI1 **`inputKind:'VOICE'`**, AI2 **`inputKind:'TEXT'`**; Trace 전체 JSON·두 메시지 `toolLog` 에 「大丈夫」 **0건**(질문 본문 없음). `toolLog` 키: traceId·model·connection·llmMs·promptChars·attempt·totalMs·scopeKey·scopeSource·shortCircuit·ask(본문 없음).
- ⑥ **프롬프트 버전 표기는 런타임 산출 어디에도 없다** `[확실]` — 강사 메시지 `toolLog`·Trace 전체 JSON 모두 `ask@v` 문자열 0건(v1 때도 같음, 관찰 O-2). 간접 증거 2가지: (a) 빌드 번들(`.next/server`, BUILD_ID `lMnBwf9FushnMNfp4SwNu`)의 소스맵에 `ask@v2` 6회 포함 (b) 음성 질문 답이 `ask@v2` 특례대로 「첫 문단에 인식 글 「」 인용+읽기」로 시작.
- (창 B 시점 AI 호출 누계 2회 — 최종 대조는 아래 「최종 결과」.)

### 체크포인트 2 (10:33 KST) — 항목 2·6·7 완료, 정리 완료

**항목 2 — 일본어만 들어온 음성 인식 모양 입력 4건 (AI 4회, 각각 별도 ASK 방, `inputSource:'REALTIME_STT'`, 발화 id 없음) — PASS(Low 2건)** `[확실]`(답을 직접 읽음)
| # | 입력 | 한국어 설명 | 읽기 | 뜻·뉘앙스 | 예문 블록 | 링크/HTML | 길이·confidence | 제안 카드 | 동음이의·후보 | 문제점 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | それはちょっと難しいですね | ✓ | ✓ 첫 줄 괄호(むずかしい) | ✓ 「그건 좀 어렵네요」+ **완곡한 거절** 용법, 존댓말·격식 | ✓ 2개 | 0 | 445자 · MEDIUM | 0 | 해당 없음(「다른 뜻으로 말씀하셨다면 난이도 말하는 상황」 한 줄 단서 ✓) | 없음 |
| 2 | きょうはいいてんきですね | ✓ | ✓ 한자 복원 「今日(きょう)はいい天気(てんき)ですね」 | ✓ 「오늘은 날씨가 좋네요」+ 인사말 성격·「ですね」 동의 구하기 | ✓ 2개 | 0 | 363자 · HIGH | 0 | 해당 없음 | 없음 — **문장 점검으로 오독하지 않음**(v1 기준선의 「네, 아주 자연스러운 문장이에요!」 문제 해소) |
| 3 | かみをかしてください | ✓ | ✓ 「紙を貸してください(かみをかしてください)」 | ✓ 「종이를 빌려주세요」+ 〜てください | ✓ 2개 | 0 | 357자 · **MEDIUM** | **ADD_WORD 1개 — surface 가 문장 전체 「紙を貸してください」** | ✓ 「紙(かみ)는 髪(머리카락)·神(신)과 헷갈리기 쉬운데 문맥상 종이가 맞아요」 후보 짚음(첫 해석 1개 + 다른 후보 한 줄) | **(a)** 단어 추가 카드가 **문장 전체**에 붙음 — 아래 QA66-A5-1 **(b)** 「貸(か)す는 빌려주다라는 뜻의 **액션 조각**이고」 — 어색한 말(용어 아님) |
| 4 | お疲れ様でした | ✓ | ✓ 첫 줄 괄호(おつかれさまでした) | ✓ 직장·헤어질 때 쓰임, 「고생하셨어요/수고하셨어요」에 가까움, 「ご苦労様でした」와 대비(윗사람→아랫사람), 보수적 자리 단서 | ✓ 2개 | 0 | 502자 · MEDIUM | 0 | 해당 없음 | 없음(목록 `- ` 사용 — 화이트리스트 노드) |
- 공통: `done.conversation` 키·`records {GENERAL,0}`·`sources []`·`replyKo null`·`correction null`, 답 모두 ≤4,000자(297~502자), `< ]( http javascript: data: onerror iframe ![` 0건, 인용 블록(`>`) 줄 2개씩. 4건 모두 acc→done 9.5~11.2s(참고만 — 지연 판단 안 함).
- 제한(PE 기록 ⒜와 동일) `[확실]`: 입력은 **내가 타이핑한 모의 인식 결과**이고 실제 ReazonSpeech 출력(필러 「えー」·잘못된 한자 변환)은 안 쟀다 → 실기기 10~20건은 미실시.

**항목 6 (회화·채팅 회귀, AI 1회) — PASS**
| # | 요청 | 결과 |
|---|---|---|
| ① | QA3 의 **CHAT 방**, `{"text":"こんにちは","inputSource":"REALTIME_STT"}`(발화 id 없음) | **400** `{field:'utteranceId', reason:'required'}` (회화·채팅은 그대로 거절) |
| ②a | 같은 요청을 **QA4 의 CHAT 방 id** 로 | **404** `{"code":"NOT_FOUND"}` |
| ②b/c | 존재하지 않는 방 id 로 / 남의 방에 **정상 글자 본문** | 둘 다 **404**, 세 응답 본문 **바이트 동일**(71바이트) → 남의 방과 없는 방 구분 불가, 정보 노출 없음(REV-S1 의 400→404 변화 확인) |
| ②e/f | QA4 가 QA3 의 **ASK 방**에 음성 질문 / QA3 의 CHAT 방에 음성 본문 | 둘 다 **404** (음성 질문 수락이 남의 ASK 방으로 새지 않음) |
| ③ | QA3 CHAT 방 글자 턴 `{"text":"こんにちは","inputSource":"TEXT"}` | **200** SSE `accepted→PROMPT→LLM→PARSE→done`(2.3s), `done` 키 11개(conversation{replyJa 15자,replyKo}·correction·learning·speech·endOfTopic·userTranslation·proposals·audioCount·traceId) — 회화·채팅 응답 형태 불변 |
| ④ | QA3 **TALK 방**(앱 API 로 `{kind:'TALK'}` 생성 — LLM 없이 행만 만들어짐), 같은 음성 본문(발화 id 없음) | **400** `{field:'utteranceId', reason:'required'}` |

**항목 7 (누출 검사) — PASS** `[확실]`
- 응답 본문 105건(56,654바이트) 전체 `reazon|whisper|style-bert|claude|qwen|model_id|speaker_id|toolLog|@thekaiwa.test|JWT|DATABASE|thekaiwa_session|sk-ant` **0건**(대소문자 무시). ASK 답 5개 `<`·`](`·`http`·`javascript:`·`data:`·`onerror`·`iframe`·`![` 0건.
- `server.log` 13줄(기동 5 + `[persona]` 1 + `[claudeCli] 완료` 7): 질문·인식 글 조각(大丈夫·難しい·いいてんき·かみを·貸して·お疲れ·진도·틀린·こんにちは·어떤 뜻·조사) **0줄**, `처리되지 않은 예외`·`unhandled`·`abort`·`TypeError`·`ECONN` **0줄**(새 예외 줄 0).
- 끝난 뒤 서버 자식 `claude` **0**(`pgrep -P 1752028`).

**항목 8 (미실시 목록)**
- **`resumePending` 음성 방식 유지(REV-S1 F-7)** — 미실시. ASK 턴을 LLM 없이 실패시킬 방법이 없다(DB 직접 조작 금지). 자식 `claude` 를 도중에 죽여 실패시키면 호출 1회(8번째), 이어받기로 한 번 더 호출(9번째) → 예산 8회 초과라 하지 않았다. 지금 근거는 단위 시험 ⑫-c(목 기반)와 V20(컴파일 타입)뿐.
- 실기기 인식(ReazonSpeech·온디바이스 STT) 10~20건, `inputKind` 표지의 실제 인식 문장 효과 — 미실시(사용자 폰·실기기 몫).
- 하루 60건 한도(`ASK_DAILY`), `ASK_BUSY`(진행 1 + 대기 2) — 미실시(60건 소비·계정 2개로 동시 3건 불가, 이전 A2/A4 와 동일).
- 클라이언트 쪽 `clientTimings` 무시(REV-S1 F-6) 확인 — 미실시(요청 범위 밖).

## 최종 결과 (10:33 KST) — 항목 1~7 실시 · 항목 8 미실시 · **결함 0건(Critical~Medium) · Low 1건 · 관찰 4건**

| 항목 | 판정 | 핵심 근거 |
|---|---|---|
| 1 음성 질문 수락·저장(AI 2) | **PASS** | SSE 정상, 한국어 설명+읽기·뜻·쓰임·예문, GENERAL·sources [], 사용자 메시지 `inputSource=REALTIME_STT`(DB·#29 둘 다), **Utterance 0→0·SpeechJob 0→0·새 파일 0**, Trace PROMPT `inputKind` VOICE/TEXT, 질문 본문 Trace·toolLog 0건 |
| 2 일본어 단독 입력 4건(AI 4) | **PASS (Low 1)** | 4건 모두 한국어 설명·읽기·뜻·예문·링크 0, 동음이의 후보 짚음, 제안 카드 오남용 1건(문장에 ADD_WORD) |
| 3 거절(AI 0) | **PASS** | 서로 다른 거절 본문 19종 전부 400(500 0), 거절은 몫 0. (일반 한도에 가려 재시험 못 한 것: text 숫자·빈 객체 body·비JSON·배열 body 4종 — 미실시) |
| 4 한도 공유(AI 0) | **PASS** | 음성 2 + 글자 1 수락, 4번째 `429 ASK_RATE` — 음성도 같은 몫 |
| 5 409·락 | **PASS** | 진행 중 음성 질문 409 ×2, 몫 환불(이후 단락 음성 질문 수락), 4번째 429 |
| 6 회화·채팅 회귀(AI 1) | **PASS** | CHAT·TALK 음성 본문 400, 남의 방 404(없는 방과 바이트 동일), CHAT 글자 턴 정상 |
| 7 누출 | **PASS** | 응답 105건 0건, 로그 질문 조각 0줄·새 예외 0 |
| 8 미확인 | **미실시** | resumePending(예산)·실기기·하루 60건 |

**결함**
- **[QA66-A5-1] Low** — 음성 질문 답의 **단어 추가 제안 카드가 문장 전체에 붙음**. 재현: ASK 방에 `{text:'かみをかしてください', inputSource:'REALTIME_STT'}` → `proposals:[{kind:'ADD_WORD', payload:{surface:'紙を貸してください', reading:'かみをかしてください', meaning:'종이를 빌려주세요'}}]`(PROPOSED). 기대: 일본어 단독 입력이 **문장**이면 단어 추가 카드를 내지 않음(PE 기록 「문장이면 내지 않는다」 시도는 점화 현상으로 철회). 실제: 4건 중 1건(25%, n=1). 영향: 카드는 사용자가 채택해야만 저장(`WordEntry` 0 확인)이고 문장을 표현으로 단어장에 넣는 것은 허용 동작이라 위험은 낮다. 원인 추정 `[가능성 높음]`: PE 기록에 이미 있는 알려진 한계 — 지시문이 ADD_WORD 를 언급해서 생기는 점화. 서버가 `parseAskResponse` 에서 「표면이 입력 전체와 같은 ADD_WORD」를 막을 수는 있으나 낱말/문장 판정 불가 → 설계 결정(Leader/PE).
- 문체 흠(결함 번호 없음) — 입력 3 답의 「액션 조각」은 어색한 용어. `ask@v2` 프롬프트 튜닝 후보(PE).

**관찰**
- O-1 `inputSource:null`(발화 id 없음)은 400 이 아니라 **생략과 같이 TEXT 로 수락**된다(한도가 찬 상태에서 `429 ASK_RATE` 로 확인). REV-S1 이 「null·생략 → 없음으로 읽혀 통과(정상)」 로 이미 적은 기존 동작이며 발화 id 가 함께 오면 400. 과제 문구의 「null → 400」 과 다르므로 의도 확인용으로 보고.
- O-2 **프롬프트 버전(`ask@v2`)이 런타임 산출물(Trace·`toolLog`·응답)에 남지 않는다.** 어느 버전이 만든 답인지 사후에 알 수 없다(v1 때도 같음, Prompt Registry sync 미구현). 간접 증거만 있다: 빌드 소스맵의 `ask@v2` 6회·답 모양(첫 문단 인식 글 인용). 운영 반영 뒤 롤백·비교 시 버전 구분이 필요하면 `toolLog.ask` 또는 Trace PROMPT 단계에 열거값 추가 필요(후속 후보).
- O-3 **`POST /chats/:id/turns` 에는 본문 검사 전에 사용자당 고정창 분당 12회 한도(`rateLimit('turn:<userId>',12)`, `reason` 없는 일반 429)가 있다** — 거절 요청도 이 몫을 쓴다. ASK 몫(분당 3·`reason:'ASK_RATE'`)과는 별개이고 이번 변경과 무관한 기존 동작. 거절 시험을 한 분에 12건 넘게 보내면 판정이 가려진다(내 1차 시도가 그랬다). 클라이언트에는 영향 없음(일반 사용자는 분당 12턴 못 보냄).
- O-4 **질문 방을 지워도 그 방에서 낸 `PROPOSED` 제안은 남는다**(`TutorProposal.chatId onDelete: SetNull`, 기존 설계 — A3b-3 과 같음). 앱 API 에 제안 삭제 경로가 없어 앱 `POST /proposals/:id/reject` 로 둘 다 `REJECTED` 처리했으나 **행 2개(QA3)는 남았다** → 아래 정리 대조.

### 실제 AI(Claude CLI) 호출 수 대조 (예산 8 이하) — **7회**
| 근거 | 값 |
|---|---|
| 서버 자식 `claude --print` spawn(감시 `a5watch.mjs`, 0.2초 간격) | **7** |
| `server.log` `[claudeCli] 완료` 줄 | **7**(ask 6 + chat 1) |
| `RequestTrace` LLM 단계가 있는 TURN 행(QA3, 시작 이후) | **7**(QA4 0) — QA3 트레이스 총 11건 = 수락 턴 11(단락 3 + AI 2 + 단락 1 + AI 4 + CHAT 1) ✓ |
| 내역 | 항목1 2(음성 大丈夫, 글자 질문) · 항목2 4 · 항목6 CHAT 1 · 항목5 추가 0 |
- 같은 서버를 쓰는 다른 갈래(B5a·B5b)의 AI 호출은 이 기간 spawn 감시·로그에 **0**(전부 내 호출).

### 정리 대조 (10:34 KST)
| 테이블 | QA3 시작→끝 | QA4 시작→끝 |
|---|---|---|
| Chat (ASK/TALK/CHAT) | 0 → 0 | 0 → 0 |
| ChatMessage | 0 → 0 | 0 → 0 |
| **Utterance / SpeechJob** | **0/0 → 0/0** | **0/0 → 0/0** |
| WordEntry / Correction / StudyLog / StatsSnapshot | 0 → 0 | 0 → 0 |
| RepetitionItem / LearningObservation / AiJob | 0 → 0 | AiJob 3 → 3 (기존) |
| **TutorProposal** | **0 → 2 (REJECTED)** ← 앱 API 에 삭제 경로가 없어 남음. id 끝 6자리 `m2kn9r`(ADD_WORD 大丈夫)·`taw6fj`(ADD_WORD 紙を貸してください) | 0 → 0 |
| RequestTrace | 29 → 40 (+11 = 수락 턴 11) | 112 → 112 |
- 만든 방 10개(QA3 9 + QA4 1) 전부 앱 `DELETE` → 200, 이후 `GET` 404. DATA_ROOT 새 파일 0.
- 쿠키·응답 로그·답 JSON 이 든 임시 폴더(`scratchpad/q064/a5`) 삭제, 자식 감시 프로세스(PID 1764207) 종료, 남은 `a5*` 프로세스 0. 서버 3011(PID 1752028)은 그대로 둠. 미러 `qa064/a5*.mjs|ts` 보조 스크립트는 남김(경로만 기록, 쿠키 값 없음).
- **남은 행(Leader 몫)**: QA3 `TutorProposal` 2개(REJECTED). 직접 삭제는 「DB 는 앱 API 로만」 지시로 하지 않았다. 지우려면 A3b 때처럼 id 지정 `deleteMany` 가 필요하다.
