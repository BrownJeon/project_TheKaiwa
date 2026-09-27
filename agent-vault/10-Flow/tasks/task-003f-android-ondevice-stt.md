---
task_id: task-003f
title: "안드로이드 앱(Capacitor 셸) + 온디바이스 STT 플러그인 + 모델 배포 + APK 배포본·배너"
status: in-progress
base_ref: 218664e
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer, codex]
related_tasks: [task-003e-stt-gateway-web, task-007-talk-voice-web, task-002-phase0-scaffolding]
native_change: true
tags:
  - type/task
  - domain/app
  - domain/speech
  - domain/stt
aliases:
  - 안드로이드 앱
  - 온디바이스 STT
  - task-003f
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-003 중 남은 **앱·온디바이스** 부분 — 같은 운영 웹을 Capacitor 안드로이드 앱(WebView `server.url`)으로 감싸고, 앱에서는 **휴대폰 안에서** 음성을 인식한다(`@thekaiwa/sherpa-stt` — Kotlin + sherpa-onnx AAR + ReazonSpeech int8, 모델은 첫 실행 때 서버에서 받는다). 안드로이드 기본 STT/TTS 는 쓰지 않는다.
완료 기준(§15): APK 로그인 유지, 온디바이스 20문장 partial/final, 모델 다운로드→재사용, gateway 폴백 동일, 실측 게이트(S25+ 5초 발화 디코드 ≤0.8s·RSS ≤600MB·모델 160MB 다운로드·재개), deployer APK.

**⚠ 네이티브 변경 고지(CLAUDE.md 금기 — "고지·versionCode 증가 없이 배포 금지")**: 이 task 는 `android/`·`plugins/sherpa-stt/`·Manifest·Capacitor 설정을 만든다 → 사용자에게 착수 전 고지함(2026-09-28 Leader 보고), 첫 APK `versionCode 1`. 설치·실기기 확인은 **사용자 폰**이 필요 — 빌드·배포본·배너까지는 팀이 끝내고 그 지점에서 사용자에게 요청한다.

정본: design-spec §9(온디바이스 플러그인·클라이언트 라우팅·gateway 폴백)·§12(앱·APK 갱신) · `plugins/sherpa-stt/README.md`(레이아웃·API·이벤트·모델 규약 — 설계 골격) · `speech/models/README.md`·`manifest.example.json`·`fetch_models.py` · `docs/design/api-contract.md` #5 app-exchange·#8 `/api/app/version`·#9·#10 `/models/*`·#19 speech config(`onDevice` 절 — 003e 에서 웹은 세부 없음)·`/app/download` · `docs/design/module-dependency.md` §6(플러그인 경계·`infra/native/bridge.ts` 만 `window.Capacitor`) · `docs/design/speech-platform/*`(RealtimeSttClient·modeResolver·OnDevice) · `docs/design/domain-model.md` AppRelease·Utterance(`realtimeEngine`) · 워크스페이스 `../docs/app-conversion-guide.md`(보정 5종·빌드 환경·실기기 5항목) · 참고 구현 `../VoiceVault/scripts/build-apk.sh`·`../VoiceVault/android`·`../TheMeal/android`.

