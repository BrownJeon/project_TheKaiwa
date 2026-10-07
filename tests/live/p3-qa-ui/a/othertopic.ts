/** qa-045-ui-a 항목 4 — 「남의 주제 id」 404 시험용: QA 계정(@thekaiwa.test, QA2 제외)이 가진 주제 id 1개. 읽기 전용. 실사용자 행은 보지 않는다. */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const t = await prisma.conversationTopic.findFirst({ where: { user: { email: { endsWith: '@thekaiwa.test', not: 'qa-bot2@thekaiwa.test' } } }, select: { id: true, user: { select: { email: true } } } })
  console.log(JSON.stringify(t ? { id: t.id, owner: t.user?.email } : { id: null }))
}
main().finally(() => prisma.$disconnect())
