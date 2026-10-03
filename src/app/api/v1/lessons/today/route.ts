import { ok, requireSession, withApi } from '@/modules/infra'
import { getTodayLessons } from '@/modules/learning'
import { reviewDecisionDriver } from '../../_lib/review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #58 오늘의 회화 + 오늘의 복습 — `{mode, date, review, guard, cycle, decisionPending, decisionJobId, nextReview, todayLessons[], resume, recommendation}`.
 * 그날 강사 복습 판단이 아직 없으면 여기서 A11 잡을 건다(하루 한 번, 화면은 기다리지 않는다 — `decisionPending`). 복습 칸 계산이 실패해도
 * 레슨 칸은 그대로 내려준다(Leader 결정 ⑥). 날짜는 서버 KST.
 */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await getTodayLessons(s.user.id, { reviewDecision: reviewDecisionDriver(s.user.id) }), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
