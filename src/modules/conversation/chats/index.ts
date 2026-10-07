/**
 * 대화(Chat·ChatMessage) CRUD·조회(api-contract #27~#31). 소유자가 아니면 존재를 숨기고 404(§0-4).
 *
 * - `running` = 이 채팅에 살아 있는 PENDING 강사 메시지가 있는가. 조회 전에 stale PENDING 을 지연 정리한다(범위결정 6).
 * - 메시지 정렬은 `(createdAt, id)` 오름차순. #29 `after` 없으면 최근 `limit` 건 + 더 오래된 쪽 커서(D2).
 * - 응답에 `toolLog`·엔진·모델명은 싣지 않는다(개발자는 `traceId` 로 관리자 Trace 를 본다).
 */
import type { ChatKind, JlptLevel, Prisma } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor, prisma, toPreview, truncateCodePoints } from '@/modules/infra'
import { getTopicRef, mapTopicGone } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'
import { isStalePending, locallyRunningMessageIds, STALE_PENDING_MS } from '../orchestrator/locks'
import { serializeCorrection, CORRECTION_SELECT } from '../corrections/serialize'
import { countLaterPending } from '../corrections'
import { readCorrectionMeta, talkCorrectionFields, type CorrectionDeliver, type SelfCheckResult } from '../corrections/talkDelivery'
import { SPEECH_STYLES } from '../structuredResponse/schemas'
import type { CreateChatInput } from './validate'
import { rolePlayListBadges } from './rolePlay'

export const PREVIEW_MAX = 120

export function notFoundChat(): ApiError {
  return new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
}

export const CHAT_SELECT = {
  id: true, kind: true, title: true, level: true, lastMessageAt: true, preview: true, messageCount: true, reviewedAt: true, createdAt: true,
  topic: { select: { id: true, title: true } },
} as const

export type ChatRow = Prisma.ChatGetPayload<{ select: typeof CHAT_SELECT }>

export interface ChatDto {
  id: string
  kind: ChatKind
  title: string
  topic: { id: string; title: string } | null
  level: JlptLevel | null
  lastMessageAt: string | null
  preview: string | null
  messageCount: number
  reviewedAt: string | null
  running: boolean
  createdAt: string
  /** #27 목록의 상황 역할극 행만(task-010d A3b-2, additive) — 상황 id·끝냈는가. 일반 대화 행에는 칸이 없다. */
  scenario?: { id: string; ended: boolean }
}

export function serializeChat(c: ChatRow, running: boolean): ChatDto {
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    topic: c.topic ? { id: c.topic.id, title: c.topic.title } : null,
    level: c.level,
    lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
    preview: c.preview,
    messageCount: c.messageCount,
    reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
    running,
    createdAt: c.createdAt.toISOString(),
  }
}

/**
 * stale PENDING → FAILED(180초 초과 + 이 프로세스가 돌리지 않는 것만). 기동 시(instrumentation)와 조회 시 부른다.
 * 범위를 좁히면(userId·chatId) 조회 경로가 전 테이블을 훑지 않는다.
 */
export async function sweepStalePending(scope: { userId?: string; chatId?: string } = {}, now = Date.now()): Promise<number> {
  const running = locallyRunningMessageIds()
  const res = await prisma.chatMessage.updateMany({
    where: {
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.chatId ? { chatId: scope.chatId } : {}),
      role: 'ASSISTANT',
      status: 'PENDING',
      createdAt: { lt: new Date(now - STALE_PENDING_MS) },
      ...(running.length ? { id: { notIn: running } } : {}),
    },
    data: { status: 'FAILED' },
  })
  return res.count
}

export async function runningChatIds(chatIds: string[]): Promise<Set<string>> {
  if (!chatIds.length) return new Set()
  const rows = await prisma.chatMessage.findMany({
    where: { chatId: { in: chatIds }, role: 'ASSISTANT', status: 'PENDING' },
    select: { chatId: true, id: true, createdAt: true },
  })
  const now = Date.now()
  const local = new Set(locallyRunningMessageIds())
  return new Set(rows.filter((r) => !isStalePending(r.createdAt, now, local.has(r.id))).map((r) => r.chatId))
}

