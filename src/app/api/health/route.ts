import { NextResponse } from 'next/server'
import { getHealthSummary } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health — 공개, 항상 200(api-contract #1). 판정은 admin.getHealthSummary 가 한다:
 * 키는 역할 이름, 값은 boolean 만, 60초 캐시. 무엇이 빠졌는지는 `degraded` 로 본다.
 */
export async function GET() {
  const summary = await getHealthSummary()
  return NextResponse.json(
    {
      success: true,
      data: { app: 'thekaiwa', env: process.env.APP_ENV ?? 'LOCAL', ...summary, now: new Date().toISOString() },
      message: null,
    },
    { status: 200 },
  )
}
