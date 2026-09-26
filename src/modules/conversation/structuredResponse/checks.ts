/**
 * 스키마로 표현하지 못하는 후검증 — 위반 문구 배열을 돌려주면 engine.llm.completeJson 이 1회 재시도한다.
 *
 * 원문 무수정(검증 세트 V1 — 실패는 CRITICAL, 정본 design-spec §8 "`correction.original` 바이트 일치"):
 *  - TALK·CHAT: `original` 은 이번 학습자 말과 **바이트 단위로 같아야** 한다(부분 인용 없음).
 *  - REVIEW: 여러 문장짜리 메시지에서 틀린 문장 하나를 짚을 수 있어야 하므로 **메시지 전체 또는 문장 하나 전체**
 *    (。！？!? · 줄바꿈 경계)와 같아야 한다. 문장 안의 임의 조각(예: 2글자)은 인정하지 않는다
 *    — 조각 인용을 허용하면 일본어에서는 거의 모든 두 글자가 원문에 있어 검사가 무력해진다(reviewer REV-004 Critical).
 *  - 앞뒤 공백을 걷어 내고 비교하지 않는다 — 모델이 고친 흔적을 숨기지 않기 위해서다.
 * 저장 시에는 라우트가 모델 값이 아니라 **서버가 가진 원문**을 `Correction.original` 에 넣는다(task-006) — 이 검사는 계약 위반 탐지용이다.
 */
import type { ChatReviewResponse, TutorResponse } from './schemas'

/** TALK·CHAT: 바이트 일치만. */
export function isExactOriginal(input: string, original: string): boolean {
  return original === input
}

/** 문장 경계(。！？!? 뒤·줄바꿈)로 나눈 문장들. 각 문장의 앞뒤 공백만 걷는다(문장 사이 공백 처리용). */
export function splitJaSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** REVIEW: 메시지 전체 또는 문장 하나 전체와 바이트 일치. */
export function isVerbatimQuote(input: string, original: string): boolean {
  if (original === input) return true
  return splitJaSentences(input).includes(original)
}

/** 일본어 문장 수 — 。！？!? 로 끝나는 덩어리를 센다(끝 부호가 없는 마지막 덩어리도 1문장). */
export function countJaSentences(text: string): number {
  const parts = text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  return parts.length
}

/**
 * replyJa 문장 수: 프롬프트 목표는 2문장이지만 **재시도는 3문장 초과에서만** 건다. 실측(2026-09-27)에서 haiku 가 짧은 3문장을
 * 종종 써서 재시도가 붙으면 턴이 ~10s 로 늘었다(12s fail-fast 위협). 3문장은 TTS·화면에 무리가 없어 계약 위반으로 보지 않는다.
 */
export const REPLY_SENTENCE_HARD_CAP = 3

export function checkTalkResponse(input: string, data: TutorResponse, opts: { maxSentences?: number } = {}): string[] {
  const v: string[] = []
  const max = opts.maxSentences ?? REPLY_SENTENCE_HARD_CAP
  if (countJaSentences(data.conversation.replyJa) > max) v.push(`conversation.replyJa 는 ${max}문장 이내여야 한다`)
  const c = data.correction
  if (c) {
    if (!isExactOriginal(input, c.original)) {
      v.push('correction.original 은 [입력]의 학습자 말 전체를 한 글자도 바꾸지 않고 그대로 복사해야 한다(일부만 인용하거나 공백·문장부호를 바꾸지 않는다)')
    }
    if (c.corrected === c.original) v.push('correction.corrected 가 original 과 같다 — 오류가 없으면 correction 을 null 로 둔다')
  }
  return v
}

export function checkChatResponse(input: string, data: TutorResponse): string[] {
  const v = checkTalkResponse(input, { ...data, correction: null })
  if (data.correction !== null) v.push('CHAT 모드에서 correction 은 항상 null 이다')
  return v
}

export function checkChatReview(messages: { id: string; text: string }[], data: ChatReviewResponse): string[] {
  const v: string[] = []
  const byId = new Map(messages.map((m) => [m.id, m.text]))
  data.items.forEach((it, i) => {
    const text = byId.get(it.message_id)
    if (text === undefined) {
      v.push(`items[${i}].message_id '${it.message_id}' 는 입력에 없는 id 다 — 받은 id 를 그대로 써야 한다`)
      return
    }
    if (!isVerbatimQuote(text, it.original)) v.push(`items[${i}].original 은 해당 메시지 전체 또는 그 안의 문장 하나 전체를 한 글자도 바꾸지 않고 인용해야 한다`)
    if (it.corrected === it.original) v.push(`items[${i}].corrected 가 original 과 같다`)
  })
  return v
}
