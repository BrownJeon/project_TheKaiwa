/**
 * 이력 화면(`/admin/history`, task-012c D-C8) 순수 규칙 — 요청 경로·필터·표시 줄. 단위 테스트 대상.
 * 감사 before/after 는 서버가 저장할 때 이미 가린 값이다(비밀은 참조 이름만) — 여기서는 키마다 "전 → 후" 한 줄로 펼칠 뿐 값을 더하지 않는다.
 */
import type { AdminEnvironment, AuditItemDto, ConfigEditScopeName, ConfigScopeName, ConfigVersionItemDto } from '@/types/admin'

const BASE = '/api/admin/v1'

export type HistoryTab = 'versions' | 'audit'

export function parseHistoryTab(raw: string | null | undefined): HistoryTab {
  return raw === 'audit' ? 'audit' : 'versions'
}

const EDIT_SCOPES: readonly ConfigEditScopeName[] = ['ENGINE_CONNECTION', 'FALLBACK_POLICY', 'APP_SETTING']

export function parseEditScope(raw: string | null | undefined): ConfigEditScopeName | null {
  const s = (raw ?? '').toUpperCase()
  return (EDIT_SCOPES as readonly string[]).includes(s) ? (s as ConfigEditScopeName) : null
}

// ── 감사 필터 ───────────────────────────────────────────────────────────────

export type AuditCategory = 'all' | 'conn' | 'fb' | 'app' | 'lex'

export const AUDIT_CATEGORIES: readonly { value: AuditCategory; label: string; scope: ConfigScopeName | null }[] = [
  { value: 'all', label: '전체', scope: null },
  { value: 'conn', label: '연결', scope: 'ENGINE_CONNECTION' },
  { value: 'fb', label: '예비 순서', scope: 'FALLBACK_POLICY' },
  { value: 'app', label: '운영 설정', scope: 'APP_SETTING' },
  { value: 'lex', label: '발음 사전', scope: 'LEXICON' },
]

export type AuditPeriod = '1d' | '7d' | '30d' | 'all'

export const PERIOD_OPTIONS: readonly { value: AuditPeriod; label: string }[] = [
  { value: '1d', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'all', label: '전체' },
]

const DAY = 86_400_000

/** 기간 시작(ISO). "오늘" = 지금부터 24시간 전이 아니라 한국 시각 오늘 0시. `now` 는 호출자가 준다(렌더 중 Date.now 금지). */
export function periodFrom(p: AuditPeriod, now: number): string | null {
  if (p === 'all' || !now) return null
  if (p === '1d') {
    const kst = new Date(now + 9 * 3_600_000)
    const midnightKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3_600_000
    return new Date(midnightKst).toISOString()
  }
  return new Date(now - (p === '7d' ? 7 : 30) * DAY).toISOString()
}

export interface AuditFilter {
  category: AuditCategory
  period: AuditPeriod
  action: string
  actorUserId: string
  environment: AdminEnvironment | null
}

export function auditPath(f: AuditFilter, now: number, cursor: string | null = null, limit = 30): string {
  const u = new URLSearchParams()
  const scope = AUDIT_CATEGORIES.find((c) => c.value === f.category)?.scope
  if (scope) u.set('scope', scope)
  if (f.action) u.set('action', f.action)
  if (f.actorUserId) u.set('actorUserId', f.actorUserId)
  if (f.environment) u.set('environment', f.environment)
  const from = periodFrom(f.period, now)
  if (from) u.set('from', from)
  if (cursor) u.set('cursor', cursor)
  u.set('limit', String(limit))
  return `${BASE}/audit?${u.toString()}`
}

/** task-018 전 발음 사전 감사(scope 없음 + action `lexicon.*`) — "옛 기록". */
export function isOldLexicon(a: Pick<AuditItemDto, 'scope' | 'action'>): boolean {
  return a.scope === null && a.action.startsWith('lexicon.')
}

/** 값을 적지 않는 조회 감사(값이 원래 없다). */
export function isReadAudit(action: string): boolean {
  return action === 'secrets.read_ref' || action === 'config.raw.read'
}

const obj = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

export interface AuditLine {
  key: string
  before: unknown
  after: unknown
  hasBefore: boolean
}

/** 감사 before/after 의 `values` 를 키마다 한 줄로(사용자 결정 d3 = A). `values` 가 없는 모양이면 빈 목록(원문 JSON 으로 본다). */
export function auditLines(a: Pick<AuditItemDto, 'before' | 'after'>): AuditLine[] {
  const bv = obj(obj(a.before)?.values)
  const av = obj(obj(a.after)?.values)
  if (!av && !bv) return []
  const keys = [...new Set([...Object.keys(bv ?? {}), ...Object.keys(av ?? {})])]
  return keys.map((k) => ({ key: k, before: bv?.[k], after: av?.[k], hasBefore: Boolean(bv && Object.prototype.hasOwnProperty.call(bv, k)) }))
}

/** 감사 행이 가리키는 버전 번호(after.version) — 없으면 null. */
export function auditVersion(a: Pick<AuditItemDto, 'after'>): number | null {
  const v = obj(a.after)?.version
  return typeof v === 'number' ? v : null
}

/** 같은 날짜끼리 묶는 머리(한국 시각): 오늘 · 어제 · M월 D일. */
export function dayLabel(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t) || !now) return ''
  const key = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)
  const k = key(t)
  if (k === key(now)) return '오늘'
  if (k === key(now - DAY)) return '어제'
  const [, m, d] = k.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

export function actorText(actor: { email: string | null; roleSnap?: string | null } | null | undefined): string {
  if (!actor || !actor.email) return '시스템'
  return actor.roleSnap ? `${actor.email}(${actor.roleSnap})` : actor.email
}

/** 사람 필터 선택지 — 불러온 기록의 작업자(중복 없이). */
export function actorOptions(items: readonly AuditItemDto[]): { value: string; label: string }[] {
  const m = new Map<string, string>()
  for (const a of items) if (a.actor.id && !m.has(a.actor.id)) m.set(a.actor.id, a.actor.email ?? a.actor.id)
  return Array.from(m.entries()).map(([value, label]) => ({ value, label }))
}

// ── 설정 버전 ──────────────────────────────────────────────────────────────

export interface VersionTargetOption {
  value: string
  label: string
  scope: ConfigEditScopeName
  targetId: string
}

/** 대상 칩 — 불러온 버전의 대상(scope:targetId, 이름) + 고정 대상(주소로 들어온 것). */
export function versionTargetOptions(items: readonly ConfigVersionItemDto[], pinned: VersionTargetOption | null): VersionTargetOption[] {
  const m = new Map<string, VersionTargetOption>()
  if (pinned) m.set(pinned.value, pinned)
  for (const v of items) {
    const value = `${v.scope}:${v.targetId}`
    if (!m.has(value)) m.set(value, { value, label: v.targetName ?? v.targetKey ?? v.targetId, scope: v.scope, targetId: v.targetId })
  }
  return Array.from(m.values())
}

export function historyHref(q: { tab?: HistoryTab; scope?: ConfigEditScopeName | null; target?: string | null; v?: string | null }): string {
  const u = new URLSearchParams()
  if (q.tab && q.tab !== 'versions') u.set('tab', q.tab)
  if (q.scope) u.set('scope', q.scope)
  if (q.target) u.set('target', q.target)
  if (q.v) u.set('v', q.v)
  const s = u.toString()
  return `/admin/history${s ? `?${s}` : ''}`
}
