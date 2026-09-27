/**
 * 단어장(api-contract #40~#46) — task-006 에서 `createWord`·입력 검증, task-008 에서 목록·상세·수정·삭제·보관·카테고리.
 * 검증 한도는 api-contract #41(코드포인트 기준): surface 1~80 · reading ≤120 · meaning 1~200 · example/exampleKo ≤2,000 · note ≤500 · category ≤40.
 *
 * **같은 표현(surface) 중복은 `409 { existingId }`.** 스키마에 (userId, surface) 유니크가 없으므로 사용자 행을 잠근 뒤 확인한다
 * (동시 채택 두 건이 같은 단어를 두 번 만들지 않게). 비교는 **바이트 일치**다 — DB 콜레이션(utf8mb4_unicode_ci)은
 * 「はは」와 「ぱぱ」, 히라가나와 가타카나를 같게 보므로 DB 로는 후보만 좁히고 최종 판정은 JS `===` 로 한다.
 */
import type { ChunkType, JlptLevel, PartOfSpeech, Prisma, WordSource } from '@prisma/client'
import {
  ApiError, codePointLength, decodeCursor, encodeCursor, escapeLike, lockUserRow, prisma, sanitizeText, withTransaction, type Tx,
} from '@/modules/infra'

export const PARTS_OF_SPEECH = ['NOUN', 'VERB', 'ADJ_I', 'ADJ_NA', 'ADVERB', 'PARTICLE', 'EXPRESSION', 'OTHER'] as const
export const WORD_CHUNK_TYPES = ['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const
export const WORD_JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'] as const

export interface WordInput {
  surface: string
  meaning: string
  reading?: string | null
  partOfSpeech?: PartOfSpeech
  chunkType?: ChunkType | null
  jlpt?: JlptLevel | null
  example?: string | null
  exampleKo?: string | null
  note?: string | null
  category?: string | null
}

export interface WordDto {
  id: string
  surface: string
  reading: string | null
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType: ChunkType | null
  jlpt: JlptLevel | null
  example: string | null
  exampleKo: string | null
  note: string | null
  category: string | null
  source: WordSource
  sourceRefId: string | null
  correctCount: number
  wrongCount: number
  lastSeenAt: string | null
  lastResult: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

const WORD_KEYS = ['surface', 'meaning', 'reading', 'partOfSpeech', 'chunkType', 'jlpt', 'example', 'exampleKo', 'note', 'category'] as const

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function text(raw: unknown, field: string, max: number, opts: { required?: boolean; multiline?: boolean } = {}): string | null {
  if (raw === undefined || raw === null) {
    if (opts.required) bad(field, 'required', `${field} 은(는) 필수입니다.`)
    return null
  }
  if (typeof raw !== 'string') bad(field, 'string', `${field} 형식이 올바르지 않습니다.`)
  const v = sanitizeText(raw, { multiline: opts.multiline })
  if (!v) {
    if (opts.required) bad(field, 'required', `${field} 은(는) 비워 둘 수 없습니다.`)
    return null
  }
  if (codePointLength(v) > max) bad(field, `length 1~${max}`, `${field} 은(는) ${max}자 이내여야 합니다.`)
  return v
}

function oneOf<T extends string>(raw: unknown, field: string, values: readonly T[]): T | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string' || !(values as readonly string[]).includes(raw)) bad(field, values.join('|'), `${field} 값이 올바르지 않습니다.`)
  return raw as T
}

/** #41 본문 검증(화이트리스트 밖 키는 400). `field` 앞에 붙일 경로(예: `addWord.`)를 받는다. */
export function parseWordInput(raw: unknown, prefix = ''): WordInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad(prefix.replace(/\.$/, '') || 'body', 'object', '단어 정보 형식이 올바르지 않습니다.')
  const body = raw as Record<string, unknown>
  const extra = Object.keys(body).filter((k) => !(WORD_KEYS as readonly string[]).includes(k))
  if (extra.length) bad(`${prefix}${extra[0]}`, 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  return {
    surface: text(body.surface, `${prefix}surface`, 80, { required: true }) as string,
    meaning: text(body.meaning, `${prefix}meaning`, 200, { required: true }) as string,
    reading: text(body.reading, `${prefix}reading`, 120),
    partOfSpeech: oneOf(body.partOfSpeech, `${prefix}partOfSpeech`, PARTS_OF_SPEECH) ?? undefined,
    chunkType: oneOf(body.chunkType, `${prefix}chunkType`, WORD_CHUNK_TYPES),
    jlpt: oneOf(body.jlpt, `${prefix}jlpt`, WORD_JLPT),
    example: text(body.example, `${prefix}example`, 2_000, { multiline: true }),
    exampleKo: text(body.exampleKo, `${prefix}exampleKo`, 2_000, { multiline: true }),
    note: text(body.note, `${prefix}note`, 500, { multiline: true }),
    category: text(body.category, `${prefix}category`, 40),
  }
}

type WordRow = Omit<WordDto, 'lastSeenAt' | 'archivedAt' | 'createdAt' | 'updatedAt'> & { lastSeenAt: Date | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date }

export function toWordDto(w: WordRow): WordDto {
  return {
    ...w,
    lastSeenAt: w.lastSeenAt ? w.lastSeenAt.toISOString() : null,
    archivedAt: w.archivedAt ? w.archivedAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }
}

const WORD_SELECT = {
  id: true, surface: true, reading: true, meaning: true, partOfSpeech: true, chunkType: true, jlpt: true, example: true, exampleKo: true,
  note: true, category: true, source: true, sourceRefId: true, correctCount: true, wrongCount: true, lastSeenAt: true, lastResult: true,
  archived: true, archivedAt: true, createdAt: true, updatedAt: true,
} as const

/** 같은 사용자의 같은 표현(바이트 일치) id — 없으면 null. `excludeId` 는 수정 중인 자기 자신. */
async function findSameSurface(db: Tx, userId: string, surface: string, excludeId?: string): Promise<string | null> {
  const candidates = await db.wordEntry.findMany({
    where: { userId, surface, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, surface: true },
    take: 50,
  })
  return candidates.find((c) => c.surface === surface)?.id ?? null
}

/** #41 enrich 전 중복 확인(읽기 전용 — 저장은 사용자가 확인한 뒤 `createWord` 가 잠금 아래 다시 검사한다). */
export async function findWordIdBySurface(userId: string, surface: string): Promise<string | null> {
  return findSameSurface(prisma, userId, surface)
}

/**
 * 단어 저장(채택 경로 전용 — 라우트가 연 트랜잭션 `tx` 안에서 부른다). 같은 표현이 있으면 `409 { existingId }` 로 던져
 * 호출 트랜잭션 전체(교정·제안 상태 전이 포함)를 되돌린다.
 */
export async function createWord(userId: string, input: WordInput & { source: WordSource; sourceRefId?: string | null }, tx?: Tx): Promise<WordDto> {
  const run = async (db: Tx) => {
    await lockUserRow(db, userId)
    const existingId = await findSameSurface(db, userId, input.surface)
    if (existingId) throw new ApiError('CONFLICT', '단어장에 같은 표현이 이미 있어요.', { existingId })
    const w = await db.wordEntry.create({
      data: {
        userId,
        surface: input.surface,
        meaning: input.meaning,
        reading: input.reading ?? null,
        partOfSpeech: input.partOfSpeech ?? 'OTHER',
        chunkType: input.chunkType ?? null,
        jlpt: input.jlpt ?? null,
        example: input.example ?? null,
        exampleKo: input.exampleKo ?? null,
        note: input.note ?? null,
        category: input.category ?? null,
        source: input.source,
        sourceRefId: input.sourceRefId ?? null,
      },
      select: WORD_SELECT,
    })
    return toWordDto(w)
  }
  return tx ? run(tx) : withTransaction(run)
}


// ── task-008: #40 목록 · #42 상세 · #43 수정 · #44 삭제 · #45 보관 · #46 카테고리 ─────────────────────────────

const DAY_MS = 86_400_000
export const WORD_SORTS = ['recent', 'wrong', 'surface'] as const
export type WordSort = (typeof WORD_SORTS)[number]

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '단어를 찾을 수 없어요.')
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 40
}

