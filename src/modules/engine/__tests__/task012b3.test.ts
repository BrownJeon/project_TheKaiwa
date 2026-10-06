/**
 * task-012b-3 TTS 일별 지표 — 백분위 정의·표본 부족 null · 표본 규칙(HIT/MISS·오류·고아 실패·TTFA) · 손계산 대조 · KST 날짜 경계 ·
 * 지연 물화(끝난 날만·0 행·연결 생성 전 날 제외·90일 한도) · 멱등(두 번·동시 두 요청 → 행 1개, 값 같음) ·
 * 끝난 날 행 write-once(REV-123 F-1 — 서로 다른 스냅샷이 겹쳐도 먼저 저장된 행 유지) · 오늘 즉석 집계 60초 캐시(F-2 단조 갱신).
 * DB 없이 메모리 저장소로 돈다(`env -u DATABASE_URL`).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma, type Environment } from '@prisma/client'
import {
  aggregateTtsTraces,
  BY_VOICE_MAX,
  clearTtsLiveCache,
  extractTtsSamples,
  fallbackKeyOf,
  FINAL_GRACE_MS,
  getTtsMetrics,
  insertTtsDayRowOnce,
  isFinalDay,
  kstDayBounds,
  materializeTtsDays,
  nearestRank,
  parseByVoice,
  PERCENTILE_MIN_SAMPLES,
  type MetricsDayDb,
  type StoredTtsDay,
  type TraceScanRow,
  type TtsConnectionRef,
  type TtsDayMetrics,
  type TtsMetricsStore,
} from '../metrics'

const ENV: Environment = 'LOCAL'
const KEY = 'tts-main'

// ── 픽스처 도우미 ───────────────────────────────────────────────────────────

let seq = 0
const tid = () => `t_${String(++seq).padStart(20, '0')}`

function miss(i: number, ms: number, o: { rtf?: number; voiceId?: string; key?: string } = {}) {
  return { name: `TTS_SYNTH[${i}]`, ms, chunkIndex: i, synthMs: ms - 10, audioMs: 1000, rtf: o.rtf ?? 0.5, cacheHit: false, connectionKey: o.key ?? KEY, status: 'OK', ...(o.voiceId ? { voiceId: o.voiceId } : {}) }
}
function hit(i: number, ms: number, o: { voiceId?: string; key?: string } = {}) {
  return { name: `TTS_SYNTH[${i}]`, ms, chunkIndex: i, cacheHit: true, connectionKey: o.key ?? KEY, audioMs: 900, status: 'OK', ...(o.voiceId ? { voiceId: o.voiceId } : {}) }
}
function fail(i: number, status: 'FAILED' | 'TIMEOUT' | 'SKIPPED', o: { voiceId?: string } = {}) {
  return { name: `TTS_SYNTH[${i}]`, ms: 8000, chunkIndex: i, cacheHit: false, connectionKey: KEY, status, errorCode: 'TTS_X', ...(o.voiceId ? { voiceId: o.voiceId } : {}) }
}
const preview = (at: Date, steps: unknown[], ttfaMs: number | null): TraceScanRow => ({
  traceId: tid(),
  kind: 'PREVIEW',
  createdAt: at,
  steps: [{ name: 'TTS', ms: 100, sentences: 1, chunks: 1, ttfaMs, status: ttfaMs === null ? 'ERROR' : 'OK' }, { name: 'TTS_LEXICON', ms: 1 }, ...steps],
})
const turn = (at: Date, steps: unknown[]): TraceScanRow => ({ traceId: tid(), kind: 'TURN', createdAt: at, steps: [{ name: 'LLM', ms: 2000, connection: 'llm-x' }, ...steps] })

// ── 백분위 ─────────────────────────────────────────────────────────────────

test('nearest-rank 백분위 — ⌈p·n⌉ 번째, 최소 표본(p50 1·p95 20·p99 100) 미만이면 null, 표본 0 은 null', () => {
  assert.deepEqual(PERCENTILE_MIN_SAMPLES, { 50: 1, 95: 20, 99: 100 })
  assert.equal(nearestRank([], 50), null)
  assert.equal(nearestRank([7], 50), 7)
  assert.equal(nearestRank([1, 2, 3, 4], 50), 2)
  const n19 = Array.from({ length: 19 }, (_, i) => i + 1)
  assert.equal(nearestRank(n19, 95), null)
  const n20 = Array.from({ length: 20 }, (_, i) => i + 1)
  assert.equal(nearestRank(n20, 95), 19)
  const n100 = Array.from({ length: 100 }, (_, i) => i + 1)
  assert.equal(nearestRank(n100, 99), 99)
  assert.equal(nearestRank(n100.slice(0, 99), 99), null)
})

// ── 표본 규칙 ───────────────────────────────────────────────────────────────

test('표본 — PREVIEW: 부모 TTS.ttfaMs 1개 + 청크, PLAYGROUND·FUNCTIONAL_TEST 는 0, connectionKey 없는 단계는 버림', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const p = extractTtsSamples(preview(at, [miss(0, 600, { voiceId: 'teacher_a' })], 650))
  assert.equal(p.chunks.length, 1)
  assert.deepEqual(p.ttfa, { connectionKey: KEY, ms: 650 })
  assert.equal(p.chunks[0].latencyMs, 600)
  assert.equal(p.chunks[0].voiceId, 'teacher_a')
  assert.equal(extractTtsSamples({ kind: 'PLAYGROUND', steps: [miss(0, 600)] }).chunks.length, 0)
  assert.equal(extractTtsSamples({ kind: 'FUNCTIONAL_TEST', steps: [miss(0, 600)] }).chunks.length, 0)
  const noKey = extractTtsSamples({ kind: 'PREVIEW', steps: [{ name: 'TTS_SYNTH[0]', ms: 5, cacheHit: true, status: 'OK' }] })
  assert.equal(noKey.chunks.length, 0)
  assert.equal(noKey.dropped, 1)
  assert.deepEqual(extractTtsSamples({ kind: 'PREVIEW', steps: 'garbage' }), { chunks: [], ttfa: null, dropped: 0 })
})

test('표본 — HIT 는 지연·RTF 에서 빠지고, 실패·SKIPPED·TIMEOUT 은 오류, status 없는 옛 단계는 errorCode 로 판정', () => {
  const s = extractTtsSamples({
    kind: 'PREVIEW',
    steps: [hit(0, 4), miss(1, 700, { rtf: 0.4 }), fail(2, 'TIMEOUT'), fail(3, 'SKIPPED'), { name: 'TTS_SYNTH[4]', ms: 30, connectionKey: KEY, cacheHit: false }, { name: 'TTS_SYNTH[5]', ms: 30, connectionKey: KEY, errorCode: 'X' }],
  })
  assert.deepEqual(
    s.chunks.map((c) => [c.ok, c.cacheHit, c.latencyMs, c.rtf]),
    [
      [true, true, null, null],
      [true, false, 700, 0.4],
      [false, false, null, null],
      [false, false, null, null],
      [true, false, 30, null],
      [false, false, null, null],
    ],
  )
})

test('표본 — TURN: TTFA = TTS[0].ttfaServerMs, 같은 청크 TTS_SYNTH 없는 실패 TTS[i] 는 고아 실패(유일 키 → fallback → 버림)', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const t1 = extractTtsSamples(turn(at, [miss(0, 500), { name: 'TTS[0]', ms: 520, chunkIndex: 0, status: 'OK', ttfaServerMs: 520 }, { name: 'TTS[1]', ms: 9000, chunkIndex: 1, status: 'FAILED', errorCode: 'TTS_TIMEOUT' }]))
  assert.deepEqual(t1.ttfa, { connectionKey: KEY, ms: 520 })
  assert.equal(t1.chunks.length, 2)
  assert.equal(t1.chunks[1].ok, false)
  // 같은 청크에 TTS_SYNTH 가 있으면 고아가 아니다(이중 계산 없음).
  const t2 = extractTtsSamples(turn(at, [fail(0, 'FAILED'), { name: 'TTS[0]', ms: 8000, chunkIndex: 0, status: 'FAILED' }]))
  assert.equal(t2.chunks.length, 1)
  // 자막 전환(TEXT_ONLY) — 합성 단계가 없으면 fallbackKey 로, 없으면 버린다.
  const textOnly = turn(at, [{ name: 'TTS[0]', ms: 3, chunkIndex: 0, status: 'SKIPPED', errorCode: 'TTS_UNAVAILABLE' }])
  assert.equal(extractTtsSamples(textOnly, 'only-tts').chunks[0].connectionKey, 'only-tts')
  assert.equal(extractTtsSamples(textOnly, null).chunks.length, 0)
  assert.equal(extractTtsSamples(textOnly, null).dropped, 1)
  // 연결이 둘 이상 섞인 Trace 의 고아는 어디인지 모르므로 버린다.
  const two = extractTtsSamples(turn(at, [miss(0, 500), miss(1, 500, { key: 'tts-b' }), { name: 'TTS[2]', ms: 9000, chunkIndex: 2, status: 'FAILED' }]), 'only-tts')
  assert.equal(two.chunks.length, 2)
  assert.equal(two.dropped, 1)
})

// ── 손계산 대조 ─────────────────────────────────────────────────────────────

test('집계 손계산 — requests·errors·avg·p50·p95·p99·ttfa·rtfAvg·cacheHitRate·byVoice, 옛 행(voiceId 없음)과 섞여도 깨지지 않음', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const traces: TraceScanRow[] = []
  // MISS 20개(100..2000ms, rtf 0.1..2.0), voice A 10개·B 10개 → p95 계산 가능(n=20), p99 불가(n<100)
  for (let i = 1; i <= 20; i++) traces.push(preview(at, [miss(0, i * 100, { rtf: i / 10, voiceId: i % 2 ? 'voice_a' : 'voice_b' })], i * 100 + 50))
  // HIT 5개(voice A), 실패 3개(voice B 2개 + voiceId 없는 옛 행 1개)
  for (let i = 0; i < 5; i++) traces.push(preview(at, [hit(0, 3, { voiceId: 'voice_a' })], 10))
  traces.push(preview(at, [fail(0, 'FAILED', { voiceId: 'voice_b' })], null), preview(at, [fail(0, 'TIMEOUT', { voiceId: 'voice_b' })], null), preview(at, [fail(0, 'SKIPPED')], null))
  // 옛 행: voiceId 없는 MISS 1개(지연 표본에는 들어가지만 byVoice 에는 없음)
  traces.push(preview(at, [miss(0, 2100, { rtf: 2.1 })], 2150))
  const { byKey } = aggregateTtsTraces(traces)
  const m = byKey.get(KEY)!
  const lat = [...Array.from({ length: 20 }, (_, i) => (i + 1) * 100), 2100]
  assert.equal(m.requests, 29)
  assert.equal(m.errors, 3)
  assert.equal(m.avgMs, Math.round(lat.reduce((s, v) => s + v, 0) / lat.length))
  assert.equal(m.p50Ms, 1100) // n=21, ⌈10.5⌉=11번째
  assert.equal(m.p95Ms, 2000) // ⌈19.95⌉=20번째
  assert.equal(m.p99Ms, null)
  // TTFA: MISS 21개(150..2050, 2150) + HIT 5개(10) = 26개 → p50 = 13번째, p95 = 25번째
  const tf = [...Array(5).fill(10), ...Array.from({ length: 20 }, (_, i) => (i + 1) * 100 + 50), 2150].sort((a, b) => a - b)
  assert.equal(m.ttfaP50Ms, tf[12])
  assert.equal(m.ttfaP95Ms, tf[24])
  const rtfs = [...Array.from({ length: 20 }, (_, i) => (i + 1) / 10), 2.1]
  assert.equal(m.rtfAvg, Math.round((rtfs.reduce((s, v) => s + v, 0) / rtfs.length) * 10_000) / 10_000)
  assert.equal(m.cacheHitRate, Math.round((5 / 29) * 10_000) / 10_000)
  assert.deepEqual(Object.keys(m.byVoice!), ['voice_a', 'voice_b'])
  // voice_a: MISS 100,300,…,1900(10개) + HIT 5 → p50 = 5번째 900 · voice_b: MISS 200,…,2000(10개) + 실패 2 → p50 = 1000
  assert.deepEqual(m.byVoice!.voice_a, { requests: 15, errors: 0, p50Ms: 900 })
  assert.deepEqual(m.byVoice!.voice_b, { requests: 12, errors: 2, p50Ms: 1000 })
  // voiceId 가 하나도 없으면 byVoice 는 null(빈 객체가 아니다), 표본 0 칸도 null.
  const old = aggregateTtsTraces([preview(at, [hit(0, 3)], 5)]).byKey.get(KEY)!
  assert.equal(old.byVoice, null)
  assert.equal(old.p50Ms, null)
  assert.equal(old.avgMs, null)
  assert.equal(old.rtfAvg, null)
  assert.equal(old.cacheHitRate, 1)
})

test('결과에 단계의 다른 칸(문장·사용자 등)이 새지 않는다 — 숫자·연결 키·목소리 id 만', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const leaky = { ...miss(0, 500, { voiceId: 'voice_a' }), text: '本文です', userId: 'user_secret_1' }
  const json = JSON.stringify([...aggregateTtsTraces([preview(at, [leaky], 600)]).byKey])
  assert.ok(!json.includes('本文'))
  assert.ok(!json.includes('user_secret_1'))
})

test('REV-119 M-1 — 목소리 id 가 __proto__·constructor·toString 이어도 byVoice 자기 속성으로 남고(집계·저장 JSON 왕복), 프로토타입·전역은 그대로', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const traces = [
    preview(at, [miss(0, 300, { voiceId: '__proto__' })], 310),
    preview(at, [miss(0, 500, { voiceId: '__proto__' })], 510),
    preview(at, [fail(0, 'FAILED', { voiceId: 'constructor' })], null),
    preview(at, [miss(0, 700, { voiceId: 'toString' })], 710),
    preview(at, [miss(0, 900, { voiceId: 'voice_a' })], 910),
  ]
  const m = aggregateTtsTraces(traces).byKey.get(KEY)!
  assert.equal(Object.getPrototypeOf(m.byVoice), Object.prototype)
  assert.deepEqual(Object.keys(m.byVoice!), ['__proto__', 'constructor', 'toString', 'voice_a'])
  assert.ok(Object.hasOwn(m.byVoice!, '__proto__'))
  assert.deepEqual(Object.getOwnPropertyDescriptor(m.byVoice!, '__proto__')?.value, { requests: 2, errors: 0, p50Ms: 300 })
  assert.deepEqual(m.byVoice!.constructor, { requests: 1, errors: 1, p50Ms: null })
  assert.deepEqual(m.byVoice!.toString, { requests: 1, errors: 0, p50Ms: 700 })
  // 저장(JSON) → 읽기(parseByVoice) 왕복이 같다
  const json = JSON.stringify(m.byVoice)
  assert.ok(json.startsWith('{"__proto__":{"requests":2'))
  const back = parseByVoice(JSON.parse(json))!
  assert.equal(JSON.stringify(back), json)
  assert.equal(Object.getPrototypeOf(back), Object.prototype)
  assert.ok(Object.hasOwn(back, '__proto__'))
  // 모양이 틀린 항목은 버리고 남는 게 없으면 null(기존 규칙 그대로)
  assert.equal(parseByVoice(JSON.parse('{"__proto__":{"requests":"x"},"a b":{"requests":1,"errors":0}}')), null)
  assert.equal(({} as Record<string, unknown>).requests, undefined) // 전역 오염 없음
})

test('byVoice 상한 — 목소리 60개면 요청이 많은 50개만 이름순으로(fromEntries 로 바꾼 뒤에도 그대로)', () => {
  const at = new Date('2026-10-05T03:00:00Z')
  const traces: TraceScanRow[] = []
  for (let v = 1; v <= 60; v++) for (let i = 0; i < v; i++) traces.push(preview(at, [hit(0, 3, { voiceId: `v${String(v).padStart(2, '0')}` })], 5))
  const m = aggregateTtsTraces(traces).byKey.get(KEY)!
  assert.equal(BY_VOICE_MAX, 50)
  assert.deepEqual(Object.keys(m.byVoice!), Array.from({ length: 50 }, (_, i) => `v${i + 11}`))
  assert.equal(m.requests, (60 * 61) / 2)
  assert.deepEqual(m.byVoice!.v60, { requests: 60, errors: 0, p50Ms: null })
})

// ── 메모리 저장소 ───────────────────────────────────────────────────────────

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}
const tick = () => new Promise((r) => setTimeout(r, 5))

class MemStore implements TtsMetricsStore {
  rows = new Map<string, StoredTtsDay>()
  scans = 0
  inserts = 0
  /** write-once 위반 감시 — `update`·`upsert` 가 불린 횟수(F-1 이후 0 이어야 한다). */
  overwrites = 0
  /** 동시성 재현: INSERT 전 틈 — 겹친 두 요청이 모두 "행 없음" 을 보고 계산한 뒤 늦은 쪽 INSERT 가 유니크 위반(P2002)으로 진다. */
  raceGapMs = 0
  /** 스캔 호출 순번(0부터)별 게이트 — 결과를 그 시점 Trace 로 정한 뒤 게이트가 풀릴 때까지 돌려주지 않는다(늦게 끝나는 계산 재현). */
  scanGates = new Map<number, Promise<void>>()
  constructor(
    public conns: TtsConnectionRef[],
    public traces: TraceScanRow[],
  ) {}
  async ttsConnections() {
    return this.conns
  }
  async storedDays(ids: readonly string[], from: string, to: string) {
    return [...this.rows.values()].filter((r) => ids.includes(r.connectionId) && r.date >= from && r.date <= to)
  }
  async scanTraces(_env: Environment, start: Date, end: Date, after: { createdAt: Date; traceId: string } | null, take: number) {
    const n = this.scans++
    const out = this.traces
      .filter((t) => t.createdAt >= start && t.createdAt < end && (t.kind === 'TURN' || t.kind === 'PREVIEW'))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.traceId < b.traceId ? -1 : 1))
      .filter((t) => !after || t.createdAt > after.createdAt || (t.createdAt.getTime() === after.createdAt.getTime() && t.traceId > after.traceId))
      .slice(0, take)
    const gate = this.scanGates.get(n)
    if (gate) await gate
    return out
  }
  async insertDayIfAbsent(row: { connectionId: string; date: string; metrics: TtsDayMetrics; computedAt: Date }) {
    this.inserts++
    const k = `${row.connectionId}|${row.date}`
    // insertTtsDayRowOnce 를 그대로 태운다 — 유니크 위반 → 다시 읽기 → 정상 처리까지 실제 코드로 검증.
    // update·upsert 는 Prisma 의미대로 흉내 내되 세기만 한다(옛 last-writer-wins 경로로 되돌리면 값이 덮이고 overwrites 가 오른다).
    const db = {
      engineMetricsDaily: {
        create: async (a: { data: Record<string, unknown> }) => {
          if (this.raceGapMs) await new Promise((r) => setTimeout(r, this.raceGapMs))
          if (this.rows.has(k)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
          this.rows.set(k, this.toRow(row.connectionId, row.date, a.data))
        },
        findUnique: async () => (this.rows.has(k) ? { connectionId: row.connectionId } : null),
        upsert: async (a: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          this.overwrites++
          this.rows.set(k, this.toRow(row.connectionId, row.date, this.rows.has(k) ? a.update : a.create))
        },
        update: async (a: { data: Record<string, unknown> }) => {
          this.overwrites++
          this.rows.set(k, this.toRow(row.connectionId, row.date, a.data))
        },
      },
    } as unknown as MetricsDayDb
    return (await insertTtsDayRowOnce(db, row)) === 'CREATED'
  }
  private toRow(connectionId: string, date: string, d: Record<string, unknown>): StoredTtsDay {
    const byVoice = d.byVoice === Prisma.DbNull || d.byVoice == null ? null : (d.byVoice as StoredTtsDay['byVoice'])
    return {
      connectionId,
      date,
      computedAt: d.computedAt as Date,
      requests: d.requests as number,
      errors: d.errors as number,
      avgMs: d.avgMs as number | null,
      p50Ms: d.p50Ms as number | null,
      p95Ms: d.p95Ms as number | null,
      p99Ms: d.p99Ms as number | null,
      ttfaP50Ms: d.ttfaP50Ms as number | null,
      ttfaP95Ms: d.ttfaP95Ms as number | null,
      rtfAvg: d.rtfAvg as number | null,
      cacheHitRate: d.cacheHitRate as number | null,
      byVoice,
    }
  }
}

