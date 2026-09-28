---
task_id: task-012b
title: "음성 P2 — 분석 STT 파이프라인(worker·SpeechJob·Whisper·Comparator·requiresReview 판정 서버·발화 조회 API) + 후속 분할(012b-2 화면·012b-3 TTS 관측·012b-4 TTS 타이밍)"
status: doing
base_ref: dd9bd94
risk_level: R2
roles_involved: [leader, judge, developer, reviewer, codex, qa, deployer]
related_tasks: [task-003e-stt-gateway-web, task-003f-android-ondevice-stt, task-007-talk-voice-web, task-003d-tts-p0, task-003c-tts-productization-design, task-011-ai-evaluation, task-018-db-structure-hardening, task-009-release-cutover]
tags:
  - type/task
  - domain/speech
  - domain/engine
  - domain/infra
aliases:
  - 음성 P2
  - 분석 STT
  - task-012b
created: 2026-09-28
updated: 2026-09-28
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
학습자가 말한 발화를 **대화와 분리된 비동기 경로에서 한 번 더 정밀 인식**(분석 STT)하고, 실시간 인식 결과와 비교해 **신뢰도(`transcriptConfidence`)·재확인 필요(`requiresReview`)** 를 판정해 저장한다. 재확인이 필요한 발화는 학습자가 두 안 중 하나를 고를 때만 `finalText` 가 바뀐다(제안→채택). 대화 턴 지연에는 영향이 없어야 한다.

**이 이력서의 구현 범위 = 012b(1단계): 분석 STT 파이프라인 서버·워커 — 화면 0 · 스키마 변경 0 · M4 변경 0.** 재확인 카드·발화 로그 화면, TTS P1(관측·타이밍)은 아래 "범위 분할"대로 후속 task 로 나눈다.

## 사용자 지시
- 2026-09-28: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘". 순서상 010·011·012 서버 반영 뒤 다음 = 012b 음성 P2 → 012c Console P2(design-spec §15 379~380행).

