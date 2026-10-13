---
project: TheKaiwa
task: task-066
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-066 QA-PROD 기록 — 질문 탭 챗봇창 운영 읽기 전용 스모크 (QA, 2026-10-13 12:15~ KST)

> 본 이력서: [[task-066-ask-chatbot-voice]]. 대상: 운영 `127.0.0.1:3010` 직접 요청만(nginx·도메인 경유 없음), 릴리스 `20261013-114952-fe50f143`(롤백 대상 `20261012-232359-59eb4f85`, `migrated:false`). 계정 = QA2(`qa-bot2@thekaiwa.test`, USER) 하나. 쿠키·`.env` 값은 기록하지 않는다. 직전 형식: [[task-064-qa-prod-record]].

## ★ 접촉 범위 (맨 위 고정)

- **HTTP**: `GET` 만. `POST·PUT·PATCH·DELETE` = **0건**(방 만들기·질문 턴·삭제 전부 없음). 브라우저·Playwright 사용 0(curl 만 → 클라이언트 JS 가 돌지 않아 화면 로드에 딸린 쓰기 요청도 0).
- **AI(Claude CLI) 호출 0회**: 시작 시점 `ps` 에 `claude --print` 계열 0건(보이는 `claude` 는 VS Code 확장 본체 1개뿐 — 이 스모크와 무관). 종료 직전 재확인 결과는 아래 「6. 자원」.
- **DB 쓰기**: 쿠키 발급 스크립트 `tests/live/qa-session.ts` 의 QA2 `upsert`(`update:{}` — 행이 이미 있어 변화 없음) 한 가지뿐. 그 밖의 DB 접속 없음.
- **저장소**: `src`·`docs`·`tests` 수정 0. 미러(`~/.node-local/thekaiwa-predeploy`)에는 `.env` 를 복사했다가 쿠키 발급 직후 삭제(발급 직후 `ls` 로 부재 확인).

## 결과 표

### 1. 무인증

| # | 요청 | 상태 | 핵심 | 판정 |
|---|---|---|---|---|
| 1-1 | `GET /api/health` | 200 | `status:ok`·`env:PRODUCTION`·`degraded:[]`·`checks` 11개 전부 true(env_database·env_jwt·env_google_oauth·env_data_root·env_internal_secret·db·llm·stt_gateway·stt_analysis·stt_analysis_worker·tts) | PASS |
| 1-2 | `GET /ask` (쿠키 없음) | 307 | `Location: /login?callbackUrl=%2Fask` | PASS |

### 2. QA2 쿠키 페이지 (운영 localhost 에서 QA 토큰이 세션으로 인정됨 — 401 없음)

| # | 요청 | 상태 | 크기 | 판정 |
|---|---|---|---|---|
| 2-1 | `GET /ask` | 200 | 30,618B | PASS (구조는 아래 2-A) |
| 2-2 | `GET /study/ai` | 200 | 19,362B | PASS |
| 2-3 | `GET /study/today` | 200 | 25,585B | PASS |
| 2-4 | `GET /plan` | 200 | 44,312B | PASS |
| 2-5 | `GET /settings` | 200 | 27,810B | PASS |
| 2-6 | `GET /drawer/words` | 200 | 33,807B | PASS |
| 2-7 | `GET /drawer/corrections` | 200 | 30,794B | PASS |

#### 2-A. `/ask` 서버 렌더 HTML 의 챗봇창 구조 (보이는 것 / SSR 에 없는 것 구분)

[확실] `/ask` HTML 은 **로딩 골격(Suspense fallback)과 실제 콘텐츠(`<div hidden id="S:…">` 세그먼트, `$RC` 스크립트가 교체)가 함께** 내려온다. 그래서 가시 텍스트가 두 벌로 보인다(첫 벌 = 골격, 둘째 벌 = 실제). 입력창(`<textarea>`)·마이크·보내기 버튼은 **실제 벌에만** 있다.

