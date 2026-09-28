/**
 * A6 평가 출제(EVAL_GEN)·A7 평가 채점(EVAL_GRADE) — design-spec §7-5·§8 A6/A7, api-contract §2-14(#65~#69),
 * task-011 Leader's Plan L2·L3. `schemas.ts`(TALK 등 기존 6개 지점)와 분리한 이유는 task 지시(다른 PE 가 동시에
 * 복습 판단(A11) 프롬프트로 `schemas.ts`/`checks.ts` 를 만지는 중이라 충돌을 피한다) — export 만 `index.ts` 에 더한다.
 *
 * **문항 종류 8개의 `prompt`/`expected` 모양**(developer·designer 가 그대로 쓰는 계약, 아래 JSON 스키마가 강제):
 *
 * | kind | prompt | expected | 비고 |
 * |---|---|---|---|
 * | MEANING_CHOICE | `{surface, reading, choices[4]}` | `{answer 0~3}` | 코드 채점. choices 는 한국어 뜻 4개(정답 1개, 중복 금지) |
 * | READING_INPUT | `{surface}` | `{reading, accepted[1~5]}` | 코드 채점(정규화 비교). `accepted` 는 `reading` 자신을 포함해야 함. `reading`/`accepted` 는 **항상 히라가나만**(가타카나 외래어(surface=サイズ 등)도 읽는 대로 히라가나(さいず) — `EVAL_SENTENCE_READING_PATTERN` 주석의 판단 근거 참고, A10 과 같은 규칙) |
 * | USAGE_CHOICE | `{sentenceJa, choices[4]}` | `{answer 0~3}` | `sentenceJa` 는 빈칸을 `___` 로 표시. 코드 채점 |
 * | CHUNK_CLASSIFY | `{textJa, reading\|null}` | `{chunkType}`(top-level `chunkType` 과 같은 값) | 정답은 top-level `chunkType`(NAME·ACTION·FEELING·MODIFIER) 이 권위값 — `expected.chunkType` 은 [[llm-japanese-quality]] §9(2026-09-28 A6 실측)에서 빈 객체 `{}` 요구가 WORDS 2회 중 2회 모두 1차 응답 누락을 유발해 자연스러운 값으로 바꾼 것. 둘이 어긋나면 `repairEvalGenChunkTypeSync` 가 top-level 을 expected 기준으로 맞춘다. 코드 채점 |
 * | LISTEN_RESPOND | `{textJa, instructionKo}` | `{expectedGistKo, modelAnswerJa, modelReading}` | `textJa` 는 TTS 로만 들려주고 학습자에게 숨김(서버가 `audioUrl`·`textHidden:true` 로 치환). `modelReading` 은 **히라가나+가타카나**(`EVAL_SENTENCE_READING_PATTERN`, evalGen@v3). A7 서술형 |
 * | ASSEMBLE | `{promptKo, pieces[3~7]}` | `{order[3~7]}` | `order` 는 `pieces` 와 같은 조각을 올바른 순서로. 코드 채점(전부 일치해야 정답) |
 * | SITUATION_RESPOND | `{situationKo}` | `{expectedGistKo, modelAnswerJa, modelReading}` | `modelReading` 은 **히라가나+가타카나**(`EVAL_SENTENCE_READING_PATTERN`, evalGen@v3). A7 서술형 |
 * | CORRECTION_SPOT | `{sentenceJa}` | `{wrongSpan, correctedJa, explanationKo}` | `wrongSpan` 은 `sentenceJa` 안의 리터럴 부분 문자열이어야 함. A7 서술형 |
 *
 * `wordSurface`(재료 단어장 링크, 없으면 null)·`chunkType`(CHUNK_CLASSIFY 정답, 그 밖은 null)·`dims`(이 문항이 주로
 * 재는 루브릭 차원 1~3개, `EVAL_DIMS`)는 8종 공통 top-level 필드다(Prisma `EvaluationItem.wordSurfaceSnap`·`chunkType`
 * 컬럼과 그대로 대응).
 *
 * ajv 는 draft-07 서브셋(`engine/json/schemaValidate.ts` 상단 주석)이라 `minContains`(2019-09) 를 쓸 수 없다 — 그래서
 * "문항 kind 별 정확한 개수"(WORDS 4·2·2·2, TALK 2·1·2·1)는 스키마가 아니라 `evalChecks.ts` 의 `checkEvalGenResponse` 가
 * 센다. 스키마는 **문항 1개의 모양**(`if`/`then`, kind 로 분기)과 **배열 길이**(WORDS 10·TALK 6)만 강제한다.
 */
