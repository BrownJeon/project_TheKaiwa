/**
 * 학습 기록 조회·삭제(api-contract #71 로그 객체·#72 목록·#73 삭제).
 *
 * - 로그 객체 = `{id, date, type, origin, summary, result, correctionsCount, durationSec, refId, refExists, createdAt}`.
 *   `refExists` 는 원본(세트·레슨·평가·대화)이 아직 이 사용자 소유로 남아 있는가 — 화면이 "원본이 삭제됐어요"를 고른다.
 *   세트·레슨·평가는 L3 자기 테이블이라 여기서 읽고, 대화(Chat)는 L2 소유라 라우트가 conversation 공개 함수를 `refs` 로 넘긴다
 *   (learning 은 conversation 을 import 하지 않는다 — module-dependency §3).
 * - 삭제는 StudyLog 한 행만 지운다. `Evaluation.studyLogId` 는 FK `ON DELETE SET NULL` 이 처리하고,
 *   **StatsSnapshot 은 읽지도 쓰지도 않는다**(domain-model 규칙 2 — 집계는 삭제와 무관하게 불변).
 */
import type { LogOrigin, Prisma, StudyType } from '@prisma/client'
import { ApiError, dates, decodeCursor, encodeCursor, parseLimit, prisma } from '@/modules/infra'

export const STUDY_TYPES: readonly StudyType[] = ['TALK', 'CHAT', 'WORDS', 'LESSON', 'REVIEW', 'EVALUATION', 'ASK']
/** #72 조회 구간 상한(양 끝 포함 일수). */
export const STUDY_LOG_RANGE_MAX_DAYS = 92
/** #71 하루 로그 상한 — 하루 기록이 이보다 많으면 오래된 것부터 이만큼만(실사용 하루 수십 건 이하). */
export const DAY_LOG_CAP = 200

export interface StudyLogDto {
  id: string
  /** KST `YYYY-MM-DD`(기록이 속한 날). */
  date: string
  type: StudyType
  origin: LogOrigin
  summary: string
  result: Prisma.JsonValue | null
  correctionsCount: number
  durationSec: number | null
  /** 원본 행 id(WORDS=세트 · LESSON/REVIEW=레슨 · EVALUATION=평가 · TALK/CHAT/ASK=대화). FK 없음. */
  refId: string | null
  /** 원본이 지금도 이 사용자 소유로 있는가(refId 가 없으면 false). */
  refExists: boolean
  createdAt: string
}

/** 다른 층 소유 원본의 존재 확인 — 라우트가 conversation 공개 함수로 채워 넘긴다. 반환은 "있는 id" 집합. */
export interface StudyLogRefs {
  ownedChatIds: (ids: string[]) => Promise<Set<string>>
}

type RefSource = 'VOCAB_SESSION' | 'LESSON' | 'EVALUATION' | 'CHAT'
export const REF_SOURCE: Record<StudyType, RefSource> = {
  WORDS: 'VOCAB_SESSION',
  LESSON: 'LESSON',
  REVIEW: 'LESSON',
  EVALUATION: 'EVALUATION',
  TALK: 'CHAT',
  CHAT: 'CHAT',
  ASK: 'CHAT',
}

export const LOG_SELECT = {
  id: true, date: true, type: true, origin: true, summary: true, result: true, correctionsCount: true, durationSec: true, refId: true, createdAt: true,
} as const
export type LogRow = Prisma.StudyLogGetPayload<{ select: typeof LOG_SELECT }>

export function isStudyType(v: unknown): v is StudyType {
  return typeof v === 'string' && (STUDY_TYPES as readonly string[]).includes(v)
}

/** 원본 종류별 refId 묶음(중복·빈 값 제거) — 종류마다 한 번씩만 조회한다(N+1 방지). */
export function groupRefIds(rows: Pick<LogRow, 'type' | 'refId'>[]): Record<RefSource, string[]> {
  const out: Record<RefSource, Set<string>> = { VOCAB_SESSION: new Set(), LESSON: new Set(), EVALUATION: new Set(), CHAT: new Set() }
  for (const r of rows) if (r.refId) out[REF_SOURCE[r.type]].add(r.refId)
  return { VOCAB_SESSION: [...out.VOCAB_SESSION], LESSON: [...out.LESSON], EVALUATION: [...out.EVALUATION], CHAT: [...out.CHAT] }
}

async function existingRefs(userId: string, rows: LogRow[], refs: StudyLogRefs): Promise<Record<RefSource, Set<string>>> {
  const g = groupRefIds(rows)
  const ids = async (list: string[], q: (ids: string[]) => Promise<{ id: string }[]>) => (list.length ? new Set((await q(list)).map((r) => r.id)) : new Set<string>())
  const [VOCAB_SESSION, LESSON, EVALUATION, CHAT] = await Promise.all([
    ids(g.VOCAB_SESSION, (list) => prisma.vocabSession.findMany({ where: { userId, id: { in: list } }, select: { id: true } })),
    ids(g.LESSON, (list) => prisma.lesson.findMany({ where: { userId, id: { in: list } }, select: { id: true } })),
    ids(g.EVALUATION, (list) => prisma.evaluation.findMany({ where: { userId, id: { in: list } }, select: { id: true } })),
    g.CHAT.length ? refs.ownedChatIds(g.CHAT) : Promise.resolve(new Set<string>()),
  ])
  return { VOCAB_SESSION, LESSON, EVALUATION, CHAT }
}

