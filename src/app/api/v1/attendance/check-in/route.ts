import { ok, requireSession, withApi } from '@/modules/infra'
import { checkIn } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #25 출석(멱등, 본문 없음, 날짜는 서버 KST). */
export const POST = withApi(async () => {
  const s = await requireSession()
  return ok(await checkIn(s.user.id))
})
