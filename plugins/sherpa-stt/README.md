# @thekaiwa/sherpa-stt — 온디바이스 실시간 STT Capacitor 플러그인 (골격)

> 상태: **구현 v0.1.0 (task-003f, 2026-09-28)** — Kotlin 플러그인·JVM 단위 테스트 51개·데스크톱 점검(stt20 20/20)·`assembleRelease` 까지. 실기기(S25+) 실측은 F6. Capacitor 7 · Kotlin 2.1 · sherpa-onnx **1.13.8**. 경계 규칙 정본: [`docs/design/module-dependency.md`](../../docs/design/module-dependency.md) §6. 모델 규약: [`speech/models/README.md`](../../speech/models/README.md). **JS 계약 정본: agent-vault `task-003f` 이력서 "플러그인 JS 계약 v1·v1.1"** — 아래 §4 는 그 요약이고 `src/definitions.ts` 가 같은 내용의 타입이다.

## 1. 목적

안드로이드 기본 STT 를 쓰지 않고(사용자 지시), **휴대폰 CPU·메모리로** silero VAD + ReazonSpeech(zipformer transducer int8, sherpa-onnx) 를 돌려 발화를 실시간 인식한다. 서버 gateway 와 같은 모델·같은 이벤트 형태라 클라이언트 `RealtimeSttClient` 인터페이스 뒤에서 서로 바뀐다. 실시간의 실체는 "VAD 세그먼트 → 오프라인 디코드"(스트리밍 JA 모델 없음)이며 5초 발화 디코드 ≈0.3s 라 체감은 실시간이다.

## 2. 레이아웃 (Capacitor 7 플러그인)

```
plugins/sherpa-stt/
├── package.json                 # @thekaiwa/sherpa-stt 0.1.0, "capacitor": { "android": { "src": "android" } } — 루트가 file:plugins/sherpa-stt 로 의존
├── src/{definitions,index,web}.ts   # 계약 타입·registerPlugin·브라우저 stub(전부 reject). 웹 번들은 import 하지 않는다(bridge.ts 가 손으로 옮겨 적음)
├── android/
│   ├── build.gradle             # AAR sha256 확인 → classes.jar·jni/arm64-v8a/*.so 로 풀어 의존(§3) · minSdk 26 · Kotlin/JVM 21
│   ├── consumer-rules.pro       # JNI 가 이름으로 찾는 sherpa 클래스 keep(앱 minify 를 켤 날 대비)
│   └── src/
│       ├── main/AndroidManifest.xml     # RECORD_AUDIO · INTERNET · ACCESS_NETWORK_STATE
│       ├── main/java/com/miraclepenguin/kaiwa/sherpastt/
│       │   ├── SherpaSttPlugin.kt   # @CapacitorPlugin(name="SherpaStt", permissions=[recordAudio]) — 메서드·이벤트·생명주기·스레드
│       │   ├── SttSession.kt        # 발화 상태기계(순수 — VAD 구간·여유·0 패딩·manual/auto·final 1회·순서 보장)
│       │   ├── Audio.kt             # 16k PCM 계산·패딩 상수(gateway 와 같은 값)·레벨 미터·발화 버퍼
│       │   ├── AudioCapture.kt      # AudioRecord 16kHz mono PCM16 40ms, 전용 스레드(URGENT_AUDIO), 해제는 캡처 스레드가
│       │   ├── Recognizer.kt        # OfflineRecognizer 캐시(버전·스레드·디코딩 방식 키)·워밍업 · SherpaVadEngine(silero)
│       │   ├── Manifest.kt          # manifest 엄격 검증·버전 자연 정렬·같은 origin 정책·Range 이어받기 판정(순수)
│       │   ├── ModelStore.kt        # filesDir/models/stt/<version>/ + installed.json, 원자적 commit·검증·정리
│       │   ├── ModelDownloader.kt   # manifest→파일별 Range(.part)→sha256→commit, 리다이렉트 수동(같은 origin), 취소·Wi-Fi 재확인
│       │   ├── WavWriter.kt · Opts.kt
│       └── test/java/…/sherpastt/   # JVM 단위 테스트(가짜 VAD·디코더·HTTP) — scripts/build-apk.sh --test
├── tools/desktop-check/         # 데스크톱 sherpa-onnx(JVM)로 SttSession 을 실제 모델·stt20 에 돌리는 점검(run.sh)
├── README.md
└── CHANGELOG.md
```

