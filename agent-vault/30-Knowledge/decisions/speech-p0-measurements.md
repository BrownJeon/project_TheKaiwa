---
tags:
  - type/decision
  - domain/speech
  - domain/tts
date: 2026-09-27
aliases:
  - 음성 P0 실측
  - TTS P0 실측
---
# 음성 P0 실측 게이트 기록

> 출처 task: [[task-003d-tts-p0]] · 서비스 정본: `speech/tts-service/README.md` §2·§6 · 설계: `docs/design/speech-platform/16-tts-productization-layer.md`.
> STT(gateway·온디바이스) 절은 task-003e·003f 가 이 문서에 이어 붙인다.

## TTS — M4 tts-service (developer A, 2026-09-27 22:00~22:17)

**조건**: 맥 mini M4 24GB · Python 3.11.16 · style-bert-vits2 2.5.0 · torch 2.14.0(MPS) · transformers 4.57.6 · 모델 3종 상주(jvnv-F1/F2/M1-jp, JP-Extra, 44.1kHz) · 서비스 코드 `7d51c48` 을 임시 포트 8299(127.0.0.1, 일부 0.0.0.0)로 띄워 측정. 8200 상시 기동·crontab 은 하지 않았다(사용자 승인 게이트). 측정 도구 `speech/tts-service/scripts/bench_synth.py`(문장 20개, 평균 19.3자, 음성 평균 2.9s). 지연은 서버 헤더 `X-Kaiwa-Latency-Ms`(대기+합성+인코딩) 기준, 괄호는 클라 왕복.

| 게이트 항목 | 목표(task-003d 완료 기준 9) | MPS | CPU | 판정 |
|---|---|---|---|---|
| 20자 문장 합성 p50 (캐시 MISS = 서비스 매 요청) | ≤1.0s | **0.24s** (M4 로컬 0.24s / 우분투 LAN 0.245s) | 0.41s | ✅ |
| 같은 p95 | — | 0.31s (2회차 0.25s) | 0.44~0.47s | ✅ |
| 캐시 HIT ≤0.12s | 앱 쪽(B) | — | — | 앱 캐시 측정은 developer B |
| 콜드 스타트(프로세스 기동 → `warmedUp`) | 기록 | **6~7s**(서비스 내부 4.6~5.1s = BERT+모델 3종 로드 2.3s + 워밍업 1.1s) | 6s(내부 4.0s) | 기록 |
| 메모리 | 기록 | footprint **≈3.3GB 고정**(RSS ≈1.2GB + GPU ≈2.6GB) | footprint 1.9→2.4GB, RSS 3.4~3.9GB | 기록 |
| Ollama 동시 부하 | 기록 | **미측정**(아래 사유) | — | ⏸ |

**세부**

| 측정 | MPS p50 / p95 | CPU p50 / p95 |
|---|---|---|
| 모델별 plain(F1 · F2 · M1) | 0.24 / 0.30 · 0.24 / 0.30 · 0.24 / 0.26 | F1 0.41 / 0.44 · M1 0.43 / 0.44 |
| `intonation` 1.1 (pyworld 후처리) | 0.66 / 0.71 | 0.81 / 0.93 |
| `pitch` 1.1 + `intonation` 1.15 | 0.68 / 0.80 | — |
| `speed` 0.8 (음성 2.9→3.7s) · 0.6 (→4.7s) | 0.30 / 0.31 · 0.32 / 0.33 | 0.47 / 0.52 · — |
| 우분투 → M4 LAN 추가 | ≈7ms | — |
| 동시 5건(직렬화) | 대기 0 → 0.32 → 0.56 → 0.79 → 1.03s, 합성 각 0.23~0.33s | — |
| 짧은 문장 「はい。」 「そうですね。」 | 0.25~0.35s(처음 보는 길이는 아래 주의) | — |

## 발견·결정 (TTS)

