/**
 * 질문 방(`/ask/<chatId>`)의 근거 카드로 연 수업·평가·역할극 화면의 ← 를 그 질문 방으로 돌려보내는 한 건 기록(task-064 screens.md §25-8 B).
 *
 * - 모양·규칙은 교정 모음 기록(`correctionsReturn.ts`)과 같다: 근거 카드를 누를 때 {돌아올 질문 방 주소, 원본 경로, 시각} 한 건을
 *   sessionStorage 에 적고, 질문 방에 돌아오면 지운다. 지금 경로가 원본 경로와 같고 2시간 안일 때만 쓴다.
 * - 돌아올 주소는 `/ask/<id>`(id `[A-Za-z0-9_-]{1,64}`)뿐 — 저장소 값이 바뀌어도 다른 사이트·다른 화면으로 보내지 않는다.
 * - 세 기록(계획표·교정 모음·질문 방) 가운데 무엇으로 돌아갈지는 `correctionsReturn.pickBackHref` 가 고른다(이 파일은 그것을 import 하지 않는다).
 */
import { readStore, writeStore } from '@/components/common/storage'
import { PLAN_RETURN_TTL_MS, samePath } from './planReturn'

export const ASK_RETURN_KEY = 'kaiwa.askReturn'
export const ASK_RETURN_LABEL = '질문으로'
export const ASK_RETURN_TTL_MS = PLAN_RETURN_TTL_MS
const CLOCK_SKEW_MS = 60 * 1000
/** 원본 경로 상한 — `samePath`(planReturn)가 300자 넘는 경로를 같은 경로로 보지 않으므로 같은 값. */
const SRC_MAX = 300

const ASK_HREF = /^\/ask\/[A-Za-z0-9_-]{1,64}$/
const APP_PATH = /^\/(?!\/)[A-Za-z0-9._~%/-]*$/

export interface AskReturn {
  back: string
  src: string
  at: number
}

/** 질문 방 주소(`/ask/<id>`)만 — 목록 `/ask`·쿼리·해시·하위 경로·다른 사이트는 거절. */
export function isAskHref(v: unknown): v is string {
  return typeof v === 'string' && ASK_HREF.test(v)
}

function isAppPath(v: unknown): v is string {
  return typeof v === 'string' && v.length <= SRC_MAX && APP_PATH.test(v)
}

export function serializeAskReturn(back: string, src: string, now: number): string | null {
  if (!isAskHref(back) || !isAppPath(src) || !Number.isFinite(now)) return null
  return JSON.stringify({ v: 1, back, src, at: now })
}

export function parseAskReturn(raw: string | null, now: number): AskReturn | null {
  if (!raw || raw.length > SRC_MAX * 3) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.v !== 1 || !isAskHref(o.back) || !isAppPath(o.src)) return null
  const at = o.at
  if (typeof at !== 'number' || !Number.isFinite(at) || now - at > ASK_RETURN_TTL_MS || at - now > CLOCK_SKEW_MS) return null
  return { back: o.back, src: o.src, at }
}

/** 지금 경로가 기록의 원본 경로와 같으면 돌아갈 질문 방 주소, 아니면 null. */
export function askReturnHref(raw: string | null, pathname: string | null | undefined, now: number): string | null {
  const r = parseAskReturn(raw, now)
  return r && samePath(r.src, pathname) ? r.back : null
}

// ── 저장소(전부 try/catch — common/storage) ─────────────────────────────────────

export function rememberAskReturn(back: string, src: string, now: number = Date.now()): void {
  const v = serializeAskReturn(back, src, now)
  if (v) writeStore('session', ASK_RETURN_KEY, v)
}

export function forgetAskReturn(): void {
  writeStore('session', ASK_RETURN_KEY, null)
}

export function currentAskReturn(pathname: string | null | undefined, now: number = Date.now()): string | null {
  return askReturnHref(readStore('session', ASK_RETURN_KEY), pathname, now)
}
