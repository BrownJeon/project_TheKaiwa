/**
 * L2 Conversation Platform — 공개 API(module-dependency L2). Phase 1 task-004 범위: 페르소나 로더·구조화 응답·프롬프트 3종.
 * orchestrator·chats·corrections·proposals 는 task-006. speech 를 import 하지 않는다(라우트가 조합).
 */
export { loadPersona, PersonaUnavailableError, AGENT_NAME } from './persona/loader'
export type { LoadedPersona, PersonaOptions } from './persona/loader'
export * from './structuredResponse/schemas'
export { isExactOriginal, isVerbatimQuote, splitJaSentences, checkTalkResponse, checkChatResponse, checkChatReview, countJaSentences, REPLY_SENTENCE_HARD_CAP } from './structuredResponse/checks'
export { buildWindow } from './window'
export type { WindowMessage } from './window'
export type { LearnerHeader } from './prompts/header'
export { buildTalkRequest, TALK_PROMPT_VERSION } from './prompts/talk'
export type { TalkInput } from './prompts/talk'
export { buildChatRequest, CHAT_PROMPT_VERSION } from './prompts/chat'
export type { ChatInput } from './prompts/chat'
export { buildChatReviewRequest, CHAT_REVIEW_PROMPT_VERSION, ReviewTooLargeError } from './prompts/chatReview'
export type { ChatReviewInput, ChatReviewMessage, ChatReviewRequest } from './prompts/chatReview'
