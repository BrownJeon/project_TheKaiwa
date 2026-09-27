/**
 * 콘솔 표시 규칙(screens.md §6-2 C `displayValue` 외). 순수 모듈 — 단위 테스트 대상.
 *
 * 가림 규칙은 **방어선**이다(H1·§6-11 ⑦): 서버 응답에 애초에 시크릿 값·서버 절대 경로가 없어야 하고,
 * 혹시 새어 들어와도 화면에는 그리지 않는다. `/` 로 시작하는 문자열은 키와 상관없이 가린다(Leader 지시 — 서버 경로 누출 차단).
 */
import { formatListTime } from '@/components/common/format'
import type { ConfigSourceName } from '@/types/admin'
import { sourceLayer } from './labels'

export const EMPTY_TEXT = '없음'
export const MASKED_TEXT = '•••(숨김)'
export const PATH_TEXT = '서버 경로 · 표시하지 않음'

const SECRET_KEY = /(token|secret|password|passwd|api[-_]?key|private[-_]?key|cookie)/i
const CREDENTIAL_REF_KEY = /credentialref$/i
const WIN_ABS_PATH = /^[A-Za-z]:[\\/]/

/** 서버 파일시스템 경로로 보이는 값(절대·홈·윈도 드라이브). */
export function looksLikeServerPath(v: string): boolean {
  const s = v.trim()
  return s.startsWith('/') || s.startsWith('~/') || s === '~' || WIN_ABS_PATH.test(s) || s.startsWith('\\\\')
}

function lastKeySegment(key: string): string {
  const i = key.lastIndexOf('.')
  return i >= 0 ? key.slice(i + 1) : key
}

function isSecretKey(key: string): boolean {
  const seg = lastKeySegment(key)
  return SECRET_KEY.test(seg) && !CREDENTIAL_REF_KEY.test(seg)
}

/** 객체·배열 안쪽까지 가린 복사본(한 줄 JSON 으로 그리기 전에). */
export function maskDeep(value: unknown, key = ''): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (value === '***') return MASKED_TEXT
    if (looksLikeServerPath(value)) return PATH_TEXT
    if (key && isSecretKey(key)) return MASKED_TEXT
    return value
  }
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, key))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskDeep(v, key ? `${key}.${k}` : k)
    }
    return out
  }
  return value
}

/**
 * 키·값을 화면 글자로. 1 없음 → "없음" · 2 boolean → 예/아니요 · 3 배열 → ", " · 4 객체 → 한 줄 JSON ·
 * 5 서버 경로 → "서버 경로 · 표시하지 않음" · 6 시크릿 의심 키(문자열) → "•••(숨김)" · 7 "***" → "•••(숨김)" · 8 그대로.
 * 숫자·불리언은 키 이름이 시크릿처럼 보여도(maxTokens 등) 그대로 둔다 — 비밀 값은 문자열로만 온다.
 */
export function displayValue(key: string, value: unknown, type?: string): string {
  if (value === null || value === undefined) return EMPTY_TEXT
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : EMPTY_TEXT
  if (typeof value === 'string') {
    if (value === '***') return MASKED_TEXT
    if (looksLikeServerPath(value)) return PATH_TEXT
    if (type === 'PATH' && value !== '') return value.startsWith('$') || value.startsWith('env:') ? value : PATH_TEXT
    if (isSecretKey(key)) return value === '' ? EMPTY_TEXT : MASKED_TEXT
    return value === '' ? '""' : value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value
      .map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(maskDeep(v, key)) : displayValue(key, v, type)))
      .join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(maskDeep(value, key))
  return String(value)
}

export function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined
}

/** 중첩 객체를 점 표기 평면 목록으로(`vad.model`). 배열·null 은 그 자리 값으로 둔다. */
export function flattenDot(obj: Record<string, unknown> | null | undefined, prefix = ''): [string, unknown][] {
  if (!obj) return []
  const out: [string, unknown][] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0) {
      out.push(...flattenDot(v as Record<string, unknown>, key))
    } else {
      out.push([key, v])
    }
  }
  return out
}

const MODEL_KEYS = ['model', 'defaultModel', 'modelVersion', 'modelId', 'modelName'] as const

/** runtime 에서 모델 표기: model → defaultModel → modelVersion → modelByTier 값들 → "—". */
export function modelLabel(runtime: Record<string, unknown> | null | undefined): string {
  if (!runtime) return '—'
  for (const k of MODEL_KEYS) {
    const v = runtime[k]
    if (typeof v === 'string' && v) return looksLikeServerPath(v) ? PATH_TEXT : v
  }
  const tiers = runtime.modelByTier
  if (tiers && typeof tiers === 'object' && !Array.isArray(tiers)) {
    const vals = Object.values(tiers as Record<string, unknown>).filter((v): v is string => typeof v === 'string' && v !== '')
    if (vals.length) return Array.from(new Set(vals)).join(' / ')
  }
  return '—'
}

/** 키의 첫 마디로 묶는다(`connection` · `runtime` · `logging` …). 순서는 처음 나온 순서. */
export function groupByPrefix<T extends { key: string }>(rows: readonly T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const i = r.key.indexOf('.')
    const prefix = i > 0 ? r.key.slice(0, i) : r.key
    const list = map.get(prefix)
    if (list) list.push(r)
    else map.set(prefix, [r])
  }
  return Array.from(map.entries())
}

/** 시크릿 키 값 칸: ref 이름만. 객체면 `credentialRef` 만 쓰고 `exists` 는 쓰지 않는다. */
export function refName(v: unknown): string {
  if (typeof v === 'string') {
    if (v === '***') return MASKED_TEXT
    if (/^(env|file):[\w.\-/]+$/.test(v) && !looksLikeServerPath(v.slice(v.indexOf(':') + 1))) return v
    return v === '' ? EMPTY_TEXT : MASKED_TEXT
  }
  if (v && typeof v === 'object' && typeof (v as { credentialRef?: unknown }).credentialRef === 'string') {
    return refName((v as { credentialRef: string }).credentialRef)
  }
  return EMPTY_TEXT
}

/** 지연 ms → "38ms" · "1.2초" · 없으면 "—". */
export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}초`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s ? `${m}분 ${s}초` : `${m}분`
}

/**
 * 상대 시각: 방금 · n분 전 · n시간 전 · n일 전(7일 미만) · 그 뒤는 목록 시각(`M월 D일`).
 * `now` 가 0 이면(첫 틱 전) 목록 시각으로 — 렌더 중 `Date.now()` 를 부르지 않는다.
 */
export function formatAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  if (!now) return formatListTime(iso)
  const diff = now - t
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`
  return formatListTime(iso, new Date(now))
}

const clockFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** `HH:mm:ss`(KST). ms 또는 ISO. */
export function formatClockSec(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return clockFormatter.format(d)
}

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** `M월 D일 HH:mm:ss`(KST). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts: Record<string, string> = {}
  for (const p of dateTimeFormatter.formatToParts(d)) parts[p.type] = p.value
  return `${parts.month}월 ${parts.day}일 ${parts.hour}:${parts.minute}:${parts.second}`
}

/** 출처 분포를 층 번호 순으로(0 인 층 제외). */
export function sourceCounts(bySource: Partial<Record<ConfigSourceName, number>> | null | undefined): [ConfigSourceName, number][] {
  if (!bySource) return []
  return (Object.entries(bySource) as [ConfigSourceName, number | undefined][])
    .filter((e): e is [ConfigSourceName, number] => typeof e[1] === 'number' && e[1] > 0)
    .sort((a, b) => sourceLayer(a[0]) - sourceLayer(b[0]))
}
