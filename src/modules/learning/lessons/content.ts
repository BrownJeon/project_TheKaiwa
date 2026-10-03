/**
 * 레슨 본문(Lesson.content) — 순수 함수만. A4 출력(`LessonGenOutput`)을 저장 모양으로 바꾸고(L2 청취 구간 번호), 읽을 때 형태를
 * 다시 확인하고, 채점(L4)·반복 항목(L5)·표현 사용(L1) 재료를 만든다.
 *
 * A4 응답 타입은 conversation 의 `LessonResponse` 와 **같은 필드를 가진 로컬 구조 타입**이다(L3 는 L2 를 import 하지 않는다 —
 * 요청 객체는 라우트가 값으로 넘긴다, module-dependency §4-4). 스키마·후검증은 요청 쪽(`buildLessonRequest`)이 이미 강제했다.
 */
import type { ChunkType, RepetitionItemType } from '@prisma/client'
import { REPETITION_LESSON_ITEM_CAP, repetitionRefId, type RepetitionItemInput, type RepetitionRefType } from '../repetition'
import { chunkForms, grammarForms, matchTargets, type MatchTarget } from './matching'

export interface LessonGenOutput {
  title: string
  titleKo: string
  rolesKo: { A: string; B: string }
  dialogue: { speaker: 'A' | 'B'; ja: string; reading: string; ko: string }[]
  chunks: { id: string; textJa: string; reading: string; meaningKo: string; chunkType: ChunkType; isNew: boolean }[]
  grammar: { id: string; pattern: string; explanationKo: string; exampleJa: string; exampleReading: string; exampleKo: string }[]
  quiz: { id: string; promptKo: string; promptJa: string | null; choices: string[]; answer: number; targetIds: string[]; explanationKo: string }[]
  application: { id: string; promptKo: string; hintJa: string | null; modelAnswerJa: string; modelReading: string; modelKo: string; targetIds: string[] }[]
  speaking: { id: string; promptKo: string; targetIds: string[]; modelAnswerJa: string; modelReading: string; modelKo: string }[]
  nextPreview: { titleKo: string; teaserKo: string }
}

export type StoredDialogueLine = LessonGenOutput['dialogue'][number] & { segment: number }

/**
 * 저장된 quiz 문항 — 생성 출력(lesson@v8~)은 `promptKo` 가 항상 문자열이지만, lesson@v7 이하로 저장된 레슨은 null 일 수 있다.
 * 저장 JSON 은 다시 만들지 않으므로 읽는 쪽은 null 을 계속 받아들인다(`types/lesson.ts` `LessonQuiz` 와 같은 모양).
 */
export type StoredQuizItem = Omit<LessonGenOutput['quiz'][number], 'promptKo'> & { promptKo: string | null }

/** 저장 모양 v1 — A4 출력 + 대화 줄마다 청취 구간 번호(1부터) + 구간 수. */
export interface StoredLessonContent extends Omit<LessonGenOutput, 'dialogue' | 'quiz'> {
  v: 1
  dialogue: StoredDialogueLine[]
  quiz: StoredQuizItem[]
  segmentCount: number
}

/**
 * 청취 구간 크기(L2) — 3줄씩 묶고, 나머지 2줄은 한 구간, 나머지 1줄은 마지막 두 구간을 2·2 로 만든다(1줄 구간 없음).
 * 6→3·3, 7→3·2·2, 8→3·3·2, 9→3·3·3, 10→3·3·2·2. 1줄뿐이면 1.
 */
export function segmentSizes(n: number): number[] {
  if (n <= 0) return []
  if (n <= 3) return [n]
  const threes = Math.floor(n / 3)
  const rest = n % 3
  if (rest === 0) return Array(threes).fill(3)
  if (rest === 2) return [...Array(threes).fill(3), 2]
  return [...Array(threes - 1).fill(3), 2, 2]
}

export function assignSegments<T>(lines: readonly T[]): (T & { segment: number })[] {
  const out: (T & { segment: number })[] = []
  let i = 0
  segmentSizes(lines.length).forEach((size, s) => {
    for (let k = 0; k < size; k++) out.push({ ...lines[i++], segment: s + 1 })
  })
  return out
}

