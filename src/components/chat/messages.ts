/**
 * 채팅방 메시지 목록 계산(순수). 턴 훅·방 화면·단위 테스트가 같이 쓴다.
 * 서버 값이 오면 **id 기준으로 덮어쓴다**(폴링·재방문 동기화) — 화면이 가진 사본은 늘 서버의 부분집합 + 임시 말풍선이다.
 */
import type { ChatMessage, ChatMessageView, CorrectionDto, TurnCorrection } from '@/types/chat'

export const TEMP_PREFIX = 'tmp_'

export const isTemp = (m: { id: string }) => m.id.startsWith(TEMP_PREFIX)

export function findLastIndex<T>(arr: readonly T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i
  return -1
}

/** id 로 제자리 교체, 새 id 는 뒤에 붙인다(`after=` 응답은 늘 기존 것보다 뒤다). */
export function mergeMessages(prev: readonly ChatMessageView[], incoming: readonly ChatMessage[]): ChatMessageView[] {
  if (incoming.length === 0) return prev.slice()
  const byId = new Map<string, ChatMessage>()
  for (const m of incoming) byId.set(m.id, m)
  const seen = new Set<string>()
  const out: ChatMessageView[] = prev.map((m) => {
    seen.add(m.id)
    return byId.get(m.id) ?? m
  })
  for (const m of incoming) if (!seen.has(m.id)) out.push(m)
  return out
}

/** 앞쪽(이전 메시지 보기)에 붙인다. 이미 있는 id 는 버린다. */
export function prependMessages(prev: readonly ChatMessageView[], older: readonly ChatMessage[]): ChatMessageView[] {
  const have = new Set(prev.map((m) => m.id))
  return [...older.filter((m) => !have.has(m.id)), ...prev]
}

/** 서버가 아는 마지막 메시지 id(임시 말풍선 제외) — 새 메시지 폴링의 `after`. */
export function lastServerId(ms: readonly ChatMessageView[]): string | null {
  const i = findLastIndex(ms, (m) => !isTemp(m))
  return i === -1 ? null : ms[i].id
}

/** 마지막 사용자 메시지 **직전** id — 진행 중 턴을 `after=` 로 다시 읽을 기준. 첫 턴이면 null(= after 없이). */
export function turnBaseOf(ms: readonly ChatMessageView[]): string | null {
  const i = findLastIndex(ms, (m) => m.role === 'USER' && !isTemp(m))
  if (i <= 0) return i === 0 ? null : lastServerId(ms)
  return ms[i - 1].id
}

export function userMessageCount(ms: readonly ChatMessageView[]): number {
  return ms.reduce((n, m) => (m.role === 'USER' && !isTemp(m) ? n + 1 : n), 0)
}

export function pendingCorrectionCount(ms: readonly ChatMessageView[]): number {
  let n = 0
  for (const m of ms) for (const c of m.corrections ?? []) if (c.status === 'PROPOSED') n++
  return n
}

/** 마지막 메시지가 끝나지 않은 강사 답(FAILED 또는 락 없는 PENDING)인가 — 방 진입 시 "다시 받기" 상태. */
export function endsWithUnfinishedReply(ms: readonly ChatMessageView[]): boolean {
  const last = ms[ms.length - 1]
  return !!last && last.role === 'ASSISTANT' && last.status !== 'DONE'
}

/** 턴 `done.correction`(TALK) → #29 교정 모양. `required` 는 #29 에 없어 버린다 — 새로고침 전후 모양을 같게(task-007 §9-3 C). */
export function correctionFromDone(c: TurnCorrection): CorrectionDto {
  return {
    id: c.id,
    status: c.status ?? 'PROPOSED',
    original: c.original,
    corrected: c.corrected,
    explanation: c.explanationKo ?? c.explanation ?? '',
    errorType: c.errorType,
    severity: c.severity,
    chunkType: c.chunkType ?? null,
  }
}
