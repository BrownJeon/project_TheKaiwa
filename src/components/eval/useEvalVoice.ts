'use client'

/**
 * 평가 말하기 입력 — 회화방·수업과 같은 `useRealtimeStt`(TURN, chatId 없음 — 방 없는 발화를 #67 이 문항에 붙인다)를 쓰고 상태 줄 문구만 만든다.
 * 누르면 듣기 소리를 먼저 멈춘다(barge-in — 공용 `stopAllTts` 도 훅 안에서 한 번 더 부른다). 새 인식 경로를 만들지 않는다.
 */
import { useCallback, useEffect, useState } from 'react'
import { recordingStatus, STT_HINT_COPY, STT_STATUS_COPY, STT_SWITCH_TOAST } from '@/components/speech/sttCopy'
import { elapsedSec, showAskPermission, transcriptParts, type SttUiError } from '@/components/speech/sttUiState'
import { unlockTtsAudio } from '@/components/speech/ttsAudio'
import { useRealtimeStt, type SttFinal } from '@/components/speech/useRealtimeStt'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import { ITEM } from './evalCopy'

export interface EvalVoice {
  phase: 'idle' | 'starting' | 'recording' | 'finishing' | 'unavailable'
  recording: boolean
  db: number | null
  partial: string
  statusText: string
  pttLabel: string
  error: SttUiError | null
  press: () => void
  release: () => void
  abort: () => void
  setHint: (h: string | null) => void
}

export function useEvalVoice(o: {
  config: SttClientConfig | null
  playing: boolean
  stopSound: () => void
  hadAnswer: boolean
  busy: boolean
  busyText: string
  onFinal: (f: SttFinal) => void
  onToast: (msg: string, ms?: number) => void
}): EvalVoice {
  const [hint, setHint] = useState<string | null>(null)
  const { onFinal } = o
  // 빈 인식은 저장하지 않고 상태 줄로 다시 말하게 한다(회화방·수업과 같은 문구).
  const handleFinal = useCallback(
    (f: SttFinal) => {
      if (!f.text.trim()) return setHint(STT_HINT_COPY.EMPTY_RESULT)
      onFinal(f)
    },
    [onFinal],
  )
  const stt = useRealtimeStt({ purpose: 'TURN', config: o.config, maxSec: 30, onFinal: handleFinal })
  const ui = stt.ui
  const { switchNotice } = stt
  const { onToast, stopSound } = o
  useEffect(() => {
    if (switchNotice > 0) onToast(STT_SWITCH_TOAST, 4000)
  }, [switchNotice, onToast])
  const phase = ui.phase
  const recording = phase === 'starting' || phase === 'recording'
  const { committed, partial } = transcriptParts(ui)
  let statusText: string
  if (recording) statusText = showAskPermission(ui) ? STT_STATUS_COPY.askPermission : ui.slow ? STT_STATUS_COPY.slowConnect : ui.hint === 'TOO_QUIET' ? STT_HINT_COPY.TOO_QUIET : recordingStatus(elapsedSec(ui))
  else if (phase === 'finishing') statusText = STT_STATUS_COPY.finishing
  else if (o.busy) statusText = o.busyText
  else if (phase === 'unavailable') statusText = STT_STATUS_COPY.unavailable
  else if (hint) statusText = hint
  else if (ui.hint && ui.hint !== 'TOO_QUIET') statusText = STT_HINT_COPY[ui.hint]
  else if (o.playing) statusText = ITEM.playingIdle
  else if (ui.rationale && !ui.error) statusText = STT_STATUS_COPY.rationale
  else statusText = o.hadAnswer ? ITEM.idleAfter : STT_STATUS_COPY.idle

  const { press: sttPress, release: sttRelease } = stt
  const press = useCallback(() => {
    stopSound()
    unlockTtsAudio()
    setHint(null)
    sttPress()
  }, [stopSound, sttPress])
  const release = useCallback(() => {
    unlockTtsAudio()
    sttRelease()
  }, [sttRelease])

  return {
    phase,
    recording,
    db: ui.db,
    partial: [committed, partial].filter(Boolean).join(''),
    statusText,
    pttLabel: o.playing ? ITEM.pttBarge : ITEM.pttNormal,
    error: ui.error,
    press,
    release,
    abort: stt.abort,
    setHint,
  }
}
