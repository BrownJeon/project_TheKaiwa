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
speech/worker/                  # task-012b 구현(2026-09-29): gateway 처럼 패키지 + 진입점 — 최상위 모듈 이름(comparator·handlers) 충돌 방지(⑨)
├── main.py                     # 진입점: 설정 읽기 → kaiwa_worker.loop 실행, 종료 신호 처리(SIGTERM 시 현재 잡 마무리)
├── kaiwa_worker/
│   ├── config.py               # speech.config.yml worker.* + env(SPEECH_WORKER_ID·APP_INTERNAL_URL·DATA_ROOT·APP_ENV)
│   ├── loop.py                 # claim(#139) → dispatch(kind) → #138 | #140, 간격·백오프·claim 타임아웃
│   ├── jobs.py · paths.py      # 잡 모델 · DATA_ROOT 경로 검증
│   ├── comparator.py           # TranscriptComparator (+ ReadingProvider — pyopenjtalk)
│   └── handlers/analysis_stt.py  # ANALYSIS_STT (Phase 3 에 pronunciation.py)
├── pronunciation/              # (Phase 3) aligner(narabas) · expected(pyopenjtalk) · pitch(pyworld) · scorer
├── requirements.txt            # worker 전용 추가분만: pyopenjtalk==0.4.1(리눅스 휠 없음 — 소스 빌드, sudo 불필요) · tqdm (Phase 3 에 narabas·pyworld·librosa). httpx·PyYAML 등은 gateway requirements 에 이미 있다. DB 드라이버 없음
├── pyproject.toml
└── tests/
```

- **클레임(task-012b D-B1)**: `InternalClient.claim_jobs(worker_id, kinds, max=1)` → `POST /api/internal/speech/jobs/claim`. 응답 잡에 `audioPath`(`DATA_ROOT` 상대)·`realtimeText`·`recognitionMode`·`attempts` 가 실려 온다 — 워커는 `SpeechJob`·`Utterance` 어느 테이블도 읽지 않는다. 잠금(`FOR UPDATE SKIP LOCKED`)·고아 회수(`lockedAt` 15분↑ → `QUEUED`)·**self-reclaim**(`lockedBy` 가 이 인스턴스 id 와 정확히 같은 `RUNNING` 을 바로 되돌려 다시 줌 — claim 응답 유실·앱 재기동 복구, 앱은 15분 회수와 따로 로그)·비운영 앱의 QA 계정 필터(D-B11)는 앱이 claim 안에서 한다. 워커를 2개 띄워도 같은 잡을 두 번 잡지 않는다(앱 잠금).
- **`workerId` = 인스턴스 id**(REV-033 M1, 2026-09-29): `SPEECH_WORKER_ID`(기본 `worker-<host>-<pid>`)는 사람이 읽는 이름이고, 실제 claim·#140·#138 식별자는 기동마다 붙는 부트 nonce(`secrets.token_hex(4)`)를 더한 `<id>-<8hex>`(≤80자, `WorkerSettings.instance_id`) — 같은 이름으로 둘을 띄워도 잡이 섞이지 않는다(그래도 운영은 1개). 재기동하면 새 인스턴스라 이전 잡은 앱의 15분 고아 회수로 돌아온다(SIGTERM 은 지금 잡을 끝내고 멈추므로 보통 남는 잡이 없다). claim 요청 타임아웃은 **30초**(`LoopConfig.claim_timeout_ms` — 앱 트랜잭션 15초 + 잠금 대기보다 길게; 공유 NAS DB 커밋이 5초를 넘은 1회에 응답을 놓쳐 잡이 15분 고착된 실측이 근거).
- **간격(2026-09-29 구현)**: 잡을 처리했으면 **바로 다음 claim**(디바운스로 풀린 백로그를 빨리 비움), 빈 응답이면 `speech.config.yml worker.poll_interval_ms`(현 **1초**)부터 두 배씩 **최대 10초**(코드 상수 — 앱의 적재 게이트 120초 안에 반드시 한 번 claim 하도록). 빈 큐 claim 은 앱이 트랜잭션 없이 읽기 1회로 끝내 부하가 작다. `max=1`(직렬 원칙 — 분석 STT 서비스가 전역 잠금으로 직렬이고 VoiceVault 와 공용이라 겹쳐도 빨라지지 않는다).
- **운영 워커 수 = 1**(Leader 2026-09-29, pm2 `instances: 1`) — 전사가 호스트 CPU 코어를 다 써(같은 호스트 CPU 작업 +33% 실측) 워커를 늘리면 대화 경로만 느려진다. 워커 2개는 중복 처리 0 검증용으로만.
- 적재 시점은 앱이 정한다: 새 잡은 지금 +20초(FAST 30초), 같은 사용자의 대기 잡은 새 발화마다 +20초로 밀린다(첫 적재 +5분 상한) — claim 도 잠근 잡마다 그 사용자의 마지막 발화 +20초가 지났는지 다시 확인해, 안 지났으면 건네지 않고 미룬다(재검사, Codex C2) — 워커는 대화가 멈춘 뒤의 잡만 받는다(D-B8 수정, api-contract #21·#139). 그래서 새 발화 직후 claim 이 빈 응답이어도 정상이다.
- **실패(D-B10)**: `InternalClient.report_failure(job_id, worker_id, error=<코드값>, retryable, attempt=<claim 응답의 attempts>)` → `POST …/jobs/:id/result`. `attempt`(claim 세대, 2026-10-01)로 앱은 앞 세대의 늦은 보고를 `409` 로 거른다 — 같은 인스턴스 id 가 겹쳐도 지금 세대의 결과가 버려지지 않는다. 앱이 `retryable && attempts < 3` 이면 `QUEUED`(`runAfter` +30초·2분·10분), 아니면 `FAILED` + `Utterance.status=FAILED`. 재시도 대상 = 분석 서비스 연결 실패·503·타임아웃·앱 콜백 5xx(`ANALYSIS_UNAVAILABLE`·`ANALYSIS_TIMEOUT`·`ANALYSIS_SERVER_ERROR`·`CALLBACK_FAILED`). 즉시 실패 = 분석 서비스 4xx 등(`retryable:false`) — 앱은 `AUDIO_MISSING`·`AUDIO_INVALID`·`EMPTY_TRANSCRIPTS`·`READING_UNAVAILABLE` 을 `retryable` 과 무관하게 확정 실패로 본다. 실패 코드는 엔진 중립(`ANALYSIS_*`). `409 STALE_CLAIM`(회수된 잡·이미 끝난 잡)은 무시한다. 에러 문자열에 전사·경로·시크릿을 싣지 않는다.
- **기동 점검**: 읽기 변환기(pyopenjtalk import·사전 로드)가 안 되면 claim 하지 않고 오류 로그만 남기며 대기한다(앱은 하트비트가 없으니 적재를 멈추고 health 는 degraded).
- 오디오 읽기: claim 응답의 `audioPath` 를 워커 `DATA_ROOT` 에 붙여 연다. 절대경로·`..`·`DATA_ROOT` 밖·파일 없음은 열지 않고 `AUDIO_MISSING`(재시도 없음).
- 헤더: `X-Internal-Secret`·`X-Service: worker`·`X-Service-Env: <APP_ENV>`·`X-Trace-Id`(`InternalClient` 의 `X-Service` 는 호출 서비스로 파라미터화 — gateway 는 계속 `gateway`).
- 워커에 `whisper`·`narabas` 문자열이 있는 곳은 `common/engine/adapters/**` 와 `pronunciation/` 뿐이다. 핸들러는 `router.resolve('ANALYSIS_STT')` 로 엔진을 받는다.
- 로그: 전사 원문 0 — 길이·`sha1[:8]`·코드값만. httpx 요청 INFO 로그(발화 id 가 든 URL)는 끈다.
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
| `POST /api/internal/speech/jobs/claim` (#139) | `{workerId(인스턴스 id), kinds, max:1}` (타임아웃 30초) | 고아 회수·self-reclaim·`FOR UPDATE SKIP LOCKED`·환경 필터·하트비트(유휴면 읽기 1회) → `{jobs:[{id, kind, utteranceId, audioPath, realtimeText, recognitionMode, attempts}]}` |
| `POST /api/internal/speech/utterances/:id/analysis` (#138) | `{jobId, workerId, analysisEngine, analysisText, segments, language, latencyMs, comparator{similarity, flags, realtimeLen, analysisLen, version}, engineVersions, traceId, pronunciation?}` | `speech.applyAnalysisResult` → 한 트랜잭션(`Utterance`·`SpeechAnalysis`·`SpeechJob DONE`, `requiresReview` 판정) → (Phase 3) `learning.recordErrorStat` → `200 {stored, …}` · 이미 분석됨 `200 {stored:false}` · 확정 실패·끝난 잡 `409 STALE_CLAIM`(무시) · 회수돼 QUEUED 인 잡의 늦은 결과는 저장 |
| `POST /api/internal/speech/jobs/:id/result` (#140) | `{workerId, status:'FAILED', error, retryable, attempt}` (`attempt` = claim 세대) | 백오프 재적재 또는 확정 실패(+`Utterance FAILED`) · 회수된 잡·앞 claim 세대 `409 STALE_CLAIM` |

~~`GET /api/internal/speech/utterances/{id}`~~ 는 만들지 않는다(claim 응답이 필요한 값을 준다 — task-012b D-B1). 헤더 `X-Internal-Secret: <SPEECH_INTERNAL_SECRET>`(SecretResolver 로 해석)·`X-Service: worker`·`X-Service-Env`, 타임아웃 5s, 연결 오류·5xx 1회 재시도. #138 이 계속 실패하면 #140 `retryable` 로 보고해 잡을 `QUEUED` 로 되돌린다(결과는 재계산되지만 #138 이 멱등).

## 7. 실측·검증 항목 (task-012b)

- 워커 2개 동시 기동 시 같은 잡 중복 처리 0건(`attempts` 대조).
- 30초 발화 분석 왕복(클레임 → #138 200) p50/p95, 대화 턴 p50 이 워커 유무와 무관함을 30턴 비교로 증명(운영 모드 `next start`·워커 1개 — 2026-09-29 첫 음성 p50 +1.2%).
- **대화 중 시작된 분석 잡 0**(디바운스 — 연속 30턴에서 0/30) · 마지막 발화 → 분석 완료 p50/max(30발화 백로그 p50 90초·max 155초, 잡당 처리 p50 3.7초).
- claim 응답 유실 복구: 같은 인스턴스 id 재claim → 쥔 잡을 다시 받음(attempts +1), 다른 인스턴스(같은 `SPEECH_WORKER_ID`·다른 nonce 포함)가 쥔 잡은 그대로·그 잡의 실패 보고는 `409 STALE_CLAIM`. 되돌려 다시 나간 잡에 앞 세대(`attempt` 가 이전 값)의 실패 보고가 늦게 와도 `409` — 지금 세대 불변(단위 테스트 "REV-033 권고 a").
- 디바운스↔claim 경합(Codex C2): 커밋된 새 발화 직후 claim → 옛 잡 미룸(runAfter = 발화 +20초) · 커밋 전 발화 트랜잭션이 옛 잡을 쥔 동안 claim → `SKIP LOCKED` 로 대기 없이 건너뜀 · claim 이 먼저 잠근 경우 발화 저장은 기다렸다 완료(교착 없음) · 무작위 인터리빙 40회 위반 0(`tests/live/task012b-race.ts`, 다중 연결 실DB).
- 정규화 단위 테스트: 「こんにちは。」 vs 「コンニチワ」 → 히라가나 접기 후 유사도, 한자 표기 차이(「今日」vs「きょう」) 가 페널티 없이 1.0.
- 로그에 전사 전문 없음(길이·sha1[:8] 만).
