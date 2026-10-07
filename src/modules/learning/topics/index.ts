/**
 * 주제(ConversationTopic + TopicChunk) — task-006 은 대화 생성용 `getTopicRef`, task-010 은 #56 목록과 레슨 재료 읽기.
 * 사용자는 시드 주제(userId null)와 **자기** 주제만 본다. #57 사용자 주제 생성은 task-010d.
 */
import type { ChunkType, JlptLevel } from '@prisma/client'
import { ApiError, prisma, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { hiddenSeedIds, visibleRowsWhere } from '../seedOverride/visibility'
import { isTopicVisibleTo } from './visible'

export const JLPT_ORDER: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
export const TOPIC_LIST_MAX = 100

/**
 * #28 새 채팅의 주제 — 시드 또는 내 주제, 이 사용자가 가린(숨김·내 버전) 시드는 null(→ 404, task-045 §2 새 시작 차단 · REV-150 M1).
 * 진행 중 챌린지 예외 없음(챌린지 과제는 #59·#47 경로). 지난 채팅의 주제 읽기는 이 함수를 쓰지 않는다.
 */
export async function getTopicRef(userId: string, topicId: string, db: Tx = prisma): Promise<{ id: string; title: string } | null> {
  if (typeof topicId !== 'string' || !topicId || topicId.length > 40) return null
  const t = await db.conversationTopic.findFirst({ where: { id: topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, userId: true } })
  return t && (await isTopicVisibleTo(db, userId, t)) ? { id: t.id, title: t.title } : null
}

/** 학습자 수준 ±1(N5 → N5·N4, N3 → N4·N3·N2). */
export function levelWindow(level: JlptLevel): JlptLevel[] {
  const i = JLPT_ORDER.indexOf(level)
  return JLPT_ORDER.filter((_, j) => Math.abs(j - (i < 0 ? 0 : i)) <= 1)
}

export interface TopicQuery {
  level: JlptLevel | null
  mine: boolean
  /** `level=all`(task-045 #56 변경) — 수준 창을 풀고 다섯 수준 전부. 켜면 `level` 은 null. */
  allLevels?: boolean
}

/** #56 쿼리 — `level=N5..N1|all`(없으면 학습자 수준 ±1, `all` 은 관리 화면용 전체 수준), `mine=1|0`(`all` 과 함께 쓸 수 있다). */
export function parseTopicQuery(q: URLSearchParams): TopicQuery {
  for (const k of q.keys()) {
    if (k !== 'level' && k !== 'mine') throw new ApiError('VALIDATION', `지원하지 않는 조건입니다: ${k}`, { field: k, reason: 'unknown_key' })
  }
  const level = q.get('level')
  const all = level === 'all'
  if (level !== null && !all && !(JLPT_ORDER as readonly string[]).includes(level)) throw new ApiError('VALIDATION', 'level 은 N5~N1 입니다.', { field: 'level', reason: JLPT_ORDER.join('|') })
  const mine = q.get('mine')
  if (mine !== null && mine !== '0' && mine !== '1') throw new ApiError('VALIDATION', 'mine 은 0 또는 1 입니다.', { field: 'mine', reason: '0|1' })
  // `allLevels` 는 켤 때만 싣는다 — 기존 쿼리의 결과 모양(`{level, mine}`)은 그대로.
  return { level: all ? null : ((level as JlptLevel | null) ?? null), mine: mine === '1', ...(all ? { allLevels: true } : {}) }
}

export interface TopicChunkDto {
  id: string
  chunkType: ChunkType
  textJa: string
  reading: string | null
  meaningKo: string
  order: number
}

export interface TopicDto {
  id: string
  title: string
  titleJa: string | null
  level: JlptLevel
  description: string | null
  tags: string[]
  isSeed: boolean
  chunks: TopicChunkDto[]
  /** 이 사용자가 **끝낸**(DONE) 이 주제의 레슨 수. */
  lessonCount: number
  /** 마지막으로 끝낸 시각(ISO) 또는 null. */
  lastLessonAt: string | null
  /** 마지막으로 끝낸 레슨의 제목(일본어, task-010 §12-11 ②) 또는 null. */
  lastLessonTitle: string | null
}

const CHUNK_SELECT = { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true, order: true } as const

/** 주제별 마지막으로 끝낸 레슨 제목(사용자 것만). 주제당 1건 — 완료 시각 최신. */
export async function lastDoneLessonTitles(userId: string, topicIds: string[], db: Tx = prisma): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!topicIds.length) return out
  const rows = await db.lesson.findMany({
    where: { userId, status: 'DONE', topicId: { in: topicIds } },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    select: { topicId: true, title: true },
    take: 500,
  })
  for (const r of rows) if (r.topicId && !out.has(r.topicId)) out.set(r.topicId, r.title)
  return out
}

