import { ok, rateLimit, readJsonObject, withApi } from '@/modules/infra'
import { parseFailureBody, reportJobFailure } from '@/modules/speech'
import { notFound, rejectUnlessWorker } from '../../../_lib/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #140 잡 실패 보고(api-contract §2-28, task-012b D-B10) — `{workerId, status:'FAILED', error(코드값), retryable}` → `{ok:true, jobStatus}`.
 * 펜싱: RUNNING·lockedBy=workerId 가 아니면 409 STALE_CLAIM(회수된 잡 — worker 는 무시). 재시도면 QUEUED(30s·2m·10m), 아니면 FAILED + 발화 FAILED.
 * 성공은 이 경로를 쓰지 않는다(#138). 비운영 앱은 QA 계정 잡만(그 밖 404). 본문 ≤4KB, 600/분.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const denied = rejectUnlessWorker(req.headers)
  if (denied) return denied
  rateLimit('internal:speech-jobs-result', 600)
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return notFound()
  const input = parseFailureBody(await readJsonObject(req, 4 * 1024))
  return ok(await reportJobFailure(id, input))
})

export const GET = async () => notFound()
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
