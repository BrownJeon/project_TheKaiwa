/**
 * qa-p2a — task-041 high_risk_areas 1·2 (REV-126 §7) — **실제 MariaDB 경합**, QA 계정 3, LLM·TTS 0.
 *
 *  R0. 순차: 한 챌린지에 세트 2개(각 2장 답)를 차례로 끝내기 → 첫째 goalMet false·둘째 합산 4장으로 goalMet true·goalMetNow true.
 *  R6. 같은 세트를 동시에 3번 끝내기 → 전부 200·스냅샷 1(이중 제출).
 *  R1. `POST /challenges/:id/end`(#159) × `POST /vocab/sessions/:id/finish`(#51) 를 거의 동시에(오프셋 −150~+150ms, 매 회 새 챌린지·새 세트),
 *      끝난 뒤 읽기 전용 비교: 챌린지 `result.wordSets·wordsCorrect` == 그 세트의 `StatsSnapshot(VOCAB_SESSION)` 이 `createdAt < endedAt` 인가(불일치 0).
 *      같은 회차에서 스냅샷·`endedAt` 이 **이 요청 시각 구간 안**인지(앱 시계 전제 — DB 기본값이 아니라 앱 시각이 쓰이는지) 도 본다.
 *      #51 응답의 `challenge` 가 null 인데 최종 결과엔 반영된 경우(Codex C2 지적 1 — 알려진 수용)는 건수만 센다.
 *  R2. 동시 #159 × 3 → 전부 200·응답 같음·행 ENDED·activeKey null.
 *  R3. 마감이 지난 ACTIVE 행(DB 로 심음) + 동시 #158 × 3 → 전부 200·COMPLETED 한 번·`endedAt` = endDate+1 00:00 KST·activeKey null.
 *  R4. 마감이 지난 ACTIVE 행 + 동시 [#158, #156] → #156 200(만료 전이가 먼저 — 409 아님)·옛 행 COMPLETED·ACTIVE 행 정확히 1.
 *  R5. 마감이 지난 ACTIVE 행 + 동시 [#159, #158] → #159 409 NOT_ACTIVE(계약 challenge.md:926)·#158 200·최종 COMPLETED·result 있음·activeKey null.
 *  끝: 이 실행이 만든 행(챌린지·세트·답·기록·스냅샷·관측·반복 항목·잡)을 기준선 차집합으로 지우고, 기존 DAILY·반복 항목은 시작 값으로 되돌린다. 마지막에 AiJob 증가 0 확인.
 *
 * 실행(미러, dev 서버 127.0.0.1·APP_ENV=LOCAL, 00:05~23:50 KST — 자정 전후 금지):
 *   QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-qa3
 *   BASE=http://127.0.0.1:3031 [ROUNDS=20] node --env-file=.env --import tsx tests/live/p2a-qa/challenge-race.ts /tmp/c-qa3
 * 계정 3 은 042·043·044 QA 와 같은 계정 — 동시에 돌리지 않는다(시작 때 진행 중 챌린지·세트가 있으면 중단).
 */
