/**
 * 오늘의 회화 ⑤ 말하기 「내가 한 말」 번역(task-077 IMP-0053, api-contract #185 `POST /api/v1/lessons/:id/speaking-translation {text}` → `{ko}`) — **저장 없음**.
 *
 * - 회화방 «내 말 번역 다시 가져오기»(#32t `chats/translation.ts`)와 **같은 프롬프트·엔진 태스크**(`userTranslation@v1`, fast·15s·interactive)와
 *   같은 정리(`sanitizeUserTranslation`)를 쓴다. 다른 점: 메시지 행이 없어 화면이 보낸 글을 그대로 받고, 결과를 어디에도 쓰지 않는다(DB 도메인 쓰기 0).
 * - 소유 확인(남의·없는·형식이 잘못된 레슨 404)은 **라우트가 learning 으로 먼저** 한다(app 층 조합 — conversation 은 레슨을 모른다).
 *   레슨 상태는 묻지 않는다(끝낸 단계 다시 보기에서도 번역 칸이 보인다).
 * - 본문 검사는 길이·타입뿐: 정리(`sanitizeText` 여러 줄 — 턴 입력과 같은 정리) 뒤 1~1,000 코드포인트, 일본어가 아니어도 그대로 번역을 시도한다.
 *   일본어가 없는 말은 모델이 그대로 베껴 돌려주기 쉬워 정리에서 버려지고 `502 TRANSLATION_REJECTED` 가 된다(#32t 와 같은 판정).
 * - 사용자당 동시 1건은 **이 파일만의 Set** 이다 — #32t(`chats/translation.ts`)·도우미(#180·#181·#184 `phraseHelp.ts`)의 잠금과 서로 막지 않는다
 *   (Leader 결정: 번역과 도우미는 별도 한도·별도 잠금). 분당 한도 키도 라우트가 따로 둔다.
 * - 손님이 끊으면(`signal` = 라우트 `req.signal`, 화면 12초 시간 초과·다음 과제·새 녹음) 엔진 호출을 멈추고 409 `CANCELLED` 로 조용히 끝낸다 —
 *   화면 시간 상한(12s)이 엔진 상한(15s)보다 짧아, 끊긴 호출이 잠금을 쥐고 있으면 곧이은 [다시 가져오기] 가 409 바쁨이 된다(#180 task-058 과 같은 이유).
 * - 원문·번역은 로그·`RequestTrace` 에 남기지 않는다 — Trace 단계는 코드·수치(글자 수·시도 수·연결 키)만.
 */
import { ApiError, classifyError, codePointLength, sanitizeText } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { getProfile } from '@/modules/preferences'
import type { LessonSpeakingTranslation } from '@/types/lesson'
import {
  buildUserTranslationRequest,
  sanitizeUserTranslation,
  USER_TRANSLATION_PROMPT_VERSION,
  USER_TRANSLATION_TEXT_MAX,
  UserTranslationInputError,
  type UserTranslationResponse,
} from '../prompts/userTranslation'
import { cancelledError, isAbortError } from './requestCancel'

export interface LessonTranslationBody {
  /** 정리(`sanitizeText` 여러 줄)를 마친 1~1,000 코드포인트 글. */
  text: string
}

export interface LessonTranslationDeps {
  learnerLevel(userId: string): Promise<string>
  complete(req: LlmJsonRequest<UserTranslationResponse>): Promise<LlmJsonResult<UserTranslationResponse>>
  trace(t: TraceRecord): Promise<void>
}

/** DB·LLM 경계 — 시험은 `mock.method(lessonTranslationDeps, …)` 또는 인자로 가짜를 넘긴다. */
export const lessonTranslationDeps: LessonTranslationDeps = {
  learnerLevel: async (userId) => (await getProfile(userId)).level,
  complete: (req) => llm.completeJson<UserTranslationResponse>(req),
  trace: (t) => recordTrace(t),
}

const FAIL_MESSAGE = '번역을 가져오지 못했어요. 다시 시도해 주세요.'
const STEP = 'USER_TRANSLATION'

const invalid = (field: string, reason: string, message: string) => new ApiError('VALIDATION', message, { field, reason })

