/** @type {import('pm2').StartOptions} */
// `next start` 는 반드시 ~/.node-local/thekaiwa(node_modules 가 실제로 존재하는 곳)에서
// 실행해야 한다 — 이유는 scripts/sync-local.sh 주석 참고. 배포 시 `npm run build` 가
// 이미 node-local 을 최신 소스로 동기화해 두므로 pm2 는 그 결과물을 그대로 기동한다.
const fs = require('node:fs')
const path = require('node:path')

// pm2 는 out_file/error_file 의 **상위 디렉토리를 만들어 주지 않는다** — 없으면 로그
// 파일을 열지 못해 기동에 실패하고, 그 실패 자체가 어떤 로그에도 남지 않는다
// (VoiceVault 2026-09-02 실장애: 204회 크래시 루프). ecosystem 은 pm2 가 앱을 띄우기
// 전에 평가되므로 여기서 만드는 것이 확실하다.
/**
 * ── 실행 위치는 **두 세계**를 모두 지원해야 한다 (2026-09-19) ─────────────────
 *
 * ① **blue/green 릴리스**(`/home/brownjeon/apps/thekaiwa/releases/<id>/`) — 새 방식.
 *    거기엔 `node_modules` 와 빌드 결과물이 함께 있으므로 **그 자리에서** 돈다.
 *    `release.sh` 의 `ensure_current_cwd` 가 pm2 의 cwd 가 릴리스를 가리키는지 검사하고,
 *    아니면 `current/ecosystem.config.js` 로 재등록한 뒤 **그래도 아니면 배포를 중단**한다
 *    (`current` 를 안 바꾸고 이전 릴리스가 계속 서 있는다). 즉 여기를 고정 경로로 두면
 *    blue/green 이 영원히 성공하지 못한다.
 *
 * ② **NFS 편집 트리에서 읽힌 경우** — 현행 방식. NFS 는 noexec 이고 `node_modules` 도
 *    없으므로 그 자리에서는 못 돈다. 미러(`~/.node-local/thekaiwa`)로 보낸다.
 *
 * 그래서 **`node_modules` 가 옆에 있는지**로 가른다 — 경로 문자열 비교보다 정확하다
 * (릴리스 id 는 매번 바뀌고 미러 경로는 `$HOME` 에 따라 달라진다).
 */
const HERE = __dirname
const MIRROR = `${process.env.HOME}/.node-local/thekaiwa`
const CWD = fs.existsSync(`${HERE}/node_modules`) ? HERE : MIRROR

const LOG_DIR = `${CWD}/logs`
fs.mkdirSync(LOG_DIR, { recursive: true })

/**
 * ── 음성 gateway(Python) 환경 주입 (task-003e) ─────────────────────────────
 * uvicorn(Python)은 dotenv 를 읽지 않으므로 `.env` 에서 필요한 키만 골라 넘긴다(VoiceVault `voicevault-whisper` 방식).
 * 값은 `.env` 에만 있고 이 파일(커밋 대상)에는 남지 않는다.
 * ⚠ 이 저장소 `.env` 는 `APP_ENV=LOCAL   # 주석` 처럼 **인라인 주석**을 쓴다 — VoiceVault 의 파서를 그대로 쓰면
 *   값에 주석이 붙어 들어간다. 따옴표 없는 값은 첫 ` #` 앞까지만 취한다.
 */
function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if (v[0] === '"' || v[0] === "'") {
      const end = v.indexOf(v[0], 1)
      v = end > 0 ? v.slice(1, end) : v.slice(1)
    } else {
      v = v.split(/\s+#/)[0].trim()
    }
    out[m[1]] = v
  }
  return out
}

function pickNonEmpty(src, keys) {
  const out = {}
  for (const k of keys) {
    if (src[k]) out[k] = src[k]
  }
  return out
}

