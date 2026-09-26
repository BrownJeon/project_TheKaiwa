/** @type {import('pm2').StartOptions} */
// `next start` 는 반드시 ~/.node-local/thekaiwa(node_modules 가 실제로 존재하는 곳)에서
// 실행해야 한다 — 이유는 scripts/sync-local.sh 주석 참고. 배포 시 `npm run build` 가
// 이미 node-local 을 최신 소스로 동기화해 두므로 pm2 는 그 결과물을 그대로 기동한다.
const fs = require('node:fs')

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
  ],
}
