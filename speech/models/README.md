# speech/models — 서빙 모델 manifest 규약 (파일 미커밋)

> 상태: **task-003e(2026-09-28) — `fetch_models.py`·`manifest.example.json`(실제 값) 추가.** gateway 가 이 모델로 동작 중(실측 `agent-vault/30-Knowledge/decisions/speech-p0-measurements.md` STT 절).
>
> **받기**: `python3 speech/models/fetch_models.py` → `speech/models/reazonspeech-int8/2024-08-01-int8-v1/` + `manifest.json`(표준 라이브러리만, 이어받기·sha256 불일치 시 폐기 후 3회 재시도). 서빙 위치로 바로: `--dest "$DATA_ROOT/models"`. 검사만: `--verify-only`. 출처는 **HuggingFace `reazon-research/reazonspeech-k2-v2` @`291488c8…`(= sherpa-onnx `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` 의 원본 파일, Apache-2.0)** 의 int8 encoder/joiner·fp32 decoder·tokens + k2-fsa 릴리스 `silero_vad.onnx` — k2-fsa tar.bz2 는 fp32 까지 713MB 라 파일 단위로 받는다. 실제 합계 **169.8MB**(encoder 154.7MB · decoder 11.8MB · joiner 2.7MB · tokens 46KB · vad 0.64MB). sha256 핀은 스크립트 `FILES` 상수.
> gateway 는 `SPEECH_MODELS_DIR`(ecosystem: `.env` 값 > `DATA_ROOT/models`(manifest 있으면) > 저장소 `speech/models`)의 `reazonspeech-int8/manifest.json` 을 읽고 파일별 크기·sha256 을 검증한 뒤 로드한다(≈1.0s). 온디바이스 서빙(`/models/*`, task-003f)은 `--dest "$DATA_ROOT/models"` 로 한 번 더 받는다.
>
> 여기에는 **README·manifest 예시·받기 스크립트만** 둔다. 모델 파일(수백 MB)은 저장소에 커밋하지 않고(`.gitignore`: `speech/models/**` 중 `README.md`·`*.example.json` 제외) 우분투 `DATA_ROOT/models/` 에 배치해 `/models/*` 로 서빙한다.

## 1. 용도

온디바이스 플러그인 `@thekaiwa/sherpa-stt` 가 첫 실행 시 모델을 내려받는 출처이자, gateway 가 같은 모델을 로드하는 출처다. APK 에 모델을 넣지 않으므로 **모델 갱신은 APK 재설치 없이** manifest 버전만 올리면 된다.

## 2. 서빙 경로

| 경로 | 내용 |
|---|---|
| `GET /models/reazonspeech-int8/manifest.json` | 현재 버전 manifest(아래 형식). `Cache-Control: no-cache`(버전 확인은 항상 최신) |
| `GET /models/reazonspeech-int8/<version>/<file>` | 모델 파일. `Cache-Control: public, max-age=31536000, immutable`(버전 디렉토리는 불변) |
| (gateway) `DATA_ROOT/models/reazonspeech-int8/<version>/` | 같은 파일을 로컬 경로로 로드 |

- 운영: nginx `location /models/ { alias /home/brownjeon/apps/thekaiwa/shared/data/models/; }` + Range 요청 허용(재개 다운로드). 인증 없음(공개 Apache-2.0 모델), 디렉토리 목록 비활성.
- 개발: `src/app/models/[...path]/route.ts` 가 `DATA_ROOT/models/` 를 스트리밍(Range 지원, `safeJoin` 경로 검증). 운영에서는 nginx 가 먼저 가로챈다.
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
  └── 2024-08-01-int8-v2/           # 갱신 시 새 디렉토리, 옛 버전은 한동안 유지(구 앱 재개 다운로드용)
  ```

## 3. manifest.json 형식

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
  "source": "https://github.com/k2-fsa/sherpa-onnx/releases (sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01)",
  "minPluginVersion": "0.1.0",
  "files": [
    { "path": "encoder-epoch-99-avg-1.int8.onnx", "sha256": "<64 hex>", "bytes": 155000000, "role": "encoder" },
    { "path": "decoder-epoch-99-avg-1.onnx",      "sha256": "<64 hex>", "bytes": 2100000,   "role": "decoder" },
    { "path": "joiner-epoch-99-avg-1.int8.onnx",  "sha256": "<64 hex>", "bytes": 260000,    "role": "joiner" },
    { "path": "tokens.txt",                        "sha256": "<64 hex>", "bytes": 60000,     "role": "tokens" },
    { "path": "silero_vad.onnx",                   "sha256": "<64 hex>", "bytes": 2300000,   "role": "vad" }
  ],
  "totalBytes": 159660000,
  "createdAt": "2026-10-01T00:00:00+09:00"
}
```

