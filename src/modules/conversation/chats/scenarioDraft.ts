/**
 * AI 상황 초안(task-010d A3b-2, #166 `POST /api/v1/scenarios/drafts`, 가이드 S3) — **행을 만들지 않는다**(제안→채택: 학습자가 고쳐 [저장]하면 #163 이 만든다).
 *
 * - 본문 `{description, level, topicId?}` 또는 `{description, level, topic?:{title, titleJa?, level?}}`(task-045 — 저장 전 새 주제를 인라인으로, `topicId` 와 함께 보내면 400 `topic` `conflict`) 만(그 밖 키 400). 설명은 #163 과 같은 정리(`cleanScenarioText`) 뒤 5~300자·꺾쇠 금지·비밀 유사 글 금지.
 * - 장소: 시드·본인 주제만(`readScenarioDraftTopic`) — 남의·없는 주제 400 `{field:'topicId', reason:'not_found'}`. 초안 모듈은 받은 id 를 검증 없이 `topicIds` 로 돌려주므로
 *   권한 확인은 모듈 호출 **전** 여기서 한다.
 * - 엔진 `scenarioDraft`(balanced·40s·재시도 없음) → `finalizeScenarioDraft`. `OK` 200 `{draft}` · `NOT_SITUATION`·`UNSAFE` 는 **같은 문구의 422**(사유를 구분해 알리지 않는다 —
 *   우회 시도를 돕지 않게, Trace 에만 코드) · `INVALID`·엔진 오류·시간 초과 5xx(엔진 사용 불가 422 는 화면이 "상황 아님"으로 읽으므로 502 로 바꾼다).
 * - 길이 초과는 모듈이 이미 잘랐다. 서버는 초안이 #163 검사(`normalizeScenarioInput(draft,'create')`)를 통과하는지 한 번 더 보고 **문제 수만 Trace 에** 남긴다 —
 *   초안은 그대로 돌려준다(학습자가 고치기 화면에서 고치고, 저장 때 #163 이 칸별 400 으로 막는다, PE-2b 인계 정책).
 * - Trace 에는 수치·코드만(설명·초안 글 원문 0). 사용자당 동시 1건(프로세스 메모리).
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, classifyError, codePointLength, isSecretLikeText } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { cleanScenarioText, normalizeScenarioInput, readScenarioDraftTopic, SCENARIO_LEVELS } from '@/modules/learning'
import { SCENARIO_LIMITS } from '@/types/scenario'
import { buildScenarioDraftRequest, finalizeScenarioDraft, ScenarioDraftInputError, type ScenarioDraftRequest } from '../prompts/scenarioDraft'
import type { ScenarioDraftOutput, ScenarioDraftResponse } from '../structuredResponse/scenarioDraft'
import { detectUnsafeUserTopicText } from '../structuredResponse/topicDraftSchemas'
import { engineFailure } from './replyPractice'

/** 설명 최소 글자 수 — 화면(`DRAFT.descMin`)과 같다. */
export const SCENARIO_DRAFT_DESCRIPTION_MIN = 5
const BODY_KEYS = ['description', 'level', 'topicId', 'topic'] as const
/** 인라인 장소(`topic`)의 칸 — `level` 은 받되 쓰지 않는다(상황 수준은 본문 `level`). */
const INLINE_TOPIC_KEYS = ['title', 'titleJa', 'level'] as const
/** 인라인 장소 이름 상한 — 프롬프트의 `[장소]` 줄 상한(`SCENARIO_DRAFT_TOPIC_TITLE_MAX`)과 같다. */
const INLINE_TOPIC_TITLE_MAX = 40

/** 저장 전(주제 초안 검토 중)인 새 주제 — 상황 초안의 `[장소]` 줄에만 쓰이고 결과 `topicIds` 에는 들어가지 않는다(아직 id 가 없다). */
export interface ScenarioDraftInlineTopic {
  title: string
  titleJa: string | null
}

export interface ScenarioDraftBody {
  description: string
  level: JlptLevel
  topicId: string | null
  /** 저장된 주제 대신 저장 전 새 주제를 인라인으로 — `topicId` 와 함께 보낼 수 없다(400 `topic` `conflict`). 인라인이 아닌 요청에서는 이 키가 없다. */
  topic?: ScenarioDraftInlineTopic | null
}