import { CHUNK_TYPES, KANA_READING_PATTERN, type ChunkType } from './schemas'

/**
 * evalGen@v3(2026-09-28, Leader 지시 — task-011 developer 스모크: TALK 출제 4회 중 3회 재시도·1회 FAILED). 원인은
 * `LISTEN_RESPOND`·`SITUATION_RESPOND` 의 `expected.modelReading`(모범 답 **문장 전체**의 읽기)이 `KANA_READING_PATTERN`
 * (히라가나만)이라, 모범 답에 외래어(コーヒー 등)가 있으면 학습자 앞 자연스러운 표기(가타카나)를 그대로 써서 위반이
 * 났다 — task-010 이 `lesson@v3` 에서 `LESSON_READING_PATTERN`(히라가나+가타카나)을 신설해 같은 문제를 고친 것과
 * **원인·해법이 완전히 동일**하다.
 *
 * `KANA_READING_PATTERN`(schemas.ts, 히라가나만) 은 **바꾸지 않는다** — 다른 prompt-engineer 가 A11/talk@v3 로 그
 * 상수를 같이 쓰고 있어 값을 바꾸면 그쪽 계약이 조용히 달라진다(같은 이유로 LESSON 도 별도 상수를 만들었다). 이 상수는
 * evalSchemas.ts 전용이고 **문장 전체 읽기 필드에만** 쓴다.
 *
 * **`READING_INPUT.expected.reading`/`accepted`(단어 하나의 읽기 문항)는 이 상수를 쓰지 않고 그대로
 * `KANA_READING_PATTERN`(히라가나만)을 유지한다** — 판단 근거: ① A10(`WORD_ENRICH_READING_RE`, `checks.ts`
 * `checkWordEnrich`)이 이미 "가타카나 외래어도 읽는 대로 히라가나로 적는다"를 검증된 규칙으로 강제하고 있다(실측·회귀
 * 테스트로 확인됨, `word-enrich.ts` 프롬프트 문구 그대로 재사용). ② READING_INPUT 은 "이 단어를 어떻게 읽는가"를
 * 묻는 **읽기 능력 평가 문항**이다 — 표기가 가타카나(サイズ)여도 정답은 관례상 언제나 히라가나(さいず)이고, 정답으로
 * 가타카나 원표기를 그대로 받아들이면 애초에 "읽기를 물은" 목적 자체가 사라진다(LESSON 의 `modelReading`/`chunks.reading`
 * 은 TTS·후리가나 **표시용 참고 정보**라 목적이 다르다 — 정답 여부를 채점하지 않는다). ③ 관찰된 실패도 modelReading
 * 에서만 났다(READING_INPUT 에서 위반이 난 적은 없다) — 문제가 없는 곳을 넓히면 오히려 "정답이 가타카나 그대로여도
 * 됨"을 학습자에게 잘못 보여줄 위험만 커진다. 대신 `prompts/evalGen.ts` 의 지시문에 A10 과 같은 문구("가타카나
 * 외래어도 히라가나로")를 명시해 위반 자체를 줄인다.
 *
 * 「」『』(U+300C~U+300F)도 허용한다(REV-032 M2, 2026-09-29 예방) — `LESSON_READING_PATTERN`(lesson@v4)과 같은 근거:
 * 가나 블록 밖(CJK 기호 블록)이라 빠져 있었고, 대화체 인용이 든 문장의 읽기에 모델이 원문처럼 괄호를 남기면 정상
 * 출력이 거부된다. 지시문은 바꾸지 않는다(검증만 넓힘). `KANA_READING_PATTERN` 은 그대로다.
 */
export const EVAL_SENTENCE_READING_PATTERN = '^[\\u3040-\\u30FF「」『』〜…、。！？!?\\s]*$'

export const EVAL_ITEM_KINDS = [
  'MEANING_CHOICE',
  'READING_INPUT',
  'USAGE_CHOICE',
  'CHUNK_CLASSIFY',
  'LISTEN_RESPOND',
  'ASSEMBLE',
  'SITUATION_RESPOND',
  'CORRECTION_SPOT',
] as const
export type EvalItemKind = (typeof EVAL_ITEM_KINDS)[number]

