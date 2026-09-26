import { NextResponse } from 'next/server'
import { auth } from '@/modules/infra/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/auth/me — 현재 세션 사용자. 미인증은 401. */
export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ success: false, data: null, message: '로그인이 필요합니다' }, { status: 401 })
  }
  return NextResponse.json({ success: true, data: { user: session.user }, message: null })
}
