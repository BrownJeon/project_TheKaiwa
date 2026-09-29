import { ok, readJsonObject, withApi } from '@/modules/infra'
import { diffConfig, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #106 Diff — `{scope, targetId, patch | versionId}` → 바뀐 키별 before/after·출처·blocked·verifiable + 무상태 summaryHash(D-C1). 저장 없음. */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('config.edit')
  return ok(await diffConfig(actor, await readJsonObject(req)))
})
