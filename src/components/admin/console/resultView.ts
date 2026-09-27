/**
 * 상태 확인·기능 테스트 결과 → 화면 표현(screens.md §6-2 C `resultView`). 순수 모듈 — 단위 테스트 대상.
 *
 * "실행하지 않은" 결과의 단일 표현은 서버가 정했다(H2, `@/types/admin` HealthSkipReason): `detail.skipped:true` + `detail.reason`.
 * 가이드 초안의 대체 표현(`ok:null`·`status:'NOT_APPLICABLE'|'SKIPPED'`·`E_TEST_INPUT_MISSING`)도 함께 읽는다(옛 기록·다른 어댑터 대비).
 * 서비스가 꺼져 있는 것(UNAVAILABLE)은 오류가 아니다 — 뱃지·사유·안내로만 말한다.
 */
import type { HealthKindName } from '@/types/admin'
import { type BadgeValue, SKIP_TEXT, UNAVAILABLE_HINT, errorCodeText, isTimeoutCode } from './labels'

/** 결과 한 건(`HealthRunDto`·`HealthDto` 또는 화면이 502/504 에서 만든 합성 결과). */
export interface ResultLike {
  ok: boolean | null
  status: string
  latencyMs?: number | null
  detail?: Record<string, unknown> | null
  traceId?: string | null
  checkedAt?: string | null
  hint?: string | null
}

export interface ResultView {
  badge: BadgeValue
  skipped: boolean
  reason: string | null
  hint: string | null
  /** 사유·안내에 쓰이지 않은 서버 고정 문구(있을 때만 한 줄 더). */
  message: string | null
  chips: [string, string][]
}

/** 화면에 그리는 `detail` 키(화이트리스트). 모르는 키는 그리지 않는다. */
export const DETAIL_CHIP_KEYS = [
  'version',
  'models',
  'memoryMb',
  'device',
  'serviceEnv',
  'model',
  'schemaValid',
  'outputChars',
  'attempts',
  'audioBytes',
  'durationMs',
  'cer',
  'expectedSimilarity',
  'httpStatus',
  'timeoutMs',
] as const

const ENGINE_STATUSES = new Set(['UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'MISCONFIGURED', 'DISABLED'])

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function chipText(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null
  if (typeof v === 'boolean') return v ? '예' : '아니요'
  if (typeof v === 'string' && v && v.length <= 80 && !v.trim().startsWith('/') && !v.trim().startsWith('~')) return v
  return null
}

export function skipReasonOf(r: ResultLike): string | null {
  const d = r.detail ?? {}
  return str(d.reason) ?? str(d.skipReason)
}

export function isSkipped(r: ResultLike): boolean {
  const d = r.detail ?? {}
  const code = str(d.errorCode)
  return r.ok === null || r.status === 'NOT_APPLICABLE' || r.status === 'SKIPPED' || d.skipped === true || code === 'E_TEST_INPUT_MISSING'
}

function skipHint(r: ResultLike, reason: string | null, message: string | null): string {
  if (r.hint) return r.hint
  if (reason === 'SERVICE_DOWN') return SKIP_TEXT.SERVICE_DOWN
  // NOT_APPLICABLE 은 ONDEVICE 만이 아니다(worker 내장 연결 등) — 서버 고정 문구가 더 정확하다.
  if (reason === 'NOT_APPLICABLE' || reason === 'ONDEVICE') return message ?? SKIP_TEXT.NOT_APPLICABLE
  if (reason === 'NOT_IMPLEMENTED') return message ?? SKIP_TEXT.NOT_IMPLEMENTED
  if (reason === 'TEST_ASSET_PENDING' || str(r.detail?.errorCode) === 'E_TEST_INPUT_MISSING') return SKIP_TEXT.TEST_ASSET_PENDING
  return message ?? SKIP_TEXT.NOT_APPLICABLE
}

export function resultView(kind: HealthKindName, r: ResultLike): ResultView {
  const d = r.detail ?? {}
  const code = str(d.errorCode)
  const message = str(d.message)
  const skipped = isSkipped(r)
  const reasonKey = skipReasonOf(r)

  let badge: BadgeValue
  if (skipped) badge = 'SKIPPED'
  else if (kind === 'HEALTH') {
    badge = r.ok ? 'HEALTHY' : ENGINE_STATUSES.has(r.status) ? (r.status as BadgeValue) : 'UNAVAILABLE'
    if (r.ok && ENGINE_STATUSES.has(r.status) && r.status !== 'UNKNOWN') badge = r.status as BadgeValue
  } else if (r.ok) badge = 'PASSED'
  else if (isTimeoutCode(code)) badge = 'TIMEOUT'
  else if (r.status === 'UNAVAILABLE' || r.status === 'MISCONFIGURED') badge = r.status
  else badge = 'FAILED'

  const reason = code ? errorCodeText(code, d, message) : r.ok || skipped ? null : message ?? '실패했어요 (코드 없음)'
  const hint = skipped ? skipHint(r, reasonKey, message) : badge === 'UNAVAILABLE' ? UNAVAILABLE_HINT : null
  const shownMessage = message && message !== reason && message !== hint ? message : null

  const chips: [string, string][] = []
  for (const k of DETAIL_CHIP_KEYS) {
    const t = chipText(d[k])
    if (t !== null) chips.push([k, t])
  }
  return { badge, skipped, reason, hint, message: shownMessage, chips }
}