const conn = (o: Partial<TtsConnectionRef> = {}): TtsConnectionRef => ({ id: 'ec_tts', key: KEY, name: 'TTS', enabled: true, status: 'HEALTHY', createdAt: new Date('2026-09-01T00:00:00Z'), ...o })
const strip = (r: StoredTtsDay | undefined) => (r ? { ...r, computedAt: undefined } : r)

// 2026-10-06 12:00 KST
const NOW = new Date('2026-10-06T03:00:00Z')

test('KST 날짜 경계 — 10-04T15:00Z 는 10-05 의 첫 순간, 14:59:59.999Z 는 10-04 / 끝난 날 판정에 2분 유예', () => {
  assert.equal(kstDayBounds('2026-10-05').start.toISOString(), '2026-10-04T15:00:00.000Z')
  assert.equal(kstDayBounds('2026-10-05').end.toISOString(), '2026-10-05T15:00:00.000Z')
  assert.equal(isFinalDay('2026-10-05', new Date('2026-10-05T15:01:59Z')), false)
  assert.equal(isFinalDay('2026-10-05', new Date(Date.parse('2026-10-05T15:00:00Z') + FINAL_GRACE_MS)), true)
})

test('지연 물화 — 끝난 날만 날짜·연결별 행, 표본 0 인 날도 0 행, 연결 생성 전 날·오늘은 쓰지 않음, 경계 Trace 는 KST 날짜로', async () => {
  const traces = [
    preview(new Date('2026-10-04T14:59:59.999Z'), [miss(0, 400)], 450), // 10-04 KST 23:59:59.999
    preview(new Date('2026-10-04T15:00:00.000Z'), [miss(0, 800)], 850), // 10-05 KST 00:00
    preview(new Date('2026-10-05T10:00:00Z'), [hit(0, 3)], 5), // 10-05
    preview(new Date('2026-10-06T01:00:00Z'), [miss(0, 999)], 1000), // 10-06 = 오늘(물화 안 함)
    // 다른 연결 키·다른 역할 키는 저장 대상 아님
    preview(new Date('2026-10-05T10:00:00Z'), [miss(0, 100, { key: 'unknown-conn' })], 120),
  ]
  const late = conn({ id: 'ec_late', key: 'tts-late', createdAt: new Date('2026-10-05T12:00:00Z') }) // 10-05 KST 21:00 생성
  const store = new MemStore([conn(), late], traces)
  const written = await materializeTtsDays({ environment: ENV, from: '2026-10-03', to: '2026-10-06', now: NOW, store })
  // ec_tts: 10-03·10-04·10-05 (3) + ec_late: 10-05 (1) = 4. 오늘 10-06 은 없음.
  assert.equal(written, 4)
  assert.deepEqual([...store.rows.keys()].sort(), ['ec_late|2026-10-05', 'ec_tts|2026-10-03', 'ec_tts|2026-10-04', 'ec_tts|2026-10-05'])
  assert.equal(store.rows.get('ec_tts|2026-10-03')!.requests, 0)
  assert.equal(store.rows.get('ec_tts|2026-10-03')!.p50Ms, null)
  assert.equal(store.rows.get('ec_tts|2026-10-04')!.p50Ms, 400)
  const d5 = store.rows.get('ec_tts|2026-10-05')!
  assert.equal(d5.requests, 2)
  assert.equal(d5.p50Ms, 800)
  assert.equal(d5.cacheHitRate, 0.5)
  assert.equal(store.rows.get('ec_late|2026-10-05')!.requests, 0)
})

