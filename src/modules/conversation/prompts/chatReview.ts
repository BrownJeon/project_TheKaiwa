/**
 * A3 채팅 표현 점검(REVIEW) — 학습자 메시지 전부(≤40건·8,000자)를 받아 **문장당 오류 전부**를 짚는다(tutor §3-2).
 * message_id 는 입력에서 받은 값을 그대로 돌려줘야 하고, original 은 그 메시지의 원문 인용이어야 한다(후검증).
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkChatReview } from '../structuredResponse/checks'
import { CHAT_REVIEW_SCHEMA, type ChatReviewResponse } from '../structuredResponse/schemas'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const CHAT_REVIEW_PROMPT_VERSION = 'chatReview@v1'
export const REVIEW_MAX_MESSAGES = 40
export const REVIEW_MAX_CHARS = 8_000

export interface ChatReviewInput {
  todayKst: string
  learner: LearnerHeader
  messages: { id: string; text: string }[]
}

export class ReviewTooLargeError extends Error {
  readonly userMessage = '점검할 메시지가 너무 많아요. 최근 대화부터 나눠서 점검해 주세요.'
}

export function buildChatReviewRequest(input: ChatReviewInput): LlmJsonRequest<ChatReviewResponse> {
  const msgs = input.messages.slice(-REVIEW_MAX_MESSAGES)
  const body = msgs.map((m) => `- id=${m.id} | ${m.text}`).join('\n')
  if (body.length > REVIEW_MAX_CHARS) throw new ReviewTooLargeError(`점검 입력 ${body.length}자 > ${REVIEW_MAX_CHARS}`)
  const persona = loadPersona({ sections: [1, 2, 3, 4, 5, 6, 8], level: input.learner.level, mode: 'REVIEW' })
  const system = [
    renderToday(input.todayKst),
    '[모드] REVIEW',
    renderHeader(input.learner, 600),
    '[지시] 아래는 이번 채팅에서 학습자가 쓴 메시지 전부입니다. 각 메시지의 틀린 표현을 **빠짐없이** 찾아 items 에 한 건씩 적으세요.',
    '- message_id 는 아래 id 를 그대로 씁니다. original 은 그 메시지에서 틀린 부분을 한 글자도 바꾸지 않고 인용합니다(문장 전체 또는 연속된 구간). 오류가 없는 메시지는 items 에 넣지 않습니다.',
    '- explanation_ko 는 한국어로 어느 조각(이름·액션·느낌·꾸밈)이 왜 틀렸는지. summary_ko 는 전체 총평 2~3문장, strengths·focus 는 각각 최대 3개.',
    INJECTION_GUARD,
  ].join('\n')
  return {
    task: 'chatReview',
    persona,
    system,
    messages: [{ role: 'user', content: `[학습자 메시지]\n${body}` }],
    jsonSchema: CHAT_REVIEW_SCHEMA,
    extraCheck: (data) => checkChatReview(msgs, data),
  }
}
