/**
 * 재확인 카드 · 내 발화 기록의 순수 판정(task-012b-2 가이드 §2·§4) — DOM·네트워크 없음, 단위 테스트가 그대로 부른다.
 * 서버 목록(#21c)의 "확인할 수 있는 발화" 조건과 같은 집합을 화면에서 한 번 더 막는다(USER 확정 발화는 서버가 이미 제외 — task-012b ⑫).
 * 늦게 온 응답 버리기(REV-132 L-1·L-3)도 여기 둔다 — 요청은 호출자가 주입하므로 이 파일은 네트워크를 모른다.
 */
import type { Err } from '@/components/common/errors'
import { kstDateKey } from '@/components/common/format'
import type { UtteranceContext, UtteranceFinalSource, UtteranceListDto, UtteranceListItem, UtteranceResolveBody, UtteranceViewDto } from '@/types/speech'
import { CHIP_COPY, CONTEXT_COPY, REVIEW_COPY } from './utteranceCopy'

export const FIX_TEXT_MAX = 1000
/** 회화방 카드 확인 주기(D-4) — 화면이 보이고, 최근 음성 메시지가 창 안에 있을 때만. */
export const REVIEW_POLL_MS = 30_000
/**
 * 분석 결과가 나올 수 있는 창(D-4) — 분석은 사용자별 디바운스(마지막 발화 +20초, 상한 첫 발화 +5분)로 대화가 멈춘 뒤 돈다.
 * task-012b 실측: 마지막 발화 ≈20초 + 발화당 ≈4~5초, 30발화 백로그 p50 90초·최대 155초 → 6분이면 최대치의 2배 넘게 덮는다.
 */
export const REVIEW_WINDOW_MS = 6 * 60_000

export type ReviewFields = Pick<UtteranceListItem, 'status' | 'requiresReview' | 'finalSource' | 'realtimeText' | 'analysisText'>

/** 카드를 띄우는 조건 — 분석 끝 + 다르게 들림 + 아직 처음 들린 글 그대로 + 처음 들린 글이 있음 + 보내는 중이 아님. */
export function isReviewable(u: ReviewFields, localStatus?: string | null): boolean {
  return u.status === 'ANALYZED' && u.requiresReview && u.finalSource === 'REALTIME' && u.realtimeText.trim() !== '' && localStatus !== 'SENDING'
}

/** 둘째 안(다시 들어 본 글)이 있고 처음 들린 글과 다른가 — 아니면 한 안 화면(R3). */
export function hasSecond(u: Pick<UtteranceListItem, 'realtimeText' | 'analysisText'>): boolean {
  const b = u.analysisText?.trim() ?? ''
  return b !== '' && b !== u.realtimeText.trim()
}

export type FixResult = { ok: true; body: UtteranceResolveBody } | { ok: false; error: string }

/**
 * 직접 고친 글 → #21a 본문. 처음 들린 글·다시 들어 본 글과 같으면 그 출처로 보낸다 — 같은 글을 USER 로 보내면 "다시 들어 본 안 채택률"이 흐려진다
 * (api-contract #21a). 빈칸·1,000자 초과는 요청 없이 시트 안 오류.
 */
export function fixChoice(text: string, realtimeText: string, analysisText: string | null): FixResult {
  const t = text.trim()
  if (!t) return { ok: false, error: 'empty' }
  if (Array.from(t).length > FIX_TEXT_MAX) return { ok: false, error: 'tooLong' }
  if (t === realtimeText.trim()) return { ok: true, body: { choice: 'REALTIME' } }
  if (analysisText != null && t === analysisText.trim()) return { ok: true, body: { choice: 'ANALYSIS' } }
  return { ok: true, body: { choice: 'USER', text: t } }
}

export type ChipTone = 'neutral' | 'good'
export interface Chip {
  tone: ChipTone
  label: string
}

/** 기록 줄 칩 — 할 일이 없는 발화(분석 전·실패·다르게 들리지 않음)는 칩 없음(L14). */
export function chipOf(u: ReviewFields & Pick<UtteranceListItem, 'wasReviewTarget'>): Chip | null {
  if (isReviewable(u)) return { tone: 'neutral', label: CHIP_COPY.pending }
  if (u.finalSource === 'USER') return { tone: 'neutral', label: CHIP_COPY.user }
  if (u.finalSource === 'ANALYSIS') return { tone: 'good', label: CHIP_COPY.analysis }
  if (u.wasReviewTarget && u.finalSource === 'REALTIME' && !u.requiresReview) return { tone: 'good', label: CHIP_COPY.realtime }
  return null
}

export interface ContextView {
  label: string
  href: string | null
  linkLabel: string | null
}

