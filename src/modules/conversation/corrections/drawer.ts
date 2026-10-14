/**
 * #79 서랍장 교정(task-055, api-contract §2-17) — 채택(ACCEPTED)한 교정 모음을 읽기만 한다. 쓰기·스키마 변경 없음.
 *
 * - 소유자: 늘 `userId = 요청자`. 연결 단어(`savedWord`)는 같은 사용자 소유이거나 공용 기본 단어일 때만 싣는다(task-068 T30 — 남의 단어는 숨김).
 * - 정렬 `resolvedAt desc, id desc` + `{t,id}` 키셋 커서. 채택 경로(`acceptCorrection`)는 늘 `resolvedAt` 을 쓰지만, 커서 키가 비면
 *   페이지가 깨지므로 `resolvedAt IS NOT NULL` 을 조건에 넣어 둔다.
 * - 검색 `q` 는 `original`·`corrected`·`explanation` 부분 일치. Prisma `contains` 는 `%`·`_`·`\` 를 이스케이프하지 않으므로
 *   (`infra.escapeLike` 주석 — task-008 2026-09-27 실측) 우리가 `\` 로 이스케이프한다.
 * - `facets.errorType` 은 `errorType` 조건만 뺀 같은 where 의 groupBy 한 번 — 첫 쪽(`cursor` 없음)에서만 계산한다.
 */
import type { ChunkType, ErrorType, Prisma } from '@prisma/client'
import { ApiError, codePointLength, decodeCursor, encodeCursor, escapeLike, isTimeIdCursor, parseLimit, prisma, sanitizeText } from '@/modules/infra'
import type { DrawerCorrectionFacets, DrawerCorrectionItem, DrawerCorrectionPage } from '@/types/chat'
import { asTopicChunkType, type TopicChunkType } from '@/types/topic'

export const DRAWER_LIMIT_DEFAULT = 20
export const DRAWER_LIMIT_MAX = 50
export const DRAWER_Q_MAX = 40

/** `ErrorType` 선언 순(prisma/schema.prisma) — facets 동률 정렬 키. `Record` 라 enum 값이 늘거나 줄면 컴파일 오류가 난다. */
const ERROR_TYPE_RANK: Record<ErrorType, number> = {
  GRAMMAR: 0, PARTICLE: 1, CONJUGATION: 2, VOCABULARY: 3, POLITENESS: 4, NATURALNESS: 5, WORD_ORDER: 6, PRONUNCIATION: 7, OTHER: 8,
}
// 교정 조각은 4유형뿐(EXPRESSION 은 단어 전용, task-068 J12) — 교정 모음 필터도 4유형.
const CHUNK_TYPE_SET: Record<TopicChunkType, true> = { NAME: true, ACTION: true, FEELING: true, MODIFIER: true }

export const DRAWER_ERROR_TYPES = Object.keys(ERROR_TYPE_RANK) as ErrorType[]
export const DRAWER_CHUNK_TYPES = Object.keys(CHUNK_TYPE_SET) as TopicChunkType[]

export interface DrawerCorrectionQuery {
  errorType: ErrorType | null
  chunkType: ChunkType | null
  /** 정리(앞뒤 공백·제어문자 제거) 뒤 1~40자, 비면 null. */
  q: string | null
  limit: number
  cursor: string | null
}

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

/**
 * #79 쿼리 검증 — 열거값은 글자 그대로 비교(소문자·쉼표 목록·「없음」 값은 400), 빈 문자열은 그 필터가 없는 것으로 본다.
 * `limit` 1~50(기본 20), `q` 는 코드포인트 40자 이하.
 */
export function parseDrawerCorrectionQuery(params: URLSearchParams): DrawerCorrectionQuery {
  const errorType = params.get('errorType') || null
  if (errorType !== null && !Object.hasOwn(ERROR_TYPE_RANK, errorType)) bad('errorType', DRAWER_ERROR_TYPES.join('|'), 'errorType 값이 올바르지 않습니다.')
  const chunkType = params.get('chunkType') || null
  if (chunkType !== null && !Object.hasOwn(CHUNK_TYPE_SET, chunkType)) bad('chunkType', DRAWER_CHUNK_TYPES.join('|'), 'chunkType 값이 올바르지 않습니다.')
  const rawQ = params.get('q')
  let q: string | null = null
  if (rawQ != null) {
    const v = sanitizeText(rawQ)
    if (v && codePointLength(v) > DRAWER_Q_MAX) bad('q', `length ≤${DRAWER_Q_MAX}`, `검색어는 ${DRAWER_Q_MAX}자 이내여야 합니다.`)
    q = v || null
  }
  return {
    errorType: errorType as ErrorType | null,
    chunkType: chunkType as ChunkType | null,
    q,
    limit: parseLimit(params.get('limit'), DRAWER_LIMIT_DEFAULT, DRAWER_LIMIT_MAX),
    cursor: params.get('cursor') || null,
  }
}

