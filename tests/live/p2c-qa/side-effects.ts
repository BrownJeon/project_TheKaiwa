/** qa-p2c-A — 이 QA 가 SINCE 이후 계정 4·2·1 에 일으킨 LLM 부작용 행 점검(+선택 정리). SINCE=<ISO> [--clean] */
import { prisma } from '../../../src/modules/infra/db'
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const SINCE = new Date(process.env.SINCE ?? ''); if (Number.isNaN(SINCE.getTime())) throw new Error('SINCE 필요')
const clean = process.argv.includes('--clean')
;(async () => {
  const us = await prisma.user.findMany({ where: { email: { in: ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test', 'qa-bot4@thekaiwa.test'] }, provider: 'test' }, select: { id: true, email: true } })
  for (const u of us) {
    const jobs = await prisma.aiJob.findMany({ where: { userId: u.id, createdAt: { gte: SINCE } }, select: { id: true, kind: true, status: true, createdAt: true, refId: true } })
    const traces = await prisma.requestTrace.findMany({ where: { userId: u.id, createdAt: { gte: SINCE } }, select: { traceId: true, kind: true, refType: true, createdAt: true } })
    console.log(`${u.email}: aiJob ${jobs.length} ${JSON.stringify(jobs.map((j) => `${j.kind}/${j.status}/${j.refId ? 'ref' : '-'}@${j.createdAt.toISOString().slice(11, 19)}`))}`)
    console.log(`${u.email}: requestTrace ${traces.length} ${JSON.stringify(traces.map((t) => `${t.kind}/${t.refType ?? '-'}@${t.createdAt.toISOString().slice(11, 19)}`))}`)
    if (clean) {
      const a = await prisma.aiJob.deleteMany({ where: { id: { in: jobs.map((j) => j.id) } } })
      const b = await prisma.requestTrace.deleteMany({ where: { traceId: { in: traces.map((t) => t.traceId) } } })
      console.log(`  cleaned aiJob ${a.count} requestTrace ${b.count}`)
    }
  }
  await prisma.$disconnect()
})()
