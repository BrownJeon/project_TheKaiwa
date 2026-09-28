/**
 * task-012b Codex C2 지적 1(디바운스 ↔ claim TOCTOU) 실측 — **실제 MariaDB**(개발·운영 공유), QA 계정(qa-bot2)만. 한 프로세스의 여러 DB 연결로
 * "새 발화 저장(디바운스 포함)"과 "claim" 트랜잭션을 인터리빙해, 대화 중(마지막 발화 +20초 안) 옛 잡이 RUNNING 으로 올라가지 않는지 본다.
 * 서버·워커·LLM 없음(모듈 함수를 직접 부른다). APP_ENV≠PRODUCTION 이라 claim 은 QA 계정 잡만 본다(D-B11).
 *
 *  S1 커밋된 새 발화(디바운스가 옛 잡을 못 민 상황 — 발화 행만 직접 INSERT) → claim → 옛 잡 QUEUED 유지·runAfter = 발화+20초(재검사)
 *  S2 발화 트랜잭션이 디바운스 UPDATE 로 옛 잡 행을 잡은 채(커밋 전) → 다른 연결의 claim → SKIP LOCKED 로 건너뜀 → 커밋 뒤 옛 잡 runAfter +20초
 *  S3 claim 이 먼저 잠근 채 → 발화 저장(실제 utteranceDb.create)이 디바운스에서 대기 → claim 커밋(옛 잡 RUNNING — claim 이 먼저였다) → 발화 저장 완료(교착 없음)
 *  S4 무작위 인터리빙 N회(실제 utteranceDb.create ∥ claimAnalysisJobs) — 불변식: 발화 저장이 claim 시작 전에 끝났으면 옛 잡은 RUNNING 이 아니다 · 오류·교착 0
 *
 * 실행(미러): `node --env-file=.env --import tsx tests/live/task012b-race.ts [반복=20]`. 만든 발화·잡은 끝에 지운다. 다른 잡이 큐에 있으면 시작하지 않는다.
 */
import { randomBytes } from 'node:crypto'
import { prisma, withTransaction } from '../../src/modules/infra'
import { analysisDb } from '../../src/modules/speech/analysis/db'
import { claimAnalysisJobs, lockClaimable } from '../../src/modules/speech/analysis/jobs'
import { utteranceDb } from '../../src/modules/speech/utterances/store'

if ((process.env.APP_ENV ?? 'LOCAL').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 에서는 돌리지 않는다')
const N = Number(process.argv[2] ?? 20)
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const made = new Set<string>()
let uid = ''
let sttKey = ''
const id = () => `c${Date.now().toString(36).slice(-8)}${Array.from(randomBytes(16), (b) => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('')}`

/** 앞 시나리오가 만든 발화를 1분 전으로 — 시나리오마다 "대화가 멈춘 상태"에서 시작한다(재검사가 앞 발화를 보고 미루지 않게). */
const quiet = () => prisma.utterance.updateMany({ where: { id: { in: [...made] }, userId: uid }, data: { createdAt: new Date(Date.now() - 60_000) } })

/** 옛 잡: 발화·잡 모두 1분 전, runAfter 는 이미 지남(대화가 멈췄던 상태). */
async function oldJob(): Promise<string> {
  await quiet()
  const t = new Date(Date.now() - 60_000)
  const u = await prisma.utterance.create({
    data: { id: id(), userId: uid, durationMs: 900, realtimeEngine: sttKey, realtimeText: 'ふるい', finalText: 'ふるい', status: 'QUEUED', createdAt: t, jobs: { create: { userId: uid, kind: 'ANALYSIS_STT', runAfter: new Date(Date.now() - 1_000), createdAt: t } } },
    select: { id: true },
  })
  made.add(u.id)
  return (await prisma.speechJob.findFirstOrThrow({ where: { utteranceId: u.id }, select: { id: true } })).id
}

/** 새 발화 입력(분석 잡 포함 — utteranceDb.create 가 디바운스를 같은 트랜잭션에서 먼저 한다). */
function newUtteranceData(now: Date) {
  const uidNew = id()
  made.add(uidNew)
  return {
    id: uidNew,
    userId: uid,
    durationMs: 900,
    realtimeEngine: sttKey,
    realtimeText: 'あたらしい',
    finalText: 'あたらしい',
    status: 'QUEUED' as const,
    createdAt: now,
    jobs: { create: { userId: uid, kind: 'ANALYSIS_STT' as const, runAfter: new Date(now.getTime() + 20_000), createdAt: now } },
  }
}

const job = (jobId: string) => prisma.speechJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true, runAfter: true, lockedBy: true } })
const retire = (jobId: string) => prisma.speechJob.updateMany({ where: { id: jobId }, data: { status: 'FAILED', error: 'RACE_CLEAR', finishedAt: new Date() } })
const claimOnce = (workerId: string) => claimAnalysisJobs({ workerId, kinds: ['ANALYSIS_STT'], max: 1 })