## 관련 과거 이력 요약
- [[task-003e-stt-gateway-web]]: gateway(127.0.0.1:8100)가 TURN 발화의 wav(`DATA_ROOT/users/<id>/utterances/…`, 30일)와 `Utterance` 를 내부 콜백 `POST /api/internal/speech/utterances`(`X-Internal-Secret`·`X-Service`·`X-Service-Env`)로 만든다. MIC_TEST 는 저장 안 함. 후속으로 넘긴 것: `/transcribe`·#141 trace 콜백 = Phase 2, **`purgeExpiredAudio` 가 발화 기록 때만 돌아 트래픽이 끊기면 30일 초과 wav 가 남음(Phase 2 잡 전환)**, 숫자가 한자 숫자로 나옴(七時·二百円 — 비교기 테스트 사례).
- [[task-003f-android-ondevice-stt]]: 온디바이스 경로는 #21 `POST /api/v1/speech/utterances`(wav+실시간 텍스트)로 같은 `Utterance` 를 만든다. 응답 `analysisQueued` 는 Phase 1 내내 `false`. 이벤트·반환에 엔진명을 싣지 않는 원칙.
- [[task-007-talk-voice-web]]: 턴(#32)이 `utteranceId` 로 발화를 메시지에 1회 연결(finalSource=USER 는 "글자로 고치기" 경로). Trace TURN step 은 숫자 meta 만(원문 0). #21b 원음 재생 최소판만 열었고 **#22 GET·#21a PATCH 는 Phase 2**.
- [[task-018-db-structure-hardening]]: `Utterance.chatId`·`chatMessageId @unique` — 발화 1개 = 메시지 1개. 발화 4용도(채팅·레슨·평가·방 없음) 상호 배타(task-010 Codex C2 수정 `usage.ts`).
- [[task-011-ai-evaluation]] Leader L1: 말하기 문항은 지금 **실시간 STT 최종 텍스트**(`REALTIME_STT`)로 채점 — "012b 가 분석 텍스트가 있으면 그것을 쓰도록 바꾼다(계약 유지)". `InputSource.SERVER_STT` 는 이미 enum 에 있다.
- [[task-003d-tts-p0]]·[[task-003c-tts-productization-design]]: TTS Trace 하위 단계(`TTS_NORMALIZE`·`TTS_SYNTH[i]` 등)는 **이미 구현**(`speech/tts/metrics.ts`). TraceKind `TTS` 추가는 Phase 2 후보(enum = 스키마). `TtsCache.timing`·`timingVersion` 컬럼은 **이미 있음**. 003c 사용자 결정 필요 ③ "TTS P1 을 Phase 2 에 넣을지 Phase 4 로 미룰지" — design-spec §15 표는 012b/012c 편입으로 적었지만 §16 미결 목록에도 남아 있다(확인 필요, U6).
- [[task-009-release-cutover]]: 운영 blue/green 대상 pm2 = `thekaiwa`·`thekaiwa-speech-gateway` 둘뿐. reviewer REV-025 Low 4 — deployer.md 에 `thekaiwa-speech-worker`(Phase 2) 가 미리 적혀 있음.

## Leader's Plan (2026-09-28)

### 요구사항 해석 (정본 인용)
- design-spec §15 012b: "worker+`SpeechJob`·WhisperEngine·Comparator·requiresReview 카드·발화 로그 · TTS P1: Observability(Trace 하위 단계·`EngineMetricsDaily` TTS 컬럼)·Timing Metadata(narabas 정렬, 자막 하이라이트·섀도잉)". design-spec §9: "비동기: worker → whisper → TranscriptComparator(NFKC·구두점 제거·かな 변환·편집거리 → `transcriptConfidence`, `<0.85` → `requiresReview` → 교정 카드에 2안 표시·사용자가 `finalText` 확정)". §9 음성 Phase: "P2(whisper 재분석·Ensemble·confidence·발화 로그) = 앱 2".
- api-contract: #21(업로드 시 `SpeechJob(ANALYSIS_STT, QUEUED)` 같은 트랜잭션, `status=QUEUED`, `analysisQueued`) · #22 GET 발화+분석 · #21a PATCH finalText(requiresReview 만, `finalSource=USER`, 확정 후 409) · #138 분석 결과 콜백(트랜잭션: Utterance + `SpeechAnalysis` upsert + `SpeechJob DONE`, 재보고 `ALREADY_ANALYZED`) · #139/#140 잡 클레임·결과(선택 경로) · §2-30 worker 잡 루프(#153) · #154 worker health.
- `speech/worker/README.md` §1~§7: 잡 루프·WhisperEngine(HTTP → VoiceVault whisper-service `/transcribe-chunk`, 60s)·TranscriptComparator 규칙·엣지 4규칙·콜백·실측 항목.
- speech-platform/11 §3.3: 모드별 — AUTO 큐잉(NORMAL, 0.85) · FAST 큐잉(LOW, 0.85) · ACCURATE 큐잉(HIGH, **0.90**) · OFFLINE **큐잉 안 함**.
- module-dependency: speech 소유 테이블 = `Utterance·SpeechAnalysis·SpeechJob…` · `speech/worker` → `src/**` 는 `/api/internal/*` HTTP 만 · §5 427행 "Python 이 직접 쓰는 유일한 앱 테이블 = `SpeechJob`".
- 스키마: `Utterance`(1162행)·`SpeechAnalysis`(1210)·`SpeechJob`(1230 — `lockedBy/lockedAt/runAfter/attempts/maxAttempts`, `@@unique([utteranceId, kind])`)·`EngineMetricsDaily`(1614 — TTS 컬럼 없음)·`TtsCache.timing` 전부 **이미 있음**. 012b 1단계는 스키마를 바꾸지 않는다.

### 범위 분할 (Leader 결정)

| 단위 | 내용 | 승인 필요 | 데모 |
|---|---|---|---|
| **012b (이 이력서)** | 분석 STT 파이프라인: 적재(#21·gateway 콜백) · 내부 API(#139 claim·#140 result·#138 analysis) · `speech/worker`(루프·WhisperEngine HTTP 어댑터·Comparator) · requiresReview **판정·저장**(서버) · 사용자 API #22 GET·#21a PATCH(화면 없음) · 011 말하기 문항 텍스트 선택(D-B7) · 워커 생존 health(additive) | **구현·테스트: 불필요.** 운영 반영(배포) 때만 U1·U2 | 없음(화면 0) |
| 012b-2 | 분석 결과 **화면**: 회화방·채팅방 사용자 말풍선의 requiresReview 2안 카드("이렇게 들렸어요 / 이렇게도 들렸어요 / 직접 고치기") · **발화 로그**(위치·목록 API 미정) · 평가 결과의 인식 텍스트 표기 | 데모 승인(U3) | delta~full |
| 012b-3 | **TTS Observability**: `EngineMetricsDaily` 03:00 KST 물화 잡(기존 컬럼) + TTS 컬럼(`p99Ms·ttfaP50Ms·ttfaP95Ms·rtfAvg·cacheHitRate·byVoice`) + `GET /api/admin/v1/tts/metrics` · 캐시 예열·정리 잡(speech-platform/16 §15 P1 행) (대시보드 화면은 012c) | 스키마 push(U4, §16 #3) | 없음 |
| 012b-4 | **TTS Timing Metadata**: narabas 스파이크(A 강제정렬 vs B VITS duration, §8.2) · M4 tts-service `timing=true` 후처리 · `TtsCache.timing` 부착(컬럼 있음) · #24 JSON `timing` · Karaoke 자막·섀도잉 강조 화면 | M4 설치·배포(U5) + 데모 | delta |
| 012c 로 이관 확인 | Golden Dataset·Regression Run·A/B Blind·Model Versioning·Canary·Voice Versions 페이지·TTS 대시보드 | U6(Canary 실효성·합격 수치) | 012c 에서 |

**분할 근거**
1. **승인 경계가 다르다.** 012b 1단계는 스키마·M4·화면 없이 구현·단위·로컬 E2E 까지 끝낼 수 있다(사용자 지시 "승인이 필요하기 전까지 진행"에 맞는 최대 범위). 012b-3 은 스키마 push, 012b-4 는 M4 설치(맥)·배포와 화면, 012b-2 는 데모 게이트가 막는다 — 한 task 로 묶으면 가장 늦은 승인에 전체가 묶인다.
2. **의존 순서.** 카드(012b-2)는 012b 의 API·실데이터(confidence 분포)를 보고 문구·임계 표시를 정해야 한다. 015b 발음 분석도 "transcriptConfidence 분포 안정 뒤"(worker README §5 게이트).
3. **위험 집중.** 012b 는 새 pm2 프로세스·내부 인증 신규 라우트 3개·큐 동시성(R2) — reviewer·Codex 초점을 한 곳에 둔다. TTS P1 은 코드 경로(`speech/tts`·M4)가 분석 STT(`speech/analysis`·worker)와 겹치지 않아 묶으면 리뷰 범위만 커진다.
4. **정본 정합.** design-spec §15 012c 행이 이미 Golden·Versions·Canary·대시보드를 012c 로 배정(사용자 결정 ③) — speech-platform/16 §15 표의 "012b" 표기(428~431행)와 불일치 → 정본 정리 대상(D-B12).

### 012b 설계 결정 후보 (C1 에서 확정 → 정본 갱신 후 developer 착수)

| # | 쟁점 | 정본 현황 | Leader 권고 |
|---|---|---|---|
| D-B1 | 잡 클레임 경로 | 기본 = Python 이 MariaDB `SpeechJob` 직접(module-dependency §5 427행, api-contract §2-30) · #139/#140 = "선택" | **#139/#140 내부 HTTP 를 기본으로.** ① 운영 venv 에 DB 드라이버(pymysql·sqlalchemy) 추가 불필요(venv 변경 = 별도 승인) ② Python env 에 `DATABASE_URL` 을 싣지 않음(비밀 노출면 축소) ③ `SpeechJob`·`Utterance.status` 갱신·백오프를 앱 speech 한 곳에서 한 트랜잭션 ④ README §2 "워커는 Utterance 를 읽지 않는다" ↔ #138 "audioPath 를 DB 에서 직접" 모순 해소(claim 응답이 `audioPath·realtimeText·recognitionMode` 를 준다). 앱 잠금 = `FOR UPDATE SKIP LOCKED`(MariaDB 10.6+ — 버전 확인, 미지원이면 조건부 `updateMany` 낙관 클레임). 컬럼 매핑: 정본 `workerId/leaseUntil` → 스키마 `lockedBy/lockedAt(+stale 기준)/runAfter` |
| D-B2 | 한자→읽기 가나 접기 | README §4 = `pyopenjtalk.g2p(kana=True)`(미결: pykakasi) | 운영 venv 에 pyopenjtalk **없음**(22:57 확인). **A 권고**: worker 전용 `speech/worker/requirements.txt` 에 pyopenjtalk(015b 발음 분석에도 필요 — 선투자). 개발·테스트는 운영 공유 venv 가 아닌 **별도 dev venv**(`~/.node-local/thekaiwa-speech-dev`)에서. 운영 venv 설치는 U2. 대안 B(앱이 M4 `/g2p` 로 비교 — 분석 경로가 TTS 서비스에 의존) · C(읽기 접기 없이 v1 — 표기 차이로 requiresReview 오탐, 비권장). 읽기 제공자 부재 시 워커는 claim 하지 않고 degraded 보고 |
| D-B3 | 적재 게이트 | #21 "connection 있고 모드가 분석을 요구하면" | **워커 생존 게이트**: 앱이 최근 120초 안에 #139 claim 을 받았을 때만 enqueue(프로세스 메모리). 워커 미배포 상태로 앱을 먼저 배포해도 `QUEUED` 가 쌓이지 않고 `analysisQueued:false` 유지 → 환경변수·AppSetting 추가 0. + 모드≠OFFLINE · ANALYSIS_STT connection enabled · 오디오 있음(TURN 만) |
| D-B4 | worker health | README "바인드 없음" ↔ api-contract #154 `GET /health` | **바인드 없음 유지.** 생존은 앱이 마지막 claim 시각으로 판단해 `/api/health` checks 에 `stt_analysis_worker`(degraded, 배포 비차단) additive. #154 는 정본에서 "claim 하트비트로 대체"로 갱신 |
| D-B5 | `finalSource` 규칙 충돌 | README §4·#138 예시 = requiresReview=false 면 REALTIME 유지 · domain-model §5-9 = 임계 이상이면 ANALYSIS · README "고르면 REALTIME\|ANALYSIS\|USER" ↔ #21a "PATCH {finalText} → USER" | **분석 결과만으로는 `finalText`·`finalSource` 를 바꾸지 않는다**(이미 보낸 턴·교정의 근거 텍스트와 같아야 함). #21a 본문을 `{choice:'REALTIME'\|'ANALYSIS'\|'USER', finalText?}` 로 — 고른 안의 출처를 그대로 기록(분석 안 채택률 = 분석 품질 지표). domain-model §5-9 갱신 |
| D-B6 | 확정과 기존 기록의 관계 | 미정 | #21a 는 `Utterance.finalText/finalSource` 만 바꾼다. `ChatMessage.content`·`Correction.original`·평가 답은 **건드리지 않는다**(원문 무수정). 확정 후 재점검(A2) 같은 후속 흐름은 012b-2 에서 사용자 흐름으로 결정 |
| D-B7 | 평가 말하기 문항 텍스트(011 L1 후속) | README "AI평가 말하기 문항은 분석 텍스트 우선" | 채점 잡 시작 시점 기준: `finalSource=USER` → finalText · `ANALYZED && !requiresReview` → analysisText(`inputSource=SERVER_STT`) · 그 외 실시간(`REALTIME_STT`). **채점이 분석을 기다리지 않는다**(기록률 100%·A7 120s 예산 보호) |
| D-B8 | 모드별 우선순위(HIGH/NORMAL/LOW) | 11 §3.3 | `SpeechJob` 에 priority 컬럼 없음 → `runAfter` 오프셋(FAST +30s)으로 근사, 스키마 0 |
| D-B9 | 오디오 30일 정리(003e 후속 ①) | 발화 기록 때만 | (선택) claim 경로에서 하루 1회 `purgeExpiredAudio` 편승 |
| D-B10 | VoiceVault whisper-service 공유 | 재사용 전제 | 서비스가 전역 lock 으로 직렬(VoiceVault `main.py` `transcribe_chunk`) — VoiceVault 긴 전사 중 대기 가능. 연결 실패·503·timeout 은 백오프(30s·2m·10m) 재시도, 3회 후 `FAILED`(+Utterance FAILED — 카드 대상 아님). **VoiceVault 코드는 건드리지 않는다**(타 프로젝트). 세그먼트 confidence 는 서비스가 주지 않음 → #138 `segments[].confidence` 생략 |
| D-B11 | **개발·운영 공유 DB 에서 잡 교차 처리**(Leader 발견) | `SpeechJob`·`Utterance` 에 environment 컬럼 없음, 개발·운영 `DATA_ROOT` 동일 | 개발 앱(APP_ENV≠PRODUCTION)의 claim 이 운영 사용자 발화 잡을 가져가면 **개발 코드가 실사용자 `Utterance` 를 갱신**(데이터 안전 1순위 위반). **권고(스키마 0)**: APP_ENV≠PRODUCTION 앱의 claim 은 QA 계정(provider `test`, `@thekaiwa.test`) 발화 잡만 반환. 운영 워커가 개발 QA 잡을 처리하는 반대 방향은 QA 데이터라 허용. 대안: `SpeechJob.environment` additive 컬럼(스키마 승인 — 010b~011 DB 일괄 승인 묶음에 끼울 수 있음) |
| D-B12 | 정본 불일치 정리 | speech-platform/16 §15 표 "012b"(Golden·Versioning·Canary) vs design-spec §15 012c 행 | design-spec §15 기준으로 16 §15 표를 012c 로 정리 |

> 정본 갱신(D-B1·B4·B5·B11·B12)은 C1 확정 뒤 Leader 가 한다 — 지금 `docs/design/domain-model.md`·`module-dependency.md` 에 다른 작업의 미커밋 변경이 있어(22:57 `git status`) 이 턴에서는 손대지 않았다.

### 역할 분담·파일 경계 (012b 1단계)
| 역할 | 담당 파일/기능 | 순서 |
|---|---|---|
| leader | C1 확정·정본 갱신(`docs/design/{api-contract,module-dependency,domain-model}.md`·`speech/worker/README.md`·`speech-platform/16` §15) · `ecosystem.config.js`(worker 앱 항목)·`deploy.yml runtime.apps`·`.env.example` 주석 | 1 → (배포 전) 6 |
| developer | `src/modules/speech/{analysis/**(신규: enqueue·claim·applyAnalysisResult·gate),utterances/**(#21 적재·#21a·#22)}` · `src/app/api/internal/speech/{jobs/claim,jobs/[id]/result,utterances/[id]/analysis}/route.ts`(신규) · `src/app/api/internal/speech/utterances/route.ts`(gateway 콜백 적재) · `src/app/api/v1/speech/utterances/[id]/route.ts`(신규 #22·#21a) · `src/modules/admin/health.ts`(additive) · `src/modules/learning/evaluation/grade.ts`(**텍스트 선택부만**, D-B7) · `speech/worker/**`(신규: main·handlers/analysis_stt·comparator·requirements·tests) · `speech/common/kaiwa_speech_common/{internal_client.py(X-Service 파라미터화·claim/result/analysis),engine/adapters/stt/whisper_http.py(신규)}` · 단위 테스트(`src/modules/speech/__tests__/**`·`speech/worker/tests/**`·`speech/common/tests/**`) | 2 |
| reviewer | 6층(worker→`/api/internal` HTTP 만, learning↔speech index 경유)·내부 인증(헤더 없음 404·틀림 401·ENV_MISMATCH 409·본문 상한·600/분)·claim 동시성·D-B11 필터·원문 로그 0·엔진명 누출 0·`original` 무수정 | 3 |
| judge·codex | C1(설계 확정 직후)·C2(reviewer PASS 직후) — 초점 concurrency·security | 1.5·3.5 |
| qa | `tests/live/task012b-smoke.sh`·워커 2개 동시 기동 스크립트·완료 기준 전부 | 4 |
| deployer | U1·U2 승인 뒤 운영 반영(worker pm2 등록·webhook `--apps`) | 5 |
| designer·prompt-engineer | 012b 1단계 없음(LLM 미사용 — 비교기는 코드). designer 는 012b-2 에서 | — |

- **다른 task 와의 경계**: `components/talk/**`·`components/chat/**`·`components/eval/**` 는 012b 에서 건드리지 않는다(012b-2·011 화면). `learning/evaluation/grade.ts` 는 텍스트 선택 한 곳만(011 서버는 운영 반영 끝, 011 화면 작업은 `components/eval/**` 라 겹치지 않음).
- **push 금지**(push = 운영 배포 webhook). 커밋은 QA PASS 뒤, 워커 운영 등록은 U1 승인 뒤.

### 완료 기준 (qa 가 실행으로 확인)
1. #21 업로드(AUTO·ACCURATE·FAST, 워커 생존) → `SpeechJob` 1행·`Utterance.status=QUEUED`·`analysisQueued:true`. OFFLINE·MIC_TEST·워커 부재(게이트 off) → 0행·`false`. gateway TURN 콜백 경로도 동일.
2. 워커 2개 동시 기동 → 같은 잡 중복 처리 0(attempts 대조), 20건 전부 `DONE`.
3. #138: Utterance `ANALYZED`(analysisEngine·analysisText·transcriptConfidence·requiresReview) + `SpeechAnalysis` 1행 + `SpeechJob DONE` 한 트랜잭션, 재보고 `200 {stored:false, reason:"ALREADY_ANALYZED"}`, requiresReview 여도 `finalText`·`finalSource` 불변(D-B5).
4. Comparator 단위: 「こんにちは。」vs「コンニチワ」, 「今日」vs「きょう」= 1.0, 七時 vs 7時, 빈 문자열 3규칙, 3배 길이 → requiresReview, ACCURATE 0.90 임계.
5. 실패: whisper 중단 → 백오프 재시도 3회 → `FAILED` + Utterance `FAILED`. 오디오 없음 → 즉시 FAILED(`AUDIO_MISSING`).
6. #22 소유자만(타인 404·무세션 401) · #21a: requiresReview=false 409·이미 확정 409·타인 404·성공 시 `finalSource` = 고른 출처, `ChatMessage.content`·`Correction.original` 바이트 불변.
7. 내부 API 3종: 헤더 없음 404 · 틀림 401 · `X-Service-Env` 불일치 409 · 본문 상한 · APP_ENV≠PRODUCTION claim 은 QA 계정 잡만(D-B11).
8. 대화 턴 p50 이 워커 유무와 무관(30턴 비교, 차이 ≤10%) · 30초 발화 분석 왕복(claim→콜백 200) p50/p95 기록.
9. 로그·Trace 에 전사 원문 0(길이·sha1[:8] 만), 사용자 응답·health 에 엔진명 0.
10. 011 말하기 문항: `ANALYZED && !requiresReview` 발화는 `SERVER_STT` 로 채점 기록(D-B7), 분석 전이면 `REALTIME_STT`.
11. `git diff prisma/schema.prisma` 빈 diff. 회귀: 단위 전부 + 스모크 007·010·011.

### 네이티브 변경 / APK
없음. 플러그인·android·Manifest 무변경, #21 요청 계약 동일(응답 `analysisQueued` 값만 바뀜). APK 재설치 불필요.

### 위험·주의
- **R2**: 새 pm2 프로세스·내부 인증 신규 라우트·큐 동시성·개발/운영 공유 DB(D-B11).
- whisper 가 짧은 무음·잡음에 환각 문장을 내는 경우 → 길이 3배 규칙·requiresReview 로 흡수되지만 카드 노이즈 → confidence 분포를 012b-2 전에 보고.
- 공유 NAS MariaDB — 개발 스모크가 만든 `SpeechJob`·`Utterance` 는 QA 계정 한정·정리.
- VoiceVault whisper-service 는 타 프로젝트 공용 자원(전역 lock) — 부하 실측 시 VoiceVault 사용과 겹치지 않게.
- 운영 venv 는 릴리스 밖 공유 자원(롤백으로 안 되돌아감) — pyopenjtalk 설치는 U2 승인 뒤 deployer.

## 사용자 결정·승인 필요 목록
| # | 항목 | 필요 시점 | 막는 범위 | 기본안 |
|---|---|---|---|---|
| U1 | 우분투 pm2 **`thekaiwa-speech-worker` 신규 기동** — `ecosystem.config.js`·`deploy.yml runtime.apps`(저장소, Leader) + **webhook 배포 스크립트 `~/.local/webhook-deploy/deploy-thekaiwa.sh` 의 `--apps "thekaiwa,thekaiwa-speech-gateway"` 에 worker 추가(저장소 밖)** | 012b 운영 반영 직전 | 운영 반영만(구현·QA 는 진행) | 추가 |
| U2 | 운영 venv(`~/.node-local/thekaiwa-speech/venv`)에 **pyopenjtalk 설치**(D-B2 A) | 012b 운영 반영 직전 | 운영 반영만 | A(설치). 거부 시 D-B2 B/C 중 선택 |
| U3 | requiresReview 2안 카드·**발화 로그** 데모 승인 + 발화 로그 위치(서랍장 "내 발화" / 설정 / 관리자 진단) | 012b-2 착수 | 012b-2 전체 | 데모 후 결정 |
| U4 | `EngineMetricsDaily` **확장 vs `TtsMetricsDaily` 신설**(speech-platform/16 §16 #3) + 백업 후 db push | 012b-3 착수 | 012b-3 | 확장 |
| U5 | narabas **M4 설치·tts-service 배포**(git push 웹훅 승인) + Timing A/B(§16 #6) + 스파이크용 torch 설치 | 012b-4 착수 | 012b-4 | A(M4 비동기 후처리, 불가 시 우분투 worker) |
| U6 | TTS P1 Phase 2 편입 확인(design-spec §16 미결 표기 잔존) · **Canary 실효성**(§16 #5) · 합격 기준 수치(§16 #4·§9.4) | 012c 착수 | 012c TTS Quality·Versions | 편입 · chat 단위 유지 · 초안 값 |
| U7 | (정보성) requiresReview 임계 0.85/ACCURATE 0.90 | 012b-2 전 | 없음 | 기본값으로 진행, 분포 보고 후 조정 |
| (참고) | D-B11 대안으로 `SpeechJob.environment` 컬럼을 원하면 010b~011 DB 일괄 승인 묶음에 추가 | 선택 | 없음(권고안은 스키마 0) | 스키마 0 권고안 |

## 데모 검토 (demo gate)
| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 09-28 23:00 |

## 판단 기록 (judge)
- [2026-09-28 23:00] intake engine=jev → task_type=feature · complexity=2.45 · risk=R2 · developer_model=opus · roles=designer?,prompt-engineer?,developer,reviewer,qa · next=assign · actions=assign_developer | overrides=- | fallback=- | tokens=1663 | demo=none/- (ui_change none 0.97)
- [2026-09-28 23:03] codex_gate/C1 engine=jev → codex_required=false / wanted_before_budget=false / mode=- / focus=- (signal concurrency 0.79) / budget_rule=CX-limit-unknown-r2 / codex_switch=on / calls_used=0 | overrides=- | fallback=- | tokens=1010

## 작업 기록

### 2026-09-28 22:57 Leader — 접수·범위 분할
- 과거 이력(003e·003f·007·018·011·003d·003c·009)에서 012b 로 넘긴 항목 수집(위 요약). 코드 현황: `speech/worker/` 는 README 뿐, `src/modules/speech` 에 analysis 없음, `analysisQueued:false` 고정, `EngineMetricsDaily` 물화 코드 없음, TTS Trace 하위 단계는 구현됨, whisper-service(127.0.0.1:8090) health ok, 운영 venv 에 pyopenjtalk 없음, webhook 배포 `--apps` 에 worker 없음.
- 범위 = 012b 1단계(분석 STT 서버·워커, 화면·스키마·M4 0). 설계 결정 후보 D-B1~B12 → C1 에서 확정.

### 2026-09-28 23:00 Leader — judge intake·demo gate
- `judge-result@2`(engine jev, needs_info=false): feature · R2 · developer **opus** · demo **none**(화면 0 — 요약에 분할안 반영: 카드·발화 로그 화면은 012b-2) · `next=assign`.
- `check.mjs init` → demo_gate `not_required`. 012b-2(화면)는 착수 시 별도 intake·데모 게이트.
- Codex 연계 스위치 on, 한도 값 `null`(stale 2026-09-27) → C1·C2 는 R2 라 `CX-limit-unknown-r2` 규칙 적용 예상(판정은 judge 가 체크포인트에서).
- 다음: C1 설계 확정(D-B1~B12, 특히 D-B1 claim 경로·D-B2 읽기 접기·D-B11 교차 처리) → judge `codex_gate` C1 → 정본 갱신 → developer(opus) 착수. 운영 반영은 U1·U2 승인 뒤.

### 2026-09-28 23:15 Leader(메인) — 설계 결정 D-B1~B12 확정
- **채택(권고대로)**: D-B1 #139/#140 내부 HTTP 기본 · D-B2 A(worker 전용 requirements 에 pyopenjtalk, 개발은 별도 dev venv `~/.node-local/thekaiwa-speech-dev`, 운영 venv 설치는 U2) · D-B3 워커 생존 게이트(최근 120s claim) · D-B4 바인드 없음·`/api/health` 에 `stt_analysis_worker`(degraded, 비차단) additive · D-B5 분석 결과만으로 finalText/finalSource 불변, #21a `{choice}` · D-B6 #21a 는 Utterance 만 · D-B7 채점 시점 텍스트 선택(분석 대기 없음) · D-B8 runAfter 오프셋 · D-B10 백오프 3회 후 FAILED, VoiceVault 코드 불변 · D-B12 design-spec §15 기준으로 16 §15 표 정리.
- **D-B11**: 권고 채택 — APP_ENV≠PRODUCTION 앱의 claim 은 QA 계정(provider `test`) 발화 잡만. 운영 워커가 QA 잡을 처리하는 방향은 허용(QA 데이터). 한계: 운영 워커가 떠 있는 동안 개발 QA 잡을 운영 코드가 먼저 가져갈 수 있다 → 개발 스모크는 "누가 처리했든 결과 계약"만 검사하고, 개발 코드 경로 검증은 단위 테스트·U1 전(운영 워커 없음) 라이브로. `SpeechJob.environment` 컬럼은 도입하지 않는다(필요해지면 별도 승인).
- **D-B9 보류**: 오디오 30일 정리는 데이터 삭제라 012b 1단계에서 빼고 별도 소작업으로(운영 삭제 대상·건수 미리보기 후).
- 다음: judge C1 codex_gate → 정본 갱신(api-contract #139/#140 기본·#154 대체·#21a choice, module-dependency §5, domain-model §5-9, speech/worker/README §2, speech-platform/16 §15 표) → developer(opus).

### 2026-09-28 23:03 Leader — judge C1
- `codex_gate` C1(engine jev): **`codex_required=false`**(wanted_before_budget=false · budget_rule `CX-limit-unknown-r2` · 호출 0/4 · 스위치 on). focus 신호는 concurrency(0.79)였으나 개입 불필요 판정 → Codex 없이 developer 진행. 한도 값은 `null`(마지막 기록 2026-09-27, stale) — C2 도 같은 규칙이 적용될 수 있어 사용자에게 Codex `/status` 값을 `set-limit` 으로 기록해 달라고 요청할 수 있음.

### 2026-09-28 23:10 Leader — 정본 갱신(C1 확정 반영)
- `docs/design/api-contract.md`: 총람 #21(`analysisQueued`)·#21a(`{choice, text?}`, `Utterance` 만)·#138(앱이 판정)·#139/#140(**기본 경로**, 층 speech/analysis)·#153(HTTP 만)·#154(**claim 하트비트로 대체**) / #1 health `checks.stt_analysis_worker`(additive, 비차단) / #21 적재 조건 4개(D-B3·D-B8, gateway 콜백 동일) / #22·#21a 확정 계약(엔진 정보 비노출·`requiresReview`=확정 대기·조건부 갱신 1회·`409 NOT_REVIEWABLE`·`reviewThreshold` 스냅샷) / #67 옆 말하기 문항 채점 텍스트(D-B7) / §2-28 #138(`comparator{similarity,flags}`·정규화 문자열 미전송·판정은 앱·`finalText` 불변)·#139(고아 회수 15분·SKIP LOCKED·**D-B11 환경 필터+한계**·하트비트)·#140(펜싱 `STALE_CLAIM`·백오프 30s/2m/10m·재시도 대상 구분) / §2-30 worker 루프(HTTP 루프로 교체, SIGTERM, 의존성 승인) / 시퀀스 3-1 claim 단계.
- `docs/design/module-dependency.md`: Python 행렬(`speech/common` DB 접속 없음, worker = #138~#140 HTTP) · speech 모듈 서브디렉토리·공개 API(`claimAnalysisJobs`·`reportJobFailure`·`isAnalysisWorkerAlive`·`pickGradingTexts`·`resolveFinalText(…, choice, text?)`) · §4-1 흐름(적재 게이트·claim·#138 200·#21a·**평가 채점 텍스트는 submit 라우트가 grading 콜백에 주입 — learning→speech import ✗ 규칙 유지**) · §5-1(`db.py` 폐기, 비교기 행) · §5-2(worker 바인드 없음·`DATABASE_URL` 제거·PYTHONPATH·kill_timeout·U1·U2) · §5-3(worker 제외).
- `docs/design/domain-model.md`: 모델 표 `SpeechJob` 행 · §5-8 JobStatus(claim 은 앱·백오프 30s/2m/10m·재시도 불가 코드·고아 회수 15분 행 추가) · §5-9 `Utterance.status`(적재 게이트) + **finalText/finalSource/requiresReview 규칙(D-B5·D-B6)** + **SpeechJob 환경 구분(D-B11, 한계 명시)**. Prisma 블록·주석은 schema.prisma 와 같아야 하므로 손대지 않음.
- `speech/worker/README.md`: 머리말(C1 확정)·흐름도·§2(HTTP 클레임·실패 보고·기동 점검·경로 검증·헤더·로그·requirements = pyopenjtalk 만, dev venv)·§4(워커는 similarity+flags, 판정은 앱, 엣지 규칙 → flags, 앱 쪽 처리 D-B5·D-B7)·§6(콜백 3종 표, internal GET 폐기)·§7.
- `docs/design/speech-platform/16-tts-productization-layer.md`: §8.2 스파이크 = 012b-4 · §15 표(Golden·Regression·A/B·Versioning·Canary → **012c**, 지표·캐시 잡 → 012b-3, Timing → 012b-4 + D-B12 주석) · §16 #3 → 012b-3, #6 → 012b-4.
- `docs/design-spec.md`: §15 012b 행을 012b / 012b-2 / 012b-3 / 012b-4 네 행으로 분할 · §9-D P1 → Phase 매핑 문장.
- **Leader 가 메운 계약 공백 1건(메인 확인 요청)**: #21a `choice=REALTIME` 은 기본값과 같은 `finalSource` 라 "확정됨"을 구분할 칸이 없다 → 스키마 없이 **확정 시 `requiresReview=false`** 로 바꾸고, "원래 재확인 대상이었는가"는 `transcriptConfidence < SpeechAnalysis.engineVersions.reviewThreshold`(#138 때 스냅샷)로 판단하게 적었다. 또 `requiresReview` 판정 주체를 **앱**으로 정리(임계가 사용자 모드·AppSetting 에 달린 앱 정책이라 — 워커는 similarity·flags 만 보냄).

### developer 인계 (2026-09-28 23:11, Leader → developer(opus))
**읽을 것(이 순서)**: 이 이력서의 "범위 분할"·"설계 결정 후보" 표 + "23:15 Leader(메인) 확정" + 위 "정본 갱신" · `docs/design/api-contract.md` #1 health 노트·#21 적재 조건·#22/#21a 확정 계약·#67 옆 D-B7 노트·§2-28 #138~#140·§2-30 worker 루프 · `docs/design/module-dependency.md` §4-1(speech 흐름)·§5-1·§5-2 · `docs/design/domain-model.md` §5-8·§5-9 · `speech/worker/README.md` §2·§3·§4·§6·§7.

**범위 = 012b 1단계. 스키마 0 · 화면 0 · M4 0.**
- A. 앱(TypeScript)
  1. `src/modules/speech/analysis/**`(신규): `enqueueAnalysis`(발화 저장 트랜잭션 안, 게이트 4조건 — D-B3·D-B8) · `claimAnalysisJobs`(고아 회수 15분 → `FOR UPDATE SKIP LOCKED`(MariaDB 버전 먼저 확인, 10.6 미만이면 조건부 `updateMany` 낙관 클레임) → RUNNING·attempts+1·lockedBy/lockedAt/startedAt · **APP_ENV≠PRODUCTION 이면 QA 계정(provider `test`) 발화 잡만**(D-B11) · 하트비트 기록) · `reportJobFailure`(펜싱·백오프·확정 실패+Utterance FAILED 한 트랜잭션) · `applyAnalysisResult`(#138 한 트랜잭션, 판정은 앱, `reviewThreshold` 스냅샷, `finalText/finalSource` 불변, 재보고 `ALREADY_ANALYZED`) · `isAnalysisWorkerAlive()` · `pickGradingTexts()`(D-B7).
  2. `src/modules/speech/utterances/**`: #21 적재 연결(`analysisQueued`) · `resolveFinalText(userId, id, choice, text?)`(#21a 조건부 갱신 1회, `409 NOT_REVIEWABLE`) · #22 조회(엔진 정보 제외). `src/modules/speech/index.ts` export 추가.
  3. 라우트: `src/app/api/internal/speech/jobs/claim/route.ts`·`src/app/api/internal/speech/jobs/[id]/result/route.ts`·`src/app/api/internal/speech/utterances/[id]/analysis/route.ts`(신규 — 기존 `/api/internal/speech/utterances/route.ts` 의 내부 인증·`X-Service-Env` 검사·본문 상한 패턴 재사용, `X-Service: worker`) · `src/app/api/internal/speech/utterances/route.ts`(gateway 콜백에 적재 한 곳) · `src/app/api/v1/speech/utterances/route.ts`(#21 응답) · `src/app/api/v1/speech/utterances/[id]/route.ts`(신규 GET #22·PATCH #21a — `[id]/audio` 와 같은 폴더 규칙).
  4. `src/modules/admin/health.ts`: `checks.stt_analysis_worker` boolean(degraded 에만, 503 게이트 불변).
  5. D-B7: `src/app/api/v1/evaluations/[id]/submit/route.ts` 가 `learning.submitEvaluation` 에 넘기는 grading 콜백에 speech 텍스트 선택을 **주입**(learning → speech import 금지 — module-dependency 행렬 ✗). `src/modules/learning/evaluation/grade.ts` 는 주입받은 텍스트·`inputSource` 를 채점 결과 트랜잭션에 쓰는 **최소 변경만**(011 화면 `components/eval/**` 무관).
- B. Python
  6. `speech/worker/**`(신규): `main.py`(2s 루프·빈 응답 백오프 ≤10s·SIGTERM 마무리·기동 점검) · `handlers/analysis_stt.py` · `comparator.py`(README §4 — NFKC·구두점·가나 접기·`ReadingProvider`(pyopenjtalk)·편집거리·flags) · `requirements.txt`(pyopenjtalk 만) · `tests/**`.
  7. `speech/common/kaiwa_speech_common/internal_client.py`: `X-Service` 파라미터화(gateway 기본값 유지 — gateway 동작 불변) + `claim_jobs`·`report_failure`·`post_analysis`. `speech/common/kaiwa_speech_common/engine/adapters/stt/whisper_http.py`(신규 — 127.0.0.1:8090 `/transcribe-chunk`, 60s, 503·타임아웃 = retryable, 4xx = 즉시 실패). 엔진명 문자열은 이 어댑터에만.
- C. 테스트: 앱 단위 `src/modules/speech/__tests__/**`(적재 게이트 4조건·claim 필터·펜싱·백오프·#138 멱등·#21a 동시 2요청·D-B7 선택 규칙) · `speech/worker/tests/**`(비교기 README §7 사례 + 七時/7時·빈 문자열·3배 길이·ACCURATE 는 앱 쪽 테스트) · `speech/common/tests/**`(클라이언트 헤더).

**하지 말 것**
- `prisma/schema.prisma` 변경·`db push`(`git diff prisma/schema.prisma` 빈 diff 가 완료 조건) · `src/components/**`·`src/app/(app)/**`·`src/app/(admin)/**` 화면 · `speech/tts-service/**`(M4) · VoiceVault 코드 · `ecosystem.config.js`·`deploy.yml`·`.env*`(Leader 파일 — 필요한 항목은 기록에 초안으로 남길 것) · **운영 venv `~/.node-local/thekaiwa-speech/venv` 에 pip 설치 금지**.
- **운영 3010 금지**: 워커·스모크를 `127.0.0.1:3010` 에 붙이지 말 것, `pm2` 로 `thekaiwa*` 를 재기동·중지·등록하지 말 것, 운영 gateway(8100) 재기동 금지.
- 커밋·push 금지(push = 운영 배포 webhook). 완료 후 변경 파일 목록을 기록에 남기면 Leader 가 QA PASS 뒤 커밋한다.

**개발 환경**
- Python: dev venv `~/.node-local/thekaiwa-speech-dev` 를 새로 만든다(`python3.10 -m venv` → `pip install -r speech/gateway/requirements.txt -r speech/worker/requirements.txt`). pyopenjtalk 설치에 sudo(시스템 패키지·cmake 등)가 필요하면 **멈추고 보고**(사용자 승인 사항). 사전 다운로드가 필요하면 dev venv 안에만.
- 라이브 검증: 미러를 하드링크 복제한 격리 dev 서버(`~/.node-local/thekaiwa-012b` 등 — `node_modules` 는 `cp -al`, `.next`·`logs` 제외, ACTIVE "운영과 분리한 빌드 검증" 패턴)를 **포트 3017** 로 띄운다(`APP_ENV=LOCAL` — NFS·미러 `.env` 값). 워커는 `APP_INTERNAL_URL=http://127.0.0.1:3017`·`APP_ENV=LOCAL` 로 dev venv 에서 직접 실행(pm2 아님). 브라우저 확인이 필요하면 `localhost:3017`. 작업 후 `ss -ltn` 으로 3017 정리·복제본 삭제.
- DB 는 운영과 공유 — 라이브 데이터는 QA 계정(`tests/live/qa-session.ts`, qa-bot·qa-bot2)만. D-B11 필터로 dev 앱은 QA 잡만 가져가지만, 지금은 운영 워커가 없으므로(U1 전) dev 워커가 dev 코드 경로를 실제로 탄다 — 이 기간에 라이브 검증을 끝낼 것. 만든 `SpeechJob`·`Utterance` 는 QA 계정 한정, 정리 방법을 기록.
- 분석 서비스(127.0.0.1:8090)는 VoiceVault 공용·직렬 — 부하 측정(워커 2개 동시·30초 발화 왕복)은 짧게.

**완료 보고(이 이력서 "Developer 기록")**: 변경 파일 목록 · `tsc`·`eslint`·단위(앱·worker·common) 결과 · 라이브 완료 기준 1~11 중 확인한 것(특히 워커 2개 동시 중복 0·#138 멱등·#21a 동시 2요청·D-B11 필터·턴 p50 무영향·30초 왕복 p50/p95·로그 원문 0) · MariaDB 버전과 잠금 방식 · Leader 파일 초안(ecosystem worker 항목·deploy.yml·`.env.example` 주석) · 정본과 다르게 한 점. 다음은 reviewer → judge C2.

## Codex 검토

## Designer 기록
- (012b 1단계 없음 — 012b-2 에서)

## Developer 기록
- [00:35] **012b 1단계 구현 완료(스키마 0·화면 0·M4 0)** — reviewer 인계 대기. LLM 이 필요한 라이브 2건(D-B7 채점 E2E·완료 기준 8 턴 p50)은 Claude CLI 구독 세션 한도(01:20 리셋)로 보류 → 리셋 뒤 재실행해 아래에 덧붙인다(메인에 통지함).
  - **변경 파일 — 앱(TS)**: 신규 `src/modules/speech/analysis/{index,policy,heartbeat,validate,db,jobs,apply,enqueue,grading}.ts` · `src/modules/speech/utterances/review.ts`(#22·#21a) · `src/app/api/internal/speech/_lib/worker.ts`(worker 인증 공통) · `src/app/api/internal/speech/jobs/claim/route.ts`(#139) · `src/app/api/internal/speech/jobs/[id]/result/route.ts`(#140) · `src/app/api/internal/speech/utterances/[id]/analysis/route.ts`(#138) · `src/app/api/v1/speech/utterances/[id]/route.ts`(GET #22·PATCH #21a) · `src/modules/speech/__tests__/task012b.test.ts`(23건). 수정 `src/modules/speech/{index.ts,utterances/index.ts}`(#21·gateway 콜백 적재 — 같은 쓰기 중첩 create) · `src/app/api/v1/speech/utterances/route.ts`·`src/app/api/internal/speech/utterances/route.ts`(주석만) · `src/modules/admin/health.ts`(`checks.stt_analysis_worker`) · `src/modules/engine/stt/index.ts`(`analysisTarget`·`findAnalysisConnectionKey`) · `src/modules/preferences/index.ts`(`getRecognitionMode(s)` 읽기 전용) · `src/modules/infra/{internalAuth.ts(checkInternalCaller),users.ts(listQaUserIds),index.ts}` · `src/modules/learning/evaluation/grade.ts`(D-B7 최소 변경: `speechAnswers` 주입 칸·`speechAnswerOverrides`·저장 트랜잭션에 답·inputSource) · `src/app/api/v1/evaluations/[id]/submit/route.ts`(`speechAnswers: pickGradingTexts` 주입).
  - **변경 파일 — Python**: 신규 `speech/worker/{main.py, kaiwa_worker/{__init__,config,comparator,jobs,paths,loop}.py, kaiwa_worker/handlers/{__init__,analysis_stt}.py, requirements.txt(pyopenjtalk==0.4.1·tqdm), pyproject.toml, tests/{conftest,test_comparator,test_handler,test_loop_config}.py}` · `speech/common/kaiwa_speech_common/engine/adapters/stt/whisper_http.py` · `speech/common/tests/test_worker_calls.py`. 수정 `speech/common/kaiwa_speech_common/{internal_client.py(service 파라미터 — gateway 기본값 그대로·claim_jobs·report_failure·post_analysis), engine/adapters/__init__.py(ANALYSIS_STT_FACTORIES·ANALYSIS_STT_ENDPOINT_ENV), engine/errors.py(SttRequestError), config.py(AnalysisSttRuntime dataclass)}`.
  - **라이브 스크립트**: `tests/live/task012b-smoke.{sh,ts}`(단계 A 가짜 워커 48건 · B 실제 워커 2개 · C 분석 서비스 죽은 워커 · 로그 원문 검사) · `tests/live/task012b-latency.{sh,ts}`(기준 8 — stt·turn 모드).
  - **정적·단위**: 미러 `tsc --noEmit` 0 · `eslint .` 오류 0(경고 6 중 내 것 0 — 5건은 기존 components) · 앱 단위 **736건 중 735 PASS·1 skip(기존)** · worker pytest **40**(pyopenjtalk 실제 읽기 포함) · common pytest **20** · gateway 회귀 pytest **55** · ruff·ruff format·mypy strict(worker·common·gateway) 통과.
  - **MariaDB 10.11.11**(서버 기본 REPEATABLE-READ, 앱 트랜잭션은 READ COMMITTED) → claim 은 `SELECT … FOR UPDATE SKIP LOCKED` 로 확정(낙관 claim 폴백 불필요). `runAfter` 비교는 서버 `NOW()` 가 아니라 앱 시각 파라미터(시간대 차이 회피).
  - **완료 기준 실측**(dev 서버 = 미러 하드링크 복제본 `~/.node-local/thekaiwa-012b-20260928233911`, `APP_ENV=LOCAL`·127.0.0.1:3017, 워커 = dev venv `~/.node-local/thekaiwa-speech-dev` 직접 실행, QA 계정만):
    1. ✅ #21: 워커 하트비트 없음 → `RECORDED·false·잡 0` / claim 뒤 AUTO·ACCURATE → `QUEUED·true`·잡 1행(runAfter≈now), FAST → +30.0초, OFFLINE → `RECORDED·false`. gateway TURN 콜백(내부 경로 흉내)도 `QUEUED·true`, runAfter +10초(파일 이동 여유).
    2. ✅ 가짜 워커 2개 동시 claim(max 2) 20건 → 받은 잡 20·중복 0·전부 attempts 1 / **실제 워커 2개** stt20 20건 → 전부 DONE·attempts 1·ANALYZED, 두 워커가 11·9건 나눔.
    3. ✅ #138: ANALYZED·analysisText·confidence 0.7·requiresReview(AUTO 0.85)·SpeechAnalysis(engineVersions.reviewThreshold 0.85·flags·recognitionMode)·잡 DONE 한 트랜잭션, finalText·finalSource 불변(REALTIME), 재보고 `200 {stored:false, reason:"ALREADY_ANALYZED"}`·값 불변, 다른 발화 jobId 404, 모르는 analysisEngine 400, DONE·FAILED 잡 409.
    4. ✅ 비교기(pytest, 실제 pyopenjtalk): 「こんにちは。」vs「コンニチワ」=1.0 · 「今日」vs「きょう」=1.0 · 七時 vs 7時=1.0 · 二百円 vs 200円=1.0 · 7% vs 七パーセント=1.0 · 빈 문자열 3규칙(ANALYSIS_EMPTY·REALTIME_EMPTY·둘 다 → EMPTY_TRANSCRIPTS) · 3배 길이 LENGTH_RATIO / 앱: ACCURATE 0.88 → 재확인, AUTO 0.88 → 아님(라이브).
    5. ✅ 분석 서비스 불가(워커 주소를 닫힌 포트로) → 백오프 29.0초·119.0초(runAfter 를 당겨 가속) → 3회째 FAILED(`ANALYSIS_UNAVAILABLE`)·발화 FAILED / wav 삭제 → 즉시 FAILED(`AUDIO_MISSING`, attempts 1). 가짜 워커로도 30초·2분·FAILED·AUDIO_MISSING(retryable:true 여도 즉시) 확인.
    6. ✅ #22 소유자 200(엔진 칸·엔진명 없음, 분석 전 null)·타인 404·무세션 401 / #21a requiresReview=false 409·분석 전 409·이미 확정 409·타인 404·본문 400·**동시 두 요청 한쪽만 200(다른 쪽 409)**·finalSource=고른 출처·`ChatMessage.content`·`Correction.original` 바이트 불변.
    7. ✅ 내부 API 3종 × (시크릿 없음 404·틀림 401·X-Service-Env 다름 409 ENV_MISMATCH·env 헤더 없음 409·X-Service 다름 403·GET 404)·본문 상한(claim 4KB·#138 256KB) 400 / D-B11 은 단위(비운영 claim·#140·#138 모두 QA 계정만, 운영은 필터 없음)로 확인 — 라이브 DB 에 실사용자 발화가 0건이라 실데이터 교차는 만들지 않았다(실사용자 행을 만들지 않기 위해).
    8. ◐ **실시간 STT 구간**(gateway MIC_TEST 30회, 손 뗌 → final): 워커 없음 p50 56ms·p90 71ms / 워커 2개 + 30초 발화 연속 부하 p50 72ms·p90 95ms(+16ms — 같은 호스트 CPU 경합, 턴 전체 대비 1% 미만). **턴 전체 p50 비교는 LLM 한도로 보류**(리셋 뒤 `task012b-latency.sh 3017 turn 30`). 30초 발화 5건 claim→#138 커밋 p50 11.7초·p95 14.0초, 짧은 발화(stt20, 1.8~5.2초) p50 4.3초·p95 6.1초.
    9. ✅ 워커 로그 전사 원문 0(길이·sha1[:8]·코드값만, 스모크 L1 자동 검사) · dev 서버 로그 원문 0 · #22·claim·health 응답 엔진명 0 · 실패 코드는 엔진 중립(`ANALYSIS_*`).
    10. ◐ D-B7 선택 규칙은 실제 DB·실제 #67 연결·#138·#21a 로 확인(분석 완료·재확인 불필요 → 분석 텍스트 SERVER_STT / 재답 문항은 저장된 답과 맞는 발화만 → 분석 전이면 선택 없음 / #21a USER → 그 텍스트 TEXT / learning 주입 지점은 음성 답만 묻고 바뀐 문항만 덮음). **A6 출제·A7 채점 E2E 는 LLM 한도로 보류**(리셋 뒤 `EVAL_LLM=1`).
    11. ✅ `git diff prisma/schema.prisma` 빈 diff. 회귀: 단위 전부 PASS. 스모크 007·010·011 은 LLM 필요 — 리셋 뒤.
  - **stt20 신뢰도 분포(참고, U7)**: 실시간 텍스트 자리에 정답 문장을 넣고 분석 STT 와 비교 → p50 1.0, 0.85 미만 1건(05 「駅はどこですか」→ 분석 「低級はどこですか」 0.636), 0.95 미만은 3건(01 いい/良い 0.941, 17 部屋/ケア 0.933). 30초 발화 5건 0.97~1.0. **분석 STT(medium)가 짧은 합성 음성에서 오인한 쪽**이라 012b-2 카드 문구는 "분석 안이 늘 옳다"로 쓰면 안 된다.
  - **정본과 다르게·공백을 메운 점(Leader 확인 요청)**: ① gateway 경로 잡은 `runAfter +10초` — gateway 가 콜백 응답을 받은 뒤 wav 를 옮겨서, 바로 집으면 AUDIO_MISSING(재시도 없음)으로 끝난다. ② 고아 회수 때 attempts 가 이미 3이면 QUEUED 가 아니라 FAILED(`ORPHANED`)+발화 FAILED(§5-8 "3회 한도에 포함"). ③ #140 은 워커가 retryable:true 를 보내도 `AUDIO_MISSING·AUDIO_INVALID·EMPTY_TRANSCRIPTS·READING_UNAVAILABLE` 은 즉시 FAILED. ④ #138 은 확정 실패(FAILED)·DONE 잡의 늦은 결과를 409 STALE_CLAIM(워커는 무시), 회수돼 QUEUED 인 잡의 결과는 받는다. ⑤ `AppSetting speech.review.threshold` 는 0~1 숫자면 **모든 모드**의 임계(정본 문장 그대로 읽음 — ACCURATE 도 그 값). ⑥ `engineVersions` 에 `reviewThreshold` 외에 `flags`·`recognitionMode` 도 스냅샷(워커가 이 세 키를 보내면 400). ⑦ D-B7: speech 함수는 발화 id 가 아니라 `(userId, [{evaluationItemId, answerText}])` 를 받는다 — 한 문항에 발화가 여럿 붙을 수 있어(같은 문항 재답) 저장된 답과 텍스트가 맞는 발화만 보고, 확정 USER 는 `inputSource=TEXT`, 재확인 대상이었다가 실시간 안을 고른 발화는 finalText·REALTIME_STT. ⑧ 새 내부 라우트 3종은 `X-Service: worker` 가 아니면 403(정본에 코드 미정). **기존 gateway 콜백 라우트(`/api/internal/speech/utterances`)에는 X-Service-Env 검사가 없다** — 인계문과 달리 원래 없었고, gateway 동작을 바꾸지 않으려고 그대로 뒀다(후속 판단). ⑨ worker 패키지는 README §2 트리(`comparator.py`·`handlers/` 최상위) 대신 gateway 처럼 `kaiwa_worker/` 패키지 + `main.py` — 최상위 모듈 이름 `comparator`·`handlers` 충돌 방지. ⑩ `speech.config.yml worker.poll_interval_ms` 는 1000(유휴 백오프 5000 주석)인데 README 는 2초·최대 10초 — 워커는 yml 값(1초)을 쓰고 유휴 최대 10초는 코드 상수. README 에 맞추려면 yml 을 2000 으로(Leader 파일). ⑪ #21 응답 `status` 는 실제 값(`QUEUED`) — 정본 예시의 `"status":"RECORDED","analysisQueued":true` 조합은 나오지 않는다. ⑫ 채팅 턴 "글자로 고치기"로 이미 `finalSource=USER` 인 발화도 #138 은 규칙대로 requiresReview 를 판정한다 — 카드에 띄울지(=USER 확정을 덮을 수 있음)는 012b-2 에서 정할 것.
  - **Leader 소유 파일 초안**:
    - `ecosystem.config.js` apps 에 추가(gateway 항목 뒤):
      ```js
      {
        // 분석 STT 워커(task-012b) — 포트 없음(생존 = 앱이 claim 하트비트로 판단, D-B4), DB 접속 없음(DATABASE_URL 을 넘기지 않는다, D-B1).
        name: 'thekaiwa-speech-worker',
        script: `${SPEECH_VENV}/bin/python`,
        args: 'main.py',
        interpreter: 'none',
        cwd: `${HERE}/speech/worker`,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '256M', // http 모드 — 읽기 사전 포함 RSS ≈50~100MB(dev 실측 48MB + numpy)
        kill_timeout: 70000, // SIGTERM 뒤 지금 잡(분석 STT 60s)을 끝낼 시간 — 넘기면 15분 뒤 앱 고아 회수
        env: {
          ...pickNonEmpty(dotenv, ['APP_ENV', 'DATA_ROOT', 'SPEECH_INTERNAL_SECRET', 'APP_INTERNAL_URL', 'WHISPER_SERVICE_URL', 'SPEECH_LOG_LEVEL', 'SECRETS_DIR']),
          SPEECH_CONFIG_PATH: path.resolve(HERE, dotenv.SPEECH_CONFIG_PATH || 'speech/speech.config.yml'),
          SPEECH_WORKER_ID: 'worker-1',
          PYTHONPATH: `${HERE}/speech/worker:${HERE}/speech/common`,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONUNBUFFERED: '1',
        },
        out_file: `${LOG_DIR}/speech-worker-out.log`,
        error_file: `${LOG_DIR}/speech-worker-err.log`,
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
      },
      ```
    - `deploy.yml` `runtime.apps` 에 `- thekaiwa-speech-worker` + 주석 "생존은 /api/health checks.stt_analysis_worker(degraded — 배포를 막지 않음). 등록 전 운영 venv 에 `pip install -r speech/worker/requirements.txt`(U2)". 저장소 밖 `~/.local/webhook-deploy/deploy-thekaiwa.sh` 의 `--apps` 에도 추가(U1).
    - `.env.example`: `WHISPER_SERVICE_URL` 주석 "분석 STT — thekaiwa-speech-worker 가 읽는다(앱 health 도)" · `APP_INTERNAL_URL` 주석 "gateway·worker → 앱 내부 콜백" · (선택) `SPEECH_WORKER_ID=worker-1`.
    - `speech/speech.config.yml` `worker.poll_interval_ms: 2000`(README §2 정합, 선택).
    - 운영 venv 설치(U2): `~/.node-local/thekaiwa-speech/venv/bin/pip install -r speech/worker/requirements.txt` — 휠이 없어 소스 빌드(cmake 는 pip 빌드 격리, sudo 불필요, 2~3분), 사전 22.6MB 는 첫 g2p 때 GitHub 에서 venv 안으로 받는다(운영 첫 기동 전 한 번 `python -c "import pyopenjtalk; pyopenjtalk.g2p('テスト')"` 권장 — 워커 기동 점검이 받게 둬도 된다).
  - **트러블슈팅(재발 가능)**: ① pyopenjtalk 0.4.1 은 리눅스 휠 없음 → 소스 빌드가 sudo 없이 됨(빌드 격리가 cmake 를 받는다), 사전은 첫 사용 때 다운로드. ② 이 에이전트 세션의 env(ANTHROPIC_BASE_URL·CLAUDE_CODE_* 등)를 물려받은 dev 서버에서는 Claude CLI 가 `ClaudeCliExecError` — dev 서버를 `env -i HOME PATH USER LANG APP_ENV=LOCAL` 로 띄워야 LLM 이 돈다(어댑터 `cleanEnv` 가 지우는 목록에 없는 변수들). ③ 스크립트에서 `( cd … && python … ) &` 로 띄운 워커는 `kill` 이 서브셸만 죽여 고아로 남는다 → `exec` 필수(스모크·latency sh 에 반영). ④ #21 은 사용자당 30/분 — 스모크가 한 분에 30건 넘게 올리면 429(스모크가 Retry-After 대기). ⑤ TALK 평가 출제도 단어 4개 필요(NOT_ENOUGH_WORDS).
  - **남은 위험**: (a) 운영 등록(U1·U2) 전까지 운영 health 는 계속 `stt_analysis_worker` degraded(정상). (b) blue/green 전환·앱 재기동 직후 워커의 다음 claim(≤10초) 전까지 올라온 발화는 적재되지 않는다(`analysisQueued:false` — 분석 누락, 대화 영향 없음). (c) 분석 서비스(다른 프로젝트 공용·전역 잠금)가 긴 전사 중이면 잡이 60초 타임아웃 → 백오프 재시도. (d) 워커와 분석 서비스가 같은 호스트 CPU 를 써서 실시간 STT 가 부하 시 +16ms(p50). (e) `/api/internal/*` 는 nginx 에서 막혀 있지 않다(시크릿으로만 보호 — 기존 gateway 경로와 같음). 워커·gateway 는 127.0.0.1 로 부르므로 nginx `location /api/internal/ { return 404; }` 를 권장(Leader 인프라). (f) D-B11 한계: 운영 워커가 떠 있으면 개발 QA 잡을 운영 코드가 처리할 수 있음(정본 명시).
  - **정리**: 스모크·지연 스크립트가 만든 QA 발화·잡·분석·wav·대화·평가·단어는 매 실행 finally 에서 삭제 — 확인: SpeechJob 0·SpeechAnalysis 0·QA Utterance 0·QA wav 0. dev 서버 3017·복제본·dev venv 는 LLM 재검증 뒤 정리.
- [02:15] **LLM 리셋(01:21) 뒤 라이브 추가** — dev 3017(복제본, `env -i` 기동) · 워커 dev venv.
  - **D-B7 채점 E2E(A6·A7 실제 호출) ✅**: 스모크 A 51/51(`EVAL_LLM=1`) — QA2 TALK 평가 출제 → 상황 문항 2개에 발화 연결 → 상황1 발화만 #138(재확인 불필요) → 제출 → A7 채점 DONE 12.8초 → 상황1 `answerText` = 분석 텍스트·`inputSource=SERVER_STT`, 상황2(분석 전) = 저장된 답 그대로·`REALTIME_STT`(채점이 분석을 기다리지 않음). 뒤정리: 평가·잡·기록·스냅샷·단어·발화 0, 오늘 DAILY 복원.
  - **dev 서버 env 재현 조건(ClaudeCliExecError)**: 이 Claude Code 에이전트 세션 셸에서 `node … next dev` 를 그대로 띄우면 세션 env(`ANTHROPIC_BASE_URL`·`CLAUDE_CODE_OAUTH_SCOPES`·`CLAUDE_CODE_SESSION_ID`·`CLAUDE_CODE_MESSAGING_*`·`CLAUDE_SSH_*` 등)가 앱 → Claude CLI 자식 프로세스로 넘어가(어댑터 `cleanEnv` 가 지우는 목록 밖) CLI 가 실행 오류로 끝난다(`[router] LLM connection=claude-cli-local 실패(ClaudeCliExecError)`). 해결: dev 서버를 `env -i HOME="$HOME" USER="$USER" LANG="$LANG" PATH="$PATH" APP_ENV=LOCAL node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p <포트>` 로 띄운다. pm2 운영 프로세스는 이 문제 없음(에이전트 셸 env 를 물려받지 않음). 후속 후보: `cleanEnv` 가 `CLAUDE_CODE_*`·`CLAUDE_SSH_*`·`ANTHROPIC_BASE_URL` 접두 일괄 제거(engine 어댑터 — 별도 소작업).
  - **완료 기준 8(턴 지연, 워커 유무) — ✗ 미달, 원인 분석·결정 필요**. 방법: `tests/live/task012b-latency.sh 3017 turn 30` — 턴마다 #21 업로드(stt20 음성) → #32 턴 SSE, 5.6초 간격 연속 30턴, 워커 없음(적재 0) vs 워커 2개(턴마다 그 발화가 곧바로 분석됨). prompt-engineer A4 재검증(Claude CLI)이 같은 시간대에 병행 — LLM 단계 p50 은 두 조건이 거의 같아(3.50s·3.57s) LLM 쪽 영향은 작다.
    | 조건 | 첫 음성 p50/p90 | done p50/p90 | 비고 |
    |---|---|---|---|
    | 1차 워커 없음 | 2,036 / 3,043ms | 5,252 / 7,496ms | queued 0 |
    | 1차 워커 2 + 30초 발화 연속 부하 | 2,888 / 4,564ms(+42%) | 6,186 / 10,680ms(+18%) | 업로드 부하 자체가 섞임 |
    | 2차 워커 없음 | 1,987 / 3,453ms | 5,232 / 7,551ms | |
    | 2차 워커 2(추가 부하 없음) | 3,264 / 5,516ms(+64%) | 6,703 / 13,403ms(+28%) | **오염** — Leader 의 006 스모크(qa-bot)와 겹쳐 턴 2건 409 |
    단계별(Trace p50, 1차 없음→있음): ACCEPT 614→1,406ms · SAVE 759→1,374 · UTTERANCE_LINK 575→851 · **TTS[0](캐시 HIT) 95→815** · LLM 3,503→3,560 · TTS_SYNTH[1](M4) 639→729. → 늘어난 것은 **LLM·M4 가 아니라 앱 쪽 DB 쓰기·캐시 읽기 단계**. 보조 실측(QA 없음): 분석 서비스가 30초 발화를 전사하는 동안 같은 호스트의 CPU 작업 p50 61→81ms(+33% — faster-whisper 가 CPU 코어를 다 씀), DB `SELECT 1` 은 1ms 그대로 → 원인 후보 = ① 전사 중 CPU 경합(dev 서버 Turbopack 은 CPU 에 민감 — 운영 `next start` 보다 과장) ② 워커 커밋(claim·#138 잡당 2회)이 공유 NAS DB 의 느린 커밋(ACCEPT 기준값부터 600ms)과 겹침. 테스트는 5.6초 간격 연속 턴이라 **모든 분석이 다음 턴과 겹치는 최악 조건**이다.
    - 이미 넣은 완화: 유휴 claim 은 트랜잭션 없이 읽기 1회(`analysisDb.hasClaimable`) — 빈 큐 BEGIN·잠금 SELECT·COMMIT 제거(단위 24/24).
    - **Leader 결정 필요(D-B8 수정 후보)**: (a) 그대로 두고 운영 모드(`next build`+`next start`)로 다시 재서 기록 (b) **사용자별 디바운스** — 같은 사용자의 새 발화가 올라오면 그 사용자의 QUEUED 분석 잡 `runAfter` 를 뒤로(예: 마지막 발화 +20초) 밀어, 분석이 대화가 멈췄을 때 돈다(앱 enqueue 한 곳, 스키마 0 — 결과는 대화 뒤에 나오므로 012b-2 카드 시점이 늦어짐) (c) 모든 모드 고정 지연(+12초 — 연속 대화에선 다음 턴과 여전히 겹침). 권고 (b)+(a).
  - **QA 계정 나눠 쓰기(Leader 요청)**: 병렬 라이브가 필요하면 developer 는 `QA_ACCOUNT=2`(qa-bot2)만 쓴다 — `task012b-latency.sh` 기본값을 qa-bot2 로 바꿨다(`QA_ACCOUNT` 로 덮을 수 있음). `task012b-smoke.sh` 는 IDOR 검사에 두 계정을 다 쓰므로 다른 QA 라이브와 겹치지 않는 시간에만 돌린다. 이번에 3011 의 006 스모크가 qa-bot 턴 잠금 409 로 막힌 것은 내 턴 지연 측정(01:25~01:55)과 겹쳤기 때문.
- [02:55] **D-B8 수정 구현(Leader 결정 02:30 — 사용자별 디바운스 + 운영 모드 재측정)**
  - 코드: `speech/analysis/policy.ts`(`ANALYSIS_DEBOUNCE_MS=20s`·`ANALYSIS_DEBOUNCE_CAP_MS=5분`·`enqueueDelayMs` = max(20초, FAST 30초, gateway 10초)·순수 규칙 `debouncedRunAfter`) · `speech/analysis/db.ts`(`debounceStatement` — `UPDATE SpeechJob SET runAfter = GREATEST(runAfter, LEAST(:now+20s, createdAt + 300s)) WHERE userId AND kind='ANALYSIS_STT' AND status='QUEUED' AND createdAt > :now−5분`, RUNNING·다른 사용자 불변, 시각은 앱 UTC 파라미터 — DB `NOW()` 는 KST 라 섞지 않음) · `speech/utterances/store.ts`(`utteranceDb.create` — 분석 잡을 함께 넣을 때만 발화 생성과 디바운스를 **같은 배치 트랜잭션**(커밋 1회)) · `speech/analysis/enqueue.ts`(새 잡 `createdAt` 도 앱 시각 — 상한 기준). 빈 큐 claim 은 트랜잭션 없이 읽기 1회(`hasClaimable`, 02:10).
  - 단위: `task012b.test.ts` 26건(디바운스 규칙·상한·지연 20/30초·internal 인증 매트릭스 추가) · 앱 전체 747건 중 746 PASS·1 skip · tsc 0 · eslint 오류 0. 운영 모드 빌드(`next build` 복제본) 통과.
  - 라이브(운영 모드 `next start`, 3017, `env -i`): 스모크 A **50/50**(3c AUTO·ACCURATE +20.0초·FAST +30.0초 · 3d gateway +20초 · **3e 디바운스**: 같은 사용자 QUEUED → 새 발화+20.0초, 만든 지 6분 된 잡·RUNNING·QA2 잡 불변, 새 잡 +20초 · **3f 상한**: 만든 지 4분 50초 잡은 createdAt+5분에서 멈춤(오차 0ms)) · B **4/4** · C **2/2**(백오프 29.9·118.8초) · 로그 원문 0.
  - **정본 반영 문안 초안(Leader 반영용)**:
    - api-contract #21 적재 조건 2번 교체: "사용자 `recognitionMode ≠ OFFLINE`. 새 잡 `runAfter` = 지금 + max(20초, FAST 30초). **사용자별 디바운스(D-B8 수정 2026-09-29)**: 잡을 적재할 때 같은 사용자의 `QUEUED` 분석 잡 `runAfter` 를 `max(runAfter, min(지금+20초, createdAt+5분))` 로 민다(발화 저장과 같은 배치 트랜잭션, `RUNNING`·다른 사용자 불변). 대화가 이어지는 동안에는 분석이 돌지 않아 턴 지연이 워커 유무와 무관해진다(분석 전사가 같은 호스트 CPU 를 다 쓰고 결과 저장이 공유 DB 에 커밋 — 디바운스 없이는 연속 턴 첫 음성 p50 +42% 실측). 결과는 마지막 발화 ≈20초 + 분석 시간 뒤. 만든 지 5분 지난 잡은 더 밀지 않는다(끝없는 대화에서 분석 기아 방지)." · gateway 콜백 문장에 "(gateway 는 콜백 응답 뒤 wav 를 옮긴다 — 20초 디바운스가 파일 이동 여유(≥10초)를 덮는다)".
    - api-contract §2-28 #139 하트비트 문장 옆: "집을 잡·고아가 없으면 트랜잭션을 열지 않는다(읽기 1회 — 유휴 워커의 공유 DB 왕복 축소). 하트비트는 그대로 갱신."
    - domain-model §5-8 `(없음)→QUEUED` 행 트리거: "enqueue(`runAfter = now + max(20s, FAST 30s)`) + 같은 사용자 `QUEUED` 잡 디바운스(`runAfter ≤ createdAt+5분`, task-012b D-B8 수정)". §5-9 `Utterance.status` 칸 끝: "`QUEUED` 발화는 대화가 멈춘 뒤(마지막 발화 +20초, 최대 5분) 분석된다".
    - `speech/worker/README.md` §2: "간격은 `speech.config.yml worker.poll_interval_ms`(현 1초), 빈 응답이면 두 배씩 최대 10초(코드 상수)" · "**운영 워커 수 = 1(권장, Leader 2026-09-29)** — 분석 서비스 전사가 호스트 CPU 코어를 다 써(실측 같은 호스트 CPU 작업 +33%) 워커를 늘리면 대화 경로만 느려진다. 동시 처리 1·`max=1`. 워커 2개는 중복 처리 0 검증용으로만" · §7 실측 항목에 "대화 중 시작된 분석 잡 0(디바운스)·마지막 발화 → 분석 완료 p50/max".
    - `ecosystem.config.js` 초안(위 [00:35])의 worker 항목 주석에 "instances 1 고정 — 운영 권장 워커 1개(전사가 CPU 코어를 다 쓴다)" 추가.

## Reviewer 기록

## QA 기록

## 배포 기록

## 최종 요약

### 2026-09-29 02:25 Leader(메인) — D-B8 수정: 사용자별 디바운스
- 근거(developer [02:15] 실측): 워커 2 + 30초 발화 부하에서 첫 음성 p50 2,036→2,888ms(+42%)·done +18%. LLM 단계는 불변, 늘어난 곳은 앱 DB 쓰기·캐시(ACCEPT·SAVE·TTS[0] HIT) — 분석 전사의 CPU 점유(+33%)와 NAS DB 커밋 겹침. 완료 기준 8(≤10%) 미달.
- 결정: **(b) 사용자별 디바운스** — 새 발화가 오면 그 사용자의 QUEUED 분석 잡 `runAfter` = 마지막 발화 +20초(RUNNING 불변), **상한 첫 발화 +5분**(끝없는 대화에서 분석이 영원히 밀리지 않게). 워커 기본 동시 처리 1. 재측정은 운영 모드(next build+start)로 (i) 연속 30턴 워커 있음/없음 ≤10% (ii) 대화 멈춤 뒤 마지막 발화→ANALYZED 시간 p50/max. 012b-2 확인 카드는 대화가 멈춘 뒤 뜨는 것으로 설계(데모 때 반영). D-B7 채점은 원래 분석을 기다리지 않으므로 영향 없음(대화 직후 제출이면 실시간 텍스트).
- (a) 단독·(c) 고정 +12초는 연속 대화와 여전히 겹쳐 기각.
