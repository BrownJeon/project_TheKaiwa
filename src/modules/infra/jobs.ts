/**
 * AiJob 최소판(api-contract #55, domain-model §5-8) — 30초 넘을 수 있는 LLM 작업의 상태만 관리한다. 별도 워커는 없고
 * **같은 Node 프로세스 백그라운드**로 돈다(task-006 범위결정 4). 잡 본문(프롬프트·대화)은 저장하지 않는다 — `payload` 는 메타만.
 *
 * 비정상 종료로 남은 잡은 **나이로** 판정한다: blue/green 전환 중 다른 인스턴스가 돌리는 잡을 죽이지 않도록, 종류별 최대 실행
 * 시간보다 충분히 오래된 QUEUED/RUNNING 만 `FAILED('stale')` 로 바꾼다(기동 시 + 조회 시 지연 정리).
 */
import type { JobKind, JobStatus, Prisma } from '@prisma/client'
import { prisma } from './db'
import { classifyError } from './http'
import type { Tx } from './tx'

/**
 * 종류별 "이보다 오래 QUEUED/RUNNING 이면 죽은 잡" 기준(5분). 시계는 QUEUED 는 `createdAt`, RUNNING 은 `startedAt`(러너가 잡을 집은 시각 —
 * LLM 큐 대기 포함)이고, **이 프로세스가 돌리는 잡(`localJobs`)은 면제**라 실제 적용 대상은 비정상 종료·blue/green 겹침 구간에 다른 인스턴스가 본 잡이다.
 * 잡별 LLM 예산(CHAT_REVIEW 90s·LESSON_GEN·REVIEW_GEN 120s·EVAL_GEN 60s·EVAL_GRADE 120s)보다 넉넉하다. REVIEW_DECISION 은 LLM 호출 하나가
 * 타임아웃 재시도를 켜서(task-010b3) 유효 상한이 ≈121~131s(+배치 큐 대기)이며 사용자별 한 줄로 돌아 앞 잡 뒤에 QUEUED 로 기다릴 수 있다 — 그래도 5분 안.
 */
const STALE_AFTER_MS: Partial<Record<JobKind, number>> = {
  CHAT_REVIEW: 5 * 60_000,
  LESSON_GEN: 5 * 60_000,
  REVIEW_GEN: 5 * 60_000,
  EVAL_GEN: 5 * 60_000,
  EVAL_GRADE: 5 * 60_000,
  REVIEW_DECISION: 5 * 60_000,
}
const DEFAULT_STALE_AFTER_MS = 10 * 60_000

export function staleAfterMs(kind: JobKind): number {
  return STALE_AFTER_MS[kind] ?? DEFAULT_STALE_AFTER_MS
}

declare global {
  var __kaiwaLocalJobs: Set<string> | undefined
}
/** 이 프로세스가 지금 돌리고 있는 잡 id(라우트 번들이 달라도 한 프로세스에 하나 — globalThis). */
const localJobs: Set<string> = (globalThis.__kaiwaLocalJobs ??= new Set())

export interface JobDto {
  id: string
  kind: JobKind
  status: JobStatus
  progress: number
  stage: string | null
  refId: string | null
  error: string | null
  createdAt: string
  finishedAt: string | null
}

type JobRow = { id: string; kind: JobKind; status: JobStatus; progress: number; stage: string | null; refId: string | null; error: string | null; createdAt: Date; startedAt: Date | null; finishedAt: Date | null }

function toDto(j: JobRow): JobDto {
  return {
    id: j.id,
    kind: j.kind,
    status: j.status,
    progress: j.progress,
    stage: j.stage,
    refId: j.refId,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
  }
}

/** 순수 판정 — 활성 잡이 죽은 것으로 볼 만큼 오래됐는가(이 프로세스가 돌리는 잡은 제외). */
export function isStaleJob(j: Pick<JobRow, 'id' | 'kind' | 'status' | 'createdAt' | 'startedAt'>, now = Date.now()): boolean {
  if (j.status !== 'QUEUED' && j.status !== 'RUNNING') return false
  if (localJobs.has(j.id)) return false
  const since = (j.status === 'RUNNING' ? j.startedAt : null) ?? j.createdAt
  return now - since.getTime() > staleAfterMs(j.kind)
}

const SELECT = { id: true, kind: true, status: true, progress: true, stage: true, refId: true, error: true, createdAt: true, startedAt: true, finishedAt: true } as const

