/**
 * 단어장(api-contract #40~#46·#182/#183) — task-006 에서 `createWord`·입력 검증, task-008 에서 목록·상세·수정·삭제·보관·카테고리,
 * task-068 에서 **공용 기본 단어(읽기 전용) + 내 단어** 범위·사용자별 상태(`UserWordState`)·쪽 번호 목록으로 바뀜(§2-9 task-068 개정),
 * task-074 에서 사용자별 즐겨찾기(#182/#183 · #40 `favorite=1`)가 더해짐.
 * 검증 한도는 api-contract #41(코드포인트 기준): surface 1~80 · reading ≤120 · meaning 1~200 · example/exampleKo ≤2,000 · note ≤500 · category ≤40.
 *
 * **같은 표현(surface) 중복은 `409 { existingId }`.** 스키마에 (userId, surface) 유니크가 없으므로 사용자 행을 잠근 뒤 확인한다
 * (동시 채택 두 건이 같은 단어를 두 번 만들지 않게). 비교는 **바이트 일치**다 — DB 콜레이션(utf8mb4_unicode_ci)은
 * 「はは」와 「ぱぱ」, 히라가나와 가타카나를 같게 보므로 DB 로는 후보만 좁히고 최종 판정은 JS `===` 로 한다.
 * 기본 단어와 같은 단어는 `409 { code: 'BASE_DUPLICATE', existingId }`(상세 ②) — 채택 경로는 그 기본 단어에 연결한다(Leader L4).
 *
 * 기본 단어 행(`userId` NULL)은 앱이 쓰지 않는다. 모든 쓰기는 `where { id, userId }` 모양이라 닿지 않고, 고치기·지우기 요청은 403 으로 따로 거절한다.
 */
import type { ChunkType, JlptLevel, PartOfSpeech, Prisma, WordSource } from '@prisma/client'
import { ApiError, codePointLength, escapeLike, lockUserRow, prisma, sanitizeText, withTransaction, type Tx } from '@/modules/infra'
import { isLevelCategory } from '@/types/seedPack'
import { EMPTY_WORD_STATE, WORD_STATE_FIELDS, archivedBy, favoritedBy, loadWordStates, notArchivedBy, visibleWordWhere, type WordStateRow } from './wordState'

export const PARTS_OF_SPEECH = ['NOUN', 'VERB', 'ADJ_I', 'ADJ_NA', 'ADVERB', 'PARTICLE', 'EXPRESSION', 'OTHER'] as const
/** 단어 조각 5유형(task-068 D4 — `EXPRESSION` 「표현」은 단어 전용, 교정·주제 조각은 4유형). */
export const WORD_CHUNK_TYPES = ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] as const satisfies readonly ChunkType[]
export type WordChunkType = (typeof WORD_CHUNK_TYPES)[number]
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

export type WordOrigin = 'BASE' | 'MINE'

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
  /** `BASE` = 공용 기본 단어(`userId` NULL), `MINE` = 요청한 사용자의 단어. */
  origin: WordOrigin
  readOnly: boolean
  /** 아래 8칸은 요청한 사용자의 `UserWordState`(행이 없으면 0·null·false). 다른 사용자의 상태는 싣지 않는다. */
  correctCount: number
  wrongCount: number
  lastSeenAt: string | null
  lastResult: string | null
  archived: boolean
  archivedAt: string | null
  /** task-074 — 요청한 사용자의 즐겨찾기(보관과 독립). */
  favorite: boolean
  favoritedAt: string | null
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

/**
 * 단어 본문 검증(화이트리스트 밖 키는 400). `field` 앞에 붙일 경로(예: `addWord.`)를 받는다.
 * `opts.jlpt=false` 면 `jlpt` 키를 `400 unknown_key` 로 거절한다 — #41 직접 저장만(task-068, 채택 경로 #35·#38 은 지금처럼 받는다).
 */
