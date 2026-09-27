'use client'

/**
 * 통합 미리듣기 상태기계(screens §7-3 B) — idle → loading → playing / blocked / cooldown.
 *   toggle(draft) 는 **반드시 onClick 안에서 동기로** 부른다: 재생 중이면 정지, blocked 면 이번 탭으로 재생,
 *   idle 이면 첫 await 앞에서 오디오를 깨우고(`unlockTtsAudio`) `POST /api/v1/voices/preview`(audio/wav) 를 부른다.
 *   invalidate() 는 draft 가 바뀌는 모든 onChange 에서 — 재생 정지 + 대기 중 요청 abort + blocked 버퍼 폐기(바뀐 설정 뒤 옛 소리 재생 금지).
 * 결과는 onSignal 로 상태 스토어에 넣는다(성공·캐시 적중 / 422·502·504·0). 429 는 Retry-After 만큼 cooldown.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiPostAudio, isAbort } from '@/components/common/api'
import { useCountdown } from '@/components/common/useNow'
import { playWav, unlockTtsAudio, type TtsPlayback } from './ttsAudio'
import { PLAYBACK_FAILED_TEXT, previewErrorText } from './ttsStatusCopy'
import type { SynthesisSignal } from './ttsStatusStore'
import type { PreviewPhase } from './VoicePreviewButton'

const PREVIEW_TIMEOUT_MS = 10_000

export interface PreviewDraftBody {
  voiceProfileId: string
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
  speechProfile: string
}

export function useVoicePreview({ onError, onSignal }: { onError: (message: string) => void; onSignal: (s: SynthesisSignal) => void }) {
  const [phase, setPhase] = useState<PreviewPhase>('idle')
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const phaseRef = useRef<PreviewPhase>('idle')
  const acRef = useRef<AbortController | null>(null)
  const playerRef = useRef<TtsPlayback | null>(null)
  const pendingRef = useRef<ArrayBuffer | null>(null)
  const cbRef = useRef({ onError, onSignal })
  useEffect(() => {
    cbRef.current = { onError, onSignal }
  })
  const cooldownSec = useCountdown(cooldownUntil)

  const set = useCallback((p: PreviewPhase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const stop = useCallback(() => {
    acRef.current?.abort()
    acRef.current = null
    playerRef.current?.stop()
    playerRef.current = null
    pendingRef.current = null
    if (phaseRef.current !== 'cooldown') set('idle')
  }, [set])

  const startPlayback = useCallback(
    async (buf: ArrayBuffer) => {
      try {
        const p = await playWav(buf)
        playerRef.current = p
        pendingRef.current = null
        set('playing')
        void p.ended.then(() => {
          if (playerRef.current === p) {
            playerRef.current = null
            set('idle')
          }
        })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          pendingRef.current = buf
          set('blocked')
          return
        }
        pendingRef.current = null
        cbRef.current.onError(PLAYBACK_FAILED_TEXT)
        set('idle')
      }
    },
    [set],
  )

  const toggle = useCallback(
    (draft: PreviewDraftBody) => {
      const now = phaseRef.current
      if (now === 'playing') return stop()
      if (now === 'blocked' && pendingRef.current) {
        unlockTtsAudio()
        void startPlayback(pendingRef.current)
        return
      }
      if (now === 'loading' || now === 'cooldown') return
      unlockTtsAudio()
      const ac = new AbortController()
      acRef.current = ac
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        ac.abort()
      }, PREVIEW_TIMEOUT_MS)
      set('loading')
      void (async () => {
        try {
          const res = await apiPostAudio('/api/v1/voices/preview', draft, { signal: ac.signal })
          if (acRef.current !== ac) return
          acRef.current = null
          cbRef.current.onSignal({ ok: true, cacheHit: res.cache === 'HIT' })
          await startPlayback(res.data)
        } catch (e) {
          if (acRef.current !== ac) return
          acRef.current = null
          if (isAbort(e) && !timedOut) return set('idle')
          const status = timedOut ? 504 : e instanceof ApiError ? e.status : 0
          if (status === 429) {
            const sec = e instanceof ApiError ? (typeof e.details?.retryAfterSec === 'number' ? e.details.retryAfterSec : e.retryAfterSec) : null
            cbRef.current.onError(previewErrorText(429, sec))
            setCooldownUntil(Date.now() + (sec ?? 60) * 1000)
            return set('cooldown')
          }
          if (status === 422 || status === 502 || status === 504 || status === 0) cbRef.current.onSignal({ ok: false, status })
          cbRef.current.onError(status === 400 && e instanceof ApiError ? e.message : previewErrorText(status))
          set('idle')
        } finally {
          clearTimeout(timer)
        }
      })()
    },
    [set, startPlayback, stop],
  )

  // cooldown 이 끝나면 idle 로.
  useEffect(() => {
    if (phase === 'cooldown' && cooldownSec === 0) {
      phaseRef.current = 'idle'
      const t = setTimeout(() => {
        setPhase('idle')
        setCooldownUntil(null)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [phase, cooldownSec])

  // 화면이 가려지거나 떠나면 멈춘다.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      acRef.current?.abort()
      playerRef.current?.stop()
    }
  }, [stop])

  return { phase, cooldownSec, toggle, stop, invalidate: stop }
}