export async function createJob(
  input: { userId: string; kind: JobKind; refId?: string | null; payload?: Prisma.InputJsonValue; traceId?: string | null; status?: 'QUEUED' | 'RUNNING' },
  tx?: Tx,
): Promise<{ id: string }> {
  const db = tx ?? prisma
  const running = input.status === 'RUNNING'
  const job = await db.aiJob.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      status: input.status ?? 'QUEUED',
      refId: input.refId ?? null,
      payload: input.payload,
      traceId: input.traceId ?? null,
      ...(running ? { startedAt: new Date(), attempts: 1 } : {}),
    },
    select: { id: true },
  })
  return job
}

/**
 * 같은 대상(`kind`+`refId`)의 진행 중 잡. 오래된 것은 이 자리에서 `FAILED('stale')` 로 정리하고 무시한다.
 * 호출자가 대상 행을 `FOR UPDATE` 로 잠근 트랜잭션 안에서 부르면 "확인 → 생성" 이 프로세스 사이에서도 원자적이다.
 */
export async function findActiveJob(where: { userId: string; kind: JobKind; refId: string }, tx?: Tx): Promise<{ id: string; status: JobStatus } | null> {
  const db = tx ?? prisma
  const rows = await db.aiJob.findMany({
    where: { userId: where.userId, kind: where.kind, refId: where.refId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: SELECT,
    orderBy: { createdAt: 'desc' },
  })
  const stale = rows.filter((r) => isStaleJob(r))
  if (stale.length) await db.aiJob.updateMany({ where: { id: { in: stale.map((r) => r.id) }, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: 'stale', finishedAt: new Date() } })
  const live = rows.find((r) => !stale.includes(r))
  return live ? { id: live.id, status: live.status } : null
}

/**
 * 사용자의 같은 종류 진행 중 잡(대상 무관) — "사용자당 동시 1개" 판정용(task-010 L10). 오래된 것은 정리하고 무시한다.
 * 호출자가 사용자 행을 잠근 트랜잭션 안에서 부르면 "확인 → 생성" 이 프로세스 사이에서도 원자적이다.
 */
export async function findActiveJobByKind(where: { userId: string; kind: JobKind }, tx?: Tx): Promise<{ id: string; status: JobStatus; refId: string | null } | null> {
  const db = tx ?? prisma
  const rows = await db.aiJob.findMany({
    where: { userId: where.userId, kind: where.kind, status: { in: ['QUEUED', 'RUNNING'] } },
    select: SELECT,
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const stale = rows.filter((r) => isStaleJob(r))
  if (stale.length) await db.aiJob.updateMany({ where: { id: { in: stale.map((r) => r.id) }, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: 'stale', finishedAt: new Date() } })
  const live = rows.find((r) => !stale.includes(r))
  return live ? { id: live.id, status: live.status, refId: live.refId } : null
}

export async function updateJobProgress(id: string, progress: number, stage: string): Promise<void> {
  try {
    await prisma.aiJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { progress: Math.max(0, Math.min(100, Math.round(progress))), stage: stage.slice(0, 40) } })
  } catch (e) {
    console.warn('[jobs] 진행률 갱신 실패:', e instanceof Error ? e.message : String(e))
  }
}

/**
 * 펜싱 — 이 잡이 대상(`kind`+`refId`)의 **현재 세대**인가: 자기 행이 아직 QUEUED/RUNNING(= `FAILED('stale')` 로 닫히지 않음)이고
 * 같은 대상에 더 새(같은 시각 이후에 만든 다른) 잡이 없다. `AiJob.id` 가 세대 토큰이라 스키마 변경이 필요 없다.
 * 대상을 되살리는 쪽(옛 잡을 stale 로 닫고 새 잡을 만드는 트랜잭션)과 **같은 잠금**(예: 사용자 행)을 잡은 트랜잭션 안에서 불러야
 * "확인 → 저장" 이 프로세스 사이에서도 직렬화된다(READ COMMITTED — 잠금을 기다리는 동안 커밋된 행을 본다).
 */
export async function isCurrentJob(where: { id: string; userId: string; kind: JobKind; refId: string }, tx: Tx): Promise<boolean> {
  const own = await tx.aiJob.findFirst({ where: { id: where.id, userId: where.userId, kind: where.kind, refId: where.refId }, select: { status: true, createdAt: true } })
  if (!own || (own.status !== 'QUEUED' && own.status !== 'RUNNING')) return false
  const newer = await tx.aiJob.count({ where: { userId: where.userId, kind: where.kind, refId: where.refId, id: { not: where.id }, createdAt: { gte: own.createdAt } } })
  return newer === 0
}

/**
 * 잡이 아직 진행 중(QUEUED/RUNNING)일 때만 진행률·단계를 바꾼다 — DONE 전이를 트랜잭션 뒤로 미루는 잡(task-011 채점: 레벨 제안 뒤 DONE)이
 * 대상 저장 트랜잭션 안에서 "아직 살아 있는 내 잡인가" 를 마지막으로 확인할 때 쓴다. 잠금 밖 stale 정리에 졌으면 false(호출자가 되돌린다).
 */
export async function markJobStage(id: string, progress: number, stage: string, tx: Tx): Promise<boolean> {
  const r = await tx.aiJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { progress: Math.max(0, Math.min(100, Math.round(progress))), stage: stage.slice(0, 40) } })
  return r.count > 0
}

