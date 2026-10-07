/**
 * #57 내 주제 만들기(task-045 T2) — 학습자가 AI 초안(#170)을 검토·수정해 [저장]할 때만 행이 생긴다(제안→채택).
 * 한 트랜잭션 · 사용자 행 잠금 뒤 한도 판정 → `ConversationTopic`(`userId=U`·`isSeed=false`·`tags` 없음) + `TopicChunk`(`order` = 배열 인덱스).
 *
 * - 내용 검사(이모지 접합 문자만 허용·꺾쇠·URL·비밀 모양·읽기 대조·중복)는 라우트가 conversation 검사로 **먼저** 한다(L3 는 L2 를 import 하지 않는다).
 *   여기서는 DB 칸 폭(`normalizeTopicInput`)·표현 수(8~20)·읽기 필수만 다시 본다(백스톱).
 * - 한도: 내 주제(사본 포함) ≥30 → 409 `TOPIC_LIMIT` · 오늘(KST) 만든 내 주제 ≥10 → 429 `DAILY_LIMIT` — 시드 사본(#174 `forkSeedTopic`)과 같은 계산·같은 문구라
 *   두 경로가 한 한도를 나눠 쓴다. 하드 삭제한 주제는 세지 못한다(만들고 지우기로 하루 한도를 넘을 수 있음 — 알려진 한계, 막으려면 새 기록이 필요하고 미승인).
 * - 같은 제목은 막지 않는다(상황 #163 도 제목 중복을 막지 않는다 — 시드 사본과 새 주제가 같은 이름일 수 있다).
 */
import { ApiError, dates, lockUserRow, prisma, withTransaction, type Tx } from '@/modules/infra'
import { TOPIC_LIMITS } from '@/types/topic'
import { TOPIC_SAVE_LIMITS, type TopicCreateInput, type TopicSaveChunk } from '@/types/topicWrite'
import { normalizeTopicInput } from '../seedOverride/topicInput'
import { doneLessonStats, lastDoneLessonTitles, type TopicChunkDto, type TopicDto } from './index'

export interface TopicWriteDeps {
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
  lockUser: (tx: Tx, userId: string) => Promise<boolean>
  now: () => Date
  /** #171 응답의 레슨 통계(끝낸 레슨 수·마지막 시각·제목) — 트랜잭션 밖 읽기. */
  lessonStats: (userId: string, topicId: string) => Promise<{ lessonCount: number; lastLessonAt: string | null; lastLessonTitle: string | null }>
}

export const defaultTopicWriteDeps: TopicWriteDeps = {
  transaction: (fn) => withTransaction(fn),
  lockUser: lockUserRow,
  now: () => new Date(),
  lessonStats: async (userId, topicId) => {
    const [stats, titles] = await Promise.all([doneLessonStats(userId, [topicId], prisma), lastDoneLessonTitles(userId, [topicId], prisma)])
    const s = stats.get(topicId)
    return { lessonCount: s?.count ?? 0, lastLessonAt: s?.last ? s.last.toISOString() : null, lastLessonTitle: titles.get(topicId) ?? null }
  },
}

export const withTopicWriteDeps = (over?: Partial<TopicWriteDeps>): TopicWriteDeps => (over ? { ...defaultTopicWriteDeps, ...over } : defaultTopicWriteDeps)

/** KST 하루 시작(상황 만들기·시드 사본 하루 한도와 같은 계산). */
export const kstDayStart = (now: Date) => new Date(`${dates.todayKst(now)}T00:00:00+09:00`)

export const TOPIC_CHUNK_SELECT = { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true, order: true } as const

export function topicFieldError(field: string, reason: string, message: string): ApiError {
  return new ApiError('VALIDATION', message, { field, reason })
}

/**
 * 백스톱 구조 검사 — DB 칸 폭(`normalizeTopicInput`) + 표현 수 `TOPIC_SAVE_LIMITS` + 읽기 필수. 첫 문제를 400 으로.
 * `partial`(#171)이면 보낸 칸만 본다.
 */
