/**
 * 교정 — 목록(#34)과 상태 전이(#35·#36)만. **쓰기(단어장·오류 통계·스냅샷)는 여기서 하지 않는다** — 라우트가 연 트랜잭션에서
 * learning 에 위임한다(module-dependency 행렬 판독 규칙 2).
 *
 * 원문 보존(domain-model 규칙 3): 모든 UPDATE 는 `updateCorrections()` 한 곳을 지나고, 그 데이터 타입에서 `original` 을 뺐다 —
 * 누가 `original` 을 넣으면 **컴파일 오류**가 난다. 상태 전이는 `status=PROPOSED` 조건부 `updateMany` 라 동시 채택은 한 건만 이긴다.
 */
import type { ErrorType, ChunkType, Prisma, ProposalStatus, Severity } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isOffsetCursor, isTimeIdCursor, lockUserRow, prisma, type Tx } from '@/modules/infra'
import { CORRECTION_SELECT, serializeCorrection, type CorrectionDto } from './serialize'
import { readCorrectionMeta, talkCorrectionFields, type CorrectionDeliver } from './talkDelivery'

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
  /** 반복 항목 뜻 스냅샷 재료(task-010b L8 — learning 이 첫 문장 앞부분만 쓴다). */
  explanation: string
  severity: Severity
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
  const c = await tx.correction.findFirstOrThrow({ where: { id, userId }, select: { id: true, chatId: true, messageId: true, errorType: true, chunkType: true, corrected: true, explanation: true, severity: true } })
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

export interface RejectedCorrection {
  result: { id: string; status: 'REJECTED'; resolvedAt: string }
  /** 관측 재료(task-010b — 거절 관측 `CORRECTION_IGNORED` 의 축). */
  errorType: ErrorType
  severity: Severity
}

/**
 * #36 거절을 라우트 트랜잭션 `tx` 안에서(task-010b — 같은 tx 에 learning 관측을 쓰려고). 잠금 순서는 채택과 같다(사용자 행 → 교정 행).
 * 교정·다른 테이블에는 아무 행도 만들지 않는다. 0행 전이는 404/409(채택과 같은 규칙).
 */
export async function rejectCorrectionIn(tx: Tx, userId: string, id: string): Promise<RejectedCorrection> {
  if (!validId(id)) throw notFound()
  await lockUserRow(tx, userId)
  const now = new Date()
  const n = await updateCorrections(tx, { id, userId, status: 'PROPOSED' }, { status: 'REJECTED', resolvedAt: now })
  if (n === 0) await explainNoop(tx, userId, id)
  const c = await tx.correction.findFirstOrThrow({ where: { id, userId }, select: { errorType: true, severity: true } })
  return { result: { id, status: 'REJECTED', resolvedAt: now.toISOString() }, errorType: c.errorType, severity: c.severity }
}

export interface CorrectionListQuery {
  status?: ProposalStatus
  chatId?: string | null
  /** task-010c — `LATER` 면 그 회화의 "모아 둔 교정"만(`chatId` 필수). 표시 필드(deliver·hintKo·selfCheck)를 함께 싣는다. */
  deliver?: CorrectionDeliver | null
  limit: number
  cursor?: string | null
}

/** 한 회화의 모아 둔 교정 상한 — 시트는 한 번에 다 불러온다(회화 하나의 교정은 말 수를 넘지 않는다). */
export const LATER_LIST_MAX = 200

/**
 * 모아 둔 교정(deliver=LATER)은 유창성 모드의 MINOR 만이라 `severity=MINOR` 로 먼저 좁히고, 교정이 달린 사용자 메시지의 `toolLog.correction`
 * 으로 가른다(task-010c — 표시 메타는 그 메시지에 있다). 메시지 순서 오름차순.
 */
