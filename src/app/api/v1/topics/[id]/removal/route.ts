import { ok, requireSession, withApi } from '@/modules/infra'
import { previewTopicRemoval } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #172 주제 지우기 확인 창 사전 조회(task-045 T3-2) — 읽기 전용(쓰기·한도 없음). 응답 = `TopicRemovalPreview`(`src/types/topic.ts`):
 * 맨 위 값 = "지우기"(#173) 창, `restore` = 내 버전일 때만 "기본으로 되돌리기"(#176) 창, `ack` 는 두 요청에 그대로 보낸다.
 * 시드 id 는 `isSeed:true`(지우기 = 숨김, 상황 목록 빈 배열). 남의·없는 주제 404 `TOPIC_GONE`.
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await previewTopicRemoval(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