export function toStoredContent(out: LessonGenOutput): StoredLessonContent {
  const dialogue = assignSegments(out.dialogue)
  return { ...out, v: 1, dialogue, segmentCount: dialogue.length ? dialogue[dialogue.length - 1].segment : 0 }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** DB 의 JSON → 저장 모양(형태가 어긋나면 null — 레슨이 READY 가 아니거나 손상). */
export function readStoredContent(raw: unknown): StoredLessonContent | null {
  if (!isObj(raw) || raw.v !== 1) return null
  const arrays = ['dialogue', 'chunks', 'grammar', 'quiz', 'application', 'speaking'] as const
  if (!arrays.every((k) => Array.isArray(raw[k]))) return null
  if (typeof raw.title !== 'string' || !isObj(raw.nextPreview)) return null
  return raw as unknown as StoredLessonContent
}

// ── L4 채점 ──────────────────────────────────────────────────────────────

export type QuizOutcome = 'CORRECT' | 'WRONG' | null

export interface QuizScore {
  correct: number
  total: number
  answered: number
  /** 0~100 정수(정답 수 / 문항 수). 문항이 없으면 0. */
  score: number
  outcomes: QuizOutcome[]
}

/** 서버 채점 — `progress.quiz.answers[i]` 를 `content.quiz[i].answer` 와 대조. 답하지 않은 문항은 틀린 것으로 세지 않는다(점수 분모에는 든다). */
export function scoreQuiz(quiz: readonly { answer: number }[], answers: readonly (number | null)[] | undefined): QuizScore {
  const outcomes: QuizOutcome[] = quiz.map((q, i) => {
    const a = answers?.[i]
    if (typeof a !== 'number') return null
    return a === q.answer ? 'CORRECT' : 'WRONG'
  })
  const correct = outcomes.filter((o) => o === 'CORRECT').length
  const answered = outcomes.filter((o) => o !== null).length
  const total = quiz.length
  return { correct, total, answered, score: total ? Math.round((correct / total) * 100) : 0, outcomes }
}

// ── L1 말하기 목표 표현 ────────────────────────────────────────────────────

/** 레슨 안의 표현 id(chunks·grammar) → 판정 형태. */
export function expressionTargets(content: Pick<StoredLessonContent, 'chunks' | 'grammar'>, ids: readonly string[]): MatchTarget[] {
  const chunks = new Map(content.chunks.map((c) => [c.id, c]))
  const grammar = new Map(content.grammar.map((g) => [g.id, g]))
  return ids.map((id) => {
    const c = chunks.get(id)
    if (c) return { id, forms: chunkForms(c.textJa, c.reading) }
    const g = grammar.get(id)
    if (g) return { id, forms: grammarForms(g.pattern) }
    return { id, forms: [] }
  })
}

export interface SpeakingCheck {
  itemId: string
  used: boolean
  matchedIds: string[]
  missedIds: string[]
  unknownIds: string[]
}

/** 말하기 과제 1개 판정. `used` = 판정 가능한 목표 표현을 **모두** 썼다(하나 이상 있을 때). */
export function checkSpeaking(content: Pick<StoredLessonContent, 'chunks' | 'grammar' | 'speaking'>, itemId: string, text: string): SpeakingCheck | null {
  const item = content.speaking.find((s) => s.id === itemId)
  if (!item) return null
  const r = matchTargets(text, expressionTargets(content, item.targetIds))
  return { itemId, used: r.matchedIds.length > 0 && r.missedIds.length === 0, ...r }
}

export interface SpeakingRecord {
  itemId: string
  matchedIds: string[]
  missedIds: string[]
}

/** 완료 시 쓴 표현·못 쓴 표현(레슨 안 id) — 쓴 것 = 과제별 matched 합집합, 못 쓴 것 = 말하기 목표 전체 − 쓴 것(판정 불가 제외). */
export function summarizeExpressions(content: Pick<StoredLessonContent, 'chunks' | 'grammar' | 'speaking'>, records: readonly SpeakingRecord[]): { usedIds: string[]; missedIds: string[] } {
  const used = new Set<string>()
  for (const r of records) for (const id of r.matchedIds) used.add(id)
  const judgeable = new Set<string>()
  for (const s of content.speaking) for (const t of expressionTargets(content, s.targetIds)) if (t.forms.length) judgeable.add(t.id)
  const usedIds = [...judgeable].filter((id) => used.has(id))
  const missedIds = [...judgeable].filter((id) => !used.has(id))
  return { usedIds, missedIds }
}

// ── L5 반복 항목 ──────────────────────────────────────────────────────────

export interface LessonRepetitionInput extends RepetitionItemInput {
  /** 레슨 안 id(chunk id·new-N·g1…) — 완료 응답·StudyLog 에서 RepetitionItem id 로 옮길 때 쓴다. */
  contentId: string
}

const NEW_CHUNK_ID = /^new-\d+$/

/**
 * 레슨의 조각(먼저)·문법을 반복 항목으로 — 조각 id 가 이 레슨 주제의 실제 조각이면 `TopicChunk`, 아니면 `Expr`(sha1 표기).
 * quiz 결과는 문항의 targetIds 마다 정답 +1·오답 +1(문항 단위). 상한 12.
 */
export function lessonRepetitionItems(
  content: Pick<StoredLessonContent, 'chunks' | 'grammar' | 'quiz'>,
  opts: { topicChunkIds: ReadonlySet<string>; outcomes: readonly QuizOutcome[] },
): LessonRepetitionInput[] {
  const tally = new Map<string, { correct: number; wrong: number }>()
  content.quiz.forEach((q, i) => {
    const o = opts.outcomes[i]
    if (!o) return
    for (const id of new Set(q.targetIds)) {
      const t = tally.get(id) ?? { correct: 0, wrong: 0 }
      if (o === 'CORRECT') t.correct++
      else t.wrong++
      tally.set(id, t)
    }
  })
  const items: LessonRepetitionInput[] = []
  for (const c of content.chunks) {
    const isTopic = !NEW_CHUNK_ID.test(c.id) && opts.topicChunkIds.has(c.id)
    const refType: RepetitionRefType = isTopic ? 'TopicChunk' : 'Expr'
    const itemType: RepetitionItemType = isTopic ? 'CHUNK' : 'EXPRESSION'
    const t = tally.get(c.id)
    items.push({ contentId: c.id, itemType, refType, refId: isTopic ? c.id : repetitionRefId(c.textJa), textJa: c.textJa, meaningKo: c.meaningKo, correct: t?.correct ?? 0, wrong: t?.wrong ?? 0 })
  }
  for (const g of content.grammar) {
    const t = tally.get(g.id)
    items.push({ contentId: g.id, itemType: 'GRAMMAR', refType: 'Grammar', refId: repetitionRefId(g.pattern), textJa: g.pattern, meaningKo: g.explanationKo, correct: t?.correct ?? 0, wrong: t?.wrong ?? 0 })
  }
  return items.slice(0, REPETITION_LESSON_ITEM_CAP)
}

// ── 오디오 대상 문장 ──────────────────────────────────────────────────────

export const AUDIO_KINDS = ['dialogue', 'grammar', 'application', 'speaking', 'chunk'] as const
export type AudioKind = (typeof AUDIO_KINDS)[number]

/**
 * 재생할 일본어 문장 — 대화 줄·문법 예문·응용/말하기 모범 답·오늘의 표현(chunk, task-025). 범위 밖이면 null.
 * 문장은 늘 소유자 레슨 본문에서 고른다(클라이언트가 글자를 보내지 않는다 — 임의 문장 합성 경로를 만들지 않기 위해).
 */
export function audioText(content: StoredLessonContent, kind: AudioKind, idx: number): string | null {
  const pick = <T>(arr: readonly T[], f: (x: T) => string) => (idx >= 0 && idx < arr.length ? f(arr[idx]) : null)
  if (kind === 'dialogue') return pick(content.dialogue, (d) => d.ja)
  if (kind === 'grammar') return pick(content.grammar, (g) => g.exampleJa)
  if (kind === 'application') return pick(content.application, (a) => a.modelAnswerJa)
  if (kind === 'chunk') return pick(content.chunks, (c) => c.textJa)
  return pick(content.speaking, (s) => s.modelAnswerJa)
}
