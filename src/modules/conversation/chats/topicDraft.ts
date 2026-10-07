/**
 * AI 주제 초안 실행(task-045 T2, #170 `POST /api/v1/topics/drafts`) — **행을 만들지 않는다**(제안→채택: 학습자가 검토·수정해 [저장]하면 #57 이 만든다).
 * #166 `draftScenario` 와 같은 구조(라우트는 본문 검사 → 한도 → 이 함수, app 은 engine 을 직접 부르지 않는다 — module-dependency §4·ESLint).
 *
 * - 본문 `{title(2~40자), level?, note?(≤200자)}`(`parseTopicDraftBody`, 그 밖 키 400). `level` 이 없으면 학습자 수준 — 프로필은 **다른 칸 검사를 통과한 뒤에만** 읽는다.
 * - 엔진 `topicDraft`(balanced·40s, JSON 재시도 1회는 엔진 안) → `finalizeTopicDraft`. `OK` 200 `{draft, warnings}` · `NOT_A_TOPIC`·`UNSAFE` 는 **같은 문구의 422**
 *   (사유를 구분해 알리지 않는다 — 우회 시도를 돕지 않게, Trace 에만 코드) · `INVALID`·엔진 오류·시간 초과는 모두 같은 문구의 502(엔진 큐 포화 429 는 그대로).
 * - 사용자당 동시 1건(프로세스 메모리 — #166 `inFlight` 선례) 409 `DRAFT_BUSY`.
 * - Trace 에는 수치·코드·판 이름(`topicDraft@v2`)만 — 주제 이름·보충 설명·초안 글 원문 0.
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, classifyError } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { getProfile } from '@/modules/preferences'
import { buildTopicDraftRequest, finalizeTopicDraft, TopicDraftInputError, TOPIC_DRAFT_PROMPT_VERSION, type TopicDraftRequest } from '../prompts/topicDraft'
import { parseTopicDraftBody, type TopicDraftBody, type TopicDraftOutput, type TopicDraftResponse, type TopicDraftWarning } from '../structuredResponse/topicDraftSchemas'

/** 422 문구(Leader 확정, 2026-10-07) — 주제가 아닌 글·부적절한 글 모두 이 문구. */
export const TOPIC_DRAFT_REJECT_MESSAGE = '이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인).'
/** 502 문구 — 쓸 수 없는 초안·엔진 오류·시간 초과. */
export const TOPIC_DRAFT_FAIL_MESSAGE = '잠시 문제가 생겼어요. 다시 만들어 볼까요?'

export interface TopicDraftResult {
  draft: TopicDraftOutput
  warnings: TopicDraftWarning[]
}

export interface TopicDraftDeps {
  profileLevel(userId: string): Promise<JlptLevel>
  complete(req: Omit<TopicDraftRequest, 'context'>): Promise<LlmJsonResult<TopicDraftResponse>>
  trace(t: TraceRecord): Promise<void>
}

export const topicDraftDeps: TopicDraftDeps = {
  profileLevel: async (userId) => (await getProfile(userId)).level as JlptLevel,
  complete: (req) => llm.completeJson<TopicDraftResponse>(req),
  trace: (t) => recordTrace(t),
}

/** #170 본문 → 검사된 입력. 칸 문제는 첫 문제의 400 `{field, reason, problems[]}`(LLM·프로필 읽기 전). */
export async function readTopicDraftBody(userId: string, raw: Record<string, unknown>, deps: Pick<TopicDraftDeps, 'profileLevel'> = topicDraftDeps): Promise<TopicDraftBody> {
  const needsLevel = raw.level === undefined || raw.level === null
  const first = parseTopicDraftBody(raw, { defaultLevel: needsLevel ? 'N5' : undefined })
  if (!first.ok) {
    const p = first.problems[0]
    throw new ApiError('VALIDATION', p.message, { field: p.field, reason: p.reason, problems: first.problems.map(({ field, reason }) => ({ field, reason })) })
  }
  return needsLevel ? { ...first.value, level: await deps.profileLevel(userId) } : first.value
}

const inFlight = new Set<string>()

const sum = (o: Partial<Record<string, number>>): number => Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0)

export async function draftTopic(userId: string, body: TopicDraftBody, deps: TopicDraftDeps = topicDraftDeps): Promise<TopicDraftResult> {
  let req: TopicDraftRequest
  try {
    req = buildTopicDraftRequest({ title: body.title, level: body.level, note: body.note })
  } catch (e) {
    if (e instanceof TopicDraftInputError) throw new ApiError('VALIDATION', '주제를 적어 주세요.', { field: 'title', reason: 'required' })
    throw e
  }
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '주제 초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
  const { context, ...llmReq } = req
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  // 확인(has)과 등록(add) 사이에 비동기 대기가 없어 같은 사용자의 두 요청이 끼어들 수 없다. 등록은 try 바로 앞 — 사이에서 던지면 영구 DRAFT_BUSY(REV-152b L1).
  inFlight.add(userId)
  try {
    let r: LlmJsonResult<TopicDraftResponse>
    try {
      r = await deps.complete({ ...llmReq, traceId })
    } catch (e) {
      const code = classifyError(e).code
      steps.push({ name: 'TOPIC_DRAFT', ms: Date.now() - started, promptVersion: TOPIC_DRAFT_PROMPT_VERSION, errorCode: code })
      if (code === 'RATE_LIMITED') throw e
      throw new ApiError('ENGINE_ERROR', TOPIC_DRAFT_FAIL_MESSAGE, { reason: code === 'ENGINE_TIMEOUT' ? 'TIMEOUT' : 'ENGINE_FAILED' })
    }
    const fin = finalizeTopicDraft(context, r.data)
    steps.push({
      name: 'TOPIC_DRAFT',
      ms: Date.now() - started,
      promptVersion: TOPIC_DRAFT_PROMPT_VERSION,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      draftStatus: fin.status,
      problems: fin.problems.length,
      received: fin.repairs.received,
      kept: fin.repairs.kept,
      dropped: sum(fin.repairs.droppedByReason),
      warnings: fin.warnings.length,
      truncated: fin.repairs.truncated,
      hasNote: body.note !== null,
    })
    if (fin.status === 'OK' && fin.draft) return { draft: fin.draft, warnings: fin.warnings }
    if (fin.status === 'NOT_A_TOPIC' || fin.status === 'UNSAFE') throw new ApiError('UNPROCESSABLE', TOPIC_DRAFT_REJECT_MESSAGE, { reason: 'NOT_A_TOPIC' })
    throw new ApiError('ENGINE_ERROR', TOPIC_DRAFT_FAIL_MESSAGE, { reason: 'DRAFT_INVALID' })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    throw e
  } finally {
    inFlight.delete(userId)
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'topicDraft', refId: null }).catch(() => undefined)
  }
}
