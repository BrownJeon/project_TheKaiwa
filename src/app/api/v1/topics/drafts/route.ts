import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { draftTopic, readTopicDraftBody } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 엔진 상한 40s(1차+JSON 재시도) + AI 호출 슬롯 큐 대기 — #166 과 같은 벽시계.
export const maxDuration = 60

/** LLM 호출 한도(계약 §0 #8) — 저장 한도(#57 분당 20·하루 10)와 별개. */
const DRAFT_PER_MINUTE = 6
const DRAFT_PER_DAY = 20

/**
 * #170 AI 주제 초안(task-045 T2, `topicDraft@v2`) — **행을 만들지 않는다**(저장은 학습자가 고친 뒤 #57).
 * 본문 `{title(2~40자), level?(없으면 학습자 수준), note?(≤200자)}`(그 밖 키 400) · 응답 200 `{draft, warnings[]}`.
 * 오류: 401 · 400 칸(한도 미소모) · 422 `NOT_A_TOPIC`(주제가 아닌 글·부적절한 글, 같은 문구) · 409 `DRAFT_BUSY`(동시 1건) · 429(분당 6·하루 20) · 502(쓸 수 없는 초안·엔진 오류·시간 초과, 같은 문구).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const body = await readTopicDraftBody(s.user.id, await readJsonObject(req, 4 * 1024))
  // 칸 오류(400)는 한도를 쓰지 않는다 — 한도는 LLM 을 부를 요청에만.
  rateLimit(`topic-draft:${s.user.id}`, DRAFT_PER_MINUTE)
  rateLimit(`topic-draft-day:${s.user.id}`, DRAFT_PER_DAY, 86_400_000)
  return ok(await draftTopic(s.user.id, body), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
