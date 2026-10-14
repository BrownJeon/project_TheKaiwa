/**
 * 주제 단어 세트(#47 `topicId`) — 설계서 `docs/design/challenge.md` §4-3a~e(B2 = A12 새 단어 + B1 폴백·채움), §5-2 완화책.
 *
 * - A12 요청은 L2 `conversation.buildTopicWordsRequest`·항목 검사 `assembleTopicWords` 가 만든다. 이 파일은 그것을 **라우트가 넘긴
 *   함수 묶음(`TopicWordsDriver`)** 으로만 부른다(L3 → L2 import 금지, A11 `ReviewDecisionDriver` 와 같은 방식). 응답은 같은 필드의
 *   로컬 구조 타입(`TopicWordsOutput`)으로 받는다.
 * - A12 는 **트랜잭션 밖**에서 부른다(사용자 행 잠금을 30초 쥐면 끝내기·단어 수정이 막힌다). 벽시계 상한은 요청 시작부터 **큐 대기 포함**
 *   30초 — 엔진 `timeoutMs` 는 프로세스 시작부터라 큐 대기를 재지 않는다. 상한·손님 취소가 오면 엔진 호출에 `signal` 을 보내고(큐에서
 *   기다리던 호출은 프로세스를 띄우지 않고, 실행 중이면 자식을 멈춘다) 결과를 기다리지 않고 바로 돌아온다.
 * - 생성 중 표시(사용자당 1)·하루 시도 상한(사용자당 3)은 프로세스 메모리다 — blue/green 전환·재시작에 비워져도 최악은 하루 몇 번 더 부르는 것뿐.
 * - 이 파일은 세트·카드 행을 쓰지 않는다. 카드 구성(순수)과 읽기만 하고, 쓰기는 `sessions.ts` 의 트랜잭션이 한다.
 */
import type { JlptLevel, VocabAnswer, VocabSessionStatus } from '@prisma/client'
import { llm, LLM_TASKS, newTraceId, recordTrace, type LlmJsonRequest, type TraceRecord, type TraceStep } from '@/modules/engine'
import { prisma, withTransaction, type Tx } from '@/modules/infra'
import type { TopicChunkType } from '@/types/topic'
import { normalizeRefText, repetitionRefId, type RepetitionItemInput } from '../repetition'
import { isTopicVisibleTo, topicGone } from '../topics/visible'
import {
  CARD_REF_AI_WORD,
  CARD_REF_TOPIC_CHUNK,
  TOPIC_CARD_MEANING_MAX,
  TOPIC_CARD_READING_MAX,
  TOPIC_CARD_SURFACE_MAX,
  cardRepetitionKey,
  isTopicCardRefType,
  repetitionKeyOfCard,
  type TopicCardRefType,
  type TopicPool,
} from '../topics/pool'
import type { MeaningSource } from './distractors'
import { generateWordSet, shuffle, type Rng } from './setGenerator'

/** 벽시계 상한 — 요청 시작부터, 큐 대기 포함(설계서 §4-3b ①). */
export const TOPIC_WORDS_WALL_MS = 30_000
/** 사용자당 하루 A12 시도 상한(성공·실패 모두 센다 — 손님 취소만 되돌린다). 넘으면 LLM 을 부르지 않고 폴백 `LIMIT`. */
export const TOPIC_WORDS_DAILY_ATTEMPTS = 3
/** A12 목표 장수 상한 = 응답 스키마 `words.maxItems`. 그보다 큰 세트는 나머지를 B1 풀로 채운다. */
export const TOPIC_WORDS_TARGET_MAX = 20
/** 보기 원천의 "종류 모름" 표시 — 다시 풀기(#53)는 조각 종류를 저장하지 않아 종류 구분 없이 고른다. */
export const TOPIC_KIND_ANY = '*'
/** 단어장 뜻의 종류 표시 — 조각 종류(NAME·ACTION…)와 겹치지 않아 "같은 조각 종류 우선 → 모자라면 다른 종류(단어장 포함)"가 된다. */
const WORD_KIND = 'WORD'

export type TopicGenerationSource = 'AI' | 'MIXED' | 'TOPIC'
export type TopicGenerationReason = 'SHORT' | 'NEW_DONE' | 'TIMEOUT' | 'FAILED' | 'INVALID' | 'LIMIT' | 'SKIPPED'

