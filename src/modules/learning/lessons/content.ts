/**
 * 레슨 본문(Lesson.content) — 순수 함수만. A4 출력(`LessonGenOutput`)을 저장 모양으로 바꾸고(L2 청취 구간 번호), 읽을 때 형태를
 * 다시 확인하고, 채점(L4)·반복 항목(L5)·표현 사용(L1) 재료를 만든다.
 *
 * A4 응답 타입은 conversation 의 `LessonResponse` 와 **같은 필드를 가진 로컬 구조 타입**이다(L3 는 L2 를 import 하지 않는다 —
 * 요청 객체는 라우트가 값으로 넘긴다, module-dependency §4-4). 스키마·후검증은 요청 쪽(`buildLessonRequest`)이 이미 강제했다.
 */
import type { RepetitionItemType } from '@prisma/client'
import { REPETITION_LESSON_ITEM_CAP, repetitionRefId, type RepetitionItemInput, type RepetitionRefType } from '../repetition'
import type { TopicChunkType } from '@/types/topic'
import { chunkForms, grammarForms, matchTargets, type MatchTarget } from './matching'

/** ③ 조각 종류(task-081, 레슨 내용 JSON 전용 — Prisma·types/chat 의 ChunkType 과 별개). conversation `PIECE_TYPES` 와 같은 값. */
export type PieceType = 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER' | 'EXPRESSION' | 'LINK'

/**
 * 대화 줄의 조각(저장 모양). 요청의 `extraCheck`(conversation `applyLessonPieces`)가 정리까지 끝낸 뒤라 `slash` 는 `true` 이거나 키가 없고,
 * `type` 이 null 이면 `ko` 도 null 이다 — 이 층은 다시 검증하지 않는다(규칙 소유자는 conversation 한 곳).
 */
export interface StoredPiece {
  ja: string
  type: PieceType | null
  ko: string | null
  slash?: true
}

export interface LessonGenOutput {
  title: string
  titleKo: string
  rolesKo: { A: string; B: string }
  /** `pieces` — 정상 줄 = 정리된 배열, 조각 검증을 못 넘은 줄 = null(task-081, 37-12-3·37-18-1 ⑥). */
  dialogue: { speaker: 'A' | 'B'; ja: string; reading: string; ko: string; pieces: StoredPiece[] | null }[]
  chunks: { id: string; textJa: string; reading: string; meaningKo: string; chunkType: TopicChunkType; isNew: boolean }[]
  grammar: { id: string; pattern: string; explanationKo: string; exampleJa: string; exampleReading: string; exampleKo: string }[]
  application: { id: string; promptKo: string; hintJa: string | null; modelAnswerJa: string; modelReading: string; modelKo: string; targetIds: string[] }[]
  speaking: { id: string; promptKo: string; targetIds: string[]; modelAnswerJa: string; modelReading: string; modelKo: string }[]
  nextPreview: { titleKo: string; teaserKo: string }
}

/** `pieces` 키 없음 = 조각 단계 전 옛 수업(task-081). */
export type StoredDialogueLine = Omit<LessonGenOutput['dialogue'][number], 'pieces'> & { pieces?: StoredPiece[] | null; segment: number }

/**
 * 저장된 quiz 문항(옛 수업 전용 — lesson@v10 부터 생성 출력에 문항이 없다). lesson@v7 이하로 저장된 레슨은 `promptKo` 가 null 일 수 있다.
 * 저장 JSON 은 다시 만들지 않으므로 읽는 쪽은 null 을 계속 받아들인다(`types/lesson.ts` `LessonQuiz` 와 같은 모양).
 */
export interface StoredQuizItem {
  id: string
  promptKo: string | null
  promptJa: string | null
  choices: string[]
  answer: number
  targetIds: string[]
  explanationKo: string
}

/**
 * 저장 모양 v1 — A4 출력 + 대화 줄마다 청취 구간 번호(1부터) + 구간 수. `quiz` 는 **읽은 뒤의 모양**이다 — 새 수업은 저장 JSON 에 키가 없고
 * `readStoredContent` 가 `[]` 로 채운다(서버 안 코드는 늘 배열을 본다, 37-12-9).
 */
export interface StoredLessonContent extends Omit<LessonGenOutput, 'dialogue'> {
  v: 1
  dialogue: StoredDialogueLine[]
  quiz: StoredQuizItem[]
  segmentCount: number
}

/** 새로 저장하는 모양 — `quiz` 키가 없다. */
export type NewStoredLessonContent = Omit<StoredLessonContent, 'quiz'>

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

/**
 * 생성 출력 → 저장 모양. `pieces` 는 요청 쪽이 이미 정리했으므로 그대로 싣고, 키가 빠진 줄만 null 로 맞춘다(새 수업의 줄에는 늘 키가 있다 —
 * 키 없음은 옛 수업 표시라서). `quiz` 는 새 수업 내용에 두지 않는다(키 자체가 없음 — 스키마가 막지만 방어).
 */
