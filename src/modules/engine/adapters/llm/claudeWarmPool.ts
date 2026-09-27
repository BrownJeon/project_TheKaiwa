/**
 * 예열 CLI 프로세스 풀(task-007 K2-1) — `claude --print --input-format stream-json` 을 **미리 띄워 두고** 턴이 오면
 * user 메시지 1줄을 써 넣는다. 실측(2026-09-28, CLI 2.1.222, haiku): 보낸 뒤 첫 텍스트 delta cold 1.35~1.56s → 예열 0.60~0.71s.
 *
 * 규칙(Leader K2-1):
 *  - 키 = (CLI 경로·cwd·argv 전체) 해시 — argv 에 model·시스템 프롬프트(페르소나)·플래그가 다 들어 있다. 학습자 데이터는 argv 가 아니라
 *    stdin 메시지로만 가므로 대기 프로세스에는 사용자 정보가 없다.
 *  - 키마다 대기 1개, 전체 대기 상한(기본 2, connection `runtime.prewarmMaxIdle`), 유휴 TTL(기본 10분, `runtime.prewarmIdleTtlSec`).
 *  - **프로세스당 1요청**: 꺼낸 프로세스에는 메시지 1줄을 쓰고 stdin 을 닫는다 — 세션이 이어지지 않으므로 다른 사용자 프롬프트가 섞일 수 없다.
 *  - 대기 중 죽은 프로세스는 버린다(시작 직후 죽으면 30초간 새로 띄우지 않는다 — 인증 깨짐 등으로 spawn 폭주를 막는다).
 *  - 수명: 서버 `exit`·SIGTERM·SIGINT 에 모두 죽인다. 부모가 SIGKILL 로 죽어도 stdin 파이프가 닫혀 CLI 가 스스로 끝난다
 *    (실측: 메시지 없이 stdin EOF → 0.5초 안에 exit 0). `detached` 를 쓰지 않는다(같은 프로세스 그룹 — pm2 treekill 대상).
 *  - 대기 중 비용: 실측(`--debug-file`) 대기 동안 부트스트랩·조직 설정·MCP 목록 조회(메타데이터)만 있고 `/v1/messages` 호출 0 —
 *    토큰 비용 0. 같은 조회는 cold spawn 도 매번 한다(쓰이지 않고 TTL 로 버려지는 예열 1개 = 그 조회 1벌이 추가 비용).
 * 상태는 globalThis 에 둔다 — dev 서버 HMR 로 모듈이 다시 평가돼도 풀·훅이 하나다.
 */
import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'

export interface WarmLimits {
  maxIdle: number
  idleTtlMs: number
}

export const DEFAULT_WARM_LIMITS: WarmLimits = { maxIdle: 2, idleTtlMs: 10 * 60_000 }
/** 시작 직후(이 시간 안) 죽은 예열 프로세스는 실패로 보고 잠시 쉰다. */
const EARLY_DEATH_MS = 5_000
const FAILURE_BACKOFF_MS = 30_000

export interface WarmProcess {
  key: string
  proc: ChildProcess
  spawnedAt: number
  /** 꺼내기 전까지 쌓인 출력(보통 비어 있다 — `system/init` 은 첫 메시지 뒤에 나온다). */
  stdout: string
  stderr: string
}

interface Entry extends WarmProcess {
  exited: boolean
  ttl?: NodeJS.Timeout
  detach: () => void
}

interface Wanted {
  spawn: () => ChildProcess
  limits: WarmLimits
  lastWantedAt: number
}

interface PoolState {
  idle: Map<string, Entry>
  wanted: Map<string, Wanted>
  active: Set<ChildProcess>
  lastFailureAt: number
  hooksInstalled: boolean
  shuttingDown: boolean
  stats: { spawned: number; taken: number; expired: number; diedIdle: number; evicted: number }
}

declare global {
  var __kaiwaClaudeWarm: PoolState | undefined
}

