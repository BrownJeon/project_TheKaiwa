/**
 * #171 내 주제 고치기(task-045 T2) — 내 주제(`userId=U`·`isSeed=false`, 시드 사본 포함)만. 한 트랜잭션 · 사용자 행 잠금 뒤 재조회 → 쓰기.
 *
 * - 시드 id → 409 `USE_FORK`(시드 행은 고치지 않는다 — 「사본으로 고치기」 #174 `fork` 를 쓴다). 남의·없는 주제 → 404 `TOPIC_GONE`(같은 문구 — 존재를 알리지 않는다).
 * - 보낸 칸만 바꾼다. `chunks` 를 보내면 **diff 로 반영**: `id` 가 있는 표현은 그대로 두고(바뀐 칸·순서만 갱신 — 행 id 유지), 새 표현은 만들고, 빠진 기존 표현은 지운다.
 *   단 `id` 가 같아도 **표현 글(`textJa`)이 정규화 기준으로 바뀌었으면 다른 표현**이다 — 옛 행을 지우고 새 id 로 만든다(REV-152b M1). 복습 항목
 *   (`RepetitionItem` refId)·챌린지 진행(`chunkStudied`·`chunkMastered`)이 조각 id 로 세므로, 같은 id 를 남기면 「病院」을 익힌 기록이 「薬」로 넘어간다.
 *   읽기·뜻·유형·순서만 바뀌면(오타 수정 포함) id 를 유지한다. 정규화 = `normalizeRefText`(복습 항목 키와 같은 규칙: NFKC, 공백·문장부호·물결표 제거).
 *   `id` 는 이 주제의 표현이어야 하고(아니면 400 `not_found`) 한 목록에 두 번 나올 수 없다(400 `duplicate`). 표현의 `note` 는 건드리지 않는다.
 * - 지운 표현을 가리키던 기록(`RepetitionItem`·`VocabAttempt` 의 `refId`, 수업의 조각 스냅샷)은 FK 가 없고 저장된 스냅샷으로 읽히므로 따로 처리하지 않는다.
 * - 한도 판정 없음(개수·하루 한도는 새 행을 만드는 #57·#174 몫). 라우트가 분당 쓰기 한도를 건다.
 */
import { ApiError, type Tx } from '@/modules/infra'
import type { TopicUpdateInput } from '@/types/topicWrite'
import { normalizeRefText } from '../repetition'
import { isScenarioId as isRowId } from '../scenarios/shape'
import { assertTopicWriteShape, readTopicChunks, topicChunkRow, topicFieldError, withTopicWriteDeps, type TopicWriteDeps } from './create'
import type { TopicDto } from './index'

export function topicGone(): ApiError {
  return new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.', { reason: 'TOPIC_GONE' })
}

const FIELDS = ['title', 'titleJa', 'level', 'description'] as const

async function applyChunkDiff(tx: Tx, topicId: string, next: NonNullable<TopicUpdateInput['chunks']>): Promise<{ created: number; updated: number; deleted: number }> {
  const existing = await tx.topicChunk.findMany({ where: { topicId }, select: { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true, order: true } })
  const byId = new Map(existing.map((c) => [c.id, c]))
  const kept = new Set<string>()
  /** 같은 id 로 왔지만 표현 글이 바뀐 것 — 옛 행 삭제 + 새 행. */
  const retexted = new Set<string>()
  next.forEach((c, i) => {
    if (c.id === undefined) return
    const old = byId.get(c.id)
    if (!old) throw topicFieldError(`chunks[${i}].id`, 'not_found', '이 주제에 없는 표현이에요. 화면을 새로 고친 뒤 다시 저장해 주세요.')
    if (kept.has(c.id)) throw topicFieldError(`chunks[${i}].id`, 'duplicate', '같은 표현이 두 번 들어 있어요.')
    kept.add(c.id)
    if (normalizeRefText(old.textJa) !== normalizeRefText(c.textJa)) retexted.add(c.id)
  })
  const isNew = (c: { id?: string }) => c.id === undefined || retexted.has(c.id)
  const removed = existing.filter((c) => !kept.has(c.id) || retexted.has(c.id)).map((c) => c.id)
  if (removed.length) await tx.topicChunk.deleteMany({ where: { topicId, id: { in: removed } } })
  let updated = 0
  for (const [i, c] of next.entries()) {
    const old = isNew(c) ? undefined : byId.get(c.id as string)
    if (!old) continue
    if (old.chunkType === c.chunkType && old.textJa === c.textJa && old.reading === c.reading && old.meaningKo === c.meaningKo && old.order === i) continue
    await tx.topicChunk.updateMany({ where: { id: old.id, topicId }, data: { chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, order: i } })
    updated++
  }
  const fresh = next.flatMap((c, i) => (isNew(c) ? [topicChunkRow(topicId, c, i)] : []))
  if (fresh.length) await tx.topicChunk.createMany({ data: fresh })
  return { created: fresh.length, updated, deleted: removed.length }
}

/** #171 고치기. 성공하면 #56 목록 항목과 같은 모양(레슨 통계는 트랜잭션 밖에서 읽는다). */
export async function updateUserTopic(userId: string, topicId: string, input: TopicUpdateInput, over?: Partial<TopicWriteDeps>): Promise<TopicDto> {
  const d = withTopicWriteDeps(over)
  if (!isRowId(topicId)) throw topicGone()
  if (![...FIELDS, 'chunks' as const].some((k) => input[k] !== undefined)) throw topicFieldError('body', 'empty', '고칠 항목이 없어요.')
  assertTopicWriteShape(input, true)
  const saved = await d.transaction(async (tx) => {
    await d.lockUser(tx, userId)
    const t = await tx.conversationTopic.findFirst({ where: { id: topicId }, select: { id: true, userId: true, isSeed: true } })
    if (t && (t.userId === null || t.isSeed)) {
      throw new ApiError('CONFLICT', '기본 주제는 바로 고칠 수 없어요. 내 버전으로 복사해서 고쳐 주세요.', { reason: 'USE_FORK' })
    }
    if (!t || t.userId !== userId) throw topicGone()
    const data: Record<string, unknown> = {}
    for (const k of FIELDS) if (input[k] !== undefined) data[k] = input[k]
    if (Object.keys(data).length) await tx.conversationTopic.updateMany({ where: { id: topicId, userId, isSeed: false }, data })
    if (input.chunks) await applyChunkDiff(tx, topicId, input.chunks)
    const row = await tx.conversationTopic.findFirst({ where: { id: topicId, userId }, select: { id: true, title: true, titleJa: true, level: true, description: true, tags: true } })
    if (!row) throw topicGone()
    return { row, chunks: await readTopicChunks(tx, topicId) }
  })
  const stats = await d.lessonStats(userId, topicId)
  const tags = Array.isArray(saved.row.tags) ? saved.row.tags.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
  return { id: saved.row.id, title: saved.row.title, titleJa: saved.row.titleJa, level: saved.row.level, description: saved.row.description, tags, isSeed: false, chunks: saved.chunks, ...stats }
}
