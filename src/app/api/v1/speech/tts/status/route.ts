import { ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { getTtsStatus } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * §7-1 TTS 실행 상태(speech-platform/16 §12.3) — 서버 관점 `{executionMode, networkStatus, serverHealth, fallbackReason, lastUpdatedAt}`.
 * 필요할 때만 서버가 TTS 연결 Health 를 한 번 돌린다(확인 전 즉시·저하 30초·정상 5분). 엔진명·호스트·연결 키 없음. 사용자당 20/분.
 */
export const GET = withApi(async () => {
  const s = await requireSession()
  rateLimit(`tts-status:${s.user.id}`, 20)
  return ok(await getTtsStatus(), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
