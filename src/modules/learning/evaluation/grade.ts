/**
 * 제출·채점(api-contract #68, A7 잡 120s) — A7 요청은 라우트가 conversation 의 `buildEvalGradeRequest` 를 **함수로** 넘겨(`grading.build`)
 * 잡 안에서 제출 시점의 문항·답으로 만든다(L3 는 L2 를 import 하지 않는다 — module-dependency §4-4 의 값 전달을 함수로 넓힌 것).
 *
 * 제출(한 트랜잭션, 사용자 → 평가 잠금):
 *   READY·IN_PROGRESS → 객관식 재채점(미답 0) → GRADING·submittedAt → 잡 생성.
 *   GRADING + 살아 있는 채점 잡 → 그 잡을 돌려준다(새 잡 없음, 멱등). GRADING + 잡 없음(앞선 채점 실패) → 새 잡("다시 채점").
 *   DONE → 409 ALREADY_DONE · GENERATING/FAILED → 409 NOT_READY. 10분이 지난 제출도 받는다(표시만).
 * 채점 잡: 문항 읽기 → A7 → 코드 마무리(누락 0점·클램프 — `grading.finalize`, 미답 서술형은 무조건 0) → 총점 `round(Σscore/Σmax×100)`
 *   (LLM total 은 받지 않는다) → **마지막 단일 트랜잭션**: 사용자 → 평가 잠금(아직 GRADING 인가) → 서술형 점수·피드백 → `StudyLog(EVALUATION,
 *   DIRECT)` → `Evaluation DONE(totalScore·rubric·comment·nextFocus·studyLogId)` → `StatsSnapshot(EVALUATION)` → `DAILY(evals+1)`.
 *   중간 실패는 전부 롤백되고 평가는 GRADING 에 남는다(error = 오류 코드) — 다시 제출하면 새 잡으로 처음부터(행 중복 없음:
 *   GRADING 조건 + `StatsSnapshot @@unique(userId, EVALUATION, evaluationId)`).
 * 트랜잭션 뒤(같은 트랜잭션 X, L5): 가장 최근 DONE 두 건이 같은 레벨 ≥90 이면 `grading.onLevelUp` 으로 레벨 제안(conversation 소유 — 라우트가 연결).
 * 세대 펜싱(`fencing.ts`): "다시 채점" 은 같은 평가를 새 잡으로 채점하므로, 저장·실패 기록은 사용자 행 잠금 뒤 자기 잡이 아직 현재 세대일 때만 한다
 *   (stale 로 닫힌 옛 잡의 늦은 성공이 새 잡 대신 DONE 을 쓰거나, 늦은 실패가 새 잡이 도는 평가에 error 를 남기지 않게). 저장 트랜잭션 끝에서
 *   `markJobStage` 로 잡이 아직 살아 있는지 한 번 더 확인하고(잠금 밖 stale 정리에 졌으면 되돌림), 트랜잭션 뒤 `completeJob` 결과가 false 면 로그만 남긴다.
 * **잡 DONE 은 레벨 제안 단계 뒤**다 — 결과 화면이 잡 DONE 을 보고 #66 을 읽을 때 제안 카드가 이미 있게(트랜잭션 안에서 잡을 끝내면 폴링이
 * 제안 생성보다 먼저 DONE 을 볼 수 있다). 그 사이 프로세스가 죽으면 잡은 5분 뒤 stale FAILED 가 되지만 평가는 이미 DONE — 화면은 #66 status 로 판단한다.
 */