export interface ScenarioDraftResult {
  draft: ScenarioDraftOutput
}

const field = (f: string, reason: string, message: string) => new ApiError('VALIDATION', message, { field: f, reason })

function inlineTopicText(raw: unknown, key: 'title' | 'titleJa', required: boolean): string | null {
  const f = `topic.${key}`
  if (raw === undefined || raw === null) {
    if (required) throw field(f, 'required', '장소 이름을 적어 주세요.')
    return null
  }
  if (typeof raw !== 'string') throw field(f, 'type', '장소 이름은 글이어야 해요.')
  const t = cleanScenarioText(raw)
  const n = codePointLength(t)
  if (n === 0) {
    if (required) throw field(f, 'required', '장소 이름을 적어 주세요.')
    return null
  }
  if (n > INLINE_TOPIC_TITLE_MAX) throw field(f, 'max_length', `장소 이름은 ${INLINE_TOPIC_TITLE_MAX}자까지 쓸 수 있어요.`)
  if (/[<>]/.test(t)) throw field(f, 'forbidden_char', '장소 이름에 꺾쇠(< >)는 쓸 수 없어요.')
  if (detectUnsafeUserTopicText(t) !== null) throw field(f, 'forbidden_char', '장소 이름에 쓸 수 없는 글이 있어요.')
  return t
}

function parseInlineTopic(raw: unknown): ScenarioDraftInlineTopic {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw field('topic', 'type', '장소 형식이 올바르지 않아요.')
  const o = raw as Record<string, unknown>
  for (const k of Object.keys(o)) if (!(INLINE_TOPIC_KEYS as readonly string[]).includes(k)) throw field(`topic.${k}`, 'unknown_key', `넣을 수 없는 항목이에요: ${k}`)
  const title = inlineTopicText(o.title, 'title', true) as string
  const titleJa = inlineTopicText(o.titleJa, 'titleJa', false)
  if (o.level !== undefined && o.level !== null && !(SCENARIO_LEVELS as readonly unknown[]).includes(o.level)) throw field('topic.level', 'enum', '장소 수준이 올바르지 않아요.')
  return { title, titleJa }
}

/** #166 본문 검사(LLM 전). 실패는 칸 하나의 400 — 화면은 `field:'description'` 이면 서버 문구를 그 칸 아래에 보인다. */
export function parseScenarioDraftBody(body: Record<string, unknown>): ScenarioDraftBody {
  for (const k of Object.keys(body)) if (!(BODY_KEYS as readonly string[]).includes(k)) throw field(k, 'unknown_key', `넣을 수 없는 항목이에요: ${k}`)
  const raw = body.description
  if (raw === undefined || raw === null) throw field('description', 'required', '상황을 적어 주세요.')
  if (typeof raw !== 'string') throw field('description', 'type', '상황 설명은 글이어야 해요.')
  const description = cleanScenarioText(raw)
  const n = codePointLength(description)
  if (n < SCENARIO_DRAFT_DESCRIPTION_MIN) throw field('description', 'min_length', `상황을 ${SCENARIO_DRAFT_DESCRIPTION_MIN}자 이상 적어 주세요.`)
  if (n > SCENARIO_LIMITS.descriptionMax) throw field('description', 'max_length', `상황 설명은 ${SCENARIO_LIMITS.descriptionMax}자까지 쓸 수 있어요.`)
  if (/[<>]/.test(description)) throw field('description', 'forbidden_char', '상황 설명에 꺾쇠(< >)는 쓸 수 없어요.')
  if (isSecretLikeText(description)) throw field('description', 'secret_like', '상황 설명에 비밀번호·키처럼 보이는 글은 넣을 수 없어요.')
  if (!(SCENARIO_LEVELS as readonly unknown[]).includes(body.level)) throw field('level', 'enum', '수준을 골라 주세요.')
  const t = body.topicId
  if (t !== undefined && t !== null && (typeof t !== 'string' || t.length === 0 || t.length > 40)) throw field('topicId', 'id', 'topicId 형식이 올바르지 않습니다.')
  const topicId = typeof t === 'string' ? t : null
  // task-045: 저장 전 새 주제를 인라인으로(`topic`) — 저장된 주제(`topicId`)와 동시에 보낼 수 없다. 둘 다 없는 요청(장소 없는 초안)은 기존대로 허용한다.
  if (body.topic !== undefined && body.topic !== null) {
    if (topicId !== null) throw field('topic', 'conflict', '장소는 하나만 고를 수 있어요.')
    return { description, level: body.level as JlptLevel, topicId: null, topic: parseInlineTopic(body.topic) }
  }
  return { description, level: body.level as JlptLevel, topicId }
}

