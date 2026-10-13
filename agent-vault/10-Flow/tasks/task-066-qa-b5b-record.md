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
# task-066 QA-B5b 기록 — 음성 질문 화면 검증 + 회화 회귀 (QA, 2026-10-13 KST)

> 본 이력서: [[task-066-ask-chatbot-voice]] · 구현 가이드 `docs/screens.md` §26(26-7 말 바·26-8·26-10·26-11) · 승인 데모 `docs/demo/task-066-ask-chatbot-v2.html`(상태 탭 D·E) · 개발 기록 [[task-066-dev-u2-record]]·[[task-066-dev-fix-record]]·감사 [[task-066-rev-u2-record]].
> 환경: 검증 서버 `127.0.0.1:3011`(PID 1752028, cwd `~/.node-local/thekaiwa-rev064`, BUILD_ID `lMnBwf9FushnMNfp4SwNu`, 끄지·재시작하지 않음) · 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스, `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul. **QA1 계정만**(`qa-bot@thekaiwa.test`). 쿠키·`.env` 값은 기록하지 않는다.
> **AI(Claude CLI) 호출 합계 ≤ 3회가 원칙**: `POST …/turns` 는 브라우저 안 fetch 모의(SSE 흉내)로 처리, 모의하지 않은 `turns` 는 `route.abort()` 안전망. 실제로 보내는 것은 e2e(6번) 1~2회뿐.
> 도구(저장소 밖): scratchpad `q064/b5b/*.mjs` · 미러 `~/.node-local/thekaiwa-rev064/qa064/b5bcounts.ts`.

## ★ 시작 값 · 정리 방법 (맨 위 고정)

시작 전 `claude --print` 프로세스 = **0**. 시작 값(`qa064/b5bcounts.ts START`, 2026-10-13 KST, QA1):

| 테이블 | QA1 시작 값 |
|---|---|
| Chat / ASK / TALK / CHAT | **3 / 0 / 0 / 3** (CHAT 3개는 기존 방 `cmul9e1770021w1oxcy4evgtg`·`cmul9g33i0041w1oxya7fg8is`·`cmul9g3m00043w1oxbfulaz3f` — 건드리지 않음) |
| ChatMessage | **64** |
| TutorProposal / Correction | 8 / 5 |
| WordEntry / StudyLog / StatsSnapshot / AiJob / RepetitionItem | 0 / 0 / 3 / 14 / 0 |
| LearningObservation / RequestTrace | 453 / 298 |
| **Utterance / SpeechJob** | **0 / 0** (핵심 — 끝에도 0 이어야 「목소리 서버 미저장」) |

- 심는 것: QA1 이 앱 API `POST /api/v1/chats {kind:"ASK"}` 로 만드는 방(메시지 0)과, e2e 1~2회로 생기는 질문·답 `ChatMessage`·`RequestTrace`·`LearningObservation`.
- 정리: 이번에 만든 방만 앱 `DELETE /api/v1/chats/:id` → `b5bcounts.ts END` 로 시작 값과 대조(`RequestTrace`·`LearningObservation` 은 e2e 로 늘 수 있어 증가분을 따로 적음) → 쿠키·wav·스크린숏 삭제 → 본인이 연 브라우저만 닫기. 서버·gateway 는 건드리지 않는다.

## 체크포인트

(아래에 append)

### 체크포인트 1 (턴 ≈38) — ① 모의 음성 흐름 390 폭 1차 완료
- **도구 메모**: 헤드리스 크롬은 `--headless=new` 를 줘야 AudioContext 가 돈다(기본 헤드리스는 시계가 안 가 오디오 프레임 0개 — 도구 문제, 앱 결함 아님). 첫 누름은 마이크 열기 지연 ≈1.5초라 모의 부분 결과를 보려면 ≥2.5초 눌러야 함. WS 는 `page.routeWebSocket` 모의(티켓 `POST /api/v1/speech/ticket` 도 모의, 실제 gateway 에 가지 않음).
- **통과(390, AI 0회)**:
  - 모드 전환·유지: 🎤 `말로 묻기` → 말 바(높이 117, 말하기 72×72, ⌨ 44×44, 가운데 x=195), 새로고침 후에도 말 모드·콘솔 경고 0.
  - ① 행복 경로: 티켓 용도 `MIC_TEST`·`chatId` 없음, WS start 메시지에 chatId 없음, 점선 말풍선 `aria-hidden`, 손 떼면 확인 없이 `POST …/turns` 본문 정확히 `{text:"駅はどこですか。", inputSource:"REALTIME_STT"}`(utteranceId 없음), `/utterances`·업로드 요청 **0**, 말 질문 말풍선 `lang="ja"` 17px·후리가나·한글 읽기·sr-only 「나(말로 물음): 」·「말로 물었어요」·[고쳐서 묻기](높이 44).
  - ② 취소: 거리 95px 안·97px 밖(`data-out`)·90/84px 에서 유지·83px 에서 복귀·밖에서 뗌 → `turns` 0·`stop` 메시지 0·토스트 「보내지 않았어요」·말풍선 안 늘어남. 84px 안으로 돌아와 뗌 → 전송 1건. Esc → 취소(턴 0). `touchCancel`(pointercancel) → 턴 0, 상태 줄 「녹음이 중간에 멈췄어요. 다시 눌러 주세요.」(사용자 취소가 아니라서 숨기지 않음).
  - ③ **V3**: 취소 → (늦게 온 final 주입, 전송 0) → 바로 다시 말해 전송 — 3회 연속 모두 정상(afterCancel 0, afterLate 0, afterNextSend 1). 다음 누름에 「밖」 모양 안 남음.
  - ⑤ 짧은 누름(120ms) → 힌트 「버튼을 누른 채로 말하고…」·턴 0 / final 「あ」·「 あ 」→ 「너무 짧아서 보내지 않았어요…」·턴 0 / 빈·공백 → 「말소리를 알아듣지 못했어요…」·턴 0 / 같은 final 2번 → 질문 1건. (관찰: 「え。」 같은 2자는 보냄 — 설계 규칙 `Array.from(t).length <= 1` 대로)
  - ⑥ [고쳐서 묻기]: 가장 최근 말 질문에만(말 3건 보낸 뒤 버튼 1개, 대상 = 세 번째), 누르면 글자 모드 전환·입력창에 들린 글 채움·초점·sessionStorage `text`, 고쳐 보내면 `inputSource:"TEXT"`, 글자 질문 뒤에는 이전 말 질문의 버튼 0.
  - ④ 429: `ASK_RATE` 5초 → 「질문을 너무 자주 보냈어요. 4초 뒤에 다시 보낼 수 있어요.」+ [다시 보내기(4초)] 잠김·상태 줄 「4초 뒤에 말할 수 있어요」·말하기 버튼 잠김 / 150초 → 「3분 뒤에」 / `ASK_DAILY` → 「오늘은 더 물어볼 수 없어요 — 내일 다시 물어봐 주세요.」+ 다시 보내기 **없음**·상태 줄 「오늘은 더 물어볼 수 없어요」 / `ASK_BUSY` → 「지금 질문이 몰려 있어요. 6초 뒤에 다시 물어봐 주세요.」. 문구 모두 §26-10 B 와 일치.
  - ⑦ 오류: getUserMedia 거부(모의) → SttAlert 「마이크 사용이 막혀 있어요…」+[글자로 묻기]·[닫기] / WS close 4422·티켓 422 → 「음성 인식 서버가 준비 중이에요…」+ 같은 단추. 모두 `turns` 0.
- **남은 일**: V5(답 대기 중 손 뗌 — 말하기 버튼이 비활성이 되는 경합), 글자 모드 오류 띠 숨김(위 시험은 단추 선택자 중복으로 무효 — 재시험), F-2(30초 자동 멈춤), 3폭 측정(360/412), ② 접근성, ③ 회화 회귀, ⑥ e2e.
- **다음 첫 명령**: `cd scratchpad/q064/b5b && node m4.mjs 390`.
- **주의점**: 띄운 서버 없음(검증 서버 3011 은 Leader 것). 본인이 만든 방 없음(모의 방 `/ask/qaFakeB5b…` 만 사용 — `POST /api/v1/chats` 0건). 쿠키 `b5b/c1`(600).

### 체크포인트 2 (턴 ≈58) — ① 모의 흐름 3폭·다크·V5·F-2·XSS·회화 회귀 완료 (AI 0회, 실제 gateway 0회)
- **V5**: 답 대기 중(held SSE) → 상태 줄 「답을 받은 뒤 말할 수 있어요」·말하기 버튼 잠김(disabled)·[고쳐서 묻기] **보임**(대기 중 미리 고치기)·누르면 입력창에 들린 글 채움·초점·보내기 잠김(aria 「답을 받은 뒤 보낼 수 있어요」). 서버 409 → 띠 「선생님이 다른 대화에 답하는 중이라 보내지 못했어요. 답이 끝나면 다시 보내 주세요.」+[다시 보내기]·[글자로 고치기]·[보내지 않고 버리기] 높이 44. **한계(NOT_VERIFIED)**: 가이드의 `self409`(누르는 동안 이 대화가 답 대기로 바뀜) 경합은 화면에서 만들 수 없음 — 누르는 동안엔 안내 칩이 사라지고(녹음 중 `intro` 숨김, 스크린숏 확인) 답 대기 중엔 말하기 버튼이 잠겨 눌 수 없음. 판정 규칙은 단위 시험(askInputControl 5·변이 KILLED)만 근거.
- **F-2**: 밖(130px)에서 누른 채 약 30초 → 자동 멈춤 토스트 「30초가 지나 자동으로 멈췄어요.」+ 이미 인식된 글 1건 전송 → 그 뒤 밖에서 뗌 → 「보내지 않았어요」 **안 뜸**·전송 +0, 다음 누름에 `data-out` 없음·정상 전송. PASS.
- **글자 모드 오류 띠 숨김(Q-U2-1)**: 서버 준비 중 오류 → ⌨ 글자로 묻기 → 띠 없음(입력창만), 🎤 로 돌아오면 같은 오류 띠가 다시 보임(닫기를 안 눌렀으므로 — 관찰, 결함 아님). 띠의 [글자로 묻기] → 글자 모드·초점 textarea.
- **XSS 리터럴**: 인식 글 `<img src=x onerror=window.__xss=1> <script>…` → 말풍선에 글자 그대로, `img` 0개, `window.__xss` 없음, 요청 본문은 원문 그대로.
- **3폭(360×740/390×844/412×892)**: 말 바 높이 117(§26-11 A), 말하기 72×72 가운데(x=폭/2), ⌨ 44, 범위 줄 36·「자세히」 안 잘림(360 포함), 상태 줄 「듣고 있어요 · 0:03 — 손을 떼면 보내요」 한 줄·말줄임 없음(폭 211), 가로 넘침 요소 0·페이지 세로 스크롤 0·44px 미만 터치 0·11px 미만 글자 0(최소 11), 목록 칸 = H−205(360:535 / 390:639 / 412:687). 띠(409) 상태도 같음. **다크(390)**: 배경 rgb(20,24,22), 밖 모양 테두리·캡션 rgb(242,139,130)(라이트 rgb(179,38,30)) — 토큰 반전 확인, 취소선·✕ 보임.
- **aria-live**: `role=status` 3개(도착 알림 sr-only 1 + 토스트 컨테이너 polite 2, 비어 있음), 상태 줄 `#talk-status` 는 live 아님, 점선 말풍선·캡션 `aria-hidden` → 마이크 상태 중복 낭독 없음.
- **회화 회귀(마이크 테스트 `/settings` — QA1 에 TALK 방이 없고 TALK 방을 열면 LLM 예열이 있어 대체)**: 공용 누르고 말하기 버튼에 `data-out` 속성·✕ 아이콘·밖 클래스 없음, 140px 밖에서 뗌 → 취소가 아니라 평소 뗌(WS `stop` 1건), 「보내지 않아요/보내지 않았어요」 문구 화면 어디에도 0, 티켓 용도 MIC_TEST. PASS. **TALK 방 화면 스모크 NOT_VERIFIED**(단위 시험 `voiceSharedFrozen`·`pttCancelOutside` 몫).
- **남은 일**: ⑥ 가짜 마이크 e2e(실제 gateway 연결 가능 여부 확인 → 되면 AI 1회) · 정리.
- **다음 첫 명령**: `cd scratchpad/q064/b5b && node e1.mjs` (e2e 스크립트 작성 후).
- **주의점**: 띄운 서버 없음·만든 방 없음(지금까지 `POST /api/v1/chats` 0건). 쿠키 `b5b/c1`.

## 마무리(QA-B5c) — 가짜 마이크 e2e + 「목소리 서버 미저장」 라이브 증거 (QA, 2026-10-13 KST)

> 이 절은 QA-B5b 가 60턴 한도로 멈춘 뒤 이어받은 B5c 의 기록이다(B5b 본문은 그대로). 도구(저장소 밖): scratchpad `q064/b5c/*`. 쿠키·`.env` 값은 기록하지 않는다. 검증 서버 3011 은 끄지·재시작하지 않는다.

### 시작 값 (B5c 시작 시 고정, QA1 = `cmuizv0yk0000w12dh0b5p7b2`)
| 항목 | B5b 시작 값 | **B5c 시작 값** | 비고 |
|---|---|---|---|
| Chat (ASK/TALK/CHAT) | 3 (0/0/3) | **4 (1/0/3)** | ASK 1 = B5b e2 가 남긴 방 `cmv60lx58003jw1vg8ncb7ngn`(「駅はどこですか。」, 메시지 2) — B5b 정리가 안 돼 있었음(c1·wav·스크린숏도 남아 있었음). 마지막에 정리 |
| ChatMessage | 64 | **66** | 위 방의 2 |
| RequestTrace | 298 | **299** | 위 방 턴 1건 |
| TutorProposal/Correction/WordEntry/StudyLog/StatsSnapshot/AiJob/RepetitionItem | 8/5/0/0/3/14/0 | 8/5/0/0/3/14/0 | 불변 |
| LearningObservation | 453 | 453 | |
| **Utterance / SpeechJob** | 0 / 0 | **0 / 0** | 핵심 — 끝에도 0/0 |
| 시작 전 `claude --print` 프로세스 | — | 0 | `ps` |
| **운영 gateway wav 저장소**(`DATA_ROOT/users/*/utterances`, 읽기 전용 `find`) | — | 파일 **8**개 전부 다른 사용자 `cmuj3ca5…` 것, 최신 2026-10-11 16:41:49 · QA1 폴더는 `incoming/` 빈 디렉터리·파일 0 | 끝에 대조 |

### 체크포인트 1 (턴 ≈14) — 인식 경로 확인(할 일 2): 운영 gateway 에는 이 서버(127.0.0.1:3011) 브라우저가 못 붙는다
- **관찰 [확실]**: B5b e1(가짜 마이크, WS 주소만 `127.0.0.1:8100` 으로 바꿔 실제 gateway 에 연결)이 두 번 연결 → 서버가 `UNAUTHENTICATED` 로 즉시 닫음. 운영 gateway 로그(`shared/logs/speech-gateway-out.log`, 읽기 전용) 10:40:22 `close=4401 code=UNAUTHENTICATED reason=origin not allowed` ×2 (오디오 0 — 인식 요청 아님).
- **원인 [확실]**: 운영 gateway 프로세스(PID 1212470, 릴리스 `20261012-232359-59eb4f85`)의 `SPEECH_GATEWAY_ALLOWED_ORIGINS` = `https://kaiwa.xn--lh0b87pnudm10a4vd.com` 하나(`/proc/<pid>/environ` 에서 이 키만 읽음) → 브라우저 Origin `http://127.0.0.1:3011` 은 `connection.py:136-146` 이 거부. 티켓 서명·`purpose` 문제가 아니다(그 검사는 Origin 검사 뒤).
- **하지 않은 것**: Origin 헤더를 운영 도메인으로 위조해 운영 gateway 에 붙는 우회(허용 목록은 운영이 일부러 둔 방어선이라 우회하지 않음). 운영 gateway 재시작·설정 변경도 없음.
- **대안(저장소가 공식으로 둔 길)**: `speech/gateway/scripts/run_dev.py`("gateway 를 pm2 없이 직접 띄운다(개발·QA·실측용)") 로 **별도 개발 gateway 를 다른 포트에** 띄운다 — 같은 코드(`git status speech/` 변경 0 = 운영 릴리스와 동일), 허용 Origin 을 이 서버 Origin 으로, 저장소 `DATA_ROOT` 는 격리 임시 폴더로, `APP_INTERNAL_URL` 은 죽은 포트로(실수로 앱 콜백을 부르면 로그에 실패가 남도록). 이는 운영 gateway 를 쓰지 않으므로 「gateway 인식 10발화」 한도는 개발 gateway 기준으로 센다.
- 남은 일: 개발 gateway 기동 → 가짜 마이크 e2e(AI 1회) → ①~⑥ → 정리. 다음 첫 명령: `cd scratchpad/q064/b5c && node e1.mjs`(작성 후).

