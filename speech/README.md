# speech/ — TheKaiwa 음성 처리 서비스 (골격)

> 상태: 설계 골격(코드 없음). 구현은 task-003(gateway·tts-service·P0 실측)·task-012b(worker) 에서. 모듈 경계 정본은 [`docs/design/module-dependency.md`](../docs/design/module-dependency.md) §5, API 계약 정본은 [`docs/design/api-contract.md`](../docs/design/api-contract.md), 설정 해석 규칙은 [`docs/design/configuration-resolution.md`](../docs/design/configuration-resolution.md).

## 1. 구성도

```
Mobile App(Capacitor, S25+)                                     웹 브라우저(폴백 경로)
  AudioRecord 16kHz → [@thekaiwa/sherpa-stt 플러그인]              getUserMedia → AudioWorklet → PCM16(40ms)
     silero VAD + ReazonSpeech zipformer int8 (온디바이스)            │
     → vad/partial/final 이벤트 → WebView(bridge.ts)                  │ wss://kaiwa.…/ws/speech (nginx Upgrade)
     → 발화 wav POST /api/v1/speech/utterances (백그라운드)            ▼
                                                        ┌─ speech/gateway (우분투 pm2+venv, 127.0.0.1:8100) ─┐
Next.js thekaiwa (:3010, pm2 blue/green)                │  WS 세션: ticket 검증 → VAD → 세그먼트 디코드      │
  ├─ modules/conversation (턴·LLM·교정)                 │  ReazonSherpaEngine (같은 모델, 서버 CPU)            │
  ├─ /api/v1/speech/{ticket,utterances,tts,config}      │  Utterance wav 저장(DATA_ROOT) → 앱 internal 콜백     │
  ├─ /api/internal/speech/{utterances,analysis}  ◄──────┤  (Phase 4 슬롯) POST /tts — WS 내 문장 오디오 푸시   │
  ├─ /models/reazonspeech-int8/* (nginx alias)          └──────────────────────────────────────────────────┘
  └─ modules/engine/adapters/tts/styleBertHttp ───────────────────────── LAN ──────────────┐
                                                                                            ▼
speech/worker (우분투 pm2+venv)                                       speech/tts-service (맥 M4 ~/kaiwa-tts-run, :8200)
  MariaDB SpeechJob 폴링(FOR UPDATE SKIP LOCKED)                       Style-Bert-VITS2 server_fastapi 래퍼
  ├─ WhisperEngine ──HTTP──► VoiceVault whisper-service 127.0.0.1:8090   /synthesize · /voices · /admin/voices/import …
  ├─ TranscriptComparator → transcriptConfidence·requiresReview           AGPL-3.0 경계(LICENSE-NOTICE.md), common 미사용
  └─ PronunciationAnalyzer(Phase 3) → POST /api/internal/speech/utterances/:id/analysis

DB = NAS MariaDB(앱과 같은 DB, Python 은 SpeechJob + 설정 행만) · 큐 = SpeechJob 테이블 · Redis 없음
```

원칙(음성 기획안 §23): 단일 엔진 비종속 · 실시간/분석 분리 · ReazonSpeech=실시간 · faster-whisper=검증 · sherpa-onnx=오디오 런타임 · TTS 독립 서비스 · 전 엔진 어댑터 추상화 · 설정으로 엔진 선택 · STT≠발음평가 · 분석이 대화 지연을 늘리지 않음.

## 2. 호스트·포트 표

| 프로세스 | 호스트 | 바인드 | 접근 경로 | 비고 |
|---|---|---|---|---|
| `thekaiwa-speech-gateway` | 우분투 | `127.0.0.1:8100` | nginx `location /ws/speech` → `proxy_pass http://127.0.0.1:8100` (`Upgrade`/`Connection upgrade`, `climb.*` vhost 패턴; `voice.*` 의 `Connection ""` 은 쓰지 않음) | ReazonSpeech int8 상주 ≈0.5GB(P0 실측 ⑥) |
| `thekaiwa-speech-worker` | 우분투 | 없음 | — (폴링) | http 모드에서는 모델 미보유 |
| `kaiwa-tts` (tts-service) | 맥 M4 | `0.0.0.0:8200` | 우분투 → M4 LAN 호출만 가능(역방향 불가). 외부 노출 없음 | Style-Bert-VITS2 JP-Extra, CPU/MPS 실측 필요(P0 ③) |
| `voicevault-whisper` (재사용) | 우분투 | `127.0.0.1:8090` | worker → `POST /transcribe-chunk` | VoiceVault 소유·변경 없음. medium int8 CPU ≈1.7GB 상주 |
| Next.js `thekaiwa` | 우분투 | `:3010` | nginx vhost `kaiwa.미라클펭귄.com` | 앱이 `Utterance`·`SpeechAnalysis`·`TtsCache`·`VoiceProfile` 의 소유자 |

