import { ok, requireSession, withApi } from '@/modules/infra'
import { listCategories } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #46 카테고리별 개수 — 내 단어 + 기본 단어, 나의 보관 기준 `count`·`archivedCount`(F6). 난이도 이름·기본 단어는 `category:null` 묶음(task-068 D3 B). */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await listCategories(s.user.id))
})
