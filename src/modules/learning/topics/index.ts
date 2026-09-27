/**
 * 주제 — task-006 은 대화 생성 시 `topicId` 확인용 읽기 하나만(시드 주제 또는 내 주제). 목록·생성은 Phase 2(task-010).
 */
import { prisma } from '@/modules/infra'

export async function getTopicRef(userId: string, topicId: string): Promise<{ id: string; title: string } | null> {
  if (typeof topicId !== 'string' || !topicId || topicId.length > 40) return null
  return prisma.conversationTopic.findFirst({ where: { id: topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true } })
}
