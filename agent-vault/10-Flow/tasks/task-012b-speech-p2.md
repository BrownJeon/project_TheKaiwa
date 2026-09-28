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
- [2026-09-29 05:20] codex_gate/C2 engine=jev → codex_required=true / wanted_before_budget=true / mode=adversarial-review / focus=concurrency / budget_rule=CX-limit-unknown-r2 / codex_switch=on | overrides=CX-r2-post-review | fallback=- | tokens=1454

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

### 2026-09-29 03:18 Leader — 정본 반영(developer 구현 결정)·"정본과 다르게 한 점 ⑫" 분류
메인 기본 채택분(D-B8 사용자별 디바운스 +20초·상한 5분 · 워커 동시 1 · claim 타임아웃 30초 · self-reclaim · `SPEECH_WORKER_ID` 프로세스별 고유 · 유휴 claim 트랜잭션 없음 · 처리 후 즉시 다음 claim)을 정본에 반영했다. `speech/speech.config.yml` 은 건드리지 않고 README 를 yml 값(1초)에 맞췄다. 012c 절·코드는 손대지 않음(REV-033 동시 감사).

| # | developer 기록 [00:35] ⑫ | 분류 | 정본 반영 위치 |
|---|---|---|---|
| ① | gateway 경로 잡 `runAfter +10초`(콜백 응답 뒤 wav 이동) | **채택/정본 수정** — 20초 디바운스가 덮고 10초는 하한 상수로 남김 | api-contract #21 적재 조건(gateway 문장) |
| ② | 고아 회수 때 `attempts ≥ 3` 이면 `FAILED(ORPHANED)`+발화 FAILED | **채택/정본 수정** | api-contract #139 ① · domain-model §5-8 `RUNNING→FAILED`·고아 회수 행 |
| ③ | #140 강제 확정 실패 4종(`AUDIO_MISSING·AUDIO_INVALID·EMPTY_TRANSCRIPTS·READING_UNAVAILABLE`, retryable 무시) | **채택/정본 수정** | api-contract #140 · domain-model §5-8 · worker README §2 |
| ④ | #138 판정 순서 — 이미 ANALYZED 200 → 잡 FAILED/DONE `409 STALE_CLAIM` → 회수돼 QUEUED 인 잡의 늦은 결과는 저장 | **채택/정본 수정** | api-contract #138 · worker README §6 |
| ⑤ | `AppSetting speech.review.threshold`(0~1)가 **모든 모드**(ACCURATE 포함) 임계 | **Leader 판단 필요** — 현행을 정본에 "판단 대기"로 기록(운영에 행 없음 → 지금 영향 0) | api-contract #138(현행 구현 문장) |
| ⑥ | `engineVersions` 에 `reviewThreshold`·`flags`·`recognitionMode` 스냅샷, 워커가 이 예약 키를 보내면 400 | **채택/정본 수정** — "원래 재확인 대상" 판단에 flags 포함 | api-contract #138·#21a · domain-model §5-9 |
| ⑦ | D-B7 `pickGradingTexts(userId, [{evaluationItemId, answerText}])` — 저장된 답과 텍스트가 맞는 발화만, 확정 USER → `TEXT`, 재확인 후 실시간 선택 → `REALTIME_STT` | **채택/정본 수정** | api-contract #67 옆 D-B7 노트 · module-dependency speech 공개 API |
| ⑧ | 새 내부 라우트 3종 `X-Service ≠ worker` → 403 | **채택/정본 수정** | api-contract §2-28 "구현 현황" |
| ⑧-b | 기존 gateway 콜백(`/api/internal/speech/utterances`)에 `X-Service-Env` 검사 없음(인계문과 다름) | **현행 유지**(gateway 동작 불변) — **012b-2 이후 검토** | api-contract §2-28 "구현 현황" |
| ⑨ | worker 패키지 `kaiwa_worker/` + `main.py`(README 트리와 다름) | **채택/정본 수정** | worker README §2 트리 |
| ⑩ | 폴링 간격 README "2초" vs yml 1초 | **채택/정본 수정** — README·api-contract 를 yml 값(1초)·두 배 백오프 최대 10초·처리 후 즉시 claim 으로. yml 무변경 | worker README §2 · api-contract §2-30·#139 하트비트 문장 |
| ⑪ | #21 응답 `status` = 실제 값(`QUEUED`) | **채택/정본 수정** | api-contract #21 예시 |
| ⑫ | 채팅 "글자로 고치기"로 이미 `finalSource=USER` 인 발화도 #138 이 requiresReview 판정 | **Leader 판단 필요**(012b-2 전) — 정본에 "판단 대기"로 기록 | api-contract #21a 끝 · domain-model §5-9 |

메인 결정분(⑫ 밖) 반영 위치: 디바운스·대기 시간 → api-contract #21 · domain-model §5-8 `(없음)→QUEUED`·§5-9 `Utterance.status` · module-dependency §4-1 · worker README §2 / self-reclaim·claim 타임아웃 30초·`workerId` 고유·유휴 claim 읽기 1회 → api-contract #139·§2-30 · domain-model §5-8 · module-dependency §4-1·§5-2 · README §2·§6·§7 / 워커 1개·`instances: 1`·`SPEECH_WORKER_ID`·`max_memory_restart 256M` → module-dependency §5-2 표·pm2 초안 · api-contract §2-30 · README §2 / health 재기동 직후 false 정상 → api-contract #1 노트.

