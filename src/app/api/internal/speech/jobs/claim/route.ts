import { ok, rateLimit, readJsonObject, withApi } from '@/modules/infra'
import { claimAnalysisJobs, parseClaimBody } from '@/modules/speech'
import { notFound, rejectUnlessWorker } from '../../_lib/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #139 worker 잡 클레임(api-contract §2-28, task-012b D-B1) — `{workerId, kinds[], max(1~2)}` → `{jobs:[{id, kind, utteranceId, audioPath, realtimeText,
 * recognitionMode, attempts}]}`. 한 트랜잭션에서 고아 회수(15분) → `FOR UPDATE SKIP LOCKED` → RUNNING·attempts+1. 받은 시각이 워커 하트비트
 * (적재 게이트 120초·/api/health). APP_ENV ≠ PRODUCTION 앱은 QA 계정 발화 잡만(D-B11). 인증은 `_lib/worker`. 본문 ≤4KB, 600/분.
 */
export const POST = withApi(async (req) => {
  const denied = rejectUnlessWorker(req.headers)
  if (denied) return denied
  rateLimit('internal:speech-jobs-claim', 600)
  const input = parseClaimBody(await readJsonObject(req, 4 * 1024))
  return ok(await claimAnalysisJobs(input))
})

export const GET = async () => notFound()
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
