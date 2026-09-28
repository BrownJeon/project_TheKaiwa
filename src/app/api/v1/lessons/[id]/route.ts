import { ok, requireSession, withApi } from '@/modules/infra'
import { getLesson } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #60 레슨 상세 — 소유자만(타인·없음 404). `content` 는 A4 JSON + 대화 줄 `segment`(청취 구간), `quiz[].answer` 포함(자습 — 완료 때 서버가
 * 다시 채점). 모델·프롬프트 버전·붙여 넣은 원문은 싣지 않는다. GENERATING 이면 `jobId`, 잡이 죽었으면 FAILED 로 닫아 돌려준다.
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await getLesson(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