/** 코드 채점(#67) — 학습자가 답을 내면 즉시 점수를 계산할 수 있는 종류. */
export const EVAL_OBJECTIVE_KINDS: ReadonlySet<EvalItemKind> = new Set(['MEANING_CHOICE', 'READING_INPUT', 'USAGE_CHOICE', 'CHUNK_CLASSIFY', 'ASSEMBLE'])
/** A7 서술형 채점 대상. */
export const EVAL_SUBJECTIVE_KINDS: ReadonlySet<EvalItemKind> = new Set(['LISTEN_RESPOND', 'SITUATION_RESPOND', 'CORRECTION_SPOT'])

export const EVAL_DIMS = ['accuracy', 'vocabulary', 'grammar', 'naturalness', 'assembly'] as const
export type EvalDim = (typeof EVAL_DIMS)[number]

export const EVAL_KINDS = ['WORDS', 'TALK'] as const
export type EvalKind = (typeof EVAL_KINDS)[number]

/** design-spec §7-5·api-contract #65 — kind 별 문항 종류 분배(개수). 순서 = 프롬프트에 실을 표시 순서. */
export const EVAL_GEN_ITEM_COUNTS: Record<EvalKind, Partial<Record<EvalItemKind, number>>> = {
  WORDS: { MEANING_CHOICE: 4, READING_INPUT: 2, USAGE_CHOICE: 2, CHUNK_CLASSIFY: 2 },
  TALK: { LISTEN_RESPOND: 2, ASSEMBLE: 1, SITUATION_RESPOND: 2, CORRECTION_SPOT: 1 },
}
export const EVAL_GEN_TOTAL_ITEMS: Record<EvalKind, number> = { WORDS: 10, TALK: 6 }

// ── 문항별 TS 타입(EVAL_GEN 출력) ──────────────────────────────────────────

interface EvalGenItemBase {
  /** 이 문항이 주로 재는 루브릭 차원 1~3개(`EVAL_DIMS`) — A8·결과 화면 참고용, 채점에 강제하지 않는다. */
  dims: EvalDim[]
  /** [재료] 단어장에서 골랐으면 그 표기 그대로, 강사가 새로 만들었으면 null. */
  wordSurface: string | null
  /** CHUNK_CLASSIFY 의 정답 조각 유형(그 밖의 kind 는 항상 null). */
  chunkType: ChunkType | null
}

export interface EvalMeaningChoiceItem extends EvalGenItemBase {
  kind: 'MEANING_CHOICE'
  prompt: { surface: string; reading: string; choices: string[] }
  expected: { answer: number }
}
export interface EvalReadingInputItem extends EvalGenItemBase {
  kind: 'READING_INPUT'
  prompt: { surface: string }
  expected: { reading: string; accepted: string[] }
}
export interface EvalUsageChoiceItem extends EvalGenItemBase {
  kind: 'USAGE_CHOICE'
  prompt: { sentenceJa: string; choices: string[] }
  expected: { answer: number }
}
export interface EvalChunkClassifyItem extends EvalGenItemBase {
  kind: 'CHUNK_CLASSIFY'
  prompt: { textJa: string; reading: string | null }
  expected: { chunkType: ChunkType }
}
export interface EvalListenRespondItem extends EvalGenItemBase {
  kind: 'LISTEN_RESPOND'
  prompt: { textJa: string; instructionKo: string }
  expected: { expectedGistKo: string; modelAnswerJa: string; modelReading: string }
}
export interface EvalAssembleItem extends EvalGenItemBase {
  kind: 'ASSEMBLE'
  prompt: { promptKo: string; pieces: string[] }
  expected: { order: string[] }
}
export interface EvalSituationRespondItem extends EvalGenItemBase {
  kind: 'SITUATION_RESPOND'
  prompt: { situationKo: string }
  expected: { expectedGistKo: string; modelAnswerJa: string; modelReading: string }
}
export interface EvalCorrectionSpotItem extends EvalGenItemBase {
  kind: 'CORRECTION_SPOT'
  prompt: { sentenceJa: string }
  expected: { wrongSpan: string; correctedJa: string; explanationKo: string }
}