1. **MPS 캐시 누적 = 메모리 누수처럼 보임 → 매 합성 뒤 `torch.mps.empty_cache()` 로 해결(코드 반영).** 문장 길이마다 텐서 모양이 달라 MPS 캐시 할당이 요청당 ≈45MB 씩 쌓였다(80회에 footprint 4.6→7.4GB, 서비스로는 ≈200회 뒤 8.8GB). 비운 뒤 80회 내내 ≈3.0GB(1모델)·≈3.3GB(3모델) 고정, 지연도 p95 0.93→0.34s 로 오히려 좋아졌다. Ollama(qwen 14b ≈9GB)와 24GB 를 나눠 쓰므로 이 처리 없이는 상시 운영 불가였다.
2. **MPS 셰이더 컴파일 — 처음 보는 문장 길이(음소 수)에서 1회 +0.5~1.1s**(예 「はい。」 첫 1.45s → 이후 0.25~0.31s). 컴파일 결과는 macOS 디스크 캐시라 **프로세스 재기동 뒤에도 유지**(재기동 직후 같은 문장 0.25s). 쓰일수록 사라지는 일회성 비용이라 P0 게이트에는 영향 없음. 필요하면 배포 후 길이 스윕(`bench_synth.py`)으로 미리 데워 둘 수 있다.
3. **pitch·intonation ≠ 1.0 은 문장당 +0.4s**(SBV2 가 pyworld harvest 로 F0 를 고쳐 재합성, 음질 약간 저하). p50 0.66s·p95 0.8s 로 목표 안이지만, speech-platform/16 §4.3 매핑표에서 ENCOURAGING(×1.1)·CALM(×0.95)·EMPHASIS(×1.15) 가 intonation 을 바꾸므로 그 라벨 문장은 이 비용을 낸다. |x−1|<0.005 는 1.0 으로 스냅해 불필요한 후처리를 막았다. 더 줄이려면 harvest 대신 dio(+stonemask) 자체 후처리(≈−0.15s 추정)를 래퍼에 둘 수 있다 — 음질 비교 후 결정(후속).
4. **MPS 유지(기본)**: plain 0.24s vs CPU 0.41s. CPU 도 목표 안이라 MPS 실패 시 자동 CPU 폴백(health `DEGRADED`)은 실사용 가능한 수준이다.
5. **악센트 확인**: `/g2p` 가 雨 `ア↓メ` / 飴 `ア↑メ`, 橋 `ハ↑シ↓(オ)` / 箸 `ハ↓シ(オ)` 를 구분 — 발음 사전·정규화 검증 도구로 쓸 만하다. 숫자는 엔진도 `3時15分に2,500円` → `三時十五分に二千五百円` 으로 읽지만 앱 정규화(§3)가 먼저 처리한다.
6. **SBV2 라이브러리가 합성 문장 전문을 INFO 로그에 찍는다**(`tts_model.py` "Start generating audio data from text") → 래퍼가 SBV2 loguru 를 ERROR 로 낮춤(DEBUG 때만 전문).

## Ollama 동시 부하 — 미측정 사유와 사용자 승인 후 명령

- 이번 task 권한은 "home-m4-api 에 가벼운 요청" 까지인데, 앱 `.env` 의 `AI_API_BASE`·`AI_API_KEY_REF` 가 비어 있어 home-m4-api 자격 증명이 없고, Ollama(11434) 직접 호출은 "M4 다른 서비스 건드리기" 금지 범위다. 측정 당시 Ollama 에는 bge-m3(0.66GB)만 올라 있었고 qwen2.5:14b(9GB)는 내려가 있었다 — 로드 자체가 9GB 라 "가벼운 요청" 이 아니다.
- 승인 후(8200 기동 뒤, M4 에서):
  ```bash
  # 터미널 1: qwen 추론 1회(수십 초)
  curl -s http://127.0.0.1:11434/api/generate -d '{"model":"qwen2.5:14b-instruct","prompt":"日本語で自己紹介を300字で書いてください。","stream":false,"keep_alive":"60s","options":{"num_predict":400}}' >/dev/null &
  # 터미널 2: 같은 시간대에 TTS 20문장
  ~/kaiwa-tts-run/.venv/bin/python ~/kaiwa-tts-run/speech/tts-service/scripts/bench_synth.py --url http://127.0.0.1:8200 --env-file ~/kaiwa-tts-run/.env --n 20 --label mps-with-ollama
  ```
  비교 기준: 위 표 MPS plain p50 0.24s / p95 0.31s. 메모리는 `footprint $(pgrep -f "uvicorn app:app --app-dir")` 로 함께 기록.