/** #47 응답 `generation` — 이 응답에만 싣고 저장하지 않는다. 엔진·모델 이름 없음(사유 코드만). */
export interface TopicGenerationDto {
  source: TopicGenerationSource
  generatedNow: boolean
  reason: TopicGenerationReason | null
}

// ── A12 계약(로컬 구조 타입 — conversation `TopicWordsResponse`·`TopicWordsInput` 과 같은 필드) ─────────────

export interface TopicWordsOutput {
  /** `jlpt` 는 모델이 문자열 `"null"` 로 낼 때가 있어 스키마가 받아 준다(L2 조립이 null 로 본다). 예문 두 칸은 v2(task-049) — v1 모양 응답에는 없다. */
  words: {
    textJa: string; reading: string; meaningKo: string; chunkType: TopicChunkType; jlpt: JlptLevel | 'null' | null; valid: boolean
    exampleJa?: string | null; exampleKo?: string | null
  }[]
}

export interface TopicWordsBuildInput {
  topic: { title: string; titleJa: string | null; description: string | null; level: JlptLevel }
  /** 세트가 채울 장수(1~20). 요청 장수(여유 1.3배)는 L2 가 정한다. */
  targetCount: number
  /** 이미 낸 표기 — 기본 표현 전부 → 이전 새 단어(최근 것부터). 프롬프트 상한(300개·2,000자)은 L2 가 자른다. */
  exclude: string[]
  /** 이 주제로 새 단어를 이미 만든 날 수(0부터) — L2 가 `[이번 초점]` 을 순환시키는 번호(같은 제외 목록에 같은 응답이 되풀이되는 것 방지). */
  variant: number
}

export interface TopicWordCandidate {
  textJa: string
  reading: string
  meaningKo: string
  chunkType: TopicChunkType
  jlpt: JlptLevel | null
  /**
   * L2 예문 검사를 통과한 예문(task-049) — 쌍이 아니면 서버가 둘 다 null 로 본다(`topicExamplePair`).
   * 필수 칸이다: 선택 칸이면 conversation 쪽 이름이 바뀌어도 `route.ts` 의 구조 대입이 tsc 를 통과한 채 예문만 조용히 사라진다(REV-177 M-1).
   * (모델 원문 `TopicWordsOutput` 은 v1 모양 응답을 받으려고 선택 칸 그대로.)
   */
  exampleJa: string | null
  exampleKo: string | null
}

/** 카드 예문 스냅샷 상한(코드포인트) — 칸은 TEXT 라 DB 제한이 없어 폭주 값만 막는다(L2 상한 60/100 보다 넉넉하게, 넘으면 자르지 않고 null). */
export const TOPIC_CARD_EXAMPLE_MAX = 300

/**
 * 예문 스냅샷 쌍(`VocabAttempt.exampleSnap`·`exampleKoSnap`) — 둘 다 비지 않은 문자열이고 각 ≤300자일 때만 그대로, 아니면 **둘 다 null**
 * (일본어만·번역만 있는 카드는 만들지 않는다). 새 단어 저장·같은 날 재사용·다시 풀기가 모두 이 함수를 거친다.
 */
export function topicExamplePair(ja: unknown, ko: unknown): { example: string | null; exampleKo: string | null } {
  const okText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && cp(v) <= TOPIC_CARD_EXAMPLE_MAX
  return okText(ja) && okText(ko) ? { example: ja, exampleKo: ko } : { example: null, exampleKo: null }
}

export interface TopicWordsAssembleCtx {
  level: JlptLevel
  /** 서버 쪽 **전체** 제외 집합(상한 없는 원본). */
  exclude: string[]
  /** 주제 기본 표현의 뜻(⑦ 뜻 중복). */
  excludeMeanings: string[]
}

export interface TopicWordsAssembled {
  words: TopicWordCandidate[]
  received: number
  droppedByReason?: Partial<Record<string, number>>
}

/** 라우트가 conversation 으로 만들어 넘기는 함수 묶음 — `build` 는 요청 값만 만들고, `assemble` 은 항목 검사 ①~⑦(순수). */
export interface TopicWordsDriver {
  promptVersion: string
  build(input: TopicWordsBuildInput): LlmJsonRequest<TopicWordsOutput>
  assemble(raw: unknown, ctx: TopicWordsAssembleCtx): TopicWordsAssembled
}

