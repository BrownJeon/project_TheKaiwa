/** qa-p2c-A E — 기록 화면 실측용 추가 고정 행(utt-fixtures up 뒤): 확인 대기 3개 복구 + ROOM_ONLY(방은 있고 메시지 없음) 1개. 사용: FIX='{...}' node --env-file=.env --import tsx tests/live/p2c-qa/utt-extra.ts */
import { PrismaClient } from '@prisma/client'
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const F = JSON.parse(process.env.FIX ?? '{}') as Record<string, string>
const prisma = new PrismaClient()
;(async () => {
  const u1 = await prisma.user.findFirst({ where: { email: 'qa-bot@thekaiwa.test', provider: 'test' }, select: { id: true } })
  if (!u1) throw new Error('QA1 없음')
  for (const [i, id] of [F.qa1Waiting, F.qa1Done].entries())
    await prisma.utterance.update({ where: { id }, data: { requiresReview: true, finalSource: 'REALTIME', finalText: null, status: 'ANALYZED', analysisText: '別の聞き取り結果', createdAt: new Date(Date.now() - (30 + i) * 60_000) } })
  await prisma.utterance.update({ where: { id: F.qa1NoChat }, data: { requiresReview: true, status: 'ANALYZED', analysisText: '分析結果が違います', finalSource: 'REALTIME', createdAt: new Date(Date.now() - 20 * 60_000) } })
  await prisma.utterance.create({ data: { realtimeEngine: 'p2cA-fixture', durationMs: 3000, sampleRate: 16000, userId: u1.id, chatId: F.qa1Chat, realtimeText: 'すみません、さっき注文したアイスコーヒーなんですけど、やっぱりホットに変えてもらえますか。', status: 'RECORDED', createdAt: new Date(Date.now() - 10 * 60_000) } })
  console.log('utt-extra: ok')
  await prisma.$disconnect()
})()
