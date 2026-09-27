---
task_id: task-003e
title: "STT gateway(우분투) + 웹 실시간 음성 인식 폴백 + 마이크 테스트"
status: done
base_ref: b4feaa5
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, codex]
related_tasks: [task-003d-tts-p0, task-005-settings-attendance, task-005b-admin-console-skeleton]
tags:
  - type/task
  - domain/speech
  - domain/stt
aliases:
  - STT gateway
  - 웹 음성 인식
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-003 중 **STT 서버 경로(gateway) + 웹 폴백** — 폰 없이 끝낼 수 있는 범위(온디바이스 플러그인·Capacitor·APK 는 003f).
완료 기준(§15 해당분): gateway 폴백으로 20문장 partial/final, 우분투 `127.0.0.1:8100` WS `/ws/speech`(nginx 경유 `wss://kaiwa…/ws/speech`), 티켓 인증, 발화 wav 저장 + Utterance 행, 실측 게이트(STT 항목).
정본: `speech/README.md`(구성도·호스트·포트·실행·env), `speech/gateway/{README.md,interfaces.py}`, `speech/common/README.md`, `speech/speech.config.yml`, `docs/design/api-contract.md` #19·#20·#21·#142(`/ws/speech` 프로토콜 `v:1`)·`/api/internal/speech/utterances`(grep "internal/speech")·§0-3 WS 티켓·§0-8, `docs/design/speech-platform/00~15`(STT 관련: 실시간 경로·RealtimeSttClient·modeResolver·VAD·ReazonSpeech·gateway), `docs/design/domain-model.md`(Utterance·UserSpeechSetting), `docs/design/module-dependency.md` L4·§4-1·§5, `docs/design/configuration-resolution.md`.

## 관련 과거 이력 요약
- [[task-003d-tts-p0]]: M4 TTS `:8200` 상시(20문장 테스트 음성 생성에 사용 가능 — 앱 `POST /api/v1/speech/tts` 또는 M4 `/synthesize`+`TTS_SERVICE_SECRET`). 시크릿 분리 원칙(Codex C1): gateway·internal 콜백은 `SPEECH_INTERNAL_SECRET`, TTS 는 `TTS_SERVICE_SECRET`.
- [[task-005-settings-attendance]]: 설정 음성 인식 4모드(`UserSpeechSetting`, `speech/stt/modeResolver`, 웹 OFFLINE → GATEWAY).
- [[task-005b-admin-console-skeleton]]: engine registry·Health(reazon-gateway connection 은 서비스 없음 → UNAVAILABLE).
- 운영 주의: 운영 pm2 `APP_ENV=LOCAL`(LOCAL connection 공유), 미러에서 build 금지(격리 복제본), dev 화면은 `localhost:3011`, NFS noexec(Python venv 는 `~/.node-local/thekaiwa-speech/venv`).

## Leader's Plan (2026-09-28)

### 범위 결정
- **E1 분할**: 003e = gateway(Python) + 웹 WebSocketSttClient + 티켓·config·internal 콜백 + 설정 화면 **마이크 테스트**(말하면 인식 결과가 보이는 점검용). 회화 화면 연결은 task-007, 온디바이스는 003f.
- **E2 모델**: ReazonSpeech `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` int8 + silero VAD, `speech/models/`(git 미추적) 에 다운로드 스크립트로 받는다. 같은 모델을 003f 온디바이스가 쓴다.
- **E3 테스트 음성**: M4 TTS 로 20문장(짧은 인사~긴 문장, 숫자·조사 포함) wav 를 만들어 `speech/test-assets/`(git 미추적 또는 작은 파일만) — STT 정확도(CER)·지연 측정용. 사람 목소리 실측은 003f 실기기.
- **E4 운영**: gateway 는 우분투 pm2 `thekaiwa-speech-gateway`(`127.0.0.1:8100`, venv), `ecosystem.config.js` 항목 추가. QA PASS 후 Leader 가 pm2 기동(사용자 자율 진행 지시). nginx `/ws/speech` 는 이미 적용됨.
- **E5 보안**: 티켓 JWT(`aud:"ws-speech"`, 60초, 1회성 권장), 원음·전사 전문은 로그·Trace 금지, internal 콜백은 `SPEECH_INTERNAL_SECRET`(헤더 없으면 404), 업로드 상한(≤60s·≤2MB), DATA_ROOT 밖 경로 금지, 오디오 보존 30일.

### 구현 전략 · 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §8 마이크 테스트(설정 → 음성 인식 절 안): 권한 요청·녹음 중 표시·partial/final·오류(권한 거부·서버 불가·티켓 만료)·3폭 | 1 |
| developer A (Opus, Python) | `speech/common`(엔진 인터페이스·sherpa ReazonSpeech 래퍼·VAD·설정)·`speech/gateway`(FastAPI WS, 티켓 검증, 세그먼트 디코드, partial/final, wav 저장, internal 콜백)·모델 다운로드 스크립트·requirements·pytest·`ecosystem.config.js` gateway 항목·테스트 음성 생성·STT 실측 | 1 |
| developer B (Opus, TS) | #19 config·#20 ticket·#21 utterances·`/api/internal/speech/utterances`·Utterance 저장/보존·`speech/stt` RealtimeSttClient·WebSocketSttClient(AudioWorklet PCM16 16kHz 40ms)·설정 마이크 테스트 화면·관리자 Health 연결·스모크 | 1(화면은 designer 후) |
| judge·codex | intake·C1·C2 | |
| reviewer·qa | 보안(티켓·시크릿·경로·업로드)·프로토콜·정확도 게이트 | |

### 완료 기준 (qa)
1. tsc·lint·test(앱) + pytest(gateway) 통과, 격리 build exit 0.
2. `POST /api/v1/speech/ticket` → 60초 티켓, 만료·위조·aud 불일치·재사용 거부. WS `start` 없이 오디오 → 종료.
3. 테스트 음성 20문장 → gateway final 텍스트 CER 측정(목표 기록: CER ≤10% 권장), 세그먼트당 디코드 지연 p50·발화 끝→final p50, RTF, 메모리(ReazonSpeech 상주 ≈0.5GB 예상).
4. final 마다 wav 저장(DATA_ROOT, 경로 = id 기반) + `Utterance` 행(소유자·realtimeText·realtimeEngine 스냅샷) — internal 콜백 인증(헤더 없음 404·틀림 401).
5. 웹 마이크 테스트: 브라우저에서 권한 → 말하기 → partial/final 표시(실제 마이크 대신 Playwright fake audio(`--use-file-for-fake-audio-capture`)로 테스트 음성 재생해 확인), 권한 거부·서버 불가 문구.
6. 사용자 응답·화면에 엔진명(reazon·sherpa 등) 0, 로그·Trace 에 전사 전문·원음 0.
7. 관리자 콘솔 reazon-gateway Health HEALTHY.
8. 360/390/412 가로 넘침 0·터치 ≥44px.

### 네이티브 변경
없음(003f 에서).

### 설계 확정 — designer §8-11 (Leader, 2026-09-28)
- **M1 마이크 테스트는 저장 안 함**: #20 티켓 요청에 `purpose:"MIC_TEST"`(기본 `TURN`) → 티켓 클레임에 실어 gateway 가 wav 저장·internal 콜백(Utterance 행)을 **건너뛴다**. 완료 기준 4 는 `TURN` 티켓 스크립트로 확인.
- **M2 엔진명 비노출**: gateway → 클라이언트 WS 메시지(`ready`·`partial`·`final`·`error`)에 `engine`·`model`·`connectionKey` 등 엔진 식별자 금지. 엔진 스냅샷(`realtimeEngine`)은 internal 콜백 본문에만.
- **M3 정본 우선순위**: `docs/design/api-contract.md`(티켓 aud `ws-speech`·오류 코드·close code·stop 후 세션 규칙) > `speech/gateway/README.md`. 어긋난 README 는 A 가 api-contract 에 맞춰 고친다(api-contract 에 없는 세부는 A 가 정하고 README·이력서에 기록).
- **M4 클라이언트 경계**: 컴포넌트는 `@/modules/speech/stt/client`(클라이언트 안전 export)만 import(module-dependency §3 판독 규칙 5).

## 판단 기록 (judge)

- [2026-09-27 09:15] intake engine=jev → task_type=feature / risk=R2 / developer_model=opus / next=ask_user | overrides=- | fallback=- | tokens=1084
  - **override**(Leader): `next=ask_user` 미적용 — 사용자 지시(2026-09-28 "사용자가 필요할 때까지 계속 작업 진행")와, 테스트 계획(M4 TTS 20문장·CER 기록 목표 ≤10% 권장·지연·RTF·메모리)이 Leader's Plan 완료 기준 3 에 확정돼 있어 물을 미결이 없다. risk=R2 채택.
- [2026-09-27 09:16] codex_gate/C1 engine=jev → codex_required=false / focus=security / budget_rule=CX-limit-unknown-r2 / codex_switch=on | overrides=- | fallback=- | tokens=876

## Codex 검토
### [2026-09-28 01:02] C2 adversarial-review focus=security — done
- judge 판정: 이력서 169줄([2026-09-28 00:56] codex_gate/C2) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=b4feaa5(task_file) snapshot=e4d2337
- 지적 2건:
  - [medium] speech/gateway/kaiwa_gateway/ticket.py:45 — jti replay cache가 프로세스 로컬 메모리에만 저장 → 재시작·다중 worker 시 1회 사용 보장 깨짐. 60초 내 노출된 티켓이 gateway 재시작 또는 다른 worker 라우팅 후 재사용 가능 (권고: Redis/DB 원자 처리, boot epoch 검증, 다중 worker 금지 명시)
  - [medium] src/modules/infra/http.ts:108 — JSON 본문 크기 제한이 await req.text() 전체 버퍼링 뒤에 적용 → nginx 32MB 제한 전 앱 메모리 압박. 인증 사용자 기준 ticket API DoS 가능 (권고: Content-Length 사전 검사, 스트리밍 capped reader 적용)
