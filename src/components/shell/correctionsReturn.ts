/**
 * 채택 교정 모음(`/drawer/corrections`)에서 연 원래 대화의 ← 를 교정 모음으로 돌려보내는 한 건 기록(task-055 D5 A, screens.md §21-6 B).
 *
 * - 모양·규칙은 계획표 기록(`planReturn.ts`)과 같다: 교정 모음이 원래 대화로 가기 직전에 {돌아올 교정 모음 주소, 원본 경로, 시각} 한 건을
 *   sessionStorage 에 적고, 교정 모음에 돌아오면 지운다. 지금 경로가 원본 경로와 같고 2시간 안일 때만 쓴다.
 * - 돌아올 주소는 `/drawer/corrections` 와 그 쿼리만(저장소 값이 바뀌어도 다른 사이트로 보내지 않게). 검색어 40자가 퍼센트 인코딩되면
 *   400자를 넘어서 계획표의 300자 상한 대신 700자다.
 * - 같은 원본을 계획표와 교정 모음에서 번갈아 열면 두 기록이 모두 맞을 수 있다 — 그때는 **나중에 적은 쪽**으로 돌아간다(`pickBackHref`).
 */
import { readStore, writeStore } from '@/components/common/storage'
import { isPlanHref, parsePlanReturn, PLAN_RETURN_KEY, PLAN_RETURN_LABEL, PLAN_RETURN_TTL_MS, samePath } from './planReturn'
import { ASK_RETURN_KEY, ASK_RETURN_LABEL, isAskHref, parseAskReturn } from './askReturn'

export const CORRECTIONS_RETURN_KEY = 'kaiwa.correctionsReturn'
export const CORRECTIONS_RETURN_LABEL = '교정 모음으로'
export const CORRECTIONS_RETURN_TTL_MS = PLAN_RETURN_TTL_MS
/** 돌아올 주소 길이 상한 — 쿼리(errorType·chunkType·q 40자 인코딩·focus·n)가 다 붙어도 들어가는 값. */
export const CORRECTIONS_HREF_MAX = 700
const CLOCK_SKEW_MS = 60 * 1000
/** 원본 경로 상한 — `samePath`(planReturn)가 300자 넘는 경로를 같은 경로로 보지 않으므로 같은 값. */
const SRC_MAX = 300

const CORRECTIONS_HREF = /^\/drawer\/corrections(?:\?[A-Za-z0-9._~%=&-]*)?$/
const APP_PATH = /^\/(?!\/)[A-Za-z0-9._~%/-]*$/

export interface CorrectionsReturn {
  back: string
  src: string
  at: number
}

/** 교정 모음 주소(`/drawer/corrections` 또는 `/drawer/corrections?…`)만 — 다른 경로·다른 사이트·`//`·`+`·해시는 거절. */
export function isCorrectionsHref(v: unknown): v is string {
  return typeof v === 'string' && v.length <= CORRECTIONS_HREF_MAX && CORRECTIONS_HREF.test(v)
}

function isAppPath(v: unknown): v is string {
  return typeof v === 'string' && v.length <= SRC_MAX && APP_PATH.test(v)
}

export function serializeCorrectionsReturn(back: string, src: string, now: number): string | null {
  if (!isCorrectionsHref(back) || !isAppPath(src) || !Number.isFinite(now)) return null
  return JSON.stringify({ v: 1, back, src, at: now })
}

export function parseCorrectionsReturn(raw: string | null, now: number): CorrectionsReturn | null {
  if (!raw || raw.length > (CORRECTIONS_HREF_MAX + SRC_MAX) * 2) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.v !== 1 || !isCorrectionsHref(o.back) || !isAppPath(o.src)) return null
  const at = o.at
  if (typeof at !== 'number' || !Number.isFinite(at) || now - at > CORRECTIONS_RETURN_TTL_MS || at - now > CLOCK_SKEW_MS) return null
  return { back: o.back, src: o.src, at }
}

/** 지금 경로가 기록의 원본 경로와 같으면 돌아갈 교정 모음 주소, 아니면 null. */
export function correctionsReturnHref(raw: string | null, pathname: string | null | undefined, now: number): string | null {
  const r = parseCorrectionsReturn(raw, now)
  return r && samePath(r.src, pathname) ? r.back : null
}

/**
 * 계획표·교정 모음·질문 방(task-064 §25-8 B) 기록 가운데 지금 경로에 맞는 쪽의 돌아갈 주소. 여럿이 맞으면 `at` 이 가장 늦은 쪽
 * (같으면 계획표 → 교정 모음 → 질문 방 순), 없으면 null. 저장소를 읽지 않는 순수 함수 — `currentBackHref` 가 저장소 값을 넣어 부른다.
 * `askRaw` 를 넘기지 않는 호출은 예전과 같다(두 기록).
 */
export function pickBackHref(
  planRaw: string | null,
  correctionsRaw: string | null,
  pathname: string | null | undefined,
  now: number,
  askRaw: string | null = null,
): string | null {
  const p = parsePlanReturn(planRaw, now)
  const c = parseCorrectionsReturn(correctionsRaw, now)
  const a = parseAskReturn(askRaw, now)
  // 순서가 곧 같은 시각일 때의 우선순위다 — 더 늦을 때만 바꾼다.
  const candidates = [p && { href: p.plan, src: p.src, at: p.at }, c && { href: c.back, src: c.src, at: c.at }, a && { href: a.back, src: a.src, at: a.at }]
  let best: { href: string; at: number } | null = null
  for (const r of candidates) {
    if (!r || !samePath(r.src, pathname)) continue
    if (!best || r.at > best.at) best = r
  }
  return best?.href ?? null
}

/** ← 이름 — 계획표 주소면 「계획표로」, 질문 방 주소면 「질문으로」, 그 밖(교정 모음 주소)은 「교정 모음으로」. */
export function backLabelOf(href: string): string {
  if (isPlanHref(href)) return PLAN_RETURN_LABEL
  return isAskHref(href) ? ASK_RETURN_LABEL : CORRECTIONS_RETURN_LABEL
}

// ── 저장소(전부 try/catch — common/storage) ─────────────────────────────────────

export function rememberCorrectionsReturn(back: string, src: string, now: number = Date.now()): void {
  const v = serializeCorrectionsReturn(back, src, now)
  if (v) writeStore('session', CORRECTIONS_RETURN_KEY, v)
}

export function forgetCorrectionsReturn(): void {
  writeStore('session', CORRECTIONS_RETURN_KEY, null)
}

export function currentCorrectionsReturn(pathname: string | null | undefined, now: number = Date.now()): string | null {
  return correctionsReturnHref(readStore('session', CORRECTIONS_RETURN_KEY), pathname, now)
}

/** 원본 화면 머리 ← 의 행선지(계획표·교정 모음·질문 방 중 맞는 쪽) — 문자열이나 null 만 돌려준다(`useSyncExternalStore` 의 스냅샷). */
export function currentBackHref(pathname: string | null | undefined, now: number = Date.now()): string | null {
  return pickBackHref(
    readStore('session', PLAN_RETURN_KEY),
    readStore('session', CORRECTIONS_RETURN_KEY),
    pathname,
    now,
    readStore('session', ASK_RETURN_KEY),
  )
}