export interface WordListQuery {
  q: string | null
  category: string | null
  archived: boolean
  sort: WordSort
  limit: number
  cursor: string | null
}

/** #40 쿼리 — `q` ≤40·`category` ≤40(코드포인트), `archived=0|1`, `sort=recent|wrong|surface`, `limit` 1~100(기본 20). */
export function parseWordListQuery(params: URLSearchParams, limit: number): WordListQuery {
  const one = (name: string, max: number): string | null => {
    const raw = params.get(name)
    if (raw == null) return null
    const v = sanitizeText(raw)
    if (!v) return null
    if (codePointLength(v) > max) bad(name, `length ≤${max}`, `${name} 은(는) ${max}자 이내여야 합니다.`)
    return v
  }
  const archived = params.get('archived')
  if (archived != null && archived !== '' && archived !== '0' && archived !== '1') bad('archived', '0|1', 'archived 는 0 또는 1 이어야 합니다.')
  const sort = params.get('sort') || 'recent'
  if (!(WORD_SORTS as readonly string[]).includes(sort)) bad('sort', WORD_SORTS.join('|'), 'sort 값이 올바르지 않습니다.')
  return { q: one('q', 40), category: one('category', 40), archived: archived === '1', sort: sort as WordSort, limit, cursor: params.get('cursor') }
}

