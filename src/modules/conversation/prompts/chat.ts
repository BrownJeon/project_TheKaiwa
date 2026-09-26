/**
 * A2 채팅 턴(CHAT) — TALK 과 같지만 교정하지 않는다(표현 점검은 A3 REVIEW 에서 몰아서). 창은 최근 12개·6,000자.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkChatResponse } from '../structuredResponse/checks'
import { CHAT_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'
import { buildWindow, type WindowMessage } from '../window'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const CHAT_PROMPT_VERSION = 'chat@v1'

export interface ChatInput {
  todayKst: string
  learner: LearnerHeader
  history: WindowMessage[]
  text: string
}

export function buildChatRequest(input: ChatInput): LlmJsonRequest<TutorResponse> {
  const persona = loadPersona({ sections: [1, 2, 4, 6], level: input.learner.level, mode: 'CHAT' })
  const system = [
    renderToday(input.todayKst),
    '[모드] CHAT',
    renderHeader(input.learner, 300),
    '[지시] [입력]의 학습자 말에 선생님으로서 일본어로 답하세요([대화]는 앞선 맥락입니다).',
    '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 **최대 2문장**(짧은 반응 + 질문 하나), replyReading 은 히라가나 읽기, replyKo 는 한국어 번역.',
    '- correction 은 항상 null 입니다(틀린 표현은 대화가 끝난 뒤 표현 점검에서 봅니다). 대화의 흐름을 이어 가는 데 집중합니다.',
    '- learning.grammarPoint·difficulty, speech.style, endOfTopic, proposals(보통 빈 배열)를 채웁니다.',
    INJECTION_GUARD,
  ].join('\n')
  const window = buildWindow(input.history, { maxCount: 12, maxChars: 6_000 })
  return {
    task: 'chat',
    persona,
    system,
    messages: [...window, { role: 'user', content: input.text }],
    jsonSchema: CHAT_SCHEMA,
    extraCheck: (data) => checkChatResponse(input.text, data),
  }
}
