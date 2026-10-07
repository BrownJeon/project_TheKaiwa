/**
 * qa-p2c-B — QA 계정 1·2·4 기준 상태 덤프/복원(StatsSnapshot 증가분 되돌림 포함).
 *   dump:    OUT=<경로> node --env-file=.env --import tsx tests/live/p2c-qa/b-state.ts dump
 *   restore: IN=<경로>  node --env-file=.env --import tsx tests/live/p2c-qa/b-state.ts restore [--dry-run]
 *   diff:    IN=<경로>  node --env-file=.env --import tsx tests/live/p2c-qa/b-state.ts diff
 * dump 는 계정별 모델 행 수 + StatsSnapshot 전 행(kind·periodKey·data). restore 는 dump 에 없던 StatsSnapshot 행 삭제 + 값이 달라진 행을 dump 값으로 되돌림.
 * 시드 상황·ScenarioTopic·다른 사용자 행은 건드리지 않는다. PRODUCTION 거부.
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const mode = process.argv[2]
const dry = process.argv.includes('--dry-run')
const prisma = new PrismaClient()
const EMAILS = ['qa-bot@thekaiwa.test', 'qa-bot2@thekaiwa.test', 'qa-bot4@thekaiwa.test']
type P = Record<string, { count: (a: unknown) => Promise<number> }>
const p = prisma as unknown as P
const MODELS: [string, string][] = [
  ['attendance', 'userId'], ['studyLog', 'userId'], ['repetitionItem', 'userId'], ['learningObservation', 'userId'], ['correction', 'userId'], ['chat', 'userId'],
  ['chatMessage', 'userId'], ['lesson', 'userId'], ['evaluation', 'userId'], ['utterance', 'userId'], ['aiJob', 'userId'], ['requestTrace', 'userId'],
  ['conversationTopic', 'userId'], ['scenario', 'userId'], ['statsSnapshot', 'userId'], ['wordEntry', 'userId'], ['vocabSession', 'userId'],
]
interface Dump { at: string; users: Record<string, { id: string; counts: Record<string, number>; snaps: { kind: string; periodKey: string; data: unknown }[] }> }

async function dump(): Promise<Dump> {
  const us = await prisma.user.findMany({ where: { email: { in: EMAILS }, provider: 'test' }, select: { id: true, email: true } })
  const out: Dump = { at: new Date().toISOString(), users: {} }
  for (const u of us) {
    const counts: Record<string, number> = {}
    for (const [m, k] of MODELS) {
      try { counts[m] = await p[m].count({ where: { [k]: u.id } }) } catch { counts[m] = -1 }
    }
    const snaps = await prisma.statsSnapshot.findMany({ where: { userId: u.id }, select: { kind: true, periodKey: true, data: true } })
    out.users[u.email] = { id: u.id, counts, snaps: snaps.map((s) => ({ kind: s.kind, periodKey: s.periodKey, data: s.data })) }
  }
  return out
}

;(async () => {
  if (mode === 'dump') {
    const d = await dump()
    const path = process.env.OUT ?? ''
    if (!path) throw new Error('OUT 필요')
    writeFileSync(path, JSON.stringify(d)); chmodSync(path, 0o600)
    console.log(`DUMP ${path} users=${Object.keys(d.users).length} ` + Object.entries(d.users).map(([e, v]) => `${e.split('@')[0]}:snaps=${v.snaps.length}`).join(' '))
  } else if (mode === 'diff' || mode === 'restore') {
    const base = JSON.parse(readFileSync(process.env.IN ?? '', 'utf8')) as Dump
    const now = await dump()
    for (const [email, b] of Object.entries(base.users)) {
      const n = now.users[email]
      if (!n) { console.log(`${email}: 계정 없음`); continue }
      const dc = Object.keys(b.counts).filter((m) => b.counts[m] !== n.counts[m]).map((m) => `${m} ${b.counts[m]}→${n.counts[m]}`)
      const bKey = new Map(b.snaps.map((s) => [`${s.kind}|${s.periodKey}`, JSON.stringify(s.data)]))
      const extra = n.snaps.filter((s) => !bKey.has(`${s.kind}|${s.periodKey}`))
      const changed = n.snaps.filter((s) => bKey.has(`${s.kind}|${s.periodKey}`) && bKey.get(`${s.kind}|${s.periodKey}`) !== JSON.stringify(s.data))
      console.log(`${email.split('@')[0]}: 행수 차이 ${dc.length ? dc.join(', ') : '없음'} · 새 스냅샷 ${extra.length} · 값 변경 스냅샷 ${changed.length}`)
      if (mode === 'restore' && !dry) {
        for (const s of extra) await prisma.statsSnapshot.delete({ where: { userId_kind_periodKey: { userId: b.id, kind: s.kind as never, periodKey: s.periodKey } } })
        for (const s of changed) {
          const orig = b.snaps.find((x) => x.kind === s.kind && x.periodKey === s.periodKey)
          if (orig) await prisma.statsSnapshot.update({ where: { userId_kind_periodKey: { userId: b.id, kind: s.kind as never, periodKey: s.periodKey } }, data: { data: orig.data as Prisma.InputJsonValue } })
        }
        if (extra.length || changed.length) console.log(`  → 스냅샷 복원: 삭제 ${extra.length} · 되돌림 ${changed.length}`)
      }
    }
  } else throw new Error('mode: dump|diff|restore')
  await prisma.$disconnect()
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