/** #185 본문 `{text}` → 400(LLM·DB 전). 모르는 키 `unknown_key` · 없음/공백뿐 `required` · 글이 아님 `type` · 1,000자 초과 `max_length`. */
export function readLessonTranslationBody(body: Record<string, unknown>): LessonTranslationBody {
  if (Object.keys(body).some((k) => k !== 'text')) throw invalid('body', 'unknown_key', '넣을 수 없는 항목이 있어요.')
  const raw = body.text
  if (raw === undefined || raw === null) throw invalid('text', 'required', '번역할 말이 없어요.')
  if (typeof raw !== 'string') throw invalid('text', 'type', '번역할 말은 글이어야 해요.')
  const text = sanitizeText(raw, { multiline: true })
  const n = codePointLength(text)
  if (n < 1) throw invalid('text', 'required', '번역할 말이 없어요.')
  if (n > USER_TRANSLATION_TEXT_MAX) throw invalid('text', 'max_length', `번역할 말은 ${USER_TRANSLATION_TEXT_MAX.toLocaleString('en-US')}자까지예요.`)
  return { text }
}

const inFlight = new Set<string>()

function buildRequest(text: string, level: string): LlmJsonRequest<UserTranslationResponse> {
  try {
    return buildUserTranslationRequest({ text, level })
  } catch (e) {
    if (e instanceof UserTranslationInputError) throw invalid('text', 'text_length', e.userMessage)
    throw e
  }
}

/**
 * 레슨 말하기에서 내가 한 말 → 한국어 뜻 `{ko}`. 호출자(라우트)가 레슨 소유를 먼저 확인한다 — `lessonId` 는 Trace 상관용으로만 쓴다.
 * 오류: 409 `TRANSLATION_BUSY`(이 입구의 사용자당 동시 1건)·`CANCELLED` · 502 `TRANSLATION_REJECTED`(정리에서 버려짐) · 엔진 오류는 #32t 와 같이
 * 그대로 던져 `withApi` 가 502 `ENGINE_ERROR`·504 `ENGINE_TIMEOUT`·422 `ENGINE_UNAVAILABLE` 로 바꾼다. 실패해도 잠금은 풀린다.
 */
export async function translateLessonSpeech(
  userId: string,
  lessonId: string,
  body: LessonTranslationBody,
  deps: LessonTranslationDeps = lessonTranslationDeps,
  signal?: AbortSignal,
): Promise<LessonSpeakingTranslation> {
  if (inFlight.has(userId)) throw new ApiError('CONFLICT', '번역을 가져오는 중이에요.', { reason: 'TRANSLATION_BUSY' })
  inFlight.add(userId)
  try {
    const req = buildRequest(body.text, await deps.learnerLevel(userId))
    return await runTranslation(userId, lessonId, body.text, req, deps, signal)
  } finally {
    inFlight.delete(userId)
  }
}

async function runTranslation(
  userId: string,
  lessonId: string,
  text: string,
  req: LlmJsonRequest<UserTranslationResponse>,
  deps: LessonTranslationDeps,
  signal?: AbortSignal,
): Promise<LessonSpeakingTranslation> {
  const traceId = newTraceId()
  const started = Date.now()
  const textChars = codePointLength(text)
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    let r: LlmJsonResult<UserTranslationResponse>
    try {
      r = await deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })
    } catch (e) {
      // 이름만으로 취소로 보지 않는다 — 실어 보낸 신호가 실제로 끊겼을 때만(어댑터 자체 타이머의 AbortError 가 504·502 대신 409 로 둔갑하지 않게).
      if (signal?.aborted === true && isAbortError(e)) {
        errorCode = 'CANCELLED'
        steps.push({ name: STEP, ms: Date.now() - started, textChars, errorCode })
        throw cancelledError()
      }
      steps.push({ name: STEP, ms: Date.now() - started, textChars, errorCode: classifyError(e).code })
      throw e
    }
    const ko = sanitizeUserTranslation(text, r.data)
    steps.push({
      name: STEP,
      ms: Date.now() - started,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      promptVersion: USER_TRANSLATION_PROMPT_VERSION,
      textChars,
      koChars: ko ? codePointLength(ko) : 0,
      result: ko ? 'OK' : 'REJECTED',
    })
    if (!ko) throw new ApiError('ENGINE_ERROR', FAIL_MESSAGE, { reason: 'TRANSLATION_REJECTED' })
    return { ko }
  } catch (e) {
    status = 'ERROR'
    errorCode ??= classifyError(e).code
    throw e
  } finally {
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'lessonTranslation', refId: lessonId }).catch(() => undefined)
  }
}
