import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { draftScenario, parseScenarioDraftBody } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 엔진 상한 40s(1차+JSON 재시도) + 큐 대기 — 플랫폼 상한이 있는 배포에서도 끊기지 않게(자체 호스팅 next start 는 상한 없음).
export const maxDuration = 60

/** LLM 호출 한도 — #163 저장 한도(분당 20·하루 30)와 별개. 초안은 balanced 단건이라 분당 6. */
const DRAFT_PER_MINUTE = 6
const DRAFT_PER_DAY = 40

/**
 * #166 AI 상황 초안(task-010d A3b-2, 가이드 S3) — **행을 만들지 않는다**(저장은 학습자가 고친 뒤 #163).
 * 본문 `{description(5~300자), level, topicId?}`(그 밖 키 400) · 응답 200 `{draft}`(= #163 본문 모양 `ScenarioInput`, 표현 id 없음, 장소를 골랐으면 `topicIds`).
 * 오류: 401 · 400 칸(`description`·`level`·`topicId` — 남의·없는 장소 `not_found`) · 422 `NOT_A_SCENARIO`(상황이 아닌 글·안전하지 않은 글, 같은 문구) ·
 * 409 `DRAFT_BUSY` · 429 · 502/504(엔진 실패·시간 초과·쓸 수 없는 초안).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const body = parseScenarioDraftBody(await readJsonObject(req, 4 * 1024))
  // 칸 오류(400)는 한도를 쓰지 않는다 — 한도는 LLM 을 부를 요청에만.
  rateLimit(`scenario-draft:${s.user.id}`, DRAFT_PER_MINUTE)
  rateLimit(`scenario-draft-day:${s.user.id}`, DRAFT_PER_DAY, 86_400_000)
  return ok(await draftScenario(s.user.id, body), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