test('멱등 — 같은 날 두 번 물화하면 두 번째는 0행·값 그대로, 이미 있는 행은 다시 계산하지 않음', async () => {
  const store = new MemStore([conn()], [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700, { voiceId: 'voice_a' })], 720)])
  assert.equal(await materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now: NOW, store }), 1)
  const first = strip(store.rows.get('ec_tts|2026-10-05'))
  const scans = store.scans
  assert.equal(await materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now: new Date(NOW.getTime() + 3600_000), store }), 0)
  assert.equal(store.scans, scans)
  assert.deepEqual(strip(store.rows.get('ec_tts|2026-10-05')), first)
  assert.deepEqual(first!.byVoice, { voice_a: { requests: 1, errors: 0, p50Ms: 700 } })
})

test('동시성 — 두 요청이 겹쳐 물화해도 (연결, 날짜) 행 1개·값 같음(늦은 INSERT 는 유니크 위반 → 다시 읽어 정상, 덮지 않음)', async () => {
  const traces = [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720), preview(new Date('2026-10-05T04:00:00Z'), [fail(0, 'FAILED')], null)]
  const store = new MemStore([conn()], traces)
  store.raceGapMs = 5
  const [a, b] = await Promise.all([
    materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now: NOW, store }),
    materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now: NOW, store }),
  ])
  assert.equal(store.inserts, 2) // 둘 다 "없음" 을 보고 계산해 INSERT 를 시도했다
  assert.equal(a + b, 1) // 반환값 = 실제로 만든 행 수
  assert.equal(store.overwrites, 0)
  assert.equal(store.rows.size, 1)
  const r = store.rows.get('ec_tts|2026-10-05')!
  assert.equal(r.requests, 2)
  assert.equal(r.errors, 1)
  assert.equal(r.p50Ms, 700)
})

