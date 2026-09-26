# @thekaiwa/sherpa-stt — 온디바이스 실시간 STT Capacitor 플러그인 (골격)

> 상태: 설계 골격(코드 없음). 구현 task-003(b). Capacitor 7 · Kotlin · sherpa-onnx Android AAR. 경계 규칙 정본: [`docs/design/module-dependency.md`](../../docs/design/module-dependency.md) §6. 모델 규약: [`speech/models/README.md`](../../speech/models/README.md).

## 1. 목적

안드로이드 기본 STT 를 쓰지 않고(사용자 지시), **휴대폰 CPU·메모리로** silero VAD + ReazonSpeech(zipformer transducer int8, sherpa-onnx) 를 돌려 발화를 실시간 인식한다. 서버 gateway 와 같은 모델·같은 이벤트 형태라 클라이언트 `RealtimeSttClient` 인터페이스 뒤에서 서로 바뀐다. 실시간의 실체는 "VAD 세그먼트 → 오프라인 디코드"(스트리밍 JA 모델 없음)이며 5초 발화 디코드 ≈0.3s 라 체감은 실시간이다.

## 2. 레이아웃 (Capacitor 7 플러그인)

```
plugins/sherpa-stt/
├── package.json                 # name @thekaiwa/sherpa-stt, "capacitor": { "android": { "src": "android" } }, 로컬 경로 의존(file:plugins/sherpa-stt)
├── src/
│   ├── definitions.ts           # SherpaSttPlugin 타입 — 계약 문서 역할. 웹 번들은 이 파일을 import 하지 않는다(bridge.ts 가 손으로 옮겨 적음)
│   ├── index.ts                 # registerPlugin('SherpaStt') — 네이티브 등록만, web 구현 없음
│   └── web.ts                   # 모든 메서드가 unavailable 을 던지는 stub(브라우저에서 호출되면 안 됨)
├── android/
│   ├── build.gradle             # sherpa-onnx AAR 의존(버전 고정, §3) · minSdk 26 · Kotlin
│   ├── libs/                    # (선택) sherpa-onnx-<ver>.aar 프리빌드 — Maven 좌표를 쓰면 비움
│   └── src/main/
│       ├── AndroidManifest.xml  # <uses-permission android:name="android.permission.RECORD_AUDIO"/>
│       └── java/com/miraclepenguin/kaiwa/sherpastt/
│           ├── SherpaSttPlugin.kt      # @CapacitorPlugin(name="SherpaStt", permissions=[RECORD_AUDIO]) — 메서드·이벤트·권한
│           ├── AudioCapture.kt         # AudioRecord 16kHz mono PCM16, 40ms 프레임, 전용 스레드
│           ├── VadSegmenter.kt         # sherpa-onnx Vad(silero) 상태기계 → 세그먼트 큐
│           ├── Recognizer.kt           # OfflineRecognizer(zipformer transducer int8) 로드·디코드(백그라운드 스레드)
│           ├── ModelStore.kt           # filesDir/models/<version>/ 관리·checkModel
│           ├── ModelDownloader.kt      # manifest 다운로드·Range 재개·sha256 검증·원자적 전환·진행 이벤트
│           └── WavWriter.kt            # 세그먼트 wav 저장(final.wavPath) — 앱이 업로드 후 삭제
├── README.md
└── CHANGELOG.md
```

- 앱 `capacitor.config.ts` 에 별도 등록은 필요 없다(Capacitor 7 은 `node_modules` 의 플러그인을 `cap sync` 가 자동 수집). 루트 `package.json` 에 `"@thekaiwa/sherpa-stt": "file:plugins/sherpa-stt"`.
- 웹 번들 규칙: `src/modules/infra/native/bridge.ts` 만 `window.Capacitor.Plugins.SherpaStt` 를 읽는다. 앱 코드는 `@thekaiwa/sherpa-stt`·`@capacitor/*` 를 import 하지 않는다(ESLint `no-restricted-imports`). 플러그인이 빠진 APK·PC 브라우저에서도 화면이 죽지 않아야 한다.

