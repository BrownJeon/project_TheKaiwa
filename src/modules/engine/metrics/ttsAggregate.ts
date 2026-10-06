/**
 * TTS 일별 지표 계산(순수 함수, task-012b-3 · speech-platform/16 §7.1·§7.3) — `RequestTrace.steps[]` 의 TTS 하위 단계를 연결별로 모은다.
 * DB·시계를 모른다. 읽기·쓰기·날짜 경계는 `./index.ts`.
 *
 * 원천(단계 이름·키는 `speech/tts/metrics.ts` 화이트리스트와 같아야 한다 — engine 은 speech 를 import 할 수 없어 이름을 여기에 다시 적는다):
 * - `TTS_SYNTH[i]` — 청크 1개의 캐시 조회 + (MISS 면) 엔진 합성. `connectionKey`·`status`·`cacheHit`·`rtf`·`voiceId`(task-012b-3 부터).
 * - `TTS`(부모, PREVIEW Trace 만) — `ttfaMs`.
 * - `TTS[i]`(TURN Trace 만, 턴 오디오 큐) — 청크 상태, 청크 0 의 `ttfaServerMs`.
 *
 * 표본 단위·정의(EngineMetricsDaily 칸):
 * - requests = `connectionKey` 가 있는 `TTS_SYNTH[i]` 수(청크 단위 요청, 캐시 HIT 포함) + 아래 "고아 실패".
 * - errors = 그중 status 가 'OK' 가 아닌 것(FAILED·TIMEOUT·SKIPPED). status 가 없는 옛 단계는 errorCode 가 있으면 실패로 본다.
 * - avgMs·p50/p95/p99Ms = **성공한 MISS**(status OK, cacheHit 가 true 아님) 단계의 `ms`(앱이 본 조회+합성 왕복). HIT·합류(SHARED)는 넣지 않는다.
 * - rtfAvg = 성공한 MISS 의 `rtf`(= synthMs / audioMs, 유한한 양수만) 산술 평균, 소수 4자리.
 * - cacheHitRate = cacheHit 가 true 인 단계 수 / requests, 소수 4자리.
 * - ttfaP50Ms·ttfaP95Ms = Trace 1건당 표본 1개 — PREVIEW 는 부모 `TTS.ttfaMs`, TURN 은 `TTS[0].ttfaServerMs`(§6.4 ttfaServerMs). HIT·MISS 합산.
 *   연결은 같은 Trace 의 `TTS_SYNTH[0]`(없으면 Trace 안 유일한 connectionKey)으로 정한다.
 * - byVoice = `{voiceId: {requests, errors, p50Ms}}` — `voiceId` 가 실린 단계만(그 전 Trace 는 빠진다). 해당 표본이 0 이면 칸 전체 null.
 * - 고아 실패: TURN 에서 `TTS[i]` 가 실패인데 같은 청크의 `TTS_SYNTH[i]` 가 없는 경우(턴 9초 상한·자막 전환 — 합성 쪽 단계가 Trace 에 오지 않음).
 *   Trace 안의 유일한 connectionKey, 없으면 호출자가 준 `fallbackKey`(켜진 TTS 연결이 하나뿐일 때 그 키 — `index.ts` fallbackKeyOf)로 요청+오류 1건. 그래도 모르면 버린다.
 *
 * 백분위 = nearest-rank(오름차순 정렬 후 ⌈p/100·n⌉ 번째, `engine/trace` turnStats24h 와 같은 방식).
 * 표본이 `PERCENTILE_MIN_SAMPLES` 보다 적으면 null — pX 가 최댓값과 구별되는 최소 표본(⌈100/(100−X)⌉)이다. 표본 0 은 언제나 null(0 이 아니다).
 */
import type { TraceKind } from '@prisma/client'

/** 집계 대상 Trace 종류. PLAYGROUND(사전 미리듣기)·FUNCTIONAL_TEST·E2E 는 합성 트래픽이라 넣지 않는다(admin-console/13 §10 "섞지 않는다"). */
export const TTS_TRACE_KINDS: readonly TraceKind[] = ['TURN', 'PREVIEW']

export const PERCENTILE_MIN_SAMPLES = { 50: 1, 95: 20, 99: 100 } as const
export type PercentileRank = keyof typeof PERCENTILE_MIN_SAMPLES

/** byVoice 에 담는 목소리 수 상한(행 크기 보호). 요청 수가 많은 순으로 남긴다. */
export const BY_VOICE_MAX = 50

export interface TtsVoiceMetrics {
  requests: number
  errors: number
  p50Ms: number | null
}

