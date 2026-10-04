/**
 * 읽기 분석(서버, task-026 S1) — 문장별 형태소(표기·한자 묶음별 히라가나·발음 가나·구절 경계)를 엔진 파사드 `text.annotate` 로 구한다.
 * DB 에 저장하지 않는다(표시 시점 계산 — 결정적·문장당 1ms 미만이라 옛 메시지·레슨에도 그대로 적용, Leader 수용 2026-10-04).
 *
 * - 캐시: 프로세스 메모리 LRU(키 = sha256(문장), 5,000건·6시간 + 총량 상한 `READING_CACHE_LIMITS.units`). 분석 결과만 담고 실패는 담지 않는다.
 *   총량 = 조각 수 + 루비 조각 수. 건수만 막으면 400자 문장 5,000건이 힙 ~509MB(REV-086 M2)로 pm2 `max_memory_restart 512M` 에 닿는다 —
 *   상한 120,000 단위(실측 단위당 힙 약 0.1KB → 꽉 차도 약 11MB, 문자열 길이는 건수 5,000 × 문장 400자가 따로 묶는다)를 넘으면 오래 안 쓴 것부터 뺀다.
 * - degrade: 분석기 불가(연결 실패·시간 초과·설정·응답 이상)면 오류가 아니라 해당 칸 null + `available=false` — 화면은 후리가나·한글 자리를 비운다.
 *   실패 직후 30초는 다시 부르지 않는다(화면마다 시간 초과를 기다리지 않게).
 * - 동시 실행 상한(REV-089): 프로세스 전역 `MAX_INFLIGHT`·사용자별 `OWNER_MAX_INFLIGHT` — 넘으면 분석기를 부르지 않고 degrade.
 *   상한 초과와 분석기 `BUSY` 는 실패가 아니라 "바쁨"이라 **쉬지 않는다** — 쉼은 전역이라, 한 사용자의 몰아치기가 모든 사용자의 읽기를 30초씩 숨기게 된다.
 * - 로그는 건수·글자 수·실패 종류만(문장 본문 없음).
 */
import { createHash } from 'node:crypto'
import { text as textEngine } from '@/modules/engine'
import { READING_MAX_CHARS, READING_MAX_TEXTS, type ReadingSegment } from './client'

export type { ReadingSegment, ReadingBoundary, RubyPiece } from './client'
export { READING_MAX_CHARS, READING_MAX_TEXTS } from './client'

const CACHE_MAX = 5_000
const CACHE_MAX_UNITS = 120_000
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const TIMEOUT_MS = 3_000
const COOLDOWN_MS = 30_000
// 분석기 쪽 대기 상한(6)보다 작게 — 앱이 분석기 대기열을 다 채우지 않는다.
const MAX_INFLIGHT = 4
const OWNER_MAX_INFLIGHT = 2

const cache = new Map<string, { at: number; segments: ReadingSegment[]; units: number }>()
let cacheUnits = 0
let cooldownUntil = 0
let inflight = 0
const ownerInflight = new Map<string, number>()

export const READING_CACHE_LIMITS = { entries: CACHE_MAX, units: CACHE_MAX_UNITS } as const

export interface ReadingResult {
  /** 입력 순서대로 — 분석 못 한 칸은 null. */
  items: Array<ReadingSegment[] | null>
  /** 분석기를 쓸 수 없어 비운 칸이 있으면 false(화면은 숨기고, 나중에 다시 요청해도 된다). */
  available: boolean
}

function keyOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('base64url')
}

function unitsOf(segments: readonly ReadingSegment[]): number {
  let u = 0
  for (const s of segments) u += 1 + (s.ruby?.length ?? 0)
  return u
}

function cacheDelete(key: string): void {
  const hit = cache.get(key)
  if (!hit) return
  cache.delete(key)
  cacheUnits -= hit.units
}

function cacheGet(key: string, now: number): ReadingSegment[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (now - hit.at > CACHE_TTL_MS) {
    cacheDelete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, hit)
  return hit.segments
}

