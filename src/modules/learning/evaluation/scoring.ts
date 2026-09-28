/**
 * AI 평가 채점 규칙 — 순수 함수(DB 없음). api-contract #65~#68, task-011 Leader's Plan L2·L3.
 *
 * - 객관식(MEANING_CHOICE·READING_INPUT·USAGE_CHOICE·CHUNK_CLASSIFY·ASSEMBLE)은 코드가 채점한다: 맞으면 10, 아니면 0.
 *   READING_INPUT 은 NFKC → 가타카나→히라가나 → 공백·문장부호 제거 뒤 `expected.accepted`(+`reading`) 와 비교.
 *   ASSEMBLE 은 고른 조각 번호 순서로 늘어놓은 조각 문자열 목록이 `expected.order` 와 **전부** 같아야 정답.
 * - 서술형(LISTEN_RESPOND·SITUATION_RESPOND·CORRECTION_SPOT)은 A7 이 0~10 을 준다(미답 0).
 * - 총점 `round(Σscore / Σmax × 100)`(LLM 이 낸 total 은 받지 않는다), 등급 ≥90 EXCELLENT / ≥75 GOOD / ≥60 FAIR / 그 밖 NEEDS_WORK.
 * - 같은 레벨에서 ≥90 을 두 번 연속(가장 최근 DONE 두 건)이면 한 단계 위 레벨 제안 후보.
 */
import type { EvalItemKind, JlptLevel } from '@prisma/client'
import { ApiError } from '@/modules/infra'
import { kataToHira } from '../lessons/matching'
import { createRng, shuffle } from '../vocab/setGenerator'

export const EVAL_TIME_LIMIT_SEC = 600
export const EVAL_ITEM_MAX_SCORE = 10
export const EVAL_LEVEL_UP_SCORE = 90
export const EVAL_DIM_KEYS = ['accuracy', 'vocabulary', 'grammar', 'naturalness', 'assembly'] as const
export type EvalDimKey = (typeof EVAL_DIM_KEYS)[number]
export type EvalRubricScores = Record<EvalDimKey, number>
export type EvalGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_WORK'