test('insertTtsDayRowOnce(REV-123 F-1) — create 만 쓴다: 성공 CREATED · 실패 후 행이 있으면(P2002·P2034 무관) EXISTED · 행이 없거나 다시 읽기도 실패하면 원래 오류 · byVoice null 은 DbNull', async () => {
  const metrics: TtsDayMetrics = { requests: 1, errors: 0, avgMs: 5, p50Ms: 5, p95Ms: null, p99Ms: null, ttfaP50Ms: 6, ttfaP95Ms: null, rtfAvg: null, cacheHitRate: 0, byVoice: null }
  const row = { connectionId: 'c', date: '2026-10-05', metrics, computedAt: NOW }
  const fake = (createError: Error | null, onRead: 'row' | 'none' | 'throw') => {
    const calls: string[] = []
    let created: Record<string, unknown> | null = null
    let readWhere: unknown = null
    const db = {
      engineMetricsDaily: {
        create: async (a: { data: Record<string, unknown> }) => {
          calls.push('create')
          if (createError) throw createError
          created = a.data
        },
        findUnique: async (a: { where: unknown }) => {
          calls.push('findUnique')
          readWhere = a.where
          if (onRead === 'throw') throw new Error('read failed')
          return onRead === 'row' ? { connectionId: 'c' } : null
        },
        update: async () => void calls.push('update'),
        upsert: async () => void calls.push('upsert'),
      },
    } as unknown as MetricsDayDb
    return { db, calls, created: () => created, readWhere: () => readWhere }
  }
  const err = (code: string, msg: string) => Object.assign(new Error(msg), { code })

  const ok = fake(null, 'none')
  assert.equal(await insertTtsDayRowOnce(ok.db, row), 'CREATED')
  assert.deepEqual(ok.calls, ['create'])
  const data = ok.created()!
  assert.equal(data.connectionId, 'c')
  assert.equal((data.date as Date).toISOString(), '2026-10-05T00:00:00.000Z')
  assert.equal(data.requests, 1)
  assert.equal(data.computedAt, NOW)
  assert.equal(data.byVoice, Prisma.DbNull)

  const dup = fake(err('P2002', 'dup'), 'row')
  assert.equal(await insertTtsDayRowOnce(dup.db, row), 'EXISTED')
  assert.deepEqual(dup.calls, ['create', 'findUnique'])
  assert.equal(dup.created(), null)
  assert.deepEqual(dup.readWhere(), { connectionId_date: { connectionId: 'c', date: new Date('2026-10-05T00:00:00.000Z') } })

  const deadlock = fake(err('P2034', 'deadlock'), 'row')
  assert.equal(await insertTtsDayRowOnce(deadlock.db, row), 'EXISTED')
  assert.deepEqual(deadlock.calls, ['create', 'findUnique'])

  const dupNoRow = fake(err('P2002', 'dup-no-row'), 'none')
  await assert.rejects(insertTtsDayRowOnce(dupNoRow.db, row), /dup-no-row/)
  assert.deepEqual(dupNoRow.calls, ['create', 'findUnique'])

  const down = fake(err('P1001', 'db down'), 'throw')
  await assert.rejects(insertTtsDayRowOnce(down.db, row), /db down/) // 다시 읽기 오류가 아니라 원래 오류
  for (const f of [ok, dup, deadlock, dupNoRow, down]) assert.ok(!f.calls.includes('update') && !f.calls.includes('upsert'))
})

