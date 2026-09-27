# 맥 M4 — kaiwa-tts 설치 준비 가이드 (사용자 실행용)

> 작성 2026-09-27 · 대상: 맥 mini M4(`192.168.219.100`) 에 앉아서(또는 SSH) **대화형 터미널**로 실행.
> 목적: task-003(TTS 서비스 구현) 착수 전에 **실행 디렉토리·Python 환경·Style-Bert-VITS2·기본 모델**을 준비하고, 1문장 합성이 되는지·얼마나 걸리는지 확인한다.
> 서비스 코드(`app.py` — 자체 FastAPI 래퍼)는 아직 없다. 이 가이드의 6단계까지 하면 task-003 에서 코드만 올리면 된다.
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
pip install "setuptools<81"                         # pyopenjtalk 가 pkg_resources 를 쓴다 — 최신 setuptools 에는 없음(2026-09-27 실측 오류)
python -c "import pkg_resources, pyopenjtalk; print('ok')"
python -c "import torch; print('torch', torch.__version__, 'mps', torch.backends.mps.is_available())"
git status --short | head                          # .venv 가 목록에 보이면 알려 줄 것(.gitignore 보강 필요)
```

- `mps True` 가 나오면 GPU(MPS) 사용 가능.
- `pyopenjtalk` 빌드 오류가 나면 1단계 `cmake` 설치를 확인하고 `pip install style-bert-vits2` 를 다시 실행한다.
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

## 5. 1문장 합성 확인 (CPU 먼저, MPS 는 실패해도 계속)

```bash
cd ~/kaiwa-tts-run && source .venv/bin/activate
python - <<'PY'
import glob, time, wave
import numpy as np
from style_bert_vits2.constants import Languages
from style_bert_vits2.nlp import bert_models
from style_bert_vits2.tts_model import TTSModel

bert = "ku-nlp/deberta-v2-large-japanese-char-wwm"
bert_models.load_model(Languages.JP, bert)
bert_models.load_tokenizer(Languages.JP, bert)

d = "model_assets/jvnv-F1-jp"
weights = sorted(glob.glob(f"{d}/*.safetensors"))[-1]
text = "こんにちは。今日はいい天気ですね。"
saved = None
for device in ("cpu", "mps"):
    try:
        m = TTSModel(model_path=weights, config_path=f"{d}/config.json",
                     style_vec_path=f"{d}/style_vectors.npy", device=device)
        t = time.time(); m.infer(text=text); warm = time.time() - t
        t = time.time(); sr, audio = m.infer(text=text); hot = time.time() - t
        print(f"RESULT {device}: first {warm:.2f}s, second {hot:.2f}s, sr={sr}")
        if saved is None: saved = (sr, audio)
    except Exception as e:
        print(f"RESULT {device}: FAILED {type(e).__name__}: {str(e)[:160]}")
if saved:
    sr, audio = saved
    with wave.open("/tmp/kaiwa-tts-check.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(np.asarray(audio, dtype=np.int16).tobytes())
    print("saved /tmp/kaiwa-tts-check.wav")
PY
afplay /tmp/kaiwa-tts-check.wav                     # 소리가 나면 성공
pip show style-bert-vits2 torch 2>/dev/null | grep -E '^(Name|Version)'
```

- 목표는 **두 번째 합성 ≤1.0초**(설계 P0). `RESULT` 로 시작하는 두 줄을 알려 주면 task-003 실측 게이트 기록에 넣는다.
- 첫 실행 때 pyopenjtalk 가 일본어 사전(`open_jtalk_dic_utf_8-1.11`, 22.6MB)을 자동으로 받는다 — 정상.
- **MPS 에서 `RuntimeError: Input type (c10::Half) and bias type (float) should be the same`**(2026-09-27 실측): BERT 특징은 half, 합성 모델은 float 로 부딪히는 정밀도 불일치. CPU 결과로 진행하고 MPS 는 task-003 에서 라이브러리 버전에 맞춰 dtype 을 맞춘다.

## 6. 비밀값·포트 준비 (서비스 기동은 task-003 에서)

```bash
# 우분투 앱과 같은 내부 비밀값을 tts 서비스 전용 .env 에 넣는다(값을 화면에 출력하지 않는다).
umask 077
grep '^SPEECH_INTERNAL_SECRET=' /Volumes/homes/brownjeon/project/TheKaiwa/.env \
  | sed 's/^SPEECH_INTERNAL_SECRET=/KAIWA_TTS_INTERNAL_SECRET=/' > ~/kaiwa-tts-run/.env
cat >> ~/kaiwa-tts-run/.env <<'ENV'
KAIWA_TTS_PORT=8200
KAIWA_TTS_MODEL_ASSETS=/Users/REPLACE_ME/kaiwa-tts-run/model_assets
KAIWA_TTS_DEFAULT_MODEL=jvnv-F1-jp
KAIWA_TTS_DEVICE=mps
KAIWA_TTS_LOG_DIR=/Users/REPLACE_ME/kaiwa-tts-local-logs
KAIWA_TTS_QUEUE_TIMEOUT_MS=8000
ENV
sed -i '' "s#/Users/REPLACE_ME#$HOME#g" ~/kaiwa-tts-run/.env
chmod 600 ~/kaiwa-tts-run/.env
grep -c '^KAIWA_TTS_INTERNAL_SECRET=.\+' ~/kaiwa-tts-run/.env   # 1 이면 성공(값은 안 보임)
lsof -nP -iTCP:8200 -sTCP:LISTEN || echo "8200 비어 있음"
```

- 첫 줄의 NFS 경로(`/Volumes/homes/...`)는 **대화형 터미널에서만** 읽힌다. 권한 오류가 나면 Finder 로 NAS 를 한 번 연 뒤 다시 실행한다.
- 이 비밀값은 2026-09-27 에 새로 교체된 값이다(이전 값은 폐기).

## 7. task-003 에서 이어서 할 것 (지금은 하지 않음)

| 단계 | 내용 |
|---|---|
| 서비스 코드 | `speech/tts-service/app.py`(자체 FastAPI — `/synthesize`·`/voices`·`/health`·`/g2p` 등, README §2) 구현 후 `git pull` |
| 기동 | `cd ~/kaiwa-tts-run/speech/tts-service && ../../.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8200` |
| 워치독 | `crontab -e` 에 `* * * * * ~/kaiwa-tts-run/speech/tts-service/scripts/kaiwa-tts-watchdog.sh >> ~/kaiwa-tts-local-logs/watchdog.log 2>&1` |
| 배포 | Gitea push → webhook-deploy(사용자 승인 게이트) — home-m4-api 와 같은 방식 |
| 방화벽(선택) | 우분투 서버의 실제 접속 IP 를 서비스 로그로 확인한 뒤 macOS `pf` 로 8200 을 그 IP 에만 허용. 그 전까지는 LAN + `X-Internal-Secret` 헤더로 보호 |
| 앱 연결 | 우분투 `.env` `TTS_SERVICE_URL=http://192.168.219.100:8200` 확인 → 관리자 콘솔 `Speech › TTS` 에서 [상태 확인]·[기능 테스트] |

## 8. 끝나면 알려 줄 것

1. 3단계의 `torch … mps True/False` 줄과 `git status` 결과
2. 5단계 출력(`mps: first …s, second …s` / `cpu: …`)과 소리가 났는지
3. 6단계 마지막 두 줄(`1`, `8200 비어 있음`)
4. 막힌 단계가 있으면 번호와 오류 마지막 20줄
