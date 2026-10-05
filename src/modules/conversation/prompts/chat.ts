/**
 * A2 채팅 턴(CHAT) — TALK 과 같지만 교정하지 않는다(표현 점검은 A3 REVIEW 에서 몰아서). 창은 최근 12개·6,000자.
 *
 * task-026(chat@v2) — 응답에 학습자 말의 한국어 번역 `userKo`(지시문 "필수"·스키마 선택 — REV-086 M3, 최상위·맨 끝)를 더했다. 문구는 TALK 와 같은 `USER_KO_INSTRUCTION_LINE`.
 * 이중 높임 등 정리는 `sanitizeUserKo` 가 null 로(재시도 없음). CHAT 은 5초 예산 밖이라 TALK 와 달리 키 순서 지시는 두지 않는다 — 단, 필드 이름은 지시문에
 * 정확히 적는다(A5·A11 교훈).
 *
 * task-036(chat@v3) — 구 히라가나 읽기 줄 필드를 응답 계약에서 뺐다(화면 A·서버 분석이 읽기 줄을 대신함 — 근거·범위는 talk.ts 머리 task-036 절). 지시 줄·스키마·타입에서
 * 같이 뺐고 persona 는 무변경이다. DB `ChatMessage.reading` 컬럼은 남기고 새 메시지는 null.
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkChatResponse } from '../structuredResponse/checks'
import { CHAT_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'
import { buildWindow, type WindowMessage } from '../window'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'
import { USER_KO_INSTRUCTION_LINE } from './talk'

export const CHAT_PROMPT_VERSION = 'chat@v3'

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
    '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 **최대 2문장**(짧은 반응 + 질문 하나), replyKo 는 한국어 번역.',
    '- correction 은 항상 null 입니다(틀린 표현은 대화가 끝난 뒤 표현 점검에서 봅니다). 대화의 흐름을 이어 가는 데 집중합니다.',
    '- learning.grammarPoint·difficulty, speech.style, endOfTopic, proposals(보통 빈 배열)를 채웁니다.',
    USER_KO_INSTRUCTION_LINE,
    INJECTION_GUARD,
  ].join('\n')
  const window = buildWindow(input.history, { maxCount: 12, maxChars: 6_000 })
  return {
    task: 'chat',
    persona,
    system,
    messages: [...window, { role: 'user', content: input.text }],
    jsonSchema: CHAT_SCHEMA,
    // task-037 — TALK 과 같은 루트 조기 닫힘 구문 슬립 복구(요청 단위 옵트인, 설명은 `buildTalkRequest`).
    repairRootClose: true,
    extraCheck: (data) => checkChatResponse(input.text, data),
  }
}
