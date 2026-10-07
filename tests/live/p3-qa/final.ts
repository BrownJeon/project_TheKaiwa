import { prisma, qaUser, QA2, QA3, qaRowCounts, seedHash } from './common'
async function main() {
  for (const e of [QA3, QA2]) { const u = await qaUser(e); console.log(e, JSON.stringify(await qaRowCounts(u.id))) }
  console.log('seedHash end', JSON.stringify(await seedHash()))
  console.log('override rows total (all users)', await prisma.userSeedOverride.count())
}
main().finally(() => prisma.$disconnect())
