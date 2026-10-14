/**
 * A10 단어 보강(WORD_ENRICH) — design-spec §8 A10, api-contract #41("enrich=true 면 draft 만 반환하고 저장하지
 * 않는다"). 대화 턴이 아니라 사전 조회 1회라 **페르소나(tutor.md)를 쓰지 않는다** — 절 필터를 최소로 줘도
 * "저는 선생님입니다" 류 정체성·말투 문장이 JSON 바깥으로 새거나 톤에 섞일 위험만 있고 얻는 게 없다(지연도
 * 페르소나 유무와 무관함을 A1 실측(`decisions/llm-japanese-quality.md`)에서 이미 확인). 대신 아주 짧은 자체
 * 시스템 프롬프트(`persona` 필드)를 넣어 Claude Code 기본 코딩 에이전트 시스템 프롬프트가 섞이지 않게 한다
 * (`--system-prompt` 가 실리는 조건은 `req.persona` 존재 여부 — engine/llm/index.ts `callOnce` 참고).
 *
 * 실행은 라우트가 아니라 `learning/vocab/enrich`(developer A) 가 맡는다. 이 모듈은 **요청만 만든다**
 * (module-dependency §4-4 — L3 는 L2 를 import 할 수 없으므로, 라우트가 `buildWordEnrichRequest` 로 요청을
 * 만들어 `learning.vocab.enrich` 에 값으로 넘긴다. `learning` 쪽에서 `WordEnrichResponse` 타입을 그대로
 * import 하면 L3→L2 역방향 import 가 되므로, 그쪽은 구조적으로 같은 필드를 갖는 자체 타입을 두는 편을 권한다).
 */
import type { LlmJsonRequest, LlmPersona } from '@/modules/engine'
import { checkWordEnrich } from '../structuredResponse/checks'
import { WORD_ENRICH_SCHEMA as WORD_ENRICH_BASE_SCHEMA, type WordEnrichResponse as WordEnrichBaseResponse } from '../structuredResponse/schemas'
import { INJECTION_GUARD } from './header'

/**
 * `wordEnrich@v2`(task-068 D5, 2026-10-14) — v1 대비 **출력에 `chunkType`(조각 유형) 칸 추가**, 그 밖의 지시·스키마·후검증은 v1 그대로.
 * 단어장 직접 입력 폼이 「수준」 대신 「조각」을 꼭 고르게 되면서(D5) 선생님 초안(뜻 채우기)이 조각도 미리 골라 준다.
 * 롤백: 버전 상수를 'wordEnrich@v1' 로 되돌리고 아래 `chunkType` 지시 줄 1개·스키마 칸·후검증 1줄을 걷어 낸다(호출부는 칸이 없어도 `null` 로 읽는다 — 계약 참고).
 */
export const WORD_ENRICH_PROMPT_VERSION = 'wordEnrich@v2'

/**
 * 단어장 **전용** 5유형(task-068 D4 ★ B). 교정·수업·평가·주제 프롬프트의 `CHUNK_TYPES`(schemas.ts) 는 **4유형 그대로**다(J12) —
 * 새 값 `EXPRESSION` 은 이 모듈 밖으로 새면 안 된다(시험 `wordEnrichChunk.test.ts` 가 모든 프롬프트 스키마의 조각 enum 을 스캔한다).
 * 앞 4개는 `CHUNK_TYPES` 와 같은 순서·이름이다(DB `ChunkType` enum 과 1:1 — `EXPRESSION` 은 S-A 가 스키마에 더한다).
 */
export const WORD_CHUNK_TYPES = ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] as const
export type WordChunkType = (typeof WORD_CHUNK_TYPES)[number]

/** v1 응답 + `chunkType`. valid=true 면 항상 5개 중 하나(후검증), valid=false 면 null. */
export interface WordEnrichResponseV2 extends WordEnrichBaseResponse {
  chunkType: WordChunkType | null
}

const B = WORD_ENRICH_BASE_SCHEMA.properties
/**
 * v2 출력 스키마(`--json-schema` + ajv 공용). v1 칸은 그대로 두고 `partOfSpeech` 다음에 `chunkType` 을 **필수 키**로 더한다.
 * 값은 null 또는 5유형 enum — "valid=true 면 null 금지"는 스키마로 못 쓰니 `checkWordEnrichV2` 가 맡는다(다른 사전 칸과 같은 방식).
 */
export const WORD_ENRICH_OUTPUT_SCHEMA = {
  ...WORD_ENRICH_BASE_SCHEMA,
  required: ['valid', 'invalidReason', 'reading', 'meaning', 'partOfSpeech', 'chunkType', 'jlpt', 'example', 'exampleKo'],
  properties: {
    valid: B.valid,
    invalidReason: B.invalidReason,
    reading: B.reading,
    meaning: B.meaning,
    partOfSpeech: B.partOfSpeech,
    chunkType: { anyOf: [{ type: 'null' }, { type: 'string', enum: [...WORD_CHUNK_TYPES] }] },
    jlpt: B.jlpt,
    example: B.example,
    exampleKo: B.exampleKo,
  },
} as const

/** v1 후검증 + `chunkType`: valid=true 인데 비어 있으면 위반(재시도 1회). valid=false 의 chunkType 은 보지 않는다(다른 칸과 같음 — `toDraft` 가 비운다). */
export function checkWordEnrichV2(surface: string, data: WordEnrichResponseV2): string[] {
  const v = checkWordEnrich(surface, data)
  if (data.valid && !data.chunkType) v.push('valid=true 이면 chunkType 이 있어야 한다(NAME·ACTION·FEELING·MODIFIER·EXPRESSION 중 하나)')
  return v
}

