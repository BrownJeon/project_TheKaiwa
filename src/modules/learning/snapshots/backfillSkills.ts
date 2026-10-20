/**
 * DAILY `data.skills` 과거 백필(task-080, docs/screens.md §36-8) — `scripts/backfill-growth-skills.ts` 가 쓰는 계산·실행부.
 *
 * - 규칙 = 다시 세어 모자란 만큼만 더하기(top-up): 행(사용자×날짜)마다 그 날짜로 묶이는 관측을 `growthSkillDelta` 로 다시 센 R 과
 *   지금 칸 C 를 비교해 칸마다 `max(0, R − C)` 만 더한다(증가만 — StatsSnapshot 규칙 2). R < C 칸은 «어긋남»으로만 센다. 다시 실행하면 0건.
 * - 날짜 묶기 = 실시간 쓰기와 같은 날: `VocabAttempt` 관측은 그 세트의 `VocabSession.date`(원본이 지워졌으면 `occurredAt` 의 KST 날짜),
 *   그 밖은 `occurredAt` 의 KST 날짜.
 * - 실행(apply)은 사용자마다 트랜잭션 하나 — `lockUserRow` → (사용자 잠금 뒤라 관측이 더 늘지 않는 상태에서) 다시 읽고 다시 계산 →
 *   더할 날짜의 DAILY 행 `FOR UPDATE` → 잠근 뒤 다시 읽은 `data` 에 병합 → 갱신. 기존 쓰기(`recordObservations`)와 같은 잠금 순서다.
 * - **DAILY 행이 없는 (사용자×날짜)는 만들지 않는다**(Leader 결정 2026-10-21) — 실제 흐름은 관측과 DAILY 를 한 트랜잭션에서 올리므로
 *   «행 없음» 은 시험 정리 잔여분 같은 비정상이다. 만들면 공부결과 숫자와 `since`(가장 이른 DAILY)를 오염시킨다 → «건너뜀(행 없음)» 으로만 센다.
 * - 보고서에는 숫자만 — 계정은 순번(#1~#n), userId·이름·이메일·대화 내용은 넣지 않는다(백업 파일만 복원용으로 userId·행 id 를 담는다).
 */
import type { ObservationKind, ObservationOutcome, Prisma, SkillAxis } from '@prisma/client'
import { dates, lockUserRow, type Tx } from '@/modules/infra'
import { GROWTH_AXES, type GrowthAxis } from '@/types/plan'
import { GROWTH_SKILL_OF_KIND, growthSkillDelta } from '../observations'
import { mergeDaily, mergeSkills, SKILL_COUNT_KEYS, type DailySkillsDelta, type GrowthSkillCounts } from './index'
import { GROWTH_AXIS_RECORDED, GROWTH_THRESHOLDS, growthRange, isOneSided, judgedCount, skillStage } from './growth'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** `growthSkillDelta` 가 세는 kind 만 읽는다(나머지는 다시 세도 0). */
export const BACKFILL_GROWTH_KINDS = Object.keys(GROWTH_SKILL_OF_KIND) as ObservationKind[]
export const BACKFILL_ATTEMPT_CHUNK = 500
/** 사용자 한 명의 적용 트랜잭션 상한 — 사용자 행을 잠그므로 길게 두지 않는다. */
export const BACKFILL_TX_TIMEOUT_MS = 60_000

export interface BackfillObservation {
  kind: ObservationKind
  outcome: ObservationOutcome
  skill: SkillAxis
  confidence: number
  refType: string
  refId: string
  occurredAt: Date
}

export type DateSource = 'session' | 'fallback' | 'occurredAt'

