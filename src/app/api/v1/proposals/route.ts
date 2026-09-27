import { ApiError, ok, parseLimit, requireSession, withApi } from '@/modules/infra'
import { listProposals, PROPOSAL_KINDS, PROPOSAL_STATUSES } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #37 강사 제안 목록 — 최신순. 채팅 하나를 볼 때(`chatId`)는 기본 100건(방 화면이 한 번에 붙인다). 30일 지난 제안은 EXPIRED. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  const status = q.get('status')
  const kind = q.get('kind')
  if (status && !(PROPOSAL_STATUSES as readonly string[]).includes(status)) throw new ApiError('VALIDATION', 'status 값이 올바르지 않습니다.', { field: 'status' })
  if (kind && !(PROPOSAL_KINDS as readonly string[]).includes(kind)) throw new ApiError('VALIDATION', 'kind 값이 올바르지 않습니다.', { field: 'kind' })
  const chatId = q.get('chatId')
  return ok(
    await listProposals(s.user.id, {
      status: (status || undefined) as (typeof PROPOSAL_STATUSES)[number] | undefined,
      kind: (kind || undefined) as (typeof PROPOSAL_KINDS)[number] | undefined,
      chatId,
      limit: parseLimit(q.get('limit'), chatId ? 100 : 20, 100),
      cursor: q.get('cursor'),
    }),
  )
})
