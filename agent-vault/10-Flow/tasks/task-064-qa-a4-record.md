---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-A4 기록 — ASK 전용 AI 슬롯 재측정(간섭 소멸·부작용) (QA, 2026-10-12 22:21~ KST)

> 본 이력서: [[task-064-ask-anything-3a]]. 앞 갈래: [[task-064-qa-a2-record]](슬롯 추가 **전** 측정 — 같은 방법으로 전후 비교). 구현: [[task-064-dev-lane-record]](공용 슬롯 1 + ASK 슬롯 1, 최대 동시 AI 프로세스 2). 환경: 검증 서버 `127.0.0.1:3011`(**새 빌드**, PID 1106838, `next start`, cwd `~/.node-local/thekaiwa-rev064`, BUILD_ID `XRmlTeybODxe689sb7Qlo`, APP_ENV=LOCAL — 운영과 별도 프로세스). **QA3=질문자 1, QA1(`qa-bot@thekaiwa.test`)=질문자 2, QA4=채팅 사용자**. 쿠키·`.env` 값은 기록하지 않는다. **실제 AI(Claude CLI) 호출 합계 ≤12회**(E1 1 + E2 1 + E3 6 + E4 2 + E5 1 = 11 예정, 여유 1).

## ★ 심은 것·정리 방법 (맨 위 고정)

- **시작 값**(22:21 KST, `~/.node-local/thekaiwa-rev064/qa064/a4counts.ts start rooms`) — 정리 뒤 이 값과 대조한다.

| 테이블 | QA1 | QA3 | QA4 |
|---|---|---|---|
| Chat (ASK / TALK / CHAT) | 3 (0 / 0 / 3) | 0 (0 / 0 / 0) | 0 (0 / 0 / 0) |
| ChatMessage | 64 | 0 | 0 |
| TutorProposal / Correction / WordEntry | 8 / 5 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0 / 3 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| AiJob / LearningObservation | 14 / 453 | 0 / 0 | 3 / 0 |
| RequestTrace | 295 | 23 | 108 |

- QA1 의 기존 CHAT 방 3개(`cmul9e17…`·`cmul9g33…`·`cmul9g3m…`, 메시지 22/0/42)와 그 안의 데이터는 **건드리지 않는다**(내가 만든 ASK 방만 지움). QA1 은 이번에 **ASK 방 1개만** 만든다.
- 심는 것: QA3 ASK 방 R1·R2 + CHAT 방 C3, QA1 ASK 방 R3, QA4 CHAT 방 C4(AI 0), 질문·턴이 만드는 `ChatMessage`·`RequestTrace`·(AI 가 낸) `TutorProposal`. **`RequestTrace` 는 방을 지워도 남는 감사 행** — 증가분 = 수락한 턴 수인지만 대조한다. `LearningObservation`·`AiJob` 은 CHAT 턴 뒤 훅이 만들 수 있다(증가분은 따로 적는다).
- 정리: 만든 방 전부 소유자 쿠키로 앱 `DELETE /api/v1/chats/:id` → `a4counts.ts end` 로 시작 값과 대조. 쿠키(scratchpad `q064/a4/`) 삭제. 미러 `qa064/a4*` 보조 스크립트는 남긴다. 서버 3011 은 끄지 않는다.
- 도구(미러 `qa064/`): `a4lib.mjs`(SSE 시각 측정·계정 3개) · `a4counts.ts` · `a4watch.mjs`(서버 PID 1106838 의 자식 프로세스 0.2초 표본: spawn/exit·동시 수·RSS).

## 측정 기록
(아래에 append)

