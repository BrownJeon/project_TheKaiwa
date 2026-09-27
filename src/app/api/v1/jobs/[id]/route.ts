import { ApiError, jobs, ok, requireSession, withApi } from '@/modules/infra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #55 잡 폴링 — 소유자 것만(타인·없음 404). 오래된 진행 중 잡은 읽는 자리에서 FAILED 로 정리된다. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const job = await jobs.getJobForUser(s.user.id, id)
  if (!job) throw new ApiError('NOT_FOUND', '작업을 찾을 수 없어요.')
  return ok(job)
})