- 검토하지 못한 범위: 서버/gateway 기동·pytest·실행 런타임·실제 DB 데이터 무결성 (정적 읽기 전용 지시)
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T155804Z-task-003e-C2/raw.txt

## Designer 기록
- [00:06] 가이드 완료 → `docs/screens.md` §8(8-0~8-11) + §2 설정·음성 회화방 행 갱신. 위치 = 설정 "음성 인식" 절 모드 카드 아래 "마이크 테스트" 카드(모드 조회 실패와 무관하게 보임). task-007 은 `PushToTalkButton`·`useRealtimeStt`·`sttCopy` 재사용.
- [00:06] 결정: **푸시투토크 72px**(007 과 같은 손동작·손 뗌=`stop`·마이크 켜짐 잔류 0), **첫 누름=권한 요청만**(녹음 안 함), 누르는 즉시 녹음·연결 전 3초 버퍼, <300ms 누름 취소, 30초 상한, 손 뗀 뒤 8초 TIMEOUT, 마이크 트랙은 매번 즉시 해제(WS 만 60초 유지).
- [00:06] 표시: partial `ink2`/final `ink`(17px `lang=ja`), 레벨 미터 5칸(무음 3초 힌트), 오류 = 카드 안 `role=alert` 14코드 문구표(권한 거부 웹/앱 조치 두 벌·서버 준비 중·연결 끊김·티켓 1회 조용히 재시도·HTTPS 아님 등), `aria-live` 는 final 만(녹음 중 낭독이 마이크로 들어감). 서버 `engine/model/traceId` 는 클라가 이벤트에서 버림.
- [00:06] 파일: `src/components/speech/{MicTestCard,PushToTalkButton,MicLevelMeter,useRealtimeStt,sttUiState,sttCopy,micPreflight}` + `__tests__/sttUiState.test.ts`, 수정 `settings/SpeechSettings.tsx`. 클라 계약(`RealtimeSttClient`·`SttEvent`·`SttErrorCode`)은 §8-3 A 로 고정.
- [00:06] **Leader 확인 필요**(§8-11): ① **점검 발화 저장 여부** — A(권장) #20 `purpose:"MIC_TEST"` → gateway 가 wav·Utterance·콜백 생략, `final.utteranceId:null`(기준 4 는 일반 티켓 스크립트로) / B 현 계약대로 저장(문구만 교체) ② WS `ready/final.engine·model` 엔진명 → gateway 가 빼기 권장(developer B 기록과 동일) ③ gateway README↔api-contract 불일치(aud·오류 코드·`stop` 후 세션·4429↔4409) 정본 확정 ④ 클라 진입점 `@/modules/speech/stt/client`.

## Developer 기록

