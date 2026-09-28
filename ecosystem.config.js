/** @type {import('pm2').StartOptions} */
const fs = require('node:fs')
const path = require('node:path')

/**
 * ── 이 파일이 평가되는 곳은 셋이다 (task-009, 2026-09-28) ─────────────────────
 *
 * ① **운영 릴리스** `<base>/releases/<id>/ecosystem.config.js` (<base> = /home/brownjeon/apps/thekaiwa).
 *    release.sh 가 `cd <base>/current && pm2 startOrReload <base>/current/ecosystem.config.js` 로 부른다.
 *    Node 는 모듈 경로를 realpath 로 풀기 때문에 `__dirname` 은 `current` 가 아니라 **구체적인 릴리스 경로**다 —
 *    pm2 는 등록 시점의 cwd 문자열을 보관하므로 `current` 를 넣으면 링크가 옮겨간 뒤에도 옛 코드를 돌리는 거짓 성공이
 *    된다(dev-deploy-workflow §3). 릴리스에는 `npm ci`·`next build` 결과가 함께 있어 **그 자리에서** 돈다.
 *    `node_modules` 가 없더라도 미러로 빠지지 않는다 — 운영이 조용히 개발 미러 코드를 도는 것(§7-1 함정)보다 기동
 *    실패로 드러나는 편이 낫다(release.sh 가 헬스 실패로 이전 릴리스로 되돌린다).
 * ② **NFS 편집 트리** — noexec 이고 `node_modules` 가 없으므로 Next 앱은 미러(`~/.node-local/thekaiwa`)에서 돈다.
 * ③ `node_modules` 가 옆에 있는 그 밖의 위치(미러에 이 파일을 복사해 둔 경우 등) — 그 자리에서 돈다.
 *
 * 로그: 운영 릴리스면 릴리스 **밖**의 `<base>/shared/logs`(릴리스가 바뀌고 오래된 릴리스가 지워져도 이어진다 —
 * 릴리스 안 `logs` 링크 경로를 pm2 에 박으면 그 릴리스가 prune 된 뒤 경로가 끊긴다). 그 밖은 종전대로 `<실행 위치>/logs`.
 * pm2 는 out_file/error_file 의 **상위 디렉토리를 만들어 주지 않는다** — 없으면 기동에 실패하고 그 실패가 어떤 로그에도
 * 남지 않는다(VoiceVault 2026-09-02 실장애: 204회 크래시 루프). ecosystem 은 앱보다 먼저 평가되므로 여기서 만든다.
 */
const HERE = __dirname
const MIRROR = `${process.env.HOME}/.node-local/thekaiwa`
const IN_RELEASE = path.basename(path.dirname(HERE)) === 'releases'
const CWD = IN_RELEASE || fs.existsSync(`${HERE}/node_modules`) ? HERE : MIRROR

const LOG_DIR = IN_RELEASE ? path.resolve(HERE, '../../shared/logs') : `${CWD}/logs`
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
