import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { revealEvaluationItemText } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; itemId: string }> }

/**
 * #67c 듣고 답하기 "글자로 보기"(task-011 데모 결정 b=B) — 본문 `{}`. 푸는 도중 선생님 목소리가 끊겼거나 소리를 받지 못한 문항만
 * 화면이 부른다. 들려줄 문장을 돌려주고 `EvaluationItem.textRevealedAt` 에 처음 공개 시각을 남긴다(결과의 "글자로 봤어요", 멱등).
 * 소유자만(타인·없음 404), READY·IN_PROGRESS 만(그 밖 409), 듣기 문항이 아니면 400. 응답 `{itemId, textJa, textRevealed:true, textRevealedAt}`.
 * 사용자당 분당 30.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id, itemId } = await ctx.params
  rateLimit(`eval-reveal:${userId}`, 30)
  const body = await readJsonObject(req, 1024)
  const extra = Object.keys(body)
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  return ok(await revealEvaluationItemText(userId, id, itemId), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
