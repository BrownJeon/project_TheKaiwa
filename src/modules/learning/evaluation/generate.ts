/**
 * 평가 출제(api-contract #65, A6 잡 60s) — module-dependency §4-4: A6 **요청 객체는 라우트가** conversation 의 `buildEvalGenRequest` 로
 * 만들어 값으로 넘기고(14일 해시도 라우트가 `computeEvalItemHash` 로 계산), 이 모듈은 재료 읽기(`materials.ts`)·점유·잡 실행·저장만 한다.
 *
 * 점유(한 트랜잭션, 사용자 행 잠금 아래):
 *   ① 진행 중(GENERATING·READY·IN_PROGRESS·GRADING) 평가가 있으면 409 `{reason:'IN_PROGRESS', evaluationId, status}`.
 *      GENERATING 인데 살아 있는 잡이 없으면(프로세스가 죽은 잡) 그 행을 FAILED 로 닫고 계속한다.
 *   ② 출제에 실패한 행(FAILED·문항 0)이 있으면 그 행을 GENERATING 으로 되살리고(레슨 #59 "다시 만들기" 와 같은 패턴 — 기록 목록에
 *      빈 실패 행이 쌓이지 않게), 없으면 새 행. 잡(QUEUED) 생성.
 * 실행(같은 프로세스 백그라운드, batch 레인): A6 → 문항 행(보기·조각 순서 섞기, 재료 단어 연결) → `Evaluation READY` + 문항 + 잡 DONE 을
 * 한 트랜잭션. 실패하면 평가 FAILED(error = 오류 코드만) + 잡 FAILED. 잡 payload·Trace 에는 프롬프트·문항 본문을 싣지 않는다(입력 메타만).
 * 세대 펜싱(`fencing.ts`): ② 되살리기는 같은 평가 행을 다시 쓰므로, 저장·실패 기록은 사용자 행 잠금 뒤 자기 잡이 아직 현재 세대일 때만 한다
 * (옛 잡의 늦은 성공이 새 세대에 문항을 넣거나 늦은 실패가 새 세대를 FAILED 로 닫지 않게). `completeJob` 이 false(잠금 밖 stale 정리에 짐)면 되돌린다.
 */
