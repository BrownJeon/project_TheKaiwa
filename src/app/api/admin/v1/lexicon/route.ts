import { ok, readJsonObject, withApi } from '@/modules/infra'
import { createLexiconEntry, listLexiconDtos, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 발음 사전 검색(현재 환경) — `q`(표기·읽기 부분 일치, 히라가나는 가타카나로도)·`scope`·`scopeRefId`·`enabled`(1·all·0, 기본 all)·`sort`(recent=updatedAt desc 기본·surface)·`page`·`pageSize`(기본 50·≤100). counts·active 는 사전 전체. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('voices.read')
  return ok(await listLexiconDtos(actor, req.nextUrl.searchParams))
})

/** 항목 추가 → 새 ACTIVE 버전 + AuditLog(한 트랜잭션). 본문 = 항목 필드 + `baseVersion`·`reason`(+PRODUCTION `confirm`). 같은 키 활성 409, 비활성이면 되살림. */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('voices.manage')
  return ok(await createLexiconEntry(actor, await readJsonObject(req, 8 * 1024)))
})