/** EngineMetricsDaily 한 행에 들어가는 값(연결·날짜 제외). */
export interface TtsDayMetrics {
  requests: number
  errors: number
  avgMs: number | null
  p50Ms: number | null
  p95Ms: number | null
  p99Ms: number | null
  ttfaP50Ms: number | null
  ttfaP95Ms: number | null
  rtfAvg: number | null
  cacheHitRate: number | null
  byVoice: Record<string, TtsVoiceMetrics> | null
}

export interface TtsTraceInput {
  kind: TraceKind
  steps: unknown
}

const SYNTH = /^TTS_SYNTH\[(\d{1,3})\]$/
const TURN_CHUNK = /^TTS\[(\d{1,3})\]$/
const SAFE_ID = /^[\w.:-]{1,60}$/

/** nearest-rank 백분위. `sorted` 는 오름차순. 표본이 최소 수보다 적으면 null. */
export function nearestRank(sorted: readonly number[], p: PercentileRank): number | null {
  const n = sorted.length
  if (n === 0 || n < PERCENTILE_MIN_SAMPLES[p]) return null
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))]
}

const round4 = (v: number) => Math.round(v * 10_000) / 10_000
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && SAFE_ID.test(v) ? v : null)

type StepObj = Record<string, unknown> & { name: string }

function stepsOf(raw: unknown): StepObj[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is StepObj => !!s && typeof s === 'object' && typeof (s as { name?: unknown }).name === 'string')
}

function isOk(s: StepObj): boolean {
  if (typeof s.status === 'string') return s.status === 'OK'
  return !(typeof s.errorCode === 'string' && s.errorCode.length > 0)
}

interface ChunkSample {
  connectionKey: string
  voiceId: string | null
  ok: boolean
  cacheHit: boolean
  latencyMs: number | null
  rtf: number | null
}

export interface TraceSamples {
  chunks: ChunkSample[]
  ttfa: { connectionKey: string; ms: number } | null
  /** 연결을 정하지 못해 버린 표본 수(청크 + 고아 실패 + TTFA) — 테스트·로그용. */
  dropped: number
}

/** Trace 1건 → 표본. 종류가 대상이 아니거나 TTS 단계가 없으면 빈 결과. */
export function extractTtsSamples(trace: TtsTraceInput, fallbackKey: string | null = null): TraceSamples {
  const out: TraceSamples = { chunks: [], ttfa: null, dropped: 0 }
  if (!TTS_TRACE_KINDS.includes(trace.kind)) return out
  const steps = stepsOf(trace.steps)
  const synthIdx = new Set<number>()
  const keys = new Set<string>()
  let key0: string | null = null
  for (const s of steps) {
    const m = SYNTH.exec(s.name)
    if (!m) continue
    const idx = Number(m[1])
    synthIdx.add(idx)
    const key = str(s.connectionKey)
    if (!key) {
      out.dropped++
      continue
    }
    keys.add(key)
    if (idx === 0 && key0 === null) key0 = key
    const ok = isOk(s)
    const cacheHit = s.cacheHit === true
    const ms = num(s.ms)
    const rtf = num(s.rtf)
    out.chunks.push({
      connectionKey: key,
      voiceId: str(s.voiceId),
      ok,
      cacheHit,
      latencyMs: ok && !cacheHit && ms !== null && ms >= 0 ? ms : null,
      rtf: ok && !cacheHit && rtf !== null && rtf > 0 ? rtf : null,
    })
  }
  const soleKey = keys.size === 1 ? [...keys][0] : null
  const traceKey = key0 ?? soleKey

  if (trace.kind === 'TURN') {
    for (const s of steps) {
      const m = TURN_CHUNK.exec(s.name)
      if (!m) continue
      const idx = Number(m[1])
      if (idx === 0) {
        const t = num(s.ttfaServerMs)
        if (t !== null && t >= 0 && isOk(s)) {
          if (traceKey) out.ttfa = { connectionKey: traceKey, ms: t }
          else out.dropped++
        }
      }
      if (isOk(s) || synthIdx.has(idx)) continue
      const k = soleKey ?? (keys.size === 0 ? fallbackKey : null)
      if (k) out.chunks.push({ connectionKey: k, voiceId: null, ok: false, cacheHit: false, latencyMs: null, rtf: null })
      else out.dropped++
    }
  } else {
    const parent = steps.find((s) => s.name === 'TTS')
    const t = parent ? num(parent.ttfaMs) : null
    if (parent && t !== null && t >= 0 && isOk(parent)) {
      if (traceKey) out.ttfa = { connectionKey: traceKey, ms: t }
      else out.dropped++
    }
  }
  return out
}

interface VoiceAcc {
  requests: number
  errors: number
  latency: number[]
}

