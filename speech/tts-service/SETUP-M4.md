# 맥 M4 — kaiwa-tts 설치 준비 가이드 (사용자 실행용)

> 작성 2026-09-27 · 대상: 맥 mini M4(`192.168.219.100`) 에 앉아서(또는 SSH) **대화형 터미널**로 실행.
> 목적: task-003(TTS 서비스 구현) 착수 전에 **실행 디렉토리·Python 환경·Style-Bert-VITS2·기본 모델**을 준비하고, 1문장 합성이 되는지·얼마나 걸리는지 확인한다.
> 1~6단계는 2026-09-27 완료. 서비스 코드(`app.py`, task-003d)가 들어왔으므로 **§6-2 방화벽 → §7 기동·워치독** 순서로 이어 간다(둘 다 사용자 승인·sudo 필요).
> 설계 근거: [`README.md`](README.md)(배치·포트·env) · [`LICENSE-NOTICE.md`](LICENSE-NOTICE.md)(AGPL 경계) · `docs/design/speech-platform/16-tts-productization-layer.md`.

## 0. 먼저 알아 둘 것

- **실행 위치는 NFS 가 아니라 맥 로컬 디스크 `~/kaiwa-tts-run`** 이다. macOS 는 세션 없는 백그라운드 프로세스(cron 워치독)가 NFS 를 읽지 못한다(home-m4-api 가 3주 다운됐던 원인). 그래서 저장소를 로컬에 **따로 clone** 한다.
- 포트 **8200**(home-m4-api 는 8000). 지금 8200 은 비어 있다(2026-09-27 우분투에서 확인).
- Style-Bert-VITS2 는 **AGPL-3.0** 이라 이 서비스만 독립 프로세스로 돌고, 우분투 앱은 HTTP 로만 부른다.
- 디스크: torch·모델·BERT 합쳐 **약 8~10GB** 여유가 필요하다.
- 막히는 단계가 있으면 **그 단계 번호와 마지막 20줄 오류**를 알려 주면 된다.

## 1. 기본 도구 (이미 있으면 건너뜀)

```bash
xcode-select --install          # 이미 설치돼 있으면 "already installed" — 정상
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake git-lfs python@3.11
```

- **Python 은 3.11 을 쓴다.** 이 맥의 기본 python3 는 3.14(home-m4-api)인데, torch·pyopenjtalk 휠이 최신 버전을 늦게 따라온다. 3.11 은 Style-Bert-VITS2 가 가장 많이 검증된 버전이다.
- `cmake` 는 일본어 발음 처리(pyopenjtalk)가 휠이 없을 때 소스 빌드하는 데 필요하다.

## 2. 실행 디렉토리 = 저장소 로컬 clone

```bash
cd ~
git clone http://192.168.219.154:3000/brownjeon/project_TheKaiwa.git kaiwa-tts-run
cd ~/kaiwa-tts-run && git log --oneline -1          # 최신 커밋이 보이면 성공
mkdir -p ~/kaiwa-tts-run/model_assets ~/kaiwa-tts-local-logs
```

- Gitea 계정(`brownjeon`)과 토큰을 물으면 입력한다(맥에 자격 증명이 저장돼 있으면 묻지 않는다).
- `model_assets/`·`.venv/`·`.env` 는 git 이 추적하지 않아야 한다 — 3단계 끝의 `git status` 로 확인.

## 3. Python 가상환경 + Style-Bert-VITS2

```bash
cd ~/kaiwa-tts-run
/opt/homebrew/bin/python3.11 -m venv .venv
source .venv/bin/activate
python --version                                   # Python 3.11.x
pip install --upgrade pip wheel setuptools
pip install torch torchaudio                       # macOS arm64 기본 휠 = MPS 지원
pip install style-bert-vits2 "fastapi" "uvicorn[standard]" "pydantic>=2" huggingface_hub
pip install "setuptools<81" "numpy<2" "transformers<5"   # 2026-09-27 M4 실측으로 확정한 조합(아래 문제 해결 참고)
python -c "import pkg_resources, pyopenjtalk; print('ok')"
python -c "import torch; print('torch', torch.__version__, 'mps', torch.backends.mps.is_available())"
git status --short | head                          # .venv 가 목록에 보이면 알려 줄 것(.gitignore 보강 필요)
```

