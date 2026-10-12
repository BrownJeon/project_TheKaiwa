---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-A2 기록 — 라이브 실측(지연 간섭·끊김 완주·409·한도 몫) (QA, 2026-10-12 19:43~ KST)

> 본 이력서: [[task-064-ask-anything-3a]]. 앞 갈래: [[task-064-qa-a1-record]](ASK API 계약, LLM 0). 환경: 검증 서버 `127.0.0.1:3011`(PID 789803, `next start`, cwd `~/.node-local/thekaiwa-rev064`, APP_ENV=LOCAL — 운영과 **별도 프로세스**라 CLI 줄(`interactive` 큐, 동시성 1)도 별도). **QA3(`qa-bot3@thekaiwa.test`)=질문하는 사용자, QA4(`qa-bot4@thekaiwa.test`)=다른 사용자(채팅 턴)**. 쿠키·`.env` 값은 기록하지 않는다. **실제 AI(Claude CLI) 호출 합계 ≤14회**(E1 2 + E2 1 + E3 4 + E4 2~3 + E5 1 + E6 1 = 11~12 예정).

## ★ 심은 것·정리 방법 (맨 위 고정)

- **시작 값**(19:43 KST, `~/.node-local/thekaiwa-rev064/qa064/a2counts.ts start rooms`) — 정리 뒤 이 값과 대조한다.

| 테이블 | QA3 | QA4 |
|---|---|---|
| Chat (ASK / TALK / CHAT) | 0 (0 / 0 / 0) | 0 (0 / 0 / 0) |
| ChatMessage | 0 | 0 |
| TutorProposal / Correction / WordEntry | 0 / 0 / 0 | 0 / 0 / 0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0 / 0 / 0 | 0 / 0 / 0 |
| AiJob / LearningObservation | 0 / 0 | 3 / 0 |
| RequestTrace | 1 | 103 |

- 심는 것: QA3 ASK 방 R1·R2, QA4 CHAT 방 C1, (E4) QA3 새 CHAT 방 1(409 시험용 — AI 0), 질문·턴이 만드는 `ChatMessage`·`RequestTrace`·(AI 가 낸) `TutorProposal`. **`RequestTrace` 는 방을 지워도 남는 감사 행이라 시작 값으로 안 돌아온다 — 증가분 = 수락한 턴 수인지만 대조한다.** `LearningObservation`·`AiJob` 은 CHAT 턴 뒤 훅이 만들 수 있다(정리 때 증가분을 따로 적는다).
- 정리: 만든 방 전부 소유자 쿠키로 앱 `DELETE /api/v1/chats/:id` → `a2counts.ts end` 로 Chat·ChatMessage·TutorProposal 이 시작 값과 같아졌는지 대조. 쿠키 파일(scratchpad `q064/a2/`) 삭제. 미러 `qa064/` 보조 스크립트는 남긴다(경로만 기록). 서버 3011 은 끄지 않는다.
- 도구: 미러 `qa064/a2lib.mjs`(SSE 시각 측정 도우미)·`a2counts.ts`·`a2classify.ts`(질문 문장의 규칙 분류를 LLM 없이 사전 확인 — 12문장 모두 `GENERAL`, 되묻기 아님).

## 측정표 (E1~E4, 19:47~19:52 KST) — 시각은 서버 3011 로컬, 전부 직접 잰 값 `[확실]`

> 방법: 미러 `qa064/a2lib.mjs` 가 SSE 를 읽으며 이벤트마다 `Date.now()`(ms)를 찍는다. CLI 자식 프로세스는 `qa064/a2watch.mjs`(0.15초 간격 `pgrep -P 789803`)가 spawn/exit 를 따로 기록 — **실제 AI 호출 수 = 자식 `claude --print` spawn 수**(서버 로그 `[claudeCli] 완료` 줄과도 일치). 서버 로그 `warm=OFF`(예열 풀 꺼짐 — 모든 호출이 콜드 spawn).

