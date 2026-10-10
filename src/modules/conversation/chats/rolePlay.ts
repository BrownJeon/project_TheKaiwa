/**
 * 상황 역할극 대화(task-010d) — #28 `{kind:'TALK', scenarioId, lessonId?}` 생성(+ 첫마디 저장)·진행 값·#29 `chat.scenario`·#167 종료(판정 → 기록).
 *
 * - A1-서버(10-06): 생성 서비스·종료 재료 읽기. A3b-1(10-07): 라우트 가드 해제(`validate.ts`)·첫마디(D-3)·진행 값(D-4)·#29 보기·종료 흐름·턴 거부 표식.
 * - 상황·레슨·주제 판정과 상황 행 읽기는 L3 읽기 함수(`resolveScenarioChatStart`·`readScenarioRolePlayMaterial`)로만 한다 — 여기서는 Chat·ChatMessage·Correction 만 쓴다.
 * - 역할극 대화의 교정 방식은 설정과 무관하게 코치다 — 턴이 `Chat.scenarioId` 를 읽어 `resolveTalkCorrectionMode`(corrections/talkDelivery.ts)가 정한다.
 * - 종료(#167) 잠금 설계(L-7①·REV-134 M-2): 판정 LLM(최대 20초)을 사용자 행 잠금을 쥔 채 부르지 않는다.
 *     ① 짧은 tx: 사용자 → 대화 `FOR UPDATE` 아래 재료 읽기 · 진행 중 턴(살아 있는 PENDING) 409 `TURN_RUNNING` · 이미 끝냈는가 · 판정용 대화 읽기 → 커밋(잠금 풀림)
 *     ② 잠금 밖: 판정 호출(실패·시간 초과·학습자 말 0 → 판정 없음 `verdict:null`) → `finalizeScenarioVerdictFor` 결과만 넘긴다(L-1 — 모델 응답을 그대로 넘기지 않는다)
 *     ③ tx: 같은 순서로 다시 잠근 뒤 재확인 — 진행 중 턴 409, 학습자 말이 ①과 달라졌으면(그사이 턴이 끝남) 처음부터 한 번 더, 두 번째도 다르면 409 `TURN_RUNNING`
 *        → `learning.endScenarioRolePlay`(같은 tx, 멱등 — 동시에 두 번 마쳐도 기록은 한 번) → 처음 기록이면 같은 tx 에서 `Chat.endedAt = now`.
 *   턴 수락(`acceptTurn`)도 사용자 → 대화 순서로 잠그고 끝낸 대화를 409 `ROLEPLAY_ENDED` 로 거절하므로 ③과 턴은 어느 쪽이 먼저 와도 겹치지 않는다.
 * - 「끝냈는가」(task-048): 잠근 대화 행의 `Chat.endedAt` 을 먼저 본다(시계·조회 창 무관, 추가 쿼리 0). NULL 이면 관측(`SCENARIO_COMPLETED`) 기반 판정으로
 *   내려간다(2차 방어 — 옛 행·백필 전). `endedAt` 은 사용자 [마치기](이 흐름)만 쓴다. 응답 `endedAt` 도 이 값이 먼저다.
 */
import type { ChatKind, JlptLevel, Prisma } from '@prisma/client'
import { ApiError, classifyError, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type LlmJsonResult, type TraceRecord, type TraceStep } from '@/modules/engine'
import {
  assertScenarioStartableTx,
  detectScenarioExpressions,
  endedScenarioRolePlayChatIds,
  endScenarioRolePlay,
  isScenarioRolePlayEnded,
  readScenarioRolePlayMaterial,
  readScenarioRolePlayResult,
  resolveScenarioChatStart,
  scenarioExpressionView,
  type ScenarioChatStart,
  type ScenarioChatStartInput,
  type ScenarioEndInput,
  type ScenarioEndResult,
  type ScenarioRolePlayMaterial,
} from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import type { RolePlayChatView, RolePlayProgress, RolePlayResultView } from '@/types/chat'
import { countChatCorrections } from '../corrections'
import { readCorrectionMeta } from '../corrections/talkDelivery'
import { isMessageLocallyRunning, isStalePending } from '../orchestrator/locks'
import {
  buildScenarioVerdictRequest,
  finalizeScenarioVerdictFor,
  ScenarioVerdictInputError,
  SCENARIO_VERDICT_TURNS_READ_MAX,
  type ScenarioVerdictInput,
  type ScenarioVerdictTurn,
} from '../prompts/scenarioVerdict'
import { scenarioPromptParts } from '../prompts/scenarioInput'
import type { ScenarioVerdictFinal, ScenarioVerdictResponse } from '../structuredResponse/scenarioVerdict'
import { CHAT_SELECT, chatPreview, notFoundChat, serializeChat, type ChatDto, type ChatRow } from './index'

/** 종료 판정·진행 값에 읽는 학습자 말 상한(역할극 한 번은 보통 수십 턴 — 넘으면 앞쪽만 표현 확인에 쓰고 턴 수는 따로 센다). */
export const ROLE_PLAY_TURNS_READ_MAX = 500
/** 첫마디 메시지 `toolLog` 표식 — 계측 값이 없는 서버 저장 메시지라 턴 메시지와 구분한다(원문 없음). */
export const ROLE_PLAY_OPENING_SOURCE = 'SCENARIO_OPENING'

