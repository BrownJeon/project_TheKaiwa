/**
 * 턴 오케스트레이터(api-contract #32, bjj `masterChat.runTurn` 이식) — 수락(사용자 행·PENDING 강사 행 저장) → PROMPT → LLM → PARSE →
 * 저장 → `done`. 수락 전 실패(404·409·400)는 호출자에게 던지고(라우트가 봉투로), 수락 뒤 실패는 강사 행 FAILED + `error` 이벤트.
 *
 * 사용자당 턴 1(Q1):
 *   ① 메모리 락(이 프로세스) — 같은 사용자의 두 번째 요청은 즉시 409.
 *   ② 수락 트랜잭션에서 **사용자 행 `FOR UPDATE`** 로 직렬화한 뒤(여러 채팅·blue/green 두 프로세스 공통 지점) 채팅 행 `FOR UPDATE`,
 *      사용자의 PENDING 강사 메시지를 본다: 살아 있으면 409 `{runningMessageId}`, 180초 넘은 죽은 행은 그 자리에서 FAILED.
 * 끊김(§0-9): 처리는 SSE 연결과 무관한 promise 에서 끝까지 돈다(TurnStream 이 이벤트를 버퍼링). 락은 저장이 끝난 뒤, `done` 을
 * 보내기 **전**에 푼다 — 클라이언트가 `done` 직후 보낸 다음 턴이 409 를 받지 않게.
 * 저장은 `(id, status=PENDING, createdAt=pendingSince)` 조건부 — 죽은 턴으로 정리됐거나 재실행으로 넘어간 행을 늦게 끝난 턴이 덮지 못한다.
 */
import { Prisma, type ChatKind, type InputSource, type JlptLevel } from '@prisma/client'
import { ApiError, classifyError, dates, lockUserRow, prisma, withTransaction } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type TraceStep } from '@/modules/engine'
import { buildChatRequest } from '../prompts/chat'
import { buildTalkRequest } from '../prompts/talk'
import type { TutorResponse } from '../structuredResponse/schemas'
import { buildLearnerHeader, loadHistoryBefore } from '../turnContext'
import { chatPreview, notFoundChat } from '../chats'
import type { TurnRequest } from '../chats/validate'
import { proposalExpiresAt } from '../proposals'
import { currentTurnLock, isMessageLocallyRunning, isStalePending, releaseTurnLock, tryAcquireTurnLock, type TurnLock } from './locks'
import { isRetryableTurnError, shapeTurnResponse, turnErrorMessage, type ShapedTurn } from './shape'
import { TurnStream, type TurnListener } from './stream'

export interface TurnAccepted {
  userMessageId: string
  assistantMessageId: string
  traceId: string
}

export interface TurnHandle {
  accepted: TurnAccepted
  /** 지난 이벤트부터 받는다. 턴이 끝나면 풀린다. */
  subscribe(listener: TurnListener): Promise<void>
  /** 저장·이벤트까지 끝나면 풀린다(연결과 무관). */
  done: Promise<void>
}

function turnConflict(runningMessageId: string | null): ApiError {
  return new ApiError('CONFLICT', '이미 답을 기다리는 중이에요.', { runningMessageId })
}

interface AcceptedTurn {
  chatId: string
  kind: ChatKind
  level: JlptLevel | null
  userMessage: { id: string; content: string; createdAt: Date; inputSource: InputSource | null }
  assistantMessageId: string
  pendingSince: Date
  traceId: string
}

const USER_MESSAGE_SELECT = { id: true, content: true, createdAt: true, inputSource: true } as const

