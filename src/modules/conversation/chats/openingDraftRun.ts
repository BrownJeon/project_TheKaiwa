/**
 * 역할극 첫마디 일본어 제안 실행(task-045 T4, #178 `POST /api/v1/scenarios/openings/draft`, D5=A) — **행을 만들지 않는다**
 * (저장은 상황 저장 #163·#164·#175 의 `opening{ja, ko}`, 읽기 `reading` 은 확인용이라 어디에도 저장하지 않는다).
 * #170 `draftTopic` 과 같은 구조(라우트는 본문 검사 → 한도 → 이 함수, app 은 engine 을 직접 부르지 않는다 — module-dependency §4·ESLint).
 *
 * - 본문 `{ko(1~80자, 한글 1자 이상), scenario:{title?, titleJa?, goal?, placeTitle?, level?, roles:{learner, tutor}}}`(`parseOpeningDraftBody`, 그 밖 키 400).
 *   `scenario.level` 이 없으면 학습자 수준 — 프로필은 **다른 칸 검사를 통과한 뒤에만** 읽는다.
 * - 엔진 `openingDraft`(balanced·25s) → `finalizeOpeningDraft(data, {ko})`(**ko 필수** — ja 의 로마자가 한국어에 있던 것인지 대조, 재시도 검사와 같은 값).
 *   `OK` 200 `{ja, reading, warnings}` · `NOT_AN_UTTERANCE`·`UNSAFE` 같은 문구의 422 · `TOO_LONG` 422(`reason:'TOO_LONG'`) ·
 *   `INVALID`·엔진 오류·마지막 시도 검증 실패(`JsonSchemaError` — 엔진이 `extraCheck` 위반을 재시도 뒤에도 못 고치면 던진다)·시간 초과는 모두 같은 문구의 502(#170 과 같다) ·
 *   엔진 큐 포화 429 그대로.
 * - 사용자당 동시 1건(프로세스 메모리) 409 `DRAFT_BUSY`. Trace 에는 수치·코드·판 이름(`openingDraft@v2`)만 — 한국어·일본어·읽기 원문 0.
 * - 손님이 끊으면(`signal` = 라우트 `req.signal`, task-058) 엔진 호출을 멈추고 분류된 409 `CANCELLED` 로 조용히 끝낸다(500·오류 로그 없음, Trace 에는 `CANCELLED` 코드만).
 *   엔진 상한이 25초(1차+재시도)라 끊긴 호출이 슬롯을 쥐는 시간이 #169·#180 보다 길다. 잠금(`DRAFT_BUSY`)은 `finally` 가 푼다 — 엔진이 실행 중이면 abort 즉시,
 *   큐에서 차례를 기다리는 중이면 차례가 올 때(앞선 호출이 끝난 뒤) 풀린다. 큐 대기분은 수용한 한계다: 재시도도 같은 큐 뒤에 서므로 기다리는 시간은 같다.
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, classifyError } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { getProfile } from '@/modules/preferences'
import { buildOpeningDraftRequest, finalizeOpeningDraft, OpeningDraftInputError, OPENING_DRAFT_PROMPT_VERSION, OPENING_DRAFT_TOO_LONG_MESSAGE, type OpeningDraftRequest } from '../prompts/openingDraft'
import { parseOpeningDraftBody, type OpeningDraftBody, type OpeningDraftResponse, type OpeningDraftWarning } from '../structuredResponse/openingDraftSchemas'
import { cancelledError, isAbortError } from './requestCancel'

/** 422 문구(Leader 확정) — 첫마디가 아닌 글·부적절한 글 모두 이 문구(사유를 구분해 알리지 않는다). */
export const OPENING_DRAFT_REJECT_MESSAGE = '선생님이 처음 건넬 말을 적어 주세요. 예: 어서 오세요, 무엇을 드릴까요?'
/** 502 문구 — 쓸 수 없는 제안·엔진 오류·시간 초과. */
export const OPENING_DRAFT_FAIL_MESSAGE = '잠시 문제가 생겼어요. 다시 만들어 볼까요?'

export interface OpeningDraftResult {
  /** ≤60자, 공백 없음, 전각 부호, 한글 없음. */
  ja: string
  /** 확인용 가나 읽기(저장하지 않는다) — 만들지 못했으면 null(`warnings` 에 `READING_DROPPED`). */
  reading: string | null
  warnings: OpeningDraftWarning[]
}

export interface OpeningDraftRunDeps {
  profileLevel(userId: string): Promise<JlptLevel>
  complete(req: OpeningDraftRequest): Promise<LlmJsonResult<OpeningDraftResponse>>
  trace(t: TraceRecord): Promise<void>
}

