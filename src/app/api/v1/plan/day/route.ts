import { ok, requireSession, withApi } from '@/modules/infra'
import { ownedChatIds } from '@/modules/conversation'
import { getDay, parseDayDate } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #71 하루 상세 `?date=YYYY-MM-DD` — 로그 목록·출석·그날 복습. 로그의 `refExists` 중 대화(Chat, L2 소유)는
 * 라우트가 conversation 공개 함수로 확인해 learning 에 넘긴다(module-dependency §3 — L3 는 L2 를 import 하지 않는다).
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  const date = parseDayDate(req.nextUrl.searchParams.get('date'))
  return ok(await getDay(userId, date, { ownedChatIds: (ids) => ownedChatIds(userId, ids) }))
})
