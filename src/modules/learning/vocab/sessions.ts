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
 *
 * 주제 단어 세트(task-042, 설계서 `docs/design/challenge.md` §4-3a~e·§9-2): `VocabSession.topicId` 가 있는 세트. 카드는 `wordId=null` +
 * 스냅샷 + `refType/refId`(`TopicChunk`·`Expr`·`AiWord`). A12 새 단어 생성은 트랜잭션 **밖**(`./topicSet`)이고, 세트·카드 쓰기는 지금과
 * 같은 잠금 순서(사용자 행 → 진행 중 확인 → 생성)다. 단어장(`WordEntry`) 자동 추가는 없다 — [단어장에 넣기](#41)를 눌러야만 생긴다.
 */
import type { PartOfSpeech, Prisma, VocabAnswer, VocabMode, VocabSessionStatus } from '@prisma/client'
import { ApiError, codePointLength, dates, decodeCursor, encodeCursor, isTimeIdCursor, lockUserRow, prisma, sanitizeText, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { recordStudyLog } from '../studyLog'
import { bumpDailySnapshot, createVocabSessionSnapshot, type VocabSessionSnapshotData } from '../snapshots'
import { registerRepetitionItems, type RepetitionItemInput } from '../repetition'
import { recordObservations, type ObservationInput } from '../observations'
import { loadTopicPool, topicAiWordHistory } from '../topics/pool'
import { assertTopicVisible, mapTopicGone } from '../topics/visible'
import { distinctMeaningCount, pickChoices, CHOICE_COUNT, type MeaningSource } from './distractors'
import { ceilingOf, createRng, generateWordSet, newSeed, requestedModeOf, shuffle, type LevelCode } from './setGenerator'
import {
  TOPIC_KIND_ANY,
  beginTopicWordsGeneration,
  composeTopicCards,
  defaultTopicSetDeps,
  endTopicWordsGeneration,
  generationSourceOf,
  loadRepetitionStats,
  loadTopicSetMaterial,
  readTodayTopicCards,
  refundTopicWordsAttempt,
  runTopicWords,
  todayAiWordExists,
  topicExamplePair,
  todayTopicState,
  topicCardCounts,
  topicCardRepetitionInputs,
  topicMeaningSources,
  type TopicGenerationDto,
  type TopicGenerationReason,
  type TopicSetDeps,
  type TopicWordCandidate,
  type TopicWordsDriver,
} from './topicSet'
import { isValidId } from './words'

export const SET_COUNT_MIN = 5
export const SET_COUNT_MAX = 30
export const RESPONSE_MS_MAX = 60_000
/** 걸린 시간 상한 — 세트를 두고 떠났다가 며칠 뒤 끝내도 통계가 망가지지 않게 1시간에서 자른다. */
export const DURATION_CAP_SEC = 3_600
export const VOCAB_MODES = ['CHOICE', 'FLIP'] as const
export const VOCAB_SESSION_STATUSES = ['IN_PROGRESS', 'DONE', 'ABANDONED'] as const

export type EmptyReason = 'NO_WORDS' | 'ALL_DONE_TODAY' | 'NO_WORDS_IN_CATEGORY' | 'TOPIC_EMPTY' | 'TOPIC_ALL_DONE_TODAY'

/**
 * 세션 DTO 의 `topic`(§9-2) — 주제 세트만, 내 단어장 세트·주제가 지워진 세트는 null. 두 수는 **그 세트의 카드 행**에서 센다
 * (`lessonCardCount` = refType `Expr` 장수, `aiCardCount` = `AiWord` 장수) — 새로 고침·이어 풀기·다시 풀기 뒤에도 같은 값.
 */
export interface VocabSessionTopicDto {
  id: string
  title: string
  lessonCardCount: number
  aiCardCount: number
}

export type { TopicGenerationDto, TopicWordsDriver }

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
  topic: VocabSessionTopicDto | null
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

/** #47·#53. 주제 세트(#47)면 `generation`(이 응답에만 — 저장 안 함). */
export type CreateSessionResult =
  | { session: VocabSessionDto; cards: VocabCardDto[]; generation?: TopicGenerationDto }
  | { session: null; empty: { reason: EmptyReason; cta: string[] } }

const SESSION_SELECT = {
  id: true, date: true, mode: true, requestedCount: true, cardCount: true, correctCount: true, wrongCount: true, skippedCount: true,
  status: true, keptAt: true, replayOfId: true, seed: true, startedAt: true, finishedAt: true, durationSec: true,
  topicId: true, topic: { select: { title: true } },
} as const
type SessionRow = Prisma.VocabSessionGetPayload<{ select: typeof SESSION_SELECT }>

/**
 * `refType` 은 세션 DTO 의 `topic` 두 수를 세는 데만 쓴다 — 카드 응답(`toCardDto`)에는 싣지 않는다(`refId` 도 미노출).
 * 예문은 단어장 카드면 `word`(지금 단어), 새 단어 카드면 `exampleSnap/exampleKoSnap`(task-049) — `exampleOf` 가 고른다.
 */
const ATTEMPT_SELECT = {
  id: true, order: true, wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, exampleSnap: true, exampleKoSnap: true, choices: true, answer: true,
  chosenText: true, flagged: true, answeredAt: true, refType: true, word: { select: { example: true, exampleKo: true } },
} as const
type AttemptRow = Prisma.VocabAttemptGetPayload<{ select: typeof ATTEMPT_SELECT }>

const POOL_SELECT = {
  id: true, surface: true, reading: true, meaning: true, partOfSpeech: true, correctCount: true, wrongCount: true, lastSeenAt: true,
  example: true, exampleKo: true, jlpt: true,
} as const
type PoolWord = Prisma.WordEntryGetPayload<{ select: typeof POOL_SELECT }>

function bad(field: string, reason: string, message: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '세트를 찾을 수 없어요.')
}

type TopicCounts = { lessonCardCount: number; aiCardCount: number }

/** 트랜잭션 실행기 주입(테스트의 가짜 tx) — 생략하면 `withTransaction`. */
export interface TxRunner {
  transaction?: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
}

/** `counts` 는 그 세트 카드에서 센 값(`topicCardCounts`) — 주제 세트가 아니면 무시한다. */
function toSessionDto(s: SessionRow, counts?: TopicCounts | null): VocabSessionDto {
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
    topic: s.topicId && s.topic ? { id: s.topicId, title: s.topic.title, lessonCardCount: counts?.lessonCardCount ?? 0, aiCardCount: counts?.aiCardCount ?? 0 } : null,
  }
}