export interface ScenarioDraftDeps {
  readTopic(userId: string, topicId: string): Promise<{ id: string; title: string; titleJa: string | null } | null>
  complete(req: Omit<ScenarioDraftRequest, 'context'>): Promise<LlmJsonResult<ScenarioDraftResponse>>
  trace(t: TraceRecord): Promise<void>
}

export const scenarioDraftDeps: ScenarioDraftDeps = {
  readTopic: (userId, topicId) => readScenarioDraftTopic(userId, topicId),
  complete: (req) => llm.completeJson<ScenarioDraftResponse>(req),
  trace: (t) => recordTrace(t),
}

const inFlight = new Set<string>()

const sum = (o: Record<string, number>): number => Object.values(o).reduce((a, b) => a + b, 0)

export async function draftScenario(userId: string, body: ScenarioDraftBody, deps: ScenarioDraftDeps = scenarioDraftDeps): Promise<ScenarioDraftResult> {
  const inline = body.topic ?? null
  const topic: { id: string | null; title: string; titleJa: string | null } | null = inline
    ? { id: null, title: inline.title, titleJa: inline.titleJa }
    : body.topicId
      ? await deps.readTopic(userId, body.topicId)
      : null
  if (!inline && body.topicId && !topic) throw field('topicId', 'not_found', '고를 수 없는 장소예요. 다시 골라 주세요.')
  let req: ScenarioDraftRequest
  try {
    req = buildScenarioDraftRequest({ description: body.description, level: body.level, topic: topic ? { id: topic.id, title: topic.title, titleJa: topic.titleJa } : null })
  } catch (e) {
    if (e instanceof ScenarioDraftInputError) throw field('description', 'required', e.userMessage)
    throw e
  }
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
  inFlight.add(userId)
  const { context, ...llmReq } = req
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    let r: LlmJsonResult<ScenarioDraftResponse>
    try {
      r = await deps.complete({ ...llmReq, traceId })
    } catch (e) {
      steps.push({ name: 'SCENARIO_DRAFT', ms: Date.now() - started, errorCode: classifyError(e).code })
      throw engineFailure(e, '초안을 만들지 못했어요. 다시 시도해 주세요.')
    }
    const fin = finalizeScenarioDraft(context, r.data)
    const shapeProblems = fin.status === 'OK' && fin.draft ? normalizeScenarioInput(fin.draft as unknown as Record<string, unknown>, 'create').problems.length : 0
    steps.push({
      name: 'SCENARIO_DRAFT',
      ms: Date.now() - started,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      draftStatus: fin.status,
      problems: fin.problems.length,
      truncated: fin.repairs.truncated,
      droppedExpressions: sum(fin.repairs.droppedExpressions),
      expressions: fin.draft?.keyExpressions.length ?? 0,
      topic: topic !== null,
      ...(inline ? { topicInline: true } : {}),
      shapeProblems,
    })
    if (fin.status === 'OK' && fin.draft) return { draft: fin.draft }
    if (fin.status === 'NOT_SITUATION' || fin.status === 'UNSAFE') {
      throw new ApiError('UNPROCESSABLE', '이 글로는 상황을 만들기 어려워요. 어디서 누구와 무엇을 하는지 적어 주세요.', { reason: 'NOT_A_SCENARIO' })
    }
    throw new ApiError('ENGINE_ERROR', '초안을 만들지 못했어요. 다시 시도해 주세요.', { reason: 'DRAFT_INVALID' })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    throw e
  } finally {
    inFlight.delete(userId)
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'scenarioDraft', refId: null }).catch(() => undefined)
  }
}