export function parseWordInput(raw: unknown, prefix = '', opts: { jlpt?: boolean } = {}): WordInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad(prefix.replace(/\.$/, '') || 'body', 'object', '단어 정보 형식이 올바르지 않습니다.')
  const body = raw as Record<string, unknown>
  const extra = Object.keys(body).filter((k) => !(WORD_KEYS as readonly string[]).includes(k))
  if (extra.length) bad(`${prefix}${extra[0]}`, 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  if (opts.jlpt === false && 'jlpt' in body) bad(`${prefix}jlpt`, 'unknown_key', '넣을 수 없는 항목입니다: jlpt')
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

/** 단어 내용 칸 + 소유자(응답의 `origin` 계산용 — 응답에는 싣지 않는다). 상태 칸은 `WordEntry` 에서 읽지 않는다. */
const WORD_SELECT = {
  id: true, userId: true, surface: true, reading: true, meaning: true, partOfSpeech: true, chunkType: true, jlpt: true, example: true, exampleKo: true,
  note: true, category: true, source: true, sourceRefId: true, createdAt: true, updatedAt: true,
} as const

export type WordRow = {
  id: string; userId: string | null; surface: string; reading: string | null; meaning: string; partOfSpeech: PartOfSpeech; chunkType: ChunkType | null
  jlpt: JlptLevel | null; example: string | null; exampleKo: string | null; note: string | null; category: string | null; source: WordSource
  sourceRefId: string | null; createdAt: Date; updatedAt: Date
}

/** 응답 객체 — 칸을 하나씩 옮긴다(`userId`·`seedKey` 가 새지 않게). `state` 는 요청한 사용자의 상태(없으면 기본값). */
export function toWordDto(w: WordRow, state?: WordStateRow | null): WordDto {
  const s = state ?? EMPTY_WORD_STATE
  const origin: WordOrigin = w.userId === null ? 'BASE' : 'MINE'
  return {
    id: w.id, surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech, chunkType: w.chunkType, jlpt: w.jlpt,
    example: w.example, exampleKo: w.exampleKo, note: w.note, category: w.category, source: w.source, sourceRefId: w.sourceRefId,
    origin, readOnly: origin === 'BASE',
    correctCount: s.correctCount, wrongCount: s.wrongCount, lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null, lastResult: s.lastResult,
    archived: s.archived, archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
    favorite: s.favorite, favoritedAt: s.favoritedAt ? s.favoritedAt.toISOString() : null,
    createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString(),
  }
}

async function withStates(db: Pick<Tx, 'userWordState'>, userId: string, rows: readonly WordRow[]): Promise<WordDto[]> {
  const states = await loadWordStates(db, userId, rows.map((r) => r.id))
  return rows.map((r) => toWordDto(r, states.get(r.id)))
}

const JLPT_RANK: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }

/**
 * 기본 단어 순서(상세 ① — `jlpt` N5→N1, 같은 단계 안 `seedKey` 오름차순, 그다음 id). `seedKey` 글자 순만 보면 `N1-…` 이 먼저라
 * 단계를 먼저 본다. `jlpt` 없는 행(기본 단어엔 없음)은 맨 뒤.
 */