/** 주제 세트들의 카드 출처 수 — `groupBy` 1회(#48·#52·#51 멱등 응답). 주제 세트가 없으면 쿼리 0. */
export async function topicCountsOf(db: Pick<Tx, 'vocabAttempt'>, sessions: readonly { id: string; topicId: string | null }[]): Promise<Map<string, TopicCounts>> {
  const ids = sessions.filter((s) => s.topicId).map((s) => s.id)
  const out = new Map<string, TopicCounts>()
  if (!ids.length) return out
  const rows = await db.vocabAttempt.groupBy({ by: ['sessionId', 'refType'], where: { sessionId: { in: ids }, refType: { in: ['Expr', 'AiWord'] } }, _count: { _all: true } })
  for (const r of rows) {
    const c = out.get(r.sessionId) ?? { lessonCardCount: 0, aiCardCount: 0 }
    if (r.refType === 'Expr') c.lessonCardCount += r._count._all
    else if (r.refType === 'AiWord') c.aiCardCount += r._count._all
    out.set(r.sessionId, c)
  }
  return out
}

/** 카드 예문(#47·#49·#50 공통) — 단어장 단어(`WordEntry`) 우선, 없으면 카드 스냅샷(새 단어), 둘 다 없으면 null(옛 행). */
function exampleOf(a: Pick<AttemptRow, 'word' | 'exampleSnap' | 'exampleKoSnap'>): { example: string | null; exampleKo: string | null } {
  return { example: a.word?.example ?? a.exampleSnap ?? null, exampleKo: a.word?.exampleKo ?? a.exampleKoSnap ?? null }
}