| 기대 항목 | SSR 관찰 | 판정 |
|---|---|---|
| 선생님 첫 안내 말풍선 | 「선」 아바타 + 「선생님」 + 「무엇이든 물어보세요. 일본어 표현·문법도, 내 공부 기록(교정·복습·수업)도 좋아요.」 | PASS |
| 예시 질문 칩 | 3개 `<button>`: 「문법 〜ている 와 〜てある 차이가 뭐예요?」·「내 기록 이번 주에 내가 자주 틀린 조사 알려줘」·「복습 오늘 복습할 거 뭐 있어?」 + 「글로 물어보기 · 누르면 바로 물어봐요」 안내 | PASS |
| 마이크 안내 | 「모르는 일본어는 🎤 로 그대로 말해 보세요 / 뜻·읽기·느낌을 예문과 함께 알려 줘요. 예) 大丈夫 · お疲れ様でした · それはちょっと難しいですね」 | PASS |
| 입력 바 | `<textarea rows=1 enterKeyHint=send aria-label="질문 입력" placeholder="무엇이든 물어보세요">` + `button[aria-label="말로 묻기"]`(마이크) + `button[type=submit][aria-label="보내기"]`(빈 입력이라 `disabled`) | PASS |
| 입력 바 아래 한 줄 안내 | `button[type=button]` 「i 내 학습 기록 일부가 AI 에 보내져요 자세히」(`aria-label="내 학습 기록 일부가 AI 에 보내져요 — 자세히, 선생님에게 보내는 범위"`), 입력 바 영역 바로 아래 `data-kb-docked` 컨테이너 | PASS |
| 머리 「지난 질문」·⋯ 메뉴 | `button[aria-label="지난 질문"]`, `button[aria-label="질문 메뉴"]`(⋯) 둘 다 있음 | PASS |
| 머리 「＋ 새 질문」 | **SSR 에 없음(클라이언트 렌더)** — 「새 질문」 0건. ⋯ 메뉴를 열어야 나타나는 항목으로 추정 → 번들 대조(7)에서 문자열 존재만 확인 | NOT_VERIFIED(화면은 사용자 몫) |
| 「알겠어요, 보내기」 확인 모달 마크업 | 0건. `role="dialog"`·`aria-modal`·`dialog` 모두 0건, `scopeNotice` 0건. 「보내는 범위」 문자열은 위 한 줄 안내 버튼의 `aria-label` 안에만 있음(모달 본문 아님) | PASS |
| 하단 탭 라벨 | 「회화·공부·계획표·단어장·질문」 순서 그대로, `aria-current="page"` 는 `<a href="/ask">질문</a>` **1개뿐** | PASS |
| 「손을 떼면 보내지 않아요」 | SSR 에 없음(녹음 중에만 뜨는 클라이언트 상태) → 번들 대조(7) | NOT_VERIFIED(화면은 사용자 몫) |

### 3. API 목록 · 누출 검사

| # | 요청 | 상태 | 응답 | 판정 |
|---|---|---|---|---|
| 3-1 | `GET /api/v1/chats?kind=ASK` | 200 | `{"success":true,"data":{"items":[],"nextCursor":null},"message":null}` (QA2 방 0개, 69B) | PASS |
| 3-2 | `GET /api/v1/chats?kind=CHAT` | 200 | 동일 형태, `items:[]` | PASS |
| 3-3 | 금칙어 `reazon\|whisper\|style-bert\|claude\|qwen\|model_id\|speaker_id\|toolLog\|DATABASE\|JWT` 대소문자 무시 grep | — | 수집한 **본문 12개**(페이지 9 + API 3) 전부 **0건** | PASS |

### 4. 없는 id

| # | 요청 | 상태 | 관찰 | 판정 |
|---|---|---|---|---|
| 4-1 | `GET /ask?chat=<형식 맞는 가짜 id>` | 200 | 서버가 404 를 돌리지 않고 **정상 /ask 화면(빈 대화)** 을 렌더 — 방 판정은 클라이언트 몫인 구조. textarea 1·마이크 버튼 1 존재 | PASS(구조 기록) |
| 4-2 | `GET /api/v1/chats/<없는 id>` | 404 | `{"success":false,"data":{"code":"NOT_FOUND"},"message":"채팅을 찾을 수 없어요."}` 봉투 | PASS |
| 4-3 | `GET /ask/<없는 id>` | **200** | 가시 텍스트는 「질문 · 불러오는 중…」 뿐(골격). 서버가 404 를 돌리지 않고 클라이언트가 방을 불러와 판정하는 구조. 비교: **기존 `/study/ai/chat/<없는 id>` 도 동일하게 200 + 「불러오는 중…」** → 회귀 아님, 같은 패턴. 응답 속 「404: This page could not be found」 문자열은 레이아웃 RSC 페이로드의 `notFound` 슬롯(모든 경로 공통)이지 이 경로의 가시 결과가 아님 | PASS(기존 패턴과 일치) |

