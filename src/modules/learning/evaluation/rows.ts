/**
 * 평가 행 공통 — 조회 모양·DTO(정답 숨김·엔진명 제외)·잠금·상태 오류.
 *
 * 잠금 순서(교착 방지 — task-006/008/010 과 같은 "사용자 행 → 대상 행"):
 *   출제(#65): 사용자 행 → (진행 중 평가·잡 확인) → 평가·잡 생성
 *   답(#67)·시작: 사용자 행 → 평가 행(FOR UPDATE) → (말하기: 발화 행) → 문항
 *   제출(#68): 사용자 행 → 평가 행 → 문항 재채점 → 잡
 *   채점 완료: 사용자 행 → 평가 행 → 문항 → StudyLog → 평가 DONE → StatsSnapshot(EVALUATION) → DAILY
 *
 * **정답 숨김(task-008 과 같은 원칙)**: READY·IN_PROGRESS·GRADING 에서는 `expected`·`score`·`feedback`·`dims` 를 싣지 않고,
 * 듣고 답하기의 들려줄 문장(`prompt.textJa`)도 빼고 `textHidden:true` 만 준다(소리는 #67a 로 받는다). DONE 이면 전부 공개.
 * 예외: 푸는 도중 "글자로 보기"(#67c)를 한 듣기 문항은 `textRevealedAt` 이 남아 다시 들어와도 글자를 준다(`textRevealed:true`).
 * DB 의 `prompt`·`expected` 는 A6 원본(보기·조각 순서만 섞음) 그대로다 — 14일 중복 해시를 다시 계산해야 해서 저장 칸을 고치지 않는다.
 */
import type { EvalItemKind, EvalKind, EvalStatus, InputSource, JlptLevel, Prisma } from '@prisma/client'
import { ApiError, lockUserRow, type Tx } from '@/modules/infra'
import { assembleOrder, deadlineOf, displayAnswer, EVAL_TIME_LIMIT_SEC, gradeOf, jsonObj, jsonStrArr, OBJECTIVE_ITEM_KINDS, readRubric, spotAnswer, type EvalGrade, type EvalRubricScores } from './scoring'
import { isEvaluationId } from './validate'

export const EVAL_SELECT = {
  id: true, userId: true, kind: true, topicId: true, level: true, status: true, totalScore: true, rubric: true, comment: true, nextFocus: true,
  studyLogId: true, error: true, startedAt: true, submittedAt: true, completedAt: true,
  topic: { select: { id: true, title: true } },
} as const
export type EvaluationRow = Prisma.EvaluationGetPayload<{ select: typeof EVAL_SELECT }>

export const ITEM_SELECT = {
  id: true, order: true, kind: true, prompt: true, expected: true, wordId: true, wordSurfaceSnap: true, chunkType: true, answerText: true,
  inputSource: true, score: true, maxScore: true, feedback: true, dims: true, answeredAt: true, textRevealedAt: true,
} as const
export type EvaluationItemRow = Prisma.EvaluationItemGetPayload<{ select: typeof ITEM_SELECT }>

export const ACTIVE_EVAL_STATUSES: readonly EvalStatus[] = ['GENERATING', 'READY', 'IN_PROGRESS', 'GRADING']

export function evaluationNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '평가를 찾을 수 없어요.')
}

/** READY 는 아직 시작 전(타이머 없음) — `startedAt` 칸은 만든 시각이라 화면에 보내지 않는다. */
export function isStarted(status: EvalStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'GRADING' || status === 'DONE'
}

export function answerConflict(status: EvalStatus): ApiError | null {
  if (status === 'READY' || status === 'IN_PROGRESS') return null
  if (status === 'DONE') return new ApiError('CONFLICT', '이미 채점이 끝난 평가예요.', { reason: 'ALREADY_DONE', status })
  if (status === 'GRADING') return new ApiError('CONFLICT', '제출한 평가예요. 채점을 기다려 주세요.', { reason: 'SUBMITTED', status })
  return new ApiError('CONFLICT', '아직 풀 수 없는 평가예요.', { reason: 'NOT_READY', status })
}

export interface EvaluationItemDto {
  id: string
  order: number
  kind: EvalItemKind
  /** 화면용 문항 — 듣고 답하기는 제출 전 `{instructionKo, textHidden:true}`(글자 없음, 단 "글자로 보기"를 한 문항은 `textJa` 포함). */
  prompt: Record<string, unknown>
  maxScore: number
  answered: boolean
  /** 화면에 보일 내 답(조립은 고른 순서로 이은 문장). */
  answerText: string | null
  /** 조립 문항 — 고른 조각 번호 순서(다시 들어왔을 때 되살리기). */
  answerOrder: number[] | null
  /** 틀린 곳 찾기 — 고른 `prompt.segments` 번호(조각 없이 적은 답은 null). */
  answerSpot: number | null
  inputSource: InputSource | null
  answeredAt: string | null
  /** 듣고 답하기 — 제출 전에 "글자로 보기"로 들려줄 문장을 봤는가(#67c, 결과의 "글자로 봤어요"). 다른 문항은 false. */
  textRevealed: boolean
  /** 이하 DONE 에서만(그 전엔 null). */
  expected: Record<string, unknown> | null
  score: number | null
  /** 객관식만 — 맞았는가. */
  correct: boolean | null
  feedback: string | null
  dims: string[] | null
}

