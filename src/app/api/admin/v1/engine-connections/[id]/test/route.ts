import { ApiError, ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, runConnectionFunctionalTest } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #96 Functional Test — LLM 고정 스키마 1회(30초), STT·TTS 는 task-003 전까지 미실행(`detail.reason`).
 * connection 당 30초에 1회(429 + retryAfterSec). 실패도 기록된 결과로 200(결과 카드). `overrideRuntime` 은 Phase 2.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('functional_test.run')
  const { id } = await ctx.params
  const body = await readJsonObject(req, 4 * 1024)
  if (body.overrideRuntime !== undefined && body.overrideRuntime !== null) throw new ApiError('VALIDATION', 'overrideRuntime 은 아직 지원하지 않습니다(Phase 2).', { field: 'overrideRuntime' })
  return ok(await runConnectionFunctionalTest(actor, id))
})
