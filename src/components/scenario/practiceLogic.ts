/**
 * 대답 연습(task-010d B2 — 가이드 §3-E·§4 S10)의 순수 함수: 서버 응답 읽기 · 빈칸 자르기 · 보기 판정 · 방식 고르기 · 오류 분류.
 * React·브라우저 API 를 쓰지 않는다(단위 테스트 `__tests__/room.test.ts`).
 * 빈칸 구간은 서버 규약 그대로 **코드포인트 `[start, end)`** — `Array.from(ja).slice(start, end).join('')` 이 정답이다.
 * 고르기 세트(빈칸·보기 3개·정답 위치)는 통째로 맞거나 버린다 — 하나라도 어긋나면 [고르기]를 끄고 다른 방식으로 연다(`pr-noblank`).
 */
import { toErr, type Err } from '@/components/common/errors'

export type PracticeMode = 'choose' | 'say' | 'repeat'
export const PRACTICE_MODES: readonly PracticeMode[] = ['choose', 'say', 'repeat']

export interface BlankParts {
  before: string
  answer: string
  after: string
}

export interface PracticeChoice extends BlankParts {
  choices: [string, string, string]
  answerIndex: 0 | 1 | 2
}

export interface PracticeView {
  messageId: string
  ja: string
  ko: string
  /** 고르기 세트 — 없으면 [고르기] 비활성. */
  choose: PracticeChoice | null
  /** 정답을 새지 않는 힌트(있을 때만 [힌트]). */
  hintKo: string | null
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): string => (typeof v === 'string' && v.trim() ? v : '')

/** `ja` 를 코드포인트 구간으로 자른다. 정수가 아니거나 범위 밖·빈 구간이면 null(고르기 비활성). */
export function splitBlank(ja: string, blank: unknown): BlankParts | null {
  if (!isObj(blank)) return null
  const { start, end } = blank
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isInteger(start) || !Number.isInteger(end)) return null
  const cps = Array.from(ja)
  if (start < 0 || start >= end || end > cps.length) return null
  return { before: cps.slice(0, start).join(''), answer: cps.slice(start, end).join(''), after: cps.slice(end).join('') }
}

function chooseOf(ja: string, r: Record<string, unknown>): PracticeChoice | null {
  const parts = splitBlank(ja, r.blank)
  if (!parts) return null
  const c = r.choices
  if (!Array.isArray(c) || c.length !== 3 || c.some((x) => !text(x))) return null
  const list = c as string[]
  if (new Set(list.map((x) => x.trim())).size !== 3) return null
  const ai = r.answerIndex
  if (ai !== 0 && ai !== 1 && ai !== 2) return null
  if (list[ai] !== parts.answer) return null
  return { ...parts, choices: [list[0], list[1], list[2]], answerIndex: ai }
}

/** S10 응답 → 화면 값. 다른 말의 응답이거나 문장·뜻이 비면 null(판 안 오류). */
export function readPractice(raw: unknown, messageId: string): PracticeView | null {
  if (!isObj(raw)) return null
  if (typeof raw.messageId === 'string' && raw.messageId !== messageId) return null
  const ja = text(raw.ja)
  const ko = text(raw.ko)
  if (!ja || !ko) return null
  return { messageId, ja, ko, choose: chooseOf(ja, raw), hintKo: text(raw.hintKo) || null }
}

export function checkChoice(choice: Pick<PracticeChoice, 'answerIndex'>, picked: number): boolean {
  return picked === choice.answerIndex
}

/** 펼칠 때의 방식 — 마지막에 고른 방식(기본 고르기), 고르기 세트가 없으면 따라 하기. */
export function practiceModeOf(stored: string | null, hasChoose: boolean): PracticeMode {
  const m: PracticeMode = (PRACTICE_MODES as readonly string[]).includes(stored ?? '') ? (stored as PracticeMode) : 'choose'
  return m === 'choose' && !hasChoose ? 'repeat' : m
}

export type PracticeFailure = { kind: 'error' } | { kind: 'rate'; sec: number } | { kind: 'stale' } | { kind: 'busy' } | { kind: 'ended' }

function retrySec(err: Err): number {
  const fromDetails = Number(err.details.retryAfterSec)
  if (Number.isFinite(fromDetails) && fromDetails > 0) return Math.ceil(fromDetails)
  return err.retryAfterSec && err.retryAfterSec > 0 ? err.retryAfterSec : 10
}

/**
 * S10 실패 → 판 상태. 시간 초과·0·5xx·아직 없는 API(404·405)·모양 틀림 = 다시 시도(`pr-error`) · 429 = 대기 초 ·
 * 409 NOT_LATEST = 새 말이 와서 닫음 · 409 TURN_RUNNING = 선생님 말이 끝나면 · 409 ENDED/ROLEPLAY_ENDED = 마친 역할극 · 그 밖 409 = 다시 시도.
 */
export function practiceFailureOf(err: Err, timedOut: boolean): PracticeFailure {
  if (timedOut) return { kind: 'error' }
  if (err.status === 429) return { kind: 'rate', sec: retrySec(err) }
  if (err.status === 409) {
    const why = err.details.reason ?? err.code
    if (why === 'NOT_LATEST') return { kind: 'stale' }
    if (why === 'TURN_RUNNING') return { kind: 'busy' }
    if (why === 'ENDED' || why === 'ROLEPLAY_ENDED') return { kind: 'ended' }
  }
  return { kind: 'error' }
}

/** 요청 하나가 끝났을 때 판에 낼 것 — 제안 · 판 안 실패(`report` 면 방에도 알림: 다른 말·마친 역할극 처리). */
export type PracticeSettle = { kind: 'ready'; view: PracticeView } | { kind: 'failed'; failure: PracticeFailure; report: boolean }

/**
 * #169 요청 하나의 결말(REV-141 L-6 — `usePractice` 의 판단을 뺀 것). 판 닫음·새 말·언마운트로 취소돼 이제 살아 있지 않은 요청(`live()` 거짓)의
 * 늦은 응답·오류는 버린다(닫힌 판이 되살아나지 않게). 취소로 끊긴 것(AbortError, 시간 초과 아님)도 오류가 아니다. 12초 시간 초과만 오류.
 * 응답 모양이 틀리면 판 안 오류(방에는 알리지 않음).
 */
export async function settlePractice(fx: { request: () => Promise<unknown>; messageId: string; live: () => boolean; timedOut: () => boolean; settle: (r: PracticeSettle) => void }): Promise<void> {
  try {
    const raw = await fx.request()
    if (!fx.live()) return
    const view = readPractice(raw, fx.messageId)
    fx.settle(view ? { kind: 'ready', view } : { kind: 'failed', failure: { kind: 'error' }, report: false })
  } catch (e) {
    if (!fx.live()) return
    if (e instanceof DOMException && e.name === 'AbortError' && !fx.timedOut()) return
    fx.settle({ kind: 'failed', failure: practiceFailureOf(toErr(e), fx.timedOut()), report: true })
  }
}
