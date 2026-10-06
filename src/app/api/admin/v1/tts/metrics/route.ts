import { ok, withApi } from '@/modules/infra'
import { getTtsMetricsDto, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * task-012b-3 TTS 일별 지표(speech-platform/16 §7.3) — `?range=today|7d|30d|90d&connectionId=&voiceId=&environment=`.
 * 권한 `trace.read`(role-permission.md:49 정본 — 16 §7.3 의 engine.read 는 정정 대상). 지난 날은 EngineMetricsDaily(없으면 지금 물화), 오늘은 즉석 집계 60초 캐시.
 */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('trace.read')
  const q = req.nextUrl.searchParams
  return ok(await getTtsMetricsDto(viewEnvironment(actor, q.get('environment')), { range: q.get('range'), connectionId: q.get('connectionId'), voiceId: q.get('voiceId') }))
})
