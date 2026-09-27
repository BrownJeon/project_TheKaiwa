---
task_id: task-003e
title: "STT gateway(우분투) + 웹 실시간 음성 인식 폴백 + 마이크 테스트"
status: in-progress
base_ref: b4feaa5
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, codex]
related_tasks: [task-003d-tts-p0, task-005-settings-attendance, task-005b-admin-console-skeleton]
tags:
  - type/task
  - domain/speech
  - domain/stt
aliases:
  - STT gateway
  - 웹 음성 인식
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-003 중 **STT 서버 경로(gateway) + 웹 폴백** — 폰 없이 끝낼 수 있는 범위(온디바이스 플러그인·Capacitor·APK 는 003f).
완료 기준(§15 해당분): gateway 폴백으로 20문장 partial/final, 우분투 `127.0.0.1:8100` WS `/ws/speech`(nginx 경유 `wss://kaiwa…/ws/speech`), 티켓 인증, 발화 wav 저장 + Utterance 행, 실측 게이트(STT 항목).
정본: `speech/README.md`(구성도·호스트·포트·실행·env), `speech/gateway/{README.md,interfaces.py}`, `speech/common/README.md`, `speech/speech.config.yml`, `docs/design/api-contract.md` #19·#20·#21·#142(`/ws/speech` 프로토콜 `v:1`)·`/api/internal/speech/utterances`(grep "internal/speech")·§0-3 WS 티켓·§0-8, `docs/design/speech-platform/00~15`(STT 관련: 실시간 경로·RealtimeSttClient·modeResolver·VAD·ReazonSpeech·gateway), `docs/design/domain-model.md`(Utterance·UserSpeechSetting), `docs/design/module-dependency.md` L4·§4-1·§5, `docs/design/configuration-resolution.md`.

## 관련 과거 이력 요약
- [[task-003d-tts-p0]]: M4 TTS `:8200` 상시(20문장 테스트 음성 생성에 사용 가능 — 앱 `POST /api/v1/speech/tts` 또는 M4 `/synthesize`+`TTS_SERVICE_SECRET`). 시크릿 분리 원칙(Codex C1): gateway·internal 콜백은 `SPEECH_INTERNAL_SECRET`, TTS 는 `TTS_SERVICE_SECRET`.
- [[task-005-settings-attendance]]: 설정 음성 인식 4모드(`UserSpeechSetting`, `speech/stt/modeResolver`, 웹 OFFLINE → GATEWAY).
- [[task-005b-admin-console-skeleton]]: engine registry·Health(reazon-gateway connection 은 서비스 없음 → UNAVAILABLE).
- 운영 주의: 운영 pm2 `APP_ENV=LOCAL`(LOCAL connection 공유), 미러에서 build 금지(격리 복제본), dev 화면은 `localhost:3011`, NFS noexec(Python venv 는 `~/.node-local/thekaiwa-speech/venv`).

## Leader's Plan (2026-09-28)

### 범위 결정
- **E1 분할**: 003e = gateway(Python) + 웹 WebSocketSttClient + 티켓·config·internal 콜백 + 설정 화면 **마이크 테스트**(말하면 인식 결과가 보이는 점검용). 회화 화면 연결은 task-007, 온디바이스는 003f.
- **E2 모델**: ReazonSpeech `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` int8 + silero VAD, `speech/models/`(git 미추적) 에 다운로드 스크립트로 받는다. 같은 모델을 003f 온디바이스가 쓴다.
- **E3 테스트 음성**: M4 TTS 로 20문장(짧은 인사~긴 문장, 숫자·조사 포함) wav 를 만들어 `speech/test-assets/`(git 미추적 또는 작은 파일만) — STT 정확도(CER)·지연 측정용. 사람 목소리 실측은 003f 실기기.
- **E4 운영**: gateway 는 우분투 pm2 `thekaiwa-speech-gateway`(`127.0.0.1:8100`, venv), `ecosystem.config.js` 항목 추가. QA PASS 후 Leader 가 pm2 기동(사용자 자율 진행 지시). nginx `/ws/speech` 는 이미 적용됨.
- **E5 보안**: 티켓 JWT(`aud:"ws-speech"`, 60초, 1회성 권장), 원음·전사 전문은 로그·Trace 금지, internal 콜백은 `SPEECH_INTERNAL_SECRET`(헤더 없으면 404), 업로드 상한(≤60s·≤2MB), DATA_ROOT 밖 경로 금지, 오디오 보존 30일.