export function compareBaseWords(a: { jlpt: string | null; seedKey: string | null; id: string }, b: { jlpt: string | null; seedKey: string | null; id: string }): number {
  const ra = a.jlpt == null ? 9 : (JLPT_RANK[a.jlpt] ?? 9)
  const rb = b.jlpt == null ? 9 : (JLPT_RANK[b.jlpt] ?? 9)
  if (ra !== rb) return ra - rb
  const ka = a.seedKey ?? ''
  const kb = b.seedKey ?? ''
  if (ka !== kb) return ka < kb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 같은 사용자의 같은 표현(바이트 일치) id — 없으면 null. `excludeId` 는 수정 중인 자기 자신.
 * 같은 표기·다른 읽기 행이 여럿일 수 있어(task-051 기본 단어 팩, REV-179 M2) 가장 먼저 만든 행을 고른다 — `existingId` 가 호출마다 바뀌지 않게.
 */
async function findSameSurface(db: Tx, userId: string, surface: string, excludeId?: string): Promise<string | null> {
  const candidates = await db.wordEntry.findMany({
    where: { userId, surface, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, surface: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 50,
  })
  return candidates.find((c) => c.surface === surface)?.id ?? null
}

/**
 * 기본 단어 중 같은 단어(상세 ②) — 표기 바이트 일치이고 `reading === undefined`(보강 전 확인 — 읽기를 아직 모름)이거나
 * 입력 읽기가 비었거나 입력 읽기 = 그 기본 단어 읽기(앞뒤 공백 정리 뒤 바이트 일치). 여럿이면 기본 단어 순서의 첫 행.
 */
async function findBaseDuplicate(db: Tx, surface: string, reading: string | null | undefined): Promise<string | null> {
  const candidates = await db.wordEntry.findMany({
    where: { userId: null, source: 'SEED', surface },
    select: { id: true, surface: true, reading: true, jlpt: true, seedKey: true },
    orderBy: [{ jlpt: 'asc' }, { seedKey: 'asc' }, { id: 'asc' }],
    take: 200,
  })
  const want = reading === undefined ? undefined : (reading ?? '').trim()
  const hits = candidates.filter((c) => c.surface === surface && (want === undefined || want === '' || (c.reading ?? '').trim() === want))
  return hits.sort(compareBaseWords)[0]?.id ?? null
}

function conflictMine(existingId: string): ApiError {
  return new ApiError('CONFLICT', '단어장에 같은 표현이 이미 있어요.', { existingId })
}

function conflictBase(existingId: string): ApiError {
  return new ApiError('CONFLICT', '기본 단어에 이미 있어요.', { code: 'BASE_DUPLICATE', existingId })
}

function readOnly(message: string): ApiError {
  return new ApiError('FORBIDDEN', message, { code: 'READ_ONLY' })
}

/** #41 enrich 전 중복 확인(읽기 전용 — 저장은 사용자가 확인한 뒤 `createWord` 가 잠금 아래 다시 검사한다). 내 단어 먼저, 기본 단어는 표기만. */
export async function assertEnrichSurfaceFree(userId: string, surface: string): Promise<void> {
  const mine = await findSameSurface(prisma, userId, surface)
  if (mine) throw conflictMine(mine)
  const baseId = await findBaseDuplicate(prisma, surface, undefined)
  if (baseId) throw conflictBase(baseId)
}

export interface CreateWordOptions {
  /**
   * 채택 경로(#35 교정·#38 제안) 전용 — 기본 단어와 같은 단어면 새로 만들지 않고 **그 기본 단어**를 돌려준다(Leader L4:
   * 기본 단어 7.8천 개와의 흔한 충돌로 채택이 되돌려지지 않게). 돌려준 단어는 `origin === 'BASE'`. 내 단어끼리의 중복은 그대로 409.
   */
  linkBaseDuplicate?: boolean
}

/**
 * 단어 저장(#41 직접 저장은 자체 트랜잭션, 채택 경로는 라우트가 연 트랜잭션 `tx` 안). 같은 표현이 있으면 409 로 던져
 * 호출 트랜잭션 전체(교정·제안 상태 전이 포함)를 되돌린다. 저장 행 = 내 단어(`userId` = 나).
 */
export async function createWord(
  userId: string,
  input: WordInput & { source: WordSource; sourceRefId?: string | null },
  tx?: Tx,
  opts: CreateWordOptions = {},
): Promise<WordDto> {
  const run = async (db: Tx) => {
    await lockUserRow(db, userId)
    const existingId = await findSameSurface(db, userId, input.surface)
    if (existingId) throw conflictMine(existingId)
    const baseId = await findBaseDuplicate(db, input.surface, input.reading ?? null)
    if (baseId) {
      if (!opts.linkBaseDuplicate) throw conflictBase(baseId)
      const b = await db.wordEntry.findFirst({ where: { id: baseId, userId: null }, select: WORD_SELECT })
      if (!b) throw conflictBase(baseId)
      return (await withStates(db, userId, [b]))[0]!
    }
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


// ── task-008/068: #40 목록 · #42 상세 · #43 수정 · #44 삭제 · #45 보관 · #46 카테고리 ─────────────────────────────

const DAY_MS = 86_400_000
export const WORD_SORTS = ['recent', 'wrong', 'surface'] as const
export type WordSort = (typeof WORD_SORTS)[number]
export const WORD_SOURCE_FILTERS = ['all', 'mine', 'base'] as const
export type WordSourceFilter = (typeof WORD_SOURCE_FILTERS)[number]
export const WORD_PAGE_MAX = 100_000

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '단어를 찾을 수 없어요.')
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 40
}

export interface WordListQuery {
  q: string | null
  category: string | null
  chunkType: WordChunkType | null
  source: WordSourceFilter
  archived: boolean
  /** task-074 — `true` 면 내가 즐겨찾기한 단어만. `false` 는 조건 없음(「즐겨찾기 아닌 것만」이 아니다). */
  favorite: boolean
  sort: WordSort
  limit: number
  /** 1부터. */
  page: number
}

/**
 * #40 쿼리 — `q` ≤40·`category` ≤40(코드포인트), `chunkType` 5유형 한 값(`none` 폐지 — task-068), `source=all|mine|base`, `archived=0|1`, `favorite=0|1`(task-074),
 * `sort=recent|wrong|surface`, `page` 1~100,000(기본 1), `limit` 은 라우트가 1~100(기본 20)으로 읽어 넘긴다. `cursor` 는 400 `use_page`.
 * 열거값은 글자 그대로 비교한다(대소문자·쉼표 목록은 400). 같은 이름이 반복되면 첫 값.
 */
export function parseWordListQuery(params: URLSearchParams, limit: number): WordListQuery {
  const one = (name: string, max: number): string | null => {
    const raw = params.get(name)
    if (raw == null) return null
    const v = sanitizeText(raw)
    if (!v) return null
    if (codePointLength(v) > max) bad(name, `length ≤${max}`, `${name} 은(는) ${max}자 이내여야 합니다.`)
    return v
  }
  if (params.get('cursor') != null) bad('cursor', 'use_page', 'cursor 대신 page 를 보내 주세요.')
  const archived = params.get('archived')
  if (archived != null && archived !== '' && archived !== '0' && archived !== '1') bad('archived', '0|1', 'archived 는 0 또는 1 이어야 합니다.')
  const favorite = params.get('favorite')
  if (favorite != null && favorite !== '' && favorite !== '0' && favorite !== '1') bad('favorite', '0|1', 'favorite 는 0 또는 1 이어야 합니다.')
  const sort = params.get('sort') || 'recent'
  if (!(WORD_SORTS as readonly string[]).includes(sort)) bad('sort', WORD_SORTS.join('|'), 'sort 값이 올바르지 않습니다.')
  const chunk = params.get('chunkType') || null
  if (chunk !== null && !(WORD_CHUNK_TYPES as readonly string[]).includes(chunk)) bad('chunkType', WORD_CHUNK_TYPES.join('|'), 'chunkType 값이 올바르지 않습니다.')
  const source = params.get('source') || 'all'
  if (!(WORD_SOURCE_FILTERS as readonly string[]).includes(source)) bad('source', WORD_SOURCE_FILTERS.join('|'), 'source 값이 올바르지 않습니다.')
  const rawPage = params.get('page')
  let page = 1
  if (rawPage != null && rawPage !== '') {
    page = /^[0-9]{1,6}$/.test(rawPage) ? Number(rawPage) : 0
    if (page < 1 || page > WORD_PAGE_MAX) bad('page', `1~${WORD_PAGE_MAX}`, 'page 는 1 이상의 정수여야 합니다.')
  }
  return {
    q: one('q', 40),
    category: one('category', 40),
    chunkType: chunk as WordChunkType | null,
    source: source as WordSourceFilter,
    archived: archived === '1',
    favorite: favorite === '1',
    sort: sort as WordSort,
    limit,
    page,
  }
}

/** #40 where — 보이는 범위(출처) · 나의 보관 여부 · 나의 즐겨찾기(`favorite` 일 때만) · 분류 · 조각 · 검색은 모두 AND. */
export function wordListFilter(
  userId: string,
  q: Pick<WordListQuery, 'q' | 'category' | 'chunkType' | 'archived' | 'source'> & { favorite?: boolean },
): Prisma.WordEntryWhereInput {
  const like = q.q ? escapeLike(q.q) : null
  const scope: Prisma.WordEntryWhereInput = q.source === 'mine' ? { userId } : q.source === 'base' ? { userId: null, source: 'SEED' } : visibleWordWhere(userId)
  const and: Prisma.WordEntryWhereInput[] = [scope, q.archived ? archivedBy(userId) : notArchivedBy(userId)]
  if (q.favorite) and.push(favoritedBy(userId))
  if (q.category) and.push({ category: q.category })
  if (q.chunkType) and.push({ chunkType: q.chunkType })
  if (like) and.push({ OR: [{ surface: { contains: like } }, { reading: { contains: like } }, { meaning: { contains: like } }] })
  return { AND: and }
}

const MINE_RECENT: Prisma.WordEntryOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }]
const BASE_ORDER: Prisma.WordEntryOrderByWithRelationInput[] = [{ jlpt: 'asc' }, { seedKey: 'asc' }, { id: 'asc' }]
/**
 * 가나다순 — 같은 표기면 내 단어 먼저(`userId DESC`: MariaDB 는 DESC 에서 NULL 을 뒤로 둔다 — 보이는 행의 `userId` 는 나 또는 NULL 뿐),
 * 내 단어끼리 `id` 오름차순(`seedKey` 가 모두 NULL), 기본 단어끼리 `seedKey` 오름차순(상세 ①).
 */
