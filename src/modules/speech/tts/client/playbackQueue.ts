/**
 * 클라 `TtsPlaybackQueue`(speech-platform/16 §6.3, screens §9-3 D) — 턴 SSE `audio` 청크를 **chunkIndex 순으로만** 재생한다.
 *
 *  - 받기는 도착 즉시(동시 2, 낮은 index 먼저), 재생만 순서대로. 다음 index 가 없으면 `waiting`, `FAILED`·받기 실패는 건너뛴다.
 *    `endTurn` 뒤엔 비어 있는 index 도 건너뛰고 끝낸다.
 *  - 청크 사이 쉼 = `pauseBeforeMs`(첫 청크엔 두지 않는다). 쉬는 동안은 `playing` 그대로(상태 줄이 깜빡이지 않게).
 *  - `interrupt` 는 지금 소리만 끊고 그 턴 청크는 계속 받아 두되 **다시 자동재생하지 않는다**(barge-in·멈춤·화면 이탈).
 *  - 자동재생이 막히면(`NotAllowedError`) 그 청크에서 `blocked` — 탭 핸들러가 오디오를 깨운 뒤 `resumeBlocked()`.
 *  - 다시 듣기(`playParts`)는 앞 소리를 멈춘다. 새 턴의 첫 소리가 준비되면 다시 듣기를 멈추고 턴이 이긴다.
 *
 * DOM·오디오 API 를 모른다 — 받기·재생·시계는 주입받는다(하위 층이 화면 코드를 import 하지 않게). URL·오디오를 로그에 남기지 않는다.
 */

export interface PlaybackHandle {
  stop(): void
  ended: Promise<void>
}

export interface PlaybackSignal {
  ok: boolean
  cacheHit?: boolean
  /** HTTP status(네트워크 실패 0). */
  status?: number
}

export type PlaybackSource = 'turn' | 'replay' | 'mine'
export type PlaybackPhase = 'idle' | 'waiting' | 'playing' | 'blocked'
export type InterruptReason = 'BARGE_IN' | 'USER_STOP' | 'HIDDEN' | 'NEW_TURN'

export interface PlaybackDeps {
  fetchAudio(url: string, signal: AbortSignal): Promise<ArrayBuffer>
  play(buf: ArrayBuffer): Promise<PlaybackHandle>
  /** 청크 받기 실패 → 표시등 신호. */
  onSignal?(s: PlaybackSignal): void
  /** 다시 듣기 조각을 받거나 재생하지 못했다(받기 오류는 그대로, 재생 실패는 `'decode'`). */
  onPartError?(source: PlaybackSource, messageId: string, error: unknown): void
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface PlaybackSnapshot {
  phase: PlaybackPhase
  source: PlaybackSource | null
  messageId: string | null
  /** 재생 중인 청크(턴)·조각(다시 듣기) 번호 — 문장 강조용. */
  chunkIndex: number | null
}

export interface ChunkInput {
  chunkIndex: number
  url?: string | null
  status: 'OK' | 'FAILED'
  last: boolean
  pauseBeforeMs?: number
}

export interface TurnTimings {
  /** 첫 `audio` 이벤트를 받은 시각 */
  firstAudioEventAt?: number
  /** 첫 청크가 실제로 소리 나기 시작한 시각 */
  firstPlayAt?: number
  /** 첫 재생이 자동재생이었는가(차단 뒤 탭·barge-in 이 먼저면 false) */
  autoplayed: boolean
}

export interface TtsPlaybackQueue {
  startTurn(messageId: string): void
  push(messageId: string, chunk: ChunkInput): void
  endTurn(messageId: string): void
  abortTurn(messageId: string): void
  interrupt(reason: InterruptReason): void
  playParts(source: PlaybackSource, messageId: string, parts: Array<(signal: AbortSignal) => Promise<ArrayBuffer>>): void
  resumeBlocked(): void
  buffersOf(messageId: string): ArrayBuffer[] | null
  timingsOf(messageId: string): TurnTimings | null
  subscribe(fn: () => void): () => void
  getSnapshot(): PlaybackSnapshot
  /** 소리·받기를 모두 멈추고 보관본을 비운다. 인스턴스는 계속 쓸 수 있다(StrictMode 재마운트). */
  dispose(): void
}

/** 서명 URL(#24)만 받는다 — 서버 응답을 그대로 fetch 대상으로 쓰지 않는다(§9-11 ⑪). */
export const AUDIO_URL_PREFIX = '/api/v1/speech/tts/'
export const FETCH_CONCURRENCY = 2
export const RETAIN_MESSAGES = 20
export const RETAIN_BYTES = 8 * 1024 * 1024
const TIMINGS_KEPT = 8

export const IDLE_SNAPSHOT: PlaybackSnapshot = { phase: 'idle', source: null, messageId: null, chunkIndex: null }

type SlotState = 'pending' | 'fetching' | 'ready' | 'failed'

interface Slot {
  index: number
  url: string | null
  failed: boolean
  pauseBeforeMs: number
  state: SlotState
  buf: ArrayBuffer | null
  ac: AbortController | null
}

interface Turn {
  messageId: string
  slots: Map<number, Slot>
  lastIndex: number | null
  ended: boolean
  aborted: boolean
  /** false = interrupt 뒤 — 받기는 계속, 자동재생 안 함 */
  autoplay: boolean
  /** false = 화면 이탈 — 더 받지 않는다 */
  fetching: boolean
  next: number
  timings: TurnTimings
}

interface Replay {
  source: PlaybackSource
  messageId: string
  parts: Array<(signal: AbortSignal) => Promise<ArrayBuffer>>
  loaded: Array<Promise<ArrayBuffer> | undefined>
  idx: number
  ac: AbortController
}

interface Current {
  token: number
  source: PlaybackSource
  messageId: string
  index: number
  handle: PlaybackHandle | null
}

interface Blocked {
  source: PlaybackSource
  messageId: string
  index: number
  buf: ArrayBuffer
}

function isNotAllowed(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'NotAllowedError'
}

function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError'
}

