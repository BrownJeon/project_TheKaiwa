---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-PROD 기록 — /ask 3a 운영 읽기 전용 스모크 (QA, 2026-10-12 23:45~ KST)

> 본 이력서: [[task-064-ask-anything-3a]]. 대상: 운영 `127.0.0.1:3010` 직접 요청만(nginx·도메인 경유 없음), 릴리스 `20261012-232359-59eb4f85`(롤백 대상 `20261012-143811-812b52c1`, `migrated:false`). 계정 = QA2(`qa-bot2@thekaiwa.test`, USER) 하나. 쿠키·`.env` 값은 기록하지 않는다.

## ★ 접촉 범위 (맨 위 고정)

- **HTTP**: `GET` 만 14건(무인증 2 + 인증 페이지 7 + API 4 + 없는 id 페이지 1). `POST·PUT·PATCH·DELETE` = **0건**. 브라우저·Playwright 사용 0(curl 만 → 클라이언트 JS 가 돌지 않아 화면 로드에 딸린 쓰기 요청도 0).
- **AI(Claude CLI) 호출 0회**: 측정 직후 `ps` 로 `claude --print` 계열 프로세스 0건, 운영 node(PID 1212373)의 자식 프로세스 0건.
- **DB 쓰기**: 쿠키 발급 스크립트 `tests/live/qa-session.ts` 의 QA2 `upsert`(`update:{}` — 행이 이미 있어 변화 없음) 한 가지뿐. 그 밖의 DB 접속 없음.
- **저장소**: `src`·`docs`·`tests` 수정 0. 미러(`~/.node-local/thekaiwa-predeploy`)에는 `.env` 를 복사했다가 쿠키 발급 직후 삭제(아래 정리 대조).

## 결과 표

### 1. 무인증

| # | 요청 | 상태 | 핵심 | 판정 |
|---|---|---|---|---|
| 1-1 | `GET /api/health` | 200 | `status:ok`·`env:PRODUCTION`·`degraded:[]`·`checks` 11개 전부 true(env_database·env_jwt·env_google_oauth·env_data_root·env_internal_secret·db·llm·stt_gateway·stt_analysis·stt_analysis_worker·tts) | PASS |
| 1-2 | `GET /ask` (쿠키 없음) | 307 | `Location: /login?callbackUrl=%2Fask` | PASS |

### 2. QA2 쿠키 페이지 (운영 localhost 에서 QA 토큰이 세션으로 인정됨 — 401 없음)

| # | 요청 | 상태 | 크기 | 확인 내용 | 판정 |
|---|---|---|---|---|---|
| 2-1 | `GET /ask` | 200 | 21,187 B | 상단 제목 「질문」·「선생님에게 물어보기」·「선생님에게 보내는 범위」·예시 칩 4개(문법/내 기록/복습/배운 표현)·「지난 질문」 영역(클라이언트가 불러오는 중 표시)·입력창 placeholder 「일본어 표현·문법이나 내 공부 기록을 물어보세요」. **새 3a 화면**(옛 「Phase 3」 자리표시 문구 0건). 하단 탭 5개 = 회화·공부·계획표·단어장·질문(이 순서), `/ask` 링크만 `aria-current="page"` | PASS (아래 표기 주의 1) |
| 2-2 | `GET /study/ai` | 200 | 19,362 B | 「자유로운 대화」 2건 | PASS |
| 2-3 | `GET /study/today` | 200 | 25,585 B | — | PASS |
| 2-4 | `GET /plan` | 200 | 44,312 B | — | PASS |
| 2-5 | `GET /settings` | 200 | 27,810 B | — | PASS |
| 2-6 | `GET /drawer/words` | 200 | 33,807 B | — | PASS |
| 2-7 | `GET /drawer/corrections` | 200 | 30,794 B | — | PASS |

> **표기 주의 1 (결함 아님, 지시문 기대와 구현의 차이)**: 지시문은 「/ask HTML 에 『무엇이든 물어보세요』가 있고」를 기대했으나 화면에는 이 **전체 문구가 없다**(「물어보세요」는 입력창 placeholder 한 곳). 대조 결과 — 승인 데모 v2 의 `<h1>무엇이든 물어보세요</h1>` 은 **데모 문서 자체의 제목**이고 앱 화면 안은 `appBar('질문')`(데모 1328행 부근), `docs/screens.md` 94행의 「무엇이든 물어보세요」는 기능 설명 문구이며 §25 에 화면 헤더 문구 규정은 없다. 옛 자리표시 화면(`h3` 「무엇이든 물어보세요」)이 새 화면으로 교체되면서 문구가 사라진 것으로 보인다. [가능성 높음] 의도된 구현. Leader 가 「화면 머리글에도 기능 이름을 보여 주고 싶다」면 별도 개선 사안.

