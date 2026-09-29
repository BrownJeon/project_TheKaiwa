import { ok, readJsonObject, withApi } from '@/modules/infra'
import { getEngineConnectionDetail, requireCapability, updateConnectionForm, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #91a Connection 상세 + effectiveSummary + 최근 Health 5건. id 또는 key. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.read')
  const { id } = await ctx.params
  return ok(await getEngineConnectionDetail(actor, viewEnvironment(actor, req.nextUrl.searchParams.get('environment')), id))
})

/**
 * #93 Form 편집 — `{connection?, runtime?, enabled?, baseVersion, reason, confirm?, summaryHash?, testResultId?}` → Validate·Diff·Apply 한 번에(결과는 #107 과 같다).
 * 편집 가능 키는 앱이 실제로 읽는 키뿐(D-C4) — 서비스 설정·재시작 필요·읽기 전용·주소 고정·비밀 참조(#93b 전용) 키는 400.
 */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.connections.manage')
  const { id } = await ctx.params
  const r = await updateConnectionForm(actor, id, await readJsonObject(req))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
