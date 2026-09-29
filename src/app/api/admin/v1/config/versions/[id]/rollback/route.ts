import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, rollbackConfigVersion } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #109 Rollback = 새 버전(restoredFromVersion) — 밀려난 직전 ACTIVE 는 ROLLED_BACK, 복원 대상 상태 불변(D-C6). 스냅샷은 지금 규칙으로 엄격 재검증
 * (위반 422 E_SNAPSHOT_INTEGRITY, 쓰기 0). 이미 ACTIVE·변화 없음 409. PRODUCTION 은 §2-19 흐름(`config.apply.production`).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.rollback')
  const { id } = await ctx.params
  return ok(await rollbackConfigVersion(actor, id, await readJsonObject(req)), null, { status: 201 })
})
