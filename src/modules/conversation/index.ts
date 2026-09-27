/**
 * L2 Conversation Platform — 공개 API(module-dependency L2). task-004: 페르소나 로더·구조화 응답·프롬프트 3종.
 * task-006: chats(조회·생성·수정·삭제)·orchestrator(턴·사용자당 락·stale 정리)·review(A3 점검)·corrections·proposals(상태 전이).
 * task-008: `wordEnrich`(A10 단어 보강 요청 빌더 — 실행은 `learning/vocab/enrich` 가 라우트를 거쳐 값으로 받는다,
 * L3 는 L2 를 import 하지 않는다).
 * speech 를 import 하지 않는다(라우트가 조합). learning 은 **읽기**만 — 채택 결과 쓰기는 라우트가 learning 에 위임한다.
 */
export { loadPersona, PersonaUnavailableError, AGENT_NAME } from './persona/loader'
export type { LoadedPersona, PersonaOptions } from './persona/loader'
export * from './structuredResponse/schemas'
export { isExactOriginal, isVerbatimQuote, splitJaSentences, checkTalkResponse, checkChatResponse, checkChatReview, checkWordEnrich, countJaSentences, REPLY_SENTENCE_HARD_CAP } from './structuredResponse/checks'
export { buildWindow } from './window'
export type { WindowMessage } from './window'
export type { LearnerHeader } from './prompts/header'
export { buildTalkRequest, TALK_PROMPT_VERSION } from './prompts/talk'
export type { TalkInput } from './prompts/talk'
export { buildChatRequest, CHAT_PROMPT_VERSION } from './prompts/chat'
export type { ChatInput } from './prompts/chat'
export { buildChatReviewRequest, CHAT_REVIEW_PROMPT_VERSION, ReviewTooLargeError } from './prompts/chatReview'
export type { ChatReviewInput, ChatReviewMessage, ChatReviewRequest } from './prompts/chatReview'
export { buildWordEnrichRequest, WORD_ENRICH_PROMPT_VERSION, WordEnrichInputError } from './prompts/wordEnrich'
export type { WordEnrichInput } from './prompts/wordEnrich'

// ── task-006 ──
export { parseCreateChat, parseTitle, parseKind, parseTurnBody, CHAT_KINDS, TURN_TEXT_MAX, CHAT_TITLE_MAX } from './chats/validate'
export type { CreateChatInput, TurnRequest } from './chats/validate'
export { createChat, listChats, getChatDetail, updateChatTitle, deleteChat, sweepStalePending } from './chats'
export type { ChatDto, ChatDetailDto, MessageDto } from './chats'
export { startTurn } from './orchestrator'
export type { TurnHandle, TurnAccepted } from './orchestrator'
export type { TurnEvent } from './orchestrator/stream'
export { STALE_PENDING_MS } from './orchestrator/locks'
export { reviewChat, REVIEW_SYNC_MAX_USER_MESSAGES } from './review'
export type { ReviewOutcome, ReviewSyncDto, ReviewItemDto } from './review'
export { listCorrections, acceptCorrection, setCorrectionSavedWord, rejectCorrection, CORRECTION_STATUSES, listCorrectionRefsByWord } from './corrections'
export type { AcceptedCorrection, CorrectionListQuery } from './corrections'
export type { CorrectionDto } from './corrections/serialize'
export { listProposals, acceptProposal, setProposalResult, rejectProposal, PROPOSAL_KINDS, PROPOSAL_STATUSES } from './proposals'
export type { AcceptedProposal, ProposalDto, ProposalListQuery } from './proposals'
