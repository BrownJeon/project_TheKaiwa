/** qa-p2c-A G — QA 계정 1·2·4 가 SINCE 이후 만든 행 점검·정리. 시드 상황 10개·ScenarioTopic 은 건드리지 않는다. SINCE=<ISO> [--clean] */
import { PrismaClient } from '@prisma/client'
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const SINCE = new Date(process.env.SINCE ?? ''); if (Number.isNaN(SINCE.getTime())) throw new Error('SINCE 필요')
const clean = process.argv.includes('--clean')
const prisma = new PrismaClient()
const p = prisma as unknown as Record<string, { count: (a: unknown) => Promise<number>; deleteMany: (a: unknown) => Promise<{ count: number }> }>
;(async () => {
  const us = await prisma.user.findMany({ where: { email: { in: ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test', 'qa-bot4@thekaiwa.test'] }, provider: 'test' }, select: { id: true, email: true } })
  const ids = us.map((u) => u.id)
  const models: [string, unknown][] = [
    ['attendance', { userId: { in: ids }, checkedInAt: { gte: SINCE } }], ['studyLog', { userId: { in: ids }, createdAt: { gte: SINCE } }], ['repetitionItem', { userId: { in: ids }, createdAt: { gte: SINCE } }],
    ['learningObservation', { userId: { in: ids }, occurredAt: { gte: SINCE } }], ['correction', { userId: { in: ids }, createdAt: { gte: SINCE } }], ['chat', { userId: { in: ids }, createdAt: { gte: SINCE } }],
    ['lesson', { userId: { in: ids }, createdAt: { gte: SINCE } }], ['evaluation', { userId: { in: ids }, startedAt: { gte: SINCE } }], ['utterance', { userId: { in: ids }, createdAt: { gte: SINCE } }],
    ['aiJob', { userId: { in: ids }, createdAt: { gte: SINCE } }], ['requestTrace', { userId: { in: ids }, createdAt: { gte: SINCE } }], ['conversationTopic', { userId: { in: ids }, createdAt: { gte: SINCE } }],
    ['scenario', { userId: { in: ids }, isSeed: false, createdAt: { gte: SINCE } }], ['statsSnapshot', { userId: { in: ids }, createdAt: { gte: SINCE } }],
  ]
  for (const [m, where] of models) {
    try {
      const n = await p[m].count({ where })
      let d = ''
      if (clean && n > 0) d = ` → 삭제 ${(await p[m].deleteMany({ where })).count}`
      console.log(`${m}: ${n}${d}`)
    } catch (e) { console.log(`${m}: (모델 없음/오류 ${(e as Error).message.slice(0, 50)})`) }
  }
  const seeds = await prisma.scenario.count({ where: { isSeed: true, userId: null } })
  const links = await prisma.scenarioTopic.count()
  const left = await prisma.scenario.count({ where: { isSeed: false } })
  console.log(`시드 상황 ${seeds} · ScenarioTopic ${links} · 비시드 상황(전체 사용자) ${left} · 임시 계정 ${await prisma.user.count({ where: { email: 'qa-p2c-lim@thekaiwa.test' } })}`)
  await prisma.$disconnect()
})()
