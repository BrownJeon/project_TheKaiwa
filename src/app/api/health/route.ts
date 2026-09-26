import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 의존성별 상태를 **개별적으로** 보고한다 — 하나가 미설정이어도 부팅은 되고, 무엇이
 * 빠졌는지 한눈에 보이게 한다(Phase 0 완료 기준, api-contract #1). 값·경로·호스트는
 * 절대 응답에 싣지 않고 **설정 여부(boolean)** 만 노출한다(인증 없는 엔드포인트).
 * 네트워크 프로브(gateway·tts·whisper 실제 응답)는 Admin Console 의 EngineHealth 가 맡는다.
 */
export async function GET() {
  const has = (k: string) => Boolean(process.env[k] && process.env[k]!.length > 0)
  const checks: Record<string, { ok: boolean }> = {
    env_database: { ok: has('DATABASE_URL') },
    env_jwt: { ok: has('JWT_SECRET') },
    env_google_oauth: { ok: has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET') },
    env_data_root: { ok: has('DATA_ROOT') },
    env_internal_secret: { ok: has('SPEECH_INTERNAL_SECRET') },
    claude_cli: { ok: has('CLAUDE_CLI_PATH') },
    speech_gateway: { ok: has('SPEECH_GATEWAY_URL') },
    tts_service: { ok: has('TTS_SERVICE_URL') },
    whisper_service: { ok: has('WHISPER_SERVICE_URL') },
  }
  const degraded = Object.entries(checks).filter(([, v]) => !v.ok).map(([k]) => k)
  return NextResponse.json(
    {
      success: true,
      data: {
        app: 'thekaiwa',
        env: process.env.APP_ENV ?? 'LOCAL',
        status: degraded.length === 0 ? 'ok' : 'degraded',
        degraded,
        checks,
        now: new Date().toISOString(),
      },
      message: null,
    },
    { status: 200 },
  )
}
