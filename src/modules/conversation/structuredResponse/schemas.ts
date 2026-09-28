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
  /**
   * task-010c(talk@v3) — 코치 모드(`CorrectionMode.COACH`) 전용, additive nullable(기존 TALK 응답과 호환).
   * 정답(corrected)을 그대로 말하지 않는 한국어 힌트 1문장 — 학습자가 스스로 고쳐 말하도록 유도한다. 유창성
   * 모드(FLUENCY)에서는 항상 null(`prompts/talk.ts` 지시문). `checks.ts` 가 corrected 그대로 포함 여부를 검사한다.
   */
  hintKo: string | null
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
  required: ['required', 'original', 'corrected', 'explanationKo', 'errorType', 'severity', 'chunkType', 'hintKo'],
  properties: {
    required: { type: 'boolean' },
    original: { type: 'string', minLength: 1, maxLength: 1000 },
    corrected: { type: 'string', minLength: 1, maxLength: 1000 },
    explanationKo: { type: 'string', minLength: 1, maxLength: 400 },
    errorType: { type: 'string', enum: [...ERROR_TYPES] },
    severity: { type: 'string', enum: [...SEVERITIES] },
    chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...CHUNK_TYPES] }] },
    // task-010c(talk@v3) — 코치 모드 전용 힌트(additive nullable). 유창성 모드는 always null.
    hintKo: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 200 }] },
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

/**
 * A4 레슨 생성(LESSON) — design-spec §7-3·§8 A4, task-010 Leader's Plan L1~L7. 이해(dialogue) → 문법(grammar) →
 * 문제(quiz, 4지선다만·서버 재채점) → 응용(application) → 말하기(speaking, 상황 없이 자유 과제) 5단계 + `nextPreview`
 * ("조금 아쉬운 종료 지점", learning-personalization §1-5).
 *
 * reading 계열 필드(문장·예문 읽기)는 스키마 단에서 `pattern` 으로 강제한다 — A10 `WORD_ENRICH_READING_RE` 보다
 * 느슨하다(단어 하나가 아니라 문장·구 전체의 읽기라 문장부호·공백·장음 조합 기호가 필요하다). **LESSON 의 5개 reading
 * 필드는 아래 `LESSON_READING_PATTERN`(히라가나+가타카나)을 쓴다 — `KANA_READING_PATTERN`(히라가나만) 이 아니다**,
 * 이유는 그 상수 바로 옆 주석 참고(lesson@v3, 2026-09-28).
 */
export const KANA_READING_PATTERN = '^[\\u3040-\\u309Fー・〜…、。！？!?\\s]*$'
/**
 * lesson@v3(2026-09-28 Leader 결정) — LESSON 의 reading 계열 5개 필드 전용. 실측(sourceText 8회 중 4회 FAILED)에서
 * 1차 응답 6/8 이 외래어(コーヒー 등)를 가타카나로 적어(자연스러운 표기) `KANA_READING_PATTERN`(히라가나만)을 위반했다
 * — 학습자 앞 표기로는 가타카나 외래어가 오히려 맞는 표기라 "히라가나만"이 규칙 자체가 틀렸었다. 그래서 **히라가나+
 * 가타카나**(`぀-ヿ` 한 범위 — 이 안에 ー·・ 도 이미 포함) + 최소 문장부호만 허용, 한자·로마자·한글은 여전히
 * 금지한다. **`KANA_READING_PATTERN` 은 바꾸지 않았다** — A6/A7 평가(`evalSchemas.ts`, 다른 prompt-engineer 작업 중)
 * 가 같은 상수를 쓰고 있어(READING_INPUT 등) 여기서 값을 바꾸면 그쪽 계약이 조용히 달라진다. LESSON 만 별도 상수로
 * 분리했다 — eval 쪽도 가타카나를 허용해야 한다면 그건 task-011 담당·Leader 판단.
 */
