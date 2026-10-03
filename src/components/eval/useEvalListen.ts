'use client'

/**
 * 듣고 답하기 소리(#67a) — 누를 때만 받아 재생한다(레슨 #62c 와 같은 재료: 조각 서명 URL → `fetchChunkAudio` → `concatWav` → `playWav`).
 * 결정 (e)=B: 문항마다 **소리가 실제로 나기 시작한 횟수**를 세어 2번까지(받기 실패는 세지 않음). 횟수는 이 브라우저 세션에만 둔다(편의 — 새로고침 대비).
 * 푸시투토크를 누르면 공용 `stopAllTts()` 가 소리를 멈춘다(barge-in). 서버 TTS 불가(422)는 표시등 스토어에 알려 자막만으로 바뀌게 한다.
 * 서명 URL·오디오는 저장·로그하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiGetAudio, apiPost, isAbort } from '@/components/common/api'
import { readStore, writeStore } from '@/components/common/storage'
import { concatWav } from '@/components/lesson/wav'
import { playWav, unlockTtsAudio, type TtsPlayback } from '@/components/speech/ttsAudio'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { fetchChunkAudio } from '@/components/talk/chunkFetch'
import type { EvalAudioResult } from '@/types/evaluation'
import { LISTEN } from './evalCopy'

export interface EvalListen {
  /** 지금 소리를 받는 중·나는 중인 문항 id. */
  active: string | null
  phase: 'idle' | 'loading' | 'playing'
  played: (itemId: string) => number
  /** 이 문항 소리를 받지 못했다(다시 시도·글자로 보기). */
  failed: (itemId: string) => boolean
  clearFailed: (itemId: string) => void
  textOnly: boolean
  play: (itemId: string, o?: { count?: boolean }) => void
  stop: () => void
}

const playsKey = (evaluationId: string) => `kaiwa.eval.plays.${evaluationId}`

function readPlays(evaluationId: string): Record<string, number> {
  try {
    const v: unknown = JSON.parse(readStore('session', playsKey(evaluationId)) ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function useEvalListen(evaluationId: string, onToast: (m: string) => void): EvalListen {
  const tts = useTtsRuntimeStatus()
  const { reportSynthesis } = tts
  const [active, setActive] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing'>('idle')
  const [plays, setPlays] = useState<Record<string, number>>({})
  const [failedIds, setFailedIds] = useState<Record<string, true>>({})
  const cur = useRef<{ seq: number; ac: AbortController | null; pb: TtsPlayback | null }>({ seq: 0, ac: null, pb: null })

  useEffect(() => {
    queueMicrotask(() => setPlays(readPlays(evaluationId)))
  }, [evaluationId])

  const stop = useCallback(() => {
    const c = cur.current
    c.seq++
    c.ac?.abort()
    c.pb?.stop()
    c.ac = null
    c.pb = null
    setActive(null)
    setPhase('idle')
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [stop])

  const play = useCallback(
    (itemId: string, o: { count?: boolean } = {}) => {
      unlockTtsAudio()
      stop()
      const c = cur.current
      const my = c.seq
      const ac = new AbortController()
      c.ac = ac
      setActive(itemId)
      setPhase('loading')
      setFailedIds((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      void (async () => {
        try {
          let r: EvalAudioResult
          try {
            r = await apiPost<EvalAudioResult>(`/api/v1/evaluations/${encodeURIComponent(evaluationId)}/items/${encodeURIComponent(itemId)}/audio`, {}, { signal: ac.signal })
          } catch (e) {
            if (e instanceof ApiError) reportSynthesis({ ok: false, status: e.status })
            throw e
          }
          reportSynthesis({ ok: true, cacheHit: r.clips.every((x) => x.cached) })
          const bufs = await Promise.all(r.clips.map((x) => fetchChunkAudio(x.url, ac.signal, apiGetAudio)))
          if (my !== c.seq) return
          const pb = await playWav(concatWav(bufs, r.clips.map((x) => x.pauseBeforeMs)))
          if (my !== c.seq) return pb.stop()
          c.pb = pb
          setPhase('playing')
          if (o.count !== false) {
            setPlays((prev) => {
              const next = { ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }
              writeStore('session', playsKey(evaluationId), JSON.stringify(next))
              return next
            })
          }
          await pb.ended
          if (my === c.seq) {
            c.pb = null
            c.ac = null
            setActive(null)
            setPhase('idle')
          }
        } catch (e) {
          if (my !== c.seq || isAbort(e)) return
          c.ac = null
          setActive(null)
          setPhase('idle')
          if (e instanceof DOMException && e.name === 'NotAllowedError') return onToast(LISTEN.blocked)
          const status = e instanceof ApiError ? e.status : 0
          if (status === 422) return
          if (status === 429) return onToast(LISTEN.rate)
          setFailedIds((prev) => ({ ...prev, [itemId]: true }))
        }
      })()
    },
    [evaluationId, onToast, reportSynthesis, stop],
  )

  return {
    active,
    phase,
    played: (itemId) => plays[itemId] ?? 0,
    failed: (itemId) => !!failedIds[itemId],
    clearFailed: (itemId) =>
      setFailedIds((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      }),
    textOnly: tts.snapshot.state === 'TEXT_ONLY',
    play,
    stop,
  }
}