자유 포트 실측(계획 §탐색): 8092~8099·8100+. 실행 전 `ss -ltnp` 로 8100·8200 재확인.

## 3. 실행 방식

- **우분투(gateway·worker)**: pm2 + venv. venv 경로 `~/.node-local/thekaiwa-speech/venv`(릴리스 밖 공유 자원, VoiceVault `voicevault-whisper` 와 같은 등급 — `requirements.txt` 변경은 별도 승인 작업, 롤백으로 되돌아가지 않음).
  ```
  python3 -m venv ~/.node-local/thekaiwa-speech/venv
  ~/.node-local/thekaiwa-speech/venv/bin/pip install -e speech/common -r speech/gateway/requirements.txt -r speech/worker/requirements.txt
  ```
  `ecosystem.config.js` 항목 이름: **`thekaiwa-speech-gateway`**(`uvicorn app:app --host 127.0.0.1 --port 8100`, cwd `speech/gateway`) · **`thekaiwa-speech-worker`**(`python main.py`, cwd `speech/worker`). `interpreter:'none'`, env 는 `.env` 에서 `pickNonEmpty` 로 주입(VoiceVault 방식 — Python 은 dotenv 를 읽지 않는다). 초안은 module-dependency §5-2.
- **M4(tts-service)**: `~/kaiwa-tts-run`(NFS 밖 독립 git clone) + venv + `uvicorn app:app --host 0.0.0.0 --port 8200` + crontab 매분 워치독 + `git push` 후 사용자 승인 배포. 상세 [`tts-service/README.md`](tts-service/README.md).
- 서비스 공통 env: `DATABASE_URL`, `DATA_ROOT`, `APP_ENV`(LOCAL|PRODUCTION — 자기 환경의 설정 행만 읽음), `SPEECH_CONFIG_PATH`(기본 `speech/speech.config.yml`), `SPEECH_INTERNAL_SECRET`(앱 internal 콜백 헤더 `X-Internal-Secret`), `APP_INTERNAL_URL`(`http://127.0.0.1:3010`), gateway 전용 `JWT_SECRET`(티켓 검증, 앱과 동일 값), `TTS_SERVICE_URL`, worker 전용 `WHISPER_SERVICE_URL`. 시크릿 값은 `SecretResolver`(`env:` / `file:` → `/home/brownjeon/apps/thekaiwa/shared/secrets/<name>` 0600) 로만 해석한다.
- 개발(맥): 같은 venv 구조를 `~/.node-local/thekaiwa-speech/venv` 에 만들고 `uvicorn --reload` 로 직접 실행. gateway 는 `APP_ENV=LOCAL`.

## 4. 큐 — MariaDB `SpeechJob` 폴링

- 생산자: 앱(`speech.enqueueAnalysis` → `infra.jobs.enqueueSpeechJob`). gateway 는 직접 INSERT 하지 않고 `POST /api/internal/speech/utterances` 콜백으로 앱이 `Utterance` + `SpeechJob` 을 같은 트랜잭션에서 만든다.
- 소비자: worker. 클레임 쿼리(설계):
  ```sql
  START TRANSACTION;
  SELECT id, utteranceId, kind, attempts FROM SpeechJob
   WHERE status = 'QUEUED' AND kind IN (...)
   ORDER BY createdAt LIMIT 1 FOR UPDATE SKIP LOCKED;
  UPDATE SpeechJob SET status='RUNNING', attempts=attempts+1, startedAt=NOW() WHERE id = ?;
  COMMIT;
  ```
  폴링 간격 `worker.poll_interval_ms`(기본 1000), 유휴 시 지수 백오프 최대 5s. 완료 `DONE`/실패 `FAILED(error 요약 ≤300자)`, `attempts ≥ max_attempts(3)` 이면 재큐잉 없이 FAILED. 기동 시 `RUNNING` 이 `stale_after_sec` 를 넘긴 행은 QUEUED 로 되돌린다(AiJob 의 RUNNING→FAILED 정리와 같은 자리).
- Python 이 직접 쓰는 앱 테이블은 **`SpeechJob` 뿐**이다. `Utterance`·`SpeechAnalysis` 는 internal 콜백으로 앱이 쓴다(소유 층 규칙).
- 처리량이 문제되면 Redis(사용자 sudo)로 교체하되 `infra.jobs`·`common/db.claim_next_speech_job` 인터페이스는 그대로 둔다.