/** 기본 제목 — 주제 제목 > 종류별 기본값(#28 "없으면 주제 제목 또는 새 회화"; 채팅은 "새 채팅"). */
function defaultTitle(kind: 'TALK' | 'CHAT', topicTitle: string | null): string {
  if (topicTitle) return truncateCodePoints(topicTitle, 100)
  return kind === 'CHAT' ? '새 채팅' : '새 회화'
}

/**
 * #28 — `lastMessageAt = createdAt`(D9: 빈 채팅도 목록 정렬에 바로 들어간다).
 * 사용자 행 잠금은 쓰지 않는다 — 확인(`getTopicRef`)과 저장 사이에 주제 삭제(#173)가 커밋되면 FK 위반(P2003)이 나므로 404 `TOPIC_GONE` 으로 바꾼다(REV-152a M-1).
 */
export async function createChat(userId: string, input: CreateChatInput, over?: { db?: typeof prisma }): Promise<ChatDto> {
  const db = over?.db ?? prisma
  const topic = input.topicId ? await getTopicRef(userId, input.topicId, db) : null
  if (input.topicId && !topic) throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.')
  const level = input.level ?? (await getProfile(userId)).level
  const now = new Date()
  let c
  try {
    c = await db.chat.create({
      data: {
        userId,
        kind: input.kind,
        title: input.title ?? defaultTitle(input.kind, topic?.title ?? null),
        topicId: topic?.id ?? null,
        level,
        lastMessageAt: now,
        createdAt: now,
      },
      select: CHAT_SELECT,
    })
  } catch (e) {
    throw mapTopicGone(e)
  }
  return serializeChat(c, false)
}

const LIST_SELECT = { ...CHAT_SELECT, scenarioId: true } as const

/** #27 — `lastMessageAt desc, id desc`, 키셋 커서. 역할극 행은 `scenario{id, ended}`(한 쪽당 끝낸 표식 배치 조회 1회 — `rolePlayListBadges`). */
export async function listChats(userId: string, q: { kind?: ChatKind; limit: number; cursor?: string | null }): Promise<{ items: ChatDto[]; nextCursor: string | null }> {
  const cur = decodeCursor(q.cursor, isTimeIdCursor)
  await sweepStalePending({ userId })
  const where: Prisma.ChatWhereInput = {
    userId,
    ...(q.kind ? { kind: q.kind } : {}),
    ...(cur ? { OR: [{ lastMessageAt: { lt: new Date(cur.t) } }, { lastMessageAt: new Date(cur.t), id: { lt: cur.id } }] } : {}),
  }
  const rows = await prisma.chat.findMany({ where, orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }], take: q.limit + 1, select: LIST_SELECT })
  const page = rows.slice(0, q.limit)
  const [running, badges] = await Promise.all([runningChatIds(page.map((c) => c.id)), rolePlayListBadges(userId, page)])
  const last = page.at(-1)
  const nextCursor = rows.length > q.limit && last?.lastMessageAt ? encodeCursor({ t: last.lastMessageAt.toISOString(), id: last.id }) : null
  return {
    items: page.map((c) => {
      const badge = badges.get(c.id)
      return { ...serializeChat(c, running.has(c.id)), ...(badge ? { scenario: badge } : {}) }
    }),
    nextCursor,
  }
}

/** 소유자 확인용 최소 조회 — 없으면 404. */
export async function getOwnedChat(userId: string, chatId: string): Promise<ChatRow> {
  if (typeof chatId !== 'string' || !chatId || chatId.length > 40) throw notFoundChat()
  const c = await prisma.chat.findFirst({ where: { id: chatId, userId }, select: CHAT_SELECT })
  if (!c) throw notFoundChat()
  return c
}

/**
 * 주어진 id 중 이 사용자가 소유한 채팅 id 만(읽기 전용, 한 번 조회). 학습 기록 원본 존재 확인(task-012 #71·#72)에서
 * 라우트가 learning 에 넘긴다 — L3 는 L2 를 import 하지 않는다.
 */
