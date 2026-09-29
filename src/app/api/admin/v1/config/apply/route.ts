import { ok, readJsonObject, withApi } from '@/modules/infra'
import { applyConfig, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #107 Apply — `{scope, targetId, patch, baseVersion, reason, confirm?, summaryHash?, testResultId?, environment?}`.
 * 한 트랜잭션: 잠금 → baseVersion → (첫 적용) 기준선 v1 → 물화 → 버전 → 감사. PRODUCTION = SUPER_ADMIN + confirm "PRODUCTION" + summaryHash + testResultId + reason ≥10.
 * 변경 없음은 200 `{changed:false}`, 적용은 201.
 */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('config.edit')
  const r = await applyConfig(actor, await readJsonObject(req))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
