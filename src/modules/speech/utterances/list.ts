/**
 * #21c 내 발화 목록(task-012b-2) — 소유자 행만(`where userId`), 최근 것부터 `createdAt desc, id desc` 키셋 커서.
 *
 *  - 필터: `chatId`(그 방에서 녹음한 발화 — 방 소유는 라우트가 conversation 으로 먼저 확인, 남의 방 404) · `reviewable=1`(지금 확인할 수 있는 발화만).
 *  - "확인할 수 있는 발화" = `status=ANALYZED && requiresReview && finalSource=REALTIME && realtimeText ≠ ''` — 화면 카드 조건(`isReviewable`)과 같은 집합.
 *    `finalSource=USER` 인 발화는 #138 이 이미 `requiresReview=false` 로 저장한다(task-012b ⑫) — 여기서 한 번 더 막는다.
 *  - 응답에 엔진 이름·`engineVersions`·`transcriptConfidence`·임계를 싣지 않는다. `wasReviewTarget` 은 판정 스냅샷으로 서버가 계산한다.
 *  - 원음은 URL 대신 `audioAvailable` 만 — 화면은 #21b(세션 + 소유자 + 경로 이중 확인)로 받는다.
 *  - 쓰인 곳(`context`)은 발화 테이블의 연결 칸만으로 정한다(speech 는 Chat·Lesson·Evaluation 표를 읽지 않는다).
 */
import type { FinalSource, Prisma, UtteranceStatus } from '@prisma/client'
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor, parseLimit, prisma } from '@/modules/infra'
import type { UtteranceContext, UtteranceListDto, UtteranceListItem } from '@/types/speech'
import { wasReviewTarget, type ReviewSnapshot } from '../analysis/policy'

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
export const UTTERANCE_LIST_LIMIT_DEFAULT = 20
export const UTTERANCE_LIST_LIMIT_MAX = 50

export interface UtteranceListQuery {
  chatId: string | null
  reviewable: boolean
  cursor: { t: string; id: string } | null
  limit: number
}

const ALLOWED = new Set(['chatId', 'reviewable', 'cursor', 'limit'])

function bad(field: string, reason: string): never {
  throw new ApiError('VALIDATION', '요청 값이 올바르지 않습니다.', { field, reason })
}

/** `?chatId=&reviewable=1&cursor=&limit=` — 모르는 키·잘못된 값은 400. */
export function parseUtteranceListQuery(sp: URLSearchParams): UtteranceListQuery {
  for (const k of sp.keys()) if (!ALLOWED.has(k)) bad(k, 'unknown_key')
  const chatRaw = sp.get('chatId')
  if (chatRaw !== null && !ID_RE.test(chatRaw)) bad('chatId', 'format')
  const rv = sp.get('reviewable')
  if (rv !== null && rv !== '1' && rv !== '0') bad('reviewable', 'enum')
  return {
    chatId: chatRaw,
    reviewable: rv === '1',
    cursor: decodeCursor(sp.get('cursor'), isTimeIdCursor),
    limit: parseLimit(sp.get('limit'), UTTERANCE_LIST_LIMIT_DEFAULT, UTTERANCE_LIST_LIMIT_MAX),
  }
}

export interface ListRow {
  id: string
  createdAt: Date
  durationMs: number
  status: UtteranceStatus
  realtimeText: string
  analysisText: string | null
  transcriptConfidence: number | null
  requiresReview: boolean
  finalText: string | null
  finalSource: FinalSource
  chatId: string | null
  chatMessageId: string | null
  lessonId: string | null
  evaluationItemId: string | null
  audioPath: string | null
  audioExpiresAt: Date | null
  audioDeletedAt: Date | null
  analysis: { engineVersions: unknown } | null
}

const LIST_SELECT = {
  id: true,
  createdAt: true,
  durationMs: true,
  status: true,
  realtimeText: true,
  analysisText: true,
  transcriptConfidence: true,
  requiresReview: true,
  finalText: true,
  finalSource: true,
  chatId: true,
  chatMessageId: true,
  lessonId: true,
  evaluationItemId: true,
  audioPath: true,
  audioExpiresAt: true,
  audioDeletedAt: true,
  analysis: { select: { engineVersions: true } },
} as const

