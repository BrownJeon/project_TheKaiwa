# speech/models — 서빙 모델 manifest 규약 (파일 미커밋)

> 상태: **task-003e(2026-09-28) — `fetch_models.py`·`manifest.example.json`(실제 값) 추가. task-003f — 공개 경로 `/models/ondevice-ja-v1/*`·서버/플러그인 공통 검증 규칙·`scripts/models-verify.sh`.** gateway 가 이 모델로 동작 중(실측 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md` STT 절).
>
> **받기**: `python3 speech/models/fetch_models.py` → `speech/models/reazonspeech-int8/2024-08-01-int8-v1/` + `manifest.json`(표준 라이브러리만, 이어받기·sha256 불일치 시 폐기 후 3회 재시도). 서빙 위치로 바로: `--dest "$DATA_ROOT/models"`. 검사만: `--verify-only`. 출처는 **HuggingFace `reazon-research/reazonspeech-k2-v2` @`291488c8…`(= sherpa-onnx `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` 의 원본 파일, Apache-2.0)** 의 int8 encoder/joiner·fp32 decoder·tokens + k2-fsa 릴리스 `silero_vad.onnx` — k2-fsa tar.bz2 는 fp32 까지 713MB 라 파일 단위로 받는다. 실제 합계 **169.8MB**(encoder 154.7MB · decoder 11.8MB · joiner 2.7MB · tokens 46KB · vad 0.64MB). sha256 핀은 스크립트 `FILES` 상수.
> gateway 는 `SPEECH_MODELS_DIR`(ecosystem: `.env` 값 > `DATA_ROOT/models`(manifest 있으면) > 저장소 `speech/models`)의 `reazonspeech-int8/manifest.json` 을 읽고 파일별 크기·sha256 을 검증한 뒤 로드한다(≈1.0s). 온디바이스 서빙(`/models/ondevice-ja-v1/*`, task-003f)은 **`DATA_ROOT/models` 만** 본다(`SPEECH_MODELS_DIR` 절대 경로가 있으면 그것) — 저장소 사본을 복사해 두면 재다운로드가 필요 없다: `mkdir -p "$DATA_ROOT/models" && cp -a speech/models/reazonspeech-int8 "$DATA_ROOT/models/" && bash scripts/models-verify.sh "$DATA_ROOT/models"`.
>
> 여기에는 **README·manifest 예시·받기 스크립트만** 둔다. 모델 파일(수백 MB)은 저장소에 커밋하지 않고(`.gitignore`: `speech/models/**` 중 `README.md`·`*.example.json` 제외) 우분투 `DATA_ROOT/models/` 에 배치해 `/models/*` 로 서빙한다.

## 1. 용도

온디바이스 플러그인 `@thekaiwa/sherpa-stt` 가 첫 실행 시 모델을 내려받는 출처이자, gateway 가 같은 모델을 로드하는 출처다. APK 에 모델을 넣지 않으므로 **모델 갱신은 APK 재설치 없이** manifest 버전만 올리면 된다.

## 2. 서빙 경로 (task-003f — 공개 경로는 불투명 id)

| 경로 | 내용 |
|---|---|
| `GET /models/ondevice-ja-v1/manifest.json` | 현재 버전 manifest — 디스크 manifest 를 검증(§3)한 뒤 파일마다 같은 origin 절대 URL(`url`)·`id`·`baseUrl` 을 붙여 내보낸다. `Cache-Control: no-cache` + ETag |
| `GET /models/ondevice-ja-v1/<version>/<file>` | 모델 파일. 현재 manifest 에 적힌 파일만, Range(이어받기)·ETag(=sha256)·`Cache-Control: public, max-age=31536000, immutable` |
| (gateway) `DATA_ROOT/models/reazonspeech-int8/<version>/` | 같은 파일을 로컬 경로로 로드 |

- `ondevice-ja-v1` 은 **불투명 패키지 id** 다 — #19 사용자 응답(`onDevice.model.manifestUrl`)에 엔진·모델 이름이 실리지 않게(task-003f 완료 기준 8). 디스크 디렉터리(`reazonspeech-int8`)는 ONDEVICE connection 설정 `connection.manifestUrl`(`/models/<dir>/manifest.json`)에서 서버가 읽는다. 실제 모델 이름은 manifest 본문에만 있다. 정본: `docs/design/api-contract.md` #9·#10.
- 운영·개발 모두 Next.js 앱 라우트(`src/app/models/[...path]/route.ts`)가 서빙한다. nginx `location /models/` 는 앱으로 **프록시만** 한다(www-data 는 `/home/brownjeon`(750) 을 지나지 못해 `alias` 불가 — `/app/download/` 와 같은 이유). 인증 없음(공개 Apache-2.0 모델), 디렉토리 목록 없음, 동시 스트림 4(넘으면 503 Retry-After).
- 디스크 레이아웃:
  ```
  DATA_ROOT/models/reazonspeech-int8/
  ├── manifest.json                 # → 현재 버전을 가리킴(교체는 원자적 rename)
  ├── 2024-08-01-int8-v1/           # version 디렉토리(불변)
  │   ├── encoder-epoch-99-avg-1.int8.onnx
  │   ├── decoder-epoch-99-avg-1.onnx
  │   ├── joiner-epoch-99-avg-1.int8.onnx
  │   ├── tokens.txt
  │   └── silero_vad.onnx
  └── 2024-08-01-int8-v2/           # 갱신 시 새 디렉토리 — 서버는 현재 manifest 버전 파일만 서빙한다(옛 버전은 gateway 롤백용으로 2주 보관)
  ```

## 3. manifest.json 형식 · 검증 규칙

```json
{
  "name": "reazonspeech-int8",
  "version": "2024-08-01-int8-v1",
  "engine": "sherpa-onnx",
  "model": "zipformer-ja-reazonspeech-2024-08-01-int8",
  "modelType": "transducer",
  "sampleRate": 16000,
  "language": "ja",
  "license": "Apache-2.0",
  "source": "https://huggingface.co/reazon-research/reazonspeech-k2-v2@… + …/silero_vad.onnx",
  "minPluginVersion": "0.1.0",
  "files": [
    { "path": "encoder-epoch-99-avg-1.int8.onnx", "sha256": "<64 hex>", "bytes": 154670139, "role": "encoder" },
    { "path": "decoder-epoch-99-avg-1.onnx",      "sha256": "<64 hex>", "bytes": 11767836,  "role": "decoder" },
    { "path": "joiner-epoch-99-avg-1.int8.onnx",  "sha256": "<64 hex>", "bytes": 2696970,   "role": "joiner" },
    { "path": "tokens.txt",                        "sha256": "<64 hex>", "bytes": 45754,     "role": "tokens" },
    { "path": "silero_vad.onnx",                   "sha256": "<64 hex>", "bytes": 643854,    "role": "vad" }
  ],
  "totalBytes": 169824553,
  "createdAt": "2026-09-28T00:01:25+0900"
}
```

**검증 규칙(서버 #9 = 플러그인 = 배포 전 CLI, task-003f REV-021)** — 정본은 플러그인 `ManifestValidator`(`plugins/sherpa-stt/android/.../Manifest.kt`)이고, 서버 `src/modules/speech/stt/manifestRules.ts` 가 그대로 옮겼다. 두 구현은 공용 픽스처 `plugins/sherpa-stt/test-fixtures/manifest-cases.json`(사례마다 플러그인 판정)으로 대조한다 — 서버가 "유효"로 내보내는 manifest 를 앱이 거부하면 모든 앱이 조용히 받기에 실패하기 때문이다. 규칙을 바꾸면 세 곳(Kotlin·TS·픽스처)을 함께 고친다.
1. 원문 ≤64KiB, JSON 객체(중복 키 불가).
2. `name` `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`·`..` 없음, `version` `^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$`·`..` 없음(= 디렉토리 이름).
3. **`engine`="sherpa-onnx"·`modelType`="transducer"·`sampleRate`=16000(정수)** — 다르면 거부.
4. `files` 5~16개, 역할 **encoder·decoder·joiner·tokens·vad 가 정확히 한 번씩**. `path` 는 단일 파일명(`/`·`..`·점 시작·`installed.json`·`.part` 불가)·중복 없음, `sha256` 소문자 64 hex, `bytes` 정수 1~300MiB.
5. 파일 합계 ≤300MiB = `totalBytes`(정수). 정수 칸에 소수·지수 표기(`16000.0`) 불가.
6. `minPluginVersion` 은 없거나 `x.y.z` — 플러그인 버전이 낮으면 앱이 `APP_UPDATE_REQUIRED`(서버는 내보낸다).
7. 다운로드 후 파일별 `sha256`·크기 일치(플러그인), 불일치 파일은 버리고 재시도. 설치 버전보다 낮은 manifest 는 거부(다운그레이드 금지).

## 4. Wi-Fi 다운로드 안내 (앱 UX 규칙)

- 총 ≈160MB. 첫 실행 또는 버전 갱신 시 앱은 **Wi-Fi 연결 여부**를 확인하고(플러그인 `downloadModel({wifiOnly:true})` 기본), 셀룰러면 "Wi-Fi 에서 받기 / 지금 받기(데이터 사용)" 선택을 띄운다.
- 진행률 이벤트 `downloadProgress {received, total, file}` 를 화면에 표시, 앱이 백그라운드로 가도 이어받기(HTTP Range, `.part` 파일).
- 다운로드 전에는 실시간 STT 가 gateway 폴백으로 동작한다(라우터: 모델 미설치 → `WebSocketSttClient`). 사용자는 다운로드 중에도 회화를 시작할 수 있다.
- 저장 위치 `filesDir/models/<version>/`(앱 전용 영역, 백업 제외 `android:allowBackup` 규칙과 함께 검토). 용량 부족(< 400MB 여유) 시 다운로드를 시작하지 않고 안내.

## 5. 버전 올리기 절차 (deployer)

1. 새 파일을 받아 sha256 계산(`fetch_models.py` 의 `FILES` 핀·`VERSION` 을 새 값으로 고쳐 `--dest "$DATA_ROOT/models"` 로 받으면 1·2 가 한 번에 된다).
2. `DATA_ROOT/models/reazonspeech-int8/<newVersion>/` 에 배치하고 `manifest.new.json` 을 쓴다.
3. **게이트**: `bash scripts/models-verify.sh "$DATA_ROOT/models" --manifest "$DATA_ROOT/models/reazonspeech-int8/manifest.new.json"` — 서버·플러그인과 같은 규칙 + 새 버전 디렉토리 파일의 크기·sha256. **FAIL 이면 올리지 않는다**(서버는 그런 manifest 를 내보내지 않고, 앱도 거부한다).
4. `manifest.new.json` → `manifest.json` 원자적 rename → `bash scripts/models-verify.sh "$DATA_ROOT/models"` 로 한 번 더 확인.
5. 앱은 다음 설정 조회(#19 — `onDevice.model.version` 이 서빙 manifest 의 version 을 따른다)에서 새 버전을 알아채고, 설정 카드에 [새 버전 받기]가 뜬다(자동 다운로드 없음). **콘솔 Apply 는 필요 없다** — ONDEVICE connection 의 `runtime.modelVersion` 은 앱에 쓰이지 않는다(task-003f).
6. gateway 는 **재기동**으로 새 모델을 로드한다(RESTART_REQUIRED — gateway connection `runtime.modelVersion` 은 gateway 쪽 값).
7. 옛 버전 디렉토리는 2주 뒤 삭제.

## 6. 파일

- `manifest.example.json` — 실제 받은 버전의 manifest(커밋 대상, `createdAt` 만 받을 때마다 다름).
- `fetch_models.py` — 받기·검증 스크립트(커밋 대상).
- 배포 전 게이트는 `scripts/models-verify.sh`(저장소 루트 — 서버 규칙 모듈을 그대로 쓴다).
- 그 외 모든 파일은 `.gitignore` 대상.
