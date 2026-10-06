/**
 * 채팅 표현 점검(api-contract #33, A3) — 채팅당 1회. 사용자 메시지 ≤20건은 동기(요청 안에서, LLM 90s), 초과는 AiJob(CHAT_REVIEW)
 * 을 같은 프로세스 백그라운드로 돌린다(범위결정 4).
 *
 * 동시성(Q3):
 *   - **점유**: 채팅 행 `FOR UPDATE` 트랜잭션에서 `reviewedAt`·진행 중 잡을 확인하고 AiJob 을 만든다. 동기 경로도 잡 행(RUNNING)을
 *     만들어 "진행 중" 표식으로 쓴다 — 두 번째 요청은 프로세스가 달라도 409(진행 중)를 받는다.
 *   - **저장**: `updateMany(where reviewedAt IS NULL)` 로 `reviewedAt` 을 먼저 세우고 같은 트랜잭션에서 교정·제안·잡 DONE 을 쓴다 —
 *     어떤 경합에서도 교정 묶음은 한 번만 저장된다.
 * D3: 동기 경로는 클라이언트가 떠나도 요청 처리가 끝까지 간다(라우트가 기다리는 promise 는 연결과 무관).
 * 저장 순서·내용: Correction PROPOSED(original = 서버 원문) + `Chat.reviewedAt` + ADD_STUDY_LOG 제안 1건(payload = D4) — 한 트랜잭션.
 * 채택 전에는 WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat 에 행이 생기지 않는다.
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, classifyError, dates, isRetryableTxError, jobs, lockUserRow, withTransaction, type Tx } from '@/modules/infra'
import { llm, newTraceId, recordTrace } from '@/modules/engine'
import { buildChatReviewRequest, CHAT_REVIEW_PROMPT_VERSION } from '../prompts/chatReview'
import type { ChatReviewResponse } from '../structuredResponse/schemas'
import { buildLearnerHeader } from '../turnContext'
import { notFoundChat } from '../chats'
import { proposalExpiresAt } from '../proposals'
import { mergeReviewCandidates } from './filter'

export const REVIEW_SYNC_MAX_USER_MESSAGES = 20

export interface ReviewItemDto {
  correctionId: string
  messageId: string
  original: string
  corrected: string
  explanation: string
  /** task-039(chatReview@v3) — 추가 설명(정리 통과분, 저장 행과 같은 값). null = 줄 없음. */
  extraNoteKo: string | null
  errorType: string
  severity: string
  chunkType: string | null
  status: 'PROPOSED'
}

export interface ReviewSyncDto {
  items: ReviewItemDto[]
  summaryKo: string
  strengths: string[]
  focus: string[]
  reviewedAt: string
  dropped: number
  skippedMessages: number
}

export type ReviewOutcome = { mode: 'sync'; result: ReviewSyncDto } | { mode: 'job'; jobId: string }

/**
 * 라우트가 넘기는 훅(task-010b L3) — 점검이 만든 교정(PROPOSED)의 관측을 **저장 트랜잭션 안에서** 쓴다(관측은 learning 소유).
 * 교착은 다시 던져 트랜잭션 전체가 재시도되게 하고, 그 밖의 오류는 경고만 남기고 점검 결과는 저장한다(턴 훅과 같은 규칙).
 */
export interface ReviewHooks {
  recordCorrectionsProposed?: (tx: Tx, rows: { correctionId: string; errorType: string; severity: string }[]) => Promise<void>
}

interface Claim {
  jobId: string
  traceId: string
  level: JlptLevel | null
  messageCount: number
  messages: { id: string; text: string }[]
  sync: boolean
}

function withTrace<E>(e: E, traceId: string): E {
  if (e && typeof e === 'object' && !(e instanceof ApiError)) {
    try {
      ;(e as { traceId?: string }).traceId = traceId
    } catch {
      // 동결된 객체 — traceId 없이 전달
    }
  }
  return e
}

