import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, rollbackLexicon } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ version: string }> }

/**
 * Rollback — 대상 버전 스냅샷을 **새 ACTIVE 버전**으로(항목 표도 그 상태로, 물리 삭제 없음). 대체된 직전 ACTIVE 는 ROLLED_BACK.
 * 본문 `{baseVersion, reason, confirm?}`. 대상이 지금 ACTIVE 면 409. TtsCache 는 새 dictionaryVersion 으로 자연 미적중.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('voices.manage')
  const { version } = await ctx.params
  return ok(await rollbackLexicon(actor, version, await readJsonObject(req, 4 * 1024)))
})
