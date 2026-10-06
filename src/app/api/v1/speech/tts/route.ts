import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseTtsRequest, signTtsAudioToken, synthesizeSentence } from '@/modules/speech'
import { ttsAudioResponse, ttsError } from '../_lib/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #23 문장 → 음성(단일 세그먼트·동기). 정규화·발음 사전·Rendering Plan·캐시(12요소)를 거쳐 `audio/wav` 본문을 준다.
 * `Accept: application/json` 이면 본문 대신 #24 서명 URL(10분)·길이·실행 모드 JSON(task-007 — 다시 듣기 프리페치용).
 * 단어 timing(task-012b-4, 요청 `text` 기준 코드포인트): wav 는 헤더 `X-Tts-Timing`(≤3KB), JSON 은 `timing` — 없으면 헤더 없음·null(정상).
 * 사용자당 60/분. 엔진 수치는 받지 않는다(라벨만). `chatMessageId` 는 형식만 확인한다.
 * 오류: 400 VALIDATION · 422 ENGINE_UNAVAILABLE(details.reason TTS_UNAVAILABLE, 자막만) · 502 · 504(문장 8초).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`tts:${s.user.id}`, 60)
  const body = parseTtsRequest(await readJsonObject(req, 8 * 1024))
  try {
    const r = await synthesizeSentence({
      userId: s.user.id,
      text: body.text,
      voiceId: body.voiceId,
      speechProfile: body.speechProfile,
      requested: body.requested,
      styleHint: body.styleHint,
      scope: { lessonId: body.lessonId, topicId: body.topicId },
      trace: { refType: 'speechTts' },
    })
    if ((req.headers.get('accept') ?? '').includes('application/json')) {
      // timing = 요청 text 기준(task-012b-4) — 같은 값을 토큰에 묶어 #24 헤더로도 나간다.
      const signed = signTtsAudioToken(s.user.id, r.cacheKey, { timing: r.timing })
      return ok(
        {
          url: signed.url,
          cacheKey: r.cacheKey,
          cached: r.cached,
          durationMs: r.durationMs,
          ttfaMs: r.ttfaMs,
          normalizedText: r.normalizedText,
          dictionaryVersion: r.dictionaryVersion,
          modelVersion: r.modelVersion,
          timing: r.timing,
          runtime: { executionMode: 'SERVER' },
          traceId: r.traceId,
        },
        null,
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    }
    return ttsAudioResponse(r)
  } catch (e) {
    throw ttsError(e)
  }
})