### [체크포인트 1] E0~E2 완료 (22:22~22:24 KST) — AI 호출 누계 2회 `[확실]`(직접 잰 값)
- E0: 방 5개 생성 200 ×5 — QA3 ASK R1·R2 + CHAT C3, QA1 ASK R3, QA4 CHAT C4. 질문 12문장 사전 분류(`a2classify.ts`) 전부 GENERAL(되묻기 단락 아님).
- E1 CHAT 단독(QA4 C4, 「こんにちは、今日はいい天気ですね。」): accepted 783ms(첫 요청이라 라우트 예열 포함) → PARSE 3,682 → done 3,799. **accepted→done 3.02s** (A2 기준선 3.15~3.81). CLI 프로세스 수명 3,700ms, **RSS 약 334~338MB**(프로세스 1개, haiku).
- E2 ASK 단독(QA3 R1, 「お疲れ様です와 お疲れ様でした 차이가 뭐야?」): accepted 175 → LLM 536 → PARSE 13,563 → done 14,158. **accepted→done 13.98s**(A2 13.26s), 답 **588자**(A2 576자), intent GENERAL·HIGH·sources 0·needsScope false·proposals 0·correction null·audioCount 0. `done` 키 7개·`conversation` 키 6개(answerMd·replyKo·sources·confidence·needsScope·records)·상세 `ask` 4키·`content==answerMd`·status DONE — **A2 와 형태 동일**. 서버 로그 `[claudeCli] 완료 task=ask model=sonnet promptChars=6199 elapsed=13021ms warm=OFF`.
- 도구 메모: 첫 `awk /--print/` 확인에서 `dbus-daemon`(`--print-address`)만 걸림 — `claude --print` 외부 프로세스 0. 자식 감시 `a4watch.mjs` PID 1115841(내가 띄운 것, 종료 대상).

### [체크포인트 2] E3 간섭 재측정 ×3 완료 (22:24~22:25 KST) — AI 호출 누계 8회 `[확실]`
> 방법: `a4p3.mjs` — ASK(질문자) `accepted` 를 받은 뒤 **2.0s**(1,999~2,001ms 실측) 뒤에 QA4 가 CHAT 턴 전송. 자식 프로세스는 `a4watch.mjs`(0.2s 표본)가 PID·RSS·동시 수를 기록. 외부 `claude` CLI 프로세스(타 서버) 0 확인 후 실행.

| 시도 | 질문자 | ASK accepted→done | CHAT 전송 후 accepted | **CHAT accepted→done** | CHAT send→done | 겹침(둘 다 실행 중) | CHAT done − ASK done |
|---|---|---|---|---|---|---|---|
| E3-1 | QA1 R3 | 11.84s (477자) | 859ms | **3.07s** | 3.93s | 3.93s | −5.9s (CHAT 이 먼저 끝) |
| E3-2 | QA3 R1 | 13.25s (558자) | 162ms | **3.87s** | 4.03s | 4.03s | −7.2s |
| E3-3 | QA1 R3 | 8.79s (510자) | 432ms | **3.71s** | 4.14s | 4.14s | −2.7s |

- **간섭 소멸**: CHAT accepted→done 3.07 / 3.87 / 3.71s (평균 3.55s) = 기준선 E1 3.02s 대비 +0.05 / +0.85 / +0.69s. A2 의 13.90 / 15.73s(+10.4 / +12.3s)와 비교해 **추가 대기 사라짐**. CHAT 이 ASK `done` 보다 **2.7~7.2초 먼저** 끝남 = 두 요청이 실제로 동시에 진행.
- **서버 자식 `claude` 동시 수 최대 2** (3번 모두): ASK 자식 먼저 spawn(accepted +0.3~0.5s) → CHAT 자식이 **ASK 가 도는 중에** spawn(ASK spawn +1.5~1.6s) → CHAT 자식 먼저 exit(수명 3.45~3.74s) → ASK 자식 exit(수명 7.9~12.4s). n≥2 표본 40개.
  - spawn/exit 시각(22:24:03.885 ASK 1119841 → 22:24:05.408 CHAT 1119921(n=2) → 22:24:09.145 CHAT exit → 22:24:14.644 ASK exit / 22:24:41.745 ASK → 22:24:43.265 CHAT(n=2) → …46.716 CHAT exit → …54.129 ASK exit / 22:25:07.345 ASK → …09.373 CHAT(n=2) → …12.865 → …15.256).
  - **RSS(자식 1개 피크)**: haiku(CHAT) 360,084 / 379,424 / 378,420KB(≈352~370MB), sonnet(ASK) 400,892 / 392,616 / 356,468KB(≈348~391MB). **둘이 동시일 때 합계 최대 717,628KB ≈ 701MB**(3번 중 최대; 첫 시도 695,504KB). Dev 기록의 「프로세스당 100~200MB 추정」은 **실제의 절반 이하** — 실측은 350~400MB. 서버 본체 `next-server` RSS 162,824KB.
  - `free -m`(used / free / available MB): E3-1 전 12,775/3,054/17,783 → 중간(ASK +6s, CHAT 이미 끝난 시점이라 자식 1) 13,369/2,459/17,189 → 후(+5s) 12,919/2,909/17,638. E3-2 전 12,784/3,045/17,774 → 중 13,278/2,551/17,280 → 후 12,851/2,977/17,707. **E3-3(자식 2 동시에 잡힘)** 전 12,794/3,034/17,764 → **중 13,706/2,122/16,852** → 후 13,030/2,798/17,528. 동시 2 일 때 used 증가 약 +0.9GB(캐시·타 프로세스 변동 포함) 에도 available 16.8GB 로 여유 충분(전체 31,207MB). `[확실]`
