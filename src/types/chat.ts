/**
 * AI 채팅 화면의 클라이언트 DTO — api-contract #27~#39·#55 응답 모양을 **그대로 옮긴** 타입이다.
 * 서버 모듈(Prisma 타입)을 import 하지 않는다: 화면은 계약만 알고, 서버 구현이 바뀌어도 계약이 같으면 그대로 돈다.
 * enum 문자열은 `domain-model.md`(prisma/schema.prisma) 값과 같다.
 */

export type ChatKind = 'TALK' | 'CHAT' | 'ASK'
export type MessageRole = 'USER' | 'ASSISTANT'
export type MessageStatus = 'PENDING' | 'DONE' | 'FAILED'
export type InputSource = 'REALTIME_STT' | 'SERVER_STT' | 'TEXT'
export type ErrorType =
  | 'GRAMMAR'
  | 'PARTICLE'
  | 'CONJUGATION'
  | 'VOCABULARY'
  | 'POLITENESS'
  | 'NATURALNESS'
  | 'WORD_ORDER'
  | 'PRONUNCIATION'
  | 'OTHER'
export type Severity = 'MINOR' | 'MAJOR'
/** task-010c — 회화 교정을 보여 주는 때(유창성의 MINOR = LATER "모아 둔 교정", 그 밖 NOW). */
export type CorrectionDeliver = 'NOW' | 'LATER'
/** task-010c — 코치 힌트 교정의 다음 말 판정(SELF 스스로 고침 · REPEAT 정답 보고 고침 · MISSED 못 고침). */
export type SelfCheckResult = 'SELF' | 'REPEAT' | 'MISSED'
export type ChunkType = 'NAME' | 'ACTION' | 'FEELING' | 'MODIFIER'
export type ProposalKind = 'ADD_WORD' | 'ADD_STUDY_LOG' | 'ADD_TOPIC' | 'SET_LEVEL' | 'SCHEDULE_REVIEW'
export type ProposalStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
export type TurnStage = 'PROMPT' | 'LLM' | 'PARSE' | 'TTS'
export type PartOfSpeech = 'NOUN' | 'VERB' | 'ADJ_I' | 'ADJ_NA' | 'ADVERB' | 'PARTICLE' | 'EXPRESSION' | 'OTHER'

export interface Paged<T> {
  items: T[]
  nextCursor: string | null
}

/** #27 목록 항목 */
export interface ChatSummary {
  id: string
  kind: ChatKind
  title: string
  topic?: { id: string; title: string } | null
  level?: string | null
  lastMessageAt: string | null
  preview: string | null
  messageCount: number
  reviewedAt: string | null
  running: boolean
}

/** #28 응답 */
export interface CreatedChat {
  id: string
  kind: ChatKind
  title: string
  messageCount: number
  running: boolean
  createdAt: string
}

/** #29 `chat` */
export interface ChatInfo {
  id: string
  kind: ChatKind
  title: string
  level?: string | null
  running: boolean
  reviewedAt: string | null
  messageCount: number
}

export interface LearningInfo {
  grammarPoint?: string | null
  difficulty?: string | null
}

/** #29 메시지의 교정 객체 = #34 항목의 부분집합. #34 는 `chat`·`savedWordId`·시각을 더 싣는다. */
export interface CorrectionDto {
  id: string
  status: ProposalStatus
  original: string
  corrected: string
  explanation: string
  errorType: ErrorType
  severity: Severity
  chunkType: ChunkType | null
  savedWordId?: string | null
  messageId?: string
  chat?: { id: string; title: string; kind: ChatKind }
  createdAt?: string
  resolvedAt?: string | null
  /** TALK 만(task-010c). 없으면 NOW. */
  deliver?: CorrectionDeliver
  /** TALK·코치 — 정답을 말하지 않는 힌트. 있으면 카드가 힌트부터 보인다. */
  hintKo?: string | null
  selfCheck?: SelfCheckResult | null
}

/** #29 메시지 */
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  /** 옛 메시지(task-036 이전)에만 값이 있는 히라가나 읽기 — 화면이 쓰지 않는다(읽기 줄은 후리가나·한글 분석이 대신). 새 메시지는 늘 null. */
  reading?: string | null
  translation?: string | null
  inputSource?: InputSource | null
  /** USER · 음성으로 보낸 말의 발화 id(task-007 §9-11 ⑥). 내 목소리 다시 듣기(#21b)에 쓴다. */
  utteranceId?: string | null
  /** USER · 발화 원음이 아직 있는가(보존 기간 안·삭제 안 됨). 모르면(없는 필드) 있다고 보고 404 에서 숨긴다. */
  audioAvailable?: boolean | null
  /** ASSISTANT · 이 답의 말투(`done.speech.style` 과 같은 값) — 다시 듣기 #23 이 캐시를 맞히게 싣는다. */
  speechStyle?: string | null
  status: MessageStatus
  learning?: LearningInfo | null
  corrections?: CorrectionDto[]
  createdAt: string
}

