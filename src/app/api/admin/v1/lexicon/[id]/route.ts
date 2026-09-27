import { ok, readJsonObject, withApi } from '@/modules/infra'
import { disableLexiconEntry, getLexiconEntryDto, requireCapability, updateLexiconEntry } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withApi<Ctx>(async (_req, ctx) => {
  const actor = await requireCapability('voices.read')
  const { id } = await ctx.params
  return ok(await getLexiconEntryDto(actor, id))
})

/** 항목 수정(보낸 필드만 바뀜, `enabled` 토글 포함) → 새 버전 + AuditLog. 값이 같으면 `changed:false`(버전·감사 없음). */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('voices.manage')
  const { id } = await ctx.params
  return ok(await updateLexiconEntry(actor, id, await readJsonObject(req, 8 * 1024)))
})

/** 비활성(`enabled=false`, 물리 삭제 없음) → 새 버전 + AuditLog. 본문 `{baseVersion, reason, confirm?}`. 이미 비활성이면 `changed:false`. */
export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('voices.manage')
  const { id } = await ctx.params
  return ok(await disableLexiconEntry(actor, id, await readJsonObject(req, 4 * 1024)))
})
