# speech/test-assets — Functional Test 고정 오디오

> **stt20(task-003e, 2026-09-28)** — STT 실측용 합성 음성 20문장: `stt20/sentences.json`(정답·숫자 표기 후보, 커밋) + `stt20/NN.wav`(16kHz mono PCM16, 앞뒤 무음 0.3s, **git 미추적**) + `stt20/fake-mic-{16k,48k}.wav`(문장 01·09·13 을 2초 간격으로 이은 18초 — Playwright `--use-file-for-fake-audio-capture` 용, 미추적). 생성: `~/.node-local/thekaiwa-speech/venv/bin/python speech/test-assets/make_test_audio.py`(M4 tts-service `/synthesize` 직접, `TTS_SERVICE_SECRET` 은 env 또는 `.env` 에서 읽고 출력 안 함, jvnv-F1/F2/M1 순환, 있는 파일은 건너뜀 — 1회 20호출). **합성음이라 인식률을 과대평가한다** — 사람 목소리 실측은 task-003f 실기기. 아래 `ja-sample.wav`(사용자 녹음)와는 별개다.
>
> 상태: **`ja-sample.wav` 는 아직 없다.** task-003 에서 사용자가 녹음해 이 디렉토리에 두고 커밋한다(수십 KB, 커밋 대상 — `.gitignore` 의 `*.wav` 규칙에서 이 파일만 예외 `!speech/test-assets/ja-sample.wav`).

## 1. 용도

| 사용처 | 방법 |
|---|---|
| 콘솔 `POST /api/admin/v1/engine-connections/{id}/test` (STT 역할) | 이 파일을 전사해 기대 문장과의 정규화 유사도(worker Comparator 규칙) ≥0.9 면 PASS |
| Python `EngineProvider.functional_test(ctx, asset_path)` (gateway·worker) | 같은 파일·같은 판정 |
| P0 실측 ④ 인식률 20문장 | 이 파일은 20문장 중 1번 문장. 나머지 19문장은 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md` 의 목록으로 실기기에서 직접 발화(파일 저장 안 함) |
| Playground STT 탭 기본 입력 | 파일 선택 전 기본값 |

TTS 기능 테스트는 오디오 파일이 아니라 고정 문장(`AppSetting voice.functionalTest.text`, 기본 「今日はいい天気ですね。」)으로 합성해 길이 >0 을 확인한다.

## 2. 녹음 규격

| 항목 | 값 |
|---|---|
| 포맷 | WAV, PCM 16-bit LE, **mono, 16,000 Hz** (플러그인·gateway 입력과 동일) |
| 길이 | 3~5초 |
| 문장 | 고정: **「こんにちは、今日はいい天気ですね。」** — 기대 텍스트는 `ja-sample.expected.txt` 에 같은 문자열로 둔다(정규화 후 비교) |
| 화자 | 사용자 본인(학습자 목소리와 같은 조건). 조용한 실내, 입과 마이크 20~30cm |
| 레벨 | 피크 −6~−3 dBFS, 클리핑 없음, 앞뒤 무음 0.3~0.5초 |
| 금지 | 배경 음악·TTS 로 만든 합성음(합성음은 인식률을 과대평가한다) |

만드는 방법(맥):
```
# 1) 녹음(QuickTime 등) 후 변환
ffmpeg -i raw.m4a -ac 1 -ar 16000 -sample_fmt s16 -af "silenceremove=start_periods=1:start_threshold=-50dB" speech/test-assets/ja-sample.wav
# 2) 확인
ffprobe speech/test-assets/ja-sample.wav   # pcm_s16le, 16000 Hz, mono, 3~5 s
```

## 3. 개인정보

이 파일은 사용자 본인의 음성이며 저장소(Gitea 비공개)에만 있다. Trace·로그에는 파일 경로만 남고 바이트는 남지 않는다. 다른 사람의 음성으로 교체하려면 그 사람의 동의를 먼저 받는다.

## 4. 파일 목록 (예정)

- `ja-sample.wav` — 위 규격
- `ja-sample.expected.txt` — 기대 문장 1줄(UTF-8, 개행 없이)
- `README.md` — 이 문서