function parseChoices(raw: Prisma.JsonValue | null): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 카드 직렬화 — **정답 미노출 규칙이 사는 곳**. CHOICE 미답 카드는 order·표기·읽기·보기·표시 여부만 나간다.
 * 전 카드 정답은 **DONE 세트에서만**(결과 화면, api-contract #49). ABANDONED(답 0장으로 닫힌 세트, F2)는 "본 적 없는 세트"라
 * 진행 중과 똑같이 숨긴다 — 오늘 DONE 제외 규칙이 적용되지 않아 같은 단어가 다음 세트에 다시 나오기 때문(REV-008 H1).
 */
export function toCardDto(mode: VocabMode, status: VocabSessionStatus, a: Omit<AttemptRow, 'id' | 'refType'>): VocabCardDto {
  const answered = a.answer != null
  const card: VocabCardDto = { order: a.order, wordId: a.wordId, surface: a.surfaceSnap, reading: a.readingSnap, flagged: a.flagged, answered }
  if (mode === 'CHOICE') card.choices = parseChoices(a.choices)
  const reveal = answered || status === 'DONE'
  if (mode === 'FLIP' || reveal) {
    const ex = exampleOf(a)
    card.example = ex.example
    card.exampleKo = ex.exampleKo
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
  /** 주제 세트(task-042) — 있을 때만 칸이 생긴다. `category` 와 같이 올 수 없다. 접근(시드·내 주제)은 세트 생성이 확인한다(아니면 404). */
  topicId?: string
  /** 주제 세트에서 A12 새 단어를 만들어도 되는가(기본 true). false = [주제 표현으로 바로 풀기](B1 풀만). `topicId` 와만. */
  generate?: boolean
}

const CREATE_KEYS = ['count', 'mode', 'category', 'topicId', 'generate']

function intIn(raw: unknown, field: string, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) bad(field, `${min}~${max}`, `${field} 은(는) ${min}~${max} 사이 정수여야 합니다.`)
  return raw
}

/**
 * #47 본문 — `count` 5~30(생략 시 프로필 기본), `mode` CHOICE|FLIP(기본 CHOICE), `category` ≤40 또는 null(전체),
 * `topicId`(주제 세트 — `category` 와 같이 오면 400), `generate` boolean(`topicId` 와만, 기본 true).
 */
export function parseCreateSessionBody(body: Record<string, unknown>): CreateSessionInput {
  const extra = Object.keys(body).filter((k) => !CREATE_KEYS.includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `넣을 수 없는 항목입니다: ${extra.join(', ')}`)
  let topicId: string | null = null
  if (body.topicId != null) {
    if (typeof body.topicId !== 'string' || !body.topicId) bad('topicId', 'string', 'topicId 형식이 올바르지 않습니다.')
    topicId = body.topicId
  }
  if (topicId && body.category != null) bad('category', 'with_topicId', 'topicId 와 category 는 같이 보낼 수 없습니다.')
  if (body.generate !== undefined) {
    if (typeof body.generate !== 'boolean') bad('generate', 'boolean', 'generate 는 true/false 여야 합니다.')
    if (!topicId) bad('generate', 'topicId_required', 'generate 는 topicId 와 함께만 보낼 수 있습니다.')
  }
  const generate = body.generate !== false
  const count = body.count == null ? undefined : intIn(body.count, 'count', SET_COUNT_MIN, SET_COUNT_MAX)
  if (body.mode != null && !(VOCAB_MODES as readonly unknown[]).includes(body.mode)) bad('mode', VOCAB_MODES.join('|'), 'mode 값이 올바르지 않습니다.')
  let category: string | null = null
  if (body.category != null) {
    if (typeof body.category !== 'string') bad('category', 'string', 'category 형식이 올바르지 않습니다.')
    category = sanitizeText(body.category) || null
    if (category && codePointLength(category) > 40) bad('category', 'length ≤40', 'category 는 40자 이내여야 합니다.')
  }
  return { count, mode: (body.mode as VocabMode | undefined) ?? 'CHOICE', category, ...(topicId ? { topicId, generate } : {}) }
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

async function assertNoInProgress(tx: Pick<Tx, 'vocabSession'>, userId: string): Promise<void> {
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
  /** 보기 고르기의 "같은 종류" — 단어장 카드는 품사, 주제 카드는 조각 종류(모르면 빈 문자열). 저장하지 않는다. */
  kind: PartOfSpeech | string
  example: string | null
  exampleKo: string | null
  /** 주제 카드 출처(D5) — 단어장 카드는 null. 응답에는 싣지 않는다. */
  refType: string | null
  refId: string | null
}

/**
 * 세트 행 + 카드 행 생성(카드 = `answer=null` 인 VocabAttempt, 표기·읽기·뜻·보기 스냅샷). CHOICE 인데 한 카드라도 보기를
 * 만들 수 없으면 세트 전체를 FLIP 으로 내린다(E6). `topicId` 가 있으면 주제 세트(D4), 카드 `refType/refId`(D5)를 함께 쓴다.
 */
async function insertSession(
  tx: Pick<Tx, 'vocabSession' | 'vocabAttempt'>,
  userId: string,
  opts: {
    seed: string; mode: VocabMode; requestedCount: number; replayOfId: string | null; cards: CardSeed[]; sources: MeaningSource[]; rng: () => number
    topicId?: string | null; date?: string
  },
): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  let mode = opts.mode
  let choices: (string[] | null)[] = opts.cards.map(() => null)
  if (mode === 'CHOICE') {
    choices = opts.cards.map((c) => pickChoices({ meaning: c.meaning, partOfSpeech: c.kind }, opts.sources, opts.rng))
    if (choices.some((c) => !c || c.length !== CHOICE_COUNT)) {
      mode = 'FLIP'
      choices = opts.cards.map(() => null)
    }
  }
  const s = await tx.vocabSession.create({
    data: {
      userId, date: dates.toDbDate(opts.date ?? dates.todayKst()), mode, requestedCount: opts.requestedCount, cardCount: opts.cards.length,
      seed: opts.seed, replayOfId: opts.replayOfId, ...(opts.topicId ? { topicId: opts.topicId } : {}),
    },
    select: SESSION_SELECT,
  })
  // 예문 스냅샷은 단어장 단어가 아닌 카드(새 단어)만 — 단어장 카드는 지금 단어의 예문을 읽는다(수정이 바로 보이게).
  const snaps = opts.cards.map((c) => (c.wordId ? { example: null, exampleKo: null } : topicExamplePair(c.example, c.exampleKo)))
  const rows = opts.cards.map((c, order) => ({
    sessionId: s.id, wordId: c.wordId, order, surfaceSnap: c.surface, readingSnap: c.reading, meaningSnap: c.meaning,
    choices: (choices[order] ?? undefined) as Prisma.InputJsonValue | undefined,
    ...(c.refType && c.refId ? { refType: c.refType, refId: c.refId } : {}),
    ...(snaps[order].example ? { exampleSnap: snaps[order].example, exampleKoSnap: snaps[order].exampleKo } : {}),
  }))
  await tx.vocabAttempt.createMany({ data: rows })
  const cards = opts.cards.map((c, order) =>
    toCardDto(mode, 'IN_PROGRESS', {
      order, wordId: c.wordId, surfaceSnap: c.surface, readingSnap: c.reading, meaningSnap: c.meaning, choices: choices[order],
      answer: null, chosenText: null, flagged: false, answeredAt: null, word: c.wordId ? { example: c.example, exampleKo: c.exampleKo } : null,
      exampleSnap: snaps[order].example, exampleKoSnap: snaps[order].exampleKo,
    }),
  )
  return { session: toSessionDto(s, topicCardCounts(opts.cards)), cards }
}

function toCardSeed(w: PoolWord): CardSeed {
  return { wordId: w.id, surface: w.surface, reading: w.reading, meaning: w.meaning, kind: w.partOfSpeech, example: w.example, exampleKo: w.exampleKo, refType: null, refId: null }
}

// ── #47 세트 생성 ────────────────────────────────────────────────────────────

export interface CreateSessionOptions {
  /** 주제 세트의 A12 함수 묶음(라우트가 conversation 으로 만든다). 없으면 생성을 시도하지 않고 폴백 `FAILED`. */
  topicWords?: TopicWordsDriver
  /** 손님 연결(라우트 `req.signal`) — 끊기면 A12 를 멈추고 세트를 만들지 않는다. */
  signal?: AbortSignal
  /** 요청 시작 시각(ms) — 벽시계 30초의 기준(큐 대기 포함). 생략하면 지금. */
  startedAt?: number
  /** 테스트 주입(가짜 db·트랜잭션·엔진·시계). */
  deps?: Partial<TopicSetDeps>
}

/** `getProfile` 의 읽기 모양 — 시험이 가짜를 끼운다. */
export type LevelReader = (userId: string) => Promise<{ level: string; goalLevel: string | null }>

/**
 * 내 단어장 세트의 단계 천장(task-053) = 지금 수준·목표 수준 중 어려운 쪽. 프로필을 못 읽으면 `undefined` — 가중 없이(= 변경 전
 * 동작) 세트를 만든다: 단계 가중은 부가 기능이라 세트 생성을 막지 않는다. 트랜잭션 **밖**에서 읽어 사용자 행 잠금 시간을 늘리지 않는다.
 */
export async function levelCeilingFor(userId: string, read: LevelReader = getProfile): Promise<LevelCode | undefined> {
  try {
    const p = await read(userId)
    return ceilingOf(p.level, p.goalLevel)
  } catch {
    return undefined
  }
}

/**
 * 풀 = 보관 안 한 단어(카테고리 필터) − 오늘(KST) 끝낸 세트의 단어. 풀 0 → 빈 상태(F5 사유). 풀 <4 또는 서로 다른 뜻 <4 → FLIP 강등.
 * `count` 는 라우트가 채운다(요청값 또는 `Profile.dailyWordCount`). `topicId` 가 있으면 주제 세트(`createTopicVocabSession`).
 */
export async function createVocabSession(
  userId: string,
  input: { count: number; mode: VocabMode; category: string | null; topicId?: string | null; generate?: boolean },
  opts: CreateSessionOptions = {},
): Promise<CreateSessionResult> {
  if (input.topicId) return createTopicVocabSession(userId, { count: input.count, mode: input.mode, topicId: input.topicId, generate: input.generate !== false }, opts)
  const ceiling = await levelCeilingFor(userId)
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
    const picked = generateWordSet(pool, input.count, rng, new Date(), ceiling)
    const mode: VocabMode = input.mode === 'CHOICE' && (pool.length < 4 || distinctMeaningCount(active) < CHOICE_COUNT) ? 'FLIP' : input.mode
    return insertSession(tx, userId, { seed, mode, requestedCount: input.count, replayOfId: null, cards: picked.map(toCardSeed), sources: active, rng })
  })
}