test('write-once(REV-123 F-1) — 서로 다른 스냅샷으로 겹쳐 계산해도 먼저 저장된 행이 남는다(늦게 끝난 쪽은 덮지 않고 0행), 다음 날 재조회도 0행·computedAt 불변', async () => {
  const k = 'ec_tts|2026-10-05'
  const t1 = preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720)
  // A 가 훑은 뒤·B 가 훑기 전에 보이게 된 10-05 소속 Trace 가정(현재 데이터 흐름에는 없는 경로 — 쓰기 경로가 불변을 강제하는지만 본다).
  const t2 = preview(new Date('2026-10-05T10:00:00Z'), [miss(0, 900)], 920)
  const run = (store: MemStore, now: Date) => materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now, store })
  const nowB = new Date(NOW.getTime() + 1_000)

  // ① 더 완전한 B 가 먼저 커밋 → 늦게 끝난 A(덜 완전)는 덮지 않는다.
  const s1 = new MemStore([conn()], [t1])
  const gateA = deferred()
  s1.scanGates.set(0, gateA.promise)
  const pendingA = run(s1, NOW)
  await tick()
  s1.traces.push(t2)
  assert.equal(await run(s1, nowB), 1)
  const afterB = { ...s1.rows.get(k)! }
  assert.equal(afterB.requests, 2)
  assert.equal(afterB.computedAt, nowB)
  gateA.resolve()
  const createdByA = await pendingA
  assert.equal(s1.rows.get(k)!.requests, 2) // 값부터 — 옛 last-writer-wins 면 여기서 1
  assert.deepEqual(s1.rows.get(k), afterB)
  assert.equal(createdByA, 0)
  assert.equal(s1.inserts, 2)
  assert.equal(s1.overwrites, 0)
  const scans = s1.scans
  assert.equal(await run(s1, new Date(NOW.getTime() + 86_400_000)), 0)
  assert.equal(s1.scans, scans)
  assert.deepEqual(s1.rows.get(k), afterB)

  // ② 덜 완전한 A 가 먼저 커밋하면 A 의 값이 남는다 — "첫 커밋 유지" 이지 "가장 완전한 값" 이 아니다(의도 고정).
  const s2 = new MemStore([conn()], [t1])
  const gateA2 = deferred()
  const gateB2 = deferred()
  s2.scanGates.set(0, gateA2.promise)
  s2.scanGates.set(1, gateB2.promise)
  const pendingA2 = run(s2, NOW)
  await tick()
  s2.traces.push(t2)
  const pendingB2 = run(s2, nowB)
  await tick()
  gateA2.resolve()
  const createdByA2 = await pendingA2
  gateB2.resolve()
  const createdByB2 = await pendingB2
  const r2 = s2.rows.get(k)!
  assert.equal(r2.requests, 1)
  assert.equal(r2.p50Ms, 700)
  assert.equal(r2.computedAt, NOW)
  assert.deepEqual([createdByA2, createdByB2], [1, 0])
  assert.equal(s2.overwrites, 0)
})

