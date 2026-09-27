import { fail, rateLimit, requireSession, withApi } from '@/modules/infra'
import { readUtteranceAudio } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #21b 내 발화 원음(task-007 K6 최소판) — 소유자만 `audio/wav`. 타인·없음·보존 30일 지남·파일 없음은 모두 404.
 * 회화방 "내 발음 다시 듣기". 사용자당 60/분. `Cache-Control: private, max-age=300`.
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  rateLimit(`utterance-audio:${s.user.id}`, 60)
  const { id } = await ctx.params
  const a = await readUtteranceAudio(s.user.id, id)
  if (!a) return fail('NOT_FOUND', '녹음을 찾을 수 없어요.')
  return new Response(new Uint8Array(a.audio), {
    status: 200,
    headers: { 'Content-Type': 'audio/wav', 'Content-Length': String(a.audio.length), 'Cache-Control': 'private, max-age=300', 'X-Audio-Duration-Ms': String(a.durationMs) },
  })
})