async function claimReview(userId: string, chatId: string): Promise<Claim> {
  const traceId = newTraceId()
  return withTransaction(async (tx) => {
    // 잠금 순서 통일(사용자 → 채팅): 턴 수락과 같은 순서라 교착이 생기지 않는다.
    await lockUserRow(tx, userId)
    const rows = await tx.$queryRaw<{ id: string; userId: string; kind: string; level: JlptLevel | null; messageCount: number; reviewedAt: Date | null }[]>`
      SELECT id, userId, kind, level, messageCount, reviewedAt FROM Chat WHERE id = ${chatId} FOR UPDATE`
    const chat = rows[0]
    if (!chat || chat.userId !== userId) throw notFoundChat()
    if (chat.kind !== 'CHAT') throw new ApiError('VALIDATION', '표현 점검은 채팅에서만 할 수 있어요.', { field: 'chatId', reason: 'kind' })
    if (chat.reviewedAt) throw new ApiError('ALREADY_REVIEWED', '이미 점검한 채팅이에요.')
    const active = await jobs.findActiveJob({ userId, kind: 'CHAT_REVIEW', refId: chatId }, tx)
    if (active) throw new ApiError('CONFLICT', '이미 점검하고 있어요.', { jobId: active.id })
    const msgs = await tx.chatMessage.findMany({
      where: { chatId, role: 'USER', status: 'DONE' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, content: true },
    })
    if (!msgs.length) throw new ApiError('VALIDATION', '점검할 내 메시지가 없어요. 먼저 대화를 나눠 보세요.', { field: 'messages', reason: 'empty' })
    const sync = msgs.length <= REVIEW_SYNC_MAX_USER_MESSAGES
    const chars = msgs.reduce((n, m) => n + m.content.length, 0)
    const job = await jobs.createJob(
      {
        userId,
        kind: 'CHAT_REVIEW',
        refId: chatId,
        traceId,
        status: sync ? 'RUNNING' : 'QUEUED',
        // 입력 메타만(본문 없음 — domain-model AiJob.payload 규칙)
        payload: { promptKey: 'chatReview', promptVersion: CHAT_REVIEW_PROMPT_VERSION, inputMeta: { userMessages: msgs.length, chars } },
      },
      tx,
    )
    return { jobId: job.id, traceId, level: chat.level, messageCount: Number(chat.messageCount), messages: msgs.map((m) => ({ id: m.id, text: m.content })), sync }
  })
}