## 관련 과거 이력 요약
- [[task-002-phase0-scaffolding]]: `capacitor.config.ts`(appId `com.miraclepenguin.kaiwa`, 퓨니코드 server.url, androidScheme https), `@capacitor/*` 7 의존성, `infra/native/bridge.ts`(window.Capacitor 전역만), 앱 로그인 서버 경로(`/api/auth/complete` → 60초 `AppAuthCode` → `thekaiwa://auth/callback` → `/api/auth/app-exchange`) 완비. `android/` 는 아직 없음. nginx 의 APK `/app/download/` 는 alias 대신 앱 라우트 프록시로 conf 수정됨(적용은 task-009 전 사용자 sudo 1회).
- [[task-003e-stt-gateway-web]]: gateway(같은 ReazonSpeech int8 + silero VAD, `speech/models/reazonspeech-int8` 로컬 보관), 앞 0.4s·뒤 0.2s 무음 패딩(없으면 첫 단어 누락 — **온디바이스도 같게**), 클라 `@/modules/speech/stt/client`(WebSocketSttClient·RealtimeSttClient 인터페이스·`SttEvent`), 티켓·Utterance 콜백. #19 `onDevice.model` 엔진명 표기 결정은 이 task 로 이월.
- [[task-007-talk-voice-web]]: 회화방·푸시투토크·`useRealtimeStt`(final `utteranceId`)·턴 `utteranceId` 연결(소유자·미연결·10분). 온디바이스 final 은 wav 를 앱이 업로드(#21 `POST /api/v1/speech/utterances`)해 `utteranceId` 를 받는다.

## Leader's Plan (2026-09-28)

### 범위 결정
- **F1 셸(developer A)**: `npx cap add android` 로 루트 `android/`(Capacitor 7) 생성 → 보정 5종(`../docs/app-conversion-guide.md` §1: `MainActivity.onPause` 쿠키 flush·키보드 가림(`adjustResize`+웹 `KeyboardInset`)·edge-to-edge(`adjustMarginsForEdgeToEdge`)·androidScheme https·퓨니코드) + Manifest(딥링크 `thekaiwa://auth/callback` intent-filter·`singleTask`·`RECORD_AUDIO`·`INTERNET`) + 아이콘(`gen-app-icons` 참고)·`versionCode 1`/`versionName 1.0.0`·디버그 서명(키스토어 백업 위치 기록, 커밋 금지)·`.gitignore`(`android/build`·`.gradle`·`local.properties`·키스토어). NFS noexec → **빌드는 미러에서만**(sync-local 이 android/ 를 보호 필터로 동기화 — 이미 구현).
- **F2 플러그인(developer A, Kotlin)**: `plugins/sherpa-stt/` README 레이아웃대로 — `SherpaSttPlugin`(`checkPermissions/requestPermissions`·`checkModel`·`downloadModel`(manifest·Range 재개·sha256·원자적 전환·진행 이벤트·Wi-Fi 전용 기본)·`start`(VAD silenceMs 등·partial)·`stop`·`release`, 이벤트 `vad`·`partial`·`final{text,durationMs,wavPath}`·`downloadProgress`·`error`), `AudioCapture`(16kHz mono PCM16 40ms), `VadSegmenter`(silero), `Recognizer`(OfflineRecognizer zipformer int8, 백그라운드 스레드, **앞 0.4s·뒤 0.2s 패딩**), `ModelStore`·`ModelDownloader`·`WavWriter`. sherpa-onnx AAR **버전 고정**(gateway 와 같은 계열, arm64-v8a 우선) — README·CHANGELOG 기록. 플러그인 TS(`definitions.ts`·`index.ts`·`web.ts` stub)는 계약 문서 역할(웹 번들은 import 안 함).
- **F3 웹 쪽 연결(developer B)**: `infra/native/bridge.ts` 에 SherpaStt 래퍼(전역만, 없으면 조용히 undefined) → `speech/stt/client/OnDeviceSherpaClient`(RealtimeSttClient 구현, 이벤트를 `SttEvent` 로 정규화, final 시 wav 업로드 #21 → `utteranceId`) → **라우팅**: 플러그인 있음 + 모델 설치됨 + 설정 모드(AUTO/OFFLINE 등, `modeResolver`) → 온디바이스, 그 외·오류 2회 → WebSocket(gateway). `Utterance.realtimeEngine` 은 서버가 connection key 로 기록(클라가 엔진명을 모름). 설정 화면: **모델 내려받기 카드**(크기·Wi-Fi 안내·진행률·재개·완료 후 "휴대폰에서 인식" 표시), 마이크 테스트·회화방이 같은 라우터 사용. 앱 로그인(Custom Tabs → 딥링크 → app-exchange)이 실제로 붙어 있는지 확인·보완. **APK 업데이트 배너**(`/api/app/version` + `X-App-Version`, 앱에서만, 웹은 없음).
- **F4 서버(developer B)**: `/models/reazonspeech-int8/manifest.json`·`/models/reazonspeech-int8/<version>/<file>`(공개, Range·ETag·sha256, 경로 탈출 금지, 파일은 `speech/models/` 또는 DATA_ROOT — 결정·기록), `/api/app/version`(AppRelease 최신·minSupported·reinstallRequired), `/app/download/latest.apk`(DATA_ROOT/releases 스트리밍, Content-Disposition). #19 `onDevice` 절(모델 manifest URL·버전·VAD 파라미터 — **엔진명 표기 결정: 사용자 응답엔 `model` 을 불투명 id(`ondevice-ja-v1` 류)로**, 실제 모델명은 manifest 에만).
- **F5 빌드·배포본(deployer, Haiku)**: `scripts/build-apk.sh`(우분투 JDK 21·`~/.node-local/android-sdk`, 미러에서 `cap sync android` → `gradlew assembleDebug`) → sha256 → `DATA_ROOT/releases/thekaiwa-1.0.0.apk` + `latest.apk` 링크 → `AppRelease` 행(versionCode 1, minSupported 1) → `/api/app/version`·다운로드 확인. APK 는 커밋 금지.
- **F6 실기기(사용자 폰 — 팀은 여기서 멈추고 요청)**: 설치 → 로그인 유지(종료 후 재실행)·키보드·상태바·딥링크·마이크 권한 → 모델 다운로드(Wi-Fi, 재개)→ 온디바이스 20문장(`speech/test-assets/stt20` 을 사람이 읽거나 폰 스피커 재생) partial/final·디코드 시간·RSS(앱 내 진단 표시 또는 `adb`) → gateway 폴백(모델 삭제·비행기 모드 등) 동일 동작 → 회화 30턴 p50 ≤5s(task-007 이월).

### 구현 전략 · 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §11 앱 전용: 모델 내려받기 카드(설정 음성 인식 절)·진행/재개/실패·Wi-Fi 안내, APK 업데이트 배너(강제/권장), 앱 로그인(Custom Tabs 대기·실패), 앱 마이크 권한 거부(설정 이동), 온디바이스/서버 인식 표시(엔진명 없이) | 1 |
| developer A (Opus) | F1 셸 + F2 플러그인(Kotlin) + 빌드 실측(미러에서 assembleDebug 성공까지) + 플러그인 단위 테스트(가능한 범위 — JVM 테스트) | 1 |
| developer B (Opus) | F3 웹 연결 + F4 서버 라우트 + 화면(designer 후) + 단위 테스트 | 1(서버)·2(화면) |
| deployer (Haiku) | F5 빌드 스크립트·배포본·AppRelease·배너 확인 | 3(QA 후) |
| judge·codex | intake · C1(설계 — 모델 다운로드 무결성·딥링크·WebView 설정) · C2(보안) | |
| reviewer·qa | 네이티브 고지·versionCode·권한·딥링크 코드 탈취·모델 무결성·경로 탈출·엔진명·웹 번들에 네이티브 import 0·폴백 | |

### 완료 기준 (qa — 폰 없이 확인 가능한 것)
1. tsc·lint·test 통과, 격리 build exit 0, **`assembleDebug` 성공**(APK 생성·크기 기록, arm64-v8a).
2. 웹 번들에 `@capacitor/*`·`@thekaiwa/sherpa-stt` import 0(ESLint·경계 테스트), PC 브라우저 화면 회귀 0(플러그인 없으면 gateway).
3. `/models/*`: manifest·파일 200/206(Range)·ETag·sha256 일치, 경로 탈출 404, 공개.
4. `/api/app/version`·`/app/download/latest.apk`: AppRelease 기준 응답, 다운로드 sha256 = 기록값.
5. OnDeviceSherpaClient·라우터 단위 테스트(가짜 플러그인: 이벤트 정규화·wav 업로드·utteranceId·오류 2회 폴백·모델 미설치 → gateway).
6. 플러그인: Kotlin 컴파일·(가능하면) JVM 단위 테스트 — 패딩·세그먼트·manifest 검증·Range 재개 로직.
7. 화면(designer §11): 모델 카드·배너·권한 문구 3폭(웹에서는 숨김 확인 + 가짜 bridge 로 앱 모드 렌더).
8. 엔진명 사용자 노출 0(#19 `onDevice.model` 불투명 id).
9. **폰 필요(F6)** — NOT_VERIFIED 로 남기고 사용자 요청 목록으로 정리.

### 네이티브 변경
**있음** — `android/`(신규)·`plugins/sherpa-stt/android`(신규)·Manifest·`capacitor.config.ts`(필요 시). 첫 배포본 `versionCode 1`. 이후 이 파일들이 바뀌면 versionCode 증가 + deployer APK 재빌드 + 배너.

## 판단 기록 (judge)

## Codex 검토

## Designer 기록

## Developer 기록

### A(앱·플러그인)

### B(웹·서버)

## Reviewer 기록

## QA 기록

## Deployer 기록

## 최종 요약
