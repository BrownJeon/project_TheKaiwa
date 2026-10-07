/** 항목 1 ⑥ 보충 — #175 상황 fork 의 하루 30(429 DAILY_LIMIT)·ACTIVE 50(409 SCENARIO_LIMIT) 한도. QA 계정 3, prisma 로 QA 행만 직접 삽입 후 정리. */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaUser, QA3, seedHash, summary } from './common'
const j = (v: unknown) => JSON.stringify(v)
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  const base = await prisma.scenario.findUniqueOrThrow({ where: { id: 'scn_cafe-order-drink' } })
  const mk = (n: number, createdAt: Date) => Array.from({ length: n }, (_, i) => ({ userId: u3.id, title: `QA 상황 ${i + 1}`, level: 'N5' as const, difficulty: 2, roles: base.roles as any, goal: base.goal as any, keyExpressions: base.keyExpressions as any, completionRule: base.completionRule as any, isSeed: false, status: 'ACTIVE', createdAt }))
  // 하루 30
  await prisma.scenario.createMany({ data: mk(29, new Date()) })
  const a = await api(c3, 'POST', '/api/v1/scenarios/scn_cafe-order-drink/fork', {})
  check('#175 오늘 만든 상황 29 + fork 1 → 201(30번째)', a.status === 201, `status=${a.status} code=${code(a)} ${j(details(a))}`)
  const b = await api(c3, 'POST', '/api/v1/scenarios/scn_cafe-order-takeout/fork', {})
  check('#175 31번째 → 429 RATE_LIMITED·reason DAILY_LIMIT·limit 30·retryAfterSec', b.status === 429 && code(b) === 'RATE_LIMITED' && details(b)?.reason === 'DAILY_LIMIT' && details(b)?.limit === 30 && Number.isInteger(details(b)?.retryAfterSec), `status=${b.status} code=${code(b)} ${j(details(b))}`)
  check('#175 429 뒤 행 정확히 30·사본 override 는 첫 fork 것 1건뿐', (await prisma.scenario.count({ where: { userId: u3.id } })) === 30 && (await prisma.userSeedOverride.count({ where: { userId: u3.id } })) === 1)
  await cleanupQa(u3.id)
  // ACTIVE 50
  await prisma.scenario.createMany({ data: mk(49, new Date(Date.now() - 3 * 86_400_000)) })
  const c = await api(c3, 'POST', '/api/v1/scenarios/scn_cafe-order-drink/fork', {})
  check('#175 ACTIVE 49 + fork 1 → 201(50번째)', c.status === 201, `status=${c.status} code=${code(c)} ${j(details(c))}`)
  const d = await api(c3, 'POST', '/api/v1/scenarios/scn_cafe-order-takeout/fork', {})
  check('#175 51번째 → 409 CONFLICT·reason SCENARIO_LIMIT·limit 50', d.status === 409 && code(d) === 'CONFLICT' && details(d)?.reason === 'SCENARIO_LIMIT' && details(d)?.limit === 50, `status=${d.status} code=${code(d)} ${j(details(d))}`)
  check('#175 409 뒤 행 50·override 1', (await prisma.scenario.count({ where: { userId: u3.id } })) === 50 && (await prisma.userSeedOverride.count({ where: { userId: u3.id } })) === 1)
  void data
  const h1 = await seedHash()
  check('⑤ 시드 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', j(await cleanupQa(u3.id)))
  summary('item1d')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
