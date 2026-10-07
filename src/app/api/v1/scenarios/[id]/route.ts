import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { archiveScenario, getScenarioDetail, hideSeed, updateScenario } from '@/modules/learning'
import { listOpenRolePlayChats } from '@/modules/conversation'
import type { ScenarioDeleteResult } from '@/types/seedOverride'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #162 상황 상세(역할·목표·대화 순서·핵심 표현·필수 수·첫마디). 시드·내 상황만 — 남의 상황·없음 404, 지운 상황 404 `ARCHIVED`. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await getScenarioDetail(s.user.id, id, undefined, { openChats: listOpenRolePlayChats }), null, { headers: { 'Cache-Control': 'private, no-store' } })
})

/** #164 내 상황 고치기 — 보낸 칸만. 시드 404 `SEED` · 남의 것 404 · 지운 상황 409 `ARCHIVED` · 400 `{field, reason, problems[]}`. 응답 = 상세. */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  rateLimit(`scenario-write:${s.user.id}`, 20)
  const { id } = await ctx.params
  return ok(await updateScenario(s.user.id, id, await readJsonObject(req, 16 * 1024), undefined, { openChats: listOpenRolePlayChats }))
})

/**
 * #165 상황 지우기. 내 상황 = ARCHIVED(목록에서 빠짐, 지난 역할극·기록은 그대로, 멱등) → 기존 응답 + `result:'ARCHIVED'`.
 * 시드 id(task-045) = 이 사용자 목록에서만 숨김(시드 행은 그대로, 멱등) → `{id, result:'HIDDEN', state, alreadyHidden}`. 남의 것·없음 404.
 */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  rateLimit(`scenario-write:${s.user.id}`, 20)
  const { id } = await ctx.params
  let result: ScenarioDeleteResult
  try {
    result = { ...(await archiveScenario(s.user.id, id)), result: 'ARCHIVED' }
  } catch (e) {
    // archiveScenario 는 접근 가능한 행 중 내 것이 아닌 것(= 시드)에만 `reason:'SEED'` 를 낸다 — 남의 상황·없는 id 는 그 전에 404.
    if (!(e instanceof ApiError && e.details?.reason === 'SEED')) throw e
    const hidden = await hideSeed(s.user.id, 'SCENARIO', id)
    result = { id, result: 'HIDDEN', state: hidden.state, alreadyHidden: !hidden.changed }
  }
  return ok(result)
})
