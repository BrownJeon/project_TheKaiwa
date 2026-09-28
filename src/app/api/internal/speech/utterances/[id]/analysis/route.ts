import { ok, rateLimit, readJsonObject, withApi } from '@/modules/infra'
import { applyAnalysisResult, parseAnalysisBody } from '@/modules/speech'
import { notFound, rejectUnlessWorker } from '../../../_lib/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #138 분석 결과 저장(api-contract §2-28, task-012b D-B5) — worker 가 similarity·flags 를 보내면 **앱이** requiresReview 를 판정하고 한 트랜잭션에서
 * Utterance(ANALYZED)·SpeechAnalysis·SpeechJob DONE. `finalText`·`finalSource` 는 바꾸지 않는다. 이미 분석됨 `200 {stored:false, reason:"ALREADY_ANALYZED"}`,
 * jobId 가 이 발화의 잡이 아님 404. (Phase 3: 여기서 learning.recordErrorStat 을 순서대로 부른다 — 지금은 발음 분석 없음.)
 * 로그에는 id·판정 값만(전사 원문 없음). 본문 ≤256KB, 600/분.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const denied = rejectUnlessWorker(req.headers)
  if (denied) return denied
  rateLimit('internal:speech-analysis', 600)
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return notFound()
  const input = parseAnalysisBody(await readJsonObject(req, 256 * 1024))
  const r = await applyAnalysisResult(id, input)
  console.info(`[speech] 분석 결과 utterance=${id} stored=${r.stored} confidence=${r.transcriptConfidence ?? '-'} review=${r.requiresReview} latencyMs=${input.latencyMs ?? '-'}`)
  return ok(r)
})

export const GET = async () => notFound()
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