const SURFACE_ORDER: Prisma.WordEntryOrderByWithRelationInput[] = [{ surface: 'asc' }, { userId: 'desc' }, { seedKey: 'asc' }, { id: 'asc' }]

/** 쪽 하나를 이어 붙일 순서 있는 묶음. `rows(skip, take)` 는 묶음 안 위치로 읽는다. */
interface Segment {
  count: number
  rows: (skip: number, take: number) => Promise<WordRow[]>
}

async function querySegment(where: Prisma.WordEntryWhereInput, orderBy: Prisma.WordEntryOrderByWithRelationInput[]): Promise<Segment> {
  const count = await prisma.wordEntry.count({ where })
  return { count, rows: (skip, take) => prisma.wordEntry.findMany({ where, orderBy, skip, take, select: WORD_SELECT }) }
}

/** 오프셋 `[offset, offset + limit)` 가 걸치는 묶음만 읽어 차례로 잇는다. */
async function readPage(segments: readonly Segment[], offset: number, limit: number): Promise<WordRow[]> {
  const out: WordRow[] = []
  let start = 0
  for (const seg of segments) {
    const from = Math.max(offset, start)
    const to = Math.min(offset + limit, start + seg.count)
    if (from < to) out.push(...(await seg.rows(from - start, to - from)))
    start += seg.count
  }
  return out
}