/**
 * lesson@v4(2026-09-28, 운영 11b 후속 — prompt-engineer 진단) — v3 의 `぀-ヿ`(히라가나+가타카나)는
 * **일본어 괄호형 인용부호(「」『』, U+300C~U+300F)를 포함하지 않는다** — 그 문자들은 "CJK 기호·문장부호" 블록
 * (U+3000~U+303F)에 있어 히라가나·가타카나 블록과 별개다. 운영 스모크(`tests/live/task010-smoke.ts` 의 붙여넣기
 * 원문, 대화체 인용 `「ご注文はお決まりですか」` 포함)로 8회 재현한 결과 **5/8 이 이 이유로 실패**했다(원문
 * raw 확보·역파싱, `tests/live/lesson-paste-raw-capture.ts`) — 모델은 인용된 문장의 reading 에도 원문처럼
 * 「」를 그대로 남겼는데(문장부호를 보존하는 자연스러운 동작, 、。！？를 이미 허용하는 것과 같은 이유), 스키마가
 * 그 괄호만 빠뜨려 거부했다. **모델 행동은 맞았고 스키마가 좁았던 경우**라 프롬프트 지시문은 바꾸지 않는다(v3
 * 처럼 모델을 다른 방향으로 유도할 필요가 없다) — ajv `pattern` 만 넓힌다. 재측정(같은 원문 8회 + 주제 2회
 * 대조) 결과는 `agent-vault/30-Knowledge/decisions/llm-japanese-quality.md` §11·task-010 이력서 참고.
 */
export const LESSON_READING_PATTERN = '^[\\u3040-\\u30FF「」『』〜…、。！？!?\\s]*$'
/** `chunks[]` 개수 한도(`LESSON_SCHEMA` 와 `repair.ts`·`checks.ts` 가 공유 — 하드코딩 중복을 피한다, v2 신뢰도 보강). */
export const LESSON_CHUNKS_MIN = 4
export const LESSON_CHUNKS_MAX = 8

export interface LessonDialogueLine {
  speaker: 'A' | 'B'
  ja: string
  reading: string
  ko: string
}

/** 입력 `topic.chunks` 를 그대로 쓰면 그 `id`, 새로 만든 표현은 `"new-1"`, `"new-2"`… (`checks.ts` 가 검증). */
export interface LessonChunkOut {
  id: string
  textJa: string
  reading: string
  meaningKo: string
  chunkType: ChunkType
  isNew: boolean
}

export interface LessonGrammarPoint {
  id: string
  pattern: string
  explanationKo: string
  exampleJa: string
  exampleReading: string
  exampleKo: string
}

/** 4지선다만(코드 채점) — `promptKo`·`promptJa` 중 최소 하나는 non-null 이어야 한다(`checks.ts`). */
export interface LessonQuizItem {
  id: string
  promptKo: string | null
  promptJa: string | null
  choices: string[]
  answer: number
  targetIds: string[]
  explanationKo: string
}

export interface LessonApplicationItem {
  id: string
  promptKo: string
  hintJa: string | null
  modelAnswerJa: string
  modelReading: string
  modelKo: string
  targetIds: string[]
}

/** 상황(Scenario) 없는 자유 말하기 과제(task-010 L1 — 역할극은 task-010d). 채점은 서버가 표현 포함 여부만 느슨하게 본다. */
export interface LessonSpeakingItem {
  id: string
  promptKo: string
  targetIds: string[]
  modelAnswerJa: string
  modelReading: string
  modelKo: string
}

export interface LessonNextPreview {
  titleKo: string
  teaserKo: string
}

export interface LessonResponse {
  title: string
  titleKo: string
  rolesKo: { A: string; B: string }
  dialogue: LessonDialogueLine[]
  chunks: LessonChunkOut[]
  grammar: LessonGrammarPoint[]
  quiz: LessonQuizItem[]
  application: LessonApplicationItem[]
  speaking: LessonSpeakingItem[]
  nextPreview: LessonNextPreview
}

const lessonRolesKo = {
  type: 'object',
  additionalProperties: false,
  required: ['A', 'B'],
  properties: {
    A: { type: 'string', minLength: 1, maxLength: 12 },
    B: { type: 'string', minLength: 1, maxLength: 12 },
  },
} as const

const lessonDialogueLine = {
  type: 'object',
  additionalProperties: false,
  required: ['speaker', 'ja', 'reading', 'ko'],
  properties: {
    speaker: { type: 'string', enum: ['A', 'B'] },
    ja: { type: 'string', minLength: 1, maxLength: 80 },
    reading: { type: 'string', minLength: 1, maxLength: 160, pattern: LESSON_READING_PATTERN },
    ko: { type: 'string', minLength: 1, maxLength: 120 },
  },
} as const