const TOPIC_EMPTY_CTA = ['MY_WORDS']

function cancelledError(): ApiError {
  return new ApiError('CONFLICT', '요청이 취소됐어요.', { reason: 'CANCELLED' })
}

/**
 * #47 주제 세트(설계서 §4-3e). 순서:
 *  0. 주제 접근(시드·내 주제, 아니면 404) → 1. (잠금 없이) 풀던 세트 409 — LLM 을 헛돌리지 않게, 트랜잭션에서 다시 확인
 *  2. 생성 여부: `generate` && 오늘 이 주제 새 단어 없음 && 생성 중 아님(아니면 409 `GENERATING`) && 오늘 시도 < 3(아니면 `LIMIT`)
 *  3. A12(**트랜잭션 밖**, 벽시계 30초·손님 취소) → 손님이 끊었으면 세트를 만들지 않는다
 *  4. 트랜잭션: 사용자 행 → 풀던 세트 409 → 오늘 카드(재사용·답한 키) → 새 단어 → 모자라면 B1 풀 → 0장이면 빈 상태 → 세트·카드 생성
 *     (2 에서 켠 생성 중 표시는 4 가 끝날 때까지 유지)
 * 실패·시간 초과·부족은 B1 풀로 폴백·채움 — 하루 목표가 LLM 한도로 막히지 않는다(폴백 세트도 하루 판정에 똑같이 더해진다).
 */