type WordCursor = { k: 'recent'; t: string; id: string } | { k: 'wrong'; w: number; id: string } | { k: 'surface'; s: string; id: string }

function cursorCheck(sort: WordSort) {
  return (v: Record<string, unknown>): v is WordCursor => {
    if (v.k !== sort || typeof v.id !== 'string' || !v.id || v.id.length > 40) return false
    if (sort === 'recent') return typeof v.t === 'string' && !Number.isNaN(Date.parse(v.t))
    if (sort === 'wrong') return typeof v.w === 'number' && Number.isInteger(v.w) && v.w >= 0
    return typeof v.s === 'string' && v.s.length <= 200
  }
}

function orderFor(sort: WordSort): Prisma.WordEntryOrderByWithRelationInput[] {
  if (sort === 'wrong') return [{ wrongCount: 'desc' }, { id: 'desc' }]
  if (sort === 'surface') return [{ surface: 'asc' }, { id: 'asc' }]
  return [{ createdAt: 'desc' }, { id: 'desc' }]
}

function afterCursor(c: WordCursor): Prisma.WordEntryWhereInput {
  if (c.k === 'wrong') return { OR: [{ wrongCount: { lt: c.w } }, { wrongCount: c.w, id: { lt: c.id } }] }
  if (c.k === 'surface') return { OR: [{ surface: { gt: c.s } }, { surface: c.s, id: { gt: c.id } }] }
  return { OR: [{ createdAt: { lt: new Date(c.t) } }, { createdAt: new Date(c.t), id: { lt: c.id } }] }
}

function cursorOf(sort: WordSort, w: { id: string; wrongCount: number; surface: string; createdAt: Date }): string {
  if (sort === 'wrong') return encodeCursor({ k: 'wrong', w: w.wrongCount, id: w.id })
  if (sort === 'surface') return encodeCursor({ k: 'surface', s: w.surface, id: w.id })
  return encodeCursor({ k: 'recent', t: w.createdAt.toISOString(), id: w.id })
}

/** #40 — 부분 일치(`surface/reading/meaning`, LIKE 와일드카드는 글자 그대로), 보관 여부 분리, 정렬 3종, `total` 은 커서와 무관한 전체 수. */
export async function listWords(userId: string, q: WordListQuery): Promise<{ items: WordDto[]; nextCursor: string | null; total: number }> {
  const cur = decodeCursor(q.cursor, cursorCheck(q.sort))
  const like = q.q ? escapeLike(q.q) : null
  const filter: Prisma.WordEntryWhereInput = {
    userId,
    archived: q.archived,
    ...(q.category ? { category: q.category } : {}),
    ...(like ? { OR: [{ surface: { contains: like } }, { reading: { contains: like } }, { meaning: { contains: like } }] } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.wordEntry.findMany({ where: cur ? { AND: [filter, afterCursor(cur)] } : filter, orderBy: orderFor(q.sort), take: q.limit + 1, select: WORD_SELECT }),
    prisma.wordEntry.count({ where: filter }),
  ])
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return { items: page.map(toWordDto), nextCursor: rows.length > q.limit && last ? cursorOf(q.sort, last) : null, total }
}

