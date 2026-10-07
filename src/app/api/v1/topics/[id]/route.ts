import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseTopicRemovalAck, removeUserTopic, updateUserTopic } from '@/modules/learning'
import { parseTopicUpdateBody, TOPIC_WRITE_PER_MINUTE, topicSaveWarnings } from '../_lib/saveBody'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #171 내 주제 고치기(task-045 T2) — 보낸 칸만. `chunks` 를 보내면 그 목록이 새 전체 목록(`id` 있는 표현은 유지·수정, 없는 것은 새로, 빠진 기존 표현은 삭제).
 * 200 `{topic, warnings[]}` · 400 칸 문제(한도 미소모)·`chunks[i].id not_found|duplicate` · 404 `TOPIC_GONE`(남의·없는 주제) · 409 `USE_FORK`(시드 — #174 사본으로 고치기) · 429 분당 20.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const input = parseTopicUpdateBody(await readJsonObject(req, 16 * 1024))
  rateLimit(`topic-write:${s.user.id}`, TOPIC_WRITE_PER_MINUTE)
  const topic = await updateUserTopic(s.user.id, id, input)
  return ok({ topic, warnings: topicSaveWarnings(topic) })
})

/**
 * #173 주제 지우기(task-045 T3-2) `?ack=<activeChallengeId|none>` — 값은 #172 사전 조회 응답의 `ack` 그대로.
 * 내 주제(내 버전 포함) = 한 트랜잭션 삭제(진행 중 챌린지 행 삭제·끝난 챌린지 유지·그 주제에만 붙은 내 상황 보관) → 200 `result:'REMOVED'`·`mode:'DELETE'`.
 * 시드 id = 이 사용자 목록에서만 숨김(`ack` 무시, 진행 중 챌린지 계속) → 200 `result:'HIDDEN'`.
 * 오류: 400 `VALIDATION` `field:'ack'`(형식, 한도 미소모) · 404 `TOPIC_GONE` · 409 `CONFLICT` `reason:'IMPACT_CHANGED'` + `details.preview`(확인 창을 새 값으로 다시 연다) · 429 분당 20.
 */
export const DELETE = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const ack = parseTopicRemovalAck(new URL(req.url).searchParams.get('ack'))
  rateLimit(`topic-write:${s.user.id}`, TOPIC_WRITE_PER_MINUTE)
  return ok(await removeUserTopic(s.user.id, id, { ack }))
})
