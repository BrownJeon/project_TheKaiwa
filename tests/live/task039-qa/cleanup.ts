/* eslint-disable @typescript-eslint/no-explicit-any */
// task-039 QA 정리 — QA 계정 1·2(qa-bot·qa-bot2, QA_USER_WHERE)가 SINCE 이후 만든 행만 지운다. DRY=1 이면 세기만. PRODUCTION 거부.
import { PrismaClient } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'
const p = new PrismaClient() as any
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 거부')
const SINCE = new Date(process.env.SINCE!)
const DRY = process.env.DRY === '1'
const TODAY_KEYS = (process.env.PERIOD_FROM ?? '2026-10-06')
// [model, 시각 칸]
const PLAN: [string, string][] = [
  ['tutorProposal', 'createdAt'], ['chat', 'createdAt'], ['wordEntry', 'createdAt'], ['studyLog', 'createdAt'], ['learnerErrorStat', 'firstAt'],
  ['aiJob', 'createdAt'], ['requestTrace', 'createdAt'], ['learningObservation', 'occurredAt'], ['repetitionItem', 'createdAt'], ['attendance', 'checkedInAt'],
  ['utterance', 'createdAt'], ['lesson', 'createdAt'], ['vocabSession', 'startedAt'], ['evaluation', 'createdAt'], ['reviewSchedule', 'createdAt'],
]
async function main() {
  for (const email of ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test']) {
    const u = await p.user.findFirst({ where: { AND: [{ email }, QA_USER_WHERE] }, select: { id: true } })
    if (!u) continue
    const rep: Record<string, number> = {}
    for (const [m, f] of PLAN) {
      try {
        const where = { userId: u.id, [f]: { gte: SINCE } }
        const n = await p[m].count({ where })
        if (n && !DRY) await p[m].deleteMany({ where })
        if (n) rep[m] = n
      } catch { rep[m] = -1 }
    }
    // StatsSnapshot: 이 세션에서 생긴 날짜 행(periodKey >= 오늘, DAILY) — 기존 행(10-03·10-05)은 건드리지 않는다.
    const sw = { userId: u.id, kind: 'DAILY', periodKey: { gte: TODAY_KEYS } }
    const sn = await p.statsSnapshot.count({ where: sw })
    if (sn && !DRY) await p.statsSnapshot.deleteMany({ where: sw })
    if (sn) rep.statsSnapshotDAILY = sn
    console.log(`${DRY ? '[DRY] ' : ''}${email} 삭제 ${JSON.stringify(rep)}`)
  }
}
main().finally(() => p.$disconnect())
