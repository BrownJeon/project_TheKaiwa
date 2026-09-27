/**
 * 오늘의 단어 세트(api-contract #47~#53, design-spec §7-2, task-008 E2~E7·F1~F9).
 *
 * 정답 미노출: CHOICE 세트의 **미답 카드**에는 정답 뜻·예문·정답 위치가 실리지 않는다(보기 순서는 시드 셔플). 채점은 서버.
 * FLIP 세트는 자기 채점이라 뜻·예문을 처음부터 싣는다(F1).
 *
 * 잠금 순서(교착 방지 — task-006 과 같은 "사용자 행 → 대상 행"):
 *   - 생성·다시 풀기: 사용자 행 → (진행 중 세트 확인) → 세트·카드 생성
 *   - 답(attempt): 세트 행(`FOR UPDATE`) → 카드 행 조건부 갱신(`answer IS NULL`)
 *   - 조회(#49): 세트 행(`FOR UPDATE`) → 카드 읽기(끝내기 도중의 반쯤 바뀐 상태를 읽지 않게)
 *   - 보관(#52): 사용자 행 → 세트 행(다시 풀기와 직렬화)
 *   - 끝내기(finish): 사용자 행 → 세트 행 → 카드 → 단어 카운터 → StudyLog → 스냅샷(VOCAB_SESSION·DAILY)
 *   - 단어 삭제·수정·보관(words.*)도 사용자 행을 먼저 잡는다 → finish 의 카운터 갱신·세트 생성의 풀 읽기와 직렬화된다.
 * answer 와 finish 는 같은 세트 행을 잡으므로 서로의 중간 상태를 보지 않는다(답이 먼저면 집계에 들어가고, finish 가 먼저면 답은 409).
 */
import type { PartOfSpeech, Prisma, VocabAnswer, VocabMode, VocabSessionStatus } from '@prisma/client'
import { ApiError, codePointLength, dates, decodeCursor, encodeCursor, isTimeIdCursor, lockUserRow, prisma, sanitizeText, withTransaction, type Tx } from '@/modules/infra'
import { recordStudyLog } from '../studyLog'
import { bumpDailySnapshot, createVocabSessionSnapshot } from '../snapshots'
import { distinctMeaningCount, pickChoices, CHOICE_COUNT, type MeaningSource } from './distractors'
import { createRng, generateWordSet, newSeed, requestedModeOf, shuffle } from './setGenerator'
import { isValidId } from './words'

export const SET_COUNT_MIN = 5
export const SET_COUNT_MAX = 30
export const RESPONSE_MS_MAX = 60_000
/** 걸린 시간 상한 — 세트를 두고 떠났다가 며칠 뒤 끝내도 통계가 망가지지 않게 1시간에서 자른다. */
export const DURATION_CAP_SEC = 3_600
export const VOCAB_MODES = ['CHOICE', 'FLIP'] as const
export const VOCAB_SESSION_STATUSES = ['IN_PROGRESS', 'DONE', 'ABANDONED'] as const

export type EmptyReason = 'NO_WORDS' | 'ALL_DONE_TODAY' | 'NO_WORDS_IN_CATEGORY'

export interface VocabSessionDto {
  id: string
  date: string
  mode: VocabMode
  requestedCount: number
  cardCount: number
  status: VocabSessionStatus
  startedAt: string
  finishedAt: string | null
  /** 요청은 CHOICE 였는데 FLIP 으로 만들어졌는지(풀 <4·서로 다른 뜻 <4·삭제된 단어 포함 다시 풀기). */
  downgraded: boolean
  correctCount: number
  wrongCount: number
  skippedCount: number
  durationSec: number | null
  keptAt: string | null
  replayOfId: string | null
}

export interface VocabCardDto {
  order: number
  wordId: string | null
  surface: string
  reading: string | null
  /** CHOICE 만 — 셔플된 4개. 정답 위치는 알려 주지 않는다. */
  choices?: string[]
  flagged: boolean
  answered: boolean
  /** FLIP 세트(F1) 또는 답한 카드·끝난 세트에서만. */
  meaning?: string
  example?: string | null
  exampleKo?: string | null
  answer?: VocabAnswer | null
  correctText?: string
  chosenText?: string | null
  answeredAt?: string | null
}

