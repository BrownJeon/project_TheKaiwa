/**
 * 학습 자원 id 존재 확인(읽기 전용) — 다른 층이 주제·레슨 id 를 참조로 받을 때(발음 사전 COURSE·LESSON 범위, task-003g) 쓴다.
 * 소유자와 무관하게 "있는가" 만 본다(관리자 참조 검증용 — 사용자 API 에서 쓰지 않는다).
 */
import { prisma } from '@/modules/infra'

export async function topicExists(topicId: string): Promise<boolean> {
  if (!topicId || topicId.length > 40) return false
  return (await prisma.conversationTopic.count({ where: { id: topicId } })) > 0
}

export async function lessonExists(lessonId: string): Promise<boolean> {
  if (!lessonId || lessonId.length > 40) return false
  return (await prisma.lesson.count({ where: { id: lessonId } })) > 0
}
