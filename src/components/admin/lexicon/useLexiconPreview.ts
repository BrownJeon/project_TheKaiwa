'use client'

/**
 * 저장 전 미리듣기 상태(screens.md §10-3 C). 결과는 **초안 키**(초안 + 예문 + 목소리)와 함께 보관하고, 키가 바뀌면 흐리게(stale)
 * + ▶ 잠금 + 재생 정지. 소리는 ▶ 탭 때 받는다(같은 L7 을 `Accept: audio/wav` + `side`) — 받기 전에 **동기로** `unlockTtsAudio()`.
 * 소리·초안을 브라우저 저장소·DOM(`<audio src>`)에 두지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { retryAfterOf, toErr } from '@/components/common/errors'
import { useCountdown } from '@/components/common/useNow'
import { playWav, type TtsPlayback, unlockTtsAudio } from '@/components/speech/ttsAudio'
import type { LexiconPreviewDto } from '@/types/lexicon'
import { preview, previewAudio, type PreviewBody } from './lexiconApi'
import { PREVIEW, previewErrorText } from './lexiconCopy'

export type PreviewSide = 'before' | 'after'

export interface PreviewResult {
  key: string
  body: PreviewBody
  data: LexiconPreviewDto
}

export function useLexiconPreview(currentKey: string) {
  const [phase, setPhase] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [playing, setPlaying] = useState<PreviewSide | null>(null)
  const [audioLoading, setAudioLoading] = useState<PreviewSide | null>(null)
  const playbackRef = useRef<TtsPlayback | null>(null)
  const checkCtrl = useRef<AbortController | null>(null)
  const audioCtrl = useRef<AbortController | null>(null)
  const remaining = useCountdown(cooldownUntil)
  const cooling = cooldownUntil !== null && (remaining === null || remaining > 0)
  const stale = result !== null && result.key !== currentKey

  const stopAudio = useCallback(() => {
    audioCtrl.current?.abort()
    audioCtrl.current = null
    playbackRef.current?.stop()
    playbackRef.current = null
  }, [])

  // 입력이 바뀌어 결과가 흐려지면 소리를 멈추고 받는 중인 소리를 버린다(결과는 흐린 채로 남긴다).
  useEffect(() => {
    if (stale) stopAudio()
  }, [stale, stopAudio])

  useEffect(
    () => () => {
      checkCtrl.current?.abort()
      stopAudio()
    },
    [stopAudio],
  )

  const check = useCallback(
    async (body: PreviewBody) => {
      checkCtrl.current?.abort()
      stopAudio()
      const ctrl = new AbortController()
      checkCtrl.current = ctrl
      setPhase('checking')
      setNotice(null)
      try {
        const data = await preview(body, { signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        setResult({ key: currentKey, body, data })
        setPhase('ready')
      } catch (e) {
        if (isAbort(e) || ctrl.signal.aborted) return
        const err = toErr(e)
        if (err.status === 429) setCooldownUntil(Date.now() + retryAfterOf(err) * 1000)
        setNotice(previewErrorText(err))
        setPhase('error')
      }
    },
    [currentKey, stopAudio],
  )

  /** onClick 안에서 부른다 — 첫 줄의 `unlockTtsAudio()` 가 await 앞에 있어야 자동재생 정책을 통과한다. */
  const play = useCallback(
    (side: PreviewSide) => {
      unlockTtsAudio()
      if (!result || stale) return
      if (playing === side) {
        stopAudio()
        setPlaying(null)
        return
      }
      stopAudio()
      setPlaying(null)
      const ctrl = new AbortController()
      audioCtrl.current = ctrl
      setAudioLoading(side)
      setNotice(null)
      void (async () => {
        try {
          const { data } = await previewAudio(result.body, side, { signal: ctrl.signal })
          if (ctrl.signal.aborted) return
          const pb = await playWav(data)
          if (ctrl.signal.aborted) {
            pb.stop()
            return
          }
          playbackRef.current = pb
          setPlaying(side)
          void pb.ended.then(() => {
            if (playbackRef.current === pb) playbackRef.current = null
            setPlaying((p) => (p === side ? null : p))
          })
        } catch (e) {
          if (isAbort(e) || ctrl.signal.aborted) return
          if (e instanceof DOMException) setNotice(PREVIEW.playFailed)
          else {
            const err = toErr(e)
            if (err.status === 429) {
              setCooldownUntil(Date.now() + retryAfterOf(err) * 1000)
              setNotice(previewErrorText(err))
            } else if (err.status === 0 || err.status === 403) setNotice(previewErrorText(err))
            else setNotice(PREVIEW.audioFailed)
          }
        } finally {
          if (audioCtrl.current === ctrl) audioCtrl.current = null
          setAudioLoading((a) => (a === side ? null : a))
        }
      })()
    },
    [result, stale, playing, stopAudio],
  )

  return {
    phase,
    result,
    notice,
    setNotice,
    stale,
    cooling,
    remaining: cooling ? remaining : null,
    playing: stale ? null : playing,
    audioLoading: stale ? null : audioLoading,
    check,
    play,
  }
}
