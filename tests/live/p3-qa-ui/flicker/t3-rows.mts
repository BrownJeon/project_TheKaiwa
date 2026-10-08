/**
 * task-046 T3 — QA 3 계정의 userId 보유 모델별 행 수(전후 비교용). `--delete-words` 면 QA 3 의 WordEntry 만 지운다(시드 되돌리기).
 * 실행(미러 루트): QA3 만 다룬다 — `node --env-file=.env --import tsx tests/live/p3-qa-ui/flicker/t3-rows.mts [--delete-words]`
 */
import { Prisma, PrismaClient } from '@prisma/client'

const EMAIL = 'qa-bot3@thekaiwa.test'
const prisma = new PrismaClient()
async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (!user || user.provider !== 'test') throw new Error('QA3 계정을 찾지 못했거나 provider 가 test 가 아니다 — 중단')
  if (process.argv.includes('--delete-words')) {
    const r = await prisma.wordEntry.deleteMany({ where: { userId: user.id } })
    console.log(`deleted WordEntry ${r.count} (userId=${user.id})`)
  }
  const out: Record<string, number> = {}
  for (const m of Prisma.dmmf.datamodel.models) {
    if (!m.fields.some((f) => f.name === 'userId' && f.kind === 'scalar')) continue
    const key = m.name.charAt(0).toLowerCase() + m.name.slice(1)
    const delegate = (prisma as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[key]
    if (!delegate) continue
    const n = await delegate.count({ where: { userId: user.id } })
    if (n > 0) out[m.name] = n
  }
  console.log(JSON.stringify(out))
}
main().finally(() => prisma.$disconnect())