export type EvalGenItem =
  | EvalMeaningChoiceItem
  | EvalReadingInputItem
  | EvalUsageChoiceItem
  | EvalChunkClassifyItem
  | EvalListenRespondItem
  | EvalAssembleItem
  | EvalSituationRespondItem
  | EvalCorrectionSpotItem

export interface EvalGenResponse {
  items: EvalGenItem[]
}

// ── EVAL_GEN JSON 스키마 ────────────────────────────────────────────────────

const dimsSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 3,
  uniqueItems: true,
  items: { type: 'string', enum: [...EVAL_DIMS] },
} as const

const choices4Schema = {
  type: 'array',
  minItems: 4,
  maxItems: 4,
  uniqueItems: true,
  items: { type: 'string', minLength: 1, maxLength: 80 },
} as const

const answerIndexSchema = { type: 'integer', minimum: 0, maximum: 3 } as const

function kana(maxLength: number, nullable = false) {
  const base = { type: 'string', minLength: 1, maxLength, pattern: KANA_READING_PATTERN }
  return nullable ? { anyOf: [{ type: 'null' }, base] } : base
}

/** 문장 전체 읽기(모범 답 등) 전용 — 히라가나+가타카나 허용(`EVAL_SENTENCE_READING_PATTERN` 옆 주석 참고). */
function sentenceKana(maxLength: number) {
  return { type: 'string', minLength: 1, maxLength, pattern: EVAL_SENTENCE_READING_PATTERN }
}

/** kind 하나의 `if(kind===const)/then(prompt·expected·chunkType 모양)` 블록. */
function branch(kind: EvalItemKind, prompt: object, expected: object, chunkTypeSchema: object = { type: 'null' }) {
  return {
    if: { required: ['kind'], properties: { kind: { const: kind } } },
    then: { properties: { prompt, expected, chunkType: chunkTypeSchema } },
  }
}

function evalGenItemSchema(): object {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'dims', 'wordSurface', 'chunkType', 'prompt', 'expected'],
    properties: {
      kind: { type: 'string', enum: [...EVAL_ITEM_KINDS] },
      dims: dimsSchema,
      wordSurface: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 80 }] },
      chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...CHUNK_TYPES] }] },
      prompt: { type: 'object' },
      expected: { type: 'object' },
    },
    allOf: [
      branch(
        'MEANING_CHOICE',
        { type: 'object', additionalProperties: false, required: ['surface', 'reading', 'choices'], properties: { surface: { type: 'string', minLength: 1, maxLength: 40 }, reading: kana(80), choices: choices4Schema } },
        { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: answerIndexSchema } },
      ),
      branch(
        'READING_INPUT',
        { type: 'object', additionalProperties: false, required: ['surface'], properties: { surface: { type: 'string', minLength: 1, maxLength: 40 } } },
        { type: 'object', additionalProperties: false, required: ['reading', 'accepted'], properties: { reading: kana(80), accepted: { type: 'array', minItems: 1, maxItems: 5, items: kana(80) } } },
      ),
      branch(
        'USAGE_CHOICE',
        { type: 'object', additionalProperties: false, required: ['sentenceJa', 'choices'], properties: { sentenceJa: { type: 'string', minLength: 1, maxLength: 120 }, choices: choices4Schema } },
        { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: answerIndexSchema } },
      ),
      branch(
        'CHUNK_CLASSIFY',
        { type: 'object', additionalProperties: false, required: ['textJa', 'reading'], properties: { textJa: { type: 'string', minLength: 1, maxLength: 40 }, reading: kana(80, true) } },
        { type: 'object', additionalProperties: false, required: ['chunkType'], properties: { chunkType: { type: 'string', enum: [...CHUNK_TYPES] } } },
        { type: 'string', enum: [...CHUNK_TYPES] },
      ),
      branch(
        'LISTEN_RESPOND',
        { type: 'object', additionalProperties: false, required: ['textJa', 'instructionKo'], properties: { textJa: { type: 'string', minLength: 1, maxLength: 80 }, instructionKo: { type: 'string', minLength: 1, maxLength: 120 } } },
        {
          type: 'object',
          additionalProperties: false,
          required: ['expectedGistKo', 'modelAnswerJa', 'modelReading'],
          properties: { expectedGistKo: { type: 'string', minLength: 1, maxLength: 200 }, modelAnswerJa: { type: 'string', minLength: 1, maxLength: 80 }, modelReading: sentenceKana(160) },
        },
      ),
      branch(
        'ASSEMBLE',
        { type: 'object', additionalProperties: false, required: ['promptKo', 'pieces'], properties: { promptKo: { type: 'string', minLength: 1, maxLength: 120 }, pieces: { type: 'array', minItems: 3, maxItems: 7, items: { type: 'string', minLength: 1, maxLength: 20 } } } },
        { type: 'object', additionalProperties: false, required: ['order'], properties: { order: { type: 'array', minItems: 3, maxItems: 7, items: { type: 'string', minLength: 1, maxLength: 20 } } } },
      ),
      branch(
        'SITUATION_RESPOND',
        { type: 'object', additionalProperties: false, required: ['situationKo'], properties: { situationKo: { type: 'string', minLength: 1, maxLength: 200 } } },
        {
          type: 'object',
          additionalProperties: false,
          required: ['expectedGistKo', 'modelAnswerJa', 'modelReading'],
          properties: { expectedGistKo: { type: 'string', minLength: 1, maxLength: 200 }, modelAnswerJa: { type: 'string', minLength: 1, maxLength: 80 }, modelReading: sentenceKana(160) },
        },
      ),
      branch(
        'CORRECTION_SPOT',
        { type: 'object', additionalProperties: false, required: ['sentenceJa'], properties: { sentenceJa: { type: 'string', minLength: 1, maxLength: 120 } } },
        {
          type: 'object',
          additionalProperties: false,
          required: ['wrongSpan', 'correctedJa', 'explanationKo'],
          properties: { wrongSpan: { type: 'string', minLength: 1, maxLength: 40 }, correctedJa: { type: 'string', minLength: 1, maxLength: 120 }, explanationKo: { type: 'string', minLength: 1, maxLength: 160 } },
        },
      ),
    ],
  }
}

