import { ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { loadReviewMixMaterials, startReview } from '@/modules/learning'
import { reviewMixGeneration } from '../../../_lib/review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #63 복습 시작 — 본문 없음. 소유자만(타인·없음 404), `status≠DUE` 409 `{reason:'NOT_DUE', status}`.
 * A5 요청(`reviewMix`, mixSpec = 세션 `itemIds` 의 RepetitionItem 스냅샷)을 conversation 으로 만들어 learning 이 `Lesson(kind=REVIEW)` +
 * `AiJob(REVIEW_GEN)` 을 점유하고 백그라운드로 돌린다(후검증 `chunks ⊆ mixSpec`, 위반 1회 재시도). 연결된 레슨이 준비됨·하는 중·끝남·
 * 만드는 중이면 그 레슨(`reused:true`), 만들기 실패면 같은 세션으로 새 레슨(★③). 다른 복습 수업을 만드는 중이면 409 `GENERATING`. 사용자당 분당 10.
 * 응답 `{lessonId, jobId, status, reused}` — jobId 로 #55, DONE 이면 #60.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`review-start:${userId}`, 10)
  const m = await loadReviewMixMaterials(userId, id)
  const gen = await reviewMixGeneration(userId, m)
  return ok(await startReview(userId, id, m, gen))
})
