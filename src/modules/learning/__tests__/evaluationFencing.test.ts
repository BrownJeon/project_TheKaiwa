/**
 * task-011 후속(Leader, task-010 Codex C2-1 과 같은 패턴) — 평가 잡 세대 펜싱. 출제(되살리기)·채점(다시 채점)에서 옛 잡 A 가 stale 로 닫히고
 * 같은 평가가 새 잡 B 로 이어진 뒤 A 가 늦게 성공·실패해도 B 의 평가를 건드리지 않는다. 가짜 tx 로 판정만 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import { EvaluationJobSuperseded, type EvalJobClaim } from '../evaluation/fencing'
import { failGeneratedEvaluation, saveGeneratedEvaluation, type EvalItemCreateRow } from '../evaluation/generate'
import { failGradedEvaluation, saveGradedEvaluation, type GradedEvaluation } from '../evaluation/grade'
import type { EvaluationItemRow } from '../evaluation/rows'

const U = 'cuser00000000000000000001'
const E = 'ceval000000000000000000001'

type JobKind = 'EVAL_GEN' | 'EVAL_GRADE'
interface Job {
  id: string
  userId: string
  kind: JobKind
  refId: string
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
  createdAt: Date
  error: string | null
  stage: string | null
}

function world(jobs: Job[], evalStatus: string) {
  const ev = {
    id: E, userId: U, kind: 'TALK', topicId: null, level: 'N4', status: evalStatus, totalScore: null as number | null, rubric: null, comment: null, nextFocus: null,
    studyLogId: null as string | null, error: null as string | null, startedAt: new Date('2026-09-28T10:00:00Z'), submittedAt: new Date('2026-09-28T10:05:00Z'), completedAt: null, topic: null,
  }
  const items: unknown[] = []
  const logs: unknown[] = []
  const snaps: { kind: string; periodKey: string }[] = []
  const calls: string[] = []
  const active = (s: Job['status']) => s === 'QUEUED' || s === 'RUNNING'
  let beforeJobUpdate: (() => void) | null = null
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      calls.push(sql.includes('`User`') ? 'lockUser' : sql.includes('FROM Evaluation') ? 'lockEval' : 'lockDaily')
      return [{ id: 'row' }]
    },
    $executeRaw: async () => 1,
    aiJob: {
      findFirst: async ({ where }: { where: Partial<Job> }) => {
        calls.push('job.find')
        return jobs.find((j) => j.id === where.id && j.userId === where.userId && j.kind === where.kind && j.refId === where.refId) ?? null
      },
      count: async ({ where }: { where: { userId: string; kind: string; refId: string; id: { not: string }; createdAt: { gte: Date } } }) =>
        jobs.filter((j) => j.userId === where.userId && j.kind === where.kind && j.refId === where.refId && j.id !== where.id.not && j.createdAt >= where.createdAt.gte).length,
      updateMany: async ({ where, data }: { where: { id: string }; data: Partial<Job> }) => {
        beforeJobUpdate?.()
        const j = jobs.find((x) => x.id === where.id && active(x.status))
        if (!j) return { count: 0 }
        calls.push(`job.${data.status ?? data.stage}`)
        Object.assign(j, data.status ? { status: data.status, error: data.error ?? null } : { stage: data.stage ?? null })
        return { count: 1 }
      },
    },
    evaluation: {
      updateMany: async ({ where, data }: { where: { id: string; userId: string; status: string }; data: Record<string, unknown> }) => {
        if (ev.id !== where.id || ev.userId !== where.userId || ev.status !== where.status) return { count: 0 }
        calls.push(`eval.${String(data.status ?? 'error')}`)
        Object.assign(ev, data)
        return { count: 1 }
      },
      findUniqueOrThrow: async () => ({ ...ev }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push(`eval.${String(data.status)}`)
        Object.assign(ev, data)
        return ev
      },
    },
    evaluationItem: {
      createMany: async ({ data }: { data: unknown[] }) => {
        items.push(...data)
        return { count: data.length }
      },
      update: async () => ({}),
    },
    studyLog: {
      create: async ({ data }: { data: unknown }) => {
        logs.push(data)
        return { id: `sl${logs.length}` }
      },
    },
    statsSnapshot: {
      create: async ({ data }: { data: { kind: string; periodKey: string } }) => {
        snaps.push(data)
        return data
      },
      findUnique: async () => ({ data: {} }),
      update: async () => ({}),
    },
  }
  return {
    tx: tx as unknown as Tx,
    ev,
    items,
    logs,
    snaps,
    calls,
    job: (id: string) => jobs.find((j) => j.id === id)!,
    onBeforeJobUpdate: (fn: () => void) => {
      beforeJobUpdate = fn
    },
  }
}

const job = (kind: JobKind, id: string, status: Job['status'], ageSec: number): Job => ({ id, userId: U, kind, refId: E, status, createdAt: new Date(Date.UTC(2026, 8, 28, 3, 0, 0) - ageSec * 1000), error: null, stage: null })
const claim = (jobId: string): EvalJobClaim => ({ evaluationId: E, jobId, traceId: 't' })
const rows: EvalItemCreateRow[] = [{ order: 0, kind: 'SITUATION_RESPOND', prompt: { situationKo: 's' }, expected: {}, wordId: null, wordSurfaceSnap: null, chunkType: null, dims: [], maxScore: 10 }]
const gen = { rows, model: 'm', promptVersion: 'evalGen@v2' }

const item: EvaluationItemRow = { id: 'i0', order: 0, kind: 'SITUATION_RESPOND', prompt: {}, expected: {}, wordId: null, wordSurfaceSnap: null, chunkType: null, answerText: 'x', inputSource: 'TEXT', score: null, maxScore: 10, feedback: null, dims: [], answeredAt: null }
const graded = (fb: string): GradedEvaluation => ({
  items: [item],
  scores: new Map([['i0', { score: 8, feedback: fb }]]),
  total: 80,
  fin: { items: [{ order: 0, score: 8, feedback: fb }], rubric: { accuracy: 4, vocabulary: 4, grammar: 4, naturalness: 4, assembly: 4 }, comment: 'c', nextFocus: [] },
  model: 'm',
  promptVersion: 'evalGrade@v2',
})

// ── 출제(EVAL_GEN) — 실패 행 되살리기 ──────────────────────────────────────

test('출제 펜싱: 되살린 뒤(A=stale FAILED, B=RUNNING) A 의 늦은 성공은 버려지고 문항도 넣지 않는다 — B 는 정상 저장', async () => {
  const w = world([job('EVAL_GEN', 'jA', 'FAILED', 400), job('EVAL_GEN', 'jB', 'RUNNING', 10)], 'GENERATING')
  await assert.rejects(saveGeneratedEvaluation(w.tx, U, claim('jA'), gen), EvaluationJobSuperseded)
  assert.deepEqual([w.ev.status, w.items.length, w.job('jB').status], ['GENERATING', 0, 'RUNNING'])
  assert.deepEqual(w.calls.slice(0, 2), ['lockUser', 'job.find'], '사용자 행 잠금 뒤에 세대를 확인한다')
  await saveGeneratedEvaluation(w.tx, U, claim('jB'), gen)
  assert.deepEqual([w.ev.status, w.items.length, w.job('jB').status], ['READY', 1, 'DONE'])
})

test('출제 펜싱: A 의 늦은 실패는 B 가 만들고 있는 평가를 FAILED 로 닫지 않는다', async () => {
  const w = world([job('EVAL_GEN', 'jA', 'FAILED', 400), job('EVAL_GEN', 'jB', 'RUNNING', 10)], 'GENERATING')
  await assert.rejects(failGeneratedEvaluation(w.tx, U, claim('jA'), 'ENGINE_ERROR'), EvaluationJobSuperseded)
  assert.deepEqual([w.ev.status, w.ev.error, w.job('jB').status], ['GENERATING', null, 'RUNNING'])
})

test('출제 펜싱: 자기 잡이 RUNNING 이어도 더 새 잡이 있으면 버린다(세대 역전), 현재 세대면 성공 READY+DONE·실패 FAILED+잡 FAILED', async () => {
  const inv = world([job('EVAL_GEN', 'jA', 'RUNNING', 400), job('EVAL_GEN', 'jB', 'RUNNING', 10)], 'GENERATING')
  await assert.rejects(saveGeneratedEvaluation(inv.tx, U, claim('jA'), gen), EvaluationJobSuperseded)
  await assert.rejects(failGeneratedEvaluation(inv.tx, U, claim('jA'), 'TIMEOUT'), EvaluationJobSuperseded)
  assert.equal(inv.ev.status, 'GENERATING')

  const ok = world([job('EVAL_GEN', 'jA', 'RUNNING', 30)], 'GENERATING')
  await saveGeneratedEvaluation(ok.tx, U, claim('jA'), gen)
  assert.deepEqual([ok.ev.status, ok.job('jA').status], ['READY', 'DONE'])
  const bad = world([job('EVAL_GEN', 'jA', 'RUNNING', 30)], 'GENERATING')
  await failGeneratedEvaluation(bad.tx, U, claim('jA'), 'JSON_SCHEMA')
  assert.deepEqual([bad.ev.status, bad.ev.error, bad.job('jA').status, bad.job('jA').error], ['FAILED', 'JSON_SCHEMA', 'FAILED', 'JSON_SCHEMA'])
})

test('출제 펜싱: 확인 뒤 DONE 전이 전에 잠금 밖 stale 정리가 끼어들면 Superseded(트랜잭션 되돌림)', async () => {
  const w = world([job('EVAL_GEN', 'jA', 'RUNNING', 30)], 'GENERATING')
  w.onBeforeJobUpdate(() => {
    w.job('jA').status = 'FAILED'
  })
  await assert.rejects(saveGeneratedEvaluation(w.tx, U, claim('jA'), gen), EvaluationJobSuperseded)
})

// ── 채점(EVAL_GRADE) — 다시 채점 ───────────────────────────────────────────

test('채점 펜싱: 다시 채점 뒤(A=stale FAILED, B=RUNNING) A 의 늦은 성공은 DONE·StudyLog·스냅샷을 쓰지 않는다 — B 가 저장하고 잡은 SAVED(DONE 은 레벨 제안 뒤)', async () => {
  const w = world([job('EVAL_GRADE', 'jA', 'FAILED', 400), job('EVAL_GRADE', 'jB', 'RUNNING', 10)], 'GRADING')
  await assert.rejects(saveGradedEvaluation(w.tx, U, claim('jA'), graded('A')), EvaluationJobSuperseded)
  assert.deepEqual([w.ev.status, w.logs.length, w.snaps.length, w.job('jB').status], ['GRADING', 0, 0, 'RUNNING'])
  assert.deepEqual(w.calls.slice(0, 2), ['lockUser', 'job.find'])
  await saveGradedEvaluation(w.tx, U, claim('jB'), graded('B'))
  assert.deepEqual([w.ev.status, w.ev.totalScore, w.ev.studyLogId, w.logs.length, w.snaps.map((s) => `${s.kind}:${s.periodKey}`), w.job('jB').status, w.job('jB').stage], ['DONE', 80, 'sl1', 1, [`EVALUATION:${E}`], 'RUNNING', 'SAVED'])
})

test('채점 펜싱: A 의 늦은 실패는 B 가 채점 중인 평가에 error 를 남기지 않는다 · 현재 세대 실패는 GRADING 잔류 + error + 잡 FAILED', async () => {
  const w = world([job('EVAL_GRADE', 'jA', 'FAILED', 400), job('EVAL_GRADE', 'jB', 'RUNNING', 10)], 'GRADING')
  await assert.rejects(failGradedEvaluation(w.tx, U, claim('jA'), 'ENGINE_TIMEOUT'), EvaluationJobSuperseded)
  assert.deepEqual([w.ev.status, w.ev.error, w.job('jB').status], ['GRADING', null, 'RUNNING'])

  const cur = world([job('EVAL_GRADE', 'jA', 'RUNNING', 30)], 'GRADING')
  await failGradedEvaluation(cur.tx, U, claim('jA'), 'ENGINE_TIMEOUT')
  assert.deepEqual([cur.ev.status, cur.ev.error, cur.job('jA').status], ['GRADING', 'ENGINE_TIMEOUT', 'FAILED'])
})

test('채점 펜싱: 저장 끝에서 잡이 잠금 밖 stale 정리로 닫혔으면 Superseded(기록 되돌림) · 평가가 GRADING 이 아니면 409 STATE_CHANGED', async () => {
  const w = world([job('EVAL_GRADE', 'jA', 'RUNNING', 30)], 'GRADING')
  w.onBeforeJobUpdate(() => {
    w.job('jA').status = 'FAILED'
  })
  await assert.rejects(saveGradedEvaluation(w.tx, U, claim('jA'), graded('A')), EvaluationJobSuperseded)

  const done = world([job('EVAL_GRADE', 'jA', 'RUNNING', 30)], 'DONE')
  await assert.rejects(saveGradedEvaluation(done.tx, U, claim('jA'), graded('A')), (e: unknown) => (e as { details?: { reason?: string } }).details?.reason === 'STATE_CHANGED')
  assert.equal(done.logs.length, 0)
})