function statusOf(e: unknown): number {
  const s = typeof e === 'object' && e !== null ? (e as { status?: unknown }).status : undefined
  return typeof s === 'number' ? s : 0
}

export function createTtsPlaybackQueue(deps: PlaybackDeps): TtsPlaybackQueue {
  const listeners = new Set<() => void>()
  let snapshot: PlaybackSnapshot = IDLE_SNAPSHOT
  let turn: Turn | null = null
  let replay: Replay | null = null
  let current: Current | null = null
  let blocked: Blocked | null = null
  let waiting: { source: PlaybackSource; messageId: string } | null = null
  let gapTimer: unknown = null
  let gapFor: { messageId: string; index: number } | null = null
  let tokenSeq = 0
  let activeFetches = 0
  /** 다시 듣기 보관본 — messageId → index → wav (Map 삽입 순서 = LRU) */
  const retained = new Map<string, { bufs: Map<number, ArrayBuffer>; count: number | null; complete: boolean; bytes: number }>()
  let retainedBytes = 0
  const timings = new Map<string, TurnTimings>()

  function computeSnapshot(): PlaybackSnapshot {
    if (blocked) return { phase: 'blocked', source: blocked.source, messageId: blocked.messageId, chunkIndex: blocked.index }
    if (current) return { phase: 'playing', source: current.source, messageId: current.messageId, chunkIndex: current.handle ? current.index : null }
    if (gapFor && turn && gapFor.messageId === turn.messageId) return { phase: 'playing', source: 'turn', messageId: gapFor.messageId, chunkIndex: gapFor.index }
    if (waiting) return { phase: 'waiting', source: waiting.source, messageId: waiting.messageId, chunkIndex: null }
    return IDLE_SNAPSHOT
  }

  function emit() {
    const next = computeSnapshot()
    if (next.phase === snapshot.phase && next.source === snapshot.source && next.messageId === snapshot.messageId && next.chunkIndex === snapshot.chunkIndex) return
    snapshot = next
    for (const l of [...listeners]) {
      try {
        l()
      } catch {
        // 구독자 오류가 재생을 멈추지 않게
      }
    }
  }

  /* ── 보관본(LRU) ─────────────────────────────────────────────── */

  function retain(messageId: string, index: number, buf: ArrayBuffer) {
    let r = retained.get(messageId)
    if (r) retained.delete(messageId)
    else r = { bufs: new Map(), count: null, complete: false, bytes: 0 }
    retained.set(messageId, r)
    if (!r.bufs.has(index)) {
      r.bufs.set(index, buf)
      r.bytes += buf.byteLength
      retainedBytes += buf.byteLength
    }
    evict(messageId)
  }

  function forget(messageId: string) {
    const r = retained.get(messageId)
    if (!r) return
    retainedBytes -= r.bytes
    retained.delete(messageId)
  }

  function evict(keep: string) {
    for (const id of retained.keys()) {
      if (retained.size <= RETAIN_MESSAGES && retainedBytes <= RETAIN_BYTES) return
      if (id === keep) continue
      forget(id)
    }
  }

  function markComplete(t: Turn) {
    const r = retained.get(t.messageId)
    if (!r) return
    const max = Math.max(-1, ...t.slots.keys())
    const count = t.lastIndex !== null ? t.lastIndex + 1 : max + 1
    r.count = count
    r.complete = count > 0 && Array.from({ length: count }, (_, i) => i).every((i) => r.bufs.has(i))
  }

  /* ── 받기 ─────────────────────────────────────────────────────── */

  function pumpFetches() {
    const t = turn
    if (!t || t.aborted || !t.fetching) return
    while (activeFetches < FETCH_CONCURRENCY) {
      let pick: Slot | null = null
      for (const s of t.slots.values()) if (s.state === 'pending' && (!pick || s.index < pick.index)) pick = s
      if (!pick) return
      startFetch(t, pick)
    }
  }

  function startFetch(t: Turn, s: Slot) {
    const url = s.url
    if (!url) {
      s.state = 'failed'
      return
    }
    const ac = new AbortController()
    s.ac = ac
    s.state = 'fetching'
    activeFetches++
    deps.fetchAudio(url, ac.signal).then(
      (buf) => {
        activeFetches--
        s.ac = null
        if (ac.signal.aborted || turn !== t || t.aborted) return pumpFetches()
        s.buf = buf
        s.state = 'ready'
        retain(t.messageId, s.index, buf)
        if (t.ended) markComplete(t)
        pumpFetches()
        pump()
      },
      (e: unknown) => {
        activeFetches--
        s.ac = null
        if (ac.signal.aborted || isAbortError(e)) {
          if (s.state === 'fetching') s.state = 'failed'
          return pumpFetches()
        }
        s.state = 'failed'
        if (turn === t && !t.aborted) deps.onSignal?.({ ok: false, status: statusOf(e) })
        pumpFetches()
        pump()
      },
    )
  }

  function abortFetches(t: Turn) {
    for (const s of t.slots.values()) {
      if (s.ac) s.ac.abort()
      s.ac = null
      if (s.state === 'fetching' || s.state === 'pending') s.state = 'failed'
    }
  }

  /* ── 재생 ─────────────────────────────────────────────────────── */

  function clearGap() {
    if (gapTimer !== null) deps.clearTimer(gapTimer)
    gapTimer = null
    gapFor = null
  }

  function stopCurrent() {
    const c = current
    current = null
    if (c?.handle) c.handle.stop()
    clearGap()
  }

  function cancelReplay() {
    if (!replay) return
    replay.ac.abort()
    replay = null
    if (waiting && waiting.source !== 'turn') waiting = null
  }

  /** 턴 재생 진행. 멈춰 있거나 다른 소리가 나는 중이면 아무것도 하지 않는다. */
  function pump() {
    const t = turn
    if (!t || t.aborted || !t.autoplay || blocked || gapTimer !== null) return emit()
    if (current && current.source === 'turn') return emit()
    for (;;) {
      if (t.lastIndex !== null && t.next > t.lastIndex) return finishTurn(t)
      const s = t.slots.get(t.next)
      if (!s) {
        const max = Math.max(-1, ...t.slots.keys())
        if (t.ended && t.next > max) return finishTurn(t)
        if (t.ended) {
          t.next++
          continue
        }
        if (!current && !replay) waiting = { source: 'turn', messageId: t.messageId }
        return emit()
      }
      if (s.failed || s.state === 'failed') {
        t.next++
        continue
      }
      if (s.state !== 'ready' || !s.buf) {
        if (!current && !replay) waiting = { source: 'turn', messageId: t.messageId }
        return emit()
      }
      // 턴 소리가 준비됐다 — 다시 듣기를 멈추고 턴이 이긴다.
      if (current || replay) {
        stopCurrent()
        cancelReplay()
      }
      const pause = t.next > 0 && t.timings.firstPlayAt !== undefined ? Math.max(0, Math.round(s.pauseBeforeMs)) : 0
      if (pause > 0) {
        gapFor = { messageId: t.messageId, index: t.next - 1 }
        waiting = null
        gapTimer = deps.setTimer(() => {
          gapTimer = null
          gapFor = null
          if (turn === t && t.autoplay && !t.aborted) startTurnChunk(t, s)
          else emit()
        }, pause)
        return emit()
      }
      startTurnChunk(t, s)
      return
    }
  }

  function finishTurn(t: Turn) {
    if (turn === t && waiting?.source === 'turn') waiting = null
    emit()
  }

  function startTurnChunk(t: Turn, s: Slot) {
    const buf = s.buf
    if (!buf) return pump()
    const token = ++tokenSeq
    current = { token, source: 'turn', messageId: t.messageId, index: s.index, handle: null }
    waiting = { source: 'turn', messageId: t.messageId }
    emit()
    deps.play(buf).then(
      (h) => {
        if (!current || current.token !== token) {
          h.stop()
          return
        }
        current.handle = h
        waiting = null
        if (t.timings.firstPlayAt === undefined) {
          t.timings.firstPlayAt = deps.now()
          t.timings.autoplayed = true
        }
        emit()
        void h.ended.then(() => {
          if (!current || current.token !== token) return
          current = null
          t.next = s.index + 1
          pump()
        })
      },
      (e: unknown) => {
        if (!current || current.token !== token) return
        current = null
        waiting = null
        if (isNotAllowed(e)) {
          blocked = { source: 'turn', messageId: t.messageId, index: s.index, buf }
          return emit()
        }
        // 디코드 실패 — 그 청크만 건너뛴다.
        t.next = s.index + 1
        pump()
      },
    )
  }

  function playReplayPart(r: Replay) {
    if (replay !== r) return
    if (r.idx >= r.parts.length) {
      replay = null
      waiting = null
      return emit()
    }
    const i = r.idx
    const load = (k: number) => {
      if (k >= r.parts.length || r.loaded[k]) return
      const p = r.parts[k](r.ac.signal)
      p.catch(() => undefined)
      r.loaded[k] = p
    }
    load(i)
    load(i + 1)
    waiting = { source: r.source, messageId: r.messageId }
    emit()
    ;(r.loaded[i] as Promise<ArrayBuffer>).then(
      (buf) => {
        if (replay !== r) return
        const token = ++tokenSeq
        current = { token, source: r.source, messageId: r.messageId, index: i, handle: null }
        deps.play(buf).then(
          (h) => {
            if (!current || current.token !== token || replay !== r) {
              h.stop()
              return
            }
            current.handle = h
            waiting = null
            emit()
            void h.ended.then(() => {
              if (!current || current.token !== token) return
              current = null
              r.idx = i + 1
              playReplayPart(r)
            })
          },
          (e: unknown) => {
            if (!current || current.token !== token) return
            current = null
            waiting = null
            if (isNotAllowed(e)) {
              blocked = { source: r.source, messageId: r.messageId, index: i, buf }
              return emit()
            }
            replay = null
            emit()
            deps.onPartError?.(r.source, r.messageId, 'decode')
          },
        )
      },
      (e: unknown) => {
        if (replay !== r || r.ac.signal.aborted || isAbortError(e)) return
        replay = null
        waiting = null
        emit()
        deps.onPartError?.(r.source, r.messageId, e)
      },
    )
  }

  function saveTimings(t: Turn) {
    timings.delete(t.messageId)
    timings.set(t.messageId, t.timings)
    while (timings.size > TIMINGS_KEPT) {
      const first = timings.keys().next().value
      if (first === undefined) break
      timings.delete(first)
    }
  }

  function activeTurn(messageId: string): Turn | null {
    return turn && turn.messageId === messageId ? turn : null
  }

  return {
    startTurn(messageId) {
      if (turn) {
        abortFetches(turn)
        turn.aborted = true
      }
      if (current?.source === 'turn') stopCurrent()
      if (blocked?.source === 'turn') blocked = null
      if (waiting?.source === 'turn') waiting = null
      clearGap()
      // 같은 메시지를 다시 받는 경우(다시 받기) — 앞서 받아 둔 조각은 새 청크와 섞이지 않게 버린다.
      forget(messageId)
      turn = { messageId, slots: new Map(), lastIndex: null, ended: false, aborted: false, autoplay: true, fetching: true, next: 0, timings: { autoplayed: false } }
      saveTimings(turn)
      emit()
    },

    push(messageId, c) {
      const t = activeTurn(messageId)
      if (!t || t.aborted) return
      if (!Number.isInteger(c.chunkIndex) || c.chunkIndex < 0 || t.slots.has(c.chunkIndex)) return
      if (t.timings.firstAudioEventAt === undefined) t.timings.firstAudioEventAt = deps.now()
      const url = typeof c.url === 'string' && c.url.startsWith(AUDIO_URL_PREFIX) ? c.url : null
      const failed = c.status !== 'OK' || !url
      t.slots.set(c.chunkIndex, {
        index: c.chunkIndex,
        url,
        failed,
        pauseBeforeMs: typeof c.pauseBeforeMs === 'number' && Number.isFinite(c.pauseBeforeMs) ? c.pauseBeforeMs : 0,
        state: failed ? 'failed' : 'pending',
        buf: null,
        ac: null,
      })
      if (c.last) t.lastIndex = t.lastIndex === null ? c.chunkIndex : Math.min(t.lastIndex, c.chunkIndex)
      pumpFetches()
      pump()
    },

    endTurn(messageId) {
      const t = activeTurn(messageId)
      if (!t) return
      t.ended = true
      markComplete(t)
      pump()
    },

    abortTurn(messageId) {
      const t = activeTurn(messageId)
      if (!t) return
      t.aborted = true
      abortFetches(t)
      if (current?.source === 'turn' && current.messageId === messageId) stopCurrent()
      if (gapFor?.messageId === messageId) clearGap()
      if (blocked?.source === 'turn' && blocked.messageId === messageId) blocked = null
      if (waiting?.source === 'turn') waiting = null
      forget(messageId)
      emit()
    },

    interrupt(reason) {
      if (turn && (reason === 'HIDDEN' || current?.source === 'turn' || gapFor !== null || blocked?.source === 'turn' || turn.timings.firstPlayAt !== undefined)) {
        turn.autoplay = false
      }
      if (turn && reason === 'HIDDEN') {
        turn.fetching = false
        abortFetches(turn)
      }
      if (turn && reason === 'BARGE_IN') turn.autoplay = false
      stopCurrent()
      cancelReplay()
      blocked = null
      waiting = null
      emit()
    },

    playParts(source, messageId, parts) {
      // 다시 듣기가 턴 자동재생을 이긴다 — 이미 소리 나기 시작한 턴은 다시 자동재생하지 않는다(청크는 계속 받아 둔다).
      if (turn && (current?.source === 'turn' || gapFor !== null || blocked?.source === 'turn' || turn.timings.firstPlayAt !== undefined)) turn.autoplay = false
      stopCurrent()
      cancelReplay()
      blocked = null
      waiting = null
      if (parts.length === 0) return emit()
      const r: Replay = { source, messageId, parts, loaded: [], idx: 0, ac: new AbortController() }
      replay = r
      playReplayPart(r)
    },

    resumeBlocked() {
      const b = blocked
      if (!b) return
      blocked = null
      const token = ++tokenSeq
      current = { token, source: b.source, messageId: b.messageId, index: b.index, handle: null }
      emit()
      deps.play(b.buf).then(
        (h) => {
          if (!current || current.token !== token) {
            h.stop()
            return
          }
          current.handle = h
          const t = b.source === 'turn' ? activeTurn(b.messageId) : null
          if (t && t.timings.firstPlayAt === undefined) t.timings.firstPlayAt = deps.now()
          emit()
          void h.ended.then(() => {
            if (!current || current.token !== token) return
            current = null
            if (b.source === 'turn') {
              const tt = activeTurn(b.messageId)
              if (tt) tt.next = b.index + 1
              pump()
            } else if (replay && replay.messageId === b.messageId) {
              replay.idx = b.index + 1
              playReplayPart(replay)
            } else emit()
          })
        },
        (e: unknown) => {
          if (!current || current.token !== token) return
          current = null
          if (isNotAllowed(e)) blocked = b
          emit()
        },
      )
    },

    buffersOf(messageId) {
      const r = retained.get(messageId)
      if (!r || !r.complete || r.count === null) return null
      retained.delete(messageId)
      retained.set(messageId, r)
      return Array.from({ length: r.count }, (_, i) => r.bufs.get(i) as ArrayBuffer)
    },

    timingsOf(messageId) {
      const t = timings.get(messageId)
      return t ? { ...t } : null
    },

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    getSnapshot: () => snapshot,

    dispose() {
      if (turn) {
        turn.aborted = true
        abortFetches(turn)
      }
      turn = null
      stopCurrent()
      cancelReplay()
      blocked = null
      waiting = null
      retained.clear()
      retainedBytes = 0
      emit()
    },
  }
}