- 앱 `capacitor.config.ts` 에 별도 등록은 필요 없다(`cap sync` 가 `@CapacitorPlugin` 을 찾아 `capacitor.plugins.json` 에 넣는다 — `scripts/build-apk.sh` 가 들어갔는지 확인).
- 웹 번들 규칙: `src/modules/infra/native/bridge.ts` 만 `window.Capacitor.Plugins.SherpaStt` 를 읽는다. 앱 코드는 `@thekaiwa/sherpa-stt`·`@capacitor/*` 를 import 하지 않는다(ESLint `no-restricted-imports`). 플러그인이 빠진 APK·PC 브라우저에서도 화면이 죽지 않아야 한다.
- 모델·오디오 경로(`filesDir/models/stt`, `filesDir/utterances`)와 JS 로 가는 값에는 엔진·모델 이름을 쓰지 않는다(task-003e M2 원칙).

## 3. sherpa-onnx AAR 버전 고정

| 항목 | 값 |
|---|---|
| 버전 | **1.13.8** — gateway `speech/gateway/requirements.txt` 의 `sherpa-onnx==1.13.8` 과 같다(같은 모델·같은 결과) |
| 출처 | GitHub 릴리스 `https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar` (50,129,134 B) |
| sha256 | `633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96` (릴리스 digest 와 일치, `android/build.gradle`·`scripts/build-apk.sh` 에 고정) |
| 내용 | `classes.jar`(Kotlin API `com.k2fsa.sherpa.onnx.*`, Kotlin 메타데이터 1.7·Java 8 바이트코드) + `jni/<abi>/{libonnxruntime,libsherpa-onnx-jni,…}.so`, 리소스·권한·proguard 규칙 없음, minSdk 21 |
| 쓰는 방식 | AGP 8 은 라이브러리 모듈의 로컬 AAR 파일 의존을 lint/번들 단계에서 거부한다 → 빌드 때 AAR 을 풀어 `classes.jar`(파일 JAR 의존)와 `jni/arm64-v8a/*.so`(jniLibs)로 쓴다. 저장소에는 넣지 않는다(`.gitignore *.aar`) |
| ABI | `arm64-v8a` 만(S25+). APK 35.2MB(그중 libonnxruntime 22MB) |
| 모델 manifest `minPluginVersion` | `0.1.0` |
| 실측 기기·디코드 시간 | F6(사용자 폰) 뒤 기록. 데스크톱(x86, 2스레드) 5초 발화 디코드 ≈70ms |

JitPack(`com.github.k2-fsa.sherpa-onnx:sherpa-onnx`)도 있으나 소스에서 따로 빌드한 산출물이라 GitHub 공식 릴리스 파일 + sha256 핀을 택했다. 버전 변경 = 네이티브 변경(APK 재설치·versionCode 증가).
- 모델은 AAR 에도 APK 에도 넣지 않는다(§5).

## 4. API (계약 v1.1 요약 — 정본은 task-003f 이력서)

### 메서드

