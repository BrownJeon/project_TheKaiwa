import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, validateConfig } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #104 Validate — `{scope, targetId, patch, environment?}` → 저장 없이 문법·스키마·의존성 검사(바뀐 키만). */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('config.edit')
  return ok(await validateConfig(actor, await readJsonObject(req)))
})
