/**
 * #59 A4 입력 조립(라우트 조합 — module-dependency §4-4): learning 재료 + conversation 읽기 → `buildLessonRequest` 입력.
 *
 * - **일반 수업(주제·붙여넣기)은 이 파일이 생기기 전 라우트가 만들던 객체와 같다** — `scenario` 칸을 아예 넣지 않는다(A4 요청 바이트 불변,
 *   PE 골든 `tests/prompts/fixtures/lesson-general-golden.json` + 이 디렉터리 시험이 고정).
 * - **상황 수업(task-010d A2)**: 상황 행 → conversation `scenarioPromptParts`(역할극 헤더·종료 판정과 같은 PE 어댑터 — 표현 id·순서가 같다) →
 *   `scenario` 입력. 대표 주제에 조각이 있으면 주제+상황(조각 id 규칙 유지), 대표 주제가 없거나 조각이 없으면 상황 단독(`new-N`) — 조각 없는 주제를
 *   그대로 넘기면 `LessonInputError` 다(PE 계약). 붙여 넣은 문장은 싣지 않는다(검증이 이미 400).
 *   `scenario.level` 은 `Lesson.level`(= 대표 주제 수준, 없으면 상황 수준)과 같게 넘긴다 — 상황 단독 프롬프트의 난이도가 저장 수준과 어긋나지 않게.
 */
import { scenarioPromptParts, type LessonInput, type LessonRequest, type LessonScenarioInput } from '@/modules/conversation'
import type { CreateLessonInput, LessonMaterials } from '@/modules/learning'
// 주제 조각은 4유형뿐(task-068 J12) — DB enum 의 단어 전용 값(EXPRESSION)을 A4 입력 앞에서 좁힌다.
import { asTopicChunkType } from '@/types/topic'

export interface LessonInputContext {
  todayKst: string
  learner: LessonInput['learner']
  corrections: NonNullable<LessonInput['acceptedCorrections']>
}

function topicInput(t: NonNullable<LessonMaterials['topic']>): NonNullable<LessonInput['topic']> {
  return { title: t.title, titleJa: t.titleJa, level: t.level, chunks: t.chunks.map((c) => ({ id: c.id, chunkType: asTopicChunkType(c.chunkType, 'MODIFIER'), textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo })) }
}

/** 상황 행 → A4 `[상황]` 입력(글자 수 자르기는 PE `lesson.ts` 가 한다). */
export function lessonScenarioInput(m: LessonMaterials): LessonScenarioInput | null {
  if (!m.scenario) return null
  const talk = scenarioPromptParts(m.scenario.row, m.scenario.chunks).talk
  return {
    title: m.scenario.title,
    titleJa: m.scenario.titleJa,
    level: m.level,
    roles: talk.roles,
    goalKo: talk.goalKo,
    steps: talk.steps,
    expressions: talk.expressions.map((e) => ({ ja: e.ja, ko: e.ko })),
  }
}

export function lessonInputFor(m: LessonMaterials, ctx: LessonInputContext): LessonInput {
  const scenario = lessonScenarioInput(m)
  if (!scenario) {
    return {
      todayKst: ctx.todayKst,
      learner: ctx.learner,
      topic: m.topic ? topicInput(m.topic) : null,
      sourceText: m.input.kind === 'text' ? m.input.sourceText : null,
      acceptedCorrections: ctx.corrections,
      previousTitles: m.previousTitles,
      previousNextPreview: m.previousNextPreview,
    }
  }
  return {
    todayKst: ctx.todayKst,
    learner: ctx.learner,
    topic: m.topic && m.topic.chunks.length > 0 ? topicInput(m.topic) : null,
    sourceText: null,
    acceptedCorrections: ctx.corrections,
    previousTitles: m.previousTitles,
    previousNextPreview: m.previousNextPreview,
    scenario,
  }
}

/** `LessonInputError` 를 400 으로 바꿀 때의 `field`. */
export function lessonInputErrorField(input: CreateLessonInput): 'sourceText' | 'topicId' | 'scenarioId' {
  return input.kind === 'text' ? 'sourceText' : input.kind === 'scenario' ? 'scenarioId' : 'topicId'
}

/** `AiJob.payload.inputMeta`(개수·길이만, 본문 없음). 일반 수업은 이전과 같은 칸, 상황 수업만 두 칸을 더한다. */
export function lessonInputMeta(m: LessonMaterials, input: LessonInput, request: Pick<LessonRequest, 'allowedChunkIds' | 'skippedChunks'>): Record<string, string | number | boolean | null> {
  const meta: Record<string, string | number | boolean | null> = {
    source: m.input.kind,
    chunks: request.allowedChunkIds.length,
    skippedChunks: request.skippedChunks,
    sourceChars: m.input.kind === 'text' ? m.input.sourceText.length : null,
    corrections: input.acceptedCorrections?.length ?? 0,
    previousTitles: m.previousTitles.length,
    previousPreview: m.previousNextPreview !== null,
  }
  if (input.scenario) {
    meta.scenarioWithTopic = Boolean(input.topic)
    meta.scenarioExpressions = input.scenario.expressions.length
  }
  return meta
}