export async function ownedChatIds(userId: string, ids: readonly string[]): Promise<Set<string>> {
  const valid = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 40))]
  if (!valid.length) return new Set()
  const rows = await prisma.chat.findMany({ where: { userId, id: { in: valid } }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

export interface MessageDto {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  /** task-036 이전 메시지의 히라가나 읽기(옛 값 호환용으로 응답에 둔다). 화면이 쓰지 않고 새 메시지는 늘 null. */
  reading: string | null
  translation: string | null
  inputSource: string | null
  status: 'PENDING' | 'DONE' | 'FAILED'
  createdAt: string
  traceId?: string | null
  learning?: { grammarPoint: string | null; difficulty: string | null } | null
  /** ASSISTANT: 저장된 LLM `speech.style`(다시 듣기 #23 의 styleHint — 같은 캐시 키로 HIT). task-007. */
  speechStyle?: string | null
  corrections?: (ReturnType<typeof serializeCorrection> & TalkCorrectionView)[]
}

/** TALK 교정의 표시 필드(task-010c) — 표시 시점·코치 힌트·자기수정 판정. CHAT 교정에는 싣지 않는다. */
export interface TalkCorrectionView {
  deliver?: CorrectionDeliver
  hintKo?: string | null
  selfCheck?: SelfCheckResult | null
}

const MESSAGE_SELECT = { id: true, role: true, content: true, reading: true, translation: true, inputSource: true, status: true, createdAt: true, traceId: true, toolLog: true } as const
type MessageRow = Prisma.ChatMessageGetPayload<{ select: typeof MESSAGE_SELECT }>

/** toolLog 에서 화면에 필요한 학습 메타만 꺼낸다(toolLog 자체는 내보내지 않는다). */
function learningFrom(toolLog: Prisma.JsonValue | null): MessageDto['learning'] {
  const meta = toolLog && typeof toolLog === 'object' && !Array.isArray(toolLog) ? (toolLog as Record<string, unknown>).meta : null
  const l = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).learning : null
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null
  const r = l as Record<string, unknown>
  return { grammarPoint: typeof r.grammarPoint === 'string' ? r.grammarPoint : null, difficulty: typeof r.difficulty === 'string' ? r.difficulty : null }
}

const STYLES = new Set<string>(SPEECH_STYLES)

/** toolLog.meta.style — §67 speech.style 값만. */
function styleFrom(toolLog: Prisma.JsonValue | null): string | null {
  const meta = toolLog && typeof toolLog === 'object' && !Array.isArray(toolLog) ? (toolLog as Record<string, unknown>).meta : null
  const st = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).style : null
  return typeof st === 'string' && STYLES.has(st) ? st : null
}

function serializeMessage(m: MessageRow, corrections: MessageDto['corrections'] | undefined): MessageDto {
  const base: MessageDto = {
    id: m.id,
    role: m.role,
    content: m.content,
    reading: m.reading,
    translation: m.translation,
    inputSource: m.inputSource,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }
  if (m.role === 'USER') return { ...base, corrections: corrections ?? [] }
  return { ...base, traceId: m.traceId, learning: m.status === 'DONE' ? learningFrom(m.toolLog) : null, speechStyle: m.status === 'DONE' ? styleFrom(m.toolLog) : null }
}

export interface ChatDetailDto {
  chat: { id: string; kind: ChatKind; title: string; level: JlptLevel | null; running: boolean; reviewedAt: string | null; messageCount: number }
  messages: MessageDto[]
  pendingProposals: number
  /** TALK 만 — 이 회화 전체(페이지와 무관)의 아직 처리하지 않은 "모아 둔 교정"(deliver=LATER·PROPOSED) 수(task-010c). */
  laterPending?: number
  nextCursor: string | null
}

