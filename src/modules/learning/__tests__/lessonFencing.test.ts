/**
 * Codex C2-1(task-010) — 생성 세대 펜싱. 옛 잡 A 가 stale 로 닫히고 같은 레슨이 새 잡 B 로 되살아난 뒤 A 가 늦게 성공·실패해도
 * B 의 레슨을 건드리지 않는다. 가짜 tx(사용자 잠금·AiJob·Lesson 최소 메서드)로 판정만 본다 — 실제 DB 경합은 `tests/live/task010-c2-race.ts`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import { failGeneratedLesson, LessonGenerationSuperseded, saveGeneratedLesson, type LessonGenClaim } from '../lessons/generate'

const U = 'cuser00000000000000000001'
const L = 'clesson000000000000000001'

interface Job {
  id: string
  userId: string
  kind: 'LESSON_GEN'
  refId: string
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
  createdAt: Date
  error: string | null
}
interface LessonRow {
  id: string
  userId: string
  status: string
  content: unknown
  error: string | null
}

function world(jobs: Job[], lessonStatus = 'GENERATING') {
  const lesson: LessonRow = { id: L, userId: U, status: lessonStatus, content: null, error: null }
  const calls: string[] = []
  const active = (s: Job['status']) => s === 'QUEUED' || s === 'RUNNING'
  /** 테스트가 "확인 뒤·DONE 전이 전" 끼어드는 잠금 밖 stale 정리를 흉내 낼 때. */
  let beforeJobUpdate: (() => void) | null = null
  const tx = {
    $queryRaw: async () => {
      calls.push('lockUser')
      return [{ id: U }]
    },
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
        calls.push(`job.${data.status}`)
        Object.assign(j, { status: data.status, error: data.error ?? null })
        return { count: 1 }
      },
    },
    lesson: {
      updateMany: async ({ where, data }: { where: { id: string; userId: string; status: string }; data: Partial<LessonRow> }) => {
        if (lesson.id !== where.id || lesson.userId !== where.userId || lesson.status !== where.status) return { count: 0 }
        calls.push(`lesson.${data.status}`)
        Object.assign(lesson, data)
        return { count: 1 }
      },
    },
  }
  return {
    tx: tx as unknown as Tx,
    lesson,
    calls,
    job: (id: string) => jobs.find((j) => j.id === id)!,
    onBeforeJobUpdate: (fn: () => void) => {
      beforeJobUpdate = fn
    },
  }
}

const job = (id: string, status: Job['status'], ageSec: number): Job => ({ id, userId: U, kind: 'LESSON_GEN', refId: L, status, createdAt: new Date(Date.UTC(2026, 8, 28, 3, 0, 0) - ageSec * 1000), error: null })
const claim = (jobId: string): LessonGenClaim => ({ lessonId: L, jobId, traceId: 't' })
const fields = (title: string) => ({ title, content: { title } as unknown as Prisma.InputJsonValue, model: 'm', promptVersion: 'lesson@v3' })

test('펜싱: 되살린 뒤(A=stale FAILED, B=RUNNING) A 의 늦은 성공은 버려지고 B 의 레슨을 덮지 않는다 — B 는 정상 저장', async () => {
  const w = world([job('jA', 'FAILED', 400), job('jB', 'RUNNING', 10)])
  await assert.rejects(saveGeneratedLesson(w.tx, U, claim('jA'), fields('A 결과')), LessonGenerationSuperseded)
  assert.deepEqual([w.lesson.status, w.lesson.content], ['GENERATING', null], 'A 는 레슨을 쓰지 않는다')
  assert.equal(w.job('jB').status, 'RUNNING')
  assert.deepEqual(w.calls.slice(0, 2), ['lockUser', 'job.find'], '사용자 행 잠금 뒤에 세대를 확인한다')

  await saveGeneratedLesson(w.tx, U, claim('jB'), fields('B 결과'))
  assert.deepEqual([w.lesson.status, (w.lesson.content as { title: string }).title, w.job('jB').status], ['READY', 'B 결과', 'DONE'])
})

test('펜싱: A 의 늦은 실패는 B 가 만들고 있는 레슨을 FAILED 로 바꾸지 않는다', async () => {
  const w = world([job('jA', 'FAILED', 400), job('jB', 'RUNNING', 10)])
  await assert.rejects(failGeneratedLesson(w.tx, U, claim('jA'), 'ENGINE_ERROR'), LessonGenerationSuperseded)
  assert.deepEqual([w.lesson.status, w.lesson.error, w.job('jB').status], ['GENERATING', null, 'RUNNING'])
})

test('펜싱: 자기 잡이 아직 RUNNING 이어도 같은 레슨의 더 새 잡이 있으면 버린다(세대 역전 방어)', async () => {
  const w = world([job('jA', 'RUNNING', 400), job('jB', 'RUNNING', 10)])
  await assert.rejects(saveGeneratedLesson(w.tx, U, claim('jA'), fields('A')), LessonGenerationSuperseded)
  await assert.rejects(failGeneratedLesson(w.tx, U, claim('jA'), 'TIMEOUT'), LessonGenerationSuperseded)
  assert.equal(w.lesson.status, 'GENERATING')
})

test('펜싱: 현재 세대면 그대로 — 성공은 READY + 잡 DONE, 실패는 FAILED(코드만) + 잡 FAILED', async () => {
  const ok = world([job('jA', 'RUNNING', 30)])
  await saveGeneratedLesson(ok.tx, U, claim('jA'), fields('A'))
  assert.deepEqual([ok.lesson.status, ok.job('jA').status], ['READY', 'DONE'])

  const bad = world([job('jA', 'RUNNING', 30)])
  await failGeneratedLesson(bad.tx, U, claim('jA'), 'JSON_SCHEMA')
  assert.deepEqual([bad.lesson.status, bad.lesson.error, bad.job('jA').status, bad.job('jA').error], ['FAILED', 'JSON_SCHEMA', 'FAILED', 'JSON_SCHEMA'])
})

test('펜싱: 확인 뒤 DONE 전이 전에 잠금 밖 stale 정리(#55 조회 등)가 끼어들면 Superseded 로 트랜잭션을 되돌린다', async () => {
  const w = world([job('jA', 'RUNNING', 30)])
  w.onBeforeJobUpdate(() => {
    w.job('jA').status = 'FAILED'
  })
  await assert.rejects(saveGeneratedLesson(w.tx, U, claim('jA'), fields('A')), LessonGenerationSuperseded)
})

test('펜싱: 세대는 맞아도 레슨이 GENERATING 이 아니면(이미 닫힘) 기존대로 409 STATE_CHANGED', async () => {
  const w = world([job('jA', 'RUNNING', 30)], 'FAILED')
  await assert.rejects(saveGeneratedLesson(w.tx, U, claim('jA'), fields('A')), (e: unknown) => (e as { details?: { reason?: string } }).details?.reason === 'STATE_CHANGED')
  assert.equal(w.job('jA').status, 'RUNNING', '잡 전이 전에 멈춘다(실제 트랜잭션은 되돌려짐)')
})
