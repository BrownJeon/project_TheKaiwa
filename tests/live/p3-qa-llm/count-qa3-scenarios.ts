/** QA-h 종단 확인용 — QA3 계정의 Scenario 행 수만 센다(읽기 전용). 실행: node --env-file=.env --import tsx tests/live/p3-qa-llm/count-qa3-scenarios.ts */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'qa-bot3@thekaiwa.test' }, select: { id: true } })
  if (!u) { console.log('QA3 user 없음'); return }
  const mine = await prisma.scenario.count({ where: { userId: u.id } })
  console.log(`QA3 Scenario rows = ${mine}`)
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
