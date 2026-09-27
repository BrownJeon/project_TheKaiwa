import { ok, readJsonObject, withApi } from '@/modules/infra'
import { previewLexiconDto, previewLexiconWav, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 저장 전 미리듣기 — `{text(≤200), voiceId?, draftEntries?[≤20], compare?, side?}`.
 *   JSON(기본): before(지금 사전)·after(compare:true — 지금 사전 + 초안)의 읽기·악센트·matches. 관리자당 분당 10.
 *   `Accept: audio/wav` + `side: before|after`: 그 쪽을 합성한 WAV(봉투 없음). 관리자당 분당 10(따로).
 * 저장·버전·TtsCache 변화 0(캐시 우회). Trace PLAYGROUND(`lexiconPreview`).
 */
export const POST = withApi(async (req) => {
  const actor = await requireCapability('voices.manage')
  const body = await readJsonObject(req, 16 * 1024)
  if ((req.headers.get('accept') ?? '').includes('audio/wav')) {
    const a = await previewLexiconWav(actor, body)
    const headers = new Headers({ 'Content-Type': 'audio/wav', 'Content-Length': String(a.audio.length), 'Cache-Control': 'private, no-store', 'X-Trace-Id': a.traceId, 'X-Lexicon-Dictionary-Version': String(a.dictionaryVersion) })
    if (a.durationMs !== null) headers.set('X-Tts-Duration-Ms', String(a.durationMs))
    return new Response(new Uint8Array(a.audio), { status: 200, headers })
  }
  return ok(await previewLexiconDto(actor, body), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