- `mps True` 가 나오면 GPU(MPS) 사용 가능.
- `pyopenjtalk` 빌드 오류가 나면 1단계 `cmake` 설치를 확인하고 `pip install style-bert-vits2` 를 다시 실행한다.
- **확정 조합(2026-09-27 M4 실측)**: Python 3.11.16 · style-bert-vits2 2.5.0 · torch 2.14.0 · transformers **4.57.6** · numpy **1.26.4** · setuptools **80.10.2**. 최신 버전을 그대로 받으면 아래 세 오류가 차례로 난다.
- 5단계에서 `ModuleNotFoundError: No module named 'pkg_resources'` 가 나면 위 `setuptools<81` 줄을 실행(그래도 나면 `setuptools<70`). `torch.jit.script`·`weight_norm` FutureWarning 은 무시해도 된다.
- `ValueError: numpy.dtype size changed … Expected 96 from C header, got 88 from PyObject` 가 나면 **pyopenjtalk-dict 바이너리는 numpy 1.x 로 빌드됐는데 설치된 numpy 는 2.x** 라는 뜻(2026-09-27 실측: numpy 2.4.6 + pyopenjtalk-dict 0.3.4.dev2). numpy 를 1.x 로 맞춘다:
  ```bash
  pip install "numpy<2"
  python -c "import numpy, pkg_resources, pyopenjtalk; print(numpy.__version__, 'ok')"
  ```
  (다른 패키지가 numpy>=2 를 요구해 충돌하면 대신 pyopenjtalk-dict 를 재빌드 — 최신 CMake 4 가 옛 설정을 거부하므로 `CMAKE_POLICY_VERSION_MINIMUM=3.5 pip install --force-reinstall --no-deps --no-build-isolation --no-cache-dir --no-binary pyopenjtalk-dict "pyopenjtalk-dict==0.3.4.dev2"`, 사전에 `pip install cython`.)

## 4. 기본 목소리 모델 + 일본어 BERT 받기

```bash
cd ~/kaiwa-tts-run && source .venv/bin/activate
python - <<'PY'
from huggingface_hub import snapshot_download
# 기본 모델: Style-Bert-VITS2 배포 JVNV 모델(여성 1). 모델 카드의 이용 약관을 확인한다.
snapshot_download(repo_id="litagin/style_bert_vits2_jvnv", allow_patterns=["jvnv-F1-jp/*"],
                  local_dir="model_assets")
# 화자 매핑(task-003d T2): Haruka=jvnv-F1-jp · Sakura=jvnv-F2-jp · Takumi=jvnv-M1-jp — 2026-09-27 Leader 가 받음
snapshot_download(repo_id="litagin/style_bert_vits2_jvnv", allow_patterns=["jvnv-F2-jp/*", "jvnv-M1-jp/*"],
                  local_dir="model_assets")
# JP-Extra 가 쓰는 일본어 BERT(첫 합성 때 자동으로도 받지만 미리 받아 둔다)
snapshot_download(repo_id="ku-nlp/deberta-v2-large-japanese-char-wwm")
print("ok")
PY
ls -la model_assets/jvnv-F1-jp/                     # config.json · *.safetensors · style_vectors.npy
```

- 파일이 `~/kaiwa-tts-run/model_assets/jvnv-F1-jp/` 아래에 있어야 한다. 다른 폴더에 풀렸으면 이 경로로 옮긴다.
- **일본어 BERT(약 2.6GB — 같은 모델이 safetensors·bin 두 형식으로 받아짐, 2026-09-27 실측)는 Hugging Face 공용 캐시**(`~/.cache/huggingface/hub/models--ku-nlp--deberta-v2-large-japanese-char-wwm/`)에 저장된다 — `model_assets` 로 옮기지 않는다(5단계가 같은 이름으로 캐시에서 찾는다). 로그인·토큰 불필요. 확인: `ls -lhL ~/.cache/huggingface/hub/models--ku-nlp--deberta-v2-large-japanese-char-wwm/snapshots/*/`(`-L` 없이 보면 `blobs/` 를 가리키는 심볼릭 링크라 52B·76B 로 보이는 게 정상)에 `config.json`·`vocab.txt`·1GB 넘는 `model.safetensors`/`pytorch_model.bin`.
- 끊기거나 느리면 같은 명령을 다시 실행(받은 부분은 건너뜀). `No module named huggingface_hub` 면 가상환경이 꺼진 것 — `source .venv/bin/activate` 후 재실행.
- 다른 화자(F2·M1·M2)는 task-003 에서 화자 매핑(Haruka/Sakura/Takumi)을 정할 때 추가로 받는다.