const lessonChunkOut = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'textJa', 'reading', 'meaningKo', 'chunkType', 'isNew'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    textJa: { type: 'string', minLength: 1, maxLength: 40 },
    reading: { type: 'string', minLength: 1, maxLength: 80, pattern: LESSON_READING_PATTERN },
    meaningKo: { type: 'string', minLength: 1, maxLength: 80 },
    chunkType: { type: 'string', enum: [...CHUNK_TYPES] },
    isNew: { type: 'boolean' },
  },
} as const

const lessonGrammarPoint = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'pattern', 'explanationKo', 'exampleJa', 'exampleReading', 'exampleKo'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 10 },
    pattern: { type: 'string', minLength: 1, maxLength: 40 },
    explanationKo: { type: 'string', minLength: 1, maxLength: 200 },
    exampleJa: { type: 'string', minLength: 1, maxLength: 80 },
    exampleReading: { type: 'string', minLength: 1, maxLength: 160, pattern: LESSON_READING_PATTERN },
    exampleKo: { type: 'string', minLength: 1, maxLength: 120 },
  },
} as const

const lessonTargetIds = { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', minLength: 1, maxLength: 40 } } as const

const lessonQuizItem = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'promptKo', 'promptJa', 'choices', 'answer', 'targetIds', 'explanationKo'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 10 },
    promptKo: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 160 }] },
    promptJa: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 120 }] },
    choices: { type: 'array', minItems: 4, maxItems: 4, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 80 } },
    answer: { type: 'integer', minimum: 0, maximum: 3 },
    targetIds: lessonTargetIds,
    explanationKo: { type: 'string', minLength: 1, maxLength: 120 },
  },
} as const

const lessonApplicationItem = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'promptKo', 'hintJa', 'modelAnswerJa', 'modelReading', 'modelKo', 'targetIds'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 10 },
    promptKo: { type: 'string', minLength: 1, maxLength: 200 },
    hintJa: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 80 }] },
    modelAnswerJa: { type: 'string', minLength: 1, maxLength: 120 },
    modelReading: { type: 'string', minLength: 1, maxLength: 240, pattern: LESSON_READING_PATTERN },
    modelKo: { type: 'string', minLength: 1, maxLength: 160 },
    targetIds: lessonTargetIds,
  },
} as const

const lessonSpeakingItem = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'promptKo', 'targetIds', 'modelAnswerJa', 'modelReading', 'modelKo'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 10 },
    promptKo: { type: 'string', minLength: 1, maxLength: 200 },
    targetIds: lessonTargetIds,
    modelAnswerJa: { type: 'string', minLength: 1, maxLength: 120 },
    modelReading: { type: 'string', minLength: 1, maxLength: 240, pattern: LESSON_READING_PATTERN },
    modelKo: { type: 'string', minLength: 1, maxLength: 160 },
  },
} as const

const lessonNextPreview = {
  type: 'object',
  additionalProperties: false,
  required: ['titleKo', 'teaserKo'],
  properties: {
    titleKo: { type: 'string', minLength: 1, maxLength: 40 },
    teaserKo: { type: 'string', minLength: 1, maxLength: 60 },
  },
} as const

export const LESSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'titleKo', 'rolesKo', 'dialogue', 'chunks', 'grammar', 'quiz', 'application', 'speaking', 'nextPreview'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 40 },
    titleKo: { type: 'string', minLength: 1, maxLength: 40 },
    rolesKo: lessonRolesKo,
    dialogue: { type: 'array', minItems: 6, maxItems: 10, items: lessonDialogueLine },
    chunks: { type: 'array', minItems: LESSON_CHUNKS_MIN, maxItems: LESSON_CHUNKS_MAX, items: lessonChunkOut },
    grammar: { type: 'array', minItems: 1, maxItems: 3, items: lessonGrammarPoint },
    quiz: { type: 'array', minItems: 5, maxItems: 5, items: lessonQuizItem },
    application: { type: 'array', minItems: 3, maxItems: 3, items: lessonApplicationItem },
    speaking: { type: 'array', minItems: 3, maxItems: 3, items: lessonSpeakingItem },
    nextPreview: lessonNextPreview,
  },
} as const
