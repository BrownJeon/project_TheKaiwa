/**
 * 발화 인식 신뢰도(task-010b — 학습 관측 `confidence` 재료, learning-personalization §2-2): 사용자가 고친·확정한 글자(`finalSource=USER`) 1.0 ·
 * 재확인이 필요한데 아직 확정 안 됨(`requiresReview` + 실시간 인식 그대로) 0.5 · 그 밖은 분석 STT 와의 일치도(`transcriptConfidence`, 아직
 * 분석 전이면 1.0). learning 은 speech 를 모르므로 라우트가 이 함수를 레슨 완료에 넘긴다. 소유자 것만(남의 id 는 빠진다).
 */
import { prisma } from '@/modules/infra'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/

export function utteranceConfidenceOf(u: { transcriptConfidence: number | null; requiresReview: boolean; finalSource: string }): number {
  if (u.finalSource === 'USER') return 1
  if (u.requiresReview && u.finalSource === 'REALTIME') return 0.5
  const c = u.transcriptConfidence
  return typeof c === 'number' && Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 1
}

export async function utteranceConfidences(userId: string, ids: readonly string[]): Promise<Map<string, number>> {
  const valid = [...new Set(ids)].filter((id) => ID_RE.test(id)).slice(0, 50)
  if (!valid.length || !userId) return new Map()
  const rows = await prisma.utterance.findMany({ where: { userId, id: { in: valid } }, select: { id: true, transcriptConfidence: true, requiresReview: true, finalSource: true } })
  return new Map(rows.map((r) => [r.id, utteranceConfidenceOf(r)]))
}
