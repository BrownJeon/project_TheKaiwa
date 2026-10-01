/**
 * worker 콜백 본문 검증(api-contract §2-28 #138~#140, task-012b). 모르는 키는 400(계약 드리프트를 조용히 삼키지 않는다).
 * 오류 문구·details 에 본문 값(전사)을 싣지 않는다 — 필드 이름·사유 코드만.
 */
import type { SpeechJobKind } from '@prisma/client'
import { ApiError, codePointLength } from '@/modules/infra'
import { COMPARATOR_FLAGS, type ComparatorFlag } from './policy'

/** 워커 **인스턴스** id(`SPEECH_WORKER_ID-<부트 nonce>`) — `SpeechJob.lockedBy` VARCHAR(80) 안. */
export const WORKER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/
export const JOB_ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/
const KEY_RE = /^[A-Za-z0-9_-]{1,80}$/
const VERSION_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/
const VERSION_VAL_RE = /^[A-Za-z0-9 ._:@+-]{1,80}$/
const KINDS: readonly SpeechJobKind[] = ['ANALYSIS_STT', 'PRONUNCIATION']
export const ANALYSIS_TEXT_MAX = 2_000
const SEGMENTS_MAX = 200

function bad(field: string, reason: string): never {
  throw new ApiError('VALIDATION', '요청 본문이 올바르지 않습니다.', { field, reason })
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k))
  if (extra.length) bad(extra[0], 'unknown_key')
}

function workerIdOf(v: unknown): string {
  if (typeof v !== 'string' || !WORKER_ID_RE.test(v)) bad('workerId', 'format')
  return v
}

export interface ClaimInput {
  workerId: string
  kinds: SpeechJobKind[]
  max: number
}

/** #139 `{workerId, kinds[], max}` — max 1~2(기본 1), kinds 는 비지 않은 enum 부분집합. */
export function parseClaimBody(body: Record<string, unknown>): ClaimInput {
  onlyKeys(body, ['workerId', 'kinds', 'max'])
  const workerId = workerIdOf(body.workerId)
  if (!Array.isArray(body.kinds) || body.kinds.length === 0 || body.kinds.length > KINDS.length) bad('kinds', 'required')
  const kinds = [...new Set(body.kinds)] as unknown[]
  if (!kinds.every((k) => typeof k === 'string' && (KINDS as readonly string[]).includes(k))) bad('kinds', 'enum')
  const max = body.max === undefined ? 1 : body.max
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 2) bad('max', 'range 1..2')
  return { workerId, kinds: kinds as SpeechJobKind[], max }
}

export interface FailureInput {
  workerId: string
  error: string
  retryable: boolean
  /** claim 세대 — 그 claim 응답의 `attempts` 그대로. 있으면 펜싱에 더한다(없으면 인스턴스 id 만 — 구버전 워커 호환). */
  attempt?: number
}

/** #140 `{workerId, status:'FAILED', error(코드값), retryable, attempt?}` — 성공은 #138 이 끝낸다. */
export function parseFailureBody(body: Record<string, unknown>): FailureInput {
  onlyKeys(body, ['workerId', 'status', 'error', 'retryable', 'attempt'])
  const workerId = workerIdOf(body.workerId)
  if (body.status !== 'FAILED') bad('status', 'only FAILED')
  if (typeof body.error !== 'string' || !ERROR_CODE_RE.test(body.error)) bad('error', 'code format')
  if (typeof body.retryable !== 'boolean') bad('retryable', 'boolean')
  if (body.attempt !== undefined && (typeof body.attempt !== 'number' || !Number.isInteger(body.attempt) || body.attempt < 1 || body.attempt > 1000)) bad('attempt', 'range 1..1000')
  return { workerId, error: body.error, retryable: body.retryable, ...(body.attempt !== undefined ? { attempt: body.attempt as number } : {}) }
}

export interface AnalysisInput {
  jobId: string
  workerId: string
  analysisEngine: string
  analysisText: string
  similarity: number
  flags: ComparatorFlag[]
  comparatorVersion: string
  engineVersions: Record<string, string | number>
  latencyMs: number | null
}

function num01(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) bad(field, 'range 0..1')
  return v
}