/**
 * 「많이 틀린」 앞 묶음 — 나의 `wrongCount > 0` 인 단어(모두 상태 행이 있다)를 읽어 JS 로 정렬한다
 * (틀린 수는 다른 테이블 칸이라 Prisma 정렬로 표현되지 않는다. 틀린 단어 수는 세트를 푼 단어 수를 넘지 않아 작다).
 * 같은 틀린 수 안에서는 「최근 추가」와 같은 순서(내 단어 `createdAt desc, id desc` → 기본 단어 순서).
 */
async function wrongSegment(userId: string, filter: Prisma.WordEntryWhereInput): Promise<Segment> {
  const rows = await prisma.wordEntry.findMany({
    where: { AND: [filter, { states: { some: { userId, wrongCount: { gt: 0 } } } }] },
    select: { id: true, userId: true, createdAt: true, jlpt: true, seedKey: true, states: { where: { userId }, select: { wrongCount: true } } },
  })
  const ordered = rows
    .map((r) => ({ ...r, wrong: r.states[0]?.wrongCount ?? 0 }))
    .sort((a, b) => {
      if (a.wrong !== b.wrong) return b.wrong - a.wrong
      if ((a.userId === null) !== (b.userId === null)) return a.userId === null ? 1 : -1
      if (a.userId === null) return compareBaseWords(a, b)
      const t = b.createdAt.getTime() - a.createdAt.getTime()
      return t || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
    })
    .map((r) => r.id)
  return {
    count: ordered.length,
    rows: async (skip, take) => {
      const ids = ordered.slice(skip, skip + take)
      if (!ids.length) return []
      const found = await prisma.wordEntry.findMany({ where: { id: { in: ids } }, select: WORD_SELECT })
      const byId = new Map(found.map((w) => [w.id, w]))
      return ids.map((id) => byId.get(id)).filter((w): w is WordRow => !!w)
    },
  }
}

export interface WordListPage {
  items: WordDto[]
  total: number
  page: number
  pages: number
  limit: number
  baseTotal: number
}

/**
 * #40 — 내 단어 + 공용 기본 단어(출처 필터), 나의 보관 여부, 쪽 번호(오프셋). 정렬·같은 값 순서는 상세 ①:
 * 최근 = 내 단어(`createdAt desc, id desc`) 전부 → 기본 단어(`jlpt` N5→N1 → `seedKey`) · 많이 틀린 = 나의 `wrongCount desc`(없으면 0) 뒤 최근 순서 ·
 * 가나다 = `surface asc` 뒤 내 단어 먼저. `total` = 조건을 다 건 전체 수, `baseTotal` = 기본 단어 전체 수(조건·보관과 무관).
 */
