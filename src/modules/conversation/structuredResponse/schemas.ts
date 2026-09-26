/**
 * §67 구조화 응답 JSON 스키마(ajv 재검증 + Claude CLI `--json-schema` 공용). 필드명은 api-contract #32 `done` 과 같다.
 * 스키마가 표현하지 못하는 규칙(원문 바이트 일치·2문장 상한)은 `checks.ts` 의 후검증이 맡는다.
 */
export const ERROR_TYPES = ['GRAMMAR', 'PARTICLE', 'CONJUGATION', 'VOCABULARY', 'POLITENESS', 'NATURALNESS', 'WORD_ORDER', 'OTHER'] as const
export const SEVERITIES = ['MINOR', 'MAJOR'] as const
export const CHUNK_TYPES = ['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const
export const SPEECH_STYLES = ['NEUTRAL', 'ENCOURAGING', 'CALM', 'CHEERFUL'] as const
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const

export type ErrorType = (typeof ERROR_TYPES)[number]
export type Severity = (typeof SEVERITIES)[number]
export type ChunkType = (typeof CHUNK_TYPES)[number]
export type SpeechStyle = (typeof SPEECH_STYLES)[number]
export type JlptLevel = (typeof JLPT_LEVELS)[number]

export interface TutorCorrection {
  required: boolean
  original: string
  corrected: string
  explanationKo: string
  errorType: ErrorType
  severity: Severity
  chunkType: ChunkType | null
}

export interface TutorProposalDraft {
  kind: 'ADD_WORD'
  payload: { surface: string; reading: string; meaning: string }
}

export interface TutorResponse {
  conversation: { replyJa: string; replyReading: string; replyKo: string }
  correction: TutorCorrection | null
  learning: { grammarPoint: string | null; difficulty: JlptLevel }
  speech: { style: SpeechStyle }
  endOfTopic: boolean
  proposals: TutorProposalDraft[]
}

const conversation = {
  type: 'object',
  additionalProperties: false,
  required: ['replyJa', 'replyReading', 'replyKo'],
  properties: {
    replyJa: { type: 'string', minLength: 1, maxLength: 200 },
    replyReading: { type: 'string', maxLength: 400 },
    replyKo: { type: 'string', minLength: 1, maxLength: 400 },
  },
} as const

const correctionObject = {
  type: 'object',
  additionalProperties: false,
  required: ['required', 'original', 'corrected', 'explanationKo', 'errorType', 'severity', 'chunkType'],
  properties: {
    required: { type: 'boolean' },
    original: { type: 'string', minLength: 1, maxLength: 1000 },
    corrected: { type: 'string', minLength: 1, maxLength: 1000 },
    explanationKo: { type: 'string', minLength: 1, maxLength: 400 },
    errorType: { type: 'string', enum: [...ERROR_TYPES] },
    severity: { type: 'string', enum: [...SEVERITIES] },
    chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...CHUNK_TYPES] }] },
  },
} as const

const learning = {
  type: 'object',
  additionalProperties: false,
  required: ['grammarPoint', 'difficulty'],
  properties: {
    grammarPoint: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 80 }] },
    difficulty: { type: 'string', enum: [...JLPT_LEVELS] },
  },
} as const

const speech = {
  type: 'object',
  additionalProperties: false,
  required: ['style'],
  properties: { style: { type: 'string', enum: [...SPEECH_STYLES] } },
} as const

const proposals = {
  type: 'array',
  maxItems: 2,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'payload'],
    properties: {
      kind: { type: 'string', enum: ['ADD_WORD'] },
      payload: {
        type: 'object',
        additionalProperties: false,
        required: ['surface', 'reading', 'meaning'],
        properties: {
          surface: { type: 'string', minLength: 1, maxLength: 80 },
          reading: { type: 'string', maxLength: 120 },
          meaning: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
  },
} as const

/** A1 회화 턴(TALK) — 교정 0~1건. */
export const TALK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['conversation', 'correction', 'learning', 'speech', 'endOfTopic', 'proposals'],
  properties: {
    conversation,
    correction: { anyOf: [{ type: 'null' }, correctionObject] },
    learning,
    speech,
    endOfTopic: { type: 'boolean' },
    proposals,
  },
} as const

/** A2 채팅 턴(CHAT) — 교정은 항상 null(점검은 REVIEW 에서). */
export const CHAT_SCHEMA = {
  ...TALK_SCHEMA,
  properties: { ...TALK_SCHEMA.properties, correction: { type: 'null' } },
} as const

export interface ReviewItem {
  message_id: string
  original: string
  corrected: string
  explanation_ko: string
  error_type: ErrorType
  severity: Severity
  chunk_type: ChunkType | null
}

export interface ChatReviewResponse {
  items: ReviewItem[]
  summary_ko: string
  strengths: string[]
  focus: string[]
}

/** A3 채팅 표현 점검(REVIEW) — 문장당 오류 전부. */
export const CHAT_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'summary_ko', 'strengths', 'focus'],
  properties: {
    items: {
      type: 'array',
      maxItems: 120,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['message_id', 'original', 'corrected', 'explanation_ko', 'error_type', 'severity', 'chunk_type'],
        properties: {
          message_id: { type: 'string', minLength: 1, maxLength: 60 },
          original: { type: 'string', minLength: 1, maxLength: 1000 },
          corrected: { type: 'string', minLength: 1, maxLength: 1000 },
          explanation_ko: { type: 'string', minLength: 1, maxLength: 400 },
          error_type: { type: 'string', enum: [...ERROR_TYPES] },
          severity: { type: 'string', enum: [...SEVERITIES] },
          chunk_type: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...CHUNK_TYPES] }] },
        },
      },
    },
    summary_ko: { type: 'string', minLength: 1, maxLength: 600 },
    strengths: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 200 } },
    focus: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 200 } },
  },
} as const