export interface EvaluationResultDto {
  totalScore: number
  grade: EvalGrade
  rubric: EvalRubricScores | null
  comment: string | null
  nextFocus: string[]
  studyLogId: string | null
  completedAt: string | null
  /** 제출이 10분을 넘겼는가(표시만). */
  overtime: boolean
  /** 시작 → 제출(초). */
  durationSec: number | null
}

export interface EvaluationDto {
  id: string
  kind: EvalKind
  level: JlptLevel
  status: EvalStatus
  topic: { id: string; title: string } | null
  timeLimitSec: number
  /** IN_PROGRESS 이후만(READY 는 null — 첫 답에서 시계가 시작된다). */
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  completedAt: string | null
  /** 지금(제출했으면 제출 시각) 10분을 넘겼는가. */
  overtime: boolean
  /** GENERATING·GRADING 이면 진행 중 잡 id(#55 폴링). 채점 잡이 없으면(실패) null → "다시 채점". */
  jobId: string | null
  /** FAILED(출제 실패)·GRADING 중 채점 실패면 오류 코드(본문 없음). */
  error: string | null
  itemCount: number
  answeredCount: number
  items: EvaluationItemDto[]
  result: EvaluationResultDto | null
}

function publicPrompt(item: EvaluationItemRow, reveal: boolean): Record<string, unknown> {
  const p = jsonObj(item.prompt)
  if (item.kind !== 'LISTEN_RESPOND') return p
  if (reveal || item.textRevealedAt) return { textJa: p.textJa, instructionKo: p.instructionKo, textHidden: false }
  return { instructionKo: p.instructionKo, textHidden: true }
}

export function toItemDto(item: EvaluationItemRow, reveal: boolean): EvaluationItemDto {
  const objective = OBJECTIVE_ITEM_KINDS.has(item.kind)
  return {
    id: item.id,
    order: item.order,
    kind: item.kind,
    prompt: publicPrompt(item, reveal),
    maxScore: item.maxScore,
    answered: item.answerText !== null,
    answerText: displayAnswer(item, item.answerText),
    answerOrder: item.kind === 'ASSEMBLE' ? assembleOrder(item.answerText) : null,
    answerSpot: item.kind === 'CORRECTION_SPOT' ? (spotAnswer(item.answerText)?.spot ?? null) : null,
    inputSource: item.inputSource,
    answeredAt: item.answeredAt ? item.answeredAt.toISOString() : null,
    textRevealed: item.kind === 'LISTEN_RESPOND' && !!item.textRevealedAt,
    expected: reveal ? jsonObj(item.expected) : null,
    score: reveal ? (item.score ?? 0) : null,
    correct: reveal && objective ? (item.score ?? 0) >= item.maxScore : null,
    feedback: reveal ? item.feedback : null,
    dims: reveal ? jsonStrArr(item.dims) : null,
  }
}

function durationSec(row: Pick<EvaluationRow, 'startedAt' | 'submittedAt'>): number | null {
  return row.submittedAt ? Math.max(0, Math.round((row.submittedAt.getTime() - row.startedAt.getTime()) / 1000)) : null
}

export function toEvaluationDto(row: EvaluationRow, items: readonly EvaluationItemRow[], opts: { jobId?: string | null; now?: number } = {}): EvaluationDto {
  const now = opts.now ?? Date.now()
  const started = isStarted(row.status)
  const deadline = deadlineOf(row.startedAt, started)
  const reveal = row.status === 'DONE'
  const endAt = row.submittedAt ? row.submittedAt.getTime() : now
  const overtime = !!deadline && endAt > deadline.getTime()
  const sorted = [...items].sort((a, b) => a.order - b.order)
  return {
    id: row.id,
    kind: row.kind,
    level: row.level,
    status: row.status,
    topic: row.topic ? { id: row.topic.id, title: row.topic.title } : null,
    timeLimitSec: EVAL_TIME_LIMIT_SEC,
    startedAt: started ? row.startedAt.toISOString() : null,
    deadlineAt: deadline ? deadline.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    overtime,
    jobId: row.status === 'GENERATING' || row.status === 'GRADING' ? (opts.jobId ?? null) : null,
    error: row.status === 'FAILED' || row.status === 'GRADING' ? row.error : null,
    itemCount: sorted.length,
    answeredCount: sorted.filter((i) => i.answerText !== null).length,
    items: sorted.map((i) => toItemDto(i, reveal)),
    result:
      reveal && row.totalScore !== null
        ? {
            totalScore: row.totalScore,
            grade: gradeOf(row.totalScore),
            rubric: readRubric(row.rubric),
            comment: row.comment,
            nextFocus: jsonStrArr(row.nextFocus),
            studyLogId: row.studyLogId,
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
            overtime,
            durationSec: durationSec(row),
          }
        : null,
  }
}

/** 평가 행 잠금(FOR UPDATE) 후 최신 행 — 없거나 남의 것 404. 사용자 행은 먼저 잡는다. */
export async function lockEvaluation(tx: Tx, userId: string, id: string): Promise<EvaluationRow> {
  if (!isEvaluationId(id)) throw evaluationNotFound()
  await lockUserRow(tx, userId)
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM Evaluation WHERE id = ${id} AND userId = ${userId} FOR UPDATE`
  if (!rows.length) throw evaluationNotFound()
  return tx.evaluation.findUniqueOrThrow({ where: { id }, select: EVAL_SELECT })
}
