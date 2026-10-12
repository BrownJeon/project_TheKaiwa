/**
 * ASK(무엇이든 물어보세요) 턴 한도 — api-contract §2-18-A 3항(Codex C1 #1 반영). 라우트가 **수락 전에** 부른다(거절 = 행 0·SSE 0).
 *
 * - 사용자당 분당 3턴·하루 60턴(고정 창 — 하루 = 첫 요청부터 24시간, 기존 `rateLimit` 과 같은 방식). 초과 `429 RATE_LIMITED {reason, retryAfterSec}` —
 *   `reason` 은 분당 `ASK_RATE`·하루 `ASK_DAILY`(화면이 안내를 가르는 1차 신호, 계약 §2-18-A 3항). `reason` 이 없는 옛 응답에 대비해 화면은
 *   `retryAfterSec > 3600` 으로 하루 한도를 추정한다(screens §25 L-11) — 그래서 하루 한도는 창 끝 무렵에도 3601초 이상을 준다.
 * - 이 프로세스 전체에서 ASK 진행 1 + 대기 2 를 넘으면 `429 RATE_LIMITED {reason:"ASK_BUSY", retryAfterSec}`(질문 전용 AI 실행 슬롯은
 *   하나뿐이라 그 앞의 줄이 무한정 길어지지 않게 묶는다 — 회화·채팅은 별도 슬롯이라 이 줄과 서로 기다리지 않는다).
 * - 검사는 하루 → 분 → 전역 순서의 **엿보기**이고 셋 다 통과해야 소비한다 — 거절된 시도는 몫을 깎지 않는다.
 * - 슬롯은 파이프라인이 끝날 때 `release`(정상·오류·끊김 공통), 수락 전 실패는 `refund`(몫까지 되돌림). 해제가 빠져도 슬롯은
 *   `ASK_SLOT_MAX_MS`(stale PENDING 판정과 같은 180초 — ASK LLM 예산 120초보다 길다) 뒤에는 세지 않는다.
 *
 * 메모리·단일 프로세스(blue/green 전환 때 초기화돼도 무해 — 기존 rateLimit 과 같은 전제). 로그는 남기지 않는다(질문 원문을 받지 않는다).
 */
import { ApiError } from '@/modules/infra'
import { STALE_PENDING_MS } from '../orchestrator/locks'

export const ASK_PER_MINUTE = 3
export const ASK_PER_DAY = 60
/** 진행 1 + 대기 2. */
export const ASK_MAX_INFLIGHT = 3
export const ASK_SLOT_MAX_MS = STALE_PENDING_MS
/** `ASK_BUSY` 때 다시 시도까지 — 질문 1건이 보통 끝나는 시간 근처(LLM 예산 120초 안). */
export const ASK_BUSY_RETRY_SEC = 30
/** 하루 한도 `retryAfterSec` 하한(`reason` 이 없는 응답에서 화면이 3600 초과로 하루를 추정한다). */
export const ASK_DAY_RETRY_MIN_SEC = 3601

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

interface Window {
  resetAt: number
  count: number
}

interface AskLimitState {
  minute: Map<string, Window>
  day: Map<string, Window>
  /** 슬롯 표식 → 잡은 시각. */
  slots: Map<symbol, number>
}

declare global {
  var __kaiwaAskLimits: AskLimitState | undefined
}

function state(): AskLimitState {
  return (globalThis.__kaiwaAskLimits ??= { minute: new Map(), day: new Map(), slots: new Map() })
}

export interface AskAdmission {
  /** 파이프라인이 끝났을 때(정상·오류·끊김). 여러 번 불러도 한 번만. */
  release(): void
  /** 수락 전에 실패했을 때 — 슬롯 해제 + 분·하루 몫 되돌림. */
  refund(): void
}

function live(map: Map<string, Window>, key: string, now: number): Window | null {
  const w = map.get(key)
  return w && w.resetAt > now ? w : null
}

function sweep(map: Map<string, Window>, now: number): void {
  if (map.size > 500) for (const [k, v] of map) if (v.resetAt <= now) map.delete(k)
}

function liveSlots(s: AskLimitState, now: number): number {
  let n = 0
  for (const [k, at] of s.slots) {
    if (now - at > ASK_SLOT_MAX_MS) s.slots.delete(k)
    else n++
  }
  return n
}

/** 429 `details.reason` — 클라이언트가 안내 문구를 가르는 값(`details` 에 싣는다 — `ASK_BUSY` 와 같은 자리). */
export type AskLimitReason = 'ASK_RATE' | 'ASK_DAILY' | 'ASK_BUSY'

function rateLimited(retryAfterSec: number, reason: AskLimitReason): ApiError {
  const message = reason === 'ASK_BUSY' ? '지금 질문이 몰려 있어요. 잠시 뒤에 다시 물어봐 주세요.' : '질문을 너무 자주 보냈어요. 잠시 후 다시 물어봐 주세요.'
  return new ApiError('RATE_LIMITED', message, { reason, retryAfterSec })
}

function consume(map: Map<string, Window>, key: string, now: number, windowMs: number): Window {
  const w = live(map, key, now)
  if (w) {
    w.count++
    return w
  }
  sweep(map, now)
  const fresh = { resetAt: now + windowMs, count: 1 }
  map.set(key, fresh)
  return fresh
}

/** 수락 전 검사 + 소비. 거절은 `ApiError(RATE_LIMITED)` 를 던진다. */
export function admitAskTurn(userId: string, now = Date.now()): AskAdmission {
  const s = state()
  const day = live(s.day, userId, now)
  if (day && day.count >= ASK_PER_DAY) throw rateLimited(Math.max(Math.ceil((day.resetAt - now) / 1000), ASK_DAY_RETRY_MIN_SEC), 'ASK_DAILY')
  const minute = live(s.minute, userId, now)
  if (minute && minute.count >= ASK_PER_MINUTE) throw rateLimited(Math.max(1, Math.ceil((minute.resetAt - now) / 1000)), 'ASK_RATE')
  if (liveSlots(s, now) >= ASK_MAX_INFLIGHT) throw rateLimited(ASK_BUSY_RETRY_SEC, 'ASK_BUSY')

  const mw = consume(s.minute, userId, now, MINUTE_MS)
  const dw = consume(s.day, userId, now, DAY_MS)
  const slot = Symbol('ask-slot')
  s.slots.set(slot, now)
  let released = false
  const release = () => {
    if (released) return
    released = true
    s.slots.delete(slot)
  }
  return {
    release,
    refund: () => {
      if (released) return
      release()
      // 같은 창일 때만 되돌린다(그새 창이 바뀌었으면 새 창의 몫을 건드리지 않는다).
      if (s.minute.get(userId) === mw && mw.count > 0) mw.count--
      if (s.day.get(userId) === dw && dw.count > 0) dw.count--
    },
  }
}

/** 지금 세는 ASK 슬롯 수(만료 제외) — 시험·진단용. */
export function askInflightCount(now = Date.now()): number {
  return liveSlots(state(), now)
}

export function resetAskLimitsForTest(): void {
  globalThis.__kaiwaAskLimits = { minute: new Map(), day: new Map(), slots: new Map() }
}
