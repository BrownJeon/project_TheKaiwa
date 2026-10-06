import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { archiveScenario, getScenarioDetail, updateScenario } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #162 상황 상세(역할·목표·대화 순서·핵심 표현·필수 수·첫마디). 시드·내 상황만 — 남의 상황·없음 404, 지운 상황 404 `ARCHIVED`. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await getScenarioDetail(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})

/** #164 내 상황 고치기 — 보낸 칸만. 시드 404 `SEED` · 남의 것 404 · 지운 상황 409 `ARCHIVED` · 400 `{field, reason, problems[]}`. 응답 = 상세. */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  rateLimit(`scenario-write:${s.user.id}`, 20)
  const { id } = await ctx.params
  return ok(await updateScenario(s.user.id, id, await readJsonObject(req, 16 * 1024)))
})

/** #165 내 상황 지우기 = ARCHIVED(목록에서 빠짐, 지난 역할극·기록은 그대로). 멱등. 시드 404 `SEED` · 남의 것 404. */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  rateLimit(`scenario-write:${s.user.id}`, 20)
  const { id } = await ctx.params
  return ok(await archiveScenario(s.user.id, id))
})