export const OBJECTIVE_ITEM_KINDS: ReadonlySet<EvalItemKind> = new Set(['MEANING_CHOICE', 'READING_INPUT', 'USAGE_CHOICE', 'CHUNK_CLASSIFY', 'ASSEMBLE'])
export const SUBJECTIVE_ITEM_KINDS: ReadonlySet<EvalItemKind> = new Set(['LISTEN_RESPOND', 'SITUATION_RESPOND', 'CORRECTION_SPOT'])
const CHUNK_TYPE_VALUES = ['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const
const JLPT_UP: Record<JlptLevel, JlptLevel | null> = { N5: 'N4', N4: 'N3', N3: 'N2', N2: 'N1', N1: null }
const READING_ANSWER_MAX = 80

export function jsonObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
export function jsonStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
export function jsonStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export interface ScorableItem {
  kind: EvalItemKind
  prompt: unknown
  expected: unknown
  /** CHUNK_CLASSIFY 정답 권위값(A6 top-level, `expected.chunkType` 과 동기화된 값). */
  chunkType?: string | null
}

function bad(field: string, message: string, reason: string): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

/** 읽기 비교용 정규화 — NFKC → 가타카나→히라가나 → 공백·문장부호·물결표 제거(장음 ー 는 남긴다). */
export function normalizeReading(s: string): string {
  return kataToHira(s.normalize('NFKC')).replace(/[\s　、。，．,.!！?？・「」『』〜~…()（）]/g, '')
}

/**
 * 답을 **저장 모양**으로 정리한다(#67) — 종류별 모양이 맞지 않으면 400. 반환값이 `EvaluationItem.answerText` 가 된다.
 *   보기 문항 = 고른 보기 글자 그대로 · 읽기 = 입력 글자 · 조각 분류 = NAME|ACTION|FEELING|MODIFIER ·
 *   조립 = 조각 번호 배열 JSON(`[2,0,1]` — 같은 조각이 두 번 나와도 순서를 되살릴 수 있게) · 서술형 = 답 글자(말하기면 발화 최종 텍스트).
 */
export function normalizeAnswer(item: ScorableItem, input: { answerText: string | null; pieceOrder: number[] | null }): string {
  const prompt = jsonObj(item.prompt)
  if (item.kind !== 'ASSEMBLE' && input.pieceOrder) bad('pieceOrder', '조각 순서는 문장 조립 문항에서만 보낼 수 있어요.', 'not_assemble')
  switch (item.kind) {
    case 'MEANING_CHOICE':
    case 'USAGE_CHOICE': {
      if (!input.answerText) bad('answerText', '보기 하나를 골라 주세요.', 'required')
      const want = input.answerText.normalize('NFC').trim()
      const hit = jsonStrArr(prompt.choices).find((c) => c.normalize('NFC').trim() === want)
      if (hit === undefined) bad('answerText', '보기 안에서 골라 주세요.', 'not_a_choice')
      return hit
    }
    case 'READING_INPUT': {
      if (!input.answerText) bad('answerText', '읽는 법을 적어 주세요.', 'required')
      if ([...input.answerText].length > READING_ANSWER_MAX) bad('answerText', `읽는 법은 ${READING_ANSWER_MAX}자까지 적을 수 있어요.`, `max ${READING_ANSWER_MAX}`)
      return input.answerText
    }
    case 'CHUNK_CLASSIFY': {
      const v = input.answerText?.trim().toUpperCase() ?? ''
      if (!(CHUNK_TYPE_VALUES as readonly string[]).includes(v)) bad('answerText', '조각 종류(NAME·ACTION·FEELING·MODIFIER) 중 하나를 골라 주세요.', 'not_a_chunk_type')
      return v
    }
    case 'ASSEMBLE': {
      const n = jsonStrArr(prompt.pieces).length
      const order = input.pieceOrder
      if (!order) bad('pieceOrder', '조각을 모두 늘어놓아 주세요.', 'required')
      const isPermutation = order.length === n && new Set(order).size === n && order.every((i) => i >= 0 && i < n)
      if (!isPermutation) bad('pieceOrder', '조각을 하나씩 모두 써서 늘어놓아 주세요.', 'not_a_permutation')
      return JSON.stringify(order)
    }
    default: {
      if (!input.answerText) bad('answerText', '답을 말하거나 적어 주세요.', 'required')
      return input.answerText
    }
  }
}

/** ASSEMBLE 저장 답(번호 배열 JSON) → 번호 배열. 형식이 어긋나면 null. */
export function assembleOrder(stored: string | null): number[] | null {
  if (!stored) return null
  try {
    const v: unknown = JSON.parse(stored)
    return Array.isArray(v) && v.every((x) => Number.isInteger(x)) ? (v as number[]) : null
  } catch {
    return null
  }
}

/** 화면에 보일 "내 답" — 조립은 고른 순서로 이은 문장, 그 밖은 저장 글자 그대로. */
export function displayAnswer(item: ScorableItem, stored: string | null): string | null {
  if (stored === null) return null
  if (item.kind !== 'ASSEMBLE') return stored
  const pieces = jsonStrArr(jsonObj(item.prompt).pieces)
  const order = assembleOrder(stored)
  return order ? order.map((i) => pieces[i] ?? '').join('') : null
}

/** 객관식 코드 채점(0 또는 만점). 서술형은 null(A7 몫). 미답은 0. */
export function gradeObjective(item: ScorableItem, stored: string | null, maxScore = EVAL_ITEM_MAX_SCORE): number | null {
  if (!OBJECTIVE_ITEM_KINDS.has(item.kind)) return null
  if (stored === null) return 0
  const prompt = jsonObj(item.prompt)
  const expected = jsonObj(item.expected)
  let correct = false
  switch (item.kind) {
    case 'MEANING_CHOICE':
    case 'USAGE_CHOICE': {
      const idx = jsonStrArr(prompt.choices).indexOf(stored)
      correct = idx >= 0 && idx === expected.answer
      break
    }
    case 'READING_INPUT': {
      const got = normalizeReading(stored)
      const accepted = [...jsonStrArr(expected.accepted), jsonStr(expected.reading) ?? ''].map(normalizeReading).filter(Boolean)
      correct = got.length > 0 && accepted.includes(got)
      break
    }
    case 'CHUNK_CLASSIFY':
      correct = stored === (item.chunkType ?? jsonStr(expected.chunkType))
      break
    case 'ASSEMBLE': {
      const pieces = jsonStrArr(prompt.pieces)
      const want = jsonStrArr(expected.order)
      const order = assembleOrder(stored)
      correct = !!order && order.length === want.length && order.every((i, k) => pieces[i] === want[k])
      break
    }
    default:
      break
  }
  return correct ? maxScore : 0
}

/** 총점 = round(Σscore / Σmax × 100). 채점 안 된 문항(null)은 0점. */
export function computeTotal(items: readonly { score: number | null; maxScore: number }[]): number {
  const max = items.reduce((a, i) => a + Math.max(0, i.maxScore), 0)
  if (max <= 0) return 0
  const got = items.reduce((a, i) => a + Math.min(Math.max(0, i.score ?? 0), i.maxScore), 0)
  return Math.round((got / max) * 100)
}

export function gradeOf(total: number): EvalGrade {
  if (total >= 90) return 'EXCELLENT'
  if (total >= 75) return 'GOOD'
  if (total >= 60) return 'FAIR'
  return 'NEEDS_WORK'
}

/** A7 입력 `objectiveSummary` — 객관식 종류별 정답 수/문항 수(처음 나온 순서). */
export function objectiveSummary(items: readonly { kind: EvalItemKind; score: number | null; maxScore: number }[]): { kind: EvalItemKind; correct: number; total: number }[] {
  const out = new Map<EvalItemKind, { kind: EvalItemKind; correct: number; total: number }>()
  for (const it of items) {
    if (!OBJECTIVE_ITEM_KINDS.has(it.kind)) continue
    const row = out.get(it.kind) ?? { kind: it.kind, correct: 0, total: 0 }
    row.total++
    if ((it.score ?? 0) >= it.maxScore) row.correct++
    out.set(it.kind, row)
  }
  return [...out.values()]
}

/**
 * 저장 전 보기·조각 섞기(평가 id·순번 시드 — 재현 가능). 모델은 정답을 앞쪽 보기에 두는 버릇이 있어 보기 순서를 코드가 다시 정하고
 * `expected.answer` 를 따라 옮긴다. 조립 조각이 이미 정답 순서면 한 칸 돌린다. 14일 중복 해시는 보기·조각 **순서**를 쓰지 않으므로
 * (evalChecks `hashCoreText` — 표기·문장·정렬한 order) 섞어도 과거 문항의 해시를 그대로 다시 계산할 수 있다.
 */
export function shuffleForStorage(kind: EvalItemKind, prompt: unknown, expected: unknown, seed: string): { prompt: Record<string, unknown>; expected: Record<string, unknown> } {
  const p = { ...jsonObj(prompt) }
  const e = { ...jsonObj(expected) }
  const rng = createRng(seed)
  if (kind === 'MEANING_CHOICE' || kind === 'USAGE_CHOICE') {
    const choices = jsonStrArr(p.choices)
    const answer = typeof e.answer === 'number' ? e.answer : -1
    if (choices.length === 4 && answer >= 0 && answer < 4) {
      const perm = shuffle([0, 1, 2, 3], rng)
      p.choices = perm.map((i) => choices[i])
      e.answer = perm.indexOf(answer)
    }
  } else if (kind === 'ASSEMBLE') {
    const pieces = jsonStrArr(p.pieces)
    const want = jsonStrArr(e.order)
    let next = shuffle(pieces, rng)
    if (next.length > 1 && next.every((x, i) => x === want[i])) next = [...next.slice(1), next[0]]
    p.pieces = next
  }
  return { prompt: p, expected: e }
}

export function nextLevel(level: JlptLevel): JlptLevel | null {
  return JLPT_UP[level] ?? null
}

export interface DoneEvaluationBrief {
  id: string
  kind: 'WORDS' | 'TALK'
  level: JlptLevel
  totalScore: number | null
  completedAt: Date | null
}

export interface LevelUpBasis {
  fromLevel: JlptLevel
  toLevel: JlptLevel
  /** 오래된 것 → 최근 것(2건). */
  basis: DoneEvaluationBrief[]
}

/**
 * 가장 최근 DONE 두 건(`recent` = 최근 것부터)이 같은 레벨·둘 다 ≥90 이고, 그 레벨이 지금 학습자 레벨이며 위 단계가 있으면 제안 후보.
 * 두 건 중 오래된 쪽이 이미 다른 제안의 근거였는지는 제안 쪽(conversation)이 본다(같은 두 번을 두 번 쓰지 않게).
 */
export function levelUpBasis(recent: readonly DoneEvaluationBrief[], profileLevel: JlptLevel): LevelUpBasis | null {
  if (recent.length < 2) return null
  const [a, b] = recent
  if (a.level !== b.level || a.level !== profileLevel) return null
  if ((a.totalScore ?? 0) < EVAL_LEVEL_UP_SCORE || (b.totalScore ?? 0) < EVAL_LEVEL_UP_SCORE) return null
  const toLevel = nextLevel(a.level)
  if (!toLevel) return null
  return { fromLevel: a.level, toLevel, basis: [b, a] }
}

/** 10분 마감 시각 — 시작(IN_PROGRESS 이후)한 평가만. */
export function deadlineOf(startedAt: Date, started: boolean): Date | null {
  return started ? new Date(startedAt.getTime() + EVAL_TIME_LIMIT_SEC * 1000) : null
}

/** 루브릭 방어적 정리 — 5차원 0~5 정수(누락 0). */
export function readRubric(v: unknown): EvalRubricScores | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const out = {} as EvalRubricScores
  for (const k of EVAL_DIM_KEYS) {
    const n = typeof o[k] === 'number' && Number.isFinite(o[k]) ? Math.round(o[k] as number) : 0
    out[k] = Math.min(5, Math.max(0, n))
  }
  return out
}
