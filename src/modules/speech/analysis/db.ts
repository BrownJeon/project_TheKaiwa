/**
 * 분석 잡(`SpeechJob`)·발화(`Utterance`)·분석 결과(`SpeechAnalysis`) DB 진입점 — 모두 speech 소유 테이블(task-012b).
 * 단위 테스트가 메서드를 바꿔 끼운다(`utteranceDb` 와 같은 방식 — Prisma 위임 객체는 mock.method 로 바꿀 수 없다).
 * 잠금 순서(교착 방지): claim = 잡 행(SKIP LOCKED) · #140 = 잡 행 → 발화 행 · #138 = 발화 행 → 잡 행. #138 과 #140 이 같은 잡을 두고 겹치면
 * 서로 다른 순서라 교착 가능 → `withTransaction` 이 P2034 를 재시도하고, 재시도 뒤에는 상태 조건(RUNNING·ANALYZED)이 결과를 정한다.
 */
import { Prisma, type FinalSource, type JobStatus, type RecognitionMode, type SpeechJobKind, type UtteranceStatus } from '@prisma/client'
import { stt } from '@/modules/engine'
import { listQaUserIds, prisma, withTransaction, type Tx } from '@/modules/infra'
import { getAppSetting, getRecognitionMode, getRecognitionModes } from '@/modules/preferences'
import { ANALYSIS_DEBOUNCE_CAP_MS, ANALYSIS_DEBOUNCE_MS } from './policy'

export interface OrphanRow {
  id: string
  utteranceId: string
  attempts: number
  maxAttempts: number
}

export interface LockedQueued {
  id: string
  userId: string
  createdAt: Date
}

export interface ClaimedRow {
  id: string
  kind: SpeechJobKind
  attempts: number
  userId: string
  utteranceId: string
  audioPath: string | null
  audioDeletedAt: Date | null
  realtimeText: string
}

export interface LockedJob {
  id: string
  userId: string
  utteranceId: string
  kind: SpeechJobKind
  status: JobStatus
  lockedBy: string | null
  attempts: number
  maxAttempts: number
}

export interface LockedUtterance {
  id: string
  userId: string
  status: UtteranceStatus
  finalSource: FinalSource
  requiresReview: boolean
  transcriptConfidence: number | null
}

const userScope = (userIds: readonly string[] | null) => (userIds ? { userId: { in: [...userIds] } } : {})

