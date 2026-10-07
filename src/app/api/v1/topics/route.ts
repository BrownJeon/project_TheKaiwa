import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createUserTopic, listTopics, parseTopicQuery } from '@/modules/learning'
import { parseTopicCreateBody, TOPIC_WRITE_PER_MINUTE, topicSaveWarnings } from './_lib/saveBody'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #56 주제 목록 — 시드 + 내 주제(`mine=1` 이면 내 것만), 조각 포함. `level` 없으면 학습자 수준 ±1, `level=all` 이면 다섯 수준 전부(관리 화면, task-045).
 * `lessonCount`·`lastLessonAt` 은 **끝낸** 레슨 기준. 응답 `{items, level[]}`(level = 실제로 적용한 수준 목록).
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await listTopics(s.user.id, parseTopicQuery(req.nextUrl.searchParams)))
})

/**
 * #57 내 주제 만들기(task-045 T2) — 학습자가 AI 초안(#170)을 검토·수정해 [저장]할 때만(제안→채택). 본문 `{title, titleJa?, level, description?, chunks[8~20]{chunkType,textJa,reading,meaningKo}}`.
 * 201 `{topic, warnings[]}`(`topic` = #56 항목 모양) · 400 `{field, reason, problems[]}`(한도 미소모) · 409 `TOPIC_LIMIT`(내 주제 30) · 429 `DAILY_LIMIT`(하루 10, KST)·분당 20.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const input = parseTopicCreateBody(await readJsonObject(req, 16 * 1024))
  rateLimit(`topic-write:${s.user.id}`, TOPIC_WRITE_PER_MINUTE)
  const topic = await createUserTopic(s.user.id, input)
  return ok({ topic, warnings: topicSaveWarnings(topic) }, null, { status: 201 })
})
