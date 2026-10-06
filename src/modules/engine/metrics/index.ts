/**
 * TTS 일별 지표(task-012b-3, speech-platform/16 §7.3) — `RequestTrace` → `EngineMetricsDaily`(TTS 역할 연결 행만) 물화와 조회.
 * 계산 규칙은 `./ttsAggregate.ts` 머리 주석이 정본.
 *
 * 날짜 = Trace `createdAt` 의 **KST 달력 날짜**(Asia/Seoul 고정 +9, api-contract §0-6). 하루 = [KST 00:00, 다음날 00:00).
 *
 * 물화 방식(Leader 결정 L-4 — 주기 잡·crontab 없음): **지표 조회가 지연 물화**한다.
 * - "끝난 날"(그날 끝 + `FINAL_GRACE_MS` 가 지남)이면서 `MATERIALIZE_LOOKBACK_DAYS` 안이고, 그 연결의 행이 아직 없으면 그날을 계산해 저장한다.
 *   표본이 0 이어도 0 행을 쓴다 — "계산했음" 표시가 따로 없으므로 행이 없으면 매번 다시 훑게 된다.
 *   연결이 만들어지기 전 날(그날 끝 ≤ createdAt)은 대상이 아니다(행도 쓰지 않는다).
 * - 이미 있는 행은 다시 계산하지 않는다(끝난 날의 Trace 는 더 바뀌지 않는다 — 턴 Trace 는 끝날 때 한 번 쓰이고, 뒤에 붙는 PLAYBACK 은 TTS 단계가 아니다).
 * - 끝난 날 행은 write-once(REV-123 F-1): INSERT 만 하고, 이미 있으면(유니크 `[connectionId, date]` 위반 등) 건드리지 않는다.
 *   두 요청·두 프로세스가 겹치면 **먼저 커밋된 행이 남는다** — 같은 Trace 를 읽었다면 같은 값이다.
 *   "가장 완전한 값이 이긴다" 는 보장하지 않는다(늦게 보인 Trace 는 반영되지 않음). 지표 정의를 바꾸면 행을 지우고 다시 조회해 재계산한다.
 * - 끝나지 않은 날(오늘, 자정 직후 유예 중인 어제)은 저장하지 않고 즉석 집계(프로세스 60초 캐시).
 * - 행은 이 프로세스 APP_ENV 와 같은 환경만 쓴다(`getTtsMetrics` 의 `writable`) — 다른 환경 보기는 읽기 + 즉석 집계.
 * - Trace 보존 정리(90일, 아직 미구현)가 생기면 정리 전에 `materializeTtsDays` 를 먼저 불러야 한다(domain-model "Trace purge 전에 물화").
 *
 * 응답·로그에 사용자 id·문장·오디오·시크릿을 싣지 않는다(집계 숫자와 연결 id/키, 목소리 id 만).
 */
import { Prisma, type EngineMetricsDaily, type EngineStatus, type Environment, type PrismaClient, type TraceKind } from '@prisma/client'
import { dates, prisma } from '@/modules/infra'
import { currentEnvironment } from '../router'
import { emptyTtsDay, parseByVoice, TTS_TRACE_KINDS, TtsDayAccumulator, extractTtsSamples, type TtsDayMetrics } from './ttsAggregate'

export { PERCENTILE_MIN_SAMPLES, BY_VOICE_MAX, nearestRank, extractTtsSamples, aggregateTtsTraces, emptyTtsDay, parseByVoice, TtsDayAccumulator, TTS_TRACE_KINDS } from './ttsAggregate'
export type { TtsDayMetrics, TtsVoiceMetrics, TtsTraceInput, TraceSamples, PercentileRank } from './ttsAggregate'

