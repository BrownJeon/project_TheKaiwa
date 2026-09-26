# speech/gateway — WS 실시간 폴백 STT 게이트웨이 (골격)

> 상태: 설계 골격. 구현 task-003(c). FastAPI + `websockets`, 우분투 pm2 `thekaiwa-speech-gateway`, `127.0.0.1:8100`, nginx `/ws/speech` 프록시. 계약 정본: [`docs/design/api-contract.md`](../../docs/design/api-contract.md) "WS /ws/speech" · "내부 API" 절. 인터페이스 골격: [`interfaces.py`](interfaces.py).

## 1. 역할

- **온디바이스 플러그인이 없는 클라이언트(PC 브라우저·저사양 기기·플러그인 오류 2회·`recognitionMode` 가 gateway 를 요구하는 경우)** 에게 같은 모델(ReazonSpeech zipformer int8 + silero VAD)로 실시간 STT 를 제공한다. 라우터가 device capability 로 자동 선택하며 사용자 화면은 어느 경로인지 모른다.
- 세션마다 `RealtimeSttSession`(VAD 상태 + 세그먼트 버퍼)을 두고, 발화 종료 시 오프라인 디코드 → `final` 이벤트 → wav 저장 → 앱 internal 콜백.
- 인증은 앱이 발급한 60초 티켓(JWT, `aud=speech-ws`, 같은 `JWT_SECRET`)으로만. 세션 쿠키는 보지 않는다.

## 2. WS 프로토콜 요약 (정본은 api-contract.md)

```
클라 → 서버
  {type:'start', chatId, sampleRate:16000, ticket, client:{kind:'web'|'app-fallback', ua}}   # 첫 메시지, 티켓 검증 실패 시 close 4401
  <binary PCM16 LE mono 40ms 프레임>                                                          # 640 samples = 1,280 bytes
  {type:'stop'}                                                                               # 남은 버퍼를 final 처리 후 세션 종료
서버 → 클라
  {type:'ready', sessionId, engine:'reazon-gateway', connectionId}                            # start 수락
  {type:'vad', state:'speech'|'silence', atMs}
  {type:'partial', segIdx, text}                                                              # 세그먼트 디코드 결과(자막)
  {type:'final', utteranceId, text, engine:'reazon-gateway', durationMs, segments:[{segIdx,text,startMs,endMs}], timings:{vadMs,decodeMs,storeMs}}
  {type:'error', code, message}                                                               # 코드: TICKET_INVALID | TICKET_USED | SESSION_LIMIT | AUDIO_FORMAT | ENGINE_ERROR | CALLBACK_FAILED
```
- 티켓은 `jti` 단위 1회용(메모리 TTL 세트). 재사용 시 `TICKET_USED`.
- 발화 상한 `gateway.max_utterance_sec=60` 초과 시 강제 `final`. 동시 세션 `gateway.max_sessions` 초과 시 `SESSION_LIMIT` 후 close 4429.
- `final.utteranceId` 는 앱 콜백(§4)이 돌려준 값이다. 콜백 실패 시 `error CALLBACK_FAILED` + 텍스트는 `final` 로 전달해 사용자가 텍스트 턴으로 이어갈 수 있게 한다(wav 는 보관, 재등록은 미결).
- 클라이언트는 `final` 을 받은 뒤 `POST /api/v1/chats/:id/turns {utteranceId, text}` 를 호출한다(기존 SSE 턴). gateway 는 턴을 시작하지 않는다.

## 3. 내부 구성

```
speech/gateway/
├── app.py                # FastAPI 앱: /ws/speech · /health · /admin/{log-level,config/apply,config/effective} · (Phase 4) /tts
├── session.py            # RealtimeSttSession 구현(VAD 상태기계·세그먼트 큐·디코드 스레드 핸드오프)
├── ticket.py             # JWT 검증(aud·exp·jti 1회용)
├── store.py              # Utterance wav 저장(DATA_ROOT 규약, 원자적 쓰기)
├── interfaces.py         # Protocol/dataclass 골격(이 세션 산출) → 구현 시 common/engine/interfaces.py 로 이동
├── requirements.txt      # fastapi, uvicorn[standard], websockets, pyjwt, kaiwa-speech-common(-e ../common)
└── tests/
```
- 모델은 프로세스 기동 시 1회 로딩하는 싱글턴(VoiceVault whisper-service 패턴), 디코드는 세션과 무관한 **디코더 풀(스레드, `num_threads` 와 별개로 1~2개)** 에서 직렬화한다. 로딩 실패는 try/except 로 감싸 `/health` 는 응답하고 WS `start` 에는 `ENGINE_ERROR` 를 준다(503 원칙).
- 엔진 접근은 `kaiwa_speech_common.router.resolve('REALTIME_STT')` 로만. gateway 코드에 `reazon` 문자열이 있으면 안 된다(어댑터 안에만).

