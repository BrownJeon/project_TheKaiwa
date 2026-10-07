/** qa-045-ui-a — 시드 주제·조각·상황·연결 내용 해시 + QA2 계정 task-045 행 수. 읽기 전용(쓰기 0). 실행: cd $Q && node --env-file=.env --import tsx <이 파일> */
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const h = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
async function main() {
  const topics = await prisma.conversationTopic.findMany({ where: { OR: [{ isSeed: true }, { userId: null }] }, orderBy: { id: 'asc' } })
  const chunks = await prisma.topicChunk.findMany({ where: { topicId: { in: topics.map((t) => t.id) } }, orderBy: { id: 'asc' } })
  const scenarios = await prisma.scenario.findMany({ where: { OR: [{ isSeed: true }, { userId: null }] }, orderBy: { id: 'asc' } })
  const links = await prisma.scenarioTopic.findMany({ where: { scenarioId: { in: scenarios.map((s) => s.id) } }, orderBy: [{ scenarioId: 'asc' }, { topicId: 'asc' }] })
  const qa = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' } })
  const uid = qa?.id ?? '__none__'
  const mineTopics = await prisma.conversationTopic.count({ where: { userId: uid } })
  const mineScen = await prisma.scenario.count({ where: { userId: uid } })
  const overrides = await prisma.userSeedOverride.count({ where: { userId: uid } })
  const challenges = await prisma.challenge.count({ where: { userId: uid } })
  console.log(
    JSON.stringify({
      seedTopics: topics.length,
      seedTopicsHash: h(topics.map((t) => [t.id, t.title, t.titleJa, t.level, t.description, t.updatedAt])),
      chunks: chunks.length,
      chunksHash: h(chunks),
      seedScenarios: scenarios.length,
      scenariosHash: h(scenarios.map((s) => [s.id, s.title, s.titleJa, s.level, s.roles, s.goal, s.keyExpressions, s.constraints, s.status, s.updatedAt])),
      linksHash: h(links),
      qa2: { topics: mineTopics, scenarios: mineScen, overrides, challenges },
    }),
  )
}
main().finally(() => prisma.$disconnect())
