---
tags:
  - type/decision
  - domain/speech
  - domain/app
date: 2026-09-26
---
# 결정: 음성 처리 스택 배치 (사용자 확정 2026-09-26)

| 항목 | 결정 | 이유 |
|---|---|---|
| 실시간 STT | **온디바이스 네이티브 플러그인**(`@thekaiwa/sherpa-stt`, Kotlin + sherpa-onnx Android AAR + `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` int8) | 사용자 요구 "휴대폰이 처리를 분담". WASM 보다 3~5배 빠르고 멀티스레드·배터리 효율. 모델(≈148MB)은 APK 에 넣지 않고 첫 실행 시 `/models/reazonspeech-int8/manifest.json` 으로 다운로드 → 모델 갱신에 APK 재설치 불필요 |
| 실시간 폴백 | 우분투 gateway(FastAPI+WS, 127.0.0.1:8100, 같은 모델) | 웹 브라우저·저사양 기기·플러그인 오류 2회 시. 라우터가 device capability 로 선택 |
| "실시간"의 실체 | silero VAD 세그먼트 → 오프라인 zipformer 디코드(CPU RTF 0.05) | 스트리밍 JA ReazonSpeech 모델이 없음. 5초 발화 디코드 ≈0.3s 라 체감 실시간 |
| 분석 STT | VoiceVault whisper-service 재사용(127.0.0.1:8090, medium int8) | 이미 가동 중, 배치 경로라 지연 무관. 정확도 부족 시 전용 인스턴스(large-v3-turbo) |
| TTS | **Style-Bert-VITS2 on 맥 M4**(`~/kaiwa-tts-run`, :8200) | 우분투 GPU 없음·CPU 미상, M4 는 Apple Silicon·24GB 여유, 우분투→M4 LAN 호출 선례(home-m4-api). AGPL 은 별도 디렉토리·HTTP 경계로 격리 |
| 서비스 실행 | 우분투 pm2+venv(VoiceVault whisper 방식), Redis 없이 MariaDB `SpeechJob` 폴링 | 워크스페이스 표준·deploy.yml·와치독 편입 용이, 1인 앱 처리량 |
| 발음 분석 | 음성 Phase 3: narabas(MIT, wav2vec2 일본어 음소 정렬) + pyopenjtalk(기대 음소·모라·악센트) + pyworld F0 | 기획서 "범위 밖"이었으나 음성 기획안 §9·§21 로 로드맵 편입. Phase 2 신뢰도 데이터가 게이트 |
| APK 갱신 | 네이티브 변경 시 deployer 가 APK 재빌드·배포본·안내(`<apk_release>`), 앱은 `/api/app/version` 배너 | 사용자 지시: 재설치가 필요해지면 그때 새로 빌드해 업데이트할 수 있게 하고 역할을 지정 |

**실측 게이트(task-003)**: ① S25+ 온디바이스 디코드 ≤0.8s·RSS ≤600MB ② gateway 동일 ③ M4 SBV2 1문장 ≤1.0s ④ 인식률 20문장 ≥16 ⑤ 모델 다운로드 160MB 재개 ⑥ 우분투 메모리. 못 맞추면 목표 재정의는 사용자 결정.

**근거**: `docs/design-spec.md` §9, `docs/design/speech-platform/00-conflict-review-and-domain-model.md`, `docs/음성처리-기획안-원본.md`.
