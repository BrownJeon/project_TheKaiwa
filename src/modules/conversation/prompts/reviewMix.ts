/**
 * A5 복습 혼합(REVIEW_MIX) — design-spec §7-4·§8 A5, learning-personalization §2-5 "복습 세션 형식", tutor.md §7
 * "복습 세션은 주어진 재료만으로 만들고 새 표현은 넣지 않습니다", task-010b Leader's Plan L6.
 *
 * **A4 의 스키마·후검증·보정을 그대로 재사용한다**(`LESSON_SCHEMA`·`checkLessonResponse`·`repairLessonResponse`,
 * `structuredResponse/schemas.ts`·`checks.ts`·`repair.ts` 무변경 — 다른 prompt-engineer 가 같은 시각 평가 프롬프트로
 * 그 파일들을 건드리고 있어 충돌을 피한다, task-010b 지시). mixSpec(오늘의 복습으로 추출된 `RepetitionItem` 스냅샷)을
 * `LessonTopicChunkInput` 과 같은 모양(`ReviewMixItemInput`)으로 렌더링하면 "출력 chunks ⊆ 입력 풀"이라는 A4 의
 * 기존 규칙이 그대로 "chunks ⊆ mixSpec"이 된다 — [[llm-japanese-quality]] §8 의 "재사용" 조언 그대로다.
 *
 * **범위 해석(설계 판단)**: `RepetitionItem` 은 itemType(EXPRESSION·CHUNK·GRAMMAR·SCENARIO·WORD·LESSON)이 무엇이든
 * `textJa`/`meaningKo` 스냅샷만 갖는다 — `LessonGrammarPoint`(pattern·explanationKo·예문 3종)가 요구하는 데이터가
 * 원천적으로 없다. 그래서 mixSpec 항목은 전부 `chunks[]` 자리로만 들어가고(id 보존, "표현·문형·단어·조각"을 조각
 * 프레임(NAME/ACTION/FEELING/MODIFIER)으로 다시 분류하는 것은 A4 와 동일하게 LLM 몫), `grammar[]`(1~3개)는 A4 처럼
 * 자유 id("g1"…)로 그 재료를 바탕으로 한 문형 설명을 새로 쓴다 — "새 표현을 넣지 않는다"는 **어휘/조각(chunks)**
 * 에 적용되고, grammar 는 애초에 재사용할 기존 엔티티가 없는 메타 설명이라 A4 와 다르게 취급할 이유가 없다. 이 해석에
 * 동의하지 않으면(예: 강사 판단 GRAMMAR 항목을 grammar[] 에 id 보존해 그대로 실어야 한다) Leader·developer 판단으로
 * `structuredResponse` 에 A5 전용 검사를 추가해야 한다 — 이번 범위에서는 하지 않았다(회귀 픽스처·실측으로 커버된
 * A4 코드를 무변경으로 재사용하는 쪽이 신뢰도가 높다고 판단했다).
 */
import type { LlmJsonRequest } from '@/modules/engine'
import { loadPersona } from '../persona/loader'
import { checkLessonResponse } from '../structuredResponse/checks'
import { repairLessonResponse, type LessonRepairSourceChunk } from '../structuredResponse/repair'
import { LESSON_SCHEMA, type ChunkType, type LessonResponse } from '../structuredResponse/schemas'
import { INJECTION_GUARD, renderHeader, renderToday, type LearnerHeader } from './header'

export const REVIEW_MIX_PROMPT_VERSION = 'reviewMix@v1'
export const REVIEW_MIX_HEADER_CAP = 600
/** `LESSON_MAX_TOPIC_CHUNKS`(lesson.ts)와 같은 값 — 세션 크기(다음 §7-4, 15분→6~8건)는 보통 훨씬 작지만 방어적으로 같은 상한을 둔다. */
export const REVIEW_MIX_MAX_ITEMS = 20
const RENDER_MAX = { textJa: 40, reading: 60, meaningKo: 60 } as const

