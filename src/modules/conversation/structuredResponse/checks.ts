/**
 * 스키마로 표현하지 못하는 후검증 — 위반 문구 배열을 돌려주면 engine.llm.completeJson 이 1회 재시도한다.
 *
 * 원문 무수정(검증 세트 V1, 원칙 "Correction.original 은 어떤 경로로도 바뀌지 않는다"):
 * `original` 은 학습자 입력과 **바이트 단위로 같거나**, 입력의 연속된 부분 문자열(2자 이상, 여러 문장 중 한 문장 인용)이어야 한다.
 * 앞뒤 공백은 비교 전에 걷어 내지 않는다 — 모델이 고친 흔적을 숨기지 않기 위해서다.
 */
import type { ChatReviewResponse, TutorResponse } from './schemas'

export function isVerbatimQuote(input: string, original: string): boolean {
  if (original === input) return true
  return original.length >= 2 && input.includes(original)
}

/** 일본어 문장 수 — 。！？!? 로 끝나는 덩어리를 센다(끝 부호가 없는 마지막 덩어리도 1문장). */
export function countJaSentences(text: string): number {
  const parts = text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  return parts.length
}

export function checkTalkResponse(input: string, data: TutorResponse, opts: { maxSentences?: number } = {}): string[] {
  const v: string[] = []
  const max = opts.maxSentences ?? 2
  if (countJaSentences(data.conversation.replyJa) > max) v.push(`conversation.replyJa 는 ${max}문장 이내여야 한다`)
  const c = data.correction
  if (c) {
    if (!isVerbatimQuote(input, c.original)) {
      v.push('correction.original 은 학습자 문장을 한 글자도 바꾸지 않고 그대로 복사해야 한다(부분 인용은 원문 그대로의 연속 구간만)')
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
    if (!isVerbatimQuote(text, it.original)) v.push(`items[${i}].original 은 해당 메시지 원문을 그대로 인용해야 한다`)
    if (it.corrected === it.original) v.push(`items[${i}].corrected 가 original 과 같다`)
  })
  return v
}
