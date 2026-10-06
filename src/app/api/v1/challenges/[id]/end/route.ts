import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { endChallenge, parseEndChallengeBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #159 그만두기 — ACTIVE → ENDED(결과 얼림·`activeKey` 비움). 이미 ENDED 면 같은 응답(멱등), 기간이 끝난 챌린지는 409 NOT_ACTIVE. 없거나 남의 것 404. */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  parseEndChallengeBody(await readJsonObject(req, 1024))
  return ok(await endChallenge(s.user.id, id))
})
