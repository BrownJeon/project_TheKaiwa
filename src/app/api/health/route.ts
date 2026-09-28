import { NextResponse } from 'next/server'
import { getHealthSummary, healthHttpStatus } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health — 공개(api-contract #1). 판정은 admin.getHealthSummary 가 한다: 키는 역할 이름, 값은 boolean 만.
 * 선택 의존성만 빠지면 200 + `degraded`, 필수 의존성(DB·필수 env)이 안 되면 503 + `status:"down"` —
 * release.sh 헬스 게이트가 503 을 보고 새 릴리스를 거부한다(task-009).
 */
export async function GET() {
  const summary = await getHealthSummary()
  const httpStatus = healthHttpStatus(summary.status)
  return NextResponse.json(
    {
      success: httpStatus === 200,
      data: { app: 'thekaiwa', env: process.env.APP_ENV ?? 'LOCAL', ...summary, now: new Date().toISOString() },
      message: httpStatus === 200 ? null : '필수 의존성(DB·환경 변수)을 사용할 수 없습니다',
    },
    { status: httpStatus },
  )
}