export async function listWords(userId: string, q: WordListQuery): Promise<WordListPage> {
  const filter = wordListFilter(userId, q)
  const mine: Prisma.WordEntryWhereInput = { AND: [filter, { userId }] }
  const baseOnly: Prisma.WordEntryWhereInput = { AND: [filter, { userId: null }] }
  const noWrong: Prisma.WordEntryWhereInput = { states: { none: { userId, wrongCount: { gt: 0 } } } }
  const wantMine = q.source !== 'base'
  const wantBase = q.source !== 'mine'
  const empty: Segment = { count: 0, rows: async () => [] }
  const [segments, baseTotal] = await Promise.all([
    q.sort === 'surface'
      ? Promise.all([querySegment(filter, SURFACE_ORDER)])
      : q.sort === 'wrong'
        ? Promise.all([
          wrongSegment(userId, filter),
          wantMine ? querySegment({ AND: [mine, noWrong] }, MINE_RECENT) : empty,
          wantBase ? querySegment({ AND: [baseOnly, noWrong] }, BASE_ORDER) : empty,
        ])
        : Promise.all([wantMine ? querySegment(mine, MINE_RECENT) : empty, wantBase ? querySegment(baseOnly, BASE_ORDER) : empty]),
    prisma.wordEntry.count({ where: { userId: null, source: 'SEED' } }),
  ])
  const total = segments.reduce((n, s) => n + s.count, 0)
  const rows = await readPage(segments, (q.page - 1) * q.limit, q.limit)
  return { items: await withStates(prisma, userId, rows), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)), limit: q.limit, baseTotal }
}

export interface WordDetail extends WordDto {
  stats: { attempts: number; last7d: { correct: number; wrong: number }; evalAppearances: number }
}

/**
 * #42 — 단어(내 단어 또는 기본 단어) + **요청한 사용자의** 풀이 통계(맞힘·틀림만, 건너뜀 제외). 기본 단어 id 는 모든 사용자의
 * 카드·문항이 가리키므로 세트·평가의 소유자로 좁힌다. `corrections` 는 L2 소유라 라우트가 conversation 에서 받아 붙인다.
 */
export async function getWordDetail(userId: string, id: string): Promise<WordDetail> {
  if (!isValidId(id)) throw notFound()
  const w = await prisma.wordEntry.findFirst({ where: { AND: [{ id }, visibleWordWhere(userId)] }, select: WORD_SELECT })
  if (!w) throw notFound()
  const graded = { in: ['CORRECT', 'WRONG'] as ('CORRECT' | 'WRONG')[] }
  const mineGraded = { wordId: id, answer: graded, session: { userId } }
  const [states, attempts, recent, evalAppearances] = await Promise.all([
    loadWordStates(prisma, userId, [id]),
    prisma.vocabAttempt.count({ where: mineGraded }),
    prisma.vocabAttempt.groupBy({ by: ['answer'], where: { ...mineGraded, answeredAt: { gte: new Date(Date.now() - 7 * DAY_MS) } }, _count: { _all: true } }),
    prisma.evaluationItem.count({ where: { wordId: id, evaluation: { userId } } }),
  ])
  const n = (a: string) => recent.find((r) => r.answer === a)?._count._all ?? 0
  return { ...toWordDto(w, states.get(id)), stats: { attempts, last7d: { correct: n('CORRECT'), wrong: n('WRONG') }, evalAppearances } }
}

/**
 * 수정에서 거절하는 칸 — 카운터·출처·보관 상태(지금 그대로) + `jlpt`(task-068: 내 단어는 수준을 고르지 않는다, 옛 값은 남는다)
 * + 즐겨찾기(task-074: #182/#183 으로만 바꾼다 — 수정 [저장]이 별을 건드리지 않게).
 */
const READ_ONLY_KEYS = [
  'id', 'source', 'sourceRefId', 'correctCount', 'wrongCount', 'lastSeenAt', 'lastResult', 'archived', 'archivedAt', 'favorite', 'favoritedAt', 'createdAt', 'updatedAt', 'jlpt',
]

export type WordPatch = Partial<Omit<WordInput, 'jlpt'>>

/**
 * #43 본문 — 보낸 키만 바꾼다. 카운터·출처·보관·즐겨찾기 상태·`jlpt` 는 `400 read_only`, 모르는 키는 `400 unknown_key`, 선택 값은 `null` 로 비운다.
 * `chunkType` 은 5유형 중 하나 — `null` 은 `400 required`(폼이 늘 고른다).
 */
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
  if ('chunkType' in raw) {
    if (raw.chunkType === null) bad('chunkType', 'required', '조각을 골라 주세요.')
    out.chunkType = oneOf(raw.chunkType, 'chunkType', WORD_CHUNK_TYPES)
  }
  if ('example' in raw) out.example = text(raw.example, 'example', 2_000, { multiline: true })
  if ('exampleKo' in raw) out.exampleKo = text(raw.exampleKo, 'exampleKo', 2_000, { multiline: true })
  if ('note' in raw) out.note = text(raw.note, 'note', 500, { multiline: true })
  if ('category' in raw) out.category = text(raw.category, 'category', 40)
  return out
}

