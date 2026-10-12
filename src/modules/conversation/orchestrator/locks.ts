/**
 * 사용자당 턴 1 — 메모리 락(이 프로세스) 부분. 프로세스 사이(blue/green 두 인스턴스) 직렬화는 수락 트랜잭션의 사용자 행
 * `FOR UPDATE` + "사용자의 PENDING 강사 메시지" 확인이 맡는다(orchestrator/index.ts).
 *
 * stale PENDING(task-006 범위결정 6): **180초보다 오래되고 이 프로세스가 돌리고 있지 않은** PENDING 만 죽은 턴으로 본다.
 * 턴의 LLM 예산은 TALK 12s·CHAT 20s, ASK 는 120s(JSON 재시도가 붙으면 두 배까지)라 서버 전체 예산 170s(`ask.ts` `ASK_TURN_BUDGET_MS`)에서
 * 끊는다 — 살아 있는 턴이 180초를 넘을 수 없다. 그래서 다른 인스턴스의 진행 중
 * 턴을 시간 조건만으로 건드리지 않는다. 최종 저장은 `(status=PENDING, createdAt=pendingSince)` 조건부라, 만에 하나 늦게 끝난
 * 턴이 이미 FAILED/재실행된 행을 덮지 못한다.
 */

export const STALE_PENDING_MS = 180_000

export interface TurnLock {
  userId: string
  chatId: string
  assistantMessageId: string | null
  startedAt: number
}

declare global {
  var __kaiwaTurnLocks: Map<string, TurnLock> | undefined
}
/** userId → 진행 중 턴. 라우트 번들이 달라도 한 프로세스에 하나(globalThis). */
const locks: Map<string, TurnLock> = (globalThis.__kaiwaTurnLocks ??= new Map())

/** 잡으면 새 락, 이미 있으면 null(호출자가 409). 동기 함수라 같은 프로세스 안에서 경쟁이 없다. */
export function tryAcquireTurnLock(userId: string, chatId: string): TurnLock | null {
  if (locks.has(userId)) return null
  const lock: TurnLock = { userId, chatId, assistantMessageId: null, startedAt: Date.now() }
  locks.set(userId, lock)
  return lock
}

export function currentTurnLock(userId: string): TurnLock | null {
  return locks.get(userId) ?? null
}

/** 자기 락만 푼다(다른 요청이 새로 잡은 락을 지우지 않게). */
export function releaseTurnLock(lock: TurnLock): void {
  if (locks.get(lock.userId) === lock) locks.delete(lock.userId)
}

export function isMessageLocallyRunning(messageId: string): boolean {
  for (const l of locks.values()) if (l.assistantMessageId === messageId) return true
  return false
}

export function locallyRunningMessageIds(): string[] {
  const out: string[] = []
  for (const l of locks.values()) if (l.assistantMessageId) out.push(l.assistantMessageId)
  return out
}

/** 순수 판정 — PENDING 강사 메시지가 죽은 턴인가. */
export function isStalePending(createdAt: Date, now: number, locallyRunning: boolean): boolean {
  return !locallyRunning && now - createdAt.getTime() > STALE_PENDING_MS
}