- 서버 로그 `[claudeCli] 완료` 줄 6개: chat haiku elapsed 3,516 / 3,519 / 3,471ms(promptChars 2348·2411·2474 — 같은 방 대화 누적으로 소폭 증가), ask sonnet elapsed 10,889 / 12,431 / 7,965ms. `warm=OFF` 전부.
- ASK 자신은 간섭으로 느려지지 않음: 11.84 / 13.25 / 8.79s (E2 단독 13.98s, A2 간섭 중 12.6~14.9s) — 답 길이에 따라 다름(CLI 8~12.4s).

### [체크포인트 3] E4·E5·E6 완료 (22:26~22:28 KST) — AI 호출 누계 11회 `[확실]`
**E4 ASK 끼리 직렬**(`a4p4.mjs` — QA3 R2 와 QA1 R3 을 0.416s 간격으로 전송, AI 2회):

| 요청 | accepted ms | LLM status ms | PARSE ms | done ms | accepted→done | 비고 |
|---|---|---|---|---|---|---|
| QA3 (먼저) | 573 | 1,274 | 12,851 | 13,052 | **12.48s** | 답 584자, 자식 `claude` spawn 22:26:00.666 |
| QA1 (0.4s 뒤) | 931 | 1,331 | 26,155 | 26,638 | **25.71s** | 답 658자, 자식 spawn **22:26:12.224 = 첫째 exit 와 같은 시각(0.2s 표본 안)** |

- 둘째 `done` 은 첫째 `done` 뒤 **13.59s**(= 둘째 CLI 13,306ms) — **직렬**. 둘 다 200, **`ASK_BUSY` 없음**(진행 1 + 대기 1 은 허용 범위). 둘째의 `accepted`·`PROMPT`·`LLM` 상태는 0.9~1.3s 에 도착하고 PARSE 만 26.2s 에 와서, 화면은 둘째 질문자에게 「답 만드는 중」 상태로 약 25s 머문다(A2 CHAT 대기와 같은 모양, 이번엔 ASK 끼리).
- **서버 자식 `claude` 동시 수 최대 1**(n≥2 표본 0개) — 두 자식 모두 sonnet, 수명 11,558 / 13,292ms, RSS 피크 375,264 / 375,636KB. `RequestTrace` 에서 둘째 질문의 `LLM` 단계 = **24,824ms** (CLI 실행 13,306ms + 큐 대기 ≈11.5s): 큐 대기가 trace 의 `LLM` 에 섞인다(A2 O-2 와 같은 관측성 한계, 이제는 ASK 끼리에서만 생김).

