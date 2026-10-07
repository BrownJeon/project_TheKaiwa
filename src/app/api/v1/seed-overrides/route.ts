import { ApiError, ok, requireSession, withApi } from '@/modules/infra'
import { isSeedKind, listSeedOverrideItems } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #179 내가 숨겼거나 내 버전으로 바꾼 시드 목록(task-045 T1-3, 관리 화면) `?kind=TOPIC|SCENARIO`(없으면 둘 다). 읽기 전용, 본인 override 만.
 * 200 `{items:[{kind, seedId, seedTitle, state:'HIDDEN'|'COPIED', copyId|null, orphan, updatedAt}]}` — `copyId` 있으면 "내 버전", null 이면 숨김
 * (`seedTitle` = 공유 시드 제목, 시드 행이 사라졌으면 null). 400 `kind`.
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const raw = new URL(req.url).searchParams.get('kind')
  if (raw !== null && !isSeedKind(raw)) throw new ApiError('VALIDATION', '종류가 올바르지 않아요.', { field: 'kind', reason: 'enum' })
  return ok({ items: await listSeedOverrideItems(s.user.id, raw ?? undefined) }, null, { headers: { 'Cache-Control': 'private, no-store' } })
})
