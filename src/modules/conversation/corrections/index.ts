/**
 * 교정 — 목록(#34)과 상태 전이(#35·#36)만. **쓰기(단어장·오류 통계·스냅샷)는 여기서 하지 않는다** — 라우트가 연 트랜잭션에서
 * learning 에 위임한다(module-dependency 행렬 판독 규칙 2).
 *
 * 원문 보존(domain-model 규칙 3): 모든 UPDATE 는 `updateCorrections()` 한 곳을 지나고, 그 데이터 타입에서 `original` 을 뺐다 —
 * 누가 `original` 을 넣으면 **컴파일 오류**가 난다. 상태 전이는 `status=PROPOSED` 조건부 `updateMany` 라 동시 채택은 한 건만 이긴다.
 */
import type { ErrorType, ChunkType, Prisma, ProposalStatus } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isOffsetCursor, isTimeIdCursor, lockUserRow, prisma, type Tx } from '@/modules/infra'
import { CORRECTION_SELECT, serializeCorrection, type CorrectionDto } from './serialize'

export const CORRECTION_STATUSES = ['PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const

/** `original` 이 빠진 갱신 데이터 — 원문은 어떤 경로로도 바꾸지 않는다. */
export type CorrectionUpdate = Omit<Prisma.CorrectionUncheckedUpdateManyInput, 'original' | 'id' | 'userId' | 'chatId' | 'messageId'>

async function updateCorrections(db: Tx, where: { id: string; userId: string; status?: ProposalStatus }, data: CorrectionUpdate): Promise<number> {
  const res = await db.correction.updateMany({ where, data })
  return res.count
}

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '교정을 찾을 수 없어요.')
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 40
}

/** 0행 전이의 이유 — 없거나 남의 것 → 404, 이미 처리됨 → 409 `{ status }`(D6). */
async function explainNoop(db: Tx, userId: string, id: string): Promise<never> {
  const cur = await db.correction.findFirst({ where: { id, userId }, select: { status: true } })
  if (!cur) throw notFound()
  throw new ApiError('CONFLICT', '이미 처리된 교정이에요.', { status: cur.status })
}

export interface AcceptedCorrection {
  id: string
  chatId: string
  messageId: string
  errorType: ErrorType
  chunkType: ChunkType | null
  corrected: string
  resolvedAt: string
}

/** #35 상태 전이(PROPOSED → ACCEPTED) — 라우트 트랜잭션 `tx` 안에서. */
export async function acceptCorrection(userId: string, id: string, tx: Tx): Promise<AcceptedCorrection> {
  if (!validId(id)) throw notFound()
  // 잠금 순서 통일(사용자 → 행): 뒤이은 단어 저장(createWord)도 사용자 행을 잡으므로 여기서 먼저 잡는다.
  await lockUserRow(tx, userId)
  const now = new Date()
  const n = await updateCorrections(tx, { id, userId, status: 'PROPOSED' }, { status: 'ACCEPTED', resolvedAt: now })
  if (n === 0) await explainNoop(tx, userId, id)
  const c = await tx.correction.findFirstOrThrow({ where: { id, userId }, select: { id: true, chatId: true, messageId: true, errorType: true, chunkType: true, corrected: true } })
  return { ...c, resolvedAt: now.toISOString() }
}

/** 채택과 같은 트랜잭션에서 만든 단어 id 연결(`savedWordId`). */
export async function setCorrectionSavedWord(userId: string, id: string, wordId: string, tx: Tx): Promise<void> {
  await updateCorrections(tx, { id, userId }, { savedWordId: wordId })
}

/** #36 거절 — 아무 행도 만들지 않는다. */
export async function rejectCorrection(userId: string, id: string): Promise<{ id: string; status: 'REJECTED'; resolvedAt: string }> {
  if (!validId(id)) throw notFound()
  const now = new Date()
  const n = await updateCorrections(prisma, { id, userId, status: 'PROPOSED' }, { status: 'REJECTED', resolvedAt: now })
  if (n === 0) await explainNoop(prisma, userId, id)
  return { id, status: 'REJECTED', resolvedAt: now.toISOString() }
}

export interface CorrectionListQuery {
  status?: ProposalStatus
  chatId?: string | null
  limit: number
  cursor?: string | null
}

/**
 * #34 — `chatId` 가 있으면 메시지 순서(메시지 createdAt → 교정 createdAt, D5) + 오프셋 커서(채팅 하나의 교정은 뒤에만 붙는다),
 * 없으면 `createdAt desc` 키셋 커서. 남의 채팅 id 로 거르면 404.
 */
export async function listCorrections(userId: string, q: CorrectionListQuery): Promise<{ items: CorrectionDto[]; nextCursor: string | null }> {
  const include = { chat: { select: { id: true, title: true, kind: true } } } as const
  if (q.chatId) {
    const chat = await prisma.chat.findFirst({ where: { id: q.chatId, userId }, select: { id: true } })
    if (!chat) throw new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
    const off = decodeCursor(q.cursor, isOffsetCursor)?.o ?? 0
    const rows = await prisma.correction.findMany({
      where: { userId, chatId: q.chatId, ...(q.status ? { status: q.status } : {}) },
      orderBy: [{ message: { createdAt: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: off,
      take: q.limit + 1,
      select: { ...CORRECTION_SELECT, ...include },
    })
    const page = rows.slice(0, q.limit)
    return {
      items: page.map((c) => serializeCorrection(c, c.chat)),
      nextCursor: rows.length > q.limit ? encodeCursor({ o: off + q.limit }) : null,
    }
  }
  const cur = decodeCursor(q.cursor, isTimeIdCursor)
  const rows = await prisma.correction.findMany({
    where: {
      userId,
      ...(q.status ? { status: q.status } : {}),
      ...(cur ? { OR: [{ createdAt: { lt: new Date(cur.t) } }, { createdAt: new Date(cur.t), id: { lt: cur.id } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    select: { ...CORRECTION_SELECT, ...include },
  })
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((c) => serializeCorrection(c, c.chat)),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
  }
}

/** 채팅 하나의 교정 상태별 수(ADD_STUDY_LOG 채택 시 결과 JSON 재료). */
export async function countChatCorrections(userId: string, chatId: string, tx?: Tx): Promise<{ proposed: number; accepted: number; rejected: number; total: number }> {
  const db = tx ?? prisma
  const rows = await db.correction.groupBy({ by: ['status'], where: { userId, chatId }, _count: { _all: true } })
  const get = (s: ProposalStatus) => rows.find((r) => r.status === s)?._count._all ?? 0
  const proposed = get('PROPOSED')
  const accepted = get('ACCEPTED')
  const rejected = get('REJECTED')
  return { proposed, accepted, rejected, total: proposed + accepted + rejected + get('EXPIRED') }
}
