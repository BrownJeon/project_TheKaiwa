/**
 * 방금 합성한 오디오의 프로세스 메모리 보관(task-007 — MISS 청크 #24 404 경합 수정).
 *
 * 원인: 합성 결과는 캐시 저장(파일 쓰기 + `TtsCache` 행 커밋)을 **기다리지 않고** 돌려준다(첫 음성을 저장 I/O 만큼 늦추지 않기 위해 —
 * singleFlight). 그래서 턴의 SSE `audio` 이벤트가 행 커밋보다 먼저 나가고, 클라가 곧바로 #24 를 부르면 행이 없어 404 였다
 * (NAS 커밋 fsync 100~500ms + 파일 쓰기 — 실측 0.6~1.4s 동안 404). 이벤트를 커밋 뒤로 미루면 TTFA 가 그만큼 늘어난다.
 *
 * 그래서 SYNTH 결과를 여기 잠깐(기본 60초) 두고, #24 는 **서명 검증을 통과한 뒤** 이 보관소를 먼저 본다 — 검증 전에는 보지 않으므로
 * 존재 오라클이 생기지 않는다. 키는 12요소 캐시 키(40hex)라 경로를 만들지 않는다.
 *
 * - 상한: 항목 64개·합계 16MB(넘으면 오래된 것부터 버림). 회화 문장 wav 는 보통 100~300KB.
 * - globalThis 에 둔다: 턴 라우트와 #24 라우트가 서로 다른 번들이어도 한 프로세스에서 같은 보관소를 본다(dev·prod 공통).
 * - blue/green 전환 순간 #24 가 다른 인스턴스로 가면 그쪽 보관소에는 없다 → 캐시 저장이 끝나기 전(≈1s)이면 404 — 클라 재시도
 *   (`components/talk/chunkFetch`)가 덮는다. 전환은 순간이고 창이 1초 안팎이라 수용.
 */
export interface RecentAudio {
  audio: Buffer
  durationMs: number | null
  modelVersion: string | null
  dictionaryVersion: number | null
}

interface Entry extends RecentAudio {
  expiresAt: number
}

export const RECENT_AUDIO_TTL_MS = 60_000
export const RECENT_AUDIO_MAX_ENTRIES = 64
export const RECENT_AUDIO_MAX_BYTES = 16 * 1024 * 1024

declare global {
  var __kaiwaRecentTtsAudio: { map: Map<string, Entry>; bytes: number } | undefined
}

const store: { map: Map<string, Entry>; bytes: number } = (globalThis.__kaiwaRecentTtsAudio ??= { map: new Map(), bytes: 0 })

function drop(key: string): void {
  const e = store.map.get(key)
  if (!e) return
  store.map.delete(key)
  store.bytes -= e.audio.length
}

function sweep(now: number): void {
  for (const [k, e] of store.map) if (e.expiresAt <= now) drop(k)
}

export function rememberRecentAudio(key: string, value: RecentAudio, now = Date.now(), ttlMs = RECENT_AUDIO_TTL_MS): void {
  if (value.audio.length > RECENT_AUDIO_MAX_BYTES) return
  sweep(now)
  drop(key)
  while (store.map.size >= RECENT_AUDIO_MAX_ENTRIES || store.bytes + value.audio.length > RECENT_AUDIO_MAX_BYTES) {
    const oldest = store.map.keys().next().value as string | undefined
    if (oldest === undefined) break
    drop(oldest)
  }
  store.map.set(key, { ...value, expiresAt: now + ttlMs })
  store.bytes += value.audio.length
}

export function recallRecentAudio(key: string, now = Date.now()): RecentAudio | null {
  const e = store.map.get(key)
  if (!e) return null
  if (e.expiresAt <= now) {
    drop(key)
    return null
  }
  return { audio: e.audio, durationMs: e.durationMs, modelVersion: e.modelVersion, dictionaryVersion: e.dictionaryVersion }
}

/** 테스트·진단용. */
export function recentAudioStats(): { entries: number; bytes: number } {
  return { entries: store.map.size, bytes: store.bytes }
}

export function clearRecentAudio(): void {
  store.map.clear()
  store.bytes = 0
}
