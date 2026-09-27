/**
 * 단어장 최소판(task-006 범위결정 8) — `createWord` 와 입력 검증만. 목록·수정·삭제·화면은 task-008.
 * 검증 한도는 api-contract #41(코드포인트 기준): surface 1~80 · reading ≤120 · meaning 1~200 · example/exampleKo ≤2,000 · note ≤500 · category ≤40.
 *
 * **같은 표현(surface) 중복은 `409 { existingId }`.** 스키마에 (userId, surface) 유니크가 없으므로 사용자 행을 잠근 뒤 확인한다
 * (동시 채택 두 건이 같은 단어를 두 번 만들지 않게). 비교는 **바이트 일치**다 — DB 콜레이션(utf8mb4_unicode_ci)은
 * 「はは」와 「ぱぱ」, 히라가나와 가타카나를 같게 보므로 DB 로는 후보만 좁히고 최종 판정은 JS `===` 로 한다.
 */
import type { ChunkType, JlptLevel, PartOfSpeech, WordSource } from '@prisma/client'
import { ApiError, codePointLength, lockUserRow, sanitizeText, withTransaction, type Tx } from '@/modules/infra'

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

type WordRow = Omit<WordDto, 'lastSeenAt' | 'createdAt' | 'updatedAt'> & { lastSeenAt: Date | null; createdAt: Date; updatedAt: Date }

export function toWordDto(w: WordRow): WordDto {
  return { ...w, lastSeenAt: w.lastSeenAt ? w.lastSeenAt.toISOString() : null, createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString() }
}

const WORD_SELECT = {
  id: true, surface: true, reading: true, meaning: true, partOfSpeech: true, chunkType: true, jlpt: true, example: true, exampleKo: true,
  note: true, category: true, source: true, sourceRefId: true, correctCount: true, wrongCount: true, lastSeenAt: true, lastResult: true,
  archived: true, createdAt: true, updatedAt: true,
} as const

/** 같은 사용자의 같은 표현(바이트 일치) id — 없으면 null. */
async function findSameSurface(db: Tx, userId: string, surface: string): Promise<string | null> {
  const candidates = await db.wordEntry.findMany({ where: { userId, surface }, select: { id: true, surface: true }, take: 50 })
  return candidates.find((c) => c.surface === surface)?.id ?? null
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