/** 관측 1건의 DAILY 날짜 — 실시간 쓰기와 같은 날(`attemptDate` = 이 사용자의 VocabAttempt id → 세트 날짜). */
export function observationDailyDate(o: Pick<BackfillObservation, 'refType' | 'refId' | 'occurredAt'>, attemptDate: ReadonlyMap<string, string>): { date: string; source: DateSource } {
  if (o.refType === 'VocabAttempt') {
    const d = attemptDate.get(o.refId)
    return d ? { date: d, source: 'session' } : { date: dates.todayKst(o.occurredAt), source: 'fallback' }
  }
  return { date: dates.todayKst(o.occurredAt), source: 'occurredAt' }
}

export interface BucketStats {
  /** 세트 날짜로 묶은 단어 카드 관측 수 · 그중 세트 날짜 ≠ occurredAt 날짜(자정 넘김) 수. */
  session: number
  shifted: number
  /** 세트가 지워져 occurredAt 날짜로 묶은 단어 카드 관측 수. */
  fallback: number
  /** 그 밖(occurredAt 날짜). */
  occurredAt: number
}

/** 날짜별 다시 센 값 R(빈 날은 넣지 않는다). */
export function recountByDate(observations: readonly BackfillObservation[], attemptDate: ReadonlyMap<string, string>): { recount: Map<string, DailySkillsDelta>; stats: BucketStats } {
  const byDate = new Map<string, BackfillObservation[]>()
  const stats: BucketStats = { session: 0, shifted: 0, fallback: 0, occurredAt: 0 }
  for (const o of observations) {
    const { date, source } = observationDailyDate(o, attemptDate)
    stats[source]++
    if (source === 'session' && date !== dates.todayKst(o.occurredAt)) stats.shifted++
    const list = byDate.get(date)
    if (list) list.push(o)
    else byDate.set(date, [o])
  }
  const recount = new Map<string, DailySkillsDelta>()
  for (const [date, rows] of byDate) {
    const delta = growthSkillDelta(rows)
    if (Object.keys(delta).length > 0) recount.set(date, delta)
  }
  return { recount, stats }
}

export interface TopUpResult {
  add: DailySkillsDelta
  /** 더할 관측 수(칸 증가분 합 — `fromCorrection` 은 관측의 부분 수라 넣지 않는다). */
  added: number
  /** 더할 `fromCorrection` 합 — 옛 행(칸 없음)은 관측 칸이 맞아도 이것만 모자랄 수 있다. */
  fromCorrectionAdded: number
  /** R < C 인 칸 수. */
  mismatches: number
}

/** 이 행에 쓸 것이 있는가(관측 칸 또는 `fromCorrection`). */
export const topUpChanges = (t: Pick<TopUpResult, 'added' | 'fromCorrectionAdded'>): boolean => t.added > 0 || t.fromCorrectionAdded > 0

/** 한 행의 top-up — 칸마다 `max(0, R − C)`(`fromCorrection` 포함). R·C 어느 쪽에만 있는 축도 본다(C 에만 있으면 R = 0 → 어긋남). */
export function topUpSkills(recount: DailySkillsDelta | undefined, currentSkills: unknown): TopUpResult {
  const r = recount ?? {}
  const c = obj(currentSkills)
  const add: Record<string, Partial<GrowthSkillCounts>> = {}
  let added = 0
  let fromCorrectionAdded = 0
  let mismatches = 0
  for (const axis of new Set([...Object.keys(r), ...Object.keys(c)])) {
    const ra = r[axis] ?? {}
    const ca = obj(c[axis])
    for (const k of SKILL_COUNT_KEYS) {
      const rv = num(ra[k])
      const cv = num(ca[k])
      if (rv > cv) {
        ;(add[axis] ??= {})[k] = rv - cv
        if (k === 'fromCorrection') fromCorrectionAdded += rv - cv
        else added += rv - cv
      } else if (rv < cv) mismatches++
    }
  }
  return { add, added, fromCorrectionAdded, mismatches }
}

export interface BackfillDailyRow {
  id: string
  periodKey: string
  data: unknown
}

export interface UserBackfillInputs {
  observations: readonly BackfillObservation[]
  attemptDate: ReadonlyMap<string, string>
  daily: readonly BackfillDailyRow[]
}