/** surface 표기 그대로 보존해야 하는 안내를 반복하지 않도록 짧게 고정. tutor.md 를 읽지 않는다(지연·주제 이탈 방지). */
const WORD_ENRICH_PERSONA: LlmPersona = {
  name: 'word-enrich',
  description: '일본어 단어장 사전 보강 — 대화하지 않고 요청받은 JSON 하나만 돌려준다',
  prompt: '당신은 일본어 학습 앱의 사전 보강 도구다. 학습자와 대화하지 않는다. 주어진 표현 하나를 사전처럼 짧게 채우고, 결과는 오직 요청받은 JSON 객체 하나다.',
}

export interface WordEnrichInput {
  /** 학습자가 단어장에 추가하려는 표현(단어·관용구). 앞뒤 공백만 걷어 낸다 — 그 밖의 검증(길이 1~80 등)은 route/DB 몫. */
  surface: string
  /** 학습자 JLPT 수준(N5~N1). 있으면 뜻·예문 난이도를 맞추는 데만 쓰고, 판정(valid) 기준을 바꾸지 않는다. */
  level?: string | null
}

export class WordEnrichInputError extends Error {
  readonly userMessage = '보강할 표현을 입력해 주세요.'
}

export function buildWordEnrichRequest(input: WordEnrichInput): LlmJsonRequest<WordEnrichResponseV2> {
  const surface = input.surface.trim()
  if (!surface) throw new WordEnrichInputError('surface 가 비어 있습니다')
  const level = input.level?.trim() || null
  const system = [
    '[모드] WORD_ENRICH',
    '[지시] 아래 [단어]는 학습자가 단어장에 추가하려는 일본어 표현 후보입니다. 국어사전 항목처럼 짧게 채우세요.',
    '- 가장 먼저 이 표현이 실제 일본어 단어·관용 표현인지 판단합니다. 한국어·영어·오타·의미 없는 문자열이면 valid=false 로 하고 invalidReason 에 한국어로 이유를 한 문장 적습니다. 그 경우 reading·meaning·partOfSpeech·chunkType·jlpt·example·exampleKo 는 전부 null 로 둡니다.',
    '- valid=true 면 reading·meaning·partOfSpeech·chunkType·example·exampleKo 를 모두 채웁니다(null 금지). jlpt 는 확신이 있을 때만 채우고, 모르면 지어내지 말고 null 로 둡니다.',
    '- reading: 히라가나만 사용합니다(장음은 「ー」). 가타카나·한자·로마자·공백·중점(・)을 쓰지 않습니다 — 가타카나 외래어([단어]가 コーヒー 같은 경우)도 읽는 대로 히라가나로 적습니다.',
    '- meaning: 한국어 뜻만 짧게(설명문·예문 없이). 뜻이 여럿이면 가장 흔한 순서로 1~3개를 ", " 로 이어 씁니다.',
    '- partOfSpeech: 명사=NOUN, 동사=VERB, い형용사=ADJ_I, な형용사=ADJ_NA(어간만 주어져도 이 값), 부사=ADVERB, 조사=PARTICLE, 인사말·관용구 등 문장 단위 표현=EXPRESSION, 그 외=OTHER.',
    '- chunkType: 문장을 만드는 조각 유형 하나 — 품사 이름이 아니라 쓰임으로 고릅니다. NAME(이름)=명사·대명사·명사구, 사람·물건·장소의 이름 / ACTION(액션)=동사구, 동작을 나타내는 말 — 勉強・準備・挨拶처럼 「する」가 붙는 동작성 명사도 ACTION / FEELING(느낌)=형용사·감정·상태·평가 / MODIFIER(꾸밈)=부사·수식·조사구·시간·장소·접사·조사류 / EXPRESSION(표현)=문장 밖에서 통째로 쓰는 말 — 인사·대답·감탄·이음말(예: おはよう・そうですか・それでは).',
    '- example: [단어]의 글자 표기(한자·가나)를 예문에서도 그대로 유지합니다 — 다른 한자나 다른 가나로 절대 바꾸지 않습니다(가타카나 외래어를 히라가나로 바꾸는 것도 금지). 동사·い형용사는 자연스러운 문장을 위해 활용형(과거·정중형·て형 등)으로 바꿔 써도 됩니다 — 예를 들어 [단어]가 「かける」라면 예문에 「かける」 그대로 써도 되고 「かけます」・「かけました」・「かけて」처럼 활용해도 됩니다(앞부분 「かけ」만 유지되면 됩니다). 그 밖의 품사(명사·조사·부사·표현 등)는 활용이 없으니 [단어]를 형태 그대로 포함하는 예문을 씁니다. 짧은 예문 1개(한 문장)만 씁니다. exampleKo 는 그 예문의 자연스러운 한국어 번역.',
    level ? `- 학습자 수준은 ${level} 입니다. meaning·example 의 난이도를 그 수준에 맞추되, valid 판정 기준은 바꾸지 않습니다.` : null,
    INJECTION_GUARD,
  ]
    .filter((x): x is string => Boolean(x))
    .join('\n')
  return {
    task: 'wordEnrich',
    persona: WORD_ENRICH_PERSONA,
    system,
    messages: [{ role: 'user', content: `[단어] ${surface}` }],
    jsonSchema: WORD_ENRICH_OUTPUT_SCHEMA,
    extraCheck: (data) => checkWordEnrichV2(surface, data),
  }
}
