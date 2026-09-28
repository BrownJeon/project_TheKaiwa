import { ok, requireSession, withApi } from '@/modules/infra'
import { ownedChatIds } from '@/modules/conversation'
import { listStudyLogs, parseStudyLogQuery } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #72 학습 기록 목록 `?from=&to=&type=&limit=&cursor=`(구간 ≤92일, 최신순 커서) — #71 과 같은 로그 객체. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  const q = parseStudyLogQuery(req.nextUrl.searchParams)
  return ok(await listStudyLogs(userId, q, { ownedChatIds: (ids) => ownedChatIds(userId, ids) }))
})