| 메서드 | 결과 · 설명 |
|---|---|
| `checkPermissions()` / `requestPermissions()` | `{ recordAudio }` — `start` 는 권한을 묻지 않고 `PERMISSION_DENIED` 로 거절 |
| `checkModel({verify?})` | `{ installed, version?, bytes?, downloading, freeBytes, pendingVersion?, pendingBytes? }` |
| `downloadModel({manifestUrl, wifiOnly=true, expectedVersion?, allowDowngrade=false})` | `{ version, bytes, alreadyInstalled }` — 같은 origin https `/models/<id>/manifest.json` 만, 파일은 `<manifest 디렉터리>/<version>/<path>`(manifest 의 `url`·`baseUrl` 은 쓰지 않음) |
| `cancelDownload()` · `deleteModel()` | 받은 조각은 남김 · 설치본 전부 삭제(세션·다운로드 중이면 `BUSY`) |
| `preload({numThreads?, decodingMethod?})` | `{ modelVersion, loadMs }` |
| `start({vad?, partial?, endpoint?, numThreads?, decodingMethod?, maxUtteranceSec?, saveWav?, audioSource?})` | `{ sessionId, modelVersion }` — 마이크를 연 즉시 resolve(인식기는 뒤에서 올림) |
| `stop()` | `{ sessionId?, utterance?: FinalPayload }` — 마지막 `final` 뒤 resolve |
| `cancel()` · `release()` · `deleteWav({wavPath})` · `getDiagnostics()` · `openAppSettings()` | 발화 폐기 · 인식기 해제 · 업로드한 wav 삭제 · 진단 값 · 앱 정보 화면 |

### 이벤트

| 이벤트 | payload |
|---|---|
| `vad` | `{ sessionId, state: 'SPEECH'\|'SILENCE', atMs }` (gateway 와 같은 대문자) |
| `level` | `{ sessionId, db }` — 웹 `LevelMeter` 와 같은 dBFS·100ms |
| `partial` | `{ sessionId, segIdx, text, startMs, endMs }` |
| `final` | `{ sessionId, text, durationMs, wavPath\|null, segments, timings:{vadMs,decodeMs,loadMs,sttMs}, reason, modelVersion }` — 엔진명 없음 |
| `error` | `{ sessionId\|null, code, message }` — 세션 중 비동기 오류만(메서드 실패는 reject) |
| `downloadProgress` | `{ version, fileIndex, fileCount, received, total, totalReceived, totalBytes }` — 파일 이름 없음 |

정본 초안(이 절의 옛 표)과 달라진 점: `final.engine`·`checkModel().path`·`downloadProgress.file` 제거(엔진·파일명 비노출), `start.modelVersion` 제거(설치된 버전만), `vad.state` 대문자, `level`·`cancel`·`preload`·`cancelDownload`·`deleteModel`·`deleteWav`·`getDiagnostics`·`openAppSettings`·`endpoint`·`audioSource`·`reason`·`sttMs`·`freeBytes` 추가, 오류 코드 확장(계약 표).

## 5. 모델 다운로드·검증·저장 (task-003f C1-3 반영)

- 출처: `GET https://kaiwa.<도메인>/models/<불투명 id>/manifest.json`(URL 은 `GET /api/v1/speech/config` 의 `onDevice.model.manifestUrl`, 앱 상수 아님). **앱 `server.url` 과 같은 origin 의 https** 가 아니면 `ORIGIN_NOT_ALLOWED`, 경로는 `/models/<id>/manifest.json` 형식만, 리다이렉트는 같은 origin 으로만 3번.
- manifest 검증(`Manifest.kt`): 64KB 이하 JSON 객체, `name`·`version`(첫 글자 영숫자 3~64자) 패턴, `engine=sherpa-onnx`·`modelType=transducer`·`sampleRate=16000`, 파일 5~16개·역할 encoder/decoder/joiner/tokens/vad 각 1개, 파일명 단일 이름(`/`·`..`·`installed.json`·`.part` 금지), sha256 64 hex, bytes 정수·합계 = `totalBytes` ≤ 300MiB, `minPluginVersion` > 플러그인이면 `APP_UPDATE_REQUIRED`. 서명은 두지 않는다(Leader C1-3 판정).
- 저장: `filesDir/models/stt/<version>/` + `installed.json`(검증을 통과한 manifest 사본 — 읽을 때 같은 검증을 다시 거침). 받는 중에는 `filesDir/models/stt/.tmp-<version>/<file>.part`. 여유 < `totalBytes × 2.5` 면 `INSUFFICIENT_STORAGE`. 앱 데이터는 백업·기기 이전에서 제외(`dataExtractionRules`).
- 이어받기: 파일마다 `Range: bytes=<가진 크기>-` → 206 의 `Content-Range` 시작·끝·전체를 확인해 이어 쓰고, 200 이면 처음부터, 416 이면 다 받은 것으로 본다. 끊김·404·5xx 는 조각을 남긴 채 1s·2s 뒤 재시도, 끝내 안 되면 조각을 남기고 `DOWNLOAD_FAILED`(다음 호출이 이어받음). 과금 네트워크로 바뀌면(wifiOnly) 파일 경계·8MB 마다 확인해 `NETWORK_NOT_ALLOWED` 로 멈춘다.
- 검증 실패: 받은 뒤 파일 전체 sha256. 틀린 파일은 지우고 다시 받고, **같은 파일이 3번 모두 내용이 틀리면**(sha256·크기·Range 응답) 그 버전 임시 디렉터리를 통째로 버린다.
- 전환: 전부 맞으면 인덱스를 쓰고 `.tmp-<version>` → `<version>` rename(같은 파일시스템, 원자적), 그 뒤 다른 버전·임시 디렉터리를 지운다. 같은 버전을 다시 받으면 `alreadyInstalled`, **낮은 버전은 `DOWNGRADE_REFUSED`**(`allowDowngrade:true` 로 명시할 때만). 인식기는 다음 `start`/`preload` 가 버전이 바뀐 것을 보고 다시 올린다.
- 갱신: `checkModel().version ≠ #19 onDevice.model.version` 이면 앱이 `downloadModel` 을 다시 부른다. **APK 재설치 없이** 모델이 바뀐다. 크기 169.8MB.