async function acceptTurn(userId: string, chatId: string, req: TurnRequest): Promise<AcceptedTurn> {
  return withTransaction(async (tx) => {
    const now = Date.now()
    await lockUserRow(tx, userId)
    const rows = await tx.$queryRaw<{ id: string; userId: string; kind: ChatKind; level: JlptLevel | null }[]>`SELECT id, userId, kind, level FROM Chat WHERE id = ${chatId} FOR UPDATE`
    const chat = rows[0]
    if (!chat || chat.userId !== userId) throw notFoundChat()
    if (chat.kind === 'ASK') throw new ApiError('FEATURE_NOT_READY', '무엇이든 물어보기는 아직 준비 중이에요.')

    const pendings = await tx.chatMessage.findMany({ where: { userId, role: 'ASSISTANT', status: 'PENDING' }, select: { id: true, createdAt: true } })
    const stale = pendings.filter((p) => isStalePending(p.createdAt, now, isMessageLocallyRunning(p.id)))
    const live = pendings.find((p) => !stale.includes(p))
    if (live) throw turnConflict(live.id)
    if (stale.length) await tx.chatMessage.updateMany({ where: { id: { in: stale.map((p) => p.id) }, status: 'PENDING' }, data: { status: 'FAILED' } })

    const traceId = newTraceId()
    const base = { chatId, kind: chat.kind, level: chat.level, traceId }

    if (req.resume) {
      // D1: 마지막 강사 메시지가 FAILED(방금 정리된 죽은 PENDING 포함)면 그 앞 사용자 메시지로 다시 돈다. 살아 있는 PENDING 은 위에서 409.
      const last = await tx.chatMessage.findFirst({ where: { chatId, role: 'ASSISTANT' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, status: true, createdAt: true } })
      if (!last || last.status !== 'FAILED') throw new ApiError('CONFLICT', '다시 받을 답이 없어요.', { status: last?.status ?? null })
      const user = await tx.chatMessage.findFirst({
        where: { chatId, role: 'USER', OR: [{ createdAt: { lt: last.createdAt } }, { createdAt: last.createdAt, id: { lt: last.id } }] },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: USER_MESSAGE_SELECT,
      })
      if (!user) throw new ApiError('CONFLICT', '다시 받을 답이 없어요.', { status: last.status })
      // createdAt 을 지금으로 — 이 값이 이번 실행의 표식(pendingSince)이자 stale 판정 기준이다.
      const pendingSince = new Date(now)
      const res = await tx.chatMessage.updateMany({
        where: { id: last.id, status: 'FAILED' },
        data: { status: 'PENDING', createdAt: pendingSince, content: '', reading: null, translation: null, toolLog: Prisma.DbNull, traceId },
      })
      if (res.count === 0) throw turnConflict(null)
      return { ...base, userMessage: user, assistantMessageId: last.id, pendingSince }
    }

    // 사용자·강사 행의 createdAt 을 1ms 벌려 정렬이 id 에 기대지 않게 한다.
    const createdAt = new Date(now)
    const pendingSince = new Date(now + 1)
    const user = await tx.chatMessage.create({
      data: { chatId, userId, role: 'USER', content: req.text, inputSource: req.inputSource, status: 'DONE', createdAt },
      select: USER_MESSAGE_SELECT,
    })
    const assistant = await tx.chatMessage.create({
      data: { chatId, userId, role: 'ASSISTANT', content: '', status: 'PENDING', traceId, createdAt: pendingSince },
      select: { id: true },
    })
    // 행 수는 행을 만드는 트랜잭션에서 센다(실패 턴도 두 행이 남으므로 +2, 재실행은 +0).
    await tx.chat.update({ where: { id: chatId }, data: { messageCount: { increment: 2 }, lastMessageAt: createdAt, preview: chatPreview(req.text) } })
    return { ...base, userMessage: user, assistantMessageId: assistant.id, pendingSince }
  })
}

interface LlmMeta {
  model: string
  connection: string
  llmMs: number
  promptChars: number
  attempt: number
}

