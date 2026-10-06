/**
 * task-041 QA 정리 도구 — **QA 계정 3(`qa-bot3@thekaiwa.test`) 행만** 지운다(다른 계정·운영 사용자 거부, PRODUCTION 거부).
 *
 *   node --env-file=.env --import tsx tests/live/challenge-cleanup.ts            # 챌린지 행 전부 + 스모크 표식 행(periodKey·제목 접두 t041)
 *   node --env-file=.env --import tsx tests/live/challenge-cleanup.ts --review-decision-today
 *        # 5초 참고치 (가) 반복용: 오늘(KST) 만든 REVIEW_DECISION AiJob 행만 지운다 — 하루 첫 진입 A11 잡이 하루 1번뿐(decision.ts)이라
 *        #  다음 반복의 "오늘 탭 진입"이 다시 잡을 걸게 한다. 실행 중(QUEUED·RUNNING) 잡은 지우지 않는다(끝나기를 기다린다).
 *   ... --dry-run   # 지울 행 수만 출력
 *
 * 챌린지 레인의 다른 task(042 주제 세트·043·044)가 만든 세트·수업은 지우지 않는다 — 각 task 스모크가 자기 표식으로 정리한다.
 *
 * **삭제 범위 주의(REV-120 L-5)**: 기본 실행은 이 도구의 표식 행만이 아니라 **QA 계정 3 의 `Challenge` 행 전부**(다른 레인이 만든 진행 중
 * 챌린지 포함)를, `--review-decision-today` 는 **계정 3 의 오늘 끝난 REVIEW_DECISION 잡 전부**를 지운다. 같은 계정을 쓰는 다른 레인
 * (042·043·044 QA·challenge-smoke·challenge-ttfa)이 돌고 있지 않을 때만 실행한다 — 먼저 `--dry-run` 으로 수를 확인한다.
 */
import { prisma } from '../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../src/modules/infra/users'

const QA3 = 'qa-bot3@thekaiwa.test'
const MARK = 't041'
const args = new Set(process.argv.slice(2))
const dry = args.has('--dry-run')

async function main(): Promise<void> {
  if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
  // QA 계정 판정은 앱과 같은 규칙(`QA_USER_WHERE` — provider test + @thekaiwa.test)으로만 — 실사용자(Google)는 여기 걸리지 않는다.
  const user = await prisma.user.findFirst({ where: { AND: [{ email: QA3 }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다 — 중단')
  const userId = user.id
  if (args.has('--review-decision-today')) {
    const since = new Date(Date.parse(`${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}T00:00:00+09:00`))
    const where = { userId, kind: 'REVIEW_DECISION' as const, createdAt: { gte: since }, status: { notIn: ['QUEUED' as const, 'RUNNING' as const] } }
    const busy = await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION', status: { in: ['QUEUED', 'RUNNING'] } } })
    const n = dry ? await prisma.aiJob.count({ where }) : (await prisma.aiJob.deleteMany({ where })).count
    console.log(`[challenge-cleanup] REVIEW_DECISION 오늘 잡 ${dry ? '대상' : '삭제'} ${n}건${busy ? ` · 실행 중 ${busy}건(남김 — 끝난 뒤 다시)` : ''}`)
    return
  }
  const challenges = { userId }
  const snaps = { userId, kind: { in: ['LESSON' as const, 'VOCAB_SESSION' as const] }, periodKey: { startsWith: MARK } }
  const logs = { userId, summary: { startsWith: MARK } }
  const lessons = { userId, title: MARK }
  if (dry) {
    const [c, s, l, ls] = await Promise.all([prisma.challenge.count({ where: challenges }), prisma.statsSnapshot.count({ where: snaps }), prisma.studyLog.count({ where: logs }), prisma.lesson.count({ where: lessons })])
    console.log(`[challenge-cleanup] 대상 — Challenge ${c} · 표식 스냅샷 ${s} · 표식 기록 ${l} · 표식 수업 ${ls}`)
    return
  }
  const c = await prisma.challenge.deleteMany({ where: challenges })
  const s = await prisma.statsSnapshot.deleteMany({ where: snaps })
  const l = await prisma.studyLog.deleteMany({ where: logs })
  const ls = await prisma.lesson.deleteMany({ where: lessons })
  console.log(`[challenge-cleanup] 삭제 — Challenge ${c.count} · 표식 스냅샷 ${s.count} · 표식 기록 ${l.count} · 표식 수업 ${ls.count}`)
}

main()
  .catch((e) => {
    console.error('[challenge-cleanup] 실패:', e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