### 체크포인트 2 (턴 ≈27) — e2e 1회 성공(개발 gateway 8197, AI 1회·gateway 1발화)
- 환경: 개발 gateway `run_dev.py --port 8197`(PID 1812215, 격리 `DATA_ROOT`=scratchpad `b5c/gwdata`, `APP_INTERNAL_URL=http://127.0.0.1:9`(죽은 포트), 허용 Origin = `http://127.0.0.1:3011`) · 크롬 `--headless=new --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<48k wav>%noloop`(stt20/05 「駅はどこですか。」 앞 1.3s·뒤 3.5s 무음, 6.7s) · 390×844 터치(CDP) · `/ws/speech` 만 nginx 흉내로 8197 로(Origin 은 브라우저가 정한 그대로).
- 흐름: `/ask`(말 모드) → 누르고 14.6초 유지 → 손 뗌 → **실제** `POST /api/v1/chats` + `POST …/turns` → 답 12초.
- **① 요청 본문 PASS**: `{"text":"僕はどこですか","inputSource":"REALTIME_STT"}` 정확히 이 2키, `utteranceId`·`scope` 없음(손 뗀 뒤 190ms 에 전송). 티켓 요청 본문 `{"purpose":"MIC_TEST"}`, 티켓 클레임 `aud=ws-speech purpose=MIC_TEST chatId=null ttl=60s`, WS start 메시지에 chatId 없음(키: type,v,sampleRate,partial,clientPlatform,endpoint + 티켓). WS `final` 메시지 키에 `utteranceId` 가 **있지만 값 null**(MIC_TEST 는 발화를 만들지 않음).
- **② 발화·업로드 요청 PASS**: 쓰기 요청 목록 = `attendance/check-in`(모의 응답, 서버 안 감)·`speech/ticket`·`chats`·`chats/:id/turns`·`text/annotate`×3 뿐. `utterance|upload|audio|voice|speech/jobs` 패턴 쓰기 0(안전망 abort 0건). 소리는 WS 이진 프레임 316개(404,480바이트) 로만 개발 gateway 에 갔다.
- **③ DB PASS**: 그 방 USER 메시지 `inputSource=REALTIME_STT`·status DONE·내용 「僕はどこですか」, ASSISTANT DONE; `Utterance`·`SpeechJob` **0/0 불변**(QA1 시작 값 그대로); `RequestTrace` +1(`TURN` OK, ACCEPT118·RETRIEVE0·PROMPT164·LLM10427·PARSE0·SAVE709, 총 11.4s). 다른 표(AiJob 14·LearningObservation 453·Proposal 8·Correction 5·WordEntry 0·StudyLog 0·StatsSnapshot 3) 불변.
- **④ gateway wav PASS**: 개발 gateway 로그 `ready … purpose=MIC_TEST` → `final … chars=7 sha1=f21a76b1 reason=stop audioMs=12640 storeMs=0 stored=False`; 격리 `DATA_ROOT` 파일 **0개**. 운영 wav 저장소(`files/thekaiwa/users/*/utterances`): 파일 8개 그대로·최신 2026-10-11 16:41:49 그대로·QA1 폴더 0개(운영 gateway 는 건드리지 않았음).
- **⑤ 로그 PASS**: `僕/どこ/ですか/駅` 문자열 grep — 개발 gateway 로그(12줄)·검증 서버 `server.log`·운영 gateway out/err 로그·`pm2-out.log` 모두 **0건**(gateway 는 글자 수+sha1 8자만 남김); `RequestTrace` 행(976자)·assistant `toolLog` 에도 0건.
- **⑥ 답 PASS**: 인식은 「僕はどこですか」(합성음 「駅は…」을 잘못 알아들음 — 인식 정확도는 이 QA 의 대상 아님, 앱은 인식된 글을 그대로 보냄). 답 = 뜻(저는 어디에 있나요?)·읽기(僕=ぼく)·자연스럽지 않은 이유·길 묻는 예문 2개(한글 발음 병기) — 입력에 맞는 설명. 화면: 「나(말로 물음): 僕ぼくはどこですか 한글 발음: [보꾸와 도꼬데스까] · 말로 물었어요 · [고쳐서 묻기]」, 새로고침 뒤에도 표지·버튼 유지, 화면 HTML 에 엔진명(`reazon|whisper|style-bert|model_id|speaker_id`) 0.
- 관찰(결함 아님): 파일이 끝난 뒤(6.4s~) 상태 줄이 「소리가 거의 들리지 않아요. 마이크 가까이에서 말해 보세요.」로 바뀜(무음 감지, 의도된 안내) · 손을 떼기 전에는 `final` 이 안 오고 `stop` 뒤 즉시 옴(partial 은 5.9s 에 옴).
- 사용량: AI(Claude CLI) **1회**, gateway(개발) 인식 **1발화**, 운영 gateway 인식 **0**.
- 남은 일: (a) 실제 gateway 에서 밀어서 취소 1회(AI 0) + 브라우저 저장소 덤프 (b) 자동 시험 양성 대조(pytest, 읽기 전용) (c) 정리: 방 2개 삭제(내 것 `cmv60v0hg0045w1vgosq0m8ut` + B5b 것 `cmv60lx58003jw1vg8ncb7ngn`)·개발 gateway 종료(PID 1812215)·쿠키·wav·gwdata·스크린숏 삭제.
- 다음 첫 명령: `cd scratchpad/q064/b5c && node e2.mjs`(작성 후).

