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
export { isExactOriginal, isVerbatimQuote, splitJaSentences, checkTalkResponse, checkChatResponse, checkChatReview, checkReplyKoNaturalness, checkUserKoNaturalness, sanitizeUserKo, checkWordEnrich, checkLessonResponse, countJaSentences, REPLY_SENTENCE_HARD_CAP } from './structuredResponse/checks'
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
export { buildUserTranslationRequest, sanitizeUserTranslation, USER_TRANSLATION_PROMPT_VERSION, USER_TRANSLATION_TASK, USER_TRANSLATION_SCHEMA, USER_TRANSLATION_TEXT_MAX, UserTranslationInputError } from './prompts/userTranslation'
export type { UserTranslationInput, UserTranslationResponse } from './prompts/userTranslation'
export { buildTopicWordsRequest, assembleTopicWords, classifyTopicWordsResult, topicWordsRequestCount, buildTopicWordsExcludeLine, TOPIC_WORDS_PROMPT_VERSION, TOPIC_WORDS_TASK, TOPIC_WORDS_SCHEMA, TOPIC_WORDS_REQUEST_MAX, TOPIC_WORDS_EXCLUDE_MAX_ITEMS, TOPIC_WORDS_EXCLUDE_MAX_CHARS, TopicWordsInputError } from './prompts/topicWords'
export type { TopicWordsInput, TopicWordsTopicInput, TopicWordsRequest, TopicWordsResponse, TopicWordItem, TopicWord, TopicWordsAssembled, TopicWordsAssembleContext, TopicWordsOutcome, TopicWordDropReason } from './prompts/topicWords'
export { buildLessonRequest, LESSON_PROMPT_VERSION, LessonInputError } from './prompts/lesson'
export type { LessonInput, LessonTopicInput, LessonTopicChunkInput, LessonAcceptedCorrection, LessonPreviousPreview, LessonRequest } from './prompts/lesson'
// task-010d PE-2b 수업 A2 `[상황]` 블록(상황 수업 — 라우트 연결은 A2 developer)
export { lessonPromptVersion, LESSON_SCENARIO_PROMPT_VERSION } from './prompts/lesson'
export type { LessonScenarioInput } from './prompts/lesson'

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
export { retryUserTranslation } from './chats/translation'
// task-010d 상황 역할극 — A1-서버 생성·종료 재료 + A3b-1 라우트 연결(#28 첫마디·#29 chat.scenario·#167 종료·진행 중 칸)
export {
  parseRolePlayIds,
  createRolePlayChat,
  readRolePlayEndFacts,
  listOpenRolePlayChats,
  finishRolePlay,
  rolePlayChatView,
  chatRolePlayView,
  rolePlayProgress,
  rolePlayEnded,
  ROLE_PLAY_TURNS_READ_MAX,
} from './chats/rolePlay'
export type { RolePlayChatDto, RolePlayChatInput, RolePlayEndFacts, RolePlayChatRef } from './chats/rolePlay'
// task-010d A1-PE — 종료 판정(scenarioVerdict@v1)·상황 행 → 프롬프트 입력
export { buildScenarioVerdictRequest, finalizeScenarioVerdictFor, ScenarioVerdictInputError, SCENARIO_VERDICT_TASK, SCENARIO_VERDICT_PROMPT_VERSION } from './prompts/scenarioVerdict'
export type { ScenarioVerdictInput, ScenarioVerdictTurn } from './prompts/scenarioVerdict'
export { scenarioPromptParts } from './prompts/scenarioInput'
// task-010d PE-2b — AI 상황 초안(#166 scenarioDraft@v1)·대답 연습(#169 replyPractice@v1) + A3b-2 실행 서비스
export { buildScenarioDraftRequest, finalizeScenarioDraft, ScenarioDraftInputError, SCENARIO_DRAFT_TASK, SCENARIO_DRAFT_PROMPT_VERSION } from './prompts/scenarioDraft'
export type { ScenarioDraftInput } from './prompts/scenarioDraft'
export type { ScenarioDraftResponse, ScenarioDraftFinal } from './structuredResponse/scenarioDraft'
// task-045 AI 주제 초안(topicDraft@v2 — 주제 한 줄 → 설명 + 기본 표현 초안, 저장하지 않음). 라우트(app 층)가 값으로 엔진을 부른다
export { buildTopicDraftRequest, finalizeTopicDraft, TopicDraftInputError, TOPIC_DRAFT_TASK, TOPIC_DRAFT_PROMPT_VERSION } from './prompts/topicDraft'
export type { TopicDraftInput, TopicDraftRequest } from './prompts/topicDraft'
export { parseTopicDraftBody, topicDraftViolations, fitTopicDraft, checkTopicChunkFields, detectUnsafeTopicText, TOPIC_DRAFT_SCHEMA, TOPIC_DRAFT_LIMITS } from './structuredResponse/topicDraftSchemas'
export type { TopicDraftResponse, TopicDraftFinal, TopicDraftOutput, TopicDraftChunk, TopicDraftContext, TopicDraftBody, TopicDraftBodyProblem, TopicDraftBodyResult, TopicDraftDropReason, TopicDraftProblem, TopicDraftWarning, TopicDraftRepairs, TopicDraftUnsafeKind } from './structuredResponse/topicDraftSchemas'
// task-045 역할극 첫마디 일본어 제안(openingDraft@v2 — 한국어 첫마디 → 장면·역할·수준에 맞는 일본어 + 읽기, 저장하지 않음). 라우트(app 층)가 값으로 엔진을 부른다
export { buildOpeningDraftRequest, finalizeOpeningDraft, OpeningDraftInputError, OPENING_DRAFT_TASK, OPENING_DRAFT_PROMPT_VERSION, OPENING_DRAFT_TOO_LONG_MESSAGE } from './prompts/openingDraft'
export type { OpeningDraftInput, OpeningDraftRequest } from './prompts/openingDraft'
export { parseOpeningDraftBody, openingDraftViolations, fitOpeningDraft, OPENING_DRAFT_SCHEMA, OPENING_DRAFT_LIMITS } from './structuredResponse/openingDraftSchemas'
export type { OpeningDraftResponse, OpeningDraftFinal, OpeningDraftBody, OpeningDraftBodyProblem, OpeningDraftBodyResult, OpeningDraftScenarioContext, OpeningDraftProblem, OpeningDraftWarning, OpeningReadingDropReason, OpeningDraftRepairs, OpeningDraftStatus, OpeningDraftFinalStatus, OpeningDraftContext, OpeningTooLongReason } from './structuredResponse/openingDraftSchemas'
export { buildReplyPracticeRequest, finalizeReplyPracticeResponse, ReplyPracticeInputError, REPLY_PRACTICE_TASK, REPLY_PRACTICE_PROMPT_VERSION } from './prompts/replyPractice'
export type { ReplyPracticeInput } from './prompts/replyPractice'
export { checkReplyPracticeShape, dropChoiceSet } from './structuredResponse/replyPractice'
export type { ReplyPracticeModel, ReplyPracticeSuggestion } from './structuredResponse/replyPractice'
export { draftScenario, parseScenarioDraftBody, SCENARIO_DRAFT_DESCRIPTION_MIN } from './chats/scenarioDraft'
export type { ScenarioDraftResult, ScenarioDraftBody, ScenarioDraftInlineTopic } from './chats/scenarioDraft'
// task-045 변형 상황 초안(scenarioVariant@v3 — 기준 상황 + 축(성격·돌발·흐름·수준) → 새 상황 초안 + 바뀐 칸, 저장하지 않음). 라우트(app 층)가 값으로 엔진을 부른다. 축 열거·칩 문구는 `@/types/scenarioVariant`
export { buildScenarioVariantRequest, finalizeScenarioVariant, ScenarioVariantInputError, SCENARIO_VARIANT_TASK, SCENARIO_VARIANT_PROMPT_VERSION } from './prompts/scenarioVariant'
export type { ScenarioVariantInput, ScenarioVariantRequest, ScenarioVariantInputErrorCode } from './prompts/scenarioVariant'
export { parseScenarioVariantBody, scenarioVariantViolations, fitScenarioVariant, effectiveVariantAxes, hasVariantChange, normalizeVariantBase, computeVariantChangedFields, SCENARIO_VARIANT_SCHEMA } from './structuredResponse/scenarioVariantSchemas'
export type { ScenarioVariantBase, ScenarioVariantBody, ScenarioVariantBodyProblem, ScenarioVariantBodyResult, ScenarioVariantContext, ScenarioVariantFinal, ScenarioVariantFinalStatus, ScenarioVariantModelResponse, ScenarioVariantProblem, ScenarioVariantRepairs } from './structuredResponse/scenarioVariantSchemas'
// task-045 T2 — #170 AI 주제 초안 실행 서비스 · #57/#171 저장 검사 보조(학습자 글용 이모지 허용 변형·안내 코드·표현 중복)
export { draftTopic, readTopicDraftBody, topicDraftDeps, TOPIC_DRAFT_REJECT_MESSAGE, TOPIC_DRAFT_FAIL_MESSAGE } from './chats/topicDraft'
export type { TopicDraftDeps, TopicDraftResult } from './chats/topicDraft'
export { detectUnsafeUserTopicText, topicContentWarnings, findTopicChunkDuplicate } from './structuredResponse/topicDraftSchemas'
// task-045 T4 — #177 변형 상황 초안 · #178 첫마디 일본어 제안 실행 서비스(행 없음, 라우트는 본문 검사 → 한도 → 서비스)
export { readScenarioVariantBase, readScenarioVariantBody, draftScenarioVariant, scenarioVariantDeps, SCENARIO_VARIANT_REJECT_MESSAGE, SCENARIO_VARIANT_FAIL_MESSAGE } from './chats/scenarioVariantDraft'
export type { ScenarioVariantDeps, ScenarioVariantTarget } from './chats/scenarioVariantDraft'
export { readOpeningDraftBody, runOpeningDraft, openingDraftRunDeps, OPENING_DRAFT_REJECT_MESSAGE, OPENING_DRAFT_FAIL_MESSAGE } from './chats/openingDraftRun'
export type { OpeningDraftRunDeps, OpeningDraftResult } from './chats/openingDraftRun'
export { suggestReply, parseReplyPracticeBody, REPLY_PRACTICE_WINDOW } from './chats/replyPractice'
export type { ReplyPracticeResult } from './chats/replyPractice'
export type { UserTranslationResult } from './chats/translation'
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
