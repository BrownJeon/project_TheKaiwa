import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { forkSeedTopic, listTopics } from '@/modules/learning'
import { parseTopicForkBody, TOPIC_WRITE_PER_MINUTE, topicSaveWarnings } from '../../_lib/saveBody'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #174 시드 주제를 "내 버전"으로 복사해 저장(task-045 T1-3) — 편집 화면의 [저장] 때만 부른다(취소하면 사본이 남지 않는다).
 * 본문 = #57 과 같은 전체 입력(같은 검사), **빈 본문 `{}` = 시드 그대로 복사**. 사본이 생기면 원본 시드는 이 사용자 목록에서 가려진다.
 * 201 `{topic, warnings[], seedId, copyId, relinkedScenarioIds[]}`(`topic` = #56 항목 모양, 사본의 표현 진행은 0부터).
 * 오류: 400 칸(한도 미소모) · 404 `SEED_NOT_FOUND`(시드 아님·없음 — 내 주제는 #171) · 409 `ALREADY_COPIED`(이미 내 버전·숨김 — `state`)·`TOPIC_LIMIT`(30) ·
 * 429 `DAILY_LIMIT`(하루 10, #57 과 공유)·분당 20.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = parseTopicForkBody(await readJsonObject(req, 16 * 1024))
  rateLimit(`topic-write:${s.user.id}`, TOPIC_WRITE_PER_MINUTE)
  const fork = await forkSeedTopic(s.user.id, id, body as Record<string, unknown>)
  // 사본은 내 주제(≤30)라 내 것 전체 조회 한 번으로 #56 모양을 그대로 만든다.
  const topic = (await listTopics(s.user.id, { level: null, mine: true, allLevels: true })).items.find((t) => t.id === fork.copyId)
  if (!topic) throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.', { reason: 'TOPIC_GONE' })
  return ok({ topic, warnings: topicSaveWarnings(topic), seedId: fork.seedId, copyId: fork.copyId, relinkedScenarioIds: fork.relinkedScenarioIds }, null, { status: 201 })
})
