import { api, cookieOf, data, j, prisma, qaUser, QA3, qaRowCounts, seedHash, T_CAFE } from './lib.mjs'
const c3 = cookieOf(process.env.QA_COOKIE)
const u3 = await qaUser(QA3)
console.log('counts', j(await qaRowCounts(u3.id)), 'seed', j(await seedHash()))
const t = await api(c3, 'GET', '/api/v1/topics?level=all')
console.log('topics status', t.status, Object.keys(data(t) ?? {}), j(data(t)).slice(0, 300))
const topics = data(t)?.items ?? data(t)?.topics ?? data(t)
console.log('topic ids', (topics ?? []).map((x) => `${x.id}:${x.title}:${x.isSeed}:${x.level}`))
const s = await api(c3, 'GET', '/api/v1/scenarios?limit=100')
console.log('scen status', s.status, Object.keys(data(s) ?? {}))
console.log('scen ids', (data(s)?.items ?? []).map((x) => `${x.id}:${x.title}:${x.isMine}`))
const rm = await api(c3, 'GET', `/api/v1/topics/${T_CAFE}/removal`)
console.log('removal', rm.status, j(data(rm)).slice(0, 600))
const so = await api(c3, 'GET', '/api/v1/seed-overrides')
console.log('overrides', so.status, j(data(so)).slice(0, 200))
for (const p of ['/settings/scenarios', `/settings/scenarios/topics/${T_CAFE}`, '/study/ai?tab=scenario']) {
  const t0 = Date.now(); const r = await fetch('http://127.0.0.1:3052' + p, { headers: { Cookie: c3 } }); await r.text(); console.log('warm', p, r.status, Date.now() - t0, 'ms')
}
await prisma.$disconnect()
