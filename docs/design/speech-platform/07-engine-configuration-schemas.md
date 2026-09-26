# 07. Engine 별 Configuration Schema 설계

> 정본: 스키마 키 서식(`key/type/default/min/max/enum/description/impact/editability/restartRequired`)과 8층 Source 해석은 [`../configuration-resolution.md`](../configuration-resolution.md), Console 의 Form/JSON 렌더링은 [`../admin-console/03-engine-configuration-schema.md`](../admin-console/03-engine-configuration-schema.md). 이 문서는 5개 기본 엔진의 **키 목록과 키별 편집 가능성**을 확정한다. 원문: 추가 기획안 §52~§57, 관리자 콘솔 §86·§87.

## 1. 목적

엔진마다 다른 설정 항목을 화면에 하드코딩하지 않고 엔진이 자기 스키마를 제공하게 한다(§56·§75-13). 스키마는 검증(06)·동적 Form(14)·Export/Import·Effective Configuration 표시의 공통 입력이다.

## 2. 범위

- 포함: 스키마 서식 요약, 5개 엔진의 키·타입·기본값·범위·편집 가능성, `connectionType` 별 편집 가능성 차이, 스키마 버전 상승 시 마이그레이션 규칙.
- 제외: 값의 해석 순서(정본 링크), 화면(14).

## 3. 설계

### 3.1 서식 요약 (정본과 동일, 이 문서에서 쓰는 확장 2개 표시)

```json
{ "engineId": "faster-whisper", "schemaVersion": 1,
  "keys": [ { "key": "runtime.model", "group": "runtime", "type": "ENUM", "enum": ["…"], "default": "medium",
              "editability": "RESTART_REQUIRED", "restartRequired": true, "description": "…", "impact": "…",
              "appliesTo": ["HTTP","LOCAL"], "editabilityBy": { "HTTP": "READ_ONLY" } } ] }
```

- `type` ∈ `STRING · INTEGER · NUMBER · BOOLEAN · ENUM · URL · PATH · SECRET_REF · JSON`. `key` 는 `connection.` 또는 `runtime.` 접두(06 §3.2 의 두 JSON 에 대응).
- `editability` ∈ `READ_ONLY · RUNTIME_EDITABLE · RESTART_REQUIRED · REDEPLOY_REQUIRED · SECRET`(`Editability` enum). `SECRET` 키의 값은 항상 `credentialRef` 문자열이며 Export 시 그대로, Trace/Log 에는 키 이름만.
- 확장 ①`appliesTo`: 이 키가 유효한 `connectionType`. 다른 타입의 connection 에 있으면 `E_CONN_UNKNOWN_KEY`. ②`editabilityBy`: 타입별 편집 가능성 덮어쓰기(예: 남의 서비스에 HTTP 로 붙는 경우 런타임 키는 READ_ONLY). 정본 서식에 이 두 필드가 없으면 정본에 추가를 요청한다(미결 1).
- 공통 키(모든 엔진): `runtime.logLevel`(ENUM `ERROR·WARN·INFO·DEBUG·TRACE`, 기본 `INFO`, RUNTIME_EDITABLE, PRODUCTION 은 `TRACE` 금지 — `../admin-console/15-developer-diagnostic-api.md`).

### 3.2 `faster-whisper` (schemaVersion 1, connectionTypes HTTP·LOCAL)

