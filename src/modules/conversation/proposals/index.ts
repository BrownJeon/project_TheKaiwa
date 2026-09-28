/**
 * 강사 제안(TutorProposal) — 목록(#37)과 상태 전이(#38·#39). 채택의 실제 결과(WordEntry·StudyLog·스냅샷)는 라우트가 같은 트랜잭션에서
 * learning 에 위임하고, 여기서는 **무엇을 만들지**(검증된 입력)만 돌려준다(module-dependency L2 `acceptProposal`).
 *
 * - task-006 범위: `ADD_WORD`·`ADD_STUDY_LOG` 만 채택 가능, task-011 에서 `SET_LEVEL`(평가 레벨 올리기 → Profile.level) 추가. 나머지 kind 는 `400 FEATURE_NOT_READY`.
 * - 30일 지난 PROPOSED 는 `EXPIRED`(읽을 때 지연 전이, 채택은 `409 { status:'EXPIRED' }`).
 * - 상태 전이는 `status=PROPOSED` 조건부 `updateMany` 라 동시 채택은 한 건만 이긴다(진 쪽 트랜잭션은 통째로 롤백).
 */
import type { ChatKind, Prisma, ProposalKind, ProposalStatus } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor, lockUserRow, prisma, type Tx } from '@/modules/infra'
import { countChatCorrections } from '../corrections'

