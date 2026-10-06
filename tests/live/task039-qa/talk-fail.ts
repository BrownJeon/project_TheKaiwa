import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (/:3010$/.test(BASE)) throw new Error('운영 금지')
const COOKIE = readFileSync(process.argv[2], 'utf8').trim()
const H = { Cookie: COOKIE, 'Content-Type': 'application/json' }
const prisma = new PrismaClient()
async function main() {
  const c = await (await fetch(`${BASE}/api/v1/chats`, { method: 'POST', headers: H, body: JSON.stringify({ kind: 'TALK', title: 'qa039 talkfail' }) })).json()
  const id = c.data.id as string
  const text = '昨日映画を見に行くました。'
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${id}/turns`, { method: 'POST', headers: H, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  const raw = await r.text()
  const evs = [...raw.matchAll(/^event: (.+)$/gm)].map((m) => m[1])
  const err = /event: error\ndata: (.+)/.exec(raw)?.[1]
  console.log('status', r.status, 'events', evs.join(','), 'ms', Math.round(performance.now() - t0), 'error', (err ?? '').slice(0, 200))
  const msgs = await prisma.chatMessage.findMany({ where: { chatId: id }, orderBy: { createdAt: 'asc' }, select: { role: true, status: true, content: true } })
  const corr = await prisma.correction.count({ where: { chatId: id } })
  console.log('messages', JSON.stringify(msgs.map((m) => ({ role: m.role, status: m.status, contentEq: m.role === 'USER' ? m.content === text : m.content === '' }))), 'corrections', corr)
  console.log('leak', /claude|nonexistent|ENOENT|spawn|\/home\//i.test(raw) ? 'YES' : 'no')
  await prisma.chat.delete({ where: { id } })
  await prisma.$disconnect()
}
main()
