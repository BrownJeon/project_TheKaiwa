import { ok, requireSession, withApi, withTransaction } from '@/modules/infra'
import { rejectCorrectionIn } from '@/modules/conversation'
import { recordCorrectionIgnored } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #36 교정 무시 — **한 트랜잭션**: Correction REJECTED(조건부 전이, 사용자 행 잠금 뒤) + 관측 `CORRECTION_IGNORED`(+ DAILY observations, task-010b L3).
 * 그 밖의 행(단어·기록·오류 통계·반복 항목)은 만들지 않는다. 이미 처리 409 `{status}`, 없거나 남의 것 404.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  return ok(
    await withTransaction(async (tx) => {
      const r = await rejectCorrectionIn(tx, userId, id)
      await recordCorrectionIgnored(userId, { id, errorType: r.errorType, severity: r.severity }, tx)
      return r.result
    }),
  )
})