**E5 같은 사용자 락 불변 + 한도 몫**(`a4p5.mjs` — 이전 1분 창이 끝난 22:27:03 에 시작, AI 1회):
- 진행 턴(QA3 R1 ASK, accepted→done **13.30s**, 563자) 중 +1.999s 에 같은 사용자 QA3 이 (i) **CHAT 방 C3 에 CHAT 턴**, (ii) R2 에 ASK, (iii) R1(같은 방)에 ASK 를 보냄 → **셋 다 `409 CONFLICT`**(응답 9 / 6 / 5ms, `application/json`, SSE 아님, `details.runningMessageId` = 진행 중 강사 메시지 id 로 셋 모두 같은 값). **설계(사용자당 진행 1턴) 그대로 — 새 슬롯이 이 락을 바꾸지 않았다.**
- **한도 몫 환불**: 진행 턴 끝나자마자(+13.3s) 되묻기 단락 질문 연달아 — 단락-1 `200`(1,702ms, accepted→PROMPT→done), 단락-2 `200`(983ms), **단락-3 `429 RATE_LIMITED {reason:"ASK_RATE", retryAfterSec:44}` + `Retry-After: 44`**(창 시작=진행 턴 수락 → 16.0s 시점 → 60−16.0=44 ✓). 즉 **진행 1 + 단락 2 = 수락 3건, 4번째 시도가 429** — 409 로 거절된 ASK 2건(R2·R1)은 몫을 쓰지 않았다(A2 와 같은 결과).

**E6 사후 점검**
1. 응답 본문 23개(24,180바이트) 전체 grep(`reazon|whisper|style-bert|claude|qwen|model_id|speaker_id|toolLog|@thekaiwa.test|JWT|DATABASE|thekaiwa_session|sk-ant|.env`) **0건**. ASK 답 7개(588/477/558/510/584/658/563자) + 되묻기 문구 2개: `<`·`](`·`http`·`javascript:`·`data:`·`onerror`·`iframe`·`![` **0건**.
2. 턴 응답 상태 분포: `200 ×13` · `409 ×3` · `429 ×1` — 다른 코드(5xx 등) 0.
3. **서버 로그** 17줄: 기동 5 + `[persona]` 1 + `[claudeCli] 완료` **11**(chat/haiku 4: 3,617·3,516·3,519·3,471ms / ask/sonnet 7: 13,021·10,889·12,431·7,965·11,568·13,306·12,474ms, 전부 `attempt=1 warm=OFF`). `일시적 실패` 0 · `타임아웃` 0 · `처리되지 않은 예외` 0 · error/Unhandled/abort 0. 질문 조각 12종·쿠키 줄 **0줄**.
4. 자식 `claude` 잔존: 실험 직후·+5s 모두 `pgrep -P 1106838` **0건**.
5. **실제 AI 호출 수 대조(≤12)**: 자식 spawn **11** = exit **11** = 서버 로그 `[claudeCli] 완료` **11** = `RequestTrace`(QA1·QA3·QA4, 22:21 이후) `LLM` 단계 TURN 행 **11** = 내 계획 11. 여유 1회는 쓰지 않음. 외부 프로세스(타 서버 `claude`)가 끼어든 흔적 0(실험 직전마다 0 확인).

## 최종 결과 (22:28 KST) — 실험 E0~E6 전부 실시 · **제품 결함 0건** · 관찰 4건 · **실제 AI 호출 11회**

### 이전(QA-A2, 슬롯 추가 전) 대비 `[확실]`
| 항목 | A2 (슬롯 전, 공용 1) | **A4 (ASK 전용 슬롯)** | 판정 |
|---|---|---|---|
| CHAT 단독 기준선 accepted→done | 3.81 / 3.15 / (E6) 4.04 → 평균 3.5s | **3.02s** (CLI 3,617ms) | 같은 수준 |
| ASK 단독 accepted→done | 13.26s (576자) | **13.98s** (588자), 형태 동일 | 변화 없음(+0.7s 는 A2 범위 12.1~15.0 안) |
| **ASK 중 다른 사용자 CHAT** | **13.90s / 15.73s** (+10.4 / +12.3s) | **3.07 / 3.87 / 3.71s** (평균 3.55, 기준 대비 +0.05 / +0.85 / +0.69s) | **간섭 소멸** — CHAT 이 ASK `done` 보다 2.7~7.2s 먼저 끝남 |
| 같은 CHAT 의 CLI 실행 시간(로그 elapsed) | (단독 ~3.4s) | 단독 3,617ms · ASK 와 겹칠 때 3,516 / 3,519 / 3,471ms | 겹쳐도 CLI 가 느려지지 않음 |
| 트레이스 `LLM` 단계 (CHAT) | 13,873 / 16,121ms (대기 포함) | **3,516 / 3,520 / 3,472ms** (= CLI 실행) | CHAT 에는 더는 큐 대기가 섞이지 않음 |
| ASK 자신(간섭 중) | 12.62 / 14.91s | 11.84 / 13.25 / 8.79s | 변화 없음 |
| 서버 자식 `claude` 최대 동시 수 | 1 (겹침 0, 직렬) | **2**(ASK+CHAT 3/3회), ASK 끼리는 1 | 설계 기대(2) 일치 |
| 동시 턴 락 409 / 한도 몫 환불 | 409 ×3 / 429 retryAfter 43 | 409 ×3(CHAT·ASK·ASK) / 429 retryAfter 44 | 불변 |

