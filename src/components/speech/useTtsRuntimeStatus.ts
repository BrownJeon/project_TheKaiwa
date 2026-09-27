'use client'

/** TTS 상태 스토어 구독 훅(screens §7-5) — 구독자가 생기면 조회·폴링이 시작되고 0 이 되면 멈춘다. */
import { useSyncExternalStore } from 'react'
import { getTtsStatusStore, SERVER_SNAPSHOT, type SynthesisSignal, type TtsStatusSnapshot } from './ttsStatusStore'

const noop = () => undefined
const noopSubscribe = () => noop

export function useTtsRuntimeStatus(): {
  snapshot: TtsStatusSnapshot
  recheck: () => void
  reportSynthesis: (s: SynthesisSignal) => void
  pause: (p: boolean) => void
  consumeAnnouncement: (seq: number) => string | null
} {
  const store = typeof window === 'undefined' ? null : getTtsStatusStore()
  const snapshot = useSyncExternalStore(store ? store.subscribe : noopSubscribe, store ? store.getSnapshot : () => SERVER_SNAPSHOT, () => SERVER_SNAPSHOT)
  return {
    snapshot,
    recheck: store ? store.recheck : noop,
    reportSynthesis: store ? store.reportSynthesis : noop,
    pause: store ? store.pause : noop,
    consumeAnnouncement: store ? store.consumeAnnouncement : () => null,
  }
}
