/**
 * 분석 잡 수명주기(api-contract #139·#140, domain-model §5-8, task-012b D-B1·D-B10·D-B11) — worker 는 DB 에 접속하지 않고 이 두 함수만 HTTP 로 부른다.
 *
 *  #139 claim(한 트랜잭션): ① 고아 회수(RUNNING·lockedAt 15분↑, 그리고 **같은 워커가 쥔 채 남은 RUNNING** — 응답 유실 복구 → QUEUED,
 *       한도를 다 쓴 잡은 FAILED + 발화 FAILED) ② `FOR UPDATE SKIP LOCKED` 로
 *       QUEUED·runAfter 지난 잡 max 개 잠금 ③ RUNNING·attempts+1·lockedBy/lockedAt/startedAt ④ 발화는 QUEUED 유지. 받은 시각 = 워커 하트비트.
 *  #140 실패 보고(한 트랜잭션): 잡 잠금 → 펜싱(RUNNING·lockedBy=보고한 워커·attempts=보고한 claim 세대, 아니면 409 STALE_CLAIM)
 *       → 재시도면 QUEUED(runAfter 30s·2m·10m), 아니면 FAILED + 발화 FAILED.
 *  환경 필터(D-B11): APP_ENV ≠ PRODUCTION 프로세스는 QA 계정 발화의 잡만 보고·바꾼다(개발·운영이 같은 DB·DATA_ROOT) — 고아 회수·#140 포함.
 */
import type { RecognitionMode, SpeechJobKind } from '@prisma/client'
import { ApiError, type Tx } from '@/modules/infra'
import { currentEnvironment } from '@/modules/engine'
import { analysisDb } from './db'
import { recordWorkerHeartbeat } from './heartbeat'
import { ANALYSIS_DEBOUNCE_MS, claimDeferral, nextAfterFailure, ORPHAN_AFTER_MS, orphanOutcome } from './policy'
import type { ClaimInput, FailureInput } from './validate'

/** null = 모든 사용자(운영). 배열 = 이 사용자들의 잡만(비운영 — QA 계정). */
export async function jobUserScope(): Promise<string[] | null> {
  return currentEnvironment() === 'PRODUCTION' ? null : analysisDb.qaUserIds()
}

export function inScope(scope: readonly string[] | null, userId: string): boolean {
  return scope === null || scope.includes(userId)
}

export interface ClaimedJob {
  id: string
  kind: SpeechJobKind
  utteranceId: string
  /** DATA_ROOT 상대. 보존 기한 정리로 지워졌으면 null — 워커가 AUDIO_MISSING 으로 보고한다. */
  audioPath: string | null
  realtimeText: string
  recognitionMode: RecognitionMode
  attempts: number
}

/**
 * 고아 회수 — ① 오래(15분↑) 잠긴 RUNNING ② **claim 한 바로 그 워커 인스턴스가 쥔 RUNNING**(응답 유실: 앱 커밋 뒤 워커 쪽 타임아웃 — 워커는 직렬이라
 * 새 claim = 쥔 잡 없음. 인스턴스 id 에 기동 nonce 가 있어 재기동한 워커·같은 SPEECH_WORKER_ID 의 다른 프로세스는 ①(15분)로만 회수된다).
 * 한도를 다 쓴 잡은 FAILED(+발화 FAILED), 아니면 QUEUED(attempts 유지 → 다시 집히며 +1).
 */
export async function recoverOrphans(
  tx: Tx,
  scope: readonly string[] | null,
  now: Date,
  kinds: readonly SpeechJobKind[],
  workerId?: string,
): Promise<{ requeued: number; failed: number; selfReclaimed: number }> {
  const stale = new Date(now.getTime() - ORPHAN_AFTER_MS)
  let requeued = 0
  let failed = 0
  const recover = async (rows: { id: string; utteranceId: string; attempts: number; maxAttempts: number }[], cutoff: Date) => {
    let n = 0
    for (const row of rows) {
      if (orphanOutcome(row.attempts, row.maxAttempts) === 'FAILED') {
        const k = await analysisDb.failOrphan(tx, row, cutoff, now)
        failed += k
        n += k
      } else {
        const k = await analysisDb.requeueOrphan(tx, row.id, cutoff)
        requeued += k
        n += k
      }
    }
    return n
  }
  await recover(await analysisDb.orphans(tx, stale, scope, kinds), stale)
  // 자기 잡(= 정확히 같은 **인스턴스 id** — 워커가 기동마다 붙이는 nonce 포함, 같은 SPEECH_WORKER_ID 의 다른 프로세스는 다른 id)은
  // lockedAt 조건 없이(지금 이 순간보다 이전에 잠근 것 전부) — 조건부 갱신의 cutoff 로 now 를 넘긴다.
  const selfReclaimed = workerId ? await recover(await analysisDb.ownStale(tx, workerId, scope, kinds), new Date(now.getTime() + 1)) : 0
  return { requeued, failed, selfReclaimed }
}

const CLAIM_ROUNDS = 3

/**
 * 잠근 QUEUED 잡 중 **지금 올려도 되는 것**(Codex C2 지적 1): 잠근 뒤 그 사용자의 최근 발화(커밋된 것)를 다시 보고, 20초 안이면 올리지 않고 미룬다
 * (`claimDeferral` — 상한 5분 동일). 미룬 잡은 이 트랜잭션에서 runAfter 가 미래가 돼 다음 라운드 잠금에서 빠지므로, 다른 사용자 잡을 최대 3라운드 더 본다.
 * 발화 저장 쪽은 디바운스 UPDATE 를 발화 INSERT 보다 **먼저** 해(`utteranceDb.create`) 진행 중인 발화의 옛 잡 행을 잠가 둔다 → claim 의 SKIP LOCKED 가 건너뛴다.
 * 남는 창은 "claim 이 잠근 뒤에야 발화 트랜잭션이 시작된" 경우뿐(= claim 이 발화보다 먼저) — 사용자 행 전역 잠금 없이 받아들이는 한계(Leader 2026-09-29).
 */