## 5. 1문장 합성 확인 (CPU·MPS)

```bash
cd ~/kaiwa-tts-run && git pull          # 확인 스크립트(speech/tts-service/scripts/check_synth.py) 받기
.venv/bin/python speech/tts-service/scripts/check_synth.py
afplay /tmp/kaiwa-tts-check.wav                     # 소리가 나면 성공
```

- 출력의 `BERT_DTYPE` 은 **`torch.float32`** 여야 한다. `float16` 이면 transformers 가 5.x 인 것 — `pip install "transformers<5"`.
- `RESULT cpu: …`·`RESULT mps: …` 두 줄. 목표는 **두 번째 합성 ≤1.0초**(설계 P0). 첫 실행 때 pyopenjtalk 가 일본어 사전(22.6MB)을 자동으로 받는다 — 정상.
- **실측(2026-09-27, Leader 가 SSH 로 실행)**: `cpu: first 0.78s, second 0.39s` · `mps: first 4.16s, second 0.21s`(sr 44100, 「こんにちは。今日はいい天気ですね。」 2.54초 음성, RMS 5538·유성 69%, 피크 32767 — 클리핑 여부는 task-003 품질 실측). MPS 첫 합성 4초는 워밍업 — 서비스 기동 시 워밍업 합성 1회로 흡수.
- (해결된 문제) MPS·CPU 모두 `RuntimeError: Input type (c10::Half) and bias type (float) should be the same` — 원인은 transformers 5.x 가 BERT 를 체크포인트 dtype(float16)으로 로드한 것. `transformers<5` 로 해결.

## 6. 비밀값·포트 준비 — ✅ 2026-09-27 완료(Leader 가 SSH 로 처리)

- `~/kaiwa-tts-run/.env`(권한 600)에 **`KAIWA_TTS_*` 7개 키만** 둔다: `KAIWA_TTS_INTERNAL_SECRET`(**TTS 전용 값** — 우분투 `TTS_SERVICE_SECRET` 과 같고 `SPEECH_INTERNAL_SECRET` 과는 다르다, 2026-09-27 Codex C1 S1 로 교체·해시 일치 확인) · `KAIWA_TTS_PORT=8200` · `KAIWA_TTS_MODEL_ASSETS` · `KAIWA_TTS_DEFAULT_MODEL=jvnv-F1-jp` · `KAIWA_TTS_DEVICE=mps` · `KAIWA_TTS_LOG_DIR` · `KAIWA_TTS_QUEUE_TIMEOUT_MS=8000`.
- ⚠ 앱의 `.env` 전체(DB·JWT·OAuth 시크릿)를 M4 에 복사하지 않는다 — TTS 서비스에 필요 없고 노출 면만 늘어난다(2026-09-27 전체 복사본을 발견해 7개 키로 교체).
- 다시 만들 때(우분투에서, 값 미출력):
  ```bash
  { grep '^TTS_SERVICE_SECRET=' ~/NFS/homes/brownjeon/project/TheKaiwa/.env | sed 's/^TTS_SERVICE_SECRET=/KAIWA_TTS_INTERNAL_SECRET=/'; printf '%s\n' KAIWA_TTS_PORT=8200 KAIWA_TTS_MODEL_ASSETS=/Users/brownjeon/kaiwa-tts-run/model_assets KAIWA_TTS_DEFAULT_MODEL=jvnv-F1-jp KAIWA_TTS_DEVICE=mps KAIWA_TTS_LOG_DIR=/Users/brownjeon/kaiwa-tts-local-logs KAIWA_TTS_QUEUE_TIMEOUT_MS=8000; } \
    | ssh brownjeon@192.168.219.100 'umask 077; cat > ~/kaiwa-tts-run/.env.new && mv -f ~/kaiwa-tts-run/.env.new ~/kaiwa-tts-run/.env'
  ```
- 포트 8200 비어 있음 확인(2026-09-27 21:26).

## 6-2. 방화벽(pf) — **8200 상시 기동 전 필수**(사용자 sudo, 2026-09-27 Codex C1 S2)

