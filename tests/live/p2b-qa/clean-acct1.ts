/**
 * qa-p2b — task010 스모크가 QA 계정 1(`qa-bot`)에 남긴 A11 잡·Trace·관측만 지운다(스모크 시작 시각 이후). `p2cA-fixture` 채팅 방은 다른 QA(qa-p2c-A) 것이라 건드리지 않는다.
 *   FROM=<ISO> node --env-file=.env --import tsx tests/live/p2b-qa/clean-acct1.ts [--dry-run]
 */
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const FROM = new Date(process.env.FROM ?? '')
if (Number.isNaN(FROM.getTime())) throw new Error('FROM=<ISO> 필요')
const dry = process.argv.includes('--dry-run')
async function main(): Promise<void> {
  const u = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!u) throw new Error('QA 계정 1 이 없다')
  const jobs = { userId: u.id, kind: 'REVIEW_DECISION' as const, createdAt: { gte: FROM } }
  const tr = { userId: u.id, createdAt: { gte: FROM }, refType: 'reviewDecision' }
  const ob = { userId: u.id, occurredAt: { gte: FROM } }
  const n = { aiJob: await prisma.aiJob.count({ where: jobs }), trace: await prisma.requestTrace.count({ where: tr }), obs: await prisma.learningObservation.count({ where: ob }) }
  if (!dry) {
    await prisma.aiJob.deleteMany({ where: jobs })
    await prisma.requestTrace.deleteMany({ where: tr })
    await prisma.learningObservation.deleteMany({ where: ob })
  }
  console.log(`${dry ? '[dry-run] 대상' : '삭제'} ${JSON.stringify(n)}`)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