import type { EvalItemKind, EvalKind, InputSource, JlptLevel, Prisma } from '@prisma/client'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type TraceStep } from '@/modules/engine'
import { ApiError, classifyError, dates, jobs, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { bumpDailySnapshot, createEvaluationSnapshot } from '../snapshots'
import { recordStudyLog } from '../studyLog'
import { assertCurrentEvalJob, EvaluationJobSuperseded, logSuperseded, type EvalJobClaim } from './fencing'
import { ITEM_SELECT, lockEvaluation, type EvaluationItemRow } from './rows'
import {
  computeTotal,
  deadlineOf,
  gradeObjective,
  gradeOf,
  gradingAnswerText,
  jsonObj,
  levelUpBasis,
  objectiveSummary,
  SUBJECTIVE_ITEM_KINDS,
  type DoneEvaluationBrief,
  type EvalRubricScores,
  type LevelUpBasis,
} from './scoring'
import { EVAL_ANSWER_TEXT_MAX } from './validate'

export type EvalSubjectiveKind = 'LISTEN_RESPOND' | 'SITUATION_RESPOND' | 'CORRECTION_SPOT'

/** A7 입력 재료(conversation `EvalGradeInput` 과 같은 모양 — 라우트의 `build` 가 그대로 넘긴다). */
export interface EvalGradeMaterials {
  evalKind: EvalKind
  level: JlptLevel
  objectiveSummary: { kind: EvalItemKind; correct: number; total: number }[]
  subjectiveItems: { order: number; kind: EvalSubjectiveKind; prompt: Record<string, unknown>; expected: Record<string, unknown>; answerText: string }[]
}

/** A7 응답(conversation `EvalGradeResponse` 과 같은 모양). */
export interface EvalGradeOutputLike {
  items: readonly { order: number; score: number; feedback_ko: string }[]
  rubric: object
  comment_ko: string
  next_focus: readonly string[]
}

export interface FinalizedEvalGrade {
  /** `allowedOrders` 각각 정확히 1건(누락 0점·0~10 클램프). */
  items: { order: number; score: number; feedback: string }[]
  rubric: EvalRubricScores
  comment: string
  nextFocus: string[]
}

export interface LevelUpCandidate extends LevelUpBasis {
  evaluationId: string
}

export interface EvaluationGrading<T extends EvalGradeOutputLike> {
  promptVersion: string
  /** 라우트가 `buildEvalGradeRequest` 로 만든다. */
  build: (m: EvalGradeMaterials) => LlmJsonRequest<T>
  /** 라우트가 `finalizeEvalGradeItems`·`clampRubric` 로 마무리한다. */
  finalize: (data: T, allowedOrders: number[]) => FinalizedEvalGrade
  /** 트랜잭션 뒤 레벨 제안(실패해도 채점은 끝난 것 — 로그만). */
  onLevelUp?: (c: LevelUpCandidate) => Promise<void>
  /**
   * (task-012b D-B7) 음성으로 답한 서술형 문항의 채점 텍스트 — 라우트가 speech 의 선택을 주입한다(learning → speech import ✗).
   * 채점 잡이 시작할 때 한 번 부르고 분석을 기다리지 않는다. 돌려준 문항만 답·입력 방식을 바꿔 채점하고 저장 트랜잭션에 함께 남긴다.
   * 없거나 실패하면 저장된 답(실시간 인식) 그대로 채점한다.
   */
  speechAnswers?: (items: { evaluationItemId: string; answerText: string }[]) => Promise<Map<string, { text: string; inputSource: InputSource }>>
}

export interface SubmitEvaluationResult {
  evaluationId: string
  jobId: string
  status: 'GRADING'
  /** 이미 돌고 있는 채점 잡을 돌려줬는가. */
  reused: boolean
  overtime: boolean
}

const NO_ANSWER_FEEDBACK = '답하지 않은 문항이라 0점이에요.'

/** 서술형 문항 → A7 재료(미답은 빈 문자열 — 프롬프트가 "(미답)" 으로 렌더). 틀린 곳 찾기에서 조각을 골랐으면 `gradingAnswerText` 한 줄 형식. */
export function gradingMaterials(ev: { kind: EvalKind; level: JlptLevel }, items: readonly EvaluationItemRow[]): EvalGradeMaterials {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  return {
    evalKind: ev.kind,
    level: ev.level,
    objectiveSummary: objectiveSummary(sorted),
    subjectiveItems: sorted
      .filter((i) => SUBJECTIVE_ITEM_KINDS.has(i.kind))
      .map((i) => ({ order: i.order, kind: i.kind as EvalSubjectiveKind, prompt: jsonObj(i.prompt), expected: jsonObj(i.expected), answerText: gradingAnswerText(i) })),
  }
}

/** A7 마무리 + 객관식 점수 → 문항별 최종 점수·총점(순수). 미답 서술형은 A7 점수와 무관하게 0. */
export function mergeGrades(items: readonly EvaluationItemRow[], fin: FinalizedEvalGrade): { scores: Map<string, { score: number; feedback: string | null }>; total: number } {
  const byOrder = new Map(fin.items.map((g) => [g.order, g]))
  const scores = new Map<string, { score: number; feedback: string | null }>()
  for (const it of items) {
    if (SUBJECTIVE_ITEM_KINDS.has(it.kind)) {
      const g = byOrder.get(it.order)
      const answered = it.answerText !== null
      const score = answered ? Math.min(it.maxScore, Math.max(0, Math.round(g?.score ?? 0))) : 0
      scores.set(it.id, { score, feedback: truncateCodePoints((g?.feedback ?? '').trim() || (answered ? '' : NO_ANSWER_FEEDBACK), 1_000) || null })
    } else {
      scores.set(it.id, { score: gradeObjective(it, it.answerText, it.maxScore) ?? 0, feedback: null })
    }
  }
  const total = computeTotal(items.map((it) => ({ score: scores.get(it.id)?.score ?? 0, maxScore: it.maxScore })))
  return { scores, total }
}

type GradeClaim = EvalJobClaim

async function claimGrading(userId: string, id: string, promptVersion: string, now: Date): Promise<SubmitEvaluationResult & { claim: GradeClaim | null }> {
  const traceId = newTraceId()
  return withTransaction(async (tx) => {
    const row = await lockEvaluation(tx, userId, id)
    if (row.status === 'DONE') throw new ApiError('CONFLICT', '이미 채점이 끝난 평가예요.', { reason: 'ALREADY_DONE', status: row.status, evaluationId: id })
    if (row.status === 'GENERATING' || row.status === 'FAILED') throw new ApiError('CONFLICT', '아직 풀 수 없는 평가예요.', { reason: 'NOT_READY', status: row.status })
    const deadline = deadlineOf(row.startedAt, true) as Date
    if (row.status === 'GRADING') {
      const overtime = !!row.submittedAt && row.submittedAt.getTime() > deadline.getTime()
      const active = await jobs.findActiveJob({ userId, kind: 'EVAL_GRADE', refId: id }, tx)
      if (active) return { evaluationId: id, jobId: active.id, status: 'GRADING', reused: true, overtime, claim: null }
      await tx.evaluation.update({ where: { id }, data: { error: null } })
      const job = await jobs.createJob({ userId, kind: 'EVAL_GRADE', refId: id, traceId, payload: { promptKey: 'evalGrade', promptVersion, inputMeta: { retry: true } } as Prisma.InputJsonValue }, tx)
      return { evaluationId: id, jobId: job.id, status: 'GRADING', reused: false, overtime, claim: { evaluationId: id, jobId: job.id, traceId } }
    }
    const items = await tx.evaluationItem.findMany({ where: { evaluationId: id }, select: ITEM_SELECT })
    for (const it of items) {
      const s = gradeObjective(it, it.answerText, it.maxScore)
      if (s !== null && s !== it.score) await tx.evaluationItem.update({ where: { id: it.id }, data: { score: s } })
    }
    const startedAt = row.status === 'READY' ? now : row.startedAt
    await tx.evaluation.update({ where: { id }, data: { status: 'GRADING', submittedAt: now, startedAt, error: null } })
    const inputMeta = {
      items: items.length,
      answered: items.filter((i) => i.answerText !== null).length,
      subjective: items.filter((i) => SUBJECTIVE_ITEM_KINDS.has(i.kind)).length,
    }
    const job = await jobs.createJob({ userId, kind: 'EVAL_GRADE', refId: id, traceId, payload: { promptKey: 'evalGrade', promptVersion, inputMeta } as Prisma.InputJsonValue }, tx)
    const overtime = now.getTime() > (deadlineOf(startedAt, true) as Date).getTime()
    return { evaluationId: id, jobId: job.id, status: 'GRADING', reused: false, overtime, claim: { evaluationId: id, jobId: job.id, traceId } }
  })
}

export type SpeechAnswerOverrides = Map<string, { answerText: string; inputSource: InputSource }>

export interface GradedEvaluation {
  items: readonly EvaluationItemRow[]
  scores: Map<string, { score: number; feedback: string | null }>
  total: number
  fin: FinalizedEvalGrade
  model: string
  promptVersion: string
  /** (D-B7) 채점에 쓴 말하기 문항 텍스트가 저장된 답과 다를 때 — 같은 트랜잭션에서 답·입력 방식을 그 값으로 남긴다. */
  answers?: SpeechAnswerOverrides
}

/** (D-B7) 음성 답 서술형 문항만 골라 주입 함수에 묻고, 저장된 답과 다른 것만 돌려준다. 주입 실패는 저장된 답으로 채점(로그만). */
export async function speechAnswerOverrides(
  items: readonly Pick<EvaluationItemRow, 'id' | 'kind' | 'answerText' | 'inputSource'>[],
  pick: EvaluationGrading<EvalGradeOutputLike>['speechAnswers'],
): Promise<SpeechAnswerOverrides> {
  const out: SpeechAnswerOverrides = new Map()
  if (!pick) return out
  const voiced = items.filter((it) => SUBJECTIVE_ITEM_KINDS.has(it.kind) && it.answerText !== null && it.inputSource !== null && it.inputSource !== 'TEXT')
  if (voiced.length === 0) return out
  try {
    const picked = await pick(voiced.map((it) => ({ evaluationItemId: it.id, answerText: it.answerText as string })))
    for (const it of voiced) {
      const p = picked.get(it.id)
      const text = p ? truncateCodePoints(p.text.trim(), EVAL_ANSWER_TEXT_MAX) : ''
      if (p && text && (text !== it.answerText || p.inputSource !== it.inputSource)) out.set(it.id, { answerText: text, inputSource: p.inputSource })
    }
  } catch (e) {
    console.warn('[evaluation] 말하기 문항 텍스트 선택 실패 — 저장된 답으로 채점:', e instanceof Error ? e.name : 'unknown')
  }
  return out
}

/**
 * 채점 결과 저장(펜싱, 기록률 100% 단일 트랜잭션) — 호출자 트랜잭션에서: 세대 확인(사용자 잠금) → 평가 잠금(아직 GRADING) → 서술형 점수·피드백 →
 * StudyLog(EVALUATION, DIRECT) → 평가 DONE → StatsSnapshot(EVALUATION) → DAILY(evals+1) → 잡이 아직 살아 있나(`markJobStage`, 아니면 되돌림).
 * 세대가 바뀌었으면 `EvaluationJobSuperseded`. 잡 DONE 은 호출자가 레벨 제안 뒤에 한다.
 */
export async function saveGradedEvaluation(tx: Tx, userId: string, c: GradeClaim, g: GradedEvaluation, now = new Date()): Promise<void> {
  await assertCurrentEvalJob(tx, userId, 'EVAL_GRADE', c)
  const row = await lockEvaluation(tx, userId, c.evaluationId)
  if (row.status !== 'GRADING') throw new ApiError('CONFLICT', '평가 상태가 바뀌어 저장하지 않았어요.', { reason: 'STATE_CHANGED', status: row.status })
  const today = dates.todayKst(now)
  const grade = gradeOf(g.total)
  for (const it of g.items) {
    const s = g.scores.get(it.id)
    if (!s) continue
    const a = g.answers?.get(it.id)
    if (s.score !== it.score || s.feedback !== it.feedback || a) {
      await tx.evaluationItem.update({ where: { id: it.id }, data: { score: s.score, feedback: s.feedback, ...(a ? { answerText: a.answerText, inputSource: a.inputSource } : {}) } })
    }
  }
  const submittedAt = row.submittedAt ?? now
  const durationSec = Math.max(0, Math.round((submittedAt.getTime() - row.startedAt.getTime()) / 1000))
  const overtime = submittedAt.getTime() > (deadlineOf(row.startedAt, true) as Date).getTime()
  const answered = g.items.filter((i) => i.answerText !== null).length
  const log = await recordStudyLog(
    userId,
    {
      date: today,
      type: 'EVALUATION',
      origin: 'DIRECT',
      refId: c.evaluationId,
      summary: `AI 평가(${row.kind === 'WORDS' ? '단어' : '회화'}·${row.level}) ${g.total}점 · 답한 문항 ${answered}/${g.items.length}${overtime ? ' · 시간 초과' : ''}`,
      result: { total: g.total, grade, rubric: g.fin.rubric, kind: row.kind, level: row.level, itemCount: g.items.length, answered, overtime } as Prisma.InputJsonValue,
      durationSec,
    },
    tx,
  )
  await tx.evaluation.update({
    where: { id: c.evaluationId },
    data: {
      status: 'DONE',
      totalScore: g.total,
      rubric: g.fin.rubric as unknown as Prisma.InputJsonValue,
      comment: g.fin.comment,
      nextFocus: g.fin.nextFocus as unknown as Prisma.InputJsonValue,
      studyLogId: log.id,
      completedAt: now,
      model: g.model.slice(0, 20),
      promptVersion: g.promptVersion.slice(0, 20),
      error: null,
    },
  })
  await createEvaluationSnapshot(userId, c.evaluationId, { kind: row.kind, level: row.level, total: g.total, grade, rubric: g.fin.rubric, itemCount: g.items.length, date: today }, tx)
  await bumpDailySnapshot(userId, today, { evals: 1 }, tx)
  // 잠금 밖 stale 정리(#55·#66 조회 등)가 세대 확인 뒤에 끼어들어 이 잡을 닫았으면 기록을 되돌린다(다시 채점한 새 잡이 쓸 자리).
  if (!(await jobs.markJobStage(c.jobId, 95, 'SAVED', tx))) throw new EvaluationJobSuperseded()
}

/** 채점 실패 기록(펜싱) — 평가는 GRADING 에 남기고 `error` 만(오류 코드) + 잡 FAILED 를 호출자 트랜잭션에서. 세대가 바뀌었으면 `EvaluationJobSuperseded`. */
export async function failGradedEvaluation(tx: Tx, userId: string, c: GradeClaim, code: string): Promise<void> {
  await assertCurrentEvalJob(tx, userId, 'EVAL_GRADE', c)
  await tx.evaluation.updateMany({ where: { id: c.evaluationId, userId, status: 'GRADING' }, data: { error: code.slice(0, 300) } })
  await jobs.failJob(c.jobId, code, tx)
}

async function markGradeFailed(userId: string, c: GradeClaim, code: string): Promise<void> {
  try {
    await withTransaction((tx) => failGradedEvaluation(tx, userId, c, code))
  } catch (e) {
    if (e instanceof EvaluationJobSuperseded) return logSuperseded('EVAL_GRADE', c, 'fail')
    console.error('[evaluation] 채점 실패 기록 실패:', e instanceof Error ? e.name : 'unknown')
  }
}

/** 가장 최근 DONE 두 건으로 레벨 제안 후보(이 평가가 가장 최근일 때만). */
export async function findLevelUpCandidate(userId: string, evaluationId: string): Promise<LevelUpCandidate | null> {
  const recent = await prisma.evaluation.findMany({
    where: { userId, status: 'DONE' },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    take: 2,
    select: { id: true, kind: true, level: true, totalScore: true, completedAt: true },
  })
  if (recent[0]?.id !== evaluationId) return null
  const profile = await getProfile(userId)
  const basis = levelUpBasis(recent as DoneEvaluationBrief[], profile.level as JlptLevel)
  return basis ? { ...basis, evaluationId } : null
}

async function runGrading<T extends EvalGradeOutputLike>(userId: string, c: GradeClaim, grading: EvaluationGrading<T>): Promise<void> {
  const t0 = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    const ev = await prisma.evaluation.findFirst({ where: { id: c.evaluationId, userId }, select: { kind: true, level: true, status: true, topicId: true } })
    if (!ev || ev.status !== 'GRADING') throw new ApiError('CONFLICT', '평가 상태가 바뀌어 채점하지 않았어요.', { reason: 'STATE_CHANGED' })
    const stored = await prisma.evaluationItem.findMany({ where: { evaluationId: c.evaluationId }, select: ITEM_SELECT })
    const answers = await speechAnswerOverrides(stored, grading.speechAnswers)
    const items = stored.map((it) => {
      const a = answers.get(it.id)
      return a ? { ...it, answerText: a.answerText, inputSource: a.inputSource } : it
    })
    const materials = gradingMaterials(ev, items)
    await jobs.updateJobProgress(c.jobId, 10, 'LLM')
    let t = Date.now()
    const r = await llm.completeJson<T>({ ...grading.build(materials), priority: 'batch' })
    steps.push({ name: 'LLM', ms: Date.now() - t, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars })
    const fin = grading.finalize(r.data, materials.subjectiveItems.map((s) => s.order))
    const { scores, total } = mergeGrades(items, fin)
    await jobs.updateJobProgress(c.jobId, 90, 'SAVE')
    t = Date.now()
    try {
      await withTransaction((tx) => saveGradedEvaluation(tx, userId, c, { items, scores, total, fin, model: r.model, promptVersion: grading.promptVersion, answers }))
    } catch (e) {
      if (!(e instanceof EvaluationJobSuperseded)) throw e
      logSuperseded('EVAL_GRADE', c, 'save')
      steps.push({ name: 'SAVE', ms: Date.now() - t, superseded: true })
      void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - t0, errorCode, refType: 'evalGrade', refId: c.evaluationId })
      return
    }
    steps.push({ name: 'SAVE', ms: Date.now() - t, items: items.length, total, speechText: answers.size })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    await markGradeFailed(userId, c, errorCode)
    void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - t0, errorCode, refType: 'evalGrade', refId: c.evaluationId })
    throw e
  }
  if (grading.onLevelUp) {
    const t = Date.now()
    try {
      const cand = await findLevelUpCandidate(userId, c.evaluationId)
      if (cand) await grading.onLevelUp(cand)
      steps.push({ name: 'LEVEL_UP', ms: Date.now() - t, proposed: cand !== null })
    } catch (e) {
      steps.push({ name: 'LEVEL_UP', ms: Date.now() - t, failed: true })
      console.error('[evaluation] 레벨 제안 실패:', e instanceof Error ? e.name : 'unknown')
    }
  }
  // 평가는 이미 DONE — 여기서 잡이 이미 닫혀 있으면(드문 stale) 화면은 #66 status 로 판단하므로 로그만.
  if (!(await jobs.completeJob(c.jobId))) console.warn(`[evaluation] 채점은 저장했지만 잡이 이미 닫혀 있음 — job=${c.jobId} evaluation=${c.evaluationId}`)
  void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - t0, errorCode, refType: 'evalGrade', refId: c.evaluationId })
}

/** #68 — 점유 후(새 잡이면) 백그라운드 채점을 걸고 바로 돌려준다. */
export async function submitEvaluation<T extends EvalGradeOutputLike>(userId: string, id: string, grading: EvaluationGrading<T>, now = new Date()): Promise<SubmitEvaluationResult> {
  const { claim, ...result } = await claimGrading(userId, id, grading.promptVersion, now)
  if (claim) jobs.runJobInBackground(claim.jobId, () => runGrading(userId, claim, grading))
  return result
}