export interface PlannedRow {
  date: string
  /** 기존 DAILY 행(행이 없는 날은 계획에 넣지 않고 `skipped` 로만 센다). */
  row: BackfillDailyRow
  add: DailySkillsDelta
  added: number
  fromCorrectionAdded: number
  mismatches: number
}

export interface UserPlan {
  /** 바꿀 행 또는 어긋남이 있는 행(날짜 오름차순, 기존 행만). */
  rows: PlannedRow[]
  /** DAILY 행이 없어 건너뛴 날 수 · 그 날들의 더하지 않은 관측 수(칸 증가분 합). */
  skipped: { rows: number; observations: number }
  /** 날짜별 다시 센 값 R. */
  recount: Map<string, DailySkillsDelta>
  /** 적용 뒤 날짜별 `skills`(기존 행만 — 바뀌지 않는 날 포함). */
  after: Map<string, unknown>
  /** L2 자료 — 교정 제안 관측을 뺀 R 로만 센 적용 뒤 칸(기존 행 날짜만). */
  afterWithoutProposals: Map<string, unknown>
  stats: BucketStats
  observations: number
}

/** 사용자 한 명의 계획(순수). */
export function planUserBackfill(inputs: UserBackfillInputs): UserPlan {
  const { recount, stats } = recountByDate(inputs.observations, inputs.attemptDate)
  const noProposals = recountByDate(
    inputs.observations.filter((o) => o.kind !== 'CORRECTION_PROPOSED'),
    inputs.attemptDate,
  ).recount
  const dailyByDate = new Map(inputs.daily.map((r) => [r.periodKey, r]))
  const allDates = [...new Set([...recount.keys(), ...dailyByDate.keys()])].sort()
  const rows: PlannedRow[] = []
  const skipped = { rows: 0, observations: 0 }
  const after = new Map<string, unknown>()
  const afterWithoutProposals = new Map<string, unknown>()
  for (const date of allDates) {
    const row = dailyByDate.get(date)
    if (!row) {
      const t = topUpSkills(recount.get(date), undefined)
      if (t.added > 0) {
        skipped.rows++
        skipped.observations += t.added
      }
      continue
    }
    const current = obj(row.data).skills
    const t = topUpSkills(recount.get(date), current)
    const changes = topUpChanges(t)
    if (changes || t.mismatches > 0) rows.push({ date, row, ...t })
    if (current !== undefined || changes) after.set(date, changes ? mergeSkills(current, t.add) : current)
    const np = noProposals.get(date)
    if (np) afterWithoutProposals.set(date, np)
  }
  return { rows, skipped, recount, after, afterWithoutProposals, stats, observations: inputs.observations.length }
}

const zeroSkill = (): GrowthSkillCounts => ({ success: 0, partial: 0, fail: 0, skipped: 0, uncertain: 0, fromCorrection: 0 })

export type BackfillWindow = '4w' | '12w' | 'all'
export const BACKFILL_WINDOWS: readonly BackfillWindow[] = ['4w', '12w', 'all']

export interface AxisWindowStat extends GrowthSkillCounts {
  recorded: boolean
  /** 판정된 관측 수(맞힘+일부+틀림). */
  n: number
  obsDays: number
  /** 맞힌 비율(%, 반올림) — n = 0 이면 null. */
  ratePct: number | null
  /** 표본 기준과 무관한 단계(0~3) — L2 판단 자료(화면은 `enough && !oneSided` 일 때만 보인다). */
  stage: 0 | 1 | 2 | 3 | null
  /** 화면의 표본 기준(§36 Q3 A) 충족 여부 — 거짓이면 화면은 «아직 판단하기 일러요». */
  enough: boolean
  /** C 규칙(§36-17-2 L11, 화면 `buildGrowth` 와 같은 `isOneSided`) — 참이면 화면은 단계를 숨긴다. */
  oneSided: boolean
}