export async function lockClaimable(tx: Tx, input: ClaimInput, now: Date, scope: readonly string[] | null): Promise<string[]> {
  const picked: string[] = []
  for (let round = 0; round < CLAIM_ROUNDS && picked.length < input.max; round++) {
    const locked = await analysisDb.lockQueued(tx, { kinds: input.kinds, now, max: input.max - picked.length, userIds: scope })
    if (locked.length === 0) break
    const last = await analysisDb.lastUtteranceAt(tx, locked.map((j) => j.userId), new Date(now.getTime() - ANALYSIS_DEBOUNCE_MS))
    let deferred = 0
    for (const j of locked) {
      const until = claimDeferral(j, last.get(j.userId) ?? null, now.getTime())
      if (until) {
        await analysisDb.deferQueued(tx, j.id, until)
        deferred++
      } else picked.push(j.id)
    }
    if (deferred === 0) break
  }
  return picked
}

/** #139 — 빈 응답이어도 하트비트는 갱신된다(적재 게이트·health). */
export async function claimAnalysisJobs(input: ClaimInput, now = new Date()): Promise<{ jobs: ClaimedJob[] }> {
  recordWorkerHeartbeat(now.getTime())
  const scope = await jobUserScope()
  if (scope && scope.length === 0) return { jobs: [] }
  // 빈 큐면 트랜잭션을 열지 않는다 — 유휴 워커가 1~10초마다 부르므로 공유 NAS DB 왕복(BEGIN·잠금 SELECT·COMMIT)을 줄인다.
  // 확인과 잠금 사이에 들어온 잡은 다음 claim 이 집는다.
  if (!(await analysisDb.hasClaimable({ kinds: input.kinds, now, cutoff: new Date(now.getTime() - ORPHAN_AFTER_MS), userIds: scope, workerId: input.workerId }))) return { jobs: [] }
  const rows = await analysisDb.transaction(async (tx) => {
    const orphans = await recoverOrphans(tx, scope, now, input.kinds, input.workerId)
    // 응답 유실 복구(자기 잡)는 따로 센다 — 잦으면 claim 응답 지연(공유 DB 커밋) 또는 인스턴스 id 충돌 신호(REV-033 M1 권고 c).
    if (orphans.selfReclaimed) console.warn(`[speech] 분석 잡 응답 유실 복구 worker=${input.workerId} jobs=${orphans.selfReclaimed}`)
    const aged = orphans.requeued + orphans.failed - orphans.selfReclaimed
    if (aged > 0) console.warn(`[speech] 분석 잡 고아 회수(15분) requeued·failed 합=${aged} (전체 requeued=${orphans.requeued} failed=${orphans.failed})`)
    const ids = await lockClaimable(tx, input, now, scope)
    if (ids.length === 0) return []
    await analysisDb.markRunning(tx, ids, input.workerId, now)
    return analysisDb.claimedRows(tx, ids)
  })
  if (rows.length === 0) return { jobs: [] }
  const modes = await analysisDb.recognitionModes(rows.map((r) => r.userId))
  return {
    jobs: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      utteranceId: r.utteranceId,
      audioPath: r.audioDeletedAt ? null : r.audioPath,
      realtimeText: r.realtimeText,
      recognitionMode: modes.get(r.userId) ?? 'AUTO',
      attempts: r.attempts,
    })),
  }
}

export interface FailureResult {
  ok: true
  jobStatus: 'QUEUED' | 'FAILED'
}

const jobNotFound = () => new ApiError('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')

/**
 * #140 — 성공은 부르지 않는다(#138 이 같은 트랜잭션에서 DONE).
 * claim 세대(`attempts` — claim 때만 +1, 회수해도 그대로라 세대마다 다르다)까지 맞아야 받는다: 인스턴스 id 가 겹쳐 self-reclaim 이 쥔 잡을 되돌리고
 * 다시 나눠 준 경우에도 앞 세대의 늦은 실패 보고가 지금 세대를 FAILED 로 뒤집어 그 세대의 #138 결과를 409 로 버리게 하지 못한다(REV-033 권고 a).
 */
export async function reportJobFailure(jobId: string, input: FailureInput, now = new Date()): Promise<FailureResult> {
  const scope = await jobUserScope()
  return analysisDb.transaction(async (tx) => {
    const job = await analysisDb.lockJob(tx, jobId)
    if (!job || !inScope(scope, job.userId)) throw jobNotFound()
    const staleGeneration = input.attempt !== undefined && job.attempts !== input.attempt
    if (job.status !== 'RUNNING' || job.lockedBy !== input.workerId || staleGeneration) throw new ApiError('CONFLICT', '이미 회수됐거나 다른 워커가 가진 잡입니다.', { reason: 'STALE_CLAIM' })
    const next = nextAfterFailure({ attempts: job.attempts, maxAttempts: job.maxAttempts, retryable: input.retryable, error: input.error }, now.getTime())
    if (next.status === 'QUEUED') {
      await analysisDb.requeueJob(tx, job.id, next.runAfter, input.error)
      return { ok: true, jobStatus: 'QUEUED' } as const
    }
    await analysisDb.failJob(tx, job, input.error, now)
    return { ok: true, jobStatus: 'FAILED' } as const
  })
}