// ── 생성 중 표시 · 하루 시도 버킷(프로세스 메모리) ─────────────────────────────────────────────

const generatingUsers = new Set<string>()
const attemptsByDay = new Map<string, number>()
const dayKey = (userId: string, today: string) => `${today}|${userId}`

/**
 * 생성 시작 — 이 사용자가 이미 생성 중이면 `GENERATING`(409), 오늘 시도를 다 썼으면 `LIMIT`(LLM 0회), 아니면 시도 1회를 쓰고 `OK`.
 * `OK` 를 받은 호출자는 반드시 `endTopicWordsGeneration` 을 부른다(finally).
 */
export function beginTopicWordsGeneration(userId: string, today: string): 'OK' | 'GENERATING' | 'LIMIT' {
  if (generatingUsers.has(userId)) return 'GENERATING'
  for (const k of attemptsByDay.keys()) if (!k.startsWith(`${today}|`)) attemptsByDay.delete(k)
  const k = dayKey(userId, today)
  const used = attemptsByDay.get(k) ?? 0
  if (used >= TOPIC_WORDS_DAILY_ATTEMPTS) return 'LIMIT'
  attemptsByDay.set(k, used + 1)
  generatingUsers.add(userId)
  return 'OK'
}

export function endTopicWordsGeneration(userId: string): void {
  generatingUsers.delete(userId)
}

/** 손님 취소 — 대기 화면을 떠난 시도는 하루 상한에서 되돌린다(같은 날 다시 들어오면 만들 수 있게). */
export function refundTopicWordsAttempt(userId: string, today: string): void {
  const k = dayKey(userId, today)
  const used = attemptsByDay.get(k) ?? 0
  if (used > 1) attemptsByDay.set(k, used - 1)
  else attemptsByDay.delete(k)
}

export function topicWordsAttemptsUsed(userId: string, today: string): number {
  return attemptsByDay.get(dayKey(userId, today)) ?? 0
}

export function isTopicWordsGenerating(userId: string): boolean {
  return generatingUsers.has(userId)
}

/** 테스트 전용 — 메모리 상태 비우기. */
export function resetTopicWordsStateForTest(): void {
  generatingUsers.clear()
  attemptsByDay.clear()
}

// ── 읽기 ──────────────────────────────────────────────────────────────────────

export interface TopicSetMaterial {
  topic: { id: string; title: string; titleJa: string | null; description: string | null; level: JlptLevel }
  /** 기본 표현 표기(조각 순서) — A12 `exclude` 앞부분. */
  chunkTexts: string[]
  /** 기본 표현 뜻 — 항목 검사 ⑦. */
  chunkMeanings: string[]
}

/** 주제 재료·오늘 카드 읽기 — 가시성(시드 override·진행 중 챌린지)까지 읽으므로 트랜잭션 클라이언트 모양 전체. */
export type TopicSetReadDb = Tx

/**
 * 주제 재료 — 시드(userId null) 또는 **내** 주제만(아니면 null → 404). 이 사용자가 가린 시드는 A12 를 부르기 전에 404 `TOPIC_GONE`
 * (task-045 §2 새 시작 차단 · REV-150 M1) — 단, 그 주제에 진행 중 챌린지가 있으면 허용(§0 #9, 챌린지 단어 과제). 저장 직전 잠금 안 재확인은 sessions.ts.
 */
export async function loadTopicSetMaterial(db: Tx, userId: string, topicId: string): Promise<TopicSetMaterial | null> {
  if (typeof topicId !== 'string' || !topicId || topicId.length > 40) return null
  const t = await db.conversationTopic.findFirst({
    where: { id: topicId, OR: [{ userId: null }, { userId }] },
    select: {
      id: true, title: true, titleJa: true, description: true, level: true, userId: true,
      chunks: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { textJa: true, meaningKo: true } },
    },
  })
  if (!t) return null
  if (!(await isTopicVisibleTo(db, userId, t, { allowActiveChallenge: true }))) throw topicGone()
  return {
    topic: { id: t.id, title: t.title, titleJa: t.titleJa, description: t.description, level: t.level },
    chunkTexts: t.chunks.map((c) => c.textJa),
    chunkMeanings: t.chunks.map((c) => c.meaningKo),
  }
}