export const openingDraftRunDeps: OpeningDraftRunDeps = {
  profileLevel: async (userId) => (await getProfile(userId)).level as JlptLevel,
  complete: (req) => llm.completeJson<OpeningDraftResponse>(req),
  trace: (t) => recordTrace(t),
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** #178 본문 → 검사된 입력. 칸 문제는 첫 문제의 400 `{field, reason, problems[]}`(LLM·프로필 읽기 전). */
export async function readOpeningDraftBody(userId: string, raw: Record<string, unknown>, deps: Pick<OpeningDraftRunDeps, 'profileLevel'> = openingDraftRunDeps): Promise<OpeningDraftBody> {
  const sc = raw.scenario
  const needsLevel = isObj(sc) && (sc.level === undefined || sc.level === null)
  const first = parseOpeningDraftBody(raw, { defaultLevel: needsLevel ? 'N5' : undefined })
  if (!first.ok) {
    const p = first.problems[0]
    throw new ApiError('VALIDATION', p.message, { field: p.field, reason: p.reason, problems: first.problems.map(({ field, reason }) => ({ field, reason })) })
  }
  if (!needsLevel) return first.value
  return { ...first.value, scenario: { ...first.value.scenario, level: await deps.profileLevel(userId) } }
}

const inFlight = new Set<string>()

/** 엔진 예외 → 502(#170 과 같다: 시간 초과도 502 `TIMEOUT`). 큐 포화 429 만 그대로. */
function engineError(e: unknown): unknown {
  const code = classifyError(e).code
  if (code === 'RATE_LIMITED') return e
  const reason = code === 'ENGINE_TIMEOUT' ? 'TIMEOUT' : (e as { name?: string })?.name === 'JsonSchemaError' ? 'DRAFT_INVALID' : 'ENGINE_FAILED'
  return new ApiError('ENGINE_ERROR', OPENING_DRAFT_FAIL_MESSAGE, { reason })
}

export async function runOpeningDraft(userId: string, body: OpeningDraftBody, deps: Pick<OpeningDraftRunDeps, 'complete' | 'trace'> = openingDraftRunDeps, signal?: AbortSignal): Promise<OpeningDraftResult> {
  let llmReq: OpeningDraftRequest
  try {
    llmReq = buildOpeningDraftRequest({ ko: body.ko, scenario: body.scenario })
  } catch (e) {
    if (e instanceof OpeningDraftInputError) throw new ApiError('VALIDATION', e.userMessage, { field: 'ko', reason: 'required' })
    throw e
  }
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '첫마디를 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  // 등록과 try 사이에 던질 수 있는 문장이 끼면 finally 가 돌지 않아 그 사용자가 재기동 전까지 DRAFT_BUSY 로 막힌다(REV-155 L1).
  inFlight.add(userId)
  try {
    let r: LlmJsonResult<OpeningDraftResponse>
    try {
      r = await deps.complete({ ...llmReq, traceId, ...(signal ? { signal } : {}) })
    } catch (e) {
      // 이름만으로 취소로 보지 않는다: 요청에 실어 보낸 신호가 실제로 abort 됐을 때만. 어댑터가 자기 타이머로 만든 AbortError 가 새도 진짜 오류(502·504)가 로그 없는 409 로 둔갑하지 않게.
      if (signal?.aborted === true && isAbortError(e)) {
        steps.push({ name: 'OPENING_DRAFT', ms: Date.now() - started, promptVersion: OPENING_DRAFT_PROMPT_VERSION, errorCode: 'CANCELLED' })
        errorCode = 'CANCELLED'
        throw cancelledError()
      }
      steps.push({ name: 'OPENING_DRAFT', ms: Date.now() - started, promptVersion: OPENING_DRAFT_PROMPT_VERSION, errorCode: classifyError(e).code })
      throw engineError(e)
    }
    const fin = finalizeOpeningDraft(r.data, { ko: body.ko })
    steps.push({
      name: 'OPENING_DRAFT',
      ms: Date.now() - started,
      promptVersion: OPENING_DRAFT_PROMPT_VERSION,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      draftStatus: fin.status,
      problems: fin.problems.length,
      warnings: fin.warnings.length,
      jaChars: fin.repairs.jaChars,
      sentences: fin.repairs.sentences,
      jaCutSentences: fin.repairs.jaCutSentences,
      readingDrop: fin.repairs.readingDrop,
      tooLongReason: fin.repairs.tooLongReason,
    })
    if (fin.status === 'OK' && fin.ja) return { ja: fin.ja, reading: fin.reading, warnings: fin.warnings }
    if (fin.status === 'NOT_AN_UTTERANCE' || fin.status === 'UNSAFE') throw new ApiError('UNPROCESSABLE', OPENING_DRAFT_REJECT_MESSAGE, { reason: 'NOT_AN_UTTERANCE' })
    if (fin.status === 'TOO_LONG') throw new ApiError('UNPROCESSABLE', OPENING_DRAFT_TOO_LONG_MESSAGE, { reason: 'TOO_LONG' })
    throw new ApiError('ENGINE_ERROR', OPENING_DRAFT_FAIL_MESSAGE, { reason: 'DRAFT_INVALID' })
  } catch (e) {
    status = 'ERROR'
    errorCode ??= classifyError(e).code
    throw e
  } finally {
    inFlight.delete(userId)
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'openingDraft', refId: null }).catch(() => undefined)
  }
}