/** 주제별 끝낸 레슨 수·마지막 완료 시각(사용자 것만). */
export async function doneLessonStats(userId: string, topicIds?: string[], db: Tx = prisma): Promise<Map<string, { count: number; last: Date | null }>> {
  const rows = await db.lesson.groupBy({
    by: ['topicId'],
    where: { userId, status: 'DONE', topicId: topicIds ? { in: topicIds } : { not: null } },
    _count: { _all: true },
    _max: { completedAt: true },
  })
  return new Map(rows.flatMap((r) => (r.topicId ? [[r.topicId, { count: r._count._all, last: r._max.completedAt }] as const] : [])))
}

function tagsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
}

/**
 * #56 — 시드 + 내 주제(mine=1 이면 내 것만), 조각 포함. 정렬: 수준(N5→N1) → 시드 먼저 → 만든 순.
 * 이 사용자가 숨겼거나 내 버전으로 바꾼 시드는 빠진다(task-045 계약 §2 — 내 버전은 일반 내 행으로 보인다).
 */
export async function listTopics(userId: string, q: TopicQuery, db: Tx = prisma): Promise<{ items: TopicDto[]; level: JlptLevel[] }> {
  const levels = q.allLevels ? [...JLPT_ORDER] : q.level ? [q.level] : levelWindow((await getProfile(userId)).level as JlptLevel)
  const hidden = q.mine ? [] : await hiddenSeedIds(db, userId, 'TOPIC')
  const rows = await db.conversationTopic.findMany({
    where: { level: { in: levels }, ...(q.mine ? { userId } : visibleRowsWhere(userId, hidden)) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: TOPIC_LIST_MAX,
    select: {
      id: true, title: true, titleJa: true, level: true, description: true, tags: true, isSeed: true, userId: true,
      chunks: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: CHUNK_SELECT, take: 40 },
    },
  })
  const ids = rows.map((r) => r.id)
  const [stats, titles] = await Promise.all([doneLessonStats(userId, ids, db), lastDoneLessonTitles(userId, ids, db)])
  const rank = (l: JlptLevel) => JLPT_ORDER.indexOf(l)
  const items = rows
    .map((r) => ({ r, s: stats.get(r.id) }))
    .sort((a, b) => rank(a.r.level) - rank(b.r.level) || Number(b.r.userId === null) - Number(a.r.userId === null))
    .map(({ r, s }) => ({
      id: r.id,
      title: r.title,
      titleJa: r.titleJa,
      level: r.level,
      description: r.description,
      tags: tagsOf(r.tags),
      isSeed: r.isSeed || r.userId === null,
      chunks: r.chunks,
      lessonCount: s?.count ?? 0,
      lastLessonAt: s?.last ? s.last.toISOString() : null,
      lastLessonTitle: titles.get(r.id) ?? null,
    }))
  return { items, level: levels }
}

export interface LessonTopicMaterial {
  id: string
  title: string
  titleJa: string | null
  level: JlptLevel
  chunks: TopicChunkDto[]
}

/**
 * #59 레슨 재료 — 시드 또는 내 주제(아니면 null → 라우트 404). 이 사용자가 가린 시드는 null(task-045 §2) — 단, 그 주제에 진행 중(ACTIVE) 챌린지가
 * 있으면 읽는다(§0 #9, 챌린지 오늘 수업 과제가 이 경로). 수업 쪽(`loadTopicLessonMaterials`)이 더 좁은 챌린지 규칙(수업 과제·기간 안)을 다시 건다.
 */
export async function getTopicForLesson(userId: string, topicId: string, db: Tx = prisma): Promise<LessonTopicMaterial | null> {
  if (typeof topicId !== 'string' || !topicId || topicId.length > 40) return null
  const t = await db.conversationTopic.findFirst({
    where: { id: topicId, OR: [{ userId: null }, { userId }] },
    select: { id: true, title: true, titleJa: true, level: true, userId: true, chunks: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: CHUNK_SELECT, take: 40 } },
  })
  if (!t || !(await isTopicVisibleTo(db, userId, t, { allowActiveChallenge: true }))) return null
  return { id: t.id, title: t.title, titleJa: t.titleJa, level: t.level, chunks: t.chunks }
}

/**
 * 수업 추천용 — 주어진 수준 목록 안에서 끝낸 레슨 수가 가장 적은 주제(동률이면 만든 순). `excludeId` 는 빼고 고른다.
 * 이 사용자가 가린 시드는 고르지 않는다(task-045 §2). 수준 안에 없으면 null.
 */
export async function pickFewestLessonTopic(userId: string, levels: JlptLevel[], excludeId?: string | null, db: Tx = prisma): Promise<{ id: string; title: string; level: JlptLevel } | null> {
  const hidden = await hiddenSeedIds(db, userId, 'TOPIC')
  const rows = await db.conversationTopic.findMany({
    where: { level: { in: levels }, ...visibleRowsWhere(userId, hidden), ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: TOPIC_LIST_MAX,
    select: { id: true, title: true, level: true },
  })
  if (!rows.length) return null
  const stats = await doneLessonStats(userId, rows.map((r) => r.id), db)
  let best = rows[0]
  let bestCount = stats.get(best.id)?.count ?? 0
  for (const r of rows.slice(1)) {
    const c = stats.get(r.id)?.count ?? 0
    if (c < bestCount) {
      best = r
      bestCount = c
    }
  }
  return best
}