/** 오늘(KST) 이 주제의 **새로 만든**(다시 풀기 아님) 세트에 새 단어 카드가 있는가 = 그날 그 주제 생성이 이미 성공했는가(§4-3b ③). */
export async function todayAiWordExists(db: Pick<Tx, 'vocabAttempt'>, userId: string, topicId: string, todayDb: Date): Promise<boolean> {
  const hit = await db.vocabAttempt.findFirst({ where: { refType: CARD_REF_AI_WORD, session: { userId, topicId, date: todayDb, replayOfId: null } }, select: { id: true } })
  return !!hit
}

export interface TodayTopicCardRow {
  refType: string | null
  refId: string | null
  surfaceSnap: string
  readingSnap: string | null
  meaningSnap: string
  exampleSnap: string | null
  exampleKoSnap: string | null
  answer: VocabAnswer | null
  session: { status: VocabSessionStatus; replayOfId: string | null }
}

/** 오늘(KST) 이 주제 세트의 카드 전부 — 오늘 새 단어(재사용)·오늘 답한 키(제외)의 원천. 세트 시작 순 → 카드 순. */
export async function readTodayTopicCards(db: Pick<Tx, 'vocabAttempt'>, userId: string, topicId: string, todayDb: Date): Promise<TodayTopicCardRow[]> {
  return db.vocabAttempt.findMany({
    where: { session: { userId, topicId, date: todayDb } },
    orderBy: [{ session: { startedAt: 'asc' } }, { sessionId: 'asc' }, { order: 'asc' }],
    select: {
      refType: true, refId: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, exampleSnap: true, exampleKoSnap: true, answer: true,
      session: { select: { status: true, replayOfId: true } },
    },
  })
}

export interface RepetitionStat {
  correctCount: number
  wrongCount: number
  lastStudiedAt: Date | null
}

/** 풀 항목의 반복 항목 카운터(가중치 입력, §4-3 ⑤) — 키 = `cardRepetitionKey`. 쿼리 1회. */
export async function loadRepetitionStats(db: Pick<Tx, 'repetitionItem'>, userId: string, entries: readonly { refType: string; refId: string }[]): Promise<Map<string, RepetitionStat>> {
  const byType = new Map<string, Set<string>>()
  for (const e of entries) {
    const k = repetitionKeyOfCard(e.refType, e.refId)
    const set = byType.get(k.refType) ?? new Set<string>()
    set.add(k.refId)
    byType.set(k.refType, set)
  }
  if (!byType.size) return new Map()
  const rows = await db.repetitionItem.findMany({
    where: { userId, OR: [...byType].map(([refType, ids]) => ({ refType, refId: { in: [...ids] } })) },
    select: { refType: true, refId: true, correctCount: true, wrongCount: true, lastStudiedAt: true },
  })
  return new Map(rows.map((r) => [cardRepetitionKey(r.refType, r.refId), { correctCount: r.correctCount, wrongCount: r.wrongCount, lastStudiedAt: r.lastStudiedAt }]))
}

// ── 카드 구성(순수) ─────────────────────────────────────────────────────────────

export interface TopicCardSeed {
  surface: string
  reading: string | null
  meaning: string
  /** 보기 고르기용 조각 종류(모르면 빈 문자열·`TOPIC_KIND_ANY`). 저장하지 않는다. */
  kind: string
  refType: TopicCardRefType
  refId: string
  /** 예문 스냅샷 쌍(새 단어 카드만 값이 있다 — 주제 표현·수업 표현은 null). */
  example: string | null
  exampleKo: string | null
}

/** 오늘 행 → 재사용할 새 단어(refId 별 1개, 다시 풀기 세트 제외 — 예문 스냅샷도 함께 옮긴다) · 오늘 **답한**(맞힘·틀림) 카드의 반복 키(§4-3 ④ — 건너뛴 카드는 빼지 않는다). */
export function todayTopicState(rows: readonly TodayTopicCardRow[]): { todayAi: TopicCardSeed[]; answered: Set<string> } {
  const todayAi: TopicCardSeed[] = []
  const seen = new Set<string>()
  const answered = new Set<string>()
  for (const r of rows) {
    if (!r.refType || !r.refId || !isTopicCardRefType(r.refType)) continue
    if (r.answer === 'CORRECT' || r.answer === 'WRONG') answered.add(cardRepetitionKey(r.refType, r.refId))
    if (r.refType === CARD_REF_AI_WORD && !r.session.replayOfId && !seen.has(r.refId)) {
      seen.add(r.refId)
      todayAi.push({ surface: r.surfaceSnap, reading: r.readingSnap, meaning: r.meaningSnap, kind: '', refType: CARD_REF_AI_WORD, refId: r.refId, ...topicExamplePair(r.exampleSnap, r.exampleKoSnap) })
    }
  }
  return { todayAi, answered }
}