async function laterRows(userId: string, chatId: string, status?: ProposalStatus) {
  const rows = await prisma.correction.findMany({
    where: { userId, chatId, severity: 'MINOR', ...(status ? { status } : {}) },
    orderBy: [{ message: { createdAt: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }],
    take: LATER_LIST_MAX * 2,
    select: { ...CORRECTION_SELECT, chat: { select: { id: true, title: true, kind: true } }, message: { select: { toolLog: true } } },
  })
  return rows.flatMap((r) => {
    const meta = readCorrectionMeta(r.message.toolLog, r.id)
    return meta?.deliver === 'LATER' ? [{ row: r, meta }] : []
  })
}

/** #29 `laterPending` — 아직 처리하지 않은 모아 둔 교정 수(회화 전체). */
export async function countLaterPending(userId: string, chatId: string): Promise<number> {
  return (await laterRows(userId, chatId, 'PROPOSED')).length
}

/**
 * #34 — `chatId` 가 있으면 메시지 순서(메시지 createdAt → 교정 createdAt, D5) + 오프셋 커서(채팅 하나의 교정은 뒤에만 붙는다),
 * 없으면 `createdAt desc` 키셋 커서. 남의 채팅 id 로 거르면 404.
 */
export async function listCorrections(userId: string, q: CorrectionListQuery): Promise<{ items: CorrectionDto[]; nextCursor: string | null }> {
  const include = { chat: { select: { id: true, title: true, kind: true } } } as const
  if (q.deliver) {
    if (q.deliver !== 'LATER') throw new ApiError('VALIDATION', 'deliver 는 LATER 만 거를 수 있어요.', { field: 'deliver' })
    if (!q.chatId) throw new ApiError('VALIDATION', 'deliver 로 거를 때는 chatId 가 필요합니다.', { field: 'chatId' })
    const chat = await prisma.chat.findFirst({ where: { id: q.chatId, userId }, select: { id: true } })
    if (!chat) throw new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
    const rows = (await laterRows(userId, q.chatId, q.status)).slice(0, LATER_LIST_MAX)
    return { items: rows.map(({ row, meta }) => ({ ...serializeCorrection(row, row.chat), ...talkCorrectionFields(meta) })), nextCursor: null }
  }
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

/** `listCorrectionRefsByWord` 가 쓰는 최소 DB 면(테스트가 가짜를 넣을 수 있게). */
export interface CorrectionRefReader {
  correction: { findMany(args: { where: { userId: string; savedWordId: string }; select: { id: true; chatId: true }; orderBy: { createdAt: 'desc' }; take: number }): Promise<{ id: string; chatId: string }[]> }
}

/**
 * #42 단어 상세의 `corrections:[{id, chatId}]`(task-008, Leader 승인 예외) — 그 단어를 만든(`savedWordId`) 교정의 참조만, **읽기 전용**.
 * Correction 은 L2 소유라 learning 이 직접 읽지 않고 라우트가 이 함수를 조합한다. 항상 `userId` 로 거른다.
 */
export async function listCorrectionRefsByWord(userId: string, wordId: string, db: CorrectionRefReader = prisma as unknown as CorrectionRefReader): Promise<{ id: string; chatId: string }[]> {
  if (!validId(wordId) || !userId) return []
  return db.correction.findMany({ where: { userId, savedWordId: wordId }, select: { id: true, chatId: true }, orderBy: { createdAt: 'desc' }, take: 20 })
}

/**
 * 최근 채택한 교정(원문 → 교정문) — A4 레슨 입력 재료(task-010 L6, 최대 5). 읽기 전용, 채택 시각 최신순. 교정은 L2 소유라
 * 레슨 생성 라우트가 이 함수를 조합해 `buildLessonRequest` 에 넘긴다.
 */
export async function recentAcceptedCorrections(userId: string, limit = 5): Promise<{ original: string; corrected: string }[]> {
  if (!userId) return []
  return prisma.correction.findMany({
    where: { userId, status: 'ACCEPTED' },
    orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
    take: Math.max(1, Math.min(10, limit)),
    select: { original: true, corrected: true },
  })
}