### 체크포인트 3 (턴 ≈38) — 취소 실측·양성 대조·브라우저 저장소·정리 완료 → 판정
- **밀어서 취소(실제 개발 gateway, AI 0·방 생성 0)**: 누르고 ≈3.5초(partial 「今どこですか…」) → 150px 위로 → 상태 줄 「손을 떼면 보내지 않아요」·말풍선 취소선·빨간 테두리·버튼 ✕(`data-out`) → 손 뗌 → 토스트 「보내지 않았어요」·말풍선 사라짐. WS 로는 `{"type":"cancel"}` 한 줄(이진 프레임 64개·81,920바이트가 먼저 감), `stop` 아님(B5b 모의 결과와 일치). `turns`·`chats` 쓰기 요청 0(안전망 abort 도 0), 쓰기 요청 = `attendance/check-in`(모의)·`speech/ticket` 뿐. 개발 gateway 로그에 `final` 줄 없음(취소 = `session.cancel()`, `connection.py:299`) · 격리 `DATA_ROOT` 파일 0개.
- **브라우저 저장소(같은 실행)**: localStorage 0개, sessionStorage 2개(`kaiwa.ask.inputMode`(5자)·`kaiwa.checkin.<날짜>`(1자)), IndexedDB 0, Cache Storage 0, 저장소 사용량 0바이트, 문서 안 `blob:` 0 → 브라우저에도 소리·인식 글이 안 남는다.
- **양성 대조(자동 시험, 읽기 전용, 저장소에 파일 안 씀)**: `speech/gateway/tests/test_ws.py -k "mic_test_flow or turn_flow_stores"` → **2 passed**. `test_turn_flow_stores_wav_and_calls_back`(TURN 은 wav 가 `users/<id>/utterances/…` 에 생기고 앱 콜백 1회)와 `test_mic_test_flow_no_storage_no_engine_ids`(MIC_TEST 는 `data` 폴더 자체가 안 생기고 콜백 0, `final.utteranceId=None`)가 짝으로 통과 → 위 「격리 폴더 0개」가 검출기 고장이 아니라는 근거. `git status --short speech` 변경 0(운영 릴리스와 같은 gateway 코드).
- **정리 대조(최종)**: QA1 Chat **3**(ASK 0·TALK 0·CHAT 3 — 기존 방 3개 그대로)·ChatMessage **64** = B5b 시작 값 / TutorProposal 8·Correction 5·WordEntry 0·StudyLog 0·StatsSnapshot 3·AiJob 14·RepetitionItem 0·LearningObservation 453 불변 / **Utterance 0·SpeechJob 0 불변** / `RequestTrace` **300**(B5b 시작 298 + B5b e2 의 1 + 내 턴 1 — 앱 API 로 지울 수 없고 FK 없는 기록이라 남음, 질문 본문 0 확인함). 방 2개(`cmv60v0h…` 내 것·`cmv60lx5…` B5b 것) 앱 `DELETE` 200 ×2. 운영 wav 저장소 파일 8개·최신 2026-10-11 16:41:49 불변.
- **산출물·프로세스 정리**: 쿠키 `b5c/c1`·`b5b/c1`, wav 변환본 `b5c/fake05.wav`·`b5b/fake05.wav`, 스크린숏(`b5b/shots`·`b5c/shots`), `b5c/gwdata`·`b5c/pytmp` 삭제(45개). 개발 gateway(PID 1812215, 내가 띄움) SIGTERM → 포트 8197 비었음. 본인이 연 크롬 2개(`b.close()`) 종료 확인, 검증 서버 3011·운영 3010·gateway 8100 그대로 리슨(건드리지 않음). `claude --print` 프로세스 0.