export interface WordDetail extends WordDto {
  stats: { attempts: number; last7d: { correct: number; wrong: number }; evalAppearances: number }
}

/** #42 — 단어 + 풀이 통계(맞힘·틀림만 센다, 건너뜀 제외). `corrections` 는 L2 소유라 라우트가 conversation 에서 받아 붙인다. */
export async function getWordDetail(userId: string, id: string): Promise<WordDetail> {
  if (!isValidId(id)) throw notFound()
  const w = await prisma.wordEntry.findFirst({ where: { id, userId }, select: WORD_SELECT })
  if (!w) throw notFound()
  const graded = { in: ['CORRECT', 'WRONG'] as ('CORRECT' | 'WRONG')[] }
  const [attempts, recent, evalAppearances] = await Promise.all([
    prisma.vocabAttempt.count({ where: { wordId: id, answer: graded } }),
    prisma.vocabAttempt.groupBy({ by: ['answer'], where: { wordId: id, answer: graded, answeredAt: { gte: new Date(Date.now() - 7 * DAY_MS) } }, _count: { _all: true } }),
    prisma.evaluationItem.count({ where: { wordId: id } }),
  ])
  const n = (a: string) => recent.find((r) => r.answer === a)?._count._all ?? 0
  return { ...toWordDto(w), stats: { attempts, last7d: { correct: n('CORRECT'), wrong: n('WRONG') }, evalAppearances } }
}

const READ_ONLY_KEYS = ['id', 'source', 'sourceRefId', 'correctCount', 'wrongCount', 'lastSeenAt', 'lastResult', 'archived', 'archivedAt', 'createdAt', 'updatedAt']

export type WordPatch = Partial<WordInput>

/** #43 본문 — 보낸 키만 바꾼다. 카운터·출처·보관 상태는 `400 read_only`, 모르는 키는 `400 unknown_key`. 선택 값은 `null` 로 비운다. */
export function parseWordPatch(raw: Record<string, unknown>): WordPatch {
  const keys = Object.keys(raw)
  const ro = keys.find((k) => READ_ONLY_KEYS.includes(k))
  if (ro) bad(ro, 'read_only', `${ro} 은(는) 바꿀 수 없습니다.`)
  const extra = keys.filter((k) => !(WORD_KEYS as readonly string[]).includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  const out: WordPatch = {}
  if ('surface' in raw) out.surface = text(raw.surface, 'surface', 80, { required: true }) as string
  if ('meaning' in raw) out.meaning = text(raw.meaning, 'meaning', 200, { required: true }) as string
  if ('reading' in raw) out.reading = text(raw.reading, 'reading', 120)
  if ('partOfSpeech' in raw) out.partOfSpeech = oneOf(raw.partOfSpeech, 'partOfSpeech', PARTS_OF_SPEECH) ?? 'OTHER'
  if ('chunkType' in raw) out.chunkType = oneOf(raw.chunkType, 'chunkType', WORD_CHUNK_TYPES)
  if ('jlpt' in raw) out.jlpt = oneOf(raw.jlpt, 'jlpt', WORD_JLPT)
  if ('example' in raw) out.example = text(raw.example, 'example', 2_000, { multiline: true })
  if ('exampleKo' in raw) out.exampleKo = text(raw.exampleKo, 'exampleKo', 2_000, { multiline: true })
  if ('note' in raw) out.note = text(raw.note, 'note', 500, { multiline: true })
  if ('category' in raw) out.category = text(raw.category, 'category', 40)
  return out
}

/** #43 — 사용자 행 잠금 뒤 표현이 바뀌면 중복(바이트 일치, 자기 자신 제외) 검사. */
export async function updateWord(userId: string, id: string, patch: WordPatch): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const cur = await tx.wordEntry.findFirst({ where: { id, userId }, select: { surface: true } })
    if (!cur) throw notFound()
    if (patch.surface !== undefined && patch.surface !== cur.surface) {
      const existingId = await findSameSurface(tx, userId, patch.surface, id)
      if (existingId) throw new ApiError('CONFLICT', '단어장에 같은 표현이 이미 있어요.', { existingId })
    }
    const w = Object.keys(patch).length
      ? await tx.wordEntry.update({ where: { id }, data: patch, select: WORD_SELECT })
      : await tx.wordEntry.findUniqueOrThrow({ where: { id }, select: WORD_SELECT })
    return toWordDto(w)
  })
}

