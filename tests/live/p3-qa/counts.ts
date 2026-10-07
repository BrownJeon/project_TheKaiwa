/** QA 계정(1·4)이 가진 행 수 — 호출 전후 대조·정리 확인용. cwd=스냅샷 폴더에서 `node --env-file=.env --import tsx tests/live/p3-qa/counts.ts` */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const emails = ['qa-bot@thekaiwa.test', 'qa-bot4@thekaiwa.test']
  const out: Record<string, unknown> = {}
  for (const email of emails) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!u) { out[email] = null; continue }
    const [topic, chunk, scenario, st, ov, chat] = await Promise.all([
      prisma.conversationTopic.count({ where: { userId: u.id } }),
      prisma.topicChunk.count({ where: { topic: { userId: u.id } } }),
      prisma.scenario.count({ where: { userId: u.id } }),
      prisma.scenarioTopic.count({ where: { scenario: { userId: u.id } } }),
      prisma.userSeedOverride.count({ where: { userId: u.id } }),
      prisma.chat.count({ where: { userId: u.id } }),
    ])
    out[email] = { topic, chunk, scenario, scenarioTopic: st, override: ov, chat }
  }
  console.log(JSON.stringify(out))
}
main().finally(() => prisma.$disconnect())