## 4. 발화 저장과 앱 콜백

- 경로: `DATA_ROOT/users/<userId>/utterances/YYYY-MM/<utteranceId>.wav` — 16kHz mono PCM16, `<userId>`·`<utteranceId>` 는 cuid 형식 검증 후 `safe_join`(경로 탈출 차단). 온디바이스 경로에서 앱이 `POST /api/v1/speech/utterances` 로 받아 저장하는 파일도 같은 규약이다.
- 순서: 디코드 완료 → 임시 파일(`.part`) 쓰기 → `POST /api/internal/speech/utterances`(헤더 `X-Internal-Secret`, 본문 `{userId, chatId, tmpPath, durationMs, sampleRate, realtimeEngine:'reazon-gateway', connectionId, realtimeText, segments, timings, traceSteps}`) → 앱이 `Utterance`(RECORDED) + `SpeechJob(ANALYSIS_STT, QUEUED)` 를 한 트랜잭션으로 만들고 `{utteranceId, finalPath}` 반환 → gateway 가 `.part` → `finalPath` rename → 클라에 `final`.
- 앱이 utteranceId 를 정하는 이유: `Utterance` 는 L4 `speech` 모듈 소유 테이블이고 Python 은 `SpeechJob` 외 앱 테이블을 쓰지 않는다(module-dependency §5-1).
- 보존 30일: 삭제는 앱 쪽 `speech.purgeExpiredAudio()` 정리 잡이 한다. gateway 는 지우지 않는다.

## 5. 내부 콜백 목록 (gateway → 앱)

| 호출 | 시점 | 실패 처리 |
|---|---|---|
| `POST /api/internal/speech/utterances` | `final` 직전 | 5s 타임아웃, 1회 재시도, 그래도 실패면 `error CALLBACK_FAILED` + wav 는 `DATA_ROOT/users/<userId>/utterances/_orphan/` 로 이동(재등록 미결) |
| (Phase 4) `POST /api/internal/speech/session-metrics` | 세션 종료 | 무시(지표용) |

앱 → gateway 방향은 admin 엔드포인트뿐: `GET /health`, `POST /admin/log-level`, `POST /admin/config/apply`, `GET /admin/config/effective`. 앱 `admin.getDiagnostics(connectionId)` 가 호출한다.

## 6. TTS 프록시 (Phase 4 슬롯, 기본 비활성)

Phase 1 의 TTS 는 **앱 어댑터 `styleBertHttp` → M4 :8200 직접** 한 경로다(module-dependency §9-1). gateway 의 `POST /tts` 는 `gateway.tts_proxy_enabled=true` 일 때만 열리며 용도는 두 가지다:
1. WS 세션이 살아 있는 웹 폴백 클라이언트에 턴 완료 후 문장 오디오를 같은 소켓으로 푸시(`{type:'tts', seq, bytes}`)해 HTTP 왕복을 줄인다.
2. 앱 쪽 `EngineConnection(style-bert-gateway, HTTP → http://127.0.0.1:8100/tts)` 을 Fallback Policy 에 추가하면 라우트 변경 없이 이 경로를 쓸 수 있다.
구현 시 문장 분할·캐시 규칙은 앱과 동일(`max_sentence_chars=100`, 캐시 키 sha1(text|voiceId|style|styleWeight|speed|pitch|intonation|engineConnectionId|textVersion), `DATA_ROOT/tts-cache/`). USER_SETTING 층 값은 요청 payload 로 받는다.

## 7. nginx (docs/nginx 에 task-003 에서 실물 추가)

```
location /ws/speech {
    proxy_pass http://127.0.0.1:8100;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 600s;
    proxy_buffering off;
}
```
`climb.*` vhost 의 WS 블록을 복사한다. `voice.*` 의 `Connection ""` 은 WS 를 끊으므로 쓰지 않는다. `/models/` alias 는 `speech/models/README.md`.

## 8. 실측·검증 항목 (task-003)

- P0 게이트 ②·⑥(`speech/README.md` §6).
- 티켓 만료·재사용·타 사용자 chatId 로 `start` → 각각 4401·`TICKET_USED`·4403 확인.
- 프레임 포맷 오류(홀수 바이트·48kHz)에 `AUDIO_FORMAT` 후 세션 유지 여부.
- 앱 콜백을 죽인 상태에서 `final` 이 텍스트와 함께 오고 wav 가 `_orphan` 으로 가는지.
- 로그에 티켓·전사 전문이 없는지 grep.