### 판정 (QA-B5c) — **PASS (결함 0건), 단 NOT_VERIFIED 4건**
| 항목 | 판정 | 근거 |
|---|---|---|
| 가짜 마이크 e2e 가능성(할 일 1·2) | **PASS(개발 gateway 로)** / 운영 gateway 로는 **불가(Origin 허용 목록)** | 위 체크포인트 1·2 |
| ① 요청 본문 `{text,inputSource:'REALTIME_STT'}`·`utteranceId` 없음 | PASS | 본문 문자열 원문 확인 |
| ② 발화·업로드 요청 0 | PASS | 쓰기 요청 목록·abort 안전망 0 |
| ③ `Utterance`·`SpeechJob` 불변, 메시지 `inputSource=REALTIME_STT` | PASS | DB 읽기 0→0·행 확인 |
| ④ gateway wav 불변 | PASS(개발 gateway 격리 폴더 0개 + `stored=False` + 운영 저장소 불변 + 양성 대조 시험) | |
| ⑤ 로그·RequestTrace 에 인식 글·질문 본문 0 | PASS | `僕/どこ/ですか/駅` grep 0건(5개 로그·Trace 행·toolLog) |
| ⑥ 답이 입력에 맞는 설명 | PASS | 뜻·읽기·예문 2개 |
| 취소(실제 gateway) | PASS | `cancel` 메시지·final 없음·파일 0·턴 0 |