async function s1(): Promise<void> {
  const j0 = await oldJob()
  const now = new Date()
  const u = await prisma.utterance.create({ data: { id: id(), userId: uid, durationMs: 900, realtimeEngine: sttKey, realtimeText: 'いまはなした', createdAt: now }, select: { id: true } })
  made.add(u.id)
  const r = await claimOnce('race-s1')
  const row = await job(j0)
  check('S1 커밋된 새 발화(디바운스 없이) → claim 이 옛 잡을 올리지 않고 미룸(재검사)', !r.jobs.some((j) => j.id === j0) && row.status === 'QUEUED' && Math.abs(row.runAfter.getTime() - (now.getTime() + 20_000)) < 1_000,
    `claimed=${r.jobs.length} status=${row.status} Δ=${row.runAfter.getTime() - now.getTime()}`)
  await retire(j0)
}

async function s2(): Promise<void> {
  const j0 = await oldJob()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let locked!: () => void
  const lockedP = new Promise<void>((r) => (locked = r))
  const now = new Date()
  const saving = withTransaction(async (tx) => {
    await analysisDb.debounce(tx, uid, now)
    locked()
    await gate
    return tx.utterance.create({ data: newUtteranceData(now), select: { id: true } })
  })
  await lockedP
  const t0 = Date.now()
  const r = await claimOnce('race-s2')
  const claimMs = Date.now() - t0
  release()
  await saving
  const row = await job(j0)
  check('S2 발화 트랜잭션이 옛 잡을 잠근 채(커밋 전) claim → SKIP LOCKED 로 건너뜀(대기 없음) → 커밋 뒤 옛 잡 runAfter +20초', !r.jobs.some((j) => j.id === j0) && row.status === 'QUEUED' && Math.abs(row.runAfter.getTime() - (now.getTime() + 20_000)) < 1_000 && claimMs < 3_000,
    `claimed=${r.jobs.length} claimMs=${claimMs} status=${row.status} Δ=${row.runAfter.getTime() - now.getTime()}`)
  await retire(j0)
}

async function s3(): Promise<void> {
  const j0 = await oldJob()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let locked!: () => void
  const lockedP = new Promise<void>((r) => (locked = r))
  const now = new Date()
  const claiming = withTransaction(async (tx) => {
    const ids = await lockClaimable(tx, { workerId: 'race-s3', kinds: ['ANALYSIS_STT'], max: 1 }, now, [uid])
    locked()
    await gate
    await analysisDb.markRunning(tx, ids, 'race-s3', now)
    return ids
  })
  await lockedP
  const saveStart = Date.now()
  const saving = utteranceDb.create(newUtteranceData(new Date()))
  await sleep(300)
  release()
  const [ids] = await Promise.all([claiming, saving])
  const row = await job(j0)
  check('S3 claim 이 먼저 잠근 채 발화 저장 → 저장은 디바운스에서 기다렸다가 끝남(교착 없음) · 옛 잡은 claim 이 가져감(RUNNING — claim 이 발화보다 먼저)', ids.includes(j0) && row.status === 'RUNNING' && row.lockedBy === 'race-s3' && Date.now() - saveStart >= 300,
    `ids=${ids.length} status=${row.status}`)
  await retire(j0)
}

async function s4(): Promise<void> {
  let violations = 0
  let errors = 0
  const outcome = { claimedOld: 0, deferredOrSkipped: 0, createdFirst: 0 }
  for (let i = 0; i < N; i++) {
    const j0 = await oldJob()
    let createdAt = 0
    let claimStart = 0
    const a = Math.floor(Math.random() * 60)
    const b = Math.floor(Math.random() * 400)
    try {
      const [, r] = await Promise.all([
        sleep(a).then(async () => {
          await utteranceDb.create(newUtteranceData(new Date()))
          createdAt = Date.now()
        }),
        sleep(b).then(async () => {
          claimStart = Date.now()
          return claimOnce(`race-s4-${i}`)
        }),
      ])
      const got = r.jobs.some((j) => j.id === j0)
      if (createdAt && createdAt < claimStart) {
        outcome.createdFirst++
        if (got) violations++
      }
      if (got) outcome.claimedOld++
      else outcome.deferredOrSkipped++
    } catch (e) {
      errors++
      console.log(`  ! S4 ${i}: ${e instanceof Error ? e.name : 'error'}`)
    }
    await retire(j0)
    await prisma.speechJob.updateMany({ where: { userId: uid, status: 'QUEUED' }, data: { status: 'FAILED', error: 'RACE_CLEAR', finishedAt: new Date() } })
  }
  check(`S4 무작위 인터리빙 ${N}회 — 발화 저장이 claim 시작 전에 끝났는데 옛 잡을 올린 경우 0 · 오류·교착 0`, violations === 0 && errors === 0, JSON.stringify({ ...outcome, violations, errors }))
}

async function main(): Promise<void> {
  uid = (await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true } })).id
  sttKey = (await prisma.engineConnection.findFirst({ where: { environment: 'LOCAL', role: 'REALTIME_STT' }, select: { key: true } }))?.key ?? 'race'
  const foreign = await prisma.speechJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } })
  if (foreign) throw new Error(`큐에 다른 잡 ${foreign}건 — 끝난 뒤 다시`)
  try {
    await s1()
    await s2()
    await s3()
    await s4()
  } finally {
    await prisma.utterance.deleteMany({ where: { id: { in: [...made] }, userId: uid } })
    await prisma.$disconnect()
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n[task012b race] ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error('[task012b race] 중단:', e instanceof Error ? e.message.slice(0, 300) : String(e))
  process.exitCode = 1
})
