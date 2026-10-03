/**
 * 턴 오케스트레이터(api-contract #32, bjj `masterChat.runTurn` 이식) — 수락(사용자 행·PENDING 강사 행 저장) → PROMPT → LLM → PARSE →
 * 저장 → `done`. 수락 전 실패(404·409·400)는 호출자에게 던지고(라우트가 봉투로), 수락 뒤 실패는 강사 행 FAILED + `error` 이벤트.
 *
 * task-007(음성 회화):
 *  - TALK 이고 라우트가 `speaker` 를 주면 문장 음성(`audio` 이벤트)을 만든다 — 합성은 speaker(라우트가 speech 로 구현)가,
 *    어떤 문장을 언제 보낼지는 `TurnAudio` 가 정한다. LLM 스트림에서 첫 문장을 조기 추출해(안전 필터 통과분만) 검증 전에 합성을
 *    시작하고, 검증 뒤 나머지를 합성한다. 저장 트랜잭션은 합성과 **병렬**, `done` 은 저장 + 모든 청크가 끝난 뒤 1회.
 *  - 수락 전 검사(`gate`, 예: 발화 소유)·잠금 없는 채팅 확인·학습자 헤더/이력 미리 읽기를 병렬로 끝낸 뒤 **LLM 을 수락 커밋과 병렬로** 띄운다
 *    (NAS 커밋 100~500ms — startTurn 주석). 수락이 거절되면 LLM 을 abort. 수락 직후 `onAccepted`(예: 발화 연결)를 LLM 과 병렬로 돈다.
 *  - 계측: Trace `STT`(클라)·`ACCEPT`·`PROMPT`·`LLM`(warm·firstDeltaMs·firstSentenceMs)·`PARSE`·`SAVE`·`TTS[i]`, 직전 턴 Trace 에 `PLAYBACK`.
 *    원문·전사·응답 전문은 Trace·toolLog·로그에 넣지 않는다.
 *
 * task-024(응답 길이): TALK 는 호출 전에 발화 신호로 문장 수 상한(`sceneCap`, ./sceneCap)을 정해 프롬프트·후검증에 넘긴다. 상한과 신호 코드는
 *  `toolLog`·Trace PROMPT 단계에 남긴다(발화 원문은 아님). CHAT·예열은 상한을 받지 않는다(예열 = 기본 2).
 *
 * task-010c(교정 방식): TALK 는 설정의 교정 방식(역할극은 코치)을 A1 `[교정]` 줄로 넘긴다. 교정 행은 모드와 무관하게 전부 PROPOSED 로 저장하고,
 *  보여 주는 때(`deliver` NOW|LATER)·코치 힌트를 교정이 달린 사용자 메시지 `toolLog.correction` 에 함께 남긴다(같은 저장 트랜잭션).
 *  코치 자기수정은 LLM 없이 코드가 판정한다 — 직전 말의 힌트 교정을 이번 말이 고쳤으면 그 메시지 메타에 판정을 쓰고, 고쳤을 때만
 *  라우트 훅(`recordSelfCorrection`, learning 관측)을 같은 트랜잭션에서 부른다. 판정 재료 읽기는 수락 뒤 LLM 과 병렬(첫 음성 경로 밖).
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
import { ApiError, classifyError, dates, isRetryableTxError, lockUserRow, prisma, withTransaction, type Tx } from '@/modules/infra'
import { appendTraceSteps, llm, newTraceId, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceStep } from '@/modules/engine'
import { buildChatRequest } from '../prompts/chat'
import { buildTalkRequest, type CorrectionMode } from '../prompts/talk'
import type { TutorResponse } from '../structuredResponse/schemas'
import { buildLearnerHeader, loadCoachPending, loadHistoryBefore, loadRecentHistory, loadTalkCorrectionMode, type CoachPending } from '../turnContext'
import {
  coachHintOf,
  correctionDeliver,
  judgeSelfCorrection,
  resolveTalkCorrectionMode,
  writeCorrectionMeta,
  type CorrectionDeliver,
  type SelfCheckResult,
} from '../corrections/talkDelivery'
import type { WindowMessage } from '../window'
import type { LearnerHeader } from '../prompts/header'
import { chatPreview, notFoundChat } from '../chats'
import type { TurnClientTimings, TurnRequest } from '../chats/validate'
import { TurnAudio, type TurnSpeaker } from './turnAudio'
import { computeSceneCap, type SceneCapReason } from './sceneCap'
import { proposalExpiresAt } from '../proposals'
import { currentTurnLock, isMessageLocallyRunning, isStalePending, releaseTurnLock, tryAcquireTurnLock, type TurnLock } from './locks'
import { isRetryableTurnError, shapeTurnResponse, turnErrorMessage, type ShapedTurn } from './shape'
import { TurnStream, type TurnEvent, type TurnListener } from './stream'

export interface TurnAccepted {
  userMessageId: string
  assistantMessageId: string
  traceId: string
}

/** 라우트가 조합해 넣는 훅(conversation 은 speech 를 모른다 — 발화·음성은 라우트가 speech 로 구현해 넘긴다). */
export interface TurnHooks {
  /** 수락 **전에** 끝나야 하는 검사(예: 발화 소유·미연결·10분). 던지면 수락하지 않는다(행 0). 이력 미리 읽기와 병렬. */
  gate?: () => Promise<void>
  /** 수락 직후 1회(예: 발화 ↔ 사용자 메시지 연결). LLM 과 병렬로 돌고 결과 단계는 Trace 에 남는다. 실패해도 턴은 계속. */
  onAccepted?: (a: TurnAccepted) => Promise<TraceStep | null>
  /** TALK 턴 문장 음성. 없으면 텍스트만(CHAT·ASK 는 주어져도 쓰지 않는다). */
  speaker?: (a: TurnAccepted) => TurnSpeaker
  /**
   * 코치 자기수정 관측(task-010c L3) — 저장 트랜잭션 `tx` 안에서 고쳐 말한 경우(SELF·REPEAT)에만 부른다. 관측 테이블은 learning 소유라
   * 라우트가 learning 으로 구현해 넘긴다(conversation 은 learning 에 쓰지 않는다). 던지면 경고만 남기고 턴은 저장한다(교착은 다시 던져
   * 트랜잭션 전체를 재시도).
   */
  recordSelfCorrection?: (tx: Tx, r: SelfCorrectionRecord) => Promise<void>
  /**
   * 교정 제안 생성 관측(task-010b L3) — 저장 트랜잭션 `tx` 안에서 이번 턴이 교정(PROPOSED)을 만들었을 때 한 번(TALK·CHAT). 관측은 learning
   * 소유라 라우트가 넘긴다. 실패 처리는 위 훅과 같다(경고만, 교착은 다시 던짐).
   */
  recordCorrectionProposed?: (tx: Tx, r: CorrectionProposedRecord) => Promise<void>
}