export type CreateSessionResult =
  | { session: VocabSessionDto; cards: VocabCardDto[] }
  | { session: null; empty: { reason: EmptyReason; cta: string[] } }

const SESSION_SELECT = {
  id: true, date: true, mode: true, requestedCount: true, cardCount: true, correctCount: true, wrongCount: true, skippedCount: true,
  status: true, keptAt: true, replayOfId: true, seed: true, startedAt: true, finishedAt: true, durationSec: true,
} as const
type SessionRow = Prisma.VocabSessionGetPayload<{ select: typeof SESSION_SELECT }>

const ATTEMPT_SELECT = {
  id: true, order: true, wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, choices: true, answer: true,
  chosenText: true, flagged: true, answeredAt: true, word: { select: { example: true, exampleKo: true } },
} as const
type AttemptRow = Prisma.VocabAttemptGetPayload<{ select: typeof ATTEMPT_SELECT }>

const POOL_SELECT = {
  id: true, surface: true, reading: true, meaning: true, partOfSpeech: true, correctCount: true, wrongCount: true, lastSeenAt: true,
  example: true, exampleKo: true,
} as const
type PoolWord = Prisma.WordEntryGetPayload<{ select: typeof POOL_SELECT }>

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '세트를 찾을 수 없어요.')
}

function toSessionDto(s: SessionRow): VocabSessionDto {
  return {
    id: s.id,
    date: dates.fromDbDate(s.date),
    mode: s.mode,
    requestedCount: s.requestedCount,
    cardCount: s.cardCount,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
    downgraded: requestedModeOf(s.seed) === 'CHOICE' && s.mode === 'FLIP',
    correctCount: s.correctCount,
    wrongCount: s.wrongCount,
    skippedCount: s.skippedCount,
    durationSec: s.durationSec,
    keptAt: s.keptAt ? s.keptAt.toISOString() : null,
    replayOfId: s.replayOfId,
  }
}

function parseChoices(raw: Prisma.JsonValue | null): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 카드 직렬화 — **정답 미노출 규칙이 사는 곳**. CHOICE 미답 카드는 order·표기·읽기·보기·표시 여부만 나간다.
 * 전 카드 정답은 **DONE 세트에서만**(결과 화면, api-contract #49). ABANDONED(답 0장으로 닫힌 세트, F2)는 "본 적 없는 세트"라
 * 진행 중과 똑같이 숨긴다 — 오늘 DONE 제외 규칙이 적용되지 않아 같은 단어가 다음 세트에 다시 나오기 때문(REV-008 H1).
 */
export function toCardDto(mode: VocabMode, status: VocabSessionStatus, a: Omit<AttemptRow, 'id'>): VocabCardDto {
  const answered = a.answer != null
  const card: VocabCardDto = { order: a.order, wordId: a.wordId, surface: a.surfaceSnap, reading: a.readingSnap, flagged: a.flagged, answered }
  if (mode === 'CHOICE') card.choices = parseChoices(a.choices)
  const reveal = answered || status === 'DONE'
  if (mode === 'FLIP' || reveal) {
    card.example = a.word?.example ?? null
    card.exampleKo = a.word?.exampleKo ?? null
  }
  if (mode === 'FLIP') card.meaning = a.meaningSnap
  if (reveal) {
    card.answer = a.answer
    card.correctText = a.meaningSnap
    card.chosenText = a.chosenText
    card.answeredAt = a.answeredAt ? a.answeredAt.toISOString() : null
  }
  return card
}

// ── 입력 검증 ────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  count?: number
  mode: VocabMode
  category: string | null
}

function intIn(raw: unknown, field: string, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) bad(field, `${min}~${max}`, `${field} 은(는) ${min}~${max} 사이 정수여야 합니다.`)
  return raw
}