### 구현 전략 · 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §8 마이크 테스트(설정 → 음성 인식 절 안): 권한 요청·녹음 중 표시·partial/final·오류(권한 거부·서버 불가·티켓 만료)·3폭 | 1 |
| developer A (Opus, Python) | `speech/common`(엔진 인터페이스·sherpa ReazonSpeech 래퍼·VAD·설정)·`speech/gateway`(FastAPI WS, 티켓 검증, 세그먼트 디코드, partial/final, wav 저장, internal 콜백)·모델 다운로드 스크립트·requirements·pytest·`ecosystem.config.js` gateway 항목·테스트 음성 생성·STT 실측 | 1 |
| developer B (Opus, TS) | #19 config·#20 ticket·#21 utterances·`/api/internal/speech/utterances`·Utterance 저장/보존·`speech/stt` RealtimeSttClient·WebSocketSttClient(AudioWorklet PCM16 16kHz 40ms)·설정 마이크 테스트 화면·관리자 Health 연결·스모크 | 1(화면은 designer 후) |
| judge·codex | intake·C1·C2 | |
| reviewer·qa | 보안(티켓·시크릿·경로·업로드)·프로토콜·정확도 게이트 | |

### 완료 기준 (qa)
1. tsc·lint·test(앱) + pytest(gateway) 통과, 격리 build exit 0.
2. `POST /api/v1/speech/ticket` → 60초 티켓, 만료·위조·aud 불일치·재사용 거부. WS `start` 없이 오디오 → 종료.
3. 테스트 음성 20문장 → gateway final 텍스트 CER 측정(목표 기록: CER ≤10% 권장), 세그먼트당 디코드 지연 p50·발화 끝→final p50, RTF, 메모리(ReazonSpeech 상주 ≈0.5GB 예상).
4. final 마다 wav 저장(DATA_ROOT, 경로 = id 기반) + `Utterance` 행(소유자·realtimeText·realtimeEngine 스냅샷) — internal 콜백 인증(헤더 없음 404·틀림 401).
5. 웹 마이크 테스트: 브라우저에서 권한 → 말하기 → partial/final 표시(실제 마이크 대신 Playwright fake audio(`--use-file-for-fake-audio-capture`)로 테스트 음성 재생해 확인), 권한 거부·서버 불가 문구.
6. 사용자 응답·화면에 엔진명(reazon·sherpa 등) 0, 로그·Trace 에 전사 전문·원음 0.
7. 관리자 콘솔 reazon-gateway Health HEALTHY.
8. 360/390/412 가로 넘침 0·터치 ≥44px.

### 네이티브 변경
없음(003f 에서).

## 판단 기록 (judge)

- [2026-09-27 09:15] intake engine=jev → task_type=feature / risk=R2 / developer_model=opus / next=ask_user | overrides=- | fallback=- | tokens=1084
  - **override**(Leader): `next=ask_user` 미적용 — 사용자 지시(2026-09-28 "사용자가 필요할 때까지 계속 작업 진행")와, 테스트 계획(M4 TTS 20문장·CER 기록 목표 ≤10% 권장·지연·RTF·메모리)이 Leader's Plan 완료 기준 3 에 확정돼 있어 물을 미결이 없다. risk=R2 채택.
- [2026-09-27 09:16] codex_gate/C1 engine=jev → codex_required=false / focus=security / budget_rule=CX-limit-unknown-r2 / codex_switch=on | overrides=- | fallback=- | tokens=876

## Codex 검토

## Designer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
