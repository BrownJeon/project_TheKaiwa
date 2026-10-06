/* eslint-disable @typescript-eslint/no-explicit-any */
// 옛 교정(NULL) 카드 비교용: 표현 점검 결과 화면이 읽는 합성 CHAT 방(교정 2건, extraNoteKo 둘 다 NULL = 옛 행) — DB 로만 심는다(LLM 없음).
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3030'
if (/:3010$/.test(BASE)) throw new Error('운영 금지')
const COOKIE = readFileSync(process.argv[2], 'utf8').trim()
const prisma = new PrismaClient()
async function main() {
  const c = await (await fetch(`${BASE}/api/v1/chats`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'CHAT', title: 'qa039 old card' }) })).json()
  const chatId = c.data.id as string
  const userId = (await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } }))!.userId
  const specs = [
    { text: '昨日、スーパーで野菜が買いました。', original: '野菜が買いました', corrected: '野菜を買いました', explanation: '「買う」は目的語に「を」を使います。', et: 'PARTICLE', ct: 'ACTION' },
    { text: '日本語が話せるために、毎日練習しています。', original: '話せるために', corrected: '話せるように', explanation: '액션 조각 확인용 옛 행 설명이에요. 능력·상태의 목적에는 「ように」가 자연스러워요.', et: 'GRAMMAR', ct: 'ACTION' },
  ]
  const ids: string[] = []
  for (let k = 0; k < specs.length; k++) {
    const m = await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: specs[k].text, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(Date.now() - 3_000_000 + k * 60_000) } })
    const r = await prisma.correction.create({ data: { userId, chatId, messageId: m.id, original: specs[k].original, corrected: specs[k].corrected, explanation: specs[k].explanation, errorType: specs[k].et as any, severity: 'MINOR', chunkType: specs[k].ct as any, status: 'PROPOSED' } })
    ids.push(r.id)
  }
  await prisma.chat.update({ where: { id: chatId }, data: { messageCount: 2, reviewedAt: new Date() } })
  writeFileSync(process.argv[3], JSON.stringify({ chatId, ids }), 'utf8')
  console.log(JSON.stringify({ chatId, ids }))
  await prisma.$disconnect()
}
main()