/** #47 본문 — `count` 5~30(생략 시 프로필 기본), `mode` CHOICE|FLIP(기본 CHOICE), `category` ≤40 또는 null(전체). */
export function parseCreateSessionBody(body: Record<string, unknown>): CreateSessionInput {
  const extra = Object.keys(body).filter((k) => !['count', 'mode', 'category'].includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  const count = body.count == null ? undefined : intIn(body.count, 'count', SET_COUNT_MIN, SET_COUNT_MAX)
  if (body.mode != null && !(VOCAB_MODES as readonly unknown[]).includes(body.mode)) bad('mode', VOCAB_MODES.join('|'), 'mode 값이 올바르지 않습니다.')
  let category: string | null = null
  if (body.category != null) {
    if (typeof body.category !== 'string') bad('category', 'string', 'category 형식이 올바르지 않습니다.')
    category = sanitizeText(body.category) || null
    if (category && codePointLength(category) > 40) bad('category', 'length ≤40', 'category 는 40자 이내여야 합니다.')
  }
  return { count, mode: (body.mode as VocabMode | undefined) ?? 'CHOICE', category }
}

export type AttemptInput =
  | { kind: 'flag'; order: number; flagged: boolean }
  | { kind: 'choice'; order: number; chosenText: string; responseMs: number | null; flagged?: boolean }
  | { kind: 'flip'; order: number; selfResult: 'CORRECT' | 'WRONG'; responseMs: number | null; flagged?: boolean }
  | { kind: 'skip'; order: number; responseMs: number | null; flagged?: boolean }

const ATTEMPT_KEYS = ['order', 'chosenText', 'selfResult', 'skipped', 'responseMs', 'flagged']

/**
 * #50 본문 — 답 필드(`chosenText`·`selfResult`·`skipped:true`)는 정확히 하나. 답 필드가 없으면 `{order, flagged}` 표시 전용(E2).
 * `responseMs` 0~60,000 정수(선택).
 */
export function parseAttemptBody(body: Record<string, unknown>): AttemptInput {
  const extra = Object.keys(body).filter((k) => !ATTEMPT_KEYS.includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  const order = intIn(body.order, 'order', 0, SET_COUNT_MAX - 1)
  if (body.flagged !== undefined && typeof body.flagged !== 'boolean') bad('flagged', 'boolean', 'flagged 는 true/false 여야 합니다.')
  const flagged = body.flagged as boolean | undefined
  const responseMs = body.responseMs == null ? null : intIn(body.responseMs, 'responseMs', 0, RESPONSE_MS_MAX)
  if (body.skipped !== undefined && body.skipped !== true) bad('skipped', 'true', 'skipped 는 true 만 보낼 수 있습니다.')
  const answerKeys = ['chosenText', 'selfResult', 'skipped'].filter((k) => body[k] !== undefined)
  if (answerKeys.length > 1) bad(answerKeys[1], 'one_answer', '답은 한 가지만 보낼 수 있습니다.')
  if (answerKeys.length === 0) {
    if (flagged === undefined) bad('flagged', 'required', '보낼 답이나 표시가 없습니다.')
    if (body.responseMs != null) bad('responseMs', 'answer_required', 'responseMs 는 답과 함께만 보낼 수 있습니다.')
    return { kind: 'flag', order, flagged }
  }
  if (body.chosenText !== undefined) {
    if (typeof body.chosenText !== 'string' || !body.chosenText || codePointLength(body.chosenText) > 200) bad('chosenText', 'string 1~200', 'chosenText 형식이 올바르지 않습니다.')
    return { kind: 'choice', order, chosenText: body.chosenText, responseMs, flagged }
  }
  if (body.selfResult !== undefined) {
    if (body.selfResult !== 'CORRECT' && body.selfResult !== 'WRONG') bad('selfResult', 'CORRECT|WRONG', 'selfResult 는 CORRECT 또는 WRONG 이어야 합니다.')
    return { kind: 'flip', order, selfResult: body.selfResult, responseMs, flagged }
  }
  return { kind: 'skip', order, responseMs, flagged }
}

// ── 공통 ─────────────────────────────────────────────────────────────────────

async function assertNoInProgress(tx: Tx, userId: string): Promise<void> {
  const cur = await tx.vocabSession.findFirst({ where: { userId, status: 'IN_PROGRESS' }, select: { id: true }, orderBy: { startedAt: 'desc' } })
  if (cur) throw new ApiError('CONFLICT', '풀던 세트가 있어요. 이어서 풀거나 끝낸 뒤 새로 시작해 주세요.', { sessionId: cur.id })
}

/** 세트 행 잠금(소유자 조건 포함) — 없거나 남의 것이면 404. 잠근 뒤 최신 행을 읽는다(READ COMMITTED). */
async function lockSession(tx: Tx, userId: string, id: string): Promise<SessionRow> {
  if (!isValidId(id)) throw notFound()
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM VocabSession WHERE id = ${id} AND userId = ${userId} FOR UPDATE`
  if (!rows.length) throw notFound()
  return tx.vocabSession.findUniqueOrThrow({ where: { id }, select: SESSION_SELECT })
}

interface CardSeed {
  wordId: string | null
  surface: string
  reading: string | null
  meaning: string
  partOfSpeech: PartOfSpeech
  example: string | null
  exampleKo: string | null
}

/**
 * 세트 행 + 카드 행 생성(카드 = `answer=null` 인 VocabAttempt, 표기·읽기·뜻·보기 스냅샷). CHOICE 인데 한 카드라도 보기를
 * 만들 수 없으면 세트 전체를 FLIP 으로 내린다(E6).
 */
async function insertSession(
  tx: Tx,
  userId: string,
  opts: { seed: string; mode: VocabMode; requestedCount: number; replayOfId: string | null; cards: CardSeed[]; sources: MeaningSource[]; rng: () => number },
): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  let mode = opts.mode
  let choices: (string[] | null)[] = opts.cards.map(() => null)
  if (mode === 'CHOICE') {
    choices = opts.cards.map((c) => pickChoices(c, opts.sources, opts.rng))
    if (choices.some((c) => !c || c.length !== CHOICE_COUNT)) {
      mode = 'FLIP'
      choices = opts.cards.map(() => null)
    }
  }
  const s = await tx.vocabSession.create({
    data: {
      userId, date: dates.toDbDate(dates.todayKst()), mode, requestedCount: opts.requestedCount, cardCount: opts.cards.length,
      seed: opts.seed, replayOfId: opts.replayOfId,
    },
    select: SESSION_SELECT,
  })
  const rows = opts.cards.map((c, order) => ({
    sessionId: s.id, wordId: c.wordId, order, surfaceSnap: c.surface, readingSnap: c.reading, meaningSnap: c.meaning,
    choices: (choices[order] ?? undefined) as Prisma.InputJsonValue | undefined,
  }))
  await tx.vocabAttempt.createMany({ data: rows })
  const cards = opts.cards.map((c, order) =>
    toCardDto(mode, 'IN_PROGRESS', {
      order, wordId: c.wordId, surfaceSnap: c.surface, readingSnap: c.reading, meaningSnap: c.meaning, choices: choices[order],
      answer: null, chosenText: null, flagged: false, answeredAt: null, word: c.wordId ? { example: c.example, exampleKo: c.exampleKo } : null,
    }),
  )
  return { session: toSessionDto(s), cards }
}

function toCardSeed(w: PoolWord): CardSeed {
  return { wordId: w.id, surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech, example: w.example, exampleKo: w.exampleKo }
}

// ── #47 세트 생성 ────────────────────────────────────────────────────────────

/**
 * 풀 = 보관 안 한 단어(카테고리 필터) − 오늘(KST) 끝낸 세트의 단어. 풀 0 → 빈 상태(F5 사유). 풀 <4 또는 서로 다른 뜻 <4 → FLIP 강등.
 * `count` 는 라우트가 채운다(요청값 또는 `Profile.dailyWordCount`).
 */
export async function createVocabSession(userId: string, input: { count: number; mode: VocabMode; category: string | null }): Promise<CreateSessionResult> {
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    await assertNoInProgress(tx, userId)
    const empty = (reason: EmptyReason): CreateSessionResult => ({
      session: null,
      empty: { reason, cta: reason === 'NO_WORDS' ? ['ADD_WORD', 'SEED_PACK'] : reason === 'NO_WORDS_IN_CATEGORY' ? ['ALL_CATEGORIES', 'ADD_WORD'] : [] },
    })
    const active = await tx.wordEntry.findMany({ where: { userId, archived: false }, select: POOL_SELECT })
    if (!active.length) return empty('NO_WORDS')
    // 카테고리 비교는 목록(#40)·집계(#46)와 같은 DB 콜레이션으로 한다.
    const inCategory = input.category
      ? new Set((await tx.wordEntry.findMany({ where: { userId, archived: false, category: input.category }, select: { id: true } })).map((w) => w.id))
      : null
    const candidates = inCategory ? active.filter((w) => inCategory.has(w.id)) : active
    if (!candidates.length) return empty('NO_WORDS_IN_CATEGORY')
    const doneToday = await tx.vocabAttempt.findMany({
      where: { wordId: { not: null }, session: { userId, status: 'DONE', date: dates.toDbDate(dates.todayKst()) } },
      select: { wordId: true },
    })
    const exclude = new Set(doneToday.map((a) => a.wordId))
    const pool = candidates.filter((w) => !exclude.has(w.id))
    if (!pool.length) return empty('ALL_DONE_TODAY')

    const seed = newSeed(input.mode)
    const rng = createRng(seed)
    const picked = generateWordSet(pool, input.count, rng, new Date())
    const mode: VocabMode = input.mode === 'CHOICE' && (pool.length < 4 || distinctMeaningCount(active) < CHOICE_COUNT) ? 'FLIP' : input.mode
    return insertSession(tx, userId, { seed, mode, requestedCount: input.count, replayOfId: null, cards: picked.map(toCardSeed), sources: active, rng })
  })
}

// ── #48 목록 · #49 조회 ──────────────────────────────────────────────────────

export interface SessionSummaryDto extends VocabSessionDto {
  /** 사용자가 직접 답한 카드 수(끝낼 때 자동 SKIPPED 는 제외). */
  answeredCount: number
}

export interface SessionListQuery {
  kept: boolean | null
  status: VocabSessionStatus | null
  limit: number
  cursor: string | null
}

export function parseSessionListQuery(params: URLSearchParams, limit: number): SessionListQuery {
  const kept = params.get('kept')
  if (kept != null && kept !== '' && kept !== '0' && kept !== '1') bad('kept', '0|1', 'kept 는 0 또는 1 이어야 합니다.')
  const status = params.get('status')
  if (status && !(VOCAB_SESSION_STATUSES as readonly string[]).includes(status)) bad('status', VOCAB_SESSION_STATUSES.join('|'), 'status 값이 올바르지 않습니다.')
  return { kept: kept === '1' ? true : kept === '0' ? false : null, status: (status || null) as VocabSessionStatus | null, limit, cursor: params.get('cursor') }
}

/** #48 — `startedAt desc`(F3), `kept`·`status` 필터, 항목마다 `answeredCount`. */
export async function listVocabSessions(userId: string, q: SessionListQuery): Promise<{ items: SessionSummaryDto[]; nextCursor: string | null }> {
  const cur = decodeCursor(q.cursor, isTimeIdCursor)
  const where: Prisma.VocabSessionWhereInput = {
    userId,
    ...(q.kept === true ? { keptAt: { not: null } } : q.kept === false ? { keptAt: null } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(cur ? { OR: [{ startedAt: { lt: new Date(cur.t) } }, { startedAt: new Date(cur.t), id: { lt: cur.id } }] } : {}),
  }
  const rows = await prisma.vocabSession.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: q.limit + 1, select: SESSION_SELECT })
  const page = rows.slice(0, q.limit)
  const counts = page.length
    ? await prisma.vocabAttempt.groupBy({ by: ['sessionId'], where: { sessionId: { in: page.map((s) => s.id) }, answeredAt: { not: null } }, _count: { _all: true } })
    : []
  const answered = new Map(counts.map((c) => [c.sessionId, c._count._all]))
  const last = page.at(-1)
  return {
    items: page.map((s) => ({ ...toSessionDto(s), answeredCount: answered.get(s.id) ?? 0 })),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.startedAt.toISOString(), id: last.id }) : null,
  }
}

/**
 * #49 조회(트랜잭션 `tx` 안) — 세트 행을 답·끝내기와 같은 `FOR UPDATE` 로 잡고 카드를 이어 읽는다. finish 는 카드를 SKIPPED 로
 * 바꾼 뒤 세트를 DONE 으로 바꾸므로, 잠금 없이 두 번 읽으면 "IN_PROGRESS 세트 + SKIPPED 확정 카드(정답 공개)" 조합이 보일 수 있다(Codex C2).
 */
export async function readVocabSessionTx(tx: Tx, userId: string, id: string): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  const s = await lockSession(tx, userId, id)
  const attempts = await tx.vocabAttempt.findMany({ where: { sessionId: id }, orderBy: { order: 'asc' }, select: ATTEMPT_SELECT })
  return { session: toSessionDto(s), cards: attempts.map((a) => toCardDto(s.mode, s.status, a)) }
}

/** #49 — #47 형태. 답한 카드·DONE 세트만 정답 포함. */
export async function getVocabSession(userId: string, id: string): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  if (!isValidId(id)) throw notFound()
  return withTransaction((tx) => readVocabSessionTx(tx, userId, id))
}

// ── #50 답 ───────────────────────────────────────────────────────────────────

export interface AttemptResultDto {
  order: number
  answer: VocabAnswer
  correctText: string
  chosenText: string | null
  example: string | null
  exampleKo: string | null
  answeredAt: string | null
  flagged: boolean
}

function toAttemptResult(a: AttemptRow): AttemptResultDto {
  return {
    order: a.order,
    answer: a.answer as VocabAnswer,
    correctText: a.meaningSnap,
    chosenText: a.chosenText,
    example: a.word?.example ?? null,
    exampleKo: a.word?.exampleKo ?? null,
    answeredAt: a.answeredAt ? a.answeredAt.toISOString() : null,
    flagged: a.flagged,
  }
}

/**
 * #50 — 세트 행을 잠그고 `IN_PROGRESS` 확인(아니면 409). 같은 `order` 에 이미 답이 있으면 **첫 결과를 그대로**(변경 없음).
 * 갱신은 `answer IS NULL` 조건부라 잠금이 없더라도 두 번 쓰이지 않는다. 표시 전용 요청은 `{order, flagged}` 만 돌려준다(F9).
 */
export async function recordAttempt(userId: string, id: string, input: AttemptInput): Promise<AttemptResultDto | { order: number; flagged: boolean }> {
  return withTransaction(async (tx) => {
    const s = await lockSession(tx, userId, id)
    if (s.status !== 'IN_PROGRESS') throw new ApiError('CONFLICT', '이미 끝난 세트예요.', { status: s.status })
    const a = await tx.vocabAttempt.findUnique({ where: { sessionId_order: { sessionId: id, order: input.order } }, select: ATTEMPT_SELECT })
    if (!a) bad('order', `0~${s.cardCount - 1}`, 'order 가 세트 범위 밖입니다.')
    if (input.kind === 'flag') {
      if (a.flagged !== input.flagged) await tx.vocabAttempt.update({ where: { id: a.id }, data: { flagged: input.flagged } })
      return { order: a.order, flagged: input.flagged }
    }
    if (input.kind === 'choice' && s.mode !== 'CHOICE') bad('chosenText', 'mode', '뒤집기 세트에는 보기 답을 보낼 수 없습니다.')
    if (input.kind === 'flip' && s.mode !== 'FLIP') bad('selfResult', 'mode', '보기 세트에는 자기 채점을 보낼 수 없습니다.')
    if (input.kind === 'choice' && !parseChoices(a.choices).includes(input.chosenText)) bad('chosenText', 'not_in_choices', '보기에 없는 답입니다.')
    if (a.answer != null) return toAttemptResult(a)
    const answer: VocabAnswer = input.kind === 'choice' ? (input.chosenText === a.meaningSnap ? 'CORRECT' : 'WRONG') : input.kind === 'flip' ? input.selfResult : 'SKIPPED'
    await tx.vocabAttempt.updateMany({
      where: { id: a.id, answer: null },
      data: {
        answer,
        chosenText: input.kind === 'choice' ? input.chosenText : null,
        responseMs: input.responseMs,
        answeredAt: new Date(),
        ...(input.flagged !== undefined ? { flagged: input.flagged } : {}),
      },
    })
    return toAttemptResult(await tx.vocabAttempt.findUniqueOrThrow({ where: { id: a.id }, select: ATTEMPT_SELECT }))
  })
}

// ── #51 끝내기 ───────────────────────────────────────────────────────────────

export interface FinishResultDto {
  session: VocabSessionDto
  studyLogId: string | null
  wrongWords: { wordId: string | null; surface: string; reading: string | null; correctText: string }[]
  flaggedCount: number
}

async function finishResult(tx: Tx, userId: string, s: SessionRow): Promise<FinishResultDto> {
  // 트랜잭션 연결 하나에서 차례로(interactive tx 에 병렬 쿼리를 걸지 않는다).
  const wrong = await tx.vocabAttempt.findMany({ where: { sessionId: s.id, answer: 'WRONG' }, orderBy: { order: 'asc' }, select: { wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true } })
  const flaggedCount = await tx.vocabAttempt.count({ where: { sessionId: s.id, flagged: true } })
  const log = s.status === 'DONE' ? await tx.studyLog.findFirst({ where: { userId, type: 'WORDS', refId: s.id }, orderBy: { createdAt: 'asc' }, select: { id: true } }) : null
  return {
    session: toSessionDto(s),
    studyLogId: log?.id ?? null,
    wrongWords: wrong.map((w) => ({ wordId: w.wordId, surface: w.surfaceSnap, reading: w.readingSnap, correctText: w.meaningSnap })),
    flaggedCount,
  }
}

export function durationSecOf(startedAt: Date, finishedAt: Date): number {
  return Math.min(DURATION_CAP_SEC, Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)))
}

/**
 * #51 — 단일 트랜잭션. 이미 끝난 세트면 같은 응답(멱등). 답한 카드 0장이면 ABANDONED(기록·스냅샷·카운터 변화 0, F2).
 * 그 외: 미답 → SKIPPED · 세션 카운터·durationSec · 단어 카운터(맞힘/틀림 증가, 건너뜀은 lastSeenAt·lastResult 만 — E5)
 * · StudyLog(WORDS, DIRECT, refId) · StatsSnapshot(VOCAB_SESSION) · DAILY `words` 증가. 기록 날짜는 세션 `date`(E3).
 */
export async function finishVocabSession(userId: string, id: string): Promise<FinishResultDto> {
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const s = await lockSession(tx, userId, id)
    if (s.status !== 'IN_PROGRESS') return finishResult(tx, userId, s)
    const attempts = await tx.vocabAttempt.findMany({ where: { sessionId: id }, select: { wordId: true, answer: true } })
    const now = new Date()
    if (!attempts.some((a) => a.answer != null)) {
      const closed = await tx.vocabSession.update({ where: { id }, data: { status: 'ABANDONED', finishedAt: now }, select: SESSION_SELECT })
      return finishResult(tx, userId, closed)
    }
    await tx.vocabAttempt.updateMany({ where: { sessionId: id, answer: null }, data: { answer: 'SKIPPED' } })
    const final = attempts.map((a) => ({ wordId: a.wordId, answer: a.answer ?? ('SKIPPED' as const) }))
    const tally = (x: VocabAnswer) => final.filter((a) => a.answer === x)
    const correct = tally('CORRECT').length
    const wrong = tally('WRONG').length
    const skipped = tally('SKIPPED').length
    const durationSec = durationSecOf(s.startedAt, now)
    const done = await tx.vocabSession.update({
      where: { id },
      data: { status: 'DONE', correctCount: correct, wrongCount: wrong, skippedCount: skipped, finishedAt: now, durationSec },
      select: SESSION_SELECT,
    })
    const idsOf = (x: VocabAnswer) => tally(x).flatMap((a) => (a.wordId ? [a.wordId] : []))
    const correctIds = idsOf('CORRECT')
    const wrongIds = idsOf('WRONG')
    const skippedIds = idsOf('SKIPPED')
    if (correctIds.length) await tx.wordEntry.updateMany({ where: { userId, id: { in: correctIds } }, data: { correctCount: { increment: 1 }, lastSeenAt: now, lastResult: 'CORRECT' } })
    if (wrongIds.length) await tx.wordEntry.updateMany({ where: { userId, id: { in: wrongIds } }, data: { wrongCount: { increment: 1 }, lastSeenAt: now, lastResult: 'WRONG' } })
    if (skippedIds.length) await tx.wordEntry.updateMany({ where: { userId, id: { in: skippedIds } }, data: { lastSeenAt: now, lastResult: 'SKIPPED' } })
    const date = dates.fromDbDate(s.date)
    const cardCount = final.length
    await recordStudyLog(
      userId,
      {
        date,
        type: 'WORDS',
        origin: 'DIRECT',
        refId: id,
        summary: `오늘의 단어 ${cardCount}장(${s.mode === 'CHOICE' ? '보기 고르기' : '뒤집기'}) · 맞힘 ${correct} · 틀림 ${wrong} · 건너뜀 ${skipped}`,
        result: { correct, wrong, skipped, cardCount, durationSec },
        durationSec,
      },
      tx,
    )
    await createVocabSessionSnapshot(userId, id, { cardCount, correct, wrong, skipped, durationSec, mode: s.mode, date }, tx)
    await bumpDailySnapshot(userId, date, { words: { sessions: 1, correct, wrong } }, tx)
    return finishResult(tx, userId, done)
  })
}

// ── #52 보관 · #53 다시 풀기 ─────────────────────────────────────────────────

export function parseKeepBody(body: Record<string, unknown>): boolean {
  const extra = Object.keys(body).filter((k) => k !== 'kept')
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  if (typeof body.kept !== 'boolean') bad('kept', 'boolean', 'kept 는 true/false 여야 합니다.')
  return body.kept
}

/** #52 — DONE 세트만(아니면 409). 이미 보관한 세트를 다시 보관해도 `keptAt` 은 처음 값 유지. */
export async function keepVocabSession(userId: string, id: string, kept: boolean): Promise<VocabSessionDto> {
  // 다시 풀기(#53)와 같은 잠금 순서(사용자 행 → 세트 행) — "보관 해제 ↔ 다시 풀기" 겹침을 직렬화한다(REV-008 L1).
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const s = await lockSession(tx, userId, id)
    if (s.status !== 'DONE') throw new ApiError('CONFLICT', '끝낸 세트만 보관할 수 있어요.', { status: s.status })
    if (kept === !!s.keptAt) return toSessionDto(s)
    return toSessionDto(await tx.vocabSession.update({ where: { id }, data: { keptAt: kept ? new Date() : null }, select: SESSION_SELECT }))
  })
}

/**
 * #53 — 보관한 DONE 세트(F7)의 같은 단어 목록으로 새 세트(`replayOfId`). 순서는 새 시드로 다시 섞고 원 모드를 따른다.
 * 삭제된 단어가 하나라도 있으면 세트 전체 FLIP(E4, 삭제 단어 카드는 원 세트의 `*Snap`). 오늘 DONE 제외 규칙은 적용하지 않는다.
 */
export async function replayVocabSession(userId: string, id: string): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  if (!isValidId(id)) throw notFound()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const src = await tx.vocabSession.findFirst({
      where: { id, userId },
      select: { id: true, mode: true, status: true, keptAt: true, cardCount: true, attempts: { orderBy: { order: 'asc' }, select: { wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true } } },
    })
    if (!src) throw notFound()
    if (src.status !== 'DONE' || !src.keptAt) throw new ApiError('CONFLICT', '보관한 세트만 다시 풀 수 있어요.', { status: src.status, kept: !!src.keptAt })
    await assertNoInProgress(tx, userId)
    const ids = src.attempts.flatMap((a) => (a.wordId ? [a.wordId] : []))
    const words = ids.length ? await tx.wordEntry.findMany({ where: { userId, id: { in: ids } }, select: POOL_SELECT }) : []
    const byId = new Map(words.map((w) => [w.id, w]))
    const cards: CardSeed[] = src.attempts.map((a) => {
      const w = a.wordId ? byId.get(a.wordId) : undefined
      return w ? toCardSeed(w) : { wordId: null, surface: a.surfaceSnap, reading: a.readingSnap, meaning: a.meaningSnap, partOfSpeech: 'OTHER', example: null, exampleKo: null }
    })
    const seed = newSeed(src.mode)
    const rng = createRng(seed)
    const ordered = shuffle(cards, rng)
    const mode: VocabMode = src.mode === 'CHOICE' && cards.some((c) => !c.wordId) ? 'FLIP' : src.mode
    const sources = mode === 'CHOICE' ? await tx.wordEntry.findMany({ where: { userId, archived: false }, select: { id: true, meaning: true, partOfSpeech: true } }) : []
    return insertSession(tx, userId, { seed, mode, requestedCount: src.cardCount, replayOfId: src.id, cards: ordered, sources, rng })
  })
}