/** 내 단어가 아닌 id 가 기본 단어인지(403 과 404 를 가른다 — 남의 단어는 존재를 숨겨 404). */
async function isBaseWord(db: Tx, id: string): Promise<boolean> {
  return (await db.wordEntry.count({ where: { id, userId: null, source: 'SEED' } })) > 0
}

/**
 * #43 — 내 단어만. 사용자 행 잠금 뒤 표현이 바뀌면 내 단어 중복(바이트 일치, 자기 자신 제외), 표현·읽기가 바뀌면 기본 단어 중복(상세 ②).
 * 기본 단어 id 는 `403 READ_ONLY`(행 변경 없음), 남의 단어는 404.
 */
export async function updateWord(userId: string, id: string, patch: WordPatch): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const cur = await tx.wordEntry.findFirst({ where: { id, userId }, select: { surface: true, reading: true } })
    if (!cur) {
      if (await isBaseWord(tx, id)) throw readOnly('기본 단어는 고칠 수 없어요.')
      throw notFound()
    }
    const surfaceChanged = patch.surface !== undefined && patch.surface !== cur.surface
    const readingChanged = patch.reading !== undefined && patch.reading !== cur.reading
    if (surfaceChanged) {
      const existingId = await findSameSurface(tx, userId, patch.surface!, id)
      if (existingId) throw conflictMine(existingId)
    }
    if (surfaceChanged || readingChanged) {
      const baseId = await findBaseDuplicate(tx, patch.surface ?? cur.surface, patch.reading !== undefined ? patch.reading : cur.reading)
      if (baseId) throw conflictBase(baseId)
    }
    const w = Object.keys(patch).length
      ? await tx.wordEntry.update({ where: { id, userId }, data: patch, select: WORD_SELECT })
      : await tx.wordEntry.findFirstOrThrow({ where: { id, userId }, select: WORD_SELECT })
    return (await withStates(tx, userId, [w]))[0]!
  })
}

/**
 * #44 — 내 단어 행 삭제(그 단어의 `UserWordState` 는 cascade). 참조(`VocabAttempt.wordId`·`Correction.savedWordId`·`EvaluationItem.wordId`)는
 * DB FK `ON DELETE SET NULL` 이 끊고 `*Snap` 이 이력을 지킨다. `StatsSnapshot` 은 건드리지 않는다(domain-model 규칙 2). 사용자 행을 먼저 잡아
 * 같은 사용자의 finish(카운터 갱신)와 순서를 맞춘다. 기본 단어 id 는 `403 READ_ONLY`, 남의 단어는 404.
 */
export async function deleteWord(userId: string, id: string): Promise<{ deleted: true; snapshotKept: true }> {
  if (!isValidId(id)) throw notFound()
  await withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const res = await tx.wordEntry.deleteMany({ where: { id, userId } })
    if (res.count === 0) {
      if (await isBaseWord(tx, id)) throw readOnly('기본 단어는 지울 수 없어요.')
      throw notFound()
    }
  })
  return { deleted: true, snapshotKept: true }
}

/**
 * #45 보관 토글(트랜잭션 `tx` 안) — 내 단어·기본 단어 모두(D6, 나에게만 숨김). 쓰는 곳은 `UserWordState(나, id)` upsert 뿐이고
 * `WordEntry` 행은 바꾸지 않는다. 이미 그 상태면 그대로 돌려준다(`archivedAt` 유지). 남의 단어는 404.
 * 사용자 행을 먼저 잡는다 — 세트 생성(#47)도 사용자 행을 잡고 풀을 읽으므로, 보관이 끝난 뒤 만들어진 세트에 그 단어가 섞이지 않는다(Codex C2).
 */
export async function setWordArchivedTx(tx: Tx, userId: string, id: string, archived: boolean): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  await lockUserRow(tx, userId)
  const w = await tx.wordEntry.findFirst({ where: { AND: [{ id }, visibleWordWhere(userId)] }, select: WORD_SELECT })
  if (!w) throw notFound()
  const key = { userId_wordId: { userId, wordId: id } }
  const cur = await tx.userWordState.findUnique({ where: key, select: WORD_STATE_FIELDS })
  if ((cur?.archived ?? false) === archived) return toWordDto(w, cur)
  const data = { archived, archivedAt: archived ? new Date() : null }
  const next = await tx.userWordState.upsert({ where: key, create: { userId, wordId: id, ...data }, update: data, select: WORD_STATE_FIELDS })
  return toWordDto(w, next)
}