/** 새 단어 → 카드(`AiWord`, refId = 수업 표현과 같은 `repetitionRefId(textJa)`). */
export function aiWordCard(w: TopicWordCandidate): TopicCardSeed {
  return { surface: w.textJa, reading: w.reading, meaning: w.meaningKo, kind: w.chunkType, refType: CARD_REF_AI_WORD, refId: repetitionRefId(w.textJa), ...topicExamplePair(w.exampleJa, w.exampleKo) }
}

export interface ComposeTopicCardsInput {
  count: number
  /** 이번 요청이 새로 만든 단어(검사 통과분, 모델 순서). null = 이번 요청은 생성하지 않음. */
  fresh: readonly TopicWordCandidate[] | null
  /** fresh 가 없을 때 오늘 새 단어를 다시 쓸지(generate=true 이고 오늘 생성이 이미 성공한 경우). */
  reuse: boolean
  todayAi: readonly TopicCardSeed[]
  answered: ReadonlySet<string>
  pool: TopicPool
  stats: ReadonlyMap<string, RepetitionStat>
  rng: Rng
  now: Date
}

export interface ComposedTopicCards {
  /** 시드 셔플 순서. */
  cards: TopicCardSeed[]
  /** 새 단어 카드 수(= `aiCardCount`). */
  aiCount: number
  /** 재사용 모드에서 오늘 새 단어 중 아직 답하지 않은 수(`NEW_DONE` 판정). */
  reusableLeft: number
}

/**
 * 세트 카드 고르기(§4-3e 4단계) — 새 단어(fresh 앞에서, 또는 오늘 새 단어 중 안 푼 것) → 모자라면 B1 풀(답한 키·이미 고른 키·표기 제외,
 * 지금 가중치 공식)로 `count` 장까지 → 전체를 시드로 섞는다. 같은 반복 키·같은 정규화 표기는 한 세트에 두 번 나오지 않는다.
 */
export function composeTopicCards(input: ComposeTopicCardsInput): ComposedTopicCards {
  const count = Math.max(0, Math.floor(input.count))
  const chosen: TopicCardSeed[] = []
  const keys = new Set<string>()
  const texts = new Set<string>()
  const add = (c: TopicCardSeed): boolean => {
    const key = cardRepetitionKey(c.refType, c.refId)
    const norm = normalizeRefText(c.surface)
    if (!norm || input.answered.has(key) || keys.has(key) || texts.has(norm)) return false
    keys.add(key)
    texts.add(norm)
    chosen.push(c)
    return true
  }
  let reusableLeft = 0
  if (input.fresh) {
    for (const w of input.fresh) {
      if (chosen.length >= count) break
      add(aiWordCard(w))
    }
  } else if (input.reuse) {
    reusableLeft = input.todayAi.filter((c) => !input.answered.has(cardRepetitionKey(c.refType, c.refId))).length
    for (const c of input.todayAi) {
      if (chosen.length >= count) break
      add(c)
    }
  }
  const aiCount = chosen.length
  const need = count - chosen.length
  let filled: TopicCardSeed[] = []
  if (need > 0) {
    const candidates = input.pool.entries.flatMap((e) => {
      const id = cardRepetitionKey(e.refType, e.refId)
      if (input.answered.has(id) || keys.has(id) || texts.has(normalizeRefText(e.textJa))) return []
      const st = input.stats.get(id)
      return [{ id, correctCount: st?.correctCount ?? 0, wrongCount: st?.wrongCount ?? 0, lastSeenAt: st?.lastStudiedAt ?? null, e }]
    })
    filled = generateWordSet(candidates, need, input.rng, input.now).map((c) => ({
      surface: c.e.textJa, reading: c.e.reading, meaning: c.e.meaningKo, kind: c.e.chunkType, refType: c.e.refType, refId: c.e.refId, example: null, exampleKo: null,
    }))
  }
  return { cards: shuffle([...chosen, ...filled], input.rng), aiCount, reusableLeft }
}

