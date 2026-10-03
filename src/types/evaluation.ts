/**
 * AI 평가(task-011) 화면 ↔ 서버 DTO — api-contract §2-14 #65~#69·#67a·#67b 와 이번 배선(#67 `spotIndex`·#67c 글자로 보기)의 필드명 그대로.
 * 서버 모듈을 import 하지 않는다(컴포넌트는 서버 코드를 끌어오지 않는다 — module-dependency §3 규칙 5).
 */
import type { ProposalDto } from './chat'
import type { JlptLevel } from './lesson'

export type EvalKind = 'WORDS' | 'TALK'
export type EvalStatus = 'GENERATING' | 'READY' | 'IN_PROGRESS' | 'GRADING' | 'DONE' | 'FAILED'
export type EvalItemKind =
  | 'MEANING_CHOICE'
  | 'READING_INPUT'
  | 'USAGE_CHOICE'
  | 'CHUNK_CLASSIFY'
  | 'LISTEN_RESPOND'
  | 'ASSEMBLE'
  | 'SITUATION_RESPOND'
  | 'CORRECTION_SPOT'
export type EvalInputSource = 'REALTIME_STT' | 'SERVER_STT' | 'TEXT'
export type EvalGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_WORK'
export type EvalDim = 'accuracy' | 'vocabulary' | 'grammar' | 'naturalness' | 'assembly'
export type EvalRubric = Record<EvalDim, number>

/* ── #66 ─────────────────────────────────────────────────────────── */

export interface EvaluationItem {
  id: string
  order: number
  kind: EvalItemKind
  /** 종류별 모양(evalSchemas 계약) — 듣고 답하기는 제출 전 `{instructionKo, textHidden:true}`. */
  prompt: Record<string, unknown>
  maxScore: number
  answered: boolean
  answerText: string | null
  answerOrder: number[] | null
  answerSpot?: number | null
  inputSource: EvalInputSource | null
  answeredAt: string | null
  textRevealed?: boolean
  expected: Record<string, unknown> | null
  score: number | null
  correct: boolean | null
  feedback: string | null
  dims: string[] | null
}

export interface EvaluationResult {
  totalScore: number
  grade: EvalGrade
  rubric: EvalRubric | null
  comment: string | null
  nextFocus: string[]
  studyLogId: string | null
  completedAt: string | null
  overtime: boolean
  durationSec: number | null
  levelProposal: ProposalDto | null
}

export interface EvaluationDetail {
  id: string
  kind: EvalKind
  level: JlptLevel
  status: EvalStatus
  topic: { id: string; title: string } | null
  timeLimitSec: number
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  completedAt: string | null
  overtime: boolean
  jobId: string | null
  error: string | null
  itemCount: number
  answeredCount: number
  items: EvaluationItem[]
  result: EvaluationResult | null
}

/* ── #65 · #67 · #67c · #68 · #69 ────────────────────────────────── */

export interface CreateEvaluationResult {
  evaluationId: string
  jobId: string
  status: 'GENERATING'
}

export interface AnswerBody {
  answerText?: string
  inputSource?: EvalInputSource
  utteranceId?: string
  pieceOrder?: number[]
  spotIndex?: number
}

export interface AnswerResult {
  id: string
  answered: true
  graded: boolean
  answerText: string | null
  answerOrder: number[] | null
  answerSpot?: number | null
  inputSource: EvalInputSource
  answeredAt: string
  evaluationStatus: 'IN_PROGRESS'
  startedAt: string
  deadlineAt: string
  utteranceId: string | null
  hasAudio: boolean
}

export interface RevealResult {
  itemId: string
  textJa: string
  textRevealed: true
  textRevealedAt: string
}

export interface SubmitResult {
  evaluationId: string
  jobId: string
  status: 'GRADING'
  reused: boolean
  overtime: boolean
}

export interface EvaluationListItem {
  id: string
  kind: EvalKind
  level: JlptLevel
  status: EvalStatus
  topic: { id: string; title: string } | null
  totalScore: number | null
  grade: EvalGrade | null
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  completedAt: string | null
}

export interface EvaluationList {
  items: EvaluationListItem[]
  nextCursor: string | null
}

export interface EvalAudioResult {
  itemId: string
  clips: { url: string; durationMs: number | null; pauseBeforeMs: number; cached: boolean }[]
}
