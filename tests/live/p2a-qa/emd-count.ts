/**
 * qa-p2a 읽기 전용 — EngineMetricsDaily 행 수를 환경·연결별로 찍는다(012b-3 스모크 전후 비교용, 쓰기 0).
 *   node --env-file=.env --import tsx tests/live/p2a-qa/emd-count.ts
 */
import { prisma } from '../../../src/modules/infra/db'

async function main(): Promise<void> {
  const all = await prisma.engineMetricsDaily.findMany({ select: { connection: { select: { environment: true, key: true } } } })
  const byEnv = new Map<string, number>()
  for (const r of all) byEnv.set(r.connection.environment, (byEnv.get(r.connection.environment) ?? 0) + 1)
  const total = all.length
  const qaFixtures = await prisma.engineConnection.count({ where: { key: { startsWith: 'qa012b3-tts-' } } })
  const qaTrace = await prisma.requestTrace.count({ where: { refType: 'qa012b3' } })
  const lowTtl = await prisma.ttsCache.count({ where: { createdAt: { lt: new Date('2001-01-01T00:00:00Z') } } })
  const ttsCache = await prisma.ttsCache.count()
  console.log(JSON.stringify({ total, byEnv: [...byEnv.entries()].map(([e, n]) => `${e}=${n}`), fixtureConnections: qaFixtures, fixtureTraces: qaTrace, fixtureTtsCache: lowTtl, ttsCacheTotal: ttsCache }))
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