export const analysisDb = {
  transaction: <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => withTransaction(fn),

  // 다른 층 조회(교체 가능하게 여기 모은다) — QA 계정(D-B11)·인식 모드(L1)·재확인 임계 AppSetting(L1)·분석 connection(L5).
  qaUserIds: (): Promise<string[]> => listQaUserIds(),
  recognitionMode: (userId: string): Promise<RecognitionMode> => getRecognitionMode(userId),
  recognitionModes: (userIds: readonly string[]): Promise<Map<string, RecognitionMode>> => getRecognitionModes(userIds),
  reviewOverride: (key: string): Promise<unknown> => getAppSetting<unknown>(key, null),
  analysisTarget: () => stt.analysisTarget(),
  analysisConnectionKey: (key: string): Promise<string | null> => stt.findAnalysisConnectionKey(key),

  /**
   * 사용자별 디바운스(policy `debouncedRunAfter` 와 같은 규칙) — 이 사용자의 QUEUED 분석 잡을 `now+20초` 로 미루되 줄이지 않고, 만든 지 5분 지난 잡은
   * 그대로. RUNNING 은 건드리지 않는다. 발화 행 생성과 **같은 트랜잭션**(`withTransaction` — P2034 재시도)에서 부른다(`utteranceDb.create`).
   * 시각은 앱 값(UTC)을 넘긴다 — DB `NOW()` 는 서버 시간대(KST)라 Prisma 가 쓴 UTC 칸과 섞이면 9시간 어긋난다.
   */
  debounce: (tx: Tx, userId: string, now: Date): Promise<number> =>
    tx.$executeRaw`UPDATE SpeechJob
      SET runAfter = GREATEST(runAfter, LEAST(${new Date(now.getTime() + ANALYSIS_DEBOUNCE_MS)}, DATE_ADD(createdAt, INTERVAL ${ANALYSIS_DEBOUNCE_CAP_MS / 1000} SECOND)))
      WHERE userId = ${userId} AND kind = 'ANALYSIS_STT' AND status = 'QUEUED' AND createdAt > ${new Date(now.getTime() - ANALYSIS_DEBOUNCE_CAP_MS)}`,

  /** 집을 잡(기한 된 QUEUED)·회수할 고아(오래 잠긴 RUNNING)·이 워커가 쥔 채 남은 RUNNING 이 하나라도 있나 — 트랜잭션 없는 읽기 1회. 세 갈래 모두 요청한 종류만. */
  hasClaimable: async (q: { kinds: readonly SpeechJobKind[]; now: Date; cutoff: Date; userIds: readonly string[] | null; workerId: string }): Promise<boolean> =>
    (await prisma.speechJob.findFirst({
      where: {
        ...userScope(q.userIds),
        kind: { in: [...q.kinds] },
        OR: [{ status: 'QUEUED', runAfter: { lte: q.now } }, { status: 'RUNNING', lockedAt: { lt: q.cutoff } }, { status: 'RUNNING', lockedBy: q.workerId }],
      },
      select: { id: true },
    })) !== null,

  orphans: (tx: Tx, cutoff: Date, userIds: readonly string[] | null, kinds: readonly SpeechJobKind[]): Promise<OrphanRow[]> =>
    tx.speechJob.findMany({
      where: { status: 'RUNNING', kind: { in: [...kinds] }, lockedAt: { lt: cutoff }, ...userScope(userIds) },
      select: { id: true, utteranceId: true, attempts: true, maxAttempts: true },
      take: 50,
    }),

  /**
   * 같은 워커 **인스턴스**(`lockedBy` 정확히 일치 — 워커가 기동마다 붙이는 nonce 포함)가 다시 claim 했을 때 그 인스턴스가 쥔 RUNNING 잡 —
   * 직렬 워커(max≤2, 받은 잡을 다 끝낸 뒤 claim)가 새 일을 달라는 것은 쥔 잡이 없다는 뜻이므로, 남아 있으면 claim 응답을 못 받은 것이다
   * → 15분을 기다리지 않고 바로 되돌린다. 같은 SPEECH_WORKER_ID 의 다른 프로세스·재기동한 프로세스는 nonce 가 달라 서로의 잡을 건드리지 않는다(REV-033 M1).
   */
  ownStale: (tx: Tx, workerId: string, userIds: readonly string[] | null, kinds: readonly SpeechJobKind[]): Promise<OrphanRow[]> =>
    tx.speechJob.findMany({
      where: { status: 'RUNNING', kind: { in: [...kinds] }, lockedBy: workerId, ...userScope(userIds) },
      select: { id: true, utteranceId: true, attempts: true, maxAttempts: true },
      take: 10,
    }),

  /** 조건부 — 그 사이 다른 claim 이 먼저 회수했으면 0. */
  requeueOrphan: async (tx: Tx, id: string, cutoff: Date): Promise<number> =>
    (await tx.speechJob.updateMany({ where: { id, status: 'RUNNING', lockedAt: { lt: cutoff } }, data: { status: 'QUEUED', lockedBy: null, lockedAt: null, error: 'ORPHANED' } })).count,

  failOrphan: async (tx: Tx, row: OrphanRow, cutoff: Date, now: Date): Promise<number> => {
    const n = (await tx.speechJob.updateMany({ where: { id: row.id, status: 'RUNNING', lockedAt: { lt: cutoff } }, data: { status: 'FAILED', error: 'ORPHANED', finishedAt: now } })).count
    if (n) await tx.utterance.updateMany({ where: { id: row.utteranceId, status: { not: 'ANALYZED' } }, data: { status: 'FAILED' } })
    return n
  },

  /**
   * 집을 잡 잠금 — `FOR UPDATE SKIP LOCKED`(MariaDB 10.6+, 운영 10.11 확인): 다른 claim 이 잠근 행은 건너뛰어 워커 둘이 같은 잡을 받지 않는다.
   * `runAfter` 는 앱이 넣은 UTC 값이라 서버 시계(NOW()) 대신 앱 시각을 넘긴다.
   */
  lockQueued: async (tx: Tx, q: { kinds: readonly SpeechJobKind[]; now: Date; max: number; userIds: readonly string[] | null }): Promise<LockedQueued[]> => {
    const users = q.userIds ? Prisma.sql`AND userId IN (${Prisma.join([...q.userIds])})` : Prisma.empty
    return tx.$queryRaw<LockedQueued[]>`
      SELECT id, userId, createdAt FROM SpeechJob
      WHERE status = 'QUEUED' AND kind IN (${Prisma.join([...q.kinds])}) AND runAfter <= ${q.now} ${users}
      ORDER BY runAfter ASC, createdAt ASC
      LIMIT ${q.max}
      FOR UPDATE SKIP LOCKED`
  },

  /** 사용자별 가장 최근 발화 시각(`since` 이후만 — `@@index([userId, createdAt])`). claim 재검사용 일반 읽기(잠금 없음). */
  lastUtteranceAt: async (tx: Tx, userIds: readonly string[], since: Date): Promise<Map<string, Date>> => {
    if (userIds.length === 0) return new Map()
    const rows = await tx.utterance.groupBy({ by: ['userId'], where: { userId: { in: [...new Set(userIds)] }, createdAt: { gt: since } }, _max: { createdAt: true } })
    return new Map(rows.filter((r) => r._max.createdAt).map((r) => [r.userId, r._max.createdAt as Date]))
  },

  /** 잠근 QUEUED 잡을 올리지 않고 미룬다(재검사 — 대화 중). 이 트랜잭션이 잠금을 쥔 행. */
  deferQueued: async (tx: Tx, id: string, runAfter: Date): Promise<void> => {
    await tx.speechJob.updateMany({ where: { id, status: 'QUEUED' }, data: { runAfter } })
  },

  markRunning: async (tx: Tx, ids: readonly string[], workerId: string, now: Date): Promise<number> =>
    (await tx.speechJob.updateMany({ where: { id: { in: [...ids] }, status: 'QUEUED' }, data: { status: 'RUNNING', attempts: { increment: 1 }, lockedBy: workerId, lockedAt: now, startedAt: now } })).count,

  claimedRows: async (tx: Tx, ids: readonly string[]): Promise<ClaimedRow[]> => {
    const rows = await tx.speechJob.findMany({
      where: { id: { in: [...ids] }, status: 'RUNNING' },
      orderBy: [{ runAfter: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, kind: true, attempts: true, userId: true, utteranceId: true, utterance: { select: { audioPath: true, audioDeletedAt: true, realtimeText: true } } },
    })
    return rows.map((r) => ({ id: r.id, kind: r.kind, attempts: r.attempts, userId: r.userId, utteranceId: r.utteranceId, audioPath: r.utterance.audioPath, audioDeletedAt: r.utterance.audioDeletedAt, realtimeText: r.utterance.realtimeText }))
  },

  lockJob: async (tx: Tx, id: string): Promise<LockedJob | null> => {
    const rows = await tx.$queryRaw<LockedJob[]>`
      SELECT id, userId, utteranceId, kind, status, lockedBy, attempts, maxAttempts FROM SpeechJob WHERE id = ${id} FOR UPDATE`
    return rows[0] ?? null
  },

  requeueJob: (tx: Tx, id: string, runAfter: Date, error: string) =>
    tx.speechJob.update({ where: { id }, data: { status: 'QUEUED', runAfter, lockedBy: null, lockedAt: null, error } }),

  failJob: async (tx: Tx, job: Pick<LockedJob, 'id' | 'utteranceId'>, error: string, now: Date): Promise<void> => {
    await tx.speechJob.update({ where: { id: job.id }, data: { status: 'FAILED', error, finishedAt: now } })
    await tx.utterance.updateMany({ where: { id: job.utteranceId, status: { not: 'ANALYZED' } }, data: { status: 'FAILED' } })
  },

  lockUtterance: async (tx: Tx, id: string): Promise<LockedUtterance | null> => {
    const rows = await tx.$queryRaw<(Omit<LockedUtterance, 'requiresReview'> & { requiresReview: number | boolean })[]>`
      SELECT id, userId, status, finalSource, requiresReview, transcriptConfidence FROM Utterance WHERE id = ${id} FOR UPDATE`
    const r = rows[0]
    return r ? { ...r, requiresReview: Boolean(r.requiresReview) } : null
  },

  jobOfUtterance: (tx: Tx, jobId: string, utteranceId: string) =>
    tx.speechJob.findFirst({ where: { id: jobId, utteranceId }, select: { id: true, kind: true, status: true } }),

  storeAnalysis: async (
    tx: Tx,
    input: { utteranceId: string; jobId: string; analysisEngine: string; analysisText: string; confidence: number; requiresReview: boolean; engineVersions: Prisma.InputJsonValue; now: Date },
  ): Promise<void> => {
    await tx.utterance.update({
      where: { id: input.utteranceId },
      data: { analysisEngine: input.analysisEngine, analysisText: input.analysisText, transcriptConfidence: input.confidence, requiresReview: input.requiresReview, status: 'ANALYZED' },
    })
    await tx.speechAnalysis.upsert({
      where: { utteranceId: input.utteranceId },
      create: { utteranceId: input.utteranceId, engineVersions: input.engineVersions, analyzedAt: input.now },
      update: { engineVersions: input.engineVersions, analyzedAt: input.now },
    })
    await tx.speechJob.update({ where: { id: input.jobId }, data: { status: 'DONE', finishedAt: input.now } })
  },
}