const KST_OFFSET_MS = 9 * 3600_000
const DAY_MS = 86_400_000
/** 자정 직후 커밋이 늦은 Trace 행을 놓치지 않으려고 둔 유예. 이 사이 어제는 즉석 집계. */
export const FINAL_GRACE_MS = 2 * 60_000
/**
 * 물화하는 가장 먼 날(오늘 포함 90일 = RequestTrace 보존 기간). 그보다 오래된 날은 Trace 가 없을 수 있어 0 행을 쓰면 거짓이 된다.
 *
 * 알려진 한계(REV-119 L-1): 이 90 은 정책 키 AppSetting `trace.retentionDays`(기본 90, engine/configuration/appSettingSchema)와
 * **이중 정의**다 — 정책 값을 90 아래로 내리고 보존 정리가 돌면 보존 밖 날에 거짓 0 행이 쓰인다. 또 물화는 지표 **조회가 일으키므로**
 * 아무도 대시보드를 열지 않으면 끝난 날이 행 없이 남고, 보존 정리가 그 날의 Trace 를 지우면 영영 계산할 수 없다.
 * → 보존 정리(미구현)를 만들 때는 **정리 전에 `materializeTtsDays` 를 먼저 부르도록 강제**하고(완료 기준에 넣을 것),
 *   이 상수를 `min(90, trace.retentionDays)` 로 바꿀지 함께 정한다.
 */
export const MATERIALIZE_LOOKBACK_DAYS = 90
export const LIVE_CACHE_MS = 60_000
const SCAN_PAGE = 1_000
/** 한 번의 계산에서 읽는 Trace 상한. 넘으면 부분 결과를 저장하지 않고 실패한다(1인 앱 90일 추정치보다 한참 크다). */
const SCAN_MAX_ROWS = 300_000

export class TtsMetricsScanLimitError extends Error {
  constructor() {
    super('TTS 지표 계산 대상 Trace 가 상한을 넘었습니다')
    this.name = 'TtsMetricsScanLimitError'
  }
}

