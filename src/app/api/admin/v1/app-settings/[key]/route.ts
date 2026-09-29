import { ok, readJsonObject, withApi } from '@/modules/infra'
import { getAppSettingDto, putAppSetting, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ key: string }> }

/** #123b AppSetting 조회 — 값·설명·편집 정책·버전. 모르는 키 404. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.edit')
  const { key } = await ctx.params
  return ok(await getAppSettingDto(actor, key, req.nextUrl.searchParams.get('environment')))
})

/** #123b 일반 키 편집 — `{value, baseVersion, reason, confirm?, summaryHash?, testResultId?}`. 정책·자동 키는 400. 미리듣기 문장은 textVersion 자동 +1. */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.edit')
  const { key } = await ctx.params
  const r = await putAppSetting(actor, key, await readJsonObject(req))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