/** #45 — `setWordArchivedTx` 를 자체 트랜잭션으로. */
export async function setWordArchived(userId: string, id: string, archived: boolean): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  return withTransaction((tx) => setWordArchivedTx(tx, userId, id, archived))
}

/**
 * #182/#183 즐겨찾기 토글(task-074, 트랜잭션 `tx` 안) — 보관(#45)과 같은 모양: 보이는 단어(내 단어·기본 단어)만, 남의 단어·없는 id 는 404,
 * 쓰는 곳은 `UserWordState(나, id)` 의 `favorite`·`favoritedAt` 뿐(`WordEntry`·보관 칸은 그대로). 이미 그 상태면 쓰지 않고 그대로 돌려준다
 * (켜기 두 번 = `favoritedAt` 유지, 행이 없는데 끄기 = 행을 만들지 않음). 사용자 행을 먼저 잡는다 — 빠른 연타 두 요청이 같은 상태 행을
 * 동시에 만들려다 유니크 충돌로 500 이 나지 않게.
 */
export async function setWordFavoriteTx(tx: Tx, userId: string, id: string, favorite: boolean): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  await lockUserRow(tx, userId)
  const w = await tx.wordEntry.findFirst({ where: { AND: [{ id }, visibleWordWhere(userId)] }, select: WORD_SELECT })
  if (!w) throw notFound()
  const key = { userId_wordId: { userId, wordId: id } }
  const cur = await tx.userWordState.findUnique({ where: key, select: WORD_STATE_FIELDS })
  if ((cur?.favorite ?? false) === favorite) return toWordDto(w, cur)
  const data = { favorite, favoritedAt: favorite ? new Date() : null }
  const next = await tx.userWordState.upsert({ where: key, create: { userId, wordId: id, ...data }, update: data, select: WORD_STATE_FIELDS })
  return toWordDto(w, next)
}

/** #182/#183 — `setWordFavoriteTx` 를 자체 트랜잭션으로. */
export async function setWordFavorite(userId: string, id: string, favorite: boolean): Promise<WordDto> {
  if (!isValidId(id)) throw notFound()
  return withTransaction((tx) => setWordFavoriteTx(tx, userId, id, favorite))
}

export interface CategoryCount {
  category: string | null
  /** 내가 보관하지 않은 단어 수(F6). */
  count: number
  archivedCount: number
}

/** #46 묶음 이름 — 기본 단어·분류 없음·난이도 이름 분류(D3 B)는 모두 `null` 묶음(칩으로 나오지 않는다). */
export function categoryBucketOf(row: { category: string | null; userId: string | null }): string | null {
  if (row.userId === null || row.category === null || isLevelCategory(row.category)) return null
  return row.category
}

/**
 * #46 — 「내 단어 + 기본 단어」의 분류별 개수(나의 보관 기준 `count`·`archivedCount`). 난이도 이름·기본 단어는 `null` 묶음에 합친다
 * — 모든 묶음의 합은 접기 전과 같다(「전체」·평가 시작 단어 수). 많은 순, 같으면 이름 순, `null` 은 끝.
 */
export async function listCategories(userId: string): Promise<CategoryCount[]> {
  const visible = visibleWordWhere(userId)
  const [all, archived] = await Promise.all([
    prisma.wordEntry.groupBy({ by: ['category', 'userId'], where: visible, _count: { _all: true } }),
    prisma.wordEntry.groupBy({ by: ['category', 'userId'], where: { AND: [visible, archivedBy(userId)] }, _count: { _all: true } }),
  ])
  const map = new Map<string | null, CategoryCount>()
  const bucket = (k: string | null) => {
    const c = map.get(k) ?? { category: k, count: 0, archivedCount: 0 }
    map.set(k, c)
    return c
  }
  for (const r of all) bucket(categoryBucketOf(r)).count += r._count._all
  for (const r of archived) {
    const c = bucket(categoryBucketOf(r))
    c.count -= r._count._all
    c.archivedCount += r._count._all
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

/** #41 보강 경로 본문 — 키는 단어 필드만 허용(`enrich` 는 라우트가 뺀다, `jlpt` 는 #41 에서 거절), 검증 대상은 표현(1~80)뿐. 나머지는 저장하지 않으므로 쓰지 않는다. */
export function parseEnrichSurface(body: Record<string, unknown>): string {
  const extra = Object.keys(body).filter((k) => k === 'jlpt' || !(WORD_KEYS as readonly string[]).includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  return text(body.surface, 'surface', 80, { required: true }) as string
}
