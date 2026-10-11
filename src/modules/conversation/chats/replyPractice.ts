/**
 * 역할극 대답 연습(task-010d A3b-2, #169 `POST /api/v1/chats/:id/reply-practice {messageId}`, 가이드 S10) — **저장 없음**(행·StudyLog·관측 0).
 *
 * - 소유: 대화는 `(id, userId)` 로만 찾는다. 남의 대화·없는 대화·역할극이 아닌 대화(TALK 아님·상황 없음)·상황 행이 사라진 대화는 404(존재를 숨긴다).
 * - 판정 순서(LLM 전, 쿼리만): 마친 역할극 409 `ENDED` → 그 방 턴 진행 중 409 `TURN_RUNNING` → `messageId` 가 그 대화의 **마지막 메시지이자 DONE 선생님 말**이
 *   아니면 409 `NOT_LATEST`(화면 표시 조건 "마지막 메시지가 DONE 선생님 말"과 같은 규칙).
 * - 재료: 수준 = 대화 수준(턴 헤더와 같은 값, 없으면 프로필) · 상황 역할·목표·순서·핵심 표현(아직 안 쓴 것부터 — 코드 표현 확인과 같은 함수) ·
 *   마지막 선생님 말 · 그 앞의 끝난 대화(시간순). `stepIndex` 는 진행 값과 같이 늘 null(`rolePlay.ts` 진행 값 주석).
 * - 엔진 `replyPractice`(fast·12s·재시도 없음) → `finalizeReplyPracticeResponse`. `ok:false`·엔진 오류·시간 초과는 5xx(`pr-error`) — 엔진 사용 불가(422)도
 *   5xx 로 바꾼다(화면은 422 를 다른 뜻으로 읽지 않지만 계약상 0/5xx 한 갈래).
 * - Trace 에는 수치·코드만(문장·보기·힌트·학습자 말 원문 0). 사용자당 동시 1건(프로세스 메모리) — 연타가 단일 슬롯을 두 번 잡지 않게.
 * - 손님이 끊으면(`signal` = 라우트 `req.signal`, task-058) 엔진 호출을 멈추고 분류된 409 `CANCELLED` 로 조용히 끝낸다(500·오류 로그 없음, Trace 에는 `CANCELLED` 코드만).
 *   잠금(`PRACTICE_BUSY`)은 `finally` 가 푼다 — 엔진이 실행 중이면 abort 즉시 거절되어 바로 풀리고, 큐에서 차례를 기다리는 중이면 차례가 올 때(앞선 호출이 끝난 뒤) 풀린다.
 *   큐 대기분은 수용한 한계다: 재시도도 같은 큐 뒤에 서므로 기다리는 시간은 같다.
 */
import type { ChatKind, JlptLevel } from '@prisma/client'
import { ApiError, classifyError, prisma, type Tx } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import { detectScenarioExpressions, isScenarioRolePlayEnded, readScenarioRolePlayMaterial, type ScenarioRolePlayMaterial } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import { buildReplyPracticeRequest, finalizeReplyPracticeResponse, REPLY_PRACTICE_LIMITS, ReplyPracticeInputError, type ReplyPracticeTurn } from '../prompts/replyPractice'
import { checkReplyPracticeShape, dropChoiceSet, type ReplyPracticeModel, type ReplyPracticeSuggestion } from '../structuredResponse/replyPractice'
import { currentTurnLock, isMessageLocallyRunning, isStalePending } from '../orchestrator/locks'
import { notFoundChat } from './index'
import { cancelledError, isAbortError } from './requestCancel'
import { loadRolePlayLearnerTexts } from './rolePlay'

/** 마지막 메시지 판정·이전 대화에 읽는 최근 메시지 수(이전 대화는 프롬프트가 4턴만 싣는다 — 실패·진행 행이 끼어도 남도록 여유). */
export const REPLY_PRACTICE_WINDOW = 12

export interface ReplyPracticeResult extends ReplyPracticeSuggestion {
  messageId: string
}

export interface PracticeChatRow {
  id: string
  kind: ChatKind
  level: JlptLevel | null
  scenarioId: string | null
  createdAt: Date
  /** `Chat.endedAt`(task-048) — 있으면 관측 조회 없이 마친 역할극. */
  endedAt?: Date | null
}

export interface PracticeMessageRow {
  id: string
  role: 'USER' | 'ASSISTANT'
  status: 'PENDING' | 'DONE' | 'FAILED'
  content: string
  createdAt: Date
}

export interface ReplyPracticeDeps {
  readChat(userId: string, chatId: string): Promise<PracticeChatRow | null>
  /** 최근 메시지 `REPLY_PRACTICE_WINDOW` 개 — **새것부터**(createdAt desc, id desc). */
  recentMessages(userId: string, chatId: string): Promise<PracticeMessageRow[]>
  /** 이 프로세스가 그 방 턴의 메모리 락을 쥐고 수락 커밋을 기다리는 중인가(PENDING 행이 생기기 전 구간). */
  turnLocked(userId: string, chatId: string): boolean
  isEnded(userId: string, chat: { id: string; createdAt: Date }): Promise<boolean>
  readMaterial(userId: string, scenarioId: string): Promise<ScenarioRolePlayMaterial | null>
  learnerTexts(userId: string, chatId: string): Promise<string[]>
  learnerLevel(userId: string): Promise<string>
  complete(req: LlmJsonRequest<ReplyPracticeModel>): Promise<LlmJsonResult<ReplyPracticeModel>>
  trace(t: TraceRecord): Promise<void>
}

