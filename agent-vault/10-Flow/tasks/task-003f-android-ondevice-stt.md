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

### 설계 확정 — designer §11-11 (Leader, 2026-09-28)
- **① 채택(A)**: 플러그인에 `openAppSettings()`(ACTION_APPLICATION_DETAILS_SETTINGS + `package:` URI) 추가, `checkModel()` 반환에 `freeBytes`(선택→채택). 네이티브 계약 v1 → v1.1 로 기록.
- **② 채택(B)**: #19 는 앱 + 온디바이스 연결이 있으면 경로와 무관하게 `onDevice:{enabled, available, model:{id, version, totalBytes, manifestUrl}}` 모델 블록을 늘 싣는다(`enabled` = 경로 선택만).
- **③ 채택(B)**: #8 에 `minSupportedCode:Int`·`latestCode:Int`·`bytes` — 비교는 versionCode 정수로만. `X-App-Version` 은 versionName, 앱 번호는 `App.getInfo().build`.
- **④ 채택**: 강제 업데이트 = 닫을 수 없는 띠(모든 화면), 앱 사용은 막지 않음 + 강제 상태에선 휴대폰 인식 경로 끄고 서버(`UPDATE_REQUIRED`). 전면 차단은 사용자 요청 시.
- **⑤ 앱 이름 = "TheKaiwa"**(capacitor `appName`·로그인 로고와 동일, `strings.xml app_name` 과 화면 상수 `APP_LABEL` 일치). §8-8 ⓐ "일본어교육" 문구는 "TheKaiwa" 로 정합. 사용자가 다른 이름을 원하면 상수·strings 만 교체(최종 보고에 명시).
- **⑥ 채택**: `getSherpaStt()` 호출자 = `OnDeviceSherpaClient` + `speech/stt/client/onDeviceModel.ts`(모델 확인·받기·지우기) 두 곳 — module-dependency §6 에 반영(B).
- **⑦ 채택**: 경로는 **누를 때마다**(녹음 중 아닐 때) 선택, 폴백 카운터(오류 2회)는 앱 실행 단위. speech-platform/12 §3.5 에 각주(B).
- **⑧ 채택**: `model.id` 는 불투명(`ondevice-ja-v1`), manifestUrl 도 모델명 없는 불투명 경로 — 실제 모델명은 manifest 파일 안에만.
- **⑨ 채택(A)**: `capacitor.config.ts server.errorPath` 추가 + `public/app-shell/index.html` 을 TheKaiwa 오프라인 화면으로 교체(TheMeal 템플릿 제거) — 첫 빌드 전.
- **⑩⑪⑮ 채택 — F6 실기기 확인 항목**: APK 받기(Custom Tabs attachment → Chrome 다운로드, 예비 DownloadListener), `thekaiwa://` 302 로 앱 열림, `convertFileSrc(wavPath)` fetch 업로드. 안 되면 F6 결과로 후속.
- **⑫**: 구현값 `X-Client-Platform: app` 을 정본으로 — api-contract §0-10 표기 수정(B).
- **⑬ 채택**: 첫 실행 자동 다운로드 없음(누를 때만), 회화 화면 권유 없음.
- **⑭ 채택(B)**: §11-8 ⓓ 인식 방식 설명 문구 정정.
- **⑯ 채택(B)**: 관리자(`engine.read`)+앱에서만 설정 맨 아래 **휴대폰 인식 진단 카드**(`getDiagnostics()` + 마지막 발화 디코드 시간·RSS) — F6 실측 게이트를 adb 없이 폰에서 읽기 위함.