/** 적용 뒤 칸으로 한 축·한 기간의 단계(순수, 화면 `buildGrowth` 와 같은 판정 함수). */
export function axisWindowStat(after: ReadonlyMap<string, unknown>, axis: GrowthAxis, from: string | null, to: string): AxisWindowStat {
  const total: GrowthSkillCounts = zeroSkill()
  let obsDays = 0
  for (const [date, skills] of after) {
    if ((from !== null && date < from) || date > to) continue
    const a = obj(obj(skills)[axis])
    const c = { success: num(a.success), partial: num(a.partial), fail: num(a.fail), skipped: num(a.skipped) }
    for (const k of SKILL_COUNT_KEYS) total[k] += num(a[k])
    if (judgedCount(c) > 0) obsDays++
  }
  const n = judgedCount(total)
  const th = GROWTH_THRESHOLDS[axis === 'CONVERSATION_MAINTAIN' ? 'SESSION' : 'OBSERVATION']
  const recorded = GROWTH_AXIS_RECORDED[axis]
  const enough = n >= th.min && (th.minDays === null || obsDays >= th.minDays)
  return {
    ...total,
    recorded,
    n,
    obsDays,
    ratePct: n > 0 ? Math.round(((2 * total.success + total.partial) / (2 * n)) * 100) : null,
    stage: skillStage(total),
    enough,
    oneSided: recorded && isOneSided(enough, n, total.fromCorrection),
  }
}

export type DistributionBucket = 'stage0' | 'stage1' | 'stage2' | 'stage3' | 'oneSided' | 'short' | 'none' | 'unrecorded'

/**
 * 4주 창의 계정 수 분포(화면이 보일 모양) — 관측 0 이면 none, 표본 기준을 못 넘으면 short,
 * 넘었지만 C 규칙에 걸리면 oneSided(단계 숨김), 그 밖은 단계 칸.
 */
export function distributionBucket(s: AxisWindowStat): DistributionBucket {
  if (!s.recorded) return 'unrecorded'
  if (s.n === 0) return 'none'
  if (!s.enough || s.stage === null) return 'short'
  if (s.oneSided) return 'oneSided'
  return `stage${s.stage}` as DistributionBucket
}

export interface AccountReport {
  /** 순번(#1~#n) — userId 를 싣지 않는다. */
  label: string
  axes: Record<GrowthAxis, Record<BackfillWindow, AxisWindowStat>>
}

export interface GrowthSkillsBackfillReport {
  apply: boolean
  today: string
  users: number
  observations: number
  bucket: BucketStats
  /** 갱신할 기존 DAILY 행 수. */
  targetRows: number
  /** DAILY 행이 없어 건너뛴 (사용자×날짜) 수 · 더하지 않은 관측 수. */
  skippedNoRow: { rows: number; observations: number }
  addedByAxis: Record<string, GrowthSkillCounts>
  addedTotal: number
  /** 더할 `fromCorrection` 합(관측 수 `addedTotal` 의 부분 수 — 따로 센다). */
  fromCorrectionTotal: number
  dateRange: { min: string | null; max: string | null }
  mismatches: { cells: number; rows: number }
  applied: { rows: number; observations: number }
  backupPath: string | null
  accounts: AccountReport[]
  distribution4w: Record<GrowthAxis, Record<DistributionBucket, number>>
  /**
   * L2 자료 — 4주 창에서 표본 기준을 넘겨 0단계인데, 교정 제안 관측을 빼고 다시 세면 0단계가 아닌(다른 단계·short·none) 계정 수.
   * = «교정 제안 틀림 때문에 0단계가 되는 계정 수». 교정 제안을 빼고 센 값은 R 만 쓴다(배포 전엔 C = 0 이라 같다).
   */
  stage0ByProposals4w: Record<GrowthAxis, number>
}

export interface GrowthSkillsBackupRow {
  userId: string
  periodKey: string
  /** 기존 DAILY 행 id. */
  id: string
  /** 적용 직전 `data` 전체. */
  data: unknown
  plannedAdd: DailySkillsDelta
}

