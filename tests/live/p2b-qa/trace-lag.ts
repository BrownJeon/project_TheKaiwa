/**
 * qa-p2b — task-042 스모크 B2·B3 실패(응답 직후 `topicWords` Trace 가 0행)가 "테스트 경합"인지 "Trace 누락"인지 가르는 측정(A12 실호출 1회, LLM 직렬 슬롯).
 * 첫 세트 요청(`POST /api/v1/vocab/sessions {topicId}`) 응답이 끝난 직후부터 25ms 간격으로 같은 조건(`refType topicWords`·`refId 주제`·createdAt ≥ 요청 시작)의
 * Trace 수를 세어 "응답 끝 → 행이 보이기까지"의 지연과 행의 createdAt 을 요청 시작·끝 시각과 비교한다. 쓰기: 이 실행이 만든 세트·카드·스냅샷·로그·잡·반복 항목만 지운다.
 *   QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c3 && BASE=http://127.0.0.1:3032 node --env-file=.env --import tsx tests/live/p2b-qa/trace-lag.ts /tmp/c3 [시드주제 순번=1]
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3032'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const idx = Number(process.argv[3] ?? 1)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  const u = await prisma.user.findFirstOrThrow({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  const ids = async () => ({
    sessions: new Set((await prisma.vocabSession.findMany({ where: { userId: u.id }, select: { id: true } })).map((r) => r.id)),
    snaps: new Set((await prisma.statsSnapshot.findMany({ where: { userId: u.id }, select: { id: true } })).map((r) => r.id)),
    logs: new Set((await prisma.studyLog.findMany({ where: { userId: u.id }, select: { id: true } })).map((r) => r.id)),
    jobs: new Set((await prisma.aiJob.findMany({ where: { userId: u.id }, select: { id: true } })).map((r) => r.id)),
    reps: new Set((await prisma.repetitionItem.findMany({ where: { userId: u.id }, select: { id: true } })).map((r) => r.id)),
  })
  const before = await ids()
  const seeds = await prisma.conversationTopic.findMany({ where: { userId: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true, _count: { select: { chunks: true } } } })
  const T = seeds.filter((t) => t._count.chunks >= 4)[idx]
  if (!T) throw new Error('시드 주제 없음')
  const t0 = new Date()
  const perf0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/vocab/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: COOKIE }, body: JSON.stringify({ topicId: T.id, count: 10, mode: 'CHOICE' }) })
  const text = await r.text()
  const t1 = new Date()
  const respMs = performance.now() - perf0
  const gen = ((JSON.parse(text) as { data?: { generation?: unknown } }).data ?? {}).generation
  console.log(`INFO status=${r.status} 응답 ${Math.round(respMs)}ms generation=${JSON.stringify(gen)}`)
  const where = { userId: u.id, refType: 'topicWords', refId: T.id, createdAt: { gte: t0 } }
  let seenAfterMs: number | null = null
  const pStart = performance.now()
  for (let i = 0; i < 200; i++) {
    if ((await prisma.requestTrace.count({ where })) > 0) { seenAfterMs = Math.round(performance.now() - pStart); break }
    await sleep(25)
  }
  const row = await prisma.requestTrace.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true, totalMs: true, errorCode: true, steps: true } })
  const step = Array.isArray(row?.steps) ? (row?.steps[0] as Record<string, unknown>) : undefined
  console.log(`RESULT 응답 끝 → 첫 Trace 가시까지 ${seenAfterMs === null ? '5초 안에 안 보임' : `${seenAfterMs}ms(첫 조회 시점 기준)`} · Trace createdAt − 요청시작 = ${row ? row.createdAt.getTime() - t0.getTime() : 'n/a'}ms · 응답끝 − 요청시작 = ${t1.getTime() - t0.getTime()}ms · status=${row?.status} totalMs=${row?.totalMs} lane=${String(step?.lane)} err=${row?.errorCode ?? '-'}`)
  console.log(`INFO Trace 수(이 주제·이 실행) = ${await prisma.requestTrace.count({ where })} · AiJob 증가 = ${(await prisma.aiJob.count({ where: { userId: u.id } })) - before.jobs.size}`)
  // 정리 — 이 실행이 만든 행만(0답 세트라 스냅샷·로그는 대개 없다).
  const after = await ids()
  const del = <T>(a: Set<T>, b: Set<T>): T[] => [...a].filter((x) => !b.has(x))
  const ns = del(after.sessions, before.sessions)
  if (ns.length) {
    await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: ns } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: ns } } })
  }
  const nsn = del(after.snaps, before.snaps)
  if (nsn.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: nsn } } })
  const nl = del(after.logs, before.logs)
  if (nl.length) await prisma.studyLog.deleteMany({ where: { id: { in: nl } } })
  const nj = del(after.jobs, before.jobs)
  if (nj.length) await prisma.aiJob.deleteMany({ where: { id: { in: nj } } })
  const nr = del(after.reps, before.reps)
  if (nr.length) await prisma.repetitionItem.deleteMany({ where: { id: { in: nr } } })
  console.log(`정리: sessions ${ns.length} snaps ${nsn.length} logs ${nl.length} jobs ${nj.length} reps ${nr.length} (Trace 는 남김)`)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