test('물화 한도 — 오늘 포함 90일보다 오래된 날은 행을 쓰지 않는다(Trace 보존 밖 0 행 = 거짓)', async () => {
  const store = new MemStore([conn({ createdAt: new Date('2026-01-01T00:00:00Z') })], [])
  const written = await materializeTtsDays({ environment: ENV, from: '2026-06-01', to: '2026-10-05', now: NOW, store })
  // 2026-10-06 기준 90일 = 07-09 ~ 10-06, 끝난 날은 07-09 ~ 10-05 = 89일
  assert.equal(written, 89)
  assert.ok([...store.rows.keys()].every((k) => k.split('|')[1] >= '2026-07-09'))
})

test('조회 — 지난 날 MATERIALIZED + 오늘 LIVE(60초 캐시), 연결 필터, 연결 생성 전 날은 NONE', async () => {
  clearTtsLiveCache()
  const traces = [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720), preview(new Date('2026-10-06T01:00:00Z'), [miss(0, 300)], 320)]
  const store = new MemStore([conn(), conn({ id: 'ec_b', key: 'tts-b', createdAt: new Date('2026-10-05T16:00:00Z') })], traces)
  const r = await getTtsMetrics({ environment: ENV, from: '2026-10-04', to: '2026-10-06', now: NOW, store, writable: true })
  assert.equal(r.today, '2026-10-06')
  const a = r.connections.find((c) => c.connection.id === 'ec_tts')!
  assert.deepEqual(a.days.map((d) => [d.date, d.source, d.requests]), [
    ['2026-10-04', 'MATERIALIZED', 0],
    ['2026-10-05', 'MATERIALIZED', 1],
    ['2026-10-06', 'LIVE', 1],
  ])
  assert.equal(a.days[2].p50Ms, 300)
  const b = r.connections.find((c) => c.connection.id === 'ec_b')!
  assert.deepEqual(b.days.map((d) => d.source), ['NONE', 'NONE', 'LIVE'])
  // 60초 안 재조회는 오늘을 다시 훑지 않는다, 61초 뒤에는 훑는다(새 Trace 반영).
  const scans = store.scans
  store.traces.push(preview(new Date('2026-10-06T02:59:00Z'), [miss(0, 900)], 920))
  const r2 = await getTtsMetrics({ environment: ENV, from: '2026-10-06', to: '2026-10-06', now: new Date(NOW.getTime() + 30_000), store, connectionIds: ['ec_tts'], writable: true })
  assert.equal(store.scans, scans)
  assert.equal(r2.connections.length, 1)
  assert.equal(r2.connections[0].days[0].requests, 1)
  const r3 = await getTtsMetrics({ environment: ENV, from: '2026-10-06', to: '2026-10-06', now: new Date(NOW.getTime() + 61_000), store, connectionIds: ['ec_tts'], writable: true })
  assert.equal(r3.connections[0].days[0].requests, 2)
  // 오늘은 저장하지 않는다.
  assert.ok(![...store.rows.keys()].some((k) => k.endsWith('2026-10-06')))
})