| 실험 | 시도 | 요청 방 | accepted ms | 첫 status/delta | done ms (보낸 때 기준) | accepted→done (s) | 비고 |
|---|---|---|---|---|---|---|---|
| E1 CHAT 단독 | 1 | QA4 C1 | 191 | status PROMPT·LLM 191, PARSE 3,704 (delta 없음) | 4,002 | **3.81** | CLI 프로세스 수명 3,532ms |
| E1 CHAT 단독 | 2 | QA4 C1 | 391 | LLM 391, PARSE 3,416 | 3,543 | **3.15** | CLI 3,388ms. 기준선 평균 **3.48s** |
| E2 ASK 단독 | 1 | QA3 R1 | 492 | PROMPT 492 → LLM 544 → PARSE 13,243 | 13,747 | **13.26** | 답 576자·GENERAL·HIGH·sources 0·needsScope 없음·proposals 0. 상세 저장 `ask` 4키, `content==answerMd` |
| E3-1 ASK(간섭 중) | 1 | QA3 R1 | 503 | LLM 1,066 → PARSE 12,990 | 13,126 | **12.62** | 답 625자·CLI 12,538ms |
| E3-1 CHAT(ASK accepted 후 2.0s 뒤 전송) | 1 | QA4 C1 | **117 (전송 후)** | PROMPT·LLM 즉시, PARSE 16,387 | 16,520 | **13.90** | 추가 대기 **+10.4s**(기준 3.48 대비). ASK `done` 뒤 3.39s 만에 CHAT `done` |
| E3-2 ASK(간섭 중) | 2 | QA3 R1 | 538 | LLM 593 → PARSE 15,320 | 15,450 | **14.91** | 답 697자 |
| E3-2 CHAT(2.0s 뒤 전송) | 2 | QA4 C1 | **528 (전송 후)** | PARSE 18,670 | 18,800 | **15.73** | 추가 대기 **+12.3s**. ASK `done` 뒤 3.35s |
| E4 진행 턴(ASK) | 1 | QA3 R1 | 657 | LLM 1,029 → PARSE 15,236 | 15,701 | **15.04** | 답 709자 |

**E1~E3 읽기 `[확실]`**
- **큐 대기는 `accepted` 뒤, `LLM` 단계 안에서 생긴다.** CHAT 은 전송 후 117~528ms 에 `accepted`·`PROMPT`·`LLM` 상태를 곧바로 받고(화면에는 「답 만드는 중」이 바로 뜬다) 그 상태로 ASK 가 끝나기를 기다린다. 사용자가 보는 건 「멈춘 것처럼 보이는 LLM 단계」 10~12초.
- **직렬 확인**: 자식 프로세스 기록 — E3-1 에서 ASK 의 `claude`(12,020ms 산 프로세스)가 죽은 순간(+245.32s)에 CHAT 의 `claude` 가 뜸(다음 폴 간격 0.15초 안), E3-2 도 ASK(14,759ms)가 죽는 순간(+275.15s) CHAT spawn. 겹침 0. 즉 **CHAT 의 추가 대기 ≈ 「ASK 남은 시간」(= ASK LLM 시간 − 2s 끼어든 시각)**.
- **fail-fast 안 걸림**: 두 번 모두 CHAT 이 `error` 없이 `done`. 어댑터의 20s 상한은 프로세스를 띄운 뒤부터 세므로(큐 대기 제외 — `claudeCli.ts` `collect`) 큐에서 10~12초 기다려도 실패하지 않았다. 다만 **ASK 가 길어지면(예: 20초+) 대기도 그만큼 늘 뿐 실패는 아님**, 회화(TALK) 12s 도 같은 구조일 것으로 `[추측]`(TALK 는 이번에 안 돌림).
- **E3 위험 요약**: ASK 1건 동안 다른 사용자의 짧은 CHAT 이 ~3.5s → ~14~16s 로 4~5배. 사용자당 락·전역 `ASK_MAX_INFLIGHT=3`(진행1+대기2)이 있어도 **최악은 ASK 3건 연속(~13s×3) 뒤에 CHAT 이 서는 ~40s+** `[가능성 높음]`(직접 측정하진 않음 — 계정 2개로 ASK 3건 동시 불가).

