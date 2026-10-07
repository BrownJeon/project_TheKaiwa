import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { updateUserTopic } from '@/modules/learning'
import { parseTopicUpdateBody, TOPIC_WRITE_PER_MINUTE, topicSaveWarnings } from '../_lib/saveBody'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #171 내 주제 고치기(task-045 T2) — 보낸 칸만. `chunks` 를 보내면 그 목록이 새 전체 목록(`id` 있는 표현은 유지·수정, 없는 것은 새로, 빠진 기존 표현은 삭제).
 * 200 `{topic, warnings[]}` · 400 칸 문제(한도 미소모)·`chunks[i].id not_found|duplicate` · 404 `TOPIC_GONE`(남의·없는 주제) · 409 `USE_FORK`(시드 — #174 사본으로 고치기) · 429 분당 20.
 * (#173 DELETE 는 같은 파일에 더한다.)
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const input = parseTopicUpdateBody(await readJsonObject(req, 16 * 1024))
  rateLimit(`topic-write:${s.user.id}`, TOPIC_WRITE_PER_MINUTE)
  const topic = await updateUserTopic(s.user.id, id, input)
  return ok({ topic, warnings: topicSaveWarnings(topic) })
})
