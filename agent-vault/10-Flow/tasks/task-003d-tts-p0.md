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

## Reviewer 기록

## QA 기록

## 최종 요약
- [2026-09-27 21:45] codex_gate/C1 engine=jev → codex_required / adversarial-review / security / CX-limit-ok | overrides=- | fallback=- | tokens=882