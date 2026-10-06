/**
 * 주제 표현 풀(B1 풀, 설계서 `docs/design/challenge.md` §4-3 ①~③·§4-3d·§10-1) — 주제 단어 세트(#47)의 폴백·채움 재료와
 * 챌린지 `topicProgress`(task-041)가 함께 읽는다.
 *
 * 풀 = 주제 기본 표현(`TopicChunk`) ∪ 이 주제로 끝낸 새 수업(`Lesson kind=NEW status=DONE`, 최근 60개)의 조각.
 * 수업 조각의 출처 키는 **수업 완료와 같은 함수**(`lessonRepetitionItems` — `lessons/lifecycle.ts` 가 완료 때 부른다)로 얻는다.
 * 여기서 sha1·조각 분류를 다시 구현하면 같은 표현이 `RepetitionItem` 두 행으로 조용히 갈라진다(REV-113 M-4).
 *
 * import 규칙(설계서 §10-1, R4-L9a): `../lessons/content` 파일을 직접 쓴다. barrel `../lessons` 는 `getTodayLessons`(./today)를
 * 다시 내보내므로 `lessons/today → challenges → topics/pool → lessons/index → today` 순환이 생긴다 — 테스트가 grep 으로 막는다.
 * 이 파일은 주제 접근(시드·내 주제) 검사를 하지 않는다 — 호출자가 `getTopicRef`/`getTopicForLesson` 으로 먼저 확인한다.
 */
import type { ChunkType, Prisma } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import { normalizeRefText } from '../repetition'
import { lessonRepetitionItems, readStoredContent } from '../lessons/content'

// ── 카드 출처(VocabAttempt.refType) ─────────────────────────────────────────────

export const CARD_REF_TOPIC_CHUNK = 'TopicChunk'
export const CARD_REF_EXPR = 'Expr'
/** A12 새 단어 카드. refId 는 수업 표현과 같은 `repetitionRefId(textJa)` — 반복 항목은 `('Expr', refId)` 로 쌓인다. */
export const CARD_REF_AI_WORD = 'AiWord'
export type TopicCardRefType = typeof CARD_REF_TOPIC_CHUNK | typeof CARD_REF_EXPR | typeof CARD_REF_AI_WORD

export function isTopicCardRefType(v: unknown): v is TopicCardRefType {
  return v === CARD_REF_TOPIC_CHUNK || v === CARD_REF_EXPR || v === CARD_REF_AI_WORD
}

/**
 * 카드 출처 → 반복 항목 키. `AiWord` → `Expr`(같은 sha1), 나머지는 그대로. 반복 항목 등록(#51)·오늘 제외·중복 비교가 모두 이 함수를 쓴다
 * (카드에 `'Expr'` 를 그대로 쓰지 않는 이유: 새 단어와 수업 표현을 카드에서 구분해야 `lessonCardCount`·`aiCardCount` 를 셀 수 있다 — §4-3d).
 */
export function repetitionKeyOfCard(refType: string, refId: string): { refType: string; refId: string } {
  return { refType: refType === CARD_REF_AI_WORD ? CARD_REF_EXPR : refType, refId }
}

/** `repetitionKeyOfCard` 결과를 한 문자열로(Set 비교용). refType 에 `:` 가 없고 refId 는 sha1·cuid 라 겹치지 않는다. */
export function cardRepetitionKey(refType: string, refId: string): string {
  const k = repetitionKeyOfCard(refType, refId)
  return `${k.refType}:${k.refId}`
}

// ── 풀 ───────────────────────────────────────────────────────────────────────

/** 수업 표현 재료로 읽는 수업 수 상한(최근 것부터 — 성능, 설계서 §12-1). */
export const TOPIC_POOL_LESSON_LIMIT = 60
/** 카드 칸 폭(`VocabAttempt.surfaceSnap VarChar(80)`·`readingSnap VarChar(120)`) — 넘는 표현은 풀에서 뺀다(§4-3 ②). */
export const TOPIC_CARD_SURFACE_MAX = 80
export const TOPIC_CARD_READING_MAX = 120
/** `meaningSnap VarChar(200)` — `TopicChunk.meaningKo` 는 160 이라 걸리지 않지만 수업 조각 뜻을 위해 둔다. */
export const TOPIC_CARD_MEANING_MAX = 200

export interface TopicPoolChunkRow {
  id: string
  chunkType: ChunkType
  textJa: string
  reading: string | null
  meaningKo: string
}