test('liveCache 단조 갱신(REV-123 F-2) — 겹친 미스에서 더 이른 now 의 계산이 늦게 끝나도 신선한 항목을 덮지 않고, 60초 뒤 새 계산은 교체된다', async () => {
  clearTtsLiveCache()
  const t0 = NOW.getTime()
  const store = new MemStore([conn()], [preview(new Date(t0 - 30_000), [miss(0, 500)], 510)])
  const gateA = deferred()
  store.scanGates.set(0, gateA.promise)
  const q = (ms: number) => getTtsMetrics({ environment: ENV, from: '2026-10-06', to: '2026-10-06', now: new Date(t0 + ms), store, writable: true })
  const req = (r: Awaited<ReturnType<typeof getTtsMetrics>>) => r.connections[0].days[0].requests
  const pendingA = q(0)
  await tick()
  store.traces.push(preview(new Date(t0 + 2_000), [miss(0, 600)], 610)) // A 의 now 뒤·B 의 now 앞
  const rB = await q(5_000)
  assert.equal(req(rB), 2)
  gateA.resolve()
  const rA = await pendingA
  assert.equal(req(rA), 1) // A 는 자기가 계산한 값을 돌려준다
  assert.equal(store.scans, 2)
  const rC = await q(10_000) // 캐시 히트 — B 의 값(A 가 덮었다면 1)
  assert.equal(req(rC), 2)
  assert.equal(rC.connections[0].days[0].computedAt!.getTime(), t0 + 5_000)
  assert.equal(store.scans, 2)
  // 60초가 지나면 다시 훑고(더 새로운 now) 항목을 교체한다.
  store.traces.push(preview(new Date(t0 + 20_000), [miss(0, 700)], 710))
  const rD = await q(65_000)
  assert.equal(req(rD), 3)
  assert.equal(store.scans, 3)
  const rE = await q(70_000)
  assert.equal(req(rE), 3)
  assert.equal(rE.connections[0].days[0].computedAt!.getTime(), t0 + 65_000)
  assert.equal(store.scans, 3)
})

