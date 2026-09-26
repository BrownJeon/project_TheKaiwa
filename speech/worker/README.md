# speech/worker — SpeechJob 소비 워커 (골격)

> 상태: 설계 골격. 구현 task-012b(음성 P2: 분석 STT·Ensemble·requiresReview)·task-015b(음성 P3: Pronunciation). 우분투 pm2 `thekaiwa-speech-worker`, 바인드 없음. 공용 패키지 [`../common/README.md`](../common/README.md). 콜백 계약 정본: [`docs/design/api-contract.md`](../../docs/design/api-contract.md) "내부 API".

## 1. 역할

실시간 경로(대화)와 **완전히 분리된** 비동기 분석 경로(음성 기획안 §17). 대화 LLM 은 항상 실시간 텍스트로 먼저 응답했고, 워커는 나중에 정밀 전사·비교·발음 분석 결과를 앱에 되돌려 교정 카드를 갱신한다. 워커가 느려도 대화 지연은 늘지 않는다.

```
Utterance(RECORDED) + SpeechJob(QUEUED)
        │ 폴링(FOR UPDATE SKIP LOCKED)
        ▼
  ANALYSIS_STT : wav 읽기 → WhisperEngine.transcribe → TranscriptComparator(realtimeText vs analysisText)
                 → POST /api/internal/speech/utterances/:id/analysis {analysisText, transcriptConfidence, requiresReview, …}
  PRONUNCIATION: (Phase 3) finalText 확정된 Utterance 만 → PronunciationAnalyzer → 같은 콜백에 pronunciation 블록
        │
        ▼
  SpeechJob DONE | FAILED(attempts ≥ 3)
```

## 2. 잡 루프

```
speech/worker/
├── main.py            # 루프: claim → dispatch(kind) → callback → complete/fail, 종료 신호 처리(SIGTERM 시 현재 잡 마무리)
├── handlers/
│   ├── analysis_stt.py      # ANALYSIS_STT
│   └── pronunciation.py     # PRONUNCIATION (Phase 3, worker.pronunciation.enabled)
├── comparator.py      # TranscriptComparator
├── pronunciation/     # Phase 3: aligner(narabas) · expected(pyopenjtalk) · pitch(pyworld) · scorer
├── requirements.txt   # kaiwa-speech-common(-e ../common), httpx, sqlalchemy, pymysql, (Phase 3) narabas, pyopenjtalk, pyworld, librosa
└── tests/
```

- 클레임: `kaiwa_speech_common.db.claim_next_speech_job(kinds=worker.kinds)` — 한 트랜잭션에서 `SELECT … WHERE status='QUEUED' ORDER BY createdAt LIMIT 1 FOR UPDATE SKIP LOCKED` → `UPDATE status='RUNNING', attempts=attempts+1`. 워커를 2개 띄워도 같은 잡을 두 번 잡지 않는다.
- 간격 `worker.poll_interval_ms`(1000), 유휴 시 백오프 최대 5s. `batch_size=1`(직렬 원칙 — CPU 워커가 겹치면 전체가 느려진다).
- 실패: 예외 → `FAILED` 로 두지 않고 `QUEUED` 로 되돌리되 `attempts ≥ worker.max_attempts(3)` 이면 `FAILED(error ≤300자)`. 재시도 간 대기 `2^attempts` 초.
- 기동 시 `RUNNING` 이 `worker.stale_after_sec`(900) 을 넘긴 행을 `QUEUED` 로 복귀(앞 프로세스가 죽은 잡). `Utterance.status` 는 앱이 콜백에서 바꾼다(`QUEUED → ANALYZED | FAILED`).
- 오디오 읽기: `Utterance.audioPath` 는 앱 콜백 응답이 아니라 **잡 행의 `utteranceId` 로 앱에 `GET /api/internal/speech/utterances/{id}` 를 물어** 경로·realtimeText·recognitionMode 를 받는다(워커는 `Utterance` 테이블을 읽지 않는다 — 소유 층 규칙). 경로는 `DATA_ROOT` 아래인지 검증 후 연다.
- 워커에 `whisper`·`narabas` 문자열이 있는 곳은 `common/engine/adapters/**` 와 `pronunciation/` 뿐이다. 핸들러는 `router.resolve('ANALYSIS_STT')` 로 엔진을 받는다.

## 3. WhisperEngine

