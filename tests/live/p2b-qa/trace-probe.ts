/**
 * qa-p2b 읽기 전용 — QA 계정 3 의 RequestTrace 를 SINCE 이후로 요약한다(쓰기 0, 원문 없음).
 *   SINCE=<ISO> node --env-file=.env --import tsx tests/live/p2b-qa/trace-probe.ts
 */
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
async function main(): Promise<void> {
  const since = new Date(process.env.SINCE ?? '')
  if (Number.isNaN(since.getTime())) throw new Error('SINCE=<ISO> 필요')
  const u = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!u) throw new Error('QA 계정 3 이 없다')
  const rows = await prisma.requestTrace.findMany({
    where: { userId: u.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { traceId: true, kind: true, refType: true, refId: true, status: true, errorCode: true, totalMs: true, createdAt: true, steps: true },
  })
  for (const r of rows) {
    const st = Array.isArray(r.steps)
      ? (r.steps as Record<string, unknown>[]).map((s) => `${String(s.name ?? s.step ?? '?')}:${String(s.lane ?? '')}:${String(s.ms ?? s.durationMs ?? '')}`).join('|')
      : ''
    console.log(`${r.createdAt.toISOString()} kind=${String(r.kind)} ${String(r.refType)}/${String(r.refId).slice(0, 8)} ${String(r.status)} ${r.errorCode ?? '-'} total=${String(r.totalMs)}ms steps=${st}`)
  }
  console.log('rows', rows.length)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
