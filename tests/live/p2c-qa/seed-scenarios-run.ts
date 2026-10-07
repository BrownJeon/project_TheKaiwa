/**
 * QA 전용 — 상황 시드 로더(prisma/seed-scenarios.ts)만 단독 실행한다. `prisma/seed.ts` 전체는 돌리지 않는다(엔진·Voice·AppSetting·발음 사전·PromptTemplate·OWNER 시드 보호).
 * 사용: node --env-file=.env --import tsx tests/live/p2c-qa/seed-scenarios-run.ts plan|apply
 *   plan  = SEED_DRY_RUN 과 같은 드라이런(쓰기 0)  ·  apply = 실제 적재(비파괴·멱등)
 * 실행 전후 DB 의 시드 상황·ScenarioTopic 행 수를 출력한다. 운영 릴리스 경로·APP_ENV=PRODUCTION 은 거부.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { seedScenarios } from '../../../prisma/seed-scenarios'
import type { SeedTopicInput } from '../../../prisma/seed-topics'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION' || /\/apps\/thekaiwa(\/|$)/.test(process.cwd())) throw new Error('PRODUCTION(운영 릴리스)에서는 실행하지 않는다')
const mode = process.argv[2]
if (mode !== 'plan' && mode !== 'apply') throw new Error('사용: seed-scenarios-run.ts plan|apply')
const prisma = new PrismaClient()
const read = (name: string) => JSON.parse(readFileSync(join(__dirname, '../../../prisma/seed-data', name), 'utf-8'))

async function counts(tag: string): Promise<void> {
  const seeds = await prisma.scenario.findMany({ where: { isSeed: true, userId: null }, select: { id: true, status: true, _count: { select: { topics: true } } }, orderBy: { id: 'asc' } })
  const all = await prisma.scenario.count()
  const links = await prisma.scenarioTopic.count()
  console.log(`[count:${tag}] Scenario 전체 ${all} · 시드 ${seeds.length} · ScenarioTopic ${links}`)
  if (tag.startsWith('after') || seeds.length) console.log(`[ids:${tag}] ${seeds.map((s) => `${s.id}(${s.status},links=${s._count.topics})`).join(' ')}`)
}

async function main(): Promise<void> {
  await counts('before')
  const topics: SeedTopicInput[] = read('topics.json')
  const sum = await seedScenarios(prisma, read('scenarios.json'), topics, { dryRun: mode === 'plan' })
  console.log(`[summary:${mode}] ${JSON.stringify(sum)}`)
  await counts(`after-${mode}`)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