const pool: PoolState = (globalThis.__kaiwaClaudeWarm ??= {
  idle: new Map(),
  wanted: new Map(),
  active: new Set(),
  lastFailureAt: 0,
  hooksInstalled: false,
  shuttingDown: false,
  stats: { spawned: 0, taken: 0, expired: 0, diedIdle: 0, evicted: 0 },
})

export function warmKeyOf(cliPath: string, cwd: string, args: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify([cliPath, cwd, args])).digest('hex').slice(0, 32)
}

function killQuietly(proc: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  try {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill(signal)
  } catch {
    // 이미 끝난 프로세스
  }
}

function terminate(proc: ChildProcess): void {
  killQuietly(proc, 'SIGTERM')
  // SIGTERM 을 무시하면 3초 뒤 SIGKILL. 서버가 먼저 끝나면 타이머도 사라지지만 그때는 stdin EOF 로 CLI 가 끝난다.
  setTimeout(() => killQuietly(proc, 'SIGKILL'), 3_000).unref()
}

function removeIdle(e: Entry): void {
  if (pool.idle.get(e.key) === e) pool.idle.delete(e.key)
  clearTimeout(e.ttl)
  e.detach()
}

function killAll(): void {
  for (const e of [...pool.idle.values()]) {
    removeIdle(e)
    killQuietly(e.proc)
  }
  for (const p of pool.active) killQuietly(p)
  pool.active.clear()
}

function installHooks(): void {
  if (pool.hooksInstalled) return
  pool.hooksInstalled = true
  process.once('exit', () => {
    pool.shuttingDown = true
    killAll()
  })
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    const handler = () => {
      pool.shuttingDown = true
      killAll()
      // 우리 핸들러만 있었다면 기본 동작(종료)을 되살린다 — 리스너를 단 것만으로 종료가 막히지 않게.
      if (process.listenerCount(sig) === 1) {
        process.removeListener(sig, handler)
        process.kill(process.pid, sig)
      }
    }
    process.on(sig, handler)
  }
}

function spawnEntry(key: string, w: Wanted): Entry | null {
  let proc: ChildProcess
  try {
    proc = w.spawn()
  } catch {
    pool.lastFailureAt = Date.now()
    return null
  }
  const e: Entry = { key, proc, spawnedAt: Date.now(), stdout: '', stderr: '', exited: false, detach: () => {} }
  const onOut = (d: Buffer) => {
    if (e.stdout.length < 64_000) e.stdout += d.toString('utf8')
  }
  const onErr = (d: Buffer) => {
    if (e.stderr.length < 8_000) e.stderr += d.toString('utf8')
  }
  const onGone = () => {
    e.exited = true
    if (pool.idle.get(key) !== e) return
    removeIdle(e)
    pool.stats.diedIdle++
    if (Date.now() - e.spawnedAt < EARLY_DEATH_MS) pool.lastFailureAt = Date.now()
  }
  proc.stdout?.on('data', onOut)
  proc.stderr?.on('data', onErr)
  proc.on('close', onGone)
  proc.on('error', onGone)
  // stdin 이 먼저 닫히는 경쟁(프로세스 즉시 종료)에서 EPIPE 로 서버가 죽지 않게.
  proc.stdin?.on('error', () => {})
  e.detach = () => {
    proc.stdout?.off('data', onOut)
    proc.stderr?.off('data', onErr)
    proc.off('close', onGone)
    proc.off('error', onGone)
  }
  e.ttl = setTimeout(() => {
    if (pool.idle.get(key) !== e) return
    removeIdle(e)
    pool.stats.expired++
    terminate(proc)
  }, w.limits.idleTtlMs)
  e.ttl.unref()
  pool.stats.spawned++
  return e
}

export type PrewarmOutcome = 'EXISTS' | 'SPAWNED' | 'DISABLED' | 'BACKOFF' | 'FAILED' | 'SHUTTING_DOWN'