test('조회 — TTS 연결이 없는 환경은 빈 목록(물화·스캔 0)', async () => {
  const store = new MemStore([], [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720)])
  const r = await getTtsMetrics({ environment: ENV, from: '2026-10-05', to: '2026-10-06', now: NOW, store })
  assert.deepEqual(r.connections, [])
  assert.equal(store.scans, 0)
})

// ── 점검 보완(dev 2차, 2026-10-06) ───────────────────────────────────────────

test('고아 실패 연결 — 켜진 TTS 연결이 하나면 그 키(꺼진 시험 연결이 더 있어도), 켜진 것이 둘 이상이면 null, 켜진 것이 없으면 하나뿐일 때만', async () => {
  const on = conn()
  const off = conn({ id: 'ec_off', key: 'tts-off', enabled: false, status: 'DISABLED' })
  assert.equal(fallbackKeyOf([on]), KEY)
  assert.equal(fallbackKeyOf([on, off]), KEY)
  assert.equal(fallbackKeyOf([on, conn({ id: 'ec_2', key: 'tts-2' })]), null)
  assert.equal(fallbackKeyOf([off]), 'tts-off')
  assert.equal(fallbackKeyOf([off, conn({ id: 'ec_off2', key: 'tts-off2', enabled: false })]), null)
  assert.equal(fallbackKeyOf([]), null)
  // 물화에서도 같은 규칙 — 합성 단계 없는 자막 전환 실패가 켜진 연결로 간다.
  const textOnly = turn(new Date('2026-10-05T03:00:00Z'), [{ name: 'TTS[0]', ms: 3, chunkIndex: 0, status: 'SKIPPED', errorCode: 'TTS_UNAVAILABLE' }])
  const store = new MemStore([on, off], [textOnly])
  await materializeTtsDays({ environment: ENV, from: '2026-10-05', to: '2026-10-05', now: NOW, store })
  assert.deepEqual([store.rows.get('ec_tts|2026-10-05')!.requests, store.rows.get('ec_tts|2026-10-05')!.errors], [1, 1])
  assert.equal(store.rows.get('ec_off|2026-10-05')!.requests, 0)
})

test('다른 환경 보기(writable=false) — 행을 쓰지 않고, 행 없는 끝난 날은 즉석 집계(LIVE), 저장된 행은 그대로 MATERIALIZED, 생성 전 날은 NONE', async () => {
  clearTtsLiveCache()
  const traces = [preview(new Date('2026-10-04T03:00:00Z'), [miss(0, 400)], 410), preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720), preview(new Date('2026-10-06T01:00:00Z'), [miss(0, 300)], 320)]
  const late = conn({ id: 'ec_late', key: 'tts-late', createdAt: new Date('2026-10-04T16:00:00Z') }) // 10-05 KST 01:00 생성
  const store = new MemStore([conn(), late], traces)
  // 10-04 행은 그 환경 프로세스가 이미 써 두었다(값을 일부러 다르게 — 다시 계산하지 않는지 확인).
  store.rows.set('ec_tts|2026-10-04', { connectionId: 'ec_tts', date: '2026-10-04', computedAt: NOW, requests: 99, errors: 0, avgMs: 1, p50Ms: 1, p95Ms: null, p99Ms: null, ttfaP50Ms: null, ttfaP95Ms: null, rtfAvg: null, cacheHitRate: 0, byVoice: null })
  const before = store.inserts
  const r = await getTtsMetrics({ environment: ENV, from: '2026-10-04', to: '2026-10-06', now: NOW, store, writable: false })
  assert.equal(store.inserts, before)
  assert.equal(store.rows.size, 1)
  const a = r.connections.find((c) => c.connection.id === 'ec_tts')!
  assert.deepEqual(a.days.map((d) => [d.date, d.source, d.requests]), [
    ['2026-10-04', 'MATERIALIZED', 99],
    ['2026-10-05', 'LIVE', 1],
    ['2026-10-06', 'LIVE', 1],
  ])
  assert.equal(a.days[1].p50Ms, 700)
  const b = r.connections.find((c) => c.connection.id === 'ec_late')!
  assert.deepEqual(b.days.map((d) => [d.date, d.source]), [
    ['2026-10-04', 'NONE'],
    ['2026-10-05', 'LIVE'],
    ['2026-10-06', 'LIVE'],
  ])
})

test('writable 기본값 — 조회 환경이 APP_ENV 와 같을 때만 물화(다르면 행 0)', async () => {
  const saved = process.env.APP_ENV
  try {
    process.env.APP_ENV = 'PRODUCTION'
    clearTtsLiveCache()
    const s1 = new MemStore([conn()], [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720)])
    await getTtsMetrics({ environment: 'LOCAL', from: '2026-10-05', to: '2026-10-05', now: NOW, store: s1 })
    assert.equal(s1.rows.size, 0)
    process.env.APP_ENV = 'local'
    clearTtsLiveCache()
    const s2 = new MemStore([conn()], [preview(new Date('2026-10-05T03:00:00Z'), [miss(0, 700)], 720)])
    await getTtsMetrics({ environment: 'LOCAL', from: '2026-10-05', to: '2026-10-05', now: NOW, store: s2 })
    assert.equal(s2.rows.size, 1)
  } finally {
    if (saved === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = saved
  }
})