### 3·4. API (QA2)

| # | 요청 | 상태 | 핵심 | 판정 |
|---|---|---|---|---|
| 3-1 | `GET /api/v1/chats?kind=ASK` | 200 | `data = {items:[], nextCursor:null}` — **ASK 방 0개** | PASS (표기 주의 2) |
| 3-2 | `GET /api/v1/chats?kind=CHAT` | 200 | `data = {items:[], nextCursor:null}` — CHAT 방 0개 | PASS |
| 3-3 | 누출 문자열 `reazon\|whisper\|style-bert\|claude\|qwen\|model_id\|speaker_id\|toolLog\|DATABASE\|JWT` | — | 위 API 4개 응답 + 페이지 7개 + 없는 id 페이지 = **0건** | PASS |
| 4-1 | `GET /api/v1/chats/cmzzzzzzzzzzzzzzzzzzzzzzz` | 404 | `{"success":false,"data":{"code":"NOT_FOUND"},"message":"채팅을 찾을 수 없어요."}` | PASS |
| 4-2 | `GET /api/v1/chats/not-a-valid-id` | 404 | 4-1 과 동일 본문(형식 오류 id 도 존재 여부를 흘리지 않고 같은 404) | PASS |
| 4-3 | `GET /ask/cmzzzzzzzzzzzzzzzzzzzzzzz` | **200** | 13,125 B, 가시 텍스트 「질문」「불러오는 중…」, 하단 탭 없음(질문 방 규정 §25). 서버는 404 를 돌리지 않고 **클라이언트가 방을 불러오며 판정**하는 구조 | PASS (표기 주의 3) |

> **표기 주의 2**: `data` 는 지시문의 「배열」이 아니라 `{items, nextCursor}` 봉투다(목록 API 공용 형태). 계약 위반이 아니라 기대 표기 차이.
> **표기 주의 3**: 4-3 의 「200 + 불러오는 중」은 서버가 방 존재 여부를 모르는 채 껍데기를 내는 구조다. 실제 「없는 방」 안내 화면(클라이언트가 4-1 의 404 를 받은 뒤의 표시)은 **curl 로는 확인 불가 → NOT_VERIFIED**(브라우저 금지).

### 5. 서버 로그 (`/home/brownjeon/apps/thekaiwa/shared/logs/`)

시각이 붙은 줄만 세었다(스택 이어짐 줄은 문자열 비교에 섞여 잘못 커져 처음 34로 나온 값은 측정 오류 — 정정).

| 파일 | 2026-10-12 23:24 이후 줄 | 패턴(`처리되지 않은 예외`·`Unhandled`·`TypeError`·`일시적 실패`·`타임아웃`·`Traceback`·`ERROR`) |
|---|---|---|
| `pm2-out.log` | 10 | **0** — 내용은 Next.js 16.3.2 기동 줄 2벌(`Ready in 96ms`·`95ms`) 뿐 |
| `pm2-err.log` | **0** (마지막 줄 = 10-11 16:41 의 [json] 재시도 경고) | 0 |
| `speech-gateway-err.log` | 16 | 0 — 23:24:34 종료 `Shutting down`→`Application shutdown complete`, 23:24:35 `Started server process` (정상 재기동) |
| `speech-gateway-out.log` | 16 | 0 |
| `speech-worker-err.log` | 0 | 0 |
| `speech-worker-out.log` | 6 | 0 |

- 시작 직후 정상 기동 줄: `2026-10-12 23:24:34/35 ✓ Ready in 96ms/95ms`. 「Ready」가 두 벌 찍히는 것은 이전 배포(14:38:46·14:38:48)에도 같은 형태 → 새 이상 아님.
- 이 스모크의 GET 요청은 stdout/stderr 에 한 줄도 남기지 않았다(요청 로그 없음).

### 6. 자원

| 항목 | 값 | 판정 |
|---|---|---|
| `pm2` thekaiwa | PID 1212373 `online`, 재시작 **0**, 가동 약 26분 | PASS |
| `pm2` thekaiwa-speech-gateway | PID 1212470 `online`, 재시작 **0** | PASS |
| `pm2` thekaiwa-speech-worker | PID 1212542 `online`, 재시작 **0** | PASS |
| 운영 node 의 자식 `claude` | **0** (`pgrep -P 1212373` 자식 0) | PASS |
| `ps` 의 `claude --print` 계열 | **0** | PASS |
| `free -m` | 총 31,207MB · 사용 12,613 · 여유 2,832 · 캐시 15,761 · **available 18,065** · **Swap 2,047/2,047 (100% 사용)** | 주의 아래 |

