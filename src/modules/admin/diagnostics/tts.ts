/**
 * task-012b-3 `GET /api/admin/v1/tts/metrics` 조합(module-dependency §11 — L0 `admin/diagnostics/tts` 가 `engine/metrics` 를 부른다).
 * 권한은 라우트 첫 줄 `requireCapability('trace.read')`(role-permission.md:49 — Diagnostics 지표·EngineMetricsDaily). 여기서는 입력 검증·연결 확인·DTO.
 *
 * - range: `today` | `7d`(기본) | `30d` | `90d` — 오늘(KST) 포함 끝나는 구간. 90일 = RequestTrace 보존 = 물화 한도.
 * - connectionId: 같은 환경의 TTS 연결(id 또는 key). 없으면 404(존재 비노출 문구), TTS 가 아닌 연결이면 400.
 * - voiceId: 형식만 검사(보관된 목소리의 지난 기록도 볼 수 있게 존재는 묻지 않는다). byVoice 를 그 목소리로 좁힌다.
 * GET 이지만 지난 날 물화 행을 쓸 수 있다(L-4 지연 물화) — 파생 집계라 AuditLog·ConfigurationVersion 대상이 아니다.
 */
import { ApiError, dates } from '@/modules/infra'
import { getConnection, getTtsMetrics, type TtsMetricsDay } from '@/modules/engine'
import type { Environment } from '@prisma/client'
import type { TtsMetricsDayDto, TtsMetricsDto, TtsMetricsRangeKey, TtsMetricsSummaryDto, TtsVoiceMetricsDto } from '@/types/admin'
import { hiddenNotFound } from '../permissions/guard'

export const TTS_METRICS_RANGES: Record<TtsMetricsRangeKey, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 }
const VOICE_ID = /^[\w.:-]{1,60}$/
const CONNECTION_REF = /^[\w.:-]{1,80}$/

export interface TtsMetricsQuery {
  range?: string | null
  connectionId?: string | null
  voiceId?: string | null
}

export function parseTtsMetricsRange(raw: string | null | undefined): TtsMetricsRangeKey {
  if (raw == null || raw === '') return '7d'
  if (Object.prototype.hasOwnProperty.call(TTS_METRICS_RANGES, raw)) return raw as TtsMetricsRangeKey
  throw new ApiError('VALIDATION', 'range 는 today·7d·30d·90d 중 하나여야 합니다.', { field: 'range' })
}

export function parseTtsVoiceId(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  if (!VOICE_ID.test(raw)) throw new ApiError('VALIDATION', 'voiceId 형식이 올바르지 않습니다.', { field: 'voiceId' })
  return raw
}

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10_000) / 10_000 : null)

/**
 * byVoice 에서 목소리 하나. 자기 속성만 본다 — `constructor`·`toString`·`__proto__` 는 voiceId 형식을 통과하므로
 * `byVoice[voiceId]` 로 집으면 Object.prototype 의 값이 나온다(REV-119 M-1).
 */
function voiceOf(byVoice: Record<string, TtsVoiceMetricsDto> | null, voiceId: string): TtsVoiceMetricsDto | null {
  return byVoice && Object.hasOwn(byVoice, voiceId) ? byVoice[voiceId] : null
}

/** 날짜 하나 → DTO. `voiceId` 가 있으면 byVoice 를 그 목소리 하나로 좁힌다(없으면 null). */
export function ttsDayDto(d: TtsMetricsDay, voiceId: string | null): TtsMetricsDayDto {
  let byVoice: Record<string, TtsVoiceMetricsDto> | null = d.byVoice
  if (voiceId) {
    const v = voiceOf(d.byVoice, voiceId)
    // fromEntries 는 키가 `__proto__` 여도 자기 속성으로 만든다(대입 `o[k] = v` 는 프로토타입 setter 를 탄다).
    byVoice = v ? Object.fromEntries([[voiceId, v]]) : null
  }
  return {
    date: d.date,
    source: d.source,
    requests: d.requests,
    errors: d.errors,
    errorRate: rate(d.errors, d.requests),
    avgMs: d.avgMs,
    p50Ms: d.p50Ms,
    p95Ms: d.p95Ms,
    p99Ms: d.p99Ms,
    ttfaP50Ms: d.ttfaP50Ms,
    ttfaP95Ms: d.ttfaP95Ms,
    rtfAvg: d.rtfAvg,
    cacheHitRate: d.cacheHitRate,
    byVoice,
    computedAt: d.computedAt ? d.computedAt.toISOString() : null,
  }
}

/** 날짜별 값으로 정확히 합칠 수 있는 것만. 적중 수는 저장된 비율(소수 4자리) × 요청 수를 반올림해 되살린다(하루 요청 < 5,000 이면 정확). */
export function summarize(days: readonly TtsMetricsDay[], voiceId: string | null): TtsMetricsSummaryDto {
  let requests = 0
  let errors = 0
  let hits = 0
  let vReq = 0
  let vErr = 0
  for (const d of days) {
    requests += d.requests
    errors += d.errors
    hits += d.cacheHitRate === null ? 0 : Math.round(d.cacheHitRate * d.requests)
    const v = voiceId ? voiceOf(d.byVoice, voiceId) : null
    if (v) {
      vReq += v.requests
      vErr += v.errors
    }
  }
  return { requests, errors, errorRate: rate(errors, requests), cacheHitRate: rate(hits, requests), voice: voiceId ? { voiceId, requests: vReq, errors: vErr } : null }
}

/** DB 경계(테스트는 가짜를 넣는다). */
export interface TtsMetricsDeps {
  getConnection(environment: Environment, idOrKey: string): Promise<{ id: string; role: string } | null>
  getTtsMetrics: typeof getTtsMetrics
}

const defaultDeps: TtsMetricsDeps = { getConnection, getTtsMetrics }

export async function getTtsMetricsDto(environment: Environment, q: TtsMetricsQuery, now: Date = new Date(), deps: TtsMetricsDeps = defaultDeps): Promise<TtsMetricsDto> {
  const key = parseTtsMetricsRange(q.range)
  const voiceId = parseTtsVoiceId(q.voiceId)
  let connectionIds: string[] | undefined
  if (q.connectionId) {
    if (!CONNECTION_REF.test(q.connectionId)) throw new ApiError('VALIDATION', 'connectionId 형식이 올바르지 않습니다.', { field: 'connectionId' })
    const c = await deps.getConnection(environment, q.connectionId)
    if (!c) throw hiddenNotFound()
    if (c.role !== 'TTS') throw new ApiError('VALIDATION', 'TTS 연결이 아닙니다.', { field: 'connectionId' })
    connectionIds = [c.id]
  }
  const to = dates.todayKst(now)
  const from = dates.addDays(to, -(TTS_METRICS_RANGES[key] - 1))
  const r = await deps.getTtsMetrics({ environment, from, to, connectionIds, now })
  return {
    environment: r.environment,
    range: { key, from, to },
    today: r.today,
    voiceId,
    connections: r.connections.map(({ connection: c, days }) => ({
      connection: { id: c.id, key: c.key, name: c.name, status: c.status, enabled: c.enabled },
      summary: summarize(days, voiceId),
      days: days.map((d) => ttsDayDto(d, voiceId)),
    })),
  }
}
