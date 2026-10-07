/**
 * 변형 상황 초안 실행(task-045 T4, #177 `POST /api/v1/scenarios/:id/variants/drafts`, 변형 A) — **행을 만들지 않는다**(저장은 학습자가 고쳐 [저장]하면 #163).
 * #166 `draftScenario`·#170 `draftTopic` 과 같은 구조(라우트는 기준 상황 읽기 → 본문 검사 → 한도 → 이 함수, app 은 engine 을 직접 부르지 않는다 — module-dependency §4·ESLint).
 *
 * - 기준 상황 = **이 사용자에게 보이는 상황만**: 내 상황 또는 가리지 않은 시드(`getScenarioDetail` 이 남의 것·없음·지운 것을 404 로 막고, 가린 시드는 여기서 404).
 *   장소는 기준 상황의 장소를 이어받되 가린 시드 주제는 뺀다(초안 모듈은 받은 id 를 검증 없이 `topicIds` 로 돌려주므로 권한 확인은 모듈 호출 **전** 여기서).
 * - 본문 `{axes, note?}`(`parseScenarioVariantBody`, 기준 수준을 넘겨 N1 의 `up` 을 접는다). 칸 문제 400 · 바꿀 점 없음 422 `NO_VARIATION`.
 * - 엔진 `scenarioVariant`(balanced·40s, JSON 재시도 1회는 엔진 안) → `finalizeScenarioVariant`. `OK` 200 `{draft, changedFields, axes}` · `UNSAFE` 422 한 문구(사유 구분 없음) ·
 *   `INVALID`·엔진 오류 502 · 시간 초과 504(#166 과 같은 상태 코드) · 엔진 큐 포화 429 그대로.
 * - 사용자당 동시 1건(프로세스 메모리) 409 `DRAFT_BUSY`. Trace 에는 수치·코드·판 이름(`scenarioVariant@v3`)만 — 기준 상황·직접 적은 글·초안 글 원문 0.
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, classifyError, prisma } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { getScenarioDetail, loadSeedVisibility, scenarioNotFound } from '@/modules/learning'
import type { ScenarioDetail, ScenarioTopicRef } from '@/types/scenario'
import { SCENARIO_VARIANT_NO_CHANGE_MESSAGE, type ScenarioVariantResponse } from '@/types/scenarioVariant'
import { buildScenarioVariantRequest, finalizeScenarioVariant, ScenarioVariantInputError, SCENARIO_VARIANT_PROMPT_VERSION, type ScenarioVariantRequest } from '../prompts/scenarioVariant'
import { normalizeVariantBase, parseScenarioVariantBody, type ScenarioVariantBase, type ScenarioVariantBody, type ScenarioVariantModelResponse } from '../structuredResponse/scenarioVariantSchemas'

/** 422 문구 — 모델이 안전하지 않다고 본 요청(사유를 구분해 알리지 않는다). */
export const SCENARIO_VARIANT_REJECT_MESSAGE = '이 내용으로는 변형 상황을 만들기 어려워요. 바꿀 점을 다르게 적어 주세요.'
/** 502·504 문구 — 쓸 수 없는 초안·엔진 오류·시간 초과. */
export const SCENARIO_VARIANT_FAIL_MESSAGE = '잠시 문제가 생겼어요. 다시 만들어 볼까요?'

/** 서버가 읽어 정리한 기준 상황(`normalizeVariantBase` 결과) — 라우트가 본문 검사(기준 수준)와 초안 호출에 같이 쓴다. */
export interface ScenarioVariantTarget {
  scenarioId: string
  base: ScenarioVariantBase
}

export interface ScenarioVariantDeps {
  /** #162 상세 — 남의 것·없음 404, 지운 상황 404 `ARCHIVED`. 가린 시드도 돌려준다(id 직접 읽기는 막지 않는 계약 §2) → 가림 판정은 이 모듈. */
  readDetail(userId: string, scenarioId: string): Promise<ScenarioDetail>
  visibility(userId: string): Promise<{ hiddenScenarios: ReadonlySet<string>; hiddenTopics: ReadonlySet<string> }>
  complete(req: Omit<ScenarioVariantRequest, 'context'>): Promise<LlmJsonResult<ScenarioVariantModelResponse>>
  trace(t: TraceRecord): Promise<void>
}

export const scenarioVariantDeps: ScenarioVariantDeps = {
  readDetail: (userId, scenarioId) => getScenarioDetail(userId, scenarioId),
  visibility: (userId) => loadSeedVisibility(prisma, userId),
  complete: (req) => llm.completeJson<ScenarioVariantModelResponse>(req),
  trace: (t) => recordTrace(t),
}

function baseOf(d: ScenarioDetail, topics: readonly ScenarioTopicRef[]): ScenarioVariantBase {
  return {
    title: d.title,
    titleJa: d.titleJa,
    description: d.description,
    level: d.level,
    roles: { learner: d.roles.learner, tutor: d.roles.tutor },
    goal: { communicativeGoalKo: d.goal.communicativeGoalKo, successCriteria: [...d.goal.successCriteria] },
    steps: d.steps.map((s) => ({ ko: s.ko })),
    keyExpressions: d.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading ?? null, ko: e.ko })),
    opening: d.opening ? { ja: d.opening.ja, ko: d.opening.ko } : null,
    topics: topics.map((t) => ({ id: t.id, title: t.title })),
  }
}

