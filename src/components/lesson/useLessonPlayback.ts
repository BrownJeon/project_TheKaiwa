'use client'

/**
 * 수업 소리(screens §12-3 C) — 회화방과 같은 **재생 큐 1개**(`createTtsPlaybackQueue` + `fetchChunkAudio` + `playWav`)에 레슨 오디오(#62c)를
 * part 로 넘긴다. 새 재생 경로를 만들지 않는다.
 *  - 구간: 대화 줄 하나 = part 하나. part 안에서 #62c 로 조각 URL 을 받고(미리 전부 합성하지 않고 차례로 — 큐가 다음 줄 하나만 미리 받는다),
 *    조각이 둘 이상이면 WAV 를 이어 붙인다. `snapshot.chunkIndex` = 구간 안 줄 순번 → 줄 강조.
 *  - 예문·모범 답안·내 목소리(#21b): part 하나.
 *  - 끝까지(중단 없이) 들었을 때만 `onComplete`. 멈춤·다른 재생·푸시투토크·화면 가림·오류는 완료가 아니다.
 * 소리는 탭 핸들러가 동기로 `unlockTtsAudio()` 를 부른 뒤 시작한다. 서명 URL·오디오는 저장·로그하지 않는다.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError, apiGetAudio, apiPost } from '@/components/common/api'
import type { SynthesisSignal } from '@/components/speech/ttsStatusStore'
import { playWav, unlockTtsAudio } from '@/components/speech/ttsAudio'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { createTtsPlaybackQueue, IDLE_SNAPSHOT, type InterruptReason, type PlaybackSnapshot, type TtsPlaybackQueue } from '@/modules/speech/tts/client'
import { fetchChunkAudio } from '@/components/talk/chunkFetch'
import type { AudioKind, AudioPace, LessonAudioResult } from '@/types/lesson'
import { LESSON } from './lessonCopy'
import { isLoadingSnapshot } from './logic'
import { concatWav } from './wav'

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export interface LessonPlayback {
  snapshot: PlaybackSnapshot
  queue: TtsPlaybackQueue
  textOnly: boolean
  /** 이 key 가 소리 나는 중(또는 받는 중)인가 */
  active: (key: string) => boolean
  /** 이 key 소리를 아직 받는 중인가(첫 소리 전 — 스피너) */
  loading: (key: string) => boolean
  /** 이 key 재생 중 지금 줄 번호(없으면 null) */
  lineOf: (key: string) => number | null
  blocked: boolean
  playLines: (key: string, lines: { kind: AudioKind; idx: number; pace: AudioPace }[], onComplete?: () => void) => void
  playMine: (key: string, utteranceId: string, onMissing: () => void) => void
  resume: () => void
  stop: (reason?: InterruptReason) => void
}

interface Pending {
  key: string
  n: number
  last: number
  fn: (() => void) | null
  broken: boolean
}

/** 큐 + 콜백 상자(클로저). 화면은 메서드로만 만진다(useTalkPlayback 의 bind 와 같은 방식 — 큐가 옛 클로저를 붙잡지 않게). */
function createController() {
  let cbs: { onToast: (m: string) => void; report: (s: SynthesisSignal) => void } = { onToast: () => undefined, report: () => undefined }
  let pending: Pending | null = null
  let missing: (() => void) | null = null
  const breakPending = () => {
    if (pending) pending.broken = true
  }
  const queue = createTtsPlaybackQueue({
    fetchAudio: (url, signal) => fetchChunkAudio(url, signal, apiGetAudio),
    play: (buf) => playWav(buf),
    onSignal: (s) => cbs.report(s),
    onPartError: (source, _key, err) => {
      breakPending()
      if (source === 'mine') {
        if (err instanceof ApiError && err.status === 404) missing?.()
        return
      }
      const status = err instanceof ApiError ? err.status : 0
      if (status === 422) return
      cbs.onToast(status === 429 ? LESSON.ttsRate : LESSON.ttsError)
    },
    now: perfNow,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  })
  return {
    queue,
    bind: (next: typeof cbs) => {
      cbs = next
    },
    report: (s: SynthesisSignal) => cbs.report(s),
    breakPending,
    expect: (p: Pending) => {
      pending = p
    },
    setMissing: (fn: () => void) => {
      missing = fn
    },
    /** 스냅샷을 보고 완료 여부를 판정한다 — 이 key 의 마지막 줄이 소리 났고 중단 없이 idle 로 돌아왔을 때만 onComplete. */
    observe: (s: PlaybackSnapshot) => {
      const c = pending
      if (!c) return
      if (s.messageId === c.key && s.phase === 'playing' && s.chunkIndex !== null) c.last = Math.max(c.last, s.chunkIndex)
      if (s.phase === 'idle' || s.messageId !== c.key) {
        pending = null
        if (!c.broken && c.last >= c.n - 1) c.fn?.()
      }
    },
  }
}