const dotenv = readEnvFile(`${HERE}/.env`)
const SPEECH_VENV = `${process.env.HOME}/.node-local/thekaiwa-speech/venv`
// 모델: `.env` SPEECH_MODELS_DIR > DATA_ROOT/models(서빙 위치, speech/models/README §2) > 저장소 speech/models(git 미추적 다운로드 캐시).
// 릴리스 디렉토리에는 모델이 없으므로(미추적) blue/green 전환 전에 `fetch_models.py --dest "$DATA_ROOT/models"` 로 채운다.
const SPEECH_MODELS_DIR =
  dotenv.SPEECH_MODELS_DIR ||
  (dotenv.DATA_ROOT && fs.existsSync(`${dotenv.DATA_ROOT}/models/reazonspeech-int8/manifest.json`)
    ? `${dotenv.DATA_ROOT}/models`
    : `${HERE}/speech/models`)

module.exports = {
  apps: [
    {
      name: 'thekaiwa',
      script: 'node_modules/next/dist/bin/next',
      // 127.0.0.1 에만 바인딩한다 — nginx 가 같은 호스트에서 프록시하므로 외부 인터페이스에 열 이유가 없다
      // (CLAUDE.md: TradingInvest 가 0.0.0.0 리슨으로 무인증 API 가 노출된 사례).
      args: 'start -H 127.0.0.1 -p 3010',
      cwd: CWD,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3010',
      },
      out_file: `${LOG_DIR}/pm2-out.log`,
      error_file: `${LOG_DIR}/pm2-err.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      // 실시간 STT 폴백 gateway — WS /ws/speech (nginx 가 이 경로만 프록시). speech/gateway/README.md.
      // 코드는 HERE(릴리스 또는 NFS 편집 트리)에서 **읽기만** 하고(파이썬 소스 읽기는 noexec 와 무관),
      // 인터프리터·네이티브 라이브러리(sherpa-onnx)는 로컬 디스크 venv 의 것을 쓴다. 공용 패키지는 PYTHONPATH 로
      // 읽는다 — `pip install -e` 는 설치 경로를 박아 넣어 릴리스마다 재설치가 필요해진다.
      // venv 는 릴리스 밖 공유 자원(requirements.txt 변경 = 별도 승인 작업, 롤백으로 되돌아가지 않음).
      name: 'thekaiwa-speech-gateway',
      script: `${SPEECH_VENV}/bin/uvicorn`,
      // --ws-max-size: 오디오 프레임 1,280B·텍스트 ≤4KB 라 64KB 면 충분(기본 16MB 는 메모리 공격 여지).
      // --ws-per-message-deflate false: PCM 은 압축 이득이 없고 압축 해제 폭탄 여지만 생긴다.
      args:
        'app:app --host 127.0.0.1 --port 8100 --ws-max-size 65536 --ws-ping-interval 15 --ws-ping-timeout 30 ' +
        '--ws-per-message-deflate false --no-server-header --timeout-graceful-shutdown 5',
      interpreter: 'none',
      cwd: `${HERE}/speech/gateway`,
      instances: 1,
      autorestart: true,
      watch: false,
      // 2026-09-28 실측: 모델 로드 후 ≈330MB, 세션 1개 ≈410MB, 세션 3개 동시 피크 ≈510MB.
      max_memory_restart: '1G',
      kill_timeout: 8000,
      env: {
        ...pickNonEmpty(dotenv, [
          'APP_ENV',
          'DATA_ROOT',
          'JWT_SECRET',
          'SPEECH_INTERNAL_SECRET',
          'APP_INTERNAL_URL',
          'SPEECH_LOG_LEVEL',
          'SPEECH_GATEWAY_ALLOWED_ORIGINS',
          'SPEECH_STT_NUM_THREADS',
          'SECRETS_DIR',
        ]),
        // 상대 경로(`./speech/speech.config.yml`)는 cwd(speech/gateway) 기준이 아니라 저장소 루트 기준이다.
        SPEECH_CONFIG_PATH: path.resolve(HERE, dotenv.SPEECH_CONFIG_PATH || 'speech/speech.config.yml'),
        SPEECH_MODELS_DIR,
        PYTHONPATH: `${HERE}/speech/gateway:${HERE}/speech/common`,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
      },
      out_file: `${LOG_DIR}/speech-gateway-out.log`,
      error_file: `${LOG_DIR}/speech-gateway-err.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