8200 은 `0.0.0.0` 에 바인드되므로 macOS pf 로 **우분투가 들어오는 주소와 localhost 에만** 연다. M4 가 보는 우분투 주소는 사설 IP 가 아니라 **`125.177.194.26`**(공유기 NAT hairpin — 2026-09-27 SSH `SSH_CLIENT` 와 서비스 로그 `client=` 로 실측). 이 값이 바뀌면(공유기·회선 교체) 서비스 로그 `unauthorized … client=` 로 다시 확인해 규칙을 고친다.

```bash
# 1) 규칙 파일(표준 com.apple 앵커 밑에 두므로 /etc/pf.conf 는 고치지 않는다)
sudo tee /etc/pf.anchors/kaiwa-tts >/dev/null <<'PF'
pass in quick on lo0 proto tcp from any to any port 8200
pass in quick proto tcp from 125.177.194.26 to any port 8200
block drop in quick proto tcp from any to any port 8200
PF
# 2) 올리기 + pf 켜기(이미 켜져 있으면 -E 는 참조 카운트만 올린다)
sudo pfctl -a com.apple/kaiwa-tts -f /etc/pf.anchors/kaiwa-tts
sudo pfctl -E
sudo pfctl -a com.apple/kaiwa-tts -s rules          # 세 줄이 보이면 적용됨
# 3) 확인: 우분투에서 curl -s -m 3 http://192.168.219.100:8200/health → 200,
#          같은 LAN 의 다른 기기(폰 등)에서 → 응답 없음(타임아웃)
```

**재부팅 지속**: 앵커 규칙은 재부팅 때 사라진다. 부팅 때 다시 올리려면 LaunchDaemon 을 둔다(`sudo` 필요, 붙여 넣을 때 들여쓰기 없이):

```bash
sudo tee /Library/LaunchDaemons/com.kaiwa.pf.plist >/dev/null <<'PL'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.kaiwa.pf</string>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>/sbin/pfctl -a com.apple/kaiwa-tts -f /etc/pf.anchors/kaiwa-tts; /sbin/pfctl -E</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict></plist>
PL
sudo launchctl bootstrap system /Library/LaunchDaemons/com.kaiwa.pf.plist
```

- 한계: NAT hairpin 을 거쳐 들어오는 **다른** 내부 기기도 같은 `125.177.194.26` 으로 보일 수 있다 — pf 는 1차 차단이고, 2차는 `X-Internal-Secret`(TTS 전용 값)·`/admin/*` loopback 전용·본문/문장 상한·큐 타임아웃이다.
- 해제: `sudo pfctl -a com.apple/kaiwa-tts -F rules`.

## 7. 기동·워치독·배포 (task-003d 코드 — **사용자 승인 후** 실행)

| 단계 | 내용 |
|---|---|
| 0. 방화벽 | §6-2 (필수 선행) |
| 1. 코드 반영 | 우분투에서 `speech/tts-service/scripts/deploy-from-ubuntu.sh origin/main` — SSH push → M4 `git merge --ff-only` → 핀 대조 → `restart.sh`(8200 기동·warmedUp 대기) → smoke. 실패하면 직전 SHA 로 롤백. 첫 기동도 이 명령 하나로 된다 |
| (수동 기동) | M4: `~/kaiwa-tts-run/speech/tts-service/scripts/restart.sh` (종료만 `--stop`) |
| 2. 워치독 | M4 `crontab -e` 에 `* * * * * ~/kaiwa-tts-run/speech/tts-service/scripts/kaiwa-tts-watchdog.sh >> ~/kaiwa-tts-local-logs/watchdog.log 2>&1` (일시 중지 `touch ~/kaiwa-tts-run/.watchdog-off`) |
| 3. 확인 | 우분투: `curl -s http://192.168.219.100:8200/health` → `status:"OK"`·`warmedUp:true`·`modelsLoaded:3`·`device:"mps"`, 시크릿 없이 `POST /synthesize` → 401, 원격 `POST /admin/models/refresh` → 404 |
| 4. 앱 연결 | 우분투 `.env` `TTS_SERVICE_URL=http://192.168.219.100:8200`·`TTS_SERVICE_SECRET` 확인 → 관리자 콘솔 `Speech › TTS` 에서 [상태 확인]·[기능 테스트] |

## 8. 끝나면 알려 줄 것

1. 3단계의 `torch … mps True/False` 줄과 `git status` 결과
2. 5단계 출력(`mps: first …s, second …s` / `cpu: …`)과 소리가 났는지
3. 6단계 마지막 두 줄(`1`, `8200 비어 있음`)
4. 막힌 단계가 있으면 번호와 오류 마지막 20줄
