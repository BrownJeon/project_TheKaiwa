import { fail, ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { encodeTimingHeader, readSignedTtsAudio, TTS_AUDIO_URL_PATH } from '@/modules/speech'
import { TTS_HEADERS } from '@/types/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

/**
 * #24 캐시 오디오(서명 URL, task-007 K5 · Codex C1-1) — `GET /api/v1/speech/tts/<token>`. 토큰은 SSE `audio.url` 로만 받는다.
 * 세션 없음 401. 형식·만료(10분)·서명(세션 사용자로 재계산)·캐시 없음은 **전부 같은 404**(존재 오라클 금지).
 * `Cache-Control: private, max-age=<남은 초>`. `Accept: application/json` 이면 `{audioUrl, durationMs, timing}`.
 * timing(task-012b-4 D-T1): 서명한 쪽이 토큰에 묶어 둔 **그 조각 글 기준** 단어 timing — wav 는 헤더 `X-Tts-Timing`(앱 형식 base64url,
 * ≤3KB, 넘으면 생략), JSON 은 `timing` 객체. 없으면 헤더 없음·`timing:null`(정상). 엔진 헤더를 그대로 넘기지 않는다.
 * 정적 세그먼트 `/tts/status` 가 이 동적 세그먼트보다 우선한다(Next.js 라우팅). 사용자당 240/분.
 */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  rateLimit(`tts-audio:${s.user.id}`, 240)
  const { token } = await ctx.params
  const f = await readSignedTtsAudio(s.user.id, token)
  if (!f) return fail('NOT_FOUND', '오디오를 찾을 수 없어요.')
  const cache = `private, max-age=${Math.max(0, f.remainingSec)}`
  const timingHeader = encodeTimingHeader(f.timing)
  if ((req.headers.get('accept') ?? '').includes('application/json')) {
    return ok({ audioUrl: `${TTS_AUDIO_URL_PATH}${token}`, durationMs: f.durationMs, timing: timingHeader ? f.timing : null }, null, { headers: { 'Cache-Control': cache } })
  }
  const headers = new Headers({ 'Content-Type': 'audio/wav', 'Content-Length': String(f.audio.length), 'Cache-Control': cache })
  if (f.durationMs !== null) headers.set(TTS_HEADERS.durationMs, String(f.durationMs))
  if (f.modelVersion) headers.set(TTS_HEADERS.modelVersion, f.modelVersion)
  if (f.dictionaryVersion !== null) headers.set(TTS_HEADERS.dictionaryVersion, String(f.dictionaryVersion))
  if (timingHeader) headers.set(TTS_HEADERS.timing, timingHeader)
  return new Response(new Uint8Array(f.audio), { status: 200, headers })
})
