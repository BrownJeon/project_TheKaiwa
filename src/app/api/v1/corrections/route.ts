import { ApiError, ok, parseLimit, requireSession, withApi } from '@/modules/infra'
import { CORRECTION_STATUSES, listCorrections } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #34 교정 목록 — `chatId` 있으면 메시지 순서(D5), 없으면 최신순. 남의 채팅 id 는 404. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  const status = q.get('status')
  if (status && !(CORRECTION_STATUSES as readonly string[]).includes(status)) throw new ApiError('VALIDATION', 'status 값이 올바르지 않습니다.', { field: 'status' })
  return ok(
    await listCorrections(s.user.id, {
      status: (status || undefined) as (typeof CORRECTION_STATUSES)[number] | undefined,
      chatId: q.get('chatId'),
      limit: parseLimit(q.get('limit'), 20, 100),
      cursor: q.get('cursor'),
    }),
  )
})