export interface GrowthSkillsBackup {
  kind: 'growth-skills-backfill-backup'
  createdAt: string
  rows: GrowthSkillsBackupRow[]
}

export type BackfillReadDb = Pick<Tx, 'learningObservation' | 'vocabAttempt' | 'statsSnapshot'>
export type BackfillTxRunner = <T>(fn: (tx: Tx) => Promise<T>, opts?: { timeoutMs?: number }) => Promise<T>

export interface GrowthSkillsBackfillDeps {
  db: BackfillReadDb
  /** apply 때만 부른다(dry-run 은 트랜잭션을 열지 않는다). */
  transaction?: BackfillTxRunner
  /** apply 때 쓰기 전에 한 번 — 백업 파일 경로를 돌려준다. 실패하면 아무것도 쓰지 않는다. */
  backup?: (b: GrowthSkillsBackup) => Promise<string>
  now?: Date
}

/** 사용자 한 명의 입력 읽기(읽기만). */
export async function readUserBackfillInputs(db: BackfillReadDb, userId: string): Promise<UserBackfillInputs> {
  const observations = await db.learningObservation.findMany({
    where: { userId, kind: { in: BACKFILL_GROWTH_KINDS } },
    select: { kind: true, outcome: true, skill: true, confidence: true, refType: true, refId: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  })
  const attemptIds = [...new Set(observations.filter((o) => o.refType === 'VocabAttempt').map((o) => o.refId))]
  const attemptDate = new Map<string, string>()
  for (let i = 0; i < attemptIds.length; i += BACKFILL_ATTEMPT_CHUNK) {
    const rows = await db.vocabAttempt.findMany({
      where: { id: { in: attemptIds.slice(i, i + BACKFILL_ATTEMPT_CHUNK) } },
      select: { id: true, session: { select: { userId: true, date: true } } },
    })
    for (const r of rows) if (r.session.userId === userId) attemptDate.set(r.id, dates.fromDbDate(r.session.date))
  }
  const daily = await db.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, periodKey: true, data: true } })
  return { observations, attemptDate, daily }
}

