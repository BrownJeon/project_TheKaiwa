/**
 * 강사 제안(TutorProposal) — 목록(#37)과 상태 전이(#38·#39). 채택의 실제 결과(WordEntry·StudyLog·스냅샷)는 라우트가 같은 트랜잭션에서
 * learning 에 위임하고, 여기서는 **무엇을 만들지**(검증된 입력)만 돌려준다(module-dependency L2 `acceptProposal`).
 *
 * - task-006 범위: `ADD_WORD`·`ADD_STUDY_LOG` 만 채택 가능, 나머지 kind 는 `400 FEATURE_NOT_READY`(범위결정 2).
 * - 30일 지난 PROPOSED 는 `EXPIRED`(읽을 때 지연 전이, 채택은 `409 { status:'EXPIRED' }`).
 * - 상태 전이는 `status=PROPOSED` 조건부 `updateMany` 라 동시 채택은 한 건만 이긴다(진 쪽 트랜잭션은 통째로 롤백).
 */
import type { ChatKind, Prisma, ProposalKind, ProposalStatus } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor, lockUserRow, prisma, type Tx } from '@/modules/infra'
import { countChatCorrections } from '../corrections'

export const PROPOSAL_TTL_MS = 30 * 86_400_000
export const PROPOSAL_KINDS = ['ADD_WORD', 'ADD_STUDY_LOG', 'ADD_TOPIC', 'SET_LEVEL', 'SCHEDULE_REVIEW'] as const
export const PROPOSAL_STATUSES = ['PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const
const ACCEPTABLE: readonly ProposalKind[] = ['ADD_WORD', 'ADD_STUDY_LOG']
/** payloadOverride 화이트리스트(kind 별). */
const OVERRIDE_KEYS: Partial<Record<ProposalKind, readonly string[]>> = { ADD_WORD: ['meaning', 'reading'], ADD_STUDY_LOG: [] }

export function proposalExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + PROPOSAL_TTL_MS)
}

export function isProposalExpired(p: { status: ProposalStatus; expiresAt: Date | null; createdAt: Date }, now = Date.now()): boolean {
  if (p.status !== 'PROPOSED') return false
  const at = p.expiresAt ? p.expiresAt.getTime() : p.createdAt.getTime() + PROPOSAL_TTL_MS
  return at <= now
}

function notFound(): ApiError {
  return new ApiError('NOT_FOUND', '제안을 찾을 수 없어요.')
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 40
}

const PROPOSAL_SELECT = {
  id: true, kind: true, payload: true, status: true, chatId: true, messageId: true, expiresAt: true, createdAt: true, resolvedAt: true, result: true,
  chat: { select: { id: true, title: true } },
} as const
type ProposalRow = Prisma.TutorProposalGetPayload<{ select: typeof PROPOSAL_SELECT }>

export function serializeProposal(p: ProposalRow, now = Date.now()) {
  return {
    id: p.id,
    kind: p.kind,
    payload: p.payload,
    status: isProposalExpired(p, now) ? ('EXPIRED' as const) : p.status,
    chat: p.chat ? { id: p.chat.id, title: p.chat.title } : null,
    messageId: p.messageId,
    createdAt: p.createdAt.toISOString(),
    resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
    result: p.result,
  }
}
export type ProposalDto = ReturnType<typeof serializeProposal>

/** 이 사용자의 기한 지난 PROPOSED → EXPIRED(읽기 경로의 지연 전이). */
async function expireStale(userId: string, now: Date): Promise<void> {
  await prisma.tutorProposal.updateMany({
    where: { userId, status: 'PROPOSED', OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lte: new Date(now.getTime() - PROPOSAL_TTL_MS) } }] },
    data: { status: 'EXPIRED' },
  })
}

export interface ProposalListQuery {
  status?: ProposalStatus
  chatId?: string | null
  kind?: ProposalKind
  limit: number
  cursor?: string | null
}

/** #37 — `createdAt desc` 키셋 커서. 남의 채팅 id 로 거르면 404. */
export async function listProposals(userId: string, q: ProposalListQuery): Promise<{ items: ProposalDto[]; nextCursor: string | null }> {
  if (q.chatId) {
    const chat = await prisma.chat.findFirst({ where: { id: q.chatId, userId }, select: { id: true } })
    if (!chat) throw new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
  }
  const cur = decodeCursor(q.cursor, isTimeIdCursor)
  const now = new Date()
  await expireStale(userId, now)
  const rows = await prisma.tutorProposal.findMany({
    where: {
      userId,
      ...(q.chatId ? { chatId: q.chatId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(cur ? { OR: [{ createdAt: { lt: new Date(cur.t) } }, { createdAt: new Date(cur.t), id: { lt: cur.id } }] } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    select: PROPOSAL_SELECT,
  })
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((p) => serializeProposal(p, now.getTime())),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
  }
}

/** payloadOverride 검증 — 객체·화이트리스트 키·문자열(또는 null)만. */
export function parsePayloadOverride(kind: ProposalKind, raw: unknown): Record<string, string | null> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError('VALIDATION', 'payloadOverride 형식이 올바르지 않습니다.', { field: 'payloadOverride', reason: 'object' })
  const allowed = OVERRIDE_KEYS[kind] ?? []
  const out: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.includes(k)) throw new ApiError('VALIDATION', `바꿀 수 없는 항목입니다: ${k}`, { field: `payloadOverride.${k}`, reason: 'unknown_key' })
    if (v !== null && typeof v !== 'string') throw new ApiError('VALIDATION', `${k} 형식이 올바르지 않습니다.`, { field: `payloadOverride.${k}`, reason: 'string' })
    out[k] = v
  }
  return out
}

