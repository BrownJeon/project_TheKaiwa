import { ok, withApi } from '@/modules/infra'
import { meCapabilities, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #137b 내 capability(UI 숨김용 — 서버는 매 요청 재검사). USER 는 404. */
export const GET = withApi(async () => {
  const actor = await requireCapability('console.access')
  return ok(meCapabilities(actor))
})
