/**
 * qa-p2b 최종 정리 — QA 계정 3(`qa-bot3@thekaiwa.test`)이 SINCE 이후 만든 행만 지운다(시작 전 계정 3 은 전 행 0 이었음 — `p2a-qa/qa-state.ts`).
 * 시드·실사용자·다른 계정 행은 건드리지 않는다(QA_USER_WHERE 로 계정 규칙 확인). 챗 방은 앱 API 와 같은 규칙으로 DB 에서 직접 지운다(메시지는 관계 규칙에 따름).
 *   SINCE=<ISO> node --env-file=.env --import tsx tests/live/p2b-qa/final-clean.ts [--dry-run]
 */
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const SINCE = new Date(process.env.SINCE ?? '')
if (Number.isNaN(SINCE.getTime())) throw new Error('SINCE=<ISO 시각> 필요')
const dry = process.argv.includes('--dry-run')

async function main(): Promise<void> {
  const u = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!u) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다')
  const userId = u.id
  const out: Record<string, number> = {}
  const run = async (name: string, count: () => Promise<number>, del: () => Promise<{ count: number }>): Promise<void> => {
    out[name] = dry ? await count() : (await del()).count
  }
  const created = { userId, createdAt: { gte: SINCE } }
  const sess = (await prisma.vocabSession.findMany({ where: { userId, startedAt: { gte: SINCE } }, select: { id: true } })).map((r) => r.id)
  await run('vocabAttempt', () => prisma.vocabAttempt.count({ where: { sessionId: { in: sess } } }), () => prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sess } } }))
  await run('vocabSession', () => prisma.vocabSession.count({ where: { id: { in: sess } } }), () => prisma.vocabSession.deleteMany({ where: { id: { in: sess } } }))
  await run('challenge', () => prisma.challenge.count({ where: created }), () => prisma.challenge.deleteMany({ where: created }))
  await run('studyLog', () => prisma.studyLog.count({ where: created }), () => prisma.studyLog.deleteMany({ where: created }))
  await run('statsSnapshot', () => prisma.statsSnapshot.count({ where: created }), () => prisma.statsSnapshot.deleteMany({ where: created }))
  await run('learningObservation', () => prisma.learningObservation.count({ where: { userId, occurredAt: { gte: SINCE } } }), () => prisma.learningObservation.deleteMany({ where: { userId, occurredAt: { gte: SINCE } } }))
  await run('repetitionItem', () => prisma.repetitionItem.count({ where: created }), () => prisma.repetitionItem.deleteMany({ where: created }))
  await run('wordEntry', () => prisma.wordEntry.count({ where: created }), () => prisma.wordEntry.deleteMany({ where: created }))
  const lessons = (await prisma.lesson.findMany({ where: created, select: { id: true } })).map((r) => r.id)
  await run('reviewSchedule', () => prisma.reviewSchedule.count({ where: { lessonId: { in: lessons } } }), () => prisma.reviewSchedule.deleteMany({ where: { lessonId: { in: lessons } } }))
  await run('lesson', () => prisma.lesson.count({ where: { id: { in: lessons } } }), () => prisma.lesson.deleteMany({ where: { id: { in: lessons } } }))
  await run('aiJob', () => prisma.aiJob.count({ where: created }), () => prisma.aiJob.deleteMany({ where: created }))
  await run('requestTrace', () => prisma.requestTrace.count({ where: created }), () => prisma.requestTrace.deleteMany({ where: created }))
  await run('chat', () => prisma.chat.count({ where: created }), () => prisma.chat.deleteMany({ where: created }))
  out.ttsCacheSince = await prisma.ttsCache.count({ where: { createdAt: { gte: SINCE } } })
  console.log(`${dry ? '[dry-run] 대상' : '삭제'} ${JSON.stringify(out)}`)
  const left = {
    challenges: await prisma.challenge.count({ where: { userId } }), vocabSessions: await prisma.vocabSession.count({ where: { userId } }), lessons: await prisma.lesson.count({ where: { userId } }),
    snapshots: await prisma.statsSnapshot.count({ where: { userId } }), repetitionItems: await prisma.repetitionItem.count({ where: { userId } }), aiJobs: await prisma.aiJob.count({ where: { userId } }),
    traces: await prisma.requestTrace.count({ where: { userId } }), chats: await prisma.chat.count({ where: { userId } }), observations: await prisma.learningObservation.count({ where: { userId } }),
    wordEntries: await prisma.wordEntry.count({ where: { userId } }), studyLogs: await prisma.studyLog.count({ where: { userId } }),
  }
  console.log(`계정 3 남은 행 ${JSON.stringify(left)}`)
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