/** 연결 하나·하루 하나의 누적기. `add` 로 표본을 넣고 `finish` 로 칸 값을 만든다. */
export class TtsDayAccumulator {
  requests = 0
  errors = 0
  hits = 0
  private readonly latency: number[] = []
  private rtfSum = 0
  private rtfN = 0
  private readonly ttfa: number[] = []
  private readonly voices = new Map<string, VoiceAcc>()

  addChunk(c: ChunkSample): void {
    this.requests++
    if (!c.ok) this.errors++
    if (c.cacheHit) this.hits++
    if (c.latencyMs !== null) this.latency.push(c.latencyMs)
    if (c.rtf !== null) {
      this.rtfSum += c.rtf
      this.rtfN++
    }
    if (c.voiceId) {
      const v = this.voices.get(c.voiceId) ?? { requests: 0, errors: 0, latency: [] }
      v.requests++
      if (!c.ok) v.errors++
      if (c.latencyMs !== null) v.latency.push(c.latencyMs)
      this.voices.set(c.voiceId, v)
    }
  }

  addTtfa(ms: number): void {
    this.ttfa.push(ms)
  }

  finish(): TtsDayMetrics {
    const lat = [...this.latency].sort((a, b) => a - b)
    const tf = [...this.ttfa].sort((a, b) => a - b)
    const p = (v: number | null) => (v === null ? null : Math.round(v))
    let byVoice: Record<string, TtsVoiceMetrics> | null = null
    if (this.voices.size > 0) {
      // 키 순서를 고정해(이름순) 두 번 물화해도 같은 JSON 이 되게 한다. 상한을 넘으면 요청이 많은 목소리부터 남긴다.
      const kept = [...this.voices.entries()].sort((a, b) => b[1].requests - a[1].requests || (a[0] < b[0] ? -1 : 1)).slice(0, BY_VOICE_MAX)
      // fromEntries — id 가 `__proto__` 여도 자기 속성이 된다(대입 `o[id] = v` 는 프로토타입 setter 를 타서 값이 사라진다, REV-119 M-1).
      byVoice = Object.fromEntries(
        kept
          .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
          .map(([id, v]): [string, TtsVoiceMetrics] => [id, { requests: v.requests, errors: v.errors, p50Ms: p(nearestRank([...v.latency].sort((a, b) => a - b), 50)) }]),
      )
    }
    return {
      requests: this.requests,
      errors: this.errors,
      avgMs: lat.length ? Math.round(lat.reduce((s, v) => s + v, 0) / lat.length) : null,
      p50Ms: p(nearestRank(lat, 50)),
      p95Ms: p(nearestRank(lat, 95)),
      p99Ms: p(nearestRank(lat, 99)),
      ttfaP50Ms: p(nearestRank(tf, 50)),
      ttfaP95Ms: p(nearestRank(tf, 95)),
      rtfAvg: this.rtfN ? round4(this.rtfSum / this.rtfN) : null,
      cacheHitRate: this.requests ? round4(this.hits / this.requests) : null,
      byVoice,
    }
  }
}

/** 표본 0 인 날의 칸 값(물화 행이 "그날 계산했음" 을 남기도록 0 행도 쓴다). */
export function emptyTtsDay(): TtsDayMetrics {
  return new TtsDayAccumulator().finish()
}

/** Trace 여러 건 → 연결 키별 하루 값. 테스트·즉석 집계 공용. */
export function aggregateTtsTraces(traces: Iterable<TtsTraceInput>, fallbackKey: string | null = null): { byKey: Map<string, TtsDayMetrics>; dropped: number } {
  const accs = new Map<string, TtsDayAccumulator>()
  let dropped = 0
  const acc = (k: string) => {
    let a = accs.get(k)
    if (!a) accs.set(k, (a = new TtsDayAccumulator()))
    return a
  }
  for (const t of traces) {
    const s = extractTtsSamples(t, fallbackKey)
    dropped += s.dropped
    for (const c of s.chunks) acc(c.connectionKey).addChunk(c)
    if (s.ttfa) acc(s.ttfa.connectionKey).addTtfa(s.ttfa.ms)
  }
  const byKey = new Map<string, TtsDayMetrics>()
  for (const [k, a] of accs) byKey.set(k, a.finish())
  return { byKey, dropped }
}

/** 저장된 byVoice JSON → 값. 모양이 틀린 항목은 버린다(빈 결과면 null). 자기 속성만 읽고 fromEntries 로 만든다(위 `finish` 와 같은 이유). */
export function parseByVoice(raw: unknown): Record<string, TtsVoiceMetrics> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: [string, TtsVoiceMetrics][] = []
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!SAFE_ID.test(id) || !v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const requests = num(o.requests)
    const errors = num(o.errors)
    if (requests === null || errors === null) continue
    out.push([id, { requests, errors, p50Ms: num(o.p50Ms) }])
  }
  return out.length ? Object.fromEntries(out) : null
}
