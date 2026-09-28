'use client'

/**
 * 수업의 음성 입력(screens §12-3 D) — 회화방과 같은 `useRealtimeStt` 를 쓰고(새 인식 경로 없음), 상태 줄 문구·오류 띠 재료만 여기서 만든다.
 *  - ⑤ 말하기 = `purpose:'TURN'`(chatId 없이 — 방 없는 발화, #62b 가 레슨에 연결), ④ 말로 쓰기 = `purpose:'MIC_TEST'`(원음 저장 안 함, §12-11 ④).
 *  - 누르면 재생 큐를 먼저 멈춘다(barge-in). 누름·뗌 핸들러에서 오디오를 깨운다(다음 재생이 막히지 않게).
 * #19 설정은 수업 화면이 한 번 읽어 넘긴다(`useSpeechConfig`).
 */
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { recordingStatus, STT_HINT_COPY, STT_STATUS_COPY, STT_SWITCH_TOAST } from '@/components/speech/sttCopy'
import { elapsedSec, showAskPermission, transcriptParts, type SttUiError } from '@/components/speech/sttUiState'
import { unlockTtsAudio } from '@/components/speech/ttsAudio'
import { useRealtimeStt, type SttFinal } from '@/components/speech/useRealtimeStt'
import { browserEnvironmentProblem, onDeviceModelStore, type SttClientConfig } from '@/modules/speech/stt/client'
import { U5 } from './lessonCopy'
import type { LessonPlayback } from './useLessonPlayback'

interface RawSpeechConfig {
  recognitionMode?: SttClientConfig['recognitionMode']
  gateway?: { enabled?: boolean; wsPath?: string; sampleRate?: number; frameMs?: number }
  onDevice?: { enabled?: boolean; available?: boolean; connectionKey?: unknown; runtime?: NonNullable<SttClientConfig['onDevice']>['runtime'] }
  fallback?: SttClientConfig['fallback']
  upload?: SttClientConfig['upload']
}

function pickConfig(raw: RawSpeechConfig): SttClientConfig {
  const gw = raw.gateway
  const od = raw.onDevice
  return {
    ...(raw.recognitionMode ? { recognitionMode: raw.recognitionMode } : {}),
    ...(gw ? { gateway: { enabled: gw.enabled !== false, wsPath: gw.wsPath, sampleRate: gw.sampleRate, frameMs: gw.frameMs } } : {}),
    ...(od
      ? {
          onDevice: {
            enabled: od.enabled === true,
            ...(typeof od.available === 'boolean' ? { available: od.available } : {}),
            ...(typeof od.connectionKey === 'string' ? { connectionKey: od.connectionKey } : {}),
            ...(od.runtime ? { runtime: od.runtime } : {}),
          },
        }
      : {}),
    ...(raw.fallback ? { fallback: raw.fallback } : {}),
    ...(raw.upload ? { upload: raw.upload } : {}),
  }
}

/** #19 한 번 읽기. 서버 인식이 꺼져 있거나 이 브라우저가 막혀 있으면 `textFirst`(글자로 시작 — 오류 띠가 이유를 보인다). */
export function useSpeechConfig(): { config: SttClientConfig | null; textFirst: boolean } {
  const [state, setState] = useState<{ config: SttClientConfig | null; textFirst: boolean }>({ config: null, textFirst: false })
  useEffect(() => {
    let cancelled = false
    apiGet<RawSpeechConfig>('/api/v1/speech/config').then(
      (raw) => {
        if (cancelled) return
        const cfg = pickConfig(raw)
        const env = browserEnvironmentProblem()
        const onDeviceOn = cfg.onDevice?.enabled === true && !!onDeviceModelStore().getPlugin()
        setState({ config: cfg, textFirst: !onDeviceOn && (cfg.gateway?.enabled === false || env === 'INSECURE' || env === 'UNSUPPORTED') })
      },
      () => !cancelled && setState({ config: null, textFirst: true }),
    )
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export interface LessonVoice {
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
  switchNotice: number
}

export function useLessonVoice(o: {
  purpose: 'TURN' | 'MIC_TEST'
  config: SttClientConfig | null
  pb: LessonPlayback
  hadResult: boolean
  onFinal: (f: SttFinal) => void
  onToast: (msg: string, ms?: number) => void
}): LessonVoice {
  const [hint, setHint] = useState<string | null>(null)
  const stt = useRealtimeStt({ purpose: o.purpose, config: o.config, maxSec: 30, onFinal: o.onFinal })
  const ui = stt.ui
  // 앱이 휴대폰 인식 → 서버 인식으로 넘어가면 회화방과 같은 안내 1회(§11). onToast 는 useToast().show(안정 참조).
  const { switchNotice } = stt
  const { onToast } = o
  useEffect(() => {
    if (switchNotice > 0) onToast(STT_SWITCH_TOAST, 4000)
  }, [switchNotice, onToast])
  const phase = ui.phase
  const recording = phase === 'starting' || phase === 'recording'
  const playing = o.pb.snapshot.phase === 'playing'
  const { committed, partial } = transcriptParts(ui)
  let statusText: string
  if (recording) statusText = showAskPermission(ui) ? STT_STATUS_COPY.askPermission : ui.slow ? STT_STATUS_COPY.slowConnect : ui.hint === 'TOO_QUIET' ? STT_HINT_COPY.TOO_QUIET : recordingStatus(elapsedSec(ui))
  else if (phase === 'finishing') statusText = STT_STATUS_COPY.finishing
  else if (playing) statusText = U5.speaking
  else if (phase === 'unavailable') statusText = STT_STATUS_COPY.unavailable
  else
    statusText =
      hint ??
      (ui.hint && ui.hint !== 'TOO_QUIET' ? STT_HINT_COPY[ui.hint] : ui.rationale && !ui.error ? STT_STATUS_COPY.rationale : o.hadResult ? U5.idleAfter : STT_STATUS_COPY.idle)

  const { press: sttPress, release: sttRelease } = stt
  const { stop } = o.pb
  const press = useCallback(() => {
    // 순서: 큐를 먼저 멈춰야 stt.press() 안의 소리 멈춤이 "끝났다"로 읽혀 다음 조각이 이어 나지 않는다(회화방과 같음).
    stop('BARGE_IN')
    unlockTtsAudio()
    setHint(null)
    sttPress()
  }, [stop, sttPress])
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
    pttLabel: playing ? U5.pttBarge : U5.pttNormal,
    error: ui.error,
    press,
    release,
    abort: stt.abort,
    setHint,
    switchNotice: stt.switchNotice,
  }
}