import { Prisma, type EvalItemKind, type EvalKind } from '@prisma/client'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type TraceStep } from '@/modules/engine'
import { ApiError, classifyError, jobs, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { assertTopicVisible, mapTopicGone } from '../topics/visible'
import { assertCurrentEvalJob, EvaluationJobSuperseded, logSuperseded, type EvalJobClaim } from './fencing'
import type { EvalMaterialWord, EvaluationMaterials } from './materials'
import { ACTIVE_EVAL_STATUSES } from './rows'
import { EVAL_ITEM_MAX_SCORE, jsonStrArr, shuffleForStorage } from './scoring'

/** A6 응답 한 문항(conversation `EvalGenItem` 과 같은 모양 — L3 는 L2 타입을 import 하지 않아 구조로만 받는다). */
export interface EvalGenItemLike {
  kind: string
  dims: readonly string[]
  wordSurface: string | null
  chunkType: string | null
  prompt: object
  expected: object
}
export interface EvalGenOutputLike {
  items: readonly EvalGenItemLike[]
}

export interface EvaluationGeneration<T extends EvalGenOutputLike> {
  /** 라우트가 `buildEvalGenRequest` 로 만든 요청(스키마·후검증·결정적 보정 포함). */
  request: LlmJsonRequest<T>
  promptVersion: string
  /** AiJob.payload 입력 메타(개수·길이 — 본문 없음). */
  inputMeta: Record<string, string | number | boolean | null>
}

export interface CreateEvaluationResult {
  evaluationId: string
  jobId: string
  status: 'GENERATING'
}

const KIND_ORDER: Record<EvalKind, readonly EvalItemKind[]> = {
  WORDS: ['MEANING_CHOICE', 'READING_INPUT', 'USAGE_CHOICE', 'CHUNK_CLASSIFY'],
  TALK: ['LISTEN_RESPOND', 'ASSEMBLE', 'SITUATION_RESPOND', 'CORRECTION_SPOT'],
}
const ALL_KINDS = new Set<string>([...KIND_ORDER.WORDS, ...KIND_ORDER.TALK])
const CHUNK_TYPES = new Set(['NAME', 'ACTION', 'FEELING', 'MODIFIER'])

export interface EvalItemCreateRow {
  order: number
  kind: EvalItemKind
  prompt: Prisma.InputJsonValue
  expected: Prisma.InputJsonValue
  wordId: string | null
  wordSurfaceSnap: string | null
  chunkType: 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER' | null
  dims: Prisma.InputJsonValue
  maxScore: number
}

/**
 * A6 응답 → 문항 행(순수). 순서는 종류 표시 순(WORDS 뜻·읽기·용법·분류 / TALK 듣기·조립·상황·틀린 곳), 같은 종류 안은 A6 순서.
 * `wordSurface` 는 A6 원본 그대로 `wordSurfaceSnap` 에 남기고(14일 해시 재현), [재료] 표기와 글자 그대로 같을 때만 `wordId` 를 잇는다.
 */
export function buildItemRows(evaluationId: string, kind: EvalKind, out: EvalGenOutputLike, materials: readonly EvalMaterialWord[]): EvalItemCreateRow[] {
  const bySurface = new Map(materials.map((w) => [w.surface, w.id]))
  const rank = (k: string) => {
    const i = KIND_ORDER[kind].indexOf(k as EvalItemKind)
    return i < 0 ? 99 : i
  }
  const items = out.items.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it.kind) - rank(b.it.kind) || a.i - b.i)
  return items.map(({ it }, order) => {
    if (!ALL_KINDS.has(it.kind)) throw new ApiError('INTERNAL', '문항 종류가 올바르지 않아요.')
    const k = it.kind as EvalItemKind
    const { prompt, expected } = shuffleForStorage(k, it.prompt, it.expected, `${evaluationId}|${order}`)
    const surface = typeof it.wordSurface === 'string' && it.wordSurface ? it.wordSurface : null
    return {
      order,
      kind: k,
      prompt: prompt as Prisma.InputJsonValue,
      expected: expected as Prisma.InputJsonValue,
      wordId: surface ? (bySurface.get(surface) ?? null) : null,
      wordSurfaceSnap: surface ? truncateCodePoints(surface, 80) : null,
      chunkType: k === 'CHUNK_CLASSIFY' && it.chunkType && CHUNK_TYPES.has(it.chunkType) ? (it.chunkType as EvalItemCreateRow['chunkType']) : null,
      dims: jsonStrArr(it.dims) as Prisma.InputJsonValue,
      maxScore: EVAL_ITEM_MAX_SCORE,
    }
  })
}

type Claim = EvalJobClaim

type EvalInputMeta = EvaluationGeneration<EvalGenOutputLike>['inputMeta']

async function claimEvaluation(userId: string, m: EvaluationMaterials, promptVersion: string, inputMeta: EvalInputMeta): Promise<Claim> {
  const traceId = newTraceId()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    return claimEvaluationTx(tx, userId, m, promptVersion, inputMeta, traceId)
  })
}

/**
 * #65 점유 본체 — **호출자의 트랜잭션·사용자 행 잠금 안**. 재료(`m`)는 잠금 전에 읽었으므로 주제 삭제(#173, 같은 잠금)가 그 사이 끝났을 수 있다 —
 * 잠금 직후 주제를 다시 확인한다(평가에는 진행 중 챌린지 예외 없음, REV-152a M-1 · Codex C1 ⓐ 와 같은 패턴).
 */