/** WORDS(10)·TALK(6) — 배열 길이만 여기서 강제하고 kind 분배는 `checkEvalGenResponse` 가 센다(위 파일 주석). */
export function buildEvalGenSchema(kind: EvalKind): object {
  const n = EVAL_GEN_TOTAL_ITEMS[kind]
  return {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: { items: { type: 'array', minItems: n, maxItems: n, items: evalGenItemSchema() } },
  }
}

// ── EVAL_GRADE(A7) ──────────────────────────────────────────────────────────

export interface EvalGradeItemOut {
  order: number
  score: number
  feedback_ko: string
}

export type EvalRubric = Record<EvalDim, number>

export interface EvalGradeResponse {
  items: EvalGradeItemOut[]
  rubric: EvalRubric
  comment_ko: string
  next_focus: string[]
}

/**
 * `maxOrder` = 이번 평가에서 채점 대상인 서술형 문항의 가장 큰 `order`(0-based). `items` 는 **정확한 개수를 강제하지
 * 않는다**(`minItems:0`) — 모델이 일부를 빼먹는 것은 스키마 위반이 아니라 `evalChecks.finalizeEvalGradeItems` 가
 * 0점으로 채우는 정상 경로다(task-011 Leader's Plan L3 "누락 문항 0점"). `order` 가 입력에 없는 값을 가리키는 것과
 * 중복은 `checkEvalGradeResponse` 가 잡는다(재시도).
 */
export function buildEvalGradeSchema(maxOrder: number, itemCount: number): object {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'rubric', 'comment_ko', 'next_focus'],
    properties: {
      items: {
        type: 'array',
        minItems: 0,
        maxItems: Math.max(itemCount, 1),
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['order', 'score', 'feedback_ko'],
          properties: {
            order: { type: 'integer', minimum: 0, maximum: Math.max(maxOrder, 0) },
            score: { type: 'integer', minimum: 0, maximum: 10 },
            feedback_ko: { type: 'string', minLength: 1, maxLength: 300 },
          },
        },
      },
      rubric: {
        type: 'object',
        additionalProperties: false,
        required: [...EVAL_DIMS],
        properties: Object.fromEntries(EVAL_DIMS.map((d) => [d, { type: 'integer', minimum: 0, maximum: 5 }])),
      },
      comment_ko: { type: 'string', minLength: 1, maxLength: 400 },
      next_focus: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 80 } },
    },
  }
}