export interface ReviewMixItemInput {
  /** `RepetitionItem.id` — 응답 `chunks[].id` 에 그대로 보존돼야 한다. */
  id: string
  /** 개발자가 원 `RepetitionItem.itemType`(EXPRESSION·CHUNK·GRAMMAR·WORD…)을 조각 프레임으로 매핑해 넣는 추정값 —
   * LLM 이 응답 `chunks[].chunkType` 을 다시 판단하므로(A4 와 동일) 이 값이 최종 출력과 달라도 검증에 영향 없다. */
  chunkType: ChunkType
  textJa: string
  reading?: string | null
  meaningKo: string
}

export interface ReviewMixInput {
  todayKst: string
  learner: LearnerHeader
  /** 콘텐츠 난이도(보통 `learner.level`) — 페르소나 §4 필터에 준다(A4 와 동일). */
  level: string
  /** mixSpec — 오늘의 복습으로 추출된 `RepetitionItem` 스냅샷(균등 랜덤 추출 결과, id 포함). */
  items: ReviewMixItemInput[]
  /** A11 `sessionPlan.mixNote_ko`(있으면 "어떻게 섞을지" 참고 힌트로 프롬프트에 싣는다). */
  mixNoteKo?: string | null
}

export class ReviewMixInputError extends Error {
  readonly userMessage = '복습 레슨을 만들 재료가 부족해요.'
  constructor(message: string) {
    super(message)
    this.name = 'ReviewMixInputError'
  }
}

export interface ReviewMixRequest extends LlmJsonRequest<LessonResponse> {
  /** 프롬프트에 실은(트리밍 후) mixSpec id — `checkLessonResponse`/`repairLessonResponse` 의 허용 풀. */
  allowedChunkIds: string[]
  /** `REVIEW_MIX_MAX_ITEMS` 상한 때문에 뺀 항목 수(세션 크기가 보통 6~8이라 실질적으로 0). */
  skippedItems: number
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}

function renderMixBlock(items: ReviewMixItemInput[]): string {
  const lines = items.map((i) => {
    const text = clip(i.textJa, RENDER_MAX.textJa)
    const reading = i.reading ? `(${clip(i.reading, RENDER_MAX.reading)})` : ''
    const meaning = clip(i.meaningKo, RENDER_MAX.meaningKo)
    return `- id=${i.id} [${i.chunkType}] ${text}${reading} — ${meaning}`
  })
  return ['[복습 재료]', ...lines].join('\n')
}