export function useLessonPlayback(lessonId: string, onToast: (msg: string) => void): LessonPlayback {
  const tts = useTtsRuntimeStatus()
  const [ctl] = useState(createController)
  const { queue } = ctl
  useEffect(() => {
    ctl.bind({ onToast, report: tts.reportSynthesis })
  })
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, () => IDLE_SNAPSHOT)
  useEffect(() => {
    ctl.observe(snapshot)
  }, [ctl, snapshot])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        ctl.breakPending()
        queue.interrupt('HIDDEN')
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      queue.dispose()
    }
  }, [ctl, queue])

  const stop = useCallback(
    (reason: InterruptReason = 'USER_STOP') => {
      ctl.breakPending()
      queue.interrupt(reason)
    },
    [ctl, queue],
  )

  const playLines = useCallback(
    (key: string, lines: { kind: AudioKind; idx: number; pace: AudioPace }[], onComplete?: () => void) => {
      unlockTtsAudio()
      ctl.breakPending()
      const path = `/api/v1/lessons/${encodeURIComponent(lessonId)}/audio`
      const parts = lines.map((l) => async (signal: AbortSignal) => {
        let r: LessonAudioResult
        try {
          r = await apiPost<LessonAudioResult>(path, { kind: l.kind, idx: l.idx, pace: l.pace }, { signal })
        } catch (e) {
          if (e instanceof ApiError) ctl.report({ ok: false, status: e.status })
          throw e
        }
        ctl.report({ ok: true, cacheHit: r.clips.every((c) => c.cached) })
        const bufs = await Promise.all(r.clips.map((c) => fetchChunkAudio(c.url, signal, apiGetAudio)))
        return concatWav(bufs, r.clips.map((c) => c.pauseBeforeMs))
      })
      queue.playParts('replay', key, parts)
      ctl.expect({ key, n: parts.length, last: -1, fn: onComplete ?? null, broken: false })
    },
    [ctl, queue, lessonId],
  )

  const playMine = useCallback(
    (key: string, utteranceId: string, onMissing: () => void) => {
      unlockTtsAudio()
      ctl.breakPending()
      ctl.setMissing(onMissing)
      const path = `/api/v1/speech/utterances/${encodeURIComponent(utteranceId)}/audio`
      queue.playParts('mine', key, [(signal) => apiGetAudio(path, { signal })])
    },
    [ctl, queue],
  )

  const active = useCallback((key: string) => snapshot.messageId === key && snapshot.phase !== 'idle', [snapshot])
  const loading = useCallback((key: string) => isLoadingSnapshot(snapshot, key), [snapshot])
  const lineOf = useCallback((key: string) => (snapshot.messageId === key && snapshot.phase === 'playing' ? snapshot.chunkIndex : null), [snapshot])

  return {
    snapshot,
    queue,
    textOnly: tts.snapshot.state === 'TEXT_ONLY',
    active,
    loading,
    lineOf,
    blocked: snapshot.phase === 'blocked',
    playLines,
    playMine,
    resume: () => {
      unlockTtsAudio()
      queue.resumeBlocked()
    },
    stop,
  }
}