function payloadObject(p: Prisma.JsonValue): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)

export type AcceptedProposal =
  | { id: string; kind: 'ADD_WORD'; word: { surface: unknown; reading: unknown; meaning: unknown } }
  | {
      id: string
      kind: 'ADD_STUDY_LOG'
      log: { chatId: string | null; chatKind: 'TALK' | 'CHAT'; turns: number; correctionCount: number; acceptedCorrections: number; rejectedCorrections: number; summaryKo: string | null }
    }

/**
 * #38 상태 전이(PROPOSED → ACCEPTED) — 라우트 트랜잭션 `tx` 안에서. 순서: 없음/남의 것 404 → 이미 처리 409 → 만료 409 →
 * 아직 안 여는 kind 400 → override 검증 400 → 조건부 전이(경쟁에서 지면 409). 단어 입력의 최종 검증은 learning 이 한다.
 */
export async function acceptProposal(userId: string, id: string, rawOverride: unknown, tx: Tx): Promise<AcceptedProposal> {
  if (!validId(id)) throw notFound()
  // 잠금 순서 통일(사용자 → 행). 이 잠금 뒤의 읽기는 READ COMMITTED 라 최신 상태를 본다.
  await lockUserRow(tx, userId)
  const p = await tx.tutorProposal.findFirst({ where: { id, userId }, select: PROPOSAL_SELECT })
  if (!p) throw notFound()
  if (p.status !== 'PROPOSED') throw new ApiError('CONFLICT', '이미 처리된 제안이에요.', { status: p.status })
  const now = new Date()
  if (isProposalExpired(p, now.getTime())) throw new ApiError('CONFLICT', '기한(30일)이 지난 제안이라 채택할 수 없어요.', { status: 'EXPIRED' })
  if (!ACCEPTABLE.includes(p.kind)) throw new ApiError('FEATURE_NOT_READY', '이 제안은 아직 채택할 수 없어요.')
  const override = parsePayloadOverride(p.kind, rawOverride)

  const res = await tx.tutorProposal.updateMany({ where: { id, userId, status: 'PROPOSED' }, data: { status: 'ACCEPTED', resolvedAt: now } })
  if (res.count === 0) {
    const cur = await tx.tutorProposal.findFirst({ where: { id, userId }, select: { status: true } })
    if (!cur) throw notFound()
    throw new ApiError('CONFLICT', '이미 처리된 제안이에요.', { status: cur.status })
  }

  const payload = payloadObject(p.payload)
  if (p.kind === 'ADD_WORD') {
    return { id, kind: 'ADD_WORD', word: { surface: payload.surface, reading: 'reading' in override ? override.reading : payload.reading, meaning: 'meaning' in override ? override.meaning : payload.meaning } }
  }
  let chatKind: ChatKind = 'CHAT'
  let stats = { accepted: 0, rejected: 0 }
  if (p.chatId) {
    const chat = await tx.chat.findFirst({ where: { id: p.chatId, userId }, select: { kind: true } })
    if (chat) chatKind = chat.kind
    const c = await countChatCorrections(userId, p.chatId, tx)
    stats = { accepted: c.accepted, rejected: c.rejected }
  }
  return {
    id,
    kind: 'ADD_STUDY_LOG',
    log: {
      chatId: p.chatId ?? str(payload.chatId),
      chatKind: chatKind === 'TALK' ? 'TALK' : 'CHAT',
      turns: int(payload.userMessageCount ?? payload.messageCount),
      correctionCount: int(payload.correctionCount),
      acceptedCorrections: stats.accepted,
      rejectedCorrections: stats.rejected,
      summaryKo: str(payload.summaryKo),
    },
  }
}

/** 채택 결과(생성 행 id) 기록 — 같은 트랜잭션에서. */
export async function setProposalResult(userId: string, id: string, result: Record<string, string>, tx: Tx): Promise<void> {
  await tx.tutorProposal.updateMany({ where: { id, userId }, data: { result } })
}

/** #39 거절 — 아무 행도 만들지 않는다. 기한 지난 제안의 거절은 EXPIRED 로 전이하고 409. */
export async function rejectProposal(userId: string, id: string): Promise<{ id: string; status: 'REJECTED'; resolvedAt: string }> {
  if (!validId(id)) throw notFound()
  const p = await prisma.tutorProposal.findFirst({ where: { id, userId }, select: { status: true, expiresAt: true, createdAt: true } })
  if (!p) throw notFound()
  if (p.status !== 'PROPOSED') throw new ApiError('CONFLICT', '이미 처리된 제안이에요.', { status: p.status })
  if (isProposalExpired(p)) {
    await prisma.tutorProposal.updateMany({ where: { id, userId, status: 'PROPOSED' }, data: { status: 'EXPIRED' } })
    throw new ApiError('CONFLICT', '기한(30일)이 지난 제안이에요.', { status: 'EXPIRED' })
  }
  const now = new Date()
  const res = await prisma.tutorProposal.updateMany({ where: { id, userId, status: 'PROPOSED' }, data: { status: 'REJECTED', resolvedAt: now } })
  if (res.count === 0) {
    const cur = await prisma.tutorProposal.findFirst({ where: { id, userId }, select: { status: true } })
    throw new ApiError('CONFLICT', '이미 처리된 제안이에요.', { status: cur?.status ?? 'UNKNOWN' })
  }
  return { id, status: 'REJECTED', resolvedAt: now.toISOString() }
}
