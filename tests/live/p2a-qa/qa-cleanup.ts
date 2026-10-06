/**
 * qa-p2a 최종 정리·점검 — SINCE 이후 이 QA 가 만든 파생 행만 지우고(LOCAL 연결의 EngineMetricsDaily 지연 물화분 — 다시 계산됨), 남은 QA 표식 행을 센다.
 *   SINCE=<ISO> node --env-file=.env --import tsx tests/live/p2a-qa/qa-cleanup.ts [--dry-run]
 * 시드·실사용자 행은 건드리지 않는다(QA 계정 3 의 기록은 상태 점검만).
 */
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const SINCE = new Date(process.env.SINCE ?? '')
if (Number.isNaN(SINCE.getTime())) throw new Error('SINCE=<ISO 시각> 필요')
const dry = process.argv.includes('--dry-run')

async function main(): Promise<void> {
  const emd = await prisma.engineMetricsDaily.findMany({ where: { computedAt: { gte: SINCE }, connection: { environment: 'LOCAL' } }, select: { id: true } })
  if (!dry && emd.length) await prisma.engineMetricsDaily.deleteMany({ where: { id: { in: emd.map((r) => r.id) } } })
  const u3 = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  const left = {
    emdSinceDeleted: dry ? 0 : emd.length,
    emdSinceTarget: emd.length,
    emdTotal: await prisma.engineMetricsDaily.count(),
    fixtureConnections: await prisma.engineConnection.count({ where: { key: { startsWith: 'qa012b3' } } }),
    fixtureTraces: await prisma.requestTrace.count({ where: { refType: { in: ['qa012b3', 'qa012b3x'] } } }),
    fixtureTtsCache: await prisma.ttsCache.count({ where: { createdAt: { lt: new Date('2001-01-01T00:00:00Z') } } }),
    qa3Challenges: u3 ? await prisma.challenge.count({ where: { userId: u3.id } }) : -1,
    qa3VocabSessions: u3 ? await prisma.vocabSession.count({ where: { userId: u3.id } }) : -1,
    qa3Snapshots: u3 ? await prisma.statsSnapshot.count({ where: { userId: u3.id } }) : -1,
    qa3AiJobs: u3 ? await prisma.aiJob.count({ where: { userId: u3.id } }) : -1,
    qa3Traces: u3 ? await prisma.requestTrace.count({ where: { userId: u3.id } }) : -1,
    qa3Repetition: u3 ? await prisma.repetitionItem.count({ where: { userId: u3.id } }) : -1,
    qaTopicsT042: await prisma.conversationTopic.count({ where: { title: { startsWith: 't042' } } }),
    qaChallengeTitles: await prisma.challenge.count({ where: { title: { startsWith: 't-p2a' } } }),
  }
  console.log(JSON.stringify(left))
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
