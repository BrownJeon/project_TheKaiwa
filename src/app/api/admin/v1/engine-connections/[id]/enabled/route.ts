import { ok, readJsonObject, withApi } from '@/modules/infra'
import { requireCapability, setConnectionEnabled } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #93a 켜기·끄기 — `{enabled, baseVersion, reason, confirm?, summaryHash?, testResultId?}`. 켜진 대체 정책의 주 연결은 409 PRIMARY_IN_USE. 끄기는 기능 테스트 면제. */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.connections.manage')
  const { id } = await ctx.params
  const r = await setConnectionEnabled(actor, id, await readJsonObject(req))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