필수 키: `name, version, engine:'sherpa-onnx', model:'zipformer-ja-reazonspeech-2024-08-01-int8', files[{path, sha256, bytes}], totalBytes`. `role`·`minPluginVersion`·`license`·`source` 는 권장. `bytes` 값은 실제 릴리스 파일로 task-003 에서 채운다(위 숫자는 자리표시자 — encoder int8 ≈148MB 실측 기준 추정치).

검증 규칙(플러그인·gateway 공통):
1. `files[].path` 는 상대 경로 단일 파일명만(`/`·`..` 금지).
2. 다운로드 후 파일별 `sha256` 일치, 합계 `totalBytes` 일치. 불일치 파일은 삭제 후 재시도, 3회 실패 시 버전 전체 폐기.
3. `version` 은 디렉토리 이름과 같고 `^[A-Za-z0-9._-]{3,64}$`.
4. 플러그인은 `checkModel()` 이 돌려주는 설치 버전과 manifest `version` 이 다르면 새 버전을 **별도 디렉토리에 받은 뒤** 원자적 전환하고 옛 버전을 지운다(진행 중 세션이 있으면 다음 기동에).

## 4. Wi-Fi 다운로드 안내 (앱 UX 규칙)

- 총 ≈160MB. 첫 실행 또는 버전 갱신 시 앱은 **Wi-Fi 연결 여부**를 확인하고(플러그인 `downloadModel({wifiOnly:true})` 기본), 셀룰러면 "Wi-Fi 에서 받기 / 지금 받기(데이터 사용)" 선택을 띄운다.
- 진행률 이벤트 `downloadProgress {received, total, file}` 를 화면에 표시, 앱이 백그라운드로 가도 이어받기(HTTP Range, `.part` 파일).
- 다운로드 전에는 실시간 STT 가 gateway 폴백으로 동작한다(라우터: 모델 미설치 → `WebSocketSttClient`). 사용자는 다운로드 중에도 회화를 시작할 수 있다.
- 저장 위치 `filesDir/models/<version>/`(앱 전용 영역, 백업 제외 `android:allowBackup` 규칙과 함께 검토). 용량 부족(< 400MB 여유) 시 다운로드를 시작하지 않고 안내.

## 5. 버전 올리기 절차 (deployer)

1. sherpa-onnx 릴리스에서 모델 tar.bz2 를 받아 sha256 계산.
2. `DATA_ROOT/models/reazonspeech-int8/<newVersion>/` 에 배치, `manifest.new.json` 작성 → 검증 스크립트(`scripts/models-verify.sh`, task-003) 통과.
3. `manifest.new.json` → `manifest.json` 원자적 rename.
4. gateway 는 `POST /admin/models/refresh` 없이 **재기동**으로 새 모델 로드(RESTART_REQUIRED). `EngineConnection(reazon-ondevice).runtime.modelVersion` 을 콘솔에서 새 버전으로 Apply → 앱은 다음 기동 시 `GET /api/v1/speech/config` 로 알아채고 다운로드.
5. 옛 버전 디렉토리는 2주 뒤 삭제.

## 6. 파일

- `manifest.example.json` — 실제 받은 버전의 manifest(커밋 대상, `createdAt` 만 받을 때마다 다름).
- `fetch_models.py` — 받기·검증 스크립트(커밋 대상).
- 그 외 모든 파일은 `.gitignore` 대상.