/** DONE 전이 — 대상 엔티티 저장과 같은 트랜잭션에서 부른다(tx). 이미 끝난 잡은 건드리지 않는다. 전이했으면 true(잠금 밖 stale 정리에 졌으면 false). */
export async function completeJob(id: string, tx?: Tx): Promise<boolean> {
  const db = tx ?? prisma
  const r = await db.aiJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'DONE', progress: 100, stage: 'DONE', finishedAt: new Date(), error: null } })
  return r.count > 0
}

/**
 * FAILED 전이 — `error` 에는 오류 코드만 남긴다(대화 본문·엔진 원문 없음).
 * `tx` 를 주면 대상 엔티티 실패 기록과 같은 트랜잭션에서 전이하고 오류를 그대로 던진다(트랜잭션이 되돌려지게). 없으면 삼키고 로그만.
 */
export async function failJob(id: string, errorCode: string, tx?: Tx): Promise<void> {
  if (tx) {
    await tx.aiJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: errorCode.slice(0, 500), finishedAt: new Date() } })
    return
  }
  try {
    await prisma.aiJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: errorCode.slice(0, 500), finishedAt: new Date() } })
  } catch (e) {
    console.error('[jobs] FAILED 전이 실패:', e instanceof Error ? e.message : String(e))
  }
}

/**
 * 잡을 이 프로세스 백그라운드로 돌린다. `fn` 은 성공 시 대상 저장과 `completeJob(id, tx)` 를 한 트랜잭션에서 끝낸다.
 * 예외는 코드로만 기록한다(`classifyError`). 이 함수는 기다리지 않는다.
 */
export function runJobInBackground(id: string, fn: () => Promise<void>): void {
  localJobs.add(id)
  void (async () => {
    try {
      await prisma.aiJob.updateMany({ where: { id, status: 'QUEUED' }, data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } } })
      await fn()
    } catch (e) {
      const c = classifyError(e)
      if (c.code === 'INTERNAL') console.error(`[jobs] ${id} 실패:`, e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      await failJob(id, c.code)
    } finally {
      localJobs.delete(id)
    }
  })()
}

/** 이 프로세스가 돌리는 잡으로 등록/해제 — 동기 경로(요청 안에서 기다리는 잡)도 지연 정리 대상에서 빠지게. */
export function markLocalJob(id: string, running: boolean): void {
  if (running) localJobs.add(id)
  else localJobs.delete(id)
}

/** #55 — 소유자 것만(타인·없음 → null, 라우트가 404). 오래된 활성 잡은 읽는 자리에서 FAILED 로 정리. */
export async function getJobForUser(userId: string, id: string): Promise<JobDto | null> {
  if (typeof id !== 'string' || id.length === 0 || id.length > 40) return null
  const j = await prisma.aiJob.findFirst({ where: { id, userId }, select: SELECT })
  if (!j) return null
  if (isStaleJob(j)) {
    await prisma.aiJob.updateMany({ where: { id: j.id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: 'stale', finishedAt: new Date() } })
    return toDto({ ...j, status: 'FAILED', error: 'stale', finishedAt: new Date() })
  }
  return toDto(j)
}

/** 기동 시 정리 — 종류별 기준보다 오래된 QUEUED/RUNNING 만 FAILED('restart'). 반환 = 정리한 수. */
export async function sweepStaleJobs(now = Date.now()): Promise<number> {
  const rows = await prisma.aiJob.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] } }, select: SELECT, take: 500 })
  const stale = rows.filter((r) => isStaleJob(r, now)).map((r) => r.id)
  if (!stale.length) return 0
  const res = await prisma.aiJob.updateMany({ where: { id: { in: stale }, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', error: 'restart', finishedAt: new Date() } })
  return res.count
}
