/**
 * 평가 말하기 문항의 채점 텍스트 선택(api-contract #67 옆 D-B7, task-012b) — learning 은 speech 를 import 하지 않으므로 #68 라우트가 이 함수를
 * 채점 콜백으로 **주입**한다. 채점 잡이 시작하는 시점에 한 번 읽는다(분석을 기다리지 않음). 규칙은 `policy.pickGradingText`.
 * 한 문항에 발화가 여럿 붙을 수 있어(같은 문항 재답) 저장된 답과 텍스트가 맞는 발화만 보고, 여럿이면 가장 최근 것.
 */
import { prisma } from '@/modules/infra'
import { answerCameFrom, pickGradingText, type GradingText, type ReviewSnapshot } from './policy'

export type { GradingText } from './policy'

const MAX_ITEMS = 50

export async function pickGradingTexts(userId: string, items: readonly { evaluationItemId: string; answerText: string }[]): Promise<Map<string, GradingText>> {
  const out = new Map<string, GradingText>()
  const ids = [...new Set(items.map((i) => i.evaluationItemId))].slice(0, MAX_ITEMS)
  if (ids.length === 0) return out
  const rows = await prisma.utterance.findMany({
    where: { userId, evaluationItemId: { in: ids } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      evaluationItemId: true,
      status: true,
      requiresReview: true,
      finalText: true,
      finalSource: true,
      realtimeText: true,
      analysisText: true,
      transcriptConfidence: true,
      analysis: { select: { engineVersions: true } },
    },
  })
  for (const item of items) {
    const u = rows.find((r) => r.evaluationItemId === item.evaluationItemId && answerCameFrom(item.answerText, r))
    if (!u) continue
    const snap = (u.analysis?.engineVersions ?? null) as ReviewSnapshot | null
    const pick = pickGradingText({ ...u, snapshot: snap && typeof snap === 'object' && !Array.isArray(snap) ? snap : null })
    if (pick) out.set(item.evaluationItemId, pick)
  }
  return out
}
