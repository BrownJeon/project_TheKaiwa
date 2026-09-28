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

## Reviewer 기록

## QA 기록

## 배포 기록

## 최종 요약
