'use client'

/**
 * 단어 상세 소리 듣기(task-023, 데모 v1 `detail-*`) — 문장 음성(#23 `POST /api/v1/speech/tts`, `audio/wav`)을 받아 `playWav` 로 재생한다.
 * 새 API·새 재생 경로 없이 미리듣기(useVoicePreview)·평가 듣기(useEvalListen)와 같은 재료를 쓴다.
 *  - `tap(target, text)` 는 **onClick 안에서 동기로** 부른다 — 첫 await 앞에서 `unlockTtsAudio()` 로 오디오를 깨운다(자동재생 정책).
 *  - 소리는 한 번에 하나: 다른 버튼을 누르면 앞 소리를 멈춘다. 같은 버튼을 받는 중·재생 중에 다시 누르면 취소·멈춤.
 *  - 브라우저가 소리를 막으면(NotAllowedError) 받은 소리를 쥐고 "한 번 더 눌러 주세요" — 다음 탭에 그 소리를 바로 튼다.
 *    틀기 시작하면 쥔 소리를 곧바로 놓고 불러오는 중으로 바꾸며, 그사이 같은 버튼의 탭은 무시한다(wordSound.soundTapAction).
 *  - 실패는 조용히 넘기지 않는다: 누른 버튼 아래 한 줄(wordSound.SOUND_MSG). 화면을 가리거나 시트를 닫으면(언마운트) 멈춘다.
 * 빠르기·목소리는 사용자 설정을 그대로 쓴다(`speechProfile`·`voiceId` 를 보내지 않는다). 오디오는 저장·로그하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiPostAudio, isAbort } from '@/components/common/api'
import { playWav, unlockTtsAudio, type TtsPlayback } from '@/components/speech/ttsAudio'
import { SOUND_IDLE, SOUND_TIMEOUT_MS, soundFailureKind, soundTapAction, type SoundTarget, type WordSoundState } from './wordSound'

interface Live {
  seq: number
  ac: AbortController | null
  pb: TtsPlayback | null
  timer: ReturnType<typeof setTimeout> | null
  /** 브라우저가 막아 틀지 못한 소리(같은 버튼을 다시 누르면 튼다). */
  pending: { target: SoundTarget; buf: ArrayBuffer } | null
  /** 쥐고 있던 소리를 틀기 시작한 버튼(재생이 시작되거나 실패할 때까지). */
  resuming: SoundTarget | null
}

export interface WordSound {
  state: WordSoundState
  tap: (target: SoundTarget, text: string) => void
  retry: (target: SoundTarget, text: string) => void
  stop: () => void
}

function isNotAllowed(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'NotAllowedError'
}

export function useWordSound(): WordSound {
  const [state, setState] = useState<WordSoundState>(SOUND_IDLE)
  const stateRef = useRef<WordSoundState>(SOUND_IDLE)
  const live = useRef<Live>({ seq: 0, ac: null, pb: null, timer: null, pending: null, resuming: null })

  const set = useCallback((s: WordSoundState) => {
    stateRef.current = s
    setState(s)
  }, [])

  /** 받는 중·재생 중인 것을 모두 끊는다(화면 상태는 건드리지 않는다 — 언마운트에서도 부른다). */
  const halt = useCallback(() => {
    const c = live.current
    c.seq++
    c.ac?.abort()
    c.pb?.stop()
    if (c.timer) clearTimeout(c.timer)
    c.ac = null
    c.pb = null
    c.timer = null
    c.pending = null
    c.resuming = null
  }, [])

  const stop = useCallback(() => {
    halt()
    set(SOUND_IDLE)
  }, [halt, set])

  const playBuffer = useCallback(
    async (my: number, target: SoundTarget, buf: ArrayBuffer) => {
      const c = live.current
      let pb: TtsPlayback
      try {
        pb = await playWav(buf)
      } catch (e) {
        if (my !== c.seq) return
        c.resuming = null
        if (isNotAllowed(e)) {
          c.pending = { target, buf }
          set({ target, phase: 'blocked', msg: { target, kind: 'blocked' }, retry: false })
          return
        }
        set({ target: null, phase: 'idle', msg: { target, kind: 'fail' }, retry: false })
        return
      }
      if (my !== c.seq) return pb.stop()
      c.resuming = null
      c.pb = pb
      c.pending = null
      set({ target, phase: 'playing', msg: null, retry: false })
      await pb.ended
      if (my === c.seq && c.pb === pb) {
        c.pb = null
        set(SOUND_IDLE)
      }
    },
    [set],
  )

  const load = useCallback(
    (target: SoundTarget, text: string, retry: boolean) => {
      unlockTtsAudio()
      halt()
      const c = live.current
      const my = c.seq
      const ac = new AbortController()
      let timedOut = false
      c.ac = ac
      c.timer = setTimeout(() => {
        timedOut = true
        ac.abort()
      }, SOUND_TIMEOUT_MS)
      set({ target, phase: 'loading', msg: null, retry })
      void (async () => {
        let buf: ArrayBuffer
        try {
          buf = (await apiPostAudio('/api/v1/speech/tts', { text }, { signal: ac.signal })).data
        } catch (e) {
          if (my !== c.seq) return
          if (c.timer) clearTimeout(c.timer)
          c.timer = null
          c.ac = null
          if (isAbort(e) && !timedOut) return set(SOUND_IDLE)
          const status = timedOut ? null : e instanceof ApiError ? e.status : 0
          set({ target: null, phase: 'idle', msg: { target, kind: soundFailureKind({ status, timedOut }) }, retry: false })
          return
        }
        if (my !== c.seq) return
        if (c.timer) clearTimeout(c.timer)
        c.timer = null
        c.ac = null
        await playBuffer(my, target, buf)
      })()
    },
    [halt, playBuffer, set],
  )

  const tap = useCallback(
    (target: SoundTarget, text: string) => {
      const c = live.current
      const action = soundTapAction(stateRef.current, target, c.pending?.target ?? null, c.resuming)
      if (action === 'ignore') return
      if (action === 'stop') return stop()
      if (action === 'resume' && c.pending) {
        unlockTtsAudio()
        const { buf } = c.pending
        c.pending = null
        c.resuming = target
        set({ target, phase: 'loading', msg: null, retry: false })
        void playBuffer(c.seq, target, buf)
        return
      }
      load(target, text, false)
    },
    [load, playBuffer, set, stop],
  )

  const retry = useCallback((target: SoundTarget, text: string) => load(target, text, true), [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      halt()
    }
  }, [halt, stop])

  return { state, tap, retry, stop }
}