export async function claimEvaluationTx(tx: Tx, userId: string, m: EvaluationMaterials, promptVersion: string, inputMeta: EvalInputMeta, traceId: string): Promise<Claim> {
  if (m.topic) await assertTopicVisible(tx, userId, m.topic.id)
  const active = await tx.evaluation.findMany({
    where: { userId, status: { in: [...ACTIVE_EVAL_STATUSES] } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, status: true },
  })
  for (const e of active) {
    if (e.status === 'GENERATING' && !(await jobs.findActiveJob({ userId, kind: 'EVAL_GEN', refId: e.id }, tx))) {
      await tx.evaluation.updateMany({ where: { id: e.id, status: 'GENERATING' }, data: { status: 'FAILED', error: 'stale' } })
      continue
    }
    throw new ApiError('CONFLICT', '진행 중인 평가가 있어요. 끝낸 뒤 새로 만들 수 있어요.', { reason: 'IN_PROGRESS', evaluationId: e.id, status: e.status })
  }
  const revive = await tx.evaluation.findFirst({
    where: { userId, status: 'FAILED', submittedAt: null, items: { none: {} } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  })
  const base = {
    kind: m.kind,
    level: m.level,
    topicId: m.topic?.id ?? null,
    status: 'GENERATING' as const,
    error: null,
    startedAt: new Date(),
    submittedAt: null,
    completedAt: null,
    totalScore: null,
    comment: null,
    model: null,
    promptVersion: null,
  }
  let evaluationId: string
  try {
    if (revive) {
      await tx.evaluation.update({ where: { id: revive.id }, data: { ...base, rubric: Prisma.DbNull, nextFocus: Prisma.DbNull, studyLogId: null } })
      evaluationId = revive.id
    } else {
      evaluationId = (await tx.evaluation.create({ data: { ...base, userId }, select: { id: true } })).id
    }
  } catch (e) {
    // 잠금 밖에서 주제가 지워진 경우(시드 로더 등) — FK 위반(P2003)을 500 대신 404 TOPIC_GONE 으로(REV-152a M-1).
    throw mapTopicGone(e)
  }
  const job = await jobs.createJob(
    { userId, kind: 'EVAL_GEN', refId: evaluationId, traceId, payload: { promptKey: 'evalGen', promptVersion, inputMeta } as Prisma.InputJsonValue },
    tx,
  )
  return { evaluationId, jobId: job.id, traceId }
}

/** 출제 결과 저장(펜싱) — 평가 READY + 문항 + 잡 DONE 을 호출자 트랜잭션에서. 세대가 바뀌었으면 `EvaluationJobSuperseded`(트랜잭션 되돌림). */
export async function saveGeneratedEvaluation(tx: Tx, userId: string, c: Claim, fields: { rows: readonly EvalItemCreateRow[]; model: string; promptVersion: string }): Promise<void> {
  await assertCurrentEvalJob(tx, userId, 'EVAL_GEN', c)
  const upd = await tx.evaluation.updateMany({
    where: { id: c.evaluationId, userId, status: 'GENERATING' },
    data: { status: 'READY', model: fields.model.slice(0, 20), promptVersion: fields.promptVersion.slice(0, 20), error: null },
  })
  if (upd.count === 0) throw new ApiError('CONFLICT', '평가 상태가 바뀌어 저장하지 못했어요.', { reason: 'STATE_CHANGED' })
  await tx.evaluationItem.createMany({ data: fields.rows.map((row) => ({ ...row, evaluationId: c.evaluationId })) })
  // 잠금 밖의 stale 정리(#55·#66 조회 등)가 확인과 이 사이에 끼어들었으면 잡이 DONE 이 되지 않는다 — 평가·문항도 되돌린다.
  if (!(await jobs.completeJob(c.jobId, tx))) throw new EvaluationJobSuperseded()
}

/** 출제 실패 기록(펜싱) — 평가 FAILED(오류 코드만) + 잡 FAILED 를 호출자 트랜잭션에서. 세대가 바뀌었으면 `EvaluationJobSuperseded`. */
export async function failGeneratedEvaluation(tx: Tx, userId: string, c: Claim, code: string): Promise<void> {
  await assertCurrentEvalJob(tx, userId, 'EVAL_GEN', c)
  await tx.evaluation.updateMany({ where: { id: c.evaluationId, userId, status: 'GENERATING' }, data: { status: 'FAILED', error: code.slice(0, 300) } })
  await jobs.failJob(c.jobId, code, tx)
}

async function markEvaluationFailed(userId: string, c: Claim, code: string): Promise<void> {
  try {
    await withTransaction((tx) => failGeneratedEvaluation(tx, userId, c, code))
  } catch (e) {
    if (e instanceof EvaluationJobSuperseded) return logSuperseded('EVAL_GEN', c, 'fail')
    console.error('[evaluation] FAILED 기록 실패:', e instanceof Error ? e.name : 'unknown')
  }
}

async function runGeneration<T extends EvalGenOutputLike>(userId: string, c: Claim, m: EvaluationMaterials, gen: EvaluationGeneration<T>): Promise<void> {
  const startedAt = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    await jobs.updateJobProgress(c.jobId, 10, 'LLM')
    let t = Date.now()
    const r = await llm.completeJson<T>({ ...gen.request, priority: 'batch' })
    steps.push({ name: 'LLM', ms: Date.now() - t, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars })
    await jobs.updateJobProgress(c.jobId, 90, 'SAVE')
    t = Date.now()
    const rows = buildItemRows(c.evaluationId, m.kind, r.data, m.words)
    try {
      await withTransaction((tx) => saveGeneratedEvaluation(tx, userId, c, { rows, model: r.model, promptVersion: gen.promptVersion }))
    } catch (e) {
      if (!(e instanceof EvaluationJobSuperseded)) throw e
      logSuperseded('EVAL_GEN', c, 'save')
      steps.push({ name: 'SAVE', ms: Date.now() - t, superseded: true })
      return
    }
    steps.push({ name: 'SAVE', ms: Date.now() - t, items: rows.length, linked: rows.filter((x) => x.wordId).length })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    await markEvaluationFailed(userId, c, errorCode)
    throw e
  } finally {
    void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - startedAt, errorCode, refType: 'evalGen', refId: c.evaluationId })
  }
}

