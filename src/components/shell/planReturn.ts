/**
 * 계획표에서 연 원본 화면의 ← 를 계획표로 돌려보내는 한 건 기록(task-012 REV-045, 승인 데모 v1 "←(계획표로)를 누르면 같은 달·같은 날
 * 시트가 다시 열리고 초점은 방금 누른 기록으로 돌아와요").
 *
 * - 계획표가 원본으로 가기 직전에 {돌아올 계획표 주소, 원본 경로, 시각} 한 건을 sessionStorage 에 적고, 계획표에 돌아오면 지운다.
 * - 원본 화면 머리의 ← 는 **지금 경로가 적어 둔 원본 경로와 같을 때만** 계획표 주소로 간다. 원본에서 다른 곳으로 옮겨 가 기록이
 *   남아 있어도 경로가 다르면 쓰지 않고, 오래된 기록(`PLAN_RETURN_TTL_MS`)도 쓰지 않는다.
 * - 저장소는 사생활 모드·WebView 설정에 따라 예외를 던진다 — 실패하면 ← 가 원래 자리로 갈 뿐 화면은 그대로 동작한다.
 * - 기록에서 읽은 주소는 `/plan` 으로 시작하는 앱 내부 주소만 쓴다(저장소 값이 바뀌어도 다른 사이트로 보내지 않게).
 */
import { readStore, writeStore } from '@/components/common/storage'

export const PLAN_RETURN_KEY = 'kaiwa.planReturn'
export const PLAN_RETURN_LABEL = '계획표로'
/** 긴 회화·수업을 하고 와도 돌아올 수 있는 길이. 그보다 오래된 기록은 다른 경로로 같은 원본을 다시 연 것으로 본다. */
export const PLAN_RETURN_TTL_MS = 2 * 60 * 60 * 1000
/** 기기 시계가 조금 어긋나도 막 적은 기록은 받아 준다. */
const CLOCK_SKEW_MS = 60 * 1000
const MAX_LEN = 300

const PLAN_HREF = /^\/plan(?:\?[A-Za-z0-9._~%=&-]*)?$/
const APP_PATH = /^\/(?!\/)[A-Za-z0-9._~%/-]*$/

export interface PlanReturn {
  plan: string
  src: string
  at: number
}

/** 계획표 주소(`/plan` 또는 `/plan?…`)만 — 다른 경로·다른 사이트·`//`·백슬래시는 거절. */
export function isPlanHref(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_LEN && PLAN_HREF.test(v)
}

function isAppPath(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_LEN && APP_PATH.test(v)
}

function normPath(p: string): string | null {
  if (!isAppPath(p)) return null
  let d: string
  try {
    d = decodeURIComponent(p)
  } catch {
    return null
  }
  return d.length > 1 && d.endsWith('/') ? d.slice(0, -1) : d
}

/** 경로 비교 — 퍼센트 인코딩·끝 `/` 차이는 같은 경로로 본다. */
export function samePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const x = normPath(a)
  return x !== null && x === normPath(b)
}

export function serializePlanReturn(plan: string, src: string, now: number): string | null {
  if (!isPlanHref(plan) || !isAppPath(src) || !Number.isFinite(now)) return null
  return JSON.stringify({ v: 1, plan, src, at: now })
}

export function parsePlanReturn(raw: string | null, now: number): PlanReturn | null {
  if (!raw || raw.length > MAX_LEN * 3) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.v !== 1 || !isPlanHref(o.plan) || !isAppPath(o.src)) return null
  const at = o.at
  if (typeof at !== 'number' || !Number.isFinite(at) || now - at > PLAN_RETURN_TTL_MS || at - now > CLOCK_SKEW_MS) return null
  return { plan: o.plan, src: o.src, at }
}

/** 지금 경로가 기록의 원본 경로와 같으면 돌아갈 계획표 주소, 아니면 null. */
export function planReturnHref(raw: string | null, pathname: string | null | undefined, now: number): string | null {
  const r = parsePlanReturn(raw, now)
  return r && samePath(r.src, pathname) ? r.plan : null
}

// ── 저장소(전부 try/catch — common/storage) ─────────────────────────────────────

export function rememberPlanReturn(plan: string, src: string, now: number = Date.now()): void {
  const v = serializePlanReturn(plan, src, now)
  if (v) writeStore('session', PLAN_RETURN_KEY, v)
}

export function forgetPlanReturn(): void {
  writeStore('session', PLAN_RETURN_KEY, null)
}

export function currentPlanReturn(pathname: string | null | undefined, now: number = Date.now()): string | null {
  return planReturnHref(readStore('session', PLAN_RETURN_KEY), pathname, now)
}
