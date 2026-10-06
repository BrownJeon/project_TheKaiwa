/**
 * 표현 점검(A3) 결과 항목별 정리(순수) — task-006 D11.
 *
 * `checkChatReview` 를 엄격한 `extraCheck` 로 쓰면 인용 위반 1건에 **응답 전체**가 유실된다. 그래서 엔진은 `softExtraCheck` 로
 * 위반이 있을 때 **1회만** 재시도하고, 스키마를 통과한 시도들(`candidates`)을 그대로 돌려준다. 여기서:
 *   1. 마지막 시도의 항목을 하나씩 본다 — `message_id` 가 점검 대상이 아니거나, `original` 이 그 메시지 전체 또는 문장 하나 전체와
 *      바이트 일치하지 않거나, `corrected === original` 이면 **그 항목만** 버린다(`dropped` 에 센다).
 *   2. 앞선 시도의 정상 항목 중 마지막 시도가 다루지 않은 (메시지, 원문) 은 살린다 — 재시도가 정상 항목을 빠뜨려도 잃지 않는다
 *      ("정상 항목은 반드시 남긴다").
 *   3. 저장할 `original` 은 모델 문자열이 아니라 **서버가 가진 원문**(메시지 전체 또는 `splitJaSentences` 로 찾은 서버 쪽 문장)이다.
 *   4. 추가 설명 `extra_note_ko`(task-039, chatReview@v3)는 `toDraft` 에서 한 번 정리해 draft 와 함께 운반한다 — 병합이 고른 항목의 값이 그대로 저장된다.
 */
import type { ChatReviewResponse, ReviewItem } from '../structuredResponse/schemas'
import { sanitizeExtraNoteKo, splitJaSentences } from '../structuredResponse/checks'

export interface ReviewCorrectionDraft {
  messageId: string
  original: string
  corrected: string
  explanation: string
  /** task-039 — 정리(`sanitizeExtraNoteKo`)를 거친 추가 설명. 모델이 칸을 안 냈거나 정리에서 걸리면 null. */
  extraNoteKo: string | null
  errorType: ReviewItem['error_type']
  severity: ReviewItem['severity']
  chunkType: ReviewItem['chunk_type']
}

/** 서버 원문에서 인용과 바이트 일치하는 조각(메시지 전체 또는 문장 하나 전체). 없으면 null. */
export function serverOriginal(messageText: string, quoted: string): string | null {
  if (quoted === messageText) return messageText
  return splitJaSentences(messageText).find((s) => s === quoted) ?? null
}

/**
 * 표현 점검 항목의 추가 설명 정리 — 학습자 원문 복사 검사(Codex C1)를 **메시지 전체**와 **짚은 문장**(`original`) 양쪽으로 건다.
 * 긴 메시지는 통째로 복사될 수 없어(저장 상한 200자) 문장 쪽 검사가 실제로 막고, 짧은 문장(4자 미만)이 든 짧은 메시지는 메시지 쪽 검사가 막는다.
 */
export function reviewExtraNote(it: Pick<ReviewItem, 'explanation_ko' | 'extra_note_ko'>, messageText: string, original: string): string | null {
  const note = sanitizeExtraNoteKo(it.explanation_ko, it.extra_note_ko, messageText)
  return note !== null && original !== messageText ? sanitizeExtraNoteKo(it.explanation_ko, note, original) : note
}

export function mergeReviewCandidates(
  messages: { id: string; text: string }[],
  candidates: ChatReviewResponse[],
): { items: ReviewCorrectionDraft[]; dropped: number } {
  const order = new Map(messages.map((m, i) => [m.id, i]))
  const textOf = new Map(messages.map((m) => [m.id, m.text]))
  const out: ReviewCorrectionDraft[] = []
  const exact = new Set<string>()
  const covered = new Set<string>()
  let dropped = 0

  const toDraft = (it: ReviewItem): ReviewCorrectionDraft | null => {
    const text = textOf.get(it.message_id)
    if (text === undefined || it.corrected === it.original) return null
    const original = serverOriginal(text, it.original)
    if (original === null) return null
    return {
      messageId: it.message_id, original, corrected: it.corrected, explanation: it.explanation_ko, extraNoteKo: reviewExtraNote(it, text, original),
      errorType: it.error_type, severity: it.severity, chunkType: it.chunk_type,
    }
  }
  const coverKey = (d: ReviewCorrectionDraft) => `${d.messageId}\u0000${d.original}`
  const exactKey = (d: ReviewCorrectionDraft) => `${coverKey(d)}\u0000${d.corrected}`

  const last = candidates.at(-1)
  for (const it of last?.items ?? []) {
    const d = toDraft(it)
    if (!d) {
      dropped++
      continue
    }
    if (exact.has(exactKey(d))) continue
    exact.add(exactKey(d))
    covered.add(coverKey(d))
    out.push(d)
  }
  for (const c of candidates.slice(0, -1)) {
    for (const it of c.items) {
      const d = toDraft(it)
      if (!d || covered.has(coverKey(d)) || exact.has(exactKey(d))) continue
      exact.add(exactKey(d))
      out.push(d)
    }
  }
  // 메시지 순서대로(같은 메시지 안에서는 모델이 준 순서 유지) — 저장 순서가 #34 정렬(D5)과 같아진다.
  const indexed = out.map((d, i) => ({ d, i }))
  indexed.sort((x, y) => (order.get(x.d.messageId) ?? 0) - (order.get(y.d.messageId) ?? 0) || x.i - y.i)
  return { items: indexed.map((x) => x.d), dropped }
}
