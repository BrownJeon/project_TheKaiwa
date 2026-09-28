import { ok, requireSession, withApi } from '@/modules/infra'
import { listTopics, parseTopicQuery } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #56 주제 목록 — 시드 + 내 주제(`mine=1` 이면 내 것만), 조각 포함. `level` 없으면 학습자 수준 ±1.
 * `lessonCount`·`lastLessonAt` 은 **끝낸** 레슨 기준. 응답 `{items, level[]}`(level = 실제로 적용한 수준 목록).
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await listTopics(s.user.id, parseTopicQuery(req.nextUrl.searchParams)))
})