function badId(field: string): never {
  throw new ApiError('VALIDATION', `${field} 형식이 올바르지 않습니다.`, { field, reason: 'id' })
}

function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || v.length === 0 || v.length > 40) badId(field)
  return v
}

const validChatId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40

/** 원시 쿼리의 DATETIME 은 Date 로 오지만 드라이버 설정에 따라 글로 올 수 있다. 비었거나 올바르지 않으면 null. */
export function rawDateOrNull(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 마친 역할극에 말을 보냈을 때(턴 수락 거절) — 409 `ROLEPLAY_ENDED`. */
export function rolePlayEnded(): ApiError {
  return new ApiError('CONFLICT', '마친 역할극에는 더 말할 수 없어요.', { reason: 'ROLEPLAY_ENDED' })
}

function turnRunning(): ApiError {
  return new ApiError('CONFLICT', '선생님 대답이 끝나면 마칠 수 있어요.', { reason: 'TURN_RUNNING' })
}

/** #28 본문의 역할극 칸 — 라우트가 `parseCreateChat` 결과에 더해 `createRolePlayChat` 으로 보낸다. */
export function parseRolePlayIds(body: Record<string, unknown>): { scenarioId: string | null; lessonId: string | null } {
  return { scenarioId: optionalId(body.scenarioId, 'scenarioId'), lessonId: optionalId(body.lessonId, 'lessonId') }
}

export interface RolePlayChatInput {
  kind: ChatKind
  title: string | null
  level: JlptLevel | null
  topicId: string | null
  scenarioId: string | null
  lessonId: string | null
}

export interface RolePlayChatRowData {
  userId: string
  kind: 'TALK'
  title: string
  topicId: string | null
  scenarioId: string
  lessonId: string | null
  level: JlptLevel
  lastMessageAt: Date
  createdAt: Date
}

export interface RolePlayOpening {
  ja: string
  ko: string
}

export interface RolePlayChatDeps {
  resolveStart(userId: string, input: ScenarioChatStartInput): Promise<ScenarioChatStart>
  /** 상황 진행 재료(첫마디) — 없으면 첫마디 없이 만든다. */
  readMaterial(userId: string, scenarioId: string): Promise<Pick<ScenarioRolePlayMaterial, 'opening'> | null>
  /** Chat 행(+ 첫마디가 있으면 선생님 메시지 1행)을 한 트랜잭션에 — 그 트랜잭션의 첫 쓰기 전에 `guard` 를 부른다(사용자 잠금 뒤 상황 재확인). */
  createChat(data: RolePlayChatRowData, opening: RolePlayOpening | null, guard: RolePlayStartGuard): Promise<ChatRow>
}

/** 역할극 Chat 을 만드는 트랜잭션 안에서 첫 쓰기 전에 부르는 확인. */
export type RolePlayStartGuard = (tx: Tx, userId: string, scenarioId: string) => Promise<void>

/**
 * 저장 직전 재확인(Codex C2 High) — 사용자 행을 잠근 뒤 상황이 아직 시작할 수 있는지 learning 판정(`assertScenarioStartableTx`)으로 다시 본다.
 * 시작 판정(`resolveScenarioChatStart`)은 잠금 밖이라, 그 사이 끝난 상황 지우기·시드 숨김(같은 잠금)을 여기서 잡는다 — 오류는 시작 판정과 같다.
 * 일반 회화·채팅(`createChat`)은 이 경로를 타지 않는다.
 */
export const rolePlayStartGuard: RolePlayStartGuard = async (tx, userId, scenarioId) => {
  await lockUserRow(tx, userId)
  await assertScenarioStartableTx(tx, userId, scenarioId)
}

/** 첫마디 메시지의 `toolLog` — 화면이 읽는 `meta.style`(다시 듣기 #23 styleHint)·`meta.learning` 모양만 턴 메시지와 같게. */
export function openingToolLog(): Prisma.InputJsonValue {
  return { source: ROLE_PLAY_OPENING_SOURCE, meta: { learning: null, style: 'NEUTRAL', endOfTopic: false, warning: null } }
}

/**
 * Chat 행 + (첫마디가 있으면) 선생님 메시지 1행을 한 트랜잭션에. `run` 은 단위 테스트가 가짜 tx 로 바꾼다.
 * `guard` 가 있으면 같은 트랜잭션의 첫 쓰기 전에 부른다(역할극 시작은 `rolePlayStartGuard` — 던지면 아무것도 만들지 않는다).
 */
export async function createChatWithOpening(
  data: RolePlayChatRowData,
  opening: RolePlayOpening | null,
  run: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> = (fn) => withTransaction(fn),
  guard?: RolePlayStartGuard,
): Promise<ChatRow> {
  return run(async (tx) => {
    if (guard) await guard(tx, data.userId, data.scenarioId)
    const c = await tx.chat.create({ data: { ...data, ...(opening ? { messageCount: 1, preview: chatPreview(opening.ja) } : {}) }, select: CHAT_SELECT })
    if (opening) {
      // 선생님 첫 말(LLM 0회, D-3). TTS 는 화면이 기존 #23 경로로 요청한다(서버 합성 없음).
      await tx.chatMessage.create({
        data: { chatId: c.id, userId: data.userId, role: 'ASSISTANT', content: opening.ja, translation: opening.ko || null, status: 'DONE', createdAt: data.createdAt, toolLog: openingToolLog() },
        select: { id: true },
      })
    }
    return c
  })
}

const defaultDeps: RolePlayChatDeps = {
  resolveStart: (userId, input) => resolveScenarioChatStart(userId, input),
  readMaterial: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
  createChat: (data, opening, guard) => createChatWithOpening(data, opening, undefined, guard),
}

/** #28 응답(ChatDto) + 역할극 칸(additive). */
export interface RolePlayChatDto extends ChatDto {
  scenarioId: string
  lessonId: string | null
}

/**
 * 역할극 대화 만들기 — 제목 기본값은 상황 제목, 수준 기본값은 상황 수준(그 상황의 말 수준으로 연기한다), `lastMessageAt = createdAt`(#28 D9 와 같음).
 * 상황 없음·남의 상황·남의 레슨은 learning 판정이 404, 숨긴 상황 409 `ARCHIVED`. 첫마디(`opening.ja`)가 있으면 첫 선생님 메시지로 저장한다.
 * 첫마디는 선생님(ASSISTANT) 메시지라 학습자 말 수(`turns`·종료 `NO_TURNS`)에 들어가지 않는다.
 */
export async function createRolePlayChat(userId: string, input: RolePlayChatInput, deps: RolePlayChatDeps = defaultDeps): Promise<RolePlayChatDto> {
  if (input.kind !== 'TALK') throw new ApiError('VALIDATION', '상황 역할극은 회화로만 열 수 있어요.', { field: 'kind', reason: 'TALK' })
  const start = await deps.resolveStart(userId, { scenarioId: input.scenarioId, lessonId: input.lessonId, topicId: input.topicId })
  const material = await deps.readMaterial(userId, start.scenario.id)
  const opening = material?.opening?.ja ? { ja: material.opening.ja, ko: material.opening.ko ?? '' } : null
  const now = new Date()
  const c = await deps.createChat(
    {
      userId,
      kind: 'TALK',
      title: input.title ?? truncateCodePoints(start.scenario.title, 100),
      topicId: start.topic?.id ?? null,
      scenarioId: start.scenario.id,
      lessonId: start.lessonId,
      level: input.level ?? start.scenario.level,
      lastMessageAt: now,
      createdAt: now,
    },
    opening,
    rolePlayStartGuard,
  )
  return { ...serializeChat(c, false), scenarioId: start.scenario.id, lessonId: start.lessonId }
}

// ── 진행 값(D-4) ─────────────────────────────────────────────────────────────

/**
 * 진행 값 — **서버 코드만**(LLM 칸 없음). `usedIds` = 이 대화의 학습자 말 전체에서 코드가 확인한 핵심 표현(누적, 종료 판정 `verifiedIds` 와 같은 함수·재료).
 * `stepIndex` = 늘 null: 단계(`steps[{ko}]`)는 한국어 설명뿐이라 학습자 말·표현과 잇는 코드 신호가 없다. 턴 수 비례 같은 추정은 하지 않은 단계에 ✓ 를 그려
 * 학습 기록을 부풀리므로 쓰지 않는다(화면 `rp-nostep`). 단계 진행을 보이려면 표현 ↔ 단계 연결 칸(시드·초안)이 먼저 필요하다.
 */
export function rolePlayProgress(material: Pick<ScenarioRolePlayMaterial, 'expressions'>, learnerTexts: readonly string[]): RolePlayProgress {
  return { usedIds: detectScenarioExpressions(learnerTexts, material.expressions), stepIndex: null }
}

/** 이 대화의 학습자 말(원문 — 표현 확인에만, 저장·로그 없음). 시간순, 앞쪽 `ROLE_PLAY_TURNS_READ_MAX` 개. */
export async function loadRolePlayLearnerTexts(userId: string, chatId: string, db: Pick<Tx, 'chatMessage'> = prisma): Promise<string[]> {
  const rows = await db.chatMessage.findMany({
    where: { chatId, userId, role: 'USER' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: ROLE_PLAY_TURNS_READ_MAX,
    select: { content: true },
  })
  return rows.map((r) => r.content)
}

// ── #29 chat.scenario(S6) · 결과 보기(S8·S9) ─────────────────────────────────────

type EndResultLike = ScenarioEndResult

/** A1-서버 결과 + 화면 칸(S8). `next` 는 라우트가 추천으로 더한다. */
export function toRolePlayResultView(r: EndResultLike, pendingCorrections: number, endedAt: Date): RolePlayResultView {
  return {
    replayed: r.replayed,
    chatId: r.chatId,
    scenarioId: r.scenarioId,
    studyLogId: r.studyLogId,
    repetitionItemId: r.repetitionItemId,
    outcome: r.outcome,
    goalAchieved: r.goalAchieved,
    tutorGoalAchieved: r.tutorGoalAchieved,
    codeRulePassed: r.codeRulePassed,
    communicationSuccess: r.communicationSuccess,
    judged: r.judged,
    expressions: { usedIds: [...r.expressions.usedIds], missedIds: [...r.expressions.missedIds], verifiedIds: [...r.expressions.verifiedIds], required: r.expressions.required, total: r.expressions.total },
    turns: r.turns,
    hintsUsed: r.hintsUsed,
    selfCorrections: r.selfCorrections,
    pendingCorrections: Math.max(0, Math.floor(pendingCorrections)),
    endedAt: endedAt.toISOString(),
  }
}

export interface RolePlayChatRef {
  id: string
  createdAt: Date
  scenarioId: string
  lessonId: string | null
  /** `Chat.endedAt`(task-048) — 있으면 결과 `endedAt` 은 이 값. */
  endedAt?: Date | null
}

/** 결과 읽기에 넘기는 대화 칸 — `endedAt` 은 관측 조회 창 하한에도 쓴다(learning `scenarioEndLookupSince`). */
export type RolePlayResultChat = { id: string; createdAt: Date; scenarioId: string; endedAt?: Date | null }

export interface RolePlayViewDeps {
  readMaterial(userId: string, scenarioId: string): Promise<ScenarioRolePlayMaterial | null>
  learnerTexts(userId: string, chatId: string): Promise<string[]>
  readResult(userId: string, chat: RolePlayResultChat): Promise<(ScenarioEndResult & { endedAt: Date }) | null>
  pendingCorrections(userId: string, chatId: string): Promise<number>
}

export const rolePlayViewDeps: RolePlayViewDeps = {
  readMaterial: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
  learnerTexts: (userId, chatId) => loadRolePlayLearnerTexts(userId, chatId),
  readResult: (userId, chat) => readScenarioRolePlayResult(userId, chat),
  pendingCorrections: async (userId, chatId) => (await countChatCorrections(userId, chatId)).proposed,
}

/** #29 `chat.scenario` — 상황 행이 사라졌으면 null(대화는 일반 회화처럼 보인다). 쿼리: 재료 1~2 + 학습자 말 1 + 끝낸 표식 1(+ 끝났으면 기록 1·교정 수 1). */
export async function rolePlayChatView(userId: string, chat: RolePlayChatRef, deps: RolePlayViewDeps = rolePlayViewDeps): Promise<RolePlayChatView | null> {
  const [material, texts, result] = await Promise.all([
    deps.readMaterial(userId, chat.scenarioId),
    deps.learnerTexts(userId, chat.id),
    deps.readResult(userId, { id: chat.id, createdAt: chat.createdAt, scenarioId: chat.scenarioId, endedAt: chat.endedAt ?? null }),
  ])
  if (!material) return null
  const ended = result ? toRolePlayResultView(result, await deps.pendingCorrections(userId, chat.id), chat.endedAt ?? result.endedAt) : null
  return {
    id: material.id,
    title: material.title,
    titleJa: material.titleJa,
    roles: material.roles,
    goalKo: material.goal.communicativeGoalKo,
    steps: material.steps,
    keyExpressions: material.expressions.map(scenarioExpressionView),
    requiredExpressions: material.requiredExpressions,
    progress: rolePlayProgress(material, texts),
    ended,
  }
}

/**
 * #29 조합용 — 이 사용자의 대화가 역할극이면 `chat.scenario`, 아니면 null(일반 대화는 칸 없음). 소유는 `(id, userId)` 로만 찾는다(남의 대화 null — 404 는 #29 본체가 낸다).
 * 대화 행 1쿼리 + 역할극이면 `rolePlayChatView`.
 */
export async function chatRolePlayView(userId: string, chatId: string, deps: RolePlayViewDeps = rolePlayViewDeps, db: Pick<Tx, 'chat'> = prisma): Promise<(RolePlayChatView & { lessonId: string | null }) | null> {
  if (!validChatId(chatId)) return null
  const c = await db.chat.findFirst({ where: { id: chatId, userId }, select: { id: true, kind: true, scenarioId: true, lessonId: true, createdAt: true, endedAt: true } })
  if (!c || c.kind !== 'TALK' || !c.scenarioId) return null
  const view = await rolePlayChatView(userId, { id: c.id, createdAt: c.createdAt, scenarioId: c.scenarioId, lessonId: c.lessonId, endedAt: c.endedAt ?? null }, deps)
  return view ? { ...view, lessonId: c.lessonId } : null
}

// ── 종료 재료 · 종료 흐름(#167) ─────────────────────────────────────────────────

/** 종료 기록 재료(L2 표에서 읽은 값) — `learning.endScenarioRolePlay` 입력과 같은 이름. 학습자 말 원문은 표현 확인에만 쓴다. */
export interface RolePlayEndFacts {
  chatId: string
  /** `Chat.createdAt` — learning 이 끝낸 표식 조회의 시간 하한으로 쓴다(REV-134 M-2). */
  chatCreatedAt: Date
  /** 잠근 행의 `Chat.endedAt`(task-048) — 있으면 이미 끝낸 대화(정본). learning 입력 `chatEndedAt` 과 같은 이름. */
  chatEndedAt: Date | null
  scenarioId: string
  lessonId: string | null
  topicId: string | null
  turns: number
  learnerTexts: string[]
  corrections: { proposed: number; accepted: number; ignored: number }
  hintsUsed: number
  selfCorrections: number
  startedAt: Date | null
}

type ChatLockRow = { id: string; userId: string; kind: ChatKind; scenarioId: string | null; lessonId: string | null; topicId: string | null; createdAt: Date | string; endedAt?: Date | string | null }

/**
 * 호출자 tx 안에서 — 사용자 행 → 대화 행(`FOR UPDATE`) 잠금 뒤 읽는다. 없음·남의 대화 404, 역할극이 아닌 대화(상황 없음·TALK 아님) 400.
 * `corrections.proposed` = 이 대화에서 제안된 교정 전부(상태 무관 — ADD_STUDY_LOG 채택 경로의 `correctionCount` 와 같은 뜻), `ignored` = 거절.
 */
export async function readRolePlayEndFacts(userId: string, chatId: string, tx: Tx): Promise<RolePlayEndFacts> {
  if (!validChatId(chatId)) throw notFoundChat()
  await lockUserRow(tx, userId)
  const rows = await tx.$queryRaw<ChatLockRow[]>`SELECT id, userId, kind, scenarioId, lessonId, topicId, createdAt, endedAt FROM Chat WHERE id = ${chatId} FOR UPDATE`
  const chat = rows[0]
  if (!chat || chat.userId !== userId) throw notFoundChat()
  if (chat.kind !== 'TALK' || !chat.scenarioId) throw new ApiError('VALIDATION', '상황 역할극 대화가 아니에요.', { field: 'chatId', reason: 'not_scenario' })
  // 원시 쿼리의 DATETIME 은 Date 로 오지만 드라이버 설정에 따라 글로 올 수 있어 한 번 더 맞춘다(이상한 값이면 learning 이 하한 없이 찾는다 — 결과는 같다).
  const chatCreatedAt = chat.createdAt instanceof Date ? chat.createdAt : new Date(String(chat.createdAt))
  const msgs = await tx.chatMessage.findMany({
    where: { chatId, userId, role: 'USER' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: ROLE_PLAY_TURNS_READ_MAX,
    select: { content: true, createdAt: true, toolLog: true },
  })
  const turns = msgs.length < ROLE_PLAY_TURNS_READ_MAX ? msgs.length : await tx.chatMessage.count({ where: { chatId, userId, role: 'USER' } })
  let hintsUsed = 0
  let selfCorrections = 0
  for (const m of msgs) {
    const meta = readCorrectionMeta(m.toolLog)
    if (meta?.mode === 'COACH' && meta.hintKo) hintsUsed++
    if (meta?.selfCheck === 'SELF' || meta?.selfCheck === 'REPEAT') selfCorrections++
  }
  const c = await countChatCorrections(userId, chatId, tx)
  return {
    chatId,
    chatCreatedAt,
    chatEndedAt: rawDateOrNull(chat.endedAt),
    scenarioId: chat.scenarioId,
    lessonId: chat.lessonId,
    topicId: chat.topicId,
    turns,
    learnerTexts: msgs.map((m) => m.content),
    corrections: { proposed: c.total, accepted: c.accepted, ignored: c.rejected },
    hintsUsed,
    selfCorrections,
    startedAt: msgs[0]?.createdAt ?? null,
  }
}

/** 이 대화에 살아 있는 PENDING 선생님 메시지가 있는가(180초 넘은 죽은 행·이 프로세스가 돌리지 않는 행은 뺀다 — 턴 수락과 같은 판정). */
export async function hasLiveTurn(tx: Pick<Tx, 'chatMessage'>, userId: string, chatId: string, now: number = Date.now()): Promise<boolean> {
  const rows = await tx.chatMessage.findMany({ where: { chatId, userId, role: 'ASSISTANT', status: 'PENDING' }, select: { id: true, createdAt: true } })
  return rows.some((r) => !isStalePending(r.createdAt, now, isMessageLocallyRunning(r.id)))
}

export interface VerdictTranscript {
  turns: ScenarioVerdictTurn[]
  /** 마지막 선생님 말이 마무리(`endOfTopic`)였는가 — 판정의 `endedBy`·StudyLog `endOfTopic`. */
  endOfTopic: boolean
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** 판정용 대화 — DONE 메시지 최근 `SCENARIO_VERDICT_TURNS_READ_MAX` 개(첫마디 포함, PENDING·FAILED 제외), 시간순. 압축은 판정 빌더가 한다. */
export async function readVerdictTranscript(tx: Pick<Tx, 'chatMessage'>, userId: string, chatId: string): Promise<VerdictTranscript> {
  const rows = await tx.chatMessage.findMany({
    where: { chatId, userId, status: 'DONE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: SCENARIO_VERDICT_TURNS_READ_MAX,
    select: { role: true, content: true, toolLog: true },
  })
  rows.reverse()
  const lastTutor = [...rows].reverse().find((r) => r.role === 'ASSISTANT')
  return {
    turns: rows.filter((r) => r.content).map((r) => ({ role: r.role === 'USER' ? 'learner' : 'tutor', text: r.content })),
    endOfTopic: rec(rec(lastTutor?.toolLog).meta).endOfTopic === true,
  }
}

export interface RolePlayFinishDeps {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  readMaterial(userId: string, scenarioId: string): Promise<ScenarioRolePlayMaterial | null>
  learnerLevel(userId: string): Promise<string | null>
  completeVerdict(req: LlmJsonRequest<ScenarioVerdictResponse>): Promise<LlmJsonResult<ScenarioVerdictResponse>>
  isEnded(userId: string, chat: { id: string; createdAt: Date }, db: Tx): Promise<boolean>
  endRolePlay(userId: string, input: ScenarioEndInput, tx: Tx, opts: { now: Date }): Promise<ScenarioEndResult>
  readResult(userId: string, chat: RolePlayResultChat, db?: Tx): Promise<(ScenarioEndResult & { endedAt: Date }) | null>
  pendingCorrections(userId: string, chatId: string, db?: Tx): Promise<number>
  trace(t: TraceRecord): Promise<void>
  now(): Date
}

export const rolePlayFinishDeps: RolePlayFinishDeps = {
  transaction: (fn) => withTransaction(fn),
  readMaterial: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
  learnerLevel: async (userId) => (await getProfile(userId)).level,
  completeVerdict: (req) => llm.completeJson<ScenarioVerdictResponse>(req),
  isEnded: (userId, chat, db) => isScenarioRolePlayEnded(userId, chat, db),
  endRolePlay: (userId, input, tx, opts) => endScenarioRolePlay(userId, input, tx, opts),
  readResult: (userId, chat, db) => readScenarioRolePlayResult(userId, chat, db),
  pendingCorrections: async (userId, chatId, db) => (await countChatCorrections(userId, chatId, db)).proposed,
  trace: (t) => recordTrace(t),
  now: () => new Date(),
}

const resultChat = (f: RolePlayEndFacts): RolePlayResultChat => ({ id: f.chatId, createdAt: f.chatCreatedAt, scenarioId: f.scenarioId, endedAt: f.chatEndedAt })

const sameLearnerTurns = (a: RolePlayEndFacts, b: RolePlayEndFacts): boolean =>
  a.turns === b.turns && a.learnerTexts.length === b.learnerTexts.length && a.learnerTexts.every((t, i) => t === b.learnerTexts[i])

/**
 * 판정(잠금 밖) — 실패는 전부 null(판정 없이 코드 규칙만으로 기록, "거의" 이하). Trace 에는 수치만(인용·학습자 말 원문 없음).
 * 모델 응답은 `finalizeScenarioVerdictFor` 로 증거 대조한 결과만 돌려준다(L-1).
 */
async function judgeRolePlay(userId: string, facts: RolePlayEndFacts, transcript: VerdictTranscript, deps: RolePlayFinishDeps, steps: TraceStep[]): Promise<ScenarioVerdictFinal | null> {
  const t0 = Date.now()
  const step = (extra: Omit<TraceStep, 'name' | 'ms'>) => steps.push({ name: 'SCENARIO_VERDICT', ms: Date.now() - t0, ...extra })
  const material = await deps.readMaterial(userId, facts.scenarioId)
  if (!material) {
    step({ skipped: 'NO_SCENARIO' })
    return null
  }
  const parts = scenarioPromptParts(material.row, material.chunks)
  const input: ScenarioVerdictInput = {
    ...parts.verdict,
    level: await deps.learnerLevel(userId).catch(() => null),
    turns: transcript.turns,
    verifiedExpressionIds: detectScenarioExpressions(facts.learnerTexts, material.expressions),
    endedBy: transcript.endOfTopic ? 'TUTOR' : 'LEARNER',
  }
  let req: LlmJsonRequest<ScenarioVerdictResponse>
  try {
    req = buildScenarioVerdictRequest(input)
  } catch (e) {
    if (e instanceof ScenarioVerdictInputError) {
      step({ skipped: 'NO_LEARNER_TEXT' })
      return null
    }
    throw e
  }
  try {
    const r = await deps.completeVerdict(req)
    const fin = finalizeScenarioVerdictFor(input, r.data)
    const rejected = (reason: string) => fin.rejectedClaims.filter((c) => c.reason === reason).length
    step({
      connection: r.connectionKey,
      model: r.model,
      attempts: r.attempts ?? 1,
      promptChars: r.promptChars,
      goalAchieved: fin.goalAchieved,
      communicationSuccess: fin.communicationSuccess,
      stepsReached: fin.stepsReached,
      used: fin.usedExpressionIds.length,
      rejectedUnknownId: rejected('UNKNOWN_ID'),
      rejectedNoQuote: rejected('NO_QUOTE_MATCH'),
      rejectedLoose: rejected('LOOSE_MATCH'),
    })
    return fin
  } catch (e) {
    step({ errorCode: classifyError(e).code })
    return null
  }
}

interface FinishSnapshot {
  facts: RolePlayEndFacts
  ended: boolean
  transcript: VerdictTranscript | null
}

/**
 * 끝낸 표식(task-048) — 처음 기록한 tx 에서만, 비어 있는 행에만 쓴다(덮어쓰지 않음). `now` 는 관측 `occurredAt` 과 같은 값.
 * 잠근 행이라 같은 대화의 다른 종료·턴과 겹치지 않는다(선례 `review` 의 `reviewedAt: null` 조건부 갱신).
 */
export async function markRolePlayChatEnded(tx: Pick<Tx, 'chat'>, userId: string, chatId: string, now: Date): Promise<void> {
  await tx.chat.updateMany({ where: { id: chatId, userId, endedAt: null }, data: { endedAt: now } })
}

/** 학습자 말 0 — 기록 없음(데모 "그만두기"). learning `endScenarioRolePlay` 와 같은 코드·문구. */
function noTurns(): ApiError {
  return new ApiError('CONFLICT', '아직 한 마디도 하지 않았어요.', { reason: 'NO_TURNS' })
}

/**
 * #167 역할극 마치기 — 위 머리말 ①②③. 결과는 `ResultView`(S8, `next` 는 라우트가 더한다). 이미 끝낸 대화면 판정 없이 처음 결과(`replayed:true`).
 * 오류: 없음·남의 대화 404 · 역할극 아님 400 · 학습자 말 0 409 `NO_TURNS` · 진행 중 턴 409 `TURN_RUNNING`.
 */
export async function finishRolePlay(userId: string, chatId: string, deps: RolePlayFinishDeps = rolePlayFinishDeps): Promise<RolePlayResultView> {
  if (!validChatId(chatId)) throw notFoundChat()
  const traceId = newTraceId()
  const started = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    for (let attempt = 0; ; attempt++) {
      const snap = await deps.transaction<FinishSnapshot>(async (tx) => {
        const facts = await readRolePlayEndFacts(userId, chatId, tx)
        if (await hasLiveTurn(tx, userId, chatId)) throw turnRunning()
        const ended = facts.chatEndedAt !== null || (await deps.isEnded(userId, { id: chatId, createdAt: facts.chatCreatedAt }, tx))
        const transcript = ended || facts.turns === 0 ? null : await readVerdictTranscript(tx, userId, chatId)
        return { facts, ended, transcript }
      })
      if (snap.ended) {
        const r = await deps.readResult(userId, resultChat(snap.facts))
        if (r) {
          steps.push({ name: 'SCENARIO_FINISH', ms: Date.now() - started, replayed: true })
          return toRolePlayResultView({ ...r, replayed: true }, await deps.pendingCorrections(userId, chatId), snap.facts.chatEndedAt ?? r.endedAt)
        }
      }
      if (snap.facts.turns === 0) throw noTurns()
      const verdict = snap.transcript ? await judgeRolePlay(userId, snap.facts, snap.transcript, deps, steps) : null
      const view = await deps.transaction<RolePlayResultView | null>(async (tx) => {
        const facts = await readRolePlayEndFacts(userId, chatId, tx)
        if (await hasLiveTurn(tx, userId, chatId)) throw turnRunning()
        if (!sameLearnerTurns(snap.facts, facts)) return null
        const now = deps.now()
        // facts.chatEndedAt 이 있으면 learning 은 쓰지 않는다(재생). 없을 때 처음 기록이면 같은 tx 에서 Chat 표식을 같은 now 로.
        const r = await deps.endRolePlay(userId, { ...facts, endOfTopic: snap.transcript?.endOfTopic === true, verdict }, tx, { now })
        if (!r.replayed && facts.chatEndedAt === null) await markRolePlayChatEnded(tx, userId, chatId, now)
        const endedAt = facts.chatEndedAt ?? (r.replayed ? ((await deps.readResult(userId, resultChat(facts), tx))?.endedAt ?? now) : now)
        return toRolePlayResultView(r, await deps.pendingCorrections(userId, chatId, tx), endedAt)
      })
      if (view) {
        steps.push({ name: 'SCENARIO_FINISH', ms: Date.now() - started, replayed: view.replayed, outcome: view.outcome, judged: view.judged, attempt })
        return view
      }
      steps.push({ name: 'SCENARIO_FINISH_RETRY', ms: Date.now() - started, attempt })
      if (attempt >= 1) throw turnRunning()
    }
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    throw e
  } finally {
    // 판정을 부른 종료만 Trace 를 남긴다(재생·거절은 LLM 0 — 행만 늘리지 않게).
    if (steps.some((s) => s.name === 'SCENARIO_VERDICT')) {
      // 응답을 Trace insert 에 묶지 않는다(REV-140 L-7 — 다른 LLM 흐름과 같이 기다리지 않음).
      void deps.trace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - started, errorCode, refType: 'scenarioFinish', refId: chatId }).catch(() => undefined)
    }
  }
}

// ── #27 목록 행의 역할극 칸(D-5 뱃지) ─────────────────────────────────────────────

/** 목록 행의 역할극 칸 `scenario?: {id, ended}`(additive). 일반 대화 행은 칸 없음. */
export interface RolePlayListBadge {
  id: string
  ended: boolean
}

export type EndedRolePlayLookup = (userId: string, chats: { id: string; createdAt: Date }[]) => Promise<Set<string>>

/**
 * #27 한 쪽(≤ limit 행)의 역할극 칸 — 역할극 행(TALK·`scenarioId` 있음)만 모아 끝낸 표식을 **한 번의 배치 조회**로 확인한다
 * (learning `endedScenarioRolePlayChatIds` — 창 하한 = 그 행들의 `Chat.createdAt` 최솟값 − 여유). 역할극 행이 없으면 조회 0. 행마다 조회하지 않는다.
 * `Chat.endedAt` 이 있는 행은 조회 없이 끝남(task-048) — 배치 조회는 NULL 행만(전부 차 있으면 조회 0).
 */
export async function rolePlayListBadges(
  userId: string,
  rows: readonly { id: string; kind: ChatKind; scenarioId: string | null; createdAt: Date; endedAt?: Date | null }[],
  endedChats: EndedRolePlayLookup = (u, chats) => endedScenarioRolePlayChatIds(u, chats),
): Promise<Map<string, RolePlayListBadge>> {
  const rp = rows.filter((r): r is typeof r & { scenarioId: string } => r.kind === 'TALK' && !!r.scenarioId)
  if (!rp.length) return new Map()
  const open = rp.filter((r) => !r.endedAt)
  const ended = open.length ? await endedChats(userId, open.map((r) => ({ id: r.id, createdAt: r.createdAt }))) : new Set<string>()
  return new Map(rp.map((r) => [r.id, { id: r.scenarioId, ended: !!r.endedAt || ended.has(r.id) }]))
}

// ── 진행 중 칸(#161·#162 `inProgressChatId`) ────────────────────────────────────

/** 상황마다 최근 대화 몇 개까지만 후보로(끝낸 대화 걸러내기·최근 1개 고르기는 learning 이 한다). */
export const OPEN_ROLE_PLAY_PER_SCENARIO = 3
/** 후보 전체 상한(사용자 TALK 대화를 `lastMessageAt` 인덱스 순으로 읽다 이만큼 차면 멈춘다). */
export const OPEN_ROLE_PLAY_MAX = 300
/**
 * 이보다 오래 말이 없던 역할극은 "이어 하기" 후보로 보지 않는다(REV-140 L-4) — 방치한 옛 대화 하나가 카탈로그의 끝낸 표식 조회 창(가장 오래된 후보 생성 − 여유)을
 * 몇 달로 늘리지 않게. 대화 자체는 #27 목록에 그대로 있고, 이 상황을 다시 고르면 새 역할극이 열린다.
 */
export const OPEN_ROLE_PLAY_MAX_AGE_DAYS = 30

/**
 * 진행 중 역할극 후보 — 상황마다 최근 TALK 대화 ≤3개(`lastMessageAt` 내림차순). `Chat(userId, kind, lastMessageAt)` 인덱스 순서로 읽고 `scenarioId in (…)` 로 거른다.
 * 라우트가 `listScenarios(…, { openChats: listOpenRolePlayChats })` 로 넘긴다(learning 은 Chat 을 읽지 않는다 — 6층).
 * 읽는 행 수는 `OPEN_ROLE_PLAY_MAX` 고정이다 — `상황 수 × 3` 으로 자르면 자주 한 상황의 최근 대화가 창을 다 채워 다른 상황의 진행 중 대화가 빠진다(상황마다 ≤3 은 아래에서 센다).
 * `Chat.endedAt` 이 있는 대화(사용자가 마친 역할극, task-048)는 여기서 뺀다 — 카탈로그의 관측 기반 거르기는 옛 행(NULL)만 맡는 2차 방어다.
 */
export async function listOpenRolePlayChats(
  userId: string,
  scenarioIds: string[],
  db: Pick<Tx, 'chat'> = prisma,
  now: Date = new Date(),
): Promise<{ scenarioId: string; chatId: string; at: Date; createdAt: Date }[]> {
  const ids = [...new Set(scenarioIds.filter(validChatId))]
  if (!ids.length) return []
  const rows = await db.chat.findMany({
    where: { userId, kind: 'TALK', scenarioId: { in: ids }, endedAt: null, lastMessageAt: { gte: new Date(now.getTime() - OPEN_ROLE_PLAY_MAX_AGE_DAYS * 86_400_000) } },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: OPEN_ROLE_PLAY_MAX,
    select: { id: true, scenarioId: true, lastMessageAt: true, createdAt: true },
  })
  const per = new Map<string, number>()
  const out: { scenarioId: string; chatId: string; at: Date; createdAt: Date }[] = []
  for (const r of rows) {
    if (!r.scenarioId) continue
    const n = per.get(r.scenarioId) ?? 0
    if (n >= OPEN_ROLE_PLAY_PER_SCENARIO) continue
    per.set(r.scenarioId, n + 1)
    out.push({ scenarioId: r.scenarioId, chatId: r.id, at: r.lastMessageAt ?? r.createdAt, createdAt: r.createdAt })
  }
  return out
}