/**
 * 발화가 쓰인 곳 → 줄 문구·원래 화면 링크(id 가 없으면 링크 없음).
 * 서버가 나중에 늘린 `kind`(이 화면이 모르는 값)는 원인을 단정하지 않는 UNSENT 문구·링크 없음으로 보인다 — `hasOwn` 이라 `constructor` 같은 키도 같은 길.
 */
export function contextOf(c: UtteranceContext): ContextView {
  const copy = Object.hasOwn(CONTEXT_COPY, c.kind) ? CONTEXT_COPY[c.kind] : CONTEXT_COPY.UNSENT
  const id = c.id ? encodeURIComponent(c.id) : null
  const href = !id
    ? null
    : c.kind === 'TALK'
      ? `/study/ai/talk/${id}`
      : c.kind === 'LESSON'
        ? `/study/today/talk/${id}`
        : c.kind === 'EVALUATION'
          ? `/study/today/eval/${id}`
          : null
  return { label: copy.label, href, linkLabel: href ? copy.link : null }
}

/** 녹음 길이 → 초(반올림, 최소 1). */
export function durationSec(ms: number): number {
  return Math.max(1, Math.round(ms / 1000))
}

/** 날짜 구분선을 이 줄 앞에 둘까(KST 날짜가 바뀔 때). */
export function needsDivider(prevIso: string | null, iso: string): boolean {
  return prevIso === null || kstDateKey(prevIso) !== kstDateKey(iso)
}

export type ResolveFailure = { phase: 'gone' | 'missing' | 'error'; text: string }

/** #21a 실패 → 카드 상태(R6·R7·R8). 400(고른 안이 빔 등)도 다시 시도할 수 있는 오류로. */
export function resolveFailure(err: Pick<Err, 'status'>): ResolveFailure {
  if (err.status === 409) return { phase: 'gone', text: REVIEW_COPY.already }
  if (err.status === 404) return { phase: 'missing', text: REVIEW_COPY.missing }
  if (err.status === 429) return { phase: 'error', text: REVIEW_COPY.rate }
  if (err.status === 0) return { phase: 'error', text: REVIEW_COPY.offline }
  return { phase: 'error', text: REVIEW_COPY.failed }
}

/** #21a 성공 응답(#22 형태) → 목록 줄 갱신(L12 — 본문 = finalText, 칩 = 결과). 다른 칸은 그대로. */
export function applyResolved(item: UtteranceListItem, view: Pick<UtteranceViewDto, 'finalText' | 'finalSource' | 'requiresReview'>): UtteranceListItem {
  return { ...item, finalText: view.finalText, finalSource: view.finalSource, requiresReview: view.requiresReview, wasReviewTarget: true }
}

/** 기록 줄 본문 — 확정본(없으면 처음 들린 글). */
export function rowText(u: Pick<UtteranceListItem, 'finalText' | 'realtimeText'>): string {
  return u.finalText ?? u.realtimeText
}

export interface VoiceMessageLike {
  role: string
  createdAt: string
  inputSource?: string | null
}

/** 창 안에 만든 음성 메시지가 있는가(내 음성 메시지만 — 분석 결과는 그 뒤에 나온다). */
export function hasRecentVoice(messages: readonly VoiceMessageLike[], now: number, windowMs = REVIEW_WINDOW_MS): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'USER' || m.inputSource !== 'REALTIME_STT') continue
    const t = Date.parse(m.createdAt)
    if (Number.isFinite(t) && now - t <= windowMs) return true
  }
  return false
}

/** 주기 확인을 할까 — 화면이 보이고, 회화가 쉬는 중(녹음·인식·생각·말하기 아님)이고, 창 안 음성 메시지가 있을 때만. */
export function shouldPoll(i: { visible: boolean; paused: boolean; recentVoice: boolean }): boolean {
  return i.visible && !i.paused && i.recentVoice
}

export interface ReviewEntry {
  item: UtteranceListItem
  /** 이 방에서 방금 확정한 출처 — 방을 떠날 때까지 성공 줄(R5)을 둔다. */
  resolved: UtteranceFinalSource | null
}

/**
 * 새 목록 → 메시지별 카드. 펼쳤거나 기록 중인 카드(`pinned`)와 방금 확정한 카드는 응답에서 빠져도 그대로 둔다
 * (고르는 중에 사라지지 않게 — 다른 기기에서 확정됐으면 다음 기록 요청이 409 → R6).
 */
export function mergeReviews(prev: ReadonlyMap<string, ReviewEntry>, incoming: readonly UtteranceListItem[], pinned: ReadonlySet<string>): Map<string, ReviewEntry> {
  const next = new Map<string, ReviewEntry>()
  for (const it of incoming) {
    if (!it.chatMessageId || !isReviewable(it)) continue
    const old = prev.get(it.chatMessageId)
    if (old && (pinned.has(old.item.id) || old.resolved)) next.set(it.chatMessageId, old)
    else next.set(it.chatMessageId, { item: it, resolved: null })
  }
  for (const [msgId, e] of prev) {
    if (next.has(msgId)) continue
    if (e.resolved || pinned.has(e.item.id)) next.set(msgId, e)
  }
  return next
}