### 자원 `[확실]`
| 항목 | 값 |
|---|---|
| 자식 `claude` RSS 피크 | haiku(CHAT) 356~379MB · sonnet(ASK) 348~401MB (**프로세스당 약 350~400MB**) |
| 동시 2 일 때 자식 합계 RSS 최대 | **717,628KB ≈ 701MB** (n≥2 표본 40개 중) |
| `next-server` RSS | 162,824KB(기동 직후) → 202,852KB(실험 후, 약 8.6분 가동) |
| `free -m` (E3-3, 자식 2 동시) | used 12,794 → **13,706** → 13,030MB, free 3,034 → 2,122 → 2,798MB, available 17,764 → 16,852 → 17,528MB (전체 31,207MB) |
| 동시 4(실행 2 + 예열 대기 2) 추정 | ≈ 1.4GB `[추측]` — 이 서버는 `warm=OFF` 라 **예열 대기 프로세스 포함 최악은 실측 못 함**(운영 서버의 예열 설정은 확인하지 않음) |

### 판정
| 실험 | 판정 | 근거 |
|---|---|---|
| E0 방 만들기 | PASS | 방 5개 200 |
| E1 CHAT 기준선 | PASS | 3.02s |
| E2 ASK 단독 | PASS | 13.98s, 588자, `done`·`conversation`·상세 `ask` 형태 A2 와 동일 |
| **E3 간섭 재측정 ×3** | **PASS** | CHAT 3.07/3.87/3.71s(A2 13.9/15.7s), 동시 실행 겹침 3.9~4.1s, 자식 최대 2 |
| E4 ASK 직렬 | PASS | 둘째 done 이 첫째 뒤 13.6s, 자식 최대 1, `ASK_BUSY` 없음 |
| E5 사용자 락 불변·몫 환불 | PASS | 409 ×3(CHAT·ASK·ASK), 수락 3건 뒤 4번째 429 retryAfter 44 |
| E6 사후 | PASS | 누출 0·살균 0·로그 0·잔존 0·호출 수 11=11=11=11 |

### 관찰 (결함 아님)
- **O-1 (Info) 프로세스당 메모리 실측 350~400MB** — Dev 기록 「남은 위험 / 메모리」의 추정(100~200MB)보다 약 2배. 동시 2 면 약 0.7GB, 이 호스트(31GB, available ≈17GB)에서는 문제 없음. 운영 호스트의 다른 서비스(6개 프로젝트 공유)와 예열 풀(`prewarmMaxIdle` 기본 2)을 합친 최악(≈1.4GB)은 실측 못 함. 필요하면 `claudeCli.provider.ts` 설명·dev 기록의 숫자를 정정.
- **O-2 (Info, A2 O-2 의 잔여)** `RequestTrace` 의 `LLM` 단계는 CLI 실행 + **ASK 슬롯 대기**를 합친 값이다. E4 둘째 질문: trace `LLM` 24,824ms vs 로그 `elapsed` 13,306ms. CHAT 은 이제 대기가 없어 3.5s 로 깨끗하지만, **ASK 끼리의 대기는 여전히 구분 불가**(`QUEUE` 단계 분리는 후속 후보 그대로).
- **O-3 (UX, 설계 범위)** ASK 가 둘 겹치면 둘째 질문자는 약 25.7s 를 「답 만드는 중」으로 본다(첫째 12.5s + 자기 13.3s). `accepted`·`LLM` 상태는 1s 안에 오므로 멈춘 것처럼 보이지 않지만, ASK 가 몰리면 선형으로 늘어난다(`ASK_MAX_INFLIGHT`=진행 1 + 대기 2 까지는 최대 약 39s). 이번에는 대기 1건까지만 실측.
- **O-4 (Info)** 구독 rate limit: 동시 2 프로세스를 3번 겹쳐 돌렸고 `일시적 실패`·한도 오류 줄은 0. 다만 표본 3쌍, 이 서버에 다른 CLI 트래픽 0 인 상태라 **혼잡 시간대의 한도 반응은 판정불가**(dev 기록 「남은 위험」과 같은 결론 — 배포 뒤 `[claudeCli] 일시적 실패` 빈도 관찰).

