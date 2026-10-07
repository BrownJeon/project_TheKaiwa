/** qa-045-b2 정리 — 이 소환이 만든 QA 행만(명시 id) 지운다. cwd=스냅샷 폴더: `node --env-file=.env --import tsx tests/live/p3-qa/cleanup-b2.ts` */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const SC = ['cmuy1jwm90001w1up5wsbp2kh']
const CH = ['cmuy1jxq00003w1upm167zljj', 'cmuy1jysx0007w1upcg0coi1j', 'cmuy1k0f30009w1upwp1o5ten']
async function main() {
  const u1 = await prisma.user.findUnique({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  if (!u1) throw new Error('qa-bot 없음')
  console.log('내가 만든 채팅 중 남은 것', await prisma.chat.count({ where: { id: { in: CH }, userId: u1.id } }))
  console.log('계정 1 의 기존 채팅(내가 만든 것 아님)', JSON.stringify(await prisma.chat.findMany({ where: { userId: u1.id }, select: { id: true, kind: true, title: true, createdAt: true, scenarioId: true } })))
  console.log('상황(삭제 전)', JSON.stringify(await prisma.scenario.findMany({ where: { id: { in: SC }, userId: u1.id }, select: { id: true, status: true } })))
  const st = await prisma.scenarioTopic.deleteMany({ where: { scenarioId: { in: SC }, scenario: { userId: u1.id } } })
  const sc = await prisma.scenario.deleteMany({ where: { id: { in: SC }, userId: u1.id } })
  console.log('삭제: scenarioTopic', st.count, 'scenario', sc.count)
  console.log('남은 override(계정 1)', await prisma.userSeedOverride.count({ where: { userId: u1.id } }))
}
main().finally(() => prisma.$disconnect())
