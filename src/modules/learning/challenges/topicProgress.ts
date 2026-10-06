/**
 * #157 `topicProgress` — 이 주제의 **지금 상태 읽기**(기간 집계 아님, 챌린지 전 공부 포함 — 설계서 §6-1·§6-3).
 *  - 기본 표현: 분모 = 폭 필터 뒤 `TopicChunk` 수(풀과 같은 값), 공부·익힘 = 그 조각의 `RepetitionItem('TopicChunk', id)`
 *  - 수업 표현 수 = 풀의 `lessonExprCount`(이 주제로 끝낸 새 수업의 기본 밖 표현, 최근 60개 수업)
 *  - 이 주제 수업 수 = `topics.doneLessonStats`(#56 주제 카드의 "끝낸 수업 수"와 같은 값)
 *  - 새 단어: 이 주제로 받은 `AiWord` 카드의 서로 다른 키 + 그 키의 반복 항목(카드 → 반복 키는 `repetitionKeyOfCard` — `Expr`)
 * 익힘 = correctCount ≥ 2 && correctCount > wrongCount · 공부 = studiedCount ≥ 1.
 * 풀·카드 출처 상수·키 변환은 `../topics/pool` 이 단일 출처다(같은 표현이 반복 항목 두 행으로 갈라지지 않게 — REV-113 M-4).
 */
import type { ChallengeTopicProgress } from '@/types/challenge'
import { CARD_REF_AI_WORD, CARD_REF_TOPIC_CHUNK, loadTopicPool, repetitionKeyOfCard, topicAiWords } from '../topics/pool'
import type { ChallengeDeps } from './store'

const studied = (r: { studiedCount: number }) => r.studiedCount >= 1
const mastered = (r: { correctCount: number; wrongCount: number }) => r.correctCount >= 2 && r.correctCount > r.wrongCount

export async function challengeTopicProgress(deps: ChallengeDeps, userId: string, topicId: string): Promise<ChallengeTopicProgress> {
  const db = deps.db
  const [pool, aiWords, lessonsDone] = await Promise.all([loadTopicPool(db, userId, topicId), topicAiWords(db, userId, topicId), deps.doneLessonCount(userId, topicId)])
  const chunkIds = pool.entries.filter((e) => e.origin === 'TOPIC').map((e) => e.refId)
  const aiKeys = aiWords.map((w) => repetitionKeyOfCard(CARD_REF_AI_WORD, w.refId))
  const aiRefType = aiKeys[0]?.refType ?? repetitionKeyOfCard(CARD_REF_AI_WORD, '').refType
  const or = [
    ...(chunkIds.length ? [{ refType: CARD_REF_TOPIC_CHUNK, refId: { in: chunkIds } }] : []),
    ...(aiKeys.length ? [{ refType: aiRefType, refId: { in: aiKeys.map((k) => k.refId) } }] : []),
  ]
  const items = or.length
    ? await db.repetitionItem.findMany({ where: { userId, OR: or }, select: { refType: true, refId: true, studiedCount: true, correctCount: true, wrongCount: true } })
    : []
  const chunkSet = new Set(chunkIds)
  const aiSet = new Set(aiKeys.map((k) => k.refId))
  const chunkItems = items.filter((r) => r.refType === CARD_REF_TOPIC_CHUNK && chunkSet.has(r.refId))
  const aiItems = items.filter((r) => r.refType === aiRefType && aiSet.has(r.refId))
  return {
    chunkTotal: pool.chunkTotal,
    chunkStudied: chunkItems.filter(studied).length,
    chunkMastered: chunkItems.filter(mastered).length,
    lessonExprCount: pool.lessonExprCount,
    lessonsDone,
    aiWordTotal: aiSet.size,
    aiWordStudied: aiItems.filter(studied).length,
    aiWordMastered: aiItems.filter(mastered).length,
  }
}
