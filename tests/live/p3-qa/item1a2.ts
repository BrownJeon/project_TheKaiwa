/** 항목 1 ① 보충 — 시드 상황 10개 전부 {} fork: keyExpressions id·constraints(exprSeq 포함) 동일 확인. QA 계정 3. */
import { api, check, cleanupQa, cookieOf, data, prisma, qaUser, QA3, seedHash, summary } from './common'
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  const seeds = await prisma.scenario.findMany({ where: { userId: null, isSeed: true }, orderBy: { id: 'asc' } })
  let withSeq = 0
  for (const s of seeds) {
    const hasSeq = !!(s.constraints as any)?.exprSeq
    if (hasSeq) withSeq++
    const r = await api(c3, 'POST', `/api/v1/scenarios/${s.id}/fork`, {})
    const copy = await prisma.scenario.findUnique({ where: { id: data(r)?.id ?? 'x' } })
    check(`S-fork ${s.id} → 201·keyExpressions·constraints 동일`, r.status === 201 && stable(copy?.keyExpressions) === stable(s.keyExpressions) && stable(copy?.constraints) === stable(s.constraints) && stable(copy?.completionRule) === stable(s.completionRule), `exprSeq=${hasSeq} constraintsKeys=${Object.keys((s.constraints as any) ?? {}).join('/')} status=${r.status}`)
  }
  console.log('INFO exprSeq 를 가진 시드 상황 수 =', withSeq, '/', seeds.length)
  const h1 = await seedHash()
  check('시드 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', JSON.stringify(await cleanupQa(u3.id)))
  summary('item1a2')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