### 결함 목록
- **없음**(QA64-A4-N 번호 부여 0건). 새 구조의 부작용(사용자 락·한도 몫·누출·잔존 프로세스·로그 오류) 모두 관측되지 않았다.

### 미실시·판정불가
- 공용 슬롯 내부의 interactive 끼리 직렬 유지(두 사용자의 CHAT 동시) — AI 2회가 필요해 예산(≤12) 초과로 미실시. Dev 의 단위 시험(`claudeCliAskLane` b·a-2, 기존 `claudeTimeoutRetry` 7건)과 E4 의 ASK 직렬 관찰로 간접 확인만.
- ASK 3건 동시(`ASK_BUSY` 발동)·하루 한도 60건 — 계정 2개(QA2 는 타 QA 사용 중)라 불가, 단위 시험 몫(A1·A2 동일).
- TALK(회화) 턴과 ASK 의 겹침 — TTS(M4)·gateway 경로라 별도 갈래(요청 범위 밖). 예열 풀 ON 환경(운영)에서의 동시 프로세스 수 — 이 서버 `warm=OFF`.
- 답 품질·구독 한도 혼잡 반응·실기기 체감: QA 범위 밖/판정불가.

### 정리 대조 (22:28)
| 테이블 | QA1 시작→끝 | QA3 시작→끝 | QA4 시작→끝 |
|---|---|---|---|
| Chat (ASK/TALK/CHAT) | 3 → 3 (CHAT 3, 기존 방 id 3개 동일) | 0 → 0 | 0 → 0 |
| ChatMessage | 64 → 64 | 0 → 0 | 0 → 0 |
| TutorProposal / Correction / WordEntry | 8/5/0 → 8/5/0 | 0/0/0 → 0/0/0 | 0/0/0 → 0/0/0 |
| StudyLog / StatsSnapshot / RepetitionItem | 0/3/0 → 0/3/0 | 0/0/0 → 0/0/0 | 0/0/0 → 0/0/0 |
| AiJob / LearningObservation | 14/453 → 14/453 | 0/0 → 0/0 | 3/0 → 3/0 |
| RequestTrace | 295 → 298 (**+3 = 수락 턴 3**: E3-1·E3-3·E4) | 23 → 29 (**+6**: E2·E3-2·E4·E5 진행·단락 2) | 108 → 112 (**+4**: E1·E3 ×3) |

- 만든 방 5개(QA3 3 · QA1 1 · QA4 1) 전부 소유자 쿠키 앱 `DELETE /api/v1/chats/:id` → `{deleted:true}`, 이후 GET 404. 409·429 로 거절된 7건은 trace 행을 만들지 않음(+3/+6/+4 와 수락 턴 수 정확히 일치). 시작 값과 대조해 QA1 의 기존 데이터(방 3·메시지 64·제안 8·교정 5)는 그대로.
- 쿠키 파일 3개·응답 로그(`responses.ndjson`, 질문·답 본문 포함)·`state.json`·`watch.pid` 삭제(6개). scratchpad 에는 질문 없는 `measure.ndjson`·`children.ndjson`·`aicount.json`·`kidsum.mjs`만 남김. 미러 `qa064/a4*.mjs|ts` 보조 스크립트는 남김.
- **프로세스 정리**: 내가 띄운 감시 `a4watch.mjs`(PID 1115841)만 종료·잔존 0 확인. 서버 3011(PID 1106838)은 **끄지 않음**(health 200, 자식 `claude` 0). 3010·3002·3012·3070대 미접촉, 내가 띄운 다른 프로세스·포트·복제본 없음. 스크린샷·브라우저 사용 없음(산출물 정리 0개).
