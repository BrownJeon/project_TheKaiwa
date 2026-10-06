'use client'

/**
 * 내 목소리(#21b) 재생 — 화면 하나에 재생 큐 1개(`createTtsPlaybackQueue` + `playWav`, 수업 화면 `playMine` 과 같은 방식 — 새 재생 경로 없음).
 * 한 번에 한 줄만 소리 난다. 탭 핸들러 첫 줄에서 `unlockTtsAudio()`. 화면이 가려지면 멈추고, 떠나면 큐를 버린다.
 * 404(보관 기간이 지났거나 파일 없음)만 `onMissing` 으로 알린다 — 그 밖 실패는 조용히(다시 누르면 된다).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError, apiGetAudio } from '@/components/common/api'
import { playWav, unlockTtsAudio } from '@/components/speech/ttsAudio'
import { createTtsPlaybackQueue, IDLE_SNAPSHOT, type PlaybackSnapshot } from '@/modules/speech/tts/client'

export type MineState = 'idle' | 'loading' | 'playing'

/** 큐 스냅샷 → 이 줄 버튼 상태(받는 중 = 첫 소리 전). */
export function mineStateOf(s: Pick<PlaybackSnapshot, 'phase' | 'messageId' | 'chunkIndex'>, key: string): MineState {
  if (s.messageId !== key || s.phase === 'idle') return 'idle'
  if (s.phase === 'waiting' || (s.phase === 'playing' && s.chunkIndex === null)) return 'loading'
  return s.phase === 'playing' ? 'playing' : 'idle'
}

function createController() {
  let onMissing: ((key: string) => void) | null = null
  const queue = createTtsPlaybackQueue({
    fetchAudio: (url, signal) => apiGetAudio(url, { signal }),
    play: (buf) => playWav(buf),
    onPartError: (_source, key, err) => {
      if (err instanceof ApiError && err.status === 404) onMissing?.(key)
    },
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  })
  return {
    queue,
    bind: (fn: (key: string) => void) => {
      onMissing = fn
    },
  }
}

export function useMinePlayback(onMissing: (utteranceId: string) => void) {
  const [ctl] = useState(createController)
  const { queue } = ctl
  useEffect(() => {
    ctl.bind(onMissing)
  })
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, () => IDLE_SNAPSHOT)

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') queue.interrupt('HIDDEN')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      queue.dispose()
    }
  }, [queue])

  const toggle = useCallback(
    (utteranceId: string) => {
      unlockTtsAudio()
      const now = queue.getSnapshot()
      if (now.messageId === utteranceId && now.phase === 'blocked') {
        queue.resumeBlocked()
        return
      }
      if (mineStateOf(now, utteranceId) !== 'idle') {
        queue.interrupt('USER_STOP')
        return
      }
      const path = `/api/v1/speech/utterances/${encodeURIComponent(utteranceId)}/audio`
      queue.playParts('mine', utteranceId, [(signal) => apiGetAudio(path, { signal })])
    },
    [queue],
  )

  return { stateOf: (id: string) => mineStateOf(snapshot, id), toggle }
}