## 5. 로그 규칙 (민감정보 금지)

| 남긴다 | 남기지 않는다 |
|---|---|
| `traceId`, `utteranceId`, `userId`, `connectionId`, 단계별 ms, 오디오 길이(ms)·바이트, 텍스트 **길이·sha1 앞 8자** | 발화 전문·전사 전문(INFO 이상), 원본 오디오 바이트·경로 밖 파일 내용 |
| 엔진·모델 버전, 헬스 결과 | 티켓 JWT, `SPEECH_INTERNAL_SECRET`, `credentialRef` 로 해석된 값, `DATABASE_URL` |
| 오류 코드·예외 클래스·stderr 앞 500자 | 요청 헤더 전체, 사용자 이메일 |

- 레벨 기본 INFO. DEBUG 는 `POST /admin/log-level` 로 런타임 변경(RUNTIME_EDITABLE 키 `logging.level`), 전문 텍스트는 **`DebugSession(captureText=true)` 가 살아 있는 요청에만** DEBUG 로 찍는다(관리자 콘솔 §113).
- 모든 로그 라인은 `common/logging.mask()` 를 통과한다. 마스킹 실패는 로그 누락보다 낫다(예외 시 필드 제거).
- pm2 로그 파일은 `<base>/shared/logs/speech-{gateway,worker}-{out,err}.log`. M4 는 `~/kaiwa-tts-local-logs/`.

## 6. P0 실측 게이트 체크리스트 (task-003, 결과는 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md`)

- [ ] ① **온디바이스(S25+)**: ReazonSpeech int8 5초 발화 디코드 시간(목표 ≤0.8s) · VAD endpoint 지연(`endpoint_silence_ms=500` 기준) · 앱 RSS(목표 ≤600MB) — `num_threads` 2/3/4 각각
- [ ] ② **gateway 폴백**: 같은 항목(서버 CPU) + WebView `getUserMedia` → WS 왕복(첫 partial 까지, 목표 ≤1.0s)
- [ ] ③ **M4 tts-service**: 1문장(20자) 합성 시간(목표 ≤1.0s, 초과 시 ONNX 변형·캐시·워밍업), 콜드 스타트(모델 로드) 시간, Ollama 동시 사용 시 영향
- [ ] ④ **인식률**: 고정 일본어 20문장 — 온디바이스/gateway 각각 정답 ≥16(정규화 후 편집거리 ≥0.9 를 정답으로)
- [ ] ⑤ **모델 다운로드**: manifest 총 ≈160MB — Wi-Fi 소요 시간, 중단 후 재개(HTTP Range) 동작, sha256 불일치 시 폐기 동작
- [ ] ⑥ **우분투 메모리**: gateway 상주(목표 ≈0.5GB)·세션 3개 동시 피크, 기존 `voicevault-whisper` 1.7GB 와 합산 가용 14GB 이내, pm2 `max_memory_restart` 값 확정

게이트 미달 시 순서: 인식률 <16 → fp32/빔 조정·전용 whisper 실시간 대체 검토 / endpoint 1s↑ → `endpoint_silence_ms` 튜닝·푸시투토크 수동 종료 / SBV2 1.5s↑ → ONNX 변형·캐시·문장 파이프라인. 그래도 안 되면 목표를 "회화 8초·채팅 5초"로 재정의(계획 §16 리스크).

## 7. 디렉토리

| 경로 | 내용 | 문서 |
|---|---|---|
| `speech.config.yml` | APPLICATION_CONFIG 층(3순위) 예시 — 런타임 진실은 DB | 파일 내 주석 |
| `common/` | gateway·worker 공용 패키지(디스크립터·스키마·어댑터·라우터·설정·시크릿·헬스) | [`common/README.md`](common/README.md) |
| `gateway/` | WS 실시간 폴백 STT·앱 콜백 | [`gateway/README.md`](gateway/README.md) · [`gateway/interfaces.py`](gateway/interfaces.py) |
| `worker/` | SpeechJob 소비·분석 STT·Comparator·발음 | [`worker/README.md`](worker/README.md) |
| `tts-service/` | M4 SBV2 래퍼(AGPL 경계) | [`tts-service/README.md`](tts-service/README.md) · [`LICENSE-NOTICE.md`](tts-service/LICENSE-NOTICE.md) |
| `models/` | `/models/*` 서빙 manifest 규약(파일 미커밋) | [`models/README.md`](models/README.md) |
| `test-assets/` | `ja-sample.wav` Functional Test 오디오 규약 | [`test-assets/README.md`](test-assets/README.md) |