export function toStudyLogDto(r: LogRow, exists: Record<RefSource, Set<string>>): StudyLogDto {
  return {
    id: r.id,
    date: dates.fromDbDate(r.date),
    type: r.type,
    origin: r.origin,
    summary: r.summary,
    result: r.result ?? null,
    correctionsCount: r.correctionsCount,
    durationSec: r.durationSec,
    refId: r.refId,
    refExists: r.refId ? exists[REF_SOURCE[r.type]].has(r.refId) : false,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function serializeLogs(userId: string, rows: LogRow[], refs: StudyLogRefs): Promise<StudyLogDto[]> {
  if (!rows.length) return []
  const exists = await existingRefs(userId, rows, refs)
  return rows.map((r) => toStudyLogDto(r, exists))
}

// ── #72 목록 ─────────────────────────────────────────────────────────────────

export interface StudyLogListQuery {
  from: string
  to: string
  type: StudyType | null
  limit: number
  cursor: { d: string; t: string; id: string } | null
}

function bad(field: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field })
}

function isLogCursor(v: Record<string, unknown>): v is { d: string; t: string; id: string } {
  return dates.isDateString(v.d) && typeof v.t === 'string' && !Number.isNaN(Date.parse(v.t)) && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 40
}

/**
 * `?from=&to=&type=&limit=&cursor=` — `to` 생략 시 오늘(KST), `from` 생략 시 `to` 포함 92일 전부터.
 * 구간이 뒤집혔거나 92일을 넘으면 400.
 */
export function parseStudyLogQuery(sp: URLSearchParams, today: string = dates.todayKst()): StudyLogListQuery {
  const rawTo = sp.get('to')
  const rawFrom = sp.get('from')
  if (rawTo != null && rawTo !== '' && !dates.isDateString(rawTo)) bad('to', 'to 는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.')
  if (rawFrom != null && rawFrom !== '' && !dates.isDateString(rawFrom)) bad('from', 'from 은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.')
  const to = rawTo || today
  const from = rawFrom || dates.addDays(to, -(STUDY_LOG_RANGE_MAX_DAYS - 1))
  if (from > to) bad('from', 'from 은 to 보다 늦을 수 없습니다.')
  if (dates.countDays(from, to) > STUDY_LOG_RANGE_MAX_DAYS) bad('from', `조회 구간은 최대 ${STUDY_LOG_RANGE_MAX_DAYS}일까지입니다.`)
  const rawType = sp.get('type')
  let type: StudyType | null = null
  if (rawType != null && rawType !== '') {
    if (!isStudyType(rawType)) bad('type', `type 은 ${STUDY_TYPES.join('|')} 중 하나여야 합니다.`)
    type = rawType
  }
  const limit = parseLimit(sp.get('limit'), 20, 100)
  const cursor = decodeCursor(sp.get('cursor'), isLogCursor)
  return { from, to, type, limit, cursor }
}

/** 정렬 `(date desc, createdAt desc, id desc)` — 커서는 마지막 항목의 세 키. */
export async function listStudyLogs(userId: string, q: StudyLogListQuery, refs: StudyLogRefs): Promise<{ items: StudyLogDto[]; nextCursor: string | null }> {
  const where: Prisma.StudyLogWhereInput = { userId, date: dates.dbDateRange(q.from, q.to), ...(q.type ? { type: q.type } : {}) }
  if (q.cursor) {
    const d = dates.toDbDate(q.cursor.d)
    const t = new Date(q.cursor.t)
    where.OR = [{ date: { lt: d } }, { date: d, createdAt: { lt: t } }, { date: d, createdAt: t, id: { lt: q.cursor.id } }]
  }
  const rows = await prisma.studyLog.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    select: LOG_SELECT,
  })
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  const nextCursor = rows.length > q.limit && last ? encodeCursor({ d: dates.fromDbDate(last.date), t: last.createdAt.toISOString(), id: last.id }) : null
  return { items: await serializeLogs(userId, page, refs), nextCursor }
}

// ── #73 삭제 ─────────────────────────────────────────────────────────────────

/**
 * 한 문장 `DELETE … WHERE id AND userId` — 소유 확인과 삭제가 원자적이다(동시 삭제·타 사용자는 0행 → 404).
 * `origin=DIRECT` 도 지운다(사용자 데이터). 평가의 `studyLogId` 는 DB FK 가 NULL 로 바꾼다. 스냅샷은 건드리지 않는다.
 */
export async function deleteStudyLog(userId: string, id: string): Promise<{ deleted: true; snapshotKept: true }> {
  if (typeof id !== 'string' || !id || id.length > 40) throw studyLogNotFound()
  const r = await prisma.studyLog.deleteMany({ where: { id, userId } })
  if (r.count === 0) throw studyLogNotFound()
  return { deleted: true, snapshotKept: true }
}

export function studyLogNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '학습 기록을 찾을 수 없어요.')
}