**판단 필요 2건(메인에 보고)**
- **⑤ 권고**: 현행 유지(운영 행 없음) + 012c 에서 AppSetting 편집을 열 때 "ACCURATE = max(설정값, 0.90)" 또는 키 분리(`speech.review.threshold`·`…Accurate`) 중 하나로 확정. 지금 코드 변경은 불필요.
- **⑫ 권고**: 서버는 지금대로 두고(판정값은 스냅샷에 남는 게 분석 품질 지표로 유용) 012b-2 화면 규칙으로 "`finalSource ≠ REALTIME` 이면 카드 안 띄움"을 기본안으로 데모에 반영. 서버에서 막고 싶으면(#138 에서 `finalSource=USER` 면 `requiresReview=false` 저장 → #21a 409) apply.ts 조건 1줄 — REV-033 사이클에 넣을지 메인 판단.
- (⑫ 밖, 참고) developer 남은 위험 (e): `/api/internal/*` nginx 차단(`location /api/internal/ { return 404; }`)은 인프라(sudo) — Leader 후보로 api-contract §2-28 에만 기록.

### 2026-09-29 03:39 Leader — 정본 반영(REV-033 M1·L2) · ⑫ 확인
- **M1 인스턴스 id**: `workerId` = `<SPEECH_WORKER_ID>-<부트 nonce 8hex>`(≤80자, `lockedBy`). 펜싱(#140)·self-reclaim 은 인스턴스 id **정확 일치**일 때만, 재기동한 워커의 이전 잡은 **15분 고아 회수**, self-reclaim 은 15분 회수와 **따로 로그** → api-contract #139(① self-reclaim 조건·로그, `workerId` = 인스턴스 id 문단 — #138 은 펜싱하지 않음 명시, 타임아웃 문장), #140 펜싱, #138·#139·#140 예시 id(`worker-1-3f9a0c1e`), §2-30(SIGTERM·워커 수 문장) · domain-model §5-8 고아 회수 행 · module-dependency §4-1 claim 주석·§5-2 worker 행·pm2 초안 주석 2곳 · worker README §2(클레임·인스턴스 id 문단)·§6 표·§7.
- **L2**: 디바운스 포함 발화 저장 = `withTransaction` 인터랙티브 트랜잭션(READ COMMITTED·P2034 재시도) → api-contract #21 · domain-model §5-8 `(없음)→QUEUED` · module-dependency §4-1. "같은 배치 트랜잭션"·"프로세스마다 고유" 표현은 정본에서 모두 제거(grep 0).
- **⑫ 확인**: 메인 반영분 api-contract #21a 끝("⑫, 2026-09-29 Leader 확정 — 서버 차단")·domain-model §5-9 끝 일치, 구현(`apply.ts`, developer [03:36])과도 일치. ⑤ 도 메인이 #138 에 "012c 에서 ACCURATE = max(설정값, 0.90)" 로 확정해 둠(이전 "판단 대기" 표기 0).
- 012c 절·코드 무변경, commit/push 없음.

### 2026-09-29 06:22 Leader — 정본 반영(Codex C2 수정: claim 재검사·디바운스 UPDATE 먼저·kind 필터)
- api-contract #21 디바운스 문단: 디바운스 UPDATE 를 발화 INSERT 보다 먼저 + "claim 이 같은 규칙을 한 번 더 적용(#139 재검사)" · #139 ① 고아 회수 = 요청 `kinds` 만, **②-b 재검사**(마지막 커밋 발화 +20초 안·잡 5분 안이면 RUNNING 대신 `runAfter = min(발화+20초, createdAt+5분)`, 다른 사용자 최대 3라운드, 사용자 행 전역 잠금 없음·남는 경우 = claim 이 먼저, 경합 40회 위반 0), 유휴 판정 = 요청 `kinds` 만.
- domain-model §5-8: `(없음)→QUEUED`(UPDATE 먼저) · `QUEUED→RUNNING`(재검사로 미룸) · 고아 회수 행(요청 kind 만).
- module-dependency §4-1: enqueue 주석(UPDATE 먼저)·claim 주석(kinds·재검사). worker README §2(새 발화 직후 빈 claim 정상)·§7(경합 검증 항목).
- 012c 절·코드 무변경, commit/push 없음.

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
- [02:08] **LLM 리셋(01:21) 뒤 라이브 추가** — dev 3017(복제본, `env -i` 기동) · 워커 dev venv.
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
- [02:22] **D-B8 수정 구현(Leader 결정 — 사용자별 디바운스 + 운영 모드 재측정)**
  - 코드: `speech/analysis/policy.ts`(`ANALYSIS_DEBOUNCE_MS=20s`·`ANALYSIS_DEBOUNCE_CAP_MS=5분`·`enqueueDelayMs` = max(20초, FAST 30초, gateway 10초)·순수 규칙 `debouncedRunAfter`) · `speech/analysis/db.ts`(`debounceStatement` — `UPDATE SpeechJob SET runAfter = GREATEST(runAfter, LEAST(:now+20s, createdAt + 300s)) WHERE userId AND kind='ANALYSIS_STT' AND status='QUEUED' AND createdAt > :now−5분`, RUNNING·다른 사용자 불변, 시각은 앱 UTC 파라미터 — DB `NOW()` 는 KST 라 섞지 않음) · `speech/utterances/store.ts`(`utteranceDb.create` — 분석 잡을 함께 넣을 때만 발화 생성과 디바운스를 **같은 배치 트랜잭션**(커밋 1회)) · `speech/analysis/enqueue.ts`(새 잡 `createdAt` 도 앱 시각 — 상한 기준). 빈 큐 claim 은 트랜잭션 없이 읽기 1회(`hasClaimable`, 02:10).
  - 단위: `task012b.test.ts` 26건(디바운스 규칙·상한·지연 20/30초·internal 인증 매트릭스 추가) · 앱 전체 747건 중 746 PASS·1 skip · tsc 0 · eslint 오류 0. 운영 모드 빌드(`next build` 복제본) 통과.
  - 라이브(운영 모드 `next start`, 3017, `env -i`): 스모크 A **50/50**(3c AUTO·ACCURATE +20.0초·FAST +30.0초 · 3d gateway +20초 · **3e 디바운스**: 같은 사용자 QUEUED → 새 발화+20.0초, 만든 지 6분 된 잡·RUNNING·QA2 잡 불변, 새 잡 +20초 · **3f 상한**: 만든 지 4분 50초 잡은 createdAt+5분에서 멈춤(오차 0ms)) · B **4/4** · C **2/2**(백오프 29.9·118.8초) · 로그 원문 0.
  - **정본 반영 문안 초안(Leader 반영용)**:
    - api-contract #21 적재 조건 2번 교체: "사용자 `recognitionMode ≠ OFFLINE`. 새 잡 `runAfter` = 지금 + max(20초, FAST 30초). **사용자별 디바운스(D-B8 수정 2026-09-29)**: 잡을 적재할 때 같은 사용자의 `QUEUED` 분석 잡 `runAfter` 를 `max(runAfter, min(지금+20초, createdAt+5분))` 로 민다(발화 저장과 같은 배치 트랜잭션, `RUNNING`·다른 사용자 불변). 대화가 이어지는 동안에는 분석이 돌지 않아 턴 지연이 워커 유무와 무관해진다(분석 전사가 같은 호스트 CPU 를 다 쓰고 결과 저장이 공유 DB 에 커밋 — 디바운스 없이는 연속 턴 첫 음성 p50 +42% 실측). 결과는 마지막 발화 ≈20초 + 분석 시간 뒤. 만든 지 5분 지난 잡은 더 밀지 않는다(끝없는 대화에서 분석 기아 방지)." · gateway 콜백 문장에 "(gateway 는 콜백 응답 뒤 wav 를 옮긴다 — 20초 디바운스가 파일 이동 여유(≥10초)를 덮는다)".
    - api-contract §2-28 #139 하트비트 문장 옆: "집을 잡·고아가 없으면 트랜잭션을 열지 않는다(읽기 1회 — 유휴 워커의 공유 DB 왕복 축소). 하트비트는 그대로 갱신."
    - domain-model §5-8 `(없음)→QUEUED` 행 트리거: "enqueue(`runAfter = now + max(20s, FAST 30s)`) + 같은 사용자 `QUEUED` 잡 디바운스(`runAfter ≤ createdAt+5분`, task-012b D-B8 수정)". §5-9 `Utterance.status` 칸 끝: "`QUEUED` 발화는 대화가 멈춘 뒤(마지막 발화 +20초, 최대 5분) 분석된다".
    - `speech/worker/README.md` §2: "간격은 `speech.config.yml worker.poll_interval_ms`(현 1초), 빈 응답이면 두 배씩 최대 10초(코드 상수)" · "**운영 워커 수 = 1(권장, Leader 2026-09-29)** — 분석 서비스 전사가 호스트 CPU 코어를 다 써(실측 같은 호스트 CPU 작업 +33%) 워커를 늘리면 대화 경로만 느려진다. 동시 처리 1·`max=1`. 워커 2개는 중복 처리 0 검증용으로만" · §7 실측 항목에 "대화 중 시작된 분석 잡 0(디바운스)·마지막 발화 → 분석 완료 p50/max".
    - `ecosystem.config.js` 초안(위 [00:35])의 worker 항목 주석에 "instances 1 고정 — 운영 권장 워커 1개(전사가 CPU 코어를 다 쓴다)" 추가.
- [03:12] **완료 기준 8 재측정(운영 모드, qa-bot2 만, 워커 1개) ✅ + 측정 중 찾은 결함 2건 수정 — reviewer 인계**
  - 조건: 복제본 `next build` → `next start`(`env -i`, `APP_ENV=LOCAL`·`NODE_ENV=production`, 127.0.0.1:3017) · 워커 1개(운영 권장값) · Leader 006·010·운영 010 스모크가 끝난 뒤 단독 실행(02:26~02:38) · 연속 30턴 5.6초 간격.
    | 조건 | 첫 음성 p50 / p90 | done p50 / p90 | 대화 중 시작된 분석 | 실패 |
    |---|---|---|---|---|
    | 워커 없음 | 2,463 / 4,510ms | 5,780 / 9,269ms | — | 0 |
    | 워커 1(디바운스) | 2,492 / 3,434ms(**+1.2%**) | 5,697 / 8,046ms(**−1.4%**) | **0 / 30** | 0 |
    → **차이 ≤10% 충족**(p90 은 워커 쪽이 더 낮음 — 잡음 범위). 분석 30건 전부 대화가 멈춘 뒤 DONE.
  - (ii) 대화가 멈춘 뒤 마지막 발화 → 분석 완료: 턴 측정 직후(수정 전 워커) p50 126.9초·max 222.2초 → 아래 수정 후 **analysis 모드(턴 없이 30발화, qa-bot2, 워커 1)**: 첫 분석 시작 23.6초 · **p50 89.9초 · max 155.2초** · 잡당 처리 p50 3.7초. 30발화 백로그 기준이라 짧은 대화(발화 몇 개)는 ≈20초 + 발화당 ≈4~5초.
  - **측정 중 찾은 결함·수정**: ① **claim 응답 유실 → 잡 15분 고착**: 공유 NAS DB 커밋 지연으로 claim 이 5초(클라 타임아웃)를 넘은 1회에 앱은 잡을 RUNNING 으로 커밋했지만 워커는 못 받아, 고아 회수(15분)까지 멈춤(max 609초의 원인). 수정: (a) 워커 claim 전용 타임아웃 30초(`LoopConfig.claim_timeout_ms`, `InternalClient.claim_jobs(timeout_ms)` — 앱 트랜잭션 15초+대기 5초보다 길게) (b) **앱: 같은 워커가 다시 claim 하면 그 워커가 쥔 RUNNING 잡을 바로 되돌려 다시 준다**(`recoverOrphans(…, workerId)`·`analysisDb.ownStale` — 직렬 워커가 새 일을 달라는 것 = 쥔 잡 없음. 앱 재기동으로 응답이 끊긴 경우도 복구. 같은 id 로 워커 둘을 띄우면 서로의 잡을 되돌릴 수 있음 → `SPEECH_WORKER_ID` 는 프로세스마다 고유, 기본값 `worker-<host>-<pid>`). ② 잡을 처리한 뒤에도 1초씩 쉬던 것 → 바로 다음 claim(디바운스로 풀린 백로그를 빨리 비움, 빈 응답이면 기존대로 1→10초 백오프). + httpx 요청 INFO 로그(발화 id 가 든 URL) 끔.
  - 스모크(운영 모드, 수정 후): A **51/51**(9c 응답 유실 복구: 같은 워커 재claim → 쥔 잡을 attempts 2 로 다시 줌·다른 워커가 쥔 잡은 RUNNING 그대로 / 10 은 라운드마다 새 워커 id — 결과 없이 같은 id 로 다시 claim 하면 되돌려 받는 것이 이제 정상) · B **4/4**(stt20 claim→완료 p50 4.8초·p95 5.7초, 30초 발화 5건 DONE) · C **2/2**(앞 실행). 단위: app `task012b.test.ts` **27**(자기 잡 회수 추가) · worker pytest **40** · common pytest **21**(claim 타임아웃) · gateway 55 회귀 · ruff·mypy strict · tsc 0 · eslint 오류 0 · 앱 전체 747 중 746 PASS·1 skip(디바운스 반영 시점).
  - 정리: 3017 종료·복제본 삭제(`ss -ltn` 확인) · QA 발화·잡·분석·wav·대화·평가·단어 0 · dev venv `~/.node-local/thekaiwa-speech-dev` 는 reviewer·QA 재실행용으로 남김(삭제는 QA 뒤 Leader 판단). DB 에 실사용자 발화 1건(운영, 012b 무관 — 잡 0건이라 건드린 것 없음) 확인.
  - **정본 반영 문안 초안 추가**: api-contract §2-28 #139 ①에 "고아 회수 대상 = `lockedAt` 15분↑ **또는 이 claim 을 보낸 `workerId` 가 쥔 RUNNING**(응답 유실·재기동 복구 — 워커는 직렬이라 새 claim = 쥔 잡 없음). `workerId` 는 프로세스마다 고유해야 한다" · §2-30 worker 루프: "잡을 처리했으면 바로 다음 claim, 빈 응답이면 간격부터 최대 10초 백오프 · claim 요청 타임아웃 30초(앱 커밋 뒤 응답)" · domain-model §5-8 고아 회수 행 트리거에 "또는 같은 워커의 재claim".
  - **Leader 소유 파일 초안 갱신**: `ecosystem.config.js` worker 항목에 `SPEECH_WORKER_ID: 'worker-1'` 유지 + 주석 "instances 1 고정(운영 권장 워커 1개 — 전사가 CPU 코어를 다 쓴다), id 는 이 프로세스만 쓴다(같은 id 둘이면 재claim 복구가 서로의 잡을 되돌린다)". `speech.config.yml worker.poll_interval_ms` 는 1000 그대로 둬도 된다(처리 뒤 바로 claim, 빈 큐는 트랜잭션 없는 읽기 1회라 부하 작음) — README 의 "2초"를 "yml 값(1초)"으로 고치는 쪽 권장.
- [03:36] **REV-033 수정 라운드(스키마 0, 같은 파일 경계) — 재검 인계**
  - **⑫ 서버 차단(Leader 03:30)**: `speech/analysis/apply.ts` — #138 저장 시점에 `finalSource=USER` 면 `requiresReview=false`(유사도·flags 무관). `transcriptConfidence`·`engineVersions.reviewThreshold/flags` 는 그대로 저장. #21a 는 조건 `requiresReview=1` 이라 409 NOT_REVIEWABLE.
  - **M1 인스턴스 id**: 워커가 기동마다 부트 nonce(`secrets.token_hex(4)`)를 만들어 **claim·#140·#138 의 workerId = `<SPEECH_WORKER_ID>-<nonce>`**(`WorkerSettings.instance_id`, ≤73자 — `lockedBy` VARCHAR(80) 안). 앱은 이미 `lockedBy` **정확 일치**로만 펜싱(#140)·self-reclaim(`ownStale`) 하므로 로직 변경 없이 검증 정규식만 80자로(`WORKER_ID_RE {0,79}`). 같은 SPEECH_WORKER_ID 로 두 프로세스가 떠도·재기동해도 서로의 잡을 되돌리거나 STALE 로 만들지 않는다 — 재기동 전 잡은 15분 고아 회수. + 리뷰 권고 (c): self-reclaim 을 15분 고아 회수와 **따로 로그**(`[speech] 분석 잡 응답 유실 복구 worker=<인스턴스 id> jobs=N`) — 잦으면 claim 응답 지연·id 충돌 신호.
  - **L2**: `speech/utterances/store.ts` 디바운스 포함 create 를 `withTransaction`(READ COMMITTED·P2034 재시도) 인터랙티브 트랜잭션으로(`analysisDb.debounce(tx, …)`). L1(gateway 콜백 X-Service-Env)은 지시대로 현행 유지.
  - 검증: tsc 0 · eslint 오류 0(경고 5 = 기존 components) · 앱 단위 **750 중 749 PASS·1 skip**(task012b 29 — ⑫·M1 추가) · worker pytest **41**(인스턴스 id nonce·80자) · common **21** · gateway **55** · ruff·ruff format·mypy strict 통과.
  - 라이브(운영 모드 `next build`+`next start` 복제본 재생성·`env -i`·3017, **주 계정 qa-bot2 · 다른 계정 qa-developer** — qa-bot 행 0건 확인): 스모크 A **53/53**(신규 6h ⑫: USER 발화 유사도 0.3 → requiresReview=false·임계 0.85 스냅샷·finalText 그대로·#21a 409 / 9d M1: 같은 base·다른 nonce — B 재claim 이 A 잡 불변(RUNNING·attempts 1)·B 의 A 잡 실패 보고 409 STALE·B 자기 잡만 attempts 2 로 복구) · B **4/4**(인스턴스 id `smoke-worker-1-f8b66c84` 등 nonce 확인) · C **2/2**(백오프 29.2·119.0초) · 로그 원문 0. 앱 로그에 self-reclaim·15분 회수가 따로 찍힘 확인. 정리: QA 발화·잡·분석·wav·대화·평가 0, 3017 종료·복제본 삭제.
  - 스모크 계정 변경: `task012b-smoke.sh` 는 이제 qa-bot2(쓰기 전부)·qa-developer(남의 발화 404·다른 사용자 디바운스)만 — `SMOKE_PRIMARY`·`SMOKE_OTHER`(이메일)로 바꿀 수 있다. qa-bot 은 쓰지 않는다.
  - **정본 반영 문안 초안(M1)**:
    - api-contract §2-28 #139: "`workerId` = **워커 인스턴스 id** — `<SPEECH_WORKER_ID>-<부트 nonce 8hex>`(≤80자, `SpeechJob.lockedBy`). 펜싱(#140 `lockedBy = workerId`)과 응답 유실 복구(claim ① 의 '이 workerId 가 쥔 RUNNING 되돌리기')는 이 값이 **정확히 같을 때만** 같은 워커로 본다 — 같은 SPEECH_WORKER_ID 의 다른 프로세스·재기동한 워커는 서로의 잡을 건드리지 않고, 재기동 전 잡은 15분 고아 회수가 처리한다. 앱은 자기 잡 복구를 15분 회수와 따로 로그한다." #138·#140 의 `workerId` 설명에 "(인스턴스 id)" 추가.
    - `speech/worker/README.md` §2: "`SPEECH_WORKER_ID`(기본 `worker-<host>-<pid>`)는 사람이 읽는 이름이고 실제 claim 식별자는 기동마다 붙는 nonce 를 더한 인스턴스 id(`<id>-<8hex>`) — 같은 이름으로 둘을 띄워도 잡이 섞이지 않는다(그래도 운영은 1개). 재기동하면 새 인스턴스라 이전 잡은 앱의 15분 고아 회수로 돌아온다(SIGTERM 은 지금 잡을 끝내고 멈추므로 보통 남는 잡이 없다)."
    - module-dependency §5-2 worker 행 비고: "claim 식별자 = SPEECH_WORKER_ID + 부트 nonce(인스턴스 id) — pm2 instances 1".
    - domain-model §5-8 고아 회수 행: "… 또는 **같은 인스턴스 id**(부트 nonce 포함) 워커의 재claim".
    - ⑫ 는 Leader 가 반영 완료(#21a 끝·§5-9).
  - 변경 파일(이번 라운드): `src/modules/speech/analysis/{apply.ts, jobs.ts, db.ts, validate.ts}` · `src/modules/speech/utterances/store.ts` · `src/modules/speech/__tests__/task012b.test.ts` · `speech/worker/{main.py, kaiwa_worker/config.py, tests/test_loop_config.py}` · `tests/live/task012b-smoke.{sh,ts}`.
- [04:18] **Codex C2 지적 2건 수정(스키마 0) — reviewer 재순환 인계**
  - **① 디바운스↔claim TOCTOU(Medium)**: 두 겹으로 막았다(사용자 행 전역 잠금 없음).
    - (a) **claim 재검사** `speech/analysis/jobs.ts lockClaimable`: `lockQueued`(SKIP LOCKED)로 잠근 잡마다, 같은 트랜잭션에서 그 사용자의 최근 커밋된 `Utterance.createdAt`(`analysisDb.lastUtteranceAt` — groupBy `_max`, 기존 `@@index([userId, createdAt])`, 20초 창만)을 다시 읽어 순수 규칙 `policy.claimDeferral` 로 판정: 마지막 발화 +20초가 안 지났고 잡이 만든 지 5분 전이면 **RUNNING 으로 올리지 않고** `runAfter = min(마지막 발화+20초, createdAt+5분)` 로 미뤄 QUEUED 그대로(`analysisDb.deferQueued`). 미룬 잡은 이 트랜잭션에서 runAfter 가 미래라 다음 잠금에서 빠지므로 **다른 사용자 잡은 최대 3라운드 더** 본다.
    - (b) **발화 저장 쪽 잠금 순서**: `utteranceDb.create` 트랜잭션에서 디바운스 UPDATE 를 발화 INSERT **앞으로** — 진행 중(커밋 전) 발화 트랜잭션이 그 사용자의 옛 QUEUED 잡 행을 먼저 잠가 두므로 동시 claim 의 `SKIP LOCKED` 가 건너뛴다(대기 없음).
    - 남는 창: "claim 이 잠근 **뒤에** 발화 트랜잭션이 시작된" 경우뿐 — claim 이 발화보다 먼저인 것이라 정상 순서(발화 저장은 claim 커밋까지 디바운스에서 기다렸다 끝남, 교착 없음).
  - **② kind 필터(Low)**: `hasClaimable`(세 갈래 공통 `kind IN kinds`)·`orphans`·`ownStale` 에 `lockQueued` 와 같은 kind 필터, `recoverOrphans(tx, scope, now, kinds, workerId?)` 로 전달. 지금은 kinds 가 늘 `['ANALYSIS_STT']` 라 동작 변화 없음.
  - **다중 연결 실DB 경합 테스트** `tests/live/task012b-race.ts`(신규, 미러에서 `node --env-file=.env --import tsx tests/live/task012b-race.ts 40`, qa-bot2 만, 서버·워커·LLM 없이 모듈 직접): **4/4 PASS** — S1 커밋된 새 발화(디바운스 없이 발화만) → claim 이 옛 잡 미룸(runAfter = 발화+20.000초) · S2 발화 트랜잭션이 디바운스로 옛 잡을 잡은 채(커밋 전) 다른 연결 claim → SKIP LOCKED 로 건너뜀(9ms, 대기 없음)·커밋 뒤 +20초 · S3 claim 이 먼저 잠근 채 실제 `utteranceDb.create` → 디바운스에서 대기 후 완료(교착 없음)·옛 잡 RUNNING(claim 이 먼저) · S4 무작위 인터리빙 40회(실제 `utteranceDb.create` ∥ `claimAnalysisJobs`, 지터 0~60/0~400ms) → 위반 0·오류 0(claim 이 먼저였던 2회는 옛 잡을 가져감, 발화가 먼저 끝난 9회는 전부 미룸).
  - 단위: `task012b.test.ts` **32**(claimDeferral 규칙·재검사 미룸+다른 사용자 다음 라운드·claim 전체에서 markRunning 없음·kinds 전달 3곳 추가) · 앱 전체 **753 중 752 PASS·1 skip** · tsc 0 · eslint 오류 0(경고 5 기존) · worker pytest 41 · common 21.
  - 라이브(운영 모드 복제본 재생성·`env -i`·3017, qa-bot2 + qa-developer, qa-bot 0건): 스모크 A **55/55**(신규 **3g** 새 발화 직후 claim → 옛 잡 RUNNING 안 됨·runAfter = 새 발화 +20.000초 / **3h** 새 업로드(디바운스 경로)로 같은 옛 잡이 다시 밀림) · B **4/4** · C **2/2**(백오프 28.9·119.4초 — C1·C2 는 재검사 때문에 첫 claim 이 발화 +20초 뒤, 판정 불변) · 로그 원문 0. 스모크 `ready()` 는 이제 잡 runAfter 를 당기면서 이 스모크가 만든 최근 발화를 1분 전으로 옮긴다(재검사에 걸리지 않게 — 가짜 워커 단계 가속용). 정리: QA 발화·잡·분석·wav·대화·평가 0, 3017 종료·복제본 삭제.
  - **정본 반영 문안 초안**:
    - api-contract §2-28 #139 ②③ 사이에 추가: "**재검사(Codex C2)**: 잠근 잡마다 같은 트랜잭션에서 그 사용자의 가장 최근 발화 시각(`Utterance.createdAt`, 커밋된 것)을 읽어, 마지막 발화 +20초가 지나지 않았고 잡이 만든 지 5분 전이면 RUNNING 으로 올리지 않고 `runAfter = min(마지막 발화+20초, createdAt+5분)` 으로 미뤄 QUEUED 로 둔다 — 다른 사용자 잡은 같은 claim 에서 계속 본다(최대 3라운드). 발화 저장 트랜잭션은 디바운스 UPDATE 를 발화 INSERT 보다 먼저 해 진행 중인 발화의 옛 잡 행을 잠가 둔다(claim 의 SKIP LOCKED 가 건너뜀). 사용자 행 전역 잠금은 쓰지 않는다 — 남는 경우는 claim 이 발화 저장보다 먼저 잠근 때뿐." · ① 고아 회수·빈 큐 판정에 "요청한 `kinds` 만" 명시. #21 적재 조건 디바운스 문장 끝에 "(claim 재검사가 같은 규칙을 한 번 더 적용한다)".
    - domain-model §5-8 `QUEUED → RUNNING` 행 트리거 끝: "… 단 그 사용자의 마지막 발화 +20초 안(잡 생성 5분 안)이면 올리지 않고 runAfter 를 미룬다(claim 재검사, task-012b Codex C2)". 고아 회수 행: "요청한 종류(kind)의 잡만".
  - 변경 파일(이번 라운드): `src/modules/speech/analysis/policy.ts` · `src/modules/speech/analysis/db.ts` · `src/modules/speech/analysis/jobs.ts` · `src/modules/speech/utterances/store.ts` · `src/modules/speech/__tests__/task012b.test.ts` · `tests/live/task012b-smoke.ts` · `tests/live/task012b-race.ts`(신규).

## Reviewer 기록

### 2026-09-29 04:20 reviewer — REV-033

**판정: PASS**(Critical 0 · High 0 · Medium 1 · Low 2) — 7영역 전부 Read 로 검토 + 독립 재실행(미러 tsc/eslint/단위, dev venv pytest) 으로 Developer 주장 전부 대조 확인. push 전 반드시 고칠 것은 없음(Medium 1 은 U1 운영 반영 전 권고).

**검증 방법(재현)**: 미러(`~/.node-local/thekaiwa`) `sync-local.sh` 뒤 `tsc --noEmit`(0 에러) · `eslint src/modules/speech src/app/api/internal/speech src/app/api/v1/speech src/modules/admin/health.ts src/modules/learning/evaluation/grade.ts src/app/api/v1/evaluations`(0 에러) · `node --test src/modules/speech/__tests__/task012b.test.ts`(27/27 PASS, Developer 주장과 일치) · speech/evaluation 관련 전체(`__tests__` 24개 파일, 188건: 187 PASS·1 skip, 회귀 없음) · dev venv(`~/.node-local/thekaiwa-speech-dev`)에서 `speech/worker` pytest 40/40, `speech/common` pytest 21/21(Developer 주장과 일치, pyopenjtalk 실제 로드 확인) · `git diff prisma/schema.prisma` 빈 diff 확인.

**① 6층 경계·엔진명** — `learning↔speech` 상호 import 0(grep), `src/modules/speech/index.ts` 는 conversation·learning 을 import 하지 않음(주석·실제 일치). D-B7 은 라우트(`evaluations/[id]/submit/route.ts`)가 `pickGradingTexts` 를 `EvaluationGrading.speechAnswers` 로 주입하는 함수 전달 방식 — `learning/evaluation/grade.ts` 는 speech 를 import하지 않고 주입받은 `Map` 만 쓴다(module-dependency §4-4 규칙 그대로 확장, 설계 의도와 일치). `grep -rniE "reazon|whisper|style-bert|claude"` 를 이번 diff 의 앱 코드(analysis·utterances·internal/v1 라우트·admin/health·engine/stt·preferences·infra·grade.ts) 전체에 돌려 0건(`admin/health.ts` 는 "엔진명을 안 쓴다"는 주석 문자열만, 런타임 노출 아님) — Python 쪽은 `engine/adapters`·`speech/common`(정책상 허용 영역)에만 `reazon`·`whisper` 존재, `speech/worker` 본체(handlers·loop·comparator·jobs)에는 0건. `/api/health` 새 키 `stt_analysis_worker` 는 `HEALTH_REQUIRED_CHECKS` 밖(코드 확인) — 배포 게이트 비차단, degraded 만.

**② 인증(내부·세션)** — `checkInternalCaller`(`internalAuth.ts`)는 시크릿(sha256+`timingSafeEqual`, 길이 미달 시 항상 거부) → `X-Service` → `X-Service-Env` 순으로 확인해 헤더 없음 404·틀림 401·서비스 다름 403·환경 다름 409 를 만든다 — 세 신규 내부 라우트(`jobs/claim`·`jobs/[id]/result`·`utterances/[id]/analysis`)가 `_lib/worker.ts` 로 이 순서를 공유하고, 단위 테스트(`task012b.test.ts` 190행 근처)가 순서(서비스·환경보다 시크릿이 먼저)까지 확인한다. 본문 상한 claim/failure 4KB·analysis 256KB, 옵션 아닌 키 거부(`onlyKeys`), id 정규식(`JOB_ID_RE`) 모두 코드·테스트 일치. `#22`/`#21a`(v1 라우트)는 `requireSession` 뒤 `s.user.id` 만 쓰고 사용자당 60/30 rate limit, 응답 select 에 `realtimeEngine`·`analysisEngine`·`engineVersions` 없음(엔진 정보 비노출, `review.ts` VIEW_SELECT 확인) — 타인 조회·확정은 전부 조건부 UPDATE/WHERE 의 `userId` 가드로 404 (owner 검사 우회 경로 없음).

  - **Low — 기존 gateway 콜백(`src/app/api/internal/speech/utterances/route.ts`)은 `checkInternalSecret` 만 쓰고 `X-Service`/`X-Service-Env` 검사가 없다.** `git diff` 로 대조하면 이번 diff 는 주석 한 줄만 추가했을 뿐 로직은 012b 이전과 동일(회귀 아님, Developer 가 ⑧에서 이미 고지). 다만 D-B11(비운영 앱은 QA 계정만 다뤄야 한다)의 보호가 세 신규 라우트에는 있고 이 경로에는 없다는 뜻이라, 개발·운영이 같은 DB 를 보는 현재 구조에서 이 경로만 환경 검사가 빠진 비대칭이 남는다. 차단 대상은 아니다(실사용자 피해 경로 아님 — gateway 콜백은 티켓 발급 때 이미 검증된 사용자만 부른다) 지만 Leader 후속 판단으로 남겨 둔다.

**③ 큐 동시성(중점 검토)**
  - **claim(#139)**: `hasClaimable` 읽기 1회 → 없으면 트랜잭션 미개설(유휴 부하 축소) → 트랜잭션 안에서 `recoverOrphans`(15분 고아 + 자기 RUNNING 회수) → `FOR UPDATE SKIP LOCKED`(MariaDB 10.11.11, 코드 주석·Developer 실측 일치) 로 워커 두 개가 같은 잡을 받지 않음 — `task012b.test.ts` "claim: 잠근 잡을…" 단위 + smoke B(워커 2개 20건 중복 0) 로 확인.
  - **펜싱**: `#140`(`reportJobFailure`) 은 `lockJob`(SELECT FOR UPDATE) → `status===RUNNING && lockedBy===workerId` 아니면 409 STALE_CLAIM. `#138`(`applyAnalysisResult`) 은 발화 행을 먼저 잠그고 `job.status FAILED/DONE` 이면 409, 이미 ANALYZED 면 `ALREADY_ANALYZED`(값 불변) — 두 콜백의 잠금 순서가 반대(#138: 발화→잡, #140: 잡→발화)라 이론상 교착 가능하다고 코드 주석이 명시하는데, 실제로 `analysisDb.transaction` = `withTransaction`(`infra/tx.ts`, READ COMMITTED + P2034 재시도 2회) 을 쓰므로 MariaDB 가 교착을 감지하면 트랜잭션 전체가 재실행된다 — 콜백 함수에 DB 밖 부작용이 없어 재실행이 안전함을 코드로 확인했다(설계상 의도된 완화, 결함 아님).
  - **자기 잡 회수(self-reclaim, 이번 리뷰의 중점 지시 사항)** — `analysisDb.ownStale`(`db.ts:95`) 은 `status='RUNNING' AND lockedBy=workerId` 인 행을 **잠긴 시각과 무관하게** 고아로 보고 되돌린다(15분 조건이 없음 — `recoverOrphans` 호출부 `db.ts` 주석 "지금 이 순간보다 이전에 잠근 것 전부"). 직렬 워커 한 개가 응답을 놓치고 재기동한 경우(실측 근거: claim 응답이 5초 넘게 걸려 잡이 15분 고착된 사고, `[03:12]` 기록)를 빠르게 복구하는 의도된 설계이고 단위 테스트(`claim: 같은 워커가 쥔 채 남은 RUNNING…`)·smoke A9c/A10 으로 검증됐다. **그런데 이 펜싱은 `workerId` 문자열 하나만으로 "이전 claim 세대"와 "다른 프로세스"를 구분하지 못한다** — `SPEECH_WORKER_ID` 가 우연이든 설정 실수든 같은 값을 쓰는 두 프로세스가 동시에 뜨면(예: 향후 워커도 blue/green 대상에 편입되거나, 수동 테스트 때 env 를 안 지우고 두 번째 인스턴스를 띄우는 경우), 프로세스 B 의 claim 이 프로세스 A 가 **지금 한창 처리 중인** RUNNING 잡을 나이 조건 없이 되돌려 자신이 다시 받아갈 수 있다. 그 뒤 A 가 (자신은 여전히 그 잡을 쥐고 있다고 믿고) `#140` 으로 실패 보고를 늦게 보내면, `lockedBy` 는 여전히 같은 문자열이라 A 의 실패 보고가 **B 가 실제로 처리 중인 잡**에 그대로 적용돼(RUNNING+lockedBy 일치) FAILED/QUEUED 로 뒤집힐 수 있고, 그 직후 B 가 정상적으로 만든 분석 결과를 `#138` 로 보내면 `job.status===FAILED` 라 409 STALE_CLAIM 으로 버려진다 — **정상적으로 계산된 분석 결과 하나가 조용히 소실**된다(재시도 한도까지 다 썼으면 그 발화는 영구히 분석되지 않음). `finalText`/`finalSource`/`ChatMessage`/`Correction` 등 핵심 학습 데이터는 이 경로로 전혀 바뀌지 않으므로(코드로 확인 — apply.ts 는 Utterance.analysisText/status/requiresReview·SpeechAnalysis·SpeechJob 만 건드림) 영향은 "재확인 카드" 보조 기능 한정이지만, 코드 차원의 강제(예: claim 세대 토큰, 최소 잠금 유지 시간)가 없고 순수히 운영 규율(`instances:1`, `SPEECH_WORKER_ID` 고유)에만 의존한다는 점에서 Medium 으로 남긴다.
    - **근거**: `src/modules/speech/analysis/db.ts:91-106`(`ownStale`/`failOrphan`/`requeueOrphan` — 나이 조건 없음) · `src/modules/speech/analysis/jobs.ts:39-57`(`recoverOrphans`) · `98-112`(`reportJobFailure` 펜싱이 `lockedBy===workerId` 문자열 비교뿐).
    - **완화 확인**: `speech/worker/README.md` §2 가 이미 "같은 id 로 워커 둘을 띄우면 self-reclaim 이 서로의 잡을 되돌린다" 고 명시하고 운영 권장을 `instances:1`(고유 id)로 못 박았다(Leader ecosystem.config.js 초안도 동일) — 현재 운영에 워커가 아직 배포되지 않아(U1 대기) 실제 피해는 0. **권고**: U1 승인·운영 반영 전에 (a) claim 응답에 짧은 무작위 lease 토큰을 얹어 `#140`/`#138` 검증을 `workerId` 대신 그 토큰으로 하거나, (b) `ownStale` 회수에도 최소 유예(예: 수 초)를 둬 "바로 직전에 내가 받은 잡"은 되돌리지 않게 하거나, (c) 최소한 self-reclaim 발생을 15분 고아 회수와 분리된 카운터/로그로 남겨(`jobs.ts:69` 는 지금 둘을 합쳐 `console.warn` 한 줄로만 남김) 운영에서 id 충돌을 조기 탐지할 것. 코드 수정은 발견만 하고 하지 않음(Read 전용).
  - **D-B11 환경 필터**: `jobUserScope()`(`currentEnvironment()!=='PRODUCTION'` 이면 `listQaUserIds()`) 가 claim·#140·#138 세 곳 모두에서 `inScope`/`scope` 로 적용됨을 코드로 확인. `listQaUserIds`(`infra/users.ts`)는 `provider:'test' AND email endsWith '@thekaiwa.test'` 로 실사용자(Google OAuth)가 걸리지 않는 조건이고 60초 캐시·최대 50건. 단위 테스트로 "비운영 QA 만/운영 필터 없음"·"QA 계정 0건이면 트랜잭션 없이 즉시 빈 응답" 모두 확인. 문서화된 한계(운영 워커가 떠 있으면 개발 QA 잡을 운영 코드가 먼저 처리할 수 있음)는 QA 데이터만 걸리므로 설계상 허용 범위.

**④ 디바운스(D-B8 수정) 트랜잭션 경계** — `utteranceDb.create`(`utterances/store.ts:24-29`)가 분석 잡을 같이 넣을 때 `prisma.$transaction([create, analysisDb.debounceStatement])` 를 **직접** 호출한다 — 이 파일 유일하게 프로젝트 표준 `withTransaction`(`infra/tx.ts`, READ COMMITTED 명시 + P2034 자동 재시도)을 거치지 않는 지점이다(`grep "prisma.\$transaction\("` 으로 다른 위치에 이 패턴이 없음을 확인). `debounceStatement` 는 `WHERE userId AND kind='ANALYSIS_STT' AND status='QUEUED'`(이 사용자 소유 행만)만 건드리고 claim 의 `SKIP LOCKED` 는 잠긴 행을 건너뛰므로 실제 교착 가능성은 낮다고 판단했지만(Low), 이 트랜잭션만 재시도 안전망 밖에 있는 비일관성은 남는다 — `withTransaction` 경유로 통일 권고.

**⑤ 안정성·값 불변 검증**
  - **`finalText`/`finalSource` 불변(D-B5)**: `apply.ts` 의 `storeAnalysis` 입력에 `finalText`/`finalSource` 필드가 아예 없다(타입·구현 모두 — `analysisDb.storeAnalysis` 는 `Utterance.analysisEngine/analysisText/transcriptConfidence/requiresReview/status` 만 update). `#21a`(`review.ts resolveDb.update`) 는 `status='ANALYZED' AND requiresReview=1` 조건부 단일 UPDATE 로 그 두 필드만 바꾸고, 세 갈래(REALTIME/ANALYSIS/USER) 모두 SQL 원시 리터럴로 고정돼 앱이 값을 읽고 쓰는 사이 끼어들 틈이 없다(compare-and-swap). 동시 두 PATCH 요청 → 한쪽만 count=1(성공), 한쪽은 count=0→409 로 단위 테스트가 재현.
  - **`Correction.original`/`ChatMessage.content` 무수정**: 이번 diff 전체(`speech/**`, `internal/speech/**`, `v1/speech/**`, `grade.ts`, `submit/route.ts`)에 해당 테이블 update 호출 0건(grep 확인).
  - **평가 채점 단일 트랜잭션(011 불변식)**: `saveGradedEvaluation`(`grade.ts`) 은 그대로 유지되고, D-B7 로 추가된 것은 `g.answers`(`speechAnswerOverrides` 결과)를 **같은 update 호출**에 `answerText`/`inputSource` 로 얹는 것뿐 — 세대 펜싱(`assertCurrentEvalJob`)·잠금 순서(`lockEvaluation`)·`StudyLog`+`Evaluation DONE`+`StatsSnapshot`+`DAILY` 트랜잭션 경계는 변경 없음. `speechAnswerOverrides` 실패는 try/catch 로 흡수돼 저장된 답(실시간)으로 채점을 계속한다(기록률 100% 보호) — 코드·주석·테스트("D-B7 learning 주입…") 일치.
  - **Trace/로그 원문 노출 0**: 앱 쪽 `console.info`(`analysis/route.ts`) 는 id·stored·confidence·review·latency 만, `enqueue.ts`/`grading.ts` 의 catch 는 `e.name` 만 남긴다. `grade.ts` Trace `speechText: answers.size`(개수만). Python 쪽 `handle_analysis_stt.py` 로그는 `text_fingerprint()`(해시) 만 쓰고 원문 없음, `comparator.py`·`internal_client.py`도 정규화 문자열·본문을 로그에 남기지 않음(주석·구현 일치). `paths.py` 는 경로도 로그에 남기지 않는다.
  - **경로 검증(Python)**: `resolve_audio`(`paths.py`) 가 정규식 + `..`/역슬래시/절대경로 거부 + `resolve(strict=True)` 뒤 `is_relative_to(root)` 로 심볼릭 링크 탈출까지 막는다 — DATA_ROOT 밖 거부 확인.
  - **타임아웃·재시도 분류**: whisper 어댑터(`whisper_http.py`) 는 타임아웃 미재시도(엔진 자체 60s), 503/5xx 만 재시도 가능 코드, 4xx 즉시 실패 — `internal_client.py` 콜백은 반대로 연결오류·5xx 만 1회 재시도, 타임아웃은 즉시 실패(README 원칙과 일치, 실시간 경로 이중 지연 방지). `NON_RETRYABLE_ERRORS`(policy.ts) 가 `AUDIO_MISSING/AUDIO_INVALID/EMPTY_TRANSCRIPTS/READING_UNAVAILABLE` 를 워커의 `retryable:true` 와 무관하게 즉시 FAILED 처리 — §5-8 규칙과 일치, 단위 테스트로 확인.

**⑥ 운영성** — `stt_analysis_worker` 는 `HEALTH_REQUIRED_CHECKS` 밖(코드 확인, 배포 비차단), 60초 캐시(하트비트 자체는 120초 창) 라 워커 상태 반영에 최대 ~1분 지연이 있을 수 있으나 degraded 표시일 뿐이라 무해. 이번 diff 는 `ConfigurationVersion`/`AuditLog` 대상 변경이 없다(설정 변경 라우트 미포함, 해당 없음).

**⑦ 학습 원칙** — 제안(AI 산출)에 해당하는 신규 상태는 없다(`SpeechJob`/`Utterance.status` 전이는 파이프라인 상태이지 "제안" 개념이 아님, `finalText` 확정은 사용자 명시 선택 `#21a` 에서만). `StudyLog`/`StatsSnapshot` 관련 변경 없음(011 트랜잭션 그대로). 엔진명·model_id·speaker_id 사용자 노출 0(위 ①).

**네이티브 변경**: 없음(이력서 "하지 말 것" 준수 — `plugins/**`·`android/**`·`capacitor.config.ts`·Manifest 무변경 확인). `versionCode` 증가·고지 대상 아님.

**미검토/범위 밖(고지)**: `tests/live/task012b-{smoke,latency}.{sh,ts}` 는 라이브 실행 스크립트라 내용만 훑었고(운영 3010/pm2 금지 가드 확인, `exec` 로 고아 프로세스 방지 확인) 직접 실행은 QA 몫이라 하지 않았다. `ecosystem.config.js`/`deploy.yml`/`.env.example`/`speech.config.yml` 는 Developer 가 손대지 않았고(이력서 "하지 말 것" 확인) 실제 diff 에도 없음 — Leader 의 별도 반영 대상이라 이번 REV 판정 밖.

**요약**: Critical 0 · High 0 · Medium 1(self-reclaim 펜싱이 workerId 문자열 뿐 — U1 전 lease 토큰/최소 유예/분리 로깅 권고) · Low 2(gateway 콜백 X-Service-Env 부재는 기존 동작·비회귀, `utteranceDb.create` 트랜잭션이 `withTransaction` 밖).

**QA 인계 — high_risk_areas**: ["speech/analysis 큐 동시성(claim/#140/#138 펜싱, 특히 워커 재기동·응답유실 시나리오)", "D-B11 비운영 환경 필터(QA 계정 한정)", "#21a 동시 PATCH 경쟁(compare-and-swap)", "011 D-B7 평가 채점 텍스트 선택이 기록률·단일 트랜잭션에 영향 없는지", "워커 유무에 따른 대화 턴 p50 무영향(디바운스)"] · **native_change: false**.

### 2026-09-29 05:05 reviewer — REV-033 재검

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 1) — 앞 라운드 Medium 1(self-reclaim 펜싱)·Low 1(디바운스 트랜잭션)이 각각 근본 수정으로 닫혔음을 코드·독립 재실행으로 확인. Low 1(gateway 콜백 X-Service-Env 부재)은 Leader 지시대로 현행 유지 — 이번 라운드 대상 아님, 기존 기록 유지.

**검증 방법(재현, 이번 라운드만)**: 미러 재동기화 뒤 `tsc --noEmit`(0) · `eslint`(대상 전체 0 에러) · `task012b.test.ts` **29/29 PASS**(Developer 주장과 일치, ⑫·M1 신규 2건 포함) · **앱 전체 스위트 750건 — 749 PASS·1 skip**(부분이 아니라 `find src -name '*.test.ts'` 전체를 직접 재실행, Developer 주장과 정확히 일치, 회귀 0) · dev venv(`~/.node-local/thekaiwa-speech-dev`)에서 `speech/worker` pytest **41/41**(신규 `test_instance_id_has_boot_nonce_and_fits_locked_by` 포함) · `speech/common` pytest **21/21**. `git diff` 로 `prisma/schema.prisma`·`ecosystem.config.js`·`deploy.yml`·`.env.example`·`speech/speech.config.yml` 무변경 확인(스키마·인프라 파일 경계 준수).

**① M1(인스턴스 id) — 근본 수정 확인, 문서적 완화가 아님.**
- **핵심 변경**: `speech/worker/kaiwa_worker/config.py` `WorkerSettings.instance_id` 프로퍼티가 `f"{worker_id}-{instance_nonce}"`(`instance_nonce = secrets.token_hex(4)`, `load_worker_settings()` 호출마다 새로 생성 — CSPRNG 32bit)를 만들고, `main.py` 가 `HandlerDeps.worker_id`·`WorkerLoop.worker_id` **둘 다** `settings.instance_id`(기존 `settings.worker_id` 아님)로 바꿔 claim·#140·#138 에 실리는 값을 전부 인스턴스 id 로 통일했다. 앱 쪽(`db.ts`)의 `ownStale`(self-reclaim)·`reportJobFailure`(#140 펜싱)는 원래도 `lockedBy === workerId` **정확 일치**였고 이번에도 로직 변경이 없다(`git`·직접 대조로 확인) — 즉 "펜싱을 세게 만든" 게 아니라 "펜싱에 넣는 값을 프로세스마다 고유하게" 바꾼 것이라 최소 변경으로 근본 원인을 없앴다. `WORKER_ID_RE`(TS)·`_WORKER_ID`(Python)는 각각 80자·64자 한도이고 `worker_id(≤64)+'-'+nonce(8)=≤73` 로 `SpeechJob.lockedBy VARCHAR(80)` 안(스키마 0).
- **재기동·15분 회수 상호작용**: nonce 는 프로세스 부팅마다 새로 생성되므로 (a) 같은 프로세스가 claim 응답을 놓치고 다시 부르는 경우(응답 유실) — nonce 불변이라 `ownStale` 이 자기 잡을 즉시 되돌린다(기존 빠른 복구 유지) (b) 프로세스가 죽었다 재기동한 경우 — 새 nonce 라 `ownStale` 이 옛 잡을 찾지 못하고, 나이 기반 `orphans()`(15분, id 무관 쿼리, 이번 라운드 무변경)만 그 잡을 회수한다 — `jobs.ts` 주석·`recoverOrphans` 구현(두 경로를 분리해서 호출)으로 코드상 확인, 별도 회귀는 없다(15분 경로 자체를 건드리지 않음).
- **테스트가 실제로 이 시나리오를 검증**: Python `test_loop_config.py::test_instance_id_has_boot_nonce_and_fits_locked_by` 는 **같은 env(`SPEECH_WORKER_ID='w'*64`)로 `load_worker_settings()` 를 두 번 독립 호출**(`a`,`b` — 두 프로세스 부팅을 흉내)해 `a.worker_id==b.worker_id`(이름은 같음) 이면서 `a.instance_id!=b.instance_id`(실제 claim 식별자는 다름)임을 값으로 단언한다 — 타당한 테스트, 무의미한 재확인이 아니다. TS `task012b.test.ts` "claim M1: …" 은 `ownStale` 을 실제 WHERE 절처럼(`lockedBy===workerId` 필터) 흉내 낸 스텁으로 "다른 인스턴스는 서로의 잡을 안 건드림"·"같은 인스턴스만 self-reclaim"·"#140 도 인스턴스 id 불일치면 STALE" 세 가지를 값 비교로 확인하고, 80자 경계(73자 통과·81자 거부)도 함께 검증한다. 라이브 스모크 9d(`tests/live/task012b-smoke.ts:431-448`, 실행은 안 했고 코드만 읽음)는 실제 HTTP 라우트를 통해 같은 시나리오(A 가 쥔 잡이 B 의 재claim·B 의 A 잡 실패 보고에도 안 바뀜, B 는 자기 잡만 attempts 2 로 self-reclaim)를 재현하도록 짜여 있어 위 단위 테스트의 결론과 일관된다.

**② ⑫(`finalSource=USER` → `requiresReview=false`) — D-B5/D-B6 과 충돌 없음.**
- `apply.ts:42` `const requiresReview = u.finalSource === 'USER' ? false : judgeReview(...)` — `analysisDb.storeAnalysis` 호출 입력에는 여전히 `finalText`·`finalSource` 필드가 없다(이번 라운드도 무변경, grep 재확인) — D-B5(분석은 finalText/finalSource 를 바꾸지 않는다)는 그대로 지켜진다. ⑫ 가 바꾸는 것은 **저장되는 `requiresReview` 불리언 하나**뿐이고, `transcriptConfidence`·`engineVersions.reviewThreshold/flags` 스냅샷은 원래 규칙대로 그대로 저장돼(`#138 ⑫` 단위 테스트가 `similarity=0.2·flags=['LENGTH_RATIO']` 를 넣고도 confidence=0.2·snapshot 그대로임을 값으로 확인) 분석 품질 지표가 훼손되지 않는다.
- **D-B6(⑫가 만드는 유일한 부수효과)**: `requiresReview=false` 가 되면 `#21a`(`resolveDb.update`)의 조건 `WHERE … AND requiresReview = 1` 을 더는 만족하지 못해 재확인 카드 확정 자체가 막힌다(409 NOT_REVIEWABLE) — 이것이 ⑫ 의 의도(학습자가 이미 채팅에서 직접 고친 텍스트를 재확인 카드가 되돌리지 못하게)이고 D-B6("`#21a` 는 Utterance 만 바꾼다")의 전제(재확인 카드가 열릴 수 있는 상태에서만 동작)와 모순되지 않는다. **재진입 경로 없음을 확인**: `finalSource='USER'` 로 만드는 두 지점 — (a) 채팅 턴 "글자로 고치기"(`utteranceDb.link`, 발화 저장·턴 수락 시점 — 분석은 20초+ 디바운스로 그보다 항상 늦게 돎) (b) `#21a` 자신의 `choice:'USER'`(이미 `requiresReview=1` 조건을 소모해 재확정 불가) — 두 경로 다 "#138 이 먼저 `requiresReview=true` 로 확정해 버린 뒤에 뒤늦게 USER 로 바뀌어 ⑫ 를 우회하는" 순서가 코드 구조상 만들어지지 않는다(라우트·트랜잭션 경계 확인). 실측 스모크 6h 도 같은 순서(USER 먼저 세팅 → 분석 나중)로 재현돼 있어 설계와 일치.

**③ withTransaction 재시도 — 디바운스 중복·유실 없음.**
- `utterances/store.ts:25-33` 가 `withTransaction(async (tx) => { create; analysisDb.debounce(tx, …) })` 로 바뀌었다(기존 `prisma.$transaction([...])` 배열형 대신 인터랙티브 트랜잭션 — REV-033 이전 Low 지적이 요구한 그대로). `infra/tx.ts` 의 재시도는 **P2034(교착) 콜백 전체를 다시 실행**하는 방식이고, MariaDB 는 교착 감지 시 트랜잭션 전체를 롤백하므로(부분 커밋 없음) 재실행이 이전 시도의 `INSERT`/`UPDATE` 흔적을 남기지 않는다 — 같은 `id`(호출자가 미리 생성)로 `tx.utterance.create` 를 다시 불러도 PK 충돌이 나지 않는다(첫 시도가 롤백돼 존재하지 않으므로). `analysisDb.debounce`(`db.ts:69-72`)는 `SET runAfter = GREATEST(runAfter, LEAST(now+20s, createdAt+5m))` 형태의 **단조 증가(멱등) UPDATE** 라 재실행돼도 결과가 같다(두 번 적용해도 한 번 적용한 것과 동일한 최종값) — 유실(트랜잭션이 롤백된 채 재시도가 안 되는 경우는 예외가 그대로 올라가 호출자가 인지) 도, 중복 부작용(두 번 반영돼 의도보다 더 미뤄지는 것)도 없다. 코드 검토로 확인했고, 이 통로 자체가 P2034 를 실제로 유발할 가능성은 낮다고 판단한 이전 라운드 분석(사용자 범위 UPDATE + claim 은 SKIP LOCKED 라 서로 차단하지 않음)도 유효하다.

**④ 신규 테스트의 실효성 — 회귀를 실제로 잡는지.**
- 스모크 **6h**·**9d**, 단위 "`#138 ⑫`"·"`claim M1`"·`test_instance_id_has_boot_nonce_and_fits_locked_by` 다섯 개 모두 **값 단언**(상태 조합·바이트/숫자 비교)이고 존재 여부나 예외 미발생 같은 약한 단언이 아니다 — 예: `9d` 는 "A 잡이 안 바뀜"을 `rowA.status/lockedBy/attempts` 세 값으로, "B 의 자기 잡만 self-reclaim"을 `attempts===2` 로 정확히 확인한다. `⑫` 단위는 `similarity=0.2`(임계 0.85 훨씬 아래)·`flags` 존재라는 "정상이라면 반드시 requiresReview=true 여야 할" 입력을 골라 그 반대(`false`)가 나오는지 확인하므로, 이 로직을 되돌리면 테스트가 바로 실패하는 구조 — 회귀 방지 효과가 실질적이다. M1 은 두 계층(Python 설정 로더 + TS 펜싱)에서 각각 독립적으로 검증돼 어느 한쪽만 회귀해도 잡힌다.

**남은 사항(이관 없음)**: 정본 반영 문안 초안(M1)은 Leader 몫으로 남아 있고 이번 재검 범위 밖. 이전 REV-033 의 Low(gateway 콜백 X-Service-Env 부재)는 이번 라운드에서 그대로(Leader 가 "L1 은 지시대로 현행 유지"라고 명시) — 재확인 결과 로직 변경 없음(주석 diff 없음), 기존 기록을 유지하되 새 이슈로 다시 세지 않는다.

**요약**: Critical 0 · High 0 · Medium 0(이전 self-reclaim Medium → M1 로 근본 해결, 재발 방지 테스트 확인) · Low 1(gateway 콜백 X-Service-Env — 변경 없음, Leader 후속 판단 대상으로 이월). QA 진행 가능.

### 2026-09-29 05:35 reviewer — Codex C2 판정

대상: `## Codex 검토` → "[2026-09-29 03:47] C2 adversarial-review focus=concurrency" 지적 2건. 코드 재추적(Read 전용, 라이브·수정 없음)으로 각각 판정.

#### 지적 1(db.ts:69, debounce↔claim 경합) — **채택(Medium 유지)**

**인터리빙이 실제로 가능한지 코드로 확인**: `claimAnalysisJobs`(`jobs.ts:76-93`)는 `analysisDb.transaction` 안에서 `lockQueued`(`db.ts` — `SELECT id FROM SpeechJob WHERE status='QUEUED' AND kind IN(...) AND runAfter<=now ... FOR UPDATE SKIP LOCKED`)로 후보 잡을 잠근 뒤 `markRunning`(`UPDATE ... SET status='RUNNING' WHERE id IN(ids) AND status='QUEUED'`)으로 전이한다. `utteranceDb.create`(`store.ts:25-33`)는 별도의 `withTransaction` 안에서 새 발화를 만들고 `analysisDb.debounce`(`tx.$executeRaw UPDATE SpeechJob SET runAfter=GREATEST(...) WHERE userId=? AND kind='ANALYSIS_STT' AND status='QUEUED' AND createdAt>...`)로 **같은 사용자의 기존 QUEUED 잡**을 뒤로 민다 — 두 트랜잭션 모두 `infra/tx.ts` 의 READ COMMITTED 를 쓴다.
- **행 잠금 관점에서는 안전하다**: claim 의 `lockQueued` 가 먼저 그 잡 행을 `FOR UPDATE` 로 잠그면, 뒤이어 도착하는 debounce 의 일반 `UPDATE`(WHERE 절 매치)는 **그 행에 걸려 블록**된다(같은 행을 겨냥하는 배타 잠금 대기) — claim 트랜잭션이 커밋되면 READ COMMITTED 의 락킹 리드 특성상 debounce 는 **커밋된 최신 상태**(`status='RUNNING'`)를 보고 `WHERE status='QUEUED'` 에 걸리지 않아 그 행을 건드리지 않는다. 즉 "잠금이 걸린 뒤"에는 두 트랜잭션이 서로 충돌 없이 정확한 순서로 정리된다(Codex 요약 문단의 "펜싱은 대체로 일관성 유지" 부분과 일치).
- **그런데 순서 자체(TOCTOU)는 막혀 있지 않다**: claim 의 `lockQueued` SELECT 가 debounce 의 UPDATE 보다 **먼저** 그 잡 행에 도달하면(= 새 발화의 `create+debounce` 트랜잭션이 아직 시작 전이거나 그 행에 이르기 전), claim 은 `runAfter<=now` 조건을 통과한 옛 잡을 그대로 잠그고 RUNNING 으로 넘겨버린다 — debounce 는 그 뒤에 실행돼도 이미 RUNNING 이라 되돌릴 방법이 없다. **공통 선점 자원(같은 사용자 행 잠금 등)이 없어 "누가 먼저 그 잡 행에 도달하는가"가 순전히 타이밍**이라는 Codex 의 지적은 코드로 확인된다 — 오탐이 아니다.
- **다만 Codex 의 두 번째 문장("동시에 생성되는 두 발화 트랜잭션도 … 각자 자기 잡만 연장")은 실질 위험이 아니다**: 새로 만들어지는 잡은 `analysisEnqueueFor`(`enqueue.ts`)가 생성 시점에 **이미 자기 자신의 `runAfter=now+20s`**(또는 FAST/gateway 보정)를 갖고 태어난다 — `debounce()` 는 **기존의 다른 잡**을 미루는 보조 동작일 뿐, 동시에 생성된 두 잡이 서로를 못 봐도 각자 최소 20초 지연은 이미 확보돼 있다. 이 부분은 오탐에 가깝다고 판단했지만, 핵심 지적(옛 QUEUED 잡이 claim 에 선점당해 debounce 가 무력화될 수 있음)이 유효하므로 지적 전체를 채택한다.
- **실측과의 관계**: 이 경합은 "새 발화가 도착한 순간 = 옛 잡의 `runAfter` 가 막 지난 순간 = 워커가 마침 그 찰나에 poll" 이라는 좁은 창이 겹쳐야 하고, Developer 의 완료 기준 8 재측정(연속 30턴, 5.6초 간격, 워커 1개)에서 **대화 중 시작된 분석 0/30**·p50 차이 ≤10% 로 실측 통과했다 — 즉 이번 릴리스의 실제 사용 패턴(수 초~수십 초 간격의 자연스러운 턴)에서는 발현 빈도가 낮다는 것이 경험적으로 확인돼 있다. 그러나 이는 "관측된 적 없음"이지 "구조적으로 불가능"은 아니며, 사용자가 정확히 20초 근처 간격으로 계속 말하거나 공유 NAS DB 커밋이 느려지는 부하 상황에서는 창이 넓어질 수 있어 완료 기준 8 의 보장이 흔들릴 수 있다. Medium 유지가 타당.
- **최소 수정 방향(권고, 락 전체 도입 대신)**: Codex 의 "사용자 행 공유 잠금" 은 모든 claim 이 후보 사용자마다 `User` 행(또는 새 잡별 잠금)을 추가로 잠가야 해 디바운스를 도입한 이유(대화 중 DB 왕복·경합 최소화)를 일부 되돌릴 위험이 있다. 대신 **claim 트랜잭션이 이미 `lockQueued` 로 후보 잡을 잠근 직후, `markRunning` 전에** 그 잡의 `userId` 에 대해 "가장 최근 커밋된 `Utterance.createdAt`"을 한 번 더 읽어(`Utterance` 에 이미 `@@index([userId, createdAt])` 존재 — 인덱스 추가 불필요) `now - lastCreatedAt < ANALYSIS_DEBOUNCE_MS` 면 그 잡을 이번 라운드 `markRunning` 대상에서 제외(그대로 QUEUED 유지, 다음 poll 이 재평가)하는 재검사를 추가하는 편이 비용 대비 효과가 낫다. READ COMMITTED 라 이 재검사도 "직전 찰나에 커밋 전인" 아주 좁은 창은 못 막지만, 현재의 "전혀 재검사 없음" 대비 경합 창을 크게 줄인다. `recoverOrphans` 처럼 이미 트랜잭션 안이라 추가 라운드트립 1회로 끝난다. 실제 두 커넥션 동시성 재현 테스트(Codex 권고)는 dev venv/미러로도 가능하니 다음 Developer 라운드에 추가 권고.

#### 지적 2(db.ts:84, kind 필터 누락) — **채택(Low 유지)**

**코드 확인**: `hasClaimable`(`db.ts:75-82`)의 `OR` 3개 분기 중 `status:'QUEUED'` 분기만 `kind:{in:[...q.kinds]}` 가 있고, 나머지 두 `status:'RUNNING'` 분기(`lockedAt<cutoff`, `lockedBy=workerId`)에는 kind 조건이 없다. `orphans`(`db.ts:84-89`)·`ownStale`(`db.ts:94-96`)도 `status:'RUNNING', lockedAt/lockedBy` 만 보고 kind 조건이 없다 — Codex 주장과 코드가 정확히 일치, 오탐 아님.
- **오늘 시점 실제 위험은 0**: `SpeechJobKind` enum 에 `PRONUNCIATION` 이 이미 존재하고 `validate.ts KINDS`·Python `jobs.py KINDS` 도 이를 인식하지만(`grep` 확인), **PRONUNCIATION 종류의 `SpeechJob` 을 실제로 만드는 코드 경로가 없다**(`analysisEnqueueFor` 는 `kind:'ANALYSIS_STT'` 하드코딩, `handlers/__init__.py` 주석 "지금은 ANALYSIS_STT 만(PRONUNCIATION 은 Phase 3)") — 따라서 DB 에 PRONUNCIATION 행이 존재할 수 없어 이번 릴리스에서 `orphans`/`ownStale`/`hasClaimable` 의 kind 누락이 실제로 다른 종류 잡을 건드리는 경로는 없다.
- **`orphans()`(15분 범용 고아 회수)는 kind 무관이어도 설계상 무해**하다고 판단한다 — 어느 워커의 claim 이 트리거하든 "오래 멈춘 RUNNING 을 QUEUED 로 되돌리거나 한도 소진 시 FAILED" 라는 동작 자체는 잡 종류와 무관하게 올바르고, 실제 재-claim 은 `lockQueued` 가 kind 로 정확히 거르므로 최종 소비는 여전히 안전하다.
- **`ownStale()`(self-reclaim)은 인스턴스 id(REV-033 M1, 부트 nonce)가 프로세스마다 고유한 한 함께 안전**하다 — `lockedBy` 는 `lockQueued`(kind 필터 있음)가 세팅한 값만 들어가므로, 서로 다른 kind 를 요청하는 프로세스가 **서로 다른 `SPEECH_WORKER_ID`(따라서 다른 instance_id)를 쓰는 한** 교차 회수가 발생하지 않는다. M1 전제가 깨지는 경우(운영 실수로 동일 id 재사용)에만 이 kind 필터 부재가 실제 피해로 이어진다 — 즉 이미 존재하는 M1 위험의 부차적 확장판.
- **그래도 채택하는 이유**: (a) 비용이 매우 낮다(`lockQueued` 와 동일 패턴으로 `kind:{in:kinds}` 추가) (b) 향후 015b(발음 분석, Phase 3) 가 실제로 PRONUNCIATION 워커를 붙일 때 "kind 필터를 빠뜨렸다"는 사실 자체를 다시 검토해야 하는 부담을 남기지 않는 편이 낫다 (c) Codex 권고대로 두 종류 worker 동시 가동 통합 테스트를 그때 추가하려면 지금 필터부터 있어야 의미가 있다.
- **최소 수정 방향**: `recoverOrphans`(`jobs.ts:44-73`)에 `kinds: readonly SpeechJobKind[]` 파라미터를 추가해 `analysisDb.orphans`·`analysisDb.ownStale` 호출에 전달하고, `db.ts` 두 함수의 `where` 에 `kind:{in:[...kinds]}` 를 추가한다(`hasClaimable` 의 QUEUED 분기와 같은 패턴). `claimAnalysisJobs` 호출부는 이미 갖고 있는 `input.kinds` 를 그대로 넘기면 되므로 시그니처 변경 폭이 작다. 현재 kinds 는 항상 `['ANALYSIS_STT']` 뿐이라 이 변경으로 기존 동작(어떤 행이 선택되는지)은 전혀 바뀌지 않는다(회귀 없음) — 기존 단위 테스트가 그대로 통과해야 정상.

**판정 요약**: 지적 1 **채택**(Medium) — TOCTOU 경합 코드로 확인, 완료 기준 8 실측은 통과했으나 구조적으로 남아 있어 다음 Developer 라운드에서 재검사 로직(락 대신) 추가 권고. 지적 2 **채택**(Low) — 코드 일치 확인, 오늘 실피해 0(경로 자체가 없음)이나 `lockQueued` 와 동일한 kind 필터를 세 곳에 맞추는 저비용 방어 조치로 권고. 두 건 모두 오탐 아님, 범위 밖 아님. 프로토콜대로 두 건 모두 채택이므로 Developer 수정 → Reviewer 재순환 대상이나, Critical/High 는 0 이라 현재 REV-033 재검 PASS 판정 자체를 뒤집지는 않는다(운영 반영 전 처리 권고).

### 2026-09-29 06:10 reviewer — Codex C2 수정 재검

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 0 신규) — [04:18] 수정이 지적 1·2 를 실제로 닫았음을 코드 추적 + 독립 재실행으로 확인. 운영 반영 전 남는 결함 없음.

**검증 방법(재현)**: 미러 재동기화 뒤 `tsc --noEmit`(0) · `eslint`(대상 전체 0 에러) · `task012b.test.ts` **32/32 PASS**(신규 4건 포함) · **앱 전체 스위트 753건 — 752 PASS·1 skip**(전체 재실행, Developer 주장과 정확히 일치) · dev venv `speech/worker` pytest **41/41**·`speech/common` pytest **21/21**(이번 라운드 Python 무변경이므로 그대로) · `git diff` 로 `prisma/schema.prisma`·`ecosystem.config.js`·`deploy.yml`·`.env.example`·`speech/speech.config.yml` 무변경 확인.

**① debounce↔claim TOCTOU — 두 겹 방어가 실제로 닫히는지**

두 메커니즘의 담당 범위가 서로 겹치지 않고 상호 보완함을 코드로 확인했다(오탐 소지 없이 직접 추적):

- **(b) 잠금 순서(발화 저장 쪽)**: `store.ts:25-33` 가 `withTransaction(tx => { debounce(tx,...); create(tx,...) })` — 디바운스 UPDATE 를 INSERT 앞으로 옮겼다(`git diff` 로 순서 반전만 확인, 로직 불변). `debounce()`(`db.ts:75-78`)는 `WHERE userId AND kind='ANALYSIS_STT' AND status='QUEUED' AND createdAt>now-5분` 인 기존 잡 행에 **배타 잠금을 거는 UPDATE**다 — 이 UPDATE 가 claim 의 `lockQueued`(`FOR UPDATE SKIP LOCKED`)보다 먼저 그 행에 도달하면, claim 은 그 행을 SKIP LOCKED 로 건너뛴다(대기 없음, 커밋 뒤 값 재조회). 반대로 claim 이 먼저 그 행을 잠그면 debounce 의 UPDATE 는 **그 행에 걸려 블록**됐다가, READ COMMITTED 의 락킹 리드 특성상 claim 커밋 뒤 최신 `status='RUNNING'` 을 보고 매치 없이 지나간다 — 어느 순서든 교착이 아니라 "먼저 잠근 쪽이 이긴다"로 수렴한다(라이브 S2·S3 시나리오와 정확히 일치).
- **(a) claim 재검사**: `jobs.ts:84-101 lockClaimable` 이 `lockQueued` 로 후보를 잠근 **직후**, 같은 트랜잭션에서 `analysisDb.lastUtteranceAt`(`db.ts:135-139`, `tx.utterance.groupBy` — 비잠금 읽기, `since=now-20초`)로 그 사용자의 최근 **커밋된** 발화를 다시 보고 `policy.claimDeferral`(순수 함수, `policy.ts:67-74`)로 판정한다. **이 재검사가 별도로 필요한 이유**를 코드로 확인했다: `store.ts:26` 의 조기 반환(`if (!data.jobs) return prisma.utterance.create(...)`)은 적재 게이트(D-B3 — 워커 생존·모드·connection·오디오)가 실패한 발화는 **디바운스를 아예 타지 않는다** — 즉 사용자가 방금 말했다는 사실(`Utterance.createdAt`)은 있는데 (b)의 잠금 순서 방어가 발동할 UPDATE 자체가 없는 경우가 생긴다. 재검사는 "잡을 만들었는가" 와 무관하게 `Utterance.createdAt` 을 직접 보므로 이 틈을 메운다 — (a)·(b) 가 서로 다른 실패 모드를 담당해 실질적으로 방어 범위가 겹치지 않는다(중복 방어가 아님).
- **격리 수준에서 커밋 전 발화가 안 보이는 경우**: `lastUtteranceAt` 은 READ COMMITTED 의 일반(비잠금) 읽기라 **아직 커밋되지 않은** 동시 발화 트랜잭션은 볼 수 없다 — 이는 코드로 확인된 사실이고 재검사 단독으로는 못 막는다. 그러나 이 경우는 정확히 (b)가 처리하는 경우와 겹친다: 발화 트랜잭션이 커밋 전이라는 것은 아직 진행 중이라는 뜻이고, 그 진행 중인 트랜잭션이 디바운스 단계(순서상 맨 앞)에 있다면 이미 그 잡 행을 잠갔을 것이므로 애초에 claim 의 `lockQueued` 가 SKIP LOCKED 로 건너뛰어 재검사 자체를 타지 않는다(잠글 수 없었던 행은 재검사 대상에 들지 않는다). 남는 순수 잔여 창은 developer 문서와 동일하게 "claim 이 발화 트랜잭션 **시작 전**에 이미 그 행을 잠근" 경우뿐이며, 이는 시간적으로 발화가 아직 존재하지 않았던 시점의 결정이라 어떤 메커니즘으로도 막을 수 없는 논리적 한계(미래를 예측할 수 없음)다. **결론: 두 겹 방어가 서로의 담당 범위를 메워 실질적으로 닫혔다** — 라이브 S1(잡 생성 경로를 안 타는 발화)·S2(디바운스가 행을 먼저 잠금)·S3(claim 이 먼저 잠금, 정상 순서)·S4(무작위 인터리빙 40회, 위반 0) 네 시나리오가 이 세 경우(재검사만 발동·잠금순서만 발동·claim 이 이긴 정상 경우)를 각각 정확히 겨냥하고 있어 커버리지가 이론적 분석과 일치한다.

**② UPDATE-먼저 순서 변경 — 교착·대기 증가 검토**

- **새 교착 경로 없음**: enqueue 트랜잭션이 잠그는 자원은 여전히 "이 사용자의 기존 QUEUED `SpeechJob` 행"뿐이고(새로 INSERT 하는 행은 아직 존재하지 않아 경합 대상이 아니다), claim 은 `lockQueued` 에서 **항상 SKIP LOCKED**(비블로킹)만 쓴다 — claim 쪽이 SpeechJob 행을 두고 "기다리는" 경로 자체가 없으므로 (enqueue → claim) 방향의 대기가 (claim → enqueue) 방향의 대기를 만들어 순환하는 고전적 교착 조건이 성립하지 않는다. `recoverOrphans`(`failOrphan` 이 Job→Utterance 순서로 잠금)와 `#138`(Utterance→Job 순서)의 교차 가능성은 **이번 라운드 변경 대상이 아니고**(이미 REV-033 에서 검토 완료, `withTransaction` 의 P2034 재시도로 흡수됨), 이번 순서 반전은 그 조합에 새 경우의 수를 추가하지 않는다(둘 다 SpeechJob·Utterance 두 테이블만 쓰고, enqueue 는 Utterance 를 잠그지 않는다).
- **대화 경로 지연**: 무경합(일반) 경로에서는 UPDATE 먼저든 INSERT 먼저든 같은 두 문장을 실행하므로 총 지연에 차이가 없다. 경합 경로(클레임이 같은 행을 두고 겹치는 드문 경우)에서도 "언젠가 기다려야 한다"는 사실 자체는 순서를 바꾸기 전에도 있었다(원래 코드도 INSERT 뒤 UPDATE 가 결국 그 행을 두고 경합했을 것) — 순서를 앞당긴 것은 "기다릴지 여부"를 더 일찍 확정할 뿐 총 대기 시간의 기댓값을 늘리지 않는다. 라이브 S2 가 `claimMs < 3_000` 로 실측(대기 없음, 9ms)까지 확인했다.

**③ 3라운드 루프가 claim 트랜잭션을 길게 잡지 않는지**

- `CLAIM_ROUNDS=3`, `max` 는 1~2 로 검증됨(`parseClaimBody`, 변경 없음) — 라운드마다 `lockQueued`+`lastUtteranceAt` 각 1회, 한도 `input.max - picked.length` 로 매 라운드 남은 필요분만 요청해 총 잠금 후보 수는 `max` 를 넘지 않는다(`jobs.ts:86-99` 코드 확인). 종료 조건이 세 개(라운드 소진·후보 없음·`deferred===0`)라 무한 루프 불가능은 코드 구조상 자명하다(정적 상한).
- **다만 새로 확인한 부수 효과**: 라운드에서 미룬(`deferQueued`) 행도 **이 트랜잭션이 커밋할 때까지 잠금을 유지**한다(`deferQueued` 는 같은 트랜잭션의 UPDATE 일 뿐 잠금을 풀지 않는다) — 따라서 최악의 경우(3라운드 모두 다른 사용자들의 행을 잠갔다가 미루는 경우) 이 claim 트랜잭션은 커밋 시점까지 최대 `3×max`(=6) 개의 `SpeechJob` 행을 쥐고 있을 수 있고, 그 각각의 소유 사용자가 그 사이 새 발화를 저장하면 **그 사용자의 디바운스 UPDATE 가 이 claim 트랜잭션이 끝날 때까지 대기**한다(다른 claim 은 SKIP LOCKED 라 무해하지만, 발화 저장 경로는 블로킹 대기). `max` 가 작고(1~2) 라운드가 겪는 쿼리 수도 적어(라운드당 왕복 2회) 절대적인 지연 폭은 작을 것으로 보이나, 이는 재검사 도입 이전에는 없던 "여러 사용자의 잡을 한 claim 트랜잭션이 동시에 쥐는" 새로운 성격의 대기 확산 경로다 — Critical/High 는 아니되(사용자 수가 적은 현재 QA 규모에서는 사실상 무해, 라이브 테스트에서도 병목 관측 없음) Developer 관측 대상으로 남긴다(신규 이슈로 세지 않음, 운영 반영 뒤 워커 부하·사용자 수가 늘면 재검토 권고).

**④ 상한 5분(anti-starvation)이 지켜지는지**

- 디바운스(`debounce()`, `db.ts:75-78`)와 재검사(`claimDeferral`, `policy.ts:69`)가 **같은 상수**(`ANALYSIS_DEBOUNCE_CAP_MS`)와 **같은 공식**(`LEAST/min(now+20s, createdAt+5분)`)을 각자 SQL·순수 함수로 구현하고 있음을 확인 — 드리프트 없음. 단위 테스트(`claim 재검사 규칙` 358-365행)가 "만든 지 5분 — 상한, 미루지 않음"·"상한이 더 이르면 상한" 두 경계를 값으로 확인한다.

**⑤ 스모크 `ready()` 의 backdate 가 3g 검증을 가리는지**

`tests/live/task012b-smoke.ts:158-161` 의 `ready()` 는 (1) 이 스모크가 최근 30초 안에 만든 발화를 전부 60초 전으로 backdate (2) 지정한 `utteranceIds` 의 잡 `runAfter` 를 과거로 당긴다. **3g(266-277행)를 줄 단위로 추적**: `ready(uG)` 호출 시점에는 `fresh`(새 발화)가 **아직 만들어지지 않았다**(`ready()` 다음 줄에서야 `prisma.utterance.create` 로 생성) — `ready()` 의 첫 번째 동작(backdate)은 호출 시점에 `createdUtterances` 집합에 들어 있는 것만 건드리므로 `fresh` 는 대상이 아니고, `fresh` 는 `createdUtterances` 에 그 뒤에 추가된다(다음 `ready()` 호출 전까지 backdate 되지 않는다). 따라서 claim 호출 시점에 `fresh.createdAt = tNew`(방금, 미backdate) 그대로이고, 이 값이 재검사가 보는 "최근 발화"로 정확히 작동해 3g 의 판정식(`jG.runAfter ≈ tNew+20초`)이 재검사 로직을 실제로 겨냥한다 — **backdate 가 3g 검증을 가리지 않음을 코드로 확인**. 부가로 `fresh` 는 `prisma.utterance.create` 를 **직접** 호출(== `utteranceDb.create` 우회, `jobs` 중첩 없음)해 D-B3 게이트 실패 시나리오(방어 (a)만 발동)를 정확히 흉내 낸다. 3h 는 반대로 정상 업로드 경로(`upload()` → `utteranceDb.create`, 방어 (b) 발동)로 같은 옛 잡이 다시 밀리는지 봐 두 방어를 독립적으로 검증한다 — 설계가 의도와 일치.

**②(kind 필터) 재확인** — `hasClaimable`(`db.ts:81-89`)이 `kind:{in:kinds}` 를 최상위 AND 로 옮겨 `OR` 세 분기(QUEUED·RUNNING 두 갈래) 전부에 적용됨을 확인(이전엔 QUEUED 분기에만 있었다) · `orphans`·`ownStale` 모두 `kinds` 파라미터를 받아 `where` 에 반영 · `recoverOrphans`(`jobs.ts:44-49`)가 `kinds` 를 받아 두 호출에 전달 · `claimAnalysisJobs` 호출부가 `input.kinds` 를 그대로 넘김. 단위 테스트("claim 지적 2")가 `hasClaimable`·`orphans`·`ownStale` 세 곳 모두에 전달된 `kinds` 값을 직접 캡처해 `['ANALYSIS_STT']` 로 전달됨을 확인한다. 오늘 `kinds` 가 항상 `['ANALYSIS_STT']` 뿐이라 기존 동작 변화 없음(회귀 없음, 전체 스위트 재통과로 재확인).

**요약**: 지적 1·2 모두 근본 수정 확인, Critical/High/Medium/Low 신규 없음. ③에서 관측한 "여러 사용자 잡을 한 claim 트랜잭션이 동시에 쥐는" 대기 확산 경로는 결함이 아니라 향후 부하 증가 시 관측 대상으로만 기록(별도 이슈 번호 부여 없음). QA 진행 가능.

## QA 기록

## 배포 기록

## 최종 요약

### 2026-09-29 02:25 Leader(메인) — D-B8 수정: 사용자별 디바운스
- 근거(developer [02:15] 실측): 워커 2 + 30초 발화 부하에서 첫 음성 p50 2,036→2,888ms(+42%)·done +18%. LLM 단계는 불변, 늘어난 곳은 앱 DB 쓰기·캐시(ACCEPT·SAVE·TTS[0] HIT) — 분석 전사의 CPU 점유(+33%)와 NAS DB 커밋 겹침. 완료 기준 8(≤10%) 미달.
- 결정: **(b) 사용자별 디바운스** — 새 발화가 오면 그 사용자의 QUEUED 분석 잡 `runAfter` = 마지막 발화 +20초(RUNNING 불변), **상한 첫 발화 +5분**(끝없는 대화에서 분석이 영원히 밀리지 않게). 워커 기본 동시 처리 1. 재측정은 운영 모드(next build+start)로 (i) 연속 30턴 워커 있음/없음 ≤10% (ii) 대화 멈춤 뒤 마지막 발화→ANALYZED 시간 p50/max. 012b-2 확인 카드는 대화가 멈춘 뒤 뜨는 것으로 설계(데모 때 반영). D-B7 채점은 원래 분석을 기다리지 않으므로 영향 없음(대화 직후 제출이면 실시간 텍스트).
- (a) 단독·(c) 고정 +12초는 연속 대화와 여전히 겹쳐 기각.

### 2026-09-29 03:30 Leader(메인) — ⑤·⑫ 판단
- **⑤ 채택(현행 유지)**: `AppSetting speech.review.threshold` 는 지금 운영 행 없음 → 코드 그대로. 012c 에서 이 키 편집을 열 때 규칙은 **ACCURATE = max(설정값, 0.90)**(다른 모드는 설정값) — 012c 편집 키 표에 반영.
- **⑫ 서버 차단**: #138 저장 시점에 `finalSource=USER` 면 `requiresReview=false` 로 저장(#21a 는 409 NOT_REVIEWABLE). 학습자가 직접 고친 텍스트를 카드가 덮어쓸 여지를 화면 규칙에만 맡기지 않는다. 품질 지표는 저장된 `transcriptConfidence` 와 `engineVersions.reviewThreshold` 로 계산 가능하므로 손실 없음. REV-033 지적 수정과 같은 라운드에 developer 가 반영, 정본(#21a 끝·domain-model §5-9)의 "대기" 표기는 이 결정으로 교체.
- 인프라 후보(사용자 승인 필요, sudo): nginx `location /api/internal/ { return 404; }` — 사용자 대기 목록에 추가.

### [2026-09-29 03:47] C2 adversarial-review focus=concurrency — 지적 2건(medium 1·low 1)
- judge 판정: codex_required=true / mode=adversarial-review / focus=concurrency / budget_rule=CX-limit-unknown-r2 / 호출 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa · base=dd9bd94(task_file) · snapshot=ea20c5a (미커밋 코드 포함)
- 검토 시간: 95초 · exit_code=0

#### 지적 1: [Medium] src/modules/speech/analysis/db.ts:69 — debounce와 claim 경합
- **조건**: 기존 QUEUED 잡의 runAfter가 도래하는 순간, 같은 사용자의 새 발화 저장 트랜잭션과 worker claim 트랜잭션이 동시에 실행될 때
- **증거**: 새 발화 트랜잭션은 발화와 잡을 생성 뒤 기존 QUEUED 잡을 UPDATE하지만, claim이 먼저 `FOR UPDATE SKIP LOCKED`로 기존 잡을 잠그고 RUNNING으로 바꿀 수 있다. debounce UPDATE는 잠금 해제 후 재평가되며 `status='QUEUED'` 조건에서 해당 잡을 제외한다. **공통 사용자 잠금이나 claim 직전 최신 발화 재검사가 없다.** 동시에 생성되는 두 발화 트랜잭션도 READ COMMITTED에서 서로의 미커밋 잡을 보지 못해 각자 자기 잡만 연장할 수 있다.
- **영향**: 대화가 계속되는 중에도 분석 잡이 조기 실행되어 **의도한 사용자별 20초 정지 구간이 보장되지 않는다.** 공유 Whisper 직렬 자원을 점유해 다른 분석을 지연시키고 디바운스 부하 제어가 입력 요청 타이밍에 따라 **비결정적으로 동작**.
- **권고**: 발화 적재의 debounce와 claim이 동일한 **사용자별 직렬화 잠금을 공유**하게 하라. 예를 들어 (a) 사용자 행을 잠근 뒤 debounce 하고, (b) claim도 후보 잡의 사용자 행을 잠근 후 runAfter와 **최신 발화 시각을 다시 확인**해야 한다. 실제 MariaDB 두 연결로 claim-vs-enqueue 및 enqueue-vs-enqueue 경합 테스트를 추가하라.

#### 지적 2: [Low] src/modules/speech/analysis/db.ts:84 — kind 필터 누락 (고아 회수·self-reclaim)
- **조건**: ANALYSIS_STT만 요청한 worker가 존재하는 동안, PRONUNCIATION 종류의 RUNNING 잡이 15분 이상 stale 상태가 되거나 동일 workerId로 잠겨 있을 때
- **증례**: `lockQueued`는 요청받은 kinds로 제한하지만 `hasClaimable`의 RUNNING 분기, `orphans`, `ownStale`에는 **kind 조건이 없다.** 스키마의 SpeechJobKind에는 ANALYSIS_STT와 PRONUNCIATION이 모두 존재하므로 ANALYSIS_STT claim 호출이 다른 종류 잡을 requeue 또는 fail하고 attempts 한도에 따라 연결된 Utterance까지 FAILED로 바꿀 수 있다.
- **영향**: 서로 다른 잡 처리기의 수명주기가 결합되어 향후 발음 분석 worker가 **아직 처리 중인 잡을 분석 STT worker가 회수하거나 실패**시킬 수 있다. 두 종류 worker가 동시에 운영되면 불필요한 재처리와 상태 오염.
- **권고**: `hasClaimable`, `orphans`, `ownStale`과 조건부 회수 UPDATE 모두에 **요청 kinds 조건을 전달**해 적용하라. 회수 직전에도 kind를 WHERE 절에서 다시 검증하고 **서로 다른 worker 종류가 동시에 claim하는 통합 테스트**를 추가하라.

**검토하지 못한 범위**:
- 테스트 실행 (READ-ONLY 제약상 캐시·산출물 생성 불가)
- 대규모 문서·콘솔·LLM 변경 (요청 범위 밖)
- 실제 MariaDB 다중 연결 잠금 순서·격리 수준 재현 테스트

**원본**: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260928T184838Z-task-012b-C2

**요약**: SKIP LOCKED와 결과 저장·실패 보고 간 펜싱은 트랜잭션 충돌 후 상태 재검사로 대체로 일관성을 유지하며, #21a 확정과 #138 저장도 Utterance 행 잠금 및 조건부 UPDATE로 덮어쓰기 경로가 보이지 않았다. 다만 **발화 디바운스와 claim 사이에 공통 사용자 잠금이 없어** 새 발화와 동시에 기존 잡이 조기 선점될 수 있고, **고아 회수 쿼리가 요청 kind를 제한하지 않아** 다른 음성 잡 종류의 상태를 변경할 수 있다.

---

다음: Reviewer가 Codex 지적(Medium 1·Low 1) 채택·오탐 판정

### 2026-09-29 06:50 Leader(메인) — QA(Leader 직접 실행) PASS
- 격리: 미러 하드링크 복제본(`~/.node-local/thekaiwa-qa-012b-*`, 작업 트리 = HEAD `4a052f1` + 012b 미커밋), **운영 모드**(`next build` → `env -i … next start -H 127.0.0.1 -p 3011`). tsc 0 · build ok · 단위 **752/753(1 skip)** · health = LOCAL degraded[`stt_analysis_worker`](워커 없음 — 정상).
- 012b 스모크 `EXPECT_NO_WORKER=1 … 3011 ABC`: PASS 61 · FAIL 1(3b) → **원인 = health 요약 60초 캐시**(`admin/health.ts` CACHE_MS — Leader 가 기동 확인용으로 스모크 시작 1분 안에 /api/health 를 불러 false 가 캐시됨, 코드 결함 아님). 60초 넘긴 뒤 A 단계 재실행 **55/55**(3b PASS). B(실제 워커 2개·stt20)·C(분석 서비스 실패 백오프·AUDIO_MISSING) PASS. 교훈: 3b 앞 60초 안에 health 를 부르지 않는다(스모크 설명에 추가 후보).
- 경합 `task012b-race.ts 20` **4/4**(S4 무작위 20회 위반 0·오류 0).
- 회귀(같은 서버): **006 42/42(턴 p50 4.5s) · 007 44/44 · 010 65/65 · 011 60/60**.
- **판정: task-012b 1단계 QA PASS** → 커밋·push(운영 배포). 운영에서는 워커 미등록(U1·U2 대기)이라 적재 0·health `stt_analysis_worker` degraded 만 — 사용자 체감 변화 없음(#22·#21a API·D-B7 텍스트 선택은 분석 결과가 없으니 실시간 텍스트 그대로).