> 8턴 체크포인트 1: 위 1~4 완료. 남은 일 = 5(서버 로그) · 6(pm2·자원·claude 자식 수) · 7(번들 대조) · 정리(쿠키 삭제) · 최종 보고. 다음 첫 명령 = `ls /home/brownjeon/apps/thekaiwa/shared/logs/`. 주의점 = 쿠키 `…/scratchpad/q066prod/qa2.cookie`(600) 아직 존재, 미러 `.env` 는 이미 삭제됨.

### 5. 서버 로그 (`/home/brownjeon/apps/thekaiwa/shared/logs/`, 배포 11:49 KST 이후, 날짜 접두 줄만 집계)

| 파일 | 배포 후 줄 | 패턴(처리되지 않은 예외·Unhandled·TypeError·일시적 실패·타임아웃) | 비고 | 판정 |
|---|---|---|---|---|
| `pm2-out.log` | 10 | **0** | `▲ Next.js 16.3.2` · `Ready in 100ms` · `Running next.config.ts took 20ms` 가 11:50:28 과 11:50:29 에 한 벌씩. `[claudeCli]` 줄 0 | PASS |
| `pm2-err.log` | **0** | **0** | 파일 mtime 이 10-11 16:41 그대로 — 배포 후 한 줄도 쓰이지 않음 | PASS |
| `speech-gateway-err.log` | 16 | 0 | 전부 `INFO:` 종료(11:50:28)→기동(11:50:29) 줄 | PASS |
| `speech-gateway-out.log` | 18 | 0 | — | PASS |
| `speech-worker-out.log` | 6 | 0 | — | PASS |

- 정오표: 처음 문자열 비교로 `pm2-err.log` 를 세었을 때 「34줄」이 나왔으나, 날짜 없는 스택 줄(전체 68줄)이 `>=` 비교에서 크게 나온 **오탐**이었다. 날짜 접두 줄만 다시 세어 0건으로 정정했다.
- `Ready` 가 두 번 찍히는 것은 이전 배포(10-12 13:08·14:38·23:24)도 똑같다 → 이번 배포만의 이상이 아니다. pm2 `restarts=0`.
- 패턴 첫 3줄: 해당 줄이 없어 없음.

### 6. 자원

| 항목 | 값 | 판정 |
|---|---|---|
| pm2 `thekaiwa` | online · cluster_mode · pid 1879401 · restarts 0 · unstable 0 · uptime 1,638s · 175MB · CPU 0.2% | PASS |
| pm2 `thekaiwa-speech-gateway` | online · fork · pid 1879497 · restarts 0 · 326MB | PASS |
| pm2 `thekaiwa-speech-worker` | online · fork · pid 1879569 · restarts 0 · 48MB | PASS |
| `free -m` | 총 31,207MB · 사용 12,203 · 여유 3,427 · 캐시 15,575 · **available 18,474** · **Swap 2,047/2,047 (100%)** | 주의(아래) |
| 메모리 압력 | `vmstat` si/so 0, `/proc/pressure/memory` some·full avg10/60/300 = 0.00 | PASS |
| 운영 node 자식 `claude` 프로세스 | thekaiwa pid 자식 **0**, `claude --print` 계열 **0** (보이는 `claude` 는 VS Code 확장·ccd-cli 세션 본체로 이 스모크와 무관) | PASS |

- **[확실] Swap 100%** 는 task-064 스모크(10-12)에도 같은 수치(2,047/2,047)로 기록돼 있다 → 이번 배포로 생긴 현상이 아니다. 현재 압력 0·swap 입출력 0 이라 당장 증상은 없다. 후속(호스트 메모리 점검)은 이 task 범위 밖.

### 7. 새 릴리스 번들 대조 (`.../releases/20261013-114952-fe50f143/.next`)