async function saveTurn(userId: string, a: AcceptedTurn, shaped: ShapedTurn, meta: LlmMeta & { totalMs: number }) {
  return withTransaction(async (tx) => {
    // 잠금 순서 통일(사용자 → 채팅 → 행): 다른 인스턴스의 수락 트랜잭션과 교착하지 않게 사용자 행부터 잡는다.
    await lockUserRow(tx, userId)
    const toolLog = {
      traceId: a.traceId,
      model: meta.model,
      connection: meta.connection,
      llmMs: meta.llmMs,
      promptChars: meta.promptChars,
      attempt: meta.attempt,
      totalMs: meta.totalMs,
      meta: { learning: shaped.learning, style: shaped.speech.style, endOfTopic: shaped.endOfTopic, warning: shaped.warning },
    }
    const res = await tx.chatMessage.updateMany({
      where: { id: a.assistantMessageId, status: 'PENDING', createdAt: a.pendingSince },
      data: { status: 'DONE', content: shaped.reply.replyJa, reading: shaped.reply.replyReading || null, translation: shaped.reply.replyKo || null, toolLog, traceId: a.traceId },
    })
    if (res.count === 0) throw new ApiError('CONFLICT', '대화가 바뀌어 답을 저장하지 못했어요.')

    let correction: { id: string; required: boolean; original: string; corrected: string; explanationKo: string; errorType: string; severity: string; chunkType: string | null; status: 'PROPOSED' } | null = null
    if (shaped.correction) {
      const c = shaped.correction
      const row = await tx.correction.create({
        data: { userId, chatId: a.chatId, messageId: a.userMessage.id, original: c.original, corrected: c.corrected, explanation: c.explanationKo, errorType: c.errorType, severity: c.severity, chunkType: c.chunkType },
        select: { id: true },
      })
      correction = { id: row.id, required: c.required, original: c.original, corrected: c.corrected, explanationKo: c.explanationKo, errorType: c.errorType, severity: c.severity, chunkType: c.chunkType, status: 'PROPOSED' }
    }
    const expiresAt = proposalExpiresAt()
    const proposals: { id: string; kind: 'ADD_WORD'; payload: TutorResponse['proposals'][number]['payload']; status: 'PROPOSED'; messageId: string }[] = []
    for (const p of shaped.proposals) {
      const row = await tx.tutorProposal.create({
        data: { userId, chatId: a.chatId, messageId: a.assistantMessageId, kind: 'ADD_WORD', payload: p.payload, expiresAt },
        select: { id: true },
      })
      proposals.push({ id: row.id, kind: 'ADD_WORD', payload: p.payload, status: 'PROPOSED', messageId: a.assistantMessageId })
    }
    await tx.chat.updateMany({ where: { id: a.chatId, userId }, data: { lastMessageAt: new Date(), preview: chatPreview(shaped.reply.replyJa) } })
    return { correction, proposals }
  })
}

async function markAssistantFailed(a: AcceptedTurn, errorCode: string): Promise<void> {
  try {
    await prisma.chatMessage.updateMany({
      where: { id: a.assistantMessageId, status: 'PENDING', createdAt: a.pendingSince },
      data: { status: 'FAILED', toolLog: { traceId: a.traceId, errorCode } },
    })
  } catch (e) {
    console.error('[turn] FAILED 기록 실패:', e instanceof Error ? e.message : String(e))
  }
}