async function executeReview(userId: string, chatId: string, c: Claim, priority: 'interactive' | 'batch', hooks: ReviewHooks = {}): Promise<ReviewSyncDto> {
  const startedAt = Date.now()
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  const steps: { name: string; ms: number; [k: string]: string | number | boolean | null | undefined }[] = []
  try {
    let t = Date.now()
    const learner = await buildLearnerHeader(userId, c.level)
    const req = buildChatReviewRequest({ todayKst: dates.todayKst(), learner, messages: c.messages })
    // 상한 초과분은 오래된 것부터 빠진다 — 점검 대상은 입력의 연속된 최근 구간(prompts/chatReview trimToBudget).
    const kept = c.messages.slice(req.skippedMessages)
    steps.push({ name: 'PROMPT', ms: Date.now() - t })
    await jobs.updateJobProgress(c.jobId, 10, 'LLM')

    t = Date.now()
    const r = await llm.completeJson<ChatReviewResponse>({ ...req, softExtraCheck: true, priority })
    steps.push({ name: 'LLM', ms: Date.now() - t, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars })

    t = Date.now()
    const { items, dropped } = mergeReviewCandidates(kept, r.candidates?.length ? r.candidates : [r.data])
    await jobs.updateJobProgress(c.jobId, 90, 'SAVE')
    const reviewedAt = new Date()
    const saved = await withTransaction(async (tx) => {
      await lockUserRow(tx, userId)
      const upd = await tx.chat.updateMany({ where: { id: chatId, userId, reviewedAt: null }, data: { reviewedAt } })
      if (upd.count === 0) {
        const exists = await tx.chat.findFirst({ where: { id: chatId, userId }, select: { id: true } })
        if (!exists) throw notFoundChat()
        throw new ApiError('ALREADY_REVIEWED', '이미 점검한 채팅이에요.')
      }
      const out: ReviewItemDto[] = []
      for (const d of items) {
        // extraNoteKo 는 생성 시에만 쓴다(수정 경로 없음). 값은 mergeReviewCandidates(toDraft) 에서 정리를 마친 것이다.
        const row = await tx.correction.create({
          data: { userId, chatId, messageId: d.messageId, original: d.original, corrected: d.corrected, explanation: d.explanation, extraNoteKo: d.extraNoteKo, errorType: d.errorType, severity: d.severity, chunkType: d.chunkType },
          select: { id: true },
        })
        out.push({
          correctionId: row.id, messageId: d.messageId, original: d.original, corrected: d.corrected, explanation: d.explanation, extraNoteKo: d.extraNoteKo,
          errorType: d.errorType, severity: d.severity, chunkType: d.chunkType, status: 'PROPOSED',
        })
      }
      if (out.length && hooks.recordCorrectionsProposed) {
        try {
          await hooks.recordCorrectionsProposed(tx, out.map((o) => ({ correctionId: o.correctionId, errorType: o.errorType, severity: o.severity })))
        } catch (e) {
          if (isRetryableTxError(e)) throw e
          console.warn('[review] 교정 제안 관측 기록 실패:', e instanceof Error ? e.name : 'unknown')
        }
      }
      // D4: 총평을 잡·재방문 경로에서도 잃지 않게 ADD_STUDY_LOG 제안 payload 에 둔다(코드가 만든다, LLM 아님 — 범위결정 3).
      await tx.tutorProposal.create({
        data: {
          userId,
          chatId,
          kind: 'ADD_STUDY_LOG',
          payload: {
            chatId,
            messageCount: c.messageCount,
            userMessageCount: c.messages.length,
            reviewedMessageCount: kept.length,
            correctionCount: out.length,
            summaryKo: r.data.summary_ko,
            strengths: r.data.strengths,
            focus: r.data.focus,
            skippedMessages: req.skippedMessages,
          },
          expiresAt: proposalExpiresAt(reviewedAt),
        },
      })
      await jobs.completeJob(c.jobId, tx)
      return out
    })
    steps.push({ name: 'PARSE', ms: Date.now() - t, items: saved.length, dropped })
    return { items: saved, summaryKo: r.data.summary_ko, strengths: r.data.strengths, focus: r.data.focus, reviewedAt: reviewedAt.toISOString(), dropped, skippedMessages: req.skippedMessages }
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    throw withTrace(e, c.traceId)
  } finally {
    // TraceKind 에 REVIEW 가 없어 TURN 으로 남기고 refType 으로 구분한다(지표는 refType='chatMessage' 만 턴으로 센다).
    void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - startedAt, errorCode, refType: 'chatReview', refId: chatId })
  }
}

/** #33 — 동기면 결과, 잡이면 jobId. 수락 전 실패(404·400·409·ALREADY_REVIEWED)는 던진다. */
export async function reviewChat(userId: string, chatId: string, hooks: ReviewHooks = {}): Promise<ReviewOutcome> {
  if (typeof chatId !== 'string' || !chatId || chatId.length > 40) throw notFoundChat()
  const claim = await claimReview(userId, chatId)
  if (claim.sync) {
    jobs.markLocalJob(claim.jobId, true)
    try {
      return { mode: 'sync', result: await executeReview(userId, chatId, claim, 'interactive', hooks) }
    } catch (e) {
      await jobs.failJob(claim.jobId, classifyError(e).code)
      throw e
    } finally {
      jobs.markLocalJob(claim.jobId, false)
    }
  }
  // 잡 경로는 batch 레인 — 같은 프로세스의 CLI 큐에서 대화 턴이 먼저 돈다.
  jobs.runJobInBackground(claim.jobId, async () => {
    await executeReview(userId, chatId, claim, 'batch', hooks)
  })
  return { mode: 'job', jobId: claim.jobId }
}

