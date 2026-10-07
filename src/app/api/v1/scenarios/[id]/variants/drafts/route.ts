import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { draftScenarioVariant, readScenarioVariantBase, readScenarioVariantBody } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 엔진 상한 40s(1차+JSON 재시도) + AI 호출 슬롯 큐 대기 — #166 과 같은 벽시계.
export const maxDuration = 60

/** LLM 호출 한도 — 분당은 변형 따로, 하루는 #166 상황 초안과 **같은 카운터(같은 키·같은 상한 40)** 를 쓴다(Leader 확정). 저장 한도(#163 하루 30·상황 50)와 별개. */
const VARIANT_PER_MINUTE = 6
const SCENARIO_DRAFT_PER_DAY = 40

type Ctx = { params: Promise<{ id: string }> }

/**
 * #177 변형 상황 초안(task-045 T4, 변형 A, `scenarioVariant@v2`) — **행을 만들지 않는다**(저장은 학습자가 고친 뒤 #163).
 * 기준 상황 = 경로 `:id` — 내 상황 또는 가리지 않은 시드만(남의 것·없음·지운 것·가린 시드 404). 장소는 기준 상황의 것(가린 시드 주제 제외)을 이어받는다.
 * 본문 `{axes:{persona?, twist?, flow?, level?}, note?(≤100자)}`(그 밖 키 400) · 응답 200 `{draft, changedFields, axes}`.
 * 오류: 401 · 404 · 400 칸(한도 미소모) · 422 `NO_VARIATION`(바꿀 점 없음, 한도 미소모) · 422 `NOT_A_VARIANT`(같은 문구) · 409 `DRAFT_BUSY` · 429 · 502(쓸 수 없는 초안·엔진 오류) · 504(시간 초과).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const raw = await readJsonObject(req, 4 * 1024)
  const target = await readScenarioVariantBase(s.user.id, id)
  const body = readScenarioVariantBody(raw, target.base.level)
  // 칸 오류(400)·바꿀 점 없음(422)은 한도를 쓰지 않는다 — 한도는 LLM 을 부를 요청에만.
  rateLimit(`scenario-variant:${s.user.id}`, VARIANT_PER_MINUTE)
  rateLimit(`scenario-draft-day:${s.user.id}`, SCENARIO_DRAFT_PER_DAY, 86_400_000)
  return ok(await draftScenarioVariant(s.user.id, target, body), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