/**
 * 키에 대기 프로세스를 하나 둔다(이미 있으면 그대로). 상한을 넘으면 가장 오래된 대기 프로세스를 내린다.
 * 명시적 warm 라우트는 없다 — 호출자(engine/llm prewarm)는 TALK 방 진입·푸시투토크 티켓·턴 직후에 부른다.
 */
export function prewarm(key: string, spawn: () => ChildProcess, limits: WarmLimits): PrewarmOutcome {
  if (pool.shuttingDown) return 'SHUTTING_DOWN'
  installHooks()
  pool.wanted.set(key, { spawn, limits, lastWantedAt: Date.now() })
  if (limits.maxIdle <= 0) return 'DISABLED'
  const cur = pool.idle.get(key)
  if (cur && !cur.exited) return 'EXISTS'
  if (Date.now() - pool.lastFailureAt < FAILURE_BACKOFF_MS) return 'BACKOFF'
  while (pool.idle.size >= limits.maxIdle) {
    const oldest = [...pool.idle.values()].sort((a, b) => a.spawnedAt - b.spawnedAt)[0]
    if (!oldest) break
    removeIdle(oldest)
    pool.stats.evicted++
    terminate(oldest.proc)
  }
  const e = spawnEntry(key, pool.wanted.get(key)!)
  if (!e) return 'FAILED'
  pool.idle.set(key, e)
  return 'SPAWNED'
}

/** 대기 프로세스를 꺼낸다(풀에서 빠진다). 죽었으면 null. 꺼낸 뒤 **같은 틱에** 호출자가 리스너를 붙여야 이벤트를 놓치지 않는다. */
export function take(key: string): WarmProcess | null {
  const e = pool.idle.get(key)
  if (!e) return null
  removeIdle(e)
  if (e.exited || e.proc.exitCode !== null || e.proc.signalCode !== null || !e.proc.stdin || e.proc.stdin.destroyed) {
    terminate(e.proc)
    return null
  }
  pool.stats.taken++
  const w = pool.wanted.get(key)
  if (w) w.lastWantedAt = Date.now()
  return { key: e.key, proc: e.proc, spawnedAt: e.spawnedAt, stdout: e.stdout, stderr: e.stderr }
}

/** 이 키를 최근(TTL 안) 원했는가 — 턴이 끝난 뒤 다시 채울지 정할 때 쓴다. */
export function isWanted(key: string): boolean {
  const w = pool.wanted.get(key)
  if (!w) return false
  if (Date.now() - w.lastWantedAt > w.limits.idleTtlMs) {
    pool.wanted.delete(key)
    return false
  }
  return true
}

/** 요청이 끝난 뒤 — 원하던 키면 다음 턴용으로 다시 띄운다(프로세스당 1요청이므로 쓰고 나면 비어 있다). */
export function replenish(key: string): PrewarmOutcome | null {
  if (!isWanted(key)) return null
  const w = pool.wanted.get(key)!
  return prewarm(key, w.spawn, w.limits)
}

/** 실행 중인 자식(예열에서 꺼낸 것·cold 모두)도 서버 종료 때 함께 죽이도록 등록한다. */
export function trackActive(proc: ChildProcess): () => void {
  installHooks()
  pool.active.add(proc)
  return () => pool.active.delete(proc)
}

export interface WarmPoolSnapshot {
  idle: number
  wantedKeys: number
  active: number
  pids: number[]
  stats: PoolState['stats']
}

export function warmPoolSnapshot(): WarmPoolSnapshot {
  return {
    idle: pool.idle.size,
    wantedKeys: pool.wanted.size,
    active: pool.active.size,
    pids: [...pool.idle.values()].map((e) => e.proc.pid ?? -1),
    stats: { ...pool.stats },
  }
}

/** 테스트·종료용 — 대기 프로세스를 모두 내린다. */
export function drainWarmPool(): void {
  for (const e of [...pool.idle.values()]) {
    removeIdle(e)
    terminate(e.proc)
  }
  pool.wanted.clear()
  pool.lastFailureAt = 0
}
