import { ok, requireSession, withApi } from '@/modules/infra'
import { listDrawerCorrections, parseDrawerCorrectionQuery } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #79 서랍장 교정(task-055) — 내가 채택한 교정만, `resolvedAt desc`. 필터·검색·limit·커서 검증은 모듈이 한다(잘못된 값 400).
 * 읽기 전용: 쓰기·부수효과 없음. 첫 쪽(`cursor` 없음)에만 `facets`.
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await listDrawerCorrections(s.user.id, parseDrawerCorrectionQuery(req.nextUrl.searchParams)))
})