/** 사용자 한 명 적용(호출자 트랜잭션) — 잠근 뒤 다시 읽고 다시 계산하므로 재시도·재실행이 안전하다. */
export async function applyUserBackfill(tx: Tx, userId: string): Promise<{ rows: number; observations: number }> {
  if (!(await lockUserRow(tx, userId))) return { rows: 0, observations: 0 }
  const plan = planUserBackfill(await readUserBackfillInputs(tx, userId))
  const { recount } = plan
  let rows = 0
  let observations = 0
  for (const p of plan.rows) {
    if (!topUpChanges(p)) continue
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM StatsSnapshot WHERE userId = ${userId} AND kind = 'DAILY' AND periodKey = ${p.date} FOR UPDATE`
    if (!locked.length) continue
    const cur = await tx.statsSnapshot.findUnique({ where: { id: locked[0].id }, select: { data: true } })
    const t = topUpSkills(recount.get(p.date), obj(cur?.data).skills)
    if (!topUpChanges(t)) continue
    await tx.statsSnapshot.update({ where: { id: locked[0].id }, data: { data: mergeDaily(cur?.data, { skills: t.add }) as unknown as Prisma.InputJsonValue } })
    rows++
    observations += t.added
  }
  return { rows, observations }
}

export async function runGrowthSkillsBackfill(deps: GrowthSkillsBackfillDeps, opts: { apply: boolean }): Promise<GrowthSkillsBackfillReport> {
  const now = deps.now ?? new Date()
  const today = dates.todayKst(now)
  const users = (
    await deps.db.learningObservation.findMany({ where: { kind: { in: BACKFILL_GROWTH_KINDS } }, distinct: ['userId'], select: { userId: true }, orderBy: { userId: 'asc' } })
  ).map((u) => u.userId)

  const plans: { userId: string; plan: UserPlan }[] = []
  for (const userId of users) plans.push({ userId, plan: planUserBackfill(await readUserBackfillInputs(deps.db, userId)) })

  const bucket: BucketStats = { session: 0, shifted: 0, fallback: 0, occurredAt: 0 }
  const addedByAxis: Record<string, GrowthSkillCounts> = {}
  let targetRows = 0
  const skippedNoRow = { rows: 0, observations: 0 }
  const mismatches = { cells: 0, rows: 0 }
  let observations = 0
  let addedTotal = 0
  let fromCorrectionTotal = 0
  let min: string | null = null
  let max: string | null = null
  for (const { plan } of plans) {
    observations += plan.observations
    for (const k of Object.keys(bucket) as (keyof BucketStats)[]) bucket[k] += plan.stats[k]
    skippedNoRow.rows += plan.skipped.rows
    skippedNoRow.observations += plan.skipped.observations
    for (const r of plan.rows) {
      if (r.mismatches > 0) {
        mismatches.cells += r.mismatches
        mismatches.rows++
      }
      if (!topUpChanges(r)) continue
      targetRows++
      addedTotal += r.added
      fromCorrectionTotal += r.fromCorrectionAdded
      if (!min || r.date < min) min = r.date
      if (!max || r.date > max) max = r.date
      for (const [axis, cells] of Object.entries(r.add)) {
        const t = (addedByAxis[axis] ??= zeroSkill())
        for (const k of SKILL_COUNT_KEYS) t[k] += num(cells[k])
      }
    }
  }

  const windows: Record<BackfillWindow, string | null> = { '4w': growthRange(today, 4).from, '12w': growthRange(today, 12).from, all: null }
  const accounts: AccountReport[] = plans.map(({ plan }, i) => ({
    label: `#${i + 1}`,
    axes: Object.fromEntries(
      GROWTH_AXES.map((axis) => [axis, Object.fromEntries(BACKFILL_WINDOWS.map((w) => [w, axisWindowStat(plan.after, axis, windows[w], today)]))]),
    ) as AccountReport['axes'],
  }))
  const stage0ByProposals4w = Object.fromEntries(
    GROWTH_AXES.map((axis) => [
      axis,
      plans.filter(({ plan }, i) => {
        const withAll = accounts[i].axes[axis]['4w']
        return withAll.recorded && withAll.enough && withAll.stage === 0 && distributionBucket(axisWindowStat(plan.afterWithoutProposals, axis, windows['4w'], today)) !== 'stage0'
      }).length,
    ]),
  ) as GrowthSkillsBackfillReport['stage0ByProposals4w']
  const distribution4w = Object.fromEntries(
    GROWTH_AXES.map((axis) => {
      const counts: Record<DistributionBucket, number> = { stage0: 0, stage1: 0, stage2: 0, stage3: 0, oneSided: 0, short: 0, none: 0, unrecorded: 0 }
      for (const a of accounts) counts[distributionBucket(a.axes[axis]['4w'])]++
      return [axis, counts]
    }),
  ) as GrowthSkillsBackfillReport['distribution4w']

  const applied = { rows: 0, observations: 0 }
  let backupPath: string | null = null
  if (opts.apply && targetRows > 0) {
    if (!deps.transaction || !deps.backup) throw new Error('apply 에는 transaction 과 backup 이 필요합니다')
    const rows: GrowthSkillsBackupRow[] = plans.flatMap(({ userId, plan }) =>
      plan.rows.filter(topUpChanges).map((r) => ({ userId, periodKey: r.date, id: r.row.id, data: r.row.data, plannedAdd: r.add })),
    )
    backupPath = await deps.backup({ kind: 'growth-skills-backfill-backup', createdAt: now.toISOString(), rows })
    for (const { userId, plan } of plans) {
      if (!plan.rows.some(topUpChanges)) continue
      const res = await deps.transaction((tx) => applyUserBackfill(tx, userId), { timeoutMs: BACKFILL_TX_TIMEOUT_MS })
      applied.rows += res.rows
      applied.observations += res.observations
    }
  }

  return {
    apply: opts.apply,
    today,
    users: users.length,
    observations,
    bucket,
    targetRows,
    skippedNoRow,
    addedByAxis,
    addedTotal,
    fromCorrectionTotal,
    dateRange: { min, max },
    mismatches,
    applied,
    backupPath,
    accounts,
    distribution4w,
    stage0ByProposals4w,
  }
}

