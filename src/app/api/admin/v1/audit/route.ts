import { ok, withApi } from '@/modules/infra'
import { listAuditLogs, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #137 감사 조회 — `?environment=&scope=&targetId=&actorUserId=&action=&from=&to=&limit=&cursor=`. LEXICON 은 옛 `scope=null` `lexicon.*` 포함. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('audit.read')
  return ok(await listAuditLogs(actor, req.nextUrl.searchParams))
})