```json
{"key":"connection.baseUrl","type":"URL","default":"http://127.0.0.1:8090","editability":"RUNTIME_EDITABLE","appliesTo":["HTTP"],"description":"whisper-service 주소"}
{"key":"connection.path","type":"STRING","default":"/transcribe-chunk","editability":"RUNTIME_EDITABLE","appliesTo":["HTTP"]}
{"key":"connection.timeoutMs","type":"INTEGER","default":60000,"min":5000,"max":180000,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.retry","type":"INTEGER","default":1,"min":0,"max":3,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.credentialRef","type":"SECRET_REF","default":null,"editability":"SECRET","appliesTo":["HTTP"],"description":"Bearer 토큰 ref(선택)"}
{"key":"runtime.model","type":"ENUM","enum":["tiny","base","small","medium","large-v3","large-v3-turbo"],"default":"medium","editability":"RESTART_REQUIRED","restartRequired":true,"editabilityBy":{"HTTP":"READ_ONLY"},"impact":"메모리 1.7GB(medium)~6GB(large-v3), CPU 지연"}
{"key":"runtime.device","type":"ENUM","enum":["cpu","cuda","auto"],"default":"cpu","editability":"RESTART_REQUIRED","restartRequired":true,"editabilityBy":{"HTTP":"READ_ONLY"}}
{"key":"runtime.computeType","type":"ENUM","enum":["int8","int8_float16","float16","float32","default"],"default":"int8","editability":"RESTART_REQUIRED","restartRequired":true,"editabilityBy":{"HTTP":"READ_ONLY"}}
{"key":"runtime.cpuThreads","type":"INTEGER","default":4,"min":1,"max":16,"editability":"RESTART_REQUIRED","restartRequired":true,"editabilityBy":{"HTTP":"READ_ONLY"}}
{"key":"runtime.workers","type":"INTEGER","default":1,"min":1,"max":4,"editability":"RESTART_REQUIRED","restartRequired":true,"editabilityBy":{"HTTP":"READ_ONLY"}}
{"key":"runtime.language","type":"STRING","default":"ja","editability":"RUNTIME_EDITABLE"}
{"key":"runtime.beamSize","type":"INTEGER","default":5,"min":1,"max":10,"editability":"RUNTIME_EDITABLE","impact":"지연 ∝ beamSize"}
{"key":"runtime.vadFilter","type":"BOOLEAN","default":true,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.wordTimestamps","type":"BOOLEAN","default":false,"editability":"RUNTIME_EDITABLE","description":"Phase 3 발음 정렬용"}
```

### 3.3 `reazon-sherpa` (schemaVersion 1, connectionTypes ONDEVICE·HTTP)

```json
{"key":"connection.baseUrl","type":"URL","default":"http://127.0.0.1:8100","editability":"RUNTIME_EDITABLE","appliesTo":["HTTP"]}
{"key":"connection.wsPath","type":"STRING","default":"/ws/speech","editability":"RUNTIME_EDITABLE","appliesTo":["HTTP"]}
{"key":"connection.timeoutMs","type":"INTEGER","default":15000,"min":3000,"max":60000,"editability":"RUNTIME_EDITABLE","appliesTo":["HTTP"]}
{"key":"connection.modelManifestUrl","type":"URL","default":"https://kaiwa.xn--lh0b87pnudm10a4vd.com/models/reazonspeech-int8/manifest.json","editability":"REDEPLOY_REQUIRED","appliesTo":["ONDEVICE"],"description":"앱이 모델을 받는 manifest. 배포 경로와 묶임"}
{"key":"connection.modelVersion","type":"STRING","default":"2024-08-01-int8","editability":"RESTART_REQUIRED","restartRequired":true,"description":"ONDEVICE 는 다음 앱 기동 시 재다운로드, HTTP 는 gateway 재시작"}
{"key":"runtime.provider","type":"ENUM","enum":["cpu"],"default":"cpu","editability":"READ_ONLY","description":"GPU 없음·모바일 CPU 고정"}
{"key":"runtime.numThreads","type":"INTEGER","default":2,"min":1,"max":8,"editability":"RESTART_REQUIRED","restartRequired":true,"impact":"ONDEVICE 는 발열·배터리, HTTP 는 gateway CPU 경합"}
{"key":"runtime.decodingMethod","type":"ENUM","enum":["greedy_search","modified_beam_search"],"default":"greedy_search","editability":"RUNTIME_EDITABLE"}
{"key":"runtime.maxActivePaths","type":"INTEGER","default":4,"min":1,"max":8,"editability":"RUNTIME_EDITABLE","description":"modified_beam_search 전용"}
{"key":"runtime.model.encoder","type":"PATH","default":"encoder-epoch-99-avg-1.int8.onnx","editability":"READ_ONLY","description":"modelVersion 에서 파생"}
{"key":"runtime.model.decoder","type":"PATH","default":"decoder-epoch-99-avg-1.onnx","editability":"READ_ONLY"}
{"key":"runtime.model.joiner","type":"PATH","default":"joiner-epoch-99-avg-1.int8.onnx","editability":"READ_ONLY"}
{"key":"runtime.model.tokens","type":"PATH","default":"tokens.txt","editability":"READ_ONLY"}
{"key":"runtime.sampleRate","type":"INTEGER","default":16000,"editability":"READ_ONLY"}
{"key":"runtime.vad.model","type":"ENUM","enum":["silero"],"default":"silero","editability":"READ_ONLY"}
{"key":"runtime.vad.threshold","type":"NUMBER","default":0.5,"min":0.1,"max":0.9,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.vad.minSilenceMs","type":"INTEGER","default":500,"min":200,"max":2000,"editability":"RUNTIME_EDITABLE","impact":"endpoint 체감 지연"}
{"key":"runtime.vad.minSpeechMs","type":"INTEGER","default":250,"min":100,"max":1000,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.vad.maxSpeechSec","type":"INTEGER","default":20,"min":5,"max":30,"editability":"RUNTIME_EDITABLE","description":"강제 세그먼트 분할"}
{"key":"runtime.partialEmit","type":"BOOLEAN","default":true,"editability":"RUNTIME_EDITABLE","description":"세그먼트 partial 이벤트(자막)"}
```

