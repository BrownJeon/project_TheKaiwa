/**
 * task-045 qa-045-a1 공용 도우미 — QA 계정(@thekaiwa.test)만 만지고, 시드 행은 읽기만 한다.
 * 실행: 스냅샷 `~/.node-local/thekaiwa-qa045a` 에서 `node --env-file=.env --import tsx tests/live/p3-qa/<file>.ts` (127.0.0.1:3045 dev 서버, LLM 불가).
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

export const BASE = process.env.QA_BASE ?? 'http://127.0.0.1:3045'
export const prisma = new PrismaClient()

export function cookieOf(path: string): string {
  return readFileSync(path, 'utf8').trim()
}

export interface Res {
  status: number
  body: any
  headers: Headers
}
export async function api(cookie: string | null, method: string, path: string, body?: unknown, rawBody?: string): Promise<Res> {
  const headers: Record<string, string> = {}
  if (cookie) headers.Cookie = cookie
  let payload: string | undefined
  if (rawBody !== undefined) {
    payload = rawBody
    headers['Content-Type'] = 'application/json'
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  const r = await fetch(BASE + path, { method, headers, body: payload })
  const text = await r.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { _raw: text.slice(0, 300) }
  }
  return { status: r.status, body: json, headers: r.headers }
}

export const data = (r: Res) => r.body?.data
export const code = (r: Res) => r.body?.data?.code ?? r.body?.code ?? null
export const details = (r: Res) => r.body?.data?.details ?? r.body?.details ?? null

export async function qaUser(email: string) {
  if (!email.endsWith('@thekaiwa.test')) throw new Error('QA 계정만')
  const u = await prisma.user.findUnique({ where: { email } })
  if (!u) throw new Error('QA 계정 없음: ' + email)
  return u
}
export const QA3 = 'qa-bot3@thekaiwa.test'
export const QA2 = 'qa-bot2@thekaiwa.test'

/** 시드 주제(5)·시드 상황(10) 내용 해시 — 시작·끝 단언용. 읽기 전용. */
export async function seedHash() {
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { chunks: { orderBy: { id: 'asc' } } } })
  const scenarios = await prisma.scenario.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { topics: { orderBy: { topicId: 'asc' } } } })
  const norm = JSON.stringify({ topics, scenarios }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  return {
    topics: topics.length,
    chunks: topics.reduce((n, t) => n + t.chunks.length, 0),
    scenarios: scenarios.length,
    links: scenarios.reduce((n, s) => n + s.topics.length, 0),
    sha: createHash('sha256').update(norm).digest('hex').slice(0, 16),
  }
}

/** QA 계정의 task-045 행 정리 — userId 는 반드시 QA 계정. (override → 챌린지 → 상황 → 주제 순) */
export async function cleanupQa(userId: string, opts: { keepChallenges?: boolean } = {}) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!u || !u.email.endsWith('@thekaiwa.test')) throw new Error('cleanup: QA 계정이 아님')
  const o = await prisma.userSeedOverride.deleteMany({ where: { userId } })
  const ch = opts.keepChallenges ? { count: 0 } : await prisma.challenge.deleteMany({ where: { userId } })
  const sc = await prisma.scenario.deleteMany({ where: { userId } })
  const tp = await prisma.conversationTopic.deleteMany({ where: { userId } })
  return { overrides: o.count, challenges: ch.count, scenarios: sc.count, topics: tp.count }
}

export async function qaRowCounts(userId: string) {
  return {
    overrides: await prisma.userSeedOverride.count({ where: { userId } }),
    topics: await prisma.conversationTopic.count({ where: { userId } }),
    scenarios: await prisma.scenario.count({ where: { userId } }),
    challenges: await prisma.challenge.count({ where: { userId } }),
    chats: await prisma.chat.count({ where: { userId } }),
    lessons: await prisma.lesson.count({ where: { userId } }),
    evaluations: await prisma.evaluation.count({ where: { userId } }),
    vocabSessions: await prisma.vocabSession.count({ where: { userId } }),
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
const rows: string[] = []
export function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++
  else fail++
  const line = `${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`
  rows.push(line)
  console.log(line)
}
export function summary(label: string) {
  console.log(`== ${label}: ${pass}/${pass + fail} PASS, FAIL ${fail}`)
  return { pass, fail }
}