async function createTopicVocabSession(
  userId: string,
  input: { count: number; mode: VocabMode; topicId: string; generate: boolean },
  opts: CreateSessionOptions,
): Promise<CreateSessionResult> {
  const deps: TopicSetDeps = { ...defaultTopicSetDeps(), ...opts.deps }
  const startedAt = opts.startedAt ?? deps.now()
  const material = await loadTopicSetMaterial(deps.db, userId, input.topicId)
  if (!material) throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.')
  const topicId = material.topic.id
  await assertNoInProgress(deps.db, userId)
  const today = dates.todayKst(new Date(deps.now()))
  const todayDb = dates.toDbDate(today)

  let fresh: TopicWordCandidate[] | null = null
  let reuse = false
  let reason: TopicGenerationReason | null = null
  let generating = false
  if (!input.generate) reason = 'SKIPPED'
  else if (await todayAiWordExists(deps.db, userId, topicId, todayDb)) reuse = true
  else {
    const gate = beginTopicWordsGeneration(userId, today)
    if (gate === 'GENERATING') throw new ApiError('CONFLICT', '오늘의 새 단어를 만들고 있어요. 잠시만 기다려 주세요.', { reason: 'GENERATING' })
    if (gate === 'LIMIT') reason = 'LIMIT'
    else generating = true
  }
  // 생성 중 표시는 세트 트랜잭션이 끝날 때까지 쥔다 — A12 직후에 풀면 커밋 전 틈에 들어온 두 번째 요청이 "오늘 새 단어 없음"을 보고 한 번 더 부른다.
  try {
    if (generating) {
      if (!opts.topicWords) reason = 'FAILED'
      else {
        const prior = await topicAiWordHistory(deps.db, userId, topicId)
        const r = await runTopicWords(deps, {
          userId, material, targetCount: input.count, priorSurfaces: prior.words.map((p) => p.surface), priorDays: prior.generationDays, driver: opts.topicWords,
          signal: opts.signal, deadlineAt: startedAt + deps.wallMs,
        })
        if (r.ok) fresh = r.words
        else if (r.reason === 'CANCELLED') {
          refundTopicWordsAttempt(userId, today)
          throw cancelledError()
        } else reason = r.reason
      }
    }
    if (opts.signal?.aborted) {
      // A12 가 끝난 직후 끊긴 틈 — A12 도중 취소와 같이 이 요청이 쓴 하루 시도를 되돌린다(만든 단어는 저장 칸이 없어 버려진다).
      if (generating) refundTopicWordsAttempt(userId, today)
      throw cancelledError()
    }
    return await composeTopicSessionTx(deps, userId, { ...input, topicId, today, todayDb }, { fresh, reuse, reason })
  } finally {
    if (generating) endTopicWordsGeneration(userId)
  }
}

/** #47 주제 세트 4단계(트랜잭션) — 사용자 행 → 풀던 세트 409 → 오늘 카드 → 새 단어 → B1 채움 → 빈 상태 또는 세트·카드 생성. */
async function composeTopicSessionTx(
  deps: TopicSetDeps,
  userId: string,
  input: { count: number; mode: VocabMode; topicId: string; today: string; todayDb: Date },
  gen: { fresh: TopicWordCandidate[] | null; reuse: boolean; reason: TopicGenerationReason | null },
): Promise<CreateSessionResult> {
  try {
    return await deps.transaction((tx) => composeTopicSessionLocked(tx, deps, userId, input, gen))
  } catch (e) {
    // 잠금 밖에서 주제가 지워진 경우(시드 로더 등) — FK 위반을 500 대신 404 TOPIC_GONE 으로.
    throw mapTopicGone(e)
  }
}