### 3.4 `style-bert` (schemaVersion 1, connectionTypes HTTP)

```json
{"key":"connection.baseUrl","type":"URL","default":"http://${M4_HOST}:8200","editability":"RUNTIME_EDITABLE"}
{"key":"connection.timeoutMs","type":"INTEGER","default":20000,"min":5000,"max":60000,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.retry","type":"INTEGER","default":1,"min":0,"max":3,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.credentialRef","type":"SECRET_REF","default":null,"editability":"SECRET","description":"tts-service 토큰 ref(선택)"}
{"key":"runtime.language","type":"ENUM","enum":["JP"],"default":"JP","editability":"READ_ONLY"}
{"key":"runtime.maxChars","type":"INTEGER","default":100,"min":50,"max":200,"editability":"RUNTIME_EDITABLE","description":"문장 분할 상한(SBV2 기본 100자 제한)"}
{"key":"runtime.sdpRatio","type":"NUMBER","default":0.2,"min":0,"max":1,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.noise","type":"NUMBER","default":0.6,"min":0,"max":2,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.noiseW","type":"NUMBER","default":0.8,"min":0,"max":2,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.device","type":"ENUM","enum":["cpu","mps"],"default":"mps","editability":"RESTART_REQUIRED","restartRequired":true,"impact":"M4 MPS vs CPU 합성 시간(실측 게이트 ③)"}
{"key":"runtime.concurrency","type":"INTEGER","default":1,"min":1,"max":4,"editability":"RESTART_REQUIRED","restartRequired":true}
{"key":"runtime.warmup","type":"BOOLEAN","default":true,"editability":"RESTART_REQUIRED","restartRequired":true,"description":"기동 시 기본 voice 1문장 합성"}
```

`speed·pitch·intonation·style·styleWeight` 는 **요청 파라미터**(13)이지 connection 설정이 아니므로 스키마에 없다.

### 3.5 `claude-cli` (schemaVersion 1, connectionTypes CLI)

```json
{"key":"connection.bin","type":"PATH","default":"claude","editability":"RESTART_REQUIRED","restartRequired":true}
{"key":"connection.cwd","type":"PATH","default":"<release root>","editability":"READ_ONLY","description":"tutor.md 를 찾는 기준 경로"}
{"key":"connection.timeoutMs","type":"INTEGER","default":60000,"min":10000,"max":180000,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.lanes","type":"INTEGER","default":2,"min":1,"max":4,"editability":"RESTART_REQUIRED","restartRequired":true,"description":"동시 spawn 레인(interactive/batch)"}
{"key":"connection.permissionMode","type":"ENUM","enum":["dontAsk"],"default":"dontAsk","editability":"READ_ONLY"}
{"key":"connection.authMode","type":"ENUM","enum":["SUBSCRIPTION"],"default":"SUBSCRIPTION","editability":"REDEPLOY_REQUIRED","description":"서버 구독 로그인. API 키 없음"}
{"key":"runtime.tiers.talk","type":"ENUM","enum":["haiku","sonnet","opus"],"default":"haiku","editability":"RUNTIME_EDITABLE","impact":"회화 턴 지연·구독 사용량"}
{"key":"runtime.tiers.review","type":"ENUM","enum":["haiku","sonnet","opus"],"default":"sonnet","editability":"RUNTIME_EDITABLE"}
{"key":"runtime.tiers.analysis","type":"ENUM","enum":["haiku","sonnet","opus"],"default":"opus","editability":"RUNTIME_EDITABLE"}
{"key":"runtime.streamJson","type":"BOOLEAN","default":true,"editability":"RUNTIME_EDITABLE","description":"partial 스트리밍(stream-json)"}
{"key":"runtime.agentsFile","type":"PATH","default":".claude/agents/tutor.md","editability":"READ_ONLY","description":"페르소나 파일. 내용 버전은 Prompt Registry"}
{"key":"runtime.maxConcurrentTurnsPerUser","type":"INTEGER","default":1,"editability":"READ_ONLY"}
```

