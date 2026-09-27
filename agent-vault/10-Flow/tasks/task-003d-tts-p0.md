---
task_id: task-003d
title: "TTS P0 — M4 tts-service + 앱 TTS 플랫폼 층 + 미리듣기·상태 표시등"
status: in-progress
base_ref: bbb1f31
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, codex, deployer]
related_tasks: [task-003c-tts-productization-design, task-005-settings-attendance, task-005b-admin-console-skeleton, task-006-chat-correction]
tags:
  - type/task
  - domain/speech
  - domain/tts
aliases:
  - TTS P0
  - M4 tts-service
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-003 중 **TTS 부분(P0)** — 폰 없이 끝낼 수 있는 범위. task-003 을 셋으로 나눈다: **003d TTS P0(이 task)** · 003e gateway + 웹 STT 폴백 · 003f Capacitor 셸 + 온디바이스 STT 플러그인 + APK(실기기).
완료 기준(§15 에서 TTS 해당분): **M4 tts-service 자체 FastAPI**(`style_bert_vits2` 라이브러리, `/synthesize` RenderingPlan 계약·pitch/intonation·사전 옵션 실측) 1문장 합성·재생, 정규화·발음 사전(P0)·`SpeechProfile`·캐시 키 12요소, 실측 게이트(TTS 항목) + TTFA(서버 측).
정본: `docs/design/speech-platform/16-tts-productization-layer.md`(§1~§6·§7.2·§10~§12 P0), `speech/tts-service/README.md`(래퍼 엔드포인트·env·워치독), `docs/design/configuration-resolution.md` §4(TTS Parameter Resolver), `docs/design/api-contract.md`(`/api/v1/speech/tts`·`/voices/preview`·`/speech/tts/status`, §7 TTS 보완), `docs/design/domain-model.md`(TtsCache·PronunciationLexiconEntry/Version·VoiceProfile·VoiceModel·UserVoiceSetting.speechProfile), `docs/design/module-dependency.md` L4·§4-1·§4-2·§11, `speech/tts-service/SETUP-M4.md`(M4 확정 환경).

