import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getEvaluationListenSource } from '@/modules/learning'
import { synthesizeEvaluationClips } from '@/modules/speech'
import { ttsError } from '../../../../../speech/_lib/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/**
 * #67a 듣고 답하기 소리(task-011) — 본문 `{}`. #66 은 들려줄 문장을 글자로 주지 않으므로(`textHidden`) 재생할 때 여기서 받는다
 * (레슨 #62c 와 같은 파이프라인·12요소 캐시·조각별 #24 서명 URL 10분). learning 이 소유(404)·상태(READY 이후, 아니면 409)·
 * 듣기 문항인가(아니면 400)를 정하고 speech 가 LEARNING_NORMAL·문맥 EVAL 로 합성한다.
 * 응답 `{itemId, clips:[{url, durationMs, pauseBeforeMs, cached}], runtime:{executionMode:'SERVER'}}` — 문장 글자·엔진명 없음.
 * 서버 TTS 불가면 422 ENGINE_UNAVAILABLE(details.reason TTS_UNAVAILABLE). 다시 듣기 횟수 제한(데모 결정 (e))은 화면 몫. 사용자당 분당 60(#23 과 공유).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id, itemId } = await ctx.params
  rateLimit(`tts:${userId}`, 60)
  const body = await readJsonObject(req, 1024)
  const extra = Object.keys(body)
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  const src = await getEvaluationListenSource(userId, id, itemId)
  try {
    const r = await synthesizeEvaluationClips({ userId, text: src.text, evaluationId: id, topicId: src.topicId })
    return ok({ itemId, clips: r.clips, runtime: { executionMode: 'SERVER' } }, null, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    throw ttsError(e)
  }
})