/** #65 — 점유 후 백그라운드 실행을 걸고 바로 돌려준다. */
export async function createEvaluation<T extends EvalGenOutputLike>(userId: string, m: EvaluationMaterials, gen: EvaluationGeneration<T>): Promise<CreateEvaluationResult> {
  const claim = await claimEvaluation(userId, m, gen.promptVersion, gen.inputMeta)
  jobs.runJobInBackground(claim.jobId, () => runGeneration(userId, claim, m, gen))
  return { evaluationId: claim.evaluationId, jobId: claim.jobId, status: 'GENERATING' }
}

/**
 * GENERATING 평가의 잡이 죽었으면 FAILED 로 닫는다(읽는 자리의 지연 정리, 레슨 `settleGenerating` 과 같은 한 문장 조건부 UPDATE —
 * 확인과 닫기 사이에 "다시 만들기" 가 같은 행을 새 잡으로 되살려도 새 잡의 평가를 닫지 않는다). 살아 있으면 잡 id.
 */
export async function settleEvalGenerating(userId: string, id: string, tx?: Tx): Promise<string | null> {
  const active = await jobs.findActiveJob({ userId, kind: 'EVAL_GEN', refId: id }, tx)
  if (active) return active.id
  await (tx ?? prisma).$executeRaw`UPDATE Evaluation SET status = 'FAILED', error = 'stale'
    WHERE id = ${id} AND userId = ${userId} AND status = 'GENERATING'
      AND NOT EXISTS (SELECT 1 FROM AiJob j WHERE j.refId = ${id} AND j.kind = 'EVAL_GEN' AND j.status IN ('QUEUED', 'RUNNING'))`
  return null
}