async function composeTopicSessionLocked(
  tx: Tx,
  deps: TopicSetDeps,
  userId: string,
  input: { count: number; mode: VocabMode; topicId: string; today: string; todayDb: Date },
  gen: { fresh: TopicWordCandidate[] | null; reuse: boolean; reason: TopicGenerationReason | null },
): Promise<CreateSessionResult> {
  const { topicId, today, todayDb } = input
  const { fresh, reuse } = gen
  let reason = gen.reason
  const seed = newSeed(input.mode)
  const rng = createRng(seed)
  await lockUserRow(tx, userId)
  // 주제는 잠금 전(긴 A12 호출 앞)에 읽었다 — 그 사이 주제 삭제(#173, 같은 잠금)가 끝났거나 가려졌으면 세트를 만들지 않는다(Codex C1 ⓑ).
  // 진행 중 챌린지 주제는 가린 시드여도 허용(§0 #9 — 챌린지 단어 과제).
  try {
    await assertTopicVisible(tx, userId, topicId, { allowActiveChallenge: true })
  } catch (e) {
    if (fresh?.length) console.info(`[vocab] 주제가 사라져 새 단어 ${fresh.length}개를 버림 — topic=${topicId}`)
    throw e
  }
  try {
    await assertNoInProgress(tx, userId)
  } catch (e) {
    if (fresh?.length) console.info(`[vocab] 풀던 세트가 생겨 새 단어 ${fresh.length}개를 버림 — topic=${topicId}`)
    throw e
  }
  const state = todayTopicState(await readTodayTopicCards(tx, userId, topicId, todayDb))
  const pool = await loadTopicPool(tx, userId, topicId)
  const stats = await loadRepetitionStats(tx, userId, pool.entries)
  const composed = composeTopicCards({ count: input.count, fresh, reuse, todayAi: state.todayAi, answered: state.answered, pool, stats, rng, now: new Date(deps.now()) })
  if (!composed.cards.length) {
    const nothing = !pool.entries.length && !state.todayAi.length && !fresh?.length
    return { session: null, empty: { reason: nothing ? 'TOPIC_EMPTY' : 'TOPIC_ALL_DONE_TODAY', cta: TOPIC_EMPTY_CTA } }
  }
  if (fresh) reason = composed.aiCount >= input.count ? null : composed.aiCount > 0 ? 'SHORT' : 'INVALID'
  else if (reuse) reason = composed.aiCount >= input.count ? null : 'NEW_DONE'
  const words = await tx.wordEntry.findMany({ where: { userId, archived: false }, select: { id: true, meaning: true } })
  const sources = topicMeaningSources(pool, words, composed.cards)
  const r = await insertSession(tx, userId, {
    seed, mode: input.mode, requestedCount: input.count, replayOfId: null, rng, topicId, date: today, sources,
    cards: composed.cards.map((c) => ({ wordId: null, surface: c.surface, reading: c.reading, meaning: c.meaning, kind: c.kind, example: c.example, exampleKo: c.exampleKo, refType: c.refType, refId: c.refId })),
  })
  const generation: TopicGenerationDto = { source: generationSourceOf(composed.aiCount, composed.cards.length), generatedNow: !!fresh && composed.aiCount > 0, reason }
  return { ...r, generation }
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
  const topicCounts = await topicCountsOf(prisma, page)
  const last = page.at(-1)
  return {
    items: page.map((s) => ({ ...toSessionDto(s, topicCounts.get(s.id)), answeredCount: answered.get(s.id) ?? 0 })),
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
  return { session: toSessionDto(s, topicCardCounts(attempts)), cards: attempts.map((a) => toCardDto(s.mode, s.status, a)) }
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

/** #50 응답 — 화면은 이 `example`·`exampleKo` 로 답한 카드를 채운다(CHOICE 세트의 첫 예문 출처). */
export function toAttemptResult(a: Omit<AttemptRow, 'id' | 'refType'>): AttemptResultDto {
  return {
    order: a.order,
    answer: a.answer as VocabAnswer,
    correctText: a.meaningSnap,
    chosenText: a.chosenText,
    ...exampleOf(a),
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
  /** `source` — 단어장 카드 `WORD` · 주제 카드 `TOPIC`(`wordId=null`, 화면이 [단어장에 넣기]로 처리). */
  wrongWords: { wordId: string | null; surface: string; reading: string | null; correctText: string; source: 'WORD' | 'TOPIC' }[]
  flaggedCount: number
}

async function finishResult(tx: Tx, userId: string, s: SessionRow, counts?: TopicCounts | null): Promise<FinishResultDto> {
  // 트랜잭션 연결 하나에서 차례로(interactive tx 에 병렬 쿼리를 걸지 않는다).
  const wrong = await tx.vocabAttempt.findMany({ where: { sessionId: s.id, answer: 'WRONG' }, orderBy: { order: 'asc' }, select: { wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, refType: true } })
  const flaggedCount = await tx.vocabAttempt.count({ where: { sessionId: s.id, flagged: true } })
  const log = s.status === 'DONE' ? await tx.studyLog.findFirst({ where: { userId, type: 'WORDS', refId: s.id }, orderBy: { createdAt: 'asc' }, select: { id: true } }) : null
  const topicCounts = counts !== undefined ? counts : (await topicCountsOf(tx, [s])).get(s.id)
  return {
    session: toSessionDto(s, topicCounts),
    studyLogId: log?.id ?? null,
    wrongWords: wrong.map((w) => ({ wordId: w.wordId, surface: w.surfaceSnap, reading: w.readingSnap, correctText: w.meaningSnap, source: w.refType ? ('TOPIC' as const) : ('WORD' as const) })),
    flaggedCount,
  }
}

export function durationSecOf(startedAt: Date, finishedAt: Date): number {
  return Math.min(DURATION_CAP_SEC, Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)))
}

/** 카드 1장의 반복 항목 입력(task-010b) — 답한 카드(맞힘·틀림)이고 단어가 남아 있을 때만. 건너뜀은 공부로 세지 않는다. */
export function vocabRepetitionInputs(cards: readonly { wordId: string | null; answer: VocabAnswer; surfaceSnap: string; meaningSnap: string }[]): RepetitionItemInput[] {
  return cards.flatMap((c) =>
    c.wordId && (c.answer === 'CORRECT' || c.answer === 'WRONG')
      ? [{ itemType: 'WORD' as const, refType: 'WordEntry', refId: c.wordId, textJa: c.surfaceSnap, meaningKo: c.meaningSnap, correct: c.answer === 'CORRECT' ? 1 : 0, wrong: c.answer === 'WRONG' ? 1 : 0 }]
      : [],
  )
}

/** 카드마다 `VOCAB_RECOGNITION` 관측(task-010b L3) — 맞힘 SUCCESS·틀림 FAIL·건너뜀 SKIPPED. 탭·자기 채점이라 신뢰도 1.0. */
export function vocabObservations(mode: VocabMode, cards: readonly { id: string; order: number; wordId: string | null; answer: VocabAnswer; responseMs: number | null }[]): ObservationInput[] {
  return cards.map((c) => ({
    kind: 'VOCAB_RECOGNITION' as const,
    outcome: c.answer === 'CORRECT' ? ('SUCCESS' as const) : c.answer === 'WRONG' ? ('FAIL' as const) : ('SKIPPED' as const),
    refType: 'VocabAttempt' as const,
    refId: c.id,
    wordId: c.wordId,
    latencyMs: c.answer === 'SKIPPED' ? null : c.responseMs,
    confidence: 1,
    meta: { mode, order: c.order },
  }))
}

/**
 * #51 — 단일 트랜잭션. 이미 끝난 세트면 같은 응답(멱등). 답한 카드 0장이면 ABANDONED(기록·스냅샷·카운터 변화 0, F2).
 * 그 외: 미답 → SKIPPED · 세션 카운터·durationSec · 단어 카운터(맞힘/틀림 증가, 건너뜀은 lastSeenAt·lastResult 만 — E5)
 * · 반복 항목(WORD, 답한 카드 — task-010b) · StudyLog(WORDS, DIRECT, refId) · StatsSnapshot(VOCAB_SESSION) · DAILY `words`·`repetition.studied`
 * · 카드별 관측(`VOCAB_RECOGNITION`) + DAILY `observations`. 기록 날짜는 세션 `date`(E3).
 */
export async function finishVocabSession(userId: string, id: string): Promise<FinishResultDto> {
  return (await finishVocabSessionDetailed(userId, id)).result
}

/** #51 + 이번 호출이 세트를 실제로 끝냈는가(`finishedNow` — 라우트가 그때만 복습 판단 잡을 건다, 멱등 재호출·ABANDONED 는 false). */
export async function finishVocabSessionDetailed(userId: string, id: string, opts: TxRunner = {}): Promise<{ result: FinishResultDto; finishedNow: boolean; repetitionItems: number }> {
  return (opts.transaction ?? withTransaction)(async (tx) => {
    await lockUserRow(tx, userId)
    const s = await lockSession(tx, userId, id)
    if (s.status !== 'IN_PROGRESS') return { result: await finishResult(tx, userId, s), finishedNow: false, repetitionItems: 0 }
    const attempts = await tx.vocabAttempt.findMany({
      where: { sessionId: id },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, wordId: true, answer: true, responseMs: true, surfaceSnap: true, meaningSnap: true, refType: true, refId: true },
    })
    const counts = topicCardCounts(attempts)
    const now = new Date()
    if (!attempts.some((a) => a.answer != null)) {
      const closed = await tx.vocabSession.update({ where: { id }, data: { status: 'ABANDONED', finishedAt: now }, select: SESSION_SELECT })
      return { result: await finishResult(tx, userId, closed, counts), finishedNow: false, repetitionItems: 0 }
    }
    await tx.vocabAttempt.updateMany({ where: { sessionId: id, answer: null }, data: { answer: 'SKIPPED' } })
    const cards = attempts.map((a) => ({ ...a, answer: a.answer ?? ('SKIPPED' as const) }))
    const final = cards.map((a) => ({ wordId: a.wordId, answer: a.answer }))
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
    const registered = await registerRepetitionItems(userId, [...vocabRepetitionInputs(cards), ...topicCardRepetitionInputs(cards)], tx, { now })
    const cardCount = final.length
    const topicTitle = s.topicId && s.topic ? s.topic.title : null
    const head = topicTitle ? `주제 단어 「${topicTitle}」` : '오늘의 단어'
    await recordStudyLog(
      userId,
      {
        date,
        type: 'WORDS',
        origin: 'DIRECT',
        refId: id,
        summary: `${head} ${cardCount}장(${s.mode === 'CHOICE' ? '보기 고르기' : '뒤집기'}) · 맞힘 ${correct} · 틀림 ${wrong} · 건너뜀 ${skipped}`,
        result: { correct, wrong, skipped, cardCount, durationSec },
        durationSec,
      },
      tx,
    )
    // 주제 세트만 `topicId` 한 칸(§4-3 ⑧) — 챌린지 하루 판정(T1)이 이 칸·date·correct/wrong 만 읽는다. 생성 시 1회, 이후 불변(규칙 2).
    const snapshot: VocabSessionSnapshotData = { cardCount, correct, wrong, skipped, durationSec, mode: s.mode, date, ...(s.topicId ? { topicId: s.topicId } : {}) }
    await createVocabSessionSnapshot(userId, id, snapshot, tx)
    await bumpDailySnapshot(userId, date, { words: { sessions: 1, correct, wrong }, repetition: { studied: registered.length } }, tx)
    await recordObservations(userId, vocabObservations(s.mode, cards), tx, { date })
    return { result: await finishResult(tx, userId, done, counts), finishedNow: true, repetitionItems: registered.length }
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
    const counts = (await topicCountsOf(tx, [s])).get(s.id)
    if (kept === !!s.keptAt) return toSessionDto(s, counts)
    return toSessionDto(await tx.vocabSession.update({ where: { id }, data: { keptAt: kept ? new Date() : null }, select: SESSION_SELECT }), counts)
  })
}

