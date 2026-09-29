/**
 * task-012c 서버 2단계 Codex C2 ②·REV-036 L2 실측 — 연결 끄기 ↔ Fallback 정책 편집의 교차 행 경합을 **실제 MariaDB**(개발·운영 공유)에서
 * 한 프로세스의 여러 DB 연결로 인터리빙한다(task012b-race 방식 — 서버·LLM 없음, admin 모듈 함수를 직접 부른다). LOCAL REALTIME_STT 만.
 *
 *  D1 다른 연결이 연결 B 를 잠근 채(끄는 중) → 정책 편집(primary=B)이 B 잠금을 기다린다 → B 끄기 커밋 → 정책 편집은 재검증에서 400 DEPENDENCY(쓰기 0)
 *  D2 다른 연결이 정책 편집을 전역 순서대로(연결 A·B → 정책 P) 잠근 채 primary=B 로 바꾸는 중 → B 끄기가 B 잠금을 기다린다 → 커밋 → B 끄기는
 *     정책 재확인에서 409 PRIMARY_IN_USE(쓰기 0). (순서를 어겨 정책부터 잠그면 `primary` 외래 키 확인이 B 공유 잠금을 요구해 교착한다 — 첫 실측에서 확인)
 *  R1 무작위 인터리빙 N회 — B 끄기 ∥ 정책(primary=B, fallback=[A]): 결과는 성공 1·거절 1, 불변식(켜진 정책의 주 연결은 켜져 있다) 유지
 *  R2 반대 잠금 순서 3자 N회 — A 끄기 ∥ B 끄기 ∥ 정책(primary=B, fallback=[A] — 후보 id 순서가 잠금 순서와 반대): 교착·타임아웃·500 0, 불변식 유지
 *  교착 수는 전역 상태 `Innodb_deadlocks` 증가분(같은 DB 를 쓰는 다른 앱 것도 섞일 수 있어 0 이 아니면 원인을 따로 본다).
 *
 * 실행(미러·복제본): `node --env-file=.env --import tsx tests/live/task012c-race.ts [반복=10]`. 시작 전 LOCAL 연결 2행·정책 1행을 기록하고
 * 끝에 바이트 원복·대조, 이 실행이 만든 ConfigurationVersion 은 지운다. **AuditLog 는 남는다**(불변 — QA 역할 계정 행).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../../src/modules/infra'
import { setConnectionEnabled, updateFallbackPolicy, type AdminActor } from '../../src/modules/admin'
import { ApiError } from '../../src/modules/infra'

if ((process.env.APP_ENV ?? 'LOCAL').toUpperCase() !== 'LOCAL') throw new Error('이 실측은 APP_ENV=LOCAL 에서만 돈다')
const N = Number(process.argv[2] ?? 10)
const MARK = '두루미012c경합'
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const COLS = { connection: true, runtime: true, credentialRef: true, logLevel: true, enabled: true, status: true, statusReason: true, lastHealthAt: true, lastFunctionalAt: true } as const

type Outcome = { status: number; reason: string | null; ms: number }
async function outcome(p: Promise<{ changed: boolean }>): Promise<Outcome> {
  const t0 = Date.now()
  try {
    const r = await p
    return { status: r.changed ? 201 : 200, reason: null, ms: Date.now() - t0 }
  } catch (e) {
    if (e instanceof ApiError) {
      const status = e.code === 'VALIDATION' ? 400 : e.code === 'CONFLICT' ? 409 : e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : 422
      const stage = e.details?.stage as string | undefined
      return { status, reason: (e.details?.reason as string | undefined) ?? stage ?? e.code, ms: Date.now() - t0 }
    }
    return { status: 500, reason: e instanceof Error ? `${e.name}:${(e as { code?: string }).code ?? ''}:${e.message.slice(0, 80)}` : String(e), ms: Date.now() - t0 }
  }
}
const fmt = (o: Outcome) => `${o.status}${o.reason ? `/${o.reason}` : ''}(${o.ms}ms)`

async function deadlocks(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ Variable_name: string; Value: string }[]>("SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'")
    return rows[0] ? Number(rows[0].Value) : null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  const startedAt = new Date()
  const policy = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { environment_role: { environment: 'LOCAL', role: 'REALTIME_STT' } } })
  const A = policy.primaryConnectionId
  const fb = (policy.fallbackConnectionIds as string[] | null) ?? []
  if (fb.length !== 1) throw new Error(`LOCAL REALTIME_STT 정책의 예비 연결이 1개가 아니다(${fb.length}) — 전제 확인`)
  const B = fb[0]
  const base = await prisma.engineConnection.findMany({ where: { id: { in: [A, B] } }, select: { id: true, key: true, ...COLS } })
  if (base.length !== 2 || !base.every((c) => c.enabled)) throw new Error('A·B 연결이 둘 다 켜져 있어야 한다')
  const targets = [A, B, policy.id]
  if ((await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: { in: targets } } })) > 0) throw new Error('대상에 설정 버전이 이미 있다 — 이전 실행 잔여 확인')
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-admin@thekaiwa.test' }, select: { id: true, email: true } })
  const actor: AdminActor = { id: qa.id, email: qa.email, name: null, role: 'ADMIN', capabilities: [], environment: 'LOCAL', ip: null }
  const keyOf = (id: string) => base.find((c) => c.id === id)!.key
  console.log(`기준선: REALTIME_STT 정책 primary=${keyOf(A)} fallback=[${keyOf(B)}] · 반복 ${N} · 시작 ${startedAt.toISOString()}`)

  const ver = async (targetId: string) => (await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId, status: 'ACTIVE' }, select: { version: true } }))?.version ?? 0
  const reset = async () => {
    for (const c of base) {
      const { id, key: _k, ...cols } = c
      void _k
      await prisma.engineConnection.update({ where: { id }, data: { ...cols, connection: (cols.connection ?? Prisma.JsonNull) as Prisma.InputJsonValue, runtime: (cols.runtime ?? Prisma.JsonNull) as Prisma.InputJsonValue } })
    }
    await prisma.engineFallbackPolicy.update({ where: { id: policy.id }, data: { primaryConnectionId: A, fallbackConnectionIds: [B], retryOnce: policy.retryOnce, enabled: policy.enabled } })
    // 행을 기준선으로 되돌렸으니 ACTIVE 버전도 없앤다(다음 라운드는 다시 "첫 적용" — baseVersion 0).
    await prisma.configurationVersion.deleteMany({ where: { environment: 'LOCAL', targetId: { in: targets } } })
  }
  const invariant = async (): Promise<string | null> => {
    const p = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: policy.id } })
    const prim = await prisma.engineConnection.findUniqueOrThrow({ where: { id: p.primaryConnectionId } })
    return p.enabled && !prim.enabled ? `켜진 정책의 주 연결(${prim.key})이 꺼져 있다` : null
  }
  const disable = async (id: string) => outcome(setConnectionEnabled(actor, id, { enabled: false, baseVersion: await ver(id), reason: `${MARK} 끄기` }))
  const swap = async () => outcome(updateFallbackPolicy(actor, 'REALTIME_STT', { primaryConnectionId: B, fallbackConnectionIds: [A], baseVersion: await ver(policy.id), reason: `${MARK} 주 연결 교체` }))
  const dl0 = await deadlocks()

  try {
    // ── D1: B 를 잠근 채 끄는 중 → 정책 편집은 B 잠금을 기다렸다가 재검증에서 거절 ─────────────────
    await reset()
    {
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      let locked!: () => void
      const lockedP = new Promise<void>((r) => (locked = r))
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM EngineConnection WHERE id = ${B} FOR UPDATE`
          locked()
          await gate
          await tx.engineConnection.update({ where: { id: B }, data: { enabled: false, status: 'DISABLED' } })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
      )
      await lockedP
      let done = false
      const edit = swap().then((o) => ((done = true), o))
      await sleep(1_500)
      const waited = !done
      release()
      await holder
      const o = await edit
      const p = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: policy.id } })
      check('D1 연결 B 끄는 중(행 잠금) → 정책 편집(primary=B)은 B 잠금을 기다림 → 커밋 뒤 재검증 400 DEPENDENCY · 정책 불변', waited && o.status === 400 && o.reason === 'DEPENDENCY' && p.primaryConnectionId === A, `waited=${waited} ${fmt(o)} primary=${keyOf(p.primaryConnectionId)}`)
    }
    // ── D2: 정책을 잠근 채 primary=B 로 바꾸는 중 → B 끄기는 정책 잠금을 기다렸다가 PRIMARY_IN_USE ─────────
    await reset()
    {
      let release!: () => void
      const gate = new Promise<void>((r) => (release = r))
      let locked!: () => void
      const lockedP = new Promise<void>((r) => (locked = r))
      const holder = prisma.$transaction(
        async (tx) => {
          for (const id of [A, B].sort()) await tx.$queryRaw`SELECT id FROM EngineConnection WHERE id = ${id} FOR UPDATE`
          await tx.$queryRaw`SELECT id FROM EngineFallbackPolicy WHERE id = ${policy.id} FOR UPDATE`
          locked()
          await gate
          await tx.engineFallbackPolicy.update({ where: { id: policy.id }, data: { primaryConnectionId: B, fallbackConnectionIds: [A] } })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
      )
      await lockedP
      let done = false
      const off = disable(B).then((o) => ((done = true), o))
      await sleep(1_500)
      const waited = !done
      release()
      await holder
      const o = await off
      const b = await prisma.engineConnection.findUniqueOrThrow({ where: { id: B } })
      check('D2 정책 편집 중(연결 A·B → 정책 잠금) → B 끄기는 잠금을 기다림 → 커밋 뒤 정책 재확인 409 PRIMARY_IN_USE · B 켜진 그대로', waited && o.status === 409 && o.reason === 'PRIMARY_IN_USE' && b.enabled, `waited=${waited} ${fmt(o)} enabled=${b.enabled}`)
    }

    // ── R1: B 끄기 ∥ 정책 primary=B 무작위 인터리빙 ─────────────────────────────
    const r1: string[] = []
    let r1bad = 0
    for (let i = 0; i < N; i++) {
      await reset()
      const delay = Math.floor(Math.random() * 40)
      const first = i % 2 === 0
      const [o1, o2] = await Promise.all([first ? disable(B) : sleep(delay).then(() => disable(B)), first ? sleep(delay).then(swap) : swap()])
      const inv = await invariant()
      const oneWon = [o1, o2].filter((o) => o.status === 201).length === 1
      const loserOk = [o1, o2].every((o) => o.status === 201 || (o.status === 400 && o.reason === 'DEPENDENCY') || (o.status === 409 && o.reason === 'PRIMARY_IN_USE'))
      if (inv || !oneWon || !loserOk) r1bad++
      r1.push(`${fmt(o1)}|${fmt(o2)}${inv ? ` !${inv}` : ''}`)
    }
    check(`R1 B 끄기 ∥ 정책(primary=B) ${N}회 — 매번 성공 1·거절 1(400 DEPENDENCY 또는 409 PRIMARY_IN_USE), 불변식 유지`, r1bad === 0, r1.slice(0, 4).join(' · ') + (r1.length > 4 ? ' …' : ''))

    // ── R2: 반대 잠금 순서 3자 ────────────────────────────────────────────
    const r2: string[] = []
    let r2bad = 0
    let maxMs = 0
    for (let i = 0; i < N; i++) {
      await reset()
      const jitter = () => sleep(Math.floor(Math.random() * 30))
      const os = await Promise.all([jitter().then(() => disable(A)), jitter().then(() => disable(B)), jitter().then(swap)])
      const inv = await invariant()
      const bad = os.some((o) => o.status === 500 || o.status === 403 || o.status === 404)
      maxMs = Math.max(maxMs, ...os.map((o) => o.ms))
      if (inv || bad) r2bad++
      r2.push(`${os.map(fmt).join('|')}${inv ? ` !${inv}` : ''}`)
    }
    const dl1 = await deadlocks()
    check(`R2 A 끄기 ∥ B 끄기 ∥ 정책(primary=B, fallback=[A]) ${N}회 — 500·잠금 대기 초과 0, 불변식 유지, 최장 ${maxMs}ms`, r2bad === 0 && maxMs < 10_000, r2.slice(0, 3).join(' · ') + (r2.length > 3 ? ' …' : ''))
    check('R3 전역 Innodb_deadlocks 증가분 0(이 실행 동안 — 같은 DB 다른 앱 것도 포함한 값)', dl0 === null || dl1 === null ? true : dl1 - dl0 === 0, dl0 === null || dl1 === null ? '상태 변수 조회 불가 — 판정 생략' : `${dl0} → ${dl1}`)
  } finally {
    await reset()
    const after = await prisma.engineConnection.findMany({ where: { id: { in: [A, B] } }, select: { id: true, key: true, ...COLS } })
    const pol = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: policy.id } })
    const same = base.every((b) => JSON.stringify(b) === JSON.stringify(after.find((a) => a.id === b.id))) && pol.primaryConnectionId === A && JSON.stringify(pol.fallbackConnectionIds) === JSON.stringify([B]) && pol.enabled === policy.enabled && pol.retryOnce === policy.retryOnce
    const left = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: { in: targets } } })
    const audits = await prisma.auditLog.count({ where: { environment: 'LOCAL', targetId: { in: targets }, createdAt: { gte: startedAt } } })
    check('Z 원복 — 연결 2행·정책 바이트 동일, 설정 버전 0(감사 행은 불변이라 남음)', same && left === 0, `audits=${audits}`)
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.name.split(' ')[0]).join(', ')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}

main()
  .catch((e) => {
    console.error('실측 중단:', e instanceof Error ? e.message : e)
    process.exitCode = 2
  })
  .finally(() => prisma.$disconnect())
