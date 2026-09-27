import { ok, withApi } from '@/modules/infra'
import { getLexiconVersionDto, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ version: string }> }

/** 버전 상세 + diff — `?compare=previous`(기본: 바로 앞 버전 → 이 버전) · `active`(지금 ACTIVE → 이 버전 = 되돌리면 생길 변화). rows ≤100 + truncated. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('voices.read')
  const { version } = await ctx.params
  return ok(await getLexiconVersionDto(actor, version, req.nextUrl.searchParams))
})
