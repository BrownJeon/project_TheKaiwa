/* eslint-disable @typescript-eslint/no-explicit-any */
// QA 계정 1·2 의 행 중 createdAt >= SINCE 인 것(모델별 수) — 정리 대상 확인용(읽기 전용). UNTIL 이 있으면 그 이전까지만.
import { PrismaClient } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'
const p = new PrismaClient() as any
const SINCE = new Date(process.env.SINCE!)
const UNTIL = process.env.UNTIL ? new Date(process.env.UNTIL) : null
const TIME: Record<string, string> = { learnerErrorStat: 'firstAt' }
const MODELS = ['aiJob','chat','chatMessage','correction','tutorProposal','wordEntry','vocabSession','lesson','repetitionItem','learningObservation','studyLog','attendance','evaluation','statsSnapshot','learnerErrorStat','utterance','speechJob','requestTrace']
async function main() {
  for (const email of ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test']) {
    const u = await p.user.findFirst({ where: { AND: [{ email }, QA_USER_WHERE] }, select: { id: true } })
    if (!u) continue
    const out: Record<string, number> = {}
    for (const m of MODELS) {
      const f = TIME[m] ?? 'createdAt'
      try { out[m] = await p[m].count({ where: { userId: u.id, [f]: { gte: SINCE, ...(UNTIL ? { lte: UNTIL } : {}) } } }) } catch { out[m] = -1 }
    }
    console.log(email, JSON.stringify(Object.fromEntries(Object.entries(out).filter(([, v]) => v !== 0))))
  }
}
main().finally(() => p.$disconnect())