## 판단 기록 (judge)
- [2026-09-28 08:34] intake engine=jev → task_type/feature complexity/2.75 needs_info/true risk/R2 developer_model/opus next/ask_user | overrides=R2-native | fallback=- | tokens=1020
  - **override**(Leader): `next=ask_user` 미적용 — 사용자 지시(2026-09-28 "사용자가 필요할 때까지 계속 작업 진행"). 사용자만 할 수 있는 것은 F6(폰 설치·실측)뿐이고 계획상 그 지점에서 멈춘다. 네이티브 변경은 착수 전 고지함(Leader 보고). 그 밖의 범위·계약은 정본(design-spec §9·§12·plugins/sherpa-stt/README·api-contract #5·#8~#10·#19)과 Plan F1~F5 에 확정. risk R2(R2-native) 채택.
- [2026-09-28 08:34] codex_gate/C1 engine=jev → codex_required/true mode/adversarial-review focus/security budget_rule/CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=849

## Codex 검토
### [2026-09-28 08:39] C1 adversarial-review focus=security — done
- judge 판정: `mode=adversarial-review, focus=security, budget_rule=CX-limit-unknown-r2` (2026-09-28 08:34) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=218664e(task_file) snapshot=5221fc1
- 지적 4건:
  - **[HIGH]** 딥링크 탈취 (task-003f:39) — 사용자 기기에 악성 앱이 같은 `thekaiwa://auth/callback` 스킴 등록 → 코드 선점 → 세션 획득 위험 / **권고**: Android Verified App Links(assetlinks.json + 서명 지문) + PKCE verifier 결속
  - **[MEDIUM]** Debug APK (task-003f:43) — `gradlew assembleDebug` 배포본 → debuggable variant → WebView 디버깅·쿠키 노출 위험 / **권고**: `assembleRelease` + non-debuggable + 외부 키스토어 관리
  - **[MEDIUM]** Manifest 서명 부재 (task-003f:40) — manifest 자체 unsigned → 중간자·오배포 시 변조/다운그레이드 모델 설치 / **권고**: Ed25519 서명 + APK pinning + 단조 증가 버전
  - **[MEDIUM]** WebView 외부 navigation (task-003f:41) — 외부 URL이 WebView 안에서 열리면 `window.Capacitor` 플러그인 노출 / **권고**: allowNavigation 제한(같은 호스트만) + 외부 링크는 Custom Tabs 강제 + QA 테스트 추가
- 검토하지 못한 범위: F1~F5 실제 구현 코드 (아직 없음, diff 0개), 실제 manifest/Android manifest 파일, runtime 동작, F6 실기기 테스트
- **설계 평가**: 현재 계획만으로는 구현 시 보안 결함이 유지될 위험 — 특히 딥링크 인증 방식을 C1 단계에서 수정 필요
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T233734Z-task-003f-C1/

### C1 지적 판정 (Leader, 2026-09-28 — 설계 단계, 구현 반영은 reviewer 가 확인)
- **C1-1 [HIGH] 딥링크 커스텀 스킴 탈취 → 채택(PKCE 결속, 스키마 변경 없이)**: 앱이 로그인 시작 때 `verifier`(32바이트 랜덤, WebView 메모리 + 복귀 대비 sessionStorage — 10분·1회용이라 세션 토큰 금지 규칙과 별개)를 만들고 `challenge=S256(verifier)` 를 OAuth 시작 요청에 싣는다 → 서명된 state/pending 에 `challenge` 를 함께 서명해 콜백까지 운반 → `complete`(앱 흐름)는 딥링크에 **`code_r`(랜덤)만** 싣고 DB `AppAuthCode.code` 에는 `sha256(code_r + ":" + challenge)` 를 저장 → `app-exchange` 는 `code_r`+`verifier` 를 받아 `sha256(code_r + ":" + S256(verifier))` 로 조건부 소각. 코드를 가로챈 다른 앱은 verifier 가 없어 교환 불가. 기존 1회성·60초·실패 사유 단일화 유지, `next` 는 같은 출처 경로만(오픈 리다이렉트 재확인). **Verified App Links(https 콜백 + assetlinks.json)** 는 PKCE 로 탈취가 무력화되므로 **후속 강화 항목**으로 기록(사이드로드 디버그 서명 앱의 검증 실패 시 로그인이 멈출 위험 대비 실측 후 결정).
- **C1-2 [MEDIUM] debuggable APK 배포 → 채택(새 키 없이)**: 배포본은 **`assembleRelease` + `signingConfig` = 기존 디버그 키스토어**(설계 §12 "디버그 서명 사이드로드" 결정을 유지하면서 debuggable=false), `WebView.setWebContentsDebuggingEnabled(false)`(Capacitor `webContentsDebuggingEnabled:false`), 빌드 스크립트가 `aapt2 dump badging`/`apkanalyzer` 로 `debuggable` 없음을 검사해 있으면 실패. 키스토어는 `~/.android/debug.keystore` → 백업 위치를 기록(커밋 금지). 개발용 debug 빌드는 배포 경로에 올리지 않는다.
- **C1-3 [MEDIUM] manifest 서명 부재 → 부분 채택**: 서명(Ed25519 + APK 핀) 은 **보류** — 이 앱은 WebView 가 같은 서버에서 UI 전체를 받으므로 서버 침해 시 manifest 서명과 무관하게 앱이 장악된다(위협 모델상 이득 작음). 대신 ① manifest·모델 URL 은 **같은 운영 origin 의 https 만**(리다이렉트로 다른 호스트 불가), ② manifest 스키마 엄격 검증(파일 수·이름 패턴·크기 상한·총량 ≤300MB), ③ 파일별 sha256 필수, ④ **다운그레이드 금지**(설치된 버전보다 낮은 manifest 는 거부, 명시적 재설치만), ⑤ `.part` 재개 후 전체 sha256 재검증·원자적 rename. 서명은 후속 강화 항목.
- **C1-4 [MEDIUM] WebView 외부 탐색 → 채택**: `server.allowNavigation` 을 운영 호스트 하나로 한정(또는 비움), 외부 URL·`target=_blank`·302 외부는 시스템 브라우저/Custom Tabs 로(WebViewClient `shouldOverrideUrlLoading` 확인), 플러그인(SherpaStt·Browser) 호출은 운영 origin 문서에서만 가능함을 검증. QA 기준 추가: 외부 링크가 WebView 에 남지 않음.

## Designer 기록

- [09:01] 앱 전용 화면 가이드 완료 → `docs/screens.md` **§11 안드로이드 앱 전용 화면**(11-0~11-11) + 변경 이력 · §2(회화방·설정 행 갱신, 로그인·앱 셸·APK 자산 행 추가, 엔진명 목록에 sherpa·zipformer·onnx) · §8-1·§8-2 B·§8-3 C·§8-8 ⓐ(MIC_DENIED 앱 줄·MODEL_REQUIRED 행)·ⓓ · §9-1·§9-2 G·H 앱/웹 분기 문구 정합. 목업 Artifact 는 만들지 않음(task-006·008 과 같은 방식). 결정 요약:
  - 분기 세 곳 대응표를 §11 머리에 둠 — 모든 앱 요소는 로그인·실시간 인식 경로·APK 배너 중 하나, 웹 DOM 0(마운트 뒤 `useNativeEnv` 판정, 웹은 #8 호출도 없음).
  - **휴대폰에서 알아듣기 카드**(설정 음성 인식 절, 방식 카드 아래·마이크 테스트 위): 사용자 말은 "휴대폰 인식 파일", 크기는 #19 `totalBytes`(≈170MB). 누를 때만 받기·Wi-Fi 기본·모바일 데이터는 "데이터로 받기" 명시 동의(이번 실행만)·일시정지/이어받기/받은 것 지우기·새 버전 받기·지우기 확인 시트. 설명은 "말하는 동안 소리를 서버로 보내지 않아요"까지만(턴 wav 는 #21 로 저장되므로 "목소리가 서버로 가지 않아요" 금지). 받기 전·중에도 회화는 서버 인식.
  - **경로 표시**: 마이크 테스트 = 이유까지 9종 한 줄 · 회화방 = 상시 표시 없음(머리 표시등은 목소리 하나), 전환 안내 1회(말 잃은 오류는 띠 2줄 `switched`, 아니면 토스트) + ⋯ 메뉴 "알아듣는 곳" 읽기 전용 줄. 경로는 **누를 때마다** 선택, 전환 카운터는 앱 실행 단위.
  - **권한(앱)**: 첫 누름 = `requestPermissions()` 만(A 의 "진입 전 요청"을 화면 규칙상 첫 누름으로), `prompt-with-rationale` 안내 줄, `denied` → [앱 설정 열기] + resume 재확인.
  - **업데이트 띠**: 셸 그리드 첫 행. 권장(닫으면 그날 KST 숨김·새 번호면 다시·집중 화면 숨김) / 강제(닫기 없음·모든 화면·로그인 포함, 전면 차단은 안 함 + 휴대폰 경로 끔). 받기 = Custom Tabs, 설치 방법 시트 4단계, 설정 맨 아래 앱 버전 줄.
  - **앱 로그인**: opening → waiting 카드([Chrome 창 다시 열기]) → exchanging 덮개 / `browserFinished` 1.5초 뒤 딥링크 없으면 "창이 닫혔어요". PKCE(C1-1)는 화면 변화 없음, `app_code_invalid` 문구 하나로 통일. 오류 문구 해요체. 초대 뒤 Custom Tab 에 "앱으로 돌아가기".
  - 기타: `public/app-shell/index.html` 이 TheMeal 템플릿 그대로 → 첫 빌드 전 교체(A, 네이티브) · 관리자 전용 **휴대폰 인식 진단 카드**(F6 디코드·RSS 를 adb 없이) · PC 앱 모드 = Playwright `addInitScript` 가짜 `window.Capacitor`(`tests/live/fake-capacitor.js`), 앱 코드 스위치 금지.
  - Developer A **플러그인 계약 v1(08:58)** 에 맞춰 반영(오류 코드·카운트·`checkModel` pending·`cancelDownload`·`deleteModel`·`getDiagnostics`). B 작업 중 #19 불투명 `manifestUrl` 도 가정.
  - **Leader 확인 요청(§11-11 ⑯건)** 중 중요: ① `openAppSettings()` 플러그인 추가(없으면 경로 문구만) · ② #19 가 정확하게 방식에서도 모델 블록을 싣기 · ③ #8 `minSupportedCode:Int`(번호 비교) · ④ 강제 업데이트 = 닫을 수 없는 띠(전면 차단 아님) · ⑤ 권한 경로 문구의 앱 이름(`TheKaiwa` 권장 ↔ §8 기존 "일본어교육") · ⑦ 누를 때마다 경로 선택 · ⑨ `errorPath`·app-shell · ⑬ 첫 실행 자동 다운로드 안 함 · ⑯ 진단 카드 채택 여부.

## Developer 기록

### A(앱·플러그인)
- [08:58] 착수 — 순서: 플러그인 JS 계약 고정(아래, B 용) → F1 셸(격리 작업 디렉터리 `~/.node-local/thekaiwa-apk` 에서 `cap add android` → NFS `android/`) → F2 Kotlin → F5 `scripts/build-apk.sh` → `:app:assembleRelease` 실측. sherpa-onnx **1.13.8**(gateway `sherpa-onnx==1.13.8` 와 동일) GitHub 릴리스 AAR `sherpa-onnx-1.13.8.aar` sha256 `633c2432…bd96`(릴리스 digest 와 일치 확인), Kotlin 메타데이터 1.7·Java 8 바이트코드 → Kotlin 2.1.20 으로 컴파일.

#### 플러그인 JS 계약 v1 (고정 — B 는 `window.Capacitor.Plugins.SherpaStt` 로만 부른다)
정본 README §4 대비 **바뀐 점**: 이벤트·반환에 엔진명·모델 파일명·내부 경로를 싣지 않는다(task-003e M2 와 같은 원칙) — `final.engine`·`checkModel().path`·`downloadProgress.file` 제거, `vad.state` 는 gateway 와 같은 대문자. 추가: `level`·`cancel`·`preload`·`cancelDownload`·`deleteModel`·`deleteWav`·`getDiagnostics`, `start.endpoint`·`audioSource`, `final.reason`·`timings.sttMs`. `start.modelVersion` 옵션은 없앴다(설치된 버전만 쓴다 — 버전 갱신은 `checkModel().version` ≠ #19 `onDevice.modelVersion` 이면 앱이 `downloadModel`).

**메서드** (모두 Promise, 실패는 reject — `err.code` 가 아래 코드, `err.message` 는 개발용 영문·화면 금지)

| 메서드 | 인자 | 결과 |
|---|---|---|
| `checkPermissions()` / `requestPermissions()` | — | `{ recordAudio: 'prompt'\|'prompt-with-rationale'\|'granted'\|'denied' }` (Capacitor 표준). **`start` 는 권한을 스스로 묻지 않는다** — 미허용이면 `PERMISSION_DENIED` reject. 회화 진입·마이크 테스트 전에 `requestPermissions()` |
| `checkModel(o?)` | `{ verify?: boolean }`(true 면 sha256 전체 재계산 ≈1s, 불일치 버전은 삭제) | `{ installed: boolean, version?: string, bytes?: number, downloading: boolean, pendingVersion?: string, pendingBytes?: number }` — pending 은 이어받을 수 있는 미완성 다운로드 |
| `downloadModel(o)` | `{ manifestUrl: string, wifiOnly?: boolean(기본 true), expectedVersion?: string, allowDowngrade?: boolean(기본 false) }` | `{ version, bytes, alreadyInstalled: boolean }`. `manifestUrl` 은 **앱 `server.url` 과 같은 origin 의 https 만**(아니면 `ORIGIN_NOT_ALLOWED`), 파일 URL = `<manifest 디렉터리>/<version>/<path>`, 리다이렉트는 같은 origin 만 3회. 진행은 `downloadProgress`. 한 번에 하나(`DOWNLOAD_IN_PROGRESS`) |
| `cancelDownload()` | — | `void` — 진행 중 `downloadModel` 이 `DOWNLOAD_CANCELLED` 로 reject(받은 조각은 남아 다음에 이어받음) |
| `deleteModel()` | — | `void` — 설치본·미완성 전부 삭제 + 인식기 해제(폴백 실측·설정 "모델 삭제"용). 세션·다운로드 중이면 `BUSY` |
| `preload(o?)` | `{ numThreads?: number(2), decodingMethod?: 'greedy_search'\|'modified_beam_search' }` | `{ modelVersion, loadMs }`(이미 올라가 있으면 loadMs 0) — 회화방 진입 때 불러 두면 첫 발화 지연이 없다. 선택 |
| `start(o?)` | `{ vad?: { silenceMs?: 500, threshold?: 0.5, minSpeechMs?: 250, maxSegmentSec?: 30 }, partial?: true, endpoint?: 'manual'(기본, 푸시투토크)\|'auto', numThreads?: 2, decodingMethod?: 'greedy_search', maxUtteranceSec?: 60, saveWav?: true, audioSource?: 'MIC'(기본)\|'VOICE_RECOGNITION' }` | `{ sessionId, modelVersion }` — **마이크를 연 즉시 resolve**(인식기가 아직 안 올라갔으면 뒤에서 올리며 소리는 버퍼). 범위 밖 값은 `INVALID_ARGUMENT`. 이미 세션이 있으면 `ALREADY_STARTED`, 모델 없으면 `MODEL_MISSING` |
| `stop()` | — | `{ sessionId?: string, utterance?: FinalPayload }` — 캡처를 멈추고 남은 소리를 디코드해 **마지막 `final` 이벤트를 낸 뒤** 같은 payload 로 resolve. 세션이 없으면 `{}` |
| `cancel()` | — | `void` — 현재 발화 폐기(캡처 중단, `final` 없음) |
| `release()` | — | `void` — 인식기·VAD 메모리 해제(다음 `start`/`preload` 가 다시 올림). 세션 중이면 세션도 취소 |
| `deleteWav(o)` | `{ wavPath: string }` | `void` — `final.wavPath` 를 업로드한 뒤 바로 지운다(플러그인 전용 폴더 밖 경로는 `INVALID_ARGUMENT`). 안 불러도 10분 지난 파일은 다음 `start` 가, 전부는 다음 앱 기동이 지운다 |
| `getDiagnostics()` | — | `{ pluginVersion, abi, modelVersion?, recognizerLoaded, numThreads?, lastLoadMs?, rssMb, javaHeapMb }` — F6 실측(RSS ≤600MB)·진단 화면용 |

**이벤트** (`addListener(name, fn)`)

| 이벤트 | payload |
|---|---|
| `vad` | `{ sessionId, state: 'SPEECH'\|'SILENCE', atMs }` — atMs 는 발화 시작 기준 |
| `level` | `{ sessionId, db }` — dBFS, 바닥 -100, 소수 1자리, ≈100ms 마다(웹 `LevelMeter` 와 같은 식) |
| `partial` | `{ sessionId, segIdx, text, startMs, endMs }` — `manual` 에서 무음 `silenceMs` 로 끊긴 구간마다. `partial:false`·`auto` 면 없음 |
| `final` | `FinalPayload = { sessionId, text, durationMs, wavPath: string\|null, segments: [{segIdx, text, startMs, endMs}], timings: { vadMs, decodeMs, loadMs, sttMs }, reason: 'stop'\|'endpoint'\|'max_length', modelVersion }` — `manual`: `stop()` 또는 `maxUtteranceSec` 도달 때 정확히 1회(도달 시 캡처도 멈춤). `auto`: 무음 끝점마다 1회(`endpoint`) + `stop()` 때 1회. text 는 구두점 없는 모델 출력 그대로(gateway 와 같음). **text 가 비면 `wavPath:null`**(업로드할 것 없음). `wavPath` 는 앱 전용 폴더의 16kHz mono PCM16 wav 절대경로 — `window.Capacitor.convertFileSrc(wavPath)` 를 `fetch` 해 Blob 으로 #21 업로드(VoiceVault task-039 §8-2-2 선례) 후 `deleteWav` |
| `error` | `{ sessionId: string\|null, code, message }` — 세션 중 비동기 오류(세션은 이 시점에 닫힘). `start()`·`downloadModel()` 의 실패는 reject 로만 오고 이벤트로 중복되지 않는다 |
| `downloadProgress` | `{ version, fileIndex, fileCount, received, total, totalReceived, totalBytes }` — 250ms 간격 + 파일 경계 |

**오류 코드**: 세션 — `PERMISSION_DENIED`·`MODEL_MISSING`·`MODEL_CORRUPT`·`AUDIO_INIT_FAILED`·`DECODE_FAILED`·`OOM`·`ALREADY_STARTED`·`INTERRUPTED`(앱이 백그라운드로 가 세션이 취소됨 — `onPause` 에서 녹음 중단)·`INVALID_ARGUMENT`·`BUSY` / 다운로드 — `NETWORK_NOT_ALLOWED`(과금 네트워크 + wifiOnly, 도중에 바뀌어도 중단)·`OFFLINE`·`ORIGIN_NOT_ALLOWED`·`MANIFEST_INVALID`·`APP_UPDATE_REQUIRED`(manifest `minPluginVersion` > 플러그인)·`DOWNGRADE_REFUSED`·`INSUFFICIENT_STORAGE`(여유 < totalBytes×2.5)·`DOWNLOAD_IN_PROGRESS`·`DOWNLOAD_CANCELLED`·`DOWNLOAD_FAILED`.
**폴백 카운트 권고(README §7)**: 세지 않음 — `PERMISSION_DENIED`(권한 안내)·`INTERRUPTED`·`ALREADY_STARTED`·`INVALID_ARGUMENT`. 즉시 gateway — `MODEL_MISSING`. 셈 — `MODEL_CORRUPT`·`AUDIO_INIT_FAILED`·`DECODE_FAILED`·`OOM`·`BUSY`.
**앱 쪽에서 알아 둘 네이티브 동작**: 외부 호스트로의 탐색(링크·`target=_blank`·302)은 Capacitor 가 시스템 브라우저로 넘긴다(`allowNavigation` 비움). WebView 안에서 파일 다운로드 링크(`/app/download/latest.apk`)를 누르면 `MainActivity` 의 DownloadListener 가 시스템 브라우저로 넘긴다 — 배너는 `openExternal(url)`(Custom Tabs)로 열어도 된다.


#### 플러그인 JS 계약 v1.1 (Leader §11-11 ①⑯ 반영, 09:20 — v1 에 더하기만, 바뀐 이름 없음)
| 추가 | 내용 |
|---|---|
| `openAppSettings()` | `Promise<void>` — `Settings.ACTION_APPLICATION_DETAILS_SETTINGS` + `package:<앱>` 로 앱 정보 화면을 연다(영구 거절 권한 [앱 설정 열기]). 열 화면이 없으면 reject `UNAVAILABLE`(새 오류 코드, 폴백 카운트에 넣지 않음) |
| `checkModel().freeBytes` | `number` — 앱 전용 저장소(`filesDir`) 여유 바이트. 받기 전에 `totalBytes × 2.5` 와 비교하면 `INSUFFICIENT_STORAGE` 를 누르기 전에 보인다(플러그인도 같은 식으로 거절) |
| `getDiagnostics()` 필드 | `lastUtteranceMs?`·`lastDecodeMs?` — 이번 앱 프로세스에서 **텍스트가 있던** 마지막 final 의 `durationMs`·`timings.decodeMs`(텍스트·소리는 두지 않음). 기존 `rssMb`(= `/proc/self/status` VmRSS, 앱 프로세스 — WebView 렌더러 프로세스는 별도라 제외)·`javaHeapMb`·`modelVersion`·`lastLoadMs`·`recognizerLoaded`·`numThreads`·`pluginVersion`·`abi` 그대로 |


- [09:10] **F1 셸 — 작업 디렉터리 분리(정본과 다르게 한 것 ①)**: `npx cap add android` 를 운영 미러(`~/.node-local/thekaiwa`, pm2 `thekaiwa` 의 cwd)가 아니라 **APK 전용 작업 디렉터리 `~/.node-local/thekaiwa-apk`** 에서 했다 — 플러그인 설치(`npm install`)가 운영 앱의 node_modules 를 건드리지 않게. 여기에는 `@capacitor/*`(7.6.9/app 7.1.2/browser 7.0.5 — 루트와 같은 범위)·TypeScript·플러그인(심볼릭 링크)만 깐다. 생성물을 NFS `android/` 로 옮겼고(gitignore 대상 생성물 3종은 NFS 에서 제거 — cap sync 가 매번 다시 만든다), 편집 대상은 NFS. `scripts/sync-local.sh` 에는 `plugins/` 동기화만 더했다(루트 package.json 의 `file:plugins/sherpa-stt` 때문에 미러에서 `npm install` 이 깨지지 않게).
- [09:12] **F1 반영**: `MainActivity.java` onPause `CookieManager.flush()` + **DownloadListener**(https 만 시스템 브라우저로 — WebView 안 `/app/download/latest.apk` 대비) · Manifest `singleTask`·`adjustResize`·딥링크 `thekaiwa://auth/callback`(scheme+host+**path** 정확히)·`RECORD_AUDIO`(+microphone required=false)·`allowBackup=false`+`fullBackupContent=false`+`dataExtractionRules`(클라우드·기기 이전 모두 제외 — Android 12+ 는 allowBackup=false 만으로 기기 이전이 안 막힘)·`usesCleartextTraffic=false` · `file_paths.xml` 템플릿의 `external-path "."` 제거 · `capacitor.config.ts` `errorPath`·`adjustMarginsForEdgeToEdge:'auto'`·`webContentsDebuggingEnabled:false`·`allowMixedContent:false`·`loggingBehavior:'none'`(logcat 에 인식 결과 안 남김), `allowNavigation` **비움**(C1-4) · `public/app-shell/index.html` TheKaiwa 연결 실패 화면(§11-2 H, 외부 자원 0, 라이트/다크 hex) · minSdk 23→**26**(플러그인·README) · 아이콘 `scripts/gen-app-icons.mjs`(웹 `public/icons` maskable 에서 적응형 전경·단색·원형, 스플래시 = `--ground` 단색 — **도안이 밥그릇(TheMeal 계열)이라 designer 확인 필요**).
- [09:13] **C1-4 확인(코드 읽기, Capacitor 7.6.9)**: `Bridge.launchIntent` — `server.url` 과 스킴·호스트가 다르고 allowNavigation 에 없으면 `ACTION_VIEW`(시스템 브라우저)로 넘기고 WebView 는 탐색하지 않음(메인 프레임 링크·302·`target=_blank`/`window.open` — `setSupportMultipleWindows` 기본 false 라 같은 WebView 탐색으로 들어옴). 플러그인 브리지: `WebViewCompat.addWebMessageListener("androidBridge", allowedOriginRules=server.url(+allowNavigation)+https://localhost)` 이고 **메인 프레임만**("Plugin execution is allowed in Main Frame only"), 주입 스크립트도 `addDocumentStartJavaScript(server.url origin)` 뿐 — 외부 문서·iframe 은 플러그인을 못 부른다. 한계: WEB_MESSAGE_LISTENER 미지원 WebView 는 `addJavascriptInterface` 폴백(모든 프레임) — S25+ 최신 WebView 는 지원. 서브프레임(iframe) 외부 탐색은 가로채지 않는다(앱에 iframe 없음).
- [09:14] **C1-2 반영**: release buildType = `signingConfigs.sideload`(= `~/.android/debug.keystore`, 환경변수 `KAIWA_KEYSTORE` 로 바꿀 수 있음)·`debuggable false`·minify/shrink 끔(WebView 셸 + JNI 가 이름으로 찾는 sherpa 클래스 — 켜는 날 대비 플러그인 `consumer-rules.pro` keep 동봉). `versionCode 1`/`versionName 1.0.0`(app/build.gradle 상단 변수). **키스토어 백업**: `/home/brownjeon/NFS/homes/brownjeon/backup/android-signing/debug.keystore`(NAS, 저장소 밖, 원본과 sha256 동일, README.txt 동봉) — 인증서 SHA-256 `a4c23dca02f56db088b93a310913ffc639ced8a915ee4be3588abf07d9da9e47`, 유효 2056-09-05, **VoiceVault·TheMeal·bjj 와 같은 키**(그동안 백업이 없었다).
- [09:17] **F2 플러그인**: `SherpaSttPlugin`(메서드 14·이벤트 6, 스레드 = 캡처/worker(로드·디코드·이벤트 FIFO)/download/io, 모든 백그라운드 작업 Throwable 포착 — 안드로이드는 어느 스레드의 미포착 예외도 앱을 죽인다) · `SttSession`(gateway `SherpaRealtimeSession` 규칙 이식: VAD 구간에 앞 0.2s·뒤 0.3s 여유 + **앞 0.4s·뒤 0.2s 0 패딩**, manual/auto, final 정확히 1회) · `AudioCapture`(MIC 기본, `VOICE_RECOGNITION` 선택, 40ms, AudioRecord 해제는 캡처 스레드가 — 다른 스레드는 stop 만) · `Recognizer`(버전·스레드·디코딩 키 캐시, 워밍업 0.5s) · `SherpaVadEngine`(세션마다 새로) · `ModelStore`/`ModelDownloader`/`Manifest`(C1-3 ①~⑤: 같은 origin https·경로 `/models/<id>/manifest.json`·쿼리 금지, 리다이렉트 수동·같은 origin 만 3회, 스키마 엄격(64KB·5~16파일·역할 5종·파일명·sha256·정수 bytes·합계 ≤300MiB·`minPluginVersion`), 파일별 Range 이어받기 → 전체 sha256 → 인덱스 → 원자적 rename → 옛 버전 삭제, **다운그레이드 거부**(`allowDowngrade` 명시만), 내용 오류 3회면 버전 조각 폐기·끊김/404/5xx 는 조각 유지, wifiOnly 는 파일 경계·8MB 마다 재확인, 여유 < ×2.5 거절) · `WavWriter`(tmp→rename). `handleOnPause` = 말하는 중이면 취소+`INTERRUPTED`(손 뗀 발화는 마무리), `handleOnDestroy` = 해제.
- [09:17] **AAR(정본과 다르게 한 것 ②)**: sherpa-onnx **1.13.8** GitHub 릴리스 `sherpa-onnx-1.13.8.aar` sha256 `633c2432…bd96`(릴리스 digest 일치). `implementation files(aar)` 는 AGP 8 이 라이브러리 모듈 lint 번들(`bundleReleaseLocalLintAar`)에서 "Direct local .aar file dependencies are not supported" 로 거부(실측) → gradle 이 AAR 을 풀어 `classes.jar` + `jni/arm64-v8a/*.so`(jniLibs)로 쓴다(AAR 에 리소스·권한·proguard 없음 확인). JitPack 좌표는 소스 재빌드 산출물이라 안 씀. Kotlin 2.1.20(AAR 메타데이터 1.7·Java 8 바이트코드). Kotlin 컴파일 데몬이 이 머신에서 붙지 않아(`Could not connect to Kotlin compile daemon`) `kotlin.compiler.execution.strategy=in-process` — **재발 가능 트러블슈팅**.
- [09:19] **F5 `scripts/build-apk.sh`**: NFS→작업 디렉터리 rsync(산출물·cap 생성물·키스토어 보호) → 루트 package.json 에서 `@capacitor/*`·`@thekaiwa/*`·typescript 만 뽑아 작업 package.json 생성(바뀌면 npm install) → AAR 받기·sha256 → `cap sync`(capacitor.plugins.json 에 SherpaSttPlugin 없으면 실패) → `:app:assembleRelease`(`--test` 면 `:thekaiwa-sherpa-stt:testDebugUnitTest` 먼저) → `aapt2` debuggable 없음(badging+xmltree)·versionCode·ABI, `apksigner` 서명 SHA-256 → sha256·크기·`out/thekaiwa-<name>-<code>.apk`. **`--publish`(deployer 전용)** = `DATA_ROOT/releases/thekaiwa-<versionName>.apk` 복사(같은 이름 다른 내용이면 거절) + AppRelease 값 출력(`apkPath` 는 **파일 이름만** — B 의 `releaseFilePath` 규칙). AppRelease 행은 넣지 않는다(deployer). 로그는 `~/.node-local/thekaiwa-apk/logs/`.
- [09:24] **빌드 실측**: `bash scripts/build-apk.sh --test` rc=0 — 단위 테스트 **51/51**(8 스위트, failures·errors 0) · APK `~/.node-local/thekaiwa-apk/out/thekaiwa-1.0.0-1.apk` **35,187,401 B**(lib/arm64-v8a: onnxruntime 22.2MB·sherpa-jni 4.8MB·c-api 4.5MB·cxx 0.4MB) · versionCode 1 · versionName 1.0.0 · minSdk 26/target 35 · native-code `arm64-v8a` · debuggable 없음 · 서명 SHA-256 `a4c23dca…9e47` · 병합 manifest 권한 INTERNET·RECORD_AUDIO·ACCESS_NETWORK_STATE(+androidx 내부 1) · assets `capacitor.config.json` 에 errorPath·webContentsDebuggingEnabled:false·loggingBehavior none 확인, `capacitor.plugins.json` 에 `@thekaiwa/sherpa-stt` 확인. APK sha256 은 빌드마다 달라진다(배포본은 deployer 빌드의 값).
- [09:23] **데스크톱 점검(폰 없이 할 수 있는 최대치)**: `plugins/sherpa-stt/tools/desktop-check/run.sh` — 플러그인 `SttSession`·`Audio` **소스 그대로** + sherpa-onnx 1.13.8 JVM jar(linux-x64, sha256 고정) + 실제 모델·silero VAD 로 `speech/test-assets/stt20` 20문장(앞뒤 0.3s 무음 붙여 푸시투토크처럼 40ms 프레임) → **20/20**(정규화 유사도 ≥0.9, 12번만 0.92) · 비교로 패딩 없이 통째 디코드하면 18/20(01 첫 단어 누락 0.67 — 003e 실측 재현). x86 2스레드 5초 발화 디코드 ≈70ms(폰 값 아님). KVM 권한이 없어 에뮬레이터 실행은 못 했다.
- [09:25] **검증**: 플러그인 TS 는 미러 `tsc --noEmit` 에서 오류 0(전체 tsc 3건은 B 진행 중 `TalkRoom.tsx`), `eslint plugins capacitor.config.ts` 0. 커밋 제외: APK·AAR·키스토어·`android/build`·`.gradle`·local.properties.
- **정본과 다르게 한 것(정리)**: ① APK 전용 작업 디렉터리 ② AAR 풀어 쓰기 ③ README §4 대비 계약 변경(엔진명·파일명·경로 비노출, 메서드 추가 — 위 계약 v1·v1.1) ④ `final.wavPath` 는 text 가 있을 때만 ⑤ `start` 는 권한을 묻지 않음 ⑥ manifest 파일 URL 은 manifest 의 `url`/`baseUrl` 이 아니라 `<manifest 디렉터리>/<version>/<path>` 로 직접 만든다(B 의 `/models/<id>/<version>/<file>` 와 같음).
- **한계·후속**: 다운로드는 포그라운드 서비스·WorkManager 없이 앱 프로세스 스레드 — 앱이 죽으면 멈추고 다음에 이어받는다. Verified App Links·manifest 서명은 C1 판정대로 후속. NFS `package-lock.json` 은 원래 낡아 있다(prisma 만) — task-009 blue/green(`npm ci`) 전에 미러 lock 을 NFS 로 옮길 때 `@thekaiwa/sherpa-stt`(file:) 항목이 들어가야 한다(Leader·deployer). 루트 `.gitignore` 에 `*.aar`·`plugins/**/.gradle/`·`android/.idea/` 추가.
- **폰에서 확인할 것(F6, 사용자)**: ① APK 설치(같은 키라 이후 덮어쓰기) → 연결 실패 화면(비행기 모드로 첫 실행)·[다시 시도] ② 로그인: Custom Tabs → **`thekaiwa://` 302 로 앱이 열림(⑪)** → 앱 완전 종료 후 재실행해도 로그인 유지 ③ 키보드가 입력창을 안 가림·상태바/내비바 겹침 없음 ④ 외부 링크·`target=_blank` 가 Chrome 으로 열리고 WebView 에 남지 않음(C1-4) ⑤ 마이크 권한 첫 누름 대화상자, 두 번 거절 → [앱 설정 열기](`openAppSettings`) ⑥ 모델 받기 Wi-Fi 진행률·일시정지·**받는 중 앱 강제 종료 → 이어받기**·모바일 데이터면 거절 후 "데이터로 받기" ⑦ 휴대폰 인식 20문장 partial/final + 진단 카드 **5초 발화 `lastDecodeMs` ≤800ms·`rssMb` ≤600MB**(numThreads 2/3/4 비교) ⑧ **`convertFileSrc(wavPath)` fetch 업로드(⑮)** → 턴 연결·"내 목소리 ▶" ⑨ 모델 지우기 → 서버 인식으로 같은 동작 ⑩ 말하는 중 홈 버튼 → 녹음 표시(초록 점) 즉시 꺼짐 ⑪ **업데이트 띠 → Custom Tabs 로 APK 받기(⑩)**(WebView 안 링크면 DownloadListener → Chrome) → 덮어쓰기 설치 후 로그인 유지.


#### 플러그인 JS 계약 v1.1 보강 — REV-021 (10:01, 오류 코드 집합 그대로라 버전은 v1.1 유지)
| 바뀐 동작 | 내용 |
|---|---|
| `deleteModel()` | 판정과 점유가 한 임계구역(`ModelGate`). 세션·다운로드·다른 삭제 중이면 `BUSY`(기존과 같음) |
| `start()` | **모델 삭제 중이면 `BUSY`**(신규 경우). 설치본 확인·VAD 생성·마이크 열기가 삭제와 겹치지 않는다. 라우터 카운트는 기존 표대로(`BUSY` 셈 — 삭제 뒤엔 모델이 없어 어차피 서버 경로) |
| `downloadModel()` | **모델 삭제 중이면 `BUSY`**(신규 경우). 이미 받는 중이면 `DOWNLOAD_IN_PROGRESS`(그대로) |
| manifest 판정 | 서버와 같게: sha256 **소문자만**(대문자 → `MANIFEST_INVALID`), `name` 대문자 허용·`..` 금지, `version` 에 `..` 금지. 공용 픽스처 `plugins/sherpa-stt/test-fixtures/manifest-cases.json`(53 사례: `plugin` = `valid`·`MANIFEST_INVALID`·`APP_UPDATE_REQUIRED`) — **B 는 서버 `parseManifest` 테스트에서 이 파일을 읽어 "plugin 이 valid·APP_UPDATE_REQUIRED 인 사례만 통과, 나머지 거절"을 확인**하면 된다(미러에는 sync-local 이 `plugins/` 를 보낸다). 현재 서버 `parseManifest`(코드 읽기 대조)가 통과시키지만 플러그인은 거절하는 사례: `files-4`·`duplicate-role`·`unknown-role`·`missing-role`·`engine-mismatch`·`modelType-mismatch`·`sampleRate-8000`·`sampleRate-string`·`missing-engine`·`missing-modelType`·`missing-sampleRate`·`path-reserved-index`(installed.json)·`path-reserved-part`(*.part)·`minPluginVersion-not-semver` |

- [10:01] **REV-021 Medium 수정**: `ModelGate.kt`(신규) — 세션·다운로드·삭제 점유를 `@Synchronized` 한 모니터에서 판정+점유. `SherpaSttPlugin` 의 `lock`/`active`/`downloader` 를 gate 로 옮겼고 `pendingStops` 도 `synchronized(gate)` 로 묶음. `start` 는 `gate.openSession { store.current()·VAD·세션·마이크 }`(락 안), `deleteModel` 은 `beginDelete` 점유 → worker 에서 `recognizer.release()`·`deleteAll()` → `finally endDelete`(executor 거절 시에도 해제). 세션의 인식기 로드는 worker 실행 시점에 `store.current()` 를 다시 읽는다(그 사이 다운로드가 새 버전을 올리고 옛 파일을 지웠을 때 대비). JVM 테스트 +9: `ModelGateTest`(삭제 중 open·download BUSY, 세션·다운로드 중 삭제 BUSY, 실패한 open 이 점유를 남기지 않음, **삭제↔열기 2,000회 경합에서 동시 점유 0**) · `DeleteVsStartTest`(삭제 점유~worker 삭제 사이의 start = BUSY, 삭제 뒤 = MODEL_MISSING) · `ManifestFixtureTest`(53 사례·한도 상수 대조).
- [10:01] **README 정정**: §6 을 실제 #19 모양(불투명 `/models/ondevice-ja-v1/manifest.json`, `model.version` = 서빙 중 manifest, **콘솔 Apply 없음**, 옛 버전 파일은 서버가 404 → 다음 받기가 새 버전으로 다시 시작), §7 을 웹 라우터 규칙(누를 때마다·앱 실행 단위 2회·세지 않는 코드)으로, §10 엔진명 문구 정리. `definitions.ts` 주석·`CHANGELOG.md` 보강. ※ `speech/models/README.md` §5 4단계에도 "콘솔 Apply" 문구가 남아 있다(내 파일 아님 — Leader/B).
- [10:01] **재빌드**: `bash scripts/build-apk.sh --test` rc=0 — 단위 테스트 **60/60**(11 스위트, failures·errors 0) · APK `~/.node-local/thekaiwa-apk/out/thekaiwa-1.0.0-1.apk` **35,199,617 B**, **sha256 `7ba5a57aa6b46aeb0a197f34ca498319f0d394a2ce6aa314a393b1a9603cc8f7`** · versionCode 1 / 1.0.0 · arm64-v8a · debuggable 없음 · 서명 `a4c23dca…9e47`. **새 아이콘(098dd0d 말풍선 あ) 포함 확인**(APK res 의 432px 전경·단색, 192px 원형·구형 런처를 꺼내 봄). 미러 `tsc --noEmit` 0·`eslint plugins capacitor.config.ts` 0.

### B(웹·서버)
- [08:53] 착수 — 순서: F4 서버(`/models/*`·`/api/app/version`·`/app/download/*`·#19 `onDevice.model`·C1-1 PKCE) → F3 웹 연결(bridge·온디바이스 클라이언트·라우터·앱 로그인) → 화면(designer §11 이후). A 의 플러그인 계약은 아직 없어 `plugins/sherpa-stt/README.md` §4 로 가정하고 나중에 맞춘다.
- [09:26] 구현 1차 커밋 `60712a6`(src + eslint 만, A 파일·이력서 제외). A 계약 v1(+v1.1 `openAppSettings`·`freeBytes`)·designer §11·Leader 판정 ②③④⑤⑥⑦⑧⑫⑬⑭⑯ 반영. 결정·주의:
  - **모델 배포 위치 = `DATA_ROOT/models/<connection 설정 디렉터리>/`**(`SPEECH_MODELS_DIR` 절대 경로가 있으면 그것) — 저장소 `speech/models` 는 서빙하지 않는다(릴리스·미러 트리에 없음, sha 기록과 실제 파일이 한 곳이어야). gateway 도 같은 우선순위라 배치하면 둘이 같은 파일을 본다. **지금 `DATA_ROOT/models` 가 없어 운영 #9 는 404 → #19 `model.version:null`·`available:false`(카드 "쓸 수 없음")**. deployer 배치 명령(재다운로드 불필요): `mkdir -p "$DATA_ROOT/models" && cp -a speech/models/reazonspeech-int8 "$DATA_ROOT/models/" && python3 speech/models/fetch_models.py --dest "$DATA_ROOT/models" --verify-only`.
  - **공개 경로는 불투명 id**: `/models/ondevice-ja-v1/manifest.json`·`/models/ondevice-ja-v1/<version>/<file>`(Leader ⑧). 디스크 디렉터리는 ONDEVICE connection `connection.manifestUrl`(`/models/<dir>/manifest.json`)에서 읽는다 — 설정 변경·DB 변경 없음. manifest 본문엔 원래 이름(name·engine·model) 그대로. 파일 URL = `<manifest 디렉터리>/<version>/<path>`(A 규칙과 같음) + 파일마다 `url` 절대 주소(운영 = `OAUTH_CALLBACK_BASE` origin, 개발 = 요청 origin). ONDEVICE connection 이 꺼지면 배포도 404.
  - #19 `onDevice.model.version` 은 connection `runtime.modelVersion`(gateway 모델 이름 — 엔진명) 대신 **서빙 중 manifest 의 version** — 플러그인 `checkModel().version` 비교값이라 같아야 한다. ONDEVICE 의 `runtime.modelVersion`·`connection.modelBytes` 는 클라이언트에 더 쓰이지 않는다(모델 갱신 = manifest 교체만, `speech/models/README` §5-4 "콘솔 Apply" 단계 불필요 — Leader 문서 정리 대상).
  - 분당 제한: `/models/*`·`/app/download/*` 는 IP 제한 대신 **동시 스트림 4(503 Retry-After)** — nginx `/models/` 가 X-Forwarded-For 를 안 넘겨 앱에서 IP 를 모른다. 대역 제한은 nginx(`limit_conn`/`limit_rate`) 쪽 후속 판단. #8 은 IP 60/분.
  - `/app/download` 는 **기록 sha256 과 다른 파일은 404**(파일 해시 캐시). apkPath = `releases/` 아래 파일 이름(또는 그 아래 절대 경로). #8 비교는 **`X-App-Build`(versionCode) 로만**(Leader ③) — 앱은 `X-App-Version`+`X-App-Build` 를 보낸다(api.ts·업데이트 스토어).
  - PKCE: challenge 없는 `platform=app` 시작 = 딥링크 `error=app_login_invalid`(첫 APK 부터 필수). verifier 는 WebView 메모리+sessionStorage(10분·1회용), 앱 프로세스가 죽으면 사라져 `app_code_invalid`(다시 누르면 됨). Verified App Links 는 Leader 판정대로 후속.
  - 이름: 설계의 `getSherpaStt()`/`OnDeviceSherpaClient` = 구현 `getOnDeviceStt()`(bridge)/`OnDeviceSttClient` — `speech/stt/client/**` 는 엔진명 0 경계 테스트 대상이라 중립 이름. `getOnDeviceStt()` 호출자는 **모델 스토어 하나**(클라이언트는 스토어가 넘긴 플러그인 사용 — Leader ⑥ 보다 한 곳 적음, 경계 테스트로 고정).
  - 검증: tsc·lint(경고 5 = 기존 규칙상 허용 load-on-mount) 통과, `npm run test` 480/480. 신규 단위 테스트 — infra `task003f`(Range·ETag·If-Range·동시 상한·realpath·#8·다운로드 경로·PKCE 탈취/불일치/재사용/만료) · speech `modelPackage`·`onDeviceStt`(클라이언트·라우터 폴백·스토어) · `nativeBoundary`(네이티브 import 0·window.Capacitor 는 bridge 만·플러그인 호출자 1) · components `task003f`·`appUpdateStore`.
- [09:40] **구현 완료 → Reviewer 인계**. 커밋 `60712a6`(구현)·`b356f3f`(라이브 테스트·정본 개정·dev origin 보정·`verifyReleaseFile` 분리)·`cdf23c6`(진단 카드가 플러그인 `lastUtteranceMs·lastDecodeMs` 로 폴백 — A `definitions.ts` v1.1 대조 결과). push 안 함. 정본 개정: `api-contract` §0-10(`X-Client-Platform: app` 정본·`X-App-Build`)·#2~#5(PKCE)·#8·#8a·#9~#10(불투명 경로·manifest 형식·동시 상한)·#19(`onDevice` 블록) · `module-dependency` §6 · `speech-platform/12` §3.5 각주.
  - **라이브 스모크 `tests/live/task003f-smoke` 31/31 PASS**(dev 3011, `SPEECH_MODELS_DIR=<NFS>/speech/models` — 공유 DATA_ROOT 무변경): A 모델 13(파일 5개 전체 sha256 = manifest, Range·416·If-Range·HEAD, 탈출·원래 이름·목록 밖·옛 버전 404, 동시 4 → 503) · B #19 앱 응답 **전체** 엔진명 0(003e I3 의 model 제외 없이)·불투명 모델 블록 = 서빙 version · C #8/#8a 행 없음 경로(C6 행 있음은 deployer 뒤 — SKIP) · D PKCE 8(challenge 없는 앱 시작 거부, code_r 만·틀린 verifier·DB 결속 값·재사용·만료 = 같은 실패, 맞는 verifier 만 세션 + `next=//evil` 무시).
  - **화면 E2E `tests/live/task003f-ui-e2e.mjs` + `fake-capacitor.js` 75/75 PASS**(실 Chrome, 가짜 `window.Capacitor` = `addInitScript` 만 — 앱 코드 스위치 없음): 웹 회귀(설정·로그인·회화방 앱 요소 DOM 0, #8 요청 0) · 카드 absent/needsConsent/downloading/paused/installed 3폭(360·390·412 가로 넘침 0) · 새 버전 · 오류 4종 · 휴대폰 경로 마이크 테스트(start→stop, `saveWav:false`, 업로드 0) · 지우기 시트 → 서버 · 권한 rationale/denied/[앱 설정 열기]/resume 해제 · 권장 띠·시트(약 31MB·바뀐 점·4단계)·Custom Tabs 받기·✕ 그날 숨김·앱 버전 줄 · 강제 띠(닫기 없음, 로그인에도, UPDATE_REQUIRED 경로 줄) · 로그인 대기·다시 열기(같은 verifier)·닫힘 1.5초·마무리(교환 URL code+verifier) · 회화방 메뉴 "알아듣는 곳"(웹 없음) · 진단 카드(USER 0·관리자 기준 초과·미리 불러오기). 스크린샷 `/tmp/claude-1000/e2e003f/`(36장). dev 서버 PID 로 종료, `ss -ltn` 3011/3012 비어 있음 확인.
  - **reviewer 가 볼 곳(high risk)**: ① PKCE — `infra/auth/oauth/{pkce,app-code,state,pending}.ts`·`api/auth/{google,google/callback,complete,app-exchange}`(challenge 는 서명 안에만, 앱 흐름은 challenge 필수, 실패 사유 단일) ② 공개 파일 라우트 — `app/models/[...path]`·`app/app/download/[file]`·`infra/{fileServe,appRelease,storage(realpathInside·modelsRoot)}`·`speech/stt/modelPackage.ts`(검증 실패 = 404, 현재 manifest 파일만, 실경로 확인, 동시 상한) ③ `proxy.ts` matcher 에 `models/` 제외 추가 ④ 라우터 폴백 규칙(`speech/stt/client/router.ts` — start 거부 서버 이어 가기, 셈/안 셈, 오프라인 방식) ⑤ `#19` 앱 응답 엔진명 0 ⑥ 웹 번들 네이티브 import 0(ESLint 전역 블록 + `nativeBoundary` 테스트).
  - **Leader·deployer 에게**: (1) 운영에서 휴대폰 인식을 켜려면 deployer 가 위 `cp -a … && fetch_models.py --verify-only` 로 `DATA_ROOT/models/reazonspeech-int8/` 배치(배치 전 운영은 카드 "쓸 수 없음"·서버 인식으로 정상 동작). 배치하면 gateway 도 재시작 때 같은 파일을 쓴다. (2) `AppRelease.apkPath` = `releases/` 아래 **파일 이름**(예 `thekaiwa-1.0.0.apk`), sha256 은 그 파일과 같아야 다운로드된다. (3) `speech/models/README.md` §2·§5 의 경로(`/models/reazonspeech-int8/*`)·"콘솔 Apply" 단계와 `plugins/sherpa-stt/README.md` §5 URL 예시는 이 개정(불투명 id·manifest version)으로 정리 필요(Leader 문서). (4) nginx `/models/` 대역 제한(`limit_conn`/`limit_rate`)은 후속 판단. (5) `fallbackReason` 을 #21 로 서버에 보고하는 필드는 없음(12 §3.5 각주, 후속).
  - **F6(사용자 폰) 에서 B 쪽으로 확인할 것**: `convertFileSrc(wavPath)` fetch 업로드 → 회화 턴 "내 목소리 ▶"(안 되면 휴대폰 경로 턴이 전부 글자 턴 — Leader ⑮) · 콜드 스타트(Custom Tab 중 앱이 죽음) 로그인은 verifier 유실로 "로그인을 마무리하지 못했어요" → 다시 누르면 성공해야 함 · 권한 영구 거절 → [앱 설정 열기] → 허용 후 복귀 시 띠 해제 · 업데이트 띠(AppRelease 행 뒤)·Chrome 받기.
- [10:07] **REV-021 수정 완료 → Reviewer 재인계**. 커밋 `25c1cae`(B 파일만, push 안 함).
  - **[HIGH] manifest 규칙 = 플러그인**: 새 `src/modules/speech/stt/manifestRules.ts` 가 `ManifestValidator.parse`(A `eec8872` 정렬판)를 **같은 순서·조건·거부 사유**로 옮겼다 — `engine`="sherpa-onnx"·`modelType`="transducer"·`sampleRate`=16000(정수) 필수, 파일 5~16·역할 encoder/decoder/joiner/tokens/vad 정확히 1번씩, name·version `..` 금지, sha256 소문자만, 경로 `installed.json`·`.part` 금지. `modelPackage.ts` 는 이 규칙만 쓴다(자체 규칙·`servable` 예외 제거). 파서 차이로 서버가 더 느슨해지는 두 틈도 막았다: **중복 키**(org.json 은 JSONException) → `manifest is not valid json`, **정수 칸의 소수·지수 표기**(`16000.0` — org.json 은 Double 로 읽어 거부) → 해당 칸. 반대(org.json 만 받는 꼬리 글자·작은따옴표)는 서버가 더 엄격한 쪽이라 둔다.
  - **공용 픽스처**: 처음엔 내 형식으로 `plugins/sherpa-stt/test-fixtures/manifest-cases.json` 을 만들었는데 A 가 같은 경로에 자기 형식(사례별 `plugin` 판정, 53건)으로 덮어 커밋했다(`eec8872`) — **A 형식을 정본으로 채택**, TS 테스트가 그 파일을 읽어 53건 전부 "서버 통과 ⇔ plugin ∈ {valid, APP_UPDATE_REQUIRED}" 로 판정 일치(불일치 0) + `limits` 상수 일치. 실제 배포 manifest 테스트는 `THEKAIWA_REPO=<NFS 루트>` 일 때 `speech/models/reazonspeech-int8/manifest.json` 을 읽어 통과(미러에는 speech/ 가 없어 기본 실행은 skip — 같은 값의 `valid-disk` 사례는 늘 돈다), 내보낸 본문(`publicManifest`)도 같은 규칙 재통과.
  - **`scripts/models-verify.{sh,ts}` 신설**(README §5 가 참조하던 게이트): 서버와 같은 규칙 모듈 + 버전 디렉터리 파일 크기·sha256, `--manifest <새 manifest>` 로 올리기 전 대조, `--quick`. 실측: `speech/models` 전체 sha256 OK / engine 변조 FAIL exit 1 / 중복 키 FAIL. `speech/models/README.md` §2(공개 경로 `/models/ondevice-ja-v1/*`·앱 라우트 서빙)·§3(공통 규칙 7항, 정본 = Kotlin, 세 곳 함께 수정)·§5(게이트 절차·**콘솔 Apply 단계 삭제** — #19 가 서빙 manifest version 을 따름) 개정.
  - **[MEDIUM] PKCE 교환 = POST JSON 본문**: `POST /api/auth/app-exchange {code, verifier, next?}` → 200 `{next}` + Set-Cookie. 로그인 CSRF 방어 = `Content-Type: application/json` 만 + `Sec-Fetch-Site`/`Origin` 중 하나 이상 있고 같은 출처(`infra/auth/oauth/app-exchange.ts`, 순수 함수). 실패(출처·형식·불일치·만료·재사용·미존재)는 전부 `400 APP_CODE_INVALID` 하나, 틀린 시도는 코드를 태우지 않음. **GET 은 405 `Allow: POST`(본문 없음)**. 앱은 `exchangeAppCode()`(fetch POST, credentials same-origin) 뒤 `location.replace(next)`, 실패는 `/login?oauth_error=app_code_invalid`. 기존 GET 호출자는 `AppDeepLink` 하나였고 교체(`appExchangeUrl` 삭제, grep 0). api-contract #5·표·PKCE 절 개정.
  - **검증**: tsc·lint 0 error(경고 5 = 기존), `npm run test` 484(483 pass + 실제 manifest 1 skip — `THEKAIWA_REPO` 로 돌리면 pass). 스모크 **36/36**(D3~D8 POST 로 + GET 405·폼 형식·다른 Origin·cross-site·출처 표시 없음 거절 — 모두 유효한 code/verifier 로 시도해 D6 성공으로 "태우지 않음"까지 확인). 화면 E2E **77/77**(교환 = POST JSON·주소에 코드·verifier 없음, 성공 응답 → 착지, **실제 서버 교환 1회** — 브라우저가 붙이는 Origin·Sec-Fetch-Site 로 통과·세션 쿠키). dev 서버 PID 종료·3011/3012 비어 있음 확인.
  - **A 에게(plugins 는 A 파일)**: ① `plugins/sherpa-stt/README.md` §5·§6 의 `/models/reazonspeech-int8/manifest.json`·`modelVersion`/`engineConnectionId` 예시를 `/models/ondevice-ja-v1/manifest.json`(#19 `onDevice.model.manifestUrl`)·`onDevice.model.version`·`connectionKey` 로 정리 부탁. ② 공용 픽스처에 **중복 키**·**정수 칸 소수 표기(`"sampleRate": 16000.0`)** 두 사례(둘 다 plugin=MANIFEST_INVALID — org.json 이 거부)를 `raw` 로 추가하면 서버의 대응 검사까지 대조된다(서버 쪽은 단위 테스트로 이미 확인). ③ 규칙을 바꿀 땐 `manifestRules.ts` 와 픽스처를 같이(내 테스트가 즉시 깨진다).
  - LOW(`fallbackReason` 서버 보고)는 Leader 지시대로 후속 유지.

## Reviewer 기록

### REV-021 (2026-09-28, 003f 전체 80f50e1)

**판정: PASS** (Critical 0 · High 1 · Medium 2 · Low 1) — Read 전용 감사, base 218664e → 80f50e1(`60712a6`·`b356f3f`·`cdf23c6`·`eea1763`·`098dd0d`) 전체 확인. 코드 수정 없음.

```json
{
  "reviewId": "REV-021",
  "status": "PASS",
  "summary": { "critical": 0, "high": 1, "medium": 2, "low": 1 },
  "high_risk_areas": [
    "speech/stt/modelPackage.ts parseManifest ↔ plugins/sherpa-stt Manifest.kt ManifestValidator 스키마 괴리(모델 버전 갱신 시)",
    "auth/oauth PKCE 자체는 견고하나 app-exchange 가 GET 쿼리스트링(code_r+verifier)로 이동",
    "SherpaSttPlugin.deleteModel ↔ start() TOCTOU(낮은 확률, 자가복구)"
  ],
  "native_change": true
}
```

#### 중점 1 — A↔B 통합 정합 (가장 중요)

**[HIGH] 서버(B) manifest 검증이 안드로이드 플러그인(A)의 실제 요건보다 구조적으로 느슨함 — 향후 모델판 갱신 시 조용한 전면 장애 가능**
- **component**: `src/modules/speech/stt/modelPackage.ts:61-90`(`parseManifest`) ↔ `plugins/sherpa-stt/android/src/main/java/com/miraclepenguin/kaiwa/sherpastt/Manifest.kt:67-121`(`ManifestValidator.parse`)
- **risk**: B 의 `parseManifest` 는 `files.length >= 1`(0건만 거부, 5건 요구 아님), `engine`·`modelType`·`sampleRate` 를 **선택 통과 필드**(`META_STRINGS`, L47/83-88)로만 다루고 값 일치를 강제하지 않는다. 반면 A 의 `ManifestValidator.parse` 는 `engine=="sherpa-onnx"`·`modelType=="transducer"`·`sampleRate==16000`(정수) **정확히 일치**해야 하고, `files.length` 가 `ROLES.size(5)` 미만이면 거부하며 `encoder/decoder/joiner/tokens/vad` **5개 role 전부**가 정확히 한 번씩 있어야 한다(L83, L103). 즉 B 가 "유효"로 판정해 200 으로 내보내는 manifest 중 상당수가 A 에서는 `MANIFEST_INVALID` 로 전량 거부된다. 지금 배포 중인 실제 파일(`speech/models/reazonspeech-int8/manifest.json`)은 우연히 양쪽을 모두 통과하는 값이라 **현재 운영은 정상**이지만, `speech/models/README.md` §5 "버전 올리기 절차" 2단계가 참조하는 **`scripts/models-verify.sh` 는 아직 존재하지 않는다**(`grep` 확인, task-003 표시만 있고 파일 없음) — 다음 모델 버전을 배치할 때 B 를 통과하는 것만 확인하고 올리면(예: `sampleRate` 누락, `engine` 값 변경, 파일 4개로 축소 등) **서버는 200 을 계속 내주는데 전체 안드로이드 클라이언트가 조용히 `MANIFEST_INVALID` 로 막히고**, 화면엔 일반 "받기 실패"만 보여 원인 추적이 어렵다.
- **evidence**:
  - `src/modules/speech/__tests__/modelPackage.test.ts:7-22,36` — `manifest()` 픽스처가 파일 **2개**·`engine:'e'`·`modelType` 필드 자체 없음으로 `parseManifest()` 를 **통과시킴**(코드상 throw 없음, `assert.equal(parseManifest(manifest()).version, ...)`)을 테스트가 스스로 증명.
  - `plugins/sherpa-stt/android/src/test/.../ManifestTest.kt:70-74` `rejectsWrongEngineTypeOrRate` — 같은 종류의 값(엔진·modelType·sampleRate 변경)을 A 는 명시적으로 `MANIFEST_INVALID` 로 거부하는 테스트를 갖고 있어, 요구 수준의 차이가 설계 의도임을 보여준다(느슨함이 실수가 아니라 아예 서버 쪽에 대응 규칙이 없는 것).
  - Developer 자신의 이력서 09:17 기록도 "스키마 엄격(64KB·**5~16파일**·역할 5종…)"라고 적었는데(B 절), 실제 구현은 `files.length > 0`(1건도 통과)이라 **본인이 의도한 요건과 실제 코드가 이미 어긋나 있다.**
  - 두 검증기를 같은 fixture 로 교차 실행하는 테스트/스크립트가 어디에도 없다(요청받은 "JVM 테스트나 수동 대조"가 이번 task 에서 이뤄지지 않음).
- **recommendation**: (1) `parseManifest` 에 `engine`(sherpa-onnx 계열 화이트리스트 또는 connection 설정과 대조)·`modelType`·`sampleRate`(16000 고정 또는 STT_SAMPLE_RATE 상수와 일치) 필수화 + `files.length` 하한을 5(또는 constants 공유)로 올리고 role 5종 완전성 검사를 추가하거나, 최소한 (2) `scripts/models-verify.sh` 를 실제로 만들어 배포 전 게이트로 강제하고 그 스크립트가 Kotlin `ManifestValidator` 와 동일한 규칙(이상적으로는 같은 JSON Schema 파일을 양쪽이 읽거나, CI 에서 Kotlin 유닛테스트 fixture 를 B 검증기에도 흘리는 대조 테스트)을 갖도록 한다. deployer 에게도 "모델판 갱신 전 반드시 이 스크립트를 통과해야 한다"를 배포 절차에 명시.

#### 중점 2 — 보안

**[MEDIUM] PKCE 결속 설계 자체는 견고하나, code_r+verifier 가 GET 쿼리스트링으로 이동해 서버 접근 로그·WebView 내비게이션 기록에 남는다**
- **component**: `src/modules/infra/native/appLogin.ts:82-88`(`appExchangeUrl`) → `src/app/(auth)/login/AppDeepLink.client.tsx:62`(`window.location.replace(appExchangeUrl(...))`) → `src/app/api/auth/app-exchange/route.ts:27-31`(`GET`, `sp.get('code')`/`sp.get('verifier')`)
- **risk**: PKCE 결속 자체(`pkce.ts`·`app-code.ts`·`state.ts`·`pending.ts`)는 매우 꼼꼼하다 — challenge 는 서명된 state/pending 안에서만 이동하고, verifier 는 WebView 메모리+sessionStorage 를 벗어나지 않으며, 소각은 원자적 조건부 UPDATE 1건이다. 다만 마지막 한 걸음, 딥링크 코드를 세션으로 바꾸는 요청 자체는 **`code`·`verifier` 를 URL 쿼리스트링에 실은 전체 페이지 네비게이션**(`location.replace`)이다. 이는 (a) nginx 기본 `combined` 로그 포맷이 요청 라인(쿼리스트링 포함)을 그대로 남기므로 `code_r`+`verifier` 쌍이 서버 접근 로그에 평문으로 적재되고, (b) WebView 내비게이션 히스토리에도 같은 URL 이 남는다. 코드가 1회용·60초·원자적 소각이라 **재생 공격 자체는 사실상 불가능**하지만(이미 쓰인 값이라 로그를 읽어도 소용없음), "세션 토큰·API Key 를 URL 에 싣지 않는다"는 이 프로젝트가 다른 모든 곳(§CLAUDE.md 금기, `next-path.ts`·`state.ts` 등)에서 지키는 원칙과 결이 다르고, RFC 8252(네이티브 앱 PKCE) 관례상으로도 코드 교환은 보통 POST 바디로 한다.
- **evidence**: `appLogin.ts:82-88` `target.searchParams.set('code', code); target.searchParams.set('verifier', verifier)`. `AppDeepLink.client.tsx:62` `window.location.replace(appExchangeUrl(...))`(GET 네비게이션). `app-exchange/route.ts:27` `export async function GET(req: NextRequest)` — POST 가 아님.
- **recommendation**: `/api/auth/app-exchange` 를 POST(JSON/form body)로 바꾸고 `AppDeepLink.client.tsx` 가 `fetch()` 로 교환한 뒤 응답의 `next` 로 `router.replace`(SPA 네비게이션) 하도록 바꾼다. 서버가 302 로 화면을 옮기는 지금 구조를 유지하고 싶다면 최소한 이 경로만 nginx `access_log off`(또는 쿼리스트링 제외 로그 포맷)로 접근 로그 적재를 막는 완화책을 검토.

#### 중점 5 — Kotlin 품질

**[MEDIUM] `deleteModel()` ↔ `start()` 사이 TOCTOU — 낮은 확률이지만 원자적이지 않음(영향은 자가복구되는 실패로 제한)**
- **component**: `plugins/sherpa-stt/android/.../SherpaSttPlugin.kt:164-174`(`deleteModel`) vs `:196-248`(`start`, 특히 `store.current()` L205·`SherpaVadEngine` 생성 L211·`recognizer.ensure` L220)
- **risk**: `deleteModel` 은 `synchronized(lock) { active/downloader 없음을 확인 }` 한 뒤 `lock` **밖에서** `worker.task { store.deleteAll() }` 를 큐에 넣는다. 그 직후(락 해제~worker 실행 사이) 다른 스레드가 `start()` 를 불러 `store.current()` 로 모델 파일 참조를 얻고 `SherpaVadEngine`/`recognizer.ensure` 생성을 시작할 수 있는데, 이 두 작업 순서가 뒤집히면(`deleteAll()` 이 먼저 실행) 방금 얻은 파일 경로가 사라진 채로 네이티브 로드가 시도된다. 실제 코드를 보면 `Recognizer.kt:51-57`·`SherpaVadEngine` 생성자(`Recognizer.kt:99-118`) 양쪽 다 네이티브 생성 실패를 `catch(Throwable)` 로 감싸 `SttException("MODEL_CORRUPT"/"AUDIO_INIT_FAILED", ...)` 로 변환하므로 **크래시로 이어지지는 않고**, 라우터가 이를 셀 수 있는 실패로 집계해 정상적으로 gateway 로 폴백한다(자가복구) — 그래서 심각도를 MEDIUM 으로 제한한다.
- **recommendation**: `deleteModel` 의 "busy 아님" 판정을 `worker.execute` 블록 안에서 한 번 더 확인(재확인 없이 삭제 진행하지 않기)하거나, `ModelStore` 삭제 자체를 `active`/`downloader` 상태와 같은 락으로 묶어 진짜 원자적 임계구역으로 만든다.

#### 그 밖(운영성, LOW — 이미 문서화된 후속이지만 QA/Leader 인지용으로 재기재)

- **[LOW] `Utterance`/#21 에 `fallbackReason`(온디바이스→gateway 전환 사유) 서버 보고 필드 없음** — `docs/design/speech-platform/12-engine-fallback-policy.md` 각주에 "후속" 으로 이미 명시돼 있어 새 지적은 아니지만, 관리자 "폴백 비율" 대시보드가 이번 task 로 늘어난 전환 사유를 구분하지 못하는 상태로 남는다는 점을 QA/Leader 가 인지하도록 재기재.

#### 통합 정합 실측(요청 항목 1의 "가능하면 JVM 테스트나 수동 대조") — 직접 코드 대조로 수행

Kotlin/Gradle 실행 환경이 이 세션에 없어 JVM 테스트 자체를 재실행하지는 못했으나(개발 로그의 51/51 은 신뢰), 위 HIGH 항목은 **양쪽 검증기 소스를 나란히 읽고 같은 입력에 대한 분기 결과를 직접 대조**해 확인한 것이며 B 쪽 단위테스트(`modelPackage.test.ts`)가 그 느슨함을 스스로 증명하는 fixture 를 이미 갖고 있어 추가 실행 없이도 결론이 코드로 뒷받침된다.

#### 그 외 확인(문제 없음 — 근거만 기재)

- **6층 경계**: `src/modules/infra/__tests__/nativeBoundary.test.ts` 3개 테스트(네이티브 패키지 import 0 / `window.Capacitor` 판독처 `bridge.ts` 유일 / `getOnDeviceStt()` 호출자 `onDeviceModel.ts` 유일) 통과 확인 + `eslint.config.mjs` diff 로 `NATIVE_PACKAGES` 패턴이 모든 경계 블록과 전역 블록에 적용됐음을 확인. **독립 재현(스크래치 클론, 아래)에서 `@capacitor/`·`@thekaiwa/sherpa-stt` grep 결과 실제 import/require 0건(주석 3건만)** 재확인.
- **PKCE 핵심 로직**: `pkce.ts`·`app-code.ts`(`bindAppAuthCode` = `sha256(code_r:challenge)`, 스키마 무변경, `updateMany` 조건부 단일 UPDATE 로 소각) · `state.ts`/`pending.ts`(challenge 서명 안에만, timing-safe nonce 비교) · `google/route.ts`(challenge 없는 `platform=app` 거부) · `google/callback/route.ts`(판정 순서 1~4, fail-closed) · `next-path.ts`(sentinel origin 오픈 리다이렉트 가드) — 전부 코드 읽고 로직 확인, 결함 없음.
- **공개 파일 라우트**: `src/app/models/[...path]/route.ts`·`src/app/app/download/[file]/route.ts`·`fileServe.ts`(Range/If-Range/ETag/`StreamSlots` 동시 4)·`storage.ts`(`joinUnder` 경로 조각 화이트리스트+realpath 심볼릭 링크 방어)·`appRelease.ts`(`resolveReleaseDownload`→`verifyReleaseFile` sha256 재계산 대조, 다른 파일이면 404) — 경로 탈출·해시 불일치·기록과 다른 파일 서빙 가능성 없음.
- **라우터/폴백**: `speech/stt/client/router.ts`(`decideRoute` 순수함수, 누를 때마다 재판정·`STOP_ON_START_FAILURE`·`NOT_COUNTED`·앱 실행 단위 카운터·오프라인 모드 미전환) · `OnDeviceSttClient.ts`(세대 카운터로 경쟁 방지, `handled` Set 으로 final 중복 처리 방지, wav 는 업로드 성공/실패 무관 `finally` 에서 항상 삭제, 업로드 5초 타임아웃) — 설계 문서(§11-11 ⑦, speech-platform/12 각주)와 구현 일치.
- **Kotlin 자원 해제**: `AudioCapture.kt`(정지 시 `halt()`→join(1.5s)→release 는 캡처 스레드 자신의 `finally`) · `SttSession.kt`(`closedNotified` AtomicBoolean CAS 로 `onClosed` 정확히 1회 보장, `handleOnPause` 가 세션 취소) · `ModelDownloader.kt`/`ModelStore.kt`(Range 재개, 파일별 sha256, 임시디렉터리→커밋 원자적 rename, 다운그레이드 거부, 취소·네트워크 전환 시 조각 보존) — 크래시 유발 지점 없음, 위 TOCTOU 1건 제외 결함 없음.
- **APK/Manifest/서명**: `AndroidManifest.xml`(딥링크 scheme+host+path 정확 일치, `allowBackup=false`+`dataExtractionRules` 전체 제외, `usesCleartextTraffic=false`, FileProvider `exported=false`+`cache-path` 만) · `build.gradle`(release `debuggable false`·`minifyEnabled false`(JNI 클래스명 보존 이유 명시)·`signingConfigs.sideload`) · `capacitor.config.ts`(`allowNavigation` 비움, `webContentsDebuggingEnabled:false`, `androidScheme:'https'`, `errorPath`) · `MainActivity.java`(`onPause` 쿠키 flush, `DownloadListener` https 만 시스템 브라우저로) — C1-2·C1-4 판정대로 구현됨을 확인.
- **네이티브 고지·versionCode**: task 이력서에 착수 전 고지 기록 있음(L27), `android/app/build.gradle` `kaiwaVersionCode=1`, 최초 배포이므로 증가 여부는 해당 없음(다음 네이티브 변경부터 적용 대상).

#### 독립 재현(스크래치 클론, `git archive 80f50e1`, 완료 후 삭제) — developer 자기 보고 대비 재검증

| 항목 | Developer 보고 | 독립 재현 결과 | 비고 |
|---|---|---|---|
| `tsc --noEmit` | 오류 0(전체 tsc 3건은 TalkRoom.tsx, 별도 진행 중 task 로 설명) | **오류 0**(570개 파일 확인, TalkRoom.tsx 포함) | 개발 로그의 "3건" 이 이 커밋 시점엔 이미 없음(과대 보고 방향 — 기능상 문제 아님, 기록 정확도만 낮음) |
| eslint(범위: `plugins/`·`capacitor.config.ts`·`infra/native`·`speech/stt`) | 0 | **0** | 일치 |
| eslint(전체 저장소) | (미보고) | 2 errors(`DiagnosticsScreen.tsx:5-6`, `no-require-imports`)·5 warnings(`set-state-in-effect`, 기존 관행) | **전부 이번 task 밖 파일**(`DiagnosticsScreen.tsx` 은 diff에 없음) — task-003f 회귀 아님 |
| `npm run test`(스크래치에선 `sync-local.sh` 우회 위해 러너 직접 호출) | 480/480 | **481/481**(64 파일) | 1건 과소 보고(개수 착오) — 기능상 문제 아님 |
| `grep '@capacitor/\|@thekaiwa/sherpa-stt'` in `src/` | 0(주장) | **실제 import/require 0**(주석 3건만) | 확인됨 |
| A `assembleDebug`/JVM 51/51 | 재실행 못 함(JDK/Android SDK 없음, developer 자기 환경 결과 신뢰) | — | Kotlin 코드 직접 대조로 로직 검증(위 HIGH 근거) |

스크래치 디렉터리는 검증 후 삭제 확인(`rm -rf` 완료 로그).

#### QA 인계 — high_risk_areas
1. **모델 manifest 스키마 정합**(위 HIGH) — 지금 QA 는 실기기 없이 통과 가능(현재 파일이 양쪽 다 만족)하지만, **다음 모델 버전 교체 리허설이 있다면 B 검증만으로 안심하지 말고 Kotlin 쪽 규칙(엔진·modelType·sampleRate·5-role)까지 수동 대조**할 것.
2. **PKCE 경로 GET 노출**(위 MEDIUM) — 기능 회귀는 아니므로 QA 통과 차단 사유는 아니나, nginx 접근 로그 정책(운영 배포 전) 검토를 Leader/deployer 에 전달.
3. **F6 실기기 확인 목록**(developer 이력서에 이미 상세 기재, QA/사용자 폰 필요 — NOT_VERIFIED로 유지):
   - APK 설치→연결 실패 화면(비행기 모드)→[다시 시도]
   - 로그인: Custom Tabs→`thekaiwa://` 302→앱 열림→완전 종료 후 재실행해도 로그인 유지
   - 키보드/상태바/내비바 겹침 없음, 외부 링크가 WebView 에 안 남고 Chrome 으로 열림
   - 마이크 권한 첫 대화상자, 2회 거절→[앱 설정 열기]
   - 모델 받기: Wi-Fi 진행률·일시정지·**강제종료 중 이어받기**·모바일 데이터 명시 동의
   - 온디바이스 20문장 partial/final + 진단 카드 **`lastDecodeMs` ≤800ms·`rssMb` ≤600MB**(5초 발화, numThreads 2/3/4)
   - `convertFileSrc(wavPath)` fetch 업로드→회화 턴 "내 목소리 ▶"
   - 모델 지우기→서버 인식 동일 동작, 말하는 중 홈 버튼→녹음 표시 즉시 꺼짐
   - 업데이트 띠→Custom Tabs APK 받기→덮어쓰기 설치 후 로그인 유지
4. **native_change: true** — 첫 배포본이라 versionCode 증가 요건은 해당 없음(다음 네이티브 변경부터 적용).

#### Codex 검토
이 REV-021 은 C1(설계 단계) 이후 첫 구현 감사이며 C2(Reviewer PASS 직후) 판정은 이 기록 이후 judge 가 수행한다. 여기서는 Codex C1 4건(딥링크 탈취·debuggable·manifest 서명·WebView 탐색)에 대한 **Leader 판정의 구현 반영 여부**만 확인했다 — C1-1(PKCE) 반영 확인(단 위 MEDIUM 잔여), C1-2(release 비디버그) 반영 확인, C1-3(manifest 강화, 서명은 보류 결정대로) 반영 확인하되 **B 쪽 강화가 A 요건에 못 미침을 위 HIGH 로 별도 지적**, C1-4(WebView 탐색 제한) 반영 확인(`Bridge.launchIntent` 동작을 developer 가 Capacitor 7.6.9 소스로 확인한 근거도 코드 구조상 타당).

### REV-022 (2026-09-28, eec8872 + 25c1cae — REV-021 수정 재검증)

**판정: PASS**(Critical 0 · High 0 · Medium 2 · Low 2) — REV-021 의 High 1·Medium 2 전부 실제로 해소됐음을 코드 대조·라이브 테스트 근거로 확인. 재검증 중 새로 발견한 tsc 회귀 1건(Medium, 원인·수정법 확정)과 두 가지 판단 요청(레이스·CSRF)에 대한 결론을 아래에 기재. Read 전용, 코드 수정 없음.

```json
{
  "reviewId": "REV-022",
  "status": "PASS",
  "summary": { "critical": 0, "high": 0, "medium": 2, "low": 2 },
  "high_risk_areas": ["scripts/models-verify.ts tsc 회귀(1줄 수정 필요)", "다운로드 커밋↔활성 세션 VAD 파일 경합(사전부터 있던 잔여, 이번 수정 범위 밖)"],
  "native_change": true
}
```

#### 1) HIGH(manifest 스키마 괴리) — **해소 확인**
- **대조 방법**: (a) `plugins/sherpa-stt/android/.../Manifest.kt`(`ManifestValidator.parse`, 25c1cae 본문 재확인)와 `src/modules/speech/stt/manifestRules.ts`(`parseManifest`)를 **조건 순서 그대로 한 줄씩 대조** — name/version 원값 취득 순서(존재 검사 먼저·형식 검사 나중, 둘 다 name→version 순) · `engine`="sherpa-onnx"·`modelType`="transducer"·`sampleRate`=16000(정수 일치) 필수 · `files.length` 하한 5(`ROLES.size`)~16 · per-file 순서(path→sha256→bytes→role→중복 path→중복 role) · `roles != ROLES` 최종 검사 · `totalBytes` 일치 · `minPluginVersion` semver — **전 조건·전 순서 일치**(파생 코드 아님에도 완전한 포트). `sha256` 은 양쪽 다 소문자 전용 정규식(`[0-9a-f]{64}`, 대문자 거절)으로 통일 확인, `name`/`version` 의 `..` 명시적 거절도 양쪽에 동일 추가됨을 확인.
  (b) **서버 쪽 픽스처 실행**: 공용 픽스처 `plugins/sherpa-stt/test-fixtures/manifest-cases.json`(53 사례, `MANIFEST_INVALID` 47·`valid` 5·`APP_UPDATE_REQUIRED` 1)을 직접 열람 — `name-dotdot`·`version-dotdot`·`sha-uppercase` 등 이번에 조인 3개 규칙에 대응하는 사례가 실제로 들어 있음을 확인. `src/modules/speech/__tests__/modelPackage.test.ts`(46~62행)가 이 파일의 53개 사례 전부를 서버 `parseManifestText` 로 돌려 "plugin 이 valid·APP_UPDATE_REQUIRED 인 사례만 통과"를 단정하는 테스트임을 코드로 확인(스크래치 클론에서 `npm test` 484/484 전부 통과 — 이 테스트 포함).
  (c) **JVM 쪽**: 이 세션에 Android SDK/AGP 로 플러그인 모듈 자체를 빌드해 돌리진 않았으나(아래 "실행 한계" 참조), `plugins/sherpa-stt/android/.../ManifestFixtureTest.kt`(`everySharedCaseGetsTheExpectedVerdict`)가 **같은 파일**을 읽어 53개 전부에 대해 `ManifestValidator.parse` 결과가 `plugin` 필드와 일치하는지 assert 하는 구조임을 코드로 확인 — (a)의 줄 단위 대조와 결합하면 "서버가 통과시키는 걸 플러그인이 거절"하는 사례가 남아 있을 가능성은 사실상 없다고 판단.
  (d) **배포 전 게이트**: REV-021 에서 지적한 미존재 `scripts/models-verify.sh`(참조만 있고 파일 없음)가 이번에 실제로 생겼다 — `scripts/models-verify.ts` 가 `manifestRules.ts` 를 직접 import 해 디스크 버전 디렉터리의 파일 크기·sha256 까지 대조(§아래 신규 발견 참고). `speech/models/README.md` §5 배포 절차에 이 게이트가 두 지점(신규 manifest 검증 전, rename 후 재확인)에 실제로 박혀 있음을 확인.
- **결론**: HIGH 는 실질적으로 해소. 다만 아래 "신규 발견" 의 tsc 회귀 때문에 이 게이트 스크립트 자체가 **타입체크 기준으로는 깨져 있다**(런타임은 `tsx` 라 정상 동작 — 상세 아래).

#### 2) MEDIUM(PKCE code_r+verifier가 URL에 노출) — **해소 확인**
- `src/modules/infra/native/appLogin.ts`(`exchangeAppCode`)가 `fetch('/api/auth/app-exchange', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code,verifier,next})})` 로 교환하고, `src/app/(auth)/login/AppDeepLink.client.tsx`(66-68행)가 성공 시 서버가 돌려준 `next` 로만 `location.replace` 함 — **code·verifier 가 URL·주소창·nginx 접근 로그에 더 이상 나타나지 않는다.** `appExchangeUrl`(옛 쿼리스트링 조립 함수) 자체가 삭제됐고 `grep -rn "appExchangeUrl" src/` 0건(스크래치 클론에서 재확인).
- **"Set-Cookie 가 POST fetch 로 실제 설정되는가"**: 그렇다. `fetch(..., {credentials:'same-origin'})` 는 표준에 따라 같은 출처 응답의 `Set-Cookie` 를 브라우저 쿠키 저장소에 반영한다(JS 가 `res.headers.get('set-cookie')` 로 읽을 수 없는 것과는 별개 — 저장 자체는 JS 개입 없이 일어난다). 응답 처리 코드(`app-exchange/route.ts` 47-48행)는 REV-021 이전과 **동일한** `setSessionCookie(res, {...})`(httpOnly+secure+sameSite=lax, `session.ts`/`jwt.ts` 미변경)를 그대로 쓴다 — 쿠키 옵션 자체는 이번 변경의 영향을 받지 않는다. 이후 `location.replace(next)` 는 이미 쿠키가 심긴 뒤의 별도 네비게이션이라 문제없이 세션이 유지된다. **라이브 E2E**(`tests/live/task003f-ui-e2e.mjs` 신규 블록, 가로채지 않은 실제 서버 교환 1회)가 실제 브라우저의 Origin/Sec-Fetch-Site 로 통과하고 `/study/today` 로 이동함을 코드로 확인(개발자 보고 77/77 — 이 세션에선 dev 서버를 새로 띄우지 않아 직접 재실행하지 않음, 아래 "실행 한계").
- **CSRF 방어 판정**: 충분하다고 판단한다. ① `Content-Type: application/json` 강제 — HTML `<form>` 은 이 값을 못 보내고(3종 단순 타입 밖), 교차 출처 JS `fetch` 로 이 헤더를 붙이면 브라우저가 CORS 프리플라이트를 강제하는데 서버에 `OPTIONS`/CORS 허용 헤더가 없어 실제 요청이 전송되지 않는다(사전 방어). ② 그 위에 `isSameOriginJsonRequest`(`app-exchange.ts`)가 `Sec-Fetch-Site`(있으면 정확히 `same-origin` 만)와 `Origin`(있으면 Host 와 정확히 일치) 를 **독립적으로** 재확인 — 단위테스트(`task003f.test.ts` 신규 블록)가 `sec-fetch-site: same-site`(같은 최상위 도메인의 다른 서브도메인)까지 거절함을 직접 검증해 흔한 실수(same-site 를 same-origin 으로 착각)를 피했다. ③ 두 표시가 전부 없는 요청(구식 클라이언트 흉내)도 거절 — 앱 WebView(최신 Chromium 기반)는 항상 `Sec-Fetch-Site` 를 보내므로 실사용에 지장 없음.
- **"실패해도 코드를 태우지 않는다" — 안전한가(Leader 요청 판단)**: **안전하다고 판단한다.** 이 동작은 이번 수정이 새로 만든 것이 아니라 `consumeAppAuthCode`(`app-code.ts`, REV-021 그대로 미변경)의 원래 설계다 — DB 조회 키 자체가 `sha256(code_r + ":" + S256(verifier))`(둘 다 32바이트 랜덤, 각각 256비트 엔트로피)이므로 verifier 를 모르면애초에 "그 행" 을 가리키는 값 자체를 계산할 수 없고(다른 무관한 해시가 나올 뿐), `burn()` 이 매치 없이 0건으로 끝나 아무것도 변경되지 않는다. 무제한 재시도를 허용해도 공격자가 얻는 것은 없다(맞는 code_r 을 추측할 확률·맞는 verifier 를 추측할 확률 모두 사실상 0, 두 조건이 AND 로 걸려 있어 곱해지지도 않고 애초에 개별로도 무의미). 별도 IP 레이트리밋도 없지만(구 GET 경로도 없었음 — 변경 없음), 위와 같은 이유로 필요하지 않다고 판단한다. **라이브 스모크 D3~D8**(가로챈 code_r 만·틀린 verifier·DB 결속값 재사용·GET 405·폼 형식·다른 Origin·`Sec-Fetch-Site: cross-site`·표시 없음 — 전부 거절을 확인한 뒤) **D6 에서 같은 code_r+verifier 로 정상 교환 성공**을 코드로 확인 — 즉 위 8가지 실패 시도 전부가 실제로 코드를 태우지 않았음을 라이브 테스트가 **직접 증명**한다(개발자 보고 스모크 36/36 — 이 세션에서 dev 서버를 새로 띄워 재실행하지는 않음).

#### 3) MEDIUM(deleteModel↔start TOCTOU) — **해소 확인**
- `ModelGate<S,D>`(신규, `plugins/sherpa-stt/android/.../ModelGate.kt`) — `session`·`download`·`deleting` 세 상태를 **모두 같은 모니터**(`@Synchronized`, 즉 `synchronized(this)`)로 판정+점유한다. `SherpaSttPlugin.start()` 는 `gate.openSession { openSession(o) }` 로 바꿔, 설치본 확인(`store.current()`)·VAD 네이티브 생성·`AudioRecord` 오픈까지 **gate 락 보유 중에** 실행되도록 옮겼다(이전엔 판정만 락 안·실행은 밖이었다) — `deleteModel` 은 `beginDelete()`(판정+점유가 한 호출)로 바뀌어 그 사이 `start`·`downloadModel` 은 즉시 `BUSY`.
- **레이스**: 세션 로드(`worker.execute` 안의 `recognizer.ensure`)는 **실행 시점에 `store.current()` 를 다시 읽는다**(238행) — 세션 시작과 워커 실행 사이에 다운로드가 새 버전을 커밋해도 스테일 경로를 잡지 않는다. `ModelStore.commit`/`ModelGate` 양쪽 다 관련 코드를 직접 읽어 확인.
- **데드락 가능성 검토(Leader 요청)**: 이 설계에 쓰이는 락은 사실상 **`gate` 하나뿐**이다(플러그인의 옛 `lock` 필드는 삭제되고 전부 `gate`/`synchronized(gate)` 로 옮겨짐 — `pendingStops` 도 포함, `stop()`·`onClosed` 에서 확인). 자바 모니터는 재진입 가능해서 `synchronized(gate){ gate.session() }`(같은 스레드가 `gate` 를 두 번 잡음)은 안전하다. 두 번째 락을 반대 순서로 잡는 지점이 없어 **A-B/B-A 교착 패턴 자체가 성립하지 않는다.** `openSession` 의 `open()` 람다가 `worker.execute{...}` 를 부르지만 이건 **제출만 하고 기다리지 않는** fire-and-forget 이라 "gate 를 잡은 채 worker 완료를 기다림" 도 없다 — 데드락 경로를 찾지 못했다. 유일한 실질 비용은 **락 보유 시간이 늘어난 것**(네이티브 VAD 로드+마이크 오픈이 몇~수십 ms 걸리는 동안 다른 `start`/`deleteModel`/`downloadModel` 호출이 그만큼 대기) — 이는 원래 버그(삭제된 파일 위에서 로드 시도)를 없애기 위한 의도된 트레이드오프로 판단, 문제 아님.
- **잔여(이번 수정 범위 밖, LOW)**: `beginDownload` 는 `session != null` 을 막지 않는다(의도 — "다운로드 중에도 회화 가능") — 따라서 **세션이 이미 VAD 파일 경로를 잡은 뒤, 그 세션이 끝나기 전에 다른 다운로드가 커밋**(`ModelStore.commit` 이 옛 버전 디렉터리를 통째로 `deleteRecursively()`)되면 그 세션이 참조 중인 파일이 사라질 수 있는 이론적 경합이 남아 있다. 이 경합은 **REV-021 이전부터 있던 것으로(이번 수정이 다루는 delete-vs-start 문제와 다른 축) 다운로드는 수 분이 걸리고 VAD 네이티브 로드는 세션 시작 직후 수십 ms 안에 끝나 창이 극히 좁다 — 실무 영향은 낮다고 판단해 Low 로만 남긴다(후속 트래킹 권고, 이번 REV-022 판정에는 반영하지 않음).
- **테스트**: `ModelGateTest.kt`(개발자 주장 — 실패한 open 이 점유를 남기지 않음, 삭제 중 open/download 즉시 BUSY, **2,000회 반복 2-스레드 CyclicBarrier 경합에서 overlap 카운터 0**)·`DeleteVsStartTest.kt`(delete 점유~worker 삭제 사이 start=BUSY, 삭제 후=MODEL_MISSING) 를 직접 열람 — 진짜 두 스레드 풀 기반 동시성 스트레스 테스트로 설계돼 있어(가짜 순차 호출이 아님) 신뢰도가 높다고 판단한다.

#### 신규 발견 — [MEDIUM] `scripts/models-verify.ts` tsc 회귀(TS5097), developer 자기 보고("tsc 0")와 불일치
- **component**: `scripts/models-verify.ts:15` — `import { ManifestError, parseManifestText } from '../src/modules/speech/stt/manifestRules.ts'`(명시적 `.ts` 확장자)
- **evidence**: 스크래치 클론(HEAD `ffe9d61` 아카이브)에서 `tsc --noEmit` 독립 재실행 → **exit 2**, `scripts/models-verify.ts(15,50): error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.` `tsconfig.json` 은 `allowImportingTsExtensions` 를 켜지 않았고 `"include"` 가 `**/*.ts` 라 이 파일도 전체 타입체크 대상이다.
- **원인**: `scripts/sync-local.sh` 는 `src/`·`plugins/`·정해진 설정 파일만 미러(`~/.node-local/thekaiwa`)로 보내고 **`scripts/` 디렉터리 자체를 동기화하지 않는다**(`grep scripts scripts/sync-local.sh` 0건). Developer 는 관행대로 `sync-local.sh && cd ~/.node-local/thekaiwa && tsc --noEmit` 로 확인했는데, 그 미러에는 `scripts/models-verify.ts` 가 애초에 없어 tsc 가 이 파일을 본 적이 없다 — "tsc 0 error" 보고가 **거짓이 아니라 사각지대**였다(같은 로그의 `npm run test 484(483 pass+1 skip)` 도 이 세션 스크래치에서 484 pass/0 skip 으로 나왔는데, 이건 버그가 아니라 `modelPackage.test.ts` 의 스킵 조건이 `speech/models/manifest.example.json` 을 상대 경로로 찾는데 git archive 로 뜬 저장소엔 그 파일이 커밋돼 있어 스킵 없이 통과됐을 뿐 — 미러에는 `speech/` 가 없어 스킵되는 것과 대비되는, 실행 위치에 따른 정상적 차이).
- **risk**: 런타임 영향은 없다(§는 `bash scripts/models-verify.sh` 가 `node --import tsx`(tsx 는 `.ts` 확장자 import 를 허용) 로 실행하므로 배포 게이트 스크립트 자체는 정상 동작 — developer 이력서의 "실측: engine 변조 FAIL exit 1·중복 키 FAIL" 도 이와 일치). 다만 (1) 프로젝트가 모든 이전 REV 에서 "tsc 0" 을 완료 기준으로 삼아 왔는데 이번 커밋은 그 기준을 실제로 어겼고, (2) `scripts/` 가 미러에 없어 이런 종류의 문제가 앞으로도 조용히 재발할 수 있다(사각지대 자체가 남음).
- **recommendation**: `scripts/models-verify.ts:15` 의 import 에서 `.ts` 확장자만 떼면 끝난다(`from '../src/modules/speech/stt/manifestRules'` — 프로젝트 전역 관행과도 일치). 겸사겸사 `scripts/sync-local.sh` 에 `scripts/` 동기화(또는 최소한 `*.ts` 스크립트)를 추가하거나, tsc 를 NFS 원본에서도 주기적으로 돌리는 습관을 권고(이번처럼 미러 전용 검증이 놓치는 파일이 또 생길 수 있음).
- **판정에 대한 영향**: Critical/High 아님(런타임 무영향·한 줄 수정) — Medium 으로 기록하고 **Developer 에게 즉시 수정 요청**. 이 항목 때문에 REV-022 를 FAIL/CONDITIONAL 로 내리지는 않지만, **QA 인계 전 이 한 줄은 고쳐져야** "tsc 0" 이 실제 사실이 된다.

#### 회귀 확인(스크래치 클론, HEAD `ffe9d61` 아카이브 — 검증 후 삭제, `~/.node-local/thekaiwa-apk` 는 손대지 않음)
| 항목 | Developer 보고 | 독립 재현 | 비고 |
|---|---|---|---|
| `tsc --noEmit` | 0 | **exit 2, 1건**(`scripts/models-verify.ts` TS5097) | 위 신규 발견 — 미러 사각지대 |
| eslint(전체 저장소) | (미보고) | 2 errors(`ecosystem.config.js` no-require-imports)·5 warnings(`set-state-in-effect`, 기존 관행) | 전부 **이번 diff 밖 파일** — 회귀 아님(REV-021 때와 동일 항목) |
| eslint(이번에 손댄 범위: `plugins/`·`capacitor.config.ts`·`infra/auth/oauth/**`·`speech/stt/**`·`api/auth/app-exchange/**`) | 0 | **0** | 일치 |
| `npm run test` | 483 pass + 1 skip = 484 | **484 pass + 0 skip = 484** | 총량 일치, 배분만 다름(스킵 조건이 저장소 사본 존재 여부에 좌우 — 버그 아님, 위 원인 설명) |
| `grep appExchangeUrl src/` | (삭제됨) | **0건** | 확인 |
| `app-exchange/route.ts` 가 `searchParams` 를 더 이상 안 씀 | 주장 | **확인**(`consumeAppAuthCode(input.code, input.verifier)` 만, `searchParams.get` 없음) | 확인 |
| `@capacitor/*`·`@thekaiwa/sherpa-stt` grep(src) | 0(주장) | **주석만 3건, 실제 import 0** | 확인 |

#### 실행 한계(이 세션에서 직접 하지 못한 것 — 근거는 대신 코드/기존 테스트 열람으로 보강)
- **JVM 단위 테스트(51→60, `ModelGateTest`·`DeleteVsStartTest`·`ManifestFixtureTest` 포함)를 이 세션에서 직접 실행하지 않았다** — Android SDK/Gradle 전체 빌드는 시간이 오래 걸리고 Leader 가 `~/.node-local/thekaiwa-apk`(developer 전용 빌드 작업 디렉터리)를 건드리지 말라고 지시했으며, 별도의 격리된 Gradle 빌드를 새로 만드는 것도 이번 재검증 범위에서는 과하다고 판단해 **Manifest.kt/ModelGate.kt/ModelGateTest.kt/ManifestFixtureTest.kt 전문을 직접 읽고 TS 쪽과 한 줄씩 대조하는 방법**으로 대신했다(위 1)·3) 절 참고). 이 방식의 한계: 컴파일이 실제로 되는지, 테스트가 실제로 통과하는지는 developer 자기 보고(JVM 60/60)에 의존한다 — 다만 이번 REV-022 에서 **tsc 자기 보고가 미러 사각지대로 실제와 달랐던 사례를 하나 직접 잡아냈으므로**, JVM 쪽도 유사한 사각지대가 있을 가능성은 배제하지 못한다. **권고**: 다음 순환(다음 커밋 또는 QA 단계)에서 한 번은 `bash scripts/build-apk.sh --test` 를 **개발자 본인이 아닌 다른 사람/세션**이 재실행해 JVM 60/60 을 한 번 더 확인하는 것을 권장.
- 라이브 스모크(36/36)·화면 E2E(77/77) 를 이 세션에서 dev 서버를 새로 띄워 재실행하지 않았다(REV-021 때와 같은 이유 — 실행 중인 pm2/dev 환경과 충돌 위험, 그리고 이번엔 코드 열람만으로도 로직 정합을 충분히 확인할 수 있었다고 판단). 대신 두 스크립트의 **신규 추가된 assertion 코드**(D3~D8 POST 변환, D5b~D5f CSRF 케이스, 실제 서버 교환 블록)를 전문 열람해 검증 대상·판정 로직이 이번 수정과 정확히 대응함을 확인했다.

#### QA 인계 갱신
- REV-021 의 high_risk_areas 3건 중 2건(PKCE 노출·TOCTOU) 은 이번에 해소 확인, 나머지 1건(manifest 스키마 정합)도 해소됐으나 **`scripts/models-verify.ts` 한 줄 수정 전까지는 "tsc 0" 이 거짓**이라는 점을 QA 체크리스트에 추가(수정 후 QA 가 `tsc --noEmit` 로 재확인).
- 다운로드 커밋↔활성 세션 VAD 파일 경합(LOW, 위 3절)은 F6 실기기 확인 시 "모델 받는 중에 회화 시작" 같은 조합 테스트에서 우연히 재현될 가능성은 낮지만 QA 가 인지만 해 둘 것.
- F6 실기기 확인 목록은 REV-021 과 동일(변경 없음).

## Deployer 기록

## 최종 요약