/** 보기 원천(§4-3 ⑥) — 같은 주제 풀 뜻 ∪ 내 단어장 뜻 ∪ 이 세트 새 단어 뜻. `kindless` 면 종류 구분 없이(#53). id 는 출처별 접두로 겹치지 않게. */
export function topicMeaningSources(pool: TopicPool, words: readonly { id: string; meaning: string }[], cards: readonly TopicCardSeed[], kindless = false): MeaningSource[] {
  const kind = (k: string) => (kindless ? TOPIC_KIND_ANY : k)
  return [
    ...pool.entries.map((e) => ({ id: `p:${e.refType}:${e.refId}`, meaning: e.meaningKo, partOfSpeech: kind(e.chunkType) })),
    ...words.map((w) => ({ id: `w:${w.id}`, meaning: w.meaning, partOfSpeech: kind(WORD_KIND) })),
    ...cards.map((c) => ({ id: `c:${c.refType}:${c.refId}`, meaning: c.meaning, partOfSpeech: kind(c.kind) })),
  ]
}

/** `generation.source` — 카드 출처만 본다(새 단어 0 → TOPIC, 전부 → AI, 섞임 → MIXED). */
export function generationSourceOf(aiCount: number, cardCount: number): TopicGenerationSource {
  if (aiCount <= 0) return 'TOPIC'
  return aiCount >= cardCount ? 'AI' : 'MIXED'
}

/** 카드 행 → 세션 DTO `topic` 의 두 칸(§9-2 — 카드에서 세므로 풀을 다시 읽지 않는다). */
export function topicCardCounts(cards: readonly { refType: string | null }[]): { lessonCardCount: number; aiCardCount: number } {
  let lessonCardCount = 0
  let aiCardCount = 0
  for (const c of cards) {
    if (c.refType === 'Expr') lessonCardCount++
    else if (c.refType === CARD_REF_AI_WORD) aiCardCount++
  }
  return { lessonCardCount, aiCardCount }
}

/** #51 — 주제 카드 답(맞힘·틀림) → 반복 항목 입력. `AiWord` 는 `('Expr', refId)`(수업 표현과 같은 행), `TopicChunk` 는 CHUNK. 건너뜀은 공부로 세지 않는다. */
export function topicCardRepetitionInputs(cards: readonly { refType: string | null; refId: string | null; answer: VocabAnswer; surfaceSnap: string; meaningSnap: string }[]): RepetitionItemInput[] {
  return cards.flatMap((c) => {
    if (!c.refType || !c.refId || !isTopicCardRefType(c.refType)) return []
    if (c.answer !== 'CORRECT' && c.answer !== 'WRONG') return []
    const k = repetitionKeyOfCard(c.refType, c.refId)
    return [{
      itemType: c.refType === CARD_REF_TOPIC_CHUNK ? ('CHUNK' as const) : ('EXPRESSION' as const),
      refType: k.refType, refId: k.refId, textJa: c.surfaceSnap, meaningKo: c.meaningSnap,
      correct: c.answer === 'CORRECT' ? 1 : 0, wrong: c.answer === 'WRONG' ? 1 : 0,
    }]
  })
}

// ── A12 실행(벽시계·취소) ───────────────────────────────────────────────────────

export interface TopicWordsCallResult {
  data: TopicWordsOutput
  connectionKey?: string
  model?: string
  attempts?: number
  promptChars?: number
}

export interface TopicWordsRunDeps {
  complete: (req: LlmJsonRequest<TopicWordsOutput>) => Promise<TopicWordsCallResult>
  trace: (t: TraceRecord) => void
  now: () => number
}

export type TopicWordsRunResult =
  | { ok: true; words: TopicWordCandidate[]; received: number }
  | { ok: false; reason: 'TIMEOUT' | 'FAILED' | 'INVALID' | 'CANCELLED' }

const CHUNK_TYPE_SET = new Set<string>(['NAME', 'ACTION', 'FEELING', 'MODIFIER'])
const cp = (s: string) => [...s].length

