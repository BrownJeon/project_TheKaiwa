/**
 * 기동 시 1회(Next `register`) — 비정상 종료로 남은 턴·잡 정리(task-006 범위결정 4·6).
 *
 * blue/green 전환 중에는 다른 인스턴스가 살아 있으므로 **나이 조건**만 쓴다: PENDING 강사 메시지는 180초, 잡은 종류별 기준보다
 * 오래된 것만 FAILED 로 바꾼다(조회 시에도 같은 기준으로 지연 정리된다). Edge 런타임에서는 아무것도 하지 않는다(Prisma 없음).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  try {
    const [{ sweepStalePending }, { jobs }] = await Promise.all([import('@/modules/conversation'), import('@/modules/infra')])
    const [messages, staleJobs] = await Promise.all([sweepStalePending(), jobs.sweepStaleJobs()])
    if (messages || staleJobs) console.info(`[startup] stale 정리 — 강사 메시지 ${messages}건, 잡 ${staleJobs}건`)
  } catch (e) {
    // DB 가 잠시 안 닿아도 서버 기동은 막지 않는다(조회 시 지연 정리가 같은 일을 한다).
    console.warn('[startup] stale 정리 실패:', e instanceof Error ? e.message : String(e))
  }
}