function versionsOf(v: unknown): Record<string, string | number> {
  if (v === undefined || v === null) return {}
  if (typeof v !== 'object' || Array.isArray(v)) bad('engineVersions', 'object')
  const out: Record<string, string | number> = {}
  const entries = Object.entries(v as Record<string, unknown>)
  if (entries.length > 10) bad('engineVersions', 'max 10 keys')
  for (const [k, val] of entries) {
    // reviewThreshold·flags·recognitionMode 는 앱이 쓰는 판정 스냅샷 칸이다 — 워커 값으로 덮지 못하게 받지 않는다.
    if (!VERSION_KEY_RE.test(k) || k === 'reviewThreshold' || k === 'flags' || k === 'recognitionMode') bad('engineVersions', 'key')
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = val
    else if (typeof val === 'string' && VERSION_VAL_RE.test(val)) out[k] = val
    else bad('engineVersions', 'value')
  }
  return out
}

function segmentsOk(v: unknown): void {
  if (v === undefined || v === null) return
  if (!Array.isArray(v) || v.length > SEGMENTS_MAX) bad('segments', `array ≤${SEGMENTS_MAX}`)
  for (const s of v) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) bad('segments', 'item')
    const { start, end, text } = s as Record<string, unknown>
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) bad('segments', 'range')
    if (typeof text !== 'string' || codePointLength(text) > ANALYSIS_TEXT_MAX) bad('segments', 'text')
  }
}

/**
 * #138 본문. `pronunciation` 은 Phase 3 — 지금은 null·없음만. `segments` 는 형식만 확인하고 저장하지 않는다(칸 없음 — 스키마 0).
 * `comparator.flags` 는 정해진 3개만, `similarity` 0~1. 정규화 문자열은 받지 않는다(계약상 보내지 않음).
 */
export function parseAnalysisBody(body: Record<string, unknown>): AnalysisInput {
  onlyKeys(body, ['jobId', 'workerId', 'analysisEngine', 'analysisText', 'segments', 'language', 'latencyMs', 'comparator', 'pronunciation', 'engineVersions', 'traceId'])
  if (typeof body.jobId !== 'string' || !JOB_ID_RE.test(body.jobId)) bad('jobId', 'format')
  const workerId = workerIdOf(body.workerId)
  if (typeof body.analysisEngine !== 'string' || !KEY_RE.test(body.analysisEngine)) bad('analysisEngine', 'format')
  if (typeof body.analysisText !== 'string' || codePointLength(body.analysisText) > ANALYSIS_TEXT_MAX) bad('analysisText', `string ≤${ANALYSIS_TEXT_MAX}`)
  segmentsOk(body.segments)
  if (body.language !== undefined && body.language !== null && (typeof body.language !== 'string' || !/^[a-z]{2,3}$/.test(body.language))) bad('language', 'format')
  let latencyMs: number | null = null
  if (body.latencyMs !== undefined && body.latencyMs !== null) {
    if (typeof body.latencyMs !== 'number' || !Number.isInteger(body.latencyMs) || body.latencyMs < 0 || body.latencyMs > 3_600_000) bad('latencyMs', 'range')
    latencyMs = body.latencyMs
  }
  if (body.pronunciation !== undefined && body.pronunciation !== null) bad('pronunciation', 'phase3')
  if (body.traceId !== undefined && body.traceId !== null && (typeof body.traceId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(body.traceId))) bad('traceId', 'format')
  const c = body.comparator
  if (!c || typeof c !== 'object' || Array.isArray(c)) bad('comparator', 'object')
  const cmp = c as Record<string, unknown>
  onlyKeys(cmp, ['similarity', 'flags', 'realtimeLen', 'analysisLen', 'version'])
  const similarity = num01(cmp.similarity, 'comparator.similarity')
  if (!Array.isArray(cmp.flags) || cmp.flags.length > COMPARATOR_FLAGS.length) bad('comparator.flags', 'array')
  const flags = [...new Set(cmp.flags)] as unknown[]
  if (!flags.every((f) => typeof f === 'string' && (COMPARATOR_FLAGS as readonly string[]).includes(f))) bad('comparator.flags', 'enum')
  for (const k of ['realtimeLen', 'analysisLen'] as const) {
    const n = cmp[k]
    if (n !== undefined && (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 100_000)) bad(`comparator.${k}`, 'range')
  }
  if (typeof cmp.version !== 'string' || !VERSION_VAL_RE.test(cmp.version)) bad('comparator.version', 'format')
  return {
    jobId: body.jobId,
    workerId,
    analysisEngine: body.analysisEngine,
    analysisText: body.analysisText,
    similarity,
    flags: flags as ComparatorFlag[],
    comparatorVersion: cmp.version,
    engineVersions: versionsOf(body.engineVersions),
    latencyMs,
  }
}
