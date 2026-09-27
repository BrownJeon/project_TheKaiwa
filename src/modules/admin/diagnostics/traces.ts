/**
 * #128·#129 Trace 조회 — 원음·전체 텍스트·시크릿 없음(규칙 7): 단계는 원시값·짧은 문자열만(present.traceStep), userId 는 앞 4자.
 * `userId` 필터는 SUPER_ADMIN 만(api-contract #128). connection 필터는 id 또는 key.
 */
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor } from '@/modules/infra'
import { getConnection, getTrace, listTraces } from '@/modules/engine'
import type { Environment, TraceKind, TraceStatus } from '@prisma/client'
import type { AdminPage, TraceDetailDto, TraceListItemDto } from '@/types/admin'
import { assertCapability, hiddenNotFound, type AdminActor } from '../permissions/guard'
import { traceDetail, traceListItem } from '../present'

const KINDS: readonly TraceKind[] = ['TURN', 'PREVIEW', 'PLAYGROUND', 'E2E', 'FUNCTIONAL_TEST']
const STATUSES: readonly TraceStatus[] = ['OK', 'ERROR', 'PARTIAL']

export interface TraceQuery {
  kind?: string | null
  status?: string | null
  from?: string | null
  to?: string | null
  connectionId?: string | null
  userId?: string | null
  refType?: string | null
  refId?: string | null
  cursor?: string | null
  limit: number
}

function date(raw: string | null | undefined, field: string): Date | undefined {
  if (!raw) return undefined
  const t = Date.parse(raw)
  if (Number.isNaN(t)) throw new ApiError('VALIDATION', `${field} 는 ISO 날짜여야 합니다.`, { field })
  return new Date(t)
}

function short(raw: string | null | undefined, field: string, max = 40): string | undefined {
  if (!raw) return undefined
  if (raw.length > max || !/^[\w.:-]+$/.test(raw)) throw new ApiError('VALIDATION', `${field} 형식이 올바르지 않습니다.`, { field })
  return raw
}

export async function listTraceDtos(actor: AdminActor, environment: Environment, q: TraceQuery): Promise<AdminPage<TraceListItemDto>> {
  if (q.kind && !KINDS.includes(q.kind as TraceKind)) throw new ApiError('VALIDATION', 'kind 값이 올바르지 않습니다.', { field: 'kind' })
  if (q.status && !STATUSES.includes(q.status as TraceStatus)) throw new ApiError('VALIDATION', 'status 값이 올바르지 않습니다.', { field: 'status' })
  const userId = short(q.userId, 'userId')
  if (userId) assertCapability(actor, 'users.role.manage')
  let connection: { id: string; key: string } | undefined
  const connRaw = short(q.connectionId, 'connectionId', 80)
  if (connRaw) {
    const c = await getConnection(environment, connRaw)
    // 없는 connection 으로 거르면 빈 목록(존재 여부를 따로 알리지 않는다).
    connection = c ? { id: c.id, key: c.key } : { id: '__none__', key: '__none__' }
  }
  const cursor = decodeCursor(q.cursor, isTimeIdCursor)
  const r = await listTraces({
    environment,
    kind: (q.kind as TraceKind) || undefined,
    status: (q.status as TraceStatus) || undefined,
    from: date(q.from, 'from'),
    to: date(q.to, 'to'),
    userId,
    refType: short(q.refType, 'refType', 30),
    refId: short(q.refId, 'refId'),
    connection,
    cursor,
    limit: q.limit,
  })
  return { items: r.items.map(traceListItem), nextCursor: r.next ? encodeCursor(r.next) : null }
}

export async function getTraceDto(environment: Environment, traceId: string): Promise<TraceDetailDto> {
  const t = await getTrace(environment, traceId)
  if (!t) throw hiddenNotFound()
  return traceDetail(t)
}