export const PROPOSAL_TTL_MS = 30 * 86_400_000
export const PROPOSAL_KINDS = ['ADD_WORD', 'ADD_STUDY_LOG', 'ADD_TOPIC', 'SET_LEVEL', 'SCHEDULE_REVIEW'] as const
export const PROPOSAL_STATUSES = ['PROPOSED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const
const ACCEPTABLE: readonly ProposalKind[] = ['ADD_WORD', 'ADD_STUDY_LOG', 'SET_LEVEL']
/** payloadOverride 화이트리스트(kind 별). */
const OVERRIDE_KEYS: Partial<Record<ProposalKind, readonly string[]>> = { ADD_WORD: ['meaning', 'reading'], ADD_STUDY_LOG: [], SET_LEVEL: [] }
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
type JlptLevelName = (typeof JLPT_LEVELS)[number]

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

/** ADD_WORD 채택 결과로 만들 단어 — `source`·`sourceRefId` 는 제안 출처(레슨 메모면 LESSON·레슨 id, 그 밖엔 TUTOR·제안 id). */
export interface AcceptedWord {
  surface: unknown
  reading: unknown
  meaning: unknown
  partOfSpeech?: unknown
  jlpt?: unknown
  example?: unknown
  exampleKo?: unknown
}

export type AcceptedProposal =
  | { id: string; kind: 'ADD_WORD'; word: AcceptedWord; source: 'TUTOR' | 'LESSON'; sourceRefId: string }
  | { id: string; kind: 'SET_LEVEL'; level: JlptLevelName }
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
  if (p.kind === 'SET_LEVEL') {
    const level = str(payload.level)
    if (!level || !(JLPT_LEVELS as readonly string[]).includes(level)) throw new ApiError('VALIDATION', '레벨 제안 내용이 올바르지 않아요.', { field: 'payload.level', reason: 'invalid' })
    return { id, kind: 'SET_LEVEL', level: level as JlptLevelName }
  }
  if (p.kind === 'ADD_WORD') {
    const word: AcceptedWord = { surface: payload.surface, reading: 'reading' in override ? override.reading : payload.reading, meaning: 'meaning' in override ? override.meaning : payload.meaning }
    const lessonId = payload.source === 'LESSON' ? str(payload.lessonId) : null
    if (lessonId && validId(lessonId)) {
      // 레슨 메모 제안(task-010 #62a)은 서버가 만든 보강 칸을 함께 싣는다 — 값 검증은 learning 의 단어 입력 검증이 다시 한다.
      for (const k of ['partOfSpeech', 'jlpt', 'example', 'exampleKo'] as const) if (payload[k] !== undefined && payload[k] !== null) word[k] = payload[k]
      return { id, kind: 'ADD_WORD', word, source: 'LESSON', sourceRefId: lessonId }
    }
    return { id, kind: 'ADD_WORD', word, source: 'TUTOR', sourceRefId: id }
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

// ── 레슨 들린 단어 메모 → ADD_WORD 제안(task-010 #62a) ─────────────────────────────

/** 레슨 메모 한 단어의 제안 초안 — learning 이 레슨 조각·A10 보강으로 채운 값(라우트가 넘긴다). */
export interface LessonWordDraft {
  surface: string
  reading: string | null
  meaning: string
  lessonId: string
  segment: number
  /** 그 단어가 나온 대화 줄(0부터) — 없으면 null. */
  lineIdx: number | null
  /** 뜻의 출처: 레슨 조각(CHUNK) 또는 강사 보강(ENRICH). */
  via: 'CHUNK' | 'ENRICH'
  /** 학습자가 적은 메모 그대로(표기가 조각 표기로 바뀌었을 때 화면이 메모 칩과 짝짓는다). */
  memo: string
  partOfSpeech?: string | null
  jlpt?: string | null
  example?: string | null
  exampleKo?: string | null
}

export interface LessonWordProposal {
  surface: string
  created: boolean
  proposal: ProposalDto
}

function lessonWordPayload(d: LessonWordDraft): Prisma.InputJsonObject {
  const out: Record<string, string | number | null> = {
    surface: d.surface,
    reading: d.reading ?? '',
    meaning: d.meaning,
    lessonId: d.lessonId,
    source: 'LESSON',
    segment: d.segment,
    lineIdx: d.lineIdx,
    via: d.via,
    memo: d.memo,
  }
  for (const k of ['partOfSpeech', 'jlpt', 'example', 'exampleKo'] as const) if (d[k]) out[k] = d[k] as string
  return out
}

/**
 * 레슨 메모 단어 제안 만들기 — 라우트 트랜잭션 `tx` 안에서(사용자 행 잠금 뒤). 같은 표현(바이트 일치)의 **처리 전(PROPOSED) ADD_WORD 제안**이
 * 이미 있으면(채팅·다른 레슨 포함) 새로 만들지 않고 그 제안을 돌려준다. 채택 전에는 단어장에 아무 행도 생기지 않는다.
 */
export async function createLessonWordProposals(userId: string, drafts: readonly LessonWordDraft[], tx: Tx): Promise<LessonWordProposal[]> {
  if (!drafts.length) return []
  await lockUserRow(tx, userId)
  const now = new Date()
  const open = await tx.tutorProposal.findMany({
    where: { userId, kind: 'ADD_WORD', status: 'PROPOSED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
    select: PROPOSAL_SELECT,
  })
  const bySurface = new Map<string, ProposalRow>()
  for (const p of open) {
    if (isProposalExpired(p, now.getTime())) continue
    const sfc = str(payloadObject(p.payload).surface)
    if (sfc && !bySurface.has(sfc)) bySurface.set(sfc, p)
  }
  const out: LessonWordProposal[] = []
  for (const d of drafts) {
    const hit = bySurface.get(d.surface)
    if (hit) {
      out.push({ surface: d.surface, created: false, proposal: serializeProposal(hit, now.getTime()) })
      continue
    }
    const row = await tx.tutorProposal.create({
      data: { userId, kind: 'ADD_WORD', payload: lessonWordPayload(d), expiresAt: proposalExpiresAt(now) },
      select: PROPOSAL_SELECT,
    })
    bySurface.set(d.surface, row)
    out.push({ surface: d.surface, created: true, proposal: serializeProposal(row, now.getTime()) })
  }
  return out
}

/** 내 제안 여러 개(현재 상태) — 없거나 남의 것은 빠진다. 레슨 메모를 다시 보냈을 때 이전 제안 카드를 돌려주는 데 쓴다. */
export async function getProposalsByIds(userId: string, ids: readonly string[]): Promise<ProposalDto[]> {
  const valid = [...new Set(ids.filter(validId))].slice(0, 50)
  if (!valid.length) return []
  const rows = await prisma.tutorProposal.findMany({ where: { userId, id: { in: valid } }, select: PROPOSAL_SELECT })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const now = Date.now()
  return valid.flatMap((id) => {
    const r = byId.get(id)
    return r ? [serializeProposal(r, now)] : []
  })
}

// ── 평가 레벨 올리기 → SET_LEVEL 제안(task-011 L5) ─────────────────────────────

/** 레벨 제안 근거 평가 1건(learning `findLevelUpCandidate` 결과를 라우트가 옮긴다). `date` = 채점을 끝낸 KST 날짜. */
export interface LevelProposalBasis {
  evaluationId: string
  kind: 'WORDS' | 'TALK'
  totalScore: number
  date: string
}

export interface LevelProposalDraft {
  fromLevel: JlptLevelName
  toLevel: JlptLevelName
  /** 이 제안을 만든 평가(가장 최근 DONE). */
  evaluationId: string
  /** 오래된 것 → 최근 것(2건) — 화면 근거 문구("9월 26일 92점 · 오늘 90점"). */
  basis: LevelProposalBasis[]
}

function basisIds(payload: Record<string, unknown>): string[] {
  return Array.isArray(payload.basis) ? payload.basis.flatMap((b) => (b && typeof b === 'object' && typeof (b as Record<string, unknown>).evaluationId === 'string' ? [(b as Record<string, string>).evaluationId] : [])) : []
}

const LEVEL_PROPOSAL_SCAN = 50

/**
 * 평가 채점 트랜잭션 **뒤**에 부른다(같은 트랜잭션 X — 제안 실패가 기록률 100% 트랜잭션을 되돌리지 않게, L5). 사용자 행 잠금 아래에서:
 *   · 근거 평가 중 하나라도 이미 다른 SET_LEVEL 제안의 근거면 새로 만들지 않는다(같은 두 번을 두 번 쓰지 않음 — 거절 뒤엔 새로 두 번 ≥90 이 필요).
 *   · 같은 목표 레벨의 처리 전(PROPOSED·기한 안) 제안이 있으면 그것을 돌려준다.
 * 채택 전에는 Profile 에 아무 변화가 없다(규칙 1) — 채택(#38)해야 `Profile.level` 이 바뀐다.
 */
export async function createLevelProposal(userId: string, draft: LevelProposalDraft, tx: Tx): Promise<{ created: boolean; proposal: ProposalDto | null }> {
  await lockUserRow(tx, userId)
  const now = new Date()
  const rows = await tx.tutorProposal.findMany({ where: { userId, kind: 'SET_LEVEL' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LEVEL_PROPOSAL_SCAN, select: PROPOSAL_SELECT })
  const draftIds = new Set(draft.basis.map((b) => b.evaluationId))
  for (const r of rows) {
    const payload = payloadObject(r.payload)
    if (basisIds(payload).some((id) => draftIds.has(id))) return { created: false, proposal: null }
  }
  const open = rows.find((r) => r.status === 'PROPOSED' && !isProposalExpired(r, now.getTime()) && str(payloadObject(r.payload).level) === draft.toLevel)
  if (open) return { created: false, proposal: serializeProposal(open, now.getTime()) }
  const payload: Prisma.InputJsonObject = {
    level: draft.toLevel,
    fromLevel: draft.fromLevel,
    source: 'EVALUATION',
    evaluationId: draft.evaluationId,
    basis: draft.basis.map((b) => ({ evaluationId: b.evaluationId, kind: b.kind, totalScore: b.totalScore, date: b.date })),
  }
  const row = await tx.tutorProposal.create({ data: { userId, kind: 'SET_LEVEL', payload, expiresAt: proposalExpiresAt(now) }, select: PROPOSAL_SELECT })
  return { created: true, proposal: serializeProposal(row, now.getTime()) }
}

/** 이 평가가 만든 레벨 제안(#66 결과 카드) — 없으면 null. */
export async function findEvaluationLevelProposal(userId: string, evaluationId: string): Promise<ProposalDto | null> {
  if (!validId(evaluationId)) return null
  const rows = await prisma.tutorProposal.findMany({ where: { userId, kind: 'SET_LEVEL' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LEVEL_PROPOSAL_SCAN, select: PROPOSAL_SELECT })
  const hit = rows.find((r) => str(payloadObject(r.payload).evaluationId) === evaluationId)
  return hit ? serializeProposal(hit) : null
}