/** KST 하루 [start, end). */
export function kstDayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(dates.toDbDate(date).getTime() - KST_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

export function kstDateOf(at: Date): string {
  return dates.todayKst(at)
}

/** 그날이 끝나 저장해도 되는가(유예 포함). */
export function isFinalDay(date: string, now: Date): boolean {
  return kstDayBounds(date).end.getTime() + FINAL_GRACE_MS <= now.getTime()
}

export interface TtsConnectionRef {
  id: string
  key: string
  name: string
  enabled: boolean
  status: EngineStatus
  createdAt: Date
}

export interface TraceScanRow {
  traceId: string
  kind: TraceKind
  steps: unknown
  createdAt: Date
}

export interface StoredTtsDay extends TtsDayMetrics {
  connectionId: string
  date: string
  computedAt: Date
}

/** DB 경계(테스트는 메모리 구현을 넣는다). */
export interface TtsMetricsStore {
  ttsConnections(environment: Environment): Promise<TtsConnectionRef[]>
  storedDays(connectionIds: readonly string[], from: string, to: string): Promise<StoredTtsDay[]>
  /** createdAt·traceId 오름차순, `after` 다음부터 `take` 건. 종류는 TTS_TRACE_KINDS 만. */
  scanTraces(environment: Environment, start: Date, end: Date, after: { createdAt: Date; traceId: string } | null, take: number): Promise<TraceScanRow[]>
  /** 끝난 날 행 INSERT — 이미 있으면 그대로 두고 false. 새로 만들었을 때만 true. */
  insertDayIfAbsent(row: { connectionId: string; date: string; metrics: TtsDayMetrics; computedAt: Date }): Promise<boolean>
}

function toStored(r: EngineMetricsDaily): StoredTtsDay {
  return {
    connectionId: r.connectionId,
    date: dates.fromDbDate(r.date),
    computedAt: r.computedAt,
    requests: r.requests,
    errors: r.errors,
    avgMs: r.avgMs,
    p50Ms: r.p50Ms,
    p95Ms: r.p95Ms,
    p99Ms: r.p99Ms,
    ttfaP50Ms: r.ttfaP50Ms,
    ttfaP95Ms: r.ttfaP95Ms,
    rtfAvg: r.rtfAvg,
    cacheHitRate: r.cacheHitRate,
    byVoice: parseByVoice(r.byVoice),
  }
}

/** 행 값. byVoice null 은 Json? 칸의 DB NULL(Prisma.DbNull) — JS null 은 Json 칸에 바로 들어가지 않는다. */
function rowData(m: TtsDayMetrics, computedAt: Date) {
  return {
    requests: m.requests,
    errors: m.errors,
    avgMs: m.avgMs,
    p50Ms: m.p50Ms,
    p95Ms: m.p95Ms,
    p99Ms: m.p99Ms,
    ttfaP50Ms: m.ttfaP50Ms,
    ttfaP95Ms: m.ttfaP95Ms,
    rtfAvg: m.rtfAvg,
    cacheHitRate: m.cacheHitRate,
    byVoice: m.byVoice === null ? Prisma.DbNull : (m.byVoice as unknown as Prisma.InputJsonValue),
    computedAt,
  }
}

export type MetricsDayDb = Pick<PrismaClient, 'engineMetricsDaily'>

/**
 * 끝난 날 행 1개를 write-once 로 만든다 — `create` 만 쓰고 `update`·`upsert` 는 쓰지 않는다(늦게 끝난 계산이 먼저 저장된 행을 덮지 않게).
 * `create` 가 실패하면 오류 코드(P2002 유니크 위반·P2034 데드락 등)로 가르지 않고 "행이 생겼나" 를 다시 읽어 판정한다 —
 * 있으면 다른 요청이 먼저 만든 것이므로 정상(`'EXISTED'`), 없으면 원래 오류를 다시 던진다.
 */
export async function insertTtsDayRowOnce(db: MetricsDayDb, row: { connectionId: string; date: string; metrics: TtsDayMetrics; computedAt: Date }): Promise<'CREATED' | 'EXISTED'> {
  const date = dates.toDbDate(row.date)
  try {
    await db.engineMetricsDaily.create({ data: { connectionId: row.connectionId, date, ...rowData(row.metrics, row.computedAt) } })
    return 'CREATED'
  } catch (e) {
    const existing = await db.engineMetricsDaily.findUnique({ where: { connectionId_date: { connectionId: row.connectionId, date } }, select: { connectionId: true } }).catch(() => null)
    if (existing) return 'EXISTED'
    throw e
  }
}

export const prismaTtsMetricsStore: TtsMetricsStore = {
  async ttsConnections(environment) {
    const rows = await prisma.engineConnection.findMany({
      where: { environment, role: 'TTS' },
      select: { id: true, key: true, name: true, enabled: true, status: true, createdAt: true },
      orderBy: [{ key: 'asc' }],
    })
    return rows
  },
  async storedDays(connectionIds, from, to) {
    if (connectionIds.length === 0) return []
    const rows = await prisma.engineMetricsDaily.findMany({ where: { connectionId: { in: [...connectionIds] }, date: dates.dbDateRange(from, to) }, orderBy: [{ date: 'asc' }] })
    return rows.map(toStored)
  },
  async scanTraces(environment, start, end, after, take) {
    const base: Prisma.RequestTraceWhereInput = { environment, kind: { in: [...TTS_TRACE_KINDS] }, createdAt: { gte: start, lt: end } }
    const where: Prisma.RequestTraceWhereInput = after
      ? { AND: [base, { OR: [{ createdAt: { gt: after.createdAt } }, { createdAt: after.createdAt, traceId: { gt: after.traceId } }] }] }
      : base
    return prisma.requestTrace.findMany({ where, select: { traceId: true, kind: true, steps: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { traceId: 'asc' }], take })
  },
  async insertDayIfAbsent(row) {
    return (await insertTtsDayRowOnce(prisma, row)) === 'CREATED'
  },
}

/**
 * [from, to] 날짜의 Trace 를 한 번 훑어 날짜 × 연결 키별 값. `until` 이 있으면 그 시각까지만(오늘 즉석 집계).
 * `fallbackKey` = 고아 실패를 붙일 연결 키(`fallbackKeyOf`, ttsAggregate 머리 주석).
 */
export async function computeTtsDays(
  store: TtsMetricsStore,
  environment: Environment,
  from: string,
  to: string,
  opts: { until?: Date; fallbackKey?: string | null } = {},
): Promise<Map<string, Map<string, TtsDayMetrics>>> {
  const start = kstDayBounds(from).start
  const endOfTo = kstDayBounds(to).end
  const end = opts.until && opts.until < endOfTo ? opts.until : endOfTo
  const accs = new Map<string, Map<string, TtsDayAccumulator>>()
  const accOf = (date: string, key: string) => {
    let byKey = accs.get(date)
    if (!byKey) accs.set(date, (byKey = new Map()))
    let a = byKey.get(key)
    if (!a) byKey.set(key, (a = new TtsDayAccumulator()))
    return a
  }
  let after: { createdAt: Date; traceId: string } | null = null
  let read = 0
  for (;;) {
    const page = await store.scanTraces(environment, start, end, after, SCAN_PAGE)
    for (const row of page) {
      const date = kstDateOf(row.createdAt)
      const s = extractTtsSamples(row, opts.fallbackKey ?? null)
      for (const c of s.chunks) accOf(date, c.connectionKey).addChunk(c)
      if (s.ttfa) accOf(date, s.ttfa.connectionKey).addTtfa(s.ttfa.ms)
    }
    read += page.length
    if (read > SCAN_MAX_ROWS) throw new TtsMetricsScanLimitError()
    if (page.length < SCAN_PAGE) break
    const last = page[page.length - 1]
    after = { createdAt: last.createdAt, traceId: last.traceId }
  }
  const out = new Map<string, Map<string, TtsDayMetrics>>()
  for (const [date, byKey] of accs) {
    const m = new Map<string, TtsDayMetrics>()
    for (const [k, a] of byKey) m.set(k, a.finish())
    out.set(date, m)
  }
  return out
}

function lookbackStart(now: Date): string {
  return dates.addDays(kstDateOf(now), -(MATERIALIZE_LOOKBACK_DAYS - 1))
}

/**
 * 고아 실패를 붙일 연결 키 — 켜진 TTS 연결이 정확히 하나면 그 키(꺼진 연결은 합성 경로가 쓰지 않는다), 켜진 것이 없으면 연결이 하나뿐일 때만.
 * 꺼진 시험·보관 연결이 하나 더 있다고 고아 실패를 버리지 않게 한다.
 */
export function fallbackKeyOf(conns: readonly TtsConnectionRef[]): string | null {
  const on = conns.filter((c) => c.enabled)
  if (on.length === 1) return on[0].key
  return on.length === 0 && conns.length === 1 ? conns[0].key : null
}

/** 그날 끝 전에 만들어진 연결인가(물화·즉석 집계 공통 — 만들어지기 전 날은 값이 없다). */
const existedOn = (c: TtsConnectionRef, date: string) => c.createdAt < kstDayBounds(date).end

/**
 * [from, to] 중 끝난 날·물화 대상인데 행이 없는 (연결, 날짜)를 계산해 저장한다. **실제로 새로 만든 행 수**를 돌려준다
 * (계산 중 다른 요청이 먼저 만든 행은 건드리지 않고 세지 않는다).
 * 연결 키 → id 는 같은 환경의 TTS 연결로만 찾는다(다른 역할·다른 환경 키의 단계는 버린다).
 */
export async function materializeTtsDays(opts: { environment: Environment; from: string; to: string; now?: Date; store?: TtsMetricsStore; connections?: TtsConnectionRef[] }): Promise<number> {
  const store = opts.store ?? prismaTtsMetricsStore
  const now = opts.now ?? new Date()
  const conns = opts.connections ?? (await store.ttsConnections(opts.environment))
  if (conns.length === 0) return 0
  const floor = lookbackStart(now)
  const from = opts.from < floor ? floor : opts.from
  if (from > opts.to) return 0
  const days = dates.eachDateInRange(from, opts.to).filter((d) => isFinalDay(d, now))
  if (days.length === 0) return 0
  const have = new Set((await store.storedDays(conns.map((c) => c.id), days[0], days[days.length - 1])).map((r) => `${r.connectionId}|${r.date}`))
  const missing: { conn: TtsConnectionRef; date: string }[] = []
  for (const date of days) for (const c of conns) if (existedOn(c, date) && !have.has(`${c.id}|${date}`)) missing.push({ conn: c, date })
  if (missing.length === 0) return 0
  const lo = missing.reduce((m, x) => (x.date < m ? x.date : m), missing[0].date)
  const hi = missing.reduce((m, x) => (x.date > m ? x.date : m), missing[0].date)
  const computed = await computeTtsDays(store, opts.environment, lo, hi, { fallbackKey: fallbackKeyOf(conns) })
  let created = 0
  for (const { conn, date } of missing) {
    const metrics = computed.get(date)?.get(conn.key) ?? emptyTtsDay()
    if (await store.insertDayIfAbsent({ connectionId: conn.id, date, metrics, computedAt: now })) created++
  }
  return created
}

// ── 즉석 집계(끝나지 않은 날) — 프로세스 60초 캐시 ─────────────────────────────────

const liveCache = new Map<string, { at: number; byKey: Map<string, TtsDayMetrics> }>()

export function clearTtsLiveCache(): void {
  liveCache.clear()
}

async function liveDay(store: TtsMetricsStore, environment: Environment, date: string, now: Date, fallbackKey: string | null): Promise<{ byKey: Map<string, TtsDayMetrics>; computedAt: Date }> {
  const ck = `${environment}|${date}`
  const hit = liveCache.get(ck)
  if (hit && now.getTime() - hit.at < LIVE_CACHE_MS && now.getTime() >= hit.at) return { byKey: hit.byKey, computedAt: new Date(hit.at) }
  const m = await computeTtsDays(store, environment, date, date, { until: now, fallbackKey })
  const byKey = m.get(date) ?? new Map<string, TtsDayMetrics>()
  // 단조 갱신(REV-123 F-2): 미스가 겹치면 더 이른 `now` 로 시작한 계산이 늦게 끝날 수 있다 — 더 새로운 항목을 덮지 않는다.
  const cur = liveCache.get(ck)
  if (!cur || cur.at <= now.getTime()) liveCache.set(ck, { at: now.getTime(), byKey })
  // 날이 바뀐 옛 키가 쌓이지 않게(하루 1~2개뿐이지만) 오래된 항목을 치운다.
  for (const [k, v] of liveCache) if (now.getTime() - v.at > DAY_MS) liveCache.delete(k)
  return { byKey, computedAt: now }
}

export type TtsDaySource = 'MATERIALIZED' | 'LIVE' | 'NONE'

/** 저장 행 → 칸 값만(연결 id·날짜·계산 시각을 떼어 낸다). */
function metricsOf(s: StoredTtsDay): TtsDayMetrics {
  const { requests, errors, avgMs, p50Ms, p95Ms, p99Ms, ttfaP50Ms, ttfaP95Ms, rtfAvg, cacheHitRate, byVoice } = s
  return { requests, errors, avgMs, p50Ms, p95Ms, p99Ms, ttfaP50Ms, ttfaP95Ms, rtfAvg, cacheHitRate, byVoice }
}

export interface TtsMetricsDay extends TtsDayMetrics {
  date: string
  /** MATERIALIZED = EngineMetricsDaily 행 · LIVE = 즉석 집계(오늘·유예 중 어제) · NONE = 연결이 없던 날 등 값 없음(0). */
  source: TtsDaySource
  computedAt: Date | null
}

export interface TtsMetricsResult {
  environment: Environment
  from: string
  to: string
  today: string
  connections: { connection: TtsConnectionRef; days: TtsMetricsDay[] }[]
}

/**
 * 관리자 지표 조회 본체. 지난 날 지연 물화 → 저장 행 + 끝나지 않은 날 즉석 집계를 날짜순으로 합친다.
 * `connectionIds` 가 있으면 그 연결만(호출자가 환경·역할을 확인한 id).
 * `writable`(기본 = 조회 환경이 이 프로세스의 APP_ENV 인가): 행은 자기 환경 것만 쓴다 — SUPER_ADMIN 의 다른 환경 보기(`?environment=`)가
 * 다른 빌드(개발 미러의 미커밋 코드 등)의 계산으로 그 환경의 끝난 날 행을 굳히지 않게. 쓰지 않을 때 행이 없는 끝난 날은 즉석 집계(저장·캐시 없음, LIVE).
 */
export async function getTtsMetrics(opts: { environment: Environment; from: string; to: string; connectionIds?: readonly string[]; now?: Date; store?: TtsMetricsStore; writable?: boolean }): Promise<TtsMetricsResult> {
  const store = opts.store ?? prismaTtsMetricsStore
  const now = opts.now ?? new Date()
  const today = kstDateOf(now)
  const all = await store.ttsConnections(opts.environment)
  const conns = opts.connectionIds ? all.filter((c) => opts.connectionIds!.includes(c.id)) : all
  const range = dates.eachDateInRange(opts.from, opts.to)
  if (conns.length === 0) return { environment: opts.environment, from: opts.from, to: opts.to, today, connections: [] }
  const writable = opts.writable ?? opts.environment === currentEnvironment()
  const fallbackKey = fallbackKeyOf(all)

  // 고아 실패를 붙일 연결은 필터와 무관하게 정해야 해서 물화는 환경의 TTS 연결 전부를 대상으로 한다.
  if (writable) await materializeTtsDays({ environment: opts.environment, from: opts.from, to: opts.to, now, store, connections: all })
  const stored = new Map((await store.storedDays(conns.map((c) => c.id), opts.from, opts.to)).map((r) => [`${r.connectionId}|${r.date}`, r]))
  const live = new Map<string, { byKey: Map<string, TtsDayMetrics>; computedAt: Date }>()
  for (const d of range) if (!isFinalDay(d, now) && d <= today) live.set(d, await liveDay(store, opts.environment, d, now, fallbackKey))
  if (!writable) {
    const floor = lookbackStart(now)
    const gaps = range.filter((d) => d >= floor && isFinalDay(d, now) && conns.some((c) => existedOn(c, d) && !stored.has(`${c.id}|${d}`)))
    if (gaps.length > 0) {
      const computed = await computeTtsDays(store, opts.environment, gaps[0], gaps[gaps.length - 1], { fallbackKey })
      for (const d of gaps) live.set(d, { byKey: computed.get(d) ?? new Map<string, TtsDayMetrics>(), computedAt: now })
    }
  }

  return {
    environment: opts.environment,
    from: opts.from,
    to: opts.to,
    today,
    connections: conns.map((connection) => ({
      connection,
      days: range.map((date): TtsMetricsDay => {
        const s = stored.get(`${connection.id}|${date}`)
        if (s) return { date, source: 'MATERIALIZED', computedAt: s.computedAt, ...metricsOf(s) }
        const l = live.get(date)
        if (l && existedOn(connection, date)) return { date, source: 'LIVE', computedAt: l.computedAt, ...(l.byKey.get(connection.key) ?? emptyTtsDay()) }
        return { date, source: 'NONE', computedAt: null, ...emptyTtsDay() }
      }),
    })),
  }
}
