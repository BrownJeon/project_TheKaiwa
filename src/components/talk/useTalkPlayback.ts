'use client'

/**
 * 회화방 재생 훅(screens §9-3 D·E) — 방 단위 `TtsPlaybackQueue` 1개에 받기(#24 `apiGetAudio`)·재생(`ttsAudio.playWav`)을 주입하고,
 * 다시 듣기 2종(선생님 = 보관본 또는 #23 문장별, 내 목소리 = #21b)을 만든다. 화면이 가려지면 소리·받기를 멈추고 이어서 재생하지 않는다.
 *
 * 소리는 여기서 처음 시작하지 않는다 — 오디오 컨텍스트는 누름·뗌·▶·AutoplayBar 탭 핸들러가 `unlockTtsAudio()` 로 깨운다.
 * URL·오디오를 DOM·로그에 남기지 않는다.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ApiError, apiGetAudio, apiPostAudio } from '@/components/common/api'
import { playWav } from '@/components/speech/ttsAudio'
import type { SynthesisSignal } from '@/components/speech/ttsStatusStore'
import { createTtsPlaybackQueue, IDLE_SNAPSHOT, splitSentences, type PlaybackSnapshot, type PlaybackSource, type TtsPlaybackQueue } from '@/modules/speech/tts/client'
import type { ChatMessageView } from '@/types/chat'
import { fetchChunkAudio } from './chunkFetch'

/** 다시 듣기 #23 이 받는 LLM 말투(서버 `LLM_SPEECH_STYLES` 와 같은 값) — 턴 청크와 같은 캐시를 맞힌다. */
const STYLE_HINTS = new Set(['NEUTRAL', 'ENCOURAGING', 'CALM', 'CHEERFUL'])
export const REPLAY_MAX_CHARS = 100

export const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export interface ReplayErrorInfo {
  source: PlaybackSource
  messageId: string
  status: number | 'decode'
  retryAfterSec: number | null
}

function errorInfo(source: PlaybackSource, messageId: string, err: unknown): ReplayErrorInfo {
  if (err === 'decode') return { source, messageId, status: 'decode', retryAfterSec: null }
  if (err instanceof ApiError) {
    const d = err.details?.retryAfterSec
    return { source, messageId, status: err.status, retryAfterSec: typeof d === 'number' ? d : err.retryAfterSec }
  }
  return { source, messageId, status: 0, retryAfterSec: null }
}

export interface TalkPlayback {
  snapshot: PlaybackSnapshot
  queue: TtsPlaybackQueue
  /** 선생님 ▶ — 돌려준 문장 조각이 강조 단위(조각 번호 = snapshot.chunkIndex). */
  replayTutor: (m: ChatMessageView, chunkTexts: string[] | null) => string[]
  replayMine: (m: ChatMessageView) => void
  stop: () => void
}

export function useTalkPlayback(o: { onSignal: (s: SynthesisSignal) => void; onReplayError: (e: ReplayErrorInfo) => void }): TalkPlayback {
  // 큐는 방 단위 1개 — 콜백은 매 렌더 최신 것으로 바꿔 끼운다(큐가 옛 클로저를 붙잡지 않게).
  const [{ queue, bind, emitSignal }] = useState(() => {
    let cbs = o
    const q = createTtsPlaybackQueue({
      fetchAudio: (url, signal) => fetchChunkAudio(url, signal, apiGetAudio),
      play: (buf) => playWav(buf),
      onSignal: (s) => cbs.onSignal(s),
      onPartError: (source, messageId, err) => cbs.onReplayError(errorInfo(source, messageId, err)),
      now: perfNow,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    })
    return {
      queue: q,
      bind: (next: typeof o) => {
        cbs = next
      },
      emitSignal: (s: SynthesisSignal) => cbs.onSignal(s),
    }
  })
  useEffect(() => {
    bind(o)
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

  const replayTutor = useCallback(
    (m: ChatMessageView, chunkTexts: string[] | null): string[] => {
      const bufs = queue.buffersOf(m.id)
      if (bufs && chunkTexts && bufs.length === chunkTexts.length) {
        queue.playParts(
          'replay',
          m.id,
          bufs.map((b) => async () => b),
        )
        return chunkTexts
      }
      // 서명 URL(#24)은 10분 만료라 다시 쓰지 않는다 — 문장마다 #23(캐시 HIT 면 바로).
      const pieces = splitSentences(m.content, { maxChars: REPLAY_MAX_CHARS })
      const styleHint = m.speechStyle && STYLE_HINTS.has(m.speechStyle) ? m.speechStyle : undefined
      queue.playParts(
        'replay',
        m.id,
        pieces.map((p, i) => async (signal: AbortSignal) => {
          const r = await apiPostAudio(
            '/api/v1/speech/tts',
            { text: p.text, chatMessageId: m.id, context: { sentenceIdx: i, ...(styleHint ? { styleHint } : {}) } },
            { signal },
          )
          emitSignal({ ok: true, cacheHit: r.cache === 'HIT' })
          return r.data
        }),
      )
      return pieces.map((p) => p.text)
    },
    [queue, emitSignal],
  )

  const replayMine = useCallback(
    (m: ChatMessageView) => {
      if (!m.utteranceId) return
      const path = `/api/v1/speech/utterances/${encodeURIComponent(m.utteranceId)}/audio`
      queue.playParts('mine', m.id, [(signal) => apiGetAudio(path, { signal })])
    },
    [queue],
  )

  const stop = useCallback(() => queue.interrupt('USER_STOP'), [queue])

  return { snapshot, queue, replayTutor, replayMine, stop }
}
