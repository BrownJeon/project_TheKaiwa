import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createVocabSession, listVocabSessions, parseCreateSessionBody, parseSessionListQuery } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #48 세트 목록 — `startedAt desc`, `kept`·`status` 필터, 항목별 `answeredCount`. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  return ok(await listVocabSessions(s.user.id, parseSessionListQuery(q, parseLimit(q.get('limit'), 20, 100))))
})

/** #47 세트 생성 — 정답 미포함(CHOICE). 장수 생략 시 `Profile.dailyWordCount`. 진행 중 세트가 있으면 409 `{sessionId}`. */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const input = parseCreateSessionBody(await readJsonObject(req))
  const count = input.count ?? (await getProfile(s.user.id)).dailyWordCount
  return ok(await createVocabSession(s.user.id, { count, mode: input.mode, category: input.category }))
})
