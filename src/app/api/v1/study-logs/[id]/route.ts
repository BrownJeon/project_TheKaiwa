import { ok, requireSession, withApi } from '@/modules/infra'
import { deleteStudyLog } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #73 학습 기록 삭제 — 기록 한 행만. `origin=DIRECT` 도 지운다. 평가의 `studyLogId` 는 SetNull,
 * 집계(StatsSnapshot)는 바뀌지 않는다(`snapshotKept:true`). 남의 기록·없는 기록 404.
 */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await deleteStudyLog(s.user.id, id))
})