| 대조 | static | server | 기대 | 판정 |
|---|---|---|---|---|
| `kaiwa.ask.scopeNotice` | **0** | 0 | 0 | PASS |
| `알겠어요, 보내기` | **0** | 0 | 0 | PASS |
| `지난 질문` | 6 | 13 | ≥1 | PASS |
| `손을 떼면 보내지 않아요` | 1 | 6 | ≥1 | PASS |
| `새 질문`(보강) | 6 | 21 | — | 존재 확인 → 2-A 의 「SSR 에 없음」은 클라이언트 렌더(⋯ 메뉴)로 추정 |
| `말로 묻기`·`무엇이든 물어보세요`·`보내는 범위`(보강) | 7 · 6 · 6 | 12 · 20 · 19 | — | 존재 |

- `scopeNotice`(접두 없는 식별자)는 server 쪽 `.js.map` 6개에서만 보이고, 전부 소스 **주석 문장**(「task-066 에서 `scopeNotice`… 없앴다 — 남아 있는 값은 아무도 읽지 않는다」)이다. 컴파일된 코드·static 에는 0건. 코드 상의 관문 로직은 남아 있지 않다.
- 경로 구조: `.next/server/app/(app)/ask/` = `[chatId]`·`(tab)` 두 개뿐, **옛 `ask/page.js`(홈 목록) 없음**. `app-paths-manifest.json` 의 `/ask` 항목 = `/(app)/ask/(tab)/page`, `/(app)/ask/[chatId]/page` 두 개.
- 보강: `/ask` HTML 이 참조하는 정적 자산 20개를 GET → **20/20 200**(깨진 청크 참조 없음).

## 정리 대조

| 항목 | 결과 |
|---|---|
| 쿠키 `…/scratchpad/q066prod/qa2.cookie` | 삭제(디렉터리째 제거, `ls` 로 부재 확인) |
| 미러 `~/.node-local/thekaiwa-predeploy/.env` | 발급 직후 삭제, 종료 시 재확인 — 부재 |
| 수집한 HTML·JSON 13개 + `issue.log` + `assets.txt` | 삭제(지정 파일 `rm -f` 후 `rmdir`), 남은 파일 0 |
| 저장소 변경 | `git status` 상 이 기록 파일 1개만 새로 생김(`.obsidian/` 제외). `src`·`docs`·`tests` 수정 0 |
| DB 쓰기 | QA2 upsert(`update:{}`, 행 변화 없음) 외 0 |
| 띄운 서버·프로세스 | 없음(curl 만 사용) |

## 판정

**PASS — 결함 0건.** 항목 1~7 모두 PASS. 단 「＋ 새 질문」 노출·「손을 떼면 보내지 않아요」 표시는 서버 렌더에 없어 **화면 판정 불가(NOT_VERIFIED)** 이며 번들 문자열 존재만 확인했다.

- 이상 징후: 없음. 참고 사항 2건 — ① Swap 100%(호스트 상태, 10-12 부터 동일, 이번 배포 무관) ② `/ask/<없는 id>`·`/ask?chat=<가짜>` 가 서버 200 이고 방 판정이 클라이언트 몫(기존 `/study/ai/chat/<없는 id>` 와 동일 패턴 — 회귀 아님).
- **AI 호출 0회**: 배포 후 `[claudeCli]` 로그 줄 0, `claude --print` 프로세스 0, 운영 node 자식 0. 접촉 요청은 전부 GET.

## 확인하지 못한 것 (사용자 몫)

1. **운영에서 실제 글자 질문 한 번**: 방 생성·질문 턴(POST)과 Claude CLI 호출이 필요해 사용자 허락 없이는 하지 않았다.
2. **운영에서 실제 마이크 질문 한 번**: 위와 같음(허락 필요).
3. **앱 WebView 온디바이스 인식**(sherpa-stt 마이크 권한·partial/final)·**운영 gateway 직접 인식**·**실기기(S25+) 육안**: 하단 탭 「질문」 선택 표시, 키보드가 입력 바를 가리지 않는지, 「＋ 새 질문」·⋯ 메뉴·「지난 질문」 시트 동작, 확인 모달 없이 칩 탭 즉시 전송, 마이크 권한 거부 안내, 녹음 중 「손을 떼면 보내지 않아요」 — 전부 클라이언트 렌더라 curl 로 판정 불가.
4. 360/390/412 세 폭 레이아웃·터치 44px(마이크 ≥64px): 브라우저 사용 금지 조건이라 이 스모크에서는 **NOT_VERIFIED**(개발 환경 B5d 에서는 통과 기록 있음).
