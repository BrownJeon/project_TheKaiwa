/** qa-p2a 읽기 전용 — EngineMetricsDaily 행 목록(연결 key·날짜·requests·computedAt). 쓰기 0. */
import { prisma } from '../../../src/modules/infra/db'
async function main(): Promise<void> {
  const rows = await prisma.engineMetricsDaily.findMany({ select: { date: true, requests: true, computedAt: true, connection: { select: { key: true, environment: true, role: true } } }, orderBy: [{ computedAt: 'asc' }] })
  for (const r of rows) console.log(`${r.connection.environment} ${r.connection.role} ${r.connection.key} ${r.date.toISOString().slice(0, 10)} req=${r.requests} computedAt=${r.computedAt.toISOString()}`)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
