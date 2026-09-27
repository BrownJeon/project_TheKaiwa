/**
 * RequestTrace 최소판(task-006 범위결정 7, domain-model 규칙 7) — traceId 발급과 1행 기록만. 콘솔 조회·단계별 스트리밍 기록은 task-005b.
 *
 * 기록하는 것: 단계명·지연(ms)·connection 키·모델·시도 수·프롬프트 길이·상태·오류 코드. **원문·응답 전문·대화 텍스트는 넣지 않는다.**
 * 기록 실패가 사용자 요청을 실패시키지 않게 예외를 삼킨다(로그만).
 */
import { randomBytes } from 'node:crypto'
import type { Environment, Prisma, RequestTrace, TraceKind, TraceStatus } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { currentEnvironment } from '../router'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** `t_` + base62 20자 = 22자(api-contract §0-5). 사용자 식별 정보를 담지 않는 순수 난수. */
export function newTraceId(): string {
  // 256 을 62 로 나눈 나머지 편향을 없애려고 248(=62×4) 이상은 버린다.
  let out = ''
  while (out.length < 20) {
    for (const b of randomBytes(32)) {
      if (b >= 248) continue
      out += BASE62[b % 62]
      if (out.length === 20) break
    }
  }
  return `t_${out}`
}

export interface TraceStep {
  name: string
  ms: number
  /** 선택 메타 — 숫자·짧은 식별자만(원문 금지). */
  [key: string]: string | number | boolean | null | undefined
}

export interface TraceRecord {
  traceId: string
  kind: TraceKind
  userId?: string | null
  status: TraceStatus
  steps: TraceStep[]
  totalMs?: number | null
  errorCode?: string | null
  refType?: string | null
  refId?: string | null
}

export async function recordTrace(t: TraceRecord): Promise<void> {
  try {
    await prisma.requestTrace.create({
      data: {
        traceId: t.traceId,
        environment: currentEnvironment(),
        userId: t.userId ?? null,
        kind: t.kind,
        status: t.status,
        steps: t.steps as unknown as Prisma.InputJsonValue,
        totalMs: t.totalMs ?? null,
        errorCode: t.errorCode ? t.errorCode.slice(0, 40) : null,
        refType: t.refType ? t.refType.slice(0, 30) : null,
        refId: t.refId ? t.refId.slice(0, 40) : null,
      },
    })
  } catch (e) {
    console.warn('[trace] 기록 실패:', e instanceof Error ? e.message : String(e))
  }
}

/**
 * 이미 기록된 Trace 에 단계를 덧붙인다(task-007 K7 — 다음 턴이 보고한 직전 턴 재생 계측 `PLAYBACK`). 주인(userId)이 같은 행만,
 * 한 행 steps 는 최대 64개. 실패는 삼킨다(계측이 요청을 막지 않는다).
 */
export async function appendTraceSteps(traceId: string, userId: string, steps: TraceStep[]): Promise<boolean> {
  try {
    const row = await prisma.requestTrace.findFirst({ where: { traceId, userId }, select: { steps: true } })
    if (!row) return false
    const prev = Array.isArray(row.steps) ? (row.steps as unknown as TraceStep[]) : []
    const next = [...prev, ...steps].slice(0, 64)
    await prisma.requestTrace.updateMany({ where: { traceId, userId }, data: { steps: next as unknown as Prisma.InputJsonValue } })
    return true
  } catch (e) {
    console.warn('[trace] 단계 덧붙이기 실패:', e instanceof Error ? e.name : 'unknown')
    return false
  }
}

// ── 조회(task-005b #128·#129, 대시보드 24h 요약) ─────────────────────────────


export interface TraceFilter {
  environment: Environment
  kind?: TraceKind
  status?: TraceStatus
  from?: Date
  to?: Date
  /** connection 으로 거르기: Functional Test 는 refId, 턴·기타는 steps[].connectionKey / steps[].connection(task-006 toolLog 키). */
  connection?: { id: string; key: string }
  userId?: string
  refType?: string
  refId?: string
  cursor?: { t: string; id: string } | null
  limit: number
}

/** 최신순 커서 목록(createdAt desc, traceId desc). */
export async function listTraces(f: TraceFilter): Promise<{ items: RequestTrace[]; next: { t: string; id: string } | null }> {
  const where: Prisma.RequestTraceWhereInput = {
    environment: f.environment,
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.refType ? { refType: f.refType } : {}),
    ...(f.refId ? { refId: f.refId } : {}),
    ...(f.connection
      ? {
          OR: [
            { refId: f.connection.id },
            { steps: { array_contains: [{ connectionKey: f.connection.key }] } },
            { steps: { array_contains: [{ connection: f.connection.key }] } },
          ],
        }
      : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
  }
  const cursorWhere: Prisma.RequestTraceWhereInput | undefined = f.cursor
    ? { OR: [{ createdAt: { lt: new Date(f.cursor.t) } }, { createdAt: new Date(f.cursor.t), traceId: { lt: f.cursor.id } }] }
    : undefined
  const rows = await prisma.requestTrace.findMany({
    where: cursorWhere ? { AND: [where, cursorWhere] } : where,
    orderBy: [{ createdAt: 'desc' }, { traceId: 'desc' }],
    take: f.limit + 1,
  })
  const items = rows.slice(0, f.limit)
  const last = items.at(-1)
  return { items, next: rows.length > f.limit && last ? { t: last.createdAt.toISOString(), id: last.traceId } : null }
}

/** 단건 — 환경이 다르면 null(존재 비노출). */
export async function getTrace(environment: Environment, traceId: string): Promise<RequestTrace | null> {
  if (!/^t_[0-9A-Za-z]{20}$|^trc_[0-9A-Za-z]{10,36}$/.test(traceId)) return null
  const row = await prisma.requestTrace.findUnique({ where: { traceId } })
  return row && row.environment === environment ? row : null
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]
}

/** 최근 24시간 회화 턴 요약(대시보드 #80 traces24h) — 최대 5,000행으로 p50/p95. */
export async function turnStats24h(environment: Environment): Promise<{ turns: number; errors: number; p50Ms: number | null; p95Ms: number | null }> {
  const since = new Date(Date.now() - 24 * 3600_000)
  const where: Prisma.RequestTraceWhereInput = { environment, kind: 'TURN', createdAt: { gte: since } }
  const [turns, errors, rows] = await Promise.all([
    prisma.requestTrace.count({ where }),
    prisma.requestTrace.count({ where: { ...where, status: 'ERROR' } }),
    prisma.requestTrace.findMany({ where: { ...where, totalMs: { not: null } }, select: { totalMs: true }, orderBy: { createdAt: 'desc' }, take: 5000 }),
  ])
  const ms = rows.map((r) => r.totalMs as number).sort((a, b) => a - b)
  return { turns, errors, p50Ms: percentile(ms, 50), p95Ms: percentile(ms, 95) }
}