const fmtCells = (c: GrowthSkillCounts) => SKILL_COUNT_KEYS.map((k) => `${k}=${c[k]}`).join(' ')
const fmtStat = (s: AxisWindowStat) =>
  !s.recorded
    ? `unrecorded(n=${s.n})`
    : s.n === 0
      ? 'n=0'
      : `n=${s.n} days=${s.obsDays} rate=${s.ratePct}% stage=${s.stage}${s.enough ? '' : ' short'}${s.oneSided ? ' oneSided(hidden)' : ''} fromCorr=${s.fromCorrection} unc=${s.uncertain} skip=${s.skipped}`

/** 숫자만 담은 보고서 줄. */
export function formatGrowthSkillsBackfillReport(r: GrowthSkillsBackfillReport): string[] {
  const lines = [
    `mode: ${r.apply ? 'APPLY' : 'DRY-RUN (no writes)'}`,
    `today (KST): ${r.today}`,
    `users with countable observations: ${r.users}`,
    `observations read (countable kinds): ${r.observations}`,
    `  vocab cards dated by set date: ${r.bucket.session} (set crossed midnight: ${r.bucket.shifted}) · set deleted -> occurredAt: ${r.bucket.fallback} · others by occurredAt: ${r.bucket.occurredAt}`,
    `target DAILY rows (existing only): ${r.targetRows}`,
    `skipped (no DAILY row, not created): rows=${r.skippedNoRow.rows} observations=${r.skippedNoRow.observations}`,
    `observations to add: ${r.addedTotal} (of which fromCorrection: ${r.fromCorrectionTotal})`,
    ...Object.keys(r.addedByAxis)
      .sort()
      .map((axis) => `  ${axis}: ${fmtCells(r.addedByAxis[axis])}`),
    `date range (rows to change): ${r.dateRange.min ?? '-'} .. ${r.dateRange.max ?? '-'}`,
    `mismatch (R<C, not changed): cells=${r.mismatches.cells} rows=${r.mismatches.rows}`,
    `applied: rows=${r.applied.rows} observations=${r.applied.observations}`,
    `backup: ${r.backupPath ?? '-'}`,
    `stage by account after top-up (n = success+partial+fail, rate = (success + partial/2)/n, stage 0..3 at 50/70/85%, short = below sample threshold, oneSided = enough and 10*fromCorrection >= 9*n -> stage hidden):`,
  ]
  for (const a of r.accounts) {
    for (const axis of GROWTH_AXES) lines.push(`  ${a.label} ${axis.padEnd(21)} ${BACKFILL_WINDOWS.map((w) => `${w}: ${fmtStat(a.axes[axis][w])}`).join(' | ')}`)
  }
  lines.push('distribution over accounts (4w window, as the screen shows it — oneSided = enough but stage hidden by the correction rule):')
  for (const axis of GROWTH_AXES) {
    const d = r.distribution4w[axis]
    lines.push(`  ${axis.padEnd(21)} ${(Object.keys(d) as DistributionBucket[]).map((k) => `${k}=${d[k]}`).join(' ')}`)
  }
  lines.push(`stage 0 only because of correction proposals (4w: stage 0 with them, not stage 0 without them): ${GROWTH_AXES.map((a) => `${a}=${r.stage0ByProposals4w[a]}`).join(' ')}`)
  return lines
}
