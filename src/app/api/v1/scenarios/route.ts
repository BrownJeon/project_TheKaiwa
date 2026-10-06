import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createScenario, listScenarios, parseScenarioListQuery } from '@/modules/learning'
import { listOpenRolePlayChats } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #161 상황 목록 `?topicId=&level=&recommended=1&mine=1&limit=&cursor=` — 시드 + 내 상황(ACTIVE 만), 남의 상황 0.
 * 응답 `{items[], nextCursor, recommendedIds[]}` — 추천(≤3)은 코드 규칙(LLM 0), `recommended=1` 이면 추천만 추천 순서로.
 * `inProgressChatId`(끝내지 않은 최근 역할극)는 conversation 후보를 learning 이 거른다(task-010d A3b — 라우트가 조합, L3 는 Chat 을 읽지 않음).
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await listScenarios(s.user.id, parseScenarioListQuery(req.nextUrl.searchParams), undefined, { openChats: listOpenRolePlayChats }), null, { headers: { 'Cache-Control': 'private, no-store' } })
})

/**
 * #163 내 상황 만들기 — 학습자가 [저장]할 때만(제안→채택). 본문 = AI 초안 모양(`ScenarioInput`, `src/types/scenario.ts`).
 * 400 `{field, reason, problems[]}` · 409 `SCENARIO_LIMIT`(ACTIVE 50) · 429 `DAILY_LIMIT`(하루 30)·분당 20. 응답 = #162 상세.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`scenario-write:${s.user.id}`, 20)
  return ok(await createScenario(s.user.id, await readJsonObject(req, 16 * 1024), undefined, { openChats: listOpenRolePlayChats }), null, { status: 201 })
})
