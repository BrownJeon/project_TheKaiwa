import { withApi } from '@/modules/infra'
import { exportLexiconFile, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Export — `?format=csv|json` 파일 다운로드(봉투 없음). CSV 는 UTF-8 BOM + 인젝션 이스케이프, JSON 은 `{dictionaryVersion, environment, exportedAt, entries}`.
 * 메타는 헤더에도: `X-Lexicon-Dictionary-Version`·`X-Lexicon-Environment`·`X-Lexicon-Exported-At`·`X-Lexicon-Consistent`(항목 표 == ACTIVE 스냅샷).
 */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('voices.read')
  const f = await exportLexiconFile(actor, req.nextUrl.searchParams)
  return new Response(f.body, {
    status: 200,
    headers: {
      'Content-Type': f.contentType,
      'Content-Disposition': `attachment; filename="${f.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Lexicon-Dictionary-Version': String(f.dictionaryVersion),
      'X-Lexicon-Environment': actor.environment,
      'X-Lexicon-Exported-At': f.exportedAt,
      'X-Lexicon-Consistent': f.consistent ? '1' : '0',
    },
  })
})