/** 지금 확인할 수 있는 발화(카드 조건) — 목록 필터와 개수에 같은 조건을 쓴다. */
export const REVIEWABLE_WHERE = {
  status: 'ANALYZED',
  requiresReview: true,
  finalSource: 'REALTIME',
  NOT: { realtimeText: '' },
} as const satisfies Prisma.UtteranceWhereInput

export function listWhere(userId: string, q: Pick<UtteranceListQuery, 'chatId' | 'reviewable'>): Prisma.UtteranceWhereInput {
  return { userId, ...(q.chatId ? { chatId: q.chatId } : {}), ...(q.reviewable ? REVIEWABLE_WHERE : {}) }
}

/** DB 호출(단위 테스트가 바꿔 끼운다 — Prisma 위임 객체는 mock 으로 못 바꾼다). */
export const listDb = {
  page: (where: Prisma.UtteranceWhereInput, take: number): Promise<ListRow[]> =>
    prisma.utterance.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, select: LIST_SELECT }),
  countReviewable: (where: Prisma.UtteranceWhereInput): Promise<number> => prisma.utterance.count({ where }),
}

function snapshotOf(v: unknown): ReviewSnapshot | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as ReviewSnapshot) : null
}

/**
 * 쓰인 곳 — 메시지 → 수업 → 평가 → 방 녹음만 → 연결 없음 순.
 * `chatId` 가 남아 있으면 그 방은 있다(`Utterance.chat` 은 `onDelete: SetNull` — 대화를 지우면 방 칸도 함께 빈다) — 방에서 녹음했지만
 * 메시지로 보내지 않은 말(ROOM_ONLY)과 방 연결도 없는 말(UNSENT — 방 밖 녹음·지운 대화의 말·내지 않은 평가 답)을 데이터로 가른다(REV-135 L-B).
 */
export function contextOfRow(r: Pick<ListRow, 'chatId' | 'chatMessageId' | 'lessonId' | 'evaluationItemId'>): UtteranceContext {
  if (r.chatMessageId) return { kind: 'TALK', id: r.chatId }
  if (r.lessonId) return { kind: 'LESSON', id: r.lessonId }
  if (r.evaluationItemId) return { kind: 'EVALUATION', id: null }
  if (r.chatId) return { kind: 'ROOM_ONLY', id: r.chatId }
  return { kind: 'UNSENT', id: null }
}

/** 행 → 목록 DTO(순수). 엔진·신뢰도 칸은 내보내지 않는다. */
export function toUtteranceListItem(r: ListRow, now = new Date()): UtteranceListItem {
  const analyzed = r.status === 'ANALYZED'
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    durationMs: r.durationMs,
    status: r.status,
    realtimeText: r.realtimeText,
    analysisText: analyzed ? r.analysisText : null,
    finalText: r.finalText,
    finalSource: r.finalSource,
    requiresReview: r.requiresReview,
    wasReviewTarget: analyzed && wasReviewTarget(r.transcriptConfidence, snapshotOf(r.analysis?.engineVersions)),
    audioAvailable: !!r.audioPath && !r.audioDeletedAt && (!r.audioExpiresAt || r.audioExpiresAt > now),
    chatMessageId: r.chatMessageId,
    context: contextOfRow(r),
  }
}

/** #21c — `chatId` 소유는 호출 전에 라우트가 확인한다(남의 방 404). */
export async function listUtterances(userId: string, q: UtteranceListQuery, now = new Date()): Promise<UtteranceListDto> {
  const base = listWhere(userId, q)
  const where: Prisma.UtteranceWhereInput = q.cursor
    ? { AND: [base, { OR: [{ createdAt: { lt: new Date(q.cursor.t) } }, { createdAt: new Date(q.cursor.t), id: { lt: q.cursor.id } }] }] }
    : base
  const [rows, reviewableCount] = await Promise.all([
    listDb.page(where, q.limit + 1),
    listDb.countReviewable(listWhere(userId, { chatId: q.chatId, reviewable: true })),
  ])
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => toUtteranceListItem(r, now)),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null,
    reviewableCount,
  }
}