## 3. sherpa-onnx AAR 버전 고정

- 배포면: sherpa-onnx 릴리스의 Android 프리빌드 AAR(`sherpa-onnx-<ver>.aar`, JNI `arm64-v8a`·`armeabi-v7a`) 또는 Maven 좌표. **버전은 task-003 실측 시 확정**해 `android/build.gradle` 과 이 README·`CHANGELOG.md` 에 고정 표기하고, 이후 변경은 네이티브 변경(§8 APK 재설치)으로 다룬다.
- 확정 시 기록할 것: AAR 버전 · ABI 목록(`abiFilters` 로 `arm64-v8a` 만 포함해 APK 크기 절감 검토) · 모델 manifest `minPluginVersion` · 실측 기기(S25+) · int8 encoder 디코드 시간.
- 모델은 AAR 에도 APK 에도 넣지 않는다(§5).

## 4. API

### 메서드

| 메서드 | 파라미터 | 반환 | 설명 |
|---|---|---|---|
| `checkPermissions()` / `requestPermissions()` | — | `{ recordAudio: 'prompt'\|'prompt-with-rationale'\|'granted'\|'denied' }` | Capacitor 표준 권한 API(`@CapacitorPlugin(permissions)` 자동 생성). 거부 시 앱은 텍스트 입력 폴백 안내 |
| `checkModel(options?)` | `{ name?: 'reazonspeech-int8' }` | `{ installed: boolean, version?: string, bytes?: number, path?: string }` | `filesDir/models/<version>/` 에 manifest 의 파일이 전부 있고 sha256 인덱스가 맞으면 installed |
| `downloadModel(options)` | `{ manifestUrl: string, wifiOnly?: boolean(기본 true), expectedVersion?: string }` | `{ version: string, bytes: number }` | manifest 조회 → 파일별 다운로드(HTTP Range 재개, `.part`) → sha256 검증 → 임시 디렉토리 → 원자적 rename → 옛 버전 정리. 진행은 `downloadProgress` 이벤트. 셀룰러+`wifiOnly` 면 `NETWORK_NOT_ALLOWED` 거부 |
| `start(options)` | `{ vad: { silenceMs: number(500), threshold?: number(0.5), minSpeechMs?: number(250), maxSegmentSec?: number(30) }, partial?: boolean(true), numThreads?: number(2), decodingMethod?: 'greedy_search'\|'modified_beam_search', modelVersion?: string, saveWav?: boolean(true), maxUtteranceSec?: number(60) }` | `{ sessionId: string, modelVersion: string }` | 권한·모델 확인 → `Recognizer` 로드(캐시) → `AudioRecord` 시작. 이미 시작돼 있으면 `ALREADY_STARTED`. 옵션 값의 출처는 `GET /api/v1/speech/config` (§6) |
| `stop()` | — | `{ sessionId, utterance?: FinalPayload }` | 캡처 중단 → 남은 버퍼를 강제 세그먼트로 디코드 → `final` 이벤트 후 반환. 세션이 없으면 no-op |
| `release()` | — | `void` | `Recognizer`·VAD 모델 메모리 해제(앱 백그라운드 장기 진입·메모리 경고 시). 다음 `start()` 가 다시 로드 |

### 이벤트 (`addListener(name, handler)`)