- **NOT_VERIFIED**: ① **운영 gateway(PID 1212470, 허용 Origin = 운영 도메인)로 직접 인식** — Origin 헤더 위조 우회를 하지 않았고 운영 도메인 브라우저 경유는 이 환경에 없음. 같은 코드·같은 `connection.py:325` 게이트라 [가능성 높음]으로 동일하나 측정 아님. ② **앱(휴대폰) 온디바이스 경로**의 wav 0개(K8) — 실기기. ③ **사람 목소리 인식 품질** — 합성음(+ 선형보간 48k 변환)이 「駅は」를 「僕は」·「今」으로 잘못 알아들음 [추측: 변환 품질이 일부 원인], 이 QA 는 경로 검증이라 정확도 판정 안 함. ④ 운영 nginx 의 `/ws/speech` 프록시 경유(`/ws/speech` 주소 바꾸기는 nginx 를 흉내 낸 하네스).
- **환경 주의(결함 아님)**: 이 검증 서버(3011)의 브라우저 e2e 는 운영 gateway(8100)에 못 붙는다(`origin not allowed`) — B5b 의 두 번 실패가 이것. 앞으로 같은 e2e 는 `run_dev.py --port 8197` 개발 gateway 를 격리 `DATA_ROOT`·`APP_INTERNAL_URL` 죽은 포트·허용 Origin = 서버 Origin 으로 띄워야 한다(위 방법 그대로). `qa064/b5cdb.ts`(읽기 전용 DB 점검)·scratchpad `b5c/e1.mjs`·`e2.mjs` 참고.
- **사용량**: 실제 AI(Claude CLI) **1회**(≤2), 개발 gateway 인식 **2발화**(성공 1·취소 1)(≤10), 운영 gateway 인식 **0**(B5b 의 Origin 거부 연결 2건은 오디오 0).