/** #29 — `after`(폴링: 그 이후 오름차순) / `cursor`(더 오래된 쪽) / 둘 다 없으면 최근 `limit` 건(오름차순). */
export async function getChatDetail(userId: string, chatId: string, q: { after?: string | null; cursor?: string | null; limit: number }): Promise<ChatDetailDto> {
  const chat = await getOwnedChat(userId, chatId)
  await sweepStalePending({ chatId })
  const running = (await runningChatIds([chatId])).has(chatId)

  let rows: MessageRow[]
  let nextCursor: string | null = null
  if (q.after) {
    const a = await prisma.chatMessage.findFirst({ where: { id: q.after, chatId }, select: { id: true, createdAt: true } })
    if (!a) throw new ApiError('VALIDATION', 'after 가 이 채팅의 메시지가 아닙니다.', { field: 'after' })
    rows = await prisma.chatMessage.findMany({
      where: { chatId, OR: [{ createdAt: { gt: a.createdAt } }, { createdAt: a.createdAt, id: { gt: a.id } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: q.limit,
      select: MESSAGE_SELECT,
    })
  } else {
    const cur = decodeCursor(q.cursor, isTimeIdCursor)
    const older = await prisma.chatMessage.findMany({
      where: { chatId, ...(cur ? { OR: [{ createdAt: { lt: new Date(cur.t) } }, { createdAt: new Date(cur.t), id: { lt: cur.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      select: MESSAGE_SELECT,
    })
    const page = older.slice(0, q.limit)
    const oldest = page.at(-1)
    if (older.length > q.limit && oldest) nextCursor = encodeCursor({ t: oldest.createdAt.toISOString(), id: oldest.id })
    rows = page.reverse()
  }

  const userIds = rows.filter((m) => m.role === 'USER').map((m) => m.id)
  const corrections = userIds.length
    ? await prisma.correction.findMany({ where: { messageId: { in: userIds }, userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: CORRECTION_SELECT })
    : []
  const talk = chat.kind === 'TALK'
  const toolLogOf = new Map(rows.map((m) => [m.id, m.toolLog]))
  const byMessage = new Map<string, NonNullable<MessageDto['corrections']>>()
  for (const c of corrections) {
    const list = byMessage.get(c.messageId) ?? []
    list.push(talk ? { ...serializeCorrection(c), ...talkCorrectionFields(readCorrectionMeta(toolLogOf.get(c.messageId), c.id)) } : serializeCorrection(c))
    byMessage.set(c.messageId, list)
  }
  const now = new Date()
  const pendingProposals = await prisma.tutorProposal.count({
    where: { chatId, userId, status: 'PROPOSED', OR: [{ expiresAt: { gt: now } }, { expiresAt: null, createdAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } }] },
  })
  return {
    chat: { id: chat.id, kind: chat.kind, title: chat.title, level: chat.level, running, reviewedAt: chat.reviewedAt ? chat.reviewedAt.toISOString() : null, messageCount: chat.messageCount },
    messages: rows.map((m) => serializeMessage(m, byMessage.get(m.id))),
    pendingProposals,
    ...(talk ? { laterPending: await countLaterPending(userId, chatId) } : {}),
    nextCursor,
  }
}

/** #30 제목 바꾸기. */
export async function updateChatTitle(userId: string, chatId: string, title: string): Promise<ChatDto> {
  await getOwnedChat(userId, chatId)
  const res = await prisma.chat.updateMany({ where: { id: chatId, userId }, data: { title } })
  if (res.count === 0) throw notFoundChat()
  const c = await getOwnedChat(userId, chatId)
  return serializeChat(c, (await runningChatIds([chatId])).has(chatId))
}

/** #31 삭제 — 메시지·교정 cascade, 제안은 SetNull 로 남는다(StudyLog·StatsSnapshot 불변). */
export async function deleteChat(userId: string, chatId: string): Promise<{ deleted: true }> {
  if (typeof chatId !== 'string' || !chatId || chatId.length > 40) throw notFoundChat()
  const res = await prisma.chat.deleteMany({ where: { id: chatId, userId } })
  if (res.count === 0) throw notFoundChat()
  return { deleted: true }
}

/** 목록 미리보기(120 코드포인트, 글자 경계에서 자름). */
export function chatPreview(text: string): string {
  return toPreview(text, PREVIEW_MAX)
}