/**
 * L2 항목 검사를 통과한 단어에 서버가 아는 것으로 한 번 더(§4-3a ⑥ + 카드 칸 폭): 형·길이(표기 ≤80·읽기 ≤120·뜻 ≤200 — DB 칸, 자르지 않고 버림),
 * 정규화 표기가 전체 제외 집합(상한 없는 원본)·앞 항목과 같으면 버림. 순서 유지. 예문은 단어를 버리는 사유가 아니다 — 쌍이 아니거나 너무 길면 예문만 null.
 */
export function recheckTopicWords(words: readonly TopicWordCandidate[], exclude: readonly string[]): TopicWordCandidate[] {
  const seen = new Set(exclude.map((e) => normalizeRefText(e)).filter(Boolean))
  const out: TopicWordCandidate[] = []
  for (const w of words) {
    if (!w || typeof w.textJa !== 'string' || typeof w.reading !== 'string' || typeof w.meaningKo !== 'string' || !CHUNK_TYPE_SET.has(w.chunkType)) continue
    if (!w.textJa.trim() || cp(w.textJa) > TOPIC_CARD_SURFACE_MAX || !w.reading.trim() || cp(w.reading) > TOPIC_CARD_READING_MAX || !w.meaningKo.trim() || cp(w.meaningKo) > TOPIC_CARD_MEANING_MAX) continue
    const norm = normalizeRefText(w.textJa)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    const ex = topicExamplePair(w.exampleJa, w.exampleKo)
    out.push({ textJa: w.textJa, reading: w.reading, meaningKo: w.meaningKo, chunkType: w.chunkType, jlpt: w.jlpt ?? null, exampleJa: ex.example, exampleKo: ex.exampleKo })
  }
  return out
}

/** 엔진 오류 → 폴백 사유(이름으로만 — 엔진명은 남기지 않는다). */
export function topicWordsFailureReason(e: unknown): 'TIMEOUT' | 'FAILED' | 'INVALID' {
  const name = (e as { name?: unknown } | null)?.name
  const n = typeof name === 'string' ? name : ''
  if (n.includes('Timeout')) return 'TIMEOUT'
  if (n === 'JsonSchemaError') return 'INVALID'
  return 'FAILED'
}

export interface RunTopicWordsArgs {
  userId: string
  material: TopicSetMaterial
  targetCount: number
  /** 이전 새 단어 표기(최근 것부터). */
  priorSurfaces: string[]
  /** 이 주제로 새 단어를 만든 날 수(`topicAiWordHistory.generationDays`) — 생략하면 0. */
  priorDays?: number
  driver: TopicWordsDriver
  /** 손님 연결(라우트 `req.signal`). */
  signal?: AbortSignal
  /** 벽시계 마감(ms epoch) — 요청 시작 + 30초. */
  deadlineAt: number
}

/**
 * A12 1회(ajv 재시도는 엔진 안 — 호출 ≤2). 벽시계 마감 또는 손님 취소가 먼저 오면 엔진에 취소를 보내고 결과를 기다리지 않는다.
 * Trace 1행(원문 없음 — 단계·지연·장수·사유 코드만). 던지지 않는다.
 */
