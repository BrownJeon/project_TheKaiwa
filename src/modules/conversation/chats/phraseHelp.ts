/**
 * 회화방 일본어 도우미(task-056 IMP-0030, #180 `POST /api/v1/chats/:id/phrase-help {queryKo}`, `phraseHelp@v1`) — **저장 없음**(행·StudyLog·스냅샷·단어장 0).
 *
 * - 소유: 대화는 `(id, userId)` 로만 찾는다(`readPracticeChat`). 남의 대화·없는 대화·`kind !== 'TALK'` 는 404(존재를 숨긴다).
 *   일반 회화방·역할극 방 공통 — 상황이 없어도 된다(#169 와 다른 점).
 * - 판정 순서(LLM 전, 쿼리만): 마친 역할극 409 `ENDED`(`Chat.endedAt` 또는 끝낸 표식) → 사용자당 동시 1건 409 `PHRASE_BUSY`.
 *   턴 진행 중 409 `TURN_RUNNING` 은 두지 않는다(Leader 결정 — 도우미는 방 상태에 의존하지 않는다).
 * - 맥락: 수준 = 대화 수준(없으면 프로필) · 장면 = 역할극 방이고 상황 재료를 읽을 수 있을 때만 역할·목표 한 줄.
 *   재료가 없거나 읽기가 실패해도 404 로 막지 않고 **장면 없이 진행**한다(Trace 에 `scene` 코드만 남긴다).
 * - 결과: `OK` → 표현 1~3개 · `NOT_A_PHRASE`·`UNSAFE`·`TOO_LONG` → 빈 목록(200, 사유를 구분해 알리지 않는다 — 우회 시도를 돕지 않게) ·
 *   `INVALID` → 502 · 엔진 오류·사용 불가(422→502)·시간 초과(504)는 `engineFailure` 한 갈래.
 * - 손님이 끊으면(`signal`) 엔진 호출을 멈추고 분류된 409 `CANCELLED` 로 조용히 끝낸다(500·오류 로그 없음, Trace 에는 `CANCELLED` 코드만).
 *   잠금(`PHRASE_BUSY`)은 `finally` 가 푼다 — 엔진이 실행 중이면 abort 즉시 거절되어 바로 풀리고, 큐에서 차례를 기다리는 중이면 차례가 올 때(앞선 호출이 끝난 뒤) 풀린다.
 *   큐 대기분은 수용한 한계다: 재시도도 같은 큐 뒤에 서므로 기다리는 시간은 같다.
 * - Trace 에는 코드·수치만(`phraseHelpTrace`) — 질의·표현·뜻·이유 원문 0.
 */
import { ApiError, classifyError } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { isScenarioRolePlayEnded, readScenarioRolePlayMaterial, type ScenarioRolePlayMaterial } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import { buildPhraseHelpRequest, finalizePhraseHelp, PhraseHelpInputError, type PhraseHelpInput, type PhraseHelpScene } from '../prompts/phraseHelp'
import { parsePhraseHelpBody, phraseHelpItems, phraseHelpTrace, type PhraseHelpBody, type PhraseHelpItem, type PhraseHelpResponse } from '../structuredResponse/phraseHelp'
import { notFoundChat } from './index'
import { cancelledError, isAbortError } from './requestCancel'
import { engineFailure, readPracticeChat, type PracticeChatRow } from './replyPractice'

export interface PhraseHelpResult {
  items: PhraseHelpItem[]
}

/** Trace 용 장면 코드 — 일반 회화방(NONE) · 장면 붙음(OK) · 상황 재료 없음(MISSING) · 읽기 실패(ERROR). */
export type PhraseHelpSceneCode = 'NONE' | 'OK' | 'MISSING' | 'ERROR'

export interface PhraseHelpDeps {
  readChat(userId: string, chatId: string): Promise<PracticeChatRow | null>
  isEnded(userId: string, chat: { id: string; createdAt: Date }): Promise<boolean>
  readMaterial(userId: string, scenarioId: string): Promise<ScenarioRolePlayMaterial | null>
  learnerLevel(userId: string): Promise<string>
  complete(req: LlmJsonRequest<PhraseHelpResponse>): Promise<LlmJsonResult<PhraseHelpResponse>>
  trace(t: TraceRecord): Promise<void>
}

/** `db` 는 시험이 소유 조회 배선(대화는 `(id, userId)` 로만 찾는다)을 가짜 db 로 고정하려고 받는다 — 생략하면 `readPracticeChat` 기본(실 DB). */
export function createPhraseHelpDeps(db?: Parameters<typeof readPracticeChat>[2]): PhraseHelpDeps {
  return {
    readChat: (userId, chatId) => readPracticeChat(userId, chatId, db),
    isEnded: (userId, chat) => isScenarioRolePlayEnded(userId, chat),
    readMaterial: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
    learnerLevel: async (userId) => (await getProfile(userId)).level,
    complete: (req) => llm.completeJson<PhraseHelpResponse>(req),
    trace: (t) => recordTrace(t),
  }
}

export const phraseHelpDeps: PhraseHelpDeps = createPhraseHelpDeps()

export const PHRASE_HELP_FAIL_MESSAGE = '일본어 표현을 만들지 못했어요. 다시 시도해 주세요.'

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40

/** #180 본문 — `parsePhraseHelpBody` 의 첫 문제를 400 으로(LLM·DB 전). 화면은 `message` 를 안내 줄에 그대로 보인다. */
export function readPhraseHelpBody(raw: unknown): PhraseHelpBody {
  const r = parsePhraseHelpBody(raw)
  if (r.ok) return r.value
  const p = r.problems[0]
  throw new ApiError('VALIDATION', p.message, { field: p.field, reason: p.reason })
}