| 이벤트 | payload | 시점 |
|---|---|---|
| `vad` | `{ sessionId, state: 'speech'\|'silence', atMs }` | VAD 상태 전이(푸시투토크 버튼의 파형/상태 표시) |
| `partial` | `{ sessionId, segIdx, text }` | 세그먼트 디코드 완료(자막). `partial:false` 면 송출 안 함 |
| `final` | `{ sessionId, text, durationMs, wavPath?, segments: [{segIdx, text, startMs, endMs}], timings: { vadMs, decodeMs, loadMs }, modelVersion, engine: 'reazon-ondevice' }` | `stop()` 또는 `maxUtteranceSec` 도달. `wavPath` 는 `filesDir/utterances/<sessionId>.wav`(16k mono) — 앱이 `POST /api/v1/speech/utterances` 업로드 후 `deleteWav` 없이도 다음 `start()` 가 정리 |
| `error` | `{ sessionId?, code: 'PERMISSION_DENIED'\|'MODEL_MISSING'\|'MODEL_CORRUPT'\|'AUDIO_INIT_FAILED'\|'DECODE_FAILED'\|'OOM'\|'NETWORK_NOT_ALLOWED'\|'DOWNLOAD_FAILED', message }` | 오류. 앱 라우터의 폴백 카운트 입력(§7) |
| `downloadProgress` | `{ file, received, total, totalReceived, totalBytes }` | 다운로드 중 250ms 간격 |

이벤트명·필드는 gateway WS 프로토콜(`speech/gateway/README.md` §2)과 같게 유지한다 — `WebSocketSttClient` 와 `OnDeviceSherpaClient` 가 같은 `SttEvent` 로 정규화하기 위해서다. 차이는 `final.utteranceId` 가 온디바이스에서는 없고(업로드 후 앱이 부여) `wavPath` 가 있다는 점뿐이다.

## 5. 모델 다운로드·검증·저장

- 출처: `GET https://kaiwa.<도메인>/models/reazonspeech-int8/manifest.json`(URL 은 `GET /api/v1/speech/config.onDevice.manifestUrl` 로 받음, 앱 상수 아님).
- 저장: `context.filesDir/models/<version>/`(앱 전용, 사용자 접근 불가, 앱 삭제 시 함께 삭제). 다운로드 중 `filesDir/models/.tmp-<version>/` → 완료·검증 후 rename. 디스크 여유 < `totalBytes × 2.5` 면 시작하지 않음.
- 검증: 파일별 sha256(스트리밍 계산) + `totalBytes`. 실패 파일만 재다운로드, 3회 실패 시 `.tmp` 폐기 + `DOWNLOAD_FAILED`. 검증에 성공한 버전만 `checkModel().installed=true`.
- 갱신: `checkModel().version ≠ config.onDevice.modelVersion` 이면 앱이 `downloadModel` 을 다시 부른다(옛 버전은 새 버전 전환 뒤 삭제). **APK 재설치 없이** 모델이 바뀐다.
- 크기 ≈160MB(encoder int8 ≈148MB). Wi-Fi 안내·재개·진행률 UX 는 `speech/models/README.md` §4.

## 6. 런타임 설정은 서버가 준다

앱 기동 시 `GET /api/v1/speech/config` 응답의 `onDevice` 블록을 그대로 `start()` 옵션에 넘긴다:

```json
{ "onDevice": { "engineConnectionId": "reazon-ondevice", "modelVersion": "2024-08-01-int8-v1",
                "manifestUrl": "https://kaiwa.…/models/reazonspeech-int8/manifest.json",
                "numThreads": 2, "decodingMethod": "greedy_search",
                "vad": { "silenceMs": 500, "threshold": 0.5, "minSpeechMs": 250, "maxSegmentSec": 30 },
                "maxUtteranceSec": 60 },
  "fallback": { "toGateway": true, "wsPath": "/ws/speech" },
  "recognitionMode": "AUTO" }
```
값의 출처는 `EngineConnection(reazon-ondevice, connectionType=ONDEVICE).runtime`(설정 해석 6순위)이며 콘솔에서 바꾸면 다음 기동에 반영된다. `numThreads` 는 2~4 사이에서 P0 실측으로 정한다(발열·배터리 대 디코드 시간). 시크릿은 없다.

## 7. 폴백 규칙 (클라이언트 라우터 `speech.createRealtimeSttClient`)

