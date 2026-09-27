import { ok, withApi } from '@/modules/infra'
import { importLexicon, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Import — multipart `file`(CSV/JSON ≤256KB·≤2,000행) + 적용 때 `reason`·`baseVersion`·`confirm`(PRODUCTION), 쿼리 `mode=MERGE|REPLACE_SCOPE`·`dryRun=1|0`.
 * dryRun = 변경 예정(changes ≤100)·범위별 끄기 수(scopes)·행별 오류(errors ≤200), DB 변화 0. 적용 = 오류 행이 하나라도 있으면 422 E_IMPORT_HAS_ERRORS
 * (전부 아니면 전무), 변경이 있으면 새 버전 1 + AuditLog 1.
 */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('voices.manage')
  return ok(await importLexicon(actor, req, req.nextUrl.searchParams))
})