/**
 * #53 — 보관한 DONE 세트(F7)의 같은 단어 목록으로 새 세트(`replayOfId`). 순서는 새 시드로 다시 섞고 원 모드를 따른다.
 * 삭제된 단어가 하나라도 있으면 세트 전체 FLIP(E4, 삭제 단어 카드는 원 세트의 `*Snap`). 오늘 DONE 제외 규칙은 적용하지 않는다.
 * **주제 세트는 주제 세트로**(U15 A, §9-2): `topicId`·카드 `refType/refId`·예문 스냅샷(task-049)을 그대로 복사(새 단어 `AiWord` 포함 — LLM 호출 없음),
 * 보기는 주제 풀 뜻 ∪ 내 단어장 뜻 ∪ 같은 세트 뜻에서 다시 고른다(조각 종류는 저장하지 않아 종류 구분 없이). 다시 푼 세트도 그날 주제 세트 합계에 더해진다.
 */
export async function replayVocabSession(userId: string, id: string, opts: TxRunner = {}): Promise<{ session: VocabSessionDto; cards: VocabCardDto[] }> {
  if (!isValidId(id)) throw notFound()
  return (opts.transaction ?? withTransaction)(async (tx) => {
    await lockUserRow(tx, userId)
    const src = await tx.vocabSession.findFirst({
      where: { id, userId },
      select: {
        id: true, mode: true, status: true, keptAt: true, cardCount: true, topicId: true,
        attempts: { orderBy: { order: 'asc' }, select: { wordId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, exampleSnap: true, exampleKoSnap: true, refType: true, refId: true } },
      },
    })
    if (!src) throw notFound()
    if (src.status !== 'DONE' || !src.keptAt) throw new ApiError('CONFLICT', '보관한 세트만 다시 풀 수 있어요.', { status: src.status, kept: !!src.keptAt })
    await assertNoInProgress(tx, userId)
    if (src.topicId) {
      const cards: CardSeed[] = src.attempts.map((a) => ({
        wordId: null, surface: a.surfaceSnap, reading: a.readingSnap, meaning: a.meaningSnap, kind: TOPIC_KIND_ANY, example: a.exampleSnap, exampleKo: a.exampleKoSnap,
        refType: a.refType && a.refId ? a.refType : null, refId: a.refType && a.refId ? a.refId : null,
      }))
      const seed = newSeed(src.mode)
      const rng = createRng(seed)
      const ordered = shuffle(cards, rng)
      const pool = await loadTopicPool(tx, userId, src.topicId)
      const words = src.mode === 'CHOICE' ? await tx.wordEntry.findMany({ where: { userId, archived: false }, select: { id: true, meaning: true } }) : []
      const own = cards.map((c, i) => ({ id: `r:${i}`, meaning: c.meaning, partOfSpeech: TOPIC_KIND_ANY }))
      const sources = src.mode === 'CHOICE' ? [...topicMeaningSources(pool, words, [], true), ...own] : []
      return insertSession(tx, userId, { seed, mode: src.mode, requestedCount: src.cardCount, replayOfId: src.id, cards: ordered, sources, rng, topicId: src.topicId })
    }
    const ids = src.attempts.flatMap((a) => (a.wordId ? [a.wordId] : []))
    const words = ids.length ? await tx.wordEntry.findMany({ where: { userId, id: { in: ids } }, select: POOL_SELECT }) : []
    const byId = new Map(words.map((w) => [w.id, w]))
    const cards: CardSeed[] = src.attempts.map((a) => {
      const w = a.wordId ? byId.get(a.wordId) : undefined
      return w ? toCardSeed(w) : { wordId: null, surface: a.surfaceSnap, reading: a.readingSnap, meaning: a.meaningSnap, kind: 'OTHER', example: null, exampleKo: null, refType: null, refId: null }
    })
    const seed = newSeed(src.mode)
    const rng = createRng(seed)
    const ordered = shuffle(cards, rng)
    const mode: VocabMode = src.mode === 'CHOICE' && cards.some((c) => !c.wordId) ? 'FLIP' : src.mode
    const sources = mode === 'CHOICE' ? await tx.wordEntry.findMany({ where: { userId, archived: false }, select: { id: true, meaning: true, partOfSpeech: true } }) : []
    return insertSession(tx, userId, { seed, mode, requestedCount: src.cardCount, replayOfId: src.id, cards: ordered, sources, rng })
  })
}