async function processTurn(userId: string, a: AcceptedTurn, lock: TurnLock, stream: TurnStream, startedAt: number): Promise<void> {
  const steps: TraceStep[] = []
  const elapsed = () => Date.now() - startedAt
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseTurnLock(lock)
  }
  let trace: { status: 'OK' | 'ERROR'; errorCode: string | null } = { status: 'OK', errorCode: null }
  try {
    stream.emit({ event: 'status', data: { stage: 'PROMPT', elapsedMs: elapsed() } })
    let t = Date.now()
    const [learner, history] = await Promise.all([buildLearnerHeader(userId, a.level), loadHistoryBefore(a.chatId, a.userMessage)])
    const input = { todayKst: dates.todayKst(), learner, history, text: a.userMessage.content }
    const req = a.kind === 'TALK' ? buildTalkRequest(input) : buildChatRequest(input)
    steps.push({ name: 'PROMPT', ms: Date.now() - t })

    stream.emit({ event: 'status', data: { stage: 'LLM', elapsedMs: elapsed() } })
    t = Date.now()
    // softExtraCheck: 후검증 위반이 재시도 뒤에도 남으면 던지지 않고 아래에서 서버가 정리한다(CHAT 교정 null·TALK 원문 불일치 교정 버림).
    const r = await llm.completeJson<TutorResponse>({ ...req, softExtraCheck: true })
    const llmMs = Date.now() - t
    steps.push({ name: 'LLM', ms: llmMs, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars, residualViolations: r.residualViolations?.length ?? 0 })

    stream.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: elapsed() } })
    t = Date.now()
    const shaped = shapeTurnResponse(a.kind, a.userMessage.content, r.data)
    if (shaped.warning) stream.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: elapsed(), warning: shaped.warning } })
    const saved = await saveTurn(userId, a, shaped, { model: r.model, connection: r.connectionKey, llmMs, promptChars: r.promptChars, attempt: r.attempts ?? 1, totalMs: elapsed() })
    steps.push({ name: 'PARSE', ms: Date.now() - t })

    release()
    stream.emit({
      event: 'done',
      data: {
        userMessageId: a.userMessage.id,
        assistantMessageId: a.assistantMessageId,
        conversation: shaped.reply,
        correction: saved.correction,
        learning: shaped.learning,
        speech: shaped.speech,
        endOfTopic: shaped.endOfTopic,
        proposals: saved.proposals,
        audioCount: 0,
        traceId: a.traceId,
      },
    })
  } catch (e) {
    const c = classifyError(e)
    if (c.code === 'INTERNAL') console.error('[turn] 처리 실패:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    trace = { status: 'ERROR', errorCode: c.code }
    await markAssistantFailed(a, c.code)
    release()
    stream.emit({ event: 'error', data: { code: c.code, message: turnErrorMessage(c.code), traceId: a.traceId, retryable: isRetryableTurnError(c.code) } })
  } finally {
    release()
    stream.finish()
  }
  await recordTrace({ traceId: a.traceId, kind: 'TURN', userId, status: trace.status, steps, totalMs: elapsed(), errorCode: trace.errorCode, refType: 'chatMessage', refId: a.assistantMessageId })
}

/**
 * #32 턴 시작. 수락까지 기다려 돌려주고(그 전 실패는 던진다), 나머지는 백그라운드에서 끝까지 돈다.
 * 라우트는 `handle.subscribe` 를 SSE 에 연결하기만 한다 — 연결이 끊겨도 `handle.done` 은 저장까지 간다.
 */
export async function startTurn(input: { userId: string; chatId: string; request: TurnRequest }): Promise<TurnHandle> {
  if (typeof input.chatId !== 'string' || !input.chatId || input.chatId.length > 40) throw notFoundChat()
  const lock = tryAcquireTurnLock(input.userId, input.chatId)
  if (!lock) throw turnConflict(currentTurnLock(input.userId)?.assistantMessageId ?? null)
  const startedAt = Date.now()
  let accepted: AcceptedTurn
  try {
    accepted = await acceptTurn(input.userId, input.chatId, input.request)
  } catch (e) {
    releaseTurnLock(lock)
    throw e
  }
  lock.assistantMessageId = accepted.assistantMessageId
  const stream = new TurnStream()
  const acc: TurnAccepted = { userMessageId: accepted.userMessage.id, assistantMessageId: accepted.assistantMessageId, traceId: accepted.traceId }
  stream.emit({ event: 'accepted', data: acc })
  void processTurn(input.userId, accepted, lock, stream, startedAt).catch((e) => console.error('[turn] 예기치 못한 예외:', e instanceof Error ? e.message : String(e)))
  return { accepted: acc, subscribe: (l) => stream.subscribe(l), done: stream.done }
}
