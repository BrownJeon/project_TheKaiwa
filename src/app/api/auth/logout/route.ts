import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/modules/infra/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/logout — 세션 쿠키 제거.
 * 세션이 없어도 200이다(멱등) — 이미 로그아웃된 상태에서 다시 눌러도 화면이 오류로
 * 멈추지 않게. GET을 두지 않는 이유: 링크 프리페치·이미지 태그만으로 남의 세션을
 * 끊을 수 있는 CSRF 표면이 된다.
 */
export async function POST() {
  const res = NextResponse.json({ success: true, data: null, message: null })
  clearSessionCookie(res)
  return res
}
