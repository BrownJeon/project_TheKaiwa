/**
 * L2 Conversation Platform — 공개 API(module-dependency L2). task-004: 페르소나 로더·구조화 응답·프롬프트 3종.
 * task-006: chats(조회·생성·수정·삭제)·orchestrator(턴·사용자당 락·stale 정리)·review(A3 점검)·corrections·proposals(상태 전이).
 * task-008: `wordEnrich`(A10 단어 보강 요청 빌더 — 실행은 `learning/vocab/enrich` 가 라우트를 거쳐 값으로 받는다,
 * L3 는 L2 를 import 하지 않는다).
 * task-007: 턴 훅(gate·onAccepted·speaker — 라우트가 speech 로 구현해 넘긴다)·TALK 문장 음성 스케줄러·조기 첫 문장·예열(prewarmTalkTurn).
 * task-010: A4 레슨 요청 빌더(`buildLessonRequest`) + 레슨 생성 라우트용 읽기(`buildLearnerHeader`·`recentAcceptedCorrections`)·
 * 레슨 메모 단어 제안(`createLessonWordProposals` — TutorProposal 은 L2 소유라 learning 이 아니라 여기서 쓴다, 라우트가 조합).
 * speech 를 import 하지 않는다(라우트가 조합). learning 은 **읽기**만 — 채택 결과 쓰기는 라우트가 learning 에 위임한다.
 */
export { loadPersona, PersonaUnavailableError, AGENT_NAME } from './persona/loader'
export type { LoadedPersona, PersonaOptions } from './persona/loader'
export * from './structuredResponse/schemas'
export { isExactOriginal, isVerbatimQuote, splitJaSentences, checkTalkResponse, checkChatResponse, checkChatReview, checkWordEnrich, checkLessonResponse, countJaSentences, REPLY_SENTENCE_HARD_CAP } from './structuredResponse/checks'
export { repairLessonResponse, LESSON_REPAIR_CHUNKS_MAX } from './structuredResponse/repair'
export type { LessonRepairSourceChunk, LessonRepairResult } from './structuredResponse/repair'
export { normalizeForLessonMatch, chunkAppearsIn } from './structuredResponse/matching'
export { buildWindow } from './window'
export type { WindowMessage } from './window'
export type { LearnerHeader } from './prompts/header'
export { buildTalkRequest, TALK_PROMPT_VERSION, CORRECTION_MODES } from './prompts/talk'
export type { TalkInput, CorrectionMode } from './prompts/talk'
export { buildChatRequest, CHAT_PROMPT_VERSION } from './prompts/chat'
export type { ChatInput } from './prompts/chat'
export { buildChatReviewRequest, CHAT_REVIEW_PROMPT_VERSION, ReviewTooLargeError } from './prompts/chatReview'
export type { ChatReviewInput, ChatReviewMessage, ChatReviewRequest } from './prompts/chatReview'
export { buildWordEnrichRequest, WORD_ENRICH_PROMPT_VERSION, WordEnrichInputError } from './prompts/wordEnrich'
export type { WordEnrichInput } from './prompts/wordEnrich'
export { buildLessonRequest, LESSON_PROMPT_VERSION, LessonInputError } from './prompts/lesson'
export type { LessonInput, LessonTopicInput, LessonTopicChunkInput, LessonAcceptedCorrection, LessonPreviousPreview, LessonRequest } from './prompts/lesson'

// ── task-010b: A11 복습 판단 · A5 복습 혼합 ──
export * from './structuredResponse/reviewSchemas'
export { checkReviewDecisionResponse } from './structuredResponse/reviewChecks'
export { normalizeReviewDecision, REVIEW_INTERVAL_MIN, REVIEW_INTERVAL_MAX, REVIEW_FOCUS_INTERVAL_MAX, REVIEW_FALLBACK_INTERVAL_DAYS, REVIEW_FALLBACK_REASON_KO } from './structuredResponse/reviewRepair'
export type { ReviewDecisionCandidateRef, ReviewDecisionNormalizeResult } from './structuredResponse/reviewRepair'
export { buildReviewDecisionRequest, REVIEW_DECISION_PROMPT_VERSION, REVIEW_DECISION_HEADER_CAP, REVIEW_DECISION_CANDIDATES_MAX_CHARS, REVIEW_DECISION_MAX_CANDIDATES, ReviewDecisionInputError } from './prompts/reviewDecision'
export type { ReviewDecisionInput, ReviewDecisionCandidateInput, ReviewDecisionObservationSummary, ReviewDecisionErrorStat, ReviewDecisionRequest } from './prompts/reviewDecision'
export { buildReviewMixRequest, REVIEW_MIX_PROMPT_VERSION, REVIEW_MIX_HEADER_CAP, REVIEW_MIX_MAX_ITEMS, ReviewMixInputError } from './prompts/reviewMix'
export type { ReviewMixInput, ReviewMixItemInput, ReviewMixRequest } from './prompts/reviewMix'

