import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, setConnectionCredential } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #93b 비밀 참조 연결·해제(SUPER_ADMIN) — `{credentialRef | null, baseVersion, reason, confirm?, summaryHash?, testResultId?}`. 값 필드 400 ·
 * 전역 거부·어댑터 허용 목록 밖 422 E_REF_NOT_ALLOWED · 형식·존재 400. 감사 credentials.set|clear(참조 이름만).
 */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('credentials.manage')
  const { id } = await ctx.params
  const r = await setConnectionCredential(actor, id, await readJsonObject(req, 4 * 1024))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