1. `getSherpaStt()` 가 `null`(플러그인 없음·메서드 누락) 또는 `checkModel().installed=false` → `WebSocketSttClient`(gateway). 모델 다운로드는 백그라운드로 계속.
2. 세션 중 플러그인 `error` 이벤트 또는 `start()` 거부가 **2회 누적** → 그 세션 동안 `WebSocketSttClient` 로 전환, `Utterance.realtimeEngine='reazon-gateway'` 로 기록, 사용자에게 한 줄 안내("서버 인식으로 전환했어요"). 다음 앱 기동 시 다시 온디바이스부터.
3. `recognitionMode=OFFLINE` 이면 전환하지 않고 텍스트 입력 폴백을 안내한다. `FAST` 는 온디바이스 고정(실패 시 텍스트 폴백), `ACCURATE` 는 gateway 우선.
4. `PERMISSION_DENIED` 는 폴백 카운트에 넣지 않고 즉시 권한 안내 화면으로.

## 8. APK 재설치 규칙 (deployer `<apk_release>`)

- 이 디렉토리(`plugins/**`), `android/**`, `capacitor.config.ts`, `AndroidManifest.xml`, AAR 버전이 바뀐 task 는 **네이티브 변경**이다. developer 는 착수 전에 Leader·deployer 에 "APK 재설치 필요"를 고지한다.
- deployer 는 `scripts/build-apk.sh`(우분투, JDK 21, gradle 출력은 로그 파일로만) 로 빌드 → `versionCode/versionName` 증가 확인 → `DATA_ROOT/releases/thekaiwa-<versionName>.apk` 배치 → `AppRelease` 행 추가(sha256·notes·minSupported) → 배포 기록에 `apk_version`·`apk_sha256`·`reinstall_required=true`.
- 앱은 `GET /api/app/version` `{latest, minSupported, url, notes}` 와 `App.getInfo().version`(bridge 경유) 을 비교해 배너("새 버전 v1.2 — 다운로드")를 띄운다. 웹만 바뀐 배포는 배너 없음. `minSupported` 미만이면 배너를 닫을 수 없다.

## 9. P0 실측 항목 (task-003, 결과 → `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md`)

| # | 항목 | 목표 | 방법 |
|---|---|---|---|
| ① | 5초 발화 디코드 시간 (`timings.decodeMs`) | ≤0.8s | S25+, `numThreads` 2/3/4, 고정 20문장 각 3회 중앙값 |
| ① | VAD endpoint 지연(발화 끝 → `final`) | ≤0.7s (`silenceMs=500` + 디코드) | 같은 세트 |
| ① | 앱 RSS(모델 로드 후·세션 중 피크) | ≤600MB | Android Studio Profiler 또는 `adb shell dumpsys meminfo` |
| ④ | 인식률 20문장 | 정답 ≥16(정규화 유사도 ≥0.9) | 온디바이스와 gateway 각각 |
| ⑤ | 모델 다운로드 | Wi-Fi 소요·재개 동작·sha256 불일치 시 폐기 | 다운로드 중 앱 강제 종료 후 재개 |
| — | 배터리·발열 | 10분 연속 회화 시 온도·배터리 소모 기록 | 참고 지표 |
| — | 플러그인 없는 APK / PC 브라우저 | 화면 정상 + gateway 폴백 동작 | `getSherpaStt()===null` 경로 |

## 10. 금기

- 모델·AAR 을 저장소에 커밋하지 않는다(AAR 은 Maven 좌표 우선, `libs/` 에 두더라도 `.gitignore`).
- 플러그인은 서버와 직접 통신하지 않는다(모델 다운로드 URL 제외). 발화 업로드·티켓·설정은 전부 웹 계층이 한다.
- 원본 오디오를 앱 외부 저장소(`Downloads` 등)에 쓰지 않는다. `wavPath` 는 `filesDir/utterances/` 뿐이며 업로드 뒤 정리한다.
- 엔진·모델 이름을 화면 문자열에 쓰지 않는다(`engine:'reazon-ondevice'` 는 `Utterance` 기록용 내부 값).