/** 화면 전용: 서버 응답 전 임시 사용자 말풍선(`tmp_…`). 서버 값이 오면 교체된다. */
export interface ChatMessageView extends ChatMessage {
  localStatus?: 'SENDING'
  /**
   * 화면 전용(task-026 E6-A): 이번 세션에 보낸 내 말의 번역 상태 — `pending` 턴이 끝나기 전 · `failed` `done.userTranslation === null`.
   * 서버 값이 아니다(#29 로 다시 읽으면 사라지고 `translation` 이 그 자리를 채운다).
   */
  translationState?: 'pending' | 'failed'
}

/** #29 응답 */
export interface ChatDetail {
  chat: ChatInfo
  messages: ChatMessage[]
  pendingProposals: number
  /** TALK 만 — 회화 전체의 처리하지 않은 모아 둔 교정 수(task-010c). */
  laterPending?: number
  nextCursor: string | null
}

export interface AddWordPayload {
  surface: string
  reading?: string | null
  meaning?: string | null
}

/** ADD_STUDY_LOG payload — 점검 총평을 재방문·잡 경로에서도 복원하려고 여기 보관한다(task-006 결정 3·D4). */
export interface StudyLogPayload {
  chatId?: string
  messageCount?: number
  correctionCount?: number
  summaryKo?: string | null
  strengths?: string[] | null
  focus?: string[] | null
  skippedMessages?: number | null
}

/** #37 항목 */
export interface ProposalDto {
  id: string
  kind: ProposalKind
  payload: Record<string, unknown>
  status: ProposalStatus
  chat?: { id: string; title: string } | null
  messageId?: string | null
  createdAt?: string
  resolvedAt?: string | null
  result?: Record<string, unknown> | null
}

/* ── #32 턴 SSE 이벤트 ───────────────────────────────────────────── */

export interface TurnAcceptedEvent {
  userMessageId: string
  assistantMessageId: string
  traceId?: string
}

export interface TurnStatusEvent {
  stage: TurnStage
  elapsedMs?: number
  warning?: string
}

/** #32 `audio`·`clientTimings` 는 회화 계약 타입(`./talk`, A 확정)을 그대로 쓴다. */
export type { TurnAudioEvent } from './talk'
export type { TurnClientTimings as ClientTimings } from './talk'

/** #32 `done.correction` — TALK 만(CHAT·ASK 는 늘 null). */
export interface TurnCorrection {
  id: string
  required?: boolean
  original: string
  corrected: string
  explanationKo?: string | null
  explanation?: string | null
  errorType: ErrorType
  severity: Severity
  chunkType?: ChunkType | null
  status?: ProposalStatus
  deliver?: CorrectionDeliver
  hintKo?: string | null
}

export interface TurnDoneEvent {
  userMessageId: string
  assistantMessageId: string
  conversation: { replyJa: string; replyKo?: string | null }
  correction?: TurnCorrection | null
  /** 직전 코치 힌트 교정의 판정(task-010c). */
  selfCheck?: { correctionId: string; result: SelfCheckResult } | null
  learning?: LearningInfo | null
  speech?: { style?: string } | null
  endOfTopic?: boolean
  proposals?: Array<Pick<ProposalDto, 'id' | 'kind' | 'payload' | 'status'> & { messageId?: string | null }>
  /** 내 말 번역(task-026 T1 — 같은 LLM 호출). null = 이번 턴에 못 만듦(화면은 [다시 가져오기]). ASK 는 늘 null. */
  userTranslation?: string | null
  audioCount?: number
  traceId?: string
}

export interface TurnErrorEvent {
  code?: string
  message?: string
  traceId?: string
  retryable?: boolean
}

/* ── #33 표현 점검 ───────────────────────────────────────────────── */

export interface ReviewItemDto {
  correctionId: string
  messageId: string
  original: string
  corrected: string
  explanation?: string
  explanationKo?: string
  errorType: ErrorType
  severity: Severity
  chunkType: ChunkType | null
  status: ProposalStatus
}

export interface ReviewSyncResponse {
  items: ReviewItemDto[]
  summaryKo?: string | null
  strengths?: string[] | null
  focus?: string[] | null
  skippedMessages?: number | null
  dropped?: number
  reviewedAt: string
}

export interface ReviewJobResponse {
  jobId: string
}

/** #55 */
export interface JobDto {
  id: string
  kind: string
  status: JobStatus
  progress: number
  stage: string | null
  refId: string | null
  error: string | null
  createdAt: string
  finishedAt: string | null
}

/* ── #35·#38 채택 ───────────────────────────────────────────────── */

export interface CorrectionAcceptBody {
  addWord?: {
    surface: string
    reading?: string
    meaning: string
    partOfSpeech?: PartOfSpeech
    chunkType?: ChunkType
    category?: string
  }
}

export interface CorrectionAcceptResponse {
  correction: { id: string; status: ProposalStatus; resolvedAt: string | null; savedWordId: string | null }
  word?: { id: string; surface: string } | null
}

export interface CorrectionRejectResponse {
  id: string
  status: ProposalStatus
  resolvedAt: string | null
}

export interface ProposalAcceptResponse {
  proposal: { id: string; kind: ProposalKind; status: ProposalStatus; result?: Record<string, unknown> | null }
}

export interface ProposalRejectResponse {
  id: string
  status: ProposalStatus
}