export async function runTopicWords(deps: TopicWordsRunDeps, args: RunTopicWordsArgs): Promise<TopicWordsRunResult> {
  const startedAt = deps.now()
  const traceId = newTraceId()
  const steps: TraceStep[] = []
  const exclude = [...args.material.chunkTexts, ...args.priorSurfaces]
  const targetCount = Math.max(1, Math.min(TOPIC_WORDS_TARGET_MAX, Math.floor(args.targetCount)))
  let result: TopicWordsRunResult = { ok: false, reason: 'FAILED' }
  let errorCode: string | null = null
  const ctl = new AbortController()
  // 콜백이 바꾸는 값이라 객체 칸에 둔다(지역 let 은 await 뒤에도 초기값으로 좁혀진 채 남는다).
  const stopBy: { why: 'WALL' | 'CLIENT' | null } = { why: null }
  const stop = (w: 'WALL' | 'CLIENT') => {
    if (stopBy.why) return
    stopBy.why = w
    ctl.abort()
  }
  const onClient = () => stop('CLIENT')
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    if (args.signal?.aborted) {
      result = { ok: false, reason: 'CANCELLED' }
      errorCode = 'CANCELLED'
      return result
    }
    const left = args.deadlineAt - startedAt
    if (left <= 0) {
      result = { ok: false, reason: 'TIMEOUT' }
      errorCode = 'WALL_CLOCK'
      return result
    }
    let request: LlmJsonRequest<TopicWordsOutput>
    try {
      request = args.driver.build({ topic: { ...args.material.topic }, targetCount, exclude, variant: Math.max(0, Math.floor(args.priorDays ?? 0)) })
    } catch (e) {
      errorCode = e instanceof Error ? e.name.slice(0, 40) : 'BUILD'
      return result
    }
    args.signal?.addEventListener('abort', onClient, { once: true })
    timer = setTimeout(() => stop('WALL'), left)
    const stopped = new Promise<{ stopped: true }>((resolve) => ctl.signal.addEventListener('abort', () => resolve({ stopped: true }), { once: true }))
    const call = deps.complete({ ...request, signal: ctl.signal, traceId }).then(
      (v) => ({ v }),
      (e: unknown) => ({ e }),
    )
    const out = await Promise.race([call, stopped])
    const lane = request.priority ?? LLM_TASKS[request.task]?.lane ?? null
    if ('stopped' in out) {
      const why = stopBy.why
      steps.push({ name: 'A12', ms: deps.now() - startedAt, lane, aborted: why, target: targetCount })
      result = why === 'CLIENT' ? { ok: false, reason: 'CANCELLED' } : { ok: false, reason: 'TIMEOUT' }
      errorCode = why === 'CLIENT' ? 'CANCELLED' : 'WALL_CLOCK'
      return result
    }
    if ('e' in out) {
      steps.push({ name: 'A12', ms: deps.now() - startedAt, lane, target: targetCount })
      result = { ok: false, reason: topicWordsFailureReason(out.e) }
      errorCode = (out.e as { name?: string } | null)?.name?.slice(0, 40) ?? 'ERROR'
      return result
    }
    const r = out.v
    const assembled = args.driver.assemble(r.data, { level: args.material.topic.level, exclude, excludeMeanings: args.material.chunkMeanings })
    const words = recheckTopicWords(assembled.words, exclude)
    const dropped = Object.entries(assembled.droppedByReason ?? {}).map(([k, v]) => `${k}=${v}`).join(',').slice(0, 120)
    steps.push({
      name: 'A12', ms: deps.now() - startedAt, lane, connection: r.connectionKey ?? null, model: r.model ?? null, attempts: r.attempts ?? 1, promptChars: r.promptChars ?? null,
      target: targetCount, received: assembled.received, kept: words.length, dropped: dropped || null, promptVersion: args.driver.promptVersion,
    })
    if (!words.length) {
      result = { ok: false, reason: 'INVALID' }
      errorCode = 'NO_VALID_WORDS'
      return result
    }
    result = { ok: true, words, received: assembled.received }
    return result
  } catch (e) {
    // 엔진 응답 위반(INVALID)이 아니라 코드·계약 오류(assemble 던짐 등) — 사유별 비율이 섞이지 않게 FAILED.
    errorCode = e instanceof Error ? e.name.slice(0, 40) : 'ERROR'
    result = { ok: false, reason: 'FAILED' }
    return result
  } finally {
    if (timer) clearTimeout(timer)
    args.signal?.removeEventListener('abort', onClient)
    // 이 시점 이후 늦게 끝나는 엔진 호출은 결과를 버린다(큐에 남은 호출은 취소 신호를 보고 프로세스를 띄우지 않는다).
    if (!ctl.signal.aborted) ctl.abort()
    deps.trace({
      traceId, kind: 'TURN', userId: args.userId,
      status: result.ok ? (result.words.length >= targetCount ? 'OK' : 'PARTIAL') : 'ERROR',
      steps, totalMs: deps.now() - startedAt, errorCode, refType: 'topicWords', refId: args.material.topic.id,
    })
  }
}

// ── 기본 의존성 ─────────────────────────────────────────────────────────────────

export interface TopicSetDeps extends TopicWordsRunDeps {
  db: TopicSetReadDb
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
  wallMs: number
}

export function defaultTopicSetDeps(): TopicSetDeps {
  return {
    db: prisma,
    transaction: (fn) => withTransaction(fn),
    complete: (req) => llm.completeJson<TopicWordsOutput>(req),
    trace: (t) => void recordTrace(t),
    now: () => Date.now(),
    wallMs: TOPIC_WORDS_WALL_MS,
  }
}