export function assertTopicWriteShape(input: Partial<TopicCreateInput>, partial: boolean): void {
  const raw: Record<string, unknown> = {}
  for (const k of ['title', 'titleJa', 'level', 'description', 'chunks'] as const) if (input[k] !== undefined) raw[k] = input[k]
  if (!partial) for (const k of ['title', 'level', 'chunks'] as const) if (raw[k] === undefined) throw topicFieldError(k, 'required', '빠진 항목이 있어요.')
  const { problems } = normalizeTopicInput(raw)
  if (problems.length) throw new ApiError('VALIDATION', problems[0].message, { field: problems[0].field, reason: problems[0].reason, problems })
  const chunks = input.chunks
  if (chunks === undefined) return
  if (chunks.length < TOPIC_SAVE_LIMITS.chunksMin || chunks.length > TOPIC_SAVE_LIMITS.chunksMax) {
    throw topicFieldError('chunks', 'count', `기본 표현은 ${TOPIC_SAVE_LIMITS.chunksMin}~${TOPIC_SAVE_LIMITS.chunksMax}개로 저장할 수 있어요.`)
  }
  chunks.forEach((c, i) => {
    if (typeof c.reading !== 'string' || !c.reading.trim()) throw topicFieldError(`chunks[${i}].reading`, 'required', '읽기를 적어 주세요.')
  })
}

export const topicChunkRow = (topicId: string, c: TopicSaveChunk, order: number) => ({
  topicId, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, note: null, order,
})

export async function readTopicChunks(tx: Tx, topicId: string): Promise<TopicChunkDto[]> {
  const rows = await tx.topicChunk.findMany({ where: { topicId }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: TOPIC_CHUNK_SELECT })
  return rows.map((r) => ({ id: r.id, chunkType: r.chunkType, textJa: r.textJa, reading: r.reading, meaningKo: r.meaningKo, order: r.order }))
}

/** #57 저장. 성공하면 #56 목록 항목과 같은 모양(새 주제라 레슨 통계는 0). */
export async function createUserTopic(userId: string, input: TopicCreateInput, over?: Partial<TopicWriteDeps>): Promise<TopicDto> {
  const d = withTopicWriteDeps(over)
  assertTopicWriteShape(input, false)
  return d.transaction(async (tx) => {
    await d.lockUser(tx, userId)
    const mine = await tx.conversationTopic.count({ where: { userId, isSeed: false } })
    if (mine >= TOPIC_LIMITS.minePerUser) {
      throw new ApiError('CONFLICT', `내 주제는 ${TOPIC_LIMITS.minePerUser}개까지 둘 수 있어요. 안 쓰는 주제를 지운 뒤 다시 저장해 주세요.`, { reason: 'TOPIC_LIMIT', limit: TOPIC_LIMITS.minePerUser })
    }
    const now = d.now()
    const start = kstDayStart(now)
    const made = await tx.conversationTopic.count({ where: { userId, isSeed: false, createdAt: { gte: start } } })
    if (made >= TOPIC_LIMITS.createPerDay) {
      const retryAfterSec = Math.max(1, Math.ceil((start.getTime() + 86_400_000 - now.getTime()) / 1000))
      throw new ApiError('RATE_LIMITED', '오늘은 주제를 더 저장할 수 없어요. 내일 다시 저장해 주세요.', { reason: 'DAILY_LIMIT', limit: TOPIC_LIMITS.createPerDay, retryAfterSec })
    }
    const topic = await tx.conversationTopic.create({
      data: { userId, isSeed: false, title: input.title, titleJa: input.titleJa, level: input.level, description: input.description },
      select: { id: true, title: true, titleJa: true, level: true, description: true },
    })
    await tx.topicChunk.createMany({ data: input.chunks.map((c, i) => topicChunkRow(topic.id, c, i)) })
    return {
      id: topic.id,
      title: topic.title,
      titleJa: topic.titleJa,
      level: topic.level,
      description: topic.description,
      tags: [],
      isSeed: false,
      chunks: await readTopicChunks(tx, topic.id),
      lessonCount: 0,
      lastLessonAt: null,
      lastLessonTitle: null,
    }
  })
}

