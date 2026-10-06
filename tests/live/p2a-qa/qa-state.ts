/**
 * qa-p2a 읽기 전용 상태 점검 — QA 계정 3(`qa-bot3@thekaiwa.test`)의 행 수를 한 줄씩 찍는다(쓰기 0).
 *   node --env-file=.env --import tsx tests/live/p2a-qa/qa-state.ts
 * A11 가드(공부한 날 ≥2 · 항목 ≥2) 통과 여부를 먼저 알아야 #51·#62 를 부르는 스모크가 LLM(REVIEW_DECISION 잡)을 거는지 판단할 수 있다.
 */
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없다')
  const userId = user.id
  const daily = await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { periodKey: true, data: true } })
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
  const studyDays = daily.filter((r) => {
    const d = obj(r.data)
    return num(d.lessons) + num(d.reviews) + num(obj(d.words).sessions) + num(d.evals) + num(obj(d.corrections).accepted) + num(d.talkTurns) + num(d.chatTurns) > 0
  }).length
  const [items, wordEntries, challenges, vsessions, lessons, jobs, traces, snaps] = await Promise.all([
    prisma.repetitionItem.count({ where: { userId } }),
    prisma.wordEntry.count({ where: { userId } }),
    prisma.challenge.count({ where: { userId } }),
    prisma.vocabSession.count({ where: { userId } }),
    prisma.lesson.count({ where: { userId } }),
    prisma.aiJob.groupBy({ by: ['kind', 'status'], where: { userId }, _count: { _all: true } }),
    prisma.requestTrace.count({ where: { userId } }),
    prisma.statsSnapshot.groupBy({ by: ['kind'], where: { userId }, _count: { _all: true } }),
  ])
  console.log(JSON.stringify({ dailyRows: daily.length, studyDays, repetitionItems: items, wordEntries, challenges, vocabSessions: vsessions, lessons, requestTraces: traces, aiJobs: jobs.map((j) => `${j.kind}/${j.status}=${j._count._all}`), snapshots: snaps.map((s) => `${s.kind}=${s._count._all}`) }))
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