// ── task-006 ──
export { parseCreateChat, parseTitle, parseKind, parseTurnBody, CHAT_KINDS, TURN_TEXT_MAX, CHAT_TITLE_MAX } from './chats/validate'
export type { CreateChatInput, TurnRequest, TurnClientTimings } from './chats/validate'
export { createChat, listChats, getChatDetail, getOwnedChat, ownedChatIds, updateChatTitle, deleteChat, sweepStalePending } from './chats'
export type { ChatDto, ChatDetailDto, MessageDto } from './chats'
export { startTurn, prewarmTalkTurn } from './orchestrator'
export type { TurnHandle, TurnAccepted, TurnHooks, SelfCorrectionRecord, CorrectionProposedRecord } from './orchestrator'
// task-010c 교정 방식(유창성·코치) — 표시 시점·코치 힌트·자기수정 판정(순수 함수)
export { resolveTalkCorrectionMode, correctionDeliver, coachHintOf, judgeSelfCorrection, normalizeForSelfCheck, CORRECTION_DELIVERS } from './corrections/talkDelivery'
export type { CorrectionDeliver, SelfCheckResult, TalkCorrectionMeta } from './corrections/talkDelivery'
export type { TurnSpeaker, TurnSpeechRequest, TurnSpeechResult } from './orchestrator/turnAudio'
export { forgetLearnerBase, buildLearnerHeader } from './turnContext'
export type { TurnEvent } from './orchestrator/stream'
export { STALE_PENDING_MS } from './orchestrator/locks'
export { reviewChat, REVIEW_SYNC_MAX_USER_MESSAGES } from './review'
export type { ReviewOutcome, ReviewSyncDto, ReviewItemDto, ReviewHooks } from './review'
export { listCorrections, acceptCorrection, setCorrectionSavedWord, rejectCorrection, rejectCorrectionIn, CORRECTION_STATUSES, listCorrectionRefsByWord, recentAcceptedCorrections } from './corrections'
export type { RejectedCorrection } from './corrections'
export type { AcceptedCorrection, CorrectionListQuery } from './corrections'
export type { CorrectionDto } from './corrections/serialize'
export { listProposals, acceptProposal, setProposalResult, rejectProposal, PROPOSAL_KINDS, PROPOSAL_STATUSES, createLessonWordProposals, getProposalsByIds } from './proposals'
export type { AcceptedProposal, AcceptedWord, ProposalDto, ProposalListQuery, LessonWordDraft, LessonWordProposal } from './proposals'
// task-011 L5: 평가 레벨 올리기 제안(SET_LEVEL) — 채점 트랜잭션 뒤 라우트가 연결, 채택은 #38
export { createLevelProposal, findEvaluationLevelProposal } from './proposals'
export type { LevelProposalDraft, LevelProposalBasis } from './proposals'

// ── task-011: A6(EVAL_GEN)·A7(EVAL_GRADE) — evalSchemas.ts·evalChecks.ts(schemas.ts·checks.ts 와 분리, 파일 주석 참고) ──
export {
  EVAL_ITEM_KINDS,
  EVAL_DIMS,
  EVAL_KINDS,
  EVAL_GEN_ITEM_COUNTS,
  EVAL_GEN_TOTAL_ITEMS,
  EVAL_OBJECTIVE_KINDS,
  EVAL_SUBJECTIVE_KINDS,
  buildEvalGenSchema,
  buildEvalGradeSchema,
  EVAL_SENTENCE_READING_PATTERN,
} from './structuredResponse/evalSchemas'
export type {
  EvalItemKind,
  EvalDim,
  EvalKind,
  EvalGenItem,
  EvalGenResponse,
  EvalGradeItemOut,
  EvalGradeResponse,
  EvalRubric,
  EvalMeaningChoiceItem,
  EvalReadingInputItem,
  EvalUsageChoiceItem,
  EvalChunkClassifyItem,
  EvalListenRespondItem,
  EvalAssembleItem,
  EvalSituationRespondItem,
  EvalCorrectionSpotItem,
} from './structuredResponse/evalSchemas'
export {
  computeEvalItemHash,
  checkEvalGenResponse,
  repairEvalGenWordLinks,
  repairEvalGenChunkTypeSync,
  checkEvalGradeResponse,
  finalizeEvalGradeItems,
  clampRubric,
  EVAL_GEN_MATERIAL_RATIO_MIN,
} from './structuredResponse/evalChecks'
export type { CheckEvalGenInput, EvalGenRepairResult, CheckEvalGradeInput } from './structuredResponse/evalChecks'
export { buildEvalGenRequest, EVAL_GEN_PROMPT_VERSION, EVAL_GEN_MATERIALS_MAX, EVAL_GEN_USER_PROMPT_CAP } from './prompts/evalGen'
export type { EvalGenInput, EvalGenWordCandidate, EvalGenTopicInput } from './prompts/evalGen'
export { buildEvalGradeRequest, EVAL_GRADE_PROMPT_VERSION, EVAL_GRADE_ANSWER_RENDER_MAX, EVAL_GRADE_USER_PROMPT_CAP, EvalGradeInputError } from './prompts/evalGrade'
export type { EvalGradeInput, EvalGradeSubjectiveItem, EvalGradeObjectiveSummary, EvalGradeSubjectiveKind } from './prompts/evalGrade'
