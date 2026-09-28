import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getLessonAudioSource, parseAudioBody } from '@/modules/learning'
import { synthesizeLessonClips } from '@/modules/speech'
import { ttsError } from '../../../speech/_lib/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #62c 레슨 오디오(task-010 L2) — `{kind:'dialogue'|'grammar'|'application'|'speaking', idx, pace:'slow'|'normal'}`.
 * learning 이 소유(404)·상태(409)·문장(범위 밖 400)을 정하고, speech 가 #23 과 같은 파이프라인·12요소 캐시로 합성해 조각별 #24 서명 URL(10분)을 준다.
 * slow = LEARNING_SLOW(사용자 learningSpeed), normal = LEARNING_NORMAL. 응답 `{kind, idx, pace, clips:[{url, durationMs, pauseBeforeMs, cached}],
 * runtime:{executionMode:'SERVER'}}` — 엔진명 없음. 서버 TTS 불가면 422 ENGINE_UNAVAILABLE(details.reason TTS_UNAVAILABLE, 자막만). 사용자당 분당 60(#23 과 공유).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`tts:${userId}`, 60)
  const body = parseAudioBody(await readJsonObject(req, 2 * 1024))
  const src = await getLessonAudioSource(userId, id, body)
  try {
    const r = await synthesizeLessonClips({ userId, text: src.text, pace: body.pace, lessonId: id, topicId: src.topicId })
    return ok({ kind: body.kind, idx: body.idx, pace: body.pace, clips: r.clips, runtime: { executionMode: 'SERVER' } }, null, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    throw ttsError(e)
  }
})
