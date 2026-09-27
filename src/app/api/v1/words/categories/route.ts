import { ok, requireSession, withApi } from '@/modules/infra'
import { listCategories } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #46 카테고리별 개수 — `count` 는 보관 제외, `archivedCount` 는 보관(F6). */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await listCategories(s.user.id))
})