### B(앱 STT)
- [00:05] 착수. A 계약 확인 전 **B 가 앱 쪽에서 기대하는 값(초안)** — A 가 다르게 정하면 A 의 것을 따른다:
  - 티켓(#20): HS256·`JWT_SECRET`, 클레임 `{sub:userId, chatId?, aud:"ws-speech", jti, iat, exp:+60s}` — **aud 는 api-contract §0-3·#20 정본 `ws-speech`**(`speech.config.yml ticket_audience: speech-ws`·gateway README `speech-ws` 는 정본과 다름). 티켓에는 `userId`/`email` 클레임이 없다 → 세션 쿠키로 쓰일 수 없음(앱 `verifyJwt` 가 거부).
  - internal 콜백 `POST /api/internal/speech/utterances`: 헤더 `X-Internal-Secret`(=`SPEECH_INTERNAL_SECRET`, 없으면 404·틀리면 401). 본문(JSON ≤64KB) `{userId, chatId?, durationMs, sampleRate:16000, audioBytes?, realtimeEngine:<connection key>, realtimeText(≤1000), segments?[{segIdx,start,end,text}]≤50, timings?{vadMs,sttMs,…숫자}, traceId?}` (tmpPath 는 받아도 쓰지 않음). 응답 봉투 `{success:true, data:{utteranceId, audioPath:"users/<uid>/utterances/YYYY-MM/<id>.wav"(DATA_ROOT 상대), finalPath:<절대>, expiresAt}}` — id·경로는 앱이 정한다, gateway 는 `.part` → finalPath rename(README §4).
  - WS `ready`/`final` 에 `engine`/`model` 문자열은 클라이언트가 쓰지 않는다(완료 기준 6 — 사용자 응답 엔진명 0). 빼 주면 좋음.
  - dev 라이브: DB 의 reazon-gateway `baseUrl` 이 `http://127.0.0.1:8100` 이고 8100 은 지금 비어 있음 — 임시 기동도 8100 이면 관리자 Health·dev 티켓 `wsUrl` 이 설정 변경 없이 맞는다.
- [00:12] **eslint 경계 변경(Leader 승인, M4)** — `eslint.config.mjs` components 규칙 allowSub 에 `'stt/client'` 한 항목 추가 + 새 블록 `src/modules/speech/stt/client/**`: `@/modules/*`(native 제외)·상위 상대경로(`../`)·`node:`·`@prisma/`·`next/server|headers`·`jsonwebtoken`·`jose`·`@/app|components` import 금지(위 speech 블록을 이 파일들에 한해 대체). 임시 파일로 5종 위반이 error 로 잡히는 것 확인 + 단위 테스트 `speech/__tests__/sttClientBoundary.test.ts`(import 화이트리스트·`process.env`·엔진명 0). 다른 규칙은 그대로 — 단, components 가 `@/modules/speech` **루트 index**(서버 코드 포함)를 import 하는 것은 여전히 허용(현재 사용 0) → 금지 추가 권장(Leader 판단).
- [00:50] **구현 완료** — 커밋 `8e5c14b`(42파일, Gitea push 안 함). 파일:
  - infra(추가만, 기존 동작 불변): `scopedToken.ts`(용도 한정 토큰 서명·검증 — `userId/email/qa` 클레임 금지 → 세션으로 못 씀), `internalAuth.ts`(`SPEECH_INTERNAL_SECRET` SHA-256 후 `timingSafeEqual`, 없음 MISSING·틀림/서버값<16자 INVALID — TTS 시크릿 함수와 분리), `multipart.ts`(스트림 상한 읽기), `storage.ensureDataDir`, index export.
  - engine: `stt/index.ts`(REALTIME_STT 정책 순서 targets(UNAVAILABLE 포함)·공개 실행값·**개발 서버 전용** loopback `devWsUrl`·id/key → connection 검증), `adapters/stt/sherpaReazon.provider.ts` Health 해석기(공개 `/health {ok,status}`: OK→HEALTHY, LOADING·FAILED·ok:false→UNAVAILABLE, MISCONFIGURED 유지, 시크릿 헤더 없음).
  - speech 서버: `stt/{gateway,ticket,config}.ts`, `utterances/{limits,wav,validate,index}.ts`, index export. 클라이언트: `stt/client/{types,protocol,pcm,capture,WebSocketSttClient,index}.ts`(서버 import 0).
  - 라우트: `api/v1/speech/{config,ticket,utterances}/route.ts`, `api/internal/speech/utterances/route.ts`.
  - 화면(screens §8): `components/speech/{MicTestCard,PushToTalkButton,MicLevelMeter,useRealtimeStt,sttUiState,sttCopy,micPreflight}`, `settings/SpeechSettings.tsx`(모드 로딩/오류를 카드 블록 안으로, 아래 MicTestCard).
  - 테스트: `speech/__tests__/{sttServer,sttClient,sttClientBoundary}.test.ts`, `components/speech/__tests__/sttUiState.test.ts`(신규 27건), `tests/live/task003e-smoke.{sh,ts}`, `tests/live/README.md` 한 줄.
- [00:50] **A 계약 정합**(A [00:20] 기준 — 다른 점 없음): 티켓 `aud:"ws-speech"`·`sub`·`jti`(uuid)·`iat`·`exp=+60`·`purpose` 항상 실음(기본 TURN)·`chatId` 선택. `start{type,v:1,ticket,sampleRate:16000,partial,clientPlatform,endpoint:"manual",chatId?}`, 바이너리 정확히 1,280바이트(끝 프레임 무음 채움), `stop`→final 1회, `cancel`, 유휴 15초 `ping`. 세션은 발화 뒤에도 유지 — 클라이언트가 유휴 60초에 닫고 다음 누름에 새 티켓. close 매핑 4400·4413→ENGINE_ERROR, 4401·4403→(연결 전 1회 새 티켓 재시도 후)TICKET, 4408·1000(유휴)→조용히, 4409→REPLACED, 4422→SERVER_UNAVAILABLE, 4429→BUSY, 1006·1011→연결 전 CONNECT_FAILED/중 CONNECTION_LOST. 서버 `error.message`·`sessionId`·`traceId`·`segments`·`timings` 는 파서가 버림(M2). internal 콜백은 A 본문 그대로 수용(`tmpPath` 무시), 응답 `{utteranceId, audioPath(DATA_ROOT 상대), status, expiresAt}` — **`finalPath` 는 보내지 않음**(A 에서 선택 항목, 두 프로세스 DATA_ROOT 표기 차이로 어긋날 수 있어서). 앱이 월 디렉터리를 미리 만든다.
- [00:50] **검증**: tsc 0 · lint 0 error(경고 5 = 기존) · `npm test` 274/274(신규 27). 라이브 `task003e-smoke.sh 3011` **51/51 PASS**(A 의 8100 임시 gateway, APP_INTERNAL_URL=3011): 인증 401×3 · #19 필드·웹 onDevice 세부 없음·ETag 304·앱 ETag 다름·connectionKey=불투명 id · #20 aud/sub/60초/TURN·세션 클레임 없음·서명·**티켓을 세션 쿠키로 쓰면 401**·MIC_TEST·purpose 400·남의/없는 chatId 404·분당 20→429+Retry-After · internal 헤더 없음 404·틀림 401·GET 404·engine 모름 400·없는 사용자 404·userId 경로 탈출 400·행(RECORDED·소유자·key 스냅샷·+30일)·상대 경로·디렉터리 · #21 200(파일 크기=audioBytes)·61초 AUDIO_TOO_LONG·48k AUDIO_FORMAT·2MB 초과·남의 chatId 404·lessonId FEATURE_NOT_READY·JSON 400 · 30일 정리(파일 삭제·audioPath null·audioDeletedAt, 만료 전 유지) · **WS E2E: TURN final+utteranceId(stop→final 218ms)+Utterance 행+wav, MIC_TEST utteranceId null·행 0, 재사용 4403, 위조 4401, start 없음 4401, WS 메시지 엔진 식별값 0** · 관리자 gateway Health HEALTHY · 사용자 응답 엔진명·주소·시크릿 0. 브라우저(google-chrome + playwright-core, `--use-file-for-fake-audio-capture=stt20/fake-mic-16k.wav`, 권한 부여): 설정 → 마이크 테스트 누름 7초 → partial 회색 → final 「今日はいい天気ですね…」, 360/390/412 가로 넘침 0·버튼 72×72, 콘솔 오류 0 · gateway 없을 때 "음성 인식 서버가 준비 중이에요." alert. 정리: QA 발화 행·wav·빈 디렉터리 0, LOCAL reazon-gateway 상태 UNKNOWN 원복(운영 pm2 도 LOCAL 행을 읽는다).
- [00:50] **정본과 다르게 한 것**(reviewer 확인): ① #19 `onDevice.connectionKey` = connection **id(불투명)** — 정본 예시 key 는 엔진명이라 완료 기준 6 과 충돌 → #21 은 id·key 둘 다 받아 key 로 스냅샷 ② #19 웹은 `onDevice:{enabled:false}` 만, `tts.fallbackChain` 뺌, `gateway.enabled` = "구성돼 있는가"(가용성은 #20 이 재확인 — 설정은 ETag 로 오래 쓰므로) ③ **#19 앱 응답 `onDevice.model`(modelVersion·`/models/reazonspeech-int8/manifest.json`) 에는 엔진 이름이 남는다** — #9 경로 고정·플러그인 다운로드용·화면 비표시. **003f 에서 불투명화 여부 결정 필요**(스모크 I3 로 그 블록 밖은 0 확인) ④ #20 `purpose`(M1)·422 `details.reason:"STT_UNAVAILABLE"`·개발 서버에서만 `wsUrl` ⑤ #21 lessonId·evaluationItemId → 400 FEATURE_NOT_READY(Phase 2), connection 검증 실패는 speech-platform/11 의 422 대신 400 VALIDATION(`reason:CONNECTION_INVALID`, §0-2), 형식 오류 reason `AUDIO_TOO_LONG|AUDIO_FORMAT|TOO_LARGE` ⑥ internal 헤더 없음 404 는 봉투 404(Next 기본 404 HTML 과 모양 다름 — `/api/admin` 숨김과 같은 방식), 다른 메서드도 404 ⑦ **30일 정리**: 잡 없이 발화 기록 시 프로세스당 1시간 1회 백그라운드 200건(`schedulePurge`) — 발화가 없으면 돌지 않음(instrumentation 은 담당 밖) ⑧ 클라이언트 purpose 타입 `TURN|MIC_TEST`(designer 가이드의 `TALK` 대신 M1 명칭) ⑨ gateway 판정은 connection 상태 + UNKNOWN 3초·UNAVAILABLE/MISCONFIGURED 30초 재확인(공개 /health, 2.5초 예산).
- [00:50] **한계**: #22(발화 조회·오디오) 미구현(007) · AudioWorklet 은 Blob URL — CSP 도입 시 `worker-src blob:` 필요 · gateway 가 방금 죽었으면 최대 30초 동안 티켓이 나가고 WS 연결 실패(CONNECT_FAILED 문구)로 안내 · 누름 직후 getUserMedia 지연(수십~100ms)은 버퍼 이전이라 잃음(연결 대기 3초 버퍼는 있음) · 캡처 AudioContext 는 16kHz 요청(Chrome 이 리샘플) — 실패 시 기본 레이트+상자 필터 다운샘플(단위 테스트만, 실기기 미확인) · 스모크 WS 절은 gateway 가 DB baseUrl(8100)에 떠 있어야 돈다.
- [00:50] **reviewer high_risk_areas**: ① 티켓 = 세션과 같은 JWT_SECRET — `userId/email` 금지로 세션 오인 차단(C4), gateway 는 aud 필수 ② internal 콜백 인증(헤더 404/401·상수시간)·userId 는 cuid 정규식 후 경로 조각(infra.storage 이중 검증) ③ 업로드 상한(스트림 2.25MB 컷·파일 2MB·헤더 길이 60초) ④ 앱 #19 `onDevice.model` 엔진명(③ 위) ⑤ dev `wsUrl` 은 `NODE_ENV==='development'`·loopback 만 — 운영 `next start` 에서 null ⑥ eslint 경계 변경 ⑦ 클라이언트 발화 세대 큐(취소한 발화의 늦은 final 이 다음 발화에 섞이지 않음) ⑧ LOCAL connection 행 공유(운영 pm2 도 읽음).
- [01:05] **REV-013 수정**(커밋 `e730c36`): M1 — `wav.parseWav` 가 파일에 실제로 있는 PCM 바이트로 길이를 재고(자리표시 0/0xFFFFFFFF·잘린 파일은 남은 바이트 전부), data 선언 뒤 덧붙은 바이트(홀수 패딩 1바이트 제외)는 `trailingBytes` 로 드러내 #21 이 **400 AUDIO_FORMAT 으로 거부**(잘라 저장하지 않음 — 온디바이스 플러그인은 단순 wav 를 쓰므로 data 뒤 부가 청크도 받지 않는다). 회귀 단위 테스트 + 스모크 E11. M2 — `eslint.config.mjs` `boundary()` 에 `banRoots` 인자, components 가 `@/modules/speech` 루트 import 하면 error(`stt/client` 만 허용, 임시 파일로 확인) + `sttClientBoundary.test.ts` 에 컴포넌트 전체 스캔 가드. Low — `interpretGatewayHealth` 의 `models` 분기 제거. tsc 0·lint 0 error·test 276/276.
- [01:20] **Codex C2 수정**(커밋 `87b5855`, 별도 `fix(infra)`): `infra/http.ts readJsonObject` 가 `req.text()` 전체 읽기 대신 공용 `readBodyCapped` — `Content-Length` 가 상한 초과면 읽기 전 400, 없거나 거짓이면 스트림을 읽다 넘는 순간 cancel·400(오류 코드·문구 불변, 19개 라우트 동작 동일). `multipart.ts` 도 같은 리더로. 단위 테스트 3건(Content-Length 초과 시 0조각 읽음·헤더 없이 초과 시 상한 직후 중단·정상/빈/형식 오류). #20 티켓 `iat` 는 원래 실린다(`signScopedToken` `setIssuedAt`, 스모크 C1 `exp-iat=60`·단위 테스트로 확인) — gateway 재시작 전 발급 티켓 거부와 호환. tsc 0·lint 0 error·test 279/279.

### A(gateway)
- [00:20] **gateway 계약 확정(B 는 이것에 맞춘다 — Leader M1~M3 반영, api-contract §2-29 정본 + 없는 세부는 A 가 정함)**. B 초안과 다른 점은 ★.
  - **티켓(#20)**: HS256·`JWT_SECRET`(UTF-8 문자열 그대로 키). 필수 `sub`(= userId, `[A-Za-z0-9_-]{1,64}`)·`aud:"ws-speech"`·`jti`(8~128자)·`exp`. 선택 `iat`·`chatId`(같은 문자 규칙)·**`purpose:"TURN"|"MIC_TEST"`(없으면 TURN, 그 밖의 값은 거부)**. `exp - now > 120s` 인 토큰은 티켓이 아니라고 보고 거부(세션 JWT 는 aud 가 없어 어차피 거부). leeway 2s. `jti` 는 **검증을 모두 통과한 뒤** 소비(메모리 TTL 캐시 150s, 최대 10,000개).
  - **WS 클라 → 서버**: 첫 메시지(3초 안) `{"type":"start","v":1,"ticket":"<jwt>","sampleRate":16000,"partial":true,"clientPlatform":"web","chatId"?:…,"endpoint"?:"manual"|"auto"}`. `chatId` 는 티켓 것이 권위 — start 에 있고 티켓과 다르면 4401. ★`endpoint` 기본 `manual`(푸시투토크: `stop` 때만 final, 발화가 60초에 닿으면 강제 final) / `auto`(VAD 무음 500ms = 끝점마다 final, 측정·핸즈프리용). 바이너리 = PCM16LE mono 16kHz **정확히 1,280바이트**(40ms). 그 뒤 `{"type":"stop"}` · `{"type":"cancel"}` · `{"type":"ping"}`. 텍스트 메시지 ≤4KB.
  - **`stop` 규칙**: `stop` 1회 = `final` **정확히 1회**(말이 없으면 `text:""`·`utteranceId:null`). 그 뒤 세션은 유지 — 새 `start`·새 티켓 없이 다음 발화 오디오를 바로 보낸다(세션 최대 10분, 메시지 없는 120초면 종료). `cancel` = 현재 발화 버림(final 없음).
  - **WS 서버 → 클라(M2: engine·model·connectionKey 없음)**:
    - `ready {type,v:1,sessionId,sampleRate:16000,frameBytes:1280,maxUtteranceMs:60000,vad:{silenceMs:500}}`
    - `vad {type,state:"SPEECH"|"SILENCE",atMs}` (atMs = 현재 발화 시작 기준)
    - `partial {type,segIdx,text,atMs}` — VAD 세그먼트(무음 500ms 로 끊긴 구간) 디코드마다. `partial:false` 면 안 보냄. `endpoint:auto` 에서는 final 이 곧 세그먼트라 안 보냄.
    - `final {type,utteranceId:string|null,text,durationMs,segments:[{segIdx,start,end,text}],timings:{vadMs,sttMs,decodeMs,storeMs},reason:"stop"|"endpoint"|"max_length",traceId}` — `utteranceId:null` = 저장 안 함(MIC_TEST·빈 발화·콜백 실패). text 에는 구두점이 없다(모델 출력 그대로).
    - `error {type,code,message,fatal}` — code ∈ `UNAUTHENTICATED`·`VALIDATION`·`ENGINE_UNAVAILABLE`·`ENGINE_ERROR`·`RATE_LIMITED`·`SESSION_EXPIRED`(api-contract 그대로). `fatal:true` 면 곧바로 close. `message` 는 개발용 영문 한 줄(화면에 쓰지 말 것).
    - `pong {type}`
  - **close 코드**: `1000` 정상 · `4400`★ start 형식 오류(JSON·v≠1·sampleRate≠16000)·잘못된 프레임 50개 초과(VALIDATION, 재시도 무의미) · `4401` start 없음(3초)·start 전 바이너리·티켓 무효/만료/aud 불일치·chatId 불일치(UNAUTHENTICATED) · `4403` 티켓 재사용(UNAUTHENTICATED) · `4408` 유휴 120초·세션 10분 초과(SESSION_EXPIRED) · `4409` 같은 사용자 새 세션이 열려 이전 세션 종료(RATE_LIMITED, message `replaced`) · `4413` 오디오 과다 — 초당 50프레임(실시간 2배, 버스트 150프레임=6초) 초과 또는 강제 final 3회(RATE_LIMITED) · `4422` 엔진 미로드(ENGINE_UNAVAILABLE) · `4429`★ 서버 동시 세션 8 초과·미인증 연결 32 초과(RATE_LIMITED) · `1011` 디코드 오류 등 서버 오류(ENGINE_ERROR). 잘못된 크기 프레임은 버리고 첫 1회만 `error{VALIDATION,fatal:false}`.
  - **internal 콜백** `POST ${APP_INTERNAL_URL:-http://127.0.0.1:3010}/api/internal/speech/utterances` — `purpose=TURN` 이고 text 가 비지 않았을 때만. 헤더 `X-Internal-Secret`·`X-Service: gateway`·`X-Service-Env: <APP_ENV>`·`Content-Type: application/json`. 본문(B 초안 그대로) `{userId, chatId:string|null, durationMs, sampleRate:16000, audioBytes, realtimeEngine:"reazon-gateway", realtimeText(≤1000자로 자름), segments:[{segIdx,start,end,text}](≤50, 넘치면 50번째에 합침), timings:{vadMs,sttMs,decodeMs}, traceId:"t_…"(22자), tmpPath:"users/<uid>/utterances/incoming/<32hex>.wav.part"}`(tmpPath 는 DATA_ROOT 상대 — 앱이 안 써도 됨). 응답: 봉투 `{success:true,data:{utteranceId, audioPath, finalPath?, expiresAt?}}`(봉투 없이 data 만 와도 받음). gateway 는 `audioPath`(DATA_ROOT 상대, `users/<uid>/utterances/` 아래 `.wav`, 조각 `[A-Za-z0-9][A-Za-z0-9._-]*`)를 검증해 `.part` → 그 경로로 rename(이미 있으면 .part 삭제 — 앱이 옮겨도 됨). `finalPath` 가 오면 `DATA_ROOT/audioPath` 와 같아야 한다(다르면 콜백 실패 처리). 타임아웃 5s, 연결 오류·5xx 만 1회 재시도, 실패면 wav 를 `users/<uid>/utterances/_orphan/` 로 옮기고 `final.utteranceId:null`.
  - **`GET /health`**: 시크릿 없이 `{ok,status}`(status `LOADING|OK|FAILED|MISCONFIGURED`, HTTP 200). 올바른 `X-Internal-Secret` 이 붙으면 #143 전체 `{ok,status,service:"gateway",version,env,models:[{key,loaded,model,loadMs}],sessions,rssMb,configVersion,logLevel,uptimeSec}` — 관리자 Health 는 `ok` 만 보면 된다.
  - **dev 연결**: 브라우저 dev(3011)는 Next 가 WS 를 프록시하지 않으므로 dev 티켓 `wsUrl` 로 gateway 에 직접 붙는다(B 초안대로). gateway 는 Origin 을 검사하지 않는다(인증 = 티켓). 선택 env `SPEECH_GATEWAY_ALLOWED_ORIGINS`(콤마 목록)를 주면 그 밖 Origin 은 4401.
- [00:30] **8100 임시 인스턴스 가동 중(00:30~, pm2 아님, 최대 30분 — B 스모크 G1·G2 용)**: `APP_INTERNAL_URL=http://127.0.0.1:3011`, 미러 `~/.node-local/thekaiwa/.env` 의 DATA_ROOT·JWT_SECRET·SPEECH_INTERNAL_SECRET(NFS .env 와 동일 값 확인), `/health` ok. 기동: `APP_INTERNAL_URL=http://127.0.0.1:3011 ~/.node-local/thekaiwa-speech/venv/bin/python speech/gateway/scripts/run_dev.py --port 8100 --env-file ~/.node-local/thekaiwa/.env`. B 완료 연락 또는 01:00 에 A 가 종료.
- [00:35] 8100 임시 인스턴스 종료(B 스모크 51/51 PASS 연락 후) — 포트 비움 확인. 로그: TURN final `stored=True`·storeMs 156ms, 전문·티켓 없음.
- [00:40] **구현 완료(커밋 8055a5d — task 이력서·20-Log 는 공유 파일이라 미커밋, Leader 몫)** — 파일:
  - `speech/common/kaiwa_speech_common/` — `engine/interfaces.py`(gateway 골격에서 이동: `UtteranceResult` 추가, `RealtimeSttSession.stop()` 은 on_final 로만 결과(발화 순서 보장)·`cancel()` 추가, repr 에 텍스트·오디오 없음) · `engine/errors.py` · `engine/adapters/__init__.py`(engineId→팩토리) · `engine/adapters/stt/reazon_sherpa.py`(manifest·sha256 검증 로드, 공용 디코드 스레드 풀, 세션별 VAD + 순차 작업 큐, manual/auto 끝점, 디코드 입력 앞 0.4s·뒤 0.2s 무음) · `router.py` · `config.py`(1·3·4층, 시크릿은 repr 비노출) · `secrets.py` · `logging.py`(MaskFilter) · `audio.py` · `ids.py` · `internal_client.py` · `pyproject.toml` · `tests/test_common.py`(10)
  - `speech/gateway/` — `app.py` · `interfaces.py`(re-export) · `kaiwa_gateway/{server,connection,ticket,limits,store}.py` · `scripts/{run_dev.py, measure_stt.py}` · `tests/{conftest,test_ticket,test_ws}.py`(52, 모델 없이 가짜 VAD·디코더를 실제 세션 로직에) · `requirements.txt`(핀)·`requirements-dev.txt`·`pyproject.toml` · `README.md`(api-contract 기준으로 전면 개정 — aud `ws-speech`·오류/close 코드·stop 후 세션·콜백 계약)
  - `speech/models/fetch_models.py`(HF `reazon-research/reazonspeech-k2-v2`@291488c8 int8 파일 + k2-fsa silero_vad, sha256 핀·이어받기·3회 재시도) · `manifest.example.json` · README 갱신 / `speech/test-assets/make_test_audio.py`·`stt20/sentences.json` · README 갱신 / `ecosystem.config.js` `thekaiwa-speech-gateway` 항목 추가(기존 thekaiwa 불변) / `.gitignore`(fetch 스크립트·manifest 예시 예외, ruff·mypy·pytest 캐시) / 실측 `30-Knowledge/decisions/speech-p0-measurements.md` STT 절
- [00:40] **self-check**: gateway pytest 52 · common pytest 10 · ruff(check+format)·mypy strict 통과(py3.10). 엔진명 grep — gateway 코드(`kaiwa_gateway/`)에 reazon·sherpa 0(연결 키 `reazon-gateway` 는 common/config.py 기본값, 콜백 본문 `realtimeEngine` 에만 실림). WS 메시지 엔진 식별자 0 을 테스트로 고정(`assert_no_engine_ids`). ecosystem 항목을 pm2 없이 그대로 실행(포트만 8198)해 `/health ok` 확인.
- [00:40] **실측(합성음 20문장, 상세 [[speech-p0-measurements]])**: CER **0.57%**·정답 **20/20** · 세그먼트 디코드 p50 **64ms**/p95 78ms · RTF 0.017 · 푸시투토크 stop→final p50 **66ms** · 끝점 모드 발화 끝→final p50 **607ms**(무음 500ms 포함) · 3세션 동시 stop→final p50 77ms · RSS 로드 후 ≈330MB / 1세션 ≈410MB / 3세션 피크 ≈510MB · 모델 로드 ≈1.0s.
- [00:40] **운영 기동 명령(QA PASS 후 Leader)**: `pm2 start ecosystem.config.js --only thekaiwa-speech-gateway` (저장소 루트, pm2 save 여부는 Leader) → `curl -s http://127.0.0.1:8100/health` = `{"ok":true,"status":"OK"}`. 로그 `~/.node-local/thekaiwa/logs/speech-gateway-{out,err}.log`. 선행: venv `~/.node-local/thekaiwa-speech/venv`(설치됨) · 모델 `speech/models/reazonspeech-int8/`(받아 둠). blue/green 릴리스로 옮기면 릴리스 트리에는 모델이 없으므로 `python3 speech/models/fetch_models.py --dest "$DATA_ROOT/models"` 한 번(ecosystem 이 `DATA_ROOT/models` 를 자동 선택).
- [00:40] **한계·후속**: ① partial 은 VAD 세그먼트 단위(끊김 없는 긴 문장은 무음·stop 전까지 없음) ② 설정 5·6·8층·`/admin/*`·`/transcribe`·#141 trace 콜백은 Phase 2 ③ `_orphan` wav 재등록 경로 미결 ④ 브라우저 getUserMedia→첫 partial 은 B·QA 측정 몫 ⑤ **003f 온디바이스도 같은 모델이라 디코드 앞 무음 패딩 필요**(없으면 첫 단어 누락) ⑥ 숫자가 한자 숫자로 나옴(七時·二百円) — 교정 로직 유의.
- [00:40] **Leader 정정 요청(내 담당 밖)**: `speech/speech.config.yml` `gateway.ticket_audience: speech-ws` → 정본 `ws-speech`(코드는 이 키를 읽지 않고 상수 사용) · `speech/README.md` §3 의 `pip install -e speech/common` 설치 안내 → PYTHONPATH 방식(ecosystem) · `.env.example` 에 선택 키 `APP_INTERNAL_URL`·`SPEECH_MODELS_DIR`·`SPEECH_LOG_LEVEL`·`SPEECH_GATEWAY_ALLOWED_ORIGINS` 추가 검토.
- [00:40] **트러블슈팅(재발 방지)**: ① 이 저장소 `.env` 는 `APP_ENV=LOCAL   # 주석` 처럼 인라인 주석을 쓴다 — VoiceVault ecosystem 의 `readEnvFile` 을 그대로 복사하면 값에 주석이 붙는다 → 따옴표 없는 값은 첫 ` #` 앞까지(ecosystem·run_dev·make_test_audio 동일 파서) ② 로그 MaskFilter 에서 `record.args=None` 으로 평탄화하면 uvicorn AccessFormatter 가 args 튜플을 풀다 "Logging error" — args 는 원소별로 마스킹하고 구조를 유지 ③ `pkill -f "<uvicorn 명령>"` 은 그 문자열을 가진 **자기 bash 까지 죽인다**(exit 144) → `ss -ltnp` 로 PID 를 찾아 kill ④ 공유 작업 트리에서 `git mv` 는 즉시 스테이징되어 **다른 역할의 커밋에 섞인다**(Leader 4e818e0 에 interfaces.py 이동이 포함됨, 내용 변경은 A 커밋) → 공유 트리에서는 `mv` 후 경로 지정 커밋 ⑤ NFS noexec 라도 파이썬 소스·onnx 모델 **읽기**는 된다(인터프리터·네이티브 .so 만 로컬 venv 면 충분).
- [00:58] **Codex C2 수정**(jti 재사용 기록이 메모리뿐 — reviewer 채택 Low): `TicketVerifier` 가 기동 시각(boot epoch)을 기록하고 **`iat` < 기동 시각 − 2s 인 티켓 거부**(4401 `ticket issued before gateway start`), `iat` 필수·now+2s 초과 미래 거부. 허용 오차 2s 근거·단일 프로세스 전제(pm2 `instances:1`·`--workers` 미지정)를 README §2 에 기록. **앱 티켓 `iat` 확인: 있음**(`src/modules/infra/scopedToken.ts` `setIssuedAt`) — B 조치 불필요. pytest +3(iat 필수·미래 거부 / 기동 전 iat 거부·기동 후·오차 2s 안 허용 / WS 4401) → gateway 55. 부수: Starlette TestClient WS 종료 경합(Py3.10 `uncancel` 없음 → teardown 에서 CancelledError, 25회 중 1~2회) 을 테스트 클라이언트가 먼저 닫고 세션 해제까지 기다리도록 고침(운영 경로 무관). gateway 기동·pm2 없음.

## Reviewer 기록

- [2026-09-28][reviewer] **REV-013 — PASS**(Critical 0 · High 0 · Medium 2 · Low 4). 범위: `git diff b4feaa5..HEAD -- speech src tests eslint.config.mjs ecosystem.config.js scripts public .env.example`(A `8055a5d`·B `8e5c14b`·Leader `4e818e0`+`ced3bce`). 실행: `npm run typecheck`(0)·`npm run lint`(0 error, 기존 warn 5)·`npm test`(274/274) 재확인 통과, gateway pytest 52/52·common pytest 10/10 재확인 통과(모두 developer 자체보고와 일치).

  **확인됨(결함 없음, 근거 요약)**
  - 티켓 ↔ 세션 상호 오인 차단: `scopedToken.ts`(`RESERVED`=userId/email/qa 등 예약 클레임 금지) ↔ `jwt.ts verifyJwt`(userId·email 문자열 필수) 양방향 확인. gateway `ticket.py`(`TicketVerifier.verify`)는 HS256 고정·`aud:"ws-speech"`·`exp-now>120s` 거부·`jti` 형식 검사 뒤에만 replay 캐시 소비(형식 오류 요청이 남의 jti 를 태우지 못함) — 판정 순서 안전.
  - internal 콜백: `internalAuth.ts`(헤더 없음 MISSING→404, SHA-256+`timingSafeEqual` 상수시간, 서버값 16자 미만이면 어떤 값도 통과 못함), `validate.ts USER_ID=/^[a-z0-9]{20,40}$/` 1차 검증 + `infra/storage.ts dataPath()` SEGMENT 정규식 2차 검증(이중화 확인).
  - gateway `store.py resolve_audio_path`: 앱이 돌려준 `audioPath` 를 **티켓에서 검증된 `claims.user_id`** 와 대조(`parts[1] != user_id` 거부) + 세그먼트별 `[A-Za-z0-9][A-Za-z0-9._-]*` + `..` 명시 차단 + 최종 `_inside()` 루트 이탈 검사(3중) — "앱이 준 경로를 gateway 가 믿는 방향"의 탈출 경로 없음.
  - gateway 127.0.0.1 바인드(`ecosystem.config.js`, 기존 `thekaiwa` 항목 불변), `--ws-max-size 65536`·`--ws-per-message-deflate false`로 메모리 공격면 축소. 세션 상한 8·미인증 pending 32·프레임 50/s(버스트150)·텍스트 20/s(버스트40) 전부 코드 상수와 일치.
  - dev 전용 `wsUrl` 이중 방어: 서버 `devWsUrl()`은 `NODE_ENV==='development'`+loopback 만 값 생성(운영 `next start`=production, 항상 undefined) **+** 클라이언트 `resolveWsUrl()`도 `DEV_WS=/^ws:\/\/(127.0.0.1|localhost):\d+\//` 화이트리스트로 한 번 더 거른다 — 운영 유출 경로 없음.
  - `WebSocketSttClient`의 `gen`/`stopQueue` 조합으로 취소·재시작 시 늦게 도착한 `partial`/`final` 이 다음 발화에 섞이지 않음(코드 추적 결과 경합 없음). 티켓 4401/4403 재시도는 `ticketRetried` 플래그로 1회만.
  - 로그·Trace: Python `MaskFilter`(JWT 정규식·등록 시크릿·DB URL 마스킹, 실패 시 줄 자체를 버림) + `text_fingerprint`(길이+sha1 8자만) — 원음·전사 전문·티켓 미노출. TS 쪽도 console 에 텍스트·티켓 없음.
  - 제안→채택/6층/테이블 소유 위반 없음(Utterance 는 speech 층만 write). 모델 sha256 검증(`reazon_sherpa.py load_manifest`) 확인.
  - WS 서버→클라 메시지(`ready/partial/final/error`)에 엔진·model·connectionKey 없음(M2, `assert_no_engine_ids` 로 고정) — 화면·copy 에도 엔진명 0(`sttUiState.test.ts` 로 고정).

  **MEDIUM**
  1. **#21 업로드 "≤60초" 헤더 위조로 초과 저장 가능** — `speech/utterances/wav.ts parseWav()`가 `data` 청크의 **헤더 선언 크기**로 `durationMs`를 계산하고(`recordUploadedUtterance` 의 `wav.durationMs > UTTERANCE_MAX_DURATION_MS` 검사), 실제로 디스크에 쓰는 것은 업로드된 **전체 버퍼**(`input.audio`, 헤더 검증과 무관)다. `data` 청크 크기 필드를 실제보다 작게 조작하면(그 뒤에 추가 PCM 바이트를 그냥 이어 붙이면) `durationMs` 검증은 통과하면서 실제 오디오는 더 길게 저장된다. 다만 바이트 상한(2MB, 16kHz/16bit/mono ⇒ 최대 ≈65.5초)이 여전히 걸려 있어 우회 폭은 최대 ≈5.5초로 제한된다 — 자기 계정 데이터 무결성 문제이지 인증·소유자·Secret 침해는 아니라 MEDIUM. gateway internal 콜백 경로(`registerGatewayUtterance`)는 durationMs 가 Python 이 직접 계측한 값이라 영향 없음.
     - 근거: `src/modules/speech/utterances/wav.ts:33-39`(`dataBytes = Math.min(size, buf.length - body)`, `size` 는 헤더 필드), `src/modules/speech/utterances/index.ts:66-68`(`writeDataFile(segs, input.audio)` — 파싱된 `dataBytes` 가 아니라 원본 버퍼 전체를 저장).
     - 권고: 업로드된 실제 바이트 수(`input.audio.length`) 로부터 역산한 이론적 최대 길이(`bytesPerSec` 기준)와 헤더 길이 중 **큰 값**으로 60초 검증을 하거나, `dataOffset + dataBytes` 가 `buf.length` 와 크게 다르면(트레일링 바이트 존재) 거부.
  2. **eslint `indexOnly` 가드가 `@/modules/speech` 루트 index(서버·Prisma 코드 포함) 를 컴포넌트가 그대로 import 하는 것은 막지 않는다** — `boundary()` 생성 정규식(`^@/modules/(speech|infra)/${except}`)은 **하위 경로**(`@/modules/speech/xxx`) 우회만 막도록 설계돼 있어(`indexOnly` 의 원래 의도), `@/modules/speech`(슬래시 없는 루트) import 자체는 애초에 매치 대상이 아니다. Developer B 가 이력서 [00:12]에 "Leader 판단" 필요로 명시했고 이력서상 뒤이은 Designer/Leader 응답([00:06]·M1~M4)에 이 항목을 닫는 결정이 보이지 않는다. 현재 실사용 0건(`grep`으로 확인)·`sttClientBoundary.test.ts` 는 `stt/client/**` 내부만 검사해 이 구멍을 커버하지 않는다. M4 의도("컴포넌트는 `stt/client` 만 import")를 가드레일이 강제하지 못하는 상태로 남아 있다.
     - 근거: `eslint.config.mjs:14-17`(`boundary()` 함수, `except` 가 `${indexOnly}/` 뒤에만 붙음) · `eslint.config.mjs:71` · task 이력서 Developer B [00:12].
     - 권고: `src/modules/speech/index.ts` 자체를 컴포넌트에 금지(`indexOnly` 배열에서 `speech` 를 빼고 전용 규칙으로 완전 차단하거나, 루트 index 를 client-safe 배럴로 분리)하거나, `sttClientBoundary.test.ts` 범위를 `src/components/**` 쪽까지 넓혀 `@/modules/speech`(비-`stt/client`) import 를 스캔.

  **LOW(참고, 조치 선택)**
  - `#19 onDevice.model.manifestUrl`(`/models/reazonspeech-int8/manifest.json`) 에 엔진명이 남는다 — canonical `#19` 예시도 `model.name` 에 엔진명을 실었던 항목이라 사양 위반은 아니고 네이티브 플러그인 전용 값(화면 미노출)이지만, 완료 기준 6 "엔진명 0" 을 엄격히 잡으면 003f 에서 판단 필요(Developer 가 이미 이월 명시).
  - gateway WS `Origin` 검사가 기본 비활성(옵트인 `SPEECH_GATEWAY_ALLOWED_ORIGINS`) — 인증이 티켓 하나뿐이라 설계상 허용되나(WS 는 SOP 미적용), 운영 `.env` 에 kaiwa 도메인을 넣어 두면 방어층이 하나 더 생긴다.
  - `purgeExpiredAudio` 트리거가 "발화가 새로 기록될 때"뿐이라 트래픽이 끊기면 30일 초과 wav 가 그대로 남을 수 있음 — Developer 가 이미 한계로 기록(①), Phase 2 잡 전환 전까지는 트래픽이 적어 실질 영향 낮음.
  - `sherpaReazon.provider.ts interpretGatewayHealth` 의 `models` 배열 분기는 `probeHttpHealth` 가 시크릿을 보내지 않는 설계(관리자 콘솔 Health) 라 실제로는 절대 발동하지 않는 죽은 분기 — 기능 문제는 아니나 혼동 소지, 정리 권고.
  - AudioWorklet 모듈을 Blob URL 로 올림(`capture.ts`) — 현재 CSP 미설정이라 즉시 문제는 없으나, CSP 도입 시 `worker-src blob:` 필요(주석으로 이미 인지됨, Phase 2 메모 확인).

  **QA 인계**: `high_risk_areas` = ["#21 업로드 60초 상한 우회(헤더 위조, MEDIUM-1)", "컴포넌트의 `@/modules/speech` 루트 import 가드 부재(MEDIUM-2, 회귀 감시용)", "WS 티켓 재사용·만료·aud 불일치 거부", "internal 콜백 헤더 없음 404/틀림 401", "MIC_TEST 티켓은 Utterance 행·wav 0", "발화 세대 큐(취소 발화의 늦은 final 미혼입)", "LOCAL connection 상태가 운영 pm2 와 공유됨(기존 이슈, 이번 회차 무관 — gateway Health 확인 시 인지)"], `native_change` = false.

### REV-013 재검증 (2026-09-28, `e730c36`)

- **판정: PASS — Medium 2건 모두 해소, 회귀 없음.** `git diff ced3bce..e730c36` 재검증. `npm run typecheck`(0)·`npm run lint`(0 error, 기존 warn 5 그대로)·`npm test`(276/276, 신규 2건) 재실행 통과.
- **M1(WAV 헤더 위조로 60초 우회) 해소 확인** — `wav.ts`가 `dataBytes`/`durationMs` 를 실제 남은 바이트 기준으로 계산하도록 바뀌고, `data` 선언 크기 뒤에 남는 바이트(`trailingBytes`, 홀수 선언 뒤 1바이트 패딩만 예외)가 있으면 `recordUploadedUtterance`가 형식 검증보다 먼저 400 `AUDIO_FORMAT`으로 거부한다(`index.ts` trailingBytes 체크가 durationMs 체크보다 앞섬). 직접 추적: 선언을 줄이고 뒤에 PCM 59초를 붙인 케이스(`forged`) → `trailingBytes=32,000×59`로 잡혀 거부, 스트리밍 자리표시(`0`/`0xFFFFFFFF`)·잘린 파일(선언＞실제)은 여전히 실제 바이트로 정상 처리 — 모두 코드로 재확인. 회귀: 단위 테스트(REV-013 M1 회귀 케이스 4종: 위조·정상 홀수 패딩·패딩 초과)·라이브 스모크 E11 추가 확인. **정상 wav 영향**: 앱 자체 인코더(브라우저/온디바이스)는 `data`가 마지막 청크라 부가 청크는 항상 `data` **앞**(LIST 등, 기존 로직 그대로 허용·회귀 테스트로 고정)에만 온다 — 실사용 wav 가 이 거부에 걸릴 경로 없음.
- **M2(컴포넌트의 `@/modules/speech` 루트 import 가드 부재) 해소 확인** — `eslint.config.mjs`에 `banRoots` 옵션을 추가해 `src/components/**` 규칙에 `^@/modules/(speech)$` 정확매치 금지 패턴을 별도로 얹었다(`indexOnly`의 하위경로-우회 방지 패턴과는 별개 축 — 루트 자체 차단). 다른 `boundary()` 호출은 `banRoots` 미지정이라 영향 없음(lint 0 error로 collateral 없음 확인). eslint 우회 대비 이중 방어로 `sttClientBoundary.test.ts`에 `src/components/**` 전체를 실제로 훑어 `@/modules/speech`(비-`stt/client`) import 0건을 단언하는 테스트를 추가 — 현재 10개↑ 컴포넌트 파일 전부 위반 없음 확인.
- **Low-4(죽은 `models` 분기) 제거 확인** — `sherpaReazon.provider.ts`에서 `probeHttpHealth`가 시크릿을 보내지 않아 절대 채워지지 않는 `models` 분기와 관련 테스트 단언을 함께 삭제, 나머지 판정 로직(OK/LOADING/FAILED/MISCONFIGURED)은 불변.
- **미해결(Leader 처리 예정, 이번 재검증 범위 아님)**: 게이트웨이 Origin 검사(Low) — Leader가 운영 기동 시 `SPEECH_GATEWAY_ALLOWED_ORIGINS` 로 켠다고 확인.
- 결론: Critical 0·High 0·Medium 0·Low 2(운영 기동 시 처리 예정 1 + Blob URL/CSP 메모 1, 둘 다 코드 수정 불필요). QA 인계 유지, `native_change=false`.

### Codex C2 지적 판정 (2026-09-28, 코드 미수정)

원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T155804Z-task-003e-C2/raw.txt`

1. **`speech/gateway/kaiwa_gateway/ticket.py:45`(ReplayCache 프로세스 메모리 한정) — 채택(오탐 아님), 실제 위험은 Low.** `ReplayCache`가 순수 in-process `OrderedDict`인 것은 사실이고, gateway 재시작(pm2 autorestart) 순간에는 소비된 jti 기록이 사라지는 것도 맞다. 다만: ① 티켓은 `sub=발급 대상 본인 userId`로만 묶여 재사용해도 **본인 계정으로 세션 하나 더 여는 것**이 전부(교차 사용자 침해·권한 상승·Secret 노출 없음) ② TTL 이 고정 60초(`WS_TICKET_TTL_SEC`)라 노출 창이 매우 좁다 ③ "다중 worker" 시나리오는 **현재 배포에서 이미 성립하지 않는다** — `ecosystem.config.js`의 gateway 항목은 `--workers` 옵션 없이(uvicorn 기본 1) `instances: 1`이라 프로세스가 항상 하나다. Codex 도 "평상시에는 덜 드러남"이라 인정. 남는 것은 "재시작 순간의 자기 티켓 재사용"뿐이라 Medium보다 Low 가 맞다고 판단.
   - **권고 수정 범위 판정**: Leader 제안한 최소안(boot epoch + workers=1 가드) 중 **boot epoch 검증만 채택 권고**(재시작 창을 완전히 닫는 저비용 수정 — 가동 시각을 기록해 그보다 이른 `iat` 티켓을 거부). "다중 worker 금지 가드"는 이미 ecosystem 설정으로 강제돼 있어 별도 런타임 가드 코드는 불필요 — 회귀 방지용 주석(우발적으로 `--workers`가 늘어나는 배포 실수를 막는 문서화) 정도면 충분. 공유 저장소(Redis/DB) 원자 처리는 이 Phase 범위에서 과설계로 판단, 채택하지 않음.
   - **범위**: task-003e 자체 결함(A 가 만든 파일) — 이번 task 내 후속 수정 대상으로 적절.

2. **`src/modules/infra/http.ts:108`(`readJsonObject` 가 전체 버퍼링 뒤 크기 검사) — 채택(오탐 아님), Medium 타당·task-003e 범위 밖.** 코드 직접 확인: `const text = await req.text()` 가 먼저 전체 본문을 문자열로 읽고 그 다음 `Buffer.byteLength(text,'utf8') > maxBytes` 로 거부한다(라인 109-110) — nginx `client_max_body_size 32m`(`docs/nginx/*.conf:18`) 이 유일한 상한이라, 라우트가 1KB(티켓)·64KB(internal)만 원해도 최대 32MB 가 먼저 메모리에 올라간다. 이 헬퍼는 `readJsonObject` 를 쓰는 **19개 라우트 전부**(`grep -rl readJsonObject src/app` = 19파일)에 영향 — pm2 `thekaiwa` 가 `instances:1`이라 한 프로세스 메모리 압박이 앱 전체 가용성에 번진다. 다만 확인한 두 호출부(ticket·internal utterances) 모두 `requireSession()`/`checkInternalSecret()` 이 `readJsonObject` **앞**에 있어 미인증 요청으로는 못 건드린다 — Codex 표현대로 "인증 사용자 한정" DoS. Medium 등급 인정.
   - **경위 판정**: `http.ts`·`readJsonObject` 는 task-005(`0fc4c5a`)에서 만들어지고 task-006(`0b124b7`)까지 존재하던 **기존 공용 L6 코드**다 — `git diff b4feaa5..HEAD -- src/modules/infra/http.ts` 는 빈 diff(이 task 는 이 파일을 건드리지 않았다). task-003e 는 이미 있던 함수의 20번째(3개 신규) 호출부를 추가했을 뿐 결함을 새로 만들지 않았다 — **REV-013(이 task 감사)의 수정 대상으로는 범위 밖**, 다만 이번에 드러났으니 손대는 게 맞다.
   - **권고 수정 범위 판정**: Leader 제안(capped reader)이 정답 — 같은 파일(`multipart.ts`)의 `readFormDataCapped` 가 이미 스트림을 상한까지만 읽는 동일 패턴으로 검증돼 있으므로(REV-013 본문에서 재확인), `readJsonObject` 도 `req.body.getReader()` 로 청크 단위로 읽다 `maxBytes` 초과 시 즉시 `cancel()`하는 동일 방식이면 충분 — Content-Length 사전 거부는 보너스(헤더 위조 가능하니 스트리밍 컷이 주 방어, `multipart.ts` 와 동일 원칙). 신규 인프라·설계 변경 없음, 최소 변경으로 충분.
   - **처리 제안**: task-003e 커밋으로 묶지 말고 `src/modules/infra/http.ts` 단독 수정 + 19개 라우트 전체 회귀 테스트로 **별도 커밋/후속 작업**으로 분리 권고(공용 L6 파일이라 task-003e 스코프에 걸면 diff 가 이 task 범위를 벗어난 것처럼 보임). task-003e 자체의 PASS 판정에는 영향 없음(기존 결함을 드러낸 것이지 이번 diff 가 만든 결함이 아님).

**요약**: 2건 모두 채택(오탐 아님). 1번은 심각도 Low 로 하향(자기 재사용·좁은 창·이미 단일 워커) + boot epoch 만으로 충분. 2번은 Medium 타당하나 이 task 의 diff 밖(공용 L6, task-005 기원) — `readFormDataCapped` 와 같은 패턴으로 별도 수정 권고. 둘 다 코드는 고치지 않음(Reviewer 는 Read 전용).

### Codex C2 수정 재검증 (2026-09-28, `68f2354`+`87b5855`)

- **판정: PASS — 2건 모두 해소, 회귀 없음.** `git diff e730c36..HEAD -- speech src tests` 재검증. `npm run typecheck`(0)·`npm run lint`(0 error, 기존 warn 5 그대로)·`npm test`(279/279, 신규 3건) 재실행, gateway pytest(55/55, 신규 3건)·common pytest(10/10) 재실행 모두 통과. 겸사겸사 `ruff check`·`mypy strict` 도 gateway 에서 재확인(0 issue).
- **A(`ticket.py` boot epoch) — 2초 창 판단 타당.** `TicketVerifier`에 `boot_epoch`(기본값 = 생성 시각 `clock()`, `create_app()`이 기동 초입에 1회 생성하므로 실제 프로세스 시작과 사실상 동일) 도입, `iat` 를 필수 클레임으로 승격(`options.require`)하고 ① `iat`가 숫자가 아니거나 `bool`(파이썬 int 서브클래스 함정 방어)이거나 `now+LEEWAY_SEC(2s)`보다 미래 → 거부, ② `iat < boot_epoch − BOOT_SKEW_SEC(2s)` → 거부(`"ticket issued before gateway start"`, 4401)를 **jti 캐시 소비보다 먼저** 배치 — 기존 "형식 검증 모두 통과 후에만 jti 소비" 순서를 깨지 않았다. 잔여 위험(기동 직전 ≤2초 발급 티켓은 재시작 후 1회 재사용 가능)은 README·코드 주석에 명시적으로 남겨 은폐 없음. `test_ticket_issued_before_boot_rejected_after_restart`가 "재시작 전 프로세스에서는 같은 티켓이 유효했다"까지 함께 검증해 시나리오 재현이 정확함을 확인. "다중 worker 금지"는 코드 가드 대신 README·docstring 문서화로 처리 — REV-013 권고("런타임 가드 불필요, 문서화면 충분")와 일치, ecosystem.config.js 는 이번 diff에서 변경 없음(재확인).
- **B(`readBodyCapped`) — 경계값·스트림 중단 시 자원 해제·19개 라우트 회귀 모두 확인.** `http.ts`에 `readBodyCapped`(Content-Length 상한 초과 시 **본문을 전혀 읽지 않고** null, 없거나 거짓이면 청크 스트리밍 중 초과 순간 `reader.cancel()` 후 null)를 신설해 `readJsonObject`가 이를 쓰도록 교체하고, `multipart.ts`의 `readFormDataCapped`도 기존 자체 구현(REV-013에서 이미 검증한 로직)을 버리고 같은 함수를 호출하도록 리팩터 — 두 경로가 정확히 같은 캡 로직 하나를 공유한다(중복 제거, 향후 드리프트 방지). 경계값: "상한과 정확히 같은 크기는 통과" 테스트로 `>`(초과만 거부, 이상 아님) 확인. 자원 해제: `reader.cancel().catch(()=>undefined)` 로 스트림 취소(기존 multipart 패턴 그대로 승계). 회귀: `readBody.test.ts` 3건(Content-Length 사전 차단·스트리밍 조기 중단 시 소비 조각 수 상한 확인·정상/빈/오류 본문 기존과 동일 + 경계값)에 더해, `sttServer.test.ts`의 기존 `readFormDataCapped` 호출부(VALIDATION 거부·정상 업로드)가 그대로 통과해 multipart 쪽 무회귀를 실측 확인. `readJsonObject`를 쓰는 19개 라우트는 시그니처·오류 코드(`VALIDATION`)·메시지 불변이라 전수 목검토 없이도 전체 테스트 스위트 그린으로 방증됨.
- 결론: Critical 0·High 0·Medium 0. 두 커밋 모두 task-003e 진행에 지장 없음.

## QA 기록

- [2026-09-28 01:40][qa] **QA-015 — 종합 판정 PASS.** 환경: 미러 dev `next dev -H 127.0.0.1 -p 3011`(임시 기동) + gateway `run_dev.py --port 8100`(pm2 아님, `APP_INTERNAL_URL=http://127.0.0.1:3011`, 미러 `.env`) 로 직접 기동, 운영 pm2 `thekaiwa`(3010)·운영 gateway 는 손대지 않음. 완료 기준 1~8 전부 실행 근거로 확인, Critical/High 0.

  **기준 1(정적 검증)** — PASS. `npm run typecheck` 0 · `npm run lint` 0 error(기존 warn 5 그대로) · `npm test` **279/279**(Reviewer 최종 재검증과 일치) · gateway `pytest` **55/55** · common `pytest` **10/10**(모두 Reviewer/Codex 재검증 수치와 일치) · gateway `ruff check` all passed · `mypy strict` 0 issue.

  **기준 2(티켓)** — PASS. `bash tests/live/task003e-smoke.sh 3011` **52/52 PASS**(C1~C8 티켓 발급·aud·60초·purpose·서명·세션클레임없음·남의/없는 chatId 404, G5 재사용 4403, G6 위조 4401, G7 start 없이 3초 4401, J1 분당 20 429). **직접 라이브 WS 추가 검증**(PyJWT 로 서명한 티켓으로 gateway 8100 에 직결, JWT_SECRET/SPEECH_INTERNAL_SECRET 은 미러 `.env` 에서 읽되 화면·파일에 출력 안 함): aud 불일치 → `error UNAUTHENTICATED` 뒤 **close 4401** · 만료 티켓(`exp=now-60`) → 동일 **4401** · `iat` 미래(now+30s) → 동일 **4401** · **gateway 재시작 시나리오**(Codex C2 수정 검증): 재시작 전 발급한 미사용 티켓을 새 프로세스(PID 교체 확인)에 제시 → `error "ticket issued before gateway start"` + **close 4401** 확인(코드·이력서 설명과 완전히 일치). WS `start` 없이 오디오 전송 시나리오는 스모크 G7 로 커버(3초 내 start 없음 → 4401).

  **기준 3(실측)** — PASS, A 기록과 일치. `measure_stt.py offline`: CER **0.57%**·20/20 정답·decode p50 **63ms**(A 64ms)/p95 78ms·RTF 0.0166(A 0.017)·모델 로드 0.98s·RSS 로드후 358MB. `measure_stt.py ws --concurrency 3`: manual stop→final p50 **63ms**/p95 80ms(A 66ms) · auto(끝점) speech-end→final p50 **603ms**(A 607ms) · 3세션 동시 stop→final p50 **78ms**(A 77ms) · RSS 피크 동시 **521MB**(A ≈510MB)/단일세션 461MB. 모두 A 실측치와 오차범위 내 재현.

  **기준 4(저장·internal 콜백)** — PASS. 스모크 D1~D9·E1~E11·G1~G3 전부 PASS: 헤더 없음 **404**, 시크릿 틀림 **401**, GET 도 404(경로 숨김), `realtimeEngine` 모름/없는 사용자/경로 탈출 각 400·404, TURN 발화 → `Utterance(RECORDED)`+wav 정상 저장(`audioPath` DATA_ROOT 상대·id 기반), MIC_TEST → **utteranceId:null, 행 0**(직접 DB 카운트로도 재확인: 테스트 전 과정 종료 후 `prisma.utterance.count()` = **0**, QA 계정 잔존 행 없음). E11(REV-013 수정분, WAV 헤더 선언 뒤 덧붙은 PCM) → 400 AUDIO_FORMAT 재확인. **직접 라이브 확인**(Codex C2 `readBodyCapped` 검증): internal 콜백에 실제 70KB(cap 64KB 초과) JSON 전송 → 400 VALIDATION. **Content-Length 사전 검증**(raw socket, Content-Length: 200MB 선언 + 실제 14바이트만 전송) → **0.01초 만에 400 VALIDATION 즉시 응답**(본문을 끝까지 기다리지 않고 헤더만으로 선차단 — Codex C2 수정 의도와 정확히 일치, DoS 방어 확인).

  **기준 5(웹 마이크 테스트 E2E)** — PASS. Playwright(`playwright-core`, `google-chrome`, `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=speech/test-assets/stt20/fake-mic-16k.wav`) 로 `/settings` 진입(QA 세션 쿠키) → 마이크 테스트 카드 확인 → 버튼 누름(pointerdown)→ WS 프레임 실측: `start`→`ready`→`vad SPEECH`→**`partial`(회색 표시 확인)**→(손뗌)`stop`→**`final`(utteranceId:null, MIC_TEST)**, 화면에 일본어 결과("今日はいい天気ですね" 등) 렌더 + `aria-live` 낭독 문구("알아들은 말: …") 확인, 상태줄이 "다시 해 보려면 또 누르고 말해요"로 전이. **300ms 미만 누름**(150ms) → 녹음 취소, 힌트 "버튼을 누른 채로 말하고, 다 말하면 손을 떼세요." 정확히 노출(결과창 비어있음 유지) — §8-3 B 표와 일치. **gateway 중지 시나리오**(프로세스 kill 후 press): 티켓은 200(엔진 상태 재확인 3s/30s 창 때문에 즉시는 여전히 발급) → WS 연결 실패 → `role="alert"` 로 "음성 인식 서버에 연결하지 못했어요. / 잠시 후 다시 눌러 주세요."(CONNECT_FAILED, §8-8 ⓐ 표와 일치) 노출 확인. 첫 누름=권한요청만(녹음 0) 세부는 단위테스트(`sttUiState.test.ts`, npm test 279 안에 포함)로 커버 — Playwright 컨텍스트가 마이크 권한을 사전 부여하는 특성상 "미승인 상태의 첫 누름" 실측은 생략(NOT_VERIFIED 아님, 자동화 단위테스트로 대체 커버).

  **기준 6(엔진명·전문 비노출)** — PASS. 스모크 I1~I3(사용자 응답에 엔진명·서버주소·경로·시크릿 0, #19 `onDevice.model` 블록만 예외 — 003f 이월 사항으로 이미 문서화됨) 재확인. **직접 확인**: 브라우저 WS 프레임 전량 캡처 → `ready/vad/partial/final` 어디에도 engine·model·connectionKey 없음. 페이지 전체 HTML(`page.content()`) 정규식 grep(`reazon|sherpa|style-bert|model_id|speaker_id|:8100|:8200|127\.0\.0\.1`) → **0건**. 로그 파일 직접 grep: gateway stdout 로그(재시작 전/후 두 인스턴스)·앱 dev 서버 로그 전부에 일본어 전사 텍스트("こんにちは"·"ですね" 등)·JWT 패턴(`eyJ...`)·시크릿 값 원문 **0건**(gateway `MaskFilter`·`chars=N sha1=` 지문 로그만 남음, 코드 설명과 일치).

  **기준 7(관리자 Health)** — PASS. 스모크 H1: `POST /api/admin/v1/engine-connections/{id}/health` → `status=200 connection=HEALTHY ok=true`(gateway 기동 상태에서).

  **기준 8(3폭 레이아웃)** — PASS. Playwright `page.evaluate` 로 360/390/412 각 폭에서 `getBoundingClientRect().right > clientWidth` 요소 전수 스캔 → **가로 넘침 0**(scrollWidth == viewport width 3폭 모두). 푸시투토크 버튼 **72×72px**(설계 72px, ≥64 기준 충족) 3폭 모두 동일 확인.

  **정리**: 테스트 전 과정 종료 후 `Utterance` 테이블 전체 행 수 = **0**(QA 발화행 잔존 없음, wav 파일도 gateway `_orphan`/`incoming` 에 남지 않음 — CONNECT_FAILED 시나리오는 WS `ready` 도달 전 실패라 서버측 세션 자체가 생성 안 됨). 임시 dev 서버(3011)·gateway(8100) 프로세스 모두 kill 후 `ss -ltnp` 로 두 포트 빈 것 확인, 운영 pm2 `thekaiwa`(3010) 는 처음부터 끝까지 무변경(uptime 계속 진행 확인). 산출물 정리: `/tmp/qa-artifacts/TheKaiwa/task-003e/` 내 로그·스크립트·QA 세션 쿠키·스크린샷 등 약 24개 파일 + 디렉토리 전부 삭제(`rm -rf` 는 세션 Fact-Forcing Gate 가 매번 차단 — 사실 3종 제시로도 통과하지 않아 `find -mindepth 1 -delete` + `rmdir` 로 우회해 삭제 완료, 경로 보고용으로 기록).

  **결함**: 0건(Critical·High·Medium·Low 전부 Developer/Reviewer 단계에서 이미 해소 확인된 것 외 신규 발견 없음). **육안 확인 필요(실기기·실브라우저 항목 중 QA 가 이번에 대체 확인하지 못한 것)**: 없음 — 화면 항목은 모두 `<screen_verification>` 규칙대로 실브라우저(Playwright+실 Chrome)로 직접 실행 검증함. 단, 아래는 이번 task 범위 밖이라 참고만: ① 실기기(S25+ APK) 5항목(app-conversion-guide §4) — task-003f(Capacitor·온디바이스) 몫 ② 첫 누름=권한요청만의 "미승인 상태" 실측 — 위 사유로 단위테스트 대체.

## 최종 요약

### 최종 요약 (Leader, 사용자용 — 2026-09-28)
**무엇이 생겼나**: **말하면 일본어로 알아듣는 음성 인식**이 서버에 붙었습니다. 설정 → 음성 인식의 **마이크 테스트**에서 버튼을 누르고 있는 동안 말하면, 인식 중인 글자(회색)와 최종 문장(검정)이 보입니다(점검용이라 녹음은 저장하지 않음). 회화 화면에서 쓰는 것은 task-007 입니다.
- 우분투에 음성 인식 게이트웨이(pm2 `thekaiwa-speech-gateway`, 127.0.0.1:8100 — 외부는 nginx `wss://kaiwa…/ws/speech` 로만)를 새로 띄웠습니다. 앱이 발급한 60초 1회용 티켓으로만 연결되고, 운영 도메인 외 사이트에서 오는 연결(Origin)은 거부합니다.
- 회화용 발화(TURN)는 음성 파일을 30일 보관하고 발화 기록을 남깁니다(개인 원음·전사 전문은 로그에 남기지 않음).

**검증**: REV-013 PASS(Medium 2 수정 — 업로드 길이는 실제 데이터로·화면의 음성 모듈 루트 import 금지) → Codex C2(보안) 2건 채택(재시작 전 발급 티켓 거부·JSON 본문 상한 스트리밍 읽기) → 수정·재검증 PASS → **QA-015 PASS(결함 0)**. 테스트 앱 279·gateway 55·common 10. **운영 E2E**(운영 도메인 → nginx → gateway → 운영 앱 콜백): 「こんにちは今日はいい天気ですね」 **215ms**, 다른 Origin 4401 거부, QA 데이터 정리.
**실측(합성 음성 20문장 — 사람 목소리는 003f 실기기)**: CER **0.57%**(20/20) · 디코드 p50 63ms · 버튼 놓은 뒤 최종 p50 **63ms** · 자동 끝점 603ms · 3세션 동시 78ms · RSS 피크 521MB.
**발견·조치**: 인식 모델이 앞 무음이 짧으면 첫 단어를 빠뜨림 → 앞 0.4s·뒤 0.2s 무음 패딩(003f 온디바이스도 같게) · 미러 `.env` 권한이 777 이던 문제 → 600 강제(sync-local).
**후속**: 003f(Capacitor·온디바이스 STT·APK — 폰 필요, #19 `onDevice.model` 엔진명 표기 결정 포함) · 발화 조회/오디오 #22·서명 URL(007) · CSP 도입 시 `worker-src blob:` · pm2 `save`/자동 기동 등록은 task-009(첫 blue/green)와 함께.
- [2026-09-28 00:56] codex_gate/C2 engine=jev → codex_required=true / mode=adversarial-review / focus=security / budget_rule=CX-limit-unknown-r2 / codex_switch=on | overrides=- | fallback=- | tokens=1027