function reviewMixInstruction(hint: string | null): string {
  return [
    '[지시] 아래 [복습 재료]만 써서 학습자를 위한 5단계 복습 수업을 JSON 하나로 만드세요(새 표현을 넣지 않습니다). 최상위 키는 title, titleKo, rolesKo, dialogue, chunks, grammar, quiz, application, speaking, nextPreview 입니다.',
    '- title: 복습 수업 제목(일본어, 40자 이내). titleKo: 한국어 번역(40자 이내). rolesKo.A·rolesKo.B: dialogue 화자 호칭(각 12자 이내).',
    '- dialogue: 6~10줄의 자연스러운 A/B 대화. [복습 재료]의 표현을 최대한 자연스럽게 섞어 **새 대화**를 만듭니다(재료 문장을 그대로 옮기지 않아도 됩니다). [학습자] 수준 안에서 줄마다 2문장 이내, ja·reading(히라가나 전체, 장음 ー)·ko 를 모두 채웁니다.',
    '- **id 규칙(가장 먼저 지킵니다)**: chunks 에서 [복습 재료] 항목을 쓸 때는 그 id 를 **절대 바꾸지 말고 그대로** 쓰고 isNew=false 로 둡니다. 이 레슨은 새 표현을 추가하지 않으므로 원칙적으로 모든 chunks 를 [복습 재료]에서만 고릅니다 — 대화를 자연스럽게 잇기 위해 꼭 필요한 아주 짧은 연결 표현(조사·인사말 등)만 예외로 "new-1","new-2"… 로 붙이고 isNew=true 로 합니다(가능하면 쓰지 않습니다). quiz·application·speaking 의 targetIds 는 이렇게 만든 chunks·아래 grammar 의 id 만 씁니다 — 그 밖의 id 는 쓰지 않습니다.',
    '- chunks: 4~8개, 이름(NAME)·액션(ACTION)·느낌(FEELING)·꾸밈(MODIFIER) 중 하나로 분류합니다.',
    '- grammar: 1~3개, [복습 재료]에 담긴 문형을 다시 짚어 설명합니다(새 문형을 만들지 않습니다). id 는 "g1","g2","g3" 순서로. pattern(문형 표기)·explanationKo(200자 이내)·exampleJa/exampleReading/exampleKo(예문 1개, [복습 재료] 표현을 살립니다).',
    '- quiz: 정확히 5개("q1"~"q5"), 전부 4지선다(choices 4개, answer 는 정답 인덱스 0~3, 숨기지 않고 채웁니다). promptKo·promptJa 중 최소 하나. explanationKo 120자 이내.',
    '- application: 정확히 3개("a1"~"a3"), promptKo(200자 이내)·hintJa(없으면 null)·modelAnswerJa/modelReading/modelKo.',
    '- speaking: 정확히 3개("s1"~"s3"), promptKo(200자 이내)·modelAnswerJa/modelReading/modelKo. 상황(역할극)은 없습니다.',
    '- nextPreview: titleKo(40자 이내)·teaserKo(60자 이내) — 다음 레슨 예고 대신 오늘 복습을 잘 마쳤다는 짧은 격려 한 줄로 채웁니다.',
    hint ? `- [참고] 오늘 복습을 어떻게 섞을지에 대한 힌트: ${clip(hint, 200)}` : null,
    '- reading 계열 필드(dialogue.reading·chunks.reading·grammar.exampleReading·application.modelReading·speaking.modelReading)는 **전부 히라가나(장음은 ー)만** 씁니다. 한자·가타카나·로마자를 쓰지 않습니다.',
    '- speaker·모델 이름 같은 엔진 식별 정보는 어디에도 쓰지 않습니다.',
    INJECTION_GUARD,
  ]
    .filter((x): x is string => Boolean(x))
    .join('\n')
}

export function buildReviewMixRequest(input: ReviewMixInput): ReviewMixRequest {
  if (input.items.length === 0) throw new ReviewMixInputError('mixSpec 이 비어 있어 복습 레슨을 만들 수 없다')

  const allItems = input.items
  const items = allItems.slice(0, REVIEW_MIX_MAX_ITEMS)
  const skippedItems = allItems.length - items.length
  const allowedChunkIds = items.map((i) => i.id)
  const repairSourceChunks: LessonRepairSourceChunk[] = items
    .filter((i): i is ReviewMixItemInput & { reading: string } => Boolean(i.reading))
    .map((i) => ({ id: i.id, chunkType: i.chunkType, textJa: i.textJa, reading: i.reading, meaningKo: i.meaningKo }))

  const persona = loadPersona({ sections: [1, 2, 4, 5, 6, 8], level: input.level, mode: 'LESSON' })
  const system = [
    renderToday(input.todayKst),
    '[모드] LESSON',
    '[복습] 이 레슨은 새 회화가 아니라 복습입니다 — 아래 [복습 재료]에 없는 표현을 새로 가르치지 않습니다.',
    renderHeader(input.learner, REVIEW_MIX_HEADER_CAP),
    `[난이도] ${input.level}`,
    reviewMixInstruction(input.mixNoteKo?.trim() || null),
  ].join('\n')
  const dataBlock = renderMixBlock(items)

  return {
    task: 'reviewMix',
    persona,
    system,
    messages: [{ role: 'user', content: dataBlock }],
    jsonSchema: LESSON_SCHEMA,
    // A4 와 완전히 같은 순서(보정 먼저, 남은 위반만 재시도) — repairLessonResponse·checkLessonResponse 는 무변경 재사용.
    extraCheck: (data) => {
      const repair = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
      if (repair.filled || repair.removed) console.info(`[reviewMix] repair — filled=${repair.filled} removed=${repair.removed}`)
      return checkLessonResponse({ allowedChunkIds }, data)
    },
    allowedChunkIds,
    skippedItems,
  }
}