## 6. 런타임 설정은 서버가 준다

앱(웹 계층 `speech/stt/client/onDeviceModel.ts`)은 `GET /api/v1/speech/config`(#19, `platform=app`)의 `onDevice` 블록을 읽어 모델 받기와 `start()` 옵션에 쓴다. 엔진·모델 이름은 들어 있지 않다:

```json
{ "recognitionMode": "AUTO",
  "onDevice": { "enabled": true, "available": true, "connectionKey": "<불투명 connection id>",
                "runtime": { "numThreads": 2, "decodingMethod": "greedy_search", "provider": "cpu",
                             "vad": { "silenceMs": 500, "threshold": 0.5 }, "partial": true },
                "model": { "id": "ondevice-ja-v1", "version": "2024-08-01-int8-v1",
                           "manifestUrl": "/models/ondevice-ja-v1/manifest.json", "totalBytes": 169824553, "wifiRecommended": true } },
  "fallback": { "onDeviceFailureThreshold": 2, "toGateway": true, "toTextOnly": true } }
```

- `model.manifestUrl` 은 **불투명 경로**(`/models/<id>/manifest.json`)다 — 앱이 `window.location.origin` 을 붙여 절대 https URL 로 `downloadModel` 에 넘기고, 플러그인은 `server.url` 과 같은 origin 인지 다시 본다(§5). 실제 디스크 디렉터리(모델 이름)는 서버 ONDEVICE connection 설정에만 있다.
- `model.version` 은 **지금 서빙 중인 manifest 의 version** 이다. 새 모델판은 서버 `DATA_ROOT/models/<connection 디렉터리>/` 에 새 `<version>/` 과 `manifest.json` 을 원자적으로 바꿔 놓으면(speech/models/README §5) 그대로 반영된다 — 콘솔에서 따로 Apply 하지 않는다. 앱은 `checkModel().version ≠ model.version` 이면 "새 버전 받기"를 보인다. 서버는 **현재 버전의 파일만** 내보내므로 옛 버전 조각은 이어받을 수 없다(플러그인은 다음 `downloadModel` 에서 새 manifest 로 다시 시작하고 다른 버전 조각을 버린다).
- `runtime`(스레드 수·디코딩 방식·VAD)은 ONDEVICE connection 의 runtime(설정 해석 6순위)이며 콘솔에서 바꾸면 다음 설정 조회(ETag)부터 반영된다. `numThreads` 는 2~4 사이에서 F6 실측으로 정한다. 시크릿은 없다.
- 서버 manifest 검증(`parseManifest`)과 플러그인 `ManifestValidator` 는 공용 픽스처 `test-fixtures/manifest-cases.json` 으로 같은 판정을 확인한다(REV-021) — 서버가 내보낸 manifest 를 앱이 거절하면 모든 앱의 받기가 조용히 실패하기 때문이다.

## 7. 폴백 규칙 (웹 라우터 `speech/stt/client/router.ts` — 정본 speech-platform/12 §3.5·docs/screens.md §11)

1. 경로는 **누를 때마다**(녹음 중이 아닐 때) 고른다: 플러그인이 없거나(`getSherpaStt()===null`) 모델이 없거나(`checkModel().installed=false`) 방식이 서버 쪽이면 gateway(`WebSocketSttClient`).
2. 휴대폰 인식의 셀 수 있는 실패(`start()` 거부·세션 `error`)가 **앱 실행 동안 `onDeviceFailureThreshold`(2)회**면 그 실행 동안 서버로 바꾸고 한 번 알린다. 다음 앱 실행에서 다시 휴대폰부터.
3. 세지 않는 코드: `PERMISSION_DENIED`(권한 안내로)·`INTERRUPTED`·`ALREADY_STARTED`·`INVALID_ARGUMENT`·`UNAVAILABLE`. `MODEL_MISSING` 은 세지 않고 바로 서버.
4. `recognitionMode=OFFLINE` 이면 서버로 바꾸지 않고 글자 입력을 권한다. `Utterance.realtimeEngine` 은 서버가 connection 으로 기록한다(클라이언트는 엔진명을 모른다).

## 8. APK 재설치 규칙 (deployer `<apk_release>`)

- 이 디렉토리(`plugins/**`), `android/**`, `capacitor.config.ts`, `AndroidManifest.xml`, AAR 버전이 바뀐 task 는 **네이티브 변경**이다. developer 는 착수 전에 Leader·deployer 에 "APK 재설치 필요"를 고지한다.
- deployer 는 `bash scripts/build-apk.sh --test --publish`(우분투, JDK 21, APK 전용 작업 디렉터리 `~/.node-local/thekaiwa-apk`, gradle 출력은 로그 파일로만)로 **release** 를 빌드한다 — 스크립트가 `aapt2` 로 debuggable 없음·versionCode/versionName·ABI, `apksigner` 로 서명 인증서(SHA-256 `a4c23dca…9e47`, `~/.android/debug.keystore`)를 확인하고 `DATA_ROOT/releases/thekaiwa-<versionName>.apk` 로 복사한 뒤 AppRelease 값(`apkPath` 는 파일 이름만)을 출력한다 → deployer 가 `AppRelease` 행 추가(sha256·notes·minSupported) → 배포 기록에 `apk_version`·`apk_sha256`·`reinstall_required=true`. 개발용 debug 빌드는 배포 경로에 올리지 않는다(task-003f C1-2).
- 앱은 `GET /api/app/version`(`X-App-Build` = versionCode) 의 `latestCode`·`minSupportedCode` 와 비교해 띠를 띄운다(docs/screens.md §11-2 G). 웹만 바뀐 배포는 띠 없음. `minSupportedCode` 미만이면 닫을 수 없다.

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

- 모델·AAR 을 저장소에 커밋하지 않는다(AAR 은 GitHub 릴리스 파일을 sha256 고정으로 빌드 때 받는다, `.gitignore *.aar`).
- 플러그인은 서버와 직접 통신하지 않는다(모델 다운로드 URL 제외). 발화 업로드·티켓·설정은 전부 웹 계층이 한다.
- 원본 오디오를 앱 외부 저장소(`Downloads` 등)에 쓰지 않는다. `wavPath` 는 `filesDir/utterances/` 뿐이며 업로드 뒤 정리한다.
- 엔진·모델 이름을 화면 문자열에도, 플러그인이 JS 로 돌려주는 값에도 쓰지 않는다(경로는 `filesDir/models/stt`, 이벤트에 engine 필드 없음).
