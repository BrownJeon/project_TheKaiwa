import { prisma, qaUser, QA2, QA3, qaRowCounts, seedHash } from './common'
async function main() {
  const u3 = await qaUser(QA3)
  const u2 = await qaUser(QA2)
  console.log('qa3', u3.id, u3.role, 'qa2', u2.id, u2.role)
  console.log('seedHash', JSON.stringify(await seedHash()))
  console.log('qa3 rows', JSON.stringify(await qaRowCounts(u3.id)))
  console.log('qa2 rows', JSON.stringify(await qaRowCounts(u2.id)))
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null }, select: { id: true, title: true, level: true, _count: { select: { chunks: true, scenarios: true } } } })
  for (const t of topics) console.log('seedTopic', t.id, t.level, t.title, 'chunks', t._count.chunks, 'scn', t._count.scenarios)
  const sc = await prisma.scenario.findMany({ where: { userId: null }, select: { id: true, title: true, level: true, status: true, isSeed: true, topics: { select: { topicId: true } } } })
  for (const s of sc) console.log('seedScn', s.id, s.level, s.status, s.isSeed, s.title, 'topics', s.topics.map((t) => t.topicId).join(','))
}
main().finally(() => prisma.$disconnect())
