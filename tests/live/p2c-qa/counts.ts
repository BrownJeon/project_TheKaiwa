/** qa-p2c-A — QA4 행 수·오늘 DAILY 해시 스냅샷(읽기 전용). 사용: node --env-file=.env --import tsx tests/live/p2c-qa/counts.ts */
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { todayKst } from '../../../src/modules/infra/dates'
const prisma = new PrismaClient()
;(async () => {
  const u = await prisma.user.findFirst({ where: { email: 'qa-bot4@thekaiwa.test', provider: 'test' }, select: { id: true } })
  if (!u) throw new Error('QA4 없음')
  const U = u.id
  const daily = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: todayKst() } }, select: { data: true } })
  const out = {
    studyLog: await prisma.studyLog.count({ where: { userId: U } }),
    repetitionItem: await prisma.repetitionItem.count({ where: { userId: U } }),
    observation: await prisma.learningObservation.count({ where: { userId: U } }),
    correction: await prisma.correction.count({ where: { userId: U } }),
    chatMessage: await prisma.chatMessage.count({ where: { userId: U } }),
    chat: await prisma.chat.count({ where: { userId: U } }),
    aiJob: await prisma.aiJob.count({ where: { userId: U } }),
    requestTrace: await prisma.requestTrace.count({ where: { userId: U } }),
    scenario: await prisma.scenario.count({ where: { userId: U } }),
    dailyHash: daily ? createHash('sha1').update(JSON.stringify(daily.data)).digest('hex').slice(0, 10) : null,
  }
  console.log(`COUNTS ${JSON.stringify(out)}`)
  await prisma.$disconnect()
})()