/** 상황 재료 → 장면 한 줄 재료(역할·목표). 정리·상한은 프롬프트 모듈이 건다. */
export function phraseHelpScene(m: Pick<ScenarioRolePlayMaterial, 'roles' | 'goal'>): PhraseHelpScene {
  return { learnerRole: m.roles?.learner ?? null, partnerRole: m.roles?.tutor ?? null, goalKo: m.goal?.communicativeGoalKo ?? null }
}

async function readScene(userId: string, scenarioId: string | null, deps: PhraseHelpDeps): Promise<{ scene: PhraseHelpScene | null; code: PhraseHelpSceneCode }> {
  if (!scenarioId) return { scene: null, code: 'NONE' }
  try {
    const m = await deps.readMaterial(userId, scenarioId)
    return m ? { scene: phraseHelpScene(m), code: 'OK' } : { scene: null, code: 'MISSING' }
  } catch (e) {
    // 도우미는 장면 없이도 같은 계약으로 동작한다 — 읽기 실패로 막지 않는다(오류 이름만, 원문·쿼리 값 없음).
    console.warn('[phraseHelp] 장면 재료 읽기 실패 — 장면 없이 진행:', e instanceof Error ? e.name : 'unknown')
    return { scene: null, code: 'ERROR' }
  }
}

const conflict = (message: string, reason: 'ENDED' | 'PHRASE_BUSY') => new ApiError('CONFLICT', message, { reason })

const inFlight = new Set<string>()

/**
 * `signal` = 라우트 `req.signal`. 손님이 끊으면(화면 12초 시간 초과·방 이탈) 큐 대기 중인 호출은 시작하지 않고 실행 중인 호출은 멈춘다.
 * 잠금은 `finally` 가 푼다: 실행 중이면 abort 즉시, 큐 대기 중이면 차례가 올 때(앞선 호출이 끝난 뒤). 재시도도 같은 큐 뒤에 서므로 수용한 한계.
 */
export async function helpPhrase(userId: string, chatId: string, body: PhraseHelpBody, deps: PhraseHelpDeps = phraseHelpDeps, signal?: AbortSignal): Promise<PhraseHelpResult> {
  if (!validId(chatId)) throw notFoundChat()
  const chat = await deps.readChat(userId, chatId)
  if (!chat || chat.kind !== 'TALK') throw notFoundChat()
  const ended = chat.endedAt ? true : chat.scenarioId ? await deps.isEnded(userId, { id: chat.id, createdAt: chat.createdAt }) : false
  if (ended) throw conflict('마친 역할극이에요.', 'ENDED')

  if (inFlight.has(userId)) throw conflict('일본어 표현을 찾는 중이에요.', 'PHRASE_BUSY')
  inFlight.add(userId)
  try {
    const [level, sceneRead] = await Promise.all([chat.level ? Promise.resolve<string>(chat.level) : deps.learnerLevel(userId), readScene(userId, chat.scenarioId, deps)])
    // `finalizePhraseHelp` 에 요청을 만든 **같은 객체**를 다시 넘긴다(질의 정리·로마자 대조가 재시도 검사와 같은 값이어야 한다).
    const input: PhraseHelpInput = { queryKo: body.queryKo, level, scene: sceneRead.scene }
    let req: LlmJsonRequest<PhraseHelpResponse>
    try {
      req = buildPhraseHelpRequest(input)
    } catch (e) {
      if (e instanceof PhraseHelpInputError) throw new ApiError('VALIDATION', e.userMessage, { field: 'queryKo', reason: 'required' })
      throw e
    }
    return await runPhraseHelp(userId, chatId, input, req, sceneRead.code, deps, signal)
  } finally {
    inFlight.delete(userId)
  }
}

async function runPhraseHelp(
  userId: string,
  chatId: string,
  input: PhraseHelpInput,
  req: LlmJsonRequest<PhraseHelpResponse>,
  scene: PhraseHelpSceneCode,
  deps: PhraseHelpDeps,
  signal?: AbortSignal,
): Promise<PhraseHelpResult> {
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    let r: LlmJsonResult<PhraseHelpResponse>
    try {
      r = await deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })
    } catch (e) {
      // 이름만으로 취소로 보지 않는다: 요청에 실어 보낸 신호가 실제로 abort 됐을 때만. 어댑터가 자기 타이머로 만든 AbortError 가 새도 진짜 오류(504·502)가 로그 없는 409 로 둔갑하지 않게.
      if (signal?.aborted === true && isAbortError(e)) {
        steps.push({ name: 'PHRASE_HELP', ms: Date.now() - started, errorCode: 'CANCELLED' })
        errorCode = 'CANCELLED'
        throw cancelledError()
      }
      steps.push({ name: 'PHRASE_HELP', ms: Date.now() - started, errorCode: classifyError(e).code })
      throw engineFailure(e, PHRASE_HELP_FAIL_MESSAGE)
    }
    const fin = finalizePhraseHelp(r.data, input)
    steps.push({
      name: 'PHRASE_HELP',
      ms: Date.now() - started,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      scene,
      ...phraseHelpTrace(fin),
    })
    if (fin.status === 'INVALID') throw new ApiError('ENGINE_ERROR', PHRASE_HELP_FAIL_MESSAGE, { reason: 'PHRASE_INVALID' })
    return { items: phraseHelpItems(fin) }
  } catch (e) {
    status = 'ERROR'
    errorCode ??= classifyError(e).code
    throw e
  } finally {
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'phraseHelp', refId: chatId }).catch(() => undefined)
  }
}
