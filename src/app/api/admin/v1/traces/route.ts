import { ok, parseLimit, withApi } from '@/modules/infra'
import { listTraceDtos, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #128 Trace 목록(최신순 커서). userId 필터는 SUPER_ADMIN 만. 원음·전체 텍스트 없음. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('trace.read')
  const q = req.nextUrl.searchParams
  return ok(
    await listTraceDtos(actor, viewEnvironment(actor, q.get('environment')), {
      kind: q.get('kind'),
      status: q.get('status'),
      from: q.get('from'),
      to: q.get('to'),
      connectionId: q.get('connectionId'),
      userId: q.get('userId'),
      refType: q.get('refType'),
      refId: q.get('refId'),
      cursor: q.get('cursor'),
      limit: parseLimit(q.get('limit'), 50, 100),
    }),
  )
})