/** 대화는 `(id, userId)` 로만 읽는다(남의 대화 = null → 404). `db` 는 시험이 소유 조건을 가짜 db 로 고정하려고 받는다(REV-142 L-1). */
export function readPracticeChat(userId: string, chatId: string, db: Pick<Tx, 'chat'> = prisma): Promise<PracticeChatRow | null> {
  return db.chat.findFirst({ where: { id: chatId, userId }, select: { id: true, kind: true, level: true, scenarioId: true, createdAt: true, endedAt: true } })
}

/** 그 대화의 최근 메시지 — 본인 행만(`userId`), 새것부터. */
export function readPracticeMessages(userId: string, chatId: string, db: Pick<Tx, 'chatMessage'> = prisma): Promise<PracticeMessageRow[]> {
  return db.chatMessage.findMany({
    where: { chatId, userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: REPLY_PRACTICE_WINDOW,
    select: { id: true, role: true, status: true, content: true, createdAt: true },
  })
}

export const replyPracticeDeps: ReplyPracticeDeps = {
  readChat: (userId, chatId) => readPracticeChat(userId, chatId),
  recentMessages: (userId, chatId) => readPracticeMessages(userId, chatId),
  turnLocked: (userId, chatId) => currentTurnLock(userId)?.chatId === chatId,
  isEnded: (userId, chat) => isScenarioRolePlayEnded(userId, chat),
  readMaterial: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
  learnerTexts: (userId, chatId) => loadRolePlayLearnerTexts(userId, chatId),
  learnerLevel: async (userId) => (await getProfile(userId)).level,
  complete: (req) => llm.completeJson<ReplyPracticeModel>(req),
  trace: (t) => recordTrace(t),
}

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40

/** #169 본문 — `{messageId}` 하나뿐(그 밖 키 400). */
export function parseReplyPracticeBody(body: Record<string, unknown>): { messageId: string } {
  for (const k of Object.keys(body)) if (k !== 'messageId') throw new ApiError('VALIDATION', `넣을 수 없는 항목이에요: ${k}`, { field: k, reason: 'unknown_key' })
  if (!validId(body.messageId)) throw new ApiError('VALIDATION', 'messageId 형식이 올바르지 않습니다.', { field: 'messageId', reason: 'id' })
  return { messageId: body.messageId }
}

const conflict = (message: string, reason: 'ENDED' | 'TURN_RUNNING' | 'NOT_LATEST' | 'PRACTICE_BUSY') => new ApiError('CONFLICT', message, { reason })

/** 그 방에 살아 있는 턴이 있는가 — 메모리 락(수락 커밋 전) 또는 살아 있는 PENDING 선생님 행(180초 넘은 죽은 행·다른 프로세스 고아 행 제외, 턴 수락과 같은 판정). */
export function practiceTurnRunning(rows: readonly PracticeMessageRow[], locked: boolean, now: number = Date.now()): boolean {
  if (locked) return true
  return rows.some((r) => r.role === 'ASSISTANT' && r.status === 'PENDING' && !isStalePending(r.createdAt, now, isMessageLocallyRunning(r.id)))
}

/** 대답할 선생님 말 — 그 대화의 마지막 메시지가 `messageId` 이고 DONE 선생님 말일 때만. 아니면 null(→ 409 `NOT_LATEST`). */
export function latestTutorMessage(rows: readonly PracticeMessageRow[], messageId: string): PracticeMessageRow | null {
  const newest = rows[0]
  return newest && newest.id === messageId && newest.role === 'ASSISTANT' && newest.status === 'DONE' && newest.content.trim() ? newest : null
}

/** 그 선생님 말 **앞** 대화 — 끝난(DONE) 메시지만, 시간순, 최근 `recentTurns` 개. */
export function practiceRecent(rows: readonly PracticeMessageRow[]): ReplyPracticeTurn[] {
  return rows
    .slice(1)
    .filter((r) => r.status === 'DONE' && r.content.trim())
    .slice(0, REPLY_PRACTICE_LIMITS.recentTurns)
    .reverse()
    .map((r) => ({ role: r.role === 'USER' ? 'learner' : 'tutor', text: r.content }))
}

/** 핵심 표현 — 아직 학습자가 쓰지 않은 것부터(같은 무리 안은 상황 순서), 최대 `expressions` 개. */
export function practiceExpressions(material: Pick<ScenarioRolePlayMaterial, 'expressions'>, learnerTexts: readonly string[]): { ja: string; ko: string | null }[] {
  const used = new Set(detectScenarioExpressions(learnerTexts, material.expressions))
  const ordered = [...material.expressions.filter((e) => !used.has(e.id)), ...material.expressions.filter((e) => used.has(e.id))]
  return ordered.slice(0, REPLY_PRACTICE_LIMITS.expressions).map((e) => ({ ja: e.textJa, ko: e.meaningKo }))
}

/** 엔진 오류 → 5xx 한 갈래. 사용 불가(422)는 502 로 바꾼다 — 시간 초과(504)·엔진 오류(502)는 그대로. */
export function engineFailure(e: unknown, message: string): unknown {
  if (e instanceof ApiError) return e
  const c = classifyError(e)
  if (c.code === 'ENGINE_UNAVAILABLE') return new ApiError('ENGINE_ERROR', message, { reason: 'ENGINE_UNAVAILABLE' })
  return e
}

const inFlight = new Set<string>()

export async function suggestReply(userId: string, chatId: string, messageId: string, deps: ReplyPracticeDeps = replyPracticeDeps, signal?: AbortSignal): Promise<ReplyPracticeResult> {
  if (!validId(chatId)) throw notFoundChat()
  if (!validId(messageId)) throw new ApiError('VALIDATION', 'messageId 형식이 올바르지 않습니다.', { field: 'messageId', reason: 'id' })
  const chat = await deps.readChat(userId, chatId)
  if (!chat || chat.kind !== 'TALK' || !chat.scenarioId) throw notFoundChat()
  const scenarioId = chat.scenarioId
  const [ended, rows] = await Promise.all([chat.endedAt ? true : deps.isEnded(userId, { id: chat.id, createdAt: chat.createdAt }), deps.recentMessages(userId, chatId)])
  if (ended) throw conflict('마친 역할극이에요.', 'ENDED')
  if (practiceTurnRunning(rows, deps.turnLocked(userId, chatId))) throw conflict('선생님 말이 끝나면 다시 눌러 주세요.', 'TURN_RUNNING')
  const target = latestTutorMessage(rows, messageId)
  if (!target) throw conflict('새 말이 와서 연습을 닫았어요.', 'NOT_LATEST')
  const [material, texts, level] = await Promise.all([
    deps.readMaterial(userId, scenarioId),
    deps.learnerTexts(userId, chatId),
    chat.level ? Promise.resolve<string>(chat.level) : deps.learnerLevel(userId),
  ])
  if (!material) throw notFoundChat()

  let req: LlmJsonRequest<ReplyPracticeModel>
  try {
    req = buildReplyPracticeRequest({
      level,
      scenario: { roles: material.roles, goalKo: material.goal.communicativeGoalKo, steps: material.steps, stepIndex: null, expressions: practiceExpressions(material, texts) },
      lastTutorJa: target.content,
      recent: practiceRecent(rows),
    })
  } catch (e) {
    if (e instanceof ReplyPracticeInputError) throw conflict('새 말이 와서 연습을 닫았어요.', 'NOT_LATEST')
    throw e
  }

  if (inFlight.has(userId)) throw conflict('대답 연습을 만드는 중이에요.', 'PRACTICE_BUSY')
  inFlight.add(userId)
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    let r: LlmJsonResult<ReplyPracticeModel>
    try {
      r = await deps.complete({ ...req, traceId, ...(signal ? { signal } : {}) })
    } catch (e) {
      // 이름만으로 취소로 보지 않는다: 요청에 실어 보낸 신호가 실제로 abort 됐을 때만. 어댑터가 자기 타이머로 만든 AbortError 가 새도 진짜 오류(504·502)가 로그 없는 409 로 둔갑하지 않게.
      if (signal?.aborted === true && isAbortError(e)) {
        steps.push({ name: 'REPLY_PRACTICE', ms: Date.now() - started, errorCode: 'CANCELLED' })
        errorCode = 'CANCELLED'
        throw cancelledError()
      }
      steps.push({ name: 'REPLY_PRACTICE', ms: Date.now() - started, errorCode: classifyError(e).code })
      throw engineFailure(e, '대답 연습을 만들지 못했어요. 다시 시도해 주세요.')
    }
    const fin = finalizeReplyPracticeResponse(r.data)
    const reshaped = fin.suggestion && checkReplyPracticeShape(fin.suggestion).length > 0
    steps.push({
      name: 'REPLY_PRACTICE',
      ms: Date.now() - started,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      ok: fin.ok,
      choiceSetDropped: fin.choiceSetDropped,
      hintDropped: fin.hintDropped,
      shapeDropped: reshaped === true,
    })
    if (!fin.ok || !fin.suggestion) throw new ApiError('ENGINE_ERROR', '대답 연습을 만들지 못했어요. 다시 시도해 주세요.', { reason: 'PRACTICE_REJECTED' })
    const suggestion = reshaped ? dropChoiceSet(fin.suggestion) : fin.suggestion
    return { messageId: target.id, ...suggestion }
  } catch (e) {
    status = 'ERROR'
    errorCode ??= classifyError(e).code
    throw e
  } finally {
    inFlight.delete(userId)
    void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'replyPractice', refId: chatId }).catch(() => undefined)
  }
}