export function toStoredContent(out: LessonGenOutput): NewStoredLessonContent {
  const { quiz: _dropped, ...rest } = out as LessonGenOutput & { quiz?: unknown }
  void _dropped
  const dialogue = assignSegments(out.dialogue.map((d) => ({ ...d, pieces: Array.isArray(d.pieces) ? d.pieces : null })))
  return { ...rest, v: 1, dialogue, segmentCount: dialogue.length ? dialogue[dialogue.length - 1].segment : 0 }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * DB 의 JSON → 저장 모양(형태가 어긋나면 null — 레슨이 READY 가 아니거나 손상). `quiz` 는 없어도 정상(새 수업, task-081)이고 `[]` 로 채운다 —
 * 있으면 배열이어야 한다(null·객체면 손상). 옛 수업(배열이 있음)은 저장된 객체를 그대로 돌려준다. `pieces` 는 여기서 보지 않는다(생성 때 정리).
 */
export function readStoredContent(raw: unknown): StoredLessonContent | null {
  if (!isObj(raw) || raw.v !== 1) return null
  const arrays = ['dialogue', 'chunks', 'grammar', 'application', 'speaking'] as const
  if (!arrays.every((k) => Array.isArray(raw[k]))) return null
  if (raw.quiz !== undefined && !Array.isArray(raw.quiz)) return null
  if (typeof raw.title !== 'string' || !isObj(raw.nextPreview)) return null
  if (Array.isArray(raw.quiz)) return raw as unknown as StoredLessonContent
  return { ...(raw as unknown as NewStoredLessonContent), quiz: [] }
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

export const AUDIO_KINDS = ['dialogue', 'grammar', 'application', 'speaking', 'chunk', 'piece', 'phrase'] as const
export type AudioKind = (typeof AUDIO_KINDS)[number]
/** `sub`(조각·구간 번호)가 필요한 kind(task-081 #62c). */
export const AUDIO_SUB_KINDS: readonly AudioKind[] = ['piece', 'phrase']

// 저장 JSON 은 생성 때 정리됐지만, 읽는 쪽이 모양이 어긋난 항목 하나 때문에 던지지 않게 최소 형태만 본다(검증 규칙의 두 번째 사본이 아니다).
const isPiece = (p: unknown): p is StoredPiece => isObj(p) && typeof p.ja === 'string' && (p.type === null || typeof p.type === 'string')

/**
 * 끊어 읽기 구간 k 의 글(37-4-2·37-12-6) — `slash` 가 붙은 조각 «뒤» 에서 나눈 묶음의 조각 글을 잇고, **끝의 `type null` 조각(문장부호)을 뺀다**.
 * 없는 구간·문장부호뿐인 구간은 null. 화면 `chunkLogic.phraseText` 와 같은 규칙 — 같은 픽스처(`__tests__/pieceRuleCases.json`)로 양쪽을 시험한다.
 */
export function phraseText(pieces: readonly StoredPiece[], k: number): string | null {
  const phrases: StoredPiece[][] = []
  let cur: StoredPiece[] = []
  for (const p of pieces) {
    cur.push(p)
    if (p.slash === true) {
      phrases.push(cur)
      cur = []
    }
  }
  if (cur.length) phrases.push(cur)
  const ph = Number.isInteger(k) && k >= 0 && k < phrases.length ? phrases[k] : null
  if (!ph) return null
  let end = ph.length
  while (end > 0 && ph[end - 1].type === null) end--
  const text = ph.slice(0, end).map((p) => p.ja).join('')
  return text || null
}

/**
 * 오늘의 조각 수(#58 `pieces`, 37-12-7) — 모든 줄의 `type ≠ null` 조각을 `type + ja` 로 한 번씩 센다. 어떤 줄에도 조각 배열이 없으면
 * (옛 수업·모든 줄이 분해 실패) null. 화면 `chunkLogic.pieceCount` 와 같은 규칙(같은 픽스처).
 */
export function pieceCount(content: { dialogue: readonly { pieces?: unknown }[] }): number | null {
  if (!content.dialogue.some((d) => Array.isArray(d.pieces))) return null
  const seen = new Set<string>()
  for (const d of content.dialogue) {
    if (!Array.isArray(d.pieces)) continue
    for (const p of d.pieces) if (isPiece(p) && p.type !== null) seen.add(`${p.type}\u0000${p.ja}`)
  }
  return seen.size
}

/**
 * 재생할 일본어 문장 — 대화 줄·문법 예문·응용/말하기 모범 답·오늘의 표현(chunk, task-025)·대화 줄의 조각(piece)·끊어 읽기 구간(phrase, task-081).
 * 범위 밖이면 null — piece·phrase 는 줄·조각·구간이 없거나, 그 줄의 `pieces` 가 null/없음이거나, 조각이 문장부호(type null)여도 null.
 * 문장은 늘 소유자 레슨 본문에서 고른다(클라이언트가 글자를 보내지 않는다 — 임의 문장 합성 경로를 만들지 않기 위해).
 */
export function audioText(content: StoredLessonContent, kind: AudioKind, idx: number, sub?: number | null): string | null {
  const pick = <T>(arr: readonly T[], f: (x: T) => string | null) => (idx >= 0 && idx < arr.length ? f(arr[idx]) : null)
  if (kind === 'dialogue') return pick(content.dialogue, (d) => d.ja)
  if (kind === 'grammar') return pick(content.grammar, (g) => g.exampleJa)
  if (kind === 'application') return pick(content.application, (a) => a.modelAnswerJa)
  if (kind === 'chunk') return pick(content.chunks, (c) => c.textJa)
  if (kind === 'speaking') return pick(content.speaking, (s) => s.modelAnswerJa)
  if (typeof sub !== 'number' || !Number.isInteger(sub) || sub < 0) return null
  return pick(content.dialogue, (d) => {
    if (!Array.isArray(d.pieces) || !d.pieces.every(isPiece)) return null
    if (kind === 'phrase') return phraseText(d.pieces, sub)
    const p = sub < d.pieces.length ? d.pieces[sub] : null
    return p && p.type !== null ? p.ja : null
  })
}
