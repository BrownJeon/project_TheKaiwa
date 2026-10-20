// task-079 배포 후 관찰 — 읽기 전용. A12 트레이스를 promptVersion 별로 집계(레벨 칸은 트레이스에 없음).
const { PrismaClient } = require(process.env.M + '/node_modules/@prisma/client')
const p = new PrismaClient()
;(async () => {
  const tr = await p.requestTrace.findMany({ where: { refType: 'topicWords' }, select: { steps: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
  const by = {}
  for (const t of tr) for (const s of (Array.isArray(t.steps) ? t.steps : [])) if (s && s.name === 'A12' && s.received != null) {
    const v = s.promptVersion || '?'; const b = (by[v] = by[v] || { calls: 0, target: 0, received: 0, kept: 0, drop: {}, exNull: {}, last: null })
    b.calls++; b.target += s.target || 0; b.received += s.received; b.kept += s.kept || 0; b.last = t.createdAt
    for (const kv of String(s.dropped || '').split(',').filter(Boolean)) { const [k, n] = kv.split('='); b.drop[k] = (b.drop[k] || 0) + Number(n) }
    for (const kv of String(s.exampleNulledBy || '').split(',').filter(Boolean)) { const [k, n] = kv.split('='); b.exNull[k] = (b.exNull[k] || 0) + Number(n) }
  }
  for (const [v, b] of Object.entries(by)) console.log(v, JSON.stringify({ calls: b.calls, keptPerCall: +(b.kept / b.calls).toFixed(2), keptOverTarget: +(b.kept / Math.max(1, b.target)).toFixed(3), keptOverReceived: +(b.kept / Math.max(1, b.received)).toFixed(3), drop: b.drop, exampleNulledBy: b.exNull, last: b.last }))
  await p.$disconnect()
})().catch((e) => { console.error('ERR', e.message.slice(0, 200)); process.exit(1) })