/**
 * #44 — 행 삭제. 참조(`VocabAttempt.wordId`·`Correction.savedWordId`·`EvaluationItem.wordId`)는 DB FK `ON DELETE SET NULL` 이
 * 끊고 `*Snap` 이 이력을 지킨다. `StatsSnapshot` 은 건드리지 않는다(domain-model 규칙 2). 사용자 행을 먼저 잡아
 * 같은 사용자의 finish(카운터 갱신)와 순서를 맞춘다 — 교착 없이 둘 중 하나가 먼저 끝난다.
 */
export async function deleteWord(userId: string, id: string): Promise<{ deleted: true; snapshotKept: true }> {
  if (!isValidId(id)) throw notFound()
  await withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const res = await tx.wordEntry.deleteMany({ where: { id, userId } })
    if (res.count === 0) throw notFound()
  })
  return { deleted: true, snapshotKept: true }
}

/** #45 — 보관 토글. 이미 그 상태면 그대로 돌려준다(`archivedAt` 유지). */
export async function setWordArchived(userId: string, id: string, archived: boolean): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  await prisma.wordEntry.updateMany({ where: { id, userId, archived: !archived }, data: { archived, archivedAt: archived ? new Date() : null } })
  const w = await prisma.wordEntry.findFirst({ where: { id, userId }, select: WORD_SELECT })
  if (!w) throw notFound()
  return toWordDto(w)
}

export interface CategoryCount {
  category: string | null
  /** 보관하지 않은 단어 수(F6). */
  count: number
  archivedCount: number
}

/** #46 — 카테고리별 개수(보관 제외 `count`·보관 `archivedCount`). 많은 순, 같으면 이름 순, 분류 없음(null)은 끝. */
export async function listCategories(userId: string): Promise<CategoryCount[]> {
  const rows = await prisma.wordEntry.groupBy({ by: ['category', 'archived'], where: { userId }, _count: { _all: true } })
  const map = new Map<string | null, CategoryCount>()
  for (const r of rows) {
    const c = map.get(r.category) ?? { category: r.category, count: 0, archivedCount: 0 }
    if (r.archived) c.archivedCount += r._count._all
    else c.count += r._count._all
    map.set(r.category, c)
  }
  return [...map.values()].sort((a, b) => {
    if (a.category === null || b.category === null) return a.category === null ? (b.category === null ? 0 : 1) : -1
    return b.count - a.count || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0)
  })
}

/** #41 — `enrich:true` 이고 `meaning` 이 비었으면 보강 경로(draft, 저장 안 함). */
export function isBlankMeaning(v: unknown): boolean {
  return v == null || (typeof v === 'string' && !sanitizeText(v))
}

/** #41 보강 경로 본문 — 키는 단어 필드만 허용(`enrich` 는 라우트가 뺀다), 검증 대상은 표현(1~80)뿐. 나머지는 저장하지 않으므로 쓰지 않는다. */
export function parseEnrichSurface(body: Record<string, unknown>): string {
  const extra = Object.keys(body).filter((k) => !(WORD_KEYS as readonly string[]).includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  return text(body.surface, 'surface', 80, { required: true }) as string
}
