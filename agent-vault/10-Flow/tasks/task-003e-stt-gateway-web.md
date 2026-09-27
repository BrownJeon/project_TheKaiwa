---
task_id: task-003e
title: "STT gateway(우분투) + 웹 실시간 음성 인식 폴백 + 마이크 테스트"
status: in-progress
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

## Reviewer 기록

## QA 기록

## 최종 요약