/** 목록·facets 공통 where. facets 는 `errorType: null` 로 불러 유형 조건만 뺀다(chunkType·q 는 그대로). */
export function drawerCorrectionWhere(userId: string, f: Pick<DrawerCorrectionQuery, 'errorType' | 'chunkType' | 'q'>): Prisma.CorrectionWhereInput {
  const like = f.q ? escapeLike(f.q) : null
  return {
    userId,
    status: 'ACCEPTED',
    resolvedAt: { not: null },
    ...(f.errorType ? { errorType: f.errorType } : {}),
    ...(f.chunkType ? { chunkType: f.chunkType } : {}),
    ...(like ? { OR: [{ original: { contains: like } }, { corrected: { contains: like } }, { explanation: { contains: like } }] } : {}),
  }
}

export const DRAWER_CORRECTION_SELECT = {
  id: true, original: true, corrected: true, explanation: true, extraNoteKo: true, errorType: true, severity: true, chunkType: true, resolvedAt: true,
  chat: { select: { id: true, title: true, kind: true } },
  savedWord: { select: { id: true, surface: true, userId: true, source: true } },
} as const

/**
 * 공용 기본 단어(task-068 — `userId` NULL · `source=SEED`, 모든 사용자가 읽는 행). 이관·채택(L4)으로 교정의 `savedWordId` 가 기본 단어를
 * 가리킬 수 있어 「단어장에 넣은 단어」 연결로 싣는다. 판정은 learning `visibleWordWhere` 와 같은 두 조건(L2 는 L3 를 import 하지 않는다).
 */
function isBaseWord(w: { userId: string | null; source: string }): boolean {
  return w.userId === null && w.source === 'SEED'
}

export type DrawerCorrectionRow = Prisma.CorrectionGetPayload<{ select: typeof DRAWER_CORRECTION_SELECT }>
const DRAWER_ORDER: Prisma.CorrectionOrderByWithRelationInput[] = [{ resolvedAt: 'desc' }, { id: 'desc' }]

/** `listDrawerCorrections` 가 쓰는 최소 DB 면(시험이 가짜를 넣는다). 관계(chat·savedWord)는 findMany 한 번의 select 로 읽는다. */
export interface DrawerCorrectionDb {
  correction: {
    findMany(args: { where: Prisma.CorrectionWhereInput; orderBy: Prisma.CorrectionOrderByWithRelationInput[]; take: number; select: typeof DRAWER_CORRECTION_SELECT }): Promise<DrawerCorrectionRow[]>
    groupBy(args: { by: ['errorType']; where: Prisma.CorrectionWhereInput; _count: { _all: true } }): Promise<{ errorType: ErrorType; _count: { _all: number } }[]>
  }
}

function serializeDrawerCorrection(userId: string, r: DrawerCorrectionRow): DrawerCorrectionItem {
  const w = r.savedWord
  return {
    id: r.id,
    original: r.original,
    corrected: r.corrected,
    explanation: r.explanation,
    extraNoteKo: r.extraNoteKo ?? null,
    errorType: r.errorType,
    severity: r.severity,
    chunkType: asTopicChunkType(r.chunkType, null),
    chat: { id: r.chat.id, title: r.chat.title, kind: r.chat.kind },
    ...(w && (w.userId === userId || isBaseWord(w)) ? { savedWord: { id: w.id, surface: w.surface } } : {}),
    // where 가 resolvedAt IS NOT NULL 을 보장한다.
    resolvedAt: (r.resolvedAt as Date).toISOString(),
  }
}

async function facetsOf(db: DrawerCorrectionDb, where: Prisma.CorrectionWhereInput): Promise<DrawerCorrectionFacets> {
  const rows = await db.correction.groupBy({ by: ['errorType'], where, _count: { _all: true } })
  const errorType = rows
    .map((r) => ({ value: r.errorType, count: r._count._all }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count || ERROR_TYPE_RANK[a.value] - ERROR_TYPE_RANK[b.value])
  return { errorType }
}

/**
 * #79 — 첫 쪽은 목록 + facets(쿼리 2개, 병렬), 더 보기(`cursor`)는 목록 쿼리 1개. 해석할 수 없는 커서는 DB 를 부르기 전에 400.
 */
export async function listDrawerCorrections(
  userId: string,
  q: DrawerCorrectionQuery,
  db: DrawerCorrectionDb = prisma as unknown as DrawerCorrectionDb,
): Promise<DrawerCorrectionPage> {
  const cur = decodeCursor(q.cursor, isTimeIdCursor)
  const where = drawerCorrectionWhere(userId, q)
  const after: Prisma.CorrectionWhereInput | null = cur
    ? { OR: [{ resolvedAt: { lt: new Date(cur.t) } }, { resolvedAt: new Date(cur.t), id: { lt: cur.id } }] }
    : null
  const [rows, facets] = await Promise.all([
    db.correction.findMany({ where: after ? { AND: [where, after] } : where, orderBy: DRAWER_ORDER, take: q.limit + 1, select: DRAWER_CORRECTION_SELECT }),
    cur ? Promise.resolve(null) : facetsOf(db, drawerCorrectionWhere(userId, { ...q, errorType: null })),
  ])
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => serializeDrawerCorrection(userId, r)),
    nextCursor: rows.length > q.limit && last?.resolvedAt ? encodeCursor({ t: last.resolvedAt.toISOString(), id: last.id }) : null,
    ...(facets ? { facets } : {}),
  }
}
