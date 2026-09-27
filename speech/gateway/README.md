# speech/gateway — WS 실시간 폴백 STT 게이트웨이

> 상태: **Phase 1 구현(task-003e, 2026-09-28)** — `WS /ws/speech`·`GET /health`. 우분투 pm2 `thekaiwa-speech-gateway`, `127.0.0.1:8100`, nginx `location /ws/speech` 프록시.
> 계약 정본은 [`docs/design/api-contract.md`](../../docs/design/api-contract.md) §0-3(티켓)·§2-29(#142 `v:1`)·#143 — 이 문서는 정본에 없는 세부를 정하고 구현을 설명한다(정본과 다르면 정본이 이긴다, task-003e M3). 엔진 인터페이스는 [`../common/kaiwa_speech_common/engine/interfaces.py`](../common/kaiwa_speech_common/engine/interfaces.py)(이 디렉토리의 `interfaces.py` 는 re-export).

## 1. 역할

- 온디바이스 플러그인이 없는 클라이언트(웹 브라우저·플러그인 모델 미설치·플러그인 오류 2회)에게 **같은 모델**(ReazonSpeech zipformer int8 + silero VAD)로 실시간 STT 를 준다. 클라이언트 라우터(`speech/stt` RealtimeSttClient)가 경로를 고르며 사용자 화면은 어느 경로인지 모른다.
- 연결마다 VAD 상태기계 + 세그먼트 디코드 세션을 두고, 발화가 끝나면 `final` → (TURN 이면) wav 저장 + 앱 internal 콜백으로 `Utterance` 행 생성.
- 인증은 앱이 발급한 60초 티켓(JWT)으로만. 세션 쿠키는 보지 않는다. 턴(LLM)은 시작하지 않는다 — 클라이언트가 `final.utteranceId` 로 #32 를 부른다.
- 엔진명(reazon·sherpa)은 `speech/common/.../engine/adapters/**` 안에만 있다. gateway 코드는 `EngineRole.REALTIME_STT` 와 `RealtimeSttSession` 계약만 안다.

## 2. 티켓 (#20 → gateway)

| 항목 | 규칙 |
|---|---|
| 서명 | HS256 만(`alg` 혼동 차단), 키 = 앱과 같은 `JWT_SECRET` 문자열 |
| 필수 클레임 | `sub`(userId, `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`) · `aud:"ws-speech"` · `jti`(8~128자) · `exp` |
| 선택 클레임 | `iat` · `chatId`(sub 와 같은 문자 규칙) · `purpose: "TURN" \| "MIC_TEST"`(없으면 TURN, 그 밖 값은 거부) |
| 수명 | `exp - now > 120s` 면 티켓이 아니라고 보고 거부(같은 키의 장수명 토큰 차단). leeway 2s. 앱 세션 JWT 는 `aud` 가 없어 거부 |
| 1회용 | `jti` 는 **다른 검증을 모두 통과한 뒤** 소비 — 메모리 캐시(만료+32s, 최대 10,000개, 넘치면 4429) |
| `purpose=MIC_TEST` | 설정 화면 마이크 테스트. **wav 저장·internal 콜백·Utterance 행 없음**, `final.utteranceId:null` (task-003e M1) |

## 3. WS 프로토콜 `v:1` (정본 api-contract §2-29 + 이 절의 세부)

**클라이언트 → 서버**

| 메시지 | 규칙 |
|---|---|
| `{"type":"start","v":1,"ticket":"<jwt>","sampleRate":16000,"partial":true,"clientPlatform":"web","chatId"?:…,"endpoint"?:"manual"\|"auto"}` | 연결 후 **3초 안에 첫 메시지**. `chatId` 는 티켓 것이 권위 — start 에 있고 다르면 4401. `endpoint` 기본 `manual` |
| binary | PCM16LE mono 16kHz **정확히 1,280바이트(40ms)**. 다른 크기는 버리고 첫 1회만 `error{VALIDATION,fatal:false}`, 50개 넘으면 4400 |
| `{"type":"stop"}` | 현재 발화 종료 → `final` **정확히 1회**(말이 없으면 `text:""`·`utteranceId:null`). 세션은 유지 — 다음 발화 오디오를 새 start·새 티켓 없이 바로 보낸다 |
| `{"type":"cancel"}` | 현재 발화 폐기(final 없음), 세션 유지 |
| `{"type":"ping"}` | `pong` |
| 텍스트 메시지 | ≤4KB, 초당 20(버스트 40). 모르는 type·두 번째 start 는 `error{VALIDATION,fatal:false}` |

**`endpoint` 모드**: `manual`(푸시투토크 — 화면 기본) = 무음 500ms 로 끊긴 VAD 세그먼트마다 `partial`, `stop` 때 `final`(세그먼트 텍스트를 이음), 발화가 60초에 닿으면 강제 `final{reason:"max_length"}`. `auto`(핸즈프리·실측용) = 세그먼트 1개 = 발화 1개, 끝점(무음 500ms)마다 `final{reason:"endpoint"}`, partial 없음.

**서버 → 클라이언트** — 엔진 식별자(engine·model·connectionKey) 없음(task-003e M2)

| 메시지 | 필드 |
|---|---|
| `ready` | `{type, v:1, sessionId, sampleRate:16000, frameBytes:1280, maxUtteranceMs:60000, vad:{silenceMs:500}}` |
| `vad` | `{type, state:"SPEECH"\|"SILENCE", atMs}` — atMs 는 현재 발화 시작 기준 |
| `partial` | `{type, segIdx, text, atMs}` — `start.partial:false` 면 없음 |
| `final` | `{type, utteranceId:string\|null, text, durationMs, segments:[{segIdx,start,end,text}], timings:{vadMs,sttMs,decodeMs,storeMs}, reason:"stop"\|"endpoint"\|"max_length", traceId}` — text 는 구두점 없음(모델 출력 그대로) |
| `error` | `{type, code, message, fatal}` — code ∈ `UNAUTHENTICATED`·`VALIDATION`·`ENGINE_UNAVAILABLE`·`ENGINE_ERROR`·`RATE_LIMITED`·`SESSION_EXPIRED`. `message` 는 개발용 영문(화면 금지). `fatal:true` 면 곧 close |
| `pong` | `{type}` |

같은 세션 안에서 `vad`·`partial`·`final` 은 **발화 순서대로** 나간다(세션별 순차 작업 큐 — 앞 발화의 final 이 뒤 발화의 partial 보다 먼저).

**close 코드**

| 코드 | error.code | 언제 |
|---|---|---|
| 1000 | — | 정상 |
| 4400 | VALIDATION | start 형식 오류(JSON·`v≠1`·`sampleRate≠16000`·옵션 타입) · 잘못된 크기 프레임 50개 초과 (재시도 무의미) |
| 4401 | UNAUTHENTICATED | 3초 안에 start 없음 · start 전 바이너리 · 티켓 무효/만료/aud 불일치/purpose 오류 · chatId 불일치 · (설정 시) Origin 불허 |
| 4403 | UNAUTHENTICATED | 티켓 재사용 |
| 4408 | SESSION_EXPIRED | 메시지 없는 120초(`gateway.session_idle_timeout_sec`) · 세션 10분 초과 |
| 4409 | RATE_LIMITED | 같은 사용자의 새 세션이 열려 이 세션을 닫음(message `replaced by a newer session`) |
| 4413 | RATE_LIMITED | 오디오가 초당 50프레임(실시간 2배, 버스트 150프레임=6초) 초과 · 강제 final 3회 · 세션 작업 큐 포화 |
| 4422 | ENGINE_UNAVAILABLE | 모델 미로드·로드 실패 · TURN 인데 저장소/콜백 미설정 |
| 4429 | RATE_LIMITED | 서버 동시 세션 `gateway.max_sessions`(8) 초과 · 미인증 연결 32 초과 · jti 캐시 포화 |
| 1011 | ENGINE_ERROR | 디코드 실패 등 서버 오류 |

WS ping/pong 은 uvicorn 이 한다(`--ws-ping-interval 15 --ws-ping-timeout 30`, 무응답 close 는 1011). 프레임 크기 상한 `--ws-max-size 65536`, 압축 끔(`--ws-per-message-deflate false`).

## 4. 발화 저장과 앱 콜백 (`purpose=TURN` 이고 text 가 비지 않을 때만)

순서: 디코드 완료 → `DATA_ROOT/users/<userId>/utterances/incoming/<32hex>.wav.part` 쓰기(16kHz mono PCM16, 0640) → `POST ${APP_INTERNAL_URL:-http://127.0.0.1:3010}/api/internal/speech/utterances` → 응답 `audioPath` 검증 → `.part` 를 그 경로로 rename(이미 있으면 `.part` 삭제 — 앱이 옮겨도 된다) → 클라에 `final{utteranceId}`.

- 헤더: `X-Internal-Secret: $SPEECH_INTERNAL_SECRET` · `X-Service: gateway` · `X-Service-Env: $APP_ENV` · `X-Trace-Id` · `Content-Type: application/json`.
- 본문: `{userId, chatId:string|null, durationMs, sampleRate:16000, audioBytes, realtimeEngine:"reazon-gateway"(connection key 스냅샷), realtimeText(≤1000자), segments:[{segIdx,start,end,text}](≤50, 넘치면 50번째에 합침), timings:{vadMs,sttMs,decodeMs}, traceId, tmpPath}` — 오디오 바이트는 싣지 않는다(tmpPath 는 DATA_ROOT 상대, 앱이 안 써도 됨).
- 응답: 앱 봉투 `{success:true, data:{utteranceId, audioPath, finalPath?, expiresAt?}}`(봉투 없이 data 만 와도 받음). `audioPath` = `users/<같은 userId>/utterances/<…>.wav`(DATA_ROOT 상대, 조각 `[A-Za-z0-9][A-Za-z0-9._-]*`, `incoming`·`_orphan` 금지). `finalPath` 가 오면 `DATA_ROOT/audioPath` 와 같아야 한다. id·경로는 앱이 정한다(Utterance 는 L4 speech 소유 테이블, Python 은 앱 테이블을 쓰지 않는다).
- 실패: 타임아웃 5s(`gateway.internal_callback_timeout_ms`), **연결 오류·5xx 만 1회 재시도**(타임아웃은 재시도 안 함 — 실시간 경로가 두 배가 된다). 그래도 실패하면 wav 를 `users/<userId>/utterances/_orphan/<32hex>.wav` 로 옮기고 `final.utteranceId:null`(텍스트는 그대로 → 클라는 텍스트 턴으로 이어간다). 콜백은 성공했는데 `audioPath` 가 규칙 밖이면 행은 살아 있으므로 `utteranceId` 는 돌려주고 파일만 `_orphan`.
- 연결이 끊겨 콜백이 취소되면 `.part` 를 `_orphan` 으로 옮긴다(incoming 에 방치하지 않는다). 보존 30일 삭제는 앱 정리 잡 몫 — gateway 는 지우지 않는다.

## 5. `GET /health` (#143)

- 시크릿 없이: `{ok, status}` 만(`status` = `LOADING`·`OK`·`FAILED`·`MISCONFIGURED`, HTTP 200). 앱 Health·관리자 콘솔은 `ok` 만 보면 된다.
- 올바른 `X-Internal-Secret`(상수시간 비교): `{ok, status, service:"gateway", version, commonVersion, env, models:[{key:"reazon-gateway", loaded, model:"reazonspeech-int8@<version>", loadMs, error}], sessions, rssMb, configVersion("file:<yml sha1 8자>"), logLevel, uptimeSec, issues:[키 이름만]}` — 시크릿·경로 없음.
- `MISCONFIGURED` = `JWT_SECRET`·`SPEECH_INTERNAL_SECRET`(없음·16자 미만)·`DATA_ROOT`·`APP_ENV` 문제. yml 키 오류는 경고(`issues`)만 — 기본값으로 돈다.
- `/docs`·`/openapi.json` 없음. `/admin/*`(#144~#146)·`POST /transcribe` 는 Phase 2.

## 6. 설정 (8층 중 지금 읽는 층)

| 층 | 출처 | 키 |
|---|---|---|
| DEFAULT·SOURCE_CODE | `kaiwa_speech_common/config.py` | 위 상한값(프레임 속도·세션 10분·미인증 32 등) |
| APPLICATION_CONFIG | `SPEECH_CONFIG_PATH`(`speech/speech.config.yml`, `version: 1` 아니면 부팅 거부) | `speech.stt.realtime.*`(endpoint_silence_ms·vad_threshold·min_speech_ms·max_segment_sec·num_threads·decoding_method·partial) · `speech.gateway.*`(max_sessions·max_utterance_sec·session_idle_timeout_sec·internal_callback_timeout_ms) |
| ENVIRONMENT | env | `SPEECH_STT_NUM_THREADS`·`SPEECH_STT_ENDPOINT_SILENCE_MS`·`SPEECH_STT_DECODING_METHOD`·`SPEECH_GATEWAY_MAX_SESSIONS` |
| DATABASE·CONNECTION_PROFILE·RUNTIME_OVERRIDE | — | Phase 2(앱 #141a 와 함께) |

티켓 aud 는 코드 상수 `ws-speech`(정본) — yml `gateway.ticket_audience: speech-ws` 는 읽지 않는다(정본과 다른 표기, Leader 정정 대상).

프로세스 env: `APP_ENV` · `DATA_ROOT` · `JWT_SECRET` · `SPEECH_INTERNAL_SECRET` · `APP_INTERNAL_URL`(기본 `http://127.0.0.1:3010`) · `SPEECH_CONFIG_PATH` · `SPEECH_MODELS_DIR`(기본 저장소 `speech/models`) · 선택 `SPEECH_LOG_LEVEL` · `SPEECH_GATEWAY_ALLOWED_ORIGINS`(콤마 목록 — 주면 그 밖 Origin 은 4401. 비우면 검사 안 함: 인증 = 티켓).

## 7. 실행

**NFS 는 noexec** 지만 파이썬 **소스 읽기**와 onnx 모델 **읽기**는 막히지 않는다(2026-09-28 확인) — 코드는 NFS(또는 릴리스) 그대로, 인터프리터·네이티브 라이브러리(sherpa-onnx)는 로컬 디스크 venv 의 것을 쓴다. 공용 패키지는 `pip install -e` 대신 **PYTHONPATH** 로 읽는다(editable 설치는 경로를 박아 넣어 릴리스마다 재설치가 필요해진다). `PYTHONDONTWRITEBYTECODE=1` 로 NFS 에 `__pycache__` 를 만들지 않는다.

```bash
# venv (한 번, 시스템 Python 3.10.12)
python3 -m venv ~/.node-local/thekaiwa-speech/venv
~/.node-local/thekaiwa-speech/venv/bin/pip install -r speech/gateway/requirements.txt -r speech/gateway/requirements-dev.txt
# 모델 (한 번, ≈170MB, sha256 검증 — speech/models/README.md)
python3 speech/models/fetch_models.py
# 개발·QA 임시 기동(pm2 아님) — .env 에서 필요한 키만 넘긴다, 셸 env 가 이긴다
~/.node-local/thekaiwa-speech/venv/bin/python speech/gateway/scripts/run_dev.py --port 8199
# 운영(QA PASS 후 Leader): pm2 start ecosystem.config.js --only thekaiwa-speech-gateway
```

테스트·정적 검사(모델 없이 — 가짜 VAD·디코더를 실제 세션 로직에 끼운다):
```bash
cd speech/gateway && PYTHONDONTWRITEBYTECODE=1 ~/.node-local/thekaiwa-speech/venv/bin/pytest      # 52
cd speech/common  && PYTHONDONTWRITEBYTECODE=1 ~/.node-local/thekaiwa-speech/venv/bin/pytest      # 10
~/.node-local/thekaiwa-speech/venv/bin/ruff check . && ~/.node-local/thekaiwa-speech/venv/bin/mypy kaiwa_gateway app.py   # 각 디렉토리에서
```

실측: `scripts/measure_stt.py`(offline = 엔진 직접 / ws = 떠 있는 gateway 에 실시간 속도로) — 결과는 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md` STT 절.

## 8. 로그 (README §5 규칙)

모든 핸들러(uvicorn 포함)에 `MaskFilter` — 등록된 시크릿 값·JWT 모양·`X-Internal-Secret` 값·DB URL 을 지우고, 예외는 스택 없이 타입만 남긴다. `final` 로그는 `chars=N sha1=xxxxxxxx`(텍스트 지문)·세그먼트 수·오디오 ms·단계 ms 만. 원음·전사 전문·티켓은 남기지 않는다. pm2 로그 `logs/speech-gateway-{out,err}.log`.

## 9. 파일

```
speech/gateway/
├── app.py                 # uvicorn 진입점(app = create_app())
├── interfaces.py          # re-export (정본: common/engine/interfaces.py)
├── kaiwa_gateway/
│   ├── server.py          # FastAPI: /health · /ws/speech, 모델 백그라운드 로드
│   ├── connection.py      # WS 상태기계(시작·수신 루프·콜백·저장)
│   ├── ticket.py          # 티켓 검증 + jti 재사용 캐시
│   ├── limits.py          # 토큰 버킷 · 세션 레지스트리(전체 상한·사용자당 1)
│   └── store.py           # DATA_ROOT 경로 검증·incoming/_orphan·rename
├── scripts/{run_dev.py, measure_stt.py}
├── tests/                 # pytest(모델 없음)
├── requirements.txt · requirements-dev.txt · pyproject.toml(도구 설정)
```

## 10. nginx

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
(운영 vhost 에 적용됨 — task-003e Leader's Plan E4.) `voice.*` 의 `Connection ""` 은 WS 를 끊으므로 쓰지 않는다.

## 11. 한계·후속

- 세그먼트 단위 partial — 끊김 없이 긴 문장은 무음(500ms)이나 `stop` 전까지 partial 이 없다(오프라인 모델). 말하는 중 자막이 필요하면 진행 중 세그먼트를 1초마다 재디코드하는 옵션을 검토(CPU 비용).
- 설정 5·6·8층(DB·EngineConnection·RuntimeOverride)·`/admin/*`·`POST /transcribe`·#141 trace 콜백은 Phase 2.
- 콜백 실패 wav(`_orphan`)의 재등록 경로는 미결.