export interface SlotMessage {
  id: string
  role?: string
  localStatus?: string | null
}

/** 회화방 삽입 자리에 붙일 카드 — 내 말풍선(USER)이고 보내는 중이 아닐 때만 그 메시지의 확인 대상. */
export function slotEntry(message: SlotMessage, entryFor: (messageId: string) => ReviewEntry | null): ReviewEntry | null {
  if (message.role !== undefined && message.role !== 'USER') return null
  if (message.localStatus === 'SENDING') return null
  return entryFor(message.id)
}

/** 펼치기 직전에 부를 것 — 넘겨받은 값이 우선, 없으면 회화방 목록의 따라가기 멈춤(task-039 ⑧), 목록 밖이면 없음. */
export function expandHandler(explicit: (() => void) | undefined, hold: (() => void) | null): (() => void) | undefined {
  return explicit ?? hold ?? undefined
}

export type Settled<T> = { kind: 'ok'; value: T } | { kind: 'error' } | { kind: 'stale' }

/**
 * 요청 하나를 기다리고, 그 사이 조건(필터·방)이 바뀌었으면 결과를 버린다 — 성공이든 실패든 `stale`.
 * `stale` 이면 호출자는 상태를 하나도 건드리지 않는다(옛 조건의 행·커서·오류 표시가 새 목록에 섞이지 않게).
 */
export async function settleIfCurrent<T>(run: () => Promise<T>, stillCurrent: () => boolean): Promise<Settled<T>> {
  try {
    const value = await run()
    return stillCurrent() ? { kind: 'ok', value } : { kind: 'stale' }
  } catch {
    return stillCurrent() ? { kind: 'error' } : { kind: 'stale' }
  }
}

export interface RequestGate {
  /** 지금 조건의 표 — 응답 때 부르면 그 사이 `invalidate` 가 없었는지 답한다. */
  ticket: () => () => boolean
  /** 조건이 바뀜(필터 전환) — 그 전에 받은 표는 모두 무효. */
  invalidate: () => void
}

export function requestGate(): RequestGate {
  let n = 0
  return {
    ticket: () => {
      const t = n
      return () => t === n
    },
    invalidate: () => {
      n++
    },
  }
}

/** "더 보기" 다음 쪽을 뒤에 붙인다 — 이미 있는 id 는 빼고(경계에서 같은 행이 다시 와도 한 줄). */
export function appendPage(prev: readonly UtteranceListItem[], incoming: readonly UtteranceListItem[]): UtteranceListItem[] {
  const seen = new Set(prev.map((p) => p.id))
  return [...prev, ...incoming.filter((x) => !seen.has(x.id))]
}

export interface RoomRefreshDeps {
  /** 지금 화면이 보고 있는 방(렌더마다 갱신되는 값) — 응답 때 다시 읽는다. */
  currentRoom: () => string
  paused: () => boolean
  /** 방마다 한 번에 요청 하나. */
  inflight: { current: string | null }
  fetchList: (chatId: string) => Promise<UtteranceListDto>
  /** 응답이 와도 지우지 않을 카드(펼침·기록 중). */
  keep: () => ReadonlySet<string>
  apply: (update: (prev: Map<string, ReviewEntry>) => Map<string, ReviewEntry>) => void
}

export type RoomRefreshOutcome = 'skipped' | 'applied' | 'stale' | 'failed'

/**
 * 회화방 카드 갱신 한 번(`useUtteranceReviews` 의 효과 본문) — 턴 중이거나 같은 방 요청이 진행 중이면 보내지 않는다.
 * 응답이 오는 사이 방이 바뀌었으면 버린다(다른 방 카드가 섞이지 않게). 실패는 조용히(카드는 부가 정보 — 다음 기회에).
 */
export async function refreshRoomReviews(chatId: string, d: RoomRefreshDeps): Promise<RoomRefreshOutcome> {
  if (d.inflight.current === chatId || d.paused()) return 'skipped'
  d.inflight.current = chatId
  try {
    const r = await settleIfCurrent(() => d.fetchList(chatId), () => d.currentRoom() === chatId)
    if (r.kind === 'stale') return 'stale'
    if (r.kind === 'error') return 'failed'
    const keep = d.keep()
    d.apply((prev) => mergeReviews(prev, r.value.items, keep))
    return 'applied'
  } finally {
    if (d.inflight.current === chatId) d.inflight.current = null
  }
}
