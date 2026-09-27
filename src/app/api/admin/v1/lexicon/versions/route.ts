import { ok, withApi } from '@/modules/infra'
import { listLexiconVersionDtos, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 사전 버전 목록(번호 내림차순, `page`·`pageSize`≤50, 기본 20) — 상태·요약·항목 수·켜진 수·작업자·이유(감사 행). */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('voices.read')
  return ok(await listLexiconVersionDtos(actor, req.nextUrl.searchParams))
})
