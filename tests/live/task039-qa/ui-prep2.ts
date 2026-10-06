/* eslint-disable @typescript-eslint/no-explicit-any */
// ui-prep 보충: 마지막 턴에 LONG(200자)·NOW 교정을 붙인다(4번째 문장이 정답이라 교정이 없었다). prep json 의 talk.corrIds 에 추가.
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
const [cf, pj] = process.argv.slice(2)
const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (/:3010$/.test(BASE)) throw new Error('운영 금지')
const COOKIE = readFileSync(cf, 'utf8').trim()
const prep = JSON.parse(readFileSync(pj, 'utf8'))
const prisma = new PrismaClient()
const LONG_BASE = '「〜ことになっている」: 규칙·관례·예정으로 정해져 있다는 뜻의 문형이에요. 동사 사전형 + ことになっている 로 접속하고 회사 규칙이나 일정, 사회 관습을 말할 때 자주 나와요. 비슷한 「〜ことにしている」(스스로 정한 습관)와 구별하고, 「〜ことになる」(결정된 결과)와도 헷갈리지 마세요.'
const LONG = Array.from(LONG_BASE + ' 예: 毎朝走ることになっている。 예: 毎朝走ることになっている。').slice(0, 200).join('')
async function main() {
  const r = await fetch(`${BASE}/api/v1/chats/${prep.talk.chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '私は昨日学校に行くました。', inputSource: 'TEXT' }) })
  const raw = await r.text()
  const m = /event: done\ndata: (.+)/.exec(raw)
  if (!m) throw new Error('턴 실패')
  const d = JSON.parse(m[1])
  if (!d.correction?.id) throw new Error('교정 없음')
  await prisma.correction.update({ where: { id: d.correction.id }, data: { extraNoteKo: LONG } })
  const msg = await prisma.chatMessage.findUnique({ where: { id: d.userMessageId }, select: { toolLog: true } })
  const tl = (msg?.toolLog ?? {}) as Record<string, any>
  tl.correction = { ...(tl.correction ?? { id: d.correction.id, mode: 'FLUENCY', hintKo: null, selfCheck: null }), deliver: 'NOW' }
  await prisma.chatMessage.update({ where: { id: d.userMessageId }, data: { toolLog: tl } })
  prep.talk.corrIds.push(d.correction.id)
  prep.talk.withCorrection = prep.talk.corrIds.length
  writeFileSync(pj, JSON.stringify(prep, null, 1))
  console.log('ok', prep.talk.corrIds.length, 'len', Array.from(LONG).length)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e.message); process.exitCode = 1 })