**E4 `[확실]`**
- 진행 턴(ASK, R1 accepted +0 → done +15.0s) 중 +1.5s 에 같은 사용자 QA3 이: (i) R2 에 ASK, (ii) 새 CHAT 방에 CHAT 턴, (iii) R1(같은 방)에 ASK 를 보냄 → **셋 다 `409 CONFLICT`**(응답 6~9ms, SSE 아님, `details:{runningMessageId:"<진행 중인 강사 메시지 id>"}` — A1 O-3 때(`null`)와 달리 이번엔 PENDING 행이 이미 있어 실제 id. 계약 §2-18-A 3·#32 와 일치).
- **한도 몫(M6f)**: 진행 턴 끝나자마자(+15s) 되묻기 단락 질문 연달아: 단락-1 `200`(accepted→PROMPT→done, 986ms), 단락-2 `200`(1,382ms), **단락-3 `429 RATE_LIMITED {reason:"ASK_RATE", retryAfterSec:43}` + `Retry-After: 43`**(창 시작=진행 턴 수락 후 17.4s 시점 → 60−17.4=42.6→43 정확히 일치). 곧 **진행 턴 1 + 단락 2 = 3건 수락, 4번째 시도(단락-3)가 429** — 409 로 거절된 3건은 몫을 쓰지 않았다(환불 PASS). 창(60초) 안에서 판정함(진행 턴 수락부터 17.4초) — 「창 초과로 판정 불가」 아님.

## E5·E6 측정 (19:52~19:53 KST) `[확실]`

**E5 끊김 완주** — QA3 가 R2 에 「〜かもしれない 와 〜だろう」 질문 → `accepted`(+0.79s) 받자마자 연결 종료(응답 본문 더 안 읽음). 5초 간격 `GET` + 같은 사용자의 다음 턴 프로브(되묻기 단락 질문 — 풀리면 AI 0 으로 수락):

| 경과(끊은 뒤) | 상세 `GET` | 프로브(같은 사용자 ASK 턴) |
|---|---|---|
| 5.0s | 강사 행 `PENDING`·`content ""`·`ask` 없음·`chat.running:true` | **409** `CONFLICT {runningMessageId: 진행 중 강사 id}` |
| 10.0s | 동일(PENDING) | **409** |
| 15.1s | 강사 행 **`DONE`**·504자·`ask`(conf HIGH, sources 0)·`running:false` | **200**(락 풀림 → 단락 질문 수락) |

- 서버는 끊긴 뒤에도 끝까지 실행·저장: `RequestTrace` TURN 행 저장 시각 19:52:24.0·`totalMs` 12,141(`LLM` 10,373ms) → **끊은 시점 기준 약 11~12초 뒤 저장**, 5초 간격 폴링의 해상도(10~15s) 안과 일치. 락 해제는 저장 직후(프로브 10s 409 → 15.1s 200).
- `server.log` 새 오류 줄 **0**(끊김 때문에 생긴 줄 없음 — `처리되지 않은 예외`·`abort`·`Error` 0).
- (참고) 1차 시도는 E4 직후 1분 창이 안 풀려 `429 ASK_RATE {retryAfterSec:17}` 로 **수락 전 거절** → AI 0, 몫 소비 0. 이 429 자체도 계약대로 SSE 아님·`Retry-After` 일치.

**E6 사후 점검**
1. **살균 실물**: 일반 질문 LLM 답 5개(576·625·697·709·504자) 전부 `<`·`](`·`http`·`javascript:`·`data:`·`onerror`·`iframe`·`![` **0건**. 모양은 마크다운 화이트리스트 안(굵게 1~2쌍, 인용 `>` 2~3줄, 문단) — 5개 모두 일본어 예문을 `>` 인용 블록으로 쓰는 패턴. 응답 본문 전체 grep(32개 응답, 34,647바이트: `reazon|whisper|style-bert|claude|qwen|model_id|speaker_id|toolLog|@thekaiwa.test|JWT|DATABASE|thekaiwa_session|sk-ant|.env`) **0건**.
2. **서버 로그**: 16줄(기동 5 + `[persona]` 1 + `[claudeCli] 완료 — task=… model=… promptChars=… elapsed=… warm=OFF` 10). 질문 조각(「お疲れ」「ありがとう」「食べ」「すみません」「かもしれ」「진도」「틀린」「こんにちは」)·쿠키 **0줄**, `처리되지 않은 예외`·`error`·`Unhandled`·`abort` **0**. 로그에는 task·모델 티어·프롬프트 글자 수·시간만 남는다.
3. **자식 `claude` 프로세스**: 실험 직후·5초 뒤·마지막 CHAT 5초 뒤 모두 `pgrep -P 789803` **0건**(예열 풀도 꺼져 있음 `warm=OFF`). spawn 10 = exit 10.
4. **큐 해제**: 마지막 CHAT(QA4) accepted→done **4.04s**(LLM 단계 3,525ms) — 기준선 3.15~3.81s 와 같은 수준(저장 657ms 가 조금 길어 총 4.04).

## 최종 결과 (19:54 KST) — 실험 E0~E6 전부 실시 · **제품 결함 0건**(기능 결함 없음) · 관찰 5건 · **실제 AI 호출 10회**

> 실제 AI 호출 수 대조(요청 14 이하): 자식 `claude --print` spawn **10** = 서버 로그 `[claudeCli] 완료` **10** = `RequestTrace` 에서 `LLM` 단계가 있는 TURN 행 **10**(QA3 5 + QA4 5). 내역: E1 2 · E2 1 · E3 4 · E4 1 · E5 1 · E6 1. 예산(11~12) 안.

### 핵심 숫자 (accepted→done)
| 항목 | 값 |
|---|---|
| **CHAT 단독(기준선)** | 3.81s · 3.15s · (E6) 4.04s → 평균 3.5s (CLI 프로세스 수명 3.4~3.5s, haiku) |
| **ASK 단독** | 13.26s(E2) · 15.04s(E4) · 12.1s(E5 trace) — 답 504~709자, sonnet, CLI 10.4~14.7s |
| **ASK 실행 중 다른 사용자의 CHAT** | **13.90s · 15.73s**(= 기준선 대비 **추가 대기 +10.4s · +12.3s**), 모두 성공 `done`, **fail-fast 오류 0** |
| ASK 자신 | 간섭 중 12.62s · 14.91s — 기준선과 차이 없음(CHAT 이 ASK 를 늦추지 않음, 대기는 CHAT 쪽) |
| 큐 직렬 | ASK 의 `claude` 가 죽는 순간 CHAT 의 `claude` 가 뜸(겹침 0, 폴 간격 0.15s 안) |
| 큐 대기가 보이는 자리 | `accepted` 뒤 **`LLM` 단계 안**(CHAT `accepted`·`PROMPT`·`LLM` 은 전송 후 0.1~0.5s 에 도착 → 화면은 「답 만드는 중」 상태로 10~12s 정지) |

### 판정
| 실험 | 판정 | 근거 |
|---|---|---|
| E0 방 만들기 | PASS | ASK 2 + CHAT 1 → 200 |
| E1 CHAT 기준선 ×2 | PASS | 3.81 / 3.15s |
| E2 ASK 기준선 | PASS | 13.26s, 답 576자, `done.conversation` 키 6개(answerMd·replyKo:null·sources[]·confidence·needsScope·records{intent:GENERAL,count:0}), `correction:null`·`proposals:[]`·`audioCount:0`, 상세 `ask` 4키·`content==answerMd` |
| E3 간섭 ×2 | **측정 완료 — 위험 보고**(결함 아님, 설계 범위) | 추가 대기 +10.4 / +12.3s, 실패 0 |
| E4 409 + 한도 몫 | PASS | 409 ×3(R2 ASK·새 CHAT·R1 ASK), 몫 환불 확인(진행 1 + 단락 2 = 3건 수락, 4번째 `429 ASK_RATE retryAfterSec 43` = 60−17.4) |
| E5 끊김 완주 | PASS | 끊은 뒤 ~12s 에 저장, 그 동안 409, 15.1s 에 200, 로그 새 오류 0 |
| E6 사후 | PASS | 살균 0건, 누출 0건, 로그 0, 자식 프로세스 0, 큐 정상 |

### 관찰·위험 (결함 아님 — Leader 판단 필요)
- **O-1 (Medium 위험, 설계 선택지)** **ASK 1건이 다른 사용자의 짧은 CHAT 을 약 3.5s → 14~16s 로 늦춘다.** 구조상 최악은 ASK 진행 1 + 대기 2(`ASK_MAX_INFLIGHT=3`)이 줄을 서면 CHAT 이 약 13s×3 + 3.5s ≈ 40s+ 뒤에 시작 `[가능성 높음]`(계정 2개라 3건 동시는 못 재서 직접 실측 아님). **TALK(회화, 12s fail-fast·5초 예산)는 이번에 안 돌렸다 `[추측]`**: 같은 `interactive` 레인·같은 직렬 줄이라 같은 대기를 겪을 것이고, 어댑터 타임아웃은 프로세스를 띄운 뒤부터 세므로(`engine/llm` `callOnce(… remainingOrThrow …)` → `claudeCli collect`) 큐 대기로 12s 오류가 나지는 않고 그냥 느려질 것으로 읽힌다 — 단 JSON 재시도가 필요한 턴은 대기 뒤 남은 시간이 1.5s 미만이면 재시도 없이 `ENGINE_TIMEOUT` 이 될 수 있다 `[가능성 높음, 코드 읽기만]`. 사용자 수가 적은 초대제 앱이라 동시 충돌 확률은 낮다. 선택지(Leader 이력서 D 항목): ① 그대로 둠 ② ASK 를 `batch` 레인으로(회화가 앞서지만 ASK 가 회화 뒤로 밀려 느려짐) ③ ASK 동시 진행 제한을 사용자 단위 말고 전역 1 로 + 안내. 같은 사용자 안에서는 락(409)이 이미 막는다.
- **O-2 (Low, 관측성)** `RequestTrace` 의 `LLM` 단계 시간이 **큐 대기 + CLI 실행**을 합친 값이라, CHAT 이 ASK 뒤에서 기다린 경우 trace 에 `LLM=13,873ms / 16,121ms`(기준선 3.4~3.7s)로만 보이고 **대기였는지 느려진 건지 구분 불가**. 운영자가 trace 로 원인을 못 가린다 — 단계 분리(`QUEUE` 단계)는 후속 후보. 서버 로그 `[claudeCli] 완료 … elapsed` 는 실행 시간만 담아(CHAT 3,400ms) 두 값을 대조하면 대기를 역산할 수 있다.
- **O-3 (UX 위험, 설계 합의 사항)** 같은 사용자가 ASK 를 보낸 뒤 방을 나가 회화·채팅 턴을 시도하면 **ASK 가 끝날 때까지 409**(응답 6~9ms, 「이미 답을 기다리는 중이에요.」). ASK 는 취소 버튼이 없고(D6 C) 서버 예산이 최대 170s 라, 느린 답(타임아웃 직전)이면 **그 사용자는 최대 약 3분 회화·채팅이 막힌다**. 이번 실측은 12~15s 라 1회 대기 수준. 계약 §2-18-A 3 에 이미 적힌 동작(「ASK 가 도는 동안 같은 사용자의 회화·채팅 턴은 409」)과 일치, 화면의 409 안내 문구가 「답을 기다리는 중」이라 ASK 때문임을 알 수 있는지는 UI 레인 몫.
- **O-4 (Info)** 동시 턴 `409.details.runningMessageId` — A1 O-3(`null`)과 달리 PENDING 행이 이미 있는 이번 시험에서는 **실제 강사 메시지 id** 로 나옴(계약 #32 예시와 일치). 즉 `null` 은 수락 직후 극초기 경합 구간에서만.
- **O-5 (Info)** 하루 60건 한도(`ASK_DAILY`)·`ASK_BUSY`(진행 1 + 대기 2 초과)는 이번에도 **미실시** — 계정 2개로 ASK 동시 3건 불가, 하루 한도는 60건 소비가 필요. 단위 시험 몫(A1 과 동일).

### 결함 목록
- **없음**(QA64-A2-N 번호 부여 0건). 위 O-1~O-3 은 설계가 받아들인 동작의 실측 수치이며 계약 위반이 아니다.

### 미실시·판정불가
- TALK(회화) 턴의 간섭 지연 — 요청 범위(CHAT)만 측정. TTS(M4)·gateway 가 끼는 경로라 외부 서비스 의존, Leader 가 원하면 별도 갈래로(AI 2회 + M4 TTS).
- ASK 3건 동시(`ASK_BUSY`)·CHAT 대기 최악값, 하루 한도, ASK 가 120s 에 가까워지는 느린 답에서의 락 점유·사용자 체감.
- 스트리밍 증분(`delta`)은 없음이 계약 — `firstDeltaMs` 는 항상 null(PROMPT~PARSE 만).
- 답 품질(일본어 설명의 정확성)은 QA 범위 밖(기술 검증만). 참고: 5개 답이 모두 일본어 예문 + 한국어 뜻 인용 블록을 포함하고 `HIGH` 확신으로 나옴.

### 정리 대조 (19:54)
| 테이블 | QA3 시작→끝 | QA4 시작→끝 |
|---|---|---|
| Chat (ASK/TALK/CHAT) | 0 → 0 | 0 → 0 |
| ChatMessage | 0 → 0 | 0 → 0 |
| TutorProposal / Correction / WordEntry | 0/0/0 → 0/0/0 | 0/0/0 → 0/0/0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0/0/0 → 0/0/0 | 0/0/0 → 0/0/0 |
| AiJob / LearningObservation | 0/0 → 0/0 | 3/0 → 3/0 |
| RequestTrace | 1 → 9 (**+8 = 수락한 턴 8**: R1 6 + R2 2) | 103 → 108 (**+5 = 수락한 CHAT 턴 5**) |

- 방 4개(QA3 3 · QA4 1) 전부 소유자 쿠키 앱 `DELETE /api/v1/chats/:id` → `{deleted:true}`, 이후 GET 404. 409·429 로 거절된 요청은 trace 행을 만들지 않음(수락한 턴 수와 +8/+5 정확히 일치).
- 쿠키 파일(`scratchpad/q064/a2/c3·c4`)·응답 로그 삭제. 측정 로그(`measure.ndjson`·`children.ndjson`)·상태 파일은 scratchpad 에 남김(질문·쿠키 없음). 미러 `qa064/a2*.mjs|ts` 보조 스크립트는 남김.
- 프로세스 정리: watcher(`a2watch.mjs`, PID 파일 기준)만 종료 확인, 서버 3011(PID 789803)은 **끄지 않음**(health 200), 3010·3002·3012·3070대 미접촉, 내가 띄운 다른 프로세스·포트·복제본 없음. 스크린샷·브라우저 사용 없음(산출물 정리 0개).
