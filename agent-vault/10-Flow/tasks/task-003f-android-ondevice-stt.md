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

### B(웹·서버)
- [08:53] 착수 — 순서: F4 서버(`/models/*`·`/api/app/version`·`/app/download/*`·#19 `onDevice.model`·C1-1 PKCE) → F3 웹 연결(bridge·온디바이스 클라이언트·라우터·앱 로그인) → 화면(designer §11 이후). A 의 플러그인 계약은 아직 없어 `plugins/sherpa-stt/README.md` §4 로 가정하고 나중에 맞춘다.

## Reviewer 기록

## QA 기록

## Deployer 기록

## 최종 요약