## 관련 과거 이력 요약
- [[task-003c-tts-productization-design]]: TTS Productization 층 설계(발음 사전+버전·정규화·Rendering Plan·SpeechProfile 5종·청크 스트리밍·상태 표시등 = P0). SBV2 원 서버에는 사전·타이밍·스트리밍·pitch 라우트가 없어 **M4 자체 FastAPI 래퍼**로 결정.
- [[task-005-settings-attendance]]: 설정 허브 목소리 화면·`/api/v1/voices/preview`(지금은 `422 ENGINE_UNAVAILABLE` "목소리 서버 준비 중")·`speech/voices/{registry,preview}`·`UserVoiceSetting`.
- [[task-005b-admin-console-skeleton]]: engine registry·Health/Functional Test(TTS 는 서비스 없음 → UNAVAILABLE)·**발음 사전 관리 화면(G1)이 이 task 이후로 이월**됨.
- [[task-006-chat-correction]]: 턴 SSE 에 `audio` 이벤트는 아직 없음(task-007).
- **M4 준비 완료(2026-09-27, OPS-QUEUE #5)**: `~/kaiwa-tts-run`(저장소 clone, SSH push 로 동기화) · Python 3.11 venv · SBV2 2.5.0 · torch 2.14 · **transformers 4.57.6·numpy 1.26.4·setuptools 80.10.2 필수** · jvnv-F1-jp · 일본어 BERT · `.env` KAIWA_TTS 7키 · 1문장 합성 CPU 0.39s / MPS 0.21s(2회째), MPS 첫 합성 4.2s(워밍업).

## Leader's Plan (2026-09-27)

### 범위 결정 (Leader)
- **T1 분할**: 003d = TTS P0(서버·웹). **청크 스트리밍(SSE `audio{chunkIndex}`)·TtsPlaybackQueue·턴 TTS 는 task-007**(§15 표). 발음 사전 **관리 화면·API(Import/Export·Preview·Rollback)는 003g 로 분리** — 이 task 는 사전 엔티티·서비스·적용(방식 A: 플랫폼 치환)·버전·시드 항목까지.
- **T2 화자 매핑**: 시드대로 Haruka=`jvnv-F1-jp` · Sakura=`jvnv-F2-jp` · Takumi=`jvnv-M1-jp`(speaker 0). M4 에 F2·M1 모델을 추가로 받는다(Leader 가 SSH 로). 최종 확인은 사용자가 미리듣기로 듣고 결정(미결 항목 종결 후보).
- **T3 내부 인증**: 앱 → M4 는 `X-Internal-Secret`(우분투 `SPEECH_INTERNAL_SECRET` = M4 `KAIWA_TTS_INTERNAL_SECRET`). connection `credentialRef` 설정 쓰기는 하지 않는다(ConfigurationVersion 은 Phase 2) — 내부 서비스 공용 시크릿으로 `infra` 가 env 에서 읽는다.
- **T4 M4 운영**: uvicorn `0.0.0.0:8200` + 기동 워밍업(MPS 첫 합성 4s 흡수) + crontab 워치독 + `.deploy.lock`. 배포 = 우분투에서 SSH push(`git push brownjeon@192.168.219.100:kaiwa-tts-run HEAD:refs/remotes/origin/main`) → M4 `git merge --ff-only` → 재기동 스크립트. **M4 서비스 기동·crontab 등록은 사용자 승인 후**(CLAUDE.md "M4 배포 사용자 승인").
- **T5 정밀도**: 래퍼는 BERT·모델을 명시적으로 float32 로 고정(transformers 버전과 무관하게 half 충돌 방지 — SETUP-M4 실측 교훈).

### 구현 전략
- **M4 `speech/tts-service/`(AGPL 경계, developer A)**: `app.py` 자체 FastAPI — `POST /synthesize`(RenderingPlan 세그먼트 1개 = 문장 ≤100자, 엔진 중립 파라미터 → SBV2 변환은 여기서만), `GET /voices`, `GET /health`(warmedUp·device·modelsLoaded, 시크릿·경로 없음), `POST /g2p`(읽기·악센트 — 사전·정규화 검증용), `POST /admin/models/refresh`, `X-Internal-Secret` 상수시간 비교, `asyncio.Lock` 직렬화 + `queue_timeout_ms` 503, 기동 워밍업, `requirements.txt`(확정 버전 고정), `scripts/{kaiwa-tts-watchdog.sh, restart.sh}`, 단위 테스트(pytest, 모델 없이 도는 계약 테스트).
- **앱 L4 `speech/tts`(developer B)**: `normalizer`(숫자·날짜·시간·단위·기호·영문 — §3 P0 범위) · `lexicon`(엔티티 읽기·범위 우선순위·방식 A 적용·`dictionaryVersion`) · `renderingPlan`(엔진 독립 스키마, §4.1) · `profiles`(SpeechProfile 5종, §5) · `parameterResolver`(User > VoiceProfile > Persona > Context > LLM) · `cache`(DATA_ROOT/tts-cache, 키 12요소 §155) · `status`(§158 판정·히스테리시스) · `metrics`(TTS 하위 단계 Trace, 본문 없음). L5 `engine/adapters/tts/styleBertHttp`(유일하게 SBV2 파라미터를 앎). 라우트 `POST /api/v1/speech/tts`(audio/wav) · `/api/v1/voices/preview` 활성화 · `GET /api/v1/speech/tts/status`. 관리자 콘솔 TTS Health/Functional Test 가 실제로 HEALTHY 가 되게 provider 연결.
- **화면(developer B, designer 가이드)**: 설정 목소리 미리듣기가 실제 소리 재생 · `TtsRuntimeStatusIndicator`(아바타 옆 점+라벨, 5상태, 폴링 5분/30초, 토스트 1회, 사유 시트 — 엔진명·호스트 비노출).

### 완료 기준 (qa)
1. tsc 0·lint 에러 0·단위 테스트(앱) + pytest(M4 서비스) 통과·격리 복제본 build exit 0.
2. M4 `/health` → warmedUp true·device mps·modelsLoaded 3(F1·F2·M1), 시크릿 헤더 없으면 401.
3. `POST /api/v1/speech/tts` 1문장 → audio/wav 재생 가능, **같은 요청 2회째는 캐시 적중**(M4 호출 0), 캐시 키 12요소 중 하나(속도·프로필·사전 버전)만 바뀌어도 미적중.
4. 정규화: 숫자·날짜·시간·단위 문장 골든 20개가 기대 읽기로 변환(`/g2p` 로 대조).
5. 발음 사전: 시드 항목이 적용돼 읽기가 바뀌고, 항목 비활성 → `dictionaryVersion` 변경 → 캐시 미적중.
6. SpeechProfile 5종·speed/pitch/intonation 이 합성 결과 길이·피치에 반영(LEARNING_SLOW 는 길이 증가).
7. 설정 화면 미리듣기: 세 목소리(Haruka·Sakura·Takumi) 모두 소리 남, 422 사라짐, 분당 10회 초과 429.
8. 상태 표시등: M4 정상 🟢 ONLINE / M4 중지 → 🔴 TEXT_ONLY(자막만) + 토스트 1회 / 복귀 🟢, 엔진명·호스트 비노출.
9. 실측 게이트(TTS): 20자 문장 합성 p50(캐시 MISS) ≤1.0s, HIT ≤0.12s, 콜드 스타트 시간, Ollama 동시 부하 시 변화, RSS — `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md` 에 기록.
10. 응답·로그·Trace 에 원문 전체·시크릿·엔진명(사용자 응답) 0.

### 네이티브 변경
없음(웹·M4 만).

### 설계 확정 — Codex C1 지적 반영 (Leader, 2026-09-27 21:55)
- **S1 (High 채택) TTS 전용 시크릿**: `SPEECH_INTERNAL_SECRET` 재사용 금지 → 우분투 `.env`(NFS·미러) 에 **`TTS_SERVICE_SECRET`** 신설(값 별도, `.env.example` 에 키 추가), M4 `KAIWA_TTS_INTERNAL_SECRET` 을 이 값으로 교체(해시 일치 확인, 값 미출력). **T3 수정**: 앱 어댑터는 `TTS_SERVICE_SECRET` 만 쓴다.
- **S2 (Medium 채택) M4 노출 축소**: `/admin/*` 는 **M4 loopback(127.0.0.1) 요청만** 허용(원격이면 404 — 존재 비노출), 합성·목록·g2p 만 원격 허용. 8200 **상시 기동 전 필수 조건** = macOS pf 로 8200 을 우분투 접속 IP(**M4 가 보는 값 `125.177.194.26`** — NAT hairpin, 2026-09-27 `SSH_CLIENT` 실측)와 localhost 에만 허용(사용자 sudo). 요청 본문·텍스트 상한·큐 타임아웃으로 DoS 완화.
- **S3 (Medium 채택) 캐시 오디오 조회 권한**: `GET /api/v1/speech/tts/:cacheKey`(턴 `audio.url`)는 **이 task 에서 만들지 않는다**(task-007). 만들 때는 사용자·대상(chatId)에 묶인 **짧은 만료 HMAC 서명 URL**(opaque, 키 추측·존재 오라클 불가) 필수 — task-007 사양에 이월. 이번 `POST /api/v1/speech/tts`·`/voices/preview` 는 응답 본문으로 오디오를 직접 준다.

### 설계 확정 — designer §7-11 (Leader, 2026-09-27)
- **U1** 미리듣기 #18 요청에 `speechProfile` 추가(들려주는 방식 draft 반영) — api-contract 개정.
- **U2** 미리듣기는 **통합 버튼 1개**(speech-platform/04 §1 정본) — 목소리 카드 선택 후 같은 버튼. Leader 의 "카드별" 표현은 철회.
- **U3** 미리듣기·합성 응답 헤더 `X-Tts-Cache: HIT|MISS` 추가(엔진 정보 아님). JSON(url·cacheKey) 응답은 #24 서명 URL 과 함께 task-007.
- **U4** 422 코드는 §0-5 정본 `ENGINE_UNAVAILABLE`(`details.reason:"TTS_UNAVAILABLE"`)로 통일 — api-contract 개정.
- **U5** 사용자 응답의 `runtime.connectionKey` 제거(완료 기준 10) — api-contract 개정, SSE `audio` 도 task-007 에서 같은 규칙.
- **U6** 공용 변경 3건 승인(additive, 기존 동작 불변): `Toast` 표시 시간 인자(기본값 유지), `TeacherAvatar` 를 `components/common` 으로 이동(chat import 경로만 갱신), `LearningSettings` 저장 후 `router.refresh()`.
- **U7** 앱 서버 불통도 🔴 자막만(`NO_CONNECTION`) — 승인.

## 판단 기록 (judge)
- [2026-09-27 21:44] intake engine=jev → R2 feature complexity=2.71 developer=opus needs_info=true next=ask_user | overrides=- | fallback=- | tokens=1095
  - **override**(Leader): `next=ask_user` 미적용 — 판단 대상(래퍼 계약·정규화·사전·Rendering Plan·Profile·캐시 키·상태 판정)은 speech-platform/16·tts-service README 에 정해져 있고, 유일한 미결(화자 매핑)은 시드 매핑(T2)으로 진행 후 사용자가 미리듣기로 확정한다. M4 기동·crontab 은 사용자 승인 게이트(T4)로 남긴다. risk=R2 채택(외부 서비스·내부 시크릿·AGPL 경계).

## Codex 검토

### [2026-09-27 21:52] C1 adversarial-review focus=security — done
- judge 판정: [2026-09-27 21:45] codex_gate/C1 / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=bbb1f31(task_file) snapshot=5d292e4
- 지적 3건:
  - [high] `agent-vault/10-Flow/tasks/task-003d-tts-p0.md:37` — TTS 서비스가 우분투 speech gateway/worker/앱 내부 콜백과 동일한 `SPEECH_INTERNAL_SECRET` 값을 재사용 → M4 호스트 노출 시 다른 내부 서비스까지 횡이동 대상. 권고: TTS 전용 시크릿 분리, `TTS_SERVICE_CREDENTIAL_REF` 또는 전용 env 사용
  - [medium] `speech/tts-service/SETUP-M4.md:119` — M4 바인드 후 방화벽이 선택사항으로 미루어지고 LAN + 헤더만 신뢰 → `/admin/*` (models/refresh, voice import) 원격 실행 가능. 권고: 방화벽 또는 인터페이스 제한을 필수로, /admin/* 분리 또는 별도 secret
  - [medium] `docs/design/api-contract.md:567` — 캐시 조회가 사용자 소유 검사 없이 cacheKey만 신뢰 → 공용 문장/개인 대화 캐시 분리 부족, 200/404 오라클로 탐색 가능. 권고: 조회 URL 사용자별 opaque id/서명 URL, TtsCacheAccess 권한 검사, 개인 오디오는 userId/chatId 바인딩
- 검토하지 못한 범위: 구현 코드(아직 없음), 실제 FastAPI 인증 미들웨어/CORS/rate limit/로그 마스킹 코드. 스냅샷 diff는 설계 문서(task-003d 신규 파일) 기준만.
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T124716Z-task-003d-C1/raw.txt`

## Designer 기록
- [21:57] 가이드 완료 → `docs/screens.md` §7(7-0~7-11) + §2 설정·음성 회화방 행 갱신. 표시등 = 설정 "AI 선생님 목소리" 카드 머리(아바타 옆 이름 아래 줄), task-007 이 같은 컴포넌트·앱 단일 스토어 재사용.
- [21:57] 결정: 5상태 점+라벨+`role=status`, 폴링 5분/30초·offline 즉시 자막만·online 즉시 재확인, 조회 실패 연속 2회·합성 502/504 연속 2회에만 전환, 토스트는 설정 상태 변경당 1회(첫 확인 제외), 사유 시트 문구표(SERVER_ERROR·SERVER_TIMEOUT·NO_CONNECTION·OFFLINE).
- [21:57] 미리듣기: 통합 버튼 1개(04 §1), 재누름 정지·draft 변경 시 정지/폐기, `Accept: audio/wav` 본문 + 탭 안 동기 `AudioContext` 잠금 해제(자동재생), 422/429(카운트다운)/502/504 문구표. 신규 `src/components/speech/*` 7개 + 스토어 단위 테스트.
- [21:57] **Leader 확인 필요**(§7-11): ① #18 에 `speechProfile` 추가(현 라우트는 무시) ② 카드별 ▶ 대신 통합 1개 ③ `X-Tts-Cache: HIT|MISS` 헤더 ④ 422 코드명 통일 ⑤ **#23·SSE `runtime.connectionKey:"style-bert-m4"` 가 사용자 응답 엔진명 → 완료 기준 10 위반, 제거 권장** ⑥ 공용 변경 3건(Toast 지속시간·TeacherAvatar 이동·LearningSettings refresh) ⑦ 앱 서버 불통도 자막만.

## Developer 기록

### A(M4 tts-service)
- [22:18] 구현 완료 — 커밋 `d9afabc`(서비스) · `7d51c48`(스크립트 실행 비트·롤백 보강). Gitea push 안 함(Leader 합침). 파일: `speech/tts-service/{app.py, kaiwa_tts/{config,schemas,params,models,backend,holder,runtime,security,server}.py, tests/{conftest,test_api,test_units}.py, scripts/{restart.sh, kaiwa-tts-watchdog.sh, deploy-from-ubuntu.sh, check_pins.py, smoke.py, bench_synth.py, _client.py}, requirements.txt, requirements-dev.txt, pyproject.toml, .gitignore, README.md(§1~3·5·6·8 갱신), SETUP-M4.md(S1 TTS 전용 시크릿·§6-2 pf 필수·§7 승인 후 절차), LICENSE-NOTICE.md(1줄)}`. 측정 기록 [[speech-p0-measurements]].
- [22:18] **최종 계약(B 어댑터가 따를 것, 정본 `speech/tts-service/README.md` §2 — api-contract #147~#152·§7-3 의 옛 필드명·세그먼트 배열을 대체, Leader 문서 정리 필요)**:
  - `POST /synthesize` 헤더 `X-Internal-Secret`(= 앱 `TTS_SERVICE_SECRET`) · 본문 `{text(1~100자, NFC·trim 후, 줄바꿈·제어문자 금지), voice:{model?(기본 KAIWA_TTS_DEFAULT_MODEL), speaker=0, style='Neutral', styleWeight 0~5=1}, controls:{speed 0.5~2=1, pitch 0.5~1.5=1, intonation 0~2=1, pauseBeforeMs?(무시)}, engine?:{sdpRatio 0~1=0.2, noise 0~2=0.6, noiseW 0~2=0.8}, profile?:NATIVE|LEARNING_NORMAL|LEARNING_SLOW|PRONUNCIATION|SHADOWING(로그만), traceId?:[A-Za-z0-9_.:-]{1,64}}` — **알 수 없는 키는 400**(speaker_id·pitch_scale 등 SBV2 이름을 보내면 거부).
  - 200 `audio/wav`(PCM16 mono 44.1kHz) + `X-Kaiwa-Latency-Ms`·`X-Kaiwa-Queue-Ms`·`X-Kaiwa-Synth-Ms`·`X-Kaiwa-Encode-Ms`·`X-Kaiwa-Audio-Ms`·`X-Kaiwa-Sample-Rate`·`X-Kaiwa-Model`(id)·`X-Kaiwa-Style`(URL 인코딩)·`X-Kaiwa-Style-Fallback: 0|1`·`X-Kaiwa-Adjust: none|applied|skipped`·`X-Service-Version`·`X-Trace-Id`.
  - 오류 `{error:{code,message}}`: 400 `INVALID_REQUEST`(+`fields[{loc,type}]`)·`TEXT_EMPTY`·`TEXT_TOO_LONG`·`TEXT_INVALID`·`UNKNOWN_MODEL`·`UNKNOWN_SPEAKER` / 401 `UNAUTHORIZED` / 413 `BODY_TOO_LARGE`(>8KB) / 503 `NOT_READY`(Retry-After 5·30)·`BUSY`(Retry-After 2) / 500 `SYNTH_FAILED`. 스타일이 모델에 없으면 400 이 아니라 `Neutral` 로 대체(헤더로 알림) — JVNV 3종 스타일은 `Neutral·Angry·Disgust·Fear·Happy·Sad·Surprise`(**Friendly 없음** — B 의 `renderingPlan`·`parameterResolver` 는 이미 `['Friendly','Happy']` 후보 순서라 `Happy` 로 간다, 확인만).
  - `GET /voices` → `{defaultModel, models:[{modelName, version, checkpoint, status, loaded, sampleRate, speakers[{id,name}], styles[], defaultStyle, sha256, error}]}` · `POST /g2p {text≤200}` → `{normalizedText, reading, accent('↑/↓'), moras[{mora,tone}]}` · `GET /health`(인증 없음) → `{ok, status: LOADING|OK|DEGRADED|FAILED|MISCONFIGURED|STUCK, service, version, license, modelsLoaded, models[], defaultModel, device, requestedDevice, deviceFallback, warmedUp, coldStartMs, uptimeSec, memoryMb, gpuMb, queue, authConfigured}` — HTTP 는 STUCK 만 503, 나머지 200. **앱 ONLINE 판정은 `ok && warmedUp`**. `POST /admin/models/refresh` 는 loopback 전용(원격 404) — 앱은 호출하지 않는다.
- [22:18] **SBV2 2.5.0 `TTSModel.infer` 실측**: `pitch_scale`·`intonation_scale` **있음**(1.0 이 아니면 pyworld harvest 후처리 +0.4s/문장·음질 약간 저하 → |x−1|<0.005 는 1.0 스냅, 후처리 실패 시 조절 없이 1회 재합성 `X-Kaiwa-Adjust: skipped`). `given_phone`/`given_tone` 도 있음(사전 방식 B 후보, 미사용). `line_split=False` 고정. BERT·모델은 float32 확인·강제(transformers 4.57.6 에서 이미 float32). **SBV2 가 합성 문장 전문을 loguru INFO 로 찍음 → ERROR 로 낮춤**.
- [22:18] 실측(MPS, 3모델 상주, 20자): 서버 p50 **0.24s**/p95 0.31s(CPU 0.41/0.47) · intonation≠1 p50 0.66/p95 0.80 · 콜드 스타트 6~7s(내부 4.6s) · footprint 3.3GB 고정 · LAN +7ms · 동시 5건 직렬 대기 선형. **발견: MPS 캐시가 요청당 ≈45MB 누적(≈200회 8.8GB) → 매 합성 뒤 `torch.mps.empty_cache()` 로 고정(코드 반영)**. MPS 는 처음 보는 문장 길이에서 1회 +0.5~1.1s 셰이더 컴파일(디스크 캐시로 재기동 뒤에도 유지). Ollama 동시 부하는 미측정(앱에 home-m4-api 자격 증명 없음·Ollama 직접 호출은 권한 밖) — 승인 후 명령은 measurements 문서.
- [22:18] 검증: pytest 78 passed(우분투 임시 venv `~/.node-local/thekaiwa-tts-test` · M4 실제 venv 둘 다) · ruff check/format · mypy strict 0. M4 임시 포트 8299 실서비스로 원격(우분투) 확인: health 200·시크릿 없음/오답 401·원격 `/admin/models/refresh`(시크릿 포함) 404·docs 401·우분투 `TTS_SERVICE_SECRET` 으로 합성 200(S1 값 일치). 워치독(8299 임시 env): 정상 무동작·중지 시 11s 내 재기동·락 있으면 건너뜀. 배포 스크립트: M4 **스크래치 clone**(`~/kaiwa-tts-deploytest`, 8299)에 정상 배포 성공 + 가짜 핀 불일치 커밋으로 롤백 훈련 성공(직전 SHA 복귀·재기동).
- [22:18] 트러블슈팅(재발 가능): ① `core.fileMode=false` 저장소에서 `git commit -- <path>` 는 `update-index --chmod=+x` 를 버린다 → 실행 비트는 경로 없이 커밋(첫 배포가 `Permission denied` 로 롤백됨, `7d51c48` 로 수정, 스크립트도 `/bin/bash` 로 명시 호출). ② M4 기본 bash 는 3.2 — 스크립트는 3.2 문법만. ③ M4 는 우분투를 `125.177.194.26`(NAT hairpin)으로 본다(HTTP 로그로도 확인).
- [22:18] M4 정리: 8299 서비스 종료, `~/kaiwa-tts-dev`·`~/kaiwa-tts-deploytest`·8299 로그 삭제. `~/kaiwa-tts-run` 은 손대지 않음(HEAD f1a2c11, 락 없음) · 8200 리슨 없음 · crontab 무변경 · M4 `.env` 무변경. **M4 venv 에 `pytest==9.1.1` 만 추가 설치**(requirements-dev, 테스트 전용).
- [22:18] **사용자 승인 후 실행할 명령**(순서대로):
  1. pf 방화벽(M4, sudo) — `SETUP-M4.md §6-2` 의 `/etc/pf.anchors/kaiwa-tts` 3줄 → `sudo pfctl -a com.apple/kaiwa-tts -f /etc/pf.anchors/kaiwa-tts && sudo pfctl -E` (+ 재부팅 지속 LaunchDaemon).
  2. 배포·첫 기동(우분투, Leader 가 main 에 합친 뒤) — `speech/tts-service/scripts/deploy-from-ubuntu.sh origin/main` (M4 8200 기동·warmedUp·smoke, 실패 시 롤백).
  3. 워치독(M4) — `crontab -e` 에 `* * * * * ~/kaiwa-tts-run/speech/tts-service/scripts/kaiwa-tts-watchdog.sh >> ~/kaiwa-tts-local-logs/watchdog.log 2>&1`.
  4. 확인(우분투) — `curl -s http://192.168.219.100:8200/health`(OK·warmedUp·3·mps) · 시크릿 없이 합성 401 · 원격 `/admin/models/refresh` 404 · Ollama 동시 부하 1회(measurements 문서 명령).
- [22:18] 한계·후속: ① `/admin/voices/import|disable|delete`·`/admin/log-level`·`/admin/config/*`·`timing`·`lexiconHints`·`/metrics` 미구현(Phase 2~4, README §2 끝). ② `memoryMb` 는 최대 RSS(ru_maxrss) — MPS 실사용은 `gpuMb`(드라이버 할당, 마지막 합성 시점)와 함께 봐야 한다. ③ pitch/intonation 후처리 +0.4s — dio 기반 자체 후처리로 ≈−0.15s 여지(음질 비교 후). ④ NAT hairpin 이라 pf 는 같은 공유기 뒤 다른 기기도 `125.177.194.26` 으로 통과시킬 수 있음 — 2차 방어는 시크릿·loopback admin. ⑤ 문서 정합(Leader): api-contract #147~#152·§7-3·`X-Service-Env`, README 옛 "`server_fastapi` 래퍼"(speech/README.md 구성도) 표현.

### B(앱 TTS)
- [22:34] 구현 완료 — 커밋 `b1a5bd6`(백엔드: speech/tts·engine tts 파사드·어댑터·라우트·시드) · `9ddf6ae`(화면 §7·상태 조회 예산·스모크) · `602ad68`(스모크 보정). Gitea push 안 함. 검증: tsc 0 · lint 0 error(기존 set-state-in-effect 경고 5, 신규 0) · `npm test` **242/242** · 라이브 `tests/live/task003d-smoke.sh 3011` **19/19 PASS**(M4 미기동 경로) · 390/360/412 화면 확인(Playwright).
- 파일: `src/modules/speech/tts/{text,numbers,normalizer,lexicon,sentences,profiles,types,parameterResolver,renderingPlan,cache,wav,metrics,status,request,errors,synthesize,index}.ts` · `speech/voices/{preview,registry}.ts`·`speech/index.ts` · `engine/adapters/tts/{styleBertHttp,styleBertVits2.provider}.ts` · `engine/tts/{index,errors}.ts` · `engine/registry/types.ts`(Provider 에 선택 `tts`·`functionalTest`, HealthDetail `audioBytes·durationMs`) · `engine/functionalTest/index.ts`(TTS 는 Provider 기능 테스트 실행) · `engine/index.ts` · `infra/{secrets(readServiceSecret),storage(신규),index}.ts` · `preferences/index.ts`(getVoiceSettingForTts) · `admin/present.ts`·`types/admin.ts`(기능 테스트 결과 2필드 화이트리스트) · `types/tts.ts` · 라우트 `app/api/v1/speech/{_lib/tts.ts, tts/route.ts, tts/status/route.ts}`·`voices/preview/route.ts` · 화면 `components/speech/*`(9)·`common/{TeacherAvatar,Toast,api}`·`chat/{MessageBubble,RoomIntro}`(import 만)·`settings/{VoiceSettings,LearningSettings}`·`app/(app)/settings/page.tsx` · 시드 `prisma/{seed-lexicon.ts, seed-data/lexicon.json, seed.ts}` · 테스트 `speech/__tests__/{ttsNormalizer,ttsLexiconPlan,ttsCacheRequest}.test.ts`+`fixtures/normalizerGolden.ts`(28문장)·`engine/__tests__/ttsAdapter.test.ts`·`components/speech/__tests__/ttsStatusStore.test.ts` · `tests/live/task003d-smoke.{sh,ts}`.
- **파이프라인**(단일 세그먼트): 원문 → 사전 매칭(ACTIVE 버전 스냅샷, 범위 USER>VOICE>LESSON>COURSE>GLOBAL, 최장 일치·같은 길이 priority) → 매칭 구간 보호한 정규화(날짜>시간>통화·단위>조수사 예외>숫자>약어·외래어>기호>공백, 한자 숫자 우선, 문맥 읽기만 가나: 날짜 1日=ついたち·14/24日·1人·2人·기간 1日·20歳) → Resolver(User(AUTO·null 제외)>VoiceProfile>Persona>Context>LLM>DEFAULT, voice 에 없는 스타일은 건너뜀) → RenderingPlan(요청 라벨>LLM 라벨>프로필 편향, §4.3 배율·프로필 배율·clamp·소수 3자리) → 캐시 → (MISS) 상태 확인 → engine.tts → WAV 검증 → 응답(저장은 뒤에서, 같은 키 동시 요청은 한 합성 공유).
- **캐시 키**: sha1(JSON 배열 12요소 `normalizedText, voiceProfileId, modelVersion, dictionaryVersion[:lexiconDigest], speechProfile, style, styleWeight, speed, pitch, intonation, engineConnectionKey, textVersion`), 수치는 세그먼트 유효값 `toFixed(3)`. 경로 = `DATA_ROOT/tts-cache/<키 앞2>/<키>.wav` — 조각은 키(16진 40자)만, 읽을 때도 DB path 를 믿지 않고 키로 다시 만든다(`infra.storage.dataPath` 가 조각 규칙·루트 이탈 검사). HIT 는 M4 호출 0(라이브 HIT 왕복 p50 **18~22ms**, 서버 TTFA p50 7~8ms).
- **A 계약 정합**: README §2 그대로 — `{text, voice{model, speaker, style, styleWeight}, controls{speed, pitch, intonation}, engine{sdpRatio, noise, noiseW}, profile, traceId}` + `X-Internal-Secret = TTS_SERVICE_SECRET`(S1, 16자 미만이면 호출 전 MISCONFIGURED), `X-Kaiwa-*-Ms`·`Style-Fallback` 헤더를 Trace 로. 오류 kind 분류: 401→MISCONFIGURED · 413/TEXT_TOO_LONG→400 · 503/502/504·연결 거부→UNAVAILABLE · 타임아웃(문장 8s)→504 · 그 밖 4xx→REJECTED · 비 WAV/8MB 초과→BAD_AUDIO. Health = `/health`(무인증, 시크릿 헤더 안 붙임) `status` 판정 + 앱 시크릿 존재. Functional Test = `runtime.defaultModel` 로 「これはテストです。」 1회(30s, 30초 슬롯 유지), 크기·길이만 기록.
- **정본과 다르게 한 것**: ① `TraceKind` 에 TTS 가 없어(스키마 변경 금지) #23·#18 Trace 를 모두 `PREVIEW` 로, `refType` 으로 구분(`speechTts`·`voicePreview`) — 스키마에 `TTS` 추가 여부 Leader 판단. ② 캐시 키를 `|` 연결 대신 JSON 배열 해시(요소 경계 충돌 방지), 사전 요소에 적용 힌트 요약(`lexiconDigest`)을 덧붙임 — 같은 `dictionaryVersion` 이라도 USER·LESSON·COURSE 범위가 다른 요청의 오디오가 섞이지 않게(요소 수는 12 유지). ③ A 래퍼에 `lexiconHints` 가 없어 방식 A 는 **어댑터의 플랫폼 치환**(표기→가타카나)으로 강등, descriptor 에 `SUPPORTS_USER_DICT` 없음(`SUPPORTS_PITCH·INTONATION` 추가). 치환 뒤 100자 초과는 보내지 않고 400. ④ SpeechProfile 속도 = 사용자 speed × 배율(NATIVE·LEARNING_NORMAL 1, LEARNING_SLOW learningSpeed, PRONUNCIATION 0.8, SHADOWING 0.9) — 사용자 값 덮어쓰기 없음. LEARNING_SLOW 의 EXPLANATION 편향(×0.9)이 겹쳐 0.8→0.72. ⑤ 사전 정본 = ACTIVE `PronunciationLexiconVersion.snapshot`(엔트리 테이블 아님, 버전 없으면 0·빈 사전). ⑥ `3〜5` 처럼 숫자 사이 물결표는 から(범위), 그 밖은 장음. ⑦ 서비스 `DEGRADED`(워밍업 전·CPU 폴백 — 합성은 됨)는 SERVER(표시등 온라인, 30초 폴링), `LOADING` 은 UNAVAILABLE — A 메모 "ONLINE = ok && warmedUp" 보다 "새 문장을 합성할 수 있는가"(16 §12) 기준. ⑧ 응답 헤더에 `X-Tts-Cache-Key` 도 싣지 않음(S3, 키 오라클 차단). ⑨ `chatMessageId` 는 형식만 검사하고 연결하지 않음(conversation 에 메시지 소유 조회 공개 함수 없음 — task-007 턴 SSE 에서).
- **상태 판정(서버)**: 합성 연속 2회 실패(길이 초과 제외) 또는 connection UNAVAILABLE/MISCONFIGURED → TEXT_ONLY, 복귀는 Health 1회 성공. 상태 조회가 필요할 때만 Health 실행(확인 전 즉시·저하/불가 30초·정상 5분, 기다림 상한 2초 — 화면 3초 타임아웃), 합성 전 차단도 같은 판정(불가 연결에 8초씩 기다리지 않음). Health 는 connection 상태를 갱신하므로 운영(pm2 `thekaiwa`, APP_ENV=LOCAL)도 같은 판정을 본다 — 현재 LOCAL `style-bert-m4` = UNAVAILABLE(M4 미기동, 실제 상태).
- **화면**: designer §7 대로(표시등 5상태·사유 시트·스토어 싱글턴·전환당 토스트 1회·통합 미리듣기 버튼·탭 안 동기 `AudioContext` 깨우기·재탭 정지·draft 변경 시 폐기·429 cooldown·U6 공용 3건). 화면 확인(M4 없음): 🔴 자막만·시트(이유 "목소리 서버에 연결할 수 없어요"·30초마다)·[지금 다시 확인] → 전환 중 → 자막만·미리듣기 422 토스트, 360/412 가로 넘침 0·버튼 48px 한 줄.
- **스모크 19/19**(M4 없음): 401×3 · 검증 400(엔진 수치 engine_param·101자·모르는 키·수치 속도·없는 목소리) · status TEXT_ONLY/UNAVAILABLE/NO_CONNECTION 0.8~0.95s · MISS 422(reason TTS_UNAVAILABLE, 23~59ms) · 미리 채운 캐시 HIT 5/5·헤더에 키·x-kaiwa 없음 · 프로필/속도 라벨/LLM 라벨 하나만 바꿔도 미적중 · 미리듣기 HIT·11번째 429(Retry-After) · #23 60 초과 429 · 관리자 Health UNAVAILABLE(ECONNREFUSED)·Functional SERVICE_DOWN · Trace 단계 5종·본문 없음 · 사용자 응답 100개에 엔진명·호스트·연결 키·경로·시크릿 0. 정리: 캐시 2·Trace·EngineHealth 삭제, connection 상태 원복. **AuditLog(QA admin 의 Health/Test) 는 불변이라 남음.** 화면 확인 중 표시등 조회가 만든 Health 행 일부는 남음(실제 상태 UNAVAILABLE 기록).
- **한계·후속(Leader)**: ① **M4 미기동이라 MISS 합성·세 목소리 소리·/g2p 골든 대조·SpeechProfile 길이·p50 게이트는 라이브 미확인** — M4 8200 기동 후 `TTS_SMOKE_EXPECT_M4=1 [TTS_SMOKE_G2P_URL=http://192.168.219.100:8200] bash tests/live/task003d-smoke.sh 3011`(9·9b·9c 추가 실행). ② **발음 사전 시드는 코드만**(공유 DB 라 `npm run db:seed` 미실행) — 실행하면 LOCAL·PRODUCTION 각각 GLOBAL 6건(日本橋·秋葉原·御徒町·神保町·等々力·明日)+버전 1 ACTIVE, 버전이 이미 있으면 건드리지 않음. 악센트 값은 초안(청취·g2p 로 확정). ③ **임시 포트 env 오버라이드 불가**: CONNECTION_PROFILE(6층)이 ENVIRONMENT(4층)을 덮어 `KAIWA_TTS_CONNECTION_BASEURL` 이 DB baseUrl 에 가린다 — 임시 포트 확인은 RuntimeOverride 또는 seed 값을 `"$TTS_SERVICE_URL"` 자리표시자로 바꿔야 함. ④ 캐시 용량 LRU(`tts.cache.maxBytes`)·예열·정리 잡, `tts.normalizer.overrides`, 전화번호식 숫자열, 청크·SSE·재생 큐는 P1/task-007. ⑤ `tests/live/README.md` 에 task003d 행 추가 필요(qa/leader 소관이라 손대지 않음). ⑥ intonation≠1(ENCOURAGING 라벨 1.1 등)은 M4 에서 pyworld 후처리 +0.4s — 턴 TTFA(task-007)에서 LLM 라벨 사용 시 예산 확인 필요.
- 트러블슈팅(재발 가능): QA 계정의 저장 speechProfile 이 `LEARNING_SLOW` 라 "프로필만 바꾼 요청" 비교는 저장값과 다른 프로필로 해야 한다(스모크 5d). Playwright `browser_run_code_unsafe` 는 `require`·동적 import 불가 → 쿠키는 127.0.0.1 임시 HTTP 로 `page.request.get` 후 즉시 삭제. 세션 훅이 `rm -rf`·`pkill` 을 막으면 PID `kill`·python `os.unlink` 로.

## Reviewer 기록

### REV-010 (2026-09-27, 보안 중심 — judge C1 focus=security)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0 — 발견 없음)

**범위**: `git diff bbb1f31..HEAD -- speech src tests prisma/seed-data prisma/seed.ts .env.example`(96파일, +7150/-132) + 스코프 밖이지만 `seed.ts` 가 직접 import 하는 신규 `prisma/seed-lexicon.ts`(54줄, 커밋 b1a5bd6, 원 diff 경로 지정에서 누락된 것을 추가로 확인).

**재실행 검증**:
- `npm run typecheck` — 0 error.
- `npm run lint` — 0 error(경고 5는 전부 기존 `set-state-in-effect`, 신규 파일 무관 — Developer 주장과 일치).
- `npm test` — **242/242 PASS**(직접 재실행, Developer 주장과 일치).
- M4 `pytest`(`speech/tts-service`) — **미실행**: 우분투 시스템 python3(3.10)에 `fastapi`/`pytest` 미설치, 이 세션은 venv 설치·패키지 설치 권한 밖(Read 전용 감사 원칙과도 상충)이라 건너뜀. 대신 `tests/test_api.py`·`tests/test_units.py`(합 34개 테스트 함수) 목록을 확인해 보안 시나리오(loopback IPv4/IPv6, secret 필수, docs 비활성, body 8KB 초과(Content-Length·chunked 둘 다), NaN 거부, 100자 경계, model/speaker 미상)가 전부 커버됨을 코드 레벨로 확인. Developer 의 "78 passed" 실측은 직접 재현하지 못했으므로 **NOT_VERIFIED(코드 리뷰로 정합성만 확인)** — QA/Deployer 가 M4 venv 에서 1회 재실행 권고.

**1. M4 서비스 보안(Python)** — 이슈 없음.
- `security.py` `InternalGate`: `X-Internal-Secret` 은 sha256 다이제스트끼리 `hmac.compare_digest` 로 상수시간 비교(길이 차이로도 안 샘), 없음·불일치·서버 미설정(`secret_ok=False`) 전부 401, 값은 로그에 없음(`log.warning` 은 path·client IP 만).
- `/admin/*` 는 `is_admin_path`(첫 세그먼트 판정, 대소문자 무시) + `is_loopback`(`scope["client"]`) 로 원격이면 시크릿 검사 전에 404. `restart.sh`/README 가 uvicorn 을 **`--no-proxy-headers`** 로 띄워(직접 확인, `scripts/restart.sh:101`) `X-Forwarded-For` 헤더로 `scope["client"]` 를 원격→loopback 으로 위장할 경로가 없음을 코드로 확인(uvicorn 옵션 자체가 그 헤더를 안 본다). `test_admin_from_remote_is_404_even_with_secret`·`test_admin_from_ipv6_loopback` 로 테스트도 있음.
- 본문 8KB(Content-Length 사전 거부 + 청크 수신 중 누적 거부 둘 다 구현, `security.py:99-119`), 텍스트 100자(`config.py MAX_TEXT_CHARS`), 큐 타임아웃 8초 기본(503 BUSY, `Retry-After`).
- 오류 응답(`_validation_error`)은 위치·타입만 돌려주고 입력값(문장) 자체는 절대 되돌리지 않음(`server.py:139-141`). `/health` 는 무인증이지만 시크릿·경로 필드가 없음(스키마 확인). 로그는 trace·model·글자수·지연만, 문장 전문은 `log.debug`(DEBUG 레벨 한정, 기본 INFO) 로만 — 원 SBV2 라이브러리가 문장 전문을 INFO 로 찍던 것도 ERROR 로 낮춤(`backend.py:54-61`).
- `/g2p` 는 같은 `clean_text`(NFC·제어문자·길이 200) 검증을 통과해야만 처리.
- 스크립트(`restart.sh`·`kaiwa-tts-watchdog.sh`·`deploy-from-ubuntu.sh`): `.env` 를 `source` 하지 않고 한 줄씩 파싱해 `KAIWA_TTS_*` 화이트리스트 키만 export(명령 주입 불가), `REMOTE_DIR` 정규식 검증, mkdir 락(배포↔워치독 상호 배제, 15분 stale 회수), 롤백이 새 프로세스를 먼저 내리고(`--stop`) `git reset --hard` 후 재기동, 시크릿 값은 어디서도 echo 되지 않음(`_client.py` 도 동일 원칙).
- `.safetensors` 만 모델 가중치로 허용(`.pth/.pt` pickle RCE 차단, `models.py` 주석·코드 확인), 심볼릭 링크로 `model_assets` 밖을 가리키는 항목은 `_inside()` 로 거부.

**2. AGPL 경계** — 이슈 없음. `grep -rn style_bert_vits2 src speech/common speech/gateway speech/worker` 0건, `speech/tts-service/**` 는 `speech/common` import 0건(코드·`LICENSE-NOTICE.md` §2 규칙과 일치, `kaiwa_tts/__init__.py` 에 명시 주석).

**3. 앱 TTS 보안** — 이슈 없음.
- `styleBertHttp.ts`: `readServiceSecret('TTS_SERVICE_SECRET')` 만 사용(`SPEECH_INTERNAL_SECRET` 참조 0건, `grep` 확인) — **Codex C1 S1 채택 확인**. `redirect: 'manual'`(리다이렉트 미추종), 응답 8MB(`readCapped`, 초과 시 스트림 취소), 오류 본문 4KB 상한 후 `error.code` 정규식(`^[A-Z][A-Z0-9_]{1,40}$`)만 채택, 예외 메시지에 시크릿·문장 없음.
- `cache.ts`/`infra/storage.ts`: 캐시 파일 경로는 **키(16진 40자)로만** 재구성(`cacheSegments`, 읽기 때도 DB 의 `path` 컬럼을 신뢰하지 않음), `storage.dataPath` 가 세그먼트 정규식 검증 + `resolve()` 후 `startsWith(root+sep)` 로 `DATA_ROOT` 이탈 차단.
- 사용자 응답·헤더 검사: `src/types/tts.ts`(`TTS_HEADERS`)·`_lib/tts.ts` 에 엔진명·connectionKey·cacheKey·호스트 없음, `voices/registry.ts` 의 `pickDefaults` 가 `VoiceProfile.defaults` JSON 을 5개 알려진 키로만 골라내 관리자가 raw 편집으로 엔진 식별자를 넣어도 새지 않음(REV-006 Low 재확인).
- **GET `/api/v1/speech/tts/:cacheKey` 라우트 없음** — diff·디렉터리 어디에도 생성되지 않음, api-contract 도 이 task 범위에서 만들지 않기로 명시(§ Codex C1 S3) — **채택 확인**.
- 레이트리밋: `tts:${userId}` 60/분(`route.ts:15`), `preview:${userId}` 10/분(`preview/route.ts:16`), `tts-status:${userId}` 20/분(`status/route.ts:13`) — `rateLimit()`(기존 infra, 사용자별 버킷). 세 라우트 전부 `requireSession()` 선행.

**4. 파이프라인 정확성** — 설계 문서·골든셋과 대조해 이슈 없음.
- Normalizer(`normalizer.ts`) 예외표: 1日=ついたち·14/24日=じゅうよっか/にじゅうよっか·1人/2人=ひとり/ふたり·기간 1日=いちにち(一日中/一日目 제외)·20歳=はたち 전부 구현·`normalizerGolden.ts` 28건과 대조 일치. 규칙 우선순위(사전 보호→날짜>시간>통화·단위>조수사>숫자→약어/외래어→기호→통과)가 `RULES` 배열 순서·`occupied` 구간 선점 방식으로 정확히 구현됨.
- Lexicon(`lexicon.ts`): USER>VOICE>LESSON>COURSE>GLOBAL 우선순위(`SCOPE_RANK`), 최장 일치+같은 길이 priority 큰 쪽(`findLexiconMatches`), 정본이 `ACTIVE PronunciationLexiconVersion.snapshot`(테이블 아님) — 설계 §2 그대로. `prisma/seed-lexicon.ts` 는 환경에 버전이 이미 있으면 건드리지 않는 멱등 가드 + entries·version 생성을 한 트랜잭션.
- 캐시 키(`cache.ts`) 12요소 — JSON 배열 해시 방식(`|` 구분자 충돌 회피)·`lexiconDigest` 로 사전 범위 세분화는 "요소 수 12 유지 + 정본 사전 요소를 세분"한 합리적 확장(정본 §11.1 변형이 아니라 그 안의 한 요소를 안전하게 만든 것) — 타당함.
- ParameterResolver(`parameterResolver.ts`) 우선순위 User>VoiceProfile>Persona>Context>LLM>DEFAULT, `styleWeight`/`speed`/`pitch`/`intonation` 각각 같은 순서로 재현 — 설계 §4 그대로.
- RenderingPlan(`renderingPlan.ts`) §4.3 배율표(ENCOURAGING styleWeight×0.8·intonation×1.1, CALM ×0.8/×0.95, EXPLANATION speed×0.9, EMPHASIS styleWeight×1.1·intonation×1.15·speed×0.9·pause≥150) 전부 표와 숫자까지 일치.
- SpeechProfile(`profiles.ts`) LEARNING_SLOW 는 `speedFactor:'LEARNING_SPEED'`+`defaultLabel:'EXPLANATION'` 두 정책이 합성돼 `learningSpeed(0.8) × EXPLANATION(0.9) = 0.72` 가 되는 것을 확인 — Developer 가 이미 자기 기록에 투명하게 남겼고, §4.3·§5 표를 문자 그대로 적용한 자연스러운 결과(임의 로직 추가 아님)라 **타당함**. 다만 사용자에게 "느리게"가 기대보다 더 느려질 수 있어 Leader 가 의도된 것인지 한 번 확인하는 것을 권한다(코드 결함 아님, UX 판단 사항).
- `status.ts` 히스테리시스: 연속 2회 실패 또는 Health 실패 → TEXT_ONLY, 복귀는 Health 1회 성공(`FAILURE_THRESHOLD=2`), 조회 주기 미확인 3초·저하 30초·정상 5분(`needsProbe`) — §12.2 그대로. `probe()` 가 `runHealthCheck` 를 통해 **운영이 보는 `EngineConnection.status` 를 갱신**하는 부작용은 Developer 가 명시했고 설계 §12.2 "네트워크가 아니라 Router 의 실제 선택 결과 기준"과 일치하는 의도된 동작(사용자 상태 조회가 관리자 화면에도 정직하게 반영됨) — 결함 아님.

**5. 6층 경계** — grep 으로 위반 0건 확인: `speech/**` 가 `conversation`/`learning` import 0, `app/api/v1/speech`·`voices` 라우트가 `@prisma/client`·`engine/*` 내부 직접 import 0(전부 module index 경유), `components/speech/**` 가 `infra`/`engine`/`prisma` import 0(서버 모듈 없음). 엔진명 노출: `grep -rniE "reazon|whisper|style-bert|claude|sbv2|jvnv" src/app src/components src/modules/{preferences,conversation,learning,speech}` → 매치는 전부 `.claude/agents/tutor.md`·Claude CLI 관련 기존 주석(TTS 무관) 뿐, TTS 경로 0건.
- 담당 밖 3+3건 적합성: `infra/secrets.ts`(`readServiceSecret`, 고정 이름 목록만) · `infra/storage.ts`(신규, DATA_ROOT 안전 경로) · `preferences.getVoiceSettingForTts`(자기 `userId` 행만, `learningSpeed` 추가 select) · `admin/present.ts`+`types/admin.ts`(`DETAIL_NUM` 에 `audioBytes`/`durationMs` 화이트리스트 추가, additive) · `engine/functionalTest/index.ts`(TTS provider.functionalTest 위임, STT 는 동작 불변) · U6 공용 3건(`Toast.show(msg, ms=2600)` 기본값 유지 하위호환, `TeacherAvatar`→`components/common` 이동은 import 경로만 갱신·두 사용처 다 반영 확인, `LearningSettings` 저장 후 `router.refresh()` 는 서버 컴포넌트 재조회 트리거일 뿐 클라 상태 보존) — 전부 범위·필요성 적절, 기존 동작 회귀 없음.

**6. 화면** — 이슈 없음. `ttsStatusStore.ts`: 앱 전체 싱글턴, `transitionSeq`/`consumeAnnouncement` 로 전환당 토스트 정확히 1회, 폴링 5분/30초·가시성/온라인 이벤트 반응. `useVoicePreview.ts`: `toggle()` 이 `unlockTtsAudio()` 를 **첫 `await` 이전에 동기 호출**(탭 핸들러 안, `useVoicePreview.ts:94`), draft 변경 시 `invalidate=stop`(재생·대기·blocked 버퍼 전부 폐기), 429 는 `Retry-After` 기반 카운트다운. `ttsStatusCopy.ts`/`TtsStatusSheet.tsx` 문구에 엔진명·호스트·포트·연결키 0(육안 확인, 전체 문자열 스캔).

**7. TraceKind 판정(요청 항목)**: `TraceKind` enum(`prisma/schema.prisma:414`)에 `TTS` 값을 추가하지 않고 기존 `PREVIEW` + `refType`(`speechTts`/`voicePreview`, `RequestTrace.refType` 은 원래 자유 문자열 필드이고 `@@index([refType, refId])` 도 이미 있음)으로 구분한 설계는 **타당함** — 스키마 변경 없이 기존에 이런 구분을 위해 만들어진 필드를 그대로 쓴 것. 다만 `EngineMetricsDaily`(§7.3, 이 task 범위 아님) 가 나중에 `kind` 단위로만 집계한다면 `speechTts`(사용자 실사용)와 `voicePreview`(설정 미리듣기)가 섞일 수 있으니, task-007/003g 에서 `EngineMetricsDaily` 를 손댈 때 `refType` 도 같이 분리 집계하도록 Leader 가 메모해 두길 권한다(코드 결함 아님, 설계 이월 항목).

**Codex C1 지적 판정 (지적마다 채택/오탐/범위밖)**:
- **[high] S1 시크릿 재사용** → **채택·해소 확인**. `TTS_SERVICE_SECRET` 신설(`.env.example:42`), `infra/secrets.ts` 의 `SERVICE_SECRET_NAMES` 가 이 이름만 허용, `styleBertHttp.ts`·`styleBertVits2.provider.ts` 전부 이 함수만 호출, `SPEECH_INTERNAL_SECRET` 참조 0건(grep). M4 쪽도 `KAIWA_TTS_INTERNAL_SECRET` 을 같은 값으로 교체(README·SETUP-M4 확인, 실제 M4 `.env` 값은 미접속 확인 불가하나 절차·문서는 일치).
- **[medium] S2 `/admin/*` 노출** → **채택·코드 레벨 해소 확인**. `security.py` 가 loopback 아니면 404(원격 우회 불가, `--no-proxy-headers` 로 헤더 위장도 불가), pf 방화벽은 "8200 상시 기동 전 필수 조건"으로 SETUP-M4.md·README 에 명시되고 **사용자 승인 후 실행 대상**(T4)으로 아직 미실행 — 현재 M4 서비스 자체가 기동 전이므로 노출 위험이 실제로 발생하지 않은 상태. 코드 방어(loopback+시크릿)는 방화벽과 무관하게 이미 유효.
- **[medium] S3 캐시 조회 권한** → **채택·이월 확인**. `GET /api/v1/speech/tts/:cacheKey` 라우트가 이번 diff 에 없음(디렉터리 확인), 서명 URL 필요성이 task-007 로 명시 이월됨. 이번 `POST /speech/tts`·`/voices/preview` 는 응답 본문으로만 오디오를 주므로 오라클 문제 자체가 발생하지 않음.

**high_risk_areas (QA 인계)**:
1. M4 tts-service 가 아직 기동 전(사용자 승인 대기)이라 **완료 기준 2·3·4·6·7·9 는 라이브 미검증**(developer 기록과 동일) — M4 기동 후 `TTS_SMOKE_EXPECT_M4=1 bash tests/live/task003d-smoke.sh 3011`(9·9b·9c) 재실행 필요.
2. M4 venv 에서 `pytest`(78개) 1회 재실행 권고 — 이 세션은 의존성 미설치로 재현 못함(코드 리뷰로 정합성만 확인).
3. `npm run db:seed` 미실행 상태(코드만 존재) — 실행 후 GLOBAL 6항목 적용·`dictionaryVersion` 변경 시 캐시 미적중을 라이브로 재확인.
4. 레이트리밋(60/10/20 분) 실동작 확인, 429 `Retry-After` 카운트다운 화면 확인.
5. 상태 표시등 5상태·사유 시트·토스트 1회 를 360/390/412 실브라우저로 확인(이번 감사는 코드·문구 스캔만, 렌더 확인은 QA 소관).
6. M4 기동 후 관리자 콘솔 TTS Health/Functional Test 가 실제 HEALTHY·3모델로 전환되는지, `EngineHealth`/`AuditLog` 오염 없이 원복되는지.

**native_change**: false (웹·M4 만, `plugins/**`·`android/**`·Manifest 변경 없음).

## QA 기록

## 최종 요약
- [2026-09-27 21:45] codex_gate/C1 engine=jev → codex_required / adversarial-review / security / CX-limit-ok | overrides=- | fallback=- | tokens=882