export interface TopicPoolLessonRow {
  id: string
  content: Prisma.JsonValue | null
}

export interface TopicPoolEntry {
  /** 카드 refType — 풀에는 `TopicChunk`·`Expr` 만 있다(새 단어 `AiWord` 는 `vocab/topicSet` 이 따로 만든다). */
  refType: typeof CARD_REF_TOPIC_CHUNK | typeof CARD_REF_EXPR
  refId: string
  itemType: 'CHUNK' | 'EXPRESSION'
  textJa: string
  reading: string | null
  meaningKo: string
  chunkType: ChunkType
  /** 기본 표현이면 TOPIC, 수업에서 온 표현이면 LESSON(그 수업 id). */
  origin: 'TOPIC' | 'LESSON'
  lessonId: string | null
}

export interface TopicPool {
  /** 기본 표현(조각 순서) → 수업 표현(최근 수업부터, 수업 안 조각 순서). 정규화 표기로 중복 제거(같은 표기면 기본 표현 쪽). */
  entries: TopicPoolEntry[]
  /** 이 주제의 조각 id 집합 — 수업 완료가 `lessonRepetitionItems` 에 넘기는 입력과 같다(`lifecycle.ts` 의 `topicChunkIds`). */
  topicChunkIds: ReadonlySet<string>
  /** 폭 필터 뒤 기본 표현 수 = #156 `WORD_COUNT_OVER_POOL` 의 `poolSize`(설계서 §9-1). */
  chunkTotal: number
  /** 폭 필터 뒤 수업 표현 수(기본 표현과 표기가 다른 것만) — `topicProgress.lessonExprCount`·"수업 표현 +n". */
  lessonExprCount: number
  /** 실제로 읽은 수업 수(본문이 깨진 수업 포함). */
  lessonsRead: number
}

function fits(textJa: string, reading: string | null, meaningKo: string): boolean {
  const len = (s: string) => [...s].length
  return len(textJa) > 0 && len(textJa) <= TOPIC_CARD_SURFACE_MAX && (reading == null || len(reading) <= TOPIC_CARD_READING_MAX) && len(meaningKo) > 0 && len(meaningKo) <= TOPIC_CARD_MEANING_MAX
}

/**
 * 풀 만들기(순수). `chunks` = 그 주제의 조각 **전부**(키 분류 입력 — 일부만 넘기면 주제 조각이 `Expr` 로 잘못 분류된다),
 * `lessons` = 최근 것부터. 수업 조각 분류는 `lessonRepetitionItems(content, {topicChunkIds, outcomes: []})` 그대로다.
 */
export function buildTopicPool(chunks: readonly TopicPoolChunkRow[], lessons: readonly TopicPoolLessonRow[]): TopicPool {
  const topicChunkIds = new Set(chunks.map((c) => c.id))
  const entries: TopicPoolEntry[] = []
  const seenText = new Set<string>()
  const seenKey = new Set<string>()
  for (const c of chunks) {
    const norm = normalizeRefText(c.textJa)
    if (!norm || seenText.has(norm)) continue
    seenText.add(norm)
    seenKey.add(`${CARD_REF_TOPIC_CHUNK}:${c.id}`)
    if (!fits(c.textJa, c.reading, c.meaningKo)) continue
    entries.push({ refType: CARD_REF_TOPIC_CHUNK, refId: c.id, itemType: 'CHUNK', textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, chunkType: c.chunkType, origin: 'TOPIC', lessonId: null })
  }
  const chunkTotal = entries.length
  let lessonExprCount = 0
  for (const l of lessons) {
    const content = readStoredContent(l.content)
    if (!content) continue
    const byId = new Map(content.chunks.map((c) => [c.id, c]))
    for (const it of lessonRepetitionItems(content, { topicChunkIds, outcomes: [] })) {
      if (it.itemType !== 'CHUNK' && it.itemType !== 'EXPRESSION') continue
      if (it.refType !== CARD_REF_TOPIC_CHUNK && it.refType !== CARD_REF_EXPR) continue
      const key = `${it.refType}:${it.refId}`
      if (seenKey.has(key)) continue
      const norm = normalizeRefText(it.textJa)
      if (!norm || seenText.has(norm)) continue
      const chunk = byId.get(it.contentId)
      if (!chunk) continue
      seenKey.add(key)
      seenText.add(norm)
      if (it.refType === CARD_REF_TOPIC_CHUNK) continue // 주제 조각 id 를 쓴 수업 조각 — 기본 표현 쪽에 이미 있다(표기만 다르면 기본 표현이 이긴다).
      if (!fits(chunk.textJa, chunk.reading ?? null, chunk.meaningKo)) continue
      entries.push({ refType: CARD_REF_EXPR, refId: it.refId, itemType: 'EXPRESSION', textJa: chunk.textJa, reading: chunk.reading || null, meaningKo: chunk.meaningKo, chunkType: chunk.chunkType, origin: 'LESSON', lessonId: l.id })
      lessonExprCount++
    }
  }
  return { entries, topicChunkIds, chunkTotal, lessonExprCount, lessonsRead: lessons.length }
}

