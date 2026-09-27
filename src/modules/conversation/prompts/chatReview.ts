/**
 * A3 채팅 표현 점검(REVIEW) — 학습자 메시지 전부(≤40건·8,000자)를 받아 **문장당 오류 전부**를 짚는다(tutor §3-2).
 * message_id 는 입력에서 받은 값을 그대로 돌려줘야 하고, original 은 그 메시지의 원문 인용이어야 한다(후검증).
 *
 * 입력 상한 처리(2026-09-27 task-006 Leader 결정 §5): 예외를 던지는 대신 **오래된 메시지부터 빼서 최근 것만**
 * 40건·8,000자 안에 담는다(`window.buildWindow` 와 같은 방향 — 최근부터 채우고 넘치면 오래된 쪽을 버린다). 몇 건을
 * 뺐는지는 반환값의 `skippedMessages` 로 호출자(라우트)에게 알린다 — 화면에 안내를 붙이거나 로그로 남기는 판단은
 * developer 몫이다. `ReviewTooLargeError` 는 **단일 메시지 하나만으로도 상한을 넘는 비정상 경우**의 방어용으로만
 * 남긴다(정상 입력에서는 메시지 1건이 route 검증으로 최대 1,000자라 8,000자 상한을 넘길 수 없다 — 실질적으로 발생하지
 * 않는다).
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkChatReview } from '../structuredResponse/checks'
import { CHAT_REVIEW_SCHEMA, type ChatReviewResponse } from '../structuredResponse/schemas'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const CHAT_REVIEW_PROMPT_VERSION = 'chatReview@v1'
export const REVIEW_MAX_MESSAGES = 40
export const REVIEW_MAX_CHARS = 8_000

export interface ChatReviewMessage {
  id: string
  text: string
}

export interface ChatReviewInput {
  todayKst: string
  learner: LearnerHeader
  /** 학습자 메시지만, **오래된 것부터 최근 순**(채팅 저장 순서 그대로). 강사 메시지는 넣지 않는다. */
  messages: ChatReviewMessage[]
}

/** 방어용 — 정상 경로에서는 도달하지 않는다(메시지 1건 상한 1,000자 ≪ 8,000자, 위 파일 설명 참조). */
export class ReviewTooLargeError extends Error {
  readonly userMessage = '점검할 메시지가 너무 많아요. 최근 대화부터 나눠서 점검해 주세요.'
}

export interface ChatReviewRequest extends LlmJsonRequest<ChatReviewResponse> {
  /** 40건·8,000자 상한 때문에 가장 오래된 메시지부터 뺀 개수. 0 이면 입력 전부가 반영됐다. */
  skippedMessages: number
}

/**
 * 최근 메시지부터 담아 개수(`maxCount`)·문자(`maxChars`) 상한 안에서 최대한 채우고, 상한을 넘기면 오래된 것부터
 * 뺀다. 반환하는 `kept` 는 항상 입력의 **연속된 최근 구간**(중간을 건너뛰지 않음)이다.
 */
function trimToBudget(
  messages: ChatReviewMessage[],
  maxCount: number,
  maxChars: number,
): { kept: ChatReviewMessage[]; skippedMessages: number } {
  const kept: ChatReviewMessage[] = []
  let used = 0
  for (let i = messages.length - 1; i >= 0 && kept.length < maxCount; i--) {
    const m = messages[i]
    const line = `- id=${m.id} | ${m.text}`
    const cost = line.length + (kept.length > 0 ? 1 : 0) // join('\n') 줄바꿈 1개 몫
    if (used + cost > maxChars) break
    used += cost
    kept.unshift(m)
  }
  return { kept, skippedMessages: messages.length - kept.length }
}

export function buildChatReviewRequest(input: ChatReviewInput): ChatReviewRequest {
  const { kept, skippedMessages } = trimToBudget(input.messages, REVIEW_MAX_MESSAGES, REVIEW_MAX_CHARS)
  if (kept.length === 0 && input.messages.length > 0) {
    throw new ReviewTooLargeError(`메시지 1건이 상한(${REVIEW_MAX_CHARS}자)보다 커서 점검할 수 없습니다`)
  }
  const body = kept.map((m) => `- id=${m.id} | ${m.text}`).join('\n')
  const persona = loadPersona({ sections: [1, 2, 3, 4, 5, 6, 8], level: input.learner.level, mode: 'REVIEW' })
  const scopeNote =
    skippedMessages > 0
      ? `중 가장 최근 ${kept.length}건입니다(오래된 ${skippedMessages}건은 분량 상한으로 이번 점검에서 제외됐습니다)`
      : '전부입니다'
  const system = [
    renderToday(input.todayKst),
    '[모드] REVIEW',
    renderHeader(input.learner, 600),
    `[지시] 아래는 이번 채팅에서 학습자가 쓴 메시지 ${scopeNote}. 각 메시지의 틀린 표현을 **빠짐없이** 찾아 items 에 한 건씩 적으세요.`,
    '- message_id 는 아래 id 를 그대로 씁니다. original 은 그 메시지 전체 또는 틀린 문장 하나 **전체**를 한 글자도 바꾸지 않고 인용합니다(문장 안의 일부만 잘라 쓰지 않음). 오류가 없는 메시지는 items 에 넣지 않습니다.',
    '- explanation_ko 는 한국어로 어느 조각(이름·액션·느낌·꾸밈)이 왜 틀렸는지. summary_ko 는 전체 총평 2~3문장, strengths·focus 는 각각 최대 3개.',
    INJECTION_GUARD,
  ].join('\n')
  return {
    task: 'chatReview',
    persona,
    system,
    messages: [{ role: 'user', content: `[학습자 메시지]\n${body}` }],
    jsonSchema: CHAT_REVIEW_SCHEMA,
    extraCheck: (data) => checkChatReview(kept, data),
    skippedMessages,
  }
}
