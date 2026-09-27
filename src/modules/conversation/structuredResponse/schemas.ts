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

/**
 * A1 회화 턴(TALK) — 교정 0~1건.
 * 선언 순서 = 출력 순서 지시(talk@v2: speech → conversation → correction → learning → endOfTopic → proposals). `withJsonOnly` 가
 * 이 스키마를 프롬프트에 그대로 싣기 때문에 선언 순서가 지시와 어긋나면 모델이 헷갈린다. `speech.style` 이 먼저 와야 첫 문장
 * 조기 합성(task-007 K2-2)이 말투를 알고 시작한다. 검증 의미는 순서와 무관하다.
 */
export const TALK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['speech', 'conversation', 'correction', 'learning', 'endOfTopic', 'proposals'],
  properties: {
    speech,
    conversation,
    correction: { anyOf: [{ type: 'null' }, correctionObject] },
    learning,
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

/**
 * A10 단어 보강(WORD_ENRICH) — domain-model `WordEntry` 필드명과 그대로 맞춘다(카멜케이스, 변환 계층 불필요).
 * `reading/meaning/partOfSpeech/example/exampleKo` 는 `valid:true` 일 때만 채운다(스키마는 전부 nullable 로 두고
 * "valid 면 null 아님"은 표현할 수 없어 `checks.ts` 의 `checkWordEnrich` 가 맡는다). `jlpt` 는 valid 여도 모르면 null 허용.
 * `example`/`exampleKo` 상한 200자는 domain-model `@db.Text`(사실상 무제한, ≤2,000 지침) 안에서 A10 이 "단어 1개"만
 * 다루는 동기·저지연 지점이라 더 좁혀 잡았다(짧은 예문 1문장이면 충분, 큰 상한은 지연·재시도 비용만 늘린다).
 */
export const PART_OF_SPEECH = ['NOUN', 'VERB', 'ADJ_I', 'ADJ_NA', 'ADVERB', 'PARTICLE', 'EXPRESSION', 'OTHER'] as const
export type PartOfSpeech = (typeof PART_OF_SPEECH)[number]

export interface WordEnrichResponse {
  /** 입력이 실제 일본어 단어·표현으로 보이면 true. false 면 사전 필드는 참고용일 뿐 저장하지 않는다(라우트 책임). */
  valid: boolean
  /** valid=false 일 때만 한국어 이유(예: "한국어 문자열이라 일본어 단어로 볼 수 없어요"). valid=true 면 null. */
  invalidReason: string | null
  /** 히라가나 + 장음 부호(ー)만(가타카나·한자·로마자·공백 금지) — `checks.ts` 가 정규식으로 검증. */
  reading: string | null
  /** 한국어 뜻. 여럿이면 대표 1~3개를 ", " 로 이어 쓴다(설명문 아님). */
  meaning: string | null
  partOfSpeech: PartOfSpeech | null
  /** 모르면 지어내지 말고 null(N5~N1 확신 있을 때만). */
  jlpt: JlptLevel | null
  /** 입력 표현을 표기 그대로(한자·가나 변경 없이) 포함하는 짧은 일본어 예문 1개. */
  example: string | null
  exampleKo: string | null
}

export const WORD_ENRICH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['valid', 'invalidReason', 'reading', 'meaning', 'partOfSpeech', 'jlpt', 'example', 'exampleKo'],
  properties: {
    valid: { type: 'boolean' },
    invalidReason: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 200 }] },
    reading: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 120 }] },
    meaning: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 200 }] },
    partOfSpeech: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...PART_OF_SPEECH] }] },
    jlpt: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...JLPT_LEVELS] }] },
    example: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 200 }] },
    exampleKo: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 200 }] },
  },
} as const