import { readFileSync } from 'node:fs'
import { Prisma, PrismaClient, type RepetitionItem } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3031'
const baseUrl = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(BASE)
if (!baseUrl || Number(baseUrl[2]) === 3010) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const c3file = process.argv[2]
if (!c3file) throw new Error('사용: challenge-race.ts <QA3 쿠키 파일>')
const COOKIE3 = readFileSync(c3file, 'utf8').trim()
if (!COOKIE3) throw new Error('QA 쿠키 파일이 비어 있다')
const ROUNDS = Math.max(4, Number(process.env.ROUNDS ?? 20))
const KST = 9 * 3600_000
const kstNow = () => new Date(Date.now() + KST)
const hhmm = kstNow().toISOString().slice(11, 16)
if (hhmm < '00:05' || hhmm > '23:50') throw new Error(`KST ${hhmm} — 00:05~23:50 에 실행한다`)

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (m: string) => console.log(`INFO ${m}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Json = Record<string, unknown>
interface Res {
  status: number
  data: Json & { code?: string; details?: Json }
  text: string
  ms: number
}
async function api(method: string, path: string, body?: unknown): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: COOKIE3 }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t0
  let data: Res['data'] = {}
  try {
    data = (JSON.parse(text) as { data: Res['data'] }).data ?? {}
  } catch {
    data = {}
  }
  return { status: r.status, data, text, ms }
}
const pct = (xs: number[], q: number): number => {
  const a = [...xs].sort((x, y) => x - y)
  return a.length ? Math.round(a[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)]) : NaN
}
const delayed = <T>(ms: number, f: () => Promise<T>): Promise<T> => sleep(ms).then(f)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const todayKst = () => kstNow().toISOString().slice(0, 10)
const dbDate = (d: string) => new Date(`${d}T00:00:00.000Z`)

interface Baseline {
  sessions: Set<string>
  logs: Set<string>
  snaps: Set<string>
  obs: Set<string>
  jobs: Set<string>
  challenges: Set<string>
  reps: RepetitionItem[]
  daily: { id: string; data: Prisma.JsonValue }[]
}
async function baseline(userId: string): Promise<Baseline> {
  const ids = async (rows: Promise<{ id: string }[]>) => new Set((await rows).map((r) => r.id))
  return {
    sessions: await ids(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })),
    logs: await ids(prisma.studyLog.findMany({ where: { userId }, select: { id: true } })),
    snaps: await ids(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })),
    obs: await ids(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } })),
    jobs: await ids(prisma.aiJob.findMany({ where: { userId }, select: { id: true } })),
    challenges: await ids(prisma.challenge.findMany({ where: { userId }, select: { id: true } })),
    reps: await prisma.repetitionItem.findMany({ where: { userId } }),
    daily: await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, data: true } }),
  }
}
async function restore(userId: string, b: Baseline): Promise<Json> {
  const fresh = async (rows: Promise<{ id: string }[]>, old: Set<string>) => (await rows).map((r) => r.id).filter((id) => !old.has(id))
  const ch = await fresh(prisma.challenge.findMany({ where: { userId }, select: { id: true } }), b.challenges)
  if (ch.length) await prisma.challenge.deleteMany({ where: { id: { in: ch } } })
  const obs = await fresh(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } }), b.obs)
  if (obs.length) await prisma.learningObservation.deleteMany({ where: { id: { in: obs } } })
  const logs = await fresh(prisma.studyLog.findMany({ where: { userId }, select: { id: true } }), b.logs)
  if (logs.length) await prisma.studyLog.deleteMany({ where: { id: { in: logs } } })
  const jobs = await fresh(prisma.aiJob.findMany({ where: { userId }, select: { id: true } }), b.jobs)
  if (jobs.length) await prisma.aiJob.deleteMany({ where: { id: { in: jobs } } })
  const sessions = await fresh(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } }), b.sessions)
  if (sessions.length) {
    await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sessions } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: sessions } } })
  }
  const snaps = await fresh(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } }), b.snaps)
  if (snaps.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: snaps } } })
  for (const row of b.daily) await prisma.statsSnapshot.update({ where: { id: row.id }, data: { data: (row.data ?? {}) as Prisma.InputJsonValue } })
  const oldReps = new Set(b.reps.map((r) => r.id))
  const reps = (await prisma.repetitionItem.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id).filter((id) => !oldReps.has(id))
  if (reps.length) await prisma.repetitionItem.deleteMany({ where: { id: { in: reps } } })
  for (const r of b.reps) {
    const { id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = r
    void _u
    void _c
    void _up
    await prisma.repetitionItem.updateMany({ where: { id }, data: rest })
  }
  return { challenges: ch.length, observations: obs.length, studyLogs: logs.length, aiJobs: jobs.length, sessions: sessions.length, snapshots: snaps.length, repetitionItems: reps.length }
}

async function answer(sessionId: string, order: number): Promise<Res> {
  const a = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId, order } }, select: { meaningSnap: true, choices: true } })
  const choices = Array.isArray(a.choices) ? (a.choices as string[]) : []
  if (!choices.length) return api('POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, selfResult: 'CORRECT' })
  return api('POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, chosenText: a.meaningSnap })
}

const GOAL_WORDS = { lesson: false, words: true, wordCount: 5 }

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다')
  const userId = user.id
  const busyCh = await prisma.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
  const busyVs = await prisma.vocabSession.findFirst({ where: { userId, status: 'IN_PROGRESS' }, select: { id: true } })
  if (busyCh || busyVs) throw new Error('계정 3 에 진행 중 챌린지·풀던 세트가 있다 — 다른 레인이 쓰는 중이면 기다린다')
  const topic = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, level: 'N5', chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true, _count: { select: { chunks: true } } } })
  if (topic._count.chunks < 5) throw new Error('조각 5개 이상 시드 주제가 없다')
  const b = await baseline(userId)
  const jobsBefore = await prisma.aiJob.count({ where: { userId } })
  const today = todayKst()

  try {
    // ── R0 순차: 두 세트 합산·goalMetNow(확인 표 11a) ──
    {
      const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: GOAL_WORDS })
      const mk = async (n: number): Promise<{ fin: Res; sid: string }> => {
        const s1 = await api('POST', '/api/v1/vocab/sessions', { topicId: topic.id, count: 5, mode: 'CHOICE', generate: false })
        const sid1 = String((s1.data.session as Json | undefined)?.id ?? '')
        for (let o = 0; o < n; o++) await answer(sid1, o)
        return { fin: await api('POST', `/api/v1/vocab/sessions/${sid1}/finish`), sid: sid1 }
      }
      const a = await mk(2)
      const ca = a.fin.data.challenge as Json | null
      const b2 = await mk(2)
      const cb = b2.fin.data.challenge as Json | null
      const t158 = await api('GET', '/api/v1/challenges/today')
      const tasks = (((t158.data.today as Json | undefined)?.tasks ?? []) as Json[]).map((t) => `${String(t.kind)}:${String(t.state)}:${String(t.answered ?? '')}/${String(t.sets ?? '')}`).join(' ')
      check('R0a 첫 세트(2장) → challenge 칸 있음·goalMet false·goalMetNow false·words 2/4', c.status === 200 && a.fin.status === 200 && !!ca && ca.goalMet === false && ca.goalMetNow === false && JSON.stringify(ca.words) === JSON.stringify({ answered: 2, need: 4 }), JSON.stringify(ca))
      check('R0b 둘째 세트(2장) → 합산 4장 = 달성·goalMetNow true(이 세트가 채움)·words 4/4', b2.fin.status === 200 && !!cb && cb.goalMet === true && cb.goalMetNow === true && JSON.stringify(cb.words) === JSON.stringify({ answered: 4, need: 4 }), JSON.stringify(cb))
      info(`R0 #158 오늘 할 일 — ${tasks}`)
      await restore(userId, b)
    }
    // ── R6 같은 세트를 동시에 3번 끝내기(이중 제출) ──
    {
      const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: GOAL_WORDS })
      const s1 = await api('POST', '/api/v1/vocab/sessions', { topicId: topic.id, count: 5, mode: 'CHOICE', generate: false })
      const sid1 = String((s1.data.session as Json | undefined)?.id ?? '')
      for (let o = 0; o < 4; o++) await answer(sid1, o)
      const rs = await Promise.all([1, 2, 3].map(() => api('POST', `/api/v1/vocab/sessions/${sid1}/finish`)))
      const snaps = await prisma.statsSnapshot.count({ where: { userId, kind: 'VOCAB_SESSION', periodKey: sid1 } })
      const metNow = rs.filter((r) => (r.data.challenge as Json | null)?.goalMetNow === true).length
      check('R6 같은 세트 동시 #51 × 3 — 전부 200·스냅샷 1', c.status === 200 && rs.every((r) => r.status === 200) && snaps === 1, `${rs.map((r) => r.status).join('/')} 스냅샷 ${snaps}`)
      info(`R6 goalMetNow:true 응답 ${metNow}/3 (같은 세트라 서버는 응답마다 같은 값을 돌려준다 — 토스트 1번은 화면에서 확인)`)
      await restore(userId, b)
    }

    // ── R1 ──
    const OFFS: [number, number][] = [[0, 0], [0, 2], [2, 0], [0, 5], [5, 0], [0, 10], [10, 0], [0, 20], [20, 0], [0, 40], [40, 0], [0, 80], [80, 0], [0, 150], [150, 0], [0, 0], [1, 0], [0, 1], [3, 0], [0, 3]]
    let bad = 0
    let nIn = 0
    let nOut = 0
    let nullButCounted = 0
    let respButExcluded = 0
    let clockBad = 0
    let httpBad = 0
    const margin: number[] = []
    const finMs: number[] = []
    const endMs: number[] = []
    const createMs: number[] = []
    const sessMs: number[] = []
    for (let i = 0; i < ROUNDS; i++) {
      const [dFin, dEnd] = OFFS[i % OFFS.length]
      const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: GOAL_WORDS })
      const cid = String(c.data.id ?? '')
      const s = await api('POST', '/api/v1/vocab/sessions', { topicId: topic.id, count: 5, mode: 'CHOICE', generate: false })
      const sid = String((s.data.session as Json | undefined)?.id ?? '')
      if (c.status !== 200 || s.status !== 200 || !cid || !sid) {
        check(`R1 회차 ${i + 1} 준비`, false, `챌린지 ${c.status} 세트 ${s.status}`)
        bad++
        await restore(userId, b)
        continue
      }
      createMs.push(c.ms)
      sessMs.push(s.ms)
      for (let o = 0; o < 4; o++) await answer(sid, o)
      const t0 = Date.now()
      const [fin, end] = await Promise.all([delayed(dFin, () => api('POST', `/api/v1/vocab/sessions/${sid}/finish`)), delayed(dEnd, () => api('POST', `/api/v1/challenges/${cid}/end`, {}))])
      const t1 = Date.now()
      finMs.push(fin.ms)
      endMs.push(end.ms)
      const row = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { status: true, endedAt: true, activeKey: true, result: true } })
      const snap = await prisma.statsSnapshot.findFirst({ where: { userId, kind: 'VOCAB_SESSION', periodKey: sid }, select: { createdAt: true } })
      const res = (row.result ?? {}) as Json
      const counted = !!snap && !!row.endedAt && snap.createdAt < row.endedAt
      const expectSets = counted ? 1 : 0
      const expectCorrect = counted ? 4 : 0
      const marginMs = snap && row.endedAt ? row.endedAt.getTime() - snap.createdAt.getTime() : NaN
      if (Number.isFinite(marginMs)) margin.push(marginMs)
      const ok =
        fin.status === 200 && end.status === 200 && row.status === 'ENDED' && row.activeKey === null && !!snap &&
        res.wordSets === expectSets && res.wordsCorrect === expectCorrect
      if (fin.status !== 200 || end.status !== 200) httpBad++
      const clockOk = !!snap && !!row.endedAt && snap.createdAt.getTime() >= t0 - 50 + Math.min(dFin, 0) && snap.createdAt.getTime() <= t1 + 50 && row.endedAt.getTime() >= t0 - 50 && row.endedAt.getTime() <= t1 + 50
      if (!clockOk) clockBad++
      if (counted) nIn++
      else nOut++
      const respChallenge = (fin.data as Json).challenge
      if (counted && respChallenge === null) nullButCounted++
      if (!counted && respChallenge !== null && respChallenge !== undefined) respButExcluded++
      if (!ok) {
        bad++
        console.log(`  ! 회차 ${i + 1}(finish+${dFin}ms/end+${dEnd}ms) fin ${fin.status} end ${end.status} status ${row.status} wordSets ${String(res.wordSets)}(기대 ${expectSets}) wordsCorrect ${String(res.wordsCorrect)}(기대 ${expectCorrect}) snap<endedAt ${counted} margin ${marginMs}ms`)
      }
      await restore(userId, b)
    }
    check(`R1 #159 × #51 동시 ${ROUNDS}회 — 결과 wordSets/wordsCorrect = 스냅샷 createdAt<endedAt 판정(불일치 0)`, bad === 0, `불일치 ${bad} · 반영 ${nIn} / 제외 ${nOut}(양쪽 다 나와야 경합을 실제로 탄 것)`)
    check('R1b 두 요청 상태 전부 200', httpBad === 0, `비정상 ${httpBad}`)
    check('R1c 스냅샷 createdAt·endedAt 이 이 요청 구간(±50ms) 안 — 앱 시계 전제', clockBad === 0, `벗어남 ${clockBad}회`)
    info(`R1 호출 소요(ms) — #156 p50 ${pct(createMs, 0.5)}/p95 ${pct(createMs, 0.95)} · #47 p50 ${pct(sessMs, 0.5)}/p95 ${pct(sessMs, 0.95)} · #51(동시) p50 ${pct(finMs, 0.5)}/p95 ${pct(finMs, 0.95)}/max ${Math.round(Math.max(...finMs))} · #159(동시) p50 ${pct(endMs, 0.5)}/p95 ${pct(endMs, 0.95)}/max ${Math.round(Math.max(...endMs))}`)
    info(`R1 #51 응답 challenge:null 인데 결과엔 반영(Codex C2 지적 1) ${nullButCounted}회 · #51 응답엔 진행이 있었는데 결과에서 제외 ${respButExcluded}회 · endedAt−스냅샷 createdAt 여유 ms min ${Math.min(...margin)} / max ${Math.max(...margin)}`)

    // ── R2 ──
    {
      const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
      const cid = String(c.data.id ?? '')
      const rs = await Promise.all([1, 2, 3].map(() => api('POST', `/api/v1/challenges/${cid}/end`, {})))
      const row = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { status: true, activeKey: true, result: true, endedAt: true } })
      const same = rs.every((r) => JSON.stringify(r.data) === JSON.stringify(rs[0].data))
      check('R2 동시 #159 × 3 — 전부 200·응답 같음·ENDED·activeKey null', c.status === 200 && rs.every((r) => r.status === 200) && same && row.status === 'ENDED' && row.activeKey === null && !!row.result, rs.map((r) => r.status).join('/'))
      await restore(userId, b)
    }

    // ── R3~R5: 마감이 지난 ACTIVE 행 ──
    const seedExpired = async (): Promise<string> => {
      const start = addDays(today, -9)
      const row = await prisma.challenge.create({
        data: {
          userId, title: `t-p2a ${topic.title}`, topicId: topic.id, topicTitleSnap: topic.title, level: 'N5', lengthDays: 7,
          startDate: dbDate(start), endDate: dbDate(addDays(start, 6)),
          dailyGoal: { lesson: true, words: false, wordCount: null, wordsMinAnswered: null, countSkipped: false, ruleVersion: 1 },
          status: 'ACTIVE', activeKey: userId, createdAt: new Date(Date.parse(`${start}T08:00:00+09:00`)),
        },
        select: { id: true },
      })
      return row.id
    }
    const expectedEnd = new Date(Date.parse(`${addDays(addDays(today, -9), 6)}T00:00:00+09:00`) + 86_400_000)
    {
      const id = await seedExpired()
      const rs = await Promise.all([1, 2, 3].map(() => api('GET', '/api/v1/challenges/today')))
      const row = await prisma.challenge.findUniqueOrThrow({ where: { id }, select: { status: true, activeKey: true, endedAt: true, result: true } })
      const activeN = await prisma.challenge.count({ where: { userId, status: 'ACTIVE' } })
      check('R3 만료 행 + 동시 #158 × 3 — 전부 200·COMPLETED·endedAt = endDate+1 00:00 KST·activeKey null', rs.every((r) => r.status === 200) && row.status === 'COMPLETED' && row.activeKey === null && row.endedAt?.getTime() === expectedEnd.getTime() && !!row.result && activeN === 0, `${rs.map((r) => r.status).join('/')} ${row.status} ${row.endedAt?.toISOString()} 기대 ${expectedEnd.toISOString()}`)
      await restore(userId, b)
    }
    {
      const id = await seedExpired()
      const [t, cr] = await Promise.all([api('GET', '/api/v1/challenges/today'), api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TOMORROW', dailyGoal: { lesson: true, words: false } })])
      const row = await prisma.challenge.findUniqueOrThrow({ where: { id }, select: { status: true, activeKey: true } })
      const activeN = await prisma.challenge.count({ where: { userId, status: 'ACTIVE' } })
      check('R4 만료 행 + 동시 [#158, #156] — #156 200(409 아님)·옛 행 COMPLETED·ACTIVE 정확히 1', t.status === 200 && cr.status === 200 && row.status === 'COMPLETED' && row.activeKey === null && activeN === 1, `158:${t.status} 156:${cr.status}${cr.status === 409 ? ` ${String(cr.data.details?.reason)}` : ''} 옛행 ${row.status} ACTIVE ${activeN}`)
      await restore(userId, b)
    }
    {
      const id = await seedExpired()
      const [e, t] = await Promise.all([api('POST', `/api/v1/challenges/${id}/end`, {}), api('GET', '/api/v1/challenges/today')])
      const row = await prisma.challenge.findUniqueOrThrow({ where: { id }, select: { status: true, activeKey: true, result: true } })
      // 계약(challenge.md:926): 기간이 지나 COMPLETED 로 전이된 행에 #159 는 409 NOT_ACTIVE.
      check('R5 만료 행 + 동시 [#159, #158] — #159 409 NOT_ACTIVE(COMPLETED)·#158 200·최종 COMPLETED·result·activeKey null', e.status === 409 && e.data.details?.reason === 'NOT_ACTIVE' && e.data.details?.status === 'COMPLETED' && t.status === 200 && row.status === 'COMPLETED' && !!row.result && row.activeKey === null, `159:${e.status} ${String(e.data.details?.reason)} 158:${t.status} 최종 ${row.status}`)
      await restore(userId, b)
    }
  } finally {
    const r = await restore(userId, b)
    info(`정리: ${JSON.stringify(r)}`)
    const jobsAfter = await prisma.aiJob.count({ where: { userId } })
    check('Z AiJob 증가 0(LLM 0)', jobsAfter === jobsBefore, `${jobsBefore}→${jobsAfter}`)
  }
}

main()
  .catch((e) => check('RUN', false, e instanceof Error ? e.message : String(e)))
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - fail}/${results.length} PASS`)
    process.exit(fail ? 1 : 0)
  })