### 3.6 `home-m4` (schemaVersion 1, connectionTypes HTTP)

```json
{"key":"connection.baseUrl","type":"URL","default":"http://${M4_HOST}:${M4_API_PORT}/v1","editability":"RUNTIME_EDITABLE"}
{"key":"connection.timeoutMs","type":"INTEGER","default":120000,"min":10000,"max":300000,"editability":"RUNTIME_EDITABLE","impact":"콜드로드 147초 사례"}
{"key":"connection.retry","type":"INTEGER","default":0,"min":0,"max":2,"editability":"RUNTIME_EDITABLE"}
{"key":"connection.credentialRef","type":"SECRET_REF","default":"file:home-m4-api-key","editability":"SECRET","required":true}
{"key":"runtime.model","type":"STRING","default":"qwen2.5:14b","editability":"RUNTIME_EDITABLE"}
{"key":"runtime.systemFirst","type":"BOOLEAN","default":true,"editability":"READ_ONLY","description":"첫 메시지 system 가드(주식분석가 프롬프트 주입 방지)"}
{"key":"runtime.maxTokens","type":"INTEGER","default":1024,"min":256,"max":4096,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.temperature","type":"NUMBER","default":0.3,"min":0,"max":1,"editability":"RUNTIME_EDITABLE"}
{"key":"runtime.jsonRetry","type":"INTEGER","default":1,"min":0,"max":2,"editability":"RUNTIME_EDITABLE","description":"extractJson 실패 시 재요청"}
{"key":"runtime.allowedTasks","type":"JSON","default":["wordEnrich","distractors","fallbackTalk"],"editability":"RUNTIME_EDITABLE","description":"이 connection 이 맡을 수 있는 LLM 작업"}
```

### 3.7 스키마 버전 상승 시 마이그레이션 (05 §3.5-4)

1. 새 키: `default` 로 채움(행에 쓰지 않고 하위 층에서 해석). 2. 제거된 키: 행에서 삭제하고 `ConfigurationVersion` 에 diff 기록. 3. `enum` 축소로 현재 값이 무효: `status=MISCONFIGURED` + `details`. 4. `type` 변경: 변환 불가 시 3 과 동일. 5. 어느 경우든 `AuditLog(action='engine.schemaMigrated')`.

## 4. 검증 규칙 · 오류 코드

| 코드 | 상황 |
|---|---|
| `E_CONN_SCHEMA_INVALID` (422) | 타입·범위·enum 위반(`details:[{key, reason}]`) |
| `E_CONN_UNKNOWN_KEY` (422) | 스키마에 없는 키 또는 `appliesTo` 밖 |
| `E_CONN_READ_ONLY_KEY` (422) | READ_ONLY(또는 `editabilityBy` 로 READ_ONLY) 키 변경 시도 |
| `E_CONN_SECRET_VALUE` (400) | `SECRET_REF` 키에 `env:`/`file:` 형식이 아닌 값(평문 의심) — 저장 거부 |
| `E_CONN_RESTART_REQUIRED` (200 경고) | 06 |

## 5. Phase

- Phase 1: 5개 스키마 코드화·검증 사용·`GET /api/admin/v1/engines?includeSchema=true`·Python 내보내기.
- Phase 2: 동적 Form 편집(14)·마이그레이션 §3.7.

## 6. 미결

1. `appliesTo`·`editabilityBy` 를 정본 서식에 넣을지, 대신 connectionType 별 스키마를 따로 낼지(`reazon-sherpa@ONDEVICE`, `reazon-sherpa@HTTP`) — 전자 권고.
2. `claude-cli` 의 모델 문자열이 별칭(`haiku`)인지 전체 id 인지 — `claudeCli.ts` 이식 시 확정.
3. VoiceVault whisper-service 가 `beamSize`·`language` 를 요청 파라미터로 받는지 실측 후 RUNTIME_EDITABLE 유지 여부 결정.