### 7. 번들 대조 (`releases/20261012-232359-59eb4f85/.next/server/app/(app)/ask/`)

| 확인 | 결과 | 판정 |
|---|---|---|
| `[chatId]/page.js` | 있음 | PASS |
| `(tab)/page.js` | 있음 | PASS |
| 옛 `(app)/ask/page.js` | **없음** | PASS |
| `current` 심볼릭 링크 | `…/releases/20261012-232359-59eb4f85` 가리킴 | PASS |

## 이상 징후·전달 사항 (결함 아님, 운영 영향 없음, 수정 요청 없음)

1. **[확실] Swap 이 100% 찼다**(2,047/2,047MB). RAM available 은 18GB 로 여유. Swap 상위 점유는 `mysqld`(약 324MB)·M1ums `java` 2개·`n8n`·`chrome-devtools-mcp` 로 **thekaiwa 프로세스가 아니다** → 이 배포로 생긴 현상이 아니다. 다만 Swap 이 가득 찬 호스트에서 ASK 전용 슬롯의 동시 AI 프로세스 2개(약 700MB)가 겹치면 응답 지연이 늘 수 있어 Leader 가 알아 둘 값 [추측].
2. **[확실] 고아 개발 시험 프로세스**: `node --import tsx --test-concurrency=1 /home/brownjeon/.node-local/thekaiwa-dev064s2b/src/app/api/v1/chats/…` 6개가 부모 PID 1 로 약 5시간 50분째 남아 있다(PID 549830·550240·550521·550799·550987·551209, 30초 간격 기동, esbuild 자식 포함 전체 11개, 부모 6개 RSS 합 약 708MB). developer 의 task-064 s2b 시험 실행이 정리되지 않고 남은 것으로 보인다 [추측]. 제 소유가 아니고 운영과 무관해 건드리지 않았다 — Leader 가 정리 여부 결정.
3. 위 표기 주의 1·2·3 (지시문 기대와 구현 표기 차이).

## 확인하지 못한 것

- **실제 질문 한 번을 운영에서 해 보는 일**(방 만들기→질문 턴→답·출처 표시→삭제): `POST` 와 AI 호출이 필요해 **사용자 허락이 필요하므로 하지 않았다.** 운영에서 ASK 가 실제로 답하는지는 아직 `NOT_VERIFIED`.
- 브라우저 렌더(가로 스크롤·터치 44px·스크롤 위치 복원·예시 칩 눌림·「지난 질문」 목록 채움·없는 방 안내 화면): 브라우저 사용 금지라 `NOT_VERIFIED`. 개발 서버에서의 B1~B4 화면 검증은 [[task-064-qa-b1-record]]~[[task-064-qa-b3-record]] 참고.
- 실기기(S25+ APK) 확인은 사용자 몫(네이티브 변경 없음 → APK 재설치 불필요).

## 정리 대조

| 항목 | 상태 |
|---|---|
| 쿠키 파일·폴더 `scratchpad/q064/prod/` (쿠키 1 + 받은 HTML 8 + JSON 4) | 삭제 완료, `ls -d` → 없음. (`scratchpad/q064/` 의 `a2·a3b·a4·b1~b4·qa064-backup` 등은 앞선 QA 레인 것이라 손대지 않음) |
| 미러 `~/.node-local/thekaiwa-predeploy/.env` | 쿠키 발급 직후 삭제, 최종 재확인 `ls` → 없음 |
| 띄운 서버·프로세스 | 없음(운영 3010 에 GET 만 보냄). `ss -ltn` 3011·3012·8197 리슨 없음 |
| 만든 DB 행 | 없음(QA2 `upsert` 는 `update:{}` — 기존 행 변화 없음) |
| 저장소 변경 | `git status` = 이 기록 파일 1개(untracked)뿐. `src`·`docs`·`tests` 변경 0. 일일 로그(`20-Log`)는 「저장소에 쓰는 것은 기록 파일 하나」 지시에 따라 쓰지 않음 — Leader 가 한 줄 추가 필요 |

## 종합 판정

7개 항목 전부 PASS(표기 주의 3건은 결함이 아닌 기대 표기 차이). Critical/High/Medium 결함 0. 확인 못 한 것(운영에서 실제 질문 1회, 브라우저 렌더)은 NOT_VERIFIED 로 위에 명시.