function cacheSet(key: string, segments: ReadingSegment[], now: number): void {
  cacheDelete(key)
  const units = unitsOf(segments)
  cache.set(key, { at: now, segments, units })
  cacheUnits += units
  while (cache.size > CACHE_MAX || cacheUnits > CACHE_MAX_UNITS) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cacheDelete(oldest)
  }
}

/** 테스트 전용 — 캐시·쉬는 시간 초기화. */
export function resetReadingCache(): void {
  cache.clear()
  cacheUnits = 0
  cooldownUntil = 0
}

/** 테스트·계측 전용 — 진행 중 분석 호출 수(전역)·진행 중인 사용자 수. */
export function readingInflightStats(): { global: number; owners: number } {
  return { global: inflight, owners: ownerInflight.size }
}

/** 테스트·계측 전용 — 현재 캐시 건수·총량. */
export function readingCacheStats(): { entries: number; units: number } {
  return { entries: cache.size, units: cacheUnits }
}

/**
 * 문장 배열(≤64, 각 ≤400자 — 라우트가 먼저 검사)의 읽기. 빈 문장은 빈 배열.
 * `annotate` 를 주입할 수 있다(테스트). `ownerKey` = 사용자별 동시 상한 키(라우트가 세션 사용자 id 를 넘긴다).
 */
export async function annotateReadings(
  texts: readonly string[],
  deps: { annotate?: typeof textEngine.annotate; now?: () => number } = {},
  ownerKey?: string,
): Promise<ReadingResult> {
  if (texts.length > READING_MAX_TEXTS || texts.some((t) => t.length > READING_MAX_CHARS)) throw new RangeError('READING_LIMIT')
  const annotate = deps.annotate ?? textEngine.annotate
  const now = (deps.now ?? Date.now)()
  const items: Array<ReadingSegment[] | null> = texts.map(() => null)
  const missing = new Map<string, { text: string; idx: number[] }>()
  texts.forEach((t, i) => {
    if (t.length === 0) {
      items[i] = []
      return
    }
    const key = keyOf(t)
    const hit = cacheGet(key, now)
    if (hit) items[i] = hit
    else {
      const m = missing.get(key)
      if (m) m.idx.push(i)
      else missing.set(key, { text: t, idx: [i] })
    }
  })
  if (missing.size === 0) return { items, available: true }
  if (now < cooldownUntil) return { items, available: false }
  const batch = [...missing.entries()]
  const ownerCount = ownerKey === undefined ? 0 : (ownerInflight.get(ownerKey) ?? 0)
  if (inflight >= MAX_INFLIGHT || ownerCount >= OWNER_MAX_INFLIGHT) {
    console.warn('[reading] 동시 분석 상한 — 빈 결과로 대체:', inflight >= MAX_INFLIGHT ? 'global' : 'owner', `n=${batch.length}`)
    return { items, available: false }
  }
  inflight++
  if (ownerKey !== undefined) ownerInflight.set(ownerKey, ownerCount + 1)
  try {
    const result = await annotate(
      batch.map(([, m]) => m.text),
      { timeoutMs: TIMEOUT_MS },
    )
    batch.forEach(([key, m], n) => {
      const segs = result[n]
      if (!segs) return
      cacheSet(key, segs, now)
      for (const i of m.idx) items[i] = segs
    })
    return { items, available: true }
  } catch (e) {
    if (textEngine.isTextAnalyzerError(e) && e.kind === 'BUSY') {
      console.warn('[reading] 분석기 바쁨 — 빈 결과로 대체(쉬지 않음):', `busy n=${batch.length}`)
      return { items, available: false }
    }
    const kind = textEngine.isTextAnalyzerError(e) ? `${e.kind}:${e.code}` : e instanceof Error ? e.name : 'unknown'
    console.warn('[reading] 읽기 분석 불가 — 빈 결과로 대체:', kind, `n=${batch.length}`)
    cooldownUntil = now + COOLDOWN_MS
    return { items, available: false }
  } finally {
    inflight--
    if (ownerKey !== undefined) {
      const left = (ownerInflight.get(ownerKey) ?? 1) - 1
      if (left <= 0) ownerInflight.delete(ownerKey)
      else ownerInflight.set(ownerKey, left)
    }
  }
}
