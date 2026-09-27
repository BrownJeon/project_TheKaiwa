import { ok, withApi } from '@/modules/infra'
import { listVoiceDtos, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #82 Voice 전체(상태 포함, 기본 ARCHIVED 제외) + 모델·스타일·사용자 수. */
export const GET = withApi(async (req) => {
  await requireCapability('voices.read')
  const q = req.nextUrl.searchParams
  return ok(await listVoiceDtos({ status: q.get('status'), includeArchived: q.get('includeArchived') }))
})