export interface CorrectionProposedRecord {
  correctionId: string
  errorType: string
  severity: string
  inputSource: InputSource | null
}

export interface SelfCorrectionRecord {
  correctionId: string
  result: Exclude<SelfCheckResult, 'MISSED'>
  /** 정답을 연 뒤 고쳐 말했는가(REPEAT 와 같다 — 관측 meta 용). */
  revealed: boolean
  inputSource: InputSource | null
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
  /** 역할극(상황 대화)이면 교정 방식은 코치(task-010c — 역할극 자체는 task-010d). */
  scenarioId?: string | null
  userMessage: { id: string; content: string; createdAt: Date; inputSource: InputSource | null }
  assistantMessageId: string
  pendingSince: Date
  traceId: string
  resumed: boolean
}

const USER_MESSAGE_SELECT = { id: true, content: true, createdAt: true, inputSource: true } as const

async function acceptTurn(userId: string, chatId: string, req: TurnRequest): Promise<AcceptedTurn> {
  return withTransaction(async (tx) => {
    const now = Date.now()
    await lockUserRow(tx, userId)
    const rows = await tx.$queryRaw<{ id: string; userId: string; kind: ChatKind; level: JlptLevel | null; scenarioId: string | null }[]>`SELECT id, userId, kind, level, scenarioId FROM Chat WHERE id = ${chatId} FOR UPDATE`
    const chat = rows[0]
    if (!chat || chat.userId !== userId) throw notFoundChat()
    if (chat.kind === 'ASK') throw new ApiError('FEATURE_NOT_READY', '무엇이든 물어보기는 아직 준비 중이에요.')

    const pendings = await tx.chatMessage.findMany({ where: { userId, role: 'ASSISTANT', status: 'PENDING' }, select: { id: true, createdAt: true } })
    const stale = pendings.filter((p) => isStalePending(p.createdAt, now, isMessageLocallyRunning(p.id)))
    const live = pendings.find((p) => !stale.includes(p))
    if (live) throw turnConflict(live.id)
    if (stale.length) await tx.chatMessage.updateMany({ where: { id: { in: stale.map((p) => p.id) }, status: 'PENDING' }, data: { status: 'FAILED' } })

    const traceId = newTraceId()
    const base = { chatId, kind: chat.kind, level: chat.level, scenarioId: chat.scenarioId ?? null, traceId, resumed: req.resume }

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

/**
 * `ChatMessage.toolLog`(api-contract #32 저장 순서) — 계측 숫자·짧은 식별자만. 원문·응답 전문 없음.
 * TTS 값(ttsStartMs·ttfaMs·audioCount)은 합성이 저장과 병렬이라 모든 청크가 끝난 뒤 같은 객체로 한 번 더 쓴다.
 */
interface ToolLog {
  traceId: string
  model: string
  connection: string
  llmMs: number
  promptChars: number
  attempt: number
  totalMs: number
  sttMs: number | null
  llmFirstSentenceMs: number | null
  warm: string | null
  ttsStartMs?: number | null
  ttfaMs?: number | null
  audioCount?: number
  /** TALK 만 — 이번 턴 응답 문장 수 상한과 그 신호 코드(task-024). 발화 원문은 싣지 않는다. */
  sceneCap?: number
  sceneCapReason?: SceneCapReason
  /** TALK 만 — 이번 턴 교정 방식과(교정이 있으면) 표시 시점, 직전 코치 힌트 판정 결과 코드(task-010c). */
  correctionMode?: CorrectionMode
  deliver?: CorrectionDeliver
  selfCheck?: SelfCheckResult
  meta: { learning: ShapedTurn['learning']; style: ShapedTurn['speech']['style']; endOfTopic: boolean; warning: ShapedTurn['warning'] }
}

/** 저장 트랜잭션에 함께 싣는 교정 방식 값(task-010c). TALK 가 아니면 없다. */
export interface TurnSaveExtras {
  /** 이번 교정의 표시 메타(교정이 있을 때만 쓴다). */
  correction: { mode: CorrectionMode; deliver: CorrectionDeliver; hintKo: string | null } | null
  /** 직전 코치 힌트 교정의 판정. */
  selfCheck: { pending: CoachPending; result: SelfCheckResult; revealed: boolean } | null
  recordSelfCorrection?: TurnHooks['recordSelfCorrection']
}

type SavedCorrection = {
  id: string
  required: boolean
  original: string
  corrected: string
  explanationKo: string
  errorType: string
  severity: string
  chunkType: string | null
  status: 'PROPOSED'
  deliver: CorrectionDeliver
  hintKo: string | null
  selfCheck: null
}

/**
 * 자기수정 관측 훅을 저장 트랜잭션 안에서 부른다. 관측이 빠져도 턴은 저장한다 — 단 교착(MariaDB 는 트랜잭션 전체를 이미 롤백했다)은 다시 던져
 * `withTransaction` 이 처음부터 재시도하게 한다(잡아 두면 앞선 쓰기가 사라진 채 "성공"으로 끝난다). 문장 단위 오류만 삼킨다.
 */
export async function recordSelfCorrectionSafely(tx: Tx, hook: NonNullable<TurnHooks['recordSelfCorrection']>, r: SelfCorrectionRecord): Promise<boolean> {
  try {
    await hook(tx, r)
    return true
  } catch (e) {
    if (isRetryableTxError(e)) throw e
    console.warn('[turn] 자기수정 관측 기록 실패:', e instanceof Error ? e.name : 'unknown')
    return false
  }
}

/** 교정 제안 관측 훅(task-010b) — 실패 처리는 `recordSelfCorrectionSafely` 와 같다. */
export async function recordCorrectionProposedSafely(tx: Tx, hook: NonNullable<TurnHooks['recordCorrectionProposed']>, r: CorrectionProposedRecord): Promise<boolean> {
  try {
    await hook(tx, r)
    return true
  } catch (e) {
    if (isRetryableTxError(e)) throw e
    console.warn('[turn] 교정 제안 관측 기록 실패:', e instanceof Error ? e.name : 'unknown')
    return false
  }
}

async function saveTurn(
  userId: string,
  a: AcceptedTurn,
  shaped: ShapedTurn,
  toolLog: ToolLog,
  extras: TurnSaveExtras | null = null,
  observe: Pick<TurnHooks, 'recordCorrectionProposed'> = {},
) {
  return withTransaction(async (tx) => {
    // 잠금 순서 통일(사용자 → 채팅 → 행): 다른 인스턴스의 수락 트랜잭션과 교착하지 않게 사용자 행부터 잡는다.
    await lockUserRow(tx, userId)
    const res = await tx.chatMessage.updateMany({
      where: { id: a.assistantMessageId, status: 'PENDING', createdAt: a.pendingSince },
      data: { status: 'DONE', content: shaped.reply.replyJa, reading: shaped.reply.replyReading || null, translation: shaped.reply.replyKo || null, toolLog: toolLog as unknown as Prisma.InputJsonValue, traceId: a.traceId },
    })
    if (res.count === 0) throw new ApiError('CONFLICT', '대화가 바뀌어 답을 저장하지 못했어요.')

    let correction: SavedCorrection | null = null
    if (shaped.correction) {
      const c = shaped.correction
      const row = await tx.correction.create({
        data: { userId, chatId: a.chatId, messageId: a.userMessage.id, original: c.original, corrected: c.corrected, explanation: c.explanationKo, errorType: c.errorType, severity: c.severity, chunkType: c.chunkType },
        select: { id: true },
      })
      const m = extras?.correction ?? null
      if (m) {
        // 교정 행은 그대로(PROPOSED) — 표시 메타만 그 교정이 달린 사용자 메시지에(새로고침·시트·칩 수가 같은 값을 본다).
        const meta = { id: row.id, mode: m.mode, deliver: m.deliver, hintKo: m.hintKo, selfCheck: null }
        await tx.chatMessage.update({ where: { id: a.userMessage.id }, data: { toolLog: writeCorrectionMeta(null, meta) as unknown as Prisma.InputJsonValue } })
      }
      correction = {
        id: row.id, required: c.required, original: c.original, corrected: c.corrected, explanationKo: c.explanationKo, errorType: c.errorType, severity: c.severity, chunkType: c.chunkType, status: 'PROPOSED',
        deliver: m?.deliver ?? 'NOW', hintKo: m?.hintKo ?? null, selfCheck: null,
      }
      if (observe.recordCorrectionProposed) {
        await recordCorrectionProposedSafely(tx, observe.recordCorrectionProposed, { correctionId: row.id, errorType: c.errorType, severity: c.severity, inputSource: a.userMessage.inputSource })
      }
    }
    let selfCheck: { correctionId: string; result: SelfCheckResult } | null = null
    const j = extras?.selfCheck ?? null
    if (j) {
      const { pending, result } = j
      await tx.chatMessage.update({ where: { id: pending.userMessageId }, data: { toolLog: writeCorrectionMeta(pending.toolLog, { ...pending.meta, selfCheck: result }) as unknown as Prisma.InputJsonValue } })
      selfCheck = { correctionId: pending.correction.id, result }
      if (result !== 'MISSED' && extras?.recordSelfCorrection) {
        await recordSelfCorrectionSafely(tx, extras.recordSelfCorrection, { correctionId: pending.correction.id, result, revealed: j.revealed, inputSource: a.userMessage.inputSource })
      }
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
    return { correction, proposals, selfCheck }
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

interface Preload {
  history: Promise<WindowMessage[]> | null
}

/** 수락과 병렬로 이력·학습자 헤더 재료를 읽는다. 실패는 여기서 삼키고(미처리 거부 방지) 사용 시점에 다시 읽는다. */
function startPreload(userId: string, chatId: string, resume: boolean): Preload {
  const history = resume ? null : turnDeps.loadRecentHistory(userId, chatId)
  history?.catch(() => undefined)
  void turnDeps.buildLearnerHeader(userId, null).catch(() => undefined)
  return { history }
}

/**
 * 수락 전 채팅 확인(잠금 없는 읽기) — 먼저 띄울 LLM 의 모드(TALK/CHAT)·수준을 정한다. 수락 트랜잭션이 잠금을 잡고 다시 확인한다.
 * 남의 채팅·없음 404, ASK 는 아직 FEATURE_NOT_READY(수락과 같은 판정).
 */
async function precheckChat(userId: string, chatId: string): Promise<{ kind: ChatKind; level: JlptLevel | null; scenarioId?: string | null }> {
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId }, select: { kind: true, level: true, scenarioId: true } })
  if (!chat) throw notFoundChat()
  if (chat.kind === 'ASK') throw new ApiError('FEATURE_NOT_READY', '무엇이든 물어보기는 아직 준비 중이에요.')
  return chat
}

function clientSteps(t: TurnClientTimings | null): TraceStep[] {
  return t?.sttMs != null ? [{ name: 'STT', ms: t.sttMs, source: 'client' }] : []
}

/** 직전 턴(prevMessageId = 직전 강사 메시지)의 재생 계측을 그 턴 Trace 에 덧붙인다. 남의 메시지·없는 Trace 는 조용히 건너뛴다. */
async function recordPlayback(userId: string, chatId: string, t: TurnClientTimings | null): Promise<void> {
  if (!t?.prevMessageId) return
  if (t.playbackStartDelayMs == null && t.firstAudioAtMs == null && t.releaseToFirstAudioEventMs == null) return
  const prev = await prisma.chatMessage.findFirst({ where: { id: t.prevMessageId, userId, chatId, role: 'ASSISTANT' }, select: { traceId: true } })
  if (!prev?.traceId) return
  await appendTraceSteps(prev.traceId, userId, [
    {
      name: 'PLAYBACK',
      ms: t.playbackStartDelayMs ?? 0,
      playbackStartDelayMs: t.playbackStartDelayMs,
      firstAudioAtMs: t.firstAudioAtMs,
      releaseToFirstAudioEventMs: t.releaseToFirstAudioEventMs,
    },
  ])
}

/** 수락(`accepted`) 전에 난 이벤트를 모아 두었다가 `accepted` 바로 뒤에 순서대로 내보낸다 — 스트림은 항상 accepted 로 시작한다. */
class EarlyEmitter {
  private buf: TurnEvent[] = []
  private opened = false
  constructor(private readonly stream: TurnStream) {}
  readonly emit = (e: TurnEvent): void => {
    if (this.opened) this.stream.emit(e)
    else this.buf.push(e)
  }
  open(): void {
    this.opened = true
    for (const e of this.buf) this.stream.emit(e)
    this.buf = []
  }
}

/** 프롬프트 조립 + LLM 시작(+ TALK 이면 문장 음성 스케줄러). 수락과 병렬로 먼저 띄울 수 있게 떼어 냈다. */
interface LlmRun {
  promise: Promise<LlmJsonResult<TutorResponse>>
  audio: TurnAudio | null
  /** 턴 시작 → LLM 시작(ms). */
  startAt: number
  promptMs: number
  /** TALK 만(CHAT 은 null — A2 는 고정 상한). */
  scene: { cap: number; reason: SceneCapReason } | null
  /** TALK 만 — 이번 턴 교정 방식(task-010c). */
  correctionMode: CorrectionMode | null
  abort: () => void
}

function startLlmRun(o: {
  kind: ChatKind
  text: string
  learner: LearnerHeader
  history: WindowMessage[]
  speaker: TurnSpeaker | null
  emit: (e: TurnEvent) => void
  elapsed: () => number
  /** TALK 만 의미가 있다(CHAT 은 무시). */
  correctionMode: CorrectionMode | null
}): LlmRun {
  o.emit({ event: 'status', data: { stage: 'PROMPT', elapsedMs: o.elapsed() } })
  const t = Date.now()
  const input = { todayKst: dates.todayKst(), learner: o.learner, history: o.history, text: o.text }
  // 상한은 TALK 의 [지시] 줄·후검증에만 간다(persona·세션 캐시 키 불변). CHAT(A2)은 그대로 — task-024.
  const scene = o.kind === 'TALK' ? computeSceneCap({ text: o.text, level: o.learner.level }) : null
  const correctionMode = o.kind === 'TALK' ? (o.correctionMode ?? 'FLUENCY') : null
  const req = scene ? buildTalkRequest({ ...input, sceneCap: scene.cap, correctionMode: correctionMode ?? 'FLUENCY' }) : buildChatRequest(input)
  const promptMs = Date.now() - t
  const audio = o.kind === 'TALK' && o.speaker ? new TurnAudio({ speaker: o.speaker, emit: o.emit, elapsed: o.elapsed, early: true }) : null
  const startAt = o.elapsed()
  o.emit({ event: 'status', data: { stage: 'LLM', elapsedMs: startAt } })
  const ac = new AbortController()
  // softExtraCheck: 후검증 위반이 재시도 뒤에도 남으면 던지지 않고 서버가 정리한다(CHAT 교정 null·TALK 원문 불일치 교정 버림).
  const promise = turnDeps.completeJson<TutorResponse>({
    ...req,
    softExtraCheck: true,
    signal: ac.signal,
    ...(audio ? { onTextDelta: (d: string, call: number) => audio.onDelta(d, call) } : {}),
  })
  // 수락이 끝나기 전에 실패해도 미처리 거부가 되지 않게(뒤에서 await 가 같은 거부를 받는다).
  promise.catch(() => undefined)
  return { promise, audio, startAt, promptMs, scene, correctionMode, abort: () => ac.abort() }
}

/** TALK 의 교정 방식 — 설정(60초 캐시) + 역할극이면 코치. 읽기 실패는 기본(유창성)으로 — 턴을 막지 않는다. */
async function talkCorrectionModeFor(userId: string, chat: { kind: ChatKind; scenarioId?: string | null }): Promise<CorrectionMode | null> {
  if (chat.kind !== 'TALK') return null
  const profileMode = await turnDeps.loadCorrectionMode(userId).catch(() => null)
  return resolveTalkCorrectionMode(profileMode, chat)
}

interface ProcessInput {
  userId: string
  a: AcceptedTurn
  lock: TurnLock
  stream: TurnStream
  elapsed: () => number
  acceptMs: number
  hooks: TurnHooks
  clientTimings: TurnClientTimings | null
  /** 수락과 병렬로 먼저 띄운 LLM(끊김 복구가 아니면 항상). 없으면 여기서 띄운다. */
  run: LlmRun | null
  speaker: TurnSpeaker | null
  /** 직전 코치 힌트 카드의 정답을 열고 말했는가(클라 보고, task-010c — REPEAT 판정). */
  coachRevealed: boolean
}

async function processTurn(p: ProcessInput): Promise<void> {
  const { userId, a, lock, stream, elapsed } = p
  const steps: TraceStep[] = [...clientSteps(p.clientTimings), { name: 'ACCEPT', ms: p.acceptMs, parallelWithLlm: p.run !== null }]
  let released = false
  const release = () => {
    if (released) return
    released = true
    releaseTurnLock(lock)
  }
  let trace: { status: 'OK' | 'ERROR'; errorCode: string | null } = { status: 'OK', errorCode: null }
  const acc: TurnAccepted = { userMessageId: a.userMessage.id, assistantMessageId: a.assistantMessageId, traceId: a.traceId }
  const acceptedHook = p.hooks.onAccepted
    ? p.hooks.onAccepted(acc).catch((e) => {
        console.warn('[turn] 수락 후 훅 실패:', e instanceof Error ? e.name : 'unknown')
        return { name: 'ON_ACCEPTED', ms: 0, warning: 'HOOK_FAILED' } as TraceStep
      })
    : Promise.resolve(null)
  let audio: TurnAudio | null = p.run?.audio ?? null
  let toolLog: ToolLog | null = null
  // 코치 자기수정 판정 재료(직전 말의 힌트 교정) — LLM 과 병렬로 읽는다. 실패는 판정 생략(턴은 계속).
  const coachPending: Promise<CoachPending | null> =
    a.kind === 'TALK' ? turnDeps.loadCoachPending(userId, a.chatId, a.userMessage).catch(() => null) : Promise.resolve(null)
  try {
    let run = p.run
    if (!run) {
      const [learner, history, correctionMode] = await Promise.all([
        buildLearnerHeader(userId, a.level),
        loadHistoryBefore(a.chatId, a.userMessage),
        talkCorrectionModeFor(userId, a),
      ])
      run = startLlmRun({ kind: a.kind, text: a.userMessage.content, learner, history, speaker: p.speaker, emit: (e) => stream.emit(e), elapsed, correctionMode })
      audio = run.audio
    }
    steps.push({
      name: 'PROMPT',
      ms: run.promptMs,
      ...(run.scene ? { sceneCap: run.scene.cap, sceneCapReason: run.scene.reason } : {}),
      ...(run.correctionMode ? { correctionMode: run.correctionMode } : {}),
    })
    const r = await run.promise
    const llmMs = elapsed() - run.startAt
    const am = audio?.metrics()
    // LLM 시작 → 스트림에서 첫 문장이 확정된 시각(조기 경로). 조기 문장이 없으면 null.
    const firstSentenceMs = am?.firstSentenceMs != null ? am.firstSentenceMs - run.startAt : null
    steps.push({
      name: 'LLM',
      ms: llmMs,
      startMs: run.startAt,
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      residualViolations: r.residualViolations?.length ?? 0,
      warm: r.warm ?? null,
      firstDeltaMs: r.firstDeltaMs ?? null,
      firstSentenceMs,
      earlyStop: am?.earlyStop ?? null,
    })

    stream.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: elapsed() } })
    let t = Date.now()
    const shaped = shapeTurnResponse(a.kind, a.userMessage.content, r.data)
    if (shaped.warning) stream.emit({ event: 'status', data: { stage: 'PARSE', elapsedMs: elapsed(), warning: shaped.warning } })
    // 검증을 통과한 답으로 남은 문장 합성을 시작하고, 저장은 그와 병렬로(첫 음성 경로에서 뺀다).
    audio?.finalize(shaped.reply.replyJa, shaped.speech.style)
    steps.push({ name: 'PARSE', ms: Date.now() - t })
    t = Date.now()
    const extras = await talkSaveExtras(run.correctionMode, shaped, a, await coachPending, p.coachRevealed, p.hooks.recordSelfCorrection)
    toolLog = {
      traceId: a.traceId,
      model: r.model,
      connection: r.connectionKey,
      llmMs,
      promptChars: r.promptChars,
      attempt: r.attempts ?? 1,
      totalMs: elapsed(),
      sttMs: p.clientTimings?.sttMs ?? null,
      llmFirstSentenceMs: firstSentenceMs,
      warm: r.warm ?? null,
      ...(run.scene ? { sceneCap: run.scene.cap, sceneCapReason: run.scene.reason } : {}),
      ...(run.correctionMode ? { correctionMode: run.correctionMode } : {}),
      ...(extras?.correction ? { deliver: extras.correction.deliver } : {}),
      ...(extras?.selfCheck ? { selfCheck: extras.selfCheck.result } : {}),
      meta: { learning: shaped.learning, style: shaped.speech.style, endOfTopic: shaped.endOfTopic, warning: shaped.warning },
    }
    const saved = await turnDeps.saveTurn(userId, a, shaped, toolLog, extras, { recordCorrectionProposed: p.hooks.recordCorrectionProposed })
    steps.push({ name: 'SAVE', ms: Date.now() - t })
    // 저장이 끝났으면 다음 턴을 받아도 된다 — 남은 합성은 락과 무관하다.
    release()
    if (audio) {
      await audio.settled()
      const m = audio.metrics()
      steps.push(...audio.steps())
      toolLog = { ...toolLog, ttsStartMs: m.ttsStartMs, ttfaMs: m.ttfaMs, audioCount: m.audioCount }
    }
    stream.emit({
      event: 'done',
      data: {
        userMessageId: a.userMessage.id,
        assistantMessageId: a.assistantMessageId,
        conversation: shaped.reply,
        correction: saved.correction,
        // 직전 코치 힌트 교정의 판정(task-010c, TALK 만) — 화면이 그 카드에 "스스로 고쳤어요" 등을 단다. 판정이 없으면 null.
        ...(a.kind === 'TALK' ? { selfCheck: saved.selfCheck ?? null } : {}),
        learning: shaped.learning,
        speech: shaped.speech,
        endOfTopic: shaped.endOfTopic,
        proposals: saved.proposals,
        audioCount: audio?.metrics().audioCount ?? 0,
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
  if (audio && toolLog?.audioCount !== undefined) await patchToolLog(a, toolLog)
  const hookStep = await acceptedHook
  if (hookStep) steps.push(hookStep)
  await recordTrace({ traceId: a.traceId, kind: 'TURN', userId, status: trace.status, steps, totalMs: elapsed(), errorCode: trace.errorCode, refType: 'chatMessage', refId: a.assistantMessageId })
  await recordPlayback(userId, a.chatId, p.clientTimings).catch(() => undefined)
}

/** TALK 저장에 함께 실을 교정 방식 값. CHAT·ASK 는 null(교정·판정 없음). */
async function talkSaveExtras(
  mode: CorrectionMode | null,
  shaped: ShapedTurn,
  a: AcceptedTurn,
  pending: CoachPending | null,
  revealed: boolean,
  record: TurnHooks['recordSelfCorrection'],
): Promise<TurnSaveExtras | null> {
  if (!mode) return null
  const c = shaped.correction
  const correction = c ? { mode, deliver: correctionDeliver(mode, c.severity), hintKo: coachHintOf(mode, c.hintKo, c.corrected, c.original) } : null
  const selfCheck = pending
    ? { pending, revealed, result: judgeSelfCorrection({ original: pending.correction.original, corrected: pending.correction.corrected, text: a.userMessage.content, revealed }) }
    : null
  return { correction, selfCheck, recordSelfCorrection: record }
}

/** TTS 계측을 더한 toolLog 를 다시 쓴다(DONE 이고 이 턴의 traceId 인 행만). 실패는 로그만. */
async function patchToolLog(a: AcceptedTurn, toolLog: ToolLog): Promise<void> {
  try {
    await prisma.chatMessage.updateMany({ where: { id: a.assistantMessageId, status: 'DONE', traceId: a.traceId }, data: { toolLog: toolLog as unknown as Prisma.InputJsonValue } })
  } catch (e) {
    console.warn('[turn] toolLog TTS 계측 기록 실패:', e instanceof Error ? e.name : 'unknown')
  }
}

/**
 * 턴 경로의 DB·LLM 의존(REV-014 M2·Codex C2-2) — 운영 코드는 이 객체를 통해서만 부르고, 단위 테스트는 `mock.method(turnDeps, …)` 로
 * 바꿔 끼워 "gate 통과 → LLM 선행 시작 → 수락 거절"(LLM abort·행 0·이벤트 0)과 "불일치 뒤 느린 합성이 있어도 done 즉시" 를 DB 없이 재현한다.
 */
export const turnDeps = {
  precheckChat,
  acceptTurn,
  saveTurn,
  loadRecentHistory,
  buildLearnerHeader,
  /** task-010c — 설정의 교정 방식(학습자 헤더와 같은 60초 캐시). */
  loadCorrectionMode: loadTalkCorrectionMode,
  /** task-010c — 직전 말의 코치 힌트 교정(판정 재료). */
  loadCoachPending,
  completeJson: <T>(req: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> => llm.completeJson<T>(req),
  prewarm: (req: LlmJsonRequest<TutorResponse>) => llm.prewarm(req),
}

/**
 * #32 턴 시작. 수락까지 기다려 돌려주고(그 전 실패는 던진다), 나머지는 백그라운드에서 끝까지 돈다.
 * 라우트는 `handle.subscribe` 를 SSE 에 연결하기만 한다 — 연결이 끊겨도 `handle.done` 은 저장까지 간다.
 *
 * 수락 트랜잭션과 LLM 을 **병렬로** 시작한다(task-007 K2-3): NAS MariaDB 는 커밋마다 fsync(`innodb_flush_log_at_trx_commit=1`
 * + `sync_binlog=1`)라 커밋 1회가 100~500ms 다(실측). 잠금 없는 확인(채팅 소유·모드·수준, 발화 gate)을 먼저 끝내고 LLM 을 띄운 뒤
 * 수락을 기다린다. 수락이 거절되면(409 등) LLM 을 abort 하고 그 오류를 그대로 던진다(행 0·이벤트 0). 끊김 복구는 이전 사용자
 * 메시지가 있어야 하므로 수락 뒤에 띄운다. 음성 합성은 수락 뒤에만 시작한다(speaker 가 수락을 기다린다).
 */
export async function startTurn(input: { userId: string; chatId: string; request: TurnRequest; hooks?: TurnHooks }): Promise<TurnHandle> {
  if (typeof input.chatId !== 'string' || !input.chatId || input.chatId.length > 40) throw notFoundChat()
  const lock = tryAcquireTurnLock(input.userId, input.chatId)
  if (!lock) throw turnConflict(currentTurnLock(input.userId)?.assistantMessageId ?? null)
  const startedAt = Date.now()
  const elapsed = () => Date.now() - startedAt
  const hooks = input.hooks ?? {}
  const request = input.request
  const stream = new TurnStream()
  const early = new EarlyEmitter(stream)
  const preload = startPreload(input.userId, input.chatId, request.resume)
  let acceptedResolve: (a: TurnAccepted) => void = () => {}
  let acceptedReject: (e: unknown) => void = () => {}
  const acceptedPromise = new Promise<TurnAccepted>((res, rej) => {
    acceptedResolve = res
    acceptedReject = rej
  })
  acceptedPromise.catch(() => undefined)
  // 먼저 뜬 LLM 의 첫 문장이 수락보다 빨라도 합성은 수락 뒤에 — 거절된 턴의 음성을 만들지 않는다.
  const speaker: TurnSpeaker | null = hooks.speaker ? async (req) => hooks.speaker!(await acceptedPromise)(req) : null

  let run: LlmRun | null = null
  let accepted: AcceptedTurn
  let acceptMs = 0
  try {
    if (!request.resume) {
      const [pre] = await Promise.all([turnDeps.precheckChat(input.userId, input.chatId), hooks.gate ? hooks.gate() : Promise.resolve()])
      const [learner, history, correctionMode] = await Promise.all([
        turnDeps.buildLearnerHeader(input.userId, pre.level),
        (preload.history ?? Promise.reject(new Error('no preload'))).catch(() => turnDeps.loadRecentHistory(input.userId, input.chatId)),
        talkCorrectionModeFor(input.userId, pre),
      ])
      run = startLlmRun({ kind: pre.kind, text: request.text, learner, history, speaker, emit: early.emit, elapsed, correctionMode })
    }
    const t = Date.now()
    accepted = await turnDeps.acceptTurn(input.userId, input.chatId, request)
    acceptMs = Date.now() - t
  } catch (e) {
    run?.abort()
    acceptedReject(e)
    releaseTurnLock(lock)
    throw e
  }
  lock.assistantMessageId = accepted.assistantMessageId
  const acc: TurnAccepted = { userMessageId: accepted.userMessage.id, assistantMessageId: accepted.assistantMessageId, traceId: accepted.traceId }
  acceptedResolve(acc)
  stream.emit({ event: 'accepted', data: acc })
  early.open()
  const clientTimings = request.resume ? null : request.clientTimings
  // 끊김 복구(resume)는 사용자 행이 이미 있으므로 발화 연결 훅을 다시 돌리지 않는다(음성은 speaker 로 다시 만든다).
  // 자기수정 관측 훅은 남긴다 — 실패한 첫 실행은 저장(=판정)까지 가지 못했으므로 다시 실행이 처음 판정한다.
  const turnHooks: TurnHooks = accepted.resumed
    ? { speaker: hooks.speaker, recordSelfCorrection: hooks.recordSelfCorrection, recordCorrectionProposed: hooks.recordCorrectionProposed }
    : hooks
  const coachRevealed = !request.resume && request.coachRevealed === true
  void processTurn({ userId: input.userId, a: accepted, lock, stream, elapsed, acceptMs, hooks: turnHooks, clientTimings, run, speaker, coachRevealed }).catch((e) =>
    console.error('[turn] 예기치 못한 예외:', e instanceof Error ? e.message : String(e)),
  )
  return { accepted: acc, subscribe: (l) => stream.subscribe(l), done: stream.done }
}

/**
 * TALK 방 진입·푸시투토크 티켓 때 LLM 을 예열한다(task-007 K2-1, 명시적 warm 라우트 없음). 실제 턴과 **같은 페르소나**가 나오도록
 * `buildTalkRequest` 를 그대로 써서 모양만 넘긴다(학습자 헤더는 60초 캐시를 채우는 효과도 있다). 실패는 삼킨다.
 */
export async function prewarmTalkTurn(userId: string, chat: { kind: ChatKind; level: JlptLevel | null }): Promise<string> {
  if (chat.kind !== 'TALK') return 'NOT_TALK'
  try {
    const learner = await turnDeps.buildLearnerHeader(userId, chat.level)
    // sceneCap 을 주지 않는다 = 기본 2. 예열은 persona 모양만 맞추면 되고(상한은 [지시] 줄에만 있어 persona 바이트가 같다) 발화 신호가 없다.
    const req = buildTalkRequest({ todayKst: dates.todayKst(), learner, history: [], text: '…' })
    return await turnDeps.prewarm(req)
  } catch {
    return 'FAILED'
  }
}