- `mode=http`(기본): VoiceVault whisper-service `POST http://127.0.0.1:8090/transcribe-chunk`(multipart `file=chunk.wav`, `language=ja`) — VoiceVault `src/lib/whisper/client.ts:250 transcribeChunk` 와 같은 호출. medium int8 CPU, 30초 클립 ≈11초 실측. 응답 세그먼트를 `TranscriptionResult.segments` 로 정규화.
- `mode=local`: faster-whisper 를 워커 프로세스에 직접 로드(`large-v3-turbo` 후보). 정확도가 부족하다고 판정될 때만 전환(`speech.config.yml stt.validation.mode`, RESTART_REQUIRED). 메모리 상한 `max_memory_restart` 재산정 필요.
- 타임아웃 `stt.validation.timeout_ms`(60s). 503(모델 미로드)은 재시도 대상, 4xx 는 즉시 FAILED.

## 4. TranscriptComparator 규칙 (음성 기획안 §8 Transcript Ensemble)

입력: `realtimeText`(ReazonSpeech, 온디바이스 또는 gateway), `analysisText`(whisper). 출력: `transcriptConfidence ∈ [0,1]`, `requiresReview: bool`, `normalized: {realtime, analysis}`(디버그 세션에서만 반환).

```
normalize(s):
  1. unicodedata.normalize('NFKC', s)            # 전각/반각·합성문자 통일
  2. 구두점·기호·공백 제거: 、。！？!?,.…・「」『』（）()〜~ 및 \s
  3. 가나 접기(kana_fold):
       a. 카타카나 → 히라가나 (U+30A1–U+30F6 → −0x60)
       b. 한자 → 읽기: pyopenjtalk.g2p(text, kana=True) 로 전체를 가나열로 (미결: pykakasi 대안)
       c. 장음 기호 'ー' 는 앞 모음으로 치환하지 않고 그대로 둔다(長音 오류는 발음 분석의 몫)
  4. 소문자화는 불필요(가나열)

similarity(a, b):
  d = levenshtein(normalize(a), normalize(b))    # 문자 단위 편집거리
  return 1 - d / max(len(a'), len(b'), 1)

transcriptConfidence = similarity(realtimeText, analysisText)
threshold = ensemble.accurate_mode_threshold(0.90) if recognitionMode == 'ACCURATE' else ensemble.review_threshold(0.85)
requiresReview = transcriptConfidence < threshold
```

엣지 규칙:
- `analysisText` 가 비었고 `realtimeText` 가 있음 → `confidence=0`, `requiresReview=true`(whisper 가 놓쳤거나 잡음).
- 둘 다 비었음 → 잡 `FAILED("empty transcripts")`, 앱은 `Utterance.status=FAILED` 로 두고 카드에 표시하지 않는다.
- `realtimeText` 가 비었고 `analysisText` 만 있음(플러그인이 final 없이 wav 만 올린 경우) → `confidence=0`, `requiresReview=true`, 카드는 analysis 안만 제안.
- 길이 차이가 3배 이상이면 유사도와 무관하게 `requiresReview=true`(한쪽이 문장을 통째로 놓친 경우).

앱 쪽 처리(정본은 speech 모듈·api-contract): `requiresReview=true` 면 교정 카드에 "인식이 불확실해요 — 이렇게 들렸어요(실시간) / 이렇게도 들렸어요(분석)" 2안을 보여 주고 학습자가 고르면 `finalText`·`finalSource(REALTIME|ANALYSIS|USER)` 확정(제안 → 채택 원칙). `false` 면 `finalText=realtimeText`, `finalSource=REALTIME` 자동. AI평가 말하기 문항은 분석 텍스트를 우선 쓴다(음성 P2 ↔ 앱 Phase 2).

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
| `GET /api/internal/speech/utterances/{id}` | — | `{audioPath, realtimeText, recognitionMode, finalText?, userId}` |
| `POST /api/internal/speech/utterances/:id/analysis` | `{jobId, utteranceId, kind, analysisEngine, connectionId, analysisText, transcriptConfidence, requiresReview, engineVersions, timings, traceSteps, pronunciation?}` | `speech.applyAnalysisResult` → `Utterance`·`SpeechAnalysis` 갱신 → `learning.recordErrorStat` → 204 |

헤더 `X-Internal-Secret: <SPEECH_INTERNAL_SECRET>`(SecretResolver 로 해석), 타임아웃 5s, 1회 재시도. 콜백이 계속 실패하면 잡은 `QUEUED` 로 되돌린다(결과는 재계산되지만 멱등).

## 7. 실측·검증 항목 (task-012b)

- 워커 2개 동시 기동 시 같은 잡 중복 처리 0건(`attempts` 대조).
- 30초 발화 분석 왕복(클레임 → 콜백 204) p50/p95, 대화 턴 p50 이 워커 유무와 무관함을 30턴 비교로 증명.
- 정규화 단위 테스트: 「こんにちは。」 vs 「コンニチワ」 → 히라가나 접기 후 유사도, 한자 표기 차이(「今日」vs「きょう」) 가 페널티 없이 1.0.
- 로그에 전사 전문 없음(길이·sha1[:8] 만).
