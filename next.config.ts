import type { NextConfig } from 'next'

// `outputFileTracingRoot`/`turbopack.root`를 명시하지 않으면 Next가 $HOME의 무관한
// package.json을 보고 워크스페이스 루트를 잘못 추론한다(StockInvest·VoiceVault 실측).
// 이 프로젝트는 cwd가 ~/.node-local/thekaiwa(미러)이므로 특히 중요하다.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  outputFileTracingRoot: __dirname,
  // Next 16이 dev 기동 시 cwd에 AGENTS.md/CLAUDE.md를 자동 생성하는 기능 — 실제
  // CLAUDE.md는 NFS 루트에 있으므로 node-local 미러에 중복 파일이 생기지 않게 끈다.
  agentRules: false,
  turbopack: {
    root: __dirname,
  },
  // 기본 보안 헤더(reviewer REV-001 Low). nginx 설정은 인프라 세션 소유이므로 앱 레벨에
  // 둔다 — nginx 적용 여부와 무관하게 항상 걸린다.
  // CSP 는 Phase 2 이후 인라인 스타일·이미지 출처가 확정된 뒤에 붙인다(지금 넣으면
  // Next 의 인라인 부트스트랩 스크립트를 막아 앱이 뜨지 않는다).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(self), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
