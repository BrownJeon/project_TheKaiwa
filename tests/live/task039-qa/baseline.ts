/* eslint-disable @typescript-eslint/no-explicit-any */
// QA 계정(qa-bot·qa-bot2) 사용자별 행 수 스냅샷 — QA_USER_WHERE(provider test + @thekaiwa.test)만 대상. 출력: JSON 파일.
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'
const p = new PrismaClient() as any
const MODELS = ['aiJob','chat','chatMessage','correction','tutorProposal','wordEntry','vocabSession','conversationTopic','lesson','reviewSchedule','repetitionItem','learningObservation','studyLog','attendance','evaluation','studyPlan','challenge','statsSnapshot','learnerErrorStat','utterance','speechJob','requestTrace']
async function main() {
  if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
  const out: Record<string, unknown> = {}
  for (const email of ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test']) {
    const u = await p.user.findFirst({ where: { AND: [{ email }, QA_USER_WHERE] }, select: { id: true } })
    if (!u) { out[email] = null; continue }
    const counts: Record<string, number> = {}
    for (const m of MODELS) counts[m] = await p[m].count({ where: { userId: u.id } })
    const snaps = await p.statsSnapshot.findMany({ where: { userId: u.id }, orderBy: [{ kind: 'asc' }, { key: 'asc' }] }).catch(async () => p.statsSnapshot.findMany({ where: { userId: u.id } }))
    const prof = await p.profile.findUnique({ where: { userId: u.id } })
    out[email] = { userId: u.id, counts, snapshots: snaps, level: prof?.level ?? null, profile: prof }
  }
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1), 'utf8')
  for (const [k, v] of Object.entries(out)) console.log(k, v ? JSON.stringify((v as any).counts) : 'null')
}
main().finally(() => p.$disconnect())
