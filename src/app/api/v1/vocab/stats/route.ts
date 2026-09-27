import { ok, requireSession, withApi } from '@/modules/infra'
import { getVocabStats, parseStatsDays } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #54 통계 — `StatsSnapshot(VOCAB_SESSION)` 만 읽는다(원본 삭제와 무관). */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await getVocabStats(s.user.id, parseStatsDays(req.nextUrl.searchParams.get('days'))))
})
