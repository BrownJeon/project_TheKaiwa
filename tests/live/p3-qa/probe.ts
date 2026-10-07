import { api, cookieOf, data, prisma } from './common'
async function main() {
  const c = cookieOf(process.env.QA_COOKIE!)
  const t = await api(c, 'GET', '/api/v1/topics?level=all')
  console.log('GET topics?level=all', t.status, 'items', data(t)?.items?.length, 'level', JSON.stringify(data(t)?.level))
  const it = data(t)?.items?.[0]
  console.log('topic item keys', Object.keys(it ?? {}).join(','), '| chunk keys', Object.keys(it?.chunks?.[0] ?? {}).join(','))
  console.log('topic item', JSON.stringify({ ...it, chunks: it?.chunks?.slice(0, 2) }).slice(0, 700))
  const s = await api(c, 'GET', '/api/v1/scenarios/scn_directions-station-exit')
  console.log('GET scenario', s.status, JSON.stringify(data(s)).slice(0, 1500))
  const l = await api(c, 'GET', '/api/v1/scenarios')
  console.log('GET scenarios', l.status, JSON.stringify(data(l)).slice(0, 400))
  const o = await api(c, 'GET', '/api/v1/seed-overrides')
  console.log('GET seed-overrides', o.status, JSON.stringify(data(o)))
}
main().finally(() => prisma.$disconnect())