/** 풀이 읽는 표(트랜잭션 `tx` 또는 `prisma`). 테스트는 이 모양의 가짜를 넘긴다. */
export type TopicPoolDb = Pick<Tx, 'topicChunk' | 'lesson'>

/** 풀 읽기 — 조각 전부(키 분류 입력이라 자르지 않는다) + 최근 끝낸 새 수업 60개. 쿼리 2회. */
export async function loadTopicPool(db: TopicPoolDb, userId: string, topicId: string): Promise<TopicPool> {
  const chunks = await db.topicChunk.findMany({
    where: { topicId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true },
  })
  const lessons = await db.lesson.findMany({
    where: { userId, topicId, kind: 'NEW', status: 'DONE' },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    take: TOPIC_POOL_LESSON_LIMIT,
    select: { id: true, content: true },
  })
  return buildTopicPool(chunks, lessons)
}

/** 이 주제 수업 표현 수(`topicProgress.lessonExprCount`) — 풀을 읽어 센다. */
export async function lessonExprCount(db: TopicPoolDb, userId: string, topicId: string): Promise<number> {
  return (await loadTopicPool(db, userId, topicId)).lessonExprCount
}

// ── 이 주제의 새 단어(AiWord) 카드 ───────────────────────────────────────────────

/** 이미 낸 새 단어 조회 상한(행) — 30일 챌린지 ≈ 600행. 몇 년치가 쌓여도 한 요청이 무거워지지 않게 자른다(최근 것 우선). */
export const TOPIC_AI_WORD_SCAN_MAX = 5_000

export type TopicAiWordDb = Pick<Tx, 'vocabAttempt'>

export interface TopicAiWord {
  refId: string
  surface: string
}

export interface TopicAiWordHistory {
  words: TopicAiWord[]
  /** 새 단어를 만든 날 수 — 다시 풀기(`replayOfId`) 세트는 날짜가 달라도 세지 않는다. A12 `variant`(초점 순환 번호, PE 인계 2). */
  generationDays: number
}

/**
 * 이 사용자가 이 주제로 받은 새 단어(`AiWord` 카드) — `refId` 별 1개, 최근 세트부터(같은 세트 안은 카드 순서) + 만든 날 수. 쿼리 1회.
 * A12 의 "이미 낸 표기"(`exclude`) 원천이자 `topicProgress.aiWordTotal`(서로 다른 refId 수)의 원천. 세트 삭제 경로가 없어 이력이 사라지지 않는다.
 */
export async function topicAiWordHistory(db: TopicAiWordDb, userId: string, topicId: string, opts: { scanMax?: number } = {}): Promise<TopicAiWordHistory> {
  const rows = await db.vocabAttempt.findMany({
    where: { refType: CARD_REF_AI_WORD, session: { userId, topicId } },
    orderBy: [{ session: { startedAt: 'desc' } }, { sessionId: 'desc' }, { order: 'asc' }],
    take: opts.scanMax ?? TOPIC_AI_WORD_SCAN_MAX,
    select: { refId: true, surfaceSnap: true, session: { select: { date: true, replayOfId: true } } },
  })
  const seen = new Set<string>()
  const days = new Set<number>()
  const words: TopicAiWord[] = []
  for (const r of rows) {
    if (!r.session.replayOfId) days.add(r.session.date.getTime())
    if (!r.refId || seen.has(r.refId)) continue
    seen.add(r.refId)
    words.push({ refId: r.refId, surface: r.surfaceSnap })
  }
  return { words, generationDays: days.size }
}

/** `topicAiWordHistory` 의 단어만(챌린지 `topicProgress` 가 쓰는 모양 그대로). */
export async function topicAiWords(db: TopicAiWordDb, userId: string, topicId: string, opts: { scanMax?: number } = {}): Promise<TopicAiWord[]> {
  return (await topicAiWordHistory(db, userId, topicId, opts)).words
}
