---
tags:
  - type/task-record
  - domain/ask
  - domain/speech
aliases:
  - task-066 S0
  - task-066 받아쓰기 스파이크
---
# task-066 S0 받아쓰기 실현성 스파이크 — Developer 기록

> 상위: [[task-066-ask-chatbot-voice]]. 이전 결정: [[task-064-ask-anything-3a]] 「기술 사실」·D13·97행. **저장소 코드 변경 0**(이 파일만 씀). 스크립트·표본은 scratchpad `q066/`(권한 700), 오디오는 끝나고 삭제. whisper-service 호출 **정확히 12회·직렬·동시 0**(+ `/health` 1회), 재시작·설정 변경 없음. M4 는 SSH 로 macOS `say` 만 썼다(tts-service 호출 0, M4 에 남긴 파일 0 — mktemp 디렉터리 즉시 삭제).

## 결론 3줄
1. **conditional-go.** 한국어만 말하면 합성음 6건 문자 오류율(CER) 0.000(잡음 SNR 10dB 포함), 일본어만 3건 0.000~0.067로 충분하다. 그러나 **한국어+일본어 섞어 말하기 2건은 CER 0.58~0.82** — 일본어 단어가 빠지거나 한국어로 **번역돼**(「すみません이랑 ごめんなさい 차이」→「죄송합니다.이랑죄송합니다.차이」) 질문 뜻이 깨진다. `language=ko` 고정도 결과가 같다. 조건: ① 받아쓴 글을 **보내기 전에 확인·고칠 수 있게**(D4 ★를 B 로 바꾸기 권고) ② 공유 서비스 막힘에 15초 fail-fast ③ 사용자 폰에서 실제 목소리로 섞어 말하기 확인.
2. **지연(이 서버, 서비스 한가할 때, 업로드 제외)**: 자동 언어 감지 짧은 말 1.3~4초 → **4.1~4.6초**(6건), 9~11초 말 → 5.2~5.6초, 27초 말 → 8.2초. 언어 고정(`ko`)이면 짧은 말 2.3~2.7초(2건)로 약 1.9초 빠르다. 첫 호출이 더 느리지 않았다(모델이 5일째 상주). 진짜 콜드(서비스 재시작)는 직접 못 쟀고 VoiceVault 기동 로그상 모델 적재 2~3초·기동 약 5~9초(그동안 503). 예산 제안: **말 끝 → 글 표시 p50 ≤ 5초·p90 ≤ 8초(≤10초 발화), 15초 넘으면 실패 처리.**
3. **권고 구현안**: 받아쓰기 전용 경로 `POST /api/v1/speech/dictation`(가칭 #181, multipart WAV PCM16 16kHz ≤30초·≤1MB, `language=auto|ko|ja`) → 응답 글을 클라이언트가 기존 `#32 turns` 에 `inputSource:"SERVER_STT"` 로 보낸다(연결 방식 ①). 음성은 메모리에서만 다루고 저장 0. 스키마 변경 0(기존 `ANALYSIS_STT` 연결·`InputSource.SERVER_STT` 재사용). 서버 약 6개 파일 + 시험 4개, 화면은 `capture.ts`·`pcm.ts` 재사용 + WAV 쓰기·훅 신규.

## 1. whisper-service 사실 (VoiceVault 소유, TheKaiwa 와 공유)

| 항목 | 값 | 근거 |
|---|---|---|
| 위치 | 소스 `VoiceVault/whisper-service/main.py`(312줄). 운영 = pm2 `voicevault-whisper`, cwd `/home/brownjeon/apps/voicevault/releases/20261007-173122-5f4a6fe8/whisper-service`, venv `~/.node-local/voicevault-whisper/venv`. 운영 파일과 NFS 소스 `diff` 동일 | [확실] `pm2 jlist`·`diff -q` |
| 바인딩 | `127.0.0.1:8090` 만(LAN 노출 없음), **인증 없음** | [확실] `ss -ltnp`, `ecosystem.config.js:105-106` |
| 엔드포인트 | `POST /transcribe-chunk`(multipart `file` + `language` 선택) · `POST /diarize` · `GET /health`(`{status, whisperLoaded, diarizationLoaded}`) | [확실] `main.py:144-150, 231-251` |
| 응답 | `{language, languageProbability, durationSec, segments:[{startSec,endSec,text}]}` — 단어 신뢰도·avg_logprob **없음** | [확실] `main.py:162-166` |
| 모델·장치 | faster-whisper **medium**, `int8`, **CPU**(GPU 없음 — `nvidia-smi` 없음), beam 5, `vad_filter=True`, `condition_on_previous_text=False`. env `WHISPER_*` 미설정 → 코드 기본값. HF 캐시 `models--Systran--faster-whisper-medium` | [확실] `main.py:36-38, 67-71, 214-221`, `/proc/<pid>/environ` 에 `WHISPER_*` 0개 |
| 언어 | `language` 폼 값이 없으면 **자동 감지**, 있으면 고정. 응답 `language`·`languageProbability` 로 감지 결과를 돌려준다 | [확실] `main.py:234, 214-216` |
| 동기 응답 | **가능** — 요청 하나가 전사 끝까지 기다린 뒤 JSON 을 돌려준다(잡 큐 아님) | [확실] `main.py:241-249`, 실측 12건 |
| 동시성 | 프로세스 1개 + **전역 `asyncio.Lock` 하나로 전사·화자분리를 전부 직렬화**. 대기열 길이 상한·우선순위 없음 | [확실] `main.py:55-61, 241, 298` |
| 입력 형식 | 업로드를 `/tmp/vv-*.wav` 로 저장 → 전사 → **`wave` 모듈로 길이 계산** → `finally` 에서 삭제. 그래서 **WAV(PCM) 가 아니면 전사 뒤 500** 이 난다(webm/opus 직접 불가) | [확실] `main.py:185-209, 243-251` |
| 기동·상주 | 모델은 프로세스 시작 때 1회 적재(5일 13시간째 가동, RSS 약 1.9GB, `max_memory_restart 8G`) | [확실] `ps`, `ecosystem.config.js:119` |
| 공유 상대 | VoiceVault 녹음 전사는 **600초 단위 청크**로 같은 잠금을 잡고, 녹음 전체 `/diarize` 도 같은 잠금. TheKaiwa worker 분석 잡도 같은 잠금 | [확실] `VoiceVault/src/lib/recordings/progressStages.ts:22`, `pipeline.ts:160,237`, `speech.config.yml:57-63` |
| 서버 자원 | 12코어, 메모리 30GB(가용 약 16GB) | [확실] `nproc`·`free` |

## 2. TheKaiwa 의 현재 호출 경로

- **앱(TS)은 whisper 를 전사용으로 부르지 않는다.** TS 어댑터 `src/modules/engine/adapters/stt/fasterWhisper.provider.ts` 는 Descriptor·설정 스키마·**Health 만**(설명문 「실제 전사는 worker 가 자기 설정으로 부른다(앱은 Health 만)」, 21행). 설정 키 `runtime.language`='ja'(주석 「언어 고정(자동 감지 끔 — 한국어 섞임 오인 방지)」, 49행), `connection.timeoutMs` 60000, 모두 `consumer:'PYTHON'`. [확실]
- **전사는 Python worker 만**: `speech/common/kaiwa_speech_common/engine/adapters/stt/whisper_http.py` 가 `POST /transcribe-chunk` 에 `data={"language": self._language}`(= 설정 `ja` 고정)로 부른다(75행). 앱 → `SpeechJob(ANALYSIS_STT)` 큐(DB) → worker claim → whisper → `#138` 콜백. 요청마다 언어를 바꾸는 인자는 **없다**. [확실]
- 앱의 `src/modules/engine/stt/index.ts` 는 실시간 STT 파사드 + `analysisTarget()`(현재 환경 ANALYSIS_STT 폴백 정책의 첫 connection, 5초 캐시)만 있다. 앱→HTTP 엔진 직접 호출 선례는 TTS 어댑터 `adapters/tts/styleBertHttp.ts`(주소는 Effective 설정에서만, 리다이렉트 미추종, 응답 상한, 오류 본문은 코드만). [확실]
- 기존 쓸 것: `infra.readFormDataCapped`(본문 상한)·`infra.rateLimit`·`speech/utterances` 의 WAV 검사(`isPcm16Mono16k`, `AUDIO_FORMAT`·`AUDIO_TOO_LONG` 사유)·`askLimits.ts`(분/일 한도 + 예약·반환 패턴, 프로세스 메모리). `InputSource` enum 에 **`SERVER_STT` 가 이미 있다**(`schema.prisma:108-112`). ASK 는 지금 `inputSource !== 'TEXT' || utteranceId` 면 400 `ASK_TEXT_ONLY`(`orchestrator/index.ts:414`). [확실]
- 6층 배치 제안(엔진명은 어댑터 밖으로 안 나감):
  - L5 어댑터 신규 `engine/adapters/stt/fasterWhisperHttp.ts` — `/transcribe-chunk` 경로·`language` 폼 이름을 아는 유일한 TS 파일.
  - L5 파사드 `engine/stt/index.ts` 에 `dictate(wav, hint, signal)` 추가 — `analysisTarget()` 로 연결 선택, 오류를 `ENGINE_UNAVAILABLE/ERROR/TIMEOUT` 으로 변환.
  - L4 유스케이스 신규 `speech/stt/dictation.ts`(+ `dictationLimits.ts`) — WAV 검사·길이·한도·동시성·글 정리, `speech/index.ts` 로만 공개.
  - 라우트 신규 `app/api/v1/speech/dictation/route.ts`.

## 3. 지연·품질 실측 (2026-10-13, 12회 직렬, 서비스 한가할 때 — 호출 전 1초 CPU 표본 < 0.5코어 확인)

표본: M4 macOS `say` 로 합성 — 한국어 **Yuna**, 일본어 **Kyoko**(섞어 말하기는 두 목소리 조각을 이어 붙임), 일본어 일부는 저장소 `speech/test-assets/stt20` 의 기존 합성음(SBV2) 재사용. 16kHz mono PCM16, 앞뒤 무음 0.3초. CER = NFKC 후 공백·문장부호 제거, 글자 단위 편집 거리/정답 길이.

| # | 표본 | 길이 | language | 걸린 시간(클라이언트 왕복) | RTF | CPU 코어·초 | 감지 | CER | 받아쓴 글 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ja 짧음(stt20/01) | 3.05s | auto | **4.46s** | 1.46 | 16.6 | ja 0.96 | 0.067 | こんにちは! 今日は良い天気ですね! |
| 2 | ko 짧음 | 2.78s | auto | **4.33s** | 1.56 | 16.6 | ko 0.98 | 0.000 | 고마워요를 일본어로 어떻게 말해요? |
| 3 | 섞음1 「いただきます는 언제 써요?」 | 2.53s | auto | 4.17s | 1.65 | 16.0 | ko 0.90 | **0.818** | 네 언제 했어요? |
| 4 | 섞음1 | 2.53s | **ko** | **2.30s** | 0.91 | 8.9 | ko 1.00 | **0.818** | 네 언제 했어요? |
| 5 | 섞음2 「すみません이랑 ごめんなさい 차이가 뭐예요?」 | 3.97s | auto | 4.58s | 1.16 | 17.6 | ko 0.77 | **0.579** | 죄송합니다.이랑죄송합니다.차이가 뭐예요? |
| 6 | 섞음2 | 3.97s | **ko** | **2.69s** | 0.68 | 10.4 | ko 1.00 | **0.579** | (5와 같음) |
| 7 | ja 단어만 「大丈夫」 | 1.27s | auto | 4.14s | 3.27 | 15.7 | ja 0.96 | 0.000 | 大丈夫 |
| 8 | ko 중간 | 8.77s | auto | **5.16s** | 0.59 | 19.9 | ko 0.99 | 0.000 | (정답과 같음, 띄어쓰기만 차이) |
| 9 | ja 중간(stt20/09+13+06) | 11.23s | auto | **5.57s** | 0.50 | 21.6 | ja 0.99 | 0.062 | 友達→「友らし」, 見→観 |
| 10 | ko 긺 | 27.46s | auto | **8.16s** | 0.30 | 31.8 | ko 1.00 | 0.000 | (161자 전부 맞음, 일부 띄어쓰기 붙음) |
| 11 | ko 짧음2 | 4.02s | auto | 4.64s | 1.15 | 17.8 | ko 0.99 | 0.000 | 편의점에서 봉투 필요하냐고 물으면 뭐라고 대답해요? |
| 12 | 11 + 백색 잡음 SNR 10dB | 4.02s | auto | 4.63s | 1.15 | 17.8 | ko 0.89 | 0.000 | (11과 같음) |

읽는 법:
- [확실] **짧은 말에도 바닥 시간이 있다**: Whisper 인코더는 항상 30초 창을 계산해 1.3초 말도 4.1초(auto)·2.3초(ko 고정)가 걸린다. 길이가 늘면 완만히 는다(27초 → 8.2초).
- [확실] **자동 감지 비용 ≈ 1.9초·약 7코어·초**(#3↔#4, #5↔#6). [가능성 높음] faster-whisper 가 언어 감지에 인코더를 한 번 더 돌리기 때문.
- [확실] 요청 하나가 약 **4코어를 2~8초** 점유한다(코어·초 ÷ 걸린 시간 ≈ 3.7~3.9).
- [확실] 이번 첫 호출(#1)은 이후 같은 길이 호출과 같았다(웜). 「콜드」= 서비스 재시작은 금지라 직접 재지 못했다. 대신 VoiceVault 로그(`/home/brownjeon/apps/voicevault/shared/logs/whisper-err.log`)의 기동 기록: medium 모델 적재 **2~3초**(10-04 23:33:38→40, 10-07 17:31:47→50), 화자분리 파이프라인 적재까지 합치면 기동 약 5~9초. 그 사이 요청은 503 → 우리 쪽 `422 ENGINE_UNAVAILABLE`. 재시작 직후 첫 추론의 추가 지연은 미측정.
- [확실] 섞어 말하기: 감지는 늘 `ko` 이고 일본어 조각은 **버려지거나(#3) 한국어로 번역된다(#5)**. 언어를 `ko` 로 고정해도 같은 글(#4·#6). 받아쓴 글만 보면 「すみません 과 ごめんなさい 차이」를 물은 것을 알 수 없다.
- 한계(정직하게): 표본 12건(한국어 6·일본어 3·섞음 2(×2 언어 설정))뿐이고 **전부 합성음**이라 인식률을 과대평가한다(`speech/test-assets/README.md` §2 와 같은 경고). 섞음 표본은 두 목소리를 이어 붙인 것이라 한 사람이 한국어 억양으로 일본어 단어를 말하는 실제 상황과 다르다 — [추측] 실제로는 일본어 단어가 한글 소리(「이타다키마스」)로 적히거나 번역될 수 있다. 일본어 CER 0.06 대 오류는 한자/가나 표기 차이(良い↔いい) 성격이 섞여 있어 실제 의미 손상보다 크게 잡힌다. 지연은 업로드·Next 처리 시간을 **뺀** whisper 왕복이다.
- 업로드 크기: WAV PCM16 16kHz mono 30초 = 960,044B. 같은 27초를 Opus 24k/32k webm 으로 바꾸면 86.7KB/110.5KB(로컬 ffmpeg). [추측] LTE 상향 5~10Mbps 기준 WAV 30초 업로드 약 0.8~1.5초, Wi-Fi 0.3초 이하.

## 4. 오디오 경로 (앱·브라우저)

- [확실] `src/modules/speech/stt/client/capture.ts` = getUserMedia(`echoCancellation·noiseSuppression·autoGainControl`) → AudioWorklet(약 20ms Float32 조각), `prepare()` 를 **누름 핸들러 안에서 동기로** 불러야 WebView 에서 AudioContext 가 깨어난다(파일 머리 주석). 마이크 트랙은 발화마다 stop. `pcm.ts` = `Downsampler`(→16kHz PCM16)·`FrameChunker`·`LevelMeter`. **받아쓰기용으로 그대로 재사용 가능** — 조각을 메모리에 모아 끝에 WAV 로 감싸면 된다. 새로 필요한 것: 클라이언트 WAV 머리 쓰기(44바이트) + 30초 상한·자동 종료 + 업로드 훅.
- [확실] 앱(안드로이드) WebView: Manifest 에 `RECORD_AUDIO`(89행), Capacitor `BridgeWebChromeClient.onPermissionRequest`(102행)가 WebView 마이크 요청을 받아 `RECORD_AUDIO` 를 요청·허용한다. 회화의 `GATEWAY` 경로(모델 없음·ACCURATE 모드 등, `router.ts:66-74`)가 이미 같은 getUserMedia 를 앱 안에서 쓴다 → **네이티브 변경 불필요**(APK 재설치 없음). [가능성 높음] 실기기 확인은 사용자 폰 목록 6번.
- 형식 권고: **WAV PCM16 16kHz mono**. 이유 ① whisper-service 가 WAV 만 받는다(위 표) ② 서버에서 webm→wav 변환(ffmpeg spawn)이 필요 없다 ③ 기존 `isPcm16Mono16k` 검사 재사용 ④ 30초 960KB 로 기존 발화 업로드 상한 2MB 안. 단점: Opus 대비 9배 크다 — 모바일 데이터로 30초 말하면 약 1초 업로드. 짧은 질문(대부분 ≤10초 = 320KB)은 문제 없음.
- 본문·타임아웃: [확실] 운영 nginx conf = 저장소 conf(`diff` 동일) — `client_max_body_size 32m`, `location /` `proxy_read_timeout 600s` → **nginx 변경 불필요**. 라우트는 `readFormDataCapped(req, 1MB+64KB)` 로 자체 상한(기존 #21 은 2MB+256KB). [가능성 높음] Next 16 미들웨어 본문 상한(기본 10MB)에도 걸리지 않는다(#21 2MB 업로드가 운영에서 이미 동작).

## 5. 보안·프라이버시 설계

1. **인증**: `requireSession()`(세션 쿠키). capability 없음(학습자 API). 소유 리소스 없음(저장 안 함).
2. **음성 미저장**: 라우트는 본문을 메모리 Buffer 로만 읽고 WAV 검사 → `fetch` multipart(Blob) 로 whisper 에 보낸 뒤 버린다. TheKaiwa 쪽 디스크 쓰기 0, `DATA_ROOT` 사용 0, `Utterance` 행 0, `SpeechJob` 0. [확실] 단 whisper-service 가 요청마다 `/tmp/vv-*.wav` 임시 파일을 만들고 `finally` 에서 지운다(`main.py:197-209, 250-251`) — 처리 중 프로세스가 죽으면 남을 수 있다(VoiceVault 소유, 고치지 않음 — 남은 위험으로 기록).
3. **외부 전송**: 음성은 이 서버 안(loopback)에서만 처리, 외부 AI 로 가지 않는다. 외부(LLM)로 가는 것은 사용자가 보낸 **받아쓴 글**뿐이며 글자 질문과 같은 경로·같은 D2 범위.
4. **한도**(프로세스 메모리, `askLimits` 패턴): 사용자당 **분당 6·하루 100**, 사용자당 진행 중 1(두 번째는 409), 프로세스 전체 진행 1 + 대기 1(넘으면 `429 DICTATION_BUSY` — 공유 whisper 와 VoiceVault 보호). 길이 0.5~30초, 파일 ≤ 1MB(30초 WAV 960KB + 여유). [추측] 하루 100이면 최악 100 × 8초 ≈ 13분 CPU 4코어 — 공유 서비스에 감당 가능한 상한.
5. **로그·Trace**: 음성 바이트·받아쓴 글 **0**. 남기는 것 = traceId·바이트 수·오디오 ms·걸린 ms·감지 언어·글 길이·결과 코드. 응답·오류에 엔진 이름·주소·모델명 없음. `RequestTrace` 는 `TraceKind` enum 에 받아쓰기 값이 없어(`schema.prisma:466-472`) **행을 남기지 않는 쪽 권고**(스키마 변경 회피) — 필요하면 Leader 결정(enum 추가 = DB 변경).
6. **오류 코드**(§0-5 봉투 그대로): 아래 계약 초안.
7. **취소**: 클라이언트 abort → 어댑터 fetch abort. [확실] whisper 쪽은 잠금을 이미 잡았으면 끝까지 계산한다(취소 불가) — 낭비 상한 = 30초 발화 ≈ 8초.

### 질문 파이프라인 연결 — 후보 2개

| | ① 받아쓰기 응답 → 클라이언트가 글로 `#32 turns` | ② 오디오를 `#32 turns` 에 직접 |
|---|---|---|
| 잘못 들은 글 | **보내기 전에 보고 고칠 수 있다**(섞어 말하기 CER 0.58~0.82 를 사람이 바로잡음) | 고칠 틈 없이 LLM 이 틀린 질문에 답한다(AI 비용·한도 낭비) |
| 기존 코드 영향 | ASK 에 `inputSource:'SERVER_STT'` 허용 한 줄(`orchestrator/index.ts:414`) | 공용 턴 라우트(TALK·CHAT 공유)를 multipart 로 확장, 턴 락·ASK 슬롯을 STT 동안 붙잡음 |
| 6층 | speech(받아쓰기)와 conversation(질문)이 라우트·화면에서만 만남 | 한 라우트 안에서 조합은 가능하나 SSE 단계·오류 갈래가 복잡 |
| 오류 구분 | STT 실패 / 답 실패를 화면이 따로 안내 | 한 SSE 에서 섞임 |
| 재사용 | 회화 채팅·다른 화면에도 쓸 수 있는 받아쓰기 | ASK 전용 |
| 단점 | 왕복 2번(+약 0.1초), `SERVER_STT` 라벨을 서버가 검증 못 함(통계 라벨일 뿐 — 보안 영향 없음) | 요청 1번, 출처 검증 가능 |

**권고: ①.** D4 를 ★A(바로 보냄)로 두더라도 ① 이 맞다(화면이 받아쓴 글을 말풍선으로 띄운 직후 자동으로 turns 호출 — 서버는 같다).

## 6. API 계약 초안 (문서는 고치지 않음 — Leader 가 `api-contract.md` §2-4 에 additive 로 옮길 때 쓸 초안)

#### #181(가칭) `POST /api/v1/speech/dictation` — 짧은 말 받아쓰기(저장 없음, task-066)

`multipart/form-data`, 본문 ≤ 1,048,576 + 65,536 바이트:

| 필드 | 형식 | 검증 |
|---|---|---|
| `audio` | `audio/wav` PCM16 **16kHz mono** | ≤ 1MB, **0.5~30초**(헤더로 계산). 형식 아님 `400 VALIDATION{reason:AUDIO_FORMAT}`, 김 `AUDIO_TOO_LONG`, 짧음 `AUDIO_TOO_SHORT`, 큼 `TOO_LARGE` |
| `language` | `auto`\|`ko`\|`ja` | 생략 = `auto`. 그 밖 `400 VALIDATION{field:language}` |
| `purpose` | `ASK` | 필수(지금은 ASK 만 — 다른 화면이 쓰려면 값 추가로 연다). 그 밖 `400` |

```json
← 200 { "success": true, "data": { "text": "고마워요를 일본어로 어떻게 말해요?", "detectedLanguage": "ko", "languageConfidence": 0.98, "durationMs": 2780, "empty": false }, "message": null }
```

- `text` ≤ 1,000자(제어 문자 제거·앞뒤 공백 정리, 세그먼트를 이음). 무음·VAD 로 다 잘리면 `200 {text:"", empty:true}` — 오류 아님(화면: 「잘 안 들렸어요」).
- `detectedLanguage` ∈ `ko|ja|other`(엔진 감지값을 서버가 접음). `languageConfidence` 0~1 소수 2자리. 문장 신뢰도는 없다(엔진이 주지 않음).
- 엔진 이름·모델·세그먼트 시간·traceId(성공 시)는 싣지 않는다. `Cache-Control: private, no-store`.

| HTTP | `data.code` | 언제 |
|---|---|---|
| 400 | `VALIDATION` | 위 표(`details.reason`: `CONTENT_TYPE·EMPTY·TOO_LARGE·AUDIO_FORMAT·AUDIO_TOO_SHORT·AUDIO_TOO_LONG`, `details.field: language·purpose`) |
| 401 | `UNAUTHENTICATED` | 세션 없음 |
| 409 | `CONFLICT` | 같은 사용자 받아쓰기 진행 중 |
| 422 | `ENGINE_UNAVAILABLE` | 현재 환경 받아쓰기 연결 없음·꺼짐, 서비스가 모델 미적재(503) |
| 429 | `RATE_LIMITED` | `details.reason`: `DICTATION_RATE`(분당 6) · `DICTATION_DAILY`(하루 100) · `DICTATION_BUSY`(프로세스 진행 1 + 대기 1 초과) + `retryAfterSec` |
| 502 | `ENGINE_ERROR` | 서비스 5xx·연결 실패·응답 형식 오류 + `traceId` |
| 504 | `ENGINE_TIMEOUT` | **15초**(연결 1초 포함) 초과 + `traceId` — 공유 서비스가 VoiceVault 녹음 처리로 잠겨 있으면 여기로 빠진다 |

- 한도 계산: 시작 때 예약, **엔진을 부르기 전 실패**(`400`·`409`·`422`)는 되돌리고, 엔진을 부른 뒤(성공·`502`·`504`)는 소비(재시도 폭주 방지) — ASK 의 `admitAsk` 예약 → 시작 실패 시 `refund()`, 그 뒤 `release`(`turnRoute.ts:36-44`, `askLimits.ts:104-123`)와 같은 생각.
- **#32 turns(ASK) 변경**: `inputSource` 에 `SERVER_STT` 허용(`TEXT|SERVER_STT`), `utteranceId` 는 계속 `400`. 저장 `ChatMessage.inputSource=SERVER_STT`(스키마 기존 값). 질문 글자 상한 1,000자 그대로.
- 엔진 연결: 새 역할을 만들지 않고 현재 환경 **`ANALYSIS_STT` 폴백 정책의 첫 연결**을 쓴다(enum `EngineRole` 변경 회피). 요청마다 언어 인자를 어댑터에 넘긴다(`auto` → 폼 필드 생략). 연결의 `runtime.language='ja'`(worker 용)는 받아쓰기에 쓰지 않는다 — 설정 설명문 정정 필요(Leader 문서).

## 7. 위험·미확인

| 위험 | 정도 | 내용·대응 |
|---|---|---|
| 섞어 말하기 | **높음** | 실측 2건 CER 0.58~0.82, 일본어가 사라지거나 번역됨. 대응: 받아쓴 글 확인·편집 후 보내기(D4 B), 안내 문구 「일본어 단어는 글자로 고쳐 주세요」. [추측] 대안 — 같은 오디오를 `ja` 고정으로 한 번 더 받아써 두 후보를 함께 보여 주거나 LLM 에 함께 넘기기(+2.3~2.7초, 공유 CPU 2배). **미실측**(호출 예산 12회 소진) — S1 에서 Leader 승인 시 3~6회 추가 실측 권고 |
| 공유 잠금 | 중간(드묾·큼) | VoiceVault 녹음 처리 중이면 600초 청크·화자분리가 잠금을 수 분 잡는다 → 받아쓰기 15초 fail-fast 로 실패. 한 사용자 앱이라 겹칠 일은 드물다. 겹침이 잦으면 TheKaiwa 전용 인스턴스(작은 모델, `speech.config.yml:107` 「전용 whisper 인스턴스는 추가 시 여기에」)를 Leader 결정 |
| 짧은 일본어 단어 단독 | 낮음~중간 | 「大丈夫」1.27초 정답(ja 0.96). [추측] 「はい」「え?」처럼 1초 미만·한자 없는 말은 중국어 등 오감지 가능 → `other` 로 접고 글은 그대로 보여 준다 |
| 소음·억양 | 미확인 | 백색 잡음 SNR 10dB 는 문제 없었다(1건). 실제 생활 소음·한국어 억양 일본어는 합성음으로 측정 불가 → 폰 확인 |
| 지연 예산 초과 | 중간 | 바닥 4.1초(auto). 모바일 업로드 +0.3~1.5초. 이후 답 생성 약 13초(task-064 실측)가 더해져 「말 끝 → 답」 약 17~22초 |
| 서버 자원 | 낮음 | 요청당 약 4코어 2~8초. TheKaiwa worker 분석 잡(발화당 약 4~5초)과도 같은 잠금 — 질문 1건이 분석 잡 1건 뒤에 서면 +5초 |
| 콜드 스타트 | 낮음 | 서비스 재시작 직후 약 5~9초(로그: 모델 적재 2~3초) 동안 `/health whisperLoaded:false`·전사 503 → `422 ENGINE_UNAVAILABLE`. 재시작 직후 첫 추론 지연은 미측정 |
| 임시 파일 | 낮음 | whisper 프로세스가 처리 중 죽으면 `/tmp/vv-*.wav` 잔류(VoiceVault 소유) |

### 사용자 폰에서 확인할 것 (S2 배포 뒤, 질문 탭 마이크)
1. 한국어만 짧게: 「고맙다는 말을 일본어로 어떻게 해요?」 → 글이 맞는지, 말 끝부터 글이 보일 때까지 초.
2. 한국어로 상황 설명 20초 이상: 「다음 주에 일본 친구 집에 초대받았는데 …(자유롭게)」 → 긴 글 정확도·시간.
3. 섞어 말하기: 「いただきます는 언제 써요?」 → 일본어 부분이 일본어로/한글 소리로/번역으로/빠져서 나오는지 **그대로 기록**.
4. 섞어 말하기 2: 「すみません이랑 ごめんなさい 차이가 뭐예요?」 → 같은 기록.
5. 일본어 문장만: 「駅までどうやって行けばいいですか」 → 일본어로 나오는지.
6. 앱(안드로이드)에서 처음 마이크를 누를 때 권한 창이 뜨고, 허용 뒤 바로 녹음되는지(웹 Chrome 도 각 1회).
7. 시끄러운 곳(TV·카페)에서 1번 다시.
8. 1초 미만 「はい」만 말하기, 아무 말 없이 3초 → 「잘 안 들렸어요」 안내가 나오는지.

## 8. 결론·권고 구현안·데모에 줄 값

**판정: conditional-go** — 한국어 단독·일본어 단독 질문은 지금 서버로 충분(합성음 기준 CER ≤ 0.07, 4~8초). 섞어 말하기는 받아쓰기가 뜻을 깨뜨리므로 **보내기 전 확인·편집**을 조건으로 건다. 공유 서비스 잠금은 15초 fail-fast 로 막는다.

**지연 예산(제안)**: 녹음 종료 → 받아쓴 글 표시 **p50 ≤ 5초, p90 ≤ 8초**(≤10초 발화, 업로드 포함), 하드 타임아웃 **15초**. 근거 = 실측 4.1~5.6초(≤11초 발화) + 업로드 0.3~1.5초. 30초 발화는 p50 약 9~10초를 허용한다.

**구현 범위(S1 서버, 예상)**:
| 파일 | 신규/수정 | 내용 |
|---|---|---|
| `src/modules/engine/adapters/stt/fasterWhisperHttp.ts` | 신규 | multipart 호출·`language` 폼·15초·응답 64KB 상한·리다이렉트 미추종·오류 코드만(글 미기록) |
| `src/modules/engine/adapters/stt/fasterWhisper.provider.ts` | 수정 | 설명문 「앱은 Health 만」 → 받아쓰기도 앱이 부름(동작 변경 없음) |
| `src/modules/engine/stt/index.ts` | 수정 | `dictate()` 파사드(연결 선택·오류 변환) |
| `src/modules/speech/stt/dictation.ts` · `dictationLimits.ts` | 신규 | WAV 검사(utterances 의 `isPcm16Mono16k` 재사용)·길이·한도·동시성·글 정리·언어 접기 |
| `src/modules/speech/index.ts` | 수정 | 공개 API 추가 |
| `src/app/api/v1/speech/dictation/route.ts` | 신규 | 세션·한도·본문 상한·no-store |
| `src/modules/conversation/orchestrator/index.ts` | 수정 1줄 | ASK `inputSource` `TEXT|SERVER_STT` 허용 |
| 시험 4개 | 신규 | 어댑터(형식·오류·타임아웃·글 미기록)·유스케이스(형식·길이·한도·빈 결과)·라우트(200/400/401/409/422/429/502/504)·ASK SERVER_STT 수락 |
규모 [추측] 소스 약 350~500줄 + 시험 약 400줄, 스키마 0·네이티브 0·nginx 0·의존성 0.

**S2 화면(데모 승인 뒤)**: `capture.ts`·`pcm.ts` 그대로 + 신규 클라이언트 WAV 쓰기(44바이트 머리)·`useDictation` 훅(30초 상한·abort·오류 매핑)·`src/components/ask/*` 입력 바 마이크.

**데모(designer)에 알려 줄 값**:
- 녹음: 탭해서 시작·탭해서 끝(D3 ★와 맞음), **최대 30초**, 25초부터 남은 초 표시, 30초에 자동 종료.
- 녹음 종료 직후 「받아쓰는 중…」 + 경과 초. **6초**를 넘으면 「조금 더 걸리고 있어요」, **15초**에 실패 「지금은 받아쓰기가 어려워요」 + [다시 말하기] [글자로 쓰기].
- 받아쓴 글: 섞어 말하기에서 일본어가 바뀌는 실측 때문에 **D4 는 B(입력창에 채워 확인·고친 뒤 보내기) 권고**로 바꿀 근거가 있다 — A 를 유지한다면 말풍선에 [고치기]가 꼭 있어야 한다. 입력창 아래 한 줄 「일본어 단어가 다르게 적히면 고쳐서 보내 주세요」.
- 0.5초 미만·빈 결과: 「잘 안 들렸어요. 다시 말해 주세요」. 한도: 분당 6(「잠시 후 다시」), 하루 100.
- 언어(D5): 자동 인식 ★ 유지 가능(한국어·일본어 단독은 정확). 언어 칩은 자동 감지 비용 1.9초를 줄이지만 섞어 말하기를 고치지 못한다.
- 「말 끝 → 답」 총 약 17~22초(받아쓰기 4~6초 + 답 약 13초) — 받아쓰기 단계 문구가 끝나면 기존 질문 단계 문구로 넘어간다.

**막힌 점·Leader 결정 필요**: ① D4 A↔B(데모 질문) ② 섞어 말하기 대안(`ja` 두 번째 받아쓰기) 추가 실측 3~6회 승인 여부 ③ `RequestTrace` 미기록 vs `TraceKind` enum 추가(DB) ④ 새 경로 번호 #181 확정.

## Developer 기록

- [착수] 읽음: task-066 이력서·task-064 「기술 사실」·D13·97행, VoiceVault `whisper-service/main.py`(운영 릴리스 파일과 `diff` 동일)·`ecosystem.config.js`, TheKaiwa `fasterWhisper.provider.ts`·`speech/common/.../whisper_http.py`·`engine/stt/index.ts`·`speech.config.yml`·`speech/test-assets/README.md`.
- [체크포인트 1] 사실 수집 완료. M4 SSH 접근 확인(`say` Yuna ko_KR·Kyoko ja_JP 있음).
- [체크포인트 2] 표본 10개 생성(M4 `say` 7 + stt20 재사용 2 + 잡음 1) → whisper 12회 직렬 실측 완료(호출 전마다 서비스 CPU 1초 표본으로 한가함 확인, 호출 간 2초 쉼) → CER 계산. 오디오 경로·nginx(운영 = 저장소)·Capacitor 권한·api-contract §0-2·§0-5·#21·§2-18-A·`InputSource`·`TraceKind`·`askLimits` 확인 → 위 1~8절 작성.
- 주의점: `say` 섞음 표본은 목소리 두 개를 이은 것(실제 억양과 다름). 자동 감지 비용 1.9초는 2쌍 비교라 표본이 작다. 진짜 콜드 미측정.
- 미커밋 파일: 이 파일 1개(신규). 저장소의 다른 파일 변경 0.
- [완료 07:10] VoiceVault 기동 로그로 콜드 적재 시간 보강, 한도 반환 규칙을 실제 `turnRoute.ts:36-44` 에 맞춰 정정. scratchpad 오디오 12개(wav 10·webm 2) 삭제 — 남은 것은 스크립트·기준 문장·결과 JSON(합성 표본의 받아쓴 글만, 사용자 데이터 없음). `git status`: 이 파일 외 내 변경 0. 20-Log 일일 로그는 지시(쓰기 파일 1개 한정)에 따라 쓰지 않음 — Leader 몫.
