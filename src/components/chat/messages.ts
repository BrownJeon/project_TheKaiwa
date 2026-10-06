/**
 * 채팅방 메시지 목록 계산(순수). 턴 훅·방 화면·단위 테스트가 같이 쓴다.
 * 서버 값이 오면 **id 기준으로 덮어쓴다**(폴링·재방문 동기화) — 화면이 가진 사본은 늘 서버의 부분집합 + 임시 말풍선이다.
 */
import type { ChatMessage, ChatMessageView, CorrectionDto, ReviewItemDto, TurnCorrection } from '@/types/chat'

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

/**
 * 손으로 가져온 내 말 번역(#32t 200)을 목록에 넣는다 — 턴 `done.userTranslation` 과 같은 자리(`translation`, 상태 표시 지움). 칸이 접혔다
 * 다시 펴져도(말풍선 [번역 ▾]·표시 바 번역 토글) 다시 묻지 않게(REV-094 M-1). 해당 말이 없거나 빈 번역이면 그대로 돌려준다.
 */
export function withUserTranslation(ms: ChatMessageView[], messageId: string, text: string): ChatMessageView[] {
  if (!text.trim()) return ms
  const i = ms.findIndex((m) => m.id === messageId && m.role === 'USER')
  if (i === -1) return ms
  const { translationState: _drop, ...rest } = ms[i]
  void _drop
  const out = ms.slice()
  out[i] = { ...rest, translation: text }
  return out
}

/**
 * #32t 내 말 번역을 가져와 받은 번역을 `onTranslated` 로 목록에 올린다(빈 번역 = null, 올리지 않음). 오류는 그대로 던진다 — 칸 문구는
 * 호출한 말풍선이 정한다. 말풍선(`UserTranslation`)은 이 함수로만 가져온다(REV-095 M-1 — 올리는 호출이 빠지면 접었다 펴면 사라진다).
 */
export async function fetchUserTranslation(
  post: (url: string) => Promise<{ translation: string | null }>,
  chatId: string,
  messageId: string,
  onTranslated?: (messageId: string, text: string) => void,
): Promise<string | null> {
  const r = await post(`/api/v1/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/translation`)
  const text = r.translation?.trim() ? r.translation : null
  if (text) onTranslated?.(messageId, text)
  return text
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
    ...(c.deliver ? { deliver: c.deliver } : {}),
    ...(c.hintKo !== undefined ? { hintKo: c.hintKo ?? null } : {}),
    extraNoteKo: c.extraNoteKo ?? null,
  }
}

/** #33 동기 점검 항목 → #34 교정 모양(재방문 때 #34 로 다시 읽어도 같은 카드). 옛 응답의 빠진 `extraNoteKo` 는 null. */
export function correctionFromReviewItem(it: ReviewItemDto): CorrectionDto {
  return {
    id: it.correctionId,
    messageId: it.messageId,
    status: it.status,
    original: it.original,
    corrected: it.corrected,
    explanation: it.explanation ?? it.explanationKo ?? '',
    errorType: it.errorType,
    severity: it.severity,
    chunkType: it.chunkType ?? null,
    savedWordId: null,
    extraNoteKo: it.extraNoteKo ?? null,
  }
}
