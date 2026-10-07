import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { forkSeedScenario, getScenarioDetail, normalizeScenarioInput } from '@/modules/learning'
import { listOpenRolePlayChats } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #175 시드 상황을 "내 버전"으로 복사해 저장(task-045 T1-3) — 편집 화면의 [저장] 때만. 본문 = #164 와 같은 칸·같은 검사(빠진 칸은 시드 값),
 * **빈 본문 `{}` = 시드 그대로 복사**. 장소(`topicIds`)는 #163 과 같은 검사(가린 시드 주제 400 `not_linked` — 내 버전 주제 id 를 보낸다).
 * 201 = #162 상세(사본, `#163` 응답과 같은 모양). 사본이 생기면 원본 시드는 이 사용자 목록에서 가려진다.
 * 오류: 400 `{field, reason, problems[]}`(칸 모양은 한도 미소모) · 404 `SEED_NOT_FOUND` · 409 `ALREADY_COPIED`·`SCENARIO_LIMIT`(ACTIVE 50) ·
 * 429 `DAILY_LIMIT`(하루 30, #163 과 공유)·분당 20(#163·#164·#165 와 같은 `scenario-write` 키).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = await readJsonObject(req, 16 * 1024)
  if (Object.keys(body).length) {
    const { problems } = normalizeScenarioInput(body, 'patch')
    if (problems.length) throw new ApiError('VALIDATION', problems[0].message, { field: problems[0].field, reason: problems[0].reason, problems })
  }
  rateLimit(`scenario-write:${s.user.id}`, 20)
  const fork = await forkSeedScenario(s.user.id, id, body)
  return ok(await getScenarioDetail(s.user.id, fork.copyId, undefined, { openChats: listOpenRolePlayChats }), null, { status: 201 })
})
