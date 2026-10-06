/**
 * 상황 역할극 대화(task-010d A1-서버) — #28 `{kind:'TALK', scenarioId, lessonId?}` 생성 서비스와 종료 재료 읽기.
 *
 * **라우트는 아직 닫혀 있다(Leader 결정 G1)**: `validate.ts` 의 `parseCreateChat` 가 `lessonId`·`scenarioId` 를 400 FEATURE_NOT_READY 로 막는다.
 * 이 파일의 함수는 단위 테스트·서비스 직접 스모크만 부른다. 가드 해제·라우트 연결(`parseRolePlayIds` → `createRolePlayChat`, 종료 라우트)은 010d-A3.
 * - 상황·레슨·주제 판정은 L3 읽기 함수(`resolveScenarioChatStart`)가 하고 여기서는 Chat 행만 쓴다(각 층은 자기 표만).
 * - 역할극 대화의 교정 방식은 설정과 무관하게 코치다 — 턴이 `Chat.scenarioId` 를 읽어 `resolveTalkCorrectionMode`(corrections/talkDelivery.ts)가 정한다.
 *   여기서는 그 칸을 채운다.
 * - 종료: 라우트가 **한 트랜잭션**에서 `readRolePlayEndFacts`(사용자 → 대화 행 잠금, 재료 읽기) → `learning.endScenarioRolePlay`(기록) 순으로 부른다.
 *   잠금 순서는 턴(`acceptTurn`)과 같다(사용자 → 대화).
 */
import type { ChatKind, JlptLevel } from '@prisma/client'
import { ApiError, lockUserRow, prisma, truncateCodePoints, type Tx } from '@/modules/infra'
import { resolveScenarioChatStart, type ScenarioChatStart, type ScenarioChatStartInput } from '@/modules/learning'
import { countChatCorrections } from '../corrections'
import { readCorrectionMeta } from '../corrections/talkDelivery'
import { CHAT_SELECT, notFoundChat, serializeChat, type ChatDto, type ChatRow } from './index'

/** 종료 판정에 읽는 학습자 말 상한(역할극 한 번은 보통 수십 턴 — 넘으면 앞쪽만 표현 확인에 쓰고 턴 수는 따로 센다). */
export const ROLE_PLAY_TURNS_READ_MAX = 500

function badId(field: string): never {
  throw new ApiError('VALIDATION', `${field} 형식이 올바르지 않습니다.`, { field, reason: 'id' })
}

function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || v.length === 0 || v.length > 40) badId(field)
  return v
}

/** #28 본문의 역할극 칸 — A3 가 `parseCreateChat` 의 가드 두 줄을 지운 뒤 그 결과에 더해 `createRolePlayChat` 으로 보낸다. */
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

export interface RolePlayChatDeps {
  resolveStart(userId: string, input: ScenarioChatStartInput): Promise<ScenarioChatStart>
  createChat(data: RolePlayChatRowData): Promise<ChatRow>
}

const defaultDeps: RolePlayChatDeps = {
  resolveStart: (userId, input) => resolveScenarioChatStart(userId, input),
  createChat: (data) => prisma.chat.create({ data, select: CHAT_SELECT }),
}

/** #28 응답(ChatDto) + 역할극 칸(additive). */
export interface RolePlayChatDto extends ChatDto {
  scenarioId: string
  lessonId: string | null
}

/**
 * 역할극 대화 만들기 — 제목 기본값은 상황 제목, 수준 기본값은 상황 수준(그 상황의 말 수준으로 연기한다), `lastMessageAt = createdAt`(#28 D9 와 같음).
 * 상황 없음·남의 상황·남의 레슨은 learning 판정이 404 로 막는다.
 */
export async function createRolePlayChat(userId: string, input: RolePlayChatInput, deps: RolePlayChatDeps = defaultDeps): Promise<RolePlayChatDto> {
  if (input.kind !== 'TALK') throw new ApiError('VALIDATION', '상황 역할극은 회화로만 열 수 있어요.', { field: 'kind', reason: 'TALK' })
  const start = await deps.resolveStart(userId, { scenarioId: input.scenarioId, lessonId: input.lessonId, topicId: input.topicId })
  const now = new Date()
  const c = await deps.createChat({
    userId,
    kind: 'TALK',
    title: input.title ?? truncateCodePoints(start.scenario.title, 100),
    topicId: start.topic?.id ?? null,
    scenarioId: start.scenario.id,
    lessonId: start.lessonId,
    level: input.level ?? start.scenario.level,
    lastMessageAt: now,
    createdAt: now,
  })
  return { ...serializeChat(c, false), scenarioId: start.scenario.id, lessonId: start.lessonId }
}

/** 종료 기록 재료(L2 표에서 읽은 값) — `learning.endScenarioRolePlay` 입력과 같은 이름. 학습자 말 원문은 표현 확인에만 쓴다. */
export interface RolePlayEndFacts {
  chatId: string
  /** `Chat.createdAt` — learning 이 끝낸 표식 조회의 시간 하한으로 쓴다(REV-134 M-2). */
  chatCreatedAt: Date
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

type ChatLockRow = { id: string; userId: string; kind: ChatKind; scenarioId: string | null; lessonId: string | null; topicId: string | null; createdAt: Date | string }

/**
 * 호출자 tx 안에서 — 사용자 행 → 대화 행(`FOR UPDATE`) 잠금 뒤 읽는다. 없음·남의 대화 404, 역할극이 아닌 대화(상황 없음·TALK 아님) 400.
 * `corrections.proposed` = 이 대화에서 제안된 교정 전부(상태 무관 — ADD_STUDY_LOG 채택 경로의 `correctionCount` 와 같은 뜻), `ignored` = 거절.
 */
export async function readRolePlayEndFacts(userId: string, chatId: string, tx: Tx): Promise<RolePlayEndFacts> {
  if (typeof chatId !== 'string' || !chatId || chatId.length > 40) throw notFoundChat()
  await lockUserRow(tx, userId)
  const rows = await tx.$queryRaw<ChatLockRow[]>`SELECT id, userId, kind, scenarioId, lessonId, topicId, createdAt FROM Chat WHERE id = ${chatId} FOR UPDATE`
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
