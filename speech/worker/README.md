# speech/worker — SpeechJob 소비 워커 (골격)

> 상태: 설계 골격. 구현 task-012b(음성 P2: 분석 STT·Ensemble·requiresReview)·task-015b(음성 P3: Pronunciation). 우분투 pm2 `thekaiwa-speech-worker`, 바인드 없음. 공용 패키지 [`../common/README.md`](../common/README.md). 콜백 계약 정본: [`docs/design/api-contract.md`](../../docs/design/api-contract.md) §2-28(#138~#140)·§2-30(잡 루프).
>
> **task-012b C1 확정(2026-09-28)** — 워커는 **DB 에 접속하지 않는다**(D-B1). 잡 클레임·실패 보고·결과 저장은 전부 앱 내부 HTTP(#139·#140·#138)이고, 잠금·고아 회수·백오프·환경 필터는 앱이 한다. 포트도 열지 않는다(D-B4 — 생존은 claim 하트비트). 아래 §2·§4·§6 은 이 결정으로 고친 것이다.

## 1. 역할

실시간 경로(대화)와 **완전히 분리된** 비동기 분석 경로(음성 기획안 §17). 대화 LLM 은 항상 실시간 텍스트로 먼저 응답했고, 워커는 나중에 정밀 전사·비교·발음 분석 결과를 앱에 되돌려 교정 카드를 갱신한다. 워커가 느려도 대화 지연은 늘지 않는다.

```
Utterance(QUEUED) + SpeechJob(QUEUED)            ← 앱이 발화 저장과 같은 트랜잭션에 적재(워커 생존 게이트)
        │ POST /api/internal/speech/jobs/claim (#139 — 앱이 FOR UPDATE SKIP LOCKED)
        ▼
  ANALYSIS_STT : wav 읽기 → WhisperEngine.transcribe → TranscriptComparator(realtimeText vs analysisText)
                 → POST /api/internal/speech/utterances/:id/analysis {analysisText, comparator{similarity, flags}, …}   (#138 — requiresReview 판정은 앱)
                 실패 → POST /api/internal/speech/jobs/:id/result {FAILED, error, retryable}                           (#140)
  PRONUNCIATION: (Phase 3) finalText 확정된 Utterance 만 → PronunciationAnalyzer → 같은 콜백에 pronunciation 블록
        │
        ▼
  SpeechJob DONE | FAILED(attempts ≥ 3)
```

## 2. 잡 루프

```
speech/worker/
├── main.py            # 루프: claim(#139) → dispatch(kind) → #138 | #140, 종료 신호 처리(SIGTERM 시 현재 잡 마무리)
├── handlers/
│   ├── analysis_stt.py      # ANALYSIS_STT
│   └── pronunciation.py     # PRONUNCIATION (Phase 3, worker.pronunciation.enabled)
├── comparator.py      # TranscriptComparator (+ ReadingProvider — pyopenjtalk)
├── pronunciation/     # Phase 3: aligner(narabas) · expected(pyopenjtalk) · pitch(pyworld) · scorer
├── requirements.txt   # worker 전용 추가분만: pyopenjtalk (Phase 3 에 narabas·pyworld·librosa). httpx·PyYAML 등은 gateway requirements 에 이미 있다. DB 드라이버 없음
└── tests/
```

- **클레임(task-012b D-B1)**: `InternalClient.claim_jobs(worker_id, kinds, max=1)` → `POST /api/internal/speech/jobs/claim`. 응답 잡에 `audioPath`(`DATA_ROOT` 상대)·`realtimeText`·`recognitionMode`·`attempts` 가 실려 온다 — 워커는 `SpeechJob`·`Utterance` 어느 테이블도 읽지 않는다. 잠금(`FOR UPDATE SKIP LOCKED`)·고아 회수(`lockedAt` 15분↑ → `QUEUED`)·비운영 앱의 QA 계정 필터(D-B11)는 앱이 claim 안에서 한다. 워커를 2개 띄워도 같은 잡을 두 번 잡지 않는다(앱 잠금).
- 간격 2초, 빈 응답이면 백오프 최대 10초(앱의 적재 게이트 120초 안에 반드시 한 번 claim 하도록). `max=1`(직렬 원칙 — 분석 STT 서비스가 전역 잠금으로 직렬이고 VoiceVault 와 공용이라 겹쳐도 빨라지지 않는다).
- **실패(D-B10)**: `InternalClient.report_failure(job_id, worker_id, error=<코드값>, retryable)` → `POST …/jobs/:id/result`. 앱이 `retryable && attempts < 3` 이면 `QUEUED`(`runAfter` +30초·2분·10분), 아니면 `FAILED` + `Utterance.status=FAILED`. 재시도 대상 = 분석 서비스 연결 실패·503·타임아웃·앱 콜백 5xx. 즉시 실패 = `AUDIO_MISSING`·`EMPTY_TRANSCRIPTS`·분석 서비스 4xx. `409 STALE_CLAIM`(회수된 잡)은 무시한다. 에러 문자열에 전사·경로·시크릿을 싣지 않는다.
- **기동 점검**: 읽기 변환기(pyopenjtalk import·사전 로드)가 안 되면 claim 하지 않고 오류 로그만 남기며 대기한다(앱은 하트비트가 없으니 적재를 멈추고 health 는 degraded).
- 오디오 읽기: claim 응답의 `audioPath` 를 워커 `DATA_ROOT` 에 붙여 연다. 절대경로·`..`·`DATA_ROOT` 밖·파일 없음은 열지 않고 `AUDIO_MISSING`(재시도 없음).
- 헤더: `X-Internal-Secret`·`X-Service: worker`·`X-Service-Env: <APP_ENV>`·`X-Trace-Id`(`InternalClient` 의 `X-Service` 는 호출 서비스로 파라미터화 — gateway 는 계속 `gateway`).
- 워커에 `whisper`·`narabas` 문자열이 있는 곳은 `common/engine/adapters/**` 와 `pronunciation/` 뿐이다. 핸들러는 `router.resolve('ANALYSIS_STT')` 로 엔진을 받는다.
- 로그: 전사 원문 0 — 길이·`sha1[:8]`·코드값만.
- **의존성 설치(D-B2)**: 운영 venv(`~/.node-local/thekaiwa-speech/venv`, gateway 와 공유·릴리스 밖)에 `requirements.txt` 를 설치하는 것은 **사용자 승인(U2)** — 개발·테스트는 별도 dev venv `~/.node-local/thekaiwa-speech-dev`(gateway requirements + 이 파일)에서만 한다.

## 3. WhisperEngine

- `mode=http`(기본): VoiceVault whisper-service `POST http://127.0.0.1:8090/transcribe-chunk`(multipart `file=chunk.wav`, `language=ja`) — VoiceVault `src/lib/whisper/client.ts:250 transcribeChunk` 와 같은 호출. medium int8 CPU, 30초 클립 ≈11초 실측. 응답 세그먼트를 `TranscriptionResult.segments` 로 정규화.
- `mode=local`: faster-whisper 를 워커 프로세스에 직접 로드(`large-v3-turbo` 후보). 정확도가 부족하다고 판정될 때만 전환(`speech.config.yml stt.validation.mode`, RESTART_REQUIRED). 메모리 상한 `max_memory_restart` 재산정 필요.
- 타임아웃 `stt.validation.timeout_ms`(60s). 503(모델 미로드)은 재시도 대상, 4xx 는 즉시 FAILED.

## 4. TranscriptComparator 규칙 (음성 기획안 §8 Transcript Ensemble)

입력: `realtimeText`(ReazonSpeech, 온디바이스 또는 gateway), `analysisText`(whisper). 출력: `similarity ∈ [0,1]`, `flags ⊆ {LENGTH_RATIO, ANALYSIS_EMPTY, REALTIME_EMPTY}`, 길이 2개. **`requiresReview` 는 워커가 아니라 앱이 판정한다**(task-012b C1 — 임계는 사용자 모드·AppSetting 에 달린 앱 정책). 정규화 문자열은 앱에 보내지 않는다(전사 사본 — 로컬 디버그 로그에도 남기지 않는다).

```
normalize(s):
  1. unicodedata.normalize('NFKC', s)            # 전각/반각·합성문자 통일
  2. 구두점·기호·공백 제거: 、。！？!?,.…・「」『』（）()〜~ 및 \s
  3. 가나 접기(kana_fold):
       a. 카타카나 → 히라가나 (U+30A1–U+30F6 → −0x60)
       b. 한자 → 읽기: pyopenjtalk.g2p(text, kana=True) 로 전체를 가나열로 — **task-012b D-B2 확정: pyopenjtalk**(worker 전용 requirements; 운영 venv 설치는 사용자 승인 U2, 개발은 dev venv). `ReadingProvider` 인터페이스 뒤에 두고, 없으면 워커가 claim 하지 않는다(§2 기동 점검)
       c. 장음 기호 'ー' 는 앞 모음으로 치환하지 않고 그대로 둔다(長音 오류는 발음 분석의 몫)
  4. 소문자화는 불필요(가나열)

similarity(a, b):
  d = levenshtein(normalize(a), normalize(b))    # 문자 단위 편집거리
  return 1 - d / max(len(a'), len(b'), 1)

similarity = similarity(realtimeText, analysisText)          # 워커 → #138 comparator.similarity
# 아래는 앱(#138 applyAnalysisResult)이 한다 — 참고용
transcriptConfidence = similarity
threshold = 0.90 if recognitionMode == 'ACCURATE' else 0.85   # AppSetting speech.review.threshold 가 있으면 그 값
requiresReview = transcriptConfidence < threshold or len(flags) > 0
```

엣지 규칙(워커는 flag 로 알리고, 앱이 `requiresReview=true` 로 판정):
- `analysisText` 가 비었고 `realtimeText` 가 있음 → `similarity=0`, flag `ANALYSIS_EMPTY`(whisper 가 놓쳤거나 잡음).
- 둘 다 비었음 → #138 을 부르지 않고 #140 `FAILED EMPTY_TRANSCRIPTS`(재시도 없음) — 앱은 `Utterance.status=FAILED`, 카드 대상 아님.
- `realtimeText` 가 비었고 `analysisText` 만 있음(플러그인이 final 없이 wav 만 올린 경우) → `similarity=0`, flag `REALTIME_EMPTY`, 카드는 analysis 안만 제안.
- 길이 차이가 3배 이상이면 flag `LENGTH_RATIO`(한쪽이 문장을 통째로 놓친 경우 — whisper 의 짧은 무음 환각 문장도 여기에 걸리는 경우가 많다).

앱 쪽 처리(정본 api-contract #138·#21a·#22, domain-model §5-9 — task-012b D-B5·D-B6·D-B7): **분석 결과만으로는 `finalText`·`finalSource` 를 바꾸지 않는다**(기본 `REALTIME`). `requiresReview=true` = 학습자 확정 대기 — 카드(012b-2 화면)에서 "이렇게 들렸어요(실시간) / 이렇게도 들렸어요(분석) / 직접 고치기" 중 하나를 고르면 #21a `{choice}` 로 `finalText`·`finalSource = REALTIME|ANALYSIS|USER`(고른 안의 출처) 확정 + `requiresReview=false`(제안 → 채택). 바뀌는 것은 `Utterance` 뿐(채팅 메시지·교정 원문·평가 답 불변). AI평가 말하기 문항은 채점 시작 시점에 확정 텍스트 > 분석 텍스트(재확인 불필요일 때, `SERVER_STT`) > 저장된 답 순으로 쓰고 분석을 기다리지 않는다.

## 5. PronunciationAnalyzer 계획 (Phase 3, `worker.pronunciation.enabled`)

STT ≠ 발음평가(원칙). 강제 정렬 + 기대값 비교로 산출하며 LLM 은 쓰지 않는다.

| 단계 | 도구 | 산출 |
|---|---|---|
| 기대 음소·모라·악센트 | `pyopenjtalk`(텍스트 = `Utterance.finalText`) | 음소열, 모라 경계, 기대 피치 악센트 패턴(HL) |
| 강제 정렬 | `narabas`(wav2vec2-large-lv60k → ReazonSpeech 파인튜닝, MIT) — 입력 오디오 + 음소열 | `(start, end, phoneme)` 시퀀스, CTC logit |
| F0 곡선 | `pyworld`(harvest/dio) 또는 `librosa.pyin` | 프레임별 F0 → 모라별 상대 피치 |
| 채점 | `scorer.py` | `wordScores[{surface, score0-5, issues[]}]`, `mora{expected, observed, ratio}`, `pitch{expected, observed, match}`, 유창성(속도·포즈), 長音/促音/撥音 판정(모라 길이비), GOP(CTC logit 기반 오발음 후보) |
| 피드백 | 코드 템플릿(한국어 한 줄) | `feedbackKo` — 화면 = 단어별 ★5 + 한 줄(기획안 §16) |

- 결과는 콜백 `pronunciation` 블록으로 앱에 전달 → `SpeechAnalysis`(`pronunciationScore·fluencyScore·wordScores·mora·pitch·feedbackKo·engineVersions`). 워커는 테이블을 쓰지 않는다.
- 게이트: 음성 P2 의 `transcriptConfidence` 분포가 안정된 뒤(≥0.85 비율 실측)에만 켠다. `requiresReview=true` 인 발화는 학습자가 텍스트를 고를 때까지 발음 잡을 만들지 않는다(`finalText` 확정 시 앱이 enqueue).
- 의존성이 무겁다(torch). `mode=local whisper` 와 같은 프로세스에 두지 않고 `worker.kinds` 로 분리 기동 가능(`thekaiwa-speech-worker-pron`)하게 설계한다.

## 6. 앱 콜백 (worker → 앱)

| 호출 | 본문 요지 | 앱 처리 |
|---|---|---|
| `POST /api/internal/speech/jobs/claim` (#139) | `{workerId, kinds, max:1}` | 고아 회수·`FOR UPDATE SKIP LOCKED`·환경 필터·하트비트 → `{jobs:[{id, kind, utteranceId, audioPath, realtimeText, recognitionMode, attempts}]}` |
| `POST /api/internal/speech/utterances/:id/analysis` (#138) | `{jobId, workerId, analysisEngine, analysisText, segments, language, latencyMs, comparator{similarity, flags, realtimeLen, analysisLen, version}, engineVersions, traceId, pronunciation?}` | `speech.applyAnalysisResult` → 한 트랜잭션(`Utterance`·`SpeechAnalysis`·`SpeechJob DONE`, `requiresReview` 판정) → (Phase 3) `learning.recordErrorStat` → `200 {stored, …}` · 이미 분석됨 `200 {stored:false}` |
| `POST /api/internal/speech/jobs/:id/result` (#140) | `{workerId, status:'FAILED', error, retryable}` | 백오프 재적재 또는 확정 실패(+`Utterance FAILED`) · 회수된 잡 `409 STALE_CLAIM` |

~~`GET /api/internal/speech/utterances/{id}`~~ 는 만들지 않는다(claim 응답이 필요한 값을 준다 — task-012b D-B1). 헤더 `X-Internal-Secret: <SPEECH_INTERNAL_SECRET>`(SecretResolver 로 해석)·`X-Service: worker`·`X-Service-Env`, 타임아웃 5s, 연결 오류·5xx 1회 재시도. #138 이 계속 실패하면 #140 `retryable` 로 보고해 잡을 `QUEUED` 로 되돌린다(결과는 재계산되지만 #138 이 멱등).

## 7. 실측·검증 항목 (task-012b)

- 워커 2개 동시 기동 시 같은 잡 중복 처리 0건(`attempts` 대조).
- 30초 발화 분석 왕복(클레임 → #138 200) p50/p95, 대화 턴 p50 이 워커 유무와 무관함을 30턴 비교로 증명.
- 정규화 단위 테스트: 「こんにちは。」 vs 「コンニチワ」 → 히라가나 접기 후 유사도, 한자 표기 차이(「今日」vs「きょう」) 가 페널티 없이 1.0.
- 로그에 전사 전문 없음(길이·sha1[:8] 만).
