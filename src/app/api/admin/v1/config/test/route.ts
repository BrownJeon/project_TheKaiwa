import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, testConfig } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #105 Test — `{scope, targetId, patch | versionId}` 후보를 메모리에서만 합성해 실행 검증(CX-2). 바뀐 키 전부를 실제로 검증했을 때만
 * `status:"ok"` + `testResultId`(PRODUCTION 적용 첨부, 30분). 연결마다 30초 슬롯(#96 과 공유, 429).
 */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('functional_test.run')
  return ok(await testConfig(actor, await readJsonObject(req)))
})