/** #177 기준 상황 읽기 — 내 상황·가리지 않은 시드만(남의 것·없음·지운 것·가린 시드 모두 같은 404). 장소는 가린 시드 주제를 뺀 나머지. */
export async function readScenarioVariantBase(userId: string, scenarioId: string, deps: Pick<ScenarioVariantDeps, 'readDetail' | 'visibility'> = scenarioVariantDeps): Promise<ScenarioVariantTarget> {
  const detail = await deps.readDetail(userId, scenarioId)
  const vis = await deps.visibility(userId)
  if (!detail.isMine && vis.hiddenScenarios.has(detail.id)) throw scenarioNotFound()
  const topics = detail.topics.filter((t) => !vis.hiddenTopics.has(t.id))
  return { scenarioId: detail.id, base: normalizeVariantBase(baseOf(detail, topics)) }
}

/** #177 본문 → 검사된 축·직접 적은 글(LLM 호출·한도 전). 칸 문제는 첫 문제의 400 `{field, reason, problems[]}`, 바꿀 점이 없으면 422 `NO_VARIATION`. */
export function readScenarioVariantBody(raw: unknown, baseLevel: JlptLevel): ScenarioVariantBody {
  const r = parseScenarioVariantBody(raw, { baseLevel })
  if (r.ok) return r.value
  const p = r.problems[0]
  if (p.reason === 'no_change') throw new ApiError('UNPROCESSABLE', SCENARIO_VARIANT_NO_CHANGE_MESSAGE, { reason: 'NO_VARIATION' })
  throw new ApiError('VALIDATION', p.message, { field: p.field, reason: p.reason, problems: r.problems.map(({ field, reason }) => ({ field, reason })) })
}

const inFlight = new Set<string>()

/** 엔진 예외 → 응답 오류. 큐 포화(429)는 그대로, 시간 초과 504·엔진 오류 502(#166 과 같은 상태 코드, 문구는 한 가지), 알 수 없는 예외는 그대로 500(결함을 숨기지 않는다). */
function engineError(e: unknown): unknown {
  const code = classifyError(e).code
  if (code === 'ENGINE_TIMEOUT') return new ApiError('ENGINE_TIMEOUT', SCENARIO_VARIANT_FAIL_MESSAGE, { reason: 'TIMEOUT' })
  if (code === 'ENGINE_ERROR' || code === 'ENGINE_UNAVAILABLE') {
    const reason = (e as { name?: string })?.name === 'JsonSchemaError' ? 'DRAFT_INVALID' : code === 'ENGINE_UNAVAILABLE' ? 'ENGINE_UNAVAILABLE' : 'ENGINE_FAILED'
    return new ApiError('ENGINE_ERROR', SCENARIO_VARIANT_FAIL_MESSAGE, { reason })
  }
  return e
}

export async function draftScenarioVariant(
  userId: string,
  target: ScenarioVariantTarget,
  body: ScenarioVariantBody,
  deps: Pick<ScenarioVariantDeps, 'complete' | 'trace'> = scenarioVariantDeps,
): Promise<ScenarioVariantResponse> {
  let req: ScenarioVariantRequest
  try {
    req = buildScenarioVariantRequest({ base: target.base, axes: body.axes, note: body.note })
  } catch (e) {
    if (!(e instanceof ScenarioVariantInputError)) throw e
    if (e.code === 'NO_VARIATION') throw new ApiError('UNPROCESSABLE', SCENARIO_VARIANT_NO_CHANGE_MESSAGE, { reason: 'NO_VARIATION' })
    if (e.code === 'AXES_INVALID') throw new ApiError('VALIDATION', '고를 수 없는 값이에요. 다시 골라 주세요.', { field: 'axes', reason: 'enum' })
    // 기준 상황 행이 깨짐(제목·역할·목표·순서·표현 없음) — 저장 검사를 통과한 행에서는 나오지 않으므로 결함으로 본다.
    throw new ApiError('INTERNAL', e.userMessage, { reason: 'BASE_INVALID' })
  }
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
  const { context, ...llmReq } = req
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  // 등록과 try 사이에 던질 수 있는 문장이 끼면 finally 가 돌지 않아 그 사용자가 재기동 전까지 DRAFT_BUSY 로 막힌다(REV-155 L1).
  inFlight.add(userId)
  try {
    let r: LlmJsonResult<ScenarioVariantModelResponse>
    try {
      r = await deps.complete({ ...llmReq, traceId })
    } catch (e) {
      steps.push({ name: 'SCENARIO_VARIANT', ms: Date.now() - started, promptVersion: SCENARIO_VARIANT_PROMPT_VERSION, errorCode: classifyError(e).code })
      throw engineError(e)
    }
    const fin = finalizeScenarioVariant(context, r.data)
    steps.push({
      name: 'SCENARIO_VARIANT',
      ms: Date.now() - started,
      promptVersion: SCENARIO_VARIANT_PROMPT_VERSION,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      draftStatus: fin.status,
      problems: fin.problems.length,
      changed: fin.changedFields.length,
      persona: context.axes.persona,
      twist: context.axes.twist,
      flow: context.axes.flow,
      levelUp: context.axes.level === 'up',
      hasNote: context.note !== null,
      topics: context.topicIds.length,
      expressions: fin.draft?.keyExpressions.length ?? 0,
      openingFromBase: fin.repairs.openingFromBase,
    })
    if (fin.status === 'OK' && fin.draft) return { draft: fin.draft, changedFields: fin.changedFields, axes: context.axes }
    if (fin.status === 'UNSAFE') throw new ApiError('UNPROCESSABLE', SCENARIO_VARIANT_REJECT_MESSAGE, { reason: 'NOT_A_VARIANT' })
    throw new ApiError('ENGINE_ERROR', SCENARIO_VARIANT_FAIL_MESSAGE, { reason: 'DRAFT_INVALID' })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    throw e
  } finally {
    inFlight.delete(userId)
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'scenarioVariant', refId: null }).catch(() => undefined)
  }
}
