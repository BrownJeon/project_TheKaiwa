import { ok, readJsonObject, withApi } from '@/modules/infra'
import { getRawConfig, putRawConfig, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ scope: string; targetId: string }> }

/** #110 Raw JSON 보기(DEVELOPER 이상) — 저장값 문서·키별 편집 정책·Effective 와 다른 키. PRODUCTION 대상은 감사(config.raw.read). */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.raw.read')
  const { scope, targetId } = await ctx.params
  return ok(await getRawConfig(actor, scope, targetId, req.nextUrl.searchParams.get('environment')))
})

/**
 * #111 Raw JSON 편집(`config.edit` + `config.raw.read`) — `{json, baseVersion, dryRun, reason, confirm?, summaryHash?, testResultId?}`.
 * dryRun = 검증·Diff 만. 적용은 #107 과 같은 트랜잭션(버전 origin RAW_JSON, 감사 config.raw_apply).
 */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.edit')
  const { scope, targetId } = await ctx.params
  const r = await putRawConfig(actor, scope, targetId, await readJsonObject(req))
  return ok(r, null, { status: 'changed' in r && r.changed ? 201 : 200 })
})
